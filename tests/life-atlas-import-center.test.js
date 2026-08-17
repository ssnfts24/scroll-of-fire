const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Importers = require('../docs/assets/js/life-atlas/life-atlas-importers.js');
const Ingestion = require('../docs/assets/js/life-atlas/life-atlas-ingestion.js');
const Repository = require('../docs/assets/js/life-atlas/life-atlas-repository.js');

const root = path.resolve(__dirname, '..');

test('ICS import produces dated private-ready event candidates', () => {
  const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:abc-1\nDTSTART:20260817T150000Z\nDTEND:20260817T160000Z\nSUMMARY:Visit the coast\nLOCATION:La Push, WA\nEND:VEVENT\nEND:VCALENDAR`;
  const result = Importers.parseText({ text: ics, filename: 'calendar.ics' });
  assert.equal(result.sourceType, 'calendar-ics');
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].title, 'Visit the coast');
  assert.equal(result.candidates[0].placeLabel, 'La Push, WA');
});

test('X-style archive wrapper parses without executing JavaScript', () => {
  const archive = `window.YTD.tweets.part0 = [{"tweet":{"id":"55","created_at":"2026-08-17T12:00:00Z","full_text":"A remembered day"}}];`;
  const result = Importers.parseText({ text: archive, filename: 'tweets.js' });
  assert.equal(result.sourceType, 'x-archive');
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].sourceId, '55');
  assert.match(result.candidates[0].summary, /remembered day/);
});

test('Google E7 coordinates normalize to latitude and longitude', () => {
  const archive = JSON.stringify([{ timestamp: '2026-08-17T12:00:00Z', latitudeE7: 475000000, longitudeE7: -1223000000, name: 'Recorded location' }]);
  const result = Importers.parseText({ text: archive, filename: 'Location History.json' });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].latitude, 47.5);
  assert.equal(result.candidates[0].longitude, -122.3);
});

test('ingestion is deterministic, private, and duplicate-safe', async () => {
  const repository = Repository.createRepository({ adapter: Repository.createMemoryAdapter() });
  const candidate = { sourceType: 'calendar-ics', sourceId: 'one', type: 'event', title: 'Test', instant: '2026-08-17T12:00:00Z', confidence: .9 };
  const first = await Ingestion.ingestCandidates([candidate], { repository });
  const second = await Ingestion.ingestCandidates([candidate], { repository });
  assert.equal(first.accepted, 1);
  assert.equal(second.duplicates, 1);
  const records = await repository.all();
  assert.equal(records.length, 1);
  assert.equal(records[0].privacy.visibility, 'private');
  assert.equal(records[0].privacy.shareAllowed, false);
  assert.equal(records[0].payload.reviewState, 'unreviewed');
});

test('Living Sphere loads import center and record projection modules', () => {
  const html = fs.readFileSync(path.join(root, 'docs/living-time-sphere.html'), 'utf8');
  assert.match(html, /Build My Life Atlas/);
  assert.match(html, /life-atlas-importers\.js/);
  assert.match(html, /life-atlas-ingestion\.js/);
  assert.match(html, /life-atlas-record-sphere-extension\.js/);
  assert.match(html, /Import as Private Records/);
});

test('unknown Android picker filename is content-sniffed as iCalendar', () => {
  const ics = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:android-test\nDTSTART:20260817T120000Z\nSUMMARY:Android picker event\nEND:VEVENT\nEND:VCALENDAR';
  const result = Importers.parseText({ text: ics, filename: 'l.aaronpaul24' });
  assert.equal(result.sourceType, 'calendar-ics');
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].title, 'Android picker event');
});

test('unknown Android picker filename is content-sniffed as JSON', () => {
  const archive = JSON.stringify([{ timestamp: '2026-08-17T12:00:00Z', text: 'Portable record' }]);
  const result = Importers.parseText({ text: archive, filename: 'download' });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].summary, 'Portable record');
});
