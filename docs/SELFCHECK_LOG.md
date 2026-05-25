# Horosa Windows 自检日志

最后更新：2026-05-25

## 2026-05-25 v2.1.1 Beta 干净 Windows 原生运行时修复与发布重打

本轮以 Horosa `v2.1.1 Beta` 为目标，在 v2.1.0 Mac 2.1.0 beta 对齐功能面之上，重点固化全新 Windows 机器无需额外安装 VC++ Redistributable、Python 或 Java 即可启动的运行时修复。GitHub Release 按用户要求使用 Beta 标题与说明，但发布属性保持 `prerelease=false`，让普通用户能在 GitHub 右侧 Releases 区域直接看到并下载。

### 代码与构建检查

- `npm run dist:win`：成功生成 v2.1.1 Windows `win-unpacked`、安装器、blockmap 与 `latest.yml`。
- `node --test electron/service-manager.test.js`：14 tests passed。
- `python scripts/release_preflight.py`：版本、品牌资产、vendored VC++ runtime 与应用显示名检查通过。
- `stage-runtime.cjs`：确认 10 个 VC++ runtime DLL 已复制到 bundled `python.exe` 同级。
- `check_runtime_native_deps.py`：打包 staging 阶段扫描 192 个原生模块通过；本地 runtime survey 扫描 195 个 PE 文件通过。
- bundled Python import smoke：`swisseph`、`_sxtwl`、`sxtwl`、`ephem`、`pendulum`、`kerykeion`、`astropy`、`pandas`、`streamlit` 导入通过。
- `Get-AuthenticodeSignature`：`Horosa-Setup-2.1.1.exe` 为 `NotSigned`，符合本轮“不签名”的打包要求。

### 发布资产

- `desktop_installer_bundle/release/Horosa-Setup-2.1.1.exe`
- `desktop_installer_bundle/release/Horosa-Setup-2.1.1.exe.blockmap`
- `desktop_installer_bundle/release/latest.yml`
- `desktop_installer_bundle/release/SHA256SUMS.txt`

### SHA256

- `Horosa-Setup-2.1.1.exe`: `e389cd144d84ab3df9daf371560a5bf92891000fd16a650356b3e81212ed3284`
- `Horosa-Setup-2.1.1.exe.blockmap`: `e2f193b0b3927626e702cd60db858fd813c18788519296ab318f5aaa75b07481`
- `latest.yml`: `93c38b49e5aaf49ae9b161a692723dcacc4cd9bf2a3cae5191625792bcfd8815`

### 注意事项

- `latest.yml` 已显示 `version: 2.1.1` 且 `path: Horosa-Setup-2.1.1.exe`，安装器大小为 `1193739830` bytes。
- runtime payload tar 大小为 `2695476224` bytes。
- `docs/CLEAN_MACHINE_NATIVE_RUNTIME_FIX.md` 已纳入当前 release gate；未来新增 Python 原生依赖时必须继续跑 native dependency scan。
- 用户/其他 agent 已在全新 Windows 11 VM 手测确认 standalone-Python 安装包可启动、命盘可渲染、Python 图表服务与 Java 后端均正常运行；本轮重打包保留同一修复链路并通过构建期原生依赖闸门。
- `README.md`、`README_ZH.md`、`README_EN.md`、`docs/releases/2.1.1.md`、`docs/PROJECT_STRUCTURE.md`、`desktop_installer_bundle/README.md` 与 `CITATION.cff` 已更新到 v2.1.1 Beta 发布口径。

## 2026-05-24 v2.1.0 Beta Mac 2.1.0 同步、Windows 安装器与干净机器复查

本轮以 Horosa `v2.1.0 Beta` 为目标，继续把 Mac 2.1.0 beta 的传统命法/卜法后端、AI 导出、命盘/事盘管理、窗口与设置持久化、启动控制台、紫微/八字 UI 修复和 Windows 安装器加固同步进 Windows Web / Desktop 交付。发布工程仍不依赖 Mac 专属命令、Mac runtime 或 Mac 同步来源文件夹。

### 代码与构建检查

