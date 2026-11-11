"""Shared helpers for the R2-02 Scripture build (Python 3 standard library only)."""
import re

# ---------------------------------------------------------------- morphology
# Legend source: openscriptures/morphhb parsing/HebrewMorphologyCodes.html (CC BY 4.0)
STEMS_H = {"q": "Qal", "N": "Niphal", "p": "Piel", "P": "Pual", "h": "Hiphil", "H": "Hophal", "t": "Hithpael",
           "o": "Polel", "O": "Polal", "r": "Hithpolel", "m": "Poel", "M": "Poal", "k": "Palel", "K": "Pulal",
           "Q": "Qal passive", "l": "Pilpel", "L": "Polpal", "f": "Hithpalpel", "D": "Nithpael", "j": "Pealal",
           "i": "Pilel", "u": "Hothpaal", "c": "Tiphil", "v": "Hishtaphel", "w": "Nithpalel", "y": "Nithpoel",
           "z": "Hithpoel"}
STEMS_A = {"q": "Peal", "Q": "Peil", "u": "Hithpeel", "p": "Pael", "P": "Ithpaal", "M": "Hithpaal", "a": "Aphel",
           "h": "Haphel", "s": "Saphel", "e": "Shaphel", "H": "Hophal", "i": "Ithpeel", "t": "Hishtaphel",
           "v": "Ishtaphel", "w": "Hithaphel", "o": "Polel", "z": "Ithpoel", "r": "Hithpolel", "f": "Hithpalpel",
           "b": "Hephal", "c": "Tiphel", "m": "Poel", "l": "Palpel", "L": "Ithpalpel", "O": "Ithpolel",
           "G": "Ittaphal"}
VTYPE = {"p": "perfect (qatal)", "q": "sequential perfect (weqatal)", "i": "imperfect (yiqtol)",
         "w": "sequential imperfect (wayyiqtol)", "h": "cohortative", "j": "jussive", "v": "imperative",
         "r": "active participle", "s": "passive participle", "a": "infinitive absolute", "c": "infinitive construct"}
ATYPE = {"a": "adjective", "c": "cardinal number", "g": "gentilic", "o": "ordinal number"}
NTYPE = {"c": "common", "g": "gentilic", "p": "proper name"}
PTYPE = {"d": "demonstrative", "f": "indefinite", "i": "interrogative", "p": "personal", "r": "relative"}
STYPE = {"d": "directional he", "h": "paragogic he", "n": "paragogic nun", "p": "pronominal suffix"}
TTYPE = {"a": "affirmation", "d": "definite article", "e": "exhortation", "i": "interrogative", "j": "interjection",
         "m": "demonstrative", "n": "negative", "o": "direct object marker", "r": "relative"}
PERSON = {"1": "1st person", "2": "2nd person", "3": "3rd person"}
GENDER = {"b": "masculine or feminine", "c": "common", "f": "feminine", "m": "masculine"}
NUMBER = {"d": "dual", "p": "plural", "s": "singular"}
STATE = {"a": "absolute", "c": "construct", "d": "determined"}
POS = {"A": "Adjective", "C": "Conjunction", "D": "Adverb", "N": "Noun", "P": "Pronoun", "R": "Preposition",
       "S": "Suffix", "T": "Particle", "V": "Verb"}


