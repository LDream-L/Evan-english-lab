# 專案進度

更新：2026-09-08

| 階段 | 狀態 | 完成度 | 阻塞 |
|---|---|---:|---|
| M0 專案骨架 | 已完成 | 100% | 無 |
| M1 單字資料庫 | 已完成 | 100% | 無 |
| M1A 文章擷取／自動補全 | 實作中 | 90% | Gemini API 金鑰與端到端補全驗收 |
| M2R 騎乘音訊 Preview | 已部署待實機驗收 | 90% | 需加入啟用單字並以手機實測語音 |
| M2 快速預習 | 未開始 | 0% | 等 M1A 驗收 |
| M3 正式複習 | 未開始 | 0% | 等 M2 |
| M4 自適應排程 | 未開始 | 0% | 等 M3 |
| M5 Dashboard | 未開始 | 0% | 等 M4 |
| M6 候選版 | 未開始 | 0% | 等 M5 |
| v1.0 正式版 | 未開始 | 0% | 需 14 天實用驗收 |

## 本批已完成

- 實作貼上文字、公開網址與 TXT 文章輸入；網址拒絕私有主機並逐次驗證重新導向。
- 實作英文 token 聚合、輕量 lemma、TOEIC 訊號、出現頻率與陌生度候選排序。
- 文章只保存 URL、SHA-256 雜湊與必要句子摘錄，不保存全文。
- 同篇文章／同一候選字以 `idempotency_key` 去重，並加入失敗重試、退避時間及 stale processing 回收。
- 建立 Gemini structured-output provider adapter；API 金鑰只由 Script Properties 讀取。
- 自動內容通過後端格式、詞性、語境與例句目標字驗證；高信心啟用、中信心保留草稿、低信心拒絕寫入。
- 新增 M1A 文章候選介面與補全佇列狀態；所有文章內容均用 DOM `textContent` 渲染。
- schema v4 migration 只在 `enrichment_jobs` 尾端新增 4 欄，不移動既有資料。
- M1A 本地測試加入網址安全、HTML 清理、候選排序、已收錄／已掌握排除與 UI 安全檢查。
- 新增 GitHub Actions：每次 `main` push 或 pull request 自動執行 Node 測試與所有 `.gs` 語法檢查；workflow 只有 repository contents 唯讀權限。
- 建立 GitHub → Apps Script production workflow：手動觸發、測試、`clasp push`、建立不可變 version、更新既有 deployment，並在 runner 結束時清除暫存憑證。
- 修正 Apps Script 跨檔案頂層載入順序造成的 `SHEET_SCHEMAS is not defined`，並新增反向載入測試。
- 正式 Google Sheet 已完成 schema v4 遷移；線上 `setupProject()`、`healthCheck()` 均執行完成且無錯誤。
- M1A 已建立第 4 版正式部署 `v0.2.1-m1a`，文章預覽可正常辨識候選字且不會在預覽階段寫入單字庫。

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
- Apps Script 已同步 11 個正式程式檔並建立第 3 版部署 `v0.2.0-m1`，沿用原私人 Web App 網址。
- 線上重新執行 `setupProject()` 與 `healthCheck()`，兩者皆完成且無錯誤。
- 線上 smoke test 確認版本、系統狀態、單字庫、來源管理與匯入介面正常；兩筆匯入預覽分類為新增 2、錯誤 0，未寫入正式資料。
- 建立可重跑的 `setupProject()` 與 `healthCheck()`。
- 建立可部署的最小 Web App 首頁。
- 建立完整主計畫、資料約束、版本與驗收閘門。
- 新增文章來源、單字出現位置與自動補全工作資料表。
- 新增無須 Evan 手動輸入的文章→單字→翻譯／例句管線。
- 納入刷刷庫功能參考，確立 Grammar 與 TOEIC Question Bank 擴充順序。
- 完成 Parroto 競品評估，採用「情境短內容→聽寫／跟讀→點字收錄→SRS→錯誤回流」的學習閉環；真人配對、社群、排行榜與完整模考不納入 Vocabulary V1。
- 更新 M2～M4：M2 加入來源短句與句中選字，M3 加入錯字／聽錯回流並保留可選短句聽寫，M4 讓各題型共用 FSRS 排程。
- 新增 M2R 騎乘音訊規格：依 37 分鐘通勤預設以 35 分鐘為上限，出發前一次啟動、途中純收聽；播放不得直接影響答對率、mastery 或 FSRS。
- 完成 M2R Preview：依可用單字量、語速、內容長度與最多三輪重播動態產生 5～60 分鐘清單；支援裝置端英／中語音、暫停、結束與 Screen Wake Lock，單字不足時安全提前結束。
- 依騎乘雙作業與詞彙學習研究調整腳本為低負荷「英文兩次→中文→短搭配／例句→英文」，高負荷提取與正式評分留到停車後。
- 新增 3 項騎乘音訊測試；全套本地測試目前 24/24 通過，所有 `.gs` 語法檢查通過。
- Apps Script 五個 M2R 相關檔案已與 GitHub `main` 逐檔通過 Git blob SHA 比對，並再次通過線上 `healthCheck()`。
- M2R 已建立第 5 版正式部署 `v0.2.2-m2r-preview`，沿用原私人 Web App 網址與「只有我自己」權限。
- 正式網站 smoke test 通過：版本、schema、騎乘音訊介面與後端播放清單呼叫均正常；因目前啟用單字為 0，正確進入空清單安全狀態。
- 新增產品參考文件，明列刷刷庫／Parroto 的可借鑑功能、著作權邊界、語音隱私與延後項目。

## 下一批

- 新增或匯入啟用單字，以手機完成 M2R 英／中語音、暫停、續播、螢幕鎖定與提前結束的實機驗收。
- 以獨立的 Evan English Lab Google Cloud 專案安全建立 Gemini API 金鑰，保存到 Apps Script Script Properties，並執行一篇測試文章的端到端補全；免費層僅傳送目標字與來源句，不傳送帳密。
- 完成 Apps Script API 與三個 GitHub Actions secrets 的一次性設定，執行首次 production workflow。
- 進入 M2 快速預習，先交付來源短句、句中選字、瀏覽器發音與錯誤回流的最小閉環。
