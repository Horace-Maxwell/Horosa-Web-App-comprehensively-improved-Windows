# 从 `main` 复原 Horosa Windows 功能

这份文档面向开发者 / 维护者。

目标不是“仓库直接自带所有大包即可离线运行”，而是：

- `main` 保留完整源码、必要小资产、构建脚本、发布脚本、文档
- 大包、缓存、构建产物不进 Git
- 下载 `main` 后，只点击根目录 `START_HERE.bat`，启动器就会自动补齐缺失环境并复原当前 Windows 版功能

## 默认恢复入口

默认只需要运行：

```powershell
START_HERE.bat
```

启动器会自动执行这些动作：

- 检查项目目录、前端静态文件、后端 jar、runtime 缓存目录
- 自动发现或补齐 `Node.js`、`Python`、`Java`、`Maven`
- 前端恢复时优先准备并使用仓库本地 portable `Node 20`，避免被系统里更激进的新 npm 行为打断
- 后端构建与运行时优先准备并使用仓库本地 portable `JDK 17`
- 缺失时优先尝试本地 runtime / 系统环境，再尝试 `winget`，最后走官方便携下载回退
- 自动执行前端 `npm ci` 与 `npm run build:file`
- 若标准 `npm ci` / `npm install` 因 peer dependency 冲突报 `ERESOLVE`，会自动用 `--legacy-peer-deps` 再重试一次
- 自动执行后端 Maven 构建
- 自动补齐本地 Python 依赖与运行时目录
- 完成后直接启动 Horosa 本地系统

## 仓库里保留什么，不保留什么

会保留：

- `START_HERE.bat`
- `local/Horosa_Local_Windows.ps1`
- `prepareruntime/Prepare_Runtime_Windows.ps1`
- `desktop_installer_bundle/`
- `docs/`
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/` 下的前端 / Java / Python 源码、模型文件、验证脚本

不会保留：

- `node_modules/`
- `astrostudyui/dist/`、`astrostudyui/dist-file/`
- `astrostudysrv/**/target/`
- `local/workspace/runtime/windows/java/`
- `local/workspace/runtime/windows/maven/`
- `local/workspace/runtime/windows/node/`
- `local/workspace/runtime/windows/python/`
- `local/workspace/runtime/windows/wheels/`
- `local/workspace/runtime/windows/bundle/astrostudyboot.jar`
- `desktop_installer_bundle/build/`
- `desktop_installer_bundle/release/`
- 本地日志、浏览器 profile、pid/state 文件、运行时缓存

## 本地运行稳定版

从 `main` 下载后，直接从仓库根目录运行：

```powershell
START_HERE.bat
```

预期行为：

- 若环境未配置好，启动器会先联网自举补齐
- 若环境已就绪，启动器会直接启动或仅做增量补齐
- 若系统里已经有 Node，也仍会优先尝试仓库本地 portable `Node 20` 来完成前端恢复
- 若系统里已经有 Java，也仍会优先尝试仓库本地 portable `JDK 17` 来完成后端构建与启动
- 只有本地 Node / Java 链路明确失败时，启动器才会回退系统安装；这种情况属于可用性兜底，不算完全自举恢复
- 本地 Python / Java / web 服务正常启动
- 浏览器壳稳定版可打开
- 窗口默认最大化
- 页面默认缩放保持 `0.8`

## 手动辅助脚本

通常不需要手动运行其他脚本。

这些脚本仍然保留给维护 / 发布场景：

- `prepareruntime/Prepare_Runtime_Windows.ps1`
- `desktop_installer_bundle/build_portable_release_zip.ps1`

也就是说，`main` 的对外承诺是：

- **首次恢复**：优先走 `START_HERE.bat`
- **维护和发布**：需要时再显式使用 `prepareruntime/` 与桌面打包脚本

## 构建桌面安装版

若要手动构建桌面安装版，可在自举恢复完成后执行：

```powershell
cd desktop_installer_bundle
npm ci
```

然后打包：

```powershell
npm run dist:win
```

预期产物位置：

- `desktop_installer_bundle/release/`

## 构建 portable 稳定版压缩包

在仓库根目录准备好 runtime 后，可按 tag 版本号生成 portable 包：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\desktop_installer_bundle\build_portable_release_zip.ps1 -Version windows-stable-YYYY-MM-DD
```

预期产物位置：

- `desktop_installer_bundle/release/HorosaPortableWindows-<tag>.zip`
- `desktop_installer_bundle/release/HorosaPortableWindows-<tag>.manifest.json`

## GitHub Actions 发布链路

当前 `.github/workflows/desktop-release.yml` 已按“源码重建后再打包”设计。

也就是说，发布 portable stable tag 时，CI 会：

1. 安装或准备工具链
2. 重建前端 `dist-file`
3. 重建后端 jar
4. 运行 `Prepare_Runtime_Windows.ps1`
5. 生成 portable release zip

因此 `main` 不需要保留上述大包或构建产物。
