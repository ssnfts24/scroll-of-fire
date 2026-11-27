/*
 * Aiyana's story waiting place — the function's HTTP seat.
 *
 * Served by Netlify at /.netlify/functions/aiyana-stories on
 * codexofreality.org only. The GitHub Pages mirror has no
 * functions; there the story corner on Aiyana's page says in one
 * plain line that sending is resting, and keeps the story on the
 * visitor's own device. It never pretends a story travelled.
 *
 *   GET            -> { ok, gateReady } — is the waiting place up,
 *                     and is Aiyana's dashboard gate set.
 *   GET ?list=approved
 *                  -> { ok, stories } — the ONLY public list:
 *                     stories Aiyana already said yes to.
 *   GET ?list=page -> { ok, page } — the few blocks of her page
 *                     that are hers to change (her welcome
 *                     words, her about-me words, her banner
 *                     colour, her featured story), screened on
 *                     the way out; until she changes them, the
 *                     defaults — her page as it stands today.
 *   POST {action:"submit", penName, title, story}
 *                  -> a new story, held as pending. Public: any
 *                     visitor may send ONE thing to the waiting
 *                     place. Nothing submitted appears anywhere
 *                     until Aiyana's yes.
 *   POST {action:"gate", words:[...]}
 *                  -> her picture-words, in order, for a session.
 *   POST {action:"list"|"accept"|"away"|"restore", token, id?}
 *                  -> the dashboard's moves, session-gated.
 *   POST {action:"write"|"edit-mine"|"publish-mine", token, ...}
 *                  -> her own stories: kept on her shelf, and
 *                     published only by her tap, past the guard.
 *   POST {action:"page-save", token, welcome, about, banner,
 *         featuredId} -> her page blocks, screened before they
 *                     are kept; a tripped save is held whole for
 *                     a grown-up and her live page never moves.
 *
 * The gate words are read from the environment by name
 * (AIYANA_DASH_WORDS — set by Aaron in this host's settings,
 * never in this repo). Without them the dashboard side answers
 * "not-ready" and does nothing. The store is Netlify Blobs
 * (lib/aiyana-stories-core.mjs); if it cannot be reached the
 * seat fails closed rather than faking a waiting place.
 */

import { createHash } from "node:crypto";

import {
  createProductionStoryStore,
  createWaitingPlace,
  readDashWords,
  readParentCode
} from "./lib/aiyana-stories-core.mjs";

let placePromise = null;

async function getPlace() {
  if (!placePromise) {
    placePromise = (async () => {
      const store = await createProductionStoryStore();
      return createWaitingPlace({
        store,
        dashWords: readDashWords(),
        parentCode: readParentCode()
      });
    })();
  }
  return placePromise;
}

/* The visitor's rate-limit key: a hash, never the address itself. */
function whoOf(request) {
  const ip =
    request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export default async function handler(request) {
  let place;
  try {
    place = await getPlace();
  } catch (err) {
    return json({ ok: false, reason: "waiting-place-resting" }, 503);
  }

  const url = new URL(request.url);

  if (request.method === "GET") {
    if (url.searchParams.get("list") === "approved") {
      const stories = await place.approvedList();
      return json({ ok: true, stories });
    }
    if (url.searchParams.get("list") === "page") {
      const page = await place.pagePublic();
      return json({ ok: true, page });
    }
    if (url.searchParams.get("list") === "drawing") {
      const dataUrl = await place.drawingPublic();
      return json({ ok: true, dataUrl });
    }
    return json({ ok: true, gateReady: place.gateReady });
  }

  if (request.method !== "POST") return json({ ok: false, reason: "method" }, 405);

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json({ ok: false, reason: "bad-request" }, 400);
  }

  const who = whoOf(request);
  switch (body?.action) {
    case "submit": {
      const r = await place.submit(body, who);
      return json(r, r.ok ? 200 : 400);
    }
    case "gate": {
      const r = await place.gate(body.words, who);
      return json(r, r.ok ? 200 : 401);
    }
    case "list": {
      const r = await place.dashboardList(body.token);
      return json(r, r.ok ? 200 : 401);
    }
    case "accept": {
      const r = await place.accept(body.token, body.id);
      return json(r, r.ok ? 200 : 401);
    }
    case "away": {
      const r = await place.putAway(body.token, body.id);
      return json(r, r.ok ? 200 : 401);
    }
    case "restore": {
      const r = await place.restore(body.token, body.id);
      return json(r, r.ok ? 200 : 401);
    }
    case "write": {
      const r = await place.writeMine(body.token, body);
      return json(r, r.ok ? 200 : 401);
    }
    case "edit-mine": {
      const r = await place.editMine(body.token, body.id, body);
      return json(r, r.ok ? 200 : 401);
    }
    case "publish-mine": {
      const r = await place.publishMine(body.token, body.id);
      return json(r, r.ok ? 200 : 401);
    }
    case "page-save": {
      const r = await place.pageSave(body.token, body);
      return json(r, r.ok ? 200 : 401);
    }
    case "page-restore": {
      const r = await place.pageRestore(body.token);
      return json(r, r.ok ? 200 : 401);
    }
    case "page-state": {
      const r = await place.pageState(body.token);
      return json(r, r.ok ? 200 : 401);
    }
    case "drawing-save": {
      const r = await place.drawingSave(body.token, body);
      return json(r, r.ok ? 200 : 401);
    }
    case "spark-get": {
      const r = await place.sparkGet(body.token);
      return json(r, r.ok ? 200 : 401);
    }
    case "spark-meet": {
      const r = await place.sparkMeet(body.token, body);
      return json(r, r.ok ? 200 : 401);
    }
    case "spark-save": {
      const r = await place.sparkSave(body.token, body);
      return json(r, r.ok ? 200 : 401);
    }
    case "page-defaults": {
      const r = await place.pageDefaults(body.parentCode);
      return json(r, r.ok ? 200 : 401);
    }
    case "page-held": {
      const r = await place.pageHeldList(body.parentCode);
      return json(r, r.ok ? 200 : 401);
    }
    case "page-held-release": {
      const r = await place.pageHeldRelease(body.parentCode);
      return json(r, r.ok ? 200 : 401);
    }
    case "page-held-away": {
      const r = await place.pageHeldAway(body.parentCode);
      return json(r, r.ok ? 200 : 401);
    }
    case "held-list": {
      const r = await place.heldList(body.parentCode);
      return json(r, r.ok ? 200 : 401);
    }
    case "held-release": {
      const r = await place.heldRelease(body.parentCode, body.id);
      return json(r, r.ok ? 200 : 401);
    }
    case "held-away": {
      const r = await place.heldAway(body.parentCode, body.id);
      return json(r, r.ok ? 200 : 401);
    }
    default:
      return json({ ok: false, reason: "unknown-action" }, 400);
  }
}
