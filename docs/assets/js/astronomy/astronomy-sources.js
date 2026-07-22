(() => {
  "use strict";

  const sources = Object.freeze({
    primary: Object.freeze({
      id: "janmr-skyfield-naif-2026",
      label: "janmr.com equinoxes and solstices",
      source: "Skyfield Python library → NASA JPL NAIF/SPICE kernels",
      sourceVersion: "6262e4eb07b8de0d45f2256eef9f5b94bf3f8fdc",
      claimedPrecision: "±1 second",
      precisionSeconds: 1,
      method: "sourced",
      url: "https://janmr.com/"
    }),
    validation: Object.freeze({
      id: "bazica-solar-term-json",
      label: "bazica solar-term validation table",
      source: "Independent millisecond equinox table used as validation reference",
      sourceVersion: "79b48bf2",
      claimedPrecision: "millisecond table; used only for cross-check",
      method: "validation"
    }),
    lunar: Object.freeze({
      id: "approximate-synodic-phase",
      label: "Approximate synodic lunar phase",
      source: "Deterministic synodic-cycle approximation adapted from the 13 Moons app",
      claimedPrecision: "approximate",
      method: "calculated"
    })
  });

  globalThis.AstronomySources = Object.freeze({ sources });
})();
