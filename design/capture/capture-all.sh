#!/usr/bin/env bash
# Capture every demo app at 100x30 and 80x24 cells, then build the HTML board.
# Needs each app's node_modules (npm install in the app). Output goes to design/capture/out/.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
for app in admin-dashboard demo-shop adventure-game animation-demo; do
  for size in "100 30" "80 24"; do
    set -- $size
    node capture.mjs "$app" "$1" "$2" "out/$app-${1}x$2.json" > "out/$app-${1}x$2.log" 2>&1 \
      || { echo "capture failed: $app $1x$2 (see out/$app-${1}x$2.log)"; exit 1; }
  done
done
rm -f out/sessions-*.json
node board.mjs out issues.json out/board.html
