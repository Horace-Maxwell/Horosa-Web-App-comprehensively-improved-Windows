# Horosa Windows Desktop Bundle

这个目录承载正式 Windows 桌面应用工程：

- `electron/`：Electron 主进程、预加载脚本、运行时编排
- `scripts/`：renderer 构建、runtime staging、项目路径解析
- `assets/`：安装器、图标与 NSIS 定制资源

## 本地构建

1. 在主项目 `astrostudyui` 中执行 `npm run build:file`
2. 在本目录执行 `npm run build:desktop`
3. 需要安装器时执行 `npm run dist:win`

## 开发验证

- `npm run dev`：重建 renderer、重新 stage runtime，再启动 Electron
- `npm run dev:fast`：仅适合不涉及前端改动的快速调试
- 如果改了 `astrostudyui`，不要跳过 `build:renderer`

## 产物

- 安装器输出到 `desktop_installer_bundle/release/`
- Electron 会把完整运行时打进 `extraResources/app-runtime/`
- 默认安装路径：`%LocalAppData%\\Programs\\Horosa`

## 发布口径

- 正式 GitHub Release 采用 installer-only 策略
- 目标资产是 `Horosa-Setup-<version>.exe`
- `latest.yml`、`.blockmap`、portable zip 这类辅助或历史资产不作为正式下载入口
