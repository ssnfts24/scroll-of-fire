/**
 * Play with the Sphere (Nov 20, 2026).
 *
 * Aaron: "The sphere should be fun and interactive too." These
 * are the instrument's own games — played WITH the real calendar,
 * on the real Sphere. A game never shows a false day: the hunt's
 * target is a true Pattern coordinate, the echo is the Spark's own
 * motif from its seed, and the turning is the day's real turning.
 * (The hidden-layer study, PR #198, refused random finds ON the
 * Sphere page; Aaron's word opens the Sphere to play — instrument-
 * native games, yes; scattered loot on the instrument, still no.)
 *
 * Three games, offered plainly in one room near the Spark, never
 * forced, never covering the Sphere:
 *   - Find the day — the Spark names a coordinate; the keeper
 *     spins, taps or jumps the Sphere until the shown day IS that
 *     day. Found by moving the instrument, not by pressing an
 *     answer button.
 *   - Echo — call-and-response from the living-voice design: the
 *     Spark sounds a few notes of its motif; the keeper taps the
 *     same notes back on the pads.
 *   - Catch the turning — armed with one tap, it waits for the
 *     daypart light to really turn (dawn, day, dusk, night) and
 *     gives the keeper a minute to catch it.
 *
 * Everything is bound to the one clock: every finished round is
 * written to the keeper's one record (the Spark record's play
 * log) stamped with its Pattern coordinate from the canonical
 * cursor — never a second clock — so patterns can be traced
 * across days, practices and play, and the Spark can surface
 * them truthfully. Still mode quiets the whole room.
 */
