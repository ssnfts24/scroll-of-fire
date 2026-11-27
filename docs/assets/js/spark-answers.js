/*
 * The Spark answers (Aaron, Nov 26, 2026, 19:42 PST:
 * "Make sure all the systems of it are very easy to use and
 * understand. App like. The spark needs to be way more
 * intelligent.")
 *
 * The intelligence, as his standing rulings shape it: the
 * keeper's own Spark can be ASKED about their own world in
 * plain words, and it answers from the REAL record, on this
 * device — the calendar core's day, the Spark record's
 * sealed days, the card album's held copies, the lean's
 * counted walks, the found-garden's counts, and the room
 * knowledge the tours already carry. Every fact in an
 * answer is read from the snapshot the layer hands in, in
 * that moment. Nothing is invented: a record the layer
 * could not read is answered as unseen ("I can't see your
 * album from here"), never as empty; a question the Spark
 * cannot ground is answered plainly as not known.
 *
 * This is the KEEPER's Spark, reading the keeper's own
 * records. It is not the Codex Guide — the visitor-facing
 * program is a separate, already-ruled piece, and nothing
 * here builds toward it. No network, no outside service:
 * this module is pure, storage-free, and date-free, like
 * the lean's core — the browser layer assembles the
 * snapshot and hands it in.
 *
 * The snapshot ("world"):
 *   sparkName  the Spark's name, as the record gives it
 *   day        today's Pattern Day number, or null
 *   today      { moon, day, dayOfPatternYear, moonName,
 *                dayName, dayGloss, outside } or null when
 *              the calendar could not be read on this page
 *   sealedDays the record's kept days (Pattern Day numbers)
 *   cards      [{ name, foundDay }] for held copies, or
 *              null when the album could not be read here
 *   rooms      [{ page, label, visits }] in catalogue
 *              order, or null when no walk has been counted
 *   moved      { text, href, label, day } — the last thing
 *              that moved the keeper (the lean's warmth)
 *   room       { name, about } — this room's own tour
 *              knowledge, or null
 *   spans      { refusal, rest } — the lean's remembered
 *              "no" spans, in Pattern Days
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.SparkAnswers = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const REFUSAL_SLEEP_DAYS = 28; // a "no" is remembered for a Moon (the lean's law)
  const OFFER_REST_DAYS = 7;     // a shown offer rests a week

  /* The rooms the Spark can speak of, in the order it
   * names them: the catalogue of the house's main rooms,
   * each with the plain name a keeper would use. */
  const ROOM_LABELS = [
    ["index.html", "the first page"],
    ["living-time-sphere.html", "the Sphere"],
    ["companions.html", "Their Home"],
    ["garden.html", "the Garden"],
    ["card-album.html", "the Card Album"],
    ["moons.html", "the Moons"],
    ["episodes.html", "the Episode Library"],
    ["practices.html", "the Practices"],
    ["one-word.html", "One Word a Day"],
    ["teach.html", "the Visual Exercise"],
    ["shop.html", "the Spark Stall"],
    ["hub.html", "the Systems Hub"],
    ["codex-atlas.html", "the Codex Atlas"],
    ["equinox-passage.html", "the Equinox Passage"],
    ["timeline.html", "the Timeline"]
  ];

  /* The questions a keeper can tap. The ask layer shows
   * these as big tappable words; the same list is what the
   * Spark names when it cannot ground a typed question. */
  const QUESTIONS = [
    { id: "day", label: "What day is it?" },
    { id: "witnessed", label: "What have I witnessed?" },
    { id: "cards", label: "What cards do I hold?" },
    { id: "found", label: "What have we found together?" },
    { id: "away", label: "Where haven't I been in a while?" },
    { id: "room", label: "What is this room?" },
    { id: "next", label: "What should I do next?" }
  ];

  const QUESTION_IDS = new Set(QUESTIONS.map((q) => q.id));

  /* Plain-word matching for a typed question. The rules
   * are few and readable on purpose: a keeper can guess
   * how to ask, because the words are the obvious ones. */
  const MATCHERS = [
    ["room", /\b(this room|this page|where am i|what is this|what can i do here|do here|about this place)\b/],
    ["away", /\b(haven'?t|havent|not been|in a while|least|never been|missed|unvisited)\b/],
    ["next", /\b(next|should i|what now|waiting|to do|do now)\b/],
    ["witnessed", /\b(witness|witnessed|sealed|seal|kept days|days have i)\b/],
    ["cards", /\b(card|cards|album)\b/],
    ["found", /\b(found|find|finds|together|garden of)\b/],
    ["day", /\b(day|today|moon|pattern|date)\b/]
  ];

  function matchQuestion(text) {
    const t = String(text || "").toLowerCase();
    if (!t.trim()) return null;
    for (const [id, re] of MATCHERS) {
      if (re.test(t)) return id;
    }
    return null;
  }

  function cap(text) {
    const s = String(text || "");
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function plural(n, one, many) {
    return n === 1 ? one : many;
  }

  /* ---- the day ---- */
  function answerDay(world) {
    const today = world.today;
    if (!today) {
      return "I can't read the day from here — the calendar isn't in front of me on this page.";
    }
    if (today.outside) {
      return `Today stands outside the count — ${today.moonName || "the Day Out of Time"}. It belongs to no Moon, and it carries no Pattern Day.`;
    }
    let text = `Today is Pattern Day ${today.dayOfPatternYear} — day ${today.day} of Moon ${today.moon}` +
      (today.moonName ? `, the ${today.moonName} moon.` : ".");
    if (today.dayName) {
      text += ` The Codex names this day ${today.dayName}`;
      const gloss = today.dayGloss ? String(today.dayGloss).replace(/\.\s*$/, "") : "";
      text += gloss ? ` — ${gloss}.` : ".";
    }
    return text;
  }

  /* ---- witnessed / left open ---- */
  function sealedList(world) {
    const days = Array.isArray(world.sealedDays) ? world.sealedDays : [];
    return [...new Set(days.filter((d) => typeof d === "number"))].sort((a, b) => a - b);
  }

  function answerWitnessed(world) {
    const days = sealedList(world);
    const today = world.today;
    const pd = today && typeof today.dayOfPatternYear === "number" ? today.dayOfPatternYear : null;
    if (!days.length) {
      let text = "No days are sealed yet. A sealed day is a day you kept — ";
      text += pd !== null ? `today, Pattern Day ${pd}, could be the first.` : "today could be the first.";
      return text;
    }
    let text = `You have sealed ${days.length} ${plural(days.length, "day", "days")}. The last was Pattern Day ${days[days.length - 1]}.`;
    if (pd !== null) {
      text += days.includes(pd)
        ? ` Today — Pattern Day ${pd} — is already sealed.`
        : ` Today — Pattern Day ${pd} — is still open.`;
    }
    return text;
  }

  /* ---- the cards ---- */
  function lastFound(cards) {
    let best = null;
    for (const c of cards) {
      if (typeof c.foundDay === "number" && (!best || c.foundDay >= best.foundDay)) best = c;
    }
    return best;
  }

  function answerCards(world) {
    if (!Array.isArray(world.cards)) {
      return "I can't see your album from here — it isn't in front of me on this page.";
    }
    const cards = world.cards;
    if (!cards.length) {
      return "Your album is empty for now. Cards are found by doing the work — walking the days, keeping the practices. The road gives them; they are never bought.";
    }
    const names = cards.map((c) => c.name);
    const shown = names.slice(0, 4);
    let list = shown.join(", ");
    if (names.length > shown.length) list += `, and ${names.length - shown.length} more`;
    let text = `You hold ${cards.length} ${plural(cards.length, "card", "cards")}: ${list}.`;
    const last = lastFound(cards);
    if (last) text += ` The last one you found was ${last.name} — Pattern Day ${last.foundDay}.`;
    return text;
  }

  /* ---- found together (the garden of finds) ---- */
  function answerFound(world) {
    const days = sealedList(world);
    const cards = Array.isArray(world.cards) ? world.cards : null;
    if ((!cards || !cards.length) && !days.length) {
      return "Nothing found together yet. The first finding — a card on the road, a day sealed — starts the garden.";
    }
    const parts = [];
    if (cards) parts.push(`${cards.length} ${plural(cards.length, "card", "cards")} in the album`);
    if (days.length) parts.push(`${days.length} ${plural(days.length, "day", "days")} sealed`);
    let text = `Together we have found ${parts.join(" and ")}. They stand in the garden of finds, on the Garden page.`;
    if (!cards) text += " I can't see the album from here, so the cards aren't in that count.";
    return text;
  }

  /* ---- where haven't I been ---- */
  function answerAway(world) {
    const rooms = Array.isArray(world.rooms) ? world.rooms : null;
    if (!rooms || !rooms.length) {
      return "I haven't learned your walks yet. I count the rooms as you visit them — on this device only — and then I can tell you.";
    }
    const fresh = rooms.find((r) => !r.visits);
    if (fresh) {
      return `You haven't walked ${fresh.label} yet — that room is still new to us.`;
    }
    let least = rooms[0];
    for (const r of rooms) if (r.visits < least.visits) least = r;
    return `Of the rooms I count, ${least.label} is the one you've walked least — ${least.visits} ${plural(least.visits, "time", "times")} in all.`;
  }

  /* ---- this room ---- */
  function answerRoom(world) {
    if (!world.room || !world.room.about) {
      return "I don't have this room's story in front of me. Its ✦ Tour walks it with you — that's where I keep what I know of each room.";
    }
    return world.room.about;
  }

  /* ---- the next step, from the keeper's real state ----
   * One clear thing, naming the keeper's actual things:
   * the warmth first (the lean's standing order), then the
   * unwitnessed day by its number and Moon, then a room
   * never walked, then the card found in the last few days,
   * then the least-walked room. Every candidate stands
   * under the lean's remembered "no": a refused step sleeps
   * a Moon, a shown step rests a week — checked against the
   * lean state the layer hands in, with the lean's spans. */
  function nextStep(world, leanState) {
    const day = typeof world.day === "number" ? world.day : null;
    const spans = world.spans || {};
    const refusalSpan = typeof spans.refusal === "number" ? spans.refusal : REFUSAL_SLEEP_DAYS;
    const restSpan = typeof spans.rest === "number" ? spans.rest : OFFER_REST_DAYS;
    const asleep = (id, table, span) => {
      const at = table && table[id];
      return typeof at === "number" && day !== null && day - at < span;
    };
    const clear = (id) =>
      !asleep(id, leanState && leanState.refusals, refusalSpan) &&
      !asleep(id, leanState && leanState.shown, restSpan);

    const candidates = [];

    if (world.moved && day !== null && typeof world.moved.day === "number" && day > world.moved.day) {
      candidates.push({
        id: "warmth",
        text: world.moved.text,
        href: world.moved.href || null,
        label: world.moved.label || "Return to it"
      });
    }

    const today = world.today;
    if (today && typeof today.dayOfPatternYear === "number" && !today.outside) {
      const pd = today.dayOfPatternYear;
      if (!sealedList(world).includes(pd)) {
        candidates.push({
          id: "mind-open-day",
          text: `Today — Pattern Day ${pd}, day ${today.day} of ${today.moonName ? `the ${today.moonName} moon` : `Moon ${today.moon}`} — is still open. Sealing it is a tap on the first page.`,
          href: "index.html",
          label: "See today"
        });
      }
    }

    const rooms = Array.isArray(world.rooms) ? world.rooms : null;
    if (rooms && rooms.length) {
      const fresh = rooms.find((r) => !r.visits);
      if (fresh) {
        candidates.push({
          id: "mind-room-" + fresh.page,
          text: `You haven't walked ${fresh.label} yet — that room is still new to us.`,
          href: fresh.page,
          label: "Walk it"
        });
      }
    }

    if (Array.isArray(world.cards) && day !== null) {
      const last = lastFound(world.cards);
      if (last && day - last.foundDay >= 1 && day - last.foundDay <= 3) {
        candidates.push({
          id: "mind-card",
          text: day - last.foundDay === 1
            ? `Yesterday you found ${last.name}. It stands in your album.`
            : `On Pattern Day ${last.foundDay} you found ${last.name}. It stands in your album.`,
          href: "card-album.html",
          label: "Open the album"
        });
      }
    }

    if (rooms && rooms.length && rooms.every((r) => r.visits > 0)) {
      let least = rooms[0];
      for (const r of rooms) if (r.visits < least.visits) least = r;
      candidates.push({
        id: "mind-room-" + least.page,
        text: `Of your rooms, ${least.label} is the one you've walked least — ${least.visits} ${plural(least.visits, "time", "times")} in all.`,
        href: least.page,
        label: "Go back"
      });
    }

    for (const c of candidates) {
      if (clear(c.id)) return c;
    }
    return null;
  }

  function answerNext(world, leanState) {
    const step = nextStep(world, leanState);
    if (step) return { text: step.text, href: step.href, label: step.label };
    return {
      text: "Nothing is calling right now. When something waits — a day left open, a room unwalked — I'll name it here.",
      href: null,
      label: null
    };
  }

  /* Answer a question — by its id, or by the keeper's own
   * typed words. Returns { id, text } (the "next" answer
   * also carries its step's href/label, so the layer can
   * offer the road as a tappable word). A question that
   * matches nothing is answered as not known — plainly,
   * with the questions the Spark CAN ground named back. */
  function answer(question, world, leanState) {
    const w = world || {};
    let id = null;
    if (typeof question === "string" && QUESTION_IDS.has(question)) id = question;
    else id = matchQuestion(question);
    switch (id) {
      case "day": return { id, text: answerDay(w) };
      case "witnessed": return { id, text: answerWitnessed(w) };
      case "cards": return { id, text: answerCards(w) };
      case "found": return { id, text: answerFound(w) };
      case "away": return { id, text: answerAway(w) };
      case "room": return { id, text: answerRoom(w) };
      case "next": {
        const r = answerNext(w, leanState);
        return { id, text: r.text, href: r.href, label: r.label };
      }
      default:
        return {
          id: "unknown",
          text: "I don't know that one yet. I answer from your own records — ask me about the day, your cards, the days you've sealed, what we've found, or where you haven't been."
        };
    }
  }

  return {
    QUESTIONS,
    ROOM_LABELS,
    REFUSAL_SLEEP_DAYS,
    OFFER_REST_DAYS,
    matchQuestion,
    nextStep,
    answer
  };
});
