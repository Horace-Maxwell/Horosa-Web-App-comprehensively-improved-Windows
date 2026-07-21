#!/usr/bin/env bash
set -euo pipefail

# [U-I G1] locale 兜底:GUI(LaunchServices)拉起的进程通常无 LANG——非 ASCII(中文
# 用户名)home 路径在 Java/Python 子进程里有编解码风险;仅缺失时兜底,不覆盖显式设置。
if [ -z "${LANG:-}" ]; then export LANG=zh_CN.UTF-8; fi

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_ROOT="${HOROSA_LOG_ROOT:-${ROOT}/.horosa-local-logs}"
# 启动账本:Rust 壳在场时沿用其 HOROSA_RUN_TAG(四层同 run 聚合);独立跑脚本时自建。
RUN_TAG="${HOROSA_RUN_TAG:-$(date +%Y%m%d_%H%M%S)}"
LOG_DIR="${LOG_ROOT}/${RUN_TAG}"
# pid 文件定义在端口解析之后(带端口后缀,见下)——固定名会被并行实例互覆。
UI_DIR="${ROOT}/astrostudyui"
PY_LOG="${LOG_DIR}/astropy.log"
JAVA_LOG="${LOG_DIR}/astrostudyboot.log"
HTML_PATH="${UI_DIR}/dist-file/index.html"
PYTHON_BIN="${HOROSA_PYTHON:-python3}"
JAVA_BIN="${HOROSA_JAVA_BIN:-java}"
PYTHONPATH_ASTRO="${ROOT}/flatlib-ctrad2:${ROOT}/astropy:${ROOT}/vendor"
EXTRA_PY_SITE=""
# 首启(untrusted)预算更宽:含 324MB jar 首次拷贝 + JVM 冷启 + 杀软扫描,慢盘机器 180s 临界。
if [ "${HOROSA_TRUSTED_RUNTIME:-0}" = "1" ]; then
  STARTUP_TIMEOUT="${HOROSA_STARTUP_TIMEOUT:-180}"
else
  STARTUP_TIMEOUT="${HOROSA_STARTUP_TIMEOUT:-300}"
fi
SKIP_UI_BUILD="${HOROSA_SKIP_UI_BUILD:-0}"
SKIP_RUNTIME_WARMUP="${HOROSA_SKIP_RUNTIME_WARMUP:-0}"
CHART_PORT="${HOROSA_CHART_PORT:-8899}"
BACKEND_PORT="${HOROSA_SERVER_PORT:-9999}"
# pid 文件名带端口后缀=会话隔离(双实例/快切用户共用同一共享树时,固定名互覆 →
# 停服杀错对方实例或漏杀自己留僵尸;与 stop_horosa_local.sh 同一命名约定)。
PY_PID_FILE="${ROOT}/.horosa_py.${CHART_PORT}.pid"
JAVA_PID_FILE="${ROOT}/.horosa_java.${BACKEND_PORT}.pid"
DESKTOP_MONGO_OPTIONAL="${HOROSA_DESKTOP_MONGO_OPTIONAL:-1}"
# 本地文档缓存必须每用户独立:放共享树会让多用户并发读写同一 JSON(无文件锁)互踩。
MONGO_FALLBACK_DIR="${HOROSA_MONGO_FALLBACK_DIR:-${HOME}/.horosa-cache/mongo-fallback}"
NEED_TRANSLOG="${HOROSA_NEED_TRANSLOG:-false}"
ROOT_PARENT="$(cd "${ROOT}/.." && pwd)"
DIAG_DIR="${HOROSA_DIAG_DIR:-${ROOT_PARENT}/diagnostics}"
DIAG_FILE="${HOROSA_DIAG_FILE:-${DIAG_DIR}/horosa-run-issues.log}"
EMBEDDED_PY_REPAIR_HELPER="${ROOT}/scripts/repairEmbeddedPythonRuntime.py"
PYTHON_LAUNCH_NOUSERSITE="${PYTHONNOUSERSITE:-}"
REQUIRE_EMBEDDED_RUNTIME="${HOROSA_REQUIRE_EMBEDDED_RUNTIME:-0}"
DESKTOP_MONGO_SKIP_PING="${HOROSA_DESKTOP_MONGO_SKIP_PING:-0}"
DESKTOP_SPRING_LAZY_INIT="${HOROSA_DESKTOP_SPRING_LAZY_INIT:-1}"
DESKTOP_JAVA_FAST_START="${HOROSA_DESKTOP_JAVA_FAST_START:-1}"
DESKTOP_JAVA_EXTRA_TOOL_OPTIONS="${HOROSA_DESKTOP_JAVA_EXTRA_TOOL_OPTIONS:--XX:+UseSerialGC -Xverify:none -Xms128m -Xmx512m}"
# [V-5] 软 OOM 转硬死:JVM 默认 OOM 后进程苟活(抛 OOM 的线程死、身份线程仍答)——
# 看门狗探针恒 Ok,业务却半死。ExitOnOutOfMemoryError 让 OOM 即进程退 → TcpDead →
# 既有看门狗 40s 内自动拉起(前端自动换根+恢复提示)。HOROSA_JAVA_EXIT_ON_OOM=0 关。
if [ "${HOROSA_JAVA_EXIT_ON_OOM:-1}" = "1" ]; then
  case "${DESKTOP_JAVA_EXTRA_TOOL_OPTIONS}" in
    *ExitOnOutOfMemoryError*) : ;;
    *) DESKTOP_JAVA_EXTRA_TOOL_OPTIONS="${DESKTOP_JAVA_EXTRA_TOOL_OPTIONS} -XX:+ExitOnOutOfMemoryError" ;;
  esac
fi
TRUSTED_RUNTIME="${HOROSA_TRUSTED_RUNTIME:-0}"
ENABLE_STARTUP_CRON="${HOROSA_ENABLE_STARTUP_CRON:-0}"
ENABLE_STARTUP_TRANSGROUP_INIT="${HOROSA_ENABLE_STARTUP_TRANSGROUP_INIT:-0}"

if [ -z "${HOROSA_PYTHON:-}" ]; then
  # Prefer the complete embedded runtime (parallel to the embedded Java below); it ships every chart
  # dependency. Only fall back to the prepared venv when the embedded interpreter is absent.
  if [ -x "${ROOT_PARENT}/runtime/mac/python/bin/python3" ]; then
    PYTHON_BIN="${ROOT_PARENT}/runtime/mac/python/bin/python3"
  elif [ -x "${ROOT_PARENT}/.runtime/mac/venv/bin/python3" ]; then
    PYTHON_BIN="${ROOT_PARENT}/.runtime/mac/venv/bin/python3"
  fi
fi
if [ -z "${HOROSA_JAVA_BIN:-}" ] && [ -x "${ROOT_PARENT}/runtime/mac/java/bin/java" ]; then
  JAVA_BIN="${ROOT_PARENT}/runtime/mac/java/bin/java"
fi

if [ ! -f "${HTML_PATH}" ]; then
  HTML_PATH="${UI_DIR}/dist/index.html"
fi

mkdir -p "${LOG_DIR}"
mkdir -p "${DIAG_DIR}"
mkdir -p "$(dirname "${DIAG_FILE}")"

diag_log() {
  local msg="$1"
  printf '[%s] [start_horosa_local] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${msg}" >>"${DIAG_FILE}" 2>/dev/null || true
}

diag_tail() {
  local file="$1"
  local lines="${2:-80}"
  if [ ! -f "${file}" ]; then
    return
  fi
  diag_log "tail ${lines} lines: ${file}"
  while IFS= read -r line; do
    printf '[%s] [tail] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${line}" >>"${DIAG_FILE}" 2>/dev/null || true
  done < <(tail -n "${lines}" "${file}" 2>/dev/null || true)
}

# ── 结构化启动账本(sh 层写入端)──────────────────────────────────────────────
# 一行一段 JSON Lines,四层进程(Rust/shell/Java/Python)经 env 共享同一文件。
# 只在段边界打点(约 12 次),绝不进 0.1s 轮询体;HOROSA_STARTUP_LEDGER=0 总关。
STARTUP_LEDGER="${HOROSA_STARTUP_LEDGER:-1}"
LEDGER_FILE="${HOROSA_LEDGER_FILE:-${LOG_DIR}/horosa-startup-ledger.jsonl}"
export HOROSA_RUN_TAG="${RUN_TAG}"
export HOROSA_LEDGER_FILE="${LEDGER_FILE}"
export HOROSA_STARTUP_LEDGER="${STARTUP_LEDGER}"

_now_ms() {
  # bash5 $EPOCHREALTIME 优先(零进程);macOS /bin/bash 3.2 降级 perl Time::HiRes(系统自带,~5ms);
  # 再降 date 秒×1000。只在段边界调用,开销可忽略。
  if [ -n "${EPOCHREALTIME:-}" ]; then
    local s="${EPOCHREALTIME%.*}" us="${EPOCHREALTIME#*.}"
    printf '%s' "$(( s * 1000 + 10#${us:0:3} ))"
  elif command -v perl >/dev/null 2>&1; then
    perl -MTime::HiRes=time -e 'printf "%d", time()*1000'
  else
    printf '%s' "$(( $(date +%s) * 1000 ))"
  fi
}
SH_T0_MS="$(_now_ms)"

