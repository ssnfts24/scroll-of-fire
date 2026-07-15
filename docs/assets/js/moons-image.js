/* Scroll of Fire — Remnant 13 Moons Image Integration
   Load after moons.js and astrology.js.
   Day images remain disabled until all 28 are complete.
*/
(() => {
  "use strict";

  const ROOT = "assets/img/moons";

  const MOON_IMAGES = [
    ["moon-01-seed-flame.webp", "Moon 1 — Seed Flame"],
    ["moon-02-root-waters.webp", "Moon 2 — Root Waters"],
    ["moon-03-breath-gate.webp", "Moon 3 — Breath Gate"],
    ["moon-04-stone-witness.webp", "Moon 4 — Stone Witness"],
    ["moon-05-living-word.webp", "Moon 5 — Living Word"],
    ["moon-06-fire-trial.webp", "Moon 6 — Fire Trial"],
    ["moon-07-crown-balance.webp", "Moon 7 — Crown Balance"],
    ["moon-08-deep-mirror.webp", "Moon 8 — Deep Mirror"],
    ["moon-09-return-path.webp", "Moon 9 — Return Path"],
    ["moon-10-builders-hand.webp", "Moon 10 — Builder’s Hand"],
    ["moon-11-star-remembrance.webp", "Moon 11 — Star Remembrance"],
    ["moon-12-river-of-signs.webp", "Moon 12 — River of Signs"],
    ["moon-13-completion-seal.webp", "Moon 13 — Completion Seal"]
  ];

  const PANEL_IMAGES = {
    todayPanel: [
      "sections/today.webp",
      "Today in the Remnant 13 Moons calendar"
    ],

    flowPanel: [
      "sections/transmission.webp",
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
      "sections/calendars.webp",
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

  function makeFigure(path, alt, className) {
    const figure = document.createElement("figure");
    figure.className = className;

    const img = document.createElement("img");
    img.src = `${ROOT}/${path}`;
    img.alt = alt;
    img.decoding = "async";
    img.loading = className === "moons-app-hero" ? "eager" : "lazy";

    if (className === "moons-app-hero") {
      img.fetchPriority = "high";
    }

    figure.appendChild(img);

    return figure;
  }

  function installHero() {
    const head = document.querySelector(".page-head");

    if (!head || head.querySelector(".moons-app-hero")) {
      return;
    }

    const subtitle = head.querySelector(".subtitle");

    const hero = makeFigure(
      "app/splash-2732.webp",
      "Remnant 13 Moons living calendar",
      "moons-app-hero"
    );

    if (subtitle) {
      subtitle.after(hero);
    } else {
      head.appendChild(hero);
    }
  }

  function installCurrentMoon() {
    const badge = document.querySelector(".moon-badge");

    if (!badge || badge.querySelector(".current-moon-art")) {
      return;
    }

    const figure = makeFigure(
      "moons/moon-01-seed-flame.webp",
      "Moon 1 — Seed Flame",
      "current-moon-art"
    );

    const img = figure.querySelector("img");

    if (img) {
      img.id = "currentMoonImage";
    }

    badge.classList.add("has-moon-art");
    badge.prepend(figure);
  }

  function updateMoon(detail) {
    const img = document.getElementById("currentMoonImage");

    if (!img) {
      return;
    }

    const moonNumber = Number(detail?.info?.moon?.idx || 1);
    const index = Math.max(0, Math.min(12, moonNumber - 1));
    const moon = MOON_IMAGES[index];

    img.src = `${ROOT}/moons/${moon[0]}`;
    img.alt = moon[1];
  }

  function installBanners() {
    Object.entries(PANEL_IMAGES).forEach(([id, config]) => {
      const panel = document.getElementById(id);

      if (!panel || panel.querySelector(":scope > .panel-banner")) {
        return;
      }

      const [path, alt] = config;

      panel.prepend(
        makeFigure(
          path,
          alt,
          "panel-banner"
        )
      );
    });
  }

  function installGates() {
    const panel = document.getElementById("shabbatPanel");

    if (!panel || panel.querySelector(".gate-gallery")) {
      return;
    }

    const gallery = document.createElement("section");
    gallery.className = "gate-gallery";
    gallery.setAttribute("aria-label", "Shabbat cycle gates");

    const gates = [
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

    gates.forEach(([path, label]) => {
      const card = makeFigure(
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
      hero.after(gallery);
    } else {
      panel.prepend(gallery);
    }
  }

  function refreshEmpty() {
    const host = document.getElementById("savedList");

    if (!host) {
      return;
    }

    const content = host.textContent.trim();

    if (/^No saved logs yet\.?$/i.test(content)) {
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
  }

  function install() {
    installHero();
    installCurrentMoon();
    installBanners();
    installGates();
    refreshEmpty();
  }

  document.addEventListener("sof:moon-render", event => {
    install();
    updateMoon(event.detail || {});
    setTimeout(refreshEmpty, 0);
  });

  document.addEventListener("sof:witness-saved", () => {
    setTimeout(refreshEmpty, 0);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }

  window.addEventListener("load", install);
})();
