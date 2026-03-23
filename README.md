# 星阙 Horosa Windows 桌面版

这个仓库同时服务两类人：

- 普通 Windows 用户：从 GitHub Release 下载正式安装器
- 开发者 / 维护者：从 `main` 获取源码、脚本和桌面打包工程，通过根目录 `START_HERE.bat` 自举启动本地环境

## 普通用户下载哪个

- 最新正式版 Release：
  [https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest](https://github.com/Horace-Maxwell/Horosa-Web-App-comprehensively-improved-Windows/releases/latest)
- Windows 10/11 x64 正式安装入口：
  `Horosa-Setup-1.1.0.exe`

Latest Release 只保留安装器，不需要手动处理其它发布附属文件。

## `v1.1.0` 重点修复

- 遁甲盘主盘按窗口底边限高，右栏改为可滚动，超宽和偏矮窗口都能完整显示
- 节气盘黄道 / 分宫制显示与切换重算恢复正常
- 主限法、法达星限不再空白，后天宫位 / 主宰宫标注恢复
- 六壬、三式合一的起课、旬法、遁干、三传等规则链统一修复
- 安装版 Python 图表服务兼容新版 `swisseph.azalt(...)`，排盘不再误报本地服务未就绪
- 安装器快捷方式创建修复，桌面与开始菜单入口指向正式 `Horosa.exe`
- 正常关闭后不再残留进程导致下次无法打开
- planned shutdown 不再误报 `Runtime error` / `Python chart service exited unexpectedly`

## 安装与运行

1. 下载 `Horosa-Setup-1.1.0.exe`
2. 运行安装器，按中文向导完成安装
3. 从桌面或开始菜单打开 `星阙`

补充说明：

- 安装包已包含 Electron、Java、Python、前后端资源
- 默认安装路径：`%LocalAppData%\\Programs\\Horosa`
- 用户数据目录：`%LocalAppData%\\HorosaDesktop`
- 若本机已有旧版，安装器会进入维护页，可选择替换或修复

## 开发者入口

主要目录：

- `desktop_installer_bundle/`：Electron 桌面壳、NSIS 安装器、发布脚本
- `prepareruntime/`：运行时准备脚本
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/`：主项目源码
- `docs/`：发布说明、自检和结构文档

常用入口：

- `START_HERE.bat`
- `SELF_CHECK_HOROSA_WINDOWS.bat`
- `docs/releases/v1.1.0.md`

`main` 会保留源码、脚本、打包工程和文档；不会提交 `node_modules`、`desktop_installer_bundle/build/`、`desktop_installer_bundle/release/` 以及本地 runtime 大包和日志缓存。
