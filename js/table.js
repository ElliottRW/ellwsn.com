import { GBP, fmtDate } from './format.js';

export function renderTable(purchases, currentPrice) {
  const body = document.getElementById('historyBody');
  body.innerHTML = purchases.slice().reverse().map(p => {
    const worthNow = p.quantity * currentPrice;
    // Compare in pennies, matching what's actually displayed — otherwise sub-penny
    // noise from the receipt's 4dp quantity can flip the arrow on a day that's
    // genuinely flat (most visibly today's own row, priced at today's price).
    const deltaPence = Math.round((worthNow - p.amount) * 100);
    const cls = deltaPence > 0 ? 'up' : deltaPence < 0 ? 'down' : '';
    const arrow = deltaPence > 0 ? '▲ ' : deltaPence < 0 ? '▼ ' : '';
    return `
      <tr>
        <td>${fmtDate(p.date)}</td>
        <td>${GBP.format(p.price)}</td>
        <td>${p.quantity.toFixed(4)}</td>
        <td>${GBP.format(p.amount)}</td>
        <td class="worth-now ${cls}">${arrow}${GBP.format(worthNow)}</td>
      </tr>
    `;
  }).join('');
}
