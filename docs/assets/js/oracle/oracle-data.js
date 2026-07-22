(() => {
  "use strict";

  const toneRows = [
    ["Ignition", "Begin and name", "Initiative", "Rushing", "What must begin now?", "Name one first step.", "Direct and clear", "Start something tangible", "What did I begin today?"],
    ["Rooting", "Stabilize and hold", "Consistency", "Rigidity", "What supports this?", "Create one stable routine.", "Steady and loyal", "Build foundations", "What did I sustain?"],
    ["Signal", "Exchange and connect", "Communication", "Noise", "What needs to be said cleanly?", "Pause before speech.", "Curious and responsive", "Write or speak the core point", "What message repeated today?"],
    ["Structure", "Shape and order", "Discipline", "Control", "What needs form?", "Set one boundary.", "Reliable and practical", "Organize a process", "Where did structure help?"],
    ["Flow", "Move and adapt", "Flexibility", "Drift", "Where should I soften?", "Follow one natural rhythm.", "Empathic and adaptive", "Improve a transition", "Where did I resist flow?"],
    ["Trial", "Refine by pressure", "Courage", "Defensiveness", "What is being tested?", "Choose one brave correction.", "Honest and demanding", "Transform a flaw into craft", "What did pressure reveal?"],
    ["Balance", "Center and weigh", "Clarity", "Indecision", "What requires right measure?", "List pros, limits, and next step.", "Fair and observant", "Edit for coherence", "What did I rebalance?"],
    ["Mirror", "Reflect and review", "Insight", "Over-analysis", "What pattern is repeating?", "Journal one honest paragraph.", "Reflective and patient", "Revise with perspective", "What did I see clearly?"],
    ["Return", "Restore and repair", "Resilience", "Nostalgia", "What can be repaired now?", "Repair one open loop.", "Forgiving and accountable", "Recover a paused work", "What did I restore?"],
    ["Craft", "Build and steward", "Execution", "Overwork", "What can I complete well?", "Finish one practical task.", "Supportive and capable", "Ship a useful artifact", "What did I complete?"],
    ["Remembrance", "Align with inheritance", "Perspective", "Idealization", "What lineage am I serving?", "Name one inherited value.", "Respectful and future-aware", "Teach a lesson learned", "What did I remember?"],
    ["River", "Navigate transition", "Timing", "Avoidance", "Where is movement required?", "Take one measured transition.", "Adaptive and observant", "Refactor with continuity", "Where did timing matter?"],
    ["Seal", "Close and integrate", "Completion", "Premature closure", "What is ready to be sealed?", "Document closure and next cycle seed.", "Concluding and integrative", "Package final form", "What cycle completed?" ]
  ];

  const tones = toneRows.map((row, index) => ({
    index: index + 1,
    name: row[0],
    function: row[1],
    strength: row[2],
    imbalance: row[3],
    question: row[4],
    groundingAction: row[5],
    relationshipStyle: row[6],
    creativeExpression: row[7],
    witnessPrompt: row[8]
  }));

  const carriers = [
    { hz: 432, meaning: "Grounding cadence and embodied stability." },
    { hz: 528, meaning: "Repair, restoration, and living correction." },
    { hz: 369, meaning: "Pattern return, sequence, and recursion." },
    { hz: 144, meaning: "Remnant architecture and measured structure." },
    { hz: 963, meaning: "Stillness, crown perspective, and coherence." }
  ];

  const livingLaws = [
    "Breath", "Flame", "Waters", "Stone", "Seed", "Voice", "Witness", "Balance", "Return", "Crown", "Gate", "Memory", "Completion"
  ].map((name, index) => ({
    index: index + 1,
    name,
    conciseMeaning: `${name} as daily orientation in the cycle.`,
    matureExpression: `Practices ${name.toLowerCase()} with consistency and service.`,
    shadowExpression: `Forgets the measure of ${name.toLowerCase()} and drifts to reactivity.`,
    dailyPractice: `Name one ${name.toLowerCase()} action and complete it before day end.`,
    boundaryStatement: `${name} is guidance, not a claim of fate or certainty.`,
    serviceExpression: `Use ${name.toLowerCase()} to support others through practical care.`,
    reflectionQuestion: `Where did ${name.toLowerCase()} appear in my choices today?`
  }));

  const flamePaths = [
    "Ignition", "Refinement", "Mercy", "Foundation", "Growth", "Transmission", "Record", "Justice", "Restoration", "Authority", "Threshold", "Remembrance", "Seal"
  ].map((name, index) => ({
    index: index + 1,
    name,
    conciseMeaning: `${name} describes the movement emphasis for this layer.`,
    matureExpression: `${name} appears as focused and grounded momentum.`,
    shadowExpression: `${name} can distort into overreach when ungrounded.`,
    dailyPractice: `Take one action that embodies ${name.toLowerCase()} with restraint.`,
    boundaryStatement: `${name} is reflective symbolism, not predictive certainty.`,
    serviceExpression: `Apply ${name.toLowerCase()} energy in useful service.`,
    reflectionQuestion: `How did ${name.toLowerCase()} shape today's work?`
  }));

  const elementMatrix = Object.freeze({
    Fire: { Fire: "reinforcement", Water: "friction", Air: "transformation", Earth: "grounding", Aether: "balance" },
    Water: { Fire: "friction", Water: "reinforcement", Air: "balance", Earth: "grounding", Aether: "transformation" },
    Air: { Fire: "transformation", Water: "balance", Air: "reinforcement", Earth: "friction", Aether: "grounding" },
    Earth: { Fire: "grounding", Water: "grounding", Air: "friction", Earth: "reinforcement", Aether: "balance" },
    Aether: { Fire: "balance", Water: "transformation", Air: "grounding", Earth: "balance", Aether: "reinforcement" }
  });

  const elementRelationshipText = Object.freeze({
    reinforcement: "These two qualities naturally reinforce each other.",
    balance: "These qualities hold a stabilizing balance.",
    friction: "These qualities can create useful tension requiring care.",
    transformation: "These qualities invite change through active integration.",
    grounding: "These qualities anchor each other through practical action."
  });

  const dayElements = Object.freeze([
    "Fire", "Earth", "Air", "Earth", "Water", "Earth", "Fire", "Aether", "Water", "Earth", "Air", "Water", "Air", "Aether",
    "Fire", "Fire", "Water", "Air", "Aether", "Earth", "Aether", "Earth", "Aether", "Fire", "Air", "Water", "Aether", "Earth"
  ]);

  globalThis.GenesisOracleData = Object.freeze({
    tones,
    carriers,
    livingLaws,
    flamePaths,
    dayElements,
    elementMatrix,
    elementRelationshipText
  });
})();
