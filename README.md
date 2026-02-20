# Horosa 本地离线版部署说明（Windows）

本文档对应当前根目录结构，目标是双击即可本地运行，数据本地保存。

## 一、目录约定

请确保根目录包含以下关键文件/文件夹：

- `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/`
- `Horosa_Local.command`（Mac 启动器）
- `Horosa_Local_Windows.bat`（Windows 启动入口）
- `Horosa_Local_Windows.ps1`（Windows 启动主脚本）
- `runtime/`（可选：免安装运行时）

## 二、Windows 部署与启动

### 1) 启动方式

1. 目标机先执行一次 `Prepare_Runtime_Windows.bat`（用于把 runtime 与可运行产物打包进 `runtime/windows/bundle`）。
2. 目标机双击 `Horosa_Local_Windows.bat`
3. 脚本会自动调用 `Horosa_Local_Windows.ps1` 并自动处理依赖：
   - `.bat` 会优先注入本地运行时：`runtime/windows/java/bin/java.exe` 与 `runtime/windows/python/python.exe`（不会被系统 Python 覆盖）
   - 自动检测/安装 Python 3.11
   - 自动安装 Python 依赖（`cherrypy`、`jsonpickle`、`pyswisseph`）
   - 优先尝试从本地 wheel 仓库离线安装依赖（`runtime/windows/wheels` 或 `runtime/windows/bundle/wheels`）
   - 自动检测/安装 Java 17（含多源回退）
   - `winget` 安装失败时，自动尝试下载便携 Java 17 到 `runtime/windows/java`
   - 若工程内 jar 或 dist 缺失，自动从 `runtime/windows/bundle` 回填
   - 若设置了环境变量 `HOROSA_BOOT_JAR_URL`，或提供了 `runtime/windows/bundle/astrostudyboot.url.txt`（内含下载 URL），缺失 jar 时会自动下载
   - 若仍缺 jar，脚本会尝试自动安装 Maven 并本地构建后端 jar（需要网络）
5. 依赖准备完成后自动启动后端与网页
6. 浏览器关闭后，脚本会自动停止本地服务

说明（已优化）：
- 如果检测到 Java/Python/依赖都已就绪，脚本会直接启动，不再重复安装。
- 仅当缺组件时才会执行自动安装/补齐。

### 2) 常见问题

- `Unable to access jarfile D:\Horosa...`  
  原因：旧脚本在含空格路径下参数被截断。请使用当前最新 `Horosa_Local_Windows.ps1`。
- `Backend not ready in time, required ports: 8899 and 9999`  
  常见原因：Java 版本过低、Python 缺依赖、端口被占用。
- `UnsupportedClassVersionError ... class file version 61.0`  
  说明 Java 太低，必须使用 Java 17+。
- `ModuleNotFoundError: No module named 'cherrypy'`  
  说明 Python 依赖没装好，重新双击 `Horosa_Local_Windows.bat` 让脚本自动补齐。
- `ModuleNotFoundError: No module named 'swisseph'`  
  说明 `pyswisseph` 缺失。建议在构建机执行 `Prepare_Runtime_Windows.bat` 重新打包 `runtime/windows/python` 与 `runtime/windows/bundle/wheels` 后再分发。
- `winget install exit code ...`  
  说明系统策略限制了 winget。脚本会自动继续尝试便携 Java 下载；若仍失败，查看 `java.err`。
- 若 PowerShell 执行策略拦截：已通过 `.bat` 以 `-ExecutionPolicy Bypass` 调起，一般无需手动改策略。

## 三、本地数据与日志

- 本地数据默认存储在浏览器本地存储（离线可用）
- Mac 日志目录：项目内 `.horosa-local-logs/`
- Windows 日志目录：项目内 `.horosa-local-logs-win/`

排查问题时，优先查看：

- `astropy.log` / `astropy.log.err`
- `astrostudyboot.log` / `astrostudyboot.log.err`
- `web.log` / `web.log.err`（Windows）

如果需要快速定位，先看黑窗最后 30 行，再看同一时间戳日志目录中的 `*.err` 文件。
