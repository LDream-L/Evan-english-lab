# Database Schema v3

## 關係

```text
sources 1 ── N words 1 ── N word_details
                    └── 1 ── N cards 1 ── 1 memory_state
                                      └── N reviews
daily_sessions 1 ── N reviews
import_jobs N ── 1 sources
import_jobs 1 ── N import_staging
article_sources 1 ── N word_occurrences N ── 1 words
words 1 ── N enrichment_jobs
```

## 關鍵約束

- 所有 ID 為不可變字串；顯示順序或 Sheet row number 不可當主鍵。
- `words.normalized_lemma + pos` 為預設重複判斷鍵，不直接設為不可更改的唯一鍵。
- `cards` 才是排程單位；`memory_state.card_id` 唯一。
- `reviews.idempotency_key` 唯一，避免前端重送。
- `reviews` append-only；`memory_state` 原地更新並增加 `row_version`。
- `retrievability` 由 stability 與經過時間計算，不保存成會快速過期的當前欄位。
- 自動產生的翻譯、例句、搭配詞必須保存來源、產生器版本、信心分數與驗證狀態，不能偽裝成人工確認資料。
- 文章原則上只保存 URL、內容雜湊與必要短句，不複製整篇受著作權保護文章。
- 日期一律保存 ISO 8601 完整時間；顯示時轉 Asia/Taipei。
- 刪除單字採 `status=archived`，避免 review 外鍵失效。
- `import_staging` 保存每列正規化後 payload、預覽分類與處理結果；瀏覽器關閉後仍可依 `import_id` 續跑。
- schema v2→v3 只在 `import_jobs` 末端新增 `options_json`，並新增 `import_staging`；不移動既有欄位。

## 詳細資料表

實際表頭以 `appsscript/Schema.gs` 的 `SHEET_SCHEMAS` 為唯一機器可執行定義。文件不得獨立修改表頭；變更需提高 schema version 並寫 migration。

## 未來 TOEIC 模組（Vocabulary v1.0 後建立）

- `grammar_topics`：文法單元、先備關係、難度與版本。
- `grammar_lessons`：觀念、例句、常見陷阱與來源。
- `questions`：原創題目、Part、文法標籤、難度、狀態與版本。
- `question_choices`：選項、正確答案與干擾類型。
- `question_explanations`：解析、翻譯、解題技巧與來源。
- `question_attempts`：答案、時間、正誤、能力估計前後值。
- `weakness_state`：依 Part、文法主題及錯誤類型彙整弱項。

題庫內容不得從刷刷庫或其他商業產品複製；只參考功能流程，題目需為自建、合法授權或可合法使用來源。
