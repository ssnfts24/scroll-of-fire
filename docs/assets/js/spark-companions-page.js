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

  /* The Spark's day is the page's day (pass 8): the device's
   * timezone at a midnight boundary, as the page's own panels
   * resolve it — never the cursor's sunset default or the
   * calendar's UTC default, which roll the day forward early. */
  function todayCoordinate() {
    let timeZone = "UTC";
    try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { /* UTC stands */ }
    if (window.SOFTemporalCursor && typeof window.SOFTemporalCursor.resolvePosition === "function") {
      try {
        const pos = window.SOFTemporalCursor.resolvePosition(new Date(), { timeZone, boundaryMode: "midnight" });
        if (pos) return pos;
      } catch {
        /* fall through */
      }
    }
    if (window.PatternCalendar) return window.PatternCalendar.fromCivilDate({ date: new Date(), timeZone, boundaryMode: "midnight" });
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

  /* An adoption made inside the app is handed home in the
   * same breath, through the door the rooms use. */
  function handRecordUp(record) {
    try {
      const b = window.LivingPhoneNative;
      if (!b || typeof b.sparkRecordFromWeb !== "function") return;
      b.sparkRecordFromWeb(JSON.stringify(record));
    } catch {
      /* the room's settle hands it up at the next opening */
    }
  }

  /* The Mint Rule (Aaron, Nov 25, 2026): a Spark is minted
   * once — when one stands, no new one is introduced. Inside
   * the Spark. Living Day app the record's home is the app's
   * native store and this page's local storage is its mirror,
   * so before the meeting is offered, ask the app's bridge
   * what stands at home. On the open web there is no bridge,
   * and this reads nothing and changes nothing. */
  function readBridgedRecord() {
    try {
      const b = window.LivingPhoneNative;
      if (!b || typeof b.sparkRecordJson !== "function") return null;
      const raw = b.sparkRecordJson();
      if (!raw) return null;
      const record = JSON.parse(raw);
      return record && Core.parseSeed(record.seed) ? record : null;
    } catch {
      return null;
    }
  }

  /* The home-first settle, mirrored from spark-presence.js
   * (the Mint Rule, aboard the app): a record read from the
   * mirror is settled against home before it is presented —
   * a different seed at home settles the mirror down from
   * home; the seed home names as let go clears the mirror;
   * same seed, or no bridge, leaves the grown record. */
  function settleFromHome(record) {
    if (!record) return record;
    const home = readBridgedRecord();
    if (home) {
      if (home.seed === record.seed) return record;
      writeRecord(home);
      return home;
    }
    try {
      const b = window.LivingPhoneNative;
      const gone = b && typeof b.sparkLetGoSeed === "function"
        ? b.sparkLetGoSeed() : "";
      if (gone && gone === record.seed) {
        try { window.localStorage.removeItem(Core.STORAGE_KEY); } catch { /* the read still stands */ }
        return null;
      }
    } catch { /* the mirror read stands */ }
    return record;
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

  /* One soft tone, in the same spirit as the chirp: a sine at
   * the pad's own frequency, played only in answer to a tap,
   * and silent when the Spark's sounds are turned off. */
  function playTone(freq, delay = 0, dur = 0.34) {
    try {
      if (window.localStorage.getItem("sof.spark.sound") === "off") return;
    } catch {
      /* keep going */
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = audioCtx || new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const start = audioCtx.currentTime + delay;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    } catch {
      /* silent is fine */
    }
  }

  /* A happy bounce on the art, in place — the same answer a tap
   * gets everywhere a Spark stands. */
  function bounce(el) {
    if (!el) return;
    el.classList.remove("spark-bounce");
    void el.offsetWidth;
    el.classList.add("spark-bounce");
  }

  function buildPads(host, pads, onTap) {
    if (!host) return [];
    host.innerHTML = "";
    return pads.map((pad, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "spark-echo-pad";
      b.style.setProperty("--echo-pad", pad.color);
      b.setAttribute("aria-label", `Tone ${i + 1}`);
      b.addEventListener("click", () => {
        lightPad(b);
        onTap(i);
      });
      host.appendChild(b);
      return b;
    });
  }

  function lightPad(el, ms = 420) {
    if (!el) return;
    el.classList.add("is-lit");
    window.setTimeout(() => el.classList.remove("is-lit"), ms);
  }

  /* Find-the-tone, at the meeting: the Spark sings one of its
   * four tones; the keeper taps the pad that sang it. A small
   * first game, played before any keeping — meeting by doing. */
  let toneGame = null;
  function wireToneGame(companion) {
    const host = $("#spark-tone-pads");
    const status = $("#spark-tone-status");
    if (!host || !companion) return;
    const { pads } = Core.echoFor({ companion, round: 1 });
    const target = Core.hashString(`${companion.seed}:tone-meet`) % pads.length;
    toneGame = { companion, pads, target, found: false };
    const padEls = buildPads(host, pads, (i) => {
      if (!toneGame) return;
      playTone(toneGame.pads[i].note);
      if (i === toneGame.target) {
        if (!toneGame.found) {
          toneGame.found = true;
          if (status) status.textContent = Core.convoLineFor({ companion, beat: "caught" });
          const speech = $("#spark-preview-speech");
          if (speech) speech.textContent = Core.convoLineFor({ companion, beat: "play" });
        }
      } else if (status) {
        status.textContent = "Not that one — play its tone again and listen once more.";
      }
    });
    const play = $("#spark-tone-play");
    if (play) {
      play.onclick = () => {
        if (!toneGame) return;
        playTone(toneGame.pads[toneGame.target].note);
        lightPad(padEls[toneGame.target]);
      };
    }
    if (status) status.textContent = "";
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
    /* The meeting is played, not just read: the preview answers
     * a tap, and its tone can be found by ear before any keeping. */
    wireToneGame(companion);
    const speech = $("#spark-preview-speech");
    if (speech) speech.textContent = "";
    if (art) {
      art.onclick = () => {
        bounce(art);
        chirp(companion);
        if (speech) speech.textContent = Core.convoLineFor({ companion, beat: "pet" });
      };
    }
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
      handRecordUp(record);
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

  /* The echo game, at home with its keeper: the Spark sings a
   * short sequence on its four pads and the keeper sings it
   * back. Rounds grow one note at a time; a finished round is
   * counted in the record's play, the way the presence counts
   * it, so the tricks play teaches can be learned here too. */
  let echoGame = null;
  function wireEchoGame(companion) {
    const host = $("#spark-echo-pads");
    const status = $("#spark-echo-status");
    const start = $("#spark-echo-start");
    if (!host || !start || !companion) return;
    echoGame = { companion, round: 1, pads: [], steps: [], heard: [], playing: false };
    const padEls = buildPads(host, Core.echoFor({ companion, round: 1 }).pads, (i) => {
      if (!echoGame || echoGame.playing || !echoGame.steps.length) return;
      playTone(echoGame.pads[i].note);
      echoGame.heard.push(i);
      const at = echoGame.heard.length - 1;
      if (echoGame.heard[at] !== echoGame.steps[at]) {
        if (status) status.textContent = Core.convoLineFor({ companion, beat: "echoMiss" });
        echoGame.heard = [];
        return;
      }
      if (echoGame.heard.length === echoGame.steps.length) {
        const doneRound = echoGame.round;
        const fresh = readRecord();
        if (fresh) writeRecord(Core.recordPlay(fresh, { action: "echo", round: doneRound }).record);
        if (status) status.textContent = Core.convoLineFor({ companion, beat: "echoWin" });
        echoGame.round = doneRound + 1;
        echoGame.steps = [];
        echoGame.heard = [];
        start.textContent = `Sing round ${echoGame.round}`;
      }
    });
    start.onclick = () => {
      if (!echoGame) return;
      const round = Core.echoFor({ companion, round: echoGame.round });
      echoGame.pads = round.pads;
      echoGame.steps = round.steps;
      echoGame.heard = [];
      echoGame.playing = true;
      if (status) status.textContent = Core.convoLineFor({ companion, beat: "echoStart" });
      round.steps.forEach((padIndex, i) => {
        playTone(round.pads[padIndex].note, 0.25 + i * 0.42, 0.3);
        window.setTimeout(() => lightPad(padEls[padIndex], 300), 250 + i * 420);
      });
      window.setTimeout(() => {
        if (echoGame) echoGame.playing = false;
      }, 350 + round.steps.length * 420);
    };
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
    $("#spark-big-art").innerHTML = Core.renderSVG(companion, { stage: stage.index, revealed, wrap: Core.wrapFor(record) });
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
          revealed,
          wrap: Core.wrapFor(record)
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
    /* The long path (Aaron, Nov 26, 2026): the smaller stages
     * between the great arcs, generated from this Spark's own
     * seed — growth felt often, not four times in a life. */
    if (Core.pathOf) {
      const path = Core.pathOf(record, companion);
      $("#spark-stage").textContent +=
        ` On its long path: stage ${path.index + 1} of ${path.count} — ${path.name}, within the ${path.arc} arc` +
        (path.next ? `; next is ${path.next}, ${path.toGo} point${path.toGo === 1 ? "" : "s"} on.` : `. The path's summit — it stands there now.`);
    }
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

    /* A tap on the big art is a pet — counted the way the core
     * counts play, answered with a bounce, its chirp, and a
     * line in its own voice. */
    const bigArt = $("#spark-big-art");
    if (bigArt) {
      bigArt.onclick = () => {
        const fresh = readRecord();
        if (!fresh) return;
        const result = Core.recordPlay(fresh, { action: "pet" });
        writeRecord(result.record);
        bounce(bigArt);
        chirp(companion);
        const speech = $("#spark-big-speech");
        if (speech) {
          speech.textContent = result.learned && result.learned.length
            ? Core.convoLineFor({ companion, beat: "learned" })
            : Core.convoLineFor({ companion, beat: "pet" });
        }
      };
    }
    wireEchoGame(companion);

    const rename = $("#spark-rename");
    rename.value = record.name || "";
    $("#spark-rename-button").onclick = () => {
      const updated = { ...record, name: Core.cleanName(rename.value) };
      writeRecord(updated);
      showCompanion(today);
    };

    wireLeave(record, name);
  }

  /* The Mint Rule's other half: a Spark is never let go by
   * accident. The old road was two taps on one button — a
   * double-tap could end a Spark. The road now is a panel
   * that says plainly what letting go means, and a final
   * button that wakes only when the keeper types the Spark's
   * own name. Keeping the Spark is one tap, always offered. */
  function wireLeave(record, name) {
    const leave = $("#spark-leave");
    leave.textContent = `Let ${name} go`;
    let panel = null;
    leave.onclick = () => {
      if (panel) {
        panel.remove();
        panel = null;
        return;
      }
      panel = document.createElement("div");
      panel.className = "spark-leave-panel";
      const days = Array.isArray(record.daysSeen) ? record.daysSeen.length : 0;
      const words = document.createElement("p");
      words.textContent =
        `Letting go is for good. ${name} will be gone — its name, ` +
        `its kind, the ${days} day${days === 1 ? "" : "s"} you have ` +
        `seen together, everything it has learned. A Spark is ` +
        `minted once: this cannot be undone, and ${name} cannot ` +
        `be brought back.`;
      panel.appendChild(words);
      const label = document.createElement("label");
      label.className = "spark-leave-label";
      label.textContent = `Type ${name} to let it go`;
      const input = document.createElement("input");
      input.type = "text";
      input.autocomplete = "off";
      input.maxLength = 24;
      label.appendChild(input);
      panel.appendChild(label);
      const actions = document.createElement("div");
      actions.className = "spark-leave-actions";
      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.className = "spark-button danger";
      confirm.textContent = `Let ${name} go for good`;
      confirm.disabled = true;
      input.addEventListener("input", () => {
        confirm.disabled =
          input.value.trim().toLowerCase() !== name.toLowerCase();
      });
      confirm.addEventListener("click", () => {
        try {
          window.localStorage.removeItem(Core.STORAGE_KEY);
        } catch {
          /* nothing to clear */
        }
        /* The release is complete in one step (cross-surface
         * correlation audit, Nov 27, 2026): the Whole Record
         * this Spark carried on this surface goes with it —
         * it does not linger in storage to be overwritten by
         * the next refresh, and the linked flag clears too.
         * The record itself is the keeper's: it stands whole
         * wherever else their Spark lives (app, game, code). */
        try {
          const Whole = window.SparkWholeRecord;
          if (Whole && Whole.RECORD_KEY) window.localStorage.removeItem(Whole.RECORD_KEY);
          if (Whole && Whole.LINKED_KEY) window.localStorage.removeItem(Whole.LINKED_KEY);
        } catch {
          /* nothing to clear */
        }
        try {
          window.localStorage.removeItem(Core.PENDING_KEY);
        } catch {
          /* nothing to clear */
        }
        window.location.reload();
      });
      const keep = document.createElement("button");
      keep.type = "button";
      keep.className = "spark-button";
      keep.textContent = `Keep ${name}`;
      keep.addEventListener("click", () => {
        panel.remove();
        panel = null;
      });
      actions.appendChild(confirm);
      actions.appendChild(keep);
      panel.appendChild(actions);
      leave.after(panel);
      input.focus();
    };
  }

  function start() {
    const today = todayCoordinate();
    let record = settleFromHome(readRecord());
    if (!record) {
      /* The Mint Rule: inside the app, prove nothing stands
       * at home before the meeting is offered. */
      record = readBridgedRecord();
      if (record) writeRecord(record);
    }
    if (record) {
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

  /* The Spark's tours load lazily on this page (the living
   * layer's way): the meeting stands first — adoption before
   * any tour — and the tour module rides in behind it, with
   * its post-adoption offer and its "show me" wiring. */
  (function loadIntro() {
    if (!document.getElementById("spark-intro-show")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "assets/css/spark-intro.css?v=20261126-7";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "assets/js/spark-intro.js?v=20261126-7";
    script.defer = true;
    document.head.appendChild(script);
  })();
})();
