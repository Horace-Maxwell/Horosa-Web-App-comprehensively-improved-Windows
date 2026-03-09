#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT_DIR="${ROOT}/Horosa-Web"
UI_DIR="${PROJECT_DIR}/astrostudyui"
SERVER_DIR="${PROJECT_DIR}/astrostudysrv"
VENV_DIR="${ROOT}/.runtime/mac/venv"
LOCAL_JAVA_HOME="${ROOT}/.runtime/mac/java"
LOCAL_MAVEN_HOME="${ROOT}/.runtime/mac/maven"
LOCAL_MAVEN_BIN="${LOCAL_MAVEN_HOME}/bin/mvn"
LOCAL_NODE_HOME="${ROOT}/.runtime/mac/node"
LOCAL_NODE_BIN="${LOCAL_NODE_HOME}/bin/node"
LOCAL_PYTHON_HOME="${ROOT}/.runtime/mac/python"
LOCAL_PYTHON_BIN="${LOCAL_PYTHON_HOME}/bin/python3"
MAVEN_LOCAL_REPO="${ROOT}/.runtime/mac/m2"
RUNTIME_PYTHON_BIN="${ROOT}/runtime/mac/python/bin/python3"
REQ_FILE="${ROOT}/scripts/requirements/mac-python.txt"
BACKEND_JAR="${SERVER_DIR}/astrostudyboot/target/astrostudyboot.jar"
FRONTEND_INDEX="${UI_DIR}/dist-file/index.html"

MAVEN_CMD=()

SKIP_TOOLCHAIN_INSTALL="${HOROSA_SKIP_TOOLCHAIN_INSTALL:-0}"
SKIP_DB_SETUP="${HOROSA_SKIP_DB_SETUP:-0}"
SKIP_BUILD="${HOROSA_SKIP_BUILD:-0}"
SKIP_LAUNCH="${HOROSA_SKIP_LAUNCH:-0}"

say() {
  echo "[Horosa mac] $*"
}

fail() {
  echo "[Horosa mac] ERROR: $*" >&2
  exit 1
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

port_listening() {
  local port="$1"
  lsof -tiTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

require_macos() {
  if [ "$(uname -s)" != "Darwin" ]; then
    fail "this script only supports macOS."
  fi
}

load_brew_env() {
  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

ensure_homebrew() {
  load_brew_env
  if have_cmd brew; then
    return 0
  fi

  say "installing Homebrew (first run only)..."
  if ! NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"; then
    say "warning: failed to install Homebrew automatically."
    return 1
  fi
  load_brew_env
  if ! have_cmd brew; then
    say "warning: Homebrew install command finished but brew is still unavailable."
    return 1
  fi
  return 0
}

ensure_formula() {
  local formula="$1"
  if ! have_cmd brew; then
    say "warning: Homebrew unavailable, cannot install ${formula}."
    return 1
  fi
  if brew list --formula "${formula}" >/dev/null 2>&1; then
    return 0
  fi
  say "installing ${formula} ..."
  brew install "${formula}"
}

java_major_version_of() {
  local java_bin="$1"
  local major="0"
  if [ ! -x "${java_bin}" ]; then
    echo "0"
    return 0
  fi
  major="$("${java_bin}" -version 2>&1 | awk -F'"' '/version/ {print $2; exit}' | awk -F. '{if ($1 == 1) print $2; else print $1}' || true)"
  if [[ "${major}" =~ ^[0-9]+$ ]]; then
    echo "${major}"
  else
    echo "0"
  fi
}

java_home_ready() {
  local java_home="$1"
  local major="0"
  if [ -z "${java_home}" ] || [ ! -x "${java_home}/bin/java" ]; then
    return 1
  fi
  major="$(java_major_version_of "${java_home}/bin/java")"
  [ "${major}" -ge 17 ]
}

set_java_home() {
  local java_home="$1"
  export JAVA_HOME="${java_home}"
  export PATH="${JAVA_HOME}/bin:${PATH}"
}

detect_brew_java_home() {
  local formula=""
  local candidate=""
  if have_cmd brew; then
    for formula in openjdk@17 openjdk; do
      if brew list --formula "${formula}" >/dev/null 2>&1; then
        candidate="$(brew --prefix "${formula}")/libexec/openjdk.jdk/Contents/Home"
        if java_home_ready "${candidate}"; then
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
    if java_home_ready "${candidate}"; then
      echo "${candidate}"
      return 0
    fi
  done

  return 1
}

detect_mac_arch() {
  case "$(uname -m)" in
    arm64|aarch64)
      echo "aarch64"
      ;;
    x86_64|amd64)
      echo "x64"
      ;;
    *)
      return 1
      ;;
  esac
}

