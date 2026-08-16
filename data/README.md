# Updating the portfolio tracker

One file drives the whole page: `purchases.csv`. Edit, commit, push —
GitHub Pages redeploys automatically. No build step.

## `purchases.csv` — one row per receipt

Append one row per day, in date order (the page assumes ascending dates —
it uses row position as the "Day N" counter). Numbers only, no `£` signs,
no commas inside a number.

```csv
date,quantity,price,amount
2026-08-15,0.168212,118.95,20.00
```

- `date` — `YYYY-MM-DD`, the day you bought
- `quantity` — shares/units bought, straight off the receipt
- `price` — price paid per share that day
- `amount` — cash amount invested that day (normally £20, but keep it
  receipt-accurate if a platform rounds)

Opens fine in Excel/Numbers/Google Sheets too if that's easier than a text
editor — just keep the header row and save back out as CSV.

There's no separate "current price" file — "Portfolio value" and the
gain/loss figures are always priced at your most recent purchase, so the
page stays accurate the moment you add today's row. No manual price
updates to remember.

## The demo data

`purchases.csv` currently has 10 sample rows so the page has something to
render. Delete them and start from your real Day 1 receipt whenever you're
ready — the page has no hardcoded start date, it just reads whatever's in
the file.
