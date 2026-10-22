// Compares two purchases CSVs day by day, ignoring formatting differences
// like 112 vs 112.00. Usage: node scripts/compare-purchases.mjs <a.csv> <b.csv>

import { readFile } from 'node:fs/promises';

const [aPath, bPath] = process.argv.slice(2);
if (!aPath || !bPath) {
  console.error('Usage: node scripts/compare-purchases.mjs <a.csv> <b.csv>');
  process.exit(1);
}

async function load(path) {
  const [header, ...rows] = (await readFile(path, 'utf8')).trim().split(/\r?\n/);
  const cols = header.split(',').map(h => h.trim());
  return new Map(rows.filter(Boolean).map(line => {
    const cells = line.split(',').map(c => c.trim());
    const row = Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
    return [row.date, row];
  }));
}

const a = await load(aPath);
const b = await load(bPath);
const fields = ['quantity', 'price', 'amount'];
let matches = 0;
const problems = [];

for (const date of [...new Set([...a.keys(), ...b.keys()])].sort()) {
  const ra = a.get(date), rb = b.get(date);
  if (!ra) { problems.push(`${date}  only in ${bPath}`); continue; }
  if (!rb) { problems.push(`${date}  only in ${aPath}`); continue; }
  const diffs = fields.filter(f => Math.abs(parseFloat(ra[f]) - parseFloat(rb[f])) > 1e-6)
    .map(f => `${f} ${ra[f]} vs ${rb[f]}`);
  if (diffs.length) problems.push(`${date}  ${diffs.join(', ')}`);
  else matches++;
}

console.log(`${matches} day(s) match exactly.`);
if (problems.length) console.log(`${problems.length} difference(s):\n` + problems.join('\n'));
