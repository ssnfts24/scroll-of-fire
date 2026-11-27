/* Aiyana's World — the page's small machinery.
   Feelings, thoughts, and drawings stay on the visitor's own
   device (browser local storage); nothing about them is sent.
   Stories are the one thing that travels: a sent story goes to
   Aiyana's private waiting place and waits for her yes. It
   never appears on this page by itself — only the stories she
   has approved are read back and shown on the shelf below. */
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

  var STORIES_API = "/.netlify/functions/aiyana-stories";

  var form = document.getElementById("aiyana-story-form");
  var nameInput = document.getElementById("aiyana-story-name");
  var titleInput = document.getElementById("aiyana-story-title");
  var storyInput = document.getElementById("aiyana-story-text");
  var confirmLine = document.getElementById("aiyana-story-confirm");
  var waitingList = document.getElementById("aiyana-waiting-list");
  var waitingEmpty = document.getElementById("aiyana-waiting-empty");
  var approvedList = document.getElementById("aiyana-approved-list");
  var waiting = load(WAITING_KEY, []);
  if (!Array.isArray(waiting)) waiting = [];

  var WORDS_MESSAGE = "Some words in your story need changing before Aiyana can read it — try fixing the words and send it again.";

  function sendStory(entry) {
    if (!window.fetch) return Promise.resolve(null);
    return fetch(STORIES_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "submit",
        penName: entry.name || "",
        title: entry.title || "",
        story: entry.story
      })
    })
      .then(function (res) { return res.json().catch(function () { return null; }); })
      .catch(function () { return null; });
  }

  function sentMessage(result) {
    if (result && result.ok) {
      return "Your story is in the waiting place. It will only appear on this page if Aiyana says yes.";
    }
    if (result && result.reason === "words-to-fix") return WORDS_MESSAGE;
    if (result && result.reason === "slow-down") {
      return "You have sent a lot of stories in a row. Rest a little, then send again.";
    }
    return "Your story could not travel right now, so it is kept safe on this device. You can try sending it again below.";
  }

  function renderWaiting() {
    if (!waitingList) return;
    Array.prototype.slice.call(waitingList.querySelectorAll(".aiyana-waiting-story")).forEach(function (n) { n.remove(); });
    if (waitingEmpty) waitingEmpty.style.display = waiting.length ? "none" : "";
    waiting.forEach(function (s) {
      var box = document.createElement("article");
      box.className = "aiyana-waiting-story";
      var tag = document.createElement("span");
      tag.className = "aiyana-waiting-tag";
      tag.textContent = s.sent ? "Waiting for Aiyana's yes" : "Kept on this device — not sent yet";
      box.appendChild(tag);
      if (s.title) {
        var title = document.createElement("p");
        title.className = "aiyana-note-text";
        var strong = document.createElement("strong");
        strong.textContent = s.title;
        title.appendChild(strong);
        box.appendChild(title);
      }
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
      if (!s.sent) {
        var retry = document.createElement("button");
        retry.type = "button";
        retry.className = "aiyana-mini-btn";
        retry.textContent = "Try sending again";
        retry.addEventListener("click", function () {
          retry.disabled = true;
          sendStory(s).then(function (result) {
            s.sent = !!(result && result.ok);
            save(WAITING_KEY, waiting);
            if (confirmLine) confirmLine.textContent = sentMessage(result);
            renderWaiting();
          });
        });
        box.appendChild(retry);
      }
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
      var entry = {
        id: makeId(),
        name: nameInput ? nameInput.value.trim() : "",
        title: titleInput ? titleInput.value.trim() : "",
        story: story,
        ts: Date.now(),
        sent: false
      };
      waiting.unshift(entry);
      save(WAITING_KEY, waiting);
      storyInput.value = "";
      if (nameInput) nameInput.value = "";
      if (titleInput) titleInput.value = "";
      if (confirmLine) confirmLine.textContent = "Sending your story to Aiyana's waiting place…";
      renderWaiting();
      sendStory(entry).then(function (result) {
        entry.sent = !!(result && result.ok);
        save(WAITING_KEY, waiting);
        if (confirmLine) confirmLine.textContent = sentMessage(result);
        renderWaiting();
      });
    });
  }
  renderWaiting();

  /* ---------- The shelf: stories Aiyana said yes to ---------- */

  function renderApproved(stories, page) {
    if (!approvedList || !Array.isArray(stories)) return;
    var ordered = stories.slice();
    if (page) {
      var byId = {};
      ordered.forEach(function (s) { byId[s.id] = s; });
      var rest = [];
      if (page.featuredId && byId[page.featuredId]) {
        rest.push(byId[page.featuredId]);
        delete byId[page.featuredId];
      }
      (page.storyOrder || []).forEach(function (id) {
        if (byId[id]) { rest.push(byId[id]); delete byId[id]; }
      });
      ordered.forEach(function (s) { if (byId[s.id]) rest.push(s); });
      ordered = rest;
    }
    ordered.forEach(function (s) {
      var article = document.createElement("article");
      article.className = "aiyana-story" + (page && page.featuredId === s.id ? " aiyana-story-featured" : "");
      if (page && page.featuredId === s.id) {
        var badge = document.createElement("p");
        badge.className = "aiyana-featured-badge";
        badge.textContent = "\u2605 Aiyana's big story";
        article.appendChild(badge);
      }
      var h = document.createElement("h4");
      h.className = "aiyana-story-title";
      h.textContent = s.title || "A story";
      article.appendChild(h);
      var by = document.createElement("p");
      by.className = "aiyana-story-by";
      by.textContent = "by " + (s.penName || "a friend");
      article.appendChild(by);
      String(s.story || "").split(/\n+/).forEach(function (para) {
        if (!para.trim()) return;
        var p = document.createElement("p");
        p.textContent = para;
        article.appendChild(p);
      });
      approvedList.appendChild(article);
    });
  }

  /* ---------- Her page's own blocks: the choices she made ----------
   *
   * Her dashboard keeps a shelf of safe blocks — her welcome
   * words, her headline line, her about-me, her author line,
   * her sign's colour, her page's mood, her top picture, her
   * trim, her big story and story order, her feel line, her
   * favourite things, what shows and hides, her reading size.
   * Until she changes them, the store serves the defaults —
   * this page exactly as it stands today — and applying them
   * changes nothing anyone can see. In preview (her dashboard's
   * "See how it will look"), the draft she is holding stands
   * in for the store, through this same road. */

  var TRIM_ART = {
    butterflies: '<svg viewBox="0 0 100 80" focusable="false"><path d="M48 38 C20 2, 2 16, 8 36 C12 50, 30 50, 48 42 Z"/><path d="M52 38 C80 2, 98 16, 92 36 C88 50, 70 50, 52 42 Z"/><ellipse cx="50" cy="43" rx="3.4" ry="13"/></svg>',
    stars: '<svg viewBox="0 0 100 100" focusable="false"><path d="M50 4 L62 36 L96 36 L68 57 L79 90 L50 69 L21 90 L32 57 L4 36 L38 36 Z"/></svg>',
    moons: '<svg viewBox="0 0 100 100" focusable="false"><path d="M55 6 A44 44 0 1 0 55 94 A35 35 0 1 1 55 6 Z"/></svg>'
  };

  function applyPage(page) {
    if (!page) return;
    var sign = document.getElementById("aiyana-sign");
    var title = document.getElementById("aiyana-sign-title");
    var headline = document.getElementById("aiyana-headline");
    var about = document.getElementById("aiyana-about");
    if (title && page.welcome) title.textContent = page.welcome;
    if (headline && page.headline) headline.textContent = page.headline;
    if (about && page.about) about.textContent = page.about;
    if (sign && page.banner) sign.setAttribute("data-banner", page.banner);
    if (page.mood) document.body.setAttribute("data-mood", page.mood);

    var feel = document.getElementById("aiyana-feel-line");
    if (feel && page.showFeel !== false && page.feelLine) {
      feel.textContent = page.feelLine;
      feel.hidden = false;
    }
    var author = document.getElementById("aiyana-author-line");
    if (author && page.authorLine) {
      author.textContent = "Stories by " + page.authorLine;
      author.hidden = false;
    }
    if (page.trim && TRIM_ART[page.trim]) {
      ["aiyana-trim-sign", "aiyana-trim-stories"].forEach(function (id) {
        var strip = document.getElementById(id);
        if (!strip) return;
        strip.innerHTML = "";
        for (var i = 0; i < 9; i++) {
          var span = document.createElement("span");
          span.className = "aiyana-trim-item trim-" + page.trim;
          span.innerHTML = TRIM_ART[page.trim];
          strip.appendChild(span);
        }
        strip.hidden = false;
      });
    }
    var figure = document.getElementById("aiyana-top-picture");
    var img = document.getElementById("aiyana-top-picture-img");
    function standPicture(src) {
      /* The site's image-fallback watch may have shelved this
         img while it stood src-less in its hidden figure; stand
         it back up before it wears her picture. */
      img.removeAttribute("hidden");
      img.removeAttribute("aria-hidden");
      img.classList.remove("image-fallback-failed", "sphere-broken-resource-hidden");
      img.src = src;
      figure.hidden = false;
    }
    if (figure && img && page.topPicture === "story-drawing") {
      standPicture("assets/img/aiyana/aiyana-first-story-drawing.webp");
    } else if (figure && img && page.topPicture === "my-drawing" && window.fetch) {
      fetch(STORIES_API + "?list=drawing")
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (data) {
          if (data && data.dataUrl) standPicture(data.dataUrl);
        })
        .catch(function () { /* no picture stands until it can truly load */ });
    }
    var favSection = document.getElementById("aiyana-favourites");
    var favList = document.getElementById("aiyana-favourites-list");
    if (favSection && favList && page.showFavourites !== false && Array.isArray(page.favourites) && page.favourites.length) {
      page.favourites.forEach(function (f) {
        var li = document.createElement("li");
        li.textContent = f;
        favList.appendChild(li);
      });
      favSection.hidden = false;
    }
    if (page.showStories === false) {
      var shelfTitle = document.getElementById("aiyana-shelf-title");
      if (shelfTitle) shelfTitle.style.display = "none";
      if (approvedList) approvedList.style.display = "none";
    }
    if (page.storySize === "bigger") {
      var storiesCard = document.querySelector(".aiyana-stories");
      if (storiesCard) storiesCard.classList.add("is-bigger");
    }
  }

  function previewDraft() {
    try {
      if (new URLSearchParams(window.location.search).get("preview") !== "1") return null;
      var raw = window.sessionStorage.getItem("aiyana.preview.v1");
      return raw ? JSON.parse(raw) : null;
    } catch (err) { return null; }
  }

  if (window.fetch) {
    var draft = previewDraft();
    var pagePromise = draft
      ? Promise.resolve(draft)
      : fetch(STORIES_API + "?list=page")
          .then(function (res) { return res.ok ? res.json() : null; })
          .then(function (data) { return data && data.ok ? data.page : null; })
          .catch(function () { return null; });
    var approvedPromise = approvedList
      ? fetch(STORIES_API + "?list=approved")
          .then(function (res) { return res.ok ? res.json() : null; })
          .then(function (data) { return data && data.ok ? data.stories : []; })
          .catch(function () { return []; })
      : Promise.resolve([]);
    Promise.all([pagePromise, approvedPromise]).then(function (both) {
      applyPage(both[0]);
      renderApproved(both[1], both[0]);
    });
  }
})();
