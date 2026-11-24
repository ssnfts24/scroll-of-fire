/**
 * Your Genesis on the Sphere — the keeper's saved birth position,
 * carried on the companion layer (Nov 23, 2026).
 *
 * Aaron's direction: the saved Genesis profile should be recognized
 * across the Codex, and the Sphere should highlight the keeper's
 * birth Moon and Day with their personal seal. This module is that
 * recognition on the Sphere page, by the companion layer's own
 * method: it is set on the page by sphere-companion-layer.js's
 * loader, reads only the keeper's own saved Oracle profiles (the
 * localStorage key documented in
 * docs/development/GENESIS-PROFILE-FORMAT.md — this device, this
 * browser, nothing transmitted) and the page's public state strip,
 * and drives the instrument only through its public quick-jump
 * control. It writes no state, keeps no calendar of its own, and
 * touches no cursor, no bus and no protected file: selection still
 * flows through SOFTemporalCursor → PatternCalendar → Canonical
 * Living State → LivingProjectionBus, exactly as before.
 *
 * The highlight the companion layer can honestly give is this
 * panel: the keeper's Seal of Becoming beside their birth
 * coordinate, a one-tap trip to the birth day, and — when the day
 * on show IS the birth day — the panel lit and saying so. A marker
 * pinned inside the 3D scene itself would need the renderer's own
 * hooks, which are R1.7-protected; that piece is held, not faked.
 *
 * The pure half (the readout parse, the profile reading, the seal
 * derivation) carries no DOM dependency and is unit-tested at the
 * data level. The seal derivation is the Oracle's own, ported from
 * genesis-oracle.js so the seal on the Sphere is the same seal.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  root.SphereGenesisLayer = api;
  api.mount(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PROFILES_KEY = "sofGenesisProfilesV2";

  const CIVIL_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  function civilDateLong(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!match) return iso || "";
    return `${Number(match[3])} ${CIVIL_MONTHS[Number(match[2]) - 1] || ""} ${match[1]}`;
  }

  /* The state strip's own grammar — the same forms the companion
   * layer's share and the story doors parse. */
  function parseReadout(text) {
    const t = String(text || "");
    const full = t.match(/Moon (\d{1,2}) · Day (\d{1,2}) · Day (\d{1,3})\/364/);
    if (full) return { moon: Number(full[1]), day: Number(full[2]), patternDay: Number(full[3]) };
    const part = t.match(/Moon (\d{1,2}) · Day (\d{1,2})/);
    if (part) return { moon: Number(part[1]), day: Number(part[2]), patternDay: null };
    return null;
  }

  /* The keeper's designated Genesis profile, read from the saved
   * Oracle 2.0 profile array. A record counts only when it carries
   * myGenesis and a usable birth coordinate; anything else — no
   * profiles, no designation, a malformed store — reads as none,
   * and the layer simply does not appear. */
  function readMyGenesisFromRaw(raw) {
    let records;
    try {
      records = JSON.parse(raw || "[]");
    } catch {
      return null;
    }
    if (!Array.isArray(records)) return null;
    const mine = records.find(r => r && r.myGenesis === true);
    if (!mine || !birthCoordinate(mine)) return null;
    return mine;
  }

  function birthCoordinate(profile) {
    const pos = profile?.calculated?.patternPosition;
    if (!pos || !pos.moonNumber || !pos.dayInMoon) return null;
    return {
      moon: Number(pos.moonNumber),
      day: Number(pos.dayInMoon),
      moonName: pos.moonName || null,
      tone: profile?.calculated?.coreSignature?.tone ?? null,
      name: profile?.input?.name || "",
      birthDate: profile?.input?.birthDate || ""
    };
  }

  function isBirthOnShow(birth, coord) {
    if (!birth || !coord) return false;
    return coord.moon === birth.moon && coord.day === birth.day;
  }

  /* The Seal of Becoming, derived exactly as the Oracle derives it
   * (genesis-oracle.js buildSealSvg): moon, day, tone, carrier and
   * the full-name reduction shape the same figure, so the seal
   * beside the birth position here is the keeper's own seal. */
  function sealSvgFor(profile, size = 120) {
    const patternPosition = profile?.calculated?.patternPosition || {};
    const coreSignature = profile?.calculated?.coreSignature || {};
    const nameSignature = profile?.calculated?.nameSignature || {};
    const moon = Number(patternPosition.moonNumber || 13);
    const day = Number(patternPosition.dayInMoon || 28);
    const tone = Number(coreSignature.tone || 13);
    const outside = !patternPosition.moonNumber || !patternPosition.dayInMoon;
    const sealLabel = outside ? `Outside · T${tone}` : `M${moon} · D${day} · T${tone}`;
    const sealAria = outside
      ? `Seal of Becoming derived from a day outside the counted 364-day year, Tone ${tone}`
      : `Seal of Becoming derived from Moon ${moon}, Day ${day}, Tone ${tone}`;
    const carrier = Number(coreSignature.carrier?.hz || 432);
    const reduction = Number(nameSignature.fullNameReduction || 1);
    const center = size / 2;
    const radius = size * 0.36;
    const spokes = Math.max(6, (moon + tone) % 24 + 6);
    const stroke = 1 + (reduction % 4);

    const points = [];
    for (let i = 0; i < spokes; i += 1) {
      const angle = (Math.PI * 2 * i) / spokes;
      const mod = 0.72 + (((i + day + tone) % 5) * 0.06);
      const r = radius * mod;
      points.push(`${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`);
    }

    const hue = (carrier + day * 7 + moon * 11) % 360;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${sealAria}">
  <defs>
    <radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="hsl(${hue}, 95%, 75%)" stop-opacity="0.95" />
      <stop offset="100%" stop-color="hsl(${(hue + 90) % 360}, 85%, 45%)" stop-opacity="0.2" />
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="#070a14" />
  <circle cx="${center}" cy="${center}" r="${radius + 8}" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
  <polygon points="${points.join(" ")}" fill="url(#g)" stroke="hsl(${hue}, 95%, 75%)" stroke-width="${stroke}" />
  <circle cx="${center}" cy="${center}" r="${Math.max(8, day)}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" />
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#f5f1e8" font-family="Inter, sans-serif" font-size="14">${sealLabel}</text>
</svg>`;
  }

  function goBirthDay(document, birth) {
    const input = document.getElementById("sphere-quick-jump-input");
    const submit = document.getElementById("sphere-quick-jump-submit");
    if (input && submit) {
      input.value = `Moon ${birth.moon} Day ${birth.day}`;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      submit.click();
      return true;
    }
    const moonSel = document.getElementById("calendar-pattern-moon");
    const daySel = document.getElementById("calendar-pattern-day");
    const jump = document.getElementById("calendar-jump-pattern");
    if (moonSel && daySel && jump) {
      moonSel.value = String(birth.moon);
      daySel.value = String(birth.day);
      moonSel.dispatchEvent(new Event("change", { bubbles: true }));
      daySel.dispatchEvent(new Event("change", { bubbles: true }));
      jump.click();
      return true;
    }
    return false;
  }

  function mount(root) {
    const document = root.document;
    if (!document) return;
    const wrap = document.querySelector(".sphere-canvas-wrap");
    const strip = document.getElementById("sphere-state-strip");
    if (!wrap || !strip) return;

    let raw = null;
    try {
      raw = root.localStorage?.getItem(PROFILES_KEY);
    } catch {
      raw = null;
    }
    const profile = readMyGenesisFromRaw(raw);
    if (!profile) return; // No designated Genesis profile: the layer rests absent.
    const birth = birthCoordinate(profile);

    const panel = document.createElement("section");
    panel.className = "sphere-genesis-layer";
    panel.setAttribute("aria-label", "Your Genesis birth position");

    const heading = document.createElement("h2");
    heading.className = "sgl-title";
    heading.textContent = "Your Genesis birth position";
    panel.appendChild(heading);

    const flex = document.createElement("div");
    flex.className = "sgl-flex";

    const seal = document.createElement("div");
    seal.className = "sgl-seal";
    seal.innerHTML = sealSvgFor(profile, 120);
    flex.appendChild(seal);

    const facts = document.createElement("div");
    facts.className = "sgl-facts";

    const bornLine = document.createElement("p");
    bornLine.className = "sgl-born";
    bornLine.textContent =
      `${birth.name ? `${birth.name} — ` : ""}born under Moon ${birth.moon} · ${birth.moonName || ""} · Day ${birth.day}` +
      (birth.tone != null ? ` · Tone ${birth.tone}` : "");
    facts.appendChild(bornLine);

    if (birth.birthDate) {
      const civil = document.createElement("p");
      civil.className = "sgl-line";
      civil.textContent = `Civil birthday: ${civilDateLong(birth.birthDate)} — its own day, kept beside the Pattern birth position.`;
      facts.appendChild(civil);
    }

    const state = document.createElement("p");
    state.className = "sgl-line sgl-state";
    facts.appendChild(state);

    const actions = document.createElement("p");
    actions.className = "sgl-actions";
    const go = document.createElement("button");
    go.type = "button";
    go.className = "sgl-btn";
    go.textContent = "Go to my birth day";
    go.addEventListener("click", () => {
      if (goBirthDay(document, birth)) {
        state.textContent = "Travelling to your birth day…";
      } else {
        state.textContent = "The Sphere's own jump control could not be reached from here.";
      }
    });
    const open = document.createElement("a");
    open.href = "genesis-oracle.html";
    open.textContent = "Open my Genesis reading";
    actions.append(go, document.createTextNode(" · "), open);
    facts.appendChild(actions);

    flex.appendChild(facts);
    panel.appendChild(flex);
    /* Below the stage column, in the page's own flow — the stage
     * and its guide bar keep their exact places. */
    wrap.after(panel);

    let lastText = null;
    function render() {
      const text = (strip.textContent || "").trim().replace(/\s+/g, " ");
      if (text === lastText) return;
      lastText = text;
      const coord = parseReadout(text);
      const onShow = isBirthOnShow(birth, coord);
      panel.classList.toggle("sgl-on-show", onShow);
      state.textContent = onShow
        ? `Your birth day is on show now — Moon ${birth.moon} · Day ${birth.day}, the day you were born under.`
        : `Your birth day stands at Moon ${birth.moon} · Day ${birth.day}. One tap takes the Sphere there.`;
    }

    new root.MutationObserver(render).observe(strip, {
      childList: true, subtree: true, characterData: true
    });
    render();
  }

  return {
    PROFILES_KEY,
    civilDateLong,
    parseReadout,
    readMyGenesisFromRaw,
    birthCoordinate,
    isBirthOnShow,
    sealSvgFor,
    mount
  };
});
