# 託管決策：GitHub、GitHub Pages 與 Apps Script

更新：2026-09-07  
狀態：採用

## 結論

目前架構維持：

- GitHub `main`：唯一正式原始碼與版本歷史。
- Apps Script Web App：實際學習網站、後端函式與 Google 帳號權限。
- Google Sheets：私人單字、文章來源、作答與記憶狀態。
- GitHub Pages：目前不啟用。

「原始碼放在 GitHub」不代表「網站由 GitHub Pages 執行」。GitHub repository 是施工圖與版本倉庫；Apps Script deployment 才是目前運行中的網站成品。

## 為何原始碼必須留在 GitHub

1. 每次修改都有 commit，可知道何時、由誰、改了什麼。
2. 發生問題可回復到已通過測試的版本，不依賴 Apps Script 編輯器的草稿。
3. 可在部署前執行自動測試及語法檢查。
4. 文件、schema migration 與程式碼可綁在同一版本。
5. 已建立 `clasp`／GitHub Actions 部署流程，避免手動貼入造成程式分叉。
6. 日後更換主機時可以帶走程式，不被單一平台鎖住。

GitHub 不保存 `SPREADSHEET_ID`、API 金鑰或個人學習紀錄；這些只存在私人 Google 環境。

## 為何現在不使用 GitHub Pages

GitHub Pages 是靜態託管。它可以顯示 HTML、CSS、JavaScript，但不能直接執行本專案需要的伺服器端功能：

- 私人 Google Sheets 讀寫。
- 單字 CRUD 與批次匯入鎖定。
- `row_version`、idempotency 與排程狀態一致性。
- 文章網址擷取及 Gemini 金鑰保護。
- Apps Script owner-only 存取。

若把畫面搬到 Pages，仍需另建後端 API，並處理 OAuth、CORS、session、API 金鑰、濫用防護與部署。因此 Pages 不是「把目前網址換掉」；它只會新增第二個前端與更多故障點。

此外，一般個人 GitHub Pages 網站預設是公開的；私人 Pages 存取控制主要屬 GitHub Enterprise Cloud 組織功能，不適合拿來取代目前只有 Evan 可進入的 Apps Script 網站。

## 何時才遷移

只有任一條件成立才啟動正式遷移評估：

- 開放多人註冊或分享不同帳號的學習資料。
- Apps Script 執行時間／每日配額持續影響核心流程。
- Google Sheets 資料量或關聯查詢已超過可維護範圍。
- 需要付費方案、公開 API、行動 App 或穩定背景工作。
- 需要更完整的全文搜尋、向量搜尋或即時協作。

屆時應整體遷移為「前端主機＋真正的 API 後端＋資料庫」，而不是只啟用 GitHub Pages。GitHub repository 仍保留為正式原始碼。

## 目前部署規則

1. 所有修改先進 GitHub `main`。
2. 本地測試全部通過。
3. 由固定 Git commit 同步 Apps Script。
4. 執行 `setupProject()`／migration 與 `healthCheck()`。
5. 建立新 Apps Script version 並更新原 deployment。
6. 在線上 smoke test 後，將 commit、deployment version 與 schema version 寫回進度文件。