ledger_log() {
  # ledger_log <seg> [extra_json_object]
  [ "${STARTUP_LEDGER}" = "1" ] || return 0
  local seg="$1" extra="${2:-}" now t
  now="$(_now_ms)"
  t=$(( now - SH_T0_MS ))
  if [ -n "${extra}" ]; then
    printf '{"run":"%s","layer":"sh","seg":"%s","pid":%s,"t_ms":%s,"extra":%s}\n' \
      "${RUN_TAG}" "${seg}" "$$" "${t}" "${extra}" >>"${LEDGER_FILE}" 2>/dev/null || true
  else
    printf '{"run":"%s","layer":"sh","seg":"%s","pid":%s,"t_ms":%s}\n' \
      "${RUN_TAG}" "${seg}" "$$" "${t}" >>"${LEDGER_FILE}" 2>/dev/null || true
  fi
}
ledger_log sh.begin

diag_log "===== run begin pid=$$ cwd=${ROOT} ====="
diag_log "startup_timeout=${STARTUP_TIMEOUT} skip_ui_build=${SKIP_UI_BUILD} chart_port=${CHART_PORT} backend_port=${BACKEND_PORT} log_dir=${LOG_DIR} mongo_optional=${DESKTOP_MONGO_OPTIONAL} mongo_skip_ping=${DESKTOP_MONGO_SKIP_PING} trusted_runtime=${TRUSTED_RUNTIME} needtranslog=${NEED_TRANSLOG} require_embedded_runtime=${REQUIRE_EMBEDDED_RUNTIME} lazy_spring=${DESKTOP_SPRING_LAZY_INIT} java_fast_start=${DESKTOP_JAVA_FAST_START} startup_cron=${ENABLE_STARTUP_CRON} startup_transgroup=${ENABLE_STARTUP_TRANSGROUP_INIT}"

cleanup_metadata_files() {
  local root="$1"
  local cleaned="0"
  if [ ! -d "${root}" ]; then
    return 0
  fi
  # -prune 排除 .git/node_modules(dev 机几十万文件的无谓 stat;装机无这些目录,子句无害)
  cleaned="$(find "${root}" \( -name .git -o -name node_modules \) -prune -o \( -name '._*' -o -name '.DS_Store' \) -print 2>/dev/null | wc -l | tr -d ' ')"
  if [ "${cleaned}" = "0" ]; then
    return 0
  fi
  find "${root}" \( -name .git -o -name node_modules \) -prune -o \( -name '._*' -o -name '.DS_Store' \) -exec rm -rf {} + 2>/dev/null || true
  diag_log "removed ${cleaned} metadata junk entries under ${root}"
}

# WS-S1(2026-07-16):上面的全树递归 find 曾同步挡在启动前,实测是 preflight 97% 的税
# (冷 6.5s/暖 6.0s,runtime 79k 文件 stat 风暴,ladder 子段标记实证)。而 2026-03-09 事故
# (v1.0.1「backend start failed」)的真实致命面只有一处:内置 Python site-packages【顶层】
# 的 AppleDouble `.pth`(如 `._distutils-precedence.pth`)——Python site 模块只读目录顶层
# 的 .pth(非递归),读它必崩。其余 ._*/.DS_Store 对启动无害,只是垃圾。
# 故拆两段:同步只清致命面(毫秒级 glob),全树递归转后台(服务照常起,垃圾照清不留残)。
cleanup_critical_metadata() {
  local d
  for d in "${ROOT_PARENT}"/runtime/mac/python/lib/python*/site-packages \
           "${ROOT_PARENT}"/runtime/mac/python/Python.framework/Versions/*/lib/python*/site-packages \
           "${ROOT_PARENT}"/.runtime/mac/venv/lib/python*/site-packages; do
    [ -d "${d}" ] || continue
    rm -f "${d}"/._* "${d}"/.DS_Store 2>/dev/null || true
  done
}

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

# glob 清理所有会话的死 pid 文件(含旧版无后缀名与其他端口后缀;只清「pid 已死」的,
# 另一实例活着的 pid 文件原样保留)。
for stale_pid_file in "${ROOT}"/.horosa_py.pid "${ROOT}"/.horosa_java.pid \
  "${ROOT}"/.horosa_py.*.pid "${ROOT}"/.horosa_java.*.pid "${ROOT}"/.horosa_web.*.pid; do
  [ -e "${stale_pid_file}" ] || continue
  cleanup_stale_pid_file "${stale_pid_file}"
done
# 元数据清理三档(kill-switch:HOROSA_METADATA_CLEANUP_MODE):
#   fast(默认)=同步清致命面+全树转后台;full=旧行为全树同步(回退档);off=全关(排障)。
META_CLEANUP_MODE="${HOROSA_METADATA_CLEANUP_MODE:-fast}"
case "${META_CLEANUP_MODE}" in
  full)
    cleanup_metadata_files "${ROOT_PARENT}"
    ;;
  off)
    diag_log "metadata cleanup skipped (mode=off)"
    ;;
  *)
    cleanup_critical_metadata
    # 裸后台子 shell(同 maybe_train_cds_background 范式):脚本退出不 HUP,清理自行跑完
    ( cleanup_metadata_files "${ROOT_PARENT}" ) >/dev/null 2>&1 &
    diag_log "metadata cleanup: critical swept sync, full tree in background (mode=fast)"
    ;;
esac
# preflight 子段标记(2026-07-16):sh.begin→sh.preflight_done 曾是 13.2s 黑盒,无法归因。
# 各嫌疑段后打点,ladder 汇总即可读出段长(相邻标记 t_ms 差)。
ledger_log sh.meta_cleanup_done

port_listening() {
  local port="$1"
  # 弃用 lsof:此函数在就绪轮询循环里高频调用,lsof 遍历全系统进程 FD,遇到卡死进程
  # 单次可 stall 30~100s(实测,带 -n -P 也偶发)→ 启动假性卡死。netstat 只读内核表 ~0.006s。
  # ⚠️ awk 绝不提前 exit:本脚本 set -o pipefail,awk 早退会让 netstat 吃 SIGPIPE(141) →
  # 管道整体判失败 → 「端口在听也报未监听」。全新安装首启(untrusted)就绪门靠本函数,曾因此
  # 永卡「正在启动本地服务」(2026-06-12 实捕)。netstat 输出仅百余行,全量消费零成本。
  netstat -anv -p tcp 2>/dev/null \
    | awk -v port="${port}" '$6 == "LISTEN" && $4 ~ ("[.:]" port "$") { exit_found=1 }
                             END { exit exit_found ? 0 : 1 }'
}

http_responding() {
  local url="$1"
  if command -v curl >/dev/null 2>&1; then
    local code
    # --noproxy '*':用户环境的 http_proxy/HTTPS_PROXY/all_proxy 会把 127.0.0.1 探测劫持进代理 →
    # 服务在听也探不到 → 首启永不就绪(与 SIGPIPE 坑同症状,代理环境机器必中)。本地回环探测恒直连。
    code="$(curl -s --noproxy '*' -o /dev/null -m 3 --connect-timeout 1 -w '%{http_code}' "${url}" || true)"
    if [ -z "${code}" ] || [ "${code}" = "000" ]; then
      return 1
    fi
    return 0
  fi
  # 修法4:curl 缺失时改用内置 python urllib 探测,绝不静默放行(旧逻辑此处 return 0 会让就绪
  # 坍缩成「仅端口监听」,热身/就绪判定形同空转)。任何 HTTP 响应(含 4xx)即视为在监听。
  "${PYTHON_BIN}" - "${url}" <<'PY' >/dev/null 2>&1
import sys, urllib.request, urllib.error
# 显式禁代理:urllib 默认读 http_proxy 等 env,本地回环探测会被劫持(与 curl --noproxy 同理)。
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
try:
    opener.open(sys.argv[1], timeout=2)
except urllib.error.HTTPError:
    pass
except Exception:
    raise SystemExit(1)
raise SystemExit(0)
PY
}

signed_backend_http_responding() {
  local url="$1"
  local sig="9947b25d6400dac3e74fea88ec1a2308a2c9abf5f3a0cda32b7655717fa86278"
  if command -v curl >/dev/null 2>&1; then
    local code
    code="$(
      curl -s --noproxy '*' -o /dev/null -m 3 --connect-timeout 1 -w '%{http_code}' \
        -H "ClientChannel: 1" \
        -H "ClientApp: 1" \
        -H "ClientVer: 1.0" \
        -H "Signature: ${sig}" \
        "${url}" || true
    )"
    if [ -z "${code}" ] || [ "${code}" = "000" ] || [ "${code}" -ge 500 ]; then
      return 1
    fi
    return 0
  fi
  # 修法4:curl 缺失时用内置 python urllib 携同样签名头探测,绝不静默放行。>=500 视为未就绪。
  "${PYTHON_BIN}" - "${url}" "${sig}" <<'PY' >/dev/null 2>&1
import sys, urllib.request, urllib.error
url, sig = sys.argv[1], sys.argv[2]
req = urllib.request.Request(url, headers={'ClientChannel': '1', 'ClientApp': '1', 'ClientVer': '1.0', 'Signature': sig})
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))  # 禁代理,同上
try:
    resp = opener.open(req, timeout=2)
    code = getattr(resp, 'status', 200) or 200
