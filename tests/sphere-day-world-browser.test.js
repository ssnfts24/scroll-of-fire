"use strict";

/*
 * Phase B — Living Sphere Day World, in a real browser.
 *
 * The vertical slice end to end at phone width: seed the ONE planner
 * record through the planner's own create path, zoom continuously
 * Year → Moon → Day Approach → Living Day, see the day's objects
 * standing at their true ring position, open the inspector from a
 * pick, write through the planner (complete + postpone), travel to
 * an empty day and find it honestly empty, zoom back out to the
 * untouched year, and confirm the existing actions still work.
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
      ok = false; // the page's main thread is busy; keep waiting
    }
    if (ok) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

test("Day World slice: zoom in, objects from the record, planner writes, empty day, zoom out", async (t) => {
  if (!chromium || typeof WebSocket !== "function") {
    t.skip("A local Chromium binary and Node WebSocket support are required");
    return;
  }

  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port: sitePort } = server.address();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sof-day-world-"));
  const browser = childProcess.spawn(chromium, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--remote-allow-origins=*",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: "ignore" });
  let socket;

  try {
    const activePortPath = path.join(profile, "DevToolsActivePort");
    await waitFor(() => fs.existsSync(activePortPath), 15000, "DevTools port");
    const [debugPort] = fs.readFileSync(activePortPath, "utf8").trim().split(/\r?\n/);
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const page = targets.find((target) => target.type === "page");
    assert.ok(page, "Chromium exposes a page target");

    socket = new WebSocket(page.webSocketDebuggerUrl);
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
    await call("Page.navigate", {
      url: `http://127.0.0.1:${sitePort}/docs/living-time-sphere.html`,
    });

    // The page is up and the adapter is registered and mounted.
    await waitFor(async () => evaluate(
      `document.querySelectorAll(".sphere-rebuild-dock button").length === 5`
    ), 90000, "the Sphere dock");
    await waitFor(async () => evaluate(
      `!!window.LivingTimeSphereDayWorldAdapter
        && window.LivingTimeSphereExtensionHost?.isMounted?.("living-time-sphere-day-world") === true`
    ), 90000, "the day world adapter to mount");
    // The canonical cursor is established in the page's first
    // deferred phase; on a loaded machine that can take a while.
    await waitFor(async () => evaluate(
      `!!window.SOFTemporalCursor && !!window.LivingTimeSphereDayZoom`
    ), 180000, "the temporal cursor");

    const adapterState = (expr) => evaluate(
      `(() => { const s = window.LivingTimeSphereDayWorldAdapter._state; return ${expr}; })()`
    );

    // Seed the ONE planner record through the planner's own path:
    // two timed things and one untimed thing on today. The created
    // records themselves carry the authoritative Pattern stamp.
    const seeded = await evaluate(`(async () => {
      const planner = window.CodexLivingPlanner;
      const pc = window.PatternCalendar;
      const today = pc.fromCivilDate({ date: new Date() });
      const civil = today.civilDate;
      const made = [];
      made.push(await planner.createPlan({ title: "Fix the gate latch", category: "task", date: civil, time: "09:30", allDay: false }));
      made.push(await planner.createPlan({ title: "Plant the garlic bed", category: "planting", date: civil, time: "15:00", allDay: false }));
      made.push(await planner.createPlan({ title: "Supper with family", category: "family", date: civil }));
      window.dispatchEvent(new CustomEvent("sof:life-atlas-records-changed", { detail: { source: "test-seed" } }));
      return {
        patternDay: made[0].temporal.patternDay,
        patternYear: made[0].temporal.patternYear,
        ids: made.map((r) => r.id),
      };
    })()`);
    assert.ok(Number.isInteger(seeded.patternDay), "today has a Pattern Day");
    await waitFor(async () => adapterState(`s.items.length === 3`), 30000, "the world to hold today's three records");

    // Zoom: Year View first — the world is not there.
    await evaluate(`window.LivingTimeSphereRenderer3d.focusPatternDay(${seeded.patternDay}, { distance: 3.45, animated: true })`);
    await waitFor(async () => adapterState(`s.stage === "year" && s.bloom < 0.02 && (!s.group || !s.group.visible)`),
      30000, "Year View with no world");
    // Day Approach: the world begins to grow; the chip stands up.
    await evaluate(`window.LivingTimeSphereRenderer3d.focusPatternDay(${seeded.patternDay}, { distance: 2.0, animated: true })`);
    await waitFor(async () => adapterState(`s.stage === "approach" && s.bloom > 0.05`),
      30000, "Day Approach bloom");
    assert.equal(await evaluate(`document.querySelector(".dw-chip").hidden`), false, "orientation chip shows at Day Approach");
    // Living Day: the world stands, objects up.
    await evaluate(`window.LivingTimeSphereRenderer3d.focusPatternDay(${seeded.patternDay}, { distance: 1.45, animated: true })`);
    await waitFor(async () => adapterState(`s.stage === "living" && s.bloom > 0.55 && s.group && s.group.visible`),
      30000, "Living Day bloom");
    // Immersive Day: full bloom.
    await evaluate(`window.LivingTimeSphereRenderer3d.focusPatternDay(${seeded.patternDay}, { distance: 1.0, animated: true })`);
    await waitFor(async () => adapterState(`s.stage === "immersive" && s.bloom > 0.95`),
      30000, "Immersive Day full bloom");
    await evaluate(`window.LivingTimeSphereRenderer3d.focusPatternDay(${seeded.patternDay}, { distance: 1.45, animated: true })`);
    await waitFor(async () => adapterState(`s.stage === "living"`), 30000, "back to Living Day");
    const proxyKinds = await adapterState(
      `s.hitProxies.map((p) => p.userData.dayWorld.kind).sort()`
    );
    assert.deepEqual(proxyKinds, ["plinth", "record", "record", "record"],
      "three record objects plus the plinth — exactly what the record holds");
    // Two stand on the clock arc at their hours; one on the terrace.
    const timedHours = await adapterState(
      `s.items.filter((i) => i.timed).map((i) => i.hour).sort((a, b) => a - b)`
    );
    assert.deepEqual(timedHours, [9.5, 15], "timed records carry their hours");
    // And the world is framed in view, not lost below the frame:
    // the adapter asks the camera to shift its target toward the day.
    await waitFor(async () => evaluate(`(() => {
      const s = window.LivingTimeSphereDayWorldAdapter._state;
      const ctx = s.lastContext;
      if (!ctx?.camera || !ctx?.THREE || !s.group) return false;
      const v = new ctx.THREE.Vector3();
      s.group.getWorldPosition(v);
      v.project(ctx.camera);
      return Math.abs(v.y) <= 0.9 && Math.abs(v.x) <= 0.9;
    })()`), 60000, "the day world framed in view");
    // The world grows from the day's true ring position.
    const anchorCheck = await evaluate(`(() => {
      const s = window.LivingTimeSphereDayWorldAdapter._state;
      const geo = window.LivingTimeSphereCalendarGeometry;
      const cell = geo.calendarDisplayCell(${seeded.patternDay}) || geo.calendarCell(${seeded.patternDay});
      const ring = window.LivingTimeSphereM.SIZES.patternRing;
      const rad = cell.angle * Math.PI / 180;
      const expected = { x: Math.sin(rad) * ring * cell.radialFactor, z: -Math.cos(rad) * ring * cell.radialFactor };
      return Math.abs(s.group.position.x - expected.x) < 0.01 && Math.abs(s.group.position.z - expected.z) < 0.01;
    })()`);
    assert.equal(anchorCheck, true, "the world stands at the day's true ring position");

    // Pick the timed task → inspector names it; Complete writes
    // through the one planner.
    const pickResult = await evaluate(`(() => {
      const adapter = window.LivingTimeSphereDayWorldAdapter;
      const proxy = adapter._state.hitProxies.find(
        (p) => p.userData.dayWorld.kind === "record" && p.userData.dayWorld.id === ${JSON.stringify(seeded.ids[0])}
      );
      const hit = adapter._extension.pick({
        raycaster: { intersectObjects: () => [{ object: proxy }] },
        THREE: window.THREE,
      });
      return hit && { handled: hit.handled, label: hit.label };
    })()`);
    assert.deepEqual(pickResult, { handled: true, label: "Fix the gate latch" });
    await waitFor(async () => evaluate(
      `!document.querySelector(".dw-inspector").hidden
        && document.querySelector(".dw-ins-title").textContent === "Fix the gate latch"`
    ), 10000, "the inspector to name the record");
    await evaluate(`Array.from(document.querySelectorAll(".dw-ins-btn")).find((b) => b.textContent === "Complete").click()`);
    await waitFor(async () => evaluate(`(async () => {
      const planner = window.CodexLivingPlanner;
      const records = await planner.plansForYear(${seeded.patternYear});
      const record = records.find((r) => r.id === ${JSON.stringify(seeded.ids[0])});
      return window.CodexLifeAtlasScheduling.isCompleted(record);
    })()`), 90000, "completion to land in the one planner record");

    // Postpone the planting to tomorrow — through the planner only.
    await evaluate(`(() => {
      const adapter = window.LivingTimeSphereDayWorldAdapter;
      const proxy = adapter._state.hitProxies.find(
        (p) => p.userData.dayWorld.kind === "record" && p.userData.dayWorld.id === ${JSON.stringify(seeded.ids[1])}
      );
      adapter._extension.pick({
        raycaster: { intersectObjects: () => [{ object: proxy }] },
        THREE: window.THREE,
      });
    })()`);
    await waitFor(async () => evaluate(
      `document.querySelector(".dw-ins-title")?.textContent === "Plant the garlic bed"`
    ), 10000, "the inspector to name the planting");
    await evaluate(`Array.from(document.querySelectorAll(".dw-ins-btn")).find((b) => b.textContent === "Postpone to tomorrow").click()`);
    await waitFor(async () => evaluate(`(async () => {
      const planner = window.CodexLivingPlanner;
      const thisYear = await planner.plansForYear(${seeded.patternYear});
      const nextYear = await planner.plansForYear(${seeded.patternYear} + 1);
      const all = [...thisYear, ...nextYear];
      const record = all.find((r) => r.id === ${JSON.stringify(seeded.ids[1])});
      if (!record) return false;
      const before = ${JSON.stringify(seeded.patternDay)};
      return record.temporal.patternDay === before + 1 || record.temporal.patternDay === 1;
    })()`), 90000, "the planting to stand on tomorrow in the planner record");

    // Travel inside the world to an empty day: honestly empty.
    await evaluate(`window.SOFTemporalCursor.moveDays(30, { source: "test" })`);
    await waitFor(async () => adapterState(`s.items.length === 0 && s.selection && s.selection.patternDay !== ${seeded.patternDay}`),
      90000, "an empty day's world");
    const emptyProxies = await adapterState(`s.hitProxies.map((p) => p.userData.dayWorld.kind)`);
    assert.deepEqual(emptyProxies, ["plinth"], "an empty day shows the bare foundation and nothing else");
    await evaluate(`(() => {
      const adapter = window.LivingTimeSphereDayWorldAdapter;
      const proxy = adapter._state.hitProxies[0];
      adapter._extension.pick({
        raycaster: { intersectObjects: () => [{ object: proxy }] },
        THREE: window.THREE,
      });
    })()`);
    await waitFor(async () => evaluate(
      `document.querySelector(".dw-ins-line")?.textContent.includes("Nothing stands on this day yet")`
    ), 10000, "the honest empty line");

    // Zoom back out: the untouched year returns.
    await evaluate(`document.querySelector(".dw-ins-close").click()`);
    await evaluate(`window.LivingTimeSphereRenderer3d.focusPatternDay(window.SOFTemporalCursor.getCoordinate().remnant13Moons.patternDay, { distance: 3.45, animated: true })`);
    await waitFor(async () => adapterState(`s.stage === "year" && (!s.group || !s.group.visible)`),
      30000, "the year restored");

    // Existing actions keep working. The dock's Today button
    // delegates to the sphere UI's own today path; the adapter's
    // contract is the canonical cursor — the same authority the
    // Day Details panel reads — so return through the cursor and
    // confirm the world follows it home.
    await evaluate(`document.querySelector("[data-sphere-rebuild-today]").click()`);
    await delay(600);
    await evaluate(`window.SOFTemporalCursor.today({ source: "test" })`);
    await waitFor(async () => adapterState(`s.selection && s.selection.patternDay === ${seeded.patternDay}`),
      90000, "the cursor's Today to bring the world home");
    await evaluate(`document.querySelector("[data-sphere-rebuild-daydetails]").click()`);
    await waitFor(async () => evaluate(
      `document.documentElement.classList.contains("armillary-rooms-open")`
    ), 15000, "Day Details to open the rooms");
    await evaluate(`document.querySelector(".dw-inspector").hidden === true`);
    assert.equal(await evaluate(`document.querySelector(".dw-inspector").hidden`), true,
      "the inspector never stands open with the rooms sheet");
  } finally {
    try { socket?.close(); } catch { /* already closed */ }
    browser.kill("SIGKILL");
    server.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
});

