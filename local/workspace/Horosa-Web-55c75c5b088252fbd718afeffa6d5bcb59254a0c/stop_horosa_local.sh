#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PY_PID_FILE="${ROOT}/.horosa_py.pid"
JAVA_PID_FILE="${ROOT}/.horosa_java.pid"
WEB_PID_FILE="${ROOT}/.horosa_web.pid"
CHART_PORT="${HOROSA_CHART_PORT:-8899}"
BACKEND_PORT="${HOROSA_SERVER_PORT:-9999}"
WEB_PORT="${HOROSA_WEB_PORT:-8000}"

kill_pid_gracefully() {
  local pid="$1"
  local name="$2"
  if [ -z "${pid}" ] || ! kill -0 "${pid}" >/dev/null 2>&1; then
    return 1
  fi
  kill "${pid}" >/dev/null 2>&1 || true
  sleep 1
  if kill -0 "${pid}" >/dev/null 2>&1; then
    kill -9 "${pid}" >/dev/null 2>&1 || true
  fi
  echo "${name}: stopped pid ${pid}."
  return 0
}

stop_by_pid_file() {
  local name="$1"
  local pid_file="$2"
  if [ ! -f "${pid_file}" ]; then
    echo "${name}: not running (pid file missing)."
    return
  fi

  local pid
  pid="$(cat "${pid_file}")"
  if ! kill_pid_gracefully "${pid}" "${name}"; then
    echo "${name}: process not found, cleaning pid file."
  fi
  rm -f "${pid_file}"
}

port_listener_pids() {
  local port="$1"
  lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null | sort -u || true
}

process_command() {
  local pid="$1"
  ps -p "${pid}" -o command= 2>/dev/null || true
}

stop_by_port_pattern() {
  local name="$1"
  local port="$2"
  local pattern="$3"
  local pid_file="$4"
  local pid=""
  local cmd=""
  local stopped=0
  local pids=""

  pids="$(port_listener_pids "${port}")"
  if [ -z "${pids}" ]; then
    return
  fi

  for pid in ${pids}; do
    cmd="$(process_command "${pid}")"
    if [ -z "${cmd}" ]; then
      continue
    fi
    # Only reap listeners that belong to this workspace copy. Without this
    # guard, a second Horosa checkout on the same Mac can stop the wrong
    # services because the fallback matcher only knows the generic process
    # role (webchartsrv.py / astrostudyboot.jar / http.server).
    if ! printf '%s\n' "${cmd}" | grep -Fq "${ROOT}"; then
      continue
    fi
    if ! printf '%s\n' "${cmd}" | grep -Eq "${pattern}"; then
      continue
    fi
    if kill_pid_gracefully "${pid}" "${name}(port:${port})"; then
      stopped=1
    fi
  done

  if [ "${stopped}" = "1" ] && [ -n "${pid_file}" ]; then
    rm -f "${pid_file}"
  fi
}

stop_by_pid_file "astropy" "${PY_PID_FILE}"
stop_by_pid_file "astrostudyboot" "${JAVA_PID_FILE}"
stop_by_pid_file "web" "${WEB_PID_FILE}"

# 兜底：即使 pid 文件丢失，也尝试按端口+进程特征回收 Horosa 残留进程
stop_by_port_pattern "astropy" "${CHART_PORT}" 'webchartsrv\.py' "${PY_PID_FILE}"
stop_by_port_pattern "astrostudyboot" "${BACKEND_PORT}" 'astrostudyboot\.jar' "${JAVA_PID_FILE}"
stop_by_port_pattern "web" "${WEB_PORT}" 'http\.server.*astrostudyui/(dist|dist-file)' "${WEB_PID_FILE}"
