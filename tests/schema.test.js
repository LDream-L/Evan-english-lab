const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('schema includes separate word, card, review and memory tables', () => {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'appsscript', 'Schema.gs'), 'utf8');
  for (const name of ['words', 'word_details', 'cards', 'reviews', 'memory_state', 'daily_sessions', 'import_jobs', 'article_sources', 'word_occurrences', 'enrichment_jobs']) {
    assert.match(schema, new RegExp('\\b' + name + '\\b'));
  }
});

test('web app is private and executes as deployer', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'appsscript', 'appsscript.json'), 'utf8'));
  assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
  assert.equal(manifest.webapp.access, 'MYSELF');
  assert.equal(manifest.timeZone, 'Asia/Taipei');
});

test('automatic enrichment schema is versioned', () => {
  const config = fs.readFileSync(path.join(__dirname, '..', 'appsscript', 'Config.gs'), 'utf8');
  const schema = fs.readFileSync(path.join(__dirname, '..', 'appsscript', 'Schema.gs'), 'utf8');
  assert.match(config, /schemaVersion:\s*4/);
  for (const field of ['provenance_ref', 'generator_version', 'confidence', 'validation_status']) {
    assert.match(schema, new RegExp('\\b' + field + '\\b'));
  }
});

test('M1A enrichment queue includes idempotency and retry controls', () => {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'appsscript', 'Schema.gs'), 'utf8');
  const article = fs.readFileSync(path.join(__dirname, '..', 'appsscript', 'ArticleService.gs'), 'utf8');
  for (const field of ['idempotency_key', 'attempt_count', 'next_retry_at', 'updated_at']) assert.match(schema, new RegExp('\\b' + field + '\\b'));
  assert.match(schema, /sheetName:\s*'enrichment_jobs'/);
  assert.match(article, /existingJobs/);
});

test('M1A front end exposes article preview and safe rendering', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'appsscript', 'Index.html'), 'utf8');
  const client = fs.readFileSync(path.join(__dirname, '..', 'appsscript', 'JavaScript.html'), 'utf8');
  assert.match(page, /id="preview-article"/);
  assert.match(client, /['"]previewArticleImport['"]/);
  assert.match(client, /['"]queueArticleImport['"]/);
  assert.doesNotMatch(client, /\.innerHTML\s*=/);
});

test('M1 schema keeps resumable import staging and forward migration', () => {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'appsscript', 'Schema.gs'), 'utf8');
  assert.match(schema, /import_staging:\s*\[/);
  assert.match(schema, /options_json/);
  assert.match(schema, /function migrateSchemaHeaders_/);
});

test('M1 front end renders user data without innerHTML', () => {
  const client = fs.readFileSync(path.join(__dirname, '..', 'appsscript', 'JavaScript.html'), 'utf8');
  assert.doesNotMatch(client, /\.innerHTML\s*=/);
  for (const method of ['createWord', 'updateWord', 'setWordArchived', 'previewWordImport', 'startWordImport', 'continueWordImport']) {
    assert.match(client, new RegExp("['\"]" + method + "['\"]"));
  }
});

test('service files can initialize before Schema.gs without a global load error', () => {
  const appDir = path.join(__dirname, '..', 'appsscript');
  const loadOrder = [
    'WordService.gs',
    'SourceService.gs',
    'ImportService.gs',
    'EnrichmentService.gs',
    'ArticleService.gs',
    'Code.gs',
    'Schema.gs'
  ];
  const source = loadOrder.map((name) => fs.readFileSync(path.join(appDir, name), 'utf8')).join('\n');
  const context = vm.createContext({ URL, console });
  vm.runInContext(source, context);
  assert.equal(vm.runInContext("getSheetSchemas_().words[0]", context), 'word_id');
  assert.equal(vm.runInContext("getSheetSchemas_().enrichment_jobs.at(-1)", context), 'updated_at');
});
