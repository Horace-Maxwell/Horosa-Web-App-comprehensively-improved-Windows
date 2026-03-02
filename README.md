# Horosa Windows 本地部署（GitHub 克隆后一键启动）

本仓库已按根目录极简结构整理。默认目标：克隆后在任意 Windows 机器上可直接通过命令一键启动。

## 根目录结构

仅保留以下四个可见入口（另有 `.git*` 隐藏文件）：

- `README.md`
- `log/`
- `local/`
- `prepareruntime/`

其中：

- 启动入口在 `local/`：
  - `local/Horosa_Local_Windows.bat`
  - `local/Horosa_Local_Windows.ps1`
- 运行时与源码统一在 `local/workspace/`
- 打包入口在 `prepareruntime/`：
  - `prepareruntime/Prepare_Runtime_Windows.bat`
  - `prepareruntime/Prepare_Runtime_Windows.ps1`

## 一键下载 + 启动

```powershell
git clone <你的仓库地址>
cd Horosa-Web-App-comprehensively-improved-Windows-main
cmd /c .\local\Horosa_Local_Windows.bat
```

等价 PowerShell 启动：

```powershell
powershell -ExecutionPolicy Bypass -File .\local\Horosa_Local_Windows.ps1
```

## 一键准备运行时（构建机）

用于把当前机器上的运行时、jar、前端构建产物整理到 `local/workspace/runtime/windows/bundle`：

```powershell
cmd /c .\prepareruntime\Prepare_Runtime_Windows.bat
```

或：

```powershell
powershell -ExecutionPolicy Bypass -File .\prepareruntime\Prepare_Runtime_Windows.ps1
```

## 脚本能力（当前版）

- 自动识别项目目录（在 `local/workspace` 下寻找包含 `astrostudyui + astrostudysrv + astropy` 的目录）
- Python 解析链路：
  - `local/workspace/runtime/windows/python`
  - `HOROSA_PYTHON`
  - 系统 Python 3.11/3.12
  - `winget` 安装 3.11
  - 便携下载
- Java 解析链路：
  - `local/workspace/runtime/windows/java`
  - `HOROSA_JAVA` / `JAVA_HOME` / PATH
  - `winget`
  - 便携下载
- 缺失 jar / dist 时会优先从 `local/workspace/runtime/windows/bundle` 回填
- 缺失 jar 时支持 URL 轮询下载并可回退 Maven 本地构建

## 可选环境变量

- `HOROSA_WORKSPACE_DIR`：自定义 workspace 路径（默认自动识别 `local/workspace`）
- `HOROSA_PROJECT_DIR`：指定项目目录（可相对 workspace）
- `HOROSA_JDK17_URL`：JDK 17 下载地址
- `HOROSA_PYTHON_URL`：Python 3.11 便携下载地址
- `HOROSA_BOOT_JAR_URL`：后端 jar 下载地址
- `HOROSA_WEB_PORT`：前端静态服务端口（默认 8000）
- `HOROSA_NO_BROWSER=1`：不自动打开浏览器（适合 CI/烟测）
- `HOROSA_SMOKE_TEST=1`：启用启动后自动探活/快速退出流程

## 自检（发布前建议）

### 1) 语法检查

```powershell
$null=[System.Management.Automation.Language.Parser]::ParseFile('local/Horosa_Local_Windows.ps1',[ref]$null,[ref]$null)
$null=[System.Management.Automation.Language.Parser]::ParseFile('prepareruntime/Prepare_Runtime_Windows.ps1',[ref]$null,[ref]$null)
'PS_PARSE_OK'
```

### 2) 运行时打包检查

```powershell
powershell -ExecutionPolicy Bypass -File .\prepareruntime\Prepare_Runtime_Windows.ps1
```

返回码应为 `0`。

### 3) 双入口烟测（无浏览器）

```powershell
$env:HOROSA_NO_BROWSER='1'
$env:HOROSA_SMOKE_TEST='1'
$env:HOROSA_SMOKE_WAIT_SECONDS='2'
powershell -ExecutionPolicy Bypass -File .\local\Horosa_Local_Windows.ps1

$env:HOROSA_NO_BROWSER='1'
$env:HOROSA_SMOKE_TEST='1'
$env:HOROSA_SMOKE_WAIT_SECONDS='2'
cmd /c .\local\Horosa_Local_Windows.bat
```

两条都应完成且无未处理异常。

## 日志与问题定位

- 运行汇总：`log/HOROSA_RUN_ISSUES.md`
- 进程日志：`<项目目录>/.horosa-local-logs-win/<时间戳>/`
  - `astropy.log(.err)`
  - `astrostudyboot.log(.err)`
  - `web.log(.err)`

## 常见问题

- `UnsupportedClassVersionError`：Java 版本低于 17
- `No module named swisseph/cherrypy/jsonpickle`：让启动脚本自动补依赖，或先执行一次 `prepareruntime` 打包
- 端口 `8899/9999` 被占用：关闭冲突进程后重试
