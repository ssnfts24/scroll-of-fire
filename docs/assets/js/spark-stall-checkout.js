/* The Spark Stall's till, page side — Nov 27, 2026.
 *
 * The stall's printed standing says the till is not
 * open, and while that is true this script does
 * NOTHING: it draws no button, changes no word, and
 * the page stands exactly as it stands without it.
 * The till lights only when the stall's own function
 * (/.netlify/functions/stall) reports charging
 * connected — Aaron's Stripe, connected by his own
 * pastes — and only then does this script:
 *
 *   - correct the printed standing to say the till
 *     is open (a page must not claim dark when lit);
 *   - stand a buy button in its till bar for the
 *     good the keeper last tapped onto the stage —
 *     priced goods only; earned goods are refused
 *     here in words, as the catalogue's fence says,
 *     and the server refuses them again in law;
 *   - send the keeper to Stripe's hosted checkout
 *     with the Spark's passport code riding along,
 *     when the keeper's own record offers one, so
 *     the fulfilled order knows whose Spark the
 *     good dresses;
 *   - on the return from a placed order, read the
 *     recorded order back from the function and
 *     write the good's provenance onto this device,
 *     in the catalogue's lineage shape — the brass
 *     tag, obtained "purchased", hash-chained to the
 *     entries before it, kept in this script's own
 *     shelf (sof.spark.goods.v1), never inside the
 *     Spark's own record, which no shop code touches.
 *
 * If the function cannot be reached at all (a mirror
 * of the site, a network failure), the page simply
 * stays as it stands: dark till, catalogue whole.
 */
