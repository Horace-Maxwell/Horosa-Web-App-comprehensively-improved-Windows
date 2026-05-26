# Horosa Windows 2.1.5 Beta 项目结构说明

当前目录结构对应 Horosa v2.1.5 Beta Windows Web / Desktop 统一交付形态。这个版本已经把 Mac 2.1.0 beta 的 UI、前端、Python 后端、Java 后端、资源、AI 导出、传统命法/卜法后端与桌面交付修复同步到 Windows 本地工程；旧的 `Horosa-Web-App-comprehensively-improved-MacOS-main` 同步来源文件夹不再是运行或构建依赖。

## 普通用户入口

- `START_HERE.bat`：仓库根目录的一键 Web 启动入口，适合解压式本地运行和维护自检。
- `desktop_installer_bundle/release/Horosa-Setup-2.1.5.exe`：正式 Windows 安装包入口，适合 GitHub Release 发布。
- `README.md` / `README_ZH.md` / `README_EN.md`：v2.1.5 Beta 用户说明、截图、功能介绍和下载入口。
- `docs/给完全不会的人看的启动说明.txt`：完全不会命令行的用户说明。

## 根目录主要内容

- `README.md`：双语入口页，展示新版 icon、截图、v2.1.5 Beta 功能介绍和下载入口。
- `README_ZH.md` / `README_EN.md`：中文、英文完整说明。
- `CITATION.cff`：软件引用元数据，版本号跟随当前发布版本。
- `SECURITY.md` / `SUPPORT.md` / `CONTRIBUTING.md`：英文治理文档。
- `SECURITY_ZH.md` / `SUPPORT_ZH.md` / `CONTRIBUTING_ZH.md`：中文治理文档。
- `docs/`：项目结构、发布说明、自检记录、截图资源和面向用户的补充说明。
- `local/`：实际 Horosa Web 工作区、Windows 启动链路、Python/Java/Node 运行时与本地构建产物。
- `desktop_installer_bundle/`：Electron 桌面应用和 NSIS 安装器工程。
- `prepareruntime/`：维护人整理运行时和交付包时使用的脚本。`Prepare_Runtime_Windows.ps1` 默认下载固定版本的 python-build-standalone 作为内置 Python（消除“构建机装了什么 Python”的漂移，失败回退系统 Python，可用 `HOROSA_PYTHON_RUNTIME_SOURCE=system` 覆盖）；`prepareruntime/vendor/vc_runtime/x64/` 收录随包分发的 Microsoft VC++ 运行时 DLL（保证干净 Windows 上编译型 Python 扩展可加载）。详见 `docs/CLEAN_MACHINE_NATIVE_RUNTIME_FIX.md`。
- `log/`：启动失败和维护排查相关说明。

## docs/

- `docs/assets/screenshots/horosa-2.0-main-workspace.png`：主命盘工作区截图。
- `docs/assets/screenshots/horosa-2.0-module-navigator.png`：功能模块导航截图。
- `docs/assets/screenshots/horosa-2.0-sanshi-workspace.png`：三式工作区截图。
- `docs/releases/2.1.5.md`：当前 Beta 版本发布说明与发布资产清单（AI 分析页全面修复：供应商切换/鉴权 + 发送安全 + 静默失败透出）。
- `docs/releases/2.1.4.md`：上一版 Beta 发布说明（AI 供应商兼容 + 错误透传 + 凭据脱敏），保留作历史记录。
- `docs/releases/2.1.3.md`：更早的 Beta 发布说明（八字时间显示修复），保留作历史记录。
- `docs/releases/2.1.2.md`：更早的 Beta 发布说明（AI 分析同步），保留作历史记录。
- `docs/releases/2.1.1.md`：更早的 Beta 发布说明，保留作历史记录。
- `docs/releases/2.0.1.md`：更早的 Beta 发布说明，保留作历史记录。
- `docs/SELFCHECK_LOG.md`：本地自检记录。
- `docs/CLEAN_MACHINE_NATIVE_RUNTIME_FIX.md`：干净 Windows“开箱即用”修复技术文档（缺失 `msvcp140.dll` 根因、构建期自检、服务编排与启动页/图标改动、发布流程与坑位）。
- `docs/PROJECT_STRUCTURE.md`：当前文件。

