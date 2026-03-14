# Xingque for Windows v1.0.37

## 下载说明

- 常规网络环境：下载 `XingqueSetup.exe`
- 中国大陆或弱网环境：下载 `XingqueSetupFull.exe`
- 普通用户不要手动下载 `HorosaPortableWindows-*.zip`、`HorosaRuntimeWindows-*.zip` 或 `.manifest.json`

## 安装方式

1. 双击安装器。
2. 按中文安装向导完成安装。
3. 安装完成后可直接从桌面或开始菜单打开 `星阙`。

## 本次修复

- 本地桌面服务不再固定占用 `8000 / 8899 / 9999`，默认每次启动自动选择一组临时随机端口。
- 随机端口会同步传给桌面壳、预热脚本和健康检查链路，减少端口冲突和多副本互相影响的问题。
- 保留环境变量端口覆盖能力，便于调试和回归测试。
