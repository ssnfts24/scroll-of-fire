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

  function cardTile(card) {
    var copy = store ? store.copyFor(card.id) : null;
    var tile = el("article", "codex-card" + (copy && copy.state === "held" ? "" : " codex-card--missing"));
    var face = el("div", "codex-card__face");
    if (copy && copy.state === "held") {
      var tint = card.seedVariant && companion ? companion.hue : null;
      face.style.background = tint != null
        ? "linear-gradient(160deg,#0b1026,hsl(" + tint + " 62% 40%))"
        : "linear-gradient(160deg,#0b1026," + card.art.palette[1] + ")";
    }
    face.append(el("div", "codex-card__name", card.name), el("div", "codex-card__sub", card.sub));
    tile.appendChild(face);

    var body = el("div", "codex-card__body");
    body.appendChild(el("p", "codex-card__essence", card.essence));
    if (copy && copy.state === "held") {
      var found = copy.lineage.found;
      body.appendChild(el("p", "codex-card__stamp",
        card.edition.name + " · found on Pattern Day " + (found.patternDay != null ? found.patternDay : "—") +
        " · " + copy.instanceId));
      var flip = el("button", "codex-card__flip", "See the game face");
      flip.type = "button";
      flip.addEventListener("click", function () {
        tile.classList.toggle("is-game");
        flip.textContent = tile.classList.contains("is-game") ? "See the collection face" : "See the game face";
      });
      tile.append(body, gameFace(card), flip);
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
    tile.append(face, body);
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
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
