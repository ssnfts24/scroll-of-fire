/*
 * The Episode Library — the Living Look layer (episodes.html).
 *
 * Presentation only. The shelf, the films and the watch machinery
 * all live in the page's own modules (episode-library.js renders the
 * shelf from the story spine; spark-activities.js keeps the watch
 * record); this layer rebuilds none of them, changes no film, and
 * writes no watch record. It adds the Living Look's four tests to
 * the room:
 *
 *  1. Responds — the stage's one action answers at touch speed: a
 *     press lights the Spark's station at once, and the action takes
 *     the keeper straight to the film or the door it names.
 *  2. Remembers — a film left part-way through resumes where it
 *     stopped. The positions live in this layer's own single local
 *     record (sof.episodes.resume.v1: chapter id → seconds in,
 *     seconds long, when) — local only, one record, and a position
 *     never counts as a watch: the watch machinery's rule (≥90%
 *     truly played, the player's own ended event) stands untouched,
 *     and a resumed film still has to be truly played to count.
 *     A returning keeper is met with "I kept your place," never
 *     with a tally of gaps.
 *  3. One clear action — resume the film you left, or take up the
 *     road at the page's own Continue door. The Spark's station
 *     points at that action.
 *  4. The real day — the breathing intro and the stage carry
 *     today's coordinate from the canonical PatternCalendar, read
 *     only through its public surface (PatternCalendar.fromCivilDate)
 *     with moon names from PatternCalendarData, and the Moon's tint
 *     (the site's living-moon-theme) is the room's light.
 *
 * The headline feature keeps its standing exactly as ruled: it is a
 * FEATURE PRESENTATION, never an episode. This layer never wires it:
 * no resume, no tag, no place on the shelf — the wiring below is
 * scoped to the Watch shelf's own cards and nothing else.
 *
 * Motion only answers; under prefers-reduced-motion the intro is
 * never injected and every decoration stands still.
 */
