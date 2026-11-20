"use strict";

/*
 * Spark companion — the companions page: their record travels.
 *
 * One file carries their whole record: their Spark record (seed,
 * growth, care, play, the reveals they have shown), their sound and
 * voice switches, their garden Life Atlas records (tends, tier
 * turns, and the passes they sealed — their keepsakes), and the
 * keeper's pins. The format is the one the Living Phone app
 * speaks (spark-bundle.js carries the contract), so a bundle
 * saved in the app restores here, and a bundle saved here
 * restores in the app — the same seed growing the same Spark in
 * both places, their history whole.
 *
 * The file moves only by the keeper's hand: a download they
 * start, a file they pick. Nothing is sent anywhere. A damaged
 * bundle is refused whole rather than half-restored, and
 * restoring over a DIFFERENT Spark already living here takes the
 * keeper's explicit second tap — the persistence fence, kept in
 * the page as it is kept in the core (SparkBundle.importDecision).
 */
(function () {
  const Core = window.SparkCompanion;
  const Bundle = window.SparkBundle;
  if (!Core || !Bundle) return;

  const $ = (id) => document.getElementById(id);

  /* The garden's records, both gardens: the old garden's tends,
   * tier turns, and passes (kept exactly as they are), and the
   * Pattern Garden's plantings, witnesses, seeds, returns, and
   * keepsakes — a keeper's whole garden travels with their Spark. */
  const GARDEN_SUBTYPES = [
    "garden-tend", "garden-tier", "garden-pass",
    "garden-planting", "garden-witness", "garden-seed", "garden-return", "garden-keepsake"
  ];
  const SOUND_KEY = "sof.spark.sound";
  const VOICE_KEY = "sof.spark.voice";
  /* The pins the app keeps live under this key; the site keeps
   * them under the same key so they travel through whole — merged
   * on restore, carried on export — even though the site's own
   * rooms do not pin yet. */
  const PIN_KEY = "sof.livingphone.pins.v1";

  function timeout(ms) {
    return new Promise((resolve) => setTimeout(() => resolve(null), ms));
  }

  async function resolveRepository() {
    const Runtime = window.CodexLifeAtlasRuntime;
    const Repository = window.CodexLifeAtlasRepository;
    try {
      if (Runtime && Runtime.ready) {
        const repo = await Promise.race([Runtime.ready, timeout(3000)]);
        if (repo) return repo;
      }
      if (Repository && typeof Repository.createPersistentRepository === "function") {
        return await Repository.createPersistentRepository();
      }
      if (Repository && typeof Repository.createRepository === "function") {
        return Repository.createRepository();
      }
    } catch {
      return null;
    }
    return null;
  }

  function readRecord() {
    try {
      const raw = window.localStorage.getItem(Core.STORAGE_KEY);
      if (!raw) return null;
      const record = JSON.parse(raw);
      return record && Core.parseSeed(record.seed) ? record : null;
    } catch {
      return null;
    }
  }

  function loadPins() {
    try {
      const pins = JSON.parse(window.localStorage.getItem(PIN_KEY) || "[]");
      return Array.isArray(pins) ? pins : [];
    } catch {
      return [];
    }
  }

  function savePins(pins) {
    try {
      window.localStorage.setItem(PIN_KEY, JSON.stringify(pins));
    } catch {
      /* a pin unkept is a small loss, never a broken page */
    }
  }

  async function collectGarden() {
    const repository = await resolveRepository();
    if (!repository) return [];
    const records = [];
    for (const subtype of GARDEN_SUBTYPES) {
      try {
        const found = (await repository.query({ subtype })) || [];
        for (const record of found) if (record) records.push(record);
      } catch { /* a subtype with no records answers empty */ }
    }
    return records;
  }

  async function collectPayload() {
    const record = readRecord();
    if (!record) return null;
    return {
      spark: {
        record,
        pendingSeed: window.localStorage.getItem(Core.PENDING_KEY),
        sound: window.localStorage.getItem(SOUND_KEY),
        voice: window.localStorage.getItem(VOICE_KEY),
      },
      garden: await collectGarden(),
      pins: loadPins(),
    };
  }

  function note(text) {
    const el = $("spark-travel-note");
    if (el) el.textContent = text;
  }

  async function doExport() {
    const payload = await collectPayload();
    if (!payload) {
      note("There is no Spark on this device yet to travel.");
      return;
    }
    const bundle = Bundle.buildBundle(payload);
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = Bundle.BUNDLE_FILENAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    note("Their record is saved — one file, their whole history. Keep it " +
      "somewhere safe; whoever holds it can restore them.");
  }

  async function applyBundle(payload) {
    const { record, pendingSeed, sound, voice } = payload.spark;
    window.localStorage.setItem(Core.STORAGE_KEY, JSON.stringify(record));
    if (pendingSeed) {
      window.localStorage.setItem(Core.PENDING_KEY, pendingSeed);
    } else {
      window.localStorage.removeItem(Core.PENDING_KEY);
    }
    if (sound) window.localStorage.setItem(SOUND_KEY, sound);
    if (voice) window.localStorage.setItem(VOICE_KEY, voice);

    /* Their garden comes home too: records they do not already
     * hold are put back by id; records already here are left
     * untouched. */
    const repository = await resolveRepository();
    if (repository && Array.isArray(payload.garden)) {
      const held = new Set();
      for (const subtype of GARDEN_SUBTYPES) {
        try {
          const found = (await repository.query({ subtype })) || [];
          for (const r of found) if (r && r.id) held.add(r.id);
        } catch { /* empty is a fine answer */ }
      }
      for (const recordIn of Bundle.gardenRestorePlan(payload, held)) {
        try { await repository.put(recordIn); } catch { /* kept out, not half-in */ }
      }
    }

    /* Pins merge by kind + ref: restoring never unpins. */
    if (Array.isArray(payload.pins)) {
      savePins(Bundle.mergePins(loadPins(), payload.pins));
    }
  }

  let armedBundle = null;

  async function doImportFile(file) {
    if (!file) return;
    let text;
    try {
      text = await file.text();
    } catch {
      note("That file could not be read here.");
      return;
    }
    let bundle;
    try {
      bundle = JSON.parse(text);
    } catch {
      note("That file is not their record — it could not be read as one. Nothing was changed.");
      return;
    }
    const check = Bundle.verifyBundle(bundle);
    if (!check.ok) {
      note("That bundle is damaged or incomplete, so it was refused whole — " +
        "their record here is untouched. (" + check.reason + ")");
      return;
    }
    if (!Core.parseSeed(check.payload.spark.record.seed)) {
      note("That bundle's seed does not speak — it was refused. Nothing was changed.");
      return;
    }
    const existing = readRecord();
    if (Bundle.importDecision(existing, check.payload) === "confirm-overwrite") {
      armedBundle = check.payload;
      const incoming = Core.generate(check.payload.spark.record.seed);
      const currentName = existing
        ? Core.displayName(existing, Core.generate(existing.seed))
        : "the Spark here";
      $("spark-travel-confirm-text").textContent =
        `A different Spark lives on this device — ${currentName}. The file ` +
        `carries ${incoming ? incoming.name : "another Spark"}. Restoring it ` +
        "replaces their record here, whole. Tap once more to restore, or leave " +
        "this be and nothing changes.";
      $("spark-travel-confirm").hidden = false;
      note("");
      return;
    }
    await applyBundle(check.payload);
    note("They are restored — the same Spark, their history whole. This page will show them now.");
    setTimeout(() => window.location.reload(), 900);
  }

  function start() {
    const exportButton = $("spark-travel-export");
    const importButton = $("spark-travel-import");
    const fileInput = $("spark-travel-file");
    if (!exportButton || !importButton || !fileInput) return;
    exportButton.addEventListener("click", () => { doExport(); });
    importButton.addEventListener("click", () => { fileInput.click(); });
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      doImportFile(file);
    });
    $("spark-travel-confirm-button").addEventListener("click", async () => {
      if (!armedBundle) return;
      const payload = armedBundle;
      armedBundle = null;
      $("spark-travel-confirm").hidden = true;
      await applyBundle(payload);
      note("They are restored — the same Spark, their history whole. This page will show them now.");
      setTimeout(() => window.location.reload(), 900);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
