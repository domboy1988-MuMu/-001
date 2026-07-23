/**
 * ============================================
 *  八星磁場｜話術層 (magnetic-content.js)
 *  職責：magnetic.js 的計算結果 → 白話文
 *  依賴：magnetic.js（瀏覽器以全域方式載入）
 * ============================================
 */

/* ---------- 0. 相依處理 ----------
   瀏覽器中 magnetic.js 的函式為全域，可直接呼叫；
   Node（測試環境）則需顯式取用。使用 var 以利提升。 */
if (typeof recommendPairs === "undefined" && typeof require !== "undefined") {
  var { recommendPairs } = require("./magnetic.js");
}

/* ---------- 1. 八大磁場解讀 ---------- */

const FIELD_INFO = {
  生氣: {
    kind: "吉", short: "貴人與機會",
    desc: "生氣是八星裡最柔和的能量，主人緣、貴人、機會。這股磁場強的人不必刻意經營，就會有人願意幫你一把；事情卡住時，往往是某個人隨口一句話幫你解開的。",
    strong: "人緣好、心態樂觀、遇到困難總有人伸手、機會來得比別人早。",
    weak: "缺少生氣的人不是人緣差，而是「必須自己開口才有幫助」——別人不會主動想到你。長期下來會覺得凡事靠自己，特別累。",
    body: "肝膽、免疫力",
  },
  天醫: {
    kind: "吉", short: "財富與智慧",
    desc: "天醫主財、主智慧、也主健康。這是八星中與「賺錢」關係最直接的磁場——不是橫財，而是靠專業與判斷力累積起來的財。天醫強的人，通常學什麼都比別人快。",
    strong: "財路穩、有偏財運、學習力強、身體恢復快、能靠專業變現。",
    weak: "缺天醫的人賺錢比較費力，常見的狀況是「能力不差但收入卡住」，而且容易把錢花在看不見成效的地方。",
    body: "腸胃、消化",
  },
  延年: {
    kind: "吉", short: "專業與領導",
    desc: "延年主專業、責任與領導力。這股磁場強的人做事有始有終，容易被推上負責的位置，也擅長把一件事做深、做久。",
    strong: "專業能力突出、有領導魅力、責任感強、能扛壓力、人際關係穩定持久。",
    weak: "缺延年的人容易半途而換跑道，累積不易，也常在該爭取主導權時退讓。",
    body: "心臟、血液循環",
  },
  伏位: {
    kind: "中", short: "耐心與蓄積",
    desc: "伏位是八星中最特別的一顆——它本身沒有強烈方向，而是「放大你已有的」。旁邊是吉星就更吉，旁邊是凶星就更凶。伏位多的人有超乎常人的耐心，起步慢但後勁長。",
    strong: "耐心足、責任心重、溫和幽默、善於協調、慢工出細活。",
    weak: "內心常處於矛盾狀態、缺乏安全感、主觀意識強不易被說服、作風保守而錯過時機。",
    body: "神經系統、睡眠",
  },
  絕命: {
    kind: "凶", short: "極端與衝勁",
    desc: "絕命的名字聽起來嚇人，但它其實是八星中爆發力最強的一顆。它代表極端——要嘛全力以赴，要嘛完全放棄，中間地帶對絕命的人不存在。用得好是拼搏力，用不好是自我耗損。",
    strong: "膽識過人、敢冒險、爆發力強、適合投資與拼搏型的工作。",
    weak: "情緒起伏極大、決策衝動、容易極端化、健康上易有突發狀況。",
    body: "心血管、突發性疾病",
    resolveNote: "天醫欺絕命——命中若有天醫，這股衝勁會被導向理財與投資，成為助力而非破壞。",
  },
  五鬼: {
    kind: "凶", short: "才華與變動",
    desc: "五鬼是八星中最聰明的一顆，主創意、靈感、變化。五鬼強的人腦子轉得極快，點子源源不絕，但也最容易起伏不定——貴人與小人往往是同一批人。",
    strong: "創意驚人、學習力強、反應快、適合需要動腦的工作、有獨特魅力。",
    weak: "情緒與人際變化劇烈、容易遇到反覆的人事、想太多而失眠、財來財去。",
    body: "精神、睡眠、神經",
    resolveNote: "五鬼最難化解——必須同時具備生氣、天醫、延年，且順序不可錯，才能把它的聰明轉為穩定的才華。",
  },
  六煞: {
    kind: "凶", short: "情感與人緣",
    desc: "六煞主情、主人際，是八星中桃花最重的一顆。它讓人細膩、體貼、善於察言觀色，但同樣的敏感也會回頭傷到自己——想得多、放不下、容易被感情牽著走。",
    strong: "人緣佳、異性緣旺、細膩體貼、適合服務與公關性質的工作。",
    weak: "情緒不穩、多愁善感、容易陷入複雜的感情糾葛、人際關係可能突然惡化。",
    body: "泌尿、婦科、內分泌",
    resolveNote: "延年制六煞——命中若有延年，這份敏感會被理性收束，轉為人際上的優勢而非負擔。",
  },
  禍害: {
    kind: "凶", short: "口才與是非",
    desc: "禍害主口舌。這股磁場強的人口才好、反應快、擅長辯論與說服——但同一張嘴，用對了是吃飯的工具，用錯了就是關係的裂縫。它不是壞磁場，是最需要「用對地方」的磁場。",
    strong: "口才便給、思路清晰、擅長談判與表達、適合以口為業。",
    weak: "說話太直、得理不饒人、容易招惹口舌是非、在感情中愛爭輸贏。",
    body: "呼吸道、咽喉、腸胃",
    resolveNote: "生氣補禍害——命中若有生氣，這份銳利會轉為圓融，口才變成人緣而非是非。",
  },
};

