/*
 * The Atlas implementation of the accounts store —
 * Gate G, Phase 3 (G2; plan §2.1: Netlify Functions for
 * talking, MongoDB Atlas for accounts — the Nov 19 shape,
 * followed; store choice ASSISTANT-INFERRED as a working
 * default under the wrap ruling, pending Aaron's
 * ratification).
 *
 * The connection is read from the ENVIRONMENT, by name
 * only (ACCOUNTS-SETUP.md lists every name): the value of
 * MONGODB_URI is Aaron's, created by his hands in his own
 * Atlas account, set by his hands in this host's settings.
 * No credential passes through chat, a file, or this code,
 * and none is stored anywhere in this repo. Until the
 * environment stands, this module's factory refuses —
 * fail-closed, like every seat at this door — and the
 * function reports the accounts side as unconfigured
 * rather than pretending.
 *
 * Collections (database MONGODB_DB, default "codex-door"):
 *   accounts     {_id: accountId, email, createdAt}
 *   magic_tokens {_id: tokenHash, email, expiresAt, usedAt}
 *   sync_lines   {_id: accountId + ":" + lineId, accountId,
 *                 line} — append-only: inserts only, never
 *                 an update; account end deletes the
 *                 account's rows whole.
 *   agent_grants {_id: tokenId, accountId, grant} — the
 *                 agent door's grants (Gate G, Phase 4):
 *                 the token's HASH only, never its secret.
 *   agent_trail  {_id: lineId, accountId, line} — one line
 *                 per agent act or refusal (§4.3), append-
 *                 only like the sync lines.
 */

let clientPromise = null;

async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("accounts-store-unconfigured: MONGODB_URI is not set");
  }
  if (!clientPromise) {
    // The driver arrives with the deployment (package.json
    // names it); it is imported lazily so the rest of the
    // door — and every harness that runs the double —
    // never needs it present.
    const { MongoClient } = await import("mongodb");
    clientPromise = new MongoClient(uri, {
      maxPoolSize: 4,
      serverSelectionTimeoutMS: 4000,
    }).connect();
  }
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || "codex-door");
}

export async function createAtlasStore() {
  const db = await getDb();
  const accounts = db.collection("accounts");
  const magic = db.collection("magic_tokens");
  const lines = db.collection("sync_lines");
  const agentGrants = db.collection("agent_grants");
  const agentTrail = db.collection("agent_trail");

  return {
    kind: "atlas",

    async getAccountByEmail(email) {
      const doc = await accounts.findOne({ email });
      return doc ? { id: doc._id, email: doc.email, createdAt: doc.createdAt } : null;
    },
    async getAccountById(id) {
      const doc = await accounts.findOne({ _id: id });
      return doc ? { id: doc._id, email: doc.email, createdAt: doc.createdAt } : null;
    },
    async putAccount(account) {
      await accounts.updateOne(
        { _id: account.id },
        { $setOnInsert: { email: account.email, createdAt: account.createdAt } },
        { upsert: true });
    },
    async putMagicToken(record) {
      await magic.insertOne({
        _id: record.hash,
        email: record.email,
        expiresAt: record.expiresAt,
        usedAt: record.usedAt,
      });
    },
    async getMagicToken(hash) {
      const doc = await magic.findOne({ _id: hash });
      return doc
        ? { hash: doc._id, email: doc.email, expiresAt: doc.expiresAt, usedAt: doc.usedAt }
        : null;
    },
    async markMagicTokenUsed(hash, atMs) {
      await magic.updateOne({ _id: hash }, { $set: { usedAt: atMs } });
    },
    async hasLine(accountId, lineId) {
      const doc = await lines.findOne(
        { _id: `${accountId}:${lineId}` }, { projection: { _id: 1 } });
      return doc !== null;
    },
    async putLine(accountId, line) {
      // Append-only: insert, never update. A duplicate id
      // is the same line carried twice — not an error.
      try {
        await lines.insertOne({
          _id: `${accountId}:${line.lineId}`,
          accountId,
          line,
        });
      } catch (err) {
        if (err && err.code === 11000) return;
        throw err;
      }
    },
    async getLines(accountId) {
      const docs = await lines.find({ accountId }).toArray();
      return docs.map((d) => d.line);
    },
    /* ---- the agent door (Gate G, Phase 4) ---- */
    async putAgentGrant(grant) {
      await agentGrants.updateOne(
        { _id: grant.tokenId },
        { $setOnInsert: { accountId: grant.accountId, grant } },
        { upsert: true });
    },
    async getAgentGrant(tokenId) {
      const doc = await agentGrants.findOne({ _id: tokenId });
      return doc ? doc.grant : null;
    },
    async listAgentGrants(accountId) {
      const docs = await agentGrants.find({ accountId }).toArray();
      return docs.map((d) => d.grant);
    },
    async revokeAgentGrant(tokenId, atMs) {
      await agentGrants.updateOne(
        { _id: tokenId }, { $set: { "grant.revokedAt": atMs } });
    },
    async appendAgentLine(accountId, line) {
      try {
        await agentTrail.insertOne({
          _id: line.lineId, accountId, line });
      } catch (err) {
        if (err && err.code === 11000) return;
        throw err;
      }
    },
    async getAgentLines(accountId) {
      const docs = await agentTrail.find({ accountId }).toArray();
      return docs.map((d) => d.line);
    },
    async deleteAccountData(accountId, email) {
      const a = await accounts.deleteOne({ _id: accountId });
      const m = await magic.deleteMany({ email });
      const l = await lines.deleteMany({ accountId });
      await agentGrants.deleteMany({ accountId });
      await agentTrail.deleteMany({ accountId });
      return {
        accounts: a.deletedCount,
        magicTokens: m.deletedCount,
        lines: l.deletedCount,
      };
    },
  };
}
