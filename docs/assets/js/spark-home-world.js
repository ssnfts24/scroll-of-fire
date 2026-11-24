"use strict";

/*
 * Their Home — the Spark's own 3D world (companions page).
 *
 * Aaron's order (Nov 20, 2026): "The sparks page should be like a
 * 3D world of its own it can decorate like we talked about based
 * on interactions around the site." So this page's heart is now a
 * small living place — Their Home, the room name Aaron settled on
 * Nov 19 — and everything standing in it is there because a real
 * record on this device put it there:
 *
 *   - the Spark itself: the keeper's own, from the same seed and
 *     the same derivation (SparkCompanion.generate / stageOf) the
 *     whole site already uses. This module never re-derives a
 *     Spark and never writes the Spark's record; it reads it the
 *     way the companions page leaves it.
 *   - the keepsake shelf: the keeper's hidden-layer keepsakes —
 *     canonical Life Atlas records, type "artifact", subtype
 *     "hidden-keepsake" (PR #198). Tapping one speaks its own
 *     record: its title and its summary, the answer card it was
 *     kept with.
 *   - the garden ring: thirteen beds around the home, folded from
 *     the keeper's real Pattern Garden records by the garden's
 *     own fold (CodexPatternGarden.foldGarden — loaded lazily,
 *     the way the Sphere's engine is, so the standing page stays
 *     light). A bed grows only what its planting records say it
 *     grows; harvests rest in a basket by the door.
 *   - the path: one stone for every day in the Spark's own
 *     record (record.daysSeen) — the path literally grows by
 *     witnessed days, and by nothing else.
 *   - the road marker: the Traveller's Road signpost by the
 *     gate, with a flag for every story chapter the keeper's
 *     trail (sof.living-trail.v1) says they have found.
 *   - the home itself grows with the Spark's stage, from the
 *     same stageOf the companion card speaks: Spark — a hearth
 *     and a lean-to; Kindled — a cottage; Guardian — a hall.
 *     (The body ladder has three rungs; Bearer lives in the
 *     voice ladder. The home follows the body ladder, the one
 *     the site computes.)
 *   - the sky: the phase from the visitor's own clock (dawn,
 *     day, dusk, night) and the season from today's Pattern Day
 *     — the counted year in four quarters from the Year Gate,
 *     read live through the canonical calendar. Nothing about
 *     the sky is decorative fiction: it is the day, drawn.
 *
 * Slice 4 (the Spark Inhabitant expansion): the home now also
 * answers the journey itself, read from the same record facts
 * the Sphere's inhabitant reads (SphereSparkInhabitant —
 * loaded lazily, its derivations used, never re-derived here):
 *
 *   - the road so far: the life stage the record paints, the
 *     Moons kept, the lands walked, the routes taught and
 *     learned, the tricks learned, the days closed together —
 *     each a fact standing in the record, named in plain words.
 *   - marked days gild their path stones: a day the record
 *     marks (witnessed, a token's home, a practice day, the
 *     birth day) lays its stone in gold; an unmarked day's
 *     stone stays plain stone.
 *   - the story corner stands in the world, not only in words:
 *     one standing token for each episode watched through, on
 *     a low stone ring by the road — and a token's hum can be
 *     sounded here, in the Spark's own voice.
 *   - Fetch the Token, when it stands learned (the Bearer
 *     stage, the inhabitant's own derivation): the keeper names
 *     a keepsake on the shelf or a token in the corner, and the
 *     Spark travels the home ground, takes it up, carries it
 *     to the gate and presents it — naming it with its day and
 *     its story — then returns it to its place. A showing: the
 *     fetch writes nothing.
 *
 * Slice 5 (the Spark Inhabitant expansion): the home answers
 * its own fullness, and Carry For Me stands here:
 *
 *   - the home's temper: how full the record has made the
 *     home — spare, settled, or full, counted from the shelf,
 *     the story corner, and the garden ring — named in the
 *     words, and felt in the scene: a spare home's Spark keeps
 *     a small round near the hearth; a full home's ranges the
 *     whole ground.
 *   - Carry For Me (Gate E's carry / carry-end, design §3.4):
 *     where Fetch the Token stands, the keeper may ask the
 *     Spark to carry one keepsake or token for the day. The
 *     care-act lines are written through the inhabitant
 *     module's writer door — the site's one life-line writer —
 *     one carry at a time, its end recorded against its
 *     beginning. While a carry stands open, the keepsake's
 *     light rides the Spark here and on the Sphere.
 *   - the carried line (design §1.4): the first time a fetch
 *     carries a keepsake, one line lands on the keepsake's own
 *     Atlas record — "carried to you, [day]" — through the
 *     repository's own write path, once; the readout names it
 *     from then on. The fetch's showing still writes no life
 *     lines; the carried line is a mark on the keepsake's own
 *     record, not on the Spark's.
 *
 * Where a record is empty, the slot stands honestly empty with
 * one plain line. Nothing here is pre-decorated, nothing is
 * bought, nothing leaves the device: every record read is one
 * the site already keeps on this device.
 *
 * The pure half (buildModel and its helpers) carries no DOM or
 * storage dependency and is unit-tested in
 * tests/spark-home-world.test.js. The browser half lazy-loads
 * the vendored Three.js module and the garden stack only when
 * the section nears the screen; where WebGL or the engine is
 * not to be had, the world's still form stands — the Spark's
 * own flat drawing, the caption, and the "What's here" list,
 * which is the whole world in plain words either way.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.SparkHomeWorld = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {

  const VERSION = "spark-home-world/1.0.0";
  const KEEPSAKE_SUBTYPE = "hidden-keepsake";
  const SHELF_CAP = 12; /* objects standing on the shelf itself */
  const BASKET_CAP = 8; /* harvest shapes standing in the basket */

  /* ------------------------------ sky ------------------------------ */

  /* The day in four phases, from the visitor's own hour. */
  function phaseForHour(hour) {
    const h = Number(hour);
    if (!Number.isFinite(h)) return "day";
    if (h >= 5 && h < 7.5) return "dawn";
    if (h >= 7.5 && h < 17) return "day";
    if (h >= 17 && h < 20) return "dusk";
    return "night";
  }

  /* The counted year in four quarters from the Year Gate
   * (Pattern Day 1, April 17 — spring in the Codex's hemisphere):
   * 1–91 spring, 92–182 summer, 183–273 autumn, 274–364 winter.
   * The Day Out of Time stands at the year's end, in winter's
   * last breath, so a day outside the count reads winter. */
  function seasonForPatternDay(patternDay) {
    const pd = Number(patternDay);
    if (!Number.isFinite(pd) || pd < 1) return "winter";
    if (pd <= 91) return "spring";
    if (pd <= 182) return "summer";
    if (pd <= 273) return "autumn";
    return "winter";
  }

  const PHASE_NAMES = { dawn: "Dawn", day: "Daytime", dusk: "Dusk", night: "Night" };
  const SEASON_NAMES = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" };

  function todayLineFor(today) {
    if (!today) return "Today, in Living Time";
    if (today.isDayOutOfTime) return "Today is the Day Out of Time";
    if (today.isDeepTimeDay) return "Today is the Deep Time Day";
    if (today.moon != null && today.day != null) {
      return `Moon ${today.moon} · Day ${today.day} · Pattern Day ${today.dayOfPatternYear}`;
    }
    return "Today, in Living Time";
  }

  /* --------------------------- keepsakes --------------------------- */

  /* The shelf: hidden-layer keepsakes only — the records the
   * hidden layer itself keeps (PR #198). Each carries its own
   * answer card: the record's title and summary, spoken whole
   * when the keepsake is tapped. */
  function keepsakesFromRecords(records) {
    const out = [];
    for (const record of Array.isArray(records) ? records : []) {
      if (!record || record.type !== "artifact" || record.subtype !== KEEPSAKE_SUBTYPE) continue;
      const hl = (record.payload && record.payload.hiddenLayer) || {};
      const carriedLines = record.payload && Array.isArray(record.payload.carriedLines)
        ? record.payload.carriedLines : [];
      out.push({
        id: record.id || null,
        title: record.title || "A keepsake",
        summary: record.summary || "",
        kind: hl.kind || null,
        name: hl.name || null,
        source: hl.source || null,
        where: hl.where || (record.provenance && record.provenance.sourceId) || null,
        civilDate: (record.temporal && record.temporal.civilDate) || null,
        /* Slice 5: the carried line (design §1.4), when this
         * keepsake's own record carries one — the first fetch's
         * mark, named in the readout. */
        carried: carriedLines.length && typeof carriedLines[0].text === "string" ? carriedLines[0].text : null
      });
    }
    return out;
  }

  /* ----------------------------- garden ---------------------------- */

  /* Map the garden's own fold onto decorations. The fold is the
   * garden page's truth; this only restates it for the world:
   * which beds carry plantings, what grows there and how far,
   * and which harvests were kept. Beds with no planting stay
   * bare soil — the ring shows all thirteen either way, because
   * the thirteen beds are the garden's shape, not a claim. */
  function gardenFromFold(fold) {
    if (!fold || !Array.isArray(fold.beds)) {
      return { readable: false, beds: [], plantedBeds: 0, tendedMoons: [], keepsakes: [], keepsakeCount: 0 };
    }
    const beds = fold.beds.map(bed => {
      const plantings = (bed.plantings || []).map(p => ({
        cropName: p.cropName || "A planting",
        stageName: p.stageName || "Seed",
        witnessedDays: p.witnessedDays || 0,
        harvested: Boolean(p.harvested),
        goneToSeed: Boolean(p.goneToSeed),
        canHarvest: Boolean(p.canHarvest)
      }));
      return {
        moon: bed.moon,
        name: bed.name || `Moon ${bed.moon}`,
        state: bed.state || "unknown",
        plantings
      };
    });
    const keepsakes = (fold.keepsakes || []).map(k => ({
      cropName: k.cropName || "A planting",
      moon: k.moon != null ? k.moon : null,
      witnessedDays: k.witnessedDays != null ? k.witnessedDays : null,
      civilDate: k.civilDate || null
    }));
    const planted = beds.filter(b => b.plantings.length > 0);
    return {
      readable: true,
      beds,
      plantedBeds: planted.length,
      tendedMoons: planted.map(b => b.moon),
      keepsakes,
      keepsakeCount: keepsakes.length
    };
  }

  /* ----------------------------- story ----------------------------- */

  /* The road marker: chapters of the spine the keeper's trail
   * says they have found. The spine itself (codex-story.json)
   * names the chapters; the trail names the finds. A chapter
   * counts only if both name it. */
  function storyFromTrail(finds, chapters) {
    const list = Array.isArray(chapters) ? chapters : [];
    const foundMap = finds && typeof finds === "object" ? finds : {};
    const found = list
      .filter(c => c && c.id && foundMap[c.id])
      .map(c => ({ id: c.id, n: c.n || null, title: c.title || c.id }));
    return {
      found,
      foundCount: found.length,
      totalChapters: list.length,
      furthest: found.reduce((max, c) => Math.max(max, c.n || 0), 0)
    };
  }

  /* ------------------------- the story corner ------------------------- */

  /* The story corner: the tokens of the episodes the keeper has
   * watched through, folded from the watch records by the
   * activities module (SparkActivities.foldWatches — the browser
   * half passes its fold in; the token derives from the watch
   * record and is stored nowhere else). Without the fold, the
   * corner stands honestly empty. */
  function storyCornerFromFold(fold) {
    if (!fold || !Array.isArray(fold.tokens)) {
      return { readable: false, tokens: [], tokenCount: 0 };
    }
    const tokens = fold.tokens.map(t => ({
      episodeId: t.episodeId || null,
      line: t.line || "",
      token: t.token || "",
      moonName: t.moonName || "",
      skill: t.skill || null,
      hum: t.hum && Array.isArray(t.hum.motifHz) && t.hum.motifHz.length
        ? { rootHz: t.hum.rootHz != null ? t.hum.rootHz : null, scale: t.hum.scale || "", motifHz: [...t.hum.motifHz] }
        : null,
      watchedOn: t.watchedOn || "",
      metAgainYears: Array.isArray(t.metAgainYears) ? [...t.metAgainYears] : [],
      /* Slice 5: the watch record's own id and carried line,
       * passed through when the browser half resolved them —
       * a token's fetch writes its carried line on the watch
       * record that brought the token home. */
      recordId: t.recordId || null,
      carried: t.carried || null
    }));
    return { readable: true, tokens, tokenCount: tokens.length };
  }

  /* The portrait of keeping (Spark Activities, slice 1): a fold
   * over the keeper's whole record — the breadth of kinds of
   * keeping that stand in it — passed in by the browser half
   * (SparkActivities.portraitFromRecords). It is a portrait, not
   * a rank: it never goes down and unlocks nothing. */
  function portraitFromInput(portrait) {
    if (!portrait || typeof portrait !== "object") return null;
    return {
      stageName: portrait.stageName || "Spark",
      kindCount: portrait.kindCount || 0,
      kinds: Array.isArray(portrait.kinds) ? portrait.kinds : [],
      line: portrait.line || ""
    };
  }

  /* ------------------------- the journey ------------------------- */

  /* The journey, as the inhabitant's derivations read it from
   * the same record facts (slice 4): the browser half folds the
   * record through SphereSparkInhabitant and passes the result
   * in — this module never re-derives a stage, a trick, or a
   * hum. The fold here only normalizes what it is given, so a
   * partial or unreadable journey degrades to honest absence,
   * never to invention. */
  function journeyFromInput(journey) {
    if (!journey || typeof journey !== "object") return null;
    const list = (v) => (Array.isArray(v) ? v : []);
    return {
      stageName: typeof journey.stageName === "string" && journey.stageName ? journey.stageName : null,
      moonsKept: Math.max(0, Math.floor(Number(journey.moonsKept) || 0)),
      landsWalked: Math.max(0, Math.floor(Number(journey.landsWalked) || 0)),
      routes: list(journey.routes)
        .filter(r => r && Array.isArray(r.days) && r.days.length >= 2)
        .map(r => ({ days: r.days.filter(d => Number.isInteger(d) && d >= 1 && d <= 364), learned: Boolean(r.learned) })),
      tricksLearned: list(journey.tricksLearned).filter(t => typeof t === "string" && t),
      daysClosedTogether: Math.max(0, Math.floor(Number(journey.daysClosedTogether) || 0)),
      hums: list(journey.hums)
        .filter(h => h && Array.isArray(h.motifHz) && h.motifHz.length)
        .map(h => ({
          episodeId: h.episodeId || null,
          title: h.title || "",
          token: h.token || "",
          land: h.land || "",
          moonName: h.moonName || "",
          rootHz: h.rootHz != null ? h.rootHz : null,
          scale: h.scale || "",
          motifHz: h.motifHz.filter(hz => Number.isFinite(hz) && hz > 0),
          patternDay: Number.isInteger(h.patternDay) ? h.patternDay : null
        })),
      fetchStands: Boolean(journey.fetchStands),
      lanternStands: Boolean(journey.lanternStands),
      /* Slice 5: the carry that stands open, when one does —
       * the keepsake or token the Spark carries for the keeper
       * today, named by its ref and its title, with the day
       * the carrying began. */
      carrying: journey.carrying && typeof journey.carrying === "object" && journey.carrying.ref
        ? {
            ref: String(journey.carrying.ref),
            title: typeof journey.carrying.title === "string" && journey.carrying.title ? journey.carrying.title : "a keepsake",
            civilDate: typeof journey.carrying.civilDate === "string" ? journey.carrying.civilDate : null
          }
        : null,
      markedDays: list(journey.markedDays)
        .filter(m => m && Number.isInteger(m.pd) && m.pd >= 1 && m.pd <= 364)
        .map(m => ({ pd: m.pd, kinds: list(m.kinds).filter(k => typeof k === "string" && k) }))
    };
  }

  /* The home's temper (slice 5): how full the record has made
   * the home, counted from what stands in it — the shelf's
   * keepsakes, the story corner's tokens, the garden ring's
   * planted beds. Spare is a beginning, honestly empty; full
   * is a home the record has furnished on every side. The
   * count is the record's own; nothing decorative is added. */
  function homeFullnessFor({ keepsakes = 0, tokens = 0, plantedBeds = 0 } = {}) {
    const score = Math.max(0, Math.floor(Number(keepsakes) || 0))
      + Math.max(0, Math.floor(Number(tokens) || 0))
      + Math.max(0, Math.floor(Number(plantedBeds) || 0));
    const tier = score === 0 ? "spare" : score >= 6 ? "full" : "settled";
    return { score, tier };
  }

  /* The record's own kept days, in the order they stand there —
   * the identity of each path stone, so a marked day's stone
   * can be gilded and the rest stay plain stone. */
  function stoneDaysFromRecord(record) {
    if (!record || !Array.isArray(record.daysSeen)) return [];
    return record.daysSeen.filter(d => Number.isInteger(d) && d >= 1 && d <= 364);
  }

  /* ------------------------------ home ----------------------------- */

  const HOME_FORMS = [
    { form: "hearth", line: "a hearth and a lean-to — a beginning place" },
    { form: "cottage", line: "a cottage, with a lit window" },
    { form: "hall", line: "a hall, the fullest form the home grows" }
  ];

  function homeForStage(stageIndex) {
    if (stageIndex == null || !HOME_FORMS[stageIndex]) {
      return { form: "plot", stageIndex: null, line: "a hearth plot, waiting for its Spark" };
    }
    return { form: HOME_FORMS[stageIndex].form, stageIndex, line: HOME_FORMS[stageIndex].line };
  }

  /* ----------------------------- model ----------------------------- */

  function dayWord(n) {
    return n === 1 ? "day" : "days";
  }

  /*
   * buildModel({
   *   sparkRecord,   — the sof.spark.v1 record, or null
   *   companion,     — SparkCompanion.generate(record.seed), or null
   *   stage,         — SparkCompanion.stageOf(record, companion), or null
   *   displayName,   — the name the Spark answers to, or null
   *   atlasRecords,  — every Life Atlas record on the device
   *   gardenFold,    — CodexPatternGarden.foldGarden(...) or null
   *   storyWatches,  — SparkActivities.foldWatches(records) or null:
   *                    the story corner's tokens, derived from the
   *                    keeper's episode-watched records
   *   keepingPortrait — SparkActivities.portraitFromRecords(records)
   *                    or null: the portrait of keeping (slice 1 —
   *                    Spark / Kindled by breadth of keeping kinds)
   *   journey,       — slice 4: the journey as SphereSparkInhabitant's
   *                    derivations read it (stage, Moons kept, lands
   *                    walked, routes, tricks learned, days closed
   *                    together, hums, the carrying tricks' standing,
   *                    marked days), or null when unreadable here
   *   trailFinds,    — LivingTrail trail.finds, or null
   *   chapters,      — the story spine's chapters, or null
   *   today,         — today's canonical conversion, or null
   *   hour,          — the visitor's hour (0–24, fractional)
   *   sparkSpeech    — { dayLine, reactions } in the Spark's own
   *                    voice, gathered by the browser half from
   *                    the core (livingDayRemarkFor / convoLineFor),
   *                    or null; tapping the Spark in its home
   *                    speaks the day first, then its reactions
   * })
   */
  function buildModel(input = {}) {
    const record = input.sparkRecord || null;
    const companion = input.companion || null;
    const stage = input.stage || null;
    const today = input.today || null;

    const phase = phaseForHour(input.hour);
    const season = seasonForPatternDay(today ? today.dayOfPatternYear : null);

    const spark = record && companion ? {
      name: input.displayName || companion.name || "your Spark",
      seedName: companion.name || null,
      kind: companion.kind || null,
      kindName: companion.kindName || null,
      form: companion.form || "orb",
      palette: companion.palette || null,
      hue: companion.hue != null ? companion.hue : null,
      size: (companion.shape && companion.shape.size) || 1,
      stageIndex: stage ? stage.index : 0,
      stageName: stage ? stage.name : "Spark",
      bornMoon: companion.birthMoon != null ? companion.birthMoon : null,
      bornPatternDay: companion.birthPatternDay != null ? companion.birthPatternDay : null,
      bornCivil: record.bornCivil || null
    } : null;

    const keepsakes = keepsakesFromRecords(input.atlasRecords);
    const garden = gardenFromFold(input.gardenFold);
    const story = storyFromTrail(input.trailFinds, input.chapters);
    const storyCorner = storyCornerFromFold(input.storyWatches);
    const portrait = portraitFromInput(input.keepingPortrait);
    const journey = journeyFromInput(input.journey);
    const stoneDays = stoneDaysFromRecord(record);
    /* Gilding follows slice 2's rule: a STRONG mark — a day the
     * record marks beyond the keeping itself. A merely kept
     * day's stone stays plain stone. */
    const gildedCount = journey
      ? journey.markedDays.filter(m => stoneDays.includes(m.pd) && m.kinds.some(k => k !== "kept")).length
      : 0;
    const keptDays = record && Array.isArray(record.daysSeen) ? record.daysSeen.length : 0;
    const home = homeForStage(spark ? spark.stageIndex : null);
    /* Slice 5: the home's temper, from what stands in it. */
    const fullness = homeFullnessFor({
      keepsakes: keepsakes.length,
      tokens: storyCorner.tokenCount,
      plantedBeds: garden.plantedBeds
    });

    /* The Spark's speech at home, gathered by the browser half
     * from the core's own voice: a remark on the keeper's actual
     * day (today's coordinate, whether practice is sealed, the
     * days kept together — livingDayRemarkFor), and a small set
     * of honest reactions for when it is tapped. This module
     * never invents the lines; it only carries them, the way it
     * carries everything else the records say. Without a Spark
     * there is no speech, and the world says so by silence. */
    const speechIn = input.sparkSpeech && typeof input.sparkSpeech === "object" ? input.sparkSpeech : {};
    const sparkSpeech = spark ? {
      dayLine: typeof speechIn.dayLine === "string" && speechIn.dayLine ? speechIn.dayLine : null,
      reactions: Array.isArray(speechIn.reactions)
        ? speechIn.reactions.filter((line) => typeof line === "string" && line)
        : []
    } : null;

    /* The plain lines — the world in words. Every slot states
     * what truly stands there, or honestly says it is empty. */
    const lines = {
      sky: `${PHASE_NAMES[phase]} · ${SEASON_NAMES[season]} of the Pattern year — ${todayLineFor(today)}`,
      home: spark
        ? `${spark.name}'s home: ${home.line}. It grows as ${spark.name} grows — now ${spark.stageName}, stage ${spark.stageIndex + 1}.`
        : "Their Home: a young world, undecorated. Meet your Spark above, and this place becomes its home.",
      spark: spark
        ? `${spark.name} — a ${spark.kindName} Spark, ${spark.stageName}. ` +
          (spark.bornMoon != null
            ? `Born in Moon ${spark.bornMoon} · Pattern Day ${spark.bornPatternDay}.`
            : `Born on the Day Out of Time · Pattern Day ${spark.bornPatternDay}.`)
        : null,
      shelf: keepsakes.length
        ? `The keepsake shelf: ${keepsakes.length} keepsake${keepsakes.length === 1 ? "" : "s"} your Spark has found and kept, each with its answer card.`
        : "The keepsake shelf: empty. Your finds will rest here.",
      garden: !garden.readable
        ? "The garden ring: it could not be read here. The Pattern Garden page keeps it."
        : garden.plantedBeds
          ? `The garden ring: ${garden.plantedBeds} of the thirteen beds carry plantings this year` +
            (garden.keepsakeCount ? `, and ${garden.keepsakeCount} harvest${garden.keepsakeCount === 1 ? "" : "s"} kept by the door.` : ".")
          : "The garden ring: thirteen bare beds. Nothing planted yet — each bed opens in its Moon.",
      path: keptDays
        ? `The path: ${keptDays} stone${keptDays === 1 ? "" : "s"} — one for every day you and your Spark have kept together.` +
          (journey && gildedCount
            ? ` ${gildedCount} of them ${gildedCount === 1 ? "is" : "are"} gilded — the days the record marks beyond the keeping itself: witnessed, a token's homecoming, a practice, a birth.`
            : "")
        : "The path: no stones yet. It begins with the first day you keep together.",
      road: !spark
        ? null
        : !journey
          ? "The road so far: it could not be read here. The Sphere keeps the journey."
          : (() => {
              const facts = [];
              if (journey.moonsKept) facts.push(`${journey.moonsKept} Moon${journey.moonsKept === 1 ? "" : "s"} kept`);
              if (journey.landsWalked) facts.push(`${journey.landsWalked} land${journey.landsWalked === 1 ? "" : "s"} walked`);
              if (journey.routes.length) {
                const learned = journey.routes.filter(r => r.learned).length;
                facts.push(`${journey.routes.length} route${journey.routes.length === 1 ? "" : "s"} shown` + (learned ? `, ${learned} of them ${spark.name}'s own` : ""));
              }
              if (journey.tricksLearned.length) facts.push(`${journey.tricksLearned.length} trick${journey.tricksLearned.length === 1 ? "" : "s"} learned`);
              if (journey.daysClosedTogether) facts.push(`${journey.daysClosedTogether} day${journey.daysClosedTogether === 1 ? "" : "s"} closed together`);
              if (journey.hums.length) facts.push(`${journey.hums.length} hum${journey.hums.length === 1 ? "" : "s"} learned`);
              return facts.length
                ? `The road so far: ${spark.name} stands ${journey.stageName || spark.stageName} — ${facts.join(" · ")}. Every piece of it stands in the record; nothing here was placed by hand.`
                : `The road so far: ${spark.name} is just setting out. The home fills as the record grows — the first day kept, the first token home, the first route walked.`;
            })(),
      fetch: !spark || !journey
        ? null
        : journey.fetchStands
          ? null
          : `Fetch the Token — not yet learned. At Bearer, ${spark.name} will bring you what you name from the shelf and the story corner.`,
      temper: !spark
        ? "The home's temper: it waits for its Spark."
        : fullness.tier === "spare"
          ? `The home's temper: spare. Nothing stands on the shelf, in the story corner, or in the garden ring yet — a beginning place, honestly empty where the record is empty. ${spark.name} keeps a small round near the hearth.`
          : fullness.tier === "full"
            ? `The home's temper: full — ${fullness.score} pieces of the record stand in it, across the shelf, the story corner, and the garden ring. ${spark.name} ranges the whole ground.`
            : `The home's temper: settled — ${fullness.score} piece${fullness.score === 1 ? "" : "s"} of the record stand${fullness.score === 1 ? "s" : ""} in it so far, and the home fills as the record grows.`,
      carry: spark && journey && journey.carrying
        ? `${spark.name} is carrying ${journey.carrying.title} for you today` +
          (journey.carrying.civilDate ? ` — taken up on ${journey.carrying.civilDate}` : "") +
          `. Its light rides with ${spark.name} here, and on the Sphere too. Take it back, and the carrying is complete.`
        : null,
      story: story.foundCount
        ? `The road marker: ${story.foundCount} chapter${story.foundCount === 1 ? "" : "s"} of the Traveller's Road walked` +
          (story.totalChapters ? `, of ${story.totalChapters} the spine now tells.` : ".")
        : "The road marker: no chapters walked yet. The road is open.",
      storyCorner: !storyCorner.readable
        ? "The story corner: it could not be read here. The episodes' own pages keep their tokens."
        : storyCorner.tokenCount
          ? `The story corner: ${storyCorner.tokenCount} token${storyCorner.tokenCount === 1 ? "" : "s"} stand here, one for each episode watched through — ` +
            storyCorner.tokens.map(t => t.token).join("; ") +
            `. Touch one and the Spark names its episode and the day it came home.`
          : "The story corner: no tokens yet. An episode watched through to its end brings its token home.",
      portrait: portrait
        ? portrait.line
        : "The portrait of keeping: it is painted by keeping, and read from the record when the record can be read here."
    };

    return {
      version: VERSION,
      sky: { phase, season, phaseName: PHASE_NAMES[phase], seasonName: SEASON_NAMES[season] },
      todayLine: todayLineFor(today),
      spark,
      sparkSpeech,
      home,
      keepsakes,
      keepsakeTotal: keepsakes.length,
      garden,
      story,
      storyCorner,
      portrait,
      journey,
      fullness,
      path: {
        keptDays,
        stoneDays,
        markedDays: journey ? journey.markedDays : []
      },
      lines
    };
  }

  return {
    VERSION,
    KEEPSAKE_SUBTYPE,
    SHELF_CAP,
    BASKET_CAP,
    phaseForHour,
    seasonForPatternDay,
    todayLineFor,
    keepsakesFromRecords,
    gardenFromFold,
    storyFromTrail,
    storyCornerFromFold,
    portraitFromInput,
    journeyFromInput,
    homeFullnessFor,
    stoneDaysFromRecord,
    homeForStage,
    buildModel
  };
});

