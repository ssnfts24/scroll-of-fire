(() => {
  "use strict";

  const KEY = "sof_equinox_passage_records_v1";

  function read() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      return [];
    }
  }

  function write(records) {
    localStorage.setItem(KEY, JSON.stringify(records));
    return records;
  }

  function save(record, note = "") {
    const canonical = record?.canonicalRecord || record;
    const liveState = record?.liveState || null;
    const records = read().filter(item => !(item.selectedYear === canonical.selectedYear && item.timeZone === canonical.timeZone && item.boundaryMode === canonical.boundaryMode));
    records.push({
      selectedYear: canonical.selectedYear,
      timeZone: canonical.timeZone,
      boundaryMode: canonical.boundaryMode,
      manualSunset: canonical.manualSunset,
      note: String(note || ""),
      savedAt: new Date().toISOString(),
      canonicalRecord: canonical,
      liveState
    });
    return write(records);
  }

  globalThis.EquinoxPassageStorage = Object.freeze({ read, write, save });
})();
