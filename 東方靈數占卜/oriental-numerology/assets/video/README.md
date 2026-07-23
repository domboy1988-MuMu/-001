# 影片素材放這裡

把你做好的四支動畫**照下面的檔名**丟進這個資料夾（`assets/video/`），
程式會自動接上，不用改任何一行程式碼。

## 檔名規則（請完全照抄，含大小寫與連字號）

| 放這個檔名 | 對應場景 | 用在哪個 Stage | 播放方式 |
|---|---|---|---|
| `v1-intro.mp4` | 開場迎賓（占星師睜眼邀請） | intro | 單次播放，播完停在最後一幀 |
| `v2-casting.mp4` | 施法凝視（水晶球發光） | calculation | 循環播放（建議先做 boomerang） |
| `v3-reveal.mp4` | 開示轉場（爆光揭曉數字） | calculation → free-result | 單次播放，播完自動轉場 |
| `v4-outro.mp4` | 尾聲挽留（引導銷售頁） | free-result → sales | 單次播放，停在最後一幀當背景 |

## 建議規格

- **格式**：MP4（H.264）為主。若要更小的檔案可再放一份同名 `.webm`，程式會優先用 WebM、抓不到才回退 MP4。
- **比例**：手機直式 `1080×1920`；若你做的是橫式 `1920×1080` 也可以，**但四支要統一**，不要混用。
- **單支大小**：建議壓到 5MB 以內（首頁那支尤其重要，太大會拖慢載入）。
- **音訊**：V1／V2／V4 有口白的請保留音軌。壓縮時**千萬不要加 `-an` 參數**，會把口白整個消音。

## 首幀圖（poster）

每支影片再附一張首幀 JPG，放在 `assets/img/`，檔名對應：
`v1-poster.jpg`、`v2-poster.jpg`、`v3-poster.jpg`、`v4-poster.jpg`

用途：影片還沒載完時先顯示這張圖，避免出現黑畫面。可以用這行指令產生：

```bash
ffmpeg -i v1-intro.mp4 -vframes 1 -q:v 2 ../img/v1-poster.jpg
```

## V2 的 boomerang（正播＋倒播）

計算動畫需要循環，若直接 loop 會在首尾接點看到明顯跳幀。做成 boomerang 就會順：

```bash
ffmpeg -i v2-casting.mp4 -filter_complex "[0]reverse[r];[0][r]concat=n=2:v=1:a=0" v2-casting-loop.mp4
```

產生後把 `v2-casting-loop.mp4` 改名成 `v2-casting.mp4` 覆蓋即可（長度會變成兩倍，這是正常的）。

## 檔案還沒放進來會怎樣？

不會壞掉。程式偵測不到影片時會自動退回「純 CSS 動畫版」的水晶球，功能照常運作，
你可以先開發、之後再補素材。
