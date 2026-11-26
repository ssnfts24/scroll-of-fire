"use strict";

/*
 * The Witness Method — a short lesson in checking a claim.
 *
 * The lesson teaches the Codex's five evidence labels by using them.
 * Every claim in the practice is drawn from the Old World / Tartaria
 * investigation (tartaria-oldworld-investigation-2026-11-18.md), and
 * each claim is practised under the standing the investigation itself
 * gave it — the investigation's own verdict words are quoted in the
 * reasoning the visitor reads. Nothing is strengthened, nothing is
 * softened: the 1850–1930 cluster stands as a documented correlation,
 * and coordination stands as not documented, exactly as the
 * investigation left them.
 *
 * The day on the page's face is read only from the canonical
 * PatternCalendar. The visitor's place is kept in one local record
 * (sof.witness-method.v1) on the device only. Nothing is sent
 * anywhere. Nothing is tallied, and nothing follows the visitor —
 * only a place, kept.
 */

(function (global) {
  /* ---------------- the five labels ---------------- */

  const LABELS = [
    {
      id: "verified-record",
      name: "Verified Record",
      plain:
        "A claim you can check against a named record that was opened and read — a document, an official publication, a dated map.",
      carries: "It can carry decisions. It is the ground other claims are tested against.",
      cannot: "It cannot carry anything beyond what the record itself says.",
      example: "The CIA paper's file number is CIA-RDP78-02771R000200090002-6.",
    },
    {
      id: "firsthand-observation",
      name: "Firsthand Observation",
      plain:
        "What you can see, hear, or measure yourself, with your own eyes on the thing itself.",
      carries: "It can carry what is plainly there — a label on a map, buildings standing in a photograph.",
      cannot:
        "It cannot carry what it means. Meaning is a step further, and that step needs its own evidence.",
      example:
        "Photographs of the 1893 Chicago fair show grand classical buildings that are not standing today.",
    },
    {
      id: "reported-statement",
      name: "Reported Statement",
      plain:
        "What a named source says — a person, an agency, a marker, a history. The label names whose words they are.",
      carries: "It can carry what the source said, and the weight that source has earned — no more.",
      cannot:
        "It cannot carry the truth of the thing itself. Two reports can conflict, and both stay reports.",
      example:
        "The Children's Aid Society's own page says only 'tens of thousands' of children were placed by the orphan trains.",
    },
    {
      id: "allegation",
      name: "Allegation",
      plain:
        "A claim that someone did something — usually something serious — offered without the record that would prove it.",
      carries: "It can carry a reason to go and look. Nothing more, yet.",
      cannot:
        "It cannot carry a verdict. Unproven is not disproven — and it is not proven either. It waits.",
      example: "The great fires were set deliberately, as a clearing programme.",
    },
    {
      id: "inference",
      name: "Inference",
      plain:
        "A conclusion drawn from things observed — the mind stepping from what is seen to what it might mean.",
      carries: "It can carry a direction to investigate. It is the start of a question.",
      cannot:
        "It cannot carry the weight of the things it was drawn from. An inference is only as strong as the step it takes.",
      example: "The name is gone from today's maps, so it must have been suddenly erased.",
    },
  ];

  /* ---------------- the practice claims ----------------
   * Each claim is quoted from, or closely follows, the Old World
   * investigation, and its label is the standing the investigation
   * itself gave it:
   *  - cia-document, sf-magnitude: the investigation's "Documented
   *    record — Observation", with named checkable sources (hub
   *    grades: documented-event-with-cited-record).
   *  - ortelius-map: what the map itself shows — the investigation
   *    presents the map sequence as Observation.
   *  - peshtigo-report: the investigation presents NOAA's words as
   *    a source's report, flagged against the marker's report.
   *  - fires-clearing: the investigation's labelled Hypothesis of a
   *    deliberate act; the hub's checked-pattern verdict is
   *    "Unproven — a documented alternative stands". A claim of a
   *    deliberate act, unproven, is practised here as an allegation,
   *    with the investigation's own words in the reasoning.
   *  - star-fort, tartary-erasure, cia-proof: readings the
   *    investigation checked and found did not hold — conclusions
   *    drawn past the record, practised as inferences.
   */
  const CLAIMS = [
    {
      id: "cia-document",
      label: "verified-record",
      source: "Investigation §1 — the CIA document (hub entry GOV-CIA-TARTARIA-001)",
      claim:
        "A CIA paper from June 1957 — file CIA-RDP78-02771R000200090002-6 — is held in the CIA Reading Room, and its page 9 quotes a 1944 order to revise the history of Tartaria.",
      hint: "Ask: can anyone go and check this against a named source?",
      reasoning:
        "This one can be checked by anyone: a named document, a file number, and quoted words that agree across every source the investigation opened. A verified record carries exactly what the document says — the 1944 order concerned Tatar history inside the USSR. It carries nothing beyond its own pages.",
    },
    {
      id: "sf-magnitude",
      label: "verified-record",
      source: "Investigation §3 — the fires chronology (USGS GIP-31)",
      claim:
        "The USGS publication GIP-31 gives the 1906 San Francisco earthquake a magnitude of 7.8.",
      hint: "The claim names the very publication you could open to check it.",
      reasoning:
        "The number stands tied to the publication that states it — that is what makes it a record rather than a rumour. Other USGS publications give differing magnitudes, so the investigation keeps the figure tied to its source instead of smoothing the difference away. A record carries its source with it.",
    },
    {
      id: "ortelius-map",
      label: "firsthand-observation",
      source: "Investigation §2 — the maps (Library of Congress record)",
      claim:
        "On Ortelius's 1570 map, one label — TARTARIA — stretches across northern Asia, from the Caspian toward the Pacific.",
      hint: "What could you confirm with your own eyes, just by looking?",
      reasoning:
        "Open the map and your own eyes meet this: the label is there, spread across the north. That is observation, and it is solid — as far as it goes. The same record notes the empire the map seems to show had already fragmented about 200 years earlier. What a map shows is observation; what ruled the land is a further claim, and it needs more than the label.",
    },
    {
      id: "peshtigo-report",
      label: "reported-statement",
      source: "Investigation §3 — the Peshtigo discrepancy, flagged in the dossier",
      claim: "NOAA says one building in Peshtigo survived the fire of October 1871.",
      hint: "The claim's own words tell you whose words these are.",
      reasoning:
        "This is what a named source says — a report. It carries the weight of the source, no more. And here is the honest part: the 1951 Wisconsin Historical Society marker reports the opposite, that every building was lost. Both cannot be literally true, so the investigation flags the conflict instead of quietly picking one. A report is a beginning, not a verdict.",
    },
    {
      id: "fires-clearing",
      label: "allegation",
      source:
        "Investigation §3 — patterns and open questions (hub checked pattern: 'Unproven — a documented alternative stands')",
      claim:
        "The great city fires of the 1870s and 1900s were a clearing programme, set to remove an older built world.",
      hint: "Someone is being accused of a deliberate act. What record is offered for it?",
      reasoning:
        "This claim says unnamed people deliberately did something enormous. The investigation asked what would settle it — evidence of intent or coordination in the primary record — and reports plainly: a coordinated programme was not found in the sources opened, and drought, wind, and wooden cities are documented for that autumn. So it stands as an allegation: a serious claim, unproven, held at arm's length — neither believed nor mocked.",
    },
    {
      id: "star-fort",
      label: "inference",
      source: "Investigation §4a — star forts (hub checked pattern: 'Checked — it did not hold')",
      claim:
        "Star forts share the same shape all over the world, so their design must come from a lost, shared knowledge.",
      hint: "Watch for the word 'must'. What step is being jumped?",
      reasoning:
        "The similarity is real and documented. 'Must come from' is the leap past it. The record shows the shape following the cannon: the bastions answer gunpowder artillery, dated examples spread across centuries, and the engineers' own treatises explain the angles. The investigation's verdict: checked — it did not hold up as an anomaly. An inference is only as strong as the step it skips.",
    },
    {
      id: "tartary-erasure",
      label: "inference",
      source: "Investigation §2 — the maps (hub checked pattern: 'Checked — it did not hold')",
      claim: "Tartary was erased from the maps in a single act of removal.",
      hint: "The claim says 'sudden'. What does the sequence of maps actually show?",
      reasoning:
        "The maps themselves show the opposite of sudden: one Tartary in 1570, several subdivided Tartaries by 1706, two left in 1796 with Siberia appearing, none by 1885 — a fade of about 150 years, replaced name by name as knowledge improved. 'Erased in a single act' is a conclusion the sequence does not carry. The observation — the name is gone today — is true; the inference built on it failed its check.",
    },
    {
      id: "cia-proof",
      label: "inference",
      source:
        "Investigation §1 — interpretation, labelled (hub checked pattern: 'Checked — it did not hold')",
      claim: "The 1957 CIA paper proves a global Tartarian empire existed and was hidden.",
      hint: "The document is real. Does its text say what the claim says it says?",
      reasoning:
        "The paper is real — that part is a verified record. But read in full, it documents a Soviet order to revise Tatar history; it does not describe a global empire, advanced technology, or a worldwide reset. Reading it as proof of one goes beyond anything in its text. The investigation keeps that reading labelled for what it is: an inference the document cannot carry.",
    },
  ];

  /* ---------------- the ladder ---------------- */

  const LADDER = [
    {
      step: "Observation",
      plain: "What a source shows, or what your own eyes meet.",
    },
    {
      step: "Interpretation",
      plain: "A reading of what it might mean — labelled as a reading.",
    },
    {
      step: "Hypothesis",
      plain: "An open question with a shape: it says what would settle it.",
    },
    {
      step: "Declaration",
      plain: "A claim stated as settled. The Codex makes none without the record under it.",
    },
  ];

  /* ---------------- the local record ---------------- */

  const STORAGE_KEY = "sof.witness-method.v1";

  function emptyRecord() {
    return { placed: [], current: null, done: false };
  }

  function loadRecord(storage) {
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
      if (!parsed || !Array.isArray(parsed.placed)) return emptyRecord();
      const known = new Set(CLAIMS.map((c) => c.id));
      return {
        placed: parsed.placed.filter((id) => known.has(id)),
        current: known.has(parsed.current) ? parsed.current : null,
        done: parsed.done === true,
      };
    } catch {
      return emptyRecord();
    }
  }

  function saveRecord(storage, record) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch {
      /* the lesson still teaches */
    }
  }

  function nextUnplaced(record) {
    const placed = new Set(record.placed);
    const claim = CLAIMS.find((c) => !placed.has(c.id));
    return claim ? claim.id : null;
  }

  /* ---------------- today's coordinate ----------------
   * Read only through the canonical PatternCalendar — the same
   * public surface the other rooms use. */

  function todayContext() {
    const calendar = global.PatternCalendar;
    if (!calendar || typeof calendar.fromCivilDate !== "function") return null;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const get = (t) => (parts.find((p) => p.type === t) || {}).value;
    if (!get("year")) return null;
    const iso = `${get("year")}-${get("month")}-${get("day")}`;
    const summary = calendar.fromCivilDate({ date: iso, timeZone, boundaryMode: "midnight" });
    const civil = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    if (summary.insideCountedYear) {
      return {
        dayLine: `Moon ${summary.moon} · ${summary.moonName} · Day ${summary.day} · Pattern Day ${summary.dayOfPatternYear}`,
        civilLine: civil,
      };
    }
    return { dayLine: `${summary.moonName} · Pattern Year ${summary.patternYear}`, civilLine: civil };
  }

  /* ---------------- the page ---------------- */

  function labelById(id) {
    return LABELS.find((l) => l.id === id) || null;
  }

  function init() {
    const doc = global.document;
    if (!doc) return;
    const daylineEl = doc.getElementById("wm-dayline");
    const civilEl = doc.getElementById("wm-civil");
    const ctx = todayContext();
    if (ctx) {
      if (daylineEl) daylineEl.textContent = ctx.dayLine;
      if (civilEl) civilEl.textContent = ctx.civilLine;
    } else if (daylineEl) {
      daylineEl.textContent = "The day is being read…";
    }

    /* the five label cards */
    const labelsEl = doc.getElementById("wm-labels");
    if (labelsEl) {
      labelsEl.innerHTML = "";
      for (const label of LABELS) {
        const card = doc.createElement("article");
        card.className = "wm-label-card";
        card.innerHTML =
          `<h3 class="wm-label-name"></h3>` +
          `<p class="wm-label-plain"></p>` +
          `<p class="wm-label-carry"><strong>It can carry:</strong> <span></span></p>` +
          `<p class="wm-label-carry"><strong>It cannot carry:</strong> <span></span></p>` +
          `<p class="wm-label-example"><span class="wm-chip"></span> <span class="wm-example-text"></span></p>`;
        card.querySelector(".wm-label-name").textContent = label.name;
        card.querySelector(".wm-label-plain").textContent = label.plain;
        const spans = card.querySelectorAll(".wm-label-carry span");
        spans[0].textContent = label.carries;
        spans[1].textContent = label.cannot;
        card.querySelector(".wm-chip").textContent = label.name;
        card.querySelector(".wm-example-text").textContent = label.example;
        labelsEl.appendChild(card);
      }
    }

    /* the ladder */
    const ladderEl = doc.getElementById("wm-ladder");
    if (ladderEl) {
      ladderEl.innerHTML = "";
      LADDER.forEach((rung, i) => {
        const li = doc.createElement("li");
        li.className = "wm-rung";
        li.innerHTML = `<strong class="wm-rung-step"></strong><span class="wm-rung-plain"></span>`;
        li.querySelector(".wm-rung-step").textContent = `${i + 1}. ${rung.step}`;
        li.querySelector(".wm-rung-plain").textContent = rung.plain;
        ladderEl.appendChild(li);
        if (i < LADDER.length - 1) {
          const arrow = doc.createElement("li");
          arrow.className = "wm-rung-arrow";
          arrow.setAttribute("aria-hidden", "true");
          arrow.textContent = "↓ may climb only when new evidence is named";
          ladderEl.appendChild(arrow);
        }
      });
    }

    /* the practice */
    const storage = global.localStorage;
    const record = loadRecord(storage);
    const keeperLine = doc.getElementById("wm-keeper-line");
    const progressEl = doc.getElementById("wm-progress");
    const claimEl = doc.getElementById("wm-claim");
    const choicesEl = doc.getElementById("wm-choices");
    const feedbackEl = doc.getElementById("wm-feedback");
    const reasoningEl = doc.getElementById("wm-reasoning");
    const nextBtn = doc.getElementById("wm-next");
    const shelfEl = doc.getElementById("wm-shelf");
    const doneEl = doc.getElementById("wm-done");
    const resumeEl = doc.getElementById("wm-resume");
    if (!claimEl || !choicesEl) return;

    let currentId = record.current || nextUnplaced(record) || CLAIMS[0].id;
    let showingReasoningFor = null;

    function currentClaim() {
      return CLAIMS.find((c) => c.id === currentId) || CLAIMS[0];
    }

    function renderKeeper() {
      if (!keeperLine) return;
      if (record.done) {
        keeperLine.textContent = "You placed them all. The method is yours now — take it to the next claim you meet.";
      } else if (record.placed.length > 0) {
        keeperLine.textContent = `I kept your place. ${record.placed.length} of ${CLAIMS.length} claims placed — the next one is waiting when you are.`;
      } else {
        keeperLine.textContent = "Walk with me. First the five labels — then real claims, checked the way the Codex checks them.";
      }
    }

    function renderProgress() {
      if (!progressEl) return;
      const idx = CLAIMS.findIndex((c) => c.id === currentId);
      progressEl.textContent = record.done
        ? `All ${CLAIMS.length} claims placed`
        : `Claim ${idx + 1} of ${CLAIMS.length} · ${record.placed.length} placed`;
    }

    function renderShelf() {
      if (!shelfEl) return;
      shelfEl.innerHTML = "";
      for (const claim of CLAIMS) {
        if (!record.placed.includes(claim.id)) continue;
        const li = doc.createElement("li");
        const btn = doc.createElement("button");
        btn.type = "button";
        btn.className = "wm-shelf-item";
        const chip = doc.createElement("span");
        chip.className = "wm-chip";
        chip.textContent = labelById(claim.label).name;
        const text = doc.createElement("span");
        text.textContent = claim.claim;
        btn.append(chip, text);
        btn.addEventListener("click", () => {
          currentId = claim.id;
          showingReasoningFor = claim.id;
          renderClaim();
          doc.getElementById("wm-practice").scrollIntoView({ block: "start" });
        });
        li.appendChild(btn);
        shelfEl.appendChild(li);
      }
    }

    function renderClaim() {
      const claim = currentClaim();
      claimEl.textContent = `“${claim.claim}”`;
      choicesEl.innerHTML = "";
      feedbackEl.textContent = "";
      const alreadyPlaced = record.placed.includes(claim.id);
      for (const label of LABELS) {
        const btn = doc.createElement("button");
        btn.type = "button";
        btn.className = "wm-choice";
        btn.textContent = label.name;
        if (alreadyPlaced && label.id === claim.label) btn.classList.add("wm-choice-placed");
        btn.disabled = alreadyPlaced;
        btn.addEventListener("click", () => choose(label.id));
        choicesEl.appendChild(btn);
      }
      if (alreadyPlaced || showingReasoningFor === claim.id) {
        showReasoning(claim);
      } else {
        reasoningEl.hidden = true;
        reasoningEl.innerHTML = "";
        nextBtn.hidden = true;
      }
      renderProgress();
      renderShelf();
      renderKeeper();
      if (doneEl) doneEl.hidden = !record.done;
      if (resumeEl) resumeEl.hidden = !(record.placed.length > 0 && !record.done);
    }

    function showReasoning(claim) {
      reasoningEl.hidden = false;
      reasoningEl.innerHTML = "";
      const head = doc.createElement("p");
      head.className = "wm-reasoning-head";
      const chip = doc.createElement("span");
      chip.className = "wm-chip";
      chip.textContent = labelById(claim.label).name;
      head.append(chip, doc.createTextNode(" — how the investigation has it:"));
      const body = doc.createElement("p");
      body.textContent = claim.reasoning;
      const src = doc.createElement("p");
      src.className = "wm-reasoning-source";
      src.textContent = `Source: ${claim.source}.`;
      reasoningEl.append(head, body, src);
      const nxt = nextUnplaced(record);
      nextBtn.hidden = !nxt;
      nextBtn.textContent = nxt ? "Next claim" : "See where the checking lands";
    }

    function choose(labelId) {
      const claim = currentClaim();
      if (labelId === claim.label) {
        if (!record.placed.includes(claim.id)) record.placed.push(claim.id);
        record.done = record.placed.length === CLAIMS.length;
        record.current = nextUnplaced(record);
        saveRecord(storage, record);
        showingReasoningFor = claim.id;
        feedbackEl.textContent = "Placed. Here is the investigation's own reasoning:";
        renderClaim();
      } else {
        feedbackEl.textContent = `Not that shelf. ${claim.hint}`;
      }
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        const nxt = nextUnplaced(record);
        if (nxt) {
          currentId = nxt;
          showingReasoningFor = null;
          renderClaim();
        } else {
          const closeEl = doc.getElementById("wm-close");
          if (closeEl) closeEl.scrollIntoView({ block: "start" });
        }
      });
    }

    const resumeBtn = doc.getElementById("wm-resume-btn");
    if (resumeBtn) {
      resumeBtn.addEventListener("click", () => {
        const nxt = nextUnplaced(record);
        if (nxt) {
          currentId = nxt;
          showingReasoningFor = null;
          renderClaim();
        }
        doc.getElementById("wm-practice").scrollIntoView({ block: "start" });
      });
    }

    renderClaim();
  }

  const api = { LABELS, CLAIMS, LADDER, STORAGE_KEY, loadRecord, saveRecord, nextUnplaced, labelById };
  global.WitnessMethod = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (global.document) {
    if (global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
