/*
 * Pattern Breaker — the daily pattern puzzle (Play).
 *
 * Everyone receives the same puzzle on the same day. The puzzle is a
 * pure function of the day: the seed is the Pattern Day itself, read
 * from the canonical PatternCalendar (the site's only date authority)
 * by the page wiring at the bottom of this file. The engine above the
 * wiring knows nothing of the DOM, the clock, or storage, so the test
 * suite can walk a whole Pattern Year and prove every day's puzzle
 * fair before any visitor is served it.
 *
 * Fairness is proven, not hoped: every candidate puzzle carries its
 * generation spec, and verify() re-derives the answer from the spec by
 * a second path — recomputing the sequence, re-applying the predicate
 * to every tile, brute-forcing every ordering of a clue chain — and
 * counts how many defensible answers survive. generate() serves only
 * a candidate whose count is exactly one.
 *
 * The fences, by Aaron's word: no streaks, no guilt, nothing losable.
 * A solve is remembered on this device only; a missed day is never
 * mentioned; a wrong answer costs nothing and is met without blame.
 * The share card is words only — no route, no score.
 *
 * Difficulty breathes with the Moon (design, labelled as such): days
 * 1–9 of a Moon are gentle, 10–19 middle, 20–28 sharper — a pure
 * function of the same seed, so the whole world breathes together.
 */
