/* Remnant 13 Moons — data pack
   Path: docs/assets/data/moons.data.js
   Exposes: window.__MOONS__, window.__PRACTICES__, window.__VERSES__
*/
(function () {
  "use strict";

  // 13-moon names + essences + palette
  const MOONS = [
    { idx: 1,  name: "Magnetic",    essence: "Unify · Purpose",           color: "#6FE7FF" },
    { idx: 2,  name: "Lunar",       essence: "Polarize · Challenge",      color: "#B1C7FF" },
    { idx: 3,  name: "Electric",    essence: "Activate · Service",        color: "#7AF3FF" },
    { idx: 4,  name: "Self-Existing", essence:"Define · Form",            color: "#7BF3B8" },
    { idx: 5,  name: "Overtone",    essence: "Empower · Radiance",        color: "#FFD27A" },
    { idx: 6,  name: "Rhythmic",    essence: "Organize · Equality",       color: "#A7FFCF" },
    { idx: 7,  name: "Resonant",    essence: "Channel · Attunement",      color: "#D5B6FF" },
    { idx: 8,  name: "Galactic",    essence: "Harmonize · Integrity",     color: "#A8FFD9" },
    { idx: 9,  name: "Solar",       essence: "Pulse · Intention",         color: "#FFBC6F" },
    { idx: 10, name: "Planetary",   essence: "Perfect · Manifestation",   color: "#A2FFD1" },
    { idx: 11, name: "Spectral",    essence: "Dissolve · Liberation",     color: "#A8B8FF" },
    { idx: 12, name: "Crystal",     essence: "Dedicate · Cooperation",    color: "#FFD7A8" },
    { idx: 13, name: "Cosmic",      essence: "Endure · Presence",         color: "#9DDAFF" }
  ];

  // Short practice prompts (cycled by day)
  const PRACTICES = [
    "Witness your breath for 3 × 33 counts.",
    "Order your field: tidy one small space.",
    "Write one sentence to future-you.",
    "Walk 13 minutes; notice repeating patterns.",
    "Name the tone of this day in 3 words.",
    "Release one small weight (delete/declutter).",
    "Send gratitude to a helper in your story."
  ];

  // Simple verse bank (Hebrew + EN + ref)
  const VERSES = [
    { he: "יְהִי אוֹר", en: "Let there be light.", ref: "Gen 1:3" },
    { he: "שְׁמַע יִשְׂרָאֵל", en: "Hear, O Israel…", ref: "Deut 6:4" },
    { he: "אֱמֶת וְשָׁלוֹם אֱהָבוּ", en: "Love truth and peace.", ref: "Zech 8:19" },
    { he: "אֵין קָדוֹשׁ כַּיהוָה", en: "None is holy like YHWH.", ref: "1 Sam 2:2" },
    { he: "חֶסֶד וֶאֱמֶת", en: "Mercy and truth.", ref: "Ps 85:10" }
  ];

  window.__MOONS__ = MOONS;
  window.__PRACTICES__ = PRACTICES;
  window.__VERSES__ = VERSES;
})();
