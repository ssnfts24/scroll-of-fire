/*
 * The Codex Guide — durable state behind one small interface.
 *
 * The talking rung keeps exactly three kinds of state, and nothing
 * else (visitor questions themselves are never kept — Rule 7):
 *
 *   spend:<month>     the month's meter: dollars spent, exchanges
 *                     served, answers served free from the cache.
 *   cache:<hash>      a stored answer for a repeat question, so a
 *                     common question is paid for once, not per
 *                     visitor.
 *   rate:<visitor>    recent ask timestamps for one visitor, so one
 *                     person (or one script) cannot spend the month.
 *
 * Production uses Netlify Blobs (the durable store built into the
 * site's host) with strong consistency for the meter. Tests use the
 * in-repo MemoryStore double, which implements the same interface.
 * If the durable store cannot be reached in production, the caller
 * fails closed: talking stays off rather than spending money against
 * a meter nobody can read. The store is never faked.
 */

const EMPTY_SPEND = Object.freeze({ usd: 0, exchanges: 0, cacheHits: 0 });

function spendKey(monthKey) {
  return `spend:${monthKey}`;
}

function cacheKey(hash) {
  return `cache:${hash}`;
}

function rateKey(visitorKey) {
  return `rate:${visitorKey}`;
}

function shapeSpend(value) {
  if (!value || typeof value !== "object") return { ...EMPTY_SPEND };
  return {
    usd: Number(value.usd) || 0,
    exchanges: Number(value.exchanges) || 0,
    cacheHits: Number(value.cacheHits) || 0
  };
}

/*
 * In-memory store. Used by the test suite as the interface double,
 * and nowhere in production.
 */
export class MemoryStore {
  constructor() {
    this.values = new Map();
  }

  async getSpend(monthKey) {
    return shapeSpend(this.values.get(spendKey(monthKey)));
  }

  async addSpend(monthKey, delta) {
    const next = shapeSpend(this.values.get(spendKey(monthKey)));
    next.usd += Number(delta.usd) || 0;
    next.exchanges += Number(delta.exchanges) || 0;
    next.cacheHits += Number(delta.cacheHits) || 0;
    this.values.set(spendKey(monthKey), next);
    return next;
  }

  async getCachedAnswer(hash) {
    return this.values.get(cacheKey(hash)) || null;
  }

  async putCachedAnswer(hash, entry) {
    this.values.set(cacheKey(hash), entry);
  }

  async getRateEvents(visitorKey) {
    const events = this.values.get(rateKey(visitorKey));
    return Array.isArray(events) ? [...events] : [];
  }

  async setRateEvents(visitorKey, timestamps) {
    this.values.set(rateKey(visitorKey), [...timestamps]);
  }
}

/*
 * Netlify Blobs store. Wraps a store object from @netlify/blobs
 * (anything with get(key, { type: "json" }) and setJSON(key, value)).
 */
export class NetlifyBlobsStore {
  constructor(blobs) {
    this.blobs = blobs;
  }

  async getSpend(monthKey) {
    return shapeSpend(await this.blobs.get(spendKey(monthKey), { type: "json" }));
  }

  async addSpend(monthKey, delta) {
    const next = await this.getSpend(monthKey);
    next.usd += Number(delta.usd) || 0;
    next.exchanges += Number(delta.exchanges) || 0;
    next.cacheHits += Number(delta.cacheHits) || 0;
    await this.blobs.setJSON(spendKey(monthKey), next);
    return next;
  }

  async getCachedAnswer(hash) {
    return (await this.blobs.get(cacheKey(hash), { type: "json" })) || null;
  }

  async putCachedAnswer(hash, entry) {
    await this.blobs.setJSON(cacheKey(hash), entry);
  }

  async getRateEvents(visitorKey) {
    const events = await this.blobs.get(rateKey(visitorKey), { type: "json" });
    return Array.isArray(events) ? events : [];
  }

  async setRateEvents(visitorKey, timestamps) {
    await this.blobs.setJSON(rateKey(visitorKey), timestamps);
  }
}

/*
 * Build the production store. Throws when the durable store is not
 * available (package missing, or the function is running outside
 * Netlify) — the caller treats that as "talking off", never as a
 * reason to improvise a meter.
 */
export async function createProductionStore() {
  const blobs = await import("@netlify/blobs");
  const store = blobs.getStore({ name: "codex-guide", consistency: "strong" });
  return new NetlifyBlobsStore(store);
}
