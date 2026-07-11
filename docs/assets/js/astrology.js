/* Scroll of Fire — Astrology + Planetary Mirror Layer
   Uses the effective Remnant date supplied by assets/js/moons.js.
   When Sunset Boundary advances the calendar after sunset, this layer advances too.

   Modes:
   1) Built-in symbolic planetary painter using simple cyclic approximations.
   2) Optional real ephemeris override using window.__EPHEMERIS__ if provided later.

   For precise astronomy, connect a real ephemeris source later.
*/
(function () {
  "use strict";

  const SIGNS = [
    { name: "Aries",       glyph: "♈", element: "Fire",  copy: "Ignition, courage, first flame." },
    { name: "Taurus",      glyph: "♉", element: "Earth", copy: "Body, garden, faithful ground." },
    { name: "Gemini",      glyph: "♊", element: "Air",   copy: "Word, exchange, double witness." },
    { name: "Cancer",      glyph: "♋", element: "Water", copy: "Home, memory, sacred shelter." },
    { name: "Leo",         glyph: "♌", element: "Fire",  copy: "Heart, radiance, royal courage." },
    { name: "Virgo",       glyph: "♍", element: "Earth", copy: "Order, repair, clean vessel." },
    { name: "Libra",       glyph: "♎", element: "Air",   copy: "Balance, justice, measured scales." },
    { name: "Scorpio",     glyph: "♏", element: "Water", copy: "Depth, hidden truth, transformation." },
    { name: "Sagittarius", glyph: "♐", element: "Fire",  copy: "Arrow, pilgrimage, higher law." },
    { name: "Capricorn",   glyph: "♑", element: "Earth", copy: "Discipline, structure, mountain path." },
    { name: "Aquarius",    glyph: "♒", element: "Air",   copy: "Signal, vision, living network." },
    { name: "Pisces",      glyph: "♓", element: "Water", copy: "Dream, mercy, deep current." }
  ];

  const PLANETS = [
    { id: "sun",     name: "Sun",     glyph: "☉", orbit: 115, size: 14, color: "#f3c97a", period: 365.2422, seed: 0 },
    { id: "moon",    name: "Moon",    glyph: "☾", orbit: 145, size: 12, color: "#d8f9ff", period: 27.3217, seed: 80 },
    { id: "mercury", name: "Mercury", glyph: "☿", orbit: 175, size: 10, color: "#b7c7d8", period: 87.969, seed: 35 },
    { id: "venus",   name: "Venus",   glyph: "♀", orbit: 205, size: 12, color: "#ffd6a5", period: 224.701, seed: 110 },
    { id: "mars",    name: "Mars",    glyph: "♂", orbit: 235, size: 11, color: "#ff9aaa", period: 686.98, seed: 210 },
    { id: "jupiter", name: "Jupiter", glyph: "♃", orbit: 265, size: 14, color: "#f5d28b", period: 4332.59, seed: 280 },
    { id: "saturn",  name: "Saturn",  glyph: "♄", orbit: 295, size: 13, color: "#c4a3ff", period: 10759.22, seed: 320 }
  ];

  let activeEffectiveDate = null;
  let activeEffectiveISO = "";
  let activeBoundary = null;
  let activeShabbat = null;
  let initialized = false;

  document.addEventListener("sof:moon-render", function (event) {
    const detail = event.detail || {};

    activeEffectiveDate =
      parseISODate(detail.effectiveISO) ||
      parseDateObject(detail.effectiveDate) ||
      parseISODate(detail.iso) ||
      parseDateObject(detail.date) ||
      null;

    activeEffectiveISO = detail.effectiveISO || "";
    activeBoundary = detail.boundary || null;
    activeShabbat = detail.shabbat || null;

    if (initialized) render();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    const panel = document.querySelector("[data-astrology-panel]");
    if (!panel) return;

    initialized = true;
    render();

    const datePick = document.getElementById("datePick");
    if (datePick) {
      datePick.addEventListener("change", function () {
        if (!activeEffectiveDate) render();
      });
    }

    ["btnToday", "prevDay", "nextDay"].forEach(function (id) {
      const button = document.getElementById(id);
      if (button) {
        button.addEventListener("click", function () {
          setTimeout(render, 100);
        });
      }
    });

    panel.classList.add("is-loaded");
  }

  function render() {
    const panel = document.querySelector("[data-astrology-panel]");
    if (!panel) return;

    const date = getCurrentDate();
    const solar = solarSign(date);
    const moonLine = document.getElementById("moonLine");
    const moonText = moonLine ? moonLine.textContent.trim() : "13-Moon Cadence";
    const boundaryText = activeBoundary
      ? `${activeBoundary.label || activeBoundary.mode || "Calendar boundary"} · ${activeBoundary.sunset || ""}`.trim()
      : "Civil date fallback";
    const shabbatText = activeShabbat?.state || "Weekly gate loading";

    set("[data-solar-gate]", solar.name + " · " + solar.element);
    set("[data-solar-copy]", solar.copy);
    set("[data-elemental-tone]", solar.element);
    set("[data-elemental-copy]", elementalCopy(solar.element));
    set("[data-moon-reflection]", moonText || "13-Moon Cadence");
    set(
      "[data-moon-reflection-copy]",
      "Reflection follows the effective Remnant date from the main calendar engine, including sunset turnover."
    );
    set(
      "[data-astro-status]",
      `Astrology mirror loaded for ${formatDate(date)}${activeEffectiveISO ? ` · effective ${activeEffectiveISO}` : ""} · ${boundaryText} · ${shabbatText}.`
    );

    setById("astroSolarGate", solar.name + " · " + solar.element);
    setById("astroSolarCopy", solar.copy);
    setById("astroElement", solar.element);
    setById("astroElementCopy", elementalCopy(solar.element));
    setById("astroMoonMirror", moonText || "13-Moon Cadence");
    setById(
      "astroMoonCopy",
      `Reflection follows the active Remnant date. ${shabbatText}.`
    );
    setById("astroCounsel", counselTitle(solar.element));
    setById("astroCounselCopy", counselCopy(solar.element));
    setById("astroBodyHouse", bodyHouse(solar.name));
    setById("astroBodyCopy", bodyCopy(solar.name));
    setById("astroIntegration", integrationTitle(activeShabbat));
    setById("astroIntegrationCopy", integrationCopy(activeShabbat));

    const placements = buildPlacements(date);
    paintPlanetarium(placements);
    paintPlanetCards(placements);
    paintAspectCards(placements);
  }

  function parseISODate(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

    const parts = value.split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function parseDateObject(value) {
    if (!value) return null;

    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      12,
      0,
      0,
      0
    );
  }

  function getCurrentDate() {
    if (activeEffectiveDate) return new Date(activeEffectiveDate);

    const moons = window.ScrollOfFireMoons;
    if (moons && typeof moons.effectiveDate === "function") {
      const date = moons.effectiveDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          12,
          0,
          0,
          0
        );
      }
    }

    const input = document.getElementById("datePick");
    if (input && input.value) {
      return parseISODate(input.value) || new Date();
    }

    return new Date();
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(date);
  }

  function solarSign(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return signByName("Aries");
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return signByName("Taurus");
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return signByName("Gemini");
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return signByName("Cancer");
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return signByName("Leo");
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return signByName("Virgo");
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return signByName("Libra");
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return signByName("Scorpio");
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return signByName("Sagittarius");
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return signByName("Capricorn");
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return signByName("Aquarius");
    return signByName("Pisces");
  }

  function signByName(name) {
    return SIGNS.find(function (sign) {
      return sign.name === name;
    }) || SIGNS[0];
  }

  function signFromDegree(degree) {
    const normalized = normDeg(degree);
    const index = Math.floor(normalized / 30);
    return SIGNS[index] || SIGNS[0];
  }

  function normDeg(value) {
    if (!Number.isFinite(value)) return 0;

    let degree = value % 360;
    if (degree < 0) degree += 360;
    return degree;
  }

  function daysSinceEpoch(date) {
    const epoch = Date.UTC(2000, 0, 1, 12, 0, 0);
    const current = Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      12,
      0,
      0
    );

    return (current - epoch) / 86400000;
  }

  function buildPlacements(date) {
    if (window.__EPHEMERIS__ && window.__EPHEMERIS__.placements) {
      const ephemerisPlacements = {};

      PLANETS.forEach(function (planet) {
        const raw = window.__EPHEMERIS__.placements[planet.id];
        const degree = Number.isFinite(raw)
          ? normDeg(raw)
          : approximateDegree(date, planet);

        ephemerisPlacements[planet.id] = makePlacement(planet, degree);
      });

      return ephemerisPlacements;
    }

    const placements = {};

    PLANETS.forEach(function (planet) {
      placements[planet.id] = makePlacement(
        planet,
        approximateDegree(date, planet)
      );
    });

    return placements;
  }

  function approximateDegree(date, planet) {
    const days = daysSinceEpoch(date);

    if (planet.id === "sun") {
      const start = new Date(date.getFullYear(), 2, 20, 12, 0, 0);
      const dayOfSolarYear = (date - start) / 86400000;
      return normDeg(dayOfSolarYear * 360 / 365.2422);
    }

    return normDeg(planet.seed + days * 360 / planet.period);
  }

  function makePlacement(planet, degree) {
    const sign = signFromDegree(degree);

    return {
      id: planet.id,
      name: planet.name,
      glyph: planet.glyph,
      degree,
      sign: sign.name,
      signGlyph: sign.glyph,
      element: sign.element,
      copy: sign.copy,
      orbit: planet.orbit,
      size: planet.size,
      color: planet.color
    };
  }

  function paintPlanetarium(placements) {
    const host = document.getElementById("planetarium");
    if (!host) return;

    host.querySelectorAll(".planet-orbit,.zodiac-label").forEach(function (node) {
      node.remove();
    });

    SIGNS.forEach(function (sign, index) {
      const label = document.createElement("span");
      label.className = "zodiac-label";
      label.style.setProperty("--a", (index * 30) + "deg");
      label.textContent = sign.glyph + " " + sign.name;
      host.appendChild(label);
    });

    Object.values(placements).forEach(function (placement) {
      if (placement.id === "sun") return;

      const orbit = document.createElement("div");
      orbit.className = "planet-orbit";
      orbit.style.setProperty("--orbit", placement.orbit + "px");
      orbit.style.setProperty("--angle", placement.degree + "deg");

      const dot = document.createElement("span");
      dot.className = "planet-dot";
      dot.style.setProperty("--size", placement.size + "px");
      dot.style.setProperty("--planet-color", placement.color);
      dot.setAttribute("data-symbol", placement.glyph);
      dot.title = `${placement.name} · ${Math.round(placement.degree * 10) / 10}° · ${placement.sign}`;

      orbit.appendChild(dot);
      host.appendChild(orbit);
    });
  }

  function paintPlanetCards(placements) {
    const grid = document.getElementById("planetGrid");
    if (!grid) return;

    grid.innerHTML = Object.values(placements).map(function (placement) {
      const degree = Math.round(placement.degree * 10) / 10;

      return `
        <article class="planet-card">
          <strong><span>${placement.glyph} ${placement.name}</span><span>${degree}°</span></strong>
          <span>${placement.signGlyph} ${placement.sign} · ${placement.element}</span>
          <small>${placement.copy}</small>
        </article>
      `;
    }).join("");
  }

  function paintAspectCards(placements) {
    const grid = document.getElementById("aspectGrid");
    if (!grid) return;

    const values = Object.values(placements);
    const aspects = [];
    const targets = [
      { name: "Conjunction", degree: 0, orb: 8 },
      { name: "Sextile", degree: 60, orb: 5 },
      { name: "Square", degree: 90, orb: 6 },
      { name: "Trine", degree: 120, orb: 6 },
      { name: "Opposition", degree: 180, orb: 8 }
    ];

    for (let first = 0; first < values.length; first++) {
      for (let second = first + 1; second < values.length; second++) {
        const a = values[first];
        const b = values[second];

        let difference = Math.abs(a.degree - b.degree);
        difference = difference > 180 ? 360 - difference : difference;

        targets.forEach(function (target) {
          if (Math.abs(difference - target.degree) <= target.orb) {
            aspects.push({ a, b, target, difference });
          }
        });
      }
    }

    if (!aspects.length) {
      grid.innerHTML = `
        <article class="aspect-card">
          <strong>Quiet Aspect Field</strong>
          <p>No major symbolic aspects within the current mirror orb.</p>
        </article>
      `;
      return;
    }

    grid.innerHTML = aspects.slice(0, 9).map(function (aspect) {
      return `
        <article class="aspect-card">
          <strong>${aspect.a.glyph} ${aspect.a.name} ${aspect.target.name} ${aspect.b.glyph} ${aspect.b.name}</strong>
          <p>${Math.round(aspect.difference * 10) / 10}° separation · ${aspectCopy(aspect.target.name)}</p>
        </article>
      `;
    }).join("");
  }

  function aspectCopy(name) {
    return {
      Conjunction: "Two signals stand close together. Notice fusion, intensity, and focus.",
      Sextile: "A cooperative opening. Use it through practical action.",
      Square: "A friction point. Build structure before reacting.",
      Trine: "A flowing current. Let ease become discipline.",
      Opposition: "A mirror across the wheel. Seek balance before judgment."
    }[name] || "Symbolic aspect mirror.";
  }

  function elementalCopy(element) {
    return {
      Fire: "Action, courage, ignition, and visible transformation.",
      Water: "Memory, mercy, intuition, cleansing, and emotional truth.",
      Earth: "Body, order, patience, stewardship, and grounded repair.",
      Air: "Word, signal, breath, learning, and clear exchange."
    }[element] || "Symbolic correspondence.";
  }

  function counselTitle(element) {
    return {
      Fire: "Move with Courage",
      Water: "Cleanse and Remember",
      Earth: "Ground the Work",
      Air: "Guard the Word"
    }[element] || "Witness";
  }

  function counselCopy(element) {
    return {
      Fire: "Let the flame move through disciplined action, not impulse.",
      Water: "Let feeling become witness before it becomes response.",
      Earth: "Make the next repair visible. Build the ground under the vision.",
      Air: "Speak clearly. Track repeated words. Breathe before response."
    }[element] || "Observe first. Interpret after the pattern repeats.";
  }

  function integrationTitle(shabbat) {
    if (!shabbat) return "Ground the Signal";
    if (shabbat.code === "active") return "Cease and Restore";
    if (shabbat.code === "preparation") return "Prepare the Vessel";
    if (shabbat.code === "return") return "Return with Order";
    return "Ground the Signal";
  }

  function integrationCopy(shabbat) {
    if (!shabbat) {
      return "Let the sky become a mirror, then let the body choose the grounded step.";
    }

    if (shabbat.code === "active") {
      return "Let the symbolic mirror support rest, prayer, family, food, reflection, and restoration rather than more forced production.";
    }

    if (shabbat.code === "preparation") {
      return "Finish what is necessary, settle the household, and prepare to stop without carrying avoidable disorder into rest.";
    }

    if (shabbat.code === "return") {
      return "Carry the lesson forward through one deliberate action rather than rushing back into scattered labor.";
    }

    return "Let the sky become a mirror, then let the body choose the grounded step.";
  }

  function bodyHouse(sign) {
    return {
      Aries: "Head / Initiation",
      Taurus: "Throat / Provision",
      Gemini: "Hands / Exchange",
      Cancer: "Chest / Shelter",
      Leo: "Heart / Radiance",
      Virgo: "Gut / Order",
      Libra: "Balance / Justice",
      Scorpio: "Depth / Release",
      Sagittarius: "Hips / Pilgrimage",
      Capricorn: "Bones / Structure",
      Aquarius: "Nerves / Network",
      Pisces: "Feet / Mercy"
    }[sign] || "Body Mirror";
  }

  function bodyCopy(sign) {
    return {
      Aries: "Begin cleanly. Do not let urgency outrun wisdom.",
      Taurus: "Return to food, money, shelter, land, tools, and the voice.",
      Gemini: "Sort messages, documents, speech, timing, and witness.",
      Cancer: "Protect home, children, memory, and emotional shelter.",
      Leo: "Lead from the heart without performing for approval.",
      Virgo: "Repair the small thing. Clean order becomes spiritual order.",
      Libra: "Bring balance to conflict, evidence, agreements, and justice.",
      Scorpio: "Face what is hidden without letting it consume the day.",
      Sagittarius: "Aim the arrow. Choose the road that serves higher law.",
      Capricorn: "Build the structure slowly enough to last.",
      Aquarius: "Watch the network, signal, technology, and collective pattern.",
      Pisces: "Let mercy guide the ending, release, and dream current."
    }[sign] || "Listen to the body as part of the witness.";
  }

  function set(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function setById(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }
})();
