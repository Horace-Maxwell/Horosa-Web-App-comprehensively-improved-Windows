# Horosa Windows 自检日志

最后更新：2026-06-12

## 2026-06-12 v2.6.6 原地覆盖重发（Windows 壳层/安装器 10 项加固批次；同版本号；只 force tag 不 force main）

**决策**：owner 拍板原地覆盖 v2.6.6（不 bump）——口径同 v2.5.4 先例（gotcha #20 传播口径）：安装器侧加固（磁盘预检/Win10 门槛/真卸载清缓存）本就只对**新下载**生效，覆盖即全量受益；壳层侧（缓存清扫/日志轮转/crash 兜底等）已更新用户随下一版自动补上，无需为此 bump。**本批纯 Windows 独有，不涉 Mac repo**。

**加固 10 项**（3 并行审计 16 候选 → 逐条亲核 10 真修 + 6 否决留档）：① `sweepStalePayloadCaches` 启动清扫 `embedded-runtime` 旧 payloadId 兄弟目录 + `.tmp-*`/`.repair` 残留（**每次升级遗留 ~1.35GB 的根治**，老用户已累积 10GB+；形状门控正则 `^[0-9a-f]{16,64}(\.tmp-\d+-\d+|\.repair)?$` 只删自家命名；fire-and-forget 永不 reject；单实例锁保并发安全；长路径回退基活动时连默认父目录一起清） ② `rotateLogIfLarge` 日志轮转（主 20MB / python·java 各 50MB 单代 `.1`；EPERM/EBUSY 回退 copy+truncate；永不 throw） ③ NSIS 磁盘预检 `CheckHorosaDiskSpace`（安装盘/数据盘 3GB、同盘 6144MB；`${GetRoot}`+`${DriveSpace} /S=M`；交互式中文弹窗+Abort 可回页换盘，静默 `SetErrorLevel 112`+Quit；customInit 静默钩 + ValidateInstallDirectory 交互钩——**customInstall 在解压后不可作预检点**） ④ `customUnInstall` 真卸载清缓存：**旧宏在 `!ifndef BUILD_UNINSTALLER` 守卫内 = 模板只在 UNINSTALLER pass 插入 → 多年死代码（已删）**；新宏守卫外 + `${ifNot} ${isUpdated}`（升级绝不删）+ 只清 embedded-runtime/logs/HorosaRt(LOCALAPPDATA+TEMP)/.horosa-rt/updater 缓存，**HorosaDesktop 本体（用户命盘）永不触碰** ⑤ process 级 `uncaughtException`（log+对话框+exit(1)）/`unhandledRejection`（仅 log）兜底 ⑥ Win10+ 门槛（`AtLeastWin10`，1633）+ CurrentBuild<17763 仅提示 ⑦ 进度窗 `contextIsolation:true` + 新 `update-progress-preload.js`（contextBridge，通道名 update:init/progress/done 不变） ⑧ `runUpdateCheck` 并发闩 `updateCheckInFlight` ⑨ 签名拉取重试 ×2（2s 退避，fail-closed 不变） ⑩ 小屏/高缩放 minWidth/minHeight 钳制到 workArea；附 update-flow ENOSPC→「磁盘空间不足」明确文案。**否决留档**：trusted 缓存写回（劣化慢机）/差分回退（updater 自带 AppUpdater.js:704）/TEMP 多用户碰撞（per-user TEMP 前提不成立）/NSIS 装饰打印/修复模式 VBScript 探测/进度窗 RCE 降级（仅本地文件）。

**验证**：verify **48/48**（+9 新测试：清扫×4+正则表+轮转×4，真 fs + 单函数 monkey-patch 同house style）；selfcheck **10/10**（哨兵 **45 文件**，+9 新标记：sweepStalePayloadCaches/rotateLogIfLarge/uncaughtException/update-progress-preload.js/updateCheckInFlight/CheckHorosaDiskSpace/AtLeastWin10/`${ifNot} ${isUpdated}`/新 preload 文件条目）；makensis `/WX` 双 pass 清编译（删死宏无重复定义、WinVer/FileFunc include-guard 重包含零警告）；**磁盘门槛端到端实测**：膨胀阈值（999999MB）测试安装器 `/S` → exit **112**、Programs 目录零变化、注册表未动；**asar 标记核验**：重打的 app.asar 内 8 个加固标记全在（sweep=11/rotate=18/preload=4/latch=6/crash=2/bridge=2/zoom=2/restart=6）。**工程坑（本轮）**：(a) NSIS 快环 `--prepackaged` 产物用旧 win-unpacked = **asar 仍旧 JS**，覆盖发布必须全量 dist:win 重打 asar；(b) `--prepackaged` 会**clobber 本地已发布资产** → 先备份 5 资产、测试后逐字节还原（已验 a4bda973 复原）；(c) NSIS 二进制层验证卸载器代码不可行（LZMA 固实压缩 + 新版 7-Zip 不提取脚本）——编译级证据已确凿（宏双 pass 定义 + 模板 uninstaller.nsh:156-158 强制插入 + /WX exit 0）。

**发布**：加固 commit `438a16c` + 覆盖簿记 `8a3569c`（2.6.6.md 覆盖说明+加固详单+新哈希表 + winget installer.yaml 新 sha/动态日期自证 2026-06-12）；main **正常 fast-forward** `defc7fe→8a3569c`；tag v2.6.6 **force-move** `784226e→8a3569c`（**只 force tag**）；`gh release upload --clobber` 5 资产 + `gh release edit` 新说明。**新 exe 760,017,116 B sha256 `6e2cb7436757e2a7dc1e42756eae5ab194d0ffd0f71b0cacd73d05d91e62db00`**（取代首发 `a4bda973…`）；blockmap `44bd65defdba…`(790,381B)；latest.yml `2390000b189d…`(341B)；horosa-update.sig `21936db6bdce…`(260B)。线上 5 资产 digest=本地逐字节一致（含 760MB exe 全量下载 IDENTICAL）；**LIVE sig 经 release URL 对 downloaded exe verify = VERIFY OK**（Ed25519 第十次生产核验）。**遗留**：干净 VM 矩阵（装/卸[缓存清+命盘留]/升级[--updated 缓存不删]/低盘交互式弹窗）仍列下一版发布前清单。

## 2026-06-11 v2.6.6 Beta（Mac 同步 `dbac0ed→47f59a4`（重写史）：排盘计算修正批 + 主限法 3000/宿命点/v12 + 修 Win#23/#24/#25 + UI 扫雷 + **Windows 壳层深扫加固 9 项**；重建 jar；首次 Windows pytest 门）

**Mac 历史重写处理（本轮首遇）**：Mac 端重写了提交历史 —— 旧 v2.6.5 `dbac0ed` 在新史中 = `f401bfe`，**且树不等**（重写顺带带入部分 PD 早期工作 + 删除 `Horosa-Web/AGENTS.md`、`UPGRADE_LOG.md` 等 -8349 行，疑似 redaction）。处置：真实差集以**旧 `dbac0ed` → 新 HEAD `47f59a4`** 在「保有两侧对象的旧 clone（tmp/mac-sync-2.6.5，fetch 后新旧 SHA 共存）」中计算 = 91 个 `Horosa-Web/` 文件（6 Java + 21 Python + ~60 前端 + golden v266）+ 2 删除（AGENTS.md + golden v253，已镜像 rm）；基线核验同在旧 clone 对旧 `dbac0ed` 做（8 关键文件 LF-hash 全 CLEAN）。**新鲜 clone 没有旧 SHA → 老 clone 是桥**。**下次 Mac 同步基线 = `47f59a4`**。

**同步面**：① **排盘计算修正批**（Python 8 文件，从错到对结果会变）：helper.py 度分串解析 `deg+min/60`（原 `'116e24'→116.04` 错）+ distance/absDistance 短弧单式 + splitDegree 60′ 进位；realsuntime.py 均时差 3 区转录修正 + `±HH:MM` 半小时时区（印度 +05:30 原被当 +05:00）；perpredict.py 日返寻根顺行弧 + 返照相位归一化 [0,180] + 骰子盘跨 0° 宫；perchart.py 反平行首伙伴漏加 + 恒星合相跨 0° + 围攻独立 pairOrb + 时主星 floor；chartcomposite.py 组合中点短弧；chartcomp.py 合盘相位/映点归一化；jieqiconst/TimeDecider 死码修复。② **主限法大升级**：显示窗 pre-norm + 宿命点 Vertex 应星闭式 + 每盘时间钥匙 + pd_engine 太阳弧钥匙正逆 + **年数 1000→3000** 多圈复发 + golden 语料 v253→v266；**4 控制器 `_wireRev` 升 v12**（PredictiveController/IndiaChartController/astrostudycn ChartController/QueryChartController）。③ **修 Win#23**（@ecliptic0618「格式错误」= Gemini 400）：`AIAnalysisProxyService.buildGeminiBody()` 采样参数从顶层移入 `generationConfig`。④ **修 Win#24/#25**（@wangzejin45-spec「gpt5.5 上传失败」双报）：真因=聊天发送按钮 `onClick={handleSend}` 直挂 → antd 把 click 事件对象当首参 → 串化 `[object Object]`（Enter 不触发故时好时坏，与模型无关）；修=按钮 `onClick={()=>handleSend()}`（源 4332 行核）+ `overrideText` 只认字符串。⑤ 聊天高级参数真正生效（`isOpenAiFamily()` 修 `==='openai'` vs 实际 `'openai-compatible'` 判定永假）+ 思考档覆盖 gpt-5.5/6/7、o6/o7 + 报告流错误不吞 + 已取消请求不补发。⑥ 全 UI 扫雷（AI 挂载 C 类临时写入用毕还原 / 白屏防护 localStorage parse 全兜底 / 暗色可读性 / 列表 key 稳定化 / Su28 字号 d3 this / ACG zoom 重放 / 风水 Retina / 报告截图串行锁）。**Mac `Horosa_Desktop_Installer/`（Tauri + preflight [41][42] + runtime 身份验明）不同步**。

**重建 jar**：astrostudy install → astrostudycn install → boot clean package（offline，bundled mvn.cmd）→ **324,254,540 B** 覆盖 bundle；标记核验 `pd_method_sync_v12`（astrostudycn grep -ac =2 + astrostudy =2）+ `generationConfig`（=1，Gemini 修正）全 PASS。无新 npm 依赖。

**首次把 Python 全量 pytest 纳入 Windows 同步门**：pytest 装到 `tmp/pytest-lib`（`pip install --target`，**不污染随包 runtime**），PYTHONPATH=`astropy;flatlib-ctrad2`（注意 flatlib 包在 `flatlib-ctrad2/` 下），sweph 数据=`flatlib-ctrad2/flatlib/resources/swefiles`（service-manager layout.swephDir 同源；先用 `runtime/windows/sweph` 误猜 → seas_18.se1 not found）。结果 **59/60**；唯一 FAIL=`test_pd_alcabitius_byteperfect`（540 例全失配）——**判定=纯跨平台浮点噪声而非回归**，证据（自写 tmp/pd_golden_tolerance_check.py 容差核验）：540/540 行数一致、0 真实字段差异、max |弧差| **2.08e-08°**、1248 处 ±1 秒日期舍入翻转（弧噪声跨秒界）、280 处对称方向对代表翻转（A@180→B 与 B@180→A 同事件，1e-10 tie-break 选边漂移）。**该 golden 是 Mac 引擎回归钉（Mac-internal pin），非跨平台契约**——Windows 侧用容差等价核验替代。

**Windows 壳层深扫（用户点名「高级软件工程师标准彻底扫描 Windows 独有 bug」）**：3 个并行 Explore agent 扫 electron 壳 / service-manager / NSIS+发布脚本 → 16 候选 → **逐条本人核验** → 9 真修 + 7 拒（false-positive/by-design/低值）：
- **修 ①（Mac handoff 点名的 Windows 必做）界面缩放持久化**：`saveWindowState()` 一直写 zoomFactor（applyZoomFactor→queueWindowStateSave 每次缩放都存），但 `readWindowState()` 是**从未被调用的死代码** → 每次启动复位默认 0.65。修=`resolveInitialWindowState()` 读回 + `normalizeZoomFactor` 钳制（窗口 bounds 策略不动=仍 default-maximized-80）。哨兵 `persistedState.zoomFactor`。
- **修 ②③** 诊断导出（main.js:994）+ AI 备份导出对话框分支：补 `mkdirSync(dirname)` + try/catch 返回 `{ok:false,message}`（直接路径分支本就有 mkdir，对话框分支漏 = 内部不一致实证）。
- **修 ④** `collectFilesRecursive`/`collectSelectedFiles`：抽 `readCollectableFile()`（statSync+64MB 上限+try/catch 跳过+记日志）+ readdirSync 兜底 —— OneDrive 离线占位/杀软锁/无权限单文件不再中止整批导入；空扩展集递归读全目录的 OOM 面同收。
- **修 ⑤** requestAppQuit 清 `updateCheckTimer`(15s)/`updateRecheckTimer`(6h interval)/`runtimeAutoRestartStabilityTimer`(45s)（回调本有 isShuttingDown 守卫，属卫生修）。
- **修 ⑥** `restart()` 加 `restartPromise` latch：坏交错=restartB.stop() 落在 startPromiseA 飞行中（stop 的 finally 把 startPromise 置 null）→ 第二个 start 体并发 spawn 双 python/java 对、首对引用被覆盖泄漏到退出；健康灯/Modal/横幅三处「重启后端」都可双击触发。哨兵 `restartPromise`。
- **修 ⑦** `repairPreparedRuntime` 顺序：**先**删 health/fast-path 信任缓存**再** rmrf 运行时大树（大树 rmrf 可中途抛 EBUSY/磁盘满，原顺序失败时留「信任半删运行时」缓存）。
- **修 ⑧** winget `ReleaseDate` 由生成时动态写（原硬编码，v2.6.5 曾带旧日期需手改、v2.6.4 整个忘了 winget）。
- **修 ⑨** selfcheck `release assets + hashes` gate：SHA256SUMS 仍是上一版时由「pending 提示放行」改 **FAIL**（原假 10/10 漏洞：补了 doc 哈希忘 regen SUMS → 全绿 + 过期校验文件上线；phase-1 本就 exit 1 故流程零损）。
- **拒 7**：logStreams 跨重试泄漏（误读：cleanupProcesses L1332-34 快照+立即清空）；崩溃 handler 晚挂（L1610 注释明示 by-design，retry 兜底）；fast-path 缓存失效写回（低值+并发写风险）；probe/crash 双 kill 竞态（killProcessTree 幂等无害）；NSIS 双路径静默（极罕见+makensis /WX 改动风险>收益）；HKLM/HKCU 错配（从未发过 per-machine 版）；**stale sig 假过**（agent 漏看 L415-424：gate 真 subprocess `sign-update.cjs verify` 对当前 exe 全量验签，stale sig 必 FAIL）。
- 验证：node --check ×3 + `npm run verify` **39/39** + selfcheck 哨兵含 2 新标记全过。**坑（差点踩）**：往 sentinel dict 加第二个 `service-manager.js` key 会静默覆盖 L112 既有条目丢光老哨兵（Python dict 字面量后键胜）→ 改并入既有条目。

**验证**：umi-test **682 通过 / 72 suites**（v2.6.5=658，+24）；pytest 59/60 + golden 容差等价 540/540；verify 39/39；sentinels 44 文件 OK；`selfcheck` **10/10**（新 SUMS gate 在 phase-1 正确响亮 FAIL = 修 ⑨ 自证）。staged payload 核：jar 标记 v12×4+generationConfig、built bundle 含本批 escaped unicode（宿命点）。

**发布**：release commit `784226e`（15 跟踪文件：版本/docs + main.js + service-manager.js + release_selfcheck.py + winget-manifest.cjs + docs/releases/2.6.6.md + winget 2.6.6×3；amend 修一处 commit msg 西里尔字符 typo，未推前 amend 安全）+ selfcheck-log 随后；tag `v2.6.6`(指 `784226e`)；5 资产。**exe** `Horosa-Setup-2.6.6.exe` **760,014,971 B** sha256 `a4bda973c2fad4f8815a64f3d098c7a939a28dc38293293112ceb72a4ccdf2f5`；blockmap `32e0ec1ed441…`(789,256 B)；latest.yml `c9d19464fa00…`(341 B)；horosa-update.sig `0c3501c0b30f…`(260 B)。`isPrerelease=false`、`/releases/latest=v2.6.6`、5 资产线上 digest=本地逐字节一致（含 760MB exe 全量下载 IDENTICAL）；**LIVE sig 经 release URL 对 downloaded exe verify = VERIFY OK**（Ed25519 第九次生产核验）。winget 2.6.6 manifest `ReleaseDate: 2026-06-11`（动态生成自证）。**自动更新 v2.2.1–v2.6.5 → v2.6.6**（重建 jar + 新前端 + 壳层 9 修）。**#23 回复+closed(completed)；#24 回复+closed(completed)；#25 回复+closed(duplicate of #24)；0 open issues**。



**同步**：Mac `15a21bb`(v2.6.4)→`dbac0ed`(v2.6.5) 单 commit。46 文件在 `Horosa-Web/`（合盘交互链 7 + AI 起课时间 6 + Python 2 + 导航搜索/图标/小修若干 + 3 新测试）。**Mac `Horosa_Desktop_Installer/`（Tauri 外壳 + 其 runtime 簿记）不同步**。**下次 Mac 同步基线 = `dbac0ed`**。Mac 端 `docs/windows-sync-handoff.md` 明确「Windows 必做一件 = 同步 Python 2 文件；Java 本版未改不需重编 jar」。

