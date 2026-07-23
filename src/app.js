
/* ══════════════════════════════════════════════════════════
   解鎖狀態
   免費與付費不再是兩個檔案，而是同一份程式的兩種執行狀態。
   使用者按下解鎖後，unlocked 由 false 轉為 true，
   報告會就地重建並從第一頁重新展開，各章節先前隱藏的段落隨之顯現。

   ⚠️ DEV_UNLOCK_OPEN 為開發／自審模式：
      設為 true 時，按下解鎖會照常顯示付費提示，
      但確認後直接解鎖，方便反覆檢視付費版內容。
      正式上線前必須改為 false，並接上平台的內購驗證。
   ══════════════════════════════════════════════════════════ */
let unlocked = false;
const DEV_UNLOCK_OPEN = true;

/**
 * 章節內的隱藏段落。
 * 未解鎖時顯示標題與一句勾引文字，解鎖後顯示真正的內容。
 * 解鎖後首次呈現會帶上 fresh 標記，用於高亮動畫。
 */
function lockedSlot(title, tease, content){
  if(unlocked){
    return `<div class="slot open${justUnlocked ? " fresh" : ""}">
      <div class="slot-h"><span class="slot-k">已解鎖</span>${title}</div>
      ${content}
    </div>`;
  }
  return `<div class="slot lock">
    <div class="slot-h"><span class="slot-k lockk">未解鎖</span>${title}</div>
    <p class="slot-t">${tease}</p>
    <div class="slot-blur">
      <span></span><span></span><span></span>
    </div>
  </div>`;
}

/* 缺數章節的隱藏段落。抽成函式是因為該章有「有缺數／無缺數」兩個分支，
   直接寫在三元運算式裡容易破壞結構（曾因此造成語法錯誤）。 */
function missGapSlot(r){
  return lockedSlot(
    "缺這個數字，會在哪裡跌倒",
    "知道缺什麼只是第一步。真正該問的是：這個缺口會在人生的哪個階段、以什麼形式出現？多數人都是踩過同一個坑好幾次，才發現原來早就寫在命盤裡。",
    `<p>缺數的影響不會平均分布在一生中，而是集中在特定的大運階段爆發。
       你未來的大運裡，有幾步會特別放大這個缺口——</p>
     ${r.dayun.steps.filter(x=>!x.past).slice(0,3).map(x=>
       `<p class="tip"><b>${x.from}–${x.to} 歲</b>${x.name}：${x.watch}</p>`).join("")}
     <p class="dim">完整的 ${r.dayun.steps.length} 步大運與各階段提醒，在「大運．一生的階段」那一章。</p>`
  );
}

/* 解鎖後的高亮。
   ⚠️ 不用計時器控制——使用者翻閱速度差異很大，
      固定秒數要嘛太短（還沒翻到就熄了）、要嘛太長（一直閃）。
      改以「翻頁次數」為準：解鎖後翻過整本一輪就自然收起。 */
let justUnlocked = false;
let unlockedTurns = 0;

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

/* 揭曉時間點。

   數字必須騎著爆光那一刻出現，太早會在水晶球尚未發光時就跳出來。
   但爆光的秒數取決於 v3 的剪法，換一支影片就得跟著改——
   因此改為依影片實際長度自動選定，換檔案不必動程式。

   assets/video/ 內備有三種長度，改名為 v3-reveal.mp4 即可切換：
     v3-reveal-original.mp4  10.0 秒（原始完整版，爆光 5.0 秒）
     v3-reveal-5s.mp4         5.2 秒（剪去前段鋪陳，爆光 3.0 秒）
     v3-reveal-2s.mp4         2.2 秒（只保留爆光前後，節奏最快）

   若換上其他影片，在下表補一列即可；
   找不到對應長度時，會以「片長的 50%」估算爆光位置。 */
const REVEAL_BURST = [
  { dur: 10.0, num: 4850 },
  { dur:  5.2, num: 2850 },
  { dur:  2.2, num: 1350 },
];
let REVEAL_NUM_MS = 4850;      // 由 v3 的 loadedmetadata 事件覆寫
let REVEAL_END_MS = 10500;     // 保險用；正常情況由下列兩個條件先觸發

