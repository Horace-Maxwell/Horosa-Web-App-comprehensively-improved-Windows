# AGENT Change Log

## 2026-02-22 - DOCX问题排查修复（易卦/金口诀/星体地图/西洋游戏/星历兼容）

- 修改文件:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/guazhan/GuaZhanMain.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/acg/AstroAcg.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/amap/ACG.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/amap/MapV2.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/dice/DiceMain.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/flatlib-ctrad2/flatlib/ephem/__init__.py`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/flatlib-ctrad2/flatlib/ephem/swe.py`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astropy/websrv/webchartsrv.py`
  - `Horosa_Local_Windows.ps1`
  - `Prepare_Runtime_Windows.ps1`
  - `README.md`
  - `AGENT_CHANGELOG.md`
  - `UPGRADE_LOG.md`

- 变更内容:
  - 修复前端网络异常导致的白屏链路（请求失败时不再直接解包 `data[Result]`）：
    - 易卦 `gua/desc`
    - 星体地图 `location/acg`
    - 西洋游戏 `predict/dice`
  - 修复星体地图加载竞态：
    - `ACG.js` 增加 `AMapUI` 安全判断、`InfoWindow` 空值保护
    - 修正 `pnts.lenght` 拼写错误
    - 地图重绘从 `render` 迁移到 `componentDidUpdate`，避免渲染期副作用报错
    - `MapV2.js` 增加地图加载失败兜底与卸载销毁
  - 星历稳定性增强：
    - `webchartsrv.py` 启动时注入 `HOROSA_SWEPH_PATH/SE_EPHE_PATH`
    - `flatlib ephem` 增加多路径自动探测（内置 swefiles 优先）
    - `swe.py` 增加 SwissEph 失败自动回退 Moshier 计算，减少 `ephe missing` 导致的参数错误
  - Windows 启动脚本增强：
    - 依赖检查新增 `flatlib` 校验（并注入本地 `flatlib-ctrad2`）
    - 启动时 `PYTHONPATH` 同时注入 `astropy + flatlib-ctrad2`
    - 自动注入/恢复 `HOROSA_SWEPH_PATH` 与 `SE_EPHE_PATH`
    - 在线依赖兜底补充 `flatlib==0.2.3.post3`
  - README 补充：
    - `flatlib` 缺失、`ephe/se1` 报错排查
    - 发布前自检新增内置 `swefiles` 目录检查

- 自检结果:
  - 前端构建通过：`npm run build`（Webpack compiled successfully）
  - 启动脚本语法检查通过：
    - `Horosa_Local_Windows.ps1`
    - `Prepare_Runtime_Windows.ps1`
  - Python 关键模块检查通过（runtime Python）：
    - `flatlib + astrostudy + swe` 可导入
    - `HOROSA_SWEPH_PATH` 指向内置 `flatlib/resources/swefiles`
  - 星历回退检查通过：
    - 手动设定无效 ephe 路径后仍可计算太阳经度（触发 Moshier fallback）
  - Windows 启动烟测通过（无浏览器模式）：
    - `backend 9999`、`chartpy 8899` 正常拉起并正常停止
    - `HOROSA_RUN_ISSUES.md` 成功追加新运行摘要

## 2026-02-21 - 新增运行问题汇总文件（前端/后端/Python自动诊断记录）

- 修改文件:
  - `Horosa_Local_Windows.ps1`
  - `README.md`
  - `.gitignore`
  - `HOROSA_RUN_ISSUES.md`（运行时自动生成/追加，已加入忽略）
  - `AGENT_CHANGELOG.md`
  - `UPGRADE_LOG.md`

- 变更内容:
  - 启动器新增统一诊断摘要能力：每次运行结束自动写入根目录 `HOROSA_RUN_ISSUES.md`。
  - 摘要内容包含：
    - 本次 `RunTag` 与 `LogDir`
    - 启动失败原因（若有）
    - 前端(web)/后端(java)/排盘服务(python)日志中匹配到的异常线索
  - 匹配规则已过滤常见无害噪音（例如 `RollingFileAppender`）。
  - README 在“本地数据与日志”中补充了汇总文件说明。
  - `.gitignore` 忽略 `HOROSA_RUN_ISSUES.md`，避免运行后污染提交状态。

- 自检结果:
  - 两份启动脚本（根目录与 `repo_fresh_sync_20260221`）语法解析均通过。
  - 两份启动脚本无浏览器烟测均通过，均输出 `Issue summary updated: ...`.
  - 汇总文件已确认自动追加新记录，且分组件统计正常。

## 2026-02-21 - Windows 排盘超时修复（代理环境导致 localhost 被错误转发）

- 修改文件:
  - `Horosa_Local_Windows.ps1`
  - `README.md`
  - `AGENT_CHANGELOG.md`
  - `UPGRADE_LOG.md`

- 变更内容:
  - 在 Windows 启动器新增代理环境隔离逻辑：
    - 启动时自动清理 `http_proxy/https_proxy/all_proxy`（含大写变量）
    - 强制设置 `no_proxy/NO_PROXY=127.0.0.1,localhost,::1`
    - 退出时恢复原始环境变量（避免污染调用方会话）
  - 在启动日志中增加提示：检测到代理变量时会明确打印已进入本地回环绕过模式。
  - README 常见问题补充“排盘一直转圈后超时”条目，给出根因说明和旧脚本的手动临时规避命令。

- 自检结果:
  - `Horosa_Local_Windows.ps1` 与 `Prepare_Runtime_Windows.ps1` 语法解析通过。
  - 在注入假代理变量（`http://10.255.255.1:8888`）条件下，启动器烟测通过，`8899/9999` 正常拉起并可自动收尾。
  - 同条件下，直连 `8899` 排盘请求返回正常：
    - `OK_BIRTH=2026-02-21 12:00:00`
    - `RT_MS=300`

