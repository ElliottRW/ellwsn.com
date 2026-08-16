// Pure financial computation — no DOM access, so it stays easy to reason about
// (and to unit-test later) independent of how it's rendered.

function buildDailyPoints(purchases) {
  let cumInvested = 0, cumShares = 0;
  return purchases.map(p => {
    cumInvested += p.amount;
    cumShares += p.quantity;
    return { date: p.date, invested: cumInvested, value: cumShares * p.price, price: p.price };
  });
}

export function summarizePortfolio(purchases) {
  const points = buildDailyPoints(purchases);
  const last = points[points.length - 1];

  const totalInvested = last.invested;
  const totalShares = purchases.reduce((sum, p) => sum + p.quantity, 0);
  const avgCost = totalInvested / totalShares;
  const currentPrice = purchases[purchases.length - 1].price;
  const currentValue = last.value; // totalShares * currentPrice, already true by construction

  const gain = currentValue - totalInvested;
  const gainPct = totalInvested > 0 ? (gain / totalInvested) * 100 : 0;

  return { points, totalInvested, totalShares, avgCost, currentPrice, currentValue, gain, gainPct };
}
