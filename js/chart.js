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

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

export function bucketForRange(dailyPoints, range) {
  const cutoff = cutoffDate(range);
  let filtered = cutoff ? dailyPoints.filter(p => new Date(p.date + 'T00:00:00') >= cutoff) : dailyPoints;
  if (filtered.length === 0) filtered = dailyPoints.slice(-1);

  if (range === '1W' || range === '1M') {
    return filtered.map(p => ({ label: fmtDate(p.date), date: p.date, invested: p.invested, value: p.value, isStatus: p.isStatus }));
  }
  const byMonth = new Map();
  filtered.forEach(p => byMonth.set(p.date.slice(0, 7), p));
  return [...byMonth.entries()].map(([key, p]) => ({
    label: monthLabel(key), date: p.date, invested: p.invested, value: p.value, isStatus: p.isStatus,
  }));
}

function roundedTopRect(xLeft, yTop, w, h, r) {
  if (h <= 0.5) return '';
  r = Math.min(r, w / 2, h);
  return `<path d="M${xLeft},${yTop + h} L${xLeft},${yTop + r} Q${xLeft},${yTop} ${xLeft + r},${yTop} L${xLeft + w - r},${yTop} Q${xLeft + w},${yTop} ${xLeft + w},${yTop + r} L${xLeft + w},${yTop + h} Z"/>`;
}

function squareRect(xLeft, yTop, w, h) {
  if (h <= 0.5) return '';
  return `<rect x="${xLeft}" y="${yTop}" width="${w}" height="${h}"/>`;
}

export function renderChart(buckets) {
  const svg = document.getElementById('chart');
  const tooltip = document.getElementById('tooltip');
  const W = 700, H = 260;
  const padL = 46, padR = 12, padT = 14, padB = 24;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const n = buckets.length;
  const GAP = 2;

  const maxVal = niceMax(Math.max(...buckets.map(b => Math.max(b.value, b.invested))) * 1.1);
  const y = v => padT + innerH - (v / maxVal) * innerH;
  const slot = innerW / n;
  const barW = Math.max(4, Math.min(24, slot * 0.55));

  const ticks = 4;
  let gridSvg = '';
  for (let t = 0; t <= ticks; t++) {
    const v = (maxVal / ticks) * t;
    const yy = y(v);
    gridSvg += `<line class="gridline" x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}"/>`;
    gridSvg += `<text class="axis-label" x="${padL - 6}" y="${yy + 3}" text-anchor="end">${GBP0.format(v)}</text>`;
  }

  const maxXLabels = 6;
  const labelStep = Math.max(1, Math.ceil(n / maxXLabels));
  let xLabelSvg = '';
  buckets.forEach((b, i) => {
    if (i % labelStep === 0 || i === n - 1) {
      xLabelSvg += `<text class="axis-label" x="${padL + slot * i + slot / 2}" y="${H - 6}" text-anchor="middle">${b.label}</text>`;
    }
  });

  let barsSvg = '', hitSvg = '';
  buckets.forEach((b, i) => {
    const xLeft = padL + slot * i + (slot - barW) / 2;
    const base = Math.min(b.invested, b.value);
    const top = Math.max(b.invested, b.value);
    const isGain = b.value >= b.invested;
    const baseY = y(base);
    const baseline = y(0);
    const hasCap = top > base;
    const capBottom = hasCap ? baseY - GAP : baseY;
    const capTop = y(top);

    barsSvg += `<g class="bar-group" data-i="${i}">
      <g class="bar-invested">${hasCap ? squareRect(xLeft, baseY, barW, baseline - baseY) : roundedTopRect(xLeft, baseY, barW, baseline - baseY, 3)}</g>
      ${hasCap ? `<g class="${isGain ? 'bar-gain' : 'bar-loss'}">${roundedTopRect(xLeft, capTop, barW, Math.max(0, capBottom - capTop), 3)}</g>` : ''}
    </g>`;
    hitSvg += `<rect class="bar-hit" data-i="${i}" x="${padL + slot * i}" y="${padT}" width="${slot}" height="${innerH}" fill="transparent"/>`;
  });

  const last = buckets[n - 1];
  svg.innerHTML = `
    ${gridSvg}
    ${xLabelSvg}
    ${barsSvg}
    <text class="value-label" x="${padL + slot * (n - 1) + slot / 2}" y="${y(Math.max(last.value, last.invested)) - 8}" text-anchor="middle">${GBP.format(last.value)}</text>
    ${hitSvg}
  `;

  const groups = svg.querySelectorAll('.bar-group');

  function showAt(i) {
    const b = buckets[i];
    groups.forEach(g => { g.style.opacity = Number(g.dataset.i) === i ? 1 : 0.55; });

    const gain = b.value - b.invested;
    const gainPct = b.invested > 0 ? (gain / b.invested) * 100 : 0;
    tooltip.innerHTML = `
      <div class="t-date">${fmtDateFull(b.date)}${b.isStatus ? ' (latest)' : ''}</div>
      <div class="t-row"><span><span class="sw" style="background:var(--accent)"></span>Invested</span><b>${GBP.format(b.invested)}</b></div>
      <div class="t-row"><span><span class="sw" style="background:${gain >= 0 ? 'var(--gain)' : 'var(--critical)'}"></span>${gain >= 0 ? 'Gain' : 'Loss'}</span><b style="color:${gain >= 0 ? 'var(--good)' : 'var(--critical)'}">${gain >= 0 ? '+' : ''}${GBP.format(gain)} (${gainPct.toFixed(1)}%)</b></div>
      <div class="t-row"><span>Worth</span><b>${GBP.format(b.value)}</b></div>
    `;
    const cx = padL + slot * i + slot / 2;
    const pct = cx / W;
    const anchorX = pct < 0.18 ? '-6%' : pct > 0.82 ? '-94%' : '-50%';
    tooltip.style.left = `${pct * 100}%`;
    tooltip.style.top = `${(y(Math.max(b.invested, b.value)) / H) * 100}%`;
    tooltip.style.transform = `translate(${anchorX}, -110%)`;
    tooltip.classList.add('visible');
  }
  function hide() {
    groups.forEach(g => { g.style.opacity = 1; });
    tooltip.classList.remove('visible');
  }
  function indexFromClientX(clientX) {
    const rect = svg.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * W;
    return Math.max(0, Math.min(n - 1, Math.floor((svgX - padL) / slot)));
  }
  svg.querySelectorAll('.bar-hit').forEach(hit => {
    const i = Number(hit.dataset.i);
    hit.addEventListener('mouseenter', () => showAt(i));
  });
  svg.addEventListener('mouseleave', hide);
  svg.addEventListener('touchstart', e => showAt(indexFromClientX(e.touches[0].clientX)), { passive: true });
  svg.addEventListener('touchmove', e => showAt(indexFromClientX(e.touches[0].clientX)), { passive: true });
  svg.addEventListener('touchend', hide);

  showAt(n - 1);
}
