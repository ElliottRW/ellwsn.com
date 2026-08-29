# Updating the portfolio tracker

Two files drive the page: `purchases.csv` (required) and `live-price.json`
(optional). Edit, commit, push — GitHub Pages redeploys automatically. No
build step.

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

By default "Portfolio value" and the gain/loss figures are priced at your
most recent purchase — no manual updates needed for daily posting.

## `live-price.json` — optional, for filming a same-day comparison

Before recording a video where you want to show the day's live movement,
look up VUAG's current price yourself (broker app, Google, etc.) and drop
it in here:

```json
{ "price": 111.85, "asOf": "2026-08-29T09:15" }
```

- `price` — the number you looked up
- `asOf` — `YYYY-MM-DDTHH:MM`, when you looked it up

The page only trusts this if `asOf` is **today** — so it can't be
forgotten and silently go stale. Once the date rolls over it's ignored
automatically and the page falls back to pricing off your last purchase,
no cleanup needed. Whichever source is active is labelled clearly under
"Portfolio value" ("Live · updated HH:MM" vs "Priced at your last
purchase"), so it's never ambiguous which one a viewer is looking at.

## The demo data

`purchases.csv` currently has 10 sample rows so the page has something to
render. Delete them and start from your real Day 1 receipt whenever you're
ready — the page has no hardcoded start date, it just reads whatever's in
the file.
