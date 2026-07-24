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
# (v3.5.1 收敛:_kentangResultCache.js 已退役 —— 上游 utils/kentangCache.js 的 fetch 级
#  L1/L2/L3+在途去重全面取代[信封同款 kt-v1|rv];Windows-ahead 残余职责 = kentangCache 的
#  wuzhao 随机守卫,走 §33c 补丁。若上游未来又删了 kentangCache,由该补丁 guard+哨兵报警。)

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
# PERF-R7 起该 patch 为「Mac 基线→Windows 现状」的累积全量(ensureField 守卫 + P1-5 切页
# User-Timing 打点 + T-3 idle 预载 1s 起跑 + PERF-R9 交互起点打点);守卫 marker 取**最新**一处
# (gotcha #48):markInteractionStart —— 它是 PERF-R9 才引入的,旧状态一律 grep 不到,不会误跳过。
apply_patch horosa_change_cond_no_mutate_v1 astrostudyui/src/pages/index.js            src__pages__index.js.patch

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
# PERF-R7 起 perfFlags 由三段链式补丁合并为一个累积全量补丁(planetarium 系 + techniqueCache +
# firstLoadParallel + T-6 speculativePrecompute),守卫 marker 用最新的 speculativePrecomputeEnabled。
apply_patch neighborPrefetchEnabled        astrostudyui/src/utils/perfFlags.js                          src__utils__perfFlags.speculativePrecompute.js.patch
apply_patch "perf:planetariumRenderGating" astrostudyui/src/components/planetarium/PlanetariumBabylon.js src__components__planetarium__PlanetariumBabylon.js.patch
apply_patch "./echartsCore"                astrostudyui/src/components/xuanshi/XuanShiCelestial.js       src__components__xuanshi__XuanShiCelestial.js.patch
apply_patch "./echartsCore"                astrostudyui/src/components/xuanshi/XuanShiMap.js             src__components__xuanshi__XuanShiMap.js.patch

echo "== 8. v3.0.1 perf round-2 (交互/切技法;纯前端结果缓存;kill-switch、功能零降级) =="
# (PERF-R7 起 perfFlags 的 techniqueCache/firstLoadParallel 链已并入 §7 的累积补丁,此处只剩组件侧。)
# 前端:紫微本盘 /ziwei/birth 走确定性缓存(cachedPost),重复/来回切秒回。
apply_patch horosa_prefetch_registry_v1    astrostudyui/src/components/ziwei/ZiWeiMain.js               src__components__ziwei__ZiWeiMain.js.patch
echo "== 9. backend perf: /chart 逐段计时(B0;PERF-R7 P1-1 升 INFO 级=perf.log 真机常显)— REQUIRES a jar rebuild =="
apply_patch "QueueLog.info(AppLoggers.Performance" astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/ChartController.java astrostudycn__ChartController.java.patch
echo "   ^^ astrostudycn is BACKEND Java. After this patch you MUST rebuild astrostudyboot.jar (SKILL gotcha #5):"
echo "      astrostudycn install -> astrostudyboot clean package, then copy target/astrostudyboot.jar to bundle."

echo "== 10. v3.0.1 perf round-3 (首屏并行 + 每请求日志栈回溯去除;均带 kill-switch、功能零降级) =="
# 前端:玄学史首屏 4 请求并行(总览/玄典/名家/事件),首开更快。
apply_patch firstLoadParallelEnabled       astrostudyui/src/components/xuanshi/XuanShiMain.js           src__components__xuanshi__XuanShiMain.js.patch
echo "== 11. backend perf: QueueLog 去掉每条日志的同步栈回溯(默认关,-Dhorosa.queuelog.callerLocation=true 恢复)— REQUIRES a jar rebuild =="
apply_patch "horosa.queuelog.callerLocation" astrostudysrv/boundless/src/main/java/boundless/log/QueueLog.java boundless__QueueLog.java.patch
echo "   ^^ boundless is BACKEND Java (base of all modules). After this patch rebuild astrostudyboot.jar (SKILL gotcha #5):"
echo "      boundless install -> astrostudy install -> astrostudycn install -> astrostudyboot clean package, then copy to bundle."

echo "== 12. v3.0.1 perf ROUND-3 R1 (jieqi/year 30s→2-3s: swap Chart-per-iteration for direct swe.sweObject(SUN);跨平台代码 bug,Mac 靠算力盖住) =="
# YearJieQi.approach + BirthJieQi.approach 原本每次收敛迭代都 new 一个完整 flatlib Chart(20+ 行星+12 宫+40 阿拉伯点=100+ swe 调用)只为读太阳位置。
# 直接 swe.sweObject(SUN, jd, SEDEFAULT_FLAG) 返回同一 {lon, lonspeed}，收敛判据/delta 公式/Datetime.fromJD 全部一字未动 → 结果逐字节等价。
# 自证:golden diff 24 term + 100+ 随机组合 max_jdn_diff=0.000e+00, VERDICT=ALL_EQUAL, SPEEDUP 21-44×。kill-switch HOROSA_JIEQI_FAST_APPROACH=0。
apply_patch HOROSA_JIEQI_FAST_APPROACH     astropy/astrostudy/jieqi/YearJieQi.py         astropy__jieqi__YearJieQi.fastApproach.py.patch
apply_patch HOROSA_JIEQI_FAST_APPROACH     astropy/astrostudy/jieqi/BirthJieQi.py        astropy__jieqi__BirthJieQi.fastApproach.py.patch

echo "== 13. v3.0.1 perf ROUND-3 R2 (paramhash 磁盘缓存永远 silent no-op 根治;centralized persistable()·所有 11 controller 自动受惠) — REQUIRES a jar rebuild =="
# JieQiController.getYearParams() 直接把 TimeZiAlg + PhaseType 两个 Java Enum 塞进返回体;
# ParamHashCacheHelper.canPersistLocal() 遇非原语返回 false → saveToLocal 无异常无日志 return → 磁盘缓存零条,每次冷 recompute。
# ChartController 早年用私有 toPlainMap 补丁式绕过,JieQiController/LiuRengController/PaiBaZiController 等全部漏抄。
# 根治式泛化:promote toPlainMap 为 helper.persistable(Object) 公共方法,并在 ParamHashCacheHelper.get(...) 内部
# fun.apply 之后 saveToLocal 之前统一 round-trip。全 11 处 controller 调用点(ChartController × 3 / JieQiController × 2 /
# LiuRengController × 2 / IndiaChartController / BaZiBirthController / PaiBaZiController / AstroHelper)自动受惠,
# 未来任何新 controller 也不再有可能复发此 bug。
# PERF-R9 追加(同一累积补丁):horosa_paramhash_localdir_sysprop_v1 —— LocalDir 改走 resolveFlag
# (先 -D 再属性文件),否则启动器无法把 paramhash 磁盘缓存移出 payload 树:defaultLocalDir() 落在
# user.dir 下 = embedded-runtime/<payloadId>/ 之内,**每次更新换 payloadId 就被启动清扫连缓存一起删,
# 所有用户回到全冷**。守卫 marker 按 gotcha #48 取最新。⚠️ 本模块是 BACKEND Java,改后必须重建 jar。
apply_patch horosa_paramhash_localdir_sysprop_v1 astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/helper/ParamHashCacheHelper.java astrostudy__ParamHashCacheHelper.persistable.java.patch
echo "   ^^ astrostudy is BACKEND Java (base of astrostudycn+astrostudyboot). After this patch rebuild astrostudyboot.jar (SKILL gotcha #5):"
echo "      astrostudy install -> astrostudycn install -> astrostudyboot clean package, then copy to bundle."

echo "== 14. kentang 惰性挂载/自愈/响亮失败 —— v3.2.2 起全量上游化,registry 补丁退役 =="
# 历史:惰性挂载(_LazyMountedService)/自愈(_import_kentang_service_module)/响亮失败
# (KentangServiceLoadError)最初都是 Windows overlay(v3.0.1 R3 → v3.2.0 热修 → v3.2.1 根治)。
# Mac v3.2.2 将同一架构原样上游化并强化(净化白名单 _PURGE_PROTECT_PREFIXES、HOROSA_KENTANG_LAZY
# 回退旗、显式 prewarm_kentang_services 预热函数),registry.py 从此与 Mac 逐字节一致,补丁删除
# (isLoopbackTarget #8 同款收敛)。selfcheck 哨兵改守 Mac 版 marker:KENTANG_LAZY_MOUNT_SELF_HEAL /
# KentangServiceLoadError / _PURGE_PROTECT_PREFIXES / prewarm_kentang_services。
apply_patch "xuanshi.lazyImport"           astropy/astrostudy/xuanshi/__init__.py        astropy__xuanshi__init.lazyImport.py.patch
# webchartsrv 存活的唯一 Windows 增强(v3.2.2 收敛后):xuanshi_summary_warmup_v1 ——
# kentang prewarm(Mac 版,盖住服务类加载)之后、STARTUP_GATE 打开之后,再物化一次
# global_summary()(全表 SELECT + 译名 join + celestial,冷 ~2.3s):玄学史首点即秒开。
# 旧 overlay 的 astropy 预导入(→ Mac _warm_real_astropy)、qizheng/16 服务错峰预热
# (→ Mac prewarm_kentang_services)、/chart 三段计时(→ Mac _PY_CHART_TIMING 账本版)
# 均已被 Mac v3.2.2 上游实现取代;HOROSA_CETIAN_LAZY 退役(v3.1.0 streamlit 桩使 cetian
# 饿加载已廉价,收敛 Mac 语义)。守卫 marker 用 xuanshi_summary_warmup_v1。
# PERF-R9 追加(同一累积补丁,guard 取文件内**最后**一个 hunk 的 marker，见 #48):
#   · horosa_chart_no_stdout_dump_v1     —— 删掉每个 /chart 的 print(data)。它把整个请求字典
#     (出生日期/时间/经纬度/地名)同步写进 stdout；打包件里 stdout 经管道回主进程并落盘，
#     等于在请求路径上做同步写盘，且把用户出生信息持续写进日志文件。改由 HOROSA_CHART_DEBUG_DUMP 显式开。
#   · horosa_kentang_prewarm_modules_v1  —— 太乙·博弈论模块预热的**调用点**，刻意放在
#     STARTUP_GATE.set() 之后:并进门前那发会把启动门整整推迟 528ms(实测冷导入 528.1ms)。
apply_patch horosa_kentang_prewarm_modules_v1 astropy/websrv/webchartsrv.py             astropy__webchartsrv.xuanshiWarmup.py.patch

