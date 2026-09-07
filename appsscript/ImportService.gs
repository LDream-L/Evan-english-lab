const IMPORT_JOB_COLUMNS = Object.freeze(SHEET_SCHEMAS.import_jobs.reduce(function(result, name, index) {
  result[name] = index;
  return result;
}, {}));
const IMPORT_STAGING_COLUMNS = Object.freeze(SHEET_SCHEMAS.import_staging.reduce(function(result, name, index) {
  result[name] = index;
  return result;
}, {}));

function importFingerprint_(value) {
  return [value.normalized_lemma, value.pos, value.primary_meaning_zh, value.source_id, value.priority].join('\u001f');
}

function coerceImportRow_(row, defaultSourceId) {
  if (Array.isArray(row)) {
    return { lemma: row[0], primary_meaning_zh: row[1], pos: row[2], source_id: row[3] || defaultSourceId, priority: row[4] };
  }
  return Object.assign({}, row || {}, { source_id: (row && row.source_id) || defaultSourceId || '' });
}

function wordMatchesImport_(word, value) {
  return importFingerprint_({
    normalized_lemma: normalizeLemma_(word.normalized_lemma || word.lemma),
    pos: normalizePos_(word.pos),
    primary_meaning_zh: cleanText_(word.primary_meaning_zh),
    source_id: cleanText_(word.source_id),
    priority: cleanText_(word.priority || 'normal').toLowerCase()
  }) === importFingerprint_(value);
}

/**
 * 以既有複合鍵 Map 將匯入資料分類為新增、更新、跳過、衝突、錯誤。
 * 時間複雜度：O(m)，m 為匯入列數。
 * 空間複雜度：O(m)。
 * 更快替代：無法低於逐列檢查；相較雙層比對 O(m×n)，Map 將每列查詢維持常數級。
 */
function classifyImportRows_(rows, existingByKey, options) {
  const settings = options && typeof options === 'object' ? options : {};
  const sourceId = cleanText_(settings.source_id);
  const updateExisting = settings.update_existing === true;
  const seen = new Map();
  const summary = { insert: 0, update: 0, skip: 0, conflict: 0, error: 0 };
  const items = (rows || []).map(function(row, index) {
    const checked = validateWordInput_(coerceImportRow_(row, sourceId));
    if (!checked.valid) {
      summary.error += 1;
      return { row_number: index + 1, action: 'error', errors: checked.errors, value: checked.value, fingerprint: '' };
    }
    const value = checked.value;
    const key = buildWordKey_(value.normalized_lemma, value.pos);
    const fingerprint = importFingerprint_(value);
    if (seen.has(key)) {
      const identical = seen.get(key) === fingerprint;
      const action = identical ? 'skip' : 'conflict';
      summary[action] += 1;
      return { row_number: index + 1, action: action, errors: [identical ? 'duplicate_input' : 'conflicting_input'], value: value, fingerprint: fingerprint };
    }
    seen.set(key, fingerprint);
    const existing = existingByKey.get(key);
    if (!existing) {
      summary.insert += 1;
      return { row_number: index + 1, action: 'insert', errors: [], value: value, fingerprint: fingerprint };
    }
    if (wordMatchesImport_(existing, value)) {
      summary.skip += 1;
      return { row_number: index + 1, action: 'skip', errors: ['unchanged'], value: value, fingerprint: fingerprint, word_id: existing.word_id };
    }
    const action = updateExisting ? 'update' : 'conflict';
    summary[action] += 1;
    return { row_number: index + 1, action: action, errors: action === 'conflict' ? ['existing_differs'] : [], value: value, fingerprint: fingerprint, word_id: existing.word_id };
  });
  return { summary: summary, items: items };
}

/**
 * 預覽批次匯入，不寫入任何資料。
 * 時間複雜度：O(n + m)。
 * 空間複雜度：O(n + m)。
 * 更快替代：只抽樣預覽較快但可能漏掉後段衝突；驗收要求全批次可追查，因此完整掃描一次。
 */
