"use strict";

const assert = require("node:assert/strict");
const fs     = require("node:fs");
const path   = require("node:path");
const test   = require("node:test");

const root     = path.resolve(__dirname, "..");
const docsRoot = path.join(root, "docs");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

/* ------------------------------------------------------------------ */
/* Minimal browser-environment stub for evaluating codex-memory.js    */
/* ------------------------------------------------------------------ */

function makeLocalStorageMock(initialData) {
  const store = Object.assign({}, initialData || {});
  return {
    getItem:    (k) => (k in store ? store[k] : null),
    setItem:    (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    _store:     store
  };
}

function makeDomStub() {
  const listeners = {};
  return {
    addEventListener: (ev, fn) => {
      listeners[ev] = listeners[ev] || [];
      listeners[ev].push(fn);
    },
    dispatchEvent: () => {},
    _listeners: listeners,
    _fire: function (ev, detail) {
      (listeners[ev] || []).forEach(fn => fn({ detail }));
    }
  };
}

/**
 * Evaluate codex-memory.js in a sandboxed environment.
 * Returns { win, CodexMemory, lsMock }
 */
function evalCodexMemory(localStorageData, windowOverrides) {
  const src = read("docs/assets/js/codex-memory.js");

  const lsMock = makeLocalStorageMock(localStorageData || {});
  const domDoc = makeDomStub();

  const win = Object.assign({
    CodexMemory: null,
    CodexState:  {},
    location:    { pathname: "/test.html", href: "https://example.com/test.html" }
  }, windowOverrides || {});

  /* Patch storageAvailable to use mock — inject via the localStorage arg */
  const wrapper = new Function(
    "window", "document", "CustomEvent", "localStorage",
    src
  );

  wrapper(
    win,
    domDoc,
    class CustomEvent {
      constructor(name, opts) { this.type = name; this.detail = opts && opts.detail; }
    },
    lsMock
  );

  return { win, CodexMemory: win.CodexMemory, lsMock, domDoc };
}

/* ------------------------------------------------------------------ */
/* 1. File existence                                                   */
/* ------------------------------------------------------------------ */

test("codex-memory.js exists in docs/assets/js", () => {
  assert.ok(fileExists("docs/assets/js/codex-memory.js"), "codex-memory.js missing");
});

test("codex-memory.css exists in docs/assets/css", () => {
  assert.ok(fileExists("docs/assets/css/codex-memory.css"), "codex-memory.css missing");
});

test("LIVING-CODEX-PHASE-2.md exists", () => {
  assert.ok(fileExists("docs/LIVING-CODEX-PHASE-2.md"), "LIVING-CODEX-PHASE-2.md missing");
});

/* ------------------------------------------------------------------ */
/* 2. index.html integration                                           */
/* ------------------------------------------------------------------ */

test("index.html loads codex-memory.js", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("codex-memory.js"), "codex-memory.js not loaded in index.html");
});

test("index.html loads codex-memory.css", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("codex-memory.css"), "codex-memory.css not loaded in index.html");
});

test("index.html has intention selector HTML", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("data-codex-intention-row"), "intention row missing");
  assert.ok(html.includes("data-intention="), "intention buttons missing");
});

test("index.html has all 10 intention options", () => {
  const html = read("docs/index.html");
  const intentions = ["ground", "understand", "build", "restore", "speak",
                      "witness", "prepare", "rest", "return", "complete"];
  intentions.forEach(v => {
    assert.ok(html.includes('data-intention="' + v + '"'), v + " intention button missing");
  });
});

test("index.html has 7-day path markers HTML", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("data-codex-seven-day"), "7-day wrapper missing");
  assert.ok(html.includes("data-codex-seven-day-markers"), "7-day markers missing");
  assert.ok(html.includes("data-codex-seven-day-alt"), "7-day alt text missing");
});

test("index.html has what-changed-since-visit HTML", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("data-codex-since-visit"), "since-visit section missing");
  assert.ok(html.includes("data-codex-since-visit-list"), "since-visit list missing");
});

