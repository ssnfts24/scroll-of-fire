/*
 * Test Layers on the Sphere — Salmon + Kyoto (Phase C, the layer
 * programme's first build after the Sky).
 *
 * Aaron approved the proving trio on Nov 23, 2026 — sky, salmon,
 * Kyoto blossoms — and the sky went first (sphere-sky-layer.js).
 * This module stands the two recorded series on the Sphere's
 * face, in the caption deck, in the sky layer's pattern: loaded
 * by the companion layer, an overlay only — it never touches
 * the sphere engine, geometry, camera, or any protected file.
 *
 * The laws it is built under (the layer programme's expansion,
 * §1, and the census §15):
 *   - One instrument, in place. The switches live here, on the
 *     Sphere; there are no popups, no detail pages, no elsewhere.
 *   - Default OFF. Nothing test is drawn until a keeper turns it
 *     on, and his own record is what the Sphere opens on.
 *   - Tag law. Every layer carries its source on its face the
 *     whole time it stands. No tag, no display.
 *   - Texture law. Test data renders schematic — beads, a season
 *     curve, a thread. You can enter his days; you can only view
 *     test days.
 *   - Colour law. His record alone is gold. Salmon is the Water
 *     family's deep blue; Kyoto is the Living family's green.
 *   - The compare budget. At most two test layers stand at once,
 *     and the sky dome counts toward the two, as built. Turning
 *     a third on sets the least-recently-lit of this module's
 *     layers down, and says so in plain words on the panel.
 *   - The +1 asymmetry. These are RECORDED layers: they stop at
 *     today. A bead past today stands open and labelled —
 *     "no record; the year is not kept yet" — and a missing year
 *     is a named gap, never a bead stretched to cover it.
 *   - Lazy packs. Each series ships as one packed day-index file
 *     (≤ 2 MB by the capacity law) and is fetched only when its
 *     layer is first switched on. Nothing here phones home; the
 *     packs are files of this site, read from beside the page.
 *
 * The packs (built by committed generators, sources named in
 * each pack and in the Phase C test-layers build note):
 *   - assets/data/sphere-test-salmon-bonneville.json — daily
 *     adult passage counts at Bonneville Dam, 1939–2026, counted
 *     by the U.S. Army Corps of Engineers, via Columbia River
 *     DART (University of Washington). DART labels Bonneville
 *     [1938] but serves no 1938 daily rows; the pack's span is
 *     the span as published. Coho were not separately counted
 *     before 1980; those years are gaps, drawn as gaps.
 *   - assets/data/sphere-test-kyoto-blossom.json — Kyoto
 *     cherry-blossom full-flowering dates, 838 recorded years of
 *     812–2026, compiled by Yasuyuki Aono (Osaka Prefecture
 *     University) from the city's diaries and records, via Our
 *     World in Data (CC BY 4.0). The 377 years with no surviving
 *     record carry no bead.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexSphereTestLayers = api;

  if (typeof document !== "undefined" && typeof window !== "undefined") {
    api.boot();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "sphere-test-layers/1.0.0";

  const SALMON_URL = "assets/data/sphere-test-salmon-bonneville.json";
  const KYOTO_URL = "assets/data/sphere-test-kyoto-blossom.json";

  const DAY_LINE_OFFSETS = [-30, -20, -10, -5, -1, 1];

  const LAYERS = {
    salmon: {
      name: "Salmon — Columbia River",
      short: "Salmon",
      color: "#6ea8dc",
      colorDim: "#2e6fb7",
      tag: "TEST — Salmon passage at Bonneville Dam, counted by the U.S. Army Corps of Engineers, via Columbia River DART (University of Washington) · 1939–2026",
    },
    kyoto: {
      name: "Kyoto blossoms",
      short: "Kyoto",
      color: "#8fce6e",
      colorDim: "#5da24a",
      tag: "TEST — Kyoto cherry-blossom full flowering, recorded 812–present · Yasuyuki Aono (Osaka Prefecture University), via Our World in Data (CC BY)",
    },
  };

  /* ── Pure helpers (tested) ──────────────────────────────────── */

  function parseISODate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m) return null;
    return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  }

  function civilISOFromCursorDetail(detail) {
    if (!detail || typeof detail !== "object") return null;
    const candidates = [
      detail.coordinate?.gregorian?.isoDate,
      detail.gregorian?.isoDate,
      detail.coordinate?.civilDate,
      detail.civilDate
    ];
    for (const c of candidates) {
      if (parseISODate(c)) return c;
    }
    return null;
  }

  function isoOf(civil) {
    const mm = String(civil.month).padStart(2, "0");
    const dd = String(civil.day).padStart(2, "0");
    return `${civil.year}-${mm}-${dd}`;
  }

  /* The canonical PatternCalendar arithmetic, restated as pure
   * day differences (pattern-calendar.js convertEffectiveDate is
   * this same math): the window opens April 17; counted days are
   * slots 1–364, then the Day Out of Time (365) and, in a 366-day
   * window, the Deep Time Day (366). All arithmetic in UTC days. */
  const DAY_MS = 86400000;

  function utcDay(civil) {
    return Math.floor(Date.UTC(civil.year, civil.month - 1, civil.day) / DAY_MS);
  }

  function civilToShellSlot(civil) {
    if (!civil) return null;
    let start = { year: civil.year, month: 4, day: 17 };
    if (utcDay(civil) < utcDay(start)) {
      start = { year: civil.year - 1, month: 4, day: 17 };
    }
    return { shell: start.year, slot: utcDay(civil) - utcDay(start) + 1 };
  }

  function slotToCivilISO(shell, slot) {
    const start = Date.UTC(shell, 3, 17) + (slot - 1) * DAY_MS;
    const d = new Date(start);
    return isoOf({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
  }

  function compareShellSlot(a, b) {
    if (a.shell !== b.shell) return a.shell - b.shell;
    return a.slot - b.slot;
  }

  /* The compare budget (§1.2): at most two test layers stand at
   * once, the sky dome counting as one. Pure decision: given the
   * layers this module currently has lit (oldest first), whether
   * the sky stands, and the layer being turned on, say which of
   * this module's layers remain lit and which is set down. */
  function decideActivation(litOldestFirst, skyOn, turningOn) {
    const lit = litOldestFirst.filter((id) => id !== turningOn);
    lit.push(turningOn);
    let setDown = null;
    const budget = skyOn ? 1 : 2;
    while (lit.length > budget) {
      setDown = lit.shift();
    }
    return { lit, setDown };
  }

  /* One day-line bead for the salmon layer. The pack's years map
   * is keyed by shell year; each year is a list of [slot, count].
   * A day past today is the future bead; a day with no entry is a
   * gap (no count was made or reported); an entry — zero and
   * negative corrections included — is a record. */
  function salmonBead(pack, speciesKey, shell, slot, todaySS) {
    if (todaySS && compareShellSlot({ shell, slot }, todaySS) > 0) {
      return { state: "future" };
    }
    const sp = pack?.species?.[speciesKey];
    const days = sp?.years?.[String(shell)];
    if (days) {
      for (const [s, count] of days) {
        if (s === slot) return { state: "filled", count, total: sp.totals[String(shell)] };
      }
    }
    return { state: "gap" };
  }

  /* One day-line bead for the Kyoto layer: one record per civil
   * year, or a named gap; a year past the record's end is the
   * future bead, in the expansion's exact words. */
  function kyotoBead(pack, civilYear) {
    if (!pack) return { state: "gap" };
    if (civilYear > pack.span[1]) return { state: "future" };
    const rec = pack.byYear?.[String(civilYear)];
    if (rec) return { state: "filled", record: rec };
    return { state: "gap" };
  }

  function indexKyoto(pack) {
    if (!pack || pack.byYear) return pack;
    const byYear = {};
    for (const [year, doy, month, day, shell, slot] of pack.records) {
      byYear[String(year)] = { year, doy, month, day, shell, slot };
    }
    return { ...pack, byYear };
  }

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  function longDate(iso) {
    const c = parseISODate(iso);
    if (!c) return String(iso || "");
    return `${MONTH_NAMES[c.month - 1]} ${c.day}, ${c.year}`;
  }

  function formatCount(n) {
    return Number(n).toLocaleString("en-US");
  }

  function escapeText(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* ── Browser wiring ─────────────────────────────────────────── */

  function boot() {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (mount() || tries > 40) window.clearInterval(timer);
    }, 250);
    mount();

    function mount() {
      const caption = document.querySelector(".sphere-rebuild-caption");
      if (!caption) return false;
      if (caption.querySelector("[data-sphere-test-layers]")) return true;
      buildPanel(caption);
      return true;
    }
  }

  function buildPanel(caption) {
    const section = document.createElement("section");
    section.className = "sphere-test-layers";
    section.setAttribute("data-sphere-test-layers", "");
    section.setAttribute("aria-label", "Test layers — recorded series on the Sphere");
    section.innerHTML = `
      <div class="sphere-test-layers-head">
        <p class="sphere-test-layers-title">Test layers</p>
        <p class="sphere-test-layers-note">Recorded series, drawn schematically — you can enter your own days; test days you can only view. At most two test layers stand at once, and the sky dome counts as one.</p>
      </div>
      <div class="sphere-test-layers-switches" role="group" aria-label="Test layer switches">
        <button type="button" class="sphere-test-layer-btn" data-test-layer-btn="salmon" aria-pressed="false">Salmon — Columbia River</button>
        <button type="button" class="sphere-test-layer-btn" data-test-layer-btn="kyoto" aria-pressed="false">Kyoto blossoms</button>
      </div>
      <p class="sphere-test-layers-budget" data-test-budget hidden></p>
      <div data-test-layer-host></div>`;

    const dome = caption.querySelector("[data-sphere-sky-dome]");
    if (dome) dome.after(section);
    else caption.appendChild(section);

    const host = section.querySelector("[data-test-layer-host]");
    const budgetLine = section.querySelector("[data-test-budget]");
    const buttons = {
      salmon: section.querySelector('[data-test-layer-btn="salmon"]'),
      kyoto: section.querySelector('[data-test-layer-btn="kyoto"]'),
    };

    const state = {
      lit: [],               // this module's lit layers, oldest first
      packs: {},             // layer id -> pack (indexed, for kyoto)
      loading: {},
      failed: {},
      species: "chinook",
      currentISO: null,
    };

    function todayISO() {
      const now = new Date();
      return isoOf({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
    }

    function skyOn() {
      const line = caption.querySelector("[data-sky-readout]");
      if (line) return !line.hidden;
      const input = document.getElementById("sphere-ring-sky");
      return !input || input.checked;
    }

    function noteBudget(setDownId, reason) {
      if (!setDownId) return;
      budgetLine.hidden = false;
      budgetLine.textContent = reason === "sky"
        ? `The sky came on, and only two test layers stand at once — ${LAYERS[setDownId].short} was set down.`
        : `Only two test layers stand at once — ${LAYERS[setDownId].short} was set down.`;
    }

    function setLit(id, on, reason) {
      const at = state.lit.indexOf(id);
      if (on && at === -1) {
        const decision = decideActivation(state.lit, skyOn(), id);
        state.lit = decision.lit;
        if (decision.setDown) {
          buttons[decision.setDown].setAttribute("aria-pressed", "false");
          noteBudget(decision.setDown, reason);
        }
      } else if (!on && at !== -1) {
        state.lit.splice(at, 1);
      }
      buttons[id].setAttribute("aria-pressed", String(on && state.lit.includes(id)));
      render();
    }

    function enforceBudgetForSky() {
      // The sky ring is the armillary's switch, not this
      // module's; when it comes on over two lit test layers, the
      // least-recently-lit of this module's layers sets down.
      while (state.lit.length > (skyOn() ? 1 : 2)) {
        const down = state.lit.shift();
        buttons[down].setAttribute("aria-pressed", "false");
        noteBudget(down, "sky");
      }
      render();
    }

    function loadPack(id) {
      if (state.packs[id] || state.loading[id] || state.failed[id]) return;
      state.loading[id] = true;
      const url = id === "salmon" ? SALMON_URL : KYOTO_URL;
      fetch(url)
        .then((resp) => { if (!resp.ok) throw new Error(String(resp.status)); return resp.json(); })
        .then((pack) => {
          state.packs[id] = id === "kyoto" ? indexKyoto(pack) : pack;
          state.loading[id] = false;
          render();
        })
        .catch(() => {
          state.loading[id] = false;
          state.failed[id] = true;
          render();
        });
    }

    for (const id of Object.keys(buttons)) {
      buttons[id].addEventListener("click", () => {
        const on = !state.lit.includes(id);
        if (on) loadPack(id);
        setLit(id, on, "switch");
      });
    }

    /* ── Rendering ──────────────────────────────────────────── */

    function render() {
      host.innerHTML = "";
      for (const id of state.lit) {
        host.appendChild(id === "salmon" ? salmonSection() : kyotoSection());
      }
    }

    function layerShell(id, inner) {
      const el = document.createElement("div");
      el.className = `sphere-test-layer sphere-test-layer-${id}`;
      el.innerHTML = `
        <p class="sphere-test-layer-tag" data-test-tag>${escapeText(LAYERS[id].tag)}</p>
        ${inner}`;
      return el;
    }

    function pendingInner(id) {
      if (state.failed[id]) return `<p class="sphere-test-layer-line">The record could not be read on this device, so this layer stands down.</p>`;
      return `<p class="sphere-test-layer-line">Reading the record…</p>`;
    }

    function dayLineStrip(beads, color) {
      // beads: [{label, sub, state}] in DAY_LINE_OFFSETS order.
      const parts = [`<svg viewBox="0 0 320 46" class="sphere-test-dayline-svg" role="img" aria-label="The same day in other years">`];
      beads.forEach((bead, i) => {
        const x = 30 + i * 52;
        if (bead.state === "filled") {
          parts.push(`<circle cx="${x}" cy="16" r="7" fill="${color}"><title>${escapeText(bead.label)} — ${escapeText(bead.sub)}</title></circle>`);
        } else if (bead.state === "future") {
          parts.push(`<circle cx="${x}" cy="16" r="7" fill="none" stroke="#9a958a" stroke-width="1.4" stroke-dasharray="3 2.4"><title>${escapeText(bead.label)} — ${escapeText(bead.sub)}</title></circle>`);
        } else {
          parts.push(`<circle cx="${x}" cy="16" r="7" fill="none" stroke="#9a958a" stroke-width="1.4"><title>${escapeText(bead.label)} — ${escapeText(bead.sub)}</title></circle>`);
        }
        parts.push(`<text x="${x}" y="38" class="sphere-test-dayline-year">${escapeText(bead.label)}</text>`);
      });
      parts.push(`</svg>`);
      return parts.join("");
    }

    function dayLineList(beads) {
      const items = beads.map((b) => `<li>${escapeText(b.label)} — ${escapeText(b.sub)}</li>`).join("");
      return `<ul class="sphere-test-dayline-list">${items}</ul>`;
    }

    /* Salmon — a season curve of beads for the selected shell
     * year, one species at a time by sub-switch. */
    function salmonSection() {
      const pack = state.packs.salmon;
      if (!pack) return layerShell("salmon", pendingInner("salmon"));
      const civil = parseISODate(state.currentISO) || parseISODate(todayISO());
      const ss = civilToShellSlot(civil);
      const todaySS = civilToShellSlot(parseISODate(todayISO()));
      const sp = pack.species[state.species];
      const days = sp.years[String(ss.shell)] || [];
      const max = Math.max(1, ...days.map((d) => Math.max(0, d[1])));

      const speciesBtns = pack.speciesOrder.map((key) => {
        const label = pack.species[key].label;
        const pressed = key === state.species;
        return `<button type="button" class="sphere-test-species-btn" data-test-species="${key}" aria-pressed="${pressed}">${label}</button>`;
      }).join("");

      const parts = [];
      parts.push(`<div class="sphere-test-species" role="group" aria-label="Which run to show">${speciesBtns}</div>`);
      parts.push(`<p class="sphere-test-layer-line sphere-test-layer-strong">Bonneville Dam — the year that opened April 17, ${ss.shell}</p>`);
      parts.push(`<svg viewBox="0 0 320 118" class="sphere-test-salmon-svg" role="img" aria-label="The season's counted days at Bonneville">`);
      parts.push(`<line x1="8" y1="100" x2="312" y2="100" stroke="#e8e2d0" stroke-opacity="0.25"/>`);
      for (const [slot, count] of days) {
        const x = 8 + ((slot - 1) / 365) * 304;
        const y = 100 - (Math.max(0, count) / max) * 88;
        parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.7" fill="${LAYERS.salmon.color}"><title>${escapeText(longDate(slotToCivilISO(ss.shell, slot)))} · ${formatCount(count)} counted</title></circle>`);
      }
      const selX = 8 + ((ss.slot - 1) / 365) * 304;
      parts.push(`<line x1="${selX.toFixed(1)}" y1="8" x2="${selX.toFixed(1)}" y2="104" stroke="#f4f1e4" stroke-opacity="0.5" stroke-dasharray="3 3"/>`);
      parts.push(`<text x="8" y="114" class="sphere-test-axis">Apr 17</text>`);
      parts.push(`<text x="312" y="114" class="sphere-test-axis" text-anchor="end">Apr 16</text>`);
      parts.push(`</svg>`);

      const bead = salmonBead(pack, state.species, ss.shell, ss.slot, todaySS);
      let line;
      if (bead.state === "filled") {
        line = `${longDate(state.currentISO || todayISO())}: ${formatCount(bead.count)} ${sp.label.toLowerCase()} counted at Bonneville · that year's total ${formatCount(bead.total)} (the Sphere's year, April to April).`;
      } else if (bead.state === "future") {
        line = `${longDate(state.currentISO || todayISO())} is still to come — the counted record stops at today, and no bead is drawn for a day that has not happened.`;
      } else {
        line = `${longDate(state.currentISO || todayISO())}: no ${sp.label.toLowerCase()} count was recorded at Bonneville for this day.`;
      }
      parts.push(`<p class="sphere-test-layer-line">${escapeText(line)}</p>`);

      const beads = DAY_LINE_OFFSETS.map((off) => {
        const shell = ss.shell + off;
        const b = salmonBead(pack, state.species, shell, ss.slot, todaySS);
        const sub = b.state === "filled"
          ? `${formatCount(b.count)} counted · year total ${formatCount(b.total)}`
          : b.state === "future" ? "no record; the year is not kept yet" : "no count recorded";
        return { label: String(shell), sub, state: b.state };
      });
      parts.push(dayLineStrip(beads, LAYERS.salmon.color));
      parts.push(dayLineList(beads));

      const el = layerShell("salmon", parts.join(""));
      el.querySelectorAll("[data-test-species]").forEach((btn) => {
        btn.addEventListener("click", () => { state.species = btn.getAttribute("data-test-species"); render(); });
      });
      return el;
    }

    /* Kyoto — one bead per recorded year, the thread broken
     * where the record is broken. */
    function kyotoSection() {
      const pack = state.packs.kyoto;
      if (!pack) return layerShell("kyoto", pendingInner("kyoto"));
      const civil = parseISODate(state.currentISO) || parseISODate(todayISO());
      const selYear = civil.year;
      const [y0, y1] = pack.span;
      const X = (year) => 8 + ((year - y0) / (y1 - y0)) * 304;
      const Y = (doy) => 8 + ((doy - 70) / (140 - 70)) * 92;

      const parts = [];
      parts.push(`<p class="sphere-test-layer-line sphere-test-layer-strong">Kyoto — full flowering, ${y0} to ${y1}</p>`);
      parts.push(`<svg viewBox="0 0 320 118" class="sphere-test-kyoto-svg" role="img" aria-label="Twelve centuries of Kyoto full-flowering dates">`);
      let prev = null;
      for (const rec of pack.records) {
        const r = pack.byYear[String(rec[0])];
        const x = X(r.year), y = Y(r.doy);
        if (prev && r.year - prev.year === 1) {
          parts.push(`<line x1="${prev.x.toFixed(1)}" y1="${prev.y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${LAYERS.kyoto.colorDim}" stroke-width="1" stroke-opacity="0.8"/>`);
        }
        parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.25" fill="${LAYERS.kyoto.color}"><title>${r.year} · full bloom ${MONTH_NAMES[r.month - 1]} ${r.day}</title></circle>`);
        prev = { year: r.year, x, y };
      }
      if (selYear >= y0 && selYear <= y1) {
        parts.push(`<line x1="${X(selYear).toFixed(1)}" y1="4" x2="${X(selYear).toFixed(1)}" y2="104" stroke="#f4f1e4" stroke-opacity="0.5" stroke-dasharray="3 3"/>`);
        const sel = pack.byYear[String(selYear)];
        if (sel) {
          parts.push(`<circle cx="${X(selYear).toFixed(1)}" cy="${Y(sel.doy).toFixed(1)}" r="3.4" fill="none" stroke="#f4f1e4" stroke-width="1.4"/>`);
        }
      }
      parts.push(`<text x="8" y="114" class="sphere-test-axis">${y0}</text>`);
      parts.push(`<text x="312" y="114" class="sphere-test-axis" text-anchor="end">${y1} · earlier blooms stand higher</text>`);
      parts.push(`</svg>`);

      const bead = kyotoBead(pack, selYear);
      let line;
      if (bead.state === "filled") {
        const r = bead.record;
        line = `Full bloom in ${selYear}: ${MONTH_NAMES[r.month - 1]} ${r.day} — recorded. On the Sphere that day is Pattern Day ${r.slot} of the year that opened April 17, ${r.shell}.`;
      } else if (bead.state === "future") {
        line = `${selYear} is still to come — the recorded thread stops at ${y1}, and no bead is drawn for a bloom that has not happened.`;
      } else {
        line = `${selYear}: no record survives for this year — the gap is drawn as a gap.`;
      }
      parts.push(`<p class="sphere-test-layer-line">${escapeText(line)}</p>`);

      const beads = DAY_LINE_OFFSETS.map((off) => {
        const year = selYear + off;
        const b = kyotoBead(pack, year);
        const sub = b.state === "filled"
          ? `full bloom ${MONTH_NAMES[b.record.month - 1]} ${b.record.day}`
          : b.state === "future" ? "no record; the year is not kept yet" : "no record survives";
        return { label: String(year), sub, state: b.state };
      });
      parts.push(dayLineStrip(beads, LAYERS.kyoto.color));
      parts.push(dayLineList(beads));

      return layerShell("kyoto", parts.join(""));
    }

    /* ── Following the cursor, like the sky and farm layers ── */

    function applyDetail(detail) {
      const iso = civilISOFromCursorDetail(detail);
      if (!iso) return false;
      if (iso !== state.currentISO) {
        state.currentISO = iso;
        render();
      }
      return true;
    }

    function applyGlobals() {
      const coord = window.SOFCurrentTemporalCoordinate;
      if (coord && applyDetail({ coordinate: coord })) return;
      const selected = window.SOF_SELECTED_DATE;
      const PC = window.PatternCalendar;
      if (selected && PC && typeof PC.fromCivilDate === "function") {
        try {
          const summary = PC.fromCivilDate({ date: selected });
          if (summary?.civilDate && summary.civilDate !== state.currentISO) {
            state.currentISO = summary.civilDate;
            render();
          }
        } catch { /* the cursor's events remain the primary signal */ }
      }
    }

    for (const name of ["sof:selected-date-change", "sof:temporal-cursor-change", "sof:temporal-cursor-ready"]) {
      window.addEventListener(name, (e) => { if (!applyDetail(e.detail)) applyGlobals(); });
    }
    // The sky ring can be switched without any event this module
    // owns; watch its readout line the way the sky layer itself
    // does, and keep the budget honest while anything stands.
    const skyLine = caption.querySelector("[data-sky-readout]");
    if (skyLine) new MutationObserver(enforceBudgetForSky).observe(skyLine, { attributes: true, attributeFilter: ["hidden"] });
    window.setInterval(() => { if (state.lit.length) enforceBudgetForSky(); }, 5000);

    state.currentISO = todayISO();
    applyGlobals();
  }

  return {
    VERSION,
    DAY_LINE_OFFSETS,
    LAYERS,
    parseISODate,
    civilISOFromCursorDetail,
    civilToShellSlot,
    slotToCivilISO,
    decideActivation,
    salmonBead,
    kyotoBead,
    indexKyoto,
    boot
  };
});
