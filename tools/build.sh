#!/usr/bin/env bash
# Build chip.cafe into dist/ and patch in the custom index.html + styles.
set -euo pipefail
cd "$(dirname "$0")/.."

gleam run -m lustre/dev build chipcafe
cp index.html dist/index.html
cp style.css dist/style.css

echo "dist/ is ready. Serve it with: python3 -m http.server -d dist 8000"