# PERF-R9:预装「请求路径内惰性 import」的重模块(当前只有 kintaiyi.game_theory,793 行,
# 实测冷导入 528.1ms / 温 0.001ms —— 用户首次勾「博弈论」白等的就是这半秒)。只 import 不调用
# ⇒ 零盘面副作用。函数与 prewarm_kentang_services 分开,正是为了能被放到启动门之后调。
apply_patch horosa_kentang_prewarm_modules_v1 astropy/websrv/kentang/registry.py        astropy__kentang_registry.modulePrewarm.py.patch

echo "== 14b. v3.2.1 太乙事故根因修复(streamlit 桩 dunder 守卫)=="
# 根因:kinastro_common 的 _StubModule.__getattr__ 对任意属性(含 __file__)返回 _noop 函数;
# 真 astropy 库(kintaiyi/太乙的依赖)导入期 inspect.getmodule() 遍历 sys.modules 读每个模块的
# __file__(期望 str)→ 函数.endswith 炸 AttributeError → kintaiyi 导入永久失败 → CherryPy 吞成
# 静默 404。七政/玄学史预热(+10/14s)先注入桩、用户首点太乙必在其后 → Windows 必现。
# 修:dunder 探测一律 AttributeError 拒答(hasattr(stub,'__file__')=False,标准内省安全跳过);
# 具名属性语义不变。跨平台 bug(Mac 用户先开七政再开太乙同样触发)→ 建议上游化到 Mac。
apply_patch stub_dunder_guard_v1           astropy/websrv/kentang/kinastro_common.py     astropy__kentang__kinastro_common.stubDunderGuard.py.patch

echo "== 15. v3.0.1 perf ROUND-4 P0 (log4j Windows 缺陷：6 个程序化 appender 以字面 env:HOME 模板建文件, NTFS 拒绝 → 启动报错刷屏 + perf/错误日志静默丢失) — REQUIRES a jar rebuild =="
# 根因：AppLoggers.createLog/changeLogFile/getBaseDir 用 getStrSubstitutor().getVariableResolver().lookup("basedir")
# 拿到的是 log4j2.xml 里未替换的模板串(POSIX 容忍这种目录名所以 mac/linux 能用，NTFS 直接拒绝)。
# 修法：resolveBaseDir() 优先读启动器一直在传的 -Dhorosa.log.basedir；缺省回落原 lookup；结果仍含未解析模板
# 再回落 user.home/.horosa-logs/astrostudyboot。changeLogFile 的按日重建加 startsWith 守卫(只轮转本 basedir
# 布局的 appender，XML appender 跳过 —— 修掉原 substring 位置数学的越界/停旧未建新隐患)。无 -D 时行为与原实现
# 一致 → 服务器/mac 部署零变化。marker: log_basedir_v1 (HOROSA_LOG_BASEDIR_REV 常量，兼作 jar 内容哨兵)。
apply_patch log_basedir_v1                 astrostudysrv/boundless/src/main/java/boundless/log/AppLoggers.java boundless__AppLoggers.logBasedir.java.patch
echo "   ^^ boundless is BACKEND Java. After this patch you MUST rebuild astrostudyboot.jar (SKILL gotcha #5):"
echo "      boundless install -> astrostudyboot clean package, then copy target/astrostudyboot.jar to local/workspace/runtime/windows/bundle/."

echo "== 16. v3.0.1 perf ROUND-4 P1 (占星首盘 9.7s 的 80%=baziAssemble 7781ms 一次性冷成本 → 启动后台预跑一次) — REQUIRES a jar rebuild =="
# B0 分段实测:首盘 /chart seg ms python=1884 baziAssemble=7781 predictSign=4 predSync=0 total=9669。
# OnlyFourColumns/NongliHelper 首次执行付 类初始化+历法表加载+JIT;之后瞬完。加 baziAssembleWarmup
# CommandLineRunner(daemon,合成参数预跑 构造+getNongli,结果丢弃,失败静默)。kill: HOROSA_CHART_WARMUP=0。
# marker: bazi_warmup_v1(HOROSA_CHART_WARMUP_REV 常量,兼作 jar 内容哨兵)。
apply_patch bazi_warmup_v1                 astrostudysrv/astrostudyboot/src/main/java/spacex/astrostudyboot/AstroStudyProgram.java astrostudyboot__AstroStudyProgram.baziWarmup.java.patch
echo "   ^^ astrostudyboot is BACKEND Java. After this patch rebuild: astrostudyboot clean package, then copy to bundle."

echo "== 17. v3.0.1 perf ROUND-5 (Python 排盘热路径请求内 memo;纯每实例缓存、reinit() 重置、无行为开关、golden 字节全等) =="
# perchart.py:同一 /chart 请求内重复计算的 6 处纯函数结果 memo(67 恒星批/28 宿调整批/28 宿原始批/
# 日出求解/围攻/互容 —— 均为「同请求同输入被算 2-3 次」的浪费)。缓存挂在 chart 实例上,reinit() 清零,
# 跨请求零共享;golden 4 变体(标准/南盘/斗柄/七政)PYTHONHASHSEED=0 下逐字节全等。重复盘 617-747ms → 443-504ms。
# 守卫 marker 取最新(gotcha #48):PERF-R9 在同一文件加了 getParallel 的稳定排序,
# marker 换成该次改动引入的 horosa_decl_parallel_stable_order_v1,旧状态 grep 不到必定重打。
apply_patch horosa_decl_parallel_stable_order_v1  astropy/astrostudy/perchart.py           astropy__perchart.chartMemo.py.patch
# guo74.py:virtualSu28 逐星 chart.getFixedStar()×28 → 改读 perchart 的原始 28 宿批缓存(同一请求第三次取数)。
apply_patch getRawFixedStarSu28Cached      astropy/astrostudy/guostarsect/guo74.py       astropy__guostarsect__guo74.su28Batch.py.patch
# flatlib ephem.py:恒星批(67 星/28 宿)只依赖 (IDs, jd, pos, height, flags, sidereal 上下文),与宫位制/
# 容许度无关 → 有界 LRU(8 条,线程安全,存取皆 deepcopy 防 relocate/+180° 串染)。「改设置重排同一盘」
# 恒星段 379-480ms → 183-236ms。kill-switch HOROSA_STAR_LRU=0。
apply_patch HOROSA_STAR_LRU                flatlib-ctrad2/flatlib/ephem/ephem.py         flatlib__ephem.starLru.py.patch

echo "== 18. v3.0.1 perf ROUND-5 (历法求解降维:NongLi.approach 朔/节候选 + BirthJieQi 上升瘦盘;同一 HOROSA_JIEQI_FAST_APPROACH 开关) =="
# NongLi.approach:朔(日月合)与节气候选求解原本每迭代 new 完整 Chart;改 swe.sweObject 直读日/月经度,
# 收敛判据一字不动 → 4 年(含公元前 500)golden 逐字节全等;整年农历表 1445-2460ms → 113-194ms。
apply_patch _JIEQI_FAST_APPROACH           astropy/astrostudy/jieqi/NongLi.py            astropy__jieqi__NongLi.fastApproach.py.patch
# BirthJieQi(R3 patch 已重生成,现同时携带 R5 _ascChart):卯时/上升求解只读 ASC → 瘦 Chart(仅太阳、
# needpars=False);3 个代表日期 golden 全等,398-490ms → 30-36ms。guard 沿用 HOROSA_JIEQI_FAST_APPROACH(§12 已应用则跳过)。

echo "== 19. (退役归档) webchartsrv cetian 懒挂载 + /chart 三段计时 —— v3.2.2 收敛 =="
# HOROSA_CETIAN_LAZY:v3.1.0 上游 streamlit 桩后 cetian 饿加载已廉价,Mac 实测保持饿加载 → 收敛
# Mac 语义,退役。HOROSA_PY_CHART_TIMING:Mac v3.2.2 上游化为账本版(_PY_CHART_TIMING → py.chart_req
# 三段写 HOROSA_LEDGER_FILE;壳层 pythonEnv 仍注 HOROSA_PY_CHART_TIMING=1 + 账本 env)。零补丁残留。

echo "== 20. v3.0.1 perf ROUND-5 B-F3 (农历「日级」外部缓存读写桌面版停用;年表持久化不动) — REQUIRES a jar rebuild =="
# NongliHelper:每个未见过的日期一读一写外部缓存(读基本必 miss)。日行是内存月表的纯推导,重算逐字节
# 一致 → env HOROSA_NONGLI_DAY_PERSIST=0(桌面壳注入)跳过日级读写;env 缺省=原行为(Mac/服务器零变化)。
apply_patch nongli_day_persist_v1          astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/helper/NongliHelper.java astrostudy__NongliHelper.dayPersist.java.patch
# OnlyFourColumns.forwardDirect 流水 println 删除:Mac v3.2.2 上游化(WS-3b 注释版),补丁退役,
# 文件与 Mac 逐字节一致;selfcheck 哨兵改守「WS-3b」注释 marker(println 不回归)。
echo "   ^^ astrostudy+astrostudycn are BACKEND Java. After these patches rebuild astrostudyboot.jar (SKILL gotcha #5):"
echo "      astrostudy install -> astrostudycn install -> astrostudyboot clean package, then copy to bundle."

echo "== 21. v3.1.0 官方仓库链接平台化(「关于」法律文档 + 官方下载渠道指向 Windows 仓库) =="
# Mac v3.1.0 在 PageHeader「关于」里挂了 docs/legal 与 releases 链接,但 HOROSA_OFFICIAL_REPO 硬编码为
# Mac 仓库 URL —— Windows 用户点「官方下载渠道」会落到错误平台的下载页。改指本仓库(docs/legal 已随
# 同步 tracked 进本仓库,链接同构有效)。marker = Windows 仓库 URL 本身。
apply_patch "comprehensively-improved-Windows" astrostudyui/src/components/homepage/PageHeader.js src__components__homepage__PageHeader.officialRepo.js.patch

