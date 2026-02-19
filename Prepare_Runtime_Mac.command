#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="${ROOT}/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c"
RUNTIME_DIR="${ROOT}/runtime/mac"
JAVA_DST="${RUNTIME_DIR}/java"
PY_DST="${RUNTIME_DIR}/python"
BUNDLE_DIR="${RUNTIME_DIR}/bundle"

UI_DIR="${PROJECT_DIR}/astrostudyui"
IMAGE_DIR="${PROJECT_DIR}/astrostudysrv/image"
BOOT_DIR="${PROJECT_DIR}/astrostudysrv/astrostudyboot"
JAR_PATH="${BOOT_DIR}/target/astrostudyboot.jar"

mkdir -p "${RUNTIME_DIR}" "${BUNDLE_DIR}"

echo "== Horosa Mac 运行时准备 =="

detect_java_src() {
  if [ -n "${HOROSA_JAVA_HOME:-}" ] && [ -x "${HOROSA_JAVA_HOME}/bin/java" ]; then
    echo "${HOROSA_JAVA_HOME}"
    return 0
  fi
  if command -v /usr/libexec/java_home >/dev/null 2>&1; then
    local jh
    jh="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
    if [ -n "${jh}" ] && [ -x "${jh}/bin/java" ]; then
      echo "${jh}"
      return 0
    fi
    jh="$(/usr/libexec/java_home -v 1.8 2>/dev/null || true)"
    if [ -n "${jh}" ] && [ -x "${jh}/bin/java" ]; then
      echo "${jh}"
      return 0
    fi
  fi
  for cand in \
    "/Library/Java/JavaVirtualMachines/jdk-1.8.jdk/Contents/Home" \
    "/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home" \
    "/Library/Java/JavaVirtualMachines/jdk-22.jdk/Contents/Home"; do
    if [ -x "${cand}/bin/java" ]; then
      echo "${cand}"
      return 0
    fi
  done
  return 1
}

prepare_java_runtime() {
  if [ -x "${JAVA_DST}/bin/java" ]; then
    echo "[Java] 已存在：${JAVA_DST}"
    return 0
  fi

  local java_src=""
  if java_src="$(detect_java_src 2>/dev/null)"; then
    echo "[Java] 复制 runtime: ${java_src} -> ${JAVA_DST}"
    rm -rf "${JAVA_DST}"
    rsync -a "${java_src}/" "${JAVA_DST}/"
    return 0
  fi

  echo "[Java] 未找到可复制的 Java 运行时。"
  echo "[Java] 请先安装 JDK（建议 17）或设置 HOROSA_JAVA_HOME 后重试。"
  return 1
}

prepare_python_runtime() {
  if [ -x "${PY_DST}/bin/python3" ]; then
    echo "[Python] 已存在：${PY_DST}"
    return 0
  fi

  local py_exe="${HOROSA_PYTHON:-python3}"
  if ! command -v "${py_exe}" >/dev/null 2>&1; then
    echo "[Python] 未找到解释器：${py_exe}"
    return 1
  fi

  local py_prefix
  py_prefix="$(${py_exe} - <<'PY'
import sys
print(sys.prefix)
PY
)"

  if [ ! -d "${py_prefix}" ]; then
    echo "[Python] Python prefix 不存在: ${py_prefix}"
    return 1
  fi

  echo "[Python] 复制 runtime(可能较大): ${py_prefix} -> ${PY_DST}"
  rm -rf "${PY_DST}"
  rsync -a --delete \
    --exclude 'pkgs' \
    --exclude 'conda-bld' \
    --exclude '.conda' \
    --exclude 'share/jupyter' \
    "${py_prefix}/" "${PY_DST}/"

  local extra_site="$HOME/Library/Python/3.12/lib/python/site-packages"
  if [ -d "${extra_site}" ]; then
    mkdir -p "${PY_DST}/lib/python3.12/site-packages"
    echo "[Python] 复制额外 site-packages: ${extra_site}"
    rsync -a "${extra_site}/" "${PY_DST}/lib/python3.12/site-packages/"
  fi

  if ! "${PY_DST}/bin/python3" - <<'PY' >/dev/null 2>&1
import cherrypy
PY
  then
    echo "[Python] 警告：runtime 中未检测到 cherrypy。"
    echo "[Python] 启动时若报错，请在可联网环境执行：${PY_DST}/bin/pip3 install cherrypy"
  fi

  return 0
}

prepare_frontend_bundle() {
  if [ ! -d "${UI_DIR}" ]; then
    echo "[前端] 目录不存在：${UI_DIR}"
    return 1
  fi

  if command -v npm >/dev/null 2>&1; then
    echo "[前端] 检查依赖并构建 dist-file..."
    (
      cd "${UI_DIR}"
      if [ ! -d "node_modules" ]; then
        npm install --legacy-peer-deps
      fi
      npm run build:file
    )
  else
    echo "[前端] 未检测到 npm，跳过构建，尝试复用现有 dist。"
  fi

  if [ -f "${UI_DIR}/dist-file/index.html" ]; then
    mkdir -p "${BUNDLE_DIR}/dist-file"
    rsync -a --delete "${UI_DIR}/dist-file/" "${BUNDLE_DIR}/dist-file/"
    echo "[前端] 已打包 dist-file 到 ${BUNDLE_DIR}/dist-file"
    return 0
  fi

  if [ -f "${UI_DIR}/dist/index.html" ]; then
    mkdir -p "${BUNDLE_DIR}/dist"
    rsync -a --delete "${UI_DIR}/dist/" "${BUNDLE_DIR}/dist/"
    echo "[前端] 已打包 dist 到 ${BUNDLE_DIR}/dist"
    return 0
  fi

  echo "[前端] 未找到可用 dist 输出。"
  return 1
}

prepare_backend_bundle() {
  if [ -d "${IMAGE_DIR}" ] && [ -d "${BOOT_DIR}" ] && command -v mvn >/dev/null 2>&1; then
    echo "[后端] 使用 Maven 构建 jar..."
    (
      cd "${IMAGE_DIR}"
      mvn -DskipTests install
      cd "${BOOT_DIR}"
      mvn -DskipTests clean install
    )
  else
    echo "[后端] 未检测到 mvn 或目录不完整，跳过构建，尝试复用现有 jar。"
  fi

  if [ -f "${JAR_PATH}" ]; then
    cp -f "${JAR_PATH}" "${BUNDLE_DIR}/astrostudyboot.jar"
    echo "[后端] 已打包 jar 到 ${BUNDLE_DIR}/astrostudyboot.jar"
    return 0
  fi

  echo "[后端] 未找到可用 jar：${JAR_PATH}"
  return 1
}

set +e
prepare_java_runtime
JAVA_RC=$?
prepare_python_runtime
PY_RC=$?
prepare_frontend_bundle
FE_RC=$?
prepare_backend_bundle
BE_RC=$?
set -e

echo ""
echo "== 准备结果 =="
[ ${JAVA_RC} -eq 0 ] && echo "Java runtime: OK" || echo "Java runtime: FAILED"
[ ${PY_RC} -eq 0 ] && echo "Python runtime: OK" || echo "Python runtime: FAILED"
[ ${FE_RC} -eq 0 ] && echo "Frontend bundle: OK" || echo "Frontend bundle: FAILED"
[ ${BE_RC} -eq 0 ] && echo "Backend bundle: OK" || echo "Backend bundle: FAILED"

echo ""
echo "runtime 目录体积："
du -sh "${ROOT}/runtime" || true

echo ""
echo "下一步：双击 Horosa_Local.command 直接启动。"
read -r -p "按回车退出..." _
