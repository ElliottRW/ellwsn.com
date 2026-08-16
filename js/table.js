import { GBP, fmtDate } from './format.js';

export function renderTable(purchases, currentPrice) {
  const body = document.getElementById('historyBody');
  body.innerHTML = purchases.slice().reverse().map(p => {
    const worthNow = p.quantity * currentPrice;
    const cls = worthNow >= p.amount ? 'up' : 'down';
    const arrow = worthNow >= p.amount ? '▲' : '▼';
    return `
      <tr>
        <td>${fmtDate(p.date)}</td>
        <td>${GBP.format(p.price)}</td>
        <td>${p.quantity.toFixed(4)}</td>
        <td>${GBP.format(p.amount)}</td>
        <td class="worth-now ${cls}">${arrow} ${GBP.format(worthNow)}</td>
      </tr>
    `;
  }).join('');
}