detect_node_arch() {
  case "$(uname -m)" in
    arm64|aarch64)
      echo "arm64"
      ;;
    x86_64|amd64)
      echo "x64"
      ;;
    *)
      return 1
      ;;
  esac
}

detect_miniconda_arch() {
  case "$(uname -m)" in
    arm64|aarch64)
      echo "arm64"
      ;;
    x86_64|amd64)
      echo "x86_64"
      ;;
    *)
      return 1
      ;;
  esac
}

install_local_java17() {
  local arch=""
  local download_url=""
  local tmp_root=""
  local archive_path=""
  local extract_dir=""
  local jdk_home=""

  arch="$(detect_mac_arch || true)"
  if [ -z "${arch}" ]; then
    say "warning: unsupported mac architecture, skip direct java download."
    return 1
  fi

  download_url="${HOROSA_JDK17_URL:-https://api.adoptium.net/v3/binary/latest/17/ga/mac/${arch}/jdk/hotspot/normal/eclipse?project=jdk}"
  tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/horosa-jdk.XXXXXX")"
  archive_path="${tmp_root}/jdk17.tar.gz"
  extract_dir="${tmp_root}/extract"
  mkdir -p "${extract_dir}"

  say "downloading java 17 runtime (${arch}) ..."
  if ! curl -fL --retry 2 --connect-timeout 15 -o "${archive_path}" "${download_url}"; then
    rm -rf "${tmp_root}"
    return 1
  fi
  if ! tar -xzf "${archive_path}" -C "${extract_dir}"; then
    rm -rf "${tmp_root}"
    return 1
  fi

  jdk_home="$(find "${extract_dir}" -type d -path '*/Contents/Home' -print -quit 2>/dev/null || true)"
  if [ -z "${jdk_home}" ] && [ -x "${extract_dir}/bin/java" ]; then
    jdk_home="${extract_dir}"
  fi
  if [ -z "${jdk_home}" ] || ! java_home_ready "${jdk_home}"; then
    rm -rf "${tmp_root}"
    return 1
  fi

  mkdir -p "$(dirname "${LOCAL_JAVA_HOME}")"
  rm -rf "${LOCAL_JAVA_HOME}"
  rsync -a "${jdk_home}/" "${LOCAL_JAVA_HOME}/"
  rm -rf "${tmp_root}"

  java_home_ready "${LOCAL_JAVA_HOME}"
}

install_local_node() {
  local arch=""
  local node_ver=""
  local download_url=""
  local tmp_root=""
  local archive_path=""
  local extract_dir=""
  local extracted_home=""

  arch="$(detect_node_arch || true)"
  if [ -z "${arch}" ]; then
    say "warning: unsupported mac architecture, skip direct node download."
    return 1
  fi

  node_ver="${HOROSA_NODE_VERSION:-v20.11.1}"
  download_url="${HOROSA_NODE_URL:-https://nodejs.org/dist/${node_ver}/node-${node_ver}-darwin-${arch}.tar.gz}"
  tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/horosa-node.XXXXXX")"
  archive_path="${tmp_root}/node.tar.gz"
  extract_dir="${tmp_root}/extract"
  mkdir -p "${extract_dir}"

  say "downloading node runtime (${node_ver}, ${arch}) ..."
  if ! curl -fL --retry 2 --connect-timeout 15 -o "${archive_path}" "${download_url}"; then
    rm -rf "${tmp_root}"
    return 1
  fi
  if ! tar -xzf "${archive_path}" -C "${extract_dir}"; then
    rm -rf "${tmp_root}"
    return 1
  fi

  extracted_home="$(find "${extract_dir}" -maxdepth 1 -type d -name "node-${node_ver}-darwin-${arch}" -print -quit 2>/dev/null || true)"
  if [ -z "${extracted_home}" ] || [ ! -x "${extracted_home}/bin/node" ] || [ ! -x "${extracted_home}/bin/npm" ]; then
    rm -rf "${tmp_root}"
    return 1
  fi

  mkdir -p "$(dirname "${LOCAL_NODE_HOME}")"
  rm -rf "${LOCAL_NODE_HOME}"
  rsync -a "${extracted_home}/" "${LOCAL_NODE_HOME}/"
  rm -rf "${tmp_root}"

  [ -x "${LOCAL_NODE_BIN}" ] && [ -x "${LOCAL_NODE_HOME}/bin/npm" ]
}

