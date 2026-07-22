(() => {
  "use strict";

  const STORAGE_KEY = "sofGenesisProfiles";
  const ORACLE_VERSION = "genesis-oracle/1.0.0";
  const LEGACY_CALENDAR_VERSION = "legacy/genesis-oracle/new-moon-anchor";
  const LEGACY_ORACLE_VERSION = "legacy/genesis-oracle/pre-1.0.0";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const MOONS = globalThis.PatternCalendarData?.moonNames || [
    "Seed Flame", "Root Waters", "Breath Gate", "Stone Witness", "Living Word", "Fire Trial", "Crown Balance", "Deep Mirror", "Return Path", "Builder’s Hand", "Star Remembrance", "River of Signs", "Completion Seal"
  ];

  const LAWS = [
    ["Breath", "Begin clean. Receive before forcing."],
    ["Flame", "Let desire be purified by purpose."],
    ["Waters", "Let feeling move without ruling the vessel."],
    ["Stone", "Build what can hold the weight of truth."],
    ["Seed", "Plant small, repeat faithfully, harvest later."],
    ["Voice", "Speak only what you are willing to steward."],
    ["Witness", "Record the proof. Memory keeps the gate."],
    ["Balance", "Power must pass through ethics."],
    ["Return", "What is scattered can be gathered again."],
    ["Crown", "Authority is service under coherence."],
    ["Gate", "Discern timing before crossing thresholds."],
    ["Memory", "Restore the pattern without worshiping the wound."],
    ["Completion", "Seal the cycle and prepare the new beginning."]
  ];

  const FLAMES = [
    "Ignition", "Refinement", "Mercy", "Foundation", "Growth", "Transmission",
    "Record", "Justice", "Restoration", "Authority", "Threshold", "Remembrance", "Seal"
  ];

  const CARRIERS = [
    [432, "Grounding, body cadence, field stabilization."],
    [528, "Repair, restoration, living correction."],
    [369, "Pattern, sequence, recursion, return."],
    [144, "Remnant architecture, grid, temple measure."],
    [963, "Crown, prayer, stillness, high coherence."]
  ];

  const PYTH = { A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,I:9,J:1,K:2,L:3,M:4,N:5,O:6,P:7,Q:8,R:9,S:1,T:2,U:3,V:4,W:5,X:6,Y:7,Z:8 };
  const A1Z26 = Object.fromEntries("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((ch, i) => [ch, i + 1]));

  const HEB = {
    "א":1,"ב":2,"ג":3,"ד":4,"ה":5,"ו":6,"ז":7,"ח":8,"ט":9,
    "י":10,"כ":20,"ך":20,"ל":30,"מ":40,"ם":40,"נ":50,"ן":50,"ס":60,
    "ע":70,"פ":80,"ף":80,"צ":90,"ץ":90,"ק":100,"ר":200,"ש":300,"ת":400
  };

  let lastReading = null;

  function safeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function setText(sel, value) {
    const el = $(sel);
    if (el) el.textContent = value ?? "—";
  }

  function setStatus(message) {
    setText("#status", message);
  }

  function normalizeSavedRecord(row) {
    if (!row || typeof row !== "object") return null;
    if (row.calendarVersion || row.oracleVersion) return row;
    return {
      ...row,
      calendarVersion: LEGACY_CALENDAR_VERSION,
      oracleVersion: LEGACY_ORACLE_VERSION,
      legacyRecord: true
    };
  }

  function readSaved() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeSavedRecord).filter(Boolean);
    } catch {
      return [];
    }
  }

  function writeSaved(rows) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, 40)));
  }

  function reduceNum(n) {
    let x = Math.abs(Number(n) || 0);
    while (x > 9 && ![11, 22, 33].includes(x)) {
      x = String(x).split("").reduce((a, b) => a + Number(b), 0);
    }
    return x;
  }

  function dayOfYearUTC(date) {
    const start = Date.UTC(date.getUTCFullYear(), 0, 1);
    return Math.floor((date.getTime() - start) / 86400000) + 1;
  }

  function parseBirth(dateStr, timeStr) {
    const time = timeStr || "12:00";
    return new Date(`${dateStr}T${time}:00`);
  }

  function mapToPatternCalendar({ dateStr, timeZone }) {
    if (!globalThis.PatternCalendar) {
      throw new Error("PatternCalendar engine unavailable");
    }

    const mapped = globalThis.PatternCalendar.fromCivilDate({
      date: dateStr,
      timeZone: timeZone || "UTC",
      boundaryMode: "midnight"
    });

    return {
      outside: !mapped.insideCountedYear,
      outsideDay: mapped.intercalaryIndex || 0,
      moon: mapped.moon,
      day: mapped.day,
      week: mapped.weekOfMoon,
      index: mapped.dayOfPatternYear,
      moonName: mapped.moonName,
      isDayOutOfTime: mapped.isDayOutOfTime,
      isDeepTimeDay: mapped.isDeepTimeDay,
      calendarVersion: mapped.calendarVersion
    };
  }

  function codeName(name, map, regex = /[A-Z]/g) {
    const chars = (name.toUpperCase().match(regex) || []);
    const sum = chars.reduce((acc, ch) => acc + (map[ch] || 0), 0);
    return { sum, red: reduceNum(sum) };
  }

  function codeHebrew(name) {
    const chars = name.match(/[\u0590-\u05FF]/g) || [];
    const sum = chars.reduce((acc, ch) => acc + (HEB[ch] || 0), 0);
    return { sum, red: reduceNum(sum) };
  }

  function carrierFor(num) {
    const idx = Math.abs(Number(num || 1) - 1) % CARRIERS.length;
    return CARRIERS[idx];
  }

  function renderCarriers(activeHz) {
    const row = $("#carrierRow");
    if (!row) return;

    row.innerHTML = CARRIERS.map(([hz, text]) => `
      <div class="carrier-chip ${hz === activeHz ? "active" : ""}">
        <strong>${safeText(hz)} Hz</strong><br>
        <span>${safeText(text)}</span>
      </div>
    `).join("");
  }

  function renderSaved() {
    const table = $("#savedRows");
    if (!table) return;

    const saved = readSaved();

    table.innerHTML = saved.map(row => {
      const legacy = row.legacyRecord || row.calendarVersion === LEGACY_CALENDAR_VERSION;
      const moonLabel = `${safeText(row.moon)}${legacy ? " · legacy" : ""}`;
      return `
      <tr>
        <td>${safeText(row.name)}</td>
        <td>${safeText(row.birth)}</td>
        <td>${moonLabel}</td>
        <td>${safeText(row.day)}</td>
        <td>${safeText(row.tone)}</td>
        <td>${safeText(row.carrier)} Hz</td>
      </tr>`;
    }).join("") || `<tr><td colspan="6">No saved profiles yet.</td></tr>`;
  }

  function computeNameCodes() {
    const source = ($("#nameOverride")?.value.trim() || $("#inName")?.value.trim() || "");
    const pyth = codeName(source, PYTH);
    const simple = codeName(source, A1Z26);
    const heb = codeHebrew(source);

    setText("#pythCode", source ? `${pyth.sum} → ${pyth.red}` : "—");
    setText("#simpleCode", source ? `${simple.sum} → ${simple.red}` : "—");
    setText("#hebrewCode", heb.sum ? `${heb.sum} → ${heb.red}` : "—");
    setText("#covenantSeal", source ? `Seal ${reduceNum(pyth.red + simple.red + (heb.red || 0))}` : "—");
  }

  function runReading() {
    const name = $("#inName")?.value.trim() || "Unnamed";
    const dateStr = $("#inDate")?.value || "";
    const timeStr = $("#inTime")?.value || "";
    const inputTZ = $("#inTZ")?.value.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    if (!dateStr) {
      setStatus("Choose a birth date first.");
      return null;
    }

    const birth = parseBirth(dateStr, timeStr);

    if (Number.isNaN(birth.getTime())) {
      setStatus("Birth date could not be read. Check the date field.");
      return null;
    }

    let mapped;
    try {
      mapped = mapToPatternCalendar({ dateStr, timeZone: inputTZ });
    } catch {
      setStatus("Calendar engine unavailable. Refresh and try again.");
      return null;
    }

    const dayNumber = dayOfYearUTC(new Date(Date.UTC(birth.getFullYear(), birth.getMonth(), birth.getDate(), 12)));
    const resonant = reduceNum(birth.getFullYear() + birth.getMonth() + 1 + birth.getDate());
    const tone = mapped.outside ? "Outside Count" : ((mapped.index - 1) % 13) + 1;
    const lawIndex = mapped.outside ? 12 : mapped.moon - 1;
    const flameIndex = mapped.outside ? 12 : Number(tone) - 1;
    const [carrierHz, carrierText] = carrierFor(mapped.outside ? resonant : tone);

    const moonName = mapped.outside
      ? (mapped.isDeepTimeDay ? "Deep Time Day" : "Day Out of Time")
      : (mapped.moonName || MOONS[mapped.moon - 1]);
    const moonDay = mapped.outside ? `Intercalary ${mapped.outsideDay}` : mapped.day;
    const week = mapped.outside ? "Intercalary" : `Week ${mapped.week}`;

    setText("#outName", name);
    setText("#outBirth", `${dateStr}${timeStr ? " " + timeStr : ""}`);
    setText("#outDate", mapped.outside ? `${moonName} · Day ${mapped.outsideDay}` : `Moon ${mapped.moon} · Day ${mapped.day}`);
    setText("#outWeek", week);
    setText("#outTone", String(tone));
    setText("#outResonant", String(resonant));

    setText("#moonName", moonName);
    setText("#moonDay", mapped.outside ? "Intercalary" : `${mapped.day} /28`);

    const progress = $("#moonProgress");
    if (progress) progress.style.width = mapped.outside ? "100%" : `${Math.round((mapped.day / 28) * 100)}%`;

    setText("#sigSymbol", mapped.outside ? "∞" : `☲ ${mapped.moon}:${mapped.day}`);
    setText(
      "#sigText",
      mapped.outside
        ? "This birth maps to an intercalary threshold outside the 364-day counted lattice."
        : `${moonName}, Tone ${tone}, Carrier ${carrierHz} Hz.`
    );

    const [lawName, lawText] = LAWS[lawIndex];
    setText("#lawTitle", `Law ${lawIndex + 1} — ${lawName}`);
    setText("#lawText", lawText);

    setText("#flameTitle", `Flame ${flameIndex + 1} — ${FLAMES[flameIndex]}`);
    setText("#flameText", mapped.outside ? "Rest, clear, and seal the prior cycle." : `Tone ${tone} turns the day toward ${FLAMES[flameIndex].toLowerCase()}.`);
    setText("#flamePractice", "Practice: write one line of witness, then one action that keeps coherence.");

    setText("#carrierHz", `${carrierHz} Hz`);
    setText("#carrierText", carrierText);

    renderCarriers(carrierHz);
    computeNameCodes();

    const allLaws = $("#allLaws");
    if (allLaws) {
      allLaws.innerHTML = LAWS.map(([title, text], i) => `
        <div>
          <strong>${i + 1}. ${safeText(title)}</strong><br>
          <span>${safeText(text)}</span>
        </div>
      `).join("");
    }

    setStatus("Reading complete.");

    lastReading = {
      name,
      birth: dateStr,
      birthTime: timeStr || null,
      timezone: inputTZ,
      moon: mapped.outside ? moonName : mapped.moon,
      moonName,
      day: moonDay,
      week,
      tone,
      carrier: carrierHz,
      carrierMeaning: carrierText,
      yearDay: dayNumber,
      remnantYearDay: mapped.index,
      resonant,
      outsideCount: mapped.outside,
      calendarVersion: mapped.calendarVersion,
      oracleVersion: ORACLE_VERSION,
      legacyRecord: false,
      exportedLabel: `${name} · ${dateStr}`
    };

    return lastReading;
  }

  function buildExportData() {
    const profiles = readSaved();

    return {
      title: "Genesis Oracle Profiles",
      project: "Scroll of Fire — Remnant Calendar",
      sourcePage: "Genesis Oracle",
      exportedAt: new Date().toISOString(),
      profileCount: profiles.length,
      notes: [
        "Generated locally in the browser.",
        "Profiles are saved in localStorage on this device.",
        "Pattern mapping uses the fixed Pattern Calendar engine and versioned profile metadata."
      ],
      profiles: profiles.map((p, index) => ({
        id: index + 1,
        name: p.name || "Unnamed",
        birthDate: p.birth || "",
        birthTime: p.birthTime || null,
        timezone: p.timezone || null,
        calendarVersion: p.calendarVersion || LEGACY_CALENDAR_VERSION,
        oracleVersion: p.oracleVersion || LEGACY_ORACLE_VERSION,
        legacyRecord: Boolean(p.legacyRecord),
        remnantCalendar: {
          moon: p.moon,
          moonName: p.moonName || null,
          day: p.day,
          week: p.week || null,
          tone: p.tone,
          carrierHz: p.carrier,
          carrierMeaning: p.carrierMeaning || null,
          gregorianYearDay: p.yearDay,
          remnantYearDay: p.remnantYearDay || null,
          resonantSeal: p.resonant,
          outsideCount: Boolean(p.outsideCount)
        }
      }))
    };
  }

  function exportJson() {
    const data = buildExportData();
    const prettyJSON = JSON.stringify(data, null, 2);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`genesis-oracle-profiles-${stamp}.json`, prettyJSON, "application/json;charset=utf-8");
    setStatus("Pretty JSON export downloaded.");
  }

  function exportText() {
    const data = buildExportData();

    const lines = [
      "GENESIS ORACLE PROFILES",
      "Scroll of Fire — Remnant Calendar",
      `Exported: ${data.exportedAt}`,
      `Profiles: ${data.profileCount}`,
      "",
      "----------------------------------------",
      ""
    ];

    data.profiles.forEach(profile => {
      lines.push(`Profile ${profile.id}: ${profile.name}`);
      lines.push(`Birth Date: ${profile.birthDate}${profile.birthTime ? " " + profile.birthTime : ""}`);
      lines.push(`Moon: ${profile.remnantCalendar.moonName || profile.remnantCalendar.moon}`);
      lines.push(`Day: ${profile.remnantCalendar.day}`);
      lines.push(`Week: ${profile.remnantCalendar.week || "—"}`);
      lines.push(`Tone: ${profile.remnantCalendar.tone}`);
      lines.push(`Carrier: ${profile.remnantCalendar.carrierHz} Hz`);
      lines.push(`Carrier Meaning: ${profile.remnantCalendar.carrierMeaning || "—"}`);
      lines.push(`Gregorian Year Day: ${profile.remnantCalendar.gregorianYearDay}`);
      lines.push(`Remnant Year Day: ${profile.remnantCalendar.remnantYearDay || "—"}`);
      lines.push(`Resonant Seal: ${profile.remnantCalendar.resonantSeal}`);
      lines.push(`Calendar Version: ${profile.calendarVersion}`);
      lines.push(`Oracle Version: ${profile.oracleVersion}`);
      lines.push(profile.legacyRecord ? "Record Type: Legacy" : "Record Type: Versioned");
      lines.push("");
      lines.push("----------------------------------------");
      lines.push("");
    });

    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`genesis-oracle-profiles-${stamp}.txt`, lines.join("\n"), "text/plain;charset=utf-8");
    setStatus("Readable text export downloaded.");
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    a.rel = "noopener";

    document.body.appendChild(a);
    a.click();
    a.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 250);
  }

  function initTabs() {
    $$(".tabs button").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        $$(".tabs button").forEach(b => b.setAttribute("aria-selected", String(b === btn)));
        $$(".tab-panel").forEach(panel => panel.classList.add("hidden"));
        $(`#panel-${tab}`)?.classList.remove("hidden");
      });
    });
  }

  function initEvents() {
    $("#oracleForm")?.addEventListener("submit", event => {
      event.preventDefault();
      runReading();
    });

    $("#computeName")?.addEventListener("click", computeNameCodes);

    $("#saveProfile")?.addEventListener("click", () => {
      const reading = lastReading || runReading();
      if (!reading) return;

      const saved = readSaved();
      saved.unshift(reading);
      writeSaved(saved);
      renderSaved();
      setStatus("Profile saved locally.");
    });

    $("#shareLink")?.addEventListener("click", async () => {
      const params = new URLSearchParams();
      if ($("#inName")?.value) params.set("name", $("#inName").value);
      if ($("#inDate")?.value) params.set("date", $("#inDate").value);
      if ($("#inTime")?.value) params.set("time", $("#inTime").value);
      if ($("#inTZ")?.value) params.set("tz", $("#inTZ").value);

      const url = `${location.origin}${location.pathname}${params.toString() ? "?" + params.toString() : ""}`;

      try {
        await navigator.clipboard.writeText(url);
        setStatus("Share link copied.");
      } catch {
        setStatus(url);
      }
    });

    $("#exportJson")?.addEventListener("click", exportJson);
    $("#exportText")?.addEventListener("click", exportText);

    $("#clearSaved")?.addEventListener("click", () => {
      const ok = window.confirm("Clear all saved Genesis Oracle profiles from this device?");
      if (!ok) return;

      localStorage.removeItem(STORAGE_KEY);
      renderSaved();
      setStatus("Saved profiles cleared.");
    });
  }

  function initFromQueryString() {
    const qs = new URLSearchParams(location.search);

    if (qs.get("name") && $("#inName")) $("#inName").value = qs.get("name");
    if (qs.get("date") && $("#inDate")) $("#inDate").value = qs.get("date");
    if (qs.get("time") && $("#inTime")) $("#inTime").value = qs.get("time");
    if (qs.get("tz") && $("#inTZ")) $("#inTZ").value = qs.get("tz");

    if (qs.get("date")) runReading();
  }

  function init() {
    initTabs();
    initEvents();
    initFromQueryString();
    renderCarriers(432);
    renderSaved();

    window.GenesisOracle = {
      runReading,
      mapToPatternCalendar,
      readSaved,
      storageKey: STORAGE_KEY,
      versions: {
        oracle: ORACLE_VERSION,
        calendar: globalThis.PatternCalendarVersion?.version || "unknown"
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
