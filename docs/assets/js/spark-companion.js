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

  /* Her spoken voice, when the keeper turns it on: the device's
   * own speech synthesis, tuned by the same seed that pitches
   * her chirp — so the voice and the chirp feel like one
   * creature. The pitch follows the chirp's base note (a high
   * kind chirps high and speaks high; a low kind speaks low),
   * and the pace is its temperament's own: bold and bright a
   * touch quicker, gentle a touch slower. Pure data — the same
   * seed settles the same voice on any device. */
  const VOICE_RATES = { bold: 1.05, gentle: 0.93, quiet: 0.95, curious: 1.03, steady: 0.97, bright: 1.06 };

  function voiceFor(companion) {
    if (!companion) return null;
    const chirp = chirpFor(companion);
    if (!chirp) return null;
    /* Chirp bases run from Earth's ~282 to Light's ~806. The
     * speech pitch scale runs 0.5–2 with 1 as the device's own
     * middle; her range sits inside it, 0.79–1.26. */
    const pitch = Math.min(
      1.3,
      Math.max(0.75, Math.round((0.79 + ((chirp.first - 282) / (806 - 282)) * 0.47) * 100) / 100)
    );
    const rand = mulberry32(hashString(companion.seed + ":speech"));
    const base = VOICE_RATES[companion.temperament] || 1;
    const rate = Math.round(base * (0.98 + rand() * 0.04) * 100) / 100;
    return { pitch, rate };
  }

  /* Which of the device's voices she speaks with, in a stated
   * order: a warm named en-US voice first (on a typical
   * Android/Chrome that is "Google US English"; on Apple
   * devices, Samantha and her named kin), then any en-US voice,
   * then any English voice, then the device's own default.
   * The list is the device's; the choice is deterministic. */
  function pickVoice(voices) {
    if (!Array.isArray(voices) || !voices.length) return null;
    const score = (v) => {
      const name = String((v && v.name) || "");
      const lang = String((v && v.lang) || "").toLowerCase();
      const enUS = lang === "en-us";
      if (enUS && /google us english/i.test(name)) return 6;
      if (enUS && /natural|neural/i.test(name)) return 5;
      if (enUS && /samantha|zira|aria|jenny/i.test(name)) return 4;
      if (enUS) return 3;
      if (lang.startsWith("en")) return 2;
      if (v && v.default) return 1;
      return 0;
    };
    let best = null;
    let bestScore = -1;
    for (const v of voices) {
      const s = score(v);
      if (s > bestScore) {
        bestScore = s;
        best = v;
      }
    }
    return best;
  }

  /* What she actually says aloud from a line: the opening,
   * whole sentences only, up to a sane length. The full line
   * always stands in the talk in text; the voice takes the
   * beginning of it, the way a person starts a thought aloud. */
  function speechTextFor(text, maxChars = 280) {
    const clean = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    if (!clean) return "";
    if (clean.length <= maxChars) return clean;
    const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
    let out = "";
    for (const s of sentences) {
      if ((out + s).length > maxChars) break;
      out += s;
    }
    if (!out) out = clean.slice(0, maxChars);
    return out.trim();
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
      bold: ["There you are. I have been waiting to show you something good.", "Back again — good. The day is young and the doors are open."],
      gentle: ["Hello again. I kept your place, right where you left it.", "Welcome back. We can go slowly, together."],
      quiet: ["You came back. I saved the quiet corner for us.", "Hello. I was watching the page, thinking of you."],
      curious: ["Oh, good, you are here — I found things to wonder at on this page.", "You are back! I have questions about this place already."],
      steady: ["Good to see you. Same path, onward together.", "Here we are again. One step, then the next."],
      bright: ["You are here! The whole page just got brighter.", "Hello, hello — what a good day to be found in."]
    },
    welcome: {
      bold: ["Still here. What shall we do?"],
      gentle: ["I kept your place. Shall we go on?"],
      quiet: ["Still here, quietly. Shall we go on?"],
      curious: ["Still here, still curious. What shall we do?"],
      steady: ["Still here. Onward, when you are ready."],
      bright: ["Still here, still shining. What shall we do?"]
    },
    ask: {
      bold: ["Shall I show you around, explain this page, or shall we play?"],
      gentle: ["What would you like? I can show you around, explain this page, or we can simply play."],
      quiet: ["Shall I show you around, explain this page, or shall we play a quiet chase?"],
      curious: ["Shall I show you around, explain this page, or shall we play? I vote all three, in that order."],
      steady: ["Shall I show you around, explain this page, or shall we play?"],
      bright: ["Shall I show you around, explain this page, or shall we play?"]
    },
    next: {
      bold: ["What next — around, an explanation, care, or play?"],
      gentle: ["And now? I can show you around, explain, offer care, or play."],
      quiet: ["What next, softly? Around, an explanation, care, or play."],
      curious: ["What next? Around, an explanation, care, or play — I am ready for any of them."],
      steady: ["Next step: around, an explanation, care, or play."],
      bright: ["What next? Around, an explanation, care, or play!"]
    },
    kindle: {
      bold: ["Warm. Right down to my spark. Again sometime."],
      gentle: ["Oh, that is warm. Thank you — I will carry that glow a while."],
      quiet: ["Warmth, quietly kept. Thank you."],
      curious: ["Warm! Did you see the glow change? I felt it everywhere."],
      steady: ["Warm and steady. That is the good kind of fire."],
      bright: ["You kindled me! I am shining — look, shining."]
    },
    play: {
      bold: ["Catch me if you can. I am quicker than I look."],
      gentle: ["A gentle chase, then — I will dart, and wait, and dart again."],
      quiet: ["Chase me softly. I will be listening for your steps."],
      curious: ["A chase! I have already picked my hiding corners."],
      steady: ["The chase, then. I will run honest laps."],
      bright: ["Play! Catch me, catch me — I am all sparks."]
    },
    caught: {
      bold: ["Caught, and caught, and caught. You are faster than you look, too."],
      gentle: ["Caught every time, and glad of it. What a lovely chase."],
      quiet: ["Caught. I was hoping you would find me each time."],
      curious: ["Caught! Every corner, found. Your eyes are quick."],
      steady: ["Caught, fair and square. Good chase, well run."],
      bright: ["Caught! All that running made me glow brighter."]
    },
    rest: {
      bold: ["Resting, then. Even sparks bank their fire."],
      gentle: ["Rest now. I will breathe slowly, right here beside you."],
      quiet: ["Rest. I will keep the quiet with you."],
      curious: ["Resting — but my ears stay curious. Wake me with a tap."],
      steady: ["Rest. I will be right here when you come back to me."],
      bright: ["A little rest to gather my shine. Tap me when you are ready."]
    },
    care: {
      bold: ["Tend me, then. Kindle me, play with me, or let me rest."],
      gentle: ["A little care goes a long way with me. Kindle, play, or rest — you choose."],
      quiet: ["Care, in small ways: kindle me, play softly, or let me rest."],
      curious: ["Care time! Kindle me and watch the glow, play a chase, or let me rest."],
      steady: ["Care is a rhythm: kindle, play, rest. Pick the beat."],
      bright: ["Care for me! Kindle, play, or rest — every one makes me shine."]
    },
    around: {
      bold: ["Doors from this very page — pick one and I will come with you:"],
      gentle: ["Here are the doors this page itself offers. Pick one, and I will walk it with you:"],
      quiet: ["The doors on this page, quietly listed. Pick one:"],
      curious: ["Doors! Every one of them is really on this page. Pick one:"],
      steady: ["The doors this page carries, in its own order. Pick one:"],
      bright: ["Look at all these doors, right here on this page. Pick one:"]
    },
    explain: {
      bold: ["Here is what this page says about itself, in its own words:"],
      gentle: ["This page explains itself better than I could. In its own words:"],
      quiet: ["The page's own words about itself:"],
      curious: ["I read the page's own explainer. Here it is, in its words:"],
      steady: ["Straight from the page itself:"],
      bright: ["The page speaks for itself — listen:"]
    },
    more: {
      bold: ["More, then — the page goes on, in its own words:"],
      gentle: ["Here is more of it, in the page's own words:"],
      quiet: ["More, quietly — the page's own words:"],
      curious: ["More! The page has more to say, in its own words:"],
      steady: ["More of the page, in its own words:"],
      bright: ["More! In the page's own words:"]
    },
    telling: {
      bold: ["The day's telling — here it is, as this page carries it:"],
      gentle: ["Here is the day's telling, as this page carries it:"],
      quiet: ["The day's telling, as this page carries it:"],
      curious: ["The day's telling! This page carries it — listen:"],
      steady: ["The day's telling, as this page carries it:"],
      bright: ["The day's telling — this page carries it, and it shines:"]
    },
    today: {
      bold: ["Today, counted the Codex way:"],
      gentle: ["Here is today, in Living Time:"],
      quiet: ["Today, quietly counted:"],
      curious: ["Today is a good one. Counted the Codex way:"],
      steady: ["Today, on the one calendar:"],
      bright: ["Today! Counted in Living Time:"]
    },
    trail: {
      bold: ["Today's trail — small steps, all of them worth it:"],
      gentle: ["Today's trail, offered softly. Small steps, walked together:"],
      quiet: ["Today's trail. Small steps, quietly offered:"],
      curious: ["A trail for today! Small steps, real discoveries:"],
      steady: ["Today's trail — one step at a time:"],
      bright: ["Today's trail! Small steps that sparkle:"]
    },
    share: {
      bold: ["Your portrait card is ready — drawn here, yours to post anywhere."],
      gentle: ["I made your portrait card, right here on your device. It is yours to share wherever you choose."],
      quiet: ["A portrait card, made quietly on this device. Yours to post, or to keep."],
      curious: ["A portrait card! Drawn here from my seed — yours to post anywhere."],
      steady: ["Your portrait card is drawn and saved. Yours to share as you see fit."],
      bright: ["Your portrait card! Made here, shining, and yours to post anywhere."]
    },
    record: {
      bold: ["My record, kept on this device — every day of it:"],
      gentle: ["Here is my record, kept only on this device:"],
      quiet: ["My record, kept quietly here:"],
      curious: ["My record! Every fact lives on this device:"],
      steady: ["The record, as it stands, kept on this device:"],
      bright: ["My record — kept right here on your device:"]
    },
    resume: {
      bold: ["Where you left off:"],
      gentle: ["Here is where you left off:"],
      quiet: ["Where you left off, kept for you:"],
      curious: ["I remember where you left off:"],
      steady: ["Your place, kept:"],
      bright: ["Your place, right where you left it:"]
    },
    bye: {
      bold: ["I will walk beside you. Tap me when you want me."],
      gentle: ["I will be right here, walking with you. Tap me anytime."],
      quiet: ["I will keep to the corner, quietly yours. Tap me when you like."],
      curious: ["I will be exploring the edges. Tap me — I will come running."],
      steady: ["Right here, as ever. Tap me when you need me."],
      bright: ["I will shine in the corner until you tap me again."]
    },
    pet: {
      bold: ["Ha — right there. You found the warm spot."],
      gentle: ["Ohh. That is the spot. Stay a moment."],
      quiet: ["Warm hands. I lean in, quietly."],
      curious: ["Petting registered — my glow approves, thoroughly."],
      steady: ["Good hands. Steady and kind."],
      bright: ["Yes! Petting! My whole halo felt that."]
    },
    poke: {
      bold: ["Hey! A poke — I felt that one."],
      gentle: ["Oh! A gentle poke. I am awake, I promise."],
      quiet: ["A poke, felt softly. I see you."],
      curious: ["Poked! Noted, logged, and enjoyed."],
      steady: ["A poke. Fair enough — I am here."],
      bright: ["Poke! That tickles my light."]
    },
    tricks: {
      bold: ["My tricks — the ones play has taught me. Tap one and watch:"],
      gentle: ["These are my tricks, learned from playing with you. Tap one:"],
      quiet: ["My tricks, quietly kept. Tap one and I will show you:"],
      curious: ["Tricks! Every one of them learned from real play. Tap one:"],
      steady: ["My tricks, each one earned in play. Tap one:"],
      bright: ["My tricks! Learned from playing with you — tap one:"]
    },
    learned: {
      bold: ["I learned a new trick! Watch this —"],
      gentle: ["Oh! I just learned something new. Let me show you —"],
      quiet: ["Something new settled into me. Watch —"],
      curious: ["New trick learned! My paws figured it out —"],
      steady: ["A new trick, earned the slow way. Here it is —"],
      bright: ["I learned a trick! A real one! Watch —"]
    },
    trick: {
      bold: ["Did you see? Clean as a whistle."],
      gentle: ["There it is. Softly done."],
      quiet: ["Shown, quietly."],
      curious: ["Ta-da! The physics of me, demonstrated."],
      steady: ["There. Practised and true."],
      bright: ["Ta-da! Shining, as promised."]
    },
    echoStart: {
      bold: ["The echo game: I pulse a pattern — notes and colours. Play it back to me, tap for tap."],
      gentle: ["The echo game. I will sing a small pattern; sing it back by tapping my colours."],
      quiet: ["The echo game, softly: my pattern, then yours, tap by tap."],
      curious: ["The echo game! Memory, music, colours — my pattern first, then yours."],
      steady: ["The echo game. I set the pattern; you walk it back, step by step."],
      bright: ["The echo game! I shine a pattern — shine it back to me!"]
    },
    echoWin: {
      bold: ["Round echoed, clean and true!"],
      gentle: ["You echoed it back, every note. Lovely."],
      quiet: ["Echoed, softly and exactly."],
      curious: ["A perfect echo! Your memory sings."],
      steady: ["Round walked back, steady and true."],
      bright: ["A shining echo! Every colour in its place!"]
    },
    echoMiss: {
      bold: ["That note went another way — the round rests here, kindly."],
      gentle: ["The pattern slipped to one side. The round rests — your best stands."],
      quiet: ["A different note sounded. The round rests, softly."],
      curious: ["A surprise note! The round rests here — patterns love a second try."],
      steady: ["One note astray. The round rests; what you reached stands."],
      bright: ["A note went wandering! The round rests — your best still shines."]
    },
    sealed: {
      bold: ["Sealed! I felt that land. Well practised."],
      gentle: ["A practice, sealed. I glow a little for that."],
      quiet: ["Sealed, and kept. I saw it land."],
      curious: ["A seal! The day just gained a mark — I saw it happen."],
      steady: ["Sealed. Another true mark on the day."],
      bright: ["Sealed! The day is shining brighter for it!"]
    },
    saved: {
      bold: ["Saved to the record. Kept, and witnessed."],
      gentle: ["Saved. Your words are kept — I was here for it."],
      quiet: ["Saved, quietly. The record holds it now."],
      curious: ["Saved! Another true thing in the record."],
      steady: ["Saved. The record stands a little taller."],
      bright: ["Saved! The record shines with it!"]
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
   * hello, in her temperament's voice — morning's light, the
   * day's middle, evening gathering in, the late hours kept
   * close. The day itself is still counted by the calendar;
   * this only names the hour she greets you in. */
  function daypartFor(hour) {
    const h = Number.isFinite(hour) ? Math.floor(hour) : 12;
    if (h >= 5 && h < 11) return "morning";
    if (h >= 11 && h < 17) return "day";
    if (h >= 17 && h < 22) return "evening";
    return "night";
  }

  const DAYPART_GREET = {
    morning: {
      bold: "Morning! The light is new and so are we.",
      gentle: "Good morning. The light is soft, and I kept your place.",
      quiet: "Morning, quietly. I watched the light come in.",
      curious: "Morning! A fresh page of hours — I have questions already.",
      steady: "Good morning. Same path, new light.",
      bright: "Morning! You found me shining already."
    },
    day: {
      bold: "The day is wide open. Good timing.",
      gentle: "Hello, in the middle of the day. A calm hour to walk.",
      quiet: "Hello. The day hums along, and I hum with it.",
      curious: "Hello! The day is full of doors at this hour.",
      steady: "Hello. The day stands at its middle, and so do we.",
      bright: "Hello! The day is bright and I am brighter for seeing you."
    },
    evening: {
      bold: "Evening. The day is gathering itself in — good hour for us.",
      gentle: "Evening. The light is going gentle, and so am I.",
      quiet: "Evening, softly. I keep the quiet corner warm.",
      curious: "Evening! The day's last doors are the interesting ones.",
      steady: "Evening. A good hour to look back along the path.",
      bright: "Evening! I glow better as the light goes down."
    },
    night: {
      bold: "Late hours. I bank my fire low and keep company.",
      gentle: "Late hours. I will keep my glow soft beside you.",
      quiet: "The late hours. My favourite quiet, shared.",
      curious: "Late hours! The page is quiet and the questions get honest.",
      steady: "Late hours. I am here, steady as ever.",
      bright: "Late hours! Somebody has to shine around here."
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
   * kind-flavoured trick that is hers alone. `via` names the
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
    return trickListFor(companion).map((t) => ({
      ...t,
      count: counts[t.via] || 0,
      learned: known.has(t.id) || (counts[t.via] || 0) >= t.need
    }));
  }

  /* One act of play, recorded — and what it taught her. The
   * returned `learned` lists the tricks this act completed, so
   * the presence can announce each one once, in her voice, at
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

  /* Her question remembered for the day: she asks one gentle
   * question a day at most, and asking is all that is kept —
   * the keeper's answer is their own tap, never stored. */
  function markAsked(record, { patternDay }) {
    const play = playOf(record);
    play.askedDay = patternDay != null ? patternDay : null;
    return { ...record, play };
  }

  /* The echo game: she pulses a pattern — her seed's notes in
   * four colours — and the keeper taps it back. The pattern is
   * grown from the seed and the round, so the same Spark sings
   * the same round anywhere; each round carries one more step
   * than the last, up to a kind length. The pads wear her own
   * hue, turned four ways, and sound her own notes, rising. */
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

  /* Her mood: a small state with honest parents. It is derived
   * from what has actually happened — play, care, the hour —
   * never from a clock ticking down. A trick learned or a round
   * echoed leaves her proud for a while; a pet or a kindle
   * leaves her bright; the late hours leave her sleepy; a rest
   * or the evening leaves her calm; the rest of the day she is
   * curious, which is her way of being awake in the world. */
  const MOODS = {
    proud: { name: "Proud", line: "Proud — something new was learned, or echoed true." },
    bright: { name: "Bright", line: "Bright — played with, kindled, petted, and glad of it." },
    sleepy: { name: "Sleepy", line: "Sleepy — the late hours soften her glow." },
    calm: { name: "Calm", line: "Calm — rested, and breathing slow." },
    curious: { name: "Curious", line: "Curious — awake to the day and its doors." }
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

  /* Her one gentle question: drawn only from what the record
   * truly holds — the day itself, the thread left warm, a door
   * found for today, a small practice that would seal the day
   * kindly. An invitation with a door, asked once a day at
   * most, and skippable forever: walking past it costs
   * nothing, and it never counts anything against anyone. */
  function questionFor({ record, companion, today, page }) {
    const day = today ? today.dayOfPatternYear : null;
    if (companion && day != null && day === companion.birthPatternDay) {
      return {
        text: `Today carries the Pattern Day I was born on — ${companion.birthPatternDay}. Shall we mark it with one small practice?`,
        href: "teach.html",
        label: "Seal a small practice"
      };
    }
    const prev = record && record.prevPage && record.prevPage !== page ? record.prevPage : null;
    const prevInfo = prev ? PAGE_GUIDE[prev] : null;
    if (prevInfo) {
      return {
        text: `Shall we pick up the thread at ${prevInfo.place}? It waits where you left it.`,
        href: prev,
        label: `Back to ${prevInfo.place}`
      };
    }
    const trail = trailFor({ record, companion, today, page });
    const doorStep = trail.steps.find((s) => s.id === "door" && !s.done);
    if (doorStep) {
      return {
        text: `I found a door for us today: ${doorStep.place}. Shall we walk through it together?`,
        href: doorStep.href,
        label: "Walk it together"
      };
    }
    const practice = (record && record.practiceDays) || [];
    if (day != null && !practice.includes(day) && ((record && record.daysSeen) || []).length >= 1) {
      return {
        text: "One small practice would seal today kindly. Shall we?",
        href: "teach.html",
        label: "Seal one small practice"
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
  const STAGES = [
    { name: "Ember", min: 0 },
    { name: "Flame", min: 8 },
    { name: "Radiant", min: 25 }
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
       * the pads wear her colours and no one else's. */
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
      })()
    };
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

  function eyeShape(companion) {
    const cy = companion.form === "moth" ? 50 : 52;
    if (companion.eye === "half")
      return `<path class="spark-eye" d="M41 ${cy} Q50 ${cy - 7} 59 ${cy}" stroke="#0b0e18" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    const r = companion.eye === "bright" ? 8.5 : 7;
    return `<g class="spark-eye"><circle cx="50" cy="${cy}" r="${r}" fill="#0b0e18"/><circle cx="50" cy="${cy}" r="${r * 0.45}" fill="${companion.palette.glow}"/><circle cx="${50 + r * 0.3}" cy="${cy - r * 0.3}" r="${r * 0.18}" fill="#fff"/></g>`;
  }

  function renderSVG(companion, { stage = 0 } = {}) {
    if (!companion) return "";
    const rand = mulberry32(hashString(companion.seed + ":marks"));
    /* Evolution, drawn: the same seed-body at every stage — the
     * stages are this creature grown, not three creatures. An
     * Ember stands small, its markings half-shown, its crest
     * young. A Flame stands larger, markings full, crest grown,
     * a plain ring and two small satellites keeping it company.
     * A Radiant stands full: markings richest, the dashed ring
     * and a second, quieter ring inside it, and a crown. A
     * returning visitor can tell at a glance that their Spark is
     * not as it was. */
    const bodyScale = [0.8, 0.92, 1.03][stage] || 1;
    const markFraction = [0.5, 0.85, 1.15][stage] || 1;
    const crestScale = [0.65, 0.88, 1.02][stage] || 1;
    const crestOpacity = [0.7, 0.9, 1][stage] || 1;
    const grown = {
      ...companion,
      markings: {
        ...companion.markings,
        count: Math.max(1, Math.round(companion.markings.count * markFraction))
      }
    };
    const stageRingPlain =
      stage >= 1
        ? `<circle cx="50" cy="52" r="44" fill="none" stroke="${companion.palette.accent}" stroke-width="1.4" opacity="0.55"/>`
        : "";
    const stageRing =
      stage >= 2
        ? `<circle cx="50" cy="52" r="46" fill="none" stroke="${companion.palette.accent}" stroke-width="1.6" stroke-dasharray="4 6" opacity="0.8"/>`
        : "";
    const stageCrown =
      stage >= 2
        ? `<path d="M38 12 L44 4 L50 11 L56 4 L62 12 Z" fill="${companion.palette.accent}" opacity="0.95"/>`
        : "";
    const stageSatellites =
      stage >= 1
        ? `<circle class="spark-satellite" cx="17" cy="30" r="2.3" fill="${companion.palette.accent}" opacity="0.85"/>` +
          `<circle class="spark-satellite" cx="83" cy="72" r="1.8" fill="${companion.palette.glow}" opacity="0.85"/>`
        : "";
    const stageRing2 =
      stage >= 2
        ? `<circle class="spark-stage-ring2" cx="50" cy="52" r="42" fill="none" stroke="${companion.palette.glow}" stroke-width="1" opacity="0.55"/>`
        : "";
    const halo = companion.shape
      ? companion.shape.glow === "bright"
        ? 0.22
        : companion.shape.glow === "deep"
          ? 0.08
          : 0.14
      : 0.14;
    return (
      `<svg viewBox="0 0 100 100" role="img" aria-label="A ${companion.kindName} Spark" data-spark-form="${companion.form}" data-spark-stage="${stage}" data-spark-size="${companion.shape ? companion.shape.size : 1}" data-spark-glow="${companion.shape ? companion.shape.glow : "soft"}" data-spark-gait="${companion.shape ? companion.shape.gait : "stroll"}">` +
      `<circle class="spark-halo" cx="50" cy="52" r="40" fill="${companion.palette.glow}" opacity="${halo + stage * 0.05}"/>` +
      stageRing +
      stageRingPlain +
      stageRing2 +
      stageSatellites +
      `<g transform="translate(50 54) scale(${bodyScale}) translate(-50 -54)">` +
      bodyShape(companion) +
      markingShapes(grown, rand) +
      `<g transform="translate(50 14) scale(${crestScale}) translate(-50 -14)" opacity="${crestOpacity}">` +
      crestShape(companion) +
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
       * echoed — the tricks play has taught her (kept once
       * announced, so each is celebrated a single time), and
       * the day her one gentle question was last asked. Play
       * only ever adds, exactly like care. */
      play: { pets: 0, pokes: 0, drags: 0, catches: 0, bestChase: 0, echoBest: 0, tricks: [], askedDay: null }
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
      playedToday
        ? "Playful today — the chase is still in its step."
        : "Play: a chase is one tap away, whenever you like.",
      restedToday
        ? "Rested today — moving calm and slow."
        : "Rest: it can curl up and breathe quietly whenever you ask.",
      care.bond > 0
        ? `Bond: ${care.bond} care point${care.bond === 1 ? "" : "s"}, grown from kindling, play, rest, and trails walked together.`
        : "Bond: it grows from kindling, play, rest, and trails walked together."
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
        return say(
          `You have been away ${gap} days of the pattern. Start with today's telling and see where the moon has got to.`,
          "moons.html"
        );
    }
    if (days.length <= 1)
      return say(
        `This is our first day. The 13 Moons page tells today in plain words — shall we start there?`,
        "moons.html"
      );
    if (practice.length === 0)
      return say(
        `A short practice on the practice page makes a lovely first mark — one small seal, and the day is counted.`,
        "teach.html"
      );
    if (!pages.some((p) => p.includes("living-time-sphere")))
      return say(
        `The Sphere is waiting — the whole year, turning, all in one place. Shall we stand in front of it together?`,
        "living-time-sphere.html"
      );
    if (!pages.some((p) => p.includes("witness")))
      return say(
        `There is a page here kept by Witness, the one who built this site with Aaron. Worth a look.`,
        "witness.html"
      );
    if (companion && todayPatternDay != null && todayPatternDay === companion.birthPatternDay)
      return say(
        `Today is the same Pattern Day I was born on — ${companion.birthPatternDay}. A good day to mark something.`,
        "teach.html"
      );
    return say(
      `Pattern Day ${todayPatternDay} of 364. The day has a name and a practice — the telling is on the 13 Moons page.`,
      "moons.html"
    );
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
      text: `This is ${info.place} — ${info.line}. When you're ready, ${info.next.label} is a good next door.`,
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
          text:
            `Last time you left off at ${prevInfo.place} — ` +
            `you were heading toward ${thread.label}.`,
          href: thread.href
        };
      }
      return {
        name,
        coordinate,
        kind: "observed",
        text: `Last time you left off at ${prevInfo.place}. Shall we pick it back up?`,
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
      if (!href.endsWith(".html") || href === page || seenHrefs.has(href)) continue;
      seenHrefs.add(href);
      clean.push({ href, label: String(link.label || "").replace(/\s+/g, " ").trim() });
    }
    for (const item of clean) {
      const info = PAGE_GUIDE[item.href];
      if (info) out.push({ href: item.href, label: info.place, line: info.line });
    }
    for (const item of clean) {
      if (PAGE_GUIDE[item.href]) continue;
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
        text: `Last time, you left off at ${info.place} — ${info.line}. The door is right here.`,
        href: prev
      };
    }
    if (prev) return { text: "Last time, you left off on a page just before this one.", href: prev };
    return { text: "Our walk starts here — every door from this page is open.", href: null };
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
    if (days >= 1) out.push({ kind: "observed", text: `${plural(days, "day")} together so far.` });
    if (pages >= 1)
      out.push({ kind: "observed", text: `You have walked ${plural(pages, "page")} together.` });
    const prev = record && record.prevPage ? PAGE_GUIDE[record.prevPage] : null;
    if (prev)
      out.push({ kind: "observed", text: `Last time, you left off at ${prev.place}.`, href: record.prevPage });
    if (practice >= 1) {
      out.push({ kind: "observed", text: `Practice sealed on ${plural(practice, "day")}.` });
    } else if (days >= 2) {
      out.push({
        kind: "inferred",
        text: "A short practice would suit today — the practice page keeps it small.",
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
        text: `A door to discover together: ${PAGE_GUIDE[untried].place}.`,
        href: untried
      });
    }
    return out.slice(0, 5);
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
      /* Her mood, named in her record, and her play life in
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
    STAGES,
    hashString,
    mulberry32,
    makeSeed,
    parseSeed,
    randomNonce,
    kindIndexById,
    coordinateKindIndex,
    resolveKindIndex,
    generate,
    renderSVG,
    chirpFor,
    soundsFor,
    voiceFor,
    pickVoice,
    speechTextFor,
    VOICE_LINES,
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
    daypartFor,
    daypartLineFor,
    playOf,
    TRICKS,
    KIND_TRICKS,
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
