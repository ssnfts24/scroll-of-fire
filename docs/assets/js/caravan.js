/* Scroll of Fire — Covenant Caravan Page */

(function () {
  "use strict";

  const navToggle = document.querySelector(".nav-toggle");
  const navMenu = document.getElementById("navMenu");

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => {
      const isOpen = navMenu.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  const phaseTabs = document.querySelectorAll(".phase-tab");
  const phasePanels = document.querySelectorAll(".phase-panel");

  phaseTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.dataset.phase;

      phaseTabs.forEach((item) => item.classList.remove("active"));
      phasePanels.forEach((panel) => panel.classList.remove("active"));

      tab.classList.add("active");

      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.add("active");
      }
    });
  });
})();
