/*
 * Aiyana's Spark — the guide's small, honest brain.
 *
 * Her Spark lives on her dashboard and guides her: it greets
 * her with what is really waiting, answers her tapped
 * questions from her REAL dashboard state, helps her spell,
 * and teaches her words. The law it lives by is the site's
 * own (the pass-7 law): every fact in an answer is read from
 * the state the dashboard hands in, in that moment. Nothing
 * is invented — a word it does not know, it says it does not
 * know; a question it cannot ground, it answers plainly.
 *
 * This module is pure: no storage, no network, no clock. The
 * dashboard assembles the state and hands it in. It is NOT
 * the keeper's Spark and not the Codex Guide — it is a little
 * guide for one girl's world, and it never acts on its own:
 * it offers, she taps.
 *
 * The state ("world"):
 *   pending   stories waiting for her yes (array or count)
 *   approved  stories on her page (array of {title, penName})
 *   mine      her own stories on her shelf ({title, story})
 *   page      { welcome, about, banner, featuredId } — her
 *             page as it stands (defaults when untouched)
 *   garden    her word garden [{ word, kind }] — "invented"
 *             for words she made up, "learned" for words she
 *             looked up or was praised for
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.AiyanaGuide = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---------------- small helpers ---------------- */

  const NUMBER_WORDS = ["no", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

  function countOf(list) {
    if (Array.isArray(list)) return list.length;
    if (typeof list === "number") return list;
    return 0;
  }

  function numberWord(n) {
    return n >= 0 && n <= 10 ? NUMBER_WORDS[n] : String(n);
  }

  function cap(text) {
    const s = String(text || "");
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  /* ---------------- the greeting ---------------- */

  /*
   * The greeting names what is really waiting, and offers the
   * next steps as big tappable words. Steps come in the order
   * she would want them: a waiting story first, then writing,
   * then her page.
   */
  function greeting(world) {
    const pending = countOf(world.pending);
    const mine = countOf(world.mine);
    const spark = world.spark || {};
    let line = spark.name
      ? "Hi Aiyana! I'm " + spark.name + ", your Spark."
      : "Hi Aiyana! I'm your Spark.";
    if (pending === 1) line += " One story is waiting for you!";
    else if (pending > 1) line += " " + numberWord(pending) + " stories are waiting for you!";
    else line += " No stories are waiting right now — your world is quiet and cosy.";
    if (mine > 0) {
      line +=
        " You have " +
        (mine === 1 ? "a story" : numberWord(mine).toLowerCase() + " stories") +
        " on your shelf" +
        (pending > 0 ? " too." : ".");
    }
    const steps = [];
    if (pending > 0) steps.push({ id: "read", label: "Read a waiting story" });
    steps.push({ id: "write", label: "Write a story" });
    steps.push({ id: "page", label: "Change my page" });
    steps.push({ id: "see", label: "See my page" });
    return { line, steps };
  }

  /* ---------------- her questions ---------------- */

  const QUESTIONS = [
    { id: "waiting", label: "How many stories are waiting?" },
    { id: "on-my-page", label: "What's on my page?" },
    { id: "what-i-wrote", label: "What did I write?" },
    { id: "word-garden", label: "What's in my word garden?" }
  ];

  function answer(id, world) {
    switch (id) {
      case "waiting": {
        const n = countOf(world.pending);
        if (n === 0) return "No stories are waiting right now. Your world is quiet.";
        if (n === 1) return "One story is waiting for you!";
        return numberWord(n) + " stories are waiting for you!";
      }
      case "on-my-page": {
        const page = world.page || {};
        const approved = Array.isArray(world.approved) ? world.approved : [];
        let text = "Your page says: \u201C" + (page.welcome || "") + "\u201D";
        if (approved.length === 0) {
          text += " No stories are on it yet — the first one is waiting for your yes.";
        } else {
          const titles = approved.slice(0, 3).map((s) => "\u201C" + (s.title || "A story") + "\u201D");
          text +=
            " It has " +
            approved.length +
            (approved.length === 1 ? " story" : " stories") +
            " on it: " +
            titles.join(", ") +
            (approved.length > 3 ? ", and more." : ".");
        }
        return text;
      }
      case "what-i-wrote": {
        const mine = Array.isArray(world.mine) ? world.mine : [];
        const hers = (Array.isArray(world.approved) ? world.approved : []).filter(
          (s) => s && s.penName === "Aiyana"
        );
        if (mine.length === 0 && hers.length === 0) {
          return "You haven't written a story yet. Want to start one? Tap \u201CWrite a story\u201D.";
        }
        const parts = [];
        if (mine.length) {
          parts.push(
            "On your shelf: " + mine.map((s) => "\u201C" + (s.title || "My story") + "\u201D").join(", ") + "."
          );
        }
        if (hers.length) {
          parts.push(
            "In your world already: " + hers.map((s) => "\u201C" + (s.title || "My story") + "\u201D").join(", ") + "."
          );
        }
        return parts.join(" ");
      }
      case "word-garden": {
        const garden = Array.isArray(world.garden) ? world.garden : [];
        if (garden.length === 0) {
          return "Your word garden is empty. When you learn a new word — or make one up! — it will grow here.";
        }
        const invented = garden.filter((g) => g.kind === "invented").map((g) => g.word);
        const learned = garden.filter((g) => g.kind !== "invented").map((g) => g.word);
        const parts = ["Your word garden has " + garden.length + (garden.length === 1 ? " word." : " words.")];
        if (learned.length) parts.push("Words you learned: " + learned.join(", ") + ".");
        if (invented.length) parts.push("Words YOU invented: " + invented.join(", ") + "!");
        return parts.join(" ");
      }
      default:
        return null; /* not known — the dashboard says so, plainly */
    }
  }

  /*
   * The meeting line. Her Spark is generated by the site's
   * own Spark core, exactly like every other Spark — this is
   * only the words it introduces itself with: its seed name,
   * its kind, and its kind's own line, in words an 8-year-old
   * takes in at once.
   */
  function meetingLine(companion) {
    if (!companion) return "";
    return (
      "I'm " + companion.name + ". I'm a " + companion.kindName + " Spark — " +
      companion.kindLine + " Will you be my Spark's keeper?"
    );
  }

  /* The growth line, in her words: where her Spark stands,
     and the honest count it stands on. */
  function growthLine(record, companion, stage) {
    if (!record || !companion || !stage) return "";
    const days = Array.isArray(record.daysSeen) ? record.daysSeen.length : 0;
    let line =
      companion.name + " is a " + stage.name + " Spark. You two have had " +
      days + (days === 1 ? " day" : " days") + " together.";
    return line;
  }

  /* ---------------- story beginnings & sentence help ---------------- */

  /* Beginnings her Spark can offer. She taps one to start —
     the words land in her editor by HER tap, and she can
     change every one of them. */
  const STARTERS = [
    "Once upon a time, there was a little boat who wanted to see the whole wide sea…",
    "One morning, Mia opened her door and found a tiny dragon asleep on the step…",
    "Deep in the forest, under the biggest tree, there was a door no one had ever opened…",
    "The moon was bright, and Sam could not sleep, so he climbed up to ask it a question…",
    "On the very first day of spring, a seed woke up and stretched…",
    "Nobody believed Lily, but she knew the garden could talk…",
    "Far away, past the hills, there was a village where it rained only on birthdays…",
    "The old lighthouse keeper had a secret, and tonight he was going to share it…"
  ];

  /* Little hands for the middle of a sentence — offered as
     words she can keep or change, never slipped in quietly. */
  const SENTENCE_HELPERS = [
    "Then, all of a sudden…",
    "She opened the door and saw…",
    "And guess what happened next?",
    "It made her feel…",
    "So she decided to…",
    "The best part was…",
    "But wait — there was one more thing…",
    "And from that day on…"
  ];

  /* ---------------- the kid dictionary ---------------- */

  /*
   * Simple, true meanings in kid words, for common story
   * words. When a word is not here, her Spark says so plainly
   * — it never makes a meaning up.
   */
  const MEANINGS = {
    enormous: "very, very big — bigger than big!",
    tiny: "very, very small",
    brave: "doing something even when it feels scary",
    gentle: "soft and kind, not rough",
    curious: "wanting to know and find out",
    adventure: "going somewhere new and exciting",
    journey: "a long trip from one place to another",
    whisper: "to talk very, very quietly",
    giggle: "a small, happy laugh",
    sparkle: "to shine with tiny flashes of light",
    shimmer: "to shine softly, like light on water",
    glow: "to shine with a warm, steady light",
    dawn: "the very start of the day, when the sun comes up",
    dusk: "the end of the day, when the sun goes down",
    meadow: "a field of grass and flowers",
    forest: "a place with lots and lots of trees",
    island: "land with water all around it",
    ocean: "the great big salty sea",
    voyage: "a long trip across the sea",
    anchor: "the heavy thing that holds a boat still",
    harbour: "a safe place where boats rest (also spelled harbor)",
    harbor: "a safe place where boats rest",
    lantern: "a lamp you can carry",
    treasure: "something special and valuable that someone hid or found",
    secret: "something only a few people know",
    promise: "when you say you will really do something",
    forgive: "to stop being mad at someone and be friends again",
    proud: "feeling happy about something you did well",
    shy: "feeling quiet around new people",
    lonely: "feeling sad because you are by yourself",
    cozy: "warm, soft, and safe-feeling (also spelled cosy)",
    cosy: "warm, soft, and safe-feeling",
    wonder: "a feeling of wow — or to ask yourself about something",
    imagine: "to make pictures in your mind",
    discover: "to find something new",
    explore: "to go and look around to find out",
    collect: "to gather things and keep them",
    share: "to let someone else have some too",
    help: "to make something easier for someone",
    kindness: "being nice and caring to others",
    friend: "someone you like and who likes you",
    family: "the people who love you and live with you or near you",
    neighbour: "someone who lives near you (also spelled neighbor)",
    neighbor: "someone who lives near you",
    village: "a small town",
    castle: "a big strong building where kings and queens lived",
    dragon: "a story animal that flies and breathes fire",
    unicorn: "a story horse with one horn on its head",
    mermaid: "a story person with a fish tail who lives in the sea",
    fairy: "a tiny story person with wings and magic",
    magic: "story power that makes impossible things happen",
    spell: "magic words — or the letters that make a word!",
    wish: "something you hope for with all your heart",
    dream: "pictures in your mind when you sleep — or a big hope",
    star: "a tiny-looking light in the night sky that is really a faraway sun",
    moon: "the big round light that shines in the night sky",
    rainbow: "the colours in the sky after rain when the sun shines",
    thunder: "the loud rumbling sound after lightning",
    lightning: "a bright flash in a storm sky",
    breeze: "a soft, gentle wind",
    puddle: "a little pool of rain water on the ground",
    seed: "the tiny thing a plant grows from",
    sprout: "a baby plant just starting to grow",
    bloom: "when a flower opens up",
    garden: "a place where someone grows flowers and plants",
    butterfly: "a flying insect with big, pretty wings",
    ladybug: "a small red beetle with black spots (also called a ladybird)",
    firefly: "a little beetle that glows in the dark",
    snail: "a slow animal that carries its shell on its back",
    turtle: "an animal with a hard shell it can hide inside",
    dolphin: "a clever sea animal that jumps and plays in the waves",
    whale: "the biggest animal in the sea",
    owl: "a bird that wakes up at night and says hoo",
    fox: "a clever orange animal with a bushy tail",
    bear: "a big, furry, strong animal",
    wolf: "a wild animal like a dog that howls at the moon",
    deer: "a gentle animal with long legs; the boys grow antlers",
    rabbit: "a small animal with long ears that hops",
    squirrel: "a small animal that climbs trees and hides nuts",
    puppy: "a baby dog",
    kitten: "a baby cat",
    gigantic: "huge — the biggest kind of big",
    ancient: "very, very old — older than grandma's grandma",
    mysterious: "hard to understand, like a puzzle or a secret",
    delicious: "tasting really, really good",
    favourite: "the one you like best (also spelled favorite)",
    favorite: "the one you like best",
    beautiful: "so pretty it makes you smile",
    wonderful: "so good it fills you with wonder",
    terrible: "really, really bad",
    frightened: "feeling scared",
    excited: "feeling bubbly and happy about something coming",
    surprised: "when something happens that you did not expect at all",
    suddenly: "all at once, without any warning",
    quietly: "with hardly any sound",
    carefully: "slowly and with lots of care, so nothing goes wrong",
    finally: "after a long wait, at last!",
    together: "with each other, not alone"
  };

  function meaningOf(word) {
    const w = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
    return Object.prototype.hasOwnProperty.call(MEANINGS, w) ? MEANINGS[w] : null;
  }

  /* A "wow word": a longer word she used well, worth a cheer
     by name. Only words this dictionary truly knows. */
  function wowWord(word) {
    const w = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
    if (w.length < 6) return null;
    return meaningOf(w) ? { word: w, meaning: MEANINGS[w] } : null;
  }

  /* ---------------- the spelling friend ---------------- */

  /*
   * The spelling friend checks FINISHED words only. It knows
   * a shelf of common kid words, plus the mistakes kids make
   * most. Three answers only:
   *   fine    — a word it knows (or a name, or her own word)
   *   fix     — it is SURE: "That one's spelled this way"
   *   unknown — it does not know the word: maybe she invented
   *             it! Invented words are celebrated, never
   *             corrected.
   * It never changes anything itself. It offers; she taps.
   */

  const WORDS = new Set(
    (
      "a about above across after again against all almost alone along already also although always " +
      "am an and animal another answer any are around ask asked away back ball be bear because become " +
      "been before began behind believe below best better big bird birthday boat book both box boy " +
      "brave bread brother brown but butterfly by call called came can car cat catch children climb " +
      "close cloud cold colour color come could country day did different do dog door down dragon " +
      "dream each early earth eat egg eight elephant end enough even every eye face family far fast " +
      "father favourite favorite feel feet fell fence few find fine fire first fish five flower fly " +
      "follow food for found four fox friend frog from fun garden gave get girl give go goes gold " +
      "gone good got grass great green grow had hand happy hard has hat have he head hear heard help " +
      "her here high hill him his home hope horse house how i if in into is island it its jump just " +
      "keep kind king kitchen kite know ladybug land last laugh leaf learn left leg let letter light " +
      "like line lion listen little live long look love lunch made magic make man many map may me " +
      "milk miss mom money monkey moon more morning most mother mouse mouth move much music my name " +
      "near need never new next night no not now number of off often oh old on once one only open or " +
      "other our out over owl own page paper part people picture pig pink place play please pony poor " +
      "pretty prince princess puppy purple put queen question quickly quiet rabbit rain rainbow ran " +
      "read really red ride right river road room run sad said sam saw say school sea second see seed " +
      "seem sentence set seven she sheep ship shoe short show sister sit six sky sleep slowly small " +
      "snail snake snow so some something song soon sound spell star stay still stone story sun " +
      "surprise swim table tail take talk tall teacher tell ten than thank that the their them then " +
      "there these they thing think third this those three through tiger time tiny to today together " +
      "told tomorrow too took top town tree trick try turtle two under until up us very village visit " +
      "voice walk want war was wash watch water way we wear went were west wet whale what when where " +
      "which while white who why wind window wish with wolf woman wonder wood word work world would " +
      "write year yellow yes yet you young your zebra zoo annie mia lily jack ben emma noah ava " +
      "outside inside beside behind between above below happy birthday everyone someone anyone " +
      "everything something nothing morning evening afternoon night today yesterday playtime " +
      "breakfast dinner lunch hungry thirsty delicious yummy giggle whisper shout sing dance " +
      "climb slide swing round roundabout seesaw sandbox bucket spade shell crab seagull wave " +
      "truly really actually usually finally suddenly carefully quietly slowly bravely gently " +
      "happen happens happenings smile smiles smiled cry cries cried clap claps clapped hop hops " +
      "hopped skip skips skipped shout shouts shouted dance dances danced sing sings sang song " +
      "songs play plays played look looks looked watch watches watched wish wishes wished " +
      "help helps helped ask asks asked call calls called walk walks walked jump jumps jumped " +
      "climb climbs climbed swim swims swam run runs ran read reads reading write writes wrote " +
      "draw draws drew paint paints painted colour colours colored book books story stories " +
      "friend friends girl girls boy boys baby babies puppy puppies kitten kittens " +
      "stop stops stopped lady ladies tooth teeth foot feet goose geese mouse mice man men " +
      "woman women child leaf leaves tomato tomatoes potato potatoes hero heroes echo echoes " +
      "volcano volcanoes tornado tornadoes knife knives life lives wife wives " +
      "splash swim float sink sail captain treasure map pirate gold silver jewel crown king queen " +
      "castle knight sword shield horse unicorn fairy wand magic potion giant dwarf elf troll " +
      "bridge tower window doorbell garden flower rose tulip sunflower daisy grass tree leaf " +
      "apple banana orange grape strawberry lemon melon peach pear plum cherry berry cake cookie " +
      "bread cheese egg milk juice water tea cocoa honey jam butter toast pancake pizza pasta soup " +
      "warm warmer warmest hot cold cool chilly frosty sunny rainy snowy windy cloudy stormy " +
      "breezy foggy rainbow sparkle sparkles sparkled sparkling shine shines shone glowing " +
      "float floats floated floating drift drifts drifted bob bubbles bubbly splash splashed " +
      "twinkle twinkles twinkled blanket pillow blanket fort torch lantern candle shadow " +
      "whisper whispers whispered murmur giggles giggled wiggle wiggles wiggled squiggle " +
      "invent invented invents explorer explore explored adventure adventures journey journeys " +
      "curious brave bravely kind kindly gentle gently proud proudly silly serious sleepy " +
      "dreamy dreams dreamt awake asleep wake wakes woke woken yawn yawns stretched"
    ).split(/\s+/)
  );

  /* Mistakes kids make most, and the true spelling of each. */
  const MISSPELLED = {
    becuase: "because", becuse: "because", becouse: "because", becase: "because",
    freind: "friend", freinds: "friends", firend: "friend",
    thay: "they", thier: "their", ther: "their",
    sed: "said", wos: "was", woz: "was",
    lik: "like", favrit: "favorite", favorit: "favorite", favrite: "favorite",
    colr: "color", animl: "animal", anmal: "animal",
    butiful: "beautiful", beutiful: "beautiful", beautifull: "beautiful",
    finaly: "finally", realy: "really", truely: "truly",
    diffrent: "different", difrent: "different",
    peple: "people", poeple: "people",
    litle: "little", litel: "little",
    skool: "school", scool: "school",
    techer: "teacher", teecher: "teacher",
    tomorow: "tomorrow", tommorow: "tomorrow", tomarrow: "tomorrow",
    yestday: "yesterday", wich: "which", whent: "went",
    comming: "coming", comeing: "coming", runing: "running", swiming: "swimming",
    stoped: "stopped", happend: "happened", hapened: "happened",
    opend: "opened", closd: "closed",
    nite: "night", lite: "light", rite: "right",
    verey: "very", verry: "very",
    happey: "happy", happpy: "happy",
    famly: "family", familey: "family",
    moning: "morning", mornin: "morning",
    evning: "evening",
    frend: "friend", freindly: "friendly",
    gowing: "going", gose: "goes",
    dos: "does", duz: "does",
    wans: "once", wunce: "once",
    agan: "again", agen: "again",
    abowt: "about", abot: "about",
    coud: "could", woud: "would", shoud: "should",
    befor: "before", aftr: "after",
    evry: "every", evrey: "every",
    meny: "many", miny: "many",
    sum: "some", sumthing: "something", somthing: "something",
    enything: "anything", enithing: "anything",
    ware: "where", wair: "where",
    siad: "said", sade: "said",
    gurl: "girl", boi: "boy",
    skared: "scared", scard: "scared",
    exsited: "excited", exited: "excited", ecsited: "excited",
    suprised: "surprised", suprized: "surprised",
    wondr: "wonder", wunder: "wonder",
    buterfly: "butterfly", butterflie: "butterfly",
    rainbo: "rainbow", raynbow: "rainbow",
    frends: "friends", freindz: "friends",
    togedder: "together", togethr: "together",
    becum: "become", becam: "became",
    thout: "thought", thoght: "thought",
    brout: "brought", broght: "brought",
    caut: "caught", cot: "caught",
    teached: "taught", buyed: "bought",
    goed: "went", runned: "ran", swimmed: "swam",
    eated: "ate", drinked: "drank", seed2: "",
    writed: "wrote", maked: "made", gived: "gave",
    fel: "fell", falt: "felt",
    kep: "kept", sleped: "slept",
    lern: "learn", lernd: "learned",
    wach: "watch", wached: "watched",
    sience: "science",
    enuff: "enough", enof: "enough",
    laff: "laugh", laf: "laugh",
    juse: "juice", juce: "juice",
    kek: "cake", cooky: "cookie",
    pupy: "puppy", puppie: "puppy",
    kity: "kitty", kittie: "kitty",
    hors: "horse", howse: "house",
    mows: "mouse", mouce: "mouse",
    trea: "tree", tre: "tree",
    flouer: "flower", flowr: "flower",
    gras: "grass", glas: "glass",
    stori: "story", storey: "story",
    pichure: "picture", picter: "picture",
    lettle: "little", adress: "address",
    beleive: "believe", beleve: "believe",
    neibor: "neighbor", naybor: "neighbor",
    qiet: "quiet", quyet: "quiet",
    qick: "quick", qik: "quick",
    egzactly: "exactly", exacly: "exactly",
    amasing: "amazing", amazng: "amazing",
    inportant: "important", importent: "important",
    diffrint: "different", diferent: "different",
    goverment: "government", enviroment: "environment",
    libary: "library", libery: "library",
    restrant: "restaurant", restaraunt: "restaurant",
    choclate: "chocolate", choclat: "chocolate",
    vanila: "vanilla", strawbery: "strawberry",
    bannana: "banana", bananna: "banana",
    orenge: "orange", ornge: "orange",
    lemmon: "lemon", peech: "peach",
    dinosor: "dinosaur", dinosore: "dinosaur",
    elaphant: "elephant", elefant: "elephant",
    girrafe: "giraffe", girafe: "giraffe",
    munky: "monkey", monky: "monkey",
    turtel: "turtle", turtal: "turtle",
    rabit: "rabbit", rabitt: "rabbit",
    sqirrel: "squirrel", squirel: "squirrel",
    dolfin: "dolphin", dolfen: "dolphin",
    wale: "whale", wael: "whale",
    dragin: "dragon", dragun: "dragon",
    prinsess: "princess", princes2: "",
    majic: "magic", magik: "magic",
    seceret: "secret", seecret: "secret",
    promiss: "promise", promis: "promise",
    tresure: "treasure", trasure: "treasure",
    iland: "island", ilund: "island",
    oshun: "ocean", oshen: "ocean",
    lantren: "lantern", lanturn: "lantern",
    castel: "castle", casle: "castle",
    vilage: "village", villige: "village",
    anshunt: "ancient", anchent: "ancient",
    jurney: "journey", jorney: "journey",
    advencher: "adventure", adventur: "adventure",
    mistery: "mystery", mystrey: "mystery",
    curius: "curious", curias: "curious",
    jentle: "gentle", gentel: "gentle",
    enourmous: "enormous", enormus: "enormous",
    gigantik: "gigantic", jient: "giant",
    sparkely: "sparkly", sparkel: "sparkle",
    wisper: "whisper", wispered: "whispered",
    gigel: "giggle", gigle: "giggle",
    shimer: "shimmer", glimmr: "glimmer",
    bravly: "bravely", kareful: "careful",
    carefly: "carefully", sudenly: "suddenly",
    quietley: "quietly", slowley: "slowly",
    finalley: "finally", usualy: "usually",
    freindship: "friendship", frendship: "friendship",
    kindnes: "kindness", kindess: "kindness",
    forgiv: "forgive", forgived: "forgave",
    wunderful: "wonderful", wonderfull: "wonderful",
    terible: "terrible", terribel: "terrible",
    fritened: "frightened", frightend: "frightened",
    lonley: "lonely", lonly: "lonely",
    cosey: "cosy", cozie: "cozy",
    inagine: "imagine", imajine: "imagine",
    discuver: "discover", discovr: "discover",
    eksplore: "explore", explor: "explore",
    colect: "collect", colekt: "collect",
    shair: "share", shaired: "shared",
    neybor: "neighbor", neibor2: "",
    farie: "fairy", faerie: "fairy",
    meremaid: "mermaid", mermade: "mermaid",
    unycorn: "unicorn", unikorn: "unicorn",
    thundr: "thunder", thuder: "thunder",
    litening: "lightning", lightning2: "",
    breez: "breeze", breze: "breeze",
    pudel: "puddle", pudle: "puddle",
    sprowt: "sprout", sprout2: "",
    blum: "bloom", blome: "bloom",
    gardin: "garden", gardun: "garden",
    ladybugg: "ladybug", ladibug: "ladybug",
    fierfly: "firefly", fireflie: "firefly",
    snale: "snail", snael: "snail",
    foks: "fox", focs: "fox",
    beare: "bear",
    dear2: "",
    skwirl: "squirrel", puppys: "puppies",
    kittys: "kittens", babys: "babies",
    storys: "stories", stori2: "",
    ladys: "ladies", familys: "families",
    bodys: "bodies", partys: "parties",
    hobbys: "hobbies", candys: "candies",
    boxs: "boxes", foxs: "foxes",
    watchs: "watches", wishs: "wishes",
    classs: "classes", glases: "glasses",
    buss: "buses", chirch: "church",
    chirches: "churches", benchs: "benches",
    dresss: "dresses", kiss2: "",
    childs: "children", childrens: "children",
    foots: "feet", tooths: "teeth",
    mouses: "mice", gooses: "geese",
    mans: "men", womans: "women",
    sheeps: "sheep", fishs: "fish",
    deers: "deer", leafs: "leaves",
    wolfs: "wolves", knifes: "knives",
    lifes: "lives", wifes: "wives",
    tomatos: "tomatoes", potatos: "potatoes",
    heros: "heroes", echos: "echoes",
    volcanos: "volcanoes", tornados: "tornadoes"
  };
  /*
   * The unknown-word moment (Aaron, Nov 26, 2026): the line
   * celebrates FIRST and carries the permission inside it —
   * it must never sound like she is being caught. One tap:
   * "It's mine!" (cheer, word garden, never flagged again) or
   * "Help me fix it" (the gentle spelling offer). The same
   * warmth meets any word the dashboard doesn't know,
   * including words in stories she reads.
   */
  function unknownWordLine(word) {
    return (
      "Ooh, I haven't met the word \u201C" + word + "\u201D before! Is it one of yours? " +
      "Made-up words are welcome here — writers invent the best ones."
    );
  }

  /* Word shapes a writer makes from words she knows: stories
     from story, whispering from whisper, happened from
     happen. If a plain stem is a known word, the word is
     fine — the friend never "corrects" a word into its own
     shorter stem. */
  function undouble(b) {
    return b.length > 2 && b[b.length - 1] === b[b.length - 2] ? b.slice(0, -1) : b;
  }

  function stemForms(w) {
    const forms = [];
    if (w.endsWith("ies") && w.length > 4) forms.push(w.slice(0, -3) + "y");
    if (w.endsWith("ves") && w.length > 4) forms.push(w.slice(0, -3) + "f", w.slice(0, -3) + "fe");
    if (w.endsWith("ing") && w.length > 5) {
      const b = w.slice(0, -3);
      forms.push(b, b + "e", undouble(b));
    }
    if (w.endsWith("ed") && w.length > 4) {
      const b = w.slice(0, -2);
      forms.push(b, b + "e", undouble(b), w.slice(0, -1));
    }
    if (w.endsWith("es") && w.length > 4) forms.push(w.slice(0, -2));
    if (w.endsWith("s") && w.length > 3 && !w.endsWith("ss")) forms.push(w.slice(0, -1));
    if (w.endsWith("ly") && w.length > 4) forms.push(w.slice(0, -2));
    if (w.endsWith("er") && w.length > 4) forms.push(w.slice(0, -2), undouble(w.slice(0, -2)));
    if (w.endsWith("est") && w.length > 5) forms.push(w.slice(0, -3), undouble(w.slice(0, -3)));
    return forms;
  }

  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 99;
    const row = [];
    for (let j = 0; j <= b.length; j++) row[j] = j;
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cur = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
      }
    }
    return row[b.length];
  }

  /* One close candidate, clearly the closest, or nothing.
     The friend only speaks when it is sure. */
  function closeMatch(w) {
    const maxDist = w.length >= 7 ? 2 : 1;
    let best = null;
    let bestDist = 99;
    let ties = 0;
    for (const cand of WORDS) {
      if (Math.abs(cand.length - w.length) > maxDist) continue;
      const d = editDistance(w, cand);
      if (d < bestDist) {
        bestDist = d;
        best = cand;
        ties = 1;
      } else if (d === bestDist) {
        ties++;
      }
    }
    if (best && bestDist <= maxDist && ties === 1) return best;
    return null;
  }

  /*
   * Check one finished word.
   *   raw    the word as she typed it (letters only matter)
   *   opts   { garden: [words she owns], kept: [words she has
   *          chosen to keep], capitalized: it began with a
   *          capital, sentenceStart: it opens a sentence }
   * Names are hers to spell: a capitalised word that does not
   * open a sentence is a name, and names are always fine.
   */
  function checkWord(raw, opts) {
    const options = opts || {};
    const garden = options.garden || [];
    const kept = options.kept || [];
    const typed = String(raw || "");
    const w = typed.toLowerCase().replace(/[^a-z]/g, "");
    if (w.length < 3) return { kind: "fine", word: w };
    if (garden.indexOf(w) !== -1 || kept === true || (Array.isArray(kept) && kept.indexOf(w) !== -1)) return { kind: "fine", word: w };
    if (WORDS.has(w) || Object.prototype.hasOwnProperty.call(MEANINGS, w)) {
      return { kind: "fine", word: w };
    }
    const stems = stemForms(w);
    for (const stem of stems) {
      if (WORDS.has(stem) || Object.prototype.hasOwnProperty.call(MEANINGS, stem)) {
        return { kind: "fine", word: w };
      }
    }
    if (options.capitalized && !options.sentenceStart) return { kind: "fine", word: w };
    if (Object.prototype.hasOwnProperty.call(MISSPELLED, w)) {
      return { kind: "fix", word: w, suggestion: MISSPELLED[w] };
    }
    if (w.length >= 4) {
      const close = closeMatch(w);
      if (close) return { kind: "fix", word: w, suggestion: close };
    }
    return { kind: "unknown", word: w };
  }

  /* Match the spelling of her word: if she capitalised it,
     the fix is capitalised too. Pure — it changes nothing
     until she taps. */
  function dressedLike(typed, suggestion) {
    if (typed && typed[0] >= "A" && typed[0] <= "Z") return cap(suggestion);
    return suggestion;
  }

  /*
   * The gentle second offer, when she taps "Help me fix it"
   * on a word the friend doesn't know: the single closest
   * known word, offered AS A GUESS — or null when there is
   * no honest guess to offer.
   */
  function bestGuess(raw) {
    const w = String(raw || "").toLowerCase().replace(/[^a-z]/g, "");
    if (w.length < 4) return null;
    let best = null;
    let bestDist = 99;
    let ties = 0;
    for (const cand of WORDS) {
      if (Math.abs(cand.length - w.length) > 2) continue;
      const d = editDistance(w, cand);
      if (d < bestDist) {
        bestDist = d;
        best = cand;
        ties = 1;
      } else if (d === bestDist) {
        ties++;
      }
    }
    return best && bestDist <= 2 && ties === 1 ? best : null;
  }

  return {
    greeting,
    meetingLine,
    growthLine,
    answer,
    QUESTIONS,
    STARTERS,
    SENTENCE_HELPERS,
    MEANINGS,
    meaningOf,
    wowWord,
    unknownWordLine,
    checkWord,
    dressedLike,
    bestGuess,
    WORDS,
    MISSPELLED
  };
});