## 2026-02-21 - 再次自检 + README 自检流程更新

- 修改文件:
  - `README.md`
  - `AGENT_CHANGELOG.md`
  - `UPGRADE_LOG.md`

- 变更内容:
  - README 新增章节 `三、Windows10 发布前自检（建议每次发包执行）`，覆盖:
    - 脚本语法与运行时资源完整性检查
    - `.ps1` 与 `.bat` 双入口无浏览器烟测
    - `8899` 排盘接口可用性自检
  - README 补充烟测串行执行提醒，避免并发启动造成 `8899/9999` 端口冲突。
  - README 的 `param error` 说明补充“当前版本会返回更具体错误（如 `param error: IndexError: ...`）”。

- 自检执行结果（本轮）:
  - `Horosa_Local_Windows.ps1` / `Prepare_Runtime_Windows.ps1` 语法检查通过。
  - 关键运行时资源检查通过（python/java/jar/dist/dist-file）。
  - 串行烟测通过:
    - `powershell -ExecutionPolicy Bypass -File .\Horosa_Local_Windows.ps1`
    - `cmd /c Horosa_Local_Windows.bat`
  - 启动期间接口验证通过:
    - 正常参数：返回 `params.birth=2026-02-20 12:00:00`
    - 异常参数：返回 `param error: IndexError: string index out of range` 且含 `detail`

## 2026-02-21 - Windows10 启动链路自检（入口/服务/接口）

- 修改文件:
  - `AGENT_CHANGELOG.md`
  - `UPGRADE_LOG.md`

- 自检范围:
  - `Horosa_Local_Windows.ps1` / `Prepare_Runtime_Windows.ps1` 语法解析
  - 运行时资源存在性检查（Python/Java/jar/dist/dist-file）
  - 启动器烟测（`.ps1` 入口）
  - 启动器烟测（`.bat` 双击入口）
  - 本地排盘接口可用性（`8899` 正常参数）
  - 本地排盘异常透传（`8899` 非法参数返回 `param error: <detail>`）

