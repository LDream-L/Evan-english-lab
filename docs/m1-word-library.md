# M1 單字庫與匯入規格

版本：v0.2.0-m1  
Schema：v3

## 可用功能

- 單字新增、查詢、編輯、封存與復原。
- `word_details` 新增／更新／刪除 API。
- 資料來源新增、更新與封存。
- CSV／TSV 匯入前完整預覽。
- 每批最多 200 列；工作與每列 payload 保存於 Google Sheets，可跨重新整理及裝置續跑。
- 單次工作最多 5,000 列，超過時須拆成多個工作，避免 Apps Script 執行時間與 RPC payload 風險。

## 匯入欄位

必填：

| 欄位 | 說明 | 範例 |
|---|---|---|
| `lemma` | 英文原形或片語 | `reimburse` |
| `primary_meaning_zh` | 台灣繁中核心意思 | `報銷；償還費用` |
| `pos` | 正式詞性或支援的縮寫 | `verb`、`v.` |

選填：

| 欄位 | 預設值 |
|---|---|
| `source_id` | 匯入畫面選定的預設來源或空白 |
| `priority` | `normal` |
| `status` | `active` |
| `enrichment_status` | `pending` |

支援的詞性：`noun`、`verb`、`adjective`、`adverb`、`pronoun`、`preposition`、`conjunction`、`determiner`、`interjection`、`phrase`、`other`。常見縮寫如 `n.`、`v.`、`adj.`、`adv.` 會先展開。

## 預覽分類

| 分類 | 規則 | 是否寫入 words |
|---|---|---|
| `insert` | `normalized_lemma + pos` 尚不存在 | 是 |
| `update` | 已存在、內容不同，且勾選更新既有資料 | 是，`row_version + 1` |
| `skip` | 既有內容完全相同，或同批完全相同的重複列 | 否 |
| `conflict` | 既有內容不同但未允許更新，或同批同鍵內容互相矛盾 | 否 |
| `error` | 缺少必填欄位、英文格式或詞性不合法 | 否 |

## 正規化與複雜度

- lemma：NFKC → trim → 英文小寫 → 連續空白合併。
- 重複鍵：`normalized_lemma + U+001F + normalized_pos`。
- 預覽：既有單字先建立 Map，再單次掃描匯入列，時間 O(n+m)、空間 O(n+m)。
- 匯入：一次讀取 words 與 staging；更新列依連續 row index 分組批次寫入，新增列一次 append。
- ID 查詢：CacheService 保存 ID→列號；每次命中先讀該列 ID 驗證，失效時重建 Map。

暴力法會讓每個匯入列掃描整張 words，形成 O(n×m) 且增加 Sheets 呼叫；正式實作採 Map 與批次寫入。

## XLSX 處理界線

網站 M1 直接接受 CSV／TSV。XLSX 由 Codex 或試算表工具先轉成相同二維欄位後呼叫後端匯入，不要求 Evan 手動整理單字內容。若要讓瀏覽器直接解析 XLSX，需在後續評估固定版本的解析套件與供應鏈風險；不以未鎖版 CDN 套件進入正式主流程。