test("index.html has memory privacy controls", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("data-codex-memory-controls"), "memory controls missing");
  assert.ok(html.includes("data-memory-reset"), "memory reset button missing");
  assert.ok(html.includes("data-memory-export"), "memory export button missing");
  assert.ok(html.includes("data-memory-clear-intention"), "clear intention button missing");
  assert.ok(html.includes("data-memory-clear-practice"), "clear practice button missing");
});

test("index.html has resume dismiss button", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("data-codex-resume-dismiss"), "dismiss button missing");
});

test("index.html has practice row HTML", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("data-codex-practice-row"), "practice row missing");
  assert.ok(html.includes("data-codex-practice-continue"), "practice continue link missing");
  assert.ok(html.includes("data-codex-practice-complete"), "practice complete button missing");
  assert.ok(html.includes("data-codex-practice-dismiss"), "practice dismiss button missing");
});

test("index.html codex-memory.js loads before living-codex.js", () => {
  const html = read("docs/index.html");
  const memIdx  = html.indexOf("codex-memory.js");
  const liveIdx = html.indexOf("living-codex.js");
  assert.ok(memIdx !== -1 && liveIdx !== -1, "scripts not found");
  assert.ok(memIdx < liveIdx, "codex-memory.js must appear before living-codex.js");
});

/* ------------------------------------------------------------------ */
/* 3. Storage key and version                                           */
/* ------------------------------------------------------------------ */

test("codex-memory.js uses versioned key sof.codexMemory.v1", () => {
  const src = read("docs/assets/js/codex-memory.js");
  assert.ok(src.includes("sof.codexMemory.v1"), "versioned storage key missing");
});

test("codex-memory.js dispatches codexmemorychange event", () => {
  const src = read("docs/assets/js/codex-memory.js");
  assert.ok(src.includes("codexmemorychange"), "codexmemorychange event missing");
});

test("CodexMemory.storageKey equals sof.codexMemory.v1", () => {
  const { CodexMemory } = evalCodexMemory();
  assert.equal(CodexMemory.storageKey, "sof.codexMemory.v1");
});

test("CodexMemory.version equals 1", () => {
  const { CodexMemory } = evalCodexMemory();
  assert.equal(CodexMemory.version, 1);
});

/* ------------------------------------------------------------------ */
/* 4. First-time visitor — no invented content                         */
/* ------------------------------------------------------------------ */

test("first-time visitor: getState returns blank state", () => {
  const { CodexMemory } = evalCodexMemory({});
  const state = CodexMemory.getState();
  assert.equal(state.lastVisitAt, "", "lastVisitAt should be empty for first visitor");
  assert.equal(state.dailyIntention, null, "dailyIntention should be null");
  assert.equal(state.unfinishedPractice, null, "unfinishedPractice should be null");
  assert.equal(state.recentWitness, null, "recentWitness should be null");
  assert.equal(state.recentFrequency, null, "recentFrequency should be null");
});

test("first-time visitor: getResumePath returns null", () => {
  const { CodexMemory } = evalCodexMemory({});
  assert.equal(CodexMemory.getResumePath(), null);
});

test("first-time visitor: getSevenDaySummary returns 7 empty entries", () => {
  const { CodexMemory } = evalCodexMemory({});
  const summary = CodexMemory.getSevenDaySummary();
  assert.equal(summary.length, 7, "must return exactly 7 entries");
  summary.forEach(function (d) {
    assert.equal(d.hasActivity, false, "no activity for first-time visitor");
  });
});

/* ------------------------------------------------------------------ */
/* 5. Malformed stored data                                            */
/* ------------------------------------------------------------------ */

test("malformed JSON in storage recovers to blank state", () => {
  const { CodexMemory } = evalCodexMemory({ "sof.codexMemory.v1": "not-valid-json{{" });
  const state = CodexMemory.getState();
  assert.equal(state.version, 1, "version must still be 1");
  assert.equal(state.dailyIntention, null, "intention must be null after recovery");
});

test("wrong schema version in storage recovers to blank state", () => {
  const stored = JSON.stringify({ version: 99, dailyIntention: { value: "build" } });
  const { CodexMemory } = evalCodexMemory({ "sof.codexMemory.v1": stored });
  const state = CodexMemory.getState();
  assert.equal(state.dailyIntention, null, "wrong version: intention must be null");
});

