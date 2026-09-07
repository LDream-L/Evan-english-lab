# GitHub → Apps Script 部署

版本：第一階段（手動觸發）  
Workflow：`.github/workflows/deploy-apps-script.yml`

## 部署行為

GitHub Actions 依序執行：

1. 取得 `main` 的完整原始碼。
2. 執行全部 Node 測試。
3. 檢查所有 `.gs` 語法。
4. 在 runner 暫時建立 `.clasprc.json` 與 `.clasp.json`。
5. 使用固定版本 `@google/clasp@3.4.1` 執行 `push --force`。
6. 建立不可變 Apps Script version，描述包含 Git commit 短 SHA。
7. 更新既有 production deployment，不建立新網址。
8. 無論成功或失敗都刪除 runner 內的暫存憑證檔。

第一階段只允許 `workflow_dispatch` 手動執行。完成首次 production smoke test 後，再評估改成 `main` 通過測試即自動部署。

## 一次性前置設定

1. 以 Apps Script 專案擁有者帳號開啟 `https://script.google.com/home/usersettings`，啟用 Apps Script API。
2. 在可信任的個人電腦執行 `npx @google/clasp@3.4.1 login`。
3. 將產生的 `~/.clasprc.json` 完整內容存為 GitHub Actions secret `CLASPRC_JSON`。
4. 將下列 JSON 存為 secret `CLASP_JSON`：

   ```json
   {"scriptId":"15CHDnUxAayKexW04MLANAj1jyuZp3yOYn6clL0bhpp8CkkL1Vt7GDB3n","rootDir":"appsscript"}
   ```

5. 將既有 Web App deployment ID 存為 secret `CLASP_DEPLOYMENT_ID`：

   ```text
   AKfycbzKWKoCo21QYwLcOrMukU_n5dOnLH2h0Uy-PzuDb7UdyFi8hxJOt19ky213gKjpJIrR
   ```

`CLASPRC_JSON` 含 refresh token，等同可持續管理 Apps Script 的敏感憑證。不得貼到聊天、提交 repository、寫入 log 或放進一般 GitHub variable。若懷疑外洩，立即撤銷 Google OAuth 授權並重新登入產生新憑證。

## 首次驗收

- Workflow 所有步驟成功。
- Apps Script 新 version 描述包含觸發部署的 Git SHA。
- 既有 Web App URL 不變。
- `setupProject()` 完成 schema migration。
- `healthCheck()` 回傳 `ok: true` 與 schema v4。
- 線上頁面顯示 `v0.2.1-m1a`，文章預覽可正常產生候選字。

## 回復

若 smoke test 失敗，從 Apps Script deployment 選擇上一個已驗收 version，或由 GitHub 將修正 commit 部署成新 version。不得直接在 Apps Script 編輯器保存正式修正。
