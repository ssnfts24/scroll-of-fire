"use strict";

/*
 * Spark companion — the companions page.
 *
 * Two views on one page. Before adoption: the meeting — today's
 * coordinate in Living Time, three short questions, and the Spark
 * the seed builds, with the name its seed speaks; the adopter may
 * add a name of their own, the name it answers to. After adoption:
 * the companion itself — how it has grown, what it has noticed on
 * this device, and what it suggests next.
 *
 * This page is the Spark's home, not its only door: the presence
 * (spark-presence.js) carries the same meeting to wherever a
 * visitor first arrives, as a pop-up with one-tap adoption. The
 * questions here remain as the slower way to meet — they flavour
 * the kind, here as everywhere; they gate nothing.
 *
 * Everything is kept in this browser's local storage. The Life
 * Atlas stack is loaded on this page for one reason only: to read
 * the practice days the visitor has already sealed there, so the
 * Spark's growth counts them. It writes nothing to the Atlas.
 */
(function () {
  const Core = window.SparkCompanion;
  if (!Core) return;

  const $ = (sel) => document.querySelector(sel);

  /* The big art's 3D mount, kept so a re-render lets the old
   * context go before a new one stands. */
  let bigCtrl3d = null;

  function todayCoordinate() {
    if (window.SOFTemporalCursor && typeof window.SOFTemporalCursor.resolvePosition === "function") {
      try {
        const pos = window.SOFTemporalCursor.resolvePosition(new Date());
        if (pos) return pos;
      } catch {
        /* fall through */
      }
    }
    if (window.PatternCalendar) return window.PatternCalendar.fromCivilDate({ date: new Date() });
    return null;
  }

  function civilToday() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function coordinateLine(today) {
    if (!today) return "Today, in Living Time";
    if (today.moon == null) return `Today is the ${today.moonName || "Day Out of Time"}`;
    return `Moon ${today.moon} · Day ${today.day} · Pattern Day ${today.dayOfPatternYear}`;
  }

  function readRecord() {
    try {
      const raw = window.localStorage.getItem(Core.STORAGE_KEY);
      if (!raw) return null;
      const record = JSON.parse(raw);
      return record && Core.parseSeed(record.seed) ? record : null;
    } catch {
      return null;
    }
  }

  function writeRecord(record) {
    try {
      window.localStorage.setItem(Core.STORAGE_KEY, JSON.stringify(record));
    } catch {
      /* the Spark rests */
    }
  }

  async function sensePractice(record) {
    const repo = window.CodexLifeAtlasRepository;
    if (!repo || typeof repo.query !== "function") return record;
    try {
      const sessions = await repo.query({ subtype: "practice-session" });
      let next = record;
      for (const s of Array.isArray(sessions) ? sessions : []) {
        const day = s && s.temporal && s.temporal.patternDay;
        if (Number.isInteger(day) && day >= 1 && day <= 364) {
          next = Core.recordPractice(next, { patternDay: day });
        }
      }
      return next;
    } catch {
      return record;
    }
  }

  /* ---------- the meeting (adoption) ---------- */

  function buildQuestions() {
    const host = $("#spark-questions");
    if (!host) return;
    Core.QUESTIONS.forEach((q, qi) => {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "spark-question";
      const legend = document.createElement("legend");
      legend.textContent = q.ask;
      fieldset.appendChild(legend);
      q.options.forEach((opt, oi) => {
        const label = document.createElement("label");
        label.className = "spark-option";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = `spark-q${qi}`;
        input.value = opt.kind;
        if (oi === 0) input.checked = true;
        label.appendChild(input);
        label.appendChild(document.createTextNode(" " + opt.label));
        fieldset.appendChild(label);
      });
      host.appendChild(fieldset);
    });
  }

  function chosenAnswers() {
    return Core.QUESTIONS.map((_, qi) => {
      const picked = document.querySelector(`input[name="spark-q${qi}"]:checked`);
      return picked ? picked.value : null;
    }).filter(Boolean);
  }

  let pendingSeed = null;
  let audioCtx = null;

  /* The first hello: two soft notes when the Spark is revealed or
   * kept — always in answer to the adopter's own tap, and silent
   * if they have turned the Spark's sounds off. */
  function chirp(companion) {
    try {
      if (window.localStorage.getItem("sof.spark.sound") === "off") return;
    } catch {
      /* keep going */
    }
    const notes = Core.chirpFor(companion);
    if (!notes) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = audioCtx || new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;
      [notes.first, notes.second].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + i * 0.14;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.12, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.36);
      });
    } catch {
      /* silent is fine */
    }
  }

  function previewSpark(today) {
    const kindIndex = Core.resolveKindIndex({
      moon: today ? today.moon : null,
      patternDay: today ? today.dayOfPatternYear : null,
      answers: chosenAnswers()
    });
    pendingSeed = Core.makeSeed({
      moon: today ? today.moon : null,
      patternDay: today ? today.dayOfPatternYear : null,
      kindIndex,
      nonce: Core.randomNonce()
    });
    const companion = Core.generate(pendingSeed);
    const keeper = Core.cleanName($("#spark-name").value);
    const art = $("#spark-preview-art");
    art.innerHTML = Core.renderSVG(companion, { stage: 0 });
    $("#spark-preview-name").textContent = `Its name, from its seed: ${companion.name}`;
    $("#spark-preview-kind").textContent =
      `A ${companion.kindName} Spark — ${companion.temperament}, and ${companion.trait}.`;
    $("#spark-preview-line").textContent = companion.kindLine;
    $("#spark-keep").textContent = `Keep ${keeper || companion.name}`;
    $("#spark-preview").hidden = false;
    chirp(companion);
    return companion;
  }

  function wireMeeting(today) {
    buildQuestions();
    $("#spark-today").textContent = coordinateLine(today);
    $("#spark-meet-button").addEventListener("click", () => previewSpark(today));
    $("#spark-another").addEventListener("click", () => previewSpark(today));
    $("#spark-keep").addEventListener("click", () => {
      if (!pendingSeed) return;
      const record = Core.newRecord({
        seed: pendingSeed,
        name: $("#spark-name").value,
        civilDate: civilToday()
      });
      writeRecord(record);
      /* A Spark kept here ends any wait elsewhere: the ember the
       * pop-up meeting left at the page's edge is for a Spark not
       * yet adopted, and this one just was. */
      try {
        window.localStorage.removeItem(Core.PENDING_KEY);
      } catch {
        /* nothing to clear */
      }
      showCompanion(today);
    });
  }

  /* ---------- the companion view ---------- */

  async function showCompanion(today) {
    let record = readRecord();
    if (!record) return;
    record = Core.recordVisit(record, {
      patternDay: today ? today.dayOfPatternYear : null,
      page: "companions.html"
    });
    record = await sensePractice(record);
    writeRecord(record);

    const companion = Core.generate(record.seed);
    const stage = Core.stageOf(record, companion);
    const name = Core.displayName(record, companion);

    $("#spark-meet").hidden = true;
    const view = $("#spark-companion");
    view.hidden = false;

    const revealed = Core.revealsFor({ record, companion }).revealed;
    $("#spark-big-art").innerHTML = Core.renderSVG(companion, { stage: stage.index, revealed });
    /* Its 3D body stands here at home, where WebGL is to be had —
     * the same seed, the same stage, turning gently. Where it is
     * not, the flat drawing above stands as it always did. */
    if (bigCtrl3d) {
      bigCtrl3d.dispose();
      bigCtrl3d = null;
    }
    if (window.Spark3D) {
      try {
        bigCtrl3d = window.Spark3D.mount($("#spark-big-art"), companion, {
          stage: stage.index,
          px: 190,
          revealed
        });
      } catch {
        bigCtrl3d = null;
      }
      if (bigCtrl3d) $("#spark-big-art").classList.add("has-3d");
    }
    $("#spark-big-name").textContent = name;
    $("#spark-big-kind").textContent =
      `A ${companion.kindName} Spark — ${companion.temperament}, and ${companion.trait}. ${companion.kindLine}`;
    $("#spark-born").textContent =
      companion.birthMoon == null
        ? `Born on the Day Out of Time · Pattern Day ${companion.birthPatternDay}` +
          (record.bornCivil ? ` · ${record.bornCivil}` : "")
        : `Born in Moon ${companion.birthMoon} · Pattern Day ${companion.birthPatternDay}` +
          (record.bornCivil ? ` · ${record.bornCivil}` : "");
    $("#spark-seed-name").textContent =
      record.name && record.name !== companion.name
        ? `Its seed-name is ${companion.name}. ${record.name} is the name it answers to — the name you gave it.`
        : `Its name comes from its seed: the same seed speaks the same name anywhere.`;
    $("#spark-stage").textContent =
      `Stage ${stage.index + 1} of ${Core.STAGES.length}: ${stage.name} — ${stage.points} growth points`;
    const progress = Core.progressOf(record, companion);
    $("#spark-next").textContent = progress.next
      ? `Next: ${progress.next}, at ${progress.nextAt} points — ${progress.toGo} to go. ` +
        `It grows by faithfulness, nothing bought and nothing burned: each day you come back after the first is worth 2, ` +
        `each practice day you seal 3, each new page it sees 1 (up to 10 pages) — at its own pace. ` +
        `So far that is ${record.daysSeen.length} day${record.daysSeen.length === 1 ? "" : "s"} together, ` +
        `${record.pagesSeen.length} page${record.pagesSeen.length === 1 ? "" : "s"} seen, ${record.practiceDays.length} practice day${record.practiceDays.length === 1 ? "" : "s"} sealed.`
      : `The fullest form there is — Ember, Flame, and now Radiant. It keeps growing in company from here.`;
    $("#spark-noticed").textContent =
      `So far, on this device: ${record.daysSeen.length} day${record.daysSeen.length === 1 ? "" : "s"} together, ` +
      `${record.pagesSeen.length} page${record.pagesSeen.length === 1 ? "" : "s"} seen, ` +
      `${record.practiceDays.length} practice day${record.practiceDays.length === 1 ? "" : "s"} sealed.`;
    /* Their rarity, counted from their own draws — never a
     * sticker: the standing, the notable traits with their
     * odds, and the marks of their birth and life, in the same
     * words their panel and their share card carry. */
    const rarity = Core.rarityFor({ record, companion });
    $("#spark-rarity").textContent = rarity
      ? `Standing: ${rarity.line} ` +
        rarity.traits.map((t) => t.line).join(" ") +
        (rarity.specials.length ? " " + rarity.specials.map((s) => s.line).join(" ") : "")
      : "";

    const guide = Core.guidanceFor({
      record,
      companion,
      todayPatternDay: today ? today.dayOfPatternYear : null
    });
    $("#spark-guide").textContent = guide.text;
    const go = $("#spark-guide-link");
    if (guide.href) {
      go.href = guide.href;
      go.hidden = false;
    } else {
      go.hidden = true;
    }

    const rename = $("#spark-rename");
    rename.value = record.name || "";
    $("#spark-rename-button").onclick = () => {
      const updated = { ...record, name: Core.cleanName(rename.value) };
      writeRecord(updated);
      showCompanion(today);
    };

    const leave = $("#spark-leave");
    leave.textContent = `Let ${name} go`;
    leave.onclick = () => {
      if (leave.dataset.armed) {
        try {
          window.localStorage.removeItem(Core.STORAGE_KEY);
        } catch {
          /* nothing to clear */
        }
        window.location.reload();
      } else {
        leave.dataset.armed = "1";
        leave.textContent = `Tap again to let ${name} go — this cannot be undone`;
      }
    };
  }

  function start() {
    const today = todayCoordinate();
    if (readRecord()) {
      showCompanion(today);
    } else {
      $("#spark-meet").hidden = false;
      wireMeeting(today);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
