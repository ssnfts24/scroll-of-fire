(() => {
  "use strict";

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const LOG_KEY = "sof_moon_logs_v2";
  const TZ_KEY = "sof_moons_tz_v2";

  const MOONS = [
    { idx: 1, name: "Seed Flame", element: "Fire", freq: "144 Hz", essence: "Beginning, ignition, first witness", practice: "Start clean. Speak the first word. Mark the seed." },
    { idx: 2, name: "Root Waters", element: "Water", freq: "432 Hz", essence: "Memory, cleansing, emotional ground", practice: "Cleanse memory. Listen to dreams. Watch emotional weather." },
    { idx: 3, name: "Breath Gate", element: "Air", freq: "369 Hz", essence: "Word, air, signal, exchange", practice: "Guard speech. Track repeated words. Breathe before response." },
    { idx: 4, name: "Stone Witness", element: "Earth", freq: "174 Hz", essence: "Body, structure, faithful record", practice: "Build structure. Repair the physical. Record what happened." },
    { idx: 5, name: "Living Word", element: "Aether", freq: "528 Hz", essence: "Speech, vow, creative command", practice: "Speak with care. Create through ordered language." },
    { idx: 6, name: "Fire Trial", element: "Fire", freq: "417 Hz", essence: "Testing, courage, purification", practice: "Let false things burn. Choose courage without rushing." },
    { idx: 7, name: "Crown Balance", element: "Aether", freq: "963 Hz", essence: "Completion, justice, centered rule", practice: "Weigh the pattern. Balance mercy, truth, and consequence." },
    { idx: 8, name: "Deep Mirror", element: "Water", freq: "396 Hz", essence: "Reflection, hidden pattern, inner waters", practice: "Look beneath the surface. Journal before judging." },
    { idx: 9, name: "Return Path", element: "Earth", freq: "285 Hz", essence: "Restoration, repentance, spiral home", practice: "Correct course. Repair one broken loop." },
    { idx: 10, name: "Builder’s Hand", element: "Earth", freq: "741 Hz", essence: "Craft, repair, stewardship", practice: "Build, fix, organize, and make the invisible useful." },
    { idx: 11, name: "Star Remembrance", element: "Air", freq: "852 Hz", essence: "Inheritance, names, celestial memory", practice: "Remember names, lineage, signs, and the long story." },
    { idx: 12, name: "River of Signs", element: "Water", freq: "639 Hz", essence: "Movement, omens, living flow", practice: "Track timing. Move with wisdom. Do not force the river." },
    { idx: 13, name: "Completion Seal", element: "Aether", freq: "111 Hz", essence: "Harvest, sealing, preparation for reset", practice: "Close the loop. Harvest the lesson. Prepare the reset." }
  ];

  const DAY_ARCHETYPES = [
    ["Spark", "First ignition. Start, name, begin."],
    ["Witness", "Record what is actually there."],
    ["Breath", "Speak, listen, exchange."],
    ["Root", "Ground the body and home."],
    ["Water", "Feel, cleanse, remember."],
    ["Stone", "Build structure and boundary."],
    ["Fire", "Test, purify, choose courage."],
    ["Gate", "Make a decision or cross a threshold."],
    ["Mirror", "Reflect before reacting."],
    ["Hand", "Repair, craft, serve."],
    ["Voice", "Say the true thing cleanly."],
    ["River", "Move, adapt, follow flow."],
    ["Star", "Remember inheritance and direction."],
    ["Balance", "Weigh, measure, judge fairly."],
    ["Seed", "Plant the next pattern."],
    ["Trial", "Face resistance without panic."],
    ["Mercy", "Release what can be released."],
    ["Sword", "Cut the false attachment."],
    ["Oil", "Consecrate the ordinary."],
    ["Bread", "Receive provision and share it."],
    ["Watch", "Stay awake to timing."],
    ["Return", "Correct course."],
    ["Crown", "Govern the self first."],
    ["Lamp", "Bring light to one dark corner."],
    ["Name", "Recover identity and purpose."],
    ["Field", "Observe relationships."],
    ["Seal", "Close what is complete."],
    ["Rest", "Prepare the reset."]
  ];

  const WEEK_GATES = [
    ["Week 1 · Ignition", "Begin, gather signal, establish the first witness."],
    ["Week 2 · Formation", "Shape the pattern through body, speech, and daily structure."],
    ["Week 3 · Testing", "Watch pressure, resistance, correction, and refinement."],
    ["Week 4 · Sealing", "Harvest the lesson, close loops, and prepare the next moon."]
  ];

  const TZONES = [
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
    "America/Los_Angeles",
    "America/Denver",
    "America/Chicago",
    "America/New_York",
    "UTC"
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  let selectedTZ = localStorage.getItem(TZ_KEY) || TZONES[0];
  let selectedDate = fromISO(new URLSearchParams(location.search).get("date")) || new Date();

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function toISO(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function fromISO(s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function dayDiff(a, b) {
    const A = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const B = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.floor((A - B) / 86400000);
  }

  function fmtDate(d, opts = {}) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: selectedTZ,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      ...opts
    }).format(d);
  }

  function fmtShort(d) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: selectedTZ,
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(d);
  }

  function toast(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
      position: "fixed",
      left: "50%",
      bottom: "22px",
      transform: "translateX(-50%)",
      background: "#0e131c",
      color: "#e6f9ff",
      padding: "9px 13px",
      border: "1px solid #2a3242",
      borderRadius: "12px",
      boxShadow: "0 10px 28px rgba(0,0,0,.35)",
      zIndex: 99999,
      opacity: 0,
      transition: "opacity .2s"
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = 1; });
    setTimeout(() => {
      el.style.opacity = 0;
      setTimeout(() => el.remove(), 250);
    }, 1300);
  }

  function moonAge(date) {
    const synodic = 29.530588853;
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
    const t = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    const days = (t - knownNewMoon) / 86400000;
    return ((days % synodic) + synodic) % synodic;
  }

  function nearestNewMoonAfter(date) {
    let d = new Date(date);
    for (let i = 0; i < 40; i++) {
      const age = moonAge(d);
      const nextAge = moonAge(addDays(d, 1));
      if (age > 28.5 || nextAge < age) return addDays(d, 1);
      d = addDays(d, 1);
    }
    return d;
  }

  function yearAnchorFor(date) {
    const y = date.getFullYear();
    const candidate = nearestNewMoonAfter(new Date(y, 2, 20));
    if (date < candidate) return nearestNewMoonAfter(new Date(y - 1, 2, 20));
    return candidate;
  }

  function remnantInfo(date) {
    const anchor = yearAnchorFor(date);
    const diff = dayDiff(date, anchor);
    const cycleDays = 13 * 28;

    const inside = diff >= 0 && diff < cycleDays;
    const moonIndex = inside ? Math.floor(diff / 28) : 12;
    const dayInMoon = inside ? (diff % 28) + 1 : null;
    const moon = MOONS[moonIndex];

    return {
      anchor,
      diff,
      inside,
      moon,
      moonIndex,
      dayInMoon,
      dayOfYear: diff + 1,
      outsideDay: inside ? 0 : Math.max(1, diff - cycleDays + 1),
      yearEnd: addDays(anchor, cycleDays - 1)
    };
  }

  function phaseName(age) {
    if (age < 1.2 || age > 28.3) return "New Moon";
    if (age < 6.4) return "Waxing Crescent";
    if (age < 8.4) return "First Quarter";
    if (age < 13.8) return "Waxing Gibbous";
    if (age < 16.2) return "Full Moon";
    if (age < 21.6) return "Waning Gibbous";
    if (age < 23.6) return "Last Quarter";
    return "Waning Crescent";
  }

  function illumination(age) {
    return (1 - Math.cos((age / 29.530588853) * Math.PI * 2)) / 2;
  }

  function solarGate(date) {
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const gates = [
      ["Capricorn", "Earth", "Structure, duty, mountain path"],
      ["Aquarius", "Air", "Signal, systems, future current"],
      ["Pisces", "Water", "Dream, compassion, unseen waters"],
      ["Aries", "Fire", "Spark, courage, first motion"],
      ["Taurus", "Earth", "Body, garden, provision"],
      ["Gemini", "Air", "Word, exchange, twin signal"],
      ["Cancer", "Water", "Home, memory, protection"],
      ["Leo", "Fire", "Heart, courage, solar witness"],
      ["Virgo", "Earth", "Order, craft, refinement"],
      ["Libra", "Air", "Balance, justice, relation"],
      ["Scorpio", "Water", "Depth, shadow, transformation"],
      ["Sagittarius", "Fire", "Arrow, journey, higher aim"]
    ];
    const cut = [20, 19, 20, 20, 21, 21, 22, 22, 22, 23, 22, 21];
    const idx = d < cut[m - 1] ? (m + 10) % 12 : (m + 11) % 12;
    return gates[idx];
  }

  function logs() {
    try {
      return JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveLogs(list) {
    localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(0, 300)));
  }

  function drawMoon(age) {
    const canvas = $("#simMoon");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.34;
    const illum = illumination(age);
    const waxing = age < 14.765;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#05070d";
    ctx.fillRect(0, 0, w, h);

    const g = ctx.createRadialGradient(cx, cy, 5, cx, cy, r * 2.3);
    g.addColorStop(0, "rgba(122,243,255,.22)");
    g.addColorStop(.5, "rgba(243,201,122,.10)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = "#121722";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    ctx.fillStyle = "#f4f1e8";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    const shadowWidth = r * 2 * Math.abs(1 - illum * 2);
    ctx.fillStyle = "#121722";
    ctx.beginPath();

    if (illum < .5) {
      ctx.rect(cx - r, cy - r, r * 2, r * 2);
      if (waxing) ctx.ellipse(cx + r, cy, r - shadowWidth / 2, r, 0, Math.PI / 2, Math.PI * 1.5, true);
      else ctx.ellipse(cx - r, cy, r - shadowWidth / 2, r, 0, -Math.PI / 2, Math.PI / 2, true);
      ctx.fill("evenodd");
    } else {
      if (waxing) ctx.ellipse(cx - r, cy, shadowWidth / 2, r, 0, -Math.PI / 2, Math.PI / 2, true);
      else ctx.ellipse(cx + r, cy, shadowWidth / 2, r, 0, Math.PI / 2, Math.PI * 1.5, true);
      ctx.fill();
    }

    ctx.restore();

    ctx.strokeStyle = "rgba(243,201,122,.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(244,241,232,.92)";
    ctx.font = "800 15px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${phaseName(age)} · ${Math.round(illum * 100)}%`, cx, 28);
  }

  function buildSeal(info, age, solar, dayArch, week) {
    const phase = phaseName(age);
    const illum = Math.round(illumination(age) * 100);

    const title = info.inside
      ? `Moon ${info.moon.idx} · Day ${info.dayInMoon} — ${info.moon.name}`
      : `Outside Count — ${info.moon.name}`;

    const body =
`☲ REMNANT DAILY SEAL ☲

${fmtDate(selectedDate)}
${title}

Moon Essence:
${info.moon.essence}

Practice:
${info.moon.practice}

Day Archetype:
${dayArch[0]} — ${dayArch[1]}

Week Gate:
${week[0]} — ${week[1]}

Visible Moon:
${phase} · ${illum}% illuminated

Solar Gate:
${solar[0]} · ${solar[1]}
${solar[2]}

Carrier Tone:
${info.moon.freq} · ${info.moon.element}

Seal:
Observe first.
Record clearly.
Interpret slowly.
Repair one thing.
Carry the witness forward.`;

    $("#sealTitle").textContent = title;
    $("#sealBody").textContent = body;

    $("#promptBody").textContent =
`1. What did my body reveal before my mind explained it?

2. What repeated today: number, word, mood, place, person, animal, weather, or timing?

3. What needs repair, not reaction?

4. What is the one clean action I can take?

5. What should be sealed and released before the next day?`;

    return body;
  }

  function buildWitness() {
    const info = remnantInfo(selectedDate);
    const age = moonAge(selectedDate);
    const solar = solarGate(selectedDate);
    const dayArch = info.inside ? DAY_ARCHETYPES[info.dayInMoon - 1] : ["Outside Count", "Reset, reflection, year threshold."];

    const text =
`Date: ${fmtDate(selectedDate)}
Remnant Moon: ${info.moon.name}
Moon Day: ${info.inside ? `${info.dayInMoon}/28` : `Outside Count · Day ${info.outsideDay}`}
Year Day: ${info.inside ? `${info.dayOfYear}/364` : "Outside counted cycle"}
Visible Moon Phase: ${phaseName(age)} · ${Math.round(illumination(age) * 100)}%
Solar Gate: ${solar[0]} · ${solar[1]}
Day Archetype: ${dayArch[0]}
Carrier Tone: ${info.moon.freq}
Element: ${info.moon.element}
Earth Hum / Kp Status: ${$("#kpInput")?.value || "Unknown / not checked"}

Sleep: ${$("#sleepInput")?.value || ""}
Dreams: ${$("#dreamInput")?.value || ""}
Body Signal: ${$("#bodyInput")?.value || ""}
Emotional Weather: ${$("#emotionInput")?.value || ""}
Repeated Signs: ${$("#signsInput")?.value || ""}
Technology / Animal / Weather Notes: ${$("#fieldInput")?.value || ""}

Action / Lesson:
${$("#lessonInput")?.value || ""}

Witness:
Record first. Interpret later. Compare across 3, 7, 14, and 28 days.`;

    $("#witnessOutput").textContent = text;
    return text;
  }

  function render() {
    const info = remnantInfo(selectedDate);
    const age = moonAge(selectedDate);
    const illum = illumination(age);
    const phase = phaseName(age);
    const solar = solarGate(selectedDate);
    const dayArch = info.inside ? DAY_ARCHETYPES[info.dayInMoon - 1] : ["Outside Count", "Reset, reflection, year threshold."];
    const week = info.inside ? WEEK_GATES[Math.floor((info.dayInMoon - 1) / 7)] : ["Outside Gate", "Days beyond the 364-counted cycle."];

    $("#datePick").value = toISO(selectedDate);
    $("#nowDate").textContent = fmtDate(selectedDate);
    $("#nowTZ").textContent = selectedTZ;

    $("#moonName").textContent = info.moon.name;
    $("#moonEssence").textContent = info.moon.essence;
    $("#moonLine").textContent = info.inside
      ? `Moon ${info.moon.idx} · Day ${info.dayInMoon}/28 · Day ${info.dayOfYear}/364`
      : `Outside Count · Day ${info.outsideDay} after Completion Seal`;
    $("#yearSpan").textContent = `Anchor: ${fmtShort(info.anchor)} · Counted year ends: ${fmtShort(info.yearEnd)}`;
    $("#moonPractice").textContent = info.inside ? info.moon.practice : "Review, repair, clear the ledger, and prepare the next anchor.";

    $("#commandMoon").textContent = info.moon.name;
    $("#commandLine").textContent = info.inside
      ? `Moon ${info.moon.idx} · Day ${info.dayInMoon}/28 · ${info.moon.element} · ${info.moon.freq}`
      : `Outside Count · ${info.moon.name}`;
    $("#statMoonDay").textContent = info.inside ? `${info.dayInMoon}/28` : "Outside";
    $("#statPhase").textContent = phase;
    $("#statSolar").textContent = solar[0];
    $("#statField").textContent = ($("#kpInput")?.value || "Unknown").split("·")[0].trim();
    $("#statLogs").textContent = logs().length;
    $("#statPatterns").textContent = detectPatterns(logs()).count;

    $("#dayInMoon").textContent = info.inside ? info.dayInMoon : "⊙";
    $("#moonLength").textContent = info.inside ? "/28" : "reset";

    const progress = info.inside ? info.dayInMoon / 28 : 1;
    $("#moonArc").style.strokeDashoffset = String(314 - 314 * progress);

    $("#weekDots").innerHTML = Array.from({ length: 28 }, (_, i) => {
      const n = i + 1;
      const cls = !info.inside ? "" : n < info.dayInMoon ? "done" : n === info.dayInMoon ? "today" : "";
      return `<span class="dot ${cls}" title="Day ${n}"></span>`;
    }).join("");

    $("#phaseLine").textContent = `${phase} · ${Math.round(illum * 100)}% illuminated`;
    $("#phaseMeta").textContent = `Approx lunar age: ${age.toFixed(2)} days.`;
    drawMoon(age);

    $("#dayArchetype").textContent = dayArch[0];
    $("#dayArchetypeCopy").textContent = dayArch[1];
    $("#weekGate").textContent = week[0];
    $("#weekGateCopy").textContent = week[1];
    $("#solarGate").textContent = `${solar[0]} · ${solar[1]}`;
    $("#skyMirrorCopy").textContent = solar[2];

    renderClockOnly();
    renderRemnantCalendar(info);
    renderGregorian();
    renderYearMap(info);
    buildSeal(info, age, solar, dayArch, week);
    buildWitness();
    renderSaved();
    renderTimeline();
  }

  function renderRemnantCalendar(info) {
    $("#remCal").innerHTML = Array.from({ length: 28 }, (_, i) => {
      const n = i + 1;
      const cls = info.inside && n === info.dayInMoon ? "today" : "";
      const arch = DAY_ARCHETYPES[i];
      return `<div class="calDay ${cls}">
        <strong>${n}</strong>
        <span>${arch[0]}</span><br>
        <small class="meta">${arch[1]}</small>
      </div>`;
    }).join("");
  }

  function renderGregorian() {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    let html = names.map(n => `<div class="weekday">${n}</div>`).join("");
    for (let i = 0; i < first.getDay(); i++) html += `<div></div>`;

    for (let d = 1; d <= last.getDate(); d++) {
      const cur = new Date(y, m, d);
      const ri = remnantInfo(cur);
      const cls = toISO(cur) === toISO(selectedDate) ? "today" : "";
      html += `<div class="gregDay ${cls}">
        <strong>${d}</strong>
        <span>${ri.inside ? `M${ri.moon.idx} · D${ri.dayInMoon}` : "Outside"}</span><br>
        <small class="meta">${ri.moon.name}</small>
      </div>`;
    }

    $("#gregCal").innerHTML = html;
  }

  function renderYearMap(info) {
    $("#outsideInfo").textContent =
      `Counted cycle: ${fmtShort(info.anchor)} through ${fmtShort(info.yearEnd)} · Outside days begin ${fmtShort(addDays(info.yearEnd, 1))}`;

    $("#yearMapBody").innerHTML = MOONS.map((m, i) => {
      const start = addDays(info.anchor, i * 28);
      const end = addDays(start, 27);
      return `<tr>
        <td>Moon ${m.idx}</td>
        <td>${m.name}</td>
        <td>${m.essence}</td>
        <td>${m.element}</td>
        <td>${m.freq}</td>
        <td>${fmtShort(start)}</td>
        <td>${fmtShort(end)}</td>
        <td>${m.practice}</td>
      </tr>`;
    }).join("");
  }

  function saveLog() {
    const list = logs();
    list.unshift({
      date: toISO(selectedDate),
      moon: remnantInfo(selectedDate).moon.name,
      text: buildWitness(),
      saved: new Date().toISOString(),
      kp: $("#kpInput")?.value || "",
      signs: $("#signsInput")?.value || "",
      body: $("#bodyInput")?.value || "",
      dreams: $("#dreamInput")?.value || "",
      emotion: $("#emotionInput")?.value || ""
    });
    saveLogs(list);
    renderSaved();
    renderTimeline();
    toast("Witness saved");
  }

  function renderSaved() {
    const list = logs();
    $("#statLogs") && ($("#statLogs").textContent = list.length);

    $("#savedList").innerHTML = list.length ? list.map((l, i) => `
      <article class="savedEntry">
        <strong>${l.date} · ${l.moon || "Remnant Log"}</strong>
        <p class="meta">Saved ${new Date(l.saved).toLocaleString()}</p>
        <pre class="fine">${escapeHTML(l.text)}</pre>
        <button class="lab-btn ghost copySaved" data-i="${i}" type="button">Copy</button>
      </article>
    `).join("") : `<p class="meta">No saved logs yet.</p>`;

    $$(".copySaved").forEach(btn => {
      btn.addEventListener("click", () => {
        const item = list[Number(btn.dataset.i)];
        navigator.clipboard.writeText(item.text);
        toast("Copied");
      });
    });
  }

  function detectPatterns(list) {
    const joined = list.slice(0, 28).map(l => [
      l.signs,
      l.body,
      l.dreams,
      l.emotion,
      l.kp
    ].join(" ")).join(" ").toLowerCase();

    const terms = joined.match(/\b[0-9]{2,4}\b|\b[a-z]{4,}\b/g) || [];
    const skip = new Set(["unknown", "checked", "field", "moon", "body", "dreams", "sleep", "weather", "signal"]);
    const counts = {};

    terms.forEach(t => {
      if (skip.has(t)) return;
      counts[t] = (counts[t] || 0) + 1;
    });

    const top = Object.entries(counts)
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return { count: top.length, top };
  }

  function renderTimeline() {
    const list = logs();
    const patterns = detectPatterns(list);

    $("#statPatterns") && ($("#statPatterns").textContent = patterns.count);

    $("#patternAlerts").innerHTML = patterns.top.length ? patterns.top.map(([term, n]) => `
      <article class="mini">
        <h3>${escapeHTML(term)}</h3>
        <p class="meta">Repeated ${n} times in recent logs.</p>
      </article>
    `).join("") : `<p class="meta">No repeated patterns detected yet. Save more daily logs.</p>`;

    $("#timelineList").innerHTML = list.length ? list.slice(0, 28).map(l => `
      <article class="savedEntry">
        <strong>${l.date} · ${escapeHTML(l.moon || "Log")}</strong>
        <p class="meta">${escapeHTML([l.kp, l.signs, l.body].filter(Boolean).join(" · "))}</p>
      </article>
    `).join("") : `<p class="meta">No timeline yet.</p>`;
  }

  function escapeHTML(s) {
    return String(s || "").replace(/[&<>"']/g, m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[m]));
  }

  function renderClockOnly() {
    $("#nowClock").textContent = new Intl.DateTimeFormat("en-US", {
      timeZone: selectedTZ,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date());
  }

  function drawSky() {
    const c = $("#skyBg");
    if (!c) return;
    const ctx = c.getContext("2d");
    let stars = [];

    function fit() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      c.width = innerWidth * dpr;
      c.height = innerHeight * dpr;
      stars = Array.from({ length: 160 }, () => ({
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        r: Math.random() * 1.6 + .25,
        a: Math.random() * Math.PI * 2
      }));
    }

    function loop() {
      ctx.clearRect(0, 0, c.width, c.height);
      stars.forEach(s => {
        s.a += .012;
        ctx.fillStyle = `rgba(244,241,232,${.16 + Math.sin(s.a) * .12})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(loop);
    }

    fit();
    addEventListener("resize", fit, { passive: true });
    loop();
  }

  function setup() {
    $("#yr").textContent = new Date().getFullYear();

    $("#tzPick").innerHTML = TZONES.map(tz => `<option value="${tz}">${tz}</option>`).join("");
    $("#tzPick").value = selectedTZ;
    $("#datePick").value = toISO(selectedDate);

    $$(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.tab;
        $$(".tab").forEach(b => b.classList.toggle("active", b === btn));
        $$(".tabPanel").forEach(p => p.classList.toggle("active", p.id === id));
      });
    });

    $("#tzPick").addEventListener("change", e => {
      selectedTZ = e.target.value;
      localStorage.setItem(TZ_KEY, selectedTZ);
      render();
    });

    $("#datePick").addEventListener("change", e => {
      selectedDate = fromISO(e.target.value) || new Date();
      render();
    });

    $("#btnToday").addEventListener("click", () => {
      selectedDate = new Date();
      render();
    });

    $("#prevDay").addEventListener("click", () => {
      selectedDate = addDays(selectedDate, -1);
      render();
    });

    $("#nextDay").addEventListener("click", () => {
      selectedDate = addDays(selectedDate, 1);
      render();
    });

    $("#shareLink").addEventListener("click", () => {
      const url = `${location.origin}${location.pathname}?date=${toISO(selectedDate)}`;
      navigator.clipboard.writeText(url);
      toast("Link copied");
    });

    ["sleepInput", "bodyInput", "dreamInput", "emotionInput", "signsInput", "kpInput", "fieldInput", "lessonInput"].forEach(id => {
      const el = $("#" + id);
      el.addEventListener("input", buildWitness);
      el.addEventListener("change", () => {
        buildWitness();
        render();
      });
    });

    $("#buildWitness").addEventListener("click", buildWitness);
    $("#copyWitness").addEventListener("click", () => {
      navigator.clipboard.writeText(buildWitness());
      toast("Witness copied");
    });
    $("#saveWitness").addEventListener("click", saveLog);
    $("#clearWitness").addEventListener("click", () => {
      ["sleepInput", "bodyInput", "dreamInput", "emotionInput", "signsInput", "fieldInput", "lessonInput"].forEach(id => $("#" + id).value = "");
      $("#kpInput").selectedIndex = 0;
      buildWitness();
      toast("Cleared");
    });

    $("#copySeal").addEventListener("click", () => {
      navigator.clipboard.writeText($("#sealBody").textContent);
      toast("Seal copied");
    });

    $("#copyAllLogs").addEventListener("click", () => {
      navigator.clipboard.writeText(logs().map(l => l.text).join("\n\n---\n\n"));
      toast("All logs copied");
    });

    $("#exportLogs").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(logs(), null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "remnant-moon-logs.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 800);
    });

    $("#importLogs").addEventListener("click", () => $("#importLogsFile").click());

    $("#importLogsFile").addEventListener("change", async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data)) throw new Error("Invalid log file");
        saveLogs(data.concat(logs()));
        render();
        toast("Logs imported");
      } catch {
        toast("Import failed");
      }
      e.target.value = "";
    });

    $("#clearAllLogs").addEventListener("click", () => {
      if (!confirm("Clear all saved moon logs from this browser?")) return;
      localStorage.removeItem(LOG_KEY);
      render();
      toast("Logs cleared");
    });

    render();
    setInterval(renderClockOnly, 1000);
    drawSky();
  }

  setup();
})();