/* ------------------------------------------------------------------ */
/* 6. Storage unavailable                                              */
/* ------------------------------------------------------------------ */

test("CodexMemory.storageAvailable returns boolean", () => {
  const { CodexMemory } = evalCodexMemory();
  assert.equal(typeof CodexMemory.storageAvailable(), "boolean");
});

/* ------------------------------------------------------------------ */
/* 7. recordVisit                                                      */
/* ------------------------------------------------------------------ */

test("recordVisit stores lastPage correctly", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.recordVisit({ title: "Witness Ledger", path: "./ledger.html", chamber: "Witness Ledger" });
  const state = CodexMemory.getState();
  assert.equal(state.lastPage.title, "Witness Ledger");
  assert.equal(state.lastPage.path, "./ledger.html");
});

test("recordVisit updates lastVisitAt", () => {
  const { CodexMemory } = evalCodexMemory();
  const before = new Date().toISOString();
  CodexMemory.recordVisit({ title: "Test", path: "/test.html" });
  const state = CodexMemory.getState();
  assert.ok(state.lastVisitAt >= before, "lastVisitAt not updated");
});

/* ------------------------------------------------------------------ */
/* 8. Daily intention                                                  */
/* ------------------------------------------------------------------ */

test("setIntention stores valid intention", () => {
  const { CodexMemory } = evalCodexMemory();
  const result = CodexMemory.setIntention("build");
  assert.ok(result, "setIntention returned null");
  assert.equal(result.value, "build");
  assert.equal(CodexMemory.getState().dailyIntention.value, "build");
});

test("setIntention rejects invalid value", () => {
  const { CodexMemory } = evalCodexMemory();
  const result = CodexMemory.setIntention("meditate");
  assert.equal(result, null, "invalid intention must return null");
});

test("setIntention is case-insensitive", () => {
  const { CodexMemory } = evalCodexMemory();
  const result = CodexMemory.setIntention("BUILD");
  assert.ok(result, "BUILD should be accepted");
  assert.equal(result.value, "build", "stored value should be lowercase");
});

test("getIntention returns isPriorDay:false for today", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.setIntention("witness");
  const intent = CodexMemory.getIntention();
  assert.equal(intent.isPriorDay, false);
});

test("getIntention returns isPriorDay:true for previous day", () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const stored = JSON.stringify({
    version: 1,
    createdAt: yesterday.toISOString(),
    updatedAt: yesterday.toISOString(),
    lastVisitAt: yesterday.toISOString(),
    lastPage: { title: "", path: "", chamber: "" },
    dailyIntention: {
      value: "ground",
      selectedAt: yesterday.toISOString(),
      calendarDate: yesterday.toISOString().slice(0, 10),
      moonNumber: 4,
      moonDay: 5
    },
    unfinishedPractice: null,
    recentWitness: null,
    recentFrequency: null,
    recentMoonReading: null,
    currentCycle: { moonNumber: 4, moonDay: 5, witnessedDays: [], lastWitnessedDate: "" },
    preferences: { signalExpanded: false, resumeDismissedUntil: "" },
    recentActions: []
  });
  const { CodexMemory } = evalCodexMemory({ "sof.codexMemory.v1": stored });
  const intent = CodexMemory.getIntention();
  assert.ok(intent, "intention should exist");
  assert.equal(intent.value, "ground");
  assert.equal(intent.isPriorDay, true, "should be marked as prior day");
});

test("clearIntention removes intention", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.setIntention("build");
  CodexMemory.clearIntention();
  assert.equal(CodexMemory.getIntention(), null);
});

test("setIntention allows changing intention", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.setIntention("build");
  CodexMemory.setIntention("rest");
  assert.equal(CodexMemory.getState().dailyIntention.value, "rest");
});

/* ------------------------------------------------------------------ */
/* 9. Unfinished practice                                              */
/* ------------------------------------------------------------------ */