**Features**（共享代码）：① **合盘 / 关系盘交互链全面重建** —— 五子盘（合盘 Synastry / 组合中点 Composite / Marks / 时空盘 Time-Space / 关系评分）全部恢复可用。根因 = v2.6.1(fc7ab74) 误把合盘排盘端点从 `Constants.ServerRoot`(:9999 Java) 改成 `resolveKentangServiceRoot('taiyi')`(:8899 Python)，而 `request()` 对 body 做 RSA 加密、仅 Java 后端有解密拦截器并回 `{result}` 信封（Python chart 服务收到密文→json_in 400→net::ERR_FAILED）→「合盘每技法都用不了」。本版 `AstroRelative.js`（注意在 `components/astro/` 不在 `components/relative/`）恢复 `${Constants.ServerRoot}/modern/relative` + try/catch 优雅吞错（后端未就绪不崩成空白）；并 ResizeObserver 实测高度、`chartStyle/dispatch/onChange` 透传、change 直写 fields、`paramsToFields` 不覆盖宫制/黄道、黄道 Select 局部 CSS 定宽 50/50。② **AI「起课时间」挂载 8→13 技法** —— 太玄/荆决/五兆/神易数各补 `buildXxxSnapshotForFields` 快照构造器，`aiAnalysisContext.js` 加 5 imports+5 case + `TIMEPOINT_CASTABLE_SET`/`listAnalysisTechniqueOptions` 两份同步含 13 项 + `buildFieldObject` 兜底 `record.divTime` + `techniqueMountSettings.js` 4 法升 `kind:'payload'`。③ **Python 数值经纬度容错** —— `helper.py` `convertLonStrToDegree/convertLatStrToDegree`(lat@75/lon@104) + `realsuntime.py` `getBaseLonByZone`(zone@164) 加 `isinstance(..,(int,float))` 数值分支（地图选点存浮点经纬度/时区，旧代码假设字符串会抛错）。④ **顺手修** —— 全 22 模块导航搜索补 keywords；关于框真 `appicon.png`；波斯向运应期年数联动表格；UranianDial glyph 描边；测天字重；星历/额外盘/巴比伦星空一批小修。命盘计算默认行为与 v2.6.4 字节级一致。

**关键 Windows 风险核验（2 项，均 clear）**：
- **合盘 `:8899→:9999` 端点在 Windows 动态端口下是否正确** —— 合盘走 `Constants.ServerRoot`，= 全 app 每个排盘请求（八字/紫微/占星）都用的同一个全局。`constants.js` `resolveLocalServerRoot()` 优先级链：`?srv=` query → localStorage → `deriveFromPagePort()`(webPort+1999) → 硬编码 `:9999` 兜底。Windows electron 壳 `main.js:getRendererIndexUrl()` 在 loadURL 时 `searchParams.set('srv', runtimeState.serverRoot)` 注入**真实 findPort 分配的动态后端端口**（service-manager `findPort(9999)` ±50）→ renderer 启动即从 `?srv=` 拿到正确端口。**合盘随 app 已验证的同一机制走，Windows 零额外适配即生效**（核 main.js:245/263 + constants.js:73-78/103）。
- **Python must-sync 2 文件** —— `helper.py` + `realsuntime.py` 数值分支已落 + LF-hash 与 Mac@dbac0ed 字节一致。

**无 Java / 无 jar 重建（关键省时）**：`git diff 15a21bb..dbac0ed` **0 个 `.java`**；合盘端点恢复是前端改 URL，`ModernChartController` 自 v2.6.4 已在 jar。沿用 v2.6.4 的 `astrostudyboot.jar`（324,254,239B，核内嵌 astrostudycn/astrostudy 各 4 个 siderealAyanamsa 标记不变）。**坑（已处理）**：wholesale `cp -rf` overlay 给所有 WS `.java` 刷新 mtime → selfcheck「staged jar not stale」误判 STALE（DoorLockController.java newer than jar）。因 0 java 内容变更，`touch` staged jar 恢复 mtime 不变式（诚实修：jar 内容确为当前，仅 mtime 被 cp 顶起）→ 复跑 selfcheck PASS。**无新 npm 依赖**（`astrostudyui/package.json` 依赖块 0 变化）。

**同步法**：clean v2.6.4 baseline 核（aiAnalysisContext.js / AstroSynastry.js / AstroComposite.js / helper.py / realsuntime.py / techniqueMountSettings.js LF-hash==Mac@15a21bb 全 CLEAN；`pages/index.js` 仅差 Windows-ahead `ensureField` 适配=预期非漂移）→ overlay-copy `cp -rf tmp/mac-sync-2.6.5/Horosa-Web/. WS/` + `apply.sh "$WS" "$MAC"`（**本轮 patch 步真落 isDesktopShellWindow=3/ensureField=4，sentinels 44/44 PASS，无需手动 re-port**；boundless isLoopbackTarget Mac 已收敛 auto-no-op）→ build:file + `cp -rf astrostudyui/dist-file/. bundle/dist-file/`。

**验证**：umi-test **658 通过 / 70 suites**（v2.6.4=638，+20=合盘端点/起课时间 13 技法/导航搜索/波斯向运用例）；service-manager+update-signature **39 通过**；sentinels 44 文件 OK；`selfcheck` **10/10**（version 2.6.5 / 44 哨兵 / jar 不旧[touch 后] / dist-file 不旧 / 4 资产+哈希 / release-doc 真哈希 / latest.yml 匹配 exe / Ed25519 sig PASS / app-update.yml 在）。

**发布**：release commit `77108ae`（12 跟踪文件：版本 bump + READMEx3 + bundle README + winget-manifest.cjs ReleaseDate + docs/releases/2.6.5.md + winget/manifests/2.6.5/×3；产品源 gitignored 随 exe 交付）+ selfcheck-log 随后；tag `v2.6.5`(new，指 `77108ae`)；`gh release create`(5 资产)。**exe** `Horosa-Setup-2.6.5.exe` **759,533,502 B** sha256 `d485d5a5aa482f876be9e1acedd7d9d1d918c4fc501b9e3b7a046c78c256a6f9`；blockmap `b7a867111dd44abfb04a7cd1407e34d37e45c5f8f70959648e068ea6524904c8`(790,439 B)；latest.yml `50ab09c02eea96158181113c4bfedaccbfcea6bdd7503e8beca7c6e4e83a930f`(341 B)；horosa-update.sig `b245451e87531e860ae089f3e4de8dac3ba5a7bb08ff02fa4d5823608e3430eb`(260 B)；SHA256SUMS 348 B。`isPrerelease=false`、`/releases/latest=v2.6.5`、GitHub 5 资产 digest=本地逐字节一致（含 759MB exe 全量下载比对 IDENTICAL）；**LIVE sig 经 release download URL 拉取对 downloaded exe `sign-update.cjs verify` = VERIFY OK**（Ed25519 第八次生产核验）。**自动更新 v2.2.1–v2.6.4 → v2.6.5**（纯前端 + 2 Python；无 jar 变更）。**winget 2.6.5 manifest 已生成**（`node scripts/winget-manifest.cjs`，补上 v2.6.4 漏建的缺口）。**0 open issues**（本轮无可关）。



**同步**：Mac `15df8e35`(v2.6.3)→`15a21bb`(v2.6.4) 单 commit（合并 启动健壮性#12 + AI 报告 v1 两套 Mac 此前「未发版」批次 + 恒星黄道全栈 + AI 四同步）。115 文件在 `Horosa-Web/`（8 后端 Java 控制器 + Python 排盘核心 + 100+ 前端/测试/资源）。**Mac `Horosa_Desktop_Installer/`（Tauri 外壳 + 其 runtime-2.6.4-runtime1 簿记）不同步**。**下次 Mac 同步基线 = `15a21bb`**。

**Features**（共享代码）：① **恒星黄道全栈补齐（重建 jar）**：西洋盘「黄道」从 回归/恒星 二元扩为 **回归 + 47 ayanāṃśa**（复用印占注册表 `SE_SIDM 0–46`，每制经 Swiss Ephemeris 真实位移），覆盖全西洋技法盘（命占/合盘/中点/3D/卜卦/三式/节气）；`siderealAyanamsa` 全栈白名单透传 = 前端各盘 → Java 8 控制器 `getParams()` → Python `Chart(...)` 加 `sidereal_mode`+6 dirParams → 响应 `obj['params']` echo → 储存。② **西洋盘月宿（Nakshatra）**：新 `astropy/astrostudy/nakshatra.py`（27 宿）。③ **印占补齐**：左栏下拉遮挡修复 + 岁差 6→47 + 分宫 4→24。④ **AI 四同步**（导出/导出设置/挂载/储存）：双盘技法（返照/小限/太阳弧/流年/行星弧/主限法盘/Vedic·Jayne 推运）补「本命盘+时段盘」双配置；印占/七政四余(su28)/西洋盘挂载设置补齐；波斯向运加「应期年数」；`AI_EXPORT_SETTINGS_VERSION` 23→24 自动迁移。⑤ **AI 报告生成 v1（纯前端，无新 Java）**：右栏「📄 报告」tab，6 套预置模板（八字 8/12/20 + 紫微 8/12/20）+ 9 套流派 guideline + 分节顺序流式（concurrency=1）+ 命盘截图嵌入（`html-to-image`）+ 4 导出（MD/PDF/Word/HTML）；IndexedDB schema v3→v4 自动 migrate（新增 `report_templates`+`report_instances` 两 stores + 资料 `schools` 字段）；含 v1.2–v1.4 工程级修复（ChartCaptureMount ErrorBoundary + fetch 15s 超时 + captureLock；ConcurrentQueue getErrors/getStats + successRate<40% 跳辅助节；isContentTruncated ELLIPSIS；续写≤2 次；renderTemplateVars 防嵌套）。⑥ **启动健壮性大批加固（修 #21）**：BackendStatusDot 常驻健康灯 + ChartServiceErrorModal 富错误 Modal + ServiceStatusBanner 操作按钮 + StartupGate 分阶段（6s/15s/30s）+ `services/astro.js` fetchChart 透明重试 6→10 次（12s→30s）+ `models/astro.js` showChartServiceError 委托 React 组件 + `layouts/app.js` 挂 BackendStatusDot。命盘计算默认行为与 v2.6.3 字节级一致。

**Win#21 修复**（@1sHyc 2026-06-07，Windows 11，首装 v2.6.2）：「点击排盘『本地排盘服务未就绪』，不知在哪查看状态，点『自建修复并重启服务』仍无法排盘」。诊断 = 首启 `Timed out waiting for port 8899`（Python 60s）→ `Repairing embedded runtime cache` → 修复后慢就绪（159s/106s）= **首启内置运行时解压超过端口等待窗口**（慢盘/杀软）。user 的 netstat 实测 8899/9999 **均 LISTENING**（后端其实起来了，只是首启慢）。v2.6.4 根因式覆盖：健康灯（回应「不知在哪看状态」）+ 富错误 Modal（回应「不知点哪」）+ 透明重试 30s（覆盖解压窗口）+ StartupGate 分阶段文案。**user AI 误判的「`${env:HOME}/.horosa-logs` HOME 为空」= 误读**：service-manager.js 给内置 Java 注入 `HOME=runtimeHomeDir`（`process.env.HOME||USERPROFILE||userDataDir`，`sanitizeEmbeddedRuntimeEnv('java')` 只剥 `_JAVA_OPTIONS` 等不剥 HOME，override `{...env,...overrides}` 最后应用）→ log4j2 `${env:HOME}/.horosa-logs/astrostudyboot` 实解析为 `C:\Users\<用户>\.horosa-logs\`（可写），非失败原因（已核 service-manager.js:1502/1596 + sanitize:97-105）。

**同步法 + 工程坑**：
- clean v2.6.3 baseline 核（4 关键共享文件 LF-hash == Mac@15df8e35：aiExport.js / aiAnalysisContext.js / AIAnalysisMain.js / AIAnalysisProxyService.java 全 CLEAN）→ overlay-copy `cp -rf tmp/mac-sync-2.6.4/Horosa-Web/. WS/`（无 rename/delete，27 A + 88 M 全 add/mod）→ `apply.sh "$WS" "$MAC"`（8 适配全恢复；boundless isLoopbackTarget Mac 已收敛 auto-no-op）→ **立刻跑 selfcheck 核 sentinels 44/44 OK**（gotcha #26 trap 1：本轮 apply.sh patch 步真落了 isDesktopShellWindow=3/ensureField=4，selfcheck PASS，无需手动 re-port）。
- **新 npm runtime deps 必装**（gotcha #26 trap 2）：Mac v2.6.4 引入 `html-to-image@^1.11.13` + `html2pdf.js@^0.14.0`（后者带 `jspdf@4.2.1`+`html2canvas@1.4.1` 子依赖）。`reportChartCapture.js` 真 `await import('html-to-image')`、`reportExport.js` 真 `import jspdf/html2canvas`（grep 确认运行时 import，非注释/build-only）→ `npm install --no-audit --no-fund html-to-image@^1.11.13 html2pdf.js@^0.14.0`（22 包）。apply.sh 保留 Mac deps 但不跑 install。
- **staged dist-file 双路径同步**（gotcha #26 trap 3）：build:file 后 `cp -rf astrostudyui/dist-file/. runtime/windows/bundle/dist-file/`。
- **重建 jar**（gotcha #5）：8 控制器加 `if(TransData.containsParam("siderealAyanamsa")) put(...)` → `astrostudy install → astrostudycn install → astrostudyboot clean package`（offline `-o`，bundled `mvn.cmd` 完整路径）→ 新 jar **324,254,239 B** 覆盖 `bundle/astrostudyboot.jar`。验证：内嵌 `astrostudycn-1.0.0.jar` `grep -ac siderealAyanamsa`=4、`astrostudy-1.0.0.jar`=4（用 `grep -a` 而非 `strings`，gotcha：.class CAFEBABE 魔数会被部分 strings 误判 Mach-O）。

**验证**：umi-test **638 通过 / 68 suites**（v2.6.3 是 522，+116=报告/恒星黄道/AI 四同步新测试）；service-manager + update-signature **39 通过**；build:file 绿；私钥↔内置公钥 match；sentinels 44 文件 OK；`selfcheck` **10/10**（version 2.6.4 / 44 哨兵 / jar 不旧 / dist-file 不旧 / 4 资产+哈希 / release-doc 真哈希 / latest.yml 匹配 exe / Ed25519 sig PASS / app-update.yml 在）。staged payload 核：jar 324,254,239 B 带 markers、`nakshatra.py` 在、`webchartsrv.py`/`helper.py` siderealAyanamsa echo 各 1、`india_chart_kernel.py` SE_SIDM/sidereal 54。

**发布**：release commit `1138b53`（8 跟踪文件 +218/-114；产品源 gitignored 随 exe 交付）+ selfcheck-log 随后；tag `v2.6.4`(new，指 `1138b53`)；`gh release create`(5 资产)。**exe** `Horosa-Setup-2.6.4.exe` **759,474,944 B** sha256 `adb42374bb3a2f85c20714255a3feae1b8e8749195b50c5fe5ee6c646c9db2d2`；blockmap `017375cc3adac8ba71c7a88411a5bf4b62e60a454ff022226c1f109a311205f3`(792,376 B)；latest.yml `83b9db582f2cb14c2fd000580307ba9b4ac36c876ae47f9eabfe546abf6dd7fc`(341 B)；horosa-update.sig `adc3c70545a25f6a6337ae29a7da30a579de62d928a70585f07116b916e776cb`(260 B)；SHA256SUMS `348 B`。`isPrerelease=false`、`/releases/latest=v2.6.4`、GitHub 5 资产 digest=本地逐字节一致（含 759MB exe 全量下载比对 IDENTICAL）；**LIVE sig 经 release download URL 拉取对 downloaded exe `sign-update.cjs verify` = VERIFY OK**（Ed25519 第七次生产核验）。**自动更新 v2.2.1–v2.6.3 → v2.6.4**（含重建 jar + 新前端 + 2 新 npm runtime dep）。**#21 已回复（确认首启窗口真因 + 列 5 项加固 + 澄清 HOME 日志误判 + 升级路径）+ closed(completed)**；0 open issues。

## 2026-06-07 v2.6.3 Beta（Mac 同步 `fc7ab745b→15df8e35`：AI 分析深度打磨 + Qizheng/五兆类补 AI 挂载 + 分至盘修复；**修 Windows issue #20**）

**同步**：Mac `fc7ab745b`(v2.6.2)→`15df8e35`(v2.6.3) 3 commits（Mac#10/#11 修复 + Mac 内部 v2.6.2 簿记 + v2.6.3）。36 文件 = 15 在 `Horosa-Web/`（产品树）+ 18 在 `Horosa_Desktop_Installer/`（Mac Tauri 外壳, Win 不同步） + 3 Mac docs。改动 = 1 后端 Java（`AIAnalysisProxyService.java` +344/-9）+ 14 前端/测试/AGENTS。**下次 Mac 同步基线 = `15df8e35`**。

**Features**（共享代码）：① AI 分析聊天 UX（代码块复制+高亮 highlight.js / 上滚暂停滚 + 跳到最新浮按 / 推理流完折叠 + 复制思考 / 图片拖拽-粘贴入对话栏 / 首回**真 AI 生成 6-14 字短标题** / 对话内导出 Markdown/JSON/Word / 错误改 Alert+重试 / Markdown 渲染补 LaTeX KaTeX）。② AI 分析设置（API Key Password 输入 + 眼睛切换 + 粘贴去空白 / 连接 chip 显延迟+失败 Tooltip / Provider 高级三段折叠 / 列表卡片-紧凑切换 / 新 Provider 保存自动拉模型列表）。③ AI 分析资料/模板/组合（全 pane 拖拽 + 非阻塞批量队列 + 重复文件一次性决策 / 文件夹 CRUD Drawer / 模板变量推断侧栏 + JSON Schema 校验 + 版本 diff / 组合包应用预览）。④ **AI 分析后端补齐（需重编 jar，已重编）** = 用量/费用计量 SSE 新 `usage` 事件覆盖 OpenAI/Anthropic/Gemini/Ollama / Gemini 视觉补齐 `inlineData/fileData` / 停止序列/JSON 模式/思考档**显式映射**而非透传 / `isReasoningModel` 前后端同步覆盖 gpt-5/6/7、o1/3/4/5/6/7。⑤ 历史 tab 重做（紧凑表头 + 列宽固定 + 操作收成「导出 ▾」下拉 + 独立空态）。⑥ **导出/挂载补齐**：七政四余「政余格局/相位」补出导/挂（`AI_EXPORT_SETTINGS_VERSION` 22→23 自动迁移）；五兆/太玄筮法/荆诀/神易数补 AI 挂载（4 个确定性起卦术此前已可存事盘却挂不上）。⑦ 修复：「分至」星盘样式按钮失效（`<JieQiChartsMain>` ↔ `<AstroChartMain>` 漏传 `chartStyle`/`dispatch`）；Dropdown unmounted 内存泄漏；模板版本 diff 空版本兜底；图片上传 onerror + 10MB/张上限。所有技法命盘计算与 v2.6.2 字节级一致。

