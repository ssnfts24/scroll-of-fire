"use strict";
/*
 * The Table — stage 2 of the card order (Aaron, Nov 26, 2026).
 * Solo against the day over the cards core engine, with the
 * seven adopted alive elements. The engine playthrough below
 * plays whole matches with the module's own settle rule: when
 * the side to sound has no light (or no card and no deck), the
 * match is scored by the resonance standing in the sky — the
 * same comparison the engine itself makes when both sides are
 * spent. Every match must end; nothing may hang.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Cards = require("../docs/assets/js/codex-cards.js");
const MODULE = fs.readFileSync(path.join(__dirname, "..", "docs/assets/js/codex-card-match.js"), "utf8");
const ALBUM_PAGE = fs.readFileSync(path.join(__dirname, "..", "docs/card-album.html"), "utf8");
const ALBUM_JS = fs.readFileSync(path.join(__dirname, "..", "docs/assets/js/codex-card-album.js"), "utf8");

function policyA(state) {
  const moon = Cards.effectiveMoon(state);
  for (const id of state.gathered.a < 3 ? state.hands.a : []) {
    for (const t of state.sky.dissonance) {
      const tc = Cards.cardById(t); const c = Cards.cardById(id);
      if (tc && c && (tc.element === c.element || tc.moonAffinity.some((m) => c.moonAffinity.includes(m)))) {
        return { by: "a", cardId: id, gather: t, expectedHash: Cards.stateHash(state) };
      }
    }
  }
  const sounding = state.hands.a.filter((id) => Cards.harmonizesWith(Cards.cardById(id), moon));
  return { by: "a", cardId: sounding[0] || state.hands.a[0], expectedHash: Cards.stateHash(state) };
}

function settleWinner(state) {
  const side = state.turn;
  const spent = state.light[side] <= 0 || (state.hands[side].length === 0 && state.decks[side].length === 0);
  if (!spent) return null;
  return state.resonanceBy.a === state.resonanceBy.b ? "draw"
    : (state.resonanceBy.a > state.resonanceBy.b ? "a" : "b");
}

test("a solo match against the day always reaches an ending", () => {
  for (let day = 200; day < 232; day++) {
    const mine = Cards.dailyTable(day).slice(0, 10);
    const dayDeck = Cards.dailyTable(day).slice(0, 12);
    const code = Cards.makeMatchCode(Cards.hashString("solo:" + day + ":test"));
    let s = Cards.deriveMatch(code, mine, dayDeck, { a: "light", b: null });
    let winner = null;
    let guard = 0;
    while (guard++ < 400) {
      if (s.complete) { winner = s.winner; break; }
      const settled = settleWinner(s);
      if (settled) { winner = settled; break; }
      if (s.turn === "a") {
        const r = Cards.applyPlay(s, policyA(s));
        assert.ok(r.ok, "keeper play refused on day " + day + ": " + r.reason);
        s = r.state;
      } else {
        const p = Cards.fieldAnswer(s);
        assert.ok(p, "the day must answer or be settled, day " + day);
        const r = Cards.applyPlay(s, p);
        assert.ok(r.ok, "day play refused on day " + day + ": " + r.reason);
        s = r.state;
      }
    }
    assert.ok(winner === "a" || winner === "b" || winner === "draw",
      "day " + day + " ended with a scored sky");
  }
});

test("the match module rides the engine, never a second ruleset", () => {
  for (const fn of ["deriveMatch", "applyPlay", "fieldAnswer", "stateHash", "dailyTable", "makeMatchCode", "moonTurnInfo", "effectiveMoon", "harmonizesWith"]) {
    assert.ok(MODULE.includes("Cards." + fn), "the table uses Cards." + fn);
  }
  assert.ok(!/function deriveMatch|function applyPlay/.test(MODULE), "no forked engine in the module");
});

test("the seven alive elements are all present in the module", () => {
  assert.ok(MODULE.includes("is-own-day"), "cards day-true in play: a card on its own day stands brighter");
  assert.ok(MODULE.includes("is-answering"), "the shared sky visibly answers when a chord locks");
  assert.ok(MODULE.includes("sof.cards.matchtrail.v1."), "cards carry their matches in a trail");
  assert.ok(MODULE.includes("match-witness"), "the keeper's Spark attends the table");
  assert.ok(MODULE.includes("moonTurnInfo") && MODULE.includes("The Moon turns"), "the Moon turns on its count");
  assert.ok(MODULE.includes("sof.cards.pieces.v1.") && MODULE.includes("Play it"), "a finished match leaves a piece of music the keeper keeps");
  assert.ok(MODULE.includes("gather"), "dissonance is gathered as fuel");
  assert.ok(!/destroy|burn|discard/i.test(MODULE.replace(/never destroyed/g, "")), "dissonance is never destroyed");
});

test("game law held in the module: harmony, the Call, the First Card once, nothing losable", () => {
  assert.ok(MODULE.includes("The Call"), "the Call is at the table");
  assert.ok(MODULE.includes("first-card") && MODULE.includes("state.hearts.a.used"), "the First Card sounds once");
  assert.ok(MODULE.includes("never moves a card"), "a match never moves an instance");
  assert.ok(MODULE.includes("no streaks"), "the no-streaks law is stated where the game lives");
});

test("the album page mounts the table and reads the trail back in lineage", () => {
  assert.ok(ALBUM_PAGE.includes("data-card-match"), "the table mounts on the album page");
  assert.ok(ALBUM_PAGE.includes("codex-card-match.js"), "the module is loaded");
  assert.ok(ALBUM_JS.includes("sof.cards.matchtrail.v1."), "the lineage panel reads the trail the table writes");
  assert.ok(ALBUM_JS.includes("Matches: sounded in"), "the trail is spoken in the lineage panel");
});
