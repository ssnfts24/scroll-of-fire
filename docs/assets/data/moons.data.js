/* ======================================================================
   Remnant 13 Moons — Data Module (enhanced)
   Path: assets/data/moons.data.js
   Exposes:
     - window.REMNANT_MOONS   (array of 13 moon objects)
     - window.REMNANT_VERSES  (master verse library + per-moon picks)
     - window.REMNANT_EVENTS  (dot events the calendars can render)
     - window.REMNANT_THEME   (helpers for theme → CSS variables)
     - window.remnantVerseForDay(pos, wallDate)
     - window.remnantEventsForMoon(moonIndex)
     - window.RemnantAPI (getters to help other pages)
   Works with moons.html (v2025-11-02+)
   ====================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------
   THEME HELPER — the engine can read these and set CSS variables
   --------------------------------------------------------------- */
  const THEME = {
    apply(moon) {
      if (!moon) return;
      const v = moon.theme || {};
      const root = document.documentElement;
      root.style.setProperty("--moon-accent",  v.accent  || moon.color || "#7af3ff");
      root.style.setProperty("--moon-accent-2",v.accent2 || "#7aa8ff");
      root.style.setProperty("--moon-bg-from", v.bgFrom  || "#0b0b0f");
      root.style.setProperty("--moon-bg-to",   v.bgTo    || "#0e0e12");
      root.style.setProperty("--moon-aether",  v.aether  || "rgba(122,243,255,.12)");
      if (v.rim)    root.style.setProperty("--rim", v.rim);
      if (v.grain)  root.style.setProperty("--grain", v.grain);
      if (v.spark)  root.style.setProperty("--spark", v.spark);
      if (v.pulse)  root.style.setProperty("--pulse", v.pulse);
      if (v.aurora) root.style.setProperty("--aurora", v.aurora);
    },
    // Optional daily drift hook; caller can pass the same seed your page uses
    applyDynamic(seed = 0) {
      const root = document.documentElement;
      const rand = (n) => {
        let x = (seed + (n|0)) || 1; x ^= x<<13; x ^= x>>>17; x ^= x<<5; return (x>>>0)/4294967296;
      };
      const twist = ((rand(11)-0.5)*10).toFixed(2) + "deg";
      root.style.setProperty("--twist", twist);
      root.style.setProperty("--pulse", (0.035 + rand(13)*0.05).toFixed(3));
      root.style.setProperty("--spark", (0.30 + rand(17)*0.12).toFixed(3));
      root.style.setProperty("--aurora",(0.45 + rand(19)*0.3 ).toFixed(3));
    }
  };

  /* ---------------------------------------------------------------
   VERSES — Master library (Hebrew + English + reference)
   Each id is unique and reusable; moons select by id.
   --------------------------------------------------------------- */
  const V = {
    // Common anchors
    shma:   {heb:"שְׁמַע יִשְׂרָאֵל יהוה אֱלֹהֵינוּ יהוה אֶחָד׃", en:"Hear, O Israel: YHWH our Elohim, YHWH is One.", ref:"Deut 6:4"},
    light:  {heb:"אוֹר זָרֻעַ לַצַּדִּיק", en:"Light is sown for the righteous.", ref:"Ps 97:11"},
    heart:  {heb:"חִזְקוּ וְיַאֲמֵץ לְבַבְכֶם", en:"Be strong; let your heart be firm.", ref:"Ps 31:24"},
    rest:   {heb:"בְּשׁוּבָה וָנַחַת תִּוָּשֵׁעוּן", en:"In returning and rest you are saved.", ref:"Isa 30:15"},

    // Tone 1 (Magnetic) — 7 weekly
    t1_1: {heb:"קַבֵּץ לָנוּ לֵב אֶחָד", en:"Gather us into one heart.", ref:"Jer 32:39"},
    t1_2: {heb:"וְנִקְוֶה יַחְדָּו", en:"Let us hope together.", ref:"Ps 130:7"},
    t1_3: {heb:"לֵב טָהוֹר בְּרָא־לִי", en:"Create in me a clean heart.", ref:"Ps 51:10"},
    t1_4: {heb:"עַם אֶחָד", en:"A single people—aligned.", ref:"Est 3:8"},
    t1_5: {heb:"וְהָיוּ לְבָשָׂר אֶחָד", en:"They shall be one flesh.", ref:"Gen 2:24"},
    t1_6: {heb:"אֵל אֱמוּנָה", en:"El of faithfulness.", ref:"Deut 32:4"},
    t1_7: {heb:"יָחַד", en:"Togetherness; one accord.", ref:"Ps 133:1"},

    // Tone 2 (Lunar)
    t2_1: {heb:"שְׁנַיִם יָקֻמוּ", en:"Two stand together.", ref:"Eccl 4:12"},
    t2_2: {heb:"בְּחִירָה וּמַדָּה", en:"Choice and measure.", ref:"Prov 11:1"},
    t2_3: {heb:"בֵּין אוֹר וּבֵין חֹשֶׁךְ", en:"Between light and darkness.", ref:"Gen 1:4"},
    t2_4: {heb:"דֶּרֶךְ חַיִּים וְדֶרֶךְ מָוֶת", en:"Path of life and path of death.", ref:"Jer 21:8"},
    t2_5: {heb:"חֹק וּמִשְׁפָּט", en:"Statute and right-judgment.", ref:"Ex 15:25"},
    t2_6: {heb:"מֹאזְנֵי־צֶדֶק", en:"Just balances.", ref:"Lev 19:36"},
    t2_7: {heb:"הַבְּרָכָה וְהַקְּלָלָה", en:"Blessing and curse.", ref:"Deut 11:26"},

    // Tone 3 (Electric)
    t3_1: {heb:"וְעֹשֵׂה חֶסֶד", en:"Do mercy.", ref:"Mic 6:8"},
    t3_2: {heb:"עֶבֶד לֵב", en:"Servant-heart.", ref:"Ps 19:14"},
    t3_3: {heb:"עֲבוֹדָה בְּשִׂמְחָה", en:"Serve with gladness.", ref:"Ps 100:2"},
    t3_4: {heb:"שְׁמֹר וַעֲשֵׂה", en:"Guard and do.", ref:"Deut 5:1"},
    t3_5: {heb:"תְּנוּ כֹחַ לֵאלֹהִים", en:"Give power to Elohim.", ref:"Ps 68:34"},
    t3_6: {heb:"חֶסֶד וֶאֱמֶת", en:"Kindness and truth.", ref:"Prov 3:3"},
    t3_7: {heb:"מַעֲשֵׂה יָדֶיךָ", en:"Work of your hands.", ref:"Ps 90:17"},

    // Tone 4 (Self-Existing)
    t4_1: {heb:"צוּר לְבָבִי", en:"Rock of my heart.", ref:"Ps 73:26"},
    t4_2: {heb:"תֵּן מִשְׁפָּט", en:"Give right-judgment.", ref:"Ps 72:1"},
    t4_3: {heb:"סֵדֶר", en:"Order / form.", ref:"Job 10:22"},
    t4_4: {heb:"מַחֲשָׁבָה לְמַעֲשֶׂה", en:"Thought into form.", ref:"Prov 16:3"},
    t4_5: {heb:"אוֹרְחוֹת יָשָׁר", en:"Paths made straight.", ref:"Prov 3:6"},
    t4_6: {heb:"מִשְׁקָל", en:"Measured weight.", ref:"Prov 16:11"},
    t4_7: {heb:"חֹקֶיךָ אַשְׁתָּעֲשֵׁעַ", en:"I delight in Your statutes.", ref:"Ps 119:16"},

    // Tone 5 (Overtone)
    t5_1: {heb:"בָּרוּךְ כְּבוֹד יהוה", en:"Blessed be the radiance of YHWH.", ref:"Ezek 3:12"},
    t5_2: {heb:"אוֹר פָּנֶיךָ", en:"Light of Your face.", ref:"Ps 4:6"},
    t5_3: {heb:"זְהִירוּת", en:"Shine with care.", ref:"—"},
    t5_4: {heb:"רוֹמְמוּ יהּ", en:"Exalt Yah.", ref:"Ps 68:4"},
    t5_5: {heb:"כָּבוֹד", en:"Glory (weight of goodness).", ref:"—"},
    t5_6: {heb:"לְהָאִיר", en:"To illuminate.", ref:"—"},
    t5_7: {heb:"זֹהַר", en:"Radiance.", ref:"—"},

    // Tone 6 (Rhythmic)
    t6_1: {heb:"מִשְׁקָל מְאֻזָּן", en:"Balanced measure.", ref:"Prov 11:1"},
    t6_2: {heb:"מִדָּה כְּנֶגֶד מִדָּה", en:"Measure for measure.", ref:"—"},
    t6_3: {heb:"מִשְׁפָּט וּצְדָקָה", en:"Justice and rightness.", ref:"Gen 18:19"},
    t6_4: {heb:"שָׁבָת", en:"Sabbath (cadence).", ref:"Gen 2:3"},
    t6_5: {heb:"מָנוֹחַ", en:"Resting place.", ref:"—"},
    t6_6: {heb:"תִּקּוּן", en:"Repair / tune.", ref:"—"},
    t6_7: {heb:"שִׁוּוּי", en:"Equilibrium.", ref:"—"},

    // Tone 7 (Resonant)
    t7_1: {heb:"קוֹל דְּמָמָה דַקָּה", en:"The thin sound of quiet.", ref:"1 Kings 19:12"},
    t7_2: {heb:"הַבִּיטוּ אֵלַי", en:"Look unto Me.", ref:"Isa 45:22"},
    t7_3: {heb:"הַקְשֵׁב", en:"Give ear; attend.", ref:"Ps 80:1"},
    t7_4: {heb:"שִׁמְעִי בִּתִּי", en:"Hear, my daughter.", ref:"Ps 45:10"},
    t7_5: {heb:"דָּבָר", en:"A word sent.", ref:"Ps 107:20"},
    t7_6: {heb:"בִּינָה", en:"Understanding.", ref:"Prov 2:2"},
    t7_7: {heb:"הַשְׁרָאָה", en:"Inspiration.", ref:"—"},

    // Tone 8 (Galactic)
    t8_1: {heb:"צֶדֶק צֶדֶק תִּרְדֹּף", en:"Justice, justice you shall pursue.", ref:"Deut 16:20"},
    t8_2: {heb:"תֹּם", en:"Integrity.", ref:"—"},
    t8_3: {heb:"דֶּרֶךְ אֱמֶת", en:"Way of truth.", ref:"Ps 119:30"},
    t8_4: {heb:"לֵב נָכוֹן", en:"Right-steadfast heart.", ref:"Ps 51:10"},
    t8_5: {heb:"יָשָׁר", en:"Upright.", ref:"Ps 33:1"},
    t8_6: {heb:"חֶסֶד נֶאֱמָן", en:"Faithful kindness.", ref:"—"},
    t8_7: {heb:"אוֹמֶר נָכוֹן", en:"Straight speech.", ref:"—"},

    // Tone 9 (Solar)
    t9_1: {heb:"נֵר יהוה נִשְׁמַת אָדָם", en:"The lamp of YHWH is the human breath.", ref:"Prov 20:27"},
    t9_2: {heb:"כַּוָּנָה", en:"Intention.", ref:"—"},
    t9_3: {heb:"עֵזֶר מִלְמַעְלָה", en:"Help from above.", ref:"Ps 121:2"},
    t9_4: {heb:"אוֹר יֵשַׁע", en:"Light of deliverance.", ref:"Ps 27:1"},
    t9_5: {heb:"הַצְלָחָה", en:"Prospering step.", ref:"—"},
    t9_6: {heb:"מַחֲשָׁבָה בְּרוּרָה", en:"Clear thought.", ref:"—"},
    t9_7: {heb:"נָתִיב", en:"A path trodden.", ref:"—"},

    // Tone 10 (Planetary)
    t10_1:{heb:"תָּמִים פָּעֳלוֹ", en:"Perfect is His work.", ref:"Deut 32:4"},
    t10_2:{heb:"מַעֲשֶׂה בְּיָדַיִם", en:"Work with hands.", ref:"—"},
    t10_3:{heb:"קְצִיר", en:"Harvest.", ref:"—"},
    t10_4:{heb:"תִּקּוּן פְּרָטִים", en:"Polish the details.", ref:"—"},
    t10_5:{heb:"בְּרָכָה עַל הַמַּעֲשֶׂה", en:"Bless the craft.", ref:"—"},
    t10_6:{heb:"סֵפֶר מַעֲשִׂים", en:"Ledger of deeds.", ref:"—"},
    t10_7:{heb:"גְּמַר מְלָאכָה", en:"Ship the work.", ref:"—"},

    // Tone 11 (Spectral)
    t11_1:{heb:"שַׁלַּח לַחְמְךָ", en:"Cast your bread upon the waters.", ref:"Eccl 11:1"},
    t11_2:{heb:"הַתֵּר אֲסוּרִים", en:"Loose the bound.", ref:"Isa 58:6"},
    t11_3:{heb:"חֹפֶשׁ", en:"Liberty.", ref:"—"},
    t11_4:{heb:"סוּר מֵרָע", en:"Turn from evil.", ref:"Ps 34:14"},
    t11_5:{heb:"בָּטַח", en:"Trust / let go.", ref:"—"},
    t11_6:{heb:"פְּשִׁיטוּת", en:"Simplicity.", ref:"—"},
    t11_7:{heb:"הַקָּלָה", en:"Unburden.", ref:"—"},

    // Tone 12 (Crystal)
    t12_1:{heb:"עֵדָה קְדוֹשָׁה", en:"Holy assembly.", ref:"Ps 149:1"},
    t12_2:{heb:"אַחְוָה", en:"Brotherhood / fellowship.", ref:"—"},
    t12_3:{heb:"תְּקוּפָה יַחַד", en:"A season together.", ref:"—"},
    t12_4:{heb:"יָד בְּיָד", en:"Hand in hand.", ref:"—"},
    t12_5:{heb:"מַתָּנָה", en:"Gift to the whole.", ref:"—"},
    t12_6:{heb:"כַּוָּנָה שֻׁתָּפִית", en:"Shared intention.", ref:"—"},
    t12_7:{heb:"שִׁיר חָדָשׁ", en:"A new song.", ref:"Ps 96:1"},

    // Tone 13 (Cosmic)
    t13_1:{heb:"הַרְפּוּ וּדְעוּ", en:"Be still and know.", ref:"Ps 46:10"},
    t13_2:{heb:"עוֹלָם וָעֶד", en:"Unto the ages.", ref:"Ex 15:18"},
    t13_3:{heb:"נֶפֶשׁ שֹׁקֵטֶת", en:"Quieted soul.", ref:"Ps 131:2"},
    t13_4:{heb:"מְנוּחָה", en:"Deep rest.", ref:"—"},
    t13_5:{heb:"מְסִירַת תּוֹדָה", en:"Offering of thanks.", ref:"Ps 107:22"},
    t13_6:{heb:"אֱמוּנָה נֶאֱמָנָה", en:"Faith that abides.", ref:"—"},
    t13_7:{heb:"שָׁלוֹם רָב", en:"Great shalom.", ref:"Ps 119:165"},
  };

  const VERSES = {
    byId: V,
    picks: {
      common: ["shma","light","heart"],
      doot:   ["rest"],
      1:  { weekly:["t1_1","t1_2","t1_3","t1_4","t1_5","t1_6","t1_7"], dailyFallback:"t1_1" },
      2:  { weekly:["t2_1","t2_2","t2_3","t2_4","t2_5","t2_6","t2_7"], dailyFallback:"t2_1" },
      3:  { weekly:["t3_1","t3_2","t3_3","t3_4","t3_5","t3_6","t3_7"], dailyFallback:"t3_1" },
      4:  { weekly:["t4_1","t4_2","t4_3","t4_4","t4_5","t4_6","t4_7"], dailyFallback:"t4_2" },
      5:  { weekly:["t5_1","t5_2","t5_3","t5_4","t5_5","t5_6","t5_7"], dailyFallback:"t5_1" },
      6:  { weekly:["t6_1","t6_2","t6_3","t6_4","t6_5","t6_6","t6_7"], dailyFallback:"t6_1" },
      7:  { weekly:["t7_1","t7_2","t7_3","t7_4","t7_5","t7_6","t7_7"], dailyFallback:"t7_1" },
      8:  { weekly:["t8_1","t8_2","t8_3","t8_4","t8_5","t8_6","t8_7"], dailyFallback:"t8_1" },
      9:  { weekly:["t9_1","t9_2","t9_3","t9_4","t9_5","t9_6","t9_7"], dailyFallback:"t9_1" },
      10: { weekly:["t10_1","t10_2","t10_3","t10_4","t10_5","t10_6","t10_7"], dailyFallback:"t10_1" },
      11: { weekly:["t11_1","t11_2","t11_3","t11_4","t11_5","t11_6","t11_7"], dailyFallback:"t11_1" },
      12: { weekly:["t12_1","t12_2","t12_3","t12_4","t12_5","t12_6","t12_7"], dailyFallback:"t12_1" },
      13: { weekly:["t13_1","t13_2","t13_3","t13_4","t13_5","t13_6","t13_7"], dailyFallback:"t13_1" }
    }
  };

  /* ---------------------------------------------------------------
   EVENTS — dots the calendars can render
   type: "evt1" | "evt2" (legend-aligned)
   --------------------------------------------------------------- */
  const EVENTS = {
    defaults: [
      { type:"evt1", day:1,  label:"Opening Rite" },
      { type:"evt2", day:7,  label:"Covenant Circle" },
      { type:"evt1", day:13, label:"Mid-Moon Offering" },
      { type:"evt2", day:21, label:"Remnant Vigil" },
      { type:"evt1", day:28, label:"Closing Rite" },
    ],
    perMoon: {
      5: [ { type:"evt1", day:5,  label:"Overtone Crown" } ],
      7: [ { type:"evt2", day:7,  label:"Resonant Attunement" } ],
      9: [ { type:"evt1", day:9,  label:"Solar Intention Fire" } ],
      13:[ { type:"evt2", day:27, label:"Year-Seal Vigil" } ]
    },
    special: {
      doot: { label:"Day Out of Time", type:"evt2" },
      leap: { label:"Leap Day (skipped in 13×28 count)", type:"evt2" }
    }
  };

  /* ---------------------------------------------------------------
   MOONS — full metadata for 13 moons (expanded fields)
   Notes:
   - Keep keys stable; add rich correspondences.
   - `theme` sets CSS vars via THEME.apply().
   --------------------------------------------------------------- */
  const MOONS = [
    {
      idx:1, tone:1, slug:"magnetic", name:"Magnetic",
      essence:"Unify · Purpose", affirmation:"I gather my purpose into one.",
      color:"#6FE7FF", hebrew:"אַחְדוּת", rtl:true, psalm:"Psalm 1",
      codex:"theory.html#magnetic", essay:"codex/magnetic.html",
      sigil:"assets/sigils/magnetic.svg", image:"assets/art/magnetic.jpg",
      audio:"assets/audio/magnetic.mp3", link:"moons.html#moon-1",
      resonant:false,
      theme:{accent:"#9cf",accent2:"#5ef",bgFrom:"#08131c",bgTo:"#0b1a26",aether:"rgba(140,200,255,.12)"},
      practice:[
        "Clarify your purpose in one sentence.",
        "Choose one devotion you will repeat daily this moon."
      ],
      weeklyFocus:[
        "Week 1: Gather three scattered threads into one intention.",
        "Week 2: Prune tasks that do not serve the intention.",
        "Week 3: Feed the intention (time, attention, resource).",
        "Week 4: Witness a measurable shift that emerged."
      ],
      stones:["Lapis","Aquamarine"], herbs:["Rosemary","Mint"],
      element:"Air", metal:"Silver", animal:"Hawk", geometry:"Point → Line",
      direction:"East", chakra:"Crown (light-touch)", carriers:["432","528"],
      breath:{pattern:"4-7-8", rounds:3}, mudra:"Anjali (prayer)",
      mantra:"Echad — One", food:["Citrus","Clean water"], incense:["Frankincense"],
      shadow:"Diffusion / scattered will", virtue:"Coherence",
      craft:"Write a one-page Purpose Charter; sign and date."
    },
    {
      idx:2, tone:2, slug:"lunar", name:"Lunar",
      essence:"Polarize · Challenge", affirmation:"I see the two poles clearly.",
      color:"#B1C7FF", hebrew:"אִזּוּן", rtl:true, psalm:"Psalm 15",
      codex:"theory.html#lunar", essay:"codex/lunar.html",
      sigil:"assets/sigils/lunar.svg", image:"assets/art/lunar.jpg",
      audio:"assets/audio/lunar.mp3", link:"moons.html#moon-2",
      resonant:false,
      theme:{accent:"#ffb4a8",accent2:"#ff866b",bgFrom:"#201015",bgTo:"#2b1218",aether:"rgba(255,118,86,.12)"},
      practice:[
        "Name the two poles in your current dilemma.",
        "Pick one stabilizing constraint for the week."
      ],
      weeklyFocus:[
        "Week 1: Map the opposites without judgment.",
        "Week 2: Choose one rule that reduces chaos.",
        "Week 3: Test your constraint; keep score daily.",
        "Week 4: Integrate learning into your standard."
      ],
      stones:["Moonstone"], herbs:["Sage"], element:"Water", metal:"Tin",
      animal:"Deer", geometry:"Line ↔ Line (balance)", direction:"West",
      chakra:"Third Eye (discernment)", carriers:["432","369"],
      breath:{pattern:"Box 4-4-4-4", rounds:4}, mudra:"Dhyana",
      mantra:"Shalom — Peace", food:["White rice","Broth"], incense:["Myrrh"],
      shadow:"Indecision / pendulum swing", virtue:"Measured choice",
      craft:"Draw a two-column 'Pole Map' with chosen constraints."
    },
    {
      idx:3, tone:3, slug:"electric", name:"Electric",
      essence:"Activate · Service", affirmation:"I move in service today.",
      color:"#7AF3FF", hebrew:"שֵׁרוּת", rtl:true, psalm:"Psalm 24",
      codex:"theory.html#electric", essay:"codex/electric.html",
      sigil:"assets/sigils/electric.svg", image:"assets/art/electric.jpg",
      audio:"assets/audio/electric.mp3", link:"moons.html#moon-3",
      resonant:false,
      theme:{accent:"#ffd37a",accent2:"#ffe6a8",bgFrom:"#1f1808",bgTo:"#2a210c",aether:"rgba(255,214,122,.10)"},
      practice:[
        "List three ways to serve your purpose.",
        "Take one helpful action for someone today."
      ],
      weeklyFocus:[
        "Week 1: Identify who benefits from your work.",
        "Week 2: Serve one person concretely.",
        "Week 3: Improve the delivery.",
        "Week 4: Teach the service to another."
      ],
      stones:["Citrine"], herbs:["Lemon balm"], element:"Fire", metal:"Copper",
      animal:"Fox", geometry:"Triangle (activation)", direction:"South",
      chakra:"Solar Plexus", carriers:["528"],
      breath:{pattern:"Fire breath (gentle) 20s, then rest", rounds:3},
      mudra:"Agni", mantra:"Ori — Light's move",
      food:["Ginger tea","Whole grains"], incense:["Cinnamon"],
      shadow:"Busywork / performative help", virtue:"Useful action",
      craft:"Deliver a small gift of service; note impact."
    },
    {
      idx:4, tone:4, slug:"self-existing", name:"Self-Existing",
      essence:"Define · Form", affirmation:"I shape clear and true forms.",
      color:"#7BF3B8", hebrew:"צוּרָה", rtl:true, psalm:"Psalm 90:12",
      codex:"theory.html#self-existing", essay:"codex/self-existing.html",
      sigil:"assets/sigils/self-existing.svg", image:"assets/art/self-existing.jpg",
      audio:"assets/audio/self-existing.mp3", link:"moons.html#moon-4",
      resonant:false,
      theme:{accent:"#b6ffcc",accent2:"#6dff9e",bgFrom:"#0a1a12",bgTo:"#0f2218",aether:"rgba(120,255,180,.10)"},
      practice:[
        "Draw the form of your project: inputs → alchemy → outputs.",
        "Name constraints that set you free."
      ],
      weeklyFocus:[
        "Week 1: Sketch one diagram.",
        "Week 2: Choose three clarifying constraints.",
        "Week 3: Build a minimum slice.",
        "Week 4: Remove ornament; keep essence."
      ],
      stones:["Green aventurine"], herbs:["Nettle"], element:"Earth", metal:"Lead",
      animal:"Beaver", geometry:"Square (form)", direction:"North",
      chakra:"Root", carriers:["144","432"],
      breath:{pattern:"Grounding 5-5", rounds:6}, mudra:"Prithvi",
      mantra:"Emet — Truth", food:["Root veg","Salt"], incense:["Cedar"],
      shadow:"Perfectionism / rigidity", virtue:"Elegance",
      craft:"Single-page architecture: inputs/outputs + constraint list."
    },
    {
      idx:5, tone:5, slug:"overtone", name:"Overtone",
      essence:"Empower · Radiance", affirmation:"I amplify the good I carry.",
      color:"#FFD27A", hebrew:"זוֹהַר", rtl:true, psalm:"Psalm 27",
      codex:"theory.html#overtone", essay:"codex/overtone.html",
      sigil:"assets/sigils/overtone.svg", image:"assets/art/overtone.jpg",
      audio:"assets/audio/overtone.mp3", link:"moons.html#moon-5",
      resonant:false,
      theme:{accent:"#ffe07a",accent2:"#ffc84d",bgFrom:"#211a07",bgTo:"#2a2109",aether:"rgba(255,200,90,.12)"},
      practice:[
        "Identify one strength to amplify.",
        "Share a small win publicly."
      ],
      weeklyFocus:[
        "Week 1: Inventory strengths (3).",
        "Week 2: Amplify one in public.",
        "Week 3: Polish presentation.",
        "Week 4: Teach that strength to a peer."
      ],
      stones:["Sunstone"], herbs:["St. John’s wort"], element:"Fire", metal:"Gold",
      animal:"Lion", geometry:"Pentagon (overtone)", direction:"South",
      chakra:"Heart/Solar blend", carriers:["528","963"],
      breath:{pattern:"In 5, hold 1, out 5", rounds:6}, mudra:"Padma (lotus)",
      mantra:"Hallel — Praise", food:["Honey","Citrus"], incense:["Copal"],
      shadow:"Brag / glare without warmth", virtue:"Gentle shine",
      craft:"Strength card; share it with one person."
    },
    {
      idx:6, tone:6, slug:"rhythmic", name:"Rhythmic",
      essence:"Organize · Equality", affirmation:"I balance work and restoration.",
      color:"#A7FFCF", hebrew:"שִׁוּוּי", rtl:true, psalm:"Psalm 133",
      codex:"theory.html#rhythmic", essay:"codex/rhythmic.html",
      sigil:"assets/sigils/rhythmic.svg", image:"assets/art/rhythmic.jpg",
      audio:"assets/audio/rhythmic.mp3", link:"moons.html#moon-6",
      resonant:false,
      theme:{accent:"#9ef",accent2:"#6bf",bgFrom:"#07151a",bgTo:"#0a1b22",aether:"rgba(120,230,255,.10)"},
      practice:[
        "Design a daily cadence (morning, noon, night).",
        "Balance effort with restoration."
      ],
      weeklyFocus:[
        "Week 1: Build the cadence.",
        "Week 2: Add a 5-min recovery block.",
        "Week 3: Equalize commitments.",
        "Week 4: Measure energy; adjust."
      ],
      stones:["Hematite"], herbs:["Chamomile"], element:"Air/Earth",
      metal:"Iron", animal:"Otter", geometry:"Hexagon (equity)",
      direction:"Center", chakra:"Sacral/Root", carriers:["432"],
      breath:{pattern:"6-6", rounds:8}, mudra:"Gyan (soft)",
      mantra:"Shivui — Balance", food:["Oats","Water"], incense:["Lavender"],
      shadow:"Over-scheduling / chronic depletion", virtue:"Steady pace",
      craft:"Cadence grid; mark real energy highs/lows."
    },
    {
      idx:7, tone:7, slug:"resonant", name:"Resonant",
      essence:"Channel · Inspiration", affirmation:"I open and receive the signal.",
      color:"#7AF3FF", hebrew:"הַשְׁרָאָה", rtl:true, psalm:"Psalm 46",
      codex:"theory.html#resonant", essay:"codex/resonant.html",
      sigil:"assets/sigils/resonant.svg", image:"assets/art/resonant.jpg",
      audio:"assets/audio/resonant.mp3", link:"moons.html#moon-7",
      resonant:true,
      theme:{accent:"#d5b6ff",accent2:"#b98cff",bgFrom:"#160d22",bgTo:"#1c1030",aether:"rgba(190,140,255,.12)"},
      practice:[
        "Create a short ritual to open the channel.",
        "Sit in silence for seven minutes daily."
      ],
      weeklyFocus:[
        "Week 1: Digital fast 1h/day.",
        "Week 2: Tune one question; wait.",
        "Week 3: Record signals.",
        "Week 4: Act on one signal; reflect."
      ],
      stones:["Amethyst"], herbs:["Mugwort"], element:"Aether",
      metal:"Quicksilver (symbolic)", animal:"Owl", geometry:"Heptagon",
      direction:"Above", chakra:"Crown/Third Eye", carriers:["963","432"],
      breath:{pattern:"4-7-8 (soft)", rounds:4}, mudra:"Akasha",
      mantra:"Ruach — Breath/Spirit", food:["Herbal tea"], incense:["Sandalwood"],
      shadow:"Chasing signs / not acting", virtue:"Humble receptivity",
      craft:"Signal log — time, place, gist, act."
    },
    {
      idx:8, tone:8, slug:"galactic", name:"Galactic",
      essence:"Harmonize · Integrity", affirmation:"I align action with values.",
      color:"#9BD3FF", hebrew:"תֹּם", rtl:true, psalm:"Psalm 19",
      codex:"theory.html#galactic", essay:"codex/galactic.html",
      sigil:"assets/sigils/galactic.svg", image:"assets/art/galactic.jpg",
      audio:"assets/audio/galactic.mp3", link:"moons.html#moon-8",
      resonant:false,
      theme:{accent:"#a8ffd9",accent2:"#7affc4",bgFrom:"#0a1713",bgTo:"#0e1e18",aether:"rgba(130,255,210,.10)"},
      practice:[
        "Write your eight core values.",
        "Align one habit with those values."
      ],
      weeklyFocus:[
        "Week 1: Write values + definitions.",
        "Week 2: Map misalignments.",
        "Week 3: Replace one habit.",
        "Week 4: Public accountability."
      ],
      stones:["Jade"], herbs:["Basil"], element:"Earth/Air",
      metal:"Bronze", animal:"Elephant", geometry:"Octagon",
      direction:"South-East", chakra:"Heart/Throat", carriers:["528"],
      breath:{pattern:"In 4, out 6", rounds:8}, mudra:"Vishuddha",
      mantra:"Tome — Integrity", food:["Greens","Olive oil"], incense:["Bay"],
      shadow:"Value theater / hypocrisy", virtue:"Congruence",
      craft:"Value → Habit map with one-week check."
    },
    {
      idx:9, tone:9, slug:"solar", name:"Solar",
      essence:"Pulse · Intention", affirmation:"I set and move with clear intent.",
      color:"#FFBC6F", hebrew:"כַּוָּנָה", rtl:true, psalm:"Psalm 19:14",
      codex:"theory.html#solar", essay:"codex/solar.html",
      sigil:"assets/sigils/solar.svg", image:"assets/art/solar.jpg",
      audio:"assets/audio/solar.mp3", link:"moons.html#moon-9",
      resonant:false,
      theme:{accent:"#ff927a",accent2:"#ff6a55",bgFrom:"#1e0e0b",bgTo:"#270f0c",aether:"rgba(255,120,100,.12)"},
      practice:[
        "Set one clear intention for the week.",
        "Take one bold, visible step toward it."
      ],
      weeklyFocus:[
        "Week 1: Nine-word intention.",
        "Week 2: Daily micro-pulse.",
        "Week 3: Remove one blocker.",
        "Week 4: Present the outcome."
      ],
      stones:["Carnelian"], herbs:["Ginger"], element:"Fire",
      metal:"Copper/Gold", animal:"Horse", geometry:"Nonagon (pulse)",
      direction:"South-West", chakra:"Solar Plexus", carriers:["432","528"],
      breath:{pattern:"Solar inhale (right nostril) × 9", rounds:3},
      mudra:"Surya", mantra:"Ori — Aim",
      food:["Orange foods","Warm spices"], incense:["Citrus peel"],
      shadow:"Scattered will / false starts", virtue:"Follow-through",
      craft:"Intent card + public declaration."
    },
    {
      idx:10, tone:10, slug:"planetary", name:"Planetary",
      essence:"Perfect · Manifestation", affirmation:"I ship a complete slice.",
      color:"#FFD9A6", hebrew:"הַגְשָׁמָה", rtl:true, psalm:"Psalm 37",
      codex:"theory.html#planetary", essay:"codex/planetary.html",
      sigil:"assets/sigils/planetary.svg", image:"assets/art/planetary.jpg",
      audio:"assets/audio/planetary.mp3", link:"moons.html#moon-10",
      resonant:false,
      theme:{accent:"#a2ffd1",accent2:"#73ffc0",bgFrom:"#0c1912",bgTo:"#102219",aether:"rgba(140,255,200,.10)"},
      practice:[
        "Ship a minimum complete slice.",
        "Refine one detail that delights."
      ],
      weeklyFocus:[
        "Week 1: Define 'done'.",
        "Week 2: Build the working slice.",
        "Week 3: QA + iterate.",
        "Week 4: Deliver + document."
      ],
      stones:["Malachite"], herbs:["Thyme"], element:"Earth",
      metal:"Mercury (symbolic process)", animal:"Bee", geometry:"Decagon",
      direction:"North-West", chakra:"Root/Solar", carriers:["528","144"],
      breath:{pattern:"4-4 (work/rest metronome)", rounds:10}, mudra:"Bhumisparsha",
      mantra:"Asa — Do",
      food:["Bread/Olives"], incense:["Pine"],
      shadow:"Endless tweaking / never shipping", virtue:"Sufficient completeness",
      craft:"Changelog + screenshot proof."
    },
    {
      idx:11, tone:11, slug:"spectral", name:"Spectral",
      essence:"Dissolve · Liberation", affirmation:"I let go of the nonessential.",
      color:"#B8C7FF", hebrew:"שִׁחְרוּר", rtl:true, psalm:"Psalm 32",
      codex:"theory.html#spectral", essay:"codex/spectral.html",
      sigil:"assets/sigils/spectral.svg", image:"assets/art/spectral.jpg",
      audio:"assets/audio/spectral.mp3", link:"moons.html#moon-11",
      resonant:false,
      theme:{accent:"#a8b8ff",accent2:"#7a8cff",bgFrom:"#0b0f22",bgTo:"#0e1230",aether:"rgba(120,140,255,.10)"},
      practice:[
        "Drop one nonessential commitment.",
        "Do a 10-minute clutter release daily."
      ],
      weeklyFocus:[
        "Week 1: Inventory drains.",
        "Week 2: Cancel one drain.",
        "Week 3: Automate or delegate another.",
        "Week 4: Celebrate freed capacity."
      ],
      stones:["Obsidian"], herbs:["Sagebrush"], element:"Air",
      metal:"Nickel", animal:"Vulture", geometry:"Hendecagon (release)",
      direction:"North-East", chakra:"Throat/Root", carriers:["432"],
      breath:{pattern:"Out 8, In 4 (long exhale)", rounds:8}, mudra:"Ksepana (release)",
      mantra:"Shalach — Let go",
      food:["Stew","Warm soups"], incense:["Clove"],
      shadow:"Hoarding / identity in burdens", virtue:"Lightness",
      craft:"Release list → burn or archive."
    },
    {
      idx:12, tone:12, slug:"crystal", name:"Crystal",
      essence:"Dedicate · Cooperation", affirmation:"I dedicate my gifts to the whole.",
      color:"#CFEFFF", hebrew:"אַחְוָה", rtl:true, psalm:"Psalm 133:1",
      codex:"theory.html#crystal", essay:"codex/crystal.html",
      sigil:"assets/sigils/crystal.svg", image:"assets/art/crystal.jpg",
      audio:"assets/audio/crystal.mp3", link:"moons.html#moon-12",
      resonant:false,
      theme:{accent:"#a8b8ff",accent2:"#7a8cff",bgFrom:"#0b0f22",bgTo:"#0e1230",aether:"rgba(120,140,255,.10)"},
      practice:[
        "Schedule one collaborative session.",
        "Name how your work serves the whole."
      ],
      weeklyFocus:[
        "Week 1: Identify allies.",
        "Week 2: Co-create a small artifact.",
        "Week 3: Share it with the circle.",
        "Week 4: Document learnings."
      ],
      stones:["Clear Quartz"], herbs:["Lavender"], element:"Aether/Water",
      metal:"Silver", animal:"Dolphin", geometry:"Dodecagon",
      direction:"Circle", chakra:"Heart/Throat/Crown", carriers:["528","963"],
      breath:{pattern:"Humming (mmmmm) 6s, rest 6s", rounds:8}, mudra:"Anahata",
      mantra:"Chesed — Kindness",
      food:["Berries","Yogurt"], incense:["Jasmine"],
      shadow:"People-pleasing / loss of center", virtue:"Mutual uplift",
      craft:"Collaborative note with credits + future plans."
    },
    {
      idx:13, tone:13, slug:"cosmic", name:"Cosmic",
      essence:"Endure · Presence", affirmation:"I rest in still presence.",
      color:"#E7D1FF", hebrew:"נְצִיחוּת", rtl:true, psalm:"Ps 46:10",
      codex:"theory.html#cosmic", essay:"codex/cosmic.html",
      sigil:"assets/sigils/cosmic.svg", image:"assets/art/cosmic.jpg",
      audio:"assets/audio/cosmic.mp3", link:"moons.html#moon-13",
      resonant:false,
      theme:{accent:"#9df",accent2:"#7cf",bgFrom:"#0a1016",bgTo:"#0c1218",aether:"rgba(140,220,255,.12)"},
      practice:[
        "Practice stillness for 13 breaths.",
        "Close one loop with gratitude."
      ],
      weeklyFocus:[
        "Week 1: Slow the pace (half-speed hour).",
        "Week 2: Presence in motion (walking prayer).",
        "Week 3: Offer silence to a friend.",
        "Week 4: Seal the year with thanks."
      ],
      stones:["Selenite"], herbs:["Valerian"], element:"Aether",
      metal:"Platinum (symbolic)", animal:"Whale", geometry:"Circle of circles",
      direction:"Within", chakra:"Crown/All", carriers:["963"],
      breath:{pattern:"7-7 still breath", rounds:7}, mudra:"Sahasa",
      mantra:"Menucha — Rest",
      food:["White rice","Milk (alt)"], incense:["Aloeswood"],
      shadow:"Drift / escapism", virtue:"Vigilant calm",
      craft:"Year seal: three lines of gratitude + one vow for the next gate."
    }
  ];

  /* ---------------------------------------------------------------
   WIRING HELPERS — tiny utilities the engine can call
   --------------------------------------------------------------- */
  function verseForDay(pos, wallDate) {
    if (!pos) return V.shma;
    // DOOT uses special pool
    if (pos.doot) {
      const pool = VERSES.picks.doot || ["rest"];
      const id = pool[ wallDate.getUTCDay() % pool.length ];
      return VERSES.byId[id] || V.rest;
    }
    // Per-moon weekly rotation
    const pack = VERSES.picks[pos.moon];
    if (!pack) return V.shma;
    const weekly = pack.weekly || [];
    const id = weekly.length ? weekly[(pos.week-1) % weekly.length] : pack.dailyFallback;
    const base = VERSES.byId[id] || V.shma;

    // Crown days (7, 14, 21, 28) blend a common anchor
    if ([7,14,21,28].includes(pos.day)) {
      const commons = VERSES.picks.common.map(x=>VERSES.byId[x]);
      const pick = commons[ (pos.day/7) % commons.length | 0 ];
      return {heb: pick.heb, en: base.en, ref: base.ref + " + " + pick.ref};
    }
    return base;
  }

  function eventsForMoon(moonIndex) {
    const base = EVENTS.defaults.slice();
    const extras = (EVENTS.perMoon[moonIndex] || []);
    return [...base, ...extras];
  }

  // Optional light validation
  (function validate(){
    if (MOONS.length !== 13) {
      console.warn("[REMNANT] Expected 13 moons; found", MOONS.length);
    }
    for (let i=0;i<MOONS.length;i++){
      if (MOONS[i].idx !== i+1) {
        console.warn("[REMNANT] Moon idx mismatch at", i, MOONS[i]);
      }
    }
  })();

  // Expose globals for the engine
  window.REMNANT_THEME  = THEME;
  window.REMNANT_VERSES = VERSES;
  window.REMNANT_EVENTS = EVENTS;
  window.REMNANT_MOONS  = MOONS;
  window.remnantVerseForDay   = verseForDay;
  window.remnantEventsForMoon = eventsForMoon;

  // Convenience API for other pages (optional)
  window.RemnantAPI = {
    getAll: () => ({ MOONS, VERSES, EVENTS }),
    getMoonByIdx: (i) => MOONS.find(m => m.idx === i) || null,
    getMoonBySlug: (slug) => MOONS.find(m => m.slug === slug) || null,
    themeForIdx: (i) => (MOONS[i-1] && MOONS[i-1].theme) || null,
    applyThemeForIdx: (i, seed=0) => { const m = MOONS[i-1]; THEME.apply(m); THEME.applyDynamic(seed); },
    verseFor: verseForDay,
    eventsFor: eventsForMoon
  };
})();
