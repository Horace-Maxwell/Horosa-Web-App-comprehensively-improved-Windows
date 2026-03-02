#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
START_SH="${ROOT}/start_horosa_local.sh"
STOP_SH="${ROOT}/stop_horosa_local.sh"
VERIFY_SH="${ROOT}/verify_horosa_local.sh"
PY_PID_FILE="${ROOT}/.horosa_py.pid"
JAVA_PID_FILE="${ROOT}/.horosa_java.pid"
WEB_PID_FILE="${ROOT}/.horosa_web.pid"
WEB_PORT="${HOROSA_WEB_PORT:-8000}"
NO_OPEN="${HOROSA_NO_OPEN:-0}"
KEEP_SERVICES_RUNNING="${HOROSA_KEEP_SERVICES_RUNNING:-1}"
SERVICES_STARTED=0
RUN_OK=0

if [ "${1:-}" = "--no-open" ]; then
	NO_OPEN=1
	shift
fi

URL="http://127.0.0.1:${WEB_PORT}/index.html"

ensure_scripts() {
	for f in "${START_SH}" "${STOP_SH}" "${VERIFY_SH}"; do
		if [ ! -x "${f}" ]; then
			echo "missing or not executable: ${f}"
			exit 1
		fi
	done
}

has_existing_service() {
	[ -f "${PY_PID_FILE}" ] || [ -f "${JAVA_PID_FILE}" ] || [ -f "${WEB_PID_FILE}" ]
}

open_url() {
	if [ "${NO_OPEN}" = "1" ]; then
		echo "skip opening browser (NO_OPEN=1)."
		echo "url: ${URL}"
		return
	fi
	if command -v open >/dev/null 2>&1; then
		open -a "Safari" "${URL}" >/dev/null 2>&1 || open "${URL}" >/dev/null 2>&1 || true
	fi
	echo "url: ${URL}"
}

do_stop() {
	"${STOP_SH}" || true
	SERVICES_STARTED=0
}

do_start() {
	if has_existing_service; then
		echo "检测到旧服务记录，先执行停止..."
		do_stop
		sleep 1
	fi

	"${START_SH}"
	SERVICES_STARTED=1
	open_url

	if [ "${KEEP_SERVICES_RUNNING}" = "1" ]; then
		echo "服务已常驻，手动停止命令为 stop_horosa_local.sh"
	else
		echo "按回车后停止本地服务..."
		read -r _
		do_stop
	fi
}

do_verify() {
	"${VERIFY_SH}"
}

do_all() {
	do_start
	echo ""
	do_verify
}

show_menu_and_run() {
	echo "Horosa Local Launcher"
	echo "1) Start services + open local URL"
	echo "2) Verify key functions"
	echo "3) Stop services"
	echo "4) Start + verify"
	echo "5) Exit"
	read -r -p "Select [1-5]: " choice
	case "${choice}" in
		1) do_start ;;
		2) do_verify ;;
		3) do_stop ;;
		4) do_all ;;
		5) exit 0 ;;
		*) echo "invalid selection"; exit 1 ;;
	esac
}

cleanup() {
	local code=$?
	if [ "${SERVICES_STARTED}" = "1" ] && { [ "${RUN_OK}" != "1" ] || [ "${KEEP_SERVICES_RUNNING}" != "1" ]; }; then
		"${STOP_SH}" >/dev/null 2>&1 || true
	fi
	return "${code}"
}
trap cleanup EXIT INT TERM

main() {
	ensure_scripts
	case "${1:-menu}" in
		start) do_start ;;
		verify) do_verify ;;
		stop) do_stop ;;
		all) do_all ;;
		menu) show_menu_and_run ;;
		*)
			echo "usage:"
			echo "  $(basename "$0") [--no-open] [start|verify|stop|all|menu]"
			exit 1
			;;
	esac
	RUN_OK=1
}

main "$@"
