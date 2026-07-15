/* Scroll of Fire — Remnant 13 Moons Image Integration
   Uses the filenames currently stored in the repository.

   Load this file after:
   1. moons.js
   2. astrology.js

   Day images remain disabled until all 28 are complete.
*/

(() => {
  "use strict";

  const ROOT = "assets/img/moons";

  /*
   * The Moon files use the simple naming system:
   * moon1.webp through moon13.webp
   */
  const MOON_IMAGES = [
    ["moon1.webp", "Moon 1 — Seed Flame"],
    ["moon2.webp", "Moon 2 — Root Waters"],
    ["moon3.webp", "Moon 3 — Breath Gate"],
    ["moon4.webp", "Moon 4 — Stone Witness"],
    ["moon5.webp", "Moon 5 — Living Word"],
    ["moon6.webp", "Moon 6 — Fire Trial"],
    ["moon7.webp", "Moon 7 — Crown Balance"],
    ["moon8.webp", "Moon 8 — Deep Mirror"],
    ["moon9.webp", "Moon 9 — Return Path"],
    ["moon10.webp", "Moon 10 — Builder’s Hand"],
    ["moon11.webp", "Moon 11 — Star Remembrance"],
    ["moon12.webp", "Moon 12 — River of Signs"],
    ["moon13.webp", "Moon 13 — Completion Seal"]
  ];

  /*
   * These paths match the filenames visible in your repository.
   *
   * GitHub Pages is case-sensitive:
   * Today.webp is not the same as today.webp.
   * Transmission.webp is not the same as transmission.webp.
   * calenders.webp is intentionally spelled as it currently exists.
   */
  const PANEL_IMAGES = {
    todayPanel: [
      "sections/Today.webp",
      "Today in the Remnant 13 Moons calendar"
    ],

    flowPanel: [
      "sections/Transmission.webp",
      "Daily transmission and ritual flow"
    ],

    mirrorPanel: [
      "sections/memory.webp",
      "Mirror reading and pattern memory"
    ],

    witnessPanel: [
      "sections/witness.webp",
      "Daily witness and coherence log"
    ],

    astrologyPanel: [
      "sections/astrology.webp",
      "Astrology and planetary alignment mirror"
    ],

    calendarPanel: [
      "sections/calenders.webp",
      "Remnant and Gregorian calendar overlays"
    ],

    codexPanel: [
      "sections/builder.webp",
      "Codex seal and builder’s pattern"
    ],

    fieldPanel: [
      "sections/frequency.webp",
      "Frequency and field observation layer"
    ]
  };

  const GATE_IMAGES = [
    [
      "gates/gate-01-preparation.webp",
      "Preparation Gate"
    ],

    [
      "gates/gate-06-alignment.webp",
      "Shabbat Alignment"
    ],

    [
      "gates/gate-08-return.webp",
      "Return Gate"
    ]
  ];

  function createFigure(path, alt, className) {
    const figure = document.createElement("figure");
    figure.className = className;

    const img = document.createElement("img");

    img.src = `${ROOT}/${path}`;
    img.alt = alt;
    img.decoding = "async";

    if (className === "moons-app-hero") {
      img.loading = "eager";
      img.fetchPriority = "high";
    } else {
      img.loading = "lazy";
    }

    /*
     * Makes missing paths easier to detect without breaking the page.
     */
    img.addEventListener("error", () => {
      figure.classList.add("image-load-failed");

      console.warn(
        "[Remnant 13 Moons] Image could not be loaded:",
        img.src
      );
    });

    figure.appendChild(img);

    return figure;
  }

  function installHero() {
    const pageHead = document.querySelector(".page-head");

    if (!pageHead) {
      return;
    }

    if (pageHead.querySelector(".moons-app-hero")) {
      return;
    }

    const subtitle = pageHead.querySelector(".subtitle");

    const hero = createFigure(
      "app/splash-2732.webp",
      "Remnant 13 Moons living calendar",
      "moons-app-hero"
    );

    if (subtitle) {
      subtitle.insertAdjacentElement("afterend", hero);
    } else {
      pageHead.appendChild(hero);
    }
  }

  function installCurrentMoonImage() {
    const badge = document.querySelector(".moon-badge");

    if (!badge) {
      return;
    }

    if (badge.querySelector(".current-moon-art")) {
      return;
    }

    const figure = createFigure(
      "moons/moon1.webp",
      "Moon 1 — Seed Flame",
      "current-moon-art"
    );

    const img = figure.querySelector("img");

    if (img) {
      img.id = "currentMoonImage";
    }

    badge.classList.add("has-moon-art");
    badge.insertBefore(figure, badge.firstChild);
  }

  function updateCurrentMoonImage(detail) {
    const img = document.getElementById("currentMoonImage");

    if (!img) {
      return;
    }

    const moonNumber = Number(
      detail &&
      detail.info &&
      detail.info.moon &&
      detail.info.moon.idx
        ? detail.info.moon.idx
        : 1
    );

    const index = Math.max(
      0,
      Math.min(12, moonNumber - 1)
    );

    const currentMoon = MOON_IMAGES[index];

    img.src = `${ROOT}/moons/${currentMoon[0]}`;
    img.alt = currentMoon[1];
  }

  function installPanelBanners() {
    Object.entries(PANEL_IMAGES).forEach(
      ([panelId, imageConfig]) => {
        const panel = document.getElementById(panelId);

        if (!panel) {
          return;
        }

        const existingBanner = Array.from(panel.children).find(
          child => child.classList.contains("panel-banner")
        );

        if (existingBanner) {
          return;
        }

        const path = imageConfig[0];
        const alt = imageConfig[1];

        const banner = createFigure(
          path,
          alt,
          "panel-banner"
        );

        panel.insertBefore(
          banner,
          panel.firstChild
        );
      }
    );
  }

  function installGateGallery() {
    const panel = document.getElementById("shabbatPanel");

    if (!panel) {
      return;
    }

    if (panel.querySelector(".gate-gallery")) {
      return;
    }

    const gallery = document.createElement("section");

    gallery.className = "gate-gallery";
    gallery.setAttribute(
      "aria-label",
      "Shabbat cycle gates"
    );

    GATE_IMAGES.forEach(([path, label]) => {
      const card = createFigure(
        path,
        label,
        "gate-art-card"
      );

      const caption = document.createElement("figcaption");
      caption.textContent = label;

      card.appendChild(caption);
      gallery.appendChild(card);
    });

    const hero = panel.querySelector(".ritual-hero");

    if (hero) {
      hero.insertAdjacentElement("afterend", gallery);
    } else {
      panel.insertBefore(gallery, panel.firstChild);
    }
  }

  function showSavedLogsEmptyState() {
    const host = document.getElementById("savedList");

    if (!host) {
      return;
    }

    const currentText = host.textContent.trim();

    const isEmpty =
      currentText === "" ||
      /^No saved logs yet\.?$/i.test(currentText);

    if (!isEmpty) {
      return;
    }

    host.innerHTML = `
      <div class="saved-empty-state">
        <img
          src="${ROOT}/app/empty-state.webp"
          alt=""
          loading="lazy"
          decoding="async"
        >

        <h3>No witness logs sealed yet</h3>

        <p>
          Your saved local witness records will appear here.
        </p>
      </div>
    `;
  }

  function markActiveMobileTab(panelId) {
    document
      .querySelectorAll("[data-mobile-tab]")
      .forEach(link => {
        const active =
          link.dataset.mobileTab === panelId;

        link.classList.toggle("active", active);

        if (active) {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      });
  }

  function installMobileTabTracking() {
    document
      .querySelectorAll(".tab")
      .forEach(button => {
        if (button.dataset.imageTabTracking === "true") {
          return;
        }

        button.dataset.imageTabTracking = "true";

        button.addEventListener("click", () => {
          const panelId = button.dataset.tab;

          if (panelId) {
            markActiveMobileTab(panelId);
          }
        });
      });
  }

  function installAllImages() {
    installHero();
    installCurrentMoonImage();
    installPanelBanners();
    installGateGallery();
    installMobileTabTracking();

    window.setTimeout(
      showSavedLogsEmptyState,
      0
    );
  }

  /*
   * The main Moon engine sends this event whenever the selected
   * calendar date or Moon changes.
   */
  document.addEventListener(
    "sof:moon-render",
    event => {
      installAllImages();
      updateCurrentMoonImage(event.detail || {});

      window.setTimeout(
        showSavedLogsEmptyState,
        0
      );
    }
  );

  /*
   * Refresh the Saved Logs area after a witness is saved.
   */
  document.addEventListener(
    "sof:witness-saved",
    () => {
      window.setTimeout(
        showSavedLogsEmptyState,
        0
      );
    }
  );

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      installAllImages
    );
  } else {
    installAllImages();
  }

  window.addEventListener(
    "load",
    installAllImages
  );
})();