- `npm run build:file`：`astrostudyui` file 模式构建通过。
- `npm run dist:win`：成功生成 v2.1.0 Windows `win-unpacked`、安装器、blockmap 与 `latest.yml`。
- `python -m py_compile desktop_installer_bundle/scripts/clean_machine_cold_warm_check.py`：新增干净机器冷/热启动脚本语法检查通过。
- `Get-AuthenticodeSignature`：`Horosa-Setup-2.1.0.exe` 为 `NotSigned`，符合本轮“不签名”的打包要求。

### Web 与后端自检

- 一键 Web 预检确认使用随仓库/随包运行时：Python `3.11.9`、OpenJDK `17.0.10`、Node `v20.20.2`。
- `verify_kentang_runtime_endpoints.py`：17 个 kentang/kin `/pan` 端点全通过，并在之后回打普通 `/chart` 多时间样例通过。
- `verifyHorosaRuntimeFull.js`：Java 后端主要模块返回有效结构。
- 浏览器自检 8 个重点 UI 用例通过，`pageErrors=0`，`consoleErrors=0`。

### 安装器与安装版自检

- `installer_custom_dir_smoke.py`：自定义安装目录、主程序、卸载程序、桌面快捷方式和开始菜单快捷方式均有效。
- `installed_desktop_smoke_check.py`：安装版 runtime shell ready、renderer chart ready、正常关闭、快捷方式重启、单实例检查和 8 个 UI 用例通过。
- 安装版自检结果：`pageErrors=0`，`consoleErrors=0`，desktop/Python forbidden 日志均为 `0`。
- `clean_machine_cold_warm_check.py`：隔离 `LOCALAPPDATA`、`APPDATA`、`TEMP`、`TMP` 后冷/热启动通过。
  - 冷启动：`extracted`，`24250ms`，runtime payload `2994307584` bytes。
  - 热启动：`cached`，`9120ms`，低于 10 秒。
  - backend/chart probes ready，forbidden log matches 为空，8899/9999/9464 停止后无监听。

### 发布资产

- `desktop_installer_bundle/release/Horosa-Setup-2.1.0.exe`
- `desktop_installer_bundle/release/Horosa-Setup-2.1.0.exe.blockmap`
- `desktop_installer_bundle/release/latest.yml`
- `desktop_installer_bundle/release/SHA256SUMS.txt`

### SHA256

- `Horosa-Setup-2.1.0.exe`: `5b5e5bdc1f8a163a52ffa08460732e3d98ce6f8f3e0d057503bad48e96c4712d`
- `Horosa-Setup-2.1.0.exe.blockmap`: `8127b10f0f80152a3a401a68752460a74242b2d7b4617e1c806870a153a860d8`
- `latest.yml`: `93094594159eb2c4e56b107911aa1593bbb314d7bd264d5d9efb47c9485163de`

### 注意事项

- `latest.yml` 已显示 `version: 2.1.0` 且 `path: Horosa-Setup-2.1.0.exe`。
- `SHA256SUMS.txt` 已在最终重打安装包之后重新生成。
- `README.md`、`README_ZH.md`、`README_EN.md`、`docs/releases/2.1.0.md`、`docs/PROJECT_STRUCTURE.md`、`desktop_installer_bundle/README.md` 与 `CITATION.cff` 已更新到 v2.1.0 Beta 发布口径。
- 当前 release 资产按用户要求未做 Authenticode 签名；干净 Windows 可能出现 SmartScreen 信任提示，但这不等同于 Java/Python/接口不匹配。

## 2026-05-22 v2.0.1 Beta Qimen parity and Windows installer rebuild

本轮以 Horosa `v2.0.1 Beta` 为目标，直接同步 Mac 端已通过的奇门遁甲修复文件，重点覆盖拆补 / 置润起局、精确交节、真太阳时四柱、本地历法回退、天盘干、门神星和值符值使输出。`Horosa-APP-main` 仅作为参考源使用，发布工程中未保留该文件夹作为运行或构建依赖。

### 代码与构建检查

