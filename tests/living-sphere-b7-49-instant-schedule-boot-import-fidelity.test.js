const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const Importers = require(path.join(root, 'docs/assets/js/life-atlas/life-atlas-importers.js'));
const Ingestion = require(path.join(root, 'docs/assets/js/life-atlas/life-atlas-ingestion.js'));
const Repository = require(path.join(root, 'docs/assets/js/life-atlas/life-atlas-repository.js'));

const SAMPLE_ICS = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:planting@example\nDTSTART;VALUE=DATE:20260430\nSUMMARY:🌱 Seed planting\nCATEGORIES:LIVING CALENDAR,PLANTING\nX-SOF-WORKFLOW:life\nX-SOF-WORKFLOW-KIND:planting\nX-SOF-CATEGORY:planting\nX-SOF-SYMBOL:🌱\nX-SOF-PATTERN-MOON:1\nX-SOF-PATTERN-DAY:14\nEND:VEVENT\nBEGIN:VEVENT\nUID:meeting@example\nDTSTART;VALUE=DATE:20260512\nSUMMARY:● Family meeting\nCATEGORIES:LIVING CALENDAR,MEETING\nX-SOF-WORKFLOW:life\nX-SOF-WORKFLOW-KIND:meeting\nX-SOF-CATEGORY:meeting\nX-SOF-SYMBOL:●\nX-SOF-PATTERN-MOON:1\nX-SOF-PATTERN-DAY:26\nEND:VEVENT\nEND:VCALENDAR`;

test('B7.49 ICS parser preserves symbol, category, and Pattern coordinate extensions', () => {
  const parsed = Importers.parseText({ text: SAMPLE_ICS, filename: 'population.ics' });
  assert.equal(parsed.candidates.length, 2);
  assert.equal(parsed.candidates[0].payload.category, 'planting');
  assert.equal(parsed.candidates[0].payload.symbol, '🌱');
  assert.equal(parsed.candidates[0].payload.patternMoon, 1);
  assert.equal(parsed.candidates[0].payload.patternMoonDay, 14);
});

test('B7.49 ingestion retains expressive symbols and exact Pattern cells', () => {
  const parsed = Importers.parseText({ text: SAMPLE_ICS, filename: 'population.ics' });
  const records = parsed.candidates.map(candidate => Ingestion.toRecord(candidate));
  assert.equal(records[0].payload.planner.category, 'planting');
  assert.equal(records[0].payload.planner.symbol, '🌱');
  assert.equal(records[0].temporal.moon, 1);
  assert.equal(records[0].temporal.moonDay, 14);
  assert.equal(records[0].temporal.patternDay, 14);
  assert.equal(records[1].payload.planner.category, 'meeting');
  assert.equal(records[1].payload.planner.symbol, '👥', 'generic bullet becomes category-specific glyph');
});

test('B7.49 repository delegates temporal queries to adapter query instead of scanning values', async () => {
  let queryCalls = 0;
  let valuesCalls = 0;
  const memory = Repository.createMemoryAdapter([{ id:'a', type:'event', title:'A', temporal:{patternYear:2026,patternDay:14} }]);
  const adapter = {
    get: id => memory.get(id), set: record => memory.set(record), delete: id => memory.delete(id),
    clear: () => memory.clear(), size: () => memory.size(),
    values: async () => { valuesCalls += 1; return memory.values(); },
    query: async criteria => { queryCalls += 1; return memory.query(criteria); }
  };
  const repo = Repository.createRepository({ adapter });
  const result = await repo.query({ patternYear: 2026 });
  assert.equal(result.length, 1);
  assert.equal(queryCalls, 1);
  assert.equal(valuesCalls, 0);
});

test('B7.49 IndexedDB adapter uses existing temporal indexes without a schema migration', () => {
  const src = read('docs/assets/js/life-atlas/life-atlas-indexeddb.js');
  assert.match(src, /async function query\(criteria = \{\}\)/);
  assert.match(src, /index\.getAll\(value\)|openCursor\(value\)/);
  assert.match(src, /patternYear/);
  assert.doesNotMatch(src, /DB_VERSION\s*=\s*2/);
});

test('B7.49 planner shares indexed year promises and defers repair writes beyond first paint', () => {
  const src = read('docs/assets/js/life-atlas/life-atlas-planner.js');
  assert.match(src, /plansByYearCache/);
  assert.match(src, /repo\.query\(\{ patternYear: year \}\)/);
  assert.match(src, /upcomingPlans/);
  assert.match(src, /schedulePlannerRepairPersistence/);
  assert.match(src, /requestIdleCallback/);
  assert.doesNotMatch(src, /if \(next !== record\) await repo\.put\(next\)/);
});

test('B7.49 startup consumers prefer bounded planner queries', () => {
  const sphere = read('docs/assets/js/sphere/life-atlas-record-sphere-extension.js');
  const calendar = read('docs/assets/js/life-atlas/life-atlas-calendar-projection.js');
  const workbench = read('docs/assets/js/sphere/living-time-calendar-workbench.js');
  const plannerUi = read('docs/assets/js/life-atlas/life-atlas-planner-ui.js');
  const command = read('docs/assets/js/life-atlas/living-command-window.js');
  const ui = read('docs/assets/js/sphere/living-time-sphere-ui.js');
  assert.match(sphere, /planner\.plansForYear\(selectedYear\)/);
  assert.match(sphere, /runtime\.recordsForYear\(selectedYear\)/);
  assert.match(calendar, /api\.plansForYear\(year\)/);
  assert.match(workbench, /api\.plansForYear\(year\)/);
  assert.match(plannerUi, /api\.upcomingPlans\(\{ years: 2, limit: 48 \}\)/);
  assert.match(command, /api\.upcomingPlans\(\{ years: 2, limit: 64 \}\)/);
  assert.match(ui, /planner\.plansForYears/);
});

test('B7.49 preserves B7.48 single GPU symbol atlas rather than returning to sprite-per-event rendering', () => {
  const src = read('docs/assets/js/sphere/life-atlas-record-sphere-extension.js');
  assert.match(src, /new THREE\.ShaderMaterial/);
  assert.match(src, /new THREE\.Points\(geometry, material\)/);
  assert.match(src, /symbolAtlas/);
  assert.match(src, /points\.userData = \{[\s\S]*type: \"living-plan-day-points\"/);
});

test('B7.49/B7.52 planner startup authorities remain cache-busted without forcing 3D projection into ambient Moons', () => {
  const sphere = read('docs/living-time-sphere.html');
  const moons = read('docs/moons.html');
  for (const asset of [
    'life-atlas-repository.js','life-atlas-indexeddb.js','life-atlas-planner.js'
  ]) {
    const rx = new RegExp(asset.replaceAll('.', '\\.') + '\\?v=20260819-b7(?:49|50|51|52)');
    assert.match(sphere, rx, `sphere ${asset}`);
    assert.match(moons, rx, `moons ${asset}`);
  }
  assert.match(sphere, /life-atlas-record-sphere-extension\.js\?v=20260819-b7(?:49|50|51|52)/);
  assert.doesNotMatch(moons, /life-atlas-record-sphere-extension\.js/);
  for (const asset of [
    'life-atlas-planner-ui.js','living-command-window.js','life-atlas-importers.js',
    'life-atlas-ingestion.js','life-atlas-runtime.js','living-time-sphere-ui.js',
    'living-time-calendar-workbench.js'
  ]) {
    const rx = new RegExp(asset.replaceAll('.', '\\.') + '\\?v=20260819-b7(?:49|50|51|52)');
    assert.match(sphere, rx, `sphere ${asset}`);
  }
});
