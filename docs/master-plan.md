# Evan TOEIC Lab｜完整專案主計畫

版本：v0.2.1-m1a

日期：2026-09-06

角色：Evan 為產品負責人與驗收者；Codex 負責規格、開發、測試、文件與交付。只有帳號授權、Google 平台內的人工部署確認、產品取捨等無法代行事項才交由 Evan 操作。

## 1. 結論

Apps Script Web App＋Google Sheets 足以支撐個人長期使用的 Vocabulary V1。原始構想約完成 70% 的產品方向，但缺少可直接施工的卡片模型、資料一致性、匯入復原、部署與測試規格。本計畫補齊後可開始實作。

V1 不追求華麗介面，也不在即時學習流程中逐題呼叫 AI。文章匯入階段允許受控的自動翻譯與原創例句補全，但詞源必須有可追溯來源，所有自動內容都要保存版本與驗證狀態。優先順序固定為：資料正確性 → 可恢復的學習流程 → 複習排程 → 統計 → 視覺優化。

## 2. 已採用與修正的核心決策

| 項目 | 決策 | 理由 |
|---|---|---|
| 正式原始碼 | GitHub `main` 唯一正式版本 | 防止 Apps Script 編輯器與聊天附件形成分叉 |
| V1 執行環境 | Apps Script 同時提供前端與後端 | 個人使用時省去 CORS、OAuth/API 驗證與額外主機 |
| 資料庫 | Google Sheets | 資料可直接檢查、備份與手動修正，規模足夠 |
| 前端拆檔 | Apps Script 的 `Index.html`＋CSS/JS `.html` 片段 | HTML Service 的 client code 需由 HTML 檔 include；不能原樣把 `.css`、`.js` 當 Web 靜態路徑 |
| 學習單位 | `word` 與 `card` 分開 | 同一單字的 EN→ZH、ZH→EN、拼字、聽力是不同記憶，不能共用一筆狀態 |
| 紀錄模型 | `reviews` 追加歷史，`memory_state` 保存卡片當前狀態 | 快速排程且保留完整稽核軌跡 |
| 排程模型 | M3 先完成可驗證狀態機；M4 經 adapter 接 FSRS | 不自行硬抄公式；保留演算法版本與日後升級能力 |
| 同步寫入 | idempotency key＋ScriptLock＋row_version | 防止雙擊、重送與同時寫入造成重複 review 或覆蓋新狀態 |
| 今日佇列 | 建立 `daily_sessions.queue_json` 快照 | 可跨裝置/重開頁面續做，不需每題重算全部資料 |
| Response Time | 保存供弱項與體驗分析，不直接混入 FSRS rating | FSRS 主要依 rating/間隔；反應時間另作診斷訊號 |
| AI | 不進入即時學習主流程；允許受控的離線自動補全 | Evan 不需手動填翻譯與例句，同時避免未驗證內容直接污染正式單字庫 |
| 文章取字 | URL／貼文／檔案→擷取→候選→補全→匯入 | 由 Codex 或自動工作處理，Evan 只提供文章，不逐字輸入 |
| TOEIC 參考 | 參考刷刷庫的碎片化刷題、詳解、錯題本、弱項與文法練習 | 只參考功能，不複製題目、詳解、介面資產或商業資料 |

## 3. V1 範圍

### 必做

- 個人限定登入與 Web App 存取。
- 單字新增、編輯、停用、搜尋、批次匯入、預覽與重複檢查。
- 26 秒概念的快速預習流程。
- EN→ZH、ZH→EN、拼字三種卡片；聽力題型保留 schema，是否納入 v1.0 由 M3 驗收決定。
- 每題保存正誤、rating、作答時間、答案、題型與排程前後狀態。
- 到期、逾期、弱項、今日新字、積壓恢復與每日時間容量。
- 可中斷並續做的每日 session。
- Dashboard、單字庫與基本統計。
- 匯出/備份、錯誤紀錄、schema migration 與回復說明。
- 文章、網址或文件的單字擷取與自動資料補全佇列。
- 每筆自動翻譯、例句與解釋的來源／模型／版本／信心與驗證狀態。

### 不做

- 即時逐題呼叫 AI、未經追蹤的 AI 內容，以及由 AI 猜測詞源。
- 多人帳號、社群、排行榜、付款。
- Grammar、Listening、Reading、完整模擬考。
- 抓取或複製刷刷庫及其他商業題庫內容。
- 原生 iOS/Android App；PWA 在 Vocabulary v1.0 後評估。

## 4. 正式資訊架構

