# Horosa 本地离线版部署说明（Mac + Windows）

本文档对应当前根目录结构，目标是双击即可本地运行，数据本地保存。

## 一、目录约定

请确保根目录包含以下关键文件/文件夹：

- `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/`
- `Horosa_Local.command`（Mac 启动器）
- `Horosa_Local_Windows.bat`（Windows 启动入口）
- `Horosa_Local_Windows.ps1`（Windows 启动主脚本）
- `runtime/`（可选：免安装运行时）

## 二、Mac 部署与启动

### 1) 基础要求

- macOS
- 推荐先在一台“构建机”执行一次 `Prepare_Runtime_Mac.command`，将运行时和可运行产物打包进仓库（见下文“2) 构建机准备”）。

### 2) 构建机准备（建议在发布到 GitHub 前执行）

双击 `Prepare_Runtime_Mac.command`，脚本会尽量自动完成：

- 准备项目内 Java runtime：`runtime/mac/java`
- 准备项目内 Python runtime：`runtime/mac/python`
- 构建并打包前端静态文件到：`runtime/mac/bundle/dist-file`（或 `dist`）
- 构建并打包后端 jar 到：`runtime/mac/bundle/astrostudyboot.jar`

说明：
- 若本机有 `npm/mvn`，会自动构建前后端产物。
- 若缺少 `npm/mvn`，脚本会尝试复用现有产物并给出 `OK/FAILED` 结果。

### 3) 启动方式（任意 Mac）

1. 双击 `Horosa_Local.command`
2. 等待终端提示服务就绪并自动打开网页
3. 使用完成后关闭网页窗口，按脚本提示停止服务

`Horosa_Local.command` 已支持自动补齐：
- 优先使用项目内 runtime（`runtime/mac/java` 与 `runtime/mac/python`）
- 若 `astrostudyboot.jar` 缺失，自动从 `runtime/mac/bundle/astrostudyboot.jar` 回填
- 若前端 `dist-file/dist` 缺失，自动从 `runtime/mac/bundle/` 回填
- 若需要前端重建且本机有 `npm`，自动执行 `npm install` + `npm run build:file`

### 4) 常见问题

- 报错 `Connect to 127.0.0.1:8899 failed`：说明图表服务未启动成功，检查 Java/Python 环境。
- 若系统拦截脚本：右键文件选择“打开”，或在终端执行  
  `chmod +x Horosa_Local.command`

## 三、Windows 部署与启动

### 1) 基础要求

二选一即可：

- 方案 A（推荐）：根目录放好免安装运行时  
  - `runtime/windows/java/bin/java.exe`（Java 17+）  
  - `runtime/windows/python/python.exe`  
  - `runtime/windows/bundle/dist-file/index.html`（或 `runtime/windows/bundle/dist/index.html`）  
  - `runtime/windows/bundle/wheels/`（推荐，Python 依赖离线轮子）  
  - `runtime/windows/bundle/astrostudyboot.jar`（可选；若不提供则走“自动下载/本地构建”）
- 方案 B：系统已安装 Java/Python，并加入 PATH（Java 17+，Python 3.11）

推荐：如果你不想等自动安装，先手动安装好再启动，速度最快。
- Java：17+（必须）
- Python：3.11（推荐）

### 2) 启动方式

1. 构建机先执行一次 `Prepare_Runtime_Windows.bat`（用于把 runtime 与可运行产物打包进 `runtime/windows/bundle`）。
2. 把整个根目录打包给目标 Windows 机器。
3. 目标机双击 `Horosa_Local_Windows.bat`
4. 脚本会自动调用 `Horosa_Local_Windows.ps1` 并自动处理依赖：
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

### 3) 常见问题

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

## 四、本地数据与日志

- 本地数据默认存储在浏览器本地存储（离线可用）
- Mac 日志目录：项目内 `.horosa-local-logs/`
- Windows 日志目录：项目内 `.horosa-local-logs-win/`

排查问题时，优先查看：

- `astropy.log` / `astropy.log.err`
- `astrostudyboot.log` / `astrostudyboot.log.err`
- `web.log` / `web.log.err`（Windows）

如果需要快速定位，先看黑窗最后 30 行，再看同一时间戳日志目录中的 `*.err` 文件。

## 五、建议交付方式（给其他电脑）

打包给他人时，建议直接提供整个 `Horosa Web` 根目录（保持目录结构不变）。

如果追求“纯离线首启”，请确保 `runtime/windows/bundle` 至少包含：
- `astrostudyboot.jar`
- `dist-file`（或 `dist`）前端静态目录
- `wheels`（Python 离线依赖轮子）

如果走“GitHub 精简包”，可以不带 `astrostudyboot.jar`，改为：
- 设置环境变量 `HOROSA_BOOT_JAR_URL`，或
- 在 `runtime/windows/bundle/astrostudyboot.url.txt` 写入 jar 直链（第一行可用 URL）

## 六、GitHub 精简发布（推荐）

如果要上传到 GitHub（普通仓库，不用 LFS），建议使用“源码 + 前端静态资源 + wheels + 启动脚本”：

- 保留：
  - 根目录启动脚本（`Horosa_Local_Windows.bat/.ps1` 等）
  - `Horosa-Web-55.../` 源码目录
  - `runtime/windows/bundle/dist-file`（前端静态资源）
  - `runtime/windows/bundle/wheels`（Python 离线依赖）
  - `runtime/windows/maven`（可选，保留可减少首次构建失败概率）
- 清理：
  - `Horosa-Web-55.../.horosa-local-logs-win`
  - `Horosa-Web-55.../.horosa-browser-profile-win`
  - `Horosa-Web-55.../astrostudyui/node_modules`
  - `Horosa-Web-55.../astrostudysrv/**/target`
  - `runtime/windows/java`、`runtime/windows/python`、`runtime/windows/wheels`（会在目标机首次启动时自动补齐）
  - 非运行必需的参考目录（如根目录 `Horosa-Web-App-comprehensively-improved-MacOS-main/`、`modules/`）

注意：

- `astrostudyboot.jar` 体积通常较大，普通 GitHub push 可能超限。  
  建议使用以下三种方式之一：
  1. 在目标机首次启动时由脚本自动 Maven 构建（本项目已支持）。
  2. 将 jar 作为 Release 资产，设置环境变量 `HOROSA_BOOT_JAR_URL` 让脚本自动下载。
  3. 将 jar 下载链接写入 `runtime/windows/bundle/astrostudyboot.url.txt`，无需额外设置环境变量。