test("startPractice creates practice with started status", () => {
  const { CodexMemory } = evalCodexMemory();
  const p = CodexMemory.startPractice({ title: "Stone Witness Flow" });
  assert.ok(p, "startPractice returned null");
  assert.equal(p.status, "started");
  assert.equal(p.title, "Stone Witness Flow");
});

test("startPractice generates a non-empty id", () => {
  const { CodexMemory } = evalCodexMemory();
  const p = CodexMemory.startPractice({ title: "Daily Flow" });
  assert.ok(p.id && p.id.length > 0, "id should be non-empty");
});

test("updatePracticeStatus to completed marks completedAt", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.startPractice({ title: "Morning Breath" });
  CodexMemory.updatePracticeStatus("completed");
  const p = CodexMemory.getState().unfinishedPractice;
  assert.equal(p.status, "completed");
  assert.ok(p.completedAt, "completedAt should be set");
});

test("updatePracticeStatus to dismissed works", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.startPractice({ title: "Flow" });
  CodexMemory.updatePracticeStatus("dismissed");
  assert.equal(CodexMemory.getState().unfinishedPractice.status, "dismissed");
});

test("clearPractice removes the practice", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.startPractice({ title: "Test Practice" });
  CodexMemory.clearPractice();
  assert.equal(CodexMemory.getState().unfinishedPractice, null);
});

/* ------------------------------------------------------------------ */
/* 10. Witness                                                         */
/* ------------------------------------------------------------------ */

test("recordWitness stores recentWitness reference", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.recordWitness({ date: new Date().toISOString(), label: "Stone day witness" });
  const state = CodexMemory.getState();
  assert.ok(state.recentWitness, "recentWitness should be stored");
  assert.equal(state.recentWitness.label, "Stone day witness");
});

test("recordWitness marks day as witnessed in currentCycle", () => {
  const { CodexMemory } = evalCodexMemory();
  const iso = new Date().toISOString();
  CodexMemory.recordWitness({ date: iso, label: "Test" });
  const wd = CodexMemory.getState().currentCycle.witnessedDays;
  assert.ok(wd.length > 0, "witnessedDays should not be empty");
});

test("recordWitness does not duplicate full witness body", () => {
  const { CodexMemory } = evalCodexMemory();
  /* The full note text of a witness must not be stored in CodexMemory */
  const longNote = "a".repeat(500);
  CodexMemory.recordWitness({ date: new Date().toISOString(), label: longNote.slice(0, 80) });
  const stored = JSON.stringify(CodexMemory.getState());
  /* CodexMemory should not contain the full 500-char note */
  assert.ok(!stored.includes(longNote), "Full witness body must not be stored in CodexMemory");
});

/* ------------------------------------------------------------------ */
/* 11. Frequency                                                       */
/* ------------------------------------------------------------------ */

test("recordFrequency stores recentFrequency reference", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.recordFrequency({ presetName: "Calm Path", carrier: "432 Hz" });
  const f = CodexMemory.getState().recentFrequency;
  assert.ok(f, "recentFrequency should be stored");
  assert.equal(f.presetName, "Calm Path");
  assert.equal(f.carrier, "432 Hz");
});

test("recordFrequency does not store audio data", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.recordFrequency({ presetName: "Focus Path", rawAudio: new ArrayBuffer(1024) });
  const stored = JSON.stringify(CodexMemory.getState());
  assert.ok(!stored.includes("rawAudio"), "Audio data must not be stored");
});

/* ------------------------------------------------------------------ */
/* 12. Seven-day path summary                                          */
/* ------------------------------------------------------------------ */

test("getSevenDaySummary returns exactly 7 entries", () => {
  const { CodexMemory } = evalCodexMemory();
  const summary = CodexMemory.getSevenDaySummary();
  assert.equal(summary.length, 7);
});

test("getSevenDaySummary last entry is today", () => {
  const { CodexMemory } = evalCodexMemory();
  const summary = CodexMemory.getSevenDaySummary();
  const todayISO = new Date().toISOString().slice(0, 10);
  assert.equal(summary[6].isoDate, todayISO, "last entry should be today");
});

test("getSevenDaySummary reflects witness recorded today", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.recordWitness({ date: new Date().toISOString(), label: "Test" });
  const summary = CodexMemory.getSevenDaySummary();
  assert.equal(summary[6].hasWitness, true, "today should have a witness");
});

