/*
 * The website's half of the accounts door — Gate G,
 * Phase 3 (G2; gate-g-live-plan-2026-11-24 §2).
 *
 * Sign in once, either side: this client and the app's
 * AccountClient speak to the one accounts function
 * (/.netlify/functions/accounts) in the same envelope
 * shapes, and the website's sync speaks the ONE format —
 * the bundle payload's lines — through the same conflict
 * law the app's SyncEngine implements (the law itself
 * lives server-side in netlify/functions/lib/
 * accounts-core.mjs, imported by the door; this page-side
 * client carries lines, it does not re-decide merges:
 * a merge the website needs is computed by the door's
 * core over the same canonical form, so the surfaces
 * cannot drift into two laws).
 *
 * What this client holds: the session, in this origin's
 * local storage beside the keeper's other site state —
 * device state on this surface, never the record, and
 * never the Spark's identity (seed-derived, held by the
 * Spark's own store; signing out here drops the session
 * and nothing else, §2.2).
 *
 * Children: this client is an adult keeper's door. The
 * sign-in request carries the keeper's adult
 * confirmation or the door refuses it, and no surface
 * offers this client in a child's name (§2.2, §9).
 */
(function (global) {
  "use strict";

  var DOOR = "/.netlify/functions/accounts";
  var SESSION_KEY = "sof.account.session.v1";
  var EMAIL_KEY = "sof.account.email.v1";

  function storage() {
    try {
      return global.localStorage || null;
    } catch (e) {
      return null;
    }
  }

  function session() {
    var s = storage();
    return s ? s.getItem(SESSION_KEY) : null;
  }

  function email() {
    var s = storage();
    return s ? s.getItem(EMAIL_KEY) : null;
  }

  function call(body) {
    return fetch(DOOR, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().then(function (data) {
        return { status: res.status, data: data };
      });
    });
  }

  /* Asks the door to mail a magic link. adultConfirmed is
   * the keeper's own confirmation, asked by the surface
   * that calls this — the door refuses without it. */
  function requestLink(emailAddress, adultConfirmed) {
    return call({
      action: "request-link",
      email: emailAddress,
      adultConfirmed: adultConfirmed === true,
    });
  }

  /* Exchanges the link's token (the ?signin= parameter
   * the link carries) for the session both surfaces
   * accept. */
  function verify(token) {
    return call({ action: "verify", token: token }).then(function (r) {
      if (r.data && r.data.ok && r.data.session) {
        var s = storage();
        if (s) {
          s.setItem(SESSION_KEY, r.data.session);
          s.setItem(EMAIL_KEY, r.data.email || "");
        }
      }
      return r;
    });
  }

  function signOut() {
    var s = storage();
    if (s) {
      s.removeItem(SESSION_KEY);
      s.removeItem(EMAIL_KEY);
    }
  }

  function pull() {
    return call({ action: "pull", session: session() });
  }

  function push(lines) {
    return call({ action: "push", session: session(), lines: lines });
  }

  /* The named keeper act (§2.4): true deletion of the
   * door's copy. The record on this surface is untouched
   * — it was never the door's to touch. */
  function endAccount() {
    return call({ action: "end-account", session: session() }).then(function (r) {
      if (r.data && r.data.ok) signOut();
      return r;
    });
  }

  global.SparkAccount = {
    requestLink: requestLink,
    verify: verify,
    signOut: signOut,
    pull: pull,
    push: push,
    endAccount: endAccount,
    session: session,
    email: email,
    DOOR: DOOR,
  };
})(typeof window !== "undefined" ? window : globalThis);
