#!/usr/bin/env bash
# Re-apply the Windows-only adaptations onto a freshly wholesale-replaced product source.
#
# WHY THIS EXISTS: the Windows product source (local/workspace/Horosa-Web-*/) is gitignored
# (build-harness-only repo) + is wholesale-replaced from the Mac repo on every sync. The Mac
# tree LACKS these Windows adaptations, so each sync drops them. A `git reset --hard` / wipe
# also loses them. They were once lost with no recovery (the v2.5.0 "disaster"), so they now
# live HERE, tracked in git, and this script restores them deterministically.
#
# USAGE (from repo root, after wholesale-replacing the product source from the Mac clone):
#   bash windows-adaptations/apply.sh <workspace-product-dir> [mac-clone-Horosa-Web-dir]
# e.g.
#   bash windows-adaptations/apply.sh \
#     local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c \
#     tmp/mac-sync-2.5.0/Horosa-Web
set -uo pipefail
OV="$(cd "$(dirname "$0")" && pwd)"
WS="${1:?usage: apply.sh <workspace-product-dir> [mac-clone-Horosa-Web-dir]}"
MAC="${2:-}"
[ -d "$WS/astrostudyui" ] || { echo "ERR: $WS is not a product dir (no astrostudyui/)"; exit 1; }
ok(){ echo "  [ok] $*"; } ; warn(){ echo "  [!!] $*"; }

echo "== 1. Windows-only files (umi-runner.js / loadCryptoDeps.js / scripts/vendor) =="
cp "$OV/files/astrostudyui/scripts/umi-runner.js"     "$WS/astrostudyui/scripts/umi-runner.js"     && ok umi-runner.js
cp "$OV/files/astrostudyui/scripts/loadCryptoDeps.js" "$WS/astrostudyui/scripts/loadCryptoDeps.js" && ok loadCryptoDeps.js
rm -rf "$WS/astrostudyui/scripts/vendor"
cp -r "$OV/files/astrostudyui/scripts/vendor" "$WS/astrostudyui/scripts/vendor" && ok "scripts/vendor/ ($(find "$WS/astrostudyui/scripts/vendor" -type f | wc -l) files)"

echo "== 2. astropy/requirements.txt — strip the unresolvable flatlib pin (flatlib is vendored via sys.path) =="
if grep -q '^flatlib==' "$WS/astropy/requirements.txt" 2>/dev/null; then
  sed -i '/^flatlib==/d' "$WS/astropy/requirements.txt"; ok "flatlib pin removed"
else ok "flatlib pin already absent"; fi

echo "== 3. astrostudyui/package.json — keep Mac deps, restore Windows name + umi-runner scripts =="
node -e '
const fs=require("fs");
const pkgP=process.argv[1], winP=process.argv[2];
const pkg=JSON.parse(fs.readFileSync(pkgP,"utf8")), win=JSON.parse(fs.readFileSync(winP,"utf8"));
pkg.name=win.name; pkg.scripts=win.scripts;
fs.writeFileSync(pkgP, JSON.stringify(pkg,null,"\t")+"\n");
console.log("  [ok] name="+pkg.name+"; scripts="+Object.keys(pkg.scripts).join(","));
' "$WS/astrostudyui/package.json" "$OV/files/astrostudyui/package.name-scripts.json"

echo "== 4. THIRD_PARTY_NOTICES.md — Mac keeps it at REPO ROOT; Windows needs it in the workspace root =="
if [ -n "$MAC" ] && [ -f "$MAC/../THIRD_PARTY_NOTICES.md" ]; then
  cp "$MAC/../THIRD_PARTY_NOTICES.md" "$WS/THIRD_PARTY_NOTICES.md"; ok "copied from $MAC/../THIRD_PARTY_NOTICES.md"
elif [ -n "$MAC" ] && [ -f "$MAC/THIRD_PARTY_NOTICES.md" ]; then
  cp "$MAC/THIRD_PARTY_NOTICES.md" "$WS/THIRD_PARTY_NOTICES.md"; ok "copied from $MAC/THIRD_PARTY_NOTICES.md"
else warn "Mac clone not given/found — copy THIRD_PARTY_NOTICES.md from the Mac repo root into $WS/ manually"; fi

echo "== 5. source patches (isDesktopShellWindow + ensureField) — applied only if the marker is missing =="
apply_patch(){ # $1=marker $2=target-rel $3=patchfile
  if grep -q "$1" "$WS/$2" 2>/dev/null; then ok "$2 already has $1"; return; fi
  if git apply -p1 --directory="$WS" "$OV/patches/$3" 2>/dev/null || (cd "$WS" && patch -p1 --silent < "$OV/patches/$3" 2>/dev/null); then
    ok "patched $2 ($1)";
  else warn "auto-patch FAILED for $2 — apply the $1 change by hand per windows-adaptations/README.md"; fi
}
apply_patch isDesktopShellWindow astrostudyui/src/utils/windowSizePersistence.js src__utils__windowSizePersistence.js.patch
apply_patch ensureField           astrostudyui/src/pages/index.js                 src__pages__index.js.patch

