/*
 * Aiyana's story waiting place — the accept flow, proven end
 * to end against the DOUBLE store (MemoryStoryStore, an
 * in-process implementation of the Blobs store's own
 * interface). These are double proofs: the live-Blobs proof
 * rides the deploy, the way the Guide seat's store did. No
 * gate words appear here that are Aiyana's real ones — the
 * test words are test words.
 *
 * What is proven: a submitted story is pending and appears
 * NOWHERE public; the public list carries only approved
 * stories; the dashboard will not speak without the gate;
 * the gate wants her three words in her order; her YES
 * publishes; her NOT YET puts a story away — out of every
 * list the page reads, still held, and restorable; a
 * submission carries a pen name, a title, and a story, and
 * nothing else about the child who wrote it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MemoryStoryStore,
  createWaitingPlace,
  readDashWords
} from "../netlify/functions/lib/aiyana-stories-core.mjs";
import { textIsClean } from "../netlify/functions/lib/aiyana-language-guard.mjs";

const WORDS = ["butterfly", "moon", "rainbow"];
const PARENT = "test-parent-code";
let clock = 1_700_000_000_000;
let seq = 0;

function freshPlace() {
  clock = 1_700_000_000_000;
  return createWaitingPlace({
    store: new MemoryStoryStore(),
    dashWords: WORDS,
    parentCode: PARENT,
    now: () => clock,
    makeId: () => `story-${++seq}`
  });
}

async function gateIn(place) {
  const r = await place.gate(WORDS, "tester");
  assert.equal(r.ok, true);
  return r.token;
}

test("a submitted story waits, and appears nowhere public", async () => {
  const place = freshPlace();
  const r = await place.submit(
    { penName: "StarFox", title: "The Brave Little Boat", story: "Once there was a boat." },
    "visitor-1"
  );
  assert.equal(r.ok, true);
  assert.deepEqual(await place.approvedList(), []);
  const token = await gateIn(place);
  const dash = await place.dashboardList(token);
  assert.equal(dash.pending.length, 1);
  assert.equal(dash.pending[0].title, "The Brave Little Boat");
  assert.equal(dash.pending[0].penName, "StarFox");
  assert.equal(dash.approved.length, 0);
});

test("only her YES publishes a story", async () => {
  const place = freshPlace();
  const { id } = await place.submit({ penName: "Pip", title: "T", story: "S" }, "v");
  const token = await gateIn(place);
  assert.deepEqual(await place.approvedList(), []);
  const yes = await place.accept(token, id);
  assert.equal(yes.ok, true);
  const pub = await place.approvedList();
  assert.equal(pub.length, 1);
  assert.equal(pub[0].id, id);
  assert.equal(pub[0].story, "S");
});

test("her NOT YET puts a story away — held, unlisted, restorable", async () => {
  const place = freshPlace();
  const { id } = await place.submit({ penName: "Pip", title: "T", story: "S" }, "v");
  const token = await gateIn(place);
  const no = await place.putAway(token, id);
  assert.equal(no.ok, true);
  assert.deepEqual(await place.approvedList(), []);
  let dash = await place.dashboardList(token);
  assert.equal(dash.pending.length, 0);
  assert.equal(dash.away.length, 1);
  const back = await place.restore(token, id);
  assert.equal(back.ok, true);
  dash = await place.dashboardList(token);
  assert.equal(dash.pending.length, 1);
  assert.equal(dash.away.length, 0);
});

test("the dashboard will not speak without the gate", async () => {
  const place = freshPlace();
  await place.submit({ penName: "Pip", title: "T", story: "S" }, "v");
  assert.equal((await place.dashboardList("")).ok, false);
  assert.equal((await place.dashboardList("9999999999999.forged")).ok, false);
  assert.equal((await place.accept("", "story-1")).ok, false);
  assert.equal((await place.putAway(null, "story-1")).ok, false);
});

test("the gate wants her three words, in her order", async () => {
  const place = freshPlace();
  assert.equal((await place.gate(["moon", "butterfly", "rainbow"], "v")).ok, false);
  assert.equal((await place.gate(["butterfly", "moon"], "v")).ok, false);
  assert.equal((await place.gate(["butterfly", "moon", "rainbow"], "v")).ok, true);
  assert.equal((await place.gate([" Butterfly ", "MOON", "Rainbow"], "v")).ok, true);
});

test("without gate words set, the dashboard side is not-ready and closed", async () => {
  const place = createWaitingPlace({
    store: new MemoryStoryStore(),
    dashWords: readDashWords({}),
    now: () => clock,
    makeId: () => "story-x"
  });
  assert.equal(place.gateReady, false);
  assert.equal((await place.gate(WORDS, "v")).reason, "not-ready");
  assert.equal((await place.dashboardList("anything")).ok, false);
  /* …but a story can still be sent to the waiting place. */
  assert.equal((await place.submit({ penName: "Pip", title: "T", story: "S" }, "v")).ok, true);
});

