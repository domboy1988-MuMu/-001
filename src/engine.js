/**
 * ============================================
 *  東方靈數占卜｜計算引擎 (engine.js)
 *  職責：西元生日 → 純數字
 *  ⚠️ 此層不產生任何話術文字、不涉及外觀
 * ============================================
 */

/* ---------- 1. 常數 ---------- */

// 核心維度（雷達圖用，5 軸）
const DIMENSIONS = ["木", "火", "土", "金", "水"];

const DIMENSION_COLORS = {
  木: "#5FA46A", 火: "#C7614A", 土: "#C79A4A", 金: "#B5A24A", 水: "#5A82AD",
};

// 生命靈數 → 五行（東方化轉譯層）
const ELEMENT_MAP = {
  1: "木", 2: "木",
  3: "火", 4: "火",
  5: "土", 6: "土",
  7: "金", 8: "金",
  9: "水", 11: "水", 22: "水", 33: "水",
};

// 五行相生相剋（避爛桃花、開運建議會用到）
const SHENG = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" }; // 我生
const KE    = { 木: "土", 火: "金", 土: "水", 金: "木", 水: "火" }; // 我剋
const BEI_SHENG = { 火: "木", 土: "火", 金: "土", 水: "金", 木: "水" }; // 生我
const BEI_KE    = { 土: "木", 金: "火", 水: "土", 木: "金", 火: "水" }; // 剋我

const MASTER_NUMBERS = [11, 22, 33];

/* ---------- 2. 基礎工具 ---------- */

/** 數字加總歸一，遇 11/22/33 停止 */
function reduce(n) {
  while (n > 9 && !MASTER_NUMBERS.includes(n)) {
    n = String(n).split("").reduce((s, c) => s + Number(c), 0);
  }
  return n;
}

/**
 * 完全歸一至 1–9，不保留大師數。
 * ⚠️ 流年專用：流年是「九年一循環」，若停在 11/22 循環會斷掉，
 *    報告中「你正走到九年週期的第 N 年」的敘事就會自相矛盾。
 */
function reduceFull(n) {
  while (n > 9) {
    n = String(n).split("").reduce((s, c) => s + Number(c), 0);
  }
  return n;
}

/** 把整數拆成各位數相加，例：2026 → 2+0+2+6 = 10 */
function digitSum(n) {
  return String(Math.abs(n)).split("").reduce((s, c) => s + Number(c), 0);
}

/* ---------- 3. 輸入驗證（邊界處理） ---------- */

/**
 * 靈數不像八字要接節氣、也不像星座有交界日，
 * 但仍有必須擋掉的邊界：非法日期、閏年 2/29、超出合理年份。
 */
function validateDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { ok: false, reason: "格式需為 YYYY-MM-DD" };
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  if (y < 1900 || y > 2100) return { ok: false, reason: "年份需在 1900–2100 之間" };
  if (m < 1 || m > 12) return { ok: false, reason: "月份不合法" };

  // 逐月天數（含閏年判斷）
  const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const maxDay = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  if (d < 1 || d > maxDay) return { ok: false, reason: `${y}/${m} 沒有 ${d} 日` };

  return { ok: true, y, m, d };
}

/* ---------- 4. 四個核心數字 ---------- */

/**
 * 生命靈數（主命數）：西元年月日全部數字相加歸一
 * 例：1994-07-22 → 1+9+9+4+0+7+2+2 = 34 → 7
 */
function lifePathNumber(y, m, d) {
  return reduce(digitSum(y) + digitSum(m) + digitSum(d));
}

/**
 * 內在數 / 外在數：拆解「歸一前的兩位數」（後天數）
 *
 * 例：1988-07-20 → 1+9+8+8+0+7+2+0 = 35 → 內在數 3、外在數 5，主命數 8
 *
 * 十位數＝面對事情的第一反應（本能的、內在的）
 * 個位數＝隨後調整成的樣子（他人看見的、外顯的）
 *
 * ⚠️ 兩個必須處理的例外：
 *  1. 總和本身就是個位數（2000 年後出生常見，如 2000-01-01 總和 4）
 *     → 沒有內外之分，屬「表裡如一」型
 *  2. 總和為 11/22/33 → 內外同數，能量加倍而非衝突
 */
