# 專案進度

更新：2026-09-06

| 階段 | 狀態 | 完成度 | 阻塞 |
|---|---|---:|---|
| M0 專案骨架 | 已完成 | 100% | 無 |
| M1 單字資料庫 | 待開始 | 0% | 無 |
| M1A 文章擷取／自動補全 | 已完成規格 | 15% | 等 M1 資料層與補全服務決策 |
| M2 快速預習 | 未開始 | 0% | 等 M1 |
| M3 正式複習 | 未開始 | 0% | 等 M2 |
| M4 自適應排程 | 未開始 | 0% | 等 M3 |
| M5 Dashboard | 未開始 | 0% | 等 M4 |
| M6 候選版 | 未開始 | 0% | 等 M5 |
| v1.0 正式版 | 未開始 | 0% | 需 14 天實用驗收 |

## 本批已完成

- 連接 GitHub repository `LDream-L/Evan-english-lab`，以 `main` 作為唯一正式原始碼。
- 建立正式 Google Sheet，完成 13/13 工作表與欄位驗證。
- 建立並綁定 standalone Apps Script；正式 Spreadsheet ID 存於 Script Properties，不寫入 GitHub。
- 線上執行 `setupProject()` 與 `healthCheck()`，執行紀錄均顯示完成。
- 建立私人 Web App 第 2 版，實測首頁成功顯示「M0 資料結構正常」。
- 修正 Word/Card/Memory State 模型。
- 建立 13 張 Sheet 的 schema。
- 建立可重跑的 `setupProject()` 與 `healthCheck()`。
- 建立可部署的最小 Web App 首頁。
- 建立完整主計畫、資料約束、版本與驗收閘門。
- 新增文章來源、單字出現位置與自動補全工作資料表。
- 新增無須 Evan 手動輸入的文章→單字→翻譯／例句管線。
- 納入刷刷庫功能參考，確立 Grammar 與 TOEIC Question Bank 擴充順序。

## 下一批

- 進入 M1：建立單字 CRUD、批次匯入、正規化與重複資料處理。
- 建立 ID→列號索引及批次讀寫層，避免每次更新掃描整張 Sheet。
- 補上 M1 自動測試、資料驗證與線上驗收。
