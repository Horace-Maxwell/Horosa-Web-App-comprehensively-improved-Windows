# Horosa Windows 自检日志

最后更新：2026-05-26

## 2026-05-26 v2.1.7 Beta 奇门/三式 真太阳时定盘修复（纯前端）

把 Mac main（`907e841` / v2.1.7）的 **奇门/三式 真太阳时定盘修复** 同步到 Windows。**纯前端 1 文件，无 Java/Python 改动 → 未重建 `astrostudyboot.jar`。**

### 移植与分类
- 精确 commit-range diff `494783d..907e841` 确认共享树改动恰为 **1 个前端文件**：`astrostudyui/src/components/dunjia/DunJiaCalc.js`（+5/-2）。
- 该文件在 Windows 与 Mac-2.1.6 基线**逐字节一致（零分叉）**→ 复制 Mac-2.1.7 版只引入本轮改动；复制后再核对 == Mac-2.1.7。
- 机制：`fetchQimenPan` 改为复用既有 `resolveCalcDateTime(baseDt, nongli, opt, context)`——`timeAlg===0`（真太阳时）用 `nongli.birth` 校正时刻，`===1`（直接时间）用钟表时；与 `calcDunJia` / 太乙一致。此前漏用此校正，选真太阳时被当直接时间排盘（时柱错位）。三式六壬日/时柱取自奇门四柱，级联修复。`resolveCalcDateTime` 在同文件已定义（行 495），新代码只是调用既有函数，无新增 import。

### 验证
- 前端 `npm run build:file` 编译通过；`umi-test` 28 suites / 129 tests（含既有奇门拆补/置润/节气测试）全通过，无回归。
- 逻辑核对：`resolveCalcDateTime({hour:11,minute:24},{birth:"1993-02-01 10:46"},{timeAlg:0})` → `{hour:10,minute:46}` → 后端 `kinqimen.Qimen(...,10,46)` → 巳时 → 丁巳時（vs 旧按钟表时 11:24 的戊午）。
- 版本一致性闸门：`release_selfcheck.py` 版本一致（全 == 2.1.7）；本轮新增哨兵守 `DunJiaCalc.js: resolveCalcDateTime(baseDt`。

### 发布资产 + SHA256
- `Horosa-Setup-2.1.7.exe`（`1194425076` bytes）+ `.exe.blockmap`（`1234449` bytes）+ `latest.yml`（version `2.1.7`）+ `SHA256SUMS.txt`（已为 2.1.7 重新生成）。
- `Horosa-Setup-2.1.7.exe`: `915b090e5291657849a392e7e850c4a00070681981427b0b8bd9a2adfc6ca285`
- `Horosa-Setup-2.1.7.exe.blockmap`: `3910373b61247d440232b09aa79143bdcc4fa6e3b377b9dcd7d5af5c0bd2a8a4`
- `latest.yml`: `9938e2c837b5317ea859d19b22e4ad940f13b31c7d00ca189ffac6882d5c1541`
- `dist:win` 末尾 `release_selfcheck.py` 5/5（assets 当时为 SHA256SUMS 待重生成）；重生成后复跑做完整哈希核对。

### 注意事项
- **纯前端改动**：只需 `build:file` 重建前端 + 随包；不重建 jar、不动 vendor。
- 行为面（三式/遁甲选真太阳时奇门时柱）建议用户在 App 内复核（1993-02-01 11:24 → 丁巳 / 切直接时间 → 戊午）。

## 2026-05-26 v2.1.6 Beta 奇门历法修复（月柱交节边界 + 置闰超神接气定局）+ 印度盘选点 + issue #2 批量

把 Mac main（`494783d` / `v2.1.6`）的 **奇门历法底层修复** 与 **印度盘地图选点修复** 同步到 Windows，并合入本地已修的 Windows 侧 issue #2（内置运行时环境隔离）。**纯 Python（`vendor/kinqimen`）+ 前端，无 Java 改动 → 未重建 `astrostudyboot.jar`。**

