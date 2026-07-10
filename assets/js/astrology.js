/* Scroll of Fire — Astrology + Planetary Mirror Layer
   Reads the selected Gregorian date only.
   Does NOT overwrite the 13-Moon calendar engine.

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

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("sof:moon-render", function () {
    render();
  });

  function init() {
    const panel = document.querySelector("[data-astrology-panel]");
    if (!panel) return;

    render();

    const datePick = document.getElementById("datePick");
    if (datePick) datePick.addEventListener("change", render);

    ["btnToday", "prevDay", "nextDay"].forEach(function (id) {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener("click", function () {
        setTimeout(render, 80);
      });
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

    set("[data-solar-gate]", solar.name + " · " + solar.element);
    set("[data-solar-copy]", solar.copy);
    set("[data-elemental-tone]", solar.element);
    set("[data-elemental-copy]", elementalCopy(solar.element));
    set("[data-moon-reflection]", moonText || "13-Moon Cadence");
    set("[data-moon-reflection-copy]", "Reflection follows the active Remnant Moon date from the main calendar engine.");
    set("[data-astro-status]", "Astrology and planetary correspondence loaded without changing the 13-Moon date engine.");

    setById("astroSolarGate", solar.name + " · " + solar.element);
    setById("astroSolarCopy", solar.copy);
    setById("astroElement", solar.element);
    setById("astroElementCopy", elementalCopy(solar.element));
    setById("astroMoonMirror", moonText || "13-Moon Cadence");
    setById("astroMoonCopy", "Reflection follows the active Remnant Moon date from the main calendar engine.");
    setById("astroCounsel", counselTitle(solar.element));
    setById("astroCounselCopy", counselCopy(solar.element));
    setById("astroBodyHouse", bodyHouse(solar.name));
    setById("astroBodyCopy", bodyCopy(solar.name));
    setById("astroIntegration", "Ground the Signal");
    setById("astroIntegrationCopy", "Let the sky become a mirror, then let the body choose the grounded step.");

    const placements = buildPlacements(date);
    paintPlanetarium(placements);
    paintPlanetCards(placements);
    paintAspectCards(placements);
  }

  function getCurrentDate() {
    const input = document.getElementById("datePick");
    if (input && input.value) {
      const parts = input.value.split("-").map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    }
    return new Date();
  }

  function solarSign(date) {
    const m = date.getMonth() + 1;
    const d = date.getDate();

    if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) return signByName("Aries");
    if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) return signByName("Taurus");
    if ((m === 5 && d >= 21) || (m === 6 && d <= 20)) return signByName("Gemini");
    if ((m === 6 && d >= 21) || (m === 7 && d <= 22)) return signByName("Cancer");
    if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) return signByName("Leo");
    if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) return signByName("Virgo");
    if ((m === 9 && d >= 23) || (m === 10 && d <= 22)) return signByName("Libra");
    if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) return signByName("Scorpio");
    if ((m === 11 && d >= 22) || (m === 12 && d <= 21)) return signByName("Sagittarius");
    if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) return signByName("Capricorn");
    if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) return signByName("Aquarius");
    return signByName("Pisces");
  }

  function signByName(name) {
    return SIGNS.find(function (s) { return s.name === name; }) || SIGNS[0];
  }

  function signFromDegree(deg) {
    const normalized = normDeg(deg);
    const index = Math.floor(normalized / 30);
    return SIGNS[index] || SIGNS[0];
  }

  function normDeg(value) {
    if (!Number.isFinite(value)) return 0;
    let d = value % 360;
    if (d < 0) d += 360;
    return d;
  }

  function daysSinceEpoch(date) {
    const epoch = Date.UTC(2000, 0, 1, 12, 0, 0);
    return (date.getTime() - epoch) / 86400000;
  }

  function buildPlacements(date) {
    if (window.__EPHEMERIS__ && window.__EPHEMERIS__.placements) {
      const fromEph = {};
      PLANETS.forEach(function (p) {
        const raw = window.__EPHEMERIS__.placements[p.id];
        const deg = Number.isFinite(raw) ? normDeg(raw) : approximateDegree(date, p);
        fromEph[p.id] = makePlacement(p, deg);
      });
      return fromEph;
    }

    const placements = {};
    PLANETS.forEach(function (p) {
      placements[p.id] = makePlacement(p, approximateDegree(date, p));
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

  function makePlacement(planet, deg) {
    const sign = signFromDegree(deg);
    return {
      id: planet.id,
      name: planet.name,
      glyph: planet.glyph,
      degree: deg,
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

    host.querySelectorAll(".planet-orbit,.zodiac-label").forEach(function (n) {
      n.remove();
    });

    SIGNS.forEach(function (s, i) {
      const label = document.createElement("span");
      label.className = "zodiac-label";
      label.style.setProperty("--a", (i * 30) + "deg");
      label.textContent = s.glyph + " " + s.name;
      host.appendChild(label);
    });

    Object.values(placements).forEach(function (p) {
      if (p.id === "sun") return;

      const orbit = document.createElement("div");
      orbit.className = "planet-orbit";
      orbit.style.setProperty("--orbit", p.orbit + "px");
      orbit.style.setProperty("--angle", p.degree + "deg");

      const dot = document.createElement("span");
      dot.className = "planet-dot";
      dot.style.setProperty("--size", p.size + "px");
      dot.style.setProperty("--planet-color", p.color);
      dot.setAttribute("data-symbol", p.glyph);
      dot.title = `${p.name} · ${Math.round(p.degree * 10) / 10}° · ${p.sign}`;

      orbit.appendChild(dot);
      host.appendChild(orbit);
    });
  }

  function paintPlanetCards(placements) {
    const grid = document.getElementById("planetGrid");
    if (!grid) return;

    grid.innerHTML = Object.values(placements).map(function (p) {
      const deg = Math.round(p.degree * 10) / 10;
      return `
        <article class="planet-card">
          <strong><span>${p.glyph} ${p.name}</span><span>${deg}°</span></strong>
          <span>${p.signGlyph} ${p.sign} · ${p.element}</span>
          <small>${p.copy}</small>
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
      { name: "Conjunction", deg: 0, orb: 8 },
      { name: "Sextile", deg: 60, orb: 5 },
      { name: "Square", deg: 90, orb: 6 },
      { name: "Trine", deg: 120, orb: 6 },
      { name: "Opposition", deg: 180, orb: 8 }
    ];

    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const a = values[i];
        const b = values[j];
        let diff = Math.abs(a.degree - b.degree);
        diff = diff > 180 ? 360 - diff : diff;

        targets.forEach(function (target) {
          if (Math.abs(diff - target.deg) <= target.orb) {
            aspects.push({ a, b, target, diff });
          }
        });
      }
    }

    if (!aspects.length) {
      grid.innerHTML = `<article class="aspect-card"><strong>Quiet Aspect Field</strong><p>No major symbolic aspects within the current mirror orb.</p></article>`;
      return;
    }

    grid.innerHTML = aspects.slice(0, 9).map(function (x) {
      return `
        <article class="aspect-card">
          <strong>${x.a.glyph} ${x.a.name} ${x.target.name} ${x.b.glyph} ${x.b.name}</strong>
          <p>${Math.round(x.diff * 10) / 10}° separation · ${aspectCopy(x.target.name)}</p>
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
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function setById(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
})();
