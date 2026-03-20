# Windows 桌面版发布流程（`v1.0.4` 口径）

## 1. 发布目标

当前正式对外发布物分为两类：

- **给普通用户的离线安装器**
  - `Horosa-Setup-<version>.exe`
- **给应用内自动更新的元数据**
  - `latest.yml`
  - `Horosa-Setup-<version>.exe.blockmap`

普通用户只需要下载 `.exe` 安装器。

## 2. 机器准备

- Windows 10/11 x64
- 已安装 Node.js / npm
- 已安装可用的 Java 17
- 已安装可用的 Python 3.11
- 已安装 GitHub CLI，并已登录：`gh auth status`

## 3. 准备运行时

在仓库根目录运行：

`powershell -NoProfile -ExecutionPolicy Bypass -File .\prepareruntime\Prepare_Runtime_Windows.ps1 -NoPause`

这一步会填充：

- `local/workspace/runtime/windows/java/`
- `local/workspace/runtime/windows/python/`
- `local/workspace/runtime/windows/wheels/`
- `local/workspace/runtime/windows/bundle/`

这些内容用于本地打包，但**不应该常规提交到 `main`**。

## 4. 构建桌面安装器

进入：

`desktop_installer_bundle/`

首次执行：

`npm install`

正式打包：

`npm run dist:win`

预期产物位于：

- `desktop_installer_bundle/release/Horosa-Setup-<version>.exe`
- `desktop_installer_bundle/release/latest.yml`
- `desktop_installer_bundle/release/Horosa-Setup-<version>.exe.blockmap`

## 5. Release 资产要求

正式版 `v1.0.4` 及后续语义化版本，至少上传这些文件：

- `Horosa-Setup-<version>.exe`
- `latest.yml`
- `Horosa-Setup-<version>.exe.blockmap`
- `SHA256SUMS.txt`

建议再附：

- 中文安装说明，如 `安装说明-<version>.md`

## 6. Release 正文要求

Release 正文统一写中文，至少包含：

- 哪些用户该下载哪个文件
- 哪些文件不要手动下载
- 三步安装说明
- 离线运行说明
- 本次新增功能 / 修复列表
- 保留用户数据说明

建议把正文来源固定在：

- `docs/releases/<version>.md`

## 7. `main` 分支提交边界

`main` 只保留：

- 源码
- 脚本
- 配置
- 文档
- 打包工程

`main` 不保留：

- `desktop_installer_bundle/build/`
- `desktop_installer_bundle/release/`
- `desktop_installer_bundle/node_modules/`
- 本地日志、缓存、浏览器 profile
- Java / Python / wheels / jar 等可通过脚本重新准备的大包

## 8. GitHub Actions 标签兼容

工作流标签触发需要同时兼容：

- 历史格式：`*.*.*.*`
- 语义化版本：`v*.*.*`

安装版语义化版本继续通过手动 `gh` 发布；独立稳定版 workflow 仅响应 `windows-stable-*` 标签。

## 9. 发版前检查

- 在已安装机器上再次运行完整安装器
- 确认维护页中文标题、说明、推荐动作显示正常
- 验证 `替换 / 修复 / 取消` 三条分支
- 确认安装版应用内更新不再依赖本地 `app-update.yml`
- 确认 `Horosa-Setup-<version>.exe` 可在断网环境安装并启动本地功能
