# Horosa Windows 自检日志

最后更新：2026-05-29

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
- commit `TODO`（release）；tag `v2.4.0`；`prerelease=false`。本 SELFCHECK_LOG 条目随后续 `docs(selfcheck-log)` commit 记录。
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
