(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let lastResult = null;

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "—";
  }

  function setStatus(message) {
    setText("status", message);
  }

  function safeJson(data) {
    return JSON.stringify(data, null, 2);
  }

  function formatResult(result) {
    return [
      `Quick Seal: ${result.patternPosition.moonName || "Outside"} · Day ${result.patternPosition.dayInMoon || "Outside"}`,
      `Tone ${result.coreSignature.tone} (${result.coreSignature.toneProfile?.name || ""})`,
      `Carrier ${result.coreSignature.carrier.hz} Hz`,
      `Name Resonance: ${result.relationships.nameToBirthResonance.classification}`
    ].join("\n");
  }

  function renderList(rootId, rows) {
    const node = document.getElementById(rootId);
    if (!node) return;
    node.innerHTML = "";
    rows.forEach(({ label, value }) => {
      const row = document.createElement("div");
      row.className = "kv";
      const key = document.createElement("strong");
      key.textContent = label;
      const val = document.createElement("span");
      val.textContent = value;
      row.append(key, val);
      node.appendChild(row);
    });
  }

  function buildSealSvg(result, size = 320) {
    const moon = Number(result.patternPosition.moonNumber || 13);
    const day = Number(result.patternPosition.dayInMoon || 28);
    const tone = Number(result.coreSignature.tone || 13);
    const carrier = Number(result.coreSignature.carrier.hz || 432);
    const reduction = Number(result.nameSignature.fullNameReduction || 1);
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
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Seal of Becoming derived from Moon ${moon}, Day ${day}, Tone ${tone}">
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
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#f5f1e8" font-family="Inter, sans-serif" font-size="14">M${moon} · D${day} · T${tone}</text>
</svg>`;
  }

  function renderSeal(result) {
    const host = document.getElementById("sealCanvasWrap");
    if (!host) return;
    host.innerHTML = "";
    const svgMarkup = buildSealSvg(result);
    host.insertAdjacentHTML("beforeend", svgMarkup);
    setText("sealAlt", `Seal of Becoming: Moon ${result.patternPosition.moonNumber || "Outside"}, Day ${result.patternPosition.dayInMoon || "Outside"}, Tone ${result.coreSignature.tone}.`);
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 250);
  }

  function exportReadingJson() {
    if (!lastResult) return;
    download(
      `genesis-reading-${lastResult.input.birthDate}.json`,
      safeJson(lastResult),
      "application/json;charset=utf-8"
    );
    setStatus("Reading JSON exported.");
  }

  function exportReadingText() {
    if (!lastResult) return;
    const lines = [
      "GENESIS ORACLE 2.0",
      `Name: ${lastResult.input.name || "Unnamed"}`,
      `Birth: ${lastResult.input.birthDate}${lastResult.input.birthTime ? " " + lastResult.input.birthTime : ""}`,
      `Pattern: Moon ${lastResult.patternPosition.moonNumber || "Outside"} · Day ${lastResult.patternPosition.dayInMoon || "Outside"} · Tone ${lastResult.coreSignature.tone}`,
      `Quick Seal: ${formatResult(lastResult).replace(/\n/g, " | ")}`,
      "",
      "Reflection:",
      `- Foundation: ${lastResult.reading.foundation}`,
      `- Practical Action: ${lastResult.reading.practicalAction}`,
      "",
      "Methods:",
      `- Calendar Version: ${lastResult.calendarVersion}`,
      `- Oracle Version: ${lastResult.oracleVersion}`
    ];
    download(
      `genesis-reading-${lastResult.input.birthDate}.txt`,
      lines.join("\n"),
      "text/plain;charset=utf-8"
    );
    setStatus("Reading text exported.");
  }

  function exportSealSvg() {
    if (!lastResult) return;
    const svg = buildSealSvg(lastResult);
    download(`genesis-seal-${lastResult.input.birthDate}.svg`, svg, "image/svg+xml;charset=utf-8");
    setStatus("Seal SVG exported.");
  }

  function exportSealPng() {
    if (!lastResult) return;
    const svg = buildSealSvg(lastResult, 800);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(file => {
        if (file) {
          download(`genesis-seal-${lastResult.input.birthDate}.png`, file, "image/png");
          setStatus("Seal PNG exported.");
        }
        URL.revokeObjectURL(url);
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setStatus("Could not render PNG. Export SVG instead.");
    };
    img.src = url;
  }

  function renderProfiles() {
    const body = document.getElementById("savedRows");
    const selectA = document.getElementById("compareA");
    const selectB = document.getElementById("compareB");
    if (!body || !selectA || !selectB) return;

    const profiles = globalThis.GenesisOracleStorage.readProfiles();
    body.innerHTML = "";
    selectA.innerHTML = "";
    selectB.innerHTML = "";

    if (!profiles.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="7">No saved profiles yet.</td>`;
      body.appendChild(row);
      return;
    }

    profiles.forEach((profile, index) => {
      const row = document.createElement("tr");
      const legacy = profile.legacyRecord ? "legacy" : "v2";
      const values = [
        profile.input?.name || "Unnamed",
        profile.input?.birthDate || "",
        profile.calculated?.patternPosition?.moonName || profile.calculated?.moonName || "—",
        profile.calculated?.patternPosition?.dayInMoon || profile.calculated?.day || "—",
        profile.calculated?.coreSignature?.tone || profile.calculated?.tone || "—",
        profile.calendarVersion || "—",
        legacy
      ];
      values.forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        row.appendChild(cell);
      });
      body.appendChild(row);

      const optionA = document.createElement("option");
      optionA.value = String(index);
      optionA.textContent = `${profile.input?.name || "Unnamed"} (${profile.input?.birthDate || ""})`;
      const optionB = optionA.cloneNode(true);
      selectA.appendChild(optionA);
      selectB.appendChild(optionB);
    });
  }

  function normalizeForCompare(profile) {
    if (!profile) return null;
    if (profile.calculated?.patternPosition && profile.calculated?.coreSignature) {
      return {
        patternPosition: profile.calculated.patternPosition,
        coreSignature: profile.calculated.coreSignature,
        nameSignature: profile.calculated.nameSignature
      };
    }
    return null;
  }

  function runCompare() {
    const profiles = globalThis.GenesisOracleStorage.readProfiles();
    const a = profiles[Number($("#compareA")?.value || -1)];
    const b = profiles[Number($("#compareB")?.value || -1)];
    const out = $("#compareResult");
    if (!a || !b || !out) return;

    const pa = normalizeForCompare(a);
    const pb = normalizeForCompare(b);
    if (!pa || !pb) {
      out.textContent = "Both profiles must be Oracle 2.0 recalculated profiles before comparison.";
      return;
    }

    const compared = globalThis.GenesisOracleEngine.compareProfiles(pa, pb);
    out.textContent = safeJson(compared);
  }

  function recalcLegacy() {
    const profiles = globalThis.GenesisOracleStorage.readProfiles();
    const selected = profiles[Number($("#legacyRecalc")?.value || -1)];
    if (!selected?.legacyRecord) {
      setStatus("Select a legacy profile first.");
      return;
    }

    try {
      const result = globalThis.GenesisOracleEngine.run({
        name: selected.input?.name || "",
        birthDate: selected.input?.birthDate || "",
        birthTime: selected.input?.birthTime || "",
        timeZone: selected.input?.timezone || "UTC",
        boundaryMode: "midnight",
        sunsetTime: "18:00"
      });
      globalThis.GenesisOracleStorage.saveProfile(result);
      renderProfiles();
      setStatus("Legacy profile recalculated with Oracle 2.0 and saved as a new versioned entry.");
    } catch (error) {
      setStatus(error.message || "Could not recalculate legacy profile.");
    }
  }

  function render(result) {
    setText("quickSeal", formatResult(result));

    renderList("coreSignature", [
      { label: "Moon Key", value: result.coreSignature.moonKey },
      { label: "Day Key", value: result.coreSignature.dayKey },
      { label: "Week Gate", value: result.coreSignature.weekGate },
      { label: "Tone", value: `${result.coreSignature.tone} · ${result.coreSignature.toneProfile?.name || ""}` },
      { label: "Resonant Sum", value: String(result.coreSignature.resonantSum) },
      { label: "Element", value: `${result.coreSignature.element.moonElement} × ${result.coreSignature.element.dayElement} (${result.coreSignature.element.relationship})` },
      { label: "Carrier", value: `${result.coreSignature.carrier.hz} Hz` },
      { label: "Living Law", value: `${result.coreSignature.livingLaw?.index}. ${result.coreSignature.livingLaw?.name}` },
      { label: "Flame Path", value: `${result.coreSignature.flamePath?.index}. ${result.coreSignature.flamePath?.name}` },
      { label: "Primary Archetype", value: result.coreSignature.primaryArchetype },
      { label: "Supporting Archetype", value: result.coreSignature.supportingArchetype },
      { label: "Challenge Archetype", value: result.coreSignature.challengeArchetype },
      { label: "Return Practice", value: result.coreSignature.returnPractice }
    ]);

    renderList("moonDayToneReading", [
      { label: "Foundation", value: result.reading.foundation },
      { label: "Natural Gift", value: result.reading.naturalGift },
      { label: "Tension", value: result.reading.tension },
      { label: "Development Path", value: result.reading.developmentPath },
      { label: "Witness Practice", value: result.reading.witnessPractice },
      { label: "Practical Action", value: result.reading.practicalAction }
    ]);

    renderList("nameSignature", [
      { label: "Latin-Pythagorean", value: `${result.nameSignature.latinPythagorean.sum} → ${result.nameSignature.latinPythagorean.reduction}` },
      { label: "A1–Z26", value: `${result.nameSignature.latinA1Z26.sum} → ${result.nameSignature.latinA1Z26.reduction}` },
      { label: "Hebrew", value: `${result.nameSignature.hebrew.sum} → ${result.nameSignature.hebrew.reduction} (${result.nameSignature.hebrew.mode})` },
      { label: "Covenant Seal", value: String(result.nameSignature.covenantSeal) },
      { label: "Vowel Total", value: String(result.nameSignature.vowelTotal) },
      { label: "Consonant Total", value: String(result.nameSignature.consonantTotal) },
      { label: "Initials Code", value: `${result.nameSignature.initialsCode.value} → ${result.nameSignature.initialsCode.reduction}` },
      { label: "Full-Name Reduction", value: String(result.nameSignature.fullNameReduction) },
      { label: "Dominant Number", value: String(result.nameSignature.dominantNumber || "—") },
      { label: "Missing Numbers", value: result.nameSignature.missingNumberPattern.join(", ") || "None" },
      { label: "Name-to-Birth Resonance", value: `${result.relationships.nameToBirthResonance.classification} — ${result.relationships.nameToBirthResonance.reason}` }
    ]);

    renderList("lawFlame", [
      { label: "Living Law Meaning", value: result.coreSignature.livingLaw.conciseMeaning },
      { label: "Living Law Mature", value: result.coreSignature.livingLaw.matureExpression },
      { label: "Living Law Shadow", value: result.coreSignature.livingLaw.shadowExpression },
      { label: "Living Law Practice", value: result.coreSignature.livingLaw.dailyPractice },
      { label: "Flame Path Meaning", value: result.coreSignature.flamePath.conciseMeaning },
      { label: "Flame Path Mature", value: result.coreSignature.flamePath.matureExpression },
      { label: "Flame Path Shadow", value: result.coreSignature.flamePath.shadowExpression },
      { label: "Flame Path Practice", value: result.coreSignature.flamePath.dailyPractice }
    ]);

    renderList("todayTransit", [
      { label: "Current Emphasis", value: result.currentDayTransit.currentEmphasis },
      { label: "Supportive Pattern", value: result.currentDayTransit.supportivePattern },
      { label: "Possible Tension", value: result.currentDayTransit.possibleTension },
      { label: "Witness Prompt", value: result.currentDayTransit.witnessPrompt },
      { label: "Grounded Action", value: result.currentDayTransit.groundedAction },
      { label: "Notice", value: result.currentDayTransit.symbolicNotice }
    ]);

    renderList("developmentPath", [
      { label: "Tone Function", value: result.coreSignature.toneProfile.function },
      { label: "Strength", value: result.coreSignature.toneProfile.strength },
      { label: "Imbalance", value: result.coreSignature.toneProfile.imbalance },
      { label: "Question", value: result.coreSignature.toneProfile.question },
      { label: "Grounding", value: result.coreSignature.toneProfile.groundingAction }
    ]);

    setText("methodsRaw", safeJson(result.methods));
    renderSeal(result);
  }

  function runReadingFromForm() {
    const input = {
      name: $("#inName")?.value.trim() || "",
      birthDate: $("#inDate")?.value || "",
      birthTime: $("#inTime")?.value || "",
      timeZone: $("#inTZ")?.value.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      boundaryMode: $("#inBoundary")?.value || "midnight",
      sunsetTime: $("#inSunset")?.value || "18:00"
    };

    if (!input.birthDate) {
      setStatus("Birth date is required.");
      return null;
    }

    const result = globalThis.GenesisOracleEngine.run(input);
    lastResult = result;
    render(result);
    setStatus("Reading complete.");
    return result;
  }

  function initModes() {
    $$("[data-mode]").forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-mode");
        $$("[data-mode]").forEach(other => other.setAttribute("aria-pressed", String(other === btn)));
        $$("[data-reading-mode]").forEach(panel => {
          panel.hidden = panel.getAttribute("data-reading-mode") !== mode && mode !== "full";
        });
      });
    });
  }

  function copyReading() {
    if (!lastResult) return;
    const text = [
      formatResult(lastResult),
      `Foundation: ${lastResult.reading.foundation}`,
      `Practical Action: ${lastResult.reading.practicalAction}`
    ].join("\n");
    navigator.clipboard?.writeText(text)
      .then(() => setStatus("Reading copied."))
      .catch(() => setStatus(text));
  }

  function copyShareLink() {
    const params = new URLSearchParams();
    if ($("#inName")?.value) params.set("name", $("#inName").value);
    if ($("#inDate")?.value) params.set("date", $("#inDate").value);
    if ($("#inTime")?.value) params.set("time", $("#inTime").value);
    if ($("#inTZ")?.value) params.set("tz", $("#inTZ").value);
    if ($("#inBoundary")?.value) params.set("boundary", $("#inBoundary").value);
    if ($("#inSunset")?.value) params.set("sunset", $("#inSunset").value);

    const link = `${location.origin}${location.pathname}${params.toString() ? "?" + params.toString() : ""}`;
    navigator.clipboard?.writeText(link)
      .then(() => setStatus("Share link copied."))
      .catch(() => setStatus(link));
  }

  function initFromQuery() {
    const qs = new URLSearchParams(location.search);
    if (qs.get("name") && $("#inName")) $("#inName").value = qs.get("name");
    if (qs.get("date") && $("#inDate")) $("#inDate").value = qs.get("date");
    if (qs.get("time") && $("#inTime")) $("#inTime").value = qs.get("time");
    if (qs.get("tz") && $("#inTZ")) $("#inTZ").value = qs.get("tz");
    if (qs.get("boundary") && $("#inBoundary")) $("#inBoundary").value = qs.get("boundary");
    if (qs.get("sunset") && $("#inSunset")) $("#inSunset").value = qs.get("sunset");

    if (qs.get("date")) runReadingFromForm();
  }

  function bindEvents() {
    $("#oracleForm")?.addEventListener("submit", event => {
      event.preventDefault();
      try {
        runReadingFromForm();
      } catch (error) {
        setStatus(error.message || "Could not complete reading.");
      }
    });

    $("#saveProfile")?.addEventListener("click", () => {
      try {
        const result = lastResult || runReadingFromForm();
        if (!result) return;
        globalThis.GenesisOracleStorage.saveProfile(result);
        renderProfiles();
        setStatus("Profile saved locally.");
      } catch (error) {
        setStatus(error.message || "Could not save profile.");
      }
    });

    $("#copyReading")?.addEventListener("click", copyReading);
    $("#shareLink")?.addEventListener("click", copyShareLink);
    $("#printReading")?.addEventListener("click", () => window.print());
    $("#exportJson")?.addEventListener("click", exportReadingJson);
    $("#exportText")?.addEventListener("click", exportReadingText);
    $("#exportSealSvg")?.addEventListener("click", exportSealSvg);
    $("#exportSealPng")?.addEventListener("click", exportSealPng);

    $("#clearSaved")?.addEventListener("click", () => {
      localStorage.removeItem(globalThis.GenesisOracleStorage.STORAGE_KEY);
      renderProfiles();
      setStatus("Saved Oracle 2.0 profiles cleared.");
    });

    $("#runCompare")?.addEventListener("click", runCompare);
    $("#runLegacyRecalc")?.addEventListener("click", recalcLegacy);

    $("#importJson")?.addEventListener("change", event => {
      const file = event.target.files?.[0];
      if (!file) return;
      file.text().then(raw => {
        try {
          const count = globalThis.GenesisOracleStorage.importProfiles(raw);
          renderProfiles();
          setStatus(`Imported ${count} profile(s).`);
        } catch (error) {
          setStatus(error.message || "Import failed.");
        }
      });
    });
  }

  function refreshLegacySelector() {
    const select = $("#legacyRecalc");
    if (!select) return;
    const profiles = globalThis.GenesisOracleStorage.readProfiles();
    select.innerHTML = "";
    profiles.forEach((profile, index) => {
      if (!profile.legacyRecord) return;
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${profile.input?.name || "Unnamed"} (${profile.input?.birthDate || ""})`;
      select.appendChild(option);
    });
  }

  function init() {
    initModes();
    bindEvents();
    renderProfiles();
    refreshLegacySelector();
    initFromQuery();

    globalThis.GenesisOracle = {
      run: input => globalThis.GenesisOracleEngine.run(input),
      readProfiles: () => globalThis.GenesisOracleStorage.readProfiles(),
      compare: (a, b) => globalThis.GenesisOracleEngine.compareProfiles(a, b),
      versions: {
        calendar: globalThis.GenesisOracleVersion?.calendarVersion,
        oracle: globalThis.GenesisOracleVersion?.oracleVersion
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
