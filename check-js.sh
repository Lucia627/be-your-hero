#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/frontend/js"
for f in api.js ui.js cards.js camera.js battle.js main.js; do
  echo "=== $f ==="
  node --check "$f" 2>&1 || true
done