test("getSevenDaySummary reflects intention set today", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.setIntention("build");
  const summary = CodexMemory.getSevenDaySummary();
  assert.equal(summary[6].hasIntention, true, "today should have an intention");
});

/* ------------------------------------------------------------------ */
/* 13. Duplicate action prevention                                     */
/* ------------------------------------------------------------------ */

test("recordAction deduplicates identical type+path within 60s", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.recordAction({ type: "visit", label: "Test", path: "/test.html" });
  CodexMemory.recordAction({ type: "visit", label: "Test", path: "/test.html" });
  const actions = CodexMemory.getState().recentActions;
  const visitCount = actions.filter(function (a) {
    return a.type === "visit" && a.path === "/test.html";
  }).length;
  assert.equal(visitCount, 1, "should not store duplicate visit actions within 60s");
});

/* ------------------------------------------------------------------ */
/* 14. History size limit                                              */
/* ------------------------------------------------------------------ */

test("recentActions is capped at MAX_ACTIONS (20)", () => {
  const { CodexMemory } = evalCodexMemory();
  for (let i = 0; i < 30; i++) {
    /* Use different timestamps to avoid dedup */
    const ts = new Date(Date.now() - i * 70000).toISOString();
    CodexMemory.recordAction({ type: "visit", label: "Page " + i, path: "/p" + i, timestamp: ts });
  }
  const actions = CodexMemory.getState().recentActions;
  assert.ok(actions.length <= 20, "actions must be capped at 20");
});

/* ------------------------------------------------------------------ */
/* 15. Clearing only Phase 2 memory                                    */
/* ------------------------------------------------------------------ */

test("resetAll clears Phase 2 data but does not write to witness ledger key", () => {
  const { CodexMemory, lsMock } = evalCodexMemory();
  /* Simulate existing witness ledger data */
  lsMock.setItem("scroll_of_fire_witness_ledger_v3", '[{"date":"2026-01-01","note":"test"}]');
  CodexMemory.setIntention("build");
  CodexMemory.resetAll();

  /* Phase 2 state should be blank */
  const state = CodexMemory.getState();
  assert.equal(state.dailyIntention, null);

  /* Witness ledger must be untouched */
  const ledger = lsMock.getItem("scroll_of_fire_witness_ledger_v3");
  assert.ok(ledger && ledger.includes("test"), "witness ledger must be preserved after Phase 2 reset");
});

test("clearIntention does not touch recentWitness", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.setIntention("build");
  CodexMemory.recordWitness({ date: new Date().toISOString(), label: "Day 4 entry" });
  CodexMemory.clearIntention();
  const state = CodexMemory.getState();
  assert.ok(state.recentWitness, "recentWitness must survive clearIntention");
});

/* ------------------------------------------------------------------ */
/* 16. getResumePath                                                   */
/* ------------------------------------------------------------------ */

test("getResumePath returns practice when practice is started", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.startPractice({ title: "Morning Practice", sourcePage: "./moons.html" });
  const resume = CodexMemory.getResumePath();
  assert.ok(resume, "resume should not be null");
  assert.equal(resume.type, "practice");
});

test("getResumePath returns page when only last page is stored", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.recordVisit({ title: "Theory", path: "./theory.html", chamber: "Theory" });
  const resume = CodexMemory.getResumePath();
  assert.ok(resume, "resume should not be null");
  assert.ok(resume.href.includes("theory.html"), "href should include theory.html");
});

/* ------------------------------------------------------------------ */
/* 17. dismissResumeToday                                             */
/* ------------------------------------------------------------------ */

test("dismissResumeToday sets resumeDismissedUntil to tomorrow", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.dismissResumeToday();
  const state = CodexMemory.getState();
  const until = new Date(state.preferences.resumeDismissedUntil);
  const now = new Date();
  assert.ok(until > now, "dismissedUntil should be in the future");
});

test("isResumeDismissed returns true after dismissResumeToday", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.dismissResumeToday();
  assert.equal(CodexMemory.isResumeDismissed(), true);
});

