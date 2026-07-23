/**
 * ============================================
 *  SVG 圖表元件（可直接複用）
 *  四種必備圖表 + 捲動觸發動畫
 *  ⚠️ 全部動態繪製，不可改為靜態圖片
 * ============================================
 */

/* ---------- 1. 雷達圖（核心維度分布，建議 5 軸）---------- */
function radarChart(dataPct, keys, colors) {
  const cx = 140, cy = 140, R = 95;
  const n = keys.length;
  const max = Math.max(...keys.map(k => dataPct[k]), 30);
  const angle = i => (-90 + i * (360 / n)) * Math.PI / 180;

  const pts = keys.map((k, i) => {
    const a = angle(i), r = (dataPct[k] / max) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });

  let grid = "";
  [0.25, 0.5, 0.75, 1].forEach(f => {
    const g = keys.map((_, i) => {
      const a = angle(i);
      return `${cx + R * f * Math.cos(a)},${cy + R * f * Math.sin(a)}`;
    }).join(" ");
    grid += `<polygon points="${g}" fill="none" stroke="#E6DCC8" stroke-width="1"/>`;
  });

  let axes = "", labels = "";
  keys.forEach((k, i) => {
    const a = angle(i);
    axes += `<line x1="${cx}" y1="${cy}" x2="${cx + R * Math.cos(a)}" y2="${cy + R * Math.sin(a)}" stroke="#E6DCC8"/>`;
    const lx = cx + (R + 16) * Math.cos(a), ly = cy + (R + 16) * Math.sin(a);
    labels += `<text x="${lx}" y="${ly + 4}" text-anchor="middle" font-size="13" fill="${colors[k]}">${k}</text>`;
  });

  const poly = pts.map(p => p.join(",")).join(" ");
  return `<svg viewBox="0 0 280 280" width="280" height="280">
    ${grid}${axes}
    <polygon class="anim-radar" points="${poly}" fill="rgba(95,164,106,.35)" stroke="#5FA46A" stroke-width="2"
      style="transform-box:fill-box;transform-origin:center;transform:scale(0);opacity:0;
             transition:transform 1s cubic-bezier(.22,1,.36,1),opacity .6s"/>
    ${labels}
  </svg>`;
}

/* ---------- 2. 長條圖（次級維度佔比）---------- */
function barChart(dataPct, keys, color = "#9A4436") {
  const W = 520, H = 200, pad = 30, bw = W / keys.length;
  const max = Math.max(...keys.map(k => dataPct[k]), 10);
  let bars = "", labels = "";

  keys.forEach((k, i) => {
    const h = (dataPct[k] / max) * (H - pad - 30);
    const x = i * bw + bw * 0.2, y = H - pad - h, w = bw * 0.6;
    bars += `<rect class="anim-bar" x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" rx="2"
      style="transform-box:fill-box;transform-origin:bottom;transform:scaleY(0);
             transition:transform .9s cubic-bezier(.22,1,.36,1);transition-delay:${i * 0.05}s"/>`;
    bars += `<text class="anim-fade" x="${x + w / 2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="${color}"
      style="opacity:0;transition:opacity .5s;transition-delay:${0.4 + i * 0.05}s">${dataPct[k]}%</text>`;
    labels += `<text x="${x + w / 2}" y="${H - pad + 14}" text-anchor="middle" font-size="10" fill="#7A6E5E">${k}</text>`;
  });

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="200" preserveAspectRatio="xMidYMid meet">
    <line x1="${pad}" y1="${H - pad}" x2="${W}" y2="${H - pad}" stroke="#E6DCC8"/>
    ${bars}${labels}
  </svg>`;
}

/* ---------- 3. 折線圖（時間軸趨勢）---------- */
function lineChart(timeline, color = "#C7614A") {
  const W = 520, H = 180, pad = 36;
  const scores = timeline.map(t => t.score);
  const min = Math.min(...scores) - 10, max = Math.max(...scores) + 10;
  const n = timeline.length;

  const pts = timeline.map((t, i) => {
    const x = pad + (W - pad * 2) * (i / (n - 1));
    const y = pad + (H - pad * 2) * (1 - (t.score - min) / (max - min));
    return [x, y, t];
  });

  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`).join(" ");
  let dots = "", labels = "";
  pts.forEach((p, i) => {
    dots += `<circle class="anim-fade" cx="${p[0]}" cy="${p[1]}" r="4" fill="${color}"
      style="opacity:0;transition:opacity .4s;transition-delay:${0.8 + i * 0.15}s"/>`;
    dots += `<text class="anim-fade" x="${p[0]}" y="${p[1] - 10}" text-anchor="middle" font-size="11" fill="${color}"
      style="opacity:0;transition:opacity .4s;transition-delay:${0.9 + i * 0.15}s">${p[2].score}</text>`;
    labels += `<text x="${p[0]}" y="${H - 10}" text-anchor="middle" font-size="11" fill="#7A6E5E">${p[2].year}</text>`;
  });

  return `<svg viewBox="0 0 ${W} 200" width="100%" height="200" preserveAspectRatio="xMidYMid meet">
    <path class="anim-line" d="${path}" fill="none" stroke="${color}" stroke-width="2.5"/>
    ${dots}${labels}
  </svg>`;
}

