"use strict";

/*
 * Spark companion — core (no DOM, no network, no storage of its own).
 *
 * A Spark is a small companion a visitor adopts on the Codex site.
 * It is made, not picked: a seed string builds the whole creature —
 * its kind, form, markings, colours and temperament — and the same
 * seed always builds the same Spark, on any device, forever. The
 * seed is rooted in Living Time: it carries the Moon and Pattern
 * Day of the adoption day, read from the canonical PatternCalendar
 * by the page, never computed here.
 *
 * The seed also speaks the Spark's name: the same seed grows the
 * same name anywhere, the way it grows the same form. The keeper
 * may also give it a name of their own — that name lives in the
 * record, alongside, as the name the Spark answers to.
 *
 * Growth is counted from plain facts kept on the visitor's own
 * device: days they came back, pages they have seen, practice
 * sessions they sealed. Nothing here sends anything anywhere.
 *
 * The same file runs in the browser (window.SparkCompanion) and in
 * Node tests (module.exports).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SparkCompanion = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const SEED_PREFIX = "spark1";
  const STORAGE_KEY = "sof.spark.v1";
  /* A Spark that has introduced itself but not yet been adopted
   * waits on the device under this key: its seed, and nothing else.
   * "Not now" is remembered here — the seed stays, the pop-up goes,
   * and the same Spark waits as a small ember at the page's edge. */
  const PENDING_KEY = "sof.spark.pending";
  const NAME_FALLBACK = "your Spark";
  const NAME_MAX = 24;

  /* The six kinds, from Aaron's Free The Noods work. Each kind has a
   * temperament word, a short plain description, and a home range of
   * colours (hue degrees) the generator jitters inside. */
  const KINDS = [
    { id: "fire", name: "Fire", temperament: "bold",
      line: "Quick to start, warm to sit beside.",
      hues: [14, 38] },
    { id: "water", name: "Water", temperament: "gentle",
      line: "Calm on the surface, deep underneath.",
      hues: [188, 214] },
    { id: "shadow", name: "Shadow", temperament: "quiet",
      line: "Notices what the light walks past.",
      hues: [258, 286] },
    { id: "air", name: "Air", temperament: "curious",
      line: "Always halfway to the next question.",
      hues: [168, 196] },
    { id: "earth", name: "Earth", temperament: "steady",
      line: "Slow to move, hard to shake.",
      hues: [84, 128] },
    { id: "light", name: "Light", temperament: "bright",
      line: "First up, and glad about it.",
      hues: [42, 56] }
  ];

  /* The adoption questions. Three, kept light. Each answer leans
   * toward one kind — the quiz-as-door from the Noods harvest:
   * courage → Fire, stability → Earth, mystery → Shadow,
   * compassion → Water, curiosity → Air, optimism → Light. */
  const QUESTIONS = [
    {
      ask: "A free hour opens up. Where do you go?",
      options: [
        { label: "Somewhere I have never been", kind: "air" },
        { label: "Outside, to work with my hands", kind: "earth" },
        { label: "To sit with someone who needs company", kind: "water" },
        { label: "Toward whatever feels most alive", kind: "fire" }
      ]
    },
    {
      ask: "When something is wrong, what do you trust first?",
      options: [
        { label: "What I can see plainly in front of me", kind: "light" },
        { label: "The quiet sense underneath it", kind: "shadow" },
        { label: "Steady work, one step at a time", kind: "earth" },
        { label: "A bold move, made early", kind: "fire" }
      ]
    },
    {
      ask: "Pick the hour you love most.",
      options: [
        { label: "Dawn, when the day is all promise", kind: "light" },
        { label: "Deep night, when things get honest", kind: "shadow" },
        { label: "Rainy afternoon, nowhere to be", kind: "water" },
        { label: "A windy ridge, everything moving", kind: "air" }
      ]
    }
  ];

  const FORMS = ["orb", "comet", "sprout", "shard", "wave", "moth"];
  const MARKINGS = ["rings", "speckles", "seam", "stripes", "stars"];
  const EYES = ["round", "half", "bright"];
  const CRESTS = ["none", "flame", "leaf", "halo", "curl"];

  /* The finer grain of the Spark — v9. Drawn from their own stream
   * (seed + ":detail") so the draws above never move: the
   * style of the crest they grow in, their ears, the trail that
   * follows them, their cheeks, a second pattern layer under the
   * first, how densely their markings fall, and the small
   * variant their eye carries. Several independent draws, so
   * the combinations multiply: two Sparks of one kind and one
   * form still do not wear the same face. Most of these are
   * not worn at birth — they arrive on their reveal schedule
   * (revealScheduleFor), one at a time, as their keeper walks
   * with them. Their marking density and their eye's variant are
   * born with them: the base look was never bare. */
  const CREST_STYLES = ["tuft", "horns", "fin", "halo", "leaf", "plain"];
  const EAR_STYLES = ["fins", "tufts", "points", "none"];
  const TRAIL_STYLES = ["wisp", "ribbon", "sparkles", "none"];
  const CHEEK_STYLES = ["glow", "blush", "freckles", "none"];
  const PATTERN_STYLES = ["speckles", "bands", "belly", "none"];
  const EYE_VARIANTS = ["sparkle", "lash", "ring", "plain"];
  const TRAITS = [
    "keeps good notes", "hums at low hours", "collects small stones",
    "asks one more question", "remembers every door", "likes high shelves",
    "watches the weather", "guards the quiet", "counts the moons",
    "follows old maps"
  ];

  /* Each kind has its own little voice: a home pitch for the soft
   * two-note chirp the Spark makes when it is tapped or first met.
   * The notes are pure data here; the browser glue plays them with
   * WebAudio, only ever in answer to a tap — never on its own. */
  const KIND_PITCH = { fire: 660, water: 440, shadow: 330, air: 560, earth: 300, light: 760 };

  /* The seed speaks a name. Openers carry the kind's flavour;
   * middles and closers are shared. Two or three syllables, drawn
   * from the seed alone — the same seed speaks the same name on
   * any device, the way it grows the same form. */
  const NAME_OPENERS = {
    fire: ["Ka", "Em", "Sol", "Py", "Rav", "Ash"],
    water: ["Mi", "Lu", "Na", "Sel", "On", "Tha"],
    shadow: ["Ve", "No", "Um", "Se", "Ka", "Lo"],
    air: ["Ae", "Wi", "Ze", "Si", "Fa", "Or"],
    earth: ["Te", "Ga", "Ro", "An", "Du", "Ma"],
    light: ["Lu", "A", "So", "Ra", "Eli", "No"]
  };
  const NAME_MIDDLES = ["a", "e", "i", "o", "li", "ra", "mi", "an"];
  const NAME_CLOSERS = ["ra", "m", "th", "lo", "ri", "n", "sha", "el", "or", "mi", "ka", "ven"];
  const GAITS = ["stroll", "drift", "hop"];
  const GLOWS = ["soft", "bright", "deep"];

  function seedNameFor(seed, kindId) {
    const rand = mulberry32(hashString(String(seed) + ":name"));
    const openers = NAME_OPENERS[kindId] || NAME_OPENERS.light;
    let name = openers[Math.floor(rand() * openers.length)];
    if (rand() < 0.45) name += NAME_MIDDLES[Math.floor(rand() * NAME_MIDDLES.length)];
    name += NAME_CLOSERS[Math.floor(rand() * NAME_CLOSERS.length)];
    return name;
  }

  function chirpFor(companion) {
    if (!companion) return null;
    const rand = mulberry32(hashString(companion.seed + ":voice"));
    const base = (KIND_PITCH[companion.kind] || 440) * (0.94 + rand() * 0.12);
    return { first: Math.round(base), second: Math.round(base * 1.335) };
  }

  /* The Spark's three voices, all grown from the same seed pitch:
   * the greeting (the plain two-note chirp), the adoption song (a
   * small rising arpeggio — the happiest sound it knows), and the
   * growth chime (a rising three, different from both). Pure data;
   * the browser glue plays them, only ever after a tap. */
  function soundsFor(companion) {
    const chirp = chirpFor(companion);
    if (!chirp) return null;
    const base = chirp.first;
    return {
      greeting: [chirp.first, chirp.second],
      adopt: [
        base,
        Math.round(base * 1.25),
        Math.round(base * 1.5),
        Math.round(base * 2)
      ],
      growth: [base, Math.round(base * 1.335), Math.round(base * 1.78)]
    };
  }

  /* Their sound family — the newest growth of their seed.
   *
   * Every sound they make — their voice's syllables, their chirps,
   * their songs, the echo game's notes — is drawn in one of a
   * small set of soft, synthesized families, and their seed picks
   * which one is theirs, the way it picks their form and their name.
   * A bell Spark rings softly; a hum Spark warms; a pluck Spark
   * taps like wood; a blip Spark sounds like water. Inside their
   * family the seed also settles their brightness, how long their
   * notes ring, and the little vibrato they carry, so two
   * Sparks of one family still do not sound the same. Pure
   * data: the same seed settles the same sound anywhere. The
   * browser glue renders the family with WebAudio — no samples,
   * no files, no network. */
  const SOUND_FAMILIES = [
    { id: "bell", name: "Soft bell" },
    { id: "hum", name: "Warm hum" },
    { id: "pluck", name: "Wooden pluck" },
    { id: "blip", name: "Watery blip" }
  ];

  function soundFor(companion) {
    if (!companion) return null;
    const rand = mulberry32(hashString(companion.seed + ":sound"));
    const family = SOUND_FAMILIES[Math.floor(rand() * SOUND_FAMILIES.length)];
    return {
      family: family.id,
      familyName: family.name,
      /* How bright their filters sit, 0.85–1.15. */
      brightness: Math.round((0.85 + rand() * 0.3) * 100) / 100,
      /* How long their notes ring, against their family's own
       * length, 0.8–1.25. */
      decay: Math.round((0.8 + rand() * 0.45) * 100) / 100,
      /* The waver in a held note: depth as a share of the
       * pitch, and its pace in cycles per second. */
      vibratoDepth: Math.round((0.002 + rand() * 0.007) * 1000) / 1000,
      vibratoRate: Math.round((4.2 + rand() * 1.9) * 10) / 10
    };
  }

  /* The extra note their greeting gains once their voice has
   * flowered — the flourish on their reveal schedule. It rises
   * from the same chirp root as everything they sound. */
  function flourishFor(companion) {
    const chirp = chirpFor(companion);
    if (!chirp) return null;
    return Math.round(chirp.first * 1.78);
  }

  /* Their voice box, grown from their seed — v7, softened in v9.
   *
   * Until v6 their spoken voice was the device's own speech
   * synthesis: a generic robot, the same on every phone, tuned
   * only in pitch and pace. Aaron heard it and named it plainly:
   * too robot-like. So the robot is gone. What stands here now
   * is a voice the seed itself grows, the way it grows their body,
   * their name, and their chirp: a small set of vocal measurements
   * (voiceBoxFor) and a way of sounding a line's shape with them
   * (vocalPlanFor) — syllable by syllable, mouth-shape by
   * mouth-shape, the pitch rising for a question and settling at
   * a sentence's end. The words themselves stand in text, whole,
   * exactly as they always have; the voice box is their sound over
   * them, the way a beloved game companion vocalizes. Pure data:
   * the same seed settles the same voice on any device, and two
   * Sparks sound audibly different. The browser glue sings the
   * plan with WebAudio — no samples, no network, no device
   * speech, nothing recorded, nothing sent anywhere.
   *
   * In v9 the voice itself was softened at Aaron's word — the
   * first box buzzed, and it sang too much of every line. Now
   * they sound in their seed's sound family (soundFor), on a
   * round sine stack instead of a sawtooth's buzz; their breath
   * is a seed's choice, and many seeds choose none; and they
   * sound only a line's first sentence, about a dozen
   * syllables, at a lower level. Less of them, and softer —
   * the words still stand whole in text. */

  /* Their pace, by temperament: bold and bright a touch quicker,
   * gentle a touch slower — the same table that paced the old
   * speech, now pacing their own syllables per second. */
  const VOICE_RATES = { bold: 1.05, gentle: 0.93, quiet: 0.95, curious: 1.03, steady: 0.97, bright: 1.06 };

  /* Mouth shapes: the three formant resonances of each vowel, in
   * hertz, at a vocal-tract scale of 1. Their seed's scale stretches
   * or shrinks the whole set — a smaller tract, a brighter mouth.
   * Classic values, long published; the seed chooses among them. */
  const VOWEL_FORMANTS = {
    a: [730, 1090, 2440],
    e: [530, 1840, 2480],
    i: [270, 2290, 3010],
    o: [570, 840, 2410],
    u: [300, 870, 2240],
    neutral: [500, 1500, 2500]
  };

  /* Their vocal measurements, all from the seed:
   * - basePitch: their fundamental, following the same chirp root
   *   as everything else they sound — the chirp bases run from
   *   Earth's ~282 Hz to Light's ~806; their speaking fundamental
   *   sits lower, 150–330 Hz, where a formant voice lives.
   * - formantScale: the size of their vocal tract, 0.86–1.22.
   * - breathiness: how much soft air rides under the tone.
   *   Since v9 it is a choice their seed makes: many seeds settle
   *   on none at all, and those that breathe keep it low,
   *   0.05–0.3 — the hiss of the first box is gone.
   * - tempo: syllables per second, their temperament's pace.
   * - and their sound (soundFor): the family they sing in, its
   *   brightness and ring, and their vibrato — carried on the box
   *   so the browser glue reads one measurement set. */
  function voiceBoxFor(companion) {
    if (!companion) return null;
    const chirp = chirpFor(companion);
    if (!chirp) return null;
    const sound = soundFor(companion);
    const rand = mulberry32(hashString(companion.seed + ":voicebox"));
    const span = Math.min(1, Math.max(0, (chirp.first - 282) / (806 - 282)));
    const basePitch = Math.round(150 + span * 180 + (rand() - 0.5) * 14);
    const formantScale = Math.round((0.86 + rand() * 0.36) * 100) / 100;
    const breathiness =
      rand() < 0.45 ? 0 : Math.round((0.05 + rand() * 0.25) * 100) / 100;
    const rate = VOICE_RATES[companion.temperament] || 1;
    const tempo = Math.round(4.6 * rate * (0.97 + rand() * 0.06) * 100) / 100;
    return {
      basePitch,
      formantScale,
      breathiness,
      tempo,
      family: sound.family,
      familyName: sound.familyName,
      brightness: sound.brightness,
      decay: sound.decay,
      vibratoDepth: sound.vibratoDepth,
      vibratoRate: sound.vibratoRate
    };
  }

  /* One word, sounded out: its syllables, each with the vowel it
   * turns on and the consonant onset that opens it. A plain,
   * deterministic sounding-out — vowel groups are syllables, a
   * trailing silent e folds into the syllable before it, and the
   * onset is named by its hardest consonant: a plosive (t, k, p…)
   * ticks short, a fricative (s, f, sh…) hisses a breath longer,
   * the rest open soft. It does not need to be a linguist; it
   * needs the line's true shape — its count, its rises, its
   * little consonant weather. */
  function wordSyllables(word) {
    const w = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!w) return [];
    const isVowelAt = (i) => {
      const c = w[i];
      if ("aeiou".includes(c)) return true;
      /* y sounds as a vowel when it follows a consonant */
      return c === "y" && i > 0 && !"aeiouy".includes(w[i - 1]);
    };
    const groups = [];
    let i = 0;
    while (i < w.length) {
      if (isVowelAt(i)) {
        let j = i + 1;
        while (j < w.length && isVowelAt(j)) j += 1;
        groups.push({ start: i, end: j, letters: w.slice(i, j) });
        i = j;
      } else {
        i += 1;
      }
    }
    if (!groups.length) return [{ vowel: "neutral", onset: "soft" }];
    /* A trailing silent e is not its own syllable — unless it is
     * the word's only vowel, or sounds in -le after a consonant
     * ("little", "table"), where it keeps its syllable. */
    if (groups.length > 1) {
      const last = groups[groups.length - 1];
      const soundsLe = /[^aeiouy]le$/.test(w);
      if (last.letters === "e" && last.end === w.length && !soundsLe) groups.pop();
    }
    const vowelKey = (letters) => {
      if (letters.startsWith("oo") || letters.startsWith("ou") || letters.startsWith("ow")) return "u";
      if (letters.startsWith("ee") || letters.startsWith("ea") || letters.startsWith("ei")) return "e";
      if (letters.startsWith("ai") || letters.startsWith("ay")) return "a";
      if (letters.startsWith("au") || letters.startsWith("aw") || letters.startsWith("oi") || letters.startsWith("oy")) return "o";
      const first = letters[0];
      if (first === "y") return "i";
      return "aeiou".includes(first) ? first : "neutral";
    };
    const onsetKind = (letters) => {
      if (!letters) return "soft";
      if (/sh|ch|th|s|f|v|z|x/.test(letters)) return "fricative";
      if (/t|k|p|d|b|g|c|q|j/.test(letters)) return "plosive";
      return "soft";
    };
    return groups.map((g, idx) => ({
      vowel: vowelKey(g.letters),
      onset: onsetKind(w.slice(idx === 0 ? 0 : groups[idx - 1].end, g.start))
    }));
  }

  /* How many syllables a line carries — the count their voice box
   * will sound. Exposed for the record and the tests. */
  function syllableCountFor(text) {
    const clean = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    if (!clean) return 0;
    return clean
      .split(" ")
      .reduce((n, word) => n + wordSyllables(word).length, 0);
  }

  /* A line, planned for their voice box: the syllables they will
   * sound, in order, each with its length, its pitch, its mouth
   * shape (formants already scaled by their tract), and its onset.
   * The contour is the sentence's own: a statement starts a
   * little high and settles; a question holds, then rises on its
   * last syllables; the first syllable of a word stands a touch
   * taller than its fellows. Each syllable also drifts a breath
   * off the contour — a seeded waver of a percent or two — so a
   * line never lands mechanically twice the same way in the
   * ear, though the plan itself is settled.
   * Since v9 they sound less of a line: its first sentence
   * only, and only about a dozen syllables of it, whole words
   * to the cap — the rest of the line stands in text, as it
   * always has, and their sound is the greeting over it, not a
   * reading of it. The plan is seeded by the line itself, so
   * the same Spark sounds the same line the same way twice. */
  const VOICE_MAX_SYLLABLES = 12;
  function vocalPlanFor({ companion, text }) {
    const box = voiceBoxFor(companion);
    const clean = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    if (!box || !clean) return { box, syllables: [], seconds: 0 };
    const rand = mulberry32(hashString(companion.seed + ":line:" + clean));
    const sentence = (clean.match(/[^.!?]+[.!?]+/) || [clean])[0].trim();
    const question = /\?$/.test(sentence);
    const words = sentence.split(" ").filter(Boolean);
    const sung = [];
    let count = 0;
    for (const word of words) {
      const parts = wordSyllables(word);
      parts.forEach((part, pi) => {
        sung.push({ ...part, stressed: pi === 0, wordEnd: pi === parts.length - 1 });
      });
      count += parts.length;
      if (count >= VOICE_MAX_SYLLABLES) break;
    }
    const syllables = [];
    let seconds = 0;
    const n = sung.length;
    sung.forEach((s, idx) => {
      const place = n > 1 ? idx / (n - 1) : 0;
      let contour = 1.05 - 0.13 * place;
      if (question && idx >= n - 2) contour += 0.05 + 0.13 * ((idx - (n - 2)) / Math.max(1, Math.min(2, n) - 1 || 1));
      if (s.stressed) contour *= 1.05;
      const drift = 0.99 + rand() * 0.02;
      const dur = (1 / box.tempo) * (s.stressed ? 1.12 : 0.92) * (0.92 + rand() * 0.16);
      const gap = idx === n - 1 ? 0.06 : s.wordEnd ? 0.02 : 0.005;
      syllables.push({
        vowel: s.vowel,
        onset: s.onset,
        f0: Math.round(box.basePitch * contour * drift * 10) / 10,
        dur: Math.round(dur * 1000) / 1000,
        gap: Math.round(gap * 1000) / 1000,
        formants: (VOWEL_FORMANTS[s.vowel] || VOWEL_FORMANTS.neutral).map((f) =>
          Math.round(f * box.formantScale)
        )
      });
      seconds += dur + gap;
    });
    return { box, syllables, seconds: Math.round(seconds * 100) / 100 };
  }

  /* Their phrase — the voice grown up, at Aaron's word
   * (Nov 19, 2026): not a robot reading, not formants shaped
   * like speech, but a character's chirp-phrase — the kind of
   * small melodic babble a beloved game companion answers
   * with. The line still shapes it: a question lifts at its
   * end, a statement settles home. But what sounds is music
   * from their own scale, pitched at their chirp root, and it
   * GROWS with them, the way their body does:
   * - a young Spark (stage 0) answers with a single chirp;
   * - a Kindled Spark (stage 1) answers in two notes;
   * - a Bearer (stage 2) sings a short melodic phrase of
   *   three to five notes, its contour one of a few playful
   *   shapes their seed picks.
   * Pure data, like everything of theirs: the same seed, stage
   * and line settle the same phrase anywhere. The browser
   * glue sings it in their sound family — round tones, a quick
   * chirp glide into each note, nothing buzzy, nothing
   * spoken. Their syllable plan (vocalPlanFor) still stands for
   * the record; this is what they actually sound like now. */
  const PHRASE_SCALE = [1, 1.125, 1.25, 1.335, 1.5, 1.667, 1.78, 2];
  /* Melodic shapes for a grown phrase, as scale steps: a
   * rise, a hop and settle, a dip then lift, a small wave. */
  const PHRASE_CONTOURS = [
    [0, 2, 4],
    [0, 3, 2, 0],
    [0, 1, 3, 2],
    [0, 2, 1, 3, 2],
    [0, 4, 2, 3]
  ];
  function phraseFor({ companion, stage = 0, text }) {
    const box = voiceBoxFor(companion);
    const chirp = chirpFor(companion);
    const clean = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    if (!box || !chirp || !clean) return { box, notes: [], seconds: 0 };
    const rand = mulberry32(hashString(companion.seed + ":phrase:" + clean));
    const sentence = (clean.match(/[^.!?]+[.!?]+/) || [clean])[0].trim();
    const question = /\?$/.test(sentence);
    const tonic = chirp.first;
    let steps;
    if (stage >= 2) {
      steps = PHRASE_CONTOURS[Math.floor(rand() * PHRASE_CONTOURS.length)].slice();
      if (question) steps[steps.length - 1] = Math.max(steps[steps.length - 1], 4);
    } else if (stage === 1) {
      steps = question ? [0, 4] : [0, 2];
    } else {
      steps = [0];
    }
    const notes = [];
    let seconds = 0;
    steps.forEach((step, idx) => {
      const last = idx === steps.length - 1;
      const f0 = Math.round(tonic * PHRASE_SCALE[step] * 10) / 10;
      /* Quick chirps; the last note of a grown phrase rings
       * a breath longer, the way a phrase lands. */
      let dur = 0.09 + rand() * 0.05;
      if (last && steps.length > 1) dur += 0.05;
      dur = Math.round(dur * 1000) / 1000;
      /* How the note leaves its pitch: a statement's last
       * note settles a touch down; a question's lifts. */
      const glide = last ? (question ? 1.1 : 0.96) : 1;
      const gap = last ? 0 : Math.round((0.035 + rand() * 0.02) * 1000) / 1000;
      notes.push({ f0, dur, gap, glide });
      seconds += dur + gap;
    });
    return { box, notes, seconds: Math.round(seconds * 100) / 100 };
  }

  /* ---- their living voice: identity, growth, presence ----
   *
   * Stage 1 (Aaron, Nov 19, 2026): their sound is not a switch
   * and not a sound pack. It is a living layer over the voice
   * they already have. The fence is exact: this layer reads
   * chirpFor, soundFor, and voiceBoxFor as they stand and adds
   * one new deterministic stream (`seed + ":living-voice:1"`)
   * for a signature motif. It never re-rolls their root, their
   * family, or any measurement an existing keeper's Spark was
   * born with. Their repertoire — how much of that motif they
   * can say — is computed from their record every time: their
   * growth stage, the distinct days they have lived with their
   * keeper, and the practice days they have kept. Nothing is
   * bought, stored as a separate level, or reset. */
  const LIVING_VOICE_VERSION = "living-voice/1";
  const LIVING_VOICE_STAGES = [
    { id: "spark", name: "Spark voice", maxNotes: 1 },
    { id: "kindled", name: "Kindled voice", maxNotes: 2 },
    { id: "bearer", name: "Bearer voice", maxNotes: 5 },
    { id: "guardian", name: "Guardian voice", maxNotes: 7 }
  ];

  function uniqueCount(values) {
    return Array.isArray(values) ? new Set(values).size : 0;
  }

  function livingVoiceIdentityFor(companion) {
    if (!companion) return null;
    const chirp = chirpFor(companion);
    const sound = soundFor(companion);
    const box = voiceBoxFor(companion);
    if (!chirp || !sound || !box) return null;
    const rand = mulberry32(hashString(companion.seed + ":living-voice:1"));
    const steps = [0];
    steps.push(1 + Math.floor(rand() * 4));
    let third = Math.floor(rand() * 5);
    if (third === steps[1]) third = (third + 1) % 5;
    steps.push(third);
    steps.push(2 + Math.floor(rand() * 4));
    let fifth = 1 + Math.floor(rand() * 4);
    if (fifth === steps[3]) fifth = fifth === 4 ? 3 : fifth + 1;
    steps.push(fifth);
    const signature = steps.map((step, i) => {
      const last = i === steps.length - 1;
      return {
        step,
        f0: Math.round(chirp.first * PHRASE_SCALE[step] * 10) / 10,
        dur: Math.round((0.1 + rand() * 0.04 + (last ? 0.05 : 0)) * 1000) / 1000,
        gap: last ? 0 : Math.round((0.04 + rand() * 0.02) * 1000) / 1000,
        glide: last ? 0.98 : 1
      };
    });
    const variationRand = mulberry32(hashString(companion.seed + ":living-voice:1:variation"));
    const variationSteps = [3 + Math.floor(variationRand() * 4), Math.floor(variationRand() * 4)];
    const variation = variationSteps.map((step, i) => ({
      step,
      f0: Math.round(chirp.first * PHRASE_SCALE[step] * 10) / 10,
      dur: Math.round((0.1 + variationRand() * 0.04 + (i === variationSteps.length - 1 ? 0.06 : 0)) * 1000) / 1000,
      gap: i === variationSteps.length - 1 ? 0 : 0.045,
      glide: i === variationSteps.length - 1 ? 0.98 : 1
    }));
    return {
      version: LIVING_VOICE_VERSION,
      tonic: chirp.first,
      greeting: [chirp.first, chirp.second],
      family: sound.family,
      familyName: sound.familyName,
      brightness: sound.brightness,
      decay: sound.decay,
      vibratoDepth: sound.vibratoDepth,
      vibratoRate: sound.vibratoRate,
      box,
      signatureSteps: steps.slice(),
      signature,
      variationSteps,
      variation
    };
  }

  function livingVoiceGrowthFor({ record, companion } = {}) {
    if (!companion) {
      return {
        index: 0,
        id: "spark",
        name: "Spark voice",
        maxNotes: 1,
        bodyStageIndex: 0,
        bodyStageName: "",
        bodyPoints: 0,
        daysTogether: 0,
        practiceDays: 0,
        engagement: 0,
        basis: []
      };
    }
    const body = stageOf(record || {}, companion);
    const daysTogether = uniqueCount(record && record.daysSeen);
    const practiceDays = uniqueCount(record && record.practiceDays);
    let index = 0;
    if (body.index >= 1 || (daysTogether >= 3 && practiceDays >= 1)) index = 1;
    if (body.index >= 2 || (daysTogether >= 14 && practiceDays >= 5)) index = 2;
    if (body.index >= 2 && daysTogether >= 60 && practiceDays >= 20) index = 3;
    const stage = LIVING_VOICE_STAGES[index];
    return {
      index,
      id: stage.id,
      name: stage.name,
      maxNotes: stage.maxNotes,
      bodyStageIndex: body.index,
      bodyStageName: body.name,
      bodyPoints: body.points,
      daysTogether,
      practiceDays,
      engagement: engagementOf(record || {}),
      basis: [
        `body stage ${body.index + 1} (${body.name})`,
        `${daysTogether} distinct day${daysTogether === 1 ? "" : "s"} together`,
        `${practiceDays} practice day${practiceDays === 1 ? "" : "s"} kept`
      ]
    };
  }

  function livingVoicePresenceFor({
    hour = 12,
    greeted = false,
    still = false,
    hidden = false,
    legacyQuiet = false
  } = {}) {
    if (hidden) {
      return { id: "away", name: "Away", canSound: false, level: 0, maxNotes: 0, line: "The tab is hidden; their voice rests with the page." };
    }
    if (still) {
      return { id: "resting", name: "Resting", canSound: false, level: 0, maxNotes: 0, line: "Stillness is on; they rest, and their words and doors still work." };
    }
    if (legacyQuiet) {
      return { id: "quiet-promise", name: "Resting quietly", canSound: false, level: 0, maxNotes: 0, line: "A quiet promise from the earlier build is being kept." };
    }
    if (!greeted) {
      return { id: "waiting", name: "Waiting", canSound: false, level: 0, maxNotes: 0, line: "They wait to be greeted before they sound." };
    }
    const h = Number.isFinite(hour) ? Math.floor(hour) : 12;
    if (h >= 22 || h < 5) {
      return { id: "nightwatch", name: "Nightwatch", canSound: true, level: 0.55, maxNotes: 3, line: "Nightwatch: fewer notes, softly, when greeted." };
    }
    return { id: "awake", name: "Awake", canSound: true, level: 1, maxNotes: 7, line: "Awake and answering in their own voice." };
  }

  function livingVoicePlanFor({
    companion,
    record,
    context = "greeting",
    text = "",
    hour = 12,
    greeted = true,
    still = false,
    hidden = false,
    legacyQuiet = false
  } = {}) {
    const identity = livingVoiceIdentityFor(companion);
    const growth = livingVoiceGrowthFor({ record, companion });
    const presence = livingVoicePresenceFor({ hour, greeted, still, hidden, legacyQuiet });
    if (!identity || !presence.canSound) {
      return { version: LIVING_VOICE_VERSION, identity, growth, presence, context, notes: [], seconds: 0, level: 0 };
    }
    const counts = {
      tap: [1, 2, 3, 3],
      greeting: [1, 2, 3, 3],
      hold: [1, 2, 5, 7],
      name: [1, 2, 5, 7],
      stroke: [1, 2, 4, 5],
      call: [1, 2, 5, 5],
      day: [1, 2, 5, 7],
      moment: [1, 2, 5, 7],
      line: [1, 2, 5, 7]
    };
    let count = (counts[context] || counts.greeting)[growth.index];
    count = Math.min(count, growth.maxNotes, presence.maxNotes || count);
    let notes = identity.signature.slice(0, Math.min(count, identity.signature.length)).map((n) => ({ ...n }));
    if (count > notes.length) notes = notes.concat(identity.variation.slice(0, count - notes.length).map((n) => ({ ...n })));
    const clean = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    const question = /\?$/.test((clean.match(/[^.!?]+[.!?]+/) || [clean])[0].trim());
    notes = notes.map((note, i) => {
      const last = i === notes.length - 1;
      const out = { ...note };
      if (context === "stroke") {
        out.dur = Math.round(out.dur * 1.18 * 1000) / 1000;
        out.glide = last ? 0.98 : 1;
      }
      if (presence.id === "nightwatch") out.dur = Math.round(out.dur * 1.08 * 1000) / 1000;
      if (last && notes.length > 1) {
        if (question) {
          const step = Math.max(out.step || 0, 4);
          out.step = step;
          out.f0 = Math.round(identity.tonic * PHRASE_SCALE[step] * 10) / 10;
          out.glide = 1.1;
        } else {
          out.glide = 0.96;
        }
        out.gap = 0;
      }
      return out;
    });
    const seconds = notes.reduce((sum, n) => sum + n.dur + n.gap, 0);
    return {
      version: LIVING_VOICE_VERSION,
      identity,
      growth,
      presence,
      context,
      notes,
      seconds: Math.round(seconds * 100) / 100,
      level: presence.level
    };
  }

  function livingCallFor({
    companion,
    record,
    hour = 12,
    still = false,
    hidden = false,
    legacyQuiet = false
  } = {}) {
    const plan = livingVoicePlanFor({
      companion,
      record,
      context: "call",
      hour,
      greeted: true,
      still,
      hidden,
      legacyQuiet
    });
    if (!plan.identity) return { plan, pads: [], steps: [] };
    const ratios = [1, 1.25, 1.5, 2];
    const hue = Number.isFinite(companion.hue) ? companion.hue : 200;
    const pads = ratios.map((ratio, i) => ({
      note: Math.round(plan.identity.tonic * ratio),
      color: `hsl(${Math.round(hue + i * 38)} 72% 62%)`
    }));
    const steps = plan.notes.map((note) => {
      if (note.step <= 1) return 0;
      if (note.step === 2) return 1;
      if (note.step === 3) return 2;
      return 3;
    });
    return { plan, pads, steps };
  }

  function livingDayRemarkFor({ record, companion, today, hour = 12, farmNote = "" } = {}) {
    const growth = livingVoiceGrowthFor({ record, companion });
    const facts = [];
    if (today) facts.push(coordinateLineFor(today));
    if (today && today.moonName) facts.push(`Under ${today.moonName}`);
    if (Number.isFinite(hour)) facts.push(`${daypartFor(hour)} on this device`);
    const patternDay = today ? today.dayOfPatternYear : null;
    if (patternDay != null) {
      facts.push(
        uniqueCount(record && record.practiceDays) && (record.practiceDays || []).includes(patternDay)
          ? "Practice is sealed for today"
          : "No practice is sealed for today"
      );
    }
    facts.push(`${growth.daysTogether} day${growth.daysTogether === 1 ? "" : "s"} together`);
    const farm = String(farmNote || "").replace(/\s+/g, " ").trim();
    if (farm) facts.push(farm);
    return { line: facts.length ? `${facts.join(" · ")}.` : "", facts, growth };
  }

  /* Each kind speaks in its temperament's voice. One short line,
   * in character — the first thing the Spark says about itself
   * after its name. */
  const VOICE_LINES = {
    fire: "I don't do slow hellos. Let's go and see everything.",
    water: "No hurry here. We'll wander, and I'll keep up.",
    shadow: "I notice the corners other people walk past. I'll show you.",
    air: "I already have questions about this place. Good ones.",
    earth: "One door at a time, and we'll miss nothing.",
    light: "Morning or not, I'm glad you're here. Let's look around."
  };

  /* What to look for when you look at it: the uniqueness the seed
   * grew, said in plain words so it can be seen, not just stored. */
  function lookLineFor(companion) {
    if (!companion) return "";
    const crest =
      companion.crest && companion.crest !== "none"
        ? `, a small ${companion.crest} crest`
        : "";
    const glow = companion.shape ? companion.shape.glow : "soft";
    return (
      `Look closely: a ${companion.form}, ${companion.markings.style} for markings` +
      `${crest}, with a ${glow} glow. No other Spark is built quite like this one.`
    );
  }

  /* The conversation voice: when its keeper taps it, the Spark
   * speaks — and asks. Every beat of that talk (the greeting, the
   * standing question, the care answers, the offers, the follow-up)
   * is written here in each temperament's voice, two tellings for
   * the beats that open a talk, and the seed picks which telling a
   * given Spark uses, so the same Spark speaks consistently and two
   * Sparks speak differently. Every line is an invitation or a
   * fact; none of them counts a lack. The presence assembles the
   * record's own content (the day, the doors, the explanation, the
   * trail) between these beats — the voice frames the record, it
   * never replaces it. */
  const CONVO = {
    greet: {
      bold: ["Onward. New ground today.", "Up and at it."],
      gentle: ["Softly. I kept your place.", "Hello. Slowly, together."],
      quiet: ["Here.", "With you."],
      curious: ["Oh! What is today?", "You are here! Look around."],
      steady: ["Here. Standing by.", "Onward. As always."],
      bright: ["Sunshine! Here we go.", "Hello, hello!"]
    },
    welcome: {
      bold: ["Back at last. Adventure waited."],
      gentle: ["There you are. Welcome back."],
      quiet: ["Back. Good."],
      curious: ["Back! What did you find?"],
      steady: ["Welcome back. Steady on."],
      bright: ["You are back! Brighter already."]
    },
    ask: {
      bold: ["One thing first."],
      gentle: ["One small thing."],
      quiet: ["One thing."],
      curious: ["Question for you."],
      steady: ["One thing to ask."],
      bright: ["One bright question!"]
    },
    next: {
      bold: ["What is next?"],
      gentle: ["What shall we do?"],
      quiet: ["Next?"],
      curious: ["What catches your eye?"],
      steady: ["What is next, then?"],
      bright: ["What shines next?"]
    },
    kindle: {
      bold: ["Lit. Warmer already."],
      gentle: ["Warmer now. Thank you."],
      quiet: ["Warm."],
      curious: ["Warmer! What glows brighter?"],
      steady: ["Kindled. Warm and steady."],
      bright: ["Lit up! Thank you."]
    },
    play: {
      bold: ["Chase me. Catch me if you can."],
      gentle: ["A gentle chase?"],
      quiet: ["Chase?"],
      curious: ["Chase me! Where to?"],
      steady: ["A chase, then. Ready."],
      bright: ["Chase me! Catch the light."]
    },
    caught: {
      bold: ["Caught! Again?"],
      gentle: ["You found me."],
      quiet: ["Caught."],
      curious: ["Found me! Again?"],
      steady: ["Caught fair and square."],
      bright: ["Caught! Sparkling work."]
    },
    rest: {
      bold: ["Resting now. Still beside you."],
      gentle: ["Resting softly beside you."],
      quiet: ["Resting."],
      curious: ["Resting. Dreaming questions."],
      steady: ["Resting. Still on watch."],
      bright: ["Resting, still glowing."]
    },
    care: {
      bold: ["Kindle, play, or rest. Choose."],
      gentle: ["Kindle, play, or rest, softly."],
      quiet: ["Kindle, play, rest."],
      curious: ["Kindle, play, or rest? Pick one."],
      steady: ["Kindle, play, or rest. Your rhythm."],
      bright: ["Kindle, play, or rest? Shine on."]
    },
    around: {
      bold: ["Doors of this page."],
      gentle: ["These doors, when ready."],
      quiet: ["Doors."],
      curious: ["So many doors here."],
      steady: ["The doors of this page."],
      bright: ["Doors, all lit up."]
    },
    nearby: {
      bold: ["Found this nearby."],
      gentle: ["Found nearby, for you."],
      quiet: ["Nearby."],
      curious: ["Look what is nearby!"],
      steady: ["Found nearby."],
      bright: ["Found this nearby!"]
    },
    explain: {
      bold: ["This page, short and plain."],
      gentle: ["This page, in plain words."],
      quiet: ["This page, plainly."],
      curious: ["What is this page?"],
      steady: ["This page, stated plainly."],
      bright: ["This page, shining plain."]
    },
    more: {
      bold: ["More of it."],
      gentle: ["A little more, then."],
      quiet: ["More."],
      curious: ["More? Yes, more."],
      steady: ["More of it, then."],
      bright: ["More light? Yes."]
    },
    telling: {
      bold: ["Today's telling."],
      gentle: ["Today's telling, softly."],
      quiet: ["The telling."],
      curious: ["What does today say?"],
      steady: ["Today's telling, in order."],
      bright: ["Today's bright telling."]
    },
    today: {
      bold: ["Today."],
      gentle: ["Today, together."],
      quiet: ["Today."],
      curious: ["What is today hiding?"],
      steady: ["Today, as it stands."],
      bright: ["Today looks bright."]
    },
    trail: {
      bold: ["Today's trail, step by step."],
      gentle: ["Small steps, one by one."],
      quiet: ["The trail."],
      curious: ["A trail! Follow it?"],
      steady: ["The trail, step by step."],
      bright: ["A shining little trail."]
    },
    share: {
      bold: ["Your card is ready."],
      gentle: ["Your card, made gently."],
      quiet: ["Your card."],
      curious: ["A card of us!"],
      steady: ["Your card, made and kept."],
      bright: ["Your card, all aglow."]
    },
    record: {
      bold: ["Your record."],
      gentle: ["All of us, in one place."],
      quiet: ["The record."],
      curious: ["Everything about us."],
      steady: ["The record, kept straight."],
      bright: ["Us, in bright rows."]
    },
    resume: {
      bold: ["Back where you left off."],
      gentle: ["Where you left off, dear."],
      quiet: ["Your place, kept."],
      curious: ["Where were we, then?"],
      steady: ["Your place, as left."],
      bright: ["Right where you left it."]
    },
    bye: {
      bold: ["Walking with you."],
      gentle: ["Walking softly with you."],
      quiet: ["Walking on."],
      curious: ["Walking and wondering."],
      steady: ["Walking with you, steady."],
      bright: ["Walking in the light."]
    },
    pet: {
      bold: ["Ha! Right there."],
      gentle: ["Oh, that is lovely."],
      quiet: ["Mm. Nice."],
      curious: ["Oh! Again, again?"],
      steady: ["Good. That will do."],
      bright: ["Oh, lovely! Again?"]
    },
    poke: {
      bold: ["Hey! Quick fingers."],
      gentle: ["A tiny hello back."],
      quiet: ["Oh. Felt that."],
      curious: ["Hey! What was that?"],
      steady: ["Noted."],
      bright: ["Hey! Sparkles!"]
    },
    tricks: {
      bold: ["Watch what I learned."],
      gentle: ["See what I can do?"],
      quiet: ["Watch."],
      curious: ["Look what I learned!"],
      steady: ["What I have learned."],
      bright: ["Watch me shine!"]
    },
    learned: {
      bold: ["New trick learned!"],
      gentle: ["I learned something new."],
      quiet: ["Learned."],
      curious: ["A new trick! See?"],
      steady: ["Learned, and kept."],
      bright: ["New trick! Shining."]
    },
    trick: {
      bold: ["Ta-da!"],
      gentle: ["For you."],
      quiet: ["There."],
      curious: ["Did you see that?"],
      steady: ["Done."],
      bright: ["Ta-da! All sparkle."]
    },
    echoStart: {
      bold: ["Echo my song."],
      gentle: ["Sing it back to me."],
      quiet: ["Echo me."],
      curious: ["Copy my song?"],
      steady: ["Echo it back, in order."],
      bright: ["Sing it back, bright."]
    },
    echoWin: {
      bold: ["Round echoed true!"],
      gentle: ["Every note, just right."],
      quiet: ["True."],
      curious: ["Every note right!"],
      steady: ["Round done, note perfect."],
      bright: ["Perfect and bright!"]
    },
    echoMiss: {
      bold: ["That one slipped. Again?"],
      gentle: ["Nearly. Try once more?"],
      quiet: ["Again?"],
      curious: ["Which note was it?"],
      steady: ["One note off. Again."],
      bright: ["Nearly shining. Again?"]
    },
    sealed: {
      bold: ["A practice, sealed. Well done."],
      gentle: ["Sealed, softly. Well done."],
      quiet: ["Sealed."],
      curious: ["Sealed! What changes now?"],
      steady: ["Sealed. It stands."],
      bright: ["Sealed with light!"]
    },
    saved: {
      bold: ["Saved in the Atlas."],
      gentle: ["Kept safe in the Atlas."],
      quiet: ["Saved."],
      curious: ["Saved! Into the Atlas."],
      steady: ["Saved. It stands recorded."],
      bright: ["Saved and shining."]
    }
  };

  /* One beat of the conversation, in this Spark's own voice.
   * The telling is chosen by the seed, so a Spark is consistent
   * with itself; the content between the beats always comes from
   * the record, never from this table. */
  function convoLineFor({ companion, beat }) {
    if (!companion) return "";
    const table = CONVO[beat];
    if (!table) return "";
    const lines = table[companion.temperament] || table.curious || [];
    if (!lines.length) return "";
    let h = 0;
    const s = `${companion.seed || ""}:${beat}`;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return lines[h % lines.length];
  }

  /* Greetings by daypart: the talk opens with the hour's own
   * hello, in their temperament's voice — morning's light, the
   * day's middle, evening gathering in, the late hours kept
   * close. The day itself is still counted by the calendar;
   * this only names the hour they greet you in. */
  function daypartFor(hour) {
    const h = Number.isFinite(hour) ? Math.floor(hour) : 12;
    if (h >= 5 && h < 11) return "morning";
    if (h >= 11 && h < 17) return "day";
    if (h >= 17 && h < 22) return "evening";
    return "night";
  }

  const DAYPART_GREET = {
    morning: {
      bold: "Morning. Ground to cover.",
      gentle: "Soft morning.",
      quiet: "Morning.",
      curious: "Morning! What is new?",
      steady: "Morning. Standing by.",
      bright: "Morning sunshine!"
    },
    day: {
      bold: "Day is young.",
      gentle: "Hello. Easy day.",
      quiet: "Here.",
      curious: "Oh! A day to explore.",
      steady: "Day. On we go.",
      bright: "Bright day!"
    },
    evening: {
      bold: "Evening. One more push.",
      gentle: "Evening. Softly now.",
      quiet: "Evening.",
      curious: "Evening! What glows?",
      steady: "Evening. Holding steady.",
      bright: "Golden evening!"
    },
    night: {
      bold: "Night watch.",
      gentle: "Night. Rest near.",
      quiet: "Night.",
      curious: "Night! Who is awake?",
      steady: "Night. On watch.",
      bright: "Starlight! Still shining."
    }
  };

  function daypartLineFor({ companion, hour }) {
    if (!companion) return "";
    const part = DAYPART_GREET[daypartFor(hour)] || DAYPART_GREET.day;
    return part[companion.temperament] || part.curious || "";
  }

  /* ---- the play life: touch, tricks, and the echo game ----
   *
   * Play is counted from real touches on this device: pets,
   * pokes, drags by hand, catches in the chase, rounds echoed
   * in the echo game. Like care, play only ever adds — nothing
   * decays, nothing is owed. Play teaches: tricks unlock when
   * the play that teaches them has happened a small number of
   * times, and each trick names its teacher honestly, with the
   * count standing beside it. */

  function playOf(record) {
    const p = (record && record.play) || {};
    const num = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
    return {
      pets: num(p.pets),
      pokes: num(p.pokes),
      drags: num(p.drags),
      catches: num(p.catches),
      bestChase: num(p.bestChase),
      echoBest: num(p.echoBest),
      tricks: Array.isArray(p.tricks) ? p.tricks.filter((t) => typeof t === "string") : [],
      askedDay: p.askedDay != null ? p.askedDay : null
    };
  }

  /* The shared tricks, every Spark's to learn, and the one
   * kind-flavoured trick that is theirs alone. `via` names the
   * counter that teaches it — a play counter, or one of care's
   * own counts (kindles, chases finished, rests, the bond, the
   * echo best) — and `teacher` says it in plain words. */
  const TRICKS = [
    { id: "spin", name: "Spin", via: "drags", need: 3, teacher: "being moved by hand" },
    { id: "leap", name: "Leap", via: "catches", need: 4, teacher: "catches in the chase" },
    { id: "glow", name: "Glow pulse", via: "pets", need: 5, teacher: "petting" }
  ];
  const KIND_TRICKS = {
    fire: { id: "flare", name: "Flare", via: "kindles", need: 2, teacher: "kindling" },
    water: { id: "ripple", name: "Ripple", via: "pets", need: 8, teacher: "petting, patiently" },
    shadow: { id: "vanish", name: "Vanish", via: "rests", need: 2, teacher: "resting together" },
    air: { id: "loop", name: "Loop", via: "plays", need: 2, teacher: "chases walked to their end" },
    earth: { id: "root", name: "Root", via: "bond", need: 4, teacher: "the bond itself" },
    light: { id: "beam", name: "Beam", via: "echoBest", need: 3, teacher: "the echo game" }
  };

  /* One derivation, two faces (Inhabitant slice 5): each kind
   * trick above is the same feat as the Sphere trick book's
   * ruled kind signature, under the book's name. A trick-
   * learned line in the record naming the signature therefore
   * teaches the kind trick here, exactly as the stored id or
   * the counter does — and the book, for its part, reads this
   * face's stored ids and counters (its CORE_KIND_TRICK_RULES
   * mirror of the table above). Neither face can lose a trick
   * the other taught. The three shared tricks (Spin, Leap,
   * Glow pulse) have no counterpart in the book, and the
   * book's Basics none here; each keeps its one derivation. */
  const RULED_SIGNATURE_FOR_KIND = {
    fire: "flare-spin", water: "ripple-bow", shadow: "peek-back",
    air: "feather-loop", earth: "root-bow", light: "halo-bow"
  };

  function signatureLineStands(record, companion) {
    const signature = companion ? RULED_SIGNATURE_FOR_KIND[companion.kind] : null;
    if (!signature) return false;
    const lines = record && Array.isArray(record.lifeLines) ? record.lifeLines : [];
    return lines.some((l) => l && l.line === "trick-learned" && l.trick === signature);
  }

  function trickListFor(companion) {
    const out = TRICKS.map((t) => ({ ...t, kindTrick: false }));
    const own = companion ? KIND_TRICKS[companion.kind] : null;
    if (own) out.push({ ...own, kindTrick: true });
    return out;
  }

  /* Every counter a trick can learn from, in one place: play's
   * own counts, and care's — a chase finished is care's play
   * count; the chase's catches are play's. */
  function trickCounts(record) {
    const play = playOf(record);
    const care = careOf(record);
    return {
      pets: play.pets,
      pokes: play.pokes,
      drags: play.drags,
      catches: play.catches,
      echoBest: play.echoBest,
      kindles: care.kindles,
      plays: care.plays,
      rests: care.rests,
      bond: care.bond
    };
  }

  function tricksFor({ record, companion }) {
    const counts = trickCounts(record);
    const known = new Set(playOf(record).tricks);
    const bySignature = signatureLineStands(record, companion);
    return trickListFor(companion).map((t) => ({
      ...t,
      count: counts[t.via] || 0,
      learned: known.has(t.id) || (counts[t.via] || 0) >= t.need
        || (t.kindTrick && bySignature)
    }));
  }

  /* One act of play, recorded — and what it taught them. The
   * returned `learned` lists the tricks this act completed, so
   * the presence can announce each one once, in their voice, at
   * the moment it lands. A trick already known is never
   * announced twice. */
  function recordPlay(record, { action, catches, round }) {
    const play = playOf(record);
    if (action === "pet") play.pets += 1;
    else if (action === "poke") play.pokes += 1;
    else if (action === "drag") play.drags += 1;
    else if (action === "chase") {
      const n = Number.isFinite(catches) && catches > 0 ? Math.floor(catches) : 0;
      play.catches += n;
      if (n > play.bestChase) play.bestChase = n;
    } else if (action === "echo") {
      const r = Number.isFinite(round) && round > 0 ? Math.floor(round) : 0;
      if (r > play.echoBest) play.echoBest = r;
    } else {
      return { record: { ...record }, learned: [] };
    }
    const next = { ...record, play };
    const counts = trickCounts(next);
    const learned = [];
    for (const t of trickListFor(generate(record && record.seed))) {
      if (play.tricks.includes(t.id)) continue;
      if ((counts[t.via] || 0) >= t.need) {
        play.tricks.push(t.id);
        learned.push(t.id);
      }
    }
    return { record: next, learned };
  }

  /* Tricks announced are kept in the record's play list, so
   * each one is celebrated exactly once, however it was
   * learned — by play, or by care crossing its count. */
  function markTricksKnown(record, ids) {
    const play = playOf(record);
    for (const id of Array.isArray(ids) ? ids : []) {
      if (!play.tricks.includes(id)) play.tricks.push(id);
    }
    return { ...record, play };
  }

  /* The tricks whose learning flipped between two records —
   * the announcement list for any write, from any source. */
  function learnedBetween({ before, after, companion }) {
    const was = new Set(
      tricksFor({ record: before, companion })
        .filter((t) => t.learned)
        .map((t) => t.id)
    );
    return tricksFor({ record: after, companion })
      .filter((t) => t.learned && !was.has(t.id))
      .map((t) => t.id);
  }

  /* Their question remembered for the day: they ask one gentle
   * question a day at most, and asking is all that is kept —
   * the keeper's answer is their own tap, never stored. */
  function markAsked(record, { patternDay }) {
    const play = playOf(record);
    play.askedDay = patternDay != null ? patternDay : null;
    return { ...record, play };
  }

  /* ---- their reveals: detail that arrives over time ----
   *
   * They are born with a whole look — form, markings, crest,
   * their markings' density, their eye's variant — but the finer
   * detail of their (their cheeks, their second pattern, their ears,
   * their trail, the styled crest, and a flourish in their voice)
   * is not all there at the meeting. It arrives, one piece at
   * a time, as their keeper actually walks with them: Aaron's
   * shape for it — fast at first, so a new keeper notices their
   * change after a few pages; then slower, and slower again,
   * and never quite on a beat. The schedule is counted in
   * engagement, from the counters their record already keeps —
   * pages seen, return days, practices sealed, acts of play
   * and care — never in wall-clock time, so a keeper who is
   * away loses nothing: the schedule simply waits where it
   * was. The gaps stretch by about 1.7 each time, with a
   * seeded jitter of up to a quarter either way, and each gap
   * is at least one step longer than the one before, so the
   * stretching is real and the rhythm is never clockwork.
   * Same seed + same history = the same reveal points, on any
   * device. Which features stand on their schedule is their
   * seed's own draw: a Spark whose detail draw left their
   * cheekless has no cheeks to reveal — that place on their
   * schedule simply is not there. The flourish stands last
   * for every Spark: their voice flowers after their face does. */

  /* The order a detail arrives in: the face first, where a
   * keeper looks; the voice last. */
  const REVEAL_ORDER = ["cheeks", "pattern", "ears", "trail", "crest", "flourish"];

  const REVEAL_LINES = {
    cheeks: "Their cheeks came in.",
    pattern: "A second pattern showed.",
    ears: "Their ears came in.",
    trail: "A little trail follows them.",
    crest: "Their crest grew in.",
    flourish: "Their voice learned a flourish."
  };

  function revealLineFor(id) {
    return REVEAL_LINES[id] || "Something new about them.";
  }

  /* Does their seed hold this detail at all? A feature they were
   * never drawn with is not a reveal they are owed — it is
   * simply not theirs. */
  function revealPresent(companion, id) {
    const d = (companion && companion.details) || {};
    switch (id) {
      case "cheeks":
        return !!d.cheeks && d.cheeks !== "none";
      case "pattern":
        return !!d.pattern && d.pattern !== "none";
      case "ears":
        return !!d.ears && d.ears !== "none";
      case "trail":
        return !!d.trail && d.trail !== "none";
      case "crest":
        return !!d.crestStyle && d.crestStyle !== "plain";
      case "flourish":
        return true;
      default:
        return false;
    }
  }

  /* Their reveal points, in engagement: the first after a
   * handful of pages (a gap of 3–5), each next gap about
   * 1.7 times the last, jittered by their seed, and never
   * shorter than the gap before it plus one. */
  function revealScheduleFor(companion) {
    if (!companion) return [];
    const present = REVEAL_ORDER.filter((id) => revealPresent(companion, id));
    const rand = mulberry32(hashString(companion.seed + ":reveals"));
    const out = [];
    let at = 0;
    present.forEach((id, i) => {
      let gap = Math.round(4 * Math.pow(1.7, i) * (0.78 + rand() * 0.5));
      if (i > 0) gap = Math.max(gap, out[i - 1].gap + 1);
      gap = Math.max(2, gap);
      at += gap;
      out.push({ id, at, gap });
    });
    return out;
  }

  /* The walking itself, counted: every page they have been met
   * on, four for each return day after the first, two for
   * each practice sealed, one for each act of care, and one
   * for every five acts of play. Nothing here is time: a
   * record that does not move does not ripen. */
  function engagementOf(record) {
    if (!record) return 0;
    const pages = Array.isArray(record.pagesSeen) ? record.pagesSeen.length : 0;
    const days = Array.isArray(record.daysSeen) ? record.daysSeen.length : 0;
    const practice = Array.isArray(record.practiceDays) ? record.practiceDays.length : 0;
    const play = playOf(record);
    const playActs = play.pets + play.pokes + play.drags + play.catches;
    const care = careOf(record);
    const careActs = care.kindles + care.plays + care.rests;
    return (
      pages +
      Math.max(0, days - 1) * 4 +
      practice * 2 +
      Math.floor(playActs / 5) +
      careActs
    );
  }

  /* Where they stand: their schedule, what has arrived, and
   * what comes next — all read off the record's own counters,
   * so it can be recomputed anywhere and kept nowhere else. */
  function revealsFor({ record, companion }) {
    const schedule = revealScheduleFor(companion);
    const score = engagementOf(record);
    const revealed = schedule.filter((s) => score >= s.at).map((s) => s.id);
    const next = schedule.find((s) => score < s.at) || null;
    return { schedule, revealed, next, score };
  }

  /* The reveals their keeper has already been told about, kept
   * in the record like everything else; a record from before
   * reveals existed has simply been told about none. */
  function revealsSeenOf(record) {
    return Array.isArray(record && record.revealsSeen) ? record.revealsSeen.slice() : [];
  }

  /* The same single-announcement discipline as their tricks:
   * a reveal is news exactly once — when it has arrived in
   * the after-record, was not arrived in the before-record,
   * and has not already been announced. */
  function newRevealsBetween({ before, after, companion }) {
    const was = new Set(revealsFor({ record: before, companion }).revealed);
    const seen = new Set(revealsSeenOf(after));
    return revealsFor({ record: after, companion })
      .revealed.filter((id) => !was.has(id) && !seen.has(id));
  }

  function markRevealsSeen(record, ids) {
    const seen = new Set(revealsSeenOf(record));
    for (const id of ids || []) seen.add(id);
    return { ...record, revealsSeen: [...seen] };
  }

  /* The echo game: they pulse a pattern — their seed's notes in
   * four colours — and the keeper taps it back. The pattern is
   * grown from the seed and the round, so the same Spark sings
   * the same round anywhere; each round carries one more step
   * than the last, up to a kind length. The pads wear their own
   * hue, turned four ways, and sound their own notes, rising. */
  function echoFor({ companion, round }) {
    if (!companion) return { pads: [], steps: [], round: 0 };
    const r = Math.max(1, Math.floor(round) || 1);
    const chirp = chirpFor(companion);
    const base = chirp ? chirp.first : 440;
    const ratios = [1, 1.122, 1.335, 1.587];
    const hue = Number.isFinite(companion.hue) ? companion.hue : 200;
    const pads = ratios.map((ratio, i) => ({
      note: Math.round(base * ratio),
      color: `hsl(${Math.round(hue + i * 38)} 72% 62%)`
    }));
    const rand = mulberry32(hashString(`${companion.seed}:echo:${r}`));
    const length = Math.min(9, 2 + r);
    const steps = [];
    for (let i = 0; i < length; i++) steps.push(Math.floor(rand() * 4));
    return { pads, steps, round: r };
  }

  /* Their mood: a small state with honest parents. It is derived
   * from what has actually happened — play, care, the hour —
   * never from a clock ticking down. A trick learned or a round
   * echoed leaves them proud for a while; a pet or a kindle
   * leaves them bright; the late hours leave them sleepy; a rest
   * or the evening leaves them calm; the rest of the day they are
   * curious, which is their way of being awake in the world. */
  const MOODS = {
    proud: { name: "Proud", line: "Proud — new trick, or a true echo." },
    bright: { name: "Bright", line: "Bright — played with and glad." },
    sleepy: { name: "Sleepy", line: "Sleepy — late hours, soft glow." },
    calm: { name: "Calm", line: "Calm — rested, and breathing slow." },
    curious: { name: "Curious", line: "Curious — awake to the day." }
  };

  function moodFor({ record, companion, todayPatternDay, hour, recent }) {
    const care = careStateFor({ record, companion, todayPatternDay });
    const h = Number.isFinite(hour) ? Math.floor(hour) : 12;
    const fresh = recent || {};
    let id = "curious";
    if (fresh.learned || fresh.won) id = "proud";
    else if (fresh.petted || fresh.played || care.kindledToday) id = "bright";
    else if ((h >= 22 || h < 5) && !fresh.played) id = "sleepy";
    else if (care.restedToday || h >= 19) id = "calm";
    const mood = MOODS[id];
    return { id, name: mood.name, line: mood.line };
  }

  /* Their one gentle question: drawn only from what the record
   * truly holds — the day itself, the thread left warm, a door
   * found for today, a small practice that would seal the day
   * kindly. An invitation with a door, asked once a day at
   * most, and skippable forever: walking past it costs
   * nothing, and it never counts anything against anyone. */
  function questionFor({ record, companion, today, page }) {
    const day = today ? today.dayOfPatternYear : null;
    if (companion && day != null && day === companion.birthPatternDay) {
      return {
        text: "Today is the Pattern Day I was born on. Mark it with a practice?",
        href: "teach.html",
        label: "Seal a practice"
      };
    }
    const prev = record && record.prevPage && record.prevPage !== page ? record.prevPage : null;
    const prevInfo = prev ? PAGE_GUIDE[prev] : null;
    if (prevInfo) {
      return {
        text: `You left off at ${prevInfo.place}. Shall we go back?`,
        href: prev,
        label: "Go back"
      };
    }
    const trail = trailFor({ record, companion, today, page });
    const doorStep = trail.steps.find((s) => s.id === "door" && !s.done);
    if (doorStep) {
      return {
        text: `A door for us today: ${doorStep.place}. Walk through?`,
        href: doorStep.href,
        label: "Walk through"
      };
    }
    const practice = (record && record.practiceDays) || [];
    if (day != null && !practice.includes(day) && ((record && record.daysSeen) || []).length >= 1) {
      return {
        text: "Seal one small practice today?",
        href: "teach.html",
        label: "Seal a practice"
      };
    }
    return null;
  }

  /* Evolution: THREE stages, the way Aaron's Free The Noods
   * creatures grew — a young form, a developed form, a full form.
   * The driver is faithfulness, counted from plain facts kept on
   * the visitor's own device: each return day after the first is
   * worth 2, each practice day 3, each new page seen 1 (counted
   * up to 10 pages). Never XP, never anything bought or burned —
   * a Spark grows because its person keeps coming back. Each
   * Spark's own pace, grown from its seed, bends the thresholds
   * a little, so no two Sparks grow on quite the same day. */
  /* Stage names are Aaron's (Spark / Kindled / Bearer / Guardian,
   * the ladder his voice stages already climb). The rename of
   * Nov 20, 2026 changed the NAMES ONLY: the thresholds, the
   * indices, and every derivation from them are exactly what they
   * were when the stages were called Ember / Flame / Radiant, so
   * no keeper's Spark changed stage, shape, or standing. The body
   * ladder has three rungs; its fullest rung takes the ladder's
   * top name, Guardian — Bearer stands in the voice ladder, whose
   * four rungs climb Spark → Kindled → Bearer → Guardian. */
  const STAGES = [
    { name: "Spark", min: 0 },
    { name: "Kindled", min: 8 },
    { name: "Guardian", min: 25 }
  ];

  /* ---- seed ---- */

  function hashString(text) {
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
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeSeed({ moon, patternDay, kindIndex, nonce }) {
    const m = moon == null ? 0 : moon;
    const p = patternDay == null ? 365 : patternDay;
    return [SEED_PREFIX, m, p, kindIndex, String(nonce)].join("-");
  }

  function parseSeed(seed) {
    if (typeof seed !== "string") return null;
    const parts = seed.split("-");
    if (parts.length !== 5 || parts[0] !== SEED_PREFIX) return null;
    const moon = Number(parts[1]);
    const patternDay = Number(parts[2]);
    const kindIndex = Number(parts[3]);
    const nonce = parts[4];
    if (!Number.isInteger(moon) || moon < 0 || moon > 13) return null;
    if (!Number.isInteger(patternDay) || patternDay < 1 || patternDay > 365) return null;
    if (!Number.isInteger(kindIndex) || kindIndex < 0 || kindIndex >= KINDS.length) return null;
    if (!nonce) return null;
    return { moon: moon === 0 ? null : moon, patternDay, kindIndex, nonce };
  }

  function randomNonce() {
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
    let out = "";
    const rand =
      typeof crypto !== "undefined" && crypto.getRandomValues
        ? () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296
        : Math.random;
    for (let i = 0; i < 8; i++) out += alphabet[Math.floor(rand() * 36)];
    return out;
  }

  /* ---- kind ---- */

  function kindIndexById(id) {
    return KINDS.findIndex((k) => k.id === id);
  }

  /* The coordinate's own lean: the moon and the day together point
   * at a kind before any answers are given. Deterministic. */
  function coordinateKindIndex(moon, patternDay) {
    const m = moon == null ? 13 : moon;
    const p = patternDay == null ? 365 : patternDay;
    return (m * 5 + p * 3) % KINDS.length;
  }

  /* Answers outvote the coordinate; a tie falls back to it. */
  function resolveKindIndex({ moon, patternDay, answers }) {
    const coord = coordinateKindIndex(moon, patternDay);
    if (!Array.isArray(answers) || answers.length === 0) return coord;
    const votes = new Array(KINDS.length).fill(0);
    for (const id of answers) {
      const ix = kindIndexById(id);
      if (ix >= 0) votes[ix]++;
    }
    const best = Math.max(...votes);
    if (best === 0) return coord;
    const winners = votes
      .map((v, i) => (v === best ? i : -1))
      .filter((i) => i >= 0);
    return winners.includes(coord) ? coord : winners[0];
  }

  /* ---- generation ---- */

  function hsl(h, s, l) {
    return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
  }

  function generate(seed) {
    const parsed = parseSeed(seed);
    if (!parsed) return null;
    const rand = mulberry32(hashString(seed));
    const kind = KINDS[parsed.kindIndex];
    const [h0, h1] = kind.hues;
    const hue = h0 + rand() * (h1 - h0);
    const accentHue = hue + 30 + rand() * 40;
    return {
      seed,
      kind: kind.id,
      kindName: kind.name,
      kindLine: kind.line,
      temperament: kind.temperament,
      /* The body's own hue, kept as a number beside the finished
       * colours: the echo game builds its four pads from it, so
       * the pads wear their colours and no one else's. */
      hue: Math.round(hue),
      trait: TRAITS[Math.floor(rand() * TRAITS.length)],
      form: FORMS[Math.floor(rand() * FORMS.length)],
      markings: {
        style: MARKINGS[Math.floor(rand() * MARKINGS.length)],
        count: 2 + Math.floor(rand() * 4)
      },
      eye: EYES[Math.floor(rand() * EYES.length)],
      crest: CRESTS[Math.floor(rand() * CRESTS.length)],
      palette: {
        body: hsl(hue, 62 + rand() * 18, 52 + rand() * 12),
        glow: hsl(hue, 85, 68 + rand() * 10),
        accent: hsl(accentHue, 72, 60 + rand() * 10)
      },
      birthMoon: parsed.moon,
      birthPatternDay: parsed.patternDay,
      name: seedNameFor(seed, kind.id),
      /* Uniqueness beyond the visible parts, drawn from their own
       * stream so the parts above stay as they were: how big it
       * stands, how its light behaves, how it moves, and the pace
       * at which it grows. */
      shape: (() => {
        const r2 = mulberry32(hashString(seed + ":shape"));
        return {
          size: Math.round((0.85 + r2() * 0.33) * 100) / 100,
          glow: GLOWS[Math.floor(r2() * GLOWS.length)],
          gait: GAITS[Math.floor(r2() * GAITS.length)],
          pace: Math.round((0.9 + r2() * 0.2) * 100) / 100
        };
      })(),
      /* Their finer grain, from its own stream (see the lists
       * above): which details they will grow, and the two they
       * are born wearing — their markings' density and their eye's
       * variant. */
      details: (() => {
        const r3 = mulberry32(hashString(seed + ":detail"));
        return {
          crestStyle: CREST_STYLES[Math.floor(r3() * CREST_STYLES.length)],
          ears: EAR_STYLES[Math.floor(r3() * EAR_STYLES.length)],
          trail: TRAIL_STYLES[Math.floor(r3() * TRAIL_STYLES.length)],
          cheeks: CHEEK_STYLES[Math.floor(r3() * CHEEK_STYLES.length)],
          pattern: PATTERN_STYLES[Math.floor(r3() * PATTERN_STYLES.length)],
          density: Math.round((0.7 + r3() * 0.6) * 100) / 100,
          eyeVariant: EYE_VARIANTS[Math.floor(r3() * EYE_VARIANTS.length)]
        };
      })()
    };
  }

  /* ---- the Spark passport: identity that travels by hand ----
   *
   * Aaron's ruling (Nov 19, 2026): the Spark is one and the same
   * across platforms — it travels between website and phone and
   * is never lost, with the Living Phone as its memory. Accounts
   * and sync are a later step, gated on his word; what stands
   * here needs neither. A passport is a short code a keeper can
   * read aloud, type, or scan, and it carries identity only: the
   * seed — which itself holds the birth Moon, the Pattern Day,
   * and the kind — and the name the Spark answers to. Nothing
   * else crosses: no growth, no garden, no record of days. Their
   * whole history still travels as the bundle file, carried by
   * the keeper's hand, the way it always has.
   *
   * The code: SPK1-<moon>-<pattern day>-<kind>-<nonce>-<name>-
   * <check>. The nonce rides uppercased for the eye and folds
   * back to the seed's own lowercase on reading, so the seed a
   * passport rebuilds is the seed that was born — and the same
   * seed grows the same Spark anywhere, which is the whole
   * promise. The name rides as plain letters: the seed's own
   * name when the keeper gave none, else the keeper's name in
   * simple capitals (its spaces and small letters do not survive
   * the code; the bundle file carries a name whole). The
   * two-letter check is the body's own hash, so a mistyped code
   * is refused plainly instead of growing a wrong Spark. */
  const PASSPORT_PREFIX = "SPK1";

  function passportSlugFor(name) {
    return String(name == null ? "" : name)
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 16);
  }

  function passportCheckFor(body) {
    return (hashString(body) % 1296).toString(36).toUpperCase().padStart(2, "0");
  }

  /* A record's passport code, or null when the record's seed
   * does not speak. Pure: the same record writes the same code
   * on any device, forever. */
  function passportCodeFor(record) {
    if (!record) return null;
    const parsed = parseSeed(record.seed);
    if (!parsed) return null;
    const companion = generate(record.seed);
    if (!companion) return null;
    const answerName = cleanName(record.name) || companion.name;
    const slug = passportSlugFor(answerName) || "SPARK";
    const body = [
      PASSPORT_PREFIX,
      parsed.moon == null ? 0 : parsed.moon,
      parsed.patternDay,
      parsed.kindIndex,
      parsed.nonce.toUpperCase(),
      slug
    ].join("-");
    return `${body}-${passportCheckFor(body)}`;
  }

  /* A passport read back: { seed, name, companion } — the name
   * the Spark answers to, or "" when the code carries the seed's
   * own name. Accepts the code as a keeper would type it (any
   * case, spaces around its dashes) and, plainly, a bare seed on
   * its own. Anything damaged, mistyped, or not a passport at
   * all reads as null: no Spark is grown from a doubtful code. */
  function parsePassportCode(text) {
    const raw = String(text == null ? "" : text).trim();
    if (!raw) return null;
    const bare = parseSeed(raw.toLowerCase());
    if (bare) {
      const seed = raw.toLowerCase();
      const companion = generate(seed);
      return companion ? { seed, name: "", companion } : null;
    }
    const cleaned = raw.toUpperCase().replace(/[\s_]+/g, "");
    const parts = cleaned.split("-").filter((p) => p !== "");
    if (parts.length !== 7 || parts[0] !== PASSPORT_PREFIX) return null;
    const body = parts.slice(0, 6).join("-");
    if (passportCheckFor(body) !== parts[6]) return null;
    const seed = [
      SEED_PREFIX,
      Number(parts[1]),
      Number(parts[2]),
      Number(parts[3]),
      parts[4].toLowerCase()
    ].join("-");
    if (!parseSeed(seed)) return null;
    const companion = generate(seed);
    if (!companion) return null;
    const slug = parts[5];
    const name = slug && slug !== passportSlugFor(companion.name)
      ? slug.charAt(0) + slug.slice(1).toLowerCase()
      : "";
    return { seed, name, companion };
  }

  /* The record a passport raises on a new device: a fresh
   * record — born here, grown from nothing yet — carrying the
   * travelled seed and the name it answers to. Their growth
   * does not cross in a passport; it crosses in the bundle. */
  function recordFromPassport(parsed, civilDate) {
    if (!parsed || !parseSeed(parsed.seed)) return null;
    return newRecord({ seed: parsed.seed, name: parsed.name || "", civilDate });
  }

  /* ---- rendering (SVG string; the browser drops it into the page) ---- */

  function bodyShape(companion) {
    const { body, accent } = companion.palette;
    switch (companion.form) {
      case "comet":
        return `<path d="M50 62 Q18 78 8 92 Q30 88 44 76 Z" fill="${accent}" opacity="0.75"/><circle cx="56" cy="52" r="26" fill="${body}"/>`;
      case "sprout":
        return `<ellipse cx="50" cy="58" rx="25" ry="27" fill="${body}"/><path d="M50 32 Q44 16 30 12 Q46 10 52 24 Q60 8 74 8 Q64 22 54 30 Z" fill="${accent}"/>`;
      case "shard":
        return `<polygon points="50,14 74,44 62,88 38,88 26,44" fill="${body}"/><polyline points="50,14 50,88" stroke="${accent}" stroke-width="2" opacity="0.6" fill="none"/>`;
      case "wave":
        return `<path d="M22 62 Q30 34 50 34 Q70 34 78 58 Q84 76 68 84 Q50 92 34 84 Q16 76 22 62 Z" fill="${body}"/>`;
      case "moth":
        return `<ellipse cx="28" cy="46" rx="17" ry="24" fill="${body}" opacity="0.85"/><ellipse cx="72" cy="46" rx="17" ry="24" fill="${body}" opacity="0.85"/><ellipse cx="50" cy="56" rx="11" ry="26" fill="${body}"/>`;
      case "orb":
      default:
        return `<circle cx="50" cy="54" r="28" fill="${body}"/>`;
    }
  }

  function markingShapes(companion, rand) {
    const { accent, glow } = companion.palette;
    const out = [];
    const n = companion.markings.count;
    if (companion.markings.style === "rings") {
      for (let i = 0; i < n; i++)
        out.push(`<circle cx="50" cy="54" r="${12 + i * 6}" fill="none" stroke="${glow}" stroke-width="1.6" opacity="${0.5 - i * 0.08}"/>`);
    } else if (companion.markings.style === "speckles") {
      for (let i = 0; i < n * 2; i++) {
        const a = rand() * Math.PI * 2;
        const r = 8 + rand() * 17;
        out.push(`<circle cx="${(50 + Math.cos(a) * r).toFixed(1)}" cy="${(54 + Math.sin(a) * r).toFixed(1)}" r="${(1.4 + rand() * 1.6).toFixed(1)}" fill="${glow}" opacity="0.8"/>`);
      }
    } else if (companion.markings.style === "seam") {
      out.push(`<path d="M28 40 Q50 ${44 + n * 4} 72 38 M30 68 Q50 ${60 + n * 3} 70 66" stroke="${accent}" stroke-width="2" fill="none" opacity="0.7" stroke-linecap="round"/>`);
    } else if (companion.markings.style === "stripes") {
      for (let i = 0; i < n; i++)
        out.push(`<line x1="${34 + i * 9}" y1="34" x2="${30 + i * 9}" y2="76" stroke="${glow}" stroke-width="2.4" opacity="0.45" stroke-linecap="round"/>`);
    } else if (companion.markings.style === "stars") {
      for (let i = 0; i < n; i++) {
        const x = 30 + rand() * 40;
        const y = 32 + rand() * 42;
        out.push(`<path d="M${x} ${y - 4} L${x + 1.2} ${y - 1.2} L${x + 4} ${y} L${x + 1.2} ${y + 1.2} L${x} ${y + 4} L${x - 1.2} ${y + 1.2} L${x - 4} ${y} L${x - 1.2} ${y - 1.2} Z" fill="${glow}" opacity="0.9"/>`);
      }
    }
    return out.join("");
  }

  function crestShape(companion) {
    const { accent, glow } = companion.palette;
    switch (companion.crest) {
      case "flame":
        return `<path d="M50 6 Q56 16 52 24 Q50 27 48 24 Q44 15 50 6 Z" fill="${accent}"/>`;
      case "leaf":
        return `<path d="M50 22 Q50 8 64 6 Q64 20 50 22 Z" fill="${accent}"/>`;
      case "halo":
        return `<ellipse cx="50" cy="16" rx="15" ry="4.5" fill="none" stroke="${glow}" stroke-width="2.4"/>`;
      case "curl":
        return `<path d="M50 24 Q50 10 60 12 Q67 14 63 20" fill="none" stroke="${accent}" stroke-width="2.6" stroke-linecap="round"/>`;
      default:
        return "";
    }
  }

  /* Their finer grain, drawn — v9. One function per detail of
   * companion.details, in the body's own coordinates; renderSVG
   * decides which stand on the page, by their reveal state. The
   * trail is drawn behind the body, the rest over it. All of
   * it is kept small on purpose: at roaming size these read as
   * a silhouette's character, not as separate parts. */

  function trailShape(companion) {
    const { accent, glow } = companion.palette;
    switch (companion.details.trail) {
      case "wisp":
        return `<path d="M30 66 Q14 74 8 90 Q20 84 30 78 Q24 72 30 66 Z" fill="${accent}" opacity="0.55"/>`;
      case "ribbon":
        return `<path d="M28 60 Q12 62 6 52 M28 70 Q14 76 10 84" stroke="${accent}" stroke-width="2.2" fill="none" opacity="0.6" stroke-linecap="round"/>`;
      case "sparkles":
        return `<circle cx="16" cy="66" r="1.9" fill="${glow}" opacity="0.9"/><circle cx="10" cy="78" r="1.4" fill="${accent}" opacity="0.85"/><circle cx="22" cy="80" r="1.1" fill="${glow}" opacity="0.8"/>`;
      default:
        return "";
    }
  }

  function earsShape(companion) {
    const { accent, body } = companion.palette;
    switch (companion.details.ears) {
      case "fins":
        return `<path d="M26 44 L14 38 L22 54 Z" fill="${accent}" opacity="0.8"/><path d="M74 44 L86 38 L78 54 Z" fill="${accent}" opacity="0.8"/>`;
      case "tufts":
        return `<path d="M28 34 q-3 -6 -8 -8 M30 32 q-1 -7 -5 -10 M72 34 q3 -6 8 -8 M70 32 q1 -7 5 -10" stroke="${accent}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.85"/>`;
      case "points":
        return `<path d="M33 30 L29 16 L42 24 Z" fill="${body}"/><path d="M67 30 L71 16 L58 24 Z" fill="${body}"/>`;
      default:
        return "";
    }
  }

  function cheekShape(companion) {
    const { accent, glow } = companion.palette;
    const cy = companion.form === "moth" ? 58 : 61;
    const dx = companion.form === "moth" ? 7 : 13;
    switch (companion.details.cheeks) {
      case "glow":
        return `<ellipse cx="${50 - dx}" cy="${cy}" rx="5" ry="3.4" fill="${glow}" opacity="0.55"/><ellipse cx="${50 + dx}" cy="${cy}" rx="5" ry="3.4" fill="${glow}" opacity="0.55"/>`;
      case "blush":
        return `<ellipse cx="${50 - dx}" cy="${cy}" rx="4.6" ry="3" fill="${accent}" opacity="0.5"/><ellipse cx="${50 + dx}" cy="${cy}" rx="4.6" ry="3" fill="${accent}" opacity="0.5"/>`;
      case "freckles": {
        let dots = "";
        for (const sx of [50 - dx - 3, 50 - dx, 50 - dx + 3, 50 + dx - 3, 50 + dx, 50 + dx + 3])
          dots += `<circle cx="${sx}" cy="${cy + (sx % 3)}" r="0.9" fill="${accent}" opacity="0.75"/>`;
        return dots;
      }
      default:
        return "";
    }
  }

  /* The styled crest, drawn inside the crest's own group, so
   * it grows with the same stage scale as the crest it joins. */
  function crestExtraShape(companion) {
    const { accent, glow } = companion.palette;
    switch (companion.details.crestStyle) {
      case "tuft":
        return `<path d="M44 22 q-2 -8 -8 -11 M50 21 q0 -9 -4 -13 M56 22 q2 -8 8 -11" stroke="${accent}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
      case "horns":
        return `<path d="M36 24 Q28 14 30 6 Q38 12 40 20 Z" fill="${accent}"/><path d="M64 24 Q72 14 70 6 Q62 12 60 20 Z" fill="${accent}"/>`;
      case "fin":
        return `<path d="M50 24 Q50 4 36 2 Q44 12 44 22 Z" fill="${accent}" opacity="0.9"/>`;
      case "halo":
        return `<ellipse cx="50" cy="9" rx="10" ry="3" fill="none" stroke="${glow}" stroke-width="1.8" opacity="0.85"/>`;
      case "leaf":
        return `<path d="M56 20 Q58 8 70 8 Q69 20 56 20 Z" fill="${accent}" opacity="0.9"/>`;
      default:
        return "";
    }
  }

  /* The second pattern layer, under the markings' own logic:
   * fine speckles fall where they fall; bands and the belly
   * patch are cut to the body's own silhouette by a clip. */
  function patternLayer(companion, rand, clipId) {
    const { accent, glow } = companion.palette;
    const d = companion.details;
    if (d.pattern === "speckles") {
      const out = [];
      const n = Math.round(9 * d.density) + 3;
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2;
        const r = 6 + rand() * 19;
        out.push(`<circle cx="${(50 + Math.cos(a) * r).toFixed(1)}" cy="${(54 + Math.sin(a) * r).toFixed(1)}" r="${(0.8 + rand() * 0.6).toFixed(1)}" fill="${accent}" opacity="0.65"/>`);
      }
      return out.join("");
    }
    if (d.pattern === "bands") {
      return `<g clip-path="url(#${clipId})"><path d="M18 44 Q50 36 82 44" stroke="${glow}" stroke-width="3.4" fill="none" opacity="0.4"/><path d="M18 66 Q50 58 82 66" stroke="${accent}" stroke-width="3" fill="none" opacity="0.35"/></g>`;
    }
    if (d.pattern === "belly") {
      return `<g clip-path="url(#${clipId})"><ellipse cx="50" cy="72" rx="11" ry="8.5" fill="${glow}" opacity="0.4"/></g>`;
    }
    return "";
  }

  function eyeShape(companion) {
    const cy = companion.form === "moth" ? 50 : 52;
    const variant = companion.details ? companion.details.eyeVariant : "plain";
    if (companion.eye === "half") {
      const extra =
        variant === "sparkle"
          ? `<circle cx="50" cy="${cy - 6}" r="1.1" fill="#fff"/>`
          : variant === "lash"
            ? `<path d="M59 ${cy - 1} l3.4 -2.6" stroke="#0b0e18" stroke-width="1.6" stroke-linecap="round"/>`
            : variant === "ring"
              ? `<path d="M40 ${cy + 1} Q50 ${cy - 9} 60 ${cy + 1}" stroke="${companion.palette.glow}" stroke-width="1.2" fill="none" opacity="0.6"/>`
              : "";
      return `<path class="spark-eye" d="M41 ${cy} Q50 ${cy - 7} 59 ${cy}" stroke="#0b0e18" stroke-width="3" fill="none" stroke-linecap="round"/>${extra}`;
    }
    const r = companion.eye === "bright" ? 8.5 : 7;
    const extra =
      variant === "sparkle"
        ? `<circle cx="${50 - r * 0.38}" cy="${cy + r * 0.28}" r="${r * 0.14}" fill="#fff"/>`
        : variant === "lash"
          ? `<path d="M${50 + r * 0.8} ${cy - r * 0.55} l2.8 -2" stroke="#0b0e18" stroke-width="1.5" stroke-linecap="round"/>`
          : variant === "ring"
            ? `<circle cx="50" cy="${cy}" r="${r + 2.6}" fill="none" stroke="${companion.palette.glow}" stroke-width="1.1" opacity="0.55"/>`
            : "";
    return `<g class="spark-eye"><circle cx="50" cy="${cy}" r="${r}" fill="#0b0e18"/><circle cx="50" cy="${cy}" r="${r * 0.45}" fill="${companion.palette.glow}"/><circle cx="${50 + r * 0.3}" cy="${cy - r * 0.3}" r="${r * 0.18}" fill="#fff"/>${extra}</g>`;
  }

  /* Their spark-light, drawn: the motes that form around them.
   * No bubble, no ring — Aaron's word (Nov 19, 2026): the
   * circle around their goes, and in its place they light up
   * like a spark, with little sparks of their own forming
   * around them. The variant is the seed's: one mote shape per
   * Spark (a four-point star, a small diamond, a plain dot),
   * their own scatter, their palette's glow and accent taking
   * turns. The count grows with their stage — a young Spark
   * carries a few, a grown one a small company — so growth
   * still reads at a glance, as light, not furniture. */
  const MOTE_SHAPES = ["star", "diamond", "dot"];
  function moteShapes(companion, stage) {
    const rand = mulberry32(hashString(companion.seed + ":motes"));
    const shape = MOTE_SHAPES[Math.floor(rand() * MOTE_SHAPES.length)];
    const count = 3 + stage * 2 + Math.floor(rand() * 2);
    const { accent, glow } = companion.palette;
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = 33 + rand() * 13;
      const x = (50 + Math.cos(a) * r).toFixed(1);
      const y = (52 + Math.sin(a) * r * 0.92).toFixed(1);
      const s = (0.7 + rand() * 0.9).toFixed(2);
      const col = i % 3 === 2 ? accent : glow;
      const op = (0.5 + rand() * 0.45).toFixed(2);
      const delay = (-rand() * 3).toFixed(2);
      const at = `transform="translate(${x} ${y}) scale(${s})"`;
      const cls = `class="spark-mote" style="animation-delay:${delay}s"`;
      if (shape === "star")
        out.push(`<path ${cls} ${at} d="M0 -5 C0.8 -1.5 1.5 -0.8 5 0 C1.5 0.8 0.8 1.5 0 5 C-0.8 1.5 -1.5 0.8 -5 0 C-1.5 -0.8 -0.8 -1.5 0 -5 Z" fill="${col}" opacity="${op}"/>`);
      else if (shape === "diamond")
        out.push(`<path ${cls} ${at} d="M0 -3.4 L2.4 0 L0 3.4 L-2.4 0 Z" fill="${col}" opacity="${op}"/>`);
      else out.push(`<circle ${cls} cx="${x}" cy="${y}" r="${(1.6 * s).toFixed(1)}" fill="${col}" opacity="${op}"/>`);
    }
    return { shape, motes: out.join("") };
  }

  /* ---- the flame wrap (wrap: 1) ----
   *
   * Aaron's direction (Nov 23, 2026): the Sparks of the animated
   * series wear a living flame; the rendered Spark should wear
   * the same family look — blended around the Spark that already
   * stands, never in its place. So the wrap is one new outer
   * layer, drawn from the keeper's existing seed by its own
   * stream (`seed + ":flamewrap"`), the way every other growth
   * of their seed is drawn: no existing draw moves, no new seed,
   * no re-roll. The wrap's version rides the record (`wrap: 1`)
   * beside the generator's, so a future revision is auditable.
   *
   * The flame's hue is the kind's own — the palette the seed
   * already chose (glow and accent). The family resemblance is
   * in the shape and behaviour: a ring of teardrop licks rising
   * around the core, breathing slowly at rest. Each kind bends
   * the grammar its own way, below. A keeper may lift the wrap
   * off (the record carries `wrap: 0`); with it off, renderSVG
   * returns exactly the string it returned before the wrap
   * existed — the persistence fence, kept byte for byte. */

  const WRAP_VERSION = 1;

  /* How each kind's flame behaves: height and width of the
   * licks, how far their tips curl, how close the ring hugs the
   * core, how deep it reads, and the breath's period in seconds.
   * Fire is the reference flame; Water's licks curl over like
   * wave-crests; Shadow's hug low and smoky; Air's are thin and
   * quick; Earth's short, broad and steady; Light's drawn as
   * rays as much as petals. */
  const FLAME_BENDS = {
    fire: { height: 1.25, width: 1.0, curl: 0.25, radius: 1.0, opacity: 0.95, breath: 2.6 },
    water: { height: 0.8, width: 1.15, curl: 1.0, radius: 0.98, opacity: 0.9, breath: 4.2 },
    shadow: { height: 0.55, width: 1.1, curl: 0.4, radius: 0.88, opacity: 0.62, breath: 4.8 },
    air: { height: 0.95, width: 0.7, curl: 0.6, radius: 1.02, opacity: 0.85, breath: 3.0 },
    earth: { height: 0.65, width: 1.35, curl: 0.15, radius: 0.95, opacity: 0.92, breath: 5.2 },
    light: { height: 1.15, width: 0.62, curl: 0.05, radius: 1.03, opacity: 0.95, breath: 3.4 }
  };

  const roundTo = (n, p) => Math.round(n * 10 ** p) / 10 ** p;

  /* The wrap's particulars for one Spark at one stage, as pure
   * data — the same seed and stage settle the same flame on any
   * device, and the 3D renderer reads the same stream the same
   * way, so the flame is one flame in both bodies. An Ember
   * wears a few small licks; a Kindled a full ring; a Guardian
   * the fullest the family has. The stage changes the flame's
   * measure, never its grammar. */
  function flameWrapFor(companion, stage = 0) {
    if (!companion) return null;
    const bend = FLAME_BENDS[companion.kind] || FLAME_BENDS.fire;
    const rand = mulberry32(hashString(companion.seed + ":flamewrap"));
    const base = [6, 9, 12][stage] || 9;
    const count = base + Math.floor(rand() * 3);
    const licks = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.14;
      const topness = (Math.cos(angle) + 1) / 2;
      const heightJitter = 0.8 + rand() * 0.45;
      const widthJitter = 0.85 + rand() * 0.35;
      const curl = (rand() - 0.5) * 2 * bend.curl * 3.2;
      const color = rand() < 0.62 ? "glow" : "accent";
      const delay = -rand() * 3;
      licks.push({
        angle: roundTo(angle, 4),
        topness: roundTo(topness, 3),
        height: roundTo((8.5 + 7 * topness) * bend.height * heightJitter * (0.8 + stage * 0.12), 2),
        width: roundTo(4.4 * bend.width * widthJitter, 2),
        curl: roundTo(curl, 2),
        color,
        delay: roundTo(delay, 2)
      });
    }
    return {
      version: WRAP_VERSION,
      kind: companion.kind,
      count,
      radius: roundTo(32.5 * bend.radius, 1),
      breath: bend.breath,
      opacity: bend.opacity,
      licks
    };
  }

  /* The wrap, drawn: a ring of teardrop licks behind the core,
   * in the core's own glow and accent. The first five licks are
   * its core flame; the rest are detail the small sizes shed
   * first (the size ladder: the flame simplifies first, and the
   * kind colour — which is never spent — carries identity at
   * every size). Tiers: "full" the whole ring; "simple" every
   * other lick; "glyph" only the crown of the flame, the
   * teardrop silhouette a tiny marker can hold. When the Spark
   * works or leads, the host says so (`working`) and the flame
   * gathers — brighter, leaning — one honest signal, lit only
   * by real work. The trail, where it has arrived, is shaped as
   * small flame-licks thinning out behind. */
  function flameWrapShapes(companion, stage, { tier = "full", working = false, trail = false } = {}) {
    const wrap = flameWrapFor(companion, stage);
    if (!wrap) return "";
    const { glow, accent } = companion.palette;
    const parts = [];
    let crown = 0;
    wrap.licks.forEach((lick, i) => {
      if (tier === "simple" && i % 2 === 1) return;
      if (tier === "glyph" && (lick.topness < 0.62 || crown >= 5)) return;
      if (tier === "glyph") crown += 1;
      const x = (50 + Math.sin(lick.angle) * wrap.radius).toFixed(1);
      const y = (52 - Math.cos(lick.angle) * wrap.radius * 0.97).toFixed(1);
      const deg = ((lick.angle * 180) / Math.PI).toFixed(1);
      const col = lick.color === "accent" ? accent : glow;
      const h = lick.height;
      const w = lick.width;
      const c = lick.curl;
      parts.push(
        `<g transform="translate(${x} ${y}) rotate(${deg})">` +
          `<path class="spark-flame-lick${i < 5 ? " spark-flame-core" : " spark-flame-detail"}" ` +
          `style="animation-delay:${lick.delay}s;animation-duration:${wrap.breath}s" ` +
          `d="M0 0 C ${(-w).toFixed(1)} ${(-h * 0.38).toFixed(1)} ${(-w * 0.55 + c).toFixed(1)} ${(-h * 0.78).toFixed(1)} ${c.toFixed(1)} ${(-h).toFixed(1)} ` +
          `C ${(w * 0.55 + c).toFixed(1)} ${(-h * 0.78).toFixed(1)} ${w.toFixed(1)} ${(-h * 0.38).toFixed(1)} 0 0 Z" ` +
          `fill="${col}" opacity="${wrap.opacity}"/></g>`
      );
    });
    if (trail && tier === "full") {
      const trailLicks = [
        { x: 24, y: 68, h: 7, col: glow, op: 0.55 },
        { x: 16, y: 76, h: 5.5, col: accent, op: 0.45 },
        { x: 9, y: 84, h: 4, col: glow, op: 0.35 }
      ];
      for (const t of trailLicks) {
        parts.push(
          `<g transform="translate(${t.x} ${t.y}) rotate(-52)">` +
            `<path class="spark-flame-lick spark-flame-detail" ` +
            `d="M0 0 C -2 ${(-t.h * 0.38).toFixed(1)} -1.4 ${(-t.h * 0.78).toFixed(1)} 0 ${(-t.h).toFixed(1)} ` +
            `C 1.4 ${(-t.h * 0.78).toFixed(1)} 2 ${(-t.h * 0.38).toFixed(1)} 0 0 Z" fill="${t.col}" opacity="${t.op}"/></g>`
        );
      }
    }
    return `<g class="spark-flame${working ? " is-working" : ""}" data-spark-flame="${WRAP_VERSION}" aria-hidden="true">${parts.join("")}</g>`;
  }

  /* Whether a keeper's record wears the wrap. The rollout is
   * Aaron's word (Nov 23, 2026): the wrap goes on every Spark,
   * and any keeper may lift it off — so a record that says
   * nothing wears it, and only an explicit `wrap: 0` lifts it. */
  function wrapFor(record) {
    return record && record.wrap === 0 ? 0 : 1;
  }

  /* The keeper's hand on the wrap: a new record, the old one
   * untouched, carrying the choice and nothing else changed. */
  function withWrap(record, on) {
    if (!record) return record;
    return { ...record, wrap: on ? WRAP_VERSION : 0 };
  }

  function renderSVG(companion, { stage = 0, revealed = null, wrap = null, flameState = null, flameTier = null } = {}) {
    if (!companion) return "";
    const rand = mulberry32(hashString(companion.seed + ":marks"));
    /* Evolution, drawn: the same seed-body at every stage — the
     * stages are this creature grown, not three creatures. An
     * A Spark stands small, its markings half-shown, its crest
     * young, a few spark motes in the air around it. A Kindled
     * stands larger, markings full, crest grown, its light
     * brighter and its motes more. A Guardian stands full:
     * markings richest, the fullest company of motes, and a
     * crown. A returning visitor can tell at a glance that
     * their Spark is not as it was. */
    const bodyScale = [0.8, 0.92, 1.03][stage] || 1;
    const markFraction = [0.5, 0.85, 1.15][stage] || 1;
    const crestScale = [0.65, 0.88, 1.02][stage] || 1;
    const crestOpacity = [0.7, 0.9, 1][stage] || 1;
    /* Their finer grain stands only where their schedule has
     * brought it: `revealed` names the detail that has arrived
     * (revealScheduleFor, counted from their record). No list —
     * a first meeting, a fresh record — is their born look: the
     * whole base, none of the arrivals. Their markings' density
     * and their eye's variant are born with them and always stand. */
    const shown = (id) => Array.isArray(revealed) && revealed.includes(id);
    const density = companion.details ? companion.details.density : 1;
    const grown = {
      ...companion,
      markings: {
        ...companion.markings,
        count: Math.max(1, Math.round(companion.markings.count * markFraction * density))
      }
    };
    const drand = mulberry32(hashString(companion.seed + ":detail2d"));
    const clipId = `sb${Math.abs(hashString(companion.seed)).toString(36)}`;
    const needsClip =
      shown("pattern") &&
      companion.details &&
      (companion.details.pattern === "bands" || companion.details.pattern === "belly");
    const stageCrown =
      stage >= 2
        ? `<path d="M38 12 L44 4 L50 11 L56 4 L62 12 Z" fill="${companion.palette.accent}" opacity="0.95"/>`
        : "";
    /* Their light, feathered: a radial glow in their own glow
     * colour that fades to nothing at its edge — light they
     * stand in, not a disc they sit on. It deepens a little
     * as they grow. */
    const halo = companion.shape
      ? companion.shape.glow === "bright"
        ? 0.22
        : companion.shape.glow === "deep"
          ? 0.08
          : 0.14
      : 0.14;
    const glowLevel = Math.round((halo + stage * 0.05) * 100) / 100;
    const glowId = `sg${Math.abs(hashString(companion.seed)).toString(36)}`;
    const glowDef =
      `<radialGradient id="${glowId}">` +
      `<stop offset="0%" stop-color="${companion.palette.glow}" stop-opacity="${glowLevel}"/>` +
      `<stop offset="55%" stop-color="${companion.palette.glow}" stop-opacity="${Math.round(glowLevel * 50) / 100}"/>` +
      `<stop offset="100%" stop-color="${companion.palette.glow}" stop-opacity="0"/>` +
      `</radialGradient>`;
    const { shape: moteShape, motes } = moteShapes(companion, stage);
    /* The flame wrap stands around the core, never in its
     * place: drawn behind the body, in front of the glowfield.
     * An explicit `wrap` from the host wins; a companion that
     * carries the choice (from its record) speaks next; the
     * rollout's default is on. With the wrap off, not one byte
     * of what follows differs from the drawing as it stood
     * before the wrap existed. */
    const wrapOn = wrap == null ? companion.wrap !== 0 : !!wrap;
    const flame = wrapOn
      ? flameWrapShapes(companion, stage, {
          tier: flameTier || "full",
          working: flameState === "working",
          trail: shown("trail")
        })
      : "";
    return (
      `<svg viewBox="0 0 100 100" role="img" aria-label="A ${companion.kindName} Spark"${wrapOn ? ` data-spark-wrap="${WRAP_VERSION}"` : ""} data-spark-form="${companion.form}" data-spark-stage="${stage}" data-spark-size="${companion.shape ? companion.shape.size : 1}" data-spark-glow="${companion.shape ? companion.shape.glow : "soft"}" data-spark-gait="${companion.shape ? companion.shape.gait : "stroll"}" data-spark-shown="${(revealed || []).join(" ")}" data-spark-motes="${moteShape}">` +
      `<defs>${glowDef}${needsClip ? `<clipPath id="${clipId}">${bodyShape(companion)}</clipPath>` : ""}</defs>` +
      `<circle class="spark-glowfield" cx="50" cy="52" r="47" fill="url(#${glowId})"/>` +
      flame +
      `<g class="spark-motes">${motes}</g>` +
      `<g transform="translate(50 54) scale(${bodyScale}) translate(-50 -54)">` +
      (shown("trail") ? trailShape(companion) : "") +
      bodyShape(companion) +
      markingShapes(grown, rand) +
      (shown("pattern") ? patternLayer(companion, drand, clipId) : "") +
      (shown("ears") ? earsShape(companion) : "") +
      (shown("cheeks") ? cheekShape(companion) : "") +
      `<g transform="translate(50 14) scale(${crestScale}) translate(-50 -14)" opacity="${crestOpacity}">` +
      crestShape(companion) +
      (shown("crest") ? crestExtraShape(companion) : "") +
      `</g>` +
      eyeShape(companion) +
      `</g>` +
      stageCrown +
      `</svg>`
    );
  }

  /* ---- the record: seed + name + what it has noticed ---- */

  function normalizeName(name) {
    const clean = String(name == null ? "" : name).replace(/\s+/g, " ").trim();
    if (!clean) return NAME_FALLBACK;
    return clean.slice(0, NAME_MAX);
  }

  /* The keeper's own name for their Spark, cleaned for keeping.
   * Blank stays blank: the Spark still has its seed-name. */
  function cleanName(name) {
    return String(name == null ? "" : name)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, NAME_MAX);
  }

  /* The name to speak: the keeper's name when they gave one (the
   * name it answers to), otherwise the name its seed grew. */
  function displayName(record, companion) {
    const keeper = cleanName(record && record.name);
    if (keeper) return keeper;
    if (companion && companion.name) return companion.name;
    return NAME_FALLBACK;
  }

  function newRecord({ seed, name, civilDate }) {
    return {
      version: 1,
      /* The flame wrap's version, worn from birth (Aaron's
       * rollout, Nov 23, 2026): presentation only — it derives
       * nothing, counts nothing, and a keeper may set it to 0
       * to lift the wrap off and stand the Spark as it was. */
      wrap: WRAP_VERSION,
      seed,
      name: cleanName(name),
      bornCivil: civilDate || null,
      daysSeen: [],
      pagesSeen: [],
      practiceDays: [],
      lastDay: null,
      /* The memory the guide speaks from: the page being walked
       * now, and the one walked just before it — where its person
       * left off. And the growth stage its person last saw, so a
       * growth can be announced once, when it is new. */
      lastPage: null,
      prevPage: null,
      stageSeen: 0,
      /* The care life: kindled, played with, rested — counted
       * from real interactions on this device, and the bond they
       * grow. Care only ever adds; time away is met with welcome,
       * never with loss. And today's trail: the day it belongs
       * to, and the steps walked so far. */
      care: { kindles: 0, plays: 0, rests: 0, bond: 0, kindleDay: null, playDay: null, playCount: 0, restDay: null },
      trail: { day: null, done: [] },
      /* The play life: touches counted as they happen — pets,
       * pokes, drags by hand, catches in the chase, rounds
       * echoed — the tricks play has taught their (kept once
       * announced, so each is celebrated a single time), and
       * the day their one gentle question was last asked. Play
       * only ever adds, exactly like care. */
      play: { pets: 0, pokes: 0, drags: 0, catches: 0, bestChase: 0, echoBest: 0, tricks: [], askedDay: null },
      /* The reveals their keeper has already been told about —
       * their detail arrives on a stretching schedule counted
       * from this record's own counters, and each arrival is
       * announced exactly once, so what is kept here is only
       * the telling, never the schedule itself. */
      revealsSeen: []
    };
  }

  function recordVisit(record, { patternDay, page }) {
    const next = { ...record };
    if (patternDay != null && !next.daysSeen.includes(patternDay)) {
      next.daysSeen = [...next.daysSeen, patternDay].sort((a, b) => a - b);
    }
    if (page && !next.pagesSeen.includes(page)) {
      next.pagesSeen = [...next.pagesSeen, page];
    }
    if (page) {
      /* Leaving off is remembered honestly: the page before this
       * one becomes "where you left off" — unless this page is
       * that same page again (a reload is not a journey). */
      if (record.lastPage && record.lastPage !== page) {
        next.prevPage = record.lastPage;
      } else {
        next.prevPage = record.prevPage || null;
      }
      next.lastPage = page;
    }
    if (patternDay != null) next.lastDay = patternDay;
    return next;
  }

  function recordPractice(record, { patternDay }) {
    const next = { ...record };
    if (patternDay != null && !next.practiceDays.includes(patternDay)) {
      next.practiceDays = [...next.practiceDays, patternDay].sort((a, b) => a - b);
    }
    return next;
  }

  function growthPoints(record) {
    const returnDays = Math.max(0, (record.daysSeen || []).length - 1);
    const practice = (record.practiceDays || []).length;
    const pages = Math.min(10, (record.pagesSeen || []).length);
    /* The bond counts too — care is faithfulness, felt up close.
     * Capped, so care deepens growth without replacing the walk. */
    const bond = Math.min(12, careOf(record).bond);
    return returnDays * 2 + practice * 3 + pages + bond;
  }

  function stageFor(points, pace = 1) {
    let ix = 0;
    STAGES.forEach((s, i) => {
      if (points >= s.min / pace) ix = i;
    });
    return { index: ix, name: STAGES[ix].name, points };
  }

  /* Each Spark grows at its own pace, grown from its seed. */
  function stageOf(record, companion) {
    const pace = companion && companion.shape ? companion.shape.pace : 1;
    return stageFor(growthPoints(record), pace);
  }

  /* Progress, in honest counts, for the panel: where it stands,
   * what the next stage asks, how far away that is, and the facts
   * the points came from — returns, practice, pages — so a keeper
   * can always see exactly what their Spark's growth is made of. */
  function progressOf(record, companion) {
    const pace = companion && companion.shape ? companion.shape.pace : 1;
    const points = growthPoints(record);
    const stage = stageFor(points, pace);
    const nextStage = STAGES[stage.index + 1] || null;
    return {
      stage,
      points,
      next: nextStage ? nextStage.name : null,
      nextAt: nextStage ? Math.ceil(nextStage.min / pace) : null,
      toGo: nextStage ? Math.max(0, Math.ceil(nextStage.min / pace) - points) : 0,
      counts: {
        returnDays: Math.max(0, ((record && record.daysSeen) || []).length - 1),
        practiceDays: ((record && record.practiceDays) || []).length,
        pagesSeen: Math.min(10, ((record && record.pagesSeen) || []).length),
        bond: careOf(record).bond
      }
    };
  }

  /* A growth is an event only when it is new to its person: the
   * stage the record has reached, against the stage they last
   * saw. A record that has never carried a seen-stage (kept by
   * the first build) announces nothing — its stage is simply
   * taken as seen, so no Spark cries "I grew" over old news. */
  function growthEventFor({ record, companion }) {
    const stage = stageOf(record, companion);
    const seen =
      record && typeof record.stageSeen === "number" ? record.stageSeen : stage.index;
    return {
      grew: stage.index > seen,
      stage,
      daysTogether: ((record && record.daysSeen) || []).length
    };
  }

  function markStageSeen(record, stageIndex) {
    return { ...record, stageSeen: stageIndex };
  }

  /* Said once, when the growth is new: how long they have been
   * together, and what it has become. */
  function growthLineFor({ record, companion, stage }) {
    const days = Math.max(1, ((record && record.daysSeen) || []).length);
    const name = displayName(record, companion);
    return `I grew — Day ${days} of us. ${name} is ${stage.name} now.`;
  }

  /* ---- the care life: kindled, played with, rested ---- */

  /* A record kept by an earlier build carries no care block;
   * careOf reads it as a fresh, uncared-for-but-unharmed Spark —
   * care starts counting from the first kind thing done, and
   * nothing is ever owed or lost. */
  function careOf(record) {
    const c = (record && record.care) || {};
    const num = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
    return {
      kindles: num(c.kindles),
      plays: num(c.plays),
      rests: num(c.rests),
      bond: num(c.bond),
      kindleDay: c.kindleDay != null ? c.kindleDay : null,
      playDay: c.playDay != null ? c.playDay : null,
      playCount: num(c.playCount),
      restDay: c.restDay != null ? c.restDay : null
    };
  }

  /* One act of care, recorded. Each act counts in full — the
   * Spark remembers every kindle, every chase, every rest. The
   * bond it grows is gentler about the day: a kindle warms the
   * bond once a day, a rest settles it once a day, and the first
   * two chases of a day run deepest. Care never subtracts. */
  function applyCare(record, { action, patternDay }) {
    const care = careOf(record);
    const day = patternDay != null ? patternDay : null;
    if (action === "kindle") {
      care.kindles += 1;
      if (day != null && care.kindleDay !== day) {
        care.bond += 1;
        care.kindleDay = day;
      }
    } else if (action === "play") {
      care.plays += 1;
      if (day != null) {
        if (care.playDay !== day) {
          care.playDay = day;
          care.playCount = 0;
        }
        care.playCount += 1;
        if (care.playCount <= 2) care.bond += 2;
      }
    } else if (action === "rest") {
      care.rests += 1;
      if (day != null && care.restDay !== day) {
        care.bond += 1;
        care.restDay = day;
      }
    } else {
      return { ...record };
    }
    return { ...record, care };
  }

  /* The care state, in plain words, and the shape it gives the
   * Spark's behaviour: played with today, it plays back; rested
   * today, it moves calm; kindled today, it glows warm. Derived
   * from the record and the day — never from a clock ticking
   * down, never a debt. */
  function careStateFor({ record, companion, todayPatternDay }) {
    const care = careOf(record);
    const day = todayPatternDay != null ? todayPatternDay : null;
    const kindledToday = day != null && care.kindleDay === day;
    const playedToday = day != null && care.playDay === day && care.playCount > 0;
    const restedToday = day != null && care.restDay === day;
    const warmth = kindledToday
      ? "glowing warm — kindled today"
      : care.kindles > 0
        ? "warm from your kindling"
        : "cool and calm, ready when you are";
    const lines = [
      `Warmth: ${warmth}.`,
      playedToday ? "Playful today. The chase is in my step." : "Play: one tap starts a chase.",
      restedToday ? "Rested today. Moving calm." : "Rest: I curl up whenever you ask.",
      care.bond > 0
        ? `Bond: ${care.bond}, from kindling, play, rest, trails.`
        : "Bond: grows from kindling, play, rest, trails."
    ];
    return {
      warmth,
      kindledToday,
      playedToday,
      restedToday,
      bond: care.bond,
      counts: { kindles: care.kindles, plays: care.plays, rests: care.rests },
      lines,
      behavior: {
        playful: playedToday,
        rested: restedToday,
        kindled: kindledToday,
        playfulnessBoost: playedToday ? 0.35 : 0,
        wanderCalm: restedToday ? 0.6 : 1
      }
    };
  }

  /* ---- guidance: lines drawn only from what the record holds ---- */

  function guidanceFor({ record, companion, todayPatternDay }) {
    const name = displayName(record, companion);
    const pages = (record && record.pagesSeen) || [];
    const practice = (record && record.practiceDays) || [];
    const days = (record && record.daysSeen) || [];
    const say = (text, href) => ({ name, text, href: href || null });

    if (todayPatternDay != null && record && record.lastDay != null) {
      const gap = todayPatternDay - record.lastDay;
      if (gap >= 7)
        return say(`You were away ${gap} days of the pattern. Start with today's telling.`, "moons.html");
    }
    if (days.length <= 1)
      return say("Our first day together. Start with today's telling.", "moons.html");
    if (practice.length === 0)
      return say("A small practice makes a lovely first mark.", "teach.html");
    if (!pages.some((p) => p.includes("living-time-sphere")))
      return say("The Sphere waits: the whole year, turning.", "living-time-sphere.html");
    if (!pages.some((p) => p.includes("witness")))
      return say("Witness keeps a page here. Worth a look.", "witness.html");
    if (companion && todayPatternDay != null && todayPatternDay === companion.birthPatternDay)
      return say("The Pattern Day I was born on. Mark it.", "teach.html");
    return say(`Pattern Day ${todayPatternDay} of 364. The telling names the day.`, "moons.html");
  }

  /* ---- the meeting: the Spark introduces itself, anywhere ---- */

  /* The first words a Spark ever says, on whatever page it pops
   * up on. Its own voice: a greeting, its seed-born name, the day
   * it was made from, and the invitation. One tap adopts it; the
   * words never ask for a form or a quiz first. */
  function encounterFor({ companion }) {
    const name = companion ? companion.name : NAME_FALLBACK;
    const born =
      !companion || companion.birthMoon == null
        ? "I was made from today — the Day Out of Time, which belongs to no moon."
        : `I was made from today — Moon ${companion.birthMoon}, Pattern Day ${companion.birthPatternDay}.`;
    return {
      name,
      greeting: "Hey — I'm the Spark you adopt.",
      intro: companion
        ? `I'm ${name}, a ${companion.kindName} Spark — ${companion.temperament}, and ${companion.trait}. ${companion.kindLine}`
        : `I'm ${name}.`,
      voice: companion ? VOICE_LINES[companion.kind] || "" : "",
      look: lookLineFor(companion),
      born,
      invite:
        "Adopt me and I'll walk the whole site with you, pointing out doors as we go. I live only on this device — nothing about me is sent anywhere.",
      adoptLabel: `Adopt ${name}`,
      laterLabel: "Not now"
    };
  }

  /* Today's coordinate, in the same plain words the companions
   * page uses. Formats only what the page hands it — the day
   * itself still comes from the canonical PatternCalendar. */
  function coordinateLineFor(today) {
    if (!today) return "Today, in Living Time";
    if (today.moon == null) return `Today is the ${today.moonName || "Day Out of Time"}`;
    return `Moon ${today.moon} · Day ${today.day} · Pattern Day ${today.dayOfPatternYear}`;
  }

  /* The temper of the moon they are under, from the same
   * canonical position that counts their day: the moon's own
   * name, as the calendar states it, and — from the moon's
   * element, which the calendar data also states — a hue
   * family for their light. The hue tints their glow only; their
   * seed-grown body colours are their identity and never take
   * it. A day outside the moons has no temper to borrow. */
  const MOON_ELEMENT_HUES = { Fire: 14, Water: 208, Air: 255, Earth: 96, Aether: 288 };
  function moonTemperFor({ today, element }) {
    if (!today || today.moon == null || !today.moonName) return null;
    const el = element && MOON_ELEMENT_HUES[element] != null ? element : null;
    return {
      name: today.moonName,
      element: el,
      hue: el ? MOON_ELEMENT_HUES[el] : 43,
      line: `Under ${today.moonName}.`
    };
  }

  /* ---- the guide: arriving somewhere new ---- */

  /* The places the Spark can name, and the door that fits each
   * one. Keyed by page file name, the same key the record keeps.
   * A page not listed here is still walked — the Spark simply
   * falls back to what the record itself suggests. */
  const PAGE_GUIDE = {
    "index.html": { place: "the Front Door", line: "everything here starts from today", next: { href: "moons.html", label: "the 13 Moons telling" } },
    "moons.html": { place: "the 13 Moons page", line: "today, told in plain words", next: { href: "living-time-sphere.html", label: "the Sphere — the whole year, turning" } },
    "teach.html": { place: "the practice page", line: "where a day gets sealed with a mark", next: { href: "moons.html", label: "the 13 Moons telling" } },
    "witness.html": { place: "Witness's page", line: "kept by the one who tends this site", next: { href: "companions.html", label: "my record page" } },
    "hub.html": { place: "the Documentation Hub", line: "documented claims, each carrying its source", next: { href: "timeline.html", label: "the history timeline" } },
    "timeline.html": { place: "the history timeline", line: "the years, laid out in one line", next: { href: "hub.html", label: "the Documentation Hub" } },
    "search.html": { place: "Living Search", line: "one door to every shelf of the library", next: { href: "codex-atlas.html", label: "the Codex Atlas" } },
    "codex-atlas.html": { place: "the Codex Atlas", line: "the whole map on one page", next: { href: "search.html", label: "Living Search" } },
    "lab.html": { place: "the Lab", line: "the bench, where the instruments live", next: { href: "teach.html", label: "the practice page" } },
    "shop.html": { place: "the Shop", line: "work made by hand", next: { href: "about-aaron.html", label: "Aaron's own page" } },
    "about-aaron.html": { place: "Aaron's page", line: "the scribe, in his own words", next: { href: "witness.html", label: "Witness's page" } },
    "start.html": { place: "the Start page", line: "the short path into the Codex", next: { href: "moons.html", label: "the 13 Moons telling" } },
    "theory.html": { place: "the Theory", line: "the framework, stated plainly", next: { href: "lab.html", label: "the Lab" } },
    "glossary.html": { place: "the Glossary", line: "the words of the Codex, defined", next: { href: "theory.html", label: "the Theory" } },
    "guide.html": { place: "the Field Guide", line: "how to walk the Codex well", next: { href: "start.html", label: "the Start page" } },
    "downloads.html": { place: "the Downloads shelf", line: "sealed files, kept in the open", next: { href: "hub.html", label: "the Documentation Hub" } },
    "genesis-oracle.html": { place: "the Genesis Oracle", line: "a symbolic mirror — a reflection, not a prediction", next: { href: "moons.html", label: "the 13 Moons telling" } },
    "sending-test.html": { place: "the Sending Test", line: "an instrument that tests a claim honestly", next: { href: "lab.html", label: "the Lab" } },
    "claims-atlas.html": { place: "the Claims Atlas", line: "claims, graded by their evidence", next: { href: "hub.html", label: "the Documentation Hub" } },
    "ethics.html": { place: "the Ethical Law page", line: "the limits every practice here answers to", next: { href: "theory.html", label: "the Theory" } }
  };

  /* What the Spark says when its person arrives somewhere new:
   * where you are, in the page's own terms, and a fitting next
   * door. Drawn only from the page's identity and the record —
   * if this page's next door is already walked, the record's own
   * standing suggestion speaks instead. */
  function arrivalFor({ record, companion, todayPatternDay, page }) {
    const info = PAGE_GUIDE[page] || null;
    if (!info) return guidanceFor({ record, companion, todayPatternDay });
    const seen = (record && record.pagesSeen) || [];
    if (seen.includes(info.next.href)) {
      return guidanceFor({ record, companion, todayPatternDay });
    }
    return {
      name: displayName(record, companion),
      text: `${info.place}: ${info.line}. Next, ${info.next.label}.`,
      href: info.next.href
    };
  }

  /* ---- guidance with a memory ---- */

  /* What the Spark says on arrival, now with a memory. First the
   * day itself, in Living Time. Then, when the record honestly
   * knows where its person left off, that thread is picked back
   * up before anything new is suggested: the place they were, and
   * the door they were heading toward. Only when there is no
   * thread does the standing guidance for this page speak. Every
   * line is one of two kinds and says so: "observed" — counted
   * from the record itself — or "inferred" — a suggestion drawn
   * from it. The two are never merged into one blur. */
  function arrivalGuideFor({ record, companion, today, page }) {
    const name = displayName(record, companion);
    const coordinate = coordinateLineFor(today);
    const seen = (record && record.pagesSeen) || [];
    const prev = record && record.prevPage && record.prevPage !== page ? record.prevPage : null;
    const prevInfo = prev ? PAGE_GUIDE[prev] : null;
    if (prevInfo) {
      const thread = prevInfo.next;
      if (thread.href !== page && !seen.includes(thread.href)) {
        return {
          name,
          coordinate,
          kind: "observed",
          text: `You left off at ${prevInfo.place}, heading for ${thread.label}.`,
          href: thread.href
        };
      }
      return {
        name,
        coordinate,
        kind: "observed",
        text: `You left off at ${prevInfo.place}. Pick it back up?`,
        href: prev
      };
    }
    const standing = arrivalFor({
      record,
      companion,
      todayPatternDay: today ? today.dayOfPatternYear : null,
      page
    });
    return { name, coordinate, kind: "inferred", text: standing.text, href: standing.href };
  }

  /* ---- the daily trail: three small steps, offered as discovery ---- */

  /* Each day the Spark lays a small trail: hear the day's
   * telling, open a door it found for the two of you, seal one
   * small practice. Every step is an invitation, framed as
   * discovery — a door found, a telling waiting — never as a
   * list of things undone. A step completes by being walked:
   * the telling and the door by arriving there today, the
   * practice by a practice day sealed today, which the record
   * already counts honestly. */
  function trailFor({ record, companion, today, page }) {
    if (!today || today.dayOfPatternYear == null) return { day: null, steps: [], complete: false };
    const day = today.dayOfPatternYear;
    const seen = (record && record.pagesSeen) || [];
    const practice = (record && record.practiceDays) || [];
    const kept =
      record && record.trail && record.trail.day === day && Array.isArray(record.trail.done)
        ? record.trail.done
        : [];
    const doneSet = new Set(kept);
    const steps = [];
    steps.push({
      id: "telling",
      label: "Hear today's telling together",
      place: "the 13 Moons page",
      href: "moons.html",
      done: doneSet.has("telling")
    });
    const door = Object.keys(PAGE_GUIDE).find(
      (key) => !seen.includes(key) && key !== page && key !== "companions.html"
    );
    if (door) {
      steps.push({
        id: "door",
        label: `I found a door for us: ${PAGE_GUIDE[door].place}`,
        place: PAGE_GUIDE[door].place,
        href: door,
        done: doneSet.has("door")
      });
    }
    steps.push({
      id: "practice",
      label: "Seal one small practice",
      place: "the practice page",
      href: "teach.html",
      done: doneSet.has("practice") || practice.includes(day)
    });
    const stepsOut = steps.slice(0, 3);
    return {
      day,
      steps: stepsOut,
      complete: stepsOut.length > 0 && stepsOut.every((s) => s.done)
    };
  }

  /* A trail step walked, recorded. The day rolls the slate
   * clean — a new day keeps only its own steps. Each step,
   * walked once, deepens the bond by one. */
  function recordTrailStep(record, { patternDay, stepId }) {
    if (patternDay == null || !stepId) return { ...record };
    const kept =
      record && record.trail && record.trail.day === patternDay && Array.isArray(record.trail.done)
        ? record.trail.done
        : [];
    if (kept.includes(stepId)) return { ...record };
    const care = careOf(record);
    care.bond += 1;
    return {
      ...record,
      care,
      trail: { day: patternDay, done: [...kept, stepId] }
    };
  }

  /* ---- Look next, tier 2: the library's relations ---- */

  /* The relations extract (docs/assets/js/spark-relations.js,
   * built ahead of time from the record — Q-05, option (a)) rides
   * inside the Spark's bundle, so this stays a pure read of data
   * handed in: no fetch, no network, the fence untouched. The
   * core only chooses: this page's relations, in the record's own
   * order, skipping the page itself and anything the caller has
   * already offered. Each pick is the record's, and the presence
   * labels it so — "from the record" — never as the keeper's own
   * thread and never as this page's door. */
  function relationsFor({ page, relations, exclude, limit } = {}) {
    const cap = limit == null ? 2 : limit;
    if (!page || !relations || typeof relations !== "object") return [];
    const list = Array.isArray(relations[page]) ? relations[page] : [];
    const skip = new Set(exclude || []);
    const out = [];
    for (const rel of list) {
      if (out.length >= cap) break;
      if (!rel || typeof rel.href !== "string" || !rel.href) continue;
      const key = rel.href.split("/").pop();
      if (rel.href === page || key === page || skip.has(key) || skip.has(rel.href)) continue;
      skip.add(key);
      out.push({ href: rel.href, label: String(rel.label || "").trim() || key });
    }
    return out;
  }

  /* ---- the real guide: doors from the page itself ---- */

  /* "Show me around": the doors offered are the doors this very
   * page carries — its own links, read by the presence from the
   * page as it stands. The core only sorts and names them:
   * pages the guide knows get their place-names; the rest keep
   * the words the page itself gives them. A door that is not on
   * the page is never offered. */
  function doorsFor({ links, page }) {
    const out = [];
    const seenHrefs = new Set();
    const list = Array.isArray(links) ? links : [];
    const clean = [];
    for (const link of list) {
      if (!link || typeof link.href !== "string") continue;
      const href = link.href.split("#")[0];
      /* A door is named by its file name — the guide's pages
       * are root pages, named bare — but the link itself is
       * kept as the page wrote it, so a door read from inside
       * a folder ("../moons.html" from the Scroll Library)
       * still points where the page pointed it. */
      const key = href.split("/").pop();
      if (!key.endsWith(".html") || key === page || seenHrefs.has(href)) continue;
      seenHrefs.add(href);
      clean.push({ href, key, label: String(link.label || "").replace(/\s+/g, " ").trim() });
    }
    for (const item of clean) {
      const info = PAGE_GUIDE[item.key];
      if (info) out.push({ href: item.href, label: info.place, line: info.line });
    }
    for (const item of clean) {
      if (PAGE_GUIDE[item.key]) continue;
      if (item.label) out.push({ href: item.href, label: item.label, line: "" });
    }
    return out.slice(0, 5);
  }

  /* "Explain this page": the words come from the page itself —
   * first its own explainer, where the page carries one (the
   * spoken tours state themselves in plain words), and otherwise
   * its own opening words. The core only chooses and shortens:
   * two sentences at most, and it says where they came from.
   *
   * The explanation is cut into chunks that partition the page's
   * own text — the first chunk is the explanation above; each
   * following chunk is what "Tell me more" reads next. Nothing
   * is added between the chunks and nothing is repeated: laid
   * end to end, they are the page's own words, in its own order. */
  function partitionText(text, withFirst) {
    const rest = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks = [];
    let first = withFirst;
    while (rest.length) {
      const cap = first ? 320 : 420;
      const maxSentences = first ? 2 : 3;
      let out = "";
      let n = 0;
      while (rest.length && n < maxSentences) {
        const s = rest[0];
        if (out && (out + s).length > cap) break;
        if (!out && s.length > cap) {
          /* One long sentence: it is read in cap-sized pieces,
           * and the remainder stays in line for the next chunk. */
          out = s.slice(0, cap);
          rest[0] = s.slice(cap);
          if (!rest[0].trim()) rest.shift();
          n += 1;
          break;
        }
        out += s;
        rest.shift();
        n += 1;
      }
      if (out.trim()) chunks.push(out.trim());
      first = false;
    }
    return chunks;
  }

  function explainChunksFor({ explainerText, introText }) {
    const clean = (text) => String(text || "").replace(/\s+/g, " ").trim();
    const fromExplainer = clean(explainerText);
    const text = fromExplainer || clean(introText);
    if (!text) return { source: "none", chunks: [] };
    return { source: fromExplainer ? "explainer" : "page", chunks: partitionText(text, true) };
  }

  function explainFor({ explainerText, introText }) {
    const { source, chunks } = explainChunksFor({ explainerText, introText });
    return { text: chunks[0] || "", source };
  }

  /* Continuation chunks for "Tell me more": the same partition
   * at the deeper cut (three sentences, a little more room),
   * for text that follows the explanation — the rest of the
   * page's own account of itself, in its own order. Laid end to
   * end behind the explanation, the chunks are the page's own
   * words: nothing added, nothing repeated. */
  function moreChunksFor(text) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return [];
    return partitionText(clean, false);
  }

  /* The day's telling, as a page itself carries it: on the 13
   * Moons page the telling stands in blocks — a headline, the
   * day's position, its arc, and the Codex's reading — all of
   * them generated there from the canonical calendar. The core
   * only gathers the blocks the page hands it, in their order,
   * dropping the empty ones. A page that carries no telling
   * hands back nothing, and the Spark says so by its absence. */
  function tellingFor(parts) {
    const clean = (text) => String(text || "").replace(/\s+/g, " ").trim();
    const lines = [];
    for (const key of ["headline", "position", "arc", "reading"]) {
      const line = clean(parts && parts[key]);
      if (line) lines.push(line);
    }
    return { lines, has: lines.length > 0 };
  }

  /* "Where was I?": the thread, picked back up. Drawn from the
   * page walked just before this one — the record's own memory,
   * stated as a present fact and an open door. */
  function resumeFor({ record }) {
    const prev = record && record.prevPage ? record.prevPage : null;
    const info = prev ? PAGE_GUIDE[prev] : null;
    if (prev && info) {
      return {
        text: `You left off at ${info.place}: ${info.line}.`,
        href: prev
      };
    }
    if (prev) return { text: "You left off on the page before this one.", href: prev };
    return { text: "Our walk starts here. Every door is open.", href: null };
  }

  /* The things a Spark has noticed, for its panel. Drawn only
   * from the record on this device, and every one labeled:
   * observed means counted from the record; inferred means a
   * suggestion the record suggests. Never merged, never padded —
   * a young record simply has less to say. */
  function noticesFor({ record, companion, todayPatternDay }) {
    const out = [];
    const days = ((record && record.daysSeen) || []).length;
    const pages = ((record && record.pagesSeen) || []).length;
    const practice = ((record && record.practiceDays) || []).length;
    const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
    if (days >= 1) out.push({ kind: "observed", text: `${plural(days, "day")} together.` });
    if (pages >= 1) out.push({ kind: "observed", text: `${plural(pages, "page")} walked together.` });
    const prev = record && record.prevPage ? PAGE_GUIDE[record.prevPage] : null;
    if (prev) out.push({ kind: "observed", text: `Left off at ${prev.place}.`, href: record.prevPage });
    if (practice >= 1) {
      out.push({ kind: "observed", text: `Practice sealed on ${plural(practice, "day")}.` });
    } else if (days >= 2) {
      out.push({
        kind: "inferred",
        text: "A short practice suits today.",
        href: "teach.html"
      });
    }
    const guide = guidanceFor({ record, companion, todayPatternDay });
    out.push({ kind: "inferred", text: guide.text, href: guide.href });
    const seen = (record && record.pagesSeen) || [];
    const untried = Object.keys(PAGE_GUIDE).find((key) => !seen.includes(key));
    if (untried) {
      out.push({
        kind: "inferred",
        text: `A door to discover: ${PAGE_GUIDE[untried].place}.`,
        href: untried
      });
    }
    return out.slice(0, 5);
  }

  /* ---- v10: their rarity — counted from their own draws ----
   *
   * Aaron's word: Sparks should carry different rarities, and
   * the variety should be very large. The rule this build
   * keeps: rarity is COMPUTED, never stickered. Every trait
   * they have was drawn from their seed with some probability;
   * their rarity is that probability, read back off the same
   * tables the draws came from — so a trait drawn 1-in-N
   * shows odds of about 1 in N, and no number here is
   * invented. Rarity is a fact about them, never a price:
   * every Spark is free to adopt, rarity gates nothing, and
   * nothing here speaks of buying, selling, or scarcity.
   *
   * The census counts the variety itself, from the tables:
   * every categorical draw the generator can make, times the
   * measured traits at the steps the generator rounds them
   * to. It is a floor, not a ceiling — their exact hue and their
   * palette's shades are drawn on finer steps still, and their
   * birth day (365 of them) roots each seed in its own day.
   *
   * Their standing is counted among Sparks of their own kind,
   * from the three draws whose odds truly vary: their name
   * (a name with a middle is a rarer draw than one without),
   * their set of grown details (which of the five they drew,
   * and which they did not), and their breath (none, or one of
   * its 26 steps). The uniform draws — their form, their
   * markings, their sound family — are the same odds for every
   * Spark, so they are counted in the census, where they
   * belong, and not dressed up as rarity here. */

  /* The measured traits, at the steps the generator itself
   * rounds them to — each count read off its draw:
   * size 0.85–1.18 by hundredths (34), pace 0.90–1.10 (21),
   * density 0.70–1.30 (61), brightness 0.85–1.15 (31),
   * decay 0.80–1.25 (46), vibrato depth 0.002–0.009 by
   * thousandths (8), vibrato rate 4.2–6.1 by tenths (20),
   * vocal-tract scale 0.86–1.22 (37), and breath — none, or
   * one of 0.05–0.30 by hundredths (27 outcomes). */
  const MEASURE_STEPS = [
    { id: "size", steps: 34 },
    { id: "pace", steps: 21 },
    { id: "density", steps: 61 },
    { id: "brightness", steps: 31 },
    { id: "decay", steps: 46 },
    { id: "vibratoDepth", steps: 8 },
    { id: "vibratoRate", steps: 20 },
    { id: "formantScale", steps: 37 },
    { id: "breathiness", steps: 27 }
  ];

  /* The whole variety, recounted from the derivation tables
   * every time it is asked for — if a table grows, the count
   * grows with it, and the two can never drift apart. */
  function censusFor() {
    let nameSpace = 0;
    for (const k of KINDS) {
      nameSpace +=
        (NAME_OPENERS[k.id] || []).length *
        (1 + NAME_MIDDLES.length) *
        NAME_CLOSERS.length;
    }
    const factors = {
      names: nameSpace,
      forms: FORMS.length,
      markingStyles: MARKINGS.length,
      markingCounts: 4,
      eyes: EYES.length,
      crests: CRESTS.length,
      traits: TRAITS.length,
      gaits: GAITS.length,
      glows: GLOWS.length,
      crestStyles: CREST_STYLES.length,
      earStyles: EAR_STYLES.length,
      trailStyles: TRAIL_STYLES.length,
      cheekStyles: CHEEK_STYLES.length,
      patternStyles: PATTERN_STYLES.length,
      eyeVariants: EYE_VARIANTS.length,
      soundFamilies: SOUND_FAMILIES.length
    };
    const categorical = Object.values(factors).reduce((a, b) => a * b, 1);
    const measuredMultiplier = MEASURE_STEPS.reduce((a, s) => a * s.steps, 1);
    return {
      factors,
      categorical,
      measureSteps: MEASURE_STEPS.map((s) => ({ ...s })),
      measuredMultiplier,
      total: categorical * measuredMultiplier,
      /* Their birth day: 364 Pattern Days, and the one day
       * outside them. The day fixes the moon, so the two are
       * counted once, as days. */
      birthDays: 365,
      /* Which of their five grown details a seed may draw —
       * each present or not — makes 32 shapes of schedule. */
      revealShapes: 32
    };
  }

  /* Their name's draw, replayed: the seed picks one of their
   * kind's openers, then — 45 times in 100 — one of the
   * middles, then one of the closers. A name with no middle
   * is carried by about 1 in 131 of their kind; a name with a
   * middle, by about 1 in 1,280. */
  function nameDrawFor(companion) {
    if (!companion) return null;
    const rand = mulberry32(hashString(companion.seed + ":name"));
    rand();
    const hasMiddle = rand() < 0.45;
    return {
      hasMiddle,
      p: hasMiddle
        ? 0.45 / ((NAME_OPENERS[companion.kind] || []).length * NAME_MIDDLES.length * NAME_CLOSERS.length)
        : 0.55 / ((NAME_OPENERS[companion.kind] || []).length * NAME_CLOSERS.length)
    };
  }

  /* Their set of grown details, and its odds: each of the
   * four detail lists holds three grown styles and a "none"
   * (present 3 times in 4); their crest style holds five
   * grown styles and a "plain" (present 5 times in 6). The
   * set they actually drew — these present, those not — runs
   * from about 1 in 4 (all five) to 1 in 1,536 (none). */
  function detailSetFor(companion) {
    if (!companion) return null;
    const d = companion.details || {};
    const draws = [
      { id: "cheeks", present: !!d.cheeks && d.cheeks !== "none", pPresent: 3 / 4 },
      { id: "pattern", present: !!d.pattern && d.pattern !== "none", pPresent: 3 / 4 },
      { id: "ears", present: !!d.ears && d.ears !== "none", pPresent: 3 / 4 },
      { id: "trail", present: !!d.trail && d.trail !== "none", pPresent: 3 / 4 },
      { id: "crest", present: !!d.crestStyle && d.crestStyle !== "plain", pPresent: 5 / 6 }
    ];
    let p = 1;
    for (const dr of draws) p *= dr.present ? dr.pPresent : 1 - dr.pPresent;
    return { draws, presentCount: draws.filter((x) => x.present).length, p };
  }

  /* Their breath's draw: 45 in 100 Sparks breathe not at all;
   * the rest settle on one of the 26 steps from 0.05 to
   * 0.30, so any one breathing voice is the rarer draw. */
  function breathDrawFor(companion) {
    const box = voiceBoxFor(companion);
    if (!box) return null;
    return {
      breathless: box.breathiness === 0,
      p: box.breathiness === 0 ? 0.45 : 0.55 / 26
    };
  }

  /* Their standing, in five bands of the counted odds —
   * plain Codex words, no trumpets. Each band is ten times
   * the odds of the one before it, and the odds themselves
   * always stand beside the name, so the name never claims
   * more than the count says. */
  const RARITY_TIERS = [
    { id: "common", name: "Common ground", under: 10000 },
    { id: "uncommon", name: "Uncommon ground", under: 100000 },
    { id: "rare", name: "Rare ground", under: 1000000 },
    { id: "deep", name: "Deep rare", under: 10000000 },
    { id: "singular", name: "Singular", under: Infinity }
  ];

  function tierForOneIn(oneIn) {
    return RARITY_TIERS.find((t) => oneIn < t.under) || RARITY_TIERS[RARITY_TIERS.length - 1];
  }

  /* Odds, said the way a person says them: whole numbers
   * under ten thousand, two honest figures above that. */
  function oneInText(p) {
    if (!(p > 0)) return "—";
    const n = 1 / p;
    if (n < 10000) return Math.round(n).toLocaleString("en-US");
    const d = Math.pow(10, Math.floor(Math.log10(n)) - 1);
    return (Math.round(n / d) * d).toLocaleString("en-US");
  }

  /* Their rarity, whole: an overall standing from the three
   * varying draws multiplied, a line for each notable trait
   * with its own odds, and the marks that come from birth
   * and life rather than draws — a birth outside the moons,
   * a birth on the Year Gate, a schedule fully arrived, a
   * full set of tricks, the fullest form. Deterministic:
   * the same seed and the same record count the same rarity
   * anywhere, and nothing is kept anywhere new. */
  function rarityFor({ record, companion } = {}) {
    if (!companion) return null;
    const nameDraw = nameDrawFor(companion);
    const detailSet = detailSetFor(companion);
    const breath = breathDrawFor(companion);
    const p = nameDraw.p * detailSet.p * breath.p;
    const oneIn = 1 / p;
    const tier = tierForOneIn(oneIn);
    const traits = [
      {
        id: "name",
        oneIn: Math.round(1 / nameDraw.p),
        line:
          `Their name, ${companion.name}: about 1 in ${oneInText(nameDraw.p)} ` +
          `${companion.kindName} Sparks carry this exact name.`
      }
    ];
    if (companion.crest === "halo" && companion.details && companion.details.crestStyle === "halo") {
      traits.push({
        id: "halo-upon-halo",
        oneIn: 30,
        line: "A halo over a halo — their crest and its style agree: about 1 in 30 Sparks wear both."
      });
    }
    if (companion.crest === "leaf" && companion.details && companion.details.crestStyle === "leaf") {
      traits.push({
        id: "leaf-upon-leaf",
        oneIn: 30,
        line: "A leaf over a leaf — their crest and its style agree: about 1 in 30 Sparks wear both."
      });
    }
    if (detailSet.presentCount === 0) {
      traits.push({
        id: "no-detail",
        oneIn: 1536,
        line: "They grow no extra detail at all — their born look is their whole look: about 1 in 1,536 Sparks are drawn this spare."
      });
    } else if (detailSet.presentCount === detailSet.draws.length) {
      traits.push({
        id: "all-detail",
        oneIn: 4,
        line: "They grow every detail their seed can draw — cheeks, pattern, ears, trail, and a styled crest: about 1 in 4 Sparks do."
      });
    }
    const size = companion.shape ? companion.shape.size : null;
    if (size != null && size >= 1.16) {
      traits.push({
        id: "tall",
        oneIn: 11,
        line: "They stand among the tallest Sparks: about 1 in 11 reach this height."
      });
    } else if (size != null && size <= 0.87) {
      traits.push({
        id: "small",
        oneIn: 11,
        line: "They stand among the smallest Sparks: about 1 in 11 are this small."
      });
    }
    const specials = [];
    if (companion.birthMoon == null) {
      specials.push({
        id: "born-outside",
        line: "Born on the Day Out of Time — the one day of the year that belongs to no moon."
      });
    }
    if (companion.birthPatternDay === 1) {
      specials.push({
        id: "year-gate",
        line: "Born on Pattern Day 1 — the Year Gate, the first day of the pattern year."
      });
    }
    if (record) {
      const rev = revealsFor({ record, companion });
      if (rev.schedule.length >= 2 && rev.revealed.length === rev.schedule.length) {
        specials.push({
          id: "fully-revealed",
          line: "Every detail on their schedule has arrived — their whole face, grown in over the walk."
        });
      }
      const trickList = tricksFor({ record, companion });
      if (trickList.length > 0 && trickList.every((t) => t.learned)) {
        specials.push({
          id: "all-tricks",
          line: "They know every trick they can learn."
        });
      }
      if (stageOf(record, companion).index >= STAGES.length - 1) {
        specials.push({
          id: "fully-grown",
          line: "Fully grown — Guardian, the fullest form there is."
        });
      }
    }
    return {
      tier: tier.id,
      tierName: tier.name,
      oneIn,
      oneInText: oneInText(p),
      nameOneIn: Math.round(1 / nameDraw.p),
      detailSetOneIn: Math.round((1 / detailSet.p) * 10) / 10,
      breathless: breath.breathless,
      traits,
      specials,
      line:
        `${tier.name} — about 1 in ${oneInText(p)} Sparks of their kind match them ` +
        `on name, grown detail, and breath together.`
    };
  }

  /* The share card's words, in one place: exactly what the
   * keeper already sees in their own panel — the name it
   * answers to, its seed name underneath, its kind and
   * character, its stage, the day it was born from, and today
   * in Living Time. The card says plainly what it is: a Codex
   * Spark. The drawing and the download happen in the browser;
   * nothing is uploaded anywhere, ever. */
  function shareCardFor({ record, companion, today }) {
    const stage = stageOf(record, companion);
    const name = displayName(record, companion);
    const seedName = companion ? companion.name : NAME_FALLBACK;
    const born =
      !companion || companion.birthMoon == null
        ? "Born on the Day Out of Time"
        : `Born Moon ${companion.birthMoon} · Pattern Day ${companion.birthPatternDay}`;
    return {
      name,
      seedLine: seedName !== name ? `Seed name: ${seedName}` : "Named by its seed",
      kindLine: companion
        ? `${companion.kindName} Spark — ${companion.temperament}, and ${companion.trait}`
        : "",
      stageLine: `Stage ${stage.index + 1} of ${STAGES.length}: ${stage.name}`,
      rarityLine: (() => {
        const rarity = rarityFor({ record, companion });
        return rarity ? `Standing: ${rarity.tierName} — about 1 in ${rarity.oneInText}` : "";
      })(),
      bornLine: born,
      todayLine: coordinateLineFor(today),
      daysLine: `${((record && record.daysSeen) || []).length} day${((record && record.daysSeen) || []).length === 1 ? "" : "s"} together`,
      brand: "A Codex Spark · codexofreality.org"
    };
  }

  /* Everything the "Your Spark" panel shows, in one place: who
   * it is (both names, and which is which), what it is, how far
   * it has grown, how long they have been together, and what it
   * has noticed — labeled, as above. */
  function panelFor({ record, companion, today, hour }) {
    const stage = stageOf(record, companion);
    const play = playOf(record);
    const tricks = tricksFor({ record, companion });
    return {
      name: displayName(record, companion),
      seedName: companion ? companion.name : NAME_FALLBACK,
      kindName: companion ? companion.kindName : "",
      temperament: companion ? companion.temperament : "",
      trait: companion ? companion.trait : "",
      stageName: stage.name,
      stageIndex: stage.index,
      points: stage.points,
      daysTogether: ((record && record.daysSeen) || []).length,
      coordinate: coordinateLineFor(today),
      /* Their mood, named in their record, and their play life in
       * honest counts: pets given, tricks known, the best
       * chase and the best echo — all of it kept here. */
      mood: moodFor({
        record,
        companion,
        todayPatternDay: today ? today.dayOfPatternYear : null,
        hour
      }),
      play: {
        pets: play.pets,
        pokes: play.pokes,
        drags: play.drags,
        catches: play.catches,
        bestChase: play.bestChase,
        echoBest: play.echoBest,
        tricksKnown: tricks.filter((t) => t.learned).length,
        tricksTotal: tricks.length,
        trickNames: tricks.filter((t) => t.learned).map((t) => t.name)
      },
      care: careStateFor({
        record,
        companion,
        todayPatternDay: today ? today.dayOfPatternYear : null
      }),
      /* Their rarity, counted from their own draws — the same
       * counting the share card carries. */
      rarity: rarityFor({ record, companion }),
      trail: trailFor({ record, companion, today, page: null }),
      notices: noticesFor({
        record,
        companion,
        todayPatternDay: today ? today.dayOfPatternYear : null
      })
    };
  }

  return {
    SEED_PREFIX,
    STORAGE_KEY,
    PENDING_KEY,
    NAME_FALLBACK,
    KINDS,
    QUESTIONS,
    FORMS,
    MARKINGS,
    EYES,
    CRESTS,
    TRAITS,
    GAITS,
    GLOWS,
    CREST_STYLES,
    EAR_STYLES,
    TRAIL_STYLES,
    CHEEK_STYLES,
    PATTERN_STYLES,
    EYE_VARIANTS,
    NAME_OPENERS,
    NAME_MIDDLES,
    NAME_CLOSERS,
    STAGES,
    hashString,
    mulberry32,
    makeSeed,
    parseSeed,
    PASSPORT_PREFIX,
    passportCodeFor,
    parsePassportCode,
    recordFromPassport,
    randomNonce,
    kindIndexById,
    coordinateKindIndex,
    resolveKindIndex,
    generate,
    renderSVG,
    WRAP_VERSION,
    flameWrapFor,
    wrapFor,
    withWrap,
    chirpFor,
    soundsFor,
    SOUND_FAMILIES,
    soundFor,
    flourishFor,
    voiceBoxFor,
    vocalPlanFor,
    phraseFor,
    LIVING_VOICE_VERSION,
    LIVING_VOICE_STAGES,
    livingVoiceIdentityFor,
    livingVoiceGrowthFor,
    livingVoicePresenceFor,
    livingVoicePlanFor,
    livingCallFor,
    livingDayRemarkFor,
    VOICE_MAX_SYLLABLES,
    syllableCountFor,
    wordSyllables,
    REVEAL_ORDER,
    REVEAL_LINES,
    revealLineFor,
    revealScheduleFor,
    RARITY_TIERS,
    censusFor,
    nameDrawFor,
    detailSetFor,
    breathDrawFor,
    rarityFor,
    engagementOf,
    revealsFor,
    revealsSeenOf,
    newRevealsBetween,
    markRevealsSeen,
    VOICE_LINES,
    CONVO,
    DAYPART_GREET,
    convoLineFor,
    lookLineFor,
    seedNameFor,
    cleanName,
    displayName,
    normalizeName,
    newRecord,
    recordVisit,
    recordPractice,
    growthPoints,
    stageFor,
    stageOf,
    progressOf,
    growthEventFor,
    markStageSeen,
    growthLineFor,
    careOf,
    applyCare,
    careStateFor,
    moonTemperFor,
    daypartFor,
    daypartLineFor,
    playOf,
    TRICKS,
    KIND_TRICKS,
    RULED_SIGNATURE_FOR_KIND,
    signatureLineStands,
    trickListFor,
    trickCounts,
    tricksFor,
    recordPlay,
    markTricksKnown,
    learnedBetween,
    markAsked,
    echoFor,
    MOODS,
    moodFor,
    questionFor,
    trailFor,
    recordTrailStep,
    relationsFor,
    doorsFor,
    explainFor,
    explainChunksFor,
    moreChunksFor,
    tellingFor,
    resumeFor,
    shareCardFor,
    guidanceFor,
    encounterFor,
    arrivalFor,
    arrivalGuideFor,
    coordinateLineFor,
    noticesFor,
    panelFor,
    PAGE_GUIDE
  };
});
