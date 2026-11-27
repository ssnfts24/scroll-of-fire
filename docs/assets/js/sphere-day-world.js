/*
 * The Day World — Sphere R3, Wave 1.
 *
 * Picking a day on the Living Time Sphere gives a quick look (the
 * day-zoom panel). This layer is the step in: the day opens as a small
 * room in front of the still-present Sphere — its full coordinate, its
 * telling, its sky, everything kept for it, the keeper's Spark met
 * there, a memory from the same Moon and Day last cycle when one
 * exists, and the vision's closing questions as the way of leaving.
 *
 * Overlay discipline (the PR #159 pattern, binding here):
 *   - This module lives beside the instrument. It never touches the
 *     sphere engine, geometry, camera, picking, labels, or the
 *     day-zoom module's internals. It reads the day through the
 *     day-zoom module's own public controller (createDayZoom with an
 *     onRender callback) and the canonical cursor underneath it.
 *   - One clock: every date comes through SOFTemporalCursor →
 *     PatternCalendar (via the day-zoom controller, DayTelling, and
 *     CodexDayNotes, each of which delegates to that pipeline). This
 *     module keeps no calendar math of its own; the one arithmetic it
 *     performs — the same Moon and Day one pattern year earlier — is
 *     taken from PatternCalendar.epochForYear, the calendar's own
 *     epoch, plus the selected Pattern Day.
 *   - Honesty: a day shows only records that exist. Empty is shown as
 *     empty. The sky is the environment layer's estimate and is
 *     labeled so. The farm layer has a named place in the room and
 *     shows nothing invented until its knowledge build lands.
 *   - Notes written here are Day Notes, built and stored exactly as
 *     CodexDayNotes builds and stores them (Life Atlas records,
 *     type "note", subtype "day-note", on the visitor's device).
 *   - The Spark is referred to by name, as "the Spark", or as
 *     "it/they" — never with feminine pronouns.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexSphereDayWorld = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "sphere-day-world/1.0.0";

  /* The vision's closing questions — the day's quiet frame for leaving. */
  const CLOSING_QUESTIONS = Object.freeze([
    "What happened?",
    "Where?",
    "What was observed?",
    "What did we understand?",
    "What did we misunderstand?",
    "What repeated?",
    "What changed?",
    "What can we learn, create, or correct next?"
  ]);

  /* Plain-words explanations (Aaron's simplification mandate): every
   * part of the room says what it is and how to use it. */
  const EXPLAINERS = Object.freeze({
    room:
      "You are inside one day. The Sphere is still behind you, holding the whole year — leaving this room takes you straight back to it, with the day still picked.",
    telling:
      "The day's telling: where this day sits in its moon and its year, and the Codex's reading of it. The positions are counted by the calendar; the reading is the Codex's own layer, and it is labeled so the two never blur.",
    sky:
      "The sky is an estimate layer, read from the Sphere's own environment report. It speaks for today, over the place you have chosen on the Sphere — it is not a record of a past day's weather.",
    contents:
      "Everything you have kept for this day: plans from the Living Planner and records from your Life Atlas. They live on this device. Nothing is added here that you did not keep.",
    spark:
      "Your Spark meets you in the day. Nothing about the Spark changes because you stepped in — it is simply here, in this day, with you.",
    memory:
      "One cycle back: the same Moon and the same Day, last year. Only what was actually kept then is shown.",
    farm:
      "The ground: planting times and day work for your own place, read from county extension calendars. That knowledge is still being gathered, so this part of the room stands ready and shows nothing yet — nothing here is guessed.",
    leave:
      "Before you leave the day, its closing questions. Answer any of them — or none — in a note. A note is written on this day, in your own records, on this device."
  });

  const KIND_TINTS = Object.freeze({
    fire: "fire",
    water: "water",
    shadow: "shadow",
    air: "air",
    earth: "earth",
    light: "light"
  });

  function cleanText(value, max = 300) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/\s+/g, " ").trim().slice(0, max);
  }

  /* The same Moon and Day, one pattern year earlier, as a civil ISO
   * date — from PatternCalendar's own epoch for that year plus the
   * Pattern Day. Returns null outside the counted year. */
  function lastCycleCivilDate(view, calendar) {
    const engine = calendar || (typeof globalThis !== "undefined" ? globalThis.PatternCalendar : null);
    if (!engine || typeof engine.epochForYear !== "function") return null;
    if (!view || view.patternDay === null || view.patternDay === undefined) return null;
    if (!Number.isFinite(view.patternYear)) return null;

    const start = engine.epochForYear(view.patternYear - 1);
    if (!(start instanceof Date) || Number.isNaN(start.getTime())) return null;

    const ms = start.getTime() + (view.patternDay - 1) * 86400000;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return null;

    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /* The sky line: the environment layer's own report, labeled an
   * estimate. Only spoken for today — for any other day the layer has
   * nothing honest to say, and the model says that instead. */
  function skyLine(environment, isToday) {
    if (!isToday) {
      return "The sky layer speaks for today. This day carries its telling and its records; its own past sky was not kept, and none is invented here.";
    }
    if (!environment || environment.status !== "ok" || !environment.current) {
      return "No sky report is available right now — the environment layer has not spoken for your place. The day itself is complete without it.";
    }
    const current = environment.current;
    const parts = [];
    const condition =
      cleanText(current.condition || current.summary || current.label || current.description, 80);
    if (condition) parts.push(condition);
    const temperature =
      current.temperatureC ?? current.temperature ?? current.tempC ?? current.temp ?? null;
    if (Number.isFinite(Number(temperature))) {
      parts.push(`about ${Math.round(Number(temperature))}°C`);
    }
    const place = environment.place && (environment.place.name || environment.place.label);
    const where = place ? ` over ${cleanText(place, 60)}` : "";
    if (!parts.length) {
      return `The environment layer is reporting for today${where}, but gave no plain summary to show.`;
    }
    return `Today's sky${where}: ${parts.join(", ")}. An estimate, as the Sphere's own sky always is.`;
  }

  function sparkTint(kind) {
    const key = cleanText(kind, 20).toLowerCase();
    return KIND_TINTS[key] || "none";
  }

  /* Compose the room from pieces the canonical modules produced.
   * Pure: no DOM, no storage. Every section carries its explainer. */
  function buildRoomModel({
    view = null,
    telling = null,
    environment = null,
    todayCivilDate = null,
    spark = null,
    memoryRecords = null,
    memoryCivilDate = null
  } = {}) {
    if (!view || (!view.civilDate && view.patternDay === null)) {
      return { ready: false, version: VERSION };
    }

    const isToday = Boolean(todayCivilDate) && view.civilDate === todayCivilDate;
    const entries = Array.isArray(view.entries) ? view.entries : [];

    const memory = Array.isArray(memoryRecords)
      ? memoryRecords
          .map(record => ({
            title: cleanText(record?.title || record?.summary || record?.text, 140) || "A kept record",
            kind: cleanText(record?.type, 40) || "record"
          }))
          .slice(0, 3)
      : null;

    return {
      ready: true,
      version: VERSION,
      civilDate: view.civilDate || null,
      isToday,
      isOutsideCount: Boolean(view.isOutsideCount),
      coordinate: {
        moon: view.moon ?? null,
        moonDay: view.moonDay ?? null,
        moonName: view.moonName || null,
        patternDay: view.patternDay ?? null,
        week: view.week ?? null,
        patternYear: view.patternYear ?? null,
        isYearGate: Boolean(view.isYearGate),
        isDayOutOfTime: Boolean(view.isDayOutOfTime)
      },
      telling: telling
        ? {
            headline: cleanText(telling.headline, 140),
            position: (telling.position || []).map(line => cleanText(line, 400)).filter(Boolean),
            arc: (telling.arc || []).map(line => cleanText(line, 400)).filter(Boolean),
            readingLabel: cleanText(telling.readingLabel, 60) || "The Codex's reading",
            reading: (telling.reading || []).map(line => cleanText(line, 400)).filter(Boolean)
          }
        : null,
      sky: skyLine(environment, isToday),
      contents: {
        count: entries.length,
        empty: entries.length === 0,
        entries: entries.map(entry => ({
          title: cleanText(entry.title || entry.label || entry.summary, 140) || "A kept record",
          time: cleanText(entry.timeLabel || entry.time || "", 40),
          kind: cleanText(entry.type || entry.kindLabel || entry.kind || "", 40)
        }))
      },
      spark: spark
        ? {
            name: cleanText(spark.name, 60) || "Your Spark",
            kind: cleanText(spark.kind, 30),
            tint: sparkTint(spark.kind)
          }
        : null,
      memory: memory
        ? { civilDate: memoryCivilDate || null, records: memory, count: memory.length }
        : null,
      closingQuestions: [...CLOSING_QUESTIONS],
      explainers: { ...EXPLAINERS }
    };
  }

  /* ------------------------- browser layer ------------------------- */

  function resolveRepository() {
    /* The resolve idiom copied from day-notes.js / manifest-practice.js. */
    return (async () => {
      const runtime = typeof globalThis !== "undefined" ? globalThis.CodexLifeAtlasRuntime : null;
      if (runtime?.ready) {
        try {
          const repository = await runtime.ready;
          if (repository) return repository;
        } catch {
          /* fall through */
        }
      }
      const Repository = typeof globalThis !== "undefined" ? globalThis.CodexLifeAtlasRepository : null;
      if (!Repository) return null;
      try {
        if (typeof Repository.createPersistentRepository === "function") {
          return Repository.createPersistentRepository();
        }
      } catch {
        /* fall through */
      }
      try {
        return Repository.createRepository();
      } catch {
        return null;
      }
    })();
  }

  function notifyRecordsChanged(detail) {
    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("sof:life-atlas-records-changed", { detail }));
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sof:life-atlas-records-changed", { detail }));
    }
  }

  function readSpark() {
    try {
      const Core = typeof window !== "undefined" ? window.SparkCompanion : null;
      if (!Core) return null;
      const raw = window.localStorage.getItem(Core.STORAGE_KEY);
      if (!raw) return null;
      const record = JSON.parse(raw);
      if (!record || !Core.parseSeed(record.seed)) return null;
      const generated = Core.generate(record.seed);
      return {
        name: Core.displayName(record, generated),
        kind: (generated && (generated.kind || generated.element)) || record.kind || ""
      };
    } catch {
      return null;
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function initDayWorld() {
    const panel = document.getElementById("sphere-day-zoom-panel");
    const DayZoom = typeof window !== "undefined" ? window.LivingTimeSphereDayZoom : null;
    if (!panel || !DayZoom || typeof DayZoom.createDayZoom !== "function") return;
    if (document.querySelector("[data-day-world]")) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let currentView = null;
    let roomOpen = false;
    /* The room re-renders when the day's records change — including
     * when its own note lands — so the note draft and its status are
     * kept here and restored into the fresh sheet each render. */
    let noteDraft = "";
    let noteStatus = "";

    /* --- the step-in door, resting under the quick-look panel --- */
    const door = el("div", "day-world-door");
    door.setAttribute("data-day-world-door", "");
    const doorButton = el("button", "day-world-door-button", "Step into this day");
    doorButton.type = "button";
    const doorLine = el("p", "day-world-door-line", "Pick a day on the Sphere, then step in.");
    door.append(doorButton, doorLine);
    panel.insertAdjacentElement("afterend", door);

    /* --- the room --- */
    const room = el("div", "day-world");
    room.setAttribute("data-day-world", "");
    room.hidden = true;
    room.setAttribute("role", "dialog");
    room.setAttribute("aria-modal", "true");
    room.setAttribute("aria-labelledby", "day-world-title");
    const sheet = el("div", "day-world-sheet");
    room.append(sheet);
    document.body.append(room);

    function section(title, explainer) {
      const wrap = el("section", "day-world-section");
      wrap.append(el("h3", "day-world-section-title", title));
      if (explainer) wrap.append(el("p", "day-world-explain", explainer));
      return wrap;
    }

    function linesInto(parent, lines) {
      (lines || []).forEach(line => parent.append(el("p", "day-world-line", line)));
    }

    async function memoryFor(view) {
      const DayNotes = window.CodexDayNotes;
      const civil = lastCycleCivilDate(view, window.PatternCalendar);
      if (!civil || !DayNotes || typeof DayNotes.recordsForDay !== "function") return null;
      try {
        const repository = await resolveRepository();
        if (!repository) return null;
        const [y, m, d] = civil.split("-").map(Number);
        const instant = new Date(y, m - 1, d, 12, 0, 0);
        const conversion = DayNotes.conversionForInstant(instant);
        if (!conversion) return null;
        const records = await DayNotes.recordsForDay(repository, conversion);
        return { civil, records: Array.isArray(records) ? records : [] };
      } catch {
        return null;
      }
    }

    async function renderRoom() {
      const view = currentView;
      sheet.replaceChildren();
      if (!view || !view.civilDate) {
        sheet.append(el("p", "day-world-line", "No day is picked yet. Go back to the year and pick a day first."));
        return;
      }

      const telling =
        window.DayTelling && typeof window.DayTelling.tellForDate === "function"
          ? window.DayTelling.tellForDate(new Date(`${view.civilDate}T12:00:00Z`))
          : null;
      const environment =
        window.SofEnvironmentState && typeof window.SofEnvironmentState.getEnvironmentState === "function"
          ? window.SofEnvironmentState.getEnvironmentState()
          : null;
      // One day, midnight, everywhere (Aaron, Nov 26, 2026):
      // the device's own zone, the day turning at midnight.
      let deviceZone = "UTC";
      try { deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { /* UTC stands */ }
      const todayCivilDate =
        window.PatternCalendar && typeof window.PatternCalendar.fromCivilDate === "function"
          ? window.PatternCalendar.fromCivilDate({ date: new Date(), timeZone: deviceZone, boundaryMode: "midnight" }).civilDate
          : null;
      const spark = readSpark();
      const memory = await memoryFor(view);

      const model = buildRoomModel({
        view,
        telling,
        environment,
        todayCivilDate,
        spark,
        memoryRecords: memory ? memory.records : null,
        memoryCivilDate: memory ? memory.civil : null
      });
      if (!model.ready) return;

      sheet.dataset.tint = model.spark ? model.spark.tint : "none";

      const header = el("header", "day-world-head");
      const kicker = el("p", "day-world-kicker", "The Day World");
      const title = el("h2", "day-world-title", DayZoom.coordinateLine(view));
      title.id = "day-world-title";
      const civil = el("p", "day-world-civil", DayZoom.formatCivilDate(view.civilDate));
      const back = el("button", "day-world-back", "Back to the year");
      back.type = "button";
      back.addEventListener("click", closeRoom);
      header.append(kicker, title, civil, el("p", "day-world-explain", model.explainers.room), back);
      sheet.append(header);

      if (model.telling) {
        const s = section("The day's telling", model.explainers.telling);
        s.append(el("p", "day-world-headline", model.telling.headline));
        linesInto(s, model.telling.position);
        linesInto(s, model.telling.arc);
        if (model.telling.reading.length) {
          s.append(el("p", "day-world-reading-label", model.telling.readingLabel));
          linesInto(s, model.telling.reading);
        }
        sheet.append(s);
      }

      const skySection = section("The sky", model.explainers.sky);
      skySection.append(el("p", "day-world-line", model.sky));
      sheet.append(skySection);

      const contents = section("What this day holds", model.explainers.contents);
      if (model.contents.empty) {
        contents.append(
          el(
            "p",
            "day-world-line",
            "Nothing is kept for this day yet. The day is still complete — its telling, its sky, and its questions are here. What you plan or keep for it will rest in this room."
          )
        );
      } else {
        const list = el("ul", "day-world-entries");
        model.contents.entries.forEach(entry => {
          const item = el("li", "day-world-entry");
          item.append(el("span", "day-world-entry-title", entry.title));
          const meta = [entry.time, entry.kind].filter(Boolean).join(" · ");
          if (meta) item.append(el("span", "day-world-entry-meta", meta));
          list.append(item);
        });
        contents.append(list);
      }
      sheet.append(contents);

      const sparkSection = section("The Spark in this day", model.explainers.spark);
      if (model.spark) {
        sparkSection.append(
          el(
            "p",
            "day-world-line",
            `${model.spark.name} is here in this day with you${model.spark.kind ? ` — a ${model.spark.kind} Spark` : ""}. Its light tints this room a little, the way it tints every place it rests.`
          )
        );
      } else {
        sparkSection.append(
          el(
            "p",
            "day-world-line",
            "No Spark has been adopted on this device yet, so this room stands quiet. A Spark can be met on the Companions page, and once one is yours, it will meet you here too."
          )
        );
      }
      sheet.append(sparkSection);

      if (model.memory && model.memory.count > 0) {
        const memorySection = section("From last cycle", model.explainers.memory);
        model.memory.records.forEach(record => {
          memorySection.append(el("p", "day-world-line", `${record.title} (${record.kind})`));
        });
        sheet.append(memorySection);
      }

      const farm = section("The ground", model.explainers.farm);
      farm.append(el("p", "day-world-line", "Coming — the planting layer is being gathered from the extension calendars."));
      sheet.append(farm);

      const leave = section("Before you leave", model.explainers.leave);
      const questions = el("ul", "day-world-questions");
      model.closingQuestions.forEach(question => questions.append(el("li", "", question)));
      leave.append(questions);
      const form = el("form", "day-world-note-form");
      const textarea = el("textarea", "day-world-note-text");
      textarea.rows = 3;
      textarea.maxLength = 4000;
      textarea.placeholder = "A note on this day…";
      textarea.setAttribute("aria-label", "A note on this day");
      textarea.value = noteDraft;
      textarea.addEventListener("input", () => {
        noteDraft = textarea.value;
      });
      const save = el("button", "day-world-note-save", "Write it on this day");
      save.type = "submit";
      const status = el("p", "day-world-note-status", noteStatus);
      form.append(textarea, save, status);
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const say = message => {
          noteStatus = message;
          status.textContent = message;
        };
        const text = textarea.value.trim();
        if (!text) {
          say("Write the note first — even one line is enough.");
          return;
        }
        const DayNotes = window.CodexDayNotes;
        if (!DayNotes || typeof DayNotes.buildNoteRecord !== "function") {
          say("The note keeper is not on this page, so the note was not saved.");
          return;
        }
        const repository = await resolveRepository();
        if (!repository) {
          say("The record store was not available, so the note was not saved.");
          return;
        }
        const [y, m, d] = view.civilDate.split("-").map(Number);
        const instant = new Date(y, m - 1, d, 12, 0, 0);
        const conversion = DayNotes.conversionForInstant(instant);
        const record = DayNotes.buildNoteRecord({ text, conversion, instant: new Date() });
        if (!record) {
          say("That note could not be stamped with this day.");
          return;
        }
        const saved = await repository.put(record);
        noteDraft = "";
        say("Note written on this day. It stays on this device, with everything else you keep here.");
        notifyRecordsChanged({ source: "sphere-day-world", recordId: saved.id });
      });
      leave.append(form);
      sheet.append(leave);
    }

    function openRoom() {
      if (!currentView || !currentView.civilDate) return;
      roomOpen = true;
      room.hidden = false;
      document.documentElement.classList.add("day-world-open");
      void renderRoom();
      const back = sheet.querySelector(".day-world-back");
      if (back) back.focus({ preventScroll: true });
    }

    function closeRoom() {
      roomOpen = false;
      room.hidden = true;
      document.documentElement.classList.remove("day-world-open");
      doorButton.focus({ preventScroll: true });
    }

    doorButton.addEventListener("click", openRoom);
    room.addEventListener("click", event => {
      if (event.target === room) closeRoom();
    });
    document.addEventListener("keydown", event => {
      if (roomOpen && event.key === "Escape") closeRoom();
    });

    const controller = DayZoom.createDayZoom({
      onRender(view) {
        if (view && view.civilDate !== (currentView && currentView.civilDate)) {
          noteDraft = "";
          noteStatus = "";
        }
        currentView = view;
        const hasDay = Boolean(view && view.civilDate);
        doorButton.disabled = !hasDay;
        doorLine.textContent = hasDay
          ? `${DayZoom.coordinateLine(view)} — the panel above is the quick look. This door is the step in.`
          : "Pick a day on the Sphere, then step in.";
        if (roomOpen) void renderRoom();
      }
    });
    controller.start();
    if (!reducedMotion) door.classList.add("day-world-door-ready");
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => initDayWorld(), { once: true });
    } else {
      initDayWorld();
    }
  }

  return Object.freeze({
    VERSION,
    CLOSING_QUESTIONS,
    EXPLAINERS,
    lastCycleCivilDate,
    skyLine,
    sparkTint,
    buildRoomModel
  });
});
