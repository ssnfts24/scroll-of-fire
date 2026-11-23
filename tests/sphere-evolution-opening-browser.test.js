"use strict";

/*
 * The Evolution Opening, in a real browser.
 *
 * A first visit at phone width: the film stands over the
 * Sphere — the "Welcome to the Sphere" title beat first, then
 * the stages advancing on their own timing, silent until a
 * first touch arms the score — until a keeper's step takes the
 * walk over: Calendars → First Sphere → the live Sphere → the
 * Spark's tour. It marks itself seen, and never traps the
 * visitor: a second visit goes straight to the Sphere with no
 * film at all. The guide bar's "See how it grew" door replays
 * the film by choice, score armed by that very tap; Skip
 * stands throughout; reduced motion gets the still form, and
 * the still form never advances on its own.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

const root = path.resolve(__dirname, "..");
const chromium = [
  process.env.CHROMIUM_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].find((candidate) => candidate && fs.existsSync(candidate));

function createServer() {
  const types = {
    ".css": "text/css",
    ".html": "text/html",
    ".js": "text/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json",
    ".webp": "image/webp",
  };
  return http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    fs.stat(file, (statError, stat) => {
      const target = statError || stat.isDirectory() ? path.join(file, "index.html") : file;
      fs.readFile(target, (readError, contents) => {
        if (readError) {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, {
          "Content-Type": types[path.extname(target)] || "application/octet-stream",
          "Cache-Control": "no-store",
        });
        response.end(contents);
      });
    });
  });
}

async function waitFor(check, timeout = 30000, label = "browser state") {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    let ok = false;
    try {
      ok = await check();
    } catch {
      ok = false;
    }
    if (ok) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function launch(t) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port: sitePort } = server.address();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sof-evo-opening-"));
  const browser = childProcess.spawn(chromium, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    "--remote-allow-origins=*",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: "ignore" });

  const activePortPath = path.join(profile, "DevToolsActivePort");
  await waitFor(() => fs.existsSync(activePortPath), 60000, "DevTools port");
  const [debugPort] = fs.readFileSync(activePortPath, "utf8").trim().split(/\r?\n/);
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const page = targets.find((target) => target.type === "page");
  assert.ok(page, "Chromium exposes a page target");

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Chromium command timed out: ${method}`));
      }
    }, 90000).unref();
  });
  const evaluate = async (expression) => {
    const result = await call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Browser evaluation failed");
    }
    return result.result.value;
  };
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });
  await call("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });

  t.after(async () => {
    try { socket.close(); } catch { /* already closed */ }
    browser.kill("SIGKILL");
    server.close();
    fs.rmSync(profile, { recursive: true, force: true });
  });
  return { evaluate, call, sitePort };
}