install_local_maven() {
  local maven_ver=""
  local download_url=""
  local tmp_root=""
  local archive_path=""
  local extract_dir=""
  local extracted_home=""

  maven_ver="${HOROSA_MAVEN_VERSION:-3.9.9}"
  download_url="${HOROSA_MAVEN_URL:-https://archive.apache.org/dist/maven/maven-3/${maven_ver}/binaries/apache-maven-${maven_ver}-bin.tar.gz}"
  tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/horosa-maven.XXXXXX")"
  archive_path="${tmp_root}/maven.tar.gz"
  extract_dir="${tmp_root}/extract"
  mkdir -p "${extract_dir}"

  say "downloading apache maven ${maven_ver} ..."
  if ! curl -fL --retry 2 --connect-timeout 15 -o "${archive_path}" "${download_url}"; then
    rm -rf "${tmp_root}"
    return 1
  fi
  if ! tar -xzf "${archive_path}" -C "${extract_dir}"; then
    rm -rf "${tmp_root}"
    return 1
  fi

  extracted_home="$(find "${extract_dir}" -maxdepth 1 -type d -name 'apache-maven-*' -print -quit 2>/dev/null || true)"
  if [ -z "${extracted_home}" ] || [ ! -x "${extracted_home}/bin/mvn" ]; then
    rm -rf "${tmp_root}"
    return 1
  fi

  mkdir -p "$(dirname "${LOCAL_MAVEN_HOME}")"
  rm -rf "${LOCAL_MAVEN_HOME}"
  rsync -a "${extracted_home}/" "${LOCAL_MAVEN_HOME}/"
  rm -rf "${tmp_root}"

  [ -x "${LOCAL_MAVEN_BIN}" ]
}

install_local_python() {
  local arch=""
  local download_url=""
  local tmp_root=""
  local installer_path=""

  arch="$(detect_miniconda_arch || true)"
  if [ -z "${arch}" ]; then
    say "warning: unsupported mac architecture, skip direct python download."
    return 1
  fi

  download_url="${HOROSA_PYTHON_URL:-https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-${arch}.sh}"
  tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/horosa-python.XXXXXX")"
  installer_path="${tmp_root}/miniconda.sh"

  say "downloading python runtime (miniconda, ${arch}) ..."
  if ! curl -fL --retry 2 --connect-timeout 15 -o "${installer_path}" "${download_url}"; then
    rm -rf "${tmp_root}"
    return 1
  fi

  mkdir -p "$(dirname "${LOCAL_PYTHON_HOME}")"
  rm -rf "${LOCAL_PYTHON_HOME}"
  if ! bash "${installer_path}" -b -p "${LOCAL_PYTHON_HOME}" >/dev/null 2>&1; then
    rm -rf "${tmp_root}"
    return 1
  fi
  rm -rf "${tmp_root}"

  [ -x "${LOCAL_PYTHON_BIN}" ] && "${LOCAL_PYTHON_BIN}" - <<'PY' >/dev/null 2>&1
import sys
raise SystemExit(0 if (sys.version_info.major, sys.version_info.minor) >= (3, 9) else 1)
PY
}

