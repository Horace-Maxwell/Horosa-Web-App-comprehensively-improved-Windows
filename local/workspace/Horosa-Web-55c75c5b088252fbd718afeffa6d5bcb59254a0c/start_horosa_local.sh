#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_ROOT="${HOROSA_LOG_ROOT:-${ROOT}/.horosa-local-logs}"
RUN_TAG="$(date +%Y%m%d_%H%M%S)"
LOG_DIR="${LOG_ROOT}/${RUN_TAG}"
PY_PID_FILE="${ROOT}/.horosa_py.pid"
JAVA_PID_FILE="${ROOT}/.horosa_java.pid"
UI_DIR="${ROOT}/astrostudyui"
PY_LOG="${LOG_DIR}/astropy.log"
JAVA_LOG="${LOG_DIR}/astrostudyboot.log"
HTML_PATH="${UI_DIR}/dist-file/index.html"
PYTHON_BIN="${HOROSA_PYTHON:-python3}"
JAVA_BIN="${HOROSA_JAVA_BIN:-java}"
PYTHONPATH_ASTRO="${ROOT}/astropy"
EXTRA_PY_SITE=""
STARTUP_TIMEOUT="${HOROSA_STARTUP_TIMEOUT:-180}"
SKIP_UI_BUILD="${HOROSA_SKIP_UI_BUILD:-0}"
SKIP_RUNTIME_WARMUP="${HOROSA_SKIP_RUNTIME_WARMUP:-0}"
CHART_PORT="${HOROSA_CHART_PORT:-8899}"
BACKEND_PORT="${HOROSA_SERVER_PORT:-9999}"
ROOT_PARENT="$(cd "${ROOT}/.." && pwd)"
DIAG_DIR="${HOROSA_DIAG_DIR:-${ROOT_PARENT}/diagnostics}"
DIAG_FILE="${HOROSA_DIAG_FILE:-${DIAG_DIR}/horosa-run-issues.log}"

if [ -z "${HOROSA_PYTHON:-}" ] && [ -x "${ROOT_PARENT}/.runtime/mac/venv/bin/python3" ]; then
  PYTHON_BIN="${ROOT_PARENT}/.runtime/mac/venv/bin/python3"
fi
if [ -z "${HOROSA_JAVA_BIN:-}" ] && [ -x "${ROOT_PARENT}/runtime/mac/java/bin/java" ]; then
  JAVA_BIN="${ROOT_PARENT}/runtime/mac/java/bin/java"
fi

if [ ! -f "${HTML_PATH}" ]; then
  HTML_PATH="${UI_DIR}/dist/index.html"
fi

mkdir -p "${LOG_DIR}"
mkdir -p "${DIAG_DIR}"
mkdir -p "$(dirname "${DIAG_FILE}")"

diag_log() {
  local msg="$1"
  printf '[%s] [start_horosa_local] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${msg}" >>"${DIAG_FILE}" 2>/dev/null || true
}

diag_tail() {
  local file="$1"
  local lines="${2:-80}"
  if [ ! -f "${file}" ]; then
    return
  fi
  diag_log "tail ${lines} lines: ${file}"
  while IFS= read -r line; do
    printf '[%s] [tail] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${line}" >>"${DIAG_FILE}" 2>/dev/null || true
  done < <(tail -n "${lines}" "${file}" 2>/dev/null || true)
}

diag_log "===== run begin pid=$$ cwd=${ROOT} ====="
diag_log "startup_timeout=${STARTUP_TIMEOUT} skip_ui_build=${SKIP_UI_BUILD} chart_port=${CHART_PORT} backend_port=${BACKEND_PORT} log_dir=${LOG_DIR}"

cleanup_stale_pid_file() {
  local pid_file="$1"
  if [ ! -f "${pid_file}" ]; then
    return
  fi
  local pid
  pid="$(cat "${pid_file}")"
  if [ -z "${pid}" ] || ! kill -0 "${pid}" >/dev/null 2>&1; then
    rm -f "${pid_file}"
  fi
}