```text
Dashboard
├─ 今日學習
│  ├─ 舊字複習
│  ├─ 弱項
│  ├─ 快速預覽
│  ├─ 新字正式學習
│  └─ 提取測驗
├─ 快速預習
├─ 自由快刷
├─ 單字庫
├─ 新增／匯入
├─ 統計
└─ 設定／備份
```

## 5. 今日排程規則

1. 讀取設定、當日 session 與 `memory_state`。
2. 若有未完成 session，直接續做其 queue，不重建。
3. 否則一次建立 `overdue`、`due`、`weak`、`newCards` 四組候選。
4. 排序採可解釋的風險分數；逾期優先，其次到期與弱項。
5. 依 `daily_minutes` 與各題型移動平均秒數估算容量。
6. 積壓超過門檻時新字降為 0；否則最多 `new_words_max`。
7. 保存 queue 快照；作答時只推進指標並增量更新，不重算全表。

弱項與到期可以重疊，但同一 `card_id` 在同一 queue 只能出現一次。去重必須在分類後以 Map 完成。

## 6. 文章擷取與自動補全流程

Evan 日後只需提供文章網址、貼上全文或上傳檔案；不需要逐字填翻譯、詞性與例句。處理流程如下：

```text
取得文章
→ 合法性與可讀性檢查
→ 文字清理、斷句、tokenize、lemmatize
→ 排除停用詞、已熟練字與重複字
→ 依 TOEIC 相關度、文章頻率與陌生度排序
→ 建立候選單字
→ 查字典型資料與詞性
→ 產生台灣繁中語境翻譯、原文情境解釋與原創例句
→ 自動一致性檢查
→ 高信心資料正式匯入；低信心進入 Codex 待處理佇列
```

### 自動內容來源順序

1. 可合法使用且有明確授權的字典／語料資料：lemma、詞性、音標、基本定義、可用例句。
2. 文章短句：保存必要短句與來源 URL，建立「這篇文章中的意思」。
3. 生成式模型：產生符合該義項的台灣繁中翻譯、TOEIC 情境原創例句與簡明說明。
4. 驗證器：檢查目標字是否真的出現在例句、詞性是否一致、翻譯是否對應該義項、是否與既有資料矛盾。

### 無須 Evan 手動輸入，不代表無驗證

- 高信心：自動啟用。
- 中信心：可先學，但顯示「自動補全」，由 Codex 批次覆核。
- 低信心或詞源資訊：不自動啟用，由 Codex 查證後處理。
- 每個欄位保存 `provenance_ref`、`generator_version`、`confidence`、`validation_status`。
- 網站不能因補全服務失敗而阻斷複習；工作保存在 `enrichment_jobs`，可重試與續跑。

### 兩種執行方式

| 方式 | 使用情境 | 成本與限制 |
|---|---|---|
| Codex 協助匯入 | Evan 在聊天提供文章、網址或檔案 | 不要求 Evan 填欄位；由 Codex 擷取、整理、檢查並寫入正式匯入格式 |
| 網站全自動 | Evan 在網站貼 URL／文字後自行處理 | 需字典／翻譯／生成服務憑證與費用；部分網站禁止抓取或無法由伺服器讀取 |

V1 已完成第一種並建立相容資料管線；M1A 使用可替換 provider adapter，首個實作為 Gemini 2.5 Flash-Lite。金鑰只存在 Apps Script Properties，沒有金鑰時仍可擷取文章、排序候選與建立工作，既有學習功能不受影響。

## 7. 複雜度與替代方案

| 運算 | 採用方案 | 時間 | 空間 | 較慢/較複雜替代與選擇原因 |
|---|---|---:|---:|---|
| 載入學習狀態 | 一次批次讀取＋Map | O(n) | O(n) | 每張卡反覆查 Sheet 會形成 O(m×n) 與大量網路往返 |
| 建立每日計畫 | 一次分類＋候選排序 | O(n log n) | O(n) | Heap 可將增量更新降至 O(log n)，但 V1 數千卡不值得增加維護成本 |
| ID 查詢 | Map/index cache | O(n) 建索引 | O(n) | `.find()` 每次 O(n)，批次處理會退化 |
| Sheet 寫入 | 記憶體更新＋批次 setValues | O(n) | O(n) | 逐格寫入極慢且增加配額風險 |
| 複習提交 | review append＋單卡 state 更新 | O(1) 邏輯；實際 Sheets 寫入視定位策略 | O(1) | 每題重算全部 history 是 O(h)，不採用 |
| 匯入去重 | normalized lemma＋複合鍵 Map | O(n+m) | O(n) | 雙層逐筆比對為 O(n×m) |
| 區間統計 | 每日彙總表（M5） | 建表 O(h)，查詢 O(d) | O(d) | Dashboard 每次掃全部 reviews 會隨歷史無限變慢 |
| 文章候選去重 | Set／Map＋批次查表 | O(a+w) | O(w) | 每個 token 逐一掃 words 會成為 O(a×w) |
| 自動補全 | 以唯一 job 批次處理 | O(k) 個工作 | O(k) | 每次重開文章全部重產會重複花費且難以追溯 |

