/**
 * Word-study Hebrew listening — the pronunciation layer on the
 * seven word studies (Aaron's commission, Nov 25, 2026:
 * "Commission the Hebrew pronunciation layer").
 *
 * E2 taught the studies to open up — citations became doors,
 * recall strips asked questions — but their Hebrew could still
 * not be heard: Listen read English only, because device
 * voices pronounce raw Hebrew unreliably. This runtime is the
 * Hebrew choice on the studies:
 *
 *   - It gathers the page's POINTED Hebrew spans
 *     (.hebrew[lang="he"] whose text carries vowel points).
 *     Unpointed spans are never touched — the layer does not
 *     invent pointing, so it does not guess a reading.
 *   - "Hear the Hebrew" speaks the spans in page order through
 *     the shared read-aloud engine's Hebrew mode: the voice
 *     speaks the pronunciation engine's transliteration track
 *     (assets/js/hebrew-pronunciation.js) while the Hebrew
 *     span itself is highlighted on the page.
 *   - Tapping any pointed span speaks that one word or phrase.
 *   - The method note stands in the bar in plain words,
 *     including the honest limit: a careful transliteration in
 *     the device's own voice — not a native Hebrew voice.
 *
 * The fences: device speech only, nothing recorded or sent,
 * nothing written, stops when the page hides (the engine's
 * own fences, inherited whole). Quiet by default: nothing
 * speaks until the keeper taps. The studies' text and their
 * printed transliterations are never altered — the engine
 * conforms to them, and its agreement with them is pinned by
 * tests/hebrew-pronunciation.test.js.
 */
(function () {
  "use strict";

  /* Captured while this script itself is running —
   * document.currentScript is gone by the time init() runs. */
  var OWN_SRC = document.currentScript && document.currentScript.src;

  var METHOD_NOTE = "Hebrew is read as a careful transliteration in your device's own voice — " +
    "the sounds are this study's own, spelled out letter by letter from the vowel points. " +
    "It is not a native Hebrew voice. Tap any pointed word to hear it alone.";

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function assetUrl(name) {
    /* This file lives at scripture/assets/; the engines live
     * at assets/js/. Resolve against this script's own URL. */
    return new URL("../../assets/js/" + name, OWN_SRC || window.location.href).href;
  }

  function pointedSpans(main) {
    var spans = [];
    var nodes = main.querySelectorAll('.hebrew[lang="he"]');
    for (var i = 0; i < nodes.length; i++) {
      var text = (nodes[i].textContent || "").trim();
      if (text && window.HebrewPronunciation && window.HebrewPronunciation.hasPointing(text)) {
        spans.push(nodes[i]);
      }
    }
    return spans;
  }

  function init() {
    var main = document.getElementById("main");
    if (!main || !("speechSynthesis" in window)) return;

    Promise.all([
      loadScript(assetUrl("hebrew-pronunciation.js")),
      loadScript(assetUrl("read-aloud.js"))
    ]).then(function () {
      if (!window.HebrewPronunciation || !window.ReadAloud) return;
      var spans = pointedSpans(main);
      if (!spans.length) return;

      var bar = document.createElement("div");
      bar.className = "ra-bar ws-hebrew-bar";
      var button = document.createElement("button");
      button.type = "button";
      button.className = "ra-btn";
      button.textContent = "▶ Hear the Hebrew";
      button.setAttribute("aria-pressed", "false");
      var note = document.createElement("span");
      note.className = "ra-note";
      note.textContent = METHOD_NOTE;
      bar.append(button, note);

      var heading = main.querySelector("h1");
      if (heading && heading.parentNode) {
        heading.parentNode.insertBefore(bar, heading.nextSibling);
      } else {
        main.insertBefore(bar, main.firstChild);
      }

      function speakTextFor(span) {
        var result = window.HebrewPronunciation.transliterate(span.textContent || "");
        return result && result.spoken ? result.spoken : null;
      }

      var session = null;
      button.addEventListener("click", function () {
        if (session && session.playing) { session.stop(); return; }
        session = window.ReadAloud.createSession(
          spans.map(function (span) { return { el: span, text: span.textContent || "" }; }),
          {
            speakText: function (chunk) { return speakTextFor(chunk.el); },
            onState: function (state) {
              var on = state === "playing";
              button.textContent = on ? "⏸ Stop" : "▶ Hear the Hebrew";
              button.setAttribute("aria-pressed", String(on));
            }
          }
        );
        if (session) session.play();
      });

      spans.forEach(function (span) {
        span.style.cursor = "pointer";
        span.title = "Hear this word";
        span.addEventListener("click", function () {
          var one = window.ReadAloud.createSession(
            [{ el: span, text: span.textContent || "" }],
            { speakText: function (chunk) { return speakTextFor(chunk.el); } }
          );
          if (one) one.play();
        });
      });
    }).catch(function () { /* no Hebrew bar is better than a broken one */ });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
