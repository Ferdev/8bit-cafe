#!/bin/sh
set -eu

api_key_base64="$(printf '%s' "${TYPESAFE_API_KEY:-}" | base64 | tr -d '\n')"
model_base64="$(printf '%s' "${TYPESAFE_MODEL:-jev-latest}" | base64 | tr -d '\n')"

cat > /usr/share/nginx/html/config.js <<EOF
window.CHIPCAFE_CONFIG = Object.freeze({
  typesafeApiKey: atob("${api_key_base64}"),
  typesafeModel: atob("${model_base64}"),
});
EOF