except urllib.error.HTTPError as e:
    code = e.code
except Exception:
    raise SystemExit(1)
raise SystemExit(0 if code < 500 else 1)
PY
}

warm_runtime_routes() {
  local warmup_js="${UI_DIR}/scripts/warmHorosaRuntime.js"
  local warmup_log="${LOG_DIR}/runtime-warmup.log"

  if [ "${SKIP_RUNTIME_WARMUP}" = "1" ]; then
    diag_log "runtime warmup skipped by env"
    return 0
  fi
  if [ ! -f "${warmup_js}" ]; then
    diag_log "runtime warmup script missing: ${warmup_js}"
    return 0
  fi
  if ! command -v node >/dev/null 2>&1; then
    diag_log "runtime warmup skipped: node missing"
    return 0
  fi

  # 提速(更新后卡顿)B:预热改为后台非阻塞——首启不再为这 2–3s 多等。
  # 外层 ( … ) >/dev/null 2>&1 & 让后台子进程不继承脚本的 stdout/stderr(否则它会持有
  # Rust 端 command.output() 的 pipe 导致其迟迟不返回);node 自身另重定向到 warmup 日志,
  # diag_log 写独立日志文件,均不碰该 pipe。
  diag_log "runtime warmup begin (background)"
  (
    if HOROSA_SERVER_ROOT="http://127.0.0.1:${BACKEND_PORT}" node "${warmup_js}" >"${warmup_log}" 2>&1; then
      diag_log "runtime warmup done"
    else
      diag_log "runtime warmup failed"
      diag_tail "${warmup_log}" 120
    fi
  ) >/dev/null 2>&1 &
}

# 修法4:就绪后、导航前的「最小同步热身」——预热 Spring 懒加载的排盘 bean,让用户第一次排盘
# 不再打到冷 bean(否则首个 /chart 慢/报错 → 前端弹「本地排盘服务未就绪」)。
# 严格「非致命 + 有界」:后台跑 node 最小热身(仅 /chart),最多等 cap 秒,超时即杀并照常导航;
# 任何失败/缺 node/缺依赖只记日志、return 0,绝不拖慢或卡住启动(最坏=今天的冷启动行为)。
# 子进程 stdout/stderr 全部重定向到独立日志,绝不继承 Rust command.output() 的 pipe(同 warm_runtime_routes)。
warm_runtime_routes_min_sync() {
  local warmup_js="${UI_DIR}/scripts/warmHorosaRuntime.js"
  local warmup_log="${LOG_DIR}/runtime-warmup-min.log"
  # WS-3b cap auto 降级:AppCDS .jsa 已生成 = 非首启的暖机器,JVM/类加载早已热,
  # min-warmup 的边际收益骤降 → cap 5s→1s(ready 到可交互提前 ~4s);
  # 冷机器(首启,无 .jsa)保持 5s 原语义。显式 HOROSA_WARM_MIN_TIMEOUT 永远最高优先。
  local cap="${HOROSA_WARM_MIN_TIMEOUT:-}"
  if [ -z "${cap}" ]; then
    if [ -s "${BOOT_EXPLODED}/.app-cds.jsa" ]; then
      cap=1
    else
      cap=5
    fi
  fi
  if [ ! -f "${warmup_js}" ] || ! command -v node >/dev/null 2>&1; then
    diag_log "min sync warmup skipped (no script/node)"
    return 0
  fi
  diag_log "min sync warmup begin (cap=${cap}s)"
  (
    HOROSA_SERVER_ROOT="http://127.0.0.1:${BACKEND_PORT}" HOROSA_WARM_MINIMAL=1 \
      node "${warmup_js}" >"${warmup_log}" 2>&1
  ) >/dev/null 2>&1 &
  local wpid=$!
  local waited=0
  while kill -0 "${wpid}" >/dev/null 2>&1; do
    if [ "${waited}" -ge "${cap}" ]; then
      diag_log "min sync warmup exceeded ${cap}s -> kill, proceed anyway"
      kill "${wpid}" >/dev/null 2>&1 || true
      break
    fi
    sleep 1
    waited=$((waited + 1))
  done
  wait "${wpid}" 2>/dev/null || true
  diag_log "min sync warmup done (waited ${waited}s)"
  return 0
}

load_brew_env() {
  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

detect_brew_java_home() {
  local formula=""
  local prefix=""
  local candidate=""

  load_brew_env
  if command -v brew >/dev/null 2>&1; then
    for formula in openjdk@17 openjdk; do
      if brew list --formula "${formula}" >/dev/null 2>&1; then
        prefix="$(brew --prefix "${formula}" 2>/dev/null || true)"
        candidate="${prefix}/libexec/openjdk.jdk/Contents/Home"
        if [ -x "${candidate}/bin/java" ]; then
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
    if [ -x "${candidate}/bin/java" ]; then
      echo "${candidate}"
      return 0
    fi
  done

  return 1
}

java_bin_ready() {
  local java_bin="$1"
  if [ ! -x "${java_bin}" ]; then
    return 1
  fi
  # 直接探测 java 自身（Mac issue #10）：曾经把 `-version` 委托给 /usr/bin/python3 子进程，
  # 但在「未安装 Xcode Command Line Tools」的 Mac 上 /usr/bin/python3 只是个会弹安装框、
  # 返回非零的桩——于是即使内置 java 完全可执行（ARM64 17.x），探测也被该桩拖成失败，
  # 叠加 REQUIRE_EMBEDDED_RUNTIME 严格模式 → 误报 "java runtime not found"，软件起不来。
  # 该 python 包装并无超时等额外保护，与直接 `java -version` 行为等价，故移除该脆弱依赖。
  "${java_bin}" -version >/dev/null 2>&1
}

resolve_java_bin() {
  local java_home=""
  local resolved_bin=""

  if [ "${TRUSTED_RUNTIME}" = "1" ] && [ "${REQUIRE_EMBEDDED_RUNTIME}" = "1" ] && [ -x "${JAVA_BIN}" ]; then
    return 0
  fi

  if java_bin_ready "${JAVA_BIN}"; then
    return 0
  fi

  if [ "${REQUIRE_EMBEDDED_RUNTIME}" = "1" ]; then
    diag_log "java strict mode enabled; refusing fallback away from ${JAVA_BIN}"
    return 1
  fi

  if command -v "${JAVA_BIN}" >/dev/null 2>&1; then
    resolved_bin="$(command -v "${JAVA_BIN}")"
    if java_bin_ready "${resolved_bin}"; then
      JAVA_BIN="${resolved_bin}"
      return 0
    fi
  fi

  if [ -n "${JAVA_HOME:-}" ] && java_bin_ready "${JAVA_HOME}/bin/java"; then
    JAVA_BIN="${JAVA_HOME}/bin/java"
    export PATH="${JAVA_HOME}/bin:${PATH}"
    return 0
  fi

  if command -v /usr/libexec/java_home >/dev/null 2>&1; then
    java_home="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
    if [ -n "${java_home}" ] && java_bin_ready "${java_home}/bin/java"; then
      export JAVA_HOME="${java_home}"
      export PATH="${JAVA_HOME}/bin:${PATH}"
      JAVA_BIN="${JAVA_HOME}/bin/java"
      return 0
    fi
  fi

  java_home="$(detect_brew_java_home 2>/dev/null || true)"
  if [ -n "${java_home}" ] && java_bin_ready "${java_home}/bin/java"; then
    export JAVA_HOME="${java_home}"
    export PATH="${JAVA_HOME}/bin:${PATH}"
    JAVA_BIN="${JAVA_HOME}/bin/java"
    return 0
  fi

  if command -v java >/dev/null 2>&1; then
    resolved_bin="$(command -v java)"
    if java_bin_ready "${resolved_bin}"; then
      JAVA_BIN="${resolved_bin}"
      return 0
    fi
  fi

  return 1
}

python_runtime_ready() {
  local py_bin="$1"
  local py_minor=""
  local extra_site=""
  local py_path="${PYTHONPATH_ASTRO}"
  local py_root=""
  local use_embedded_runtime="0"

  if [ ! -x "${py_bin}" ]; then
    return 1
  fi

  py_root="$(cd "$(dirname "${py_bin}")/.." 2>/dev/null && pwd)"
  if [ -n "${py_root}" ] && [ -f "${py_root}/Python" ] && [ -d "${py_root}/lib" ]; then
    use_embedded_runtime="1"
  fi

  py_minor="$("${py_bin}" - <<'PY'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}")
PY
)" || return 1

  if [ "${use_embedded_runtime}" != "1" ]; then
    extra_site="${HOME}/Library/Python/${py_minor}/lib/python/site-packages"
    if [ -d "${extra_site}" ]; then
      py_path="${py_path}:${extra_site}"
    fi
    if [ -n "${PYTHONPATH:-}" ]; then
      py_path="${py_path}:${PYTHONPATH}"
    fi
  fi

  PYTHONPATH="${py_path}" PYTHONNOUSERSITE="$([ "${use_embedded_runtime}" = "1" ] && printf '1' || printf '%s' "${PYTHONNOUSERSITE:-}")" "${py_bin}" - <<'PY' >/dev/null 2>&1