cleanup_stale_pid_file "${PY_PID_FILE}"
cleanup_stale_pid_file "${JAVA_PID_FILE}"

port_listening() {
  local port="$1"
  lsof -tiTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

http_responding() {
  local url="$1"
  if ! command -v curl >/dev/null 2>&1; then
    return 0
  fi
  local code
  code="$(curl -s -o /dev/null -m 2 -w '%{http_code}' "${url}" || true)"
  if [ -z "${code}" ] || [ "${code}" = "000" ]; then
    return 1
  fi
  return 0
}

warm_runtime_routes() {
  local warmup_js="${UI_DIR}/scripts/warmHorosaRuntime.js"
  local warmup_log="${LOG_DIR}/runtime-warmup.log"

  if [ "${SKIP_RUNTIME_WARMUP}" = "1" ]; then
    diag_log "runtime warmup skipped by env"
    return 0
  fi
  if [ ! -f "${warmup_js}" ]; then
    diag_log "runtime warmup script missing: ${warmup_js}"
    return 0
  fi
  if ! command -v node >/dev/null 2>&1; then
    diag_log "runtime warmup skipped: node missing"
    return 0
  fi

  diag_log "runtime warmup begin"
  if HOROSA_SERVER_ROOT="http://127.0.0.1:${BACKEND_PORT}" node "${warmup_js}" >"${warmup_log}" 2>&1; then
    diag_log "runtime warmup done"
  else
    diag_log "runtime warmup failed"
    diag_tail "${warmup_log}" 120
  fi
}

load_brew_env() {
  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

detect_brew_java_home() {
  local formula=""
  local prefix=""
  local candidate=""

  load_brew_env
  if command -v brew >/dev/null 2>&1; then
    for formula in openjdk@17 openjdk; do
      if brew list --formula "${formula}" >/dev/null 2>&1; then
        prefix="$(brew --prefix "${formula}" 2>/dev/null || true)"
        candidate="${prefix}/libexec/openjdk.jdk/Contents/Home"
        if [ -x "${candidate}/bin/java" ]; then
          echo "${candidate}"
          return 0
        fi
      fi
    done
  fi

  for candidate in \
    /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
    /usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
    /opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home \
    /usr/local/opt/openjdk/libexec/openjdk.jdk/Contents/Home; do
    if [ -x "${candidate}/bin/java" ]; then
      echo "${candidate}"
      return 0
    fi
  done

  return 1
}

java_bin_ready() {
  local java_bin="$1"
  if [ ! -x "${java_bin}" ]; then
    return 1
  fi
  "${java_bin}" -version >/dev/null 2>&1
}

resolve_java_bin() {
  local java_home=""
  local resolved_bin=""

  if java_bin_ready "${JAVA_BIN}"; then
    return 0
  fi

  if command -v "${JAVA_BIN}" >/dev/null 2>&1; then
    resolved_bin="$(command -v "${JAVA_BIN}")"
    if java_bin_ready "${resolved_bin}"; then
      JAVA_BIN="${resolved_bin}"
      return 0
    fi
  fi

  if [ -n "${JAVA_HOME:-}" ] && java_bin_ready "${JAVA_HOME}/bin/java"; then
    JAVA_BIN="${JAVA_HOME}/bin/java"
    export PATH="${JAVA_HOME}/bin:${PATH}"
    return 0
  fi

  if command -v /usr/libexec/java_home >/dev/null 2>&1; then
    java_home="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
    if [ -n "${java_home}" ] && java_bin_ready "${java_home}/bin/java"; then
      export JAVA_HOME="${java_home}"
      export PATH="${JAVA_HOME}/bin:${PATH}"
      JAVA_BIN="${JAVA_HOME}/bin/java"
      return 0
    fi
  fi

  java_home="$(detect_brew_java_home 2>/dev/null || true)"
  if [ -n "${java_home}" ] && java_bin_ready "${java_home}/bin/java"; then
    export JAVA_HOME="${java_home}"
    export PATH="${JAVA_HOME}/bin:${PATH}"
    JAVA_BIN="${JAVA_HOME}/bin/java"
    return 0
  fi

  if command -v java >/dev/null 2>&1; then
    resolved_bin="$(command -v java)"
    if java_bin_ready "${resolved_bin}"; then
      JAVA_BIN="${resolved_bin}"
      return 0
    fi
  fi

  return 1
}

python_runtime_ready() {
  local py_bin="$1"
  local py_minor=""
  local extra_site=""
  local py_path="${PYTHONPATH_ASTRO}"

  if [ ! -x "${py_bin}" ]; then
    return 1
  fi

  py_minor="$("${py_bin}" - <<'PY'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}")
PY
)" || return 1

  extra_site="${HOME}/Library/Python/${py_minor}/lib/python/site-packages"
  if [ -d "${extra_site}" ]; then
    py_path="${py_path}:${extra_site}"
  fi
  if [ -n "${PYTHONPATH:-}" ]; then
    py_path="${py_path}:${PYTHONPATH}"
  fi

  PYTHONPATH="${py_path}" "${py_bin}" - <<'PY' >/dev/null 2>&1
import importlib.util as iu
mods = ("cherrypy", "jsonpickle", "swisseph")
missing = [m for m in mods if iu.find_spec(m) is None]
raise SystemExit(1 if missing else 0)
PY
}

