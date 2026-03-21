# Horosa Windows Desktop Bundle

这个目录现在承载真正的 Windows 桌面应用工程：

- `electron/`：Electron 主进程、预加载脚本、运行时编排
- `scripts/`：前端构建、运行时 staging、项目路径解析
- `assets/horosa_setup.ico`：应用、安装器、卸载器统一图标

## 构建步骤

1. 先准备主项目前端构建产物
2. 运行 `..\\prepareruntime\\Prepare_Runtime_Windows.ps1 -NoPause`
3. 运行 `npm install`
4. 运行 `npm run dist:win`

## 开发验证

- 使用 `npm run dev` 做桌面端前端回归；它会先重建 renderer，再重新 stage runtime，然后启动 Electron
- `npm run dev:fast` 只适合不涉及前端改动的快速排查；如果改了 `astrostudyui`，不要用它做现场验证
- 启动日志会打印 renderer 构建时间和 stage 的 `dist-file` 时间，若时间戳没刷新，本次验证结果无效

## 产物

- 安装器输出到 `desktop_installer_bundle/release/`
- Electron 会把完整运行时打进 `extraResources/app-runtime/`
- 应用默认安装到 `%LocalAppData%\\Programs\\Horosa`

## 更新

- GitHub Release 只保留 `Horosa-Setup-*.exe`
- 安装版升级通过重新下载安装最新完整安装器完成
- 不再向 GitHub Release 上传 portable zip、`latest.yml`、`.blockmap` 或其它源码快照式资产
