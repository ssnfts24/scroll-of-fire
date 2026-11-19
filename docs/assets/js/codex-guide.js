/*
 * The Codex Guide — ask the record, get an answer with its proof
 * showing.
 *
 * Living Witness, Rung 2 (Dashboard item 17, approved Nov 18, 2026 on
 * terms that start Rungs 1–2). Design: living-witness-system-design,
 * Section 2, Rung 2 — a Guide door where a visitor types a question
 * in ordinary words and gets an answer assembled from the site's own
 * record, sources showing: a passage with its page; a claim card with
 * what it establishes, what remains unverified, and its evidence
 * grade; a lexicon entry with its standing caveat; a calendar answer
 * computed, not searched. Where the record has nothing, the Guide
 * says so in those words: "The record doesn't cover that."
 *
 * The fence, kept visible: the Guide is a program, plainly labeled —
 * not Aaron, and not Witness. It answers from the sealed public
 * record only (the same Living Search index the site search uses,
 * plus the claim register), it cannot hold a conversation, and the
 * question never leaves the visitor's browser: the index is the
 * site's own, loaded as static files, and the search runs here.
 *
 * Calendar answers are computed with PatternCalendar — the one
 * calendar authority — in its plain UTC/midnight form, the same form
 * the shared test corpus pins. Nothing here keeps a second clock.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexGuide = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RECORD_DOES_NOT_COVER = "The record doesn't cover that.";

  const AREA_LABELS = Object.freeze({
    pages: "Page",
    scrolls: "Scroll",
    lexicon: "Hebrew Lexicon",
    claims: "Claim Register",
    atlas: "Codex Atlas"
  });

  const MONTH_NAMES = Object.freeze({
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11,
    december: 12
  });

  /* ------------------------- calendar intent ------------------------ */

  function parseCalendarIntent(question) {
    const text = String(question || "").toLowerCase();

    if (!text.trim()) return null;

    if (/day out of time/.test(text)) return { kind: "day-out-of-time" };

    const patternDay = text.match(/pattern day\s+(\d{1,3})\b/);
    if (patternDay) {
      return { kind: "pattern-day", patternDay: Number(patternDay[1]) };
    }

    const moonDay = text.match(
      /moon\s+(\d{1,2})\b[^0-9]{0,12}day\s+(\d{1,2})\b/
    );
    if (moonDay) {
      return {
        kind: "moon-day",
        moon: Number(moonDay[1]),
        day: Number(moonDay[2])
      };
    }

    const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (iso) {
      return { kind: "civil-date", civilDate: iso[0] };
    }

    const named = text.match(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/
    );
    if (named) {
      const month = String(MONTH_NAMES[named[1]]).padStart(2, "0");
      const day = String(Number(named[2])).padStart(2, "0");
      return { kind: "civil-date", civilDate: `${named[3]}-${month}-${day}` };
    }

    if (/\btoday\b/.test(text)) return { kind: "today" };

    return null;
  }

  function calendarConversion(calendar, date) {
    return calendar.fromCivilDate({
      date,
      timeZone: "UTC",
      boundaryMode: "midnight",
      sunsetTime: "18:00"
    });
  }

  function describePosition(conversion) {
    if (!conversion) return null;

    if (conversion.isDayOutOfTime) {
      return {
        civilDate: conversion.civilDate,
        headline: "Day Out of Time",
        detail:
          `The day between the years — ${conversion.civilDate}. ` +
          "No Moon, no Pattern Day."
      };
    }

    if (!conversion.insideCountedYear || conversion.moon === null) {
      return {
        civilDate: conversion.civilDate,
        headline: conversion.civilDate,
        detail: "Outside the counted year."
      };
    }

    return {
      civilDate: conversion.civilDate,
      headline:
        `Moon ${conversion.moon} · Day ${conversion.day}` +
        ` · Pattern Day ${conversion.dayOfPatternYear}`,
      detail:
        `${conversion.moonName || ""} — ${conversion.civilDate}` +
        (conversion.dayArchetype ? ` · ${conversion.dayArchetype}` : "")
    };
  }

  /*
   * Answer a calendar intent against the reference instant (usually
   * now). Pattern Day and Moon/Day questions resolve inside the
   * reference day's own pattern year, scanning from its anchor —
   * PatternCalendar stays the only authority; this only walks its
   * answers.
   */
  function answerCalendarIntent(intent, { calendar, now = new Date() } = {}) {
    if (!intent || !calendar?.fromCivilDate) return null;

    const reference = calendarConversion(calendar, now);

    if (!reference) return null;

    if (intent.kind === "today") {
      return { intent, ...describePosition(reference) };
    }

    if (intent.kind === "civil-date") {
      const [year, month, day] = intent.civilDate.split("-").map(Number);
      const conversion = calendarConversion(
        calendar,
        new Date(Date.UTC(year, month - 1, day, 12))
      );
      return { intent, ...describePosition(conversion) };
    }

    const anchor =
      reference.anchorDate instanceof Date
        ? reference.anchorDate
        : new Date(reference.anchorDate);

    if (Number.isNaN(anchor.getTime())) return null;

    if (intent.kind === "day-out-of-time") {
      /* The Day Out of Time that closes the reference pattern year is
       * the day after its 364 counted days. */
      const candidate = new Date(anchor.getTime() + 364 * 86400000);
      const conversion = calendarConversion(calendar, candidate);

      if (conversion?.isDayOutOfTime) {
        return { intent, ...describePosition(conversion) };
      }

      return null;
    }

    if (
      intent.kind === "pattern-day" &&
      (intent.patternDay < 1 || intent.patternDay > 364)
    ) {
      return {
        intent,
        civilDate: null,
        headline: `There is no Pattern Day ${intent.patternDay}`,
        detail: "A counted year holds Pattern Days 1 to 364."
      };
    }

    if (
      intent.kind === "moon-day" &&
      (intent.moon < 1 || intent.moon > 13 || intent.day < 1 || intent.day > 28)
    ) {
      return {
        intent,
        civilDate: null,
        headline: "That day is not in the calendar",
        detail: "A year holds Moons 1 to 13, and every Moon holds 28 days."
      };
    }

    for (let offset = 0; offset < 364; offset += 1) {
      const candidate = new Date(anchor.getTime() + offset * 86400000);
      const conversion = calendarConversion(calendar, candidate);

      if (!conversion) continue;

      if (
        intent.kind === "pattern-day" &&
        conversion.dayOfPatternYear === intent.patternDay
      ) {
        return { intent, ...describePosition(conversion) };
      }

      if (
        intent.kind === "moon-day" &&
        conversion.moon === intent.moon &&
        conversion.day === intent.day
      ) {
        return { intent, ...describePosition(conversion) };
      }
    }

    return null;
  }

  /* --------------------------- claim cards -------------------------- */

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function matchClaims(question, claims) {
    if (!Array.isArray(claims) || !claims.length) return [];

    const text = String(question || "");
    const upper = text.toUpperCase();

    const byId = claims.filter(
      claim => claim.id && upper.includes(String(claim.id).toUpperCase())
    );

    if (byId.length) return byId.slice(0, 2);

    const tokens = new Set(
      normalizeText(text)
        .split(" ")
        .filter(token => token.length >= 4)
    );

    if (!tokens.size) return [];

    const scored = [];

    for (const claim of claims) {
      const titleTokens = normalizeText(claim.title)
        .split(" ")
        .filter(token => token.length >= 4);

      const hits = titleTokens.filter(token => tokens.has(token)).length;

      if (hits >= 2) scored.push({ claim, hits });
    }

    scored.sort((a, b) => b.hits - a.hits);

    return scored.slice(0, 2).map(entry => entry.claim);
  }

  function buildClaimCard(claim) {
    if (!claim) return null;

    return {
      id: claim.id || null,
      title: claim.title || "Untitled claim",
      classification: claim.classification || null,
      grade: claim.evidenceStatus || null,
      gradeText: claim.evidenceStatusDescription || null,
      statusLabel: claim.statusLabel || null,
      establishes: claim.establishes || null,
      unverified: claim.unverified || null,
      sources: Array.isArray(claim.sources)
        ? claim.sources.map(source => ({
            title: source.title || source.url || "Source",
            publisher: source.publisher || null,
            date: source.date || null,
            url: source.url || null
          }))
        : []
    };
  }

  /* ---------------------------- passages ---------------------------- */

  function shapePassages(results, core, question, limit = 5) {
    if (!Array.isArray(results) || !results.length) return [];

    let groups = results;

    if (core && typeof core.groupResults === "function") {
      groups = core.groupResults(results);
    }

    return groups.slice(0, limit).map(group => {
      const doc = group.doc || {};

      let snippet = "";

      if (core && typeof core.snippetFor === "function") {
        try {
          const shaped = core.snippetFor(doc, question);
          /* LivingSearchCore.snippetFor returns { text, ranges }. */
          snippet =
            typeof shaped === "string" ? shaped : shaped?.text || "";
        } catch {
          snippet = "";
        }
      }

      return {
        title: doc.t || "Untitled",
        area: doc.a || "",
        areaLabel: AREA_LABELS[doc.a] || doc.a || "Record",
        url: doc.u || null,
        snippet,
        isLexicon: doc.a === "lexicon",
        folded: Array.isArray(group.folded) ? group.folded.length : 0
      };
    });
  }

  /* ------------------------- browser wiring ------------------------- */

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${url}`);
    return response.json();
  }

  async function loadIndex(core, searchRoot) {
    const index = core.createIndex();
    const manifest = await fetchJson(`${searchRoot}manifest.json`);
    const shards = Array.isArray(manifest.shards)
      ? manifest.shards
      : Object.values(manifest.shards || {});

    for (const shard of shards) {
      const file = typeof shard === "string" ? shard : shard.file;
      if (!file) continue;
      const payload = await fetchJson(searchRoot + file);
      if (Array.isArray(payload.docs)) core.addDocuments(index, payload.docs);
    }

    return index;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderAnswer(container, answer) {
    container.innerHTML = "";

    if (answer.calendar) {
      const section = el("section", "codex-guide__answer");
      section.append(
        el("p", "codex-guide__kicker", "Computed from the Pattern Calendar"),
        el("h3", "codex-guide__headline", answer.calendar.headline),
        el("p", "codex-guide__detail", answer.calendar.detail || "")
      );
      container.append(section);
    }

    for (const card of answer.claimCards) {
      const section = el("section", "codex-guide__answer codex-guide__claim");
      section.append(
        el("p", "codex-guide__kicker", "From the Claim Register"),
        el("h3", "codex-guide__headline", card.title)
      );

      if (card.grade) {
        const grade = el(
          "p",
          "codex-guide__grade",
          `Evidence grade: ${card.grade.replace(/-/g, " ")}`
        );
        section.append(grade);

        if (card.gradeText) {
          section.append(el("p", "codex-guide__detail", card.gradeText));
        }
      }

      if (card.establishes) {
        section.append(
          el("p", "codex-guide__label", "What it establishes"),
          el("p", "codex-guide__detail", card.establishes)
        );
      }

      if (card.unverified) {
        section.append(
          el("p", "codex-guide__label", "What remains unverified"),
          el("p", "codex-guide__detail", card.unverified)
        );
      }

      if (card.sources.length) {
        const list = el("ul", "codex-guide__sources");

        for (const source of card.sources) {
          const item = el("li");
          const link = el("a", "", source.title);
          if (source.url) link.href = source.url;
          item.append(link);

          const meta = [source.publisher, source.date]
            .filter(Boolean)
            .join(" · ");

          if (meta) item.append(document.createTextNode(` — ${meta}`));

          list.append(item);
        }

        section.append(el("p", "codex-guide__label", "Sources"), list);
      }

      container.append(section);
    }

    if (answer.passages.length) {
      const section = el("section", "codex-guide__answer");
      section.append(
        el("p", "codex-guide__kicker", "From the record"),
        el("h3", "codex-guide__headline", "Passages that speak to it")
      );

      const list = el("ul", "codex-guide__passages");

      for (const passage of answer.passages) {
        const item = el("li", "codex-guide__passage");
        const link = el("a", "", passage.title);
        if (passage.url) link.href = passage.url;

        const meta = el(
          "span",
          "codex-guide__passage-meta",
          ` — ${passage.areaLabel}`
        );

        item.append(link, meta);

        if (passage.snippet) {
          item.append(
            el("span", "codex-guide__snippet", passage.snippet)
          );
        }

        if (passage.isLexicon) {
          item.append(
            el(
              "span",
              "codex-guide__caveat",
              "Lexicon entries stand as the site keeps them: the Hebrew text and its sources are the record; readings marked draft are unreviewed."
            )
          );
        }

        list.append(item);
      }

      section.append(list);
      container.append(section);
    }

    if (!answer.calendar && !answer.claimCards.length && !answer.passages.length) {
      const section = el("section", "codex-guide__answer");
      section.append(
        el("h3", "codex-guide__headline", RECORD_DOES_NOT_COVER),
        el(
          "p",
          "codex-guide__detail",
          "The Guide answers only from this site's own record — its pages, scrolls, lexicon, and claim register. If it is not there, the Guide has nothing honest to add."
        )
      );

      if (answer.suggestions.length) {
        section.append(
          el(
            "p",
            "codex-guide__detail",
            `Nearest words in the record: ${answer.suggestions.join(", ")}.`
          )
        );
      }

      container.append(section);
    }
  }

  function initGuidePage() {
    const form = document.querySelector("[data-codex-guide-form]");

    if (!form || form.dataset.codexGuideReady) return;

    form.dataset.codexGuideReady = "1";

    const input = form.querySelector("[data-codex-guide-input]");
    const output = document.querySelector("[data-codex-guide-output]");
    const status = document.querySelector("[data-codex-guide-status]");

    if (!input || !output) return;

    const scriptUrl = document.currentScript?.src || "";
    const searchRoot = scriptUrl
      ? new URL("../search/", scriptUrl).href
      : "assets/search/";
    const registerUrl = scriptUrl
      ? new URL("../../scroll/evidence/claim-register.json", scriptUrl).href
      : "scroll/evidence/claim-register.json";

    let statePromise = null;

    function loadState() {
      if (statePromise) return statePromise;

      statePromise = (async () => {
        const core =
          typeof globalThis !== "undefined"
            ? globalThis.LivingSearchCore
            : null;

        if (!core) return { core: null, index: null, claims: [] };

        const [index, register] = await Promise.all([
          loadIndex(core, searchRoot).catch(() => null),
          fetchJson(registerUrl).catch(() => null)
        ]);

        return {
          core,
          index,
          claims: Array.isArray(register?.claims) ? register.claims : []
        };
      })();

      return statePromise;
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const question = input.value.trim();

      if (!question) return;

      if (status) status.textContent = "Asking the record…";

      const { core, index, claims } = await loadState();
      const calendar =
        typeof globalThis !== "undefined" ? globalThis.PatternCalendar : null;

      const intent = parseCalendarIntent(question);
      const calendarAnswer = intent
        ? answerCalendarIntent(intent, { calendar, now: new Date() })
        : null;

      const claimCards = matchClaims(question, claims)
        .map(buildClaimCard)
        .filter(Boolean);

      let passages = [];
      let suggestions = [];

      if (core && index) {
        const { results, unresolved } = core.search(index, question, {
          limit: 30
        });

        passages = shapePassages(results, core, question);

        if (!passages.length && unresolved?.length) {
          suggestions = [
            ...new Set(
              unresolved.flatMap(token => core.suggestTerms(index, token))
            )
          ].slice(0, 5);
        }
      }

      renderAnswer(output, {
        calendar: calendarAnswer,
        claimCards,
        passages,
        suggestions
      });

      if (status) {
        status.textContent =
          "Answered from the record. Every line above names where it came from.";
      }
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initGuidePage);
    } else {
      initGuidePage();
    }
  }

  return {
    RECORD_DOES_NOT_COVER,
    AREA_LABELS,
    parseCalendarIntent,
    answerCalendarIntent,
    describePosition,
    matchClaims,
    buildClaimCard,
    shapePassages,
    normalizeText
  };
});
