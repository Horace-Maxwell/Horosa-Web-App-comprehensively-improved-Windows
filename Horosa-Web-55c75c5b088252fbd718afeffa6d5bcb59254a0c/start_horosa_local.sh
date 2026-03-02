#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_ROOT="${HOROSA_LOG_ROOT:-${ROOT}/.horosa-local-logs}"
RUN_TAG="$(date +%Y%m%d_%H%M%S)"
LOG_DIR="${LOG_ROOT}/${RUN_TAG}"
PY_PID_FILE="${ROOT}/.horosa_py.pid"
JAVA_PID_FILE="${ROOT}/.horosa_java.pid"
WEB_PID_FILE="${ROOT}/.horosa_web.pid"
PY_LOG="${LOG_DIR}/astropy.log"
JAVA_LOG="${LOG_DIR}/astrostudyboot.log"
WEB_LOG="${LOG_DIR}/web.log"
WEB_PORT="${HOROSA_WEB_PORT:-8000}"
PYTHON_BIN="${HOROSA_PYTHON:-python3}"
JAVA_BIN="${HOROSA_JAVA_BIN:-java}"
PYTHONPATH_ASTRO="${ROOT}/astropy"
EXTRA_PY_SITE=""
DIST_DIR="${ROOT}/astrostudyui/dist-file"

if [ ! -f "${DIST_DIR}/index.html" ]; then
	DIST_DIR="${ROOT}/astrostudyui/dist"
fi

mkdir -p "${LOG_DIR}"

cleanup_stale_pid_file() {
	local pid_file="$1"
	if [ ! -f "${pid_file}" ]; then
		return
	fi
	local pid
	pid="$(cat "${pid_file}" 2>/dev/null || true)"
	if [ -z "${pid}" ] || ! kill -0 "${pid}" >/dev/null 2>&1; then
		rm -f "${pid_file}"
	fi
}

cleanup_stale_pid_file "${PY_PID_FILE}"
cleanup_stale_pid_file "${JAVA_PID_FILE}"
cleanup_stale_pid_file "${WEB_PID_FILE}"

port_listening() {
	local port="$1"
	if command -v lsof >/dev/null 2>&1; then
		lsof -tiTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1 && return 0
	fi
	if command -v netstat >/dev/null 2>&1; then
		netstat -ano 2>/dev/null | grep -E "[\\.:]${port}[[:space:]]" | grep -qi "LISTEN" && return 0
	fi
	return 1
}

if [ -f "${PY_PID_FILE}" ] || [ -f "${JAVA_PID_FILE}" ] || [ -f "${WEB_PID_FILE}" ]; then
	echo "pid 文件仍存在且进程在运行。请先执行 ./stop_horosa_local.sh。"
	exit 1
fi

if port_listening 8899; then
	echo "端口 8899 已被占用。"
	exit 1
fi
if port_listening 9999; then
	echo "端口 9999 已被占用。"
	exit 1
fi
if port_listening "${WEB_PORT}"; then
	echo "端口 ${WEB_PORT} 已被占用。"
	exit 1
fi

JAR="${ROOT}/astrostudysrv/astrostudyboot/target/astrostudyboot.jar"
if [ ! -f "${JAR}" ]; then
	echo "缺少后端文件：${JAR}"
	echo "请先构建后端。"
	exit 1
fi

if ! command -v "${JAVA_BIN}" >/dev/null 2>&1; then
	echo "未找到 Java 运行时：${JAVA_BIN}"
	exit 1
fi

if [ -d "${EXTRA_PY_SITE}" ]; then
	PYTHONPATH_ASTRO="${PYTHONPATH_ASTRO}:${EXTRA_PY_SITE}"
fi
if [ -n "${PYTHONPATH:-}" ]; then
	PYTHONPATH_ASTRO="${PYTHONPATH_ASTRO}:${PYTHONPATH}"
fi

if ! command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
	echo "未找到 Python 运行时：${PYTHON_BIN}"
	exit 1
fi

PY_MINOR="$("${PYTHON_BIN}" - <<'PY'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}")
PY
)"
EXTRA_PY_SITE="${HOME}/Library/Python/${PY_MINOR}/lib/python/site-packages"
if [ -d "${EXTRA_PY_SITE}" ]; then
	PYTHONPATH_ASTRO="${PYTHONPATH_ASTRO}:${EXTRA_PY_SITE}"
fi

if ! PYTHONPATH="${PYTHONPATH_ASTRO}" "${PYTHON_BIN}" - <<'PY' >/dev/null 2>&1
import cherrypy
PY
then
	echo "Python 缺少依赖 cherrypy：${PYTHON_BIN}"
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
		if [ -f "${WEB_PID_FILE}" ]; then
			kill "$(cat "${WEB_PID_FILE}")" >/dev/null 2>&1 || true
			rm -f "${WEB_PID_FILE}"
		fi
	fi
	return "${code}"
}
trap cleanup_on_fail EXIT

cd "${ROOT}"
nohup env PYTHONPATH="${PYTHONPATH_ASTRO}" "${PYTHON_BIN}" "${ROOT}/astropy/websrv/webchartsrv.py" >"${PY_LOG}" 2>&1 &
echo "$!" > "${PY_PID_FILE}"

nohup "${JAVA_BIN}" -jar "${JAR}" \
	--astrosrv=http://127.0.0.1:8899 \
	--mongodb.ip=127.0.0.1 \
	--redis.ip=127.0.0.1 >"${JAVA_LOG}" 2>&1 &
echo "$!" > "${JAVA_PID_FILE}"

nohup "${PYTHON_BIN}" -m http.server "${WEB_PORT}" --bind 127.0.0.1 --directory "${DIST_DIR}" >"${WEB_LOG}" 2>&1 &
echo "$!" > "${WEB_PID_FILE}"

ready=0
for _ in $(seq 1 60); do
	if ! kill -0 "$(cat "${PY_PID_FILE}")" >/dev/null 2>&1; then
		echo "astropy 启动中退出。"
		break
	fi
	if ! kill -0 "$(cat "${JAVA_PID_FILE}")" >/dev/null 2>&1; then
		echo "astrostudyboot 启动中退出。"
		break
	fi
	if ! kill -0 "$(cat "${WEB_PID_FILE}")" >/dev/null 2>&1; then
		echo "web 服务启动中退出。"
		break
	fi

	if port_listening 8899 && port_listening 9999 && port_listening "${WEB_PORT}"; then
		ready=1
		break
	fi
	sleep 1
done

if [ "${ready}" -ne 1 ]; then
	echo "服务未在预期时间内就绪（需同时监听 8899/9999/${WEB_PORT}）。"
	echo "--- astropy log tail ---"
	tail -n 40 "${PY_LOG}" || true
	echo "--- astrostudyboot log tail ---"
	tail -n 40 "${JAVA_LOG}" || true
	echo "--- web log tail ---"
	tail -n 40 "${WEB_LOG}" || true
	exit 1
fi

trap - EXIT

echo "services are ready."
echo "backend:  http://127.0.0.1:9999"
echo "chartpy:  http://127.0.0.1:8899"
echo "web:      http://127.0.0.1:${WEB_PORT}"
echo "html:     ${DIST_DIR}/index.html"
echo "logs:     ${LOG_DIR}"
echo ""
echo "stop:     ${ROOT}/stop_horosa_local.sh"
