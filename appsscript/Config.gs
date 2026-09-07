const APP_CONFIG = Object.freeze({
  appName: 'Evan TOEIC Lab',
  appVersion: 'v0.2.1-m1a',
  schemaVersion: 4,
  spreadsheetProperty: 'SPREADSHEET_ID',
  importBatchSize: 200,
  maxImportRows: 5000,
  wordSearchLimit: 100,
  articleMaxCharacters: 80000,
  articleCandidateLimit: 120,
  enrichmentBatchSize: 5,
  enrichmentProvider: 'gemini',
  enrichmentModel: 'gemini-2.5-flash-lite',
  defaultSettings: Object.freeze({
    daily_minutes: '20',
    new_words_max: '10',
    target: 'TOEIC',
    target_score: '',
    review_priority: 'high',
    desired_retention: '0.90',
    backlog_new_word_threshold: '20',
    locale: 'zh-TW',
    timezone: 'Asia/Taipei'
  })
});
