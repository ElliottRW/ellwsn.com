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

function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// A manually-entered live price only counts today — otherwise a forgotten
// entry from last week would silently keep overriding real purchase data.
function freshLivePrice(livePrice) {
  if (!livePrice || typeof livePrice.price !== 'number' || !livePrice.asOf) return null;
  const asOfDate = new Date(livePrice.asOf);
  if (isNaN(asOfDate.getTime())) return null;
  if (localDateStr(asOfDate) !== localDateStr(new Date())) return null;
  return { price: livePrice.price, asOf: livePrice.asOf, dateKey: localDateStr(asOfDate) };
}

export function summarizePortfolio(purchases, livePrice) {
  const points = buildDailyPoints(purchases);
  const last = points[points.length - 1];
  const lastPurchase = purchases[purchases.length - 1];

  const totalInvested = last.invested;
  const totalShares = purchases.reduce((sum, p) => sum + p.quantity, 0);
  const avgCost = totalInvested / totalShares;

  const live = freshLivePrice(livePrice);
  const currentPrice = live ? live.price : lastPurchase.price;
  const currentValue = totalShares * currentPrice;
  const priceIsLive = !!live;
  const priceAsOf = live ? live.asOf : lastPurchase.date;

  if (live) {
    if (live.dateKey > lastPurchase.date) {
      points.push({ date: live.dateKey, invested: totalInvested, value: currentValue, price: currentPrice });
    } else {
      points[points.length - 1].value = currentValue;
    }
  }

  const gain = currentValue - totalInvested;
  const gainPct = totalInvested > 0 ? (gain / totalInvested) * 100 : 0;

  return { points, totalInvested, totalShares, avgCost, currentPrice, currentValue, gain, gainPct, priceIsLive, priceAsOf };
}
