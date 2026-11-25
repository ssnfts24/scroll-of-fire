/**
 * The Spark keeper mind — Phase 1 of the Spark intelligence
 * design (Aaron approved the design Nov 20, 2026; design:
 * your_files/spark-intelligence-design-2026-11-20.md).
 *
 * The site-wide seat (spark-agent-seat.js) lazy-loads this module
 * the first time a keeper opens the talk panel, so no page pays
 * its weight until the keeper actually talks. It carries:
 *
 *   - THE MEMORY the Spark keeps on this device
 *     (sof.spark.memory.v1, keyed per Spark by seed — see
 *     memoryKeyFor): beliefs about the keeper, each
 *     labelled observed or inferred, with corrections appended
 *     beside the original — never overwritten (the Witness
 *     Protocol's law, design §3); proposal outcomes (Approve /
 *     Pass / Stop, design §5); the child-mode flag (router
 *     rule 2). The door keeps none of this. There is no shadow
 *     memory; this device is the memory, and the keeper can read
 *     and strike every line of it.
 *   - THE ROUTER (design §2c): the seven plain-word rules that
 *     decide whether a question is answered on this device, by
 *     the fence, or at the talking door — and at which tier.
 *     The rules are exported verbatim for the panel's "How I
 *     decide" view; a keeper can read the rules their companion
 *     lives by.
 *   - THE BRIEFING (design §2b): the slice of the keeper's own
 *     record assembled here, on this device, and sent with a
 *     deep question — identity, kept days, garden, finds, story
 *     trail, beliefs, outcomes, and public-record passages with
 *     their sources and grades. The panel's "What I know" view
 *     shows exactly what a briefing carries. Nothing in the
 *     keeper's private notes is ever included — the briefing is
 *     built from named sections, and a section that is not in
 *     the list below does not ride.
 *   - "YOUR STORY SO FAR" (design §6): the recap, told from the
 *     record — locally at no cost, or deepened at the door.
 *   - THE ASK FLOW: fence → child → lookup → route → door, with
 *     failure falling down honestly (rule 7). The flow is built
 *     with injected dependencies (createAskFlow) so the routing
 *     can be verified — including at the network layer — in
 *     tests/spark-intelligence.test.js.
 *
 * Fences that live here: a child's talk never leaves the device
 * (the flow checks the flag before any door call exists); fenced
 * ground is answered locally by the fence and never routed; the
 * Spark drafts and proposes — it never sends, and nothing it
 * proposes is applied before the keeper's answer.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SparkKeeperMind = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const VERSION = "spark-keeper-mind/1.0.0";
    const MEMORY_KEY = "sof.spark.memory.v1";
    const AGENT_URL = "/.netlify/functions/spark-agent";

    /* The seat's own fence and ceiling words, mirrored here so
     * the local mind speaks them without a network round trip.
     * The door speaks the same words from its own copy; the two
     * copies are pinned to each other by test. */
    const FENCE_NOTICE =
      "That ground isn't mine to walk — it sits with your own counsel and your family's privacy, not with a companion's talk. What I can do is answer from the record: your days, your garden, your story, and the Codex's public pages. Ask me there, and I'll answer plainly.";
    const CEILING_NOTICE =
      "I've reached my deep-thinking limit for this month, so I'm working from this phone alone until the month turns. I can still tell your days, tend your garden with you, and answer from your record — I just can't think the big thoughts until then.";
    const CHILD_NOTICE =
      "For a young keeper, my talking stays right here on this device — nothing typed here travels anywhere. I can still answer from your record: your days, your Spark, and the story so far.";

    /* ------------------------- memory ------------------------- */

    function blankMemory() {
      return {
        version: 1,
        childMode: false,
        beliefs: [],   // { id, text, label, source, at, corrections: [{ text, at }], struck: false }
        outcomes: [],  // { fingerprint, kind, summary, decision, passes, lastAt, moonIndex }
        mindLog: []    // { at, version, tier, model } — which mind answered what mattered
      };
    }

    /* Each Spark carries its OWN memory store, keyed by its seed:
     * MEMORY_KEY + ":" + seed. Before this keying, every Spark in a
     * browser shared the one bare MEMORY_KEY store, so two Sparks
     * briefed the door with each other's beliefs (audit, Nov 23,
     * 2026, claim 3). The bare key is now the legacy store: on a
     * Spark's first load, whatever the legacy store holds is
     * carried into that Spark's keyed store — moved, not copied,
     * so no other Spark can claim it again and nothing a keeper's
     * Spark already holds is ever orphaned or dropped (character
     * persistence). With no seed — no Spark adopted yet — the
     * legacy key is used exactly as before. The Sphere client
     * (sphere-spark.js) mirrors memoryKeyFor to read the child-mode
     * flag from the same store; the two copies are pinned to each
     * other by test. */
    function memoryKeyFor(seed) {
      const clean = typeof seed === "string" ? seed.trim() : "";
      return clean ? `${MEMORY_KEY}:${clean}` : MEMORY_KEY;
    }

    function parseMemory(raw) {
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") return blankMemory();
      const memory = blankMemory();
      memory.childMode = parsed.childMode === true;
      if (Array.isArray(parsed.beliefs)) memory.beliefs = parsed.beliefs;
      if (Array.isArray(parsed.outcomes)) memory.outcomes = parsed.outcomes;
      if (Array.isArray(parsed.mindLog)) memory.mindLog = parsed.mindLog.slice(-40);
      return memory;
    }

    function loadMemory(storage, seed) {
      try {
        const key = memoryKeyFor(seed);
        let raw = storage && storage.getItem(key);
        if (!raw && key !== MEMORY_KEY && storage) {
          /* Migration: the legacy store moves into this Spark's
           * keyed store on first load. If the move itself fails
           * (storage full, removeItem missing), the legacy contents
           * still load — they are never lost to a failed move. */
          const legacy = storage.getItem(MEMORY_KEY);
          if (legacy) {
            raw = legacy;
            try {
              storage.setItem(key, legacy);
              if (typeof storage.removeItem === "function") storage.removeItem(MEMORY_KEY);
            } catch { /* the legacy copy stands; the load above already holds it */ }
          }
        }
        return parseMemory(raw);
      } catch {
        return blankMemory();
      }
    }

    function saveMemory(storage, memory, seed) {
      try {
        storage && storage.setItem(memoryKeyFor(seed), JSON.stringify(memory));
        return true;
      } catch {
        return false;
      }
    }

    let beliefCounter = 0;
    function addBelief(memory, { text, label, source, at }) {
      const clean = String(text || "").replace(/\s+/g, " ").trim().slice(0, 240);
      if (!clean) return null;
      const existing = memory.beliefs.find((b) => !b.struck && b.text.toLowerCase() === clean.toLowerCase());
      if (existing) return existing;
      const belief = {
        id: `b${Date.now().toString(36)}${(beliefCounter += 1)}`,
        text: clean,
        label: label === "inferred" ? "inferred" : "observed",
        source: String(source || "conversation").slice(0, 80),
        at: at || null,
        corrections: [],
        struck: false
      };
      memory.beliefs.push(belief);
      return belief;
    }

    /* Corrections are appended beside the original, dated — the
     * original is never overwritten (design §3). The corrected
     * text governs from then on. */
    function correctBelief(memory, id, correction, at) {
      const belief = memory.beliefs.find((b) => b.id === id);
      const clean = String(correction || "").replace(/\s+/g, " ").trim().slice(0, 240);
      if (!belief || !clean) return null;
      belief.corrections.push({ text: clean, at: at || null });
      return belief;
    }

    function governingText(belief) {
      if (!belief) return "";
      const last = belief.corrections && belief.corrections[belief.corrections.length - 1];
      return last ? last.text : belief.text;
    }

    /* A struck belief is a Stop with the keeper's own hand on it
     * (design §5): it leaves the briefing and is never re-formed
     * silently — the line stays visible in the list, struck. */
    function strikeBelief(memory, id) {
      const belief = memory.beliefs.find((b) => b.id === id);
      if (belief) belief.struck = true;
      return belief || null;
    }

    function beliefsForBriefing(memory) {
      return memory.beliefs
        .filter((b) => !b.struck)
        .slice(-12)
        .map((b) => {
          const entry = { text: b.text, label: b.label };
          const last = b.corrections && b.corrections[b.corrections.length - 1];
          if (last) entry.correction = last.text;
          return entry;
        });
    }

    /* ------------------- outcomes (design §5) ------------------ */

    const STOPWORDS = new Set([
      "the", "a", "an", "to", "of", "for", "on", "in", "my", "your", "our", "it", "its",
      "and", "or", "with", "this", "that", "please", "should", "would", "could", "i", "we", "you"
    ]);

    /* A suggestion's identity is a fingerprint of what it
     * describes — kind plus its significant words, sorted — so
     * the same idea wearing new words is recognised as the same
     * idea. It is a heuristic and says so: synonyms slip past it,
     * and the keeper's Stop on the card itself never does. */
    function fingerprintFor(kind, summary) {
      const tokens = String(summary || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((t) => t && !STOPWORDS.has(t));
      const unique = [...new Set(tokens)].sort();
      return `${String(kind || "idea").toLowerCase()}|${unique.join(" ")}`;
    }

    function findOutcome(memory, fingerprint) {
      return memory.outcomes.find((o) => o.fingerprint === fingerprint) || null;
    }

    /* Record the keeper's answer to a suggestion. Three Passes in
     * a row quiet the kind for one moon; a Stop sleeps it until
     * its facts change; an Approve makes it a standing pattern
     * (which the Spark may carry out, never widen). */
    function recordOutcome(memory, { kind, summary, decision, moonIndex, at }) {
      const fingerprint = fingerprintFor(kind, summary);
      let outcome = findOutcome(memory, fingerprint);
      if (!outcome) {
        outcome = {
          fingerprint,
          kind: String(kind || "idea"),
          summary: String(summary || "").slice(0, 160),
          decision: "passed",
          passes: 0,
          lastAt: at || null,
          moonIndex: moonIndex ?? null
        };
        memory.outcomes.push(outcome);
      }
      outcome.lastAt = at || outcome.lastAt;
      if (moonIndex != null) outcome.moonIndex = moonIndex;
      if (decision === "approved") {
        outcome.decision = "approved";
        outcome.passes = 0;
      } else if (decision === "stopped") {
        outcome.decision = "stopped";
      } else {
        outcome.decision = "passed";
        outcome.passes = (outcome.passes || 0) + 1;
      }
      return outcome;
    }

    /* May this suggestion be presented? A stopped kind sleeps
     * (unless its card names changed facts); a kind passed three
     * times rests until the moon turns; a return after the quiet
     * moon is marked as a return. */
    function proposalGate(memory, { kind, summary }, moonIndex, factsChanged) {
      const outcome = findOutcome(memory, fingerprintFor(kind, summary));
      if (!outcome) return { gate: "present", outcome: null, returning: false };
      if (outcome.decision === "stopped" && !factsChanged) return { gate: "stopped", outcome, returning: false };
      if (outcome.decision === "passed" && (outcome.passes || 0) >= 3) {
        /* The quiet holds while the moon is the same — and when
         * the moon can't be read at all, the kind rests rather
         * than risk nagging (the noticing etiquette outranks the
         * calendar's absence). */
        if (moonIndex == null || outcome.moonIndex == null || moonIndex <= outcome.moonIndex) {
          return { gate: "quiet", outcome, returning: false };
        }
        return { gate: "present", outcome, returning: true };
      }
      return { gate: "present", outcome, returning: false };
    }

    function outcomesForBriefing(memory) {
      return memory.outcomes.slice(-12).map((o) => ({
        kind: o.kind,
        decision: o.decision,
        summary: o.summary
      }));
    }

    /* ------------------- the router (design §2c) ------------------ */

    /* The seven rules, in the plain words the panel shows the
     * keeper. The router below implements them in this order. */
    const ROUTER_RULES = [
      "Fenced ground never routes anywhere. Court and family matters, and speaking as Aaron, get the fence answer here, from me, and cost nothing.",
      "A child's talk never leaves this device. For a young keeper, this local mind is the whole mind.",
      "A lookup stays home. What your record already answers — a date, a planting, a keepsake, the story so far — I answer here: free, instant, offline.",
      "Reasoning goes to the door. When a question needs weighing, planning, comparing, or drafting, I think deeper — and I say so when I do, never silently.",
      "You can always choose. Say \u201cjust between us\u201d and we stay on this device; ask me to think harder and I will.",
      "Cost is a rule too. As the month's talking meter climbs, I carry smaller briefings, then save the deep mind for what clearly needs it, then rest it — and you hear about the tightening before the wall, not at it.",
      "If the door fails, I answer what I can here and name what I couldn't do. Never a fake deep answer."
    ];

    /* Router rule 1's patterns — the same fenced ground the door
     * screens for (the Spark core keeps its own copy; the two are
     * pinned to each other by test). Narrow on purpose: the
     * record's own ground — Aaron's work, calendar, writings —
     * is not fenced. */
    const FENCE_PATTERNS = [
      /\b(court|custody|child support|parenting plan|lawsuit|litigat\w*|attorney|lawyer|restraining order|legal advice)\b/i,
      /\b(sue|suing|sued)\b/i,
      /\bcase\s*(no\.?|number|#)\s*[0-9]/i,
      /\bhow do i (sue|file|get custody|divorce)\b/i,
      /\bmy (custody|court case|divorce|hearing)\b/i,
      /\b(his|aaron'?s)\s+(case|lawsuit|court case|legal matters?)\b/i,
      /\b(tanya|tatyana|volosyanko|aiyana|aeva|cassidy)\b/i,
      /\baiden\b/i,
      /\b(aaron'?s|his)\s+(wife|fianc\w*|partner|daughter|son|kids|children|family|ex-wife)\b/i,
      /\b(aaron'?s|his)\s+(address|phone|email|home address|location|income|finances|health)\b/i,
      /\bwhere\s+(does|is)\s+aaron\s+(live|staying|working)\b/i,
      /\b(pretend|act|write|speak|talk|answer|respond)\b[^.?!]{0,30}\b(as|like)\s+aaron\b/i,
      /\byou\s+are\s+aaron\b/i,
      /\bin\s+aaron'?s\s+(voice|words)\b/i,
      /\bas\s+aaron\s+laird\b/i
    ];

    function fenceCheck(text) {
      const value = String(text || "");
      return FENCE_PATTERNS.some((pattern) => pattern.test(value));
    }

    const PIN_LOCAL_PATTERN = /\b(just between us|keep (this|it) (on|to) (this|the) (phone|device)|on this (phone|device) only|don'?t use the door|no door)\b/i;
    const PIN_DEEP_PATTERN = /\b(think (harder|hardest|deeply|deep)|use (your|the) deep|deep mind|your best thinking|really think)\b/i;
    const REASONING_PATTERN = /\b(why|should i|should we|plan|compare|decide|decision|advice|advise|help me (think|decide|plan|choose)|what do you think|draft|write (me|a|the)|prepare|weigh|choose between|which is better|how (should|would|could) i)\b/i;
    const HARD_PLANNING_PATTERN = /\b(plan|prepare|organise|organize|schedule)\b[^.?!]{0,40}\b(week|moon|month|year|season)\b/i;
    const ROUTINE_DEEP_PATTERN = /\b(summarise|summarize|sum up|recap|story so far|tell me (my|our) story|draft|write (me|a|the))\b/i;

    /**
     * route(question, state) — the seven rules, in order.
     * state: {
     *   childMode: boolean,
     *   lookup: boolean,          // the local mind can answer this from the record
     *   doorOpen: boolean,        // the door last answered / is believed open
     *   tightening: "open" | "shortening" | "reserving" | "closed"
     * }
     * Returns { route: "fence" | "local" | "door", tier, reason }.
     */
    function route(question, state) {
      const q = String(question || "");
      const s = state || {};
      if (fenceCheck(q)) return { route: "fence", reason: "rule-1-fenced-ground" };
      if (s.childMode) return { route: "local", reason: "rule-2-child" };
      if (PIN_LOCAL_PATTERN.test(q)) return { route: "local", reason: "rule-5-keeper-pinned-local" };
      if (s.lookup) return { route: "local", reason: "rule-3-lookup" };
      const reasoning = REASONING_PATTERN.test(q) || PIN_DEEP_PATTERN.test(q) || ROUTINE_DEEP_PATTERN.test(q);
      if (!reasoning) return { route: "local", reason: "rule-3-no-reasoning-needed" };
      if (s.tightening === "closed") return { route: "local", reason: "rule-6-ceiling" };
      if (s.tightening === "reserving" && !HARD_PLANNING_PATTERN.test(q) && !PIN_DEEP_PATTERN.test(q)) {
        return { route: "local", reason: "rule-6-reserving" };
      }
      if (!s.doorOpen) return { route: "local", reason: "rule-7-door-unreachable" };
      let tier = "middle";
      if (PIN_DEEP_PATTERN.test(q) || HARD_PLANNING_PATTERN.test(q)) tier = "strong";
      else if (ROUTINE_DEEP_PATTERN.test(q)) tier = "small";
      return { route: "door", tier, reason: "rule-4-reasoning" };
    }

    function briefingProfile(tightening) {
      return tightening === "shortening" || tightening === "reserving" ? "short" : "full";
    }

    /* ------------------- passages (public record) ------------------ */

    /* A light, deterministic scorer over the site's own search
     * shards (docs/assets/search/*.json): title weighs most, then
     * heading, then body — the same shape the site's search uses.
     * Claims carry their evidence grade in the shard's x field;
     * the grade rides with the passage, never flattened. */
    function scorePassages(question, docs, limit) {
      const terms = [...new Set(
        String(question || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)
          .filter((t) => t.length > 2 && !STOPWORDS.has(t))
      )];
      if (!terms.length || !Array.isArray(docs)) return [];
      const scored = [];
      for (const doc of docs) {
        if (!doc || typeof doc !== "object") continue;
        const title = String(doc.t || "").toLowerCase();
        const heading = String(doc.h || "").toLowerCase();
        const body = String(doc.b || "").toLowerCase();
        let score = 0;
        for (const term of terms) {
          if (title.includes(term)) score += 5;
          if (heading.includes(term)) score += 3;
          if (body.includes(term)) score += 1;
        }
        if (score > 0) scored.push({ doc, score });
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, Math.max(0, limit || 5)).map(({ doc }) => ({
        title: String(doc.t || "Codex record"),
        url: String(doc.u || ""),
        grade: doc.a === "claims" ? String(doc.x || "") || null : null,
        text: String(doc.b || "").slice(0, 600)
      }));
    }

    /* ------------------- the briefing (design §2b) ------------------ */

    /* Trim an assembled briefing to the wire shape, minimised by
     * profile (router rule 6: a tightening month sends less). */
    function shapeBriefingForWire(briefing, profile) {
      const b = briefing || {};
      const short = profile === "short";
      return {
        recordLines: (b.recordLines || []).slice(0, short ? 8 : 24),
        beliefs: (b.beliefs || []).slice(0, short ? 6 : 12),
        passages: (b.passages || []).slice(0, short ? 2 : 5),
        outcomes: (b.outcomes || []).slice(0, 12),
        recap: (b.recap || []).slice(0, short ? 6 : 14),
        liveLine: b.liveLine || ""
      };
    }

    /* ------------------- your story so far (design §6) ------------------ */

    /* The recap, from the record alone. Every line traces to an
     * entry the caller gathered; an area with nothing kept is
     * simply not spoken of — the recap never invents a day, a
     * find, or a chapter. */
    function storySoFar(input) {
      const d = input || {};
      const lines = [];
      if (d.name && typeof d.daysTogether === "number" && d.daysTogether > 0) {
        lines.push(`You and ${d.name} have kept ${d.daysTogether} distinct day${d.daysTogether === 1 ? "" : "s"} together${d.firstKeptDay ? `, beginning ${d.firstKeptDay}` : ""}.`);
      }
      if (Array.isArray(d.trailFinds) && d.trailFinds.length) {
        const latest = d.trailFinds[d.trailFinds.length - 1];
        lines.push(`On the Traveller's Road you have found ${d.trailFinds.length}${d.chaptersTotal ? ` of ${d.chaptersTotal}` : ""} chapters${latest && latest.title ? ` — the latest, \u201c${latest.title},\u201d${latest.when ? ` found ${latest.when}` : ""}` : ""}.`);
      }
      if (d.garden) {
        const g = d.garden;
        const bits = [];
        if (g.bedsPlanted) bits.push(`${g.bedsPlanted} bed${g.bedsPlanted === 1 ? "" : "s"} planted`);
        if (g.bedsReady) bits.push(`${g.bedsReady} standing ready`);
        if (g.harvestsKept) bits.push(`${g.harvestsKept} harvest${g.harvestsKept === 1 ? "" : "s"} kept`);
        if (bits.length) lines.push(`In the Pattern Garden: ${bits.join(", ")}.`);
      }
      if (d.findsKept) {
        lines.push(`Your Spark has found ${d.findsKept} small thing${d.findsKept === 1 ? "" : "s"} for you across the site, each resting in your Life Atlas.`);
      }
      if (Array.isArray(d.keepsakes) && d.keepsakes.length) {
        lines.push(`Keepsakes resting in Their Home include ${d.keepsakes.slice(0, 3).map((t) => `\u201c${t}\u201d`).join(", ")}.`);
      }
      if (d.todayLine) lines.push(d.todayLine);
      return lines;
    }

    /* ------------------- the ask flow ------------------ */

    /**
     * createAskFlow(deps) — the conversation pipeline, with every
     * outside surface injected so tests can verify the routing —
     * including that a child's session, a fenced question, and a
     * lookup make ZERO door calls (the network layer, not the
     * Spark's say-so).
     *
     * deps: {
     *   say(text, kind),                 // render a line (kind: "spark" | "status")
     *   isChildMode(): boolean,
     *   localAnswer(question): string | null | Promise<string|null>,
     *   doorStatus(): { doorOpen, tightening },
     *   gatherBriefing(): Promise<object>,
     *   doorAsk({ briefing, tier }): Promise<result>,
     *   onProposals(list), onMemories(list), onMind(mind)
     * }
     */
    function createAskFlow(deps) {
      async function ask(question) {
        const q = String(question || "");
        /* Rule 1 — the fence answers locally, before anything. */
        if (fenceCheck(q)) {
          deps.say(FENCE_NOTICE, "spark");
          return { route: "fence", reason: "rule-1-fenced-ground" };
        }
        const child = deps.isChildMode();
        const local = await deps.localAnswer(q);
        const status = deps.doorStatus();
        const decision = route(q, {
          childMode: child,
          lookup: local != null,
          doorOpen: status.doorOpen,
          tightening: status.tightening
        });
        if (decision.route === "local") {
          if (local != null) {
            deps.say(local, "spark");
          } else if (decision.reason === "rule-2-child") {
            deps.say(CHILD_NOTICE, "spark");
          } else if (decision.reason === "rule-6-ceiling") {
            deps.say(CEILING_NOTICE, "spark");
          } else if (decision.reason === "rule-6-reserving") {
            deps.say("That one needs my deeper thinking, and this month's meter is running high — I'm saving the deep mind for the questions that clearly need it. Ask me from your record, or ask me again when the month turns.", "spark");
          } else if (decision.reason === "rule-5-keeper-pinned-local") {
            deps.say("Staying right here on this device, then. That question is deeper than my on-device answers reach — ask me about today, this page, our days together, your garden, or the story so far.", "spark");
          } else {
            deps.say("That one needs my deeper voice, and the talking door isn't open from here just now. I can still answer about today, this page, our days together, your garden, and the story so far.", "spark");
          }
          return { route: "local", reason: decision.reason };
        }
        /* Rule 4 — reasoning goes to the door, and says so. */
        deps.say(decision.tier === "strong" ? "Thinking my hardest at the door…" : "Thinking deeper at the door…", "status");
        let result = null;
        try {
          const briefing = shapeBriefingForWire(await deps.gatherBriefing(), briefingProfile(status.tightening));
          result = await deps.doorAsk({ briefing, tier: decision.tier, question: q });
        } catch {
          result = null;
        }
        if (!result || result.mode === "error" || result.mode === "unavailable" || result.mode === "invalid") {
          /* Rule 7 — failure routes down, honestly. */
          if (local != null) {
            deps.say(local, "spark");
            deps.say("My deeper voice didn't answer just now, so that came from your record here — the deeper thought waits for the door.", "status");
          } else {
            deps.say("My deeper voice didn't answer just now, and that one is beyond my on-device answers. Nothing was lost — try me again in a little while.", "spark");
          }
          return { route: "local", reason: "rule-7-door-failed", tier: decision.tier };
        }
        if (result.mode === "ceiling") {
          deps.say(result.reply || CEILING_NOTICE, "spark");
          return { route: "door", reason: "rule-6-ceiling-at-door", tier: decision.tier, result };
        }
        if (result.mode === "fence") {
          deps.say(result.reply || FENCE_NOTICE, "spark");
          return { route: "door", reason: "rule-1-fence-at-door", tier: decision.tier, result };
        }
        deps.say(result.reply || "I'm here. Ask me again in a few words?", "spark");
        if (Array.isArray(result.proposals) && result.proposals.length && deps.onProposals) deps.onProposals(result.proposals);
        if (Array.isArray(result.memories) && result.memories.length && deps.onMemories) deps.onMemories(result.memories);
        if (result.mind && deps.onMind) deps.onMind(result.mind);
        return { route: "door", reason: decision.reason, tier: decision.tier, result };
      }
      return { ask };
    }

    /* ------------------- browser glue ------------------ */

    const STYLE_TEXT = `
.spark-mind-bar { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.45rem 0 0.2rem; }
.spark-mind-bar button, .spark-mind-proposal button {
  border: 1px solid rgba(212, 175, 55, 0.45); background: rgba(255, 233, 168, 0.08);
  color: #ffe9a8; border-radius: 999px; padding: 0.28rem 0.7rem; font-size: 0.8rem; cursor: pointer;
}
.spark-mind-view { border-top: 1px solid rgba(212, 175, 55, 0.25); margin-top: 0.5rem; padding-top: 0.5rem; font-size: 0.85rem; }
.spark-mind-view h4 { margin: 0.4rem 0 0.25rem; color: #ffe9a8; font-size: 0.85rem; }
.spark-mind-view ul, .spark-mind-view ol { margin: 0.2rem 0 0.4rem 1.1rem; padding: 0; }
.spark-mind-view li { margin: 0.15rem 0; }
.spark-mind-view .spark-mind-note { opacity: 0.8; font-size: 0.8rem; }
.spark-mind-belief button { margin-left: 0.4rem; padding: 0.1rem 0.5rem; font-size: 0.75rem;
  border: 1px solid rgba(212, 175, 55, 0.4); background: transparent; color: #ffe9a8; border-radius: 999px; cursor: pointer; }
.spark-mind-belief.is-struck { opacity: 0.55; text-decoration: line-through; }
.spark-mind-proposal { border: 1px solid rgba(212, 175, 55, 0.5); border-radius: 0.5rem; padding: 0.5rem 0.6rem; margin: 0.4rem 0; }
.spark-mind-proposal p { margin: 0 0 0.4rem; }
.spark-mind-proposal .spark-mind-actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.spark-seat-line.is-status { opacity: 0.75; font-style: italic; font-size: 0.85rem; }
`;

    function injectStyles() {
      if (document.querySelector("[data-spark-mind-styles]")) return;
      const style = document.createElement("style");
      style.setAttribute("data-spark-mind-styles", "");
      style.textContent = STYLE_TEXT;
      document.head.appendChild(style);
    }

    function el(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    }

    function resolveRepository() {
      try {
        const Repository = window.CodexLifeAtlasRepository;
        if (!Repository) return null;
        if (typeof Repository.createPersistentRepository === "function") return Repository.createPersistentRepository();
        if (typeof Repository.createRepository === "function") return Repository.createRepository();
      } catch { /* the Atlas simply isn't on this page */ }
      return null;
    }

    function enhanceSeat(api) {
      if (!api || api.panel.dataset.sparkMind === "1") return;
      api.panel.dataset.sparkMind = "1";
      injectStyles();

      const storage = window.localStorage;
      /* The store belongs to THIS Spark: keyed by the seed in the
       * seat's record, so a different Spark in the same browser
       * never reads or briefs from this one's memory. No record
       * (no Spark adopted) falls back to the legacy key. */
      const memorySeed = api && api.record && typeof api.record.seed === "string" ? api.record.seed : null;
      let memory = loadMemory(storage, memorySeed);
      const persist = () => saveMemory(storage, memory, memorySeed);
      let sourcesCache = null;
      let shardDocs = null;
      let storyChapters = null;

      const scriptBase = (() => {
        const tag = document.querySelector('script[src*="spark-agent-seat.js"]');
        if (!tag) return "assets/js/";
        return tag.getAttribute("src").split("?")[0].replace(/spark-agent-seat\.js$/, "");
      })();

      async function fetchJson(url) {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          return await res.json();
        } catch { return null; }
      }

      async function loadShards() {
        if (shardDocs) return shardDocs;
        const [pages, claims] = await Promise.all([
          fetchJson(`${scriptBase}../search/pages.json`),
          fetchJson(`${scriptBase}../search/claims.json`)
        ]);
        const docs = [];
        for (const shard of [claims, pages]) {
          if (shard && Array.isArray(shard.docs)) docs.push(...shard.docs);
        }
        shardDocs = docs;
        return shardDocs;
      }

      async function loadStoryChapters() {
        if (storyChapters) return storyChapters;
        const data = await fetchJson(`${scriptBase}../data/codex-story.json`);
        const map = {};
        let total = 0;
        const chapters = data && Array.isArray(data.chapters) ? data.chapters : [];
        for (const ch of chapters) {
          if (ch && ch.id) { map[ch.id] = ch.title || null; total += 1; }
        }
        storyChapters = { map, total };
        return storyChapters;
      }

      function moonIndexNow() {
        try {
          const cal = typeof PatternCalendar !== "undefined" ? PatternCalendar : null;
          if (!cal || !cal.fromCivilDate) return null;
          const s = cal.fromCivilDate({ date: new Date() });
          if (!s) return null;
          return (Number(s.patternYear) || 0) * 13 + (Number(s.moon) || 13);
        } catch { return null; }
      }

      async function gatherSources() {
        const record = api.record || {};
        const daysSeen = Array.isArray(record.daysSeen) ? record.daysSeen : [];
        const trail = (() => {
          try {
            return typeof LivingTrail !== "undefined" ? LivingTrail.load() : null;
          } catch { return null; }
        })();
        const story = await loadStoryChapters();
        const finds = [];
        if (trail && trail.finds) {
          for (const [id, stamp] of Object.entries(trail.finds)) {
            finds.push({ id, title: story.map[id] || null, when: stamp && stamp.civilDate ? stamp.civilDate : null });
          }
        }
        finds.sort((a, b) => String(a.when || "").localeCompare(String(b.when || "")));
        const codexMemory = (() => {
          try {
            const raw = storage.getItem("sof.codexMemory.v1");
            return raw ? JSON.parse(raw) : null;
          } catch { return null; }
        })();
        let atlas = null;
        let garden = null;
        const repository = resolveRepository();
        if (repository) {
          try {
            const keepsakes = await repository.query({ subtype: "hidden-keepsake" });
            atlas = {
              findsKept: Array.isArray(keepsakes) ? keepsakes.length : 0,
              keepsakeTitles: (keepsakes || []).map((k) => (k && (k.title || (k.payload && k.payload.title))) || "A keepsake")
            };
          } catch { atlas = null; }
          try {
            const Garden = typeof PatternGarden !== "undefined" ? PatternGarden : null;
            if (Garden && typeof Garden.foldGarden === "function") {
              const all = await repository.query({});
              const keptDates = [...new Set((all || []).map((r) => r && r.temporal && r.temporal.civilDate).filter(Boolean))];
              const fold = Garden.foldGarden({ records: all || [], keptDates });
              if (fold && Array.isArray(fold.beds)) garden = fold;
            }
          } catch { garden = null; }
        }
        sourcesCache = {
          daysTogether: daysSeen.length,
          firstPatternDay: daysSeen.length ? Math.min(...daysSeen) : null,
          trailFinds: finds,
          chaptersTotal: story.total || null,
          intention: codexMemory && codexMemory.dailyIntention ? codexMemory.dailyIntention.value || null : null,
          unfinishedPractice: codexMemory && codexMemory.unfinishedPractice ? codexMemory.unfinishedPractice.title || null : null,
          atlas,
          garden
        };
        return sourcesCache;
      }

      function gardenSummary() {
        const fold = sourcesCache && sourcesCache.garden;
        if (!fold) return null;
        let bedsPlanted = 0;
        let bedsReady = 0;
        let harvestsKept = 0;
        for (const bed of fold.beds) {
          if (bed.plantings && bed.plantings.length) bedsPlanted += 1;
          for (const p of bed.plantings || []) {
            if (p.canHarvest) bedsReady += 1;
            if (p.harvested) harvestsKept += 1;
          }
        }
        return { bedsPlanted, bedsReady, harvestsKept };
      }

      function gardenLines() {
        const fold = sourcesCache && sourcesCache.garden;
        if (!fold) return [];
        const lines = [];
        for (const bed of fold.beds) {
          for (const p of bed.plantings || []) {
            lines.push(
              `Garden, ${bed.name}: ${p.cropName}, planted ${p.plantedDate || "on a day the record holds"}, witnessed ${p.witnessedDays} day${p.witnessedDays === 1 ? "" : "s"}, ${p.stageName}${p.canHarvest ? ", ready to harvest" : ""}${p.goneToSeed ? ", gone to seed" : ""}${p.harvested ? ", harvested and kept" : ""}.`
            );
          }
          for (const r of bed.returnable || []) {
            lines.push(`Garden, ${bed.name}: a keepsake from last year can return this Moon.`);
          }
        }
        return lines;
      }

      function recapInput() {
        const s = sourcesCache || {};
        const today = api.todayStamp();
        return {
          name: api.name,
          daysTogether: s.daysTogether ?? null,
          firstKeptDay: s.firstPatternDay != null ? `on Pattern Day ${s.firstPatternDay}` : null,
          trailFinds: s.trailFinds || [],
          chaptersTotal: s.chaptersTotal,
          garden: gardenSummary(),
          findsKept: s.atlas ? s.atlas.findsKept : null,
          keepsakes: s.atlas ? s.atlas.keepsakeTitles : [],
          todayLine: today && today.patternDay
            ? `Today stands at Moon ${today.moon} · Day ${today.moonDay} · Pattern Day ${today.patternDay} of your year.`
            : null
        };
      }

      async function gatherBriefing(question) {
        const s = await gatherSources();
        const recordLines = [];
        if (s.daysTogether != null) recordLines.push(`Kept days: you and ${api.name} have kept ${s.daysTogether} distinct days together on this device.`);
        if (s.intention) recordLines.push(`Today's intention, from your record: ${s.intention}.`);
        if (s.unfinishedPractice) recordLines.push(`An unfinished practice waits: ${s.unfinishedPractice}.`);
        if (s.trailFinds && s.trailFinds.length) {
          const latest = s.trailFinds[s.trailFinds.length - 1];
          recordLines.push(`Story trail: ${s.trailFinds.length}${s.chaptersTotal ? ` of ${s.chaptersTotal}` : ""} chapters found${latest && latest.when ? `; the latest on ${latest.when}` : ""}.`);
        }
        if (s.atlas) recordLines.push(`Finds kept in your Life Atlas on this device: ${s.atlas.findsKept}.`);
        recordLines.push(...gardenLines());
        const ctx = api.localCtx();
        if (ctx.page) recordLines.push(`The keeper is standing on: \u201c${ctx.page.title}.\u201d ${ctx.page.subject || ""}`.trim());
        const docs = await loadShards();
        const today = api.todayStamp();
        return {
          recordLines,
          beliefs: beliefsForBriefing(memory),
          outcomes: outcomesForBriefing(memory),
          passages: scorePassages(question, docs, 5),
          recap: storySoFar(recapInput()),
          liveLine: today
            ? (today.patternDay
              ? `Today is ${today.civilDate} — Moon ${today.moon}${today.moonName ? ` (${today.moonName})` : ""} · Day ${today.moonDay} · Pattern Day ${today.patternDay}, by the canonical calendar.`
              : `Today is ${today.civilDate} — the Day Out of Time, outside the 364-day count.`)
            : ""
        };
      }

      function mindLocalAnswer(question) {
        const q = String(question || "").toLowerCase();
        const s = sourcesCache;
        if (/\b(story so far|our story|my story|recap|tell me (my|our) story)\b/.test(q)) {
          if (!s) return null;
          const lines = storySoFar(recapInput());
          return lines.length ? lines.join(" ") : "Your record here is still young — no days kept, no chapters found yet. The story writes itself as you keep it.";
        }
        if (/\b(what do you (believe|know) about me|your beliefs|what have you learned about me|what do you remember about me)\b/.test(q)) {
          const held = memory.beliefs.filter((b) => !b.struck);
          if (!held.length) return "I hold no beliefs about you yet. What I learn — from your record, or from what you tell me — is listed under \u201cWhat I know\u201d in this panel, labelled observed or inferred, and you can strike any line.";
          return held.map((b) => `${governingText(b)} (${b.label}${b.corrections.length ? ", corrected by you" : ""})`).join(" ");
        }
        if (/\b(garden|plant|bed)\b/.test(q) && s && s.garden) {
          const lines = gardenLines();
          return lines.length ? lines.join(" ") : "Your garden's beds stand unplanted in the record I can read here.";
        }
        if (/\b(finds|found|keepsake)\b/.test(q) && s && s.atlas) {
          return s.atlas.findsKept
            ? `Your Spark has found ${s.atlas.findsKept} small thing${s.atlas.findsKept === 1 ? "" : "s"} for you, each resting in your Life Atlas on this device${s.atlas.keepsakeTitles.length ? ` — among them ${s.atlas.keepsakeTitles.slice(0, 3).map((t) => `\u201c${t}\u201d`).join(", ")}` : ""}.`
            : "No finds rest in your Life Atlas yet — they come as you walk the site with your Spark.";
        }
        return null;
      }

      /* ---------------------------- UI ---------------------------- */

      const bar = el("div", "spark-mind-bar");
      const storyButton = el("button", "", "Our story");
      storyButton.type = "button";
      const knowButton = el("button", "", "What I know");
      knowButton.type = "button";
      const rulesButton = el("button", "", "How I decide");
      rulesButton.type = "button";
      bar.append(storyButton, knowButton, rulesButton);

      const knowView = el("div", "spark-mind-view");
      knowView.hidden = true;
      const rulesView = el("div", "spark-mind-view");
      rulesView.hidden = true;
      const rulesList = el("ol");
      for (const rule of ROUTER_RULES) rulesList.appendChild(el("li", "", rule));
      rulesView.append(el("h4", "", "The router's rules — the switchboard between my two minds"), rulesList);
      rulesView.append(el("p", "spark-mind-note", "The door keeps no conversation and no memory of you. Everything I believe lives on this device, in the list under \u201cWhat I know.\u201d"));

      api.panel.insertBefore(bar, api.formEl || null);
      api.panel.insertBefore(knowView, api.formEl || null);
      api.panel.insertBefore(rulesView, api.formEl || null);

      async function renderKnow() {
        knowView.replaceChildren();
        knowView.append(el("h4", "", "What my Spark knows for this talk"));
        const s = await gatherSources();
        const briefing = await gatherBriefing("");
        const sections = el("ul");
        for (const line of briefing.recordLines) sections.appendChild(el("li", "", line));
        if (briefing.liveLine) sections.appendChild(el("li", "", briefing.liveLine));
        knowView.append(sections);
        if (!s.garden) knowView.append(el("p", "spark-mind-note", "The garden's beds are read on pages where the Life Atlas stands open (the Garden, the Atlas, home) — on this page they aren't in my briefing."));
        if (!s.atlas) knowView.append(el("p", "spark-mind-note", "The Life Atlas isn't open on this page, so finds and keepsakes aren't in my briefing here."));

        knowView.append(el("h4", "", "What I believe about you"));
        if (!memory.beliefs.length) {
          knowView.append(el("p", "spark-mind-note", "Nothing yet. Beliefs appear here as I learn — each labelled observed or inferred, each open to your correction."));
        } else {
          const list = el("ul");
          for (const belief of memory.beliefs) {
            const item = el("li", `spark-mind-belief${belief.struck ? " is-struck" : ""}`);
            item.append(el("span", "", `${governingText(belief)} — ${belief.label}${belief.corrections.length ? ` (corrected ${belief.corrections.length}×; first believed: ${belief.text})` : ""}`));
            if (!belief.struck) {
              const correct = el("button", "", "Correct");
              correct.type = "button";
              correct.addEventListener("click", () => {
                const text = window.prompt("Set it right — your words are appended beside the old belief, never over it:", governingText(belief));
                if (text && text.trim()) {
                  correctBelief(memory, belief.id, text.trim(), new Date().toISOString().slice(0, 10));
                  persist();
                  void renderKnow();
                }
              });
              const strike = el("button", "", "Strike");
              strike.type = "button";
              strike.addEventListener("click", () => {
                strikeBelief(memory, belief.id);
                persist();
                void renderKnow();
              });
              item.append(correct, strike);
            }
            list.appendChild(item);
          }
          knowView.append(list);
        }

        if (memory.outcomes.length) {
          knowView.append(el("h4", "", "What you've already answered"));
          const list = el("ul");
          for (const o of memory.outcomes) {
            list.appendChild(el("li", "", `${o.kind}: ${o.decision}${o.decision === "passed" && o.passes ? ` (${o.passes} pass${o.passes === 1 ? "" : "es"})` : ""} — ${o.summary}`));
          }
          knowView.append(list);
        }

        const childLabel = el("label", "spark-mind-note");
        const childBox = document.createElement("input");
        childBox.type = "checkbox";
        childBox.checked = memory.childMode === true;
        childBox.addEventListener("change", () => {
          memory.childMode = childBox.checked;
          persist();
          api.say("spark", childBox.checked
            ? "Set. This Spark belongs to a young keeper: my talking now stays on this device entirely — nothing typed here travels, and my deeper voice rests."
            : "Set. This Spark's keeper is grown: my deeper voice at the door is open again, inside all the same fences.");
        });
        childLabel.append(childBox, document.createTextNode(" This Spark belongs to a child — talks stay on this device"));
        knowView.append(childLabel);
        knowView.append(el("p", "spark-mind-note", "When the deep mind answers, it is briefed from this list and your record above — and the briefing is never kept at the door."));
      }

      storyButton.addEventListener("click", () => {
        void (async () => {
          await gatherSources();
          const lines = storySoFar(recapInput());
          api.say("spark", lines.length ? lines.join(" ") : "Your record here is still young — the story writes itself as you keep your days.");
        })();
      });
      knowButton.addEventListener("click", () => {
        const opening = knowView.hidden;
        knowView.hidden = !opening;
        if (opening) void renderKnow();
      });
      rulesButton.addEventListener("click", () => {
        rulesView.hidden = !rulesView.hidden;
      });

      /* ------------- scheduling: the mind reads the timeline -------------
       * Nov 24, 2026 (Aaron's ruling): the Spark schedules on the
       * Sphere, where the day takes its mark. The mind everywhere
       * else reads the same timeline the Sphere's beacons project —
       * one computation (spark-schedule-core, lazy-loaded from this
       * script's own base) — and answers what stands, what is next,
       * and what is overdue wherever the planner stands on the page.
       * A scheduling REQUEST away from the Sphere is answered with
       * the road to the Sphere, never with a pretend write. In child
       * mode the whole scheduling family is refused in one plain
       * local line: nothing scheduled, moved, or read out. */
      const CHILD_SCHEDULE_LINE =
        "For a young keeper, schedules stay with the grown keepers — I do not set, move, or read out the planner in a child's conversation.";
      let schedCorePromise = null;
      function loadSchedCore() {
        if (typeof window !== "undefined" && window.SparkScheduleCore) return Promise.resolve(window.SparkScheduleCore);
        if (schedCorePromise) return schedCorePromise;
        schedCorePromise = new Promise((resolve) => {
          try {
            const script = document.createElement("script");
            script.src = `${scriptBase}spark-schedule-core.js`;
            script.onload = () => resolve(window.SparkScheduleCore || null);
            script.onerror = () => resolve(null);
            document.head.appendChild(script);
          } catch { resolve(null); }
        });
        return schedCorePromise;
      }
      async function scheduleAnswer(question) {
        const core = await loadSchedCore();
        if (!core) return null;
        const today = api.todayStamp();
        if (!today || !today.civilDate) return null;
        const ctx = {
          todayCivil: today.civilDate,
          todayPatternDay: today.patternDay != null ? today.patternDay : null,
          todayAnchorYear: core.anchorYearForCivil(today.civilDate)
        };
        const intent = core.parseScheduleRequest(question, ctx);
        if (!intent) return null;
        if (memory.childMode === true) return CHILD_SCHEDULE_LINE;
        if (intent.kind === "invalid") return intent.message;
        if (intent.kind === "ask") {
          const planner = typeof window !== "undefined" ? window.CodexLivingPlanner : null;
          if (!planner || !planner.allPlans) return null;
          let timeline = null;
          try { timeline = core.buildTimeline(await planner.allPlans(), ctx.todayCivil); } catch { return null; }
          const line = (e) => `“${e.title}”${e.time ? ` at ${core.timeWords(e.time)}` : ""}`;
          if (intent.ask === "day") {
            const entries = timeline.filter((e) => e.civilDate === intent.stamp.civilDate);
            return entries.length
              ? `On ${core.restateDay(intent.stamp)}: ${entries.map(line).join("; ")} — read from your planner record on this device.`
              : `Nothing stands on ${core.restateDay(intent.stamp)} — the day is open, by your planner record on this device.`;
          }
          if (intent.ask === "next") {
            const next = timeline.find((e) => e.state === "today" || e.state === "upcoming");
            return next
              ? `Next standing in your record: ${line(next)} — ${core.restateDay(next.stamp)}.`
              : "Nothing stands ahead in your record — the days in front of you are unwritten.";
          }
          if (intent.ask === "overdue") {
            const overdue = timeline.filter((e) => e.state === "overdue");
            return overdue.length
              ? `Overdue, waiting on you: ${overdue.slice(0, 4).map((e) => `${line(e)} — ${core.restateDay(e.stamp)}`).join("; ")}${overdue.length > 4 ? `; and ${overdue.length - 4} more` : ""}.`
              : "Nothing is overdue — every standing thing is today or ahead of you.";
          }
          const week = timeline.filter((e) => e.civilDate >= ctx.todayCivil && e.civilDate <= core.addDays(ctx.todayCivil, 6));
          if (!week.length) return "The week ahead is open — nothing stands in it yet, by your planner record on this device.";
          const parts = week.map((e) => `${core.restateDay(e.stamp)}: ${line(e)}`);
          return `Your week: ${parts.join(" · ")}`;
        }
        if (["schedule", "unschedule", "complete", "move", "generate"].includes(intent.kind)) {
          // A bare "schedule X" with no day could be many things;
          // only an unmistakable scheduling intent names the road.
          if (intent.kind === "schedule" && intent.needsDay) return null;
          return "Scheduling itself lives on the Sphere, where the day can take its mark: tell me there — on the Living Sphere page — and I will propose it, set it on your yes, and raise its beacon on the day. Here I can tell you what already stands: ask me what is on a day, what is next, or what is overdue.";
        }
        return null;
      }

      /* ------------------------- the flow ------------------------- */

      const flow = createAskFlow({
        say: (text, kind) => api.say(kind === "status" ? "status" : "spark", text),
        isChildMode: () => memory.childMode === true,
        localAnswer: async (question) => {
          const seatAnswer = api.seatAnswerLocally(question);
          if (seatAnswer != null) return seatAnswer;
          const schedAnswer = await scheduleAnswer(question);
          if (schedAnswer != null) return schedAnswer;
          if (!sourcesCache) await gatherSources();
          return mindLocalAnswer(question);
        },
        doorStatus: () => api.getDoorStatus(),
        gatherBriefing: async () => gatherBriefing(lastQuestion),
        doorAsk: async ({ briefing, tier, question }) => api.askDoor({ userText: question, briefing, tier }),
        onMind: (mind) => {
          memory.mindLog.push({ at: new Date().toISOString(), version: mind.version || null, tier: mind.tier || null, model: mind.model || null });
          memory.mindLog = memory.mindLog.slice(-40);
          persist();
        },
        onMemories: (list) => {
          for (const item of list) {
            addBelief(memory, { text: item.text, label: item.label, source: "conversation", at: new Date().toISOString().slice(0, 10) });
          }
          persist();
          api.say("status", "Kept in your record on this device — listed under \u201cWhat I know,\u201d where you can correct or strike it.");
        },
        onProposals: (list) => {
          for (const proposal of list) renderProposal(proposal);
        }
      });

      let lastQuestion = "";
      function renderProposal(proposal) {
        const gate = proposalGate(memory, proposal, moonIndexNow(), false);
        if (gate.gate !== "present") {
          api.say("status", `I had a thought about ${proposal.kind.replace(/-/g, " ")}, but you've already answered that one — it rests.`);
          return;
        }
        const card = el("div", "spark-mind-proposal");
        card.append(el("p", "", `${gate.returning ? "Returning once, as promised: " : "A proposal: "}${proposal.summary}`));
        const actions = el("div", "spark-mind-actions");
        const answer = (decision, line) => {
          recordOutcome(memory, { kind: proposal.kind, summary: proposal.summary, decision, moonIndex: moonIndexNow(), at: new Date().toISOString().slice(0, 10) });
          persist();
          card.replaceChildren(el("p", "", line));
        };
        const approve = el("button", "", "Approve");
        approve.type = "button";
        approve.addEventListener("click", () => answer("approved", "Approved — I'll carry it as a standing pattern, and never widen it on my own."));
        const pass = el("button", "", "Pass");
        pass.type = "button";
        pass.addEventListener("click", () => answer("passed", "Passed — I'll let it rest. Three passes in a row and it quiets for a moon."));
        const stop = el("button", "", "Stop suggesting this");
        stop.type = "button";
        stop.addEventListener("click", () => answer("stopped", "Stopped — I won't bring this kind again unless its facts truly change."));
        actions.append(approve, pass, stop);
        card.append(actions);
        api.log.appendChild(card);
        api.log.scrollTop = api.log.scrollHeight;
      }

      api.setAskHandler(async (question) => {
        lastQuestion = question;
        if (!api.getDoorStatus().known) {
          try { await api.refreshDoor(); } catch { /* the router hears "unreachable" and routes down */ }
        }
        await flow.ask(question);
        return true;
      });

      void gatherSources();
    }

    function init() {
      const Seat = typeof SparkAgentSeat !== "undefined" ? SparkAgentSeat : null;
      if (Seat && typeof Seat.attach === "function") Seat.attach(enhanceSeat);
    }

    if (typeof document !== "undefined") init();

    return {
      VERSION,
      MEMORY_KEY,
      memoryKeyFor,
      FENCE_NOTICE,
      CEILING_NOTICE,
      CHILD_NOTICE,
      ROUTER_RULES,
      blankMemory,
      loadMemory,
      saveMemory,
      addBelief,
      correctBelief,
      governingText,
      strikeBelief,
      beliefsForBriefing,
      fingerprintFor,
      recordOutcome,
      proposalGate,
      outcomesForBriefing,
      fenceCheck,
      route,
      briefingProfile,
      scorePassages,
      shapeBriefingForWire,
      storySoFar,
      createAskFlow
    };
  }
);
