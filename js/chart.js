import { GBP, GBP0, fmtDate, fmtDateFull, niceMax } from './format.js';

export function cutoffDate(range) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === '1W') d.setDate(d.getDate() - 7);
  else if (range === '1M') d.setDate(d.getDate() - 30);
  else if (range === '1Y') d.setDate(d.getDate() - 365);
  else return null;
  return d;
}

export function bucketForRange(dailyPoints, range) {
  const cutoff = cutoffDate(range);
  let filtered = cutoff ? dailyPoints.filter(p => new Date(p.date + 'T00:00:00') >= cutoff) : dailyPoints;
  if (filtered.length === 0) filtered = dailyPoints.slice(-1);
  return filtered.map(p => ({ label: fmtDate(p.date), date: p.date, invested: p.invested, value: p.value }));
}

// Auto-fit the y-axis to the visible data rather than starting at £0, so the
// gap between invested and total stays readable once the totals get large.
function yDomain(buckets) {
  const all = buckets.flatMap(b => [b.invested, b.value]);
  const lo = Math.min(...all), hi = Math.max(...all);
  const span = hi - lo || hi * 0.1 || 10;
  const step = niceMax(span / 4);
  const min = Math.max(0, Math.floor((lo - span * 0.05) / step) * step);
  const max = Math.ceil((hi + span * 0.12) / step) * step;
  return { min, max, step };
}

let lastBuckets = null;
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (lastBuckets) renderChart(lastBuckets); }, 100);
});

const pts = arr => arr.map(([x, y]) => `${x},${y}`).join(' ');

