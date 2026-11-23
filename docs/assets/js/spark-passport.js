"use strict";

/*
 * Spark passport — the companions page door.
 *
 * Aaron's fault, named Nov 22, 2026: "The Spark I have is not
 * the Spark in their home world." His standing ruling is that a
 * Spark is one and the same across platforms. Accounts and sync
 * (Spark intelligence Phase 2) are still gated on his word, so
 * the carry that stands here needs no account: the passport the
 * core writes (SparkCompanion.passportCodeFor) — a short code
 * carrying identity only, the seed and the name it answers to.
 *
 * This page glue does three things, all on this device:
 *  - shows the passport of the Spark who lives here, as a code
 *    a keeper can type and as a scannable square (the vendored
 *    QR writer, loaded on demand; where it is not to be had,
 *    the typed code stands alone);
 *  - reads a passport typed or scanned at either door on this
 *    page — the passport section's, or the small door inside
 *    Their Home — and, on the keeper's confirming tap, moves
 *    that Spark in: a fresh record raised from the travelled
 *    seed, in the same single storage key every Spark here has
 *    ever lived in;
 *  - keeps the move reversible: a Spark already living here is
 *    set gently aside whole (its record untouched, under its
 *    own key) and can be returned to with one tap. The phone is
 *    never touched by any of this — the passport travels by the
 *    keeper's hand, like the bundle file always has.
 *
 * A doubtful code is refused plainly and grows nothing. A
 * different Spark is never replaced in silence: the preview
 * names who is arriving, and moving in takes a second,
 * deliberate tap.
 */
