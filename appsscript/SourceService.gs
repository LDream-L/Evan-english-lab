const SOURCE_COLUMNS = Object.freeze(getSheetSchemas_().sources.reduce(function(result, name, index) {
  result[name] = index;
  return result;
}, {}));

function rowToSource_(row) {
  const result = {};
  getSheetSchemas_().sources.forEach(function(header, index) { result[header] = row[index]; });
  return result;
}

/**
 * 列出來源，預設只回傳啟用項目。
 * 時間複雜度：O(n)。
 * 空間複雜度：O(n)。
 * 更快替代：建立 status 索引可降低篩選成本；來源數量遠小於單字數，M1 採批次讀取。
 */
function listSources(includeArchived) {
  return readTable_('sources').filter(function(source) {
    return includeArchived === true || String(source.status) !== 'archived';
  });
}

/**
 * 新增來源並避免同名同類型重複。
 * 時間複雜度：O(n)。
 * 空間複雜度：O(n)。
 * 更快替代：直接 append 為常數級，但會產生難以辨識的重複來源；採鎖內 Map 檢查。
 */
function createSource(input) {
  const value = input && typeof input === 'object' ? input : {};
  const name = cleanText_(value.name);
  const type = cleanText_(value.type || 'manual').toLowerCase();
  if (!name) throw new Error('source_name_required');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sources = readTable_('sources');
    const duplicate = sources.some(function(source) {
      return normalizeLemma_(source.name) === normalizeLemma_(name) && normalizeLemma_(source.type) === type && String(source.status) !== 'archived';
    });
    if (duplicate) throw new Error('source_duplicate');
    const now = new Date().toISOString();
    const row = ['src_' + Utilities.getUuid().replace(/-/g, ''), name, type, cleanText_(value.description), 'active', now, now];
    const sheet = getDatabase_().getSheetByName('sources');
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
    return rowToSource_(row);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 更新或封存來源；來源列不刪除，避免 words.source_id 失去對應。
 * 時間複雜度：O(n × c)。
 * 空間複雜度：O(n × c)。
 * 更快替代：來源 ID→列號快取可降低定位，但來源量小且修改極少；批次定位較穩定。
 */
function updateSource(sourceId, patch) {
  const id = cleanText_(sourceId);
  const sheet = getDatabase_().getSheetByName('sources');
  const count = Math.max(sheet.getLastRow() - 1, 0);
  const rows = count ? sheet.getRange(2, 1, count, getSheetSchemas_().sources.length).getValues() : [];
  const index = rows.findIndex(function(row) { return String(row[SOURCE_COLUMNS.source_id]) === id; });
  if (index < 0) throw new Error('source_not_found:' + id);
  const current = rowToSource_(rows[index]);
  const next = Object.assign({}, current, patch || {});
  const name = cleanText_(next.name);
  if (!name) throw new Error('source_name_required');
  const row = [id, name, cleanText_(next.type || 'manual').toLowerCase(), cleanText_(next.description),
    cleanText_(next.status || 'active').toLowerCase(), current.created_at, new Date().toISOString()];
  sheet.getRange(index + 2, 1, 1, row.length).setValues([row]);
  return rowToSource_(row);
}

function setSourceArchived(sourceId, archived) {
  return updateSource(sourceId, { status: archived ? 'archived' : 'active' });
}