import importlib.util as iu
# Load-bearing imports for the chart service at boot. cn2an/sxtwl/cnlunar are imported eagerly, so a
# python that has cherrypy/jsonpickle/swisseph but lacks these still crashes — reject it here.
mods = ("cherrypy", "jsonpickle", "swisseph", "cn2an", "sxtwl", "cnlunar")
missing = [m for m in mods if iu.find_spec(m) is None]
raise SystemExit(1 if missing else 0)
PY
}

repair_embedded_python_runtime() {
  local py_bin="$1"
  local py_root=""

  if [ ! -f "${EMBEDDED_PY_REPAIR_HELPER}" ]; then
    return 1
  fi
  if [ ! -x /usr/bin/python3 ]; then
    return 1
  fi
  if [ ! -x "${py_bin}" ]; then
    return 1
  fi

  py_root="$(cd "$(dirname "${py_bin}")/.." 2>/dev/null && pwd)"
  if [ -z "${py_root}" ] || [ ! -f "${py_root}/Python" ] || [ ! -d "${py_root}/lib" ]; then
    return 1
  fi

  diag_log "repair embedded python runtime links: ${py_root}"
  /usr/bin/python3 "${EMBEDDED_PY_REPAIR_HELPER}" --repair "${py_root}" >>"${DIAG_FILE}" 2>&1
}

resolve_python_bin() {
  local root_parent=""
  local candidate=""
  local resolved=""

  if [ "${TRUSTED_RUNTIME}" = "1" ] && [ "${REQUIRE_EMBEDDED_RUNTIME}" = "1" ] && [ -x "${PYTHON_BIN}" ]; then
    return 0
  fi

  root_parent="$(cd "${ROOT}/.." && pwd)"
  local candidates=(
    "${PYTHON_BIN}"
    "${root_parent}/runtime/mac/python/bin/python3"
    "${root_parent}/.runtime/mac/venv/bin/python3"
  )

  if [ "${REQUIRE_EMBEDDED_RUNTIME}" = "1" ]; then
    # 严格模式与 resolve_java_bin 对称:只认内嵌解释器,绝不追加 PATH 上的 python3/python。
    # 无 Xcode CLT 的 Mac 上 /usr/bin/python3 是会弹安装框的桩(见 java_bin_ready 注释),
    # 内嵌探测一失败就滑去执行它 = 用户看到系统弹框 + 启动误判失败。
    candidates=("${PYTHON_BIN}")
  else
    if command -v python3 >/dev/null 2>&1; then
      candidates+=("$(command -v python3)")
    fi
    if command -v python >/dev/null 2>&1; then
      candidates+=("$(command -v python)")
    fi
  fi

  for candidate in "${candidates[@]}"; do
    if [ -z "${candidate}" ]; then
      continue
    fi

    resolved="${candidate}"
    if [ ! -x "${resolved}" ]; then
      if command -v "${resolved}" >/dev/null 2>&1; then
        resolved="$(command -v "${resolved}")"
      else
        continue
      fi
    fi

    if python_runtime_ready "${resolved}"; then
      PYTHON_BIN="${resolved}"
      return 0
    fi

    if repair_embedded_python_runtime "${resolved}" && python_runtime_ready "${resolved}"; then
      diag_log "python runtime recovered after relink repair: ${resolved}"
      PYTHON_BIN="${resolved}"
      return 0
    fi
  done

  if [ "${REQUIRE_EMBEDDED_RUNTIME}" = "1" ]; then
    diag_log "python strict mode enabled; refusing fallback away from ${PYTHON_BIN}"
  fi
  return 1
}

frontend_needs_build() {
  local dist_index="${UI_DIR}/dist-file/index.html"
  if [ ! -f "${dist_index}" ]; then
    return 0
  fi
  if [ -n "$(find "${UI_DIR}/src" -type f -newer "${dist_index}" -print -quit 2>/dev/null)" ]; then
    return 0
  fi
  if [ -d "${UI_DIR}/public" ] && [ -n "$(find "${UI_DIR}/public" -type f -newer "${dist_index}" -print -quit 2>/dev/null)" ]; then
    return 0
  fi
  if [ -f "${UI_DIR}/package.json" ] && [ "${UI_DIR}/package.json" -nt "${dist_index}" ]; then
    return 0
  fi
  if [ -f "${UI_DIR}/.umirc.js" ] && [ "${UI_DIR}/.umirc.js" -nt "${dist_index}" ]; then
    return 0
  fi
  if [ -f "${UI_DIR}/.umirc.ts" ] && [ "${UI_DIR}/.umirc.ts" -nt "${dist_index}" ]; then
    return 0
  fi
  return 1
}

ensure_frontend_build() {
  local dist_file_index="${UI_DIR}/dist-file/index.html"
  local dist_index="${UI_DIR}/dist/index.html"

  if [ "${SKIP_UI_BUILD}" = "1" ]; then
    if [ -f "${dist_file_index}" ]; then
      HTML_PATH="${dist_file_index}"
      return
    fi
    if [ -f "${dist_index}" ]; then
      HTML_PATH="${dist_index}"
      return
    fi
    echo "missing frontend index.html under ${UI_DIR}/dist-file or ${UI_DIR}/dist."
    echo "HOROSA_SKIP_UI_BUILD=1 is set, but no prebuilt frontend bundle is available."
    exit 1
  fi

  if frontend_needs_build; then
    if ! command -v npm >/dev/null 2>&1; then
      if [ -f "${dist_file_index}" ] || [ -f "${dist_index}" ]; then
        echo "warning: frontend source changed but npm is unavailable; using existing bundle."
      else
        echo "missing frontend bundle and npm is unavailable."
        exit 1
      fi
    else
      echo "frontend source changed, rebuilding dist-file ..."
      (
        cd "${UI_DIR}"
        if [ ! -d node_modules ]; then
          npm install --legacy-peer-deps
        fi
        npm run build:file
      )
    fi
  fi

  if [ -f "${dist_file_index}" ]; then
    HTML_PATH="${dist_file_index}"
  elif [ -f "${dist_index}" ]; then
    HTML_PATH="${dist_index}"
  else
    echo "missing frontend index.html under ${UI_DIR}/dist-file or ${UI_DIR}/dist."
    exit 1
  fi
}

# 修法3:卡死的「自己人」后端精准清除（取代旧 prune_stale_pid_file「判存活」逻辑:
# 旧逻辑见自家 pid 存活即 exit 1「已在运行」,会被上次没杀净的自家残留后端永久拦住启动）。
# 当 pid 文件里的进程仍存活时,旧逻辑直接 exit 1「已在运行」——但若那是上次 stop 没杀干净的
# 「我们自己的」残留后端(stop_runtime 偶发失败/被 kill -9 中断),会永久拦住本次启动。
# 这里在「确实存活」时,用 cmdline 签名核实它是不是我们自己的后端:
#   是 → kill -9 它并清文件、继续启动(窄而稳:只杀这一个、经 pid 文件 + 签名双重核实);
#   不是(pid 被系统回收给了别的无关进程)→ 维持今天的 exit 1,绝不误杀。
reclaim_or_block_pid_file() {
  local pid_file="$1"
  local sig="$2"
  [ -f "${pid_file}" ] || return 0
  local pid
  pid="$(tr -dc '0-9' <"${pid_file}" 2>/dev/null)"
  if [ -z "${pid}" ] || ! kill -0 "${pid}" >/dev/null 2>&1; then
    rm -f "${pid_file}"
    return 0
  fi
  local cmd
  cmd="$(ps -p "${pid}" -o command= 2>/dev/null || true)"
  if printf '%s\n' "${cmd}" | grep -Eq "${sig}"; then
    diag_log "reclaim own live backend pid=${pid} (${pid_file}) sig=${sig}"
    kill -9 "${pid}" >/dev/null 2>&1 || true
    rm -f "${pid_file}"
    return 0
  fi
  diag_log "pid ${pid} alive but NOT our backend; refuse to kill (cmd: ${cmd})"
  return 1
}
runtime_already_live=0
reclaim_or_block_pid_file "${PY_PID_FILE}" 'webchartsrv\.py' || runtime_already_live=1
reclaim_or_block_pid_file "${JAVA_PID_FILE}" 'astrostudyboot\.jar|-Dhorosa\.runtime\.owner=horosa-desktop' || runtime_already_live=1
if [ "${runtime_already_live}" = "1" ]; then
  diag_log "blocked: a non-horosa live process holds our pid file"
  echo "horosa runtime pid is held by a foreign process. run ./stop_horosa_local.sh first."
  exit 1
fi

if ! [[ "${STARTUP_TIMEOUT}" =~ ^[0-9]+$ ]] || [ "${STARTUP_TIMEOUT}" -lt 30 ]; then
  STARTUP_TIMEOUT=180
fi

