/*
 * Aiyana's language guard — the fence in front of her door.
 *
 * Every submission (pen name, title, and story) passes this
 * guard BEFORE it can reach Aiyana's dashboard. A submission
 * that trips the guard is never shown to her — not flagged,
 * not hinted: it goes to the held shelf, where only a grown-up
 * with the parent code can see it, and the sender gets one
 * kind message with no list of words and nothing to probe.
 *
 * The guard also re-checks on the way OUT (the approved list
 * and the accept move screen again), so bad language cannot
 * reach her public page even by a side road.
 *
 * How it reads: the text is normalised (lowercase, common
 * leetspeak letters folded back, repeated letters collapsed),
 * then checked two ways —
 *   1. word by word, on word boundaries, so innocent words
 *      that merely contain a bad string ("hello", "class",
 *      "grass", "peacock") pass untouched;
 *   2. squeezed (spacing and punctuation removed), which
 *      catches "f u c k"-style spacing tricks — applied per
 *      chunk and across runs of tiny chunks, never across
 *      whole real words, and never when the match sits inside
 *      a known innocent word.
 * When in doubt the guard holds for a grown-up rather than
 * delivering to Aiyana or destroying the story.
 */

/* Strong words: essentially never innocent in a kids' story.
   Matched word-by-word AND squeezed. */
const STRONG = [
  "fuck", "fucking", "fucker", "motherfucker", "shit", "bullshit",
  "bitch", "bastard", "whore", "slut", "dickhead", "asshole",
  "porn", "porno", "pornography", "rape", "rapist", "molest",
  "pedophile", "paedophile", "nigger", "nigga", "faggot", "retard",
  "retarded", "cunt", "pussy", "blowjob", "handjob", "dildo",
  "masturbate", "masturbation", "ejaculate", "orgasm", "erect",
  "hardcore", "xxx", "sex", "sexual", "penis", "vagina", "boobs",
  "tits", "nipples", "anus", "anal", "oral", "semen", "cum",
  "jizz", "horny", "boner", "stripper", "prostitute", "hooker",
  "kill yourself", "kys", "suicide", "self harm", "cutting myself"
];

/* Softer words: fine in some grown-up mouths, not in stories
   for an 8-year-old. Matched word-by-word only (never squeezed),
   so "dam" the beaver's dam and friends stay safe by boundary. */
const MILD = [
  "damn", "dammit", "hell", "crap", "crappy", "piss", "pissed",
  "dumbass", "jackass", "ass", "butthole", "hate you", "shut up",
  "drugs", "cocaine", "heroin", "meth", "weed", "marijuana",
  "drunk", "beer", "vodka", "whiskey", "cigarette", "vape",
  "gambling", "casino"
];

/* Innocent words that contain a listed string. If a squeezed
   match sits inside one of these, it is not a match. */
const INNOCENT = [
  "hello", "shell", "class", "classes", "grass", "glass", "pass",
  "bass", "brass", "assist", "assume", "peacock", "cockatoo",
  "cocktail", "hancock", "scunthorpe", "arsenal", "mishit",
  "shiitake", "fukushima", "kumquat", "dickens", "dickinson",
  "moby dick", "grape", "drape", "scrape", "trapezoid", "sextant",
  "essex", "sussex", "middlesex", "cumberland", "analyze",
  "analogy", "analog", "canal", "banal", "penal", "therapist",
  "title", "titles", "constitution", "skilled", "skill", "killer whale",
  "killingworth", "shuttle", "whatever", "what", "white", "whitney",
  "cumulus", "cumulative", "document", "accumulate", "boobook",
  "titmouse", "titanium", "titan", "sextet", "sextuplets"
];

const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i", "+": "t" };

function foldLeet(text) {
  return text.replace(/[0134578@$!+]/g, (c) => LEET[c] || c);
}

function normalize(text) {
  return foldLeet(String(text || "").toLowerCase());
}

