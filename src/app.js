
/* 解鎖狀態由入口檔（demo.html / unlock.html）設定於 window.UNLOCKED。
   ⚠️ 這裡刻意讀取 window 屬性而非宣告同名變數——
      若入口檔用 const 宣告、本檔再用 var 宣告，會觸發
      「Identifier has already been declared」而使整個檔案停止執行（全白/黑屏）。
   未設定時預設為未解鎖，避免免費版意外洩漏付費內容。 */
const UNLOCKED = (typeof window !== "undefined" && window.UNLOCKED === true);

/* ══════════════════════════════════════════════════════════
   背景音樂
   ⚠️ 瀏覽器禁止未經互動的自動播放，因此 BGM 在「輕觸水晶球」
      那一下才啟動——與開啟旁白音效是同一個動作，不另外要求使用者操作。
   ⚠️ 有旁白的影片播放時自動降低音量（ducking），避免蓋過人聲。
   ══════════════════════════════════════════════════════════ */
const BGM_SRC     = "assets/audio/bgm.mp3";
const BGM_VOLUME  = 0.26;   // 常態音量
const BGM_DUCKED  = 0.07;   // 旁白播放時的音量
const NARRATED    = ["v1","v3","v4"];   // 含旁白的影片

const bgmEl = document.getElementById("bgm");
let bgmReady = false, bgmMuted = false, bgmFading = null;

bgmEl.src = BGM_SRC;
bgmEl.volume = 0;
bgmEl.addEventListener("canplay", ()=>{ bgmReady = true; });
bgmEl.addEventListener("error", ()=>{
  bgmReady = false;
  document.getElementById("mute").style.display = "none";
});

function bgmStart(){
  if(!bgmReady || bgmMuted) return;
  const p = bgmEl.play();
  if(p) p.catch(()=>{});
  bgmFade(BGM_VOLUME);
  document.getElementById("mute").style.display = "flex";
}

/* 平滑調整音量，避免忽大忽小的突兀感 */
function bgmFade(target, ms=900){
  clearInterval(bgmFading);
  const from = bgmEl.volume, steps = 24, dt = ms/steps;
  let i = 0;
  bgmFading = setInterval(()=>{
    i++;
    bgmEl.volume = Math.max(0, Math.min(1, from + (target-from)*(i/steps)));
    if(i>=steps) clearInterval(bgmFading);
  }, dt);
}

function bgmDuck(on){
  if(bgmMuted || !bgmReady) return;
  bgmFade(on ? BGM_DUCKED : BGM_VOLUME, on ? 400 : 1200);
}

document.getElementById("mute").addEventListener("click", ()=>{
  bgmMuted = !bgmMuted;
  document.getElementById("mute").classList.toggle("off", bgmMuted);
  if(bgmMuted){ bgmFade(0, 320); setTimeout(()=>bgmEl.pause(), 340); }
  else { bgmEl.play().catch(()=>{}); bgmFade(BGM_VOLUME); }
});

/* ══════════════════════════════════════════════════════════
   熱區座標設定 ── 你要調的就是這裡
   x,y = 佔畫面寬/高的百分比（圓心位置）
   size = 直徑佔畫面寬度的百分比
   按鍵盤 C 開啟校準模式，會顯示熱區範圍，對準水晶球後改數字即可
   ══════════════════════════════════════════════════════════ */
const HOTSPOTS = {
  intro:   { x: 50, y: 63, size: 30 },   // v1 水晶球位置
  collect: { x: 50, y: 63, size: 30 },   // 同上（沿用 v1 最後一幀）
  result:  { x: 79, y: 11, size: 17 },   // v4 天空日／月位置
};

/* 結果頁的「日／月」熱區開關。
   只有當 v4 影片右上角真的有太陽或月亮時才設為 true，
   否則會變成一個懸空的神祕圓圈，使用者不知道那是什麼。
   關閉時改用結果頁下方的文字連結返回。 */
const SUN_HOTSPOT_ENABLED = false;

const CALC_MS = 9000;          // 計算動畫長度（skill 建議 10–12 秒）
const PROGRESS = ["正在讀取你的出生密碼","正在比對五行與靈數的共鳴","正在推算流年軌跡","就快好了，請稍等"];

/* ── 影片載入 ── */
const V = { v1:"assets/video/v1-intro.mp4", v2:"assets/video/v2-casting.mp4",
            v3:"assets/video/v3-reveal.mp4", v4:"assets/video/v4-outro.mp4" };
const vidStatus = {}, vidErr = {};
// MediaError 代碼對照：這是判斷「找不到檔案」還是「解不開」的關鍵
const ERR_MEAN = {
  1: "載入被中斷",
  2: "讀取失敗（權限或協定限制）",
  3: "解碼失敗 — 檔案讀得到，但瀏覽器不支援這個編碼（多半是 H.265/HEVC）",
  4: "來源不支援 — 找不到檔案，或格式無法播放（多半是 H.265/HEVC 或副檔名不符）",
};
Object.entries(V).forEach(([id,src])=>{
  const el = document.getElementById(id);
  vidStatus[id] = "載入中";
  el.addEventListener("loadeddata", ()=>{ vidStatus[id]="ok"; paintDiag(); });
  el.addEventListener("error", ()=>{
    vidStatus[id]="fail";
    const e = el.error;
    vidErr[id] = e ? (e.code + "：" + (ERR_MEAN[e.code]||"未知")) : "未知錯誤";
    paintDiag();
  });
  el.src = src;
});
function paintDiag(){
  const bad = Object.entries(vidStatus).filter(([,v])=>v==="fail");
  document.body.classList.toggle("novideo", bad.length===4);
  const box = document.getElementById("missing");
  if(!bad.length){ box.classList.remove("on"); return; }
  const proto = location.protocol;
  document.getElementById("missingBody").innerHTML =
    `影片讀不到（錯誤碼 ${bad.map(([id])=>(vidErr[id]||"?").split("：")[0]).join(" / ")}）<br><br>` +
    bad.map(([id])=>
      `<code class="bad">${id}</code><br><span style="font-size:11px;color:#8896B0">${vidErr[id]||"未知"}</span>`
    ).join("<br><br>") +
    `<br><br><span style="font-size:11px;color:#6B7A99">
      目前協定：<code>${proto}</code><br><br>
      錯誤碼 3 或 4 → 影片編碼問題，需轉成 H.264<br>
      錯誤碼 2 → 請改用本機伺服器開啟<br><br>
      仍可繼續操作，畫面以純色代替。
     </span>`;
  box.classList.add("on");
}

