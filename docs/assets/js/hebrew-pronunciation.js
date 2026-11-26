/**
 * Hebrew pronunciation — the pronunciation layer for Listen
 * (Aaron's commission, Nov 25, 2026: "Commission the Hebrew
 * pronunciation layer"; design paper:
 * hebrew-pronunciation-layer-design-2026-11-25.md).
 *
 * E2's Listen reads English only, and says why on the page: the
 * pointed Hebrew is a study text, and device voices pronounce
 * raw Hebrew unreliably. This engine is the study-grade road
 * around that limit. It reads POINTED Hebrew — consonants,
 * vowel points (nikkud), dagesh, shewa sounded or silent by
 * rule, final forms, maqaf, stress — and produces a careful
 * Latin transliteration track that a device speech voice can
 * speak approximately but faithfully, plus the syllable map
 * and stress the page needs to highlight honestly.
 *
 * The fences:
 *   - The studies are the authority. The engine's output for
 *     every studied word is pinned by test against the
 *     transliteration printed in that word's own study
 *     (tests/hebrew-pronunciation.test.js). Where a study
 *     follows a tradition the rules do not produce, the study
 *     wins and the exception is listed — in the design paper
 *     and in the test file — never silently resolved.
 *   - Pointing is never invented. Unpointed text is refused:
 *     a guessed vowel would be a fabricated reading.
 *   - The honest limit, printed wherever this is offered:
 *     this reads a careful transliteration in the device's
 *     own voice. It is not a native Hebrew voice.
 *   - Pure rules only: no network, no storage, no state.
 */
