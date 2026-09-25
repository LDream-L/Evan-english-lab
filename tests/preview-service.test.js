const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
  const tables = { daily_sessions: [], word_details: [], sources: [], word_occurrences: [], article_sources: [] };
  const words = [
    { word_id: 'w1', lemma: 'itinerary', primary_meaning_zh: '行程表', pos: 'noun', priority: 'high', status: 'active', source_id: 's1' },
    { word_id: 'w2', lemma: 'reservation', primary_meaning_zh: '預訂', pos: 'noun', priority: 'normal', status: 'active', source_id: 's1' },
    { word_id: 'w3', lemma: 'destination', primary_meaning_zh: '目的地', pos: 'noun', priority: 'normal', status: 'active', source_id: 's1' }
  ];
  const sandbox = vm.createContext({ console, Map, Set });
  for (const file of ['Config.gs', 'Schema.gs', 'WordService.gs', 'RidingService.gs', 'PreviewService.gs']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'appsscript', file), 'utf8'), sandbox, { filename: file });
  }
  tables.word_details.push({ word_id: 'w1', detail_type: 'example_en', value: 'Please check the itinerary.', validation_status: 'verified', sort_order: 1 });
  tables.sources.push({ source_id: 's1', name: '自編多益情境單字' });
  sandbox.readTable_ = name => tables[name] || [];
  sandbox.loadWordTable_ = () => ({ rows: words });
  sandbox.rowToWord_ = row => row;
  sandbox.Utilities = { getUuid: (() => { let index = 0; return () => `session-${++index}`; })(), formatDate: () => '2026-09-25' };
  sandbox.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
  const headers = vm.runInContext('getSheetSchemas_().daily_sessions', sandbox);
  const sheet = {
    appendRow(row) { tables.daily_sessions.push(Object.fromEntries(headers.map((header, i) => [header, row[i]]))); },
    getRange(row, col) { return { setValue(value) { tables.daily_sessions[row - 2][headers[col - 1]] = value; } }; }
  };
  sandbox.getDatabase_ = () => ({ getSheetByName: () => sheet });
  return { sandbox, tables, words };
}

test('preview persists choices, resumes and never writes formal review data', () => {
  const { sandbox, tables } = setup();
  sandbox.requested = 2;
  const first = vm.runInContext('startPreviewSession(requested)', sandbox);
  assert.equal(first.current.lemma, 'itinerary');
  assert.equal(first.current.example, 'Please check the itinerary.');
  assert.equal(first.current.source_name, '自編多益情境單字');
  assert.equal(first.total, 2);
  const after = vm.runInContext('submitPreviewChoice("session-1", "w1", "new")', sandbox);
  assert.equal(after.cursor, 1);
  assert.equal(after.counts.new, 1);
  assert.equal(vm.runInContext('getLatestPreviewSession().cursor', sandbox), 1);
  assert.equal(vm.runInContext('submitPreviewChoice("session-1", "w1", "new").cursor', sandbox), 1);
  assert.equal(vm.runInContext('startPreviewSession(10).session_id', sandbox), 'session-1');
  const finished = vm.runInContext('submitPreviewChoice("session-1", "w3", "familiar")', sandbox);
  assert.equal(finished.status, 'preview_completed');
  assert.equal(finished.counts.familiar, 1);
  assert.equal(tables.daily_sessions.length, 1);
  assert.deepEqual(Object.keys(tables), ['daily_sessions', 'word_details', 'sources', 'word_occurrences', 'article_sources']);
  const next = vm.runInContext('startPreviewSession(1)', sandbox);
  assert.equal(next.current.word_id, 'w2');
});

test('preview rejects stale position and conflicting duplicate without losing progress', () => {
  const { sandbox, tables } = setup();
  vm.runInContext('startPreviewSession(2)', sandbox);
  assert.throws(() => vm.runInContext('submitPreviewChoice("session-1", "w3", "know")', sandbox), /preview_position_changed/);
  vm.runInContext('submitPreviewChoice("session-1", "w1", "know")', sandbox);
  assert.throws(() => vm.runInContext('submitPreviewChoice("session-1", "w1", "new")', sandbox), /preview_choice_conflict/);
  assert.throws(() => vm.runInContext('submitPreviewChoice("session-1", "w3", "wrong")', sandbox), /invalid_preview_choice/);
  assert.equal(vm.runInContext('getLatestPreviewSession().cursor', sandbox), 1);
  assert.equal(tables.daily_sessions[0].status, 'preview_active');
});

test('the M2 UI offers text preview while riding audio is explicitly disabled', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'appsscript', 'Index.html'), 'utf8');
  const client = fs.readFileSync(path.join(__dirname, '..', 'appsscript', 'JavaScript.html'), 'utf8');
  assert.match(page, /id="start-preview"/);
  assert.match(page, /id="prepare-riding"[^>]*disabled/);
  assert.match(page, /id="test-riding-audio"[^>]*disabled/);
  assert.match(client, /submitPreviewChoice/);
  assert.doesNotMatch(client, /\.innerHTML\s*=/);
});
