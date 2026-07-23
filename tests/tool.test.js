/**
 * 數字檢測工具回歸測試｜node tests/tool.test.js
 *
 * 驗證：未填欄位的提示、單項與多項計算、極端數字不崩潰、
 *      自訂欄位上限（3 項）與達上限後按鈕隱藏。
 *
 * 為何需要：此頁彙整多個輸入並跨模組運算（磁場、契合度、化解狀況），
 * 任一環節取到 undefined 都會讓整個結果區空白且不報錯——
 * 使用者只會看到「按了沒反應」。
 */
const fs=require("fs"),vm=require("vm"),path=require("path");
process.chdir(path.join(__dirname,".."));
const store={}, customRows=[];
const mkEl=(id)=>{
  if(store[id])return store[id];
  const L={};
  const e={id,style:{},dataset:{},value:"",innerHTML:"",textContent:"",scrollTop:0,duration:10,
    _cls:new Set(),
    classList:{toggle(){},add(){},remove(){},contains(){return false}},
    addEventListener(ev,fn){(L[ev]=L[ev]||[]).push(fn)},_fire(ev,a){(L[ev]||[]).forEach(f=>f(a||{target:e}))},
    play(){return Promise.resolve()},pause(){},focus(){},blur(){},scrollIntoView(){},
    querySelectorAll(sel){ return id==="toolCustom" ? customRows : []; },
    querySelector(){return null},closest(){return null},
    appendChild(n){ customRows.push(n); },onclick:null};
  store[id]=e;return e;
};
const ctx={console:{log(){}},Math,Date,JSON,String,Number,Object,Array,RegExp,Promise,Error,parseInt,parseFloat,isNaN,isFinite,Set,
  setTimeout:f=>{if(f)f();return 1},clearTimeout(){},setInterval:f=>{if(f)f();return 1},clearInterval(){}};
ctx.document={getElementById:mkEl,
  querySelectorAll:(sel)=> sel.includes("toolCustom") ? customRows : [],
  querySelector:()=>mkEl("q"),
  createElement:()=>{ const fields={};
    return {className:"",_html:"",
      set innerHTML(v){this._html=v},get innerHTML(){return this._html},
      querySelector:(s)=>fields[s]||(fields[s]={value:"",focus(){}}),
      querySelectorAll:()=>[]};},
  body:{classList:{toggle(){}}},addEventListener(){}};
ctx.addEventListener=()=>{};ctx.window=ctx;ctx.location={protocol:"http:"};
vm.createContext(ctx);
["src/engine.js","src/content.js","src/magnetic.js","src/magnetic-content.js"].forEach(f=>vm.runInContext(fs.readFileSync(f,"utf8"),ctx));
vm.runInContext("window.UNLOCKED=true;",ctx);
vm.runInContext(fs.readFileSync("src/app.js","utf8"),ctx);
vm.runInContext('chart=computeChart("1988-07-20",{baseYear:2026});report=generateReport(chart);magnet=analyzeNumber("19880720");magRep=generateMagneticReport(magnet,chart);pages=buildPages();',ctx);
vm.runInContext("bindTool();",ctx);

let pass=0,fail=0;
const ok=(l,c,x="")=>{c?pass++:fail++;console.log(`${c?"✅":"❌"} ${l}${x?"  "+x:""}`)};

console.log("\n── 未填任何欄位 ──");
mkEl("toolOut").innerHTML="";
mkEl("toolRun").onclick();
ok("提示需填入數字", /請至少填入/.test(mkEl("toolOut").innerHTML));

console.log("\n── 填入單一欄位 ──");
mkEl("t_phone").value="0912345678";
mkEl("toolOut").innerHTML="";
mkEl("toolRun").onclick();
const o1=mkEl("toolOut").innerHTML;
ok("產出結果", o1.length>500, `${o1.length} 字元`);
ok("含逐項結果", /逐項結果/.test(o1));
ok("含整體統計", /整體統計/.test(o1));
ok("含補到什麼", /你補到了什麼/.test(o1));
ok("含還缺什麼", /還缺什麼/.test(o1));
ok("含化解狀況", /本命凶星的化解狀況/.test(o1));
ok("含行動建議", /給你的行動建議/.test(o1));
ok("無破圖", !/undefined|NaN|\[object Object\]/.test(o1));

console.log("\n── 填入多個欄位 ──");
mkEl("t_id").value="A123456789";
mkEl("t_bank").value="00212345678";
mkEl("t_plate").value="ABC1234";
mkEl("toolOut").innerHTML="";
mkEl("toolRun").onclick();
const o2=mkEl("toolOut").innerHTML;
ok("四項都出現", ["身分證字號","電話號碼","銀行帳號","車牌號碼"].every(n=>o2.includes(n)));
ok("無破圖", !/undefined|NaN|\[object Object\]/.test(o2));

console.log("\n── 邊界：極端數字 ──");
[["0000","全 0"],["1","單一位數"],["99999999999999","超長"],["","空值"]].forEach(([v,d])=>{
  mkEl("t_phone").value=v; mkEl("toolOut").innerHTML="";
  try{ mkEl("toolRun").onclick();
    ok(`${d} 不崩潰`, !/undefined|NaN|\[object Object\]/.test(mkEl("toolOut").innerHTML));
  }catch(e){ ok(`${d} 不崩潰`, false, e.message); }
});

console.log("\n── 自訂欄位上限 ──");
mkEl("t_phone").value="0912345678";
for(let i=0;i<5;i++) mkEl("toolAdd").onclick();
ok("最多 3 個自訂欄位", customRows.length===3, `實際 ${customRows.length}`);
ok("達上限後按鈕隱藏", mkEl("toolAdd").style.display==="none");

console.log(`\n${fail===0?"🎉 全部通過":"⚠️ 有失敗"}：${pass} passed, ${fail} failed`);
process.exit(fail===0?0:1);
