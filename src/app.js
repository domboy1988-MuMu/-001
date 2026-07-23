
/* 解鎖狀態由入口檔（demo.html / unlock.html）設定於 window.UNLOCKED。
   ⚠️ 這裡刻意讀取 window 屬性而非宣告同名變數——
      若入口檔用 const 宣告、本檔再用 var 宣告，會觸發
      「Identifier has already been declared」而使整個檔案停止執行（全白/黑屏）。
   未設定時預設為未解鎖，避免免費版意外洩漏付費內容。 */
const UNLOCKED = (typeof window !== "undefined" && window.UNLOCKED === true);

/* ══════════════════════════════════════════════════════════
   音訊
   ⚠️ 兩個曾經出錯的地方，改動前請先讀：

   1. 音樂不播
      舊版 bgmStart() 開頭是 if(!bgmReady) return;——
      音樂檔 3.3MB，若使用者在載入完成前就點了水晶球，
      函式直接放棄且不再重試，整場都不會有聲音。
      現在改為記住「使用者要聽」的意圖，載好即自動補播。

   2. 音量打架
      影片本身帶有環境音效，與背景音樂同時播放會互相干擾。
      解法不是調整音量比例，而是分離時序：
        影片播放期間（開場→揭曉→v4 收尾）由影片音效主導，音樂不出聲；
        v4 播完後才淡入音樂，作為閱讀報告時的背景。
      使用者點擊水晶球是為了解除瀏覽器的自動播放限制並記住意圖，
      實際播放時機則延後到 v4 結束。
   ══════════════════════════════════════════════════════════ */
const BGM_SRC    = "assets/audio/bgm.mp3";
/* 音量。
   四支影片音軌已用 EBU R128 正規化至 -18 LUFS，彼此差距 0.6 dB 內，
   因此單一數值即可控制全部，不需個別調整。
   （正規化前 v1 為 -36.7 LUFS、v3 為 -21.1 LUFS，相差 15.6 dB，
     當時無論怎麼調 volume 都無法讓 v1 聽得清楚。）

   BGM 素材為 -14.7 LUFS，比影片響 3.3 dB。
   設定 BGM 0.85、影片 0.55 後，換算：
     BGM   -14.7 + 20log10(0.85) = -16.1 dB  ← 主導
     影片   -18.0 + 20log10(0.55) = -23.2 dB  低於音樂 7.1 dB
   音效因此只作點綴，不會蓋過音樂。 */
const BGM_VOLUME = 0.85;   // 背景音樂（主導，已調大）
const VID_VOLUME = 0.55;   // 影片音效（點綴，不得蓋過音樂）

const bgmEl = document.getElementById("bgm");
let bgmReady = false, bgmMuted = false, bgmWanted = false, bgmStarted = false, bgmFading = null;

bgmEl.src = BGM_SRC;
bgmEl.volume = 0;
bgmEl.loop = true;

bgmEl.addEventListener("canplay", ()=>{
  bgmReady = true;
  // 若 v4 已經播完、只是當時音樂還沒載好 → 立刻補播
  if(stage==="result" || stage==="sales") bgmBegin();
});
bgmEl.addEventListener("error", ()=>{
  bgmReady = false;
  document.getElementById("mute").style.display = "none";
});

function bgmPlay(){
  bgmEl.volume = 0;               // 一律從無聲開始，避免突然出現
  const p = bgmEl.play();
  if(p) p.catch(()=>{});          // 自動播放被擋時靜默失敗，不中斷流程
  // 慢速淡入：4 秒讓音樂自然浮現，而非「啪」一聲進來
  bgmFade(BGM_VOLUME, 4000);
  document.getElementById("mute").style.display = "flex";
}

/**
 * 由使用者互動觸發（點擊水晶球）。
 * 此處只記住意圖並解除瀏覽器的自動播放限制，不立即播放——
 * 音樂要等 v4-outro 播完、進入閱讀報告階段才淡入。
 */
function bgmStart(){
  bgmWanted = true;
}

/** v4-outro 結束後才真正開始播放音樂 */
function bgmBegin(){
  if(!bgmWanted || bgmMuted || bgmStarted) return;
  if(!bgmReady) return;      // 尚未載好，canplay 會接手
  bgmStarted = true;
  bgmPlay();
}

/* v4 播完 → 影片音效告一段落，音樂接手 */
document.getElementById("v4").addEventListener("ended", bgmBegin);

/* v3 播完 → 立即轉場至報告，讓 v4 接續而非中途切斷 */
document.getElementById("v3").addEventListener("ended", ()=>{
  if(stage==="reveal") go("result");
});

/* 平滑調整音量，避免忽大忽小 */
/**
 * 平滑調整音量。
 * 音量漸強採二次曲線（緩起），前段幾乎聽不出來，
 * 比線性淡入自然許多——線性淡入在中段會顯得突然變大。
 */
function bgmFade(target, ms=1200){
  clearInterval(bgmFading);
  const from = bgmEl.volume, steps = 40, dt = ms/steps;
  const rising = target > from;
  let i = 0;
  bgmFading = setInterval(()=>{
    i++;
    const t = i/steps;
    const eased = rising ? t*t : t;   // 漸強緩起、漸弱維持線性
    bgmEl.volume = Math.max(0, Math.min(1, from + (target-from)*eased));
    if(i>=steps) clearInterval(bgmFading);
  }, dt);
}

document.getElementById("mute").addEventListener("click", ()=>{
  bgmMuted = !bgmMuted;
  document.getElementById("mute").classList.toggle("off", bgmMuted);
  if(bgmMuted){
    bgmFade(0, 320); setTimeout(()=>bgmEl.pause(), 340);
  }else{
    // 僅在音樂原本已開始播放的階段才恢復，避免影片還在播就出聲
    if(bgmStarted && bgmReady){ bgmEl.play().catch(()=>{}); bgmFade(BGM_VOLUME); }
  }
  // 影片音軌一併靜音，靜音鈕代表「全部靜音」而非只關音樂
  ["v1","v2","v3","v4"].forEach(id=>{
    document.getElementById(id).muted = bgmMuted || !soundOn;
  });
});

/* ══════════════════════════════════════════════════════════
   熱區座標設定 ── 你要調的就是這裡
   x,y = 佔畫面寬/高的百分比（圓心位置）
   size = 直徑佔畫面寬度的百分比
   按鍵盤 C 開啟校準模式，會顯示熱區範圍，對準水晶球後改數字即可
   ══════════════════════════════════════════════════════════ */
