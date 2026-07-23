/**
 * ============================================
 *  數字易經・八星磁場 (magnetic.js)
 *  職責：數字序列 → 磁場組合、吉凶、化解分析、補強建議
 *  ⚠️ 此層只算不寫話術
 * ============================================
 *
 * 流派：數字易經／八星磁場學（源自易經八卦，與八宅風水九星同一套）
 * 與生命靈數的差異：
 *   生命靈數＝全部數字相加歸一 → 單一主數
 *   八星磁場＝拆成相鄰兩位數 → 多組磁場並存
 * 兩者可並行，不衝突。
 */

/* ---------- 1. 八大磁場 ---------- */

const FIELDS = ["生氣", "天醫", "延年", "伏位", "絕命", "五鬼", "六煞", "禍害"];
const GOOD_FIELDS = ["生氣", "天醫", "延年", "伏位"];
const BAD_FIELDS = ["絕命", "五鬼", "六煞", "禍害"];

/**
 * 數字組合對照表
 * 由八卦推導：1坎 2坤 3震 4巽 6乾 7兌 8艮 9離（5與0無卦，屬中性）
 * 自我校驗：每個數字都必須與其餘 7 個數字各配對一次，加上自身的伏位，
 *          恰好 8 組。此不變條件由 selfCheck() 驗證。
 */
const PAIR_MAP = {
  生氣: ["14", "41", "67", "76", "39", "93", "28", "82"],
  天醫: ["13", "31", "68", "86", "49", "94", "27", "72"],
  延年: ["19", "91", "78", "87", "34", "43", "26", "62"],
  伏位: ["11", "22", "33", "44", "66", "77", "88", "99"],
  絕命: ["12", "21", "69", "96", "48", "84", "37", "73"],
  五鬼: ["18", "81", "79", "97", "36", "63", "24", "42"],
  六煞: ["16", "61", "47", "74", "38", "83", "29", "92"],
  禍害: ["17", "71", "89", "98", "46", "64", "23", "32"],
};

/** 反查表：兩位數 → 磁場 */
const PAIR_TO_FIELD = {};
Object.entries(PAIR_MAP).forEach(([f, list]) => list.forEach((p) => (PAIR_TO_FIELD[p] = f)));

/**
 * 磁場強度權重（用於計分）
 * 吉星為正、凶星為負；伏位屬中性偏吉，權重最低。
 */
const FIELD_WEIGHT = {
  生氣: 10, 天醫: 10, 延年: 9, 伏位: 4,
  絕命: -9, 五鬼: -10, 六煞: -8, 禍害: -7,
};

/**
 * 化解規則
 * 凶星需要特定吉星同時存在才能被壓制或轉化。
 *  needAll  = 必須全部具備
 *  ordered  = 順序是否需正確（五鬼要求順序不可錯）
 */
const RESOLVE_RULES = {
  絕命: { needAll: ["天醫"], ordered: false, saying: "天醫欺絕命" },
  六煞: { needAll: ["延年"], ordered: false, saying: "延年制六煞" },
  禍害: { needAll: ["生氣", "延年"], alt: ["生氣", "伏位"], ordered: false, saying: "生氣補禍害" },
  五鬼: { needAll: ["生氣", "天醫", "延年"], ordered: true, saying: "三吉化五鬼" },
};

/** 吉星的加成規則（好上加好） */
const ENHANCE_RULES = {
  伏位: ["生氣", "天醫", "延年"],
  天醫: ["生氣", "延年"],
  生氣: ["延年", "天醫"],
  延年: ["生氣", "天醫"],
};

/* ---------- 2. 自我校驗 ---------- */

/**
 * 驗證配對表的完整性與唯一性。
 * 若表中有缺漏或重複，整套磁場分析都會失準，因此在載入時就檢查。
 */
function selfCheck() {
  const digits = [1, 2, 3, 4, 6, 7, 8, 9];
  const errors = [];

  // 每個兩位數組合只能歸屬一個磁場
  const seen = {};
  Object.entries(PAIR_MAP).forEach(([f, list]) => {
    list.forEach((p) => {
      if (seen[p]) errors.push(`${p} 同時出現在 ${seen[p]} 與 ${f}`);
      seen[p] = f;
    });
  });

  // 每個數字必須與其餘數字各配對一次（含自身伏位）＝ 8 組
  digits.forEach((a) => {
    const partners = digits.filter((b) => seen[`${a}${b}`]);
    if (partners.length !== 8) {
      errors.push(`數字 ${a} 只有 ${partners.length} 組配對，應為 8 組`);
    }
  });

  // 總數應為 8 磁場 × 8 組 = 64（呼應易經六十四卦）
  if (Object.keys(seen).length !== 64) {
    errors.push(`配對總數 ${Object.keys(seen).length}，應為 64`);
  }
  return errors;
}

/* ---------- 3. 拆解與分析 ---------- */

/**
 * 從數字序列取出磁場組合。
 *
 * 方法：先移除 0 與 5，再取相鄰兩位數（滑動窗口）。
 * ⚠️ 0 與 5 在八卦中無對應卦象，一般視為中性或放大器，
 *    不單獨成一組磁場，因此先行剔除再配對。
 * ⚠️ 不同流派的拆解方式略有差異（有的採不重疊分組），
 *    此處採滑動窗口以取得較完整的能量分布。
 */
function extractPairs(input) {
  const raw = String(input || "").replace(/[^0-9]/g, "");
  const kept = raw.split("").filter((d) => d !== "0" && d !== "5");
  const pairs = [];
  for (let i = 0; i < kept.length - 1; i++) {
    const p = kept[i] + kept[i + 1];
    const field = PAIR_TO_FIELD[p];
    if (field) pairs.push({ pair: p, field });
  }
  return {
    raw,
    kept: kept.join(""),
    removed: raw.length - kept.length,
    pairs,
  };
}

