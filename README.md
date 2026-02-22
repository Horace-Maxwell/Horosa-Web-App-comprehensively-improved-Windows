# Horosa 本地离线版部署说明（Windows）

本文档对应当前根目录结构，目标是双击即可本地运行，数据本地保存。

## 一、目录约定

请确保根目录包含以下关键文件/文件夹：

- 工程源码目录（脚本自动识别：`Horosa-Web/`、`Horosa-Web-<hash>/`，或任意包含 `astrostudyui + astrostudysrv + astropy` 的目录）
- `Horosa_Local_Windows.bat`（Windows 启动入口）
- `Horosa_Local_Windows.ps1`（Windows 启动主脚本）
- `runtime/`（可选：免安装运行时）

## 二、Windows 部署与启动

### 1) 启动方式

1. 构建机先执行一次 `Prepare_Runtime_Windows.bat`（用于把 runtime 与可运行产物打包进 `runtime/windows/bundle`）。
2. 目标机双击 `Horosa_Local_Windows.bat`
3. 脚本会自动调用 `Horosa_Local_Windows.ps1` 并自动处理依赖：
   - 自动识别工程目录名（支持 `Horosa-Web/`、`Horosa-Web-<hash>/`，以及任意包含 `astrostudyui + astrostudysrv + astropy` 的目录）
   - `.bat` 会优先注入本地运行时：`runtime/windows/java/bin/java.exe` 与 `runtime/windows/python/python.exe`（不会被系统 Python 覆盖）
   - 自动检测 Python（优先 3.11；若仅有 3.12 且依赖失败，会自动尝试安装并切换到 3.11）
   - 自动安装 Python 依赖（`cherrypy`、`jsonpickle`、`pyswisseph`，并校验 `flatlib` 可用）
   - 优先尝试从本地 wheel 仓库离线安装依赖（`runtime/windows/wheels` 或 `runtime/windows/bundle/wheels`）
   - 自动检测/安装 Java 17（含多源回退）
   - `winget` 安装失败时，自动尝试下载便携 Java 17 到 `runtime/windows/java`
   - 自动比较 `astrostudyui/dist-file` 与 `astrostudyui/dist` 的更新时间，优先加载更新的一套前端静态资源
   - 若工程内 jar 或 dist 缺失，自动从 `runtime/windows/bundle` 回填
   - 若设置了环境变量 `HOROSA_BOOT_JAR_URL`，或提供了 `runtime/windows/bundle/astrostudyboot.url.txt`（内含下载 URL），缺失 jar 时会自动下载
   - 若仍缺 jar，脚本会尝试自动安装 Maven 并本地构建后端 jar（需要网络）
4. 依赖准备完成后自动启动后端与网页
5. 浏览器关闭后，脚本会自动停止本地服务

说明（已优化）：
- 如果检测到 Java/Python/依赖都已就绪，脚本会直接启动，不再重复安装。
- 仅当缺组件时才会执行自动安装/补齐。

### 2) 常见问题

- `Unable to access jarfile D:\Horosa...`  
  原因：旧脚本在含空格路径下参数被截断。请使用当前最新 `Horosa_Local_Windows.ps1`。
- `Backend not ready in time, required ports: 8899 and 9999`  
  常见原因：Java 版本过低、Python 缺依赖、端口被占用。
- 排盘时一直转圈后超时（尤其在公司网络/代理软件环境）  
  常见根因：系统里存在 `http_proxy/https_proxy/all_proxy`，导致后端 Java 对本地 `127.0.0.1:8899` 的请求被错误走代理而不是回环地址。  
  当前最新版 `Horosa_Local_Windows.ps1` 已在启动时自动处理：清理代理变量并强制 `no_proxy=127.0.0.1,localhost,::1`。  
  如果你手上是旧脚本，可先手动执行再启动：
  ```powershell
  Remove-Item Env:http_proxy,Env:https_proxy,Env:all_proxy,Env:HTTP_PROXY,Env:HTTPS_PROXY,Env:ALL_PROXY -ErrorAction SilentlyContinue
  $env:no_proxy='127.0.0.1,localhost,::1'
  $env:NO_PROXY=$env:no_proxy
  ```
- `UnsupportedClassVersionError ... class file version 61.0`  
  说明 Java 太低，必须使用 Java 17+。
- `ModuleNotFoundError: No module named 'cherrypy'`  
  说明 Python 依赖没装好，重新双击 `Horosa_Local_Windows.bat` 让脚本自动补齐。
- `ModuleNotFoundError: No module named 'swisseph'`  
  说明 `pyswisseph` 缺失。建议在构建机使用 Python 3.11 执行 `Prepare_Runtime_Windows.bat`，重新打包 `runtime/windows/python` 与 `runtime/windows/bundle/wheels` 后再分发。
- `ModuleNotFoundError: No module named 'flatlib'`  
  说明运行环境没有正确加载项目内 `flatlib-ctrad2`。请确认压缩包里包含 `Horosa-Web-*/flatlib-ctrad2/`，并使用最新版 `Horosa_Local_Windows.ps1`（会自动把该目录注入 `PYTHONPATH`）。
- 报错包含 `ephe` / `se*.se1` / `SwissEph file ... not found`  
  新版已内置星历目录自动探测与回退（优先项目内 `flatlib-ctrad2/flatlib/resources/swefiles`，缺文件时自动回退 Moshier 计算）。  
  一般不需要手动去瑞士星历网站下载文件。若仍出现，请先确认项目内目录存在：
  ```powershell
  Test-Path .\Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c\flatlib-ctrad2\flatlib\resources\swefiles
  ```