## 8. 里程碑、交付物與驗收

| 版本 | 階段 | 交付物 | 驗收閘門 |
|---|---|---|---|
| v0.1 | M0 骨架 | repo、Apps Script、schema、文件、health check | 重跑 setup 不破壞資料；所有表頭一致；Web App 可顯示健康狀態 |
| v0.2 | M1 單字庫 | CRUD、搜尋、來源、批次匯入、重複處理 | 1,000 筆匯入可中斷續跑；重複規則可預覽；錯誤列可追查 |
| v0.2.x | M1A 文章匯入 | URL／文字／檔案擷取、候選排序、補全 job、來源追蹤 | 同文章不重複產生；失敗可續跑；每個自動欄位可追溯 |
| v0.3 | M2 快速預習 | 預覽卡、發音、核心義、三分類 | session 可續做；分類皆有紀錄；鍵盤與手機可操作 |
| v0.4 | M3 提取複習 | 三題型、rating、response time、review log | 重送不重複寫入；歷史與 state 一致；錯題可立刻重現 |
| v0.5 | M4 排程 | FSRS adapter、到期/逾期/弱項、新字容量、backlog | 固定測試資料得到固定 due；跨時區無日期漂移；可升級算法版本 |
| v0.6 | M5 Dashboard | 今日任務、負荷、正確率、掌握度、趨勢 | 統計可與 reviews 抽樣人工對帳；不掃描無關欄位 |
| v0.7 | M6 候選版 | 備份、錯誤處理、行動版 QA、部署文件 | 連續 14 天實際使用無阻斷級錯誤 |
| v1.0 | Vocabulary 正式版 | 鎖版、migration、release notes | 備份還原演練成功；正式 main 與部署版本一致 |

## 9. M0～M6 細部工作分解

### M0

- 建立 repository 與 branch/release 規則。
- 建立 Google Sheet、Apps Script 與 Script Property。
- 執行 schema initializer；建立健康檢查。
- 建立 `dev` 與 `production` 部署識別方式。
- 建立測試資料與備份 SOP。

### M1

- 單字 normalization：trim、Unicode normalization、英文小寫索引；保留顯示原文。
- `words` 與 `word_details` CRUD；採 soft delete/status，不直接刪除歷史引用資料。
- 匯入前預覽：新增、更新、跳過、衝突、錯誤五類。
- CSV/XLSX 先由前端解析或轉成二維資料；後端分批提交並保存 cursor。
- 重複鍵預設為 `normalized_lemma + pos`，同字多詞性不強制合併。

### M1A

- 網站接受公開文章 URL、貼上文字與 TXT；PDF/DOCX 先由 Codex 協助解析成同一管線，待鎖定安全解析套件後再加入瀏覽器直接解析。
- 擷取候選字、原形、出現短句與位置；用 Set/Map 去重。
- 排除已熟練卡與低資訊詞，保留使用者可查看的排除原因。
- 建立自動翻譯、義項選擇、例句與解釋工作。
- 內容生成與正式啟用分離；所有工作具冪等鍵、狀態、重試與版本。

### M2

- 建立預覽 session：核心意思、詞性、常見搭配、發音。
- 三分類：「已經會／有印象／不會」只決定初始學習路徑，不直接等同最終 FSRS rating。
- 發音 V1 優先瀏覽器 Speech Synthesis；聲音品質與可用性列入驗收。

### M3

- 建立 card 狀態機：new、learning、review、relearning、suspended。
- 題型：EN→ZH 可自評；ZH→EN 與拼字可正規化後自動比對並允許人工覆核。
- 每次提交產生 client idempotency key；後端在鎖內檢查、追加 review、更新 memory state。
- 答案正規化規則必須可測試，不能靠模糊猜測自動判對。

### M4

- 建立 `SchedulerAdapter`，輸入舊 state、rating、時間與設定，輸出新 state 與 due。
- 使用成熟、可鎖版本且可在 Apps Script bundle 的 FSRS 實作；不直接依最新公式自行重寫。
- `algorithm_version` 與參數快照必須可追溯。
- 初期使用預設參數；累積足量資料後才加入個人化最佳化。

### M5

- 建立 daily aggregate，避免 Dashboard 每次掃描完整 reviews。
- 指標區分：card 正確率、word 掌握度、題型落差、逾期量、實際分鐘數、新字量。
- 「記憶負荷」須公開公式與門檻，不用模糊標籤。