/** 主分析函式 */
function analyzeNumber(input, label = "") {
  const ex = extractPairs(input);

  const counts = {};
  FIELDS.forEach((f) => (counts[f] = 0));
  ex.pairs.forEach((p) => counts[p.field]++);

  const total = ex.pairs.length;
  const goodCount = GOOD_FIELDS.reduce((s, f) => s + counts[f], 0);
  const badCount = BAD_FIELDS.reduce((s, f) => s + counts[f], 0);

  // 主導磁場：出現最多者；平手時以權重高者優先
  const sorted = FIELDS
    .filter((f) => counts[f] > 0)
    .sort((a, b) => counts[b] - counts[a] || FIELD_WEIGHT[b] - FIELD_WEIGHT[a]);
  const dominant = sorted[0] || null;

  // 分數：由權重加總換算為 0–100，無磁場時給中性 60
  let score = 60;
  if (total > 0) {
    const sum = ex.pairs.reduce((s, p) => s + FIELD_WEIGHT[p.field], 0);
    const avg = sum / total;                 // 範圍約 -10 ~ +10
    score = Math.round(Math.max(28, Math.min(96, 60 + avg * 3.6)));
  }

  return {
    label,
    input: ex.raw,
    kept: ex.kept,
    removedCount: ex.removed,
    pairs: ex.pairs,
    counts,
    total,
    goodCount,
    badCount,
    goodRatio: total ? Math.round((goodCount / total) * 100) : 0,
    present: sorted,
    absent: FIELDS.filter((f) => counts[f] === 0),
    dominant,
    score,
    resolve: analyzeResolve(counts, ex.pairs),
  };
}

/* ---------- 4. 化解分析 ---------- */

/**
 * 檢查每個出現的凶星是否已被化解。
 * 五鬼要求「生氣、天醫、延年」順序不可錯，因此需檢查實際排列順序。
 */
function analyzeResolve(counts, pairs) {
  const seq = pairs.map((p) => p.field);
  const out = [];

  BAD_FIELDS.forEach((bad) => {
    if (!counts[bad]) return;
    const rule = RESOLVE_RULES[bad];
    if (!rule) return;

    const hasAll = (arr) => arr.every((f) => counts[f] > 0);
    let resolved = hasAll(rule.needAll);
    let usedPath = rule.needAll;

    // 禍害有替代組合
    if (!resolved && rule.alt && hasAll(rule.alt)) {
      resolved = true;
      usedPath = rule.alt;
    }

    // 五鬼需檢查順序
    if (resolved && rule.ordered) {
      let idx = -1;
      resolved = rule.needAll.every((f) => {
        const at = seq.indexOf(f, idx + 1);
        if (at === -1) return false;
        idx = at;
        return true;
      });
    }

    const missing = usedPath.filter((f) => !counts[f]);
    out.push({
      field: bad,
      count: counts[bad],
      resolved,
      saying: rule.saying,
      need: usedPath,
      missing: resolved ? [] : (missing.length ? missing : usedPath),
      orderIssue: resolved === false && rule.ordered && hasAll(rule.needAll),
    });
  });

  return out;
}

/* ---------- 5. 補強建議 ---------- */

/**
 * 依缺少的吉星，推薦可加入的數字組合。
 * 用於挑選手機號碼、車牌、門牌等後天數字。
 */
function recommendPairs(analysis, limit = 4) {
  const need = [];

  // 優先補「化解凶星所需」的吉星
  analysis.resolve.forEach((r) => {
    if (!r.resolved) r.missing.forEach((f) => need.includes(f) || need.push(f));
  });

  // 其次補完全沒有的吉星
  GOOD_FIELDS.forEach((f) => {
    if (f !== "伏位" && !analysis.counts[f] && !need.includes(f)) need.push(f);
  });

  return need.slice(0, limit).map((f) => ({
    field: f,
    reason: analysis.resolve.find((r) => !r.resolved && r.missing.includes(f))
      ? `化解${analysis.resolve.find((r) => !r.resolved && r.missing.includes(f)).field}`
      : "補強能量",
    pairs: PAIR_MAP[f],
  }));
}

/** 兩組數字的契合度（用於配對：情侶、合夥人、車牌與本命等） */
function matchScore(aAnalysis, bAnalysis) {
  const shared = FIELDS.filter((f) => aAnalysis.counts[f] && bAnalysis.counts[f]);
  const aGood = aAnalysis.goodRatio, bGood = bAnalysis.goodRatio;

  // 互補：一方缺的吉星，另一方有
  const complement = GOOD_FIELDS.filter((f) => !aAnalysis.counts[f] && bAnalysis.counts[f]);
  // 互解：一方的凶星，另一方帶著化解它的吉星
  const rescue = aAnalysis.resolve
    .filter((r) => !r.resolved && r.missing.some((f) => bAnalysis.counts[f]))
    .map((r) => r.field);

  const score = Math.round(
    Math.max(20, Math.min(98,
      (aGood + bGood) / 2 * 0.5 + shared.length * 4 + complement.length * 7 + rescue.length * 9
    ))
  );
  return { score, shared, complement, rescue };
}

/* ---------- 6. 匯出 ---------- */

if (typeof module !== "undefined") {
  module.exports = {
    analyzeNumber, extractPairs, analyzeResolve, recommendPairs, matchScore, selfCheck,
    FIELDS, GOOD_FIELDS, BAD_FIELDS, PAIR_MAP, PAIR_TO_FIELD, FIELD_WEIGHT,
    RESOLVE_RULES, ENHANCE_RULES,
  };
}
