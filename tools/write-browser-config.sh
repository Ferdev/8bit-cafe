#!/bin/sh
set -eu

if [ "$#" -ne 1 ] || [ -z "$1" ]; then
  echo "usage: write-browser-config.sh OUTPUT_PATH" >&2
  exit 64
fi

output_path=$1
case "$output_path" in
  */*) output_dir=${output_path%/*} ;;
  *) output_dir=. ;;
esac
[ -n "$output_dir" ] || output_dir=/
mkdir -p "$output_dir"

encode_base64() {
  printf '%s' "$1" | base64 | tr -d '\n'
}

api_key_base64=$(encode_base64 "${TYPESAFE_API_KEY:-}")
model_base64=$(encode_base64 "${TYPESAFE_MODEL:-jev-latest}")
temporary_path=$(mktemp "${output_path}.tmp.XXXXXX")
trap 'rm -f "$temporary_path"' EXIT HUP INT TERM

cat > "$temporary_path" <<EOF
// Generated at runtime. Browser credentials are public; use only a restricted,
// revocable TypeSafe key with an explicit spending limit.
window.CHIPCAFE_CONFIG = Object.freeze({
  typesafeApiKey: atob("${api_key_base64}"),
  typesafeModel: atob("${model_base64}"),
});
EOF

chmod 0644 "$temporary_path"
mv -f "$temporary_path" "$output_path"
trap - EXIT HUP INT TERM