resolve_python_bin() {
  local root_parent=""
  local candidate=""
  local resolved=""

  root_parent="$(cd "${ROOT}/.." && pwd)"
  local candidates=(
    "${PYTHON_BIN}"
    "${root_parent}/.runtime/mac/venv/bin/python3"
    "${root_parent}/runtime/mac/python/bin/python3"
  )

  if command -v python3 >/dev/null 2>&1; then
    candidates+=("$(command -v python3)")
  fi
  if command -v python >/dev/null 2>&1; then
    candidates+=("$(command -v python)")
  fi

  for candidate in "${candidates[@]}"; do
    if [ -z "${candidate}" ]; then
      continue
    fi

    resolved="${candidate}"
    if [ ! -x "${resolved}" ]; then
      if command -v "${resolved}" >/dev/null 2>&1; then
        resolved="$(command -v "${resolved}")"
      else
        continue
      fi
    fi

    if python_runtime_ready "${resolved}"; then
      PYTHON_BIN="${resolved}"
      return 0
    fi
  done

  return 1
}

frontend_needs_build() {
  local dist_index="${UI_DIR}/dist-file/index.html"
  if [ ! -f "${dist_index}" ]; then
    return 0
  fi
  if [ -n "$(find "${UI_DIR}/src" -type f -newer "${dist_index}" -print -quit 2>/dev/null)" ]; then
    return 0
  fi
  if [ -d "${UI_DIR}/public" ] && [ -n "$(find "${UI_DIR}/public" -type f -newer "${dist_index}" -print -quit 2>/dev/null)" ]; then
    return 0
  fi
  if [ -f "${UI_DIR}/package.json" ] && [ "${UI_DIR}/package.json" -nt "${dist_index}" ]; then
    return 0
  fi
  if [ -f "${UI_DIR}/.umirc.js" ] && [ "${UI_DIR}/.umirc.js" -nt "${dist_index}" ]; then
    return 0
  fi
  if [ -f "${UI_DIR}/.umirc.ts" ] && [ "${UI_DIR}/.umirc.ts" -nt "${dist_index}" ]; then
    return 0
  fi
  return 1
}