(function (root) {
  "use strict";

  const VERSION = "hebrew-pronunciation/1.0.0";

  /* Combining marks (nikkud and friends). */
  const SHEWA = "ְ";
  const HATAF_SEGOL = "ֱ";
  const HATAF_PATACH = "ֲ";
  const HATAF_KAMATZ = "ֳ";
  const CHIRIQ = "ִ";
  const TSERE = "ֵ";
  const SEGOL = "ֶ";
  const PATACH = "ַ";
  const KAMATZ = "ָ";
  const CHOLAM = "ֹ";
  const KUBUTZ = "ֻ";
  const DAGESH = "ּ";
  const SHIN_DOT = "ׁ";
  const SIN_DOT = "ׂ";
  const MAQAF = "־";

  const VOWEL_SOUND = new Map([
    [HATAF_SEGOL, "e"], [HATAF_PATACH, "a"], [HATAF_KAMATZ, "o"],
    [CHIRIQ, "i"], [TSERE, "e"], [SEGOL, "e"], [PATACH, "a"],
    [KAMATZ, "a"], [CHOLAM, "o"], [KUBUTZ, "u"]
  ]);
  const HATAFS = new Set([HATAF_SEGOL, HATAF_PATACH, HATAF_KAMATZ]);
  /* Vowels that count as long for the shewa rules. */
  const LONG_VOWELS = new Set([TSERE, CHOLAM]);

  const isHebrewLetter = (ch) => ch >= "א" && ch <= "ת";
  const isMark = (ch) => {
    const cp = ch.codePointAt(0);
    return (cp >= 0x05b0 && cp <= 0x05bd) || cp === 0x05bf ||
      (cp >= 0x05c1 && cp <= 0x05c2) || cp === 0x05c7 ||
      (cp >= 0x0591 && cp <= 0x05af); // cantillation: carried, not sounded
  };
  const hasPointing = (text) => /[ְ-ֽֿׁׂ]/.test(String(text || ""));

  /* Split a pointed word into letter units:
   * { letter, vowel (mark|null), dagesh, shin, sin, shewa } */
  function parseUnits(word) {
    const units = [];
    let current = null;
    for (const ch of String(word)) {
      if (isHebrewLetter(ch)) {
        current = { letter: ch, vowel: null, dagesh: false, shin: false, sin: false };
        units.push(current);
      } else if (current && isMark(ch)) {
        if (ch === DAGESH) current.dagesh = true;
        else if (ch === SHIN_DOT) current.shin = true;
        else if (ch === SIN_DOT) current.sin = true;
        else if (VOWEL_SOUND.has(ch) || ch === SHEWA) {
          if (current.vowel === null) current.vowel = ch;
        }
        /* meteg, rafe, cantillation: noted by their absence */
      } else if (!isHebrewLetter(ch)) {
        current = null;
      }
    }
    return units;
  }

  const FINALS = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
  const baseLetter = (unit, index, count) =>
    FINALS[unit.letter] || unit.letter;
  const isFinalPosition = (index, count) => index === count - 1;

  function consonantSound(unit, index, count) {
    const letter = baseLetter(unit);
    const final = isFinalPosition(index, count);
    switch (letter) {
      case "א": return "";
      case "ב": return unit.dagesh ? "b" : "v";
      case "ג": return "g";
      case "ד": return "d";
      case "ה": return final && !unit.dagesh ? "" : "h";
      case "ו": return "v"; // mater cases are absorbed before this is asked
      case "ז": return "z";
      case "ח": return "ch";
      case "ט": return "t";
      case "י": return "y";
      case "כ": return unit.dagesh ? "k" : "kh";
      case "ל": return "l";
      case "מ": return "m";
      case "נ": return "n";
      case "ס": return "s";
      case "ע": return "";
      case "פ": return unit.dagesh ? "p" : "f";
      case "צ": return "ts";
      case "ק": return "k";
      case "ר": return "r";
      case "ש": return unit.sin ? "s" : "sh";
      case "ת": return "t";
      default: return "";
    }
  }

  const GUTTURALS = new Set(["א", "ה", "ח", "ע"]);

  /**
   * Transliterate one pointed word.
   * Returns { spoken, syllables: [..], stress: index } or null
   * when the word carries no pointing (never guessed).
   */
  function transliterateWord(rawWord) {
    const word = String(rawWord || "").trim();
    if (!word || !hasPointing(word)) return null;
    const units = parseUnits(word);
    if (!units.length) return null;

    /* Absorb mater lectionis: an unvowelled letter followed by
     * vav+dagesh (shuruk) or vav+cholam takes that vav as its
     * vowel; a pointed letter followed by unpointed yud after
     * tsere/chiriq takes the yud as its vowel's carrier. */
    const items = []; // { unit, vowelMark | 'shuruk' | null, absorbed }
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      const next = units[i + 1];
      if (unit.letter === "ו" && items.length && !items[items.length - 1].absorbedVowel &&
          (unit.dagesh || unit.vowel === CHOLAM) && !unit.vowelIsOwn) {
        const prev = items[items.length - 1];
        if (prev.unit.vowel === null && prev.consonant !== "v") {
          prev.absorbedVowel = unit.dagesh ? "u" : "o";
          continue;
        }
      }
      items.push({ unit, absorbedVowel: null });
    }
    /* Unpointed yud after tsere/chiriq is a carrier, not a "y". */
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      const item = items[i];
      if (item.unit.letter === "י" && item.unit.vowel === null && !item.unit.dagesh &&
          (prev.unit.vowel === TSERE || prev.unit.vowel === CHIRIQ)) {
        item.carrier = true;
      }
    }

    /* Resolve each item's sounded vowel. Shewa is decided by
     * rule, in order: word start; under dagesh; under a
     * guttural; after a long vowel; second of two shewas.
     * Otherwise silent. Kamatz in a closed, unstressed,
     * non-final syllable is kamatz katan and sounds "o". */
    const vowelOf = new Array(items.length).fill(null);
    const longOf = new Array(items.length).fill(false);
    for (let i = 0; i < items.length; i++) {
      const { unit, absorbedVowel } = items[i];
      if (absorbedVowel) { vowelOf[i] = absorbedVowel; longOf[i] = true; continue; }
      if (unit.letter === "ו" && unit.dagesh && unit.vowel === null) {
        vowelOf[i] = "u"; longOf[i] = true; continue; // standalone shuruk
      }
      if (unit.letter === "ו" && unit.vowel === CHOLAM) {
        vowelOf[i] = "o"; longOf[i] = true; continue; // standalone cholam
      }
      const mark = unit.vowel;
      if (mark === null) continue;
      if (mark === SHEWA) {
        const prevMark = i > 0 ? items[i - 1].unit.vowel : null;
        const vocal =
          i === 0 ||
          unit.dagesh ||
          GUTTURALS.has(baseLetter(unit)) ||
          (i > 0 && longOf[i - 1]) ||
          prevMark === SHEWA;
        vowelOf[i] = vocal ? "e" : null;
        continue;
      }
      vowelOf[i] = VOWEL_SOUND.get(mark) || null;
      longOf[i] = LONG_VOWELS.has(mark) ||
        (mark === CHIRIQ && items[i + 1] && items[i + 1].carrier) ||
        (mark === KAMATZ);
    }
    /* Kamatz katan: kamatz whose syllable closes (the next
     * letter's shewa is silent) and which is not the word's
     * last vowel sounds "o". */
    for (let i = 0; i < items.length; i++) {
      if (items[i].unit.vowel !== KAMATZ || vowelOf[i] !== "a") continue;
      const isLastVowel = !vowelOf.slice(i + 1).some(Boolean);
      const next = items[i + 1];
      if (!isLastVowel && next && next.unit.vowel === SHEWA && vowelOf[i + 1] === null) {
        vowelOf[i] = "o";
      }
    }

    /* Furtive patach: a patach under a final ח, הּ or ע, after
     * a vowel that is not "a", is heard before its letter. */
    const last = items.length - 1;
    const furtive =
      last > 0 &&
      items[last].unit.vowel === PATACH &&
      ["ח", "ע", "ה"].includes(baseLetter(items[last].unit)) &&
      (items[last].unit.letter !== "ה" || items[last].unit.dagesh) &&
      vowelOf.slice(0, last).filter(Boolean).pop() !== "a" &&
      vowelOf[last] === "a";

    /* Speak, syllable by syllable: a new syllable opens at
     * each sounded vowel; consonants with no sounded vowel
     * close the syllable before them (or open the word). */
    const syllables = [];
    let current = "";
    const pushCurrent = () => { if (current) { syllables.push(current); current = ""; } };
    items.forEach((item, i) => {
      if (item.carrier) return;
      const isMaterVav = item.unit.letter === "ו" &&
        (item.absorbedVowel || (item.unit.vowel === null && item.unit.dagesh) ||
         item.unit.vowel === CHOLAM) && i > 0 && items[i - 1].absorbedVowel;
      if (isMaterVav) return;
      let consonant = consonantSound(item.unit, i, items.length);
      if (item.unit.letter === "ו" && (item.absorbedVowel || item.unit.vowel === CHOLAM ||
          (item.unit.dagesh && item.unit.vowel === null))) consonant = "";
      if (item.unit.letter === "י" && item.unit.vowel === null && !item.unit.dagesh) {
        /* unpointed yud: diphthong tail after patach at word end */
        if (i === last && vowelOf[i - 1] === "a") current += "y";
        return;
      }
      const vowel = vowelOf[i];
      if (furtive && i === last) {
        current += "a" + consonant;
        return;
      }
      if (vowel) {
        if (current && vowelOf[i - 1] !== undefined && items.slice(0, i).some((_, j) => vowelOf[j])) {
          pushCurrent();
        } else if (current && i > 0 && vowelOf.slice(0, i).some(Boolean)) {
          pushCurrent();
        }
        current += consonant + vowel;
      } else {
        current += consonant;
      }
    });
    pushCurrent();

    /* Stress: final syllable, except segolate-shaped words —
     * two syllables whose second vowel is segol carry it on
     * the first: nephesh, erets, odem. (Stress is metadata
     * for the page's highlighting; the spoken track itself
     * does not encode it, and the design paper says so.) */
    let stress = syllables.length - 1;
    if (syllables.length === 2) {
      const vowelMarks = items.filter((_, i) => vowelOf[i]).map((it) => it.unit.vowel);
      if (vowelMarks[1] === SEGOL) stress = 0;
    }

    return { spoken: syllables.join(""), syllables, stress };
  }

  /**
   * Transliterate a pointed phrase: words split on spaces,
   * maqaf-joined words stay joined with a hyphen, as the
   * text joins them. Unpointed words pass through unspoken
   * (spoken: null for that word) — never guessed.
   */
  function transliterate(text) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const out = [];
    for (const raw of words) {
      const joined = raw.split(MAQAF).filter(Boolean);
      const parts = joined.map((w) => transliterateWord(w));
      out.push({
        hebrew: raw,
        spoken: parts.every(Boolean) ? parts.map((p) => p.spoken).join("-") : null,
        parts
      });
    }
    return {
      spoken: out.every((w) => w.spoken !== null) ? out.map((w) => w.spoken).join(" ") : null,
      words: out
    };
  }

  /**
   * Fold a study's printed scholarly transliteration into the
   * spoken track's alphabet, so tests can prove the engine
   * agrees with the studies: macrons/circumflexes fold to
   * their plain vowels, ḏ → d, š → sh, ḥ → ch, ṣ → ts,
   * ʾ and ʿ drop, ə → e.
   */
  function normalizeScholarly(text) {
    const fold = {
      "ā": "a", "á": "a", "à": "a", "ă": "a", "â": "a",
      "ē": "e", "é": "e", "è": "e", "ĕ": "e", "ê": "e",
      "ī": "i", "í": "i", "ì": "i", "î": "i",
      "ō": "o", "ó": "o", "ò": "o", "ô": "o", "ŏ": "o",
      "ū": "u", "ú": "u", "ù": "u", "û": "u",
      "ḏ": "d", "š": "sh", "ḥ": "ch", "ṣ": "ts", "ṭ": "t", "ṯ": "t",
      "ś": "s", "ə": "e", "ʾ": "", "ʿ": "", "'": ""
    };
    return String(text || "").split("").map((ch) => fold[ch] ?? ch).join("")
      .replace(/ph/g, "f") // the studies' "ph" spells the same /f/ as the engine's "f"
      .replace(/([bcdfghklmnprstvyz])\1/g, "$1") // scholarly gemination (dagesh forte written double: ḥayyim) folds to the single sounded consonant
      .replace(/\s+/g, " ").trim().toLowerCase();
  }

  const api = { VERSION, hasPointing, transliterateWord, transliterate, normalizeScholarly };
  root.HebrewPronunciation = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
