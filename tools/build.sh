#!/usr/bin/env bash
# Build chip.cafe into dist/ and patch in the custom index.html + styles.
set -euo pipefail
cd "$(dirname "$0")/.."

gleam run -m lustre/dev build chipcafe
cp index.html dist/index.html
cp style.css dist/style.css
cp config.js dist/config.js

# Rondar's static preview recipe runs this build before starting its HTTP
# server. Materialize public browser configuration only in that runtime. CI and
# ordinary builds must retain the checked-in empty placeholder even when they
# have access to deployment secrets.
if [[ -n "${RONDAR_PREVIEW_HOSTS:-}" ]]; then
  sh tools/write-browser-config.sh dist/config.js
fi

echo "dist/ is ready. Serve it with: python3 -m http.server -d dist 8000"