/* ── 熱區定位 ── */
const hotBall = document.getElementById("hotBall");
const hotSun  = document.getElementById("hotSun");
function place(el, cfg){
  const w = document.getElementById("stage").clientWidth;
  const d = w * cfg.size / 100;
  el.style.left = cfg.x + "%";
  el.style.top  = cfg.y + "%";
  el.style.width = d + "px";
  el.style.height = d + "px";
}
function layout(){
  place(hotBall, stage==="collect" ? HOTSPOTS.collect : HOTSPOTS.intro);
  place(hotSun, HOTSPOTS.result);
}
addEventListener("resize", layout);

/* ── 校準模式 ── */
addEventListener("keydown", e=>{
  if(e.key==="c"||e.key==="C"){
    document.body.classList.toggle("calib");
    setHots();
  }
});

/* ── 狀態機 ── */
let stage = "intro";
let soundOn = false;
let chart = null, report = null, magnet = null, magRep = null;

const P = { intro:"pIntro", collect:"pCollect", calc:"pCalc", reveal:"pReveal" };
function showPanel(name){
  Object.values(P).forEach(id=>document.getElementById(id).classList.remove("on"));
  if(P[name]) document.getElementById(P[name]).classList.add("on");
  document.getElementById("book").classList.toggle("on", name==="result");
  document.getElementById("sales").classList.toggle("on", name==="sales");
}
function showVid(id){
  ["v1","v2","v3","v4"].forEach(v=>{
    const el=document.getElementById(v);
    el.classList.toggle("on", v===id);
    if(v!==id){ el.pause(); }
  });
}
function playVid(id,{loop=false}={}){
  bgmDuck(NARRATED.includes(id));   // 有旁白的影片播放時壓低背景音樂
  const el=document.getElementById(id);
  el.loop=loop; el.muted=!soundOn; el.currentTime=0;
  const p=el.play();
  if(p) p.catch(()=>{ /* 被瀏覽器擋下時靜音重播 */ el.muted=true; el.play().catch(()=>{}); });
  showVid(id);
}

/* 熱區顯示規則：只有該用的時候才出現 */
function setHots(){
  hotBall.style.display = (stage==="intro"||stage==="collect") ? "block":"none";
  hotSun.style.display  = (stage==="result" && SUN_HOTSPOT_ENABLED) ? "block":"none";
  hotBall.classList.toggle("idle", stage==="collect" && !validBirthday());
  hotBall.classList.toggle("armed", stage==="collect" && validBirthday());
}

function go(next, keepPage=false){
  stage = next; showPanel(next); layout(); setHots();

  if(next==="intro"){
    playVid("v1");
    document.getElementById("introHint").style.bottom = "12%";
  }
  if(next==="collect"){
    // 停在 v1 最後一幀，讓場景延續
    const el=document.getElementById("v1");
    el.pause();
    positionAsk();
    setTimeout(()=>document.getElementById("bd").focus(),350);
  }
  if(next==="calc"){ playVid("v2",{loop:true}); runCalc(); }
  if(next==="reveal"){ playVid("v3"); runReveal(); }
  if(next==="result"){ playVid("v4"); renderBook(keepPage); }
  if(next==="sales"){ renderSales(); }   // 沿用 v4 畫面，不重播
}

/* 輸入區避開水晶球：放在熱區上方 */
function positionAsk(){
  const box=document.getElementById("askBox");
  box.style.top = (HOTSPOTS.collect.y - HOTSPOTS.collect.size/2 - 26) + "%";
  const h=document.getElementById("collectHint");
  h.style.bottom = "9%";
}

/* ── 生日驗證 ── */
function normalizeBirthday(raw){
  const s=(raw||"").replace(/[^0-9]/g,"");
  if(s.length!==8) return null;
  return s.slice(0,4)+"-"+s.slice(4,6)+"-"+s.slice(6,8);
}
/* 邊打邊補上分隔線，讓「西元年 / 月 / 日」的格式一目了然 */
function prettyBirthday(raw){
  const d=(raw||"").replace(/[^0-9]/g,"").slice(0,8);
  if(d.length<=4) return d;
  if(d.length<=6) return d.slice(0,4)+" / "+d.slice(4);
  return d.slice(0,4)+" / "+d.slice(4,6)+" / "+d.slice(6);
}
function validBirthday(){
  const d=normalizeBirthday(document.getElementById("bd").value);
  return d ? validateDate(d).ok : false;
}
document.getElementById("bd").addEventListener("input", (ev)=>{
  const box=ev.target;
  const digits=box.value.replace(/[^0-9]/g,"");
  // 僅在游標位於末端時重寫，避免使用者回頭修改中間數字時游標亂跳
  const atEnd = box.selectionStart === box.value.length;
  const pretty = prettyBirthday(digits);
  if(box.value !== pretty && atEnd){
    box.value = pretty;
  }
  const d=normalizeBirthday(box.value);
  const err=document.getElementById("err");
  if(!digits){ err.textContent=""; }
  else if(digits.length<8){ err.textContent=""; }
  else if(!d){ err.textContent="請輸入 8 位數字，例如 1990 / 01 / 01"; }
  else { const v=validateDate(d); err.textContent = v.ok ? "" : v.reason; }
  setHots();
});
document.getElementById("bd").addEventListener("keydown", e=>{
  if(e.key==="Enter" && validBirthday()) submit();
});

/* ── 熱區行為 ── */
hotBall.addEventListener("click", ()=>{
  if(stage==="intro"){
    // skill：一次點擊 = 開聲 + 進入下一步，不可拆成兩步
    soundOn = true;
    const el=document.getElementById("v1"); el.muted=false;
    bgmStart();                      // 與開聲同一個動作，不另外要求操作
    go("collect");
  } else if(stage==="collect" && validBirthday()){
    submit();
  }
});
hotSun.addEventListener("click", restart);

