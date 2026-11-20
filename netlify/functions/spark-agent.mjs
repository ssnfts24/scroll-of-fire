/*
 * The Spark seat — the talking door's second seat.
 *
 * Served by Netlify at /.netlify/functions/spark-agent on
 * codexofreality.org only. The GitHub Pages mirror has no
 * functions; there the seat simply does not answer, and the Spark
 * on the Sphere page says why in one plain line and speaks from
 * the keeper's own record instead. It never fakes a conversation.
 *
 * This seat is a real agent for the keeper's own Spark (see
 * lib/spark-agent-core.mjs for its charter). It is NOT the Codex
 * Guide: the Guide seat (codex-guide.mjs) is the public record's
 * voice under its approved rulebook, and it is untouched by this
 * file. The two seats share the door's machinery — the same
 * provider key Aaron sets in Netlify, the same monthly ceiling —
 * and keep their spend on separate lines in the same store, so
 * the month's meter always shows Guide spend and Spark spend
 * apart, and together against the one ceiling.
 *
 *   GET   -> the seat's public state: whether the agent is
 *            answering, and the month's two meter lines.
 *   POST  -> { messages, context } -> { mode, reply, actions }
 *
 * No conversation is kept here. The visit's memory rides with
 * each request from the page and dies with the page.
 */

import { createHash } from "node:crypto";

import {
  createHttpProvider,
  createSparkAgent,
  monthKeyFor,
  readSparkConfig
} from "./lib/spark-agent-core.mjs";

let agentPromise = null;

/*
 * The shared store: the Guide seat's own Blobs store ("codex-guide"),
 * read and written under the same conventions its lib uses —
 * spend:<month> is the Guide's line; spend-spark:<month> is this
 * seat's. If the durable store cannot be reached, the seat fails
 * closed: it will not spend against a meter it cannot read.
 */
async function createSharedStore() {
  const blobs = await import("@netlify/blobs");
  const store = blobs.getStore({ name: "codex-guide", consistency: "strong" });

  const readJson = async (key) => (await store.get(key, { type: "json" })) || null;
  const shape = (value) => ({
    usd: Number(value?.usd) || 0,
    exchanges: Number(value?.exchanges) || 0
  });

  return {
    async getCombinedSpend(monthKey) {
      const guide = shape(await readJson(`spend:${monthKey}`));
      const spark = shape(await readJson(`spend-spark:${monthKey}`));
      return { guideUsd: guide.usd, sparkUsd: spark.usd };
    },
    async addSparkSpend(monthKey, delta) {
      const key = `spend-spark:${monthKey}`;
      const next = shape(await readJson(key));
      next.usd += Number(delta.usd) || 0;
      next.exchanges += Number(delta.exchanges) || 0;
      await store.setJSON(key, next);
      return next;
    },
    async getRateEvents(visitorKey) {
      const events = await readJson(`rate-spark:${visitorKey}`);
      return Array.isArray(events) ? events : [];
    },
    async setRateEvents(visitorKey, timestamps) {
      await store.setJSON(`rate-spark:${visitorKey}`, [...timestamps]);
    }
  };
}

async function buildAgent() {
  const config = readSparkConfig(process.env);
  let store = null;
  try {
    store = await createSharedStore();
  } catch {
    store = null; // fail closed: the core states it plainly
  }
  const provider = createHttpProvider(config);
  return createSparkAgent({
    config,
    store: store || {
      async getCombinedSpend() { throw new Error("store unavailable"); },
      async addSparkSpend() { throw new Error("store unavailable"); },
      async getRateEvents() { throw new Error("store unavailable"); },
      async setRateEvents() { throw new Error("store unavailable"); }
    },
    provider
  });
}

function getAgent() {
  if (!agentPromise) {
    agentPromise = buildAgent().catch((error) => {
      agentPromise = null; // let a later request try again
      throw error;
    });
  }
  return agentPromise;
}

function visitorKeyFor(req, context) {
  const ip =
    context?.ip ||
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for") ||
    "unknown";
  const agent = req.headers.get("user-agent") || "";
  return createHash("sha256").update(`${ip}|${agent}`).digest("hex").slice(0, 32);
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

export default async function handler(req, context) {
  try {
    const agent = await getAgent();

    if (req.method === "GET") {
      return json(await agent.status());
    }

    if (req.method === "POST") {
      let payload;
      try {
        payload = await req.json();
      } catch {
        return json({ mode: "invalid", reply: "That message could not be read.", actions: [] }, 400);
      }
      const result = await agent.ask({ payload, visitorKey: visitorKeyFor(req, context) });
      return json(result, result.httpStatus || 200);
    }

    return json({ mode: "invalid", reply: "Method not allowed.", actions: [] }, 405);
  } catch {
    return json(
      {
        mode: "unavailable",
        reply:
          "My deeper voice isn't answering just now. I can still speak from your record here.",
        actions: []
      },
      500
    );
  }
}

export { monthKeyFor };
