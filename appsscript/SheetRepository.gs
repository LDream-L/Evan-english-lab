/**
 * 取得正式資料庫試算表。
 * 時間複雜度：O(1)。
 * 空間複雜度：O(1)。
 * 更快替代：使用 active spreadsheet 可少一次屬性讀取，但 standalone Web App 無可靠 active spreadsheet；採 Script Property 較穩定。
 */
function getDatabase_() {
  const id = PropertiesService.getScriptProperties().getProperty(APP_CONFIG.spreadsheetProperty);
  if (!id) throw new Error('缺少 Script Property: ' + APP_CONFIG.spreadsheetProperty);
  return SpreadsheetApp.openById(id);
}

/**
 * 批次新增或更新 key/value 設定。
 * 時間複雜度：O(n + m)，n 為既有列數，m 為輸入鍵數。
 * 空間複雜度：O(n + m)。
 * 更快替代：單鍵更新可直接 TextFinder 搜尋，但多鍵時會產生多次 Sheets 呼叫；採一次讀取、記憶體 Map、一次寫回。
 */
function upsertKeyValueRows_(sheet, values, now) {
  const rowCount = Math.max(sheet.getLastRow() - 1, 0);
  const rows = rowCount ? sheet.getRange(2, 1, rowCount, 3).getValues() : [];
  const indexByKey = new Map();
  rows.forEach(function(row, index) { indexByKey.set(String(row[0]), index); });

  Object.keys(values).forEach(function(key) {
    const nextRow = [key, String(values[key]), now];
    if (indexByKey.has(key)) rows[indexByKey.get(key)] = nextRow;
    else {
      indexByKey.set(key, rows.length);
      rows.push(nextRow);
    }
  });

  if (rows.length) sheet.getRange(2, 1, rows.length, 3).setValues(rows);
}

/**
 * 將表格一次讀入物件陣列，避免逐列呼叫 Sheets API。
 * 時間複雜度：O(r × c)。
 * 空間複雜度：O(r × c)。
 * 更快替代：已知單列位置時可只讀該列；一般查詢採一次批次讀取，M1 再加上 ID→列號索引快取。
 */
function readTable_(sheetName) {
  const sheet = getDatabase_().getSheetByName(sheetName);
  if (!sheet) throw new Error('工作表不存在: ' + sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1).map(function(row) {
    const record = {};
    headers.forEach(function(header, column) { record[header] = row[column]; });
    return record;
  });
}

