/* The Spark Stall — the full goods catalogue, rendered from
   assets/data/spark-goods.json. Catalogue only: the till is not
   open, there is no cart and no way to pay anywhere in this file.
   The stage draws a Spark as an SVG and dresses it with the goods
   a keeper taps, so a good is seen ON the Spark before anything
   else is said about it. Rarity is carried honestly: editions and
   their issue day, one-Moon windows, seed variants, and the
   earned-only tier marked "Earned, never sold". */
(function () {
  "use strict";
  var section = document.getElementById("spark-stall");
  if (!section) return;
  var stageEl = document.getElementById("stall-stage");
  var listEl = document.getElementById("stall-list");
  var noteEl = document.getElementById("stall-note");
  var worn = {}; // stageKey -> item name

  var PETALS = [0, 60, 120, 180, 240, 300];
  function petal(angle, len, fill, r) {
    return '<ellipse cx="160" cy="' + (118 - len) + '" rx="' + r + '" ry="' + len + '" fill="' + fill + '" opacity="0.85" transform="rotate(' + angle + ' 160 118)"/>';
  }
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
  function drawStage() {
    var wrapKey = null, key;
    for (key in worn) if (key.indexOf("wrap-") === 0) wrapKey = key;
    var petalFill = "#d99545", petalLen = 30;
    if (wrapKey === "wrap-hearth") { petalFill = "#b85c2a"; petalLen = 24; }
    if (wrapKey === "wrap-storm") { petalFill = "#e8a33d"; petalLen = 40; }
    if (wrapKey === "wrap-petal") { petalFill = "#e8a8bf"; petalLen = 28; }
    var s = '<svg viewBox="0 0 320 240" role="img" aria-label="A Spark on the stall stage, wearing the goods you have tapped">';
    s += '<rect width="320" height="240" fill="#05070d"/><ellipse cx="160" cy="198" rx="110" ry="16" fill="#0d1420"/>';
    for (key in worn) if (key !== wrapKey && key !== "circlet" && key !== "veil" && key !== "scarf" && key !== "moonband") s += overlay(key);
    s += PETALS.map(function (a) { return petal(a, petalLen, petalFill, 11); }).join("");
    if (wrapKey === "wrap-spiral") s += '<path d="M138 118 a22 22 0 1 1 22 22 a15 15 0 1 0 -15 -15 a9 9 0 1 1 9 9" fill="none" stroke="#ffe9a8" stroke-width="2" opacity="0.8"/>';
    s += '<circle cx="160" cy="118" r="24" fill="#f4f1e8"/><circle cx="160" cy="118" r="15" fill="#f3c97a"/><circle cx="153" cy="111" r="3.4" fill="#05070d"/><circle cx="167" cy="111" r="3.4" fill="#05070d"/><path d="M152 126 q8 6 16 0" fill="none" stroke="#05070d" stroke-width="2.4"/>';
    for (key in worn) if (key === "circlet" || key === "veil" || key === "scarf" || key === "moonband") s += overlay(key);
    if (wrapKey) s += tag(196, 158);
    s += "</svg>";
    stageEl.innerHTML = s;
    var names = Object.keys(worn).map(function (k) { return worn[k]; });
    noteEl.textContent = names.length ? "On the Spark now: " + names.join(" · ") + ". Every bought good carries its brass tag." : "Tap “Show it on the Spark” on any wearable good and it stands here, tag and all.";
  }
  function priceLine(it) {
    if (it.rarity && it.rarity.type === "earned-only") return "Earned, never sold — no price, ever.";
    var p = it.band + " · $" + it.price + " catalogue";
    if (it.embers) p += " · or " + it.embers + " Embers";
    else p += " · no Embers price";
    return p;
  }
  function rarityLine(it) {
    var r = it.rarity || { type: "open" };
    if (r.type === "edition") return r.note;
    if (r.type === "moon-window") return r.note;
    if (r.type === "seed-variant") return r.note;
    if (r.type === "earned-only") return r.note;
    return "";
  }
  function render(data) {
    var html = "";
    data.categories.forEach(function (cat) {
      var items = data.items.filter(function (i) { return i.category === cat.id; });
      if (!items.length) return;
      html += '<div class="stall-cat"><h3>' + cat.title + '</h3><p class="spark-note">' + cat.line + "</p><ul class=\"stall-items\">";
      items.forEach(function (it) {
        html += '<li class="stall-item"><strong>' + it.name + "</strong> — " + it.sellingPoint + ".";
        html += '<br><span class="stall-price">' + priceLine(it) + "</span>";
        var rl = rarityLine(it);
        if (rl) html += '<br><span class="stall-rarity">' + rl + "</span>";
        html += '<br><span class="stall-on">' + it.onSpark + "</span>";
        if (it.stage) html += ' <button type="button" class="spark-button quiet stall-show" data-stage="' + it.stage + '" data-name="' + it.name.replace(/"/g, "&quot;") + '">Show it on the Spark</button>';
        html += "</li>";
      });
      html += "</ul></div>";
    });
    listEl.innerHTML = html;
    listEl.addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest(".stall-show") : null;
      if (!b) return;
      var k = b.getAttribute("data-stage");
      if (worn[k]) delete worn[k]; else worn[k] = b.getAttribute("data-name");
      drawStage();
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
