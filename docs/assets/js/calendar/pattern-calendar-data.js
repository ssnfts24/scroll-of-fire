(() => {
  "use strict";

  const moons = [
    { idx: 1, name: "Seed Flame", element: "Fire", freq: "144 Hz", essence: "Beginning, ignition, first witness", practice: "Start clean. Speak the first word. Mark the seed." },
    { idx: 2, name: "Root Waters", element: "Water", freq: "432 Hz", essence: "Memory, cleansing, emotional ground", practice: "Cleanse memory. Listen to dreams. Watch emotional weather." },
    { idx: 3, name: "Breath Gate", element: "Air", freq: "369 Hz", essence: "Word, air, signal, exchange", practice: "Guard speech. Track repeated words. Breathe before response." },
    { idx: 4, name: "Stone Witness", element: "Earth", freq: "174 Hz", essence: "Body, structure, faithful record", practice: "Build structure. Repair the physical. Record what happened." },
    { idx: 5, name: "Living Word", element: "Aether", freq: "528 Hz", essence: "Speech, vow, creative command", practice: "Speak with care. Create through ordered language." },
    { idx: 6, name: "Fire Trial", element: "Fire", freq: "417 Hz", essence: "Testing, courage, purification", practice: "Let false things burn. Choose courage without rushing." },
    { idx: 7, name: "Crown Balance", element: "Aether", freq: "963 Hz", essence: "Completion, justice, centered rule", practice: "Weigh the pattern. Balance mercy, truth, and consequence." },
    { idx: 8, name: "Deep Mirror", element: "Water", freq: "396 Hz", essence: "Reflection, hidden pattern, inner waters", practice: "Look beneath the surface. Journal before judging." },
    { idx: 9, name: "Return Path", element: "Earth", freq: "285 Hz", essence: "Restoration, repentance, spiral home", practice: "Correct course. Repair one broken loop." },
    { idx: 10, name: "Builder’s Hand", element: "Earth", freq: "741 Hz", essence: "Craft, repair, stewardship", practice: "Build, fix, organize, and make the invisible useful." },
    { idx: 11, name: "Star Remembrance", element: "Air", freq: "852 Hz", essence: "Inheritance, names, celestial memory", practice: "Remember names, lineage, signs, and the long story." },
    { idx: 12, name: "River of Signs", element: "Water", freq: "639 Hz", essence: "Movement, omens, living flow", practice: "Track timing. Move with wisdom. Do not force the river." },
    { idx: 13, name: "Completion Seal", element: "Aether", freq: "111 Hz", essence: "Harvest, sealing, preparation for reset", practice: "Close the loop. Harvest the lesson. Prepare the reset." }
  ];

  const dayArchetypes = [
    ["Spark", "First ignition. Start, name, begin."],
    ["Witness", "Record what is actually there."],
    ["Breath", "Speak, listen, exchange."],
    ["Root", "Ground the body and home."],
    ["Water", "Feel, cleanse, remember."],
    ["Stone", "Build structure and boundary."],
    ["Fire", "Test, purify, choose courage."],
    ["Gate", "Make a decision or cross a threshold."],
    ["Mirror", "Reflect before reacting."],
    ["Hand", "Repair, craft, serve."],
    ["Voice", "Say the true thing cleanly."],
    ["River", "Move, adapt, follow flow."],
    ["Star", "Remember inheritance and direction."],
    ["Balance", "Weigh, measure, judge fairly."],
    ["Seed", "Plant the next pattern."],
    ["Trial", "Face resistance without panic."],
    ["Mercy", "Release what can be released."],
    ["Sword", "Cut the false attachment."],
    ["Oil", "Consecrate the ordinary."],
    ["Bread", "Receive provision and share it."],
    ["Watch", "Stay awake to timing."],
    ["Return", "Correct course."],
    ["Crown", "Govern the self first."],
    ["Lamp", "Bring light to one dark corner."],
    ["Name", "Recover identity and purpose."],
    ["Field", "Observe relationships."],
    ["Seal", "Close what is complete."],
    ["Rest", "Prepare the reset."]
  ];

  const weekGates = [
    ["Week 1 · Ignition", "Begin, gather signal, establish the first witness."],
    ["Week 2 · Formation", "Shape the pattern through body, speech, and daily structure."],
    ["Week 3 · Testing", "Watch pressure, resistance, correction, and refinement."],
    ["Week 4 · Sealing", "Harvest the lesson, close loops, and prepare the next moon."]
  ];

  globalThis.PatternCalendarData = Object.freeze({
    moons,
    moonNames: moons.map(m => m.name),
    dayArchetypes,
    weekGates,
    dayOutOfTimeName: "Day Out of Time",
    deepTimeDayName: "Deep Time Day"
  });
})();
