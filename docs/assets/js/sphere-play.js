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
 *
 * The games are also the first Pattern Quests (rung 1 — see
 * pattern-quests.js): the Spark offers one quest a day — a
 * question answerable only by reading this instrument, a
 * one-tap prediction, the hunt itself, a reveal stated as a
 * count, and an answer card kept in the Life Atlas. A quest
 * never scores; a missed prediction is kept too, because the
 * card records the learning. Catch the turning's minute
 * survives only as an attention frame: a turning not caught
 * is not recorded — only catches are written.
 */
(function () {
  "use strict";

  const VERSION = "sphere-play/1.2.0";
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
      <p class="sphere-play-line">Three small games, played on the real Sphere. Nothing here ever shows a false day. Each one says plainly what it is, how you play, and what it teaches — and the Play button on the Sphere itself starts any of them. The three are also the first Pattern Quests: most days your Spark offers one — a question, a guess, a hunt, and an answer card for your Atlas.</p>
      <div class="sphere-play-quest" data-quest-panel hidden>
        <p class="sphere-play-quest-offer" data-quest-offer role="status"></p>
        <p class="sphere-play-quest-question" data-quest-question></p>
        <div class="sphere-play-quest-predictions" data-quest-predictions role="group" aria-label="Your prediction"></div>
        <p class="sphere-play-quest-line" data-quest-line role="status"></p>
        <div class="sphere-play-quest-actions">
          <button type="button" class="sphere-play-btn" data-quest-take>Take the quest</button>
          <button type="button" class="sphere-play-btn" data-quest-hint hidden>Hint — free</button>
          <button type="button" class="sphere-play-btn" data-quest-defer>Not today</button>
          <button type="button" class="sphere-play-btn" data-quest-dismiss>Don't offer this kind again</button>
        </div>
      </div>
      <div class="sphere-play-games">
        <div class="sphere-play-game" data-play-hunt>
          <h3>Find the day</h3>
          <p class="sphere-play-status" role="status">How to play: the Spark names a day — say, Moon 5 · Day 16. Spin the Sphere, or tap a Moon and then a day number, until the day you are standing on is that day. The Sphere tells you where you are standing as you search.</p>
          <p class="sphere-play-teach">What it teaches: the shape of the year — where every Moon and every day sits in the count of 364.</p>
          <button type="button" class="sphere-play-btn" data-play-hunt-start>Play</button>
        </div>
        <div class="sphere-play-game" data-play-echo>
          <h3>Echo</h3>
          <p class="sphere-play-status" role="status">How to play: press Play and listen. Your Spark sounds a few notes of its own motif, and the numbered pads light as they sound. Tap the same pads back in the same order.</p>
          <p class="sphere-play-teach">What it teaches: listening for pattern — the motif is your Spark's signature, the same notes its seed has always given it.</p>
          <div class="sphere-play-pads" role="group" aria-label="Echo pads"></div>
          <button type="button" class="sphere-play-btn" data-play-echo-start>Play</button>
        </div>
        <div class="sphere-play-game" data-play-turning>
          <h3>Catch the turning</h3>
          <p class="sphere-play-status" role="status">How to play: press Arm now, and stay on this page. The day's light turns four times — at 5 and 10 in the morning, 5 in the evening, 9 at night. When the next turning comes, you have one minute to press “Caught it!”</p>
          <p class="sphere-play-teach">What it teaches: attention — most turnings of the day pass unwitnessed; this one asks you to be there for one. A turning not caught is not recorded — only catches are written.</p>
          <button type="button" class="sphere-play-btn" data-play-turning-arm>Arm</button>
          <button type="button" class="sphere-play-btn sphere-play-catch" data-play-turning-catch hidden>Caught it!</button>
        </div>
      </div>
      <div class="sphere-play-quest-cards" data-quest-cards hidden>
        <h3>Answer cards — your Pattern Quest keepsakes</h3>
        <ul data-quest-card-list></ul>
      </div>
      <p class="sphere-play-record" role="status"></p>`;
    if (talk) talk.after(section); else sidebar.after(section);

    /* ── The games live on the face (Aaron, Nov 20, 2026) ──────
     * The room above keeps the full telling of each game; the
     * playing happens on the instrument. A slim bar at the
     * stage's top edge starts each game (pressing the room's
     * own buttons, so there is exactly one logic path), carries
     * the live status line, and holds the echo pads while an
     * echo round runs. */
    const stageBar = document.createElement("div");
    stageBar.className = "sphere-play-bar";
    stageBar.setAttribute("data-sphere-play-bar", "");
    stageBar.innerHTML = `
      <button type="button" class="sphere-play-bar-toggle" aria-expanded="false" aria-controls="sphere-play-bar-choices">Play</button>
      <div class="sphere-play-bar-doors" id="sphere-play-bar-choices" hidden>
        <button type="button" class="sphere-play-bar-btn" data-play-bar-hunt>Find the day<span class="sphere-play-bar-hint">I name a day — move the Sphere until you stand on it</span></button>
        <button type="button" class="sphere-play-bar-btn" data-play-bar-echo>Echo<span class="sphere-play-bar-hint">Hear your Spark's notes — tap them back in order</span></button>
        <button type="button" class="sphere-play-bar-btn" data-play-bar-arm>Catch the turning<span class="sphere-play-bar-hint">Arm it — catch the light as it turns</span></button>
        <button type="button" class="sphere-play-bar-btn" data-play-bar-catch hidden>Caught it!</button>
      </div>
      <p class="sphere-play-bar-status" role="status" hidden></p>
      <div class="sphere-play-bar-pads" data-play-bar-pads hidden></div>`;
    const stageWrap = $(".sphere-canvas-wrap");
    if (stageWrap) stageWrap.appendChild(stageBar);
    const playToggle = stageBar.querySelector(".sphere-play-bar-toggle");
    const playChoices = stageBar.querySelector(".sphere-play-bar-doors");
    playToggle?.addEventListener("click", () => {
      const expanded = playToggle.getAttribute("aria-expanded") === "true";
      playToggle.setAttribute("aria-expanded", expanded ? "false" : "true");
      playChoices.hidden = expanded;
    });
    playChoices?.addEventListener("click", event => {
      if (!event.target.closest("[data-play-bar-catch]")) {
        playChoices.hidden = true;
        playToggle?.setAttribute("aria-expanded", "false");
      }
    });
    const stageStatus = stageBar.querySelector(".sphere-play-bar-status");
    const stagePads = stageBar.querySelector("[data-play-bar-pads]");
    const stageCatch = stageBar.querySelector("[data-play-bar-catch]");
    let stageStatusTimer = 0;
    const stageSay = (text, holdMs) => {
      if (!stageStatus) return;
      stageStatus.textContent = text;
      stageStatus.hidden = false;
      window.clearTimeout(stageStatusTimer);
      if (holdMs) stageStatusTimer = window.setTimeout(() => { stageStatus.hidden = true; }, holdMs);
    };
    const stageEchoPads = (show) => {
      if (!stagePads) return;
      stagePads.innerHTML = "";
      if (!show) { stagePads.hidden = true; return; }
      const roomPads = section.querySelectorAll(".sphere-play-pad");
      roomPads.forEach((pad, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "sphere-play-pad";
        b.textContent = String(i + 1);
        b.style.setProperty("--pad-hue", String(Math.round(30 + i * 28)));
        b.setAttribute("aria-label", `Echo pad ${i + 1} on the Sphere`);
        b.addEventListener("click", () => pad.click());
        stagePads.appendChild(b);
      });
      stagePads.hidden = roomPads.length === 0;
    };

    const recordLine = section.querySelector(".sphere-play-record");
    const questPanel = section.querySelector("[data-quest-panel]");
    const questOfferLine = section.querySelector("[data-quest-offer]");
    const questQuestionEl = section.querySelector("[data-quest-question]");
    const questPredictionsEl = section.querySelector("[data-quest-predictions]");
    const questLine = section.querySelector("[data-quest-line]");
    const questTakeBtn = section.querySelector("[data-quest-take]");
    const questHintBtn = section.querySelector("[data-quest-hint]");
    const questDeferBtn = section.querySelector("[data-quest-defer]");
    const questDismissBtn = section.querySelector("[data-quest-dismiss]");
    const questCardsEl = section.querySelector("[data-quest-cards]");
    const questCardList = section.querySelector("[data-quest-card-list]");
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

    /* ── The Pattern Quests, rung 1 ─────────────────────────────
     * The frame around the three games: offer → question →
     * one-tap prediction → the game itself as the hunt → reveal
     * stated as a count → answer card in the Life Atlas →
     * one-line close. The pure frame lives in pattern-quests.js;
     * this is its wiring. One offer a day; a kind turned away
     * for good is never offered again; hints are free and the
     * Spark never just gives the answer. */
    const PQ = window.CodexPatternQuests || null;
    const QUEST_KINDS = PQ ? PQ.QUESTS.map(q => q.kind) : [];
    let activeQuest = null;
    let questTarget = null;

    function questCivilDate() {
      try {
        const stamp = window.SphereSparkCore?.patternStamp?.(window, new Date());
        if (stamp?.civilDate) return stamp.civilDate;
      } catch { /* fall through to the calendar */ }
      try {
        // The house day, as everywhere on this page: the device's
        // zone, the midnight boundary — a bare call would stamp
        // the quest with the UTC day (Aaron's ruling, Nov 26, 2026).
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const conv = window.PatternCalendar?.fromCivilDate?.({ date: new Date(), timeZone, boundaryMode: "midnight" });
        if (conv?.civilDate) return conv.civilDate;
      } catch { /* fall through */ }
      return new Date().toISOString().slice(0, 10);
    }

    function questMemory() {
      try { return PQ.parseMemory(window.localStorage.getItem(PQ.STORAGE_KEY)); }
      catch { return PQ.emptyMemory(); }
    }

    function saveQuestMemory(memory) {
      try { window.localStorage.setItem(PQ.STORAGE_KEY, PQ.serializeMemory(memory)); }
      catch { /* storage closed: the offer simply returns another day */ }
    }

    function renderQuestPanel() {
      if (!PQ || !questPanel || activeQuest) return;
      const kind = PQ.chooseOfferKind(questMemory(), questCivilDate(), QUEST_KINDS);
      const quest = kind ? PQ.questFor(kind) : null;
      if (!quest) { questPanel.hidden = true; return; }
      questPanel.hidden = false;
      questPanel.dataset.questKind = quest.kind;
      questOfferLine.textContent = `A Pattern Quest from your Spark — ${quest.title}. ${quest.offer}`;
      questQuestionEl.textContent = "";
      questPredictionsEl.replaceChildren();
      questLine.textContent = "One a day, offered, never owed. Take it, leave it for today, or turn this kind away for good — all three are fine.";
      questTakeBtn.hidden = false;
      questDeferBtn.hidden = false;
      questDismissBtn.hidden = false;
      questHintBtn.hidden = true;
    }

    function renderPredictions(quest) {
      questPredictionsEl.replaceChildren();
      for (const opt of PQ.predictionOptionsFor(quest)) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "sphere-play-btn sphere-play-quest-guess";
        b.textContent = opt.label;
        b.addEventListener("click", () => {
          if (!activeQuest) return;
          activeQuest.predictionId = opt.id;
          for (const sib of questPredictionsEl.querySelectorAll("button")) {
            sib.classList.toggle("sphere-play-quest-guess-on", sib === b);
          }
          questLine.textContent = `Your guess: ${opt.label}. Now hunt it out of the Sphere — the answer is in the instrument, not in me.`;
          if (activeQuest.kind === "hunt") huntBtn.click();
          else if (activeQuest.kind === "echo") echoBtn.click();
          else if (activeQuest.kind === "turning") armBtn.click();
        });
        questPredictionsEl.appendChild(b);
      }
    }

    questTakeBtn?.addEventListener("click", () => {
      if (!PQ) return;
      const quest = PQ.questFor(questPanel.dataset.questKind || "");
      if (!quest) return;
      saveQuestMemory(PQ.noteOffer(questMemory(), questCivilDate()));
      activeQuest = { quest, kind: quest.kind, question: null, predictionId: null, target: null };
      questOfferLine.textContent = `${quest.title} — a Pattern Quest. ${quest.teach}`;
      if (quest.kind === "hunt") {
        questTarget = drawHuntTarget();
        activeQuest.target = questTarget;
        activeQuest.question = questTarget
          ? PQ.questionFor(quest, { targetMoon: questTarget.moon, targetDay: questTarget.day })
          : null;
      } else {
        activeQuest.question = PQ.questionFor(quest, {});
      }
      questQuestionEl.textContent = activeQuest.question ? `The question: ${activeQuest.question}` : "";
      renderPredictions(quest);
      questLine.textContent =
        "Make your guess first — one tap. Then hunt: " +
        (quest.kind === "hunt"
          ? "the day is named on Find the day; move the Sphere until you stand on it."
          : quest.kind === "echo"
            ? "Echo plays your Spark's motif; hold it and tap it back."
            : "Catch the turning arms; wait with the Sphere and catch the light as it turns.");
      questTakeBtn.hidden = true;
      questDeferBtn.hidden = true;
      questDismissBtn.hidden = true;
      questHintBtn.hidden = false;
    });

    questDeferBtn?.addEventListener("click", () => {
      if (!PQ) return;
      saveQuestMemory(PQ.deferOffer(questMemory(), questCivilDate()));
      questPanel.hidden = true;
    });

    questDismissBtn?.addEventListener("click", () => {
      if (!PQ) return;
      const kind = questPanel.dataset.questKind;
      if (kind) saveQuestMemory(PQ.dismissKind(questMemory(), kind));
      renderQuestPanel();
    });

    questHintBtn?.addEventListener("click", () => {
      if (!PQ || !activeQuest) return;
      const hint = PQ.hintFor(activeQuest.quest);
      if (hint) questLine.textContent = `A hint, free as hints are: ${hint}`;
    });

    async function loadQuestCards() {
      if (!PQ || !questCardsEl || !window.CodexRecordHelpers?.createRepositoryResolver) return;
      try {
        const resolver = window.CodexRecordHelpers.createRepositoryResolver();
        const repository = resolver ? await resolver() : null;
        if (!repository) return;
        const records = await repository.query({});
        const cards = PQ.foldAnswerCards(records);
        questCardList.replaceChildren();
        if (!cards.length) { questCardsEl.hidden = true; return; }
        questCardsEl.hidden = false;
        for (const card of cards.slice(0, 12)) {
          const li = document.createElement("li");
          li.textContent =
            `${card.title}${card.civilDate ? ` · ${card.civilDate}` : ""} — ${card.question || ""} ` +
            `Your guess: ${card.prediction || "—"} (${card.predictionCorrect ? "it stood" : "it missed, and taught"}). ${card.reveal || ""}`;
          questCardList.appendChild(li);
        }
      } catch { /* no shelf rather than a wrong one */ }
    }

    /* A finished game, when a quest is riding it, becomes the
     * quest's reveal and its answer card. A game finished with
     * no quest riding it is just a game — the play log already
     * holds it, and no card is made. */
    async function finishQuest(kind, facts) {
      if (!PQ || !activeQuest || activeQuest.kind !== kind) return;
      const current = activeQuest;
      if (kind === "hunt" && current.target && facts.patternDay !== current.target.patternDay) {
        /* A free round landed first: the quest follows the day
         * actually hunted, and says so. */
        current.target = { moon: facts.targetMoon, day: facts.targetDay, patternDay: facts.patternDay };
        current.question = PQ.questionFor(current.quest, { targetMoon: facts.targetMoon, targetDay: facts.targetDay });
        questQuestionEl.textContent = current.question ? `The question: ${current.question}` : "";
        questLine.textContent = "That round was a free one — the quest's question now names the day you just found. Guess again if you like; the hunt stands.";
        return;
      }
      const judged = PQ.judge(current.quest, current.predictionId, facts);
      activeQuest = null;
      if (!judged) { renderQuestPanel(); return; }
      let cardLine = "";
      try {
        const helpers = window.CodexRecordHelpers;
        const resolver = helpers?.createRepositoryResolver?.();
        const repository = resolver ? await resolver() : null;
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const conversion = window.PatternCalendar?.fromCivilDate
          ? window.PatternCalendar.fromCivilDate({ date: new Date(), timeZone, boundaryMode: "midnight" })
          : null;
        const record = repository && conversion
          ? PQ.buildAnswerCardRecord(
              {
                questId: current.quest.id,
                question: current.question,
                predictionId: current.predictionId,
                predictionCorrect: judged.correct,
                reveal: judged.revealText,
                count: judged.count
              },
              helpers.temporalFromConversion(conversion, new Date())
            )
          : null;
        if (repository && record) {
          await repository.put(record);
          helpers.notifyRecordsChanged({ source: "pattern-quest", kind: "answer-card" });
          cardLine = " Your answer card is kept in your Life Atlas.";
          void loadQuestCards();
        }
      } catch { /* the reveal still stands; no card is claimed that was not written */ }
      if (!cardLine) cardLine = " The answer card could not be written just now — the reveal above still stands.";
      questPanel.hidden = false;
      questOfferLine.textContent = `${current.quest.title} — the reveal.`;
      questQuestionEl.textContent = current.question ? `The question was: ${current.question}` : "";
      questPredictionsEl.replaceChildren();
      questLine.textContent =
        `${judged.revealText} ${judged.correct ? "Your guess stood." : "Your guess missed — and now you know, which is the point."}${cardLine} ${current.quest.close}`;
      questTakeBtn.hidden = true;
      questHintBtn.hidden = true;
      questDeferBtn.hidden = true;
      questDismissBtn.hidden = true;
    }

    const stillLine = () => {
      const still = isStill();
      section.classList.toggle("sphere-play-still", still);
      for (const btn of section.querySelectorAll(".sphere-play-btn")) {
        if (still) { btn.disabled = true; btn.dataset.stillOff = "1"; }
        else if (btn.dataset.stillOff) { btn.disabled = false; delete btn.dataset.stillOff; }
      }
      for (const btn of stageBar.querySelectorAll(".sphere-play-bar-btn")) {
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
        stageSay(`You found it — Moon ${target.moon} · Day ${target.day}. The Sphere itself says so.`, 9000);
        window.SphereSpark?.soundMotif?.("day");
        window.SphereSpark?.logPlay?.("hunt", { target: { moon: target.moon, day: target.day, patternDay: target.patternDay } });
        void finishQuest("hunt", { patternDay: target.patternDay, targetMoon: target.moon, targetDay: target.day });
        noteRecord();
      }
    }

    // A true coordinate, a little way from today, drawn from the
    // calendar itself. The game names it; the keeper finds it.
    // A quest that is riding the hunt draws its target first and
    // hands it here, so the question and the hunt name one day.
    function drawHuntTarget() {
      const PC = window.PatternCalendar;
      if (!PC?.fromCivilDate) return null;
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const today = PC.fromCivilDate({ date: new Date(), timeZone, boundaryMode: "midnight" });
      const todayPd = today?.dayOfPatternYear || 218;
      let pd = todayPd + 20 + Math.floor(Math.random() * 120);
      if (pd > 364) pd -= 364;
      if (pd === todayPd) pd = (pd % 364) + 1;
      const moon = Math.floor((pd - 1) / 28) + 1;
      const day = ((pd - 1) % 28) + 1;
      return { moon, day, patternDay: pd };
    }

    huntBtn.addEventListener("click", () => {
      const drawn = questTarget || drawHuntTarget();
      questTarget = null;
      if (!drawn) { huntStatus.textContent = "The calendar is still waking up — try again in a moment."; return; }
      huntTarget = drawn;
      lastHuntStanding = null;
      huntStatus.textContent = `Find this day: Moon ${drawn.moon} · Day ${drawn.day}. Spin the Sphere, tap a moon and a day, or use Choose a day — as you move, the Sphere tells you which day you are standing on.`;
      stageSay(`Find this day: Moon ${drawn.moon} · Day ${drawn.day}. Spin the Sphere until you are standing on it.`);
      $(".sphere-wrapper")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });

    let lastHuntStanding = null;
    const checkHunt = () => {
      if (!huntTarget) return;
      const shown = shownCoordinate();
      if (!shown) return;
      const pd = Number(shown.dayOfPatternYear);
      if (pd === huntTarget.patternDay) { endHunt(true); return; }
      // Searching feedback: while the hunt runs, the Sphere says
      // where the keeper is standing, so the search is a search —
      // not a guess. One line per new standing, never a stream.
      if (Number.isFinite(pd) && pd >= 1 && pd <= 364 && pd !== lastHuntStanding) {
        lastHuntStanding = pd;
        const m = Math.floor((pd - 1) / 28) + 1;
        const d = ((pd - 1) % 28) + 1;
        const line = `You are standing on Moon ${m} · Day ${d} — not the day yet. The day you want is Moon ${huntTarget.moon} · Day ${huntTarget.day}.`;
        huntStatus.textContent = line;
        stageSay(line);
      }
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
          b.textContent = String(i + 1);
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
                stageSay("That is the motif, note for note. Your Spark heard itself in you.", 9000);
                stageEchoPads(false);
                Spark.soundMotif("day");
                Spark.logPlay("echo", { notes: echoSequence.length });
                void finishQuest("echo", { notes: echoSequence.length });
                echoSequence = [];
                echoBtn.textContent = "Play again";
                noteRecord();
              } else {
                echoStatus.textContent = `Good — ${echoStep} of ${echoSequence.length}. Keep going.`;
              }
            } else {
              echoStatus.textContent = "Not quite that note. Listen once more, then try again.";
              stageSay("Not quite that note. Hear it again, then try.", 6000);
              stageEchoPads(false);
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
      stageEchoPads(true);
      stageSay("Listen…");
      seq.forEach((padIndex, i) => {
        window.setTimeout(() => {
          Spark?.soundNote(echoPads[padIndex].note, 0.34);
          const b = padsEl.children[padIndex];
          if (b) { b.classList.add("sphere-play-pad-lit"); window.setTimeout(() => b.classList.remove("sphere-play-pad-lit"), 260); }
          const sb = stagePads.children[padIndex];
          if (sb) { sb.classList.add("sphere-play-pad-lit"); window.setTimeout(() => sb.classList.remove("sphere-play-pad-lit"), 260); }
          if (i === seq.length - 1) window.setTimeout(() => { echoStatus.textContent = "Now you — tap the same notes back."; stageSay("Now you — tap the same notes back."); }, 420);
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
      stageSay(`Armed. The light is ${armedBand} now; it next turns at ${nextTurnText()}.`);
    });

    window.setInterval(() => {
      if (!armedBand) return;
      const now = bandOf();
      if (now && now !== armedBand) {
        armedBand = null;
        catchDeadline = Date.now() + 60000;
        catchBtn.hidden = false;
        if (stageCatch) stageCatch.hidden = false;
        armBtn.disabled = false;
        armBtn.textContent = "Arm again";
        turnStatus.textContent = `The light just turned to ${now} — catch it! You have a minute.`;
        stageSay(`The light just turned to ${now} — catch it! You have a minute.`);
        window.SphereSpark?.soundMotif?.("moment");
      }
      if (catchDeadline && Date.now() > catchDeadline && !catchBtn.hidden) {
        catchBtn.hidden = true;
        if (stageCatch) stageCatch.hidden = true;
        catchDeadline = 0;
        turnStatus.textContent = "The turning slipped past uncaught — it will come again. Arm it and wait with the Sphere.";
        stageSay("The turning slipped past uncaught — it will come again.", 6000);
      }
    }, 5000);

    catchBtn.addEventListener("click", () => {
      if (!catchDeadline || Date.now() > catchDeadline) return;
      catchBtn.hidden = true;
      if (stageCatch) stageCatch.hidden = true;
      catchDeadline = 0;
      const band = bandOf();
      turnStatus.textContent = `Caught — the light turned to ${band}, and you were here for it. It stands in your record.`;
      stageSay(`Caught — the light turned to ${band}, and you were here for it.`, 9000);
      window.SphereSpark?.soundMotif?.("day");
      window.SphereSpark?.logPlay?.("turning", { band });
      void finishQuest("turning", { band });
      noteRecord();
    });

    // The stage doors press the room's own buttons — one logic
    // path for both homes of each game.
    stageBar.querySelector("[data-play-bar-hunt]")?.addEventListener("click", () => huntBtn.click());
    stageBar.querySelector("[data-play-bar-echo]")?.addEventListener("click", () => echoBtn.click());
    stageBar.querySelector("[data-play-bar-arm]")?.addEventListener("click", () => armBtn.click());
    stageCatch?.addEventListener("click", () => catchBtn.click());

    // Still mode quiets the room; waking restores it.
    const motionSel = $("#sphere-motion-mode");
    motionSel?.addEventListener("change", stillLine);
    new MutationObserver(stillLine).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    stillLine();
    renderQuestPanel();
    void loadQuestCards();
    return section;
  }

  function boot() {
    buildPlayRoom();
  }

  window.SpherePlay = Object.freeze({ VERSION });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