function submit(){
  const d=normalizeBirthday(document.getElementById("bd").value);
  try{
    chart  = computeChart(d,{ baseYear:new Date().getFullYear() });
    report = generateReport(chart);
    magnet = analyzeNumber(d.replace(/-/g,""));
    magRep = generateMagneticReport(magnet, chart);
  }catch(e){
    document.getElementById("err").textContent=e.message; return;
  }
  go("calc");
}

/* ── 計算動畫（skill：進度文字單向推進，不可重播）── */
let calcTimers=[];
function runCalc(){
  calcTimers.forEach(clearTimeout); calcTimers=[];
  const el=document.getElementById("prog");
  el.textContent=PROGRESS[0];                    // 第 0 步不排 timer
  const step=CALC_MS/PROGRESS.length;
  for(let i=1;i<PROGRESS.length;i++){
    calcTimers.push(setTimeout(()=>el.textContent=PROGRESS[i], step*i));
  }
  calcTimers.push(setTimeout(()=>go("reveal"), CALC_MS));
}

/* ── 揭曉 ── */
function runReveal(){
  const n=document.getElementById("num");
  // 對齊水晶球中心，讓數字浮現在球體內部
  const cfg=HOTSPOTS.intro;
  n.style.left=cfg.x+"%"; n.style.top=cfg.y+"%";
  n.textContent=""; n.classList.remove("on");
  setTimeout(()=>{ n.textContent=chart.numbers.life; n.classList.add("on"); }, 420);
  setTimeout(()=>go("result"), 2900);
}

/* ── 五行雷達圖（SVG，數據驅動）── */
const EL_COLOR={木:"#5FA46A",火:"#C7614A",土:"#C79A4A",金:"#B5A24A",水:"#5A82AD"};
function radarSVG(pct){
  const keys=["木","火","土","金","水"], S=250, C=S/2, R=88;
  const max=Math.max(...keys.map(k=>pct[k]));
  const pt=(i,r)=>{ const a=-Math.PI/2 + i*2*Math.PI/5;
    return [C+Math.cos(a)*r, C+Math.sin(a)*r]; };
  let grid="";
  [.25,.5,.75,1].forEach(f=>{
    grid+=`<polygon points="${keys.map((_,i)=>pt(i,R*f).join(",")).join(" ")}" fill="none" stroke="rgba(201,162,39,.16)" stroke-width="1"/>`;
  });
  keys.forEach((_,i)=>{ const [x,y]=pt(i,R);
    grid+=`<line x1="${C}" y1="${C}" x2="${x}" y2="${y}" stroke="rgba(201,162,39,.16)" stroke-width="1"/>`; });
  const poly=keys.map((k,i)=>pt(i,R*(pct[k]/max)).join(",")).join(" ");
  let labels="";
  keys.forEach((k,i)=>{ const [x,y]=pt(i,R+21);
    labels+=`<text x="${x}" y="${y+5}" text-anchor="middle" font-size="13" font-family="var(--serif)" fill="${EL_COLOR[k]}">${k}</text>`; });
  return `<svg id="radar" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${grid}
    <polygon points="${poly}" fill="rgba(201,162,39,.2)" stroke="#C9A227" stroke-width="1.6"
      style="transform-origin:${C}px ${C}px;animation:pop .9s cubic-bezier(.2,.8,.3,1) both"/>
    ${labels}</svg>
  <style>@keyframes pop{from{transform:scale(0)}to{transform:scale(1)}}</style>`;
}


/* ══════════════════════════════════════════════════════════
   付費解鎖後才出現的章節
   免費版的鉤子（桃花元素、爛桃花、理想型、五年流年、健康開運、
   106 項總表）在此完整揭曉。
   ══════════════════════════════════════════════════════════ */