function previewWordImport(rows, options) {
  if (!Array.isArray(rows)) throw new Error('import_rows_required');
  if (rows.length > APP_CONFIG.maxImportRows) throw new Error('import_too_large:' + APP_CONFIG.maxImportRows);
  const table = loadWordTable_();
  const existing = new Map();
  table.rows.forEach(function(row) {
    const word = rowToWord_(row);
    existing.set(buildWordKey_(word.normalized_lemma, word.pos), word);
  });
  const result = classifyImportRows_(rows, existing, options);
  return { total: rows.length, summary: result.summary, items: result.items.slice(0, 200), truncated: result.items.length > 200 };
}

/**
 * 建立可續傳匯入工作，將所有輸入列一次寫入 staging。
 * 時間複雜度：O(n + m)。
 * 空間複雜度：O(n + m)。
 * 更快替代：直接寫入 words 可少一次 staging I/O，但中斷後無法續跑或追查錯誤；採持久化 staging。
 */
function startWordImport(request) {
  const payload = request && typeof request === 'object' ? request : {};
  const rows = payload.rows;
  if (!Array.isArray(rows) || !rows.length) throw new Error('import_rows_required');
  if (rows.length > APP_CONFIG.maxImportRows) throw new Error('import_too_large:' + APP_CONFIG.maxImportRows);
  const options = { source_id: cleanText_(payload.source_id), update_existing: payload.update_existing === true };
  const table = loadWordTable_();
  const fullClassification = classifyImportRows_(rows, new Map(table.rows.map(function(row) {
    const word = rowToWord_(row);
    return [buildWordKey_(word.normalized_lemma, word.pos), word];
  })), options);
  const preview = { total: rows.length, summary: fullClassification.summary, items: fullClassification.items.slice(0, 200), truncated: rows.length > 200 };
  const now = new Date().toISOString();
  const importId = 'imp_' + Utilities.getUuid().replace(/-/g, '');
  const jobSheet = getDatabase_().getSheetByName('import_jobs');
  const stagingSheet = getDatabase_().getSheetByName('import_staging');
  const errorCount = fullClassification.summary.error + fullClassification.summary.conflict;
  const jobRow = [importId, options.source_id, cleanText_(payload.filename || 'manual-import'), 'queued', rows.length, 0, 0, 0,
    errorCount, 0, errorCount ? '預覽含衝突或錯誤，處理時將保留錯誤列' : '', now, '', JSON.stringify(options)];
  const stageRows = fullClassification.items.map(function(item) {
    const processable = item.action === 'insert' || item.action === 'update' || item.action === 'skip';
    return [importId, item.row_number, JSON.stringify(item.value), item.fingerprint, item.action, processable ? 'pending' : item.action,
      '', item.errors.join(','), item.word_id || '', '', now];
  });
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    jobSheet.getRange(jobSheet.getLastRow() + 1, 1, 1, jobRow.length).setValues([jobRow]);
    stagingSheet.getRange(stagingSheet.getLastRow() + 1, 1, stageRows.length, SHEET_SCHEMAS.import_staging.length).setValues(stageRows);
  } finally {
    lock.releaseLock();
  }
  return { import_id: importId, status: 'queued', preview: preview };
}

function getImportJobRow_(importId) {
  const sheet = getDatabase_().getSheetByName('import_jobs');
  const count = Math.max(sheet.getLastRow() - 1, 0);
  const rows = count ? sheet.getRange(2, 1, count, SHEET_SCHEMAS.import_jobs.length).getValues() : [];
  const index = rows.findIndex(function(row) { return String(row[IMPORT_JOB_COLUMNS.import_id]) === String(importId); });
  if (index < 0) throw new Error('import_not_found:' + importId);
  return { sheet: sheet, rowNumber: index + 2, row: rows[index] };
}

function importJobToObject_(row) {
  const result = {};
  SHEET_SCHEMAS.import_jobs.forEach(function(header, index) { result[header] = row[index]; });
  return result;
}

