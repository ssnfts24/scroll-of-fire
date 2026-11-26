/*
 * The Pattern Garden — the Living Look layer (garden.html).
 *
 * The garden's own record, beds, and rules all live in
 * pattern-garden.js and the Life Atlas; this layer never writes that
 * record, never computes a date of its own, and rebuilds nothing.
 * What this layer DOES keep is its own small tending record — the
 * Episodes resume-record precedent: a layer-local record, separate
 * from the house records, holding only this layer's own acts.
 *
 *  sof.pattern-garden.tending.v1 — per-bed tending marks:
 *    { beds: { "moon-8": [ { kind, patternDay, moon, day }, … ] } }
 *  kinds: "tended" | "watered" | "witnessed". Each mark carries the
 *  Pattern Day it happened, read from the canonical PatternCalendar
 *  only. One mark per kind per bed per Pattern Day — a second tap the
 *  same day answers "kept", it never stacks a duplicate. "witnessed"
 *  is never minted by this layer's own buttons: it is read off the
 *  garden's own Witness act standing done on the bed's face, so the
 *  mark is the house act's shadow, dated the day it stands.
 *
 * The Living Look's four tests, at the deeper level:
 *  1. Responds — tending answers at touch speed: the bed's face
 *     changes the moment a mark is made.
 *  2. Remembers — the tending record is spoken back on return, in
 *     welcome language, read from the record, never invented:
 *     "You tended this bed on Pattern Day N." No absence framing,
 *     anywhere: a returning keeper is met with "I kept your place,"
 *     never a list of misses.
 *  3. One clear action — the Spark's station points at the one
 *     tending action, which now does real work: it tends today's bed
 *     (a mark is kept) and takes the keeper straight to it.
 *  4. The real day — the breathing intro and the stage carry today's
 *     coordinate from the canonical PatternCalendar, today's bed is
 *     marked in gold with the Spark standing in it, and every mark is
 *     stamped with the real Pattern Day it happened on.
 *
 * The county picker and the guide picker are woven into the stage —
 * the same elements, moved, never rebuilt, so every listener the
 * garden's own engine hung on them stands.
 *
 * A bed with nothing in it says so plainly and waits. Motion only
 * answers; under prefers-reduced-motion the intro is never injected
 * and every decoration stands still.
 */
