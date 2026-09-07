# Evan TOEIC Lab

長期使用的個人 TOEIC 單字學習系統。GitHub `main` 是唯一正式原始碼；Apps Script Web App 負責網站與後端；Google Sheets 保存使用者資料。

## 目前狀態

- 版本：`v0.2.0-m1`
- 階段：M1 單字資料庫
- 已完成：M0 線上環境；M1 單字 CRUD、來源管理、搜尋、匯入預覽、分批續傳與 schema v3
- 正式網站（僅擁有者可存取）：[Evan TOEIC Lab](https://script.google.com/macros/s/AKfycbzKWKoCo21QYwLcOrMukU_n5dOnLH2h0Uy-PzuDb7UdyFi8hxJOt19ky213gKjpJIrR/exec)
- 正式資料庫：[Evan English Lab｜正式資料庫](https://docs.google.com/spreadsheets/d/1vq-icv9yjwoDtW2J7PQ1vb8eTkCtCWx-fgMVZAtB0jk/edit)
- Apps Script 專案 ID：`15CHDnUxAayKexW04MLANAj1jyuZp3yOYn6clL0bhpp8CkkL1Vt7GDB3n`

## 目錄

```text
evan-toeic-lab/
├─ appsscript/        Apps Script 可直接推送的正式程式
├─ docs/              架構、資料庫、里程碑與驗收規格
├─ tests/             後續自動測試
├─ .clasp.json.example
├─ package.json
└─ README.md
```

## M0 線上環境

1. Google Sheet 已建立並通過 13/13 schema 驗證。
2. Standalone Apps Script 已綁定正式 `SPREADSHEET_ID`。
3. Apps Script 使用 `Asia/Taipei`、V8 runtime。
4. `setupProject()` 與 `healthCheck()` 已於線上環境執行完成。
5. Web App 第 2 版已部署；以擁有者身分執行，存取權限僅限 Evan 的 Google 帳號。
6. 網站實測顯示「M0 資料結構正常」。

詳細決策與驗收條件見 [docs/master-plan.md](docs/master-plan.md)。

M1 的欄位格式、去重規則、錯誤分類與續跑方式見 [docs/m1-word-library.md](docs/m1-word-library.md)。
