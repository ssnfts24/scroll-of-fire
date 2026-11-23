/* Aiyana's World — the page's small machinery.
   Everything a visitor makes here stays on their own device
   (browser local storage). Nothing is sent, published, or shared.
   Stories added at the end wait, on-device, for Aiyana's yes —
   they never appear on the page by themselves. */
(function () {
  "use strict";

  var THOUGHTS_KEY = "aiyana.thoughts.v1";
  var DRAWING_KEY = "aiyana.drawing.v1";
  var WAITING_KEY = "aiyana.waiting.v1";

  function load(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* Storage full or blocked: the page keeps working for this visit. */
    }
  }

  function makeId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- Feelings ---------- */

  var chosenFeeling = "";
  var feelingLine = document.getElementById("aiyana-feeling-line");
  var chips = Array.prototype.slice.call(document.querySelectorAll(".feel-chip"));

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var wasChosen = chip.classList.contains("is-chosen");
      chips.forEach(function (c) { c.classList.remove("is-chosen"); });
      if (wasChosen) {
        chosenFeeling = "";
        if (feelingLine) feelingLine.textContent = "Tap a feeling word to pick it.";
      } else {
        chip.classList.add("is-chosen");
        chosenFeeling = chip.getAttribute("data-feeling") || "";
        if (feelingLine) {
          feelingLine.textContent = "Right now I feel: " + chosenFeeling + ". Pin it with a thought below, if you like.";
        }
      }
    });
  });

  /* ---------- Thinking wall ---------- */

  var wall = document.getElementById("aiyana-wall");
  var wallEmpty = document.getElementById("aiyana-wall-empty");
  var thoughtInput = document.getElementById("aiyana-thought-input");
  var pinBtn = document.getElementById("aiyana-pin-btn");
  var thoughts = load(THOUGHTS_KEY, []);
  if (!Array.isArray(thoughts)) thoughts = [];

  function renderWall() {
    if (!wall) return;
    Array.prototype.slice.call(wall.querySelectorAll(".aiyana-note-card")).forEach(function (n) { n.remove(); });
    if (wallEmpty) wallEmpty.style.display = thoughts.length ? "none" : "";
    thoughts.forEach(function (t) {
      var card = document.createElement("article");
      card.className = "aiyana-note-card";
      if (t.feeling) {
        var tag = document.createElement("span");
        tag.className = "aiyana-note-feeling";
        tag.textContent = "I feel " + t.feeling;
        card.appendChild(tag);
      }
      var text = document.createElement("p");
      text.className = "aiyana-note-text";
      text.textContent = t.text;
      card.appendChild(text);
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "aiyana-note-remove";
      remove.setAttribute("aria-label", "Take this thought off the wall");
      remove.textContent = "×";
      remove.addEventListener("click", function () {
        thoughts = thoughts.filter(function (x) { return x.id !== t.id; });
        save(THOUGHTS_KEY, thoughts);
        renderWall();
      });
      card.appendChild(remove);
      wall.appendChild(card);
    });
  }

  if (pinBtn && thoughtInput) {
    pinBtn.addEventListener("click", function () {
      var text = thoughtInput.value.trim();
      if (!text && !chosenFeeling) {
        thoughtInput.focus();
        return;
      }
      thoughts.unshift({
        id: makeId(),
        text: text || "Just a feeling, no words.",
        feeling: chosenFeeling,
        ts: Date.now()
      });
      save(THOUGHTS_KEY, thoughts);
      thoughtInput.value = "";
      renderWall();
    });
  }
  renderWall();

  /* ---------- Drawing pad ---------- */

  var pad = document.getElementById("aiyana-draw-pad");
  if (pad && pad.getContext) {
    var ctx = pad.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pad.width, pad.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    var savedDrawing = null;
    try { savedDrawing = window.localStorage.getItem(DRAWING_KEY); } catch (err) { savedDrawing = null; }
    if (savedDrawing) {
      var img = new Image();
      img.onload = function () { ctx.drawImage(img, 0, 0, pad.width, pad.height); };
      img.src = savedDrawing;
    }

    var drawColor = "#e5484d";
    var drawSize = 9;
    var drawing = false;
    var last = null;
    var saveTimer = null;

    function padPoint(evt) {
      var rect = pad.getBoundingClientRect();
      return {
        x: (evt.clientX - rect.left) * (pad.width / rect.width),
        y: (evt.clientY - rect.top) * (pad.height / rect.height)
      };
    }

    function persistDrawing() {
      if (saveTimer) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(function () {
        try { window.localStorage.setItem(DRAWING_KEY, pad.toDataURL("image/jpeg", 0.85)); } catch (err) { /* keep drawing anyway */ }
      }, 350);
    }

    pad.addEventListener("pointerdown", function (evt) {
      drawing = true;
      last = padPoint(evt);
      try { pad.setPointerCapture(evt.pointerId); } catch (err) { /* not vital */ }
      evt.preventDefault();
    });
    pad.addEventListener("pointermove", function (evt) {
      if (!drawing || !last) return;
      var p = padPoint(evt);
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = drawSize;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (name) {
      pad.addEventListener(name, function () {
        if (drawing) persistDrawing();
        drawing = false;
        last = null;
      });
    });

    Array.prototype.slice.call(document.querySelectorAll(".swatch")).forEach(function (sw) {
      sw.addEventListener("click", function () {
        document.querySelectorAll(".swatch").forEach(function (s) { s.classList.remove("is-chosen"); });
        sw.classList.add("is-chosen");
        drawColor = sw.getAttribute("data-color") || drawColor;
      });
    });
    Array.prototype.slice.call(document.querySelectorAll(".brush-size")).forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll(".brush-size").forEach(function (s) { s.classList.remove("is-chosen"); });
        b.classList.add("is-chosen");
        drawSize = parseInt(b.getAttribute("data-size"), 10) || drawSize;
      });
    });
    var clearBtn = document.getElementById("aiyana-draw-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pad.width, pad.height);
        try { window.localStorage.removeItem(DRAWING_KEY); } catch (err) { /* fine */ }
      });
    }
  }

  /* ---------- Stories: the waiting place (held for Aiyana's yes) ---------- */

  var form = document.getElementById("aiyana-story-form");
  var nameInput = document.getElementById("aiyana-story-name");
  var storyInput = document.getElementById("aiyana-story-text");
  var confirmLine = document.getElementById("aiyana-story-confirm");
  var waitingList = document.getElementById("aiyana-waiting-list");
  var waitingEmpty = document.getElementById("aiyana-waiting-empty");
  var waiting = load(WAITING_KEY, []);
  if (!Array.isArray(waiting)) waiting = [];

  function renderWaiting() {
    if (!waitingList) return;
    Array.prototype.slice.call(waitingList.querySelectorAll(".aiyana-waiting-story")).forEach(function (n) { n.remove(); });
    if (waitingEmpty) waitingEmpty.style.display = waiting.length ? "none" : "";
    waiting.forEach(function (s) {
      var box = document.createElement("article");
      box.className = "aiyana-waiting-story";
      var tag = document.createElement("span");
      tag.className = "aiyana-waiting-tag";
      tag.textContent = "Waiting for Aiyana's yes";
      box.appendChild(tag);
      var text = document.createElement("p");
      text.className = "aiyana-note-text";
      text.textContent = s.story;
      box.appendChild(text);
      var by = document.createElement("p");
      by.className = "aiyana-note-text";
      var byText = document.createElement("em");
      byText.textContent = s.name ? "— " + s.name : "— no name given";
      by.appendChild(byText);
      box.appendChild(by);
      var back = document.createElement("button");
      back.type = "button";
      back.className = "aiyana-mini-btn";
      back.textContent = "Take it back";
      back.addEventListener("click", function () {
        waiting = waiting.filter(function (x) { return x.id !== s.id; });
        save(WAITING_KEY, waiting);
        renderWaiting();
      });
      box.appendChild(back);
      waitingList.appendChild(box);
    });
  }

  if (form && storyInput) {
    form.addEventListener("submit", function (evt) {
      evt.preventDefault();
      var story = storyInput.value.trim();
      if (!story) {
        storyInput.focus();
        return;
      }
      waiting.unshift({
        id: makeId(),
        name: nameInput ? nameInput.value.trim() : "",
        story: story,
        ts: Date.now()
      });
      save(WAITING_KEY, waiting);
      storyInput.value = "";
      if (nameInput) nameInput.value = "";
      if (confirmLine) {
        confirmLine.textContent = "Your story is in the waiting place. It will only appear on this page if Aiyana says yes.";
      }
      renderWaiting();
    });
  }
  renderWaiting();
})();
