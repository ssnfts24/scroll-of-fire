/**
 * Read aloud — the shared Listen engine (Page Evolution Batch
 * E2, Aaron's order, Nov 25, 2026: "Start all").
 *
 * The scripture chapters passed every audit standard except one,
 * two audits running: they could not be heard. This engine is
 * the hearing path, built once and ridden by every surface E2
 * touches:
 *
 *   - the 90 Genesis/Exodus chapters (scripture.js drives it
 *     verse by verse, highlighting the verse being read);
 *   - the Scroll reader's passages and the white paper's
 *     chapters (a page opts in by marking its reading container
 *     with data-read-aloud and loading this file; the engine
 *     adds its own Listen bar and reads the container's
 *     paragraphs in order).
 *
 * The fences:
 *   - The device's own speech only — no network, no audio files,
 *     nothing recorded, nothing sent anywhere. A device with no
 *     speech synthesis gets no button, and the page is exactly
 *     as readable as it was before.
 *   - It reads what the page already shows. On the chapters that
 *     is the World English Bible text (the pointed Hebrew is a
 *     study text; device voices pronounce it unreliably, and a
 *     Hebrew pronunciation layer is a study project, not a
 *     batch step — the chapters' Listen note says so plainly).
 *   - Listening never marks anything read, never writes state:
 *     hearing a chapter and reading it stay the keeper's own
 *     separate acts, as the chapters' "Mark chapter read" has
 *     always been a deliberate tap.
 *   - Playback stops when the keeper stops it, when the reading
 *     ends, or when the page hides — a voice never follows a
 *     keeper onto another page.
 */
(function (root) {
  "use strict";

  const VERSION = "read-aloud/1.0.0";

  function supported() {
    try {
      return typeof window !== "undefined" && "speechSynthesis" in window;
    } catch { return false; }
  }

  function injectStyles() {
    if (document.getElementById("read-aloud-styles")) return;
    const style = document.createElement("style");
    style.id = "read-aloud-styles";
    style.textContent = [
      ".ra-current{outline:2px solid #c9a24b;outline-offset:3px;border-radius:4px}",
      ".ra-bar{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin:.6rem 0}",
      ".ra-btn{font:inherit;font-size:.85rem;padding:.32rem .7rem;border-radius:999px;border:1px solid rgba(140,160,200,.45);background:transparent;color:inherit;cursor:pointer}",
      ".ra-btn[aria-pressed=\"true\"]{border-color:#c9a24b;color:#c9a24b}",
      ".ra-note{font-size:.78rem;opacity:.75}"
    ].join("\n");
    document.head.appendChild(style);
  }

  /**
   * A reading session over ordered chunks: [{ el, text }].
   * The current chunk's element is highlighted and kept in view;
   * onend advances. Returns null when speech is unavailable or
   * there is nothing to read.
   */
  function createSession(chunks, options = {}) {
    if (!supported()) return null;
    const queue = (chunks || []).filter((c) => c && String(c.text || "").trim());
    if (!queue.length) return null;
    injectStyles();

    const synth = window.speechSynthesis;
    let index = -1;
    let playing = false;
    let generation = 0; // a stopped session's late onend must not advance a new one

    function clearHighlight() {
      for (const chunk of queue) {
        if (chunk.el) chunk.el.classList.remove("ra-current");
      }
    }

    function stop() {
      generation += 1;
      playing = false;
      try { synth.cancel(); } catch { /* silence is fine */ }
      clearHighlight();
      if (typeof options.onState === "function") options.onState("stopped");
    }

    function speakNext(gen) {
      if (gen !== generation || !playing) return;
      index += 1;
      if (index >= queue.length) {
        playing = false;
        clearHighlight();
        if (typeof options.onState === "function") options.onState("ended");
        return;
      }
      const chunk = queue[index];
      clearHighlight();
      if (chunk.el) {
        chunk.el.classList.add("ra-current");
        try { chunk.el.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch { /* position is a courtesy */ }
      }
      if (typeof options.onChunk === "function") options.onChunk(index, queue.length);
      const utterance = new SpeechSynthesisUtterance(String(chunk.text).replace(/\s+/g, " ").trim());
      if (options.lang) utterance.lang = options.lang;
      if (options.rate) utterance.rate = options.rate;
      utterance.addEventListener("end", () => speakNext(gen));
      utterance.addEventListener("error", () => speakNext(gen));
      synth.speak(utterance);
    }

    function play() {
      if (playing) return;
      generation += 1;
      const gen = generation;
      index = -1;
      playing = true;
      try { synth.cancel(); } catch { /* a clean start */ }
      if (typeof options.onState === "function") options.onState("playing");
      speakNext(gen);
    }

    const onHide = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", stop);

    return {
      play,
      stop,
      get playing() { return playing; },
      get length() { return queue.length; }
    };
  }

  /* -------- generic page opt-in: [data-read-aloud] ---------- */

  function paragraphChunks(container) {
    const nodes = container.querySelectorAll("h2, h3, p, li");
    const chunks = [];
    for (const node of nodes) {
      if (node.closest("[data-read-aloud-skip]")) continue;
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length < 2) continue;
      chunks.push({ el: node, text });
    }
    return chunks;
  }

  function initGeneric() {
    if (typeof document === "undefined" || !supported()) return;
    for (const container of document.querySelectorAll("[data-read-aloud]")) {
      if (container.dataset.readAloudReady) continue;
      container.dataset.readAloudReady = "1";

      const bar = document.createElement("div");
      bar.className = "ra-bar";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ra-btn";
      button.textContent = "▶ Listen";
      button.setAttribute("aria-pressed", "false");
      const note = document.createElement("span");
      note.className = "ra-note";
      note.textContent = "Read aloud by your device's own voice. Nothing is recorded or sent.";
      bar.append(button, note);
      container.insertBefore(bar, container.firstChild);

      let session = null;
      button.addEventListener("click", () => {
        if (session && session.playing) {
          session.stop();
          return;
        }
        /* Chunks are gathered at tap time, so a surface whose
         * text arrives after load (the reader's passages) reads
         * what is actually on the page now. */
        session = createSession(paragraphChunks(container), {
          onState: (state) => {
            const on = state === "playing";
            button.textContent = on ? "⏸ Stop listening" : "▶ Listen";
            button.setAttribute("aria-pressed", String(on));
          }
        });
        if (session) session.play();
      });
    }
  }

  const api = { VERSION, supported, createSession, paragraphChunks, initGeneric };
  root.ReadAloud = api;
  if (typeof module === "object" && module.exports) module.exports = api;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initGeneric);
    } else {
      initGeneric();
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
