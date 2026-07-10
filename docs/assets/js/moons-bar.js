/* Scroll of Fire — Moon Bar Widget
   Self-contained mini 13-Moons calendar for the home page strip.
   Uses the same Remnant 13 Moons algorithm as moons.js.
   No external dependencies.
*/
(function () {
  "use strict";

  /* ---- Moon & Day data (mirrors moons.js) ---- */
  var MOONS = [
    { name: "Seed Flame",       essence: "Beginning, ignition, first witness" },
    { name: "Root Waters",      essence: "Memory, cleansing, emotional ground" },
    { name: "Breath Gate",      essence: "Word, air, signal, exchange" },
    { name: "Stone Witness",    essence: "Body, structure, faithful record" },
    { name: "Living Word",      essence: "Speech, vow, creative command" },
    { name: "Fire Trial",       essence: "Testing, courage, purification" },
    { name: "Crown Balance",    essence: "Completion, justice, centered rule" },
    { name: "Deep Mirror",      essence: "Reflection, hidden pattern, inner waters" },
    { name: "Return Path",      essence: "Restoration, repentance, spiral home" },
    { name: "Builder's Hand",   essence: "Craft, repair, stewardship" },
    { name: "Star Remembrance", essence: "Inheritance, names, celestial memory" },
    { name: "River of Signs",   essence: "Movement, omens, living flow" },
    { name: "Completion Seal",  essence: "Harvest, sealing, preparation for reset" }
  ];

  var DAY_ARCHETYPES = [
    "Spark", "Witness", "Breath", "Root", "Water", "Stone", "Fire",
    "Gate", "Mirror", "Hand", "Voice", "River", "Star", "Balance",
    "Seed", "Trial", "Mercy", "Sword", "Oil", "Bread", "Watch",
    "Return", "Crown", "Lamp", "Name", "Field", "Seal", "Rest"
  ];

  /* ---- Calendar math (same logic as moons.js) ---- */
  function moonAge(date) {
    var synodic = 29.530588853;
    var epoch   = Date.UTC(2000, 0, 6, 18, 14, 0);
    var t       = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    return (((t - epoch) / 86400000 % synodic) + synodic) % synodic;
  }

  function addDays(d, n) {
    var x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function dayDiff(a, b) {
    var A = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    var B = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.floor((A - B) / 86400000);
  }

  function nearestNewMoonAfter(date) {
    var d = new Date(date);
    for (var i = 0; i < 40; i++) {
      var age = moonAge(d), nextAge = moonAge(addDays(d, 1));
      if (age > 28.5 || nextAge < age) return addDays(d, 1);
      d = addDays(d, 1);
    }
    return d;
  }

  function yearAnchorFor(date) {
    var y         = date.getFullYear();
    var candidate = nearestNewMoonAfter(new Date(y, 2, 20));
    if (date < candidate) return nearestNewMoonAfter(new Date(y - 1, 2, 20));
    return candidate;
  }

  function getMoonPos(date) {
    var anchor = yearAnchorFor(date);
    var diff   = dayDiff(date, anchor);
    var inside = diff >= 0 && diff < 13 * 28;
    if (!inside) {
      return { inside: false, day: null, moonIndex: 12, moon: MOONS[12], archetype: null };
    }
    var moonIndex = Math.floor(diff / 28);
    var day       = (diff % 28) + 1;
    return {
      inside:    true,
      day:       day,
      moonIndex: moonIndex,
      moon:      MOONS[moonIndex],
      archetype: DAY_ARCHETYPES[day - 1] || null
    };
  }

  /* ---- Render ---- */
  function render() {
    var wrap = document.getElementById("sofMoonBar");
    if (!wrap) return;

    var today = new Date();
    var pos   = getMoonPos(today);

    var nameEl = document.getElementById("mbName");
    var dayEl  = document.getElementById("mbDay");
    var essEl  = document.getElementById("mbEssence");
    var arcEl  = document.getElementById("mbArcMini");
    var linkEl = document.getElementById("moonMiniLink");

    if (nameEl) {
      nameEl.textContent = pos.inside ? pos.moon.name + " Moon" : "Day Out of Time";
    }
    if (dayEl) {
      dayEl.textContent = pos.inside ? "Day " + pos.day + " of 28" : "Outside the 13\xd728 count";
    }
    if (essEl) {
      essEl.textContent = pos.inside
        ? (pos.archetype ? pos.archetype + " \xb7 " : "") + pos.moon.essence
        : pos.moon.essence;
    }

    if (arcEl && pos.inside) {
      var CIRC     = Math.round(2 * Math.PI * 18); /* r=18, circ≈113 */
      var progress = Math.round(CIRC * (pos.day / 28));
      arcEl.setAttribute("stroke-dasharray", progress + " " + Math.max(0, CIRC - progress));
    }

    if (linkEl) {
      var y  = today.getFullYear();
      var m  = String(today.getMonth() + 1).padStart(2, "0");
      var dd = String(today.getDate()).padStart(2, "0");
      linkEl.href = "moons.html?date=" + y + "-" + m + "-" + dd;
    }

    wrap.removeAttribute("hidden");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
})();