test("Evolution Opening: first visit walks the four stages, then never traps", async (t) => {
  if (!chromium || typeof WebSocket !== "function") {
    t.skip("A local Chromium binary and Node WebSocket support are required");
    return;
  }
  const { evaluate, sitePort } = await launch(t);
  const url = `http://127.0.0.1:${sitePort}/docs/living-time-sphere.html`;
  await evaluate(`window.location.href = ${JSON.stringify(url)}`).catch(() => {});
  await new Promise((r) => setTimeout(r, 500));

  // First visit: the film stands over the Sphere, on its
  // welcome beat — and silent: no touch yet, so no score.
  await waitFor(async () => evaluate(
    `!!document.querySelector("[data-evolution-opening]")`
  ), 120000, "the opening to stand on a first visit");
  const welcome = await evaluate(`(() => {
    const el = document.querySelector("[data-evolution-opening]");
    return {
      stage: el.dataset.stage,
      title: el.querySelector('[data-evo="title"]').textContent,
      film: window.SphereEvolutionOpening?.filmState(),
      soundCue: !!el.querySelector('[data-evo="sound"]') && !el.querySelector('[data-evo="sound"]').hidden,
    };
  })()`);
  assert.equal(welcome.stage, "welcome");
  assert.match(welcome.title, /Welcome to the Sphere/);
  assert.equal(welcome.film?.mode, "film", "a first visit meets the film, playing itself");
  assert.equal(welcome.film?.soundArmed, false, "no touch yet — the score is not armed");
  assert.equal(welcome.film?.audioStarted, false, "no AudioContext exists before a first touch");
  assert.equal(welcome.soundCue, true, "the invitation to the sound stands in the scene");

  // The film advances on its own timing — no click — into the
  // calendars.
  await waitFor(async () => evaluate(
    `document.querySelector("[data-evolution-opening]")?.dataset.stage === "calendars"`
  ), 20000, "the film to advance from the welcome into the calendars on its own");
  const stage1 = await evaluate(`(() => {
    const el = document.querySelector("[data-evolution-opening]");
    return {
      stage: el.dataset.stage,
      moons: el.querySelectorAll(".evo-cal-moon").length,
      days: el.querySelectorAll(".evo-cal-day").length,
      todayCells: el.querySelectorAll(".evo-cal-day.is-today").length,
      demo: el.querySelector(".evo-demo")?.textContent || "",
    };
  })()`);
  assert.equal(stage1.stage, "calendars");
  assert.equal(stage1.moons, 13);
  assert.equal(stage1.days, 364);
  assert.equal(stage1.todayCells, 1, "today is marked exactly once");
  assert.match(stage1.demo, /demonstration/i);

  const clickNext = () => evaluate(
    `document.querySelector('[data-evo="next"]').click()`
  );

  // A keeper's step ends the film: the walk is theirs now.
  await clickNext();
  const kept = await evaluate(`window.SphereEvolutionOpening?.filmState()`);
  assert.equal(kept?.mode, "kept", "a step during the film hands the walk to the keeper");

  // Stage 2: the first Sphere's portrait, thirteen numbered
  // moons — the stage the keeper's takeover step landed on.
  const stage2 = await evaluate(`(() => {
    const el = document.querySelector("[data-evolution-opening]");
    const svg = el.querySelector(".evo-first-sphere-svg");
    return {
      stage: el.dataset.stage,
      hasSvg: !!svg,
      moonTexts: svg ? svg.querySelectorAll("text").length : 0,
      title: el.querySelector('[data-evo="title"]').textContent,
    };
  })()`);
  assert.equal(stage2.stage, "first-sphere");
  assert.equal(stage2.hasSvg, true);
  assert.equal(stage2.moonTexts, 13);
  assert.match(stage2.title, /stood up in a ring/);

  // Stage 3: the reveal — the overlay steps aside for the real Sphere.
  await clickNext();
  const stage3 = await evaluate(`(() => {
    const el = document.querySelector("[data-evolution-opening]");
    return { stage: el.dataset.stage, reveal: el.classList.contains("is-reveal") };
  })()`);
  assert.equal(stage3.stage, "sphere-now");
  assert.equal(stage3.reveal, true);

  // Stage 4: the Spark's tour, four beats to the keeping beat.
  await clickNext();
  for (let i = 0; i < 3; i++) {
    const tour = await evaluate(`(() => {
      const el = document.querySelector("[data-evolution-opening]");
      return {
        stage: el.dataset.stage,
        count: el.querySelector(".evo-tour-count")?.textContent || "",
        hasFigure: !!el.querySelector(".evo-spark-figure svg"),
      };
    })()`);
    assert.equal(tour.stage, "spark");
    assert.match(tour.count, new RegExp(`tour · ${i + 1} of 4`, "i"));
    assert.equal(tour.hasFigure, true);
    await clickNext();
  }
  const lastBeat = await evaluate(`(() => {
    const el = document.querySelector("[data-evolution-opening]");
    return {
      count: el.querySelector(".evo-tour-count")?.textContent || "",
      cta: !!el.querySelector('[data-evo="today-cta"]'),
      line: el.querySelector('[data-evo="line"]').textContent,
    };
  })()`);
  assert.match(lastBeat.count, /tour · 4 of 4/i);
  assert.equal(lastBeat.cta, true, "the keeping beat offers the door into today");
  assert.match(lastBeat.line, /kept/);

  // Done: the opening closes and marks itself seen.
  await evaluate(`document.querySelector('[data-evo="next"]').click()`);
  await waitFor(async () => evaluate(
    `!document.querySelector("[data-evolution-opening]")`
  ), 15000, "the opening to close");
  const seen = await evaluate(`localStorage.getItem("sof.sphere.evolutionOpening.v1")`);
  assert.equal(seen, "1");

  // Second visit: no auto-opening — and the replay door stands.
  await evaluate(`window.location.reload()`);
  await waitFor(async () => evaluate(
    `!!document.querySelector("[data-evo-door]")`
  ), 120000, "the replay door in the guide bar");
  await new Promise((r) => setTimeout(r, 3000));
  assert.equal(await evaluate(`!!document.querySelector("[data-evolution-opening]")`), false,
    "a returning visitor is never trapped by the opening");

  // The door replays the film by choice — and the tap that
  // opens it is itself a touch, so the replay's score is armed
  // from its first beat. Skip stands at the welcome, and
  // skipping the replay leaves the seen flag standing.
  await evaluate(`document.querySelector("[data-evo-door]").click()`);
  await waitFor(async () => evaluate(
    `document.querySelector("[data-evolution-opening]")?.dataset.stage === "welcome"`
  ), 15000, "the replay to open on the welcome");
  const replay = await evaluate(`window.SphereEvolutionOpening?.filmState()`);
  assert.equal(replay?.mode, "film", "the replay plays the film");
  assert.equal(replay?.soundArmed, true, "the door's own tap arms the replay's score");
  await evaluate(`document.querySelector('[data-evo="skip"]').click()`);
  await waitFor(async () => evaluate(
    `!document.querySelector("[data-evolution-opening]")`
  ), 15000, "skip to close the replay");
  assert.equal(await evaluate(`localStorage.getItem("sof.sphere.evolutionOpening.v1")`), "1",
    "the seen flag stands after a skipped replay");
});

