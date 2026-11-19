/* Living Moon Theme — the whole site changes with the moon and the day.
 *
 * One shared mechanism: every page that carries this module reads TODAY from
 * the canonical pipeline only (PatternCalendar.fromCivilDate, the same engine
 * the living openings use — no private calendar math here) and stamps the
 * document: html[data-moon], html[data-pattern-day], html[data-daypart].
 * All change is presentation through the variables in living-moon-theme.css.
 * Facts on pages never vary; the theme is a function of the date and the
 * visitor's local hour only — the same for everyone, nothing tracked.
 *
 * The day line + today's one thing: a slim bar at the top of the page showing
 * the day's place in its moon (fill = day/28) and ONE clear thing to do that
 * fits the day. The one thing is drawn only from the calendar's own data —
 * PatternCalendarData.dayArchetypes[day-1] as returned by the canonical
 * summary — and links to the day's telling on the 13 Moons page. On the Day
 * Out of Time there is no archetype in the data, so the bar carries the
 * coordinate alone as the door; no practice is invented.
 */
(() => {
  "use strict";

  function daypartFor(hour) {
    if (hour < 5) return "night";
    if (hour < 11) return "morning";
    if (hour < 17) return "day";
    if (hour < 20) return "dusk";
    return "night";
  }

  function todayISOInZone(timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(new Date());
      const get = (t) => (parts.find((p) => p.type === t) || {}).value;
      if (get("year") && get("month") && get("day")) {
        return `${get("year")}-${get("month")}-${get("day")}`;
      }
    } catch (error) { /* fall through */ }
    return null;
  }

  function apply() {
    const root = document.documentElement;
    const now = new Date();
    root.dataset.daypart = daypartFor(now.getHours());
    root.style.setProperty("--lmt-hour", String(now.getHours()));

    let summary = null;
    try {
      const calendar = globalThis.PatternCalendar;
      if (calendar && typeof calendar.fromCivilDate === "function") {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        const iso = todayISOInZone(timeZone);
        if (iso) {
          summary = calendar.fromCivilDate({ date: iso, timeZone, boundaryMode: "midnight" });
        }
      }
    } catch (error) { summary = null; }
    if (!summary) return; // never guess a coordinate

    const bar = document.createElement("div");
    bar.className = "lmt-dayline";
    bar.setAttribute("role", "note");

    if (summary.insideCountedYear) {
      root.dataset.moon = String(summary.moon);
      root.dataset.patternDay = String(summary.dayOfPatternYear);
      root.dataset.moonDay = String(summary.day);
      root.style.setProperty("--lmt-day-progress", (summary.day / 28).toFixed(4));
      root.style.setProperty("--lmt-day-shift", (((summary.day - 1) / 27) * 18).toFixed(2) + "%");

      const coord = document.createElement("span");
      coord.className = "lmt-dayline-coord";
      coord.textContent = `Moon ${summary.moon} · ${summary.moonName} · Day ${summary.day} of 28`;

      const track = document.createElement("span");
      track.className = "lmt-dayline-track";
      track.setAttribute("aria-hidden", "true");
      const fill = document.createElement("span");
      fill.className = "lmt-dayline-fill";
      track.appendChild(fill);

      bar.append(coord, track);

      const archetype = summary.dayArchetype;
      if (Array.isArray(archetype) && archetype.length >= 2) {
        const door = document.createElement("a");
        door.className = "lmt-onething";
        door.href = "moons.html";
        door.innerHTML = "";
        const label = document.createElement("span");
        label.className = "lmt-onething-label";
        label.textContent = "Today's one thing:";
        const text = document.createElement("span");
        text.className = "lmt-onething-text";
        text.textContent = `${archetype[0]} — ${archetype[1]}`;
        door.append(label, text);
        bar.appendChild(door);
      }
    } else {
      root.dataset.moon = "outside";
      root.dataset.patternDay = "outside";
      root.style.setProperty("--lmt-day-progress", "0");
      const coord = document.createElement("a");
      coord.className = "lmt-onething";
      coord.href = "moons.html";
      const label = document.createElement("span");
      label.className = "lmt-onething-label";
      label.textContent = summary.isDeepTimeDay ? "Deep Time Day" : "Day Out of Time";
      const text = document.createElement("span");
      text.className = "lmt-onething-text";
      text.textContent = "Outside the count — read the day's telling";
      coord.append(label, text);
      bar.appendChild(coord);
    }

    document.body.insertBefore(bar, document.body.firstChild);
    root.dataset.lmt = "on";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply, { once: true });
  } else {
    apply();
  }
})();