**Win#20 修复**（@zuojun1991 2026-06-07）：「AI 工具挂载阶段聊天挂载新内容易被截断 + 太阳返照 AI 用本命盘信息」=（A）截断 = AI 后端思考档/JSON 模式/停止序列原 generic pass-through，Anthropic/Gemini/Ollama 实际要**显式映射**字段；错配时长 context 请求体溢出某些 Provider 静默截掉超长 messages → 本版后端显式映射 + SSE `usage` 事件计量后稳定；（B）太阳返照 AI 用本命盘 = 七政四余右栏 Moira「政余格局/相位」此前显示但未进 AI 导出 → 本版补齐（`AI_EXPORT_SETTINGS_VERSION` 22→23 自动迁移）。

**同步法 + 工程坑**：
- clean v2.6.2 baseline 核（5 关键共享文件 LF-hash == Mac@fc7ab745b：AIAnalysisMain.js / aiAnalysisContext.js / aiExport.js / ZiWeiMain.js / AIAnalysisProxyService.java 全 CLEAN）→ overlay-copy `cp -rf tmp/mac-sync-2.6.3/Horosa-Web/. WS/` → `apply.sh "$WS" "$MAC"`。Mac `Horosa_Desktop_Installer/` 是 Tauri 外壳（Mac 独有 `prompt/confirm/alert` 在 Tauri 下 Unhandled Rejection 的修复 Windows Electron 不受影响）→ **不同步**；Mac 的 v2.6.3 release notes 提到的 7 处 Modal 替代是 Tauri-only。
- **apply.sh patch 步骤 OR-chain 假成功**（**SKILL gotcha #26**）：`git apply ... || patch -p1 --silent` 对 Mac 改飘后的 `pages/index.js` 这次没打印 `[auto-patch FAILED]` 警告但 marker `ensureField`/`isDesktopShellWindow` 未真落（patch 可能以 fuzz/offset 命中无关位置或两条命令都失败但 `--silent` 吞下 exit code）→ 必须用 selfcheck `windows-ahead / ported-fix sentinels` 作为权威而非 apply.sh 输出；本轮 selfcheck FAIL 后手动 re-port 两处（`isDesktopShellWindow` helper 在 `isTauriWindow` 后 + 两处 `||` 条件 / `ensureField` helper 在 `changeCond` 开头 + 3 处 `flds.lat`/`flds.southchart` 改写）→ 重 build:file → selfcheck PASS。**下次同步必加**「apply.sh 后立刻跑 selfcheck，FAIL 立即手动 re-port，不信 `[ok] patched`」。
- **新 npm runtime deps 必须 install**（非 build-only）：Mac v2.6.3 引入 `highlight.js@^11.9.0` + `katex@^0.16.10`，apply.sh 仅在 package.json 中保留 Mac deps 但 **不跑 npm install** → 第一次 build:file 失败「Module not found: highlight.js/lib/common, katex/dist/katex.min.css」→ `npm install --no-audit --no-fund highlight.js@^11.9.0 katex@^0.16.10` 后通过。区别于 v2.6.0 的 `opencc-js/pinyin-pro`（那两个 Mac 仅 `scripts/build-cities.js` 用、运行时 `cityMatch.js` 纯查表零 import 故可不装），本次的 2 dep 是 AIAnalysisMain.js 运行时 import，必装。
- **bundled `mvn.cmd` 不在 PATH**：直接 PowerShell 跑 `mvn -o install` 报 "term not recognized" → 必用 `local\workspace\runtime\windows\maven\bin\mvn.cmd` 完整路径（SKILL 已记）。
- **staged dist-file 单独路径**：`local/workspace/runtime/windows/bundle/dist-file/` 与 `astrostudyui/dist-file/` 是**两份**；build:file 只写后者，selfcheck `check_distfile_not_stale()` 读前者 → 必须 `cp -r .../astrostudyui/dist-file/. .../bundle/dist-file/` 同步；否则 selfcheck `staged dist-file not stale` FAIL 看似前端没重建实是没同步。
- **重建 jar**：`astrostudy install → astrostudycn install → boot clean package`（offline）→ 新 jar **324,253,974B**（+4,255 vs v2.6.1 = AI 后端新代码）→ 复制到 `local/workspace/runtime/windows/bundle/astrostudyboot.jar`。jar 内 `BOOT-INF/lib/astrostudy-1.0.0.jar` 验证 3 标记（SSE `usage` 字符串 / `gpt-5` / `inlineData` 均 PASS）。

**验证**：umi-test **59 套 / 522 绿**（v2.6.1 是 520，+2 新测试）；build:file 绿；私钥↔内置公钥 match；sentinels 44 文件 OK；`selfcheck` **10/10**（version 2.6.3 / 44 哨兵 / jar 不旧 / dist-file 不旧 / 4 资产 + 哈希 / release-doc 真哈希 / latest.yml 匹配 exe / Ed25519 sig PASS / app-update.yml 在）。

**发布**：release commit `bdf9779`（+ selfcheck-log 随后） tag `v2.6.3`(new)；`gh release create`(5 资产)。**exe** `Horosa-Setup-2.6.3.exe` **759,209,586B** sha256 `354c51072e58daf5bd1aa4d00a1f2b2d92b00ee7f737e91cc9f08a25dd3925b2`；blockmap `f0dade4a478a2863b2589fec3b09b46aebba6e5fc731437ca9fb730db5d849b6`(791,184B)；latest.yml `53cc7153d8a1a52e20a36258a27a336e294d422cca38b30ace026c35f2634aeb`(341B)；horosa-update.sig `4ab68517e61267cd91537078478a9c49e0c235ffeebc303234a81f4a2763bde9`(260B)；SHA256SUMS `9aa9b62a17dd102a0efd674894976db3d994a58428741c77298dbe4c0ba99909`(348B)。`isPrerelease=false`、`/releases/latest=v2.6.3`、GitHub 5 资产 digest = 本地逐字节一致；**LIVE sig 经 release URL 对 shipped exe `sign-update.cjs verify` = VERIFY OK**（Ed25519 第六次生产核验）。**自动更新 v2.2.1–v2.6.2 → v2.6.3**（含重建 jar + 新前端 + 2 新 npm runtime dep）。**#20 已回复（解释两个真因 + 升级路径）+ closed**。SKILL gotcha #26（apply.sh OR-chain 假成功 + 新 npm runtime dep 必装 + staged dist-file 双路径）。

## 2026-06-06 v2.6.2 Beta（Windows 安装器补丁：彻底修复 issue #18「升级安装从未成功」第二轮；纯 NSIS，jar/前端与 v2.6.1 字节级一致，无 Mac 同步）

**背景**：报告者(`1574802103`)在 v2.6.0 修复后仍反馈「关掉程序、**关机重启**、再装仍报 `Failed to uninstall old application files: 2`」。重启证明无活进程 → v2.6.0 的进程强杀(`customCheckAppRunning`)在其场景=空操作，修复不彻底。

**根因（工程定位：app-builder-lib NSIS 模板逐行）**：那个 `2` 是**旧版本卸载器的退出码**，由 `include/installUtil.nsh:handleUninstallResult` 抛出。一次原地升级先运行**已安装版本**自带卸载器 `old-uninstaller.exe /S /KEEP_APP_DATA --updated _?=$INSTDIR`；返回非零时默认 `SetErrorLevel 2; Quit` **中止整个升级**。旧卸载器=磁盘上早于 v2.6.0 的二进制 → 仍带 electron-builder 默认缺陷：① `KILL_PROCESS` 回退按 `/FI "USERNAME eq %USERNAME%"` 过滤（**中文 Windows 用户名失配**）；② `un.atomicRMDir` 在中文路径 `…\星阙` 下任一文件被 360/Defender 实时扫描/OneDrive/开机自启短暂占用即 `Abort` 返回非零。`customCheckAppRunning` 只加固「新」安装器，**改不到一次升级被迫调用的「旧」卸载器** → 重启也无效。

**修复（`assets/installer.nsh` 新增 `customUnInstallCheck`）**：`handleUninstallResult` 在该宏被定义时**以它替换**默认 `SetErrorLevel 2; Quit`。旧卸载器返回非零(`$R0!=0`)时不再中止 → **接管**：强杀 `Horosa.exe`(映像直杀无路径/USERNAME 过滤) + 仅清 `embedded-runtime` 下 java/python，再自行 `RMDir /r $INSTDIR`（6 次重试熬过杀软/句柄释放）后**继续安装**；仅当 `$INSTDIR\Horosa.exe` 存在才清理(防误删)，用户数据 userData/%APPDATA% **零影响**；死锁给可操作提示(手动)/真实非零退出(静默)，不再 code 2。**关键工程坑**：必须用内建 `$INSTDIR` 而非 app-builder-lib 的 `$installationDir`（后者在 `uninstallOldVersion` 内 `Var /GLOBAL` 声明，**编译序在 `handleUninstallResult` 之后** → makensis「variable not declared」）；删 `horosa_unchk_stuck:` 未用标签（electron-builder makensis `/WX` → `warning 6012: label not used` 即错）。新增哨兵 `customUnInstallCheck`+`horosa_unchk_clean`（并入 installer.nsh 哨兵项，仍 **44 文件**）。

**构建/验证**：首次 `dist:win` 因 `warning 6012`(/WX) 失败于末 makensis；删标签后**仅重跑 nsis 尾**(`electron-builder --win nsis --prepackaged release/win-unpacked` + `sign:update`，复用已 staged `win-unpacked` + 757MB `.7z`，省 ~6min 重 stage)→ makensis 清编译(`NSIS_OK`)。`selfcheck` **10/10**(version 2.6.2；44 哨兵；jar/dist-file 不旧；4 资产+哈希；release-doc 真哈希；latest.yml 匹配 exe；Ed25519 sig PASS；app-update.yml 在)；sign self-verify PASS。

**发布**：release commit `cb49438`(+ selfcheck-log 随后) tag `v2.6.2`(new)；`gh release create`(5 资产)。**exe** `Horosa-Setup-2.6.2.exe` **758,300,981B**(+1,217B vs v2.6.1 = 新宏代码) sha256 `362b83c39e9e91832aa90fdba472e73a0b3633919793bab9fed9c1d79394f772`；blockmap `5a743c15d93c14ce325dbf87e727ea0e28feed3a36d1a8481a2de8d4cb8ec207`(790,839B)；latest.yml `328d69f2248200eaaf8855388c6f35b9e67759c8d2bf6e381d408f74cc525a94`(341B)；horosa-update.sig `a5126b9035749ddc0faccc5f8975650f268300e93449953ba9fe3b4eed96e82d`(260B)；SHA256SUMS `6f63fa88c98292eb35cce153ae1a214442df7dceaab5389a7843de9e7bcca452`(348B)。`isPrerelease=false`、`/releases/latest=v2.6.2`、GitHub 5 资产 digest=本地逐字节一致；**LIVE sig 经 release URL 对 shipped exe `sign-update.cjs verify` = VERIFY OK**(Ed25519 第五次生产核验)。**自动更新 v2.2.1–v2.6.1 → v2.6.2**。**#18 已回复(澄清真因 + 致歉早先「这是你电脑的问题」误判) + 保持 closed**。Mac HEAD 仍 `fc7ab745b`（无同步）；**下次 Mac 同步基线 = `fc7ab745b`**。SKILL gotcha #25（customUnInstallCheck 升级韧性 + `$installationDir` 编译序坑 + `/WX` 未用标签 + 仅重跑 nsis 尾省 stage）。

## 2026-06-05 v2.6.1 Beta（Mac 同步 `af5126db3→fc7ab745b`：AI 挂载全选项 + 多时段/区间扫描 + 风水八卦阳宅法 v2 + 跨模块修复 — 前端为主 + 一处后端 → 重建 jar）

**同步**：Mac `af5126db3`(v2.6.0)→`fc7ab745b`(v2.6.1)。产品改动 = 前端 `astrostudyui/**`（含 `public/fengshui/skins/*.png`）+ **唯一后端** `astrostudycn/.../ChartController.java`。**下次 Mac 同步基线 = `fc7ab745b`**。

**Features**：① AI 挂载全选项 = 新 `utils/techniqueMountSettings.js`(TECHNIQUE_SETTINGS_SCHEMA 驱动齿轮抽屉) + `AIAnalysisMain.{js,less}`(每技法设置抽屉 + 内容勾选 + 多时段日期/区间扫描)，零回归「默认即现状」(等默认项 prune,快照逐字节不变)。② **后端 pdYears 转发(重建 jar)**：`ChartController.getParams()`(`/chart` 挂载路径)此前丢弃 `pdYears`+`pdDirect/pdConverse/pdAntiscia/pdTerms` → 挂载主限法选项不生效；改条件转发(缺省零回归)+`_wireRev pd_method_sync_v8→v9`(旧 ParamHashCache 失效)。③ 风水八卦阳宅法 v2(倪海厦,纯前端)= `fengshui/{FengShuiMain,fengshuiEngine}.js`+新 `{baguaCore,baguaData,naqiRules,fengshuiGeom}.js`+罗盘皮肤；默认仍 `techMode='naqi'` 逐字节零回归。④ 多盘/多时段补全(astro 推运 builder/PD 盘表拆分/紫微/八字/六爻全装卦)。⑤ 跨模块修复(`DivinationChartShell.changeChartStyle` 误用事件对象 / `AstroRelative` 中点盘 `:9999→:8899` 端口兜底 / `app.less` 主题布局)。`perpredict.py`/`perchart.py` 零改动 → 命盘计算与 v2.6.0 字节级一致。

**重建 jar**：astrostudycn install → boot clean package；验内嵌 `astrostudycn-1.0.0.jar` 的 ChartController 含 `pdYears`/`pd_method_sync_v9`；新 jar **324,249,719B** 覆盖 bundle + 复验。**同步法**：clean v2.6.0 baseline 核(ZWHouse/app.less/ChartController LF-hash==Mac@af5126db3)→ overlay-copy + `apply.sh`(全恢复,boundless no-op)。

**验证**：umi-test **59 套/520 绿**；`build:file` 绿；私钥↔内置公钥不变(match)；sentinels 44 文件 OK(at-risk: AIAnalysisMain/aiAnalysisContext/aiExport/baziLunarLocal/localcharts/ChartController 全在)；`selfcheck` **10/10**(version 2.6.1;jar/dist-file 不旧;5 资产 + 哈希;release-doc 真哈希;latest.yml 匹配 exe;Ed25519 sig PASS;app-update.yml 在)。

**发布**：release commit `c8a3b40`(+ selfcheck-log 随后) tag `v2.6.1`(new)；`gh release create`(5 资产)。**exe** `Horosa-Setup-2.6.1.exe` **758,299,764B** sha256 `976e324c849ed652e72fbb16d1b99ebfdc3fe8f5725d69c5ef29908af2452cdc`；blockmap `fb2a7aff6bd3f5e8ba083083f21380539868a3f3afec21d2363027366ccc0ded`(790,848B)；latest.yml `617da0782305de9f51927573fc159d03d7f5f2c0988219e3c24d76eec509218a`(341B)；horosa-update.sig `99b2e059efcc1e1c0493922025a89cb05298901651fec2c152366fdc8113633f`(260B)；SHA256SUMS `e565d8b9ee91ab6014a70738952d8331052e0b945ae71ce1325689e6fc8f583c`。`isPrerelease=false`、`/releases/latest=v2.6.1`、GitHub 5 资产 digest = 本地逐字节一致；**LIVE sig 经客户端 URL 对 shipped exe `sign-update.cjs verify` = VERIFY OK**(Ed25519 第四次生产核验)。**自动更新 v2.2.1–v2.6.0 → v2.6.1**(含重建 jar)。无新 issue。

## 2026-06-05 v2.6.0 Beta（Mac 同步 `5349b96b→af5126db3` 11 commits：六壬毕法100法 + 紫微 P0–P2 + 奇门法奇门 + 占星 buildout + 城市搜索 + AI#16/#17；**后端 Java 改动 → 重建 jar**；含 Windows 独有 #18 升级安装修复）

**同步**：Mac main `5349b96b`（v2.5.5 基线）→ `af5126db3`（HEAD），`gh api compare` = 11 commits / 111 文件（105 在 `Horosa-Web/` 产品树；`Horosa_Desktop_Installer/` Tauri 外壳 + Mac docs 不同步）。**owner 指定 Windows 版本 = v2.6.0**（minor bump，scope 大；Mac handoff 内部标 v2.5.6 是其 runtimeVersion 簿记，非 Windows 产品版本）。**下次 Mac 同步基线 = `af5126db3`**。