(() => {
  "use strict";

  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const VISITED_KEY = "sof.pattern-garden.visited.v1";
  const INTRO_KEY = "sof.pattern-garden.intro.v1";
  const TENDING_KEY = "sof.pattern-garden.tending.v1";

  const KIND_LABEL = { tended: "Tended", watered: "Watered", witnessed: "Witnessed" };
  const KIND_VERB = { tended: "tended", watered: "watered", witnessed: "witnessed" };

  /* ---------------- today, from the canonical calendar only -------- */

  function todayCoord() {
    try {
      const calendar = globalThis.PatternCalendar;
      if (!calendar || typeof calendar.fromCivilDate !== "function") return null;
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(new Date());
      const get = t => (parts.find(p => p.type === t) || {}).value;
      if (!get("year")) return null;
      const iso = `${get("year")}-${get("month")}-${get("day")}`;
      const mapped = calendar.fromCivilDate({ date: iso, timeZone, boundaryMode: "midnight" });
      if (!mapped) return null;
      if (mapped.insideCountedYear) {
        return { moon: mapped.moon, day: mapped.day, patternDay: mapped.dayOfPatternYear, outside: null };
      }
      return { moon: null, day: null, patternDay: null, outside: mapped.isDeepTimeDay ? "Deep Time Day" : "Day Out of Time" };
    } catch { return null; }
  }

  function todayLine() {
    const c = todayCoord();
    if (!c) return null;
    if (c.patternDay != null) return `Moon ${c.moon} · Day ${c.day} · Pattern Day ${c.patternDay}`;
    return c.outside;
  }

  function dayStamp(coord) {
    if (!coord) return "today";
    return coord.patternDay != null ? `Pattern Day ${coord.patternDay}` : coord.outside;
  }

  /* ---------------- the layer's own tending record ----------------- */

  function readTending() {
    try {
      const raw = localStorage.getItem(TENDING_KEY);
      if (!raw) return { beds: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.beds || typeof parsed.beds !== "object") {
        return { beds: {} };
      }
      return parsed;
    } catch { return { beds: {} }; }
  }

  function writeTending(record) {
    try { localStorage.setItem(TENDING_KEY, JSON.stringify(record)); } catch { /* the act still answers on the face */ }
  }

  /* One mark per kind per bed per day. Returns true when a new mark
   * was kept, false when that mark already stands for today. */
  function addMark(bedId, kind, coord) {
    if (!bedId || !KIND_LABEL[kind] || !coord) return false;
    const record = readTending();
    const marks = Array.isArray(record.beds[bedId]) ? record.beds[bedId] : [];
    const already = marks.some(m =>
      m.kind === kind &&
      (coord.patternDay != null ? m.patternDay === coord.patternDay : m.outside === coord.outside));
    if (already) return false;
    marks.push({
      kind,
      patternDay: coord.patternDay,
      moon: coord.moon,
      day: coord.day,
      outside: coord.outside || null
    });
    record.beds[bedId] = marks;
    writeTending(record);
    return true;
  }

  function marksFor(bedId) {
    const record = readTending();
    return Array.isArray(record.beds[bedId]) ? record.beds[bedId] : [];
  }

  function markDayLabel(mark, coord) {
    if (mark.patternDay != null) {
      const today = coord && coord.patternDay === mark.patternDay;
      return `Pattern Day ${mark.patternDay}${today ? " (today)" : ""}`;
    }
    return mark.outside || "today";
  }

  /* ---------------- the breathing intro ------------------------------ */
  /* Solid ground of its own, slowed to breathe, one tap dismisses it.
   * Injected from here, never hard-coded: no JS or reduced motion
   * means the garden simply stands open. Once per session. */

  function showIntro() {
    if (reducedMotion) return;
    try { if (sessionStorage.getItem(INTRO_KEY)) return; } catch { /* show it */ }
    const overlay = document.createElement("div");
    overlay.className = "gl-intro";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "The Pattern Garden — entry");
    const inner = document.createElement("div");
    inner.className = "gl-intro-inner";
    const mark = document.createElement("span");
    mark.className = "gl-intro-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "☲";
    const name = document.createElement("p");
    name.className = "gl-intro-name";
    name.textContent = "The Pattern Garden";
    const line = document.createElement("p");
    line.className = "gl-intro-line";
    line.textContent = todayLine() || "Thirteen beds, one for each Moon.";
    const hint = document.createElement("p");
    hint.className = "gl-intro-hint";
    hint.textContent = "Tap anywhere to step in";
    inner.append(mark, name, line, hint);
    overlay.appendChild(inner);
    document.body.appendChild(overlay);
    document.body.classList.add("gl-intro-lock");

    let gone = false;
    const dismiss = () => {
      if (gone) return;
      gone = true;
      try { sessionStorage.setItem(INTRO_KEY, "1"); } catch { /* the tap still counts */ }
      overlay.classList.add("gl-intro-leaving");
      document.body.classList.remove("gl-intro-lock");
      window.setTimeout(() => overlay.remove(), 700);
    };
    overlay.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismiss, { once: true });
    window.setTimeout(dismiss, 4600);
  }

  /* ---------------- the kept place, spoken back ---------------------- */

  function latestMark() {
    const record = readTending();
    let best = null;
    for (const [bedId, marks] of Object.entries(record.beds)) {
      for (const mark of marks) {
        if (!best) { best = { bedId, mark }; continue; }
        const a = mark.patternDay != null ? mark.patternDay : -1;
        const b = best.mark.patternDay != null ? best.mark.patternDay : -1;
        if (a >= b) best = { bedId, mark };
      }
    }
    return best;
  }

  function bedName(bedId) {
    const card = document.querySelector(`.garden-bed[data-bed-id="${bedId}"] h3`);
    if (card) return card.textContent.trim();
    const moon = /^moon-(\d+)$/.exec(bedId || "");
    return moon ? `Moon ${moon[1]}` : "this bed";
  }

  let visitKnown = false;
  let isReturning = false;

  function welcome() {
    const host = document.getElementById("garden-welcome");
    if (!host) return;
    if (!visitKnown) {
      visitKnown = true;
      try {
        isReturning = Boolean(localStorage.getItem(VISITED_KEY));
        localStorage.setItem(VISITED_KEY, new Date().toISOString());
      } catch { /* the welcome still stands for this visit */ }
    }
    if (!isReturning) {
      host.textContent = "Welcome to the garden. Thirteen beds stand ready, one for each Moon — today's is lit in gold.";
      return;
    }
    const latest = latestMark();
    if (latest) {
      const coord = todayCoord();
      const when = latest.mark.patternDay != null
        ? (coord && coord.patternDay === latest.mark.patternDay
            ? "today"
            : `on ${markDayLabel(latest.mark, coord)}`)
        : "";
      host.textContent =
        `I kept your place — welcome back. You ${KIND_VERB[latest.mark.kind]} the ${bedName(latest.bedId)} bed ${when}.`.replace(/\s+/g, " ");
    } else {
      host.textContent = "I kept your place — welcome back. Your beds stand as your record holds them.";
    }
  }

  /* ---------------- tending: the beds answer ------------------------- */

  function renderTending(card, coord) {
    const bedId = card.dataset.bedId;
    if (!bedId) return;
    const marks = marksFor(bedId);

    let strip = card.querySelector(":scope > .gl-tending");
    if (!strip) {
      strip = document.createElement("div");
      strip.className = "gl-tending";
      const acts = document.createElement("p");
      acts.className = "gl-tending-acts";
      for (const kind of ["tended", "watered"]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "gl-tend-act";
        btn.dataset.glKind = kind;
        btn.addEventListener("click", () => {
          const now = todayCoord();
          addMark(bedId, kind, now);
          renderTending(card, now);
          welcome();
        });
        acts.appendChild(btn);
      }
      const line = document.createElement("p");
      line.className = "gl-tending-marks";
      line.setAttribute("aria-live", "polite");
      strip.append(acts, line);
      card.appendChild(strip);
    }

    const doneToday = kind => marks.some(m =>
      m.kind === kind &&
      (coord && coord.patternDay != null ? m.patternDay === coord.patternDay : m.outside === (coord && coord.outside)));
    for (const btn of strip.querySelectorAll(".gl-tend-act")) {
      const kind = btn.dataset.glKind;
      const done = doneToday(kind);
      btn.disabled = done;
      const label = done ? `${KIND_LABEL[kind]} today ✓` : kind === "tended" ? "Tend this bed" : "Water this bed";
      if (btn.textContent !== label) btn.textContent = label;
    }

    const line = strip.querySelector(".gl-tending-marks");
    if (marks.length) {
      const latestByKind = [];
      for (const kind of ["tended", "watered", "witnessed"]) {
        const ofKind = marks.filter(m => m.kind === kind);
        if (ofKind.length) latestByKind.push(`${KIND_LABEL[kind]} on ${markDayLabel(ofKind[ofKind.length - 1], coord)}`);
      }
      const text = `Kept in this bed's own tending record: ${latestByKind.join(" · ")}` +
        (marks.length > latestByKind.length ? ` — ${marks.length} marks in all.` : ".");
      if (line.textContent !== text) line.textContent = text;
    } else if (line.textContent !== "") {
      line.textContent = "";
    }

    const tendedToday = marks.some(m =>
      coord && coord.patternDay != null ? m.patternDay === coord.patternDay : m.outside === (coord && coord.outside));
    card.classList.toggle("gl-bed-tended-today", tendedToday);
  }

  /* ---------------- the beds: today's face, plainly resting beds ----- */

  function decorateBeds() {
    const host = document.getElementById("garden-beds");
    if (!host) return;
    const coord = todayCoord();
    for (const card of host.querySelectorAll(".garden-bed")) {
      /* The garden's own Witness act, standing done on the bed's face,
       * casts this layer's witnessed mark — dated today, deduped. */
      const witnessDone = [...card.querySelectorAll("button")]
        .some(b => /^Witnessed today/.test(b.textContent.trim()));
      if (witnessDone && card.dataset.bedId) addMark(card.dataset.bedId, "witnessed", coord);

      if (!card.dataset.glDecorated) {
        card.dataset.glDecorated = "1";
        if (card.classList.contains("garden-bed-open")) {
          const badge = document.createElement("p");
          badge.className = "gl-bed-badge";
          const spark = document.createElement("span");
          spark.className = "gl-spark-dot";
          spark.setAttribute("aria-hidden", "true");
          badge.append(spark, document.createTextNode("Today's bed — your Spark is here"));
          card.prepend(badge);
        }
        const hasPlanting = card.querySelector(".garden-bed-growth");
        const hasChoices = card.querySelector(".garden-plant-choices");
        const hasNote = card.querySelector(".garden-bed-note");
        if (!hasPlanting && !hasChoices && !hasNote) {
          const empty = document.createElement("p");
          empty.className = "gl-bed-empty";
          empty.textContent = card.classList.contains("garden-bed-open")
            ? "This bed stands open and empty today. What the farm record offers for it stands below — plant when you are ready."
            : "Nothing is planted in this bed. It rests, and waits for its Moon.";
          card.appendChild(empty);
        }
      }
      renderTending(card, coord);
    }
    /* The tending action learns today's bed's name once it stands. */
    const tend = document.getElementById("garden-tend-btn");
    const open = host.querySelector(".garden-bed-open h3");
    if (tend && open) {
      tend.textContent = `Tend today's bed — ${open.textContent}`;
    }
    welcome();
  }

  function watchBeds() {
    const host = document.getElementById("garden-beds");
    if (!host) return;
    decorateBeds();
    const observer = new MutationObserver(() => {
      observer.disconnect();
      decorateBeds();
      observer.observe(host, { childList: true, subtree: true });
    });
    observer.observe(host, { childList: true, subtree: true });
  }

  /* ---------------- the pickers, woven into the stage ---------------- */
  /* The same elements the page already carries, moved into the stage —
   * never rebuilt, so the garden engine's listeners stand untouched. */

  function weavePickers() {
    const stage = document.querySelector(".garden-stage");
    if (!stage) return;
    const countyRow = document.querySelector(".garden-county-row:has(#garden-county)");
    const countyNote = document.querySelector(".garden-county-note");
    const guideRow = document.querySelector(".garden-county-row:has(#garden-guide-crop)");
    if (!countyRow && !guideRow) return;
    const tools = document.createElement("div");
    tools.className = "gl-stage-tools";
    const head = document.createElement("p");
    head.className = "gl-tools-head";
    head.textContent = "Ground and guides, at hand in the stage";
    tools.appendChild(head);
    if (countyRow) tools.appendChild(countyRow);
    if (countyNote) tools.appendChild(countyNote);
    if (guideRow) tools.appendChild(guideRow);
    stage.appendChild(tools);
  }

  /* ---------------- the one tending action --------------------------- */

  function wireTend() {
    const btn = document.getElementById("garden-tend-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const open = document.querySelector(".garden-bed-open");
      const target = open || document.getElementById("garden-beds");
      if (!target) return;
      /* The one action does real work now: it tends today's bed, and
       * the mark is kept in this layer's own record. */
      if (open && open.dataset.bedId) {
        const coord = todayCoord();
        addMark(open.dataset.bedId, "tended", coord);
        renderTending(open, coord);
        let note = document.getElementById("garden-tending-note");
        if (!note) {
          note = document.createElement("p");
          note.id = "garden-tending-note";
          note.className = "garden-tending-note";
          note.setAttribute("aria-live", "polite");
          btn.closest(".garden-spark-station")?.after(note);
        }
        note.textContent = `Tended today — ${dayStamp(coord)}. The mark is kept in this garden's own tending record, on this device.`;
        welcome();
      }
      target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      const witness = open
        ? [...open.querySelectorAll("button")].find(b => /witness/i.test(b.textContent) && !b.disabled)
        : null;
      window.setTimeout(() => { if (witness) witness.focus({ preventScroll: true }); }, reducedMotion ? 0 : 450);
    });
  }

  function init() {
    showIntro();
    welcome();
    weavePickers();
    watchBeds();
    wireTend();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
