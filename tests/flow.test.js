/**
 * 完整流程回歸測試｜node tests/flow.test.js
 *
 * 驗證整條使用者路徑的每個銜接點：
 *   開場 → 點水晶球 → 輸入生日（自動送出）→ 計算 → 揭曉
 *   → v3 播完直接進命格總覽 → v4 播完 → BGM 淡入並無限循環
 *
 * 為何需要：這條鏈路橫跨影片事件、計時器與音訊狀態，
 * 任何一環改動都可能讓後續斷掉，而且不會拋錯——
 * 使用者只會看到「卡住」或「沒有音樂」，難以追查。
 */
const fs=require("fs"),vm=require("vm"),path=require("path");
process.chdir(path.join(__dirname,".."));
const store={}, timers=[];
const mk=id=>{
  if(store[id])return store[id];
  const L={};
  const e={id,style:{},dataset:{},value:"",innerHTML:"",textContent:"",scrollTop:0,selectionStart:0,
    volume:0,muted:false,loop:false,src:"",currentTime:0,paused:true,_played:0,offsetWidth:0,
    _cls:new Set(),
    classList:{toggle(c,f){f===undefined?(e._cls.has(c)?e._cls.delete(c):e._cls.add(c)):(f?e._cls.add(c):e._cls.delete(c))},
      add(c){e._cls.add(c)},remove(c){e._cls.delete(c)},contains(c){return e._cls.has(c)}},
    addEventListener(ev,fn){ (L[ev]=L[ev]||[]).push(fn); },
    _fire(ev,a){ (L[ev]||[]).forEach(f=>f(a||{target:e})); },
    play(){e._played++;e.paused=false;return Promise.resolve()},pause(){e.paused=true},
    focus(){},blur(){},scrollIntoView(){},
    querySelectorAll(){return[]},querySelector(){return e},closest(){return null},onclick:null};
  store[id]=e;return e;
};
const ctx={console:{log(){},warn(){},error(){}},Math,Date,JSON,String,Number,Object,Array,RegExp,Promise,Error,
  parseInt,parseFloat,isNaN,
  setTimeout:(f,ms)=>{timers.push({f,ms,cancelled:false});return timers.length},
  clearTimeout:i=>{if(timers[i-1])timers[i-1].cancelled=true},
  setInterval:(f)=>{if(f)f();return 1},clearInterval(){}};
ctx.document={getElementById:mk,querySelectorAll:()=>[],querySelector:()=>mk("q"),
  body:{classList:{toggle(){}}},addEventListener(){}};
ctx.addEventListener=()=>{};ctx.window=ctx;ctx.location={protocol:"http:"};
vm.createContext(ctx);
["src/engine.js","src/content.js","src/magnetic.js","src/magnetic-content.js"].forEach(f=>
  vm.runInContext(fs.readFileSync(f,"utf8"),ctx,{filename:f}));
vm.runInContext(fs.readFileSync("src/app.js","utf8"),ctx,{filename:"app.js"});

let pass=0,fail=0;
const ok=(l,c,x="")=>{c?pass++:fail++;console.log(`${c?"✅":"❌"} ${l}${x?"  "+x:""}`)};
const S=()=>vm.runInContext("stage",ctx);
const bgm=store["bgm"];

console.log("\n【模擬完整流程】");
console.log("─ 1. 開場 ─");
ok("初始為 intro", S()==="intro");
ok("v1 已播放", store["v1"]._played>0);
ok("音樂未播", bgm._played===0);

console.log("─ 2. 點擊水晶球 ─");
bgm._fire("canplay");
store["hotBall"]._cls.clear();
vm.runInContext('stage="intro";',ctx);
store["hotBall"]._fire("click");
ok("進入 collect", S()==="collect");
ok("已記住音樂意圖", vm.runInContext("bgmWanted",ctx)===true);
ok("影片期間音樂仍不播", bgm._played===0);

console.log("─ 3. 輸入生日 → 自動送出 ─");
store["bd"].value="19880720";
store["bd"]._fire("input",{target:store["bd"]});
const t=timers.filter(x=>!x.cancelled).pop();
t.f();
ok("進入 calc", S()==="calc");
ok("v2 已播放", store["v2"]._played>0);

console.log("─ 4. 計算完成 → 揭曉 ─");
timers.filter(x=>!x.cancelled&&x.ms===9000).forEach(x=>x.f());
ok("進入 reveal", S()==="reveal");
ok("v3 已播放", store["v3"]._played>0);

console.log("─ 5. v3 播完 → 直接進命格總覽 ─");
store["v3"]._fire("ended");
ok("進入 result（命格總覽）", S()==="result", "stage="+S());
ok("v4 已播放", store["v4"]._played>0);
ok("報告已渲染", vm.runInContext("pages && pages.length",ctx)===8, vm.runInContext("pages?pages.length+' 頁':'未渲染'",ctx));
ok("顯示第 1 頁（命格總覽）", vm.runInContext("pageIdx",ctx)===0);
ok("此時音樂仍未播", bgm._played===0);

console.log("─ 6. v4 播完 → 音樂淡入 ─");
store["v4"]._fire("ended");
ok("音樂開始播放", bgm._played===1, `播放次數 ${bgm._played}`);
ok("音樂為無限循環", bgm.loop===true);
ok("音量已淡入", bgm.volume>0, `volume=${bgm.volume}`);
ok("靜音鈕已顯示", store["mute"].style.display==="flex");

console.log("─ 7. 保險機制 ─");
const guard=timers.filter(x=>!x.cancelled&&x.ms===11000);
ok("有 11 秒保險計時器", guard.length>0);
const before=bgm._played;
guard.forEach(x=>x.f());
ok("保險觸發不會重複播放", bgm._played===before, `仍為 ${bgm._played} 次`);

console.log(`\n${fail===0?"🎉 流程完整無斷點":"⚠️ 流程有問題"}：${pass} passed, ${fail} failed`);
process.exit(fail===0?0:1);
