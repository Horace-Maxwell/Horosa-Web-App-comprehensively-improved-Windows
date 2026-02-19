#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_ROOT="${HOROSA_LOG_ROOT:-${ROOT}/.horosa-local-logs}"
RUN_TAG="$(date +%Y%m%d_%H%M%S)"
LOG_DIR="${LOG_ROOT}/${RUN_TAG}"
PY_PID_FILE="${ROOT}/.horosa_py.pid"
JAVA_PID_FILE="${ROOT}/.horosa_java.pid"
PY_LOG="${LOG_DIR}/astropy.log"
JAVA_LOG="${LOG_DIR}/astrostudyboot.log"
HTML_PATH="${ROOT}/astrostudyui/dist-file/index.html"
PYTHON_BIN="${HOROSA_PYTHON:-python3}"
PYTHONPATH_ASTRO="${ROOT}/astropy"
EXTRA_PY_SITE="${HOME}/Library/Python/3.12/lib/python/site-packages"

if [ ! -f "${HTML_PATH}" ]; then
  HTML_PATH="${ROOT}/astrostudyui/dist/index.html"
fi

mkdir -p "${LOG_DIR}"

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

if [ -f "${PY_PID_FILE}" ] || [ -f "${JAVA_PID_FILE}" ]; then
  echo "pid files already exist with running processes. run ./stop_horosa_local.sh first."
  exit 1
fi

if port_listening 8899; then
  echo "port 8899 is already in use."
  exit 1
fi
if port_listening 9999; then
  echo "port 9999 is already in use."
  exit 1
fi

JAR="${ROOT}/astrostudysrv/astrostudyboot/target/astrostudyboot.jar"
if [ ! -f "${JAR}" ]; then
  echo "missing ${JAR}"
  echo "build first:"
  echo "  cd astrostudysrv/image && mvn -DskipTests install"
  echo "  cd ../astrostudyboot && mvn -DskipTests clean install"
  exit 1
fi

if [ -d "${EXTRA_PY_SITE}" ]; then
  PYTHONPATH_ASTRO="${PYTHONPATH_ASTRO}:${EXTRA_PY_SITE}"
fi
if [ -n "${PYTHONPATH:-}" ]; then
  PYTHONPATH_ASTRO="${PYTHONPATH_ASTRO}:${PYTHONPATH}"
fi

if ! command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
  echo "python runtime not found: ${PYTHON_BIN}"
  echo "set HOROSA_PYTHON to a valid interpreter if needed."
  exit 1
fi

if ! PYTHONPATH="${PYTHONPATH_ASTRO}" "${PYTHON_BIN}" - <<'PY' >/dev/null 2>&1
import cherrypy
PY
then
  echo "python runtime cannot import cherrypy: ${PYTHON_BIN}"
  echo "checked extra site-packages: ${EXTRA_PY_SITE}"
  echo "set HOROSA_PYTHON to an interpreter with cherrypy installed."
  exit 1
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

cd "${ROOT}"
PYTHONPATH="${PYTHONPATH_ASTRO}" "${PYTHON_BIN}" "${ROOT}/astropy/websrv/webchartsrv.py" >"${PY_LOG}" 2>&1 &
echo $! > "${PY_PID_FILE}"

java -jar "${JAR}" \
  --astrosrv=http://127.0.0.1:8899 \
  --mongodb.ip=127.0.0.1 \
  --redis.ip=127.0.0.1 >"${JAVA_LOG}" 2>&1 &
echo $! > "${JAVA_PID_FILE}"

ready=0
for _ in $(seq 1 60); do
  if ! kill -0 "$(cat "${PY_PID_FILE}")" >/dev/null 2>&1; then
    echo "astropy process exited during startup."
    break
  fi
  if ! kill -0 "$(cat "${JAVA_PID_FILE}")" >/dev/null 2>&1; then
    echo "astrostudyboot process exited during startup."
    break
  fi

  if port_listening 8899 && port_listening 9999; then
    ready=1
    break
  fi
  sleep 1
done

if [ "${ready}" -ne 1 ]; then
  echo "services did not become ready in time (need both 8899 and 9999)."
  echo "--- python log tail ---"
  tail -n 40 "${PY_LOG}" || true
  echo "--- java log tail ---"
  tail -n 40 "${JAVA_LOG}" || true
  exit 1
fi

trap - EXIT

echo "services are ready."
echo "backend:  http://127.0.0.1:9999"
echo "chartpy:  http://127.0.0.1:8899"
echo "html:     ${HTML_PATH}"
echo "logs:     ${LOG_DIR}"
echo ""
echo "stop:     ${ROOT}/stop_horosa_local.sh"
