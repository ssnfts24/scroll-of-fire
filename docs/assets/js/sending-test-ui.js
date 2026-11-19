/* ========================================================================
   The Sending Test — page wiring.
   - Consumes window.CodexSendingTest (which runs on CodexSealedProtocol)
   - Persistent state via localStorage (namespaced, guarded), this device
     only. Nothing is uploaded anywhere.
   - All features no-op if their controls are not in the DOM.
   ======================================================================== */
(function () {
  "use strict";

  const T = window.CodexSendingTest;
  if (!T) return;

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const nowIso = () => new Date().toISOString();

  /* Storage (guarded) — the teach.js / Life Atlas idiom */
  const NS = "codex:sending-test:";
  const store = (k, v) => {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(NS + k) || "null");
      localStorage.setItem(NS + k, JSON.stringify(v));
    } catch { /* quota/blocked; ignore */ }
    return null;
  };
  const loadSessions = () => {
    const saved = store("sessions");
    return Array.isArray(saved) ? saved : [];
  };
  const saveSessions = sessions => store("sessions", sessions);

  const els = {
    setup: $("#st-setup"),
    setupError: $("#st-setup-error"),
    start: $("#st-start"),
    seal: $("#st-seal"),
    sealShort: $("#st-seal-short"),
    sealFull: $("#st-seal-full"),
    sealSummary: $("#st-seal-summary"),
    begin: $("#st-begin"),
    stage: $("#st-stage"),
    progress: $("#st-progress"),
    sender: $("#st-sender"),
    senderGlyph: $("#st-sender-glyph"),
    senderName: $("#st-sender-name"),
    hide: $("#st-hide"),
    pick: $("#st-pick"),
    pickPrompt: $("#st-pick-prompt"),
    reveal: $("#st-reveal"),
    revealText: $("#st-reveal-text"),
    next: $("#st-next"),
    results: $("#st-results"),
    verdictLines: $("#st-verdict-lines"),
    resultSeed: $("#st-result-seed"),
    resultSequence: $("#st-result-sequence"),
    resultFingerprint: $("#st-result-fingerprint"),
    checkSeal: $("#st-check-seal"),
    sealCheckResult: $("#st-seal-check-result"),
    again: $("#st-again"),
    sessionsList: $("#st-sessions-list"),
    sessionsEmpty: $("#st-sessions-empty"),
    exportBtn: $("#st-export")
  };
  if (!els.setup || !els.stage) return;

  const symbolName = i => T.SYMBOLS[i].name;
  const symbolGlyph = i => T.SYMBOLS[i].glyph;
  const modeName = id => (T.MODES.find(m => m.id === id) || {}).name || id;

  let session = null;
  let hitsSoFar = 0;

  const show = el => { if (el) el.hidden = false; };
  const hide = el => { if (el) el.hidden = true; };

  function selectedMode() {
    const checked = $('input[name="st-mode"]:checked');
    return checked ? checked.value : "receiver";
  }

  function selectedTrials() {
    const checked = $('input[name="st-trials"]:checked');
    return checked ? parseInt(checked.value, 10) : 20;
  }

  function shortFingerprint(hex) {
    return `${hex.slice(0, 8)}…${hex.slice(-8)}`;
  }

  /* ------------------------------------------------------------ session */

  async function startSession() {
    els.setupError.textContent = "";
    try {
      session = T.createSession({
        mode: selectedMode(),
        trials: selectedTrials(),
        startedAt: nowIso()
      });
      hitsSoFar = 0;
      await T.sealSession(session);
    } catch (err) {
      els.setupError.textContent = `The session could not be sealed: ${err.message}`;
      session = null;
      return;
    }
    els.sealShort.textContent = shortFingerprint(session.commitment);
    els.sealFull.textContent = session.commitment;
    els.sealSummary.textContent =
      `${modeName(session.mode)} · ${session.trials} trials · ` +
      `the target list is drawn and sealed. It cannot change now — and after the ` +
      `session you can check this fingerprint against the revealed list yourself.`;
    hide(els.setup);
    hide(els.results);
    show(els.seal);
    els.begin.focus();
  }

  function beginTrials() {
    hide(els.seal);
    show(els.stage);
    renderTrial();
  }

  function renderTrial() {
    const trial = T.currentTrial(session);
    els.progress.textContent =
      `Trial ${trial} of ${session.trials} · Hits so far: ${hitsSoFar}`;
    hide(els.reveal);
    if (session.mode === "receiver") {
      const target = T.currentTarget(session);
      els.senderGlyph.textContent = symbolGlyph(target);
      els.senderName.textContent = `the ${symbolName(target)}`;
      show(els.sender);
      hide(els.pick);
      els.hide.focus();
    } else {
      hide(els.sender);
      showPick("Pick the one that feels right. The target was already drawn and sealed before you started — you are guessing what the sealed list holds.");
    }
  }

  function showPick(prompt) {
    els.pickPrompt.textContent = prompt;
    show(els.pick);
    const first = $(".st-symbol-btn", els.pick);
    if (first) first.focus();
  }

  function onHideAndPass() {
    hide(els.sender);
    showPick("Receiver: without looking back, pick the symbol the sender was holding in mind.");
  }

  function onPick(event) {
    const btn = event.currentTarget;
    const guess = parseInt(btn.dataset.index, 10);
    let result;
    try {
      result = T.recordGuess(session, guess);
    } catch {
      return;
    }
    if (result.hit) hitsSoFar += 1;
    hide(els.sender);
    hide(els.pick);
    const targetName = symbolName(result.target);
    els.revealText.textContent = result.hit
      ? `The target was the ${targetName}. You picked the ${symbolName(result.guess)} — a hit.`
      : `The target was the ${targetName}. You picked the ${symbolName(result.guess)} — a miss.`;
    els.next.textContent = result.done ? "See the result" : "Next trial";
    show(els.reveal);
    els.next.focus();
  }

  function onNext() {
    if (T.isFinished(session)) {
      finishSession();
    } else {
      renderTrial();
    }
  }

  async function finishSession() {
    hide(els.stage);
    const record = T.finishSession(session, nowIso());
    const sessions = loadSessions();
    sessions.push(record);
    saveSessions(sessions);

    const score = T.scoreSession(record.hits, record.trials);
    els.verdictLines.innerHTML = "";
    for (const line of score.lines) {
      const li = document.createElement("li");
      li.textContent = line;
      els.verdictLines.appendChild(li);
    }
    els.resultSeed.textContent = String(record.seed);
    els.resultSequence.textContent = record.sequence.map(symbolGlyph).join(" ");
    els.resultFingerprint.textContent = record.commitment;
    els.sealCheckResult.textContent = "";
    show(els.results);
    renderSessions();
    await checkResultSeal(record);
    els.again.focus();
  }

  async function checkResultSeal(record) {
    if (!record) return;
    try {
      const ok = await T.verifyCommitment(record);
      els.sealCheckResult.textContent = ok
        ? "✓ The seal checks out: the revealed list matches the fingerprint shown before the first guess."
        : "✗ The seal does not match. This record should not be trusted.";
    } catch (err) {
      els.sealCheckResult.textContent = `The seal could not be checked here: ${err.message}`;
    }
  }

  /* ------------------------------------------------------------ history */

  async function renderSessions() {
    const sessions = loadSessions();
    els.sessionsList.innerHTML = "";
    if (els.sessionsEmpty) els.sessionsEmpty.hidden = sessions.length > 0;
    const newestFirst = sessions
      .map((record, index) => ({ record, index }))
      .reverse();
    for (const { record, index } of newestFirst) {
      const li = document.createElement("li");
      li.className = "st-session-row";

      const when = record.finishedAt
        ? new Date(record.finishedAt).toLocaleString()
        : "date not recorded";
      const score = T.scoreSession(record.hits, record.trials);
      const bandText = score.band === "outside"
        ? "outside what luck usually explains"
        : "inside what luck explains";

      const main = document.createElement("span");
      main.className = "st-session-main";
      main.textContent =
        `${when} · ${modeName(record.mode)} · ${record.hits} hits in ${record.trials} tries · ${bandText} · `;

      const seal = document.createElement("span");
      seal.className = "st-session-seal";
      seal.textContent = "seal: checking…";
      main.appendChild(seal);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "st-delete";
      del.textContent = "Delete";
      del.addEventListener("click", () => {
        const all = loadSessions();
        all.splice(index, 1);
        saveSessions(all);
        renderSessions();
      });

      li.append(main, del);
      els.sessionsList.appendChild(li);

      T.verifyCommitment(record)
        .then(ok => { seal.textContent = ok ? "seal: ✓ holds" : "seal: ✗ broken"; })
        .catch(() => { seal.textContent = "seal: could not be checked"; });
    }
  }

  function exportSessions() {
    const sessions = loadSessions();
    const backup = T.buildBackup(sessions, { exportedAt: nowIso() });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sending-test-backup-${nowIso().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ------------------------------------------------------------ wiring */

  els.start.addEventListener("click", startSession);
  els.begin.addEventListener("click", beginTrials);
  els.hide.addEventListener("click", onHideAndPass);
  $$(".st-symbol-btn").forEach(btn => btn.addEventListener("click", onPick));
  els.next.addEventListener("click", onNext);
  els.checkSeal.addEventListener("click", () => {
    const sessions = loadSessions();
    checkResultSeal(sessions[sessions.length - 1]);
  });
  els.again.addEventListener("click", () => {
    session = null;
    hide(els.results);
    show(els.setup);
    els.start.focus();
  });
  if (els.exportBtn) els.exportBtn.addEventListener("click", exportSessions);

  renderSessions();
})();