- 关键结果:
  - 语法与资源检查通过。
  - `Horosa_Local_Windows.ps1` 无浏览器烟测通过（服务正常起停）。
  - `Horosa_Local_Windows.bat` 无浏览器烟测通过（用户双击入口链路正常）。
  - `8899` 接口正常参数返回星盘数据；异常参数可返回具体 `detail`（不再黑盒）。
  - 最近一次纯启动烟测日志无阻断性报错（`astrostudyboot.log.err` / `web.log.err` 为空，`astropy.log.err` 为 CherryPy 常规启动输出）。

- 说明:
  - 已显著提高 Windows10 跨机器启动成功率与问题可诊断性。
  - 受第三方系统环境差异影响（如系统策略、损坏系统组件、杀软钩子），无法对“任何一台”Windows10 做绝对数学保证。

## 2026-02-21 - Windows10 `param error` 定位增强（后端异常细节透传）

- 修改文件:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astropy/websrv/helper.py`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astropy/websrv/webchartsrv.py`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astropy/websrv/webpredictsrv.py`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astropy/websrv/webacgsrv.py`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astropy/websrv/webcalc.py`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astropy/websrv/webjdn.py`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astropy/websrv/webgermanysrv.py`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astropy/websrv/webindiasrv.py`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astropy/websrv/webmodernsrv.py`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astropy/websrv/webjieqisrv.py`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/helper/AstroHelper.java`
  - `README.md`

- 变更内容:
  - Python 侧新增 `build_param_error_response(err)`，统一返回:
    - `err: "param error: <ExceptionType>: <message>"`（兼容未重编译 jar 的旧发布包）
    - `detail: "<ExceptionType>: <message>"`（长度上限 500）
  - 星盘与推运等所有 `websrv` 相关接口从裸 `except` 升级为 `except Exception as ex`，并返回带 `detail` 的错误对象。
  - Java 转发层 `AstroHelper` 在收到 Python `err` 时会拼接 `detail` 后再抛出 `ErrorCodeException(200001, ...)`，让前端和日志能看到具体原因而非只有 `param error`。
  - README 新增 `param error` 排查步骤（日志定位 + 浏览器隔离目录清理）。

- 验证结论:
  - 已通过 Python 语法编译校验：`py_compile` 覆盖全部修改的 `astropy/websrv` 文件。
  - 本地请求验证：正常参数返回 `OK`，异常参数返回 `err + detail` 结构（经接口链路验证）。
  - 未执行 Java 编译（当前环境缺少 `mvn`）。

## 2026-02-19 - GitHub 精简上传整理（Windows 一键部署保留）

- 修改文件:
  - `.gitignore`
  - `Horosa_Local_Windows.ps1`
  - `README.md`
  - `PROJECT_STRUCTURE.md`
  - `runtime/windows/bundle/astrostudyboot.url.example.txt`（新增）

- 变更内容:
  - Windows 启动脚本新增 jar URL 文件回退读取:
    - 支持 `runtime/windows/bundle/astrostudyboot.url.txt`
    - 支持 `runtime/windows/bundle/astrostudyboot.jar.url`
    - 若 `HOROSA_BOOT_JAR_URL` 缺失时自动尝试读取上述文件
  - GitHub 上传策略改为默认不提交超大 `astrostudyboot.jar`（避免 100MB 限制）。
  - `.gitignore` 新增忽略项:
    - `runtime/windows/wheels/`（避免与 `bundle/wheels` 重复）
    - `runtime/windows/bundle/astrostudyboot.jar`
    - 参考目录 `Horosa-Web-App-comprehensively-improved-MacOS-main/`、`modules/`
  - 文档更新为“源码 + dist-file + wheels + 启动脚本”精简发布方案，并补充 URL 文件下载模式。

- 清理动作（本地工作区执行）:
  - 删除参考目录:
    - `Horosa-Web-App-comprehensively-improved-MacOS-main/`
    - `modules/`
    - `scripts/`
  - 删除冗余大文件与缓存:
    - `runtime/windows/wheels/`
    - `runtime/windows/bundle/astrostudyboot.jar`
    - `Horosa-Web-55.../astrostudyui/node_modules`
    - `Horosa-Web-55.../.horosa-local-logs-win`
    - `Horosa-Web-55.../.horosa-browser-profile-win`
    - `Horosa-Web-55.../astrostudysrv/**/target`（清理后又在烟测中自动重建）

- 验证结果:
  - 已执行无浏览器烟测:
    - 命令: `HOROSA_NO_BROWSER=1 HOROSA_SMOKE_TEST=1 .\Horosa_Local_Windows.ps1`
    - 在缺失 `runtime/windows/bundle/astrostudyboot.jar` 的情况下，脚本成功走 Maven 本地构建并完成启动/停止全流程。

## 2026-02-19 - 太乙显示修复与三式合一太乙标签补齐

- 修改文件:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/taiyi/core/TaiYiCore.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/taiyi/TaiYiMain.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`

