#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
UI_DIR="${ROOT}/astrostudyui"
SMOKE_IN="/private/tmp/horosa_endpoint_smoke.tsv"
SMOKE_OUT="/private/tmp/horosa_endpoint_smoke_after.tsv"
PD_VERIFY_JS="${UI_DIR}/scripts/verifyPrimaryDirectionRuntime.js"
FULL_VERIFY_JS="${UI_DIR}/scripts/verifyHorosaRuntimeFull.js"
SCRIPT_ROOT="${ROOT}"
if [ ! -d "${SCRIPT_ROOT}/scripts" ] && [ -d "${ROOT}/../scripts" ]; then
  SCRIPT_ROOT="$(cd "${ROOT}/.." && pwd)"
fi
PROJECT_ROOT="${ROOT}"
PD_VERIFY_PY="${SCRIPT_ROOT}/scripts/check_primary_direction_astroapp_integration.py"
FULL_VERIFY_PY="${SCRIPT_ROOT}/scripts/check_horosa_full_integration.py"
BROWSER_VERIFY_PY="${SCRIPT_ROOT}/scripts/browser_horosa_master_check.py"
CHART_PORT="${HOROSA_CHART_PORT:-8899}"
BACKEND_PORT="${HOROSA_SERVER_PORT:-9999}"
export HOROSA_SERVER_ROOT="${HOROSA_SERVER_ROOT:-http://127.0.0.1:${BACKEND_PORT}}"

resolve_python_bin() {
  if [ -x "${PROJECT_ROOT}/.runtime/mac/venv/bin/python3" ]; then
    echo "${PROJECT_ROOT}/.runtime/mac/venv/bin/python3"
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return 0
  fi
  if command -v python >/dev/null 2>&1; then
    command -v python
    return 0
  fi
  return 1
}

python_has_playwright() {
  local py_bin="$1"
  "${py_bin}" - <<'PY' >/dev/null 2>&1
import importlib.util as iu
raise SystemExit(0 if iu.find_spec("playwright") is not None else 1)
PY
}

resolve_browser_python_bin() {
  local candidate=""

  if [ -n "${HOROSA_BROWSER_CHECK_PYTHON:-}" ] && [ -x "${HOROSA_BROWSER_CHECK_PYTHON}" ] && python_has_playwright "${HOROSA_BROWSER_CHECK_PYTHON}"; then
    echo "${HOROSA_BROWSER_CHECK_PYTHON}"
    return 0
  fi

  for candidate in \
    "${HOME}/miniconda3/bin/python" \
    python3 \
    python; do
    if [ -x "${candidate}" ] && python_has_playwright "${candidate}"; then
      echo "${candidate}"
      return 0
    fi
    if command -v "${candidate}" >/dev/null 2>&1; then
      candidate="$(command -v "${candidate}")"
      if [ -x "${candidate}" ] && python_has_playwright "${candidate}"; then
        echo "${candidate}"
        return 0
      fi
    fi
  done

  return 1
}

port_listening() {
  local port="$1"
  lsof -tiTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

if ! port_listening "${CHART_PORT}"; then
  echo "chart service ${CHART_PORT} is not reachable. start services first."
  exit 1
fi

if ! port_listening "${BACKEND_PORT}"; then
  echo "backend ${BACKEND_PORT} is not reachable. start services first."
  exit 1
fi

cd "${UI_DIR}"
node .tmp_horosa_verify.js
node "${PD_VERIFY_JS}"
node "${FULL_VERIFY_JS}"

PYTHON_BIN="$(resolve_python_bin)"
"${PYTHON_BIN}" "${PD_VERIFY_PY}"
"${PYTHON_BIN}" "${FULL_VERIFY_PY}"

if [ -f "${BROWSER_VERIFY_PY}" ]; then
  if BROWSER_PYTHON_BIN="$(resolve_browser_python_bin 2>/dev/null)"; then
    echo ""
    echo "browser smoke: ${BROWSER_VERIFY_PY}"
    HOROSA_WEB_PORT="${HOROSA_WEB_PORT:-8000}" \
    HOROSA_SERVER_PORT="${BACKEND_PORT}" \
    HOROSA_SERVER_ROOT="${HOROSA_SERVER_ROOT}" \
    "${BROWSER_PYTHON_BIN}" "${BROWSER_VERIFY_PY}"
  else
    echo ""
    echo "browser smoke skipped: playwright-capable python not found."
  fi
fi

if [ -f "${SMOKE_IN}" ]; then
  node .tmp_horosa_smoke.js
  echo ""
  echo "smoke report: ${SMOKE_OUT}"
  echo "key lines:"
  rg -n "^(allowedcharts|chart|chart13|india/chart|common/imgToken|common/inversebazi|gua/desc|user/check|common/time)\\t" "${SMOKE_OUT}" -S || true
fi