(() => {
  "use strict";

  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const INTRO_KEY = "sof.episodes.intro.v1";
  const RESUME_KEY = "sof.episodes.resume.v1";

  /* The kept places, read now — before the shelf renders and before
   * anything this visit could play rewrites them. */
  const store = (() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(RESUME_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  })();

  function persist() {
    try { localStorage.setItem(RESUME_KEY, JSON.stringify(store)); } catch { /* the visit still stands */ }
  }

  function fmt(seconds) {
    const s = Math.max(0, Math.round(seconds || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  /* ---------------- today's line, from the canonical calendar -------- */

  function todaySummary() {
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
      return calendar.fromCivilDate({ date: iso, timeZone, boundaryMode: "midnight" });
    } catch { return null; }
  }

  function moonData(summary) {
    try {
      const moons = globalThis.PatternCalendarData && globalThis.PatternCalendarData.moons;
      if (!summary || !summary.insideCountedYear || !Array.isArray(moons)) return null;
      return moons[summary.moon - 1] || null;
    } catch { return null; }
  }

  function todayLine(summary) {
    if (!summary) return null;
    if (summary.insideCountedYear) {
      return `Moon ${summary.moon} · ${summary.moonName} · Day ${summary.day} of 28 · Pattern Day ${summary.dayOfPatternYear}`;
    }
    return summary.isDeepTimeDay ? "Deep Time Day" : "Day Out of Time";
  }

  /* ---------------- the breathing intro ------------------------------ */
  /* Solid ground of its own, slowed to breathe, one tap dismisses it.
   * Injected from here, never hard-coded: no JS or reduced motion
   * means the library simply stands open. Once per session. */

  function showIntro(summary) {
    if (reducedMotion) return;
    try { if (sessionStorage.getItem(INTRO_KEY)) return; } catch { /* show it */ }
    const overlay = document.createElement("div");
    overlay.className = "el-intro";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "The Episode Library — entry");
    const inner = document.createElement("div");
    inner.className = "el-intro-inner";
    const mark = document.createElement("span");
    mark.className = "el-intro-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "▶";
    const name = document.createElement("p");
    name.className = "el-intro-name";
    name.textContent = "The Episode Library";
    const line = document.createElement("p");
    line.className = "el-intro-line";
    line.textContent = todayLine(summary) || "Every film of the road, in one room.";
    const hint = document.createElement("p");
    hint.className = "el-intro-hint";
    hint.textContent = "Tap anywhere to step in";
    inner.append(mark, name, line, hint);
    overlay.appendChild(inner);
    document.body.appendChild(overlay);
    document.body.classList.add("el-intro-lock");

    let gone = false;
    const dismiss = () => {
      if (gone) return;
      gone = true;
      try { sessionStorage.setItem(INTRO_KEY, "1"); } catch { /* the tap still counts */ }
      overlay.classList.add("el-intro-leaving");
      document.body.classList.remove("el-intro-lock");
      window.setTimeout(() => overlay.remove(), 700);
    };
    overlay.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismiss, { once: true });
    window.setTimeout(dismiss, 4600);
  }

  /* ---------------- the stage ---------------------------------------- */

  function fillStage(summary) {
    const line = document.getElementById("episodes-stage-line");
    const essence = document.getElementById("episodes-stage-essence");
    if (line) line.textContent = todayLine(summary) || "The day's line loads with the calendar.";
    const moon = moonData(summary);
    if (essence) {
      essence.textContent = moon
        ? `Under ${moon.name} — ${moon.essence} · ${moon.element} · ${moon.freq}. The road is told under the Moon you are in.`
        : "Outside the counted year — the day stands apart, and the road waits as it was left.";
    }
  }

  /* ---------------- the kept place: mid-watch resume ----------------- */

  const wired = new Map(); /* chapterId -> { card, video, seeked } */

  function freshestResumable() {
    let best = null;
    for (const [chapterId, entry] of Object.entries(store)) {
      if (!entry || !(entry.t > 5) || !wired.has(chapterId)) continue;
      if (!best || (entry.at || 0) > (best.entry.at || 0)) best = { chapterId, entry };
    }
    return best;
  }

  function cardTitle(card) {
    const title = card.querySelector(".episode-card-title");
    return title ? title.textContent.trim() : "the film you left";
  }

  function refreshStage() {
    const welcome = document.getElementById("episodes-welcome");
    const resumeLine = document.getElementById("episodes-resume-line");
    const btn = document.getElementById("episodes-stage-action");
    const best = freshestResumable();
    if (best) {
      const { card } = wired.get(best.chapterId);
      const title = cardTitle(card);
      if (welcome) {
        welcome.textContent =
          `I kept your place — welcome back. You left ${title} part-way through, ` +
          `at ${fmt(best.entry.t)} of ${fmt(best.entry.d)}; its door stands on the shelf below, ` +
          `and it picks up where you stopped.`;
      }
      if (resumeLine) {
        resumeLine.innerHTML = "";
        resumeLine.append("Left mid-watch: ");
        const strong = document.createElement("strong");
        strong.textContent = `${title} — resume at ${fmt(best.entry.t)}`;
        resumeLine.appendChild(strong);
      }
      if (btn) btn.textContent = `Resume ${title}`;
      return best;
    }
    if (welcome && !welcome.dataset.elSet) {
      welcome.dataset.elSet = "1";
      welcome.textContent =
        "Welcome. Every film stands below as a door — its name, its land and its Moon on its face. " +
        "Open any one and the road goes on from there.";
    }
    if (resumeLine) resumeLine.textContent = "";
    if (btn) btn.textContent = "Take up the road";
    return null;
  }

  function tagFor(card, entry) {
    let tag = card.querySelector(".episode-resume-tag");
    if (!entry) { if (tag) tag.remove(); return; }
    if (!tag) {
      tag = document.createElement("p");
      tag.className = "episode-resume-tag";
      const figure = card.querySelector("figure.story-episode");
      if (figure && figure.nextSibling) card.insertBefore(tag, figure.nextSibling);
      else if (figure) card.appendChild(tag);
      else card.appendChild(tag);
    }
    tag.textContent =
      `You left this film at ${fmt(entry.t)} of ${fmt(entry.d)} — press play and it picks up there.`;
  }

  function savePosition(chapterId, video) {
    const t = video.currentTime;
    const d = video.duration;
    if (!isFinite(t) || !isFinite(d) || d <= 0) return;
    if (t < 5 || t / d > 0.97) {
      if (store[chapterId]) { delete store[chapterId]; persist(); }
      const rec = wired.get(chapterId);
      if (rec) tagFor(rec.card, null);
      refreshStage();
      return;
    }
    store[chapterId] = { t: Math.round(t), d: Math.round(d), at: Date.now() };
    persist();
  }

  function wireCard(card) {
    const chapterId = card.getAttribute("data-story-chapter");
    if (!chapterId || wired.has(chapterId)) return;
    const video = card.querySelector("video");
    if (!video) return;
    const rec = { card, video, seeked: false, lastSave: 0 };
    wired.set(chapterId, rec);

    if (store[chapterId]) tagFor(card, store[chapterId]);

    const seekOnce = () => {
      const entry = store[chapterId];
      if (rec.seeked || !entry) return;
      rec.seeked = true;
      try { video.currentTime = entry.t; } catch { /* the film still plays from its head */ }
    };
    video.addEventListener("loadedmetadata", seekOnce);
    video.addEventListener("play", () => {
      seekOnce();
      const orb = document.getElementById("episodes-spark-orb");
      if (orb) orb.classList.add("is-lit");
    });
    video.addEventListener("pause", () => {
      savePosition(chapterId, video);
      if (store[chapterId]) tagFor(card, store[chapterId]);
      refreshStage();
    });
    video.addEventListener("timeupdate", () => {
      const now = Date.now();
      if (now - rec.lastSave < 5000) return;
      rec.lastSave = now;
      savePosition(chapterId, video);
    });
    video.addEventListener("ended", () => {
      if (store[chapterId]) { delete store[chapterId]; persist(); }
      tagFor(card, null);
      refreshStage();
    });
    refreshStage();
  }

  function wireShelf() {
    const shelf = document.getElementById("episode-shelf");
    if (!shelf) return;
    const scan = () => shelf.querySelectorAll("article.episode-card").forEach(wireCard);
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(shelf, { childList: true });
  }

  /* ---------------- the one action ----------------------------------- */

  function stageAction() {
    const best = refreshStage();
    if (best) {
      const rec = wired.get(best.chapterId);
      if (rec) {
        rec.card.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
        const play = () => { rec.video.play().catch(() => { /* the press stands; the keeper presses play */ }); };
        window.setTimeout(play, reducedMotion ? 60 : 450);
        return;
      }
    }
    const door = document.getElementById("continue");
    if (door) door.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }

  function init() {
    const summary = todaySummary();
    showIntro(summary);
    fillStage(summary);
    refreshStage();
    wireShelf();
    const btn = document.getElementById("episodes-stage-action");
    if (btn) {
      btn.addEventListener("click", stageAction);
      btn.addEventListener("pointerdown", () => {
        const orb = document.getElementById("episodes-spark-orb");
        if (orb) orb.classList.add("is-lit");
      });
    }
    window.addEventListener("pagehide", () => {
      for (const [chapterId, rec] of wired) {
        if (!rec.video.ended) savePosition(chapterId, rec.video);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