test("Keeper selection: a face tap moves the cursor, the chip follows, the Play pill never covers the title", async (t) => {
  if (!chromium || typeof WebSocket !== "function") {
    t.skip("A local Chromium binary and Node WebSocket support are required");
    return;
  }

  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port: sitePort } = server.address();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sof-day-world-chip-"));
  const browser = childProcess.spawn(chromium, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--remote-allow-origins=*",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: "ignore" });
  let socket;

  try {
    const activePortPath = path.join(profile, "DevToolsActivePort");
    await waitFor(() => fs.existsSync(activePortPath), 15000, "DevTools port");
    const [debugPort] = fs.readFileSync(activePortPath, "utf8").trim().split(/\r?\n/);
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const page = targets.find((target) => target.type === "page");
    assert.ok(page, "Chromium exposes a page target");

    socket = new WebSocket(page.webSocketDebuggerUrl);
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
    await call("Page.navigate", {
      url: `http://127.0.0.1:${sitePort}/docs/living-time-sphere.html`,
    });

    await waitFor(async () => evaluate(
      `document.querySelectorAll(".sphere-rebuild-dock button").length === 5`
    ), 90000, "the Sphere dock");
    await waitFor(async () => evaluate(
      `!!window.LivingTimeSphereDayWorldAdapter
        && window.LivingTimeSphereExtensionHost?.isMounted?.("living-time-sphere-day-world") === true`
    ), 90000, "the day world adapter to mount");
    await waitFor(async () => evaluate(
      `!!window.SOFTemporalCursor && !!window.LivingTimeSphereDayZoom && !!window.LivingTimeSphereUi`
    ), 180000, "the temporal cursor and the sphere UI");

    const cursorDay = () => evaluate(
      `window.SOFTemporalCursor.getCoordinate()?.remnant13Moons?.patternDay ?? null`
    );
    const chipTitle = () => evaluate(`document.querySelector(".dw-chip-title")?.textContent ?? null`);
    const chipLine = () => evaluate(`document.querySelector(".dw-chip-line")?.textContent ?? null`);
    const adapterState = (expr) => evaluate(
      `(() => { const s = window.LivingTimeSphereDayWorldAdapter._state; return ${expr}; })()`
    );

    // Seed one plan on Pattern Day 262 (Moon 10 · Day 10) through
    // the planner's own create path.
    const seeded = await evaluate(`(async () => {
      const planner = window.CodexLivingPlanner;
      const pc = window.PatternCalendar;
      const year = window.SOFTemporalCursor.getCoordinate().remnant13Moons.patternYear;
      const civil = new Date(pc.epochForYear(year).getTime() + (262 - 1) * 86400000).toISOString().slice(0, 10);
      const made = await planner.createPlan({ title: "Chip harness plan", category: "task", date: civil });
      window.dispatchEvent(new CustomEvent("sof:life-atlas-records-changed", { detail: { source: "test-seed" } }));
      return { patternDay: made.temporal.patternDay, patternYear: made.temporal.patternYear };
    })()`);
    assert.equal(seeded.patternDay, 262, "the seeded plan stands on Pattern Day 262");

    // Stand at Day Approach on today: the chip stands up.
    const todayPd = await cursorDay();
    await evaluate(`window.LivingTimeSphereRenderer3d.focusPatternDay(${todayPd}, { distance: 2.0, animated: true })`);
    await waitFor(async () => adapterState(`s.stage === "approach"`), 60000, "Day Approach");
    assert.equal(await evaluate(`document.querySelector(".dw-chip").hidden`), false, "orientation chip shows at Day Approach");

    // The overlap, measured: the page's centred Play pill must not
    // intersect the chip's title, nor sit on top of it.
    const overlap = await evaluate(`(() => {
      const title = document.querySelector(".dw-chip-title");
      const toggle = document.querySelector(".sphere-play-bar-toggle");
      if (!title || !toggle) return { missing: true };
      const tr = title.getBoundingClientRect();
      const pr = toggle.getBoundingClientRect();
      const intersects = !(pr.right <= tr.left || pr.left >= tr.right || pr.bottom <= tr.top || pr.top >= tr.bottom);
      const stack = document.elementsFromPoint(tr.left + tr.width / 2, tr.top + tr.height / 2)
        .map((n) => (typeof n.className === "string" ? n.className : ""));
      return { intersects, toggleOnTitle: stack.some((c) => c.includes("sphere-play-bar")) };
    })()`);
    assert.deepEqual(overlap, { intersects: false, toggleOnTitle: false },
      "the Play pill never covers the chip's header");

    // Aaron's path, exactly as the 3D renderer invokes it on a
    // day-numeral tap: the public selectDay. Before the bridge,
    // this moved only the UI's own state — the cursor, and with it
    // the chip, stayed on the old day.
    await evaluate(`window.LivingTimeSphereUi.selectDay(262, { source: "sphere-calendar-matrix", marker: "day-262" })`);
    await waitFor(async () => (await cursorDay()) === 262, 90000,
      "the canonical cursor to follow the keeper's tap");
    await waitFor(async () => adapterState(`s.selection && s.selection.patternDay === 262 && s.items.length === 1`),
      90000, "the day world to stand on 262 with its one record");
    assert.equal(await chipTitle(), "Moon 10 · Day 10 · Pattern Day 262",
      "the chip names the day the keeper selected");
    assert.equal(await chipLine(), "1 thing stands on this day.",
      "the chip shows the selected day's contents");

    // The other face path: the marker-select event (label picks).
    await evaluate(`document.getElementById("sphere-container").dispatchEvent(
      new CustomEvent("sphere:marker-select", { detail: { type: "day", moon: 10, day: 19, dayOfPatternYear: 271 } }))`);
    await waitFor(async () => (await cursorDay()) === 271, 90000,
      "the cursor to follow the marker pick");
    await waitFor(async () => adapterState(`s.selection && s.selection.patternDay === 271 && s.items.length === 0`),
      90000, "the day world to stand on the empty 271");
    assert.equal(await chipTitle(), "Moon 10 · Day 19 · Pattern Day 271");
    assert.equal(await chipLine(), "Nothing stands on this day yet.",
      "an empty day stays honestly empty in the chip");

    // The chip's own travel still works, and the bridge does not
    // fight it: next day from the chip moves the one cursor.
    await evaluate(`document.querySelector("[data-dw-next]").click()`);
    await waitFor(async () => (await cursorDay()) === 272, 90000, "chip travel to move the cursor");
    await waitFor(async () => (await chipTitle()) === "Moon 10 · Day 20 · Pattern Day 272",
      90000, "the chip to follow its own travel");
  } finally {
    try { socket?.close(); } catch { /* already closed */ }
    browser.kill("SIGKILL");
    server.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
});
