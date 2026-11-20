/*
 * The Codex Guide — conversation mode (Living Witness, Rung 3).
 *
 * This panel is the talking rung's face, and it is built to
 * disappear: it probes the Guide endpoint on the site's own host
 * (/.netlify/functions/codex-guide) and only appears when something
 * answers. On the GitHub Pages mirror — and anywhere else no
 * function answers — the panel never appears, and the page is
 * exactly the record-only Guide it always was.
 *
 * The privacy notice (Rule 7 of the Guide's rulebook) stands in the
 * panel's static HTML, before the first question can be asked.
 * Conversation history lives in this page's memory only, rides with
 * each request, and is gone when the page closes — questions are
 * not kept.
 *
 * The architectural fence, by construction: this file loads no Life
 * Atlas code, no Day Notes code, and no visitor-record module, and
 * it reads no on-device record store. A visitor's private notes
 * cannot reach this page — not merely are they not used. (Proven by
 * tests/codex-guide-talking.test.js.)
 */
(function () {
  "use strict";

  const ENDPOINT = "/.netlify/functions/codex-guide";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderSources(container, sources) {
    if (!Array.isArray(sources) || !sources.length) return;

    const section = el("div", "codex-guide__talk-sources");
    section.append(el("p", "codex-guide__label", "From the record"));

    const list = el("ul", "codex-guide__sources");

    for (const source of sources) {
      const item = el("li");
      if (source.url) {
        const link = el("a", "", source.title);
        link.href = source.url;
        item.append(link);
      } else {
        item.append(document.createTextNode(source.title));
      }

      const meta = [source.areaLabel, source.grade ? `grade: ${source.grade.replace(/-/g, " ")}` : ""]
        .filter(Boolean)
        .join(" · ");

      if (meta) item.append(document.createTextNode(` — ${meta}`));
      if (source.detail) item.append(el("span", "codex-guide__snippet", source.detail));
      if (source.snippet) item.append(el("span", "codex-guide__snippet", source.snippet));

      list.append(item);
    }

    section.append(list);
    container.append(section);
  }

  function initTalk() {
    const panel = document.querySelector("[data-guide-talk]");
    if (!panel || panel.dataset.guideTalkReady) return;
    panel.dataset.guideTalkReady = "1";

    const form = panel.querySelector("[data-guide-talk-form]");
    const input = panel.querySelector("[data-guide-talk-input]");
    const log = panel.querySelector("[data-guide-talk-log]");
    const state = panel.querySelector("[data-guide-talk-state]");

    if (!form || !input || !log) return;

    const history = [];

    fetch(ENDPOINT, { headers: { accept: "application/json" } })
      .then(response => (response.ok ? response.json() : null))
      .then(status => {
        if (!status || status.name !== "The Codex Guide") return;

        panel.hidden = false;

        if (state) {
          state.textContent = status.talkingEnabled
            ? "Talking is on. The Guide answers from the record, in conversation, and shows its sources."
            : "Talking is not switched on yet. Until it is, answers below are assembled from the record itself.";
        }
      })
      .catch(() => {
        /* No function answers here — the panel stays hidden and the
         * page remains the record-only Guide. */
      });

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const question = input.value.trim();
      if (!question) return;

      input.value = "";

      const exchange = el("div", "codex-guide__talk-exchange");
      exchange.append(el("p", "codex-guide__talk-q", question));
      const answerBox = el("div", "codex-guide__talk-a");
      answerBox.append(el("p", "codex-guide__status", "Asking…"));
      exchange.append(answerBox);
      log.append(exchange);

      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ question, history })
        });

        const result = await response.json();

        answerBox.innerHTML = "";

        if (result.notice) {
          answerBox.append(el("p", "codex-guide__talk-note", result.notice));
        }

        answerBox.append(el("p", "codex-guide__talk-text", result.answer || ""));

        if (result.mode === "talking" && result.answer) {
          history.push(
            { role: "user", content: question },
            { role: "assistant", content: result.answer }
          );
        }

        renderSources(answerBox, result.sources);
      } catch {
        answerBox.innerHTML = "";
        answerBox.append(
          el(
            "p",
            "codex-guide__talk-text",
            "The talking Guide could not be reached just now. The ask-the-record Guide above searches the same record here in your browser."
          )
        );
      }
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initTalk);
    } else {
      initTalk();
    }
  }
})();
