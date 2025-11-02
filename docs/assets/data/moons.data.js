/* ======================================================================
   Remnant 13 Moons — Data Module
   Path: assets/data/moons.data.js
   Exposes:
     - window.REMNANT_MOONS   (array of 13 moon objects)
     - window.REMNANT_VERSES  (master verse library + per-moon picks)
     - window.REMNANT_EVENTS  (dot events the calendars can render)
     - window.REMNANT_THEME   (helpers for theme → CSS variables)
   Works with moons.html (v2025-11-02+)
   ====================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------
   THEME HELPER — the engine can read these and set CSS variables
   --------------------------------------------------------------- */
  const THEME = {
    apply(moon) {
      // Fallback to accent if any missing
      const v = moon.theme || {};
      const root = document.documentElement;
      root.style.setProperty("--moon-accent",  v.accent  || moon.color || "#7af3ff");
      root.style.setProperty("--moon-accent-2",v.accent2 || "#7aa8ff");
      root.style.setProperty("--moon-bg-from", v.bgFrom  || "#0b0b0f");
      root.style.setProperty("--moon-bg-to",   v.bgTo    || "#0e0e12");
      root.style.setProperty("--moon-aether",  v.aether  || "rgba(122,243,255,.12)");
    }
  };

  /* ---------------------------------------------------------------
   VERSES — Master library to prevent duplication
   Each verse has an id, Hebrew, English, and reference.
   Moons select by ids so the same verse can be reused.
   --------------------------------------------------------------- */
  const VERSES = {
    byId: {
      // Common anchors
      shma:   {heb:"שְׁמַע יִשְׂרָאֵל יהוה אֱלֹהֵינוּ יהוה אֶחָד׃", en:"Hear, O Israel: YHWH our Elohim, YHWH is One.", ref:"Deut 6:4"},
      light:  {heb:"אוֹר זָרֻעַ לַצַּדִּיק", en:"Light is sown for the righteous.", ref:"Ps 97:11"},
      heart:  {heb:"חִזְקוּ וְיַאֲמֵץ לְבַבְכֶם", en:"Be strong; let your heart be firm.", ref:"Ps 31:24"},
      rest:   {heb:"בְּשׁוּבָה וָנַחַת תִּוָּשֵׁעוּן", en:"In returning and rest you are saved.", ref:"Isa 30:15"},

      // Tone-specific highlights (at least 7 per tone → weekly rotation)
      t1_1: {heb:"קַבֵּץ לָנוּ לֵב אֶחָד", en:"Gather us into one heart.", ref:"Jer 32:39"},
      t1_2: {heb:"וְנִקְוֶה יַחְדָּו", en:"Let us hope together.", ref:"Ps 130:7"},
      t1_3: {heb:"לֵב טָהוֹר בְּרָא־לִי", en:"Create in me a clean heart.", ref:"Ps 51:10"},
      t1_4: {heb:"עַם אֶחָד", en:"A single people (aligned).", ref:"Est 3:8"},
      t1_5: {heb:"וְהָיוּ לְבָשָׂר אֶחָד", en:"They shall be one flesh.", ref:"Gen 2:24"},
      t1_6: {heb:"אֵל אֱמוּנָה", en:"El of faithfulness.", ref:"Deut 32:4"},
      t1_7: {heb:"יָחַד", en:"Togetherness—one accord.", ref:"Ps 133:1"},

      t2_1: {heb:"שְׁנַיִם יָקֻמוּ", en:"Two stand up together.", ref:"Eccl 4:12"},
      t2_2: {heb:"בְּחִירָה וּמַדָּה", en:"Choice and measure.", ref:"Prov 11:1"},
      t2_3: {heb:"בֵּין אוֹר וּבֵין חֹשֶׁךְ", en:"Between light and darkness.", ref:"Gen 1:4"},
      t2_4: {heb:"דֶּרֶךְ חַיִּים וְדֶרֶךְ מָוֶת", en:"Path of life and path of death.", ref:"Jer 21:8"},
      t2_5: {heb:"חֹק וּמִשְׁפָּט", en:"Statute and right-judgment.", ref:"Ex 15:25"},
      t2_6: {heb:"מֹאזְנֵי־צֶדֶק", en:"Just balances.", ref:"Lev 19:36"},
      t2_7: {heb:"הַבְּרָכָה וְהַקְּלָלָה", en:"Blessing and curse.", ref:"Deut 11:26"},

      t3_1: {heb:"וְעֹשֵׂה חֶסֶד", en:"Do mercy.", ref:"Mic 6:8"},
      t3_2: {heb:"עֶבֶד לֵב", en:"Servant-heart.", ref:"Ps 19:14"},
      t3_3: {heb:"עֲבוֹדָה בְּשִׂמְחָה", en:"Serve with gladness.", ref:"Ps 100:2"},
      t3_4: {heb:"שְׁמֹר וַעֲשֵׂה", en:"Guard and do.", ref:"Deut 5:1"},
      t3_5: {heb:"תְּנוּ כֹחַ לֵאלֹהִים", en:"Give power to Elohim (lift).", ref:"Ps 68:34"},
      t3_6: {heb:"חֶסֶד וֶאֱמֶת", en:"Kindness and truth.", ref:"Prov 3:3"},
      t3_7: {heb:"מַעֲשֵׂה יָדֶיךָ", en:"Work of your hands.", ref:"Ps 90:17"},

      // …(continue similarly for tones 4–13; keeping master ids compact)
      t4_1: {heb:"צּוּר לְבָבִי", en:"Rock of my heart.", ref:"Ps 73:26"},
      t4_2: {heb:"תֵּן מִשְׁפָּט", en:"Give right judgment.", ref:"Ps 72:1"},
      t4_3: {heb:"סֵדֶר", en:"Order / form.", ref:"Job 10:22"},
      t4_4: {heb:"מַחֲשָׁבָה לְמַעֲשֶׂה", en:"Thought into form.", ref:"Prov 16:3"},
      t4_5: {heb:"אוֹרְחוֹת יָשָׁר", en:"Paths made straight.", ref:"Prov 3:6"},
      t4_6: {heb:"מִשְׁקָל", en:"Measured weight.", ref:"Prov 16:11"},
      t4_7: {heb:"חֹקֶיךָ אַשְׁתָּעֲשֵׁעַ", en:"I delight in Your statutes.", ref:"Ps 119:16"},

      // (for brevity: tones 5–13 use existing verses already in your page; you can expand here freely)
    },

    /* Picks for each moon:
       - weekly: array of 7 ids (cycle weekly dots)
       - dailyFallback: choose one when not yet curated per-day
       You can also add a full per-day map {1: 'id', 2: 'id', ... 28:'id'} later.
    */
    picks: {
      common: ["shma","light","heart"],
      doot:   ["rest"],

      1:  { weekly:["t1_1","t1_2","t1_3","t1_4","t1_5","t1_6","t1_7"], dailyFallback:"t1_1" },
      2:  { weekly:["t2_1","t2_2","t2_3","t2_4","t2_5","t2_6","t2_7"], dailyFallback:"t2_1" },
      3:  { weekly:["t3_1","t3_2","t3_3","t3_4","t3_5","t3_6","t3_7"], dailyFallback:"t3_1" },
      4:  { weekly:["t4_1","t4_2","t4_3","t4_4","t4_5","t4_6","t4_7"], dailyFallback:"t4_2" },
      5:  { weekly:["light","t1_6","t3_5","t4_5","t3_6","shma","heart"], dailyFallback:"light" },
      6:  { weekly:["t4_6","t2_6","t3_4","t4_3","heart","t3_7","light"], dailyFallback:"t4_6" },
      7:  { weekly:["shma","t3_1","t1_3","t1_6","light","t3_6","heart"], dailyFallback:"shma" },
      8:  { weekly:["t4_2","t2_5","t3_6","t4_5","light","heart","shma"], dailyFallback:"t4_2" },
      9:  { weekly:["t3_5","light","t4_5","shma","t3_7","heart","t1_5"], dailyFallback:"t3_5" },
      10: { weekly:["t4_4","t3_4","t4_6","t3_7","light","shma","heart"], dailyFallback:"t4_4" },
      11: { weekly:["t2_7","t3_2","t4_3","t2_3","heart","light","shma"], dailyFallback:"t2_7" },
      12: { weekly:["heart","t3_6","t4_2","t1_7","light","shma","t3_1"], dailyFallback:"heart" },
      13: { weekly:["rest","shma","light","heart","t1_3","t3_7","t4_5"],  dailyFallback:"rest" }
    }
  };

  /* ---------------------------------------------------------------
   EVENTS — optional dots that the calendars can render
   - type: "evt1" | "evt2" (ties to your legend)
   - day: 1..28 inside the moon
   --------------------------------------------------------------- */
  const EVENTS = {
    // Global templates that apply to each moon (you can override per moon)
    defaults: [
      { type:"evt1", day:1,  label:"Opening Rite" },
      { type:"evt2", day:7,  label:"Covenant Circle" },
      { type:"evt1", day:13, label:"Mid-Moon Offering" },
      { type:"evt2", day:21, label:"Remnant Vigil" },
      { type:"evt1", day:28, label:"Closing Rite" },
    ],
    // Per-moon additional or overrides (optional)
    perMoon: {
      5: [{ type:"evt1", day:5, label:"Overtone Crown" }],
      7: [{ type:"evt2", day:7, label:"Resonant Attunement" }],
      9: [{ type:"evt1", day:9, label:"Solar Intention Fire" }]
    }
  };

  /* ---------------------------------------------------------------
   MOONS — full metadata for 13 moons
   - Keep your original keys; add theme, weeklyFocus, stones, herbs, etc.
   --------------------------------------------------------------- */
  const MOONS = [
    {
      idx: 1, tone: 1, slug: "magnetic", name: "Magnetic",
      essence: "Unify · Purpose", affirmation: "I gather my purpose into one.",
      color: "#6FE7FF",
      hebrew: "אַחְדוּת", rtl: true, psalm: "Psalm 1",
      codex: "theory.html#magnetic", essay: "codex/magnetic.html",
      sigil: "assets/sigils/magnetic.svg", image: "assets/art/magnetic.jpg",
      audio: "assets/audio/magnetic.mp3", link: "moons.html#moon-1",
      resonant: false,
      theme: { accent:"#9cf", accent2:"#5ef", bgFrom:"#08131c", bgTo:"#0b1a26", aether:"rgba(140,200,255,.12)"},
      practice: [
        "Clarify your purpose in one sentence.",
        "Choose one devotion you will repeat daily this moon."
      ],
      weeklyFocus: [
        "Week 1: Gathering — reduce three scattered threads into one intention.",
        "Week 2: Alignment — prune tasks that do not serve the intention.",
        "Week 3: Power-up — feed the intention (time, attention, resource).",
        "Week 4: Witness — record a measurable shift that emerged."
      ],
      stones: ["Lapis", "Aquamarine"], herbs: ["Rosemary", "Mint"],
      carriers: ["432", "528"], // sonic carriers you prefer
      ceremony: {
        opening: "Kindle a single flame; speak the intention once, silently once.",
        closing: "Extinguish with breath; mark the ledger with one sentence."
      }
    },
    {
      idx: 2, tone: 2, slug: "lunar", name: "Lunar",
      essence: "Polarize · Challenge", affirmation: "I see the two poles clearly.",
      color: "#B1C7FF",
      hebrew: "אִזּוּן", rtl: true, psalm: "Psalm 15",
      codex:"theory.html#lunar", essay:"codex/lunar.html",
      sigil:"assets/sigils/lunar.svg", image:"assets/art/lunar.jpg",
      audio:"assets/audio/lunar.mp3", link:"moons.html#moon-2",
      resonant:false,
      theme:{accent:"#ffb4a8", accent2:"#ff866b", bgFrom:"#201015", bgTo:"#2b1218", aether:"rgba(255,118,86,.12)"},
      practice:[
        "Name the two poles in your current dilemma.",
        "Pick one stabilizing constraint for the week."
      ],
      weeklyFocus:[
        "Week 1: Map the opposites without judgment.",
        "Week 2: Choose a rule that reduces chaos (one small constraint).",
        "Week 3: Test your constraint; keep score daily.",
        "Week 4: Integrate the learning into your standard."
      ],
      stones:["Moonstone"], herbs:["Sage"], carriers:["432","369"]
    },
    {
      idx: 3, tone: 3, slug: "electric", name: "Electric",
      essence: "Activate · Service", affirmation: "I move in service today.",
      color:"#7AF3FF", hebrew:"שֵׁרוּת", rtl:true, psalm:"Psalm 24",
      codex:"theory.html#electric", essay:"codex/electric.html",
      sigil:"assets/sigils/electric.svg", image:"assets/art/electric.jpg",
      audio:"assets/audio/electric.mp3", link:"moons.html#moon-3",
      resonant:false,
      theme:{accent:"#ffd37a", accent2:"#ffe6a8", bgFrom:"#1f1808", bgTo:"#2a210c", aether:"rgba(255,214,122,.10)"},
      practice:[
        "List three ways to serve your purpose.",
        "Take one helpful action for someone today."
      ],
      weeklyFocus:[
        "Week 1: Identify who benefits from your work.",
        "Week 2: Serve one person concretely (deliver something).",
        "Week 3: Improve the delivery (faster, clearer, kinder).",
        "Week 4: Teach the service to another (multiply)."
      ],
      stones:["Citrine"], herbs:["Lemon balm"], carriers:["528"]
    },
    {
      idx: 4, tone: 4, slug: "self-existing", name: "Self-Existing",
      essence:"Define · Form", affirmation:"I shape clear and true forms.",
      color:"#7BF3B8", hebrew:"צוּרָה", rtl:true, psalm:"Psalm 90:12",
      codex:"theory.html#self-existing", essay:"codex/self-existing.html",
      sigil:"assets/sigils/self-existing.svg", image:"assets/art/self-existing.jpg",
      audio:"assets/audio/self-existing.mp3", link:"moons.html#moon-4",
      resonant:false,
      theme:{accent:"#b6ffcc", accent2:"#6dff9e", bgFrom:"#0a1a12", bgTo:"#0f2218", aether:"rgba(120,255,180,.10)"},
      practice:[
        "Draw the form of your project: inputs → alchemy → outputs.",
        "Name constraints that actually set you free."
      ],
      weeklyFocus:[
        "Week 1: Sketch the system (one diagram).",
        "Week 2: Choose three constraints that clarify form.",
        "Week 3: Build a minimum slice of the form.",
        "Week 4: Remove one ornamental piece; keep essence."
      ],
      stones:["Green aventurine"], herbs:["Nettle"], carriers:["144","432"]
    },
    {
      idx: 5, tone: 5, slug: "overtone", name: "Overtone",
      essence:"Empower · Radiance", affirmation:"I amplify the good I carry.",
      color:"#FFD27A", hebrew:"זוֹהַר", rtl:true, psalm:"Psalm 27",
      codex:"theory.html#overtone", essay:"codex/overtone.html",
      sigil:"assets/sigils/overtone.svg", image:"assets/art/overtone.jpg",
      audio:"assets/audio/overtone.mp3", link:"moons.html#moon-5",
      resonant:false,
      theme:{accent:"#ffe07a", accent2:"#ffc84d", bgFrom:"#211a07", bgTo:"#2a2109", aether:"rgba(255,200,90,.12)"},
      practice:[
        "Identify one strength to amplify.",
        "Share a small win publicly."
      ],
      weeklyFocus:[
        "Week 1: Inventory strengths (3).",
        "Week 2: Amplify one strength in public.",
        "Week 3: Add polish to presentation.",
        "Week 4: Teach that strength to a peer."
      ],
      stones:["Sunstone"], herbs:["St. John’s wort"], carriers:["528","963"]
    },
    {
      idx: 6, tone: 6, slug: "rhythmic", name: "Rhythmic",
      essence:"Organize · Equality", affirmation:"I balance work and restoration.",
      color:"#A7FFCF", hebrew:"שִׁוּוּי", rtl:true, psalm:"Psalm 133",
      codex:"theory.html#rhythmic", essay:"codex/rhythmic.html",
      sigil:"assets/sigils/rhythmic.svg", image:"assets/art/rhythmic.jpg",
      audio:"assets/audio/rhythmic.mp3", link:"moons.html#moon-6",
      resonant:false,
      theme:{accent:"#9ef", accent2:"#6bf", bgFrom:"#07151a", bgTo:"#0a1b22", aether:"rgba(120,230,255,.10)"},
      practice:[
        "Design a daily cadence (morning, noon, night).",
        "Balance effort with restoration."
      ],
      weeklyFocus:[
        "Week 1: Build the cadence.",
        "Week 2: Add a 5-minute recovery block after hard work.",
        "Week 3: Equalize commitments across days.",
        "Week 4: Measure energy; adjust cadence."
      ],
      stones:["Hematite"], herbs:["Chamomile"], carriers:["432"]
    },
    {
      idx: 7, tone: 7, slug: "resonant", name: "Resonant",
      essence:"Channel · Inspiration", affirmation:"I open and receive the signal.",
      color:"#7AF3FF", hebrew:"הַשְׁרָאָה", rtl:true, psalm:"Psalm 46",
      codex:"theory.html#resonant", essay:"codex/resonant.html",
      sigil:"assets/sigils/resonant.svg", image:"assets/art/resonant.jpg",
      audio:"assets/audio/resonant.mp3", link:"moons.html#moon-7",
      resonant:true,
      theme:{accent:"#d5b6ff", accent2:"#b98cff", bgFrom:"#160d22", bgTo:"#1c1030", aether:"rgba(190,140,255,.12)"},
      practice:[
        "Create a short ritual to open the channel.",
        "Sit in silence for seven minutes daily."
      ],
      weeklyFocus:[
        "Week 1: Quiet the noise (digital fast 1 hr/day).",
        "Week 2: Tune a single question; wait for answer.",
        "Week 3: Record signals (journal, audio).",
        "Week 4: Act on one signal; reflect."
      ],
      stones:["Amethyst"], herbs:["Mugwort"], carriers:["963","432"]
    },
    {
      idx: 8, tone: 8, slug: "galactic", name: "Galactic",
      essence:"Harmonize · Integrity", affirmation:"I align action with values.",
      color:"#9BD3FF", hebrew:"תֹּם", rtl:true, psalm:"Psalm 19",
      codex:"theory.html#galactic", essay:"codex/galactic.html",
      sigil:"assets/sigils/galactic.svg", image:"assets/art/galactic.jpg",
      audio:"assets/audio/galactic.mp3", link:"moons.html#moon-8",
      resonant:false,
      theme:{accent:"#a8ffd9", accent2:"#7affc4", bgFrom:"#0a1713", bgTo:"#0e1e18", aether:"rgba(130,255,210,.10)"},
      practice:[
        "Write your eight core values.",
        "Align one habit with those values."
      ],
      weeklyFocus:[
        "Week 1: Write values and definitions.",
        "Week 2: Map misalignments.",
        "Week 3: Replace one misaligned habit.",
        "Week 4: Public accountability check."
      ],
      stones:["Jade"], herbs:["Basil"], carriers:["528"]
    },
    {
      idx: 9, tone: 9, slug: "solar", name: "Solar",
      essence:"Pulse · Intention", affirmation:"I set and move with clear intent.",
      color:"#FFBC6F", hebrew:"כַּוָּנָה", rtl:true, psalm:"Psalm 19:14",
      codex:"theory.html#solar", essay:"codex/solar.html",
      sigil:"assets/sigils/solar.svg", image:"assets/art/solar.jpg",
      audio:"assets/audio/solar.mp3", link:"moons.html#moon-9",
      resonant:false,
      theme:{accent:"#ff927a", accent2:"#ff6a55", bgFrom:"#1e0e0b", bgTo:"#270f0c", aether:"rgba(255,120,100,.12)"},
      practice:[
        "Set one clear intention for the week.",
        "Take one bold, visible step toward it."
      ],
      weeklyFocus:[
        "Week 1: Write the intention in nine words.",
        "Week 2: Daily micro-pulse toward it.",
        "Week 3: Remove one blocker.",
        "Week 4: Present the outcome."
      ],
      stones:["Carnelian"], herbs:["Ginger"], carriers:["432","528"]
    },
    {
      idx: 10, tone: 10, slug: "planetary", name: "Planetary",
      essence:"Perfect · Manifestation", affirmation:"I ship a complete slice.",
      color:"#FFD9A6", hebrew:"הַגְשָׁמָה", rtl:true, psalm:"Psalm 37",
      codex:"theory.html#planetary", essay:"codex/planetary.html",
      sigil:"assets/sigils/planetary.svg", image:"assets/art/planetary.jpg",
      audio:"assets/audio/planetary.mp3", link:"moons.html#moon-10",
      resonant:false,
      theme:{accent:"#a2ffd1", accent2:"#73ffc0", bgFrom:"#0c1912", bgTo:"#102219", aether:"rgba(140,255,200,.10)"},
      practice:[
        "Ship a minimum complete slice.",
        "Refine one detail that delights."
      ],
      weeklyFocus:[
        "Week 1: Define done.",
        "Week 2: Build the working slice.",
        "Week 3: QA + iterate.",
        "Week 4: Deliver + document."
      ],
      stones:["Malachite"], herbs:["Thyme"], carriers:["528","144"]
    },
    {
      idx: 11, tone: 11, slug: "spectral", name: "Spectral",
      essence:"Dissolve · Liberation", affirmation:"I let go of the nonessential.",
      color:"#B8C7FF", hebrew:"שִׁחְרוּר", rtl:true, psalm:"Psalm 32",
      codex:"theory.html#spectral", essay:"codex/spectral.html",
      sigil:"assets/sigils/spectral.svg", image:"assets/art/spectral.jpg",
      audio:"assets/audio/spectral.mp3", link:"moons.html#moon-11",
      resonant:false,
      theme:{accent:"#a8b8ff", accent2:"#7a8cff", bgFrom:"#0b0f22", bgTo:"#0e1230", aether:"rgba(120,140,255,.10)"},
      practice:[
        "Identify and drop one nonessential commitment.",
        "Do a 10-minute clutter release daily."
      ],
      weeklyFocus:[
        "Week 1: Inventory what drains.",
        "Week 2: Cancel one drain.",
        "Week 3: Automate or delegate another.",
        "Week 4: Celebrate the freed capacity."
      ],
      stones:["Obsidian"], herbs:["Sagebrush"], carriers:["432"]
    },
    {
      idx: 12, tone: 12, slug: "crystal", name: "Crystal",
      essence:"Dedicate · Cooperation", affirmation:"I dedicate my gifts to the whole.",
      color:"#CFEFFF", hebrew:"אַחְוָה", rtl:true, psalm:"Psalm 133:1",
      codex:"theory.html#crystal", essay:"codex/crystal.html",
      sigil:"assets/sigils/crystal.svg", image:"assets/art/crystal.jpg",
      audio:"assets/audio/crystal.mp3", link:"moons.html#moon-12",
      resonant:false,
      theme:{accent:"#a8b8ff", accent2:"#7a8cff", bgFrom:"#0b0f22", bgTo:"#0e1230", aether:"rgba(120,140,255,.10)"},
      practice:[
        "Schedule one collaborative session.",
        "Name how your work serves the whole."
      ],
      weeklyFocus:[
        "Week 1: Identify allies.",
        "Week 2: Co-create a small artifact.",
        "Week 3: Share it with the circle.",
        "Week 4: Document the learnings."
      ],
      stones:["Clear Quartz"], herbs:["Lavender"], carriers:["528","963"]
    },
    {
      idx: 13, tone: 13, slug: "cosmic", name: "Cosmic",
      essence:"Endure · Presence", affirmation:"I rest in still presence.",
      color:"#E7D1FF", hebrew:"נְצִיחוּת", rtl:true, psalm:"Psalm 46:10",
      codex:"theory.html#cosmic", essay:"codex/cosmic.html",
      sigil:"assets/sigils/cosmic.svg", image:"assets/art/cosmic.jpg",
      audio:"assets/audio/cosmic.mp3", link:"moons.html#moon-13",
      resonant:false,
      theme:{accent:"#9df", accent2:"#7cf", bgFrom:"#0a1016", bgTo:"#0c1218", aether:"rgba(140,220,255,.12)"},
      practice:[
        "Practice stillness for 13 breaths.",
        "Close one loop with gratitude."
      ],
      weeklyFocus:[
        "Week 1: Slow the pace (half-speed hour).",
        "Week 2: Keep presence in motion (walking prayer).",
        "Week 3: Offer silence to a friend (listening).",
        "Week 4: Seal the year with thanks."
      ],
      stones:["Selenite"], herbs:["Valerian"], carriers:["963"]
    }
  ];

  /* ---------------------------------------------------------------
   WIRING HELPERS — tiny utilities the engine can call
   --------------------------------------------------------------- */
  function verseForDay(pos, wallDate) {
    // Use weekly mapping if present; otherwise dailyFallback; always with common pool
    if (pos.doot) {
      const id = (VERSES.picks.doot || ["rest"])[ (wallDate.getUTCDay()) % (VERSES.picks.doot.length) ];
      return VERSES.byId[id];
    }
    const pack = VERSES.picks[pos.moon];
    if (!pack) return VERSES.byId.shma;
    const weekly = pack.weekly || [];
    const id = weekly.length ? weekly[(pos.week-1) % weekly.length] : pack.dailyFallback;
    const base = VERSES.byId[id] || VERSES.byId.shma;

    // Blend in a common verse sometimes (e.g., on day 7, 14, 21, 28)
    const isCrown = [7,14,21,28].includes(pos.day);
    if (isCrown) {
      const commons = VERSES.picks.common.map(x=>VERSES.byId[x]);
      const pick = commons[ pos.day/7 % commons.length | 0 ];
      // Prefer Hebrew roots verse but keep English body priority
      return {heb: pick.heb, en: base.en, ref: base.ref + " + " + pick.ref};
    }
    return base;
  }

  function eventsForMoon(moonIndex) {
    const base = EVENTS.defaults.slice();
    const extras = (EVENTS.perMoon[moonIndex] || []);
    return [...base, ...extras];
  }

  // Expose globals for the engine
  window.REMNANT_THEME  = THEME;
  window.REMNANT_VERSES = VERSES;
  window.REMNANT_EVENTS = EVENTS;
  window.REMNANT_MOONS  = MOONS;
  window.remnantVerseForDay = verseForDay;
  window.remnantEventsForMoon = eventsForMoon;
})();