echo "== 22. PERF-R7 T-6 预测性预计算(点击→显示体感瞬间;perfFlag speculativePrecompute,功能零降级) =="
# 机制:排盘抽屉表单编辑期 300ms 防抖,把「提交会发出的同一份参数」提前经 astro/precomputeFetch
# 只暖 services 层 chartMem/在途缓存(不落 state、不动 UI、失败静默);点提交时 *fetch 命中/join →
# 点击→显示≈渲染耗时。配套:services/astro fetchChart 只缓存有效盘(chartMem_valid_only_v1,错误
# 信封不进缓存=对既有路径也是净改善)。perfFlags 开关已并入 §7 的累积补丁。跨平台,建议上游化 Mac。
# 守卫 marker 取最新(gotcha #48):PERF-R9 给快车道补了 markChartRefreshEnd 调用,
# marker 换成该次改动引入的 horosa_interaction_span_v1,旧状态 grep 不到必定重打。
apply_patch horosa_interaction_span_v1     astrostudyui/src/models/astro.js                             src__models__astro.precomputeFetch.js.patch
apply_patch markChartCacheHit              astrostudyui/src/services/astro.js                           src__services__astro.chartMemValidOnly.js.patch
apply_patch scheduleLivePrecompute         astrostudyui/src/components/comp/ChartFormData.js            src__components__comp__ChartFormData.livePrecompute.js.patch
apply_patch onLivePrecompute               astrostudyui/src/components/astro/AstroFormComp.js           src__components__astro__AstroFormComp.livePrecompute.js.patch

echo "== 23. PERF-R8 P0/P2/P3(观测补全 + 排盘后数据层空闲预热 + 分至邻位预取;纯前端、kill-switch、功能零降级)=="
# P0 观测:refresh-end/render-complete/cache-hit User-Timing 打点(并入 models/services/pages 累积补丁)。
# P2 数据层预热:idleWarmQueue 组式 API(scheduleDataWarmGroup:generation 作废旧组+泵可重 arm)
#   + 排盘成功后按当前盘预热 星运pd/印占/七政本命/量化盘中点 —— 全部走各技法**自己导出的
#   builder + 缓存入口**(key/body 与真实首点逐字节一致;india 需 dashaSystem 默认补齐、
#   germanytech 口径≠AI 无头版、guolao 禁 snapshot 入口/kinastro 样式跳过、pd 抽纯函数绝不
#   dispatch)。双闸 horosa.perf.idleWarmQueue(总)/ horosa.perf.dataWarmTasks(细)。
# P3 邻位预取:jieqi 当前年取到后静默预取 year±1(generation 门控防连点风暴;闸 neighborPrefetch)。
# lazy-init A/B 实测不采纳(ON 中位 +86ms,成本搬家),旗子保持默认关;BeanTiming 观测器
# (astrostudyboot,HOROSA_BEAN_TIMING=1 才开)为下一轮定点惰化取数——jar 侧,非 overlay。
apply_patch horosa_data_warm_registry_v1   astrostudyui/src/utils/idleWarmQueue.js       src__utils__idleWarmQueue.dataWarmGroup.js.patch
apply_patch scheduleDataWarmGroup          "astrostudyui/src/utils/__tests__/idleWarmQueue.test.js" src__utils__tests__idleWarmQueue.test.dataWarmGroup.js.patch
apply_patch buildIndiaWarmParams           astrostudyui/src/components/astro/IndiaChart.js src__components__astro__IndiaChart.warmParams.js.patch
apply_patch horosa_prefetch_registry_v1    astrostudyui/src/components/guolao/GuoLaoChartMain.js src__components__guolao__GuoLaoChartMain.warmNatal.js.patch
apply_patch horosa_prefetch_registry_v1    astrostudyui/src/components/direction/AstroDirectMain.js src__components__direction__AstroDirectMain.warmPd.js.patch
apply_patch warmGermanyMidpoint            astrostudyui/src/components/germany/AstroMidpoint.js src__components__germany__AstroMidpoint.warmMidpoint.js.patch
apply_patch prefetchJieqiYearNeighbors     astrostudyui/src/utils/preciseCalcBridge.js   src__utils__preciseCalcBridge.neighborPrefetch.js.patch
apply_patch warmJieqiYear                  astrostudyui/src/components/jieqi/JieQiChartsMain.js src__components__jieqi__JieQiChartsMain.neighborPrefetch.js.patch

echo "== 24. Web 版启停三件套加固(毒化 env 剥离 / -X utf8 / exit-3 自解释 / pyc 预编译 / 可移植 stat;跨平台,建议上游化 Mac)=="
# start:①java spawn 前 env -u 剥离宿主 _JAVA_OPTIONS/JAVA_TOOL_OPTIONS/JDK_JAVA_OPTIONS/CLASSPATH
#(IDE/安卓工具链机器的经典注入面;镜像桌面 sanitizeEmbeddedRuntimeEnv);②python 剥离
# PYTHONHOME/PYTHONSTARTUP/PYTHONUSERBASE + `-X utf8` CLI 旗(宿主 PYTHONUTF8=0 也压不掉);
# ③三处 exit 3 前给「可重试」中英自解释(手动跑脚本的用户不再面对裸退出码);④就绪后 45s
# 空闲 pyc 预编译(HOROSA_WEB_PYC_PRECOMPILE=0 关,下次启动省 2-3s)。
# verify:file_mtime 的 stat 补 GNU -c 回退(此前 Git Bash 下恒回 0=freshness 永远判旧)。
apply_patch horosa_web_java_env_sanitize_v1  start_horosa_local.sh   start_horosa_local.webLauncherHardening.sh.patch
apply_patch horosa_web_portable_stat_v1      verify_horosa_local.sh  verify_horosa_local.portableStat.sh.patch

echo "== 25. QuickDockBar 契约测试跨平台修复(path.relative 归一 POSIX 分隔符;跨平台 bug,建议上游化 Mac) =="
# Mac v3.3.1 新增的 quickDockContract 源码扫描契约测试用 path.relative(COMPONENTS_DIR,f) 得到相对路径,
# 再与正斜杠字面量 WHITELIST/EXEMPT 比对;Windows 上 path.relative 返回反斜杠分隔 → .includes 恒 false →
# 白名单页(QuickDockBar/AstroChartMain/KinAstroMain)被误判为 offender、契约两测假红。修:relPosix()
# 归一到 POSIX 分隔符再比对(macOS path.sep='/' 时 split/join 为 no-op,行为逐字节不变)。
apply_patch horosa_win_pathsep_posix_v1  astrostudyui/src/components/common/__tests__/quickDockContract.test.js src__components__common__quickDockContract.pathsep.test.js.patch
# Mac v3.5.0 新增的 chartFreeContract 源码扫描契约测试同类:path.relative(SRC_ROOT,fp) 收集「.hook.chartFree=true」声明者
# 相对路径,与正斜杠期望表 toEqual 一一比对;Windows 反斜杠 → found != entries 假红。同法 split(path.sep).join('/') 归一。
apply_patch horosa_win_pathsep_posix_v1  astrostudyui/src/utils/__tests__/chartFreeContract.test.js src__utils__chartFreeContract.pathsep.test.js.patch

echo "== 26. PERF-R9 前端:交互跨度观测 + L1 真 LRU(纯观测/纯修 bug,功能零降级;跨平台,建议上游化 Mac) =="
# ① horosa_interaction_span_v1 —— 端到端「点击 → 中栏+右栏画完」测量。改之前这套观测**量不出**
#    要验收的那个数:':refresh-start' 全仓只有 changeTab 打点(切时间/改选项一次都不打,于是
#    markChartRefreshEnd 拿上次切页签的陈旧 start 配 measure,量出秒级垃圾);快车道(八字/紫微/
#    数算)在 models/astro.js 提前 return 从不打 refresh-end,而 chartId 变了 → render-complete
#    照样触发 → 三族报的是伪造时间;utils/perfMark.js 整个文件零调用点。
#    本补丁给 perfMark 加 markInteractionStart/markPanelReady(双 rAF 逼近已绘),
#    起点打在 pages/index.js 的防抖**之前**(并入 §5 累积补丁),终点由各技法 Main 自己打。
#    ★ mark 名必须含 ':refresh-start' —— markChartRefreshEnd 按该子串找最近一个 start,改名即静默断链。
# PERF-R9 追加:horosa_perf_reset_v1 —— 暴露 perfReset() 供验收台架
# (desktop_installer_bundle/scripts/perf_acceptance.cjs)在「切到该技法并稳定之后」清零,
# 使随后 N 次步进的 p95 只反映稳态单次操作,不被切页签的一次性装载成本污染。业务代码不调它。
apply_patch horosa_perf_reset_v1  astrostudyui/src/utils/perfMark.js  src__utils__perfMark.interactionSpan.js.patch
# ② horosa_dedupe_l1_lru_v1 —— requestDedupe 的 L1 命中后不重插,而 prune() 按 Map 插入序从头淘汰,
#    所以它一直是 **FIFO 而不是 LRU**(原注释「Map 插入序 = 简易 LRU」正是误解源头;L2 的 warm 分支
#    一直是对的,只有 L1 漏了)。后果:一串后台预取会把用户正在反复访问的那条挤出去,预取自己却活着 ——
#    预取覆盖面从 1 个端点扩到十几个技法之后,这个方向是反的,会主动伤害命中率。
#    ★ 刻意不刷新 ent.at:LRU 管淘汰顺序,TTL 管新鲜度;刷 at 会让热条目永不过期=偷改缓存语义。
apply_patch horosa_dedupe_l1_lru_v1     astrostudyui/src/utils/requestDedupe.js  src__utils__requestDedupe.l1Lru.js.patch
# ③ 配套回归断言(已受控验证:撤掉那两行则该断言变红 1/13,装回则 13/13 绿 —— 它真的能抓)。
apply_patch horosa_dedupe_l1_lru_v1     astrostudyui/src/utils/__tests__/requestDedupe.test.js  src__utils____tests____requestDedupe.l1Lru.test.js.patch