test("Evolution Opening: reduced motion gets the still form, same words", async (t) => {
  if (!chromium || typeof WebSocket !== "function") {
    t.skip("A local Chromium binary and Node WebSocket support are required");
    return;
  }
  const { evaluate, call, sitePort } = await launch(t);
  await call("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  const url = `http://127.0.0.1:${sitePort}/docs/living-time-sphere.html`;
  await evaluate(`window.location.href = ${JSON.stringify(url)}`).catch(() => {});
  await waitFor(async () => evaluate(
    `!!document.querySelector("[data-evolution-opening]")`
  ), 120000, "the still opening to stand");
  const still = await evaluate(`(() => {
    const el = document.querySelector("[data-evolution-opening]");
    return {
      still: el.classList.contains("is-still"),
      stage: el.dataset.stage,
      title: el.querySelector('[data-evo="title"]').textContent,
      film: window.SphereEvolutionOpening?.filmState(),
    };
  })()`);
  assert.equal(still.still, true);
  assert.equal(still.stage, "calendars", "the still form opens on the calendars — no welcome, no film");
  assert.match(still.title, /year lay flat/);
  assert.equal(still.film?.mode, "still");
  assert.equal(still.film?.audioStarted, false, "the still form carries no score");
  // And it never advances on its own: the staged walk waits
  // for the keeper, however long they take.
  await new Promise((r) => setTimeout(r, 4000));
  assert.equal(await evaluate(
    `document.querySelector("[data-evolution-opening]")?.dataset.stage`
  ), "calendars", "the still form stands where it was left");
});
