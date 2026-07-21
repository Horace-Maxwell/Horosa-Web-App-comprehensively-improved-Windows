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
# PERF-R7 起该 patch 为「Mac 基线→Windows 现状」的累积全量(ensureField 守卫 + P1-5 切页
# User-Timing 打点 + T-3 idle 预载 1s 起跑);守卫 marker 用最新的 refresh-start。
apply_patch scheduleDataWarmGroup  astrostudyui/src/pages/index.js                 src__pages__index.js.patch

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
apply_patch techniqueResultCacheEnabled    astrostudyui/src/components/ziwei/ZiWeiMain.js               src__components__ziwei__ZiWeiMain.js.patch
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
apply_patch PARAMHASH_PERSISTABLE_REV      astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/helper/ParamHashCacheHelper.java astrostudy__ParamHashCacheHelper.persistable.java.patch
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
apply_patch xuanshi_summary_warmup_v1      astropy/websrv/webchartsrv.py                 astropy__webchartsrv.xuanshiWarmup.py.patch

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
apply_patch _getFixedStars67Cached         astropy/astrostudy/perchart.py                astropy__perchart.chartMemo.py.patch
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
apply_patch markChartRefreshEnd            astrostudyui/src/models/astro.js                             src__models__astro.precomputeFetch.js.patch
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
apply_patch scheduleDataWarmGroup          astrostudyui/src/utils/idleWarmQueue.js       src__utils__idleWarmQueue.dataWarmGroup.js.patch
apply_patch scheduleDataWarmGroup          "astrostudyui/src/utils/__tests__/idleWarmQueue.test.js" src__utils__tests__idleWarmQueue.test.dataWarmGroup.js.patch
apply_patch buildIndiaWarmParams           astrostudyui/src/components/astro/IndiaChart.js src__components__astro__IndiaChart.warmParams.js.patch
apply_patch warmGuolaoNatal                astrostudyui/src/components/guolao/GuoLaoChartMain.js src__components__guolao__GuoLaoChartMain.warmNatal.js.patch
apply_patch warmPrimaryDirection           astrostudyui/src/components/direction/AstroDirectMain.js src__components__direction__AstroDirectMain.warmPd.js.patch
apply_patch warmGermanyMidpoint            astrostudyui/src/components/germany/AstroMidpoint.js src__components__germany__AstroMidpoint.warmMidpoint.js.patch
apply_patch prefetchJieqiYearNeighbors     astrostudyui/src/utils/preciseCalcBridge.js   src__utils__preciseCalcBridge.neighborPrefetch.js.patch
apply_patch prefetchJieqiYearNeighbors     astrostudyui/src/components/jieqi/JieQiChartsMain.js src__components__jieqi__JieQiChartsMain.neighborPrefetch.js.patch

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

echo "== done. Verify: npm run selfcheck (windows-ahead / perf sentinels must all pass). =="
