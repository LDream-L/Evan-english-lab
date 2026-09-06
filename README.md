# Evan TOEIC Lab

長期使用的個人 TOEIC 單字學習系統。GitHub `main` 是唯一正式原始碼；Apps Script Web App 負責網站與後端；Google Sheets 保存使用者資料。

## 目前狀態

- 版本：`v0.1.1-m0`
- 階段：M0 專案骨架與資料結構
- 已完成：Apps Script 可部署骨架、Schema 建立器、文章擷取／自動補全資料管線規格、完整專案藍圖
- 尚未完成：Google Sheet 實體建立、Apps Script 綁定、GitHub 遠端儲存庫建立與部署

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

## M0 啟動順序

1. 建立空白 Google Sheet。
2. 建立 standalone Apps Script 專案。
3. 複製 `.clasp.json.example` 為 `.clasp.json`，填入 `scriptId`。
4. 在 Apps Script 的 Script Properties 設定 `SPREADSHEET_ID`。
5. 推送 `appsscript/` 後執行一次 `setupProject()`。
6. 執行 `healthCheck()`，確認所有工作表與 schema 版本。
7. 部署為 Web App；個人版預設「以擁有者身分執行」，存取權限僅限 Evan 的 Google 帳號。

詳細決策與驗收條件見 [docs/master-plan.md](docs/master-plan.md)。