function unlockedPages(r, c, mg){
  const chips=(arr,cls="")=>`<div class="chips">${arr.map(n=>`<div class="chip ${cls}">${n}</div>`).join("")}</div>`;
  return [

  // 桃花元素
  {t:"桃 花 元 素", h:`
    <div class="crown">
      <div class="lbl">桃 花 指 數</div>
      <div class="big" style="font-size:56px">${r.peachBlossom.score}</div>
      <div class="sub">${r.peachBlossom.name}</div>
    </div>
    <p>${r.peachBlossom.desc}</p>
    <p class="q">你會遇到的類型</p>
    <p>${r.peachBlossom.meetType}</p>
    <p class="q">最容易遇見的場域</p>
    <p>${r.peachBlossom.where}</p>
    <p class="dim">推進節奏：${r.peachBlossom.speed}</p>`},

  // 避爛桃花
  {t:"如 何 避 開 爛 桃 花", h:`
    <p class="q">你最大的感情風險</p>
    <p>${r.avoidBadPeach.risk}</p>
    <p class="dim">${r.avoidBadPeach.riskSource}</p>
    <p class="q">出現這些訊號要警覺</p>
    ${r.avoidBadPeach.signs.map((s,i)=>
      `<div class="res no"><div class="h">警訊 ${i+1}</div><p>${s}</p></div>`).join("")}
    <p class="q">核心守則</p>
    <p>${r.avoidBadPeach.rule}</p>`},

  // 理想型
  {t:"你 的 理 想 型", h:`
    <div class="crown">
      <div class="lbl">態 度 數</div>
      <div class="big" style="font-size:56px">${r.idealType.number}</div>
      <div class="sub">${r.idealType.type}</div>
    </div>
    <p>${r.idealType.why}</p>
    <p class="q">應該避開的類型</p>
    <p class="dim">${r.idealType.avoid}</p>
    <p class="q">數字上的對照</p>
    <p>戀人數字：${r.match.lover.join("、")}</p>
    ${chips(r.match.lover)}
    <p class="dim">${r.match.loverWhy}</p>`},

  // 未來五年
  {t:"未 來 五 年 流 年", h:`
    <p>流年以九年為一個循環。以下是你未來五年所走的位置——</p>
    ${r.yearFortune.timeline.map(t=>`
      <div class="cross">
        <div class="h">${t.year}　流年 ${t.number}　${t.name}</div>
        <p>主題：${t.theme}　·　運勢指數 ${t.score}</p>
        <p class="dim" style="margin-top:7px">${t.brief}</p>
      </div>`).join("")}
    <p class="q">逢凶化吉的方向</p>
    <p>指數偏低的年份不是壞年，而是節奏不同。
       ${r.yearFortune.timeline.filter(t=>t.score<70).map(t=>t.year).join("、")||"未來五年沒有"}
       這幾年適合守成、進修與整理，硬要擴張反而事倍功半；
       而${r.yearFortune.timeline.filter(t=>t.score>=80).map(t=>t.year).join("、")||"目前沒有明顯的"}
       這幾年能量較強，該出手時別猶豫。</p>`},

  // 健康與開運
  {t:"健 康 與 開 運", h:`
    <p class="q">幸運色</p>
    ${chips(r.colors.list)}
    <p>${r.colors.why}</p>
    <p class="q">有利方位與開運物</p>
    <p>方位：${r.colors.dir}</p>
    <p>開運物：${r.colors.items.join("、")}</p>
    <p class="q">補強弱項</p>
    <p class="dim">${r.lucky.weakSupport}</p>
    <p class="q">日常提醒</p>
    <p>${r.lucky.action}</p>`},

  // 完整分析總表
  {t:"完 整 分 析 總 表", h:`
    <p>以下是你命盤中所有可歸納的要點，共 ${r.highlights.total} 項，
       分為 ${r.highlights.categories.length} 大類。</p>
    ${r.highlights.categories.map(cat=>`
      <p class="q">${cat}</p>
      <ul class="items">${r.highlights.items.filter(i=>i.category===cat)
        .map(i=>`<li>${i.text}</li>`).join("")}</ul>`).join("")}`},
  {t:"報 告 完 結", h:`
    <p>你的完整命盤已全部揭曉，共 ${r.highlights.total} 項分析。</p>
    <p class="dim">這份報告沒有標準答案，它只是把你身上原本就有的東西，
       用數字的語言說了一遍。看完之後覺得哪裡不像，那也是有意義的——
       不像的地方，往往才是你這些年真正走出來的路。</p>
    <button class="backlink" id="restart">重新測算</button>`},
  // 收尾禮物・前導（情感鋪陳）
  {t:"最 後 · 送 你 一 個 工 具", h:`
    <p>關於「你」的部分，到這裡已經說完了。</p>
    <p>但八星磁場和生命靈數最大的不同，是它<b>不只能看先天</b>——
       你每天在用的手機號碼、身分證字號、車牌、住址，
       都帶著自己的磁場，正在日復一日地影響你。</p>
    <p class="dim">先天不足，可以用後天補。這是這套系統最實際的地方，
       也是我最想留給你的東西。</p>
    <p class="dim" style="text-align:center;margin-top:20px">翻到下一頁，開始檢測 →</p>`},

  // 數字檢測工具・獨立最後一頁
  {t:"數 字 檢 測", h:`
    <div class="gift">
      <div class="gk">後 天 數 字 檢 測</div>
      <p>輸入你正在使用的號碼，我會比對它與你本命的契合度，
         並告訴你該補什麼。</p>
    </div>
    <div class="tabs" id="toolTabs">${TOOL_TABS.map((t,i)=>
      `<button class="tab ${i===0?"on":""}" data-i="${i}">${t}</button>`).join("")}</div>
    <input id="toolIn" inputmode="numeric" autocomplete="off" placeholder="輸入數字">
    <div class="toolhint" id="toolHint"></div>
    <button class="cta" id="toolGo">開 始 檢 測</button>
    <div id="toolOut"></div>`},

  ];
}

/* 免費版目前呈現的頁數（供文案動態引用） */
function countFreePages(){ return 14; }

/* ── 魔法書：把報告編排成可翻閱的頁面 ── */
let pageIdx = 0, pages = [];