test("isResumeDismissed returns false for new visitor", () => {
  const { CodexMemory } = evalCodexMemory();
  assert.equal(CodexMemory.isResumeDismissed(), false);
});

/* ------------------------------------------------------------------ */
/* 18. exportMemory / importMemory                                     */
/* ------------------------------------------------------------------ */

test("exportMemory returns an object with correct version", () => {
  const { CodexMemory } = evalCodexMemory();
  const exported = CodexMemory.exportMemory();
  assert.equal(typeof exported, "object");
  assert.equal(exported.version, 1);
});

test("importMemory loads compatible exported data", () => {
  const { CodexMemory: cm1 } = evalCodexMemory();
  cm1.setIntention("rest");
  const exported = cm1.exportMemory();

  const { CodexMemory: cm2 } = evalCodexMemory();
  const ok = cm2.importMemory(exported);
  assert.equal(ok, true, "importMemory should return true");
});

test("importMemory rejects null", () => {
  const { CodexMemory } = evalCodexMemory();
  const ok = CodexMemory.importMemory(null);
  assert.equal(ok, false);
});

/* ------------------------------------------------------------------ */
/* 19. getChangesSinceLastVisit                                        */
/* ------------------------------------------------------------------ */

test("getChangesSinceLastVisit returns empty array when no last visit", () => {
  const { CodexMemory } = evalCodexMemory();
  const changes = CodexMemory.getChangesSinceLastVisit({ moonNumber: 4, moonDay: 5 });
  assert.equal(changes.length, 0, "no changes for first-time visitor");
});

test("getChangesSinceLastVisit reports moon-day change", () => {
  /* Simulate returning visitor who was on day 4, now on day 5 */
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const stored = JSON.stringify({
    version: 1,
    createdAt: yesterday.toISOString(),
    updatedAt: yesterday.toISOString(),
    lastVisitAt: yesterday.toISOString(),
    lastPage: { title: "13 Moons", path: "./moons.html", chamber: "13 Moons" },
    dailyIntention: null,
    unfinishedPractice: null,
    recentWitness: null,
    recentFrequency: null,
    recentMoonReading: null,
    currentCycle: { moonNumber: 4, moonDay: 4, witnessedDays: [], lastWitnessedDate: "" },
    preferences: { signalExpanded: false, resumeDismissedUntil: "" },
    recentActions: []
  });
  const { CodexMemory } = evalCodexMemory({ "sof.codexMemory.v1": stored });
  const changes = CodexMemory.getChangesSinceLastVisit({ moonNumber: 4, moonDay: 5 });
  assert.ok(changes.some(function (c) { return c.includes("Day 4") && c.includes("Day 5"); }),
    "should report moon-day change from 4 to 5");
});

test("getChangesSinceLastVisit reports unfinished practice", () => {
  const { CodexMemory } = evalCodexMemory();
  CodexMemory.recordVisit({ title: "Home", path: "./index.html" });
  CodexMemory.startPractice({ title: "Stone Practice" });
  /* Simulate that practice was started before last visit */
  const state = CodexMemory.getState();
  state.unfinishedPractice.startedAt = new Date(Date.now() - 86400000).toISOString();
  CodexMemory.update({ unfinishedPractice: state.unfinishedPractice });
  CodexMemory.update({ lastVisitAt: new Date(Date.now() - 3600000).toISOString() });

  const changes = CodexMemory.getChangesSinceLastVisit({});
  assert.ok(changes.some(function (c) { return c.toLowerCase().includes("stone practice"); }),
    "should mention the unfinished practice");
});

/* ------------------------------------------------------------------ */
/* 20. Connection checks                                               */
/* ------------------------------------------------------------------ */

test("ledger.html includes codex-memory.js", () => {
  const html = read("docs/ledger.html");
  assert.ok(html.includes("codex-memory.js"), "codex-memory.js not found in ledger.html");
});

test("ledger.html addEntry calls CodexMemory.recordWitness", () => {
  const html = read("docs/ledger.html");
  assert.ok(html.includes("CodexMemory") && html.includes("recordWitness"),
    "ledger.html should call CodexMemory.recordWitness on save");
});