- 变更内容:
  - 太乙核心算法输出新增分组结构:
    - `coreDisplay`
    - `extDisplay`
    - `predictionDisplay`
  - 旧字段保持兼容，原有 `taiyiPalace`、`skyeyes`、`sf`、`palace16` 等仍可继续读取。
  - `易与三式 -> 太乙` 左盘改为分层渲染:
    - 核心定位与扩展定位分层显示
    - 扩展层可通过右侧开关控制显示
  - `易与三式 -> 太乙` 右侧信息区改为分区:
    - 核心 / 扩展 / 断语
    - 新增显示选项:
      - 左盘显示扩展定位
      - 右侧显示断语
      - 仅核心简版
  - `三式合一` 右侧 `太乙` 标签内容升级为核心/扩展/断语分区展示，左侧主盘保持不叠加太乙图层。

- 验证结论:
  - 已完成静态代码检查与差异核对，确认新增字段与页面读取路径一致。
  - 未执行完整前端构建/自动化测试（本次仅进行代码级与结构级校验）。

## 2026-02-19 - 紧急回滚（恢复可用性）

- 背景:
  - 你反馈“网站直接无法使用”。

- 处理:
  - 已将本轮对以下文件的改动全部回滚到上一可运行版本:
    - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/taiyi/core/TaiYiCore.js`
    - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/taiyi/TaiYiMain.js`
    - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`

- 当前状态:
  - 代码工作区仅保留新增日志文件与 `kintaiyi-master/` 未跟踪目录。

## 2026-02-19 - 分步重做（带兼容兜底）

- 修改文件:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/taiyi/core/TaiYiCore.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/taiyi/TaiYiMain.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`

- 变更内容:
  - 重新加入太乙分组输出: `coreDisplay` / `extDisplay` / `predictionDisplay`。
  - 太乙页右侧改为核心/扩展/断语分区，并加入3个显示开关（左盘扩展、右侧断语、仅核心）。
  - 太乙页左盘改为核心与扩展双层排布；无新字段时自动回退旧 `palaces` 数据。
  - 三式合一右侧太乙标签改为“新分组优先，旧结构回退”双轨展示，保持左侧主盘不显示太乙图层。

- 验证结论:
  - 已做语法级检查（Prettier parse通过，仅风格警告）。
  - 已再次执行本地启动脚本，服务可启动并对外提供 `http://127.0.0.1:8000/index.html`。

## 2026-02-19 - 前端产物同步（让页面实际生效）

- 原因:
  - 启动脚本 `Horosa_Local_Windows.ps1` 以静态方式托管 `astrostudyui/dist-file`，不直接读取 `astrostudyui/src`。
  - 仅修改 `src` 时，页面不会出现新功能。

