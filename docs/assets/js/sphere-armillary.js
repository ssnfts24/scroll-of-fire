/* sphere-armillary.js — Sphere redesign (armillary face), page layer.
 *
 * Four jobs, all presentation and plumbing — no calendar math of
 * its own (PatternCalendar and the canonical pipeline stay the
 * only authority; this module reads what they publish):
 *
 *  1. The warm portrait's handoff: the portrait still is in the
 *     page from the first paint; this watches the renderer's own
 *     diagnostics and fades the portrait out the moment the live
 *     instrument reports its first rendered frame.
 *  2. The app shell (Aaron, Nov 20, 2026: no endless scrolling):
 *     the page locks to the viewport — top line, the Sphere, one
 *     dock — and everything else moves into the one rooms sheet
 *     (the sidebar the rebuild already keeps), which scrolls
 *     inside itself and never takes the page with it. Technical
 *     diagnostics fold behind one plainly labeled door, closed
 *     by default.
 *  3. The on-sphere readout: the selected day's coordinate and
 *     telling, on the instrument, with the day's two actions —
 *     "Enter this day" and "Schedule something for this day".
 *  4. The record on the face, and the Spark's alert: days with
 *     plans in the keeper's own record get a gem on the Sphere's
 *     rail (through the renderer's setRecordMarkers), and when a
 *     scheduled time comes, the Spark's invitation appears at the
 *     Sphere's edge — once per plan, kept on this device.
 */