const HOTSPOTS = {
  // 以下座標已依實際影片校準（v1 亮度核心分析 + 目視確認），可直接使用。
  // 若日後更換影片，按鍵盤 C 開啟校準模式重新對位即可。
  // 球體實測：中心 x 50.0% / y 65.2%，直徑約 18% 畫面寬（亮度剖面量測）。
  // 熱區設 22% 使光環恰好落在球體外緣，而非罩住整個人物。
  intro:   { x: 50, y: 65, size: 22 },   // v1 水晶球
  collect: { x: 50, y: 65, size: 22 },   // 同上（沿用 v1 停格畫面）
  result:  { x: 79, y: 11, size: 17 },   // v4 天空日／月（預設未啟用）
};

/* 揭曉數字的位置。
   ⚠️ 不可沿用水晶球座標——v3 的光是往上竄的，
      爆光中心在 y=48%，比 v1 水晶球的 y=66% 高出許多，
      數字放在球體位置會落在光團下方的暗處。 */
const REVEAL_POS = { x: 50, y: 48 };

/* 生日輸入完成後自動送出的等待時間。
   保留約 1 秒是為了讓使用者有機會發現打錯並修正——
   期間只要再有任何輸入，計時就會取消重數。 */
const AUTO_SUBMIT_MS = 1000;

/* 結果頁的「日／月」熱區開關。
   只有當 v4 影片右上角真的有太陽或月亮時才設為 true，
   否則會變成一個懸空的神祕圓圈，使用者不知道那是什麼。
   關閉時改用結果頁下方的文字連結返回。 */
const SUN_HOTSPOT_ENABLED = false;

const CALC_MS = 9000;          // 計算動畫長度（v2 全長 10 秒，播 9 秒不會循環到接縫）

/* 揭曉時間點：依 v3-reveal.mp4 的實際節奏設定。

   影片已剪為 2.2 秒（取原始 10 秒檔的第 3.5～5.7 秒），
   爆光峰值落在第 1.5 秒，首尾各 0.35 秒淡入淡出。

   ⚠️ 為何是「剪掉前段」而非「剪掉最後三秒」：
      原本 5.2 秒版本的爆光在第 3 秒，若直接砍掉最後三秒
      只剩 2.2 秒，爆光與數字都會被剪掉，揭曉就沒有了。
      因此改為保留爆光、剪去前段的緩慢鋪陳，
      長度同樣是 2.2 秒，但高潮完整保留。

   ⚠️ 轉場由影片的 ended 事件觸發，計時器僅作保險。
      若用固定秒數，影片一旦更換或載入延遲就會出現
      「v3 還在播就切走」或「v3 播完卡住」的斷層。 */
const REVEAL_NUM_MS = 1350;    // 數字浮現（比峰值早 0.15 秒，讓光包住數字）
const REVEAL_END_MS = 2300;    // 保險用；正常情況由 v3 的 ended 事件先觸發

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
/**
 * 切換顯示中的影片。
 * @param {boolean} cut 為 true 時直接硬切，不走 CSS 交叉淡入。
 *   進入報告頁時使用硬切：v3 結尾已自帶淡出，
 *   若再疊 0.6 秒的交叉淡入，會出現兩支影片同時半透明的殘影。
 */
function showVid(id, cut=false){
  const stage=document.getElementById("stage");
  if(cut) stage.classList.add("nofade");
  ["v1","v2","v3","v4"].forEach(v=>{
    const el=document.getElementById(v);
    el.classList.toggle("on", v===id);
    if(v!==id){ el.pause(); }
  });
  if(cut) setTimeout(()=>stage.classList.remove("nofade"), 60);
}
function playVid(id,{loop=false,cut=false}={}){
  const el=document.getElementById(id);
  el.loop=loop;
  el.muted = !soundOn || bgmMuted;
  el.volume = VID_VOLUME;      // 影片音效襯底，音樂為主
  el.currentTime=0;
  const p=el.play();
  if(p) p.catch(()=>{ /* 被瀏覽器擋下時靜音重播 */ el.muted=true; el.play().catch(()=>{}); });
  showVid(id, cut);
}

/* 熱區顯示規則：只有該用的時候才出現 */
function setHots(){
  hotBall.style.display = (stage==="intro"||stage==="collect") ? "block":"none";
  hotSun.style.display  = (stage==="result" && SUN_HOTSPOT_ENABLED) ? "block":"none";
  const ready = stage==="collect" && validBirthday();
  hotBall.classList.toggle("idle", stage==="collect" && !ready);
  hotBall.classList.toggle("armed", ready);
  // 提示文字與熱區狀態連動，避免「球暗著但字在閃」的矛盾
  const ch = document.getElementById("collectHint");
  if(ch){
    ch.classList.toggle("waiting", stage==="collect" && !ready);
    ch.textContent = ready ? "正 在 為 你 占 卜 …" : "輸 入 完 成 後 自 動 開 始";
  }
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
  if(next!=="reveal") clearTimeout(revealTimer);
  if(next==="result"){
    // 硬切至 v4：v3 已淡出，直接接上比交叉淡入乾淨
    playVid("v4",{cut:true}); renderBook(keepPage);
    // 保險：v4 播放失敗或已結束時，仍要讓音樂在合理時間內出現
    setTimeout(bgmBegin, 11000);
  }
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
  scheduleAutoSubmit();
});

/* ── 自動送出 ──
   八碼填妥且日期合法時，短暫等待後自動進入計算，
   使用者不必再找按鈕。任何新的輸入都會取消並重新計時。 */
