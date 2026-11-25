/**
 * The Sphere page, rebuilt as an app (Nov 20, 2026).
 *
 * Aaron's order: "The sphere as a app needs to be redone. Get rid of
 * it and rework that page. Make it way better." — with two acceptance
 * tests on top: (1) the Sphere is the first thing on the page, full
 * stop; (2) every action is reachable by one obvious, plainly
 * labelled path.
 *
 * This module is the new page shell. It does not touch the
 * instrument: the canonical pipeline (SOFTemporalCursor →
 * PatternCalendar → Canonical Living State → LivingProjectionBus)
 * stays the single temporal authority, and every control this shell
 * presses is one of the page's own existing controls, pressed the
 * way a keeper would press it. What changes is arrangement and
 * reachability:
 *
 *   - The stage stands first in the page; the site header, the hero,
 *     the stacked bars and the technical rooms move below it.
 *   - The instrument is interactive from the first touch (the
 *     resting-state touch glitch dies here and in the renderer's
 *     always-interactive start), with one plain Freeze button that
 *     holds it perfectly still and wakes it again.
 *   - One dock under the stage carries every action by its plain
 *     name: Today · Schedule · Enter this day · Deep Time ·
 *     Farm & home · Freeze · Your Spark. (Sphere redesign,
 *     Nov 20, 2026: Schedule stands where Choose a day stood —
 *     Aaron: "I didn't see an easy way to schedule" — and Enter
 *     carries its plain name.)
 *   - The Ambient face's welcome (PR #196) becomes a room below the
 *     stage instead of a veil over it; its one plain sentence stands
 *     directly under the instrument.
 *   - The homestead panel (built in PR #189, never wired) takes its
 *     place under the farm section and follows the shown day.
 *   - A held light in the shown Moon's hue breathes over the stage,
 *     the daypart light turns live while you watch, and the welcome
 *     room carries the season line from your own place — three
 *     additions beyond the brief, all from systems that already
 *     exist on this page.
 *
 * The Spark's presence on this page is built fresh in
 * sphere-spark.js; this shell exposes window.SphereRebuild so the
 * Spark agent can work the page the way a keeper would.
 */
