/**
 * 音訊回歸測試｜node tests/audio.test.js
 *
 * 設計：影片播放期間由影片音效主導，音樂不出聲；
 *      v4-outro 播完後才淡入音樂，作為閱讀報告時的背景。
 *      點擊水晶球只記住意圖並解除瀏覽器自動播放限制。
 *
 * 為何需要：音樂檔 3.3MB，若在 v4 結束時尚未載完，
 *      舊版會直接放棄且不再重試，整場沒有音樂且不報錯，極難察覺。
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const ROOT = path.join(__dirname, "..");

let pass = 0, fail = 0;
const ok = (l, c, x = "") => { c ? pass++ : fail++; console.log(`${c ? "✅" : "❌"} ${l}${x ? "  " + x : ""}`); };

function boot() {
  const store = {}, listeners = {};
  const mk = (id) => {
    if (store[id]) return store[id];
    const L = {};
    const e = {
      id, style: {}, dataset: {}, value: "", innerHTML: "", textContent: "",
      volume: 0, muted: false, loop: false, src: "", currentTime: 0, paused: true,
      _played: 0,
      _cls: new Set(),
      classList: {
        toggle(c, f) { f === undefined ? (e._cls.has(c) ? e._cls.delete(c) : e._cls.add(c)) : (f ? e._cls.add(c) : e._cls.delete(c)); },
        add(c) { e._cls.add(c); }, remove(c) { e._cls.delete(c); }, contains(c) { return e._cls.has(c); },
      },
      addEventListener(ev, fn) { L[ev] = fn; },
      _fire(ev, a) { if (L[ev]) L[ev](a || { target: e }); },
      play() { e._played++; e.paused = false; return Promise.resolve(); },
      pause() { e.paused = true; },
      focus() {}, blur() {}, scrollIntoView() {},
      querySelectorAll() { return []; }, querySelector() { return e; },
      closest() { return null; }, onclick: null,
    };
    store[id] = e; listeners[id] = L;
    return e;
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    Math, Date, JSON, String, Number, Object, Array, RegExp, Promise, Error,
    parseInt, parseFloat, isNaN,
    setTimeout: (f) => { if (f) f(); return 1; }, clearTimeout() {},
    setInterval: (f) => { if (f) f(); return 1; }, clearInterval() {},
  };
  ctx.document = {
    getElementById: mk, querySelectorAll: () => [], querySelector: () => mk("q"),
    body: { classList: { toggle() {} } }, addEventListener() {},
  };
  ctx.addEventListener = () => {};
  ctx.window = ctx;
  ctx.location = { protocol: "http:" };
  vm.createContext(ctx);
  ["src/engine.js", "src/content.js", "src/magnetic.js", "src/magnetic-content.js"]
    .forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f }));
  vm.runInContext(fs.readFileSync(path.join(ROOT, "src/app.js"), "utf8"), ctx, { filename: "src/app.js" });
  return { ctx, store };
}

console.log("\n── 影片播放期間音樂不應出聲 ──");
{
  const { ctx, store } = boot();
  const bgm = store["bgm"];
  bgm._fire("canplay");                                // 音樂已載好
  vm.runInContext("bgmStart();", ctx);                 // 使用者點水晶球
  ok("已記住播放意圖", vm.runInContext("bgmWanted", ctx) === true);
  ok("影片期間仍不播放（避免與音效打架）", bgm._played === 0, `播放次數 ${bgm._played}`);
  store["v4"]._fire("ended");                          // v4-outro 播完
  ok("v4 結束後才開始播放", bgm._played === 1);
  ok("音量已提升", bgm.volume > 0, `volume=${bgm.volume}`);
}

console.log("\n── v4 結束時音樂尚未載完（易漏掉的情境）──");
{
  const { ctx, store } = boot();
  const bgm = store["bgm"];
  vm.runInContext("bgmStart();", ctx);
  store["v4"]._fire("ended");                          // 音樂還沒載好
  ok("未就緒時不強行播放", bgm._played === 0);
  vm.runInContext('stage="result";', ctx);
  bgm._fire("canplay");                                // 載好了
  ok("載好後自動補播", bgm._played === 1, `播放次數 ${bgm._played}`);
}

console.log("\n── 未點擊水晶球則不播放 ──");
{
  const { store } = boot();
  const bgm = store["bgm"];
  bgm._fire("canplay");
  store["v4"]._fire("ended");
  ok("沒有使用者互動 → 不播放", bgm._played === 0);
}

console.log("\n── 不重複播放 ──");
{
  const { ctx, store } = boot();
  const bgm = store["bgm"];
  bgm._fire("canplay");
  vm.runInContext("bgmStart();", ctx);
  store["v4"]._fire("ended");
  store["v4"]._fire("ended");                          // 重看報告時可能再次觸發
  ok("重複觸發不會疊播", bgm._played === 1, `播放次數 ${bgm._played}`);
}

console.log("\n── 音量設定 ──");
{
  const { ctx } = boot();
  const v = vm.runInContext("BGM_VOLUME", ctx), vv = vm.runInContext("VID_VOLUME", ctx);
  ok("BGM 音量在合理範圍", v > 0 && v <= 1, `${v}`);
  ok("影片音量在合理範圍", vv > 0 && vv <= 1, `${vv}`);
  /* 真正該驗的是「混音後音樂主導」，而非兩個數值誰大。
     素材響度：BGM -14.7 LUFS、影片已正規化至 -18.0 LUFS，
     兩者基準不同，直接比較 volume 數值沒有意義。 */
  const db = (lufs, vol) => lufs + 20 * Math.log10(vol);
  const gap = db(-14.7, v) - db(-18.0, vv);
  ok("混音後音樂高於影片音效 3dB 以上", gap >= 3, `高出 ${gap.toFixed(1)} dB`);
  ok("已無舊的 ducking 機制",
     !/bgmDuck|BGM_DUCKED|NARRATED/.test(fs.readFileSync(path.join(ROOT, "src/app.js"), "utf8")));
}

console.log("\n── 靜音鈕 ──");
{
  const { ctx, store } = boot();
  const bgm = store["bgm"];
  bgm._fire("canplay");
  vm.runInContext("bgmStart();", ctx);
  store["v4"]._fire("ended");
  const before = bgm._played;
  store["mute"]._fire("click");
  ok("靜音後暫停", bgm.paused === true);
  ok("影片一併靜音", ["v1", "v2", "v3", "v4"].every((id) => store[id].muted === true));
  store["mute"]._fire("click");
  ok("取消靜音後恢復播放", bgm._played > before, `${before} → ${bgm._played}`);
}

console.log("\n── 載入失敗時不應留下無效按鈕 ──");
{
  const { store } = boot();
  store["bgm"]._fire("error");
  ok("靜音鈕自動隱藏", store["mute"].style.display === "none");
}

console.log(`\n${fail === 0 ? "🎉 全部通過" : "⚠️ 有失敗項"}：${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
