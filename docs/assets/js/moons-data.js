(function (global, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RemnantCalendarData = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const moonNames = ['Seed Flame','Root Waters','Breath Gate','Stone Witness','Living Word','Fire Trial','Crown Balance','Deep Mirror','Return Path','Builder\'s Hand','Star Remembrance','River of Signs','Completion Seal'];
  const moonArchetypes = [
    { moon:1, element:'Fire', frequency:'144 Hz', essence:'Beginning, ignition, first witness', practice:'Start clean. Speak the first word. Mark the seed.', artwork:'assets/img/moons/moons/moon-01-seed-flame.webp' },
    { moon:2, element:'Water', frequency:'432 Hz', essence:'Memory, cleansing, emotional ground', practice:'Cleanse memory. Listen to dreams. Watch emotional weather.', artwork:'assets/img/moons/moons/moon-02-root-waters.webp' },
    { moon:3, element:'Air', frequency:'369 Hz', essence:'Word, air, signal, exchange', practice:'Guard speech. Track repeated words. Breathe before response.', artwork:'assets/img/moons/moons/moon-03-breath-gate.webp' },
    { moon:4, element:'Earth', frequency:'174 Hz', essence:'Body, structure, faithful record', practice:'Build structure. Repair the physical. Record what happened.', artwork:'assets/img/moons/moons/moon-04-stone-witness.webp' },
    { moon:5, element:'Aether', frequency:'528 Hz', essence:'Speech, vow, creative command', practice:'Speak with care. Create through ordered language.', artwork:'assets/img/moons/moons/moon-05-living-word.webp' },
    { moon:6, element:'Fire', frequency:'417 Hz', essence:'Testing, courage, purification', practice:'Let false things burn. Choose courage without rushing.', artwork:'assets/img/moons/moons/moon-06-fire-trial.webp' },
    { moon:7, element:'Aether', frequency:'963 Hz', essence:'Completion, justice, centered rule', practice:'Weigh the pattern. Balance mercy, truth, and consequence.', artwork:'assets/img/moons/moons/moon-07-crown-balance.webp' },
    { moon:8, element:'Water', frequency:'396 Hz', essence:'Reflection, hidden pattern, inner waters', practice:'Look beneath the surface. Journal before judging.', artwork:'assets/img/moons/moons/moon-08-deep-mirror.webp' },
    { moon:9, element:'Earth', frequency:'285 Hz', essence:'Restoration, repentance, spiral home', practice:'Correct course. Repair one broken loop.', artwork:'assets/img/moons/moons/moon-09-return-path.webp' },
    { moon:10, element:'Earth', frequency:'741 Hz', essence:'Craft, repair, stewardship', practice:'Build, fix, organize, and make the invisible useful.', artwork:'assets/img/moons/moons/moon-10-builders-hand.webp' },
    { moon:11, element:'Air', frequency:'852 Hz', essence:'Inheritance, names, celestial memory', practice:'Remember names, lineage, signs, and the long story.', artwork:'assets/img/moons/moons/moon-11-star-remembrance.webp' },
    { moon:12, element:'Water', frequency:'639 Hz', essence:'Movement, omens, living flow', practice:'Track timing. Move with wisdom. Do not force the river.', artwork:'assets/img/moons/moons/moon-12-river-of-signs.webp' },
    { moon:13, element:'Aether', frequency:'111 Hz', essence:'Harvest, sealing, preparation for reset', practice:'Close the loop. Harvest the lesson. Prepare the reset.', artwork:'assets/img/moons/moons/moon-13-completion-seal.webp' }
  ];
  const weekGates = [
    { week:1, title:'Week 1 · Ignition', guidance:'Begin, gather signal, establish the first witness.' },
    { week:2, title:'Week 2 · Formation', guidance:'Shape the pattern through body, speech, and daily structure.' },
    { week:3, title:'Week 3 · Testing', guidance:'Watch pressure, resistance, correction, and refinement.' },
    { week:4, title:'Week 4 · Sealing', guidance:'Harvest the lesson, close loops, and prepare the next moon.' }
  ];
  const daySeals = [
    ['Spark','First ignition. Start, name, begin.'],['Witness','Record what is actually there.'],['Breath','Speak, listen, exchange.'],['Root','Ground the body and home.'],['Water','Feel, cleanse, remember.'],['Stone','Build structure and boundary.'],['Fire','Test, purify, choose courage.'],['Gate','Make a decision or cross a threshold.'],['Mirror','Reflect before reacting.'],['Hand','Repair, craft, serve.'],['Voice','Say the true thing cleanly.'],['River','Move, adapt, follow flow.'],['Star','Remember inheritance and direction.'],['Balance','Weigh, measure, judge fairly.'],['Seed','Plant the next pattern.'],['Trial','Face resistance without panic.'],['Mercy','Release what can be released.'],['Sword','Cut the false attachment.'],['Oil','Consecrate the ordinary.'],['Bread','Receive provision and share it.'],['Watch','Stay awake to timing.'],['Return','Correct course.'],['Crown','Govern the self first.'],['Lamp','Bring light to one dark corner.'],['Name','Recover identity and purpose.'],['Field','Observe relationships.'],['Seal','Close what is complete.'],['Rest','Prepare the reset.']
  ].map((entry, index) => ({ day:index + 1, title:entry[0], guidance:entry[1] }));
  const shabbat = { enabled:true, begins:'Friday sunset', ends:'Saturday nightfall', moonDays:[2,9,16,23], preparationDay:1, returnDay:3, preserveContinuousWeekThroughYearGate:true };
  const yearGate = { title:'Year Gate / Day Out of Time', guidance:'The counted year pauses before the next anchor. Witness the threshold, then return clean.' };
  const calendarAnchor = { dayBoundary:'sunset', fallbackSunset:'18:00', anchorOverrides:{ 2026:'2026-04-17' }, firstAnchorRule:'Use the configured anchor override when present. Otherwise use the first new moon after March 20 in the local Gregorian year.' };
  const mirrorFocus = {
    general:{ title:'General Scroll', signal:'Watch the repeated word, the delayed door, the sudden message, the return of an old pattern, and the thing that asks to be written before it is explained.', crossing:'The crossing is haste. The false gate is reaction. The clean path is witness before movement.', action:'Write the signal. Name the pressure. Move only one true step. Let the day prove itself by repetition.' },
    family:{ title:'Family / Custody / Children', signal:'The child is the center of the reading. The noise around the child must bow to stability, pattern, record, and peace.', crossing:'The crossing is emotional fire. Do not let another person\'s disorder become the language of your next move.', action:'Hold the center. Keep the record clean. Let every action answer one question: does this build safety, order, and a faithful future for the child?' },
    work:{ title:'Work / Money / Provision', signal:'The material world is speaking through what breaks, what costs, what must be fixed, and what must finally be organized.', crossing:'The crossing is scatter. Ten fires call for your hand, but only one can be sealed first.', action:'Choose the repair that unlocks the next door. Build the ledger. Steward the tool. Turn pressure into order.' },
    body:{ title:'Body / Health / Rest', signal:'The body is not background. It is the instrument through which the day is being read.', crossing:'The crossing is forcing meaning through exhaustion. A weary vessel distorts the signal.', action:'Return to water, food, breath, sunlight, and rest. Let the body settle before the scroll is interpreted.' },
    spiritual:{ title:'Spiritual / Prayer / Scripture', signal:'The holy signal arrives as fruit: patience, truth, humility, courage, mercy, and clean action.', crossing:'The crossing is mistaking intensity for instruction. Fire must be governed before it becomes light.', action:'Pray, wait, write, test the fruit, and walk only the step that carries peace with strength.' },
    creative:{ title:'Creative / Codex / Building', signal:'The work is alive when it becomes coherent: one page, one function, one image, one clean bridge at a time.', crossing:'The crossing is trying to carry the whole mountain in one breath.', action:'Build one finished piece. Seal one clean layer. Let the larger scroll assemble by faithful parts.' }
  };
  return { moonNames, moonArchetypes, weekGates, daySeals, shabbat, yearGate, calendarAnchor, fallbackSunset:calendarAnchor.fallbackSunset, mirrorFocus, gateArtwork:{ preparation:'assets/img/moons/gates/gate-01-preparation.webp', alignment:'assets/img/moons/gates/gate-06-alignment.webp', return:'assets/img/moons/gates/gate-08-return.webp' }, dayArtworkManifest:[] };
});
