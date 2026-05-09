(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);

  const navToggle = $("[data-nav-toggle]");
  const nav = $("[data-site-nav]");

  if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    });

    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        nav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Open navigation");
      }
    });
  }

  document.documentElement.classList.add("js-ready");
})();

(function attachAstrologyPanel() {
  const signEl = document.getElementById("astroSign");
  const rangeEl = document.getElementById("astroRange");
  const elementEl = document.getElementById("astroElement");
  const elementTextEl = document.getElementById("astroElementText");

  if (!signEl || !rangeEl || !elementEl || !elementTextEl) return;

  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const key = month * 100 + day;

  const signs = [
    ["Capricorn", "Earth", "Dec 22 — Jan 19", 1222, 119],
    ["Aquarius", "Air", "Jan 20 — Feb 18", 120, 218],
    ["Pisces", "Water", "Feb 19 — Mar 20", 219, 320],
    ["Aries", "Fire", "Mar 21 — Apr 19", 321, 419],
    ["Taurus", "Earth", "Apr 20 — May 20", 420, 520],
    ["Gemini", "Air", "May 21 — Jun 20", 521, 620],
    ["Cancer", "Water", "Jun 21 — Jul 22", 621, 722],
    ["Leo", "Fire", "Jul 23 — Aug 22", 723, 822],
    ["Virgo", "Earth", "Aug 23 — Sep 22", 823, 922],
    ["Libra", "Air", "Sep 23 — Oct 22", 923, 1022],
    ["Scorpio", "Water", "Oct 23 — Nov 21", 1023, 1121],
    ["Sagittarius", "Fire", "Nov 22 — Dec 21", 1122, 1221]
  ];

  const current = signs.find(([name, element, range, start, end]) => {
    if (name === "Capricorn") return key >= 1222 || key <= 119;
    return key >= start && key <= end;
  });

  if (!current) return;

  const [name, element, range] = current;

  const elementCopy = {
    Fire: "Action, ignition, courage, movement, and visible transformation.",
    Earth: "Grounding, structure, patience, embodiment, and faithful building.",
    Air: "Breath, language, thought, pattern, signal, and interpretation.",
    Water: "Memory, emotion, cleansing, intuition, and deep reflection."
  };

  signEl.textContent = name;
  rangeEl.textContent = range;
  elementEl.textContent = element;
  elementTextEl.textContent = elementCopy[element] || "Elemental reflection active.";
})();
