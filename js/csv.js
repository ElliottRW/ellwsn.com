export function parsePurchasesCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift().split(',').map(h => h.trim());
  return lines.filter(Boolean).map(line => {
    const cells = line.split(',').map(c => c.trim());
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i]; });
    return {
      date: row.date,
      quantity: parseFloat(row.quantity),
      price: parseFloat(row.price),
      amount: parseFloat(row.amount),
    };
  });
}