function buildPages(){
  const r=report, c=chart, io=r.innerOuter, nm=r.numerology, mt=r.match, mg=magRep;
  const kindCls=k=>k==="吉"?"good":k==="凶"?"bad":"mid";
  const chips=(arr,cls="")=>`<div class="chips">${arr.map(n=>`<div class="chip ${cls}">${n}</div>`).join("")}</div>`;

  return [
  // 1 命格
  {t:"命 格 總 覽", h:`
    <div class="crown">
      <div class="lbl">你 的 生 命 靈 數</div>
      <div class="big">${c.numbers.life}</div>
      <div class="ttl">${r.summary.title}</div>
      <div class="sub">五行屬${c.element}　·　${r.summary.keywords.join("　")}</div>
    </div>
    <p>${r.personality.desc}</p>
    <p class="dim">${r.personality.shadow}</p>`},

  // 2 優缺點
  {t:"個 人 特 質", h:`
    <div class="pc">
      <div class="good"><div class="k">優 點</div><ul>${r.prosCons.pros.map(x=>`<li>${x}</li>`).join("")}</ul></div>
      <div class="bad"><div class="k">缺 點</div><ul>${r.prosCons.cons.map(x=>`<li>${x}</li>`).join("")}</ul></div>
    </div>
    <p class="q">為什麼會這樣？</p>
    <p>${r.personality.balanceNote}</p>
    ${radarSVG(c.elementPct)}
    <div class="legend">${["木","火","土","金","水"].map(k=>
      `<span><i style="background:${EL_COLOR[k]}"></i>${k} ${c.elementPct[k]}%</span>`).join("")}</div>`},

  // 3 內外
  {t:"內 在 與 外 在", h:`
    <div class="io">
      <div class="col"><div class="k">內 在</div><div class="n">${io.inner}</div><div class="t">${io.innerLabel}</div></div>
      <div class="gapbox">落差<b>${io.gap}</b></div>
      <div class="col"><div class="k">外 在</div><div class="n">${io.outer}</div><div class="t">${io.outerLabel}</div></div>
    </div>
    <p>${io.verdict}</p>
    ${io.misread?`<p class="dim">${io.misread}</p>`:""}
    <p class="q">相處建議</p><p>${io.advice}</p>`},

  // 4 天生的數字
  {t:"天 生 的 數 字", h:`
    <p class="q">你的本命數</p>
    ${chips([nm.own])}
    <p>${nm.ownWhy}</p>
    <p class="q">出生日期中出現過的數字</p>
    ${chips(nm.present)}
    <p class="dim">${nm.repeatedNote}</p>
    <p class="q">同樣一組數字，還能這樣看</p>
    <p>前面看的是「數字相加之後」的你。但同樣這串出生年月日，若改成
       <b>兩兩相鄰拆開</b>，會顯現另一層資訊——這是數字易經的八星磁場，
       與生命靈數是兩套並行的系統。</p>
    <p class="dim">${mg.breakdown.removedNote}</p>
    <div class="pairs">${mg.breakdown.pairs.map(p=>
      `<div class="pr ${kindCls(FIELD_INFO[p.field].kind)}"><b>${p.pair}</b><span>${p.field}</span></div>`).join("")}</div>
    <p class="dim">下一頁起，我們細看這些磁場對你的意義。</p>`},

  // 磁場總覽
  {t:"你 的 八 星 磁 場", h:`
    <p>你的命盤共組成 ${mg.total} 組磁場，其中吉星 ${mg.goodCount} 組、凶星 ${mg.badCount} 組。</p>
    <div class="ratio">
      <i class="g" style="width:${mg.goodRatio}%"></i>
      <i class="b" style="width:${100-mg.goodRatio}%"></i>
    </div>
    <div class="ratiotxt"><span>吉星 ${mg.goodRatio}%</span><span>凶星 ${100-mg.goodRatio}%</span></div>
    <p class="q">磁場分布</p>
    <div class="pairs">${mg.distribution.map(d=>
      `<div class="pr ${kindCls(d.kind)}"><b>${d.count}</b><span>${d.field}</span></div>`).join("")}</div>
    <p class="dim">凶星不等於壞。在數字易經裡，絕命是爆發力、五鬼是創意、
       六煞是人緣、禍害是口才——它們代表的是才華，只是這些才華更需要被引導。</p>
    ${mg.absent.length?`<p class="q">你完全沒有的磁場</p>
      <div class="pairs">${mg.absent.map(a=>
        `<div class="pr mid"><b>—</b><span>${a.field}</span></div>`).join("")}</div>`:""}`},

  // 主導磁場
  {t:"主 導 你 的 磁 場", h: mg.dominant ? `
    <div class="crown">
      <div class="lbl">出 現 最 多 的 磁 場</div>
      <div class="big" style="font-size:52px">${mg.dominant.field}</div>
      <div class="sub">${mg.dominant.short}　·　共 ${mg.dominant.count} 組</div>
    </div>
    <p>${mg.dominant.desc}</p>
    <p class="q">這股磁場強的時候</p>
    <p>${mg.dominant.strong}</p>
    <p class="q">需要留意的一面</p>
    <p class="dim">${mg.dominant.weak}</p>` : `
    <p>你的出生年月日中，0 與 5 的比例偏高，未形成明顯的主導磁場。
       這在數字易經裡屬於「空盤」，代表你的能量方向由後天數字決定的成分更大——
       手機號碼、車牌這類你天天使用的數字，對你的影響會比一般人更明顯。</p>`},

  // 交叉解讀
  {t:"兩 套 命 盤 的 交 會", h:`
    <p>到這裡，你已經看過兩套完全不同的系統：
       <b>生命靈數</b>把你的數字相加歸一，看的是人格原型；
       <b>八星磁場</b>把數字兩兩拆開，看的是能量分布。</p>
    <p class="dim">當兩套系統指向同一件事，那件事在你身上通常特別明顯。
       以下是它們交會的地方——</p>
    ${mg.cross.map(x=>`<div class="cross"><div class="h">${x.title}</div><p>${x.text}</p></div>`).join("")}`},

  // 化解與補強
  {t:"化 解 與 補 強", h:`
    <p>${mg.resolve.summary}</p>
    ${mg.resolve.resolved.map(r=>`
      <div class="res ok"><div class="h">${r.field}　已化解</div>
      <p>你的命盤中同時具備${r.need.join("、")}，正是「${r.saying}」的格局。
         ${r.info.resolveNote||""}</p></div>`).join("")}
    ${mg.resolve.unresolved.map(r=>`
      <div class="res no"><div class="h">${r.field}　尚未化解</div>
      <p>${r.info.resolveNote||""}
         ${r.orderIssue?"你的命盤雖具備所需的吉星，但排列順序不符，效力打折。":
           `你的命盤中缺少${r.missing.join("、")}，因此這股能量目前沒有緩衝。`}</p></div>`).join("")}
    ${mg.recommend.length?`
      <p class="q">可以補強的數字組合</p>
      <p>好消息是——先天不足，可以用後天數字補。以下是適合你的組合：</p>
      ${mg.recommend.map(x=>`
        <p class="dim" style="margin-bottom:6px">補「${x.field}」（${x.reason}）：${x.info.short}</p>
        <div class="pairs">${x.sample.map(pp=>`<div class="pr good"><b>${pp}</b></div>`).join("")}</div>`).join("")}
      ${UNLOCKED ? `
        <p class="dim">這些組合可以用在手機號碼、車牌、住址上。
           本報告最後附有數字檢測工具，可直接輸入你正在使用的號碼檢查。</p>
      ` : `
        <div class="veil">
          <p>把這些組合放進你每天使用的數字裡，<br>
             是數字易經中最實際的調整方式。<br>
             完整報告可為你檢測手機號碼、身分證字號、<br>
             車牌與住址，並給出專屬建議。</p>
          <span>完 整 報 告 解 鎖</span>
        </div>`}`:""}`},

  // 5 缺數：點出最關鍵的那一個，其餘溫柔帶過
  {t:"天 生 缺 乏 什 麼", h: nm.primary ? `
    <p>${nm.missingNote}</p>
    <div class="chips">${nm.missing.map(n=>
      `<div class="chip miss ${n===nm.primary.num?"key":""}">${n}</div>`).join("")}</div>
    <p class="q">其中最重要的是 ${nm.primary.num}</p>
    <p>在你的命盤裡，${nm.primary.num} 屬${nm.primary.el}——${nm.primary.reason}</p>
    <p class="dim">它牽動的，是你「${nm.primary.lack}」這個面向。</p>
    ${UNLOCKED ? `
      <p>${nm.primary.desc}</p>
      <p class="q">建議</p>
      <p>${nm.primary.fill}</p>
      ${nm.missingDetail.filter(m=>m.num!==nm.primary.num).map(m=>`
        <p class="q">缺 ${m.num}：${m.lack}</p>
        <p>${m.desc}</p>
        <p class="dim">建議：${m.fill}</p>`).join("")}
    ` : `
      <div class="veil">
        <p>${nm.primary.num} 在你身上具體會如何顯現，<br>
           以及可以從哪些地方著手調整，<br>
           都收錄在完整報告裡。</p>
        <span>完 整 報 告 解 鎖</span>
      </div>
      ${nm.missing.length>1?`<p class="dim">其餘缺數 ${nm.missing.filter(n=>n!==nm.primary.num).join("、")} 的解析，同樣收錄其中。</p>`:""}`}`
  : `
    <p>${nm.missingNote}</p>
    <p class="dim">這樣的命盤並不常見。你的基礎相當完整，
       但也因為沒有明顯的缺口，較難自然形成極端的專長——
       完整報告中會說明，這樣的人該把力氣放在哪裡。</p>`},

  // 6 人生課題
  {t:"人 生 課 題", h:`
    <p class="q">${r.lesson.title}</p>
    <p>${r.lesson.body}</p>
    <p class="dim">這是你這輩子會反覆遇到的主題。同樣的情境會用不同面貌出現，直到你真正學會為止。</p>`},

  // 7 合適的顏色
  {t:"天 生 合 適 的 顏 色", h:`
    ${chips(r.colors.list)}
    <p class="q">為什麼是這些顏色</p>
    <p>${r.colors.why}</p>
    <p class="dim">有利方位：${r.colors.dir}　·　開運物：${r.colors.items.join("、")}</p>`},

  // 8 契合的人
  {t:"契 合 的 人", h:`
    <p class="q">事業夥伴</p>
    ${chips(mt.partner)}
    <p>${mt.partnerWhy}</p>
    <p class="q">戀人</p>
    ${chips(mt.lover)}
    <p>${mt.loverWhy}</p>
    <p class="q">需要留意</p>
    ${chips(mt.avoid,"bad")}
    <p class="dim">${mt.avoidWhy}</p>
    <p class="q">還有另一種配對方式</p>
    <p class="dim">以上是用五行生剋推導的。若改用八星磁場，還能直接比對兩個人的
       手機號碼或生日，算出彼此的磁場是互補、互解，還是互相消耗${UNLOCKED?"——可在數字檢測工具中操作。":"——這部分收錄在完整報告的配對工具中。"}</p>`},

  // 9 工作與賺錢
  {t:"事 業 與 財 運", h:`
    <p class="q">適合什麼工作</p>
    <p>${r.career.desc}</p>
    <p class="dim">適合領域：${r.career.fit.join("、")}</p>
    <p class="q">你的生財天賦</p>
    <p>${r.money.talent}</p>
    <p class="dim">${mg.counts && mg.counts["天醫"]
      ? `另外值得一提：你的八星磁場中有 ${mg.counts["天醫"]} 組「天醫」——這是八星裡最直接與財富相關的磁場，與上面的結論互相印證。`
      : `不過要留意：你的八星磁場中沒有「天醫」這顆主財星。這代表財富需要靠後天數字補強，否則容易出現「能力配得上更好的收入，但就是卡著」的狀況。`}</p>
    <p class="q">適不適合當老闆</p>
    <div class="stars">${"★".repeat(r.money.biz.star)}${"☆".repeat(5-r.money.biz.star)}</div>
    <p>${r.money.biz.verdict}——${r.money.biz.why}</p>`},

  // 10 流年
  {t:`${c.baseYear} 流 年`, h:`
    <p class="q">流年數 ${c.numbers.personalYear}　·　${r.yearFortune.current.name}</p>
    <p>${r.yearFortune.current.desc}</p>
    <p class="q">今年該如何度過</p>
    <p>${r.yearFortune.current.tip}</p>
    <p class="dim">感情：${r.yearFortune.current.love}</p>
    <p class="dim">工作：${r.yearFortune.current.work}</p>
    <p class="q">如何呼應本命</p>
    <p>你是${c.element}型的${r.summary.title}，今年走「${r.yearFortune.current.name}」。${
      r.yearFortune.current.theme==="開始"||r.yearFortune.current.theme==="成果與資源"
      ?"流年方向與你的本質同向，是順推的一年，該出手就出手。"
      :"流年節奏與你的本能不完全同向，順著流年走會比硬撐本性省力。"}</p>`},

  // 收尾：未解鎖為預告頁；已解鎖的收尾與工具已移入 unlockedPages
  ...(UNLOCKED ? unlockedPages(r,c,mg) : [{t:"你 只 看 到 了 一 半", h:`
    <p>剛才這 ${countFreePages()} 頁，只是你命盤的<b>輪廓</b>。</p>
    <p>真正能改變你生活的部分——那些關於「怎麼做」的答案——
       還鎖在後面。</p>

    <div class="locklist">
      <div class="li"><span class="q2">？</span>
        <div><b>你會遇到什麼樣的人</b><br>
        <i>桃花元素已算出，但對象的樣貌、出現的場合還沒揭曉</i></div></div>
      <div class="li"><span class="q2">？</span>
        <div><b>如何一眼認出爛桃花</b><br>
        <i>${r.avoidBadPeach.signs.length} 項具體警訊，避開你命中最容易踏進的感情陷阱</i></div></div>
      <div class="li"><span class="q2">？</span>
        <div><b>未來五年，哪一年會翻身</b><br>
        <i>逐年流年運勢，連逢凶化吉的方法都寫給你</i></div></div>
      <div class="li"><span class="q2">？</span>
        <div><b>你缺的數字，到底該怎麼補</b><br>
        <i>先天不足，用手機號碼、車牌就能補回來</i></div></div>
    </div>

    <div class="bignum">
      <b>${r.highlights.total}</b><span>項專屬於你的分析，正在等待解鎖</span>
    </div>

    <button class="cta" id="toSales">解 開 完 整 命 盤</button>
    <button class="backlink" id="restart">重新測算</button>`}]),
  ];
}

