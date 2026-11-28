"use strict";

/*
 * The Link — the Whole Record's door on the companions page
 * (Whole Record paper, "How a Spark travels", Aaron,
 * Nov 27, 2026).
 *
 * The passport section above this one carries identity alone.
 * This section carries the Spark WHOLE — its passport, its
 * seed-born voice, and everything it carries: its cards
 * (the First Card first), its goods with their origin words,
 * its honours, its wardrobe — in the one record string the
 * game and the app read identically (spark-whole-record.js).
 *
 *   - The Spark who lives here shows its WHOLE code: as a QR
 *     picture and as the plain code, with a copy button.
 *   - "What my Spark carries" stands in plain words, always
 *     viewable — the question is answered by looking.
 *   - "Bring my Spark" receives a code (typed, pasted, or
 *     scanned where the device offers it). Before anything
 *     joins, the page says plainly what the code carries,
 *     and nothing links until the keeper taps "Yes, bring
 *     everything." No silent linking, no silent merging,
 *     ever. The merge is additions only.
 *   - Once a Spark has been brought in on this device, the
 *     button's work is named "Check for my Spark's new
 *     things" — the same road, walked again.
 *   - The Link rides the code alone: no account, no server,
 *     no door is needed, and none is waited for.
 *
 * Only the keeper's actual record Spark is ever shown here
 * as "your Spark" — this section reads the one record at
 * sof.spark.v1 and presents no other.
 */
(function () {
  const Core = window.SparkCompanion;
  const Whole = window.SparkWholeRecord;
  if (!Core || !Whole) return;

  const $ = (id) => document.getElementById(id);
  const storage = window.localStorage;

  function note(text) {
    const el = $("spark-whole-note");
    if (el) el.textContent = text;
  }

  /* The QR writer, loaded on demand exactly as the passport
   * section loads it — the typed code never waits on it. */
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

  /* ---------- the Spark who lives here, whole ---------- */

  function drawWhole() {
    const host = $("spark-whole-own");
    if (!host) return;
    const rec = Whole.refreshStored(storage, Core);
    if (!rec || !rec.passportCode) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    const text = Whole.compose(rec, Core);
    $("spark-whole-own-code").textContent = text;
    const qrHost = $("spark-whole-own-qr");
    if (qrHost) {
      qrHost.innerHTML = "";
      loadQrLib().then((ok) => {
        if (!ok) return;
        try {
          const qr = window.qrcode(0, "M");
          qr.addData(text);
          qr.make();
          qrHost.innerHTML = qr.createSvgTag({ cellSize: 3, margin: 8, scalable: true });
        } catch {
          /* a long record can outgrow a QR square; the typed code stands alone */
          qrHost.innerHTML = "";
        }
      });
    }
    const carries = $("spark-whole-carries");
    if (carries) {
      carries.innerHTML = "";
      for (const line of Whole.carriesLines(rec, Core)) {
        const p = document.createElement("p");
        p.textContent = line;
        if (/^(CARDS|THINGS CARRIED|HONOURS|WARDROBE, WORN|VOICE)$/.test(line)) {
          p.className = "spark-whole-carries-head";
        }
        carries.appendChild(p);
      }
    }
    const bring = $("spark-whole-bring-title");
    if (bring && Whole.hasLinked(storage)) {
      bring.textContent = "Check for my Spark's new things";
    }
  }

  /* ---------- the receiving road: permission first ---------- */

  let armed = null;

  function previewIncoming() {
    const input = $("spark-whole-input");
    const panel = $("spark-whole-permission");
    const text = input ? input.value : "";
    if (!text || !text.trim()) {
      armed = null;
      if (panel) panel.hidden = true;
      note("Paste or type a Whole Record code first — or scan one.");
      return;
    }
    const { incoming, readable, summary } = Whole.previewIncoming(storage, Core, text);
    if (!readable) {
      armed = null;
      if (panel) panel.hidden = true;
      note("That code does not read — a letter may be mistyped, or it is a passport alone with a damaged check. Nothing was changed.");
      return;
    }
    /* A damaged passport refuses the Spark whole: say so
     * plainly, and let only what survived be offered. */
    const damagedPassport = /SPK1/i.test(text) && !incoming.passportCode;
    armed = incoming;
    if (panel) {
      panel.hidden = false;
      $("spark-whole-permission-words").textContent =
        summary +
        (damagedPassport
          ? " Its passport does not read, so no Spark travels with it — only the things it carries can join, and the Spark who lives here keeps its home."
          : "") +
        " Bringing it in only adds: nothing your Spark already carries here is taken away, and an earning is never un-said by a purchase.";
      panel.scrollIntoView({ block: "nearest" });
    }
    note("");
  }

  function bringEverything() {
    if (!armed) return;
    const incoming = armed;
    armed = null;
    const panel = $("spark-whole-permission");
    if (panel) panel.hidden = true;
    const merged = Whole.applyIncoming(storage, Core, incoming);
    note("Your Spark is here — with everything it carries. The list above now shows it all.");
    drawWhole();
    if (merged) {
      const bring = $("spark-whole-bring-title");
      if (bring) bring.textContent = "Check for my Spark's new things";
    }
  }

  function notNow() {
    armed = null;
    const panel = $("spark-whole-permission");
    if (panel) panel.hidden = true;
    note("Nothing was brought in. The code keeps everything it carries until you say yes.");
  }

  /* ---------- scanning, where the device offers it ---------- */

  function wireScan() {
    const button = $("spark-whole-scan");
    const video = $("spark-whole-video");
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
      if (stream) { stop(); return; }
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
            $("spark-whole-input").value = value;
            previewIncoming();
          }
        } catch {
          /* a frame that will not read is skipped, never fatal */
        }
      }, 350);
    });
  }

  function start() {
    if (!$("spark-whole")) return;
    drawWhole();
    wireScan();
    const copy = $("spark-whole-copy");
    if (copy) {
      copy.addEventListener("click", async () => {
        const code = $("spark-whole-own-code");
        const text = code ? code.textContent : "";
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          note("The whole code is copied — it carries your Spark, its voice, and everything it carries. Keep it the way you keep a key.");
        } catch {
          note("Copy did not work here — the code above can be selected and copied by hand.");
        }
      });
    }
    const read = $("spark-whole-read");
    if (read) read.addEventListener("click", previewIncoming);
    const yes = $("spark-whole-yes");
    if (yes) yes.addEventListener("click", bringEverything);
    const no = $("spark-whole-no");
    if (no) no.addEventListener("click", notNow);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