### M6

- CSV/JSON 備份與還原演練。
- 失敗訊息、重試、離線中斷提示、重複提交測試。
- Chrome 桌面與 Android/iOS 常見瀏覽器的響應式檢查。
- Apps Script 配額與執行紀錄監控。
- 建立 v1.0 tag、release notes 與部署對照表。

## 10. TOEIC 擴充藍圖

Vocabulary v1.0 完成後，不把系統停在背單字，而是依序擴充：

```text
Vocabulary V1
→ Grammar V1
→ TOEIC Question Bank V1
→ Listening／Reading 分 Part 訓練
→ 模考與落點模型
```

參考刷刷庫的有效功能：碎片時間快速刷題、逐題詳解、自動錯題本、弱項分類、文法單元、進度追蹤與分數落點。Evan TOEIC Lab 會加上自身差異：題目錯誤原因標籤、單字卡與文法／題目互相回連、FSRS 複習，以及所有資料來源可追溯。

落點估計不能只用答對率直接換算。初期只顯示各 Part 與文法主題正確率；累積足夠且校準過的題目難度與作答資料後，才發布「預估分數」。

## 11. Git 與部署治理

- `main`：唯一可部署正式版本。
- 每個里程碑使用短期 feature branch；合併前必須測試。
- 版本採 SemVer；正式標籤例如 `v0.2.0`。
- Apps Script 編輯器只允許緊急診斷，不直接保存正式修改；任何修正先回 GitHub。
- 使用 clasp 從 repository 推送 Apps Script。
- 每次 production deployment 記錄 Git commit SHA、Apps Script deployment/version 與 schema version。
- schema 只可前向 migration，不直接改已上線表頭。

## 12. 安全、資料一致性與備份

- Web App 限本人 Google 帳號；不公開為 anonymous。
- Spreadsheet ID 放 Script Properties，不寫入前端。
- 所有前端輸入後端再次驗證；輸出避免直接插入 `innerHTML`。
- review 提交以 idempotency key 防重；寫入區段以 ScriptLock 防撞。
- 更新 state 檢查 `row_version`，發現舊版本就拒絕覆蓋並重新載入。
- 每週自動複製資料庫或匯出；每次 schema migration 前建立快照。
- 歷史 review 原則上不修改；若需更正，以 correction event 或管理記錄處理。

## 13. 風險與升級界線

| 風險 | V1 配套 | 何時升級 |
|---|---|---|
| Apps Script 啟動延遲 | 一次 bootstrap、減少短 RPC、Cache | 體感頻繁超過 2–3 秒且無法改善 |
| Sheets 歷史表變大 | 批次讀寫、日彙總、列號索引 | reviews 達數十萬且查詢/寫入明顯惡化 |
| 執行時間限制 | 匯入分批、cursor 續跑 | 大量任務持續逼近單次執行限制 |
| FSRS 版本變動 | adapter＋algorithm_version＋固定測試向量 | 新版函式庫成熟且回測優於現版才遷移 |
| 手動改 Sheet 破壞 schema | health check＋migration＋備份 | 發生欄位漂移即阻止寫入，不自動覆蓋 |
| PWA/跨平台需求 | v1.0 後拆出 API 邊界 | 需要離線、推播、多裝置背景同步時 |
| 自動翻譯或例句錯義 | 原文義項、來源、信心、驗證器與 Codex 覆核 | 錯誤率超過驗收門檻即停用該產生器版本 |
| 文章抓取受限 | 支援貼文字／檔案；不繞過登入、付費牆與禁止存取 | 網址無法合法讀取時改由使用者提供內容 |
| 題庫著作權 | 自建或合法授權題目；刷刷庫只作功能參考 | 未取得授權不得匯入其題目與詳解 |

## 14. 必須由 Evan 完成或核准的事項

僅限下列事項，其餘由 Codex完成：

1. Google 帳號首次授權 Apps Script 存取 Sheet。
2. 若無可用的 GitHub 建立/推送連線，建立空白 repository 並提供 URL 或完成一次登入。
3. M2 的「26 秒流程」實際體感驗收。
4. M4 desired retention 與積壓門檻的產品選擇；未決前使用 0.90 與 20 的明示預設值。
5. v1.0 正式發布核准。
6. 網站全自動補全若要使用付費 API，核准供應商與每月成本上限；在此之前由 Codex 協助批次補全。

## 15. 下一個施工批次

M0、M1 已完成。M1A 已建立文章擷取、候選排序、冪等工作與自動補全 adapter；完成 schema v4 線上遷移、API 金鑰設定與 smoke test 後進 M2 快速預習。