# 端口被占(合并 astro-progression 的 reclaim_stale_port + 修法2 的 exit 3):
# 先回收「我们自己的僵尸」(命令行含 tag,绝不误杀第三方),回收后等端口释放;
# 若回收后仍被占(非 Horosa 进程 / 回收失败)→ exit 3(可重试),让 Rust 端换一对全新空闲端口重试,
# 而非直接 exit 1 报死(两套端口健壮性合一:先清自家僵尸,清不掉再换口)。
reclaim_stale_port() {
  local port="$1" tag="$2" pids pid cmd killed=0
  port_listening "${port}" || return 0
  # 弃用 lsof(全进程 FD 扫描可 stall 数十秒),netstat 读内核表取监听 pid(列布局见 stop 脚本同名注释)。
  pids="$(netstat -anv -p tcp 2>/dev/null | awk -v port="${port}" '$6 == "LISTEN" && $4 ~ ("[.:]" port "$") { print $11 }' | sort -u)"
  for pid in ${pids}; do
    cmd="$(ps -p "${pid}" -o command= 2>/dev/null | tr 'A-Z' 'a-z')"
    case "${cmd}" in
      *"${tag}"*)
        diag_log "reclaiming stale ${tag} pid=${pid} on port ${port}"
        kill -9 "${pid}" >/dev/null 2>&1 && killed=1 ;;
    esac
  done
  if [ "${killed}" = "1" ]; then
    for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
      port_listening "${port}" || return 0
      sleep 0.3
    done
  fi
  port_listening "${port}" && return 1 || return 0
}

# [S2] 双端口回收并行:两次 netstat 互不依赖,并行省一截串行等待(语义逐口不变,exit 3 照旧)。
reclaim_stale_port "${CHART_PORT}" "webchartsrv" &
_rc_chart_pid=$!
reclaim_stale_port "${BACKEND_PORT}" "astrostudyboot" &
_rc_backend_pid=$!
_rc_chart=0; wait "${_rc_chart_pid}" || _rc_chart=$?
_rc_backend=0; wait "${_rc_backend_pid}" || _rc_backend=$?
if [ "${_rc_chart}" != "0" ]; then
  diag_log "blocked: port ${CHART_PORT} still in use after reclaim -> exit 3 (retryable)"
  echo "port ${CHART_PORT} is already in use."
  echo "端口冲突(退出码 3=可重试):换端口重试,或先运行 stop_horosa_local.sh。Port conflict (exit 3 = retryable)."
  exit 3
fi
if [ "${_rc_backend}" != "0" ]; then
  diag_log "blocked: port ${BACKEND_PORT} still in use after reclaim -> exit 3 (retryable)"
  echo "port ${BACKEND_PORT} is already in use."
  echo "端口冲突(退出码 3=可重试):换端口重试,或先运行 stop_horosa_local.sh。Port conflict (exit 3 = retryable)."
  exit 3
fi

JAR="${ROOT}/astrostudysrv/astrostudyboot/target/astrostudyboot.jar"
BUNDLE_JAR="${ROOT}/../runtime/mac/bundle/astrostudyboot.jar"

# ── Java exploded 启动(性能):打包产物 bundle/boot-exploded = fat jar 原样解开。
# 嵌套 jar 的 NestedJarFile 读取是启动主开销(实测 fat jar 7.0s → exploded 2.6s,同字节同源)。
# exploded 存在即优先(HOROSA_JAVA_EXPLODED=0 可关);dev 机无该目录 → 自动走旧 fat-jar 路径,零变化。
BOOT_EXPLODED="${ROOT}/../runtime/mac/bundle/boot-exploded"
JAVA_EXPLODED_MODE=0
if [ "${HOROSA_JAVA_EXPLODED:-1}" = "1" ] && [ -f "${BOOT_EXPLODED}/org/springframework/boot/loader/JarLauncher.class" ]; then
  JAVA_EXPLODED_MODE=1
  # 保鲜守卫(dev 机):target jar 比 exploded 新说明后端刚重建而 exploded 是旧的 →
  # 自动回退 fat-jar 路径,绝不跑旧代码。用户机无 target jar,不触发。
  if [ -f "${JAR}" ] && [ "${JAR}" -nt "${BOOT_EXPLODED}/META-INF/MANIFEST.MF" ]; then
    diag_log "java exploded stale vs target jar -> fallback to fat-jar path"
    diag_log "  (dev 机修复: bash Horosa_Desktop_Installer/scripts/refresh_boot_exploded.sh)"
    JAVA_EXPLODED_MODE=0
  else
    diag_log "java exploded mode ON: ${BOOT_EXPLODED}"
  fi
fi
# 🔴 档位入账:fat-jar 回退与 exploded 是两条性能宇宙(7.0s vs 2.6s)。2026-07-15 曾整轮
# ladder 全跑在回退档还当装机真值分析 —— 档位必须进账本,ladder 汇总据此醒目告警。
ledger_log sh.java_mode "{\"exploded\":${JAVA_EXPLODED_MODE}}"

if [ "${JAVA_EXPLODED_MODE}" != "1" ] && [ -f "${BUNDLE_JAR}" ]; then
  if [ ! -f "${JAR}" ]; then
    diag_log "target jar missing, fallback to bundled jar: ${BUNDLE_JAR}"
    echo "backend target jar missing, using bundled jar fallback."
    if ! mkdir -p "$(dirname "${JAR}")"; then
      diag_log "jar dir create FAILED (权限/磁盘?): $(dirname "${JAR}") — 多用户场景需 postinstall a+rwX"
      echo "cannot create jar dir (permission/disk?): $(dirname "${JAR}")"
      exit 1
    fi
    if ! cp -f "${BUNDLE_JAR}" "${JAR}"; then
      diag_log "jar copy FAILED (磁盘满/权限?): ${BUNDLE_JAR} -> ${JAR} (df: $(df -h "$(dirname "${JAR}")" 2>/dev/null | tail -1 || true))"
      echo "cannot copy backend jar (disk full / permission denied?)"
      rm -f "${JAR}" 2>/dev/null || true
      exit 1
    fi
    # 多用户机权限延续:首拷 jar/目录按本用户 umask 归私有,别的用户会卡在上方两个分支。
    chmod a+rwX "$(dirname "${JAR}")" 2>/dev/null || true
    chmod a+rw "${JAR}" 2>/dev/null || true
  elif [ "${BUNDLE_JAR}" -nt "${JAR}" ] && ! cmp -s "${BUNDLE_JAR}" "${JAR}"; then
    diag_log "bundled jar newer than target jar, refreshing target from bundle"
    if ! cp -f "${BUNDLE_JAR}" "${JAR}"; then
      diag_log "jar refresh FAILED (磁盘满/权限?): ${BUNDLE_JAR} -> ${JAR}"
      echo "cannot refresh backend jar (disk full / permission denied?)"
      exit 1
    fi
    chmod a+rw "${JAR}" 2>/dev/null || true
  fi
fi
if [ "${JAVA_EXPLODED_MODE}" != "1" ] && [ ! -f "${JAR}" ]; then
  diag_log "missing jar after fallback: ${JAR}"
  echo "missing ${JAR}"
  echo "请先回到仓库根目录执行："
  echo "  ../Horosa_OneClick_Mac.command"
  echo "高级离线打包工具："
  echo "  ../tools/mac/Prepare_Runtime_Mac.command"
  exit 1
fi

if ! resolve_java_bin; then
  diag_log "java resolve failed: ${JAVA_BIN}"
  echo "java runtime not found: ${JAVA_BIN}"
  echo "install java 17+ or run ../Horosa_OneClick_Mac.command"
  exit 1
fi
if [ "${TRUSTED_RUNTIME}" = "1" ] && [ "${REQUIRE_EMBEDDED_RUNTIME}" = "1" ] && [ -x "${JAVA_BIN}" ]; then
  diag_log "java trusted-runtime fast path enabled: ${JAVA_BIN}"
fi
diag_log "java resolved: ${JAVA_BIN}"
ledger_log sh.java_resolve_done

if ! resolve_python_bin; then
  diag_log "python resolve failed: ${PYTHON_BIN}"
  echo "python runtime not ready: ${PYTHON_BIN}"
  echo "install runtime deps or run ../Horosa_OneClick_Mac.command"
  exit 1
fi
if [ "${TRUSTED_RUNTIME}" = "1" ] && [ "${REQUIRE_EMBEDDED_RUNTIME}" = "1" ] && [ -x "${PYTHON_BIN}" ]; then
  diag_log "python trusted-runtime fast path enabled: ${PYTHON_BIN}"
fi
diag_log "python resolved: ${PYTHON_BIN}"

PY_ROOT="$(cd "$(dirname "${PYTHON_BIN}")/.." 2>/dev/null && pwd || true)"
if [ -n "${PY_ROOT}" ] && [ -f "${PY_ROOT}/Python" ] && [ -d "${PY_ROOT}/lib" ]; then
  PYTHON_LAUNCH_NOUSERSITE="1"
  diag_log "python launch isolation enabled for embedded runtime: ${PY_ROOT}"
fi

# [S2] PY_MINOR 探测下沉:嵌入式隔离(PYTHON_LAUNCH_NOUSERSITE=1,桌面 trusted 常态)下
# EXTRA_PY_SITE 根本不进 PYTHONPATH —— 旧式无条件 spawn 一次 python 纯属白付(~50-80ms)。
# 仅非隔离(dev 系统 python)才探测用户 site 目录;行为对两种模式逐字节不变。
if [ "${PYTHON_LAUNCH_NOUSERSITE}" != "1" ]; then
  PY_MINOR="$("${PYTHON_BIN}" - <<'PY'
