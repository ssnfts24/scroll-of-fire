/**
 * Theory — Work This Page (Interactivity Wave 2)
 *
 * The Theory library's 35 pages shared one template and offered a
 * visitor nothing to do: read, and leave. This one module serves the
 * whole family at once, with the same two actions on every page:
 *
 *   1. State it in your own words — a one-line witness note, saved as
 *      a canonical Life Atlas record (type "witness", subtype
 *      "theory-witness-note") in the visitor's own on-device
 *      repository (CodexLifeAtlasRepository — the same store the
 *      Sphere, planner, and calendar projection read). No parallel
 *      store. The note is tied to the page it was written on, and the
 *      page reads its own latest note back on the next visit.
 *
 *   2. Work the equation — on the pages whose central equation is
 *      stated as a computable form, the page's own variables become
 *      sliders and the model's own arithmetic updates live. The
 *      playground explores the equation AS WRITTEN. It proves
 *      nothing: a defined equation is a model, not a validated law,
 *      and a pattern is not a causation. That honesty is printed on
 *      the playground itself, in plain words.
 *
 * Pages whose central form is not a computable numeric statement —
 * operator frames, set operations, the two comparators whose status
 * the Canon itself leaves unresolved — get the witness note only.
 * Giving them sliders would mean inventing numbers the page does
 * not state, so the module does not.
 *
 * Records are browser-local like every Life Atlas record and ride
 * the existing Atlas export/backup unchanged. Nothing here tracks,
 * scores, streaks, or shames: a note is a witness mark, not a grade.
 *
 * The temporal stamp follows the Life Atlas convention (PatternCalendar
 * conversion, patternYear = the anchor civil year). Record cleaning,
 * the temporal shape, repository resolution, and change notices come
 * from the one shared record layer — life-atlas/record-helpers.js
 * (CodexRecordHelpers), the same module every other door uses. This
 * module does not re-define them.
 *
 * The pure functions (PLAYGROUNDS, computePlayground,
 * buildWitnessNoteRecord, isWitnessNoteRecord, latestNoteForPage,
 * temporalFromConversion) carry no DOM or storage dependency and
 * are unit-tested in tests/theory-work.test.js.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexTheoryWork = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    /* The one record layer: record cleaning, the temporal shape,
     * repository resolution, and change notices live in
     * life-atlas/record-helpers.js (CodexRecordHelpers) — one shared
     * module for every door. Do not re-define them here. */
    const RecordHelpers =
      (typeof globalThis !== "undefined"
        ? globalThis.CodexRecordHelpers
        : null) ||
      (typeof module === "object" && module.exports
        ? (() => {
            try {
              return require("./life-atlas/record-helpers.js");
            } catch {
              return null;
            }
          })()
        : null);

    if (!RecordHelpers) {
      throw new Error(
        "CodexRecordHelpers is required — load life-atlas/record-helpers.js first."
      );
    }

    const cleanText = RecordHelpers.cleanText;
    const cleanNullable = RecordHelpers.cleanNullable;
    const finiteOrNull = RecordHelpers.finiteOrNull;
    const temporalFromConversion = RecordHelpers.temporalFromConversion;
    const notifyRecordsChanged = RecordHelpers.notifyRecordsChanged;
    const resolveRepository = RecordHelpers.createRepositoryResolver();

    const VERSION = "theory-work/1.0.0";

    const RECORD_TYPE = "witness";
    const RECORD_SUBTYPE = "theory-witness-note";
    const RECORD_TAG = "theory-witness";

    const HONESTY_LINE =
      "This explores the equation exactly as this page writes it. " +
      "Moving the sliders shows how the model's own arithmetic behaves — " +
      "it does not prove the equation. A defined equation is a model, " +
      "not a measured law, and a pattern is not a cause.";

    /* ------------------------- pure helpers ------------------------- */

    function formatNumber(value) {
      if (value === null || value === undefined) return "—";

      const number = Number(value);
      if (!Number.isFinite(number)) return "—";

      if (number !== 0 && (Math.abs(number) >= 1e6 || Math.abs(number) < 1e-4)) {
        return number.toExponential(3);
      }

      return String(Number(number.toFixed(4)));
    }

    /* ------------------------- playgrounds -------------------------- */
    /*
     * One entry per computable form. `pages` names the files the form
     * belongs to; every input is a variable the page itself names.
     * compute(values) returns { text } — the readout line — and may
     * add { note } for the model's own edge cases and stop rules.
     */

    const PLAYGROUNDS = [
      {
        id: "master-reality",
        pages: ["master-equation.html", "eq00.html"],
        heading: "Work the Master Equation",
        formula: "Reality 𝔑 = (E × I × N × M × F) raised to C",
        blurb:
          "Energy, Information, Intention, Memory, and Flow multiply; " +
          "Consciousness raises the product. Try setting any one term " +
          "to zero, then try raising C.",
        inputs: [
          { key: "E", label: "E — Energy", min: 0, max: 2, step: 0.05, value: 1 },
          { key: "I", label: "I — Information", min: 0, max: 2, step: 0.05, value: 1 },
          { key: "N", label: "N — Intention", min: 0, max: 2, step: 0.05, value: 1 },
          { key: "M", label: "M — Memory", min: 0, max: 2, step: 0.05, value: 1 },
          { key: "F", label: "F — Flow", min: 0, max: 2, step: 0.05, value: 1 },
          { key: "C", label: "C — Consciousness (the exponent)", min: 0, max: 2, step: 0.05, value: 1 }
        ],
        compute(values) {
          const product =
            values.E * values.I * values.N * values.M * values.F;

          if (product === 0 && values.C === 0) {
            return {
              text: "𝔑 = —",
              note:
                "The product is 0 and the exponent is 0, and 0⁰ is " +
                "undefined — the model itself has an edge here, and " +
                "this playground shows the edge instead of hiding it."
            };
          }

          const result = Math.pow(product, values.C);

          return {
            text: `𝔑 = ${formatNumber(result)}`,
            note:
              product === 0
                ? "One term at zero empties the whole product before " +
                  "Consciousness ever raises it."
                : null
          };
        }
      },
      {
        id: "source-operators",
        pages: ["eq01.html"],
        heading: "Work Equation 1",
        formula: "R = f(K) · (I × L × C × S)",
        blurb:
          "A source factor carries four operators multiplied together: " +
          "Intention, Light, Consciousness, and Source.",
        inputs: [
          { key: "fK", label: "f(K) — the source factor", min: 0, max: 2, step: 0.05, value: 1 },
          { key: "I", label: "I — Intention", min: 0, max: 2, step: 0.05, value: 1 },
          { key: "L", label: "L — Light", min: 0, max: 2, step: 0.05, value: 1 },
          { key: "C", label: "C — Consciousness", min: 0, max: 2, step: 0.05, value: 1 },
          { key: "S", label: "S — Source", min: 0, max: 2, step: 0.05, value: 1 }
        ],
        compute(values) {
          const result = values.fK * values.I * values.L * values.C * values.S;
          return { text: `R = ${formatNumber(result)}` };
        }
      },
      {
        id: "harmonic-gate",
        pages: ["eq03.html"],
        heading: "Work the Harmonic Gate",
        formula: "H(x) = 1 / (1 + e^(−k(x − θ))), and Y = H × X",
        blurb:
          "The gate is a smooth step: below the threshold θ almost " +
          "nothing passes; above it, almost everything. k sets how " +
          "sharp the step is. X is what arrives at the gate.",
        inputs: [
          { key: "x", label: "x — the signal arriving", min: 0, max: 10, step: 0.1, value: 5 },
          { key: "k", label: "k — sharpness of the step", min: 0.1, max: 5, step: 0.1, value: 1 },
          { key: "theta", label: "θ — the threshold", min: 0, max: 10, step: 0.1, value: 5 },
          { key: "X", label: "X — the full signal", min: 0, max: 100, step: 1, value: 40 }
        ],
        compute(values) {
          const h = 1 / (1 + Math.exp(-values.k * (values.x - values.theta)));
          const y = h * values.X;
          return {
            text: `H = ${formatNumber(h)} · Y = ${formatNumber(y)} of ${formatNumber(values.X)}`
          };
        }
      },
      {
        id: "voice-carrier",
        pages: ["eq04.html"],
        heading: "Work the Voice Carrier",
        formula: "V(t) = A · cos(2πνt + φ)",
        blurb:
          "One carrier wave, as this page writes it: amplitude A, " +
          "frequency ν in hertz, at time t seconds, with phase φ.",
        inputs: [
          { key: "A", label: "A — amplitude", min: 0, max: 2, step: 0.05, value: 1 },
          { key: "nu", label: "ν — frequency (Hz)", min: 0, max: 1000, step: 1, value: 432 },
          { key: "t", label: "t — time (seconds)", min: 0, max: 1, step: 0.01, value: 0.25 },
          { key: "phi", label: "φ — phase", min: 0, max: 6.283, step: 0.01, value: 0 }
        ],
        compute(values) {
          const v =
            values.A * Math.cos(2 * Math.PI * values.nu * values.t + values.phi);
          return { text: `V(t) = ${formatNumber(v)}` };
        }
      },
      {
        id: "beat-frequency",
        pages: ["eq06.html"],
        heading: "Work the Beat Relation",
        formula: "f_beat = | f₁ − f₂ |",
        blurb:
          "Two close frequencies make a slow beat, as this page's " +
          "field relations state. Bring f₂ close to f₁ and watch " +
          "the beat slow down.",
        inputs: [
          { key: "f1", label: "f₁ — first frequency (Hz)", min: 0, max: 1000, step: 1, value: 432 },
          { key: "f2", label: "f₂ — second frequency (Hz)", min: 0, max: 1000, step: 1, value: 436 }
        ],
        compute(values) {
          const beat = Math.abs(values.f1 - values.f2);
          return {
            text: `f_beat = ${formatNumber(beat)} Hz`,
            note:
              beat === 0
                ? "Identical frequencies beat not at all — the two " +
                  "are one tone."
                : null
          };
        }
      },
      {
        id: "ethical-gate",
        pages: ["eq09.html"],
        heading: "Work the Ethical Gate",
        formula: "𝔈₉ = C × D × T × P × R × K × S",
        blurb:
          "Seven conditions multiply: Consent, Dignity, Truth and " +
          "transparency, Proportion, Responsibility, Correction, and " +
          "Stewardship. Each runs 0 (absent) to 1 (fully met).",
        inputs: [
          { key: "C", label: "C — Consent", min: 0, max: 1, step: 0.05, value: 0.9 },
          { key: "D", label: "D — Dignity", min: 0, max: 1, step: 0.05, value: 0.9 },
          { key: "T", label: "T — Truth and transparency", min: 0, max: 1, step: 0.05, value: 0.9 },
          { key: "P", label: "P — Proportion", min: 0, max: 1, step: 0.05, value: 0.9 },
          { key: "R", label: "R — Responsibility", min: 0, max: 1, step: 0.05, value: 0.9 },
          { key: "K", label: "K — Correction", min: 0, max: 1, step: 0.05, value: 0.9 },
          { key: "S", label: "S — Stewardship and stop conditions", min: 0, max: 1, step: 0.05, value: 0.9 }
        ],
        compute(values) {
          const result =
            values.C * values.D * values.T * values.P *
            values.R * values.K * values.S;
          const anyZero = ["C", "D", "T", "P", "R", "K", "S"]
            .some(key => values[key] === 0);
          return {
            text: `𝔈₉ = ${formatNumber(result)}`,
            note: anyZero
              ? "One condition at zero stops everything — that is " +
                "this page's own stop rule, not an average."
              : null
          };
        }
      },
      {
        id: "standing-score",
        pages: ["eq10.html"],
        heading: "Work the Standing Score",
        formula: "S(H) = αE + βP + γR − δA − λU",
        blurb:
          "The ladder scores a candidate by Evidence, Pattern, and " +
          "Resonance, minus Ad-hoc additions and Unresolved weight. " +
          "This playground sets every weight (α β γ δ λ) to 1 — the " +
          "plainest reading of the page's scoring line.",
        inputs: [
          { key: "E", label: "E — Evidence", min: 0, max: 10, step: 0.5, value: 5 },
          { key: "P", label: "P — Pattern", min: 0, max: 10, step: 0.5, value: 5 },
          { key: "R", label: "R — Resonance", min: 0, max: 10, step: 0.5, value: 5 },
          { key: "A", label: "A — Ad-hoc additions", min: 0, max: 10, step: 0.5, value: 5 },
          { key: "U", label: "U — Unresolved weight", min: 0, max: 10, step: 0.5, value: 5 }
        ],
        compute(values) {
          const s = values.E + values.P + values.R - values.A - values.U;
          return { text: `S(H) = ${formatNumber(s)}` };
        }
      },
      {
        id: "return-rule",
        pages: ["eq12.html"],
        heading: "Work the Return Rule",
        formula: "x next = x − β(x − x*), step by step",
        blurb:
          "One of this page's two small update rules: each step, the " +
          "state moves a fraction β of the way back toward its " +
          "resting point x*. Watch it settle — or, at β near 1, jump.",
        inputs: [
          { key: "x0", label: "x₀ — where it starts", min: 0, max: 100, step: 1, value: 20 },
          { key: "target", label: "x* — the resting point", min: 0, max: 100, step: 1, value: 80 },
          { key: "beta", label: "β — how much of the gap closes each step", min: 0, max: 1, step: 0.05, value: 0.3 },
          { key: "steps", label: "steps — how many steps to run", min: 1, max: 30, step: 1, value: 10 }
        ],
        compute(values) {
          let x = values.x0;
          const steps = Math.round(values.steps);
          for (let i = 0; i < steps; i += 1) {
            x = x - values.beta * (x - values.target);
          }
          return {
            text: `after ${steps} steps, x = ${formatNumber(x)}`,
            note:
              values.beta === 0
                ? "β at zero means nothing ever moves — the rule " +
                  "holds the state exactly where it started."
                : null
          };
        }
      },
      {
        id: "coherence-xi",
        pages: ["eq13.html"],
        heading: "Work Coherence Ξ",
        formula: "Ξ = (a₁ + a₂ + a₃) / 3 − λΔ",
        blurb:
          "This page defines Ξ as a weighted average of alignments, " +
          "less a drift penalty λΔ. This playground uses three " +
          "equally weighted voices, as the plainest case of the " +
          "page's weighted mean.",
        inputs: [
          { key: "a1", label: "a₁ — first alignment", min: 0, max: 1, step: 0.05, value: 0.8 },
          { key: "a2", label: "a₂ — second alignment", min: 0, max: 1, step: 0.05, value: 0.6 },
          { key: "a3", label: "a₃ — third alignment", min: 0, max: 1, step: 0.05, value: 0.9 },
          { key: "lambda", label: "λ — drift weight", min: 0, max: 1, step: 0.05, value: 0.2 },
          { key: "delta", label: "Δ — drift", min: 0, max: 1, step: 0.05, value: 0.1 }
        ],
        compute(values) {
          const mean = (values.a1 + values.a2 + values.a3) / 3;
          const xi = mean - values.lambda * values.delta;
          return { text: `Ξ = ${formatNumber(xi)} (before the 𝔈₉ gate)` };
        }
      },
      {
        id: "step-size",
        pages: ["eq14.html"],
        heading: "Work the Step Size",
        formula: "η(Ξ) = ηmin + (ηmax − ηmin) · Ξ^p",
        blurb:
          "The update rule's step grows with coherence Ξ, shaped by " +
          "the exponent p. This page leaves ηmin and ηmax open; " +
          "this playground sets them to 0.01 and 0.30 so the curve's " +
          "shape can be felt.",
        inputs: [
          { key: "xi", label: "Ξ — coherence", min: 0, max: 1, step: 0.01, value: 0.7 },
          { key: "p", label: "p — the shaping exponent", min: 0.25, max: 4, step: 0.05, value: 1 }
        ],
        compute(values) {
          const eta = 0.01 + (0.3 - 0.01) * Math.pow(values.xi, values.p);
          return { text: `η = ${formatNumber(eta)}` };
        }
      },
      {
        id: "learning-kernel",
        pages: ["eq15.html"],
        heading: "Work One Learning Step",
        formula: "K next = ρK + η · δ · Φ",
        blurb:
          "One step of the kernel: what is kept (ρ of the old K) " +
          "plus what the latest error δ teaches, scaled by the step " +
          "η and the signal Φ.",
        inputs: [
          { key: "K", label: "K — the kernel so far", min: 0, max: 5, step: 0.05, value: 1 },
          { key: "rho", label: "ρ — how much of the old is kept", min: 0, max: 1, step: 0.01, value: 0.9 },
          { key: "eta", label: "η — the step size", min: 0, max: 1, step: 0.01, value: 0.2 },
          { key: "delta", label: "δ — the error (actual − expected)", min: -2, max: 2, step: 0.05, value: 0.5 },
          { key: "phi", label: "Φ — the signal", min: 0, max: 2, step: 0.05, value: 1 }
        ],
        compute(values) {
          const next =
            values.rho * values.K + values.eta * values.delta * values.phi;
          return {
            text: `K next = ${formatNumber(next)}`,
            note:
              values.delta === 0
                ? "δ at zero means the expectation met the actual — " +
                  "nothing new is learned this step; the kernel only fades by ρ."
                : null
          };
        }
      },
      {
        id: "memory-weight",
        pages: ["eq16.html"],
        heading: "Work the Memory Weight",
        formula: "ω = r · q · s · c · e^(−λ × age)",
        blurb:
          "A memory's weight in the window: relevance r, quality q, " +
          "salience s, and confirmation c multiply, then time fades " +
          "what remains at rate λ.",
        inputs: [
          { key: "r", label: "r — relevance", min: 0, max: 1, step: 0.05, value: 0.9 },
          { key: "q", label: "q — quality", min: 0, max: 1, step: 0.05, value: 0.8 },
          { key: "s", label: "s — salience", min: 0, max: 1, step: 0.05, value: 0.7 },
          { key: "c", label: "c — confirmation", min: 0, max: 1, step: 0.05, value: 0.9 },
          { key: "lambda", label: "λ — the fading rate", min: 0, max: 1, step: 0.01, value: 0.1 },
          { key: "age", label: "age — time since the memory", min: 0, max: 30, step: 0.5, value: 5 }
        ],
        compute(values) {
          const omega =
            values.r * values.q * values.s * values.c *
            Math.exp(-values.lambda * values.age);
          return { text: `ω = ${formatNumber(omega)}` };
        }
      },
      {
        id: "two-carriers",
        pages: ["eq17.html"],
        heading: "Work the Carrier Sum",
        formula: "V(t) = A₁·cos(2πf₁t) + A₂·cos(2πf₂t)",
        blurb:
          "This page builds the voice from a sum of carriers. Here " +
          "are the first two of that sum, phases at zero, at one " +
          "moment t — the shape the full sum is built from.",
        inputs: [
          { key: "A1", label: "A₁ — first carrier's strength", min: 0, max: 2, step: 0.05, value: 1 },
          { key: "f1", label: "f₁ — first frequency (Hz)", min: 0, max: 1000, step: 1, value: 220 },
          { key: "A2", label: "A₂ — second carrier's strength", min: 0, max: 2, step: 0.05, value: 0.6 },
          { key: "f2", label: "f₂ — second frequency (Hz)", min: 0, max: 1000, step: 1, value: 331 },
          { key: "t", label: "t — the moment (seconds)", min: 0, max: 1, step: 0.01, value: 0.25 }
        ],
        compute(values) {
          const v =
            values.A1 * Math.cos(2 * Math.PI * values.f1 * values.t) +
            values.A2 * Math.cos(2 * Math.PI * values.f2 * values.t);
          return { text: `V(t) = ${formatNumber(v)}` };
        }
      }
    ];

    const PLAYGROUND_BY_PAGE = new Map();
    for (const playground of PLAYGROUNDS) {
      for (const page of playground.pages) {
        PLAYGROUND_BY_PAGE.set(page, playground);
      }
    }

    function playgroundForPage(pageFile) {
      return PLAYGROUND_BY_PAGE.get(String(pageFile || "")) || null;
    }

    function defaultValues(playground) {
      const values = {};
      for (const input of playground.inputs) {
        values[input.key] = input.value;
      }
      return values;
    }

    function computePlayground(playground, values = {}) {
      const merged = { ...defaultValues(playground) };

      for (const input of playground.inputs) {
        const raw = finiteOrNull(values[input.key]);
        if (raw !== null) {
          merged[input.key] = Math.min(
            input.max,
            Math.max(input.min, raw)
          );
        }
      }

      return playground.compute(merged);
    }

    /* --------------------- witness note records --------------------- */

    function coordinateForInstant(
      instant = new Date(),
      options = {},
      patternCalendar = null
    ) {
      const calendar =
        patternCalendar ||
        (typeof globalThis !== "undefined"
          ? globalThis.PatternCalendar
          : null);

      if (!calendar?.fromCivilDate) {
        return null;
      }

      const timeZone =
        options.timeZone ||
        (() => {
          try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone;
          } catch {
            return "UTC";
          }
        })();

      try {
        const conversion = calendar.fromCivilDate({
          date: instant instanceof Date ? instant : new Date(instant),
          timeZone,
          boundaryMode: options.boundaryMode || "midnight",
          sunsetTime: options.sunsetTime || "18:00"
        });

        return temporalFromConversion(conversion, instant);
      } catch {
        return null;
      }
    }

    function coordinateLabel(temporal) {
      if (!temporal) return "coordinate unavailable";

      if (temporal.outsideDay || temporal.patternDay === null) {
        return temporal.civilDate
          ? `${temporal.civilDate} · Day Out of Time · outside the 364-day count`
          : "Day Out of Time · outside the 364-day count";
      }

      const moon =
        temporal.moon !== null ? `Moon ${temporal.moon}` : "Moon —";

      const day =
        temporal.moonDay !== null
          ? `Day ${temporal.moonDay}`
          : "Day —";

      return `${moon} · ${day} · Pattern Day ${temporal.patternDay}`;
    }

    /**
     * Build the (pre-normalization) LifeRecord input for a page's
     * witness note. The repository's schema normalizes and validates
     * this on store; type is the schema's own "witness" type.
     */
    function buildWitnessNoteRecord(input = {}, temporal = null) {
      const pageId = cleanText(input.pageId, 80);
      const pageTitle = cleanText(input.pageTitle, 200);
      const note = cleanText(input.note, 500);
      const markedRead = input.markedRead === true;

      return {
        type: RECORD_TYPE,
        subtype: RECORD_SUBTYPE,

        title: pageTitle
          ? `Witness note — ${pageTitle}`
          : "Witness note — Theory page",
        summary: note,

        temporal: temporal || {},

        tags: [RECORD_TAG, pageId].filter(Boolean),

        provenance: {
          sourceType: "theory-work-module",
          sourceId: cleanNullable(input.pagePath, 200),
          calculationAuthority: "PatternCalendar"
        },

        privacy: {
          visibility: "private",
          containsPersonalData: true,
          shareAllowed: false
        },

        payload: {
          theoryWitness: {
            version: 1,
            pageId,
            pagePath: cleanNullable(input.pagePath, 200),
            pageTitle: pageTitle || null,
            note,
            markedRead
          }
        }
      };
    }

    function isWitnessNoteRecord(record) {
      if (!record || typeof record !== "object") return false;
      if (record.type !== RECORD_TYPE) return false;
      if (record.subtype !== RECORD_SUBTYPE) return false;
      return Boolean(record.payload?.theoryWitness);
    }

    /** Records arrive newest-first from the repository; take the
     *  first that belongs to this page. Pure: input order is trusted
     *  exactly as the repository's query returns it. */
    function latestNoteForPage(records = [], pageId = "") {
      for (const record of Array.isArray(records) ? records : []) {
        if (!isWitnessNoteRecord(record)) continue;
        if (record.payload.theoryWitness.pageId !== pageId) continue;
        return record;
      }
      return null;
    }

    /* --------------------- browser integration --------------------- */

    function pageFileOf(pathname) {
      const parts = String(pathname || "").split("/").filter(Boolean);
      return parts.length ? parts[parts.length - 1] : "";
    }

    function pagePathOf() {
      return String(window.location.pathname || "").replace(/^\//, "");
    }

    function el(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }

    function buildPlaygroundSection(playground) {
      const section = el("section", "theory-work-card");
      section.setAttribute("aria-label", playground.heading);

      section.appendChild(el("h2", "theory-work-heading", playground.heading));
      section.appendChild(el("p", "theory-work-formula", playground.formula));
      section.appendChild(el("p", "theory-work-blurb", playground.blurb));

      const values = defaultValues(playground);
      const readout = el("p", "theory-work-readout");
      readout.setAttribute("aria-live", "polite");
      const noteLine = el("p", "theory-work-note");

      const refresh = () => {
        const result = computePlayground(playground, values);
        readout.textContent = result.text;
        noteLine.textContent = result.note || "";
        noteLine.hidden = !result.note;
      };

      for (const input of playground.inputs) {
        const row = el("div", "theory-work-row");
        const label = el("label", "theory-work-label", input.label);
        label.htmlFor = `tw-${playground.id}-${input.key}`;

        const slider = document.createElement("input");
        slider.type = "range";
        slider.id = `tw-${playground.id}-${input.key}`;
        slider.min = String(input.min);
        slider.max = String(input.max);
        slider.step = String(input.step);
        slider.value = String(input.value);

        const valueOut = el("output", "theory-work-value");
        valueOut.htmlFor = slider.id;
        valueOut.textContent = formatNumber(input.value);

        slider.addEventListener("input", () => {
          values[input.key] = Number(slider.value);
          valueOut.textContent = formatNumber(values[input.key]);
          refresh();
        });

        row.appendChild(label);
        row.appendChild(slider);
        row.appendChild(valueOut);
        section.appendChild(row);
      }

      section.appendChild(readout);
      section.appendChild(noteLine);
      section.appendChild(
        el("p", "theory-work-honesty", HONESTY_LINE)
      );

      refresh();
      return section;
    }

    function buildNoteSection(pageId) {
      const section = el("section", "theory-work-card");
      section.setAttribute("aria-label", "State it in your own words");

      section.appendChild(
        el("h2", "theory-work-heading", "State it in your own words")
      );
      section.appendChild(
        el(
          "p",
          "theory-work-blurb",
          "One line is enough. Say what this page claims the way you " +
            "would say it — your words go into your own Life Atlas, " +
            "on this device only, tied to this page."
        )
      );

      const savedLine = el("p", "theory-work-saved");
      savedLine.setAttribute("aria-live", "polite");
      section.appendChild(savedLine);

      const textarea = document.createElement("textarea");
      textarea.className = "theory-work-textarea";
      textarea.rows = 2;
      textarea.maxLength = 500;
      textarea.placeholder = "In my own words, this page says…";
      textarea.setAttribute(
        "aria-label",
        "Your witness note for this page"
      );
      section.appendChild(textarea);

      const controls = el("div", "theory-work-controls");

      const markLabel = el("label", "theory-work-mark");
      const mark = document.createElement("input");
      mark.type = "checkbox";
      markLabel.appendChild(mark);
      markLabel.appendChild(
        document.createTextNode(" I have read this page")
      );
      controls.appendChild(markLabel);

      const save = el("button", "theory-work-save", "Save my note");
      save.type = "button";
      controls.appendChild(save);
      section.appendChild(controls);

      const status = el("p", "theory-work-status");
      status.setAttribute("aria-live", "polite");
      section.appendChild(status);

      const pageTitle =
        document.title.replace(/\s*\|\s*Codex of Reality\s*$/, "").trim() ||
        document.title;

      async function loadExisting() {
        const repository = await resolveRepository();
        if (!repository) return;

        try {
          const records = await repository.query({
            subtype: RECORD_SUBTYPE
          });
          const existing = latestNoteForPage(records, pageId);
          if (!existing) return;

          const payload = existing.payload.theoryWitness;
          if (payload.note) textarea.value = payload.note;
          mark.checked = payload.markedRead === true;
          savedLine.textContent =
            `Your note for this page is in your Life Atlas — ` +
            `${coordinateLabel(existing.temporal)}. ` +
            `Saving again updates it here.`;
        } catch {
          /* a page that cannot read its note still offers the writing */
        }
      }

      save.addEventListener("click", async () => {
        const note = textarea.value.trim();

        if (!note && !mark.checked) {
          status.textContent =
            "Write a line first — or tick the box to mark the page read.";
          return;
        }

        const repository = await resolveRepository();

        if (!repository) {
          status.textContent =
            "Your words are still in the box, but the Life Atlas was " +
            "unavailable just now, so nothing was recorded. Try again " +
            "in a moment.";
          return;
        }

        const temporal = coordinateForInstant(new Date());
        const record = buildWitnessNoteRecord(
          {
            pageId,
            pagePath: pagePathOf(),
            pageTitle,
            note,
            markedRead: mark.checked
          },
          temporal
        );

        try {
          const saved = await repository.put(record);
          notifyRecordsChanged({
            source: "theory-work",
            recordId: saved.id
          });
          savedLine.textContent =
            `Your note for this page is in your Life Atlas — ` +
            `${coordinateLabel(temporal)}.`;
          status.textContent = "Saved. It stays on this device.";
        } catch {
          status.textContent =
            "That save did not land. Your words are still in the box — " +
            "try once more.";
        }
      });

      void loadExisting();
      return section;
    }

    function init() {
      if (typeof document === "undefined") return;
      if (document.querySelector("[data-theory-work]")) return;

      const pageId = pageFileOf(window.location.pathname);
      const playground = playgroundForPage(pageId);

      const wrap = el("div", "theory-work");
      wrap.dataset.theoryWork = VERSION;
      wrap.appendChild(
        el(
          "p",
          "theory-work-kicker",
          "Work this page — two small things to do with what you just read."
        )
      );
      if (playground) wrap.appendChild(buildPlaygroundSection(playground));
      wrap.appendChild(buildNoteSection(pageId));

      const footer = document.querySelector("footer.site-footer");
      if (footer?.parentNode) {
        footer.parentNode.insertBefore(wrap, footer);
      } else {
        document.body.appendChild(wrap);
      }
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
      RECORD_TYPE,
      RECORD_SUBTYPE,
      HONESTY_LINE,
      PLAYGROUNDS,
      playgroundForPage,
      defaultValues,
      computePlayground,
      buildWitnessNoteRecord,
      isWitnessNoteRecord,
      latestNoteForPage,
      temporalFromConversion,
      coordinateForInstant,
      coordinateLabel,
      formatNumber
    };
  }
);
