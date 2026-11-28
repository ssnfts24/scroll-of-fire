/* The Spark Stall — the goods catalogue, rendered from
   assets/data/spark-goods.json. Catalogue only: the till is not
   open, and there is no way to pay anywhere in this file.
   A storefront, not a list: every good in the catalogue stands
   on a shelf, and every good is Spark-bound — worn on the flame,
   carried at its side, left behind it as a trail, wrapped around
   its flame, or the Spark itself: its brightenings, its manners,
   and its hums, drawn as light and tone around it. The themes
   are the light the Spark stands in, and the home goods stand
   on its ground beside it. Each tile is a miniature of the
   keeper's own Spark with that good, and every tile carries a
   "Look closer" detail — what the good is, what it means, how
   it sits on other Sparks, and why it is shaped the way it is.
   The stage draws the keeper's own Spark — the same generate +
   renderSVG every other surface uses, from the record at
   sof.spark.v1 — and dresses it with the goods a keeper taps;
   only when no Spark record stands on this device does the
   stage fall back to a plain figure. Rarity is carried honestly:
   editions and their issue day, one-Moon windows, seed variants,
   and the earned-only tier marked "Earned, never sold". */
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

  /* ---- the shelves: six ways a good meets the Spark ---- */
  var SHELVES = [
    { id: "worn", title: "Worn", line: "Worn on the flame and the core." },
    { id: "carried", title: "Carried", line: "Carried at the Spark's side, on the road. The sticker sheets ride on this shelf too — a sheet is a thing a Spark can hold out." },
    { id: "wraps", title: "Flame Wraps", line: "Ways of wrapping the flame itself. A flame wears one wrap at a time." },
    { id: "trails", title: "Light Trails", line: "What the Spark leaves behind it as it moves." },
    { id: "itself", title: "The Spark Itself", line: "Its brightenings, its manners, and its hums. Nothing here is worn — the Spark is the good, so the stall draws its light and its sound around it." },
    { id: "ground", title: "Its Ground & Home", line: "The light the Spark stands in, and the pieces that stand on its ground beside it. One sky at a time; the pieces can gather." }
  ];
  function shelfOf(it) {
    if (!it || !it.stage) return null;
    if (it.form === "ground-theme" || it.form === "ground-piece") return "ground";
    if (it.form === "expression" || it.form === "sound" || it.form === "game-expression") return "itself";
    if (it.category === "worn" || it.category === "carried" || it.category === "wraps" || it.category === "trails") return it.category;
    if (it.category === "stickers") return "carried";
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
      /* The sticker sheets: a small card held out at the Spark's
         left side, its marks showing. Each set's sheet is drawn
         with its own marks — faces, glyphs, moons, the road, the
         five sparklight signs. */
      case "sheet-faces": return '<g transform="rotate(-8 107 148)"><rect x="90" y="126" width="34" height="44" rx="3" fill="#e8e2d0" stroke="#c9a24b"/><circle cx="100" cy="139" r="4.6" fill="#f3c97a"/><circle cx="114" cy="139" r="4.6" fill="#e8b7c9"/><circle cx="107" cy="153" r="4.6" fill="#7fb3c8"/><g fill="#05070d"><circle cx="98.6" cy="138" r="0.9"/><circle cx="101.4" cy="138" r="0.9"/><circle cx="112.6" cy="138" r="0.9"/><circle cx="115.4" cy="138" r="0.9"/><circle cx="105.6" cy="152" r="0.9"/><circle cx="108.4" cy="152" r="0.9"/></g><path d="M98.4 141.6 q1.6 1.6 3.2 0 M105.4 155.6 q1.6 1.6 3.2 0" fill="none" stroke="#05070d" stroke-width="0.9"/></g>' + tag(126, 170);
      case "sheet-glyphs": return '<g transform="rotate(-8 107 148)"><rect x="90" y="126" width="34" height="44" rx="3" fill="#e8e2d0" stroke="#c9a24b"/><path d="M102 140 a5 5 0 1 1 5 5 a3.4 3.4 0 1 0 -3.4 -3.4" fill="none" stroke="#7a5c1e" stroke-width="1.4"/><g stroke="#7a5c1e" stroke-width="1.6"><line x1="98" y1="156" x2="116" y2="156"/><line x1="98" y1="160" x2="104" y2="160"/><line x1="110" y1="160" x2="116" y2="160"/><line x1="98" y1="164" x2="116" y2="164"/></g><circle cx="114" cy="134" r="2.4" fill="#c9a24b"/></g>' + tag(126, 170);
      case "sheet-moons": return '<g transform="rotate(-8 107 148)"><rect x="90" y="126" width="34" height="44" rx="3" fill="#e8e2d0" stroke="#c9a24b"/><g><circle cx="98" cy="136" r="3" fill="#7a5c1e"/><circle cx="107" cy="136" r="3" fill="#a8894a"/><circle cx="116" cy="136" r="3" fill="#c9a24b"/><circle cx="98" cy="147" r="3" fill="#d9b96a"/><circle cx="107" cy="147" r="3" fill="#e8d9a8"/><circle cx="116" cy="147" r="3" fill="#f0e6c8"/><circle cx="107" cy="159" r="3.4" fill="none" stroke="#7a5c1e" stroke-width="1.2"/></g></g>' + tag(126, 170);
      case "sheet-road": return '<g transform="rotate(-8 107 148)"><rect x="90" y="126" width="34" height="44" rx="3" fill="#e8e2d0" stroke="#c9a24b"/><path d="M97 146 v-8 a10 8 0 0 1 20 0 v8" fill="none" stroke="#7a5c1e" stroke-width="1.8"/><rect x="103" y="152" width="8" height="10" rx="1.6" fill="#2a2118" stroke="#7a5c1e"/><circle cx="107" cy="157" r="2.4" fill="#ffd98a"/></g>' + tag(126, 170);
      case "sheet-sparklight": return '<g transform="rotate(-8 107 148)"><rect x="90" y="126" width="34" height="44" rx="3" fill="#131a26" stroke="#c9a24b"/><circle cx="100" cy="137" r="3.4" fill="#f3c97a"/><path d="M114 132 q3.4 4.4 0 8.4 q-3.4 -4 0 -8.4" fill="#ffb45e"/><path d="M103 152 a4.6 4.6 0 1 0 3 7.8 a3.6 3.6 0 1 1 -3 -7.8" fill="#e8e2d0"/><path d="M115 149 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4 z" fill="#ffe9a8"/><circle cx="107" cy="165" r="1.8" fill="#a8d98a"/></g>' + tag(126, 170);
      /* The expressions: the Spark's own light, behaving. Drawn
         around the body, because the Spark is the good. */
      case "expr-brighten": return '<circle cx="160" cy="118" r="34" fill="#f3c97a" opacity="0.16"/><circle cx="160" cy="118" r="30" fill="none" stroke="#f3c97a" stroke-width="1.6" opacity="0.85"/><g stroke="#f3c97a" stroke-width="2"><line x1="197" y1="118" x2="205" y2="118"/><line x1="186" y1="92" x2="192" y2="86"/><line x1="160" y1="81" x2="160" y2="73"/><line x1="134" y1="92" x2="128" y2="86"/><line x1="123" y1="118" x2="115" y2="118"/><line x1="134" y1="144" x2="128" y2="150"/><line x1="160" y1="155" x2="160" y2="163"/><line x1="186" y1="144" x2="192" y2="150"/></g>' + tag(194, 152);
      case "expr-startle": return '<circle cx="157" cy="115" r="29" fill="none" stroke="#e8e2d0" stroke-width="1.6" opacity="0.75"/><circle cx="163" cy="121" r="34" fill="none" stroke="#e8e2d0" stroke-width="1.2" opacity="0.35"/><g stroke="#e8e2d0" stroke-width="2"><line x1="146" y1="80" x2="144" y2="72"/><line x1="160" y1="78" x2="160" y2="70"/><line x1="174" y1="80" x2="176" y2="72"/></g><path d="M192 100 a12 12 0 0 1 6 10" fill="none" stroke="#e8e2d0" stroke-width="1.6" opacity="0.8"/>' + tag(194, 152);
      case "expr-celebrate": return '<circle cx="160" cy="118" r="34" fill="none" stroke="#f3c97a" stroke-width="2.2"/><g stroke="#f3c97a" stroke-width="2"><line x1="146" y1="68" x2="146" y2="60"/><line x1="160" y1="64" x2="160" y2="54"/><line x1="174" y1="68" x2="174" y2="60"/></g><path d="M126 80 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z" fill="#ffe9a8"/><path d="M194 80 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z" fill="#ffe9a8"/>' + tag(194, 152);
      case "expr-quiet": return '<circle cx="160" cy="118" r="40" fill="#b9c2cf" opacity="0.10"/><circle cx="160" cy="118" r="38" fill="none" stroke="#b9c2cf" stroke-width="1.2" opacity="0.3"/><g fill="#b9c2cf" opacity="0.65"><circle cx="114" cy="94" r="2"/><circle cx="110" cy="112" r="1.8"/><circle cx="114" cy="130" r="1.6"/></g>' + tag(194, 152);
      case "expr-game": return '<circle cx="160" cy="118" r="32" fill="none" stroke="#ffb45e" stroke-width="3"/><g stroke-width="3.4"><line x1="198" y1="118" x2="208" y2="118" stroke="#ffb45e"/><line x1="188" y1="90" x2="195" y2="83" stroke="#ff8a5e"/><line x1="160" y1="80" x2="160" y2="70" stroke="#7ad9c2"/><line x1="132" y1="90" x2="125" y2="83" stroke="#ffb45e"/><line x1="122" y1="118" x2="112" y2="118" stroke="#ff8a5e"/><line x1="132" y1="146" x2="125" y2="153" stroke="#7ad9c2"/><line x1="160" y1="156" x2="160" y2="166" stroke="#ffb45e"/><line x1="188" y1="146" x2="195" y2="153" stroke="#ff8a5e"/></g>' + tag(194, 152);
      case "expr-victory": return '<circle cx="160" cy="118" r="30" fill="#f3c97a" opacity="0.22"/><path d="M147 118 L173 118 L165 50 L155 50 Z" fill="#ffe9a8" opacity="0.32"/><circle cx="160" cy="118" r="35" fill="none" stroke="#ffe9a8" stroke-width="1.6" opacity="0.7"/><g fill="#ffe9a8"><circle cx="160" cy="88" r="2.6"/><circle cx="160" cy="72" r="2.2"/><circle cx="160" cy="58" r="1.8"/></g>' + tag(194, 152);
      /* The sound family: the hum, drawn. Sound carries no brass
         tag — the record and the settings line remember it. */
      case "sound-moon": return '<circle cx="160" cy="118" r="48" fill="none" stroke="#e8e2d0" stroke-width="1" opacity="0.18"/><g><circle cx="208" cy="118" r="2.6" fill="#e8e2d0"/><circle cx="202.5" cy="140.3" r="2.6" fill="#c9d4e8"/><circle cx="187.3" cy="157.5" r="2.6" fill="#e8e2d0"/><circle cx="165.8" cy="165.6" r="2.6" fill="#c9d4e8"/><circle cx="142.9" cy="162.9" r="2.6" fill="#e8e2d0"/><circle cx="124" cy="149.8" r="2.6" fill="#c9d4e8"/><circle cx="113.4" cy="129.5" r="2.6" fill="#e8e2d0"/><circle cx="113.4" cy="106.5" r="3.2" fill="#ffe9a8"/><circle cx="124" cy="86.2" r="2.6" fill="#c9d4e8"/><circle cx="142.9" cy="73.1" r="2.6" fill="#e8e2d0"/><circle cx="165.8" cy="70.4" r="2.6" fill="#c9d4e8"/><circle cx="187.3" cy="78.5" r="2.6" fill="#e8e2d0"/><circle cx="202.5" cy="95.7" r="2.6" fill="#c9d4e8"/></g>';
      case "sound-copper": return '<path d="M118 124 q42 44 84 0" fill="none" stroke="#d99545" stroke-width="2.4"/><path d="M110 130 q50 58 100 0" fill="none" stroke="#d99545" stroke-width="1.8" opacity="0.55"/><g fill="#d99545"><circle cx="146" cy="168" r="2.2"/><circle cx="160" cy="172" r="2.2"/><circle cx="174" cy="168" r="2.2"/></g>';
      case "sound-bell": return '<line x1="204" y1="130" x2="204" y2="138" stroke="#c9a24b" stroke-width="1.6"/><path d="M198 150 v-5 a6 6 0 0 1 12 0 v5 l2.4 4.4 h-16.8 z" fill="#c9a24b" stroke="#7a5c1e"/><circle cx="204" cy="158" r="1.8" fill="#7a5c1e"/><circle cx="217" cy="126" r="2" fill="#ffe9a8"/><line x1="217" y1="124" x2="217" y2="116" stroke="#ffe9a8" stroke-width="1.2"/>';
      case "sound-episode": return '<path d="M104 92 q56 -34 112 0" fill="none" stroke="#b9c2cf" stroke-width="1.6" opacity="0.7"/><g><line x1="133" y1="76" x2="133" y2="84" stroke="#b9c2cf"/><rect x="127" y="84" width="11" height="14" rx="2" fill="#8a97a5"/><line x1="160" y1="70" x2="160" y2="78" stroke="#b9c2cf"/><rect x="154" y="78" width="11" height="14" rx="2" fill="#c9a24b"/><line x1="187" y1="76" x2="187" y2="84" stroke="#b9c2cf"/><rect x="181" y="84" width="11" height="14" rx="2" fill="#7fb3c8"/></g>';
      case "sound-moonhum": return '<g fill="#e8c97a"><circle cx="176" cy="118" r="2.4"/><circle cx="169.3" cy="137.9" r="2.4"/><circle cx="142" cy="139.4" r="2.4"/><circle cx="127.2" cy="109.2" r="2.4"/><circle cx="153.1" cy="78.6" r="2.4"/><circle cx="197.7" cy="91.6" r="2.4"/><circle cx="205" cy="144" r="3" fill="#ffe9a8"/></g><g stroke="#e8c97a" stroke-width="1.2"><line x1="205" y1="141" x2="205" y2="132"/><line x1="176" y1="115.6" x2="176" y2="108"/></g>';
      /* The home goods: standing pieces, drawn in stage space at
         the ground line — they stand beside the Spark, not on it. */
      case "piece-bench": return '<g fill="#6b4e2e" stroke="#c9a24b" stroke-width="0.6"><rect x="220" y="150" width="5" height="44"/><rect x="283" y="150" width="5" height="44"/><rect x="216" y="152" width="76" height="6" rx="2"/><rect x="216" y="176" width="76" height="7" rx="2"/><rect x="222" y="183" width="5" height="17"/><rect x="281" y="183" width="5" height="17"/></g>' + tag(296, 180);
      case "piece-stone": return '<ellipse cx="64" cy="192" rx="30" ry="11" fill="#5a6a7d"/><ellipse cx="64" cy="188" rx="22" ry="6" fill="#71808f" opacity="0.6"/>' + tag(90, 198);
      case "piece-hammock": return '<rect x="230" y="146" width="5" height="56" fill="#6b4e2e"/><rect x="294" y="138" width="5" height="64" fill="#6b4e2e"/><path d="M232 152 q31 26 64 0 l-4 12 q-28 18 -56 0 z" fill="#3f7d8c" stroke="#c9a24b" stroke-width="0.6"/>' + tag(232, 206);
      case "piece-lamp": return '<rect x="54" y="138" width="4" height="62" fill="#2a2118" stroke="#c9a24b" stroke-width="0.5"/><circle cx="56" cy="130" r="13" fill="#ffd98a" opacity="0.25"/><rect x="46" y="122" width="20" height="16" rx="3" fill="#2a2118" stroke="#c9a24b"/><circle cx="56" cy="130" r="6" fill="#ffd98a"/>' + tag(66, 142);
      case "piece-lanterns3": return '<g><g transform="translate(100 204)"><rect x="-7" y="-12" width="14" height="18" rx="2" fill="#2a2118" stroke="#c9a24b" stroke-width="0.6"/><circle cx="0" cy="-3" r="4" fill="#ffd98a"/><circle cx="6" cy="-11" r="2.2" fill="#c9a24b"/></g><g transform="translate(160 210)"><rect x="-7" y="-12" width="14" height="18" rx="2" fill="#2a2118" stroke="#c9a24b" stroke-width="0.6"/><circle cx="0" cy="-3" r="4" fill="#ffd98a"/><circle cx="6" cy="-11" r="2.2" fill="#c9a24b"/></g><g transform="translate(220 204)"><rect x="-7" y="-12" width="14" height="18" rx="2" fill="#2a2118" stroke="#c9a24b" stroke-width="0.6"/><circle cx="0" cy="-3" r="4" fill="#ffd98a"/><circle cx="6" cy="-11" r="2.2" fill="#c9a24b"/></g></g>';
      case "piece-hearthring": return '<path d="M229 208 l5 -11 5 11 z" fill="#f3c97a"/><path d="M231.4 206 l2.6 -6 2.6 6 z" fill="#ffb45e"/><g fill="#5a6a7d"><circle cx="266" cy="206" r="4.6"/><circle cx="258.5" cy="212.4" r="4.6"/><circle cx="239.6" cy="215.8" r="4.6"/><circle cx="218" cy="214.7" r="4.6"/><circle cx="203.9" cy="209.4" r="4.6"/><circle cx="203.9" cy="202.6" r="4.6"/><circle cx="218" cy="197.3" r="4.6"/><circle cx="239.6" cy="196.2" r="4.6"/><circle cx="258.5" cy="199.6" r="4.6"/></g>' + tag(196, 206);
      case "piece-pathstones": return '<g fill="#5a6a7d" opacity="0.92"><ellipse cx="52" cy="218" rx="15" ry="5"/><ellipse cx="86" cy="216" rx="15" ry="5"/><ellipse cx="120" cy="219" rx="15" ry="5"/><ellipse cx="154" cy="217" rx="15" ry="5"/><ellipse cx="188" cy="219" rx="15" ry="5"/><ellipse cx="222" cy="216" rx="15" ry="5"/><ellipse cx="256" cy="218" rx="15" ry="5"/></g><circle cx="52" cy="218" r="2.4" fill="#c9a24b"/>';
      case "piece-gate": return '<path d="M240 124 q28 -24 56 0" fill="none" stroke="#6b4e2e" stroke-width="5"/><rect x="240" y="118" width="6" height="84" fill="#6b4e2e"/><rect x="290" y="118" width="6" height="84" fill="#6b4e2e"/><g fill="#7a5c33" opacity="0.9"><rect x="252" y="140" width="5" height="58"/><rect x="264" y="140" width="5" height="58"/><rect x="276" y="140" width="5" height="58"/></g><rect x="246" y="158" width="48" height="5" fill="#6b4e2e"/>' + tag(298, 168);
      case "piece-bridge": return '<path d="M204 198 q48 -26 96 0" fill="none" stroke="#6b4e2e" stroke-width="7"/><path d="M204 187 q48 -26 96 0" fill="none" stroke="#c9a24b" stroke-width="2"/><rect x="202" y="182" width="5" height="20" fill="#6b4e2e"/><rect x="297" y="182" width="5" height="20" fill="#6b4e2e"/>' + tag(306, 198);
      case "piece-fountain": return '<path d="M210 196 v9 a42 10 0 0 0 84 0 v-9 z" fill="#4a5866"/><ellipse cx="252" cy="196" rx="42" ry="10" fill="#5a6a7d"/><rect x="248" y="168" width="8" height="26" fill="#5a6a7d"/><ellipse cx="252" cy="166" rx="16" ry="5" fill="#71808f"/><path d="M236 178 q16 -11 32 0" fill="none" stroke="#7fb3c8" stroke-width="1.6" opacity="0.85"/><g fill="#7fb3c8"><circle cx="244" cy="186" r="1.6"/><circle cx="252" cy="189" r="1.6"/><circle cx="260" cy="186" r="1.6"/></g>' + tag(296, 190);
      case "piece-barrel": return '<path d="M42 168 h34 v32 a17 6 0 0 1 -34 0 z" fill="#6b4e2e"/><ellipse cx="59" cy="168" rx="17" ry="5" fill="#7a5c33"/><path d="M42 180 q17 5 34 0 M42 193 q17 5 34 0" fill="none" stroke="#2a2118" stroke-width="2"/><rect x="67" y="155" width="10" height="8" rx="2" fill="#8a97a5"/><line x1="72" y1="155" x2="78" y2="148" stroke="#8a97a5" stroke-width="1.6"/>' + tag(42, 178);
      case "piece-tree": return '<rect x="57" y="150" width="6" height="52" fill="#5b4632"/><g fill="#3f7d3a"><circle cx="60" cy="126" r="24"/><circle cx="39" cy="139" r="16"/><circle cx="81" cy="139" r="16"/><circle cx="60" cy="110" r="15"/></g><g fill="#f3c97a"><circle cx="48" cy="122" r="2"/><circle cx="70" cy="132" r="2"/><circle cx="60" cy="142" r="2"/></g>' + tag(74, 158);
      case "piece-pergola": return '<rect x="42" y="96" width="6" height="106" fill="#6b4e2e"/><rect x="272" y="96" width="6" height="106" fill="#6b4e2e"/><rect x="34" y="88" width="252" height="7" fill="#6b4e2e"/><rect x="34" y="100" width="252" height="4" fill="#6b4e2e" opacity="0.8"/><path d="M40 92 q20 -11 40 0 t40 0 t40 0 t40 0 t40 0 t40 0" fill="none" stroke="#3f7d3a" stroke-width="3"/><g fill="#57a047"><circle cx="70" cy="90" r="3"/><circle cx="120" cy="95" r="3"/><circle cx="170" cy="89" r="3"/><circle cx="220" cy="94" r="3"/><circle cx="262" cy="90" r="3"/></g>' + tag(280, 152);
      case "piece-threshold": return '<ellipse cx="160" cy="218" rx="34" ry="7" fill="#5a6a7d"/><path d="M154 218 a6 6 0 1 1 6 6 a4 4 0 1 0 -4 -4" fill="none" stroke="#e8e2d0" stroke-width="1.4" opacity="0.85"/><circle cx="188" cy="218" r="2.2" fill="#c9a24b"/>';
      case "piece-tokenshelf": return '<rect x="220" y="82" width="74" height="6" rx="2" fill="#6b4e2e" stroke="#c9a24b" stroke-width="0.5"/><path d="M228 88 v8 M286 88 v8" stroke="#6b4e2e" stroke-width="3"/>' + tag(298, 85);
      case "piece-humrail": return '<rect x="28" y="70" width="74" height="4" rx="2" fill="#6b4e2e"/><g fill="#c9a24b"><circle cx="42" cy="86" r="4.6"/><circle cx="60" cy="86" r="4.6"/><circle cx="78" cy="86" r="4.6"/><circle cx="94" cy="86" r="4.6"/></g><g stroke="#c9a24b" stroke-width="1.2"><line x1="42" y1="74" x2="42" y2="81"/><line x1="60" y1="74" x2="60" y2="81"/><line x1="78" y1="74" x2="78" y2="81"/><line x1="94" y1="74" x2="94" y2="81"/></g>' + tag(106, 72);
      case "piece-chronicle": return '<g><rect x="226" y="96" width="9" height="30" fill="#7a4a3a"/><rect x="237" y="100" width="8" height="26" fill="#3f5a7d"/><rect x="247" y="94" width="10" height="32" fill="#5a6a3f"/><rect x="259" y="102" width="8" height="24" fill="#6a5a7d"/><rect x="271" y="97" width="8" height="28" fill="#8a6a3a" transform="rotate(10 275 126)"/></g><rect x="220" y="126" width="74" height="6" rx="2" fill="#6b4e2e" stroke="#c9a24b" stroke-width="0.5"/>' + tag(298, 129);
      default: return "";
    }
  }
  /* The grounds: the light the Spark stands in. A theme replaces
     the stall's plain night with its own sky and ground. */
  function groundBackdrop(key) {
    switch (key) {
      case "ground-observatory": return '<rect width="320" height="240" fill="#04060f"/><g fill="#e8c97a"><circle cx="36" cy="36" r="1.6"/><circle cx="88" cy="20" r="1.2"/><circle cx="140" cy="44" r="1.4"/><circle cx="196" cy="24" r="1.2"/><circle cx="248" cy="48" r="1.6"/><circle cx="292" cy="26" r="1.3"/><circle cx="58" cy="76" r="1.2"/><circle cx="268" cy="88" r="1.2"/><circle cx="24" cy="118" r="1.3"/><circle cx="300" cy="128" r="1.4"/><circle cx="112" cy="66" r="1.1"/><circle cx="222" cy="70" r="1.1"/></g><ellipse cx="160" cy="198" rx="110" ry="16" fill="#0a1226"/>';
      case "ground-garden": return '<rect width="320" height="240" fill="#0a140d"/><circle cx="54" cy="146" r="22" fill="#f3c97a" opacity="0.18"/><circle cx="54" cy="146" r="12" fill="#f3c97a" opacity="0.9"/><ellipse cx="160" cy="198" rx="110" ry="16" fill="#152a10"/><g fill="#e8f0d8" opacity="0.75"><circle cx="96" cy="200" r="1.4"/><circle cx="138" cy="206" r="1.2"/><circle cx="186" cy="201" r="1.4"/><circle cx="228" cy="205" r="1.2"/><circle cx="70" cy="207" r="1.2"/><circle cx="256" cy="199" r="1.3"/></g>';
      case "ground-hearth": return '<rect width="320" height="240" fill="#100a06"/><circle cx="46" cy="148" r="17" fill="#ffb45e" opacity="0.22"/><circle cx="46" cy="148" r="6" fill="#ffb45e" opacity="0.85"/><circle cx="274" cy="148" r="17" fill="#ffb45e" opacity="0.22"/><circle cx="274" cy="148" r="6" fill="#ffb45e" opacity="0.85"/><ellipse cx="160" cy="198" rx="110" ry="16" fill="#1d1208"/>';
      case "ground-returnpath": return '<rect width="320" height="240" fill="#090c1e"/><circle cx="258" cy="50" r="19" fill="#e8e6da"/><circle cx="258" cy="50" r="26" fill="none" stroke="#e8e6da" stroke-width="1" opacity="0.25"/><path d="M246 96 a12 12 0 1 1 12 12 a8 8 0 1 0 -8 -8" fill="none" stroke="#e8e6da" stroke-width="1.4" opacity="0.4"/><g fill="#c9d4e8"><circle cx="40" cy="34" r="1.3"/><circle cx="104" cy="22" r="1.1"/><circle cx="168" cy="40" r="1.2"/><circle cx="66" cy="82" r="1.1"/><circle cx="300" cy="110" r="1.2"/></g><ellipse cx="160" cy="198" rx="110" ry="16" fill="#101736"/>';
      case "ground-isles": return '<rect width="320" height="240" fill="#07121c"/><polygon points="18,148 58,148 48,166 28,166" fill="#4a3826"/><polygon points="262,130 298,130 290,146 272,146" fill="#4a3826"/><g fill="#ffe9a8"><circle cx="52" cy="60" r="1.6"/><circle cx="150" cy="36" r="1.3"/><circle cx="238" cy="52" r="1.5"/><circle cx="292" cy="88" r="1.2"/><circle cx="30" cy="96" r="1.2"/></g><polygon points="84,190 236,190 206,236 114,236" fill="#5a4230"/><ellipse cx="160" cy="190" rx="78" ry="11" fill="#57a047"/><g fill="#ffe9a8"><circle cx="120" cy="188" r="1.6"/><circle cx="196" cy="191" r="1.6"/><circle cx="160" cy="186" r="1.4"/></g>';
      default: return '<rect width="320" height="240" fill="#05070d"/><ellipse cx="160" cy="198" rx="110" ry="16" fill="#0d1420"/>';
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
    var wrapItem = null, groundItem = null, body = [], field = [], front = [], pieces = [];
    wornItems.forEach(function (it) {
      var key = it.stage;
      if (!key) return;
      if (key.indexOf("wrap-") === 0) { wrapItem = it; return; }
      if (it.form === "ground-theme") { groundItem = it; return; }
      if (it.form === "ground-piece") { pieces.push(it); return; }
      if (shelfOf(it) === "trails") field.push(it);
      else if (FRONT_KEYS[key]) front.push(it);
      else body.push(it);
    });
    var wrapKey = wrapItem ? wrapItem.stage : null;
    var look = wrapKey ? WRAP_LOOK[wrapKey] : null;
    var s = '<svg viewBox="0 0 320 240" role="img" aria-label="' + label + '">';
    s += groundItem ? groundBackdrop(groundItem.stage) : '<rect width="320" height="240" fill="#05070d"/><ellipse cx="160" cy="198" rx="110" ry="16" fill="#0d1420"/>';
    field.forEach(function (it) { s += overlay(it.stage); });
    pieces.forEach(function (it) { s += overlay(it.stage); });
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
    if (it.rarity && it.rarity.type === "earned-only") return "Earned, never sold";
    var p = it.band + " · $" + it.price;
    if (it.embers) p += " · " + it.embers + " Embers";
    return p;
  }
  function tileStamp(it) {
    var r = it.rarity || {};
    if (r.type === "edition") return "First Edition · Moon " + r.issuedMoon;
    if (r.type === "moon-window") return "Issued for Moon " + r.issuedMoon + " only";
    if (r.type === "seed-variant") return "Made from your Spark's seed";
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
    listEl.querySelectorAll("[data-tile]").forEach(function (tile) {
      var on = !!wornIds[tile.getAttribute("data-tile")];
      tile.classList.toggle("on", on);
      var wear = tile.querySelector(".stall-tile-wear");
      if (wear) wear.setAttribute("aria-pressed", on ? "true" : "false");
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
      if (it.form === "ground-theme") {
        // One sky at a time: a ground stands under one theme.
        Object.keys(wornIds).forEach(function (oid) {
          if (itemsById[oid] && itemsById[oid].form === "ground-theme") delete wornIds[oid];
        });
      }
      wornIds[id] = true;
    }
    syncTiles();
    drawStage();
  }

  /* ---- the detail view: every good, looked at closely ---- */
  var detailEl = null, detailItem = null, lastDetailBtn = null;
  function buildDetail() {
    detailEl = document.createElement("div");
    detailEl.className = "stall-detail";
    detailEl.hidden = true;
    detailEl.innerHTML =
      '<div class="stall-detail-card" role="dialog" aria-modal="true" aria-labelledby="stall-detail-name">' +
      '<button type="button" class="stall-detail-close" data-close>Close</button>' +
      '<div class="stall-detail-art"></div>' +
      '<h3 id="stall-detail-name"></h3>' +
      '<p class="stall-detail-price"></p>' +
      '<h4>What it is</h4><p data-f="what"></p>' +
      '<h4>On your Spark</h4><p data-f="on"></p>' +
      '<h4>For you and your Spark</h4><p data-f="means"></p>' +
      '<h4>On other Sparks</h4><p data-f="kinds"></p>' +
      '<h4>Why it is shaped this way</h4><p data-f="design"></p>' +
      '<div data-story hidden><h4>Its story</h4><p data-f="story"></p></div>' +
      '<button type="button" class="stall-detail-toggle"></button>' +
      "</div>";
    section.appendChild(detailEl);
    detailEl.addEventListener("click", function (ev) {
      if (ev.target === detailEl || (ev.target.closest && ev.target.closest("[data-close]"))) closeDetail();
      else if (ev.target.closest && ev.target.closest(".stall-detail-toggle") && detailItem) {
        toggleItem(detailItem.id);
        syncDetailToggle();
      }
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && detailEl && !detailEl.hidden) closeDetail();
    });
  }
  function syncDetailToggle() {
    if (!detailItem) return;
    var btn = detailEl.querySelector(".stall-detail-toggle");
    var on = !!wornIds[detailItem.id];
    btn.textContent = on ? "Take it off the stage" : "Stand it on " + (keeper ? keeper.name : "the Spark");
  }
  function openDetail(id, btn) {
    var it = itemsById[id];
    if (!it || !detailEl) return;
    detailItem = it;
    lastDetailBtn = btn || null;
    detailEl.querySelector(".stall-detail-art").innerHTML = figureSVG([it], it.name + ", shown on the Spark in full");
    detailEl.querySelector("#stall-detail-name").textContent = it.name;
    detailEl.querySelector(".stall-detail-price").textContent = priceLine(it) + (it.category === "game" ? " · a SPARK! game good" : "");
    var d = it.detail || {};
    detailEl.querySelector('[data-f="what"]').textContent = d.what || it.sellingPoint;
    detailEl.querySelector('[data-f="on"]').textContent = it.onSpark;
    detailEl.querySelector('[data-f="means"]').textContent = d.means || "";
    detailEl.querySelector('[data-f="kinds"]').textContent = d.kinds || "";
    detailEl.querySelector('[data-f="design"]').textContent = d.design || "";
    var story = rarityLine(it);
    var storyWrap = detailEl.querySelector("[data-story]");
    if (story) {
      storyWrap.hidden = false;
      detailEl.querySelector('[data-f="story"]').textContent = story;
    } else {
      storyWrap.hidden = true;
    }
    syncDetailToggle();
    detailEl.hidden = false;
    var close = detailEl.querySelector(".stall-detail-close");
    if (close) close.focus();
  }
  function closeDetail() {
    if (!detailEl) return;
    detailEl.hidden = true;
    detailItem = null;
    if (lastDetailBtn) lastDetailBtn.focus();
    lastDetailBtn = null;
  }

  function render(data) {
    catalogue = data;
    itemsById = {};
    data.items.forEach(function (it) { itemsById[it.id] = it; });
    keeper = readKeeper();

    var byShelf = { worn: [], carried: [], wraps: [], trails: [], itself: [], ground: [] };
    data.items.forEach(function (it) {
      var sh = shelfOf(it);
      if (sh) byShelf[sh].push(it);
    });

    var html = '<div class="stall-tabs" role="tablist" aria-label="The stall shelves">';
    SHELVES.forEach(function (sh, i) {
      html += '<button type="button" role="tab" class="stall-tab' + (i === 0 ? " on" : "") + '" data-shelf="' + sh.id + '" aria-selected="' + (i === 0 ? "true" : "false") + '">' + sh.title + " · " + byShelf[sh.id].length + "</button>";
    });
    html += "</div>";
    SHELVES.forEach(function (sh, i) {
      html += '<div class="stall-shelf" data-shelf-panel="' + sh.id + '"' + (i === 0 ? "" : " hidden") + '><p class="spark-note stall-shelf-line">' + sh.line + '</p><div class="stall-grid">';
      byShelf[sh.id].forEach(function (it) {
        var stamp = tileStamp(it);
        html += '<div class="stall-tile" data-tile="' + it.id + '">' +
          '<button type="button" class="stall-tile-wear" data-item="' + it.id + '" aria-pressed="false">' +
          '<span class="stall-tile-art">' + figureSVG([it], it.name + ", shown on the Spark") + "</span>" +
          '<span class="stall-tile-name">' + it.name + "</span>" +
          '<span class="stall-tile-price">' + tilePrice(it) + "</span>" +
          (stamp ? '<span class="stall-tile-stamp">' + stamp + "</span>" : "") +
          (it.category === "game" ? '<span class="stall-tile-game">SPARK!</span>' : "") +
          "</button>" +
          '<button type="button" class="stall-tile-detail" data-detail="' + it.id + '">Look closer</button>' +
          "</div>";
      });
      html += "</div></div>";
    });

    listEl.innerHTML = html;
    listEl.addEventListener("click", function (ev) {
      var tab = ev.target.closest ? ev.target.closest(".stall-tab") : null;
      if (tab) { selectShelf(tab.getAttribute("data-shelf")); return; }
      var det = ev.target.closest ? ev.target.closest("[data-detail]") : null;
      if (det) { openDetail(det.getAttribute("data-detail"), det); return; }
      var tile = ev.target.closest ? ev.target.closest(".stall-tile-wear") : null;
      if (tile) toggleItem(tile.getAttribute("data-item"));
    });

    buildDetail();

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