/* ---------- 4. 分數圓環（總評，含 count-up）---------- */
function scoreRing(score, color = "#C9A55C", textColor = "#9A4436") {
  const r = 52, c = 2 * Math.PI * r, off = c * (1 - score / 100);
  return `<svg viewBox="0 0 120 120" width="120" height="120">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="#E6DCC8" stroke-width="8"/>
    <circle class="anim-ring" cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="8"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-off="${off}"
      transform="rotate(-90 60 60)" style="transition:stroke-dashoffset 1.4s cubic-bezier(.22,1,.36,1)"/>
    <text class="countup" data-target="${score}" x="60" y="66" text-anchor="middle"
      font-size="30" font-weight="900" fill="${textColor}">0</text>
    <text x="60" y="84" text-anchor="middle" font-size="11" fill="#7A6E5E">分</text>
  </svg>`;
}

/* ============================================
 *  動畫觸發器（捲到才動，不要一次全跑完）
 * ============================================ */
function initChartAnimations() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add("on");

      el.querySelectorAll(".anim-radar").forEach(x => {
        x.style.transform = "scale(1)"; x.style.opacity = "1";
      });
      el.querySelectorAll(".anim-bar").forEach(x => {
        x.style.transform = "scaleY(1)";
      });
      el.querySelectorAll(".anim-fade").forEach(x => {
        x.style.opacity = "1";
      });
      el.querySelectorAll(".anim-ring").forEach(x => {
        x.style.strokeDashoffset = x.getAttribute("data-off");
      });
      el.querySelectorAll(".anim-line").forEach(x => {
        try {
          const L = x.getTotalLength();
          x.style.strokeDasharray = L;
          x.style.strokeDashoffset = L;
          x.getBoundingClientRect(); // force reflow
          x.style.transition = "stroke-dashoffset 1.5s ease";
          x.style.strokeDashoffset = "0";
        } catch (err) {}
      });
      el.querySelectorAll(".countup").forEach(countUp);

      io.unobserve(el);
    });
  }, { threshold: 0.15 });

  document.querySelectorAll(".reveal").forEach(el => io.observe(el));
}

function countUp(el) {
  const target = +el.getAttribute("data-target");
  let t0 = null;
  const dur = 1200;
  function step(ts) {
    if (!t0) t0 = ts;
    const p = Math.min((ts - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * ease);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ---------- 搭配的 CSS ---------- */
const CHART_CSS = `
.reveal { opacity:0; transform:translateY(24px);
  transition:opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1); }
.reveal.on { opacity:1; transform:none; }
@media (prefers-reduced-motion: reduce) {
  .reveal, .anim-radar, .anim-bar, .anim-line, .anim-ring { transition:none !important; }
  .reveal { opacity:1; transform:none; }
}
`;

if (typeof module !== "undefined") {
  module.exports = { radarChart, barChart, lineChart, scoreRing, initChartAnimations, CHART_CSS };
}
