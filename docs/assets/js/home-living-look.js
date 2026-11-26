/*
 * The front door — the Living Look layer (docs/index.html).
 *
 * Presentation only. The door's day, telling and practice are spoken
 * by ambient-door.js; the record is kept by Codex Memory; this layer
 * writes nothing, computes no date of its own, and rebuilds nothing.
 * It adds the Living Look's four tests to the door:
 *
 *  1. Responds — touching the one clear action lights the Spark's
 *     station at once, before the Sphere page even loads.
 *  2. Remembers — a returning keeper is welcomed with "I kept your
 *     place," drawn ONLY from the homepage's own existing records:
 *     Codex Memory (sof.codexMemory.v1, through its public API) and
 *     the Scroll reader's sof-scroll-last-passage — the same two
 *     records, in the same order, that living-codex.js already reads
 *     for its continue panel deep in the page. One record, surfaced
 *     at the door; nothing new is stored.
 *  3. One clear action — Enter the Sphere, styled first by the
 *     layer's sheet; the station points at it.
 *  4. The real day — one welcome line on the door's face carrying
 *     the civil date, the Moon and the Pattern Day together, read
 *     from the canonical PatternCalendar through its public surface.
 *
 * No absence is ever framed as a failure. Motion only answers;
 * under prefers-reduced-motion the layer still speaks the day and
 * the kept place, and nothing moves.
 */
(() => {
  "use strict";

  const door = document.querySelector("[data-ambient-door]");
  if (!door) return;

  /* ---------------- today's line, from the canonical calendar -------- */

  function todayMapping() {
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
      return calendar.fromCivilDate({ date: iso, timeZone, boundaryMode: "midnight" }) || null;
    } catch { return null; }
  }

  function fillDayLine() {
    const host = door.querySelector("[data-ll-day-text]");
    if (!host) return;
    const civil = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
    const mapped = todayMapping();
    if (mapped && mapped.insideCountedYear) {
      host.textContent =
        `${civil} · Moon ${mapped.moon}${mapped.moonName ? ` · ${mapped.moonName}` : ""}` +
        ` · Day ${mapped.day} · Pattern Day ${mapped.dayOfPatternYear}`;
    } else if (mapped) {
      host.textContent = `${civil} · ${mapped.isDeepTimeDay ? "Deep Time Day" : (mapped.moonName || "Day Out of Time")}`;
    } else {
      host.textContent = civil;
    }
  }

  /* ---------------- the kept place ----------------------------------- */
  /* The homepage's own records only, read — never written. The href
   * is held to this site, the same fence living-codex.js keeps. */

  function safeLocalHref(url) {
    try {
      const base = new URL(document.baseURI);
      const target = new URL(String(url || ""), base);
      if (target.origin !== base.origin && target.origin !== "https://codexofreality.org") return null;
      const basePath = base.pathname.endsWith("/")
        ? base.pathname
        : base.pathname.slice(0, base.pathname.lastIndexOf("/") + 1);
      const targetPath = target.pathname.startsWith(basePath)
        ? target.pathname
        : basePath + target.pathname.replace(/^\/+/, "");
      return `./${targetPath.slice(basePath.length)}${target.search}${target.hash}`;
    } catch { return null; }
  }

  function readScrollResume() {
    try {
      const passage = JSON.parse(localStorage.getItem("sof-scroll-last-passage") || "null");
      if (!passage || typeof passage.id !== "string" || !passage.id.trim() ||
          typeof passage.title !== "string" || !passage.title.trim()) return null;
      return {
        href: `./scroll/reader.html?section=${encodeURIComponent(passage.id.trim())}#reading`,
        label: `Continue reading: ${passage.title.trim().slice(0, 120)}`
      };
    } catch { return null; }
  }

  function fillResume() {
    const host = door.querySelector("[data-ll-resume]");
    const link = door.querySelector("[data-ll-resume-link]");
    if (!host || !link) return;
    try {
      const memory = window.CodexMemory;
      if (memory && typeof memory.isResumeDismissed === "function" && memory.isResumeDismissed()) return;
      let offer = null;
      if (memory && typeof memory.getResumePath === "function") {
        const resume = memory.getResumePath();
        if (resume && resume.href && resume.label) {
          const href = safeLocalHref(resume.href);
          if (href) offer = { href, label: `Return to ${resume.label}` };
        }
      }
      if (!offer) offer = readScrollResume();
      if (!offer) return;
      link.href = offer.href;
      link.textContent = offer.label;
      host.hidden = false;
    } catch { /* no kept place to speak of — the door simply stands open */ }
  }

  /* ---------------- the Spark answers the touch ---------------------- */

  function wireSpark() {
    const orb = door.querySelector(".ll-spark-orb");
    const action = door.querySelector("[data-ll-enter]");
    if (!orb || !action) return;
    const light = () => orb.classList.add("is-lit");
    const rest = () => window.setTimeout(() => orb.classList.remove("is-lit"), 600);
    action.addEventListener("pointerdown", light);
    action.addEventListener("focus", light);
    action.addEventListener("pointerup", rest);
    action.addEventListener("blur", rest);
  }

  fillDayLine();
  fillResume();
  wireSpark();
})();
