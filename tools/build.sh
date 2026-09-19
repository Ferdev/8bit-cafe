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

  # TypeSafe's API currently rejects cross-origin browser requests. Keep the
  # SDK and generation in the browser while serving the one Jev endpoint from
  # this origin. The cached Rondar recipe invokes this build script before its
  # static server; taking over here lets that existing recipe remain valid.
  if [[ -n "${PORT:-}" ]]; then
    exec node tools/preview-server.mjs dist "$PORT"
  fi
fi

echo "dist/ is ready. Serve it with: node tools/preview-server.mjs dist 8000"
