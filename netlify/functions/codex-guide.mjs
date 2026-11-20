/*
 * The Codex Guide — talking rung endpoint (Rung 3).
 *
 * Served by Netlify at /.netlify/functions/codex-guide on
 * codexofreality.org only. The GitHub Pages mirror has no functions;
 * there, the Guide page stays exactly the record-only Guide (Rung 2)
 * and this endpoint simply does not answer.
 *
 *   GET   -> the Guide's public state: whether talking is switched
 *            on, the rulebook version, and the month's meter.
 *   POST  -> { question, history? } -> { mode, answer, sources }
 *
 * The provider key, model, and ceiling come from the environment
 * Aaron sets in Netlify. No key = record-only mode, stated plainly.
 * If the durable meter (Netlify Blobs) cannot be reached, talking
 * stays off — the Guide will not spend against a meter it cannot
 * read. The rulebook is loaded from lib/codex-guide-rulebook.md and
 * its SHA-256 must match the approved hash in guide-config.mjs, or
 * talking stays off.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RULEBOOK_SHA256, readConfig } from "./lib/guide-config.mjs";
import {
  candidateCorpusRoots,
  corpusRootExists,
  loadCorpusFromDisk,
  loadCorpusFromHttp
} from "./lib/guide-corpus.mjs";
import { createGuide, createHttpProvider } from "./lib/guide-core.mjs";
import { createProductionStore } from "./lib/guide-store.mjs";

let guidePromise = null;

function loadRulebook() {
  const candidates = [];
  if (process.env.GUIDE_RULEBOOK_PATH) candidates.push(process.env.GUIDE_RULEBOOK_PATH);
  const here = path.dirname(fileURLToPath(import.meta.url));
  candidates.push(path.join(here, "lib", "codex-guide-rulebook.md"));
  candidates.push(path.join(here, "netlify", "functions", "lib", "codex-guide-rulebook.md"));
  candidates.push(path.join(process.cwd(), "netlify", "functions", "lib", "codex-guide-rulebook.md"));

  for (const candidate of candidates) {
    try {
      const text = fs.readFileSync(candidate, "utf8");
      const hash = createHash("sha256").update(text, "utf8").digest("hex");
      return { text, ok: hash === RULEBOOK_SHA256 };
    } catch {
      /* try the next candidate */
    }
  }
  return { text: "", ok: false };
}

async function loadCorpus(origin) {
  for (const root of candidateCorpusRoots(new URL("./lib/guide-corpus.mjs", import.meta.url))) {
    if (corpusRootExists(root)) {
      try {
        return loadCorpusFromDisk(root);
      } catch {
        /* fall through to the next root, then to HTTP */
      }
    }
  }
  if (origin) return loadCorpusFromHttp(origin);
  throw new Error("The Guide's record could not be loaded.");
}

async function buildGuide(origin) {
  const config = readConfig(process.env);
  const rulebook = loadRulebook();
  const corpus = await loadCorpus(origin);

  let store = null;
  try {
    store = await createProductionStore();
  } catch {
    store = null; // fail closed: record-only, stated in status
  }

  const provider = config.apiKey ? createHttpProvider(config) : null;

  return createGuide({
    config,
    store,
    corpus,
    provider,
    rulebookText: rulebook.text,
    rulebookOk: rulebook.ok
  });
}

function getGuide(origin) {
  if (!guidePromise) {
    guidePromise = buildGuide(origin).catch(error => {
      guidePromise = null; // let a later request try again
      throw error;
    });
  }
  return guidePromise;
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
  const origin = new URL(req.url).origin;

  try {
    const guide = await getGuide(origin);

    if (req.method === "GET") {
      return json(await guide.status());
    }

    if (req.method === "POST") {
      let payload;
      try {
        payload = await req.json();
      } catch {
        return json({ mode: "invalid", answer: "That question could not be read.", sources: [] }, 400);
      }

      const result = await guide.ask({
        question: payload?.question,
        history: payload?.history,
        visitorKey: visitorKeyFor(req, context)
      });

      return json(result, result.httpStatus || 200);
    }

    return json({ mode: "invalid", answer: "Method not allowed.", sources: [] }, 405);
  } catch {
    return json(
      {
        mode: "record-only",
        talkingEnabled: false,
        answer:
          "The Guide could not reach its record just now. The ask-the-record Guide on this page still works — it searches the same record here in your browser.",
        sources: []
      },
      500
    );
  }
}