/**
 * 建書。
 * ⚠️ keepPage=true 時保留目前頁碼——從銷售頁返回時若重建整本書，
 *    使用者會被丟回第一頁，先前發生過這個問題。
 */
function renderBook(keepPage=false){
  const back = keepPage ? pageIdx : 0;
  pages = buildPages(); pageIdx = back;
  document.getElementById("pages").innerHTML =
    pages.map((p,i)=>`<div class="page" data-i="${i}"><h3>${p.t}</h3>${p.h}</div>`).join("");
  document.getElementById("dots").innerHTML =
    pages.map((_,i)=>`<div class="dot" data-i="${i}"></div>`).join("");
  document.querySelectorAll("#dots .dot").forEach(d=>
    d.onclick=()=>showPage(+d.dataset.i));
  bindTool();
  showPage(Math.min(back, pages.length-1));
}

/* ── 數字檢測工具：綁定於書頁內 ── */
function bindTool(){
  const inp = document.getElementById("toolIn");
  if(!inp) return;                       // 免費版沒有這一頁
  const hint = document.getElementById("toolHint");
  const out  = document.getElementById("toolOut");

  const setHint = ()=>{ hint.textContent = USE_CASES[TOOL_TABS[toolTab]].tip; };
  setHint();

  document.querySelectorAll("#toolTabs .tab").forEach(b=>{
    b.onclick = ()=>{
      toolTab = +b.dataset.i;
      document.querySelectorAll("#toolTabs .tab").forEach(x=>
        x.classList.toggle("on", +x.dataset.i===toolTab));
      setHint();
      out.innerHTML = "";               // 換類別時清空舊結果，避免張冠李戴
      inp.value = "";
      inp.focus();
    };
  });

  document.getElementById("toolGo").onclick = runTool;
  inp.addEventListener("keydown", e=>{ if(e.key==="Enter") runTool(); });
}

