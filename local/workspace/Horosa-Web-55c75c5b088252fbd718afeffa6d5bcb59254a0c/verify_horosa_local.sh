#!/usr/bin/env bash
set -euo pipefail
# [exit-guard] bash 3.2:set -u 因未赋值变量中止时,EXIT trap 里拿到的 $? 是 0(失败会被报成成功)。显式 exit 都经下面的
#   exit 记一笔;进 EXIT 时没记过 = 中止,按失败计。EXIT trap 一律写成 trap 'hx_on_exit <原处理>' EXIT(处理函数里读到的 $?
#   已是改判后的值);脚本末尾必须显式 exit。检查器 check_shell_exit_guard.py 机检。
HX_EXITED=0; exit(){ local _hx_s=$?; HX_EXITED=1; if [ "$#" -eq 0 ]; then builtin exit "${_hx_s}"; fi; builtin exit "$@"; }
hx_status(){ return "$1"; }
hx_on_exit(){ local _hx_r=$?; if [ "${_hx_r}" = "0" ] && [ "${HX_EXITED}" != "1" ]; then _hx_r=1; fi; set +e; hx_status "${_hx_r}"; "$@"; builtin exit "${_hx_r}"; }

ROOT="$(cd "$(dirname "$0")" && pwd)"
UI_DIR="${ROOT}/astrostudyui"
DIST_DIR="${UI_DIR}/dist-file"
SMOKE_IN="/private/tmp/horosa_endpoint_smoke.tsv"
SMOKE_OUT="/private/tmp/horosa_endpoint_smoke_after.tsv"
PD_VERIFY_JS="${UI_DIR}/scripts/verifyPrimaryDirectionRuntime.js"
PERF_VERIFY_JS="${UI_DIR}/scripts/verifyHorosaPerformanceRuntime.js"
FULL_VERIFY_JS="${UI_DIR}/scripts/verifyHorosaRuntimeFull.js"
PROJECT_ROOT="$(cd "${ROOT}/.." && pwd)"
PD_VERIFY_PY="${PROJECT_ROOT}/scripts/check_primary_direction_core_integration.py"
FULL_VERIFY_PY="${PROJECT_ROOT}/scripts/check_horosa_full_integration.py"
BROWSER_VERIFY_PY="${PROJECT_ROOT}/scripts/browser_horosa_master_check.py"
TOOLBAR_VERIFY_PY="${PROJECT_ROOT}/scripts/browser_horosa_toolbar_management_check.py"
FINAL_LAYOUT_VERIFY_PY="${PROJECT_ROOT}/scripts/browser_horosa_final_layout_check.py"
PD_BROWSER_VERIFY_PY="${PROJECT_ROOT}/scripts/browser_primary_direction_chart_guangde_check.py"
JINKOU_BROWSER_VERIFY_PY="${PROJECT_ROOT}/scripts/browser_horosa_jinkou_regression_check.py"
AI_ANALYSIS_BROWSER_VERIFY_PY="${PROJECT_ROOT}/scripts/browser_horosa_aianalysis_check.py"
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
trap 'hx_on_exit cleanup' EXIT; trap cleanup INT TERM HUP

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

file_mtime() {
  local path="$1"
  if [ -f "${path}" ]; then
    # horosa_web_portable_stat_v1:BSD(-f,macOS)优先,GNU(-c,Linux/Git Bash)回退 ——
    # 此前 Git Bash 下恒回 0(freshness 永远判旧),现在两端都取真 mtime。
    stat -f "%m" "${path}" 2>/dev/null || stat -c "%Y" "${path}" 2>/dev/null || echo 0
  else
    echo 0
  fi
}

kill_tree() {
  local pid="$1"
  local child=""
  for child in $(pgrep -P "${pid}" 2>/dev/null || true); do
    kill_tree "${child}"
  done
  kill "${pid}" >/dev/null 2>&1 || true
}

