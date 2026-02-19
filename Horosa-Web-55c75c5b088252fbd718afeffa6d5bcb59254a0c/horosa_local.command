#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
START_SH="${ROOT}/start_horosa_local.sh"
STOP_SH="${ROOT}/stop_horosa_local.sh"
VERIFY_SH="${ROOT}/verify_horosa_local.sh"
NO_OPEN="${HOROSA_NO_OPEN:-0}"

if [ "${1:-}" = "--no-open" ]; then
  NO_OPEN=1
  shift
fi

HTML_PATH="${ROOT}/astrostudyui/dist-file/index.html"
if [ ! -f "${HTML_PATH}" ]; then
  HTML_PATH="${ROOT}/astrostudyui/dist/index.html"
fi

ensure_scripts() {
  for f in "${START_SH}" "${STOP_SH}" "${VERIFY_SH}"; do
    if [ ! -x "${f}" ]; then
      echo "missing or not executable: ${f}"
      exit 1
    fi
  done
}

open_html() {
  if [ "${NO_OPEN}" = "1" ]; then
    echo "skip opening browser (NO_OPEN=1)."
    echo "html: ${HTML_PATH}"
    return
  fi
  if command -v open >/dev/null 2>&1; then
    # Prefer Safari on macOS; fallback to the system default browser.
    open -a "Safari" "${HTML_PATH}" >/dev/null 2>&1 || open "${HTML_PATH}" || true
  fi
  echo "html: ${HTML_PATH}"
}

do_start() {
  "${START_SH}"
  open_html
}

do_verify() {
  "${VERIFY_SH}"
}

do_stop() {
  "${STOP_SH}"
}

do_all() {
  do_start
  echo ""
  do_verify
}

show_menu_and_run() {
  echo "Horosa Local Launcher"
  echo "1) Start services + open local HTML"
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
}

main "$@"