function innerOuterNumbers(y, m, d) {
  const rawSum = digitSum(y) + digitSum(m) + digitSum(d);

  if (rawSum < 10) {
    return { rawSum, inner: rawSum, outer: rawSum, unified: true, singleDigit: true };
  }
  const inner = Math.floor(rawSum / 10);
  const outer = rawSum % 10;
  return { rawSum, inner, outer, unified: inner === outer, singleDigit: false };
}

/**
 * 內外落差（0–9）：數字差距越大，別人眼中的你與真實的你落差越大
 */
function innerOuterGap(inner, outer) {
  return Math.abs(inner - outer);
}
/**
 * 天賦數：出生「日」歸一
 * ⚠️ 刻意只用「日」，不用「月+日」。
 *    因為數位根在加法下守恆，若用月+日會與態度數永遠相同（除非碰到大師數），
 *    兩個維度就失去獨立性、報告會自打嘴巴。
 * 例：22 日 → 22（大師數，保留）；15 日 → 6
 */
function talentNumber(d) {
  return reduce(d);
}

/**
 * 態度數（靈魂渴望數）：出生月 + 出生日 歸一
 * 例：07 + 22 = 29 → 11（大師數，保留）
 */
function attitudeNumber(m, d) {
  return reduce(digitSum(m) + digitSum(d));
}

/**
 * 流年數字：出生月 + 出生日 + 查詢年份 歸一
 * 例：07-22 的人查 2026 → 7+22+2026 各位數相加 → 21 → 3
 */
function personalYearNumber(m, d, year) {
  return reduceFull(digitSum(m) + digitSum(d) + digitSum(year));
}

/* ---------- 5. 衍生指標 ---------- */

/** 五行分布（雷達圖）：由四個核心數字加權投票產生 */
function elementDistribution(life, talent, attitude, personalYear) {
  const dist = {}; DIMENSIONS.forEach((k) => (dist[k] = 0));

  const lifeEl = ELEMENT_MAP[life];

  // 權重：主命數必須壓過其餘三者的總和（2.5+2.0+1.5=6.0），
  // 否則會出現「五行屬金，但最旺是木」這種自打嘴巴的矛盾。
  const votes = [
    [life, 6.5], [talent, 2.5], [attitude, 2.0], [personalYear, 1.5],
  ];
  votes.forEach(([num, w]) => {
    const el = ELEMENT_MAP[num];
    if (el) dist[el] += w;
  });

  // 相生加成：主命五行滋養它所生的五行
  dist[SHENG[lifeEl]] += 1.0;
  // 貴人五行（生我者）給予基礎存在感，同時避免弱項全部並列同分
  dist[BEI_SHENG[lifeEl]] += 0.5;

  // 保底：避免出現接近 0% 導致雷達圖塌成尖刺
  DIMENSIONS.forEach((k) => (dist[k] += 1.5));

  // ⚠️ 硬保證：主命五行必須是最旺的。
  // 當天賦/態度/流年剛好都落在同一個五行時，三者總和會超過主命數，
  // 導致報告出現「五行屬金，但最旺是木」的自打嘴巴矛盾。
  // 與其反覆微調權重去猜，直接在此處確保不變條件成立。
  const maxOther = Math.max(...DIMENSIONS.filter((k) => k !== lifeEl).map((k) => dist[k]));
  if (dist[lifeEl] <= maxOther) dist[lifeEl] = maxOther * 1.08;

  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  const pct = {};
  DIMENSIONS.forEach((k) => (pct[k] = Math.round((dist[k] / total) * 1000) / 10));
  return { raw: dist, pct, lifeEl };
}

/**
 * 桃花強度（0–100）
 * ⚠️ 不可用 `attitude % 9`：態度數為 9 時餘數為 0，加成整個消失，
 *    會出現「文案說桃花偏多、分數卻只有 50」的矛盾。改用對照表。
 */
const PEACH_BASE = { 1: 62, 2: 74, 3: 82, 4: 58, 5: 80, 6: 76, 7: 60, 8: 66, 9: 72, 11: 84, 22: 64, 33: 78 };
// 五行修正：必須與 content.js 的桃花元素文案方向一致
const PEACH_ELEMENT_MOD = { 金: 8, 火: 6, 水: 4, 木: 0, 土: -2 };

function peachScore(attitude, element) {
  const base = PEACH_BASE[attitude] ?? 68;
  return Math.max(40, Math.min(96, Math.round(base + (PEACH_ELEMENT_MOD[element] ?? 0))));
}