echo "== 27. PERF-R9 输出确定性:set 顺序不得泄漏进响应(真 bug 修复;跨平台,建议上游化 Mac) =="
# 症状:同一张盘,**每次重启软件**看到的若干列表顺序都可能不同(内容相同、排列乱跳)。
# 根因:CPython 默认开启哈希随机化(发货 app 不设 PYTHONHASHSEED),而这些结果是直接把
# set / 对 set 的推导 吐进响应的 —— 迭代顺序 = 哈希顺序 = 每进程不同。
# 实测(黄金台架跨进程比对,205 个星盘用例):修前 72 例仅顺序有别,分四处泄漏;修后 0 例。
#   ① perchart.getParallel  赤纬平行/反平行(西洋盘) → 按 const.LIST_ALL_POINTS 行星序
#   ② india/primitives.rasi_drishti  MOVABLE/FIXED/DUAL 是 set → 按 SIGNS 黄道十二宫序
#   ③ india/yoga_engine  NATURAL_BENEFICS/MALEFICS 三处推导 → 按 CLASSICAL_PLANETS 序
#   ④ india/yoga_engine.affliction_modifiers  同上 → 按 YOGA_PLANETS 序(含罗睺/计都)
# ★ 成员逐元素不变,只把「任意且不稳定」变成「确定且符合专业次序」;条数不变 ⇒ base_score 不变。
# ★ 这同时是后续一切逐字节回归比对的前提:不修它,星盘族的黄金永远不可能稳定。
# ①(perchart)并入 §17 既有的 chartMemo 累积补丁,marker 已在那里换成最新。
apply_patch horosa_rasi_drishti_stable_order_v1  astropy/astrostudy/india/primitives.py    astropy__india__primitives.stableOrder.py.patch
apply_patch horosa_yoga_planet_order_v1          astropy/astrostudy/india/yoga_engine.py   astropy__india__yoga_engine.stableOrder.py.patch

echo "== 28. PERF-R9 奇門引擎熱路徑 Tier-1(純去冗餘,零緩存語義;跨平台,建議上游化 Mac)=="
# 实测 /qimen/pan 中位:282ms → 190(去冗余)→ 120(惰性定局)→ **65.7ms**;
# 全 3528 例黄金矩阵墙钟 835.5s → 142.4s(5.87×),**逐字节零漂移**,kill-switch 关闭后同样零漂移。
# ① horosa_qimen_jiazi_const_v1  六十甲子是编译期常量,却每请求重建 4,712 次(282,720 次 lambda,
#    占 profile 46%)。20 个调用点已逐一审计为只读(切片/new_list/dict(zip)/split_list/repeat_list)。
# ② horosa_qimen_cse_v1  四处同参函数调两遍(zhishi_pai/zhifu_pai 各两次 —— 而 zhifu_n_zhishi
#    每请求被调 15 次;jq 两次;pan_earth / pan_earth_minute 各两次)。取自同一 dict 后,
#    keys()/values() 一一对应的保证**比原式更强**。
# ③ horosa_qimen_lazyju_v1  七处 `{1:chaibu(...),2:zhirun(...),3:maoshan(...),4:wurun(...)}.get(option)`
#    把四种定局法全部求值再丢弃三个,而其中三种都要走 sxtwl 逐日游标(_anchor_solstice 每请求 168 次、
#    Day_hasJieQi 32,166 次)。收敛为 config._select_ju。
#    ★★ 刻意**不给** .get 默认值:config 侧原本无默认,option 越界时 qmju=None → 下一行 qmju[0]
#       抛 TypeError → 服务返回 ResultCode -1。kinqimen.py 的 `.get(option, chaibu)` 带默认写法
#       **不可照抄到 config** —— 那会把越界请求从错误信封悄悄变成「按拆补法出盘」= 功能改变。
#       黄金矩阵已钉住 option∈{0,5} 的 -1 信封。
# ④ horosa_qimen_pan_memo_v1  Qimen 实例级 memo。地基:webqimensrv 每请求新建实例、两个 thread-local
#    开关在**构造之前**设定 ⇒ 实例生命周期 == 请求生命周期;_json_safe 重建所有 dict/list ⇒ 共享
#    对象不泄漏进响应(`minute is not selected` 身份判定值不变)。消掉 overall() 对 pan() 的重复求值(45%)。
#    ★ config.pan_sky_minute **绝不可** memo —— kinqimen.gong_chengsun_minute 会 `del sky["中"]`
#      就地变异它的返回值(已核实:那是本文件唯一一处就地变异)。
apply_patch horosa_qimen_jiazi_const_v1  vendor/kinqimen/jieqi.py     vendor__kinqimen__jieqi.qimenPerf.py.patch
apply_patch horosa_qimen_lazyju_v1       vendor/kinqimen/config.py    vendor__kinqimen__config.qimenPerf.py.patch
apply_patch horosa_qimen_pan_memo_v1     vendor/kinqimen/kinqimen.py  vendor__kinqimen__kinqimen.panMemo.py.patch
echo "   ^^ 改动后必须跑:python windows-adaptations/golden/verify_golden.py --verify --groups qimen"

echo "== 29. PERF-R9 星历路径短路(全局共享层,单点收益最大;跨平台,强烈建议上游化 Mac)=="
# applySiderealMode 每次 swe 调用都会走一趟 ensureEphePath,而后者无条件重设星历路径 ——
# 这是个**幂等**操作。cProfile 实测:单次 BirthJieQi.compute() 里 `swisseph.set_ephe_path`
# 被调用 **680 次、耗时 82ms = 该端点的 61%**。而这条链是:
#   set_ephe_path → /jieqi/birth(154ms,ChartController.baziAssemble 的最大单项)
#                 → baziAssemble(~370ms,冷 /chart 的 75%)→ 冷 /chart
# 安全性依据:`swisseph.set_ephe_path` 自 swe.py 的 `swisseph.set_ephe_path = _guardedSetEphePath`
# 起就是**进程内唯一入口**(已 grep 全仓确认无任何 `from swisseph import set_ephe_path` 绕过它;
# vendor/kinastro 的 `swe.set_ephe_path("")` 全部经运行时属性查找路由过来)⇒ 它可以可靠持有
# 「当前真正生效的路径」;一旦有外部调用者改动,比较立刻失配、照旧恢复,语义零变化。
# 实测:BirthJieQi.compute 135→12.5ms(10×)· /jieqi/birth 端到端 154→28.5ms(5.4×)·
# 全 3823 例黄金矩阵零漂移(唯 6 例 wangji 是另一项 owner 批准的载荷变更)。
# kill-switch:HOROSA_EPHE_PATH_FASTPATH=0。
apply_patch horosa_ephe_path_fastpath_v1  flatlib-ctrad2/flatlib/ephem/swe.py  flatlib__ephem.swe.ephePathFastpath.py.patch


echo "== 30. PERF-R9 前端渲染 + 技法结果缓存 + 载荷按需(功能零降级;跨平台,建议上游化 Mac)=="
# ---- 30a 稳定 React key(horosa_stable_react_keys_v1)----
# 仓库里曾有 **222 处** `key={randomStr(8)}`(41 个文件)。随机 key 每次渲染都变 → React 无法 diff
# → 整棵子树**卸载重建**而不是打补丁。全部换成内容派生、兄弟间唯一的稳定 key。
# ★ 陷阱:看似单例的块可能位于外层 for/map 内,裸字面量会跨迭代撞键 —— AstroInfo 的
#   MinDelta/MarsSaturn/SunMoon/VenusJupiter 四块正是如此,改用 `${key}-minDelta` 复合键。
# 验证:umi 全绿 0 key 警告;另对 33 个无测试覆盖的组件做了 AST 静态查重(兄弟重复/循环内常量键)。
# 仓库级门 check_no_random_react_keys 永久禁止它回来。
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/astro/AstroAspect.js               src__components__astro__AstroAspect.perfR9.js.patch
apply_patch horosa_panel_ready_v1               astrostudyui/src/components/astro/AstroFirdaria.js             src__components__astro__AstroFirdaria.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1            astrostudyui/src/components/astro/AstroGivenYear.js            src__components__astro__AstroGivenYear.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/astro/AstroInfo.js                 src__components__astro__AstroInfo.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1            astrostudyui/src/components/astro/AstroLunarReturn.js          src__components__astro__AstroLunarReturn.perfR9.js.patch
apply_patch horosa_aspect_dom_memo_v1           astrostudyui/src/components/astro/AstroProfection.js           src__components__astro__AstroProfection.perfR9.js.patch
apply_patch horosa_aspect_dom_memo_v1           astrostudyui/src/components/astro/AstroSolarArc.js             src__components__astro__AstroSolarArc.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1            astrostudyui/src/components/astro/AstroSolarReturn.js          src__components__astro__AstroSolarReturn.perfR9.js.patch
apply_patch horosa_panel_ready_v1               astrostudyui/src/components/astro/AstroYearSystem129.js        src__components__astro__AstroYearSystem129.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/cntradition/GanHeCong.js           src__components__cntradition__GanHeCong.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/cntradition/Gods.js                src__components__cntradition__Gods.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/cntradition/MDSYear.js             src__components__cntradition__MDSYear.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/cntradition/MainDirection.js       src__components__cntradition__MainDirection.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/cntradition/MainDirectionSimple.js src__components__cntradition__MainDirectionSimple.perfR9.js.patch
apply_patch horosa_bazi_deadwork_v1             astrostudyui/src/components/cntradition/PaiBaZi.js             src__components__cntradition__PaiBaZi.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/cntradition/SmallDirection.js      src__components__cntradition__SmallDirection.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/cntradition/Zhu.js                 src__components__cntradition__Zhu.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/cntradition/ZhuMing12.js           src__components__cntradition__ZhuMing12.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/cntradition/ZiHeCong.js            src__components__cntradition__ZiHeCong.perfR9.js.patch
apply_patch horosa_no_state_mutation_v1         astrostudyui/src/components/commtools/BaziPattern.js           src__components__commtools__BaziPattern.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/commtools/BaziPithy.js             src__components__commtools__BaziPithy.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/commtools/Calculator.js            src__components__commtools__Calculator.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/commtools/CuanGong12Desc.js        src__components__commtools__CuanGong12Desc.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/commtools/CuanGong12Query.js       src__components__commtools__CuanGong12Query.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/commtools/InverseBazi.js           src__components__commtools__InverseBazi.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/commtools/NaYing.js                src__components__commtools__NaYing.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/comp/EditableTags.js               src__components__comp__EditableTags.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/comp/TipsBoard.js                  src__components__comp__TipsBoard.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/germany/AspectToMidpoint.js        src__components__germany__AspectToMidpoint.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/gua/GuaSym.js                      src__components__gua__GuaSym.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/gua/MeiyiGuaSym.js                 src__components__gua__MeiyiGuaSym.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/guazhan/GuaDesc.js                 src__components__guazhan__GuaDesc.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/relative/AntisciaInfo.js           src__components__relative__AntisciaInfo.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/relative/AspectInfo.js             src__components__relative__AspectInfo.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/relative/MidpointInfo.js           src__components__relative__MidpointInfo.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/ruleziwei/RuleHouses.js            src__components__ruleziwei__RuleHouses.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/ruleziwei/RuleHuaDesc.js           src__components__ruleziwei__RuleHuaDesc.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/ruleziwei/RuleSihua.js             src__components__ruleziwei__RuleSihua.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/ruleziwei/RuleStars.js             src__components__ruleziwei__RuleStars.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/user/CaseList.js                   src__components__user__CaseList.perfR9.js.patch
apply_patch horosa_stable_react_keys_v1         astrostudyui/src/components/user/ChartList.js                  src__components__user__ChartList.perfR9.js.patch