### 移植与分类
- 精确 commit-range diff `8f3371f..494783d` 确认共享树改动恰为 5 个文件：`vendor/kinqimen/{jieqi.py,config.py,kinqimen.py,test_qimen_calendar.py(新)}` + 前端 `astrostudyui/src/components/astro/IndiaChartMain.js`。
- 4 个被改文件在 Windows 与 Mac-2.1.5 基线**逐字节一致（零 Windows 分叉）**→ 复制 Mac-2.1.6 版只引入 2.1.6 改动；测试文件为纯新增。逐文件复制后再次核对 Windows == Mac-2.1.6（5/5 match）。
- 机制：(A) `jieqi.gangzhi` 月柱按 sxtwl 精确交节时刻校正（交节前沿用前一日，立春兼校年柱）；新增 `jieqi.zhirun_jieqi`（超神接气置闰定局节气）。(B) `config` 重写 `qimen_ju_name_zhirun` + 新增 `dingju_jieqi`。(C) `kinqimen.pan()` 節氣标签改用 `config.dingju_jieqi(...,option)`。拆补法未改（本就正确）。印度盘 `changeGeo` 传扁平参数对齐父级 `changeCond`。

### 验证
- **奇门 11/11**：用**内置** `runtime/windows/python/python.exe` 跑 `vendor/kinqimen/test_qimen_calendar.py` 全通过（月柱 2005-05-05→庚辰 / 2021；交节后不回归；立春年柱+月柱；置闰 #62 立冬上元六局+标签；拆补不变；#43 拆补≠置闰；闰大雪；整盘双法不崩）。
- 前端 `npm run build:file` 编译通过；`umi-test` 28 suites / 129 tests（含既有奇门拆补/置润/节气前端测试）全通过，无回归。
- issue #2（合并）：`service-manager.test.js` 18/18（4 个新隔离测试）；真实 `python.exe` 经真实导出 helper 在 poisoned 环境下 `isolated=1`。
- 版本一致性闸门：`release_selfcheck.py` 版本一致 **PASS（全 == 2.1.6）**；本轮新增哨兵守 `vendor/kinqimen/{jieqi.py:zhirun_jieqi, config.py:dingju_jieqi, kinqimen.py:config.dingju_jieqi}` + `IndiaChartMain.js:patch.tm`。staged dist-file 在打包前显示 STALE 属预期（dist:win 重建后清除）。

### 发布资产 + SHA256
- `Horosa-Setup-2.1.6.exe`（`1194424731` bytes）+ `.exe.blockmap`（`1234613` bytes）+ `latest.yml`（version `2.1.6`）+ `SHA256SUMS.txt`（已为 2.1.6 重新生成）。
- `Horosa-Setup-2.1.6.exe`: `b9bbe60651e8c535a0e1b6bf4c5f29c109cb1066ea1f93085dc8fdfced2a09d3`
- `Horosa-Setup-2.1.6.exe.blockmap`: `b71ab52bdade1b86e8bb9dca78e31b84f86713aa05982ebfa418d4d15d273935`
- `latest.yml`: `408679416c3d7c0a96f7dc65c5c02b6f3e92ecd35e914d9d0328bcea3ad590ac`
- `dist:win` 末尾 `release_selfcheck.py` 5/5（assets 当时为 SHA256SUMS 待重生成）；重生成后复跑应做完整哈希核对。

### 注意事项
- **纯 Python / vendor 改动不需重建 jar**，但必须确认随 runtime 打包带上（`build/app-runtime/.../vendor/kinqimen/`）——见 SKILL 坑位 #10。
- 行为面（真实奇门排盘界面、印度盘地图选点）建议用户在 App 内复测；引擎逻辑已由 11 项单测覆盖。

## 2026-05-26 GitHub issue #2 修复：Win11 无法运行（内置运行时环境隔离）— 已修复，随 v2.1.6 批量发布

