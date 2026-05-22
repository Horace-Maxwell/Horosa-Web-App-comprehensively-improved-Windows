# Horosa Windows 2.0.0 Beta 项目结构说明

当前目录结构对应 Horosa v2.0.0 Beta Windows Web / Desktop 统一交付形态。这个版本已经把新版 Mac Web 的 UI、前端、Python 后端、Java 后端、资源与功能面同步到 Windows 本地工程；旧的 `Horosa-Web-App-comprehensively-improved-MacOS-main` 同步来源文件夹不再是运行或构建依赖。

## 普通用户入口

- `START_HERE.bat`：仓库根目录的一键 Web 启动入口，适合解压式本地运行和维护自检。
- `desktop_installer_bundle/release/Horosa-Setup-2.0.0.exe`：正式 Windows 安装包入口，适合 GitHub Release 发布。
- `README.md` / `README_ZH.md` / `README_EN.md`：v2.0.0 Beta 用户说明、截图、功能介绍和下载入口。
- `docs/给完全不会的人看的启动说明.txt`：完全不会命令行的用户说明。

## 根目录主要内容

- `README.md`：双语入口页，展示 v2.0.0 Beta 三张新版截图和跨平台统一说明。
- `README_ZH.md` / `README_EN.md`：中文、英文完整说明。
- `CITATION.cff`：软件引用元数据，版本号跟随当前发布版本。
- `SECURITY.md` / `SUPPORT.md` / `CONTRIBUTING.md`：英文治理文档。
- `SECURITY_ZH.md` / `SUPPORT_ZH.md` / `CONTRIBUTING_ZH.md`：中文治理文档。
- `docs/`：项目结构、发布说明、自检记录、截图资源和面向用户的补充说明。
- `local/`：实际 Horosa Web 工作区、Windows 启动链路、Python/Java/Node 运行时与本地构建产物。
- `desktop_installer_bundle/`：Electron 桌面应用和 NSIS 安装器工程。
- `prepareruntime/`：维护人整理运行时和交付包时使用的脚本。
- `log/`：启动失败和维护排查相关说明。

## docs/

- `docs/assets/screenshots/horosa-2.0-main-workspace.png`：v2.0.0 主命盘工作区截图。
- `docs/assets/screenshots/horosa-2.0-module-navigator.png`：v2.0.0 功能模块导航截图。
- `docs/assets/screenshots/horosa-2.0-sanshi-workspace.png`：v2.0.0 三式工作区截图。
- `docs/releases/2.0.0.md`：当前 Beta 版本发布说明与发布资产清单。
- `docs/SELFCHECK_LOG.md`：本地自检记录。
- `docs/PROJECT_STRUCTURE.md`：当前文件。

## local/

普通用户不要手动修改 `local/`。这里是 Windows Web 实际运行和构建的主体：

- `local/Horosa_Local_Windows.ps1`：Windows 本地 Web 一键启动主脚本。
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/`：当前实际使用的 Horosa 工作区。
- `local/workspace/runtime/windows/`：Windows 运行时、缓存和启动优化相关内容。
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/`：v2.0.0 Beta 前端工程与构建产物。
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astropy/`：Python 星历、`/astroextra`、`/planetarium`、印度占星扩展与星表资源。
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudysrv/`：Java 服务，包含 `/astroextra/*`、`/planetarium/state`、`/qizheng/moira` 和 AI Analysis 服务接线。

## astrostudyui 重点

- `src/`：新版 XQ UI 外壳、导航、模块选择器、主题、AI 分析、AI 导出设置、天文馆、辅盘、印度盘扩展、七政 Moira、三式等前端源码。
- `public/`：前端静态资源。
- `dist/`：普通 Web 构建产物。
- `dist-file/`：file 模式构建产物，用于桌面打包。
- `scripts/umi-runner.js` 与 `scripts/loadCryptoDeps.js`：Windows 下保留的构建运行适配。

## desktop_installer_bundle/

正式桌面应用工程在这里：

- `package.json` / `package-lock.json`：桌面打包工程版本与依赖，当前发布版本为 `2.0.0`。
- `electron/`：Electron 主进程、预加载脚本和 Python/Java/Web 服务编排。
- `scripts/`：renderer 构建、运行时 staging、项目路径解析和打包辅助脚本。
- `assets/`：安装器图标与 NSIS 定制资源。
- `release/`：本地构建输出目录。v2.0.0 Beta 标准发布资产为：
  - `Horosa-Setup-2.0.0.exe`
  - `Horosa-Setup-2.0.0.exe.blockmap`
  - `latest.yml`
  - `SHA256SUMS.txt`

## 运行时与缓存

安装版会使用随包运行时和本地缓存，目标是让新 Windows 机器无需额外安装依赖即可使用。安装器支持选择安装目录，会检查目录可创建、可写，并在权限受限时交给 Windows 提权流程处理。首次启动可能较慢；后续启动会复用缓存。

常见本地缓存位置：

- `%LocalAppData%\Horosa\runtime-cache\...`
- `%LocalAppData%\Programs\Horosa`

这些目录不在仓库里，但与安装版启动速度和稳定性相关。

## 维护人记忆点

- Mac 同步来源文件夹只曾作为迁移参考，v2.0.0 Beta 发布工程自身不应依赖它。
- GitHub Release 正式用户入口是 `Horosa-Setup-2.0.0.exe`。
- `latest.yml`、`.blockmap` 与 `SHA256SUMS.txt` 是更新和校验支持资产，不是普通用户的主入口。
- 发布前至少检查 README 三张截图、版本号、安装器资产、校验和、`latest.yml` 版本与 Windows 一键启动路径。
