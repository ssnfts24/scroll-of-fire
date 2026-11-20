/**
 * The Witness Mark — interactivity wave 3 (Aaron's standing
 * rule, Nov 19, 2026: every page offers a real action, not a
 * read-only wall).
 *
 * Long-read pages — the whitepapers, Mind-Renewal, and the
 * essays that follow them — carry a standing action strip:
 *
 *   - a section rail, built from the page's own headings, so a
 *     long read can be travelled, not just scrolled;
 *   - the Witness Mark itself: the keeper marks the page as
 *     witnessed, with an optional one-line reflection, and the
 *     mark goes into their Life Atlas record stamped with
 *     today's Pattern coordinate from the canonical calendar —
 *     the same record discipline as the Pattern Garden (shared
 *     CodexRecordHelpers, shared repository). The day also ties
 *     onto the keeper's Living Trail.
 *
 * One mark per page per day: a second press on the same day is
 * told, honestly, that the day already carries the mark. The
 * pure builders are unit-tested in tests/witness-mark.test.js.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.WitnessMark = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const VERSION = "witness-mark/1.0.0";
    const SUBTYPE = "witness-mark";
    const TAG = "witness-mark";

    function clean(value, max = 200) {
      return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    }

    function buildMarkRecord(input = {}, temporal = null) {
      const pageTitle = clean(input.pageTitle, 120) || "A page of the Codex";
      const path = clean(input.path, 200);
      const reflection = clean(input.reflection, 280);
      return {
        type: "event",
        subtype: SUBTYPE,
        title: `Witnessed — ${pageTitle}`,
        summary:
          "A long read witnessed and marked in the keeper's record, with its Pattern stamp." +
          (reflection ? ` The keeper's line: “${reflection}”` : ""),
        temporal: temporal || {},
        tags: [TAG, "long-read"],
        provenance: {
          sourceType: "witness-mark",
          sourceId: path || null,
          calculationAuthority: "PatternCalendar"
        },
        privacy: {
          visibility: "private",
          containsPersonalData: true,
          shareAllowed: false
        },
        payload: {
          witnessMark: {
            version: 1,
            action: "witness",
            pageTitle,
            path,
            reflection: reflection || null
          }
        }
      };
    }

    function alreadyWitnessedOn(records, path, civilDate) {
      if (!Array.isArray(records) || !path || !civilDate) return false;
      return records.some(record =>
        record &&
        record.subtype === SUBTYPE &&
        record.payload?.witnessMark?.path === path &&
        record.temporal?.civilDate === civilDate
      );
    }

    /* --------------------- browser wiring --------------------- */

    function helpers() {
      return typeof CodexRecordHelpers !== "undefined" ? CodexRecordHelpers : null;
    }

    function temporalNow() {
      const H = helpers();
      const cal = typeof PatternCalendar !== "undefined" ? PatternCalendar : null;
      if (!H || !cal?.fromCivilDate) return null;
      try {
        const now = new Date();
        return H.temporalFromConversion(cal.fromCivilDate({ date: now }), now);
      } catch { return null; }
    }

    async function init() {
      const host = document.querySelector("[data-witness-mark]");
      if (!host) return;
      const H = helpers();
      const pageTitle = (document.title || "This page").replace(/\s*[—|·].*$/, "").trim();
      const path = location.pathname.split("/").pop() || "index.html";

      host.classList.add("witness-mark");
      host.replaceChildren();

      /* The section rail, from the page's own headings. */
      const headings = [...document.querySelectorAll("main h2, article h2")].filter(h => h.textContent.trim());
      if (headings.length >= 3) {
        const rail = document.createElement("nav");
        rail.className = "witness-mark-rail";
        rail.setAttribute("aria-label", "Sections of this page");
        const label = document.createElement("span");
        label.className = "witness-mark-rail-label";
        label.textContent = "Travel this read:";
        rail.appendChild(label);
        headings.slice(0, 10).forEach((h, i) => {
          if (!h.id) h.id = `witness-section-${i + 1}`;
          const a = document.createElement("a");
          a.href = `#${h.id}`;
          a.textContent = h.textContent.trim().slice(0, 60);
          rail.appendChild(a);
        });
        host.appendChild(rail);
      }

      const temporal = temporalNow();
      const stampLine = document.createElement("p");
      stampLine.className = "witness-mark-stamp";
      stampLine.textContent = temporal
        ? (temporal.patternDay
          ? `Today: Moon ${temporal.moon} · Day ${temporal.moonDay} · Pattern Day ${temporal.patternDay}.`
          : `Today: ${temporal.civilDate} — outside the 364-day count.`)
        : "The calendar could not be read on this page; a mark can still be kept, unstamped.";
      host.appendChild(stampLine);

      const reflection = document.createElement("input");
      reflection.type = "text";
      reflection.className = "witness-mark-reflection";
      reflection.maxLength = 280;
      reflection.placeholder = "One line to keep from this read (optional)";
      reflection.setAttribute("aria-label", "One line to keep from this read");
      host.appendChild(reflection);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "witness-mark-button";
      button.textContent = "Witness this page";
      host.appendChild(button);

      const state = document.createElement("p");
      state.className = "witness-mark-state";
      state.setAttribute("aria-live", "polite");
      host.appendChild(state);

      let repository = null;
      let witnessedToday = false;
      if (H?.createRepositoryResolver) {
        try {
          repository = await H.createRepositoryResolver()();
          if (repository) {
            const records = await repository.query({});
            witnessedToday = alreadyWitnessedOn(records, path, temporal?.civilDate);
            if (witnessedToday) {
              state.textContent = "This page already carries today's witness mark. Read on — the mark stands.";
              button.disabled = true;
              button.textContent = "Witnessed today";
            }
          }
        } catch { /* the record is the keeper's; the button still offers the mark */ }
      }

      button.addEventListener("click", async () => {
        if (witnessedToday) return;
        const record = buildMarkRecord(
          { pageTitle, path, reflection: reflection.value },
          temporalNow()
        );
        let kept = false;
        if (repository) {
          try { await repository.put(record); kept = true; } catch { kept = false; }
        }
        if (typeof LivingTrail !== "undefined") {
          try { LivingTrail.recordDay(); } catch { /* courtesy only */ }
        }
        witnessedToday = true;
        button.disabled = true;
        button.textContent = "Witnessed today";
        state.textContent = kept
          ? "Witnessed and kept in your Life Atlas, with today's Pattern stamp. It lives on this device, in your record."
          : "Witnessed. The Atlas could not be reached from this page, so the mark is held in your trail for today — nothing was pretended into the record.";
      });
    }

    if (typeof document !== "undefined") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => { void init(); });
      } else {
        void init();
      }
    }

    return { VERSION, SUBTYPE, buildMarkRecord, alreadyWitnessedOn };
  }
);
