# Updating the portfolio tracker

Two files drive the whole page. Edit, commit, push — GitHub Pages redeploys
automatically. No build step.

## `purchases.json` — one entry per receipt

Append one object per day, in date order (the page assumes ascending dates —
it uses array position as the "Day N" counter). Numbers only, no `£` signs.

```json
{ "date": "2026-08-15", "quantity": 0.168212, "price": 118.95, "amount": 20.00 }
```

- `date` — `YYYY-MM-DD`, the day you bought
- `quantity` — shares/units bought, straight off the receipt
- `price` — price paid per share that day
- `amount` — cash amount invested that day (normally £20, but keep it
  receipt-accurate if a platform rounds)

## `status.json` — current price snapshot

Update this whenever you check the app (doesn't need to be daily). Drives the
"Portfolio value" and gain/loss figures — without it the page just shows cost
basis.

```json
{ "asOf": "2026-08-15", "price": 119.10, "currency": "GBP" }
```

## The demo data

`purchases.json` currently has 10 sample rows so the page has something to
render. Delete them and start from your real Day 1 receipt whenever you're
ready — the page has no hardcoded start date, it just reads whatever's in
the array.