def decode_morph_segment(seg, lang="H"):
    """Decode one morpheme code, e.g. 'Vqp3ms' -> ordered list of labelled facts."""
    if not seg:
        return {"code": seg, "pos": "unknown", "facts": [], "text": "unparsed"}
    pos = seg[0]
    rest = seg[1:]
    facts = []

    def add(label, table, ch):
        if ch and ch != "x":
            facts.append([label, table.get(ch, f"?{ch}")])

    if pos == "V":
        stems = STEMS_H if lang == "H" else STEMS_A
        add("stem", stems, rest[0:1])
        t = rest[1:2]
        add("form", VTYPE, t)
        tail = rest[2:]
        if t in ("r", "s"):
            add("gender", GENDER, tail[0:1]); add("number", NUMBER, tail[1:2]); add("state", STATE, tail[2:3])
        elif t in ("a", "c"):
            pass
        else:
            add("person", PERSON, tail[0:1]); add("gender", GENDER, tail[1:2]); add("number", NUMBER, tail[2:3])
            add("state", STATE, tail[3:4])
    elif pos == "N":
        add("type", NTYPE, rest[0:1]); add("gender", GENDER, rest[1:2]); add("number", NUMBER, rest[2:3])
        add("state", STATE, rest[3:4])
    elif pos == "A":
        add("type", ATYPE, rest[0:1]); add("gender", GENDER, rest[1:2]); add("number", NUMBER, rest[2:3])
        add("state", STATE, rest[3:4])
    elif pos == "P":
        add("type", PTYPE, rest[0:1]); add("person", PERSON, rest[1:2]); add("gender", GENDER, rest[2:3])
        add("number", NUMBER, rest[3:4])
    elif pos == "S":
        add("type", STYPE, rest[0:1]); add("person", PERSON, rest[1:2]); add("gender", GENDER, rest[2:3])
        add("number", NUMBER, rest[3:4])
    elif pos == "T":
        add("type", TTYPE, rest[0:1])
    elif pos == "R":
        if rest[0:1] == "d":
            facts.append(["type", "with definite article"])
    name = POS.get(pos, "Unknown")
    text = name + (" · " + " · ".join(f[1] for f in facts) if facts else "")
    return {"code": seg, "pos": name, "facts": facts, "text": text}


# ------------------------------------------------------------ transliteration
CONS = {"א": "ʾ", "ב": "v", "ג": "g", "ד": "d", "ה": "h", "ו": "w", "ז": "z", "ח": "ḥ", "ט": "ṭ", "י": "y",
        "כ": "kh", "ך": "kh", "ל": "l", "מ": "m", "ם": "m", "נ": "n", "ן": "n", "ס": "s", "ע": "ʿ", "פ": "f",
        "ף": "f", "צ": "ṣ", "ץ": "ṣ", "ק": "q", "ר": "r", "ש": "sh", "ת": "t"}
PLOSIVE = {"ב": "b", "כ": "k", "ך": "k", "פ": "p", "ף": "p"}
VOW = {"\u05B1": "ĕ", "\u05B2": "ă", "\u05B3": "ŏ", "\u05B4": "i", "\u05B5": "e", "\u05B6": "e", "\u05B7": "a",
       "\u05B8": "ā", "\u05B9": "o", "\u05BA": "o", "\u05BB": "u"}
SHEVA = "\u05B0"
DAGESH = "\u05BC"
SHIN_DOT, SIN_DOT = "\u05C1", "\u05C2"
CLUSTER = re.compile("([\u05D0-\u05EA])([\u0591-\u05AF\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]*)")


def transliterate(text):
    """Mechanical transliteration of the vowel pointing as printed. Approximate by design:
    shewa vocal/silent, qamets gadol/qatan and dagesh forte/lene are not distinguished."""
    clusters = CLUSTER.findall(text)
    n = len(clusters)
    res = []
    for idx, (letter, marks) in enumerate(clusters):
        vowels = [VOW[m] for m in marks if m in VOW]
        has_sheva = SHEVA in marks
        dagesh = DAGESH in marks
        if letter == "ו" and idx > 0 and not has_sheva:
            if dagesh and not vowels:
                res.append("û")
                continue
            if "\u05B9" in marks and not dagesh and vowels == ["o"]:
                res.append("ô")
                continue
        if letter == "י" and not vowels and not has_sheva and idx > 0 and res and res[-1][-1:] in ("i", "e"):
            res[-1] = res[-1][:-1] + {"i": "î", "e": "ê"}[res[-1][-1]]
            continue
        if letter == "ש":
            c = "s" if SIN_DOT in marks else "sh"
        elif letter in PLOSIVE and dagesh:
            c = PLOSIVE[letter]
        else:
            c = CONS[letter]
        piece = c + "".join(vowels)
        if idx == n - 1 and letter in "חע" and vowels == ["a"]:
            piece = "a" + c  # furtive patach is pronounced before the final guttural
        if has_sheva and idx != n - 1:
            piece += "ə"
        res.append(piece)
    return "".join(res)


def strip_marks(text, keep_sheva_dots=False):
    return re.sub("[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]", "", text)


def consonants(text):
    return re.sub("[^\u05D0-\u05EA]", "", text)
