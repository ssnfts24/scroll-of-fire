(() => {
  "use strict";

  const SCHEMA_VERSION = 2;
  const FORMAT = "sof-living-time-observatory";
  const KEYS = Object.freeze({
    records: "sof.observatory.records.v2",
    quests: "sof.question-quests.v1",
    preferences: "sof.observatory.questions.v1",
    draft: "sof.observatory.draft.v1",
  });
  const MAX_RECORDS = 5000;
  const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
  const DEFAULT_CATEGORIES = ["awareness", "direction", "wellbeing", "relationships", "work", "environment", "patterns", "gratitude", "family", "projects"];
  const QUESTIONS = Object.freeze([
    { category: "awareness", text: "What stands out right now before you explain it?", reason: "Separating observation from interpretation preserves a cleaner witness." },
    { category: "direction", text: "What is the smallest honest next step available today?", reason: "A bounded action can reveal more than an abstract intention." },
    { category: "wellbeing", text: "What is your body asking you to notice, reduce, or restore?", reason: "Personal state is useful context, not a verdict." },
    { category: "relationships", text: "Which relationship needs listening, clarity, repair, or gratitude?", reason: "Relationships are recurring conditions in the living field." },
    { category: "work", text: "What concrete piece of work would make the rest easier?", reason: "This question looks for leverage without claiming certainty." },
    { category: "environment", text: "What changed in the sky, weather, plants, animals, water, or place around you?", reason: "Environmental detail creates comparable field evidence." },
    { category: "patterns", text: "What repeated, aligned, or diverged from what you expected?", reason: "Recurrence becomes useful when similarity and difference are both preserved." },
    { category: "gratitude", text: "What support is present that you do not want to overlook?", reason: "Gratitude can widen attention without denying difficulty." },
    { category: "family", text: "What would care look like in one observable action today?", reason: "Observable action keeps care grounded and reviewable." },
    { category: "projects", text: "What moved your most important project forward, even slightly?", reason: "Small progress is easier to compare across time." },
  ]);
  const DEFAULT_PREFERENCES = Object.freeze({
    enabled: true,
    level: "balanced",
    onOpen: true,
    showReason: true,
    quietStart: "21:30",
    quietEnd: "07:30",
    categories: DEFAULT_CATEGORIES,
    lastPromptAt: null,
    snoozedUntil: null,
  });

  let records = [];
  let quests = [];
  let preferences = { ...DEFAULT_PREFERENCES, categories: [...DEFAULT_CATEGORIES] };
  let currentQuestion = null;
  let activeTag = null;
  let draftTimer = 0;
  let initialized = false;

  function cleanText(value, max = 6000) {
    return String(value ?? "")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, max);
  }

  function cleanTags(value) {
    const source = Array.isArray(value) ? value : String(value || "").split(",");
    return [...new Set(source.map(tag => cleanText(tag, 50).toLowerCase()).filter(Boolean))].slice(0, 30);
  }

  function finiteNumber(value, min = -Infinity, max = Infinity) {
    if (value === "" || value == null) return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : null;
  }

  function safeIso(value, fallback = Date.now()) {
    const candidate = new Date(value ?? fallback);
    if (!Number.isNaN(candidate.getTime())) return candidate.toISOString();
    const safeFallback = new Date(fallback);
    return Number.isNaN(safeFallback.getTime()) ? new Date().toISOString() : safeFallback.toISOString();
  }

  function makeId(prefix) {
    try { return `${prefix}-${crypto.randomUUID()}`; }
    catch { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      showToast("This browser could not preserve the update. Export existing records and check storage availability.", true);
      console.warn("[LivingTimeObservatoryWorkspace] Storage write failed.", error);
      return false;
    }
  }

  function collectionFrom(raw, field) {
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw[field])) return raw[field];
    if (raw && Array.isArray(raw.items)) return raw.items;
    return [];
  }

  function normalizeRecord(input) {
    if (!input || typeof input !== "object") return null;
    const createdAt = new Date(input.createdAt || input.timestamp || Date.now());
    if (Number.isNaN(createdAt.getTime())) return null;
    const observation = cleanText(input.observation, 6000);
    if (!observation) return null;
    const context = input.context && typeof input.context === "object" ? input.context : {};
    return {
      schemaVersion: SCHEMA_VERSION,
      id: cleanText(input.id, 140) || makeId("obs"),
      createdAt: createdAt.toISOString(),
      updatedAt: safeIso(input.updatedAt, createdAt),
      intention: cleanText(input.intention, 240),
      observation,
      interpretation: cleanText(input.interpretation, 6000),
      uncertainty: cleanText(input.uncertainty, 3000),
      action: cleanText(input.action, 3000),
      outcome: cleanText(input.outcome, 3000),
      claimType: cleanText(input.claimType || "observed", 40),
      tags: cleanTags(input.tags),
      placeId: cleanText(input.placeId, 180),
      visibility: ["private", "anonymous", "public"].includes(input.visibility) ? input.visibility : "private",
      personalState: {
        energy: finiteNumber(input.personalState?.energy ?? input.energy, 0, 10),
        stress: finiteNumber(input.personalState?.stress ?? input.stress, 0, 10),
        focus: finiteNumber(input.personalState?.focus ?? input.focus, 0, 10),
      },
      environment: {
        temperatureC: finiteNumber(input.environment?.temperatureC ?? input.temperatureC, -100, 80),
        humidityPercent: finiteNumber(input.environment?.humidityPercent ?? input.humidityPercent, 0, 100),
        cloudCoverPercent: finiteNumber(input.environment?.cloudCoverPercent ?? input.cloudCoverPercent, 0, 100),
        windKph: finiteNumber(input.environment?.windKph ?? input.windKph, 0, 600),
        fieldNotes: cleanText(input.environment?.fieldNotes ?? input.fieldNotes, 1500),
        location: input.environment?.location && typeof input.environment.location === "object" ? {
          latitude: finiteNumber(input.environment.location.latitude, -90, 90),
          longitude: finiteNumber(input.environment.location.longitude, -180, 180),
          accuracyMeters: finiteNumber(input.environment.location.accuracyMeters, 0, 100000),
        } : null,
      },
      context: {
        instant: cleanText(context.instant, 60) || createdAt.toISOString(),
        timeZone: cleanText(context.timeZone, 120),
        boundaryMode: cleanText(context.boundaryMode, 40),
        patternYear: finiteNumber(context.patternYear, 1, 9999),
        moon: finiteNumber(context.moon, 1, 13),
        moonDay: finiteNumber(context.moonDay ?? context.day, 1, 28),
        dayOfPatternYear: finiteNumber(context.dayOfPatternYear, 1, 364),
        civilDate: cleanText(context.civilDate, 20),
        lunarPhase: cleanText(context.lunarPhase, 100),
        lunarIllumination: finiteNumber(context.lunarIllumination, 0, 1),
        solarGate: cleanText(context.solarGate, 120),
        season: cleanText(context.season, 80),
        passageActive: !!context.passageActive,
        passageProgress: finiteNumber(context.passageProgress, 0, 1),
        source: cleanText(context.source, 180),
        engineVersion: cleanText(context.engineVersion, 80),
      },
      question: input.question && typeof input.question === "object" ? {
        category: cleanText(input.question.category, 60),
        prompt: cleanText(input.question.prompt, 600),
        questId: cleanText(input.question.questId, 140),
      } : null,
    };
  }

  function normalizeQuest(input) {
    if (!input || typeof input !== "object") return null;
    const question = cleanText(input.question, 600);
    if (!question) return null;
    const schedule = ["daily", "weekly", "monthly", "interval", "moonDay"].includes(input.schedule) ? input.schedule : "daily";
    return {
      id: cleanText(input.id, 140) || makeId("quest"),
      title: cleanText(input.title, 90) || question.slice(0, 70),
      question,
      intention: cleanText(input.intention, 80),
      schedule,
      intervalDays: finiteNumber(input.intervalDays, 1, 365) || 3,
      moonDay: finiteNumber(input.moonDay, 1, 28) || 1,
      priority: finiteNumber(input.priority, 1, 3) || 1,
      paused: !!input.paused,
      createdAt: safeIso(input.createdAt),
      lastAnsweredAt: input.lastAnsweredAt && !Number.isNaN(new Date(input.lastAnsweredAt).getTime()) ? safeIso(input.lastAnsweredAt) : null,
    };
  }

  function snapshot() {
    try { return globalThis.LivingTimeSphereLiveData?.getSnapshot?.() || null; }
    catch { return null; }
  }

  function contextFromSnapshot(current = snapshot()) {
    const now = new Date();
    const pattern = current?.pattern || {};
    const lunar = current?.lunar || {};
    const solar = current?.solar || {};
    const passage = current?.passage || {};
    return {
      instant: current?.instant || now.toISOString(),
      timeZone: current?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Local",
      boundaryMode: current?.boundaryMode || "sunset",
      patternYear: pattern.patternYear ?? current?.year ?? now.getFullYear(),
      moon: pattern.moon ?? null,
      moonDay: pattern.day ?? null,
      dayOfPatternYear: pattern.dayOfPatternYear ?? null,
      civilDate: pattern.civilDate || now.toISOString().slice(0, 10),
      lunarPhase: lunar.phaseName || "",
      lunarIllumination: lunar.illumination ?? null,
      solarGate: solar.gate || "",
      season: solar.season?.label || solar.season || "",
      passageActive: !!passage.active,
      passageProgress: passage.progress ?? null,
      source: current?.yearModel?.sourceRecord?.provenance?.source || current?.source || "Canonical local engines",
      engineVersion: globalThis.LivingTimeSphereVersion?.version || globalThis.SOF_13_MOONS?.APP_VERSION || "local",
    };
  }

  function formRecord(form, overrides = {}) {
    const data = new FormData(form);
    let location = null;
    try { location = JSON.parse(String(data.get("locationJson") || "null")); }
    catch { location = null; }
    return normalizeRecord({
      id: makeId("obs"),
      createdAt: new Date().toISOString(),
      intention: data.get("intention"),
      observation: data.get("observation"),
      interpretation: data.get("interpretation"),
      uncertainty: data.get("uncertainty"),
      action: data.get("action"),
      outcome: data.get("outcome"),
      claimType: data.get("claimType"),
      tags: data.get("tags"),
      placeId: data.get("placeId"),
      visibility: data.get("visibility"),
      personalState: { energy: data.get("energy"), stress: data.get("stress"), focus: data.get("focus") },
      environment: {
        temperatureC: data.get("temperatureC"),
        humidityPercent: data.get("humidityPercent"),
        cloudCoverPercent: data.get("cloudCoverPercent"),
        windKph: data.get("windKph"),
        fieldNotes: data.get("fieldNotes"),
        location,
      },
      context: contextFromSnapshot(),
      ...overrides,
    });
  }

  function saveRecords() {
    return writeJson(KEYS.records, { schemaVersion: SCHEMA_VERSION, records });
  }

  function saveQuests() {
    return writeJson(KEYS.quests, quests);
  }

  function addRecord(record) {
    const normalized = normalizeRecord(record);
    if (!normalized) return null;
    records = [normalized, ...records.filter(item => item.id !== normalized.id)].slice(0, MAX_RECORDS);
    if (!saveRecords()) return null;
    renderAll();
    return normalized;
  }

  function byId(id) { return document.getElementById(id); }

  function setText(id, value) {
    const node = byId(id);
    if (node) node.textContent = value == null || value === "" ? "—" : String(value);
  }

  function showToast(message, error = false) {
    if (typeof document === "undefined" || !document.body) return;
    let toast = document.querySelector(".obs-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "obs-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.classList.toggle("is-error", !!error);
    toast.textContent = cleanText(message, 500);
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.hidden = true; }, 5000);
  }

  function emptyState(text) {
    const node = document.createElement("p");
    node.className = "obs-empty-state";
    node.textContent = text;
    return node;
  }

  function button(label, action, className = "obs-luxury-btn") {
    const node = document.createElement("button");
    node.type = "button";
    node.className = className;
    node.textContent = label;
    node.dataset.action = action;
    return node;
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }

  function renderCurrentState() {
    const current = snapshot();
    const context = contextFromSnapshot(current);
    setText("obs-current-pattern", context.moon ? `Moon ${context.moon} · Day ${context.moonDay}` : "Outside count");
    setText("obs-current-day", context.dayOfPatternYear ? `${context.dayOfPatternYear}/364` : "—");
    setText("obs-current-lunar", context.lunarPhase || "—");
    setText("obs-current-passage", context.passageActive ? `Active · ${Math.round((context.passageProgress || 0) * 100)}%` : "Inactive");
    setText("obs-current-source", context.source || "Canonical engines");
    setText("obs-current-version", context.engineVersion || "local");
    setText("obs-current-season", context.season || "—");
    const environment = globalThis.SofEnvironmentState?.getEnvironmentState?.() || null;
    const daylight = environment?.daily?.daylightDurationSeconds;
    setText("obs-current-daylight", Number.isFinite(daylight) ? `${Math.floor(daylight / 3600)}h ${Math.round((daylight % 3600) / 60)}m` : "Location not set");
    setText("obs-auto-context", `${context.civilDate || "Today"} · ${context.moon ? `Moon ${context.moon}, Day ${context.moonDay}` : "outside count"} · ${context.lunarPhase || "lunar unavailable"} · ${context.timeZone}`);
  }

  function recordTitle(record) {
    return record.intention || record.question?.prompt || record.observation.slice(0, 72);
  }

  function renderRecords() {
    const list = byId("obs-record-list");
    if (!list) return;
    list.replaceChildren();
    const visible = activeTag ? records.filter(record => record.tags.includes(activeTag)) : records;
    if (!visible.length) {
      list.appendChild(emptyState(activeTag ? `No records carry the “${activeTag}” tag.` : "No local observations yet. Preserve one moment to begin the archive."));
    }
    visible.slice(0, 120).forEach(record => {
      const card = document.createElement("article");
      card.className = "obs-record-card";
      card.dataset.recordId = record.id;
      const header = document.createElement("header");
      const title = document.createElement("h4");
      title.textContent = recordTitle(record);
      const privacy = document.createElement("span");
      privacy.className = "obs-record-meta";
      privacy.textContent = record.visibility === "private" ? "Local only" : record.visibility;
      header.append(title, privacy);
      const meta = document.createElement("p");
      meta.className = "obs-record-meta";
      const c = record.context;
      meta.textContent = `${formatDate(record.createdAt)} · ${c.moon ? `Moon ${c.moon} Day ${c.moonDay}` : "Pattern unavailable"} · ${record.claimType}`;
      const observation = document.createElement("p");
      observation.textContent = record.observation.length > 360 ? `${record.observation.slice(0, 357)}…` : record.observation;
      const tags = document.createElement("p");
      tags.className = "obs-record-meta";
      tags.textContent = record.tags.length ? record.tags.map(tag => `#${tag}`).join("  ") : "No tags";
      const actions = document.createElement("div");
      actions.className = "obs-record-actions";
      actions.append(button("Update outcome", "outcome"), button("Export", "export"), button("Delete", "delete"));
      card.append(header, meta, observation, tags, actions);
      list.appendChild(card);
    });
    setText("obs-record-count", records.length);
    renderTopTags();
  }

  function renderTopTags() {
    const root = byId("obs-top-tags");
    if (!root) return;
    const counts = new Map();
    records.forEach(record => record.tags.forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1)));
    root.replaceChildren();
    if (activeTag) root.appendChild(button("Show all", "clear-tag"));
    [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).forEach(([tag, count]) => {
      const node = button(`#${tag} · ${count}`, "filter-tag");
      node.dataset.tag = tag;
      if (tag === activeTag) node.setAttribute("aria-pressed", "true");
      root.appendChild(node);
    });
  }

  function recordExportPayload(selectedRecords = records) {
    return {
      format: FORMAT,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      source: location.href,
      privacyNotice: "Private records were exported only because the user explicitly requested a local download.",
      records: selectedRecords,
      quests,
      preferences: { ...preferences, lastPromptAt: undefined, snoozedUntil: undefined },
    };
  }

  function downloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  function exportRecords(selected = records) {
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(recordExportPayload(selected), `living-time-observatory-${date}.json`);
    showToast(`${selected.length} record${selected.length === 1 ? "" : "s"} exported.`);
  }

  async function importRecords(file) {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      showToast("Import stopped: the file is larger than 5 MB.", true);
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      const candidates = collectionFrom(parsed, "records");
      if (!candidates.length) throw new Error("No records were found in this JSON file.");
      const normalized = candidates.slice(0, MAX_RECORDS).map(normalizeRecord).filter(Boolean);
      if (!normalized.length) throw new Error("No valid Observatory records were found.");
      const merged = new Map(records.map(record => [record.id, record]));
      normalized.forEach(record => merged.set(record.id, record));
      records = [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, MAX_RECORDS);
      const importedQuests = collectionFrom(parsed, "quests").map(normalizeQuest).filter(Boolean);
      if (importedQuests.length) {
        const questMap = new Map(quests.map(quest => [quest.id, quest]));
        importedQuests.forEach(quest => questMap.set(quest.id, quest));
        quests = [...questMap.values()];
        saveQuests();
      }
      saveRecords();
      renderAll();
      showToast(`${normalized.length} valid record${normalized.length === 1 ? "" : "s"} imported or updated.`);
    } catch (error) {
      showToast(`Import stopped: ${cleanText(error.message || error, 220)}`, true);
    }
  }

  function minutesFromClock(value) {
    const [hours, minutes] = String(value || "").split(":").map(Number);
    return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
  }

  function inQuietHours(date = new Date()) {
    const start = minutesFromClock(preferences.quietStart);
    const end = minutesFromClock(preferences.quietEnd);
    if (start == null || end == null || start === end) return false;
    const now = date.getHours() * 60 + date.getMinutes();
    return start < end ? now >= start && now < end : now >= start || now < end;
  }

  function questionIntervalMs(level) {
    return { light: 20 * 60 * 60 * 1000, balanced: 10 * 60 * 60 * 1000, active: 6 * 60 * 60 * 1000, deep: 3 * 60 * 60 * 1000 }[level] || Infinity;
  }

  function isQuestionDue(now = new Date()) {
    if (!preferences.enabled || preferences.level === "off" || inQuietHours(now)) return false;
    if (preferences.snoozedUntil && new Date(preferences.snoozedUntil) > now) return false;
    if (!preferences.lastPromptAt) return true;
    return now - new Date(preferences.lastPromptAt) >= questionIntervalMs(preferences.level);
  }

  function isQuestDue(quest, current = snapshot(), now = new Date()) {
    if (!quest || quest.paused) return false;
    const last = quest.lastAnsweredAt ? new Date(quest.lastAnsweredAt) : null;
    if (!last || Number.isNaN(last.getTime())) {
      return quest.schedule !== "moonDay" || Number(current?.pattern?.day) === Number(quest.moonDay);
    }
    const elapsedDays = (now - last) / 86400000;
    if (quest.schedule === "daily") return now.toDateString() !== last.toDateString();
    if (quest.schedule === "weekly") return elapsedDays >= 7;
    if (quest.schedule === "monthly") return now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear();
    if (quest.schedule === "interval") return elapsedDays >= Number(quest.intervalDays || 1);
    if (quest.schedule === "moonDay") return Number(current?.pattern?.day) === Number(quest.moonDay) && now.toDateString() !== last.toDateString();
    return false;
  }

  function chooseQuestion() {
    const dueQuest = quests
      .filter(quest => isQuestDue(quest))
      .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt))[0];
    if (dueQuest) {
      return { category: "personal quest", text: dueQuest.question, reason: `Recurring quest: ${dueQuest.title}`, questId: dueQuest.id };
    }
    const allowed = QUESTIONS.filter(question => preferences.categories.includes(question.category));
    const pool = allowed.length ? allowed : QUESTIONS;
    const day = Math.floor(Date.now() / 86400000);
    return pool[(day + records.length) % pool.length];
  }

  function showQuestion(question = chooseQuestion()) {
    const shell = byId("obs-question-shell");
    if (!shell || !question) return;
    currentQuestion = question;
    setText("obs-question-category", question.category);
    setText("obs-question-text", question.text);
    setText("obs-question-reason", preferences.showReason ? question.reason : "");
    const answer = byId("obs-question-answer");
    if (answer) answer.value = "";
    shell.__returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    shell.hidden = false;
    shell.setAttribute("aria-hidden", "false");
    document.body.classList.add("obs-question-modal-open");

    requestAnimationFrame(() => {
      answer?.focus?.({ preventScroll: true });
    });
    preferences.lastPromptAt = new Date().toISOString();
    writeJson(KEYS.preferences, preferences);
  }

  function hideQuestion() {
    const shell = byId("obs-question-shell");

    if (shell) {
      const returnFocus = shell.__returnFocus;

      shell.hidden = true;
      shell.setAttribute("aria-hidden", "true");
      document.body.classList.remove(
        "obs-question-modal-open"
      );

      shell.__returnFocus = null;

      if (
        returnFocus &&
        document.contains(returnFocus)
      ) {
        returnFocus.focus?.({
          preventScroll: true
        });
      }
    }

    currentQuestion = null;
  }

  function preserveQuestionAnswer() {
    const answer = cleanText(byId("obs-question-answer")?.value, 6000);
    if (!answer || !currentQuestion) {
      showToast("Write a response before preserving it.", true);
      return;
    }
    const record = addRecord({
      id: makeId("obs"),
      createdAt: new Date().toISOString(),
      intention: currentQuestion.questId ? "Continue personal quest" : "Respond to Observatory guidance",
      observation: answer,
      interpretation: "",
      uncertainty: "",
      action: "",
      outcome: "",
      claimType: "observed",
      tags: ["question", currentQuestion.category],
      visibility: "private",
      context: contextFromSnapshot(),
      question: { category: currentQuestion.category, prompt: currentQuestion.text, questId: currentQuestion.questId || "" },
    });
    if (!record) return;
    if (currentQuestion.questId) {
      const quest = quests.find(item => item.id === currentQuestion.questId);
      if (quest) quest.lastAnsweredAt = record.createdAt;
      saveQuests();
    }
    hideQuestion();
    renderQuests();
    showToast("Answer preserved in the local Observatory archive.");
  }

  function loadPreferenceControls() {
    const enabled = byId("obs-question-enabled");
    const level = byId("obs-question-level");
    const onOpen = byId("obs-question-on-open");
    const reason = byId("obs-question-show-reason");
    const quietStart = byId("obs-question-quiet-start");
    const quietEnd = byId("obs-question-quiet-end");
    if (enabled) enabled.checked = !!preferences.enabled;
    if (level) level.value = preferences.level;
    if (onOpen) onOpen.checked = !!preferences.onOpen;
    if (reason) reason.checked = !!preferences.showReason;
    if (quietStart) quietStart.value = preferences.quietStart;
    if (quietEnd) quietEnd.value = preferences.quietEnd;
    document.querySelectorAll("[data-question-category]").forEach(input => {
      input.checked = preferences.categories.includes(input.value);
    });
  }

  function savePreferenceControls() {
    const categories = [...document.querySelectorAll("[data-question-category]:checked")].map(input => input.value);
    preferences = {
      ...preferences,
      enabled: !!byId("obs-question-enabled")?.checked,
      level: byId("obs-question-level")?.value || "balanced",
      onOpen: !!byId("obs-question-on-open")?.checked,
      showReason: !!byId("obs-question-show-reason")?.checked,
      quietStart: byId("obs-question-quiet-start")?.value || "21:30",
      quietEnd: byId("obs-question-quiet-end")?.value || "07:30",
      categories: categories.length ? categories : [...DEFAULT_CATEGORIES],
    };
    writeJson(KEYS.preferences, preferences);
    showToast("Question preferences saved locally.");
  }

  function scheduleLabel(quest) {
    if (quest.schedule === "interval") return `Every ${quest.intervalDays} days`;
    if (quest.schedule === "moonDay") return `Moon Day ${quest.moonDay}`;
    return quest.schedule[0].toUpperCase() + quest.schedule.slice(1);
  }

  function renderQuests() {
    const list = byId("obs-quest-list");
    if (!list) return;
    list.replaceChildren();
    if (!quests.length) {
      list.appendChild(emptyState("No personal quests yet. Create one recurring question when a project or practice needs continuity."));
      return;
    }
    quests.slice().sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt)).forEach(quest => {
      const card = document.createElement("article");
      card.className = "obs-quest-card";
      card.dataset.questId = quest.id;
      const header = document.createElement("header");
      const title = document.createElement("h4");
      title.textContent = quest.title;
      const state = document.createElement("span");
      state.className = "obs-record-meta";
      state.textContent = quest.paused ? "Paused" : (isQuestDue(quest) ? "Due now" : scheduleLabel(quest));
      header.append(title, state);
      const prompt = document.createElement("p");
      prompt.textContent = quest.question;
      const meta = document.createElement("p");
      meta.className = "obs-record-meta";
      meta.textContent = `${scheduleLabel(quest)} · Priority ${quest.priority}${quest.lastAnsweredAt ? ` · Last answered ${formatDate(quest.lastAnsweredAt)}` : " · Not answered yet"}`;
      const actions = document.createElement("div");
      actions.className = "obs-record-actions";
      actions.append(button("Answer", "answer-quest"), button(quest.paused ? "Resume" : "Pause", "toggle-quest"), button("Delete", "delete-quest"));
      card.append(header, prompt, meta, actions);
      list.appendChild(card);
    });
  }

  function computeSimilarity(a, b) {
    if (!a || !b) return { score: 0, reasons: [] };
    let score = 0;
    const reasons = [];
    if (a.context?.moon && a.context.moon === b.context?.moon) { score += 0.25; reasons.push(`same Moon ${a.context.moon}`); }
    const dayA = Number(a.context?.dayOfPatternYear);
    const dayB = Number(b.context?.dayOfPatternYear);
    if (Number.isFinite(dayA) && Number.isFinite(dayB)) {
      const circularDistance = Math.min(Math.abs(dayA - dayB), 364 - Math.abs(dayA - dayB));
      const proximity = Math.max(0, 1 - circularDistance / 56);
      score += proximity * 0.25;
      if (proximity >= 0.5) reasons.push(`${circularDistance} Pattern day${circularDistance === 1 ? "" : "s"} apart`);
    }
    const tagsA = new Set(a.tags || []);
    const tagsB = new Set(b.tags || []);
    const union = new Set([...tagsA, ...tagsB]);
    const shared = [...tagsA].filter(tag => tagsB.has(tag));
    if (union.size) {
      score += (shared.length / union.size) * 0.25;
      if (shared.length) reasons.push(`shared tags: ${shared.slice(0, 3).join(", ")}`);
    }
    if (a.context?.season && a.context.season === b.context?.season) { score += 0.15; reasons.push(`same ${a.context.season} season`); }
    if (a.placeId && b.placeId && a.placeId.toLowerCase() === b.placeId.toLowerCase()) { score += 0.1; reasons.push(`same place: ${a.placeId}`); }
    return { score: Math.max(0, Math.min(1, score)), reasons };
  }

  function renderRecurrence() {
    const root = byId("obs-recurrence-results");
    if (!root) return;
    root.replaceChildren();
    if (records.length < 2) {
      root.appendChild(emptyState("Preserve at least two observations to compare recurrence. Similarity will remain descriptive, never causal."));
      return;
    }
    const [anchor, ...candidates] = records;
    const matches = candidates.map(record => ({ record, ...computeSimilarity(anchor, record) })).filter(match => match.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
    if (!matches.length) {
      root.appendChild(emptyState("No meaningful similarities were found for the latest record. Divergence is also useful evidence."));
      return;
    }
    matches.forEach(match => {
      const card = document.createElement("article");
      card.className = "obs-recurrence-card";
      const header = document.createElement("header");
      const title = document.createElement("h4");
      title.textContent = `${Math.round(match.score * 100)}% descriptive similarity`;
      const date = document.createElement("span");
      date.className = "obs-record-meta";
      date.textContent = formatDate(match.record.createdAt);
      header.append(title, date);
      const text = document.createElement("p");
      text.textContent = match.record.observation.slice(0, 280);
      const reasons = document.createElement("p");
      reasons.className = "obs-similarity-reasons";
      reasons.textContent = match.reasons.length ? match.reasons.join(" · ") : "weak proximity only";
      card.append(header, text, reasons);
      root.appendChild(card);
    });
  }

  function svgNode(name, attributes = {}) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function seasonColor(record) {
    const season = String(record.context?.season || "").toLowerCase();
    if (season.includes("spring")) return "#9ff7c8";
    if (season.includes("summer")) return "#f3c97a";
    if (season.includes("autumn") || season.includes("fall")) return "#ff9f70";
    if (season.includes("winter")) return "#9fc8ff";
    return "#c4a3ff";
  }

  function resolveCenturyMapLayout(containerWidth, spanYears) {
    const width = Math.max(300, Math.min(1100, Math.round(Number(containerWidth) || 720)));
    const span = Math.max(50, Math.min(500, Number(spanYears) || 200));
    const compact = width < 560;
    const height = compact ? 300 : 360;
    const pad = compact
      ? Object.freeze({ left: 42, right: 12, top: 22, bottom: 34 })
      : Object.freeze({ left: 54, right: 22, top: 26, bottom: 36 });
    const desiredStep = Math.ceil(span / (compact ? 5 : 10));
    const tickStep = [5, 10, 20, 25, 50, 100, 200].find(step => step >= desiredStep) || 250;
    return Object.freeze({ width, height, pad, tickStep, compact });
  }

  function renderCenturyMap() {
    const root = byId("obs-century-map");
    if (!root) return;
    root.replaceChildren();
    const endInput = byId("obs-century-end");
    const spanInput = byId("obs-century-span");
    const currentYear = new Date().getFullYear();
    const endYear = Math.max(1600, Math.min(2600, Number(endInput?.value) || currentYear + 1));
    const span = Math.max(50, Math.min(500, Number(spanInput?.value) || 200));
    const startYear = endYear - span;
    if (endInput) endInput.value = endYear;
    setText("obs-century-title", `${span}-Year Living Time Field`);
    const measuredWidth = root.getBoundingClientRect?.().width || root.clientWidth || 720;
    const { width, height, pad, tickStep } = resolveCenturyMapLayout(measuredWidth, span);
    renderedCenturyMapWidth = width;
    const svg = svgNode("svg", {
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: "img",
      "aria-label": `Living Time record map from ${startYear} to ${endYear}`,
    });
    const title = svgNode("title");
    title.textContent = `Living Time field, ${startYear}–${endYear}. Horizontal position is year; vertical position is Pattern day.`;
    svg.appendChild(title);
    const x = year => pad.left + ((year - startYear) / span) * (width - pad.left - pad.right);
    const y = day => pad.top + ((Math.max(1, Math.min(364, Number(day) || 182)) - 1) / 363) * (height - pad.top - pad.bottom);
    const firstTick = Math.ceil(startYear / tickStep) * tickStep;
    for (let year = firstTick; year <= endYear; year += tickStep) {
      svg.appendChild(svgNode("line", { x1: x(year), y1: pad.top, x2: x(year), y2: height - pad.bottom, class: "obs-map-grid" }));
      const label = svgNode("text", { x: x(year), y: height - 14, "text-anchor": "middle", class: "obs-map-axis-label" });
      label.textContent = year;
      svg.appendChild(label);
    }
    [1, 91, 182, 273, 364].forEach(day => {
      svg.appendChild(svgNode("line", { x1: pad.left, y1: y(day), x2: width - pad.right, y2: y(day), class: "obs-map-grid" }));
      const label = svgNode("text", { x: pad.left - 8, y: y(day) + 4, "text-anchor": "end", class: "obs-map-axis-label" });
      label.textContent = `D${day}`;
      svg.appendChild(label);
    });
    const points = records.filter(record => {
      const year = new Date(record.createdAt).getFullYear();
      return year >= startYear && year <= endYear;
    }).slice(0, 350).map(record => ({ record, year: new Date(record.createdAt).getFullYear(), day: record.context?.dayOfPatternYear || 182 }));
    if (byId("obs-century-lines")?.checked) {
      for (let index = 0, links = 0; index < points.length && links < 120; index += 1) {
        for (let compare = index + 1; compare < points.length && links < 120; compare += 1) {
          const similarity = computeSimilarity(points[index].record, points[compare].record);
          if (similarity.score < 0.45) continue;
          svg.appendChild(svgNode("line", { x1: x(points[index].year), y1: y(points[index].day), x2: x(points[compare].year), y2: y(points[compare].day), class: "obs-map-link" }));
          links += 1;
        }
      }
    }
    points.forEach(point => {
      const circle = svgNode("circle", { cx: x(point.year), cy: y(point.day), r: 5.5, fill: seasonColor(point.record), class: "obs-map-node", tabindex: "0" });
      const detail = svgNode("title");
      detail.textContent = `${formatDate(point.record.createdAt)} · Day ${point.day}/364 · ${point.record.observation.slice(0, 140)}`;
      circle.appendChild(detail);
      svg.appendChild(circle);
    });
    const current = contextFromSnapshot();
    if (currentYear >= startYear && currentYear <= endYear) {
      const marker = svgNode("circle", { cx: x(currentYear), cy: y(current.dayOfPatternYear || 182), r: 8, fill: "none", stroke: "#ffd700", "stroke-width": "2" });
      const detail = svgNode("title");
      detail.textContent = `Current position · ${currentYear} · Pattern Day ${current.dayOfPatternYear || "unavailable"}`;
      marker.appendChild(detail);
      svg.appendChild(marker);
    }
    root.appendChild(svg);
    if (!points.length) {
      const note = document.createElement("p");
      note.className = "obs-empty-state obs-century-empty";
      note.textContent = "The gold ring marks the current canonical position. Saved observations will appear here as evidence-bearing nodes.";
      root.appendChild(note);
    }
  }

  function renderAll() {
    renderCurrentState();
    renderRecords();
    renderQuests();
    renderRecurrence();
    renderCenturyMap();
  }

  function clearWitnessForm(form) {
    form.reset();
    const location = byId("obs-location-json");
    if (location) location.value = "";
    localStorage.removeItem(KEYS.draft);
    setText("obs-draft-state", "Saved locally");
  }

  function preserveForm(form) {
    if (!form.reportValidity()) return;
    const record = formRecord(form);
    if (!record || !addRecord(record)) {
      showToast("An observation is required before this moment can be preserved.", true);
      return;
    }
    clearWitnessForm(form);
    showToast("Witness preserved locally with its current Living Time context.");
  }

  function saveDraft(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    if (!Object.values(data).some(value => cleanText(value, 20))) {
      localStorage.removeItem(KEYS.draft);
      setText("obs-draft-state", "");
      return;
    }
    if (writeJson(KEYS.draft, { savedAt: new Date().toISOString(), data })) setText("obs-draft-state", "Draft saved locally");
  }

  function restoreDraft(form) {
    const draft = readJson(KEYS.draft, null);
    if (!draft?.data || typeof draft.data !== "object") return;
    Object.entries(draft.data).forEach(([name, value]) => {
      const field = form.elements.namedItem(name);
      if (field && typeof value === "string") field.value = value;
    });
    setText("obs-draft-state", `Draft restored · ${formatDate(draft.savedAt)}`);
  }

  function wireWitnessForm() {
    const form = byId("observatory-witness-form");
    if (!form) return;
    restoreDraft(form);
    form.addEventListener("submit", event => { event.preventDefault(); preserveForm(form); });
    form.addEventListener("input", () => {
      clearTimeout(draftTimer);
      draftTimer = setTimeout(() => saveDraft(form), 500);
    });
    byId("obs-quick-save")?.addEventListener("click", () => preserveForm(form));
    byId("obs-reflection-save")?.addEventListener("click", () => {
      const details = byId("obs-deeper-fields");
      if (details) details.open = true;
      byId("obs-interpretation")?.focus();
      setText("observatory-status", "Deeper reflection fields opened. Nothing is shared automatically.");
    });
    document.querySelectorAll("[data-obs-prompt]").forEach(node => node.addEventListener("click", () => {
      const observation = byId("obs-observation");
      const intention = byId("obs-intention");
      if (observation && !observation.value) observation.value = node.dataset.obsPrompt || "";
      if (intention && !intention.value) intention.value = node.dataset.obsIntention || "";
      observation?.focus();
      form.dispatchEvent(new Event("input", { bubbles: true }));
    }));
    document.querySelectorAll("[data-participation-mode]").forEach(node => node.addEventListener("click", () => {
      const mode = node.dataset.participationMode;
      document.querySelectorAll("[data-participation-mode]").forEach(item => item.setAttribute("aria-pressed", String(item === node)));
      const details = byId("obs-deeper-fields");
      if (details) details.open = mode === "deep";
      document.querySelector(".obs-participation-panel")?.setAttribute("data-participation-depth", mode);
    }));
    byId("obs-capture-location")?.addEventListener("click", () => {
      if (!navigator.geolocation) {
        showToast("Device location is not available in this browser.", true);
        return;
      }
      setText("observatory-status", "Requesting device location…");
      navigator.geolocation.getCurrentPosition(position => {
        const value = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          accuracyMeters: Math.round(position.coords.accuracy || 0),
        };
        const field = byId("obs-location-json");
        if (field) field.value = JSON.stringify(value);
        setText("observatory-status", `Location attached locally · ±${value.accuracyMeters} m`);
        form.dispatchEvent(new Event("input", { bubbles: true }));
      }, error => showToast(`Location was not attached: ${cleanText(error.message, 180)}`, true), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    });
  }

  function wireQuestions() {
    loadPreferenceControls();
    byId("obs-question-ask-now")?.addEventListener("click", () => showQuestion());
    byId("obs-question-close")?.addEventListener("click", hideQuestion);

    document.addEventListener("keydown", event => {
      if (
        event.key === "Escape" &&
        !byId("obs-question-shell")?.hidden
      ) {
        event.preventDefault();
        hideQuestion();
      }
    });
    byId("obs-question-skip")?.addEventListener("click", () => { hideQuestion(); showToast("Question skipped. No answer was stored."); });
    byId("obs-question-snooze")?.addEventListener("click", () => {
      preferences.snoozedUntil = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
      writeJson(KEYS.preferences, preferences);
      hideQuestion();
      showToast("Questions snoozed for four hours.");
    });
    byId("obs-question-answer-save")?.addEventListener("click", preserveQuestionAnswer);
    byId("obs-question-answer")?.addEventListener("keydown", event => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) preserveQuestionAnswer();
    });
    byId("obs-question-save-settings")?.addEventListener("click", savePreferenceControls);
    if (preferences.onOpen && isQuestionDue()) setTimeout(() => showQuestion(), 900);
  }

  function wireQuests() {
    const form = byId("obs-quest-form");
    form?.addEventListener("submit", event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const quest = normalizeQuest({
        id: makeId("quest"),
        title: data.get("title"),
        question: data.get("question"),
        intention: data.get("intention"),
        schedule: data.get("schedule"),
        intervalDays: data.get("intervalDays"),
        moonDay: data.get("moonDay"),
        priority: data.get("priority"),
      });
      if (!quest) return;
      quests.push(quest);
      saveQuests();
      form.reset();
      renderQuests();
      showToast("Recurring quest created locally.");
    });
    byId("obs-quest-list")?.addEventListener("click", event => {
      const action = event.target.closest("button[data-action]")?.dataset.action;
      const card = event.target.closest("[data-quest-id]");
      const quest = quests.find(item => item.id === card?.dataset.questId);
      if (!action || !quest) return;
      if (action === "answer-quest") showQuestion({ category: "personal quest", text: quest.question, reason: `Recurring quest: ${quest.title}`, questId: quest.id });
      if (action === "toggle-quest") { quest.paused = !quest.paused; saveQuests(); renderQuests(); }
      if (action === "delete-quest" && confirm(`Delete the quest “${quest.title}”? Existing answers remain in the archive.`)) {
        quests = quests.filter(item => item.id !== quest.id);
        saveQuests();
        renderQuests();
      }
    });
  }

  function wireArchive() {
    byId("obs-export")?.addEventListener("click", () => exportRecords());
    byId("obs-import")?.addEventListener("click", () => byId("obs-import-file")?.click());
    byId("obs-import-file")?.addEventListener("change", event => {
      importRecords(event.target.files?.[0]);
      event.target.value = "";
    });
    byId("obs-record-list")?.addEventListener("click", event => {
      const target = event.target.closest("button[data-action]");
      const card = event.target.closest("[data-record-id]");
      const record = records.find(item => item.id === card?.dataset.recordId);
      if (!target || !record) return;
      if (target.dataset.action === "export") exportRecords([record]);
      if (target.dataset.action === "outcome") {
        const outcome = prompt("Update the outcome for this witness:", record.outcome || "");
        if (outcome == null) return;
        record.outcome = cleanText(outcome, 3000);
        record.updatedAt = new Date().toISOString();
        saveRecords();
        renderRecords();
        showToast("Outcome updated locally.");
      }
      if (target.dataset.action === "delete" && confirm("Delete this local Observatory record? Export it first if you may need it later.")) {
        records = records.filter(item => item.id !== record.id);
        saveRecords();
        renderAll();
      }
    });
    byId("obs-top-tags")?.addEventListener("click", event => {
      const target = event.target.closest("button[data-action]");
      if (!target) return;
      activeTag = target.dataset.action === "filter-tag" ? target.dataset.tag : null;
      renderRecords();
    });
  }

  let centuryMapResizeObserver = null;
  let centuryMapResizeTimer = 0;
  let renderedCenturyMapWidth = 0;

  function wireMap() {
    ["obs-century-end", "obs-century-span", "obs-century-lines"].forEach(id => {
      byId(id)?.addEventListener("change", renderCenturyMap);
    });
    const map = byId("obs-century-map");
    if (map && typeof ResizeObserver !== "undefined") {
      centuryMapResizeObserver?.disconnect?.();
      centuryMapResizeObserver = new ResizeObserver(entries => {
        const width = Math.round(entries[0]?.contentRect?.width || map.clientWidth || 0);
        if (!width || Math.abs(width - renderedCenturyMapWidth) < 4) return;
        clearTimeout(centuryMapResizeTimer);
        centuryMapResizeTimer = setTimeout(renderCenturyMap, 120);
      });
      centuryMapResizeObserver.observe(map);
    }
  }

  function loadState() {
    records = collectionFrom(readJson(KEYS.records, []), "records").map(normalizeRecord).filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, MAX_RECORDS);
    quests = collectionFrom(readJson(KEYS.quests, []), "quests").map(normalizeQuest).filter(Boolean);
    const storedPreferences = readJson(KEYS.preferences, {});
    const storedCategories = Array.isArray(storedPreferences?.categories)
      ? storedPreferences.categories.filter(category => DEFAULT_CATEGORIES.includes(category))
      : [];
    preferences = {
      ...DEFAULT_PREFERENCES,
      ...(storedPreferences && typeof storedPreferences === "object" ? storedPreferences : {}),
      categories: storedCategories.length ? storedCategories : [...DEFAULT_CATEGORIES],
    };
  }

  function init() {
    if (initialized || !document.getElementById("observatory-console")) return;
    initialized = true;
    loadState();
    const end = byId("obs-century-end");
    if (end && !end.value) end.value = new Date().getFullYear() + 1;
    wireWitnessForm();
    wireQuestions();
    wireQuests();
    wireArchive();
    wireMap();
    renderAll();
    const environmentEvent = globalThis.SofEnvironmentState?.EVENT_NAME || "sof:environment-change";
    window.addEventListener(environmentEvent, renderCurrentState);
    window.setInterval(renderCurrentState, 60000);
  }

  globalThis.LivingTimeObservatoryWorkspace = Object.freeze({
    init,
    getRecords: () => records.map(record => ({ ...record })),
    getQuests: () => quests.map(quest => ({ ...quest })),
    addRecord,
    computeSimilarity,
    isQuestDue,
    exportRecords,
    _internals: Object.freeze({ resolveCenturyMapLayout }),
    schemaVersion: SCHEMA_VERSION,
  });

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
  }
})();
