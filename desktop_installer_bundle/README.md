# Horosa Windows Desktop Bundle

这个目录承载 Horosa v2.0.0 Beta 正式 Windows 桌面应用工程。

- 当前发布版本：`2.0.0 Beta`（安装器版本号仍为 `2.0.0`）
- 发布定位：Mac Web 对齐后的 Windows Web / Desktop 统一大版本 beta
- 用户入口：`release/Horosa-Setup-2.0.0.exe`

## 目录职责

- `electron/`：Electron 主进程、预加载脚本、窗口管理、Python/Java/Web 服务编排和运行时健康检查。
- `scripts/`：renderer 构建、runtime staging、项目路径解析、版本资产整理和打包辅助。
- `assets/`：安装器、图标与 NSIS 定制资源。
- `release/`：本地安装器输出目录。

## 本地构建

1. 在主项目 `astrostudyui` 中执行 `npm run build:file`
2. 在本目录执行 `npm run build:desktop`
3. 需要安装器时执行 `npm run dist:win`

## 开发验证

- `npm run dev`：重建 renderer、重新 stage runtime，再启动 Electron。
- `npm run dev:fast`：仅适合不涉及前端改动的快速调试。
- 如果改了 `astrostudyui`，不要跳过 `build:renderer`。

## 产物

- 安装器输出到 `desktop_installer_bundle/release/`
- Electron 会把完整运行时打进 `extraResources/app-runtime/`
- 默认安装路径：`%LocalAppData%\Programs\Horosa`
- 正常用户不需要额外安装 Python、Java、Node.js、Maven 或前端工具链。

## v2.0.0 Beta 发布口径

v2.0.0 Beta 对齐新版 Mac Web 产品面，但 Windows 发布包必须保持自包含。旧的 `Horosa-Web-App-comprehensively-improved-MacOS-main` 同步来源文件夹不应作为安装版、Web 启动或打包依赖。

正式 GitHub Release 的标准资产是：

- `Horosa-Setup-2.0.0.exe`
- `Horosa-Setup-2.0.0.exe.blockmap`
- `latest.yml`
- `SHA256SUMS.txt`

公开下载入口是 `Horosa-Setup-2.0.0.exe`。`latest.yml`、`.blockmap` 与 `SHA256SUMS.txt` 用于更新和校验流程。
