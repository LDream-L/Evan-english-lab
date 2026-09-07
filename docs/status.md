# 專案進度

更新：2026-09-07

| 階段 | 狀態 | 完成度 | 阻塞 |
|---|---|---:|---|
| M0 專案骨架 | 已完成 | 100% | 無 |
| M1 單字資料庫 | 線上驗收中 | 90% | Apps Script 登入端暫時回傳 502；待同步程式與 Web App 驗收 |
| M1A 文章擷取／自動補全 | 已完成規格 | 15% | 等 M1 資料層與補全服務決策 |
| M2 快速預習 | 未開始 | 0% | 等 M1 |
| M3 正式複習 | 未開始 | 0% | 等 M2 |
| M4 自適應排程 | 未開始 | 0% | 等 M3 |
| M5 Dashboard | 未開始 | 0% | 等 M4 |
| M6 候選版 | 未開始 | 0% | 等 M5 |
| v1.0 正式版 | 未開始 | 0% | 需 14 天實用驗收 |

## 本批已完成

- 實作單字新增、讀取、更新、封存與復原，更新使用 `row_version` 防止舊頁面覆蓋。
- 實作來源新增、更新與封存；單字保存不可變 `source_id` 關聯。
- 實作 NFKC、大小寫、空白與詞性縮寫正規化；重複鍵為 `normalized_lemma + pos`。
- 實作 CSV／TSV 預覽，分類新增、更新、跳過、衝突與錯誤。
- 正式 Google Sheet 已升級至 schema v3，共 14 張表並新增 `import_staging`；每批最多 200 筆，可跨裝置找回未完成工作。
- 新增 ID→列號短期快取，命中後仍驗證實際 ID，避免人工插列造成過期索引誤寫。
- 本地自動測試涵蓋 1,000 筆匯入分類與主要衝突規則。
- 連接 GitHub repository `LDream-L/Evan-english-lab`，以 `main` 作為唯一正式原始碼。
- 建立正式 Google Sheet；M0 完成 13/13 驗證，M1 已完成 14/14 schema v3 驗證。
- 建立並綁定 standalone Apps Script；正式 Spreadsheet ID 存於 Script Properties，不寫入 GitHub。
- 線上執行 `setupProject()` 與 `healthCheck()`，執行紀錄均顯示完成。
- 建立私人 Web App 第 2 版，實測首頁成功顯示「M0 資料結構正常」。
- 修正 Word/Card/Memory State 模型。
- 建立並在線上升級為 14 張 Sheet 的 schema。
- 建立可重跑的 `setupProject()` 與 `healthCheck()`。
- 建立可部署的最小 Web App 首頁。
- 建立完整主計畫、資料約束、版本與驗收閘門。
- 新增文章來源、單字出現位置與自動補全工作資料表。
- 新增無須 Evan 手動輸入的文章→單字→翻譯／例句管線。
- 納入刷刷庫功能參考，確立 Grammar 與 TOEIC Question Bank 擴充順序。

## 下一批

- 完成 M1 Apps Script 線上遷移、部署與 CRUD／匯入 smoke test。
- 進入 M1A：文章擷取、候選排序、自動補全 job 與來源追蹤。
