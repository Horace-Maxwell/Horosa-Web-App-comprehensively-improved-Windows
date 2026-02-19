#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PY_PID_FILE="${ROOT}/.horosa_py.pid"
JAVA_PID_FILE="${ROOT}/.horosa_java.pid"

stop_by_pid_file() {
  local name="$1"
  local pid_file="$2"
  if [ ! -f "${pid_file}" ]; then
    echo "${name}: not running (pid file missing)."
    return
  fi

  local pid
  pid="$(cat "${pid_file}")"
  if [ -n "${pid}" ] && kill -0 "${pid}" >/dev/null 2>&1; then
    kill "${pid}" >/dev/null 2>&1 || true
    sleep 1
    if kill -0 "${pid}" >/dev/null 2>&1; then
      kill -9 "${pid}" >/dev/null 2>&1 || true
    fi
    echo "${name}: stopped pid ${pid}."
  else
    echo "${name}: process not found, cleaning pid file."
  fi
  rm -f "${pid_file}"
}

stop_by_pid_file "astropy" "${PY_PID_FILE}"
stop_by_pid_file "astrostudyboot" "${JAVA_PID_FILE}"
