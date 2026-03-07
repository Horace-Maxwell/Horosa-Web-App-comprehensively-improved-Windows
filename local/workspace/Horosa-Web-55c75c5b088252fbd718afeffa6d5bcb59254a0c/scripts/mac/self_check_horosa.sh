#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT_DIR="${ROOT}"
if [ -d "${ROOT}/Horosa-Web" ]; then
  PROJECT_DIR="${ROOT}/Horosa-Web"
fi
START_CMD="${ROOT}/Horosa_Local.command"
if [ ! -x "${START_CMD}" ] && [ -x "${PROJECT_DIR}/horosa_local.command" ]; then
  START_CMD="${PROJECT_DIR}/horosa_local.command"
fi
VERIFY_SH="${PROJECT_DIR}/verify_horosa_local.sh"
STOP_SH="${PROJECT_DIR}/stop_horosa_local.sh"

STARTED_HERE=0
STOP_ON_EXIT_SPECIFIED=0
if [ -n "${HOROSA_SELF_CHECK_STOP_AT_END+x}" ]; then
  STOP_ON_EXIT="${HOROSA_SELF_CHECK_STOP_AT_END}"
  STOP_ON_EXIT_SPECIFIED=1
else
  STOP_ON_EXIT=0
fi
CHART_PORT="${HOROSA_CHART_PORT:-8899}"
BACKEND_PORT="${HOROSA_SERVER_PORT:-9999}"
WEB_PORT="${HOROSA_WEB_PORT:-8000}"
AUTO_ALT_PORTS=0

port_listening() {
  local port="$1"
  lsof -tiTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

port_listener_pids() {
  local port="$1"
  lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null | sort -u || true
}

process_command() {
  local pid="$1"
  ps -p "${pid}" -o command= 2>/dev/null || true
}

port_owned_by_root() {
  local port="$1"
  local pid=""
  local cmd=""
  local pids
  pids="$(port_listener_pids "${port}")"
  if [ -z "${pids}" ]; then
    return 1
  fi
  for pid in ${pids}; do
    cmd="$(process_command "${pid}")"
    if [ -n "${cmd}" ] && printf '%s\n' "${cmd}" | grep -Fq "${ROOT}"; then
      return 0
    fi
  done
  return 1
}

find_free_port() {
  local port="$1"
  while port_listening "${port}"; do
    port=$((port + 1))
  done
  echo "${port}"
}

prepare_ports() {
  if port_listening "${CHART_PORT}" && ! port_owned_by_root "${CHART_PORT}"; then
    CHART_PORT="$(find_free_port 18899)"
    AUTO_ALT_PORTS=1
  fi
  if port_listening "${BACKEND_PORT}" && ! port_owned_by_root "${BACKEND_PORT}"; then
    BACKEND_PORT="$(find_free_port 19999)"
    AUTO_ALT_PORTS=1
  fi
  if port_listening "${WEB_PORT}" && ! port_owned_by_root "${WEB_PORT}"; then
    WEB_PORT="$(find_free_port 18000)"
    AUTO_ALT_PORTS=1
  fi

  if [ "${AUTO_ALT_PORTS}" = "1" ] && [ "${STOP_ON_EXIT_SPECIFIED}" = "0" ]; then
    STOP_ON_EXIT=1
  fi

  export HOROSA_CHART_PORT="${CHART_PORT}"
  export HOROSA_SERVER_PORT="${BACKEND_PORT}"
  export HOROSA_WEB_PORT="${WEB_PORT}"
  export HOROSA_SERVER_ROOT="http://127.0.0.1:${BACKEND_PORT}"
}

cleanup() {
  local code=$?
  if [ "${STARTED_HERE}" = "1" ] && [ "${STOP_ON_EXIT}" = "1" ]; then
    "${STOP_SH}" >/dev/null 2>&1 || true
  fi
  exit "${code}"
}
trap cleanup EXIT INT TERM HUP

prepare_ports

if [ ! -x "${START_CMD}" ]; then
  echo "[Horosa self-check] missing start command: ${START_CMD}" >&2
  exit 1
fi
if [ ! -x "${VERIFY_SH}" ]; then
  echo "[Horosa self-check] missing verify script: ${VERIFY_SH}" >&2
  exit 1
fi

if ! port_listening "${CHART_PORT}" || ! port_listening "${BACKEND_PORT}" || ! port_owned_by_root "${CHART_PORT}" || ! port_owned_by_root "${BACKEND_PORT}"; then
  echo "[Horosa self-check] starting local services ..."
  if [ "${AUTO_ALT_PORTS}" = "1" ]; then
    echo "[Horosa self-check] selected alternate ports: chart=${CHART_PORT} backend=${BACKEND_PORT} web=${WEB_PORT}"
  fi
  STARTED_HERE=1
  HOROSA_NO_BROWSER=1 \
  HOROSA_KEEP_SERVICES_RUNNING=1 \
  HOROSA_SKIP_DB_SETUP="${HOROSA_SKIP_DB_SETUP:-1}" \
  HOROSA_STARTUP_TIMEOUT="${HOROSA_STARTUP_TIMEOUT:-300}" \
  "${START_CMD}"
else
  echo "[Horosa self-check] using already-running local services on chart=${CHART_PORT} backend=${BACKEND_PORT}."
fi

echo "[Horosa self-check] running verification ..."
"${VERIFY_SH}"
if [ "${STARTED_HERE}" = "1" ]; then
  if [ "${STOP_ON_EXIT}" = "1" ]; then
    echo "[Horosa self-check] verification finished; services will be stopped on exit."
  else
    echo "[Horosa self-check] verification finished; services started by this check will remain running."
    echo "[Horosa self-check] stop manually if needed: ${STOP_SH}"
  fi
fi
echo "[Horosa self-check] success."
