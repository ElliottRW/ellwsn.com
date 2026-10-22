// Pulls filled £20 VUAG buys from the Trading 212 API and appends any new
// days to data/purchases.csv. Safe to re-run: days already in the file are
// skipped. Needs T212_API_KEY and T212_API_SECRET; Node 20+ (built-in fetch).
// Set T212_DUMP to a file path to also save the raw API pages there (keep it
// out of git: the response includes every order on the account).

import { readFile, writeFile } from 'node:fs/promises';

const BASE_URL = process.env.T212_BASE_URL || 'https://live.trading212.com';
const TICKER_PREFIX = 'VUAG';
const AMOUNT = 20;
const CSV_PATH = process.env.PURCHASES_CSV || new URL('../data/purchases.csv', import.meta.url);

const { T212_API_KEY, T212_API_SECRET } = process.env;
if (!T212_API_KEY || !T212_API_SECRET) {
  console.error('Set T212_API_KEY and T212_API_SECRET.');
  process.exit(1);
}
const auth = 'Basic ' + Buffer.from(`${T212_API_KEY}:${T212_API_SECRET}`).toString('base64');

const londonDate = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });

async function getJson(path) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(BASE_URL + path, { headers: { Authorization: auth } });
    if (res.status === 429 && attempt < 3) {
      const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
      const wait = Math.max(reset - Date.now(), 0) + 1000 || 60000;
      console.log(`Rate limited, waiting ${Math.round(wait / 1000)}s`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}: ${await res.text()}`);
    return res.json();
  }
}

const isWantedBuy = ({ order, fill }) =>
  order?.ticker?.startsWith(TICKER_PREFIX) &&
  order.side === 'BUY' &&
  order.status === 'FILLED' &&
  fill?.type === 'TRADE' &&
  Math.abs((order.value ?? order.filledValue) - AMOUNT) < 0.005;

const csv = await readFile(CSV_PATH, 'utf8');
const lines = csv.trim().split(/\r?\n/);
const [header, ...rows] = lines;
const knownDates = new Set(rows.map(r => r.split(',')[0]));
const lastDate = rows.length ? rows[rows.length - 1].split(',')[0] : '';

// History comes back newest first; stop paging once we're past the last day
// already recorded.
const found = new Map();
const rawPages = [];
let path = '/api/v0/equity/history/orders?limit=50';
while (path) {
  const page = await getJson(path);
  rawPages.push(page);
  let reachedKnown = false;
  for (const item of page.items ?? []) {
    const date = londonDate(item.fill?.filledAt ?? item.order.createdAt);
    if (date < lastDate) { reachedKnown = true; continue; }
    if (!isWantedBuy(item) || knownDates.has(date) || found.has(date)) continue;
    const { order, fill } = item;
    found.set(date, [date, fill.quantity, fill.price, (order.filledValue ?? order.value).toFixed(2)].join(','));
  }
  path = reachedKnown || !page.items?.length ? null : page.nextPagePath;
}

if (process.env.T212_DUMP) {
  await writeFile(process.env.T212_DUMP, JSON.stringify(rawPages, null, 2) + '\n');
  console.log(`Saved ${rawPages.length} raw page(s) to ${process.env.T212_DUMP}`);
}

if (found.size === 0) {
  console.log('No new VUAG purchases.');
  process.exit(0);
}

const merged = [...rows, ...found.values()].sort((a, b) => a.localeCompare(b));
await writeFile(CSV_PATH, [header, ...merged].join('\n') + '\n');
console.log(`Added ${found.size} purchase(s): ${[...found.keys()].sort().join(', ')}`);