function getImportJob(importId) {
  return importJobToObject_(getImportJobRow_(importId).row);
}

/**
 * 尋找最近一筆未完成工作，讓換裝置或 localStorage 遺失時仍可續跑。
 * 時間複雜度：O(j × c)，j 為匯入工作數。
 * 空間複雜度：O(j × c)。
 * 更快替代：另存 active_import_id 可常數查詢，但異常中斷時易留下過期指標；工作數量低，反向掃描較可靠。
 */
function findLatestOpenImportJob() {
  const sheet = getDatabase_().getSheetByName('import_jobs');
  const count = Math.max(sheet.getLastRow() - 1, 0);
  if (!count) return null;
  const rows = sheet.getRange(2, 1, count, SHEET_SCHEMAS.import_jobs.length).getValues();
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const status = String(rows[index][IMPORT_JOB_COLUMNS.status]);
    if (status === 'queued' || status === 'running') return importJobToObject_(rows[index]);
  }
  return null;
}

function groupContiguousIndexes_(indexes) {
  const sorted = Array.from(new Set(indexes)).sort(function(a, b) { return a - b; });
  const groups = [];
  sorted.forEach(function(index) {
    const last = groups[groups.length - 1];
    if (!last || index !== last[last.length - 1] + 1) groups.push([index]);
    else last.push(index);
  });
  return groups;
}

function writeChangedRows_(sheet, allRows, zeroBasedIndexes, width) {
  groupContiguousIndexes_(zeroBasedIndexes).forEach(function(group) {
    const start = group[0];
    const values = allRows.slice(start, start + group.length);
    sheet.getRange(start + 2, 1, values.length, width).setValues(values);
  });
}

/**
 * 處理下一批 staging；更新採連續列分組，新增採單次 append。
 * 時間複雜度：O(n + s + b log b)，n 為 words、s 為 staging、b 為批次。
 * 空間複雜度：O(n + s)。
 * 更快替代：資料庫原生 upsert 可減少整表讀取，但 Google Sheets 不提供；相較逐列 API 呼叫，本方案以批次讀寫降低往返。
 */