/* "fuuuck" and "fuck" are the same word to a child. Singling
   collapses every run of the same letter to one, on BOTH sides
   of the comparison — the text's and the list's — so stretched
   spellings meet their plain forms. Short results are never
   singled-matched (below length 3, innocent words like "as"
   would collide). */
function single(text) {
  return text.replace(/(.)\1+/g, "$1");
}

function tokensOf(text) {
  return normalize(text).split(/[^a-z]+/).filter(Boolean);
}

/*
 * Squeezed candidates: the spacing trick splits ONE word into
 * little pieces ("f u c k"), so the squeeze is applied to each
 * chunk on its own and to runs of tiny chunks (one or two
 * letters each) joined together — never across whole real
 * words, where innocent joins live ("boat it sailed" must not
 * read as a bad word; it once did, and that is why this is
 * written this way). Longer list words (six letters or more,
 * singled) are also checked against the whole field squeezed,
 * with the innocent-span cover below.
 */
function squeezedCandidates(text) {
  const chunks = normalize(text).split(/[^a-z]+/).filter(Boolean);
  const out = chunks.map(single);
  let run = "";
  const flush = () => { if (run) out.push(single(run)); run = ""; };
  for (const chunk of chunks) {
    if (chunk.length <= 2) run += chunk;
    else { flush(); }
  }
  flush();
  out.push(single(normalize(text).replace(/[^a-z]/g, "")));
  return out;
}

function phraseTokens(phrase) {
  return phrase.split(/\s+/).filter(Boolean);
}

function streamContainsPhrase(stream, want) {
  if (want.length === 1) return stream.includes(want[0]);
  for (let i = 0; i + want.length <= stream.length; i++) {
    if (want.every((w, j) => stream[i + j] === w)) return true;
  }
  return false;
}

/* Does the token stream contain the phrase — exactly, or with
   letters stretched ("fuuuck", "biiitch")? */
function tokensContainPhrase(tokens, phrase) {
  const want = phraseTokens(phrase);
  if (streamContainsPhrase(tokens, want)) return true;
  const singledWant = want.map(single);
  if (singledWant.some((w) => w.length < 3)) return false;
  return streamContainsPhrase(tokens.map(single), singledWant);
}

function squeezedTrips(candidates) {
  for (const word of STRONG) {
    if (word.includes(" ")) continue;
    const w = single(word);
    if (w.length < 4) continue;
    /* short list words: only inside a chunk or a tiny-chunk run */
    const fields = w.length >= 6 ? candidates : candidates.slice(0, -1);
    for (const squeezed of fields) {
      let at = squeezed.indexOf(w);
      while (at !== -1) {
        /* the match is innocent if a known innocent word spans it */
        const covered = INNOCENT.some((innocent) => {
          const inn = single(innocent.replace(/\s+/g, ""));
          for (let start = Math.max(0, at - inn.length + 1); start <= at; start++) {
            if (squeezed.slice(start, start + inn.length) === inn && start + inn.length >= at + w.length) return true;
          }
          return false;
        });
        if (!covered) return true;
        at = squeezed.indexOf(w, at + 1);
      }
    }
  }
  return false;
}

/**
 * Screen one piece of text. Returns true when the text is
 * clean enough for Aiyana's eyes, false when it must be held.
 */
export function textIsClean(text) {
  if (!text) return true;
  const tokens = tokensOf(text);
  for (const word of STRONG) {
    if (tokensContainPhrase(tokens, word)) return false;
  }
  for (const word of MILD) {
    if (tokensContainPhrase(tokens, word)) return false;
  }
  if (squeezedTrips(squeezedCandidates(text))) return false;
  return true;
}

/** Screen a whole submission: pen name, title, and story. */
export function submissionIsClean({ penName, title, story } = {}) {
  return textIsClean(penName) && textIsClean(title) && textIsClean(story);
}
