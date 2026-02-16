#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: scripts/with-node.sh <command> [args...]" >&2
  exit 2
fi

if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  exec "$@"
fi

NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm use default >/dev/null
fi

if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  exec "$@"
fi

echo "Node.js/npm not found. Install Node or configure nvm at $NVM_DIR." >&2
exit 127
