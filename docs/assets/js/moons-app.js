(() => {
  "use strict";

  if (window.__SOF_MOONS_APP_INITIALIZED__) return;
  window.__SOF_MOONS_APP_INITIALIZED__ = true;

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  const focusCopy = {
    general: {
      title: "General Scroll",
      opening: "The day opens like a scroll unsealed: the outer world speaks in timing, and the inner witness is called to stand upright.",
      signal: "Watch the repeated word, the delayed door, the sudden message, the return of an old pattern, and the thing that asks to be written before it is explained.",
      crossing: "The crossing is haste. The false gate is reaction. The clean path is witness before movement.",
      action: "Write the signal. Name the pressure. Move only one true step. Let the day prove itself by repetition."
    },
    family: {
      title: "Family / Custody / Children",
      opening: "The house-line is before the altar today: child, shelter, order, testimony, and the burden of protection.",
      signal: "The child is the center of the reading. The noise around the child must bow to stability, pattern, record, and peace.",
      crossing: "The crossing is emotional fire. Do not let another person’s disorder become the language of your next move.",
      action: "Hold the center. Keep the record clean. Let every action answer one question: does this build safety, order, and a faithful future for the child?"
    },
    work: {
      title: "Work / Money / Provision",
      opening: "Provision stands at the gate: tool, hand, labor, repair, debt, shelter, food, and the ground beneath the feet.",
      signal: "The material world is speaking through what breaks, what costs, what must be fixed, and what must finally be organized.",
      crossing: "The crossing is scatter. Ten fires call for your hand, but only one can be sealed first.",
      action: "Choose the repair that unlocks the next door. Build the ledger. Steward the tool. Turn pressure into order."
    },
    body: {
      title: "Body / Health / Rest",
      opening: "The body becomes the first prophet today: breath, hunger, sleep, pressure, pain, calm, and the hidden weather beneath thought.",
      signal: "The body is not background. It is the instrument through which the day is being read.",
      crossing: "The crossing is forcing meaning through exhaustion. A weary vessel distorts the signal.",
      action: "Return to water, food, breath, sunlight, and rest. Let the body settle before the scroll is interpreted."
    },
    spiritual: {
      title: "Spiritual / Prayer / Scripture",
      opening: "The day stands beneath the lamp: prayer, word, conscience, mercy, judgment, and the quiet fire of alignment.",
      signal: "The holy signal arrives as fruit: patience, truth, humility, courage, mercy, and clean action.",
      crossing: "The crossing is mistaking intensity for instruction. Fire must be governed before it becomes light.",
      action: "Pray, wait, write, test the fruit, and walk only the step that carries peace with strength."
    },
    creative: {
      title: "Creative / Codex / Building",
      opening: "The Codex gate opens through language, symbol, design, memory, and the hand that turns vision into form.",
      signal: "The work is alive when it becomes coherent: one page, one function, one image, one clean bridge at a time.",
      crossing: "The crossing is trying to carry the whole mountain in one breath.",
      action: "Build one finished piece. Seal one clean layer. Let the larger scroll assemble by faithful parts."
    }
  };

  function text(id) {
    return (document.getElementById(id)?.textContent || "").trim();
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function showToast(message) {
    const toast = document.getElementById("sofToast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(window.__sofToastTimer);
    window.__sofToastTimer = window.setTimeout(() => toast.classList.remove("show"), 1800);
  }

  async function copyText(value, successMessage) {
    if (!value) {
      showToast("Nothing to copy yet");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      showToast(successMessage);
    } catch {
      showToast("Copy failed");
    }
  }

  function setMeterWidth(id, value) {
    const node = document.getElementById(id);
    if (node) {
      node.style.width = `${Math.max(8, Math.min(100, value))}%`;
    }
  }

  function currentMirrorCopy() {
    const focus = $("#readingFocus");
    return focusCopy[focus?.value || "general"] || focusCopy.general;
  }

  function buildMirror() {
    const copy = currentMirrorCopy();
    const moon = text("moonName") || "Remnant Moon";
    const moonLine = text("moonLine") || "Moon cadence loading";
    const phase = text("phaseLine") || "Visible moon loading";
    const archetype = text("dayArchetype") || "Witness";
    const archetypeCopy = text("dayArchetypeCopy") || "Record what is actually there.";
    const week = text("weekGate") || "Week Gate";
    const weekCopy = text("weekGateCopy") || "The week gate is opening.";
    const solar = text("solarGate") || "Solar Gate";
    const solarCopy = text("skyMirrorCopy") || "The sky mirror is forming.";
    const field = text("statField") || "Unknown";
    const shabbatState = text("shabbatState") || "Ordinary Week Gate";
    const shabbatInstruction = text("shabbatInstruction") || "Observe first. Interpret slowly.";

    const title = `${moon} · ${archetype} Reading`;
    const reading =
`☲ DAILY MIRROR READING ☲

${copy.title}
${moon}
${moonLine}

The Opening
${copy.opening}

Moon Gate
The moon stands in ${moon}. Its tone is carried through the line:
${moonLine}

Visible Sign
${phase}

Day Seal
${archetype} — ${archetypeCopy}

Week Gate
${week}
${weekCopy}

Shabbat Gate
${shabbatState}
${shabbatInstruction}

Solar Gate
${solar}
${solarCopy}

Field Layer
${field}

The Signal
${copy.signal}

The Crossing
${copy.crossing}

Grounded Action
${copy.action}

Witness Questions
1. What repeated before I tried to explain it?
2. What word, message, delay, body signal, or timing is asking to be recorded?
3. What must be guarded: speech, child, body, money, home, tool, or vow?
4. What is the cleanest action that brings order without surrendering truth?
5. What must be sealed tonight so tomorrow can open clean?

Closing Seal
This does not command the day.
It reflects the pattern being walked through.`;

    setText("mirrorTitle", title);
    setText("mirrorSignal", copy.signal);
    setText("mirrorShadow", copy.crossing);
    setText("mirrorAction", copy.action);
    setText("mirrorOutput", reading);

    try {
      if (typeof gtag === "function") {
        gtag("event", "mirror_reading_built", { focus_name: $("#readingFocus")?.value || "general" });
      }
    } catch {}

    return reading;
  }

  function hydrateRitualUI() {
    const moon = text("moonName") || "Remnant Moon";
    const line = text("moonLine") || "Read the signal. Record the witness. Ground the body.";
    const phase = text("phaseLine") || "Visible moon";
    const day = text("dayInMoon") || "☾";
    const field = text("statField") || "Unknown";
    const logs = Number.parseInt(text("statLogs") || "0", 10) || 0;
    const patterns = Number.parseInt(text("statPatterns") || "0", 10) || 0;
    const fieldBoost = /storm|elevated|charged/i.test(field) ? 80 : /quiet/i.test(field) ? 35 : 52;

    setText("ritualTitle", moon);
    setText("ritualLine", `${line} · ${phase}`);
    setText("ritualMoonCore", day);
    setMeterWidth("meterCoherence", 38 + Math.min(34, logs * 8));
    setMeterWidth("meterBody", 48);
    setMeterWidth("meterSignal", 28 + Math.min(52, patterns * 18));
    setMeterWidth("meterField", fieldBoost);
    setMeterWidth("meterGround", fieldBoost > 65 ? 86 : 58);
    setText("meterCoherenceText", logs ? "Witness active" : "Gathering");
    setText("meterSignalText", patterns ? "Pattern seen" : "Listening");
    setText("meterFieldText", field);
    setText("meterGroundText", fieldBoost > 65 ? "High priority" : "Recommended");
  }

  function updateMemoryCopy() {
    const engine = window.ScrollOfFireMoons;
    if (!engine) return;
    const patterns = engine.detectPatterns(engine.logs());
    const words = patterns.windows?.[28] || [];

    setText(
      "memoryWordsCopy",
      words.length
        ? words.map(([term, count]) => `${term} ×${count}`).join(" · ")
        : "No repeated terms yet. Save 3–28 days of witness entries to reveal the pattern."
    );
    setText("memoryBodyCopy", "The body becomes clearer when the witness is repeated daily.");
    setText("memoryFieldCopy", "Pattern memory stays local in this browser. Export JSON before clearing storage.");
  }

  function closeMoreMenu({ returnFocus = false } = {}) {
    const menu = $("#moonsMoreMenu");
    const button = $("#moonsMoreButton");
    if (!menu || !button) return;
    menu.hidden = true;
    document.body.classList.remove("is-moons-menu-open");
    button.setAttribute("aria-expanded", "false");
    if (returnFocus) button.focus();
  }

  function openMoreMenu() {
    const menu = $("#moonsMoreMenu");
    const button = $("#moonsMoreButton");
    if (!menu || !button) return;
    menu.hidden = false;
    document.body.classList.add("is-moons-menu-open");
    button.setAttribute("aria-expanded", "true");
    menu.querySelector("button")?.focus();
  }

  function setupMoreMenu() {
    const button = $("#moonsMoreButton");
    const menu = $("#moonsMoreMenu");
    if (!button || !menu) return;

    button.addEventListener("click", () => {
      if (menu.hidden) {
        openMoreMenu();
      } else {
        closeMoreMenu({ returnFocus: true });
      }
    });

    menu.querySelectorAll("[data-mobile-tab]").forEach(item => {
      item.addEventListener("click", () => {
        window.setTimeout(() => closeMoreMenu(), 0);
      });
    });

    document.addEventListener("click", event => {
      if (menu.hidden) return;
      if (!event.target.closest("#moonsMoreMenu") && !event.target.closest("#moonsMoreButton")) {
        closeMoreMenu();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !menu.hidden) {
        closeMoreMenu({ returnFocus: true });
      }
    });
  }

  function pulseActionButtons() {
    ["saveWitness", "copyWitness", "copySeal", "copyAllLogs", "exportLogs"].forEach(id => {
      const button = document.getElementById(id);
      if (!button) return;
      button.addEventListener("click", () => {
        button.classList.add("pulse-save");
        window.setTimeout(() => button.classList.remove("pulse-save"), 800);
      });
    });
  }

  function syncAppUI() {
    buildMirror();
    hydrateRitualUI();
    updateMemoryCopy();
  }

  function setup() {
    $("#buildMirror")?.addEventListener("click", buildMirror);
    $("#copyMirror")?.addEventListener("click", async () => {
      await copyText(buildMirror(), "Reading copied");
    });
    $("#readingFocus")?.addEventListener("change", buildMirror);
    document.addEventListener("sof:moon-render", syncAppUI);
    document.addEventListener("sof:witness-saved", syncAppUI);
    pulseActionButtons();
    setupMoreMenu();
    window.setTimeout(syncAppUI, 350);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
