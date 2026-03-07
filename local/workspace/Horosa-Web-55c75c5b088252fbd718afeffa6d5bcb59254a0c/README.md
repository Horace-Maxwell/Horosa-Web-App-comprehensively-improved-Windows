# Horosa Web + App（GitHub 可上传版）

更新时间：2026-03-06

目标：这个仓库上传到 GitHub 后，在任意一台 Mac 上都可以通过一次点击完成依赖准备、构建并启动当前功能。

## Mac 一键部署（推荐入口）

1. 下载/克隆仓库后，双击：
   - `Horosa_OneClick_Mac.command`
2. 首次运行会自动完成：
   - 安装或检测 Homebrew
   - 若 Homebrew 不可用，会自动直连下载 Java 17 runtime 到 `.runtime/mac/java`
   - 若 Homebrew 无法安装 Node，会自动直连下载 Node runtime 到 `.runtime/mac/node`
   - 若 Homebrew 无法安装 Python，会自动直连下载 Miniconda Python runtime 到 `.runtime/mac/python`
   - 安装运行依赖（Java 17、Maven、Node、Python）
   - 创建 Python 虚拟环境并安装 `cherrypy/jsonpickle/pyswisseph`
   - 构建前端 `dist-file`
   - 构建 Java 后端 `astrostudyboot.jar`（含依赖模块）
   - 尝试启动本地 Redis / MongoDB（用于完整功能）
   - 自动调用 `Horosa_Local.command` 打开本地页面
3. 首次构建时间可能较长（与网络和机器性能相关），后续启动会快很多。
4. 首次运行需要联网下载依赖（Homebrew / npm / Maven / pip）。

## 常用脚本

- `Horosa_OneClick_Mac.command`：Mac 首次部署 + 启动（推荐）
- `Horosa_Local.command`：直接启动（适合依赖已准备完成后；若本机缺关键依赖会自动回退到一键部署脚本，先尝试 Homebrew，再按 Java/Node/Python 的直连方案兜底）
- `Horosa_SelfCheck_Mac.command`：启动后自动验收本地服务、主限法运行链路与关键页面接口；若它自己拉起服务，默认会把服务保持运行，便于验收后直接继续使用网页
- 当前若本机存在带 Playwright 的 Python，`Horosa_SelfCheck_Mac.command` 还会自动补做一轮浏览器级宗师巡检：左侧主模块、关键子页、AI 导出入口、主限法切方法并重新计算
- `Prepare_Runtime_Mac.command`：打离线 runtime 包（会自动补齐缺失的 Java/Python 运行依赖，不建议提交 GitHub）
- `scripts/repo/clean_for_github.sh`：清理本地生成物，准备上传 GitHub

可选环境变量（调试用）：
- `HOROSA_SKIP_DB_SETUP=1`：跳过 Redis/MongoDB 自动安装与启动
- `HOROSA_SKIP_BUILD=1`：跳过前后端构建（需已有构建产物）
- `HOROSA_SKIP_TOOLCHAIN_INSTALL=1`：跳过 Homebrew/工具链安装
- `HOROSA_SKIP_LAUNCH=1`：只做预检和构建，不自动启动页面
- `HOROSA_JDK17_URL=<url>`：自定义 Java17 下载地址（默认使用 Adoptium API）
- `HOROSA_NODE_VERSION=<version>` / `HOROSA_NODE_URL=<url>`：自定义 Node 直连版本/下载地址（默认 `v20.11.1`）
- `HOROSA_PYTHON_URL=<url>`：自定义 Python 直连下载地址（默认 Miniconda installer）
- `HOROSA_MAVEN_VERSION=<version>` / `HOROSA_MAVEN_URL=<url>`：自定义 Maven 直连下载版本/地址
- `HOROSA_STARTUP_TIMEOUT=300`：启动等待时长（秒，默认 180；慢机器首启可调大）
- `HOROSA_KEEP_SERVICES_RUNNING=0`：仅在你明确希望“关掉启动窗口后自动停服务”时使用；当前默认即使关闭启动脚本也保持服务常驻，需手动执行 `Horosa-Web/stop_horosa_local.sh`
- `HOROSA_SELF_CHECK_STOP_AT_END=1`：仅在运行 `Horosa_SelfCheck_Mac.command` 时生效；设为 `1` 才会在验收结束后自动停掉本次自检拉起的服务
- `HOROSA_BROWSER_CHECK_PYTHON=/path/to/python`：指定用于浏览器级巡检的 Python（需已安装 `playwright`）
- `HOROSA_DIAG_FILE=<path>`：自定义故障诊断日志文件路径（默认 `diagnostics/horosa-run-issues.log`）
- `HOROSA_DIAG_DIR=<path>`：自定义故障诊断目录（默认 `diagnostics`）

启动入口的当前行为：
- `Horosa_Local.command` 会优先尝试默认端口 `8000/8899/9999`。
- 如果这些端口已被另一份 Horosa 副本或其他程序占用，它会自动切到空闲端口（通常从 `18000/18899/19999` 往上找）。
- 新打开的页面 URL 会显式附带当前副本的后端地址参数 `srv=...`，前端会据此改用正确的本地 `ServerRoot`，而不是继续写死连接 `127.0.0.1:9999`。
- 即使 URL 没带 `srv`，前端现在也会优先根据当前网页端口自动推导本地 backend：
  - `8000 -> 9999`
  - `18000 -> 19999`
  - `18001 -> 20000`