import sys
print(f"{sys.version_info.major}.{sys.version_info.minor}")
PY
)"
  EXTRA_PY_SITE="${HOME}/Library/Python/${PY_MINOR}/lib/python/site-packages"
  if [ -d "${EXTRA_PY_SITE}" ]; then
    PYTHONPATH_ASTRO="${PYTHONPATH_ASTRO}:${EXTRA_PY_SITE}"
  fi
  if [ -n "${PYTHONPATH:-}" ]; then
    PYTHONPATH_ASTRO="${PYTHONPATH_ASTRO}:${PYTHONPATH}"
  fi
fi
ledger_log sh.python_resolve_done

cleanup_on_fail() {
  local code=$?
  if [ "${code}" -ne 0 ]; then
    local _pid
    if [ -s "${JAVA_PID_FILE}" ]; then
      _pid="$(cat "${JAVA_PID_FILE}" 2>/dev/null || true)"
      case "${_pid}" in (''|*[!0-9]*) : ;; (*) kill "${_pid}" >/dev/null 2>&1 || true ;; esac
    fi
    rm -f "${JAVA_PID_FILE}" 2>/dev/null || true
    if [ -s "${PY_PID_FILE}" ]; then
      _pid="$(cat "${PY_PID_FILE}" 2>/dev/null || true)"
      case "${_pid}" in (''|*[!0-9]*) : ;; (*) kill "${_pid}" >/dev/null 2>&1 || true ;; esac
    fi
    rm -f "${PY_PID_FILE}" 2>/dev/null || true
  fi
  return "${code}"
}
trap cleanup_on_fail EXIT

launch_detached() {
  local log_file="$1"
  shift
  "${PYTHON_BIN}" - "${log_file}" "$@" <<'PY'
import subprocess
import sys

log_path = sys.argv[1]
cmd = sys.argv[2:]

with open(log_path, "ab", buffering=0) as fh:
    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.DEVNULL,
        stdout=fh,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        close_fds=True,
    )

print(proc.pid)
PY
}

cd "${ROOT}"
# pid 文件读取防御:文件缺失/为空/非数字时不得把空串喂给 kill -0(会报 usage 错→被误读成「进程已退出」)。
pid_alive() {
  local f="$1" pid
  [ -s "${f}" ] || return 1
  pid="$(cat "${f}" 2>/dev/null || true)"
  case "${pid}" in (''|*[!0-9]*) return 1 ;; esac
  kill -0 "${pid}" >/dev/null 2>&1
}

# [S1] Java 早生:Java 是启动唯一大墙(spawn→http ready ~2.5s),旧序里它在 前端检查/
# Python 组装/Python spawn 之后才出生(账本实测 ~468ms)。此处把 Java 组装+spawn 提到
# 最前(其全部前置=pid/端口回收+java/python resolve+trap,均已就绪),前端检查与 Python
# 组装转到 Java 出生之后进行 —— 纯重排零语义变化;失败路径由既有 trap cleanup_on_fail 兜。
# horosa_web_java_env_sanitize_v1:宿主毒化变量剥离 —— 装了 IDE/安卓工具链的机器常见全局
# _JAVA_OPTIONS/JAVA_TOOL_OPTIONS(如 -Xmx32m),JVM 会无条件并入启动参数;CLASSPATH 同理。
# 与桌面启动器 sanitizeEmbeddedRuntimeEnv 同语义;env -u 在 macOS/Git Bash 均支持。
JAVA_LAUNCH_CMD=(env -u _JAVA_OPTIONS -u JAVA_TOOL_OPTIONS -u JDK_JAVA_OPTIONS -u CLASSPATH \
  HOROSA_DESKTOP_MONGO_OPTIONAL="${DESKTOP_MONGO_OPTIONAL}" \
  HOROSA_DESKTOP_MONGO_SKIP_PING="${DESKTOP_MONGO_SKIP_PING}" \
  HOROSA_MONGO_FALLBACK_DIR="${MONGO_FALLBACK_DIR}" \
  HOROSA_ENABLE_STARTUP_CRON="${ENABLE_STARTUP_CRON}" \
  HOROSA_ENABLE_STARTUP_TRANSGROUP_INIT="${ENABLE_STARTUP_TRANSGROUP_INIT}" \
  needtranslog="${NEED_TRANSLOG}")

if [ "${DESKTOP_JAVA_FAST_START}" = "1" ]; then
  # [S3] banner-mode=off:省 Spring 启动横幅的构造/打日志(纯装饰输出,语义零变化)。
  JAVA_FAST_TOOL_OPTIONS="-Dlog4j2.statusLevel=WARN -Djava.awt.headless=true -Djava.security.egd=file:/dev/./urandom -Dspring.backgroundpreinitializer.ignore=true -Dspring.main.banner-mode=off"
  if [ "${JAVA_EXPLODED_MODE}" != "1" ]; then
    # 旧 fat-jar 路径原样保留 C1 快启;exploded 路径不再限档(C2 全速:启动 2.6s 仍远快于旧 7.0s,
    # 计算吞吐实测 641→680 rps,双赢。实测表见 perf 基线 CSV)。
    JAVA_FAST_TOOL_OPTIONS="${JAVA_FAST_TOOL_OPTIONS} -XX:TieredStopAtLevel=1"
  fi
  if [ -n "${DESKTOP_JAVA_EXTRA_TOOL_OPTIONS}" ]; then
    JAVA_FAST_TOOL_OPTIONS="${JAVA_FAST_TOOL_OPTIONS} ${DESKTOP_JAVA_EXTRA_TOOL_OPTIONS}"
  fi
  JAVA_LAUNCH_CMD+=(
    JAVA_TOOL_OPTIONS="${JAVA_FAST_TOOL_OPTIONS}"
  )
fi

if [ "${DESKTOP_SPRING_LAZY_INIT}" = "1" ]; then
  JAVA_LAUNCH_CMD+=(
    SPRING_MAIN_LAZY_INITIALIZATION=true
  )
fi

# #9:让内置 Java 自动走 macOS/Windows 系统代理(getHttpHost/流式 client 经 ProxySelector 取用)。
# localhost/127.0.0.1 默认 bypass,本地 :9999/:8899 不受影响;无系统代理则等同直连。
# 运行环境确定性(全球任意系统设置下行为一致):
# · -Duser.language/-Duser.country 钉死 JVM locale——泰语系统 JVM 默认历法是佛历
#   (SimpleDateFormat 年+543)、土耳其语 i 大小写特例、阿拉伯语数字符号,全类灭除;
#   不钉 user.timezone(「当前时间」类功能须跟系统时区)。
# · paramhash.cache.redis.enable=false(-D 与 -- 双保险)——桌面模式绝不触碰 :6379,
#   与用户自装 Redis 零交互;paramhash 缓存走纯本地层(getFromLocal 独立可用)。
CDS_JSA="${BOOT_EXPLODED}/.app-cds.jsa"
# ⚠️ CDS 铁律:JDK 对 classpath「目录」做 dump 校验(non-empty directory 拒绝),唯 `-cp .`
# 豁免;且运行加载 .jsa 的 classpath 必须与训练一致 → exploded 的训练与运行都固定为
# 「cd boot-exploded && java -cp . JarLauncher」,用 bash -c 'cd "$0" && exec "$@"' 包一层。
if [ "${JAVA_EXPLODED_MODE}" = "1" ] && [ "${HOROSA_JAVA_CDS:-1}" = "1" ] && [ -s "${CDS_JSA}" ]; then
  # exploded + AppCDS(.jsa 由首启后台自训练产出;archive 失配时 JVM 自动忽略退普通启动,天然安全)
  diag_log "java launch: exploded + AppCDS (${CDS_JSA})"
  JAVA_LAUNCH_CMD+=(
    /bin/bash -c 'cd "$0" && exec "$@"' "${BOOT_EXPLODED}"
    "${JAVA_BIN}" -XX:SharedArchiveFile="${CDS_JSA}" -Xlog:cds=off
    -Djava.net.useSystemProxies=true "-Dhttp.nonProxyHosts=localhost|127.*|[::1]" -Dhorosa.runtime.owner=horosa-desktop
    -Duser.language=zh -Duser.country=CN -Dfile.encoding=UTF-8 -Dsun.jnu.encoding=UTF-8 -Dparamhash.cache.redis.enable=false
    -cp . org.springframework.boot.loader.JarLauncher
    --server.port="${BACKEND_PORT}"
    --server.address=127.0.0.1
    --astrosrv=http://127.0.0.1:${CHART_PORT}
    --mongodb.ip=127.0.0.1
    --redis.ip=127.0.0.1
    --paramhash.cache.redis.enable=false
  )
elif [ "${JAVA_EXPLODED_MODE}" = "1" ]; then
  diag_log "java launch: exploded (no CDS yet)"
  JAVA_LAUNCH_CMD+=(
    /bin/bash -c 'cd "$0" && exec "$@"' "${BOOT_EXPLODED}"
    "${JAVA_BIN}" -Djava.net.useSystemProxies=true "-Dhttp.nonProxyHosts=localhost|127.*|[::1]" -Dhorosa.runtime.owner=horosa-desktop
    -Duser.language=zh -Duser.country=CN -Dfile.encoding=UTF-8 -Dsun.jnu.encoding=UTF-8 -Dparamhash.cache.redis.enable=false
    -cp . org.springframework.boot.loader.JarLauncher
    --server.port="${BACKEND_PORT}"
    --server.address=127.0.0.1
    --astrosrv=http://127.0.0.1:${CHART_PORT}
    --mongodb.ip=127.0.0.1
    --redis.ip=127.0.0.1
    --paramhash.cache.redis.enable=false
  )
