// Pure financial computation — no DOM access, so it stays easy to reason about
// (and to unit-test later) independent of how it's rendered.

function buildDailyPoints(purchases) {
  let cumInvested = 0, cumShares = 0;
  return purchases.map(p => {
    cumInvested += p.amount;
    cumShares += p.quantity;
    return { date: p.date, invested: cumInvested, value: cumShares * p.price, price: p.price, isStatus: false };
  });
}

export function summarizePortfolio(purchases, status) {
  const points = buildDailyPoints(purchases);

  const totalInvested = points[points.length - 1].invested;
  const totalShares = purchases.reduce((sum, p) => sum + p.quantity, 0);
  const avgCost = totalInvested / totalShares;
  const lastPurchase = purchases[purchases.length - 1];
  const currentPrice = status && status.price ? status.price : lastPurchase.price;
  const currentValue = totalShares * currentPrice;

  if (status && status.asOf && status.asOf > lastPurchase.date) {
    points.push({ date: status.asOf, invested: totalInvested, value: currentValue, price: currentPrice, isStatus: true });
  } else {
    points[points.length - 1].value = currentValue;
  }

  const gain = currentValue - totalInvested;
  const gainPct = totalInvested > 0 ? (gain / totalInvested) * 100 : 0;

  return { points, totalInvested, totalShares, avgCost, currentPrice, currentValue, gain, gainPct };
}