- 页面提示 `param error` / 排盘不可用  
  说明后端服务已启动，但某个排盘参数或排盘计算过程抛出了异常。当前版本会尽量返回更具体提示，例如：`param error: IndexError: ...`。  
  先执行以下排查（在项目根目录 PowerShell）：
  ```powershell
  # 1) 找到最新启动日志目录
  $latest = Get-ChildItem ".\\Horosa-Web-*\\.horosa-local-logs-win" -Directory |
    Sort-Object Name -Descending | Select-Object -First 1

  # 2) 查看 Python 真实异常（重点）
  Get-Content (Join-Path $latest.FullName "astropy.log.err") -Tail 120

  # 3) 查看 Java 侧转发异常
  Get-Content (Join-Path $latest.FullName "astrostudyboot.log.err") -Tail 120
  ```
  若是历史缓存参数污染，删除浏览器隔离目录后重启：
  ```powershell
  Remove-Item -Recurse -Force ".\\Horosa-Web-*\\.horosa-browser-profile-win"
  ```
  然后重新双击 `Horosa_Local_Windows.bat` 再测。
- `winget install exit code ...`  
  说明系统策略限制了 winget。脚本会自动继续尝试便携 Java 下载；若仍失败，查看 `java.err`。
- 页面仍显示旧前端（例如看不到最新按钮/选项）  
  在工程目录重新构建 `dist-file`，再重启启动器：
  ```powershell
  cd Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui
  npm run build:file
  ```
  若你需要重新打包给其他 Windows 机器，一并再执行一次根目录 `Prepare_Runtime_Windows.bat` 同步 `runtime/windows/bundle`。
- 若 PowerShell 执行策略拦截：已通过 `.bat` 以 `-ExecutionPolicy Bypass` 调起，一般无需手动改策略。

## 三、Windows10 发布前自检（建议每次发包执行）

### 1) 脚本与资源完整性检查

在项目根目录 PowerShell 执行：

```powershell
# 启动脚本语法检查
$null=[System.Management.Automation.Language.Parser]::ParseFile('Horosa_Local_Windows.ps1',[ref]$null,[ref]$null)
$null=[System.Management.Automation.Language.Parser]::ParseFile('Prepare_Runtime_Windows.ps1',[ref]$null,[ref]$null)
'PS_PARSE_OK'

# 运行时关键文件检查（应全部 True）
Test-Path .\runtime\windows\python\python.exe
Test-Path .\runtime\windows\java\bin\java.exe
Test-Path .\Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c\astrostudysrv\astrostudyboot\target\astrostudyboot.jar
Test-Path .\Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c\flatlib-ctrad2\flatlib\resources\swefiles
Test-Path .\Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c\astrostudyui\dist\index.html
Test-Path .\Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c\astrostudyui\dist-file\index.html
```

通过标准：
- 输出包含 `PS_PARSE_OK`
- 6 条 `Test-Path` 全为 `True`

### 2) 启动器烟测（`.ps1` 与 `.bat` 双入口）

注意：两条烟测命令请串行执行，不要并行启动，避免 `8899/9999` 端口抢占。

```powershell
# 入口1：PowerShell 启动器
$env:HOROSA_NO_BROWSER='1'
$env:HOROSA_SMOKE_TEST='1'
$env:HOROSA_SMOKE_WAIT_SECONDS='2'
powershell -ExecutionPolicy Bypass -File .\Horosa_Local_Windows.ps1

# 入口2：用户双击等价入口
$env:HOROSA_NO_BROWSER='1'
$env:HOROSA_SMOKE_TEST='1'
$env:HOROSA_SMOKE_WAIT_SECONDS='2'
cmd /c Horosa_Local_Windows.bat
```

通过标准（两条都要满足）：
- 出现 `backend: http://127.0.0.1:9999`
- 出现 `chartpy: http://127.0.0.1:8899`
- 最终出现 `... stopped pid ...` 且命令返回无报错

### 3) 排盘接口自检（可选但推荐）

先启动（给 25 秒窗口用于接口调用）：

```powershell
$env:HOROSA_NO_BROWSER='1'
$env:HOROSA_SMOKE_TEST='1'
$env:HOROSA_SMOKE_WAIT_SECONDS='25'
powershell -ExecutionPolicy Bypass -File .\Horosa_Local_Windows.ps1
```

在第二个 PowerShell 窗口请求正常排盘：

```powershell
$okBody=@{
  date='2026/02/20'; time='12:00:00'; zone='+08:00';
  lat='26n04'; lon='119e19'; hsys=0; tradition=$false; zodiacal=0;
  predictive=$false; strongRecption=$false; simpleAsp=$false;
  virtualPointReceiveAsp=$false; doubingSu28=$false; southchart=$false
} | ConvertTo-Json -Depth 4

$okResp = Invoke-RestMethod -Uri 'http://127.0.0.1:8899/' -Method Post -ContentType 'application/json' -Body $okBody -TimeoutSec 20
$okResp.params.birth
```

通过标准：
- 能返回出生时间字符串（例如 `2026-02-20 12:00:00`）
- 不返回 `err`

## 四、本地数据与日志

- 本地数据默认存储在浏览器本地存储（离线可用）
- Windows 日志目录：项目内 `.horosa-local-logs-win/`
- 运行问题汇总文件：根目录 `HOROSA_RUN_ISSUES.md`（每次启动结束自动追加前端/后端/Python问题摘要）

排查问题时，优先查看：

- `astropy.log` / `astropy.log.err`
- `astrostudyboot.log` / `astrostudyboot.log.err`
- `web.log` / `web.log.err`（Windows）

如果需要快速定位，先看黑窗最后 30 行，再看同一时间戳日志目录中的 `*.err` 文件。