- 处理:
  - 在 `astrostudyui` 执行依赖安装（`npm install --legacy-peer-deps`）。
  - 执行 `BUILD_FOR_FILE=1` 的 Umi 构建，重新生成 `dist-file`。
  - 已更新的产物包含:
    - `astrostudyui/dist-file/index.html`
    - `astrostudyui/dist-file/umi.4726cd4a.js`
    - `astrostudyui/dist-file/umi.fd5c78a0.css`
  - 旧产物哈希文件已被新产物替换。

## 2026-02-19 - 太乙UI可读性修正（防溢出）

- 问题:
  - 太乙右侧信息过多导致页面超出。
  - 太乙左盘外圈文本在部分宫位越界、对齐不稳定。

- 修复:
  - `astrostudyui/src/components/taiyi/TaiYiMain.js`
    - 右侧默认改为精简:
      - `仅核心简版` 默认开启
      - `右侧显示断语` 默认关闭
    - 右侧信息卡增加滚动容器与换行策略，避免撑爆页面。
    - 左盘核心/扩展文本缩字、收窄半径并重算垂直居中 `dy`，减少越宫。
  - 重新构建并同步 `astrostudyui/dist-file`，使修复在本地启动器下立即生效。

## 2026-02-19 - 太乙右下角信息遮挡修复

- 问题:
  - 左盘右下角最后一行（如“太乙数:3”）出现半遮挡。

- 修复:
  - `astrostudyui/src/components/taiyi/TaiYiMain.js`
    - 右下角信息块起始 `y` 改为按统一行高计算并整体上移。
    - 行间距抽为常量，`y` 与 `dy` 使用同一套数值。
  - 重新构建 `dist-file`，新包已生效。

## 2026-02-20 - 六壬手动起课与前端产物防回退

- 问题:
  - 大六壬调整时间组件后仍自动变化，且页面仍显示旧UI（只有“保存”，没有“起课”）。

- 修复:
  - `astrostudyui/src/components/lrzhan/LiuRengMain.js`
    - 六壬改为“仅点击起课才计算/更新”。
    - 关闭 mount/hook/出生时间变化触发的自动请求。
    - 左盘改为读取“起课时锁定快照”，避免时间变更时自动刷新。
  - `astrostudyui/package.json`、`astrostudyui/scripts/umi-runner.js`
    - `start/build/build:file` 改为跨平台启动器，修复 Windows 下 `export ...` 脚本不生效导致的旧前端构建问题。
  - 重新构建 `astrostudyui/dist-file`，确保启动脚本读取到最新前端。
  - 同步 `runtime/windows/bundle/dist-file`，避免 runtime 包继续使用旧产物。
  - `Horosa_Local_Windows.ps1`
    - 新增 `dist-file` 与 `dist` 更新时间比较，优先使用更新的一套。
  - `Prepare_Runtime_Windows.ps1`
    - 打包时自动选最新前端产物，并统一写入 `runtime/windows/bundle/dist-file`（同时镜像到 `dist`）。
  - `README.md`、`UPGRADE_LOG.md`
    - 补充“旧前端页面”排查与 Windows 下重建 `dist-file` 命令。

## 2026-02-21 - 星盘“显示后天宫位”全链路接入（含 AI 导出与多技法同步）

