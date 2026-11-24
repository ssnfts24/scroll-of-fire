/**
 * The Spark, inhabiting the Sphere — slice 1 (Nov 23, 2026).
 *
 * Aaron's direction ("Spark — Living Play and Companion
 * Expansion"): the Spark must become an inhabitant of the actual
 * Living Sphere rather than an animated layer placed over it.
 * This module is the first slice of that, and it lives where the
 * fences say it must: in the companion layer, on the page by
 * sphere-companion-layer.js's loader, touching no protected file.
 *
 * What it does, honestly stated:
 *
 *  TRAVEL ON REAL GEOMETRY. The Spark's presence (the holder
 *  sphere-spark.js builds) is driven from the calendar's own
 *  published projection: the label layer projects every faced
 *  day's plate into the page as a semantic label
 *  (data-semantic-id="pattern-day-number-N"), and the Spark
 *  stands on that projection — on today's plate at rest, and on
 *  the keeper's selected day when the selection moves. Selection
 *  still flows through the canonical pipeline and the page's own
 *  controls; this module only reads the state strip and the
 *  projected labels, the way the Genesis layer (PR #276) reads
 *  the strip. Its movement is the ruled vocabulary: a drift with
 *  a hop's arc, tracking the plate as the instrument turns.
 *
 *  ENTERING THE DAY. When the keeper opens a day — the page
 *  carries day-world-open on its root while the Day World is
 *  open — the Spark steps through the door with them: its holder
 *  (the companion layer's own element) is reparented into the
 *  Day World room itself and takes its station at the day
 *  sheet's top-right, present inside the day's environment
 *  alongside the keeper. (The room is a fixed body-level room;
 *  nothing inside the stage wrap can be seen inside it, so
 *  entering had to be literal or not at all.) When the keeper
 *  comes back out, the holder steps back into the wrap and the
 *  Spark returns to the selected day's plate.
 *
 *  IDLE LIFE. While the keeper is still, the Spark lives on its
 *  own: it sits, observes, rests, or drifts to a nearby day and
 *  looks, then returns. The choice leans on the keeper's own
 *  record where the record supports a preference (the play log's
 *  kinds, read through SphereSpark.playSummary's own counting
 *  where available), and falls back to plain defaults where it
 *  does not. Any keeper action ends idle behaviour at once.
 *
 *  ENVIRONMENT. The Spark's light answers the keeper's local
 *  time of day — morning, day, evening, night — in the same
 *  daypart bands the Spark's living voice already keeps.
 *
 *  Slice 1 writes NOTHING to the record: travel, idling and
 *  entering are showings, and the play/care/tricks design's rule
 *  is that showings write nothing. It reads the record only to
 *  lean its idle choices. A marker pinned inside the 3D scene
 *  itself would need the protected renderer's hooks; that piece
 *  is held for Aaron's word, exactly as the Genesis layer's
 *  in-scene marker is held — not faked here.
 *
 *  The pure half (readout parsing, ring math, the hop arc, the
 *  idle choice) carries no DOM dependency and is unit-tested.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  root.SphereSparkInhabitant = api;
  api.mount(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const IDLE_AFTER_MS = 24000;
  const PATTERN_DAYS = 364;

  /* The state strip's own grammar — the same forms the Genesis
   * layer and the story doors parse. */
  function parseReadout(text) {
    const t = String(text || "");
    const full = t.match(/Moon (\d{1,2}) · Day (\d{1,2}) · Day (\d{1,3})\/364/);
    if (full) return { moon: Number(full[1]), day: Number(full[2]), patternDay: Number(full[3]) };
    const part = t.match(/Moon (\d{1,2}) · Day (\d{1,2})/);
    if (part) return { moon: Number(part[1]), day: Number(part[2]), patternDay: patternDayFor(Number(part[1]), Number(part[2])) };
    return null;
  }

  function patternDayFor(moon, day) {
    const m = Number(moon), d = Number(day);
    if (!Number.isInteger(m) || !Number.isInteger(d)) return null;
    if (m < 1 || m > 13 || d < 1 || d > 28) return null;
    return (m - 1) * 28 + d;
  }

  function moonDayFor(patternDay) {
    const pd = Number(patternDay);
    if (!Number.isInteger(pd) || pd < 1 || pd > PATTERN_DAYS) return null;
    return { moon: Math.floor((pd - 1) / 28) + 1, day: ((pd - 1) % 28) + 1 };
  }

  /* The shortest signed walk along the 364-day ring, from one
   * Pattern Day to another: positive walks forward through the
   * year, negative backward; the ring wraps at the Year Gate. */
  function ringDistance(fromPd, toPd) {
    const a = Number(fromPd), b = Number(toPd);
    if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
    let d = (((b - a) % PATTERN_DAYS) + PATTERN_DAYS) % PATTERN_DAYS;
    if (d > PATTERN_DAYS / 2) d -= PATTERN_DAYS;
    return d;
  }

  /* The hop's arc: height at progress t (0..1) for a travel of
   * distPx screen pixels — a low hop for a near day, a higher
   * one for a Moon-crossing drift, always bounded. */
  function hopArc(t, distPx) {
    const p = Math.min(1, Math.max(0, Number(t) || 0));
    if (p <= 0 || p >= 1) return 0;
    const dist = Math.max(0, Number(distPx) || 0);
    const peak = Math.min(46, Math.max(6, dist * 0.18));
    return Math.sin(Math.PI * p) * peak;
  }

  function travelDurationMs(distPx) {
    const dist = Math.max(0, Number(distPx) || 0);
    return Math.round(Math.min(3400, Math.max(650, 500 + dist * 1.15)));
  }

  /* The Spark's dayparts — the same bands sphere-spark.js's
   * living voice keeps (daypartForHour), named for the keeper's
   * own clock: morning, day, evening, night. */
  function daypartForHour(hour) {
    const h = Number(hour);
    if (!Number.isFinite(h)) return "night";
    return h >= 5 && h < 10 ? "morning" : h >= 10 && h < 17 ? "day" : h >= 17 && h < 21 ? "evening" : "night";
  }

  /* The idle choice. playKinds is the keeper's own play-log
   * counting ({chase: n, echo: n, ...}) or null where the record
   * holds none; roll is a 0..1 draw, passed in so the choice is
   * testable. The lean is honest and small: a Spark whose keeper
   * plays chase goes visiting; one whose keeper plays echo sits
   * and glows (observe); night rests, whatever the record says.
   * Nothing here is a progression — it is a temperament for an
   * idle moment, re-chosen each time. */
  function pickIdle(playKinds, daypart, roll) {
    const r = Math.min(0.999999, Math.max(0, Number(roll) || 0));
    const kinds = playKinds && typeof playKinds === "object" ? playKinds : {};
    const chase = Number(kinds.chase || 0);
    const echo = Number(kinds.echo || 0);
    let weights;
    if (daypart === "night") {
      weights = { rest: 0.55, sit: 0.2, observe: 0.15, visit: 0.1 };
    } else if (chase > 0 && chase >= echo) {
      weights = { visit: 0.45, observe: 0.2, sit: 0.2, rest: 0.15 };
    } else if (echo > 0) {
      weights = { observe: 0.45, sit: 0.25, visit: 0.15, rest: 0.15 };
    } else {
      weights = { sit: 0.3, observe: 0.3, visit: 0.2, rest: 0.2 };
    }
    let acc = 0;
    for (const name of ["sit", "observe", "rest", "visit"]) {
      acc += weights[name];
      if (r < acc) return name;
    }
    return "sit";
  }

  /* Play-log kinds, counted the plain way from a record — the
   * fallback when SphereSpark's own summary is not on the page. */
  function playKindCounts(record) {
    const log = Array.isArray(record?.playLog) ? record.playLog : [];
    const counts = {};
    for (const e of log) {
      if (e && typeof e.kind === "string") counts[e.kind] = (counts[e.kind] || 0) + 1;
    }
    return counts;
  }

  function mount(root) {
    const document = root.document;
    if (!document) return;
    const wrap = document.querySelector(".sphere-canvas-wrap");
    const strip = document.getElementById("sphere-state-strip");
    if (!wrap || !strip) return;

    const reducedMotion = typeof root.matchMedia === "function"
      && root.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let holder = null;
    let raf = 0;
    let destroyed = false;

    /* ── State ─────────────────────────────────────────────── */
    let postPd = null;          // the Pattern Day the Spark stands on / travels to
    let todayPd = null;         // today's Pattern Day (home)
    let mode = "posted";        // posted | travelling | idle | in-day
    let posture = "stand";      // stand | settle | sit | observe | rest
    let pos = null;             // {x, y} wrap-relative centre, once placed
    let travel = null;          // {from:{x,y}, startedAt, durationMs, targetPd}
    let lastActionAt = Date.now();
    let idleUntil = 0;          // posture behaviours: when this idle act ends
    let idleReturnPd = null;    // a visit's way home
    let lastStripText = null;
    let missingSince = null;    // when the post's label was last seen present

    function readRecord() {
      try {
        const raw = root.localStorage?.getItem("sof.spark.v1");
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    }

    function labelFor(pd) {
      if (!pd) return null;
      return document.querySelector(`[data-semantic-id="pattern-day-number-${pd}"]`);
    }

    function labelPoint(pd) {
      const el = labelFor(pd);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      const wr = wrap.getBoundingClientRect();
      return {
        x: r.x - wr.x + r.width / 2,
        y: r.y - wr.y + r.height / 2,
        plate: Math.max(r.width, r.height),
      };
    }

    function writeTransform(x, y, scale) {
      holder.style.transform =
        `translate(${Math.round(x - 34)}px, ${Math.round(y - 34)}px) scale(${scale.toFixed(3)})`;
    }

    function scaleFor(plate) {
      if (!plate) return 0.9;
      return Math.min(1.12, Math.max(0.55, plate / 30));
    }

    function setPosture(next) {
      if (posture === next) return;
      posture = next;
      holder.dataset.inhabitantPosture = next;
    }

    /* The module's state, mirrored onto the holder where the
     * page's other instruments can read it — the same honesty
     * the diagnostics readouts practise. */
    function mirrorState() {
      if (!holder) return;
      if (holder.dataset.inhabitantMode !== mode) holder.dataset.inhabitantMode = mode;
      const post = postPd == null ? "" : String(postPd);
      if (holder.dataset.inhabitantPost !== post) holder.dataset.inhabitantPost = post;
    }

    function setDaypart() {
      const dp = daypartForHour(new Date().getHours());
      if (holder.dataset.inhabitantDaypart !== dp) holder.dataset.inhabitantDaypart = dp;
    }

    /* ── Travel ────────────────────────────────────────────── */
    function travelTo(pd) {
      if (!pd || pd === postPd) return;
      const target = labelPoint(pd);
      postPd = pd;
      if (!pos || !target || reducedMotion) {
        // No honest path to draw (first placement, the plate not
        // projected yet, or the keeper prefers stillness): the
        // Spark simply takes its post; the frame loop settles it.
        travel = null;
        if (mode !== "in-day") mode = "posted";
        return;
      }
      const dist = Math.hypot(target.x - pos.x, target.y - pos.y);
      travel = {
        from: { x: pos.x, y: pos.y },
        startedAt: performance.now(),
        durationMs: travelDurationMs(dist),
        dist,
        targetPd: pd,
      };
      mode = "travelling";
      setPosture("stand");
    }

    /* ── The frame loop ────────────────────────────────────── */
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (destroyed || !holder || !document.contains(holder)) {
        destroyed = true;
        cancelAnimationFrame(raf);
        return;
      }
      if (document.hidden) return;
      setDaypart();
      mirrorState();

      const frozen = Boolean(root.SphereRebuild?.isFrozen?.());

      if (mode === "in-day") {
        const station = dayStation();
        if (station) {
          pos = pos
            ? { x: pos.x + (station.x - pos.x) * 0.2, y: pos.y + (station.y - pos.y) * 0.2 }
            : station;
          writeTransform(pos.x, pos.y, 0.95);
        }
        return;
      }

      if (frozen) { setPosture("rest"); return; }

      /* Idle entry: the keeper has been still a while, the Spark
       * is posted, and nothing else owns the moment. (Idle timing
       * runs on the wall clock; travel progress below runs on
       * the rAF clock — the two are never mixed.) */
      const wallNow = Date.now();
      if (mode === "posted" && wallNow - lastActionAt > IDLE_AFTER_MS && wallNow > idleUntil) {
        beginIdle();
      }

      if (mode === "idle") {
        if (wallNow >= idleUntil) endIdle();
        else if (idleReturnPd != null) {
          // A visit: stand on the visited day and look. If the
          // visited plate rotates out of projection, the visit
          // is over — the Spark comes home rather than hovering
          // where the day used to be.
          const p = labelPoint(postPd);
          if (p) {
            missingSince = null;
            pos = { x: p.x, y: p.y }; writeTransform(p.x, p.y, scaleFor(p.plate));
          } else {
            if (missingSince == null) missingSince = now;
            if (now - missingSince > 1500) { missingSince = null; endIdle(); }
          }
          return;
        } else {
          // A posture behaviour: stay on the post, in posture.
          const p = labelPoint(postPd);
          if (p) { pos = { x: p.x, y: p.y }; writeTransform(p.x, p.y, scaleFor(p.plate)); }
          return;
        }
      }

      if ((mode === "travelling" || mode === "travelling-visit") && travel) {
        const target = labelPoint(travel.targetPd);
        if (!target) {
          // The plate has not come around yet: wait at the
          // threshold, low on the face, until it is projected.
          waitAtThreshold();
          return;
        }
        const t = Math.min(1, (now - travel.startedAt) / travel.durationMs);
        const ease = t * (2 - t);
        const x = travel.from.x + (target.x - travel.from.x) * ease;
        const y = travel.from.y + (target.y - travel.from.y) * ease - hopArc(t, travel.dist);
        pos = { x, y };
        writeTransform(x, y, scaleFor(target.plate) * (1 + 0.06 * Math.sin(Math.PI * t)));
        if (t >= 1) {
          const wasVisit = mode === "travelling-visit";
          travel = null;
          if (wasVisit) {
            // Arrived on the visited day: stay a while and look.
            mode = "idle";
            idleUntil = Date.now() + 6000;
            setPosture("observe");
          } else {
            mode = "posted";
            setPosture("settle");
            window.setTimeout(() => { if (mode === "posted") setPosture("stand"); }, 900);
          }
        }
        return;
      }

      /* Posted: stand on the post's plate, tracking it as the
       * instrument turns under it. */
      if (postPd) {
        const p = labelPoint(postPd);
        if (p) {
          missingSince = null;
          pos = { x: p.x, y: p.y };
          writeTransform(p.x, p.y, scaleFor(p.plate));
          holder.style.opacity = "";
        } else {
          if (missingSince == null) missingSince = now;
          if (now - missingSince > 2500) waitAtThreshold();
        }
      }
    }

    function waitAtThreshold() {
      const wr = wrap.getBoundingClientRect();
      if (!wr.width || !wr.height) return;
      const x = wr.width / 2, y = wr.height - 30;
      pos = pos
        ? { x: pos.x + (x - pos.x) * 0.08, y: pos.y + (y - pos.y) * 0.08 }
        : { x, y };
      writeTransform(pos.x, pos.y, 0.8);
      holder.style.opacity = "0.85";
    }

    /* While the keeper is inside a day, the Spark's station is
     * the top-right of the day's own sheet, in the room's own
     * coordinate space (the holder is a guest in the room then —
     * see enterDay). The sheet is re-read every frame, so the
     * Spark rides the room's own scroll. */
    function dayStation() {
      if (!dayRoom) return null;
      const rr = dayRoom.getBoundingClientRect();
      const sheet = dayRoom.querySelector(".day-world-sheet");
      if (sheet) {
        const r = sheet.getBoundingClientRect();
        if (r.width) {
          return {
            x: (r.x - rr.x) + dayRoom.scrollLeft + r.width - 48,
            y: (r.y - rr.y) + dayRoom.scrollTop + 38,
          };
        }
      }
      return { x: dayRoom.scrollLeft + Math.max(60, rr.width - 60), y: dayRoom.scrollTop + 48 };
    }

    /* ── Idle life ─────────────────────────────────────────── */
    function beginIdle() {
      const record = readRecord();
      const counts = playKindCounts(record);
      const pick = pickIdle(counts, daypartForHour(new Date().getHours()), Math.random());
      const wallNow = Date.now();
      mode = "idle";
      if (pick === "visit" && !reducedMotion && postPd && pos) {
        const step = [1, 2, 3, -1, -2, -3][Math.floor(Math.random() * 6)];
        let dest = postPd + step;
        if (dest > PATTERN_DAYS) dest -= PATTERN_DAYS;
        if (dest < 1) dest += PATTERN_DAYS;
        const target = labelPoint(dest);
        if (target) {
          idleReturnPd = postPd;
          postPd = dest;
          const dist = Math.hypot(target.x - pos.x, target.y - pos.y);
          travel = { from: { x: pos.x, y: pos.y }, startedAt: performance.now(), durationMs: travelDurationMs(dist), dist, targetPd: dest };
          mode = "travelling-visit";
          idleUntil = wallNow + 20000; // travel + the stay, bounded by the arrival reset in frame()
          setPosture("observe");
          return;
        }
        // The neighbouring day is not projected from here (a Moon
        // boundary, most likely): observe from the post instead.
        idleUntil = wallNow + 8000;
        setPosture("observe");
        return;
      }
      idleReturnPd = null;
      idleUntil = wallNow + (pick === "rest" ? 11000 : 8000);
      setPosture(pick === "visit" ? "observe" : pick);
    }

    function endIdle() {
      if (idleReturnPd != null && postPd !== idleReturnPd) {
        const home = idleReturnPd;
        idleReturnPd = null;
        idleUntil = Date.now() + IDLE_AFTER_MS; // a quiet spell before the next act
        travelTo(home);
        return;
      }
      idleReturnPd = null;
      mode = "posted";
      setPosture("stand");
      idleUntil = Date.now() + IDLE_AFTER_MS;
      lastActionAt = Date.now() - IDLE_AFTER_MS / 2;
    }

    /* A visit travels under its own mode so the keeper's
     * selection arriving mid-visit can still take over. */
    function noteAction() {
      lastActionAt = Date.now();
      if (mode === "idle" || mode === "travelling-visit") {
        if (idleReturnPd != null && postPd !== idleReturnPd) {
          const home = idleReturnPd;
          idleReturnPd = null;
          travelTo(home);
        } else {
          idleReturnPd = null;
          mode = "posted";
        }
        setPosture("stand");
      }
    }

    /* ── Selection: the strip is the public readout ────────── */
    function onStrip() {
      const text = (strip.textContent || "").trim().replace(/\s+/g, " ");
      if (text === lastStripText) return;
      lastStripText = text;
      const coord = parseReadout(text);
      if (!coord || !coord.patternDay) return;
      if (text.startsWith("Today")) todayPd = coord.patternDay;
      if (todayPd == null) todayPd = coord.patternDay;
      noteAction();
      if (mode !== "in-day" && coord.patternDay !== postPd) travelTo(coord.patternDay);
      else if (mode !== "in-day" && postPd == null) { postPd = coord.patternDay; }
    }

    /* ── Entering the day ──────────────────────────────────── */
    /* The Day World room is a fixed, body-level room of its own
     * (z-index 1200): nothing inside the stage wrap can be seen
     * inside it. So entering is literal — the Spark's holder,
     * which is the companion layer's own element, steps through
     * the door and takes its place in the room, at the day sheet's
     * top-right; when the keeper comes back out, the holder steps
     * back into the wrap and the Spark returns to its plate. The
     * move is a plain reparenting of the layer's own node: every
     * reference the presence keeps (its button, its observers)
     * rides along untouched. */
    let dayRoom = null;

    function enterDay() {
      const room = document.querySelector(".day-world");
      if (room && holder.parentElement !== room) {
        room.appendChild(holder);
        holder.style.position = "absolute";
        holder.style.left = "0px";
        holder.style.top = "0px";
        holder.style.zIndex = "5";
        dayRoom = room;
        pos = null; // room space is not wrap space; take the station fresh
      }
      mode = "in-day";
      travel = null;
      setPosture("observe");
      holder.dataset.inhabitantInDay = "1";
    }

    function exitDay() {
      if (dayRoom && holder.parentElement === dayRoom) {
        wrap.appendChild(holder);
        holder.style.position = "";
        holder.style.left = "";
        holder.style.top = "";
        holder.style.zIndex = "12"; // the face standing, restored (see takeOver)
      }
      dayRoom = null;
      delete holder.dataset.inhabitantInDay;
      pos = null;
      mode = "posted";
      setPosture("stand");
      if (postPd) { const pd = postPd; postPd = null; travelTo(pd); }
    }

    function onDayWorld() {
      const open = document.documentElement.classList.contains("day-world-open");
      if (open && mode !== "in-day") enterDay();
      else if (!open && mode === "in-day") exitDay();
    }

    /* ── Takeover ──────────────────────────────────────────── */
    function takeOver(found) {
      if (holder) return;
      holder = found;
      holder.dataset.inhabitantDriven = "1";
      holder.dataset.inhabitantPosture = "stand";
      /* The Spark stands ON the plates, so it stands above the
       * label layer that projects them (the layer rides at
       * z-index 11 in the wrap): a keeper zoomed close to today
       * sees the Spark on the day's gilded disc, not tucked
       * behind its ring. The page's own cards and doors keep
       * their higher ground. */
      holder.style.zIndex = "12";
      setDaypart();
      wrap.classList.add("sphere-inhabitant-on");
      onStrip();
      if (postPd) {
        const p = labelPoint(postPd);
        if (p) { pos = { x: p.x, y: p.y }; writeTransform(p.x, p.y, scaleFor(p.plate)); }
      }
      new MutationObserver(onStrip).observe(strip, { childList: true, subtree: true, characterData: true });
      new MutationObserver(onDayWorld).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      root.addEventListener("sof:selected-date-change", () => { noteAction(); onStrip(); });
      for (const ev of ["pointerdown", "keydown", "wheel", "touchstart"]) {
        document.addEventListener(ev, noteAction, { passive: true, capture: true });
      }
      onDayWorld();
      raf = requestAnimationFrame(frame);
    }

    const existing = wrap.querySelector(".sphere-spark-presence");
    if (existing) { takeOver(existing); return; }
    const watcher = new MutationObserver(() => {
      const found = wrap.querySelector(".sphere-spark-presence");
      if (found) { watcher.disconnect(); takeOver(found); }
    });
    watcher.observe(wrap, { childList: true });
  }

  return {
    IDLE_AFTER_MS,
    PATTERN_DAYS,
    parseReadout,
    patternDayFor,
    moonDayFor,
    ringDistance,
    hopArc,
    travelDurationMs,
    daypartForHour,
    pickIdle,
    playKindCounts,
    mount,
  };
});