# ---- 30b kentang 原始 fetch 结果缓存(horosa_kentang_result_cache_v1)----
# 14 个 kentang raw-fetch 调用点里 **11 个零缓存**(它们绕过 utils/request ⇒ 绕过 requestDedupe/
# chartMem/全部 LRU);另有 9 处 per-instance 缓存切页签即毁。统一走 services/_kentangResultCache.js
# (语义照搬 services/qizheng.js:66-98:per-ns LRU + 存取双 clone + in-flight 合并 + 假值不入)。
# ★★ 绝不缓存随机起卦:地占(random seed)、荆诀(random 蓍草)本就排除;**五兆是本轮查出来的**
#   —— webwuzhaosrv 在 mode∈{day,hour,minute,tang} 且无 manual_splits 时走 random.randint,
#   故加了 wuzhaoCacheable() 门,只在 mode==='ganzhi' 或 manual===true 时才缓存。
#   (太玄用 random 但由 _with_seed 按 payload.seed 确定性播种且起筮会换 seed,安全。)
# 全部门在 techniqueResultCacheEnabled() 上,关闭即逐字节回到改动前。
apply_patch horosa_panel_scu_v1                 astrostudyui/src/components/calendar/HuangLiMain.js            src__components__calendar__HuangLiMain.perfR9.js.patch
apply_patch horosa_kentang_result_cache_v1      astrostudyui/src/components/dunjia/DunJiaCalc.js               src__components__dunjia__DunJiaCalc.perfR9.js.patch
# (v3.5.1:地占页上游全面改版并自带 FreezeSubTab/渲染守卫 —— 我方 GeomancyMain freeze 补丁退役;
#  上游机制由 selfcheck 哨兵钉[FreezeSubTab + markPanelReady],上游若删除会在哨兵门现形。)
apply_patch horosa_freeze_subtabs_v1            astrostudyui/src/components/jingjue/JingJueMain.js             src__components__jingjue__JingJueMain.perfR9.js.patch
apply_patch horosa_kentang_result_cache_v1      astrostudyui/src/components/jinkou/JinKouCalc.js               src__components__jinkou__JinKouCalc.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1            astrostudyui/src/components/jinkou/JinKouMain.js               src__components__jinkou__JinKouMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1            astrostudyui/src/components/kinastro/KinAstroMain.js           src__components__kinastro__KinAstroMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1            astrostudyui/src/components/lrzhan/LiuRengMain.js              src__components__lrzhan__LiuRengMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1            astrostudyui/src/components/shenyishu/ShenYiShuMain.js         src__components__shenyishu__ShenYiShuMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1            astrostudyui/src/components/taixuan/TaiXuanMain.js             src__components__taixuan__TaiXuanMain.perfR9.js.patch
apply_patch horosa_kentang_result_cache_v1      astrostudyui/src/components/taiyi/TaiYiCalc.js                 src__components__taiyi__TaiYiCalc.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1            astrostudyui/src/components/wuzhao/WuZhaoMain.js               src__components__wuzhao__WuZhaoMain.perfR9.js.patch
apply_patch horosa_xuanshi_longtext_ondemand_v1 astrostudyui/src/services/xuanshi.js                           src__services__xuanshi.perfR9.js.patch

# ---- 30c 超大载荷改按需取(owner 明确批准:长文本按需)----
# 皇极经世:/wangji/pan 原本每次都随响应发 979,910 字节的典籍全文 → 实测 1,961,244 B;
#   改为只发目录 + 新增 /wangji/classic 单取,前端按 classicKey 模块级缓存一次。
#   实测 **1,961,244 → 27,249 B(72×)**;「换章节/换视图」仍是纯本地瞬时切换(内容已在客户端)。
#   AI 导出三条路径全部覆盖(异步合并 / headless 前 await / 同步路径从模块缓存零延迟兜底)。
# 玄学史:microchronology 原本无 LIMIT 无分页地吐全表 21 列(含三个长文本列),且**绕过**
#   load_events 的模块 memo 每次重查 SQLite(1277→1303ms 平坦即铁证)。
#   改为列表不取长文本 + 按 id 取详情 + 纳入 _CACHE。实测第二次 **1,127.7ms → 11.7ms(96×)**、
#   载荷 **26.4MB → 257KB**;计数/筛选语义逐字节等价(summary 仍在全量行上计算)。
#   预热同时改瞄真正贵的 microchronology(原先只预热 20KB 的 summary,对那 1.3 秒毫无帮助)。
apply_patch horosa_xuanshi_longtext_ondemand_v1 astropy/astrostudy/xuanshi/celestial.py                        astropy__astrostudy__xuanshi__celestial.perfR9.py.patch
apply_patch horosa_ephe_path_fastpath_v1        astropy/tests/test_india_ephemeris_degrade.py                  astropy__tests__test_india_ephemeris_degrade.perfR9.py.patch
apply_patch horosa_wangji_classics_ondemand_v1  astropy/websrv/webwangjisrv.py                                 astropy__websrv__webwangjisrv.perfR9.py.patch
apply_patch horosa_xuanshi_longtext_ondemand_v1 astropy/websrv/webxuanshisrv.py                                astropy__websrv__webxuanshisrv.perfR9.py.patch
apply_patch horosa_freeze_subtabs_v1            astrostudyui/src/components/huangji/HuangJiMain.js             src__components__huangji__HuangJiMain.perfR9.js.patch
apply_patch horosa_xuanshi_longtext_ondemand_v1 astrostudyui/src/components/xuanshi/XuanShiMicro.js            src__components__xuanshi__XuanShiMicro.perfR9.js.patch

echo "== 31. PERF-R9 Ship 7 预取与预热全覆盖(白名单从注释变运行时闸 + 技法预取注册表 + chartFree 快车道;纯前端、kill-switch、功能零降级)=="
# ---- 31a 运行时白名单闸(horosa_prefetch_runtime_whitelist_v1)----
# 病根:旧任务契约是 {name, run},run 是不可内省的闭包 —— PREFETCH_ALLOWED_PATHS /
# PREFETCH_FORBIDDEN_MARKERS 只是注释 + 一个 jest 快照,submitStepPrefetch 从不看 URL;
# 且旧允许集里裸 '/pan' 匹配不到任何真实路径(真路径是 /qimen/pan…)= 形同虚设。
# 预取【随机起卦 / 取现时 / 流式】端点 = 把随机结果或「此刻」钉死进缓存 = 功能性降级(比慢更糟)。
# 修法两层:①契约加 path 声明位,提交期不合格即丢弃(不抛错:预取是优化不是功能);
#           ②纵深防御 —— pump 期间置 ambient 标志,request.js / chartFetch.js 对不合格 URL 拒发。
# ★ kentang 全族走 chartFetch 的裸 fetch(不经 utils/request),没有 ②整族在任何白名单之外。
# ★ 非预取作用域两闸恒放行 ⇒ 用户真实请求逐字节零行为变化。
apply_patch horosa_prefetch_runtime_whitelist_v1 astrostudyui/src/utils/stepPrefetch.js  src__utils__stepPrefetch.prefetchWhitelist.js.patch
apply_patch horosa_prefetch_runtime_whitelist_v1 astrostudyui/src/utils/request.js       src__utils__request.prefetchWhitelist.js.patch
apply_patch horosa_prefetch_runtime_whitelist_v1 astrostudyui/src/utils/chartFetch.js    src__utils__chartFetch.prefetchWhitelist.js.patch

