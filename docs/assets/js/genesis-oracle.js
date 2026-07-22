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
      result.quickSeal || `Quick Seal: ${result.patternPosition.moonName || "Outside"} · Day ${result.patternPosition.dayInMoon || "Outside"}`,
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
    if (!confirmPersonalExport()) return;
    download(
      `genesis-reading-${lastResult.input.birthDate}.json`,
      safeJson(lastResult),
      "application/json;charset=utf-8"
    );
    setStatus("Reading JSON exported.");
  }

  function exportReadingText() {
    if (!lastResult) return;
    if (!confirmPersonalExport()) return;
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

    const repo = globalThis.OracleProfileRepository;
    const profiles = repo ? [...repo.listProfiles(), ...repo.listLegacyProfiles()] :
      (globalThis.GenesisOracleStorage?.readProfiles() || []);

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

      const label = `${profile.input?.name || "Unnamed"} (${profile.input?.birthDate || ""})`;
      const optionA = document.createElement("option");
      optionA.value = String(index);
      optionA.textContent = label;
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
    const repo = globalThis.OracleProfileRepository;
    const legacySelector = $("#legacyRecalc");
    if (!legacySelector) return;

    const selectedId = legacySelector.value;
    if (!selectedId) {
      setStatus("Select a legacy profile first.");
      return;
    }

    try {
      if (repo) {
        const migrated = repo.migrateLegacyProfile(selectedId);
        renderProfiles();
        refreshLegacySelector();
        updateMirrorSealState(repo.getStatus());
        setStatus("Legacy profile recalculated with Oracle 2.0 and saved as a new versioned entry.");
      } else {
        const profiles = globalThis.GenesisOracleStorage.readProfiles();
        const selected = profiles[Number(selectedId)];
        if (!selected?.legacyRecord) {
          setStatus("Select a legacy profile first.");
          return;
        }
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
      }
    } catch (error) {
      setStatus(error.message || "Could not recalculate legacy profile.");
    }
  }

  function render(result) {
    setText("quickSeal", result.quickSeal || formatResult(result));

    renderList("coreSignature", [
      { label: "Moon Key", value: result.coreSignature.moonKey },
      { label: "Day Key", value: result.coreSignature.dayKey },
      { label: "Week Gate", value: result.coreSignature.weekGate },
      { label: "Tone", value: `${result.coreSignature.tone} · ${result.coreSignature.toneProfile?.name || ""}` },
      { label: "Resonant Sum", value: String(result.coreSignature.resonantSum) },
      {
        label: "Tone ↔ Resonant Relationship",
        value: `${result.methods?.toneResonant?.relationshipState || "—"} (Δ ${result.methods?.toneResonant?.delta ?? "—"})`
      },
      { label: "Element", value: `${result.coreSignature.element.moonElement} × ${result.coreSignature.element.dayElement} (${result.coreSignature.element.relationship})` },
      {
        label: "Birth-Time Gate",
        value: result.input.timeKnown
          ? `${result.birthTimeLayer.gate} (${result.input.birthTime} ${result.birthTimeLayer.timezone})`
          : "unknown (birth time not provided; time-specific interpretation omitted)"
      },
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
      {
        label: "Name-to-Birth Resonance",
        value: `${result.relationships.nameToBirthResonance.classification} (score ${result.relationships.nameToBirthResonance.score ?? 0}) — ${result.relationships.nameToBirthResonance.reason}`
      },
      {
        label: "Resonance Score Breakdown",
        value: safeJson(result.relationships.nameToBirthResonance.scoreBreakdown || {})
      }
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

    const mirror = result.mirrorReading || result.dailyMirror || {};
    const dailyGate = mirror.dailyGate || {};
    const mirrorRows = [
      {
        label: "1. Daily Gate",
        value: [
          `${dailyGate.civilDate || "—"} → ${dailyGate.effectiveDate || "—"}`,
          `Pattern Year ${dailyGate.patternYear ?? "—"} · Moon ${dailyGate.moon ?? "Outside"} ${dailyGate.moonName || ""} · Day ${dailyGate.moonDay ?? "Outside"} · Day ${dailyGate.dayOf364 ?? "Outside"}/364`,
          `${dailyGate.weekGate || "Week Gate"} · ${dailyGate.dayArchetype || "Day Archetype"} · Tone ${dailyGate.tone ?? "—"}`,
          `${dailyGate.visibleLunarPhase || "Moon phase"} · ${dailyGate.shabbatState || "Ordinary Day"}`,
          `${dailyGate.timeZone || "UTC"} · ${dailyGate.boundaryMode || "midnight"}${dailyGate.manualSunset ? ` · ${dailyGate.manualSunset}` : ""} · ${dailyGate.astronomySource || "approximate-synodic-phase"}`
        ].join(" | ")
      },
      { label: "2. Opening", value: mirror.opening || "—" },
      { label: "3. Pattern", value: mirror.pattern || "—" },
      { label: "4. Tension", value: mirror.tension || "—" },
      { label: "5. Practice", value: mirror.practice || "—" },
      { label: "6. Witness Question", value: mirror.witnessQuestion || "—" },
      { label: "7. Closing Seal", value: mirror.closingSeal || "—" },
      {
        label: "Threefold Counsel (compact)",
        value: `Signal: ${mirror.threefoldCounsel?.signal || "—"} | Crossing: ${mirror.threefoldCounsel?.crossing || "—"} | Command: ${mirror.threefoldCounsel?.command || "—"}`
      }
    ];

    if (mirror.mirrorThroughMySeal) {
      renderMirrorSealContent(mirror.mirrorThroughMySeal);
    }

    renderList("todayTransit", mirrorRows);

    renderList("developmentPath", [
      { label: "Tone Function", value: result.coreSignature.toneProfile.function },
      { label: "Strength", value: result.coreSignature.toneProfile.strength },
      { label: "Imbalance", value: result.coreSignature.toneProfile.imbalance },
      { label: "Question", value: result.coreSignature.toneProfile.question },
      { label: "Grounding", value: result.coreSignature.toneProfile.groundingAction }
    ]);

    const methodSummary = [
      `${result.methods?.toneResonant?.toneRole || "Tone role unavailable."}`,
      `${result.methods?.toneResonant?.resonantSumRole || "Resonant Sum role unavailable."}`,
      `Relationship: ${result.methods?.toneResonant?.relationshipState || "unknown"} (Δ ${result.methods?.toneResonant?.delta ?? "—"})`,
      `Birth-Time Gate: ${result.input.timeKnown ? result.birthTimeLayer.gate : "unknown"}`
    ].join("\n");
    setText("methodsSummary", methodSummary);
    setText("methodsRaw", safeJson({
      ...result.methods,
      nameToBirthResonanceScore: result.relationships.nameToBirthResonance
    }));
    renderSeal(result);
  }

  function runReadingFromForm() {
    const selectedProfile = getSelectedMirrorProfile();
    const input = {
      name: $("#inName")?.value.trim() || "",
      birthDate: $("#inDate")?.value || "",
      birthTime: $("#inTime")?.value || "",
      timeZone: $("#inTZ")?.value.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      boundaryMode: $("#inBoundary")?.value || "midnight",
      sunsetTime: $("#inSunset")?.value || "18:00",
      selectedProfile
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
    if (!confirmPersonalExport()) return;
    const text = [
      formatResult(lastResult),
      `Foundation: ${lastResult.reading.foundation}`,
      `Practical Action: ${lastResult.reading.practicalAction}`
    ].join("\n");
    const copy = globalThis.RemnantShare?.copyFullScroll
      ? globalThis.RemnantShare.copyFullScroll(text, copyShareLink({ silent: true }), [])
      : navigator.clipboard?.writeText(text);
    Promise.resolve(copy)
      .then(() => setStatus("Reading copied."))
      .catch(() => setStatus(text));
  }

  function copyShareLink({ silent = false } = {}) {
    const link = globalThis.RemnantShareUrl?.buildOracleShareLink
      ? globalThis.RemnantShareUrl.buildOracleShareLink({
        baseUrl: location.pathname,
        timeZone: $("#inTZ")?.value || "",
        boundaryMode: $("#inBoundary")?.value || "",
        sunsetTime: $("#inSunset")?.value || "",
        view: "quick",
        oracleVersion: globalThis.GenesisOracleVersion?.oracleVersion || "genesis-oracle/2.0.0",
        source: "oracle-quick-seal"
      })
      : `${location.origin}${location.pathname}`;
    if (silent) return link;
    const copy = globalThis.RemnantShare?.copyPermanentLink
      ? globalThis.RemnantShare.copyPermanentLink(link)
      : navigator.clipboard?.writeText(link);
    Promise.resolve(copy).then(() => setStatus("Share link copied.")).catch(() => setStatus(link));
    return link;
  }

  function initFromQuery() {
    const qs = new URLSearchParams(location.search);
    if (qs.get("tz") && $("#inTZ")) $("#inTZ").value = qs.get("tz");
    if (qs.get("boundary") && $("#inBoundary")) $("#inBoundary").value = qs.get("boundary");
    if (qs.get("sunset") && $("#inSunset")) $("#inSunset").value = qs.get("sunset");
  }

  function confirmPersonalExport() {
    const hasPersonalData = Boolean($("#inName")?.value || $("#inDate")?.value || $("#inTime")?.value);
    if (!hasPersonalData) return true;
    return window.confirm("Privacy warning: this export may include personal Oracle input (name or birth details). Continue?");
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
        const repo = globalThis.OracleProfileRepository;
        if (repo) {
          repo.saveProfile(result);
          renderProfiles();
          refreshLegacySelector();
          updateMirrorSealState(repo.getStatus());
        } else {
          globalThis.GenesisOracleStorage.saveProfile(result);
          renderProfiles();
        }
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
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(globalThis.OracleProfileRepository?.STORAGE_KEY_V2 ||
          globalThis.GenesisOracleStorage?.STORAGE_KEY);
      }
      globalThis.OracleProfileRepository?.initialize().then(() => {
        renderProfiles();
        refreshLegacySelector();
      });
      setStatus("Saved Oracle 2.0 profiles cleared.");
    });

    $("#runCompare")?.addEventListener("click", runCompare);
    $("#runLegacyRecalc")?.addEventListener("click", recalcLegacy);

    // Profile picker dialog triggers
    function handleOpenPicker() { openProfilePicker(); }
    document.getElementById("profilePickerTrigger")?.addEventListener("click", handleOpenPicker);
    document.getElementById("profilePickerTrigger2")?.addEventListener("click", handleOpenPicker);
    document.getElementById("profilePickerClose")?.addEventListener("click", closeProfilePicker);
    document.getElementById("profilePickerDialog")?.addEventListener("click", e => {
      // Close on backdrop click
      if (e.target === e.currentTarget) closeProfilePicker();
    });
    document.getElementById("profilePickerDialog")?.addEventListener("keydown", e => {
      if (e.key === "Escape") { e.preventDefault(); closeProfilePicker(); }
    });

    // Profile picker search
    document.getElementById("profilePickerSearch")?.addEventListener("input", e => {
      const repo = globalThis.OracleProfileRepository;
      const state = repo?.getStatus();
      _populateProfilePickerList(state?.profiles || [], state?.legacyProfiles || [], e.target.value);
    });

    // Profile picker manage / import
    document.getElementById("profilePickerManage")?.addEventListener("click", () => {
      closeProfilePicker();
      document.getElementById("savedRows")?.closest(".panel")?.scrollIntoView({ behavior: "smooth" });
    });
    document.getElementById("profilePickerImport")?.addEventListener("change", event => {
      const file = event.target.files?.[0];
      if (!file) return;
      file.text().then(raw => {
        try {
          const repo = globalThis.OracleProfileRepository;
          if (repo) {
            const result = repo.importProfiles(raw);
            renderProfiles();
            refreshLegacySelector();
            setStatus(`Imported ${result.imported} profile(s).`);
            updateMirrorSealState(repo.getStatus());
            // Repopulate picker list
            const state = repo.getStatus();
            _populateProfilePickerList(state.profiles, state.legacyProfiles, "");
          } else {
            const count = globalThis.GenesisOracleStorage.importProfiles(raw);
            renderProfiles();
            setStatus(`Imported ${count} profile(s).`);
          }
        } catch (error) {
          setStatus(error.message || "Import failed.");
        }
      });
      event.target.value = "";
    });

    // Mirror retry
    document.getElementById("mirrorRetry")?.addEventListener("click", () => {
      globalThis.OracleProfileRepository?.initialize().then(state => {
        updateMirrorSealState(globalThis.OracleProfileRepository.getStatus());
      });
    });

    // Mirror import trigger (in empty state)
    document.getElementById("mirrorImportTrigger")?.addEventListener("click", () => {
      document.getElementById("profilePickerImport")?.click();
    });

    $("#importJson")?.addEventListener("change", event => {
      const file = event.target.files?.[0];
      if (!file) return;
      file.text().then(raw => {
        try {
          const repo = globalThis.OracleProfileRepository;
          if (repo) {
            const result = repo.importProfiles(raw);
            renderProfiles();
            refreshLegacySelector();
            updateMirrorSealState(repo.getStatus());
            setStatus(`Imported ${result.imported} profile(s).`);
          } else {
            const count = globalThis.GenesisOracleStorage.importProfiles(raw);
            renderProfiles();
            setStatus(`Imported ${count} profile(s).`);
          }
        } catch (error) {
          setStatus(error.message || "Import failed.");
        }
      });
    });
  }

  function refreshLegacySelector() {
    const select = $("#legacyRecalc");
    if (!select) return;
    const repo = globalThis.OracleProfileRepository;
    const legacyProfiles = repo ? repo.listLegacyProfiles() :
      (globalThis.GenesisOracleStorage?.readProfiles().filter(p => p.legacyRecord) || []);
    select.innerHTML = "";
    legacyProfiles.forEach((profile, index) => {
      const option = document.createElement("option");
      option.value = profile.id || String(index);
      option.textContent = `${profile.input?.name || "Unnamed"} (${profile.input?.birthDate || ""})`;
      select.appendChild(option);
    });
  }

  function getSelectedMirrorProfile() {
    const repo = globalThis.OracleProfileRepository;
    if (!repo) return null;
    const profile = repo.getSelectedProfile();
    if (!profile) return null;
    if (!profile.calculated?.patternPosition || !profile.calculated?.coreSignature) return null;
    return {
      patternPosition: profile.calculated.patternPosition,
      coreSignature: profile.calculated.coreSignature
    };
  }

  // ── Origin isolation notice ──────────────────────────────────────────────────

  function checkOriginIsolation() {
    const notice = document.getElementById("mirrorOriginNotice");
    if (!notice) return;
    const hostname = location.hostname;
    const isProduction = hostname === "codexofreality.org" || hostname === "www.codexofreality.org";
    notice.hidden = isProduction;
  }

  // ── Profile picker (custom dialog replaces native <select>) ─────────────────

  function _buildProfilePickerItem(profile) {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.setAttribute("data-profile-id", profile.id);
    li.className = "profile-picker-item";
    if (profile.legacyRecord) li.classList.add("profile-picker-item--legacy");

    const repo = globalThis.OracleProfileRepository;
    const selectedId = repo?.getStatus().selectedProfileId;
    if (profile.id === selectedId) {
      li.setAttribute("aria-selected", "true");
      li.classList.add("profile-picker-item--selected");
    } else {
      li.setAttribute("aria-selected", "false");
    }

    const name = profile.input?.name || "Unnamed";
    const birthDate = profile.input?.birthDate || "";
    const moon = profile.calculated?.patternPosition?.moonName || "—";
    const day = profile.calculated?.patternPosition?.dayInMoon || "—";
    const oracleVer = profile.legacyRecord ? "Legacy" : "Oracle 2.0";

    li.innerHTML = `
      <span class="picker-item-name">${name}</span>
      <span class="picker-item-meta">${birthDate} · ${moon} · Day ${day}</span>
      <span class="picker-item-version">${oracleVer}${profile.legacyRecord ? ' <span class="picker-legacy-badge" aria-label="Legacy profile">Legacy</span>' : ''}</span>
    `;

    li.addEventListener("click", () => {
      if (profile.legacyRecord) {
        // Legacy profiles can't be used for Mirror Through My Seal without recalculating
        setStatus("Recalculate this legacy profile with Oracle 2.0 to use Mirror Through My Seal.");
        return;
      }
      repo?.selectProfile(profile.id);
      closeProfilePicker();
      if (lastResult) {
        try {
          const rerun = runReadingFromForm();
          if (rerun) lastResult = rerun;
        } catch (error) {
          setStatus(error.message || "Could not refresh Mirror Through My Seal.");
        }
      }
    });

    return li;
  }

  function _populateProfilePickerList(profiles, legacyProfiles, searchQuery) {
    const list = document.getElementById("profilePickerList");
    if (!list) return;
    list.innerHTML = "";

    const query = (searchQuery || "").toLowerCase().trim();
    const allProfiles = [...profiles, ...legacyProfiles];
    const filtered = query
      ? allProfiles.filter(p => {
          const name = (p.input?.name || "").toLowerCase();
          const date = (p.input?.birthDate || "").toLowerCase();
          return name.includes(query) || date.includes(query);
        })
      : allProfiles;

    if (!filtered.length) {
      const li = document.createElement("li");
      li.className = "profile-picker-empty";
      li.textContent = query ? "No profiles match your search." : "No saved profiles found.";
      list.appendChild(li);
      return;
    }

    filtered.forEach(profile => list.appendChild(_buildProfilePickerItem(profile)));

    // Show search input when there are several profiles
    const searchWrap = document.getElementById("profilePickerSearchWrap");
    if (searchWrap) searchWrap.hidden = allProfiles.length < 4;
  }

  let _pickerReturnFocus = null;

  function openProfilePicker() {
    const dialog = document.getElementById("profilePickerDialog");
    if (!dialog) return;

    _pickerReturnFocus = document.activeElement;

    const repo = globalThis.OracleProfileRepository;
    const state = repo?.getStatus();
    const profiles = state?.profiles || [];
    const legacyProfiles = state?.legacyProfiles || [];
    _populateProfilePickerList(profiles, legacyProfiles, "");

    const trigger1 = document.getElementById("profilePickerTrigger");
    const trigger2 = document.getElementById("profilePickerTrigger2");
    trigger1?.setAttribute("aria-expanded", "true");

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }

    // Move focus into dialog
    const closeBtn = document.getElementById("profilePickerClose");
    closeBtn?.focus();
  }

  function closeProfilePicker() {
    const dialog = document.getElementById("profilePickerDialog");
    if (!dialog) return;

    const trigger1 = document.getElementById("profilePickerTrigger");
    trigger1?.setAttribute("aria-expanded", "false");

    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }

    // Return focus to trigger
    if (_pickerReturnFocus && typeof _pickerReturnFocus.focus === "function") {
      _pickerReturnFocus.focus();
    }
    _pickerReturnFocus = null;
  }

  // ── Mirror Through My Seal state management ──────────────────────────────────

  function updateMirrorSealState(repoState) {
    const trigger = document.getElementById("profilePickerTrigger");
    const triggerLabel = document.getElementById("profilePickerLabel");
    const sealContent = document.getElementById("mirrorSealContent");
    const sealEmpty = document.getElementById("mirrorSealEmpty");
    const emptyMsg = document.getElementById("mirrorSealEmptyMsg");
    const mirrorRetry = document.getElementById("mirrorRetry");

    if (!repoState) return;

    const { status, selectedProfileId, legacyProfiles } = repoState;
    const hasLegacyOnly = repoState.profiles.length === 0 && legacyProfiles.length > 0;

    // Update trigger label
    if (triggerLabel) {
      if (status === "loading") {
        triggerLabel.textContent = "Loading saved profiles…";
      } else if (status === "error") {
        triggerLabel.textContent = "Could not load profiles";
      } else if (!selectedProfileId) {
        if (status === "empty") {
          triggerLabel.textContent = "No Oracle profiles saved on this address";
        } else if (hasLegacyOnly) {
          triggerLabel.textContent = "Legacy profiles found — recalculate to use Mirror";
        } else {
          triggerLabel.textContent = "Choose a saved Oracle profile";
        }
      } else {
        const profile = globalThis.OracleProfileRepository?.getProfile(selectedProfileId);
        if (profile) {
          const moon = profile.calculated?.patternPosition?.moonName || "—";
          const day = profile.calculated?.patternPosition?.dayInMoon || "—";
          triggerLabel.textContent = `${profile.input?.name || "Unnamed"} · ${moon} · Day ${day}`;
        } else {
          triggerLabel.textContent = "Profile selected";
        }
      }
    }

    // Enable/disable trigger based on state
    if (trigger) {
      trigger.disabled = status === "loading";
    }

    // Show/hide personalized content
    const hasSelection = Boolean(selectedProfileId);
    if (sealContent) sealContent.hidden = !hasSelection;
    if (sealEmpty) sealEmpty.hidden = hasSelection;

    // Update empty state message
    if (emptyMsg && !hasSelection) {
      if (status === "loading") {
        emptyMsg.textContent = "Loading saved Oracle profiles…";
      } else if (status === "error") {
        emptyMsg.textContent = "Saved profiles could not be read. Retry or import a profile backup.";
      } else if (status === "empty") {
        emptyMsg.textContent = "No Oracle profiles are saved on this site address.";
      } else if (hasLegacyOnly) {
        emptyMsg.textContent = "Legacy profiles were found. Recalculate one with Oracle 2.0 to use Mirror Through My Seal.";
      } else {
        emptyMsg.textContent = "Choose a saved Oracle profile to compare your Genesis signature with today's Pattern.";
      }
    }

    if (mirrorRetry) mirrorRetry.hidden = status !== "error";
  }

  function renderMirrorSealContent(mirrorThroughMySeal) {
    const grid = document.getElementById("mirrorSealGrid");
    const notice = document.getElementById("mirrorSymbolicNotice");
    if (!grid || !mirrorThroughMySeal) return;

    renderList("mirrorSealGrid", [
      { label: "Birth Moon × Current Moon", value: mirrorThroughMySeal.support || "—" },
      { label: "Support", value: mirrorThroughMySeal.support || "—" },
      { label: "Friction", value: mirrorThroughMySeal.friction || "—" },
      { label: "Present Emphasis", value: mirrorThroughMySeal.presentEmphasis || "—" },
      { label: "Witness Question", value: mirrorThroughMySeal.witnessQuestion || "—" },
      { label: "Grounded Action", value: mirrorThroughMySeal.groundedAction || "—" }
    ]);

    if (notice) {
      notice.textContent = mirrorThroughMySeal.symbolicNotice || "Symbolic reflection, not prediction.";
    }
  }

  function init() {
    initModes();
    bindEvents();
    checkOriginIsolation();

    const repo = globalThis.OracleProfileRepository;
    if (repo) {
      // Show loading state immediately before async init
      updateMirrorSealState({ status: "loading", profiles: [], legacyProfiles: [], selectedProfileId: null });

      repo.subscribe(state => {
        updateMirrorSealState(state);
        renderProfiles();
        refreshLegacySelector();
      });

      repo.initialize().catch(() => {
        updateMirrorSealState(repo.getStatus());
      });
    } else {
      // Fallback: use legacy storage directly
      renderProfiles();
      refreshLegacySelector();
      updateMirrorSealState({ status: "ready", profiles: [], legacyProfiles: [], selectedProfileId: null });
    }

    initFromQuery();

    globalThis.GenesisOracle = {
      run: input => globalThis.GenesisOracleEngine.run(input),
      readProfiles: () => repo ? repo.listProfiles() : globalThis.GenesisOracleStorage?.readProfiles(),
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
