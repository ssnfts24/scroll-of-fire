/*
 * The Card Album — the collection view (design §4).
 *
 * Renders the keeper's album from the local record only: the First
 * Card first (derived from the pinned first seed — the meeting itself,
 * never stored as a find and never reissued), then the three sets of
 * the first slice. Found cards show both faces: the collection face,
 * and the game face with its play values, so the game designed in the
 * paper is visible living in the cards. Missing cards are silhouettes
 * with their season named. Traded-away copies are tombstone lines.
 *
 * The album is a shelf built to be received into the Hearth build as
 * furniture; it reads the same store the find layer writes.
 */
(function () {
  "use strict";

  var Cards = window.CodexCards;
  if (!Cards) return;

  var storage = null;
  try { storage = window.localStorage; storage.getItem("sof.cards.probe"); } catch (e) { storage = null; }

  var companionRecord = null;
  var companion = null;
  if (storage) {
    try {
      var raw = storage.getItem("sof.spark.v1");
      if (raw) companionRecord = JSON.parse(raw);
    } catch (e) { companionRecord = null; }
    if (companionRecord && window.SparkCompanion) {
      try { companion = window.SparkCompanion.generate(companionRecord.seed); } catch (e) { companion = null; }
    }
  }

  var keeperKey = Cards.keeperKeyForSeed(companionRecord ? companionRecord.seed : null);
  var store = storage ? Cards.createStore(storage, keeperKey) : null;
  if (store && companionRecord) store.pinFirstSeed(companionRecord.seed);

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

  /* ----- the interactivity standard (design §13): a card is a living
   * object. Tap sounds its hum and turns it; hold shows its lineage
   * and rings; faces are computed from the record + the real day. --- */

  function todayCoord() {
    try {
      if (window.PatternCalendar && window.PatternCalendar.fromCivilDate) {
        var tz = (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || "UTC";
        var c = window.PatternCalendar.fromCivilDate({ date: new Date(), timeZone: tz });
        if (c) return { moon: c.moon || null, dayOfMoon: c.dayOfMoon || null, patternDay: c.dayOfPatternYear || null };
      }
    } catch (e) { /* the calendar is the authority; without it, no day is claimed */ }
    return { moon: null, dayOfMoon: null, patternDay: null };
  }
  var TODAY = todayCoord();

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

  function speakWord(card) {
    try {
      if (!window.speechSynthesis || !card.hum || !card.hum.motif) return;
      var u = new SpeechSynthesisUtterance(card.hum.motif);
      u.rate = 0.8;
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech is an added sense, never the only road */ }
  }

  // Sound a card from its own record: frequency cards sound their Hz;
  // a Word sounds its letter-beats on its home Moon's hum and speaks.
  function soundCard(card) {
    try {
      if (card.hum && card.hum.hz) { tone(card.hum.hz, 0, 1.0); return; }
      if (card.hum && card.hum.motif) {
        var root = Cards.MOONS[card.moonAffinity[0] - 1];
        var hz = root ? root.freq : 432;
        var beats = Math.min(card.hum.beats || 3, 8);
        for (var i = 0; i < beats; i++) tone(hz, i * 0.17, 0.13);
        speakWord(card);
      }
    } catch (e) { /* sound is an added sense, never the only road */ }
  }

  function lineagePanel(card, copy) {
    var panel = el("div", "codex-card__lineage");
    panel.hidden = true;
    var L = copy.lineage;
    panel.appendChild(el("p", "codex-card__stamp",
      "This copy · " + copy.instanceId + " · lineage head " + L.headHash));
    panel.appendChild(el("p", "codex-card__stamp",
      "Found on Pattern Day " + (L.found.patternDay != null ? L.found.patternDay : "—") +
      (L.found.act ? " · " + L.found.act : "") +
      " · held by " + L.keepers.length + " keeper" + (L.keepers.length === 1 ? "" : "s")));
    panel.appendChild(el("p", "codex-card__stamp",
      "Rings: " + L.keepers.length + " hand" + (L.keepers.length === 1 ? "" : "s") +
      " so far — matches sounded in will add their rings here."));
    return panel;
  }

  // Hold (600ms) toggles the panel; a plain click after a hold must
  // not also flip the card. A Lineage button gives the same state
  // without the hold, so every state is reachable every way.
  function wireHold(tile, panel) {
    var timer = null;
    var holdFiredAt = 0;
    tile.addEventListener("pointerdown", function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        holdFiredAt = Date.now();
        panel.hidden = !panel.hidden;
      }, 600);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) {
      tile.addEventListener(ev, function () { if (timer) clearTimeout(timer); });
    });
    tile.addEventListener("click", function (e) {
      if (Date.now() - holdFiredAt < 350) { e.stopPropagation(); e.preventDefault(); }
    }, true);
    return function wasHold() { return Date.now() - holdFiredAt < 350; };
  }

  function humText(card) {
    if (card.hum.hz) return card.hum.hz + " Hz" + (card.hum.derivedFrom ? " (sounds " + Cards.cardById(card.hum.derivedFrom).name + ")" : "");
    return "the word sounded — " + card.hum.motif + ", " + card.hum.beats + " beats";
  }

  function gameFace(card) {
    var wrap = el("div", "codex-card__game");
    var dl = document.createElement("dl");
    var rows = [
      ["Element", card.element],
      ["Hum", humText(card)],
      ["Resonance", "●".repeat(card.resonance) + "○".repeat(3 - card.resonance) + " (" + card.resonance + ")"],
      ["Moon affinity", card.moonAffinity.map(function (m) { return "Moon " + m + " · " + moonName(m); }).join("; ")],
      ["Harmonizes with", card.harmonyKeys.length + " cards"],
      ["Re-tuned by", "a later card sharing " + card.retune.by.join(" or ")],
      ["Cost to play", card.playCost.light + " light"],
      ["At the table", card.gameRole]
    ];
    rows.forEach(function (row) {
      dl.append(el("dt", null, row[0]), el("dd", null, row[1]));
    });
    wrap.appendChild(dl);
    return wrap;
  }

  var renderedTiles = [];

  function cardTile(card) {
    var copy = store ? store.copyFor(card.id) : null;
    var held = !!(copy && copy.state === "held");
    var tile = el("article", "codex-card" + (held ? "" : " codex-card--missing"));
    var face = el("div", "codex-card__face");
    if (held) {
      var tint = card.seedVariant && companion ? companion.hue : null;
      face.style.background = tint != null
        ? "linear-gradient(160deg,#0b1026,hsl(" + tint + " 62% 40%))"
        : "linear-gradient(160deg,#0b1026," + card.art.palette[1] + ")";
      if (card.set === "kinds") face.classList.add("codex-card__face--kindred-motion");
    }
    face.append(el("div", "codex-card__name", card.name), el("div", "codex-card__sub", card.sub));
    // Day-true face: a Moon card answers the real day.
    if (held && card.set === "moons" && TODAY.moon) {
      face.appendChild(el("div", "codex-card__today",
        TODAY.moon === card.moonAffinity[0]
          ? "Its Moon is today — Day " + (TODAY.dayOfMoon || "—") + " of " + moonName(TODAY.moon)
          : "Today stands in " + moonName(TODAY.moon)));
    }
    tile.appendChild(face);

    var body = el("div", "codex-card__body");
    body.appendChild(el("p", "codex-card__essence", card.essence));
    if (held) {
      var found = copy.lineage.found;
      body.appendChild(el("p", "codex-card__stamp",
        card.edition.name + " · found on Pattern Day " + (found.patternDay != null ? found.patternDay : "—") +
        " · " + copy.instanceId));
      body.appendChild(el("p", "codex-card__stamp codex-card__affordance",
        "Tap the card to hear it and turn it · hold it for its lineage"));
      var flip = el("button", "codex-card__flip", "See the game face");
      flip.type = "button";
      var doFlip = function () {
        tile.classList.toggle("is-game");
        flip.textContent = tile.classList.contains("is-game") ? "See the collection face" : "See the game face";
      };
      flip.addEventListener("click", doFlip);
      var panel = lineagePanel(card, copy);
      var linBtn = el("button", "codex-card__flip codex-card__lineage-btn", "See its lineage");
      linBtn.type = "button";
      linBtn.addEventListener("click", function () {
        panel.hidden = !panel.hidden;
        linBtn.textContent = panel.hidden ? "See its lineage" : "Hide its lineage";
      });
      face.addEventListener("click", function () { soundCard(card); doFlip(); });
      face.style.cursor = "pointer";
      tile.append(body, gameFace(card), flip, linBtn, panel);
      wireHold(tile, panel);
      renderedTiles.push({ card: card, tile: tile });
    } else if (copy && copy.state === "traded-away") {
      body.appendChild(el("p", "codex-card__stamp", "This copy moved on — its line is kept below, with the tombstones."));
      tile.appendChild(body);
    } else {
      var hint = card.set === "moons"
        ? "Of Moon " + card.moonAffinity[0] + " — witness a day in this Moon, on the Moons page."
        : card.set === "words"
          ? "Hear the word sounded on its own study page."
          : "The kind of your own Spark, met at adoption. Other kinds are met through play and greetings — those roads are still being built.";
      body.appendChild(el("p", "codex-card__stamp", hint));
      tile.appendChild(body);
    }
    return tile;
  }

  function firstCardTile() {
    if (!store) return null;
    var pinned = store.pinnedFirstSeed();
    if (!pinned) return null;
    var fc = Cards.firstCardFor({ seed: pinned }, companion && companionRecord && companionRecord.seed === pinned ? companion.name : null);
    if (!fc) return null;
    var tile = el("article", "codex-card codex-card--first");
    var face = el("div", "codex-card__face");
    face.style.background = "linear-gradient(160deg,#141021,hsl(" + Math.round((fc.hueRange[0] + fc.hueRange[1]) / 2) + " 60% 42%))";
    face.append(el("div", "codex-card__name", "The First Card"),
      el("div", "codex-card__sub", (fc.sparkName ? fc.sparkName + " · " : "") + fc.kindName + " Spark"));
    var body = el("div", "codex-card__body");
    body.appendChild(el("p", "codex-card__essence",
      "The card of the meeting itself — met in " + fc.moonName + ", Pattern Day " + fc.patternDay + "."));
    body.appendChild(el("p", "codex-card__stamp",
      "A keepsake of the meeting. Never sold, never traded, never reissued · " + fc.instanceId));
    body.appendChild(el("p", "codex-card__stamp codex-card__affordance", "Tap the card to hear its kind sound"));
    var kindCard = Cards.cardById("kind-" + fc.kindId);
    if (kindCard) {
      face.style.cursor = "pointer";
      face.addEventListener("click", function () { soundCard(kindCard); });
    }
    tile.append(face, body);
    renderedTiles.push({ card: kindCard, tile: tile, first: true });
    return tile;
  }

  function render() {
    var firstSlot = document.querySelector("[data-card-album-first]");
    var fcTile = firstCardTile();
    if (firstSlot && fcTile) firstSlot.appendChild(fcTile);
    if (firstSlot && !fcTile) {
      firstSlot.appendChild(el("p", "card-set__note",
        "No Spark has been met on this device yet — the First Card is struck at the meeting, and this shelf will open on it."));
    }
    var sets = { moons: "[data-card-set-moons]", words: "[data-card-set-words]", kinds: "[data-card-set-kinds]" };
    Object.keys(sets).forEach(function (set) {
      var slot = document.querySelector(sets[set]);
      if (!slot) return;
      Cards.REGISTRY.filter(function (c) { return c.set === set; }).forEach(function (card) {
        slot.appendChild(cardTile(card));
      });
    });
    var tombSlot = document.querySelector("[data-card-tombstones]");
    if (tombSlot && store) {
      var tombs = store.tombstones();
      if (!tombs.length) {
        tombSlot.appendChild(el("li", null, "No card has moved on from this album. When one does, its line will be kept here — name, the day it was found, and the day it moved on."));
      }
      tombs.forEach(function (copy) {
        var design = Cards.cardById(copy.designId);
        var li = el("li", null,
          (design ? design.name : copy.designId) + " — found on Pattern Day " +
          (copy.lineage.found.patternDay != null ? copy.lineage.found.patternDay : "—") +
          ", held by " + copy.lineage.keepers.length + " keeper" + (copy.lineage.keepers.length === 1 ? "" : "s") +
          ", lineage head " + copy.lineage.headHash + ".");
        tombSlot.appendChild(li);
      });
    }
    var countSlot = document.querySelector("[data-card-count]");
    if (countSlot && store) {
      countSlot.textContent = store.heldCopies().length + " of " + Cards.REGISTRY.length + " cards in the album";
    }
    var todaySlot = document.querySelector("[data-card-today]");
    if (todaySlot && TODAY.moon) {
      todaySlot.textContent = "Today in Living Time: Moon " + TODAY.moon + " · " + moonName(TODAY.moon) +
        (TODAY.patternDay ? " · Pattern Day " + TODAY.patternDay : "") + ". ";
    }
    // Completion brightening (§13): HELD cards brighten when their set
    // completes, and when a triad they belong to stands complete in the
    // album. A missing card's silhouette never glows — no guilt light.
    if (store) {
      var heldIds = {};
      store.heldCopies().forEach(function (c) { heldIds[c.designId] = true; });
      var byDesign = {};
      renderedTiles.forEach(function (r) { if (r.card && !r.first) byDesign[r.card.id] = r.tile; });
      ["moons", "words", "kinds"].forEach(function (set) {
        var designs = Cards.REGISTRY.filter(function (c) { return c.set === set; });
        if (designs.every(function (c) { return heldIds[c.id]; })) {
          designs.forEach(function (c) {
            if (byDesign[c.id]) byDesign[c.id].classList.add("codex-card--set-complete");
          });
        }
      });
      Cards.namedTriads().forEach(function (t) {
        if (heldIds[t.moon] && heldIds[t.word] && heldIds[t.kind]) {
          [t.moon, t.word, t.kind].forEach(function (id) {
            if (byDesign[id]) byDesign[id].classList.add("codex-card--triad-held");
          });
        }
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
