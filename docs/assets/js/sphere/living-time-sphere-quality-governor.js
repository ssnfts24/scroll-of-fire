(function (root, factory) {
  const api = factory();

  if (
    typeof module === "object"
    && module.exports
  ) {
    module.exports = api;
  }

  root.LivingTimeSphereQualityGovernor = api;

})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this,

  function () {
    "use strict";

    const VERSION =
      "living-time-sphere-quality-governor/1.0.0";

    /*
     * Adaptive-quality governor for the Living Time Sphere (R2 rework;
     * Living Strata Phase F — the visual governor).
     *
     * Research basis (2026-11-17 advanced-coding report, §1.5): on
     * low-end Android the binding constraint is fragment cost and heat,
     * not draw calls. The production answer is a governor that steps
     * quality down when frame time stays over budget and steps back up
     * cautiously when the device recovers.
     *
     * The renderer already had a first sketch of this: a frame-time
     * governor that only sheds cloud density. This module generalises
     * it into one governor with a fixed shed order —
     *
     *   1. cloud density        (cheapest to lose, first to go)
     *   2. pixel ratio (DPR)    (the fragment-cost lever)
     *   3. floating label count (DOM cost) and breath/flow effects
     *
     * — and recovery in reverse, one tier at a time, with hysteresis so
     * the picture never flaps between tiers.
     *
     * Pure decision core: feed it frame times, read the current tier.
     * The renderer applies the tier; this module touches no DOM/THREE.
     */

    const TIERS = Object.freeze([
      Object.freeze({
        tier: 0,
        cloudCap: 3,
        dprScale: 1,
        semanticScale: 1,
        effects: true
      }),
      Object.freeze({
        tier: 1,
        cloudCap: 2,
        dprScale: 1,
        semanticScale: 1,
        effects: true
      }),
      Object.freeze({
        tier: 2,
        cloudCap: 1,
        dprScale: 0.85,
        semanticScale: 1,
        effects: true
      }),
      Object.freeze({
        tier: 3,
        cloudCap: 1,
        dprScale: 0.7,
        semanticScale: 0.6,
        effects: false
      })
    ]);

    const DEFAULTS = Object.freeze({
      // Sustained frame time above this (ms) sheds a tier.
      shedAboveMs: 24,
      // Sustained frame time below this (ms) may restore a tier.
      restoreBelowMs: 15,
      /*
       * Evaluation windows are measured in accumulated frame time,
       * not frame count: on the struggling devices this governor
       * exists for, frames are scarce (at 7 fps a 45-frame window
       * takes over six seconds per step). A window closes once it
       * holds at least windowMs of frame time and minSamples samples.
       */
      windowMs: 1500,
      minSamples: 5,
      // Consecutive good windows required before restoring (hysteresis).
      restoreWindows: 2,
      // EMA weight for each new frame sample.
      emaAlpha: 0.08
    });

    function createGovernor(overrides = {}) {
      const config = { ...DEFAULTS, ...overrides };
      let tier = 0;
      let emaMs = 16.7;
      let windowTimeMs = 0;
      let windowSamples = 0;
      let goodWindows = 0;
      let samples = 0;

      /*
       * Feed one rendered frame's duration. Returns
       * { tier, changed } — changed is true only on the sample where
       * the tier actually moved, so callers can apply side effects
       * (like setPixelRatio) exactly once per move.
       */
      function sampleFrame(frameMs) {
        const ms = Number(frameMs);
        if (!Number.isFinite(ms) || ms <= 0) {
          return { tier, changed: false };
        }
        samples += 1;
        emaMs = emaMs * (1 - config.emaAlpha) + ms * config.emaAlpha;
        windowTimeMs += ms;
        windowSamples += 1;
        if (windowTimeMs < config.windowMs || windowSamples < config.minSamples) {
          return { tier, changed: false };
        }
        windowTimeMs = 0;
        windowSamples = 0;

        if (emaMs > config.shedAboveMs && tier < TIERS.length - 1) {
          tier += 1;
          goodWindows = 0;
          return { tier, changed: true };
        }
        if (emaMs < config.restoreBelowMs) {
          goodWindows += 1;
          if (goodWindows >= config.restoreWindows && tier > 0) {
            tier -= 1;
            goodWindows = 0;
            return { tier, changed: true };
          }
        } else {
          goodWindows = 0;
        }
        return { tier, changed: false };
      }

      function state() {
        return { ...TIERS[tier], emaMs, samples };
      }

      function reset() {
        tier = 0;
        emaMs = 16.7;
        windowTimeMs = 0;
        windowSamples = 0;
        goodWindows = 0;
        samples = 0;
      }

      return Object.freeze({
        sampleFrame,
        state,
        reset,
        tier: () => tier,
        config: Object.freeze({ ...config })
      });
    }

    /*
     * Page singleton. The visitor's options panel turns the governor
     * on or off; when off, every scale reads as the full-quality tier
     * so consumers behave exactly as the sphere does today.
     */
    const pageGovernor = createGovernor();
    let enabled = true;

    function setEnabled(value) {
      enabled = value !== false;
      if (!enabled) pageGovernor.reset();
    }

    function isEnabled() {
      return enabled;
    }

    function sampleFrame(frameMs) {
      if (!enabled) return { tier: 0, changed: false };
      return pageGovernor.sampleFrame(frameMs);
    }

    function activeTier() {
      if (!enabled) return TIERS[0];
      return TIERS[pageGovernor.tier()];
    }

    return Object.freeze({
      VERSION,
      TIERS,
      DEFAULTS,
      createGovernor,
      setEnabled,
      isEnabled,
      sampleFrame,
      cloudCap: () => activeTier().cloudCap,
      dprScale: () => activeTier().dprScale,
      semanticScale: () => activeTier().semanticScale,
      effectsEnabled: () => activeTier().effects,
      tier: () => (enabled ? pageGovernor.tier() : 0),
      state: () => (enabled ? pageGovernor.state() : { ...TIERS[0], emaMs: 0, samples: 0 })
    });
  }
);