/* ---------- 2. 與生命靈數的交叉解讀 ---------- */

/**
 * 這是「環環相扣」的關鍵：
 * 把八星磁場與五行、生命靈數的結論交叉比對，
 * 找出兩套系統彼此呼應或彼此矛盾的地方。
 */
const FIELD_ELEMENT = {
  生氣: "木", 天醫: "土", 延年: "金", 伏位: "土",
  絕命: "火", 五鬼: "火", 六煞: "水", 禍害: "金",
};

function crossRead(mag, chart) {
  const out = [];
  const el = chart.element;
  const dom = mag.dominant;
  if (!dom) return out;

  const domEl = FIELD_ELEMENT[dom];
  const SHENG = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
  const KE = { 木: "土", 火: "金", 土: "水", 金: "木", 水: "火" };

  // 主導磁場 vs 本命五行
  if (domEl === el) {
    out.push({
      title: "磁場與本命同源",
      text: `你的主導磁場「${dom}」五行屬${domEl}，與你的本命五行${el}相同。兩套系統指向同一個方向，代表你的特質相當純粹——優點會很突出，但缺乏互補，遇到不擅長的事情時轉圜空間較小。`,
    });
  } else if (SHENG[domEl] === el) {
    out.push({
      title: "磁場滋養本命",
      text: `你的主導磁場「${dom}」屬${domEl}，而${domEl}生${el}——磁場正在滋養你的本命。這是很好的配置，代表你天生的能量流向與後天的行為模式是順的，做事比別人省力。`,
    });
  } else if (KE[domEl] === el) {
    out.push({
      title: "磁場與本命相剋",
      text: `你的主導磁場「${dom}」屬${domEl}，而${domEl}剋${el}。這代表你的行為模式常常和內在需求打架——你會做出讓自己不舒服的選擇，事後才發現「這不是我要的」。認出這個拉扯，是你最需要做的功課。`,
    });
  } else {
    out.push({
      title: "磁場與本命互補",
      text: `你的主導磁場「${dom}」屬${domEl}，與本命五行${el}既不相生也不相剋。這代表你有兩套獨立的運作模式，切換得宜時彈性極大，但也可能讓身邊的人覺得你難以捉摸。`,
    });
  }

  // 天醫 vs 賺錢天賦
  if (mag.counts["天醫"]) {
    out.push({
      title: "財富磁場呼應",
      text: `你的命盤中有 ${mag.counts["天醫"]} 組天醫——這是八星裡最直接與財富相關的磁場，恰好呼應了前面提到的生財天賦。天醫讓你「靠專業累積財富」的路徑比一般人順暢。`,
    });
  } else {
    out.push({
      title: "財富磁場缺席",
      text: `你的命盤中沒有天醫。這不代表你賺不到錢，而是財富需要透過後天數字（手機號碼、車牌等）來補強，否則容易出現「能力配得上更好的收入，但就是卡著」的狀況。`,
    });
  }

  // 六煞 vs 桃花元素
  if (mag.counts["六煞"]) {
    out.push({
      title: "桃花磁場交叉驗證",
      text: `你有 ${mag.counts["六煞"]} 組六煞，這是八星中桃花最重的磁場。它與你的桃花元素相互加成——代表你的感情機會確實偏多，但也更需要前面提到的篩選標準。`,
    });
  }

  return out;
}

/* ---------- 3. 應用場域 ---------- */

