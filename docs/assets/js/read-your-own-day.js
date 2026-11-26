/**
 * Read Your Own Day — a guided practice (Aaron's commission,
 * Nov 25, 2026: "Build all those and add it").
 *
 * The Spark teaches a first-time visitor to read their own day in
 * Living Time, one clear step at a time, by doing:
 *
 *   1. Find today — the Moon, the day of the Moon, and the Pattern
 *      Day, read at runtime from the ONE temporal authority
 *      (PatternCalendar.fromCivilDate — the same computation the
 *      Sphere, the homepage telling, and Day Notes run). This
 *      module keeps no clock of its own and hard-codes no dates:
 *      every number on the page comes out of the authority's
 *      summary for the visitor's own civil day.
 *   2. See it on the Sphere — a door to the real Sphere page
 *      (living-time-sphere.html). That page is R1.7-protected;
 *      this practice LINKS to it and never touches it.
 *   3. What a day holds — the day's name and its moon's practice,
 *      and the witnessing rule in plain words: a day is witnessed
 *      when you open it, add to it, or close it with the Spark —
 *      any one touch makes it witnessed (Aaron's ruling,
 *      Nov 23, 2026).
 *   4. Witness today — the visitor is walked to the real surface
 *      where that happens: Day Notes on the 13 Moons page, which
 *      opens on today and writes a real note into the visitor's
 *      own Life Atlas. This practice fakes no record of its own:
 *      the only thing it stores is the visitor's place in these
 *      steps, in localStorage on this device, so the Spark can
 *      say "I kept your place" and resume. No day record, no
 *      checklist of misses, nothing losable, nothing uploaded.
 *
 * The Spark leads: each step's line is shown in the Spark's panel
 * on the page, and — when the visitor's Spark seat is present —
 * the same line is spoken into the seat on the tap that advances
 * the step, where the landed Spark voice layer
 * (spark-voice.js) speaks it aloud if the keeper has turned
 * spoken replies on. Nothing speaks on page load; speech rides
 * taps only, under the keeper's own voice settings, exactly as
 * everywhere else on the site.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.ReadYourOwnDay = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const root = typeof globalThis !== "undefined" ? globalThis : {};
    const VERSION = "read-your-own-day/1.0.0";
    const STORAGE_KEY = "sof.read-your-own-day.v1";

    /* The road: four steps after the welcome. `done` is a state,
     * not a fifth step — finishing is a place the Spark remembers,
     * not another task. */
    const STEPS = Object.freeze([
      Object.freeze({ id: "find", name: "Find today" }),
      Object.freeze({ id: "see", name: "See it on the Sphere" }),
      Object.freeze({ id: "holds", name: "What a day holds" }),
      Object.freeze({ id: "witness", name: "Witness today" })
    ]);

    const SPHERE_HREF = "living-time-sphere.html";
    const DAY_NOTES_HREF = "moons.html#day-notes";

    /* ------------------------- state -------------------------- */

    function blankState() {
      return { step: 0, done: false };
    }

    function cleanState(value) {
      if (!value || typeof value !== "object") return blankState();
      const step = Number.isInteger(value.step)
        ? Math.min(Math.max(value.step, 0), STEPS.length - 1)
        : 0;
      return { step, done: value.done === true };
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
      try {
        if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(cleanState(state)));
      } catch {
        /* A device that refuses storage still walks the road;
         * it just cannot keep the visitor's place. */
      }
      return cleanState(state);
    }

    /* ------------------- the day's reading -------------------- */

    /* Format the authority's summary into plain words. This is
     * formatting only — no arithmetic, no second clock. `data` is
     * PatternCalendarData (moons, dayArchetypes, the intercalary
     * names), the same data the authority itself reads. */
    function readingFor(summary, data) {
      if (!summary || typeof summary !== "object") return null;

      if (!summary.insideCountedYear) {
        const name = summary.isDeepTimeDay
          ? (data && data.deepTimeDayName) || summary.moonName || "The Deep Time Day"
          : (data && data.dayOutOfTimeName) || summary.moonName || "The Day Out of Time";
        return {
          kind: summary.isDeepTimeDay ? "deep-time" : "day-out-of-time",
          headline: name,
          figures: [
            { label: "Where today stands", value: name + " — outside the counted 364 days" },
            { label: "Pattern Year", value: "Year " + summary.patternYear }
          ],
          practice: "No moon practice today; witness the pause itself.",
          sparkLine:
            "Today is " + name + ", the day outside the count. The year rests " +
            "before it turns — and even a resting day can be witnessed."
        };
      }

      const moon = data && Array.isArray(data.moons) ? data.moons[summary.moon - 1] : null;
      const archetype =
        data && Array.isArray(data.dayArchetypes) ? data.dayArchetypes[summary.day - 1] : null;
      const moonName = summary.moonName || (moon && moon.name) || null;
      const dayName = Array.isArray(archetype) ? archetype[0] : null;

      const figures = [
        { label: "Moon", value: "Moon " + summary.moon + (moonName ? " — " + moonName : "") },
        { label: "Day of the Moon", value: "Day " + summary.day + " of 28" },
        {
          label: "Pattern Day",
          value: "Pattern Day " + summary.dayOfPatternYear + " of 364"
        },
        { label: "Pattern Year", value: "Year " + summary.patternYear }
      ];
      if (dayName) {
        figures.push({
          label: "The day's name",
          value: dayName + (archetype[1] ? " — " + archetype[1] : "")
        });
      }

      return {
        kind: "counted",
        headline:
          "Day " + summary.day + " of the " + (moonName || "") + " moon · Pattern Day " +
          summary.dayOfPatternYear + " of 364",
        figures,
        practice: moon && moon.practice ? String(moon.practice) : null,
        sparkLine:
          "Here is today. Moon " + summary.moon + (moonName ? ", " + moonName : "") +
          ". Day " + summary.day + " of the moon. Pattern Day " +
          summary.dayOfPatternYear + " of the year. Those three numbers are " +
          "today's address in Living Time — everything else hangs on them."
      };
    }

    /* The Spark's line for each step, built from the reading so
     * the spoken words and the shown words are the same words. */
    function sparkLineFor(stepId, reading) {
      switch (stepId) {
        case "find":
          return reading
            ? reading.sparkLine
            : "The calendar could not be read just now. The Sphere still knows today — we can walk there together.";
        case "see":
          return "Now let's see that day where it lives. On the Sphere, today is lit among all the days of the year — your day, in its place. Tap the door and look; I will keep your place here.";
        case "holds":
          return "A day holds more than its numbers. It holds its name, its moon's practice, and whatever you put on it. And a day is witnessed by any one touch: open it, add to it, or close it with me. One touch is enough.";
        case "witness":
          return "One touch, then, to finish. Day Notes on the 13 Moons page opens on today. Add one line — anything true — and today is witnessed, in your own record, on your own device.";
        case "done":
          return "That is the whole road: find the day, see it, know what it holds, and touch it. Come back any day — every day has an address, and now you can read it.";
        default:
          return "Walk with me. In four small steps you will find today, see it on the Sphere, learn what a day holds, and witness this one — with your own hands.";
      }
    }

    /* --------------------- browser wiring --------------------- */

    function todaySummary() {
      const calendar = root.PatternCalendar;
      if (!calendar || typeof calendar.fromCivilDate !== "function") return null;
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const iso = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
      if (!iso) return null;
      return calendar.fromCivilDate({ date: iso, timeZone, boundaryMode: "midnight" });
    }

    function init() {
      const stage = document.querySelector("[data-ryod]");
      if (!stage || stage.dataset.ryodReady) return;
      stage.dataset.ryodReady = "1";

      const storage = (() => {
        try { return window.localStorage; } catch { return null; }
      })();

      const lineEl = stage.querySelector("[data-ryod-line]");
      const bodyEl = stage.querySelector("[data-ryod-body]");
      const actionsEl = stage.querySelector("[data-ryod-actions]");
      const marksEl = stage.querySelector("[data-ryod-marks]");
      const todayLineEl = document.querySelector("[data-ryod-today-line]");

      const summary = todaySummary();
      const reading = readingFor(summary, root.PatternCalendarData);

      if (todayLineEl) {
        todayLineEl.textContent = reading
          ? "Today: " + reading.headline + "."
          : "Today loads with your local time.";
      }

      /* The seat, when the visitor's Spark is present on the page:
       * step lines are spoken into it on the advancing tap, and
       * the landed voice layer takes them from there. */
      let seatSay = null;
      if (root.SparkAgentSeat && typeof root.SparkAgentSeat.attach === "function") {
        try {
          root.SparkAgentSeat.attach((seat) => {
            if (seat && typeof seat.say === "function") {
              seatSay = (text) => {
                try { seat.say("spark", text); } catch { /* the page panel still speaks in text */ }
              };
            }
          });
        } catch { /* no seat — the panel carries the Spark's words */ }
      }

      let state = loadState(storage);
      let screen = state.done || state.step > 0 ? "welcome-back" : "step";
      if (screen === "step") state = { step: 0, done: false };

      function speak(text) {
        if (lineEl) lineEl.textContent = text;
        if (seatSay) seatSay(text);
      }

      function marks() {
        if (!marksEl) return;
        marksEl.innerHTML = "";
        STEPS.forEach((step, index) => {
          const mark = document.createElement("li");
          mark.className = "ryod-mark";
          const current = !state.done && screen !== "welcome-back" && index === state.step;
          const walked = state.done || index < state.step;
          if (current) mark.classList.add("is-here");
          if (walked) mark.classList.add("is-walked");
          mark.textContent = step.name;
          if (current) mark.setAttribute("aria-current", "step");
          marksEl.appendChild(mark);
        });
      }

      function button(label, onClick, kind) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ryod-btn" + (kind ? " ryod-btn--" + kind : "");
        btn.textContent = label;
        btn.addEventListener("click", onClick);
        return btn;
      }

      function door(label, href) {
        const link = document.createElement("a");
        link.className = "ryod-btn ryod-btn--door";
        link.href = href;
        link.textContent = label;
        return link;
      }

      function setActions(nodes) {
        actionsEl.innerHTML = "";
        nodes.forEach((node) => actionsEl.appendChild(node));
      }

      function paragraph(text, className) {
        const p = document.createElement("p");
        if (className) p.className = className;
        p.textContent = text;
        return p;
      }

      function render() {
        marks();
        bodyEl.innerHTML = "";

        if (screen === "welcome-back") {
          const line = state.done
            ? "Welcome back. You have walked this road before — every day still has its address, and you can still read it. Walk it again whenever you like."
            : "I kept your place. The next step is “" + STEPS[state.step].name + "” — pick up there, or start the road again.";
          if (lineEl) lineEl.textContent = line;
          bodyEl.appendChild(
            paragraph(
              state.done
                ? "The road is short: find the day, see it on the Sphere, know what it holds, witness it. Nothing here is kept against you — walk it as often as a day asks."
                : "Nothing was lost while you were away. Your place in these steps is the only thing this practice keeps, and it keeps it on this device."
            )
          );
          setActions([
            button(state.done ? "Walk it again" : "Pick up where we left off", () => {
              if (state.done) state = saveState(storage, blankState());
              screen = "step";
              renderStep(true);
            }),
            ...(state.done
              ? []
              : [
                  button("Start again", () => {
                    state = saveState(storage, blankState());
                    screen = "step";
                    renderStep(true);
                  }, "quiet")
                ])
          ]);
          return;
        }

        renderStep(false);
      }

      function renderStep(announce) {
        marks();
        bodyEl.innerHTML = "";
        const step = STEPS[state.step];
        const line = sparkLineFor(step.id, reading);
        if (announce) speak(line);
        else if (lineEl) lineEl.textContent = line;

        if (step.id === "find") {
          if (reading) {
            const list = document.createElement("dl");
            list.className = "ryod-figures";
            reading.figures.forEach((figure) => {
              const dt = document.createElement("dt");
              dt.textContent = figure.label;
              const dd = document.createElement("dd");
              dd.textContent = figure.value;
              list.append(dt, dd);
            });
            bodyEl.appendChild(list);
            bodyEl.appendChild(
              paragraph(
                "You just read those the way the Sphere reads them — they come from the one calendar the whole Codex keeps, not from a second clock on this page.",
                "ryod-note"
              )
            );
          } else {
            bodyEl.appendChild(
              paragraph("The calendar could not be read on this device just now. The road still works: the Sphere and the 13 Moons page read the same calendar, and your place here is kept.")
            );
          }
          setActions([
            button("Next — see it on the Sphere", () => advance())
          ]);
          return;
        }

        if (step.id === "see") {
          bodyEl.appendChild(
            paragraph(
              "The Sphere is the year made visible: thirteen moons around the sun, every day in its place. Today's place is lit. Go and stand in front of it for a moment — the door opens the real Sphere, and this page will be exactly here when you come back."
            )
          );
          const sphereDoor = door("Open the Sphere — find today lit →", SPHERE_HREF);
          sphereDoor.addEventListener("click", () => {
            /* Stepping through the door is the step. The place is
             * saved before the visitor leaves, so returning here
             * resumes at the next step. */
            state = saveState(storage, { step: 2, done: false });
          });
          setActions([
            sphereDoor,
            button("I've seen it — next", () => advance(), "quiet")
          ]);
          return;
        }

        if (step.id === "holds") {
          if (reading && reading.practice) {
            bodyEl.appendChild(paragraph("This moon's practice: " + reading.practice));
          }
          bodyEl.appendChild(
            paragraph(
              "And the day holds whatever you put on it: a note, a plan, a practice, a record. A day with nothing on it is not behind — it is simply unwitnessed, and witnessing takes one touch."
            )
          );
          bodyEl.appendChild(
            paragraph(
              "The rule, in Aaron's words as the Codex keeps it: opening a day, adding to it, or closing it with the Spark — any one of those makes the day witnessed.",
              "ryod-note"
            )
          );
          setActions([button("Next — witness today", () => advance())]);
          return;
        }

        if (step.id === "witness") {
          bodyEl.appendChild(
            paragraph(
              "Day Notes opens on today, on the 13 Moons page. Write one line — what happened, what you noticed, what tomorrow asks. That line is a real record in your own Life Atlas, on this device only, and the touch witnesses the day."
            )
          );
          bodyEl.appendChild(
            paragraph(
              "This practice writes nothing for you. It only walked you to the door — the record is yours to make, with your own hand.",
              "ryod-note"
            )
          );
          const notesDoor = door("Open Day Notes — add one line to today →", DAY_NOTES_HREF);
          notesDoor.addEventListener("click", () => {
            state = saveState(storage, { step: 3, done: true });
          });
          setActions([
            notesDoor,
            button("I witnessed today another way", () => finish(), "quiet")
          ]);
          return;
        }
      }

      function advance() {
        state = saveState(storage, {
          step: Math.min(state.step + 1, STEPS.length - 1),
          done: false
        });
        renderStep(true);
      }

      function finish() {
        state = saveState(storage, { step: STEPS.length - 1, done: true });
        screen = "step";
        marks();
        bodyEl.innerHTML = "";
        speak(sparkLineFor("done", reading));
        bodyEl.appendChild(
          paragraph(
            "Today stands witnessed by your touch, and you read it yourself to get there. The same road works tomorrow: the address changes, the reading doesn't."
          )
        );
        setActions([
          door("Open the Sphere →", SPHERE_HREF),
          door("Open Day Notes →", DAY_NOTES_HREF)
        ]);
      }

      render();
    }

    if (typeof document !== "undefined") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
      } else {
        init();
      }
    }

    return {
      VERSION,
      STORAGE_KEY,
      STEPS,
      SPHERE_HREF,
      DAY_NOTES_HREF,
      blankState,
      cleanState,
      loadState,
      saveState,
      readingFor,
      sparkLineFor
    };
  }
);