/** 該年運勢指數（0–100）：不可隨機，必須由流年數字推導 */
// 流年恆為 1–9（九年循環），不含大師數
const YEAR_ENERGY = { 1: 78, 2: 66, 3: 84, 4: 62, 5: 80, 6: 74, 7: 58, 8: 88, 9: 64 };
function yearScore(pyNum) {
  return YEAR_ENERGY[pyNum] ?? 70;
}

/** 總評分數（0–100）：用五行平衡度推導，不隨機 */
function overallScore(pct, peach) {
  const vals = DIMENSIONS.map((k) => pct[k]);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
  const balance = Math.max(0, 100 - Math.sqrt(variance) * 2.5);
  return Math.max(52, Math.min(97, Math.round(balance * 0.6 + peach * 0.4)));
}

/* ---------- 5.5 先天數：缺數與重複數 ---------- */

/** 五行 → 對應數字（ELEMENT_MAP 的反查表） */
const ELEMENT_NUMBERS = {
  木: [1, 2], 火: [3, 4], 土: [5, 6], 金: [7, 8], 水: [9, 11, 22, 33],
};

/**
 * 先天數分析：出生年月日中出現過哪些數字
 *  缺數   = 1–9 當中完全沒出現的（天生較弱、需後天補足的特質）
 *  重複數 = 出現兩次以上的（天生被強化的特質，過多則失衡）
 * 例：1988-07-20 → 數字 1,9,8,8,0,7,2,0
 *     出現 1,2,7,8,9｜缺 3,4,5,6｜重複 8（2次）、0（2次）
 */
function innateDigits(y, m, d) {
  const digits = `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`.split("").map(Number);
  const count = {};
  digits.forEach((n) => (count[n] = (count[n] || 0) + 1));

  const present = [];
  const missing = [];
  for (let i = 1; i <= 9; i++) (count[i] ? present : missing).push(i);

  const repeated = Object.entries(count)
    .filter(([n, c]) => Number(n) >= 1 && c >= 2)
    .map(([n, c]) => ({ num: Number(n), times: c }))
    .sort((a, b) => b.times - a.times);

  return { digits, count, present, missing, repeated, hasZero: (count[0] || 0) > 0 };
}

/**
 * 契合數字：用五行生剋推導
 *  夥伴（事業）＝ 生我的五行 → 能補足、扶持你的人
 *  戀人（感情）＝ 我生的五行 + 同五行 → 你願意付出的人，以及頻率相同的人
 *  避開       ＝ 剋我的五行 → 相處時你容易被消耗
 */
function matchNumbers(element) {
  const same = ELEMENT_NUMBERS[element] || [];
  const support = ELEMENT_NUMBERS[BEI_SHENG[element]] || [];
  const nourish = ELEMENT_NUMBERS[SHENG[element]] || [];
  const drain = ELEMENT_NUMBERS[BEI_KE[element]] || [];
  return {
    partner: support,                              // 事業夥伴
    partnerElement: BEI_SHENG[element],
    lover: [...nourish, ...same],                  // 戀人
    loverElement: `${SHENG[element]}／${element}`,
    avoid: drain,                                  // 需留意
    avoidElement: BEI_KE[element],
  };
}

/* ---------- 5.6 九宮格連線 ---------- */

/**
 * 九宮格排列（由左上至右下填入 1–9）：
 *     1 2 3
 *     4 5 6
 *     7 8 9
 * 此排列使 1-5-9 與 3-5-7 恰為兩條對角線，與各家連線命名相符。
 */
const GRID = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];

/**
 * 八條連線。名稱採台灣生命靈數常見說法，
 * 部分連線各派別叫法略有出入，此處取流通度最高者並加註別名。
 */
const GRID_LINES = [
  { id: "123", nums: [1, 2, 3], name: "藝術線", alias: "行動線", kind: "row" },
  { id: "456", nums: [4, 5, 6], name: "組織線", alias: "知能主線", kind: "row" },
  { id: "789", nums: [7, 8, 9], name: "貴人線", alias: "權力線", kind: "row" },
  { id: "147", nums: [1, 4, 7], name: "務實線", alias: "執行力線", kind: "col" },
  { id: "258", nums: [2, 5, 8], name: "感情線", alias: "心智線", kind: "col" },
  { id: "369", nums: [3, 6, 9], name: "智慧線", alias: "創意線", kind: "col" },
  { id: "159", nums: [1, 5, 9], name: "事業線", alias: "目標線", kind: "diag" },
  { id: "357", nums: [3, 5, 7], name: "財智線", alias: "人緣線", kind: "diag" },
];

