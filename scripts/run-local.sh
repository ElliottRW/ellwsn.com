#!/bin/zsh
# Daily Trading 212 fetch on this Mac, run by launchd
# (~/Library/LaunchAgents/local.ellwsn.fetch-orders.plist). Reads the API key
# and secret from the login Keychain, appends new purchases, then commits and
# pushes purchases.csv. Logs to ~/Library/Logs/ellwsn-fetch-orders.log.

set -euo pipefail
export PATH=/opt/homebrew/bin:/usr/bin:/bin

cd "${0:A:h}/.."
echo "== $(date '+%F %T')"

if [[ "$(git branch --show-current)" != main ]]; then
  echo "Not on main, skipping."; exit 0
fi
if [[ -n "$(git status --porcelain data/purchases.csv)" ]]; then
  echo "purchases.csv has uncommitted changes, skipping."; exit 0
fi

export T212_API_KEY="$(security find-generic-password -s ellwsn-t212 -a api-key -w)"
export T212_API_SECRET="$(security find-generic-password -s ellwsn-t212 -a api-secret -w)"

git pull --quiet --rebase --autostash origin main
node scripts/fetch-orders.mjs

if git diff --quiet data/purchases.csv; then
  exit 0
fi
git add data/purchases.csv
git commit --quiet -m "Add Trading 212 purchases for $(date +%F)" -- data/purchases.csv
git push --quiet origin main
echo "Pushed."
