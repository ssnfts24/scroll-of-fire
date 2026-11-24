/**
 * The site Spark's agent backing — Gate G, Phase 4 (G3;
 * gate-g-live-plan-2026-11-24 §4, §5).
 *
 * Working default, plan §8 call 2 → (a) — ASSISTANT-
 * INFERRED, pending Aaron's ratification: ONE agent
 * protocol serves the app Spark and the site Spark in the
 * same phase. This module is the site surface's half of
 * that one protocol: the same grant model, the same named
 * scopes, the same sealed envelopes the app's AgentDoor
 * speaks and the door's agent core verifies
 * (netlify/functions/lib/agent-core.mjs). One protocol,
 * proven once, on both surfaces.
 *
 * What this module is: a pure protocol client. Given a
 * grant the keeper made (its tokenId and the pairing
 * secret the keeper carried to this surface — shown once
 * at granting, held by the keeper, never stored by this
 * module beyond the session it is handed in), it builds
 * sealed envelopes, carries them to the door's agent seat,
 * and opens the door's sealed replies. It holds no record
 * and no memory: the Spark's seed-keyed memory on this
 * surface stays where it has always lived (the keeper
 * mind), and what an agent-backed answer may use from the
 * record is assembled keeper-side into the briefing, the
 * same inspectable shape the app assembles (§5.2).
 *
 * What it is not: it is not the Guide. The Guide seat and
 * its rulebook are untouched — a keeper's Spark taking
 * agent backing is a different speaker under different
 * rules, as it has been since Nov 19. And in child mode
 * this module is never loaded into an asking path at all:
 * the standing child gate on the Spark routes (U0) refuses
 * before any door traffic, the same law the app enforces
 * below its interface.
 *
 * The seal: sha256(secret + "|" + canonical(core)) — the
 * protocol's one seal, spelled identically in the door's
 * core and the app's AgentDoor, so an envelope sealed on
 * any surface opens on every other.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SparkAgentDoor = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const VERSION = "spark-agent-door/1.0.0";
    const AGENT_URL = "/.netlify/functions/agent";

    const KIND_SCOPE = {
      "read-day": "read-day",
      "read-state": "read-state",
      "propose": "propose-plans",
      "read-genesis": "read-genesis",
      "converse": "converse",
    };

    /* Canonical form: sorted keys, JS number spelling —
     * the bundle's own canonical form, shared with the
     * accounts core and the app's Json.writeCanonical. */
    function canonical(value) {
      if (value === null) return "null";
      if (typeof value === "string") return JSON.stringify(value);
      if (typeof value === "boolean") return value ? "true" : "false";
      if (typeof value === "number") return String(value);
      if (Array.isArray(value)) {
        return "[" + value.map(canonical).join(",") + "]";
      }
      if (typeof value === "object") {
        const keys = Object.keys(value).sort();
        return "{" + keys.map(
          (k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
      }
      throw new Error("uncanonical value");
    }

    async function sha256Hex(text) {
      const subtle = globalThis.crypto && globalThis.crypto.subtle;
      if (subtle) {
        const digest = await subtle.digest(
          "SHA-256", new TextEncoder().encode(text));
        return [...new Uint8Array(digest)]
          .map((b) => b.toString(16).padStart(2, "0")).join("");
      }
      // Node (tests): the same hash, from the platform lib.
      const { createHash } = await import("node:crypto").catch(() => ({}));
      if (createHash) {
        return createHash("sha256").update(text, "utf8").digest("hex");
      }
      throw new Error("no sha-256 available on this surface");
    }

    function envelopeCore(envelope) {
      return {
        id: envelope.id,
        tokenId: envelope.tokenId,
        scope: envelope.scope,
        kind: envelope.kind,
        payload: envelope.payload ?? null,
        at: envelope.at,
      };
    }

    async function sealEnvelope(secret, envelope) {
      return sha256Hex(String(secret) + "|" + canonical(envelopeCore(envelope)));
    }

    /** Builds one sealed envelope under a grant. The
     *  secret is the keeper-carried pairing secret; it is
     *  used here and not retained. */
    async function buildEnvelope(secret, grant, { kind, payload, at, id }) {
      const envelope = {
        id: id || "env-" + (await sha256Hex(
          String(at) + "|" + kind + "|" + canonical(payload ?? null))).slice(0, 12),
        tokenId: grant.tokenId,
        token: secret,
        scope: KIND_SCOPE[kind] || null,
        kind,
        payload: payload ?? null,
        at,
      };
      envelope.seal = await sealEnvelope(secret, envelope);
      return envelope;
    }

    /** Opens a sealed reply from the door. */
    async function openReply(secret, reply) {
      if (!reply || typeof reply !== "object") return false;
      const { seal, ...core } = reply;
      const expected = await sha256Hex(
        String(secret) + "|" + canonical(core));
      return seal === expected;
    }

    /**
     * Carries one envelope to the door's agent seat and
     * returns the door's answer whole: {ok, scope, line} on
     * a verified act, or {ok:false, reason, plain} — the
     * refusal told plainly, for the Spark to relay. The
     * fulfilment of a read or a proposal happens on THIS
     * surface, from this surface's record, under the
     * verified scope; this client only carries.
     */
    function createClient(options) {
      const fetchFn = (options && options.fetchFn)
        || (typeof fetch !== "undefined" ? fetch : null);
      const doorUrl = (options && options.doorUrl) || AGENT_URL;
      return {
        async act(secret, grant, ask) {
          if (!fetchFn) return { ok: false, reason: "no-transport" };
          const envelope = await buildEnvelope(secret, grant, ask);
          let res;
          try {
            res = await fetchFn(doorUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "act",
                envelope,
                profileGrants: ask.profileGrants || [],
                detail: ask.detail || "",
              }),
            });
          } catch {
            return { ok: false, reason: "door-unreachable" };
          }
          try {
            return await res.json();
          } catch {
            return { ok: false, reason: "door-shape" };
          }
        },
      };
    }

    return {
      VERSION,
      AGENT_URL,
      KIND_SCOPE,
      canonical,
      sha256Hex,
      sealEnvelope,
      buildEnvelope,
      openReply,
      createClient,
    };
  }
);