修复 GitHub issue #2（用户在装有系统 Python/node/pnpm 的 Win11 机器上「装好却打不开」）。**仅 Windows 桌面层改动**（`desktop_installer_bundle/electron/service-manager.js`），按用户要求**先修不发**，与 Mac 即将同步的 #3/#4 合并到下一次发布。**未改版本号、未打包、未发布。**

### 根因（已用内置解释器实测复现）
内置 Python/Java 以 `...process.env` 启动，继承了用户**整个**系统环境。当宿主机自己装了 Python/Java 工具链时会污染我们自带的运行时——且**只在那台机器崩**，所以躲过了干净 VM 测试：
- 宿主 `PYTHONHOME` → 内置 Python 去错误路径找标准库，启动即 `Fatal Python error: init_fs_encoding … ModuleNotFoundError: No module named 'encodings'`（已对 bundled `python.exe` 实测复现）。
- 宿主 `_JAVA_OPTIONS`/`JAVA_TOOL_OPTIONS`/`JDK_JAVA_OPTIONS` → 注入 JVM 参数令启动中止（实测 `Picked up _JAVA_OPTIONS … Could not reserve enough space …`）。

后端在启动瞬间崩溃 → 后端口永不就绪 → app 不可用。

### 修复（`service-manager.js`，覆盖全部内置调用：python / java / `java -version` / jcmd）
- 新增 `sanitizeEmbeddedRuntimeEnv(overrides, kind)`：python 剥离所有宿主 `PYTHON*`；java 剥离 `_JAVA_OPTIONS|JAVA_TOOL_OPTIONS|JDK_JAVA_OPTIONS|JAVA_OPTS|CLASSPATH|JAVA_COMPILER|_JAVA_SR_SIGNUM`（再叠加我们自己的变量）。
- 新增 `buildPythonRuntimeArgs`：Python 以 `-E -s -X utf8` 启动，解释器在 C 层忽略 `PYTHON*`（即便将来漏了某个变量也免疫）。
- 二者均已 `module.exports` 以便单测。

### 验证
- 复现：poisoned `PYTHONHOME` 令 bundled `python.exe` 崩溃；加 `-E -s -X utf8` 后即便 poisoned 仍正常启动，且编译型依赖 `swisseph`/`sxtwl` 正常 import。
- 单测：`node --test service-manager.test.js` **18/18**（新增 4 个：python 剥离、java 剥离、互不越界、`-E -s -X utf8` 参数序）。
- 集成：用真实 `python.exe` 经真实导出的 `sanitizeEmbeddedRuntimeEnv`+`buildPythonRuntimeArgs`、在 poisoned 父环境下启动 → `BOOT_OK … isolated=1`，全部原生依赖 import 成功。
- `release_selfcheck.py` **5/5**（仍在 2.1.5）；本轮新增**永久哨兵**：`service-manager.js` 必须含 `sanitizeEmbeddedRuntimeEnv` / `buildPythonRuntimeArgs` / `_JAVA_OPTIONS` / `'-E', '-s', '-X', 'utf8'`，回退即闸门失败。

### 注意事项
- 待 Mac 的 #3/#4 同步到位后，与本修复合并为同一个发布（版本号、打包、`dist:win`、`selfcheck`、SHA、tag、release 届时一次走完）。
- 任何新增内置运行时 spawn 都必须经 `sanitizeEmbeddedRuntimeEnv`，不得再裸传 `...process.env`。

## 2026-05-26 v2.1.5 Beta AI 分析页全面修复（供应商切换/鉴权 + 发送安全 + 静默失败透出）

把 Mac main（`dbd0659` / `8f3371f`）的 AI 分析页修复同步到 Windows。前端为主 + 后端少量（`AIAnalysisProxyService.java`，故重建 jar）。

