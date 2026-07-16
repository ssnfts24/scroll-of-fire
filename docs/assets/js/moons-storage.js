(() => {
  'use strict';
  if (window.RemnantCalendarStorage) return;

  const STORAGE_KEY = 'sof-moons-logs-v20260716-r1';
  const LEGACY_KEYS = ['sof_moon_logs_v4', 'sof_moon_logs_v3', 'sof_moon_logs_v2'];

  const storageAvailable = () => {
    try { const key = '__sof_storage_test__'; localStorage.setItem(key, key); localStorage.removeItem(key); return true; }
    catch { return false; }
  };
  const safeParse = value => { try { return JSON.parse(value); } catch { return null; } };

  function normalizeRecord(record = {}) {
    if (!record || typeof record !== 'object') return null;
    const text = String(record.text || record.note || '').trim();
    const date = String(record.date || record.selectedISO || '').trim();
    if (!text || !date) return null;
    return {
      id: String(record.id || `${date}-${Math.random().toString(36).slice(2, 10)}`),
      date,
      effectiveISO: String(record.effectiveISO || date),
      moonName: String(record.moonName || ''),
      moonDay: Number.isFinite(Number(record.moonDay)) ? Number(record.moonDay) : null,
      tags: Array.isArray(record.tags) ? record.tags.map(tag => String(tag).trim()).filter(Boolean) : String(record.tags || '').split(',').map(tag => tag.trim()).filter(Boolean),
      text,
      createdAt: String(record.createdAt || record.saved || new Date().toISOString()),
      updatedAt: String(record.updatedAt || record.saved || new Date().toISOString()),
      yearDay: Number.isFinite(Number(record.yearDay)) ? Number(record.yearDay) : null,
      shabbat: String(record.shabbat || ''),
      mirrorTitle: String(record.mirrorTitle || ''),
      sunset: String(record.sunset || ''),
      timeZone: String(record.timeZone || record.timezone || ''),
      notes: typeof record.notes === 'object' && record.notes ? record.notes : {}
    };
  }

  function readRaw() {
    if (!storageAvailable()) return [];
    const current = safeParse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(current)) return current;
    for (const key of LEGACY_KEYS) {
      const legacy = safeParse(localStorage.getItem(key));
      if (Array.isArray(legacy)) return legacy;
    }
    return [];
  }

  const readLogs = () => readRaw().map(normalizeRecord).filter(Boolean).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  function writeLogs(records) {
    if (!storageAvailable()) return false;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records.map(normalizeRecord).filter(Boolean))); return true; }
    catch { return false; }
  }

  function migrateLegacy() {
    if (!storageAvailable()) return { migrated:false, logs:[] };
    const existing = safeParse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(existing)) return { migrated:false, logs:readLogs() };
    const legacy = readLogs();
    if (!legacy.length) return { migrated:false, logs:[] };
    writeLogs(legacy);
    return { migrated:true, logs:legacy };
  }

  function saveLog(record) {
    const nextRecord = normalizeRecord({ ...record, updatedAt:new Date().toISOString(), createdAt:record.createdAt || new Date().toISOString() });
    if (!nextRecord) return { ok:false, reason:'invalid-record' };
    const logs = readLogs().filter(item => item.id !== nextRecord.id);
    logs.unshift(nextRecord);
    return { ok:writeLogs(logs), record:nextRecord, logs:readLogs() };
  }

  const deleteLog = id => { const logs = readLogs().filter(record => record.id !== id); return { ok:writeLogs(logs), logs:readLogs() }; };
  const exportLogs = () => JSON.stringify(readLogs(), null, 2);

  window.RemnantCalendarStorage = { STORAGE_KEY, LEGACY_KEYS, available:storageAvailable, normalizeRecord, readLogs, writeLogs, migrateLegacy, saveLog, deleteLog, exportLogs };
})();
