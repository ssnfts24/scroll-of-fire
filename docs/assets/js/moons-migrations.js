(() => {
  "use strict";

  const { DATA_SCHEMA_VERSION } = window.SOF_13_MOONS;
  const SCHEMA_KEY = "sof_moons_data_schema";
  const BACKUP_KEY = "sof_moons_migration_backup";
  const SUCCESS_KEY = "sof_moons_migration_success";
  const owned = key => /^(sof_moon_|sof_moons_)/.test(key) && ![
    SCHEMA_KEY,
    BACKUP_KEY,
    SUCCESS_KEY
  ].includes(key);

  function snapshot() {
    const records = {};
    try {
      Object.keys(localStorage).filter(owned).forEach(key => {
        records[key] = localStorage.getItem(key);
      });
    } catch {}
    return records;
  }

  function migrate() {
    let oldVersion = 0;
    try {
      oldVersion = Number(localStorage.getItem(SCHEMA_KEY) || 0);
      if (oldVersion >= DATA_SCHEMA_VERSION) return { migrated: false, oldVersion };
      const before = snapshot();
      localStorage.setItem(BACKUP_KEY, JSON.stringify({
        schemaVersion: oldVersion,
        createdAt: new Date().toISOString(),
        records: before
      }));
      localStorage.setItem(SCHEMA_KEY, String(DATA_SCHEMA_VERSION));
      const after = snapshot();
      if (Object.keys(after).length !== Object.keys(before).length) {
        throw new Error("Migration record verification failed");
      }
      localStorage.setItem(SUCCESS_KEY, new Date().toISOString());
      return { migrated: true, oldVersion };
    } catch (error) {
      return { migrated: false, oldVersion, error };
    }
  }

  window.MoonsMigrations = Object.freeze({
    DATA_SCHEMA_VERSION,
    BACKUP_KEY,
    migrate,
    snapshot
  });
  migrate();
})();