test("an empty story is refused; a missing pen name becomes 'a friend'", async () => {
  const place = freshPlace();
  assert.equal((await place.submit({ penName: "Pip", title: "T", story: "   " }, "v")).ok, false);
  const r = await place.submit({ title: "No name", story: "Words." }, "v");
  assert.equal(r.ok, true);
  const token = await gateIn(place);
  const dash = await place.dashboardList(token);
  assert.equal(dash.pending[0].penName, "a friend");
});

test("a submission carries a pen name, a title, and a story — nothing else", async () => {
  const place = freshPlace();
  await place.submit(
    { penName: "Pip", title: "T", story: "S", email: "kid@example.com", realName: "Real Kid", where: "home" },
    "v"
  );
  const token = await gateIn(place);
  const dash = await place.dashboardList(token);
  assert.deepEqual(Object.keys(dash.pending[0]).sort(), ["id", "penName", "story", "title", "ts"]);
});

test("long submissions are trimmed to the fence, never stored whole", async () => {
  const place = freshPlace();
  const big = "x".repeat(9000);
  await place.submit({ penName: "P".repeat(200), title: "T".repeat(300), story: big }, "v");
  const token = await gateIn(place);
  const dash = await place.dashboardList(token);
  assert.ok(dash.pending[0].story.length <= 2000);
  assert.ok(dash.pending[0].penName.length <= 40);
  assert.ok(dash.pending[0].title.length <= 80);
});

test("a session dies with its hours", async () => {
  const place = freshPlace();
  const token = await gateIn(place);
  assert.equal((await place.dashboardList(token)).ok, true);
  clock += 13 * 60 * 60 * 1000;
  assert.equal((await place.dashboardList(token)).ok, false);
});

/* ---------------- The language guard ---------------- */

test("guard: a clean story passes, word for word", () => {
  assert.equal(textIsClean("Once upon a time, a brave little boat sailed to an island of butterflies."), true);
  assert.equal(textIsClean("Hello! My class planted grass and saw a peacock at the canal."), true);
  assert.equal(textIsClean("The therapist said the shiitake mushrooms grow near the old mill."), true);
  assert.equal(textIsClean("We read Moby Dick and counted the sextant stars."), true);
  /* innocent joins across real words are not spacing tricks */
  assert.equal(textIsClean("Once there was a brave little boat. It sailed past the moon and came home for breakfast."), true);
  assert.equal(textIsClean("that it is so great, an italian boat"), true);
});

test("guard: bad words are caught, plain and disguised", () => {
  assert.equal(textIsClean("this story has a shit word in it"), false);
  assert.equal(textIsClean("fuuuck this"), false);
  assert.equal(textIsClean("sh1t happens"), false);
  assert.equal(textIsClean("f u c k off"), false);
  assert.equal(textIsClean("a $ $ h o l e"), false);
  assert.equal(textIsClean("damn the torpedoes"), false);
});

