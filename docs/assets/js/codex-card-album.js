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
        if (c) return { moon: c.moon || null, dayOfMoon: c.day || null, patternDay: c.dayOfPatternYear || null };
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
    /* The match trail (Nov 26, 2026): matches this copy has
     * sounded in, written by the Table and read back here —
     * genealogy as rarity, growing ring by ring. */
    try {
      var trail = JSON.parse(storage.getItem("sof.cards.matchtrail.v1." + keeperKey) || "{}");
      var entries = trail[copy.instanceId] || [];
      if (entries.length) {
        panel.appendChild(el("p", "codex-card__stamp",
          "Matches: sounded in " + entries.length + " match" + (entries.length === 1 ? "" : "es") +
          " at the Table · first on Pattern Day " + entries[0].day +
          " · " + entries.reduce(function (n, t) { return n + (t.triads || 0); }, 0) + " triads locked with it standing in the field."));
      }
    } catch (e) { /* the trail rests */ }
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

  /* ----- the trading-card faces (Aaron, Nov 25, 2026: "The cards
   * should look like actual trading cards"). A portrait frame with
   * the anatomy of a real card: name banner with its rarity mark, an
   * artwork window drawn from the card's own record, a type line with
   * its set and number, a text box, a hum/stat strip, and the edition
   * + found stamps along the foot. The game face turns over inside
   * the same frame. Data, lineage and mechanics are untouched — this
   * is the card's dress, not its record. --- */

  var SET_LABELS = { moons: "The Thirteen Moons", words: "The Words", kinds: "The Spark Kinds" };

  function rarityMark(card) {
    if (card.rarity === "moon-window") return { glyph: "◐", label: "Moon Window" };
    if (card.rarity === "earned-only") return { glyph: "✦", label: "Earned" };
    return { glyph: "●", label: "Common" };
  }

  function setNumber(card) {
    var set = Cards.REGISTRY.filter(function (c) { return c.set === card.set; });
    var n = set.findIndex(function (c) { return c.id === card.id; }) + 1;
    return {
      label: SET_LABELS[card.set] || card.set,
      text: String(n).padStart(2, "0") + "/" + set.length
    };
  }

  function humShort(card) {
    if (card.hum && card.hum.hz) return card.hum.hz + " Hz";
    if (card.hum && card.hum.motif) return card.hum.motif + " · " + card.hum.beats + " beats";
    return "—";
  }

  function pips(n) { return "●".repeat(n) + "○".repeat(3 - n); }

  function bannerEl(name, chipText, chipLabel, chipCls) {
    var banner = el("div", "tcard__banner");
    banner.appendChild(el("span", "tcard__name codex-card__name", name));
    var chip = el("span", "tcard__chip" + (chipCls ? " " + chipCls : ""), chipText);
    if (chipLabel) { chip.title = chipLabel; chip.setAttribute("aria-label", chipLabel); }
    banner.appendChild(chip);
    return banner;
  }

  function typeEl(left, right) {
    var type = el("div", "tcard__type");
    type.append(el("span", "tcard__typeline", left), el("span", "tcard__setno", right));
    return type;
  }

  function stampsEl(left, right) {
    var stamps = el("div", "tcard__stamps");
    stamps.append(el("span", "tcard__stamp", left), el("span", "tcard__stamp", right));
    return stamps;
  }

  function foundStamp(copy) {
    var f = copy.lineage.found;
    return (f.moon ? "Moon " + f.moon : "Moon —") +
      " · PD " + (f.patternDay != null ? f.patternDay : "—");
  }

  function frontFace(card, copy, tint) {
    var front = el("div", "tcard__side tcard__front codex-card__face" + (card.set === "words" ? " tcard__front--word" : ""));
    var mark = rarityMark(card);
    var num = setNumber(card);
    front.appendChild(bannerEl(card.name, mark.glyph, "Rarity: " + mark.label, "tcard__chip--rarity"));
    var art = el("div", "tcard__art" + (card.set === "kinds" ? " codex-card__face--kindred-motion" : ""));
    art.innerHTML = Cards.cardArtSVG(card, { hue: tint });
    // Day-true face: a Moon card answers the real day, as a ribbon
    // across its artwork window.
    if (card.set === "moons" && TODAY.moon) {
      art.appendChild(el("p", "codex-card__today",
        TODAY.moon === card.moonAffinity[0]
          ? "Its Moon is today — Day " + (TODAY.dayOfMoon || "—") + " of " + moonName(TODAY.moon)
          : "Today stands in " + moonName(TODAY.moon)));
    }
    front.appendChild(art);
    front.appendChild(typeEl(card.element + " · " + card.sub, num.text));
    var text = el("div", "tcard__text" + (card.set === "words" ? " tcard__text--dense" : ""));
    text.appendChild(el("p", "tcard__essence codex-card__essence", card.essence));
    front.appendChild(text);
    var stats = el("div", "tcard__stats");
    stats.append(el("span", null, "Hum · " + humShort(card)), el("span", null, "Res " + pips(card.resonance)));
    front.appendChild(stats);
    front.appendChild(stampsEl(card.edition.name, foundStamp(copy)));
    return front;
  }

  function backFace(card) {
    var back = el("div", "tcard__side tcard__back");
    var num = setNumber(card);
    back.appendChild(bannerEl(card.name, "Game face", null, "tcard__chip--game"));
    back.appendChild(gameFace(card));
    back.appendChild(stampsEl(num.label, num.text));
    return back;
  }

  function silhouetteFace(card, note) {
    var front = el("div", "tcard__side tcard__front codex-card__face tcard__front--dim" + (card.set === "words" ? " tcard__front--word" : ""));
    var mark = rarityMark(card);
    var num = setNumber(card);
    front.appendChild(bannerEl(card.name, mark.glyph, "Rarity: " + mark.label, "tcard__chip--rarity"));
    var art = el("div", "tcard__art");
    art.innerHTML = Cards.cardArtSVG(card, { dim: true });
    front.appendChild(art);
    front.appendChild(typeEl(card.element + " · " + card.sub, num.text));
    var text = el("div", "tcard__text");
    text.appendChild(el("p", "codex-card__stamp", note));
    front.appendChild(text);
    front.appendChild(stampsEl(num.label, num.text));
    return front;
  }

  var renderedTiles = [];

  function cardTile(card) {
    var copy = store ? store.copyFor(card.id) : null;
    var held = !!(copy && copy.state === "held");
    var tile = el("article", "codex-card" + (held ? "" : " codex-card--missing"));
    var stage = el("div", "tcard");
    var inner = el("div", "tcard__inner");
    stage.appendChild(inner);
    tile.appendChild(stage);
    if (held) {
      var tint = card.seedVariant && companion ? companion.hue : null;
      var front = frontFace(card, copy, tint);
      var back = backFace(card);
      inner.append(front, back);
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
      front.addEventListener("click", function () { soundCard(card); doFlip(); });
      back.addEventListener("click", function () { soundCard(card); doFlip(); });
      front.style.cursor = "pointer";
      back.style.cursor = "pointer";
      var controls = el("div", "codex-card__controls");
      controls.append(flip, linBtn);
      tile.append(controls,
        el("p", "codex-card__stamp codex-card__affordance",
          "Tap the card to hear it and turn it · hold it for its lineage"),
        panel);
      wireHold(tile, panel);
      renderedTiles.push({ card: card, tile: tile });
    } else if (copy && copy.state === "traded-away") {
      inner.appendChild(silhouetteFace(card,
        "This copy moved on — its line is kept below, with the tombstones."));
    } else {
      var hint = card.set === "moons"
        ? "Of Moon " + card.moonAffinity[0] + " — witness a day in this Moon, on the Moons page."
        : card.set === "words"
          ? "Hear the word sounded on its own study page."
          : "The kinds are met on their own roads — adoption, play, and greetings; those roads are still being built.";
      inner.appendChild(silhouetteFace(card, hint));
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
    var kindCard = Cards.cardById("kind-" + fc.kind);
    var stage = el("div", "tcard");
    var inner = el("div", "tcard__inner");
    stage.appendChild(inner);
    tile.appendChild(stage);

    var front = el("div", "tcard__side tcard__front codex-card__face");
    front.appendChild(bannerEl("The First Card", "✦ Never tradable", "Never tradable, never sold, never reissued", "tcard__chip--seal"));
    var art = el("div", "tcard__art");
    art.innerHTML = Cards.firstCardArtSVG(fc);
    front.appendChild(art);
    front.appendChild(typeEl(
      (fc.sparkName ? fc.sparkName + " · " : "") + fc.kindName + " Spark · The Meeting", "1 of 1"));
    var text = el("div", "tcard__text");
    text.appendChild(el("p", "tcard__essence codex-card__essence",
      "The card of the meeting itself — met in " + fc.moonName + ", Pattern Day " + fc.patternDay + "."));
    front.appendChild(text);
    var stats = el("div", "tcard__stats");
    stats.append(el("span", null, "Hum · " + (kindCard ? humShort(kindCard) : "—")),
      el("span", null, "Heart · wild harmony"));
    front.appendChild(stats);
    front.appendChild(stampsEl(Cards.FIRST_CARD.edition.name,
      "Met · " + fc.moonName + " · PD " + fc.patternDay));
    inner.appendChild(front);

    var back = el("div", "tcard__side tcard__back");
    back.appendChild(bannerEl("The First Card", "Game face", null, "tcard__chip--game"));
    var game = el("div", "codex-card__game");
    var dl = document.createElement("dl");
    [["Kind", fc.kindName],
     ["Moon of the meeting", "Moon " + fc.moon + " · " + fc.moonName],
     ["Hum", kindCard ? humText(kindCard) : "—"],
     ["At the table", "the heart — a wild harmony in its Spark's kind, once per match"],
     ["Tradable", "Never — struck at the meeting, kept for good"]].forEach(function (row) {
      dl.append(el("dt", null, row[0]), el("dd", null, row[1]));
    });
    game.appendChild(dl);
    back.appendChild(game);
    back.appendChild(stampsEl("The Meeting", "1 of 1"));
    inner.appendChild(back);

    var flip = el("button", "codex-card__flip", "See the game face");
    flip.type = "button";
    var doFlip = function () {
      tile.classList.toggle("is-game");
      flip.textContent = tile.classList.contains("is-game") ? "See the collection face" : "See the game face";
    };
    flip.addEventListener("click", doFlip);
    if (kindCard) {
      front.style.cursor = "pointer";
      back.style.cursor = "pointer";
      front.addEventListener("click", function () { soundCard(kindCard); doFlip(); });
      back.addEventListener("click", function () { soundCard(kindCard); doFlip(); });
    }
    var controls = el("div", "codex-card__controls");
    controls.appendChild(flip);
    tile.append(controls,
      el("p", "codex-card__stamp",
        "A keepsake of the meeting. Never sold, never traded, never reissued · " + fc.instanceId),
      el("p", "codex-card__stamp codex-card__affordance", "Tap the card to hear its kind sound and turn it"));
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

  /* The Table (stage 2 of the card order) loads lazily, the
   * living layer's own way: the album stands first, and the
   * match module and its styles ride in behind it, so the
   * page's first load does not carry the game. */
  (function loadTable() {
    if (!document.querySelector("[data-card-match]")) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "assets/css/codex-card-match.css?v=20261126-1";
    document.head.appendChild(link);
    var script = document.createElement("script");
    script.src = "assets/js/codex-card-match.js?v=20261126-1";
    script.defer = true;
    document.head.appendChild(script);
  })();
})();
