const ARTICLE_STOP_WORDS = Object.freeze(new Set([
  'a','about','after','again','all','also','am','an','and','any','are','as','at','be','because','been','before','being','between','both','but','by','can','could','did','do','does','doing','down','during','each','few','for','from','further','had','has','have','having','he','her','here','hers','herself','him','himself','his','how','i','if','in','into','is','it','its','itself','just','me','more','most','my','myself','no','nor','not','now','of','off','on','once','only','or','other','our','ours','ourselves','out','over','own','same','she','should','so','some','such','than','that','the','their','theirs','them','themselves','then','there','these','they','this','those','through','to','too','under','until','up','very','was','we','were','what','when','where','which','while','who','whom','why','will','with','would','you','your','yours','yourself','yourselves'
]));

const TOEIC_SIGNAL_WORDS = Object.freeze(new Set([
  'account','agenda','applicant','appointment','approve','budget','candidate','client','conference','confirm','contract','deadline','delivery','department','discount','employee','equipment','expense','facility','feedback','guarantee','invoice','itinerary','maintenance','manager','meeting','negotiate','order','payment','policy','postpone','purchase','receipt','recruit','refund','reimburse','renovation','reservation','schedule','shipment','supplier','survey','training','venue','warranty'
]));

/**
 * 驗證公開 HTTP(S) 網址並拒絕本機、私有網段及憑證內嵌。
 * 時間複雜度：O(k)，空間複雜度：O(k)，k 為網址長度。
 * 更快替代：只檢查字首成本較低但無法阻擋私有主機；採 URL 解析與 deny-list。
 */