/**
 * 計算九宮格。
 *
 * 入格數字＝先天數（出生年月日各位數）＋後天數（歸一前兩位數拆開）＋主命數。
 * 0 不入格（九宮格只有 1–9）。
 * 同一數字出現多次即在格內累加，次數越多能量越強。
 */
function buildGrid(y, m, d, io, life) {
  const count = {};
  for (let i = 1; i <= 9; i++) count[i] = 0;

  const push = (n) => { if (n >= 1 && n <= 9) count[n]++; };

  // 先天數
  `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`
    .split("").map(Number).forEach(push);
  // 後天數（單位數時只有一個）
  if (io.singleDigit) push(io.rawSum);
  else { push(io.inner); push(io.outer); }
  // 主命數（大師數拆為兩位再入格，例如 11 → 1、1）
  if (life >= 10) String(life).split("").map(Number).forEach(push);
  else push(life);

  const present = [];
  const missing = [];
  for (let i = 1; i <= 9; i++) (count[i] ? present : missing).push(i);

  // 判定連線
  const lines = GRID_LINES.map((L) => {
    const on = L.nums.every((n) => count[n] > 0);
    const strength = L.nums.reduce((s, n) => s + count[n], 0);
    const weakest = L.nums.reduce((a, n) => (count[n] < count[a] ? n : a), L.nums[0]);
    const lacking = L.nums.filter((n) => !count[n]);
    return { ...L, on, strength, weakest, lacking };
  });

  const onLines = lines.filter((l) => l.on);

  /* 連線能量（0–100）
     以「條數」為主、「強度」為輔。
     強度需設上限，否則單一數字重複多次（如生日含三個 8）
     就能把分數推到頂，與實際格局豐富度不符。
     校準目標：無連線約 25–36、全連線約 95，中位數落在 55–60。 */
  const totalStrength = onLines.reduce((s, l) => s + l.strength, 0);
  const energy = onLines.length === 0
    ? Math.max(20, Math.min(38, Math.round(20 + present.length * 2.2)))
    : Math.min(96, Math.round(30 + onLines.length * 6.5 + Math.min(totalStrength, 32) * 0.45));

  return {
    grid: GRID,
    count,
    present,
    missing,
    lines,
    onLines,
    onCount: onLines.length,
    // 最強連線：條件相同時取排序在前者，確保結果穩定可重現
    strongest: onLines.length
      ? onLines.reduce((a, l) => (l.strength > a.strength ? l : a), onLines[0])
      : null,
    // 差一個數字就能成形的連線，是最值得補的方向
    nearMiss: lines.filter((l) => !l.on && l.lacking.length === 1),
    energy,
    maxCount: Math.max(...Object.values(count)),
  };
}

/* ---------- 5.7 大運：0–120 歲的階段推算 ---------- */

/**
 * 大運以九年為一步，自出生起算，推至 120 歲（共 14 步）。
 *
 * 每步的大運數 = 主命數 + 步數，再歸一至 1–9。
 * 如此每九步循環一次（81 年），與流年的九年小循環形成大小雙循環，
 * 這是本系統的推法；各家排大運方式不同，此處採可完整複現的算法。
 *
 * ⚠️ 大運數與流年數不同：
 *    流年逐年變動，看的是當年的節奏；
 *    大運九年一變，看的是整個人生階段的基調。
 */
const DAYUN_SPAN = 9;
const DAYUN_MAX_AGE = 120;

function buildDayun(life, personalYearNow, birthYear, baseYear) {
  const currentAge = baseYear - birthYear;
  const steps = [];

  for (let k = 0; k * DAYUN_SPAN < DAYUN_MAX_AGE; k++) {
    const from = k * DAYUN_SPAN;
    const to = Math.min(from + DAYUN_SPAN - 1, DAYUN_MAX_AGE);
    // 大運數：主命數推進 k 步
    const num = reduceFull(life + k);
    steps.push({
      index: k,
      from, to,
      num,
      years: [birthYear + from, birthYear + to],
      current: currentAge >= from && currentAge <= to,
      past: currentAge > to,
    });
  }

  const currentStep = steps.find((s) => s.current) || null;
  return {
    currentAge,
    span: DAYUN_SPAN,
    maxAge: DAYUN_MAX_AGE,
    steps,
    currentStep,
    currentIndex: currentStep ? currentStep.index : -1,
  };
}

/* ---------- 6. 主計算函式 ---------- */

