(() => {
  "use strict";

  const PYTH = Object.freeze({ A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,I:9,J:1,K:2,L:3,M:4,N:5,O:6,P:7,Q:8,R:9,S:1,T:2,U:3,V:4,W:5,X:6,Y:7,Z:8 });
  const A1Z26 = Object.freeze(Object.fromEntries("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((ch, i) => [ch, i + 1])));
  const HEB = Object.freeze({ "א":1,"ב":2,"ג":3,"ד":4,"ה":5,"ו":6,"ז":7,"ח":8,"ט":9,"י":10,"כ":20,"ך":20,"ל":30,"מ":40,"ם":40,"נ":50,"ן":50,"ס":60,"ע":70,"פ":80,"ף":80,"צ":90,"ץ":90,"ק":100,"ר":200,"ש":300,"ת":400 });

  function reduceNum(value) {
    let x = Math.abs(Number(value) || 0);
    while (x > 9 && ![11, 22, 33].includes(x)) {
      x = String(x).split("").reduce((acc, digit) => acc + Number(digit), 0);
    }
    return x;
  }

  function normalize(raw) {
    return String(raw || "").trim();
  }

  function normalizeLatin(raw) {
    return normalize(raw)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  }

  function letters(source) {
    return (source.match(/[A-Z]/g) || []);
  }

  function scoreLetters(chars, table) {
    const values = chars.map(ch => table[ch] || 0).filter(Boolean);
    const sum = values.reduce((acc, n) => acc + n, 0);
    return { values, sum, reduction: reduceNum(sum) };
  }

  function scoreHebrew(source) {
    const chars = source.match(/[\u0590-\u05FF]/g) || [];
    const values = chars.map(ch => HEB[ch] || 0).filter(Boolean);
    const sum = values.reduce((acc, n) => acc + n, 0);
    return { chars, values, sum, reduction: reduceNum(sum) };
  }

  function repeatedLetters(chars) {
    const counts = new Map();
    chars.forEach(ch => counts.set(ch, (counts.get(ch) || 0) + 1));
    return Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([letter, count]) => ({ letter, count }));
  }

  function initials(words) {
    const chars = words.map(word => word[0]).filter(Boolean);
    const sum = chars.reduce((acc, ch) => acc + (A1Z26[ch] || 0), 0);
    return {
      letters: chars,
      value: sum,
      reduction: reduceNum(sum)
    };
  }

  function missingNumbers(chars) {
    const used = new Set(chars.map(ch => reduceNum(A1Z26[ch] || 0)).filter(n => n >= 1 && n <= 9));
    const missing = [];
    for (let i = 1; i <= 9; i += 1) {
      if (!used.has(i)) missing.push(i);
    }
    return missing;
  }

  function dominantNumber(numbers) {
    const values = numbers.map(n => reduceNum(n)).filter(Boolean);
    if (!values.length) return null;
    const counts = new Map();
    values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  }

  function vowelConsonantTotals(chars) {
    const vowels = new Set(["A", "E", "I", "O", "U", "Y"]);
    let vowelTotal = 0;
    let consonantTotal = 0;
    chars.forEach(ch => {
      const value = A1Z26[ch] || 0;
      if (!value) return;
      if (vowels.has(ch)) vowelTotal += value;
      else consonantTotal += value;
    });
    return {
      vowelTotal,
      consonantTotal,
      vowelReduction: reduceNum(vowelTotal),
      consonantReduction: reduceNum(consonantTotal)
    };
  }

  function individualWordValues(words) {
    return words.map(word => {
      const chars = letters(word);
      const pyth = scoreLetters(chars, PYTH);
      const simple = scoreLetters(chars, A1Z26);
      return {
        word,
        pythagorean: pyth,
        a1z26: simple
      };
    });
  }

  function classifyNameBirthResonance(nameSignature, birth) {
    const keyNumbers = new Set([
      birth?.moonNumber,
      birth?.dayInMoon,
      birth?.tone,
      birth?.resonantSum,
      birth?.carrierReduction
    ].map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0));

    const nameNumbers = [
      nameSignature?.latinPythagorean?.reduction,
      nameSignature?.latinA1Z26?.reduction,
      nameSignature?.fullNameReduction,
      nameSignature?.dominantNumber,
      nameSignature?.initialsCode?.reduction
    ].map(Number).filter(v => Number.isFinite(v) && v > 0);

    const overlap = nameNumbers.filter(value => keyNumbers.has(value));

    if (overlap.length >= 2) {
      return { classification: "direct resonance", reason: "Two or more reduced name values directly match birth signature keys." };
    }
    if (overlap.length === 1) {
      return { classification: "harmonic support", reason: "One reduced name value matches a birth signature key." };
    }

    const parityBirth = Array.from(keyNumbers).reduce((acc, value) => acc + value, 0) % 2;
    const parityName = nameNumbers.reduce((acc, value) => acc + value, 0) % 2;

    if (parityBirth !== parityName) {
      return { classification: "complementary tension", reason: "No direct key matches; parity contrast indicates a balancing tension." };
    }

    return { classification: "neutral", reason: "No direct key matches and parity remains aligned without strong pull." };
  }

  function compute(rawName, birthReference = null) {
    const source = normalize(rawName);
    const latinSource = normalizeLatin(source);
    const latinChars = letters(latinSource);
    const words = latinSource.split(/[^A-Z]+/).filter(Boolean);

    const pyth = scoreLetters(latinChars, PYTH);
    const simple = scoreLetters(latinChars, A1Z26);
    const hebrew = scoreHebrew(source);
    const initialsCode = initials(words);
    const wordValues = individualWordValues(words);
    const repeats = repeatedLetters(latinChars);
    const vowelConsonant = vowelConsonantTotals(latinChars);
    const fullNameReduction = reduceNum(simple.sum);
    const covenantSeal = reduceNum(pyth.reduction + simple.reduction + (hebrew.reduction || 0));
    const dominant = dominantNumber([
      pyth.reduction,
      simple.reduction,
      fullNameReduction,
      initialsCode.reduction,
      vowelConsonant.vowelReduction,
      vowelConsonant.consonantReduction,
      hebrew.reduction
    ]);

    const nameSignature = {
      source,
      normalizedLatin: latinSource,
      latinPythagorean: pyth,
      latinA1Z26: simple,
      hebrew: {
        ...hebrew,
        mode: hebrew.chars.length ? "native-hebrew-input" : "transliteration-not-applied",
        note: hebrew.chars.length
          ? "Hebrew value derived from provided Hebrew letters."
          : "Hebrew value requires native Hebrew letters; English transliterations are not treated as a single canonical Hebrew mapping."
      },
      covenantSeal,
      vowelTotal: vowelConsonant.vowelTotal,
      consonantTotal: vowelConsonant.consonantTotal,
      initialsCode,
      fullNameReduction,
      individualWordValues: wordValues,
      repeatedLetterPattern: repeats,
      dominantNumber: dominant,
      missingNumberPattern: missingNumbers(latinChars)
    };

    const resonance = classifyNameBirthResonance(nameSignature, birthReference);
    nameSignature.nameToBirthResonance = resonance;

    return nameSignature;
  }

  globalThis.GenesisOracleNameCode = Object.freeze({
    reduceNum,
    compute,
    classifyNameBirthResonance
  });
})();
