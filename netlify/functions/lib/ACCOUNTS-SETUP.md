# Accounts side of the door — deployment checklist (Gate G, Phase 3 / G2)

*For Aaron's hands only. Every step below is his: no credential
passes through chat, a file, or Witness's hands (plan §2.1). This
sheet names WHAT to create, IN WHAT ORDER, and WHICH ENVIRONMENT
VARIABLE NAMES the functions expect. It contains no values, and
no value is ever to be written into this repo.*

## What Aaron creates, in this order

1. **A MongoDB Atlas account**, in his own name, at mongodb.com
   (the sync store — working default under the wrap ruling,
   ASSISTANT-INFERRED, plan §8 call 3; he may rule otherwise and
   this sheet is then replaced, not edited around).
2. **A cluster** in that account — the free tier is the honest
   starting size for sync hosting (plan §3.4's shape: small per
   keeper per month, growing with keeper count).
3. **A database user** for the door alone (not his Atlas admin):
   username and password he generates in Atlas's own screens,
   with read/write on the one database only.
4. **A network access entry** allowing the door's host
   (Netlify Functions) to reach the cluster. Netlify's egress
   addresses vary; Atlas's "allow from anywhere" entry is the
   shape that works with serverless egress, and the database
   user's password is then the real fence — which is why step 3
   uses a door-only user with a strong generated password.
5. **The connection string** Atlas offers for that user
   ("Connect → Drivers"), kept in his own password keeping —
   never pasted into chat or any file in any repo.

## Environment variables the functions expect (NAMES ONLY)

Set in the Netlify site's environment settings, by Aaron:

| Name | What it is | Required |
|---|---|---|
| `MONGODB_URI` | The step-5 connection string, with the step-3 user's password in it | Yes — the accounts side fails closed without it |
| `MONGODB_DB` | The database name (the code's default is `codex-door` if unset) | No |
| `ACCOUNTS_SESSION_SECRET` | A long random string Aaron generates (e.g. in his password manager); it signs sign-in sessions. Rotating it signs everyone out, nothing more | Yes |
| `ACCOUNTS_EMAIL_WEBHOOK` | The HTTPS endpoint of Aaron's mailer, which receives `{email, link, purpose}` and sends the magic link | Yes, for real sign-in mail |
| `SITE_URL` | The site's own origin, for building the link (default `https://codexofreality.org`) | No |

**Forbidden in production, in these words:**
`ACCOUNTS_DEV_EXPOSE_TOKEN` must never be set on the production
site (it returns a magic token in the request-link response —
for Aaron's own disposable test deployments only), and
`ACCOUNTS_STORE` must never be set to `double` in production
(the double is the in-process test store; it holds nothing
durably and exists for proofs).

## The agent door rides this same store (Gate G, Phase 4)

The agent seat (`/.netlify/functions/agent`) reads the SAME
environment and the SAME store as the accounts seat — no new
account, no new credential, nothing further for Aaron's hands.
Its collections (`agent_grants`, `agent_trail`) are created by
the door itself on first use. Until the environment above
stands, the agent seat also answers "unconfigured" and does
nothing, and the live leg of the Phase 4 proofs stays OWED with
the accounts leg. Grants hold token HASHES only: a token's
secret is shown once, in the app, at granting, and is carried
by the keeper to the agent — it is never set here, never
stored here, and never passes through chat or any file.

## What unlocks when it is done

- The accounts function (`/.netlify/functions/accounts`) stops
  answering "unconfigured" and starts linking surfaces: sign in
  once on the website or in the app (v0.8.0), the same session
  accepted on both.
- Sync begins carrying the record's lines between a keeper's
  surfaces, in Aaron's order (Genesis, day, memory, standing).
- The phase's one OWED proof — the live-Atlas leg of the
  travel proof — can be run and the evidence sheet amended.
- Nothing publishes, and no keeper-facing launch happens:
  the publishing hold stands until Aaron lifts it on a walked
  candidate, exactly as before.
