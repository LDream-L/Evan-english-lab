const SHEET_SCHEMAS = Object.freeze({
  meta: ['key', 'value', 'updated_at'],
  settings: ['key', 'value', 'updated_at'],
  sources: ['source_id', 'name', 'type', 'description', 'status', 'created_at', 'updated_at'],
  words: ['word_id', 'lemma', 'normalized_lemma', 'primary_meaning_zh', 'pos', 'source_id', 'priority', 'status', 'enrichment_status', 'created_at', 'updated_at', 'row_version'],
  word_details: ['detail_id', 'word_id', 'detail_type', 'value', 'language', 'sort_order', 'provenance_type', 'provenance_ref', 'generator_version', 'confidence', 'validation_status', 'created_at', 'updated_at'],
  cards: ['card_id', 'word_id', 'card_type', 'prompt_language', 'answer_language', 'status', 'introduced_at', 'created_at', 'updated_at'],
  reviews: ['review_id', 'idempotency_key', 'session_id', 'card_id', 'word_id', 'review_type', 'rating', 'result', 'response_ms', 'answer', 'reviewed_at', 'previous_due', 'scheduled_days', 'elapsed_days', 'algorithm_version', 'created_at'],
  memory_state: ['card_id', 'state', 'difficulty', 'stability', 'due_at', 'last_review_at', 'scheduled_days', 'elapsed_days', 'reps', 'lapses', 'learning_step', 'last_rating', 'algorithm_version', 'row_version', 'updated_at'],
  daily_sessions: ['session_id', 'study_date', 'planned_minutes', 'status', 'overdue_count', 'due_count', 'weak_count', 'new_count', 'queue_json', 'started_at', 'completed_at', 'updated_at'],
  import_jobs: ['import_id', 'source_id', 'filename', 'status', 'total_rows', 'inserted_rows', 'updated_rows', 'skipped_rows', 'error_rows', 'cursor_row', 'error_summary', 'created_at', 'completed_at'],
  article_sources: ['article_id', 'title', 'url', 'source_type', 'language', 'content_hash', 'copyright_policy', 'status', 'created_at', 'processed_at'],
  word_occurrences: ['occurrence_id', 'article_id', 'word_id', 'surface_form', 'sentence_excerpt', 'position_index', 'selection_reason', 'selected', 'created_at'],
  enrichment_jobs: ['job_id', 'word_id', 'occurrence_id', 'task_type', 'provider', 'provider_version', 'prompt_version', 'status', 'confidence', 'output_json', 'error_message', 'created_at', 'completed_at']
});

/**
 * 建立或修補所有資料表，只新增缺少的表與首列，不刪除既有資料。
 * 時間複雜度：O(s × c)，s 為工作表數，c 為每表欄位數。
 * 空間複雜度：O(c)。
 * 更快替代：固定 schema 下可假設表已存在而跳過檢查，但會失去可重跑與修復能力；M0 選擇安全的冪等初始化。
 */
function ensureSchema_(spreadsheet) {
  const now = new Date().toISOString();
  Object.keys(SHEET_SCHEMAS).forEach(function(sheetName) {
    const headers = SHEET_SCHEMAS[sheetName];
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) sheet = spreadsheet.insertSheet(sheetName);

    const existingWidth = Math.max(sheet.getLastColumn(), headers.length);
    const existing = sheet.getRange(1, 1, 1, existingWidth).getValues()[0];
    const isEmpty = existing.every(function(value) { return value === ''; });
    if (isEmpty) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      return;
    }

    const actual = existing.slice(0, headers.length);
    if (JSON.stringify(actual) !== JSON.stringify(headers)) {
      throw new Error('Schema mismatch: ' + sheetName + '. 請先執行資料遷移，不可直接覆寫首列。');
    }
  });

  upsertKeyValueRows_(spreadsheet.getSheetByName('meta'), {
    schema_version: String(APP_CONFIG.schemaVersion),
    app_name: APP_CONFIG.appName
  }, now);
  upsertKeyValueRows_(spreadsheet.getSheetByName('settings'), APP_CONFIG.defaultSettings, now);
}
