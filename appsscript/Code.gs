/**
 * Web App 入口。
 * 時間複雜度：O(1)。
 * 空間複雜度：O(1)。
 * 更快替代：靜態託管可降低 HTML Service 啟動成本；V1 為避免跨網域驗證與 CORS，採同一 Apps Script Web App。
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(APP_CONFIG.appName)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * include CSS/JS HTML 片段。
 * 時間複雜度：O(k)，k 為片段字元數。
 * 空間複雜度：O(k)。
 * 更快替代：全部內嵌 Index 可省 include，但可維護性差；部署後模板只在載入頁面時解析一次。
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * 首次建立專案資料表。使用 ScriptLock 避免重複初始化互撞。
 * 時間複雜度：O(s × c)。
 * 空間複雜度：O(c)。
 * 更快替代：手動建表沒有程式迴圈，但不可重現也容易欄位漂移；採程式化 schema。
 */
function setupProject() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureSchema_(getDatabase_());
    return healthCheck();
  } finally {
    lock.releaseLock();
  }
}

/**
 * 驗證設定與各工作表首列。
 * 時間複雜度：O(s × c)。
 * 空間複雜度：O(s)。
 * 更快替代：只讀 meta 的 schema_version 更快，但無法偵測工作表遭手動改欄位；健康檢查保留完整驗證。
 */
function healthCheck() {
  const spreadsheet = getDatabase_();
  const problems = [];
  Object.keys(SHEET_SCHEMAS).forEach(function(sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      problems.push('missing:' + sheetName);
      return;
    }
    const expected = SHEET_SCHEMAS[sheetName];
    const actual = sheet.getRange(1, 1, 1, expected.length).getValues()[0];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) problems.push('header:' + sheetName);
  });
  return {
    ok: problems.length === 0,
    appName: APP_CONFIG.appName,
    schemaVersion: APP_CONFIG.schemaVersion,
    spreadsheetId: spreadsheet.getId(),
    problems: problems
  };
}

/**
 * 提供首頁最小啟動資料，M5 再換成正式統計查詢。
 * 時間複雜度：O(1)。
 * 空間複雜度：O(1)。
 * 更快替代：將固定資料直接寫在前端可少一次 RPC，但無法同時驗證後端連線；M0 刻意保留健康檢查。
 */
function getBootstrapData() {
  const health = healthCheck();
  return {
    appName: APP_CONFIG.appName,
    version: 'v0.1.1-m0',
    health: health,
    dashboard: {
      plannedMinutes: 20,
      overdue: 0,
      due: 0,
      weak: 0,
      newWords: 0,
      memoryLoad: '尚未建立資料'
    }
  };
}
