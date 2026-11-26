/* The Spark Stall — the goods catalogue, rendered from
   assets/data/spark-goods.json. Catalogue only: the till is not
   open, and there is no way to pay anywhere in this file.
   A storefront, not a list: the wearables stand on four shelves,
   every shelf tile a miniature of the Spark wearing that good.
   The stage draws the keeper's own Spark — the same generate +
   renderSVG every other surface uses, from the record at
   sof.spark.v1 — and dresses it with the goods a keeper taps;
   only when no Spark record stands on this device does the
   stage fall back to a plain figure. The goods that are not
   worn stay in the catalogue below the shelves, in one folded
   block. Rarity is carried honestly: editions and their issue
   day, one-Moon windows, seed variants, and the earned-only
   tier marked "Earned, never sold". */
(function () {
  "use strict";
  var section = document.getElementById("spark-stall");
  if (!section) return;
  var stageEl = document.getElementById("stall-stage");
  var listEl = document.getElementById("stall-list");
  var noteEl = document.getElementById("stall-note");

  var catalogue = null;
  var itemsById = {};
  var keeper = null; // { record, companion, name } when a Spark record stands here
  var wornIds = {}; // item id -> true, for the goods standing on the stage

  /* ---- the shelves ---- */
  var SHELVES = [
    { id: "worn", title: "Worn" },
    { id: "carried", title: "Carried" },
    { id: "wraps", title: "Flame Wraps" },
    { id: "trails", title: "Light Trails" }
  ];
  // A good with a stage drawing is a wearable; its shelf is its
  // own family — the game's two wearables fold in by drawing.
  function shelfOf(it) {
    if (!it || !it.stage) return null;
    if (it.category === "worn" || it.category === "carried" || it.category === "wraps" || it.category === "trails") return it.category;
    return it.stage.indexOf("wrap-") === 0 ? "wraps" : "trails";
  }

  /* ---- the keeper's own Spark, read the way every surface reads it ---- */
  function readKeeper() {
    try {
      var Core = window.SparkCompanion;
      if (!Core || !Core.generate || !Core.renderSVG || !Core.parseSeed) return null;
      var raw = window.localStorage.getItem(Core.STORAGE_KEY || "sof.spark.v1");
      if (!raw) return null;
      var record = JSON.parse(raw);
      if (!record || !Core.parseSeed(record.seed)) return null;
      var companion = Core.generate(record.seed);
      if (!companion) return null;
      return { record: record, companion: companion, name: record.name || companion.name };
    } catch (e) {
      return null;
    }
  }
  var SPARK_BOX = { x: 70, y: 22, size: 180 }; // the Spark's seat in the 320x240 canvas
  function sparkFigure() {
    if (!keeper) return null;
    var Core = window.SparkCompanion;
    var stage = 0, revealed = null, wrap = null;
    try {
      if (Core.stageOf) stage = Core.stageOf(keeper.record, keeper.companion).index;
      if (Core.revealsFor) revealed = Core.revealsFor({ record: keeper.record, companion: keeper.companion }).revealed;
      if (Core.wrapFor) wrap = Core.wrapFor(keeper.record);
    } catch (e) { /* the born look stands */ }
    var svg = Core.renderSVG(keeper.companion, { stage: stage, revealed: revealed, wrap: wrap });
    if (!svg) return null;
    return svg.replace("<svg ", '<svg x="' + SPARK_BOX.x + '" y="' + SPARK_BOX.y + '" width="' + SPARK_BOX.size + '" height="' + SPARK_BOX.size + '" ');
  }
  // The overlays were drawn around a body at (160, 118), r 24, in
  // this canvas; the keeper's Spark stands at (50, 54) in
  // renderSVG's 100-unit frame. The map anchors to the whole
  // figure the overlays were drawn for — core and petals, r ~40
  // here — so side-carried goods stay inside the stage.
  var OLD_BODY = { cx: 160, cy: 118, r: 24 };
  var NEW_BODY = { cx: SPARK_BOX.x + 50 * (SPARK_BOX.size / 100), cy: SPARK_BOX.y + 54 * (SPARK_BOX.size / 100), r: 40 };
  function bodyTransform() {
    var s = NEW_BODY.r / OLD_BODY.r;
    return "translate(" + NEW_BODY.cx + " " + NEW_BODY.cy + ") scale(" + s.toFixed(3) + ") translate(" + (-OLD_BODY.cx) + " " + (-OLD_BODY.cy) + ")";
  }

  /* ---- the goods' drawings, in overlay space (body at 160, 118) ---- */
  function tag(x, y) {
    return '<circle cx="' + x + '" cy="' + y + '" r="4" fill="#c9a24b" stroke="#7a5c1e" stroke-width="1"><title>brass tag — purchased</title></circle>';
  }
  function overlay(key) {
    switch (key) {
      case "lantern": return '<g><rect x="228" y="128" width="18" height="26" rx="3" fill="#2a2118" stroke="#c9a24b"/><circle cx="237" cy="141" r="6" fill="#ffd98a"/><line x1="237" y1="128" x2="237" y2="118" stroke="#c9a24b"/></g>' + tag(246, 156);
      case "pouch": return '<path d="M118 158 q10 14 24 0 l-3 -14 h-18 z" fill="#5b4632" stroke="#c9a24b"/>' + tag(130, 166);
      case "satchel": return '<rect x="96" y="140" width="26" height="20" rx="4" fill="#6b4e2e" stroke="#c9a24b"/>' + tag(122, 162);
      case "scrollcase": return '<g transform="rotate(24 108 120)"><rect x="100" y="92" width="14" height="52" rx="6" fill="#7a5c33" stroke="#c9a24b"/></g>' + tag(112, 148);
      case "astrolabe": return '<g fill="none" stroke="#c9a24b"><circle cx="160" cy="96" r="13"/><circle cx="160" cy="96" r="8"/></g>' + tag(160, 112);
      case "bead": return '<circle cx="138" cy="168" r="6" fill="#8a97a5" stroke="#c9a24b"/>' + tag(146, 172);
      case "key": return '<g stroke="#c9a24b" fill="none"><circle cx="196" cy="150" r="6"/><line x1="196" y1="156" x2="196" y2="176"/><line x1="196" y1="168" x2="204" y2="168"/></g>' + tag(196, 150);
      case "scarf": return '<path d="M128 138 q32 18 64 0 l0 12 q-32 16 -64 0 z" fill="#3f7d8c" stroke="#c9a24b"/>' + tag(188, 152);
      case "moonband": {
        var s = "", i, a, x, y;
        for (i = 0; i < 13; i++) { a = (i / 13) * Math.PI * 2; x = 160 + Math.cos(a) * 40; y = 118 + Math.sin(a) * 40; s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.4" fill="' + (i === 7 ? "#ffe9a8" : "#5a6a7d") + '"/>'; }
        return s + tag(196, 146);
      }
      case "clasp": return '<circle cx="128" cy="98" r="7" fill="none" stroke="#c9a24b" stroke-width="2"/>' + tag(128, 98);
      case "circlet": return '<ellipse cx="160" cy="76" rx="30" ry="7" fill="none" stroke="#e8c97a" stroke-width="2.4"/>' + tag(160, 84);
      case "ribbon": return '<path d="M186 132 q16 10 10 26 q-4 10 -14 12" fill="none" stroke="#e8e2d0" stroke-width="5"/>' + tag(192, 146);
      case "veil": return '<path d="M118 96 a46 40 0 0 1 84 0 l0 10 a46 34 0 0 0 -84 0 z" fill="#d9d2e8" opacity="0.35"/>' + tag(196, 108);
      case "petals": return '<g fill="#e8b7c9" opacity="0.8"><circle cx="96" cy="84" r="4"/><circle cx="222" cy="70" r="3.4"/><circle cx="238" cy="120" r="4"/><circle cx="84" cy="130" r="3.2"/><circle cx="200" cy="180" r="3.6"/><circle cx="112" cy="186" r="3"/></g>' + tag(238, 120);
      case "motes": return '<g fill="#ffb45e"><circle cx="96" cy="150" r="2.6"/><circle cx="82" cy="132" r="2.2"/><circle cx="104" cy="168" r="2"/><circle cx="70" cy="150" r="1.8"/></g>' + tag(96, 150);
      case "seasonmotes": return '<g fill="#a8d98a"><circle cx="98" cy="146" r="2.6"/><circle cx="84" cy="164" r="2.2"/><circle cx="110" cy="128" r="2"/></g>' + tag(98, 146);
      case "fireflies": return '<g fill="#cfe87a"><circle cx="92" cy="96" r="2.8"/><circle cx="228" cy="92" r="2.4"/><circle cx="206" cy="176" r="2.6"/><circle cx="104" cy="182" r="2.2"/></g>' + tag(92, 96);
      case "ripple": return '<g fill="none" stroke="#7fb3c8" opacity="0.7"><ellipse cx="160" cy="196" rx="52" ry="9"/><ellipse cx="160" cy="196" rx="76" ry="13" opacity="0.5"/></g>' + tag(212, 196);
      case "longribbon": return '<path d="M126 128 q-50 6 -72 -18 q-14 -16 4 -26" fill="none" stroke="#f3c97a" stroke-width="6" opacity="0.85"/>' + tag(120, 126);
      case "comet": return '<path d="M128 118 L34 96 L128 138 Z" fill="#ffe9a8" opacity="0.55"/>' + tag(124, 118);
      case "wake": return '<path d="M124 150 q-56 22 -96 6 q40 -4 62 -18 q16 -10 34 -6 z" fill="#cfd8e8" opacity="0.5"/>' + tag(118, 148);
      default: return "";
    }
  }
  var PETALS = [0, 60, 120, 180, 240, 300];
  function petalRing(cx, cy, len, fill, r) {
    var out = "";
    PETALS.forEach(function (a) {
      out += '<ellipse cx="' + cx + '" cy="' + (cy - len) + '" rx="' + r + '" ry="' + len + '" fill="' + fill + '" opacity="0.85" transform="rotate(' + a + ' ' + cx + ' ' + cy + ')"/>';
    });
    return out;
  }
  var WRAP_LOOK = {
    "wrap-hearth": { fill: "#b85c2a", len: 30 },
    "wrap-storm": { fill: "#e8a33d", len: 42 },
    "wrap-petal": { fill: "#e8a8bf", len: 32 },
    "wrap-spiral": { fill: "#ffe9a8", len: 30 }
  };
  var FRONT_KEYS = { circlet: 1, veil: 1, scarf: 1, moonband: 1 };
  var SPIRAL_PATH = '<path d="M138 118 a22 22 0 1 1 22 22 a15 15 0 1 0 -15 -15 a9 9 0 1 1 9 9" fill="none" stroke="#ffe9a8" stroke-width="2" opacity="0.8"/>';

  /* One figure, one code path: stage and shelf tiles alike are
     drawn here — a tile with its single good, the stage with all
     the goods standing on the Spark. */
  function figureSVG(wornItems, label) {
    var wrapItem = null, body = [], field = [], front = [];
    wornItems.forEach(function (it) {
      var key = it.stage;
      if (!key) return;
      if (key.indexOf("wrap-") === 0) { wrapItem = it; return; }
      if (shelfOf(it) === "trails") field.push(it);
      else if (FRONT_KEYS[key]) front.push(it);
      else body.push(it);
    });
    var wrapKey = wrapItem ? wrapItem.stage : null;
    var look = wrapKey ? WRAP_LOOK[wrapKey] : null;
    var s = '<svg viewBox="0 0 320 240" role="img" aria-label="' + label + '">';
    s += '<rect width="320" height="240" fill="#05070d"/><ellipse cx="160" cy="198" rx="110" ry="16" fill="#0d1420"/>';
    field.forEach(function (it) { s += overlay(it.stage); });
    var fig = sparkFigure();
    if (fig) {
      // The keeper's own Spark: the wrap's petals ring it from
      // behind, and the goods ride on its body by the map above.
      if (look && wrapKey !== "wrap-spiral") s += petalRing(NEW_BODY.cx, NEW_BODY.cy, look.len, look.fill, 13);
      s += fig;
      s += '<g transform="' + bodyTransform() + '">';
      body.forEach(function (it) { s += overlay(it.stage); });
      front.forEach(function (it) { s += overlay(it.stage); });
      if (wrapKey === "wrap-spiral") s += SPIRAL_PATH;
      if (wrapItem) s += tag(196, 158);
      s += "</g>";
    } else {
      // No Spark record on this device: the plain figure, dressed
      // the way the stall has always dressed it.
      body.forEach(function (it) { s += overlay(it.stage); });
      var petalFill = "#d99545", petalLen = 30;
      if (wrapKey === "wrap-hearth") { petalFill = "#b85c2a"; petalLen = 24; }
      if (wrapKey === "wrap-storm") { petalFill = "#e8a33d"; petalLen = 40; }
      if (wrapKey === "wrap-petal") { petalFill = "#e8a8bf"; petalLen = 28; }
      s += petalRing(160, 118, petalLen, petalFill, 11);
      if (wrapKey === "wrap-spiral") s += SPIRAL_PATH;
      s += '<circle cx="160" cy="118" r="24" fill="#f4f1e8"/><circle cx="160" cy="118" r="15" fill="#f3c97a"/><circle cx="153" cy="111" r="3.4" fill="#05070d"/><circle cx="167" cy="111" r="3.4" fill="#05070d"/><path d="M152 126 q8 6 16 0" fill="none" stroke="#05070d" stroke-width="2.4"/>';
      front.forEach(function (it) { s += overlay(it.stage); });
      if (wrapItem) s += tag(196, 158);
    }
    s += "</svg>";
    return s;
  }

  function wornItems() {
    if (!catalogue) return [];
    return catalogue.items.filter(function (it) { return wornIds[it.id]; });
  }
  function drawStage() {
    var items = wornItems();
    var label = keeper ? keeper.name + " on the stall stage, wearing the goods you have tapped" : "A Spark on the stall stage, wearing the goods you have tapped";
    stageEl.innerHTML = figureSVG(items, label);
    var names = items.map(function (it) { return it.name; });
    if (names.length) {
      noteEl.textContent = (keeper ? "On " + keeper.name + " now: " : "On the Spark now: ") + names.join(" · ") + ". Every bought good carries its brass tag.";
    } else {
      noteEl.textContent = keeper ? "This is " + keeper.name + ", your own Spark. Tap a good on a shelf and it stands here, tag and all." : "Tap a good on a shelf and it stands here, on the Spark, tag and all.";
    }
  }

  /* ---- prices and stamps, as the catalogue carries them ---- */
  function priceLine(it) {
    if (it.rarity && it.rarity.type === "earned-only") return "Earned, never sold — no price, ever.";
    var p = it.band + " · $" + it.price + " catalogue";
    if (it.embers) p += " · or " + it.embers + " Embers";
    else p += " · no Embers price";
    return p;
  }
  function tilePrice(it) {
    var p = it.band + " · $" + it.price;
    if (it.embers) p += " · " + it.embers + " Embers";
    return p;
  }
  function tileStamp(it) {
    var r = it.rarity || {};
    if (r.type === "edition") return "First Edition · Moon " + r.issuedMoon;
    if (r.type === "moon-window") return "Issued for Moon " + r.issuedMoon + " only";
    return "";
  }
  function rarityLine(it) {
    var r = it.rarity || {};
    return r.note || "";
  }

  /* ---- the storefront ---- */
  function selectShelf(id) {
    listEl.querySelectorAll(".stall-tab").forEach(function (t) {
      var on = t.getAttribute("data-shelf") === id;
      t.classList.toggle("on", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    listEl.querySelectorAll("[data-shelf-panel]").forEach(function (p) {
      if (p.getAttribute("data-shelf-panel") === id) p.removeAttribute("hidden");
      else p.setAttribute("hidden", "");
    });
  }
  function syncTiles() {
    listEl.querySelectorAll(".stall-tile").forEach(function (tile) {
      var on = !!wornIds[tile.getAttribute("data-item")];
      tile.classList.toggle("on", on);
      tile.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  function toggleItem(id) {
    var it = itemsById[id];
    if (!it) return;
    if (wornIds[id]) {
      delete wornIds[id];
    } else {
      if (shelfOf(it) === "wraps") {
        // One wrap at a time: a flame wears one wrap, never two.
        Object.keys(wornIds).forEach(function (oid) {
          if (shelfOf(itemsById[oid]) === "wraps") delete wornIds[oid];
        });
      }
      wornIds[id] = true;
    }
    syncTiles();
    drawStage();
  }

  function render(data) {
    catalogue = data;
    itemsById = {};
    data.items.forEach(function (it) { itemsById[it.id] = it; });
    keeper = readKeeper();

    var byShelf = { worn: [], carried: [], wraps: [], trails: [] };
    var beyond = [];
    data.items.forEach(function (it) {
      var sh = shelfOf(it);
      if (sh) byShelf[sh].push(it);
      else beyond.push(it);
    });

    var html = '<div class="stall-tabs" role="tablist" aria-label="The stall shelves">';
    SHELVES.forEach(function (sh, i) {
      html += '<button type="button" role="tab" class="stall-tab' + (i === 0 ? " on" : "") + '" data-shelf="' + sh.id + '" aria-selected="' + (i === 0 ? "true" : "false") + '">' + sh.title + " · " + byShelf[sh.id].length + "</button>";
    });
    html += "</div>";
    SHELVES.forEach(function (sh, i) {
      html += '<div class="stall-shelf" data-shelf-panel="' + sh.id + '"' + (i === 0 ? "" : " hidden") + '><div class="stall-grid">';
      byShelf[sh.id].forEach(function (it) {
        var stamp = tileStamp(it);
        html += '<button type="button" class="stall-tile" data-item="' + it.id + '" aria-pressed="false">' +
          '<span class="stall-tile-art">' + figureSVG([it], it.name + ", shown on the Spark") + "</span>" +
          '<span class="stall-tile-name">' + it.name + "</span>" +
          '<span class="stall-tile-price">' + tilePrice(it) + "</span>" +
          (stamp ? '<span class="stall-tile-stamp">' + stamp + "</span>" : "") +
          (it.category === "game" ? '<span class="stall-tile-game">SPARK!</span>' : "") +
          "</button>";
      });
      html += "</div></div>";
    });

    html += '<details class="stall-beyond"><summary>Beyond the wearable shelves — the rest of the catalogue (' + beyond.length + " goods)</summary>";
    html += '<p class="spark-note">These goods are not worn on the Spark, so they do not stand on the shelves. The home goods stand in the Hearth, in your Spark\'s own room and ground. The rest — its expressions and manners, stickers, themes for your ground, sounds and hums, and the game\'s unworn cosmetics — await Aaron\'s ruling on where they belong. Nothing has been taken out of the catalogue.</p>';
    data.categories.forEach(function (cat) {
      var items = beyond.filter(function (i) { return i.category === cat.id; });
      if (!items.length) return;
      html += '<div class="stall-cat"><h3>' + cat.title + '</h3><p class="spark-note">' + cat.line + '</p><ul class="stall-items">';
      items.forEach(function (it) {
        html += '<li class="stall-item"><strong>' + it.name + "</strong> — " + it.sellingPoint + ".";
        html += '<br><span class="stall-price">' + priceLine(it) + "</span>";
        var rl = rarityLine(it);
        if (rl) html += '<br><span class="stall-rarity">' + rl + "</span>";
        html += "</li>";
      });
      html += "</ul></div>";
    });
    html += "</details>";

    listEl.innerHTML = html;
    listEl.addEventListener("click", function (ev) {
      var tab = ev.target.closest ? ev.target.closest(".stall-tab") : null;
      if (tab) { selectShelf(tab.getAttribute("data-shelf")); return; }
      var tile = ev.target.closest ? ev.target.closest(".stall-tile") : null;
      if (tile) toggleItem(tile.getAttribute("data-item"));
    });

    var lin = document.getElementById("stall-lineage");
    if (lin && data.lineage) {
      lin.innerHTML = "<strong>Provenance — a certificate without a chain.</strong> " + data.lineage.about +
        " The record carries: " + data.lineage.fields.join(", ") + ". " + data.lineage.note;
    }
    drawStage();
  }
  fetch("assets/data/spark-goods.json").then(function (r) { return r.json(); }).then(render).catch(function () {
    noteEl.textContent = "The catalogue could not be read just now — the stall itself is unchanged, and the till is still closed.";
  });
})();
