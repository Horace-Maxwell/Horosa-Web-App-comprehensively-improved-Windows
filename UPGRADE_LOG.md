# Horosa Upgrade Log

This file tracks every code/config change made in this workspace.
Append new entries; do not rewrite history.

## Entry Format
- Date: YYYY-MM-DD
- Scope: what was changed
- Files: key files touched
- Details: short bullets
- Verification: tests/build/manual checks

---

## 2026-02-21

### 10:20 - 全站星盘“显示后天宫位”接入（含 AI 导出与多技法同步）
- Scope: add postnatal house/rulership metadata display options to all chart-related pages and keep AI export behavior in sync.
- Files:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/utils/planetMetaDisplay.js` (new)
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroObjectLabel.js` (new)
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/models/app.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/ChartDisplaySelector.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/pages/index.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/homepage/PageHeader.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroAspect.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroInfo.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroPlanet.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroLots.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroPredictPlanetSign.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroFirdaria.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroProfection.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroSolarArc.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroSolarReturn.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroLunarReturn.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroGivenYear.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroZR.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/relative/AspectInfo.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/relative/MidpointInfo.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/relative/AntisciaInfo.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroDoubleChartMain.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroRelative.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/jieqi/JieQiChartsMain.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/direction/AstroDirectMain.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/utils/astroAiSnapshot.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/utils/predictiveAiSnapshot.js`
  - `AGENT_CHANGELOG.md`
  - `UPGRADE_LOG.md`
- Details:
  - Added global chart-component options: `showPostnatal`, `showHouse`, `showRuler`.
  - Planet labels can append metadata with compact format `X (1th; 2R6R)`.
  - Metadata source is bound to the currently displayed left chart (`house`, `ruleHouses`) and propagated across chart/predictive/relative/jieqi/sanshi/direction pages.
  - Added matching AI export options to control house/ruler suffix output by technique.
  - Added symbol/metadata split rendering to avoid symbol-font corruption on macOS when suffix text is appended.
- Verification:
  - `npm install --legacy-peer-deps` in `astrostudyui` (pass)
  - `npm run build` in `astrostudyui` (pass)

## 2026-02-20

### 14:38 - Windows 一键部署补强：Java 检测/回退改为可构建后端的 JDK 路径
- Scope: fix one-click startup failure on some Windows machines when backend jar is missing and launcher incorrectly treats Java detection as failed.
- Files:
  - `Horosa_Local_Windows.ps1`
  - `README.md`
  - `UPGRADE_LOG.md`
- Details:
  - `Test-JavaAtLeast17` 修复为兼容 `java -version` 输出到 stderr 的场景，避免在 `ErrorActionPreference=Stop` 下误判“无 Java”。
  - `Resolve-Java` 新增 `-RequireJdk` 检测模式，构建后端时要求存在 `javac.exe`。
  - `Install-Java17Portable` 下载地址从 JRE 切换为 Temurin JDK（`.../windows/x64/jdk/hotspot/...`）。
  - `Try-BuildBackendJar` 改为优先获取可编译 JDK；若检测失败但便携 JDK 文件齐全，仍可直接使用 `runtime/windows/java/bin/java.exe` 进入 Maven 构建链路。
  - `Install-Java17` 在 `-RequireJdk` 下仅尝试 JDK 候选，并在便携 JDK 文件就绪时直接返回成功。
  - README 补充“便携 JDK（含 javac）”说明并修正章节编号。
- Verification:
  - `powershell -NoProfile -Command "$null=[ScriptBlock]::Create((Get-Content Horosa_Local_Windows.ps1 -Raw)); 'parse ok'"` (pass)
  - `HOROSA_NO_BROWSER=1 HOROSA_SMOKE_TEST=1 powershell -ExecutionPolicy Bypass -File .\\Horosa_Local_Windows.ps1` (pass; backend/web/python 启动并自动停止)

### 14:40 - 六壬“仅点击起课才计算”修复生效 + 前端产物选择防回退
- Scope: make 大六壬 truly manual-triggered and fix stale frontend bundle selection on Windows launcher/runtime packaging.
- Files:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/package.json`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/scripts/umi-runner.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/dist-file/*` (rebuilt)
  - `runtime/windows/bundle/dist-file/*` (synced)
  - `Horosa_Local_Windows.ps1`
  - `Prepare_Runtime_Windows.ps1`
  - `README.md`
- Details:
  - 六壬页关闭自动起课链路：移除 mount/hook/出生时间变化的自动请求，新增显式“起课”按钮触发计算。
  - 六壬左盘改为使用“点击起课时锁定的 chart 快照”，避免调整时间组件时左盘自动变化。
  - 重新生成 `astrostudyui/dist-file`，确保启动器实际读取到最新前端代码（而非仅更新 `src`）。
  - 同步更新 `runtime/windows/bundle/dist-file`，避免打包运行时继续使用旧前端包。
  - `astrostudyui/package.json` 的 `start/build/build:file` 改为调用 `scripts/umi-runner.js`，解决 Windows 下 `export ...` 脚本不生效问题。
  - `Horosa_Local_Windows.ps1` 新增前端目录选择策略：若 `dist` 比 `dist-file` 更新，则自动优先 `dist`。
  - `Horosa_Local_Windows.ps1` 启动时输出当前实际前端目录（`[INFO] Frontend static dir: ...`），便于现场排查。
  - `Prepare_Runtime_Windows.ps1` 新增前端源选择策略：打包时自动选最新前端产物，并统一写入 `bundle/dist-file`（同时镜像到 `bundle/dist`）。
  - README 增补“旧前端缓存/旧包”排查与 Windows 下 `dist-file` 重建命令。
- Verification:
  - `npx umi build` in `astrostudyui` (pass)
  - `$env:BUILD_FOR_FILE='1'; $env:NODE_OPTIONS='--openssl-legacy-provider'; npx umi build` in `astrostudyui` (pass)
  - `npx umi-test src/components/liureng/__tests__/ChuangChart19940201.test.js --runInBand` (pass)
  - `Test-Path runtime\\windows\\bundle\\dist-file\\index.html` (pass)

### 14:22 - Windows 一键安装兼容性修复（目录自动识别 + Python 3.11 优先）
- Scope: fix Windows one-click startup failures caused by hardcoded project folder names and improve Python dependency stability for offline machines.
- Files:
  - `Horosa_Local_Windows.ps1`
  - `Prepare_Runtime_Windows.ps1`
  - `README.md`
  - `UPGRADE_LOG.md`
- Details:
  - 在 `Horosa_Local_Windows.ps1` 和 `Prepare_Runtime_Windows.ps1` 中新增工程目录自动发现逻辑，支持 `Horosa-Web`、`Horosa-Web-<hash>`，以及任意包含 `astrostudyui + astrostudysrv + astropy` 的目录。
  - 支持环境变量 `HOROSA_PROJECT_DIR` 手动覆盖工程目录解析，避免不同打包结构导致的启动失败。
  - `Horosa_Local_Windows.ps1` 的 Python 解析改为“优先 3.11、其次 3.12”，并在依赖安装失败时自动尝试安装/切换到 Python 3.11，再继续依赖补齐流程。
  - `Prepare_Runtime_Windows.ps1` 的 Python 运行时拷贝顺序改为优先 3.11，并在选择非 3.11 时输出明确警告，提示离线分发建议使用 3.11 打包。
  - `README.md` 同步更新为“工程目录名自动识别”与“Python 3.11 离线兼容优先”的新说明，移除旧的固定目录名要求。
- Verification:
  - `powershell -NoProfile -Command "$null=[System.Management.Automation.Language.Parser]::ParseFile('Horosa_Local_Windows.ps1',[ref]$null,[ref]$null)"`
  - `powershell -NoProfile -Command "$null=[System.Management.Automation.Language.Parser]::ParseFile('Prepare_Runtime_Windows.ps1',[ref]$null,[ref]$null)"`
  - `rg -n "Resolve-ProjectDir|HOROSA_PROJECT_DIR|Resolve-Python311|Python 3.11" Horosa_Local_Windows.ps1 Prepare_Runtime_Windows.ps1 README.md`

## 2026-02-19

### 11:44 - 三式合一接入 kintaiyi 太乙核心并完成盘面/标签展示
- Scope: integrate `kintaiyi-master` 太乙算法到三式合一，并把核心逻辑沉淀到独立 core 文件夹，同时补全盘面与右侧标签可视化。
- Files:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/sanshi/core/TaiYiCore.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/sanshi/SanShiUnitedMain.less`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/utils/aiExport.js`
- Details:
  - 新增 `sanshi/core/TaiYiCore.js`，封装太乙关键计算（积数、局式、太乙/文昌/始击/定目、主客定算、君臣民基、十精相关宫位等）并输出结构化结果。
  - 在三式合一计算链中接入太乙结果（state 增加 `taiyi`、保存 payload 增加 `taiyi`、快照增加 `太乙` 与 `太乙十六宫` 分区）。
  - 右侧参数区新增太乙盘式/积年法选项；右侧信息面板新增“太乙”标签页，完整展示核心结果与十六宫标记。
  - 盘面外圈新增“太乙”宫位标注文本（按地支宫显示），并补充样式类 `outerTaiyi`。
  - AI 导出预设章节补充 `太乙` 与 `太乙十六宫`，保证导出内容与界面一致。
- Verification:
  - `npm run build --silent`

### 11:15 - 404 fallback + local route recovery
- Scope: prevent app from getting stuck on the 404 page in local file mode.
- Files:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/pages/404.js`
- Details:
  - Added auto-redirect logic for `file://` + hash routes.
  - If route is invalid, fallback to `index.html#/` and then `/`.
  - Updated 404 text to show automatic recovery status.
- Verification:
  - `npm test -- --runInBand`
  - `npm run build:file`

### 11:12 - 三式合一中心四课/三传布局调整为 85%
- Scope: reduce overlap in center area under zoom/resize.
- Files:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - Changed center text target occupancy from 95% to 85%.
  - Keeps same-row scaling behavior, but adds more vertical breathing room.
- Verification:
  - `npm test -- --runInBand`

### 11:10 - 三式合一导出格式优化（神煞置底 + 星盘全名）
- Scope: adjust export text order and remove star abbreviations in export output.
- Files:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - Moved `【神煞】` section to the end of exported content.
  - Added full-name star output for export (with degree + minutes + `R` for retrograde).
  - Kept UI short labels unchanged; export uses full labels.
- Verification:
  - `npm test -- --runInBand`
  - `npm run build`

### 11:04 - 三式合一/遁甲起盘性能链路去重与静默化
- Scope: reduce repeated recomputation and improve click-to-plot responsiveness.
- Files:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/dunjia/DunJiaMain.js`
- Details:
  - Added field-only sync path to avoid expensive fetch on every confirm.
  - Added `nohook` support for silent fetch to prevent duplicate refresh chains.
  - Reused pending same-key refresh/request promises to avoid duplicated requests.
  - Click-plot now decides `force` based on key change instead of always forcing.
- Verification:
  - `npm test -- --runInBand`
  - `npm run build`
  - Local API latency spot-check script (nongli/jieqi endpoints)

### 11:50 - 工程目录重命名为 Horosa-Web 并修正启动路径
- Scope: rename project folder from `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c` to `Horosa-Web` and update hardcoded path references to avoid startup/runtime breaks.
- Files:
  - `Horosa_Local.command`
  - `Prepare_Runtime_Mac.command`
  - `Horosa_Local_Windows.ps1`
  - `README.md`
  - `PROJECT_STRUCTURE.md`
- Details:
  - Renamed folder: `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c` -> `Horosa-Web`.
  - Updated Mac launcher `PROJECT_DIR` to `${ROOT}/Horosa-Web`.
  - Updated Windows launcher `ProjectDir` to `Join-Path $Root 'Horosa-Web'`.
  - Updated documentation paths to new folder name for consistency.
  - Kept historical references in old log entries unchanged to preserve audit history.
- Verification:
  - `ls -la "/Users/horacedong/Desktop/Horosa-Web+App (Mac)"`
  - Confirmed `Horosa-Web/` exists and old folder no longer exists.
  - `rg -n "Horosa-Web(-55c75c5b088252fbd718afeffa6d5bcb59254a0c)?" Horosa_Local.command Prepare_Runtime_Mac.command Horosa_Local_Windows.ps1 README.md PROJECT_STRUCTURE.md`

### 11:54 - 移除根目录 kintaiyi-master 并验证太乙可用
- Scope: fully remove root folder `kintaiyi-master` and verify 三式合一太乙核心 does not depend on that folder at runtime/build time.
- Files:
  - `UPGRADE_LOG.md`
- Details:
  - Deleted `/Users/horacedong/Desktop/Horosa-Web+App (Mac)/kintaiyi-master`.
  - Kept integrated Taiyi core in `Horosa-Web/astrostudyui/src/components/sanshi/core/TaiYiCore.js` as the active implementation.
  - Confirmed `SanShiUnitedMain.js` imports Taiyi logic from local `./core/TaiYiCore` only.
- Verification:
  - `ls -la "/Users/horacedong/Desktop/Horosa-Web+App (Mac)"` (confirmed `kintaiyi-master` removed)
  - `npm run build --silent` in `Horosa-Web/astrostudyui` (compiled successfully after deletion)
  - `rg -n "kintaiyi-master|kintaiyi" Horosa-Web/astrostudyui/src Horosa-Web/astrostudysrv Horosa-Web/astropy Horosa_Local.command Prepare_Runtime_Mac.command Horosa_Local_Windows.ps1`

### 12:00 - 太乙核心迁移到太乙模块 + 三式合一左盘移除太乙文案
- Scope: move kintaiyi-based Taiyi core into `易与三式/太乙`模块核心目录 and keep 三式合一中的太乙信息只在右侧标签显示，不再覆盖左侧方盘外圈。
- Files:
  - `Horosa-Web/astrostudyui/src/components/taiyi/core/TaiYiCore.js`
  - `Horosa-Web/astrostudyui/src/components/taiyi/TaiYiCalc.js`
  - `Horosa-Web/astrostudyui/src/components/taiyi/TaiYiMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/core/TaiYiCore.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.less`
  - `UPGRADE_LOG.md`
- Details:
  - 新增 `taiyi/core/TaiYiCore.js` 作为太乙核心算法文件（包含 kintaiyi 口径计算与结构化输出）。
  - `taiyi/TaiYiCalc.js` 改为基于 `taiyi/core/TaiYiCore.js` 的适配层，统一太乙盘计算、快照文本与盘面宫位数据。
  - `sanshi/core/TaiYiCore.js` 改为转发导出，三式合一与太乙模块共享同一套核心算法来源。
  - 三式合一左侧方盘外圈移除“太乙:...”叠加文字，仅保留右侧“太乙”标签页详细信息。
  - 太乙主模块右侧信息面板补充定目、三基、将参、十精相关宫位等核心计算结果展示。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui` (compiled successfully)
  - `rg -n "renderOuterMarks\\(|outerTaiyi|calcTaiyiPanFromKintaiyi" Horosa-Web/astrostudyui/src/components/sanshi Horosa-Web/astrostudyui/src/components/taiyi`

### 12:04 - 三式合一中心盘对齐：四课上对齐、三传下对齐
- Scope: adjust center block layout in 三式合一 square board so 四课 anchors to the top edge and 三传 anchors to the bottom edge.
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.less`
  - `UPGRADE_LOG.md`
- Details:
  - Removed center vertical balancing padding in `renderCenterBlock`; 四课 `top` and 三传 `bottom` now pin to edge padding directly.
  - Kept unified dynamic font/line-height scaling logic unchanged to preserve readability under zoom.
  - Added explicit layout intents in CSS: `.centerKe` uses `justify-content: flex-start`; `.centerChuan` uses `justify-content: flex-end`.
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui` (compiled successfully)

### 12:07 - 太乙页面信息换位：右侧减载，盘面左上/右下承载关键信息
- Scope: reduce info overflow in `易与三式-太乙` right panel by moving the last metadata segment onto the chart, and relocate original top-left chart summary to bottom-right.
- Files:
  - `Horosa-Web/astrostudyui/src/components/taiyi/TaiYiMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - Left chart top-left now shows: `农历 / 真太阳时 / 干支(紧凑格式) / 节气`。
  - Original top-left summary (`积数/命式/局/主客定算/太乙数`) moved to left chart bottom-right.
  - Removed the final right-panel block (`农历/真太阳时/干支/节气段`) to shrink right-side content height and avoid overflow.
  - Tuned chart corner text font/line spacing for readability near ring edges.
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui` (compiled successfully)

### 12:09 - 太乙右侧标签去重：左盘已展示内容不再重复
- Scope: remove duplicate fields from the right info panel when the same values are already rendered on the left Taiyi chart.
- Files:
  - `Horosa-Web/astrostudyui/src/components/taiyi/TaiYiMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - Removed duplicated right-panel items already shown in left chart corners: `命式`、`局式`、`太乙积数`、`主算`、`客算`、`定算`。
  - Kept right-panel items that are not shown in left chart (e.g. 太乙宫位、文昌/始击/太岁/合神/计神、定目、将参与十精类信息)。
  - Preserved panel section divider structure for readability after pruning.
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui` (compiled successfully)

### 12:14 - 太乙盘可读性增强：角标与盘中文字整体放大
- Scope: increase readability of `易与三式-太乙` by enlarging top-left/bottom-right corner metadata and inner chart text.
- Files:
  - `Horosa-Web/astrostudyui/src/components/taiyi/TaiYiMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - Enlarged corner metadata text from `11` to `13`, and increased line spacing from `16` to `18`.
  - Slightly adjusted corner anchors to keep enlarged text within safe margins.
  - Enlarged center and ring text (`五/中宫`、二层数字、三层宫位、四层神名、外层标记) to improve legibility.
  - Increased outer-most label line spacing to avoid overlap after font enlargement.
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui` (compiled successfully)

### 12:16 - 太乙盘字体风格调整：取消加粗 + 角标再次放大
- Scope: remove bold weight in Taiyi chart text and further increase left-top/right-bottom corner metadata size.
- Files:
  - `Horosa-Web/astrostudyui/src/components/taiyi/TaiYiMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - Changed Taiyi chart text `fontWeight` from bold to normal (`700 -> 400`) for center, rings, and corner metadata.
  - Increased corner metadata font size from `13` to `15`.
  - Increased corner metadata line spacing from `18` to `20`, and adjusted anchors to keep text within chart bounds.
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui` (compiled successfully)
