#!/usr/bin/env bash
set -euo pipefail

minimum_free_gb="${1:-12}"
pressure_prune_until_hours="${2:-1}"

[[ "$minimum_free_gb" =~ ^[1-9][0-9]*$ ]] || { echo "minimum free GiB must be a positive integer" >&2; exit 2; }
[[ "$pressure_prune_until_hours" =~ ^[1-9][0-9]*$ ]] || { echo "prune age must be a positive integer" >&2; exit 2; }

docker_root="$(docker info --format '{{.DockerRootDir}}')"
[[ -n "$docker_root" ]] || { echo "Unable to determine DockerRootDir" >&2; exit 1; }

available_kib() { df -Pk "$docker_root" | awk 'NR == 2 {print $4}'; }

minimum_kib=$((minimum_free_gb * 1024 * 1024))
before_kib="$(available_kib)"
[[ "$before_kib" =~ ^[0-9]+$ ]] || { echo "Unable to determine free Docker space" >&2; exit 1; }

echo "Docker storage: $((before_kib / 1024 / 1024)) GiB free; ${minimum_free_gb} GiB required"

if (( before_kib < minimum_kib )); then
  docker container prune -f --filter "until=${pressure_prune_until_hours}h"
  docker image prune -f --filter "until=${pressure_prune_until_hours}h"
  docker builder prune -f --filter "until=${pressure_prune_until_hours}h"
fi

after_kib="$(available_kib)"
echo "Docker storage after preflight: $((after_kib / 1024 / 1024)) GiB free"
(( after_kib >= minimum_kib )) || {
  echo "Insufficient Docker storage for a reversible deploy" >&2
  echo "No volumes, running containers, or tagged images were removed." >&2
  docker system df >&2 || true
  exit 1
}
