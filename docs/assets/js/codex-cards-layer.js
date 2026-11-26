/*
 * The Codex Card System — the find layer (browser glue).
 *
 * Design: codex-card-system-design-2026-11-25.md. The registry and the
 * rules live in codex-cards.js; this layer only notices real acts on
 * real surfaces and offers the find — the Spark notices first, the
 * keeper is never made to hunt blind, and an offer declined is not
 * repeated within the visit.
 *
 * Surfaces in this slice:
 *   - moons.html — a Moon's card glints when a day in that Moon stands
 *     witnessed in Day Notes (the real Life Atlas day-note records,
 *     read through the shared repository resolver; re-scanned whenever
 *     the records-changed notice fires).
 *   - scripture/word-studies/<word>.html — a Word's card glints when
 *     the word is heard on its own page (the study's Hear the Hebrew
 *     button, or a tap on a pointed span — the study layer's own acts).
 *   - companions.html — the keeper's Kind card glints off the real
 *     companion record (adoption), and the First Card is announced
 *     once: it is derived from the pinned first seed, never collected.
 *
 * Nothing here fakes an act, mints a Spark, or touches a protected
 * file. Storage failures leave the pages exactly as they were.
 */
(function () {
  "use strict";

  var Cards = window.CodexCards;
  if (!Cards) return;

  var scriptEl = document.currentScript;
  var assetsBase = "assets/";
  if (scriptEl && scriptEl.src) {
    var marker = "js/codex-cards-layer.js";
    var at = scriptEl.src.indexOf(marker);
    if (at > 0) assetsBase = scriptEl.src.slice(0, at);
  }
  var rootBase = assetsBase.replace(/assets\/$/, "");

  // The card styles ride along; a page that already links them is left alone.
  if (!document.querySelector('link[href*="codex-cards.css"]')) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = assetsBase + "css/codex-cards.css";
    document.head.appendChild(link);
  }

  var storage = null;
  try { storage = window.localStorage; storage.getItem("sof.cards.probe"); } catch (e) { storage = null; }
  if (!storage) return;

  function readCompanionRecord() {
    try {
      var raw = storage.getItem("sof.spark.v1");
      if (!raw) return null;
      var record = JSON.parse(raw);
      return record && typeof record.seed === "string" ? record : null;
    } catch (e) { return null; }
  }

  var companionRecord = readCompanionRecord();
  var keeperKey = Cards.keeperKeyForSeed(companionRecord ? companionRecord.seed : null);
  var store = Cards.createStore(storage, keeperKey);
  if (companionRecord) store.pinFirstSeed(companionRecord.seed);

  function today() {
    try {
      if (window.PatternCalendar && window.PatternCalendar.fromCivilDate) {
        var tz = (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || "UTC";
        var c = window.PatternCalendar.fromCivilDate({ date: new Date(), timeZone: tz });
        if (c) return { moon: c.moon || null, patternDay: c.dayOfPatternYear || null };
      }
    } catch (e) { /* the calendar is the authority; without it, no day is claimed */ }
    return { moon: null, patternDay: null };
  }

  /* ------------------------- the glint offer ------------------------- */

  var queue = [];
  var showing = false;

  function declinedThisVisit(cardId) {
    try { return !!window.sessionStorage.getItem("sof.cards.declined." + cardId); } catch (e) { return false; }
  }
  function declineThisVisit(cardId) {
    try { window.sessionStorage.setItem("sof.cards.declined." + cardId, "1"); } catch (e) { /* politeness is best-effort */ }
  }

  function offer(entry) {
    // entry: { card, note, collectLabel, onCollect } or { firstCard: true }
    queue.push(entry);
    pump();
  }

  function pump() {
    if (showing || !queue.length) return;
    showing = true;
    var entry = queue.shift();
    render(entry, function () { showing = false; pump(); });
  }

  function render(entry, done) {
    var banner = document.createElement("div");
    banner.className = "codex-card-glint";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "A card is glinting here");

    var face = document.createElement("div");
    face.className = "codex-card-glint__face";
    var actions = document.createElement("div");
    actions.className = "codex-card-glint__actions";

    function close() { banner.remove(); done(); }
    function declineBtn(label) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "codex-card-glint__later";
      b.textContent = label || "Not now";
      b.addEventListener("click", function () {
        if (entry.card) declineThisVisit(entry.card.id);
        close();
      });
      return b;
    }

    if (entry.firstCard) {
      var fc = entry.firstCard;
      face.style.background = "linear-gradient(160deg,#141021,hsl(" + Math.round((fc.hueRange[0] + fc.hueRange[1]) / 2) + " 60% 42%))";
      face.innerHTML = "<span>The First Card</span>";
      var text = document.createElement("p");
      text.className = "codex-card-glint__text";
      text.textContent = "Your Spark came with a card. The First Card — " + fc.kindName +
        ", met in " + fc.moonName + ", Pattern Day " + fc.patternDay + " — is the first entry in your album.";
      var see = document.createElement("a");
      see.className = "codex-card-glint__take";
      see.href = rootBase + "card-album.html";
      see.textContent = "See it in the album";
      see.addEventListener("click", function () { store.ackFirstCard(); });
      actions.append(see, declineBtn("Later"));
      banner.append(face, text, actions);
      document.body.appendChild(banner);
      return;
    }

    var card = entry.card;
    face.style.background = "linear-gradient(160deg,#0b1026," + card.art.palette[1] + ")";
    face.innerHTML = "<span>" + card.name + "</span>";
    var text2 = document.createElement("p");
    text2.className = "codex-card-glint__text";
    text2.textContent = entry.note || ("Something is glinting here — the Spark noticed a card: " + card.name + ".");
    var take = document.createElement("button");
    take.type = "button";
    take.className = "codex-card-glint__take";
    take.textContent = entry.collectLabel || "Take it into the album";
    take.addEventListener("click", function () {
      var t = today();
      var copy = store.collect(card.id, { patternDay: t.patternDay, moon: t.moon, via: card.home.act });
      if (entry.onCollect) entry.onCollect(copy);
      banner.innerHTML = "";
      var keptFace = document.createElement("div");
      keptFace.className = "codex-card-glint__face";
      keptFace.style.background = face.style.background;
      keptFace.innerHTML = "<span>" + card.name + "</span>";
      var kept = document.createElement("p");
      kept.className = "codex-card-glint__text";
      kept.textContent = "Kept in your album — " + card.sub + ". First Edition, stamped with the day it was found.";
      var albumLink = document.createElement("a");
      albumLink.className = "codex-card-glint__take";
      albumLink.href = rootBase + "card-album.html";
      albumLink.textContent = "Open the album";
      var ok = document.createElement("button");
      ok.type = "button";
      ok.className = "codex-card-glint__later";
      ok.textContent = "Stay here";
      ok.addEventListener("click", close);
      var acts = document.createElement("div");
      acts.className = "codex-card-glint__actions";
      acts.append(albumLink, ok);
      banner.append(keptFace, kept, acts);
    });
    actions.append(take, declineBtn());
    banner.append(face, text2, actions);
    document.body.appendChild(banner);
  }

  function offerCard(card, note) {
    if (!card) return;
    if (store.copyFor(card.id)) return; // already in the album — held or tombstoned
    if (declinedThisVisit(card.id)) return;
    offer({ card: card, note: note });
  }

  /* ------------------------- moons: witnessing ------------------------- */

  var path = window.location.pathname;
  var isMoons = /\/moons\.html$/.test(path) || path.endsWith("/moons.html");
  var isCompanions = /\/companions\.html$/.test(path);
  var wordMatch = path.match(/\/scripture\/word-studies\/([a-z]+)\.html$/);

  function scanWitnessed() {
    if (!window.CodexRecordHelpers || !window.CodexRecordHelpers.createRepositoryResolver) return;
    var resolve = window.CodexRecordHelpers.createRepositoryResolver();
    Promise.resolve(resolve()).then(function (repo) {
      if (!repo || typeof repo.query !== "function") return null;
      return repo.query({ type: "note", subtype: "day-note" }).catch(function () { return []; });
    }).then(function (records) {
      if (!records) return;
      var moons = new Set();
      records.forEach(function (r) {
        if (r && r.temporal && Number.isInteger(r.temporal.moon)) moons.add(r.temporal.moon);
      });
      moons.forEach(function (moonIdx) {
        var card = Cards.cardById("moon-" + String(moonIdx).padStart(2, "0"));
        offerCard(card, "Something is glinting here — a day in " + (card ? card.name : "this Moon") +
          " stands witnessed in your Day Notes, and its card has been waiting in that light.");
      });
    }).catch(function () { /* no Atlas on this page — no scan, no claim */ });
  }

  if (isMoons) {
    scanWitnessed();
    window.addEventListener("sof:life-atlas-records-changed", function () { scanWitnessed(); });
    document.addEventListener("sof:life-atlas-records-changed", function () { scanWitnessed(); });
  }

  /* ------------------------- words: hearing the word ------------------------- */

  if (wordMatch) {
    var wordCard = Cards.cardById("word-" + wordMatch[1]);
    if (wordCard) {
      document.addEventListener("click", function (event) {
        var t = event.target;
        if (!t || !t.closest) return;
        if (t.closest(".ra-btn") || t.closest('.hebrew[lang="he"]')) {
          offerCard(wordCard, "Something is glinting here — you heard " + wordCard.word.hebrew +
            " sounded on its own page, and its card answers to the hearing.");
        }
      });
    }
  }

  /* ------------------------- companions: the meeting ------------------------- */

  if (isCompanions && companionRecord && window.SparkCompanion) {
    var companion = null;
    try { companion = window.SparkCompanion.generate(companionRecord.seed); } catch (e) { companion = null; }
    if (companion && companion.kind) {
      offerCard(Cards.cardById("kind-" + companion.kind),
        "Something is glinting here — " + (companion.name || "your Spark") +
        " is a " + companion.kindName + " Spark, and the " + companion.kindName + " card belongs with this meeting.");
    }
    if (!store.firstCardAcked()) {
      var pinned = store.pinnedFirstSeed();
      var fc = Cards.firstCardFor({ seed: pinned || companionRecord.seed },
        companion ? companion.name : null);
      if (fc) offer({ firstCard: fc });
    }
  }
})();