(() => {
  "use strict";

  /* ---------------- deterministic core ---------------- */

  function hashSeed(text) {
    let h = 0x811c9dc5;
    const s = String(text);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seedKey) {
    const next = mulberry32(hashSeed(seedKey));
    return {
      next,
      int(n) { return Math.floor(next() * n); },
      range(lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
      pick(list) { return list[Math.floor(next() * list.length)]; },
      shuffle(list) {
        const out = list.slice();
        for (let i = out.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
        }
        return out;
      }
    };
  }

  function digitalRoot(n) {
    const v = Math.abs(Math.trunc(n));
    if (v === 0) return 0;
    return ((v - 1) % 9) + 1;
  }

  /* ---------------- the Codex's own material ---------------- */

  /* Moon frequencies, mirroring PatternCalendarData (Hz, Moons 1–13). */
  const MOON_FREQS = [144, 432, 369, 174, 528, 417, 963, 396, 285, 741, 852, 639, 111];
  const SHAPES = ["circle", "triangle", "square", "diamond", "crescent", "star", "drop", "flame"];
  const FILLS = ["gold", "teal", "ember", "green"];
  const PHASES = [
    "New Moon", "Waxing Crescent", "First Half", "Waxing Gibbous",
    "Full Moon", "Waning Gibbous", "Last Half", "Waning Crescent"
  ];
  const LETTERS = [
    { glyph: "א", name: "Aleph" }, { glyph: "ב", name: "Beth" },
    { glyph: "ג", name: "Gimel" }, { glyph: "ד", name: "Dalet" },
    { glyph: "ה", name: "He" }, { glyph: "ו", name: "Vav" },
    { glyph: "ז", name: "Zayin" }, { glyph: "ח", name: "Chet" }
  ];
  const KINDS = ["sequence", "oddone", "chain"];
  const SHARE_VERBS = {
    sequence: "I saw what was missing",
    oddone: "I found the one that breaks it",
    chain: "I followed the chain to its end"
  };

  /* ---------------- items ---------------- */

  const num = (v, unit) => ({ t: "num", v, unit: unit || null });
  const shapeTile = (shape, fill, filled, dots) => ({ t: "shape", shape, fill, filled, dots });
  const phaseTile = (p) => ({ t: "phase", p });
  const letterTile = (letter) => ({ t: "letter", glyph: letter.glyph, name: letter.name });

  function itemEquals(a, b) {
    if (!a || !b || a.t !== b.t) return false;
    if (a.t === "num") return a.v === b.v;
    if (a.t === "phase") return a.p === b.p;
    if (a.t === "letter") return a.glyph === b.glyph;
    if (a.t === "shape") {
      return a.shape === b.shape && a.fill === b.fill &&
        a.filled === b.filled && a.dots === b.dots;
    }
    return false;
  }

  /* Build the four answer options around a known answer. Returns null
   * when the distractor pool cannot yield three honest near-misses, so
   * the caller can draw again from the same deterministic stream. */
  function buildOptions(rng, answer, pool, equals) {
    const eq = equals || itemEquals;
    const chosen = [answer];
    for (const candidate of rng.shuffle(pool.slice())) {
      if (chosen.length >= 4) break;
      if (eq(candidate, answer)) continue;
      if (chosen.some((o) => eq(o, candidate))) continue;
      chosen.push(candidate);
    }
    if (chosen.length < 4) return null;
    return rng.shuffle(chosen).map((item, i) => ({
      key: "abcd"[i], item, correct: eq(item, answer)
    }));
  }

  /* ---------------- sequence: numbers ---------------- */

  function seqNumValue(spec, i) {
    if (spec.rule === "steps" || spec.rule === "ladder") return spec.start + spec.step * i;
    if (spec.rule === "double") return spec.start * Math.pow(2, i);
    if (spec.rule === "alt") {
      let v = spec.start;
      for (let k = 0; k < i; k++) v += (k % 2 === 0 ? spec.plus : -spec.minus);
      return v;
    }
    return null;
  }

  function genSequenceNumbers(rng, ctx, tier) {
    const rules = tier === 1
      ? ["steps", "ladder", "roots"]
      : ["steps", "ladder", "roots", "double", "alt"];
    const rule = rng.pick(rules);
    const shown = 4 + tier;

    if (rule === "roots") {
      const cycle = [3, 6, 9];
      const offset = rng.int(3);
      const rootAt = (i) => cycle[(offset + i) % 3];
      const used = new Set();
      const fresh = (root) => {
        for (let tries = 0; tries < 40; tries++) {
          const v = root + 9 * rng.range(1, 14);
          if (!used.has(v)) { used.add(v); return v; }
        }
        return null;
      };
      const board = [];
      for (let i = 0; i < shown; i++) {
        const v = fresh(rootAt(i));
        if (v === null) return null;
        board.push(num(v));
      }
      const answerRoot = rootAt(shown);
      const answerValue = fresh(answerRoot);
      if (answerValue === null) return null;
      const otherRoots = [1, 2, 4, 5, 7, 8, 3, 6, 9].filter((r) => r !== answerRoot);
      const pool = [];
      for (const r of rng.shuffle(otherRoots).slice(0, 3)) {
        const v = fresh(r);
        if (v === null) return null;
        pool.push(num(v));
      }
      const options = buildOptions(rng, num(answerValue), pool);
      if (!options) return null;
      return {
        family: "numbers", spec: { rule, offset, shown },
        lead: "A walk of numbers, and one step of it is still missing.",
        question: "Which number walks next?",
        board: { tiles: board }, options,
        ruleText: "Add each number's digits until one digit remains — its root. " +
          `The roots walk ${[0, 1, 2, 3].map((k) => rootAt(shown - 3 + k)).join(", ")}… ` +
          `so the next root is ${answerRoot}, and only one choice carries it.`
      };
    }

    let spec;
    if (rule === "steps") {
      spec = { rule, start: rng.range(2, 36), step: rng.pick([3, 6, 9]), shown };
    } else if (rule === "ladder") {
      spec = { rule, start: ctx.freqHz, step: rng.pick([ctx.freqHz, 111]), shown };
    } else if (rule === "double") {
      spec = { rule, start: rng.pick([3, 6, 9, 12]), shown };
    } else {
      spec = {
        rule, start: rng.range(10, 60),
        plus: rng.pick([6, 9, 12]), minus: rng.pick([3, 4, 5]), shown
      };
    }
    const board = [];
    for (let i = 0; i < shown; i++) board.push(num(seqNumValue(spec, i), rule === "ladder" ? "Hz" : null));
    const answer = seqNumValue(spec, shown);
    const near = rule === "double"
      ? [answer + board[shown - 1].v, answer - board[shown - 1].v, answer + 9, answer - 9, answer + spec.start]
      : rule === "alt"
        ? [answer + spec.plus, answer - spec.plus, answer + spec.minus, answer - spec.minus, answer + 1]
        : [answer + spec.step, answer - spec.step, answer + 1, answer - 1, answer + 2 * spec.step, answer + 9];
    const options = buildOptions(rng, num(answer, rule === "ladder" ? "Hz" : null),
      near.filter((v) => v > 0).map((v) => num(v, rule === "ladder" ? "Hz" : null)));
    if (!options) return null;
    const ruleText =
      rule === "steps" ? `Each step adds ${spec.step}. The walk climbs by ${spec.step}s, and the next step lands on ${answer}.` :
      rule === "ladder" ? `The tones climb by ${spec.step} Hz each time, stacked from this Moon's own ${spec.start} Hz. The next tone is ${answer} Hz.` :
      rule === "double" ? `Each term doubles the one before it: ${spec.start}, ${spec.start * 2}, ${spec.start * 4}… The next doubling lands on ${answer}.` :
      `The steps alternate: add ${spec.plus}, take ${spec.minus}, add ${spec.plus}, take ${spec.minus}. The next step adds ${spec.plus}, landing on ${answer}.`;
    return {
      family: "numbers", spec,
      lead: "A walk of numbers, and one step of it is still missing.",
      question: "Which number walks next?",
      board: { tiles: board }, options, ruleText
    };
  }

  /* ---------------- sequence: shapes ---------------- */

  function shapeTileAt(spec, i) {
    return shapeTile(
      spec.shapeSeq[i % spec.shapeSeq.length],
      spec.fillSeq[i % spec.fillSeq.length],
      spec.fillAlt ? i % 2 === 0 : true,
      ((spec.dotStart - 1 + spec.dotStep * i) % 4) + 1
    );
  }

  function genSequenceShapes(rng, ctx, tier) {
    const shapePool = rng.shuffle(SHAPES.slice());
    const fillPool = rng.shuffle(FILLS.slice());
    const spec = {
      shapeSeq: shapePool.slice(0, tier === 1 ? 2 : rng.pick([2, 3])),
      fillSeq: fillPool.slice(0, rng.pick([2, 3])),
      dotStart: rng.range(1, 4),
      dotStep: rng.pick([1, 3]),
      fillAlt: tier === 3,
      shown: 4 + tier
    };
    const board = [];
    for (let i = 0; i < spec.shown; i++) board.push(shapeTileAt(spec, i));
    const answer = shapeTileAt(spec, spec.shown);
    const otherShapes = SHAPES.filter((s) => s !== answer.shape);
    const otherFills = FILLS.filter((f) => f !== answer.fill);
    const pool = [
      shapeTile(rng.pick(otherShapes), answer.fill, answer.filled, answer.dots),
      shapeTile(answer.shape, rng.pick(otherFills), answer.filled, answer.dots),
      shapeTile(answer.shape, answer.fill, answer.filled, (answer.dots % 4) + 1),
      shapeTile(answer.shape, answer.fill, !answer.filled, answer.dots),
      shapeTile(rng.pick(otherShapes), rng.pick(otherFills), answer.filled, answer.dots)
    ];
    const options = buildOptions(rng, answer, pool);
    if (!options) return null;
    return {
      family: "shapes", spec,
      lead: "A pattern of shapes is walking. One step of it is still missing.",
      question: "Which tile walks next?",
      board: { tiles: board }, options,
      ruleText: `Three walks at once: the shapes cycle ${spec.shapeSeq.join(", ")}; ` +
        `the colours walk ${spec.fillSeq.join(", ")}; the dots count upward through four. ` +
        "Only one tile keeps all three walks at once."
    };
  }

  /* ---------------- sequence: moon phases ---------------- */

  function genSequencePhases(rng, ctx, tier) {
    const spec = {
      start: rng.int(8),
      step: tier === 1 ? 1 : rng.pick([1, 1, 2, -1]),
      shown: 4 + tier
    };
    const at = (i) => ((spec.start + spec.step * i) % 8 + 8) % 8;
    const board = [];
    for (let i = 0; i < spec.shown; i++) board.push(phaseTile(at(i)));
    const answer = phaseTile(at(spec.shown));
    const pool = [1, -1, 2, -2, 4].map((off) => phaseTile(((answer.p + off) % 8 + 8) % 8));
    const options = buildOptions(rng, answer, pool);
    if (!options) return null;
    return {
      family: "phases", spec,
      lead: "The Moon is walking her phases. One step of the walk is still missing.",
      question: "Which phase walks next?",
      board: { tiles: board }, options,
      ruleText: "The phases walk in their order — New, Crescent, Half, Gibbous, Full, " +
        "and back down the other side — one step at a time, never skipping. " +
        `The next step is ${PHASES[answer.p]}.`
    };
  }

  /* ---------------- odd one out ---------------- */

  const POINTED = ["triangle", "diamond", "star"];
  const ROUND = ["circle", "drop", "crescent"];

  function oddPredicate(spec) {
    if (spec.family === "roots") return (tile) => digitalRoot(tile.v) === spec.root;
    if (spec.family === "family") {
      return (tile) => (POINTED.includes(tile.shape) ? "pointed" : "round") === spec.group;
    }
    if (spec.family === "fill") return (tile) => tile.filled === true;
    if (spec.family === "dots") return (tile) => tile.dots % 2 === 0;
    if (spec.family === "direction") return (tile) => tile.p <= 4;
    return () => false;
  }

  function genOddOne(rng, ctx, tier) {
    const families = tier === 1
      ? ["roots", "family", "fill"]
      : ["roots", "family", "fill", "dots", "direction"];
    const family = rng.pick(families);
    const count = 5 + tier;
    let tiles = [];
    let spec = { family };
    let ruleText = "";

    if (family === "roots") {
      spec.root = rng.pick([3, 6, 9]);
      const used = new Set();
      const fresh = (root) => {
        for (let tries = 0; tries < 40; tries++) {
          const v = root + 9 * rng.range(1, 14);
          if (!used.has(v)) { used.add(v); return v; }
        }
        return null;
      };
      for (let i = 0; i < count - 1; i++) {
        const v = fresh(spec.root);
        if (v === null) return null;
        tiles.push(num(v));
      }
      const breakerRoot = rng.pick([1, 2, 4, 5, 7, 8].filter((r) => r !== spec.root));
      const bv = fresh(breakerRoot);
      if (bv === null) return null;
      tiles.push(num(bv));
      spec.breakerRoot = breakerRoot;
      ruleText = `Every number here roots to ${spec.root} — add the digits until one remains. ` +
        `Every one, that is, but one: its root is ${breakerRoot}.`;
    } else if (family === "family") {
      spec.group = rng.pick(["pointed", "round"]);
      const home = spec.group === "pointed" ? POINTED : ROUND;
      const away = spec.group === "pointed" ? ROUND : POINTED;
      const fill = rng.pick(FILLS);
      const dots = rng.range(1, 4);
      for (let i = 0; i < count - 1; i++) tiles.push(shapeTile(rng.pick(home), fill, true, dots));
      tiles.push(shapeTile(rng.pick(away), fill, true, dots));
      ruleText = spec.group === "pointed"
        ? "Every shape here comes to a point — except one. One of them is round."
        : "Every shape here is round — except one. One of them comes to a point.";
    } else if (family === "fill") {
      const shape = rng.pick(SHAPES);
      const fill = rng.pick(FILLS);
      const dots = rng.range(1, 4);
      for (let i = 0; i < count - 1; i++) tiles.push(shapeTile(shape, fill, true, dots));
      tiles.push(shapeTile(shape, fill, false, dots));
      ruleText = "Every tile here is filled with light — except one. One stands in outline only.";
    } else if (family === "dots") {
      const shape = rng.pick(SHAPES);
      const fill = rng.pick(FILLS);
      for (let i = 0; i < count - 1; i++) tiles.push(shapeTile(shape, fill, true, rng.pick([2, 4])));
      tiles.push(shapeTile(shape, fill, true, rng.pick([1, 3])));
      ruleText = "Count the dots: every tile carries an even number — except one. One carries an odd count.";
    } else {
      for (let i = 0; i < count - 1; i++) tiles.push(phaseTile(rng.range(0, 4)));
      tiles.push(phaseTile(rng.range(5, 7)));
      ruleText = "Every phase here is waxing — the light is growing — except one. One is already waning.";
    }

    tiles = rng.shuffle(tiles);
    const conform = oddPredicate(spec);
    const breakerIndex = tiles.findIndex((t) => !conform(t));
    if (breakerIndex < 0) return null;
    return {
      family, spec,
      lead: "These belong together — all but one. One of them breaks the pattern.",
      question: "Which one breaks it?",
      board: { tiles },
      options: tiles.map((tile, i) => ({ key: "abcd"[i % 4] + i, item: tile, tileIndex: i, correct: i === breakerIndex })),
      answerIndex: breakerIndex,
      ruleText
    };
  }

  /* ---------------- chain: the ordering ---------------- */

  function permutations(list) {
    if (list.length <= 1) return [list.slice()];
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const rest = list.slice(0, i).concat(list.slice(i + 1));
      for (const tail of permutations(rest)) out.push([list[i]].concat(tail));
    }
    return out;
  }

  function genChainOrder(rng, ctx, tier) {
    const n = 3 + tier;
    const items = rng.shuffle(LETTERS.slice()).slice(0, n);
    const order = rng.shuffle(items.map((_, i) => i)); /* hidden order: item indices */
    const adjacent = [];
    for (let k = 0; k < n - 1; k++) adjacent.push([order[k], order[k + 1]]);
    let clues = adjacent;
    if (tier >= 2 && n >= 4) {
      /* Try a leaner clue set: drop one link, add a skip clue. The
       * verifier decides whether the chain still holds exactly one
       * ordering; if not, the full chain stands. */
      const lean = adjacent.filter((_, k) => k !== 1);
      lean.push([order[0], order[2]]);
      const specLean = { items: items.map((l) => LETTERS.indexOf(l)), clues: lean };
      if (countOrderSolutions(specLean) === 1) clues = lean;
    }
    const spec = { items: items.map((l) => LETTERS.indexOf(l)), clues };
    const askKind = rng.pick(["first", "after", "before"]);
    let ask, answerItem;
    if (askKind === "first" || (askKind === "after" && false)) {
      spec.ask = { type: "first" };
      answerItem = items[order[0]];
    } else if (askKind === "after") {
      const k = rng.int(n - 1);
      spec.ask = { type: "after", of: order[k] };
      answerItem = items[order[k + 1]];
      ask = items[order[k]];
    } else {
      const k = rng.range(1, n - 1);
      spec.ask = { type: "before", of: order[k] };
      answerItem = items[order[k - 1]];
      ask = items[order[k]];
    }
    const options = buildOptions(rng, letterTile(answerItem),
      items.filter((l) => l !== answerItem).map(letterTile));
    if (!options) return null;
    const clueLines = clues.map(([a, b], i) => {
      const flip = (i + rng.int(2)) % 2 === 0;
      return flip
        ? `${items[b].name} stands after ${items[a].name}.`
        : `${items[a].name} stands before ${items[b].name}.`;
    });
    const question = spec.ask.type === "first"
      ? "Which letter stands first in the chain?"
      : spec.ask.type === "after"
        ? `Which letter stands immediately after ${ask.name}?`
        : `Which letter stands immediately before ${ask.name}?`;
    const orderNames = order.map((idx) => items[idx].name).join(", ");
    return {
      family: "order", spec,
      lead: "A small chain of clues, in the letters of the Aleph-Beth.",
      question,
      board: { lines: clueLines },
      options,
      ruleText: `The clues chain the letters into one order only: ${orderNames}. Every other ordering breaks a clue.`
    };
  }

  function countOrderSolutions(spec) {
    const items = spec.items;
    const perms = permutations(items.map((_, i) => i));
    let count = 0;
    for (const perm of perms) {
      const pos = new Array(items.length);
      perm.forEach((itemIdx, position) => { pos[itemIdx] = position; });
      if (spec.clues.every(([a, b]) => pos[a] < pos[b])) count++;
    }
    return count;
  }

  /* ---------------- chain: the tones ---------------- */

  function applyOps(start, ops) {
    let v = start;
    for (const op of ops) {
      if (op.op === "double") v *= 2;
      else if (op.op === "halve") v /= 2;
      else if (op.op === "add") v += op.n;
    }
    return v;
  }

  function genChainTone(rng, ctx, tier) {
    const opCount = 1 + tier;
    let value = ctx.freqHz;
    const ops = [];
    for (let i = 0; i < opCount; i++) {
      const choices = ["add111", "add369"];
      if (value <= 2000) choices.push("double");
      if (value % 2 === 0 && value > 100) choices.push("halve");
      const pick = rng.pick(choices);
      if (pick === "double") { ops.push({ op: "double" }); value *= 2; }
      else if (pick === "halve") { ops.push({ op: "halve" }); value /= 2; }
      else if (pick === "add111") { ops.push({ op: "add", n: 111 }); value += 111; }
      else { ops.push({ op: "add", n: 369 }); value += 369; }
    }
    const spec = { start: ctx.freqHz, ops };
    const answer = value;
    const variants = [
      applyOps(spec.start, ops.slice(0, -1)),
      applyOps(spec.start, ops.map((o, i) => (i === 0 && o.op === "add" ? { op: "add", n: o.n === 111 ? 369 : 111 } : o))),
      answer + 111, answer - 111, answer + 369
    ];
    const options = buildOptions(rng, num(answer, "Hz"),
      variants.filter((v) => v > 0 && Number.isInteger(v)).map((v) => num(v, "Hz")));
    if (!options) return null;
    const lines = [`Begin at ${spec.start} Hz — this Moon's own tone.`].concat(
      ops.map((o) => (o.op === "double" ? "Double it." : o.op === "halve" ? "Halve it." : `Add ${o.n}.`))
    );
    let walk = spec.start;
    const steps = ops.map((o) => {
      const before = walk;
      walk = applyOps(walk, [o]);
      return o.op === "double" ? `${before} × 2 = ${walk}` :
        o.op === "halve" ? `${before} ÷ 2 = ${walk}` : `${before} + ${o.n} = ${walk}`;
    });
    return {
      family: "tone", spec,
      lead: "A chain of tones, each link worked by hand.",
      question: "What tone stands at the end of the chain?",
      board: { lines },
      options,
      ruleText: `${steps.join("; ")}. The chain ends at ${answer} Hz.`
    };
  }

  /* ---------------- the verifier ----------------
   * A second path from spec to answer. It never reads the maker's
   * correct flags except to compare against them at the end; it
   * recomputes, and counts how many answers survive. */

  function verify(puzzle) {
    const spec = puzzle.spec;
    const fail = { ok: false, solutions: 0 };
    if (!spec) return fail;

    if (puzzle.kind === "sequence") {
      let matches;
      if (puzzle.family === "numbers" && spec.rule === "roots") {
        const cycle = [3, 6, 9];
        const rootAt = (i) => cycle[(spec.offset + i) % 3];
        const boardOk = puzzle.board.tiles.every((t, i) => digitalRoot(t.v) === rootAt(i));
        if (!boardOk) return fail;
        const want = rootAt(spec.shown);
        matches = puzzle.options.filter((o) => digitalRoot(o.item.v) === want).length;
        return { ok: matches === 1, solutions: matches };
      }
      if (puzzle.family === "numbers") {
        const boardOk = puzzle.board.tiles.every((t, i) => t.v === seqNumValue(spec, i));
        if (!boardOk) return fail;
        const answer = seqNumValue(spec, spec.shown);
        matches = puzzle.options.filter((o) => o.item.v === answer).length;
        return { ok: matches === 1, solutions: matches };
      }
      if (puzzle.family === "shapes") {
        const boardOk = puzzle.board.tiles.every((t, i) => itemEquals(t, shapeTileAt(spec, i)));
        if (!boardOk) return fail;
        const answer = shapeTileAt(spec, spec.shown);
        matches = puzzle.options.filter((o) => itemEquals(o.item, answer)).length;
        return { ok: matches === 1, solutions: matches };
      }
      if (puzzle.family === "phases") {
        const at = (i) => ((spec.start + spec.step * i) % 8 + 8) % 8;
        const boardOk = puzzle.board.tiles.every((t, i) => t.p === at(i));
        if (!boardOk) return fail;
        const answer = at(spec.shown);
        matches = puzzle.options.filter((o) => o.item.p === answer).length;
        return { ok: matches === 1, solutions: matches };
      }
      return fail;
    }

    if (puzzle.kind === "oddone") {
      const conform = oddPredicate(spec);
      const breakers = puzzle.board.tiles
        .map((t, i) => (conform(t) ? -1 : i)).filter((i) => i >= 0);
      if (breakers.length !== 1) return { ok: false, solutions: breakers.length };
      const flagged = puzzle.options.filter((o) => o.correct);
      const ok = flagged.length === 1 && flagged[0].tileIndex === breakers[0];
      return { ok, solutions: breakers.length };
    }

    if (puzzle.kind === "chain" && puzzle.family === "tone") {
      const answer = applyOps(spec.start, spec.ops);
      const matches = puzzle.options.filter((o) => o.item.v === answer).length;
      return { ok: matches === 1, solutions: matches };
    }

    if (puzzle.kind === "chain" && puzzle.family === "order") {
      const solutions = countOrderSolutions(spec);
      if (solutions !== 1) return { ok: false, solutions };
      /* The unique ordering, recovered by force, gives the answer. */
      const items = spec.items;
      const perms = permutations(items.map((_, i) => i));
      const pos = new Array(items.length);
      for (const perm of perms) {
        const p = new Array(items.length);
        perm.forEach((itemIdx, position) => { p[itemIdx] = position; });
        if (spec.clues.every(([a, b]) => p[a] < p[b])) { perm.forEach((itemIdx, position) => { pos[itemIdx] = position; }); break; }
      }
      const order = items.map((_, i) => i).sort((a, b) => pos[a] - pos[b]);
      let answerIdx;
      if (spec.ask.type === "first") answerIdx = order[0];
      else if (spec.ask.type === "after") answerIdx = order[pos[spec.ask.of] + 1];
      else answerIdx = order[pos[spec.ask.of] - 1];
      const answerGlyph = LETTERS[items[answerIdx]].glyph;
      const matches = puzzle.options.filter((o) => o.item.glyph === answerGlyph).length;
      return { ok: matches === 1, solutions };
    }

    return fail;
  }

  /* ---------------- generation, gated on the verifier ---------------- */

  function tierFor(dayOfMoon) {
    if (!dayOfMoon) return 1;
    if (dayOfMoon <= 9) return 1;
    if (dayOfMoon <= 19) return 2;
    return 3;
  }

  function fallbackPuzzle(ctx, kind, tier) {
    /* Hand-provable constructions, used only if the drawn stream ever
     * failed forty gates in a row. Each is fair by inspection. */
    const rng = makeRng(ctx.seedKey + ":fallback");
    if (kind === "oddone") {
      const p = genOddOne(makeRng(ctx.seedKey + ":fallback-odd"), ctx, 1);
      if (p) { p.kind = kind; p.tier = tier; return finish(p, ctx, kind, tier); }
    }
    if (kind === "chain") {
      const spec = { start: ctx.freqHz, ops: [{ op: "double" }, { op: "add", n: 111 }] };
      const answer = applyOps(spec.start, spec.ops);
      const options = buildOptions(rng, num(answer, "Hz"),
        [answer + 111, answer - 111, answer + 369].map((v) => num(v, "Hz")));
      const p = {
        family: "tone", spec,
        lead: "A chain of tones, each link worked by hand.",
        question: "What tone stands at the end of the chain?",
        board: { lines: [`Begin at ${spec.start} Hz — this Moon's own tone.`, "Double it.", "Add 111."] },
        options,
        ruleText: `${spec.start} × 2 = ${spec.start * 2}; ${spec.start * 2} + 111 = ${answer}. The chain ends at ${answer} Hz.`
      };
      return finish(p, ctx, kind, tier);
    }
    const step = [3, 6, 9][hashSeed(ctx.seedKey) % 3];
    const start = 3 + (hashSeed(ctx.seedKey) % 20);
    const spec = { rule: "steps", start, step, shown: 5 };
    const board = [];
    for (let i = 0; i < 5; i++) board.push(num(start + step * i));
    const answer = start + step * 5;
    const options = buildOptions(rng, num(answer),
      [answer + step, answer - step, answer + 1].map((v) => num(v)));
    const p = {
      family: "numbers", spec,
      lead: "A walk of numbers, and one step of it is still missing.",
      question: "Which number walks next?",
      board: { tiles: board }, options,
      ruleText: `Each step adds ${step}. The walk climbs by ${step}s, and the next step lands on ${answer}.`
    };
    return finish(p, ctx, "sequence", tier);
  }

  function finish(puzzle, ctx, kind, tier) {
    puzzle.kind = kind;
    puzzle.tier = tier;
    puzzle.seedKey = ctx.seedKey;
    puzzle.patternDay = ctx.dayOfPatternYear || null;
    puzzle.dayLabel = ctx.dayLabel;
    puzzle.shareLine = `${SHARE_VERBS[kind]} — ${ctx.dayLabel}`;
    return puzzle;
  }

  function generate(ctx) {
    const kindIndex = ctx.dayOfPatternYear
      ? (ctx.dayOfPatternYear - 1) % KINDS.length
      : hashSeed(ctx.seedKey) % KINDS.length;
    const kind = KINDS[kindIndex];
    const tier = tierFor(ctx.dayOfMoon);
    const rng = makeRng(ctx.seedKey);
    for (let attempt = 0; attempt < 48; attempt++) {
      let candidate = null;
      if (kind === "sequence") {
        const family = rng.pick(["numbers", "numbers", "shapes", "phases"]);
        candidate = family === "numbers" ? genSequenceNumbers(rng, ctx, tier)
          : family === "shapes" ? genSequenceShapes(rng, ctx, tier)
          : genSequencePhases(rng, ctx, tier);
      } else if (kind === "oddone") {
        candidate = genOddOne(rng, ctx, tier);
      } else {
        candidate = rng.pick(["order", "tone"]) === "order"
          ? genChainOrder(rng, ctx, tier)
          : genChainTone(rng, ctx, tier);
      }
      if (!candidate) continue;
      candidate = finish(candidate, ctx, kind, tier);
      const verdict = verify(candidate);
      if (verdict.ok && verdict.solutions === 1) return candidate;
    }
    return fallbackPuzzle(ctx, kind, tier);
  }

  function signature(puzzle) {
    return JSON.stringify({
      k: puzzle.kind, f: puzzle.family,
      b: puzzle.board, o: puzzle.options.map((o) => o.item)
    });
  }

  globalThis.PatternBreaker = Object.freeze({
    generate, verify, signature,
    digitalRoot, tierFor,
    constants: Object.freeze({ KINDS, PHASES, LETTERS, MOON_FREQS })
  });

  /* ---------------- the page ----------------
   * Everything below runs only in a browser. The engine above is
   * served from this same file but never touches the page. */

  if (typeof document === "undefined") return;

  const STORAGE_KEY = "sof.pattern-breaker.v1";
  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function loadRecord() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (parsed && typeof parsed === "object" && parsed.solves) return parsed;
    } catch { /* a fresh record is a fine place to start */ }
    return { version: 1, solves: {} };
  }

  function saveRecord(record) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch { /* the day still plays */ }
  }

  /* Today's coordinate, read only through the canonical calendar —
   * the same public surface the Moons room uses. */
  function todayContext() {
    const calendar = globalThis.PatternCalendar;
    const data = globalThis.PatternCalendarData;
    if (!calendar || typeof calendar.fromCivilDate !== "function") return null;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const get = (t) => (parts.find((p) => p.type === t) || {}).value;
    if (!get("year")) return null;
    const iso = `${get("year")}-${get("month")}-${get("day")}`;
    const summary = calendar.fromCivilDate({ date: iso, timeZone, boundaryMode: "midnight" });
    const civil = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
    if (summary.insideCountedYear) {
      const moon = data && Array.isArray(data.moons) ? data.moons[summary.moon - 1] : null;
      const freqHz = moon ? parseInt(moon.freq, 10) : MOON_FREQS[summary.moon - 1];
      return {
        ctx: {
          seedKey: `pb:${summary.patternYear}:${summary.dayOfPatternYear}`,
          patternYear: summary.patternYear,
          dayOfPatternYear: summary.dayOfPatternYear,
          moon: summary.moon,
          dayOfMoon: summary.day,
          freqHz,
          moonName: summary.moonName,
          dayLabel: `Pattern Day ${summary.dayOfPatternYear}`
        },
        dayLine: `Moon ${summary.moon} · ${summary.moonName} · Day ${summary.day} · Pattern Day ${summary.dayOfPatternYear}`,
        civilLine: civil
      };
    }
    /* The Day Out of Time (and the Deep Time Day) stand outside the
     * count; the puzzle still stands. Its flavour borrows a Moon by
     * the year, gently, and its label is the day's own name. */
    const flavourMoon = ((summary.patternYear + (summary.intercalaryIndex || 1)) % 13) + 1;
    return {
      ctx: {
        seedKey: `pb:${summary.patternYear}:X${summary.intercalaryIndex || 1}`,
        patternYear: summary.patternYear,
        dayOfPatternYear: null,
        moon: flavourMoon,
        dayOfMoon: null,
        freqHz: MOON_FREQS[flavourMoon - 1],
        moonName: summary.moonName,
        dayLabel: summary.moonName
      },
      dayLine: `${summary.moonName} · Pattern Year ${summary.patternYear}`,
      civilLine: civil
    };
  }

  /* ---------------- drawing the tiles ---------------- */

  const FILL_CLASS = { gold: "pb-f-gold", teal: "pb-f-teal", ember: "pb-f-ember", green: "pb-f-green" };

  function shapeSvg(item) {
    const cls = FILL_CLASS[item.fill] || "pb-f-gold";
    const paint = item.filled
      ? `fill="currentColor" stroke="none"`
      : `fill="none" stroke="currentColor" stroke-width="2.5"`;
    let body = "";
    if (item.shape === "circle") body = `<circle cx="24" cy="22" r="12" ${paint}/>`;
    else if (item.shape === "triangle") body = `<path d="M24 9 L37 34 L11 34 Z" ${paint}/>`;
    else if (item.shape === "square") body = `<rect x="12" y="10" width="24" height="24" rx="2" ${paint}/>`;
    else if (item.shape === "diamond") body = `<path d="M24 7 L37 22 L24 37 L11 22 Z" ${paint}/>`;
    else if (item.shape === "crescent") body = `<path d="M31 8 A16 16 0 1 0 31 36 A12.5 16 0 1 1 31 8 Z" ${paint}/>`;
    else if (item.shape === "star") body = `<path d="M24 5 L28.5 19.5 L43 22 L28.5 24.5 L24 39 L19.5 24.5 L5 22 L19.5 19.5 Z" ${paint}/>`;
    else if (item.shape === "drop") body = `<path d="M24 5 C24 5 12.5 20 12.5 27.5 A11.5 11.5 0 0 0 35.5 27.5 C35.5 20 24 5 24 5 Z" ${paint}/>`;
    else if (item.shape === "flame") body = `<path d="M24 4 C27.5 12 35 17.5 35 27.5 A11 11.5 0 0 1 13 27.5 C13 18.5 20.5 13 24 4 Z" ${paint}/>`;
    let dots = "";
    for (let d = 0; d < item.dots; d++) {
      const cx = 24 + (d - (item.dots - 1) / 2) * 7;
      dots += `<circle cx="${cx}" cy="43.5" r="1.8" fill="currentColor" stroke="none"/>`;
    }
    return `<svg class="pb-glyph ${cls}" viewBox="0 0 48 48" aria-hidden="true">${body}${dots}</svg>`;
  }

  function phaseSvg(p) {
    /* The lit face, carved by one shadow ellipse per phase. */
    const shadow = [
      { cx: 20, rx: 16 }, { cx: 13.5, rx: 10.5 }, { cx: 12.5, rx: 4.5 },
      { cx: 6.5, rx: 3.2 }, null,
      { cx: 33.5, rx: 3.2 }, { cx: 27.5, rx: 4.5 }, { cx: 26.5, rx: 10.5 }
    ][p];
    const shade = shadow
      ? `<ellipse cx="${shadow.cx}" cy="20" rx="${shadow.rx}" ry="15.6" fill="var(--bg)" opacity="0.92"/>`
      : "";
    return `<svg class="pb-glyph pb-phase" viewBox="0 0 40 40" aria-hidden="true">` +
      `<circle cx="20" cy="20" r="16" fill="var(--gold)" opacity="0.9"/>${shade}` +
      `<circle cx="20" cy="20" r="16" fill="none" stroke="var(--line-strong)" stroke-width="1"/></svg>`;
  }

  function tileHTML(item) {
    if (item.t === "num") {
      return `<span class="pb-num">${item.v}${item.unit ? `<span class="pb-unit"> ${item.unit}</span>` : ""}</span>`;
    }
    if (item.t === "shape") return shapeSvg(item);
    if (item.t === "phase") {
      return `${phaseSvg(item.p)}<span class="pb-tile-name">${PHASES[item.p]}</span>`;
    }
    if (item.t === "letter") {
      return `<span class="pb-letter">${item.glyph}</span><span class="pb-tile-name">${item.name}</span>`;
    }
    return "";
  }

  function tileLabel(item) {
    if (item.t === "num") return `${item.v}${item.unit ? " " + item.unit : ""}`;
    if (item.t === "shape") return `${item.shape}, ${item.fill}${item.filled ? "" : ", outline"}, ${item.dots} dots`;
    if (item.t === "phase") return PHASES[item.p];
    if (item.t === "letter") return item.name;
    return "";
  }

  /* ---------------- the keeper's voice ---------------- */

  function setKeeper(line) {
    const el = document.getElementById("pb-keeper-line");
    if (el) el.textContent = line;
  }

  function sparkBurst() {
    if (reducedMotion) return;
    const station = document.getElementById("pb-spark-station");
    if (!station) return;
    station.classList.add("pb-lit");
    for (let i = 0; i < 10; i++) {
      const bit = document.createElement("span");
      bit.className = "pb-spark-bit";
      const angle = (i / 10) * Math.PI * 2;
      const dist = 34 + (i % 3) * 12;
      bit.style.setProperty("--pb-dx", `${Math.cos(angle) * dist}px`);
      bit.style.setProperty("--pb-dy", `${Math.sin(angle) * dist}px`);
      station.appendChild(bit);
      setTimeout(() => bit.remove(), 950);
    }
  }

  /* ---------------- play ---------------- */

  function init() {
    const boardEl = document.getElementById("pb-board");
    if (!boardEl) return;
    const today = todayContext();
    const dayLineEl = document.getElementById("pb-dayline");
    const civilEl = document.getElementById("pb-civil");

    if (!today) {
      boardEl.innerHTML = `<p class="pb-lead">The calendar is still waking. Give the page a moment, then look again.</p>`;
      return;
    }
    if (dayLineEl) dayLineEl.textContent = today.dayLine;
    if (civilEl) civilEl.textContent = today.civilLine;
    document.documentElement.setAttribute("data-pattern-day", today.ctx.dayOfPatternYear || "intercalary");

    const puzzle = globalThis.PatternBreaker.generate(today.ctx);
    const record = loadRecord();
    const alreadySolved = Boolean(record.solves[puzzle.seedKey]);
    const solvedCount = Object.keys(record.solves).length;

    const leadEl = document.getElementById("pb-lead");
    const tilesEl = document.getElementById("pb-tiles");
    const linesEl = document.getElementById("pb-lines");
    const questionEl = document.getElementById("pb-question");
    const optionsEl = document.getElementById("pb-options");
    const feedbackEl = document.getElementById("pb-feedback");
    const afterEl = document.getElementById("pb-after");
    const ruleEl = document.getElementById("pb-rule");
    const shareEl = document.getElementById("pb-share-line");
    const countEl = document.getElementById("pb-count");

    leadEl.textContent = puzzle.lead;
    questionEl.textContent = puzzle.question;
    ruleEl.textContent = puzzle.ruleText;
    shareEl.textContent = puzzle.shareLine;

    if (puzzle.board.tiles) {
      tilesEl.innerHTML = puzzle.board.tiles.map((tile) =>
        puzzle.kind === "oddone"
          ? `<button type="button" class="pb-tile pb-choice" data-tile="${tileLabel(tile)}" aria-label="${tileLabel(tile)}">${tileHTML(tile)}</button>`
          : `<span class="pb-tile">${tileHTML(tile)}</span>`
      ).join("");
    }
    if (puzzle.board.lines) {
      linesEl.innerHTML = puzzle.board.lines.map((line) => `<li>${line}</li>`).join("");
    }

    let sealed = false;
    function seal(chosenButton) {
      sealed = true;
      boardEl.classList.add("pb-sealed");
      if (chosenButton) chosenButton.classList.add("pb-right");
      optionsEl.querySelectorAll("button").forEach((b) => { b.disabled = true; });
      tilesEl.querySelectorAll("button").forEach((b) => { b.disabled = true; });
      feedbackEl.textContent = "The pattern breaks open. You saw it.";
      setKeeper("The Spark lights up — the pattern holds, and today's place is kept.");
      sparkBurst();
      if (!alreadySolved) {
        record.solves[puzzle.seedKey] = {
          day: puzzle.dayLabel, kind: puzzle.kind, at: new Date().toISOString()
        };
        saveRecord(record);
      }
      const n = Object.keys(record.solves).length;
      countEl.textContent = n === 1
        ? "One day solved, kept here on this device."
        : `${n} days solved, kept here on this device.`;
      afterEl.hidden = false;
    }

    function wrong(button) {
      button.classList.add("pb-wrong");
      button.disabled = true;
      feedbackEl.textContent = "Not this one — look again. The pattern is still there.";
      setKeeper("The Spark waits with you. Look at the walk again.");
    }

    if (puzzle.kind === "oddone") {
      tilesEl.querySelectorAll("button.pb-choice").forEach((button, i) => {
        button.addEventListener("click", () => {
          if (sealed) return;
          if (i === puzzle.answerIndex) {
            button.classList.add("pb-breaker");
            seal(button);
          } else wrong(button);
        });
      });
    } else {
      optionsEl.innerHTML = puzzle.options.map((option, i) =>
        `<button type="button" class="pb-option" data-i="${i}" aria-label="${tileLabel(option.item)}">${tileHTML(option.item)}</button>`
      ).join("");
      optionsEl.querySelectorAll("button").forEach((button) => {
        button.addEventListener("click", () => {
          if (sealed) return;
          const option = puzzle.options[Number(button.dataset.i)];
          if (option.correct) seal(button);
          else wrong(button);
        });
      });
    }

    const copyBtn = document.getElementById("pb-copy");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const note = document.getElementById("pb-copy-note");
        try {
          await navigator.clipboard.writeText(puzzle.shareLine);
          if (note) note.textContent = "The words are copied, ready to share.";
        } catch {
          const area = document.createElement("textarea");
          area.value = puzzle.shareLine;
          document.body.appendChild(area);
          area.select();
          try { document.execCommand("copy"); if (note) note.textContent = "The words are copied, ready to share."; }
          catch { if (note) note.textContent = "Copy the line above — it is yours to share."; }
          area.remove();
        }
      });
    }

    if (alreadySolved) {
      /* The kept place: today's pattern already stands open. */
      countEl.textContent = solvedCount === 1
        ? "One day solved, kept here on this device."
        : `${solvedCount} days solved, kept here on this device.`;
      if (puzzle.kind === "oddone") {
        const btn = tilesEl.querySelectorAll("button.pb-choice")[puzzle.answerIndex];
        if (btn) btn.classList.add("pb-breaker");
      } else {
        const right = puzzle.options.findIndex((o) => o.correct);
        const btn = optionsEl.querySelectorAll("button")[right];
        if (btn) btn.classList.add("pb-right");
      }
      seal(document.querySelector(".pb-right, .pb-breaker"));
      setKeeper("I kept your place — today's pattern is already open. The next one comes with the next day.");
      feedbackEl.textContent = "You saw this one. It stands open.";
    } else {
      setKeeper("The Spark keeps today's pattern. One piece of it is hiding — can you see what everyone else might miss?");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
