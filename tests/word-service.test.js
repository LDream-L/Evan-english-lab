const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadContext() {
  const context = vm.createContext({ console });
  for (const file of ['Config.gs', 'Schema.gs', 'WordService.gs', 'ImportService.gs']) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'appsscript', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }
  return context;
}

test('normalization unifies width, case, spaces and POS aliases', () => {
  const context = loadContext();
  assert.equal(vm.runInContext("normalizeLemma_('  Ｒeimburse   Employees  ')", context), 'reimburse employees');
  assert.equal(vm.runInContext("normalizePos_('N.')", context), 'noun');
  assert.equal(vm.runInContext("buildWordKey_('Invoice', 'n.')", context), 'invoice\u001fnoun');
});

test('word validation rejects missing meaning and unsupported POS', () => {
  const context = loadContext();
  const result = vm.runInContext("validateWordInput_({lemma:'invoice', pos:'x'})", context);
  assert.equal(result.valid, false);
  assert.deepEqual(Array.from(result.errors), ['meaning_required', 'pos_invalid']);
});

test('import classification separates insert, skip, conflict and error', () => {
  const context = loadContext();
  const source = `(() => {
    const existing = new Map();
    existing.set(buildWordKey_('invoice', 'noun'), {
      word_id: 'w_invoice', lemma: 'invoice', normalized_lemma: 'invoice',
      primary_meaning_zh: '發票', pos: 'noun', source_id: '', priority: 'normal'
    });
    return classifyImportRows_([
      {lemma:'invoice', primary_meaning_zh:'發票', pos:'noun'},
      {lemma:'reimburse', primary_meaning_zh:'報銷', pos:'verb'},
      {lemma:'reimburse', primary_meaning_zh:'報銷', pos:'v.'},
      {lemma:'shipment', primary_meaning_zh:'貨運', pos:'noun'},
      {lemma:'shipment', primary_meaning_zh:'出貨批次', pos:'noun'},
      {lemma:'123', primary_meaning_zh:'錯誤', pos:'noun'}
    ], existing, {update_existing:false});
  })()`;
  const result = vm.runInContext(source, context);
  assert.deepEqual({ ...result.summary }, { insert: 2, update: 0, skip: 2, conflict: 1, error: 1 });
  assert.deepEqual(Array.from(result.items, item => item.action), ['skip', 'insert', 'skip', 'insert', 'conflict', 'error']);
});

test('update policy classifies changed existing word as update', () => {
  const context = loadContext();
  const summary = vm.runInContext(`(() => {
    const existing = new Map([[buildWordKey_('invoice','noun'), {
      word_id:'w1', lemma:'invoice', normalized_lemma:'invoice', primary_meaning_zh:'發票', pos:'noun', source_id:'', priority:'normal'
    }]]);
    return classifyImportRows_([{lemma:'invoice', primary_meaning_zh:'發票；帳單', pos:'noun'}], existing, {update_existing:true}).summary;
  })()`, context);
  assert.deepEqual({ ...summary }, { insert: 0, update: 1, skip: 0, conflict: 0, error: 0 });
});

test('1,000-row preview classification stays linear and complete', () => {
  const context = loadContext();
  const summary = vm.runInContext(`(() => {
    const rows = Array.from({length:1000}, (_, index) => ({lemma:'word' + index, primary_meaning_zh:'測試' + index, pos:'noun'}));
    return classifyImportRows_(rows, new Map(), {update_existing:false}).summary;
  })()`, context);
  assert.equal(summary.insert, 1000);
  assert.equal(summary.error, 0);
});
