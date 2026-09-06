const APP_CONFIG = Object.freeze({
  appName: 'Evan TOEIC Lab',
  schemaVersion: 2,
  spreadsheetProperty: 'SPREADSHEET_ID',
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