test("guard: a bad story is held — Aiyana never sees it, the sender hears 'words-to-fix'", async () => {
  const place = freshPlace();
  const r = await place.submit({ penName: "Pip", title: "T", story: "a nice start then shit ruins it" }, "v");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "words-to-fix");
  const token = await gateIn(place);
  const dash = await place.dashboardList(token);
  assert.equal(dash.pending.length, 0);
  assert.equal(dash.approved.length, 0);
  assert.deepEqual(await place.approvedList(), []);
  const held = await place.heldList(PARENT);
  assert.equal(held.ok, true);
  assert.equal(held.held.length, 1);
  assert.equal(held.held[0].story.includes("shit"), true);
});

test("guard: bad words in the pen name or the title are held too", async () => {
  const place = freshPlace();
  assert.equal((await place.submit({ penName: "lil bitch", title: "T", story: "clean words here" }, "v")).reason, "words-to-fix");
  assert.equal((await place.submit({ penName: "Pip", title: "my damn story", story: "clean words here" }, "v")).reason, "words-to-fix");
  const held = await place.heldList(PARENT);
  assert.equal(held.held.length, 2);
});

test("guard: the held shelf opens only to the parent code", async () => {
  const place = freshPlace();
  await place.submit({ penName: "Pip", title: "T", story: "shit" }, "v");
  assert.equal((await place.heldList("")).ok, false);
  assert.equal((await place.heldList("wrong-code")).ok, false);
  assert.equal((await place.heldList(PARENT)).ok, true);
});

test("guard: a grown-up can release a held story — then it waits for Aiyana like any other", async () => {
  const place = freshPlace();
  await place.submit({ penName: "Pip", title: "T", story: "one shit word in a long kind story" }, "v");
  const held = await place.heldList(PARENT);
  const id = held.held[0].id;
  assert.equal((await place.heldRelease(PARENT, id)).ok, true);
  const token = await gateIn(place);
  const dash = await place.dashboardList(token);
  assert.equal(dash.pending.length, 1);
  /* and her YES can publish it — the grown-up's word stands */
  assert.equal((await place.accept(token, id)).ok, true);
  assert.equal((await place.approvedList()).length, 1);
});

test("guard: a grown-up can put a held story away for good", async () => {
  const place = freshPlace();
  await place.submit({ penName: "Pip", title: "T", story: "shit" }, "v");
  const held = await place.heldList(PARENT);
  const id = held.held[0].id;
  assert.equal((await place.heldAway(PARENT, id)).ok, true);
  assert.equal((await place.heldList(PARENT)).held.length, 0);
  const token = await gateIn(place);
  const dash = await place.dashboardList(token);
  assert.equal(dash.pending.length, 0);
  assert.equal(dash.away.length, 1);
});

test("guard: the way out is watched too — a bad story planted as approved is pulled to held", async () => {
  const store = new MemoryStoryStore();
  const place = createWaitingPlace({
    store, dashWords: WORDS, parentCode: PARENT, now: () => clock, makeId: () => "planted-1"
  });
  await store.set("story:planted-1", {
    id: "planted-1", penName: "Pip", title: "T", story: "shit planted directly",
    status: "approved", ts: clock, decidedTs: 0, parentOk: false
  });
  await store.set("stories:index", ["planted-1"]);
  assert.deepEqual(await place.approvedList(), []);
  assert.equal((await place.heldList(PARENT)).held.length, 1);
});

test("guard: her YES cannot wave a bad story onto the page", async () => {
  const store = new MemoryStoryStore();
  const place = createWaitingPlace({
    store, dashWords: WORDS, parentCode: PARENT, now: () => clock, makeId: () => "planted-2"
  });
  await store.set("story:planted-2", {
    id: "planted-2", penName: "Pip", title: "T", story: "shit planted as pending",
    status: "pending", ts: clock, decidedTs: 0, parentOk: false
  });
  await store.set("stories:index", ["planted-2"]);
  const token = await gateIn(place);
  const r = await place.accept(token, "planted-2");
  assert.equal(r.ok, false);
  assert.deepEqual(await place.approvedList(), []);
});