export function renderChart(buckets) {
  const svg = document.getElementById('chart');
  const wrap = svg.parentElement;
  const tooltip = document.getElementById('tooltip');
  // Match the viewBox to the rendered width so text and strokes aren't stretched on phones.
  const W = Math.round(svg.clientWidth) || 700, H = 260;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  lastBuckets = buckets;
  const padL = 46, padR = 12, padT = 14, padB = 24;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const n = buckets.length;

  const { min, max, step } = yDomain(buckets);
  const y = v => padT + innerH - ((v - min) / (max - min)) * innerH;
  const x = i => (n === 1 ? padL + innerW / 2 : padL + (innerW * i) / (n - 1));

  let gridSvg = '';
  for (let v = min; v <= max + step / 2; v += step) {
    const yy = y(v);
    gridSvg += `<line class="gridline" x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}"/>`;
    gridSvg += `<text class="axis-label" x="${padL - 6}" y="${yy + 3}" text-anchor="end">${GBP0.format(v)}</text>`;
  }

  const maxXLabels = Math.max(2, Math.floor(innerW / 90));
  const labelStep = Math.max(1, Math.ceil(n / maxXLabels));
  let xLabelSvg = '';
  buckets.forEach((b, i) => {
    const isLast = i === n - 1;
    // Skip a regular label that would collide with the always-shown last one.
    if ((i % labelStep === 0 && (isLast || n - 1 - i >= labelStep / 2)) || isLast) {
      const anchor = n > 1 && i === 0 ? 'start' : n > 1 && isLast ? 'end' : 'middle';
      xLabelSvg += `<text class="axis-label" x="${x(i)}" y="${H - 6}" text-anchor="${anchor}">${b.label}</text>`;
    }
  });

  const investedPts = buckets.map((b, i) => [x(i), y(b.invested)]);
  const valuePts = buckets.map((b, i) => [x(i), y(b.value)]);
  const x0 = x(0), xN = x(n - 1);
  // The shaded gap is one polygon, clipped above the invested line (profit)
  // and below it (loss), so a crossover splits cleanly into green and red.
  const gapPoly = pts([...valuePts, ...[...investedPts].reverse()]);
  const aboveClip = pts([[x0, 0], ...investedPts, [xN, 0]]);
  const belowClip = pts([[x0, H], ...investedPts, [xN, H]]);

  const last = buckets[n - 1];
  svg.innerHTML = `
    <defs>
      <clipPath id="clipProfit"><polygon points="${aboveClip}"/></clipPath>
      <clipPath id="clipLoss"><polygon points="${belowClip}"/></clipPath>
    </defs>
    ${gridSvg}
    ${xLabelSvg}
    <polygon class="area-profit" points="${gapPoly}" clip-path="url(#clipProfit)"/>
    <polygon class="area-loss" points="${gapPoly}" clip-path="url(#clipLoss)"/>
    <polyline class="line-invested" points="${pts(investedPts)}"/>
    <polyline class="line-total" points="${pts(valuePts)}"/>
    <line class="guide" id="chartGuide" x1="0" x2="0" y1="${padT}" y2="${padT + innerH}"/>
    <text class="value-label" x="${xN}" y="${y(Math.max(last.value, last.invested)) - 8}" text-anchor="${n > 1 ? 'end' : 'middle'}">${GBP.format(last.value)}</text>
  `;

  // Dots live in HTML so they stay round when the SVG stretches to fit.
  wrap.querySelectorAll('.chart-dot').forEach(d => d.remove());
  const dotInvested = document.createElement('i');
  const dotTotal = document.createElement('i');
  dotInvested.className = 'chart-dot dot-invested';
  dotTotal.className = 'chart-dot dot-total';
  wrap.append(dotInvested, dotTotal);
  const guide = svg.querySelector('#chartGuide');

  function placeDot(dot, cx, cy) {
    dot.style.left = `${(cx / W) * 100}%`;
    dot.style.top = `${(cy / H) * 100}%`;
  }

  function showAt(i) {
    const b = buckets[i];
    const cx = x(i);
    guide.setAttribute('x1', cx);
    guide.setAttribute('x2', cx);
    placeDot(dotInvested, cx, y(b.invested));
    placeDot(dotTotal, cx, y(b.value));

    const gain = b.value - b.invested;
    const gainPct = b.invested > 0 ? (gain / b.invested) * 100 : 0;
    const gainColor = gain >= 0 ? 'var(--good)' : 'var(--critical)';
    tooltip.innerHTML = `
      <div class="t-date">${fmtDateFull(b.date)}</div>
      <div class="t-row"><span><span class="sw" style="background:var(--context-line)"></span>Invested</span><b>${GBP.format(b.invested)}</b></div>
      <div class="t-row"><span><span class="sw" style="background:${gainColor}"></span>${gain >= 0 ? 'Profit' : 'Loss'}</span><b style="color:${gainColor}">${gain >= 0 ? '+' : '−'}${GBP.format(Math.abs(gain))} (${gainPct.toFixed(1)}%)</b></div>
      <div class="t-row t-total"><span><span class="sw" style="background:var(--accent)"></span>Total</span><b>${GBP.format(b.value)}</b></div>
    `;
    const pct = cx / W;
    const anchorX = pct < 0.18 ? '-6%' : pct > 0.82 ? '-94%' : '-50%';
    tooltip.style.left = `${pct * 100}%`;
    // Near the top of the plot the tooltip would cover the controls, so drop it below the lines.
    const flip = y(Math.max(b.invested, b.value)) < padT + innerH * 0.45;
    const anchorY = flip ? y(Math.min(b.invested, b.value)) : y(Math.max(b.invested, b.value));
    tooltip.style.top = `${(anchorY / H) * 100}%`;
    tooltip.style.transform = `translate(${anchorX}, ${flip ? '12px' : 'calc(-100% - 12px)'})`;
    tooltip.classList.add('visible');
  }
  function indexFromClientX(clientX) {
    const rect = svg.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * W;
    if (n === 1) return 0;
    return Math.max(0, Math.min(n - 1, Math.round(((svgX - padL) / innerW) * (n - 1))));
  }
  svg.onmousemove = e => showAt(indexFromClientX(e.clientX));
  svg.onmouseleave = () => showAt(n - 1);
  svg.ontouchstart = e => showAt(indexFromClientX(e.touches[0].clientX));
  svg.ontouchmove = e => showAt(indexFromClientX(e.touches[0].clientX));
  svg.ontouchend = () => showAt(n - 1);

  showAt(n - 1);
}