let autoTimer = null;
function cancelAutoSubmit(){
  // ⚠️ 用 !== null 而非真值判斷：計時器 ID 若為 0 會被當成 false，
  //    導致舊計時沒被取消，使用者修改中的日期仍會被送出。
  if(autoTimer !== null){ clearTimeout(autoTimer); autoTimer=null; }
  const bd=document.getElementById("bd");
  if(bd) bd.classList.remove("counting");
}
function scheduleAutoSubmit(){
  cancelAutoSubmit();
  if(stage!=="collect" || !validBirthday()) return;
  const bd=document.getElementById("bd");
  // 先移除再重新加入，強制 CSS 倒數動畫從頭播放
  bd.classList.remove("counting");
  void bd.offsetWidth;
  bd.classList.add("counting");
  autoTimer = setTimeout(()=>{
    autoTimer=null;
    // 再確認一次：這段期間使用者可能已改動或離開此頁
    if(stage==="collect" && validBirthday()) submit();
  }, AUTO_SUBMIT_MS);
}
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
  cancelAutoSubmit();
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
let revealTimer = null;
function runReveal(){
  const n=document.getElementById("num");
  // 對齊 v3 的爆光中心，讓數字自光團中浮現
  n.style.left=REVEAL_POS.x+"%"; n.style.top=REVEAL_POS.y+"%";
  n.innerHTML=""; n.classList.remove("on");
  setTimeout(()=>{
    n.innerHTML = `<span class="lead">你 的 生 命 靈 數</span>` +
                  `<span class="digit">${chart.numbers.life}</span>`;
    n.classList.add("on");
  }, REVEAL_NUM_MS);
  // 影片自然播完即轉場，確保 v3 與 v4 無縫銜接
  clearTimeout(revealTimer);
  revealTimer = setTimeout(()=>{ if(stage==="reveal") go("result"); }, REVEAL_END_MS);
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
  const gd = r.gridReading;
  const dy = r.dayun;
  const chips=(arr,cls="")=>`<div class="chips">${arr.map(n=>`<div class="chip ${cls}">${n}</div>`).join("")}</div>`;
  return [

  // ═══ 付費 1 ═══ 桃花 · 理想型 · 爛桃花（三合一）
  {t:"桃 花 與 正 緣", h:`
    <div class="crown">
      <div class="lbl">桃 花 指 數</div>
      <div class="big" style="font-size:52px">${r.peachBlossom.score}</div>
      <div class="sub">${r.peachBlossom.name}</div>
    </div>
    <p>${r.peachBlossom.desc}</p>
    <p class="q">你會遇到的類型</p>
    <p>${r.peachBlossom.meetType}</p>
    <p class="dim">最容易遇見的場域：${r.peachBlossom.where}<br>
       推進節奏：${r.peachBlossom.speed}</p>
    <p class="q">而你真正需要的（態度數 ${r.idealType.number}）</p>
    <p>${r.idealType.type}——${r.idealType.why}</p>
    <p class="dim">應該避開：${r.idealType.avoid}</p>
    <p class="q">你最大的感情風險</p>
    <p>${r.avoidBadPeach.risk}</p>
    <p class="dim">${r.avoidBadPeach.riskSource}</p>
    <p class="q">出現這些訊號要警覺</p>
    ${r.avoidBadPeach.signs.map((x,i)=>
      `<div class="res no"><div class="h">警訊 ${i+1}</div><p>${x}</p></div>`).join("")}
    <p class="q">核心守則</p>
    <p>${r.avoidBadPeach.rule}</p>`},

  // ═══ 付費 2 ═══ 未來五年流年
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

  // ═══ 付費 3 ═══ 我的一生命運走向
  {t:"我 的 一 生 命 運 走 向", h:`
    <p>前面談的是「你是什麼樣的人」。這一章談的是「你會走上什麼樣的路」。</p>
    <p class="q">命運線</p>
    <p>${gd.destiny.text}</p>
    <p class="q">九年一輪的節奏</p>
    <p>流年以九年為一個完整循環：從啟動（1）、醞釀（2）、綻放（3）、
       扎根（4）、變動（5）、承擔（6）、沉潛（7）、收成（8），到收束（9），
       然後回到起點重新開始。</p>
    <p>你現在走在 <b>${c.baseYear} 年・流年 ${c.numbers.personalYear}「${r.yearFortune.current.name}」</b>，
       也就是這一輪的第 ${c.numbers.personalYear} 年。
       ${c.numbers.personalYear <= 3
         ? "循環的前段，重點是開始與累積——這時候的努力多半看不到成果，但它決定了後面六年的高度。"
         : c.numbers.personalYear <= 6
           ? "循環的中段，是最忙也最實在的階段——你在把前面播下的種子養大。"
           : "循環的後段，重點從擴張轉為收成與整理——該收的收，該放的放，為下一輪騰出空間。"}</p>
    <div class="cyc">${[1,2,3,4,5,6,7,8,9].map(n=>
      `<div class="cy ${n===c.numbers.personalYear?"now":""}">
         <b>${n}</b><span>${["啟動","醞釀","綻放","扎根","變動","承擔","沉潛","收成","收束"][n-1]}</span>
       </div>`).join("")}</div>
    <p class="q">你這一生反覆出現的主題</p>
    <p>主命數 ${c.numbers.life}「${r.summary.title}」是貫穿一生的主軸。
       它不會因為年紀改變，只會用不同的面貌反覆出現——
       二十歲時是一種樣子，四十歲時是另一種，但底層是同一件事。</p>
    <p class="tip"><b>核心課題</b>${r.lesson.title}——${r.lesson.body.split("。")[0]}。</p>
    <p class="q">你走得順與走得卡的時候</p>
    <p class="dim">順：${r.yearFortune.timeline.filter(t=>t.score>=78).map(t=>t.year+"（"+t.name+"）").join("、")||"未來五年沒有特別強的年份，屬平穩期"}<br>
       卡：${r.yearFortune.timeline.filter(t=>t.score<66).map(t=>t.year+"（"+t.name+"）").join("、")||"未來五年沒有明顯的低谷"}</p>
    <p>走得卡的年份不是壞事，是節奏不同。九年裡本來就有前進與收束的段落——
       在該沉潛的年份硬推，才是真正的耗損。</p>`},

  // ═══ 付費 4 ═══ 大運：0–120 歲
  {t:"大 運 · 一 生 的 階 段", h:`
    <p>${dy.overview}</p>
    <p class="dim">${dy.note}</p>

    <p class="q">你現在這一步</p>
    <div class="dyhero">
      <div class="dyage">${dy.current ? `${dy.current.from}–${dy.current.to} 歲` : "—"}</div>
      <div class="dyname">${dy.current ? dy.current.name : "—"}</div>
      <div class="dysub">${dy.current ? `${dy.current.phase}　·　大運數 ${dy.current.num}　·　西元 ${dy.current.years[0]}–${dy.current.years[1]}` : ""}</div>
    </div>
    ${dy.current ? `
      <p>${dy.current.desc}</p>
      <p class="tip"><b>要注意</b>${dy.current.watch}</p>
      <p class="tip"><b>適合做</b>${dy.current.good}</p>
      ${dy.current.events.map(e=>
        `<div class="dyev"><span>${e.kind}</span><p>${e.text}</p></div>`).join("")}` : ""}

    ${dy.next ? `
      <p class="q">下一步：${dy.next.from} 歲起</p>
      <p>${dy.next.desc}</p>
      <p class="tip"><b>提前準備</b>${dy.next.watch}</p>` : ""}

    <p class="q">一生 ${dy.steps.length} 步大運總覽</p>
    <div class="dylist">
      ${dy.steps.map(s=>`
        <div class="dyrow ${s.current?"now":""} ${s.past?"past":""}">
          <div class="dyr1">
            <b>${s.from}–${s.to} 歲</b>
            <span class="dyr-name">${s.name}</span>
            <i>${s.phase}</i>
          </div>
          <div class="dyr2">${s.years[0]}–${s.years[1]}　·　${s.theme}</div>
          ${s.events.length?`<div class="dyr3">${s.events.map(e=>
            `<span class="dytag">${e.kind}</span>`).join("")}</div>`:""}
        </div>`).join("")}
    </div>

    <p class="q">重點階段提醒</p>
    ${dy.steps.filter(s=>!s.past && s.events.some(e=>["車關","健康","財運","感情"].includes(e.kind)))
      .slice(0,4).map(s=>`
      <div class="cross">
        <div class="h">${s.from}–${s.to} 歲　${s.name}</div>
        ${s.events.filter(e=>["車關","健康","財運","感情"].includes(e.kind))
          .map(e=>`<p><b>${e.kind}</b>　${e.text}</p>`).join("")}
      </div>`).join("") || `<p class="dim">你尚未到來的階段中，沒有特別需要提防的項目。</p>`}`},

  // ═══ 付費 4 ═══ 完整分析總表
  {t:"完 整 分 析 總 表", h:`
    <p>以下是你命盤中所有可歸納的要點，共 ${r.highlights.total} 項，
       分為 ${r.highlights.categories.length} 大類。</p>
    ${r.highlights.categories.map(cat=>`
      <p class="q">${cat}</p>
      <ul class="items">${r.highlights.items.filter(i=>i.category===cat)
        .map(i=>`<li>${i.text}</li>`).join("")}</ul>`).join("")}`},

  // ═══ 付費 5 ═══ 數字檢測（獨立頁）
  {t:"數 字 檢 測", h:`
    <div class="tfix">
      <div class="tfix-k">你 的 主 體 · 不 可 更 動</div>
      <div class="tfix-b">
        <div class="tfix-d">${c.input.date.replace(/-/g," / ")}</div>
        <div class="tfix-n">
          <span>生命靈數 <b>${c.numbers.life}</b></span>
          <span>五行 <b>${c.element}</b></span>
          <span>磁場 <b>${mg.dominant?mg.dominant.field:"空盤"}</b></span>
        </div>
      </div>
      <p class="tfix-p">${mg.resolve.unresolved.length
        ? `你的本命有「${mg.resolve.unresolved.map(u=>u.field).join("、")}」尚未化解，
           需要補上 ${[...new Set(mg.resolve.unresolved.flatMap(u=>u.missing))].join("、")}。
           以下的後天數字，就是用來補這個缺口的。`
        : `你的本命凶星都已化解，後天數字只要維持不扣分即可。`}</p>
    </div>

    <p class="q">填入你正在使用的號碼</p>
    <p class="dim">只填想檢查的即可，不需要全部填寫。</p>
    <div class="tform">
      ${TOOL_ITEMS.map(it=>`
        <div class="trow">
          <label for="t_${it.id}">
            <b>${it.label}</b>
            <i>${it.hint}</i>
          </label>
          <input id="t_${it.id}" class="tnum" inputmode="numeric" placeholder="數字">
        </div>`).join("")}
      <div id="toolCustom"></div>
      <button class="taddbtn" id="toolAdd">＋ 自訂項目（最多 3 項）</button>
    </div>

    <button class="cta" id="toolRun">開 始 測 算</button>

    <div id="toolOut"></div>`},

  // ═══ 付費 5 ═══ 報告完結
  {t:"報 告 完 結", h:`
    <p>你的完整命盤已全部揭曉，共 ${r.highlights.total} 項分析。</p>
    <p class="dim">這份報告沒有標準答案，它只是把你身上原本就有的東西，
       用數字的語言說了一遍。看完之後覺得哪裡不像，那也是有意義的——
       不像的地方，往往才是你這些年真正走出來的路。</p>
    <p class="q">最後想說的</p>
    <p>數字看得見輪廓，看不見選擇。
       命盤告訴你哪條路走起來省力、哪條路要花更多力氣，
       但要走哪一條，從來都是你自己決定的。</p>
    <p class="dim">如果這份報告有任何一段讓你停下來想了一下，
       那一段就是它真正的用處。其餘的，看過就好。</p>
    <button class="backlink" id="restart">重新測算</button>`},

  ];
}


