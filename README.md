# 星阙 Horosa Windows 桌面版

这个仓库现在同时服务两类人：

- **普通 Windows 用户**：去 GitHub Release 下载离线安装包
- **开发者 / 维护者**：从 `main` 下载源码、脚本与打包工程，通过根目录 `START_HERE.bat` 一键自举复原并启动

## 普通用户下载哪个

- 最新正式版 Release：
  [https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
- **Windows 10/11 x64 普通用户** 请下载：
  `Horosa-Setup-1.0.9.exe`
- GitHub Release 页面只保留离线安装器，不提供 portable zip、源码快照或 `main` 分支相关产物

## 三步安装

1. 下载 `Horosa-Setup-1.0.9.exe`
2. 双击运行安装器，按中文向导安装
3. 从桌面或开始菜单打开 `Horosa`（应用窗口标题仍显示“星阙”）

补充说明：

- 安装包已经包含 Electron、Java、Python、前后端资源
- 安装完成后可**离线运行本地功能**
- 若要升级，请重新到 GitHub Releases 下载新的 `Horosa-Setup-*.exe`
- 默认安装到 `%LocalAppData%\Programs\Horosa`
- 用户数据保存在 `%LocalAppData%\HorosaDesktop`
- 如果机器上已经装过星阙，安装器会进入维护页，可选 `替换 / 修复 / 取消`

## 这次正式版包含什么

`v1.0.9` 重点包含：

- 真正的 Electron 桌面窗口，不再依赖浏览器 `--app` 壳
- 完整离线安装包，尽量不依赖目标机器预装环境
- GitHub Release 只保留离线安装器，不再上传 portable zip 或源码快照式发布物
- 中文维护页：已安装检测、替换 / 修复 / 取消
- 默认窗口比例、缩放、快捷键、窗口恢复逻辑完善
- 顶栏抽屉、易与三式、组合盘 / 时空中点盘等白屏问题修复
- 全部主 tab 底部越界修复
- 风水 tab 在桌面壳中的本地资源加载修复
- 修复 `v1.0.0` 误发旧安装器的问题，重新打入最新桌面壳、维护页、图标与窗口显示逻辑
- 修复 `Horosa.exe` 仍显示旧默认图标的问题
- 修复开始菜单 / 桌面快捷方式残留旧入口或损坏快捷方式的问题
- 修复安装版应用内更新初始化依赖 `app-update.yml` 导致的报错
- 强化桌面快捷方式重建，并按 Windows Shell 真实桌面目录验收（含 OneDrive 桌面）
- 安装版默认启动改为最大化，并保持默认内容缩放为 `0.8`
- 双击 `Horosa.exe` 或桌面快捷方式后优先立即显示“星阙启动中”原生窗口，再在后台拉起本地服务
- 单实例再次双击时会把现有窗口恢复并拉到最前，而不是静默无反应
- 点击右上角 `X` 后会完整退出 Electron、Java 与 Python 后台进程，不再残留僵尸实例
- 关闭后再次双击 `Horosa.lnk` 会重新冷启动；若遇到旧实例无窗异常，也会触发自救恢复
- 旧实例窗口损坏时会直接重建主窗口，不再在自救过程中误触发退出链
- 修复节气盘各个 `XX星盘` 左上角出现 `undefined` 的显示问题，统一显示黄道与分宫制中文标签
- 修复节气盘切换黄道和分宫制后仍复用旧图的问题，`春分/夏至/秋分/冬至` 星盘与 3D 盘都会按当前设置重算
- 修复关系盘比较盘、组合盘、影响盘、时空中点盘、马克斯盘在正常和偏矮窗口下底部黄道圈被裁切的问题
- 修复推运盘 `法达星限` 在缺少 predictive 数据时整页空白的问题；进入该页会按需静默补取数据，并显示加载态/空态
- 修复 `主/界限法` 与 `法达星限` 丢失后天宫位和主宰宫位附加信息的问题，恢复 `(8th; 4R7R)` 这类标注格式
- 修复安装版本地排盘服务与新版 `pyswisseph` 的兼容问题，普通星盘启动后不再误报“本地排盘服务未就绪”
- 修复正常关闭应用后误报 `Runtime error` / `Python chart service exited unexpectedly` 的问题，planned shutdown 日志与真实故障日志重新分离
- 非 App 稳定版默认窗口改为最大化，并在每次启动前强制保持页面内容缩放为 `0.8`

## 开发者从哪里开始

源码与桌面打包主要在这些位置：

- `desktop_installer_bundle/`：Electron 桌面壳、NSIS 安装器、桌面构建脚本
- `prepareruntime/`：发布与维护辅助脚本，用于显式准备 runtime / bundle
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/`：主项目源码
- `docs/`：结构说明、自检记录、版本发布说明

常用文档：

- `desktop_installer_bundle/INSTALL_3_STEPS.md`
- `desktop_installer_bundle/UPDATE_RELEASE_GUIDE.md`
- `docs/MAIN_BRANCH_RESTORE.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/SELFCHECK_LOG.md`
- `docs/releases/v1.0.9.md`

## `main` 分支包含什么，不包含什么

`main` 分支会保留：

- 可复原功能所需的源码、脚本、配置、文档
- 桌面打包工程与安装器脚本
- 主项目源码和运行时准备脚本
- 发布工作流与安装器构建脚本

`main` 分支不会保留：

- `node_modules/`
- `local/workspace/runtime/windows/java/`
- `local/workspace/runtime/windows/maven/`
- `local/workspace/runtime/windows/node/`
- `local/workspace/runtime/windows/python/`
- `local/workspace/runtime/windows/wheels/`
- `local/workspace/runtime/windows/bundle/astrostudyboot.jar`
- `desktop_installer_bundle/build/`
- `desktop_installer_bundle/release/`
- 本地日志、缓存、浏览器 profile
- 可由脚本重新准备的 Java / Python / wheels 大包
- 可重新生成的前端构建产物与桌面运行时大文件

也就是说：**普通用户去 Release 下载离线安装器，开发者在 `main` 拿源码后只点 `START_HERE.bat` 即可自举复原。**

## 从 `main` 复原功能怎么做

- `main` 默认不带 Java / Python / wheels / 前端 `dist-file` / 后端 jar 这类大包或构建产物
- 但会保留复原所需的源码、脚本、模型文件、图标素材、工作流和文档
- 从 `main` 下载后，默认入口只有根目录 `START_HERE.bat`
- 启动器会自动检查并补齐缺失的 `Node.js`、`Python`、`Java`、`Maven`、前端静态文件、后端 jar 和本地 runtime
- 前端自举会优先准备并使用仓库本地 portable `Node 20`，只有本地 Node 不可用时才回退系统 `Node`
- 后端构建与运行会优先准备并使用仓库本地 portable `JDK 17`，只有本地 Java 链路明确失败时才回退系统 `Java`
- 若现代 npm 因 peer dependency 严格解析导致 `npm ci` 失败，启动器会自动改用 `--legacy-peer-deps` 做一次兼容重试
- 如果机器已经配好环境或本地 runtime 仍然可用，启动器会直接启动或仅做最小补齐
- 若启动器最终回退到了系统 `Node` / `Java`，这属于可用性兜底，不算完全自举恢复
- 首次恢复允许联网下载官方工具链，但这些下载内容不会提交回 `main`
- 具体说明见：`docs/MAIN_BRANCH_RESTORE.md`