ensure_java17() {
  load_brew_env
  local java_home=""
  local java_bin=""
  local major="0"

  if java_home_ready "${JAVA_HOME:-}"; then
    set_java_home "${JAVA_HOME}"
    return 0
  fi

  if command -v /usr/libexec/java_home >/dev/null 2>&1; then
    java_home="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
    if java_home_ready "${java_home}"; then
      set_java_home "${java_home}"
      return 0
    fi
  fi

  for java_home in "${ROOT}/runtime/mac/java" "${LOCAL_JAVA_HOME}"; do
    if java_home_ready "${java_home}"; then
      set_java_home "${java_home}"
      return 0
    fi
  done

  java_home="$(detect_brew_java_home || true)"
  if java_home_ready "${java_home}"; then
    set_java_home "${java_home}"
    return 0
  fi

  if have_cmd java; then
    java_bin="$(command -v java)"
    major="$(java_major_version_of "${java_bin}")"
    if [ "${major}" -ge 17 ]; then
      export PATH="$(dirname "${java_bin}"):${PATH}"
      return 0
    fi
  fi

  if [ "${SKIP_TOOLCHAIN_INSTALL}" != "1" ] && have_cmd brew; then
    if ensure_formula openjdk@17; then
      java_home="$(detect_brew_java_home || true)"
      if java_home_ready "${java_home}"; then
        set_java_home "${java_home}"
        return 0
      fi
    fi
  fi

  say "Homebrew 不可用或 openjdk 安装失败，尝试直接下载 Java 17 ..."
  if install_local_java17; then
    set_java_home "${LOCAL_JAVA_HOME}"
    return 0
  fi

  fail "java 17+ is required. automatic install failed (Homebrew unavailable and direct download failed)."
}

ensure_maven() {
  load_brew_env
  local maven_bin=""

  if have_cmd mvn; then
    maven_bin="$(command -v mvn)"
  elif [ -x "${LOCAL_MAVEN_BIN}" ]; then
    maven_bin="${LOCAL_MAVEN_BIN}"
  fi

  if [ -z "${maven_bin}" ] && [ "${SKIP_TOOLCHAIN_INSTALL}" != "1" ] && have_cmd brew; then
    if ensure_formula maven; then
      if have_cmd mvn; then
        maven_bin="$(command -v mvn)"
      fi
    fi
  fi

  if [ -z "${maven_bin}" ] && [ "${SKIP_TOOLCHAIN_INSTALL}" != "1" ]; then
    say "Homebrew Maven unavailable, trying direct Maven download ..."
    if install_local_maven; then
      maven_bin="${LOCAL_MAVEN_BIN}"
    fi
  fi

  if [ -z "${maven_bin}" ]; then
    if [ "${SKIP_TOOLCHAIN_INSTALL}" = "1" ]; then
      fail "maven is required. disable HOROSA_SKIP_TOOLCHAIN_INSTALL or install maven manually."
    fi
    fail "maven is required but auto-install failed. install maven manually or set HOROSA_SKIP_BUILD=1."
  fi

  mkdir -p "${MAVEN_LOCAL_REPO}"
  MAVEN_CMD=("${maven_bin}" "-Dmaven.repo.local=${MAVEN_LOCAL_REPO}")
}

run_maven() {
  if [ "${#MAVEN_CMD[@]}" -eq 0 ]; then
    fail "internal error: MAVEN_CMD is empty."
  fi
  "${MAVEN_CMD[@]}" "$@"
}

node_major_version_of() {
  local node_bin="$1"
  local major="0"
  if [ ! -x "${node_bin}" ]; then
    echo "0"
    return 0
  fi
  major="$("${node_bin}" -v 2>/dev/null | sed 's/^v//' | cut -d. -f1)"
  if [[ "${major}" =~ ^[0-9]+$ ]]; then
    echo "${major}"
  else
    echo "0"
  fi
}

ensure_node() {
  load_brew_env
  local node_major="0"

  if [ -x "${LOCAL_NODE_BIN}" ]; then
    export PATH="${LOCAL_NODE_HOME}/bin:${PATH}"
  fi

  if have_cmd node; then
    node_major="$(node_major_version_of "$(command -v node)")"
  fi

  if [ "${node_major}" -lt 18 ]; then
    if [ "${SKIP_TOOLCHAIN_INSTALL}" != "1" ]; then
      if have_cmd brew && brew info node@18 >/dev/null 2>&1; then
        if ensure_formula node@18; then
          export PATH="$(brew --prefix node@18)/bin:${PATH}"
        fi
      else
        ensure_formula node || true
      fi
    fi
    if have_cmd node; then
      node_major="$(node_major_version_of "$(command -v node)")"
    else
      node_major="0"
    fi
  fi

  if [ "${node_major}" -lt 18 ] && [ "${SKIP_TOOLCHAIN_INSTALL}" != "1" ]; then
    say "Homebrew Node unavailable, trying direct Node download ..."
    if install_local_node; then
      export PATH="${LOCAL_NODE_HOME}/bin:${PATH}"
      node_major="$(node_major_version_of "${LOCAL_NODE_BIN}")"
    fi
  fi

  if [ "${node_major}" -lt 18 ]; then
    if [ "${SKIP_TOOLCHAIN_INSTALL}" = "1" ]; then
      fail "node 18+ is required. disable HOROSA_SKIP_TOOLCHAIN_INSTALL or provide node manually."
    fi
    fail "node 18+ is required. automatic install failed (Homebrew unavailable and direct download failed)."
  fi

  have_cmd node || fail "node command not found."
  have_cmd npm || fail "npm command not found."
}

