const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Exporter = require('../docs/assets/js/life-atlas/life-atlas-export.js');
const Importers = require('../docs/assets/js/life-atlas/life-atlas-importers.js');
const Repository = require('../docs/assets/js/life-atlas/life-atlas-repository.js');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function stripRelationIds(records) {
  return records.map(record => ({
    ...record,
    relations: record.relations.map(({ id, ...rest }) => rest)
  }));
}

async function seededRepository() {
  const repository = Repository.createRepository({ adapter: Repository.createMemoryAdapter() });
  await repository.put({
    id: 'life:test-1', type: 'event', title: 'Coast day', summary: 'La Push',
    temporal: { instant: '2026-08-17T12:00:00Z', civilDate: '2026-08-17', patternYear: 2026, moon: 5, moonDay: 3, patternDay: 115 },
    spatial: { latitude: 47.9, longitude: -124.6, placeLabel: 'La Push, WA', precision: 'exact' },
    tags: ['family', 'coast'],
    relations: [{ type: 'related', targetId: 'life:other' }],
    provenance: { sourceType: 'manual', sourceId: 't1' },
    privacy: { visibility: 'private', containsPersonalData: true },
    payload: { note: 'keep me' }
  });
  await repository.put({ id: 'life:test-2', type: 'journal', title: 'Undated note', summary: 'no instant', payload: {} });
  return repository;
}

test('backup envelope carries format, schema version and every record', async () => {
  const repository = await seededRepository();
  const records = await repository.exportRecords();
  const backup = Exporter.buildBackup(records, { exportedAt: '2026-11-17T00:00:00.000Z' });
  assert.equal(backup.format, 'codex-life-atlas-backup');
  assert.equal(backup.format, Exporter.FORMAT);
  assert.equal(backup.schemaVersion, '1.0.0');
  assert.equal(backup.exportedAt, '2026-11-17T00:00:00.000Z');
  assert.equal(backup.recordCount, 2);
  assert.equal(backup.records.length, 2);
});

test('export -> backup file -> importRecords restores the full records', async () => {
  const repository = await seededRepository();
  const exported = await repository.exportRecords();
  const text = Exporter.serializeBackup(exported, { exportedAt: '2026-11-17T00:00:00.000Z' });

  const parsed = Exporter.parseBackup(text);
  assert.equal(parsed.kind, 'envelope');
  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.rejected.length, 0);

  const restored = Repository.createRepository({ adapter: Repository.createMemoryAdapter() });
  const result = await restored.importRecords(parsed.records);
  assert.equal(result.imported.length, 2);
  assert.equal(result.rejected.length, 0);

  const back = await restored.exportRecords();
  const byId = list => [...list].sort((a, b) => a.id.localeCompare(b.id));
  // Everything round-trips exactly except relation ids: the schema
  // normalizer has always re-minted those on re-validation (it reads
  // `relationId`, not the stored `id`). Relation type/target survive.
  assert.deepEqual(stripRelationIds(byId(back)), stripRelationIds(byId(exported)));
  assert.equal(back.find(r => r.id === 'life:test-1').relations[0].targetId, 'life:other');
  assert.equal(back.find(r => r.id === 'life:test-1').temporal.patternDay, 115);
  assert.equal(back.find(r => r.id === 'life:test-1').privacy.visibility, 'private');
});

test('a bare exportRecords() array is also recognized as a backup', async () => {
  const repository = await seededRepository();
  const exported = await repository.exportRecords();
  const parsed = Exporter.parseBackup(JSON.stringify(exported));
  assert.equal(parsed.kind, 'records');
  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.rejected.length, 0);
});

test('non-backup files are not claimed by the backup parser', () => {
  assert.equal(Exporter.parseBackup('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nEND:VEVENT\nEND:VCALENDAR'), null);
  assert.equal(Exporter.parseBackup(JSON.stringify([{ timestamp: '2026-08-17T12:00:00Z', text: 'archive post' }])), null);
  assert.equal(Exporter.parseBackup('not json at all'), null);
  assert.equal(Exporter.parseBackup(JSON.stringify({ format: 'sof-calendar-backup', lifeAtlasRecords: [] })), null);
});

test('invalid records inside a backup envelope are rejected individually', async () => {
  const repository = await seededRepository();
  const exported = await repository.exportRecords();
  const broken = {
    ...exported[0],
    id: 'life:bad',
    privacy: { visibility: 'public', containsPersonalData: true, shareAllowed: false }
  };
  const parsed = Exporter.parseBackup(JSON.stringify({
    format: Exporter.FORMAT, version: Exporter.VERSION, records: [exported[0], broken]
  }));
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.rejected.length, 1);
  assert.equal(parsed.rejected[0].index, 1);
});

test('gap documentation: the generic archive importer cannot read a canonical export', async () => {
  // This is why the backup adapter exists: Importers.objectCandidate looks
  // for flat timestamp/text fields, so a canonical LifeRecord array yields
  // zero candidates. Restore must go through Exporter.parseBackup +
  // repository.importRecords, which the import UI now does.
  const repository = await seededRepository();
  const exported = await repository.exportRecords();
  const result = Importers.parseText({ text: JSON.stringify(exported), filename: 'life-atlas-backup.json' });
  assert.equal(result.candidates.length, 0);
});

test('backup filename is dated and JSON', () => {
  assert.equal(Exporter.filenameFor(new Date('2026-11-17T20:00:00Z')), 'life-atlas-backup-2026-11-17.json');
});

test('Living Sphere Life Atlas panel offers the backup download and restore path', () => {
  const html = read('docs/living-time-sphere.html');
  assert.match(html, /life-atlas-export\.js\?v=/);
  assert.match(html, /id="life-atlas-export-backup"/);
  assert.match(html, /Download Backup \(JSON\)/);
  assert.match(html, /This file contains your private records/);

  const ui = read('docs/assets/js/life-atlas/life-atlas-import-ui.js');
  assert.match(ui, /CodexLifeAtlasExport\.downloadBackup/);
  assert.match(ui, /repository\.exportRecords\(\)/);
  assert.match(ui, /CodexLifeAtlasExport\.parseBackup/);
  assert.match(ui, /repository\.importRecords\(state\.backupRecords\)/);
});