function showPage(i, back=false){
  if(i<0||i>=pages.length) return;
  pageIdx=i;
  document.querySelectorAll("#pages .page").forEach((el,k)=>{
    el.classList.toggle("rev", back);
    el.classList.toggle("on", k===i);
    if(k===i) el.scrollTop=0;
  });
  document.querySelectorAll("#dots .dot").forEach((d,k)=>d.classList.toggle("on",k===i));
  document.getElementById("pgnum").textContent = `${i+1} / ${pages.length}`;
  document.getElementById("prev").disabled = i===0;
  document.getElementById("next").disabled = i===pages.length-1;
  // 最後一頁的按鈕是動態產生的，每次顯示都要重新綁定
  const ts=document.getElementById("toSales"), rs=document.getElementById("restart");
  if(ts) ts.onclick=()=>go("sales");
  if(rs) rs.onclick=restart;
  // 數字檢測工具位於書的最後一頁，於 renderBook 後綁定一次即可
}

document.getElementById("prev").onclick=()=>showPage(pageIdx-1,true);
document.getElementById("next").onclick=()=>showPage(pageIdx+1);

/* 左右滑動翻頁 */
(function(){
  const leaf=document.querySelector(".leaf");
  let x0=null,y0=null;
  // 在輸入框、按鈕或檢測結果上滑動時不翻頁，避免與操作衝突
  const noSwipe = t => t && t.closest &&
    (t.closest("input,button,#toolOut,.tabs") !== null);
  leaf.addEventListener("touchstart",e=>{
    if(noSwipe(e.target)){ x0=null; return; }
    x0=e.touches[0].clientX;y0=e.touches[0].clientY;
  },{passive:true});
  leaf.addEventListener("touchend",e=>{
    if(x0===null) return;
    const dx=e.changedTouches[0].clientX-x0, dy=e.changedTouches[0].clientY-y0;
    // 僅在橫向位移明顯大於縱向時才翻頁，避免與捲動打架
    if(Math.abs(dx)>52 && Math.abs(dx)>Math.abs(dy)*1.6){
      dx<0 ? showPage(pageIdx+1) : showPage(pageIdx-1,true);
    }
    x0=y0=null;
  },{passive:true});
})();
addEventListener("keydown",e=>{
  if(!document.getElementById("book").classList.contains("on")) return;
  if(e.key==="ArrowRight") showPage(pageIdx+1);
  if(e.key==="ArrowLeft")  showPage(pageIdx-1,true);
});

/* ── 銷售頁 ── */
function renderSales(){
  const r=report, c=chart, mg=magRep;
  const teaser = mg.resolve.unresolved.length
    ? `你命中的「${mg.resolve.unresolved[0].field}」尚未化解`
    : mg.dominant ? `你的主導磁場是「${mg.dominant.field}」` : "你的命盤藏著關鍵訊息";
  document.getElementById("sales").innerHTML=`
    <div class="salesbox">
      <div class="lbl">完 整 命 盤 報 告</div>
      <h2>生命靈數 ${c.numbers.life}　${r.summary.title}</h2>

      <p class="pitch">你已經看過自己的輪廓。<br>
        但${teaser}——<br>
        而<b>化解與補強的方法</b>，就在完整報告裡。</p>

      <div class="sellrow"><span>◆</span><div>
        <b>桃花與正緣</b>你會遇到什麼類型的人、在哪裡遇到、
        以及如何一眼認出 ${r.avoidBadPeach.signs.length} 種爛桃花</div></div>
      <div class="sellrow"><span>◆</span><div>
        <b>未來五年流年</b>逐年吉凶、哪一年該衝、哪一年該守，逢凶化吉的方法</div></div>
      <div class="sellrow"><span>◆</span><div>
        <b>理想型與合夥人</b>什麼樣的人適合你、哪些數字的人是你的貴人</div></div>
      <div class="sellrow"><span>◆</span><div>
        <b>缺數的完整補法</b>你天生缺什麼、具體如何用後天數字補回來</div></div>
      <div class="sellrow highlight"><span>★</span><div>
        <b>數字檢測工具</b>輸入你的手機號碼、車牌、住址，
        立刻算出它與你本命合不合、該換成什麼——這一項，能用一輩子</div></div>

      <div class="totalbox">
        <b>${r.highlights.total}</b>
        <span>項專屬分析　·　${r.highlights.categories.length} 大類</span>
      </div>

      <p class="guarantee">同一組出生年月日，全世界只有一份這樣的報告。<br>
        它不是通用的心理測驗，是<b>只屬於你</b>的命盤。</p>

      <button class="cta" id="buy">解 鎖 完 整 報 告</button>
      <button class="backlink" id="backFree">再看一次免費內容</button>
    </div>`;
  document.getElementById("sales").scrollTop=0;
  document.getElementById("buy").onclick = ()=>{
    // 此處接金流。付費完成後應導向 unlock.html（或帶 reportId 的報告頁）。
    alert("此處接金流。\n\n付費後的完整報告樣貌，\n請開啟 unlock.html 檢視。");
  };
  document.getElementById("backFree").onclick = ()=>go("result", true);
}

