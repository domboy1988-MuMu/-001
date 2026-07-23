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
   "buildPages", "unlockedPages", "renderBook", "bindTool", "runTool", "renderSales",
   "bgmStart", "bgmDuck"].forEach((fn) => {
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
  ok("免費版有付費牆", (fh.match(/class="veil"/g) || []).length > 0);
  ok("付費版無付費牆", (ph.match(/class="veil"/g) || []).length === 0);
  ok("兩版皆無破圖", !/undefined|NaN|\[object Object\]/.test(fh + ph));
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


console.log("\n── 數字檢測工具實際送出（模擬按鈕點擊）──");
if (paidCtx) {
  // 建立可互動的假 DOM 來實際觸發 onclick
  const store = {};
  const mkEl = (id) => {
    if (store[id]) return store[id];
    const L = {};
    const e = {
      id, style:{}, dataset:{}, value:"", textContent:"", innerHTML:"", scrollTop:0,
      classList:{toggle(){},add(){},remove(){},contains(){return false;}},
      addEventListener(ev,fn){ L[ev]=fn; },
      play(){return Promise.resolve();}, pause(){}, focus(){}, blur(){}, scrollIntoView(){},
      querySelectorAll(){return [];}, querySelector(){return e;}, closest(){return null;}, onclick:null,
    };
    store[id]=e; return e;
  };
  const ctx2 = {
    console:{log(){},warn(){},error(){}}, Math, Date, JSON, String, Number, Object, Array, RegExp, Promise, Error,
    parseInt, parseFloat, isNaN, setTimeout:(f)=>{ if(f)f(); return 0; }, clearTimeout(){}, setInterval:()=>0, clearInterval(){},
  };
  ctx2.document = { getElementById:(id)=>mkEl(id), querySelectorAll:()=>[], querySelector:()=>mkEl("q"),
    body:{classList:{toggle(){}}}, addEventListener(){} };
  ctx2.addEventListener=()=>{}; ctx2.window=ctx2; ctx2.location={protocol:"http:"};
  vm.createContext(ctx2);
  ["src/engine.js","src/content.js","src/magnetic.js","src/magnetic-content.js"].forEach(f=>
    vm.runInContext(fs.readFileSync(path.join(ROOT,f),"utf8"),ctx2,{filename:f}));
  vm.runInContext("window.UNLOCKED=true;",ctx2);
  vm.runInContext(fs.readFileSync(path.join(ROOT,"src/app.js"),"utf8"),ctx2,{filename:"src/app.js"});
  vm.runInContext(`chart=computeChart("1988-07-20",{baseYear:2026});report=generateReport(chart);magnet=analyzeNumber("19880720");magRep=generateMagneticReport(magnet,chart);pages=buildPages();`,ctx2);

  let bindOk=true;
  try { vm.runInContext("bindTool();",ctx2); } catch(e){ bindOk=false; }
  ok("bindTool 執行無誤", bindOk);
  ok("送出按鈕已綁定 onclick", store["toolGo"] && typeof store["toolGo"].onclick === "function");

  // 測多種號碼，每一種都要真的產出結果、不得拋錯
  const cases = ["0912345678","A123456789","1688","0000","ABC-5678","999888777"];
  let allOk = true, detail = "";
  cases.forEach(num=>{
    store["toolIn"].value = num;
    store["toolOut"].innerHTML = "";
    try {
      store["toolGo"].onclick();
      if (!store["toolOut"].innerHTML) { allOk=false; detail += `「${num}」無產出; `; }
    } catch(e) { allOk=false; detail += `「${num}」拋錯:${e.message}; `; }
  });
  ok("各種號碼送出都有結果、不拋錯", allOk, detail);

  // 換分頁後再送出
  let tabOk = true;
  try {
    if (store["toolIn"]) { store["toolIn"].value="0212345678"; }
    toolTabIfAny(ctx2);
    store["toolGo"].onclick();
    if (!store["toolOut"].innerHTML) tabOk=false;
  } catch(e){ tabOk=false; }
  ok("切換場域後仍可送出", tabOk);
}
function toolTabIfAny(ctx2){ try{ vm.runInContext("toolTab=2;",ctx2); }catch(e){} }

console.log(`\n${fail === 0 ? "🎉 全部通過" : "⚠️ 有失敗項"}：${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
