# 字型說明

本專案使用的字型全部為 SIL Open Font License 1.1（OFL 1.1），
可自由個人與商業使用，無需付費、無需標示作者。

## 目前使用的字型

| 用途 | 字型 | 授權 | 來源 |
|---|---|---|---|
| 主標題 | 台北黑體 Taipei Sans TC | SIL OFL 1.1 | 翰字鑄造 JT Foundry |
| 副標題・內文 | 思源黑體 Noto Sans TC | SIL OFL 1.1 | Google Fonts（已自動載入） |
| 水晶球數字 | Reggae One | SIL OFL 1.1 | Fontworks，Google Fonts（已自動載入） |

思源黑體與 Reggae One 由 Google Fonts CDN 自動供應，不需要做任何事。

## 建議安裝台北黑體（可選，但推薦）

台北黑體不在 Google Fonts 上，需要自行安裝才會生效。
未安裝時主標題會自動退回思源黑體，版面正常，只是標題與內文
會是同一套字（仍以字重、字級、顏色區分層級）。

安裝方式：
1. 前往翰字鑄造 JT Foundry 官網下載 Taipei Sans TC Beta（免費）
2. Windows：對 .ttf 檔按右鍵 → 安裝字型
3. 重新整理頁面即可看到效果

若要讓「所有訪客」都看到台北黑體（而非只有你自己的電腦），
需把字型檔放進本資料夾並命名為 title.woff2 或 title.ttf。
OFL 授權允許這樣做，可放心散布。

## 為什麼不是原本指定的字型

原先指定的三款皆為商用授權字型，無法免費散布：

- 文鼎黑體（文鼎科技）— 商用授權
- 石井黑體（写研／森澤體系）— 商用授權
- 虹蛸天国（森澤 Morisawa，2024 年發表）— 需 Morisawa Fonts 訂閱

因此改用經查證的開源對應字型：

- 台北黑體以思源黑體為基礎改作，設計目標即為對標印刷風格的
  商業黑體（華康／文鼎一系），是最接近的免費選擇。
- 思源黑體為乾淨的人文黑體，長文可讀性佳。
- Reggae One 是 Fontworks 釋出的展示字型，銳利的收筆帶有動態感，
  與虹蛸天国同樣走強烈視覺衝擊路線。備援為 Dela Gothic One（極粗黑體）。

若日後你取得了原本三款字型的網頁授權，只要把字型檔放進本資料夾
（title / sub / magic .woff2），並在 src/app.css 的 @font-face 內
加回對應的 local() 名稱即可，不需改動其他程式。

## 離線使用

Google Fonts 需要網路。若要完全離線運作，可自行下載
Noto Sans TC 與 Reggae One（皆為 OFL）放入本資料夾，
並在 app.css 中改為 url() 載入。

## 轉檔（縮小檔案）

    pip install fonttools brotli
    fonttools ttLib.woff2 compress -o title.woff2 TaipeiSansTCBeta-Bold.ttf

中文字型檔通常 5–15MB，建議用 pyftsubset 子集化只保留用到的字。
