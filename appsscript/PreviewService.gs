const PREVIEW_CHOICES_ = Object.freeze(['know', 'familiar', 'new']);

function parsePreviewQueue_(value) {
  try {
    const data = JSON.parse(String(value || ''));
    if (data.kind !== 'preview_v1' || !Array.isArray(data.items)) return null;
    if (!Number.isInteger(data.cursor) || data.cursor < 0 || data.cursor > data.items.length) return null;
    return data;
  } catch (error) { return null; }
}

function latestPreviewRow_(rows) {
  const candidates = rows.filter(function(row) {
    return ['preview_active', 'preview_completed'].includes(String(row.status)) && parsePreviewQueue_(row.queue_json);
  });
  return candidates.length ? candidates[candidates.length - 1] : null;
}

function previewSnapshot_(row) {
  if (!row) return null;
  const queue = parsePreviewQueue_(row.queue_json);
  if (!queue) throw new Error('預習資料損壞，請聯絡管理員。');
  const counts = { know: 0, familiar: 0, new: 0 };
  queue.items.forEach(function(item) { if (PREVIEW_CHOICES_.includes(item.choice)) counts[item.choice] += 1; });
  const snapshot = {
    session_id: String(row.session_id), status: String(row.status),
    cursor: queue.cursor, total: queue.items.length, counts: counts, current: null
  };
  if (queue.cursor >= queue.items.length) return snapshot;
  const wordId = String(queue.items[queue.cursor].word_id);
  const word = loadWordTable_().rows.map(rowToWord_).find(function(item) { return String(item.word_id) === wordId; });
  if (!word || String(word.status) !== 'active') {
    snapshot.current = { word_id: wordId, unavailable: true };
    return snapshot;
  }
  const details = readTable_('word_details').filter(function(item) {
    return String(item.word_id) === wordId && String(item.validation_status) !== 'rejected';
  }).sort(function(a, b) { return Number(a.sort_order || 0) - Number(b.sort_order || 0); });
  const firstDetail = function(type) {
    const found = details.find(function(item) { return String(item.detail_type) === type; });
    return found ? cleanText_(found.value).slice(0, 240) : '';
  };
  const source = readTable_('sources').find(function(item) { return String(item.source_id) === String(word.source_id); });
  const occurrence = readTable_('word_occurrences').find(function(item) {
    return String(item.word_id) === wordId && cleanText_(item.sentence_excerpt);
  });
  let article = null;
  if (occurrence) article = readTable_('article_sources').find(function(item) {
    return String(item.article_id) === String(occurrence.article_id);
  });
  const articleUrl = article && cleanText_(article.url);
  snapshot.current = {
    word_id: wordId, lemma: cleanText_(word.lemma),
    meaning: cleanText_(word.primary_meaning_zh), pos: cleanText_(word.pos),
    collocation: firstDetail('collocation'), example: firstDetail('example_en'),
    source_name: source ? cleanText_(source.name).slice(0, 100) : '',
    sentence_excerpt: occurrence ? cleanText_(occurrence.sentence_excerpt).slice(0, 220) : '',
    article_title: article ? cleanText_(article.title).slice(0, 100) : '',
    article_url: articleUrl && /^https:\/\/[^\s]+$/i.test(articleUrl) ? articleUrl.slice(0, 1000) : ''
  };
  return snapshot;
}

/** 只讀取現有資料，不呼叫 AI，也不建立 reviews 或更動記憶排程。 */
function getLatestPreviewSession() {
  return previewSnapshot_(latestPreviewRow_(readTable_('daily_sessions')));
}

/** 建立可跨頁續做的文字預習；已進行中的 session 直接續做。 */
function startPreviewSession(requestedCount) {
  const count = Math.min(20, Math.max(1, Math.floor(Number(requestedCount) || 10)));
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const rows = readTable_('daily_sessions');
    const existing = latestPreviewRow_(rows);
    if (existing && String(existing.status) === 'preview_active') return previewSnapshot_(existing);
    const exposure = new Map();
    rows.forEach(function(row) {
      const queue = parsePreviewQueue_(row.queue_json);
      if (!queue) return;
      queue.items.forEach(function(item) {
        if (PREVIEW_CHOICES_.includes(item.choice)) exposure.set(String(item.word_id), (exposure.get(String(item.word_id)) || 0) + 1);
      });
    });
    const words = loadWordTable_().rows.map(rowToWord_).filter(function(word) {
      return String(word.status) === 'active' && cleanText_(word.primary_meaning_zh);
    });
    words.sort(function(a, b) {
      return (exposure.get(String(a.word_id)) || 0) - (exposure.get(String(b.word_id)) || 0)
        || priorityRank_(a.priority) - priorityRank_(b.priority)
        || String(a.lemma).localeCompare(String(b.lemma), 'en');
    });
    const items = words.slice(0, count).map(function(word) { return { word_id: String(word.word_id), choice: null }; });
    if (!items.length) throw new Error('目前沒有可預習的啟用單字。');
    const now = new Date().toISOString();
    const sessionId = Utilities.getUuid();
    const sheet = getDatabase_().getSheetByName('daily_sessions');
    const values = {
      session_id: sessionId, study_date: Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'),
      planned_minutes: 0, status: 'preview_active', overdue_count: 0, due_count: 0,
      weak_count: 0, new_count: items.length,
      queue_json: JSON.stringify({ kind: 'preview_v1', cursor: 0, items: items }),
      started_at: now, completed_at: '', updated_at: now
    };
    sheet.appendRow(getSheetSchemas_().daily_sessions.map(function(header) { return values[header]; }));
    return previewSnapshot_(values);
  } finally { lock.releaseLock(); }
}

/** 三分類僅保存預習選擇，不等於答對、掌握或 FSRS rating。 */
function submitPreviewChoice(sessionId, wordId, choice) {
  if (!PREVIEW_CHOICES_.includes(choice)) throw new Error('invalid_preview_choice');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getDatabase_().getSheetByName('daily_sessions');
    const rows = readTable_('daily_sessions');
    const index = rows.findIndex(function(row) { return String(row.session_id) === String(sessionId); });
    if (index < 0) throw new Error('preview_session_not_found');
    const row = rows[index];
    const queue = parsePreviewQueue_(row.queue_json);
    if (!queue) throw new Error('preview_session_invalid');
    const previous = queue.items.find(function(item) { return String(item.word_id) === String(wordId) && item.choice; });
    if (previous) {
      if (previous.choice !== choice) throw new Error('preview_choice_conflict');
      return previewSnapshot_(row);
    }
    if (String(row.status) !== 'preview_active' || !queue.items[queue.cursor]
        || String(queue.items[queue.cursor].word_id) !== String(wordId)) throw new Error('preview_position_changed');
    queue.items[queue.cursor].choice = choice;
    queue.cursor += 1;
    const now = new Date().toISOString();
    const columns = getSheetSchemas_().daily_sessions;
    sheet.getRange(index + 2, columns.indexOf('queue_json') + 1).setValue(JSON.stringify(queue));
    sheet.getRange(index + 2, columns.indexOf('updated_at') + 1).setValue(now);
    if (queue.cursor === queue.items.length) {
      row.status = 'preview_completed';
      sheet.getRange(index + 2, columns.indexOf('status') + 1).setValue(row.status);
      sheet.getRange(index + 2, columns.indexOf('completed_at') + 1).setValue(now);
    }
    row.queue_json = JSON.stringify(queue);
    return previewSnapshot_(row);
  } finally { lock.releaseLock(); }
}
