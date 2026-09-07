const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadContext() {
  const context = vm.createContext({ console });
  for (const file of ['Config.gs', 'Schema.gs', 'WordService.gs', 'ArticleService.gs']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'appsscript', file), 'utf8'), context, { filename: file });
  }
  return context;
}

test('candidate extraction ranks TOEIC terms and removes stop words', () => {
  const context = loadContext();
  const result = vm.runInContext(`extractArticleCandidates_(
    'The supplier sent an invoice. The manager approved the invoice and reimbursed the employee.',
    [], new Set(), 20
  )`, context);
  assert.equal(result.candidates[0].lemma, 'invoice');
  assert.equal(result.candidates.some(item => item.lemma === 'the'), false);
  assert.equal(result.candidates.find(item => item.lemma === 'invoice').frequency, 2);
});

test('candidate extraction excludes existing and mastered words', () => {
  const context = loadContext();
  const result = vm.runInContext(`extractArticleCandidates_(
    'The invoice confirms the shipment and payment.',
    [{word_id:'w1', lemma:'invoice', normalized_lemma:'invoice'}, {word_id:'w2', lemma:'shipment', normalized_lemma:'shipment'}],
    new Set(['w2']), 20
  )`, context);
  assert.equal(result.candidates.some(item => item.lemma === 'invoice'), false);
  assert.equal(result.candidates.some(item => item.lemma === 'shipment'), false);
  assert.equal(result.exclusions.existing_word, 1);
  assert.equal(result.exclusions.mastered, 1);
});

test('URL validation rejects local and private hosts', () => {
  const context = loadContext();
  for (const url of ['http://localhost/a', 'http://127.0.0.1/a', 'http://10.0.0.1/a', 'http://172.20.1.2/a', 'ftp://example.com/a']) {
    assert.throws(() => vm.runInContext(`validateArticleUrl_(${JSON.stringify(url)})`, context));
  }
  assert.equal(vm.runInContext("validateArticleUrl_('https://example.com/article')", context), 'https://example.com/article');
});

test('HTML cleaning removes executable blocks and keeps readable text', () => {
  const context = loadContext();
  const result = vm.runInContext("htmlToArticleText_('<article><h1>Invoice</h1><script>alert(1)</script><p>Please pay &amp; confirm.</p></article>')", context);
  assert.match(result, /Invoice/);
  assert.match(result, /Please pay & confirm/);
  assert.doesNotMatch(result, /alert/);
});