/* ── 九宮格 SVG ──
   3×3 格線，有的數字實心、缺的虛線；成形的連線以金色貫穿。
   線條先畫（在底層），數字後畫，避免線壓過字。

   ⚠️ 漸層必須用 gradientUnits="userSpaceOnUse"。
      預設的 objectBoundingBox 是以元素邊界框為座標系，
      而「直線」的邊界框寬或高為 0（垂直線寬 0、水平線高 0），
      漸層無法計算，瀏覽器會整條不渲染——
      實際發生過：只有兩條對角線畫得出來，2-5-8 等直線全部消失。 */
function gridSVG(gr){
  const S=250, PAD=34, CELL=(S-PAD*2)/2;   // 格心間距
  const pos=n=>{ const i=n-1; return [PAD+(i%3)*CELL, PAD+Math.floor(i/3)*CELL]; };
  let out=`<svg class="ninegrid" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">`;

  // 漸層定義置於最前，並指定 userSpaceOnUse 以支援直線
  out+=`<defs><linearGradient id="lg" gradientUnits="userSpaceOnUse"
      x1="0" y1="0" x2="${S}" y2="${S}">
    <stop offset="0" stop-color="#F2D877"/><stop offset="1" stop-color="#C9A227"/>
  </linearGradient></defs>`;

  // 底層格線
  for(let i=0;i<3;i++){
    const p=PAD+i*CELL;
    out+=`<line x1="${PAD-16}" y1="${p}" x2="${S-PAD+16}" y2="${p}" stroke="rgba(201,162,39,.14)" stroke-width="1"/>`;
    out+=`<line x1="${p}" y1="${PAD-16}" x2="${p}" y2="${S-PAD+16}" stroke="rgba(201,162,39,.14)" stroke-width="1"/>`;
  }
  // 成形的連線
  gr.on.forEach((L,i)=>{
    const [x1,y1]=pos(L.nums[0]), [x2,y2]=pos(L.nums[2]);
    const len=Math.hypot(x2-x1,y2-y1);
    out+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
      stroke="url(#lg)" stroke-width="3.5" stroke-linecap="round" opacity=".9"
      stroke-dasharray="${len}" stroke-dashoffset="${len}">
      <animate attributeName="stroke-dashoffset" from="${len}" to="0" dur=".9s"
        begin="${i*0.18}s" fill="freeze"/></line>`;
  });
  // 數字
  for(let n=1;n<=9;n++){
    const [x,y]=pos(n), c=gr.count[n];
    if(c){
      out+=`<circle cx="${x}" cy="${y}" r="17" fill="rgba(201,162,39,.2)"
        stroke="#C9A227" stroke-width="1.5"/>`;
      out+=`<text x="${x}" y="${y+6}" text-anchor="middle" font-size="17"
        font-family="var(--magic)" fill="#FFF3D6">${n}</text>`;
      if(c>1) out+=`<text x="${x+15}" y="${y-11}" text-anchor="middle" font-size="10"
        font-family="var(--sans)" fill="#E8A33D">×${c}</text>`;
    }else{
      out+=`<circle cx="${x}" cy="${y}" r="17" fill="none"
        stroke="rgba(240,235,224,.18)" stroke-width="1.5" stroke-dasharray="3 3"/>`;
      out+=`<text x="${x}" y="${y+6}" text-anchor="middle" font-size="16"
        font-family="var(--sans)" fill="rgba(240,235,224,.22)">${n}</text>`;
    }
  }
  return out+`</svg>`;
}

/* 免費版在預告頁之前呈現的內容頁數（供文案動態引用）。
   ⚠️ 免費版共 8 頁，最後一頁是預告本身，故內容頁為 7 頁。
      調整頁面結構時務必同步更新，否則文案會與實際頁數不符。 */
function countFreePages(){ return 7; }

/* ── 魔法書：把報告編排成可翻閱的頁面 ── */
let pageIdx = 0, pages = [];

function buildPages(){
  const r=report, c=chart, io=r.innerOuter, nm=r.numerology, mt=r.match, mg=magRep, gd=r.gridReading;
  const kindCls=k=>k==="吉"?"good":k==="凶"?"bad":"mid";
  const chips=(arr,cls="")=>`<div class="chips">${arr.map(n=>`<div class="chip ${cls}">${n}</div>`).join("")}</div>`;

  return [
  // ═══ 1／8 命格 ═══ 生命靈數 · 性格 · 陰影 · 人生課題
  {t:"命 格 總 覽", h:`
    <div class="crown">
      <div class="lbl">你 的 生 命 靈 數</div>
      <div class="big">${c.numbers.life}</div>
      <div class="ttl">${r.summary.title}</div>
      <div class="sub">五行屬${c.element}　·　${r.summary.keywords.join("　")}</div>
    </div>
    <p>${r.personality.desc}</p>
    <p class="dim">${r.personality.shadow}</p>
    <p class="q">你這輩子的課題：${r.lesson.title}</p>
    <p>${r.lesson.body}</p>

    <p class="q">九 宮 格 連 線</p>
    ${gridSVG(gd)}
    <div class="gmeta">
      <span>連線 <b>${gd.onCount}</b> 條</span>
      <span>連線能量 <b>${gd.energy}</b></span>
    </div>
    <p class="dim">${gd.verdict}</p>
    ${gd.on.length?`<div class="lines">${gd.on.map(l=>
      `<div class="ln"><span class="no">${l.nums.join("-")}</span>
       <b>${l.title}</b><i>${l.key}</i></div>`).join("")}</div>`:""}
    ${gd.on.slice(0,2).map(l=>`<p><b>${l.title}</b>　${l.text}</p>`).join("")}
    ${gd.off.length?`
      <p class="q">尚未成形的連線</p>
      <p>連線沒有成形，<b>不是缺點</b>。它代表這個面向不是你的天生強項——
         你仍然做得到，只是需要靠後天的努力與方法，而不像成形的連線那樣不假思索就會。</p>
      <p class="dim">換個說法：成形的線是「順手」，未成形的線是「要練」。
         認出哪些要練，比誤以為自己樣樣都行更有用。</p>
      <div class="lines">${gd.off.map(l=>
        `<div class="ln dim3"><span class="no">${l.nums.join("-")}</span>
         <b>${l.title}</b><i>缺 ${l.lacking.join("、")}</i></div>`).join("")}</div>
      ${gd.off.slice(0,2).map(l=>
        `<p><b>${l.title}未成形</b>　${l.text}</p>`).join("")}
      ${gd.nearMiss.length?`
        <p class="q">最接近成形的一條</p>
        <p>「${gd.nearMiss[0].title}」（${gd.nearMiss[0].nums.join("-")}）
           只差數字 ${gd.nearMiss[0].lacking.join("、")}。
           差一個數字的連線，是後天最容易補起來的——
           在數字學中，把缺少的數字放進你日常會反覆使用的號碼裡，
           即視為為這條線補上缺口。</p>`:`
        <p class="dim">你未成形的連線都缺兩個以上的數字，補強空間有限，
           建議把力氣放在已成形的連線上，發揮長處比補短板划算。</p>`}`:`
      <p class="q">八條連線全部成形</p>
      <p>這在命盤中極為罕見。古來稱為「擁有選擇能力的人」——
         你在各個面向都有天生的基礎，什麼都做得來。
         但也正因如此，最容易迷失在選項之中。</p>`}

    <p class="q">${gd.marriage.label}</p>
    <p>${gd.marriage.text}</p>
    <p class="q">${gd.destiny.label}</p>
    <p>${gd.destiny.text}</p>
    <p class="dim">婚姻線與命運線非九宮格連線，
       前者由態度數 ${c.numbers.attitude} 與感情線推導，後者即主命數 ${c.numbers.life}。</p>`},

  // ═══ 2／8 特質 ═══ 優缺點 · 五行雷達 · 內外組合
  {t:"你 是 什 麼 樣 的 人", h:`
    <div class="pc">
      <div class="good"><div class="k">優 點</div><ul>${r.prosCons.pros.map(x=>`<li>${x}</li>`).join("")}</ul></div>
      <div class="bad"><div class="k">缺 點</div><ul>${r.prosCons.cons.map(x=>`<li>${x}</li>`).join("")}</ul></div>
    </div>
    <p class="q">五行分布</p>
    ${radarSVG(c.elementPct)}
    <div class="legend">${["木","火","土","金","水"].map(k=>
      `<span><i style="background:${EL_COLOR[k]}"></i>${k} ${c.elementPct[k]}%</span>`).join("")}</div>
    <p class="dim">${r.personality.balanceNote}</p>
    <p class="q">內在與外在</p>
    <div class="io">
      <div class="col"><div class="k">內 在</div><div class="n">${io.inner}</div><div class="t">${io.innerLabel}</div></div>
      <div class="gapbox">落差<b>${io.gap}</b></div>
      <div class="col"><div class="k">外 在</div><div class="n">${io.outer}</div><div class="t">${io.outerLabel}</div></div>
    </div>
    <p>${io.verdict}</p>
    ${io.misread?`<p class="dim">${io.misread}</p>`:""}
    <p class="dim">在職場上，外在數 ${io.outer} 決定同事對你的第一印象，
       內在數 ${io.inner} 才是你實際的決策方式——這正是你最容易被放錯位置的原因。</p>`},

  // ═══ 3／8 先天數 ＋ 八星磁場（同一組數字的兩種讀法，合併閱讀更連貫）═══
  {t:"先 天 數 字 與 磁 場", h:`
    <p class="q">本命數</p>
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
    <p class="q">這些磁場的吉凶比例</p>
    <p>你的命盤共組成 ${mg.total} 組磁場，其中吉星 ${mg.goodCount} 組、凶星 ${mg.badCount} 組。</p>
    <div class="ratio">
      <i class="g" style="width:${mg.goodRatio}%"></i>
      <i class="b" style="width:${100-mg.goodRatio}%"></i>
    </div>
    <div class="ratiotxt"><span>吉星 ${mg.goodRatio}%</span><span>凶星 ${100-mg.goodRatio}%</span></div>
    <div class="pairs">${mg.distribution.map(d=>
      `<div class="pr ${kindCls(d.kind)}"><b>${d.count}</b><span>${d.field}</span></div>`).join("")}</div>
    <p class="dim">凶星不等於壞。在數字易經裡，絕命是爆發力、五鬼是創意、
       六煞是人緣、禍害是口才——它們代表的是才華，只是更需要被引導。</p>
    ${mg.dominant ? `
      <p class="q">主導你的是「${mg.dominant.field}」</p>
      <p>${mg.dominant.desc}</p>
      <p class="dim">強的時候：${mg.dominant.strong}<br>
         要留意的：${mg.dominant.weak}</p>` : `
      <p class="q">你的命盤屬於「空盤」</p>
      <p>你的出生年月日中 0 與 5 的比例偏高，未形成明顯的主導磁場。
         這代表你的能量方向由後天數字決定的成分更大——手機號碼、車牌
         這類天天使用的數字，對你的影響會比一般人更明顯。</p>`}`},

  // ═══ 4／8 交會 ═══ 兩套系統的交叉解讀 · 化解與補強
  {t:"兩 套 命 盤 的 交 會", h:`
    <p>你已經看過兩套完全不同的系統：<b>生命靈數</b>看人格原型，
       <b>八星磁場</b>看能量分布。當兩者指向同一件事，那件事在你身上通常特別明顯。</p>
    ${mg.cross.map(x=>`<div class="cross"><div class="h">${x.title}</div><p>${x.text}</p></div>`).join("")}
    <p class="q">化解與補強</p>
    <p>${mg.resolve.summary}</p>
    ${mg.resolve.resolved.map(x=>`
      <div class="res ok"><div class="h">${x.field}　已化解</div>
      <p>你的命盤中同時具備${x.need.join("、")}，正是「${x.saying}」的格局。</p></div>`).join("")}
    ${mg.resolve.unresolved.map(x=>`
      <div class="res no"><div class="h">${x.field}　尚未化解</div>
      <p>${x.info.resolveNote||""}
         ${x.orderIssue?"你的命盤雖具備所需吉星，但排列順序不符，效力打折。":
           `你的命盤中缺少${x.missing.join("、")}，這股能量目前沒有緩衝。`}</p></div>`).join("")}
    ${mg.recommend.length?`
      <p class="q">可以補強的數字組合</p>
      <p>先天不足，可以用後天數字補。以下是適合你的組合：</p>
      ${mg.recommend.map(x=>`
        <p class="dim" style="margin-bottom:6px">補「${x.field}」（${x.reason}）：${x.info.short}</p>
        <div class="pairs">${x.sample.map(pp=>`<div class="pr good"><b>${pp}</b></div>`).join("")}</div>`).join("")}
`:""}`},

  // ═══ 5／8 缺數 ═══
  {t:"天 生 缺 乏 什 麼", h: nm.primary ? `
    <p>${nm.missingNote}</p>
    <div class="chips">${nm.missing.map(n=>
      `<div class="chip miss ${n===nm.primary.num?"key":""}">${n}</div>`).join("")}</div>
    <p class="q">其中最重要的是 ${nm.primary.num}</p>
    <p>在你的命盤裡，${nm.primary.num} 屬${nm.primary.el}——${nm.primary.reason}</p>
    <p class="dim">它牽動的，是你「${nm.primary.lack}」這個面向。</p>
    <p>${nm.primary.desc}</p>
    <p class="tip"><b>建議</b>${nm.primary.fill}</p>
    ${nm.missingDetail.filter(m=>m.num!==nm.primary.num).map(m=>`
      <p class="q">缺 ${m.num}：${m.lack}</p>
      <p>${m.desc}</p>
      <p class="tip"><b>建議</b>${m.fill}</p>`).join("")}`
  : `
    <p>${nm.missingNote}</p>
    <p class="dim">這樣的命盤並不常見。你的基礎相當完整，
       但也因為沒有明顯的缺口，較難自然形成極端的專長——
       完整報告中會說明，這樣的人該把力氣放在哪裡。</p>`},

  // ═══ 6／8 人際與事業 ═══ 契合的人 · 事業財運
  {t:"人 際 與 事 業", h:`
    <p class="q">事業夥伴</p>
    ${chips(mt.partner)}
    <p>${mt.partnerWhy}</p>
    <p class="q">戀人</p>
    ${chips(mt.lover)}
    <p>${mt.loverWhy}</p>
    <p class="q">需要留意</p>
    ${chips(mt.avoid,"bad")}
    <p class="dim">${mt.avoidWhy}</p>
    <p class="q">適合什麼工作</p>
    <p>${r.career.desc}</p>
    <p class="dim">適合領域：${r.career.fit.join("、")}</p>
    <p class="q">你的生財天賦</p>
    <p>${r.money.talent}</p>
    <p class="dim">${mg.counts && mg.counts["天醫"]
      ? `你的八星磁場中有 ${mg.counts["天醫"]} 組「天醫」——八星裡最直接與財富相關的磁場，與上面的結論互相印證。`
      : `要留意：你的磁場中沒有「天醫」這顆主財星，財富需要靠後天數字補強。`}</p>
    <p class="q">適不適合當老闆</p>
    <div class="stars">${"★".repeat(r.money.biz.star)}${"☆".repeat(5-r.money.biz.star)}</div>
    <p>${r.money.biz.verdict}——${r.money.biz.why}</p>`},

  // ═══ 7／8 流年與開運 ═══
  {t:`${c.baseYear} 流 年 與 開 運`, h:`
    <p class="q">流年數 ${c.numbers.personalYear}　·　${r.yearFortune.current.name}</p>
    <p>${r.yearFortune.current.desc}</p>
    <p class="dim">感情：${r.yearFortune.current.love}<br>
       工作：${r.yearFortune.current.work}</p>
    <p class="q">今年該如何度過</p>
    <p>${r.yearFortune.current.tip}</p>
    <p class="dim">你是${c.element}型的${r.summary.title}，今年走「${r.yearFortune.current.name}」。${
      r.yearFortune.current.theme==="開始"||r.yearFortune.current.theme==="成果與資源"
      ?"流年方向與你的本質同向，是順推的一年，該出手就出手。"
      :"流年節奏與你的本能不完全同向，順著流年走會比硬撐本性省力。"}</p>
    <p class="q">天生合適的顏色</p>
    ${chips(r.colors.list)}
    <p>${r.colors.why}</p>
    <p class="dim">有利方位：${r.colors.dir}　·　開運物：${r.colors.items.join("、")}<br>
       ${r.lucky.weakSupport}</p>
    <p class="q">日常提醒</p>
    <p>${r.lucky.action}</p>`},

  // ═══ 8／8 收尾：未解鎖為預告頁；已解鎖的收尾與工具已移入 unlockedPages
  ...(UNLOCKED ? unlockedPages(r,c,mg) : [{t:"你 只 看 到 了 一 半", h:`
    <p>剛才這 ${countFreePages()} 頁，已經把你的<b>人格與數字</b>說完了。</p>
    <p>但關於<b>感情、未來，以及你身邊那些數字</b>的部分，
       還沒有揭曉。</p>

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
        <div><b>我的一生命運走向</b><br>
        <i>九年一輪的節奏、你正走在哪一段、順與卡的年份</i></div></div>
      <div class="li"><span class="q2">？</span>
        <div><b>大運：0 到 120 歲的完整階段</b><br>
        <i>每九年一步，哪一步遇貴人、哪一步要防車關，逐段說明</i></div></div>
      <div class="li"><span class="q2">？</span>
        <div><b>數字檢測：你的號碼合不合</b><br>
        <i>電話、銀行帳號、車牌逐一檢查，並告訴你該補什麼</i></div></div>
      <div class="li"><span class="q2">？</span>
        <div><b>更深層的命盤解析</b><br>
        <i>${r.highlights.total} 項要點完整攤開，分 ${r.highlights.categories.length} 大類</i></div></div>
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


/* ══════════════════════════════════════════════════════════
   數字檢測工具
   排序依「可更換難度」由難到易再到難：
     身分證字號（終身不變，作為基準）
     電話、銀行帳號（最容易更換，優先建議調整）
     車牌、住址（可換但成本高）
   另可自訂最多 3 項（例如手鍊、門號副卡、保險箱密碼）。
   ══════════════════════════════════════════════════════════ */
const TOOL_ITEMS = [
  { id:"id",    label:"身分證字號", hint:"終身不變，作為你的後天基準", fixed:true },
  { id:"phone", label:"電話號碼",   hint:"最容易更換，建議優先調整" },
  { id:"bank",  label:"銀行帳號",   hint:"可申請新帳戶，更換成本低" },
  { id:"plate", label:"車牌號碼",   hint:"可申請換牌，成本中等" },
  { id:"addr",  label:"住址門牌",   hint:"不易更動，了解即可" },
];
const TOOL_CUSTOM_MAX = 3;

/* 綁定檢測頁的互動。頁面為動態產生，每次顯示都要重新綁定。 */
function bindTool(){
  const runBtn = document.getElementById("toolRun");
  if(!runBtn) return;                 // 免費版沒有這一頁

  // 新增自訂欄位
  const addBtn = document.getElementById("toolAdd");
  if(addBtn){
    addBtn.onclick = ()=>{
      const box = document.getElementById("toolCustom");
      const n = box.querySelectorAll(".trow").length;
      if(n >= TOOL_CUSTOM_MAX) return;
      const i = n;
      const div = document.createElement("div");
      div.className = "trow custom";
      div.innerHTML =
        `<input class="tname" id="cn${i}" placeholder="自訂項目（例：手鍊）" maxlength="10">` +
        `<input class="tnum" id="cv${i}" inputmode="numeric" placeholder="數字">`;
      box.appendChild(div);
      div.querySelector(".tname").focus();
      if(n + 1 >= TOOL_CUSTOM_MAX) addBtn.style.display = "none";
    };
  }
  runBtn.onclick = runTool;
}

/* 執行檢測：彙整所有欄位 → 逐項分析 → 底部總結 */
function runTool(){
  const out = document.getElementById("toolOut");
  if(!out) return;

  // 收集固定項目
  const entries = [];
  TOOL_ITEMS.forEach(it=>{
    const el = document.getElementById("t_"+it.id);
    const v = el ? String(el.value).replace(/[^0-9]/g,"") : "";
    if(v.length >= 2) entries.push({ label: it.label, digits: v, fixed: !!it.fixed });
  });
  // 收集自訂項目
  document.querySelectorAll("#toolCustom .trow").forEach((row,i)=>{
    const nameEl = row.querySelector(".tname"), numEl = row.querySelector(".tnum");
    const nm = nameEl ? nameEl.value.trim() : "";
    const v  = numEl ? String(numEl.value).replace(/[^0-9]/g,"") : "";
    if(v.length >= 2) entries.push({ label: nm || `自訂 ${i+1}`, digits: v, custom:true });
  });

  if(!entries.length){
    out.innerHTML = `<p class="dim" style="text-align:center;margin-top:18px">
      請至少填入一組數字（2 位以上）再開始測算。</p>`;
    return;
  }

  const kindCls = k => k==="吉" ? "good" : k==="凶" ? "bad" : "mid";

  // 逐項分析
  const results = entries.map(e=>{
    const a = analyzeNumber(e.digits, e.label);
    const m = matchScore(magnet, a);
    return { ...e, a, m };
  });

  // 全體統計：把所有後天數字合起來看整體補了什麼、還缺什麼
  const totalCounts = {};
  FIELDS.forEach(f => totalCounts[f] = 0);
  results.forEach(r => FIELDS.forEach(f => totalCounts[f] += r.a.counts[f]));
  const haveGood = GOOD_FIELDS.filter(f => totalCounts[f] > 0);
  const lackGood = GOOD_FIELDS.filter(f => totalCounts[f] === 0);
  // 本命未化解的凶星，是否已被後天數字補上
  const fixed = magRep.resolve.unresolved.filter(u =>
    u.missing.every(f => totalCounts[f] > 0));
  const stillBad = magRep.resolve.unresolved.filter(u =>
    !u.missing.every(f => totalCounts[f] > 0));

  const avg = Math.round(results.reduce((s,r)=>s+r.a.score,0)/results.length);
  const best = results.reduce((a,b)=> b.a.score > a.a.score ? b : a);
  const worst = results.reduce((a,b)=> b.a.score < a.a.score ? b : a);

  out.innerHTML = `
    <p class="q">逐項結果</p>
    ${results.map(r=>{
      const col = r.a.score>=75 ? "#8FC79A" : r.a.score>=55 ? "var(--kin)" : "#E58B7B";
      return `
      <div class="tres">
        <div class="tres-h">
          <b>${r.label}</b>
          <span style="color:${col}">${r.a.score}</span>
        </div>
        ${r.a.total ? `
          <div class="pairs">${r.a.pairs.map(p=>
            `<div class="pr ${kindCls(FIELD_INFO[p.field].kind)}"><b>${p.pair}</b><span>${p.field}</span></div>`).join("")}</div>
          <div class="ratio"><i class="g" style="width:${r.a.goodRatio}%"></i><i class="b" style="width:${100-r.a.goodRatio}%"></i></div>
          <p class="dim" style="margin:6px 0 0">
            吉星 ${r.a.goodRatio}%　·　與本命契合度 ${r.m.score}
            ${r.m.rescue.length?`　·　可化解你的${r.m.rescue.join("、")}`:""}
            ${r.m.complement.length?`　·　補上${r.m.complement.join("、")}`:""}
          </p>`
        : `<p class="dim" style="margin:0">這組數字幾乎都是 0 與 5，未形成明顯磁場，屬中性。</p>`}
      </div>`;
    }).join("")}

    <p class="q">整體統計</p>
    <div class="tsum">
      <div class="tsum-row"><span>平均分數</span><b>${avg}</b></div>
      <div class="tsum-row"><span>最相合</span><b>${best.label}（${best.a.score}）</b></div>
      <div class="tsum-row"><span>最需調整</span><b>${worst.label}（${worst.a.score}）</b></div>
    </div>

    <p class="q">你補到了什麼</p>
    ${haveGood.length ? `
      <div class="pairs">${haveGood.map(f=>
        `<div class="pr good"><b>${totalCounts[f]}</b><span>${f}</span></div>`).join("")}</div>
      <p class="dim">這些吉星已經出現在你的後天數字中。</p>` :
      `<p class="dim">目前的號碼中沒有吉星組合，補強空間很大。</p>`}

    ${lackGood.length ? `
      <p class="q">還缺什麼</p>
      <div class="pairs">${lackGood.map(f=>
        `<div class="pr mid"><b>—</b><span>${f}</span></div>`).join("")}</div>
      ${lackGood.map(f=>`
        <p class="tip"><b>補${f}</b>${FIELD_INFO[f].short}。
          可用的組合：${PAIR_MAP[f].slice(0,6).join("、")}</p>`).join("")}` : `
      <p class="q">還缺什麼</p>
      <p class="dim">四顆吉星你都有了，後天數字的配置相當完整。</p>`}

    <p class="q">本命凶星的化解狀況</p>
    ${!magRep.resolve.unresolved.length ? `
      <p class="dim">你的本命沒有未化解的凶星，後天數字只需維持現況即可。</p>` : `
      ${fixed.map(u=>`
        <div class="res ok"><div class="h">${u.field}　已被後天數字化解</div>
        <p>你的號碼中已具備${u.need.join("、")}，補上了本命缺少的部分。</p></div>`).join("")}
      ${stillBad.map(u=>`
        <div class="res no"><div class="h">${u.field}　仍未化解</div>
        <p>需要${u.missing.join("、")}才能化解。建議優先從<b>電話</b>或<b>銀行帳號</b>著手——
           這兩項最容易更換，效果也最直接。可用組合：${
             u.missing.map(f=>PAIR_MAP[f].slice(0,4).join("、")).join("；")}</p></div>`).join("")}`}

    <p class="q">給你的行動建議</p>
    <p>${
      worst.a.score < 55
        ? `你的「${worst.label}」分數偏低（${worst.a.score}）。${
            worst.fixed ? "這一項無法更動，建議用電話或銀行帳號來平衡。"
                        : "這一項是可以更換的，優先處理它效益最大。"}`
        : avg >= 75
          ? "你目前的後天數字整體相當不錯，不需要大動作調整，維持即可。"
          : "你的後天數字沒有明顯問題，但仍有優化空間。換號碼時挑上面列出的組合即可。"
    }</p>
    <p class="dim">提醒：數字是輔助，不是保證。真正改變結果的是你的選擇與行動，
       這些組合只是讓路走起來順一些。</p>`;

  setTimeout(()=>out.scrollIntoView({behavior:"smooth",block:"start"}), 80);
}

/* ── 翻頁 ── */
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
  // 頁面為動態產生，每次顯示都要重新綁定
  const ts=document.getElementById("toSales"), rs=document.getElementById("restart");
  if(ts) ts.onclick=()=>go("sales");
  if(rs) rs.onclick=restart;
}

document.getElementById("prev").onclick=()=>showPage(pageIdx-1,true);
document.getElementById("next").onclick=()=>showPage(pageIdx+1);

/* 左右滑動翻頁 */
(function(){
  const leaf=document.querySelector(".leaf");
  let x0=null,y0=null;
  // 在輸入框或按鈕上滑動時不翻頁，避免與操作衝突
  const noSwipe = t => t && t.closest && (t.closest("input,button") !== null);
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
    : mg.dominant ? `你的主導磁場是「${mg.dominant.field}」` : "你的命盤還藏著關鍵訊息";
  document.getElementById("sales").innerHTML=`
    <div class="salesbox">
      <div class="lbl">完 整 命 盤 報 告</div>
      <h2>生命靈數 ${c.numbers.life}　${r.summary.title}</h2>

      <p class="pitch">你的人格與數字，剛才已經完整看過了。<br>
        ${teaser}——<br>
        而<b>感情、命運與更深的解析</b>，才正要開始。</p>

      <div class="sellrow"><span>◆</span><div>
        <b>你會遇到什麼樣的人</b>桃花元素、對象的樣貌、以及最容易遇見的場合</div></div>
      <div class="sellrow"><span>◆</span><div>
        <b>如何一眼認出爛桃花</b>${r.avoidBadPeach.signs.length} 項具體警訊，
        避開你命中最容易踏進的感情陷阱</div></div>
      <div class="sellrow"><span>◆</span><div>
        <b>未來五年，哪一年會翻身</b>逐年吉凶、該衝該守，以及逢凶化吉的方向</div></div>
      <div class="sellrow highlight"><span>★</span><div>
        <b>我的一生命運走向</b>九年一輪的循環節奏、你正走在哪一段、
        哪幾年順哪幾年卡——不只看今年，看的是一整條路</div></div>
      <div class="sellrow highlight"><span>★</span><div>
        <b>大運：0 到 120 歲</b>每九年一步共 14 步，
        哪一步遇貴人、哪一步該防車關、哪一步適合成家立業——一生的地圖</div></div>
      <div class="sellrow"><span>◆</span><div>
        <b>數字檢測工具</b>電話、銀行帳號、車牌、住址逐一檢查，
        還能自訂項目，算完直接告訴你該補哪些數字</div></div>
      <div class="sellrow"><span>◆</span><div>
        <b>更深層命盤解析</b>${r.highlights.total} 項要點完整攤開，
        分 ${r.highlights.categories.length} 大類</div></div>

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
  cancelAutoSubmit();
  document.getElementById("bd").value="";
  document.getElementById("err").textContent="";
  chart=null; report=null; magnet=null; magRep=null;
  go("intro");
}

/* ── 啟動 ── */
layout(); setHots(); go("intro");
