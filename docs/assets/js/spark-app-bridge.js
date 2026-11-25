"use strict";

/*
 * The app bridge — the website asks, politely, and only once.
 *
 * Aaron's sentence, Nov 24, 2026: "the site should also ask
 * permission to direct if there is a app to bring your spark,
 * calendar etc to the website." The machinery already stands —
 * the Spark passport (identity only, by the keeper's hand) and
 * the accounts door (one sign-in for the app and the site).
 * What was missing is the front door for it: the site noticing
 * a returning keeper and ASKING — never assuming — whether
 * they want their Spark and their days brought in.
 *
 * The fences, kept exactly:
 *  - Permission first. Nothing is detected, fetched, or moved
 *    before the keeper's yes. There is no fingerprinting and
 *    no stealth app detection; the door's status is knocked
 *    only after "Bring my Spark" is tapped.
 *  - "Not now" is remembered on this device. The ask never
 *    nags: it shows at most once until the keeper reopens it
 *    on purpose — the standing door on the account page
 *    (account.html) leads back here by the #bring-your-spark
 *    hash, which opens the ask even after a dismissal.
 *  - The yes-road is the existing roads only. The Spark half
 *    is the passport road, mirroring spark-passport.js step
 *    for step (same stow-aside key, same record raised from
 *    the travelled seed, same plain refusals). The calendar
 *    half is the accounts door: where the door is open, the
 *    keeper is directed to their account; where it is not —
 *    today it answers "unconfigured" while its keys are still
 *    being set — the bridge says so in one plain line and
 *    still completes the passport half. A connection is never
 *    faked.
 *  - Children: in child mode the invitation never appears and
 *    the bridge refuses to open. The signal is the same one
 *    the keeper mind and the Sphere seat use — childMode in
 *    the Spark's seed-keyed memory store (the bare key as
 *    fallback), mirrored here as it is mirrored there, and
 *    pinned to the same literal by test.
 *  - The Spark's memory stays seed-keyed; nothing here reads
 *    or writes any keeper memory beyond the child-mode flag
 *    check, and nothing about the keeper leaves the device
 *    from this file.
 */
