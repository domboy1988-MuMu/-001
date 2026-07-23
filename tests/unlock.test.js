/**
 * 解鎖流程回歸測試｜node tests/unlock.test.js
 *
 * 免費與付費已合併為同一份程式的兩種執行狀態，
 * 因此必須驗證狀態切換的每個環節：
 *   未解鎖 8 頁且各章節有隱藏段落 → 解鎖 → 14 頁、段落展開、
 *   橫幅出現、回到第一頁 → 重新測算時完全重置。
 */
const fs=require("fs"),vm=require("vm"),path=require("path");
process.chdir(path.join(__dirname,".."));
const store={}; let rows=[];
const mk=id=>{
  if(store[id])return store[id];
  const L={};
  const e={id,style:{},dataset:{},value:"",innerHTML:"",textContent:"",scrollTop:0,duration:10,
    _cls:new Set(),
    classList:{toggle(c,f){f===undefined?(e._cls.has(c)?e._cls.delete(c):e._cls.add(c)):(f?e._cls.add(c):e._cls.delete(c))},add(c){e._cls.add(c)},remove(c){e._cls.delete(c)},contains(c){return e._cls.has(c)}},
    addEventListener(ev,fn){(L[ev]=L[ev]||[]).push(fn)},_fire(ev,a){(L[ev]||[]).forEach(f=>f(a||{target:e}))},
    play(){return Promise.resolve()},pause(){},focus(){},blur(){},scrollIntoView(){},
    querySelectorAll(){return id==="toolRows"?rows:[]},querySelector(){return null},
    closest(){return null},appendChild(n){rows.push(n)},onclick:null};
  store[id]=e;return e;
};
let confirmAnswer=true;
const ctx={console:{log(){}},Math,Date,JSON,String,Number,Object,Array,RegExp,Promise,Error,parseInt,parseFloat,isNaN,isFinite,Set,
  setTimeout:f=>{if(f)f();return 1},clearTimeout(){},setInterval:f=>{if(f)f();return 1},clearInterval(){},
  alert(){},confirm(){return confirmAnswer},open(){}};
ctx.document={getElementById:mk,querySelectorAll:()=>[],querySelector:()=>mk("q"),
  createElement:()=>({className:"",innerHTML:"",querySelector:()=>({value:"",style:{},focus(){}}),querySelectorAll:()=>[],get firstElementChild(){return this}}),
  body:{classList:{toggle(){}}},addEventListener(){}};
ctx.addEventListener=()=>{};ctx.window=ctx;ctx.location={protocol:"http:",href:""};
vm.createContext(ctx);
["src/engine.js","src/content.js","src/magnetic.js","src/magnetic-content.js"].forEach(f=>vm.runInContext(fs.readFileSync(f,"utf8"),ctx));
vm.runInContext(fs.readFileSync("src/app.js","utf8"),ctx);

let pass=0,fail=0;
const ok=(l,c,x="")=>{c?pass++:fail++;console.log(`${c?"✅":"❌"} ${l}${x?"  "+x:""}`)};

vm.runInContext('chart=computeChart("1988-07-20",{baseYear:2026});report=generateReport(chart);magnet=analyzeNumber("19880720");magRep=generateMagneticReport(magnet,chart);',ctx);

console.log("\n── 未解鎖狀態 ──");
ok("初始未解鎖", vm.runInContext("unlocked",ctx)===false);
let pg=vm.runInContext("buildPages()",ctx);
ok("免費 8 頁", pg.length===8, `${pg.length} 頁`);
let all=pg.map(p=>p.h).join("");
const lockCount=(all.match(/class="slot lock"/g)||[]).length;
ok("有隱藏段落", lockCount>=6, `${lockCount} 處`);
ok("無已解鎖段落", !/class="slot open/.test(all));
ok("有模糊條", /slot-blur/.test(all));
ok("無破圖", !/undefined|NaN|\[object Object\]/.test(all));

console.log("\n── 執行解鎖 ──");
vm.runInContext("doUnlock();",ctx);
ok("狀態已解鎖", vm.runInContext("unlocked",ctx)===true);
ok("book 加上 unlocked 類別", store["book"]._cls.has("unlocked"));
ok("橫幅已顯示", store["unlockBar"]._cls.has("on"));
ok("橫幅文字正確", /已\s*解\s*鎖/.test(store["unlockBar"].textContent), store["unlockBar"].textContent);
ok("回到第一頁", vm.runInContext("pageIdx",ctx)===0);

pg=vm.runInContext("buildPages()",ctx);
ok("付費 14 頁", pg.length===14, `${pg.length} 頁`);
all=pg.map(p=>p.h).join("");
const openCount=(all.match(/class="slot open/g)||[]).length;
ok("隱藏段落已展開", openCount>=6, `${openCount} 處`);
ok("無剩餘鎖定段落", !/class="slot lock"/.test(all));
ok("首次顯示帶高亮", /slot open fresh/.test(all));
ok("無破圖", !/undefined|NaN|\[object Object\]/.test(all));

console.log("\n── 重新測算應重置 ──");
vm.runInContext("restart();",ctx);
ok("解鎖狀態已重置", vm.runInContext("unlocked",ctx)===false);
ok("橫幅已收起", !store["unlockBar"]._cls.has("on"));

console.log(`\n${fail===0?"🎉 全部通過":"⚠️ 有失敗"}：${pass} passed, ${fail} failed`);
process.exit(fail===0?0:1);
