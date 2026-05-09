(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const MOONS = [
    "Moon of Breath", "Moon of Flame", "Moon of Waters", "Moon of Stone",
    "Moon of Seed", "Moon of Voice", "Moon of Witness", "Moon of Balance",
    "Moon of Return", "Moon of Crown", "Moon of Gate", "Moon of Memory",
    "Moon of Completion"
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

  const PYTH = {A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,I:9,J:1,K:2,L:3,M:4,N:5,O:6,P:7,Q:8,R:9,S:1,T:2,U:3,V:4,W:5,X:6,Y:7,Z:8};
  const A1Z26 = Object.fromEntries("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((ch, i) => [ch, i + 1]));
  const HEB = {
    "א":1,"ב":2,"ג":3,"ד":4,"ה":5,"ו":6,"ז":7,"ח":8,"ט":9,
    "י":10,"כ":20,"ך":20,"ל":30,"מ":40,"ם":40,"נ":50,"ן":50,"ס":60,
    "ע":70,"פ":80,"ף":80,"צ":90,"ץ":90,"ק":100,"ר":200,"ש":300,"ת":400
  };

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

  function approxAnchor(year) {
    // Stable civil approximation for first new moon after spring equinox.
    // Keeps the page working offline without API calls.
    const anchors = {
      2020: "2020-03-24", 2021: "2021-04-12", 2022: "2022-04-01",
      2023: "2023-03-21", 2024: "2024-04-08", 2025: "2025-03-29",
      2026: "2026-03-19", 2027: "2027-04-07", 2028: "2028-03-26",
      2029: "2029-04-14", 2030: "2030-04-03"
    };
    return new Date((anchors[year] || `${year}-03-29`) + "T12:00:00Z");
  }

  function parseBirth(dateStr, timeStr) {
    const time = timeStr || "12:00";
    return new Date(`${dateStr}T${time}:00`);
  }

  function mapToRemnant(date) {
    const y = date.getFullYear();
    let anchor = approxAnchor(y);
    let utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12));
    let diff = Math.floor((utcDate - anchor) / 86400000);

    if (diff < 0) {
      anchor = approxAnchor(y - 1);
      diff = Math.floor((utcDate - anchor) / 86400000);
    }

    if (diff >= 364) {
      return {
        outside: true,
        outsideDay: diff - 363,
        year: anchor.getUTCFullYear(),
        moon: null,
        day: null,
        index: diff + 1
      };
    }

    const moon = Math.floor(diff / 28) + 1;
    const day = (diff % 28) + 1;
    return {
      outside: false,
      year: anchor.getUTCFullYear(),
      moon,
      day,
      week: Math.floor((day - 1) / 7) + 1,
      index: diff + 1
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
    const idx = Math.abs(num - 1) % CARRIERS.length;
    return CARRIERS[idx];
  }

  function renderCarriers(activeHz) {
    $("#carrierRow").innerHTML = CARRIERS.map(([hz, text]) => (
      `<div class="carrier-chip ${hz === activeHz ? "active" : ""}"><strong>${hz} Hz</strong><br><span>${text}</span></div>`
    )).join("");
  }

  function renderSaved() {
    const saved = JSON.parse(localStorage.getItem("sofGenesisProfiles") || "[]");
    $("#savedRows").innerHTML = saved.map(row => (
      `<tr><td>${row.name}</td><td>${row.birth}</td><td>${row.moon}</td><td>${row.day}</td><td>${row.tone}</td><td>${row.carrier} Hz</td></tr>`
    )).join("") || `<tr><td colspan="6">No saved profiles yet.</td></tr>`;
  }

  function computeNameCodes() {
    const source = $("#nameOverride").value.trim() || $("#inName").value.trim();
    const pyth = codeName(source, PYTH);
    const simple = codeName(source, A1Z26);
    const heb = codeHebrew(source);
    $("#pythCode").textContent = source ? `${pyth.sum} → ${pyth.red}` : "—";
    $("#simpleCode").textContent = source ? `${simple.sum} → ${simple.red}` : "—";
    $("#hebrewCode").textContent = heb.sum ? `${heb.sum} → ${heb.red}` : "—";
    $("#covenantSeal").textContent = source ? `Seal ${reduceNum(pyth.red + simple.red + (heb.red || 0))}` : "—";
  }

  let lastReading = null;

  function runReading() {
    const name = $("#inName").value.trim() || "Unnamed";
    const dateStr = $("#inDate").value;
    const timeStr = $("#inTime").value;

    if (!dateStr) {
      $("#status").textContent = "Choose a birth date first.";
      return null;
    }

    const birth = parseBirth(dateStr, timeStr);
    const mapped = mapToRemnant(birth);
    const dayNumber = dayOfYearUTC(new Date(Date.UTC(birth.getFullYear(), birth.getMonth(), birth.getDate(), 12)));
    const resonant = reduceNum(birth.getFullYear() + birth.getMonth() + 1 + birth.getDate());
    const tone = mapped.outside ? "Outside Count" : ((mapped.index - 1) % 13) + 1;
    const lawIndex = mapped.outside ? 12 : mapped.moon - 1;
    const flameIndex = mapped.outside ? 12 : tone - 1;
    const [carrierHz, carrierText] = carrierFor(mapped.outside ? resonant : tone);

    const moonName = mapped.outside ? "Outside Day" : MOONS[mapped.moon - 1];
    const moonDay = mapped.outside ? `Outside ${mapped.outsideDay}` : mapped.day;
    const week = mapped.outside ? "Reset / Intercalary" : `Week ${mapped.week}`;

    $("#outName").textContent = name;
    $("#outBirth").textContent = `${dateStr}${timeStr ? " " + timeStr : ""}`;
    $("#outDate").textContent = mapped.outside ? `Outside Count · Day ${mapped.outsideDay}` : `Moon ${mapped.moon} · Day ${mapped.day}`;
    $("#outWeek").textContent = week;
    $("#outTone").textContent = String(tone);
    $("#outResonant").textContent = String(resonant);

    $("#moonName").textContent = moonName;
    $("#moonDay").textContent = mapped.outside ? "Outside" : `${mapped.day} /28`;
    $("#moonProgress").style.width = mapped.outside ? "100%" : `${Math.round((mapped.day / 28) * 100)}%`;

    $("#sigSymbol").textContent = mapped.outside ? "∞" : `☲ ${mapped.moon}:${mapped.day}`;
    $("#sigText").textContent = mapped.outside
      ? "This birth rests in the outside-count reset span."
      : `${moonName}, Tone ${tone}, Carrier ${carrierHz} Hz.`;

    const [lawName, lawText] = LAWS[lawIndex];
    $("#lawTitle").textContent = `Law ${lawIndex + 1} — ${lawName}`;
    $("#lawText").textContent = lawText;

    $("#flameTitle").textContent = `Flame ${flameIndex + 1} — ${FLAMES[flameIndex]}`;
    $("#flameText").textContent = mapped.outside ? "Rest, clear, and seal the prior cycle." : `Tone ${tone} turns the day toward ${FLAMES[flameIndex].toLowerCase()}.`;
    $("#flamePractice").textContent = `Practice: write one line of witness, then one action that keeps coherence.`;

    $("#carrierHz").textContent = `${carrierHz} Hz`;
    $("#carrierText").textContent = carrierText;
    renderCarriers(carrierHz);
    computeNameCodes();

    $("#allLaws").innerHTML = LAWS.map(([title, text], i) => (
      `<div><strong>${i + 1}. ${title}</strong><br><span>${text}</span></div>`
    )).join("");

    $("#status").textContent = "Reading complete.";

    lastReading = {
      name,
      birth: dateStr,
      moon: mapped.outside ? "Outside" : mapped.moon,
      day: moonDay,
      tone,
      carrier: carrierHz,
      yearDay: dayNumber,
      resonant
    };

    return lastReading;
  }

  $("#oracleForm").addEventListener("submit", (event) => {
    event.preventDefault();
    runReading();
  });

  $$(".tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      $$(".tabs button").forEach(b => b.setAttribute("aria-selected", String(b === btn)));
      $$(".tab-panel").forEach(panel => panel.classList.add("hidden"));
      $(`#panel-${tab}`).classList.remove("hidden");
    });
  });

  $("#computeName").addEventListener("click", computeNameCodes);

  $("#saveProfile").addEventListener("click", () => {
    const reading = lastReading || runReading();
    if (!reading) return;
    const saved = JSON.parse(localStorage.getItem("sofGenesisProfiles") || "[]");
    saved.unshift(reading);
    localStorage.setItem("sofGenesisProfiles", JSON.stringify(saved.slice(0, 40)));
    renderSaved();
    $("#status").textContent = "Profile saved locally.";
  });

  $("#shareLink").addEventListener("click", async () => {
    const params = new URLSearchParams();
    if ($("#inName").value) params.set("name", $("#inName").value);
    if ($("#inDate").value) params.set("date", $("#inDate").value);
    if ($("#inTime").value) params.set("time", $("#inTime").value);
    const url = `${location.origin}${location.pathname}?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      $("#status").textContent = "Share link copied.";
    } catch {
      $("#status").textContent = url;
    }
  });

  $("#exportJson").addEventListener("click", () => {
    const data = localStorage.getItem("sofGenesisProfiles") || "[]";
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "genesis-oracle-profiles.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("#clearSaved").addEventListener("click", () => {
    localStorage.removeItem("sofGenesisProfiles");
    renderSaved();
  });

  const qs = new URLSearchParams(location.search);
  if (qs.get("name")) $("#inName").value = qs.get("name");
  if (qs.get("date")) $("#inDate").value = qs.get("date");
  if (qs.get("time")) $("#inTime").value = qs.get("time");
  if (qs.get("date")) runReading();

  renderCarriers(432);
  renderSaved();
})();