# ---- 31b 技法步进预取注册表(horosa_prefetch_registry_v1)----
# 此前只有 /chart 一个端点进预取,非占星页(印占/辅盘/遁甲/三式/太乙…)gate 面板的是**技法端点**,
# 点下一步照样等一次冷计算。各技法在自己的组件里登记 registerStepPrefetcher —— 登记必须在组件内:
# 构参吃组件态(流派/子页/引擎模式),模块级构不出与真点逐字节同键的 body。
# ★ 每条登记都自带 path 声明,过 31a 的运行时白名单;两段式技法只登记 stage-1(确定性历法)。
# ★ 随机起卦族(地占/荆诀/五兆/小六壬)与取现时族(七政 Moira 流年)一律不登记,白名单禁词兜底。
apply_patch horosa_prefetch_registry_v1 astrostudyui/src/components/astro/IndiaChartMain.js      src__components__astro__IndiaChartMain.prefetchRegistry.js.patch
apply_patch horosa_prefetch_registry_v1 astrostudyui/src/components/auxchart/AuxChartMain.js     src__components__auxchart__AuxChartMain.prefetchRegistry.js.patch
apply_patch horosa_prefetch_registry_v1 astrostudyui/src/components/dunjia/DunJiaMain.js         src__components__dunjia__DunJiaMain.prefetchRegistry.js.patch
apply_patch horosa_prefetch_registry_v1 astrostudyui/src/components/sanshi/SanShiUnitedMain.js   src__components__sanshi__SanShiUnitedMain.prefetchRegistry.js.patch
apply_patch horosa_prefetch_registry_v1 astrostudyui/src/components/taiyi/TaiYiMain.js           src__components__taiyi__TaiYiMain.prefetchRegistry.js.patch
# 步进预取金标:任务序(近端优先 + 技法端点先于同向 chart)、技法登记方收到【已步进】的 fields
# (旧版传基准 fields = 预取当前那张盘 = 白打)、每个任务必须自带 path 声明。
apply_patch horosa_prefetch_registry_v1 "astrostudyui/src/utils/__tests__/stepPrefetch.test.js"  src__utils____tests____stepPrefetch.prefetchRegistry.test.js.patch

# ---- 31c chartFree 快车道扩容(horosa_chart_free_declared_v1)----
# 声明 hook.chartFree=true 的页,fetchByFields 走快车道:fields 立即提交、不等 /chart 网络
# (整整省掉一次往返)。本轮把上一轮遗留的三个「已核实但无从声明」候选核毕并迁入:
# 风水此前连 hook 都没接(故无从声明),本轮补接 hook 只为承载这条声明,不注册 .fun。
# ★ 组件里的声明与 utils/techniqueChartFree.js 的登记是**一对**:只登记不声明=无效;
#   只声明不登记 = chartFreeContract 契约测试红(它 grep 源文件核「零 props.value/chartObj 消费」)。
apply_patch horosa_chart_free_declared_v1 astrostudyui/src/utils/techniqueChartFree.js                src__utils__techniqueChartFree.chartFree.js.patch
apply_patch horosa_chart_free_declared_v1 astrostudyui/src/components/fengshui/FengShuiMain.js        src__components__fengshui__FengShuiMain.chartFree.js.patch
apply_patch horosa_chart_free_declared_v1 astrostudyui/src/components/calendar/CalendarMain.js        src__components__calendar__CalendarMain.chartFree.js.patch
apply_patch horosa_chart_free_declared_v1 astrostudyui/src/components/cntradition/CnTraditionMain.js  src__components__cntradition__CnTraditionMain.chartFree.js.patch

# ---- 31d 数据层预热注册表的三个新文件(horosa_data_warm_registry_v1;Mac 基线里不存在 → 全量拷贝层)----
# 预热清单原本写死在 pages/index.js 的一条 4 元素数组里 —— 与技法零关系的页面组件持有技法知识,
# 漏项没人发现(紫微 /ziwei/birth 首点概率最高却整轮不在组里)。改注册表:追加一条 = 一行登记,
# Map 插入序 = 首点概率序 = 执行序。dataWarmTasks.js / 两个测试都是 **Windows 原创新文件**
# (regen_patch.py 只能对 Mac 基线里存在的文件做 diff),故走 cp 而不是 patches/。
mkdir -p "$WS/astrostudyui/src/utils/__tests__"
cp "$OV/files/astrostudyui/src/utils/dataWarmTasks.js"                        "$WS/astrostudyui/src/utils/dataWarmTasks.js"                        && ok "dataWarmTasks.js"
cp "$OV/files/astrostudyui/src/utils/__tests__/dataWarmTasks.test.js"         "$WS/astrostudyui/src/utils/__tests__/dataWarmTasks.test.js"         && ok "dataWarmTasks.test.js"
cp "$OV/files/astrostudyui/src/utils/__tests__/stepPrefetchWhitelist.test.js" "$WS/astrostudyui/src/utils/__tests__/stepPrefetchWhitelist.test.js" && ok "stepPrefetchWhitelist.test.js"


echo "== 32. PERF-R9 Ship 6 前端渲染优化(markPanelReady 观测终点 + React.memo/sCU 拆分 + FreezeSubTab 子页签冻结;纯前端、kill-switch、功能零降级)=="
# 三条主线、73 个目标文件。三者互相咬合:没有 ① 就量不出验收的那个数,没有 ③ 就永远在为看不见的
# 子页签付渲染,没有 ② 则父组件的一次无关 setState 照样穿透到最重的那棵子树。
#   ① horosa_panel_ready_v1(101 处)——「面板画完」的观测终点。此前 `render-complete` 只由
#      chartObj.chartId 变化触发(= 排盘回来那一刻),右栏技法面板**自己**那次 setState 之后的重绘
#      完全不在计内 ⇒ owner 的验收口径「点击 → 中栏+右栏画完 ≤1s」根本量不出来。markPanelReady 打在
#      **结果落定的那一次 setState 的回调**里(双 rAF 逼近「本帧已绘」+ generation 去重)。纯观测,
#      零行为变化;总闸 horosa.perf.interactionMarks。
#   ② sCU / React.memo 拆分 —— 盘面与重表格组件补 shouldComponentUpdate,一律走 utils/chartUpdateGuard
#      的 wrapperPropsEqual / shallowPropsEqual(函数型 props 视为恒等、显示数组按内容比、**自身 state
#      变恒重渲**)。kill-switch:horosa.perf.chartSCU=0 ⇒ 比较器恒返 false = 逐字节旧行为。
#      ★ 前提是 Ship 7 已根治 pages/index.js `changeCond` 的就地变异(§31 / FE-18):不修它,「旧 fields」
#        与「新 fields」的嵌套引用完全相同,任何按引用比较的 memo/sCU 都会判错 —— 加多少 memo 都是白加。
#   ③ horosa_freeze_subtabs_v1 —— 子页签冻结(comp/FreezeInactive.js 的 FreezeSubTab)。antd Tabs 默认把
#      **全部**子页签常驻渲染,改一次时间/选项就把每一页重画一遍。改受控 activeKey + FreezeSubTab:只渲
#      前台那一个,切回时拿本轮最新 children 立即渲一帧 —— 不卸载、不重发请求、不丢滚动位置。
#      kill-switch:horosa.perf.freezeSubTabs=0(恒渲)/ horosa.perf.subTabDeferMount=0(不延迟首挂)。
# ⚠️ 累积文件的 guard 一律取**文件内位置最靠后**的 marker(gotcha #48),故 §5/§8/§13/§14/§30 里 20 行的
#    guard 串本轮已**就地更新**;绝不为同一目标再开第二行(R1 双射会红)。
# ⚠️ 四个目标本轮的改动不带 horosa_* marker(两个 sCU 壳只加 wrapperPropsEqual、一个 useMemo+rowKey、
#    一个是测试),故 guard 取「补丁引入且改前不存在」的代码串;它们同样是各自哨兵条目的钉(R4)。

# ---- 32a 子页签冻结的基础设施(FreezeSubTab 本体;下面所有 horosa_freeze_subtabs_v1 行都依赖它)----
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/comp/FreezeInactive.js              src__components__comp__FreezeInactive.perfR9.js.patch

# ---- 32b 占星族(astro / astro3d / auxchart / hellenastro)----
# 本族是 markPanelReady 的主战场:右栏每个技法面板都在自己的 setState 后画完,而观测终点此前一律缺席。
# 多方法页(推运/回归/印度推运/星历)另叠 FreezeSubTab —— 一个方法一张盘 + 一套表,此前**全部**方法
# 常驻重渲。AstroChartMain / AstroDoubleChartMain 是壳层 sCU(wrapperPropsEqual)。
# __tests__/chartSCU.test.js:MidpointMain 因接入 FreezeSubTab 首次有了 state,sCU 随之加 state 守卫;
# 旧测试**单参**调用 sCU ⇒ nextState===undefined ⇒ 恒返 true ⇒ 一批期望 true 的用例变成**假绿**。
# 改为统一经 `scu(c, next)` 传 c.state(真实 React 永远会传 nextState),并补一条 state 变→true 的用例。
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/astro/AstroAgePoint.js              src__components__astro__AstroAgePoint.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/astro/AstroBalbillus.js             src__components__astro__AstroBalbillus.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/astro/AstroChartMain.js             src__components__astro__AstroChartMain.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/astro/AstroDecennials.js            src__components__astro__AstroDecennials.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/astro/AstroDistributions.js         src__components__astro__AstroDistributions.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/astro/AstroDoubleChartMain.js       src__components__astro__AstroDoubleChartMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/astro/AstroEphemeris.js             src__components__astro__AstroEphemeris.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/astro/AstroExtraReturns.js          src__components__astro__AstroExtraReturns.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/astro/AstroJaynesProgressions.js    src__components__astro__AstroJaynesProgressions.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/astro/AstroKeypoints.js             src__components__astro__AstroKeypoints.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/astro/AstroLunationPhase.js         src__components__astro__AstroLunationPhase.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/astro/AstroPersianDirected.js       src__components__astro__AstroPersianDirected.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/astro/AstroPlanetaryAges.js         src__components__astro__AstroPlanetaryAges.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/astro/AstroPlanetaryArc.js          src__components__astro__AstroPlanetaryArc.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/astro/AstroPrenatalSyzygy.js        src__components__astro__AstroPrenatalSyzygy.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/astro/AstroPrimaryDirection.js      src__components__astro__AstroPrimaryDirection.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/astro/AstroPrimaryDirectionChart.js src__components__astro__AstroPrimaryDirectionChart.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/astro/AstroProgressions.js          src__components__astro__AstroProgressions.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/astro/AstroRelative.js              src__components__astro__AstroRelative.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/astro/AstroReturnTimeline.js        src__components__astro__AstroReturnTimeline.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/astro/AstroTriplicityRulers.js      src__components__astro__AstroTriplicityRulers.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/astro/AstroVedicProgressions.js     src__components__astro__AstroVedicProgressions.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/astro/AstroZR.js                    src__components__astro__AstroZR.perfR9.js.patch
apply_patch "c.shouldComponentUpdate(nextProps," astrostudyui/src/components/astro/__tests__/chartSCU.test.js    src__components__astro____tests____chartSCU.test.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/astro3d/AstroChartMain3D.js         src__components__astro3d__AstroChartMain3D.perfR9.js.patch
apply_patch horosa_shallow_scu_v1                astrostudyui/src/components/astro3d/AstroPDSphere.js            src__components__astro3d__AstroPDSphere.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/auxchart/AstroDraconicLab.js        src__components__auxchart__AstroDraconicLab.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/auxchart/AstroHarmonicLab.js        src__components__auxchart__AstroHarmonicLab.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/auxchart/AstroRelocationLab.js      src__components__auxchart__AstroRelocationLab.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/hellenastro/AstroChart13.js         src__components__hellenastro__AstroChart13.perfR9.js.patch

