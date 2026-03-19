# 星阙 Horosa Windows 桌面版

这个仓库现在同时服务两类人：

- **普通 Windows 用户**：去 GitHub Release 下载离线安装包
- **开发者 / 维护者**：从 `main` 下载源码、脚本与打包工程，自行复原运行环境与构建桌面版

## 普通用户下载哪个

- 最新正式版 Release：
  [https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
- **Windows 10/11 x64 普通用户** 请下载：
  `Horosa-Setup-1.0.2.exe`

不要手动下载这些文件：

- `latest.yml`
- `Horosa-Setup-1.0.2.exe.blockmap`

它们是给应用内自动更新使用的，不是手动安装入口。

## 三步安装

1. 下载 `Horosa-Setup-1.0.2.exe`
2. 双击运行安装器，按中文向导安装
3. 从桌面或开始菜单打开 `星阙`

补充说明：

- 安装包已经包含 Electron、Java、Python、前后端资源
- 安装完成后可**离线运行本地功能**
- 只有“检查更新”需要联网
- 默认安装到 `%LocalAppData%\Programs\Horosa`
- 用户数据保存在 `%LocalAppData%\HorosaDesktop`
- 如果机器上已经装过星阙，安装器会进入维护页，可选 `替换 / 修复 / 取消`

## 这次正式版包含什么

`v1.0.2` 重点包含：

- 真正的 Electron 桌面窗口，不再依赖浏览器 `--app` 壳
- 完整离线安装包，尽量不依赖目标机器预装环境
- 应用内更新链路（GitHub Releases + `latest.yml` + blockmap）
- 中文维护页：已安装检测、替换 / 修复 / 取消
- 默认窗口比例、缩放、快捷键、窗口恢复逻辑完善
- 顶栏抽屉、易与三式、组合盘 / 时空中点盘等白屏问题修复
- 全部主 tab 底部越界修复
- 风水 tab 在桌面壳中的本地资源加载修复
- 修复 `v1.0.0` 误发旧安装器的问题，重新打入最新桌面壳、维护页、图标与窗口显示逻辑
- 修复 `Horosa.exe` 仍显示旧默认图标的问题
- 修复开始菜单 / 桌面快捷方式残留旧入口或损坏 `星阙.lnk` 的问题

## 开发者从哪里开始

源码与桌面打包主要在这些位置：

- `desktop_installer_bundle/`：Electron 桌面壳、NSIS 安装器、自动更新、桌面构建脚本
- `prepareruntime/`：运行时准备脚本，用于补齐 Java / Python / wheels / bundle
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/`：主项目源码
- `docs/`：结构说明、自检记录、版本发布说明

常用文档：

- `desktop_installer_bundle/INSTALL_3_STEPS.md`
- `desktop_installer_bundle/UPDATE_RELEASE_GUIDE.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/SELFCHECK_LOG.md`
- `docs/releases/v1.0.2.md`

## `main` 分支包含什么，不包含什么

`main` 分支会保留：

- 可复原功能所需的源码、脚本、配置、文档
- 桌面打包工程与安装器脚本
- 主项目源码和运行时准备脚本

`main` 分支不会保留：

- `node_modules/`
- `desktop_installer_bundle/build/`
- `desktop_installer_bundle/release/`
- 本地日志、缓存、浏览器 profile
- 可由脚本重新准备的 Java / Python / wheels 大包
- 可重新生成的前端构建产物与桌面运行时大文件

也就是说：**普通用户去 Release 下载成品，开发者在 `main` 拿源码和脚本自行复原。**