echo "== 6. backend patch (boundless #14: loopback NEVER via the system proxy) — REQUIRES a jar rebuild =="
apply_patch isLoopbackTarget     astrostudysrv/boundless/src/main/java/boundless/net/http/HttpUriRequestHystrixCommand.java boundless__HttpUriRequestHystrixCommand.java.patch
echo "   ^^ boundless is BACKEND Java. After this patch you MUST rebuild astrostudyboot.jar (SKILL gotcha #5):"
echo "      boundless install -> astrostudy install -> astrostudycn install -> astrostudyboot clean package,"
echo "      then copy target/astrostudyboot.jar to local/workspace/runtime/windows/bundle/. apply.sh does NOT rebuild it,"
echo "      and prepare:runtime's auto-build pulls boundless from .m2 (stale) — so the manual rebuild is mandatory."

echo "== 7. performance overlays (天文馆渲染门控 + echarts 模块化;纯前端、只动时机/打包、可一键回退) =="
# net-new:玄学史 echarts 模块化注册(整包 -> 按需 use())。
cp "$OV/files/astrostudyui/src/components/xuanshi/echartsCore.js" "$WS/astrostudyui/src/components/xuanshi/echartsCore.js" && ok "echartsCore.js"
# marker-guarded:Mac 若已合入同款优化,marker 命中即跳过 -> apply.sh 变 no-op(isLoopbackTarget 先例)。
apply_patch planetariumRenderGatingEnabled astrostudyui/src/utils/perfFlags.js                          src__utils__perfFlags.js.patch
apply_patch "perf:planetariumRenderGating" astrostudyui/src/components/planetarium/PlanetariumBabylon.js src__components__planetarium__PlanetariumBabylon.js.patch
apply_patch "./echartsCore"                astrostudyui/src/components/xuanshi/XuanShiCelestial.js       src__components__xuanshi__XuanShiCelestial.js.patch
apply_patch "./echartsCore"                astrostudyui/src/components/xuanshi/XuanShiMap.js             src__components__xuanshi__XuanShiMap.js.patch

echo "== 8. v3.0.1 perf round-2 (交互/切技法;纯前端结果缓存 + 后端逐段计时;均带 kill-switch、功能零降级) =="
# 前端:技法结果缓存开关(techniqueResultCacheEnabled)——须先应用上面的 planetarium perfFlags 补丁(本补丁上下文含其行)。
apply_patch techniqueResultCacheEnabled    astrostudyui/src/utils/perfFlags.js                          src__utils__perfFlags.techniqueCache.js.patch
# 前端:紫微本盘 /ziwei/birth 走确定性缓存(cachedPost),重复/来回切秒回。
apply_patch techniqueResultCacheEnabled    astrostudyui/src/components/ziwei/ZiWeiMain.js               src__components__ziwei__ZiWeiMain.js.patch
echo "== 9. backend perf: /chart 逐段计时(B0,纯观测日志、不改结果)— REQUIRES a jar rebuild =="
apply_patch CHART_PERF_SEG_REV             astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/ChartController.java astrostudycn__ChartController.java.patch
echo "   ^^ astrostudycn is BACKEND Java. After this patch you MUST rebuild astrostudyboot.jar (SKILL gotcha #5):"
echo "      astrostudycn install -> astrostudyboot clean package, then copy target/astrostudyboot.jar to bundle."

echo "== 10. v3.0.1 perf round-3 (首屏并行 + 每请求日志栈回溯去除;均带 kill-switch、功能零降级) =="
# 前端:首屏并行化开关(firstLoadParallelEnabled)——须先应用上面的 perfFlags 补丁(本补丁上下文含其行)。
apply_patch firstLoadParallelEnabled       astrostudyui/src/utils/perfFlags.js                          src__utils__perfFlags.firstLoadParallel.js.patch
# 前端:玄学史首屏 4 请求并行(总览/玄典/名家/事件),首开更快。
apply_patch firstLoadParallelEnabled       astrostudyui/src/components/xuanshi/XuanShiMain.js           src__components__xuanshi__XuanShiMain.js.patch
echo "== 11. backend perf: QueueLog 去掉每条日志的同步栈回溯(默认关,-Dhorosa.queuelog.callerLocation=true 恢复)— REQUIRES a jar rebuild =="
apply_patch "horosa.queuelog.callerLocation" astrostudysrv/boundless/src/main/java/boundless/log/QueueLog.java boundless__QueueLog.java.patch
echo "   ^^ boundless is BACKEND Java (base of all modules). After this patch rebuild astrostudyboot.jar (SKILL gotcha #5):"
echo "      boundless install -> astrostudy install -> astrostudycn install -> astrostudyboot clean package, then copy to bundle."

echo "== done. Verify: npm run selfcheck (windows-ahead / perf sentinels must all pass). =="
