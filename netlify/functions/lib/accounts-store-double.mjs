/*
 * The TEST DOUBLE for the accounts store — Gate G,
 * Phase 3 (G2).
 *
 * An in-process, in-memory implementation of the exact
 * store interface the Atlas implementation speaks
 * (accounts-store-atlas.mjs). It exists so the phase's
 * proofs can run end to end — sign-in, push, pull, merge,
 * account end with true deletion — without Aaron's Atlas
 * account, which only his hands may create (§2.1).
 *
 * Every proof that ran against this double is labelled
 * DOUBLE-PROVEN in the phase evidence. The live-Atlas
 * proof stays OWED until Aaron creates the account and
 * sets the environment (ACCOUNTS-SETUP.md). This double
 * is never the production store: the function selects it
 * only when ACCOUNTS_STORE=double, which the deployment
 * checklist forbids in production.
 */

export function createDoubleStore() {
  const accounts = new Map(); // id -> account
  const byEmail = new Map(); // email -> account
  const magic = new Map(); // hash -> token record
  const lines = new Map(); // accountId -> Map(lineId -> line)
  const agentGrants = new Map(); // tokenId -> grant
  const agentTrail = new Map(); // accountId -> [line]

  return {
    kind: "double",

    async getAccountByEmail(email) {
      return byEmail.get(email) || null;
    },
    async getAccountById(id) {
      return accounts.get(id) || null;
    },
    async putAccount(account) {
      accounts.set(account.id, account);
      byEmail.set(account.email, account);
    },
    async putMagicToken(record) {
      magic.set(record.hash, { ...record });
    },
    async getMagicToken(hash) {
      return magic.get(hash) || null;
    },
    async markMagicTokenUsed(hash, atMs) {
      const record = magic.get(hash);
      if (record) record.usedAt = atMs;
    },
    async hasLine(accountId, lineId) {
      return lines.get(accountId)?.has(lineId) || false;
    },
    async putLine(accountId, line) {
      if (!lines.has(accountId)) lines.set(accountId, new Map());
      lines.get(accountId).set(line.lineId, line);
    },
    async getLines(accountId) {
      const held = lines.get(accountId);
      return held ? [...held.values()] : [];
    },
    /* True deletion: every row this account ever made. */
    async deleteAccountData(accountId, email) {
      const account = accounts.get(accountId);
      let magicCount = 0;
      for (const [hash, record] of magic) {
        if (record.email === email) {
          magic.delete(hash);
          magicCount++;
        }
      }
      const lineCount = lines.get(accountId)?.size || 0;
      lines.delete(accountId);
      for (const [tokenId, grant] of agentGrants) {
        if (grant.accountId === accountId) agentGrants.delete(tokenId);
      }
      agentTrail.delete(accountId);
      if (account) {
        accounts.delete(accountId);
        byEmail.delete(account.email);
      }
      return { accounts: account ? 1 : 0, magicTokens: magicCount, lines: lineCount };
    },
    /* ---- the agent door (Gate G, Phase 4) ---- */
    async putAgentGrant(grant) {
      agentGrants.set(grant.tokenId, { ...grant });
    },
    async getAgentGrant(tokenId) {
      const grant = agentGrants.get(tokenId);
      return grant ? { ...grant } : null;
    },
    async listAgentGrants(accountId) {
      return [...agentGrants.values()]
        .filter((g) => g.accountId === accountId)
        .map((g) => ({ ...g }));
    },
    async revokeAgentGrant(tokenId, atMs) {
      const grant = agentGrants.get(tokenId);
      if (grant) grant.revokedAt = atMs;
    },
    async appendAgentLine(accountId, line) {
      if (!agentTrail.has(accountId)) agentTrail.set(accountId, []);
      agentTrail.get(accountId).push({ ...line });
    },
    async getAgentLines(accountId) {
      return (agentTrail.get(accountId) || []).map((l) => ({ ...l }));
    },
    /* Test-only introspection: total rows held, so a
     * deletion proof can count what remains (zero). */
    async countAll() {
      let lineCount = 0;
      for (const held of lines.values()) lineCount += held.size;
      return {
        accounts: accounts.size,
        magicTokens: magic.size,
        lines: lineCount,
      };
    },
  };
}
