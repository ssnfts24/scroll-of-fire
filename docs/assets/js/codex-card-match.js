/*
 * The Table — the living card game, stage 2 (Aaron, Nov 26, 2026).
 *
 * The album is live; this is the match that stands on it. Solo
 * against the day, first form: the keeper's own field against
 * the field the day deals, over the engine the cards core
 * already proves (deriveMatch / applyPlay / fieldAnswer — the
 * same state, the same hash, on any device).
 *
 * The alive layer, as adopted:
 *   · cards day-true in play — a card whose Moon is today's
 *     stands brighter, and the sky shows the real Moon;
 *   · the shared sky ANSWERS when a chord locks — light
 *     gathers over the table, harmony you can see;
 *   · cards carry their matches — a finished match is written
 *     into each played copy's trail, and the album's lineage
 *     panel reads it back;
 *   · the keeper's Spark attends the table and hums at a triad;
 *   · the table is a place: it sits under the sky's root Moon,
 *     the Moon turns every fourth round, and its light follows
 *     the real Pattern Day (the day's own table, the same for
 *     everyone, deals the other side);
 *   · a finished match composes a piece of music from the
 *     cards actually played, and the keeper keeps it here;
 *   · dissonance is gathered as fuel, never destroyed — it
 *     hangs in the sky, gatherable, and pays for triads that
 *     close across two Moons.
 *
 * Game law, kept: harmony, not combat. A match never moves an
 * instance; win or lose, collections leave unchanged. The
 * First Card sounds once as a wild harmony and is never
 * tradable. Nothing losable, no streaks, no guilt.
 */
