const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function context() {
  const sandbox = vm.createContext({ console });
  for (const file of ['Config.gs', 'Schema.gs', 'WordService.gs', 'RidingService.gs']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'appsscript', file), 'utf8'), sandbox, { filename: file });
  }
  return sandbox;
}

function sample(count) {
  return Array.from({ length: count }, (_, index) => ({
    word_id: 'w' + index,
    lemma: 'sample' + index,
    primary_meaning_zh: '範例' + index,
    context: 'sample workplace phrase',
    priority: index % 4 === 0 ? 'high' : 'normal',
    updated_at: new Date(2026, 0, index + 1).toISOString()
  }));
}

test('riding playlist uses target as a maximum instead of forcing 35 minutes', () => {
  const ctx = context();
  ctx.input = sample(2);
  const result = vm.runInContext('buildRidingPlaylist_(input, {target_minutes:35,max_passes:3,speech_rate:0.9})', ctx);
  assert.equal(result.available_word_count, 2);
  assert.equal(result.exposure_count, 6);
  assert.equal(result.ended_early, true);
  assert.ok(result.estimated_seconds < 35 * 60);
});

test('riding playlist caps a large library by requested duration', () => {
  const ctx = context();
  ctx.input = sample(500);
  const result = vm.runInContext('buildRidingPlaylist_(input, {target_minutes:5,max_passes:3,speech_rate:0.9})', ctx);
  assert.ok(result.exposure_count > 0);
  assert.ok(result.estimated_seconds <= 5 * 60);
  assert.ok(result.unique_word_count <= result.available_word_count);
});

test('riding mode UI does not require answers and uses safe text rendering', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'appsscript', 'Index.html'), 'utf8');
  const client = fs.readFileSync(path.join(__dirname, '..', 'appsscript', 'JavaScript.html'), 'utf8');
  assert.match(page, /id="prepare-riding"/);
  assert.match(page, /最多播放時間/);
  assert.match(client, /getRidingAudioPlaylist/);
  assert.match(client, /speechSynthesis/);
  assert.doesNotMatch(page, /騎乘模式[\s\S]{0,600}(會|不會|答對|答錯)/);
  assert.doesNotMatch(client, /\.innerHTML\s*=/);
});