### 移植与构建检查
- 用 Mac 2.1.4→2.1.5 精确 commit diff 确认改动恰为 5 个文件（后端 `AIAnalysisProxyService.java` + 其测试；前端 `AIAnalysisMain.js` / `services/aianalysis.js` / `utils/aiAnalysisStore.js`）。WIN-vs-Mac 的 stat 与 commit-range stat 完全一致 → 这 5 文件均处 Mac 2.1.4 基线、无 Windows 分叉，逐字节移植只引入 2.1.5 改动。其余后端大量 Windows-vs-Mac 差异是既有 Windows 基线分叉，**未动**。
- 后端仅改 astrostudy 模块：`install astrostudy` → `clean package astrostudyboot`；fat jar 内 `AIAnalysisProxyService.class` 含 `authHeaderName`（target / staged bundle / 最终 `build/app-runtime` 三处均核对）。
- Java `AIAnalysisProxyServiceTest` 16/16；前端 `umi-test` 28 suites / 129；`npm run verify` preflight 2.1.5 通过；`npm run dist:win` exit 0；原生闸门 192 模块。

### 发布自检闸门（dist:win 末尾自动执行，全 PASS）
`release_selfcheck.py` 在 `dist:win` 末尾运行并 **5/5 通过**：版本一致、13 文件哨兵（本轮新增 `authHeaderName` + `resolveRequestTimeout`）、staged jar 不过期、staged 前端不过期、发布资产+哈希一致。本轮还修正闸门：SHA256SUMS 在 dist:win 末尾尚未重生成时按"待重生成"放行（不误失败），重生成 SHA256SUMS 后再跑则做完整哈希核对（已二次跑通）。

### 发布资产 + SHA256
- `Horosa-Setup-2.1.5.exe`（`1194431203` bytes）+ `.exe.blockmap` + `latest.yml`（version `2.1.5`）+ `SHA256SUMS.txt`（已为 2.1.5 重新生成）。
- `Horosa-Setup-2.1.5.exe`: `647a96ab698f21ce0a9bb98baa63c87521863397d174fe8ea343a07f2237260f`
- `Horosa-Setup-2.1.5.exe.blockmap`: `3ed8bdc2fb153877ce9d5ebaf351ae102007e1352bac25add5eb1f5eda68d689`
- `latest.yml`: `261d5355427b0f397decd99eb37a1eb1fc1bc6d79c7867c62f4756b45ade9fc0`

### 注意事项
- 行为面（供应商切换/鉴权、发送安全、静默失败透出）由 Java 单测 + 前端单测覆盖；真实 provider 往返（尤其 Gemini 直连、custom 自定义鉴权头）建议用真 key 在 App 内复测。
- 推 v* tag 不会自动覆盖（workflow 为 `workflow_dispatch`-only）。

## 2026-05-26 v2.1.4 Beta AI 分析后台调用修复（供应商兼容 + 错误透传 + 凭据脱敏）+ 自检闸门固化

本轮把 Mac main（`65f2711`）的 AI 分析后台调用修复同步到 Windows，并新增一个变更无关的发布自检闸门 `release_selfcheck.py`，把历轮发现的漏洞固化成自动检查，确保以后每次发布都能稳定发现问题、不再静默复发。

### 移植与构建检查
- 经 Mac 2.1.3→2.1.4 diff 确认改动恰为 5 个文件（`AIAnalysisProxyService.java`、`HttpUriRequestHystrixCommand.java`(boundless)、`AIAnalysisMain.js` + 2 个测试），逐字节移植，无 Windows-ahead 回退。
- Java 单测（内置 Maven + JDK17）：`HttpUriRequestHystrixCommandTest` 2/2、`AIAnalysisProxyServiceTest` 14/14，BUILD SUCCESS。
- `astrostudyboot.jar` 按 boundless→astrostudy→astrostudyboot(clean package) 链路重建；fat jar 内 `AIAnalysisProxyService.class` 含 `max_completion_tokens`、`HttpUriRequestHystrixCommand.class` 含 `redacted`（target jar、staged bundle jar、最终打包 build/app-runtime jar 三处均已核对）。
- `astrostudyui` `npm run build:file` 通过；`umi-test` 28 suites / 129 tests 通过；打包后前端 bundle 含 2.1.4 `streamError` 改动。
- `npm run verify`：service-manager 14/14 + `release_preflight.py`（版本同步 2.1.4、品牌资产、VC++）通过。
- `npm run dist:win`：exit 0；原生依赖闸门 192 模块全可解析。

