const APP_CONFIG = Object.freeze({
  appName: 'Evan TOEIC Lab',
  appVersion: 'v0.2.0-m1',
  schemaVersion: 3,
  spreadsheetProperty: 'SPREADSHEET_ID',
  importBatchSize: 200,
  maxImportRows: 5000,
  wordSearchLimit: 100,
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
