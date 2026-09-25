# iPhone 騎乘音訊：實機失敗後的方案評估

更新：2026-09-25

## 已確認

- Evan 的 iPhone 對第 7 版私人 Web App 的「提示音」（Web Audio）和「英文試聽」（Speech Synthesis）皆聽不到；網頁沒有顯示可用於定位輸出路徑的錯誤。這是實機回報，不能用雲端瀏覽器的成功事件推翻。
- Google Apps Script HTML Service 會在 iframe 沙盒中執行網頁；iPhone 的 Safari 對音訊播放有使用者手勢等條件。這些是潛在限制，尚不能判定是哪一項造成這次無聲。
- 目前沒有已授權的英中語音音檔，也沒有可使用的 TTS 金鑰。不得聲稱網站已具備可靠騎乘播報。

## 可行路徑

| 方案 | 能否避開現有失敗點 | 前提與成本 | 結論 |
|---|---|---|---|
| 再改 `speechSynthesis` 或 Web Audio 按鈕 | 否；兩條路都已實機無聲 | 重複試錯且沒有裝置診斷 | 暫停，不再要求 Evan 重試 |
| 網站內嵌單段 MP3／AAC | 可避開即時 TTS，但仍在同一個 iframe／瀏覽器 | 須合法音源、儲存與實機驗收 | 不能先宣稱可靠 |
| 預先產生一個完整音檔，使用 iPhone 原生播放器播放 | 避開 Apps Script iframe 與即時 TTS；音訊播放器與資料頁分開 | 需合法的英中音源、私密交付與實機播放驗證；不必用 Gemini | 下階段首選；有音源後先做短檔實機驗收，再產生 35 分鐘版 |
| 使用 iOS 系統朗讀／捷徑從文字稿發聲 | 語音在網站外，可能避開 iframe | 需在裝置上設定並逐機驗證，騎乘背景續播尚未知 | 備選，不把操作成本轉嫁給使用者當完成 |

若日後產生 35 分鐘、64 kbps 單聲道音訊，檔案大小的理論估算約 16.8 MB（35 × 60 × 64 ÷ 8 ÷ 1000）；這是位元率計算，不代表已有音檔或可播放。

## 本次執行

- 暫停正式頁面騎乘音訊按鈕與「可用」提示，保留原資料與程式，避免誤認播放正常。
- 先交付不靠聲音、不靠 Gemini 的 M2 文字預習。正式複習與 FSRS 保持分開。
- 音檔方案須完成來源授權、短檔裝置實測、背景／螢幕鎖定行為與隱私驗收，才重新開放騎乘模式；目前進度不得標為完成。

參考：[Google Apps Script HTML Service 限制](https://developers.google.com/apps-script/guides/html/restrictions)、[WebKit iOS 媒體播放手勢政策](https://webkit.org/blog/6784/new-video-policies-for-ios/)。