# ---- 32c 黄历族(calendar)----
# 农历/日子馆/通书三页是「一次请求 → 一大片静态表格」的形状,父页任何 state 抖动都全量重排。
# horosa_panel_scu_v1 给面板补 sCU;YearAuspiciousPanel 的 catOptions 只随「含丧葬」开关变,
# 提进 useMemo,并给 antd List 补 rowKey(否则 List 退回下标键)。
apply_patch horosa_panel_scu_v1                  astrostudyui/src/components/calendar/NongLiMain.js              src__components__calendar__NongLiMain.perfR9.js.patch
apply_patch horosa_panel_scu_v1                  astrostudyui/src/components/calendar/RiziMain.js                src__components__calendar__RiziMain.perfR9.js.patch
apply_patch horosa_panel_scu_v1                  astrostudyui/src/components/calendar/TongshuMain.js             src__components__calendar__TongshuMain.perfR9.js.patch
apply_patch rowKey=                              astrostudyui/src/components/calendar/YearAuspiciousPanel.js     src__components__calendar__YearAuspiciousPanel.perfR9.js.patch

# ---- 32d 八字族(cntradition)----
# BaZi.js 是全站最重的壳之一:三处派生(chartBazi / 子组件 props / 构参)每次重渲都从头重算。
# BaZiLuckFlowPanel 的 buildLuckItems→buildYearItems→buildMonthItems→buildDayItems 这条链在 render /
# emitSelection / 四个点击回调里各算一遍,其中 buildDayItems 要走 lunar-javascript 取整月每日干支(最贵);
# 改为按【全部输入】做小容量记忆(键覆盖每个构建器的全部形参 ⇒ 命中即输出逐字段相同,不可能陈旧)。
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/cntradition/BaZi.js                 src__components__cntradition__BaZi.perfR9.js.patch
apply_patch horosa_bazi_info_split_v1            astrostudyui/src/components/cntradition/BaZiAppInfoPanel.js     src__components__cntradition__BaZiAppInfoPanel.perfR9.js.patch
apply_patch horosa_bazi_finechart_scu_v1         astrostudyui/src/components/cntradition/BaZiFineChart.js        src__components__cntradition__BaZiFineChart.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/cntradition/BaZiLegacyView.js       src__components__cntradition__BaZiLegacyView.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/cntradition/BaZiLuckFlowPanel.js    src__components__cntradition__BaZiLuckFlowPanel.perfR9.js.patch

# ---- 32e 紫微族(ziwei)----
# 盘/运限/格局/输入四块各自 sCU:紫微一张盘 12 宫 × 上百星曜,是本族最重的 DOM。
apply_patch horosa_ziwei_luck_scu_v1             astrostudyui/src/components/ziwei/ZWLuckPanel.js                src__components__ziwei__ZWLuckPanel.perfR9.js.patch
apply_patch horosa_ziwei_pattern_scu_v1          astrostudyui/src/components/ziwei/ZWPatternPanel.js             src__components__ziwei__ZWPatternPanel.perfR9.js.patch
apply_patch horosa_ziwei_chart_scu_v1            astrostudyui/src/components/ziwei/ZiWeiChart.js                 src__components__ziwei__ZiWeiChart.perfR9.js.patch
apply_patch horosa_ziwei_input_scu_v1            astrostudyui/src/components/ziwei/ZiWeiInput.js                 src__components__ziwei__ZiWeiInput.perfR9.js.patch

# ---- 32f 数算族(shusuan / yizhangjing)----
# 参评/河洛/正传/一掌经四个原生壳补 wrapperPropsEqual sCU(与 ShuSuanMain/BaZi/ZiWeiMain 同范式);
# 正传另叠 FreezeSubTab。
apply_patch horosa_shusuan_native_scu_v1         astrostudyui/src/components/shusuan/CanPingMain.js              src__components__shusuan__CanPingMain.perfR9.js.patch
apply_patch horosa_shusuan_native_scu_v1         astrostudyui/src/components/shusuan/HeLuoMain.js                src__components__shusuan__HeLuoMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/shusuan/ZhengChuanMain.js           src__components__shusuan__ZhengChuanMain.perfR9.js.patch
apply_patch horosa_shusuan_native_scu_v1         astrostudyui/src/components/yizhangjing/YiZhangJingMain.js      src__components__yizhangjing__YiZhangJingMain.perfR9.js.patch

# ---- 32g 汉堡学派(germany)----
# 转盘页右栏是「一个刻度盘 + N 张表」,此前右栏面板全部常驻:改 FreezeSubTab + 右栏惰性挂载
# (horosa_lazy_right_panels_v1)+ 刻度盘/宫位框 sCU(horosa_dial_scu_v1 / horosa_frames_scu_v1)。
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/germany/AstroGermany.js             src__components__germany__AstroGermany.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/germany/MidpointMain.js             src__components__germany__MidpointMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/germany/UranianDialMain.js          src__components__germany__UranianDialMain.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/germany/UranianGraphicEphemeris.js  src__components__germany__UranianGraphicEphemeris.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/germany/UranianHouseFrames.js       src__components__germany__UranianHouseFrames.perfR9.js.patch

# ---- 32h 其余技法壳与面板 ----
# 形状一致:主壳是「左表单 + 中盘 + 右栏多子页签」,此前右栏全部子页签常驻重渲;补 FreezeSubTab +
# 受控 activeKey(必要时加 horosa_controlled_tab_clamp_v1:页签集合随结果变化时,选过的键仍在就保持,
# 否则回落默认键,绝不停在不存在的键上显示空白),并在结果落定处补 markPanelReady。
# AIAnalysisMain 另叠 horosa_markdown_lru_v1(流式 markdown→HTML 渲染结果 LRU,避免每 chunk 全量重渲)。
# LiuRengChart / MingOtherMain 是纯 sCU 壳(见上方 ⚠️ 第二条:本轮改动不引入 marker,guard 取代码串)。
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/acg/AstroAcg.js                     src__components__acg__AstroAcg.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/aianalysis/AIAnalysisMain.js        src__components__aianalysis__AIAnalysisMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/cnyibu/CnYiBuMain.js                src__components__cnyibu__CnYiBuMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/commtools/CommToolsMain.js          src__components__commtools__CommToolsMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/dice/DiceMain.js                    src__components__dice__DiceMain.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/election/ElectionMain.js            src__components__election__ElectionMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/feigong/FeiGongMain.js              src__components__feigong__FeiGongMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/guazhan/GuaZhanMain.js              src__components__guazhan__GuaZhanMain.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/guice/GuiceMain.js                  src__components__guice__GuiceMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/guolao/GuoLaoMoiraPanel.js          src__components__guolao__GuoLaoMoiraPanel.perfR9.js.patch
apply_patch horosa_guolao_doc_scu_v1             astrostudyui/src/components/guolao/GuoLaoStarSectDoc.js         src__components__guolao__GuoLaoStarSectDoc.perfR9.js.patch
apply_patch horosa_panel_ready_v1                astrostudyui/src/components/horary/HoraryMain.js                src__components__horary__HoraryMain.perfR9.js.patch
apply_patch wrapperPropsEqual                    astrostudyui/src/components/lrzhan/LiuRengChart.js              src__components__lrzhan__LiuRengChart.perfR9.js.patch
# (v3.5.1:MingOtherMain 的 sCU 壳已被上游逐字节收编 —— 工作区与 Mac 基线全同,补丁退役;
#  守卫存续由 selfcheck 哨兵钉 wrapperPropsEqual,上游若删会现形。)
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/mundane/MundaneMain.js              src__components__mundane__MundaneMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/suzhan/SuZhanMain.js                src__components__suzhan__SuZhanMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/tarot/TarotMain.js                  src__components__tarot__TarotMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/tongshefa/TongSheFaMain.js          src__components__tongshefa__TongSheFaMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/xiaochengtu/XiaoChengTuMain.js      src__components__xiaochengtu__XiaoChengTuMain.perfR9.js.patch
apply_patch horosa_freeze_subtabs_v1             astrostudyui/src/components/xiaoliuren/XiaoLiuRenMain.js        src__components__xiaoliuren__XiaoLiuRenMain.perfR9.js.patch

