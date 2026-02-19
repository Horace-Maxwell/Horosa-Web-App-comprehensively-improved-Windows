#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="${ROOT}/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c"
START_SH="${PROJECT_DIR}/start_horosa_local.sh"
STOP_SH="${PROJECT_DIR}/stop_horosa_local.sh"
PY_PID_FILE="${PROJECT_DIR}/.horosa_py.pid"
JAVA_PID_FILE="${PROJECT_DIR}/.horosa_java.pid"
UI_DIR="${PROJECT_DIR}/astrostudyui"

BUNDLED_RUNTIME_DIR="${ROOT}/runtime/mac"
BUNDLED_JAVA_HOME="${BUNDLED_RUNTIME_DIR}/java"
BUNDLED_PYTHON_BIN="${BUNDLED_RUNTIME_DIR}/python/bin/python3"
BUNDLE_DIR="${BUNDLED_RUNTIME_DIR}/bundle"
BUNDLE_JAR="${BUNDLE_DIR}/astrostudyboot.jar"
TARGET_JAR="${PROJECT_DIR}/astrostudysrv/astrostudyboot/target/astrostudyboot.jar"
BUNDLE_DIST_FILE="${BUNDLE_DIR}/dist-file"
BUNDLE_DIST="${BUNDLE_DIR}/dist"

DIST_DIR="${PROJECT_DIR}/astrostudyui/dist-file"

resolve_dist_dir() {
  if [ -f "${PROJECT_DIR}/astrostudyui/dist-file/index.html" ]; then
    DIST_DIR="${PROJECT_DIR}/astrostudyui/dist-file"
    return
  fi
  DIST_DIR="${PROJECT_DIR}/astrostudyui/dist"
}

use_bundled_runtime() {
  if [ -x "${BUNDLED_JAVA_HOME}/bin/java" ]; then
    export JAVA_HOME="${BUNDLED_JAVA_HOME}"
    export PATH="${JAVA_HOME}/bin:${PATH}"
    echo "[预检] 使用项目内 Java runtime: ${JAVA_HOME}"
  else
    echo "[预检] 未检测到项目内 Java runtime，回退系统 Java。"
  fi

  if [ -x "${BUNDLED_PYTHON_BIN}" ]; then
    export HOROSA_PYTHON="${BUNDLED_PYTHON_BIN}"
    echo "[预检] 使用项目内 Python runtime: ${HOROSA_PYTHON}"
  else
    echo "[预检] 未检测到项目内 Python runtime，回退系统 Python。"
  fi
}

ensure_backend_artifact() {
  if [ -f "${TARGET_JAR}" ]; then
    return
  fi
  if [ -f "${BUNDLE_JAR}" ]; then
    echo "[预检] 目标 jar 缺失，使用仓库内预打包 jar 回填。"
    mkdir -p "$(dirname "${TARGET_JAR}")"
    cp -f "${BUNDLE_JAR}" "${TARGET_JAR}"
  fi
}

ensure_frontend_artifact() {
  resolve_dist_dir
  if [ -f "${DIST_DIR}/index.html" ]; then
    return
  fi

  if [ -f "${BUNDLE_DIST_FILE}/index.html" ]; then
    echo "[预检] 前端 dist-file 缺失，使用仓库内预打包文件回填。"
    mkdir -p "${PROJECT_DIR}/astrostudyui/dist-file"
    rsync -a --delete "${BUNDLE_DIST_FILE}/" "${PROJECT_DIR}/astrostudyui/dist-file/"
  elif [ -f "${BUNDLE_DIST}/index.html" ]; then
    echo "[预检] 前端 dist 缺失，使用仓库内预打包文件回填。"
    mkdir -p "${PROJECT_DIR}/astrostudyui/dist"
    rsync -a --delete "${BUNDLE_DIST}/" "${PROJECT_DIR}/astrostudyui/dist/"
  fi
  resolve_dist_dir
}

if [ ! -x "${START_SH}" ] || [ ! -x "${STOP_SH}" ]; then
  echo "缺少可执行脚本：${START_SH} 或 ${STOP_SH}"
  read -r -p "按回车退出..." _
  exit 1
fi

ensure_frontend_build() {
  resolve_dist_dir
  local dist_index="${DIST_DIR}/index.html"
  local should_build=0

  if [ ! -f "${dist_index}" ]; then
    should_build=1
  else
    if [ -n "$(find "${UI_DIR}/src" -type f -newer "${dist_index}" -print -quit 2>/dev/null)" ]; then
      should_build=1
    fi
    if [ -d "${UI_DIR}/public" ] && [ -n "$(find "${UI_DIR}/public" -type f -newer "${dist_index}" -print -quit 2>/dev/null)" ]; then
      should_build=1
    fi
    if [ -f "${UI_DIR}/package.json" ] && [ "${UI_DIR}/package.json" -nt "${dist_index}" ]; then
      should_build=1
    fi
    if [ -f "${UI_DIR}/.umirc.ts" ] && [ "${UI_DIR}/.umirc.ts" -nt "${dist_index}" ]; then
      should_build=1
    fi
    if [ -f "${UI_DIR}/.umirc.js" ] && [ "${UI_DIR}/.umirc.js" -nt "${dist_index}" ]; then
      should_build=1
    fi
  fi

  if [ "${should_build}" = "1" ]; then
    if command -v npm >/dev/null 2>&1; then
      echo "[0/4] 检测到前端有新改动，正在自动构建..."
      (
        cd "${UI_DIR}"
        if [ ! -d "node_modules" ]; then
          echo "[0/4] 未检测到 node_modules，先执行 npm install..."
          npm install --legacy-peer-deps
        fi
        npm run build:file
      )
      resolve_dist_dir
      dist_index="${DIST_DIR}/index.html"
      if [ ! -f "${dist_index}" ]; then
        echo "前端构建完成但未找到 ${dist_index}"
        exit 1
      fi
    elif [ -f "${dist_index}" ]; then
      echo "[0/4] 检测到前端源码有更新，但当前无 npm；使用现有静态文件继续启动。"
    else
      echo "前端静态文件缺失，且当前环境无 npm，无法自动构建。"
      echo "请先点击 Prepare_Runtime_Mac.command 准备 runtime 与构建产物。"
      exit 1
    fi
  else
    echo "[0/4] 前端构建已是最新，跳过自动构建。"
  fi
}