(function () {
  const Core = window.SparkCompanion;
  if (!Core) return;

  const DISMISS_KEY = "sof.spark.bridge.dismissed.v1";
  const PREVIOUS_KEY = "sof.spark.passport.previous"; // spark-passport.js's stow-aside key, mirrored
  const MEMORY_KEY = "sof.spark.memory.v1"; // spark-keeper-mind.js / sphere-spark.js, mirrored
  const DOOR_URL = "/.netlify/functions/accounts"; // spark-account.js's DOOR, the same function

  const store = {
    get(key) {
      try { return window.localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); } catch { /* the ask simply rests */ }
    },
    remove(key) {
      try { window.localStorage.removeItem(key); } catch { /* nothing to clear */ }
    },
  };

  /* ---------- the child-mode signal (mirrored law) ---------- */

  function memoryKeyFor(seed) {
    const clean = typeof seed === "string" ? seed.trim() : "";
    return clean ? `${MEMORY_KEY}:${clean}` : MEMORY_KEY;
  }

  function childModeHere(seed) {
    if (window.SphereSparkCore && typeof window.SphereSparkCore.childModeFor === "function") {
      try { return window.SphereSparkCore.childModeFor(window.localStorage, seed); } catch { /* fall through to the mirror */ }
    }
    try {
      let raw = store.get(memoryKeyFor(seed));
      if (!raw && typeof seed === "string" && seed.trim()) raw = store.get(MEMORY_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Boolean(parsed && parsed.childMode === true);
    } catch { return false; }
  }

  /* ---------- the Spark record on this device ---------- */

  function readRecord() {
    try {
      const raw = store.get(Core.STORAGE_KEY);
      if (!raw) return null;
      const record = JSON.parse(raw);
      return record && Core.parseSeed(record.seed) ? record : null;
    } catch { return null; }
  }

  function civilToday() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /* ---------- the card ---------- */

  let mount = null;
  let armed = null;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function dismiss() {
    store.set(DISMISS_KEY, "1");
    if (mount) mount.innerHTML = "";
  }

  function note(text) {
    const host = mount && mount.querySelector(".spark-bridge-note");
    if (host) host.textContent = text;
  }

  /* The calendar half: knocked only after the yes. The door's
   * own GET answers whether accounts stand configured; any
   * other outcome — a closed door, a door that does not
   * answer — is spoken plainly, never dressed as a link. */
  function knockDoor() {
    const host = mount && mount.querySelector(".spark-bridge-door");
    if (!host) return;
    let answered = false;
    const say = (html) => { if (!answered) { answered = true; host.innerHTML = html; } };
    const closed =
      "<p>The account door is not open yet — sign-in is still being set up, " +
      "so your calendar cannot travel by account today. Your days stay safe " +
      "on your phone, and your Spark can still come by passport, above.</p>";
    const silent =
      "<p>The account door did not answer just now, so the calendar half " +
      "cannot be checked. Your days stay safe on your phone, and your Spark " +
      "can still come by passport, above.</p>";
    let request;
    try {
      request = fetch(DOOR_URL, { method: "GET" });
    } catch {
      say(silent);
      return;
    }
    request.then((res) => res.json()).then((data) => {
      if (data && data.ok && data.accounts) {
        say(
          "<p>The account door is open. Sign in with the same account you " +
          "use in the app, and your days follow you here — Genesis first, " +
          "then your days, then your Spark's memory.</p>" +
          '<p><a class="spark-bridge-btn" href="./account.html">Go to your account</a></p>'
        );
      } else {
        say(closed);
      }
    }).catch(() => say(silent));
  }

  /* ---------- the passport half (spark-passport.js's road) ---------- */

  function previewPassport() {
    const input = mount.querySelector(".spark-bridge-input");
    const preview = mount.querySelector(".spark-bridge-preview");
    const parsed = Core.parsePassportCode(input ? input.value : "");
    if (!parsed) {
      armed = null;
      if (preview) preview.hidden = true;
      note("That code does not read as a Spark passport — a letter may be mistyped. Nothing was changed.");
      return;
    }
    armed = parsed;
    const companion = parsed.companion;
    const name = parsed.name || companion.name;
    if (preview) {
      preview.hidden = false;
      preview.querySelector(".spark-bridge-art").innerHTML = Core.renderSVG(companion, { stage: 0 });
      preview.querySelector(".spark-bridge-name").textContent = name;
      preview.querySelector(".spark-bridge-kind").textContent =
        `A ${companion.kindName} Spark — ${companion.temperament}, and ${companion.trait}. ${companion.kindLine}`;
      preview.querySelector(".spark-bridge-born").textContent =
        companion.birthMoon == null
          ? `Born on the Day Out of Time · Pattern Day ${companion.birthPatternDay}. Grown fresh here from the travelled seed — the same Spark, its days here beginning today.`
          : `Born in Moon ${companion.birthMoon} · Pattern Day ${companion.birthPatternDay}. Grown fresh here from the travelled seed — the same Spark, its days here beginning today.`;
    }
    const existing = readRecord();
    if (existing && existing.seed === parsed.seed) {
      note(`${name} already lives here — this is the same Spark, seed for seed. Nothing to move.`);
    } else if (existing) {
      const current = Core.generate(existing.seed);
      const currentName = Core.displayName(existing, current);
      note(`A different Spark lives here now — ${currentName}. Moving ${name} in sets ` +
        `${currentName}'s record gently aside, whole and untouched, and it can be returned to. ` +
        "Nothing on your phone is touched.");
    } else {
      note(`${name} is ready to move in.`);
    }
  }

  function moveIn() {
    if (!armed) return;
    const parsed = armed;
    armed = null;
    const existing = readRecord();
    if (existing && existing.seed !== parsed.seed) {
      store.set(PREVIOUS_KEY, JSON.stringify(existing));
    }
    const record = Core.recordFromPassport(parsed, civilToday());
    if (!record) {
      note("That passport would not raise a record — nothing was changed.");
      return;
    }
    store.set(Core.STORAGE_KEY, JSON.stringify(record));
    store.remove(Core.PENDING_KEY);
    store.set(DISMISS_KEY, "1"); // the ask is answered; it does not return
    note(`${Core.displayName(record, parsed.companion)} has moved in — the same Spark, grown from the same seed. This page will show it now.`);
    setTimeout(() => window.location.reload(), 900);
  }

  /* ---------- the two views ---------- */

  function openBring() {
    if (!mount) return;
    const record = readRecord();
    if (childModeHere(record && record.seed)) { dismiss(); return; }
    const ask = mount.querySelector(".spark-bridge-ask");
    const bring = mount.querySelector(".spark-bridge-bringview");
    if (ask) ask.hidden = true;
    if (bring) bring.hidden = false;
    knockDoor();
    const input = mount.querySelector(".spark-bridge-input");
    if (input) input.focus({ preventScroll: true });
  }

  function render() {
    mount.innerHTML = "";
    const card = el("section", "spark-bridge-card");
    card.setAttribute("aria-labelledby", "spark-bridge-title");

    const close = el("button", "spark-bridge-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Not now");
    close.addEventListener("click", dismiss);
    card.appendChild(close);

    /* The ask. */
    const ask = el("div", "spark-bridge-ask");
    ask.appendChild(el("p", "spark-bridge-eyebrow", "One Spark, every door"));
    const title = el("h2", "spark-bridge-title", "Have Spark. Living Day on your phone?");
    title.id = "spark-bridge-title";
    ask.appendChild(title);
    ask.appendChild(el("p", "spark-bridge-body",
      "You can bring your Spark and your calendar here, to the website. " +
      "Your Spark travels by its passport — a short code the app shows you. " +
      "Your days travel by your account, the same sign-in on both sides. " +
      "Nothing moves until you say so."));
    const row = el("div", "spark-bridge-row");
    const bringBtn = el("button", "spark-bridge-btn primary", "Bring my Spark");
    bringBtn.type = "button";
    bringBtn.addEventListener("click", openBring);
    const notNow = el("button", "spark-bridge-btn quiet", "Not now");
    notNow.type = "button";
    notNow.addEventListener("click", dismiss);
    row.appendChild(bringBtn);
    row.appendChild(notNow);
    ask.appendChild(row);
    const fine = el("p", "spark-bridge-fine");
    fine.innerHTML = 'No app yet? <a href="./install.html">Get Spark. Living Day</a>';
    ask.appendChild(fine);
    card.appendChild(ask);

    /* The bring view — the yes-road itself. */
    const bring = el("div", "spark-bridge-bringview");
    bring.hidden = true;
    bring.appendChild(el("h3", "spark-bridge-subtitle", "Bring your Spark and your days"));
    bring.appendChild(el("h4", "spark-bridge-half", "Your Spark, by passport"));
    bring.appendChild(el("p", "spark-bridge-body",
      "In the app, open your Spark's passport and type the code here. The " +
      "Spark who arrives is the same Spark, grown from the same seed. What " +
      "it has learned lives on your phone and stays there — its days here " +
      "begin today."));
    const formRow = el("div", "spark-bridge-row");
    const input = el("input", "spark-bridge-input");
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = "SPK1-…";
    input.setAttribute("aria-label", "Spark passport");
    const readBtn = el("button", "spark-bridge-btn", "Read the passport");
    readBtn.type = "button";
    readBtn.addEventListener("click", previewPassport);
    formRow.appendChild(input);
    formRow.appendChild(readBtn);
    bring.appendChild(formRow);

    const preview = el("div", "spark-bridge-preview");
    preview.hidden = true;
    preview.appendChild(el("div", "spark-bridge-art"));
    preview.appendChild(el("p", "spark-bridge-name"));
    preview.appendChild(el("p", "spark-bridge-kind"));
    preview.appendChild(el("p", "spark-bridge-born spark-bridge-fine"));
    const confirm = el("button", "spark-bridge-btn primary", "Move this Spark in");
    confirm.type = "button";
    confirm.addEventListener("click", moveIn);
    preview.appendChild(confirm);
    bring.appendChild(preview);

    const noteHost = el("p", "spark-bridge-note");
    noteHost.setAttribute("role", "status");
    noteHost.setAttribute("aria-live", "polite");
    bring.appendChild(noteHost);

    bring.appendChild(el("h4", "spark-bridge-half", "Your calendar, by account"));
    const door = el("div", "spark-bridge-door");
    door.appendChild(el("p", "spark-bridge-fine", "Checking the account door…"));
    bring.appendChild(door);

    const doors = el("p", "spark-bridge-fine");
    doors.innerHTML =
      'The full passport door — your own passport, and the way back to a ' +
      'Spark set aside — stands on the <a href="./companions.html#spark-passport">Companions page</a>.';
    bring.appendChild(doors);
    const notNow2 = el("button", "spark-bridge-btn quiet", "Not now");
    notNow2.type = "button";
    notNow2.addEventListener("click", dismiss);
    bring.appendChild(notNow2);
    card.appendChild(bring);

    mount.appendChild(card);
  }

  /* ---------- standing ---------- */

  window.SparkAppBridge = {
    open() {
      if (!mount) return;
      if (!mount.firstChild) render();
      openBring();
    },
    dismiss,
    DISMISS_KEY,
  };

  function start() {
    mount = document.getElementById("spark-app-bridge");
    if (!mount) return;
    const record = readRecord();
    if (childModeHere(record && record.seed)) return; // the invitation does not appear
    const onPurpose = window.location.hash === "#bring-your-spark";
    if (!onPurpose && store.get(DISMISS_KEY) === "1") return; // asked once; remembered
    render();
    if (onPurpose) openBring();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