echo "== 33. PERF-R10 Ship2「选步长即武装」预取(horosa_step_prefetch_arm_v1)=="
# 病根:预取单位只来自上一次步进 hint(无 hint 硬编码 'm'),选完新步长的第一下必 miss(owner
# 原话「第一下卡之后不卡」);且紫微/遁甲步进走本地漏斗不经 fetchByFields,登记的预取器从未触发。
# 武装 = 四个时机(选步长/settle/本地漏斗/切页签)按当前档位预好 ±1..±depth:
#   · stepPrefetchArm.js 是 **Windows 原创新文件** → 全量拷贝层(同 §31d 理由);其余 12 个
#     目标的改动已并入各自累积补丁(guard 取最新 marker,gotcha #48,本节不重复开行);
#   · DateTimeSelector 是全站唯一步长入口,首次进契约 → 新补丁行在下方;
#   · kill-switch:horosa.perf.stepPrefetchArm(关=只剩 R9 步进后预取)/ stepPrefetchDepth(0..5)。
cp "$OV/files/astrostudyui/src/utils/stepPrefetchArm.js"                      "$WS/astrostudyui/src/utils/stepPrefetchArm.js"                      && ok "stepPrefetchArm.js"
cp "$OV/files/astrostudyui/src/utils/__tests__/stepPrefetchArm.test.js"       "$WS/astrostudyui/src/utils/__tests__/stepPrefetchArm.test.js"       && ok "stepPrefetchArm.test.js"
cp "$OV/files/astrostudyui/src/utils/__tests__/perfMark.test.js"              "$WS/astrostudyui/src/utils/__tests__/perfMark.test.js"              && ok "perfMark.test.js"
# (v3.5.1:DateTimeSelector 步长触发线换血为上游 fireStepSelectPrefetch[opt-in prop 宿主闸],
#  我方 stepArm 补丁退役;Windows 武装引擎经 models/astro.js registerStepSelectHandler 接管,
#  由 §22 astro 累积补丁承载 —— 哨兵见 selfcheck 对应条目。)
# ---- 33b PERF-R10 Ship5/6 前端缓存统一 + 温启现场恢复 ----
#   · (v3.5.1)kentang L3 已随 _kentangResultCache 退役,上游 kentangCache.js 接管(见 §1 注);
#     Windows-ahead 守卫 = §33c wuzhao 随机档不入缓存补丁;
#   · moira 稳定键(horosa_moira_stable_key_v1):chartObj.chartId 每盘随机 → 旧键同参永不命中;
#   · bootChartRestore(horosa_boot_chart_restore_v1,owner 拍板默认开):温启按上次快照重放
#     fetchByChartData —— L3 命中时后端未就绪也能先画(「秒开上次工作现场」)。
mkdir -p "$WS/astrostudyui/src/services/__tests__"
cp "$OV/files/astrostudyui/src/utils/bootChartRestore.js"                     "$WS/astrostudyui/src/utils/bootChartRestore.js"                     && ok "bootChartRestore.js"
cp "$OV/files/astrostudyui/src/utils/__tests__/bootChartRestore.test.js"      "$WS/astrostudyui/src/utils/__tests__/bootChartRestore.test.js"      && ok "bootChartRestore.test.js"
cp "$OV/files/astrostudyui/src/services/__tests__/perfR10CacheUnify.test.js"  "$WS/astrostudyui/src/services/__tests__/perfR10CacheUnify.test.js"  && ok "perfR10CacheUnify.test.js"
# ---- 33c v3.5.1 收敛:上游 kentangCache 的 Windows-ahead 守卫 + 金标 ----
# wuzhao 自动揲筮(无 seed、服务端 random.randint)不得入缓存 —— 上游矩阵误标 deterministic,
# fetch 级缓存会把随机揲筮钉死(同 body 重卦返回冻结旧卦)。守卫落在唯一缓存层 payloadCacheable。
apply_patch horosa_wuzhao_random_guard_v1        astrostudyui/src/utils/kentangCache.js                           src__utils__kentangCache.wuzhaoGuard.js.patch
# chartFree 契约哨兵的 CRLF 免疫(可上游化):JS `.` 不匹配 \r,CRLF 工作树上剥注释正则整段
# 失配 ⇒ 哨兵被自己的说明注释触发假红(autocrlf checkout 实测)。LF 上行为逐字节不变。
# (v3.5.1:chartFree 哨兵的 CRLF 免疫已并入 §25b 的 chartFreeContract.pathsep 累积补丁
#  —— 同文件单补丁单哨兵键纪律 #29/#48;marker horosa_chartfree_strip_crlf_v1 同键承载。)
cp "$OV/files/astrostudyui/src/utils/__tests__/kentangCacheWuzhaoGuard.test.js" "$WS/astrostudyui/src/utils/__tests__/kentangCacheWuzhaoGuard.test.js" && ok "kentangCacheWuzhaoGuard.test.js"
# 选项 Hamming-1 投机(horosa_option_prefetch_v1):首铺二值轴(零域风险);多值轴(hsys/
# ayanamsa/学派等)值域在各表单组件,待接入时由组件登记 —— 绝不在 util 里臆造值域。
cp "$OV/files/astrostudyui/src/utils/optionPrefetch.js"                       "$WS/astrostudyui/src/utils/optionPrefetch.js"                       && ok "optionPrefetch.js"
cp "$OV/files/astrostudyui/src/utils/__tests__/optionPrefetch.test.js"        "$WS/astrostudyui/src/utils/__tests__/optionPrefetch.test.js"        && ok "optionPrefetch.test.js"
apply_patch horosa_boot_chart_restore_v1         astrostudyui/src/models/app.js                                   src__models__app.bootChartRestore.js.patch
apply_patch horosa_moira_stable_key_v1           astrostudyui/src/services/qizheng.js                             src__services__qizheng.moiraStableKey.js.patch
apply_patch horosa_moira_stable_key_v1           astrostudyui/src/services/_requestCache.js                       src__services___requestCache.cfgKey.js.patch

echo "== 34. PERF-R10 Ship3 后端 Python 五连(奇门请求级 memo / kin 常量全族 / display translate / 高纬度限界 / fastjson)=="
# 全部五项:黄金全矩阵 3823 例 ZERO DRIFT + 五开关合并置 0 复跑同样 ZERO DRIFT;
# B1 另有 soak_qimen.py 8 线程×1600 请求并发浸泡零漂移(tracked,golden/ 下常备金丝雀)。
# 实测:全矩阵墙钟 252.7s→96.4s(-62%);north-hi 整盘 8417ms→185ms(45×,响应字节不变)。
# ★ 累积补丁 guard 一律取文件内最新 marker(gotcha #48);kinqimen 两件/kinastro_common/
#   perchart/webchartsrv 为既有补丁就地更新,不另开行。
apply_patch horosa_qimen_req_memo_v1             astropy/websrv/webqimensrv.py                                    astropy__webqimensrv.reqMemo.py.patch
apply_patch horosa_fast_json_encode_v1           astropy/websrv/webpredictsrv.py                                  astropy__webpredictsrv.fastJson.py.patch
# —— kin 常量 copy-return 全族(HOROSA_KIN_JIAZI_CONST 一把闸)——
apply_patch horosa_kin_jiazi_const_v1            vendor/kintaiyi/src/kintaiyi/jieqi.py                            vendor__kintaiyi__jieqi.kinConst.py.patch
apply_patch horosa_kin_jiazi_const_v1            vendor/kintaiyi/src/kintaiyi/config.py                           vendor__kintaiyi__config.kinConst.py.patch
apply_patch horosa_kin_jiazi_const_v1            vendor/kintaiyi/src/kintaiyi/kinliuren.py                        vendor__kintaiyi__kinliuren.kinConst.py.patch
apply_patch horosa_kin_jiazi_const_v1            vendor/kinwuzhao/jieqi.py                                        vendor__kinwuzhao__jieqi.kinConst.py.patch
apply_patch horosa_kin_jiazi_const_v1            vendor/kinwuzhao/config.py                                       vendor__kinwuzhao__config.kinConst.py.patch
apply_patch horosa_kin_jiazi_const_v1            vendor/shenyishu/shenyishu.py                                    vendor__shenyishu__shenyishu.kinConst.py.patch
apply_patch horosa_kin_jiazi_const_v1            vendor/kinjinkou/kinjinkou/jinkoujue/jinkoujue_api.py            vendor__kinjinkou__jinkoujue_api.kinConst.py.patch
apply_patch horosa_kin_jiazi_const_v1            vendor/kinastro/astro/fendjing/fendjing_calculator.py            vendor__kinastro__fendjing_calculator.kinConst.py.patch
# translate 等价金标(astropy/tests 是 Mac 基线树,新测试文件走全量拷贝层)
mkdir -p "$WS/astropy/tests"
cp "$OV/files/astropy/tests/test_kentang_display_fast.py" "$WS/astropy/tests/test_kentang_display_fast.py" && ok "test_kentang_display_fast.py"

echo "== 35. PERF-R10 Ship4 后端 Java 双项(comm 缓存 -D 豁免 / chart 家族内层缓存跳过+撞键根治;REQUIRES a jar rebuild)=="
# 响应字节不变(三臂 A/B:LIVE 旧 jar vs 新 jar+旗标 vs 新 jar 无旗标,四端点冷/温逐字节等);
# 未动模块零回归铁证:boundless/basecomm nested jar sha == LIVE。启动器新增两条 -D:
#   -Dcachehelper.needcache=false / -Dastrohelper.skip.inner.cached.paths=true(service-manager.js)。
apply_patch cachehelper.needcache                astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/helper/CacheHelper.java   astrostudy__CacheHelper.needcacheSysprop.java.patch
apply_patch astrohelper.skip.inner.cached.paths  astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/helper/AstroHelper.java   astrostudy__AstroHelper.skipInnerCache.java.patch

echo "== 36. PERF-R11 StartupGate 桌面壳温启用时行(Electron-only;Mac/网页死分支零影响)=="
# horosa_startupgate_desktop_elapsed_v1:温启窗口(工作区可见→后端就绪 ~0.6s→4s)此前无数字反馈
# (组件 6s 阈值温启到不了)。桌面壳 getBootstrapConfig(startupUx/runtimeStartedAtMs/expectedTotalMs)
# → 卡片 t=0 起「已用时 x.x 秒 ・ 以往约 y.y 秒」,锚到壳层起点覆盖 pre-nav 段。
# kill:HOROSA_LOADING_UX=0(壳侧置 startupUx:false,行自动退场)。
# 上游化建议:组件分支可原样上 Mac(无 window.horosaDesktop = 死分支,渲染逐字节不变)。
apply_patch horosa_startupgate_desktop_elapsed_v1  astrostudyui/src/components/common/StartupGate.js  astrostudyui__StartupGate.desktopElapsed.js.patch
mkdir -p "$WS/astrostudyui/src/components/common/__tests__"
cp "$OV/files/astrostudyui/src/components/common/__tests__/startupGateDesktopElapsed.test.js" "$WS/astrostudyui/src/components/common/__tests__/startupGateDesktopElapsed.test.js" && ok "startupGateDesktopElapsed.test.js"

echo "== done. Verify: npm run selfcheck (windows-ahead / perf sentinels must all pass). =="