(function () {
  "use strict";

  const VERSION = "sphere-play/1.0.0";
  const $ = (sel, base) => (base || document).querySelector(sel);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function isStill() {
    if (document.documentElement.classList.contains("sphere-frozen")) return true;
    const motion = $("#sphere-motion-mode");
    return Boolean(motion && motion.value === "still");
  }

  function shownCoordinate() {
    // The published coordinate carries its Pattern day inside
    // the 13-Moons adapter's reading, not at the top level.
    const c = window.SOFCurrentTemporalCoordinate;
    const pd = c?.remnant13Moons?.patternDay ?? c?.adapters?.remnant13Moons?.patternDay ?? null;
    return pd != null ? { dayOfPatternYear: pd } : null;
  }

  function buildPlayRoom() {
    const talk = $("[data-sphere-spark-talk]");
    const sidebar = $(".sphere-sidebar");
    if ((!talk && !sidebar) || $("[data-sphere-play]")) return null;

    const section = document.createElement("section");
    section.className = "sphere-play";
    section.setAttribute("data-sphere-play", "");
    section.setAttribute("aria-label", "Play with the Sphere");
    section.innerHTML = `
      <h2 class="sphere-play-title">Play with the Sphere</h2>
      <p class="sphere-play-line">Three small games, played on the real Sphere. Nothing here ever shows a false day.</p>
      <div class="sphere-play-games">
        <div class="sphere-play-game" data-play-hunt>
          <h3>Find the day</h3>
          <p class="sphere-play-status" role="status">The Spark names a day. Spin or tap the Sphere until the day you are looking at is that day.</p>
          <button type="button" class="sphere-play-btn" data-play-hunt-start>Play</button>
        </div>
        <div class="sphere-play-game" data-play-echo>
          <h3>Echo</h3>
          <p class="sphere-play-status" role="status">Listen to your Spark's notes, then tap them back in the same order.</p>
          <div class="sphere-play-pads" role="group" aria-label="Echo pads"></div>
          <button type="button" class="sphere-play-btn" data-play-echo-start>Play</button>
        </div>
        <div class="sphere-play-game" data-play-turning>
          <h3>Catch the turning</h3>
          <p class="sphere-play-status" role="status">The day's light turns four times — dawn, day, dusk, night. Arm this, and catch the next turning while it happens.</p>
          <button type="button" class="sphere-play-btn" data-play-turning-arm>Arm</button>
          <button type="button" class="sphere-play-btn sphere-play-catch" data-play-turning-catch hidden>Caught it!</button>
        </div>
      </div>
      <p class="sphere-play-record" role="status"></p>`;
    if (talk) talk.after(section); else sidebar.after(section);

    const recordLine = section.querySelector(".sphere-play-record");
    const noteRecord = () => {
      const Spark = window.SphereSpark;
      if (!Spark?.hasCompanion?.()) {
        recordLine.textContent = "Meet your Spark (just above) and every game you finish joins your record, stamped with its Pattern day.";
        return;
      }
      const s = Spark.playSummary();
      recordLine.textContent = s.total
        ? `In your record: ${s.total} game${s.total === 1 ? "" : "s"} stamped in Pattern time${s.thisMoon ? `, ${s.thisMoon} this Moon` : ""}${s.usualDaypart ? `. You play most often at ${s.usualDaypart}` : ""}. Ask your Spark about your patterns any time.`
        : "Every game you finish joins your record, stamped with its Pattern day.";
    };
    noteRecord();
    window.setTimeout(noteRecord, 1500);

    const stillLine = () => {
      const still = isStill();
      section.classList.toggle("sphere-play-still", still);
      for (const btn of section.querySelectorAll(".sphere-play-btn")) {
        if (still) { btn.disabled = true; btn.dataset.stillOff = "1"; }
        else if (btn.dataset.stillOff) { btn.disabled = false; delete btn.dataset.stillOff; }
      }
      if (still) recordLine.textContent = "Play rests while the Sphere is still. Wake it, and the games wake too.";
      else noteRecord();
    };

    /* ── Find the day ─────────────────────────────────────────── */
    const huntStatus = section.querySelector("[data-play-hunt] .sphere-play-status");
    const huntBtn = section.querySelector("[data-play-hunt-start]");
    let huntTarget = null;

    function endHunt(won) {
      if (!huntTarget) return;
      const target = huntTarget;
      huntTarget = null;
      huntBtn.textContent = "Play again";
      if (won) {
        huntStatus.textContent = `You found it — Moon ${target.moon} · Day ${target.day}. The Sphere itself says so.`;
        window.SphereSpark?.soundMotif?.("day");
        window.SphereSpark?.logPlay?.("hunt", { target: { moon: target.moon, day: target.day, patternDay: target.patternDay } });
        noteRecord();
      }
    }

    huntBtn.addEventListener("click", () => {
      const PC = window.PatternCalendar;
      if (!PC?.fromCivilDate) { huntStatus.textContent = "The calendar is still waking up — try again in a moment."; return; }
      // A true coordinate, a little way from today, drawn from the
      // calendar itself. The game names it; the keeper finds it.
      const today = PC.fromCivilDate({ date: new Date() });
      const todayPd = today?.dayOfPatternYear || 218;
      let pd = todayPd + 20 + Math.floor(Math.random() * 120);
      if (pd > 364) pd -= 364;
      if (pd === todayPd) pd = (pd % 364) + 1;
      const moon = Math.floor((pd - 1) / 28) + 1;
      const day = ((pd - 1) % 28) + 1;
      huntTarget = { moon, day, patternDay: pd };
      huntStatus.textContent = `Find this day: Moon ${moon} · Day ${day}. Spin the Sphere, tap a moon and a day, or use Choose a day — the Sphere will tell you when you are standing on it.`;
      $(".sphere-wrapper")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });

    const checkHunt = () => {
      if (!huntTarget) return;
      const shown = shownCoordinate();
      if (shown && Number(shown.dayOfPatternYear) === huntTarget.patternDay) endHunt(true);
    };
    for (const name of ["sof:selected-date-change", "sof:temporal-cursor-change"]) {
      window.addEventListener(name, checkHunt);
    }

    /* ── Echo ─────────────────────────────────────────────────── */
    const echoStatus = section.querySelector("[data-play-echo] .sphere-play-status");
    const echoBtn = section.querySelector("[data-play-echo-start]");
    const padsEl = section.querySelector(".sphere-play-pads");
    let echoSequence = [];
    let echoStep = 0;
    let echoPads = [];

    function buildEcho() {
      const Core = window.SparkCompanion;
      const Spark = window.SphereSpark;
      padsEl.innerHTML = "";
      echoPads = [];
      if (!Core || !Spark?.hasCompanion?.()) {
        echoStatus.textContent = "The echo is your Spark's own motif — meet your Spark above, and this game wakes.";
        echoBtn.disabled = true;
        return;
      }
      try {
        const raw = window.localStorage.getItem(Core.STORAGE_KEY);
        const record = raw ? JSON.parse(raw) : null;
        const companion = record ? Core.generate(record.seed) : null;
        if (!companion) return;
        const call = Core.livingCallFor ? Core.livingCallFor({ companion, record, hour: new Date().getHours() }) : null;
        const pads = call?.pads?.length ? call.pads : [{ note: 440 }, { note: 550 }, { note: 660 }, { note: 880 }];
        echoPads = pads.slice(0, 4);
        echoPads.forEach((pad, i) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "sphere-play-pad";
          b.style.setProperty("--pad-hue", String(Math.round(30 + i * 28)));
          b.setAttribute("aria-label", `Echo pad ${i + 1}`);
          b.addEventListener("click", () => {
            Spark.soundNote(pad.note, 0.32);
            b.classList.add("sphere-play-pad-lit");
            window.setTimeout(() => b.classList.remove("sphere-play-pad-lit"), 240);
            if (!echoSequence.length) return;
            if (echoSequence[echoStep] === i) {
              echoStep += 1;
              if (echoStep >= echoSequence.length) {
                echoStatus.textContent = "That is the motif, note for note. Your Spark heard itself in you.";
                Spark.soundMotif("day");
                Spark.logPlay("echo", { notes: echoSequence.length });
                echoSequence = [];
                echoBtn.textContent = "Play again";
                noteRecord();
              } else {
                echoStatus.textContent = `Good — ${echoStep} of ${echoSequence.length}. Keep going.`;
              }
            } else {
              echoStatus.textContent = "Not quite that note. Listen once more, then try again.";
              echoSequence = [];
              echoBtn.textContent = "Hear it again";
            }
          });
          padsEl.appendChild(b);
        });
        // The sequence: the motif's own first notes, mapped onto
        // the pads — as many as the voice has grown to say.
        const identity = Core.livingVoiceIdentityFor ? Core.livingVoiceIdentityFor(companion) : null;
        const growth = Core.livingVoiceGrowthFor ? Core.livingVoiceGrowthFor({ record, companion }) : null;
        const count = Math.max(2, Math.min(4, growth ? growth.maxNotes : 2));
        const steps = identity?.signatureSteps?.length ? identity.signatureSteps : [0, 2, 1, 3];
        echoBtn.dataset.sequence = JSON.stringify(steps.slice(0, count).map((s) => Math.abs(s) % echoPads.length));
      } catch { /* the pads stand silent rather than wrong */ }
    }

    echoBtn.addEventListener("click", () => {
      const Spark = window.SphereSpark;
      if (!echoPads.length) buildEcho();
      const seq = JSON.parse(echoBtn.dataset.sequence || "[]");
      if (!seq.length) { echoStatus.textContent = "Your Spark is still finding its voice for this game."; return; }
      echoSequence = seq;
      echoStep = 0;
      echoStatus.textContent = "Listen…";
      seq.forEach((padIndex, i) => {
        window.setTimeout(() => {
          Spark?.soundNote(echoPads[padIndex].note, 0.34);
          const b = padsEl.children[padIndex];
          if (b) { b.classList.add("sphere-play-pad-lit"); window.setTimeout(() => b.classList.remove("sphere-play-pad-lit"), 260); }
          if (i === seq.length - 1) window.setTimeout(() => { echoStatus.textContent = "Now you — tap the same notes back."; }, 420);
        }, 420 * (i + 1));
      });
    });
    buildEcho();

    /* ── Catch the turning ────────────────────────────────────── */
    const turnStatus = section.querySelector("[data-play-turning] .sphere-play-status");
    const armBtn = section.querySelector("[data-play-turning-arm]");
    const catchBtn = section.querySelector("[data-play-turning-catch]");
    let armedBand = null;
    let catchDeadline = 0;

    const bandOf = () => window.SphereSparkCore?.daypartForHour ? window.SphereSparkCore.daypartForHour(new Date().getHours()) : null;
    const nextTurnText = () => {
      const h = new Date().getHours();
      const next = [5, 10, 17, 21, 29].find((x) => x > h) || 29;
      const label = next === 29 ? "5 in the morning" : next === 5 ? "5 in the morning" : next === 10 ? "10 in the morning" : next === 17 ? "5 in the evening" : "9 in the evening";
      return label;
    };

    armBtn.addEventListener("click", () => {
      armedBand = bandOf();
      if (!armedBand) { turnStatus.textContent = "The day's clock is still waking up — try again in a moment."; return; }
      armBtn.disabled = true;
      turnStatus.textContent = `Armed. The light is ${armedBand} now; it next turns at ${nextTurnText()}. Stay on the page, and catch it when it turns.`;
    });

    window.setInterval(() => {
      if (!armedBand) return;
      const now = bandOf();
      if (now && now !== armedBand) {
        armedBand = null;
        catchDeadline = Date.now() + 60000;
        catchBtn.hidden = false;
        armBtn.disabled = false;
        armBtn.textContent = "Arm again";
        turnStatus.textContent = `The light just turned to ${now} — catch it! You have a minute.`;
        window.SphereSpark?.soundMotif?.("moment");
      }
      if (catchDeadline && Date.now() > catchDeadline && !catchBtn.hidden) {
        catchBtn.hidden = true;
        catchDeadline = 0;
        turnStatus.textContent = "The turning slipped past uncaught — it will come again. Arm it and wait with the Sphere.";
      }
    }, 5000);

    catchBtn.addEventListener("click", () => {
      if (!catchDeadline || Date.now() > catchDeadline) return;
      catchBtn.hidden = true;
      catchDeadline = 0;
      const band = bandOf();
      turnStatus.textContent = `Caught — the light turned to ${band}, and you were here for it. It stands in your record.`;
      window.SphereSpark?.soundMotif?.("day");
      window.SphereSpark?.logPlay?.("turning", { band });
      noteRecord();
    });

    // Still mode quiets the room; waking restores it.
    const motionSel = $("#sphere-motion-mode");
    motionSel?.addEventListener("change", stillLine);
    new MutationObserver(stillLine).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    stillLine();
    return section;
  }

  function boot() {
    buildPlayRoom();
  }

  window.SpherePlay = Object.freeze({ VERSION });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
