/**
 * 話術層回歸測試｜每次改 content.js 都要跑過
 * 執行：node tests/content.test.js
 */
const E = require("../src/engine.js");
const C = require("../src/content.js");
const crypto = require("crypto");

let pass = 0, fail = 0;
function ok(label, cond, extra = "") {
  cond ? pass++ : fail++;
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  " + extra : ""}`);
}

console.log("\n── 對照表完整性 ──");
ok("LIFE_PATH 涵蓋 1-9 + 11/22/33", [1,2,3,4,5,6,7,8,9,11,22,33].every(n => C.LIFE_PATH[n]));
ok("CAREER 涵蓋 1-9 + 11/22", [1,2,3,4,5,6,7,8,9,11,22].every(n => C.CAREER[n]));
ok("IDEAL_TYPE 涵蓋 1-9 + 11/22", [1,2,3,4,5,6,7,8,9,11,22].every(n => C.IDEAL_TYPE[n]));
ok("YEAR_FORTUNE 涵蓋 1-9（九年循環）", [1,2,3,4,5,6,7,8,9].every(n => C.YEAR_FORTUNE[n]));
ok("五行表齊全", ["木","火","土","金","水"].every(e => C.PEACH_ELEMENT[e] && C.BAD_PEACH[e] && C.LUCKY[e]));

console.log("\n── 單筆報告結構 ──");
const r = C.generateReport(E.computeChart("1994-07-22", { baseYear: 2026 }));
[
  ["總評", r.summary?.headline],
  ["基礎命盤", r.base?.length === 5],
  ["內外組合", r.innerOuter?.type && r.innerOuter?.verdict],
  ["性格核心", r.personality?.desc],
  ["桃花元素", r.peachBlossom?.name],
  ["會遇到什麼類型", r.peachBlossom?.meetType],
  ["避爛桃花", r.avoidBadPeach?.signs?.length >= 4],
  ["工作運", r.career?.fit?.length >= 3],
  ["理想型", r.idealType?.type],
  ["流年 5 年", r.yearFortune?.timeline?.length === 5],
  ["開運建議", r.lucky?.colors?.length >= 3],
].forEach(([k, v]) => ok(`章節存在：${k}`, Boolean(v)));

console.log("\n── 「超過 60 項」要做實 ──");
ok("項目數 ≥ 60", r.highlights.total >= 60, `實際 ${r.highlights.total} 項`);
ok("分類 6–8 類", r.highlights.categories.length >= 6, `實際 ${r.highlights.categories.length} 類`);
const dup = r.highlights.items.length - new Set(r.highlights.items.map(i => i.text)).size;
ok("項目無重複（不可拿前面內容充數）", dup === 0, `重複 ${dup} 項`);

console.log("\n── 全量掃描：不可有 undefined / NaN 污染 ──");
let polluted = 0, crashed = 0, minItems = 9999, checked = 0;
for (let y = 1960; y <= 2010; y += 2) {
  for (let m = 1; m <= 12; m++) {
    for (const d of [1, 11, 22, 28]) {
      const ds = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (!E.validateDate(ds).ok) continue;
      checked++;
      try {
        const rr = C.generateReport(E.computeChart(ds, { baseYear: 2026 }));
        minItems = Math.min(minItems, rr.highlights.total);
        if (/undefined|NaN|\[object Object\]/.test(JSON.stringify(rr))) polluted++;
      } catch (e) { crashed++; }
    }
  }
}
console.log(`   掃描 ${checked} 筆，最少項目數 ${minItems}`);
ok("零崩潰", crashed === 0, `崩潰 ${crashed}`);
ok("零 undefined/NaN 污染", polluted === 0, `污染 ${polluted}`);
ok("每份報告都 ≥ 60 項", minItems >= 60);

console.log("\n── 撞報告率（專屬感）──");
const hashes = new Map(); let n = 0;
for (let y = 1975; y <= 2005; y++) {
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 28; d++) {
      const ds = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const rr = C.generateReport(E.computeChart(ds, { baseYear: 2026 }));
      const h = crypto.createHash("md5").update(JSON.stringify(rr)).digest("hex");
      hashes.set(h, (hashes.get(h) || 0) + 1); n++;
    }
  }
}
const counts = [...hashes.values()];
const collide = counts.reduce((s, c) => s + c * (c - 1), 0) / (n * (n - 1)) * 100;
console.log(`   ${n} 筆生日 → ${hashes.size} 種不重複報告`);
ok("撞報告率 < 1%", collide < 1, `實際 ${collide.toFixed(2)}%`);

console.log("\n── 文案品質（避坑指南）──");
const allText = JSON.stringify(r);
ok("無恐嚇話術", !/血光|大凶|災厄|報應|必有禍/.test(allText));
ok("無保證性承諾", !/一定會發財|保證|必定成功|絕對會/.test(allText));
ok("無銷售 CTA（已付費報告）", !/立即購買|加入購物車|限時優惠|馬上下單/.test(allText));

console.log(`\n${fail === 0 ? "🎉 全部通過" : "⚠️ 有失敗項"}：${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