- 修改文件（核心）:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/utils/planetMetaDisplay.js`（新增）
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroObjectLabel.js`（新增）
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/models/app.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/ChartDisplaySelector.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/pages/index.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/homepage/PageHeader.js`

- 修改文件（星盘/推运/关系/节气/三式合一等显示层）:
  - `AstroAspect.js`、`AstroInfo.js`、`AstroPlanet.js`、`AstroLots.js`、`AstroPredictPlanetSign.js`
  - `AstroPrimaryDirection.js`、`AstroFirdaria.js`、`AstroProfection.js`、`AstroSolarArc.js`、`AstroSolarReturn.js`、`AstroLunarReturn.js`、`AstroGivenYear.js`、`AstroZR.js`
  - `relative/AspectInfo.js`、`relative/MidpointInfo.js`、`relative/AntisciaInfo.js`
  - `AstroDoubleChartMain.js`、`AstroRelative.js`
  - `JieQiChartsMain.js`、`SanShiUnitedMain.js`
  - `AstroDirectMain.js`（主/界限法、法达星限相关文本快照）
  - `astroAiSnapshot.js`、`predictiveAiSnapshot.js`

- 变更内容:
  - 在“星盘组件”新增全局设置:
    - `显示后天宫位`
    - `显示星曜宫位`
    - `显示星曜主宰星`
  - 右侧星曜文本支持后天宫附加信息:
    - 格式: `X (1th; 2R6R)`
    - 来源严格跟随左侧当前显示盘的对象数据（house / ruleHouses）。
  - 覆盖生效范围:
    - 星盘、推运盘、关系盘、节气盘、希腊星术、印度律盘、三式合一
    - 主/界限法与法达星限表格显示
  - AI 导出同步:
    - 各相关技法的 AI 导出设置新增“显示星曜宫位/显示星曜主宰星”开关
    - 导出时按技法配置过滤后天宫后缀。
  - 兼容 Mac 字体渲染:
    - 星曜符号与附加后缀分离渲染（符号字体 + 正文字体），避免将 `(...)` 误用符号字体导致乱码。

- 验证结论:
  - 已完成前端构建通过（本轮改造阶段）。
  - 已做多页面代码路径自检，确认上述技法页面与 AI 导出链路均已接入。

## 2026-02-21 - 星曜显示为字母回归修复（字体资源路径兼容）

- 背景:
  - 用户反馈开启相关功能后，页面星曜符号退化为 `A/B/C...` 字母。
  - 根因并非星曜数据错误，而是静态托管场景下字体相对路径命中 `/static/static/*`，字体 404 后浏览器回退为普通字母。

- 修改文件:
  - `Horosa_Local_Windows.ps1`

- 变更内容:
  - 在 `Ensure-FrontendStaticLayout` 新增“嵌套 static 资源镜像”修复逻辑:
    - 检测 `umi*.css` 中 `url(static/...)`
    - 自动创建并补齐 `dist*/static/static/*`
    - 保障 `ywastro / ywastrochart / morinus` 等字体在当前静态路径下可被正确加载。

- 验证结论:
  - PowerShell 脚本语法解析通过。
  - 现场资源目录已补齐字体镜像，页面刷新后可恢复原星曜符号风格。

## 2026-02-21 - Windows 发布包补同步（后天宫位功能 + 字体路径修复）

- 背景:
  - 用户反馈 Windows 下载版缺少“显示后天宫位”相关选项。
  - 根因是源码已改但发布实际读取的 `dist-file` 仍是旧产物，导致新设置未体现在下载包。

- 修改文件:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/dist-file/index.html`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/dist-file/umi.515dab11.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/dist-file/umi.946bc48d.css`
  - `Horosa_Local_Windows.ps1`

- 变更内容:
  - 在 `astrostudyui` 重新执行 `npm install --legacy-peer-deps` 与 `npm run build:file`，将后天宫位相关前端逻辑打入 `dist-file`。
  - 同步 `Horosa_Local_Windows.ps1` 的字体路径兼容修复，确保 `url(static/...)` 场景下自动镜像 `static/static/*`，避免星曜符号退化为字母。
  - 行号说明（因前文变更，位置已后移）:
    - `Ensure-FrontendStaticLayout` 位于 `Horosa_Local_Windows.ps1:1037`
    - `url(static/...)` 检测逻辑位于 `Horosa_Local_Windows.ps1:1064`
    - `nested static` 修复提示位于 `Horosa_Local_Windows.ps1:1088`
    - 调用入口位于 `Horosa_Local_Windows.ps1:1185`

- 验证结论:
  - PowerShell 语法解析通过。
  - `Horosa_Local_Windows.ps1` smoke 启动通过（`HOROSA_NO_BROWSER=1` + `HOROSA_SMOKE_TEST=1`）。
  - 远端已推送提交 `a6db45d94d62f81c930666fd9900ad06fef844eb`。
