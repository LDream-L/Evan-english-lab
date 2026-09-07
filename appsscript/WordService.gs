const WORD_COLUMNS = Object.freeze(SHEET_SCHEMAS.words.reduce(function(result, name, index) {
  result[name] = index;
  return result;
}, {}));

const WORD_STATUSES = Object.freeze(['active', 'archived', 'draft']);
const WORD_POS = Object.freeze(['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'determiner', 'interjection', 'phrase', 'other']);

/**
 * 建立可穩定比對的英文索引值。
 * 時間複雜度：O(k)，k 為輸入字元數。
 * 空間複雜度：O(k)。
 * 更快替代：只用 trim/lowercase 常數較小，但無法統一全形字元與重複空白；採 NFKC 確保匯入去重一致。
 */
function normalizeLemma_(value) {
  return String(value == null ? '' : value)
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ');
}

/**
 * 正規化詞性並展開常見縮寫。
 * 時間複雜度：O(k)。
 * 空間複雜度：O(k)。
 * 更快替代：直接保存輸入可省查表，但會讓 n./noun 形成假重複；採固定查表。
 */
function normalizePos_(value) {
  const normalized = normalizeLemma_(value).replace(/\.$/, '');
  const aliases = {
    n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', pron: 'pronoun',
    prep: 'preposition', conj: 'conjunction', det: 'determiner', int: 'interjection', phr: 'phrase'
  };
  return aliases[normalized] || normalized;
}

/**
 * 清理一般文字欄位但保留大小寫。
 * 時間複雜度：O(k)。
 * 空間複雜度：O(k)。
 * 更快替代：不做 Unicode normalization 較快但可能保存視覺相同、編碼不同的資料；採 NFKC。
 */
function cleanText_(value) {
  return String(value == null ? '' : value).normalize('NFKC').trim().replace(/\s+/g, ' ');
}

/**
 * 建立單字重複判斷鍵。
 * 時間複雜度：O(k)。
 * 空間複雜度：O(k)。
 * 更快替代：只用 lemma 可少一段串接，但會錯誤合併不同詞性；採 lemma＋pos。
 */
function buildWordKey_(lemma, pos) {
  return normalizeLemma_(lemma) + '\u001f' + normalizePos_(pos);
}

/**
 * 驗證並正規化單筆單字輸入。
 * 時間複雜度：O(k)。
 * 空間複雜度：O(k)。
 * 更快替代：信任前端可省驗證，但 Apps Script RPC 可被直接呼叫；後端必須重驗。
 */
function validateWordInput_(input) {
  const source = input && typeof input === 'object' ? input : {};
  const value = {
    lemma: cleanText_(source.lemma),
    normalized_lemma: normalizeLemma_(source.lemma),
    primary_meaning_zh: cleanText_(source.primary_meaning_zh || source.meaning_zh || source.meaning),
    pos: normalizePos_(source.pos),
    source_id: cleanText_(source.source_id),
    priority: cleanText_(source.priority || 'normal').toLowerCase(),
    status: cleanText_(source.status || 'active').toLowerCase(),
    enrichment_status: cleanText_(source.enrichment_status || 'pending').toLowerCase()
  };
  const errors = [];
  if (!value.lemma) errors.push('lemma_required');
  if (!/^[A-Za-z][A-Za-z0-9 '&\-\.\/]*$/.test(value.lemma)) errors.push('lemma_invalid');
  if (!value.primary_meaning_zh) errors.push('meaning_required');
  if (!WORD_POS.includes(value.pos)) errors.push('pos_invalid');
  if (!WORD_STATUSES.includes(value.status)) errors.push('status_invalid');
  return { valid: errors.length === 0, errors: errors, value: value };
}

/**
 * 一次讀取 words 並建立 ID、複合鍵到列位置的索引。
 * 時間複雜度：O(n × c)。
 * 空間複雜度：O(n × c)。
 * 更快替代：每次 TextFinder 只查一筆時記憶體較少，但批次 CRUD 會造成大量 Sheets 往返；採一次批次讀取＋Map。
 */
function loadWordTable_() {
  const sheet = getDatabase_().getSheetByName('words');
  if (!sheet) throw new Error('工作表不存在: words');
  const count = Math.max(sheet.getLastRow() - 1, 0);
  const rows = count ? sheet.getRange(2, 1, count, SHEET_SCHEMAS.words.length).getValues() : [];
  const byId = new Map();
  const byKey = new Map();
  rows.forEach(function(row, index) {
    const rowNumber = index + 2;
    byId.set(String(row[WORD_COLUMNS.word_id]), rowNumber);
    byKey.set(buildWordKey_(row[WORD_COLUMNS.normalized_lemma], row[WORD_COLUMNS.pos]), rowNumber);
  });
  return { sheet: sheet, rows: rows, byId: byId, byKey: byKey };
}

/**
 * 依 ID 取得列位置；先驗證短期快取，避免使用過期 row number。
 * 時間複雜度：快取命中 O(c)，未命中 O(n × c)。
 * 空間複雜度：未命中 O(n × c)。
 * 更快替代：永久保存 row number 可做到穩定常數查詢，但人工插列會使索引失效；採可驗證 CacheService。
 */
function findWordRowById_(wordId) {
  const id = cleanText_(wordId);
  if (!id) throw new Error('word_id_required');
  const sheet = getDatabase_().getSheetByName('words');
  const cache = CacheService.getScriptCache();
  const cacheKey = 'word-row:' + id;
  const cached = Number(cache.get(cacheKey));
  if (cached >= 2 && String(sheet.getRange(cached, WORD_COLUMNS.word_id + 1).getValue()) === id) return cached;
  const table = loadWordTable_();
  const rowNumber = table.byId.get(id);
  if (!rowNumber) throw new Error('word_not_found:' + id);
  cache.put(cacheKey, String(rowNumber), 21600);
  return rowNumber;
}

function rowToWord_(row) {
  const result = {};
  SHEET_SCHEMAS.words.forEach(function(header, index) { result[header] = row[index]; });
  return result;
}

function createWordRow_(value, wordId, now) {
  return [
    wordId, value.lemma, value.normalized_lemma, value.primary_meaning_zh, value.pos,
    value.source_id, value.priority, value.status, value.enrichment_status, now, now, 1
  ];
}

/**
 * 新增單字，並在鎖內拒絕 lemma＋pos 重複。
 * 時間複雜度：O(n × c)。
 * 空間複雜度：O(n × c)。
 * 更快替代：直接 append 為 O(c)，但無法保證不重複；採鎖內 Map 去重。
 */
function createWord(input) {
  const checked = validateWordInput_(input);
  if (!checked.valid) throw new Error('word_invalid:' + checked.errors.join(','));
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const table = loadWordTable_();
    const key = buildWordKey_(checked.value.normalized_lemma, checked.value.pos);
    if (table.byKey.has(key)) throw new Error('word_duplicate');
    const now = new Date().toISOString();
    const wordId = 'w_' + Utilities.getUuid().replace(/-/g, '');
    const row = createWordRow_(checked.value, wordId, now);
    const rowNumber = table.sheet.getLastRow() + 1;
    table.sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
    CacheService.getScriptCache().put('word-row:' + wordId, String(rowNumber), 21600);
    return rowToWord_(row);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 更新單字並以 row_version 阻止舊頁面覆蓋新資料。
 * 時間複雜度：O(n × c)（需檢查複合鍵碰撞）。
 * 空間複雜度：O(n × c)。
 * 更快替代：只寫已知列可為 O(c)，但 lemma/pos 變更時可能製造重複；採完整鍵索引驗證。
 */
function updateWord(wordId, patch, expectedRowVersion) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const table = loadWordTable_();
    const rowNumber = table.byId.get(cleanText_(wordId));
    if (!rowNumber) throw new Error('word_not_found:' + wordId);
    const row = table.rows[rowNumber - 2];
    const current = rowToWord_(row);
    if (Number(expectedRowVersion) !== Number(current.row_version)) throw new Error('row_version_conflict');
    const merged = Object.assign({}, current, patch || {});
    const checked = validateWordInput_(merged);
    if (!checked.valid) throw new Error('word_invalid:' + checked.errors.join(','));
    const collision = table.byKey.get(buildWordKey_(checked.value.normalized_lemma, checked.value.pos));
    if (collision && collision !== rowNumber) throw new Error('word_duplicate');
    const now = new Date().toISOString();
    const next = createWordRow_(checked.value, current.word_id, current.created_at || now);
    next[WORD_COLUMNS.updated_at] = now;
    next[WORD_COLUMNS.row_version] = Number(current.row_version || 0) + 1;
    table.sheet.getRange(rowNumber, 1, 1, next.length).setValues([next]);
    return rowToWord_(next);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 封存或復原單字；不刪除 cards、reviews 等歷史引用。
 * 時間複雜度：O(n × c)。
 * 空間複雜度：O(n × c)。
 * 更快替代：直接刪列較快但會破壞歷史關聯；採 status 軟刪除。
 */
function setWordArchived(wordId, archived, expectedRowVersion) {
  return updateWord(wordId, { status: archived ? 'archived' : 'active' }, expectedRowVersion);
}

/**
 * 取得單字與其明細。
 * 時間複雜度：O(d × c)，d 為 detail 筆數。
 * 空間複雜度：O(d × c)。
 * 更快替代：另建 word_id→detail row 索引可改善大量明細查詢；M1 單筆開啟頻率低，採批次讀表。
 */
function getWord(wordId) {
  const rowNumber = findWordRowById_(wordId);
  const sheet = getDatabase_().getSheetByName('words');
  const word = rowToWord_(sheet.getRange(rowNumber, 1, 1, SHEET_SCHEMAS.words.length).getValues()[0]);
  word.details = readTable_('word_details').filter(function(item) { return String(item.word_id) === String(wordId); });
  return word;
}

/**
 * 搜尋單字庫並分頁回傳。
 * 時間複雜度：O(n log n)。
 * 空間複雜度：O(n)。
 * 更快替代：維護已排序索引或外部搜尋服務可降查詢成本；個人數千字規模採單次篩選排序，避免額外同步複雜度。
 */
function searchWords(query, filters, offset, limit) {
  const q = normalizeLemma_(query);
  const settings = filters && typeof filters === 'object' ? filters : {};
  const status = cleanText_(settings.status || 'active').toLowerCase();
  const start = Math.max(Number(offset) || 0, 0);
  const pageSize = Math.min(Math.max(Number(limit) || 30, 1), APP_CONFIG.wordSearchLimit);
  const rows = loadWordTable_().rows.map(rowToWord_).filter(function(word) {
    if (status !== 'all' && String(word.status) !== status) return false;
    if (!q) return true;
    return normalizeLemma_(word.lemma).includes(q) || normalizeLemma_(word.primary_meaning_zh).includes(q) || normalizeLemma_(word.pos).includes(q);
  });
  rows.sort(function(a, b) { return String(a.normalized_lemma).localeCompare(String(b.normalized_lemma), 'en'); });
  return { total: rows.length, offset: start, limit: pageSize, items: rows.slice(start, start + pageSize) };
}

/**
 * 新增或更新單字明細。
 * 時間複雜度：新增 O(c)，更新 O(d × c)。
 * 空間複雜度：更新 O(d × c)。
 * 更快替代：detail_id 列號快取可改善高頻更新；M1 明細更新量低，採批次定位避免額外索引失效問題。
 */
function saveWordDetail(input) {
  const source = input && typeof input === 'object' ? input : {};
  const wordId = cleanText_(source.word_id);
  findWordRowById_(wordId);
  const value = cleanText_(source.value);
  const type = cleanText_(source.detail_type);
  if (!value || !type) throw new Error('detail_invalid');
  const sheet = getDatabase_().getSheetByName('word_details');
  const table = readTable_('word_details');
  const now = new Date().toISOString();
  const detailId = cleanText_(source.detail_id) || 'wd_' + Utilities.getUuid().replace(/-/g, '');
  const existingIndex = table.findIndex(function(item) { return String(item.detail_id) === detailId; });
  const createdAt = existingIndex >= 0 ? table[existingIndex].created_at : now;
  const row = [detailId, wordId, type, value, cleanText_(source.language || 'en'), Number(source.sort_order) || 0,
    cleanText_(source.provenance_type || 'manual'), cleanText_(source.provenance_ref), cleanText_(source.generator_version),
    source.confidence === '' || source.confidence == null ? '' : Number(source.confidence), cleanText_(source.validation_status || 'verified'), createdAt, now];
  if (existingIndex >= 0) sheet.getRange(existingIndex + 2, 1, 1, row.length).setValues([row]);
  else sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  const result = {};
  SHEET_SCHEMAS.word_details.forEach(function(header, index) { result[header] = row[index]; });
  return result;
}

/**
 * 刪除尚未被其他資料表引用的單字明細。
 * 時間複雜度：O(d × c)。
 * 空間複雜度：O(d × c)。
 * 更快替代：detail_id 列號索引可降定位成本；M1 明細量低，避免維護第二套易失效索引。
 */
function deleteWordDetail(detailId) {
  const id = cleanText_(detailId);
  const sheet = getDatabase_().getSheetByName('word_details');
  const count = Math.max(sheet.getLastRow() - 1, 0);
  const rows = count ? sheet.getRange(2, 1, count, SHEET_SCHEMAS.word_details.length).getValues() : [];
  const index = rows.findIndex(function(row) { return String(row[0]) === id; });
  if (index < 0) throw new Error('detail_not_found:' + id);
  sheet.deleteRow(index + 2);
  return { deleted: true, detail_id: id };
}
