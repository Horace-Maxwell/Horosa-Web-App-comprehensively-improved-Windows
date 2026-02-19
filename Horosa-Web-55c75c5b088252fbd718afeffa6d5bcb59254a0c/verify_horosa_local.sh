#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
UI_DIR="${ROOT}/astrostudyui"
SMOKE_IN="/private/tmp/horosa_endpoint_smoke.tsv"
SMOKE_OUT="/private/tmp/horosa_endpoint_smoke_after.tsv"

port_listening() {
  local port="$1"
  lsof -tiTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

if ! port_listening 8899; then
  echo "chart service 8899 is not reachable. start services first."
  exit 1
fi

if ! port_listening 9999; then
  echo "backend 9999 is not reachable. start services first."
  exit 1
fi

cd "${UI_DIR}"
node .tmp_horosa_verify.js

if [ -f "${SMOKE_IN}" ]; then
  node .tmp_horosa_smoke.js
  echo ""
  echo "smoke report: ${SMOKE_OUT}"
  echo "key lines:"
  rg -n "^(allowedcharts|chart|chart13|india/chart|common/imgToken|common/inversebazi|gua/desc|user/check|common/time)\\t" "${SMOKE_OUT}" -S || true
fi