ensure_frontend_build() {
  local dist_file_index="${UI_DIR}/dist-file/index.html"
  local dist_index="${UI_DIR}/dist/index.html"

  if [ "${SKIP_UI_BUILD}" = "1" ]; then
    if [ -f "${dist_file_index}" ]; then
      HTML_PATH="${dist_file_index}"
      return
    fi
    if [ -f "${dist_index}" ]; then
      HTML_PATH="${dist_index}"
      return
    fi
    echo "missing frontend index.html under ${UI_DIR}/dist-file or ${UI_DIR}/dist."
    echo "HOROSA_SKIP_UI_BUILD=1 is set, but no prebuilt frontend bundle is available."
    exit 1
  fi

  if frontend_needs_build; then
    if ! command -v npm >/dev/null 2>&1; then
      if [ -f "${dist_file_index}" ] || [ -f "${dist_index}" ]; then
        echo "warning: frontend source changed but npm is unavailable; using existing bundle."
      else
        echo "missing frontend bundle and npm is unavailable."
        exit 1
      fi
    else
      echo "frontend source changed, rebuilding dist-file ..."
      (
        cd "${UI_DIR}"
        if [ ! -d node_modules ]; then
          npm install --legacy-peer-deps
        fi
        npm run build:file
      )
    fi
  fi

  if [ -f "${dist_file_index}" ]; then
    HTML_PATH="${dist_file_index}"
  elif [ -f "${dist_index}" ]; then
    HTML_PATH="${dist_index}"
  else
    echo "missing frontend index.html under ${UI_DIR}/dist-file or ${UI_DIR}/dist."
    exit 1
  fi
}

if [ -f "${PY_PID_FILE}" ] || [ -f "${JAVA_PID_FILE}" ]; then
  diag_log "blocked: pid files already exist"
  echo "pid files already exist with running processes. run ./stop_horosa_local.sh first."
  exit 1
fi

if ! [[ "${STARTUP_TIMEOUT}" =~ ^[0-9]+$ ]] || [ "${STARTUP_TIMEOUT}" -lt 30 ]; then
  STARTUP_TIMEOUT=180
fi

if port_listening "${CHART_PORT}"; then
  diag_log "blocked: port ${CHART_PORT} already in use"
  echo "port ${CHART_PORT} is already in use."
  exit 1
fi
if port_listening "${BACKEND_PORT}"; then
  diag_log "blocked: port ${BACKEND_PORT} already in use"
  echo "port ${BACKEND_PORT} is already in use."
  exit 1
fi

ensure_frontend_build

JAR="${ROOT}/astrostudysrv/astrostudyboot/target/astrostudyboot.jar"
BUNDLE_JAR="${ROOT}/../runtime/mac/bundle/astrostudyboot.jar"
if [ ! -f "${JAR}" ] && [ -f "${BUNDLE_JAR}" ]; then
  diag_log "target jar missing, fallback to bundled jar: ${BUNDLE_JAR}"
  echo "backend target jar missing, using bundled jar fallback."
  mkdir -p "$(dirname "${JAR}")"
  cp -f "${BUNDLE_JAR}" "${JAR}"
fi
if [ ! -f "${JAR}" ]; then
  diag_log "missing jar after fallback: ${JAR}"
  echo "missing ${JAR}"
  echo "请先回到仓库根目录执行："
  echo "  ../Horosa_OneClick_Mac.command"
  echo "高级离线打包工具："
  echo "  ../tools/mac/Prepare_Runtime_Mac.command"
  exit 1
fi

if ! resolve_java_bin; then
  diag_log "java resolve failed: ${JAVA_BIN}"
  echo "java runtime not found: ${JAVA_BIN}"
  echo "install java 17+ or run ../Horosa_OneClick_Mac.command"
  exit 1
fi
diag_log "java resolved: ${JAVA_BIN}"

if ! resolve_python_bin; then
  diag_log "python resolve failed: ${PYTHON_BIN}"
  echo "python runtime not ready: ${PYTHON_BIN}"
  echo "install runtime deps or run ../Horosa_OneClick_Mac.command"
  exit 1
fi
diag_log "python resolved: ${PYTHON_BIN}"

PY_MINOR="$("${PYTHON_BIN}" - <<'PY'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}")
PY
)"
EXTRA_PY_SITE="${HOME}/Library/Python/${PY_MINOR}/lib/python/site-packages"

if [ -d "${EXTRA_PY_SITE}" ]; then
  PYTHONPATH_ASTRO="${PYTHONPATH_ASTRO}:${EXTRA_PY_SITE}"
fi
if [ -n "${PYTHONPATH:-}" ]; then
  PYTHONPATH_ASTRO="${PYTHONPATH_ASTRO}:${PYTHONPATH}"
fi