- 只有在无法从当前页面端口推导时，才会回退到旧的 `localStorage.horosaLocalServerRoot`。
- 这种情况下必须使用启动脚本新打开的页面地址，不要继续使用旧的 `127.0.0.1:8000` 标签页；旧标签页可能连着另一份副本，最容易在 `主/界限法 -> 重新计算` 时表现成“本地排盘服务未就绪”。

运行诊断日志：
- 每次运行 `Horosa_Local.command` / `start_horosa_local.sh`，都会把关键阶段状态写入：
  - `diagnostics/horosa-run-issues.log`
- 启动失败时会自动附加最近的后端/前端日志 tail，便于定位“卡住/超时/端口占用”等问题。

部署后建议验收：
- 双击 `Horosa_SelfCheck_Mac.command`
- 脚本会自动：
  - 启动本地服务（若尚未启动）
  - 校验 `9999/8899` 服务可用
  - 校验主限法 `AstroAPP-Alchabitius / Horosa原方法` 在 `/chart` 与 `/predict/pd` 两条链路都能产出并且结果不串台
  - 断言主限法前端表格直接显示后端 `predictives.primaryDirection` 的 `pd[0]/pd[1]/pd[2]/pd[4]`
  - 默认保留本次自检拉起的服务，便于验收后直接继续使用网页；如需自动关闭可设置 `HOROSA_SELF_CHECK_STOP_AT_END=1`

## 上传 GitHub 前建议流程

1. 执行清理脚本：
   - `./scripts/repo/clean_for_github.sh`
2. 检查以下目录没有被提交：
   - `Horosa-Web/astrostudyui/node_modules`
   - `Horosa-Web/**/target`
   - `runtime/mac/java`、`runtime/mac/python`
   - `Horosa-Web/.horosa-local-logs`
3. 再执行 `git add .` / `git commit` / `git push`

> 已通过 `.gitignore` 默认屏蔽本地运行时和构建产物，避免把数 GB 临时文件推到 GitHub。

## 端口与服务

- 前端静态页：`8000`（可用 `HOROSA_WEB_PORT` 覆盖）
- Java 后端：`9999`
- Python 图表服务：`8899`
- Redis（可选/推荐）：`6379`
- MongoDB（可选/推荐）：`27017`

## 目录定位

- 前端源码：`Horosa-Web/astrostudyui/src/`
- Java 后端源码：`Horosa-Web/astrostudysrv/`
- Python 图表服务：`Horosa-Web/astropy/websrv/webchartsrv.py`
- 一键脚本：`scripts/mac/bootstrap_and_run.sh`
- 自检脚本：`scripts/mac/self_check_horosa.sh`
- Python 依赖清单：`scripts/requirements/mac-python.txt`

## 常见问题

- `java 17+ is required`：
  - 运行 `Horosa_OneClick_Mac.command` 自动安装；若 Homebrew 不可用会改为直连下载 JDK 17。
- `python runtime cannot import cherrypy`：
  - 重新运行 `Horosa_OneClick_Mac.command`，会重建 venv 并补依赖。
- `node 18+ is required`：
  - 重新运行 `Horosa_OneClick_Mac.command`，脚本会先尝试 Homebrew，失败后自动直连下载 Node runtime。
- `services did not become ready in ... (need both 8899 and 9999)`：
  - 检查 8899/9999 是否被占用；查看 `Horosa-Web/.horosa-local-logs/` 日志。
  - 机器首启较慢可设置 `HOROSA_STARTUP_TIMEOUT=300` 后重试。
- 页面点击“计算”提示 `127.0.0.1:8899` 未就绪：
  - 说明前端页面还在，但本地排盘服务已经没在跑。
  - 先重新执行 `Horosa_Local.command` 或 `Horosa_OneClick_Mac.command`。
  - 当前版本的 `Horosa_SelfCheck_Mac.command` 默认不会在验收结束后自动停服务；如果你显式设置了 `HOROSA_SELF_CHECK_STOP_AT_END=1`，则验收结束后服务会被自动关闭。
- 只有主限法页点击“重新计算”时报本地服务未就绪：
  - 这通常不是主限法数学本身有问题，而是页面没有连到当前副本的后端，或者浏览器把 `cache: false` 错当成非法原生 `fetch` 参数。
  - 当前版本已经通过 `srv` 查询参数动态绑定本地 `ServerRoot`，并把主限法重算链路里的 `cache: false` 规范化为浏览器接受的 `cache: 'no-store'`。
  - 如果仍然出现，先完全关闭旧标签页，再从 `Horosa_Local.command` 新打开的页面里重试。
- 启动后页面能打开，但过一会儿点“计算/重新计算”才报本地服务未就绪：
  - 当前版本已经把 `Horosa_Local.command` 与 `start_horosa_local.sh` 的后台启动统一改成 `nohup + setsid + disown`，降低父 shell 结束后服务被带死的概率。
  - 如果仍碰到，先跑一次 `Horosa_SelfCheck_Mac.command`；它会把接口级和浏览器级检查一起跑完，并把最近结果写到 `runtime/browser_horosa_master_check.json`。
- 同机运行多个 Horosa 副本时：
  - 当前版本的 `stop_horosa_local.sh` 只会回收属于当前工作区路径的服务，不会再按通用进程名误停别的副本。
  - 当前版本的 `scripts/mac/self_check_horosa.sh` 也会在默认 `8899/9999/8000` 已被占用时自动切到空闲端口完成验收。