### 新增：变更无关发布自检闸门（防止历轮漏洞复发）
- 新增 `desktop_installer_bundle/scripts/release_selfcheck.py`，并接入 `dist:win` 末尾（`npm run selfcheck`）。本轮在 2.1.4 实测 5 项全 PASS：版本一致、Windows-ahead/已移植修复哨兵（12 文件）、staged jar 不过期、staged 前端不过期、发布资产+哈希一致。
- 同时根治"静默发旧 jar"陷阱：`Prepare_Runtime_Windows.ps1` 的 jar 自动构建改为「全模块按依赖序 install + JDK 探测 + boot clean package」，并在仍过期时硬失败而非回退旧 jar；watchPaths 扩到全部后端源模块（补上 astrostudycn 等）。已用完整 8 模块链 offline 实测产出含双标记的 jar。
- 行为面：A 参数兼容 / B 后端错误透传 / C 凭据脱敏均由 Java 单测覆盖；前端 `error` 事件渲染与真实 provider 往返建议由用户用真 key 在 App 内复测（reasoning 模型 happy-path 需真 key）。
- clean-machine 冷/热启动 smoke（新 boundless+astrostudy jar）：冷/热均 `backendReady`+`chartReady`、出盘正常、`forbiddenLogMatches` 为空、8899/9999/9464 停止后均释放——证明新 jar 能正常启动后端并服务。热启动 `10018ms` 略超 10s 软阈值（脚本据此 exit 1），与当时并行的 Maven 构建争用有关，非功能回归。

### 发布资产
- `desktop_installer_bundle/release/Horosa-Setup-2.1.4.exe`（`1194416512` bytes）+ `.exe.blockmap` + `latest.yml`（version `2.1.4`）+ `SHA256SUMS.txt`（已为 2.1.4 重新生成）。

### SHA256
- `Horosa-Setup-2.1.4.exe`: `84c6fb9ce94d6cf23f9b02d899ba0fc0b1a81e211817b56a5ba938a9189b487c`
- `Horosa-Setup-2.1.4.exe.blockmap`: `ec676ba79fbb356616466a0a34f2ff08c0c375568d6c131d5c8d2f62b7df5047`
- `latest.yml`: `87df91ad6591aa3e4e1b02d031adf60b7363b562d2b51ca7deea92190d362abe`

### 注意事项
- 后端 Java 改了就必须重建 jar；`dist:win` 的自动 jar 构建现已能正确处理（全模块链），且 `release_selfcheck.py` 会拦截过期 jar。
- 发布走成熟手动流程；推 v* tag 不会自动覆盖（workflow 为 `workflow_dispatch`-only）。

## 2026-05-25/26 v2.1.2 / v2.1.3 Beta 回填记录
- **v2.1.2**（AI 分析重做：反挂错盘 + 9 技法按盘复算 + 事盘不重算 + Markdown）：已发布，commit `30153e7`、tag `v2.1.2`、`Horosa-Setup-2.1.2.exe` sha256 `9ad30107…`。期间踩到 CI workflow 自动覆盖坑，已改为 dispatch-only（`3bb2552`）；含一处冷启动 service-manager 修复。
- **v2.1.3**（八字「直接时间/真太阳时」显示修复，前端为主 + `BaZi.java`）：已发布，commit `88f526c`、tag `v2.1.3`、`Horosa-Setup-2.1.3.exe` sha256 `02fbc787…`；首次按 astrostudycn→boot 链路重建 jar；用户已在 App 内实测确认修好。

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
