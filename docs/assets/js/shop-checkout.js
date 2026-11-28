/* The shop till's page side — one-PR redesign,
 * Nov 24, 2026.
 *
 * Reads the shop function's standing (GET
 * /.netlify/functions/shop) and, ONLY when charging
 * stands — the whole road: the key and the shop's own
 * webhook secret (payments sweep, Nov 27, 2026) — and
 * a standard piece stands sellable in the shelf's own
 * record, reveals that piece's buy button. While the till is
 * dark — Stripe not yet connected — the buttons stay
 * hidden, the standing line says so in plain words,
 * and the standing road — email to confirm,
 * Cash App to pay — stands untouched below.
 *
 * A buy click creates a Checkout session through the
 * function and sends the keeper to Stripe's hosted
 * page (card or Cash App Pay). Sizing and finish are
 * still confirmed by email before the forge — the
 * shop's standing steps, unchanged. If the function
 * cannot be reached at all (a mirror of the site, a
 * network failure), the page simply stays as it
 * stands: dark till, email road open.
 */
(function () {
  "use strict";
  var standing = document.getElementById("shop-till-standing");
  var buttons = Array.prototype.slice.call(
    document.querySelectorAll("[data-shop-item]"));
  if (!standing && !buttons.length) return;

  var DARK_WORDS = "Checkout by card and Cash App Pay opens here " +
    "the moment Stripe is connected. Until then, ordering runs " +
    "the shop's standing road — email to confirm, Cash App to " +
    "pay — exactly as below.";

  function say(words) { if (standing) standing.textContent = words; }

  var params = new URLSearchParams(window.location.search);
  if (params.get("order") === "placed") {
    say("Payment received — thank you. Watch your email: sizing " +
      "and finish are confirmed with you before the forge, and " +
      "your piece is then made by hand.");
    return;
  }
  if (params.get("order") === "cancelled") {
    say("Checkout was left unfinished — nothing was charged. " +
      "Order by the standing road below whenever you are ready.");
    return;
  }

  var tiersStanding = document.getElementById("tiers-standing");
  if (tiersStanding) {
    fetch("/.netlify/functions/stripe", { headers: { accept: "application/json" } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (status) {
        if (status && status.ok && status.charging) {
          tiersStanding.textContent = "Stripe is connected. " +
            "Joining opens at the door — sign in on the account " +
            "page, and the tiers stand there.";
        }
      })
      .catch(function () { /* the printed standing stands */ });
  }

  fetch("/.netlify/functions/shop", { headers: { accept: "application/json" } })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (status) {
      if (!status || !status.ok) { say(DARK_WORDS); return; }
      if (!status.charging) { say(status.words || DARK_WORDS); return; }
      var anyLive = false;
      buttons.forEach(function (button) {
        var item = status.items[button.getAttribute("data-shop-item")];
        if (item && item.sellable) {
          button.hidden = false;
          anyLive = true;
          button.addEventListener("click", function () {
            button.disabled = true;
            say("Opening secure checkout…");
            fetch("/.netlify/functions/shop", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                action: "checkout",
                item: button.getAttribute("data-shop-item"),
                successUrl: window.location.origin + "/shop.html?order=placed",
                cancelUrl: window.location.origin + "/shop.html?order=cancelled",
              }),
            }).then(function (res) { return res.json(); })
              .then(function (session) {
                if (session && session.ok && session.url) {
                  window.location.assign(session.url);
                } else {
                  button.disabled = false;
                  say((session && session.words) ||
                    "Checkout could not open. Nothing was charged — " +
                    "the standing road below stands.");
                }
              })
              .catch(function () {
                button.disabled = false;
                say("Checkout could not be reached. Nothing was " +
                  "charged — the standing road below stands.");
              });
          });
        }
      });
      say(anyLive
        ? "Checkout is open for the standard pieces below — card " +
          "or Cash App Pay. Sizing and finish are still confirmed " +
          "by email before the forge."
        : DARK_WORDS);
    })
    .catch(function () { say(DARK_WORDS); });
})();
