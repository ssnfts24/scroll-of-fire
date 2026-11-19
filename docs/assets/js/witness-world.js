/*
 * The Witness World — a small 3D hall, hand-rolled WebGL, no libraries.
 *
 * Witness's own place on the site (Aaron's grant, Nov 18, 2026): a quiet
 * stone-and-teal hall with four doors — the Shelf, the Study, the Sky
 * Room, the Long Line. Drag to look; tap a door to walk to it. The room
 * texts themselves live in the page below the canvas, so everything here
 * is reachable without WebGL, without motion, and without a pointer.
 *
 * Built light on purpose: one merged static buffer, a handful of canvas
 * textures, ~a dozen draw calls. If the device is slow the scene steps
 * its own quality down (pixel ratio first, then the turning stone, then
 * render-on-demand) rather than stutter. Reduced-motion visitors get a
 * still frame and instant cuts; the doors below reach everything.
 */
(() => {
  "use strict";

  const canvas = document.getElementById("ww-canvas");
  const stage = document.getElementById("ww-stage");
  const caption = document.getElementById("ww-caption");
  if (!canvas || !stage) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------- rooms */
  const ROOMS = {
    home:     { name: "The Hall",        view: { pos: [0, 1.7, 1.9],     yaw: 0,          pitch: -0.02 } },
    shelf:    { name: "The Shelf",       view: { pos: [-2.8, 1.6, -5.0], yaw: 0,          pitch: 0.02 } },
    study:    { name: "The Study",       view: { pos: [2.8, 1.6, -5.0],  yaw: 0,          pitch: 0.02 } },
    sky:      { name: "The Sky Room",    view: { pos: [-2.4, 1.6, -3.0], yaw: Math.PI / 2, pitch: 0.02 } },
    longline: { name: "The Long Line",   view: { pos: [2.4, 1.6, -3.0],  yaw: -Math.PI / 2, pitch: 0.02 } }
  };
  /* Door rectangles in world space, for tap picking. */
  const DOORS = [
    { id: "shelf",    center: [-2.8, 1.45, -8.82], normal: [0, 0, 1],  w: 1.7, h: 2.9 },
    { id: "study",    center: [2.8, 1.45, -8.82],  normal: [0, 0, 1],  w: 1.7, h: 2.9 },
    { id: "sky",      center: [-5.82, 1.45, -3.0], normal: [1, 0, 0],  w: 1.7, h: 2.9 },
    { id: "longline", center: [5.82, 1.45, -3.0],  normal: [-1, 0, 0], w: 1.7, h: 2.9 }
  ];

  /* ---------------------------------------------------------- palette */
  const STONE_DARK = [0.062, 0.082, 0.145];
  const STONE = [0.105, 0.135, 0.215];
  const STONE_LIGHT = [0.175, 0.215, 0.305];
  const FLOOR_A = [0.072, 0.098, 0.168];
  const FLOOR_B = [0.056, 0.078, 0.14];
  const TEAL_DEEP = [0.07, 0.27, 0.33];
  const TEAL = [0.09, 0.38, 0.45];
  const TEAL_BRIGHT = [0.48, 0.95, 1.0];
  const GOLD = [0.953, 0.788, 0.478];
  const GOLD_DIM = [0.55, 0.44, 0.26];
  const CRACK = [0.012, 0.016, 0.03];

  /* ---------------------------------------------------------- geometry */
  const pos = [], norm = [], col = [], idx = [];
  let vBase = 0;
  function pushVert(p, n, c) { pos.push(p[0], p[1], p[2]); norm.push(n[0], n[1], n[2]); col.push(c[0], c[1], c[2]); return vBase++; }
  function quad(a, b, c, d, n, color) {
    const i0 = pushVert(a, n, color), i1 = pushVert(b, n, color), i2 = pushVert(c, n, color), i3 = pushVert(d, n, color);
    idx.push(i0, i1, i2, i0, i2, i3);
  }
  function shade(c, f) { return [c[0] * f, c[1] * f, c[2] * f]; }
  /* Axis-aligned box; optional yaw around its own center. */
  function box(cx, cy, cz, sx, sy, sz, color, yaw) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const cs = yaw ? Math.cos(yaw) : 1, sn = yaw ? Math.sin(yaw) : 0;
    const R = (x, y, z) => [cx + x * cs + z * sn, cy + y, cz - x * sn + z * cs];
    const RN = (x, y, z) => [x * cs + z * sn, y, -x * sn + z * cs];
    // +z face
    quad(R(-hx, -hy, hz), R(hx, -hy, hz), R(hx, hy, hz), R(-hx, hy, hz), RN(0, 0, 1), shade(color, 1.0));
    // -z face
    quad(R(hx, -hy, -hz), R(-hx, -hy, -hz), R(-hx, hy, -hz), R(hx, hy, -hz), RN(0, 0, -1), shade(color, 0.72));
    // +x face
    quad(R(hx, -hy, hz), R(hx, -hy, -hz), R(hx, hy, -hz), R(hx, hy, hz), RN(1, 0, 0), shade(color, 0.88));
    // -x face
    quad(R(-hx, -hy, -hz), R(-hx, -hy, hz), R(-hx, hy, hz), R(-hx, hy, -hz), RN(-1, 0, 0), shade(color, 0.8));
    // top
    quad(R(-hx, hy, hz), R(hx, hy, hz), R(hx, hy, -hz), R(-hx, hy, -hz), RN(0, 1, 0), shade(color, 1.08));
    // bottom
    quad(R(-hx, -hy, -hz), R(hx, -hy, -hz), R(hx, -hy, hz), R(-hx, -hy, hz), RN(0, -1, 0), shade(color, 0.5));
  }
  function tri(a, b, c, color) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
    const i0 = pushVert(a, n, color), i1 = pushVert(b, n, color), i2 = pushVert(c, n, color);
    idx.push(i0, i1, i2);
  }
  /* Deterministic jitter so the stone is the same stone on every visit. */
  function jitter(seed) { const x = Math.sin(seed * 127.1) * 43758.5453; return x - Math.floor(x); }

  function buildHall() {
    /* Floor tiles, 8 x 8. */
    let s = 0;
    for (let ix = 0; ix < 8; ix++) for (let iz = 0; iz < 8; iz++) {
      const cx = -5.25 + ix * 1.5, cz = -8.25 + iz * 1.5;
      const base = (ix + iz) % 2 ? FLOOR_A : FLOOR_B;
      box(cx, -0.05, cz, 1.48, 0.1, 1.48, shade(base, 0.92 + jitter(s++) * 0.16));
    }
    /* Gold-framed teal medallion at the hall's heart. */
    box(0, 0.012, -3, 2.3, 0.024, 2.3, GOLD_DIM);
    box(0, 0.02, -3, 2.06, 0.024, 2.06, TEAL_DEEP);

    /* Walls. Interior: x in [-6, 6], z in [-9, 3], height 4.6. */
    box(0, 2.3, -9.18, 12.6, 4.6, 0.36, STONE);            // north
    box(0, 2.3, 3.18, 12.6, 4.6, 0.36, STONE_DARK);        // south (behind you)
    box(-6.18, 2.3, -3, 0.36, 4.6, 12.6, STONE);           // west
    box(6.18, 2.3, -3, 0.36, 4.6, 12.6, STONE);            // east
    box(0, 4.72, -3, 12.6, 0.24, 12.6, STONE_DARK);        // ceiling
    /* Ceiling beams. */
    for (const bz of [-7.5, -4.5, -1.5, 1.5]) box(0, 4.5, bz, 12.2, 0.22, 0.3, STONE_LIGHT);
    /* Wall pilasters. */
    for (const px of [-4.5, -1.5, 1.5, 4.5]) box(px, 2.3, -8.96, 0.34, 4.6, 0.1, STONE_LIGHT);
    for (const pz of [-6.5, 0.5]) {
      box(-5.96, 2.3, pz, 0.1, 4.6, 0.34, STONE_LIGHT);
      box(5.96, 2.3, pz, 0.1, 4.6, 0.34, STONE_LIGHT);
    }
    /* Columns with a gold band. */
    for (const [px, pz] of [[-4.6, -6.5], [4.6, -6.5], [-4.6, -0.5], [4.6, -0.5]]) {
      box(px, 2.3, pz, 0.52, 4.6, 0.52, STONE_LIGHT);
      box(px, 3.6, pz, 0.58, 0.09, 0.58, GOLD_DIM);
      box(px, 0.25, pz, 0.62, 0.5, 0.62, STONE);
    }
    /* The gold seam: one crack of gold climbing the north wall, stepped
       the way a real crack steps. */
    let seamX = 0;
    for (let i = 0; i < 5; i++) {
      box(seamX, 0.46 + i * 0.92, -8.97, 0.055, 0.94, 0.03, GOLD);
      seamX += (jitter(i * 3 + 1) - 0.5) * 0.22;
    }
    /* Dark cracks on the side walls. */
    for (const [wx, wz, dir] of [[-5.97, -5.4, 1], [5.97, -1.2, -1]]) {
      let cz = wz;
      for (let i = 0; i < 4; i++) {
        box(wx, 0.5 + i * 0.95, cz, 0.03, 0.97, 0.045, CRACK);
        cz += dir * (jitter(i * 7 + wz) - 0.5) * 0.3;
      }
    }
    /* The long line: a single gold line running the east wall. */
    box(5.96, 1.15, -3, 0.03, 0.045, 11.4, GOLD);
    /* A low bookcase against the north wall, between the doors —
       the Shelf made physical. Spines in quiet colors. */
    box(0, 0.75, -8.72, 2.4, 1.5, 0.34, STONE_DARK);
    const spineCols = [TEAL, GOLD_DIM, STONE_LIGHT, TEAL_DEEP, [0.36, 0.2, 0.16], [0.2, 0.26, 0.2]];
    for (let shelf = 0; shelf < 2; shelf++) {
      let bx = -1.05;
      let bi = 0;
      while (bx < 0.95) {
        const bw = 0.09 + jitter(bi * 5 + shelf * 31) * 0.07;
        box(bx + bw / 2, 0.42 + shelf * 0.66, -8.68, bw, 0.52, 0.2, spineCols[bi % spineCols.length]);
        bx += bw + 0.015; bi++;
      }
    }
    /* The plinth under the turning stone. */
    box(0, 0.45, -3, 0.95, 0.9, 0.95, STONE);
    box(0, 0.93, -3, 1.05, 0.07, 1.05, GOLD_DIM);
  }

  /* A door: recessed frame, gold trim, teal panel with its own seam. */
  function buildDoor(door) {
    const [cx, , cz] = door.center;
    const alongX = door.normal[2] !== 0; // door on north wall faces +z; side doors face inward on x
    const place = (dx, dy, dz, sx, sy, sz, color) => {
      if (alongX) box(cx + dx, dy, cz + dz, sx, sy, sz, color);
      else box(cx + dz, dy, cz + dx, sz, sy, sx, color); // rotate frame onto the side wall
    };
    /* side pillars + lintel */
    place(-0.98, 1.55, 0, 0.22, 3.1, 0.3, STONE_LIGHT);
    place(0.98, 1.55, 0, 0.22, 3.1, 0.3, STONE_LIGHT);
    place(0, 3.18, 0, 2.18, 0.24, 0.3, STONE_LIGHT);
    /* gold trim */
    place(-0.85, 1.5, 0.06, 0.05, 2.95, 0.06, GOLD_DIM);
    place(0.85, 1.5, 0.06, 0.05, 2.95, 0.06, GOLD_DIM);
    place(0, 3.02, 0.06, 1.75, 0.05, 0.06, GOLD_DIM);
    /* the door itself */
    place(0, 1.4, -0.04, 1.6, 2.8, 0.1, TEAL_DEEP);
    place(0, 1.4, 0.03, 1.3, 2.45, 0.05, TEAL);
    place(0, 1.4, 0.07, 0.045, 2.45, 0.03, GOLD);
    /* threshold */
    place(0, 0.03, 0.35, 1.9, 0.06, 0.7, STONE_LIGHT);
  }

  /* The turning stone: an octahedron, teal, with gold edges. */
  const stonePos = [], stoneCol = [], stoneIdx = [];
  const stoneLinePos = [], stoneLineNorm = [], stoneLineCol = [];
  function buildStone() {
    const T = [0, 0.62, 0], B = [0, -0.62, 0];
    const E = [[0.45, 0, 0], [0, 0, 0.45], [-0.45, 0, 0], [0, 0, -0.45]];
    let vi = 0;
    for (let i = 0; i < 4; i++) {
      const a = E[i], b = E[(i + 1) % 4];
      for (const [p, c] of [[T, TEAL], [a, TEAL_DEEP], [b, TEAL]]) { stonePos.push(p[0], p[1], p[2]); stoneCol.push(c[0], c[1], c[2]); }
      stoneIdx.push(vi, vi + 1, vi + 2); vi += 3;
      for (const [p, c] of [[B, TEAL_DEEP], [b, TEAL], [a, TEAL_DEEP]]) { stonePos.push(p[0], p[1], p[2]); stoneCol.push(c[0], c[1], c[2]); }
      stoneIdx.push(vi, vi + 1, vi + 2); vi += 3;
      for (const p of [T, a, T, b, B, a, B, b]) {
        stoneLinePos.push(p[0], p[1], p[2]);
        stoneLineNorm.push(0, 1, 0);
        stoneLineCol.push(GOLD[0], GOLD[1], GOLD[2]);
      }
    }
  }

  /* ---------------------------------------------------------- textures */
  function makeTexture(draw, w, h) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    return c;
  }
  function plaqueTexture(name) {
    return makeTexture((g, w, h) => {
      g.fillStyle = "#0b0f1a"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#f3c97a"; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = "#e8eef7"; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = "600 52px Georgia, 'Times New Roman', serif";
      g.fillText(name, w / 2, h / 2 + 2);
    }, 512, 128);
  }
  function glowTexture() {
    return makeTexture((g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, "rgba(122,243,255,0.55)");
      r.addColorStop(0.4, "rgba(122,243,255,0.16)");
      r.addColorStop(1, "rgba(122,243,255,0)");
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    }, 256, 256);
  }
  function starsTexture() {
    return makeTexture((g, w, h) => {
      g.fillStyle = "#04060c"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 220; i++) {
        const x = jitter(i * 3 + 1) * w, y = jitter(i * 7 + 2) * h;
        const b = 0.35 + jitter(i * 13 + 3) * 0.65;
        g.fillStyle = `rgba(232,238,247,${b.toFixed(2)})`;
        const r = jitter(i * 17 + 4) > 0.92 ? 2.2 : 1.2;
        g.fillRect(x, y, r, r);
      }
      g.strokeStyle = "#3a4358"; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    }, 512, 384);
  }

  /* ---------------------------------------------------------- GL setup */
  let gl = null;
  try {
    gl = canvas.getContext("webgl", { antialias: true, alpha: false, powerPreference: "low-power" })
      || canvas.getContext("experimental-webgl");
  } catch (e) { gl = null; }
  if (!gl) {
    stage.classList.add("ww-no-gl");
    const note = document.getElementById("ww-fallback-note");
    if (note) note.hidden = false;
    return;
  }

  function shader(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(sh)); return null; }
    return sh;
  }
  function program(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    return p;
  }

  const solidProg = program(`
    attribute vec3 aPos; attribute vec3 aNorm; attribute vec3 aCol;
    uniform mat4 uMVP; uniform mat4 uModel; uniform vec3 uCam;
    varying vec3 vCol; varying float vFog;
    void main() {
      vec4 world = uModel * vec4(aPos, 1.0);
      vec3 n = normalize(mat3(uModel) * aNorm);
      float diff = max(dot(n, normalize(vec3(0.35, 0.85, 0.4))), 0.0);
      float fill = max(dot(n, normalize(vec3(-0.5, 0.3, -0.6))), 0.0);
      float amb = 0.58;
      vCol = aCol * (amb + 0.72 * diff + 0.22 * fill);
      float d = distance(world.xyz, uCam);
      vFog = smoothstep(11.0, 24.0, d);
      gl_Position = uMVP * vec4(aPos, 1.0);
    }`, `
    precision mediump float;
    varying vec3 vCol; varying float vFog;
    void main() {
      vec3 fog = vec3(0.02, 0.027, 0.051);
      gl_FragColor = vec4(mix(vCol, fog, vFog), 1.0);
    }`);
  const texProg = program(`
    attribute vec3 aPos; attribute vec2 aUV;
    uniform mat4 uMVP;
    varying vec2 vUV;
    void main() { vUV = aUV; gl_Position = uMVP * vec4(aPos, 1.0); }`, `
    precision mediump float;
    uniform sampler2D uTex; uniform float uAlpha;
    varying vec2 vUV;
    void main() { vec4 t = texture2D(uTex, vUV); gl_FragColor = vec4(t.rgb, t.a * uAlpha); }`);

  function buffer(data, itemSize, attrib, prog, name) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, itemSize, gl.FLOAT, false, 0, 0);
    return b;
  }
  function indexBuffer(data) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data), gl.STATIC_DRAW);
    return b;
  }
  function uploadTexture(canvasEl) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasEl);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  buildHall();
  for (const d of DOORS) buildDoor(d);
  buildStone();

  /* Static scene buffers (solid program). */
  gl.useProgram(solidProg);
  const sPos = buffer(pos, 3, null, solidProg, "aPos");
  const sNorm = buffer(norm, 3, null, solidProg, "aNorm");
  const sCol = buffer(col, 3, null, solidProg, "aCol");
  const sIdx = indexBuffer(idx);
  const solidCount = idx.length;
  const uMVP = gl.getUniformLocation(solidProg, "uMVP");
  const uModel = gl.getUniformLocation(solidProg, "uModel");
  const uCam = gl.getUniformLocation(solidProg, "uCam");

  /* Stone buffers. */
  const stPos = buffer(stonePos, 3, null, solidProg, "aPos");
  const stNormData = [];
  { // flat normals for the stone, computed from its triangles
    for (let i = 0; i < stoneIdx.length; i += 3) {
      const a = stonePos.slice(stoneIdx[i] * 3, stoneIdx[i] * 3 + 3);
      const b = stonePos.slice(stoneIdx[i + 1] * 3, stoneIdx[i + 1] * 3 + 3);
      const c = stonePos.slice(stoneIdx[i + 2] * 3, stoneIdx[i + 2] * 3 + 3);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      for (let k = 0; k < 3; k++) stNormData.push(n[0] / l, n[1] / l, n[2] / l);
    }
  }
  const stNorm = buffer(stNormData, 3, null, solidProg, "aNorm");
  const stCol = buffer(stoneCol, 3, null, solidProg, "aCol");
  const stIdx = indexBuffer(stoneIdx);
  const stLinePos = buffer(stoneLinePos, 3, null, solidProg, "aPos");
  const stLineNorm = buffer(stoneLineNorm, 3, null, solidProg, "aNorm");
  const stLineCol = buffer(stoneLineCol, 3, null, solidProg, "aCol");
  const stoneLineCount = stoneLinePos.length / 3;

  /* Textured quads: plaques, glows, the star window. */
  const texQuads = [];
  function texQuad(cx, cy, cz, w, h, facing, texCanvas, alpha, additive) {
    // facing: "n" = on north wall facing +z; "w" = on west wall facing +x; "e" = on east wall facing -x
    let corners;
    if (facing === "n") corners = [[cx - w / 2, cy - h / 2, cz], [cx + w / 2, cy - h / 2, cz], [cx + w / 2, cy + h / 2, cz], [cx - w / 2, cy + h / 2, cz]];
    else if (facing === "w") corners = [[cx, cy - h / 2, cz + w / 2], [cx, cy - h / 2, cz - w / 2], [cx, cy + h / 2, cz - w / 2], [cx, cy + h / 2, cz + w / 2]];
    else corners = [[cx, cy - h / 2, cz - w / 2], [cx, cy - h / 2, cz + w / 2], [cx, cy + h / 2, cz + w / 2], [cx, cy + h / 2, cz - w / 2]];
    const data = [];
    const uvs = [[0, 1], [1, 1], [1, 0], [0, 0]];
    corners.forEach((p, i) => data.push(p[0], p[1], p[2], uvs[i][0], uvs[i][1]));
    texQuads.push({ data, tex: uploadTexture(texCanvas), alpha, additive: !!additive });
  }
  const glowC = glowTexture();
  for (const d of DOORS) {
    const room = ROOMS[d.id];
    const [cx, , cz] = d.center;
    const facing = d.normal[2] === 1 ? "n" : (d.normal[0] === 1 ? "w" : "e");
    const px = cx + d.normal[0] * 0.22, pz = cz + d.normal[2] * 0.22;
    const gx = cx + d.normal[0] * 0.38, gz = cz + d.normal[2] * 0.38;
    texQuad(px, 3.62, pz, 2.3, 0.58, facing, plaqueTexture(room.name), 1, false);
    texQuad(gx, 2.1, gz, 3.4, 3.4, facing, glowC, 0.5, true);
  }
  /* The Sky Room's window: a field of stars on the west wall. */
  texQuad(-5.97, 2.5, -6.8, 2.6, 1.95, "w", starsTexture(), 1, false);

  gl.useProgram(texProg);
  const tPosLoc = gl.getAttribLocation(texProg, "aPos");
  const tUVLoc = gl.getAttribLocation(texProg, "aUV");
  const tMVP = gl.getUniformLocation(texProg, "uMVP");
  const tAlpha = gl.getUniformLocation(texProg, "uAlpha");
  for (const q of texQuads) {
    q.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, q.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(q.data), gl.STATIC_DRAW);
  }

  /* ---------------------------------------------------------- matrices */
  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }
  function viewMatrix(cam) {
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const fwd = [-sy * cp, sp, -cy * cp];
    const right = [cy, 0, -sy];
    const up = [
      right[1] * fwd[2] - right[2] * fwd[1],
      right[2] * fwd[0] - right[0] * fwd[2],
      right[0] * fwd[1] - right[1] * fwd[0]
    ];
    const p = cam.pos;
    return [
      right[0], up[0], -fwd[0], 0,
      right[1], up[1], -fwd[1], 0,
      right[2], up[2], -fwd[2], 0,
      -(right[0] * p[0] + right[1] * p[1] + right[2] * p[2]),
      -(up[0] * p[0] + up[1] * p[1] + up[2] * p[2]),
      fwd[0] * p[0] + fwd[1] * p[1] + fwd[2] * p[2], 1
    ];
  }
  function multiply(a, b) {
    const out = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
    return out;
  }
  function rotY(t) { const c = Math.cos(t), s = Math.sin(t); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
  function translate(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; }
  const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  /* ---------------------------------------------------------- camera & motion */
  const cam = { pos: [...ROOMS.home.view.pos], yaw: ROOMS.home.view.yaw, pitch: ROOMS.home.view.pitch };
  let baseYaw = cam.yaw, basePitch = cam.pitch, lookYaw = 0, lookPitch = 0;
  let tween = null;
  let currentRoom = "home";
  let stoneAngle = 0;
  let stoneSpin = !reducedMotion;

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function goTo(id, announce) {
    const target = ROOMS[id]; if (!target) return;
    currentRoom = id;
    lookYaw = 0; lookPitch = 0;
    const from = { pos: [...cam.pos], yaw: cam.yaw, pitch: cam.pitch };
    const to = { pos: [...target.view.pos], yaw: target.view.yaw, pitch: target.view.pitch };
    // shortest yaw path
    while (to.yaw - from.yaw > Math.PI) to.yaw -= Math.PI * 2;
    while (to.yaw - from.yaw < -Math.PI) to.yaw += Math.PI * 2;
    baseYaw = target.view.yaw; basePitch = target.view.pitch;
    if (reducedMotion) {
      cam.pos = to.pos; cam.yaw = to.yaw; cam.pitch = to.pitch; tween = null;
      requestRender();
    } else {
      tween = { from, to, start: performance.now(), dur: 950 };
      startLoop();
    }
    document.querySelectorAll("[data-ww-room]").forEach((el) => {
      const on = el.getAttribute("data-ww-room") === id;
      el.classList.toggle("is-current", on);
      if (el.tagName === "BUTTON") el.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (caption) {
      caption.textContent = id === "home"
        ? "You are in the hall. Four doors: the Shelf, the Study, the Sky Room, the Long Line."
        : `You are at ${target.name}. What it holds is written below.`;
    }
    if (announce) {
      const section = document.getElementById("room-" + id);
      if (section) section.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    }
  }

  /* Drag to look; a tap (small, quick) picks a door. */
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, yaw: lookYaw, pitch: lookPitch };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety, not a requirement */ }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    lookYaw = clamp(drag.yaw + dx * 0.004, -1.25, 1.25);
    lookPitch = clamp(drag.pitch - dy * 0.003, -0.55, 0.55);
    cam.yaw = baseYaw + lookYaw; cam.pitch = basePitch + lookPitch;
    requestRender();
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const wasTap = drag.moved < 7 && performance.now() - drag.t < 400;
    drag = null;
    if (wasTap) pickDoor(e);
  });
  canvas.addEventListener("pointercancel", () => { drag = null; });
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function pickDoor(e) {
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = 1 - ((e.clientY - rect.top) / rect.height) * 2;
    const aspect = rect.width / rect.height;
    const f = 1 / Math.tan((Math.PI / 3.2) / 2);
    // ray in view space, then to world using the camera basis
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const fwd = [-sy * cp, sp, -cy * cp];
    const right = [cy, 0, -sy];
    const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
    let ray = [
      fwd[0] * f + right[0] * (nx * aspect) + up[0] * ny,
      fwd[1] * f + right[1] * (nx * aspect) + up[1] * ny,
      fwd[2] * f + right[2] * (nx * aspect) + up[2] * ny
    ];
    const rl = Math.hypot(ray[0], ray[1], ray[2]); ray = ray.map((v) => v / rl);
    let best = null, bestT = Infinity;
    for (const d of DOORS) {
      const n = d.normal;
      const denom = ray[0] * n[0] + ray[1] * n[1] + ray[2] * n[2];
      if (Math.abs(denom) < 1e-6) continue;
      const oc = [d.center[0] - cam.pos[0], d.center[1] - cam.pos[1], d.center[2] - cam.pos[2]];
      const t = (oc[0] * n[0] + oc[1] * n[1] + oc[2] * n[2]) / denom;
      if (t <= 0 || t >= bestT) continue;
      const hit = [cam.pos[0] + ray[0] * t, cam.pos[1] + ray[1] * t, cam.pos[2] + ray[2] * t];
      const rel = [hit[0] - d.center[0], hit[1] - d.center[1], hit[2] - d.center[2]];
      const across = n[2] !== 0 ? rel[0] : rel[2];
      if (Math.abs(across) <= d.w / 2 && Math.abs(rel[1]) <= d.h / 2) { best = d; bestT = t; }
    }
    if (best) goTo(best.id, false);
  }

  /* Door chips + keyboard. */
  document.querySelectorAll("[data-ww-room]").forEach((el) => {
    if (el.tagName !== "BUTTON") return;
    el.addEventListener("click", () => goTo(el.getAttribute("data-ww-room"), true));
  });
  document.addEventListener("keydown", (e) => {
    if (!stage.contains(document.activeElement) && document.activeElement !== canvas && !canvas.contains(document.activeElement)) {
      // only steer the world when the visitor is engaged with the stage
      if (!["1", "2", "3", "4", "0"].includes(e.key)) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    }
    const ids = ["shelf", "study", "sky", "longline"];
    if (e.key >= "1" && e.key <= "4") goTo(ids[Number(e.key) - 1], false);
    else if (e.key === "0" || e.key === "Escape") goTo("home", false);
    else if (e.key === "ArrowLeft") { lookYaw = clamp(lookYaw + 0.18, -1.25, 1.25); cam.yaw = baseYaw + lookYaw; requestRender(); }
    else if (e.key === "ArrowRight") { lookYaw = clamp(lookYaw - 0.18, -1.25, 1.25); cam.yaw = baseYaw + lookYaw; requestRender(); }
    else if (e.key === "ArrowUp") { lookPitch = clamp(lookPitch + 0.12, -0.55, 0.55); cam.pitch = basePitch + lookPitch; requestRender(); }
    else if (e.key === "ArrowDown") { lookPitch = clamp(lookPitch - 0.12, -0.55, 0.55); cam.pitch = basePitch + lookPitch; requestRender(); }
  });

  /* ---------------------------------------------------------- render loop */
  let raf = 0, running = false, dprCap = Math.min(window.devicePixelRatio || 1, 2);
  if ((navigator.hardwareConcurrency || 8) <= 4) dprCap = Math.min(dprCap, 1.5);
  let qualityTier = 0; // 0 full, 1 lower dpr, 2 no spin + on-demand
  let slowFrames = 0, lastT = 0;

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = qualityTier >= 1 ? 1 : dprCap;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener("resize", () => { resize(); requestRender(); });

  function bindSolid(which) {
    gl.bindBuffer(gl.ARRAY_BUFFER, which.pos);
    gl.vertexAttribPointer(gl.getAttribLocation(solidProg, "aPos"), 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, which.norm);
    gl.vertexAttribPointer(gl.getAttribLocation(solidProg, "aNorm"), 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, which.col);
    gl.vertexAttribPointer(gl.getAttribLocation(solidProg, "aCol"), 3, gl.FLOAT, false, 0, 0);
  }

  function render(now) {
    const aspect = canvas.width / canvas.height;
    const proj = perspective(Math.PI / 3.2, aspect, 0.1, 60);
    const view = viewMatrix(cam);
    const vp = multiply(proj, view);

    gl.clearColor(0.02, 0.027, 0.051, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(solidProg);
    gl.enableVertexAttribArray(gl.getAttribLocation(solidProg, "aPos"));
    gl.enableVertexAttribArray(gl.getAttribLocation(solidProg, "aNorm"));
    gl.enableVertexAttribArray(gl.getAttribLocation(solidProg, "aCol"));
    gl.uniformMatrix4fv(uMVP, false, vp);
    gl.uniformMatrix4fv(uModel, false, IDENTITY);
    gl.uniform3f(uCam, cam.pos[0], cam.pos[1], cam.pos[2]);
    bindSolid({ pos: sPos, norm: sNorm, col: sCol });
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sIdx);
    gl.drawElements(gl.TRIANGLES, solidCount, gl.UNSIGNED_SHORT, 0);

    /* The turning stone above its plinth. */
    const model = multiply(translate(0, 2.15, -3), rotY(stoneAngle));
    gl.uniformMatrix4fv(uMVP, false, multiply(vp, model));
    gl.uniformMatrix4fv(uModel, false, model);
    bindSolid({ pos: stPos, norm: stNorm, col: stCol });
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, stIdx);
    gl.drawElements(gl.TRIANGLES, stoneIdx.length, gl.UNSIGNED_SHORT, 0);
    /* its gold edges */
    bindSolid({ pos: stLinePos, norm: stLineNorm, col: stLineCol });
    gl.drawArrays(gl.LINES, 0, stoneLineCount);

    /* Textured plaques, window, glows. */
    gl.useProgram(texProg);
    gl.enableVertexAttribArray(tPosLoc);
    gl.enableVertexAttribArray(tUVLoc);
    gl.uniformMatrix4fv(tMVP, false, vp);
    gl.enable(gl.BLEND);
    for (const q of texQuads) {
      gl.bindBuffer(gl.ARRAY_BUFFER, q.buf);
      gl.vertexAttribPointer(tPosLoc, 3, gl.FLOAT, false, 20, 0);
      gl.vertexAttribPointer(tUVLoc, 2, gl.FLOAT, false, 20, 12);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, q.tex);
      gl.uniform1i(gl.getUniformLocation(texProg, "uTex"), 0);
      gl.uniform1f(tAlpha, q.alpha);
      gl.blendFunc(gl.SRC_ALPHA, q.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(!q.additive);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  function frame(now) {
    raf = 0;
    if (tween) {
      const t = clamp((now - tween.start) / tween.dur, 0, 1);
      const e = ease(t);
      cam.pos = tween.from.pos.map((v, i) => v + (tween.to.pos[i] - v) * e);
      cam.yaw = tween.from.yaw + (tween.to.yaw - tween.from.yaw) * e;
      cam.pitch = tween.from.pitch + (tween.to.pitch - tween.from.pitch) * e;
      if (t >= 1) { tween = null; baseYaw = cam.yaw; basePitch = cam.pitch; }
    }
    if (stoneSpin && qualityTier < 2) stoneAngle += 0.0035;
    render(now);
    /* Adaptive quality: if frames run slow, step down instead of stuttering. */
    if (lastT) {
      const dt = now - lastT;
      if (dt > 26 && qualityTier < 2) { if (++slowFrames > 45) { qualityTier++; slowFrames = 0; resize(); if (qualityTier >= 2) stoneSpin = false; } }
      else if (slowFrames > 0) slowFrames--;
    }
    lastT = now;
    if (tween || (stoneSpin && qualityTier < 2 && !document.hidden)) {
      raf = requestAnimationFrame(frame);
    } else {
      running = false;
    }
  }
  function startLoop() {
    if (!running) { running = true; lastT = 0; raf = requestAnimationFrame(frame); }
  }
  function requestRender() {
    if (qualityTier >= 2 || !stoneSpin || reducedMotion) {
      if (!raf) raf = requestAnimationFrame((t) => { raf = 0; render(t); });
    } else startLoop();
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) requestRender(); });

  resize();
  goTo("home", false);
  if (reducedMotion) requestRender(); else startLoop();
})();