/**
 * @param {string} dateStr - "1994-07-22"（西元）
 * @param {object} opts - { gender, name, concern, baseYear }
 * @returns {object} 純數字結果（話術層與版型層都吃這包）
 */
function computeChart(dateStr, opts = {}) {
  const v = validateDate(dateStr);
  if (!v.ok) throw new Error("生日不合法：" + v.reason);
  const { y, m, d } = v;

  const baseYear = opts.baseYear || new Date().getFullYear();

  // --- 6.1 四個核心數字（基礎命盤，證明真的有算）---
  const life = lifePathNumber(y, m, d);
  const talent = talentNumber(d);
  const attitude = attitudeNumber(m, d);
  const personalYear = personalYearNumber(m, d, baseYear);
  const io = innerOuterNumbers(y, m, d);
  const innate = innateDigits(y, m, d);
  const grid = buildGrid(y, m, d, io, life);
  const dayun = buildDayun(life, personalYear, y, baseYear);

  const element = ELEMENT_MAP[life];
  const match = matchNumbers(element);

  // --- 6.2 五行分布（雷達圖）---
  const { raw, pct } = elementDistribution(life, talent, attitude, personalYear);
  const sorted = DIMENSIONS.map((k) => [k, pct[k]]).sort((a, b) => b[1] - a[1]);

  // --- 6.3 桃花與總評 ---
  const peach = peachScore(attitude, element);
  const score = overallScore(pct, peach);

  // --- 6.4 流年時間軸（未來 5 年，折線圖）---
  const timeline = [];
  for (let i = 0; i < 5; i++) {
    const yy = baseYear + i;
    const num = personalYearNumber(m, d, yy);
    timeline.push({ year: yy, number: num, score: yearScore(num) });
  }

  return {
    // 輸入回顯
    input: { date: dateStr, year: y, month: m, day: d, gender: opts.gender ?? null, name: opts.name ?? null, concern: opts.concern ?? "all" },

    // 基礎命盤（報告第 2 章表格用）
    base: [
      { label: "生命靈數", value: life,   note: MASTER_NUMBERS.includes(life) ? "大師數" : "" },
      { label: "天賦數",   value: talent, note: MASTER_NUMBERS.includes(talent) ? "大師數" : "" },
      { label: "態度數",   value: attitude, note: MASTER_NUMBERS.includes(attitude) ? "大師數" : "" },
      { label: "流年數字", value: personalYear, note: `${baseYear} 年` },
      { label: "內在數 / 外在數", value: io.singleDigit ? `${io.rawSum}（表裡如一）` : `內 ${io.inner} / 外 ${io.outer}`, note: `後天數 ${io.rawSum}` },
    ],

    // 核心數字（話術層全部吃這些）
    numbers: { life, talent, attitude, personalYear, inner: io.inner, outer: io.outer },

    // 內在數 / 外在數（拆解後天數）
    innerOuter: {
      rawSum: io.rawSum,
      inner: io.inner,
      outer: io.outer,
      unified: io.unified,
      singleDigit: io.singleDigit,
      gap: innerOuterGap(io.inner, io.outer),
    },
    isMaster: MASTER_NUMBERS.includes(life),

    // 五行
    element,
    elementRaw: raw,
    elementPct: pct,
    strongest: sorted[0][0],
    weakest: sorted[sorted.length - 1][0],

    // 五行關係（避爛桃花／開運建議用）
    relations: {
      sheng: SHENG[element],        // 我生（付出對象）
      ke: KE[element],              // 我剋（我能掌控）
      beiSheng: BEI_SHENG[element], // 生我（貴人）
      beiKe: BEI_KE[element],       // 剋我（爛桃花高風險來源）
    },

    // 先天數：缺數與重複數
    innate,
    // 九宮格與連線
    grid,
    // 大運（0–120 歲）
    dayun,
    // 契合數字
    match,

    // 分數
    peachScore: peach,
    score,

    // 時間軸
    baseYear,
    timeline,
  };
}

/* ---------- 7. 匯出 ---------- */

if (typeof module !== "undefined") {
  module.exports = {
    computeChart, validateDate, reduce, reduceFull,
    lifePathNumber, talentNumber, attitudeNumber, personalYearNumber, innerOuterNumbers, innerOuterGap,
    innateDigits, matchNumbers, buildGrid, buildDayun,
    GRID, GRID_LINES,
    DIMENSIONS, DIMENSION_COLORS, ELEMENT_MAP, ELEMENT_NUMBERS, MASTER_NUMBERS,
  };
}