detect_python_bin() {
  local candidate=""
  for candidate in "${VENV_DIR}/bin/python3" "${LOCAL_PYTHON_BIN}" "${RUNTIME_PYTHON_BIN}"; do
    if [ -x "${candidate}" ] && "${candidate}" - <<'PY' >/dev/null 2>&1
import sys
sys.exit(0 if (sys.version_info.major, sys.version_info.minor) >= (3, 9) else 1)
PY
    then
      echo "${candidate}"
      return 0
    fi
  done

  if have_cmd python3; then
    candidate="$(command -v python3)"
    if "${candidate}" - <<'PY' >/dev/null 2>&1
import sys
sys.exit(0 if (sys.version_info.major, sys.version_info.minor) >= (3, 9) else 1)
PY
    then
      echo "${candidate}"
      return 0
    fi
  fi

  if have_cmd brew; then
    local brew_py=""
    if brew info python@3.11 >/dev/null 2>&1; then
      brew_py="$(brew --prefix python@3.11)/bin/python3.11"
      if [ -x "${brew_py}" ]; then
        echo "${brew_py}"
        return 0
      fi
    fi
  fi
  return 1
}

ensure_python() {
  load_brew_env
  local py_bin=""
  py_bin="$(detect_python_bin || true)"
  if [ -z "${py_bin}" ]; then
    if [ "${SKIP_TOOLCHAIN_INSTALL}" != "1" ]; then
      if have_cmd brew && brew info python@3.11 >/dev/null 2>&1; then
        if ensure_formula python@3.11; then
          export PATH="$(brew --prefix python@3.11)/bin:${PATH}"
        fi
      else
        ensure_formula python || true
      fi
      py_bin="$(detect_python_bin || true)"
    fi

    if [ -z "${py_bin}" ] && [ "${SKIP_TOOLCHAIN_INSTALL}" != "1" ]; then
      say "Homebrew Python unavailable, trying direct Python download ..."
      if install_local_python; then
        py_bin="${LOCAL_PYTHON_BIN}"
      fi
    fi
  fi

  if [ -z "${py_bin}" ]; then
    if [ "${SKIP_TOOLCHAIN_INSTALL}" = "1" ]; then
      fail "python 3.9+ is required. disable HOROSA_SKIP_TOOLCHAIN_INSTALL or provide python manually."
    fi
    fail "python 3.9+ is required. automatic install failed (Homebrew unavailable and direct download failed)."
  fi

  [ -n "${py_bin}" ] || fail "python 3.9+ not found."
  export HOROSA_BOOTSTRAP_PYTHON="${py_bin}"
}

python_has_runtime_deps() {
  local py_bin="$1"
  if [ ! -x "${py_bin}" ]; then
    return 1
  fi
  "${py_bin}" - <<'PY' >/dev/null 2>&1
import importlib.util as iu
mods = ("cherrypy", "jsonpickle", "swisseph", "joblib", "numpy", "scipy", "sklearn")
missing = [m for m in mods if iu.find_spec(m) is None]
raise SystemExit(1 if missing else 0)
PY
}

venv_has_runtime_deps() {
  python_has_runtime_deps "${VENV_DIR}/bin/python3"
}

venv_python_ready() {
  local py_bin="${VENV_DIR}/bin/python3"
  if [ ! -x "${py_bin}" ]; then
    return 1
  fi
  "${py_bin}" - <<'PY' >/dev/null 2>&1
import sys
raise SystemExit(0 if sys.executable else 1)
PY
}