WEB_PORT="${HOROSA_WEB_PORT:-8000}"
WEB_PID=""
BROWSER_PID=""
BACKEND_STARTED=0
BROWSER_PROFILE_DIR="${PROJECT_DIR}/.horosa-browser-profile"
NO_BROWSER="${HOROSA_NO_BROWSER:-0}"
mkdir -p "${BROWSER_PROFILE_DIR}"

port_listening() {
  local port="$1"
  lsof -tiTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

pick_browser_bin() {
  local candidates=(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  )
  local bin
  for bin in "${candidates[@]}"; do
    if [ -x "${bin}" ]; then
      echo "${bin}"
      return 0
    fi
  done
  return 1
}

cleanup() {
  set +e

  if [ -n "${WEB_PID}" ] && kill -0 "${WEB_PID}" >/dev/null 2>&1; then
    kill "${WEB_PID}" >/dev/null 2>&1 || true
    sleep 1
    kill -9 "${WEB_PID}" >/dev/null 2>&1 || true
  fi

  if [ "${BACKEND_STARTED}" = "1" ]; then
    "${STOP_SH}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

if [ -f "${PY_PID_FILE}" ] || [ -f "${JAVA_PID_FILE}" ]; then
  echo "检测到旧服务记录，先执行一次停止..."
  "${STOP_SH}" >/dev/null 2>&1 || true
  sleep 1
fi

use_bundled_runtime
ensure_backend_artifact
ensure_frontend_artifact

resolve_dist_dir
if [ ! -d "${DIST_DIR}" ] || [ ! -f "${DIST_DIR}/index.html" ]; then
  echo "前端静态文件不存在：${DIST_DIR}/index.html"
  echo "请先点击 Prepare_Runtime_Mac.command，或手动构建前端。"
  read -r -p "按回车退出..." _
  exit 1
fi

ensure_frontend_build

echo "[1/4] 启动本地后端服务..."
"${START_SH}"
BACKEND_STARTED=1

echo "[2/4] 启动本地网页服务 (127.0.0.1:${WEB_PORT})..."
if port_listening "${WEB_PORT}"; then
  echo "端口 ${WEB_PORT} 已被占用，请先释放后重试。"
  exit 1
fi

WEB_PY="${HOROSA_PYTHON:-python3}"
"${WEB_PY}" -m http.server "${WEB_PORT}" --bind 127.0.0.1 --directory "${DIST_DIR}" >/tmp/horosa_local_web.log 2>&1 &
WEB_PID="$!"

for _ in $(seq 1 20); do
  if port_listening "${WEB_PORT}"; then
    break
  fi
  sleep 0.2
done

if ! port_listening "${WEB_PORT}"; then
  echo "本地网页服务启动失败，日志：/tmp/horosa_local_web.log"
  exit 1
fi

URL="http://127.0.0.1:${WEB_PORT}/index.html?v=$(date +%s)"

echo "[3/4] 打开网页..."
BROWSER_BIN=""
if [ "${NO_BROWSER}" = "1" ]; then
  echo "HOROSA_NO_BROWSER=1，跳过打开浏览器（仅用于命令行自检）。"
  echo "访问地址：${URL}"
  echo "按回车后停止本地服务。"
  read -r _
elif command -v open >/dev/null 2>&1 && open -a "Safari" "${URL}" >/dev/null 2>&1; then
  echo "[4/4] 已使用 Safari 打开：${URL}"
  echo "关闭网页后按回车，将自动停止本地服务。"
  read -r _
elif BROWSER_BIN="$(pick_browser_bin)"; then
  "${BROWSER_BIN}" \
    --user-data-dir="${BROWSER_PROFILE_DIR}" \
    --app="${URL}" \
    --no-first-run \
    --no-default-browser-check \
    --disable-features=DialMediaRouteProvider >/dev/null 2>&1 &
  BROWSER_PID="$!"

  echo "[4/4] 已启动：${URL}"
  echo "关闭这个独立窗口后，将自动停止本地服务。"
  wait "${BROWSER_PID}" || true
else
  echo "未检测到 Chrome/Edge/Brave/Chromium，改用系统默认浏览器打开。"
  open "${URL}" || true
  echo "关闭网页后按回车，将自动停止本地服务。"
  read -r _
fi

echo "网页已关闭，正在停止本地服务..."
