"use strict";

/*
 * Spark companion — the 3D body.
 *
 * The same seed that draws the flat Spark also grows this one: a
 * small low-poly creature built in code from its kind's form,
 * its palette, its markings, its crest and eye, and its stage —
 * Ember small and simple, Flame developed, Radiant full and
 * crowned, their spark motes gathering around them as they grow.
 * Since v9 it also wears their finer grain: the
 * detail their seed drew (companion.details) — ears, a trail,
 * cheeks, a styled crest, a second pattern painted onto the
 * body's own faces — standing only where their reveal schedule
 * has brought it, exactly as the flat drawing wears it.
 * Hand-rolled WebGL1, no libraries, nothing fetched:
 * the site stays static and offline, and the whole creature is a
 * few hundred triangles in two small meshes (body and eye) plus
 * two quads (its glow, and a fake soft shadow that grounds it) —
 * in a small canvas that follows it, never a full-viewport one.
 * The 3D look is arithmetic, not machinery: a wrap diffuse and a
 * rim term in its glow colour; no real lights, no shadow maps.
 *
 * Movements are the ones its life already has: it turns gently
 * and bobs at idle, faces its direction of travel, looks toward
 * a near pointer — the eye jumps there first, in saccades, and
 * the head follows; now and then it blinks — darts and spins
 * when it dodges, bounces and spins when tapped, and flourishes
 * when it evolves. Its bounce is a spring stepped at a fixed
 * 240Hz, so it lands the same at any frame rate. The renderer
 * follows the Witness World's discipline: it pauses when the
 * tab hides, steps its own quality down on a slow device (pixel
 * ratio first, then frame rate), draws ever more rarely the
 * longer the Spark rests idle, renders one still frame for
 * reduced motion, and — where WebGL is not to be had — returns
 * null and leaves the flat figure standing, honestly, in its
 * place.
 */
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  /* ---- colour: the palette arrives as CSS hsl() strings ---- */

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    s /= 100;
    l /= 100;
    const k = (n) => (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)];
  }

  function parseColor(text, fallback) {
    const m = /hsl\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(String(text || ""));
    if (!m) return fallback;
    return hslToRgb(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  const INK = [0.043, 0.055, 0.094];
  const WHITE = [1, 1, 1];

  /* ---- seed streams, the core's own recipe ---- */

  function hashString(text) {
    let h = 0x811c9dc5;
    const s = String(text);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---- tiny mat4, column-major ---- */

  function mat4Perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }

  function mat4Multiply(a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
        out[c * 4 + r] = sum;
      }
    }
    return out;
  }

  function mat4Model(x, y, z, ry, rx, s, syScale) {
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const yy = syScale == null ? s : syScale;
    /* T * Ry * Rx * S, written out column-major; the y scale may
     * differ from x/z — that difference is the squash-and-stretch. */
    return new Float32Array([
      cy * s, 0, -sy * s, 0,
      sx * sy * yy, cx * yy, sx * cy * yy, 0,
      cx * sy * s, -sx * s, cx * cy * s, 0,
      x, y, z, 1
    ]);
  }

  function mat4Translate(x, y, z) {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  }

  function mat4RotY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
  }

  function mat4RotX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
  }

  function mat4Scale(x, y, z) {
    return new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
  }

  /* ---- geometry: non-indexed triangles, flat-shaded ---- */

  function Builder() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.bodyTris = []; /* indices into the triangle list, for speckle */
  }

  Builder.prototype.tri = function (a, b, c, color, isBody) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const index = this.pos.length / 3;
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.col.push(color[0], color[1], color[2]);
    }
    if (isBody) this.bodyTris.push(index);
    return index;
  };

  Builder.prototype.quad = function (a, b, c, d, color, isBody) {
    this.tri(a, b, c, color, isBody);
    this.tri(a, c, d, color, isBody);
  };

  /* A sphere of a given centre, radii, and temperament of grid. */
  Builder.prototype.ball = function (cx, cy, cz, rx, ry, rz, color, isBody) {
    const W = 10, H = 8;
    const point = (i, j) => {
      const th = (i / W) * Math.PI * 2;
      const ph = (j / H) * Math.PI;
      return [
        cx + rx * Math.sin(ph) * Math.cos(th),
        cy + ry * Math.cos(ph),
        cz + rz * Math.sin(ph) * Math.sin(th)
      ];
    };
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        this.quad(point(i, j), point(i + 1, j), point(i + 1, j + 1), point(i, j + 1), color, isBody);
      }
    }
  };

  Builder.prototype.octa = function (cx, cy, cz, rx, ry, rz, color, isBody) {
    const T = [cx, cy + ry, cz], B = [cx, cy - ry, cz];
    const E = [
      [cx + rx, cy, cz], [cx, cy, cz + rz], [cx - rx, cy, cz], [cx, cy, cz - rz]
    ];
    for (let i = 0; i < 4; i++) {
      const n = E[(i + 1) % 4];
      this.tri(T, E[i], n, color, isBody);
      this.tri(B, n, E[i], color, isBody);
    }
  };

  Builder.prototype.cone = function (cx, cy, cz, r, h, color, tiltZ, isBody) {
    const SEG = 7;
    const tip = [cx + Math.sin(tiltZ || 0) * h, cy + Math.cos(tiltZ || 0) * h, cz];
    for (let i = 0; i < SEG; i++) {
      const a0 = (i / SEG) * Math.PI * 2;
      const a1 = ((i + 1) / SEG) * Math.PI * 2;
      const p0 = [cx + r * Math.cos(a0), cy, cz + r * Math.sin(a0)];
      const p1 = [cx + r * Math.cos(a1), cy, cz + r * Math.sin(a1)];
      this.tri(p0, p1, tip, color, isBody);
      this.tri(p1, p0, [cx, cy, cz], color, isBody);
    }
  };

  Builder.prototype.ring = function (cx, cy, cz, rIn, rOut, color, tiltX) {
    const SEG = 16;
    const tilt = (p) => {
      const y = p[1] - cy, z = p[2] - cz;
      return [p[0], cy + y * Math.cos(tiltX) - z * Math.sin(tiltX), cz + y * Math.sin(tiltX) + z * Math.cos(tiltX)];
    };
    for (let i = 0; i < SEG; i++) {
      const a0 = (i / SEG) * Math.PI * 2;
      const a1 = ((i + 1) / SEG) * Math.PI * 2;
      const o0 = tilt([cx + rOut * Math.cos(a0), cy, cz + rOut * Math.sin(a0)]);
      const o1 = tilt([cx + rOut * Math.cos(a1), cy, cz + rOut * Math.sin(a1)]);
      const i0 = tilt([cx + rIn * Math.cos(a0), cy, cz + rIn * Math.sin(a0)]);
      const i1 = tilt([cx + rIn * Math.cos(a1), cy, cz + rIn * Math.sin(a1)]);
      this.quad(o0, o1, i1, i0, color, false);
      this.quad(i0, i1, o1, o0, color, false);
    }
  };

  /* Face painting by position, for the second pattern layer:
   * the centroid of one of the body's own triangles, and the
   * brush that recolours it. Bands paint by height; the belly
   * paints the front-and-low faces. No new geometry — the
   * pattern is the body's own faces, coloured. */
  Builder.prototype.centroid = function (v) {
    return [
      (this.pos[v * 3] + this.pos[(v + 1) * 3] + this.pos[(v + 2) * 3]) / 3,
      (this.pos[v * 3 + 1] + this.pos[(v + 1) * 3 + 1] + this.pos[(v + 2) * 3 + 1]) / 3,
      (this.pos[v * 3 + 2] + this.pos[(v + 1) * 3 + 2] + this.pos[(v + 2) * 3 + 2]) / 3
    ];
  };
  Builder.prototype.paint = function (v, color) {
    for (let k = 0; k < 3; k++) {
      this.col[(v + k) * 3] = color[0];
      this.col[(v + k) * 3 + 1] = color[1];
      this.col[(v + k) * 3 + 2] = color[2];
    }
  };
  Builder.prototype.bands = function (ys, half, color) {
    for (const v of this.bodyTris) {
      const c = this.centroid(v);
      if (ys.some((y) => Math.abs(c[1] - y) < half)) this.paint(v, color);
    }
  };
  Builder.prototype.belly = function (color) {
    for (const v of this.bodyTris) {
      const c = this.centroid(v);
      if (c[2] > 0.22 && c[1] < -0.08) this.paint(v, color);
    }
  };

  /* Markings, mapped onto the form: a seeded share of the body's
   * own faces take the glow and accent colours. How many is the
   * stage's development of the seed's marking count — the same
   * arithmetic the flat drawing uses. */
  Builder.prototype.speckle = function (rand, count, glow, accent) {
    const tris = this.bodyTris.slice();
    for (let i = tris.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [tris[i], tris[j]] = [tris[j], tris[i]];
    }
    const n = Math.min(tris.length, count * 6);
    for (let i = 0; i < n; i++) {
      const color = i % 3 === 2 ? accent : glow;
      const v = tris[i] * 3;
      for (let k = 0; k < 3; k++) {
        this.col[(v + k) * 3] = color[0];
        this.col[(v + k) * 3 + 1] = color[1];
        this.col[(v + k) * 3 + 2] = color[2];
      }
    }
  };

  /* ---- the creature itself, from its seed-record ---- */

  function buildGeometry(companion, stage, revealed, wrap) {
    const b = new Builder();
    const body = parseColor(companion.palette.body, [0.4, 0.7, 0.8]);
    const glow = parseColor(companion.palette.glow, [0.7, 0.9, 1]);
    const accent = parseColor(companion.palette.accent, [0.85, 0.64, 0.25]);
    const rand = mulberry32(hashString(companion.seed + ":marks3d"));
    /* Their finer grain (Core's companion.details): which pieces
     * stand here is the reveal state's word — `revealed` names
     * what their schedule has brought (the presence and the home
     * page pass it from their record). No list is their born look.
     * Their markings' density and their eye's variant are born
     * with them and always stand. The detail geometry is kept
     * cheap on purpose: cones and octahedra, a few dozen
     * triangles all told, no new draw calls — it rides in the
     * same two meshes as everything else. */
    const details = companion.details || null;
    const has = (id) => Array.isArray(revealed) && revealed.includes(id);
    const dScale = stage >= 2 ? 1.1 : stage === 1 ? 1 : 0.85;
    /* Its exact proportions are its seed's too: the same form
     * family, never the same dimensions twice. */
    const jr = mulberry32(hashString(companion.seed + ":shape"));
    const jx = 0.9 + jr() * 0.2;
    const jy = 0.9 + jr() * 0.2;
    const jz = 0.9 + jr() * 0.2;

    /* The body family is its form. */
    switch (companion.form) {
      case "shard":
        b.octa(0, 0, 0, 0.6 * jx, 0.98 * jy, 0.6 * jz, body, true);
        break;
      case "comet":
        b.ball(0.14, 0.02, 0, 0.68 * jx, 0.68 * jy, 0.68 * jz, body, true);
        b.cone(-0.5, 0.02, 0, 0.34, 0.72, accent, -Math.PI / 2, true);
        break;
      case "sprout":
        b.ball(0, -0.04, 0, 0.74 * jx, 0.8 * jy, 0.74 * jz, body, true);
        b.cone(-0.14, 0.62, 0, 0.13, 0.34, accent, -0.5, false);
        b.cone(0.14, 0.62, 0, 0.13, 0.34, accent, 0.5, false);
        break;
      case "wave":
        b.ball(0, -0.06, 0, 0.82 * jx, 0.62 * jy, 0.74 * jz, body, true);
        b.cone(0, 0.42, -0.18, 0.16, 0.4, accent, -0.4, false);
        break;
      case "moth":
        b.ball(0, 0, 0, 0.34 * jx, 0.56 * jy, 0.3 * jz, body, true);
        b.ball(-0.52, 0.1, -0.06, 0.5 * jx, 0.68 * jy, 0.13, body, true);
        b.ball(0.52, 0.1, -0.06, 0.5 * jx, 0.68 * jy, 0.13, body, true);
        break;
      case "orb":
      default:
        b.ball(0, 0, 0, 0.8 * jx, 0.8 * jy, 0.8 * jz, body, true);
        break;
    }

    /* Markings: half-grown for an Ember, full for a Flame, one
     * richer again for a Radiant — the flat drawing's own count,
     * deepened or thinned by their seed's marking density. */
    const density = details ? details.density : 1;
    const markCount = Math.max(
      1,
      Math.round(
        (stage >= 2
          ? companion.markings.count + 1
          : stage === 1
            ? companion.markings.count
            : Math.max(1, Math.ceil(companion.markings.count / 2))) * density
      )
    );
    b.speckle(rand, markCount, glow, accent);

    /* The second pattern layer, once it has arrived: a finer
     * speckle in their other colour, two bands around the body,
     * or a belly patch of lightened body colour — the body's
     * own faces, painted, never new geometry. */
    if (has("pattern") && details) {
      if (details.pattern === "speckles") {
        b.speckle(rand, 2, accent, glow);
      } else if (details.pattern === "bands") {
        b.bands([-0.2, 0.24], 0.1, glow);
      } else if (details.pattern === "belly") {
        b.belly(body.map((c, i) => c + (glow[i] - c) * 0.45));
      }
    }

    /* The crest, developed by stage: small and low for an Ember,
     * near full for a Flame, full for a Radiant. */
    const crestScale = stage >= 2 ? 1.02 : stage === 1 ? 0.88 : 0.65;
    const crestY = 0.78;
    const crest = (fn) => fn(crestScale);
    switch (companion.crest) {
      case "flame":
        crest((s) => b.cone(0, crestY, 0, 0.17 * s, 0.46 * s, accent, 0, false));
        break;
      case "leaf":
        crest((s) => b.cone(0.05, crestY, 0, 0.2 * s, 0.4 * s, accent, 0.55, false));
        break;
      case "halo":
        crest((s) => b.ring(0, crestY + 0.18 * s, 0, 0.2 * s, 0.3 * s, glow, 0.35));
        break;
      case "curl":
        crest((s) => {
          b.ball(0, crestY + 0.05, 0, 0.11 * s, 0.11 * s, 0.11 * s, accent, false);
          b.ball(0.1 * s, crestY + 0.14 * s, 0, 0.085 * s, 0.085 * s, 0.085 * s, accent, false);
          b.ball(0.17 * s, crestY + 0.2 * s, 0, 0.06 * s, 0.06 * s, 0.06 * s, accent, false);
        });
        break;
      default:
        break;
    }

    /* The styled crest, once it has arrived — grown at the
     * crest's own stage scale, so a stage never swaps their
     * identity, it only grows what is theirs: a tuft of three
     * small cones, two horns, a swept fin, a second halo, or
     * a leaf leaning off the crest's shoulder. */
    if (has("crest") && details) {
      const cs = crestScale;
      if (details.crestStyle === "tuft") {
        b.cone(-0.07, crestY + 0.02, 0, 0.05 * cs, 0.2 * cs, accent, -0.3, false);
        b.cone(0, crestY + 0.04, 0, 0.05 * cs, 0.24 * cs, accent, 0, false);
        b.cone(0.07, crestY + 0.02, 0, 0.05 * cs, 0.2 * cs, accent, 0.3, false);
      } else if (details.crestStyle === "horns") {
        b.cone(-0.3, crestY - 0.12, 0, 0.09 * cs, 0.3 * cs, accent, -0.5, false);
        b.cone(0.3, crestY - 0.12, 0, 0.09 * cs, 0.3 * cs, accent, 0.5, false);
      } else if (details.crestStyle === "fin") {
        b.octa(0, crestY + 0.12, -0.06, 0.07 * cs, 0.26 * cs, 0.16 * cs, accent, false);
      } else if (details.crestStyle === "halo") {
        b.ring(0, crestY + 0.34 * cs, 0, 0.13 * cs, 0.19 * cs, glow, 0.35);
      } else if (details.crestStyle === "leaf") {
        b.cone(0.14, crestY, 0, 0.11 * cs, 0.26 * cs, accent, 0.7, false);
      }
    }

    /* Their ears, once they have arrived: fins swept from their
     * sides, a spray of small tufts, or two points in their own
     * body colour — silhouette first, so they read at roaming
     * size, where they are a few dozen pixels tall. */
    if (has("ears") && details) {
      if (details.ears === "fins") {
        b.cone(-0.78, 0.02, 0, 0.16 * dScale, 0.34 * dScale, accent, -1.15, false);
        b.cone(0.78, 0.02, 0, 0.16 * dScale, 0.34 * dScale, accent, 1.15, false);
      } else if (details.ears === "tufts") {
        for (const sx of [-1, 1]) {
          for (const dx of [-0.06, 0, 0.06]) {
            b.cone(sx * 0.55 + dx, 0.55, 0, 0.045, 0.2 * dScale, accent, sx * 0.5, false);
          }
        }
      } else if (details.ears === "points") {
        b.cone(-0.45, 0.55, 0, 0.13 * dScale, 0.34 * dScale, body, -0.35, false);
        b.cone(0.45, 0.55, 0, 0.13 * dScale, 0.34 * dScale, body, 0.35, false);
      }
    }

    /* The trail that follows them, once it has arrived: a wisp
     * or two ribbons streaming behind, or three small sparks
     * hanging in their wake. Behind them, always — the comet's
     * own tail simply gains company. */
    if (has("trail") && details) {
      if (details.trail === "wisp") {
        b.cone(-0.72, -0.18, -0.08, 0.13 * dScale, 0.5 * dScale, accent, -1.35, false);
      } else if (details.trail === "ribbon") {
        b.cone(-0.7, -0.05, 0.1, 0.07, 0.44 * dScale, accent, -1.3, false);
        b.cone(-0.7, -0.28, -0.12, 0.07, 0.4 * dScale, glow, -1.45, false);
      } else if (details.trail === "sparkles") {
        b.octa(-0.88, -0.15, 0, 0.055, 0.055, 0.055, glow, false);
        b.octa(-1.02, -0.3, 0.08, 0.04, 0.04, 0.04, accent, false);
        b.octa(-0.8, -0.38, -0.1, 0.032, 0.032, 0.032, glow, false);
      }
    }

    /* Their cheeks, once they have arrived: two flattened gems
     * of glow or accent on their face's front, or a spray of
     * freckle-points. Their depth is set by their form, so they
     * sit on the surface the form actually has. */
    if (has("cheeks") && details) {
      const cheekZ = companion.form === "moth" ? 0.3 : companion.form === "shard" ? 0.5 : 0.62;
      const cheekX = companion.form === "moth" ? 0.16 : 0.3;
      if (details.cheeks === "freckles") {
        for (const sx of [-1, 1]) {
          for (const [ox, oy] of [[0.22, -0.1], [0.31, -0.16], [0.25, -0.22]]) {
            b.octa(sx * ox * (cheekX / 0.3), oy, cheekZ - 0.02, 0.028, 0.028, 0.02, accent, false);
          }
        }
      } else {
        const cheekCol = details.cheeks === "glow" ? glow : accent;
        b.octa(-cheekX, -0.14, cheekZ, 0.1 * dScale, 0.07 * dScale, 0.04, cheekCol, false);
        b.octa(cheekX, -0.14, cheekZ, 0.1 * dScale, 0.07 * dScale, 0.04, cheekCol, false);
      }
    }

    /* The eye is its own small mesh, built around its own
     * centre: it has a life the body doesn't — it jumps in
     * saccades, it leads the head when the Spark looks, and
     * now and then it blinks. */
    const eye = new Builder();
    const eyeR = companion.eye === "bright" ? 0.17 : 0.145;
    const eyeSquash = companion.eye === "half" ? 0.45 : 1;
    eye.ball(0, 0, 0, eyeR, eyeR * eyeSquash, 0.07, INK, false);
    eye.ball(0.05, 0.05, 0.06, 0.05, 0.05, 0.03, WHITE, false);
    /* Their eye's variant — born with them, not revealed: a
     * second, lower shine; a ring of their glow around the eye;
     * or one small lash at its outer corner. */
    const eyeVariant = details ? details.eyeVariant : "plain";
    if (eyeVariant === "sparkle") {
      eye.octa(-0.055, -0.045, 0.055, 0.028, 0.028, 0.02, WHITE, false);
    } else if (eyeVariant === "ring") {
      eye.ring(0, 0, 0.05, eyeR + 0.025, eyeR + 0.05, glow, Math.PI / 2);
    } else if (eyeVariant === "lash") {
      eye.cone(eyeR * 0.85, eyeR * 0.6, 0.03, 0.02, 0.09, INK, 0.8, false);
    }
    const eyeCenter = [0, 0.08, 0.72];

    /* Their spark motes, in the body: small octahedra of their
     * glow and accent scattered around them — the same light
     * the flat drawing carries (the core's mote stream, read
     * the same way), never a ring or a bubble around their
     * (Aaron's word, Nov 19, 2026: the circle goes; they
     * light up like a spark instead). More of them as they
     * grow; a Radiant also wears a crown of three small
     * flames above the crest. */
    {
      const moteRand = mulberry32(hashString(companion.seed + ":motes"));
      moteRand(); /* the flat drawing's shape draw — the same stream, the same place in it */
      const moteCount = 3 + stage * 2 + Math.floor(moteRand() * 2);
      for (let i = 0; i < moteCount; i++) {
        const a = moteRand() * Math.PI * 2;
        const rr = 0.58 + moteRand() * 0.22;
        const mx = Math.cos(a) * rr;
        const mz = Math.sin(a) * rr * 0.7;
        const my = -0.25 + moteRand() * 0.85;
        const ms = 0.02 + moteRand() * 0.022;
        b.octa(mx, my, mz, ms, ms, ms, i % 3 === 2 ? accent : glow, false);
      }
    }
    if (stage >= 2) {
      for (const dx of [-0.24, 0, 0.24]) {
        b.cone(dx, 1.06, 0, 0.08, 0.24, accent, dx * 0.8, false);
      }
    }

    /* Their flame wrap (wrap: 1) — the same outer layer the flat
     * drawing wears, read off the same stream the same way (the
     * core's flameWrapFor recipe: the `:flamewrap` stream, the
     * same draws in the same order), so the flame is one flame
     * in both bodies: a ring of elongated petals standing behind
     * the body, in its own glow and accent, taller at the crown.
     * It is presentation only — it derives nothing about who the
     * Spark is — and where a keeper has lifted the wrap off
     * (wrap === false), not one vertex of it is built: the body
     * stands exactly as it stood before the wrap existed. */
    if (wrap !== false) {
      const BENDS = {
        fire: { height: 1.25, width: 1.0, radius: 1.0 },
        water: { height: 0.8, width: 1.15, radius: 0.98 },
        shadow: { height: 0.55, width: 1.1, radius: 0.88 },
        air: { height: 0.95, width: 0.7, radius: 1.02 },
        earth: { height: 0.65, width: 1.35, radius: 0.95 },
        light: { height: 1.15, width: 0.62, radius: 1.03 }
      };
      const bend = BENDS[companion.kind] || BENDS.fire;
      const frand = mulberry32(hashString(companion.seed + ":flamewrap"));
      const base = [6, 9, 12][stage] || 9;
      const count = base + Math.floor(frand() * 3);
      const ringR = 0.86 * bend.radius;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (frand() - 0.5) * 0.14;
        const topness = (Math.cos(angle) + 1) / 2;
        const heightJitter = 0.8 + frand() * 0.45;
        frand(); /* the flat drawing's width draw — the same stream, the same place in it */
        frand(); /* its curl draw, likewise */
        const col = frand() < 0.62 ? glow : accent;
        frand(); /* its delay draw, likewise */
        const h =
          (8.5 + 7 * topness) * bend.height * heightJitter * (0.8 + stage * 0.12) * 0.02;
        b.octa(
          Math.sin(angle) * ringR,
          Math.cos(angle) * ringR,
          -0.16,
          0.055 * bend.width,
          h / 2,
          0.05,
          col,
          false
        );
      }
    }

    return { main: b, eye, eyeCenter };
  }

  /* ---- shaders ---- */

  /* The 3D look without lights, shadow maps, or bloom: a wrap
   * diffuse (light that bends a little way around the form, so
   * nothing falls to flat black) and a rim term in its own glow
   * colour (the edge catches light the way a living edge does).
   * Both are arithmetic, not machinery. */
  const VERT = `
    attribute vec3 aPos;
    attribute vec3 aNor;
    attribute vec3 aCol;
    uniform mat4 uProj;
    uniform mat4 uView;
    uniform mat4 uModel;
    varying vec3 vCol;
    varying vec3 vNv;
    varying vec3 vVp;
    void main() {
      vec4 vp = uView * uModel * vec4(aPos, 1.0);
      vNv = normalize(mat3(uView) * mat3(uModel) * aNor);
      vVp = vp.xyz;
      vCol = aCol;
      gl_Position = uProj * vp;
    }`;

  const FRAG = `
    precision mediump float;
    uniform vec3 uRim;
    varying vec3 vCol;
    varying vec3 vNv;
    varying vec3 vVp;
    void main() {
      vec3 n = normalize(vNv);
      vec3 v = normalize(-vVp);
      vec3 l = normalize(vec3(0.35, 0.75, 0.55));
      float wrap = pow(clamp((dot(n, l) + 0.65) / 1.65, 0.0, 1.0), 1.5);
      float rim = pow(1.0 - abs(dot(n, v)), 2.4);
      vec3 col = vCol * (0.34 + 0.8 * wrap) + uRim * rim * 0.45;
      gl_FragColor = vec4(col, 1.0);
    }`;

  /* A fake soft shadow: one dark gradient quad on its floor.
   * It grounds the creature when it bobs and leaps — no shadow
   * map, just a blob that breathes with it. */
  const SHADOW_VERT = `
    attribute vec3 aPos;
    attribute vec2 aUv;
    uniform mat4 uMVP;
    varying vec2 vUv;
    void main() {
      vUv = aUv;
      gl_Position = uMVP * vec4(aPos, 1.0);
    }`;

  const SHADOW_FRAG = `
    precision mediump float;
    uniform sampler2D uTex;
    uniform float uAlpha;
    varying vec2 vUv;
    void main() {
      vec4 t = texture2D(uTex, vUv);
      gl_FragColor = vec4(0.0, 0.0, 0.0, t.a * uAlpha);
    }`;

  const HALO_VERT = `
    attribute vec2 aPos;
    uniform mat4 uMVP;
    varying vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = uMVP * vec4(aPos * 1.55, -0.35, 1.0);
    }`;

  const HALO_FRAG = `
    precision mediump float;
    uniform sampler2D uTex;
    uniform float uAlpha;
    varying vec2 vUv;
    void main() {
      vec4 t = texture2D(uTex, vUv);
      gl_FragColor = vec4(t.rgb, t.a * uAlpha);
    }`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function program(gl, vs, fs) {
    const v = compile(gl, gl.VERTEX_SHADER, vs);
    const f = compile(gl, gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    const p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    return p;
  }

  function glowTexture(gl, rgb) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    const [r, g, bl] = rgb.map((v) => Math.round(v * 255));
    grad.addColorStop(0, `rgba(${r},${g},${bl},0.85)`);
    grad.addColorStop(0.45, `rgba(${r},${g},${bl},0.28)`);
    grad.addColorStop(1, `rgba(${r},${g},${bl},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  /* ---- the mount: one creature, one small canvas, one loop ---- */

  const REDUCED = () =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function mount(container, companion, opts) {
    const options = opts || {};
    const stage = options.stage || 0;
    let gl = null;
    let canvas = null;
    try {
      canvas = document.createElement("canvas");
      gl =
        canvas.getContext("webgl", { alpha: true, antialias: true, depth: true }) ||
        canvas.getContext("experimental-webgl", { alpha: true, antialias: true });
    } catch {
      return null;
    }
    if (!gl || !canvas) return null;

    const px = Math.max(30, Math.round(options.px || 48));
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${px}px`;
    canvas.style.height = `${px}px`;
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.renderer = "spark-3d";

    const prog = program(gl, VERT, FRAG);
    const haloProg = program(gl, HALO_VERT, HALO_FRAG);
    const shadowProg = program(gl, SHADOW_VERT, SHADOW_FRAG);
    if (!prog || !haloProg || !shadowProg) return null;

    const geo = buildGeometry(companion, stage, options.revealed || null, options.wrap);
    /* The build's size, kept where a keeper of the lab can
     * read it: how many triangles their two meshes carry
     * (three vertices to a triangle, three numbers to a
     * vertex). */
    canvas.dataset.tris = String((geo.main.pos.length + geo.eye.pos.length) / 9);
    function meshBuffer(builder) {
      const verts = builder.pos.length / 3;
      const data = new Float32Array(verts * 9);
      for (let i = 0; i < verts; i++) {
        data[i * 9] = builder.pos[i * 3];
        data[i * 9 + 1] = builder.pos[i * 3 + 1];
        data[i * 9 + 2] = builder.pos[i * 3 + 2];
        data[i * 9 + 3] = builder.nor[i * 3];
        data[i * 9 + 4] = builder.nor[i * 3 + 1];
        data[i * 9 + 5] = builder.nor[i * 3 + 2];
        data[i * 9 + 6] = builder.col[i * 3];
        data[i * 9 + 7] = builder.col[i * 3 + 1];
        data[i * 9 + 8] = builder.col[i * 3 + 2];
      }
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return { buf, verts };
    }
    const mainMesh = meshBuffer(geo.main);
    const eyeMesh = meshBuffer(geo.eye);
    const totalTris = (mainMesh.verts + eyeMesh.verts) / 3;

    const haloBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, haloBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]),
      gl.STATIC_DRAW
    );
    /* The shadow's floor quad, in XZ with its own uv. */
    const shadowBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, shadowBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -0.85, -1.04, -0.85, 0, 0,
        0.85, -1.04, -0.85, 1, 0,
        0.85, -1.04, 0.85, 1, 1,
        -0.85, -1.04, -0.85, 0, 0,
        0.85, -1.04, 0.85, 1, 1,
        -0.85, -1.04, 0.85, 0, 1
      ]),
      gl.STATIC_DRAW
    );
    const glow = parseColor(companion.palette.glow, [0.7, 0.9, 1]);
    const haloTex = glowTexture(gl, glow);
    const shadowTex = glowTexture(gl, [0, 0, 0]);
    const haloBase =
      (companion.shape && companion.shape.glow === "bright"
        ? 0.85
        : companion.shape && companion.shape.glow === "deep"
          ? 0.4
          : 0.62) +
      stage * 0.1;

    const bodyScale = (stage >= 2 ? 1.03 : stage === 1 ? 0.92 : 0.8) * 0.92;

    /* Motion: the creature's own small physics of feeling.
     * Springs are integrated in fixed substeps (240Hz), so a
     * bounce lands the same at 120Hz, at 60, and on a throttling
     * phone — percentage smoothing never could promise that. */
    const M = {
      t: Math.random() * 20,
      spinYaw: 0,
      spinVel: 0,
      baseYaw: 0,
      pitch: 0,
      travelDir: 0,
      moving: false,
      gazeYaw: 0,
      gazePitch: 0,
      gazeUntil: 0,
      eyeYaw: 0,
      eyePitch: 0,
      nextSaccade: 2 + Math.random() * 2,
      nextBlink: 1.5 + Math.random() * 3,
      blinkStart: -1,
      crouchUntil: 0,
      crouchVal: 0,
      bounce: 0,
      bounceVel: 0,
      pulse: 0,
      lastActivity: performance.now()
    };

    let rafId = null;
    let lastTs = 0;
    let emaDt = 16;
    let tier = 0;
    let frameCount = 0;
    let disposed = false;

    function sizeCanvas() {
      const side = Math.max(2, Math.round(px * dpr));
      if (canvas.width !== side) {
        canvas.width = side;
        canvas.height = side;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function blinkScale() {
      if (M.blinkStart < 0) return 1;
      const phase = (M.t - M.blinkStart) / 0.13;
      if (phase >= 1) {
        M.blinkStart = -1;
        return 1;
      }
      return 1 - Math.sin(phase * Math.PI) * 0.92;
    }

    function drawMesh(mesh, model, proj, view) {
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
      const stride = 9 * 4;
      const aPos = gl.getAttribLocation(prog, "aPos");
      const aNor = gl.getAttribLocation(prog, "aNor");
      const aCol = gl.getAttribLocation(prog, "aCol");
      gl.enableVertexAttribArray(aPos);
      gl.enableVertexAttribArray(aNor);
      gl.enableVertexAttribArray(aCol);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);
      gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, stride, 3 * 4);
      gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, stride, 6 * 4);
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, "uProj"), false, proj);
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, "uView"), false, view);
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, "uModel"), false, model);
      gl.uniform3f(gl.getUniformLocation(prog, "uRim"), glow[0], glow[1], glow[2]);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.verts);
    }

    function draw() {
      sizeCanvas();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      const proj = mat4Perspective(0.66, 1, 0.1, 20);
      const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -0.05, -3.6, 1]);
      const bobY = Math.sin(M.t * 2.1) * 0.045 + (M.moving ? Math.sin(M.t * 11) * 0.03 : 0);
      const stretch = Math.min(0.09, Math.abs(M.spinVel) * 0.007);
      const scaleXZ = bodyScale * (1 + M.bounce * 0.07 + M.crouchVal * 0.1 + M.pulse * 0.2);
      const scaleY = bodyScale * (1 - M.bounce * 0.15 - M.crouchVal * 0.22 + stretch + M.pulse * 0.2);
      const yaw = M.baseYaw + M.spinYaw;
      const model = mat4Model(0, bobY + M.bounce * 0.16, 0, yaw, M.pitch, scaleXZ, scaleY);
      const mvp = mat4Multiply(proj, mat4Multiply(view, model));

      /* The glow, behind everything. */
      gl.useProgram(haloProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, haloBuf);
      const hPos = gl.getAttribLocation(haloProg, "aPos");
      gl.enableVertexAttribArray(hPos);
      gl.vertexAttribPointer(hPos, 2, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(gl.getUniformLocation(haloProg, "uMVP"), false, mvp);
      gl.uniform1f(gl.getUniformLocation(haloProg, "uAlpha"), Math.min(1, haloBase));
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, haloTex);
      gl.uniform1i(gl.getUniformLocation(haloProg, "uTex"), 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      /* The blob shadow on its floor — it does not bob or pulse
       * with the body; it only breathes a little against a leap. */
      const shadowModel = mat4Model(0, 0, 0, yaw, 0, bodyScale, bodyScale);
      const shadowMVP = mat4Multiply(proj, mat4Multiply(view, shadowModel));
      gl.useProgram(shadowProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, shadowBuf);
      const sPos = gl.getAttribLocation(shadowProg, "aPos");
      const sUv = gl.getAttribLocation(shadowProg, "aUv");
      gl.enableVertexAttribArray(sPos);
      gl.enableVertexAttribArray(sUv);
      gl.vertexAttribPointer(sPos, 3, gl.FLOAT, false, 5 * 4, 0);
      gl.vertexAttribPointer(sUv, 2, gl.FLOAT, false, 5 * 4, 3 * 4);
      gl.uniformMatrix4fv(gl.getUniformLocation(shadowProg, "uMVP"), false, shadowMVP);
      gl.uniform1f(
        gl.getUniformLocation(shadowProg, "uAlpha"),
        0.3 * (1 - Math.min(1, Math.abs(M.bounce)) * 0.3)
      );
      gl.bindTexture(gl.TEXTURE_2D, shadowTex);
      gl.uniform1i(gl.getUniformLocation(shadowProg, "uTex"), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.depthMask(true);
      gl.disable(gl.BLEND);

      /* The creature, then its eye — the eye rides its own
       * transform on the body's, so it can lead, jump, blink. */
      drawMesh(mainMesh, model, proj, view);
      const eyeModel = mat4Multiply(
        model,
        mat4Multiply(
          mat4Translate(geo.eyeCenter[0], geo.eyeCenter[1], geo.eyeCenter[2]),
          mat4Multiply(
            mat4RotY(M.eyeYaw),
            mat4Multiply(mat4RotX(M.eyePitch), mat4Scale(1, blinkScale(), 1))
          )
        )
      );
      drawMesh(eyeMesh, eyeModel, proj, view);
      canvas.dataset.tier = String(tier);
      canvas.dataset.tris = String(totalTris);
    }

    function step(ts) {
      rafId = null;
      if (disposed) return;
      const dt = Math.min(0.05, lastTs ? (ts - lastTs) / 1000 : 0.016);
      lastTs = ts;
      M.t += dt;
      /* Adaptive quality, the Witness World's own discipline:
       * slow frames step the cost down — pixel ratio first,
       * then frame rate — instead of stuttering. */
      emaDt = emaDt * 0.95 + dt * 1000 * 0.05;
      frameCount += 1;
      if (frameCount % 90 === 0) {
        if (emaDt > 40 && tier < 2) {
          tier = 2;
          dpr = 1;
        } else if (emaDt > 26 && tier < 1) {
          tier = 1;
          dpr = 1;
        }
      }
      /* The gaze: saccades — small jumps of attention, a few a
       * minute of looking — with an occasional aversion, so it
       * never doll-stares. Nothing else owns the eyes just now. */
      if (!M.moving && ts >= M.gazeUntil && M.t >= M.nextSaccade) {
        const avert = Math.random() < 0.25 && M.gazeYaw !== 0;
        const dir = avert ? -Math.sign(M.gazeYaw) : Math.random() < 0.5 ? -1 : 1;
        M.gazeYaw = dir * (0.15 + Math.random() * 0.4);
        M.gazePitch = (Math.random() - 0.5) * 0.16;
        M.gazeUntil = ts + 450 + Math.random() * 800;
        M.nextSaccade = M.t + 1.6 + Math.random() * 2.4;
      }
      if (M.t >= M.nextBlink) {
        M.blinkStart = M.t;
        M.nextBlink = M.t + 2.4 + Math.random() * 3.4;
      }
      /* The eyes lead — they are on the gaze in a blink's time;
       * the head follows behind them like a head does. */
      const eyeEase = 1 - Math.pow(1e-7, dt);
      M.eyeYaw += (M.gazeYaw - M.eyeYaw) * eyeEase;
      M.eyePitch += (M.gazePitch - M.eyePitch) * eyeEase;
      const gazeFresh = ts < M.gazeUntil;
      const targetYaw = M.moving
        ? M.travelDir * 0.8
        : gazeFresh
          ? M.gazeYaw * 0.85
          : Math.sin(M.t * 0.35) * 0.55;
      const targetPitch = gazeFresh ? M.gazePitch * 0.7 : Math.sin(M.t * 1.7) * 0.06;
      const ease = 1 - Math.pow(0.04, dt);
      M.baseYaw += (targetYaw - M.baseYaw) * ease;
      M.pitch += (targetPitch - M.pitch) * ease;
      /* Spin, with its own decay. */
      M.spinYaw += M.spinVel * dt;
      M.spinVel *= Math.pow(0.06, dt);
      if (Math.abs(M.spinVel) < 0.01) M.spinVel = 0;
      /* The crouch gathers and releases. */
      const crouchTarget = ts < M.crouchUntil ? 1 : 0;
      M.crouchVal += (crouchTarget - M.crouchVal) * (1 - Math.pow(1e-5, dt));
      /* The bounce is a spring — under-damped (ζ ≈ 0.55, ω = 14)
       * so it overshoots once and settles — stepped at a fixed
       * 240Hz so it lands the same at any frame rate. */
      const steps = Math.max(1, Math.min(8, Math.ceil(dt / (1 / 240))));
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        M.bounceVel += (-196 * M.bounce - 15.4 * M.bounceVel) * sdt;
        M.bounce += M.bounceVel * sdt;
      }
      M.pulse *= Math.pow(0.1, dt);
      /* A long-idle Spark breathes slowly: after 10 quiet
       * seconds it draws every other frame, after 25 every
       * fifteenth — the canvas is tiny and follows it, and a
       * resting creature should cost almost nothing. */
      const idleFor = ts - M.lastActivity;
      const skip = tier >= 2 ? 3 : idleFor > 25000 ? 15 : idleFor > 10000 ? 2 : 1;
      if (frameCount % skip === 0) draw();
      rafId = window.requestAnimationFrame(step);
    }

    function startLoop() {
      if (rafId != null || disposed) return;
      lastTs = 0;
      rafId = window.requestAnimationFrame(step);
    }

    container.appendChild(canvas);
    if (REDUCED()) {
      /* One still frame, honestly framed. No loop at all. */
      M.baseYaw = 0.5;
      M.eyeYaw = 0.3;
      draw();
      canvas.dataset.tier = "still";
    } else {
      startLoop();
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          if (rafId != null) window.cancelAnimationFrame(rafId);
          rafId = null;
        } else {
          startLoop();
        }
      });
    }

    const touch = () => {
      M.lastActivity = performance.now();
    };
    return {
      canvas,
      /* Anticipation: the crouch a breath before the dart. */
      crouch() {
        touch();
        M.crouchUntil = performance.now() + 130;
      },
      /* The dodge, in 3D: a quick dart of spin. */
      dart() {
        touch();
        M.spinVel = 10;
      },
      /* A tap: a happy bounce-and-spin, with the chirp its
       * presence already makes under the usual sound rules. */
      delight() {
        touch();
        M.spinVel = 7;
        M.bounceVel += 5.5;
      },
      /* Evolution: the full flourish — spin, pulse, and a leap. */
      celebrate() {
        touch();
        M.spinVel = 12;
        M.pulse = 1;
        M.bounceVel += 7;
      },
      flourish(kind) {
        touch();
        if (kind === "is-spinning") M.spinVel = Math.max(M.spinVel, 6);
        else if (kind === "is-stretching") M.pulse = Math.max(M.pulse, 0.7);
        else if (kind === "is-looking") {
          M.gazeYaw = (Math.random() < 0.5 ? -1 : 1) * 0.7;
          M.gazePitch = 0.1;
          M.gazeUntil = performance.now() + 1300;
        }
      },
      setTravel(moving, dirX) {
        if (moving) touch();
        M.moving = !!moving;
        if (dirX) M.travelDir = dirX < 0 ? -1 : 1;
      },
      /* Look toward the pointer: nx, ny in roughly -1..1, the
       * pointer's offset from the Spark, scaled by nearness.
       * The gaze lands first; the head follows. */
      lookAt(nx, ny) {
        touch();
        M.gazeYaw = Math.max(-0.95, Math.min(0.95, nx * 0.85));
        M.gazePitch = Math.max(-0.5, Math.min(0.5, ny * 0.42));
        M.gazeUntil = performance.now() + 900;
      },
      dispose() {
        disposed = true;
        if (rafId != null) window.cancelAnimationFrame(rafId);
        rafId = null;
        const ext = gl.getExtension("WEBGL_lose_context");
        if (ext) ext.loseContext();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  window.Spark3D = { mount };
})();
