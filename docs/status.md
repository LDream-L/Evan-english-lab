# 專案進度

更新：2026-09-06

| 階段 | 狀態 | 完成度 | 阻塞 |
|---|---|---:|---|
| M0 專案骨架 | 進行中 | 70% | 尚未建立/連接 GitHub、Google Sheet、Apps Script 與部署 |
| M1 單字資料庫 | 未開始 | 0% | 等 M0 驗收 |
| M1A 文章擷取／自動補全 | 已完成規格 | 15% | 等 M1 資料層與補全服務決策 |
| M2 快速預習 | 未開始 | 0% | 等 M1 |
| M3 正式複習 | 未開始 | 0% | 等 M2 |
| M4 自適應排程 | 未開始 | 0% | 等 M3 |
| M5 Dashboard | 未開始 | 0% | 等 M4 |
| M6 候選版 | 未開始 | 0% | 等 M5 |
| v1.0 正式版 | 未開始 | 0% | 需 14 天實用驗收 |

## 本批已完成

- 修正 Word/Card/Memory State 模型。
- 建立 13 張 Sheet 的 schema。
- 建立可重跑的 `setupProject()` 與 `healthCheck()`。
- 建立可部署的最小 Web App 首頁。
- 建立完整主計畫、資料約束、版本與驗收閘門。
- 新增文章來源、單字出現位置與自動補全工作資料表。
- 新增無須 Evan 手動輸入的文章→單字→翻譯／例句管線。
- 納入刷刷庫功能參考，確立 Grammar 與 TOEIC Question Bank 擴充順序。

## 下一批

- 建立 GitHub repository 或連接既有 repository。
- 建立 Google Sheet 與 standalone Apps Script。
- 設定 `SPREADSHEET_ID`、推送、初始化、健康檢查與私人部署。