- `npm test -- --runInBand`：`astrostudyui` 通过，23 suites / 91 tests。
- `npm run build`：`astrostudyui` Web 构建通过。
- `npm run build:file`：`astrostudyui` file 模式构建通过。
- `mvn -DskipTests compile`：Java 后端 targeted compile 通过。
- `node --test electron\\*.test.js`：桌面运行时单测通过，14 tests。
- `npm run dist:win`：成功生成 v2.0.1 Windows `win-unpacked`、安装器、blockmap 与 `latest.yml`。
- `Horosa-Setup-2.0.1.exe /S`：本机静默覆盖安装通过，exit code `0`，`%LocalAppData%\\Programs\\Horosa` 下主程序与卸载程序均存在。
- 安装版真实启动检查：`Horosa.exe` 从 `%LocalAppData%\\Programs\\Horosa` 启动，随包 runtime 解压到 `%LocalAppData%\\HorosaDesktop\\embedded-runtime`，Python chart service 与 Java backend 均从 embedded runtime 运行，runtime state 到达 `ready`，renderer 成功加载最终 `dist-file`。

### 发布资产

- `desktop_installer_bundle/release/Horosa-Setup-2.0.1.exe`
- `desktop_installer_bundle/release/Horosa-Setup-2.0.1.exe.blockmap`
- `desktop_installer_bundle/release/latest.yml`
- `desktop_installer_bundle/release/SHA256SUMS.txt`

### SHA256

- `Horosa-Setup-2.0.1.exe`: `fc406dae1501e975217851c82933c2d045acb81c8095e6a36da2fb2ebff0c708`
- `Horosa-Setup-2.0.1.exe.blockmap`: `ecd1bd7e34e6d6c054e7db22005491612a27084640d99361b2fa1d9cad9b6dd9`
- `latest.yml`: `2be5ad00c9eebf3348548d072677892070e65e81bc593fb33db281bdcc153832`

### 注意事项

- `latest.yml` 已显示 `version: 2.0.1` 且 `path: Horosa-Setup-2.0.1.exe`。
- `Get-AuthenticodeSignature` 显示安装器为 `NotSigned`，符合本轮“不签名”的 Windows beta 发布方式。
- 打包前曾因本地已启动的 Java/Python 服务占用运行时文件而失败；结束本仓库启动的本地后端进程后重新打包通过。

## 2026-05-21 v2.0.0 Beta Mac Web 对齐与发布前自检

本轮以 Horosa `v2.0.0 Beta` 大版本发布为目标，确认 Windows Web / Desktop 已完成新版 Mac Web 产品面对齐，并准备 GitHub Release 所需资产。安装器版本号保持 `2.0.0`，公开文案标明 Beta。

### 本轮关键更新

- README 三张软件示例图已替换为 `docs/assets/screenshots/horosa-2.0-main-workspace.png`、`horosa-2.0-module-navigator.png`、`horosa-2.0-sanshi-workspace.png`。
- `README.md`、`README_EN.md`、`README_ZH.md` 已从旧的 v1.3.4 遁甲单点文案更新为 v2.0.0 Beta 跨平台统一大版本文案。
- `CITATION.cff`、`desktop_installer_bundle/package.json`、`desktop_installer_bundle/package-lock.json`、`desktop_installer_bundle/README.md`、`docs/PROJECT_STRUCTURE.md`、`local/workspace/docs/PROJECT_STRUCTURE.md` 已同步到 `2.0.0` / `2.0.0 Beta` 发布口径。
- 新增 `docs/releases/2.0.0.md`，包含功能范围、发布资产、SHA256 与自检摘要。
- 发布目录已生成 `Horosa-Setup-2.0.0.exe`、`Horosa-Setup-2.0.0.exe.blockmap`、`latest.yml`、`SHA256SUMS.txt`。
- 旧 `Horosa-Setup-1.3.4.exe` 与旧 blockmap 已从当前发布目录移除。

### 发布资产

- `desktop_installer_bundle/release/Horosa-Setup-2.0.0.exe`
- `desktop_installer_bundle/release/Horosa-Setup-2.0.0.exe.blockmap`
- `desktop_installer_bundle/release/latest.yml`
- `desktop_installer_bundle/release/SHA256SUMS.txt`

### SHA256

