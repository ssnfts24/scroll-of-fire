"use strict";

/*
 * Temporal Worlds slice — browser proof.
 *
 * Drives the real Observatory page in headless Chromium over raw
 * CDP (the Phase B harness pattern) and proves the slice's four
 * claims:
 *   (i)   entry — crossing into a seeded day through the membrane
 *         lands Inside the day with its world and records, and
 *         crossing back out restores the Living Day stage;
 *   (ii)  the years line — shells render for the bounded range,
 *         the lived year is distinguished, and a selected day's
 *         counterparts are picked out down the line (symbol where
 *         the day holds records, bare ring where it doesn't);
 *         entering an empty year's shell lands in an honest empty
 *         year that says so;
 *   (iii) pattern lighting — farming kinds (planting, watering,
 *         harvest) light exactly the seeded days with correct
 *         counts, at year stage and on the years line;
 *   (iv)  a kind with no records lights nothing and says so.
 *
 * Skips when no Chromium is available (CHROMIUM_PATH or the usual
 * system paths), like the other sphere browser harnesses.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");

function findChromium() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function startServer() {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let filePath = path.join(root, decodeURIComponent(url.pathname));
      if (!filePath.startsWith(root)) { res.writeHead(403); res.end(); return; }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
      if (!fs.existsSync(filePath)) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "content-type": MIME[path.extname(filePath)] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    } catch {
      res.writeHead(500); res.end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

async function waitForHttp(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`evaluate failed: ${result.exceptionDetails.text} ${result.exceptionDetails.exception?.description || ""}`);
    }
    return result.result.value;
  }

  async waitFor(expression, description, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const value = await this.evaluate(expression).catch(() => undefined);
      if (value) return value;
      if (Date.now() > deadline) throw new Error(`Timed out waiting for: ${description}`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

test("Temporal Worlds: entry, the years line, and pattern lighting on the real page", { timeout: 480000 }, async (t) => {
  const chromium = findChromium();
  if (!chromium) {
    t.skip("No Chromium available (set CHROMIUM_PATH)");
    return;
  }
  const { server, port } = await startServer();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "tw-chrome-"));
  const proc = spawn(chromium, [
    "--headless=new",
    "--disable-gpu-sandbox",
    "--no-sandbox",
    "--use-angle=swiftshader",
    `--user-data-dir=${profile}`,
    "--remote-debugging-port=0",
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  proc.stderr.on("data", (chunk) => { stderr += chunk; });

  try {
    const wsPath = path.join(profile, "DevToolsActivePort");
    await (async () => {
      const deadline = Date.now() + 15000;
      while (!fs.existsSync(wsPath)) {
        if (Date.now() > deadline) throw new Error(`DevToolsActivePort never appeared. stderr: ${stderr.slice(-500)}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    })();
    const [debugPort] = fs.readFileSync(wsPath, "utf8").split("\n")[0].split(":");
    await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`);
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const pageTarget = targets.find((target) => target.type === "page");
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    const cdp = new Cdp(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    await cdp.send("Page.navigate", {
      url: `http://127.0.0.1:${port}/docs/living-time-sphere.html`,
    });

    await cdp.waitFor(
      `document.querySelectorAll(".sphere-rebuild-dock button").length === 5`,
      "the rebuild dock", 90000
    );
    await cdp.waitFor(
      `window.LivingTimeSphereExtensionHost?.isMounted?.("living-time-sphere-day-world")`,
      "the day-world adapter mounted", 120000
    );
    await cdp.waitFor(
      `Boolean(window.SOFTemporalCursor?.getCoordinate?.() && window.LivingTimeSphereDayZoom)`,
      "cursor and day-zoom ready", 90000
    );

    /* ── Seed the one record ── */
    const seeded = await cdp.evaluate(`(async () => {
      const planner = window.CodexLivingPlanner;
      const pc = window.PatternCalendar;
      const adapter = window.LivingTimeSphereDayWorldAdapter;
      const coord = window.SOFTemporalCursor.getCoordinate();
      const year = coord.remnant13Moons.patternYear;
      const todayCivil = pc.fromCivilDate({ date: new Date() }).civilDate;
      const civilFor = (y, day) => {
        const date = adapter.civilDateForPatternDay(y, day, {
          epochForYear: pc.epochForYear,
          remnantFromDate: (d) => window.SOFTemporalCoordinate.remnant13MoonsFromDate(d),
        });
        return date ? date.toISOString().slice(0, 10) : null;
      };
      const made = [];
      made.push(await planner.createPlan({ title: "Fix the gate latch", category: "task", date: todayCivil, time: "09:30" }));
      made.push(await planner.createPlan({ title: "Plant the garlic bed", category: "planting", date: todayCivil, time: "15:00" }));
      made.push(await planner.createPlan({ title: "Sow the spring peas", category: "planting", date: civilFor(year, 100) }));
      made.push(await planner.createPlan({ title: "Water the beds", category: "watering", date: civilFor(year, 110) }));
      made.push(await planner.createPlan({ title: "Cut the first greens", category: "harvest", date: civilFor(year, 120) }));
      made.push(await planner.createPlan({ title: "Plant garlic for the turning", category: "planting", date: civilFor(year, 262) }));
      window.dispatchEvent(new CustomEvent("sof:life-atlas-records-changed", { detail: { source: "temporal-worlds-test" } }));
      return {
        year,
        todayDay: coord.remnant13Moons.patternDay,
        ok: made.every((record) => record && record.id),
      };
    })()`);
    assert.equal(seeded.ok, true, "all seeds landed in the planner");
    const cursorYear = seeded.year;
    const todayDay = seeded.todayDay;


    // Camera moves in this harness fly (animated) and wait for
    // the camera to settle first: a non-animated moveTo does not
    // cancel an in-flight transition in the camera module, so a
    // snap issued mid-flight is overwritten by the flight — the
    // keeper's own zoom never hits this, but a test's instant
    // jumps can.
    const settleCamera = async () => {
      await cdp.waitFor(
        `!window.LivingTimeSphereCamera?.isAnimating?.()`,
        "the camera settled", 60000
      );
    };

    /* ── (i) Entry through the membrane ── */
    await settleCamera();
    await cdp.evaluate(`window.LivingTimeSphereRenderer3d.focusPatternDay(${todayDay}, { distance: 1.45, animated: true })`);
    await cdp.waitFor(
      `window.LivingTimeSphereDayWorldAdapter._state.stage === "living"`,
      "Living Day stage"
    );
    const livingFacts = await cdp.evaluate(`(() => {
      const adapter = window.LivingTimeSphereDayWorldAdapter;
      const crumbNow = [...document.querySelectorAll(".dw-chip-crumb-step")]
        .find((step) => step.classList.contains("dw-chip-crumb-now"))?.textContent;
      return {
        crumbNow,
        items: adapter._state.items.map((item) => item.title),
        nowBead: Boolean(adapter._state.nowBead),
      };
    })()`);
    assert.equal(livingFacts.crumbNow, "Day", "the chip names the depth at the day");
    assert.ok(livingFacts.items.includes("Fix the gate latch"), "the day's records stand in its world");
    assert.equal(livingFacts.nowBead, true,
      "today's now bead stands — the day relation reads the alignment year the records carry");

    await settleCamera();
    await cdp.evaluate(`window.LivingTimeSphereRenderer3d.focusPatternDay(${todayDay}, { distance: 1.0, animated: true })`);
    await cdp.waitFor(
      `window.LivingTimeSphereDayWorldAdapter._state.stage === "immersive"`,
      "Immersive Day stage"
    );
    const immersiveFacts = await cdp.evaluate(`(() => {
      const adapter = window.LivingTimeSphereDayWorldAdapter;
      const crumbNow = [...document.querySelectorAll(".dw-chip-crumb-step")]
        .find((step) => step.classList.contains("dw-chip-crumb-now"))?.textContent;
      return {
        crumbNow,
        membraneDirection: adapter._state.membrane.direction,
        membraneCrossed: adapter._state.membrane.lastCrossAt > 0,
        items: adapter._state.items.length,
        bubble: Boolean(adapter._state.bubble),
      };
    })()`);
    assert.equal(immersiveFacts.membraneDirection, "in", "crossing inward is the membrane's in-passage");
    assert.equal(immersiveFacts.membraneCrossed, true, "the membrane threshold played");
    assert.equal(immersiveFacts.bubble, true, "the day bubble stands around the world");
    assert.equal(immersiveFacts.crumbNow, "Inside the day", "the chip names the depth inside the day");
    assert.ok(immersiveFacts.items >= 2, "the world and its records stand in front of the keeper");

    await settleCamera();
    await cdp.evaluate(`window.LivingTimeSphereRenderer3d.focusPatternDay(${todayDay}, { distance: 1.45, animated: true })`);
    await cdp.waitFor(
      `window.LivingTimeSphereDayWorldAdapter._state.stage === "living"`,
      "back at Living Day"
    );
    const restored = await cdp.evaluate(`window.LivingTimeSphereDayWorldAdapter._state.membrane.direction`);
    assert.equal(restored, "out", "crossing back out restores the prior stage through the membrane");

    /* ── (ii) The years line ── */
    await settleCamera();
    await cdp.evaluate(`window.LivingTimeSphereCamera.moveTo({ dist: 5.2, animated: true, durationMs: 700 })`);
    await cdp.waitFor(
      `window.LivingTimeSphereDayWorldAdapter._state.stage === "years"`,
      "the years stage", 30000
    );
    await cdp.waitFor(
      `window.LivingTimeSphereDayWorldAdapter._state.years.shells.length > 0`,
      "the year shells stand", 30000
    );
    const lineFacts = await cdp.evaluate(`(() => {
      const adapter = window.LivingTimeSphereDayWorldAdapter;
      const state = adapter._state;
      const coord = window.SOFTemporalCursor.getCoordinate();
      const todayYear = coord.remnant13Moons.patternYear;
      const expected = adapter.yearsLineRange(todayYear, todayYear);
      return {
        shellYears: state.years.shells.map((shell) => shell.year),
        expected,
        livedYear: state.years.shells.find((shell) => shell.lived)?.year,
        aheadYears: state.years.shells.filter((shell) => shell.ahead).map((shell) => shell.year),
        chipVisible: !document.querySelector(".dw-chip").hidden,
        chipTitle: document.querySelector(".dw-chip-title").textContent,
        crumbNow: [...document.querySelectorAll(".dw-chip-crumb-step")]
          .find((step) => step.classList.contains("dw-chip-crumb-now"))?.textContent,
      };
    })()`);
    assert.deepEqual(lineFacts.shellYears, lineFacts.expected,
      "shells render for exactly the bounded range (Year 1 through current + 2)");
    assert.equal(lineFacts.livedYear, cursorYear, "the lived year is distinguished on the line");
    assert.deepEqual(lineFacts.aheadYears, [cursorYear + 1, cursorYear + 2],
      "the road ahead is the two years after the lived year");
    assert.equal(lineFacts.chipVisible, true, "the chip stands on the years line");
    assert.match(lineFacts.chipTitle, /^The years — /);
    assert.equal(lineFacts.crumbNow, "Years", "the chip names the depth on the line");

    // Same-day alignment: Pattern Day 262 down the line.
    await cdp.evaluate(`window.SOFTemporalCursor.setPatternDay(262, { source: "temporal-worlds-test" })`);
    await cdp.waitFor(
      `window.LivingTimeSphereDayWorldAdapter._state.years.shells.every((shell) => shell.counterpart && shell.counterpart.day === 262)`,
      "counterparts picked out down the line", 30000
    );
    const counterpartFacts = await cdp.evaluate(`(() => {
      const state = window.LivingTimeSphereDayWorldAdapter._state;
      return state.years.shells.map((shell) => ({
        year: shell.year,
        hasRecords: shell.counterpart.hasRecords,
        symbol: shell.counterpart.symbol,
      }));
    })()`);
    const livedCounterpart = counterpartFacts.find((fact) => fact.year === cursorYear);
    assert.equal(livedCounterpart.hasRecords, true, "the lived year's counterpart holds the seeded planting");
    assert.equal(livedCounterpart.symbol, "🌱", "the counterpart wears the day's own symbol");
    for (const fact of counterpartFacts) {
      if (fact.year !== cursorYear) {
        assert.equal(fact.hasRecords, false, `${fact.year} stands bare on Pattern Day 262 — the ring without a symbol`);
      }
    }

    // Entering an empty year's shell: an honest empty year. The
    // entered year is the first road-ahead year inside the
    // alignment ledger's study range (read live from the page's
    // own data, not assumed).
    const entryYear = await cdp.evaluate(`(() => {
      const supported = window.AlignmentLedgerData?.listSupportedYears?.() || [];
      const max = Math.max(...supported.map(Number).filter(Number.isFinite));
      return Math.min(${cursorYear + 2}, max);
    })()`);
    const pickShell = async (year) => cdp.evaluate(`(() => {
      const adapter = window.LivingTimeSphereDayWorldAdapter;
      const state = adapter._state;
      const proxy = state.years.proxies.find((candidate) => candidate.userData.yearsLine?.year === ${year});
      if (!proxy) return { ok: false };
      const result = adapter._extension.pick({
        raycaster: { intersectObjects: (objects) => (objects.includes(proxy) ? [{ object: proxy }] : []) },
        THREE: window.THREE,
      });
      return { ok: Boolean(result?.handled), type: result?.type };
    })()`);
    const entered = await pickShell(entryYear);
    assert.equal(entered.ok, true, "the shell pick is handled");
    assert.equal(entered.type, "years-line-enter");
    await cdp.waitFor(
      `window.SOFTemporalCursor.getCoordinate().remnant13Moons.patternYear === ${entryYear}`,
      "the cursor stands in the entered year", 30000
    );
    await cdp.waitFor(
      `Boolean(window.LivingTimeSphereDayWorldAdapter._state.notice)`,
      "the empty year says so", 30000
    );
    const noticeText = await cdp.evaluate(`window.LivingTimeSphereDayWorldAdapter._state.notice.text`);
    assert.match(noticeText, /the calendar is real; nothing is recorded there yet/);

    // Return to the lived year and back onto the line.
    await cdp.evaluate(`window.SOFTemporalCursor.setDate(new Date())`);
    await cdp.waitFor(
      `window.SOFTemporalCursor.getCoordinate().remnant13Moons.patternYear === ${cursorYear}`,
      "back in the lived year", 30000
    );
    await settleCamera();
    await cdp.evaluate(`window.LivingTimeSphereCamera.moveTo({ dist: 5.2, animated: true, durationMs: 700 })`);
    await cdp.waitFor(
      `window.LivingTimeSphereDayWorldAdapter._state.stage === "years" && window.LivingTimeSphereDayWorldAdapter._state.years.proxies.length > 0`,
      "the line stands again", 30000
    );

    // The furthest shell stands beyond the ledger's study range:
    // its calendar is real and its record counts, but the face
    // cannot stand there — the pick says so and the cursor does
    // not move. (If the ledger's range has grown past it, this
    // phase instead enters it like any other year.)
    const rangeFacts = await cdp.evaluate(`(() => {
      const supported = window.AlignmentLedgerData?.listSupportedYears?.() || [];
      const state = window.LivingTimeSphereDayWorldAdapter._state;
      return {
        maxSupported: Math.max(...supported.map(Number).filter(Number.isFinite)),
        shells: state.years.shells.map((shell) => ({ year: shell.year, enterable: shell.enterable })),
      };
    })()`);
    const beyondShell = rangeFacts.shells.find((shell) => shell.year > rangeFacts.maxSupported);
    if (beyondShell) {
      assert.equal(beyondShell.enterable, false, "the beyond-range shell is marked not enterable");
      await pickShell(beyondShell.year);
      await cdp.waitFor(
        `Boolean(window.LivingTimeSphereDayWorldAdapter._state.notice?.text?.includes("alignment ledger studies"))`,
        "the beyond-range year explains itself", 30000
      );
      const stillYear = await cdp.evaluate(`window.SOFTemporalCursor.getCoordinate().remnant13Moons.patternYear`);
      assert.equal(stillYear, cursorYear, "the cursor did not move into a year the face cannot hold");
      const chipLine = await cdp.evaluate(`document.querySelector(".dw-chip-line").textContent`);
      assert.match(chipLine, /alignment ledger studies/, "the chip speaks the refusal plainly on the line");
    }

    /* ── (iii) Pattern lighting: the farm kinds ── */
    await cdp.evaluate(`document.querySelector(".dw-door-btn").click()`);
    await cdp.waitFor(
      `window.LivingTimeSphereDayWorldAdapter._state.patterns.index !== null`,
      "the pattern index reads the record", 30000
    );
    await cdp.evaluate(`(() => {
      const row = [...document.querySelectorAll(".dw-pattern-kind")]
        .find((candidate) => candidate.textContent.includes("Watering"));
      row.click();
    })()`);
    await cdp.waitFor(
      `window.LivingTimeSphereDayWorldAdapter._state.patterns.lit.length === 1`,
      "watering lights its one day", 30000
    );
    const wateringFacts = await cdp.evaluate(`(() => {
      const state = window.LivingTimeSphereDayWorldAdapter._state;
      return {
        lit: state.patterns.lit.map((litDay) => \`\${litDay.year}:\${litDay.day}\`),
        result: document.querySelector(".dw-pattern-result").textContent,
        overlay: Boolean(state.patterns.overlayGroup),
      };
    })()`);
    assert.deepEqual(wateringFacts.lit, [`${cursorYear}:110`], "watering lights exactly the seeded watering day");
    assert.match(wateringFacts.result, /1 day holds it/);
    assert.match(wateringFacts.result, /a count of days, nothing more claimed/);
    assert.equal(wateringFacts.overlay, true, "the lit day glows on the faced year");

    await cdp.evaluate(`(() => {
      const row = [...document.querySelectorAll(".dw-pattern-kind-all")]
        .find((candidate) => candidate.textContent.includes("Farm & home"));
      row.click();
    })()`);
    await cdp.waitFor(
      `window.LivingTimeSphereDayWorldAdapter._state.patterns.lit.length === 5`,
      "the farm group lights its five days", 30000
    );
    const farmFacts = await cdp.evaluate(`(() => {
      const state = window.LivingTimeSphereDayWorldAdapter._state;
      return {
        lit: state.patterns.lit.map((litDay) => \`\${litDay.year}:\${litDay.day}\`),
      };
    })()`);
    assert.deepEqual(farmFacts.lit, [
      `${cursorYear}:100`, `${cursorYear}:110`, `${cursorYear}:120`, `${cursorYear}:${todayDay}`, `${cursorYear}:262`,
    ], "planting, watering, and harvest light exactly the seeded farm days (today's garlic bed among them)");

    // The same lighting down the years line.
    await settleCamera();
    await cdp.evaluate(`window.LivingTimeSphereCamera.moveTo({ dist: 5.2, animated: true, durationMs: 700 })`);
    await cdp.waitFor(
      `window.LivingTimeSphereDayWorldAdapter._state.stage === "years"`,
      "back on the years line", 30000
    );
    await cdp.waitFor(
      `window.LivingTimeSphereDayWorldAdapter._state.years.shells.find((shell) => shell.year === ${cursorYear})?.litCount === 5`,
      "the farm pattern lit down the line", 30000
    );
    const shellLit = await cdp.evaluate(`(() => {
      const state = window.LivingTimeSphereDayWorldAdapter._state;
      return state.years.shells.map((shell) => ({ year: shell.year, litCount: shell.litCount }));
    })()`);
    for (const shell of shellLit) {
      assert.equal(shell.litCount, shell.year === cursorYear ? 5 : 0,
        `shell ${shell.year} carries exactly its own lit days`);
    }

    /* ── (iv) A kind with no records lights nothing and says so ── */
    await cdp.evaluate(`(() => {
      if (document.querySelector(".dw-patterns").hidden) {
        document.querySelector(".dw-door-btn").click();
      }
    })()`);
    await cdp.waitFor(
      `!document.querySelector(".dw-patterns").hidden`,
      "the patterns panel stands open", 30000
    );
    await cdp.evaluate(`(() => {
      const row = [...document.querySelectorAll(".dw-pattern-kind")]
        .find((candidate) => candidate.textContent.includes("Travel"));
      row.click();
    })()`);
    await cdp.waitFor(
      `document.querySelector(".dw-pattern-result").textContent.includes("Nothing is lit, because nothing is recorded")`,
      "the empty kind says so", 30000
    );
    const travelFacts = await cdp.evaluate(`(() => {
      const state = window.LivingTimeSphereDayWorldAdapter._state;
      return {
        lit: state.patterns.lit.length,
        overlay: Boolean(state.patterns.overlayGroup),
        result: document.querySelector(".dw-pattern-result").textContent,
      };
    })()`);
    assert.equal(travelFacts.lit, 0, "travel lights nothing — no travel is recorded");
    assert.equal(travelFacts.overlay, false, "no overlay stands when nothing is lit");
    assert.match(travelFacts.result, /No days hold travel/);
  } finally {
    proc.kill("SIGKILL");
    server.close();
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
