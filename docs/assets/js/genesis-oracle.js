/* Genesis Oracle — Spring New Moon + Fixed 13x28 System */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const DAY_MS = 86400000;
  const SYNODIC_MONTH = 29.530588853;
  const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
  const YEAR_COUNTED_DAYS = 13 * 28;
  const TZ_DEFAULT = "America/Los_Angeles";
  const STORAGE_KEY = "sof_genesis_oracle_profiles_v2";

  const MOONS = [
    ["Magnetic", "Unify · Purpose", "Gather the field and choose the direction."],
    ["Lunar", "Polarize · Challenge", "Name the tension and turn it into wisdom."],
    ["Electric", "Activate · Service", "Move energy into useful service."],
    ["Self-Existing", "Define · Form", "Give the invisible a structure it can inhabit."],
    ["Overtone", "Empower · Radiance", "Stand in authority without losing mercy."],
    ["Rhythmic", "Organize · Equality", "Balance the pattern and make the system fair."],
    ["Resonant", "Channel · Attunement", "Listen deeply and become the instrument."],
    ["Galactic", "Harmonize · Integrity", "Make the inner law match the outer walk."],
    ["Solar", "Pulse · Intention", "Focus fire into a clear living aim."],
    ["Planetary", "Perfect · Manifestation", "Bring the work into visible form."],
    ["Spectral", "Dissolve · Liberation", "Release what binds the signal."],
    ["Crystal", "Dedicate · Cooperation", "Join the circle and carry the shared weight."],
    ["Cosmic", "Endure · Presence", "Remain whole through completion and return."]
  ];

  const TONES = [
    "Magnetic Tone — unify purpose.",
    "Lunar Tone — face challenge.",
    "Electric Tone — activate service.",
    "Self-Existing Tone — define form.",
    "Overtone Tone — empower radiance.",
    "Rhythmic Tone — organize equality.",
    "Resonant Tone — channel attunement.",
    "Galactic Tone — harmonize integrity.",
    "Solar Tone — pulse intention.",
    "Planetary Tone — perfect manifestation.",
    "Spectral Tone — dissolve limitation.",
    "Crystal Tone — dedicate cooperation.",
    "Cosmic Tone — endure presence."
  ];

  const FLAMES = [
    ["Spark", "Begin cleanly. Choose one purpose and light it."],
    ["Mirror", "Let the challenge reveal the hidden split."],
    ["Current", "Serve through action, not theory alone."],
    ["Frame", "Build the vessel that can hold the signal."],
    ["Crown", "Empower without dominating."],
    ["Balance", "Restore fairness to the pattern."],
    ["Harp", "Tune yourself before tuning the room."],
    ["Weave", "Make conduct match covenant."],
    ["Sun", "Pulse the intention until it becomes visible."],
    ["Stone", "Manifest one finished piece."],
    ["Ash", "Dissolve the false bond."],
    ["Circle", "Cooperate with the living network."],
    ["Witness", "Remain present through completion."]
  ];

  const CARRIERS = {
    432: "Foundational breath · grounding · ordered return.",
    528: "Repair and mercy · renewal · heart coherence.",
    369: "Pattern and signal · mathematics · encoded motion.",
    144: "Witness and order · structure · measured testimony.",
    963: "Crown and return · high remembrance · upper signal."
  };

  let lastReading = null;

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function localNoon(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  }

  function isoDate(date) {
    const d = localNoon(date);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function fromISO(dateStr, timeStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm] = (timeStr || "12:00").split(":").map(Number);
    return new Date(y, m - 1, d, hh || 12, mm || 0, 0);
  }

  function addDays(date, n) {
    const d = localNoon(date);
    d.setDate(d.getDate() + n);
    return localNoon(d);
  }

  function daysBetween(a, b) {
    return Math.floor((localNoon(b) - localNoon(a)) / DAY_MS);
  }

  function fmtDate(date) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  function springEquinoxDate(year) {
    return new Date(year, 2, 20, 12, 0, 0);
  }

  function approximateNewMoonAfter(date) {
    const target = localNoon(date).getTime();
    const synodicMs = SYNODIC_MONTH * DAY_MS;
    const cycles = Math.ceil((target - KNOWN_NEW_MOON) / synodicMs);
    return localNoon(new Date(KNOWN_NEW_MOON + cycles * synodicMs));
  }

  function remnantYearStart(date) {
    const y = date.getFullYear();
    const startThisYear = approximateNewMoonAfter(springEquinoxDate(y));
    return localNoon(date) >= startThisYear
      ? startThisYear
      : approximateNewMoonAfter(springEquinoxDate(y - 1));
  }

  function nextRemnantYearStart(date) {
    const start = remnantYearStart(date);
    return approximateNewMoonAfter(springEquinoxDate(start.getFullYear() + 1));
  }

  function remnantInfo(date) {
    const yearStart = remnantYearStart(date);
    const nextStart = nextRemnantYearStart(date);
    const counted = daysBetween(yearStart, date);
    const yearLength = daysBetween(yearStart, nextStart);
    const extraDays = Math.max(0, yearLength - YEAR_COUNTED_DAYS);

    if (counted >= YEAR_COUNTED_DAYS) {
      return {
        special: "outside",
        yearStart,
        nextStart,
        counted,
        extraDays,
        label: "Outside Count",
        detail: `Reset span after Moon 13. Extra days this year: ${extraDays}.`
      };
    }

    const moonIndex = Math.floor(counted / 28) + 1;
    const dayInMoon = (counted % 28) + 1;
    const week = Math.floor((dayInMoon - 1) / 7) + 1;
    const weekDay = ((dayInMoon - 1) % 7) + 1;
    const tone = (counted % 13) + 1;
    const moon = MOONS[moonIndex - 1];

    return {
      special: null,
      yearStart,
      nextStart,
      counted,
      dayOfYear: counted + 1,
      moonIndex,
      dayInMoon,
      week,
      weekDay,
      tone,
      moonName: moon[0],
      essence: moon[1],
      law: moon[2],
      extraDays
    };
  }

  function reduceNumber(n) {
    const master = new Set([11, 22, 33]);
    while (n > 9 && !master.has(n)) {
      n = String(n).split("").reduce((a, b) => a + Number(b), 0);
    }
    return n;
  }

  function resonantSum(date) {
    return reduceNumber(date.getFullYear() + date.getMonth() + 1 + date.getDate());
  }

  function latinPythagorean(name) {
    const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
    let sum = 0;
    for (const ch of letters) {
      sum += ((ch.charCodeAt(0) - 65) % 9) + 1;
    }
    return { sum, reduced: reduceNumber(sum) };
  }

  function latinSimple(name) {
    const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
    let sum = 0;
    for (const ch of letters) {
      sum += ch.charCodeAt(0) - 64;
    }
    return { sum, reduced: reduceNumber(sum) };
  }

  function hebrewValue(name) {
    const map = {
      "א": 1, "ב": 2, "ג": 3, "ד": 4, "ה": 5, "ו": 6, "ז": 7, "ח": 8, "ט": 9,
      "י": 10, "כ": 20, "ך": 20, "ל": 30, "מ": 40, "ם": 40, "נ": 50, "ן": 50,
      "ס": 60, "ע": 70, "פ": 80, "ף": 80, "צ": 90, "ץ": 90, "ק": 100,
      "ר": 200, "ש": 300, "ת": 400
    };
    let sum = 0;
    for (const ch of name) {
      if (map[ch]) sum += map[ch];
    }
    return { sum, reduced: sum ? reduceNumber(sum) : 0 };
  }

  function carrierFor(tone, sum) {
    if ([11, 22, 33].includes(sum)) return 144;
    if ([9, 13].includes(tone) || sum >= 8) return 963;
    if ([5, 6, 11, 12].includes(tone) || [5, 6].includes(sum)) return 528;
    if ([3, 7, 9].includes(tone) || sum % 3 === 0) return 369;
    return 432;
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function setCarrier(carrier) {
    document.body.classList.remove("carrier-432", "carrier-528", "carrier-369", "carrier-144", "carrier-963");
    document.body.classList.add(`carrier-${carrier}`);
    setText("carrierOut", carrier);
    setText("carrierText", CARRIERS[carrier] || "Carrier selected.");
  }

  function paintDots(day) {
    const box = $("dayDots");
    if (!box) return;
    box.innerHTML = "";

    for (let i = 1; i <= 28; i++) {
      const dot = document.createElement("span");
      if (i === day) dot.className = "on";
      dot.title = `Day ${i}`;
      box.appendChild(dot);
    }
  }

  function paintArc(day) {
    const arc = $("dayArc");
    if (!arc) return;
    const progress = day / 28;
    arc.style.strokeDashoffset = String(316 * (1 - progress));
  }

  function computeName(name) {
    const p = latinPythagorean(name);
    const s = latinSimple(name);
    const h = hebrewValue(name);

    setText("pythOut", `${p.sum} → ${p.reduced}`);
    setText("simpleOut", `${s.sum} → ${s.reduced}`);
    setText("hebrewOut", h.sum ? `${h.sum} → ${h.reduced}` : "—");
    setText("covenantOut", `P${p.reduced} · S${s.reduced}${h.sum ? ` · H${h.reduced}` : ""}`);
  }

  function readBirth() {
    const name = $("fullName").value.trim() || "Unnamed Witness";
    const dateStr = $("birthDate").value;

    if (!dateStr) {
      setText("notice", "Enter a birth date first.");
      return null;
    }

    const date = fromISO(dateStr, $("birthTime").value);
    const info = remnantInfo(date);
    const sum = resonantSum(date);
    const sealGlow = [1, 4, 7, 11, 22, 33].includes(sum);

    let carrier = 432;

    setText("outName", name);
    setText("outBirth", `${fmtDate(date)} · ${$("birthTZ").value || TZ_DEFAULT}`);

    if (info.special) {
      setText("summaryLine", `${name} · ${info.label}`);
      setText("outMoon", info.label);
      setText("outWeek", "Outside lattice");
      setText("outTone", "Outside tone count");
      setText("moonReading", info.detail);
      setText("specialReading", info.detail);
      setText("dayBig", "∞");
      setText("daySmall", "/OUT");
      paintDots(0);
      paintArc(28);
      carrier = 963;
    } else {
      carrier = carrierFor(info.tone, sum);
      setText("summaryLine", `${name} · Moon ${info.moonIndex} · Day ${info.dayInMoon} · Tone ${info.tone}`);
      setText("outMoon", `Moon ${info.moonIndex} — ${info.moonName}, Day ${info.dayInMoon}/28`);
      setText("outWeek", `Week ${info.week}, Day ${info.weekDay}`);
      setText("outTone", `${info.tone} · ${TONES[info.tone - 1]}`);
      setText("moonReading", `${info.moonName}: ${info.essence}. ${info.law}`);
      setText("specialReading", `Year anchor: ${fmtDate(info.yearStart)} · Extra outside-count days this year: ${info.extraDays}`);
      setText("dayBig", info.dayInMoon);
      setText("daySmall", "/28");
      paintDots(info.dayInMoon);
      paintArc(info.dayInMoon);

      const flame = FLAMES[info.tone - 1];
      setText("lawTitle", `${info.moonName} Law`);
      setText("lawText", info.law);
      setText("flameTitle", `${flame[0]} Path`);
      setText("flameText", TONES[info.tone - 1]);
      setText("practiceText", flame[1]);
    }

    setText("outSum", String(sum));
    setText("anchorLine", `Anchor: ${fmtDate(info.yearStart)} · First New Moon after Spring Equinox`);
    setCarrier(carrier);

    const seal = $("seal");
    if (seal) seal.classList.toggle("glow", sealGlow);

    computeName($("nameOverride").value.trim() || name);

    lastReading = {
      name,
      date: dateStr,
      tz: $("birthTZ").value || TZ_DEFAULT,
      moon: info.special ? info.label : info.moonIndex,
      day: info.special ? "OUT" : info.dayInMoon,
      tone: info.special ? "OUT" : info.tone,
      sum,
      carrier
    };

    setText("notice", "Reading complete.");
    return lastReading;
  }

  function loadProfiles() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveProfiles(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function renderSaved() {
    const body = $("savedBody");
    if (!body) return;

    const list = loadProfiles();
    body.innerHTML = "";

    list.forEach((p) => {
      const tr = document.createElement("tr");
      tr.className = "saved-row";
      tr.innerHTML = `
        <td>${p.name}</td>
        <td>${p.date}</td>
        <td>${p.moon}</td>
        <td>${p.day}</td>
        <td>${p.tone}</td>
        <td>${p.carrier}</td>
      `;
      tr.addEventListener("click", () => {
        $("fullName").value = p.name;
        $("birthDate").value = p.date;
        $("birthTZ").value = p.tz || TZ_DEFAULT;
        readBirth();
      });
      body.appendChild(tr);
    });
  }

  function populateTZ() {
    const zones = ["America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "UTC"];
    $("birthTZ").innerHTML = zones.map((z) => `<option value="${z}">${z}</option>`).join("");
    $("birthTZ").value = TZ_DEFAULT;
  }

  function populateLaws() {
    const list = $("lawList");
    if (!list) return;
    list.innerHTML = MOONS.map((m, i) => `<li><strong>${i + 1}. ${m[0]}</strong> — ${m[2]}</li>`).join("");
  }

  function bind() {
    $("readBtn").addEventListener("click", readBirth);

    $("nameBtn").addEventListener("click", () => {
      computeName($("nameOverride").value.trim() || $("fullName").value.trim());
    });

    $("saveBtn").addEventListener("click", () => {
      const reading = lastReading || readBirth();
      if (!reading) return;

      const list = loadProfiles();
      list.unshift({ ...reading, stamp: new Date().toISOString() });
      saveProfiles(list.slice(0, 50));
      renderSaved();
      setText("notice", "Saved locally.");
    });

    $("shareBtn").addEventListener("click", async () => {
      const url = new URL(location.href);
      if ($("fullName").value) url.searchParams.set("name", $("fullName").value);
      if ($("birthDate").value) url.searchParams.set("date", $("birthDate").value);
      if ($("birthTime").value) url.searchParams.set("time", $("birthTime").value);
      url.searchParams.set("tz", $("birthTZ").value || TZ_DEFAULT);

      try {
        await navigator.clipboard.writeText(url.toString());
        setText("notice", "Share link copied.");
      } catch {
        setText("notice", "Could not copy link.");
      }
    });

    $("exportBtn").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(loadProfiles(), null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "genesis-oracle-profiles.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });

    $("clearBtn").addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      renderSaved();
      setText("notice", "Saved profiles cleared.");
    });

    document.querySelectorAll("[data-carrier]").forEach((btn) => {
      btn.addEventListener("click", () => setCarrier(btn.dataset.carrier));
    });

    const params = new URLSearchParams(location.search);
    if (params.get("name")) $("fullName").value = params.get("name");
    if (params.get("date")) $("birthDate").value = params.get("date");
    if (params.get("time")) $("birthTime").value = params.get("time");
    if (params.get("tz")) $("birthTZ").value = params.get("tz");

    if (params.get("date")) readBirth();
  }

  document.addEventListener("DOMContentLoaded", () => {
    setText("yr", new Date().getFullYear());
    populateTZ();
    populateLaws();
    renderSaved();
    bind();
  });

  window.SOF = window.SOF || {};
  window.SOF.genesis = {
    read(payload) {
      if (payload?.name) $("fullName").value = payload.name;
      if (payload?.date) $("birthDate").value = payload.date;
      if (payload?.time) $("birthTime").value = payload.time;
      if (payload?.tz) $("birthTZ").value = payload.tz;
      return readBirth();
    }
  };
})();