function restart(){
  document.getElementById("bd").value="";
  document.getElementById("err").textContent="";
  chart=null; report=null; magnet=null; magRep=null;
  go("intro");
}

/* ── 數字檢測工具（付費後功能）── */
const TOOL_TABS = ["手機號碼","身分證字號","車牌","住址門牌","銀行帳號"];
let toolTab = 0;

function runTool(){
  const inp = document.getElementById("toolIn");
  const out = document.getElementById("toolOut");
  if(!inp || !out) return;
  const digits = String(inp.value).replace(/[^0-9]/g,"");
  if(digits.length < 2){
    out.innerHTML = `<p class="dim" style="text-align:center;margin-top:16px">
      請至少輸入 2 位數字。</p>`;
    return;
  }
  inp.blur();                            // 收起鍵盤，讓結果完整顯示

  const kind = TOOL_TABS[toolTab];
  const a = analyzeNumber(digits, kind);
  const m = matchScore(magnet, a);
  const uc = USE_CASES[kind];
  const kindCls=k=>k==="吉"?"good":k==="凶"?"bad":"mid";

  const colour = a.score>=75 ? "#8FC79A" : a.score>=55 ? "var(--kin)" : "#E58B7B";
  const verdict = a.score>=75 ? "這組數字對你相當有利"
               : a.score>=55 ? "這組數字尚可，仍有補強空間"
               : "這組數字與你較不相合，建議調整";

  out.innerHTML = `
    <div class="bigscore" style="color:${colour}">${a.score}</div>
    <div class="verdict" style="color:${colour}">${verdict}</div>

    <p class="q" style="font-family:var(--serif);font-size:16px;color:var(--hakuji);
      border-left:2px solid var(--kin);padding-left:11px;margin:22px 0 10px">磁場拆解</p>
    ${a.total ? `<div class="pairs">${a.pairs.map(p=>
      `<div class="pr ${kindCls(FIELD_INFO[p.field].kind)}"><b>${p.pair}</b><span>${p.field}</span></div>`).join("")}</div>
      <div class="ratio">
        <i class="g" style="width:${a.goodRatio}%"></i><i class="b" style="width:${100-a.goodRatio}%"></i></div>
      <div class="ratiotxt"><span>吉星 ${a.goodRatio}%</span><span>凶星 ${100-a.goodRatio}%</span></div>`
    : `<p style="font-size:13px;color:rgba(240,235,224,.6)">這組數字幾乎都是 0 與 5，未形成明顯磁場。在數字易經中屬於中性，不加分也不扣分。</p>`}

    <p class="q" style="font-family:var(--serif);font-size:16px;color:var(--hakuji);
      border-left:2px solid var(--kin);padding-left:11px;margin:22px 0 10px">與你本命的契合度</p>
    <p style="font-size:13.5px;line-height:2;color:rgba(240,235,224,.86)">
      契合度 ${m.score} 分。
      ${m.rescue.length ? `這組數字能化解你本命中的${m.rescue.join("、")}，是很好的搭配。` : ""}
      ${m.complement.length ? `它補上了你本命缺少的${m.complement.join("、")}。` : ""}
      ${!m.rescue.length && !m.complement.length ? "它與你本命的磁場高度重疊，沒有明顯互補——不算壞，但也沒有幫你補到不足的地方。" : ""}
    </p>

    ${a.resolve.filter(r=>!r.resolved).length ? `
      <p class="q" style="font-family:var(--serif);font-size:16px;color:var(--hakuji);
        border-left:2px solid var(--kin);padding-left:11px;margin:22px 0 10px">這組數字的隱憂</p>
      ${a.resolve.filter(r=>!r.resolved).map(r=>
        `<div class="res no"><div class="h">${r.field}　未化解</div>
         <p>${FIELD_INFO[r.field].resolveNote||""}建議在號碼中加入${r.missing.join("、")}的組合。</p></div>`).join("")}` : ""}

    ${(()=>{
      // ⚠️ 這裡的 recommendPairs 是 magnetic.js 的原始版，回傳物件沒有 info 欄位，
      //    因此磁場資訊改由全域 FIELD_INFO 直接查，避免讀取 undefined.info 而整段崩潰。
      const recs = recommendPairs(a);
      if(!recs.length) return `
        <p style="font-size:13px;color:#8FC79A;margin-top:18px">這組數字的吉星已相當完整，無須額外補強。</p>`;
      return `
        <p class="q" style="font-family:var(--serif);font-size:16px;color:var(--hakuji);
          border-left:2px solid var(--kin);padding-left:11px;margin:22px 0 10px">建議加入的組合</p>
        ${recs.map(x=>`
          <p style="font-size:12.5px;color:rgba(240,235,224,.6);margin-bottom:6px">
            補「${x.field}」（${FIELD_INFO[x.field].short}）</p>
          <div class="pairs">${x.pairs.slice(0,8).map(pp=>
            `<div class="pr good"><b>${pp}</b></div>`).join("")}</div>`).join("")}`;
    })()}

    <div style="margin-top:24px;padding:15px;border:1px solid rgba(201,162,39,.2);
      border-radius:5px;background:rgba(201,162,39,.04)">
      <p style="font-size:12px;color:var(--kin);letter-spacing:.2em;margin-bottom:9px">
        為什麼${kind}重要</p>
      <p style="font-size:13px;line-height:1.95;color:rgba(240,235,224,.76);margin:0">${uc.why}</p>
    </div>`;
  // 捲到結果起點，避免使用者以為沒反應
  setTimeout(()=>out.scrollIntoView({behavior:"smooth",block:"start"}), 80);
}

/* ── 啟動 ── */
layout(); setHots(); go("intro");