else
  JAVA_LAUNCH_CMD+=(
    "${JAVA_BIN}" -Djava.net.useSystemProxies=true "-Dhttp.nonProxyHosts=localhost|127.*|[::1]" -Dhorosa.runtime.owner=horosa-desktop -Duser.language=zh -Duser.country=CN -Dfile.encoding=UTF-8 -Dsun.jnu.encoding=UTF-8 -Dparamhash.cache.redis.enable=false -jar "${JAR}"
    --server.port="${BACKEND_PORT}"
    --server.address=127.0.0.1
    --astrosrv=http://127.0.0.1:${CHART_PORT}
    --mongodb.ip=127.0.0.1
    --redis.ip=127.0.0.1
    --paramhash.cache.redis.enable=false
  )
fi

ledger_log sh.preflight_done
launch_detached "${JAVA_LOG}" env \
  "${JAVA_LAUNCH_CMD[@]}" >"${JAVA_PID_FILE}"
if ! pid_alive "${JAVA_PID_FILE}"; then
  diag_log "java launch FAILED: pid 文件为空/进程未存活 (pidfile='$(cat "${JAVA_PID_FILE}" 2>/dev/null || echo "<unreadable>")')"
  echo "java service failed to launch (see ${JAVA_LOG})"
  exit 1
fi
ledger_log sh.java_spawned

ensure_frontend_build
ledger_log sh.fe_check_done

# horosa_web_python_utf8_v1:①剥离宿主 PYTHONHOME/PYTHONSTARTUP/PYTHONUSERBASE(经典
# init_fs_encoding 杀手与用户级注入面;PYTHONPATH 本行显式覆盖=天然免疫);② -X utf8 CLI 旗
# 优先级高于任何继承环境(宿主 PYTHONUTF8=0 也压不掉),CJK 路径/非 UTF-8 码页机器行为一致。
PYTHON_LAUNCH_CMD=(env -u PYTHONHOME -u PYTHONSTARTUP -u PYTHONUSERBASE PYTHONPATH="${PYTHONPATH_ASTRO}" HOROSA_CHART_PORT="${CHART_PORT}")
if [ "${PYTHON_LAUNCH_NOUSERSITE}" = "1" ]; then
  PYTHON_LAUNCH_CMD+=(PYTHONNOUSERSITE=1)
fi
PYTHON_LAUNCH_CMD+=("${PYTHON_BIN}" -X utf8 "${ROOT}/astropy/websrv/webchartsrv.py")
launch_detached "${PY_LOG}" "${PYTHON_LAUNCH_CMD[@]}" >"${PY_PID_FILE}"
if ! pid_alive "${PY_PID_FILE}"; then
  diag_log "python launch FAILED: pid 文件为空/进程未存活 (pidfile='$(cat "${PY_PID_FILE}" 2>/dev/null || echo "<unreadable>")', 日志目录可写? 磁盘?)"
  echo "python service failed to launch (see ${PY_LOG})"
  exit 1
fi
ledger_log sh.python_spawned

ready=0
# 账本观察位(不改就绪判据):各服务首个 http 响应各打一次,latch 后不再探。
py_seen=0
java_seen=0
# [V-4] progress-aware 就绪门:预算耗尽但服务仍在推进(冷 JVM/杀软全量扫描/慢盘)时
# 「有进展就续命」,只有真停滞(STALL 窗零进展)或触总 cap 才判死。
# 进展指纹 = PY/JAVA 日志字节数 + 双 pid CPU 时间 + 账本行数拼串,任一变化即有进展。
# 全 stat/ps/wc 进程级轻命令(禁 lsof——慢且曾把探测拖死);bash3.2+set -u 全标量安全。
READY_EXTEND="${HOROSA_READY_PROGRESS_EXTEND:-1}"
READY_STALL_SECS="${HOROSA_READY_STALL_SECS:-90}"
READY_TOTAL_CAP_SECS="${HOROSA_READY_TOTAL_CAP_SECS:-900}"
_progress_fingerprint() {
  local pyb jab pyc jac ll pypid japid
  # horosa_web_portable_stat_v1:BSD(-f,macOS)优先,GNU(-c,Linux/Git Bash)回退 ——
  # 否则 Git Bash 下日志字节数恒 0,进展指纹只剩账本行数一个弱信号。
  pyb="$(stat -f%z "${PY_LOG}" 2>/dev/null || stat -c%s "${PY_LOG}" 2>/dev/null || echo 0)"
  jab="$(stat -f%z "${JAVA_LOG}" 2>/dev/null || stat -c%s "${JAVA_LOG}" 2>/dev/null || echo 0)"
  pypid="$(cat "${PY_PID_FILE}" 2>/dev/null || true)"
  japid="$(cat "${JAVA_PID_FILE}" 2>/dev/null || true)"
  pyc=""
  jac=""
  if [ -n "${pypid}" ]; then pyc="$(ps -o cputime= -p "${pypid}" 2>/dev/null | tr -d ' ' || true)"; fi
  if [ -n "${japid}" ]; then jac="$(ps -o cputime= -p "${japid}" 2>/dev/null | tr -d ' ' || true)"; fi
  ll="$(wc -l < "${LEDGER_FILE}" 2>/dev/null | tr -d ' ' || echo 0)"
  printf '%s|%s|%s|%s|%s' "${pyb}" "${jab}" "${pyc}" "${jac}" "${ll}"
}

ledger_log sh.ready_poll_begin
# 提速(更新后卡顿)B:轮询间隔与 trusted 解耦——更新后首启(trusted=0)同样用 0.2s 快轮询,
# 服务一就绪就被探测到,不再被旧的 1s 粒度白等近一秒。trusted 仍可用更细的 0.1s。
poll_interval="0.2"
progress_interval="50"
if [ "${TRUSTED_RUNTIME}" = "1" ]; then
  poll_interval="0.1"
  progress_interval="100"
fi
elapsed_checks=0
start_epoch=$(date +%s)
deadline_epoch=$(( start_epoch + STARTUP_TIMEOUT ))
last_fp=""
last_progress_epoch=${start_epoch}
while true; do
  elapsed_checks=$((elapsed_checks + 1))
  if ! pid_alive "${PY_PID_FILE}"; then
    echo "astropy process exited during startup."
    diag_log "wait loop: python pid not alive (pidfile=$(cat "${PY_PID_FILE}" 2>/dev/null || echo '<unreadable>'))"
    break
  fi
  if ! pid_alive "${JAVA_PID_FILE}"; then
    echo "astrostudyboot process exited during startup."
    diag_log "wait loop: java pid not alive (pidfile=$(cat "${JAVA_PID_FILE}" 2>/dev/null || echo '<unreadable>'))"
    break
  fi

  # 账本观察位(纯旁路,latch 一次):各服务首个 http 响应时刻。
  if [ "${py_seen}" = "0" ] && http_responding "http://127.0.0.1:${CHART_PORT}/"; then
    py_seen=1
    ledger_log sh.py_http_ready
  fi
  if [ "${java_seen}" = "0" ] && signed_backend_http_responding "http://127.0.0.1:${BACKEND_PORT}/common/time"; then
    java_seen=1
    ledger_log sh.java_http_ready
  fi
  # 就绪判定以 http 探测为准(trusted/untrusted 同口径)。曾把 netstat 端口解析当 http 探测的前置硬闸,
  # 解析在某环境失败(如 pipefail×SIGPIPE 坑)会把已就绪的服务挡死 → 首启永卡。本地 curl 0.2s 轮询开销可忽略;
  # port_listening 仅保留给下方进度展示行(展示失败不影响就绪判定)。判据原样,账本零介入。
  if http_responding "http://127.0.0.1:${CHART_PORT}/" && signed_backend_http_responding "http://127.0.0.1:${BACKEND_PORT}/common/time"; then
    ready=1
    break
  fi
  if [ $((elapsed_checks % progress_interval)) -eq 0 ]; then
    echo "waiting services... ${elapsed_checks} checks (${CHART_PORT}:$( (port_listening "${CHART_PORT}" && echo up) || echo down), ${BACKEND_PORT}:$( (port_listening "${BACKEND_PORT}" && echo up) || echo down))"
  fi
  # [V-4] 进展指纹采样:每 150 轮(0.2s 轮询≈30s / 0.1s≈15s)一次,开销可忽略。
  if [ "${READY_EXTEND}" = "1" ] && [ $((elapsed_checks % 150)) -eq 0 ]; then
    fp="$(_progress_fingerprint)"
    if [ "${fp}" != "${last_fp}" ]; then
      last_fp="${fp}"
      last_progress_epoch=$(date +%s)
    fi
  fi
  if [ "$(date +%s)" -ge "${deadline_epoch}" ]; then
    # [V-4] 续命判定:最近 STALL 窗内有进展 且 未触总 cap → 延 60s;否则判死。
    # 判死分支必须引用 last_progress_epoch([110] 反向锚:防有人把续命删回硬超时)。
    now_epoch=$(date +%s)
    if [ "${READY_EXTEND}" = "1" ] \
       && [ $(( now_epoch - last_progress_epoch )) -lt "${READY_STALL_SECS}" ] \
       && [ $(( now_epoch - start_epoch )) -lt "${READY_TOTAL_CAP_SECS}" ]; then
      deadline_epoch=$(( now_epoch + 60 ))
      # 续命不得越过总 cap(否则最后一跳会超冲至多 59s 才判死)
      cap_epoch=$(( start_epoch + READY_TOTAL_CAP_SECS ))
      if [ "${deadline_epoch}" -gt "${cap_epoch}" ]; then
        deadline_epoch="${cap_epoch}"
      fi
      ledger_log sh.ready_extend "{\"waited\":$(( now_epoch - start_epoch )),\"progressAge\":$(( now_epoch - last_progress_epoch ))}"
      echo "services still making progress; extending readiness window (waited $(( now_epoch - start_epoch ))s)"
      continue
    fi
    ledger_log sh.ready_giveup "{\"waited\":$(( now_epoch - start_epoch )),\"progressAge\":$(( now_epoch - last_progress_epoch ))}"
    break
  fi
  sleep "${poll_interval}"
