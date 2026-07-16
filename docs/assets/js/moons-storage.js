(() => {
  'use strict';
  if (window.RemnantCalendarStorage) return;

  const STORAGE_KEY = 'sof-moons-logs-v20260716-r3';
  const LEGACY_KEYS = [
    'sof-moons-logs-v20260716-r2',
    'sof-moons-logs-v20260716-r1',
    'sof_moon_logs_v4',
    'sof_moon_logs_v3',
    'sof_moon_logs_v2',
    'scroll_of_fire_witness_ledger_v3',
    'scroll_of_fire_witness_ledger_v2'
  ];

  const storageAvailable = () => {
    try { const key = '__sof_storage_test__'; localStorage.setItem(key, key); localStorage.removeItem(key); return true; }
    catch { return false; }
  };
  const safeParse = value => { try { return JSON.parse(value); } catch { return null; } };

  function normalizeRecord(record = {}) {
    if (!record || typeof record !== 'object') return null;
    const text = String(record.text || record.note || record.witness || '').trim();
    const date = String(record.date || record.selectedISO || '').trim();
    if (!text || !date) return null;
    const notes = record.notes && typeof record.notes === 'object' ? record.notes : {};
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
      solarGate: String(record.solarGate || ''),
      phase: String(record.phase || ''),
      notes: {
        body: String(notes.body || '').trim(),
        emotion: String(notes.emotion || '').trim(),
        dreams: String(notes.dreams || '').trim(),
        signs: String(notes.signs || '').trim(),
        sleep: String(notes.sleep || '').trim(),
        technology: String(notes.technology || '').trim(),
        animals: String(notes.animals || '').trim(),
        weather: String(notes.weather || '').trim(),
        action: String(notes.action || '').trim(),
        lesson: String(notes.lesson || '').trim(),
        witness: String(notes.witness || '').trim(),
        field: String(notes.field || '').trim(),
        context: String(notes.context || '').trim()
      }
    };
  }

  function readRaw() {
    if (!storageAvailable()) return [];
    const current = safeParse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(current)) return current;
    for (const key of LEGACY_KEYS) {
      const legacy = safeParse(localStorage.getItem(key));
      if (Array.isArray(legacy)) return legacy;
      if (legacy && Array.isArray(legacy.logs)) return legacy.logs;
      if (legacy && Array.isArray(legacy.entries)) return legacy.entries;
    }
    return [];
  }

  const sortLogs = list => list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const readLogs = () => sortLogs(readRaw().map(normalizeRecord).filter(Boolean));

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
    const now = new Date().toISOString();
    const nextRecord = normalizeRecord({ ...record, updatedAt:now, createdAt:record.createdAt || now });
    if (!nextRecord) return { ok:false, reason:'invalid-record' };
    const logs = readLogs().filter(item => item.id !== nextRecord.id);
    logs.unshift(nextRecord);
    return { ok:writeLogs(logs), record:nextRecord, logs:readLogs() };
  }

  const deleteLog = id => { const logs = readLogs().filter(record => record.id !== id); return { ok:writeLogs(logs), logs:readLogs() }; };
  const clearAll = () => { if (!storageAvailable()) return { ok:false, logs:[] }; try { localStorage.removeItem(STORAGE_KEY); return { ok:true, logs:[] }; } catch { return { ok:false, logs:readLogs() }; } };
  const exportLogs = () => JSON.stringify(readLogs(), null, 2);

  function importLogs(payload, options = {}) {
    const parsed = typeof payload === 'string' ? safeParse(payload) : payload;
    const incoming = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.logs) ? parsed.logs : null);
    if (!incoming) return { ok:false, reason:'invalid-json', logs:readLogs() };
    const normalized = incoming.map(normalizeRecord).filter(Boolean);
    if (!normalized.length) return { ok:false, reason:'empty', logs:readLogs() };
    let merged;
    if (options.replace) {
      merged = normalized;
    } else {
      const byId = new Map();
      readLogs().forEach(record => byId.set(record.id, record));
      normalized.forEach(record => {
        const prior = byId.get(record.id);
        if (!prior || new Date(record.updatedAt).getTime() >= new Date(prior.updatedAt).getTime()) byId.set(record.id, record);
      });
      merged = Array.from(byId.values());
    }
    const ok = writeLogs(sortLogs(merged));
    return { ok, added:normalized.length, logs:readLogs() };
  }

  function formatRecord(record) {
    const normalized = normalizeRecord(record);
    if (!normalized) return '';
    const notes = normalized.notes || {};
    const lines = [
      `☲ ${normalized.date}${normalized.effectiveISO && normalized.effectiveISO !== normalized.date ? ` · effective ${normalized.effectiveISO}` : ''}`,
      normalized.moonName ? `Moon: ${normalized.moonName}${normalized.moonDay ? ` · day ${normalized.moonDay}` : ''}` : '',
      normalized.mirrorTitle ? `Mirror: ${normalized.mirrorTitle}` : '',
      normalized.shabbat ? `Shabbat: ${normalized.shabbat}` : '',
      normalized.solarGate ? `Solar gate: ${normalized.solarGate}` : '',
      normalized.phase ? `Visible moon: ${normalized.phase}` : '',
      normalized.tags.length ? `Tags: ${normalized.tags.join(', ')}` : '',
      '',
      normalized.text,
      notes.body ? `Body: ${notes.body}` : '',
      notes.emotion ? `Emotion: ${notes.emotion}` : '',
      notes.dreams ? `Dreams: ${notes.dreams}` : '',
      notes.signs ? `Signs: ${notes.signs}` : '',
      notes.sleep ? `Sleep: ${notes.sleep}` : '',
      notes.technology ? `Technology: ${notes.technology}` : '',
      notes.animals ? `Animals: ${notes.animals}` : '',
      notes.weather ? `Weather: ${notes.weather}` : '',
      notes.action ? `Action: ${notes.action}` : '',
      notes.lesson ? `Lesson: ${notes.lesson}` : '',
      notes.witness ? `Witness: ${notes.witness}` : '',
      notes.field ? `Field: ${notes.field}` : '',
      notes.context ? `Context: ${notes.context}` : ''
    ];
    return lines.filter(line => line !== '').join('\n').replace(/\n{3,}/g, '\n\n');
  }

  const formatAll = () => readLogs().map(formatRecord).filter(Boolean).join('\n\n— — —\n\n');

  window.RemnantCalendarStorage = {
    STORAGE_KEY,
    LEGACY_KEYS,
    available: storageAvailable,
    normalizeRecord,
    readLogs,
    writeLogs,
    migrateLegacy,
    saveLog,
    deleteLog,
    clearAll,
    exportLogs,
    importLogs,
    formatRecord,
    formatAll
  };
})();
