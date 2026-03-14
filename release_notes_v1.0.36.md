# Xingque for Windows v1.0.36

## 下载说明

- 常规网络环境：下载 `XingqueSetup.exe`
- 中国大陆或弱网环境：下载 `XingqueSetupFull.exe`
- 普通用户不要手动下载 `HorosaPortableWindows-*.zip`、`HorosaRuntimeWindows-*.zip` 或 `.manifest.json`

## 安装方式

1. 双击安装器。
2. 按中文安装向导完成安装。
3. 安装完成后可直接从桌面或开始菜单打开 `星阙`。

## 本次修复

- 修复安装向导与运行时安装脚本同时读写 `install-progress.json` 时的文件占用冲突。
- 安装进度文件现在使用共享读写和重试机制，避免离线完整版在安装完成前误报失败。
- 继续保留在线版与离线完整版双发行，并已重新验证两种安装器都可以安装到可用状态。