## local/

普通用户不要手动修改 `local/`。这里是 Windows Web 实际运行和构建的主体：

- `local/Horosa_Local_Windows.ps1`：Windows 本地 Web 一键启动主脚本。
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/`：当前实际使用的 Horosa 工作区。
- `local/workspace/runtime/windows/`：Windows 运行时、缓存和启动优化相关内容。
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/`：v2.1.5 Beta 前端工程与构建产物。
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astropy/`：Python 星历、`/astroextra`、`/planetarium`、kentang/kin 后端、印度占星扩展与星表资源。
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudysrv/`：Java 服务，包含 `/astroextra/*`、`/planetarium/state`、`/qizheng/moira`、AI Analysis 服务接线与传统术数相关接口。
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/vendor/`：太乙、金口诀、皇极经世、五兆、太玄、荆诀、神易数、Kin Astro 等第三方/参考引擎资源。

## astrostudyui 重点

- `src/`：XQ UI 外壳、导航、模块选择器、主题、AI 分析、AI 导出设置、天文馆、辅盘、印度盘扩展、七政 Moira、Kin Astro、三式、八字、紫微、风水等前端源码。
- `public/`：前端静态资源，包含天文馆、风水和其他静态资产。
- `dist/`：普通 Web 构建产物。
- `dist-file/`：file 模式构建产物，用于桌面打包。
- `scripts/umi-runner.js` 与 `scripts/loadCryptoDeps.js`：Windows 下保留的构建运行适配。
- `scripts/warmHorosaRuntime.js`：一键 Web / 桌面启动后的运行时预热路径。

## desktop_installer_bundle/

正式桌面应用工程在这里：

- `package.json` / `package-lock.json`：桌面打包工程版本与依赖，当前发布版本为 `2.1.5`。
- `electron/`：Electron 主进程、预加载脚本、加载/错误页（`loading.html`，含启动分步进度、失败态日志结尾透出与“复制诊断信息”）、窗口管理、Python/Java/Web 服务编排（`service-manager.js`，含崩溃归因与 trusted fast-path）、运行时健康检查与日志。
- `scripts/`：renderer 构建、运行时 staging（`stage-runtime.cjs`，会注入 VC++ 运行时并跑原生依赖自检）、`check_runtime_native_deps.py`（构建期 DLL 完整性闸门）、`generate_brand_assets.py`（从 logo 生成图标/安装器位图）、`release_preflight.py`（发布前版本/品牌资产/运行时一致性闸门，对应 `npm run verify`）、项目路径解析、安装器回归、安装后桌面 smoke、干净机器冷/热启动检查和 kentang 端点验证。
- `assets/`：安装器图标与 NSIS 定制资源。唯一品牌源是 `horosa_setup_badge.png`（最新 logo）；`horosa_setup.ico`、`installerHeader.bmp`、`installerSidebar.bmp`、`uninstallerSidebar.bmp` 全部由 `scripts/generate_brand_assets.py` 从它派生，换 logo 后必须重跑该脚本。`installer.nsh` 为 NSIS 定制脚本（含安装目录校验、旧快捷方式清理）。
- `release/`：本地构建输出目录。v2.1.5 Beta 标准发布资产为：
  - `Horosa-Setup-2.1.5.exe`
  - `Horosa-Setup-2.1.5.exe.blockmap`
  - `latest.yml`
  - `SHA256SUMS.txt`

## 2.1.1 Beta 新功能面

- 新增并规范接入太乙、金口诀、皇极经世、五兆、太玄、荆诀、神易数、Kin Astro、七政四余、奇门等命法与卜法后端。
- 三式合一中奇门与太乙固定走 kentang 后端口径，六壬保留现有本地六壬实现。
- 奇门和三式合一页面移除后端不支持的月家奇门选项，不再静默回退到旧本地算法。
- 管理命盘与管理事盘保留新技法输入、标签、快照、后端原始结构化数据、JSON 导入导出与重开恢复行为。
- AI 导出改为读取结构化后端数据，并为支持的技法、tab 与页面提供可勾选导出分段。
- 用户设置、桌面窗口大小与必要 UI 选项会在关闭、重开和版本更新后继续沿用。
- 桌面启动控制台统一使用新版星阙 icon；启动页重做为满铺品牌 + 五步进度条（准备运行时 → Python → Java → 验证 → 就绪），失败态高亮出错步骤并直接展示崩溃服务日志结尾，提供“重试 / 自检修复 / 打开日志 / 复制诊断”。
- 紫微四化盘隐藏星体亮度，紫微三合盘和策天飞星仍按需要显示亮度。
- 新星阙八字 UI 的细盘上方内容区可滚动，大运/流年选择区保持固定。

## 运行时与缓存

安装版会使用随包运行时和本地缓存，目标是让新 Windows 机器无需额外安装依赖即可使用。随包内置 Python 依赖若干编译扩展（`swisseph`、`_sxtwl` 以及当前 requirements 中的其它原生模块）会依赖 `msvcp140.dll` 等 VC++ 运行时——这些 DLL 由构建流程放到 `python.exe` 同级，且有构建期自检闸门兜底，确保干净机器无需安装 VC++ Redistributable 即可启动（详见 `docs/CLEAN_MACHINE_NATIVE_RUNTIME_FIX.md`）。安装器支持选择安装目录，会检查目录可创建、可写，并在权限受限时交给 Windows 提权流程处理。首次启动可能较慢；后续启动会复用缓存。

常见本地位置：

- `%LocalAppData%\Programs\Horosa`
- `%LocalAppData%\HorosaDesktop\logs`
- `%TEMP%\HorosaRt\...` 或隔离测试中的临时 runtime cache

这些目录不在仓库里，但与安装版启动速度和稳定性相关。

## 维护人记忆点

- Mac 同步来源文件夹只作为迁移参考，v2.1.5 Beta 发布工程自身不应依赖它。
- GitHub Release 正式用户入口是 `Horosa-Setup-2.1.5.exe`。
- `latest.yml`、`.blockmap` 与 `SHA256SUMS.txt` 是更新和校验支持资产，不是普通用户的主入口。
- 发布前至少检查 README icon、版本号、下载链接、安装器资产、校验和、`latest.yml` 版本、Windows 一键启动路径、安装后 smoke、干净机器冷/热启动和 Mac-only 文件残留。
- 应用显示名为“星阙”：`build.productName` 与 `nsis.shortcutName` 均为 `星阙`（决定桌面/开始菜单快捷方式、Add/Remove Programs 显示名、窗口标题）；可执行文件刻意保留 `Horosa.exe`（ASCII，规避中文路径风险；`scripts/patch-win-exe-icon.cjs` 也按此名修补图标）。改名时需同步 `installer.nsh` 里的 `CURRENT/LEGACY_*_SHORTCUT_FILE_NAME`（用于卸载/升级时清理旧快捷方式）。
- 改 logo、加 Python 依赖、动启动/编排逻辑时，参照 `docs/CLEAN_MACHINE_NATIVE_RUNTIME_FIX.md` 的“以后怎么做 / 注意点”；构建期 `stage-runtime.cjs` 会自动跑 `check_runtime_native_deps.py`，缺失非系统 DLL 会直接让构建失败。
- 发布闸门：`npm run verify`（= 单测 + `release_preflight.py`，校验版本一致、品牌资产未过期、VC++ 运行时齐全），且已接进 `dist:win` 开头，preflight 不过整个打包会提前中止。换 logo 后先 `npm run build:assets` 再发布。
