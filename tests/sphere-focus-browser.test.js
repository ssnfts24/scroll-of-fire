"use strict";

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

async function waitFor(check, timeout = 15000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await check()) return;
    await delay(150);
  }
  throw new Error("Timed out waiting for the browser state");
}

test("Sphere Focus browser interactions across responsive viewports", async (t) => {
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "sof-sphere-focus-"));
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
    await waitFor(() => fs.existsSync(activePortPath));
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
      }, 20000).unref();
    });
    const evaluate = async (expression) => {
      const result = await call("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || "Browser evaluation failed");
      }
      return result.result.value;
    };
    const captureScreenshot = async (filename) => {
      if (!process.env.COPILOT_ARTIFACTS_DIR) return;
      const { data } = await call("Page.captureScreenshot", { format: "png", fromSurface: true });
      fs.mkdirSync(process.env.COPILOT_ARTIFACTS_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(process.env.COPILOT_ARTIFACTS_DIR, filename),
        Buffer.from(data, "base64")
      );
    };
    const viewport = async (width, height, mobile = true) => {
      await call("Emulation.setDeviceMetricsOverride", {
        width, height, deviceScaleFactor: 1, mobile,
      });
      await call("Emulation.setTouchEmulationEnabled", {
        enabled: mobile,
        maxTouchPoints: 1,
      });
    };
    const click = async (selector) => evaluate(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`
    );
    const keyboard = async (key) => {
      const keys = { Escape: 27, Tab: 9 };
      await call("Input.dispatchKeyEvent", {
        type: "keyDown",
        key,
        code: key,
        windowsVirtualKeyCode: keys[key],
      });
      await call("Input.dispatchKeyEvent", {
        type: "keyUp",
        key,
        code: key,
        windowsVirtualKeyCode: keys[key],
      });
    };

    await call("Page.enable");
    await call("Runtime.enable");
    await call("Page.addScriptToEvaluateOnNewDocument", {
      source: `localStorage.setItem("sof.spark.v1", JSON.stringify({
        seed: "spark1-8-216-1-ab12cd34",
        name: "Browser test Spark"
      }));`,
    });
    await viewport(390, 844);
    await call("Page.navigate", {
      url: `http://127.0.0.1:${sitePort}/docs/living-time-sphere.html`,
    });
    await waitFor(async () => evaluate(
      `document.querySelectorAll(".sphere-rebuild-dock button").length === 5 && !!document.querySelector(".sphere-more-actions")`
    ), 60000);

    const primary = await evaluate(
      `Array.from(document.querySelectorAll(".sphere-rebuild-dock button")).map((button) => button.textContent.trim())`
    );
    assert.deepEqual(primary, ["Today", "Schedule", "Day Details", "Your Spark", "More"]);
    assert.equal(await evaluate(`document.body.classList.contains("sphere-app")`), false);

    await click("[data-sphere-rebuild-daydetails]");
    await waitFor(async () => evaluate(
      `document.documentElement.classList.contains("armillary-rooms-open") && document.querySelector(".sphere-sidebar").getAttribute("aria-modal") === "true"`
    ));
    await waitFor(async () => evaluate(
      `Math.abs(document.querySelector(".sphere-sidebar").getBoundingClientRect().bottom - innerHeight) < 1`
    ));
    await captureScreenshot("sphere-focus-mobile-day-details.png");
    assert.equal(await evaluate(`document.querySelector(".sphere-sidebar").contains(document.activeElement)`), true);
    await keyboard("Tab");
    assert.equal(await evaluate(`document.querySelector(".sphere-sidebar").contains(document.activeElement)`), true);
    await keyboard("Escape");
    await waitFor(async () => evaluate(
      `!document.documentElement.classList.contains("armillary-rooms-open")`
    ));
    assert.equal(await evaluate(`document.activeElement.getAttribute("data-sphere-rebuild-daydetails")`), "");

    await click('[data-sphere-rebuild-daydetails]');
    await delay(420);
    await click(".sphere-rooms-backdrop");
    await waitFor(async () => evaluate(
      `!document.documentElement.classList.contains("armillary-rooms-open")`
    ));

    await click("[data-sphere-rebuild-daydetails]");
    await delay(420);
    assert.equal(await evaluate(`(() => {
      const handle = document.querySelector(".sphere-sheet-handle");
      const y = handle.getBoundingClientRect().top + 2;
      handle.dispatchEvent(new PointerEvent("pointerdown", {
        pointerId: 1, pointerType: "touch", clientY: y, bubbles: true
      }));
      handle.dispatchEvent(new PointerEvent("pointerup", {
        pointerId: 1, pointerType: "touch", clientY: y + 80, bubbles: true
      }));
      return !document.documentElement.classList.contains("armillary-rooms-open");
    })()`), true, "a touch-pointer swipe dismisses the sheet");

    for (const [width, height] of [
      [320, 740],
      [390, 844],
      [768, 1024],
      [844, 390],
      [1024, 768],
      [1440, 900],
    ]) {
      await viewport(width, height, width < 900);
      await click("[data-sphere-rebuild-daydetails]");
      await waitFor(async () => evaluate(`(() => {
        const rect = document.querySelector(".sphere-sidebar").getBoundingClientRect();
        return innerWidth >= 900
          ? Math.abs(rect.right - innerWidth) < 1
          : Math.abs(rect.bottom - innerHeight) < 1;
      })()`), 5000);
      const panel = await evaluate(`(() => {
        const element = document.querySelector(".sphere-sidebar");
        const rect = element.getBoundingClientRect();
        return {
          width: innerWidth,
          height: innerHeight,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          panelWidth: rect.width,
          panelHeight: rect.height,
          maxHeight: getComputedStyle(element).maxHeight,
          transform: getComputedStyle(element).transform,
          transitionDuration: getComputedStyle(element).transitionDuration,
          scrollWidth: document.documentElement.scrollWidth
        };
      })()`);
      assert.ok(
        panel.left >= -1 && panel.right <= width + 1,
        `${width}px panel stays inside viewport: ${JSON.stringify(panel)}`
      );
      assert.ok(
        panel.top >= -1 && panel.bottom <= height + 1,
        `${width}px panel stays inside viewport height: ${JSON.stringify(panel)}`
      );
      assert.ok(panel.scrollWidth <= width + 1, `${width}px layout has no horizontal overflow`);
      if (width >= 900) {
        assert.ok(panel.panelWidth <= width * 0.45 + 1, `${width}px desktop inspector is a side panel`);
        assert.equal(panel.maxHeight, "none");
        if (width === 1440) await captureScreenshot("sphere-focus-desktop-day-details.png");
      }
      await keyboard("Escape");
      await waitFor(async () => evaluate(
        `!document.documentElement.classList.contains("armillary-rooms-open")`
      ));
    }

    await viewport(390, 844);
    await click("[data-sphere-rebuild-spark]");
    await waitFor(async () => evaluate(
      `document.activeElement.id === "sphere-spark-talk-input"`
    ), 15000).catch(async (error) => {
      const state = await evaluate(`(() => ({
        active: document.activeElement?.id,
        talk: !!document.querySelector("[data-sphere-spark-talk]"),
        input: document.querySelector("[data-sphere-spark-talk] input, [data-sphere-spark-talk] textarea")?.id,
        open: document.documentElement.classList.contains("armillary-rooms-open"),
        sidebar: !!document.querySelector(".sphere-sidebar")
      }))()`);
      throw new Error(`${error.message}: ${JSON.stringify(state)}`);
    });
    await waitFor(async () => evaluate(`(() => {
      const rect = document.querySelector("[data-sphere-spark-talk]").getBoundingClientRect();
      return rect.bottom > 0 && rect.top < innerHeight;
    })()`), 5000).catch(async (error) => {
      const state = await evaluate(`(() => {
        const talk = document.querySelector("[data-sphere-spark-talk]");
        const panel = document.querySelector(".sphere-sidebar");
        const rect = talk.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        return {
          talkTop: rect.top, talkBottom: rect.bottom,
          panelTop: panelRect.top, panelBottom: panelRect.bottom,
          scrollTop: panel.scrollTop, scrollHeight: panel.scrollHeight,
          active: document.activeElement?.id
        };
      })()`);
      throw new Error(`${error.message}: ${JSON.stringify(state)}`);
    });
    const sparkState = await evaluate(`(() => {
      const talk = document.querySelector("[data-sphere-spark-talk]");
      return {
        insideRooms: document.querySelector(".sphere-sidebar").contains(talk),
        focused: document.activeElement.id,
        privacy: !!talk.querySelector(".sphere-spark-talk-privacy"),
        visible: talk.getBoundingClientRect().bottom > 0 && talk.getBoundingClientRect().top < innerHeight
      };
    })()`);
    assert.deepEqual(sparkState, {
      insideRooms: true,
      focused: "sphere-spark-talk-input",
      privacy: true,
      visible: true,
    });
    await keyboard("Escape");

    await click(".sphere-rebuild-dock button:last-child");
    await waitFor(async () => evaluate(
      `document.documentElement.classList.contains("armillary-rooms-open")`
    ));
    const secondary = await evaluate(`(() => {
      const room = document.querySelector(".sphere-sidebar");
      return {
        dayWorld: !!room.querySelector("[data-sphere-rebuild-dayworld]"),
        deepTime: !!room.querySelector("[data-sphere-rebuild-deeptime]"),
        farm: !!room.querySelector("[data-sphere-rebuild-farm]"),
        freeze: !!room.querySelector("[data-sphere-rebuild-freeze]"),
        play: !!document.querySelector(".sphere-play-bar-toggle"),
        cameras: ["sphere-cam-pattern", "sphere-cam-passage", "sphere-cam-years"].every((id) => !!room.querySelector("#" + id)),
        atlas: !!room.querySelector("#calendar-workbench"),
        settings: !!room.querySelector(".sphere-controls-bar"),
        fullscreen: Array.from(room.querySelectorAll("button")).some((button) => /full.?screen/i.test(button.textContent + button.id + button.getAttribute("aria-label")))
      };
    })()`);
    for (const [action, present] of Object.entries(secondary)) {
      assert.equal(present, true, `${action} stays available behind More`);
    }
    await keyboard("Escape");

    await click(".sphere-play-bar-toggle");
    assert.equal(await evaluate(
      `document.querySelector(".sphere-play-bar-toggle").getAttribute("aria-expanded")`
    ), "true");
    await click(".sphere-play-bar-toggle");
    assert.equal(await evaluate(
      `document.querySelector(".sphere-play-bar-toggle").getAttribute("aria-expanded")`
    ), "false");

    await click("[data-sphere-rebuild-schedule]");
    await waitFor(async () => evaluate(
      `document.querySelector("#living-planner-modal")?.getAttribute("aria-hidden") === "false"`
    ));
    await click("#living-planner-close");
    await waitFor(async () => evaluate(
      `document.querySelector("#living-planner-modal")?.getAttribute("aria-hidden") !== "false"`
    ));

    await click(".sphere-rebuild-dock button:last-child");
    await waitFor(async () => evaluate(
      `document.documentElement.classList.contains("armillary-rooms-open")`
    ));
    // The Calendar Atlas is wired by the page's deferred-tools
    // loader (phased, idle-scheduled; living-time-sphere.html),
    // which lands well after first paint on a slow box. Wait for
    // its ready flag before knocking on the Atlas door.
    await waitFor(async () => evaluate(
      `globalThis.__SOF_SPHERE_DEFERRED_TOOLS_READY__ === true`
    ), 120000);
    await waitFor(async () => evaluate(`!!document.querySelector("#calendar-atlas-open")`));
    assert.equal(await click("#calendar-atlas-open"), true);
    await waitFor(async () => evaluate(
      `document.querySelector("#calendar-atlas-modal")?.getAttribute("aria-hidden") === "false"`
    ));
    await click("#calendar-atlas-close");
    await waitFor(async () => evaluate(
      `document.querySelector("#calendar-atlas-modal")?.hidden === true`
    ));

    for (const selector of ["#sphere-cam-pattern", "#sphere-cam-passage", "#sphere-cam-years"]) {
      assert.equal(await click(selector), true, `${selector} is operable in More`);
    }

    const freezeButton = "[data-sphere-rebuild-freeze]";
    await click(freezeButton);
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(freezeButton)}).getAttribute("aria-pressed")`), "true");
    await click(freezeButton);
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(freezeButton)}).getAttribute("aria-pressed")`), "false");
    await keyboard("Escape");

    await click(".sphere-rebuild-dock button:last-child");
    await waitFor(async () => evaluate(
      `document.documentElement.classList.contains("armillary-rooms-open")`
    ));
    await click(".sphere-mode-toggle");
    assert.equal(await evaluate(`document.documentElement.classList.contains("sphere-full-page")`), true);
    await click(".sphere-mode-toggle");
    assert.equal(await evaluate(`document.documentElement.classList.contains("sphere-full-page")`), false);

    await call("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    await click("[data-sphere-rebuild-daydetails]");
    const reducedMotion = await evaluate(
      `getComputedStyle(document.querySelector(".sphere-sidebar")).transitionDuration`
    );
    assert.equal(reducedMotion, "0s");
  } finally {
    try { await call("Browser.close"); } catch { browser.kill("SIGTERM"); }
    await new Promise((resolve) => {
      if (browser.exitCode !== null) return resolve();
      const timer = setTimeout(resolve, 2000);
      browser.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    try { socket?.close(); } catch { /* browser may already have exited */ }
    server.close();
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
