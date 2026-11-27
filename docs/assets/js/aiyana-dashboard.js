/* Aiyana's Story Door — her dashboard machinery.
   Three secret words open the door (the words live on the
   server, never here — this page only knows the nine word
   buttons). After the door opens she sees the stories waiting
   for her, reads one big, and says YES or NOT YET. That is the
   whole dashboard, on purpose. */
(function () {
  "use strict";

  var API = "/.netlify/functions/aiyana-stories";
  var TOKEN_KEY = "aiyana.dash.token.v1";
  var WORDS = ["butterfly", "moon", "rainbow", "star", "flower", "cat", "fish", "tree", "sun"];

  var gateSection = document.getElementById("dash-gate");
  var homeSection = document.getElementById("dash-home");
  var readSection = document.getElementById("dash-read");
  var dots = Array.prototype.slice.call(document.querySelectorAll(".dash-dot"));
  var wordsBox = document.getElementById("dash-words");
  var gateLine = document.getElementById("dash-gate-line");
  var gateClear = document.getElementById("dash-gate-clear");
  var hello = document.getElementById("dash-hello");
  var pendingBox = document.getElementById("dash-pending");
  var pendingEmpty = document.getElementById("dash-pending-empty");
  var shelfBox = document.getElementById("dash-shelf");
  var shelfEmpty = document.getElementById("dash-shelf-empty");
  var refreshBtn = document.getElementById("dash-refresh");
  var readTitle = document.getElementById("dash-read-title");
  var readBy = document.getElementById("dash-read-by");
  var readText = document.getElementById("dash-read-text");
  var readBack = document.getElementById("dash-read-back");
  var readLine = document.getElementById("dash-read-line");
  var yesBtn = document.getElementById("dash-yes");
  var notYetBtn = document.getElementById("dash-notyet");

  var token = "";
  try { token = window.sessionStorage.getItem(TOKEN_KEY) || ""; } catch (err) { token = ""; }
  var picked = [];
  var current = null;

  function call(body) {
    return fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (res) { return res.json().catch(function () { return null; }); })
      .catch(function () { return null; });
  }

  function show(section) {
    [gateSection, homeSection, readSection].forEach(function (s) {
      if (s) s.hidden = s !== section;
    });
    window.scrollTo(0, 0);
  }

  /* ---------- The gate ---------- */

  function renderDots() {
    dots.forEach(function (d, i) { d.classList.toggle("is-filled", i < picked.length); });
    Array.prototype.slice.call(wordsBox.querySelectorAll(".dash-word")).forEach(function (b) {
      b.classList.toggle("is-picked", picked.indexOf(b.getAttribute("data-word")) !== -1);
    });
  }

  WORDS.forEach(function (w) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "dash-word";
    b.setAttribute("data-word", w);
    b.textContent = w.charAt(0).toUpperCase() + w.slice(1);
    b.addEventListener("click", function () {
      if (picked.length >= 3) return;
      picked.push(w);
      renderDots();
      if (picked.length === 3) tryGate();
    });
    wordsBox.appendChild(b);
  });

  if (gateClear) {
    gateClear.addEventListener("click", function () {
      picked = [];
      renderDots();
      gateLine.textContent = "Nobody else can open this door.";
    });
  }

  function tryGate() {
    gateLine.textContent = "Opening your door…";
    call({ action: "gate", words: picked }).then(function (r) {
      if (r && r.ok && r.token) {
        token = r.token;
        try { window.sessionStorage.setItem(TOKEN_KEY, token); } catch (err) { /* fine */ }
        loadHome("Hi Aiyana! The door is open.");
      } else if (r && r.reason === "not-ready") {
        gateLine.textContent = "Your door is still being built. Ask Dad — it is almost ready.";
        picked = [];
        renderDots();
      } else if (r && r.reason === "slow-down") {
        gateLine.textContent = "Too many tries. Rest a little, then try your words again.";
        picked = [];
        renderDots();
      } else {
        gateLine.textContent = "Those are not your words. Try again — you know them!";
        picked = [];
        renderDots();
      }
    });
  }

  /* ---------- Her lists ---------- */

  function storyCard(story, withRead) {
    var card = document.createElement("article");
    card.className = "dash-story-card" + (withRead ? "" : " dash-shelf-card");
    var h = document.createElement("h3");
    h.textContent = story.title || "A story";
    card.appendChild(h);
    var by = document.createElement("p");
    by.className = "dash-by";
    by.textContent = "by " + (story.penName || "a friend");
    card.appendChild(by);
    if (withRead) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dash-read-btn";
      btn.textContent = "Read it";
      btn.addEventListener("click", function () { openStory(story); });
      card.appendChild(btn);
    }
    return card;
  }

  function loadHome(message) {
    call({ action: "list", token: token }).then(function (r) {
      if (!r || !r.ok) {
        try { window.sessionStorage.removeItem(TOKEN_KEY); } catch (err) { /* fine */ }
        token = "";
        picked = [];
        renderDots();
        gateLine.textContent = "The door closed. Tap your three words to open it again.";
        show(gateSection);
        return;
      }
      pendingBox.innerHTML = "";
      shelfBox.innerHTML = "";
      r.pending.forEach(function (s) { pendingBox.appendChild(storyCard(s, true)); });
      r.approved.forEach(function (s) { shelfBox.appendChild(storyCard(s, false)); });
      pendingEmpty.style.display = r.pending.length ? "none" : "";
      shelfEmpty.style.display = r.approved.length ? "none" : "";
      hello.textContent = message || (r.pending.length
        ? "You have " + r.pending.length + (r.pending.length === 1 ? " new story" : " new stories") + " waiting for you!"
        : "Hi Aiyana! No new stories right now.");
      show(homeSection);
    });
  }

  if (refreshBtn) refreshBtn.addEventListener("click", function () { loadHome(""); });

  /* ---------- Reading & deciding ---------- */

  function openStory(story) {
    current = story;
    readTitle.textContent = story.title || "A story";
    readBy.textContent = "by " + (story.penName || "a friend");
    readText.innerHTML = "";
    String(story.story || "").split(/\n+/).forEach(function (para) {
      if (!para.trim()) return;
      var p = document.createElement("p");
      p.textContent = para;
      readText.appendChild(p);
    });
    readLine.textContent = "";
    show(readSection);
  }

  if (readBack) readBack.addEventListener("click", function () { show(homeSection); });

  function decide(action, doneMessage) {
    if (!current) return;
    yesBtn.disabled = true;
    notYetBtn.disabled = true;
    call({ action: action, token: token, id: current.id }).then(function (r) {
      yesBtn.disabled = false;
      notYetBtn.disabled = false;
      if (r && r.ok) {
        current = null;
        loadHome(doneMessage);
      } else {
        readLine.textContent = "That did not work. Try again.";
      }
    });
  }

  if (yesBtn) yesBtn.addEventListener("click", function () {
    decide("accept", "You said YES! The story is in your world now.");
  });
  if (notYetBtn) notYetBtn.addEventListener("click", function () {
    decide("away", "Okay — that story went away. It is not in your world.");
  });

  /* ---------- Start ---------- */

  if (token) {
    loadHome("");
  } else {
    show(gateSection);
  }
})();
