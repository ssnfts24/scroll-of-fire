/*
 * Walking the Long Line — Genesis 5 as a walkable timeline.
 *
 * The genealogy of Genesis 5 drawn to scale: ten lives from Adam to
 * Noah, each bar as long as the chapter says the life was, so the
 * spans can be felt — Methuselah's 969 against the short lines.
 * The visitor walks the line (drag, scroll, or the Walk on button),
 * opens stations, runs the count of years from Adam with their own
 * hand, compares two lives, and answers the Spark's finding
 * questions by going to the place on the line — never by picking
 * from a list. A correct find lights the station; a miss only
 * invites another look. There is no score and nothing to lose.
 *
 * All figures are the chapter's own, as this site's Genesis 5 page
 * carries them (Hebrew / Masoretic numbers, English: WEB). Enoch's
 * 365 is presented with its three readings side by side, each under
 * its own label; the page takes no side.
 *
 * The walk is remembered in one small local record — stations
 * visited, finds made, the count's place — and a returning visitor
 * is welcomed back to their place. Nothing leaves the device.
 */
(function () {
  "use strict";

  /* ---------------- the line, as the chapter gives it ----------------
   * at:    age when the named child was born
   * after: years lived after that birth
   * total: all the days of the life (at + after)
   * Noah's total is null: Genesis 5 gives his age at his sons' birth
   * and does not close his count (that comes in Genesis 9). */
  const LINE = [
    { name: "Adam", child: "Seth", at: 130, after: 800, total: 930, ref: "Genesis 5:3–5" },
    { name: "Seth", child: "Enosh", at: 105, after: 807, total: 912, ref: "Genesis 5:6–8" },
    { name: "Enosh", child: "Kenan", at: 90, after: 815, total: 905, ref: "Genesis 5:9–11" },
    { name: "Kenan", child: "Mahalalel", at: 70, after: 840, total: 910, ref: "Genesis 5:12–14" },
    { name: "Mahalalel", child: "Jared", at: 65, after: 830, total: 895, ref: "Genesis 5:15–17" },
    { name: "Jared", child: "Enoch", at: 162, after: 800, total: 962, ref: "Genesis 5:18–20" },
    { name: "Enoch", child: "Methuselah", at: 65, after: 300, total: 365, ref: "Genesis 5:21–24",
      words: "“Enoch walked with God, and he was not found, for God took him.” — Genesis 5:24" },
    { name: "Methuselah", child: "Lamech", at: 187, after: 782, total: 969, ref: "Genesis 5:25–27" },
    { name: "Lamech", child: "Noah", at: 182, after: 595, total: 777, ref: "Genesis 5:28–31" },
    { name: "Noah", child: "Shem, Ham, and Japheth", at: 500, after: null, total: null, ref: "Genesis 5:32",
      words: "The chapter gives Noah's age when his sons are born — five hundred years — and leaves his count open. His full years are told later, in Genesis 9." }
  ];
  /* Birth year of each station, counted from Adam's birth. */
  LINE.forEach((s, i) => {
    s.born = i === 0 ? 0 : LINE[i - 1].born + LINE[i - 1].at;
  });
  const SPAN_YEARS = LINE[LINE.length - 1].born + LINE[LINE.length - 1].at; /* 1556 */

  /* The Spark's finding questions — answered by going to the place
   * on the line, never by choosing from a list. */
  const QUESTIONS = [
    {
      id: "longest", target: "Methuselah",
      ask: "Walk with me. First, a finding: who lived the longest? Go to their station on the line.",
      found: "You found it — Methuselah, 969 years. The longest life in the chapter; his line outruns every other on the walk."
    },
    {
      id: "yearmatch", target: "Enoch",
      ask: "Next finding: whose years match the year itself? Find the life that counts 365.",
      found: "You found it — Enoch, 365 years: the count of the days in a year, sitting on the one man the chapter says was taken. Why it sits there is an open question — the three readings stand below, and this page takes no side."
    },
    {
      id: "shrinking", target: "Lamech",
      ask: "Last finding: where do the years start shrinking? Find where the long lives first take a wide step down.",
      found: "You found it — Lamech. After Methuselah's peak of 969, Lamech's life falls to 777: the first wide step down. The fuller shrinking comes later, after the flood. (Enoch's 365 is shorter still, but the chapter says he was taken — a different kind of short.)"
    }
  ];

  const STORAGE_KEY = "sof.genesis5.walk.v1";
  const PX_PER_YEAR = 1.6;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function loadRecord() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { visited: [], found: [], countStep: 0, welcomed: false };
      const r = JSON.parse(raw);
      return {
        visited: Array.isArray(r.visited) ? r.visited : [],
        found: Array.isArray(r.found) ? r.found : [],
        countStep: Number.isInteger(r.countStep) ? r.countStep : 0,
        welcomed: !!r.welcomed
      };
    } catch { return { visited: [], found: [], countStep: 0, welcomed: false }; }
  }
  function saveRecord() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch { /* the walk still walks */ }
  }

  const record = loadRecord();
  const returning = record.visited.length > 0 || record.found.length > 0 || record.countStep > 0;
  let selected = null;

  /* ---------------- today's coordinate (canonical calendar) ---------------- */
  function todayContext() {
    const calendar = globalThis.PatternCalendar;
    if (!calendar || typeof calendar.fromCivilDate !== "function") return null;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const get = (t) => (parts.find((p) => p.type === t) || {}).value;
    if (!get("year")) return null;
    const iso = `${get("year")}-${get("month")}-${get("day")}`;
    const summary = calendar.fromCivilDate({ date: iso, timeZone, boundaryMode: "midnight" });
    const civil = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
    if (summary.insideCountedYear) {
      return {
        dayLine: `Moon ${summary.moon} · ${summary.moonName} · Day ${summary.day} · Pattern Day ${summary.dayOfPatternYear}`,
        civilLine: civil
      };
    }
    return { dayLine: `${summary.moonName} · Pattern Year ${summary.patternYear}`, civilLine: civil };
  }

  /* ---------------- helpers ---------------- */
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString("en-US");
  function activeQuestion() {
    return QUESTIONS.find((q) => !record.found.includes(q.id)) || null;
  }
  function stationByName(name) { return LINE.find((s) => s.name === name); }

  /* ---------------- the Spark's line ---------------- */
  function sparkSay(html) {
    const el = $("g5-spark-line");
    if (el) el.innerHTML = html;
  }
  function defaultSparkLine() {
    const q = activeQuestion();
    if (q) { sparkSay(q.ask); return; }
    const next = LINE.find((s) => !record.visited.includes(s.name));
    if (next) {
      sparkSay(`Every finding is yours. Walk on when you're ready — ${next.name}'s station is still unopened.`);
    } else {
      sparkSay("You've walked the whole line, Adam to Noah — 1,556 years of it. The three readings at the foot of the page are the open door from here.");
    }
  }

  /* ---------------- building the line ---------------- */
  function buildTrack() {
    const inner = $("g5-track-inner");
    if (!inner) return;
    inner.style.width = `${Math.round(SPAN_YEARS * PX_PER_YEAR) + 130}px`;
    /* century guides */
    const guides = document.createElement("div");
    guides.className = "g5-guides";
    guides.setAttribute("aria-hidden", "true");
    for (let y = 0; y <= SPAN_YEARS; y += 100) {
      const g = document.createElement("span");
      g.className = "g5-guide";
      g.style.left = `${Math.round(y * PX_PER_YEAR)}px`;
      g.textContent = y === 0 ? "Adam born · year 0" : `${fmt(y)}`;
      guides.appendChild(g);
    }
    inner.appendChild(guides);

    LINE.forEach((s, i) => {
      const row = document.createElement("div");
      row.className = "g5-row";
      const bar = document.createElement("div");
      bar.className = "g5-bar" + (s.name === "Enoch" ? " g5-bar-enoch" : "") + (s.total === null ? " g5-bar-open" : "");
      bar.style.left = `${Math.round(s.born * PX_PER_YEAR)}px`;
      const barYears = s.total === null ? s.at : s.total;
      bar.style.width = `${Math.max(26, Math.round(barYears * PX_PER_YEAR))}px`;
      bar.title = s.total === null
        ? `${s.name}: born at year ${fmt(s.born)}; ${fmt(s.at)} years old when his sons are born — the chapter leaves his count open`
        : `${s.name}: ${fmt(s.total)} years (born at year ${fmt(s.born)} of the count)`;
      const marker = document.createElement("span");
      marker.className = "g5-bar-child";
      marker.style.left = `${Math.round(s.at * PX_PER_YEAR)}px`;
      marker.title = `${s.child} born — ${s.name} is ${fmt(s.at)}`;
      bar.appendChild(marker);
      row.appendChild(bar);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "g5-station";
      btn.dataset.name = s.name;
      btn.style.left = `${Math.round(s.born * PX_PER_YEAR)}px`;
      btn.setAttribute("aria-label", `Open ${s.name}'s station`);
      btn.innerHTML = `<span class="g5-station-dot" aria-hidden="true"></span><span class="g5-station-name">${s.name}</span><span class="g5-station-years">${s.total === null ? `${fmt(s.at)} at his sons' birth` : `${fmt(s.total)} years`}</span>`;
      btn.addEventListener("click", () => openStation(s.name, { fromTap: true }));
      row.appendChild(btn);
      inner.appendChild(row);
      s._btn = btn;
      s._bar = bar;
      void i;
    });

    /* the walker — the Spark's place on the line, following the walk */
    const walker = document.createElement("div");
    walker.className = "g5-walker";
    walker.id = "g5-walker";
    walker.setAttribute("aria-hidden", "true");
    inner.appendChild(walker);
  }

  function refreshStationStates() {
    LINE.forEach((s) => {
      if (!s._btn) return;
      s._btn.classList.toggle("g5-visited", record.visited.includes(s.name));
      const foundQ = QUESTIONS.find((q) => q.target === s.name && record.found.includes(q.id));
      s._btn.classList.toggle("g5-found", !!foundQ);
      if (s._bar) s._bar.classList.toggle("g5-bar-found", !!foundQ);
      s._btn.classList.toggle("g5-selected", selected === s.name);
    });
  }

  /* ---------------- the station card ---------------- */
  function openStation(name, opts) {
    const s = stationByName(name);
    if (!s) return;
    selected = name;
    if (!record.visited.includes(name)) { record.visited.push(name); saveRecord(); }

    const card = $("g5-card");
    const title = $("g5-card-title");
    const body = $("g5-card-body");
    if (card && title && body) {
      title.textContent = s.name;
      let html = "";
      html += `<p class="g5-card-figs">Born at year <strong>${fmt(s.born)}</strong> of the count from Adam. `;
      if (s.total === null) {
        html += `He was <strong>${fmt(s.at)} years old</strong> when ${s.child} were born — and the chapter leaves his count open there.</p>`;
      } else {
        html += `He was <strong>${fmt(s.at)} years old</strong> when ${s.child} was born, lived <strong>${fmt(s.after)} years</strong> after, and all his days were <strong>${fmt(s.total)} years</strong>.</p>`;
      }
      if (s.words) html += `<p class="g5-card-words">${s.words}</p>`;
      html += `<p class="g5-card-ref">As the chapter gives it: ${s.ref} — <a href="scripture/genesis/05.html">read Genesis 5 itself</a>.</p>`;
      if (s.name === "Enoch") {
        html += `<div class="g5-yearmatch">
          <p><strong>His whole life is 365 years — the count of a year.</strong> Lay the year beside him and the two ends meet:</p>
          <div class="g5-match" aria-hidden="true">
            <div class="g5-match-row"><span class="g5-match-label">Enoch's life</span><span class="g5-match-bar" style="width:100%"></span><span class="g5-match-num">365</span></div>
            <div class="g5-match-row"><span class="g5-match-label">One year</span><span class="g5-match-bar g5-match-bar-year" style="width:100%"></span><span class="g5-match-num">365</span></div>
          </div>
          <p>Three readings of that match stand at the foot of this page — <a href="#g5-readings">coincidence, literary symbolism, calendrical practice</a> — each under its own label. This page takes no side.</p>
        </div>`;
      }
      if (s.name === "Methuselah") {
        html += `<p class="g5-card-note">The longest life in the chapter. Lay the count out and his years run past his son Lamech's whole life — by the chapter's numbers he was still living when Noah was born.</p>`;
      }
      body.innerHTML = html;
      card.hidden = false;
    }

    /* the finding game: a tap answers by finding */
    if (opts && opts.fromTap) {
      const q = activeQuestion();
      if (q) {
        if (q.target === name) {
          record.found.push(q.id);
          saveRecord();
          sparkSay(q.found);
        } else if (q.id === "shrinking" && name === "Enoch") {
          sparkSay("Enoch's short life has its own story — the chapter says he was taken, not that he faded. Look for where the long line itself steps down, after its peak.");
        } else {
          const ti = LINE.indexOf(stationByName(q.target));
          const mi = LINE.indexOf(s);
          sparkSay(mi < ti
            ? "Not there — look further along the line."
            : "Not there — look earlier in the line.");
        }
      } else {
        defaultSparkLine();
      }
    }
    refreshStationStates();
    updateFindings();
  }

  function updateFindings() {
    const el = $("g5-finds");
    if (!el) return;
    el.innerHTML = QUESTIONS.map((q) => {
      const done = record.found.includes(q.id);
      return `<li class="${done ? "g5-find-done" : ""}"><span aria-hidden="true">${done ? "✦" : "·"}</span> ${done ? `Found: ${q.target}` : "Still to find — the Spark's question stands above."}</li>`;
    }).join("");
  }

  /* ---------------- the count ---------------- */
  function countTotal(step) {
    let t = 0;
    for (let i = 0; i < step && i < LINE.length; i++) t += LINE[i].at;
    return t;
  }
  function renderCount() {
    const step = record.countStep;
    const total = countTotal(step);
    const num = $("g5-count-num");
    const label = $("g5-count-label");
    const btn = $("g5-count-btn");
    if (num) num.textContent = fmt(total);
    if (label) {
      if (step === 0) label.textContent = "The count stands at Adam's birth. Add the first span.";
      else if (step < LINE.length) {
        const s = LINE[step - 1];
        label.textContent = `${s.child} is born to ${s.name} — ${fmt(total)} years from Adam.`;
      } else {
        label.textContent = `Noah's sons are born — ${fmt(total)} years from Adam. The count of the chapter stands complete.`;
      }
    }
    if (btn) {
      btn.disabled = step >= LINE.length;
      btn.textContent = step >= LINE.length ? "The count stands complete" : "Count the next birth";
    }
  }
  function advanceCount() {
    if (record.countStep >= LINE.length) return;
    record.countStep += 1;
    saveRecord();
    renderCount();
    const s = LINE[record.countStep - 1];
    if (s.child === "Enoch") {
      sparkSay("Enoch is born — year 622 of the count. Walk to his station when you reach it: his whole life will hold a number worth stopping for.");
    }
  }

  /* ---------------- comparing two lives ---------------- */
  function renderCompare() {
    const a = stationByName($("g5-cmp-a").value);
    const b = stationByName($("g5-cmp-b").value);
    const out = $("g5-cmp-out");
    if (!a || !b || !out) return;
    const years = (s) => (s.total === null ? s.at : s.total);
    const phrase = (s) => (s.total === null
      ? `${s.name} was ${fmt(s.at)} when his sons were born (the chapter leaves his total open)`
      : `${s.name} lived ${fmt(s.total)} years`);
    if (a.name === b.name) {
      out.textContent = `${phrase(a)} — pick a second life to set beside it.`;
      return;
    }
    const diff = Math.abs(years(a) - years(b));
    const longer = years(a) > years(b) ? a : b;
    out.textContent = diff === 0
      ? `${phrase(a)}; ${phrase(b)}. The two lives match, year for year.`
      : `${phrase(a)}; ${phrase(b)}. ${longer.name}'s span is longer by ${fmt(diff)} years.`;
  }

  /* ---------------- walking: drag + walker ---------------- */
  function initWalk() {
    const wrap = $("g5-track-wrap");
    const inner = $("g5-track-inner");
    if (!wrap || !inner) return;
    let raf = 0;
    const placeWalker = () => {
      raf = 0;
      const walker = $("g5-walker");
      if (!walker) return;
      const centreYear = (wrap.scrollLeft + wrap.clientWidth / 2) / PX_PER_YEAR;
      walker.style.transform = `translateX(${Math.round(centreYear * PX_PER_YEAR)}px)`;
      const yearEl = $("g5-walk-year");
      if (yearEl) yearEl.textContent = `You are walking at year ${fmt(Math.max(0, Math.round(centreYear)))} of the count`;
    };
    wrap.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(placeWalker); }, { passive: true });
    placeWalker();

    /* drag to scroll (mouse + pen); touch keeps its native glide */
    let dragging = false, startX = 0, startScroll = 0, moved = false;
    wrap.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") return;
      dragging = true; moved = false;
      startX = e.clientX; startScroll = wrap.scrollLeft;
    });
    wrap.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      wrap.scrollLeft = startScroll - dx;
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((t) =>
      wrap.addEventListener(t, () => { dragging = false; }));
    /* a drag that moved shouldn't also open the station it ended on */
    wrap.addEventListener("click", (e) => {
      if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
    }, true);

    const walkBtn = $("g5-walk-btn");
    if (walkBtn) {
      walkBtn.addEventListener("click", () => {
        const next = LINE.find((s) => !record.visited.includes(s.name)) || LINE[LINE.length - 1];
        const target = Math.max(0, Math.round(next.born * PX_PER_YEAR) - 24);
        wrap.scrollTo({ left: target, behavior: reducedMotion ? "auto" : "smooth" });
        openStation(next.name, { fromTap: false });
      });
    }
  }

  /* ---------------- boot ---------------- */
  function init() {
    const today = todayContext();
    const dayEl = $("g5-dayline");
    const civilEl = $("g5-civil");
    if (dayEl && today) dayEl.textContent = today.dayLine;
    if (civilEl && today) civilEl.textContent = today.civilLine;

    buildTrack();
    refreshStationStates();
    updateFindings();
    renderCount();

    const countBtn = $("g5-count-btn");
    if (countBtn) countBtn.addEventListener("click", advanceCount);
    const countReset = $("g5-count-reset");
    if (countReset) countReset.addEventListener("click", () => {
      record.countStep = 0; saveRecord(); renderCount();
    });

    const cmpA = $("g5-cmp-a"), cmpB = $("g5-cmp-b");
    if (cmpA && cmpB) {
      LINE.forEach((s) => {
        cmpA.appendChild(new Option(s.name, s.name));
        cmpB.appendChild(new Option(s.name, s.name));
      });
      cmpA.value = "Methuselah"; cmpB.value = "Enoch";
      cmpA.addEventListener("change", renderCompare);
      cmpB.addEventListener("change", renderCompare);
      renderCompare();
    }

    initWalk();

    if (returning && !record.welcomed) {
      record.welcomed = true; saveRecord();
      const opened = record.visited.length;
      sparkSay(`Welcome back — I kept your place on the line. You've opened ${opened} of the ten stations${record.found.length ? ` and made ${record.found.length} of the findings` : ""}. Walk on whenever you're ready.`);
    } else {
      defaultSparkLine();
    }
    /* open Adam's station as the doorway in, without counting it a find */
    openStation("Adam", { fromTap: false });
    if (!returning) defaultSparkLine();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