ensure_python_venv() {
  mkdir -p "$(dirname "${VENV_DIR}")"

  if ! venv_python_ready; then
    if [ -d "${VENV_DIR}" ]; then
      say "recreating broken python virtualenv at ${VENV_DIR} ..."
      rm -rf "${VENV_DIR}"
    else
      say "creating python virtualenv at ${VENV_DIR} ..."
    fi
    "${HOROSA_BOOTSTRAP_PYTHON}" -m venv "${VENV_DIR}"
  fi

  if ! venv_python_ready; then
    say "creating python virtualenv at ${VENV_DIR} ..."
    "${HOROSA_BOOTSTRAP_PYTHON}" -m venv "${VENV_DIR}"
  fi

  local needs_pip_install="0"
  if [ ! -f "${VENV_DIR}/.requirements.stamp" ]; then
    needs_pip_install="1"
  elif [ "${REQ_FILE}" -nt "${VENV_DIR}/.requirements.stamp" ]; then
    needs_pip_install="1"
  elif ! venv_has_runtime_deps; then
    needs_pip_install="1"
  fi

  if [ "${needs_pip_install}" = "1" ]; then
    say "installing python dependencies ..."
    "${VENV_DIR}/bin/python3" -m pip install --upgrade pip setuptools wheel
    "${VENV_DIR}/bin/python3" -m pip install -r "${REQ_FILE}"
    touch "${VENV_DIR}/.requirements.stamp"
  fi
}

pick_existing_runtime_python() {
  local candidate=""
  local candidates=(
    "${RUNTIME_PYTHON_BIN}"
    "${LOCAL_PYTHON_BIN}"
    "${VENV_DIR}/bin/python3"
    "${HOROSA_BOOTSTRAP_PYTHON:-}"
  )

  for candidate in "${candidates[@]}"; do
    if [ -z "${candidate}" ]; then
      continue
    fi
    if python_has_runtime_deps "${candidate}"; then
      echo "${candidate}"
      return 0
    fi
  done

  return 1
}

frontend_needs_build() {
  if [ ! -f "${FRONTEND_INDEX}" ]; then
    return 0
  fi
  if [ -n "$(find "${UI_DIR}/src" -type f -newer "${FRONTEND_INDEX}" -print -quit 2>/dev/null)" ]; then
    return 0
  fi
  if [ -n "$(find "${UI_DIR}/public" -type f -newer "${FRONTEND_INDEX}" -print -quit 2>/dev/null)" ]; then
    return 0
  fi
  if [ "${UI_DIR}/package.json" -nt "${FRONTEND_INDEX}" ]; then
    return 0
  fi
  if [ -f "${UI_DIR}/.umirc.js" ] && [ "${UI_DIR}/.umirc.js" -nt "${FRONTEND_INDEX}" ]; then
    return 0
  fi
  if [ -f "${UI_DIR}/.umirc.ts" ] && [ "${UI_DIR}/.umirc.ts" -nt "${FRONTEND_INDEX}" ]; then
    return 0
  fi
  return 1
}

build_frontend_if_needed() {
  if [ ! -d "${UI_DIR}" ]; then
    fail "frontend directory not found: ${UI_DIR}"
  fi

  if [ ! -d "${UI_DIR}/node_modules" ]; then
    say "installing frontend dependencies ..."
    (cd "${UI_DIR}" && npm install --legacy-peer-deps)
  fi

  if frontend_needs_build; then
    say "building frontend dist-file ..."
    (cd "${UI_DIR}" && npm run build:file)
  else
    say "frontend dist-file is up to date."
  fi
}

backend_needs_build() {
  if [ ! -f "${BACKEND_JAR}" ]; then
    return 0
  fi
  if [ -n "$(find "${SERVER_DIR}" -path '*/src/*' -type f -newer "${BACKEND_JAR}" -print -quit 2>/dev/null)" ]; then
    return 0
  fi
  if [ -n "$(find "${SERVER_DIR}" -name 'pom.xml' -type f -newer "${BACKEND_JAR}" -print -quit 2>/dev/null)" ]; then
    return 0
  fi
  return 1
}

