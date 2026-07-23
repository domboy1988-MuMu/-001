/**
 * 引擎回歸測試｜每次改 engine.js 都要跑過
 * 執行：node tests/engine.test.js
 */
const E = require("../src/engine.js");

let pass = 0, fail = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "✅" : "❌"} ${label}  got=${JSON.stringify(got)}${ok ? "" : ` want=${JSON.stringify(want)}`}`);
}

console.log("\n── 歸一與大師數 ──");
eq("reduce(34) → 7", E.reduce(34), 7);
eq("reduce(29) → 11（大師數不再歸一）", E.reduce(29), 11);
eq("reduce(4) → 4", E.reduce(4), 4);
eq("reduce(22) → 22（大師數）", E.reduce(22), 22);
eq("reduce(99) → 9（18→9，不停在 18）", E.reduce(99), 9);

console.log("\n── 生命靈數（手算對照）──");
// 1+9+9+4+0+7+2+2 = 34 → 7
eq("1994-07-22 → 7", E.lifePathNumber(1994, 7, 22), 7);
// 2+0+0+0+0+1+0+1 = 4
eq("2000-01-01 → 4", E.lifePathNumber(2000, 1, 1), 4);
// 1+9+8+7+1+1+2+9 = 38 → 11（大師數）
eq("1987-11-29 → 11", E.lifePathNumber(1987, 11, 29), 11);
// 1+9+9+9+1+2+3+1 = 35 → 8
eq("1999-12-31 → 8", E.lifePathNumber(1999, 12, 31), 8);

console.log("\n── 天賦 / 態度 / 流年 ──");
eq("天賦數 22日 → 22", E.talentNumber(22), 22);
eq("天賦數 15日 → 6", E.talentNumber(15), 6);
eq("態度數 7月22日 → 11", E.attitudeNumber(7, 22), 11);
eq("流年 7/22 於 2026 → 3", E.personalYearNumber(7, 22, 2026), 3);
eq("流年 7/22 於 2027 → 4", E.personalYearNumber(7, 22, 2027), 4);

console.log("\n── 獨立性檢查（天賦數 ≠ 態度數，避免維度撞號）──");
let collide = 0, total = 0;
for (let m = 1; m <= 12; m++) {
  for (let d = 1; d <= 28; d++) {
    total++;
    if (E.talentNumber(d) === E.attitudeNumber(m, d)) collide++;
  }
}
const rate = Math.round((collide / total) * 100);
console.log(`   撞號率 ${rate}%（${collide}/${total}）`);
eq("撞號率應低於 20%", rate < 20, true);

console.log("\n── 日期邊界 ──");
eq("2024-02-29 閏年合法", E.validateDate("2024-02-29").ok, true);
eq("2023-02-29 平年不合法", E.validateDate("2023-02-29").ok, false);
eq("2024-04-31 不存在", E.validateDate("2024-04-31").ok, false);
eq("2024-13-01 月份錯", E.validateDate("2024-13-01").ok, false);
eq("1899-01-01 超出範圍", E.validateDate("1899-01-01").ok, false);
eq("格式錯 1994/07/22", E.validateDate("1994/07/22").ok, false);

console.log("\n── 整合輸出 ──");
const r = E.computeChart("1994-07-22", { gender: "female", baseYear: 2026 });
eq("五行 = 金", r.element, "金");
eq("核心數字", r.numbers, { life: 7, talent: 22, attitude: 11, personalYear: 3, inner: 3, outer: 4 });
eq("內外數：1988-07-20 → 內3外5", (() => { const x = E.computeChart("1988-07-20", { baseYear: 2026 }).innerOuter; return [x.inner, x.outer]; })(), [3, 5]);
eq("內外數：1977-06-20 → 內3外2（對照網路公開案例）", (() => { const x = E.computeChart("1977-06-20", { baseYear: 2026 }).innerOuter; return [x.inner, x.outer]; })(), [3, 2]);
eq("單位數後天數 → 表裡如一", E.computeChart("2000-01-01", { baseYear: 2026 }).innerOuter.singleDigit, true);
eq("時間軸 5 年", r.timeline.length, 5);
eq("時間軸起始 2026", r.timeline[0].year, 2026);
const sum = Object.values(r.elementPct).reduce((a, b) => a + b, 0);
eq("五行百分比總和 ≈100", Math.abs(sum - 100) < 0.5, true);
eq("無 0% 五行（雷達圖不塌）", Math.min(...Object.values(r.elementPct)) > 0, true);
eq("總評分在 48–97", r.score >= 48 && r.score <= 97, true);

console.log("\n── 不變條件：主命五行必須永遠最旺（否則報告自打嘴巴）──");
let contradict = 0, scanned = 0;
for (let yy = 1960; yy <= 2010; yy++) {
  for (let mm = 1; mm <= 12; mm++) {
    for (const dd of [1, 7, 14, 20, 28]) {
      const ds2 = `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      const rr2 = E.computeChart(ds2, { baseYear: 2026 });
      scanned++;
      if (rr2.strongest !== rr2.element) contradict++;
    }
  }
}
console.log(`   掃描 ${scanned} 筆`);
eq("零矛盾（strongest === element）", contradict, 0);

console.log("\n── 全量掃描：1900–2100 每一天都不能爆 ──");
let crashed = 0, checked = 0;
for (let y = 1900; y <= 2100; y += 7) {
  for (let m = 1; m <= 12; m++) {
    for (const d of [1, 11, 22, 28, 29, 30, 31]) {
      const ds = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (!E.validateDate(ds).ok) continue;
      checked++;
      try {
        const rr = E.computeChart(ds, { baseYear: 2026 });
        if (!rr.element || !(rr.score > 0)) crashed++;
      } catch (e) { crashed++; }
    }
  }
}
console.log(`   掃描 ${checked} 筆`);
eq("零崩潰", crashed, 0);

console.log(`\n${fail === 0 ? "🎉 全部通過" : "⚠️ 有失敗項"}：${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