(function () {
  "use strict";
  var section = document.getElementById("spark-stall");
  if (!section) return;
  var listEl = document.getElementById("stall-list");
  var tillPrinted = section.querySelector(".stall-till");

  var GOODS_SHELF_KEY = "sof.spark.goods.v1";
  var params = new URLSearchParams(window.location.search);

  var bar = document.createElement("div");
  bar.className = "stall-till-bar";
  bar.setAttribute("role", "status");
  bar.setAttribute("aria-live", "polite");
  bar.style.display = "none";
  bar.style.margin = "0.75rem 0";
  if (tillPrinted && tillPrinted.parentNode === section) {
    section.insertBefore(bar, tillPrinted.nextSibling);
  } else {
    section.appendChild(bar);
  }

  function say(html) {
    bar.innerHTML = html;
    bar.style.display = html ? "" : "none";
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---- the keeper's passport, when a record offers one ---- */
  function keeperPassport() {
    try {
      var Core = window.SparkCompanion;
      if (!Core || !Core.passportCodeFor) return "";
      var raw = window.localStorage.getItem(Core.STORAGE_KEY || "sof.spark.v1");
      if (!raw) return "";
      return Core.passportCodeFor(JSON.parse(raw)) || "";
    } catch (e) { return ""; }
  }

  /* ---- the provenance shelf: the catalogue's lineage shape ---- */
  function checksum(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return ("0000000" + h.toString(36)).slice(-7);
  }
  function readShelf() {
    try {
      var raw = window.localStorage.getItem(GOODS_SHELF_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }
  function todayPattern() {
    try {
      var conv = window.PatternCalendar
        && window.PatternCalendar.fromCivilDate(new Date());
      if (conv && typeof conv.dayOfPatternYear === "number") {
        return { moon: conv.moon || null, patternDay: conv.dayOfPatternYear };
      }
    } catch (e) { /* the date is a stamp, never a gate */ }
    return { moon: null, patternDay: null };
  }
  function writeProvenance(order, row) {
    var shelf = readShelf();
    var when = todayPattern();
    var rarity = (row && row.rarity) || {};
    var prev = shelf.length ? String(shelf[shelf.length - 1].chainHash || "") : "";
    var hash = checksum(prev + "|" + order.item + "|" +
      (order.sessionId || "") + "|" + (when.patternDay || ""));
    for (var i = 0; i < shelf.length; i++) {
      if (shelf[i].chainHash === hash) return shelf[i];
    }
    var entry = {
      itemId: order.item,
      edition: rarity.edition || "",
      issuedMoon: typeof rarity.issuedMoon === "number" ? rarity.issuedMoon : null,
      issuedPatternDay: typeof rarity.issuedPatternDay === "number" ? rarity.issuedPatternDay : null,
      obtained: "purchased",
      obtainedPatternDay: when.patternDay,
      fromWhom: "The Spark Stall — Stripe checkout",
      chainHash: hash,
    };
    shelf.push(entry);
    try { window.localStorage.setItem(GOODS_SHELF_KEY, JSON.stringify(shelf)); }
    catch (e) { /* a full shelf never blocks the thanks */ }
    return entry;
  }

  /* ---- the return from checkout ---- */
  var catalogueById = {};
  function withCatalogue(fn) {
    fetch("assets/data/spark-goods.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        (data.items || []).forEach(function (it) { catalogueById[it.id] = it; });
        fn();
      })
      .catch(function () { fn(); });
  }

  if (params.get("order") === "cancelled") {
    say("<strong>Checkout was left unfinished</strong> — nothing was " +
      "charged. The catalogue stands as it was, whenever you are ready.");
    return;
  }
  if (params.get("order") === "placed" && params.get("session_id")) {
    var sessionId = params.get("session_id");
    say("Recording your purchase…");
    fetch("/.netlify/functions/stall", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "fulfilment", sessionId: sessionId }),
    }).then(function (res) { return res.ok ? res.json() : null; })
      .then(function (out) {
        if (out && out.ok && out.order) {
          withCatalogue(function () {
            writeProvenance(out.order, catalogueById[out.order.item]);
            say("<strong>Paid and recorded — thank you.</strong> " +
              esc(out.order.name || "Your good") + " is yours: its brass " +
              "tag is written in your goods record on this device, " +
              "marked purchased, forever.");
          });
        } else {
          say("Your payment is being recorded. If you re-open this page " +
            "in a moment, the good will be written into your record " +
            "then — nothing is lost, and nothing was charged twice.");
        }
      })
      .catch(function () {
        say("Your payment went through, but this page could not reach " +
          "the record just now. Re-open the page in a moment and the " +
          "good will be written into your record then.");
      });
    return;
  }

  /* ---- the standing probe: dark means invisible ---- */
  fetch("/.netlify/functions/stall", { headers: { accept: "application/json" } })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (status) {
      if (!status || !status.ok || !status.charging) return;
      if (tillPrinted) {
        tillPrinted.innerHTML = "<strong>The till is open.</strong> " +
          "Tap a good on a shelf to stand it on your Spark; when you " +
          "want it for keeps, buy it from the till bar below — card or " +
          "Cash App Pay, on Stripe's own page. Adults buy; nothing is " +
          "sold to a child. Earned goods are never sold, at any price.";
      }
      withCatalogue(function () { standBar(); });
    })
    .catch(function () { /* the printed standing stands */ });

  var selectedId = null;
  if (listEl) {
    listEl.addEventListener("click", function (ev) {
      var t = ev.target && ev.target.closest
        ? ev.target.closest("[data-item]") : null;
      if (t) { selectedId = t.getAttribute("data-item"); standBar(); }
    });
  }

  function standBar() {
    var row = selectedId ? catalogueById[selectedId] : null;
    if (!row) {
      say("<strong>The till is open.</strong> Tap a good on a shelf " +
        "to stand it on your Spark — its buy button will stand here.");
      return;
    }
    if (row.rarity && row.rarity.type === "earned-only") {
      say("<strong>" + esc(row.name) + "</strong> is earned, never " +
        "sold — it carries no price, ever. It comes by living the days.");
      return;
    }
    if (typeof row.price !== "number" || !(row.price > 0)) {
      say("<strong>" + esc(row.name) + "</strong> carries no price in " +
        "the catalogue, so the till cannot sell it.");
      return;
    }
    bar.innerHTML = "";
    var label = document.createElement("span");
    label.innerHTML = "<strong>" + esc(row.name) + "</strong> — $" +
      row.price + ". Yours for keeps, written purchased on this device. ";
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = "Buy — $" + row.price;
    button.addEventListener("click", function () {
      button.disabled = true;
      label.innerHTML = "Opening secure checkout…";
      fetch("/.netlify/functions/stall", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          item: row.id,
          passport: keeperPassport(),
          successUrl: window.location.origin +
            "/companions.html?order=placed&session_id={CHECKOUT_SESSION_ID}",
          cancelUrl: window.location.origin +
            "/companions.html?order=cancelled",
        }),
      }).then(function (res) { return res.json(); })
        .then(function (session) {
          if (session && session.ok && session.url) {
            window.location.assign(session.url);
          } else {
            button.disabled = false;
            label.innerHTML = (session && session.words) ||
              "Checkout could not open. Nothing was charged.";
          }
        })
        .catch(function () {
          button.disabled = false;
          label.innerHTML = "Checkout could not be reached. " +
            "Nothing was charged.";
        });
    });
    bar.appendChild(label);
    bar.appendChild(button);
    bar.style.display = "";
  }
})();
