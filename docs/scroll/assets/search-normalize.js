"use strict";

/*
 * Shared text normalization for the Scroll of Fire local search and lexicon.
 * The same file runs in the browser and in the build script so that index
 * tokens and query tokens are always produced by identical rules.
 *
 * Rules (documented in docs/scroll/CONTENT-COVERAGE.md):
 *  - Unicode NFKD, then all combining marks (Hebrew niqqud, cantillation,
 *    shin/sin dots, Latin diacritics) are removed.
 *  - Hebrew final letters are folded to their medial forms.
 *  - Maqaf and all punctuation separate words; apostrophes are dropped
 *    (Da’at -> daat).
 *  - Letters are lower-cased.
 * The original text is never altered; normalization is used only for matching.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ScrollSearchNormalize = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const FINALS = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/\p{M}+/gu, "")
      .replace(/[ךםןףץ]/g, letter => FINALS[letter])
      .replace(/[\u2018\u2019\u02bb\u02bc\u02bf'`]/g, "")
      .toLocaleLowerCase("en")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  function tokenize(value) {
    const normalized = normalize(value);
    return normalized ? normalized.split(" ") : [];
  }

  function hasHebrew(value) {
    return /[\u0590-\u05ff]/.test(String(value ?? ""));
  }

  /*
   * Transliteration folding used ONLY to let English spellings such as
   * Bereshit / Bereishit / Breishis meet. It folds common romanization
   * variants of consonants and drops plain vowels. It is a search aid, not a
   * claim that the spellings are linguistically equivalent.
   */
  function transliterationKey(value) {
    let text = normalize(value).replace(/ /g, "");
    const folds = [
      [/tz|ts|ẓ/g, "ts"],
      [/ch|kh|x/g, "h"],
      [/ph/g, "f"],
      [/th/g, "t"],
      [/sh/g, "s"],
      [/[qc]/g, "k"],
      [/w/g, "v"],
      [/[aeiou]/g, ""],
      [/(.)\1+/g, "$1"]
    ];
    for (const [pattern, replacement] of folds) text = text.replace(pattern, replacement);
    return text;
  }

  const HEBREW_CONSONANTS = {
    "א": "ʼ", "ב": "b", "ג": "g", "ד": "d", "ה": "h", "ו": "w", "ז": "z", "ח": "ḥ", "ט": "ṭ",
    "י": "y", "כ": "k", "ל": "l", "מ": "m", "נ": "n", "ס": "s", "ע": "ʻ", "פ": "p", "צ": "ṣ",
    "ק": "q", "ר": "r", "ש": "sh", "ת": "t"
  };

  /* Mechanical, vowel-less romanization of a consonantal skeleton. */
  function consonantalRomanization(value) {
    return [...normalize(value).replace(/ /g, "")].map(letter => HEBREW_CONSONANTS[letter] ?? letter).join("");
  }

  return { normalize, tokenize, hasHebrew, transliterationKey, consonantalRomanization };
});
