# AGENT Change Log

## 2026-02-21 - 星盘“显示后天宫位”全链路同步（含 AI 导出与字体兼容）

- 修改文件:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/utils/planetMetaDisplay.js`（新增）
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroObjectLabel.js`（新增）
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/models/app.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/ChartDisplaySelector.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/pages/index.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/homepage/PageHeader.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/*`（相关展示组件）
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/relative/*`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/jieqi/JieQiChartsMain.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/direction/AstroDirectMain.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/utils/astroAiSnapshot.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/utils/predictiveAiSnapshot.js`
  - `UPGRADE_LOG.md`

- 变更内容:
  - 新增“星盘组件”设置项:
    - `显示后天宫位`
    - `显示星曜宫位`
    - `显示星曜主宰星`
  - 星曜附加信息格式统一为 `X (1th; 2R6R)`，并且严格使用左侧当前显示盘对象数据（`house` / `ruleHouses`）计算。
  - 生效范围覆盖:
    - 星盘、推运盘、关系盘、节气盘、三式合一、希腊星术、印度律盘
    - 主/界限法与法达星限相关表格
    - AI 导出设置与导出内容
  - 针对 Mac 符号字体兼容问题，新增独立标签渲染组件，分离“星曜符号字体”和“附加文本字体”，避免开启后天宫信息时出现乱码或字母化回退。

- 验证结果:
  - `npm install --legacy-peer-deps`（`astrostudyui`）通过。
  - `npm run build`（`astrostudyui`）通过。

## 2026-02-20 - Windows 一键部署 Java/JDK 探测修复

- 修改文件:
  - `Horosa_Local_Windows.ps1`
  - `README.md`
  - `UPGRADE_LOG.md`

- 变更内容:
  - 修复 `java -version` 读取逻辑，避免 `ErrorActionPreference=Stop` 时把 stderr 误判为异常，导致 Java 17 检测失败。
  - `Resolve-Java` 新增 `-RequireJdk` 逻辑，后端自动构建时明确要求 `javac.exe`。
  - 便携 Java 回退下载改为 Temurin JDK 链接（不再是 JRE）。
  - 构建阶段增加兜底：若解析失败但 `runtime/windows/java/bin/{java.exe,javac.exe}` 已就绪，仍可直接进入 Maven 构建流程。
  - README 同步补充“便携 JDK（含 javac）”说明，并修正章节编号。

- 验证结果:
  - `HOROSA_NO_BROWSER=1 HOROSA_SMOKE_TEST=1 powershell -ExecutionPolicy Bypass -File .\\Horosa_Local_Windows.ps1` 通过。
  - 结果确认：后端/前端/Python 服务全部启动，smoke 模式 6 秒后自动停止。

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