(function () {
  "use strict";

  const VERSION = "sphere-rebuild/1.0.0";
  const rootEl = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // The arrival URL, captured before the page's own URL-state
  // machinery rewrites it with the current view's parameters —
  // a motion choice is the keeper's only when it arrived with
  // them, not when the page echoed it back.
  const arrivalUrl = window.location.search + window.location.hash;

  let frozen = false;
  let savedMotion = null;
  let armed = false;

  const $ = (sel, base) => (base || document).querySelector(sel);
  const $$ = (sel, base) => Array.from((base || document).querySelectorAll(sel));

  function clickFirst(selectors) {
    for (const sel of selectors) {
      const el = typeof sel === "string" ? $(sel) : sel;
      if (el) { el.click(); return true; }
    }
    return false;
  }

  /* ── Public page API (also the Spark agent's hands) ─────────── */

  function goToday() {
    return clickFirst(["#sphere-everyday-today", '[data-app-action="today"]', "#calendar-return-today", "#sphere-year-live"]);
  }

  function showDay(spec) {
    const input = $("#sphere-quick-jump-input");
    const submit = $("#sphere-quick-jump-submit");
    if (!input || !submit || !spec) return false;
    let text = null;
    if (spec.civilDate) text = String(spec.civilDate);
    else if (spec.patternDay != null) text = `Day ${spec.patternDay}`;
    else if (spec.moon != null && spec.day != null) text = `Moon ${spec.moon} Day ${spec.day}`;
    if (!text) return false;
    input.value = text;
    submit.click();
    return true;
  }

  function openDayWorld() {
    // The Day World's door opens for the day the zoom is showing;
    // before any day has been flown to, that view may not exist
    // yet and the door stands quiet. The dock's promise is one
    // tap: if the room does not open, stand on today first —
    // today always has a view — and open the door again.
    const opened = () => document.documentElement.classList.contains("day-world-open");
    if (!clickFirst([".day-world-door-button"])) return false;
    window.setTimeout(() => {
      if (opened()) return;
      goToday();
      window.setTimeout(() => clickFirst([".day-world-door-button"]), 700);
    }, 450);
    return true;
  }
  function openDeepTime() { return clickFirst([".deep-time-door-button"]); }

  /* Schedule, made plain (Sphere redesign, Nov 20, 2026 — Aaron:
   * "I didn't see an easy way to schedule"). The one path: pick a
   * day on the Sphere, tap Schedule (dock or the day's own
   * readout), and the Living Planner opens on that day — the same
   * hand the label manager's card has always offered, now standing
   * in the open. The plan is kept in the keeper's own record by
   * the planner itself. */
  function selectedCivilDate() {
    const d = globalThis.LivingTimeSphereUi?.getSphereDiagnostics?.() || {};
    const doy = Number(d.selectedDay || 0);
    const year = Number(d.selectedYear || 0);
    if (!Number.isFinite(doy) || doy < 1 || doy > 364 || !year) return null;
    const epoch = globalThis.PatternCalendar?.epochForYear?.(year);
    if (!(epoch instanceof Date) || Number.isNaN(epoch.getTime())) return null;
    const date = new Date(epoch.getTime() + (doy - 1) * 86400000);
    const iso = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    return { civil: iso, moon: Math.floor((doy - 1) / 28) + 1, day: ((doy - 1) % 28) + 1, dayOfPatternYear: doy };
  }

  function openSchedule() {
    const sel = selectedCivilDate();
    if (sel) {
      const request = {
        source: "sphere-schedule-door",
        selectedCivilDate: sel.civil,
        pattern: { moon: sel.moon, day: sel.day, dayOfPatternYear: sel.dayOfPatternYear },
      };
      globalThis.__SOF_PENDING_SCHEDULE_DAY__ = request;
      document.dispatchEvent(new CustomEvent("sof:sphere-schedule-selected-day", { detail: request }));
    }
    const plannerOpen = document.getElementById("living-planner-open");
    if (!plannerOpen) return false;
    plannerOpen.click();
    if (sel) {
      window.setTimeout(() => {
        const dateInput = document.getElementById("living-planner-date");
        if (dateInput && dateInput.value !== sel.civil) {
          dateInput.value = sel.civil;
          dateInput.dispatchEvent(new Event("input", { bubbles: true }));
          dateInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const title = document.getElementById("living-planner-title-input");
        if (title) { try { title.focus({ preventScroll: true }); } catch { /* focus is a courtesy */ } }
      }, 80);
    }
    return true;
  }

  function openFarm() {
    const farm = $("[data-sphere-farm-section]");
    if (farm) { farm.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" }); return true; }
    const sidebar = $(".sphere-sidebar");
    if (sidebar) { sidebar.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" }); return true; }
    return false;
  }

  function selectedLine() {
    const strip = $("#sphere-state-strip");
    return strip ? (strip.textContent || "").trim() : "";
  }

  /* ── Freeze / wake ──────────────────────────────────────────── */

  let shield = null;

  function setDockFreezeLabel() {
    const btn = $("[data-sphere-rebuild-freeze]");
    if (!btn) return;
    btn.textContent = frozen ? "Wake the Sphere" : "Freeze";
    btn.setAttribute("aria-pressed", frozen ? "true" : "false");
  }

  function freeze() {
    if (frozen) return;
    frozen = true;
    rootEl.classList.add("sphere-frozen");
    // End interaction through the page's own control, so the
    // renderer's gesture state restores cleanly.
    const endBtn = $("#sphere-interact-end-btn");
    if (endBtn && endBtn.style.display !== "none") endBtn.click();
    const motion = $("#sphere-motion-mode");
    if (motion) {
      savedMotion = motion.value;
      if (motion.value !== "still") {
        motion.value = "still";
        motion.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    try { window.LivingTimeSphereAnimation?.pause?.(); } catch { /* the shield still holds the stage */ }
    const shell = $(".sphere-instrument-shell");
    if (shell && !shield) {
      shield = document.createElement("div");
      shield.className = "sphere-rebuild-shield";
      shield.setAttribute("role", "note");
      shield.innerHTML = `<span class="sphere-rebuild-shield-chip">Frozen — the Sphere is holding still</span>`;
      shell.appendChild(shield);
    }
    if (shield) shield.hidden = false;
    setDockFreezeLabel();
  }

  function wake() {
    if (!frozen) return;
    frozen = false;
    rootEl.classList.remove("sphere-frozen");
    if (shield) shield.hidden = true;
    const motion = $("#sphere-motion-mode");
    if (motion && savedMotion && motion.value !== savedMotion) {
      motion.value = savedMotion;
      motion.dispatchEvent(new Event("change", { bubbles: true }));
    }
    savedMotion = null;
    try { window.LivingTimeSphereAnimation?.resume?.(); } catch { /* arming below still wakes the touch */ }
    armed = false;
    armInteract();
    setDockFreezeLabel();
  }

  // The animation module's own visibility handling may resume the
  // loop; while frozen, stillness wins every time the page returns.
  document.addEventListener("visibilitychange", () => {
    if (frozen && !document.hidden) {
      try { window.LivingTimeSphereAnimation?.pause?.(); } catch { /* shield holds */ }
    }
  });
  window.addEventListener("focus", () => {
    if (frozen) { try { window.LivingTimeSphereAnimation?.pause?.(); } catch { /* shield holds */ } }
  });

  /* ── Always interactive ─────────────────────────────────────── */

  function interactIsOn() {
    const endBtn = $("#sphere-interact-end-btn");
    return Boolean(endBtn && endBtn.style.display !== "none");
  }

  function armInteract() {
    if (frozen || armed) return;
    const startBtn = $("#sphere-interact-btn");
    if (!startBtn) return;
    if (interactIsOn()) { armed = true; return; }
    // The bar only exists once the 3D stage is live; press the
    // page's own button the moment it can be pressed.
    if (startBtn.offsetParent === null && !$("#sphere-container")) return;
    startBtn.click();
    if (interactIsOn()) armed = true;
  }

  function watchArming() {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      armInteract();
      if (armed || tries > 80) window.clearInterval(timer);
    }, 250);
    const container = $("#sphere-container");
    if (container) {
      container.addEventListener("sphere:interact-end", () => {
        armed = false;
        if (!frozen) window.setTimeout(armInteract, 60);
      });
      container.addEventListener("sphere:interact-start", () => { armed = true; });
    }
  }

  /* ── Layout: the stage first, rooms below ───────────────────── */

  function move(el, parent, before) {
    if (!el || !parent || el.parentElement === parent) return el;
    if (before) parent.insertBefore(el, before);
    else parent.appendChild(el);
    return el;
  }

  function buildShell() {
    const wrap = $(".wrap");
    const main = $("#main") || $("main");
    const wrapper = $(".sphere-wrapper");
    const canvasWrap = $(".sphere-canvas-wrap");
    if (!wrap || !main || !wrapper || !canvasWrap) return false;

    rootEl.classList.add("sphere-rebuilt");

    // The stage is the first thing in the page.
    main.insertBefore(wrapper, main.firstChild);
    const sidebar = $(".sphere-sidebar", wrapper);
    if (sidebar) main.appendChild(sidebar); // out of the wrapper; placed below the dock shortly

    // The site header waits below the app entirely.
    const header = $(".site-header", wrap);
    if (header) wrap.insertBefore(header, main.nextSibling);

    // Caption: the Ambient face's one plain sentence, directly
    // under the instrument (relocated when it appears).
    const caption = document.createElement("div");
    caption.className = "sphere-rebuild-caption";
    wrapper.after(caption);

    // The dock: every action, one plain name each.
    const dock = document.createElement("nav");
    dock.className = "sphere-rebuild-dock";
    dock.setAttribute("aria-label", "Sphere actions");
    dock.innerHTML = `
      <button type="button" class="sphere-rebuild-dock-btn" data-sphere-rebuild-today>Today</button>
      <button type="button" class="sphere-rebuild-dock-btn" data-sphere-rebuild-schedule>Schedule</button>
      <button type="button" class="sphere-rebuild-dock-btn" data-sphere-rebuild-dayworld>Enter this day</button>
      <button type="button" class="sphere-rebuild-dock-btn" data-sphere-rebuild-deeptime>Deep Time</button>
      <button type="button" class="sphere-rebuild-dock-btn" data-sphere-rebuild-farm>Farm &amp; home</button>
      <button type="button" class="sphere-rebuild-dock-btn" data-sphere-rebuild-freeze aria-pressed="false">Freeze</button>
      <button type="button" class="sphere-rebuild-dock-btn sphere-rebuild-dock-spark" data-sphere-rebuild-spark>Your Spark</button>`;
    caption.after(dock);
    if (sidebar) dock.after(sidebar);

    dock.querySelector("[data-sphere-rebuild-today]").addEventListener("click", () => { wake(); goToday(); });
    dock.querySelector("[data-sphere-rebuild-schedule]").addEventListener("click", () => { openSchedule(); });
    dock.querySelector("[data-sphere-rebuild-dayworld]").addEventListener("click", openDayWorld);
    dock.querySelector("[data-sphere-rebuild-deeptime]").addEventListener("click", openDeepTime);
    dock.querySelector("[data-sphere-rebuild-farm]").addEventListener("click", openFarm);
    dock.querySelector("[data-sphere-rebuild-freeze]").addEventListener("click", () => { if (frozen) wake(); else freeze(); });
    dock.querySelector("[data-sphere-rebuild-spark]").addEventListener("click", () => {
      const sparkButton = dock.querySelector("[data-sphere-rebuild-spark]");
      const talk = $("[data-sphere-spark-talk]");
      const input = talk?.querySelector("input, textarea");
      document.dispatchEvent(new CustomEvent("sphere:open-rooms", {
        detail: { trigger: sparkButton, target: input || null },
      }));
      let tries = 0;
      const focusConversation = () => {
        const talk = $("[data-sphere-spark-talk]", $(".sphere-sidebar") || document);
        if (talk) {
          talk.scrollIntoView({ behavior: "auto", block: "start" });
          const input = talk.querySelector("input, textarea");
          if (input) {
            window.setTimeout(() => {
              try { input.focus({ preventScroll: true }); } catch { /* the conversation remains visible */ }
            }, reducedMotion ? 0 : 300);
          }
          return;
        }
        tries += 1;
        if (tries < 40) window.setTimeout(focusConversation, 100);
      };
      window.setTimeout(focusConversation, 0);
    });

    // The pre-stage chrome becomes one room at the top of the
    // sidebar: "Navigate the year". Nothing is deleted; every
    // control keeps its own wiring wherever it stands.
    const navRoom = document.createElement("section");
    navRoom.className = "sphere-sidebar-section sphere-rebuild-nav-room";
    navRoom.innerHTML = `<h2 class="sphere-sidebar-heading">Navigate the year</h2>`;
    if (sidebar) sidebar.insertBefore(navRoom, sidebar.firstChild);
    for (const sel of [
      ".sphere-year-navigator",
      ".sphere-location-season-strip",
      ".sphere-quick-nav",
      ".sphere-view-tools",
      ".sphere-everyday-toolbar",
      ".sphere-schedule-navigator",
      ".sphere-data-safety",
      ".sphere-environment-bridge",
      ".sphere-camera-controls",
    ]) {
      const el = $(sel, canvasWrap) || $(sel);
      if (el) navRoom.appendChild(el);
    }

    // The temporal coordinate panel builds itself a few seconds
    // after the instrument and sets its root at the head of main —
    // in front of the stage. It is navigation chrome, so whenever
    // it appears it takes its place in this room instead, and the
    // stage keeps the first place on the page.
    const takeCoordinateRoot = () => {
      const coordRoot = $(".temporal-coordinate-root");
      if (coordRoot && coordRoot.parentElement !== navRoom) navRoom.appendChild(coordRoot);
    };
    takeCoordinateRoot();
    const rootWatcher = new MutationObserver(takeCoordinateRoot);
    rootWatcher.observe(main, { childList: true });
    window.setTimeout(() => rootWatcher.disconnect(), 30000);

    // The guided introduction stands in the flow below the stage,
    // never floating over the instrument.
    const intro = $("#sphere-intro");
    if (intro && sidebar) sidebar.before(intro);

    // The hero becomes the About room below the app.
    const hero = $(".sphere-hero", main);
    if (hero && sidebar) sidebar.after(hero);

    // All remaining controls — view modes, quality, diagnostics —
    // behind one plainly named door, collapsed by default.
    const controlsBar = $(".sphere-controls-bar", main);
    if (controlsBar) {
      const details = document.createElement("details");
      details.className = "sphere-rebuild-controls";
      details.innerHTML = `<summary>Views, quality and all the Sphere's controls</summary>`;
      if (hero) hero.after(details);
      else if (sidebar) sidebar.after(details);
      details.appendChild(controlsBar);
      details.dataset.sphereRebuildControls = "";
    }

    // The observatory's daily question must never cover the
    // stage at arrival. The workspace offers it on open (the
    // keeper's own preference), about a second after it wakes —
    // on the rebuilt page that lid lands on the instrument, so
    // during the arrival window the shell rests an uninvited
    // opening through the question's own close button. A keeper
    // who summons the question themselves (Ask now) is never
    // rested, and the question stays one tap away in its room.
    const obsShell = $("#obs-question-shell");
    if (obsShell) {
      let summoned = false;
      $("#obs-question-ask-now")?.addEventListener("click", () => { summoned = true; }, { capture: true });
      const rest = () => {
        if (summoned || obsShell.hidden) return;
        obsShell.classList.add("sphere-rebuild-obs-resting");
        $("#obs-question-close")?.click();
      };
      const watcher = new MutationObserver(rest);
      watcher.observe(obsShell, { attributes: true, attributeFilter: ["hidden"] });
      watcher.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      // Sphere redesign (Nov 20, 2026): the guard used to stand
      // down after 15 seconds — but the workspace wakes on its own
      // clock, and on a slow phone it offers the question long
      // after the guard has gone, dropping the modal on the
      // instrument and eating every tap meant for the Sphere
      // (measured in the lab: taps at 20s+ selected nothing until
      // the shell was dismissed). The guard now stands for the
      // page's whole life; it costs one small observer and acts
      // only when the shell opens uninvited.
      rest();
    }

    placeAmbientPieces(caption);
    placeEncounter();
    placeAppEnter();
    return true;
  }

  function placeAmbientPieces(caption) {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const line = $(".sphere-ambient-line");
      if (line && caption && line.parentElement !== caption) caption.appendChild(line);
      const veil = $(".sphere-ambient-veil");
      if (veil) {
        // The welcome becomes a room below the stage. It can never
        // cover the instrument again: rebuild CSS holds it static.
        rootEl.classList.remove("sphere-ambient-on");
        veil.hidden = false;
        veil.classList.add("sphere-rebuild-welcome");
        const dock = $(".sphere-rebuild-dock");
        if (dock && veil.parentElement !== dock.parentElement) dock.after(veil);
        else if (dock) dock.after(veil);
        // Its button keeps its plain job — go to today — without
        // hiding the room it stands in.
        const enter = veil.querySelector(".sphere-ambient-enter");
        if (enter && !enter.dataset.sphereRebuildWired) {
          enter.dataset.sphereRebuildWired = "1";
          enter.textContent = "Go to today on the Sphere";
          const fresh = enter.cloneNode(true);
          enter.replaceWith(fresh);
          fresh.addEventListener("click", () => {
            wake();
            goToday();
            $(".sphere-wrapper")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
          });
        }
        // Delight: the season line from your own place, carried
        // into the welcome room.
        if (!veil.querySelector(".sphere-rebuild-season-line")) {
          const p = document.createElement("p");
          p.className = "sphere-rebuild-season-line";
          p.hidden = true;
          veil.querySelector(".sphere-ambient-panel")?.appendChild(p);
        }
        if (!veil.querySelector(".sphere-rebuild-daypart-note")) {
          const p = document.createElement("p");
          p.className = "sphere-rebuild-daypart-note";
          p.hidden = true;
          veil.querySelector(".sphere-ambient-panel")?.appendChild(p);
        }
      }
      if ((line && veil) || tries > 40) window.clearInterval(timer);
    }, 150);
  }

  function placeEncounter() {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const host = $(".spark-encounter-host");
      if (host) {
        // The meeting waits below the stage at every width — a
        // door, not a billboard.
        host.classList.add("sphere-rebuild-encounter");
        const veil = $(".sphere-ambient-veil");
        const intro = $("#sphere-intro");
        if (intro && intro.parentElement) intro.after(host);
        else if (veil && veil.parentElement) veil.after(host);
        window.clearInterval(timer);
      }
      if (tries > 40) window.clearInterval(timer);
    }, 200);
  }

  function placeAppEnter() {
    // The app-shell's own enter button joins the controls door.
    // The Rebuild shell is authoritative on arrival — it has
    // already exited the app view — but the app view stays a
    // keeper's choice: Aaron's correction (PR #232 review,
    // Nov 21, 2026) removes the Focus mode's reactivation of
    // the app shell, not the keeper's door into it. Every
    // existing action stays reachable, and the app/full-page
    // switch stays testable, so the button is relocated,
    // never removed.
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const btn = $(".sphere-app-enter");
      const details = $("[data-sphere-rebuild-controls]");
      if (btn && details && btn.parentElement !== details) details.appendChild(btn);
      if (btn || tries > 40) window.clearInterval(timer);
    }, 250);
  }

  /* ── Delight: the season line + the turning daypart ─────────── */

  function watchDelights() {
    const seasonValue = $("#sphere-location-season-value");
    if (seasonValue) {
      const mirror = () => {
        const line = $(".sphere-rebuild-season-line");
        if (!line) return;
        const text = (seasonValue.textContent || "").trim();
        if (text && text !== "Seasonal field unavailable") {
          line.textContent = `From your place: ${text}`;
          line.hidden = false;
        }
      };
      new MutationObserver(mirror).observe(seasonValue, { childList: true, subtree: true, characterData: true });
      mirror();
    }

    let lastBand = bandOf();
    const noteTurn = () => {
      const band = bandOf();
      if (!band || band === lastBand) return;
      lastBand = band;
      const note = $(".sphere-rebuild-daypart-note");
      if (note) {
        note.textContent = `The light has turned to ${band} while you watched.`;
        note.hidden = false;
      }
      const light = $(".sphere-rebuild-light");
      if (light && !reducedMotion) {
        light.classList.remove("sphere-rebuild-light-turn");
        void light.offsetWidth;
        light.classList.add("sphere-rebuild-light-turn");
      }
    };
    new MutationObserver(noteTurn).observe(rootEl, { attributes: true, attributeFilter: ["class"] });
    window.setInterval(noteTurn, 30000);
  }

  function bandOf() {
    const m = (rootEl.className || "").match(/sphere-warm--(\w+)/);
    return m ? m[1] : null;
  }

  /* ── Delight: held light on the instrument ──────────────────── */

  function startHeldLight() {
    const shell = $(".sphere-instrument-shell");
    if (!shell) return;
    const canvas = document.createElement("canvas");
    canvas.className = "sphere-rebuild-light";
    canvas.setAttribute("aria-hidden", "true");
    shell.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let sweepStart = 0;
    const noteSweep = () => { sweepStart = performance.now(); };
    for (const name of ["sof:selected-date-change", "sof:temporal-cursor-change"]) {
      window.addEventListener(name, noteSweep);
    }

    let visible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => { visible = entries[0]?.isIntersecting !== false; }, { threshold: 0.05 }).observe(shell);
    }

    /* Performance (sphere-performance pass): the frame loop used
     * to read getComputedStyle and the shell's client size on
     * EVERY frame — a style recalculation and a layout read per
     * frame on a low-end phone. The hue changes only when the
     * shown Moon changes, and the shell's size changes only on
     * resize, so both are cached: the hue is re-read at most
     * twice a second (the same value the per-frame read would
     * return), and the size is kept by a ResizeObserver. The
     * drawn light is pixel-for-pixel the same. */
    let cachedHue = 36;
    let hueReadAt = -1000;
    function hue(now) {
      if (now - hueReadAt >= 500) {
        hueReadAt = now;
        const raw = getComputedStyle(rootEl).getPropertyValue("--sphere-moon-hue").trim();
        const n = Number.parseFloat(raw);
        cachedHue = Number.isFinite(n) ? n : 36;
      }
      return cachedHue;
    }

    let shellW = 0;
    let shellH = 0;
    const measureShell = () => { shellW = shell.clientWidth; shellH = shell.clientHeight; };
    measureShell();
    if ("ResizeObserver" in window) new ResizeObserver(measureShell).observe(shell);
    else window.addEventListener("resize", measureShell);

    /* Performance (pass 2): the gradient is built once per size
     * and hue (stop ratios 1 and 0.45 fixed) and the breathe
     * rides on globalAlpha — the same colour, pixel for pixel. */
    let gradCache = { key: "", grad: null };
    function lightGradient(w, h, hueValue) {
      const key = w + "x" + h + "|" + hueValue;
      if (gradCache.key === key) return gradCache.grad;
      const cx = w / 2, cy = h * 0.44, r = Math.max(w, h) * 0.62;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `hsla(${hueValue}, 72%, 62%, 1)`);
      grad.addColorStop(0.55, `hsla(${hueValue}, 68%, 48%, 0.45)`);
      grad.addColorStop(1, "hsla(36, 60%, 40%, 0)");
      gradCache = { key, grad };
      return grad;
    }

    function frame(now) {
      if (!reducedMotion) requestAnimationFrame(frame);
      if (frozen || document.hidden || !visible) return;
      if (!shellW || !shellH) measureShell();
      const w = Math.max(2, Math.floor(shellW / 4));
      const h = Math.max(2, Math.floor(shellH / 4));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      ctx.clearRect(0, 0, w, h);
      const breathe = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin((now / 4600) * Math.PI * 2);
      const alpha = 0.07 + breathe * 0.07;
      const cx = w / 2, cy = h * 0.44, r = Math.max(w, h) * 0.62;
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = alpha;
      ctx.fillStyle = lightGradient(w, h, hue(now));
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      // The selection sweep: a soft wedge that answers a day change.
      const sweepAge = now - sweepStart;
      if (!reducedMotion && sweepStart && sweepAge < 900) {
        const t = sweepAge / 900;
        const ang = t * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r * 0.8, ang - 0.5, ang);
        ctx.closePath();
        ctx.fillStyle = `hsla(${hue(now)}, 80%, 66%, ${(1 - t) * 0.12})`;
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    if (reducedMotion) {
      // One still frame of held light; nothing moves.
      frame(0);
      canvas.dataset.staticFrame = "1";
      return;
    }
    requestAnimationFrame(frame);
  }

  /* ── Homestead: the panel takes its place ───────────────────── */

  function wireHomestead() {
    const sidebar = $(".sphere-sidebar");
    if (!sidebar) return;
    const section = document.createElement("div");
    section.className = "sphere-sidebar-section sphere-rebuild-homestead";
    section.setAttribute("data-sphere-homestead-section", "");
    section.innerHTML = `<h2 class="sphere-sidebar-heading">Homestead, for the shown day</h2><div class="sphere-rebuild-homestead-body"><p class="day-world-line">Reading the homestead year…</p></div>`;
    const place = () => {
      const farm = $("[data-sphere-farm-section]", sidebar);
      if (farm) { farm.after(section); return true; }
      return false;
    };
    if (!place()) {
      let tries = 0;
      const timer = window.setInterval(() => {
        tries += 1;
        if (place() || tries > 40) { window.clearInterval(timer); if (!section.parentElement) sidebar.appendChild(section); }
      }, 250);
    }

    const body = section.querySelector(".sphere-rebuild-homestead-body");
    let data = null;
    let currentISO = new Date().toISOString().slice(0, 10);

    const county = () => {
      try { return window.localStorage.getItem("sof.sphere.farm.county.v1") || "lewis"; }
      catch { return "lewis"; }
    };

    const render = () => {
      const Panel = window.CodexSphereHomesteadPanel;
      if (!Panel || !data || !body) return;
      try {
        const advice = Panel.adviceForDate(data, county(), currentISO);
        Panel.renderInto(body, advice);
      } catch { /* the farm room above still speaks for the land */ }
    };

    const applyISO = (iso) => {
      if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso !== currentISO) { currentISO = iso; render(); }
    };

    const applyGlobals = () => {
      const coord = window.SOFCurrentTemporalCoordinate;
      if (coord?.civilDate) { applyISO(coord.civilDate); return; }
      const selected = window.SOF_SELECTED_DATE;
      const PC = window.PatternCalendar;
      if (selected && PC?.fromCivilDate) {
        try {
          const summary = PC.fromCivilDate({ date: selected });
          if (summary?.civilDate) applyISO(summary.civilDate);
        } catch { /* events remain the primary signal */ }
      }
    };

    for (const name of ["sof:selected-date-change", "sof:temporal-cursor-change", "sof:temporal-cursor-ready"]) {
      window.addEventListener(name, (e) => {
        const iso = e?.detail?.coordinate?.civilDate || e?.detail?.civilDate || null;
        if (iso) applyISO(iso); else applyGlobals();
      });
    }
    const strip = $("#sphere-state-strip");
    if (strip) {
      let last = "";
      new MutationObserver(() => {
        const text = (strip.textContent || "").trim();
        if (text && text !== last) { last = text; applyGlobals(); }
      }).observe(strip, { childList: true, subtree: true, characterData: true });
    }

    const script = document.createElement("script");
    script.src = "assets/js/sphere-homestead-panel.js?v=20261119-1";
    script.defer = true;
    script.onload = () => {
      fetch("assets/data/farm-homestead-western-wa.json")
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => { data = json; applyGlobals(); render(); })
        .catch(() => { /* the room keeps its quiet line */ });
    };
    document.head.appendChild(script);
  }

  /* ── Motion: a living drift by default ──────────────────────── */

  function setLivingMotion() {
    if (reducedMotion) return;
    // A link that carries an explicit motion choice (still,
    // reduced) is the keeper's word and stands. The page's own
    // URL state also echoes its current mode back as
    // &motion=drift — that echo is not an override, and must not
    // silence the living default.
    const carried = /[?&#]motion=([a-z]+)/i.exec(arrivalUrl);
    if (carried && carried[1].toLowerCase() !== "drift") return;
    // The rebuild's resting state is alive: drift. Two things
    // work against a one-time setting: the sphere's own state
    // restore can set the select back to "still" seconds later
    // (its init lands late on a slow phone), and the controls
    // themselves are rebuilt during that init — the select this
    // function first holds is not always the select on the page
    // a moment later. So the living default is defended with a
    // fresh lookup for the arrival window, and only there. A
    // keeper who touches the select themselves, or freezes the
    // Sphere, is never fought. (Left undefended, the play room
    // also reads the page as still forever and never wakes.)
    let keeperChose = false;
    const noteKeeper = (event) => { if (event.target?.id === "sphere-motion-mode") keeperChose = true; };
    document.addEventListener("pointerdown", noteKeeper, { capture: true });
    document.addEventListener("keydown", noteKeeper, { capture: true });
    const defend = () => {
      if (keeperChose || frozen) return;
      const motion = $("#sphere-motion-mode");
      if (motion && motion.value === "still") {
        motion.value = "drift";
        motion.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };
    defend();
    for (const delay of [1200, 3000, 6000, 10000, 15000]) window.setTimeout(defend, delay);
  }

  /* ── Boot ───────────────────────────────────────────────────── */

  function boot() {
    // The old app shell (B7.61) enters its own app mode on every
    // load — on the old page, that mode WAS the arrival. The
    // rebuild is the app now (Aaron, Nov 20, 2026: "the sphere as
    // a app needs to be redone. Get rid of it and rework that
    // page"), so the page leaves that mode through the app's own
    // Full page door and builds the new shell here. The old view
    // stays reachable: its Enter control waits in the controls
    // room below. If the exit is ever refused, stand down rather
    // than fight the other shell for the room.
    if (document.body.classList.contains("sphere-app")) {
      const exit = document.querySelector('[data-app-action="fullpage"]');
      if (exit) exit.click();
    }
    if (document.body.classList.contains("sphere-app")) return;
    if (!buildShell()) return;
    watchArming();
    window.setTimeout(setLivingMotion, 400);
    startHeldLight();
    watchDelights();
    wireHomestead();
  }

  window.SphereRebuild = Object.freeze({
    VERSION,
    goToday,
    showDay,
    openSchedule,
    openDayWorld,
    openDeepTime,
    openFarm,
    freeze,
    wake,
    isFrozen: () => frozen,
    selectedLine,
    todayLine: selectedLine,
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
