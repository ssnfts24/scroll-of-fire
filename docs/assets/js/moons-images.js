/* Scroll of Fire — Remnant 13 Moons Image Integration
   Uses the exact current repository filenames.

   Load after:
   1. assets/js/moons.js
   2. assets/js/astrology.js

   Day images remain disconnected until all 28 are complete.
*/

(() => {
  "use strict";

  if (window.__SOF_MOONS_IMAGES_INITIALIZED__) return;
  window.__SOF_MOONS_IMAGES_INITIALIZED__ = true;

  const ROOT = "assets/img/moons";

  const MOON_IMAGES = [
    {
      file: "moon-01-seed-flame.webp",
      alt: "Moon 1 — Seed Flame"
    },
    {
      file: "moon-02-root-waters.webp",
      alt: "Moon 2 — Root Waters"
    },
    {
      file: "moon-03-breath-gate.webp",
      alt: "Moon 3 — Breath Gate"
    },
    {
      file: "moon-04-stone-witness.webp",
      alt: "Moon 4 — Stone Witness"
    },
    {
      file: "moon-05-living-word.webp",
      alt: "Moon 5 — Living Word"
    },
    {
      file: "moon-06-fire-trial.webp",
      alt: "Moon 6 — Fire Trial"
    },
    {
      file: "moon-07-crown-balance.webp",
      alt: "Moon 7 — Crown Balance"
    },
    {
      file: "moon-08-deep-mirror.webp",
      alt: "Moon 8 — Deep Mirror"
    },
    {
      file: "moon-09-return-path.webp",
      alt: "Moon 9 — Return Path"
    },
    {
      file: "moon-10-builders-hand.webp",
      alt: "Moon 10 — Builder’s Hand"
    },
    {
      file: "moon-11-star-remembrance.webp",
      alt: "Moon 11 — Star Remembrance"
    },
    {
      file: "moon-12-river-of-signs.webp",
      alt: "Moon 12 — River of Signs"
    },
    {
      file: "moon-13-completion-seal.webp",
      alt: "Moon 13 — Completion Seal"
    }
  ];

  const PANEL_IMAGES = {
    todayPanel: {
      file: "sections/today.webp",
      alt: "Today in the Remnant 13 Moons calendar"
    },

    flowPanel: {
      file: "sections/transmission.webp",
      alt: "Daily transmission and ritual flow"
    },

    mirrorPanel: {
      file: "sections/memory.webp",
      alt: "Mirror reading and pattern memory"
    },

    witnessPanel: {
      file: "sections/witness.webp",
      alt: "Daily witness and coherence log"
    },

    astrologyPanel: {
      file: "sections/astrology.webp",
      alt: "Astrology and planetary alignment mirror"
    },

    calendarPanel: {
      file: "sections/calendars.webp",
      alt: "Remnant and Gregorian calendar overlays"
    },

    codexPanel: {
      file: "sections/builder.webp",
      alt: "Codex seal and builder pattern"
    },

    fieldPanel: {
      file: "sections/frequency.webp",
      alt: "Frequency and field observation layer"
    }
  };

  const GATE_IMAGES = [
    {
      file: "gates/gate-01-preparation.webp",
      label: "Preparation Gate"
    },
    {
      file: "gates/gate-06-alignment.webp",
      label: "Alignment Gate"
    },
    {
      file: "gates/gate-08-return.webp",
      label: "Return Gate"
    }
  ];

  function assetPath(relativePath) {
    return `${ROOT}/${relativePath}`;
  }

  function createImageFigure({
    file,
    alt,
    className,
    eager = false,
    width = null,
    height = null
  }) {
    const figure = document.createElement("figure");
    figure.className = className;

    const image = document.createElement("img");

    image.src = assetPath(file);
    image.alt = alt;
    image.decoding = "async";
    image.loading = eager ? "eager" : "lazy";

    if (width) image.width = width;
    if (height) image.height = height;

    if (eager) {
      image.fetchPriority = "high";
    }

    image.addEventListener("load", () => {
      figure.classList.add("image-loaded");
    });

    image.addEventListener("error", () => {
      figure.classList.add("image-load-failed");

      /* Hide broken images gracefully — do not show browser broken-image icon */
      image.style.display = "none";

      console.warn(
        "[Remnant 13 Moons] Image not available:",
        image.src
      );
    });

    figure.appendChild(image);

    return figure;
  }

  function installMainHero() {
    const pageHead = document.querySelector(".page-head");

    if (!pageHead) {
      console.warn(
        "[Remnant 13 Moons] Could not find .page-head."
      );

      return;
    }

    if (pageHead.querySelector(".moons-app-hero")) {
      return;
    }

    const hero = createImageFigure({
      file: "app/splash-2732.webp",
      alt: "Remnant 13 Moons living calendar",
      className: "moons-app-hero",
      eager: true,
      width: 980,
      height: 980
    });

    const subtitle = pageHead.querySelector(".subtitle");

    if (subtitle) {
      subtitle.insertAdjacentElement("afterend", hero);
    } else {
      pageHead.appendChild(hero);
    }
  }

  function installCurrentMoonArtwork() {
    const moonBadge = document.querySelector(".moon-badge");

    if (!moonBadge) {
      console.warn(
        "[Remnant 13 Moons] Could not find .moon-badge."
      );

      return;
    }

    if (moonBadge.querySelector(".current-moon-art")) {
      return;
    }

    const firstMoon = MOON_IMAGES[0];

    const figure = createImageFigure({
      file: `moons/${firstMoon.file}`,
      alt: firstMoon.alt,
      className: "current-moon-art",
      width: 600,
      height: 600
    });

    const image = figure.querySelector("img");

    if (image) {
      image.id = "currentMoonImage";
    }

    moonBadge.classList.add("has-moon-art");
    moonBadge.insertBefore(figure, moonBadge.firstChild);
  }

  function getCurrentMoonNumber(detail = {}) {
    const eventMoon = Number(
      detail?.info?.moon?.idx
    );

    if (Number.isFinite(eventMoon) && eventMoon >= 1) {
      return eventMoon;
    }

    const engine = window.ScrollOfFireMoons;

    if (
      engine &&
      typeof engine.remnantInfo === "function"
    ) {
      const currentInfo = engine.remnantInfo();
      const engineMoon = Number(currentInfo?.moon?.idx);

      if (
        Number.isFinite(engineMoon) &&
        engineMoon >= 1
      ) {
        return engineMoon;
      }
    }

    return 1;
  }

  function updateCurrentMoonArtwork(detail = {}) {
    const image = document.getElementById(
      "currentMoonImage"
    );

    if (!image) {
      return;
    }

    const moonNumber = getCurrentMoonNumber(detail);

    const index = Math.max(
      0,
      Math.min(
        MOON_IMAGES.length - 1,
        moonNumber - 1
      )
    );

    const moon = MOON_IMAGES[index];

    image.src = assetPath(`moons/${moon.file}`);
    image.alt = moon.alt;
  }

  function installPanelArtwork() {
    Object.entries(PANEL_IMAGES).forEach(
      ([panelId, artwork]) => {
        const panel = document.getElementById(panelId);

        if (!panel) {
          console.warn(
            `[Remnant 13 Moons] Could not find #${panelId}.`
          );

          return;
        }

        const existingBanner = Array.from(
          panel.children
        ).find(child =>
          child.classList.contains("panel-banner")
        );

        if (existingBanner) {
          return;
        }

        const banner = createImageFigure({
          file: artwork.file,
          alt: artwork.alt,
          className: "panel-banner"
        });

        panel.insertBefore(
          banner,
          panel.firstChild
        );
      }
    );
  }

  function installGateArtwork() {
    const shabbatPanel = document.getElementById(
      "shabbatPanel"
    );

    if (!shabbatPanel) {
      console.warn(
        "[Remnant 13 Moons] Could not find #shabbatPanel."
      );

      return;
    }

    if (shabbatPanel.querySelector(".gate-gallery")) {
      return;
    }

    const gallery = document.createElement("section");

    gallery.className = "gate-gallery";

    gallery.setAttribute(
      "aria-label",
      "Shabbat cycle gates"
    );

    GATE_IMAGES.forEach(gate => {
      const figure = createImageFigure({
        file: gate.file,
        alt: gate.label,
        className: "gate-art-card"
      });

      const caption = document.createElement(
        "figcaption"
      );

      caption.textContent = gate.label;

      figure.appendChild(caption);
      gallery.appendChild(figure);
    });

    const ritualHero = shabbatPanel.querySelector(
      ".ritual-hero"
    );

    if (ritualHero) {
      ritualHero.insertAdjacentElement(
        "afterend",
        gallery
      );
    } else {
      shabbatPanel.insertBefore(
        gallery,
        shabbatPanel.firstChild
      );
    }
  }

  function installSavedLogEmptyState() {
    const savedList = document.getElementById(
      "savedList"
    );

    if (!savedList) {
      return;
    }

    const currentText = savedList.textContent.trim();

    const empty =
      currentText === "" ||
      /^No saved logs yet\.?$/i.test(currentText);

    if (!empty) {
      return;
    }

    savedList.innerHTML = `
      <div class="saved-empty-state">
        <img
          src="${assetPath("app/empty-state.webp")}"
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

  function markMobileTab(panelId) {
    document
      .querySelectorAll("[data-mobile-tab]")
      .forEach(link => {
        const active =
          link.dataset.mobileTab === panelId;

        link.classList.toggle("active", active);

        if (active) {
          link.setAttribute(
            "aria-current",
            "page"
          );
        } else {
          link.removeAttribute("aria-current");
        }
      });
  }

  function installTabTracking() {
    document.querySelectorAll(".tab").forEach(button => {
      if (
        button.dataset.imageTrackingInstalled ===
        "true"
      ) {
        return;
      }

      button.dataset.imageTrackingInstalled = "true";

      button.addEventListener("click", () => {
        const panelId = button.dataset.tab;

        if (panelId) {
          markMobileTab(panelId);
        }
      });
    });
  }

  function installAllArtwork() {
    installMainHero();
    installCurrentMoonArtwork();
    installPanelArtwork();
    installGateArtwork();
    installTabTracking();

    window.setTimeout(
      installSavedLogEmptyState,
      0
    );
  }

  function initialize() {
    console.info(
      "[Remnant 13 Moons] moons-images.js loaded."
    );

    installAllArtwork();
    updateCurrentMoonArtwork();
  }

  document.addEventListener(
    "sof:moon-render",
    event => {
      installAllArtwork();
      updateCurrentMoonArtwork(event.detail || {});
    }
  );

  document.addEventListener(
    "sof:witness-saved",
    () => {
      window.setTimeout(
        installSavedLogEmptyState,
        0
      );
    }
  );

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

  window.addEventListener(
    "load",
    () => {
      installAllArtwork();
      updateCurrentMoonArtwork();
    },
    { once: true }
  );
})();