const USE_CASES = {
  手機號碼: {
    weight: "最重要",
    why: "手機號碼是你每天使用頻率最高的數字，也是別人聯絡你的入口。在數字易經中，使用頻率越高的數字，磁場引動力越強，因此手機號碼被視為後天數字裡影響最大的一組。",
    tip: "重點看後 8 碼。若要換號，優先確保有天醫（財）與生氣（貴人）的組合。",
  },
  身分證字號: {
    weight: "先天定調",
    why: "身分證字號伴隨你一生且無法更改，屬於「後天數字中的先天」。它與出生年月日一起構成你的基礎能量盤，通常用來確認人生的主軸走向。",
    tip: "無法更改，但可以透過其他數字來補強不足的磁場。",
  },
  車牌: {
    weight: "移動與意外",
    why: "車牌關係到你在移動狀態下的能量。凶星過多的車牌，一般認為與行車糾紛、罰單、意外的頻率有關。",
    tip: "避開連續的絕命與六煞組合，優先選擇有延年（穩定）的號碼。",
  },
  住址門牌: {
    weight: "居家與家運",
    why: "門牌號碼影響的是「你休息與充電的場所」，與家庭關係、睡眠品質、健康狀況有關。",
    tip: "伏位與延年組合的門牌最適合居家，能帶來穩定與安定感。",
  },
  銀行帳號: {
    weight: "財務流動",
    why: "存款與收款帳號關係到金錢的進出。天醫組合的帳號被認為有助於財務累積。",
    tip: "主要存款帳戶優先挑有天醫的號碼。",
  },
};

/* ---------- 4. 組裝報告 ---------- */

function generateMagneticReport(mag, chart) {
  const dom = mag.dominant;
  const domInfo = dom ? FIELD_INFO[dom] : null;

  const unresolved = mag.resolve.filter((r) => !r.resolved);
  const resolved = mag.resolve.filter((r) => r.resolved);

  return {
    score: mag.score,
    total: mag.total,
    counts: mag.counts,          // 各磁場出現次數（供其他章節交叉引用）
    goodRatio: mag.goodRatio,
    goodCount: mag.goodCount,
    badCount: mag.badCount,

    // 拆解過程（讓使用者看見「真的有算」）
    breakdown: {
      input: mag.input,
      kept: mag.kept,
      removedCount: mag.removedCount,
      removedNote: mag.removedCount
        ? `你的出生年月日中有 ${mag.removedCount} 個 0 或 5。這兩個數字在八卦中沒有對應卦象，屬於中性的放大器，不單獨形成磁場，因此拆解時先行剔除。`
        : "你的出生年月日中沒有 0 與 5，所有數字都參與了磁場的組成。",
      pairs: mag.pairs,
    },

    // 主導磁場
    dominant: dom ? {
      field: dom,
      count: mag.counts[dom],
      kind: domInfo.kind,
      short: domInfo.short,
      desc: domInfo.desc,
      strong: domInfo.strong,
      weak: domInfo.weak,
    } : null,

    // 全部磁場分布
    distribution: mag.present.map((f) => ({
      field: f, count: mag.counts[f],
      kind: FIELD_INFO[f].kind, short: FIELD_INFO[f].short,
    })),
    absent: mag.absent.map((f) => ({ field: f, short: FIELD_INFO[f].short, weak: FIELD_INFO[f].weak })),

    // 化解分析
    resolve: {
      unresolved: unresolved.map((r) => ({
        ...r,
        info: FIELD_INFO[r.field],
        note: FIELD_INFO[r.field].resolveNote,
      })),
      resolved: resolved.map((r) => ({ ...r, info: FIELD_INFO[r.field] })),
      summary: !mag.badCount
        ? "你的命盤中沒有凶星，能量結構相當乾淨。這類命盤的優勢是穩定，但也可能因為缺少衝突而少了突破的動力。"
        : unresolved.length === 0
          ? "你命盤中的凶星都已被對應的吉星化解——這是相當理想的結構，代表你的挑戰面向都有天生的緩衝機制。"
          : `你的命盤中有 ${unresolved.length} 個凶星尚未被化解。這正是後天數字（手機號碼、車牌）可以介入的地方。`,
    },

    // 交叉解讀（與生命靈數／五行呼應）
    cross: crossRead(mag, chart),

    // 建議
    recommend: recommendPairs(mag).map((r) => ({
      ...r,
      info: FIELD_INFO[r.field],
      sample: r.pairs.slice(0, 4),
    })),

    useCases: USE_CASES,
  };
}

/* ---------- 匯出 ---------- */
if (typeof module !== "undefined") {
  module.exports = {
    generateMagneticReport, crossRead,
    FIELD_INFO, FIELD_ELEMENT, USE_CASES,
  };
}