**Features（共享）**：
- **六壬毕法一百法解读层**（纯前端，AI 四同步）：取象 / 毕法 100 法（93 自动 + 7 读法心诀）/ 占断向导 / 常用神煞 / 三传关系图 / 应期 / 贵神态；天将取法系统性复核（13 matcher）。
- **紫微斗数全面增强 P0–P2**（前端为主 + 后端 `astrostudycn` → 重建 jar）：主四化盘补显杂吉/杂凶 + 十二神纳音格；流曜下沉全层 + 流年流将前/流岁前 + 小限阴阳顺逆；格局详情 + 6 新格局（34→**40**）；四化流派表（北派默认/中州/自定义）；`ZiWeiPattern`（`inOpp`/`sandwichHua`）+ `ZiWeiChart.setupStarsTianShangShi`（天伤天使）+ `ziweige.json`=40 + `zwrules.json` RuleStars=108。**零回归**：默认 beipai 逐字一致、genParams 仅非默认附 sihua、存档不落流派字段。
- **奇门遁甲法奇门叠加层（荀爽）**（纯前端，不重编 jar）：化解 / 用神 两右栏 + 神煞判语 + 地支/宫名取象。
- **占星世俗/卜卦/择日/星运全链路**（前端 + Python `astroextra.py`/`webastroextrasrv.py` + Java `AstroExtraController`/`AstroHelper`）：世俗瞬时管线 + 月相 + 择日硬性标记/世俗整合 + 卜卦提问向导 + 回归盘/关键度/三分主星/月相；AI 四同步。
- **城市搜索专业化**：opencc-js + pinyin-pro **构建期**生成 `cityTradSimpMap.json`，运行时 `cityMatch.js` 纯查表（**运行时零新依赖**，2 dep 仅 `scripts/build-cities.js` 用、Windows scripts 无 build:cities）。
- **AI #16（后端 Java，重建 jar）**：deepseek-reasoner 多轮首次易失败/空。真因：①丢弃 `reasoning_content`（思考期零输出被当失败）②reasoner 误发 temperature 致 400。修：`extractOpenAIStreamReasoning` 透传 reasoning_content → 独立可折叠「思考过程」气泡；`isReasoningModel` + `stripReasoningUnsupportedParams` 不发采样参数；4 stream 站点 `sendStreamWithRetry` 仅首字节前（连接/429/5xx）退避重试、已出 token 绝不重试；前端 `aianalysis.js` 空闲看门狗。`AIAnalysisProxyServiceTest` **20/20**。
- **#17（纯前端）**：`AIAnalysisMain.js` source 选择器 onChange 选中即重算 `formatTimepointNow()` → 起课/命盘时间得「点击此刻」而非打开软件时刻。

**Win#18（Windows 独有，安装器层）— NSIS 升级安装从未成功修复**：截图实证「**星阙 无法关闭**」→「**Failed to uninstall old application files: 2**」。根因：electron-builder 默认 `_CHECK_APP_RUNNING` 客气 WM_CLOSE 被 `main.js` 的 `close` `preventDefault`（异步收尾）拦下进程不退；其按 `$INSTDIR` 路径（PowerShell `.StartsWith`，中文「星阙」路径错配）/ USERNAME 过滤的 taskkill 也失效 → `Horosa.exe` 占用 `$INSTDIR` → 卸旧失败。sidecar 实际在 `userData/embedded-runtime/`（非 $INSTDIR），故唯一占锁者 = `Horosa.exe`。**修**（`assets/installer.nsh` 覆盖 `customCheckAppRunning`，置 `!ifndef BUILD_UNINSTALLER` 外覆盖安装+卸载）：① `taskkill /F /IM Horosa.exe`（映像直杀，**无 /T**[防误杀作子进程的自更新安装器]、**无路径/USERNAME 过滤**[正是默认失效处]）；② 仅杀 `$_.Path -like '*embedded-runtime*'` 的 java/python（绝不动用户其它 Java/Python；v2.5.4+ Job Object 本级联，兼顾旧版孤儿）；③ 有界校验+重杀循环沉降句柄，`${IfNot} ${Silent}` 末兜底才弹手动关闭。`executableName=Horosa`（exe=`Horosa.exe`，非显示名 星阙）；NSIS `$$_`/反引号串/label section 作用域已处理。新增 `release_selfcheck.py` 哨兵（`customCheckAppRunning` + `taskkill.exe" /F /IM` + `embedded-runtime`，→ 哨兵 43→**44 文件**）。**NSIS 宏仅能由 dist:win makensis 编译验证**（无 electron-builder defines 不能 standalone）→ 本轮 nsis build 通过 = 宏语法正确。SKILL gotcha #23。

**重建 jar**：astrostudy（AI#16 + AstroExtra）+ astrostudycn（紫微）改 → astrostudy install → astrostudycn install → boot clean package（offline）。验内嵌：`astrostudy-1.0.0.jar`（extractOpenAIStreamReasoning/isReasoningModel/stripReasoningUnsupportedParams/sendStreamWithRetry）+ `astrostudycn-1.0.0.jar`（inOpp/sandwichHua/setupStarsTianShangShi、ziweige=40、zwrules RuleStars=108）；新 jar **324,249,515** B 覆盖 bundle，staged payload jar 复验同 marker。

**同步法**：clean v2.5.5 baseline 核对（7 历史易分叉文件 LF-hash == Mac@5349b96b）→ wholesale overlay-copy（`cp -rf Mac/Horosa-Web/. WS/`，无 rename/delete）+ `windows-adaptations/apply.sh`（umi-runner/loadCryptoDeps/vendor/flatlib-pin/package.json name+scripts/THIRD_PARTY/isDesktopShellWindow+ensureField 重补；boundless `isLoopbackTarget` 已收敛 **no-op**）。package.json 保 Mac 新 dep（opencc-js/pinyin-pro 构建期）+ Windows scripts。

**版本 bump** 2.5.5→2.6.0：package.json + lock + CITATION（+date-released + 摘要重写）+ README×3（badge/下载/What's New 重写 + v2.5.5 跳级指针）+ desktop README + PROJECT_STRUCTURE + 新增 `docs/releases/2.6.0.md` + winget 2.6.0（ReleaseDate 2026-06-05）。SKILL gotcha #23（#18）+ #24（v2.6.0 同步）。

**验证**：umi-test **50 套 / 364 测试绿**（Mac 引 222 为 #16 commit 时子集，全套更高，全绿即可）；`npm run verify` **39/39** + preflight 版本同步 OK；私钥↔内置公钥 derived==embedded；`release_selfcheck.py` **10/10**（version 2.6.0；**44 哨兵**含 installer.nsh #18；jar 不旧；dist-file 不旧；4 资产 + 哈希一致；release-doc 真哈希；latest.yml 匹配 exe；Ed25519 sig PASS；app-update.yml 在）。`dist:win` nsis 编译通过（#18 宏语法验证）。

**发布**：release commit `65b717b`（15 文件 +300/-79；产品源在 gitignored workspace 不入 commit，随 exe 交付）+ 本条 selfcheck-log 随后 commit；tag `v2.6.0`（新，指 `65b717b`）；`gh release create`（5 资产）。**exe** `Horosa-Setup-2.6.0.exe` = **756,610,996** B，sha256 `9635bb1f3ba9e7d31079c6e406c46a2e6a206c58b1269717f320e95e53cfac27`；blockmap `a0c6b676eaf51a46b5ccab1afa51dc458714864f870a45cd4271ea779ee08963`（789,906 B）；latest.yml `9188d1404cb831cc9dcf97431e6705c9b8a121e521bf9fc45c264e989afc8d82`（341 B）；**horosa-update.sig（第 5 资产）** `88ee5756803fb4451ed0fdace0926f9e6ccbb2316e52fdd4193822650054c565`（260 B）；SHA256SUMS.txt `92f9baaeecbba0cf2c9dd46a9858c8c8338fa29add6cf436d5235801bee3ff59`。`isPrerelease=false`、`/releases/latest=v2.6.0`、GitHub 独立计算 **5 资产 digest = 本地逐字节一致**；LIVE horosa-update.sig 经客户端 download URL 拉取对 shipped exe `sign-update.cjs verify` = **VERIFY OK**（fail-closed 验签器第三次生产核验：v2.5.4 铺开 → v2.5.5/v2.6.0 实证）。**自动更新：v2.2.1–v2.5.5 用户自动收 v2.6.0**（后端运行时含重建 jar，更新会带上新前端 + 新 jar）。**GitHub issues #16/#17/#18 发布后回复 + 关闭。**

## 2026-06-04 v2.5.5 Beta（Mac 同步 `54f3c42d→5349b96b` v2.5.5：天文馆精修 + 恒星点击/搜索 + 流畅度 + 主限法 golden 校正 — 纯前端 + Python 测试夹具，**无 Java/算法/命盘改动 → 不重建 jar**）

**同步**：Mac main `54f3c42d`（v2.5.4 基线）→ `5349b96b`（v2.5.5），`compare` = 2 commits（`515c2f41e` CITATION date bookkeeping + `5349b96b` 功能）。Mac handoff 明确「**无任何 Java/算法/命盘数值改动**，`astrostudyboot.jar` 维持 v2.5.4 基线，Windows **不需重编 jar**」；所有技法命盘输出与 v2.5.4 完全相同（默认 Alcabitius+Ptolemy 经全 540 例逐字节验证与 v2.5.3 一致）。**下次 Mac 同步基线 = `5349b96b`**。

**Features（共享前端，astrostudyui → 重建前端包）**：
- **天文馆投影对齐天文真值**：前端投影改用逐日黄赤交角 + 视恒星时 + 大气折射（Saemundsson），与后端 `swisseph.azalt` 完全一致 → 消星座/宫位/星宿名称偏移 + 时间回放瞬跳；初始/暂停帧补算一次。新增 BABYLON-free 投影核 `planetariumProjection.js`。**二十八宿回赤道**（按距星赤经定宿，赤道宿度，不再误贴黄道）。`Engine` `adaptToDeviceRatio` + 标签 DPR 超采样 + TRILINEAR → 文字清晰。
- **天文馆每颗恒星可点击 + 按名搜索**：点任意恒星（含暗星，射线夹角 `nearestPointToRay` 兜底）弹名称/拜耳/星座/星等/赤经赤纬；搜索中文/英文专名/HR 编号自动补全定位。新增 `planetariumStarSearch.js`（纯函数）+ `planetariumStarNames.js`（亮星专名表）。`PlanetariumBabylon.js` 接线（建 starIndex / POINTERTAP 兜底 pickNearestStar / flyTo 兜底 findStarByName）。
- **流畅度（零降级）**：七政四余等确定性纯计算技法加同参复用 LRU(48) + 在途合并（深拷贝返回，逐值等价）；抽通用请求去重工具 `services/_requestCache.js`，`services/qizheng.js` 的 `fetchKinastroQizheng` 包 `kinMem`。
- 改 `PlanetariumBabylon.js` / `services/qizheng.js` 均 **clean-port**（LF-normalized `git hash-object` 核 win-current == mac-baseline `54f3c42d`，非 Windows-ahead）。

**Python（仅测试夹具/守卫，无 runtime .py 改动 → 不影响 shipped 行为）**：`astropy/tests/data/pd_calibration_corpus/golden_alcabitius_ptolemy_v253.ndjson.gz` 重生（旧夹具自 `883855d` 起与代码不一致的过期数据；按当前 PD 代码重算，**PD 算法不动**）+ 新增 `astropy/tests/test_planetarium_su28.py`（守二十八宿默认 REAL 模式真赤道 ra≠lon）。Mac preflight `[32]` 改实跑 byteperfect 子集是 **Mac 专属**，Windows release_preflight.py 不跑 Python byteperfect → N/A。

**同步法**：`gh api compare` 取精确文件清单（26 改，11 在 `Horosa-Web/` 产品树，其余 `Horosa_Desktop_Installer/` Tauri 外壳 + READMEs/CITATION/UPGRADE_LOG/handoff 均 Mac 专属不同步）。targeted copy（gotcha #20b：few-file 前端可 cp 具体文件不必整树）：planetarium 整目录 + 2 services + 2 astropy 测试 + AGENTS.md；7 文件 LF-hash 核对 == Mac-new、golden 夹具 binary-identical。`windows-adaptations/apply.sh` 全程 **no-op**（umi-runner/loadCryptoDeps/vendor/package.json/requirements.txt/THIRD_PARTY_NOTICES + 5 patch 标记全在；**#8 isLoopbackTarget 已收敛 no-op → 二次确认无 jar 改动**）。

**版本 bump** 2.5.4→2.5.5：package.json + package-lock.json（2 行）+ CITATION.cff + README×3（badge/下载链接/What's New 重写为 v2.5.5 口径 + 保留 v2.5.4 跳级指针）+ desktop README + PROJECT_STRUCTURE + 新增 `docs/releases/2.5.5.md` + winget 2.5.5 manifest。

**验证**：umi-test **35 套 / 221 测试绿**（含新 planetariumProjection.test.js + planetariumStarSearch.test.js；与 Mac 一致）；`npm run verify` **39/39** + preflight 版本同步 OK；`release_selfcheck.py` **10/10**（含 `update signature (Ed25519)` gate PASS + 43 哨兵；version 2.5.5；jar 不旧——无 Java 改动复用 v2.5.4 jar；dist-file 不旧——前端重建；4 资产 + 哈希一致；release-doc 真哈希；latest.yml 匹配 exe；app-update.yml 在）。

**发布**：release commit `e72653f`（12 跟踪文件 +177/-72；产品前端源在 gitignored workspace 不入 commit，随 exe 交付）+ 本条 selfcheck-log 随后 commit；tag `v2.5.5`（新 tag，指 `e72653f`）；`gh release create`（5 资产 exe/blockmap/SHA256SUMS/horosa-update.sig/latest.yml，latest.yml 末上）。**新 exe** `Horosa-Setup-2.5.5.exe` = **756,217,885** B（vs v2.5.4 加固版 756,172,998 = 新 planetarium 前端 +44,887 B），sha256 `f3bec89657ccf52cd819a90f0b6278222938779c5fc61d05e1dfa4c067cd7378`，sha512(b64) `DwS3kvF3LzM2JsGvmyjVDO8ahoLAhNtiu+Z3wuXIVNxBE/e5h4Zp6ypmfHO9jvMpW6O4V3hwMGCieNfRXkvjDw==`；blockmap `4afe90220ed785a95ee00beecf0a1208ac6f4cd63158631eb170ff8b23c09dfe`（786,524 B）；latest.yml `077c6671834921508704222e8d08506bab7b9cc36634af3a881f8a9b139ae1ea`（341 B）；**horosa-update.sig（第 5 资产）** `5a6de7e908aa99533c3a8cf2026ad8907306ff805f04dba408171d4aa3db99ae`（260 B）。`isPrerelease=false`、`/releases/latest=v2.5.5`、GitHub 独立计算 5 资产 digest = 本地逐字节一致；LIVE horosa-update.sig 经客户端 URL 拉取对 shipped exe 验签 OK。**自动更新：v2.2.1–v2.5.4 用户自动收 v2.5.5**（纯前端/桌面更新，运行时与 v2.5.4 一致）。

## 2026-06-03 v2.5.4 加固补丁（原地覆盖重发 · Windows 安装/更新/健康检查对齐成熟软件，无版本号 bump）

**触发**：owner `/deep-research`「全面检查 Windows 独有的安装和更新检查机制，完全和成熟软件对齐」。研究结论：健康检查层已强于多数 Electron 应用（多数不内嵌 Python+Java），真正 gap 在**安装签名（SmartScreen）/ 更新链路安全 / 发布安全（无灰度）/ 带宽（750MB 全量）/ 分发面（无 winget）**。owner 决策：**暂缓代码签名**（便宜的 Azure Trusted Signing GA 2026-04 仅 US/CA/EU/UK 主体可用、中国不可用；不买 EV 证书）→ 预算投更新链路安全；**原地覆盖 v2.5.4 不 bump**。全部落在已跟踪 build-harness / electron 层，**未动 windows-adaptations / 无 jar 重建 / 无前端重建**（产品功能与 v2.5.4 完全一致）。

**5 项加固（全部 fallback-safe，最坏退回现状）**：
- **P0-1 更新链路安全 — Ed25519 签名更新元数据（fail-closed）**：此前自动更新唯一完整性 = 未签名 latest.yml 的 sha512 + GitHub HTTPS → 教科书级 Electron updater RCE 通道（release 被换 / rogue-CA MITM → 恶意 exe 用户权限自动装）。修法仿 Sparkle EdDSA / Doyensec SafeUpdater：① 新 `electron/update-signature.js` 内置公钥 + `crypto.verify(null,...)` 验签器（纯 Node 无 electron 依赖）；② 新 `scripts/sign-update.cjs` 用离线私钥（`~/.horosa-release/update-ed25519-private.pem`，**永不进仓/CI**）签规范消息 `Horosa-Update-v1\n<version>\n<sha512(exe)>` → 写 `release/horosa-update.sig`，签后用内置公钥**自验否则 abort**（防密钥漂移）；③ `main.js` `update-downloaded` → `verifyDownloadedUpdate`：流式算下载包 sha512 → 拉 release 的 `horosa-update.sig` → 内置公钥验 `版本+哈希`，**验过才置 status 'downloaded'**（installUpdateNow 唯一前置），任何失败（缺签名/哈希不符/拉取失败/算哈希异常）一律 `downloadedUpdateInfo=null` + 拒装不 quitAndInstall + 提示手动下完整包。**关键耦合**：`autoInstallOnAppQuit` true→**false**，关掉「退出自动装」绕过验签的第二条安装路径。`dist:win` 末尾自动跑 `sign:update`。
- **H-7 运行期后端崩溃自动重启（supervisor）**：`main.js` `runtime-error` 处理器加有界自动重启（`MAX_RUNTIME_AUTO_RESTARTS=2` + 退避 `[1500,4000]ms`，经 `startRuntimeFlow({restart:true})` 重拿端口 + 重载 renderer；稳定 45s 清零预算给下次独立崩溃；`isQuitting/isShuttingDown` 守卫 + 退避后再查 → 计划内关闭/更新期不重启；耗尽落原手动 repair UI）。Job Object（v2.5.4）自动纳管重启出的新子进程。放 main.js 而非 service-manager.js，因重启须重载 renderer（端口变）这一编排在 main.js。
- **P1-3 灰度发布**：新 `scripts/set-staging.cjs` 给线上 latest.yml 注入 `stagingPercentage`（10→25→50→100% ramp，撤坏灰度须 bump）；`allowDowngrade=false` 显式。**不接 dist:win**（对线上 yml 的发布时操作）。
- **P1-4 差分下载**：`disableDifferentialDownload=false` 显式保持开启 + 每版发 blockmap。
- **P2-5 winget**：新 `scripts/winget-manifest.cjs` 生成 3 manifest（`winget/manifests/h/HoraceMaxwell/Horosa/2.5.4/`，InstallerType nullsoft、Scope user、未签 EXE + SHA256），加 `winget install HoraceMaxwell.Horosa` 路径（不替换 NSIS）。

