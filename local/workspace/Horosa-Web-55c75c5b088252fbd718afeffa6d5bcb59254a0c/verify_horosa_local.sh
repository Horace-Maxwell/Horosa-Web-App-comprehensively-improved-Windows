#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
UI_DIR="${ROOT}/astrostudyui"
DIST_DIR="${UI_DIR}/dist-file"
SMOKE_IN="/private/tmp/horosa_endpoint_smoke.tsv"
SMOKE_OUT="/private/tmp/horosa_endpoint_smoke_after.tsv"
PD_VERIFY_JS="${UI_DIR}/scripts/verifyPrimaryDirectionRuntime.js"
PERF_VERIFY_JS="${UI_DIR}/scripts/verifyHorosaPerformanceRuntime.js"
FULL_VERIFY_JS="${UI_DIR}/scripts/verifyHorosaRuntimeFull.js"
PROJECT_ROOT="${ROOT}"
if [ ! -d "${PROJECT_ROOT}/scripts" ]; then
  PROJECT_ROOT="$(cd "${ROOT}/.." && pwd)"
fi
PD_VERIFY_PY="${PROJECT_ROOT}/scripts/check_primary_direction_astroapp_integration.py"
FULL_VERIFY_PY="${PROJECT_ROOT}/scripts/check_horosa_full_integration.py"
BROWSER_VERIFY_PY="${PROJECT_ROOT}/scripts/browser_horosa_master_check.py"
FINAL_LAYOUT_VERIFY_PY="${PROJECT_ROOT}/scripts/browser_horosa_final_layout_check.py"
CHART_PORT="${HOROSA_CHART_PORT:-8899}"
BACKEND_PORT="${HOROSA_SERVER_PORT:-9999}"
WEB_PORT="${HOROSA_WEB_PORT:-8000}"
TEMP_WEB_PID=""
export HOROSA_SERVER_ROOT="${HOROSA_SERVER_ROOT:-http://127.0.0.1:${BACKEND_PORT}}"

cleanup() {
  local code=$?
  if [ -n "${TEMP_WEB_PID}" ] && kill -0 "${TEMP_WEB_PID}" >/dev/null 2>&1; then
    kill "${TEMP_WEB_PID}" >/dev/null 2>&1 || true
    wait "${TEMP_WEB_PID}" >/dev/null 2>&1 || true
  fi
  exit "${code}"
}
trap cleanup EXIT INT TERM HUP

resolve_python_bin() {
  local candidate=""
  if [ -x "${PROJECT_ROOT}/.runtime/mac/venv/bin/python3" ]; then
    echo "${PROJECT_ROOT}/.runtime/mac/venv/bin/python3"
    return 0
  fi
  for candidate in python python3; do
    if ! command -v "${candidate}" >/dev/null 2>&1; then
      continue
    fi
    candidate="$(command -v "${candidate}")"
    case "${candidate}" in
      */WindowsApps/*)
        continue
        ;;
    esac
    echo "${candidate}"
    return 0
  done
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
    python \
    python3; do
    if [ -x "${candidate}" ] && python_has_playwright "${candidate}"; then
      echo "${candidate}"
      return 0
    fi
    if command -v "${candidate}" >/dev/null 2>&1; then
      candidate="$(command -v "${candidate}")"
      case "${candidate}" in
        */WindowsApps/*)
          continue
          ;;
      esac
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
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi

  local py_bin=""
  for candidate in python python3; do
    if ! command -v "${candidate}" >/dev/null 2>&1; then
      continue
    fi
    py_bin="$(command -v "${candidate}")"
    case "${py_bin}" in
      */WindowsApps/*)
        continue
        ;;
    esac
    break
  done
  if [ -z "${py_bin}" ]; then
    return 1
  fi

  "${py_bin}" - "${port}" <<'PY' >/dev/null 2>&1
import socket
import sys

port = int(sys.argv[1])
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(0.5)
try:
    sock.connect(("127.0.0.1", port))
except OSError:
    raise SystemExit(1)
finally:
    sock.close()
raise SystemExit(0)
PY
}

resolve_dist_dir() {
  if [ -f "${UI_DIR}/dist-file/index.html" ]; then
    DIST_DIR="${UI_DIR}/dist-file"
  else
    DIST_DIR="${UI_DIR}/dist"
  fi
}

ensure_browser_web_port() {
  local py_bin="$1"

  if port_listening "${WEB_PORT}"; then
    return 0
  fi

  resolve_dist_dir
  if [ ! -f "${DIST_DIR}/index.html" ]; then
    echo "browser smoke skipped: missing frontend entry ${DIST_DIR}/index.html."
    return 1
  fi

  echo "browser smoke: web ${WEB_PORT} not listening, starting temporary static server ..."
  nohup "${py_bin}" -m http.server "${WEB_PORT}" --bind 127.0.0.1 --directory "${DIST_DIR}" >/tmp/horosa_verify_web.log 2>&1 &
  TEMP_WEB_PID="$!"
  for _ in $(seq 1 20); do
    if port_listening "${WEB_PORT}"; then
      return 0
    fi
    sleep 0.2
  done

  echo "browser smoke skipped: failed to start temporary web ${WEB_PORT}."
  return 1
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
if [ -f ".tmp_horosa_verify.js" ]; then
  node .tmp_horosa_verify.js
fi
node "${PD_VERIFY_JS}"
node "${PERF_VERIFY_JS}"
node "${FULL_VERIFY_JS}"

PYTHON_BIN="$(resolve_python_bin)"
"${PYTHON_BIN}" "${PD_VERIFY_PY}"
"${PYTHON_BIN}" "${FULL_VERIFY_PY}"

if [ -f "${BROWSER_VERIFY_PY}" ] || [ -f "${FINAL_LAYOUT_VERIFY_PY}" ]; then
  if BROWSER_PYTHON_BIN="$(resolve_browser_python_bin 2>/dev/null)"; then
    if ensure_browser_web_port "${BROWSER_PYTHON_BIN}"; then
      if [ -f "${BROWSER_VERIFY_PY}" ]; then
        echo ""
        echo "browser smoke: ${BROWSER_VERIFY_PY}"
        HOROSA_WEB_PORT="${WEB_PORT}" \
        HOROSA_SERVER_PORT="${BACKEND_PORT}" \
        HOROSA_SERVER_ROOT="${HOROSA_SERVER_ROOT}" \
        "${BROWSER_PYTHON_BIN}" "${BROWSER_VERIFY_PY}"
      fi

      if [ -f "${FINAL_LAYOUT_VERIFY_PY}" ]; then
        echo ""
        echo "browser final layout: ${FINAL_LAYOUT_VERIFY_PY}"
        HOROSA_WEB_PORT="${WEB_PORT}" \
        HOROSA_SERVER_PORT="${BACKEND_PORT}" \
        HOROSA_SERVER_ROOT="${HOROSA_SERVER_ROOT}" \
        "${BROWSER_PYTHON_BIN}" "${FINAL_LAYOUT_VERIFY_PY}"
      fi
    fi
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