/* ============================ browser half ============================ */
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const World = window.SparkHomeWorld;
  if (!World) return;

  const $ = (sel, host) => (host || document).querySelector(sel);

  function assetUrl(rel) {
    const base = document.querySelector("base");
    try {
      return new URL(rel, base ? base.href : document.baseURI).href;
    } catch {
      return rel;
    }
  }

  function loadScript(rel) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = assetUrl(rel);
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`could not load ${rel}`));
      document.head.appendChild(s);
    });
  }

  function todayCoordinate() {
    if (window.SOFTemporalCursor && typeof window.SOFTemporalCursor.resolvePosition === "function") {
      try {
        const pos = window.SOFTemporalCursor.resolvePosition(new Date());
        if (pos) return pos;
      } catch { /* fall through */ }
    }
    if (window.PatternCalendar) return window.PatternCalendar.fromCivilDate({ date: new Date() });
    return null;
  }

  function readSparkRecord(Core) {
    try {
      const raw = window.localStorage.getItem(Core.STORAGE_KEY);
      if (!raw) return null;
      const record = JSON.parse(raw);
      return record && Core.parseSeed(record.seed) ? record : null;
    } catch {
      return null;
    }
  }

  /* Slice 5: the write paths' handles, refreshed by every
   * collect — the repository (for the carried line's write,
   * through its own put) and the inhabitant module (for the
   * carry's life lines, through its writer door). */
  let homeRepository = null;
  let homeInhabitant = null;

  /* Read the world's facts from the records the site already
   * keeps. Nothing here writes anything: the companions page
   * glue records today's visit itself; this mirrors that visit
   * in memory only, so the world never lags a day behind the
   * card above it. */
  async function collectModel() {
    const Core = window.SparkCompanion || null;
    const today = todayCoordinate();
    let record = Core ? readSparkRecord(Core) : null;
    let companion = null;
    let stage = null;
    let displayName = null;
    if (Core && record) {
      record = Core.recordVisit(record, {
        patternDay: today ? today.dayOfPatternYear : null,
        page: "companions.html"
      });
      companion = Core.generate(record.seed);
      stage = companion ? Core.stageOf(record, companion) : null;
      displayName = companion ? Core.displayName(record, companion) : null;
    }

    /* The garden stack loads the way the Sphere's engine does —
     * when it is needed, not in the standing page. */
    let repository = null;
    let atlasRecords = [];
    let gardenFold = null;
    try {
      if (!window.CodexRecordHelpers) {
        await loadScript("assets/js/life-atlas/record-helpers.js");
      }
      if (!window.CodexPatternGarden) {
        await loadScript("assets/js/pattern-garden.js");
      }
      const Helpers = window.CodexRecordHelpers;
      if (Helpers) repository = await Helpers.createRepositoryResolver()();
      if (!repository && window.CodexLifeAtlasRuntime) {
        repository = await window.CodexLifeAtlasRuntime.ready;
      }
      if (repository) atlasRecords = await repository.query({});
      homeRepository = repository;
    } catch {
      atlasRecords = [];
      gardenFold = null;
    }
    if (repository && window.CodexPatternGarden && window.PatternCalendarData) {
      try {
        const keptDates = [...new Set(atlasRecords.map(r => r?.temporal?.civilDate).filter(Boolean))];
        gardenFold = window.CodexPatternGarden.foldGarden({
          records: atlasRecords,
          keptDates,
          today: window.CodexPatternGarden.coordinateForInstant(new Date()),
          moonNames: window.PatternCalendarData.moons.map(m => m?.name || null)
        });
      } catch {
        gardenFold = null;
      }
    }

    /* The story corner and the portrait of keeping ride the
     * activities module's folds over the same records — loaded
     * lazily the same way, and read-only here as everywhere. */
    let storyWatches = null;
    let keepingPortrait = null;
    try {
      if (!window.SparkActivities) {
        await loadScript("assets/js/spark-activities.js");
      }
      if (window.SparkActivities) {
        storyWatches = window.SparkActivities.foldWatches(atlasRecords);
        keepingPortrait = window.SparkActivities.portraitFromRecords(atlasRecords);
      }
      /* Slice 5: resolve each token's watch record — its id,
       * for the carried line's write path, and the carried
       * line itself when one already stands on it. */
      if (storyWatches && Array.isArray(storyWatches.tokens)) {
        for (const t of storyWatches.tokens) {
          const rec = atlasRecords.find(r => r && r.type === "action" && r.subtype === "episode-watched"
            && r.payload && r.payload.episodeId === t.episodeId);
          if (rec) {
            t.recordId = rec.id || null;
            const cl = rec.payload && Array.isArray(rec.payload.carriedLines) ? rec.payload.carriedLines : [];
            t.carried = cl.length && typeof cl[0].text === "string" ? cl[0].text : null;
          }
        }
      }
    } catch {
      storyWatches = null;
      keepingPortrait = null;
    }

    /* Slice 4: the journey, folded by the inhabitant module's
     * own derivations over the same records — the life stage,
     * the breadth (Moons kept, lands walked, marked days), the
     * routes, the tricks learned, the days closed together,
     * the hums, and whether the carrying tricks stand. The
     * module is lazy-loaded the same way as the others; its
     * mount looks for the Sphere's stage, finds none here, and
     * stands down. Read-only, like everything gathered here. */
    let journey = null;
    try {
      if (!window.SphereSparkInhabitant) {
        await loadScript("assets/js/sphere-spark-inhabitant.js");
      }
      const Inh = window.SphereSparkInhabitant;
      if (Inh && record) {
        const facts = Inh.lifeFactsFromRecords(atlasRecords, record);
        const lines = Inh.lifeLinesOf(record);
        const stageId = Inh.lifeStageFromFacts(facts);
        const derived = Inh.derivedTricks({
          kind: companion ? companion.kind : null, stage: stageId, facts, lines, record
        });
        const derivedIds = new Set(derived.map(d => d.trick));
        const learnedIds = new Set(lines.filter(l => l.line === "trick-learned").map(l => l.trick));
        /* Slice 5: the carry that stands open, with the name
         * of what is carried — a keepsake by its Atlas id, a
         * token by its episode. */
        const openCarry = Inh.openCarryFromLines(lines);
        let carrying = null;
        if (openCarry && openCarry.ref) {
          let title = "a keepsake";
          if (openCarry.ref.startsWith("keepsake:")) {
            const rec = atlasRecords.find(r => r && r.id === openCarry.ref.slice("keepsake:".length));
            if (rec) title = rec.title || title;
          } else if (openCarry.ref.startsWith("token:")) {
            const tok = storyWatches && Array.isArray(storyWatches.tokens)
              ? storyWatches.tokens.find(t => t.episodeId === openCarry.ref.slice("token:".length)) : null;
            if (tok) title = tok.token || tok.line || title;
          }
          carrying = { ref: openCarry.ref, title, civilDate: openCarry.civilDate || null };
        }
        homeInhabitant = Inh;
        let genesisPd = null;
        try { genesisPd = Inh.genesisPatternDayFromRaw(window.localStorage.getItem("sofGenesisProfilesV2")); }
        catch { genesisPd = null; }
        const breadth = Inh.breadthFromSources({
          record,
          witnessedPds: facts.witnessedDays,
          genesisPd,
          tokenInfo: Inh.tokenDaysFromRecords(atlasRecords)
        });
        journey = {
          stageName: Inh.LIFE_STAGE_NAMES[stageId] || "Spark",
          moonsKept: breadth.moonsKept,
          landsWalked: breadth.lands,
          routes: Inh.routeDemosFromLines(lines).map(d => ({
            days: d.days,
            learned: Boolean(Inh.routeLearningFor(lines, d))
          })),
          /* Slice 5 — the union, as the Sphere's book reads
           * it: a trick stands learned when a line witnesses
           * it OR the derivation stands (the unified path
           * included). Slice 4 read the lines alone here while
           * the fetch's standing read the union; the road's
           * count now reads the same union. */
          tricksLearned: [...new Set([
            ...lines.filter(l => l.line === "trick-learned").map(l => l.trick),
            ...derived.map(d => d.trick)
          ])].map(id => Inh.TRICK_NAMES[id] || id),
          daysClosedTogether: lines.filter(l => l.line === "care-act" && l.kind === "close-day").length,
          hums: Inh.humRepertoireFromFacts(facts),
          carrying,
          fetchStands: derivedIds.has("fetch-the-token") || learnedIds.has("fetch-the-token"),
          lanternStands: derivedIds.has("carry-the-lantern") || learnedIds.has("carry-the-lantern"),
          /* Strong marks only — the days the record marks
           * beyond the keeping itself (slice 2's own rule). */
          markedDays: (breadth.strongMarkedDays || []).map(pd => ({ pd, kinds: (breadth.marks || {})[pd] || [] }))
        };
      }
    } catch {
      journey = null;
    }

    let trailFinds = null;
    try {
      if (window.LivingTrail) trailFinds = window.LivingTrail.load().finds || {};
    } catch { /* the trail is the keeper's; silence is honest */ }

    let chapters = null;
    try {
      const response = await fetch(assetUrl("assets/data/codex-story.json"));
      if (response.ok) {
        const story = await response.json();
        chapters = Array.isArray(story?.chapters) ? story.chapters : null;
      }
    } catch { /* the road stands without its names */ }
    if (!chapters && trailFinds) {
      chapters = Object.keys(trailFinds).map(id => ({ id, n: null, title: id }));
    }

    const now = new Date();

    /* What the Spark can honestly say at home today, from the
     * core's own voice: the day remark (the coordinate, practice
     * sealed or not, the days kept together, and the garden's
     * readiness when the fold could be read), and its reactions.
     * Read-only, like everything this module gathers. */
    let sparkSpeech = null;
    if (Core && record && companion) {
      let ready = 0;
      if (gardenFold && Array.isArray(gardenFold.beds)) {
        for (const bed of gardenFold.beds) {
          for (const p of bed.plantings || []) if (p.canHarvest) ready += 1;
        }
      }
      const farmNote = ready > 0
        ? `${ready} planting${ready === 1 ? "" : "s"} ready to harvest in the garden ring`
        : "";
      const remark = Core.livingDayRemarkFor({
        record,
        companion,
        today,
        hour: now.getHours(),
        farmNote
      });
      const reactions = ["pet", "poke", "play", "greet"]
        .map((beat) => Core.convoLineFor({ companion, beat }))
        .filter(Boolean);
      sparkSpeech = {
        dayLine: remark && remark.line ? remark.line : null,
        reactions
      };
    }

    const model = World.buildModel({
      sparkRecord: record,
      companion,
      stage,
      displayName,
      atlasRecords,
      gardenFold,
      storyWatches,
      keepingPortrait,
      journey,
      trailFinds,
      chapters,
      today,
      sparkSpeech,
      hour: now.getHours() + now.getMinutes() / 60
    });
    return { model, companion, stage, record };
  }

  /* The Spark's voice, sounding a learned hum's own motif —
   * the episode's measured notes, in the house's sound
   * discipline (a sine tone, a soft attack, a falling decay;
   * the keeper's sound setting honoured, the way the Sphere's
   * presence reads it). Sound is a grace: any failure is
   * silence, never an error. */
  let humAudioCtx = null;
  function soundMotifHz(motifHz) {
    try {
      if (window.localStorage.getItem("sof.spark.sound") === "off") return;
      const notes = (Array.isArray(motifHz) ? motifHz : []).filter(hz => Number.isFinite(hz) && hz > 0).slice(0, 12);
      if (!notes.length) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      humAudioCtx = humAudioCtx || new AC();
      if (humAudioCtx.state === "suspended") humAudioCtx.resume();
      const ctx = humAudioCtx;
      notes.forEach((hz, i) => {
        const t = ctx.currentTime + 0.03 + i * 0.42;
        const dur = 0.5;
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = hz;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + dur + 0.05);
      });
    } catch { /* the voice is a grace, not a gate */ }
  }

  /* ------------------------- the world in words ------------------------- */

  function renderWords(model, host, say, actions) {
    const caption = $("#spark-home-caption", host);
    if (caption) caption.textContent = model.lines.sky;
    const list = $("#spark-home-list", host);
    if (!list) return;
    list.replaceChildren();
    const items = [];
    items.push({ key: "home", label: "The home", line: model.lines.home });
    items.push({ key: "temper", label: "The home's temper", line: model.lines.temper });
    if (model.lines.carry) {
      items.push({ key: "carry", label: "Carried today", line: model.lines.carry, takeBack: true });
    }
    const canCarry = Boolean(model.journey && model.journey.fetchStands && model.spark && !model.journey.carrying);
    if (model.lines.spark) items.push({ key: "spark", label: model.spark.name, line: model.lines.spark });
    if (model.spark && model.sparkSpeech && model.sparkSpeech.dayLine) {
      items.push({ key: "day", label: `${model.spark.name} on today`, line: model.sparkSpeech.dayLine });
    }
    const sparkName = model.spark ? model.spark.name : "The Spark";
    const fetchOk = Boolean(model.journey && model.journey.fetchStands && model.spark);
    items.push({ key: "shelf", label: "The keepsake shelf", line: model.lines.shelf });
    for (const k of model.keepsakes.slice(0, World.SHELF_CAP)) {
      items.push({
        key: "keepsake", label: k.title, line: `${k.title} — ${k.summary}`,
        fetch: fetchOk ? {
          kind: "keepsake", id: k.id, recordId: k.id,
          presentLine: `${sparkName} brings you ${k.title} — ${k.summary}` +
            (k.civilDate ? ` It came to the shelf on ${k.civilDate}.` : "") +
            /* Slice 5: the carried line, named when it stands
             * on the keepsake's own record. */
            (k.carried ? ` ${k.carried.charAt(0).toUpperCase()}${k.carried.slice(1)}.` : "")
        } : null,
        carry: canCarry && k.id ? { ref: `keepsake:${k.id}`, title: k.title } : null
      });
    }
    if (model.keepsakeTotal > World.SHELF_CAP) {
      items.push({
        key: "shelf",
        label: "And more",
        line: `${model.keepsakeTotal - World.SHELF_CAP} more keepsakes rest in your Life Atlas, too many for one shelf to hold.`
      });
    }
    items.push({ key: "garden", label: "The garden ring", line: model.lines.garden });
    for (const bed of model.garden.beds) {
      if (!bed.plantings.length) continue;
      items.push({
        key: "bed",
        label: bed.name,
        line: bed.plantings.map(p =>
          `${p.cropName} — ${p.stageName.toLowerCase()}, witnessed ${p.witnessedDays} ${p.witnessedDays === 1 ? "day" : "days"}` +
          (p.harvested ? "; harvested, its keepsake by the door" : p.goneToSeed ? "; gone to seed" : "")
        ).join("; ") + "."
      });
    }
    items.push({ key: "path", label: "The path", line: model.lines.path });
    if (model.lines.road) items.push({ key: "road", label: "The road so far", line: model.lines.road });
    items.push({ key: "story", label: "The road marker", line: model.lines.story });
    items.push({ key: "story-corner", label: "The story corner", line: model.lines.storyCorner });
    for (const t of model.storyCorner.tokens) {
      items.push({
        key: "story-token",
        label: t.token || "A token",
        line: `${t.line} — watched through on ${t.watchedOn}. Its token stands here.` +
          (t.metAgainYears.length ? ` Met again in its own Moon in ${t.metAgainYears.join(", ")}.` : "") +
          (t.skill ? ` The skill it teaches, ${t.skill.name}, is marked met.` : ""),
        fetch: fetchOk ? {
          kind: "token", id: t.episodeId, recordId: t.recordId,
          presentLine: `${sparkName} brings you ${t.token || "a token"} — ${t.line}, watched through on ${t.watchedOn}.` +
            (t.carried ? ` ${t.carried.charAt(0).toUpperCase()}${t.carried.slice(1)}.` : "")
        } : null,
        carry: canCarry && t.episodeId ? { ref: `token:${t.episodeId}`, title: t.token || t.line || "a token" } : null
      });
    }
    if (model.journey) {
      for (const h of model.journey.hums) {
        items.push({
          key: "hum",
          label: `The hum of ${h.title || "an episode"}`,
          hum: h,
          line: `The hum of ${h.title || "an episode watched through"}` +
            (h.land ? ` — of ${h.land}` : "") + (h.moonName ? `, under ${h.moonName}` : "") +
            `. ${sparkName} learned it watching the episode through` +
            (h.patternDay ? `; its token came home on Pattern Day ${h.patternDay}` : "") +
            `. Touch again to hear it sounded.`
        });
      }
    }
    items.push({ key: "portrait", label: "The portrait of keeping", line: model.lines.portrait });
    if (model.lines.fetch) items.push({ key: "fetch", label: "Fetch the Token", line: model.lines.fetch });
    for (const item of items) {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "spark-home-item";
      const strong = document.createElement("strong");
      strong.textContent = item.label;
      const span = document.createElement("span");
      span.textContent = item.line;
      button.append(strong, span);
      button.addEventListener("click", () => {
        say(item.line);
        if (item.hum) soundMotifHz(item.hum.motifHz);
      });
      li.appendChild(button);
      if (item.fetch) {
        /* Fetch the Token, on its true stage: the keeper names
         * the keepsake, the Spark carries it. When the 3D world
         * stands, the scene performs the fetch; where it cannot
         * (the still form, or a keepsake beyond the shelf), the
         * Spark names it with its day and its story from where
         * it stands — the naming is never faked as a journey. */
        const fetchBtn = document.createElement("button");
        fetchBtn.type = "button";
        fetchBtn.className = "spark-home-item spark-home-fetch-btn";
        const fStrong = document.createElement("strong");
        fStrong.textContent = `Ask ${sparkName} to fetch it`;
        const fSpan = document.createElement("span");
        fSpan.textContent = "Fetch the Token — the Spark brings it to you and names it with its day and its story.";
        fetchBtn.append(fStrong, fSpan);
        fetchBtn.addEventListener("click", () => {
          if (actions && typeof actions.fetch === "function" && actions.fetch(item.fetch)) return;
          say(item.fetch.presentLine);
        });
        li.appendChild(fetchBtn);
      }
      if (item.carry) {
        /* Slice 5 — Carry For Me: one keepsake at a time,
         * carried for the day. The act writes through the
         * inhabitant's writer door (boot wires it); the words
         * refresh to name the carrying while it stands. */
        const carryBtn = document.createElement("button");
        carryBtn.type = "button";
        carryBtn.className = "spark-home-item spark-home-fetch-btn spark-home-carry-btn";
        const cStrong = document.createElement("strong");
        cStrong.textContent = `Ask ${sparkName} to carry this today`;
        const cSpan = document.createElement("span");
        cSpan.textContent = "Carry For Me — the Spark carries it with them for the day, and its light rides with them here and on the Sphere.";
        carryBtn.append(cStrong, cSpan);
        carryBtn.addEventListener("click", () => {
          if (actions && typeof actions.carry === "function") actions.carry(item.carry);
        });
        li.appendChild(carryBtn);
      }
      if (item.takeBack) {
        const backBtn = document.createElement("button");
        backBtn.type = "button";
        backBtn.className = "spark-home-item spark-home-fetch-btn spark-home-carry-btn";
        const bStrong = document.createElement("strong");
        bStrong.textContent = "Take it back";
        const bSpan = document.createElement("span");
        bSpan.textContent = "The carrying is complete — its end stands in the record against its beginning.";
        backBtn.append(bStrong, bSpan);
        backBtn.addEventListener("click", () => {
          if (actions && typeof actions.takeBack === "function") actions.takeBack();
        });
        li.appendChild(backBtn);
      }
      list.appendChild(li);
    }
  }

  function stillFallback(model, companion, stage, host, record) {
    const stage3d = $("#spark-home-stage", host);
    if (!stage3d) return;
    stage3d.classList.add("is-still");
    const Core = window.SparkCompanion;
    if (model.spark && Core && companion) {
      const art = document.createElement("div");
      art.className = "spark-home-still-art";
      art.innerHTML = Core.renderSVG(companion, { stage: stage ? stage.index : 0, wrap: Core.wrapFor(record) });
      stage3d.appendChild(art);
    }
    const note = document.createElement("p");
    note.className = "spark-home-still-note";
    note.textContent = model.spark
      ? "The 3D world could not stand on this device, so the world rests in its still form — everything in it is listed below, in plain words."
      : "The 3D world could not stand on this device. When you meet your Spark, its home will be described here in plain words, as it is below.";
    stage3d.appendChild(note);
  }

  /* ------------------------------ the scene ------------------------------ */

  const PHASE_LIGHT = {
    night: { bg: 0x0a1128, hemiSky: 0x36466a, hemiGround: 0x191411, hemi: 0.55, dir: 0x9db8ff, dirI: 0.3, stars: 0.95, body: 0x8fa8d8, bodyPos: [-9, 11, -14] },
    dawn: { bg: 0xbb8a68, hemiSky: 0xd8a37a, hemiGround: 0x3a2c22, hemi: 0.75, dir: 0xffb37a, dirI: 0.7, stars: 0.25, body: 0xffc98a, bodyPos: [13, 3.5, -6] },
    day: { bg: 0x9ec7e8, hemiSky: 0xcfe6ff, hemiGround: 0x4a5a3a, hemi: 1.0, dir: 0xfff2d8, dirI: 0.95, stars: 0, body: 0xffe9a8, bodyPos: [8, 13, -4] },
    dusk: { bg: 0x7a5570, hemiSky: 0xb98a7a, hemiGround: 0x2e2118, hemi: 0.7, dir: 0xff9a5e, dirI: 0.55, stars: 0.45, body: 0xffa26a, bodyPos: [-13, 3, -6] }
  };
  const SEASON_GROUND = { spring: 0x4d7f3e, summer: 0x59873c, autumn: 0x7d6c38, winter: 0xa8bcc2 };

  function hash01(text) {
    let h = 0x811c9dc5;
    const s = String(text);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return ((h >>> 0) % 10000) / 10000;
  }

  async function startScene(model, host, say) {
    const THREE = await import(assetUrl("assets/vendor/three/three.module.min.js"));
    const stageEl = $("#spark-home-stage", host);
    if (!stageEl) throw new Error("no stage");
    const W = stageEl.clientWidth || 640;
    const H = stageEl.clientHeight || 400;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(W, H);
    stageEl.appendChild(renderer.domElement);

    const phase = PHASE_LIGHT[model.sky.phase] || PHASE_LIGHT.day;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(phase.bg);
    scene.fog = new THREE.Fog(phase.bg, 20, 44);
    const camera = new THREE.PerspectiveCamera(46, W / H, 0.1, 120);

    scene.add(new THREE.HemisphereLight(phase.hemiSky, phase.hemiGround, phase.hemi));
    const dir = new THREE.DirectionalLight(phase.dir, phase.dirI);
    dir.position.set(phase.bodyPos[0], phase.bodyPos[1], phase.bodyPos[2]);
    scene.add(dir);

    const pickables = [];
    function pickable(obj, text) {
      obj.userData.say = text;
      pickables.push(obj);
      return obj;
    }
    /* Slice 4: the fetchable things, by the key the words list
     * names them with — shelf keepsakes and story-corner tokens. */
    const fetchTargets = new Map();
    const lam = (color, opts) => new THREE.MeshLambertMaterial({ color, ...(opts || {}) });

    /* ---- ground, gate, and the turning sky ---- */
    const ground = new THREE.Mesh(new THREE.CircleGeometry(17, 40), lam(SEASON_GROUND[model.sky.season]));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const skyBody = new THREE.Mesh(
      new THREE.SphereGeometry(model.sky.phase === "night" ? 0.55 : 0.8, 12, 12),
      new THREE.MeshBasicMaterial({ color: phase.body })
    );
    skyBody.position.set(phase.bodyPos[0], phase.bodyPos[1], phase.bodyPos[2]);
    scene.add(skyBody);

    const starGeo = new THREE.BufferGeometry();
    {
      const pts = [];
      for (let i = 0; i < 260; i++) {
        const a = hash01(`star-a-${i}`) * Math.PI * 2;
        const e = 0.25 + hash01(`star-e-${i}`) * 1.2;
        const r = 46;
        pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
      }
      starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    }
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xdfe8ff, size: 0.14, transparent: true, opacity: phase.stars, fog: false
    }));
    scene.add(stars);

    const wood = lam(0x8a6844);
    const darkWood = lam(0x5a3d2c);
    const stoneMat = lam(0x9a958c);

    /* the gate where the road comes in */
    const gate = new THREE.Group();
    for (const x of [-1.1, 1.1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.1, 7), darkWood);
      post.position.set(x, 1.05, 0);
      gate.add(post);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.14), darkWood);
    bar.position.y = 2.05;
    gate.add(bar);
    gate.position.set(0, 0, 13.6);
    pickable(gate, "The gate. The road comes in here, and the path of kept days starts at your feet.");
    scene.add(gate);

    /* ---- the path of kept days: one stone per day in the record ---- */
    const kept = Math.min(model.path.keptDays, 364);
    if (kept > 0) {
      const stoneGeo = new THREE.CylinderGeometry(0.3, 0.34, 0.07, 8);
      const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, kept);
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < kept; i++) {
        const t = kept === 1 ? 0.5 : i / (kept - 1);
        /* a gentle S from the gate (0, 13) to the door (-2.4, -0.4) */
        const x = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * 1.6 + t * t * -2.4 + (hash01(`stone-${i}`) - 0.5) * 0.3;
        const z = (1 - t) * (1 - t) * 13 + 2 * (1 - t) * t * 6.5 + t * t * -0.4;
        pos.set(x, 0.035, z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash01(`stone-r-${i}`) * Math.PI);
        stones.setMatrixAt(i, m4.compose(pos, q, scl));
      }
      /* Slice 4: a strongly marked day's stone is gilded — the
       * marks are the record's own, from the inhabitant's
       * breadth fold, and slice 2's rule holds: the mark must
       * stand beyond the keeping itself (witnessed, a token's
       * homecoming, a practice day, the birth day). A merely
       * kept day keeps plain stone; a stone whose day the fold
       * does not name is never gilded. */
      const markedSet = new Set((model.path.markedDays || [])
        .filter(m => (m.kinds || []).some(k => k !== "kept"))
        .map(m => m.pd));
      if (markedSet.size) {
        const gold = new THREE.Color(0xd8a03c);
        const days = model.path.stoneDays || [];
        for (let i = 0; i < kept; i++) {
          if (markedSet.has(days[i])) stones.setColorAt(i, gold);
        }
        if (stones.instanceColor) stones.instanceColor.needsUpdate = true;
      }
      pickable(stones, model.lines.path);
      scene.add(stones);
    }

    /* ---- the home, grown to the Spark's stage ---- */
    const homeGroup = new THREE.Group();
    homeGroup.position.set(-2.6, 0, -3.2);
    const fireLight = new THREE.PointLight(0xff9a3c, 0, 7);
    if (model.home.form === "hearth") {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.24), stoneMat);
        s.position.set(Math.cos(a) * 0.75, 0.11, Math.sin(a) * 0.75);
        s.rotation.y = a;
        homeGroup.add(s);
      }
      const fire = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffa63e }));
      fire.name = "home-fire";
      fire.position.y = 0.4;
      homeGroup.add(fire);
      fireLight.intensity = 1.1;
      fireLight.position.set(0, 0.8, 0);
      homeGroup.add(fireLight);
      const leanA = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.3), darkWood);
      leanA.position.set(-1.5, 1.05, -0.4);
      leanA.rotation.z = 0.5;
      homeGroup.add(leanA);
      const leanB = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.3), darkWood);
      leanB.position.set(-1.5, 1.05, 0.65);
      leanB.rotation.set(0.5, 0, 0.5);
      homeGroup.add(leanB);
    } else {
      const big = model.home.form === "hall";
      const walls = new THREE.Mesh(new THREE.BoxGeometry(big ? 3.8 : 2.7, big ? 2.3 : 1.7, big ? 2.7 : 2.2), wood);
      walls.position.y = (big ? 2.3 : 1.7) / 2;
      homeGroup.add(walls);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(big ? 3.1 : 2.2, big ? 1.5 : 1.1, 4), darkWood);
      roof.position.y = (big ? 2.3 : 1.7) + (big ? 0.75 : 0.55);
      roof.rotation.y = Math.PI / 4;
      homeGroup.add(roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.15, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xffca7a }));
      door.position.set(0.3, 0.58, (big ? 2.7 : 2.2) / 2 + 0.02);
      homeGroup.add(door);
      const winGeo = new THREE.BoxGeometry(0.44, 0.44, 0.05);
      const winMat = new THREE.MeshBasicMaterial({ color: 0xffd98f });
      const winAt = big ? [[-1.1, 1.3], [1.2, 1.3]] : [[-0.8, 1.05]];
      for (const [wx, wy] of winAt) {
        const w = new THREE.Mesh(winGeo, winMat);
        w.position.set(wx, wy, (big ? 2.7 : 2.2) / 2 + 0.02);
        homeGroup.add(w);
      }
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.9, 0.34), stoneMat);
      chimney.position.set(big ? 1.2 : 0.8, (big ? 2.3 : 1.7) + 0.7, -0.4);
      homeGroup.add(chimney);
      fireLight.intensity = 0.55;
      fireLight.position.set(0.3, 0.7, 1.6);
      homeGroup.add(fireLight);
      if (big) {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 3.1, 10), wood);
        tower.position.set(-2.3, 1.55, -0.6);
        homeGroup.add(tower);
        const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.1, 10), darkWood);
        towerRoof.position.set(-2.3, 3.65, -0.6);
        homeGroup.add(towerRoof);
        const bannerColor = model.spark && model.spark.palette ? model.spark.palette.accent : "#d8a03c";
        const banner = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.5),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(bannerColor) }));
        banner.position.set(-1.72, 2.7, -0.6);
        homeGroup.add(banner);
      }
    }
    pickable(homeGroup, model.lines.home);
    scene.add(homeGroup);

    /* ---- the keepsake shelf ---- */
    const shelf = new THREE.Group();
    shelf.position.set(2.1, 0, -1.6);
    shelf.rotation.y = -0.5;
    for (const px of [-0.95, 0.95]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.25, 0.09), darkWood);
      post.position.set(px, 0.62, 0);
      shelf.add(post);
    }
    for (const py of [0.55, 1.05]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 0.5), wood);
      plank.position.y = py;
      shelf.add(plank);
    }
    const KIND_SHAPES = {
      "tone-fragment": () => new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0x7ae0d4 })),
      "tone-kept": () => new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0x7ae0d4 })),
      word: () => new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.05), lam(0xf2ead2)),
      "pressed-leaf": () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), lam(0x69a84f)); m.scale.set(1, 0.3, 1.4); return m; },
      "smooth-stone": () => new THREE.Mesh(new THREE.DodecahedronGeometry(0.15), lam(0x8d9299)),
      "day-marker": () => new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.06), stoneMat)
    };
    model.keepsakes.slice(0, World.SHELF_CAP).forEach((k, i) => {
      const make = KIND_SHAPES[k.kind] || (() => new THREE.Mesh(new THREE.IcosahedronGeometry(0.14), lam(0xd8a03c)));
      const obj = make();
      const row = i < 6 ? 0 : 1;
      obj.position.set(-0.8 + (i % 6) * 0.32, (row === 0 ? 0.55 : 1.05) + 0.2, 0);
      pickable(obj, `${k.title} — ${k.summary}`);
      if (k.id) fetchTargets.set(`keepsake:${k.id}`, obj);
      shelf.add(obj);
    });
    pickable(shelf, model.lines.shelf);
    scene.add(shelf);

    /* ---- the garden ring: thirteen beds around the home ---- */
    const gardenGroup = new THREE.Group();
    gardenGroup.position.set(-2.6, 0, -3.2);
    const swayers = [];
    const soilMat = lam(0x5a4230);
    const stemMat = lam(0x4d7d3c);
    const STAGE_GROWTH = { Seed: 0.22, Sprout: 0.4, Leafing: 0.65, Flowering: 0.85, Ready: 1.0 };
    model.garden.beds.forEach((bed, i) => {
      const a = (i / 13) * Math.PI * 2 + 0.24;
      const bx = Math.cos(a) * 6.4;
      const bz = Math.sin(a) * 6.4;
      const bedGroup = new THREE.Group();
      bedGroup.position.set(bx, 0, bz);
      const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.98, 0.22, 10), soilMat);
      soil.position.y = 0.11;
      bedGroup.add(soil);
      bed.plantings.slice(0, 3).forEach((p, j) => {
        const plant = new THREE.Group();
        const off = (j - (Math.min(bed.plantings.length, 3) - 1) / 2) * 0.42;
        plant.position.set(off, 0.2, (j % 2 ? -0.18 : 0.18));
        const g = STAGE_GROWTH[p.stageName] || 0.3;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.7 * g + 0.15, 5), stemMat);
        stem.position.y = (0.7 * g + 0.15) / 2;
        plant.add(stem);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 * g + 0.08, 0),
          lam(p.goneToSeed ? 0x9a8a5e : 0x5f9c46));
        crown.position.y = 0.7 * g + 0.3;
        plant.add(crown);
        if (p.stageName === "Flowering" || p.stageName === "Ready") {
          const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6),
            new THREE.MeshBasicMaterial({ color: 0xf2b8d0 }));
          bloom.position.y = crown.position.y + 0.18;
          plant.add(bloom);
        }
        swayers.push({ obj: plant, phase: hash01(`bed-${bed.moon}-${j}`) * 6.28 });
        bedGroup.add(plant);
      });
      const line = bed.plantings.length
        ? `${bed.name} — ` + bed.plantings.map(p =>
            `${p.cropName}, ${p.stageName.toLowerCase()}, witnessed ${p.witnessedDays} ${p.witnessedDays === 1 ? "day" : "days"}` +
            (p.harvested ? ", harvested" : p.goneToSeed ? ", gone to seed" : "")).join("; ") + "."
        : `${bed.name} — bare soil. This bed opens in its Moon.`;
      pickable(bedGroup, line);
      gardenGroup.add(bedGroup);
    });
    pickable(gardenGroup, model.lines.garden);
    scene.add(gardenGroup);

    /* the harvest basket by the door */
    if (model.garden.keepsakeCount > 0) {
      const basket = new THREE.Group();
      basket.position.set(-1.2, 0, -1.2);
      const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.34, 9, 1, true), darkWood);
      tub.position.y = 0.17;
      basket.add(tub);
      const produceCols = [0xd86a3c, 0xc94f4f, 0x7fae4c, 0xe0b84f];
      for (let i = 0; i < Math.min(model.garden.keepsakeCount, World.BASKET_CAP); i++) {
        const item = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), lam(produceCols[i % produceCols.length]));
        const a = (i / Math.max(1, Math.min(model.garden.keepsakeCount, World.BASKET_CAP))) * Math.PI * 2;
        item.position.set(Math.cos(a) * 0.2, 0.36, Math.sin(a) * 0.2);
        basket.add(item);
      }
      pickable(basket, `The harvest basket: ${model.garden.keepsakeCount} harvest${model.garden.keepsakeCount === 1 ? "" : "s"} kept in the Pattern Garden, resting by the door.`);
      scene.add(basket);
    }

    /* ---- the road marker: a flag for every chapter found ---- */
    const marker = new THREE.Group();
    marker.position.set(3.1, 0, 11.8);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.9, 7), darkWood);
    post.position.y = 0.95;
    marker.add(post);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.34, 0.06), wood);
    board.position.set(0.4, 1.62, 0);
    board.rotation.y = 0.4;
    marker.add(board);
    const found = Math.min(model.story.foundCount, 24);
    if (found > 0) {
      const flagGeo = new THREE.ConeGeometry(0.1, 0.42, 4);
      const flags = new THREE.InstancedMesh(flagGeo, new THREE.MeshBasicMaterial({ color: 0xe0b84f }), found);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < found; i++) {
        m4.makeTranslation(-0.8 + (i % 8) * 0.24, 0.5 + Math.floor(i / 8) * 0.1, 0.55 + Math.floor(i / 8) * 0.3);
        flags.setMatrixAt(i, m4);
      }
      marker.add(flags);
    }
    pickable(marker, model.lines.story);
    scene.add(marker);

    /* ---- the story corner, standing in the world (slice 4) ----
     * One standing token for each episode watched through, on a
     * low ring of stones on the home ground's east side. The
     * tokens are the watch records' own, folded by the
     * activities module — a token stands here only because an
     * episode was watched through, and each names its episode,
     * its land and the day it came home when touched. */
    const cornerTokens = model.storyCorner.tokens.slice(0, 17);
    if (cornerTokens.length) {
      const corner = new THREE.Group();
      corner.position.set(3.6, 0, 0.4);
      cornerTokens.forEach((t, i) => {
        const a = cornerTokens.length > 1 ? (i / cornerTokens.length) * Math.PI * 2 : 0;
        const r = cornerTokens.length > 1 ? 0.85 : 0;
        const bx = Math.cos(a) * r;
        const bz = Math.sin(a) * r;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.07, 8), stoneMat);
        base.position.set(bx, 0.035, bz);
        corner.add(base);
        const disc = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.11, 0.3, 10),
          new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hash01(`token-${t.episodeId || i}`), 0.55, 0.55) })
        );
        disc.position.set(bx, 0.24, bz);
        pickable(disc, `${t.line} — watched through on ${t.watchedOn}. Its token stands here.` +
          (t.skill ? ` The skill it teaches, ${t.skill.name}, is marked met.` : ""));
        if (t.episodeId) fetchTargets.set(`token:${t.episodeId}`, disc);
        corner.add(disc);
      });
      pickable(corner, model.lines.storyCorner);
      scene.add(corner);
    }

    /* ---- a few trees and rocks, for the world's own sake ---- */
    const leafMat = lam(0x3f6d33);
    const treeAt = [[-9, -8], [8.5, -9], [11, 4], [-11, 5], [6, 9.5], [-7.5, 10.5]];
    for (const [tx, tz] of treeAt) {
      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.1, 6), darkWood);
      trunk.position.y = 0.55;
      tree.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.2, 7), leafMat);
      crown.position.y = 2.1;
      tree.add(crown);
      swayers.push({ obj: crown, phase: hash01(`tree-${tx}`) * 6.28 });
      scene.add(tree);
    }

    /* ---- the Spark itself ---- */
    let sparkGroup = null;
    let carriedLightMesh = null;
    let carryingNow = false;
    const sparkPos = new THREE.Vector3(1.5, 0, 3);
    if (model.spark) {
      const pal = model.spark.palette || { body: "#e8a34c", glow: "#ffd98f", accent: "#d86a3c" };
      sparkGroup = new THREE.Group();
      const bodyColor = new THREE.Color(pal.body);
      let bodyGeo;
      switch (model.spark.form) {
        case "shard": bodyGeo = new THREE.OctahedronGeometry(0.42); break;
        case "comet": bodyGeo = new THREE.SphereGeometry(0.4, 14, 12); break;
        case "sprout": bodyGeo = new THREE.SphereGeometry(0.38, 14, 12); break;
        case "wave": bodyGeo = new THREE.SphereGeometry(0.42, 14, 12); break;
        case "moth": bodyGeo = new THREE.SphereGeometry(0.36, 14, 12); break;
        default: bodyGeo = new THREE.SphereGeometry(0.4, 14, 12);
      }
      const body = new THREE.Mesh(bodyGeo, lam(bodyColor.getHex()));
      if (model.spark.form === "comet") body.scale.set(1, 0.85, 1.35);
      if (model.spark.form === "wave") body.scale.set(1.15, 0.72, 1);
      if (model.spark.form === "shard") body.scale.set(0.8, 1.25, 0.8);
      body.position.y = 0.55;
      sparkGroup.add(body);
      if (model.spark.form === "sprout") {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 5), lam(0x5f9c46));
        leaf.position.set(0.08, 1.05, 0);
        leaf.rotation.z = -0.4;
        sparkGroup.add(leaf);
      }
      if (model.spark.form === "moth") {
        const wingMat = lam(new THREE.Color(pal.accent).getHex(), { transparent: true, opacity: 0.75, side: THREE.DoubleSide });
        for (const s of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.CircleGeometry(0.3, 10), wingMat);
          wing.position.set(s * 0.36, 0.66, -0.05);
          wing.rotation.y = s * 0.7;
          sparkGroup.add(wing);
        }
      }
      if (model.spark.form === "comet") {
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 8),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(pal.glow), transparent: true, opacity: 0.55 }));
        tail.position.set(0, 0.55, -0.65);
        tail.rotation.x = Math.PI / 2 + 0.35;
        sparkGroup.add(tail);
      }
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 6),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(pal.accent) }));
      crest.position.y = 1.02;
      sparkGroup.add(crest);
      const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      eyeW.position.set(0, 0.62, 0.33);
      sparkGroup.add(eyeW);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0x1a1410 }));
      pupil.position.set(0, 0.62, 0.45);
      sparkGroup.add(pupil);
      /* its glow: a soft radial sprite in its own glow colour */
      const cnv = document.createElement("canvas");
      cnv.width = cnv.height = 128;
      const ctx = cnv.getContext("2d");
      const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
      const glowCss = pal.glow;
      grad.addColorStop(0, glowCss);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(cnv), transparent: true, opacity: 0.55, depthWrite: false
      }));
      sprite.scale.set(2.4, 2.4, 1);
      sprite.position.y = 0.55;
      sparkGroup.add(sprite);
      const light = new THREE.PointLight(new THREE.Color(pal.glow), 0.85, 6.5);
      light.position.y = 0.7;
      sparkGroup.add(light);
      /* Slice 5: the carried keepsake's light — a small steady
       * light riding above the Spark while a carry stands open
       * in the record, the same place the fetch's carried light
       * rides. It stands from the model's own carrying, and the
       * boot's refresh turns it as the record turns. */
      carriedLightMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffd98f })
      );
      carriedLightMesh.position.set(0, 1.35, 0);
      carriedLightMesh.visible = Boolean(model.journey && model.journey.carrying);
      carryingNow = carriedLightMesh.visible;
      sparkGroup.add(carriedLightMesh);
      const scale = (model.spark.size || 1) * (0.85 + model.spark.stageIndex * 0.22);
      sparkGroup.scale.setScalar(scale);
      sparkGroup.position.copy(sparkPos);
      pickable(sparkGroup, model.lines.spark);
      sparkGroup.userData.isSpark = true;
      scene.add(sparkGroup);
    }

    /* Slice 5: the wander follows the home's temper — a spare
     * home's Spark keeps a small round near the hearth; a
     * settled home's keeps the round the world has always
     * walked; a full home's ranges the whole ground. */
    const WANDER_BY_TIER = {
      spare: { cx: -2.3, cz: -2.4, rx: 2.0, rz: 1.7 },
      settled: { cx: -1.2, cz: -0.6, rx: 4.6, rz: 4.2 },
      full: { cx: -0.4, cz: -0.3, rx: 5.8, rz: 4.9 }
    };
    const wanderSpec = WANDER_BY_TIER[model.fullness ? model.fullness.tier : "settled"] || WANDER_BY_TIER.settled;

    /* ---- motes: pollen by day, fireflies by night ---- */
    const MOTES = 44;
    const moteGeo = new THREE.BufferGeometry();
    const moteBase = [];
    {
      const pts = [];
      for (let i = 0; i < MOTES; i++) {
        const x = (hash01(`mote-x-${i}`) - 0.5) * 22;
        const y = 0.4 + hash01(`mote-y-${i}`) * 2.6;
        const z = (hash01(`mote-z-${i}`) - 0.5) * 22;
        moteBase.push([x, y, z]);
        pts.push(x, y, z);
      }
      moteGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    }
    const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
      color: model.sky.phase === "day" || model.sky.phase === "dawn" ? 0xfff6d8 : 0xffca7a,
      size: 0.13, transparent: true, opacity: 0.8
    }));
    scene.add(motes);

    /* ------------------------- camera & touch ------------------------- */
    const target = new THREE.Vector3(-1.1, 0.9, -0.6);
    let azimuth = 0.55;
    let polar = 1.03;
    let radius = 14.5;
    let lastTouch = 0;
    function placeCamera() {
      camera.position.set(
        target.x + radius * Math.sin(polar) * Math.sin(azimuth),
        target.y + radius * Math.cos(polar),
        target.z + radius * Math.sin(polar) * Math.cos(azimuth)
      );
      camera.lookAt(target);
    }
    placeCamera();

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downAt = null;
    let pulse = null;
    /* The Spark answers its own taps in person: the first tap
     * speaks the day as it stands, later taps answer in its own
     * voice — and it hops, the way a small living thing does. */
    let sparkTaps = 0;
    let sparkHop = null;
    function nextSparkLine() {
      const speech = model.sparkSpeech;
      sparkTaps += 1;
      if (sparkTaps === 1 && speech && speech.dayLine) return speech.dayLine;
      if (speech && speech.reactions.length) {
        return speech.reactions[(sparkTaps - 1) % speech.reactions.length];
      }
      return model.lines.spark;
    }
    const el = renderer.domElement;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", e => {
      downAt = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now() };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", e => {
      if (!downAt) return;
      const dx = e.clientX - downAt.lx;
      const dy = e.clientY - downAt.ly;
      downAt.lx = e.clientX;
      downAt.ly = e.clientY;
      if (Math.abs(e.clientX - downAt.x) + Math.abs(e.clientY - downAt.y) > 7) downAt.moved = true;
      if (!downAt.moved) return;
      azimuth -= dx * 0.0052;
      polar = Math.min(1.32, Math.max(0.62, polar - dy * 0.004));
      lastTouch = performance.now();
      placeCamera();
      if (reducedMotion) renderer.render(scene, camera);
    });
    el.addEventListener("pointerup", e => {
      const wasTap = downAt && !downAt.moved && performance.now() - downAt.t < 450;
      downAt = null;
      lastTouch = performance.now();
      if (!wasTap) return;
      const rect = el.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(pickables, true);
      for (const hit of hits) {
        let node = hit.object;
        while (node && !node.userData.say) node = node.parent;
        if (node) {
          if (node.userData.isSpark) {
            say(nextSparkLine());
            sparkHop = { t0: performance.now() };
          } else {
            say(node.userData.say);
            pulse = { obj: node, t0: performance.now() };
          }
          break;
        }
      }
    });
    el.addEventListener("wheel", e => {
      e.preventDefault();
      radius = Math.min(21, Math.max(9, radius + Math.sign(e.deltaY) * 1.2));
      lastTouch = performance.now();
      placeCamera();
      if (reducedMotion) renderer.render(scene, camera);
    }, { passive: false });

    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    let disposed = false;
    const io = new IntersectionObserver(entries => {
      visible = entries.some(en => en.isIntersecting);
    }, { threshold: 0.05 });
    io.observe(stageEl);

    new ResizeObserver(() => {
      const w = stageEl.clientWidth || W;
      const h = stageEl.clientHeight || H;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (reducedMotion) renderer.render(scene, camera);
    }).observe(stageEl);

    /* ---- Fetch the Token (slice 4) ----
     * The keeper names a keepsake or a token; the Spark travels
     * the home ground to it, takes it up (a small carried light
     * in its place above the Spark), carries it to the path by
     * the gate, and presents it — the readout names it with its
     * day and its story — then returns it to its place and
     * wanders on. A showing: the fetch writes nothing, moves
     * nothing permanently, and a second naming while one runs
     * is refused. Under reduced motion there is no travel: the
     * Spark names the keepsake from where it stands. */
    let fetchAnim = null;
    const PRESENT_AT = new THREE.Vector3(0.6, 0, 6.4);
    function fetchKeepsake(target) {
      if (!sparkGroup || !target) return false;
      if (fetchAnim) return false;
      const obj = fetchTargets.get(`${target.kind}:${target.id}`);
      if (!obj) return false;
      if (reducedMotion) {
        say(target.presentLine);
        return true;
      }
      const dest = new THREE.Vector3();
      obj.updateWorldMatrix(true, false);
      obj.getWorldPosition(dest);
      const carried = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffd98f })
      );
      carried.position.set(0, 1.35, 0);
      carried.visible = false;
      sparkGroup.add(carried);
      fetchAnim = {
        steps: [
          { to: dest.clone(), ms: 1500 },
          { pause: 450 },
          { to: PRESENT_AT.clone(), ms: 1600, carry: true },
          { sayLine: target.presentLine, pause: 2800 },
          { to: dest.clone(), ms: 1500, carry: true },
          { pause: 350 }
        ],
        idx: 0, from: null, endsAt: 0, stepMs: 0, carried
      };
      return true;
    }

    function driveFetch(now) {
      const step = fetchAnim.steps[fetchAnim.idx];
      if (!step) {
        fetchAnim.carried.removeFromParent();
        fetchAnim = null;
        return;
      }
      if (!fetchAnim.from) {
        fetchAnim.from = sparkGroup.position.clone();
        fetchAnim.stepMs = step.ms || step.pause || 1;
        fetchAnim.endsAt = now + fetchAnim.stepMs;
        fetchAnim.carried.visible = Boolean(step.carry);
        if (step.sayLine) say(step.sayLine);
      }
      const k = Math.min(1, Math.max(0, (now - (fetchAnim.endsAt - fetchAnim.stepMs)) / fetchAnim.stepMs));
      if (step.to) {
        sparkGroup.position.lerpVectors(fetchAnim.from, step.to, k);
        sparkGroup.position.y = Math.sin(k * Math.PI) * 0.5;
        const dx = step.to.x - fetchAnim.from.x;
        const dz = step.to.z - fetchAnim.from.z;
        if (Math.abs(dx) + Math.abs(dz) > 0.01) sparkGroup.rotation.y = Math.atan2(dx, dz);
      }
      if (k >= 1) {
        fetchAnim.idx += 1;
        fetchAnim.from = null;
      }
    }

    const clock = new THREE.Clock();
    let frames = 0;
    let slowTime = 0;
    let prLevel = 0;
    function tick() {
      if (disposed) return;
      requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      if (!reducedMotion) {
        if (performance.now() - lastTouch > 6000) azimuth += dt * 0.018;
        placeCamera();
        for (const s of swayers) s.obj.rotation.z = Math.sin(t * 1.1 + s.phase) * 0.045;
        const fire = homeGroup.getObjectByName("home-fire");
        if (fire) {
          const f = 0.9 + Math.sin(t * 11) * 0.08 + Math.sin(t * 23.7) * 0.05;
          fire.scale.set(f, 0.92 + Math.sin(t * 9.3) * 0.12, f);
          fireLight.intensity = 1.0 + Math.sin(t * 13.7) * 0.18;
        }
        if (sparkGroup) {
          if (fetchAnim) {
            driveFetch(performance.now());
          } else {
            /* The wander: the Spark drifts toward its ellipse
             * point rather than being placed on it, so a fetch
             * hands back into the wander smoothly, from wherever
             * the Spark stands. The ellipse is the home's
             * temper's (slice 5): spare keeps a small round by
             * the hearth, full ranges the whole ground. */
            const a = t * 0.11;
            const wx = wanderSpec.cx + Math.cos(a) * wanderSpec.rx;
            const wz = wanderSpec.cz + Math.sin(a) * wanderSpec.rz;
            const dx = wx - sparkGroup.position.x;
            const dz = wz - sparkGroup.position.z;
            const ease = Math.min(1, dt * 1.6);
            sparkGroup.position.x += dx * ease;
            sparkGroup.position.z += dz * ease;
            sparkGroup.position.y = Math.sin(t * 1.7) * 0.09;
            if (Math.abs(dx) + Math.abs(dz) > 0.0005) {
              sparkGroup.rotation.y = Math.atan2(dx, dz);
            }
          }
          sparkGroup.rotation.z = Math.sin(t * 2.2) * 0.04;
          if (sparkHop) {
            const k = (performance.now() - sparkHop.t0) / 550;
            if (k >= 1) sparkHop = null;
            else sparkGroup.position.y += Math.sin(k * Math.PI) * 0.45;
          }
        }
        const posAttr = moteGeo.getAttribute("position");
        for (let i = 0; i < MOTES; i++) {
          const [bx, by, bz] = moteBase[i];
          posAttr.setXYZ(i,
            bx + Math.sin(t * 0.24 + i * 1.7) * 0.7,
            by + Math.sin(t * 0.5 + i * 2.3) * 0.3,
            bz + Math.cos(t * 0.19 + i) * 0.7);
        }
        posAttr.needsUpdate = true;
      }
      if (pulse) {
        const k = (performance.now() - pulse.t0) / 450;
        if (k >= 1) {
          pulse.obj.scale.setScalar(pulse.base || 1);
          pulse = null;
        } else {
          if (pulse.base == null) pulse.base = pulse.obj.scale.x;
          pulse.obj.scale.setScalar(pulse.base * (1 + Math.sin(k * Math.PI) * 0.06));
        }
      }
      renderer.render(scene, camera);
      /* step the quality down on a slow device, never up */
      frames += 1;
      slowTime += dt;
      if (frames >= 150 && prLevel < 2) {
        const avg = slowTime / frames;
        if (avg > 0.027) {
          prLevel += 1;
          renderer.setPixelRatio(prLevel === 1 ? 1.25 : 1);
        }
        frames = 0;
        slowTime = 0;
      }
    }
    if (reducedMotion) {
      renderer.render(scene, camera);
    } else {
      tick();
    }
    return {
      dispose() {
        disposed = true;
        io.disconnect();
        renderer.dispose();
        el.remove();
      },
      /* Slice 4: the fetch, and two small measuring hooks the
       * capture harness reads (where the Spark stands; where a
       * fetchable thing stands). Keepers never see them. */
      fetch: fetchKeepsake,
      fetching() { return Boolean(fetchAnim); },
      /* Slice 5: the wander the temper walks, and the carried
       * light's switch — the same measuring honesty as the
       * hooks above; the boot's refresh turns the light as the
       * record's carry opens and closes. */
      wanderSpec() { return { ...wanderSpec }; },
      setCarrying(on) {
        carryingNow = Boolean(on);
        if (carriedLightMesh) carriedLightMesh.visible = carryingNow;
      },
      carrying() { return carryingNow; },
      sparkPosition() {
        return sparkGroup ? { x: sparkGroup.position.x, z: sparkGroup.position.z } : null;
      },
      pointFor(kind, id) {
        const obj = fetchTargets.get(`${kind}:${id}`);
        if (!obj) return null;
        const v = new THREE.Vector3();
        obj.updateWorldMatrix(true, false);
        obj.getWorldPosition(v);
        return { x: v.x, z: v.z };
      }
    };
  }

  /* ------------------------------- boot ------------------------------- */

  let booted = false;
  let homeSection = null;
  let homeSay = null;
  let homeSceneApi = null;

  /* Slice 5 — re-read the world after a write lands (a carry
   * opened or closed, a carried line written): the words are
   * re-rendered from a fresh collect, and the scene's carried
   * light follows the record. The scene itself is not rebuilt
   * — the Spark does not leave its ground for a refresh. */
  async function refreshHome() {
    if (!homeSection || !homeSay) return;
    let collected;
    try {
      collected = await collectModel();
    } catch {
      return;
    }
    renderWords(collected.model, homeSection, homeSay, homeActions);
    if (homeSceneApi && typeof homeSceneApi.setCarrying === "function") {
      homeSceneApi.setCarrying(Boolean(collected.model.journey && collected.model.journey.carrying));
    }
  }

  /* Slice 5 — the carried line (design §1.4): at a keepsake's
   * first fetch, one line lands on the keepsake's own Atlas
   * record — "carried to you, [day]" — through the repository's
   * own put. The record itself is the guard: a record already
   * carrying a line is never written twice (the inhabitant's
   * carriedLineForRecord returns null), so a second fetch
   * writes nothing. The fetch's life lines stay unwritten, as
   * they always have been. */
  async function writeCarriedLineOnce(target) {
    try {
      const Inh = homeInhabitant || window.SphereSparkInhabitant;
      const repo = homeRepository;
      if (!Inh || !repo || !target || !target.recordId) return;
      const records = await repo.query({});
      const rec = records.find(r => r && r.id === target.recordId);
      if (!rec) return;
      const pos = todayCoordinate();
      const result = Inh.carriedLineForRecord(rec, {
        civilDate: (pos && pos.civilDate) || new Date().toISOString().slice(0, 10),
        patternDay: pos && pos.dayOfPatternYear != null ? pos.dayOfPatternYear : null
      });
      if (!result) return;
      await repo.put(result.record);
      void refreshHome();
    } catch { /* a failed write is no write; the fetch still stands */ }
  }

  const homeActions = { fetch: null, carry: null, takeBack: null };

  async function boot(section) {
    if (booted) return;
    booted = true;
    homeSection = section;
    const readout = $("#spark-home-readout", section);
    const say = text => {
      if (readout && text) readout.textContent = text;
    };
    homeSay = say;
    let collected;
    try {
      collected = await collectModel();
    } catch {
      collected = { model: World.buildModel({}), companion: null, stage: null, record: null };
    }
    const { model, companion, stage, record } = collected;
    const actions = homeActions;
    renderWords(model, section, say, actions);
    say(`${model.lines.sky}. ${model.lines.home}`);

    /* Slice 5 — Carry For Me and its end, written through the
     * inhabitant module's writer door: the site's one life-line
     * writer, the same store, the same refusal rules. One carry
     * at a time; the end names its beginning's line id. */
    const freshLines = () => {
      const Core = window.SparkCompanion;
      const rec = Core ? readSparkRecord(Core) : null;
      const Inh = homeInhabitant || window.SphereSparkInhabitant;
      return { rec, Inh, lines: Inh && rec ? Inh.lifeLinesOf(rec) : [] };
    };
    actions.carry = (carry) => {
      const { rec, Inh, lines } = freshLines();
      const name = rec && rec.name ? rec.name : "The Spark";
      if (!Inh || !rec) { say("The carrying could not be written just now — nothing was written."); return; }
      if (Inh.openCarryFromLines(lines)) {
        say(`${name} is already carrying something for you today — one carry at a time. Take it back first.`);
        return;
      }
      const line = Inh.appendLifeLineViaRoot(window, "care-act", { kind: "carry", ref: carry.ref });
      if (!line) { say("The record would not take the carrying just now — nothing was written."); return; }
      say(`${name} takes up ${carry.title} — carrying it for you today.`);
      void refreshHome();
    };
    actions.takeBack = () => {
      const { rec, Inh, lines } = freshLines();
      const name = rec && rec.name ? rec.name : "The Spark";
      if (!Inh || !rec) { say("The carrying's end could not be written just now — nothing was written."); return; }
      const open = Inh.openCarryFromLines(lines);
      if (!open) { say("No carrying stands open."); return; }
      const line = Inh.appendLifeLineViaRoot(window, "care-act", { kind: "carry-end", ref: open.id });
      if (!line) { say("The record would not take the carrying's end just now — nothing was written."); return; }
      say(`${name} sets it down — the carrying is complete, and its end stands in the record against its beginning.`);
      void refreshHome();
    };

    try {
      const sceneApi = await startScene(model, section, say);
      section.__sparkHomeScene = sceneApi;
      homeSceneApi = sceneApi;
      actions.fetch = (target) => {
        /* A fetch already running refuses a second naming —
         * and writes nothing for it. Otherwise the carried
         * line's write rides along with the fetch itself. */
        if (typeof sceneApi.fetching === "function" && sceneApi.fetching()) return false;
        void writeCarriedLineOnce(target);
        return sceneApi.fetch(target);
      };
      section.classList.add("is-live");
    } catch {
      /* The still form: a fetch here is the naming alone (the
       * words list's own fallback), and the carried line still
       * lands — the naming IS the fetch on this form. */
      actions.fetch = (target) => {
        void writeCarriedLineOnce(target);
        return false;
      };
      stillFallback(model, companion, stage, section, record);
    }
  }

  function init() {
    const section = document.getElementById("spark-home");
    if (!section) return;
    if (!("IntersectionObserver" in window)) {
      void boot(section);
      return;
    }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        io.disconnect();
        void boot(section);
      }
    }, { rootMargin: "240px" });
    io.observe(section);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