run_browser_python_check() {
  local label="$1"
  local script_path="$2"
  local json_path="$3"
  local log_path="/tmp/$(basename "${script_path}").log"
  local before_mtime=""
  local after_mtime=""
  local pid=""
  local saw_output=0
  local status=""

  before_mtime="$(file_mtime "${json_path}")"
  rm -f "${log_path}"

  HOROSA_WEB_PORT="${WEB_PORT}" \
  HOROSA_SERVER_PORT="${BACKEND_PORT}" \
  HOROSA_SERVER_ROOT="${HOROSA_SERVER_ROOT}" \
  "${BROWSER_PYTHON_BIN}" "${script_path}" >"${log_path}" 2>&1 &
  pid="$!"

  for _ in $(seq 1 240); do
    after_mtime="$(file_mtime "${json_path}")"
    if [ "${after_mtime}" -gt "${before_mtime}" ]; then
      saw_output=1
      break
    fi
    if ! kill -0 "${pid}" >/dev/null 2>&1; then
      wait "${pid}"
      return $?
    fi
    sleep 1
  done

  if [ "${saw_output}" != "1" ]; then
    echo "${label} failed: no fresh JSON output from ${script_path}."
    tail -n 80 "${log_path}" 2>/dev/null || true
    if kill -0 "${pid}" >/dev/null 2>&1; then
      kill_tree "${pid}"
      wait "${pid}" >/dev/null 2>&1 || true
    fi
    return 1
  fi

  if kill -0 "${pid}" >/dev/null 2>&1; then
    kill_tree "${pid}"
    wait "${pid}" >/dev/null 2>&1 || true
  fi

  status="$("${PYTHON_BIN}" - <<'PY' "${json_path}"
import json, sys
path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as fh:
    data = json.load(fh)
print(data.get('status', 'missing'))
raise SystemExit(0 if data.get('status') == 'ok' else 1)
PY
)"
  local status_rc=$?
  echo "${label}: ${status} (${json_path})"
  if [ "${status_rc}" -ne 0 ]; then
    tail -n 80 "${log_path}" 2>/dev/null || true
    return "${status_rc}"
  fi
  return 0
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
  local candidate=""

  resolve_dist_dir
  if [ ! -f "${DIST_DIR}/index.html" ]; then
    echo "browser smoke skipped: missing frontend entry ${DIST_DIR}/index.html."
    return 1
  fi

  web_port_healthy() {
    local port="$1"
    "${py_bin}" - <<'PY' "${port}"
import sys
import urllib.request

port = sys.argv[1]
try:
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/index.html", timeout=3) as resp:
        body = resp.read(4096)
    raise SystemExit(0 if b"root" in body or b"umi" in body else 1)
except Exception:
    raise SystemExit(1)
PY
  }

  if port_listening "${WEB_PORT}"; then
    if web_port_healthy "${WEB_PORT}"; then
      return 0
    fi
    echo "browser smoke: web ${WEB_PORT} is listening but did not serve Horosa index.html; selecting a temporary port ..."
    for candidate in $(seq 8001 8020); do
      if ! port_listening "${candidate}"; then
        WEB_PORT="${candidate}"
        break
      fi
    done
    if port_listening "${WEB_PORT}"; then
      echo "browser smoke skipped: no free fallback web port in 8001-8020."
      return 1
    fi
  fi

  echo "browser smoke: web ${WEB_PORT} not listening, starting temporary static server ..."
  nohup "${py_bin}" -m http.server "${WEB_PORT}" --bind 127.0.0.1 --directory "${DIST_DIR}" >/tmp/horosa_verify_web.log 2>&1 &
  TEMP_WEB_PID="$!"
  for _ in $(seq 1 20); do
    if port_listening "${WEB_PORT}" && web_port_healthy "${WEB_PORT}"; then
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
node .tmp_horosa_verify.js
node "${PD_VERIFY_JS}"
node "${PERF_VERIFY_JS}"
node "${FULL_VERIFY_JS}"

PYTHON_BIN="$(resolve_python_bin)"
"${PYTHON_BIN}" "${PD_VERIFY_PY}"
"${PYTHON_BIN}" "${FULL_VERIFY_PY}"

if [ -f "${BROWSER_VERIFY_PY}" ] || [ -f "${TOOLBAR_VERIFY_PY}" ] || [ -f "${FINAL_LAYOUT_VERIFY_PY}" ] || [ -f "${PD_BROWSER_VERIFY_PY}" ] || [ -f "${JINKOU_BROWSER_VERIFY_PY}" ] || [ -f "${AI_ANALYSIS_BROWSER_VERIFY_PY}" ]; then
  if BROWSER_PYTHON_BIN="$(resolve_browser_python_bin 2>/dev/null)"; then
    if ensure_browser_web_port "${BROWSER_PYTHON_BIN}"; then
      if [ -f "${BROWSER_VERIFY_PY}" ]; then
        echo ""
        echo "browser smoke: ${BROWSER_VERIFY_PY}"
        run_browser_python_check "browser smoke" "${BROWSER_VERIFY_PY}" "${PROJECT_ROOT}/runtime/browser_horosa_master_check.json"
      fi

      if [ -f "${TOOLBAR_VERIFY_PY}" ]; then
        echo ""
        echo "browser toolbar/management: ${TOOLBAR_VERIFY_PY}"
        run_browser_python_check "browser toolbar/management" "${TOOLBAR_VERIFY_PY}" "${PROJECT_ROOT}/runtime/browser_horosa_toolbar_management_check.json"
      fi

      if [ -f "${FINAL_LAYOUT_VERIFY_PY}" ]; then
        echo ""
        echo "browser final layout: ${FINAL_LAYOUT_VERIFY_PY}"
        run_browser_python_check "browser final layout" "${FINAL_LAYOUT_VERIFY_PY}" "${PROJECT_ROOT}/runtime/final_layout_master_check.json"
      fi

      if [ -f "${PD_BROWSER_VERIFY_PY}" ]; then
        echo ""
        echo "browser primary direction detail: ${PD_BROWSER_VERIFY_PY}"
        run_browser_python_check "browser primary direction detail" "${PD_BROWSER_VERIFY_PY}" "${PROJECT_ROOT}/runtime/browser_primary_direction_chart_guangde_check.json"
      fi

      if [ -f "${JINKOU_BROWSER_VERIFY_PY}" ]; then
        echo ""
        echo "browser jinkou regression: ${JINKOU_BROWSER_VERIFY_PY}"
        run_browser_python_check "browser jinkou regression" "${JINKOU_BROWSER_VERIFY_PY}" "${PROJECT_ROOT}/runtime/browser_horosa_jinkou_regression_check.json"
      fi

      if [ -f "${AI_ANALYSIS_BROWSER_VERIFY_PY}" ]; then
        echo ""
        echo "browser AI analysis e2e: ${AI_ANALYSIS_BROWSER_VERIFY_PY}"
        run_browser_python_check "browser AI analysis e2e" "${AI_ANALYSIS_BROWSER_VERIFY_PY}" "${PROJECT_ROOT}/runtime/browser_horosa_aianalysis_check.json"
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
exit 0