(function () {
  const Core = window.SparkCompanion;
  if (!Core) return;

  const $ = (id) => document.getElementById(id);
  const PREVIOUS_KEY = "sof.spark.passport.previous";

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

  function civilToday() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function note(text) {
    const el = $("spark-passport-note");
    if (el) el.textContent = text;
  }

  /* ---------- their own passport, shown ---------- */

  function drawPassport() {
    const host = $("spark-passport-own");
    if (!host) return;
    const record = readRecord();
    const code = record ? Core.passportCodeFor(record) : null;
    if (!code) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    $("spark-passport-own-code").textContent = code;
    const qrHost = $("spark-passport-own-qr");
    if (qrHost) {
      qrHost.innerHTML = "";
      loadQrLib().then((ok) => {
        if (!ok) return;
        try {
          const qr = window.qrcode(0, "M");
          qr.addData(code);
          qr.make();
          qrHost.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 10, scalable: true });
        } catch {
          /* the typed code stands alone */
        }
      });
    }
  }

  /* The QR writer (assets/vendor/qrcode/qrcode.js, vendored)
   * loads only when a passport square is actually drawn, so
   * the page's standing weight stays where it was; the typed
   * code never waits on it and always works without it. */
  let qrLibPromise = null;
  function loadQrLib() {
    if (typeof window.qrcode === "function") return Promise.resolve(true);
    if (!qrLibPromise) {
      qrLibPromise = new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "assets/vendor/qrcode/qrcode.js";
        script.onload = () => resolve(typeof window.qrcode === "function");
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      });
    }
    return qrLibPromise;
  }

  /* ---------- the door: a Spark moves in ---------- */

  let armed = null;

  function previewPassport(text, scrollThere) {
    const parsed = Core.parsePassportCode(text);
    const preview = $("spark-passport-preview");
    if (!parsed) {
      armed = null;
      if (preview) preview.hidden = true;
      note("That code does not read as a Spark passport — a letter may be mistyped. Nothing was changed.");
      if (scrollThere && preview) preview.scrollIntoView({ block: "nearest" });
      return;
    }
    armed = parsed;
    const companion = parsed.companion;
    const name = parsed.name || companion.name;
    if (preview) {
      preview.hidden = false;
      $("spark-passport-art").innerHTML = Core.renderSVG(companion, { stage: 0 });
      $("spark-passport-name").textContent = name;
      $("spark-passport-kind").textContent =
        `A ${companion.kindName} Spark — ${companion.temperament}, and ${companion.trait}. ${companion.kindLine}`;
      $("spark-passport-born").textContent =
        companion.birthMoon == null
          ? `Born on the Day Out of Time · Pattern Day ${companion.birthPatternDay}. Grown fresh here from the travelled seed — the same Spark, its days here beginning today.`
          : `Born in Moon ${companion.birthMoon} · Pattern Day ${companion.birthPatternDay}. Grown fresh here from the travelled seed — the same Spark, its days here beginning today.`;
      if (scrollThere) preview.scrollIntoView({ block: "nearest" });
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
      try {
        window.localStorage.setItem(PREVIOUS_KEY, JSON.stringify(existing));
      } catch {
        /* the aside is a kindness, not a gate */
      }
    }
    const record = Core.recordFromPassport(parsed, civilToday());
    if (!record) {
      note("That passport would not raise a record — nothing was changed.");
      return;
    }
    writeRecord(record);
    try {
      window.localStorage.removeItem(Core.PENDING_KEY);
    } catch {
      /* nothing to clear */
    }
    note(`${Core.displayName(record, parsed.companion)} has moved in — the same Spark, grown from the same seed. This page will show it now.`);
    setTimeout(() => window.location.reload(), 900);
  }

  /* ---------- the way back ---------- */

  function wireReturn() {
    const wrap = $("spark-passport-return");
    if (!wrap) return;
    let stowed = null;
    try {
      const raw = window.localStorage.getItem(PREVIOUS_KEY);
      if (raw) {
        const record = JSON.parse(raw);
        if (record && Core.parseSeed(record.seed)) stowed = record;
      }
    } catch {
      stowed = null;
    }
    wrap.hidden = !stowed;
    if (!stowed) return;
    $("spark-passport-return-button").addEventListener("click", () => {
      writeRecord(stowed);
      try {
        window.localStorage.removeItem(PREVIOUS_KEY);
      } catch {
        /* already gone */
      }
      note("The Spark raised here is back, its record whole. This page will show it now.");
      setTimeout(() => window.location.reload(), 900);
    });
  }

  /* ---------- scanning, where the device offers it ---------- */

  function wireScan() {
    const button = $("spark-passport-scan");
    const video = $("spark-passport-video");
    if (!button || !video) return;
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function") {
      return; /* the typed code is the door; scanning is a second handle */
    }
    button.hidden = false;
    let stream = null;
    let timer = null;
    const stop = () => {
      if (timer) window.clearInterval(timer);
      timer = null;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
      video.hidden = true;
    };
    button.addEventListener("click", async () => {
      if (stream) {
        stop();
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        note("The camera could not be opened here — the typed code is the same door.");
        return;
      }
      video.srcObject = stream;
      video.hidden = false;
      await video.play().catch(() => {});
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      timer = window.setInterval(async () => {
        try {
          const codes = await detector.detect(video);
          if (codes && codes.length && codes[0].rawValue) {
            const value = codes[0].rawValue;
            stop();
            $("spark-passport-input").value = value;
            previewPassport(value, true);
          }
        } catch {
          /* a frame that will not read is skipped, never fatal */
        }
      }, 350);
    });
  }

  function start() {
    if (!$("spark-passport")) return;
    drawPassport();
    wireReturn();
    wireScan();
    const go = $("spark-passport-go");
    if (go) {
      go.addEventListener("click", () => previewPassport($("spark-passport-input").value, false));
    }
    const homeGo = $("spark-home-passport-go");
    if (homeGo) {
      homeGo.addEventListener("click", () => {
        const input = $("spark-home-passport-input");
        const main = $("spark-passport-input");
        if (main && input) main.value = input.value;
        previewPassport(input ? input.value : "", true);
      });
    }
    const confirm = $("spark-passport-confirm");
    if (confirm) confirm.addEventListener("click", moveIn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