build_backend_if_needed() {
  if ! backend_needs_build; then
    say "backend jar is up to date."
    return
  fi

  local modules=(
    "boundless"
    "basecomm"
    "image"
    "astrostudy"
    "astrostudycn"
    "astroreader"
    "astrodeeplearn"
    "astroesp"
    "astrostudyboot"
  )

  say "building backend modules with Maven ..."
  local module
  for module in "${modules[@]}"; do
    if [ ! -d "${SERVER_DIR}/${module}" ]; then
      fail "missing backend module directory: ${module}"
    fi
    if [ "${module}" = "astrostudyboot" ]; then
      (cd "${SERVER_DIR}/${module}" && run_maven -DskipTests clean install)
    else
      (cd "${SERVER_DIR}/${module}" && run_maven -DskipTests install)
    fi
  done
}

installed_mongo_formula() {
  local candidates=(
    "mongodb-community"
    "mongodb-community@8.0"
    "mongodb-community@7.0"
    "mongodb-community@6.0"
  )
  local item
  for item in "${candidates[@]}"; do
    if brew list --formula "${item}" >/dev/null 2>&1; then
      echo "${item}"
      return 0
    fi
  done
  return 1
}

ensure_redis_and_mongo() {
  load_brew_env
  if ! have_cmd brew; then
    return
  fi

  ensure_formula redis
  if ! port_listening 6379; then
    say "starting redis service ..."
    brew services start redis >/dev/null 2>&1 || say "warning: failed to start redis service automatically."
  fi

  local mongo_formula=""
  mongo_formula="$(installed_mongo_formula || true)"
  if [ -z "${mongo_formula}" ]; then
    brew tap mongodb/brew >/dev/null 2>&1 || true
    local candidates=(
      "mongodb-community"
      "mongodb-community@8.0"
      "mongodb-community@7.0"
      "mongodb-community@6.0"
    )
    local candidate
    for candidate in "${candidates[@]}"; do
      if brew info "${candidate}" >/dev/null 2>&1; then
        say "installing ${candidate} ..."
        brew install "${candidate}"
        mongo_formula="${candidate}"
        break
      fi
    done
  fi

  if [ -n "${mongo_formula}" ] && ! port_listening 27017; then
    say "starting ${mongo_formula} service ..."
    brew services start "${mongo_formula}" >/dev/null 2>&1 || say "warning: failed to start mongodb service automatically."
  fi
}

main() {
  require_macos

  if [ ! -d "${PROJECT_DIR}" ]; then
    fail "project directory not found: ${PROJECT_DIR}"
  fi

  if [ "${SKIP_TOOLCHAIN_INSTALL}" != "1" ]; then
    if ! ensure_homebrew; then
      say "warning: Homebrew unavailable, continue with direct fallback installers."
    fi
  else
    load_brew_env
  fi

  ensure_java17
  ensure_python

  if [ "${SKIP_BUILD}" != "1" ]; then
    ensure_maven
    ensure_node
    ensure_python_venv
    export HOROSA_PYTHON="${VENV_DIR}/bin/python3"
    build_frontend_if_needed
    build_backend_if_needed
  else
    local runtime_py=""
    runtime_py="$(pick_existing_runtime_python || true)"
    if [ -n "${runtime_py}" ]; then
      export HOROSA_PYTHON="${runtime_py}"
      say "HOROSA_SKIP_BUILD=1, using existing python runtime: ${HOROSA_PYTHON}"
    else
      ensure_python_venv
      export HOROSA_PYTHON="${VENV_DIR}/bin/python3"
      say "HOROSA_SKIP_BUILD=1, skipped frontend/backend build."
    fi
  fi

  if [ "${SKIP_DB_SETUP}" != "1" ] && [ "${SKIP_TOOLCHAIN_INSTALL}" != "1" ]; then
    ensure_redis_and_mongo
  fi

  if [ "${SKIP_LAUNCH}" = "1" ]; then
    say "HOROSA_SKIP_LAUNCH=1, bootstrap completed without launching app."
    exit 0
  fi

  if [ -z "${HOROSA_PYTHON:-}" ]; then
    export HOROSA_PYTHON="${VENV_DIR}/bin/python3"
  fi
  say "starting local app ..."
  exec "${ROOT}/tools/mac/Horosa_Local.command" "$@"
}

main "$@"