function continueWordImport(importId, requestedBatchSize) {
  const batchSize = Math.min(Math.max(Number(requestedBatchSize) || APP_CONFIG.importBatchSize, 1), APP_CONFIG.importBatchSize);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const jobRef = getImportJobRow_(importId);
    const job = importJobToObject_(jobRef.row);
    if (job.status === 'completed') return job;
    const options = JSON.parse(job.options_json || '{}');
    const wordTable = loadWordTable_();
    const existingByKey = new Map();
    wordTable.rows.forEach(function(row, index) {
      const word = rowToWord_(row);
      existingByKey.set(buildWordKey_(word.normalized_lemma, word.pos), { word: word, index: index });
    });

    const stagingSheet = getDatabase_().getSheetByName('import_staging');
    const stagingCount = Math.max(stagingSheet.getLastRow() - 1, 0);
    const stagingRows = stagingCount ? stagingSheet.getRange(2, 1, stagingCount, SHEET_SCHEMAS.import_staging.length).getValues() : [];
    const candidates = [];
    stagingRows.forEach(function(row, index) {
      if (String(row[IMPORT_STAGING_COLUMNS.import_id]) === String(importId) && row[IMPORT_STAGING_COLUMNS.status] === 'pending' && candidates.length < batchSize) {
        candidates.push({ index: index, row: row });
      }
    });

    let inserted = Number(job.inserted_rows) || 0;
    let updated = Number(job.updated_rows) || 0;
    let skipped = Number(job.skipped_rows) || 0;
    let errors = Number(job.error_rows) || 0;
    let cursor = Number(job.cursor_row) || 0;
    const changedWordIndexes = [];
    const changedStageIndexes = [];
    const newRows = [];
    const now = new Date().toISOString();

    candidates.forEach(function(candidate) {
      const stage = candidate.row;
      const value = JSON.parse(stage[IMPORT_STAGING_COLUMNS.payload_json]);
      const checked = validateWordInput_(value);
      cursor = Math.max(cursor, Number(stage[IMPORT_STAGING_COLUMNS.row_number]) || 0);
      let action = '';
      let error = '';
      let wordId = '';
      if (!checked.valid) {
        action = 'error'; error = checked.errors.join(','); errors += 1;
      } else {
        const key = buildWordKey_(checked.value.normalized_lemma, checked.value.pos);
        const existing = existingByKey.get(key);
        if (!existing) {
          wordId = 'w_' + Utilities.getUuid().replace(/-/g, '');
          const row = createWordRow_(checked.value, wordId, now);
          newRows.push(row);
          existingByKey.set(key, { word: rowToWord_(row), index: wordTable.rows.length + newRows.length - 1 });
          action = 'insert'; inserted += 1;
        } else if (wordMatchesImport_(existing.word, checked.value)) {
          wordId = existing.word.word_id;
          action = 'skip'; skipped += 1;
        } else if (options.update_existing === true) {
          wordId = existing.word.word_id;
          const oldRow = wordTable.rows[existing.index];
          if (!oldRow) {
            action = 'conflict'; error = 'duplicate_in_same_batch'; errors += 1;
          } else {
            const next = createWordRow_(checked.value, wordId, existing.word.created_at || now);
            next[WORD_COLUMNS.updated_at] = now;
            next[WORD_COLUMNS.row_version] = Number(existing.word.row_version || 0) + 1;
            wordTable.rows[existing.index] = next;
            existing.word = rowToWord_(next);
            changedWordIndexes.push(existing.index);
            action = 'update'; updated += 1;
          }
        } else {
          wordId = existing.word.word_id;
          action = 'conflict'; error = 'existing_differs'; errors += 1;
        }
      }
      stage[IMPORT_STAGING_COLUMNS.status] = action === 'insert' || action === 'update' || action === 'skip' ? 'processed' : action;
      stage[IMPORT_STAGING_COLUMNS.result_action] = action;
      stage[IMPORT_STAGING_COLUMNS.error_message] = error;
      stage[IMPORT_STAGING_COLUMNS.word_id] = wordId;
      stage[IMPORT_STAGING_COLUMNS.processed_at] = now;
      changedStageIndexes.push(candidate.index);
    });

    if (changedWordIndexes.length) writeChangedRows_(wordTable.sheet, wordTable.rows, changedWordIndexes, SHEET_SCHEMAS.words.length);
    if (newRows.length) wordTable.sheet.getRange(wordTable.sheet.getLastRow() + 1, 1, newRows.length, SHEET_SCHEMAS.words.length).setValues(newRows);
    if (changedStageIndexes.length) writeChangedRows_(stagingSheet, stagingRows, changedStageIndexes, SHEET_SCHEMAS.import_staging.length);

    const hasPending = stagingRows.some(function(row) {
      return String(row[IMPORT_STAGING_COLUMNS.import_id]) === String(importId) && row[IMPORT_STAGING_COLUMNS.status] === 'pending';
    });
    if (!hasPending) cursor = Number(job.total_rows) || cursor;
    jobRef.row[IMPORT_JOB_COLUMNS.status] = hasPending ? 'running' : 'completed';
    jobRef.row[IMPORT_JOB_COLUMNS.inserted_rows] = inserted;
    jobRef.row[IMPORT_JOB_COLUMNS.updated_rows] = updated;
    jobRef.row[IMPORT_JOB_COLUMNS.skipped_rows] = skipped;
    jobRef.row[IMPORT_JOB_COLUMNS.error_rows] = errors;
    jobRef.row[IMPORT_JOB_COLUMNS.cursor_row] = cursor;
    jobRef.row[IMPORT_JOB_COLUMNS.completed_at] = hasPending ? '' : now;
    jobRef.sheet.getRange(jobRef.rowNumber, 1, 1, jobRef.row.length).setValues([jobRef.row]);
    return importJobToObject_(jobRef.row);
  } finally {
    lock.releaseLock();
  }
}