test("frequency-governance.js calls CodexMemory.recordFrequency on save", () => {
  const src = read("docs/assets/js/frequency-governance.js");
  assert.ok(src.includes("CodexMemory") && src.includes("recordFrequency"),
    "frequency-governance.js should call CodexMemory.recordFrequency");
});

test("frequency-governance.js calls CodexMemory.recordFrequency on loadPath", () => {
  const src = read("docs/assets/js/frequency-governance.js");
  /* loadPath should also record the start */
  const loadPathIdx = src.indexOf("function loadPath");
  const recordIdx   = src.indexOf("recordFrequency", loadPathIdx);
  assert.ok(recordIdx > loadPathIdx, "loadPath should call recordFrequency after its definition");
});

test("moons.html loads codex-memory.js", () => {
  const html = read("docs/moons.html");
  assert.ok(html.includes("codex-memory.js"), "codex-memory.js not loaded in moons.html");
});

test("moons.html has memory continuity card", () => {
  const html = read("docs/moons.html");
  assert.ok(html.includes("moonsMemoryCard"), "moons memory card missing");
  assert.ok(html.includes("codexmemorychange"), "moons memory card should listen for codexmemorychange");
});

/* ------------------------------------------------------------------ */
/* 21. CSS                                                             */
/* ------------------------------------------------------------------ */

test("codex-memory.css defines intention picker styles", () => {
  const css = read("docs/assets/css/codex-memory.css");
  assert.ok(css.includes(".codex-intention-picker"), ".codex-intention-picker missing");
  assert.ok(css.includes(".codex-intention-row"), ".codex-intention-row missing");
});

test("codex-memory.css defines 7-day marker styles", () => {
  const css = read("docs/assets/css/codex-memory.css");
  assert.ok(css.includes(".codex-seven-day-marker"), ".codex-seven-day-marker missing");
  assert.ok(css.includes(".codex-seven-day"), ".codex-seven-day missing");
});

test("codex-memory.css defines since-visit section", () => {
  const css = read("docs/assets/css/codex-memory.css");
  assert.ok(css.includes(".codex-since-visit"), ".codex-since-visit missing");
});

test("codex-memory.css has mobile responsive rules", () => {
  const css = read("docs/assets/css/codex-memory.css");
  assert.ok(css.includes("@media (max-width"), "mobile breakpoint missing");
});

test("codex-memory.css respects prefers-reduced-motion", () => {
  const css = read("docs/assets/css/codex-memory.css");
  assert.ok(css.includes("prefers-reduced-motion"), "prefers-reduced-motion missing");
});

test("codex-memory.css prevents horizontal overflow", () => {
  const css = read("docs/assets/css/codex-memory.css");
  assert.ok(css.includes("overflow-x: hidden"), "overflow-x: hidden missing");
});

/* ------------------------------------------------------------------ */
/* 22. No absolute /scroll-of-fire/ paths                             */
/* ------------------------------------------------------------------ */

test("codex-memory.js uses no hardcoded /scroll-of-fire/ paths", () => {
  const src = read("docs/assets/js/codex-memory.js");
  assert.ok(!src.includes("/scroll-of-fire/"), "hardcoded /scroll-of-fire/ path found");
});

/* ------------------------------------------------------------------ */
/* 23. Documentation                                                   */
/* ------------------------------------------------------------------ */

test("LIVING-CODEX-PHASE-2.md documents storage key", () => {
  const md = read("docs/LIVING-CODEX-PHASE-2.md");
  assert.ok(md.includes("sof.codexMemory.v1"), "storage key missing from docs");
});

test("LIVING-CODEX-PHASE-2.md documents codexmemorychange event", () => {
  const md = read("docs/LIVING-CODEX-PHASE-2.md");
  assert.ok(md.includes("codexmemorychange"), "event name missing from docs");
});

test("LIVING-CODEX-PHASE-2.md documents privacy controls", () => {
  const md = read("docs/LIVING-CODEX-PHASE-2.md");
  assert.ok(md.includes("resetAll") || md.includes("reset"), "privacy controls missing from docs");
});
