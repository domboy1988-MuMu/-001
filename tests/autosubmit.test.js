/**
 * 自動送出回歸測試｜node tests/autosubmit.test.js
 *
 * 為何需要：生日填妥後會在 1 秒後自動送出。此機制若失效，
 * 可能出現兩種災難——(a) 使用者修改到一半就被送出，
 * (b) 離開該頁後計時器仍觸發，把人硬拉回計算畫面。
 * 這支測試以假計時器精準驗證排程、取消與階段防護。
 */
const fs=require("fs"),vm=require("vm"),path=require("path");
process.chdir(path.join(__dirname,".."));
const store={},timers=[];
const mk=id=>{if(store[id])return store[id];const L={};const e={id,style:{},dataset:{},value:"",innerHTML:"",textContent:"",scrollTop:0,selectionStart:0,
  _cls:new Set(),
  classList:{toggle(c,f){f===undefined?(e._cls.has(c)?e._cls.delete(c):e._cls.add(c)):(f?e._cls.add(c):e._cls.delete(c))},add(c){e._cls.add(c)},remove(c){e._cls.delete(c)},contains(c){return e._cls.has(c)}},
  addEventListener(ev,fn){L[ev]=fn},_fire(ev,a){L[ev]&&L[ev](a||{target:e})},
  play(){return Promise.resolve()},pause(){},focus(){},blur(){},scrollIntoView(){},
  offsetWidth:0,querySelectorAll(){return[]},querySelector(){return e},closest(){return null},onclick:null};
  store[id]=e;return e};
const ctx={console:{log(){},warn(){},error(){}},Math,Date,JSON,String,Number,Object,Array,RegExp,Promise,Error,parseInt,parseFloat,isNaN,
  setTimeout:(f,ms)=>{const t={f,ms,cancelled:false};timers.push(t);return timers.length;},
  clearTimeout:(i)=>{if(timers[i-1])timers[i-1].cancelled=true;},
  setInterval:()=>0,clearInterval(){}};
ctx.document={getElementById:mk,querySelectorAll:()=>[],querySelector:()=>mk("q"),body:{classList:{toggle(){}}},addEventListener(){}};
ctx.addEventListener=()=>{};ctx.window=ctx;ctx.location={protocol:"http:"};
vm.createContext(ctx);
["src/engine.js","src/content.js","src/magnetic.js","src/magnetic-content.js"].forEach(f=>vm.runInContext(fs.readFileSync(f,"utf8"),ctx));
vm.runInContext("window.UNLOCKED=false;",ctx);
vm.runInContext(fs.readFileSync("src/app.js","utf8"),ctx);

function type(v){ store["bd"].value=v; store["bd"]._fire("input",{target:store["bd"]}); }
const pending=()=>timers.filter(t=>!t.cancelled&&t.f.toString().includes("submit")).length;

vm.runInContext('stage="collect";',ctx);
let pass=0,fail=0;
const ok=(l,c,x="")=>{c?pass++:fail++;console.log(`${c?"✅":"❌"} ${l}${x?"  "+x:""}`)};

console.log("── 自動送出行為 ──");
type("1990");
ok("輸入未完成 → 不排程", pending()===0);
ok("輸入未完成 → 無倒數樣式", !store["bd"]._cls.has("counting"));

type("19900101");
ok("八碼合法 → 已排程", pending()===1);
ok("八碼合法 → 顯示倒數", store["bd"]._cls.has("counting"));

const before=pending();
type("199001011");   // 繼續輸入
ok("繼續輸入 → 舊計時取消", timers.filter(t=>t.cancelled).length>0);

type("19900102");    // 改成另一個合法日期
ok("改正後 → 重新排程", pending()>=1);

type("19901301");    // 不合法月份
ok("日期不合法 → 不排程", pending()===0, "月份 13");
ok("日期不合法 → 無倒數樣式", !store["bd"]._cls.has("counting"));

console.log("\n── 觸發後確認 ──");
type("19880720");
const t=timers.filter(x=>!x.cancelled).pop();
ok("計時器等待約 1 秒", t.ms===1000, `實際 ${t.ms}ms`);
// 模擬計時到期
let submitted=false;
try{ t.f(); submitted = vm.runInContext("stage",ctx)==="calc"; }catch(e){ console.log("  執行錯誤:",e.message); }
ok("到期後進入計算階段", submitted, "stage="+vm.runInContext("stage",ctx));
ok("已算出命盤", vm.runInContext("chart && chart.numbers.life",ctx)===8, "生命靈數="+vm.runInContext("chart?chart.numbers.life:'無'",ctx));

console.log("\n── 離開頁面後不應誤觸發 ──");
vm.runInContext('stage="collect";',ctx);
type("19900101");
const t2=timers.filter(x=>!x.cancelled).pop();
vm.runInContext('stage="result";',ctx);   // 使用者已離開
const stageBefore=vm.runInContext("stage",ctx);
t2.f();
ok("階段已改變 → 不執行送出", vm.runInContext("stage",ctx)===stageBefore);

console.log(`\n${fail===0?"🎉 全部通過":"⚠️ 有失敗"}：${pass} passed, ${fail} failed`);
process.exit(fail===0?0:1);
