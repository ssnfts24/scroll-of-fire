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
    const records = read().filter(item => !(item.selectedYear === record.selectedYear && item.timeZone === record.timeZone && item.boundaryMode === record.boundaryMode));
    records.push({
      selectedYear: record.selectedYear,
      timeZone: record.timeZone,
      boundaryMode: record.boundaryMode,
      manualSunset: record.manualSunset,
      note: String(note || ""),
      savedAt: new Date().toISOString(),
      values: record
    });
    return write(records);
  }

  globalThis.EquinoxPassageStorage = Object.freeze({ read, write, save });
})();