function validateArticleUrl_(value) {
  const raw = cleanText_(value);
  if (!raw) return '';
  const match = raw.match(/^(https?):\/\/([^\/?#]+)([^\s]*)$/i);
  if (!match) throw new Error(/^\w+:/.test(raw) ? 'article_url_protocol' : 'article_url_invalid');
  const authority = match[2];
  if (authority.includes('@')) throw new Error('article_url_credentials');
  const host = (authority[0] === '[' ? authority.slice(1, authority.indexOf(']')) : authority.split(':')[0]).toLowerCase();
  const forbidden = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|::1$|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:)/i;
  const private172 = /^172\.(1[6-9]|2\d|3[01])\./;
  if (!host || forbidden.test(host) || private172.test(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('article_url_private_host');
  }
  return raw;
}

function articleUrlParts_(url) {
  const match = String(url).match(/^(https?):\/\/([^\/?#]+)([^?#]*)/i);
  return { scheme: match[1].toLowerCase(), authority: match[2], path: match[3] || '/' };
}

function resolveArticleRedirect_(location, currentUrl) {
  const target = cleanText_(location);
  if (/^https?:\/\//i.test(target)) return target;
  const current = articleUrlParts_(currentUrl);
  if (target.indexOf('//') === 0) return current.scheme + ':' + target;
  if (target[0] === '/') return current.scheme + '://' + current.authority + target;
  const basePath = current.path.slice(0, current.path.lastIndexOf('/') + 1);
  return current.scheme + '://' + current.authority + basePath + target;
}

function decodeHtmlEntities_(text) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(text || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, function(match, key) {
    const normalized = key.toLowerCase();
    if (normalized[0] === '#') {
      const hexadecimal = normalized[1] === 'x';
      const value = parseInt(normalized.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return Object.prototype.hasOwnProperty.call(entities, normalized) ? entities[normalized] : match;
  });
}

function htmlToArticleText_(html) {
  return decodeHtmlEntities_(String(html || '')
    .replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|article|section|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 逐次處理 redirect，確保每個 Location 都重新通過公開網址驗證。
 * 時間複雜度：O(r + k)，空間複雜度：O(k)，r 最多 4 次請求。
 * 更快替代：followRedirects=true 可少寫迴圈，但無法驗證重新導向目標；安全優先採顯式處理。
 */
function fetchArticleText_(value) {
  let url = validateArticleUrl_(value);
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const response = UrlFetchApp.fetch(url, {
      followRedirects: false,
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Evan-English-Lab/0.2 (+personal-study)' }
    });
    const status = response.getResponseCode();
    if (status >= 300 && status < 400) {
      const location = response.getHeaders().Location || response.getHeaders().location;
      if (!location) throw new Error('article_redirect_missing');
      url = validateArticleUrl_(resolveArticleRedirect_(String(location), url));
      continue;
    }
    if (status < 200 || status >= 300) throw new Error('article_fetch_http_' + status);
    const headers = response.getHeaders();
    const contentType = String(headers['Content-Type'] || headers['content-type'] || '').toLowerCase();
    const body = response.getContentText();
    return { url: url, text: contentType.includes('html') || /<html[\s>]/i.test(body) ? htmlToArticleText_(body) : body };
  }
  throw new Error('article_redirect_limit');
}

function normalizeArticleInput_(input) {
  const source = input && typeof input === 'object' ? input : {};
  const suppliedText = String(source.text || '').trim();
  let resolvedUrl = validateArticleUrl_(source.url);
  let text = suppliedText;
  if (!text && resolvedUrl) {
    const fetched = fetchArticleText_(resolvedUrl);
    resolvedUrl = fetched.url;
    text = fetched.text;
  }
  text = String(text || '').normalize('NFKC').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();
  if (!text) throw new Error('article_text_required');
  if (text.length > APP_CONFIG.articleMaxCharacters) throw new Error('article_too_large:' + APP_CONFIG.articleMaxCharacters);
  return {
    title: cleanText_(source.title || (resolvedUrl ? articleUrlParts_(resolvedUrl).authority : '貼上文章')),
    url: resolvedUrl,
    source_type: resolvedUrl ? 'url' : cleanText_(source.source_type || 'pasted_text'),
    language: 'en',
    text: text
  };
}

function articleHash_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  return bytes.map(function(value) { return ('0' + ((value + 256) % 256).toString(16)).slice(-2); }).join('');
}

function candidateLemma_(surface) {
  const word = normalizeLemma_(surface).replace(/^['-]+|['-]+$/g, '');
  if (word.length > 4 && /ies$/.test(word)) return word.slice(0, -3) + 'y';
  if (word.length > 4 && /(ches|shes|xes|zes|ses)$/.test(word)) return word.slice(0, -2);
  if (word.length > 4 && /s$/.test(word) && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

function sentenceExcerptAt_(text, index) {
  const left = Math.max(text.lastIndexOf('.', index), text.lastIndexOf('!', index), text.lastIndexOf('?', index), text.lastIndexOf('\n', index));
  const endings = [text.indexOf('.', index), text.indexOf('!', index), text.indexOf('?', index), text.indexOf('\n', index)].filter(function(value) { return value >= 0; });
  const right = endings.length ? Math.min.apply(null, endings) + 1 : text.length;
  return cleanText_(text.slice(left + 1, right)).slice(0, 360);
}

/**
 * 單次掃描英文 token，使用 Map 聚合次數與第一個語境。
 * 時間複雜度：O(k + u log u)，空間複雜度：O(u)，u 為不同候選字數。
 * 更快替代：不排序可做到 O(k)，但無法輸出穩定優先順序；個人文章規模採一次排序。
 */
function extractArticleCandidates_(text, existingWords, masteredWordIds, limit) {
  const existingByLemma = new Map();
  (existingWords || []).forEach(function(word) {
    existingByLemma.set(normalizeLemma_(word.normalized_lemma || word.lemma), word);
  });
  const mastered = masteredWordIds instanceof Set ? masteredWordIds : new Set(masteredWordIds || []);
  const byLemma = new Map();
  const tokenPattern = /[A-Za-z][A-Za-z'-]{2,}/g;
  let match;
  while ((match = tokenPattern.exec(text)) !== null) {
    const surface = match[0];
    const lemma = candidateLemma_(surface);
    if (!lemma || ARTICLE_STOP_WORDS.has(lemma)) continue;
    const current = byLemma.get(lemma) || { lemma: lemma, surface_form: surface, frequency: 0, position_index: match.index, sentence_excerpt: sentenceExcerptAt_(text, match.index) };
    current.frequency += 1;
    byLemma.set(lemma, current);
  }
  const exclusions = { stop_or_short: 0, existing_word: 0, mastered: 0 };
  const candidates = [];
  byLemma.forEach(function(candidate) {
    const existing = existingByLemma.get(candidate.lemma);
    if (existing && mastered.has(String(existing.word_id))) {
      exclusions.mastered += 1;
      return;
    }
    if (existing) {
      exclusions.existing_word += 1;
      return;
    }
    const toeic = TOEIC_SIGNAL_WORDS.has(candidate.lemma);
    candidate.toeic_signal = toeic;
    candidate.score = Math.min(100, 20 + Math.min(candidate.lemma.length, 12) + Math.min(candidate.frequency * 8, 32) + (toeic ? 36 : 0));
    candidate.selection_reason = (toeic ? 'TOEIC高相關；' : '') + '出現' + candidate.frequency + '次；尚未收錄';
    candidate.selected = candidate.score >= 40;
    candidates.push(candidate);
  });
  candidates.sort(function(a, b) { return b.score - a.score || b.frequency - a.frequency || a.lemma.localeCompare(b.lemma, 'en'); });
  return { candidates: candidates.slice(0, Math.min(Number(limit) || APP_CONFIG.articleCandidateLimit, APP_CONFIG.articleCandidateLimit)), exclusions: exclusions, uniqueTokens: byLemma.size };
}

function loadMasteredWordIds_() {
  const cardToWord = new Map();
  readTable_('cards').forEach(function(card) { cardToWord.set(String(card.card_id), String(card.word_id)); });
  const mastered = new Set();
  readTable_('memory_state').forEach(function(state) {
    if (String(state.state) === 'review' && Number(state.stability || 0) >= 30 && cardToWord.has(String(state.card_id))) {
      mastered.add(cardToWord.get(String(state.card_id)));
    }
  });
  return mastered;
}

function previewArticleImport(input) {
  const article = normalizeArticleInput_(input);
  const analysis = extractArticleCandidates_(article.text, loadWordTable_().rows.map(rowToWord_), loadMasteredWordIds_(), APP_CONFIG.articleCandidateLimit);
  return {
    article: { title: article.title, url: article.url, source_type: article.source_type, character_count: article.text.length, content_hash: articleHash_(article.text) },
    candidates: analysis.candidates,
    exclusions: analysis.exclusions,
    unique_tokens: analysis.uniqueTokens
  };
}

function objectRow_(headers, record) {
  return headers.map(function(header) { return record[header] == null ? '' : record[header]; });
}

/**
 * 重新分析原文並只接受本次候選清單中的勾選項，避免竄改 lemma/excerpt。
 * 時間複雜度：O(k + w + j)，空間複雜度：O(u + w + j)。
 * 更快替代：信任前端預覽可省第二次分析，但會允許偽造內容；後端重算以資料完整性優先。
 */
function queueArticleImport(input, selectedLemmas) {
  const article = normalizeArticleInput_(input);
  const analysis = extractArticleCandidates_(article.text, loadWordTable_().rows.map(rowToWord_), loadMasteredWordIds_(), APP_CONFIG.articleCandidateLimit);
  const allowed = new Map(analysis.candidates.map(function(candidate) { return [candidate.lemma, candidate]; }));
  const selected = Array.from(new Set((selectedLemmas || []).map(candidateLemma_))).filter(function(lemma) { return allowed.has(lemma); });
  if (!selected.length) throw new Error('article_candidates_required');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const database = getDatabase_();
    const now = new Date().toISOString();
    const hash = articleHash_(article.text);
    const articles = readTable_('article_sources');
    let stored = articles.find(function(item) { return String(item.content_hash) === hash; });
    const articleId = stored ? String(stored.article_id) : 'a_' + Utilities.getUuid().replace(/-/g, '');
    if (!stored) {
      database.getSheetByName('article_sources').appendRow(objectRow_(getSheetSchemas_().article_sources, {
        article_id: articleId, title: article.title, url: article.url, source_type: article.source_type, language: 'en',
        content_hash: hash, copyright_policy: 'excerpt_only', status: 'queued', created_at: now
      }));
    }
    const sources = readTable_('sources');
    if (!sources.some(function(source) { return String(source.source_id) === articleId; })) {
      database.getSheetByName('sources').appendRow(objectRow_(getSheetSchemas_().sources, {
        source_id: articleId, name: article.title, type: 'article', description: article.url || '貼上文章（僅保存必要摘錄）', status: 'active', created_at: now, updated_at: now
      }));
    }
    const existingOccurrences = readTable_('word_occurrences');
    const occurrenceKeys = new Set(existingOccurrences.map(function(item) { return String(item.article_id) + '\u001f' + normalizeLemma_(item.surface_form); }));
    const existingJobs = new Set(readTable_('enrichment_jobs').map(function(item) { return String(item.idempotency_key); }));
    const occurrenceRows = [];
    const jobRows = [];
    selected.forEach(function(lemma) {
      const candidate = allowed.get(lemma);
      const occurrenceKey = articleId + '\u001f' + lemma;
      if (occurrenceKeys.has(occurrenceKey)) return;
      const occurrenceId = 'o_' + Utilities.getUuid().replace(/-/g, '');
      const idempotencyKey = 'enrich:' + hash + ':' + lemma;
      occurrenceRows.push(objectRow_(getSheetSchemas_().word_occurrences, {
        occurrence_id: occurrenceId, article_id: articleId, surface_form: candidate.surface_form, sentence_excerpt: candidate.sentence_excerpt,
        position_index: candidate.position_index, selection_reason: candidate.selection_reason, selected: true, created_at: now
      }));
      if (!existingJobs.has(idempotencyKey)) jobRows.push(objectRow_(getSheetSchemas_().enrichment_jobs, {
        job_id: 'ej_' + Utilities.getUuid().replace(/-/g, ''), occurrence_id: occurrenceId, task_type: 'lexical_enrichment',
        provider: APP_CONFIG.enrichmentProvider, provider_version: APP_CONFIG.enrichmentModel, prompt_version: 'm1a-v1', status: 'queued',
        created_at: now, idempotency_key: idempotencyKey, attempt_count: 0, updated_at: now
      }));
    });
    if (occurrenceRows.length) database.getSheetByName('word_occurrences').getRange(database.getSheetByName('word_occurrences').getLastRow() + 1, 1, occurrenceRows.length, getSheetSchemas_().word_occurrences.length).setValues(occurrenceRows);
    if (jobRows.length) database.getSheetByName('enrichment_jobs').getRange(database.getSheetByName('enrichment_jobs').getLastRow() + 1, 1, jobRows.length, getSheetSchemas_().enrichment_jobs.length).setValues(jobRows);
    return { article_id: articleId, queued: jobRows.length, already_present: selected.length - occurrenceRows.length, provider: getEnrichmentProviderStatus() };
  } finally {
    lock.releaseLock();
  }
}