(function () {
  "use strict";

  var Cards = window.CodexCards;
  if (!Cards) return;
  var mount = document.querySelector("[data-card-match]");
  if (!mount) return;

  var storage = null;
  try { storage = window.localStorage; storage.getItem("sof.cards.probe"); } catch (e) { storage = null; }
  if (!storage) { mount.textContent = "The table needs this device's storage to stand."; return; }

  var companionRecord = null;
  var companion = null;
  try {
    var raw = storage.getItem("sof.spark.v1");
    if (raw) companionRecord = JSON.parse(raw);
  } catch (e) { companionRecord = null; }
  if (companionRecord && window.SparkCompanion) {
    try { companion = window.SparkCompanion.generate(companionRecord.seed); } catch (e) { companion = null; }
  }

  var keeperKey = Cards.keeperKeyForSeed(companionRecord ? companionRecord.seed : null);
  var store = Cards.createStore(storage, keeperKey);
  var TRAIL_KEY = "sof.cards.matchtrail.v1." + keeperKey;
  var PIECES_KEY = "sof.cards.pieces.v1." + keeperKey;

  function todayCoord() {
    try {
      if (window.PatternCalendar && window.PatternCalendar.fromCivilDate) {
        var tz = (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || "UTC";
        var c = window.PatternCalendar.fromCivilDate({ date: new Date(), timeZone: tz });
        if (c) return { moon: c.moon || null, dayOfMoon: c.day || null, patternDay: c.dayOfPatternYear || null };
      }
    } catch (e) { /* the calendar is the authority */ }
    return { moon: null, dayOfMoon: null, patternDay: null };
  }
  var TODAY = todayCoord();
  var patternDay = TODAY.patternDay || 1;

  /* ---------- sound (the album's own way) ---------- */
  var audioCtx = null;
  function tone(hz, offset, dur) {
    if (!hz) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    var t0 = audioCtx.currentTime + (offset || 0);
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = hz;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.9));
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(t0); osc.stop(t0 + (dur || 0.9) + 0.05);
  }
  function cardHz(card) {
    if (!card) return 432;
    if (card.hum && card.hum.hz) return card.hum.hz;
    var root = Cards.MOONS[card.moonAffinity[0] - 1];
    return root ? root.freq : 432;
  }
  function soundCard(card) { tone(cardHz(card), 0, 1.0); }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function moonName(idx) {
    var m = Cards.MOONS[idx - 1];
    return m ? m.name : "Moon " + idx;
  }

  /* ---------- the match ---------- */
  var state = null;
  var callMoon = null;
  var gatherTarget = null;
  var pieceNotes = [];
  var logLines = [];
  var lentIds = {};
  var recordedCode = null;
  var settled = null; // winner, when the light or the cards run out on the side to sound

  function heldDesigns() {
    var data = store.load();
    var ids = [];
    Object.keys(data.copies).forEach(function (instanceId) {
      var copy = data.copies[instanceId];
      if (copy.state === "held" && ids.indexOf(copy.designId) < 0) ids.push(copy.designId);
    });
    return ids;
  }

  function start() {
    var mine = heldDesigns().slice(0, Cards.DECK_MAX);
    lentIds = {};
    if (mine.length < 8) {
      var table = Cards.dailyTable(patternDay);
      for (var i = 0; i < table.length && mine.length < 8; i++) {
        if (mine.indexOf(table[i]) < 0) { mine.push(table[i]); lentIds[table[i]] = true; }
      }
    }
    var dayDeck = Cards.dailyTable(patternDay).slice(0, 12);
    var code = Cards.makeMatchCode(Cards.hashString("solo:" + patternDay + ":" + keeperKey));
    state = Cards.deriveMatch(code, mine, dayDeck, {
      a: companion ? companion.kind : null,
      b: null
    });
    callMoon = null;
    gatherTarget = null;
    settled = null;
    pieceNotes = [];
    logLines = ["The table is set under " + moonName(state.fieldMoon) + ". Your field is yours; the sky is shared."];
    render();
  }

  function log(line) {
    logLines.unshift(line);
    logLines = logLines.slice(0, 6);
  }

  var EVENT_LINES = {
    "sounded": "sounded into the field",
    "called-and-sounded": "answered the Call — its resonance doubled",
    "duet": "sounded a duet — light returned",
    "triad": "locked a triad",
    "triad-waits": "a triad stands waiting — across two Moons it asks gathered dissonance",
    "dimmed": "hangs in the sky, gatherable",
    "fell-sky-full": "the sky is full; its note falls for this match — the card itself is untouched",
    "gathered": "gathered dissonance out of the sky — fuel banked",
    "heart": "the First Card sounded — a wild harmony"
  };

  function playMine(play) {
    if (!state || state.complete || settled || state.turn !== "a") return;
    play.by = "a";
    play.expectedHash = Cards.stateHash(state);
    var before = state;
    var result = Cards.applyPlay(state, play);
    if (!result.ok) { log("The play was refused (" + result.reason + ") — the table stands as it was."); render(); return; }
    state = result.state;
    var card = play.cardId === "first-card" ? null : Cards.cardById(play.cardId);
    if (play.cardId === "first-card") {
      var kindCard = companion ? Cards.cardById("kind-" + companion.kind) : null;
      pieceNotes.push(cardHz(kindCard));
    } else if (card) {
      pieceNotes.push(cardHz(card));
      soundCard(card);
    }
    var line = (card ? card.name : "The First Card") + " " + (EVENT_LINES[result.event] || "sounded") + ".";
    if (result.event === "triad") line += " The sky answers.";
    log(line);
    render(result.event === "triad");
    if (state.complete) {
      finishMatch();
    } else if (!settleIfSpent() && state.turn === "b") {
      window.setTimeout(dayAnswers, 750);
    }
    void before;
  }

  function dayAnswers() {
    if (!state || state.complete || state.turn !== "b") return;
    var play = Cards.fieldAnswer(state);
    if (!play) { if (!settleIfSpent()) render(); return; }
    var result = Cards.applyPlay(state, play);
    if (!result.ok) { if (!settleIfSpent()) render(); return; }
    state = result.state;
    var card = Cards.cardById(play.cardId);
    if (card) { pieceNotes.push(cardHz(card)); soundCard(card); }
    log("The day sounds " + (card ? card.name : play.cardId) + " — " + (EVENT_LINES[result.event] || "sounded") + ".");
    render(result.event === "triad");
    if (state.complete) finishMatch();
    else settleIfSpent();
  }

  /* The engine scores a match when both sides are spent; a
   * one-sided spending ends it the same honest way — by the
   * resonance standing in the sky, never by a coin toss. (A
   * side to sound with no light, or no card and no deck, has
   * no play the rules can take.) */
  function settleIfSpent() {
    if (!state || state.complete || settled) return false;
    var side = state.turn;
    var noLight = state.light[side] <= 0;
    var noCards = state.hands[side].length === 0 && state.decks[side].length === 0;
    if (!noLight && !noCards) return false;
    settled = state.resonanceBy.a === state.resonanceBy.b ? "draw"
      : (state.resonanceBy.a > state.resonanceBy.b ? "a" : "b");
    log(noLight
      ? "The light is spent on the side to sound — the sky is scored as it stands."
      : "No cards remain to the side to sound — the sky is scored as it stands.");
    finishMatch(settled);
    return true;
  }

  function finishMatch(winnerOverride) {
    var winner = winnerOverride || state.winner;
    var outcome = winner === "a"
      ? "Your field filled the sky first."
      : winner === "b"
        ? "The day filled the sky first — and the music is still yours to keep."
        : "The sky filled evenly — a drawn match.";
    log(outcome);
    /* the piece the match composed, from the cards actually played */
    var pieces = [];
    try { pieces = JSON.parse(storage.getItem(PIECES_KEY) || "[]"); } catch (e) { pieces = []; }
    if (!pieces.some(function (p) { return p.code === state.code && p.day === patternDay; })) {
      pieces.push({ day: patternDay, code: state.code, winner: winner, notes: pieceNotes.slice() });
      try { storage.setItem(PIECES_KEY, JSON.stringify(pieces.slice(-50))); } catch (e) { /* the shelf rests */ }
    }
    /* the trail: each of the keeper's played copies carries this match */
    if (recordedCode !== state.code) {
      recordedCode = state.code;
      var data = store.load();
      var trail = {};
      try { trail = JSON.parse(storage.getItem(TRAIL_KEY) || "{}"); } catch (e) { trail = {}; }
      var played = {};
      state.fields.a.concat(state.locked.a).forEach(function (id) { played[id] = true; });
      Object.keys(played).forEach(function (designId) {
        var instanceId = data.byDesign[designId];
        if (!instanceId) return; // lent by the day — no copy to carry it
        trail[instanceId] = trail[instanceId] || [];
        if (trail[instanceId].some(function (t) { return t.code === state.code; })) return;
        trail[instanceId].push({
          day: patternDay,
          code: state.code,
          result: winner,
          triads: state.lockedTriads.a.length
        });
      });
      try { storage.setItem(TRAIL_KEY, JSON.stringify(trail)); } catch (e) { /* the trail rests */ }
    }
    if (window.SparkLiving) {
      window.SparkLiving.noteAct("act", "match");
      window.SparkLiving.noteMoved({
        text: "A match against the day left you a piece of music.",
        href: "card-album.html",
        label: "Hear it at the table"
      });
    }
    render(true);
  }

  /* ---------- rendering ---------- */
  function skyBand(flash) {
    var band = el("div", "match-sky is-" + Cards.MOONS[Cards.effectiveMoon(state) - 1].element.toLowerCase());
    if (flash) band.classList.add("is-answering");
    var info = Cards.moonTurnInfo(state);
    band.appendChild(el("p", "match-sky__moon",
      "The table answers to Moon " + Cards.effectiveMoon(state) + " — " + moonName(Cards.effectiveMoon(state)) +
      " · root " + Cards.MOONS[Cards.effectiveMoon(state) - 1].freq + " Hz" +
      (TODAY.moon ? " · today stands in Moon " + TODAY.moon + " — " + moonName(TODAY.moon) : "")));
    band.appendChild(el("p", "match-sky__turn",
      info.announced
        ? "The Moon turns after this round — affinities are about to rotate."
        : "The Moon turns in " + info.playsUntilTurn + " plays."));
    var skyRow = el("div", "match-sky__slots");
    if (!state.sky.dissonance.length) {
      skyRow.appendChild(el("span", "match-sky__clear", "The sky is clear — no dissonance hangs."));
    }
    state.sky.dissonance.forEach(function (id) {
      var card = Cards.cardById(id);
      var chip = el("button", "match-sky__chip" + (gatherTarget === id ? " is-target" : ""), card ? card.name : id);
      chip.type = "button";
      chip.title = "Gather this dissonance: choose it, then play its re-tune from your hand.";
      chip.addEventListener("click", function () {
        if (state.gathered.a >= 3) {
          log("Your bank is full — gathered dissonance is spent when a triad closes across two Moons.");
          render();
          return;
        }
        gatherTarget = gatherTarget === id ? null : id;
        render();
      });
      skyRow.appendChild(chip);
    });
    band.appendChild(skyRow);
    band.appendChild(el("p", "match-sky__bank",
      "Gathered dissonance banked: you " + state.gathered.a + " · the day " + state.gathered.b +
      " · resonance: you " + state.resonanceBy.a + " · the day " + state.resonanceBy.b +
      " · first to " + state.targetResonance + " fills the sky"));
    return band;
  }

  function fieldRow(side, label) {
    var row = el("div", "match-field");
    row.appendChild(el("h4", null, label));
    var cards = el("div", "match-field__cards");
    var ids = state.fields[side].concat(state.locked[side]);
    if (!ids.length) cards.appendChild(el("span", "match-field__empty", "Nothing sounding yet."));
    ids.forEach(function (id) {
      if (id === "first-card") {
        cards.appendChild(el("span", "match-field__card is-heart", "The First Card ✦"));
        return;
      }
      var card = Cards.cardById(id);
      var locked = state.locked[side].indexOf(id) >= 0;
      cards.appendChild(el("span", "match-field__card" + (locked ? " is-locked" : ""), card ? card.name : id));
    });
    if (state.lockedTriads[side].length) {
      cards.appendChild(el("span", "match-field__triads",
        "Triads locked: " + state.lockedTriads[side].map(moonName).join(", ")));
    }
    row.appendChild(cards);
    return row;
  }

  function handCard(id) {
    var card = Cards.cardById(id);
    if (!card) return el("span");
    var btn = el("button", "match-hand__card");
    btn.type = "button";
    var ownDay = TODAY.moon && card.moonAffinity.indexOf(TODAY.moon) >= 0;
    if (ownDay) btn.classList.add("is-own-day");
    if (Cards.harmonizesWith(card, Cards.effectiveMoon(state))) btn.classList.add("is-attuned");
    if (gatherTarget) {
      var target = Cards.cardById(gatherTarget);
      var shares = target && (target.element === card.element ||
        target.moonAffinity.some(function (m) { return card.moonAffinity.indexOf(m) >= 0; }));
      if (shares) btn.classList.add("is-retune");
    }
    var art = el("span", "match-hand__art");
    art.innerHTML = Cards.cardArtSVG(card);
    btn.appendChild(art);
    btn.appendChild(el("span", "match-hand__name", card.name + (lentIds[id] ? " · lent by the day" : "")));
    btn.appendChild(el("span", "match-hand__meta",
      "resonance " + card.resonance + (ownDay ? " · its own day — it stands brighter" : "")));
    btn.disabled = state.complete || !!settled || state.turn !== "a";
    btn.addEventListener("click", function () {
      if (gatherTarget) {
        var target = gatherTarget;
        gatherTarget = null;
        playMine({ cardId: id, gather: target });
      } else {
        playMine({ cardId: id, callMoon: callMoon });
      }
    });
    return btn;
  }

  function render(flash) {
    mount.innerHTML = "";
    if (!state) return;
    mount.appendChild(skyBand(flash));

    var table = el("div", "match-table");
    var witness = el("div", "match-witness");
    if (companion && window.SparkCompanion) {
      var stage = window.SparkCompanion.stageOf(companionRecord, companion);
      var art = el("span", "match-witness__art" + (flash ? " is-delighted" : ""));
      art.innerHTML = window.SparkCompanion.renderSVG(companion, {
        stage: stage.index,
        revealed: window.SparkCompanion.revealsFor({ record: companionRecord, companion: companion }).revealed,
        wrap: window.SparkCompanion.wrapFor(companionRecord)
      });
      witness.appendChild(art);
      witness.appendChild(el("p", "match-witness__line",
        window.SparkCompanion.displayName(companionRecord, companion) + " attends the table."));
    } else {
      witness.appendChild(el("p", "match-witness__line",
        "Meet a Spark, and it will attend your matches and hum at a triad."));
    }
    table.appendChild(witness);
    table.appendChild(fieldRow("b", "The day's field"));
    table.appendChild(fieldRow("a", "Your field"));
    mount.appendChild(table);

    if (!state.complete && !settled) {
      var callRow = el("div", "match-call");
      callRow.appendChild(el("span", "match-call__label", "The Call — name the Moon whose note the field needs:"));
      for (var m = 1; m <= 13; m++) {
        (function (mm) {
          var chip = el("button", "match-call__chip" + (callMoon === mm ? " is-on" : ""), String(mm));
          chip.type = "button";
          chip.title = moonName(mm);
          chip.addEventListener("click", function () {
            callMoon = callMoon === mm ? null : mm;
            render();
          });
          callRow.appendChild(chip);
        })(m);
      }
      if (gatherTarget) {
        callRow.appendChild(el("span", "match-call__hint",
          "Gathering: play a card in " + (Cards.cardById(gatherTarget) || {}).name + "'s element or Moon from your hand."));
      }
      mount.appendChild(callRow);

      var hand = el("div", "match-hand");
      state.hands.a.forEach(function (id) { hand.appendChild(handCard(id)); });
      mount.appendChild(hand);

      if (companion && !state.hearts.a.used) {
        var heart = el("button", "match-heart", "Sound the First Card — a wild harmony, once");
        heart.type = "button";
        heart.disabled = state.turn !== "a";
        heart.addEventListener("click", function () { playMine({ cardId: "first-card" }); });
        mount.appendChild(heart);
      }
      mount.appendChild(el("p", "match-turn",
        state.turn === "a" ? "Your sound." : "The day is answering…"));
    } else {
      var again = el("button", "match-again", "Play the day's match again");
      again.type = "button";
      again.addEventListener("click", start);
      mount.appendChild(again);
    }

    var logEl = el("div", "match-log");
    logLines.forEach(function (line) { logEl.appendChild(el("p", null, line)); });
    mount.appendChild(logEl);

    renderPieces();
  }

  function renderPieces() {
    var pieces = [];
    try { pieces = JSON.parse(storage.getItem(PIECES_KEY) || "[]"); } catch (e) { pieces = []; }
    if (!pieces.length) return;
    var shelf = el("section", "match-pieces");
    shelf.appendChild(el("h4", null, "Music the matches left with you"));
    pieces.slice().reverse().forEach(function (piece) {
      var row = el("div", "match-pieces__row");
      row.appendChild(el("span", null,
        "Pattern Day " + piece.day + " · " + piece.notes.length + " notes · " +
        (piece.winner === "a" ? "your field filled the sky" : piece.winner === "b" ? "the day filled the sky" : "a drawn sky")));
      var play = el("button", null, "Play it");
      play.type = "button";
      play.addEventListener("click", function () {
        piece.notes.forEach(function (hz, i) { tone(hz, i * 0.32, 0.3); });
      });
      row.appendChild(play);
      shelf.appendChild(row);
    });
    mount.appendChild(shelf);
  }

  var intro = el("div", "match-intro");
  intro.appendChild(el("p", null,
    "A match against the day, dealt from the day itself — the same table for everyone who stands in Pattern Day " +
    patternDay + ". Sound cards into your own field; lock triads (a Moon, its Word, and a kindred Kind); " +
    "gather the dissonance that hangs in the shared sky and spend it on triads across two Moons. " +
    "Nothing is ever played into another's field, and a match never moves a card out of your album."));
  var begin = el("button", "match-begin", "Take your seat at the table");
  begin.type = "button";
  begin.addEventListener("click", start);
  intro.appendChild(begin);
  mount.appendChild(intro);
})();