/* 數字浮現後停留多久才切到結果頁。
   v3 後段是爆光之後的餘韻，不需要播完——
   數字看清楚了就讓 v4 接手，動畫節奏與操作感才一致。
   影片較短時 ended 事件會更早觸發，兩者取先到者。 */
const REVEAL_HOLD_MS = 1800;

document.getElementById("v3").addEventListener("loadedmetadata", ()=>{
  const d = document.getElementById("v3").duration;
  if(!d || !isFinite(d)) return;
  // 取最接近的已知長度；差距超過 0.4 秒視為未知影片，改用比例估算
  const hit = REVEAL_BURST.reduce((a,b)=>
    Math.abs(b.dur-d) < Math.abs(a.dur-d) ? b : a);
  REVEAL_NUM_MS = Math.abs(hit.dur-d) <= 0.4 ? hit.num : Math.round(d*1000*0.5);
  REVEAL_END_MS = Math.round(d*1000) + 500;
});

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
  // 數字停留足夠時間後即切換，不等 v3 播完；
  // 若影片較短先播完，ended 事件會提前觸發，兩者取先到者。
  clearTimeout(revealTimer);
  const cut = Math.min(REVEAL_NUM_MS + REVEAL_HOLD_MS, REVEAL_END_MS);
  revealTimer = setTimeout(()=>{ if(stage==="reveal") go("result"); }, cut);
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

    <p class="q">可以填什麼</p>
    <p>任何你日常在使用的號碼都可以：<b>手機號碼、身分證字號、銀行帳號、
       車牌、住址門牌、信用卡末四碼、門鎖密碼、常戴飾品上的編號</b>——
       只要是會反覆出現在你生活中的數字，都帶著它自己的磁場。</p>
    <p class="dim">英文字母會自動略過，只取其中的數字。
       例如身分證 <b>M121864569</b>，系統會取 <b>121864569</b> 來拆解。</p>

    <p class="q">系統會算出什麼</p>
    <div class="tguide">
      <div class="tg"><span>1</span><p>把每組號碼拆成相鄰兩位數，對照出各自帶了哪些磁場</p></div>
      <div class="tg"><span>2</span><p>比對這些磁場與你本命的關係——是補足、是重疊，還是相沖</p></div>
      <div class="tg"><span>3</span><p>統計所有號碼合起來，你補到了什麼、還缺什麼</p></div>
      <div class="tg"><span>4</span><p>若某組號碼反而帶進凶星，會直接指出並建議更換</p></div>
    </div>

    <p class="q">填入你的號碼</p>
    <p class="dim">左邊自己命名，右邊填數字。不需要全部填滿，
       填幾項就算幾項。</p>
    <div class="tform">
      <div id="toolRows">
        ${Array.from({length: TOOL_ROWS_INIT}, (_,i)=>toolRowHTML(i)).join("")}
      </div>
      <button class="taddbtn" id="toolAdd">＋ 新增一列（最多 ${TOOL_ROWS_MAX} 列）</button>
    </div>

    <button class="cta" id="toolRun">開 始 測 算</button>

    <div class="tsafe">
      <div class="tsafe-i">＊</div>
      <p><b>僅供測算</b><br>
      本程式不會留下任何記錄，你輸入的數字只在這個頁面上運算，
      關閉或重新整理後即消失，不會上傳、不會儲存，
      因此沒有個資外洩的問題。請安心填寫。</p>
    </div>

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
       前者由態度數 ${c.numbers.attitude} 與感情線推導，後者即主命數 ${c.numbers.life}。</p>
    ${lockedSlot(
      "你現在走到人生的哪一步",
      `命盤有主軸，人生有階段。你今年 ${r.dayun.currentAge} 歲，正走在一段有明確主題的九年裡——這一步該衝、該守，還是該等，方向完全不同。`,
      r.dayun.current ? `<p>你正走在第 ${r.dayun.current.index+1} 步大運
        <b>「${r.dayun.current.name}」</b>（${r.dayun.current.from}–${r.dayun.current.to} 歲）。</p>
        <p>${r.dayun.current.desc}</p>
        <p class="tip"><b>要注意</b>${r.dayun.current.watch}</p>
        <p class="dim">完整的 ${r.dayun.steps.length} 步大運，在「大運．一生的階段」那一章。</p>`
        : `<p>你的年齡尚未進入大運推算範圍。</p>`
    )}`},

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
       內在數 ${io.inner} 才是你實際的決策方式——這正是你最容易被放錯位置的原因。</p>
    ${lockedSlot(
      "同樣這個性格，在感情裡是什麼樣子",
      "職場上的你和關係裡的你，往往不是同一個人。內外落差越大，親密關係中的誤會就越深——對方以為的你，和真正的你，差在哪裡？",
      `<p>你的桃花元素是<b>${r.peachBlossom.name}</b>，桃花指數 ${r.peachBlossom.score}。</p>
       <p>${r.peachBlossom.desc}</p>
       <p class="tip"><b>你會遇到</b>${r.peachBlossom.meetType}</p>
       <p class="dim">完整的桃花分析與爛桃花警訊，在「桃花與正緣」那一章。</p>`
    )}`},

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
         這類天天使用的數字，對你的影響會比一般人更明顯。</p>`}
    ${lockedSlot(
      "這些磁場，正在怎麼影響你的錢",
      "八星裡有一顆專管財富的星。它在不在你的命盤裡，決定了你賺錢是順水推舟還是逆流而上。",
      `<p>${mg.counts && mg.counts["天醫"]
        ? `你有 <b>${mg.counts["天醫"]} 組天醫</b>——八星裡最直接與財富相關的磁場，讓你「靠專業累積財富」的路徑比一般人順暢。`
        : `你的命盤中<b>沒有天醫</b>。這不代表賺不到錢，而是財富需要透過後天數字補強，否則容易出現「能力配得上更好的收入，但就是卡著」的狀況。`}</p>
       <p>${r.money.talent}</p>
       <p class="tip"><b>創業適性</b>${"★".repeat(r.money.biz.star)}${"☆".repeat(5-r.money.biz.star)}　${r.money.biz.verdict}</p>`
    )}`},

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
`:""}
    ${lockedSlot(
      "知道要補，那該補在哪裡",
      "上面列出了該補的組合，但放進哪一組號碼才有效？手機、帳號、車牌各有不同的引動強度——放錯地方，補了也是白補。",
      `<p>後天數字的引動強度取決於你使用它的頻率。手機號碼是你每天被呼叫的入口，
         強度最高；車牌牽動移動時的能量；住址影響休息與家運。</p>
       <p class="tip"><b>優先順序</b>先從最容易更換的號碼下手（多半是手機或銀行帳號），
         效果最直接、成本也最低。</p>
       <p class="dim">報告最後附有數字檢測工具，可直接輸入你正在使用的號碼逐一檢查。</p>`
    )}`},

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
      <p class="tip"><b>建議</b>${m.fill}</p>`).join("")}
    ${missGapSlot(r)}`
  : `
    <p>${nm.missingNote}</p>
    <p class="dim">這樣的命盤並不常見。你的基礎相當完整，
       但也因為沒有明顯的缺口，較難自然形成極端的專長。</p>
    ${missGapSlot(r)}`},

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
    <p>${r.money.biz.verdict}——${r.money.biz.why}</p>
    ${lockedSlot(
      "什麼時候會遇到那個人",
      "上面說了你適合什麼樣的人。但更多人想知道的是——什麼時候？命盤中確實有幾個階段，是感情特別容易定下來的時機。",
      `<p>依大運推算，你的感情關鍵期落在這幾段——</p>
       ${(()=>{const m=r.dayun.steps.filter(x=>x.events.some(e=>e.kind==="感情"));
         return m.length ? m.map(x=>
           `<p class="tip"><b>${x.from}–${x.to} 歲</b>${x.events.find(e=>e.kind==="感情").text}</p>`).join("")
         : `<p class="dim">你的大運中沒有特別突出的感情關鍵期，代表感情走勢平穩，不易大起大落。</p>`;})()}
       <p class="dim">另有理想型、爛桃花警訊與正緣場域的完整分析，在「桃花與正緣」那一章。</p>`
    )}`},

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
    <p>${r.lucky.action}</p>
    ${lockedSlot(
      "未來五年，哪一年會翻身",
      "今年只是九年裡的一格。真正決定你這幾年過得順不順的，是接下來哪一年能量最強、哪一年該按兵不動——這是規劃的依據，不是安慰。",
      `<p>你未來五年的流年走勢——</p>
       ${r.yearFortune.timeline.map(t=>
         `<p class="tip"><b>${t.year}</b>流年 ${t.number}「${t.name}」　指數 ${t.score}　·　${t.theme}</p>`).join("")}
       <p>能量最強的是 <b>${[...r.yearFortune.timeline].sort((a,b)=>b.score-a.score)[0].year} 年</b>，
          最需保守的是 <b>${[...r.yearFortune.timeline].sort((a,b)=>a.score-b.score)[0].year} 年</b>。</p>
       <p class="dim">逐年詳解與逢凶化吉的方向，在「未來五年流年」那一章。</p>`
    )}`},

  // ═══ 8／8 收尾：未解鎖為預告頁；已解鎖的收尾與工具已移入 unlockedPages
  ...(unlocked ? unlockedPages(r,c,mg) : [{t:"你 只 看 到 了 一 半", h:`
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
   全部欄位皆為自由填寫：左欄自行輸入名稱、右欄輸入數字。
   預設給 5 列，不足時可自行新增至上限。
   ⚠️ 不預設項目名稱，是因為每個人手上的數字組合差異很大
      （有人有三支門號、有人有多個帳戶），固定選項反而綁手綁腳。
   ══════════════════════════════════════════════════════════ */
const TOOL_ROWS_INIT = 5;    // 初始空白列數
const TOOL_ROWS_MAX  = 10;   // 上限，避免一次算太多導致頁面過長

/** 產生一列輸入欄（name 與 number） */
function toolRowHTML(i){
  return `<div class="trow" data-i="${i}">
      <input class="tname" placeholder="項目名稱（例：手機、手鍊）" maxlength="12">
      <input class="tnum" inputmode="numeric" placeholder="數字">
      <button class="tdel" title="刪除這一列">×</button>
    </div>`;
}

/* 綁定檢測頁的互動。頁面為動態產生，每次顯示都要重新綁定。 */
function bindTool(){
  const runBtn = document.getElementById("toolRun");
  if(!runBtn) return;                 // 免費版沒有這一頁
  const box = document.getElementById("toolRows");
  const addBtn = document.getElementById("toolAdd");

  const refresh = ()=>{
    const n = box.querySelectorAll(".trow").length;
    if(addBtn) addBtn.style.display = n >= TOOL_ROWS_MAX ? "none" : "block";
    // 至少保留一列，避免全部刪光後無從輸入
    box.querySelectorAll(".tdel").forEach(b=>{
      b.style.visibility = n <= 1 ? "hidden" : "visible";
    });
  };

  const bindRow = (row)=>{
    const del = row.querySelector(".tdel");
    if(del) del.onclick = ()=>{
      if(box.querySelectorAll(".trow").length <= 1) return;
      row.remove(); refresh();
    };
  };

  box.querySelectorAll(".trow").forEach(bindRow);
  refresh();

  if(addBtn){
    addBtn.onclick = ()=>{
      const n = box.querySelectorAll(".trow").length;
      if(n >= TOOL_ROWS_MAX) return;
      const tmp = document.createElement("div");
      tmp.innerHTML = toolRowHTML(n);
      const row = tmp.firstElementChild;
      box.appendChild(row);
      bindRow(row);
      refresh();
      const nameEl = row.querySelector(".tname");
      if(nameEl) nameEl.focus();
    };
  }
  runBtn.onclick = runTool;
}

/* 執行檢測：彙整所有欄位 → 逐項分析 → 底部總結 */
function runTool(){
  const out = document.getElementById("toolOut");
  if(!out) return;

  // 收集所有自由填寫的欄位。
  // 只取數字，英文字母（如身分證開頭的 M）會被忽略——
  // 數字易經只看 1–9，字母不入卦。
  const entries = [];
  document.querySelectorAll("#toolRows .trow").forEach((row,i)=>{
    const nameEl = row.querySelector(".tname"), numEl = row.querySelector(".tnum");
    const nm = nameEl ? nameEl.value.trim() : "";
    const v  = numEl ? String(numEl.value).replace(/[^0-9]/g,"") : "";
    if(v.length >= 2) entries.push({ label: nm || `項目 ${i+1}`, digits: v });
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
        <p>需要${u.missing.join("、")}才能化解。建議優先從<b>最容易更換的號碼</b>著手（多半是電話或銀行帳號），
           效果最直接。可用組合：${
             u.missing.map(f=>PAIR_MAP[f].slice(0,4).join("、")).join("；")}</p></div>`).join("")}`}

    <p class="q">給你的行動建議</p>
    <p>${
      worst.a.score < 55
        ? `你的「${worst.label}」分數偏低（${worst.a.score}）。${
            "若這一項可以更換，優先處理它效益最大；若不易更動（例如身分證），" +
            "就用其他容易更換的號碼來平衡。"}`
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
  // 解鎖後翻過一輪，高亮自然收起
  if(justUnlocked && i !== pageIdx){
    unlockedTurns++;
    if(unlockedTurns >= pages.length){ justUnlocked = false; }
  }
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
/* ══════════════════════════════════════════════════════════
   解鎖
   完成付款後：切換狀態 → 就地重建報告 → 回到第一頁 →
   頂端出現解鎖橫幅，各章節先前隱藏的段落隨之顯現並亮起。
   ══════════════════════════════════════════════════════════ */
function doUnlock(){
  if(unlocked) return;
  unlocked = true;
  justUnlocked = true;
  unlockedTurns = 0;
  document.getElementById("book").classList.add("unlocked");
  go("result");                       // 重建並回到第一頁
  showBanner();
}

function showBanner(){
  const b = document.getElementById("unlockBar");
  if(!b) return;
  b.textContent = "完 整 報 告 已 解 鎖";
  b.classList.add("on");
}

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
    /* 正式上線時改為呼叫平台內購（StoreKit / Play Billing），
       驗證成功後才呼叫 doUnlock()。
       DEV_UNLOCK_OPEN 為 true 時直接解鎖，方便自我審核付費內容。 */
    const ok = confirm(
      "解鎖完整報告\n\n" +
      "包含桃花與正緣、未來五年流年、一生命運走向、\n" +
      "大運 0–120 歲、數字檢測工具與完整分析總表。\n\n" +
      "確認要解鎖嗎？"
    );
    if(!ok) return;
    if(DEV_UNLOCK_OPEN){ doUnlock(); }
    else { alert("此處接平台內購。上線前請串接 StoreKit / Play Billing。"); }
  };
  document.getElementById("backFree").onclick = ()=>go("result", true);
}

function restart(){
  cancelAutoSubmit();
  // 重新測算視為新的一次占卜，解鎖狀態一併重置
  unlocked = false; justUnlocked = false; unlockedTurns = 0;
  document.getElementById("book").classList.remove("unlocked");
  const bar = document.getElementById("unlockBar");
  if(bar) bar.classList.remove("on");
  document.getElementById("bd").value="";
  document.getElementById("err").textContent="";
  chart=null; report=null; magnet=null; magRep=null;
  go("intro");
}


/* ══════════════════════════════════════════════════════════
   關於／設定面板
   上架 App Store 與 Google Play 的必備項目：
     · 隱私權政策（兩平台皆強制）
     · 服務條款
     · 免責聲明（占卜類 App 必須聲明僅供娛樂參考）
     · 客服聯繫方式（Apple 要求提供 Support URL）
     · 恢復購買（Apple 強制要求，否則審核不過）
     · 版本資訊
   ⚠️ 下方的 APP_INFO 內容須在上架前填入真實資料。
   ══════════════════════════════════════════════════════════ */
const APP_INFO = {
  name: "生命靈數占卜",
  version: "1.0.0",
  company: "（請填入公司或個人名稱）",
  email: "（請填入客服信箱）",
  privacyUrl: "（請填入隱私權政策網址）",
  termsUrl: "（請填入服務條款網址）",
};

function renderAbout(){
  const el = document.getElementById("about");
  el.innerHTML = `
    <div class="abox">
      <button class="aclose" id="aboutClose" aria-label="關閉">×</button>
      <div class="alogo">${APP_INFO.name}</div>
      <div class="aver">版本 ${APP_INFO.version}</div>

      <div class="asec">
        <h4>免責聲明</h4>
        <p>本程式所提供的內容，係依生命靈數與數字易經的推算規則產生，
           僅供自我探索與娛樂參考，<b>不構成醫療、法律、財務或投資上的建議</b>。
           任何重大決定請諮詢相關領域的專業人士。</p>
        <p>命理推算無法預測未來，也不保證任何結果。
           報告中提到的傾向與提醒，是統計性的參考，而非個人化的預言。</p>
      </div>

      <div class="asec">
        <h4>隱私與資料</h4>
        <p>本程式<b>不會儲存或上傳</b>你輸入的任何資料。
           出生日期與號碼僅在你的裝置上運算，
           關閉程式後即消失，我們的伺服器不會留下任何記錄。</p>
        <p>本程式不收集個人識別資訊、不使用追蹤器、不投放廣告。</p>
      </div>

      <div class="asec">
        <h4>購買與退款</h4>
        <p>完整報告為一次性解鎖，透過平台官方的應用程式內購買機制進行。
           如需恢復先前的購買，請點擊下方按鈕。</p>
        <button class="abtn" id="restorePurchase">恢 復 購 買</button>
        <p class="adim">退款請依 App Store 或 Google Play 的退款流程辦理。</p>
      </div>

      <div class="asec">
        <h4>聯繫客服</h4>
        <p>使用上有任何問題、發現錯誤，或對報告內容有疑問，
           歡迎來信，我們會在三個工作天內回覆。</p>
        <button class="abtn" id="contactSupport">寄 信 給 客 服</button>
        <p class="adim">${APP_INFO.email}</p>
      </div>

      <div class="asec alinks">
        <button class="alink" id="linkPrivacy">隱私權政策</button>
        <button class="alink" id="linkTerms">服務條款</button>
      </div>

      <p class="acopy">© ${new Date().getFullYear()} ${APP_INFO.company}</p>
    </div>`;

  document.getElementById("aboutClose").onclick = closeAbout;
  document.getElementById("restorePurchase").onclick = ()=>{
    // 上架時改為呼叫平台的恢復購買 API（StoreKit / Play Billing）
    alert("恢復購買\n\n上架後此處會連線至平台帳號，\n自動恢復你先前的購買記錄。");
  };
  document.getElementById("contactSupport").onclick = ()=>{
    const subject = encodeURIComponent(`${APP_INFO.name} 意見回饋（v${APP_INFO.version}）`);
    location.href = `mailto:${APP_INFO.email}?subject=${subject}`;
  };
  document.getElementById("linkPrivacy").onclick = ()=>{ window.open(APP_INFO.privacyUrl, "_blank"); };
  document.getElementById("linkTerms").onclick   = ()=>{ window.open(APP_INFO.termsUrl, "_blank"); };
}

function openAbout(){
  renderAbout();
  document.getElementById("about").classList.add("on");
}
function closeAbout(){
  document.getElementById("about").classList.remove("on");
}
document.getElementById("aboutBtn").addEventListener("click", openAbout);

/* ── 啟動 ── */
layout(); setHots(); go("intro");