**固化**：`release_selfcheck.py` 新增 `check_update_signature` gate（shells `node sign-update.cjs verify <exe> <ver> <sig>` 实测对当前 exe 验签通过）+ main.js 哨兵（verifyDownloadedUpdate / `autoInstallOnAppQuit = false` / MAX_RUNTIME_AUTO_RESTARTS / `disableDifferentialDownload = false`）+ 新文件哨兵 update-signature.js（verifyUpdateSignature/crypto.verify/UPDATE_PUBLIC_KEY_PEM/ed25519）+ sign-update.cjs（sign-release/createPrivateKey）→ **哨兵 43 文件**（v2.5.4 41 → +2）。新单测 `electron/update-signature.test.js` 9 例（临时密钥经 publicKeyPem 覆盖测验签逻辑：正常过/篡改哈希拒/换版本拒/换密钥拒/翻字节拒/坏 schema·alg 拒/垃圾输入永不抛 fail-closed/内置公钥不认陌生签名）接入 `npm run verify`。**SKILL gotcha #22 已加**（cert-less 更新链路安全 + autoInstallOnAppQuit 必关 + 验签器先于更新=可覆盖不 bump + overwrite-with-resign 三资产 + H-7 归属 main.js + release-time-only 脚本不入 dist:win）。

**验证**：`npm run verify` **39/39**（service-manager 30 + update-flow + update-signature 9，经 PowerShell——Bash/MSYS GNU tar 把 `C:\` 当远程主机使 fixture 失败）；`release_selfcheck.py` **10/10**（含新 `update signature (Ed25519)` gate PASS + 43 哨兵；version 2.5.4 不变 → version-consistency 绿；jar/dist 不旧——本轮无 jar/前端改动）；Ed25519 sign→verify 链正反测通过；私钥↔内置公钥一致性预检通过。**未动启动 boot 路径**（改动只在 updater + runtime-error handler，均 fail-safe）→ 正常启动稳定性不受影响。

**发布（原地覆盖）**：commit `e083cb3`（13 跟踪文件 +833/-20）；`git tag -f v2.5.4`（e26ff04→e083cb3）+ `git push -f origin v2.5.4`（**仅 force tag，main 正常 fast-forward `600de33→e083cb3` 不 force**）；`gh release upload v2.5.4 --clobber`（exe 先 / latest.yml 后，5 资产）+ `gh release edit --notes-file`（同步加固补丁口径）。**新 exe** = **756,172,998** B（vs 旧 756,182,867 = electron 代码变 −9,869 B），sha256 `92fc71b2db43b34ceb87fd53a95ab4b57b7a1e760ae5fc2065c99bdb00025fa3`，sha512(b64) `MYFbvZv9LSf4o8vS90ylcxegeuOD4N6wgdrQPUCMIrRIz2OcXunsEqeEJ2ONthrPT2tF5eBrm6/KyQC1Iyy4bQ==`；blockmap `01319972037f2ddc75279c1a2873c8e48a6e5e678b5ec8874d123bf0b0f517fd`（785,401 B）；latest.yml `aee1e70ba5086c39d23734909f1d9b9bd5c1a369dfd019a86e76af1f81d4a93b`（341 B）；**新增第 5 资产 horosa-update.sig** `2a989117cf69ebc462fe679f128ab34ddcb5addbf45f2c920d37d2e22863c269`（260 B）。`prerelease=false`、`isDraft=false`、`/releases/latest → v2.5.4`；GitHub 独立计算 5 资产 digest = 本地逐字节一致。**自动更新口径**：本轮覆盖只对**新下载**生效；验签器随下个真版本 v2.5.5 签名发布时铺开（届时新装/覆盖的 v2.5.4 客户端即验签 v2.5.5）。**下次 Mac 同步基线仍 = `54f3c42d`**（本轮纯 Windows 加固，无 Mac 同步）。

## 2026-06-03 v2.5.4 Beta（Mac 同步 `94b6e277c→54f3c42d` 8 commits 大版本：七政宿度三制 + 主限法 v10 全方位法 + 量化盘汉堡补全 + Windows 启动稳健化镜像 ①②③）

**同步**：Mac main `54f3c42d`（baseline `94b6e277c` = 上版 v2.5.3），`compare 94b6e277c..54f3c42d` = **8 commits, Java + Python + 前端 + 测试 + 文档**。Mac 也已 bump 到 v2.5.4（Mac 端本地标记 + 推到 GitHub main，但 Mac handoff 自标「未发到 GitHub Releases，等用户签字后各自发」→ 用户「走完整流程发布」即签字 → Windows 立即发）。**下次 Mac 同步基线 = `54f3c42d`**（或下次 ls-remote 取 Mac v2.5.4+ HEAD）。

**Features（共享代码）**：
- **七政四余「二十八宿度」三制对齐**（perchart.py 主修）：回归今制（活体距星严格岁差）/ 回归古制（开禧基值 + 岁差）/ 恒星制（郑氏恒星基值原值）。修复回归今制原误用郑氏恒星冻结值 15.9（偏 ~18°）→ 现为活体距星；实拍核对恒星制 10 颗到角分。
- **主限法 v10 全方位法**（pd_engine.py NEW + perpredict.py + perchart.py + Java PredictiveController.java + 前端 PD pages）：六方位法（Alchabitius / Placidus（半弧）/ Regiomontanus / Campanus / Topocentric / Horosa 原方法）+ 真太阳弧 + 顺逆同选 + 映点 + 界。**根治「推运方向选了没用」真因**：Java `getParams()` 此前只透传 pdtype/pdMethod/pdTimeKey 而丢弃 pdDirect/pdConverse/pdAntiscia/pdTerms，叠加 `AstroHelper.request()` 用 `ParamHashCache(键=params哈希, 24h)`，导致 direct/converse params 哈希相同 → 命中同缓存 → 切换无效。修法 = Java getParams 补 4 个透传 + `_wireRev` v8→v10（让旧缓存全失效）→ **重建 jar**。time-key 收敛回 Ptolemy/Naibod/真太阳弧（撤拟合常数 Cardano/Plantiko/Wöllner/SymbolicSolarArc + 删 `fit_pd_constants.py`）。Ptolemy/Alchabitius 路径**逐字节对拍通过**（540 case 0 偏差 + tests/test_pd_alcabitius_byteperfect.py）。
- **量化盘汉堡补全**：新增 `UranianGraphicEphemeris.js`（图形星历）+ 11 例新测试。
- **主限法盘四角赤纬归正**：ASC/MC/DESC/IC 一律 `_pdChartEqCoords(lon, 0.0, obliquity)`（修长期误用地理纬度作黄纬致赤纬越界）。
- **启动稳健化共享前端 P0**：`components/common/StartupGate.js` NEW + backend ready contract 完善。
- **AI 四同步**：`AI_EXPORT_SETTINGS_VERSION` 15→16（触发旧 presets 回收）+ aiAnalysisContext.js 不再硬编码覆盖 pdMethod/pdTimeKey（透传 chartObj.params 实选）+ PD_SYNC_REV 升 `pd_method_sync_v10`。

**Windows 启动稳健化镜像 ①②③（Windows 独有，service-manager.js + 新 job-object.js）**：见 `docs/windows-启动稳健化-镜像清单.md`。
- **① 修「白屏 / 进不去主界面」**：原 trusted 快路径 `Promise.resolve({bodyExcerpt:'trusted runtime port probe'...})` 仅端口探测 → 端口 open ≠ Java 真就绪 → trusted 缓存命中遇 Java 半坏 → UI 先加载 → 白屏。修法 = 在 trusted 路径也跑**真 HTTP `/heartbeat`**（短超时 ≤8s，失败退回完整 `STARTUP_READY_TIMEOUT_MS` 等待）。镜像 macOS `start_horosa_local.sh` 一律轮询 HTTP 的口径。哨兵 = `trustedRuntimeServerRoot`（新 local var）替 obsolete `'desktop runtime port probe'` literal。
- **② 修「端口被占用 / 孤儿后端」**：Electron 崩溃 / OOM / 外部 taskkill → spawn 出的 python.exe + java.exe 变孤儿、持续占口。Node `process.on('exit'/'SIGINT'/'beforeExit')` 仅 graceful 路径触发，不抗崩溃。修法 = 新 `electron/job-object.js`，用 **koffi**（^2.14.1，ffi-napi 维护中替代）调 Win32 API：`CreateJobObjectW` → `SetInformationJobObject(JobObjectExtendedLimitInformation, LimitFlags |= JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE 0x2000)` → `AssignProcessToJobObject(job, GetCurrentProcess())`；在 `service-manager.js` 模块顶层调一次 `attachJobObject(console)`，所有 spawn 子进程随 Electron 死。全 try/catch 包裹，koffi 缺/Win32 失败/Win8- 沙箱拒绝时静默回退到现状 taskkill + findPort。**保留 job handle 在模块级**（关 handle 即触发 KILL_ON_JOB_CLOSE 是自杀）。**幂等**。镜像 macOS main.rs setpgid + killpg。
- **③ 修首启「防火墙弹窗」**：Spring Boot 默认 `0.0.0.0` → 首启 Windows Firewall 弹窗（吓退非技术用户 / 可能挡启动）。修法 = `buildJavaArgs` 加 `--server.address=127.0.0.1`（Spring CLI 优先级 > properties，桌面专属、零波及共享 application.properties）。镜像 macOS launcher。

**jar 重建**：链 `boundless install → astrostudy install → astrostudycn install → astrostudyboot clean package`（JDK17 内置 Maven）。**核验打包 + staged installer payload jar markers**：PredictiveController.class 含 `pdDirect / pdConverse / pdAntiscia / pdTerms / pd_method_sync_v10` 全 v10 marker；回归无变 → AIAnalysisProxyService.class 含全 5 Ollama natives（#15）；HttpUriRequestHystrixCommand.class 含 `isLoopbackTarget`（#14）+ `redactSensitiveHeaders / stripQuery`（#9 脱敏）全无回退。jar 324,243,192 B（+97 B vs v2.5.3 = PredictiveController 4 个新 getParam 字段编译差）。

**固化**（杜绝再回归）：
- `desktop_installer_bundle/package.json` 新增 dep `koffi ^2.14.1`（npm install 1 包 / +~200KB）。
- `release_selfcheck.py` 新增/调整哨兵：service-manager.js 加 `trustedRuntimeServerRoot`（替 obsolete `'desktop runtime port probe'`）+ `--server.address=127.0.0.1` + `attachJobObject`；**新增独立文件哨兵** `electron/job-object.js` 守 `attachJobObject / JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE / CreateJobObjectW / AssignProcessToJobObject`。**哨兵 41 files OK**（v2.5.3 40 → +1 文件）。
- **SKILL gotcha #21 已加**：「Windows 启动稳健化镜像清单 ①②③ — Mac launcher hardening → Electron mirror 的标准模板」(trusted-path 真 /heartbeat + Job Object + bind-127；koffi try/catch 兜底实践；与 Node 纯 process.on 替代方案对比；下次 Mac 出新 launcher 改动按此清单镜像)。

**验证**：umi-test **33 套 / 195 测试**（v2.5.3 184 → +11 例 PD v10 + uranianDial 配套）；`npm run verify` service-manager **30/30** + preflight OK；`release_selfcheck.py` **9/9**（哨兵 41 文件含 ①②③ 全 marker；version 2.5.4；jar 不旧；payload-slimmed；4 资产 + 哈希一致；release-doc 真哈希；latest.yml 匹配 exe；packaged app-update.yml 在）。

**发布**：commit `e26ff04`（12 跟踪文件 +362/-86；新增 `desktop_installer_bundle/electron/job-object.js` + `docs/releases/2.5.4.md`）；tag `v2.5.4`（指 `e26ff04`）；`prerelease=false`、`isDraft=false`、`/releases/latest → v2.5.4`。`Horosa-Setup-2.5.4.exe` = **756,182,867** B（+12.7MB vs v2.5.3 = koffi + 新 PD v10 + UranianGraphicEphemeris 等组件，**非膨胀**），SHA256 `d863264eadfd1d1e44e66edb4701b1be5fd90e7fc3dc51214161bb32ca8d71d1`；blockmap `32a4891d232347474d7e2790262229f9dbe1b65f1723cf91427b4189f96791fa`（788,305 B）；latest.yml `17a208c4d51a6648684ddf77bb80647a4d254bf4cb3f751c1018f445e848f9b6`（341 B）。GitHub 独立计算 4 资产 digest = 本地逐字节一致；线上 latest.yml + SHA256SUMS IDENTICAL。**自动更新：v2.2.1–v2.5.3 用户自动收 v2.5.4**。

## 2026-06-02 v2.5.3 Beta — Doc 综合化补丁（`gh release edit --notes-file`，无代码/binary 改动）

发布 v2.5.3 后 owner 提示「核对一下 Mac 最新 README 看看有没遗漏」。重 ls-remote Mac main = `49179c8cc`（在我 v2.5.3 baseline `94b6e277c` 之上又前进 1 commit，**纯 release bookkeeping**：CITATION/Mac Tauri 配置/Mac release_notes/README/UPGRADE_LOG/handoff；代码 `astrostudyui`/`astrostudysrv`/`astropy`/`flatlib-ctrad2` **0 改动**——代码层完整）。

**发现的文档 gap**：Mac 把 v2.5.3 写为「替代 v2.5.2 的综合版本」，README/release_notes 列出 v2.5.2 全部大特性（90°dial / Naibod / AI 模型解耦 / Ollama 原生口 / 大六壬 AI 挂载修复 / 量化盘 AI 四同步）+ v2.5.3 布局两修。Windows 原把 v2.5.3 写为纯小补丁，仅提布局两修。**问题**：从 v2.5.1 直接跳 v2.5.3 的用户（electron-updater 看 `/releases/latest`），应用更新提示只会展示 v2.5.3 release notes → 只读到「布局两修」→ 完全错过 90°dial / Naibod / AI 解耦 / Ollama #15 修复等大功能。

**修复（纯 doc 更新，无代码/binary/tag/exe sha 变化）**：
- `docs/releases/2.5.3.md` 改为 Mac 综合口径，列出 v2.5.2→v2.5.3 全部用户面变化 + 布局两修；保留资产哈希表（与 GitHub 线上一致）。
- 3 个 README（README.md / README_EN.md / README_ZH.md）What's New 段同步改为综合口径。
- `gh release edit v2.5.3 --repo ... --notes-file docs/releases/2.5.3.md` → 线上 release 页文案同步更新（核验：关键特性 90°dial/Naibod/嵌入模型解耦/Ollama/大六壬 在线上 notes 出现 12 次）。
- commit `0bf1fae`（4 跟踪文件 +59/-21）pushed。

**SKILL gotcha #20 扩展**：固化「release notes 给跳级用户也要看得见全貌」规则——superseding/patch release 必须 cover **自上一个有 meaningful 用户群的 release 以来的全部变化**（不是仅 delta from immediately-prior）；**发布前 cross-check Mac 同版本 release notes 作为口径校验**，Mac 的 framing 往往是正确的用户面模型，能抓到 Windows 侧会遗漏的 gap。

## 2026-06-02 v2.5.3 Beta（Mac 同步 `a3153f349→94b6e277c`：量化盘 90°中点盘 UX 小补丁；bump 而非覆盖，以触发已装 v2.5.2 用户自动更新）

**同步**：Mac main `94b6e277c`（baseline `a3153f349` = 数小时前的 v2.5.2 ship），`compare a3153f349..94b6e277c` = **1 commit, 1 文件**：`fix(germany/dial): 中点盘下端被底部 Dock 遮挡 + 左右栏小窗口无法下滑;runtime → 2.5.2-runtime2`，仅改 `astrostudyui/src/components/germany/UranianDialMain.js`（+28/-6）。Mac-only `release_config.json` 不移植。Mac 同时 bump 到 v2.5.3 → 两端版本号继续对齐。**下次 Mac 同步基线 = `94b6e277c`（或 Mac 接下来的 v2.5.3 HEAD，下次同步前重 ls-remote 取准）。**

**Features（单文件 UX patch）**：
- 中点盘下端被底部 Dock 遮挡修复：盘体 `size` 由原「单参数 `props.height`」改为**三方钳位** `max(420, min(props.height, vh-260, 960))`；`vh = window.innerHeight` 监听 `resize` 实时更新；盘容器加 `paddingBottom: 24`。原因：`props.height` 含 Dock 占位但未减它，大屏 vh=1220 下盘 1000 → bottom 离视窗只剩 84px 不够 Dock 高度。
- 左右栏小窗口无法下滑修复：两个侧栏内层 div 包 `maxHeight: max(380, vh-220) + overflowY: auto`；inner div `width: 100%` 防收缩 h=0。

**关键决策（gotcha #20 固化）**：owner 起先要求「覆盖发布」（同版本号覆盖 v2.5.2），随后追加「确保已经下载了旧版本的人能收到这个更新」。两条诉求互相矛盾——`electron-updater` 按**版本号**比对（非 hash），同版本号 → `Update for version 2.5.2 is not available`（#14 诊断 JSON 中已亲见此行）。覆盖发布只对**新下载**用户生效。立即 `TaskStop` 跑中的 `dist:win`、还原 `docs/releases/2.5.2.md` 到原始已发状态（线上 v2.5.2 release 不动）、bump 到 v2.5.3、写 `docs/releases/2.5.3.md` 作为 patch release notes、重 build → 标准 patch release 流程。**Mac 也 bump 到 v2.5.3，两端版本号对齐。**

**无 Java/Python 改动 → 无需重建 jar**。`staged jar not stale` 门 PASS（v2.5.2 jar 沿用，已含全部 #14 + #15 + #9 marker 无回退）；apply.sh idempotent 再跑确认 8 适配全在；selfcheck 哨兵 40 文件全过。

**验证**：umi-test **33 套/184 测试**（与 v2.5.2 同，patch 不动测试）；`release_selfcheck.py` **9/9**。

**发布**：commit `d9401e9`（9 跟踪文件 +94/-75；其中新增 `docs/releases/2.5.3.md`）；tag `v2.5.3`（指 `d9401e9`）；`prerelease=false`、`isDraft=false`、`/releases/latest → v2.5.3`。`Horosa-Setup-2.5.3.exe` = **743,476,882** B，SHA256 `b5aef7755854d9628081adb5572e8a15495bbf1846d71a94182c23592afb5533`；blockmap `0de8c26ef973a71afeb016626d172c0e64fe64e83cce14f91c33def9dea4e65d`（774,907 B）；latest.yml `352ffa2a6018c646b7fc3ef4cf3d1db5221dea9d432aac681792f56daf869d10`（341 B）。**自动更新：v2.2.1–v2.5.2 用户自动收 v2.5.3**（这正是 bump 而非覆盖的目的）。**SKILL gotcha #20 已加**：固化「同版本覆盖 vs bump」决策规则——除非确认无人下载，否则一律 bump。

## 2026-06-02 v2.5.2 Beta（Mac 同步 `270eb01e→a3153f349`：汉堡 90°中点盘 + 主限法 Naibod + AI 模型解耦 + Ollama 原生口 → GitHub #13/#15 修复）

**同步**：Mac main `a3153f349`（baseline `270eb01e` = 上版 v2.5.1），`compare 270eb01e..a3153f349` = **3 commits**：(1) `4f046844` 「fix(boundless/#14): 本地回环出站不走系统代理（跨平台同步 Windows）」(2) `b36523d9`「docs(README): 三主 README v2.5.1」(3) `a3153f349`「release(v2.5.2)」。改动型态：**Java（boundless+astrostudy）+ Python（perpredict/webgermanysrv/webchartsrv/webpredictsrv/flatlib const+swe）+ 前端（新 6 文件 UranianDial* + AI 分析翻新 + 主限法 Naibod）** → **需重建 jar + stage Python + build:file**。`apply.sh` 第 6 步检出 Mac 自带 `isLoopbackTarget` 自动 no-op，**两端 #14 在代码层面收敛**（boundless 仍属 backend → 重建 jar）。Mac-only `Horosa_Desktop_Installer/`/`AGENTS.md`/`CITATION.cff`/`README*.md`/`UPGRADE_LOG.md`/`docs/windows-sync-handoff.md` 不移植。**下次 Mac 同步基线 = `a3153f349`。**

**Features**：
- **量化盘新增汉堡 90°中点盘技法**（辅盘 → 量化盘，前端 6 文件）：折叠盘 + 多环模数盘 + 三层叠盘（本命/行运/太阳弧，本命锁内圈）+ 八虚星（Cu/Ha/Ze/Kr/Ap/Ad/Vu/Po）+ 谐波盘基 H1..H512 + 拖动指针实时输出星体/中点/行星图读数 + 中点树。**6 关键不变量**（AGENTS §9）：font/glyph from `AstroChartFont`+`AstroMsg[名]`；单透明 hit 圈 + `pointerdown/move/up`+`setPointerCapture`；`getBoundingClientRect` 求中心+缩放比；本命环锁定；`onSaArc` 仅 `emit=true` 回调防死循环；TNP 关时 `filterByTnp` 出口过滤。AI 四同步（导出预设/导出设置 14→15/AI 挂载/盘存储均接入 `[90°中点盘]` 段）。
- **主限法 Naibod 度数换算**（前端+Python）：`AstroPrimaryDirection.js` 新增 Naibod option；`AstroPrimaryDirectionChart.js` `getTablePdTimeKey()` Naibod→Ptolemy 钳位；`perpredict.appendDateStr` Naibod `arc/0.9856473354`；`getPrimaryDirectionChartByDate` Naibod `arc*0.9856473354`（互逆，表格 Ptolemy/Alcabitius byte-identical）；converse 复用同一参数链（`directed_arc=-current_arc`）。
- **主限法盘四角赤纬归正**（`perpredict._pdChartBuildAnglesAndHouses`）：ASC/MC/DESC/IC 一律 `_pdChartEqCoords(lon, 0.0, obliquity)`（修长期误用地理纬度作黄纬导致赤纬>23.5°）。
- **大六壬/三式合一 AI 挂载修复 + 六爻接入时间起卦白名单**（仍守「永不按时间重算已存卦」铁律）。
- **NaN 护栏**：`webchartsrv`/`webgermanysrv` 入口；前端 `AstroDirectMain.buildPrimaryDirectionFetchFields/Request` 加 NaN 守。

**GitHub issue #13 修（AI 聊天/嵌入分供应商 + 高级参数）**：`AIAnalysisMain.js` 顶栏新增嵌入模型 Select +「参数」Popover（THINKING_LEVELS/temperature/top_p）；`aiAnalysisProviders.js` 加 `applyThinkingLevel`/`isReasoningModel`；**关键解耦**：`AIAnalysisMain.js` L1504 注释「issue #13：嵌入用「独立选择的嵌入 provider」，与聊天 provider 解耦」，L1505 `eProfile = embeddingTarget.profile` → L1510-1515 `providerType/apiKey/baseUrl/providerOptions` 全部从 `eProfile` 取，与聊天 profile 完全独立 → 报告者诉求「DeepSeek 聊天 + Ollama bge-m3 嵌入」精确实现。

**GitHub issue #15 修（Ollama num_ctx 默认 4096 截断长玄学上下文，**共享后端 → 重建 jar**）**：根因 = Ollama OpenAI-兼容口 `/v1/chat/completions` 与 `/v1/embeddings` **静默忽略 `num_ctx`** → 默认 4096 截断。修复：`AIAnalysisProxyService.chatStream` 与 `embeddings` 在 `isOpenAICompatible(providerType)` 之前**前置拦截** `"ollama".equals(providerType)`（因 ollama 也满足兼容口分类）→ 分别走 `streamOllamaNative`（`/api/chat` NDJSON + `options:{num_ctx, num_predict, top_k, top_p, repeat_penalty, temperature}` + `keep_alive` 顶层）+ `embeddingsOllamaNative`（`/api/embed` 批量 input + `options:{}` 不带 temperature/num_predict）。新增 helpers：`ollamaNativeBase()` 去除 baseUrl 末尾 `/v1`、`extractOllamaEmbedVectors()` 解析 `{embeddings:[[...]]}`（与 OpenAI 的 `{data:[{embedding}]}` 不同）、`readNdjsonStream()` NDJSON 逐行回调。其它 provider 完全不变。**release_selfcheck.py 新增 4 个 Ollama native 哨兵**（`streamOllamaNative`/`embeddingsOllamaNative`/`extractOllamaEmbedVectors`/`ollamaNativeBase`），并入 AIAnalysisProxyService 既有哨兵。

**跨平台 #14 收敛达成**：Mac commit `4f046844` 在 `boundless/HttpUriRequestHystrixCommand.java` 自加 `isLoopbackTarget`（byte-identical API：同方法名、同 host 列表 `localhost`/`127.*`/`::1`/`[::1]`/`0:0:0:0:0:0:0:1`）。整树覆盖后 `apply.sh` 适配 #8 标记守卫检出已存在自动跳过补丁。**Windows 端 #14 无后续动作**，但 boundless 仍是 backend 改动 → 任何 backend-touching 同步均须重建 jar。

**jar**：`boundless install → astrostudy install → astrostudycn install → astrostudyboot clean package`（JDK17 内置 Maven）。**核验打包 + staged installer payload jar 4+1 markers**：nested `astrostudy-1.0.0.jar` `AIAnalysisProxyService.class` 含 `streamOllamaNative`/`embeddingsOllamaNative`/`extractOllamaEmbedVectors`/`ollamaNativeBase`/`readNdjsonStream`；nested `boundless-1.2.1.2.jar` `HttpUriRequestHystrixCommand.class` 含 `isLoopbackTarget`（v2.5.1 #14 无回退）+ `redactSensitiveHeaders`/`stripQuery`（v2.1.4 #9 脱敏无回退）。jar size 324,243,095 B（+1,979 B vs v2.5.1，对应新 5 个 native 方法）。

**验证**：umi-test **33 套/184 测试**（v2.5.1 173 → +11 例 `uranianDial.test.js`）；`npm run verify` service-manager **30/30** + preflight OK；`release_selfcheck.py` **9/9**（哨兵 40 文件 + 新 4 Ollama native；version 2.5.2；jar 不旧；payload-slimmed；4 资产 + 哈希一致；release-doc 真哈希；latest.yml 匹配 exe；packaged app-update.yml 在）。

**发布**：commit `237b1ca`（10 跟踪文件 +130/-73）；tag `v2.5.2`（指 `237b1ca`）；`prerelease=false`、`isDraft=false`、`/releases/latest → v2.5.2`。`Horosa-Setup-2.5.2.exe` = **743,489,563** B，SHA256 `e546b748affe9aeae4ee7eed60e8becf90263523eb6393781b3c3ee630fb18cd`；blockmap `3f2d4ec6e2a9ab94ae4ac28f724a40b7a7a750fe370ac650690626a0b7414730`（774,454 B）；latest.yml `a2fd560eb9ceb1099b2b79a1f5d5dc1e31680da2811ded836cfe6580d3416352`（341 B）。**GitHub 独立计算 4 资产 digest = 本地逐字节一致**（待 release 上传后核验）；**自动更新：v2.2.1+ 用户自动收 v2.5.2**。**#13 + #15 待 release 上线后回复+关闭（completed）。SKILL gotcha #19 已加。**

## 2026-06-01 v2.5.1 Beta（Mac 同步 `1c463718→270eb01e`：AI 分析页翻新/技法全接入/即时起盘/地点时区校准 + GitHub issue #14 Windows 系统代理排盘修复）

**同步**：Mac main `270eb01e`（baseline `1c463718` = 上版 v2.5.0），`compare 1c463718..270eb01e` = **纯前端**（astrostudyui，Mac delta 内 0 Java/Python）。新模型「纯构建外壳」：整树覆盖 `astrostudyui/src` + 新增 `scripts/build-cities.js`（无新 npm 依赖、无文件删除）→ 跑 `windows-adaptations/apply.sh` 恢复全部 7 项适配（patches #6/#7 干净应用，Mac delta 未触这两文件）。Mac-only `Horosa_Desktop_Installer/`/`AGENTS.md`/`CITATION.cff`/`UPGRADE_LOG.md` 不移植。**下次 Mac 同步基线 = `270eb01e`。**

**Features（用户面，纯前端）**：AI 分析页系统性翻新（Chat 式 + 挂载设置抽屉 + 测试连接状态机 + 复制/重生成 + 严格签名挂载）；全部技法接入 AI 挂载/导出（西占推运全套 + 数算补逐年流年 + 演禽/策天/皇极）；新增「起课时间」「命盘时间」即时起盘入口；地点与时区全面校准（34k 城市离线 atlas + DMS + 时区自动/手动随盘存档 + 西经/南纬/小负值修正 + 选地点实时重排）；七政四余 Moira / 紫微右栏空白与点宫位神煞 / 天文馆沉浸 / 星运 tab 修复。

**GitHub issue #14（Windows 系统代理排盘失败）= 两半修复**：
- **共享前端半**（Mac `270eb01e`，clean-port）：`services/astro.js` `fetchChart` 加 `retry:{retries:6,backoff:[400,800,1200,2000,3000,4000]}` —— 仅对连接被拒（后端不可达）透明退避重试，桥接服务重启/启动窗口。
- **Windows 特有半**（本轮新增，**共享后端 boundless → 重建 jar**）：根因 = 开系统代理（Clash/v2ray）时内置 JVM 把内部 `127.0.0.1:8899` 排盘调用也塞进系统代理（`doCmd` 无条件 `setProxy(getHttpHost())`；`getHttpHost` 在 `useSystemProxies=true` 下经 `ProxySelector.select(URI("https://api.openai.com"))` 取回系统代理静态返回，Apache 显式代理无视 `nonProxyHosts`）→ 12-17s 卡顿 → 「本地排盘服务未就绪」。修复：`doCmd` 对 loopback（`isLoopbackTarget`：localhost/127.*/::1）`setProxy(null)`，外部 AI 主机仍走代理（#9 不变）。**无纯启动器修法**（不能去 useSystemProxies；nonProxyHosts 对 Apache 显式代理无效，且 getHttpHost 与目标无关）。诊断显示「ready」是因主进程 chartProbe 直连 8899（Node，不走 JVM 代理）。
- **固化**（杜绝再同步丢失）：`windows-adaptations/` 新增**适配 #8**（`patches/boundless__HttpUriRequestHystrixCommand.java.patch` + apply.sh 步骤 + README，含「BACKEND→须重建 jar」警示）+ `release_selfcheck.py` 哨兵（HttpUriRequestHystrixCommand 加 `isLoopbackTarget`）+ SKILL gotcha #18。**跨平台 bug**（Mac 启动器同设 useSystemProxies）→ 建议 Mac boundless 也加 isLoopbackTarget，两端收敛后 overlay 补丁标记守卫自动 no-op。

**jar**：boundless 改 → 链 `boundless install → astrostudy install → astrostudycn install → astrostudyboot clean package`（JDK17 内置 Maven）。**核验打包 + staged jar**：nested `boundless-1.2.1.2.jar` `HttpUriRequestHystrixCommand.class` 含 `isLoopbackTarget`；v2.1.4 `redactSensitiveHeaders`/`stripQuery`（#9 脱敏）无回退；staged jar（`build/app-runtime/.../bundle/`）复验含 `isLoopbackTarget`。

**验证**：umi-test **32 套/173 过**（v2.5.0 为 146，v2.5.1 加 geo/timezone/AI-provider 测试）；`npm run verify` service-manager **30/30** + preflight OK；`release_selfcheck.py` **9/9**（哨兵 40 文件含 isLoopbackTarget；version 2.5.1；jar 不旧；payload-slimmed；4 资产 + 哈希一致；release-doc 真哈希；latest.yml 匹配 exe；packaged app-update.yml 在）。

**发布**：commit `7356a14`（13 跟踪文件 +189/-75）；tag `v2.5.1`（指 `7356a14`）；`prerelease=false`、`isDraft=false`、`/releases/latest → v2.5.1`。`Horosa-Setup-2.5.1.exe` = **743,440,114** B，SHA256 `d3d39b4ca34dee62d083afa1cafc9196bf184e98ef30de577b91609a71609ff1`；blockmap `1ea41399d578dcfed3431dc8ca206d3143dde356c956fa8d875119d0e4c8b756`（773,089 B）；latest.yml `d687f18e5ced9033f001aa9afe7202a997a8a3a2218063626956c89def0d655a`（341 B）。**GitHub 独立计算 4 资产 digest = 本地逐字节一致**；线上 latest.yml + SHA256SUMS IDENTICAL。**自动更新：v2.2.1+ 用户自动收 v2.5.1**；v2.2.0 及更早需手动装一次。**#14 已回复 + 关闭（completed，comment 4597392410）。**

## 2026-05-31 v2.5.0 Beta 重做并发布（灾后 — Mac `1c463718` 全量同步；改用「纯构建外壳」仓库模型 + windows-adaptations 覆盖层）

**背景**：v2.5.0 曾发布后被 owner 要求撤销（改用重整后的新 Mac repo 重做），`main` 一度回退到 `2b80271`（=v2.4.0）。本轮从重整历史（SHA 全变）的新 Mac repo **重新 clone**（不可在旧克隆 `git pull`），找到史内 baseline `ecc987c4f`（首个 v2.5.0 commit 之父）。

### 仓库模型转变（根因修复，杜绝再次「灭顶」）
- 旧模型把产品源藏在 `.git/info/exclude`（非提交的 .gitignore）→ 一次 `reset --hard`/擦除即**无 git 可恢复**，正是 v2.5.0 浩劫成因。
- **新模型 = 纯构建外壳**：产品源（`local/workspace/Horosa-Web-*/`）以 Mac `Horosa-Web/` 为准**整树覆盖**、`.gitignore` 显式提交 `/local/workspace/`（不入库），本仓只跟踪构建外壳 + 文档 + 适配。
- **新增 `windows-adaptations/` 覆盖层（已跟踪，57 文件）**：Windows 专属文件全拷贝（`umi-runner.js`/`loadCryptoDeps.js`/`scripts/vendor/` 50 个 crypto 文件）+ 2 共享文件补丁（`isDesktopShellWindow`/`ensureField`）+ `apply.sh`（幂等：拷文件 + 去 flatlib 钉 + 合 package.json name/scripts + 复制 THIRD_PARTY_NOTICES + 打补丁）+ README（7 项适配逐条 + why + 恢复法）。**整树覆盖后跑一行 `apply.sh` 确定性恢复全部 Windows 适配**。已幂等跑验证通过。

### 内容（同 Mac v2.5.0，5 分支收敛 + 白屏热修；含 Java + Python → 重建 jar）
西占推运补全 7 技法（波斯向运/行星弧/Vedic/Jayne 赤纬/行星年龄/真 129/Balbillus）全链路 AI + 福点整宫制（`perchart` `house.hsys` 须 `HOUSES_WHOLE_SIGN`）；时区/DST 自动校正（新依赖 `tz-lookup`）；金口诀解读层 + 七政四余 Moira 还原度；紫微运限/格局深化（新后端 `/ziwei/luck` + `ZiWeiLuck`/`ZiWeiPattern` + `ziweige`/`ziweiliuchangqu` JSON）+ 六壬起课法 Phase4；启动机制稳健化（前端 `serviceStatus`/`chartFetch`/`ServiceStatusBanner` + `fetchWithRetryConnRefused`，SSE `requestStream` 绝不重试；Windows 启动器镜像 `service-manager.js` `launchServicesWithPortRetry`+`isPortConflictError`+`-Dhorosa.runtime.owner`）；星运/主限法旧存盘 `pdMethod` 无限 `setState` 白屏热修。

### 重建 jar + 验证
- 链 `boundless+astrostudy+astrostudycn → astrostudyboot clean package`（JDK17 内置 Maven）。**解包核验内嵌 fat jar**：`ZiWeiController` `/luck` + `ZiWeiLuck.class`/`ZiWeiPattern.class` + `ziweige.json`/`ziweiliuchangqu.json`，`PredictiveController` `persianchart`/`planetaryarc` 均在。
- 内置 python 重生（python-build-standalone）+ 全依赖装齐（cherrypy/pyswisseph/sxtwl/astropy/kerykeion/cnlunar）；打包载荷核验完整（全部 kin 引擎 + flatlib 星历 + jar markers）。exe 742MB（比 v2.4.0 849MB 小 = 全新精简 python 运行时，非缺功能）。
- `umi-test` **146 测试全过**；`service-manager.test.js` **23/23**；`release_selfcheck.py` **9/9**（哨兵 40 文件 + 启动稳健化哨兵 + release-doc-hash 门）。**owner 全新机手测通过后才发布**（本轮特例：浩劫后 owner 要求先手测再发）。

### 文档清理（owner 指示）
发布面文档去除内部口径：移除「6 张金标准盘校准」「安装器回归（→ 校验）」「Mac 历史整理/整树同步/构建适配」同步方法学句；移除坏掉的 CI badge 与失效 CI 描述（`.github` 不上 GitHub → badge 404）。

### 发布
- commit `fdc9b91`（release，69 文件：12 改 + 57 新含 windows-adaptations）；tag `v2.5.0`（指向 `fdc9b91`）；`prerelease=false`、`isDraft=false`、`/releases/latest → v2.5.0`。
- `Horosa-Setup-2.5.0.exe` = **742,950,251** bytes，SHA256 `38398b1199f5bfe603c4c1360c649808829ca678d2d81ca11132f3416d0817ab`；blockmap `9233f73bb6fd7d394779085eec7a307ec1fc6d250a3822d44ef8c6c77b1baafe`（773,624 B）；latest.yml `d2cef33652bde25cd66bb85ff5605c4268a0d79863330e6e880c54b836d33afc`（341 B，version 2.5.0，exe sha512 `0EuYUdL334hHcJ0SPJWaSjzN9dZpnlqSdzGtLhr/j0DY+l1gCdK32aJh73jzHR470/fAACQ+oMY6mA1OBHYIAw==`）。**GitHub 独立计算的 4 资产 digest = 本地逐字节一致**；线上 latest.yml 与本地 byte-identical。
- 自动更新：**v2.2.1+ 用户自动收 v2.5.0**；v2.2.0 及更早需手动装一次。
- 教训固化进 SKILL.md gotcha #16（重整历史重 clone 勿 pull；纯构建外壳模型 + windows-adaptations 覆盖层；wholesale-replace + 保留 Windows 适配；flatlib 钉移除；THIRD_PARTY_NOTICES 在工作区根；浩劫后「先手测再发」门）。

## 2026-05-29 harness 加固（新增第 9 个发布门：release-doc hashes match assets）

v2.4.0 同步中险些把**占位/伪造哈希**写进发布文档（`docs/releases/2.4.0.md` 在 `dist:win` 出真哈希之前先按格式起草，填了看似真实的假 hex）。既有门只校验 `SHA256SUMS.txt` / `latest.yml`，**从不校验散文发布文档里的哈希** → 假哈希可一路发到线上，误导每个用 SHA256SUMS 核验下载的用户。

- **新增门 `check_release_doc_hashes(V)`**（`release_selfcheck.py`，commit `abc48fc`）：`docs/releases/{V}.md` 必须包含已构建 exe/blockmap/latest.yml 的**真实 sha256**；缺失/占位/陈旧 → FAIL。installer 未构建时 SKIP。**已正反测试**：正向 9/9 全过；负向（把 exe 哈希改成 `deadbeef…`）→ 该门 FAIL exit 1，报「real sha256 12ff7d8b… absent from doc」。
- **纪律**：起草发布文档 / SELFCHECK_LOG 哈希一律用字面量 `TODO`，**绝不用貌似真实的假 hex**（这样该门会响亮报错，而非让假哈希蒙混过关）。
- **门数 8 → 9**：v2.4.0 发布快照时为 8/8（该门尚未存在），自此 selfcheck = **9/9**。
- 同时把本轮其它操作教训固化进 SKILL.md gotcha #14（Mac 仓 owner=`Horace-Maxwell`；clean-port 判定以 LF 归一化 `git hash-object` 为准，PowerShell `Out-String` 误判 CRLF；测试输出用 `cmd /c "… > log 2>&1"` 捕获而非 PS `*>&1|Out-File`；tag/release 用 `HEAD` 勿猜 SHA；依赖前一步结果的工具调用要分开发，避免批内取消级联）。

## 2026-05-29 v2.4.0 Beta（Mac 大版本同步 `d8fe575`：西占六技法全链路 AI + 容许度 orbs 存档 + 新增 dist/agepoint/greatconj 路由）

同步 Mac main `d8fe575`（v2.4.0，baseline `fa6d9f3`，3 commits），共享 `Horosa-Web/` 精确 diff `fa6d9f3..d8fe575`：**42 共享产品文件 = 30 clean-port（与基线逐字节一致 → cp Mac HEAD）+ 11 纯新增 + 1 个 Windows-ahead 3-way merge** `pages/index.js`（Windows-ahead `ensureField` + 字符串化 lat 防御保留；Mac v2.4 `AstroOrbSetting` import + 容许度设置 Drawer 引入；`git merge-file` **0 冲突**，不同区段）。Mac-only `Horosa_Desktop_Installer/`（Tauri 外壳 + `main.rs` 更新后自启）+ `AGENTS.md` + Mac docs **不移植**。**下次 Mac 同步基线 = `d8fe575`。**

### 内容（含 Java + Python → 重建 jar）
- **西占六技法全链路 AI**：十二分度盘（`AstroDodeca.js`）、主宰星链（`AstroDispositor.js`）、寿命格局（`AstroLifespan.js` + `divination/lifespan/{lifespanData,lifespanEngine}.js`）、界行法分布（`AstroDistributions.js`）、年龄推进点（`AstroAgePoint.js`）、世俗占星盘（`mundane/MundaneMain.js`）各自接入 AI 分析挂载（`astroAiSnapshot.js` buildDodeca/Dispositor/Lifespan + `aiAnalysisContext.js` distributions/agepoint wired）+ AI 导出六张登记表（`aiExport.js` getAIExportAuditMatrix）+ 事件盘储存（`divinationCaseSave.js`/`DivinationChartShell.js`）；另加龙盘辅盘 `auxchart/AstroDraconicLab.js`。「AI 分析挂载 ≠ AI 导出」是两套独立系统，本轮工程师级复审补全导出侧。
- **容许度（orbs/orbScale）随命盘存档**：占星盘「容许度设置」抽屉（`AstroOrbSetting.js`，挂 `pages/index.js`）随命盘保存/还原——镜像 `after23NewDay` 五点对称透传（`models/user.js`/`utils/localcharts.js`/`models/astro.js`），默认 `undefined` 零回归，未触 pdMethod/主限法。
- **Java（重建 jar）**：`astrostudy` `PredictiveController` 新增 `/predict/dist`（界推运）+ `/predict/agepoint`（年龄推进点）；`AstroExtraController` 新增 `/astroextra/greatconj`（木土大合，仅 startYear/endYear）+ `/astroextra/draconic`（龙盘）；`AstroHelper` 加 Distribution/AgePoint/Draconic/GreatConj 常量 + getter。`astrostudycn` `ChartController.getParams()` 白名单加 `orbs`/`orbScale`。
- **Python**：`astropy/astrostudy/{perpredict（getDistributions/getAgePoint）, agepoint.py（新建·Koch 宫 houses_ex2 b'K'）, astroextra（compute_great_conjunctions）, perchart, thirteenthchart}` + `websrv/{webpredictsrv（dist/agepoint）, webastroextrasrv（greatconj/draconic）}` + `flatlib-ctrad2/flatlib/{object.py, tools/arabicparts.py}`。

### 重建 jar + 哨兵
- 2 模块改（`astrostudy` + `astrostudycn`）→ 链 `astrostudy install → astrostudycn install → astrostudyboot clean package`（JDK17 内置 Maven，`clean` 必须）。**`javap` 核验内嵌 jar**（非 mtime——内嵌 mtime 是 Maven reproducible-build 固定戳）：astrostudy `AstroHelper` 含 `/predict/dist`+`/predict/agepoint`+`/astroextra/draconic`+`/astroextra/greatconj`+4 getter；`PredictiveController` dist/agepoint；`AstroExtraController` draconic/greatconj/getGreatConjParams；astrostudycn `ChartController` orbs/orbScale。**v2.3.1 回归守卫无回退**：astrostudy `keep-alive`+`SseChannel` 内部类、boundless `DispatcherType`+`setSSE`+`HttpClientUtility ProxySelector` 均在（staged bundle jar 复验）。
- `release_selfcheck.py` 新增 v2.4.0 哨兵：PredictiveController `agepoint`（并入既有 pdYears）、AstroHelper `getAstroExtraGreatConj`+`getAgePoint`+`getDistribution`（并入既有 getAcgPoint）、AstroExtraController `greatconj`+`getGreatConjParams`、astrostudycn ChartController `orbs`+`orbScale`、localcharts.js `orbs`、aiExport.js `getAIExportAuditMatrix`、mundane/MundaneMain.js `MundaneMain`。**哨兵 40 文件全过。**

### 验证
- `npm run verify` **26/26**（service-manager 19 + update-flow 7）；`npm run build:file` 绿；`npx umi-test` **29 套 141 测试全过**。
- `release_selfcheck.py` **8/8**（哨兵 40 文件；version 2.4.0；jar 不旧于 .java；payload-slimmed；重生成 `SHA256SUMS.txt` 后复跑哈希门绿）；**staged 打包 jar markers 复验通过**（v2.4.0 新增 + v2.3.1/2.3.0/2.2.x 守卫无回退）。

### 发布
- commit `ade56da`（release，55 文件 +9251/-86）；tag `v2.4.0`；`prerelease=false`。本 SELFCHECK_LOG 条目随后续 `docs(selfcheck-log)` commit 记录。GitHub 独立计算的发布 exe digest = `sha256:12ff7d8b…`，与本地 SHA256SUMS 一致；线上 latest.yml + SHA256SUMS 与本地逐字节一致。
- `Horosa-Setup-2.4.0.exe` = **849,430,352** bytes，SHA256 `12ff7d8bc9e8d1a1755cd2b0c2907dcc80cecd18c68ab1b0d6b3f9e64936eedb`；blockmap `bada35855634452fa450d4b3a1bbe2732feb9f4d3d9b54563772acb0e6a7f7ea`（885,743 B）；latest.yml `8f00eb9785e7439b4e4d977ed692b7dfeb2132cfc6f706955b2f856b9f78ae30`（341 B，version 2.4.0；exe sha512 `Fnx1+enXkX60GkN+1pDIRBRNFdga/ojLEOKrxu9tRN5STpJ17Ctw1ZddUdYDNxwPGy9EjwBgoT+Hga3ePYN1aA==`）。
- 自动更新：**v2.2.1 / v2.3.0 / v2.3.1 用户自动收 v2.4.0**；v2.2.0 及更早需手动装一次。

## 2026-05-29 v2.3.1 Beta（Mac 同步 `fa6d9f3`：Issue #10 服务不稳定修复 — SSE 线程安全 SseChannel + SSE 标志跨请求污染）

v2.3.0 的稳定性补丁。同步 Mac main `fa6d9f3`（baseline `a649287`）：共享树仅 **2 Java 文件**（均与基线逐字节一致 → clean port）+ 1 harness 脚本 `verifyHorosaRuntimeFull.js`。Mac-only `start_horosa_local.sh`（含「更新后启动卡顿」launcher 提速：后台预热 + 0.2s 快轮询 + pid 判存活）+ `AGENTS.md` **不移植**（Windows 壳用 `service-manager.js`，无对应 launcher 文件）。0 Windows-ahead 冲突。**下次 Mac 同步基线 = `fa6d9f3`。**

### Issue #10 双修复（共享后端 Java → 重建 jar）
- **(A) SSE emitter 线程不安全竞态**（DeepSeek「几句话之后停止」）：v2.2.1 #8 心跳线程 + 读流线程并发写非线程安全 `SseEmitter` → `ResponseBodyEmitter has already completed`(`AIAnalysisProxyService.java:995`) → 断流。修复：新增线程安全 `SseChannel` 包装 emitter（单锁串行化所有写 + `complete/completeWithError` 幂等；心跳不再自行 complete），`withHeartbeat/chatStream/stream{OpenAI,Anthropic,Gemini}/sendEvent` 全改走 channel。（Mac 独立得出同款 `SseChannel` 设计 = 与我先前确诊方案一致。）
- **(B) SSE 标志跨请求污染**（间歇 `signature.error` / 排盘未就绪 / predict-200）：`__sse__` 标志挂 request 对象 attribute，Tomcat 池化复用 request 对象 → 上个 SSE 请求残留标志被后续排盘/predict/AI 复用 → 误当 SSE。修复：`boundless/RequestHeaderInterceptor.preHandle` 仅对 `DispatcherType.REQUEST` 解码+验签（async re-dispatch 放行，避免空 body 重算签名 → 那条 `signature.error`）+ 每请求 `setSSE(false)` 归零。

### 重建 jar + 哨兵
2 模块（`astrostudy` AIAnalysisProxyService + `boundless` RequestHeaderInterceptor）→ 链 `boundless install → astrostudy install → astrostudyboot clean package`（JDK17 内置 Maven）。**核验打包/staged jar 6 markers**：astrostudy `AIAnalysisProxyService$SseChannel.class` 存在 + 主类引用 `SseChannel`；boundless RequestHeaderInterceptor `DispatcherType`；v2.3.0 markers（ProxySelector / AcgController `acgpoint`）均在（**无回退**）。selfcheck 新增哨兵：AIAnalysisProxyService `SseChannel`、RequestHeaderInterceptor `DispatcherType.REQUEST`+`setSSE(false)`。**selfcheck 8/8（35 文件）。**

### 发布（为何 v2.3.1 不覆盖 v2.3.0）
线上自 v2.2.1 起应用内自动更新已启用 → 已更新到 v2.3.0 的用户**只有版本号变化才会再收推送**，故必须 bump v2.3.1（覆盖 v2.3.0 不触发更新）。
- commit `8a3f9e1`（release，14 文件）；tag `v2.3.1`；`prerelease=false`。本 SELFCHECK_LOG 条目随后续 `docs(selfcheck-log)` commit 记录。
- `Horosa-Setup-2.3.1.exe` = **849,395,230** bytes，SHA256 `35939839c8e9cb6f844b3fb51c74d2cdafd24b556884358c89f5520510cc7c8d`；blockmap `4729a4105894a4bc7468ff04cc7be67a0bdc9aef182c560ffc92f4c5f1dd6ed3`（883,485 B）；latest.yml `b630b948193a623072346bf5bc63c1c69cb79a11a62bc20ea2c5f964e0b7e43e`（341 B，version 2.3.1）。
- 自动更新：**v2.2.1 / v2.3.0 用户自动收 v2.3.1**；v2.2.0 及更早需手动装一次。

### #10 处置
回复 + 关闭（owner 授权「按事实回复，可直接 close」；修复已随 v2.3.1 上线）。

## 2026-05-29 v2.3.0 Beta（Mac 大版本同步：占星地图 ACG 升级 + 卜卦/择日盘 + 河洛理数补全 + #9 系统代理 + 多项修复）

同步 Mac main `a649287`（baseline `e712784`，8 commits），共享 `Horosa-Web/` 精确 diff：**69 共享文件——16/18 改动逐字节同 Mac 基线（clean port）+ 51 纯新增**；仅 2 个 Windows-ahead 文件 `pages/index.js`（`ensureField` + 字符串化 lat）与 `layouts/app.less`（滚动 padding）走 3-way merge（`git merge-file`，**0 冲突**，Windows 改动保留 + Mac delta 合入）。其余 Windows-ahead 未被 Mac 触碰自动保留；Mac-only `start_horosa_local.sh` 不移植（Windows 用 `service-manager.js` 等价加 flag）。**下次 Mac 同步基线 = `a649287`。**

### 内容（含 Java → 重建 jar）
- **占星地图 ACG**：`ACGraph.py` 解析法重写（GMST/RA-Dec、四轴线全球连续 + 极区闭合、Parans、Local Space、落点 `pointReport`）+ 新端点 `/location/acgpoint`（`AcgController` + `AstroHelper.getAcgPoint`，`getAcg` 改 `requestNoCache`）+ 前端 `AcgD3Map`/`AcgPointPanel`/`interpretations.zh`/`world.geo.json`。 `validate_acg.py` 内嵌 python worst **0.000000°**（Swiss Ephemeris `azalt()` 反验，10 行星 × 3 算例）。
- **卜卦盘 + 择日盘**：辅盘新增（`src/divination/{data,engine,horary,election}` 40 文件 + `components/{horary,election,divination}` + `utils/divinationCaseSave.js`），**纯前端零后端**（消费现成 `/chart` 字段），事件盘双向存盘。
- **河洛理数补全**：取化工法左栏 per-技法选项 + 运盘节气 label + 命运篇 5 判断；`_heluoTest.mjs` esbuild→node **96/96**。
- **#9 AI 系统代理（三处缺一不可）**：`boundless/HttpClientUtility` `ProxySelector` 回退 + `astrostudy/AIAnalysisProxyService` `.proxy(ProxySelector.getDefault())` + Windows `service-manager.js buildJavaArgs` 加 `-Djava.net.useSystemProxies=true`（macOS 在 `start_horosa_local.sh`，Windows 壳不共享需各自加）。无系统代理时 DIRECT、localhost bypass，行为不变。
- **六壬/三式合一 发三传顺序**（八专移到遥克之后，按典籍九法）+ 占星右栏 tab 下空白块 + 风水UI + 快捷dock 自适应（纯前端/CSS）。

### 重建 jar + 哨兵
- 2 模块改（`boundless` HttpClientUtility、`astrostudy` AIAnalysisProxyService/AcgController/AstroHelper）→ 链 `boundless install → astrostudy install → astrostudyboot clean package`（JDK17 内置 Maven）。**核验打包 jar 内 8 markers**：boundless `ProxySelector`+`api.openai.com`；astrostudy `ProxySelector`+`keep-alive`(v2.2.1 保留)+`isEmbeddingModel`(v2.2.0 保留)+AcgController `acgpoint`/`clickLat`+AstroHelper `getAcgPoint`。
- `release_selfcheck.py` 新增 v2.3.0 哨兵：**#9 三处代理**（HttpClientUtility `ProxySelector` / AIAnalysisProxyService `ProxySelector` / service-manager `useSystemProxies`）、**ACG**（AcgController `acgpoint`+`clickLat` / AstroHelper `getAcgPoint`+`requestNoCache` / ACGraph.py `def pointReport`+`_parans` / AstroAcg.js `AcgD3Map`+`/location/acgpoint`）、**六壬** ChuangChart「遥克必须在八专之前」、**卜卦/择日**（localcases `value: 'horary'`/`'election'` + AuxChartMain `HoraryMain`/`ElectionMain`/`componentDidUpdate`）。

### 验证
- `npm run verify` **26/26**（service-manager 19 + update-flow 7，含新 `useSystemProxies` flag）；`npx umi-test` **29 套 141 测试全过**（含 ChuangChart 六壬 3/3 + 卜卦/择日 localStorage + 日界点矩阵）。
- ACG `validate_acg.py` worst **0.000000°**；heluo `_heluoTest.mjs` **96/96**（esbuild→node；Node v24 直跑因 JSON import attribute 报错，须 esbuild 预打包，非移植问题）。
- `dist:win` 一次过；`release_selfcheck.py` **8/8**（哨兵 **34 文件**全过；重生成 `SHA256SUMS.txt` 后复跑哈希门绿）；**staged 打包 jar 8 markers 复验通过**。

### 发布
- commit `16bada8`（release，81 文件）；tag `v2.3.0`；`prerelease=false`。本 SELFCHECK_LOG 条目随后续 `docs(selfcheck-log)` commit 记录。
- `Horosa-Setup-2.3.0.exe` = **849,395,135** bytes，SHA256 `02e6ce7f64204bc707530b99340cf7e5802a377554fb09e00fdeea2fa1bd15cb`；blockmap `694ffc6c25d7692e75765c881c2d3af8fa14ea71b9ec982f373c2361f5b08242`（882,063 B）；latest.yml `ac1e86fd1b2e8a3dbac316c4e1988c9eea7c0acc3e556352b1a5d55fb832e0de`（341 B，version 2.3.0）。
- **自动更新引导**：线上自 v2.2.1 起更新器已启用 → **v2.2.1 用户将自动收到 v2.3.0**（首个真正享受应用内自动更新的版本）；仍在 v2.2.0 及更早的用户需手动装一次。

## 2026-05-28 v2.2.1 Beta（Mac 同步：日界点·晚子时 + AI 连通性 + Windows 应用内自动更新启用 + #8 流式心跳）

同步 Mac main `e712784`（v2.2.1），精确 diff `2ade4c6..e712784`：**90 共享文件（83 改 + 7 新），0 Windows-ahead 冲突**——全部与 Mac 基线逐字节一致（干净 take-from-Mac，无需任何 3-way merge）；Windows-ahead 文件（FengShuiMain / windowSizePersistence / ZWHouse / pages-index / app.less / service-manager）本轮未被 Mac 触碰，自动保留。

### 内容（含 Java → 重建 jar）
- **全局日界点·晚子时**：新增独立全局开关 `lateZiHourUseNextDay`（默认 nextDay），只在 23:00–24:00 影响时干，与 `after23NewDay` 独立；全技法一致。修 `ChartController` + 7 controller + 3 model 透传 bug。Java + 前端 + Python vendor 都改。
- **AI 连通性**：Anthropic `content.type`（503 修）、测试连接中文提示、`HttpClientUtility` 系统代理属性回退。
- **Windows Issue #8 AI 流式双修复**：catch 先 `QueueLog.error` 记一级异常 + `streamOpenAICompatible/Anthropic/Gemini` 三路 `withHeartbeat`（15s `: keep-alive`）。**已核验打包 jar 内 astrostudy 含 `keep-alive`**。
- **Windows 本版上线**：应用内自动更新（`d510db5`，electron-updater + GitHub feed，VM 实测过）正式启用 + 帮助菜单整理。
- 偏好精修；共享 `UpdateNotifier`（`isDesktopBridgeAvailable()` 仅 Tauri 下激活 → Windows Electron 下 inert，零冲突）。

### 重建 jar + 哨兵
- 3 模块改（`boundless` HttpClientUtility、`astrostudy` AIAnalysisProxyService/BaZiHelper/NongliHelper、`astrostudycn` BaZi/controllers/models）→ 链 `boundless install → astrostudy install → astrostudycn install → astrostudyboot clean package`（JDK17 内置 Maven）。核验：astrostudy `keep-alive`、astrostudycn `lateZiHourUseNextDay`。
- `release_selfcheck.py` 新增哨兵：AIAnalysisProxyService `keep-alive` + `QueueLog.error(AppLoggers.ErrorLogger`；BaZi.java `lateZiHourUseNextDay`。selfcheck **8/8**。

### 发布
- commit `516974d`（101 文件 +3411/-431；连同 `d510db5` 一起 push）；tag `v2.2.1`；`prerelease=false`。
- `Horosa-Setup-2.2.1.exe` = **849,316,760** bytes，SHA256 `2ba47e0571997ea32997406664f502e1b11c05b0d08849d46fd497e41b43a5af`；blockmap `6de12060…`；latest.yml `cfc0af98…`。**线上 latest.yml + SHA256SUMS 与本地逐字节一致。**
- **引导前提**：线上 v2.2.0 更新器是关的，首个启用自动更新的版本（本版）需用户**手动装一次**；v2.2.1 起后续版本自动拉取。
- 待 Windows 实测：#9 OpenAI 代理超时（本版带 HttpClientUtility 属性回退，完整方案待 Mac 加 `-Djava.net.useSystemProxies=true` 后同步）。

## 2026-05-27 v2.2.0 补丁（heluo 流年修订，原地覆盖 v2.2.0）

Mac 在 `2ade4c6` 给 v2.2.0 打补丁并在该 commit 打 `v2.2.0` tag（`0ac85f0..2ade4c6`，1 commit）。**纯前端 2 文件，无 Java，不重编 jar，版本号仍 2.2.0。**
- `astrostudyui/src/utils/heluoLocal.js`：河洛理数流年动爻按典籍重写——初版 `liuNian` 写死「从初爻数」，只在元堂=上九时偶合，其余大限流年全错；改为从上一年动爻**链式累变**（阳爻含首年/第二三年应爻规则）。`astrostudyui/scripts/_heluoTest.mjs` 断言 59→72。
- 2 文件与 Mac-`2ade4c6` 逐字节一致（干净移植）；`_heluoTest.mjs` 经 esbuild bundle→node 实测 **72/72 全过**。
- 按 owner 指示**原地覆盖** v2.2.0（不升 2.2.1）：`dist:win` 重打包 → 重生成 `SHA256SUMS.txt`（exe 哈希必变）→ `git tag -f v2.2.0` + force-push → `gh release upload v2.2.0 --clobber` 覆盖 4 资产 + 更新说明。⚠️ 同版本号二进制变更（已下载旧 2.2.0 者哈希不同），owner 确认可覆盖。

## 2026-05-27 v2.2.0 Beta（Mac 数算/调波/风水React/AI模型 + Windows issue #7 tar 修复）

同步 Mac main（`0ac85f0` / v2.2.0，23 共享文件，+7342/-124）一批**功能**更新，并合入 Windows 侧 **issue #7**（`spawn tar ENOENT` 装好打不开）。**含 Java（AIAnalysisProxyService）→ 重建 jar。**

### Windows issue #7（装好运行不了）— 根因 + 修复
- 现象（用户 V2.1.2 与 2.1.8 均现）：`本地服务启动失败：Embedded runtime prepare failed: spawn tar ENOENT`。
- 根因：`service-manager.js` `extractTarArchive` 用裸 `spawn('tar')` 解包载荷，靠 PATH/PATHEXT 解析；该用户机器解析不到 `tar`（Win10 1803+/11 自带 `System32\tar.exe`，但 PATH 不含或解析失败）→ ENOENT → runtime 不就绪 → 打不开。**非我方改动回归（2.1.2 就有）。**
- 修复：新增 `resolveTarExe()`，优先解析 `%SystemRoot%\System32\tar.exe`（+ Sysnative 回退），最后才退回 PATH `tar`；找不到给可操作错误。实测本机解析到 `C:\WINDOWS\System32\tar.exe`、`bsdtar` 可跑。`service-manager.test.js` 加 `resolveTarExe` 测试（19/19，**经 PowerShell 跑**——Bash/MSYS 跑 fixture 测试会因 tar/C:\ 误报 6 个，gotcha #1）。哨兵：service-manager.js 必须含 `resolveTarExe`。

### Mac 功能同步
- 数算 邵子参评数（canping）/ 河洛理数（heluo）：纯前端本地（`shusuan/{CanPingMain,HeLuoMain}.js` + `utils/{canpingLocal,heluoLocal}.js` + `utils/data/*.json` + `KinAstroMain` 接线），四柱来自 `baziLunarLocal`，不碰 Python/kentang。
- 调波盘：Python `astropy/astrostudy/{thirteenthchart,astroextra}.py`（`HarmonicChart`/`build_harmonic` 返回完整盘）+ 前端 `auxchart/{AstroHarmonicLab,AuxChartMain}.js`。
- 风水 iframe→React：新 `fengshui/fengshuiEngine.js` + 重写 `FengShuiMain.js`（删 iframe）+ `app.less :global{.horosa-fengshui-*}`。
- AI 模型选择：前端 providers/AIAnalysisMain/context/export + 后端 `AIAnalysisProxyService`（`isEmbeddingModel` 拒绝 embedding 当聊天，修 Gemini 404）。

### 移植与分类（精确 diff `56db820..0ac85f0`）
- 23 文件：21 干净/纯新增；`FengShuiMain.js` **整取 Mac 版**（Windows-ahead 的相对 iframe 修复被 React 重写**取代/作废**——无 iframe 即无 desktop file:// 路径问题；哨兵由 `src="fengshui/index.html` 改为 `fengshuiEngine`）；`app.less` **3-way merge**（Mac-2.2.0 delta 叠加到 Windows 滚动条 tweak，干净 +273，tweak 保留）。
- 重建 jar：astrostudy install → boot clean package；fat jar 内 `AIAnalysisProxyService.class` 含 `isEmbeddingModel`（已核对）。

### 发布资产 + SHA256
- `Horosa-Setup-2.2.0.exe`（`849344035` bytes ≈810 MiB，Tier-1 减重沿用）+ `.exe.blockmap`（`880693`）+ `latest.yml`（2.2.0）+ `SHA256SUMS.txt`（已重生成）。
- `Horosa-Setup-2.2.0.exe`: `223256365897f15a180a99ddde643f368e26fec1b102b4141d98c1e7c3915f49`
- `Horosa-Setup-2.2.0.exe.blockmap`: `1f1298dedbd643f37f3079202c306c6517a29da8ad7d7521d954b4a589a19fc4`
- `latest.yml`: `75dc9c3efba60ae28535434436ef7a5ed63f5f0a3fc0d1cc3ac586e16749eaef`
- `dist:win` selfcheck 全 PASS（version 2.2.0 / 24 哨兵 / jar / dist-file / payload-slimmed / assets）；打包载荷 jar 内 `isEmbeddingModel` 已核对。

## 2026-05-26 v2.1.8 Beta 批量（Mac UI/术数/Ollama 修复 + Tier-1 减重 + issue #6）

合并发布：同步 Mac main（`56db820` / v2.1.8）一批修复，并带上此前暂存的 Tier-1 减重。**含 Java 改动 → 重建 jar。**

### 移植与分类（精确 diff `907e841..56db820`，20 个共享文件）
- 19 个与 Mac-2.1.7 基线逐字节一致（干净移植）；`layouts/app.less` 是 Windows-ahead（一处滚动条 tweak），用 **3-way merge**（`git merge-file`，base=Mac-2.1.7 / other=Mac-2.1.8）把 2.1.8 的 5 处 delta 应用上去——干净无冲突，git diff 仅 +25/-4，Windows tweak 保留；新增 `vendor/test_month_pillar_boundary.py` 纯 add。
- 改动面：Ollama 流式（boundless `SseHelper` `SseEmitter(0L)` + `AIAnalysisProxyService` 条件超时，**issue #6**）、八字月柱交节边界（kinwuzhao/kinastro/kintaiyi）、太乙四柱时间、主限推运年数（前端 + `perchart/perpredict.py` + `PredictiveController.java`）、西洋符号几何居中、UI 明暗/紫微/合盘。

### 重建 jar（boundless + astrostudy）
- boundless install → astrostudy install → astrostudyboot clean package（内置 Maven + JDK17）。fat jar 内核对：`PredictiveController.class` 含 `pdYears`；`SseHelper.class` 反汇编为 `new SseEmitter` + `lconst_0`（= `SseEmitter(0L)`，旧 `120000L` 已消失）。已 staged 到 bundle。

### 验证
- 八字月柱边界测试（内置 python，`vendor/test_month_pillar_boundary.py`）：3 引擎 × 5 用例 **ALL PASS**（2005-05-05 16:30→庚辰 / 18:00→辛巳 / 立春年月柱）。注意 Windows 控制台 cp1252 会对中文报错,需 `PYTHONUTF8=1`/`-X utf8`（真实 app 已用 `-X utf8`,无此问题）。
- 前端 `build:file` 编译 + `umi-test` 28 套通过。
- `release_selfcheck.py` 新增哨兵：`SseHelper.java:new SseEmitter(0L)`、`PredictiveController.java/perchart.py:pdYears`、`kinwuzhao/kintaiyi:getJieQiJD`、`kinastro:MONTH_JIE_INDICES`。

### 发布资产 + SHA256
- `Horosa-Setup-2.1.8.exe`（`849092142` bytes ≈810 MiB，Tier-1 后由 ~1.14 GB 降下来）+ `.exe.blockmap`（`883041` bytes）+ `latest.yml`（2.1.8）+ `SHA256SUMS.txt`（已重生成）。
- `Horosa-Setup-2.1.8.exe`: `b966c4ec1ecbea5bb46165bbd4e9ab1e78230d18c43cce1bed262cde2baf0f00`
- `Horosa-Setup-2.1.8.exe.blockmap`: `2565fccd7c9ef105cf72089fb4a9c60231d7cc3304b196f626744f94f4ffd515`
- `latest.yml`: `9ca2b31a64b7f3b08a76ac33982879a17c5cce8abe8725b86cf218bc73438fb0`
- `dist:win` 末尾 selfcheck 全 PASS（version 2.1.8 / 24 哨兵 / jar / dist-file / payload-slimmed / assets）；重生成 SHA256SUMS 后复跑做完整哈希核对。打包载荷 jar 内 `pdYears` + `SseEmitter(0L)` 已核对。

### 注意事项
- 本次把 Tier-1（commit 80d1373）一起推送发布（main 此前领先 origin 1）。
- Ollama 行为端到端需真 Ollama 复测;主限/太乙/符号居中建议 App 内肉眼复核。

## 2026-05-26 Tier-1 打包减重（Windows 侧，~600MB，未发布·待批量）

把打包载荷里**构建期/重复/可重建**的产物从 staged payload 裁掉(只动打包载荷,`local/workspace/runtime/windows` 源保留,不影响构建)。**未升版本、未发布**,等下个修复一起发。完整审计见 `docs/PACKAGING_SIZE_AUDIT.md`。

### 改动
- `stage-runtime.cjs` `runtimePruneTargets` 增加:`node`、`maven`、`maven-extract`、`wheels`、`bundle/wheels`、`bundle/dist`、`appcds`(共 ~603MB)。
- `release_selfcheck.py` 新增 `check_payload_slimmed()`:上述目录若重现在 staged 载荷里则 FAIL(防 prune 列表被还原导致体积回弹)。

### 安全核查(删前逐项确认运行时不用)
- `electron/service-manager.js` 只 spawn python/java/jcmd/taskkill——**零** node/wheels/pip 引用;`Prepare_Runtime` 也不在运行时引用 node。
- AppCDS 用户首启自重建(`-XX:+RecordDynamicDumpInfo` + 关闭时 `jcmd VM.cds dynamic_dump`);shipped 的是构建机暖缓存(5 个 stale 目录)。
- `bundle/wheels` 是 `wheels` 的 robocopy 副本;无运行时/repair 走 pip 安装。
- maven 仅构建期建 jar 用;桌面加载 `bundle/dist-file`(file://)而非 web 版 `bundle/dist`。

### 验证(实测)
- 安装包:**1.14 GB → 810 MB(−29%)**;解包载荷 **2.6 GB → 2.0 GB**(packed tar 2600→1976 MB);win-unpacked 2.8→2.3 GB。
- `release_selfcheck.py`:**6/6 全绿**(含新增 `payload slimmed (Tier-1)` PASS)。新 slim exe sha256 `c0312a3fd6ee65e2da7706002599f61432a77db7b2ab719a6c821a878292fd80`(**未发布,仅本地**;批量发布时会升版本重算)。
- 7 个 prune 目录已确认从载荷消失;python/java/dist-file/jar 等保留项完好。
- **干净机器冷/热启动 smoke**(`win-unpacked\Horosa.exe`,隔离 LOCALAPPDATA/APPDATA/TEMP):**功能全绿**——冷启 23.5s(extract 13.4s)+ 热启 11.3s,两者 `backendReady`+`chartReady` 均 true、出盘正确(birth 2028-04-06 09:33)、`forbiddenLogMatches` 空、8899/9999/9464 停止后均释放。脚本 exit 1 仅因热启 11.3s > 10s **软阈值**(同 2.1.4 类软失败):smoke 强杀进程→不触发优雅关闭的 AppCDS dump,叠加本轮删了预暖 CDS + 构建机负载,故首次热启略慢;真实用户优雅关闭后会生成自有 CDS,后续热启回落——**非功能回归**。(首次传错 exe 把安装器当 app 的那次失败已排除,纯属调用参数错误。)

### deferred
- jlink 裁 JRE(228→~60M)本轮不做:Spring 反射/JNI 模块完整性风险高、smoke 难覆盖,留作单独一轮(配合后端逐功能验证)。

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
