/**
 * 載入測試｜模擬瀏覽器逐一執行 <script>
 * 執行：node tests/load.test.js
 *
 * 為何需要這支測試：
 *   語法檢查（new Function）只檢查單一檔案，抓不到「跨檔案的變數衝突」。
 *   實際發生過的事故：入口檔用 const 宣告 UNLOCKED，app.js 又用 var 宣告，
 *   瀏覽器拋出 SyntaxError 導致整個 app.js 不執行 → 全黑畫面，
 *   但每個檔案單獨檢查都是「正確」的。
 *   這支測試以共用全域的方式依序載入所有腳本，能重現該類問題。
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (l, c, x = "") => { c ? pass++ : fail++; console.log(`${c ? "✅" : "❌"} ${l}${x ? "  " + x : ""}`); };

/* ---------- 假 DOM ---------- */
function makeStub() {
  const el = {
    style: {}, dataset: {}, value: "", textContent: "", innerHTML: "",
    scrollTop: 0, selectionStart: 0, disabled: false, muted: false,
    volume: 0, currentTime: 0, loop: false, src: "",
    classList: { toggle(){}, add(){}, remove(){}, contains(){ return false; } },
    addEventListener(){}, removeEventListener(){},
    play(){ return Promise.resolve(); }, pause(){},
    querySelectorAll(){ return []; }, querySelector(){ return el; },
    focus(){}, onclick: null, appendChild(){},
  };
  return el;
}

function loadAll(unlocked) {
  const stub = makeStub();
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date, JSON, String, Number, Object, Array, RegExp, Promise, Error,
    setTimeout: () => 0, clearTimeout(){}, setInterval: () => 0, clearInterval(){},
    parseInt, parseFloat, isNaN,
  };
  ctx.document = {
    getElementById: () => stub,
    querySelectorAll: () => [],
    querySelector: () => stub,
    body: { classList: { toggle(){}, add(){}, remove(){} } },
    addEventListener(){},
  };
  ctx.addEventListener = () => {};
  ctx.window = ctx;
  ctx.location = { protocol: "http:" };
  vm.createContext(ctx);

  const files = [
    "src/engine.js", "src/content.js",
    "src/magnetic.js", "src/magnetic-content.js",
  ];
  for (const f of files) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
  }
  vm.runInContext(`window.UNLOCKED = ${unlocked};`, ctx, { filename: "inline" });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "src/app.js"), "utf8"), ctx, { filename: "src/app.js" });
  return ctx;
}

console.log("\n── 全腳本載入（模擬瀏覽器）──");
let freeCtx = null, paidCtx = null;
try { freeCtx = loadAll(false); ok("demo.html 腳本鏈載入成功", true); }
catch (e) { ok("demo.html 腳本鏈載入成功", false, e.constructor.name + ": " + e.message); }
try { paidCtx = loadAll(true); ok("unlock.html 腳本鏈載入成功", true); }
catch (e) { ok("unlock.html 腳本鏈載入成功", false, e.constructor.name + ": " + e.message); }

if (freeCtx && paidCtx) {
  console.log("\n── 旗標正確傳遞 ──");
  ok("免費版 UNLOCKED === false", vm.runInContext("UNLOCKED", freeCtx) === false);
  ok("付費版 UNLOCKED === true", vm.runInContext("UNLOCKED", paidCtx) === true);

  console.log("\n── 關鍵函式皆已定義 ──");
  ["computeChart", "generateReport", "analyzeNumber", "generateMagneticReport",
   "buildPages", "unlockedPages", "renderBook", "showPage", "renderSales", "bindTool", "runTool",
   "bgmStart", "bgmPlay", "bgmFade"].forEach((fn) => {
    ok(`${fn}`, vm.runInContext(`typeof ${fn}`, freeCtx) === "function");
  });

  console.log("\n── 兩版內容差異 ──");
  const build = (ctx) => {
    vm.runInContext(`chart=computeChart("1990-01-01",{baseYear:2026});
      report=generateReport(chart);
      magnet=analyzeNumber("19900101");
      magRep=generateMagneticReport(magnet,chart);`, ctx);
    return vm.runInContext("buildPages()", ctx);
  };
  const free = build(freeCtx), paid = build(paidCtx);
  ok("免費版頁數少於付費版", free.length < paid.length, `${free.length} vs ${paid.length} 頁`);
  const fh = free.map(p => p.h).join(""), ph = paid.map(p => p.h).join("");
  // 付費牆已改為「僅最後一頁」的設計：內文章節全部公開，
  // 免費版最後一頁以預告與 CTA 收束，頁內不再出現遮罩區塊。
  ok("免費版章節無遮罩（人格與數字全公開）", (fh.match(/class="veil"/g) || []).length === 0);
  ok("付費版無遮罩", (ph.match(/class="veil"/g) || []).length === 0);
  ok("免費版最後一頁有購買 CTA", /id="toSales"/.test(free[free.length - 1].h));
  ok("免費版缺數頁與付費版內容一致（不上鎖）", (() => {
    const a = free.find(p => p.t.includes("缺")), b = paid.find(p => p.t.includes("缺"));
    return a && b && a.h === b.h;
  })());
  ok("兩版皆無破圖", !/undefined|NaN|\[object Object\]/.test(fh + ph));
}

console.log("\n── 常數不可重複宣告 ──");
{
  // 曾發生過：修改常數區時整段複製，造成 const 重複宣告，
  // 瀏覽器直接拋 SyntaxError 使整個 app.js 不執行（全黑畫面）。
  const src = fs.readFileSync(path.join(ROOT, "src/app.js"), "utf8");
  const names = ["CALC_MS","REVEAL_NUM_MS","REVEAL_END_MS","REVEAL_POS",
                 "AUTO_SUBMIT_MS","SUN_HOTSPOT_ENABLED","HOTSPOTS","PROGRESS",
                 "BGM_VOLUME","VID_VOLUME","BGM_SRC"];
  const dup = names.filter(n =>
    (src.match(new RegExp("^const\\s+" + n + "\\s*[=({]", "gm")) || []).length !== 1);
  ok("所有常數皆唯一宣告", dup.length === 0, dup.join(","));
}

console.log("\n── 入口檔結構 ──");
["demo.html", "unlock.html"].forEach((f) => {
  const h = fs.readFileSync(path.join(ROOT, f), "utf8");
  ok(`${f} 使用 window.UNLOCKED（避免變數衝突）`, /window\.UNLOCKED\s*=/.test(h));
  ok(`${f} 未用 const/let 宣告 UNLOCKED`, !/(const|let)\s+UNLOCKED/.test(h));
  ok(`${f} 引入 app.css`, /app\.css/.test(h));
  ok(`${f} 引入 app.js`, /app\.js/.test(h));
  const need = ["bgm", "mute", "stage", "v1", "v2", "v3", "v4", "book", "sales"];
  const ids = [...h.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const miss = need.filter(i => !ids.includes(i));
  ok(`${f} DOM 元素齊全`, miss.length === 0, miss.join(","));
});



console.log(`\n${fail === 0 ? "🎉 全部通過" : "⚠️ 有失敗項"}：${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
