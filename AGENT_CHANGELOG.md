# AGENT Change Log

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