done

if [ "${ready}" -ne 1 ]; then
  diag_log "startup timeout after $(( $(date +%s) - start_epoch ))s (budget ${STARTUP_TIMEOUT}s + progress extensions)"
  echo "services did not become ready in $(( $(date +%s) - start_epoch ))s (budget ${STARTUP_TIMEOUT}s; need both ${CHART_PORT} and ${BACKEND_PORT})."
  echo "tip: increase timeout by setting HOROSA_STARTUP_TIMEOUT=300 if this machine is slow on first run."
  echo "--- python log tail ---"
  tail -n 40 "${PY_LOG}" || true
  echo "--- java log tail ---"
  tail -n 40 "${JAVA_LOG}" || true
  diag_tail "${PY_LOG}" 120
  diag_tail "${JAVA_LOG}" 120
  # 修法2(b):若起不来是因端口被占(bind 失败),给「可重试」的 exit 3,让 Rust 端换口重试。
  # set -euo pipefail 下 grep 无匹配返回 1 会提前中止脚本,故必须用 if 守卫;仅匹配明确的 bind
  # 错,绝不用裸 'port'(否则 Spring banner / --server.port= 这类正常输出会被误判为端口冲突)。
  bind_err_re='Address already in use|Errno 48|BindException|Port [0-9]+ was already in use'
  if { tail -n 160 "${PY_LOG}" 2>/dev/null || true; tail -n 160 "${JAVA_LOG}" 2>/dev/null || true; } | grep -Eq "${bind_err_re}"; then
    diag_log "===== run end (failed: port bind conflict, exit 3 retryable) ====="
    echo "端口冲突(退出码 3=可重试):换端口重试,或先运行 stop_horosa_local.sh。Port conflict (exit 3 = retryable)."
    exit 3
  fi
  diag_log "===== run end (failed) ====="
  exit 1
fi

trap - EXIT
ledger_log sh.ready
_mw_t0="$(_now_ms)"
warm_runtime_routes_min_sync
ledger_log sh.min_warmup_done "{\"ms\":$(( $(_now_ms) - _mw_t0 ))}"
warm_runtime_routes

# ── AppCDS 首启后台自训练:exploded 模式且 .jsa 未生成时,主服务就绪后在冷门端口
# 以相同 classpath/lazy 配置起一个训练副本,heartbeat 就绪即 SIGTERM 触发 dump,
# 原子落盘 .app-cds.jsa → 下次启动自动加载(温启再 -0.3~0.4s)。
# .jsa 必须在最终安装路径训练(AppCDS 校验 classpath 绝对路径),故不能随包分发、只能就地自训。
# 失败/端口占用/目录只读 → 静默放弃,下次启动再试;runtime 更新=整目录替换,.jsa 随之失效重训。
maybe_train_cds_background() {
  [ "${JAVA_EXPLODED_MODE:-0}" = "1" ] || return 0
  [ "${HOROSA_JAVA_CDS:-1}" = "1" ] || return 0
  local jsa="${BOOT_EXPLODED}/.app-cds.jsa"
  [ -s "${jsa}" ] && return 0
  local dir
  dir="$(dirname "${jsa}")"
  [ -w "${dir}" ] || { diag_log "cds train skip: dir not writable"; return 0; }
  local train_port=39997
  local lazy_env="false"
  if [ "${DESKTOP_SPRING_LAZY_INIT}" = "1" ]; then lazy_env="true"; fi
  diag_log "cds train scheduled (port ${train_port})"
  (
    sleep 6
    if curl -s -o /dev/null -m 1 "http://127.0.0.1:${train_port}/heartbeat" 2>/dev/null; then exit 0; fi
    tmp_jsa="${jsa}.tmp.$$"
    env SPRING_MAIN_LAZY_INITIALIZATION="${lazy_env}" \
      HOROSA_DESKTOP_MONGO_OPTIONAL="${DESKTOP_MONGO_OPTIONAL}" \
      HOROSA_DESKTOP_MONGO_SKIP_PING="${DESKTOP_MONGO_SKIP_PING}" \
      HOROSA_MONGO_FALLBACK_DIR="${MONGO_FALLBACK_DIR}" \
      needtranslog="${NEED_TRANSLOG}" \
      /bin/bash -c 'cd "$0" && exec "$@"' "${BOOT_EXPLODED}" \
      "${JAVA_BIN}" -XX:ArchiveClassesAtExit="${tmp_jsa}" \
      -Dlog4j2.statusLevel=WARN -Djava.awt.headless=true \
      -Djava.security.egd=file:/dev/./urandom -Dspring.backgroundpreinitializer.ignore=true \
      -Djava.net.useSystemProxies=true -Dhorosa.runtime.owner=horosa-cds-train \
      -cp . org.springframework.boot.loader.JarLauncher \
      --server.port="${train_port}" --server.address=127.0.0.1 \
      --astrosrv=http://127.0.0.1:${CHART_PORT} --mongodb.ip=127.0.0.1 --redis.ip=127.0.0.1 \
      >/dev/null 2>&1 &
    tpid=$!
    tries=0
    while [ "${tries}" -lt 120 ]; do
      if curl -s -o /dev/null -m 1 "http://127.0.0.1:${train_port}/heartbeat" 2>/dev/null; then break; fi
      kill -0 "${tpid}" 2>/dev/null || break
      tries=$((tries + 1))
      sleep 0.5
    done
    # [WS-3e] 触达补全:lazy-init 下 heartbeat 只初始化极小 bean 集;补一发 /chart POST
    # (400/失败均可)把 controller/序列化链的类拉进 dump 档,提高 .jsa 覆盖。
    curl -s -o /dev/null -m 3 -X POST -H 'Content-Type: application/json' -d '{}' \
      "http://127.0.0.1:${train_port}/chart" 2>/dev/null || true
    kill -TERM "${tpid}" 2>/dev/null || true
    # dump 49MB archive 需 15-30s(优雅关停+写盘),等待窗放到 90s 再强杀
    tries=0
    while [ "${tries}" -lt 90 ]; do
      kill -0 "${tpid}" 2>/dev/null || break
      tries=$((tries + 1))
      sleep 1
    done
    kill -9 "${tpid}" 2>/dev/null || true
    if [ -s "${tmp_jsa}" ]; then mv -f "${tmp_jsa}" "${jsa}"; else rm -f "${tmp_jsa}" 2>/dev/null || true; fi
  ) >/dev/null 2>&1 &
}
maybe_train_cds_background

diag_log "services ready: backend=${BACKEND_PORT} chartpy=${CHART_PORT}"
diag_log "===== run end (success) ====="
ledger_log sh.total "{\"trusted\":${TRUSTED_RUNTIME},\"chart_port\":${CHART_PORT},\"backend_port\":${BACKEND_PORT}}"

echo "services are ready."
echo "backend:  http://127.0.0.1:${BACKEND_PORT}"
echo "chartpy:  http://127.0.0.1:${CHART_PORT}"
echo "html:     ${HTML_PATH}"
echo "logs:     ${LOG_DIR}"
echo ""
echo "stop:     ${ROOT}/stop_horosa_local.sh"

# horosa_web_pyc_precompile_v1:就绪后 45s 空闲期后台预编译 .pyc(镜像桌面 schedulePycCompile,
# 下次启动 Python 冷导入省 2-3s)。幂等、Python 按 mtime 自失效;绝不阻塞前台、失败零影响。
# HOROSA_WEB_PYC_PRECOMPILE=0 关闭。
if [ "${HOROSA_WEB_PYC_PRECOMPILE:-1}" != "0" ]; then
  (
    sleep 45
    "${PYTHON_BIN}" -X utf8 -m compileall -q "${ROOT}/astropy" "${ROOT}/vendor" >/dev/null 2>&1 || true
  ) >/dev/null 2>&1 &
  disown 2>/dev/null || true
fi