cleanup_on_fail() {
  local code=$?
  if [ "${code}" -ne 0 ]; then
    if [ -f "${JAVA_PID_FILE}" ]; then
      kill "$(cat "${JAVA_PID_FILE}")" >/dev/null 2>&1 || true
      rm -f "${JAVA_PID_FILE}"
    fi
    if [ -f "${PY_PID_FILE}" ]; then
      kill "$(cat "${PY_PID_FILE}")" >/dev/null 2>&1 || true
      rm -f "${PY_PID_FILE}"
    fi
  fi
  return "${code}"
}
trap cleanup_on_fail EXIT

launch_detached() {
  local log_file="$1"
  shift
  "${PYTHON_BIN}" - "${log_file}" "$@" <<'PY'
import subprocess
import sys

log_path = sys.argv[1]
cmd = sys.argv[2:]

with open(log_path, "ab", buffering=0) as fh:
    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.DEVNULL,
        stdout=fh,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        close_fds=True,
    )

print(proc.pid)
PY
}

cd "${ROOT}"
launch_detached "${PY_LOG}" env PYTHONPATH="${PYTHONPATH_ASTRO}" HOROSA_CHART_PORT="${CHART_PORT}" "${PYTHON_BIN}" "${ROOT}/astropy/websrv/webchartsrv.py" >"${PY_PID_FILE}"

launch_detached "${JAVA_LOG}" "${JAVA_BIN}" -jar "${JAR}" \
  --server.port="${BACKEND_PORT}" \
  --astrosrv=http://127.0.0.1:${CHART_PORT} \
  --mongodb.ip=127.0.0.1 \
  --redis.ip=127.0.0.1 >"${JAVA_PID_FILE}"

ready=0
for _ in $(seq 1 "${STARTUP_TIMEOUT}"); do
  if ! kill -0 "$(cat "${PY_PID_FILE}")" >/dev/null 2>&1; then
    echo "astropy process exited during startup."
    break
  fi
  if ! kill -0 "$(cat "${JAVA_PID_FILE}")" >/dev/null 2>&1; then
    echo "astrostudyboot process exited during startup."
    break
  fi

  if port_listening "${CHART_PORT}" && port_listening "${BACKEND_PORT}"; then
    if http_responding "http://127.0.0.1:${CHART_PORT}/" && http_responding "http://127.0.0.1:${BACKEND_PORT}/common/time"; then
      ready=1
      break
    fi
  fi
  if [ $((_ % 10)) -eq 0 ]; then
    echo "waiting services... ${_}/${STARTUP_TIMEOUT}s (${CHART_PORT}:$(port_listening "${CHART_PORT}" && echo up || echo down), ${BACKEND_PORT}:$(port_listening "${BACKEND_PORT}" && echo up || echo down))"
  fi
  sleep 1
done

if [ "${ready}" -ne 1 ]; then
  diag_log "startup timeout after ${STARTUP_TIMEOUT}s"
  echo "services did not become ready in ${STARTUP_TIMEOUT}s (need both ${CHART_PORT} and ${BACKEND_PORT})."
  echo "tip: increase timeout by setting HOROSA_STARTUP_TIMEOUT=300 if this machine is slow on first run."
  echo "--- python log tail ---"
  tail -n 40 "${PY_LOG}" || true
  echo "--- java log tail ---"
  tail -n 40 "${JAVA_LOG}" || true
  diag_tail "${PY_LOG}" 120
  diag_tail "${JAVA_LOG}" 120
  diag_log "===== run end (failed) ====="
  exit 1
fi

trap - EXIT
warm_runtime_routes

diag_log "services ready: backend=${BACKEND_PORT} chartpy=${CHART_PORT}"
diag_log "===== run end (success) ====="

echo "services are ready."
echo "backend:  http://127.0.0.1:${BACKEND_PORT}"
echo "chartpy:  http://127.0.0.1:${CHART_PORT}"
echo "html:     ${HTML_PATH}"
echo "logs:     ${LOG_DIR}"
echo ""
echo "stop:     ${ROOT}/stop_horosa_local.sh"