- `Horosa-Setup-2.0.0.exe`: `0d352a75bba3f0ebacc7d29cc287a9941b398e476517b30216e665d3f0ca0a1d`
- `Horosa-Setup-2.0.0.exe.blockmap`: `1808a4c3038e721903b870df634335b35bee0757cb2312cebcd2fc6e67df9445`
- `latest.yml`: `5345c4d51a7b9605a6502229e8ff7a3efac6535ebd6e4d7e7294a278eece9786`

### 本轮自检结果

已完成并通过：

- `npm test -- --runInBand`：23 个 test suites、86 个 tests 全部通过。
- `python -m compileall -q astropy`：Python 后端语法编译通过。
- `node --test desktop_installer_bundle/electron/service-manager.test.js`：13 个桌面服务编排测试通过。
- `npm run dist:win`：成功生成 v2.0.0 Beta win-unpacked、安装器、blockmap 与 `latest.yml`。
- `Get-AuthenticodeSignature`：`Horosa-Setup-2.0.0.exe` 为 `NotSigned`，符合本轮“不签名”要求。
- `win-unpacked` 首启 smoke：runtime/renderer ready，0 console errors，0 page errors。
- `win-unpacked` warm rerun：runtime `8542ms`，interactive `9635ms`，0 console errors，0 page errors。
- `Horosa-Setup-2.0.0.exe /S` 静默安装：exit code `0`，注册表显示 `星阙 2.0.0`，安装目录、主程序与卸载程序存在。
- 已安装 App 首启 smoke：runtime/renderer ready，0 console errors，0 page errors。
- 已安装 App warm rerun：runtime `8542ms`，interactive `9635ms`，0 console errors，0 page errors。
- 桌面快捷方式与开始菜单快捷方式均指向 `%LocalAppData%\Programs\Horosa\Horosa.exe`，工作目录和图标路径正确。

### 本轮确认无新增问题

- README 不再引用旧 `main-workspace.png` / `sanshi-workspace.png`。
- 当前发布说明、README、项目结构、citation 和 desktop package 元数据不再指向 v1.3.4。
- 当前发布目录不再保留旧 `Horosa-Setup-1.3.4.exe`。
- 根目录不存在 `Horosa-Web-App-comprehensively-improved-MacOS-main`。
- 代码、启动脚本和打包链路中未发现对旧 MacOS 同步来源文件夹的实际依赖；仅历史/说明文档中保留“不要依赖”的说明或旧迁移记录。
- 检查结束时未发现残留 `Horosa.exe` 或 `Horosa-Setup-2.0.0.exe` 进程。

## 2026-03-17 稳定版收尾与启动链路自检

本轮以“稳定版”为目标，重点完成以下整理与确认：

- 星盘相关下方面板的悬浮释义样式，已统一接入主盘同一套白底悬浮层
- Windows 启动器已改为默认快速启动模式，不再每次都强制扫描源码新鲜度
- Windows 启动器已补充服务复用与状态兜底逻辑
- Windows 启动器已补充 AppCDS 动态归档链路：首次训练、后续自动启用
- 本轮所有交付内容以稳定运行优先，避免引入需要用户额外理解的新入口

### 本轮关键自检结果

已完成并通过：

- `Horosa_Local_Windows.ps1` 语法检查
- 默认启动 smoke（AppCDS 开启）
- `HOROSA_APPCDS=0` 回退 smoke
- `HOROSA_CHECK_SOURCE_FRESHNESS=1` 兼容 smoke
- AppCDS 首次训练生成 archive
- AppCDS 第二次启动自动读取 archive

### 本轮确认无新增问题

未发现以下回归：

- `START_HERE.bat` 无法启动
- 关闭 AppCDS 后启动失败
- 开启源码新鲜度检查后启动失败
- 启动器因为 AppCDS 逻辑导致 Python / Java / 前端服务无法正常起来
- 星盘共享悬浮释义改动导致原有 tooltip 开关失效

### 本轮稳定版关键文件

- `START_HERE.bat`
- `local/Horosa_Local_Windows.ps1`
- `docs/PROJECT_STRUCTURE.md`
- `docs/SELFCHECK_LOG.md`
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/AstroObjectLabel.js`
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/astro/__tests__/AstroObjectLabel.test.js`

### 本轮稳定版运行记录摘要

最近通过的启动日志目录：

- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/.horosa-local-logs-win/20260317_174231`
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/.horosa-local-logs-win/20260317_174305`
- `local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/.horosa-local-logs-win/20260317_174340`

AppCDS 动态归档已成功生成：

- `%LocalAppData%\\Horosa\\runtime-cache\\55f8f8e47f4e\\windows\\appcds\\horosa-appcds-5c564233478ab4d839ce\\astrostudyboot-dynamic.jsa`

### 当前结论

- 这一轮可以作为 Windows 一键启动稳定版基线
- 启动性能已加入低风险优化与 AppCDS 加速，但冷启动主要瓶颈仍在后端初始化本身
- 如需继续压缩启动时间，应在当前稳定版基础上，谨慎推进更激进的 extracted / layered 后端运行方案

## 本轮根目录整理

- 根目录只保留一个给普通用户点击的启动脚本：`START_HERE.bat`
- 已移除根目录重复包装脚本：`START_HERE.ps1`、`Horosa_Local_Windows.*`、`Prepare_Runtime_Windows.*`
- `PROJECT_STRUCTURE.md`、`SELFCHECK_LOG.md`、`给完全不会的人看的启动说明.txt` 已移入 `docs/`
- `WINDOWS_CODEX_DECENNIALS_REPRO_PACKAGE/` 已作为临时复现参考包使用完毕，并在代码、自检、文档同步完成后删除，不再保留在交付根目录

## 这样整理后的目的

- 让普通用户打开根目录时，不会面对一堆不知道该点哪个脚本
- 保留完整说明文档，但把它们收进 `docs/`
- 复现参考资料只在实现阶段使用，完成后不继续占据交付目录

## 本轮检查结果

未发现以下问题：

- 根目录出现多个容易误点的启动脚本
- 说明文档路径失效
- 十年大运功能接线缺失
- AI 导出与 AI 导出设置漏接 `十年大运`
- `START_HERE.bat` 指向错误位置

## 当前交付状态摘要

以下内容已落实并保留：

- 主限法 Core-Alchabitius / Ptolemy / In Zodiaco 复现链路已接入 Windows 仓库
- `Horosa原方法` 仍保留为独立可切换方法
- AI 导出与主限法方法、度数换算字段已同步
- 本地启动链路已处理多副本端口切换、URL `srv` 参数、本地 backend 推导与 `cache` 规范化问题
- 三式合一页面已按最近调整缩小非核心文字、放宽左侧区域，并校正中宫四课三传的间距
- 十年大运页面、算法、测试、AI 导出和 AI 导出设置已全部接回当前工作区

## 2026-03-08 十年大运复现与自检

- 已按源码快照复现十年大运相关 5 个目标文件，其中新增 `AstroDecennials.js`、`decennials.js`、`decennials.test.js`，并补回 `AstroDirectMain.js`、`aiExport.js` 的接线
- 十年大运页面已确认包含 `起运主星`、`分配次序`、`日限体系`、`时间口径`；`时间口径` 只有 `360天/年（按30天/月换算）` 与 `365.25天/年（按回归年换算）`
- 两种时间口径都以具体日期为主显示；`360天/年` 模式额外显示 `名义：...` 辅助说明；`L4` 已显示到 `HH:MM`
- `AI导出` 与 `AI导出设置` 已同步支持 `推运盘-十年大运`
- 已完成并通过以下检查：`py -3 verification/verify_package.py`、`npm test -- --runInBand src/utils/__tests__/decennials.test.js`、`npm test -- --runInBand`、`npm run build`、`npm run build:file`
- 已按 `02_DETAILED_REPRODUCTION_GUIDE.md`、`03_ALGORITHM_SPEC.md`、`04_UI_AND_AI_EXPORT_SPEC.md`、`05_VERIFICATION_AND_ACCEPTANCE.md`、`06_EXPECTED_OUTPUTS.md` 逐条自检，未发现文档要求未落实的缺口
- 复现完成后确认该参考包不再参与运行、构建或交付，因此已删除 `WINDOWS_CODEX_DECENNIALS_REPRO_PACKAGE/`

## 本轮收尾状态

- 根目录现在更适合直接交给普通用户
- 详细说明仍可在 `docs/` 中找到
- 十年大运功能已并入正式工作区，不再依赖额外复现包
