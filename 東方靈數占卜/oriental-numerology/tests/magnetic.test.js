/**
 * 八星磁場回歸測試
 * 執行：node tests/magnetic.test.js
 */
const M = require("../src/magnetic.js");
const MC = require("../src/magnetic-content.js");
const E = require("../src/engine.js");

let pass=0, fail=0;
function ok(l,c,x=""){ c?pass++:fail++; console.log(`${c?"✅":"❌"} ${l}${x?"  "+x:""}`); }

console.log("\n── 配對表完整性（六十四卦）──");
const err = M.selfCheck();
ok("自我校驗無誤", err.length===0, err.join("; "));
ok("八大磁場齊全", M.FIELDS.length===8);
ok("吉凶各四", M.GOOD_FIELDS.length===4 && M.BAD_FIELDS.length===4);
ok("配對總數 64", Object.keys(M.PAIR_TO_FIELD).length===64);

console.log("\n── 已知組合對照（依公開資料）──");
ok("14 為生氣", M.PAIR_TO_FIELD["14"]==="生氣");
ok("67 為生氣", M.PAIR_TO_FIELD["67"]==="生氣");
ok("13 為天醫", M.PAIR_TO_FIELD["13"]==="天醫");
ok("11 為伏位", M.PAIR_TO_FIELD["11"]==="伏位");
ok("順序無關（41 亦為生氣）", M.PAIR_TO_FIELD["41"]==="生氣");

console.log("\n── 0 與 5 的處理 ──");
const z = M.extractPairs("10502030");
ok("0 與 5 被剔除", z.kept==="123");
ok("全 0/5 不產生磁場", M.analyzeNumber("00550055").total===0);
ok("無磁場時給中性分", M.analyzeNumber("0000").score===60);

console.log("\n── 拆解正確性 ──");
const a = M.analyzeNumber("19880720");
ok("1988-07-20 拆出 5 組", a.total===5, a.pairs.map(p=>p.pair+"="+p.field).join(" "));
ok("吉星比例 80%", a.goodRatio===80);
ok("主導磁場為延年", a.dominant==="延年");

console.log("\n── 化解規則 ──");
const hasTianyi = M.analyzeNumber("1372");   // 37絕命 + 72天醫
ok("天醫欺絕命：已化解", hasTianyi.resolve.find(r=>r.field==="絕命")?.resolved===true);
const noTianyi = M.analyzeNumber("37");
ok("無天醫：絕命未化解", noTianyi.resolve.find(r=>r.field==="絕命")?.resolved===false);

console.log("\n── 邊界 ──");
[["",0],["1",0],[null,0],["ABC",0]].forEach(([v,want])=>
  ok(`「${v}」→ ${want} 組`, M.analyzeNumber(v).total===want));

console.log("\n── 報告組裝 ──");
const chart = E.computeChart("1988-07-20",{baseYear:2026});
const rep = MC.generateMagneticReport(M.analyzeNumber("19880720"), chart);
["counts","breakdown","dominant","distribution","resolve","cross","recommend"].forEach(k=>
  ok(`欄位存在：${k}`, rep[k]!==undefined));
ok("交叉解讀至少一則", rep.cross.length>=1);
ok("counts 可供其他章節引用", typeof rep.counts["天醫"]==="number");

console.log("\n── 全量壓力 ──");
let bad=0,n=0;
for(let i=0;i<12000;i++){
  let s=""; const len=1+Math.floor(Math.random()*14);
  for(let k=0;k<len;k++) s+=Math.floor(Math.random()*10);
  try{
    const x=M.analyzeNumber(s); n++;
    if(isNaN(x.score)||x.score<0||x.score>100) bad++;
    if(JSON.stringify(x).includes("undefined")) bad++;
  }catch(e){ bad++; }
}
ok(`隨機 ${n} 組零異常`, bad===0, `異常 ${bad}`);

console.log(`\n${fail===0?"🎉 全部通過":"⚠️ 有失敗項"}：${pass} passed, ${fail} failed\n`);
process.exit(fail===0?0:1);
