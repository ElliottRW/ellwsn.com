import { GBP, GBP0, fmtDate, fmtDateFull, niceMax } from './format.js';

const RANGE_DAYS = { '1W': 7, '1M': 30, '1Y': 365 };

// Every range gets the full history; the range only sets how many points fit
// in the view at once, so shorter ranges can be panned back through time.
export function bucketForRange(dailyPoints, range) {
  const buckets = dailyPoints.map(p => ({ label: fmtDate(p.date), date: p.date, invested: p.invested, value: p.value }));
  const days = RANGE_DAYS[range];
  if (!days) return { buckets, windowSize: buckets.length };
  const cutoff = new Date(buckets[buckets.length - 1].date + 'T00:00:00');
  cutoff.setDate(cutoff.getDate() - days);
  const windowSize = buckets.filter(b => new Date(b.date + 'T00:00:00') >= cutoff).length;
  return { buckets, windowSize: Math.min(buckets.length, Math.max(2, windowSize)) };
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

const pts = arr => arr.map(([x, y]) => `${x},${y}`).join(' ');

const H = 260;
const padL = 46, padR = 12, padT = 14, padB = 24;
const innerH = H - padT - padB;

// Chart state lives at module level so panning, hovering and resizing can
// redraw without main.js having to know about any of it.
const state = {
  buckets: [], k: 1, start: 0,
  domain: null, target: null,
  hover: null, dragging: false,
};
let svg, wrap, tooltip, dotInvested, dotTotal;
let frame = null;

const maxStart = () => Math.max(0, state.buckets.length - state.k);
const clampStart = s => Math.max(0, Math.min(maxStart(), s));
const width = () => Math.round(svg.clientWidth) || 700;
const innerW = () => width() - padL - padR;
const pxPerIndex = () => (state.k > 1 ? innerW() / (state.k - 1) : innerW());

function xOf(i) {
  if (state.k === 1) return padL + innerW() / 2;
  return padL + (innerW() * (i - state.start)) / (state.k - 1);
}

function visibleRange() {
  const n = state.buckets.length;
  return [Math.max(0, Math.floor(state.start)), Math.min(n - 1, Math.ceil(state.start + state.k - 1))];
}

function requestDraw() {
  if (frame === null) frame = requestAnimationFrame(draw);
}

function draw() {
  frame = null;
  const { buckets } = state;
  const W = width();
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const [lo, hi] = visibleRange();
  state.target = yDomain(buckets.slice(lo, hi + 1));
  if (!state.domain) state.domain = { ...state.target };
  // Ease the axis toward the new range so it glides rather than jumps while panning.
  const d = state.domain, t = state.target;
  d.min += (t.min - d.min) * 0.25;
  d.max += (t.max - d.max) * 0.25;
  const settled = Math.abs(t.min - d.min) < t.step * 0.01 && Math.abs(t.max - d.max) < t.step * 0.01;
  if (settled) { d.min = t.min; d.max = t.max; }

  const y = v => padT + innerH - ((v - d.min) / (d.max - d.min)) * innerH;

  let gridSvg = '';
  for (let v = Math.ceil(d.min / t.step) * t.step; v <= d.max + 1e-6; v += t.step) {
    const yy = y(v);
    gridSvg += `<line class="gridline" x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}"/>`;
    gridSvg += `<text class="axis-label" x="${padL - 6}" y="${yy + 3}" text-anchor="end">${GBP0.format(v)}</text>`;
  }

  // Count label spacing back from the latest point so labels stay put as you pan.
  const n = buckets.length;
  const maxXLabels = Math.max(2, Math.floor(innerW() / 90));
  const labelStep = Math.max(1, Math.ceil(state.k / maxXLabels));
  let xLabelSvg = '';
  for (let i = lo; i <= hi; i++) {
    if ((n - 1 - i) % labelStep !== 0) continue;
    const cx = xOf(i);
    if (cx < padL - 1 || cx > W - padR + 1) continue;
    const anchor = state.k === 1 ? 'middle' : cx < padL + 20 ? 'start' : cx > W - padR - 20 ? 'end' : 'middle';
    xLabelSvg += `<text class="axis-label" x="${cx}" y="${H - 6}" text-anchor="${anchor}">${buckets[i].label}</text>`;
  }

  // Draw one point beyond each edge so lines run off the plot rather than stopping short.
  const from = Math.max(0, lo - 1), to = Math.min(n - 1, hi + 1);
  const slice = buckets.slice(from, to + 1);
  const investedPts = slice.map((b, j) => [xOf(from + j), y(b.invested)]);
  const valuePts = slice.map((b, j) => [xOf(from + j), y(b.value)]);
  const x0 = investedPts[0][0], xN = investedPts[investedPts.length - 1][0];
  // The shaded gap is one polygon, clipped above the invested line (profit)
  // and below it (loss), so a crossover splits cleanly into green and red.
  const gapPoly = pts([...valuePts, ...[...investedPts].reverse()]);
  const aboveClip = pts([[x0, 0], ...investedPts, [xN, 0]]);
  const belowClip = pts([[x0, H], ...investedPts, [xN, H]]);

  const edge = Math.min(n - 1, Math.floor(state.start + state.k - 1 + 1e-6));
  const edgeB = buckets[edge];

  svg.innerHTML = `
    <defs>
      <clipPath id="clipPlot"><rect x="${padL - 3}" y="0" width="${innerW() + 6}" height="${H}"/></clipPath>
      <clipPath id="clipProfit"><polygon points="${aboveClip}"/></clipPath>
      <clipPath id="clipLoss"><polygon points="${belowClip}"/></clipPath>
    </defs>
    ${gridSvg}
    ${xLabelSvg}
    <g clip-path="url(#clipPlot)">
      <polygon class="area-profit" points="${gapPoly}" clip-path="url(#clipProfit)"/>
      <polygon class="area-loss" points="${gapPoly}" clip-path="url(#clipLoss)"/>
      <polyline class="line-invested" points="${pts(investedPts)}"/>
      <polyline class="line-total" points="${pts(valuePts)}"/>
    </g>
    ${state.hover === null && !state.dragging ? `<text class="value-label" x="${xOf(edge)}" y="${y(Math.max(edgeB.value, edgeB.invested)) - 8}" text-anchor="${state.k > 1 ? 'end' : 'middle'}">${GBP.format(edgeB.value)}</text>` : ''}
  `;

  if (state.dragging) {
    tooltip.classList.remove('visible');
    dotInvested.classList.remove('visible');
    dotTotal.classList.remove('visible');
  } else {
    showAt(state.hover ?? edge, W, y);
  }

  if (!settled) requestDraw();
}

function placeDot(dot, cx, cy, W) {
  dot.style.left = `${(cx / W) * 100}%`;
  dot.style.top = `${(cy / H) * 100}%`;
  dot.classList.add('visible');
}

function showAt(i, W, y) {
  const b = state.buckets[i];
  const cx = xOf(i);
  svg.insertAdjacentHTML('beforeend',
    `<line class="guide" x1="${cx}" x2="${cx}" y1="${padT}" y2="${padT + innerH}"/>`);
  placeDot(dotInvested, cx, y(b.invested), W);
  placeDot(dotTotal, cx, y(b.value), W);

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
  const svgX = ((clientX - rect.left) / rect.width) * width();
  if (state.k === 1) return Math.round(state.start);
  const i = Math.round(state.start + ((svgX - padL) / innerW()) * (state.k - 1));
  const [lo, hi] = visibleRange();
  return Math.max(Math.ceil(state.start - 1e-6), Math.min(Math.min(hi, Math.floor(state.start + state.k - 1 + 1e-6)), Math.max(lo, i)));
}

// ---- panning: drag, swipe or sideways trackpad scroll, with a little momentum ----
let pointer = null, glide = null, wheelSnapTimer;

function stopGlide() {
  if (glide) cancelAnimationFrame(glide);
  glide = null;
}

// Settle on a whole point so the window always lines up with real purchases.
function snap() {
  stopGlide();
  const target = clampStart(Math.round(state.start));
  const step = () => {
    state.start += (target - state.start) * 0.3;
    if (Math.abs(target - state.start) < 0.005) { state.start = target; glide = null; requestDraw(); return; }
    requestDraw();
    glide = requestAnimationFrame(step);
  };
  glide = requestAnimationFrame(step);
}

function coast(velocity) {
  stopGlide();
  let last = performance.now();
  const step = now => {
    const dt = now - last;
    last = now;
    state.start = clampStart(state.start + velocity * dt);
    velocity *= Math.pow(0.94, dt / 16);
    requestDraw();
    const atEdge = state.start === 0 || state.start === maxStart();
    if (Math.abs(velocity) < 0.002 || atEdge) { glide = null; snap(); return; }
    glide = requestAnimationFrame(step);
  };
  glide = requestAnimationFrame(step);
}

function attachListeners() {
  svg.addEventListener('pointerdown', e => {
    stopGlide();
    pointer = { id: e.pointerId, x0: e.clientX, start0: state.start, lastX: e.clientX, lastT: e.timeStamp, v: 0, type: e.pointerType };
  });
  svg.addEventListener('pointermove', e => {
    if (pointer && pointer.id === e.pointerId) {
      const dx = e.clientX - pointer.x0;
      if (!state.dragging && Math.abs(dx) > 5 && maxStart() > 0) {
        state.dragging = true;
        svg.setPointerCapture(e.pointerId);
      }
      if (state.dragging) {
        const scale = width() / svg.getBoundingClientRect().width;
        state.start = clampStart(pointer.start0 - (dx * scale) / pxPerIndex());
        const dt = e.timeStamp - pointer.lastT;
        if (dt > 0) pointer.v = (-(e.clientX - pointer.lastX) * scale / pxPerIndex()) / dt;
        pointer.lastX = e.clientX;
        pointer.lastT = e.timeStamp;
        requestDraw();
        return;
      }
    }
    if (e.pointerType === 'mouse' && !state.dragging) {
      state.hover = indexFromClientX(e.clientX);
      requestDraw();
    }
  });
  const end = (e, cancelled) => {
    if (!pointer || pointer.id !== e.pointerId) return;
    if (state.dragging) {
      state.dragging = false;
      // Ignore stale velocity if the finger paused before lifting.
      coast(e.timeStamp - pointer.lastT < 80 ? pointer.v : 0);
    } else if (!cancelled) {
      state.hover = indexFromClientX(e.clientX);
      requestDraw();
    }
    pointer = null;
  };
  svg.addEventListener('pointerup', e => end(e, false));
  svg.addEventListener('pointercancel', e => end(e, true));
  svg.addEventListener('mouseleave', () => {
    if (state.dragging) return;
    state.hover = null;
    requestDraw();
  });
  svg.addEventListener('wheel', e => {
    if (maxStart() === 0 || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    stopGlide();
    state.hover = null;
    state.start = clampStart(state.start + e.deltaX / pxPerIndex());
    requestDraw();
    clearTimeout(wheelSnapTimer);
    wheelSnapTimer = setTimeout(snap, 120);
  }, { passive: false });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(requestDraw, 100);
  });
}

export function renderChart({ buckets, windowSize }) {
  if (!svg) {
    svg = document.getElementById('chart');
    wrap = svg.parentElement;
    tooltip = document.getElementById('tooltip');
    dotInvested = document.createElement('i');
    dotTotal = document.createElement('i');
    dotInvested.className = 'chart-dot dot-invested';
    dotTotal.className = 'chart-dot dot-total';
    // Dots live in HTML so they stay perfectly round.
    wrap.append(dotInvested, dotTotal);
    attachListeners();
  }
  stopGlide();
  state.buckets = buckets;
  state.k = windowSize;
  state.start = maxStart();
  state.hover = null;
  state.domain = null;
  svg.classList.toggle('pannable', maxStart() > 0);
  requestDraw();
}
