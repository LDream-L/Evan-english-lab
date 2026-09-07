# M1A 文章擷取與自動補全

版本：v0.2.1-m1a  
Schema：v4

## 輸入與保存

- 網站直接支援貼上英文文章、公開 HTTP(S) 網址與 TXT。
- PDF／DOCX 由 Codex 協助解析後送入相同管線；不要求 Evan 手動整理欄位。
- 網址禁止 credentials、localhost、link-local、私有 IPv4、`.local` 與 `.internal`；每次 redirect 重新驗證。
- 正式資料庫只保存文章標題、最終 URL、SHA-256 內容雜湊、必要句子摘錄與來源關聯，不保存完整文章。

## 候選規則

文章以單次 token 掃描及 Map 聚合，依下列因素排序：

1. TOEIC 商務語境訊號。
2. 本文出現頻率。
3. 字詞長度所代表的資訊量。
4. 單字庫尚未收錄。

既有單字與已掌握單字不重複加入。正式補全仍會校正候選的 lemma、詞性與本文義項。

## 工作佇列

`enrichment_jobs.idempotency_key` 使用文章內容雜湊＋lemma，防止同篇文章重開後重複付費。工作狀態為 `queued → processing → completed/failed`；429、5xx 與逾時採指數退避，最多嘗試 4 次。超過 10 分鐘的 processing 工作可被重新領取。

## 自動補全

首個 provider 為 Gemini，預設模型 `gemini-2.5-flash-lite`，使用 JSON Schema structured output。金鑰保存於 Apps Script Script Properties 的 `GEMINI_API_KEY`，選用模型可由 `GEMINI_MODEL` 覆寫；兩者都不得提交 GitHub。

輸出需包含 lemma、詞性、台灣繁中核心義、本文義、原創 TOEIC 例句與翻譯、用法說明、搭配詞及信心分數。後端再次驗證後才寫入：

| 信心 | 結果 |
|---|---|
| `>= 0.85` | 建立 active 單字，標記 `auto_verified` |
| `0.65–0.84` | 建立 draft，留待 Codex 批次查核 |
| `< 0.65` | 拒絕寫入並留下失敗原因 |

所有生成明細保存 provider、模型、prompt version、來源 occurrence、信心與驗證狀態。沒有 API 金鑰或 provider 暫時故障時，文章擷取、候選排序、單字庫及複習功能仍可正常使用。
