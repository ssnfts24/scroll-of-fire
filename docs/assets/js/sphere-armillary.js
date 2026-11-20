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
    // The frame is CSS from the first paint now, but a keeper
    // may have scrolled the unframed page during a slow load
    // (his phone did — the two screenshots sit at two offsets).
    // Standing the shell also stands the page back at its top,
    // where the lock then holds it.
    try { window.scrollTo(0, 0); } catch (err) { /* the lock holds regardless */ }

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
    // folds with it.
    // CORRECTIVE (Nov 20, 09:11 PST): the first sweep searched
    // only the canvas wrap — but the legend's parent is the
    // sphere WRAPPER, so the fold never happened anywhere, on
    // any device, and his phone showed the box standing over a
    // squeezed stage. The sweep now searches the whole main,
    // subtree-deep, and the stylesheet hides both pieces while
    // they are anywhere in the stage's frame, so the surface is
    // clean from the first paint even before this runs.
    var sweepChrome = function () {
      [".sphere-guide-bar", "#sphere-legend"].forEach(function (sel) {
        var el = main.querySelector(sel);
        if (el && el.parentElement !== sidebar) {
          el.classList.add("sphere-sheet-room");
          sidebar.appendChild(el);
        }
      });
    };
    sweepChrome();
    new MutationObserver(sweepChrome).observe(main, { childList: true, subtree: true });

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

  // What the keeper's record keeps on each Pattern day of the
  // shown year — filled by the record pass below, read by the
  // readout. patternDay → { plans: [titles], played: bool }.
  var keptByDay = {};
  var renderKeptRef = null;

  // The shown Moon's name rides its medallion's label: the label
  // spans are the renderer's, their text set once at setup to
  // "Moon N" — the page layer writes the name onto the shown
  // Moon's span and restores the rest. (Aaron, Nov 20, 2026:
  // "the shown Moon's name on its medallion".)
  function nameShownMoon(pos) {
    var labels = document.getElementById("sphere-moon-labels");
    if (!labels || !pos) return;
    var data = window.PatternCalendarData || {};
    labels.querySelectorAll(".sphere-moon-label[data-moon]").forEach(function (el) {
      var n = Number(el.getAttribute("data-moon"));
      var name = (data.moons && data.moons[n - 1] && data.moons[n - 1].name) || "";
      var text = n === pos.moon && name ? "Moon " + n + " · " + name : "Moon " + n;
      if (el.textContent !== text) el.textContent = text;
    });
  }

  // A tapped day answers with its own note (Aaron, Nov 20, 2026:
  // "tappable days answer with light and sound"). The note is a
  // fixed function of the Pattern day — a pentatonic ladder over
  // two octaves, the same day always sounding the same note —
  // played through the Spark's own voice, which honours the
  // keeper's sound setting. Only after the keeper's first touch:
  // browsers forbid sound before a gesture, and the Sphere
  // should never sound uninvited.
  var gestureHeard = false;
  document.addEventListener("pointerdown", function () { gestureHeard = true; }, { once: true });
  var lastSoundedDay = 0;
  function soundForDay(pos) {
    if (!gestureHeard || !pos || pos.dayOfPatternYear === lastSoundedDay) return;
    lastSoundedDay = pos.dayOfPatternYear;
    var Spark = window.SphereSpark;
    if (!Spark || !Spark.soundNote) return;
    var ladder = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33];
    var semis = ladder[(pos.dayOfPatternYear - 1) % ladder.length];
    Spark.soundNote(330 * Math.pow(2, semis / 12), 0.16);
  }

  function buildReadout() {
    var wrap = document.querySelector(".sphere-canvas-wrap") || document.getElementById("sphere-container")?.parentElement;
    if (!wrap) return;
    var card = document.createElement("div");
    card.className = "sphere-day-readout";
    card.setAttribute("aria-live", "polite");
    card.innerHTML =
      '<p class="sphere-day-readout-where"></p>' +
      '<p class="sphere-day-readout-telling"></p>' +
      '<p class="sphere-day-readout-kept" hidden></p>' +
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
    var kept = card.querySelector(".sphere-day-readout-kept");
    function renderKept() {
      var pos = selectedPosition();
      var entry = pos ? keptByDay[pos.dayOfPatternYear] : null;
      if (!entry || (!entry.plans.length && !entry.played)) {
        kept.hidden = true;
        kept.textContent = "";
        return;
      }
      var bits = [];
      if (entry.plans.length) bits.push("Kept here: " + entry.plans.slice(0, 3).join(" · ") + (entry.plans.length > 3 ? " · +" + (entry.plans.length - 3) + " more" : ""));
      if (entry.played) bits.push("a game is stamped here");
      kept.textContent = bits.join(" — ");
      kept.hidden = false;
    }
    renderKeptRef = renderKept;
    function render() {
      var pos = selectedPosition();
      if (!pos) {
        where.textContent = stripText() || "The Sphere is waking up.";
        telling.textContent = "";
        kept.hidden = true;
        return;
      }
      var data = window.PatternCalendarData || {};
      var moonName = (data.moons && data.moons[pos.moon - 1] && data.moons[pos.moon - 1].name) || "";
      var archetype = (data.dayArchetypes && data.dayArchetypes[(pos.day - 1) % 28] && data.dayArchetypes[(pos.day - 1) % 28][0]) || "";
      where.textContent = "Moon " + pos.moon + " · Day " + pos.day + " · Pattern Day " + pos.dayOfPatternYear + " of 364";
      telling.textContent = archetype ? moonName + " — " + archetype : moonName;
      renderKept();
      nameShownMoon(pos);
      soundForDay(pos);
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
    // The story layer's Day World chapter stands under the scene:
    // an empty slot naming its chapter, filled by story-layer.js
    // when it lands (the layer watches for late slots).
    if (!sheet.querySelector("[data-story-slot]")) {
      var slot = document.createElement("div");
      slot.setAttribute("data-story-slot", "");
      slot.setAttribute("data-story-chapter", "through-the-day-door");
      fig.after(slot);
    }
  }

  /* The chapter also stands on the room's DOOR (desktop-width
   * corrective, Nov 20): the chapter inside the room only
   * exists behind the step-in, so a keeper reading the page —
   * or searching it — found no chapter at all. The door resting
   * in the rooms sheet now carries the chapter at its entry,
   * labelled as part of The Traveller's Road like every other
   * fitted chapter; the room keeps its own copy under the
   * scene. One chapter, two doorways, the same slot contract. */
  function dressDayWorldDoor() {
    var door = document.querySelector(".day-world-door");
    if (!door || !door.parentElement) return;
    if (door.parentElement.querySelector("[data-story-entry]")) return;
    var slot = document.createElement("div");
    slot.setAttribute("data-story-slot", "");
    slot.setAttribute("data-story-entry", "");
    slot.setAttribute("data-story-chapter", "through-the-day-door");
    door.after(slot);
  }

  function watchDayWorld() {
    dressDayWorld();
    dressDayWorldDoor();
    new MutationObserver(function () {
      dressDayWorld();
      dressDayWorldDoor();
    }).observe(document.body, { childList: true, subtree: true });
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
      var trail = [];
      var kept = {};
      var now = new Date();
      var todayIso = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
      var todayCount = 0;
      (plans || []).forEach(function (rec) {
        var d = planPatternDay(rec);
        if (!d) return;
        days.push(d);
        if (!kept[d]) kept[d] = { plans: [], played: false };
        if (rec.title) kept[d].plans.push(String(rec.title));
        if (rec.completed) trail.push(d);
        if (planCivil(rec) === todayIso && !rec.completed) todayCount += 1;
      });
      // The trail also carries the Spark's stamped games: the
      // play log lives in the companion record, each entry
      // stamped with its Pattern day by the one canonical clock.
      try {
        var Core = window.SparkCompanion;
        var raw = Core && Core.STORAGE_KEY ? window.localStorage.getItem(Core.STORAGE_KEY) : null;
        var record = raw ? JSON.parse(raw) : null;
        (Array.isArray(record && record.playLog) ? record.playLog : []).forEach(function (entry) {
          var d = Number(entry && entry.stamp && entry.stamp.patternDay);
          if (d >= 1 && d <= 364) {
            trail.push(d);
            if (!kept[d]) kept[d] = { plans: [], played: false };
            kept[d].played = true;
          }
        });
      } catch (err) { /* no companion yet — the trail is plans alone */ }
      // …and the Living Trail: the days the keeper stood on and
      // the days a chapter of the Traveller's Road was found join
      // the same trail by the same pattern-day numbers (the
      // trail's stamps are PatternCalendar coordinates, read from
      // the one clock — only this year's days light this year's
      // face).
      try {
        var Trail = window.LivingTrail;
        if (Trail && Trail.load) {
          var t = Trail.load();
          (Trail.daysForYear(t, year) || []).forEach(function (d) {
            trail.push(d);
            if (!kept[d]) kept[d] = { plans: [], played: false };
          });
          Object.keys(t.finds || {}).forEach(function (chapterId) {
            var f = t.finds[chapterId];
            var d = Number(f && f.patternDay);
            if (f && f.patternYear === year && d >= 1 && d <= 364) {
              trail.push(d);
              if (!kept[d]) kept[d] = { plans: [], played: false };
            }
          });
        }
      } catch (err) { /* no trail yet — the face is plans and play alone */ }
      keptByDay = kept;
      renderer.setRecordMarkers(days);
      if (renderer.setTrailMarkers) renderer.setTrailMarkers(trail);
      // Today's kept-plans count, published for the hub plate.
      window.__sofHubPlans = { key: todayIso + ":" + todayCount, count: todayCount };
      if (renderKeptRef) renderKeptRef();
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

  /* ── 4b. The sky line: real values or one honest line ──────────
   *
   * The sphere UI keeps a live-environment strip and parks it
   * inside the stage, where it showed placeholder dashes framed
   * as data ("—°C / —°F · Kp — · AQI —") — Aaron, Nov 20, 2026:
   * "Real values or one plain honest line; never fake data on
   * the face." The page layer adopts the strip into the telling
   * line's block as the sky line: segments with real numbers
   * stand; dash-only segments are dropped; while nothing real
   * has arrived the line stays hidden, and if nothing real
   * arrives at all, one plain line says so. */

  function adoptSkyline() {
    var caption = document.querySelector(".sphere-rebuild-caption");
    if (!caption) return;
    var adopted = null;
    var firstSeenAt = 0;
    function sanitize(el) {
      var primary = el.querySelector(".sphere-live-environment-primary");
      var secondary = el.querySelector(".sphere-live-environment-secondary");
      var selected = el.querySelector(".sphere-live-environment-selected");
      if (secondary && /loading/i.test(secondary.textContent || "")) secondary.textContent = "";
      if (selected && !/\d/.test(selected.textContent || "") && /—/.test(selected.textContent || "")) selected.textContent = "";
      if (!primary) return;
      var segments = String(primary.textContent || "").split("·").map(function (s) { return s.trim(); }).filter(Boolean);
      var real = segments.filter(function (s) { return /\d/.test(s) && s !== "NOW"; });
      if (real.length) {
        var text = "NOW · " + real.join(" · ");
        if (primary.textContent !== text) primary.textContent = text;
        el.hidden = false;
        return;
      }
      if (firstSeenAt && Date.now() - firstSeenAt > 12000) {
        // One plain honest sentence, and the right one: a
        // refused location is not a failed provider.
        var honest = window.__sofSkyLocationRefused
          ? "Location is off, so the live sky line can't fill in."
          : "Live sky data isn't available right now";
        if (primary.textContent !== honest) primary.textContent = honest;
        el.hidden = false;
      } else {
        el.hidden = true;
      }
    }
    function adopt() {
      var el = document.getElementById("sphere-live-environment-telemetry");
      if (!el) return;
      if (adopted !== el) {
        adopted = el;
        firstSeenAt = Date.now();
        el.classList.add("sphere-skyline");
        el.hidden = true;
        caption.appendChild(el);
        new MutationObserver(function () { sanitize(el); }).observe(el, { childList: true, subtree: true, characterData: true });
      }
      sanitize(el);
    }
    adopt();
    new MutationObserver(adopt).observe(document.body, { childList: true, subtree: true });
    window.setInterval(adopt, 3000);
  }

  /* ── 4b-ii. The environment arrives on its own (Aaron, Nov 20):
   * the sky line sat at "Location required" forever because
   * nothing on this page ever asked. On open: if a place is
   * already kept, the providers refresh now; if none is kept,
   * ask ONCE through the browser's own permission flow (the
   * adapter's device-location request — the prompt is the
   * browser's, the answer is the keeper's). Granted: the place
   * is kept by the adapter, the location-changed word goes out,
   * and the authority fetches the real providers — the face
   * then works with the data through the standing sky bridge.
   * Refused: no second ask, and the sky line says so in its one
   * honest sentence. Nothing is invented either way. */

  function autoEnvironment() {
    // The environment stack is phase three of the page's staged
    // loader — it lands after first paint by design — so the
    // watch is patient: a cheap check three times a second-ish
    // for as long as a slow phone could reasonably take, then
    // it stands down.
    var tries = 0;
    var wait = window.setInterval(function () {
      tries += 1;
      var adapter = window.OpenMeteoAdapter;
      if (!adapter || typeof adapter.requestDeviceLocation !== "function" || typeof adapter.getActivePlace !== "function") {
        if (tries > 320) window.clearInterval(wait);
        return;
      }
      window.clearInterval(wait);
      startAutoEnvironment(adapter);
    }, 750);
  }

  function startAutoEnvironment(adapter) {
    function refresh() {
      try {
        if (window.SofEnvironmentAuthority && typeof window.SofEnvironmentAuthority.refreshCurrent === "function") {
          window.SofEnvironmentAuthority.refreshCurrent({ force: true });
        }
      } catch (err) { /* if nothing arrives, the sky line says so honestly */ }
    }
    var place = null;
    try { place = adapter.getActivePlace(); } catch (err) { place = null; }
    if (place) { refresh(); return; }
    var asked = false;
    try { asked = !!window.localStorage.getItem("sof.armillary.locationAsked"); } catch (err) { asked = false; }
    function ask() {
      try { window.localStorage.setItem("sof.armillary.locationAsked", "1"); } catch (err) { /* private mode: the browser still remembers its own answer */ }
      adapter.requestDeviceLocation().then(function () {
        try { window.dispatchEvent(new CustomEvent("sof:location-changed", { detail: { source: "sphere-auto" } })); } catch (err) { /* the refresh below still runs */ }
        refresh();
      }).catch(function (err) {
        if (err && err.code === 1) window.__sofSkyLocationRefused = true;
      });
    }
    if (navigator.permissions && typeof navigator.permissions.query === "function") {
      navigator.permissions.query({ name: "geolocation" }).then(function (status) {
        if (status.state === "granted") ask();
        else if (status.state === "denied") window.__sofSkyLocationRefused = true;
        else if (!asked) ask();
      }).catch(function () { if (!asked) ask(); });
    } else if (!asked) {
      ask();
    }
  }

  /* ── 4b-iii. The season line (Aaron, Nov 20): the current
   * season, plainly, beside the sky line — with the next turn
   * and its real date. The dates are the U.S. Naval
   * Observatory's published season instants for the year (the
   * same source the repo's equinox record stands on; read from
   * the USNO seasons table on 2026-11-20, UTC, minute-rounded
   * as USNO publishes). The line prints a date only for a year
   * in this table; for any other year it names the season and
   * the next turn from the model's standing anchors and prints
   * no date it cannot source. */

  var SEASON_TURNS = {
    2026: [
      { name: "March Equinox", season: "Spring", utc: "2026-03-20T14:46:00Z" },
      { name: "June Solstice", season: "Summer", utc: "2026-06-21T08:24:00Z" },
      { name: "September Equinox", season: "Autumn", utc: "2026-09-23T00:05:00Z" },
      { name: "December Solstice", season: "Winter", utc: "2026-12-21T20:50:00Z" }
    ],
    2027: [
      { name: "March Equinox", season: "Spring", utc: "2027-03-20T20:25:00Z" },
      { name: "June Solstice", season: "Summer", utc: "2027-06-21T14:11:00Z" },
      { name: "September Equinox", season: "Autumn", utc: "2027-09-23T06:02:00Z" },
      { name: "December Solstice", season: "Winter", utc: "2027-12-22T02:42:00Z" }
    ]
  };
  var SEASON_ANCHORS = [
    { name: "March Equinox", season: "Spring", month: 2, day: 20 },
    { name: "June Solstice", season: "Summer", month: 5, day: 20 },
    { name: "September Equinox", season: "Autumn", month: 8, day: 22 },
    { name: "December Solstice", season: "Winter", month: 11, day: 21 }
  ];
  var SEASON_FLIP = { Spring: "Autumn", Summer: "Winter", Autumn: "Spring", Winter: "Summer" };
  var MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function seasonNow(now) {
    var year = now.getFullYear();
    var turns = SEASON_TURNS[year];
    if (turns) {
      var stamps = turns.map(function (t) { return { name: t.name, season: t.season, at: new Date(t.utc) }; });
      var current = { season: "Winter" };
      var next = null;
      for (var i = 0; i < stamps.length; i += 1) {
        if (now >= stamps[i].at) current = stamps[i];
        else { next = stamps[i]; break; }
      }
      if (!next) {
        var nextYear = SEASON_TURNS[year + 1];
        if (nextYear && nextYear[0]) next = { name: nextYear[0].name, season: nextYear[0].season, at: new Date(nextYear[0].utc) };
      }
      return { season: current.season, next: next };
    }
    var anchors = SEASON_ANCHORS.map(function (a) {
      return { name: a.name, season: a.season, at: new Date(year, a.month, a.day) };
    });
    var cur = { season: "Winter" };
    var nxt = null;
    for (var j = 0; j < anchors.length; j += 1) {
      if (now >= anchors[j].at) cur = anchors[j];
      else { nxt = { name: anchors[j].name }; break; }
    }
    if (!nxt) nxt = { name: SEASON_ANCHORS[0].name };
    return { season: cur.season, next: nxt };
  }

  function seasonLine() {
    var caption = document.querySelector(".sphere-rebuild-caption");
    if (!caption) return;
    var line = document.createElement("p");
    line.className = "sphere-season-line";
    line.setAttribute("role", "note");
    var telling = caption.querySelector(".sphere-rebuild-telling");
    if (telling) telling.after(line);
    else caption.appendChild(line);
    function render() {
      var info = seasonNow(new Date());
      var season = info.season;
      // The face's own season ring turns its names by latitude
      // when a place is known; the line follows the same rule.
      try {
        var state = window.SofEnvironmentState && window.SofEnvironmentState.getEnvironmentState ? window.SofEnvironmentState.getEnvironmentState() : null;
        var lat = Number(state && state.place && state.place.latitude);
        if (Number.isFinite(lat) && lat < -10) season = SEASON_FLIP[season] || season;
      } catch (err) { /* northern names stand */ }
      var text = season;
      if (info.next && info.next.at) {
        text += " · the " + info.next.name + " turns on " + MONTH_SHORT[info.next.at.getMonth()] + " " + info.next.at.getDate();
      } else if (info.next) {
        text += " · the " + info.next.name + " is the next turn";
      }
      if (line.textContent !== text) line.textContent = text;
    }
    render();
    window.setInterval(render, 60000);
  }

  /* ── 4c. The instrument is directly touchable ──────────────────
   *
   * The Interact toggle existed to keep touch drags scrolling
   * the page; this page never scrolls, so once the instrument
   * reports ready, the page layer presses the toggle itself —
   * the Sphere turns under the keeper's thumb from the first
   * moment, like a game board. */

  function autoInteract() {
    var tries = 0;
    var wait = window.setInterval(function () {
      tries += 1;
      var diag = null;
      try { diag = window.LivingTimeSphereUi && window.LivingTimeSphereUi.getSphereDiagnostics ? window.LivingTimeSphereUi.getSphereDiagnostics() : null; } catch (err) { diag = null; }
      var btn = document.getElementById("sphere-interact-btn");
      var endBtn = document.getElementById("sphere-interact-end-btn");
      if (diag && diag.threeDReady && btn && endBtn && endBtn.style.display === "none") {
        window.clearInterval(wait);
        btn.click();
      } else if (tries > 90) {
        window.clearInterval(wait);
      }
    }, 500);
  }

  /* ── 4d. The command trigger stands in the dock ────────────────
   *
   * The Living command trigger is a fixed pill; on this page it
   * floated over the dock's right-hand doors. It joins the dock
   * as an eighth door instead — the same control with the same
   * job, in the one row. (Its window is a fixed overlay with its
   * own life, untouched by the move.) */

  function dockCommandTrigger() {
    var tries = 0;
    var wait = window.setInterval(function () {
      tries += 1;
      var trigger = document.querySelector(".living-command-trigger");
      var dock = document.querySelector(".sphere-rebuild-dock");
      if (trigger && dock) {
        window.clearInterval(wait);
        if (trigger.parentElement !== dock) {
          dock.appendChild(trigger);
          dock.classList.add("has-command-trigger");
        }
      } else if (tries > 90) {
        window.clearInterval(wait);
      }
    }, 500);
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
    adoptSkyline();
    autoEnvironment();
    seasonLine();
    autoInteract();
    dockCommandTrigger();
    startRecordAndAlerts();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
