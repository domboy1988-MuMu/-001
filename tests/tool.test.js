/**
 * 數字檢測工具與關於面板｜node tests/tool.test.js
 *
 * 檢測工具：初始 5 列自由欄位、自訂名稱、未命名的預設名、
 *          新增至上限 10 列、達上限隱藏按鈕、隱私警語存在。
 * 關於面板：上架必備的六個區塊（免責、隱私、購買、客服、政策連結）。
 *
 * 為何需要：此頁跨模組運算且欄位全為動態產生，
 * 任一環節取到 undefined 都會讓結果區空白且不報錯——
 * 使用者只會看到「按了沒反應」。
 */
const fs=require("fs"),vm=require("vm"),path=require("path");
process.chdir(path.join(__dirname,".."));
const store={}; let rows=[];
function makeRow(){
  const f={};
  const r={className:"trow",_html:"",
    set innerHTML(v){this._html=v},get innerHTML(){return this._html},
    querySelector(s){ return f[s]||(f[s]={value:"",style:{},focus(){},onclick:null}); },
    querySelectorAll(){return[]},remove(){rows=rows.filter(x=>x!==r)},
    get firstElementChild(){return r}};
  return r;
}
// 依選擇器回傳對應元素：.trow 給列本身、.tdel 給該列的刪除鈕
function pick(sel){
  if(sel.includes(".tdel")) return rows.map(r=>r.querySelector(".tdel"));
  return rows;
}
const mk=id=>{
  if(store[id])return store[id];
  const L={};
  const e={id,style:{},dataset:{},value:"",innerHTML:"",textContent:"",scrollTop:0,duration:10,
    classList:{toggle(){},add(){},remove(){},contains(){return false}},
    addEventListener(ev,fn){(L[ev]=L[ev]||[]).push(fn)},_fire(ev,a){(L[ev]||[]).forEach(f=>f(a||{target:e}))},
    play(){return Promise.resolve()},pause(){},focus(){},blur(){},scrollIntoView(){},
    querySelectorAll(sel){ return id==="toolRows" ? pick(sel) : []; },
    querySelector(){return null},closest(){return null},
    appendChild(n){ rows.push(n); },onclick:null};
  store[id]=e;return e;
};
const ctx={console:{log(){}},Math,Date,JSON,String,Number,Object,Array,RegExp,Promise,Error,parseInt,parseFloat,isNaN,isFinite,Set,
  setTimeout:f=>{if(f)f();return 1},clearTimeout(){},setInterval:f=>{if(f)f();return 1},clearInterval(){},alert(){},open(){}};
ctx.document={getElementById:mk,
  querySelectorAll:(sel)=> sel.includes("toolRows") ? pick(sel) : [],
  querySelector:()=>mk("q"),
  createElement:()=>makeRow(),
  body:{classList:{toggle(){}}},addEventListener(){}};
ctx.addEventListener=()=>{};ctx.window=ctx;ctx.location={protocol:"http:",href:""};
vm.createContext(ctx);
["src/engine.js","src/content.js","src/magnetic.js","src/magnetic-content.js"].forEach(f=>vm.runInContext(fs.readFileSync(f,"utf8"),ctx));
vm.runInContext(fs.readFileSync("src/app.js","utf8"),ctx);
// 檢測工具屬付費內容，先切到解鎖狀態
vm.runInContext("unlocked=true;",ctx);
vm.runInContext('chart=computeChart("1988-07-20",{baseYear:2026});report=generateReport(chart);magnet=analyzeNumber("19880720");magRep=generateMagneticReport(magnet,chart);pages=buildPages();',ctx);

let pass=0,fail=0;
const ok=(l,c,x="")=>{c?pass++:fail++;console.log(`${c?"✅":"❌"} ${l}${x?"  "+x:""}`)};

console.log("\n── 檢測頁結構 ──");
const pg=vm.runInContext("buildPages()",ctx);
const tp=pg.find(p=>p.t.replace(/\s/g,"")==="數字檢測");
ok("檢測頁存在", !!tp);
ok("初始 5 列空白欄位", (tp.h.match(/class="trow"/g)||[]).length===5, `${(tp.h.match(/class="trow"/g)||[]).length} 列`);
ok("無固定項目名稱", !/身分證字號|電話號碼|銀行帳號/.test(tp.h.replace(/可以填什麼[\s\S]*?系統會算出什麼/,"")));
ok("有可填什麼說明", /可以填什麼/.test(tp.h));
ok("有系統會算什麼說明", /系統會算出什麼/.test(tp.h));
ok("有身分證舉例", /M121864569/.test(tp.h));
ok("有隱私警語", /不會留下任何記錄/.test(tp.h) && /個資/.test(tp.h));
ok("新增按鈕", /id="toolAdd"/.test(tp.h));
ok("測算按鈕", /id="toolRun"/.test(tp.h));

console.log("\n── 自由欄位運算 ──");
rows=[]; for(let i=0;i<5;i++) rows.push(makeRow());
vm.runInContext("bindTool();",ctx);
rows[0].querySelector(".tname").value="身分證";
rows[0].querySelector(".tnum").value="121864569";
rows[1].querySelector(".tname").value="手機";
rows[1].querySelector(".tnum").value="0912345678";
rows[2].querySelector(".tname").value="";
rows[2].querySelector(".tnum").value="1978";
mk("toolOut").innerHTML="";
mk("toolRun").onclick();
const o=mk("toolOut").innerHTML;
ok("有產出", o.length>800, `${o.length} 字元`);
ok("自訂名稱顯示", o.includes("身分證")&&o.includes("手機"));
ok("未命名給預設名", /項目 3/.test(o));
ok("無破圖", !/undefined|NaN|\[object Object\]/.test(o));

console.log("\n── 新增與上限 ──");
for(let i=0;i<10;i++) mk("toolAdd").onclick();
ok("上限 10 列", rows.length===10, `${rows.length} 列`);
ok("達上限隱藏按鈕", mk("toolAdd").style.display==="none");

console.log("\n── 關於面板 ──");
vm.runInContext("openAbout();",ctx);
const a=mk("about").innerHTML;
// 按鈕文字含全形空格（如「恢 復 購 買」），比對前先去除空白
const flat = a.replace(/\s/g,"");
["免責聲明","隱私與資料","購買與退款","聯繫客服","恢復購買","隱私權政策","服務條款",
 "不會儲存或上傳","不構成醫療"].forEach(k=>
  ok(`含「${k}」`, flat.includes(k)));
ok("有版本號", /版本 \d+\.\d+\.\d+/.test(a));

console.log(`\n${fail===0?"🎉 全部通過":"⚠️ 有失敗"}：${pass} passed, ${fail} failed`);
process.exit(fail===0?0:1);
