/**
 * One Word a Day — a Hebrew word path tied to the Pattern Day
 * (Aaron's commission, Nov 25, 2026: "Build all those and add it";
 * working shape from the Living Look transformation map and the
 * Spark activities design).
 *
 * The shape of the sitting (about two minutes):
 *   1. The Spark sounds the word — the pronunciation engine
 *      (assets/js/hebrew-pronunciation.js, PR #343) turns the
 *      pointed Hebrew into a careful transliteration track, and
 *      the device's own voice speaks that track. The honest note
 *      stands on the page: a careful transliteration in the
 *      device's voice, not a native Hebrew voice.
 *   2. The full treatment stands on the face: pointed spelling,
 *      the transliteration printed in the source data, the root
 *      (lemma / Strong's number), the gloss, and one real example
 *      — a verse in Genesis or Exodus where the word stands, with
 *      its form and parsed morphology there. Every field is
 *      sourced from the R2-02 lexicon data in this repo (see
 *      scripts/build-one-word-data.py); nothing is invented, and
 *      a field with no truthful source kept its entry out.
 *   3. Call-and-response: the visitor picks the word's root from
 *      three, drawn from the same dataset. A word moves
 *      met → earned only when the paired practice is completed —
 *      sounded AND answered. Meeting a word alone earns nothing.
 *
 * The day's word comes from the ONE temporal authority:
 * PatternCalendar.fromCivilDate — the same summary the Sphere,
 * the homepage telling, and Day Notes run. This module keeps no
 * clock and no calendar math of its own. The rotation over the
 * dataset is the generator's stated rule: Pattern Day d takes
 * entry (d - 1) mod N in Strong's order. The Day Out of Time
 * takes no word: the page offers review of the keeper's earned
 * words that day instead of inventing a 365th treatment.
 *
 * Memory is local only: met and earned words are kept in
 * localStorage on this device, under this module's own key, and
 * the Spark resumes with "I kept your place." No streaks, no
 * guilt, no absence framing, nothing sent anywhere, no account.
 * The Spark is "the Spark" / "it" throughout.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.OneWordADay = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const root = typeof globalThis !== "undefined" ? globalThis : {};
    const VERSION = "one-word-a-day/1.0.0";
    const STORAGE_KEY = "sof.one-word-a-day.v1";
    const DATA_URL = "assets/data/one-word-words.json";

    const SOUND_NOTE =
      "The Spark sounds the word as a careful transliteration in your device's own voice, " +
      "spelled out letter by letter from the vowel points by the site's pronunciation engine. " +
      "It is not a native Hebrew voice.";

    /* --------------------- the day's word --------------------- */

    /* The generator's rotation rule, mirrored here and pinned by
     * test: Pattern Day d (1..364) takes entry (d - 1) mod N.
     * Anything outside the counted year takes no word. */
    function wordForPatternDay(entries, patternDay) {
      if (!Array.isArray(entries) || entries.length === 0) return null;
      if (!Number.isInteger(patternDay) || patternDay < 1 || patternDay > 364) return null;
      return entries[(patternDay - 1) % entries.length];
    }

    /* Three roots to choose from: the word's own root plus two
     * others drawn deterministically from the same dataset
     * (fixed strides from the word's own index, so the same day
     * always asks the same question). Distractors never share
     * the word's root. Order rotates by Pattern Day. */
    function choicesFor(entries, entry, patternDay) {
      if (!Array.isArray(entries) || !entry) return null;
      const index = entries.indexOf(entry);
      if (index < 0) return null;
      const n = entries.length;
      const distractors = [];
      const strides = [137, 733, 389, 911, 271, 557];
      for (const stride of strides) {
        if (distractors.length >= 2) break;
        const candidate = entries[(index + stride) % n];
        if (candidate && candidate.root !== entry.root && !distractors.includes(candidate.root)) {
          distractors.push(candidate.root);
        }
      }
      if (distractors.length < 2) return null;
      const options = [entry.root, distractors[0], distractors[1]];
      const shift = ((patternDay % 3) + 3) % 3;
      const rotated = options.slice(shift).concat(options.slice(0, shift));
      return { options: rotated, answer: entry.root };
    }

    /* ------------------------- state -------------------------- */
    /* { met: {strongs: patternDay}, earned: {strongs: patternDay} }
     * A word is "met" when its sitting opens, and "earned" only
     * when the paired practice completes. Nothing else is kept:
     * no days-away count, no streak, nothing losable. */

    function blankState() {
      return { met: {}, earned: {} };
    }

    function cleanMap(value) {
      const out = {};
      if (value && typeof value === "object") {
        for (const [key, day] of Object.entries(value)) {
          if (typeof key === "string" && key && Number.isInteger(day) && day >= 1 && day <= 364) {
            out[key] = day;
          }
        }
      }
      return out;
    }

    function cleanState(value) {
      if (!value || typeof value !== "object") return blankState();
      return { met: cleanMap(value.met), earned: cleanMap(value.earned) };
    }

    function loadState(storage) {
      try {
        const raw = storage && storage.getItem(STORAGE_KEY);
        if (!raw) return blankState();
        return cleanState(JSON.parse(raw));
      } catch {
        return blankState();
      }
    }

    function saveState(storage, state) {
      const clean = cleanState(state);
      try {
        if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(clean));
      } catch {
        /* A device that refuses storage still sits with the word;
         * it just cannot keep the visitor's place. */
      }
      return clean;
    }

    function markMet(state, entry, patternDay) {
      const next = cleanState(state);
      if (entry && entry.strongs && Number.isInteger(patternDay)) {
        if (!(entry.strongs in next.met)) next.met[entry.strongs] = patternDay;
      }
      return next;
    }

    function statusOf(state, entry) {
      if (!entry || !entry.strongs) return "unmet";
      const clean = cleanState(state);
      if (entry.strongs in clean.earned) return "earned";
      if (entry.strongs in clean.met) return "met";
      return "unmet";
    }

    /* The paired practice, and the only road to earned: the word
     * was sounded (the Spark led, the visitor heard it) AND the
     * visitor picked its root. Either half alone earns nothing. */
    function completePractice(state, entry, patternDay, practice) {
      const next = markMet(state, entry, patternDay);
      const sounded = Boolean(practice && practice.sounded);
      const correct = Boolean(practice && practice.correct);
      if (entry && entry.strongs && sounded && correct) {
        next.earned[entry.strongs] = patternDay;
      }
      return next;
    }

    function earnedEntries(state, entries) {
      const clean = cleanState(state);
      if (!Array.isArray(entries)) return [];
      return entries.filter((entry) => entry && entry.strongs in clean.earned);
    }

    /* The resume line. It greets what is kept; it never counts
     * what was missed, because nothing here counts that. */
    function resumeLine(state) {
      const clean = cleanState(state);
      const earnedCount = Object.keys(clean.earned).length;
      const metCount = Object.keys(clean.met).length;
      if (earnedCount > 0) {
        return "I kept your place. " + earnedCount + (earnedCount === 1 ? " word" : " words") +
          " earned so far — they are on the shelf below, whenever you want them.";
      }
      if (metCount > 0) {
        return "I kept your place. We have met " + metCount + (metCount === 1 ? " word" : " words") +
          " together; today's word is ready when you are.";
      }
      return null;
    }

    /* ------------------------- sound -------------------------- */

    /* The spoken track for a pointed word, from the landed
     * pronunciation engine. Null when the engine is absent or the
     * word carries no pointing — never guessed. */
    function spokenTrack(hebrew, engine) {
      const eng = engine || root.HebrewPronunciation;
      if (!eng || typeof eng.transliterate !== "function" || !hebrew) return null;
      const result = eng.transliterate(hebrew);
      return result && result.spoken ? result.spoken : null;
    }

    function soundWord(hebrew, engine, synth) {
      const spoken = spokenTrack(hebrew, engine);
      const synthesis = synth || (typeof window !== "undefined" ? window.speechSynthesis : null);
      if (!spoken || !synthesis || typeof SpeechSynthesisUtterance === "undefined") return false;
      try {
        synthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(spoken);
        utterance.rate = 0.85;
        synthesis.speak(utterance);
        return true;
      } catch {
        return false;
      }
    }

    const api = {
      VERSION,
      STORAGE_KEY,
      DATA_URL,
      SOUND_NOTE,
      wordForPatternDay,
      choicesFor,
      blankState,
      cleanState,
      loadState,
      saveState,
      markMet,
      statusOf,
      completePractice,
      earnedEntries,
      resumeLine,
      spokenTrack,
      soundWord
    };

    /* --------------------- page wiring ------------------------ */
    /* Browser-only below this line; the pure core above is what
     * the tests hold. */

    function init() {
      const stage = document.querySelector("[data-one-word]");
      if (!stage) return;
      const calendar = root.PatternCalendar;
      if (!calendar || typeof calendar.fromCivilDate !== "function") return;

      const lineEl = stage.querySelector("[data-ow-line]");
      const bodyEl = stage.querySelector("[data-ow-body]");
      const dayLineEl = document.querySelector("[data-ow-today-line]");
      const storage = (() => { try { return window.localStorage; } catch { return null; } })();
      let state = loadState(storage);

      const timeZone = (() => {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
      })();
      const summary = calendar.fromCivilDate({ date: new Date(), timeZone, boundaryMode: "midnight" });
      const data = root.PatternCalendarData;
      const moonName = summary.moonName ||
        (data && Array.isArray(data.moons) && summary.moon ? data.moons[summary.moon - 1].name : null);

      const setLine = (text) => { if (lineEl) lineEl.textContent = text; };
      const paragraph = (text, className) => {
        const p = document.createElement("p");
        if (className) p.className = className;
        p.textContent = text;
        return p;
      };

      fetch(DATA_URL)
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          const entries = payload && Array.isArray(payload.entries) ? payload.entries : [];
          if (dayLineEl) {
            dayLineEl.textContent = summary.insideCountedYear
              ? "Moon " + summary.moon + (moonName ? " — " + moonName : "") +
                " · Day " + summary.day + " of the Moon · Pattern Day " + summary.dayOfPatternYear + " of 364"
              : "Today is the Day Out of Time — a day outside the count.";
          }

          const kept = resumeLine(state);

          if (!summary.insideCountedYear) {
            /* The Day Out of Time: no 365th treatment is invented.
             * The day offers review of the keeper's earned words. */
            setLine(kept
              ? kept + " Today stands outside the count, so there is no new word — sit with the words you have earned."
              : "Today stands outside the count — the Day Out of Time. There is no new word today; the year rests, and so does the path.");
            renderReview(entries, true);
            return;
          }

          const entry = wordForPatternDay(entries, summary.dayOfPatternYear);
          if (!entry) {
            setLine("The word path could not be read on this device today. The lexicon doors below still stand open.");
            return;
          }
          state = saveState(storage, markMet(state, entry, summary.dayOfPatternYear));
          const already = statusOf(state, entry) === "earned";
          setLine(kept
            ? kept + " Today's word is " + entry.xlit + " — " + entry.gloss + "."
            : "Shalom. One word today: " + entry.xlit + " — " + entry.gloss +
              ". Hear it, see how it is built, and pick its root. About two minutes, and the word is yours.");
          renderSitting(entries, entry, summary.dayOfPatternYear, already);
        })
        .catch(() => {
          setLine("The word path could not be read on this device today. The lexicon doors below still stand open.");
        });

      function renderReview(entries, stillDay) {
        if (!bodyEl) return;
        bodyEl.textContent = "";
        const earned = earnedEntries(state, entries);
        if (earned.length === 0) {
          bodyEl.appendChild(paragraph(stillDay
            ? "No words are earned yet — nothing is lost by that. The path begins again with the new year, one word a day."
            : "No words are earned yet. They gather here as the sittings complete."));
          return;
        }
        bodyEl.appendChild(paragraph("Your earned words — tap one to hear it again:"));
        const list = document.createElement("ul");
        list.className = "ow-shelf";
        for (const entry of earned) {
          const item = document.createElement("li");
          const button = document.createElement("button");
          button.type = "button";
          button.className = "ow-shelf-word";
          const hebrew = document.createElement("span");
          hebrew.className = "ow-hebrew";
          hebrew.setAttribute("lang", "he");
          hebrew.setAttribute("dir", "rtl");
          hebrew.textContent = entry.hebrew;
          button.appendChild(hebrew);
          button.appendChild(document.createTextNode(" " + entry.xlit + " — " + entry.gloss));
          button.addEventListener("click", () => { soundWord(entry.hebrew); });
          item.appendChild(button);
          list.appendChild(item);
        }
        bodyEl.appendChild(list);
      }

      function renderSitting(entries, entry, patternDay, alreadyEarned) {
        if (!bodyEl) return;
        bodyEl.textContent = "";
        let sounded = false;

        const card = document.createElement("div");
        card.className = "ow-card";

        const hebrew = document.createElement("p");
        hebrew.className = "ow-hebrew ow-word";
        hebrew.setAttribute("lang", "he");
        hebrew.setAttribute("dir", "rtl");
        hebrew.textContent = entry.hebrew;
        card.appendChild(hebrew);

        card.appendChild(paragraph(entry.xlit + " · " + entry.gloss, "ow-gloss"));
        card.appendChild(paragraph(
          "Root: " + entry.root + " · Lemma " + entry.strongs.replace(/^H/, "Strong's H"),
          "ow-root"
        ));

        const hear = document.createElement("button");
        hear.type = "button";
        hear.className = "ow-action";
        hear.textContent = "Hear the word";
        hear.addEventListener("click", () => {
          sounded = soundWord(entry.hebrew) || sounded;
          if (sounded) setLine("That is " + entry.xlit + ". Say it back if you like — then find its root below.");
        });
        card.appendChild(hear);
        card.appendChild(paragraph(SOUND_NOTE, "ow-note"));

        const example = entry.example || {};
        card.appendChild(paragraph(
          "In the text: " + (example.ref || "") + " — the word stands there as " +
            (example.form || entry.hebrew) + " (" + (example.morphGloss || "") + ").",
          "ow-example"
        ));
        if (example.verseText) card.appendChild(paragraph("“" + example.verseText + "”", "ow-verse"));
        bodyEl.appendChild(card);

        if (alreadyEarned) {
          bodyEl.appendChild(paragraph("You have earned this word. It rests on your shelf below.", "ow-done"));
          renderShelfInto(bodyEl, entries);
          return;
        }

        const quiz = document.createElement("div");
        quiz.className = "ow-quiz";
        quiz.appendChild(paragraph("Call and response: which root does this word grow from?", "ow-quiz-title"));
        const choices = choicesFor(entries, entry, patternDay);
        const feedback = paragraph("", "ow-feedback");
        feedback.setAttribute("aria-live", "polite");
        if (choices) {
          for (const option of choices.options) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "ow-choice";
            button.setAttribute("lang", "he");
            button.setAttribute("dir", "rtl");
            button.textContent = option;
            button.addEventListener("click", () => {
              const correct = option === choices.answer;
              if (!sounded) {
                feedback.textContent = "Hear the word first — the Spark sounds it, then you answer. That pairing is the practice.";
                return;
              }
              if (!correct) {
                feedback.textContent = "Not that root. Listen again, look at the word's letters, and try once more — there is no penalty here.";
                return;
              }
              state = saveState(storage, completePractice(state, entry, patternDay, { sounded, correct }));
              feedback.textContent = "Earned. " + entry.xlit + " is yours — kept on this device, on your shelf.";
              setLine("Earned — well heard. " + entry.xlit + " joins your shelf. Tomorrow brings the next word on the path.");
              quiz.querySelectorAll("button").forEach((b) => { b.disabled = true; });
              renderShelfInto(bodyEl, entries);
            });
            quiz.appendChild(button);
          }
        }
        quiz.appendChild(feedback);
        bodyEl.appendChild(quiz);
      }

      function renderShelfInto(container, entries) {
        const earned = earnedEntries(state, entries);
        if (earned.length === 0) return;
        const shelf = document.createElement("p");
        shelf.className = "ow-shelf-line";
        shelf.textContent = "Your shelf: " + earned.map((e) => e.xlit).join(" · ");
        container.appendChild(shelf);
      }
    }

    if (typeof document !== "undefined") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
      } else {
        init();
      }
    }

    return api;
  }
);
