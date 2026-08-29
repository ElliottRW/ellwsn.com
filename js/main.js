import { GBP, fmtDateFull, fmtTime } from './format.js';
import { parsePurchasesCsv } from './csv.js';
import { summarizePortfolio } from './portfolio.js';
import { bucketForRange, renderChart } from './chart.js';
import { renderTable } from './table.js';

async function load() {
  const kpis = document.getElementById('kpis');
  let purchases;
  try {
    purchases = await fetch('data/purchases.csv').then(r => r.text()).then(parsePurchasesCsv);
  } catch (e) {
    kpis.innerHTML = '<div class="empty-state">Couldn\'t load portfolio data.</div>';
    return;
  }
  const livePrice = await fetch('data/live-price.json').then(r => r.json()).catch(() => null);

  if (!purchases || purchases.length === 0) {
    document.getElementById('dayLabel').textContent = 'Day 0';
    kpis.innerHTML = '<div class="empty-state">No purchases logged yet — Day 1 is coming soon.</div>';
    document.querySelector('.chart-controls').style.display = 'none';
    document.querySelector('.chart-scroll').innerHTML = '<div class="empty-state">Chart will appear once the first receipt is in.</div>';
    document.getElementById('historyBody').innerHTML = '';
    return;
  }

  purchases = [...purchases].sort((a, b) => a.date.localeCompare(b.date));

  const { points, totalInvested, totalShares, avgCost, currentPrice, currentValue, gain, gainPct, priceIsLive, priceAsOf } =
    summarizePortfolio(purchases, livePrice);

  document.getElementById('dayLabel').textContent = `Day ${purchases.length}`;
  document.getElementById('startDate').textContent = fmtDateFull(purchases[0].date);

  const deltaClass = gain >= 0 ? 'up' : 'down';
  const deltaArrow = gain >= 0 ? '▲' : '▼';
  const priceNote = priceIsLive
    ? `Live · updated ${fmtTime(priceAsOf)}`
    : 'Priced at your last purchase';
  kpis.innerHTML = `
    <div class="kpi hero-kpi">
      <div class="label">Portfolio value</div>
      <div class="value">${GBP.format(currentValue)}</div>
      <div class="delta ${deltaClass}">${deltaArrow} ${GBP.format(Math.abs(gain))} (${gainPct.toFixed(1)}%)</div>
      <div class="price-note ${priceIsLive ? 'live' : ''}"><i></i>${priceNote}</div>
    </div>
    <div class="kpi">
      <div class="label">Total invested</div>
      <div class="value">${GBP.format(totalInvested)}</div>
    </div>
    <div class="kpi">
      <div class="label">Shares held</div>
      <div class="value">${totalShares.toFixed(4)}</div>
    </div>
    <div class="kpi">
      <div class="label">Avg cost / share</div>
      <div class="value">${GBP.format(avgCost)}</div>
    </div>
  `;

  let currentRange = '1W';
  const rangeButtons = document.querySelectorAll('#rangeToggle button');
  rangeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.range === currentRange) return;
      currentRange = btn.dataset.range;
      rangeButtons.forEach(b => b.classList.toggle('active', b === btn));
      renderChart(bucketForRange(points, currentRange));
    });
  });
  renderChart(bucketForRange(points, currentRange));
  renderTable(purchases, currentPrice);
}

load();