(function () {
  "use strict";

  /* ── 1. The portrait handoff ─────────────────────────────────── */

  var PORTRAIT_FADE_MS = 650;
  var HARD_CAP_MS = 30000;

  function portraitHandoff() {
    var img = document.querySelector("[data-sphere-portrait]");
    if (!img) return;
    var done = false;
    function reveal() {
      if (done) return;
      done = true;
      img.classList.add("is-live");
      window.setTimeout(function () { img.style.display = "none"; }, PORTRAIT_FADE_MS);
    }
    var startedAt = Date.now();
    var timer = window.setInterval(function () {
      var renderer = window.LivingTimeSphereRenderer3d;
      var diag = null;
      try { diag = renderer && renderer.getDiagnostics ? renderer.getDiagnostics() : null; } catch (err) { diag = null; }
      if (diag && diag.stageState && diag.stageState.firstFrame === "rendered") {
        window.clearInterval(timer);
        reveal();
        return;
      }
      if (document.querySelector("#sphere-container svg.living-time-sphere-svg")) {
        window.clearInterval(timer);
        reveal();
        return;
      }
      if (Date.now() - startedAt > HARD_CAP_MS) {
        window.clearInterval(timer);
        reveal();
      }
    }, 200);
    img.addEventListener("error", reveal);
  }

  /* ── shared reads ────────────────────────────────────────────── */

  function stripText() {
    var strip = document.getElementById("sphere-state-strip");
    return strip ? (strip.textContent || "").trim().replace(/\s+/g, " ") : "";
  }

  function selectedPosition() {
    var m = stripText().match(/Moon (\d+) · Day (\d+) · Day (\d+)\/364/);
    if (!m) return null;
    return { moon: Number(m[1]), day: Number(m[2]), dayOfPatternYear: Number(m[3]) };
  }

  function sparkName() {
    try {
      var c = window.SparkCompanion;
      var s = (c && ((c.getCompanion && c.getCompanion()) || (c.getState && c.getState()) || c.companion)) || null;
      if (s && typeof s.name === "string" && s.name) return s.name;
    } catch (err) { /* the name is a courtesy */ }
    return "Your Spark";
  }

  /* ── 2. The app shell ────────────────────────────────────────── */

  var shellBuilt = false;
  function buildAppShell() {
    if (shellBuilt) return true;
    if (document.body.classList.contains("sphere-app")) return true; // the Living Day shell frames the page itself
    var main = document.getElementById("main") || document.querySelector("main.sphere-page");
    var sidebar = document.querySelector(".sphere-sidebar");
    var dock = document.querySelector(".sphere-rebuild-dock");
    if (!main || !sidebar || !dock) return false; // the rebuild shell is still booting; the caller retries
    shellBuilt = true;
    document.documentElement.classList.add("armillary-app");

    // The one rooms sheet gets a bar: its name, the way back, and
    // the site links (the site header stands down in app mode).
    var bar = document.createElement("div");
    bar.className = "sphere-sheet-bar";
    bar.innerHTML =
      '<span class="sphere-sheet-title">Rooms</span>' +
      '<nav class="sphere-sheet-links" aria-label="Site">' +
      '<a href="index.html">Home</a><a href="moons.html">13 Moons</a><a href="downloads.html">Downloads</a>' +
      "</nav>" +
      '<button type="button" class="sphere-sheet-close">Back to the Sphere</button>';
    sidebar.insertBefore(bar, sidebar.firstChild);
    bar.querySelector(".sphere-sheet-close").addEventListener("click", function () {
      document.documentElement.classList.remove("armillary-rooms-open");
    });

    // Everything that is not the stage, the telling line, or the
    // dock moves into the one sheet, in the page's own order —
    // a sweep, not a list, so no leftover piece (the Ambient
    // welcome veil included) can stand in the frame or over the
    // instrument. Two things stay at the top level by design:
    // the planner modal and the command window are fixed
    // overlays with their own lives, and a transformed sheet
    // would trap their positioning.
    var keep = function (el) {
      return el === sidebar || el === dock ||
        el.classList.contains("sphere-wrapper") ||
        el.classList.contains("sphere-rebuild-caption") ||
        el.id === "living-planner-modal" ||
        el.id === "living-command-window" ||
        el.tagName === "SCRIPT" || el.tagName === "TEMPLATE";
    };
    var sweeping = false;
    var sweep = function () {
      if (sweeping) return;
      sweeping = true;
      Array.prototype.slice.call(main.children).forEach(function (el) {
        if (keep(el)) return;
        el.classList.add("sphere-sheet-room");
        sidebar.appendChild(el);
      });
      sweeping = false;
    };
    sweep();
    // The sweep stands guard: pieces that wake late (the Ambient
    // welcome, the Spark's talk room, the play room) arrive in
    // main on their own clocks, and each belongs in the sheet the
    // moment it lands — never standing in the frame, never over
    // the instrument.
    new MutationObserver(sweep).observe(main, { childList: true });
    // The guided introduction lives inside the stage wrapper;
    // it joins the sheet as a room of its own.
    var intro = document.getElementById("sphere-intro");
    if (intro && intro.parentElement !== sidebar) {
      intro.classList.add("sphere-sheet-room");
      sidebar.appendChild(intro);
    }

    // Coherence (Aaron, Nov 20, 2026): the old observatory guide
    // bar (Today / Moon chooser / Go / Selected day / Whole year /
    // Share / Full screen / Rest) is a second control system
    // living on the same surface as the dock. It folds into the
    // one sheet as the Guide room — every function it carries
    // stays reachable in exactly one place, and the surface
    // keeps only the dock and the on-sphere readout. The legend
    // folds with it. Both are swept whenever they appear: the
    // companion layer mounts its bar on its own clock.
    var canvasWrap = document.querySelector(".sphere-canvas-wrap");
    if (canvasWrap) {
      var sweepWrap = function () {
        [".sphere-guide-bar", "#sphere-legend"].forEach(function (sel) {
          var el = canvasWrap.querySelector(sel);
          if (el) {
            el.classList.add("sphere-sheet-room");
            sidebar.appendChild(el);
          }
        });
      };
      sweepWrap();
      new MutationObserver(sweepWrap).observe(canvasWrap, { childList: true });
    }

    // Technical material leaves the visitor surface: the two
    // diagnostics sections and the methods section fold behind
    // one plainly labeled door, closed by default.
    var techBits = [];
    document.querySelectorAll(".sphere-diagnostics-section").forEach(function (el) { techBits.push(el); });
    var methods = document.querySelector('section[aria-labelledby="sphereMethodsHeading"]');
    if (methods) techBits.push(methods);
    if (techBits.length) {
      var door = document.createElement("details");
      door.className = "sphere-technical-door";
      var summary = document.createElement("summary");
      summary.textContent = "Technical details";
      door.appendChild(summary);
      sidebar.appendChild(door);
      techBits.forEach(function (el) { door.appendChild(el); });
    }

    // The doors open the sheet (capture: before the rebuild's own
    // handlers scroll the room into view inside it).
    function openSheet() { document.documentElement.classList.add("armillary-rooms-open"); }
    ["dayworld", "deeptime", "farm", "spark"].forEach(function (doorName) {
      var btn = dock.querySelector("[data-sphere-rebuild-" + doorName + "]");
      if (btn) btn.addEventListener("click", openSheet, true);
    });

    // One quiet way to everything else, at the end of the
    // telling line.
    var caption = document.querySelector(".sphere-rebuild-caption");
    if (caption) {
      var tools = document.createElement("button");
      tools.type = "button";
      tools.className = "sphere-all-tools";
      tools.textContent = "All tools";
      tools.addEventListener("click", function () {
        openSheet();
        sidebar.scrollTop = 0;
      });
      caption.appendChild(tools);
    }
    return true;
  }

  /* ── 3. The on-sphere readout ────────────────────────────────── */

  function buildReadout() {
    var wrap = document.querySelector(".sphere-canvas-wrap") || document.getElementById("sphere-container")?.parentElement;
    if (!wrap) return;
    var card = document.createElement("div");
    card.className = "sphere-day-readout";
    card.setAttribute("aria-live", "polite");
    card.innerHTML =
      '<p class="sphere-day-readout-where"></p>' +
      '<p class="sphere-day-readout-telling"></p>' +
      '<div class="sphere-day-readout-actions">' +
      '<button type="button" class="sphere-day-readout-enter">Enter this day</button>' +
      '<button type="button" class="sphere-day-readout-schedule">Schedule something for this day</button>' +
      "</div>";
    wrap.appendChild(card);
    card.querySelector(".sphere-day-readout-enter").addEventListener("click", function () {
      // Stand on the chosen day first (the quick-jump flies the
      // Sphere to it), then step in — so the Day World that opens
      // is the chosen day's, not today's.
      var pos = selectedPosition();
      var btn = document.querySelector("[data-sphere-rebuild-dayworld]");
      if (pos && window.SphereRebuild && window.SphereRebuild.showDay({ patternDay: pos.dayOfPatternYear })) {
        window.setTimeout(function () { if (btn) btn.click(); }, 900);
      } else if (btn) {
        btn.click();
      } else if (window.SphereRebuild) {
        window.SphereRebuild.openDayWorld();
      }
    });
    card.querySelector(".sphere-day-readout-schedule").addEventListener("click", function () {
      if (window.SphereRebuild) window.SphereRebuild.openSchedule();
    });

    var where = card.querySelector(".sphere-day-readout-where");
    var telling = card.querySelector(".sphere-day-readout-telling");
    function render() {
      var pos = selectedPosition();
      if (!pos) {
        where.textContent = stripText() || "The Sphere is waking up.";
        telling.textContent = "";
        return;
      }
      var data = window.PatternCalendarData || {};
      var moonName = (data.moons && data.moons[pos.moon - 1] && data.moons[pos.moon - 1].name) || "";
      var archetype = (data.dayArchetypes && data.dayArchetypes[(pos.day - 1) % 28] && data.dayArchetypes[(pos.day - 1) % 28][0]) || "";
      where.textContent = "Moon " + pos.moon + " · Day " + pos.day + " · Pattern Day " + pos.dayOfPatternYear + " of 364";
      telling.textContent = archetype ? moonName + " — " + archetype : moonName;
    }
    render();
    var strip = document.getElementById("sphere-state-strip");
    if (strip) new MutationObserver(render).observe(strip, { childList: true, subtree: true, characterData: true });
    window.setInterval(render, 4000);
  }

  /* ── 3b. The Day World's doorway scene (cartoon exploration
   * pass): the room is built when a keeper first steps in, so the
   * scene is set at its head the moment the room exists — a door
   * ajar in its ring, for the room that is a day's inside. ────── */

  function dressDayWorld() {
    var sheet = document.querySelector(".day-world-sheet");
    if (!sheet || sheet.querySelector(".day-world-scene")) return;
    var fig = document.createElement("figure");
    fig.className = "day-world-scene";
    var img = document.createElement("img");
    img.src = "assets/img/cartoon/cartoon-day-door.webp";
    img.width = 1200;
    img.height = 675;
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = "Cartoon scene: a wooden door with brass fittings standing ajar in a circular ring, warm light spilling out and a Spark's glow at the threshold — the door into one day.";
    fig.appendChild(img);
    sheet.insertBefore(fig, sheet.firstChild);
  }

  function watchDayWorld() {
    dressDayWorld();
    new MutationObserver(dressDayWorld).observe(document.body, { childList: true, subtree: true });
  }

  /* ── 4. The record on the face + the Spark's alert ───────────── */

  function planPatternDay(rec) {
    var n = Number((rec && (rec.patternDay ?? (rec.temporal && (rec.temporal.patternDay ?? rec.temporal.dayOfPatternYear)))) || 0);
    return n >= 1 && n <= 364 ? n : null;
  }
  function planCivil(rec) {
    return (rec && (rec.civilDate || (rec.temporal && rec.temporal.civilDate) || rec.date)) || null;
  }
  function planTime(rec) {
    return (rec && (rec.time || (rec.temporal && rec.temporal.time))) || null;
  }

  async function refreshRecordMarkers() {
    var planner = window.CodexLivingPlanner;
    var renderer = window.LivingTimeSphereRenderer3d;
    if (!planner || !renderer || !renderer.setRecordMarkers) return;
    try {
      var year = Number(window.LivingTimeSphereUi?.getSphereDiagnostics?.().selectedYear) || new Date().getFullYear();
      var plans = await planner.plansForYear(year);
      var days = [];
      (plans || []).forEach(function (rec) {
        var d = planPatternDay(rec);
        if (d) days.push(d);
      });
      renderer.setRecordMarkers(days);
    } catch (err) { /* the record is the keeper's; silence is honest */ }
  }

  function showSparkAlert(plan) {
    if (document.querySelector(".sphere-spark-alert")) return;
    var chip = document.createElement("div");
    chip.className = "sphere-spark-alert";
    chip.setAttribute("role", "status");
    var when = planTime(plan);
    chip.innerHTML =
      '<p class="sphere-spark-alert-text"></p>' +
      '<button type="button" class="sphere-spark-alert-close" aria-label="Dismiss">×</button>';
    chip.querySelector(".sphere-spark-alert-text").textContent =
      sparkName() + ": " + (plan.title || "Something you planned") + (when ? " — set for " + when : " — set for today");
    chip.querySelector(".sphere-spark-alert-close").addEventListener("click", function () { chip.remove(); });
    document.body.appendChild(chip);
    window.setTimeout(function () { chip.remove(); }, 30000);
  }

  async function checkSparkAlerts() {
    var planner = window.CodexLivingPlanner;
    if (!planner || !planner.upcomingPlans) return;
    try {
      var plans = await planner.upcomingPlans({ limit: 32 });
      var now = new Date();
      var todayIso = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
      var alerted = {};
      try { alerted = JSON.parse(window.localStorage.getItem("sof.armillary.alerted") || "{}"); } catch (err) { alerted = {}; }
      (plans || []).forEach(function (plan) {
        if (!plan || planCivil(plan) !== todayIso || plan.completed) return;
        var time = planTime(plan) || "09:00";
        var parts = String(time).split(":");
        var due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(parts[0] || 9), Number(parts[1] || 0));
        var key = String(plan.id || plan.title || "plan") + "@" + todayIso;
        if (now >= due && !alerted[key]) {
          alerted[key] = 1;
          try { window.localStorage.setItem("sof.armillary.alerted", JSON.stringify(alerted)); } catch (err) { /* private mode */ }
          showSparkAlert(plan);
        }
      });
    } catch (err) { /* alerts are an invitation, never an error surface */ }
  }

  function startRecordAndAlerts() {
    var tries = 0;
    var wait = window.setInterval(function () {
      tries += 1;
      if (window.CodexLivingPlanner && window.LivingTimeSphereRenderer3d) {
        window.clearInterval(wait);
        refreshRecordMarkers();
        checkSparkAlerts();
        window.setInterval(checkSparkAlerts, 30000);
        window.setInterval(refreshRecordMarkers, 120000);
      } else if (tries > 120) {
        window.clearInterval(wait);
      }
    }, 500);
    document.addEventListener("sof:life-atlas-records-changed", function () {
      refreshRecordMarkers();
      checkSparkAlerts();
    });
  }

  /* ── boot ────────────────────────────────────────────────────── */

  function init() {
    portraitHandoff();
    if (!buildAppShell()) {
      var tries = 0;
      var wait = window.setInterval(function () {
        tries += 1;
        if (buildAppShell() || tries > 40) window.clearInterval(wait);
      }, 400);
    }
    buildReadout();
    watchDayWorld();
    startRecordAndAlerts();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
