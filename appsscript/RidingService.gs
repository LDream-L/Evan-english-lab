const RIDING_AUDIO_DEFAULTS = Object.freeze({
  target_minutes: 35,
  speech_rate: 0.9,
  max_passes: 3,
  max_words: 500
});

function normalizeRidingOptions_(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    target_minutes: Math.min(Math.max(Number(source.target_minutes) || RIDING_AUDIO_DEFAULTS.target_minutes, 5), 60),
    speech_rate: Math.min(Math.max(Number(source.speech_rate) || RIDING_AUDIO_DEFAULTS.speech_rate, 0.8), 1.1),
    max_passes: Math.min(Math.max(Math.floor(Number(source.max_passes) || RIDING_AUDIO_DEFAULTS.max_passes), 1), 3),
    max_words: Math.min(Math.max(Math.floor(Number(source.max_words) || RIDING_AUDIO_DEFAULTS.max_words), 1), 500)
  };
}

function estimateRidingSpeechSeconds_(text, language, rate) {
  const value = cleanText_(text);
  if (!value) return 0;
  const perMinute = language === 'zh-TW' ? 240 : 135;
  const units = language === 'zh-TW'
    ? value.replace(/[\s，。！？；：、,.!?;:]/g, '').length
    : value.split(/\s+/).filter(Boolean).length;
  return Math.max(0.8, units / (perMinute * rate / 60));
}

function estimateRidingItemSeconds_(item, rate) {
  return 5
    + estimateRidingSpeechSeconds_(item.lemma, 'en-US', rate) * 3
    + estimateRidingSpeechSeconds_(item.primary_meaning_zh, 'zh-TW', rate)
    + estimateRidingSpeechSeconds_(item.context, 'en-US', rate);
}

function priorityRank_(value) {
  return { high: 0, normal: 1, low: 2 }[String(value || '').toLowerCase()] ?? 1;
}

/**
 * 依最長時間、可用單字量與重播上限建立音訊清單。
 * 時間複雜度：O(n log n + n × p)，p 最多為 3。
 * 空間複雜度：O(n × p)。
 */
function buildRidingPlaylist_(items, rawOptions) {
  const options = normalizeRidingOptions_(rawOptions);
  const targetSeconds = options.target_minutes * 60;
  const candidates = (Array.isArray(items) ? items : []).filter(function(item) {
    return item && item.word_id && cleanText_(item.lemma) && cleanText_(item.primary_meaning_zh);
  }).slice(0, options.max_words);
  candidates.sort(function(a, b) {
    const priority = priorityRank_(a.priority) - priorityRank_(b.priority);
    if (priority) return priority;
    return String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
      || String(a.lemma).localeCompare(String(b.lemma), 'en');
  });

  const playlist = [];
  let estimatedSeconds = 0;
  for (let pass = 1; pass <= options.max_passes; pass += 1) {
    let addedThisPass = 0;
    const offset = candidates.length ? ((pass - 1) * Math.ceil(candidates.length / options.max_passes)) % candidates.length : 0;
    for (let index = 0; index < candidates.length; index += 1) {
      const item = candidates[(index + offset) % candidates.length];
      const seconds = estimateRidingItemSeconds_(item, options.speech_rate);
      if (playlist.length && estimatedSeconds + seconds > targetSeconds) continue;
      playlist.push({
        word_id: String(item.word_id),
        lemma: cleanText_(item.lemma),
        primary_meaning_zh: cleanText_(item.primary_meaning_zh),
        context: cleanText_(item.context).slice(0, 140),
        pass_number: pass,
        estimated_seconds: Math.round(seconds * 10) / 10
      });
      estimatedSeconds += seconds;
      addedThisPass += 1;
      if (estimatedSeconds >= targetSeconds) break;
    }
    if (!addedThisPass || estimatedSeconds >= targetSeconds) break;
  }

  return {
    target_minutes: options.target_minutes,
    estimated_seconds: Math.round(estimatedSeconds),
    estimated_minutes: Math.round(estimatedSeconds / 6) / 10,
    available_word_count: candidates.length,
    unique_word_count: new Set(playlist.map(function(item) { return item.word_id; })).size,
    exposure_count: playlist.length,
    ended_early: estimatedSeconds < targetSeconds * 0.9,
    options: options,
    items: playlist
  };
}

/**
 * 回傳騎乘音訊清單。只讀資料，不把播放視為正式作答。
 * 第一版以高優先度及近期更新的 active 單字排序；M4 再接入到期與弱項權重。
 */
function getRidingAudioPlaylist(options) {
  const words = loadWordTable_().rows.map(rowToWord_).filter(function(word) {
    return String(word.status) === 'active';
  });
  const detailRows = readTable_('word_details').filter(function(detail) {
    return String(detail.validation_status || 'verified') !== 'rejected';
  });
  const detailsByWord = new Map();
  detailRows.forEach(function(detail) {
    const id = String(detail.word_id);
    if (!detailsByWord.has(id)) detailsByWord.set(id, { collocations: [], examples: [] });
    const bucket = detailsByWord.get(id);
    if (String(detail.detail_type) === 'collocation') bucket.collocations.push(detail);
    if (String(detail.detail_type) === 'example_en') bucket.examples.push(detail);
  });
  const items = words.map(function(word) {
    const details = detailsByWord.get(String(word.word_id)) || { collocations: [], examples: [] };
    const ordered = details.collocations.concat(details.examples).sort(function(a, b) {
      return Number(a.sort_order || 0) - Number(b.sort_order || 0);
    });
    return {
      word_id: word.word_id,
      lemma: word.lemma,
      primary_meaning_zh: word.primary_meaning_zh,
      priority: word.priority,
      updated_at: word.updated_at,
      context: ordered.length ? ordered[0].value : ''
    };
  });
  return buildRidingPlaylist_(items, options);
}
