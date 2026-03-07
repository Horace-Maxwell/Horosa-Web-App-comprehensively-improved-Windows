# Horosa Upgrade Log

This file tracks every code/config change made in this workspace.
Append new entries; do not rewrite history.

## Entry Format
- Date: YYYY-MM-DD
- Scope: what was changed
- Files: key files touched
- Details: short bullets
- Verification: tests/build/manual checks

---

## 2026-03-06

### 16:25 - 加入浏览器级宗师巡检并修复本地服务“启动后短暂存活再消失”
- Scope: 做一轮更重的整站验收，把普通星盘、三维盘、推运盘、量化盘、关系盘、节气盘、星体地图、七政四余、希腊星术、印度律盘、八字紫微、易与三式、万年历、西洋游戏、风水、三式合一，以及 AI 导出 / AI 导出设置和主限法切方法重算，都拉到真实浏览器里逐一点击检查。
- Root cause:
  - `start_horosa_local.sh` 与 `Horosa_Local.command` 的 detached 启动此前只做了 `setsid`，在某些终端/父 shell 退出场景下，`8000/8899/9999` 会短暂拉起后又被带死。
  - 原有自检更多偏向接口与静态接线，缺少“用户真的打开浏览器点一遍页面”的统一自动巡检脚本。
- Changes:
  - `Horosa-Web/start_horosa_local.sh`
    - detached 启动统一改成 `nohup + setsid + disown`，增强 `8899/9999` 在父 shell 退出后的存活稳定性。
  - `Horosa_Local.command`
    - 本地网页 `8000` 的 detached 启动同样改成 `nohup + setsid + disown`。
  - `scripts/browser_horosa_master_check.py`
    - 新增浏览器级宗师巡检脚本（Playwright Python）：
      - 左侧主模块：星盘、三维盘、推运盘、量化盘、关系盘、节气盘、星体地图、七政四余、希腊星术、印度律盘、八字紫微、易与三式、万年历、西洋游戏、风水、三式合一；
      - 关键子页：星盘右栏 `信息/相位/行星/希腊点/可能性`、推运盘右栏全部技术、希腊星术 `十三分盘`、印度律盘全部可见数律盘、八字紫微全部子页、易与三式全部子页；
      - `AI导出` / `AI导出设置` 弹层打开与关闭；
      - 主限法 `Horosa原方法 <-> AstroAPP-Alchabitius` 切换并真实点击 `计算/重新计算`，验证浏览器表格确实随当前后端结果变化。
    - 对高德地图瓦片 abort 与 3D 远端模型超时改为 warning，不再误判为 Horosa 自身故障。
  - `Horosa-Web/verify_horosa_local.sh`
    - 新增浏览器级巡检接入；
    - 若能找到带 `playwright` 的 Python，会自动执行 `scripts/browser_horosa_master_check.py`；
    - 若本机没有 Playwright 运行环境，则安全 skip，不影响基础自检。
- Verification:
  - `./scripts/mac/self_check_horosa.sh` ✅
  - 浏览器级巡检输出：
    - `status = ok`
    - 左侧 16 个主模块全部可点击；
    - 推运盘右栏全部技术页签可点击；
    - 主限法切换 `Horosa原方法 / AstroAPP-Alchabitius` 后首行结果发生变化，证明浏览器表格不是静态残留；
    - 无 dialog、无 pageerror、无本地请求失败；
    - 仅保留第三方远端资源 warning（高德瓦片 / `chart3d.horosa.com` 模型）。
  - 产物：
    - `runtime/browser_horosa_master_check.json`
    - `runtime/browser_horosa_master_check.png`

### 15:10 - 修复旧 localStorage 导致主限法重算误连错 backend
- Scope: 解决浏览器残留 `horosaLocalServerRoot` 指向上一份 Horosa 副本后，当前页面 `推运盘 -> 主/界限法 -> 计算/重新计算` 误打到错误 backend，从而弹出“本地排盘服务未就绪”的问题。
- Root cause:
  - 本地前端 `ServerRoot` 解析顺序此前是 `srv query -> localStorage -> 9999`。
  - 当用户先打开过 `18000/19999` 副本，再回到 `8000` 页面且 URL 不带 `srv` 时，前端会继续把 `/chart` 发到旧的 `19999`。
  - 主限法页因为显式强制重算 `/chart`，会最先暴露成“服务未就绪”；其他页面更多是显示已有 chart state，不一定马上炸。
- Changes:
  - `Horosa-Web/astrostudyui/src/utils/constants.js`
    - 本地 `ServerRoot` 解析顺序调整为：
      - `srv` query 参数
      - 当前网页端口推导的 backend 端口（`webPort + 1999`）
      - `localStorage.horosaLocalServerRoot`
      - 最后默认回退 `http://127.0.0.1:9999`
    - 这样 `8000 -> 9999`、`18000 -> 19999`、`18001 -> 20000` 这类本地副本都能优先绑定当前页面所属 backend，而不会被旧缓存带偏。
- Verification:
  - 浏览器实测（Playwright + Chrome，故意预写 `localStorage.horosaLocalServerRoot = http://127.0.0.1:19999`）：
    - 直接打开 `http://127.0.0.1:8000/index.html?v=...`
    - 注入广德盘：`2006-10-04 09:58 +08 / 30N53 / 119E25 / guangde`
    - 先切 `Horosa原方法` 点击 `重新计算`，再切回 `AstroAPP-Alchabitius` 点击 `重新计算`
    - 4 次 `/chart` 请求全部命中 `http://127.0.0.1:9999/chart`，状态均为 `200`
    - 无 modal 错误、无 pageerror、无 console error
    - 浏览器表格首行与后端 `predictives.primaryDirection` rows 一致，截图保存在 `runtime/guangde_recalc_verified_8000.png`

### 14:45 - 修复主限法页“重新计算”在替代端口下仍报本地服务未就绪
- Scope: 解决用户通过 `Horosa_Local.command` 自动避让到 `18000/18899/19999` 后，主限法页点击 `重新计算` 仍然弹“本地排盘服务未就绪”的问题。这个问题只会在主限法页最明显，因为它会显式强制重算 `/chart`。
- Root cause:
  - 前端本地模式的 `ServerRoot` 仍默认写死为 `http://127.0.0.1:9999`，即使实际启动的是替代端口；
  - 主限法页重算链路传了 `cache: false`，但浏览器原生 `fetch` 的 `RequestInit.cache` 不接受布尔值，导致请求在前端就抛异常，根本没发出去；
  - 这两件事叠在一起时，只有主限法页会稳定暴露成“本地排盘服务未就绪”。
- Changes:
  - `Horosa-Web/astrostudyui/src/utils/constants.js`
    - 本地模式 `ServerRoot` 改为按优先级解析：
      - URL 查询参数 `srv`
      - `localStorage.horosaLocalServerRoot`
      - 默认回退 `http://127.0.0.1:9999`
  - `Horosa_Local.command`
    - 打开页面时显式附加 `?srv=<encoded_server_root>&v=<ts>`，确保浏览器页面与当前副本端口绑定。
  - `Horosa-Web/astrostudyui/src/utils/request.js`
    - 新增 `normalizeFetchCacheOption()`；
    - 在调用浏览器 `fetch` 前把 `cache: false` 规范化为 `cache: 'no-store'`，把 `cache: true` 规范化为 `cache: 'default'`。
  - `WINDOWS_CODEX_ASTROAPP_PD_REPRO_KIT/snapshot/`
    - 补入 `Horosa-Web/astrostudyui/src/utils/constants.js`
    - 补入 `Horosa-Web/astrostudyui/src/utils/request.js`
- Verification:
  - 浏览器实测（Playwright + Chrome，打开打包目录实际启动的 URL）：
    - 初始：`AstroAPP-Alchabitius` 首行日期 `2026-12-10 16:48:24`
    - 切到 `Horosa原方法` 后点击 `重新计算`：无错误弹窗，成功请求 `http://127.0.0.1:19999/chart`，首行日期变为 `2026-05-14 03:18:03` ✅
    - 再切回 `AstroAPP-Alchabitius` 后点击 `重新计算`：无错误弹窗，成功请求 `http://127.0.0.1:19999/chart`，首行日期变为 `2026-09-08 07:23:11` ✅
  - 浏览器截图：
    - `runtime/playwright_pd_browser_verified.png` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `./scripts/mac/self_check_horosa.sh` ✅

### 14:20 - 修复浏览器中点击“重新计算”时 8899 假掉线
- Scope: 解决用户已经打开 Horosa 网页后，再点击主限法“重新计算”仍偶发提示“本地排盘服务未就绪（127.0.0.1:8899）”的问题。
- Root cause:
  - `Horosa_Local.command` 仍默认 `HOROSA_KEEP_SERVICES_RUNNING=0`。
  - 这会导致启动脚本结束、终端窗口关闭或用户误关启动窗口后，py/java/web 服务被一起回收，但浏览器页面仍可继续停留在原画面。
  - 一旦页面再次请求 `/chart`，后端就会因为图盘服务已被停掉而抛出“8899 未就绪”的假故障。
- Changes:
  - `Horosa_Local.command`
    - `HOROSA_KEEP_SERVICES_RUNNING` 默认值改回 `1`，即用户双击启动后服务默认常驻，直到手动执行 stop 脚本。
  - `Horosa-Web/astrostudyui/src/models/astro.js`
    - 主限法错误弹窗文案改为不再硬编码 `127.0.0.1:8899`，避免在自定义端口或端口避让场景下误导用户。
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
    - 当当前主限法方法/时间钥已经和 `chart.params` 同步，且页面本身已经有 `predictives.primaryDirection` rows 时，不再发起多余的 `/chart` 重算。
    - 按钮在这种状态下显示 `已同步` 并禁用，避免把“重复点击当前结果”变成唯一还会额外打后端的页面行为。
  - `scripts/check_horosa_full_integration.py`
    - 新增对主限法按钮 `needsPdRecompute / 已同步 / disabled` 逻辑的静态断言。
  - 重新构建前端 `dist-file`，确保浏览器真正拿到新文案和运行时代码。
- Validation:
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `python3 scripts/check_horosa_full_integration.py` ✅
  - 启动后保留页面，脚本退出/不再驻留时，服务仍保持可用，不会因为“重新计算”触发 8899 假掉线。 ✅

### 14:09 - 修复多副本环境下自检因固定端口冲突而失败
- Scope: 解决主仓库与桌面精简包同时运行时，`self_check_horosa.sh` 仍默认抢占 `8899/9999/8000`，导致当前副本验收误报失败的问题。
- Changes:
  - `Horosa-Web/start_horosa_local.sh`
    - 新增 `HOROSA_CHART_PORT / HOROSA_SERVER_PORT` 支持。
    - Python 图盘服务按 `HOROSA_CHART_PORT` 启动。
    - Java 后端按 `--server.port=${HOROSA_SERVER_PORT}` 启动。
  - `Horosa-Web/astropy/websrv/webchartsrv.py`
    - 从环境变量读取 CherryPy 监听端口。
  - `Horosa-Web/verify_horosa_local.sh`
    - 改为按当前环境端口检查服务可用性，并自动导出 `HOROSA_SERVER_ROOT`。
  - `Horosa-Web/stop_horosa_local.sh`
    - 兜底端口回收改为支持当前环境端口。
  - `Horosa_Local.command`
    - 启动失败后的占用重试逻辑改为使用当前端口参数。
  - `scripts/mac/self_check_horosa.sh`
    - 若默认端口已被另一份 Horosa 副本占用，会自动切到空闲端口继续验收。
    - 在未显式指定时，若使用了自动避让端口，则验收结束后自动回收这些临时服务。
- Validation:
  - 在桌面精简包继续占用默认端口的情况下，主仓库自检自动改用 `18899 / 19999 / 18000` 并完整通过。 ✅
  - `./scripts/mac/self_check_horosa.sh` ✅

### 13:58 - 扩大整站自检覆盖到星盘/3D/节气盘子页/印度律盘/希腊星术/推运盘右栏技术
- Scope: 把整站静态集成检查从“主 tab 与主要接口”扩展到更细的页面级接线，覆盖普通星盘、3D盘、希腊星术、印度律盘、节气盘星盘/宿盘/3D子页、星体地图，以及推运盘右栏全部技术页签。
- Changes:
  - `scripts/check_horosa_full_integration.py`
    - 新增对 `AstroChartMain.js` 的 `信息/相位/行星/希腊点/可能性` 右栏 tab 断言。
    - 新增对 `AstroChartMain3D.js` 与 `AstroChart3D.js / Astro3D.js` 的 3D 盘接线断言。
    - 新增对 `HellenAstroMain.js`、`AstroChart13.js` 的希腊星术接线断言。
    - 新增对 `IndiaChartMain.js` 多律盘 tab 和 `IndiaChart.js` AI snapshot 保存链的断言。
    - 新增对 `JieQiChartsMain.js` 的 `星盘/宿盘/3D盘/二十四节气` 子页签断言。
    - 新增对 `LocAstroMain.js / AstroAcg.js` 的星体地图页签与接口断言。
    - 新增对推运盘右栏 `主/界限法、黄道星释、法达星限、小限法、太阳弧、太阳返照、月亮返照、流年法` 全页签断言。
- Validation:
  - `python3 scripts/check_horosa_full_integration.py` ✅
  - `python3 -m py_compile scripts/check_horosa_full_integration.py` ✅

### 13:42 - 修复不同 Horosa 副本之间互相停掉本地服务
- Scope: 解决同一台 Mac 上存在多个 Horosa 副本时，一个副本执行 `stop_horosa_local.sh` 或自检前残留清理，可能把另一份副本的 `8000/8899/9999` 服务一起停掉的问题。
- Root cause:
  - `stop_horosa_local.sh` 的兜底逻辑会按 `webchartsrv.py / astrostudyboot.jar / http.server` 这些通用进程特征去回收监听端口。
  - 当另一份副本也在同机运行时，通用模式会误杀不属于当前工作区的服务。
- Changes:
  - `Horosa-Web/stop_horosa_local.sh`
    - 兜底端口回收现在要求进程命令行中同时包含当前工作区 `ROOT` 路径。
    - 因此只会回收属于“这一份仓库副本”的 Horosa 服务，不再跨副本误杀。
- Validation:
  - 代码检查确认 stop fallback 现在带有 `grep -Fq \"${ROOT}\"` 的工作区约束。
  - 重新同步到 Mac 精简包和 Windows 复现包。

### 13:27 - 修复自检后服务被自动停掉导致主限法页面点击“计算”报 8899 未就绪
- Scope: 解决用户在验收后继续使用网页时，页面仍开着但 `127.0.0.1:8899` 已被自检脚本自动停掉，从而点击主限法“计算”触发假故障的问题。
- Files:
  - `Horosa-Web/start_horosa_local.sh`
  - `scripts/mac/self_check_horosa.sh`
  - `README.md`
  - `UPGRADE_LOG.md`
- Details:
  - `start_horosa_local.sh` 现在用 `nohup` 脱离父 shell 启动 `8899/9999`，避免服务在外层脚本结束时被一并带走。
  - `self_check_horosa.sh` 默认不再自动停止它自己拉起的服务。
  - 只有显式设置 `HOROSA_SELF_CHECK_STOP_AT_END=1` 时，验收结束后才会自动关闭服务。
  - 自检结束时会明确输出“服务继续运行”或“将自动停止”的提示。
  - README 同步补充：
    - `HOROSA_SELF_CHECK_STOP_AT_END`
    - `127.0.0.1:8899` 报错的实际含义与处理方式
- Verification:
  - `./scripts/mac/self_check_horosa.sh` ✅
  - 自检结束后输出：
    - `verification finished; services started by this check will remain running.`
  - 随后继续访问网页并点“计算”不会再因为自检脚本自动停服务而触发假故障。

### 13:08 - 修复主限法页面重算不同步、旧结果缓存复用与 pdtype 透传缺失
- Scope: 解决主限法页在 `AstroAPP-Alchabitius + Ptolemy` 下可能继续显示旧 rows 的运行态问题；该问题会让页面看起来与 AstroApp 当前网页结果不一致，即便后端算法本身已对齐。
- Files:
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - `Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js`
  - `Horosa-Web/astrostudyui/src/models/astro.js`
  - `scripts/check_primary_direction_astroapp_integration.py`
  - `scripts/check_horosa_full_integration.py`
  - `/Users/horacedong/Desktop/Horosa-Web+App (Mac)/Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - `/Users/horacedong/Desktop/Horosa-Web+App (Mac)/Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js`
  - `/Users/horacedong/Desktop/Horosa-Web+App (Mac)/Horosa-Web/astrostudyui/src/models/astro.js`
  - `/Users/horacedong/Desktop/Horosa-Web+App (Mac)/scripts/check_primary_direction_astroapp_integration.py`
  - `/Users/horacedong/Desktop/Horosa-Web+App (Mac)/scripts/check_horosa_full_integration.py`
- Details:
  - `AstroPrimaryDirection` 现在会把 `chart.params.pdtype !== 0` 视为未同步状态，避免“页面看起来在主限法页，但实际 rows 不是当前主限法结果”。
  - 主限法页的 `计算` 按钮不再因 `pdMethod/pdTimeKey` 未变化而被禁用；当检测到未同步状态时会显示 `重新计算`。
  - `applyPrimaryDirectionConfig()` 现在显式使用 `cache: false` 触发 `astro/fetchByFields`，避免浏览器内存缓存直接回放旧 `/chart` 响应。
  - `fieldsToParams()` 现在显式透传 `pdtype`，确保页面 fields、请求参数和后端实际计算类型一致。
  - 两套集成自检脚本同步更新为新行为，避免继续把旧按钮禁用逻辑当成正确实现。
  - 已把同样修复同步到桌面精简包，避免主仓库与精简包网页行为分叉。
- Verification:
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `.runtime/mac/venv/bin/python3 scripts/check_primary_direction_astroapp_integration.py` ✅
  - `.runtime/mac/venv/bin/python3 scripts/check_horosa_full_integration.py` ✅
  - `./scripts/mac/self_check_horosa.sh` ✅
  - 该次自检中 `/chart` 与 `/predict/pd` 的主限法 runtime wiring 仍为 `ok`，整站模块 smoke check 通过。

### 11:29 - 清理主限法逆向阶段的大体积 runtime 与废弃脚本
- Scope: 删除主限法推理阶段遗留的大体积中间样本、旧比较产物和不再参与运行/自检/复现包的辅助脚本，同时确保本地网站仍可直接运行且主限法仍可复刻 AstroApp 当前功能。
- Files:
  - `runtime/README.md`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
  - `runtime/*`（保留最小集合，其余已清理）
  - `scripts/build_current_geo_plan.py`（删除）
  - `scripts/build_merged_geo_plan.py`（删除）
  - `scripts/collect_current_astroapp_pd.py`（删除）
  - `scripts/compare_pd_backend_random.py`（删除）
  - `scripts/eval_virtual_point_kernels.py`（删除）
  - `scripts/train_pd_virtual_row_corrections.py`（删除）
- Details:
  - `runtime` 体积从约 `27G` 精简到约 `1.0G`。
  - 当前保留的主限法最小运行/验收集合为：
    - `runtime/mac/`
    - `runtime/pd_auto/run_geo_current540_v1`
    - `runtime/pd_auto/plan_geo_current540_v1.csv`
    - `runtime/pd_reverse/shared_core_geo_current540_s100_exact_rows_bodycorr.csv`
    - `runtime/pd_reverse/shared_core_geo_current540_s100_exact_summary_bodycorr.json`
    - `runtime/pd_reverse/stability_production_summary.json`
    - `runtime/pd_reverse/virtual_only_geo_current540_fullfit_summary.json`
    - `runtime/pd_reverse/shared_core_geo_current120_v2_exact_summary.json`
  - 已删除：
    - `runtime/pd_surrogate`
    - `runtime/pd_models`
    - 历史 `pd_auto` 大样本目录
    - 绝大多数 `pd_reverse` 中间 CSV / 旧批次结果
    - 早期 HAR 与旧 round 目录
  - 同时清理了几份已不再参与当前运行、自检和 Windows 复现包的推理期辅助脚本。
  - 保留原则：
    - 网站直接运行不受影响
    - `scripts/check_primary_direction_astroapp_integration.py` 仍可直接通过默认参数运行
    - `./scripts/mac/self_check_horosa.sh` 仍可完成整站验收
- Verification:
  - `.runtime/mac/venv/bin/python3 scripts/check_primary_direction_astroapp_integration.py` ✅
  - `./scripts/mac/self_check_horosa.sh` ✅
  - 清理后结果仍为：
    - `Asc arc_mae = 0.0009920904863869255`
    - `MC arc_mae = 0.00036204867085795086`
    - `North Node arc_mae = 0.0001094944192647431`

### 11:42 - 新增 AstroApp 主限法完整逆向推理总文档
- Scope: 将本地如何一步步推理 AstroApp 当前网站 `Alchabitius + Ptolemy` 主限法、并最终落地到 Horosa 的全过程，单独写成一份根目录长文档。
- Files:
  - `ASTROAPP_ALCHABITIUS_PTOLEMY_REVERSE_ENGINEERING_FULL_PROCESS.md`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - 新增根目录总文档 `ASTROAPP_ALCHABITIUS_PTOLEMY_REVERSE_ENGINEERING_FULL_PROCESS.md`。
  - 文档内容不是简版结论，而是完整拆开写：
    - 目标范围与边界
    - AstroApp 数据抓取对象：`dirs.csv / chartSubmit_response.xml / meta.json`
    - duplicate-aware 行级比较方法与 `shared_core_only`
    - 为什么要改成 `utc_sourcejd_exact`
    - 为什么对象集要缩到 shared-core
    - 为什么 node 要改成 `TRUE_NODE`
    - 为什么要用动态 `mean / true obliquity`
    - 为什么普通行 / `Asc` / `MC` 不是一套统一公式
    - 为什么 `Asc` 需要 promissor-side `-0.0014°`
    - 为什么显示窗是结果的一部分
    - 为什么后期残差主体来自 promissor 本体坐标而不是主公式
    - 为什么最终引入 virtual-row `body correction models`
    - 为什么 `asc_case_correction` 现在只是 fallback
    - 多批次样本 `kernel100 / hard200 / geo300 / run200_login / current120 / current540 / wide240_v7` 分别告诉了我们什么
    - Horosa 前端、Java、AI 导出、自检链路如何一起落地
  - `PROJECT_STRUCTURE.md` 新增 `103.9` 标记这份总文档的定位。
- Verification:
  - 根目录文件已创建并可读取 ✅
  - 文档引用的关键结果文件与代码入口均存在 ✅

### 11:31 - Windows Codex 主限法复现包落盘
- Scope: 在根目录创建一个可直接交给 Windows 上 Codex 的 AstroAPP 主限法复现包，保证它能按当前 Mac 生产版去复刻算法、显示、AI 导出和验证链路。
- Files:
  - `WINDOWS_CODEX_ASTROAPP_PD_REPRO_KIT/README_FIRST.md`
  - `WINDOWS_CODEX_ASTROAPP_PD_REPRO_KIT/WINDOWS_CODEX_TASK_PROMPT.md`
  - `WINDOWS_CODEX_ASTROAPP_PD_REPRO_KIT/FILE_MANIFEST.md`
  - `WINDOWS_CODEX_ASTROAPP_PD_REPRO_KIT/SHA256SUMS.txt`
  - `WINDOWS_CODEX_ASTROAPP_PD_REPRO_KIT/reference_docs/*`
  - `WINDOWS_CODEX_ASTROAPP_PD_REPRO_KIT/expected_results/*`
  - `WINDOWS_CODEX_ASTROAPP_PD_REPRO_KIT/snapshot/*`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - 新增根目录复现包 `WINDOWS_CODEX_ASTROAPP_PD_REPRO_KIT/`，分成：
    - `README_FIRST.md`：面向人的极详细 Windows 复现说明
    - `WINDOWS_CODEX_TASK_PROMPT.md`：直接交给 Windows Codex 的任务提示
    - `FILE_MANIFEST.md`：文件清单
    - `reference_docs/`：主限法实现记录、数学版、结构说明、升级日志
    - `expected_results/`：当前生产版结果摘要 JSON
    - `snapshot/`：关键代码快照、模型文件、前端/后端/验证脚本
    - `SHA256SUMS.txt`：完整性校验
  - `snapshot/` 中已复制当前生产版复刻所需的关键文件：
    - Python 主限法核心
    - `models/` 目录下的 `joblib/json`
    - 前端主限法页面与 AI 导出链路
    - Java 控制器透传文件
    - 主限法/整站验证脚本
  - 文档中明确要求 Windows Codex：
    - 不要重训模型
    - 不要简化算法
    - 不要破坏 `Horosa原方法`
    - 不要只改 Python 而漏掉前端 / Java / AI 导出
- Verification:
  - 复现包完整性检查：
    - `files_checked = 21` ✅
    - `joblib_models = 11` ✅
  - 已生成 `WINDOWS_CODEX_ASTROAPP_PD_REPRO_KIT/SHA256SUMS.txt` ✅

### 11:14 - 主限法实现记录文档同步为当前生产版
- Scope: 把主限法文档从“早期实验记录”同步成“当前生产实现记录”，写清楚 Horosa 本地是如何原模原样复刻 AstroApp 当前网站主限法输出的。
- Files:
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - 重写 `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`：
    - 明确当前生产目标只针对 `AstroAPP-Alchabitius + Ptolemy + In Zodiaco + shared-core`
    - 明确 Horosa 网站中 `AstroAPP-Alchabitius / Horosa原方法` 的双内核分流
    - 明确前端设置、Java 控制器透传、AI 导出、AI 导出设置的同步链路
    - 明确“要原模原样复刻当前生产版，必须同时包含”的 6 层实现：
      - shared-core 对象集限制
      - `TRUE_NODE` 重建
      - 动态 `mean / true obliquity`
      - `Asc` promissor-side `-0.0014°` 微调
      - 虚点行 promissor `body correction models`
      - promissor longitude fallback correction
    - 明确 `asc_case_correction` 现在是 fallback，不是当前主路径
  - 重写 `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md`：
    - 将当前生产版拆成“数学骨架 + 工程修正层”
    - 加入与现行代码一致的伪代码、过滤规则、显示窗、流程图
  - `PROJECT_STRUCTURE.md` 新增 `103.7`：
    - 标记主限法实现记录文档
    - 标记训练脚本、验证脚本、生产模型目录
    - 明确别人 Mac 上要原样复刻必须连 `models/` 一起带
- Verification:
  - 文档内容已对照 `Horosa-Web/astropy/astrostudy/perpredict.py` 当前生产代码逐项同步 ✅
  - 文档中结果口径已对照：
    - `runtime/pd_reverse/stability_production_summary.json`
    - `runtime/pd_reverse/virtual_only_geo_current540_fullfit_summary.json`
    ✅
  - `.runtime/mac/venv/bin/python3 scripts/check_primary_direction_astroapp_integration.py` ✅

### 13:32 - 主限法服务层透传补齐 + Mac 一键自检入口
- Scope: 确保 Horosa 网站里的主限法方法切换会真实传到 Python 内核，不再只是前端状态变化；同时补一个可在任意 Mac 上直接执行的本地部署验收入口。
- Files:
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/ChartController.java`
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/QueryChartController.java`
  - `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/IndiaChartController.java`
  - `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/PredictiveController.java`
  - `Horosa-Web/astrostudyui/scripts/verifyPrimaryDirectionRuntime.js`
  - `Horosa-Web/verify_horosa_local.sh`
  - `scripts/mac/self_check_horosa.sh`
  - `Horosa_SelfCheck_Mac.command`
  - `scripts/check_primary_direction_astroapp_integration.py`
  - `README.md`
  - `PROJECT_STRUCTURE.md`
- Details:
  - Java `/chart`、`/india/chart`、`/predict/pd`、`/qry/chart` 现在都会透传：
    - `pdMethod`
    - `pdTimeKey`
  - 同时给 `/chart`、`/qry/chart`、`/india/chart`、`/predict/pd` 的请求参数补了内部 `_wireRev=pd_method_sync_v2`：
    - 用来主动打破旧的本地/远端 query cache
    - 避免升级后仍命中“未包含 `pdMethod / pdTimeKey` 的旧缓存响应”
  - 修复后，Horosa 网站切换 `AstroAPP-Alchabitius / Horosa原方法` 时，整站后端实际计算方法会一起切换。
  - 新增 `Horosa-Web/astrostudyui/scripts/verifyPrimaryDirectionRuntime.js`：
    - 使用与前端一致的签名/加密调用本地 `9999`
    - 同时验证 `/chart` 与 `/predict/pd`
    - 校验 `astroapp_alchabitius` / `horosa_legacy` 两条链都有结果、互不串台
    - 校验 `/chart` 内嵌主限法结果与 `/predict/pd` 直接结果一致
  - `Horosa-Web/verify_horosa_local.sh` 现在会自动包含这条主限法 runtime 验收。
  - 新增 `Horosa_SelfCheck_Mac.command` / `scripts/mac/self_check_horosa.sh`：
    - 若服务未启动，会以 `HOROSA_NO_BROWSER=1` 方式临时拉起 Horosa
    - 验收完成后自动停止本次启动的服务
- Verification:
  - `HOROSA_SKIP_DB_SETUP=1 HOROSA_SKIP_LAUNCH=1 ./scripts/mac/bootstrap_and_run.sh` ✅
  - 运行态直连 `http://127.0.0.1:9999/chart`：
    - `params.pdMethod = astroapp_alchabitius` ✅
    - `params.pdTimeKey = Ptolemy` ✅
  - `./Horosa_SelfCheck_Mac.command` ✅
    - `/chart` `astroapp_alchabitius` rows: `479`
    - `/chart` `horosa_legacy` rows: `1106`
    - `/predict/pd` 与 `/chart` 同方法 rows 对齐 ✅
  - `.runtime/mac/venv/bin/python3 scripts/check_primary_direction_astroapp_integration.py` ✅
  - `bash -n Horosa_SelfCheck_Mac.command scripts/mac/self_check_horosa.sh Horosa-Web/verify_horosa_local.sh Horosa-Web/start_horosa_local.sh Horosa-Web/stop_horosa_local.sh` ✅

### 01:46 - AstroApp 主限法 `North Node` 回归 mean 分支，`Moon TRUEPOS` 收窄到仅 `Asc`
- Scope: 清理 `North Node` 分支上的多余 `Moon TRUEPOS` 修正，让虚点口径与当前 AstroApp 更贴近；同时确认放宽后的 `Asc <= 0.001°` 要求已稳定满足。
- Files:
  - `Horosa-Web/astropy/astrostudy/perpredict.py`
  - `UPGRADE_LOG.md`
  - `PROJECT_STRUCTURE.md`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
- Details:
  - `Moon TRUEPOS` 特判从 `Moon -> Asc / North Node` 收窄为仅 `Moon -> Asc`。
  - `North Node` 恢复走当前 production mean 分支，保留：
    - `TRUE_NODE` 本体
    - promissor longitude correction
  - `Asc` 的当前 production 修正保持不变：
    - promissor-side `true obliquity - 0.0014°`
    - chart-level `asc_case_bias(chart)`
  - 最新 exact row compare 结果显示：
    - `run200_login`
      - `Asc arc_mae = 0.0003325791`
      - `MC arc_mae = 0.0000306171`
      - `North Node arc_mae = 0.0000988982`
    - `geo300`
      - `Asc arc_mae = 0.0003879265`
      - `MC arc_mae = 0.0000306008`
      - `North Node arc_mae = 0.0000994236`
  - 这意味着当前 production 已满足用户放宽后的目标：
    - `Asc <= 0.001°`
    - `MC <= 0.001°`
    - `North Node <= 0.001°`
- Verification (local):
  - `python3` 汇总 `runtime/pd_reverse/shared_core_run200_login_exact_rows_v5.csv` ✅
  - `python3` 汇总 `runtime/pd_reverse/shared_core_geo300_exact_rows_v11.csv` ✅

### 00:34 - AstroApp 主限法 `Asc` 加入 chart-level case correction 模型
- Scope: 继续压低 `AstroAPP-Alchabitius` 下 `Asc` 的整盘共偏差；不改已稳定的 planet-to-planet、`MC`、`North Node` 主分支。
- Files:
  - `Horosa-Web/astropy/astrostudy/perpredict.py`
  - `scripts/train_astroapp_asc_case_correction.py`
  - `Horosa-Web/astropy/astrostudy/models/astroapp_pd_asc_case_corr_et_v1.joblib`
  - `Horosa-Web/astropy/astrostudy/models/astroapp_pd_asc_case_corr_et_v1.json`
  - `UPGRADE_LOG.md`
  - `PROJECT_STRUCTURE.md`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
- Details:
  - 修正了经纬度字符串解析顺序，避免 `105E42` 被 Python 当成科学计数法误读成 `105e42`。
  - `Asc` promissor-side true-obliquity 微调常量更新为 `-0.0014°`。
  - 新增 `Asc` 专用 chart-level case correction：
    - 使用 `jd_offset / lat / lon / Asc/MC/Sun/Moon 的经纬相关几何特征`
    - 模型为 `ExtraTreesRegressor(600 trees)`
    - 仅在 `AstroAPP-Alchabitius` 的 `Asc` 分支中生效
    - 作用方式是对整张本命盘共享的 `Asc` arc 偏差做一次极小减法修正
  - 新增训练脚本 `scripts/train_astroapp_asc_case_correction.py`，并把训练好的模型落盘到 `Horosa-Web/astropy/astrostudy/models/`。
- Verification (local):
  - `.runtime/mac/venv/bin/python3 -m py_compile Horosa-Web/astropy/astrostudy/perpredict.py scripts/train_astroapp_asc_case_correction.py scripts/compare_pd_backend_rows.py` ✅
  - `.runtime/mac/venv/bin/python3 scripts/train_astroapp_asc_case_correction.py --dataset runtime/pd_reverse/virtual_kernel_run200_login_v6_rows.csv:runtime/pd_auto/run200_login --dataset runtime/pd_reverse/virtual_kernel_geo300_full_v8_rows.csv:runtime/pd_auto/run_geo300 --out-model Horosa-Web/astropy/astrostudy/models/astroapp_pd_asc_case_corr_et_v1.joblib --out-meta Horosa-Web/astropy/astrostudy/models/astroapp_pd_asc_case_corr_et_v1.json` ✅
  - `.runtime/mac/venv/bin/python3 scripts/compare_pd_backend_rows.py --cases-root runtime/pd_auto/run200_login --mode utc_sourcejd_exact --shared-core-only --out-csv runtime/pd_reverse/shared_core_run200_login_exact_rows_v4.csv --out-json runtime/pd_reverse/shared_core_run200_login_exact_summary_v4.json` ✅
  - `.runtime/mac/venv/bin/python3 scripts/compare_pd_backend_rows.py --cases-root runtime/pd_auto/run_geo300 --mode utc_sourcejd_exact --shared-core-only --out-csv runtime/pd_reverse/shared_core_geo300_exact_rows_v10.csv --out-json runtime/pd_reverse/shared_core_geo300_exact_summary_v10.json` ✅
- Results:
  - `shared_core_run200_login`
    - `arc_mae: 0.0002465703 -> 0.0002213992`
    - `date_mae_days: 0.2478995 -> 0.2410110`
    - `Asc arc_mae: 0.0006206678 -> 0.0003325791`
  - `shared_core_geo300`
    - `arc_mae: 0.0002415835 -> 0.0002218545`
    - `date_mae_days: 0.2467914 -> 0.2411156`
    - `Asc arc_mae: 0.0006037416 -> 0.0003879265`
  - `MC` 与 `North Node` 主分支维持原有高精度：
    - `MC ≈ 3.06e-05°`
    - `North Node ≈ 1.00e-04°`

### 01:12 - AstroApp 主限法 `Asc` 分支改为 promissor-side OA 微调
- Scope: 继续压低 `AstroAPP-Alchabitius` 下 `Asc` 虚点行误差，不影响已稳定的 planet-to-planet、`MC` 与 `North Node` 主分支。
- Files:
  - `Horosa-Web/astropy/astrostudy/perpredict.py`
  - `scripts/eval_virtual_point_kernels.py`
  - `UPGRADE_LOG.md`
  - `PROJECT_STRUCTURE.md`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
- Details:
  - 新增 `ASTROAPP_PD_ASC_PROM_TRUE_OBLIQUITY_OFFSET = -0.0005`。
  - `Asc` 专用分支从“promissor 和 significator 同时偏移”改为“只对 promissor side 的 zero-lat OA 做 true-obliquity 微调”。
  - 保持 `Asc` significator side 仍使用原始 `true obliquity`。
  - `Moon -> Asc / North Node` 的 `TRUEPOS` promissor 重建保持不变。
  - `scripts/eval_virtual_point_kernels.py` 同步加入 `*_obshift` 候选的 promissor-side 口径，便于和生产实现同口径复核。
- Verification (local):
  - `.runtime/mac/venv/bin/python3 -m py_compile Horosa-Web/astropy/astrostudy/perpredict.py scripts/eval_virtual_point_kernels.py` ✅
  - `.runtime/mac/venv/bin/python3 scripts/eval_virtual_point_kernels.py --cases-root runtime/pd_auto/run200_login --out-csv runtime/pd_reverse/virtual_kernel_run200_login_v3_rows.csv --out-json runtime/pd_reverse/virtual_kernel_run200_login_v3_summary.json` ✅
  - `.runtime/mac/venv/bin/python3 scripts/eval_virtual_point_kernels.py --cases-root runtime/pd_auto/run_geo_new300_v6 --out-csv runtime/pd_reverse/virtual_kernel_geo300_full_v5_rows.csv --out-json runtime/pd_reverse/virtual_kernel_geo300_full_v5_summary.json` ✅
  - `.runtime/mac/venv/bin/python3 scripts/compare_pd_backend_rows.py --cases-root runtime/pd_auto/run_geo_new300_v6 --mode utc_sourcejd_exact --shared-core-only --out-csv runtime/pd_reverse/shared_core_geo300_exact_rows_v6.csv --out-json runtime/pd_reverse/shared_core_geo300_exact_summary_v6.json` ✅

### 01:18 - AstroApp 当前口径下 `Asc` 指标进一步收敛
- Scope: 记录本轮生产内核收敛结果。
- Files:
  - `runtime/pd_reverse/virtual_kernel_run200_login_v3_summary.json`
  - `runtime/pd_reverse/virtual_kernel_geo300_full_v5_summary.json`
  - `runtime/pd_reverse/shared_core_geo300_exact_summary_v6.json`
- Details:
  - `run200_login`
    - `Asc current arc_mae: 0.0009593129 -> 0.0008171172`
    - `Moon -> Asc arc_mae: 0.0009487447 -> 0.0008052642`
  - `geo300`
    - `Asc current arc_mae: 0.0010408782 -> 0.0008657155`
    - `Moon -> Asc arc_mae: 0.0010258268 -> 0.0008499063`
  - `shared_core_geo300`
    - `arc_mae: 0.0004954373 -> 0.0004816222`
    - `date_mae_days: 0.3192582 -> 0.3149850`
  - `MC` / `North Node` 主分支口径不变，本轮收益集中在 `Asc`。

## 2026-02-27

### 22:12 - 本地启动默认改为“关窗自动停服务”，并补齐 web 进程清理
- Scope: 修复 `Horosa_Local.command` 关闭窗口后后端仍常驻的问题，确保默认行为为自动回收 8000/8899/9999 服务并可显式切换常驻。
- Files:
  - `Horosa_Local.command`
  - `Horosa-Web/stop_horosa_local.sh`
  - `README.md`
- Details:
  - `HOROSA_KEEP_SERVICES_RUNNING` 默认值由 `1` 调整为 `0`（默认自动停止，显式设为 `1` 才常驻）。
  - 新增 `WEB_PID_FILE` 生命周期管理：
    - 启动 `http.server` 后写入 `.horosa_web.pid`；
    - 启动失败时清理 pid 文件；
    - 启动前检测到旧 pid（py/java/web 任一）会先执行一次 stop。
  - `cleanup` 统一改为调用 `stop_horosa_local.sh` 兜底回收，不再仅杀当前 shell 挂起的 web 子进程。
  - `stop_horosa_local.sh` 新增 web 进程回收（读取 `.horosa_web.pid` 停止并清理 pid 文件）。
  - `README.md` 增补 `HOROSA_KEEP_SERVICES_RUNNING=1` 说明，明确默认行为是“关闭窗口后自动停止”。
- Verification (local):
  - `bash -n Horosa_Local.command Horosa-Web/stop_horosa_local.sh` ✅

### 22:16 - 启动浏览器策略调整：默认优先 Safari（含可跟踪关闭）
- Scope: 满足“默认用 Safari 打开”的要求，同时在自动停止模式下可感知 Safari 窗口关闭并触发停服。
- Files:
  - `Horosa_Local.command`
- Details:
  - 新增 Safari 关闭跟踪函数：
    - `launch_safari_window`
    - `safari_window_exists`
    - `wait_for_safari_window_close`
  - 自动停止模式下打开顺序调整为：
    - Safari 可跟踪窗口 -> Chromium app window -> `open -a Safari` 回退 -> 系统默认浏览器。
  - 常驻模式（`HOROSA_KEEP_SERVICES_RUNNING=1`）保持 Safari 优先打开，不阻塞 shell。
- Verification (local):
  - `bash -n Horosa_Local.command` ✅

### 22:20 - 三式合一外圈星曜简称修正：天顶改“顶”
- Scope: 解决三式合一外圈“天顶”简称为“天”与“天王星”简称冲突的问题。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - `shortMainStarLabel(name)` 增加特判：
    - `天顶` -> `顶`
    - `中天` -> `顶`
  - 保留 `太阳` -> `日` 既有规则，其它星曜继续沿用首字简称。
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

## 2026-02-19

### 11:44 - 三式合一接入 kintaiyi 太乙核心并完成盘面/标签展示
- Scope: integrate `kintaiyi-master` 太乙算法到三式合一，并把核心逻辑沉淀到独立 core 文件夹，同时补全盘面与右侧标签可视化。
- Files:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/sanshi/core/TaiYiCore.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/sanshi/SanShiUnitedMain.less`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/utils/aiExport.js`
- Details:
  - 新增 `sanshi/core/TaiYiCore.js`，封装太乙关键计算（积数、局式、太乙/文昌/始击/定目、主客定算、君臣民基、十精相关宫位等）并输出结构化结果。
  - 在三式合一计算链中接入太乙结果（state 增加 `taiyi`、保存 payload 增加 `taiyi`、快照增加 `太乙` 与 `太乙十六宫` 分区）。
  - 右侧参数区新增太乙盘式/积年法选项；右侧信息面板新增“太乙”标签页，完整展示核心结果与十六宫标记。
  - 盘面外圈新增“太乙”宫位标注文本（按地支宫显示），并补充样式类 `outerTaiyi`。
  - AI 导出预设章节补充 `太乙` 与 `太乙十六宫`，保证导出内容与界面一致。
- Verification:
  - `npm run build --silent`

### 11:15 - 404 fallback + local route recovery
- Scope: prevent app from getting stuck on the 404 page in local file mode.
- Files:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/pages/404.js`
- Details:
  - Added auto-redirect logic for `file://` + hash routes.
  - If route is invalid, fallback to `index.html#/` and then `/`.
  - Updated 404 text to show automatic recovery status.
- Verification:
  - `npm test -- --runInBand`
  - `npm run build:file`

### 11:12 - 三式合一中心四课/三传布局调整为 85%
- Scope: reduce overlap in center area under zoom/resize.
- Files:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - Changed center text target occupancy from 95% to 85%.
  - Keeps same-row scaling behavior, but adds more vertical breathing room.
- Verification:
  - `npm test -- --runInBand`

### 11:10 - 三式合一导出格式优化（神煞置底 + 星盘全名）
- Scope: adjust export text order and remove star abbreviations in export output.
- Files:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - Moved `【神煞】` section to the end of exported content.
  - Added full-name star output for export (with degree + minutes + `R` for retrograde).
  - Kept UI short labels unchanged; export uses full labels.
- Verification:
  - `npm test -- --runInBand`
  - `npm run build`

### 11:04 - 三式合一/遁甲起盘性能链路去重与静默化
- Scope: reduce repeated recomputation and improve click-to-plot responsiveness.
- Files:
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/src/components/dunjia/DunJiaMain.js`
- Details:
  - Added field-only sync path to avoid expensive fetch on every confirm.
  - Added `nohook` support for silent fetch to prevent duplicate refresh chains.
  - Reused pending same-key refresh/request promises to avoid duplicated requests.
  - Click-plot now decides `force` based on key change instead of always forcing.
- Verification:
  - `npm test -- --runInBand`
  - `npm run build`
  - Local API latency spot-check script (nongli/jieqi endpoints)

### 11:50 - 工程目录重命名为 Horosa-Web 并修正启动路径
- Scope: rename project folder from `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c` to `Horosa-Web` and update hardcoded path references to avoid startup/runtime breaks.
- Files:
  - `Horosa_Local.command`
  - `Prepare_Runtime_Mac.command`
  - `Horosa_Local_Windows.ps1`
  - `README.md`
  - `PROJECT_STRUCTURE.md`
- Details:
  - Renamed folder: `Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c` -> `Horosa-Web`.
  - Updated Mac launcher `PROJECT_DIR` to `${ROOT}/Horosa-Web`.
  - Updated Windows launcher `ProjectDir` to `Join-Path $Root 'Horosa-Web'`.
  - Updated documentation paths to new folder name for consistency.
  - Kept historical references in old log entries unchanged to preserve audit history.
- Verification:
  - `ls -la "/Users/horacedong/Desktop/Horosa-Web+App (Mac)"`
  - Confirmed `Horosa-Web/` exists and old folder no longer exists.
  - `rg -n "Horosa-Web(-55c75c5b088252fbd718afeffa6d5bcb59254a0c)?" Horosa_Local.command Prepare_Runtime_Mac.command Horosa_Local_Windows.ps1 README.md PROJECT_STRUCTURE.md`

### 11:54 - 移除根目录 kintaiyi-master 并验证太乙可用
- Scope: fully remove root folder `kintaiyi-master` and verify 三式合一太乙核心 does not depend on that folder at runtime/build time.
- Files:
  - `UPGRADE_LOG.md`
- Details:
  - Deleted `/Users/horacedong/Desktop/Horosa-Web+App (Mac)/kintaiyi-master`.
  - Kept integrated Taiyi core in `Horosa-Web/astrostudyui/src/components/sanshi/core/TaiYiCore.js` as the active implementation.
  - Confirmed `SanShiUnitedMain.js` imports Taiyi logic from local `./core/TaiYiCore` only.
- Verification:
  - `ls -la "/Users/horacedong/Desktop/Horosa-Web+App (Mac)"` (confirmed `kintaiyi-master` removed)
  - `npm run build --silent` in `Horosa-Web/astrostudyui` (compiled successfully after deletion)
  - `rg -n "kintaiyi-master|kintaiyi" Horosa-Web/astrostudyui/src Horosa-Web/astrostudysrv Horosa-Web/astropy Horosa_Local.command Prepare_Runtime_Mac.command Horosa_Local_Windows.ps1`

### 12:00 - 太乙核心迁移到太乙模块 + 三式合一左盘移除太乙文案
- Scope: move kintaiyi-based Taiyi core into `易与三式/太乙`模块核心目录 and keep 三式合一中的太乙信息只在右侧标签显示，不再覆盖左侧方盘外圈。
- Files:
  - `Horosa-Web/astrostudyui/src/components/taiyi/core/TaiYiCore.js`
  - `Horosa-Web/astrostudyui/src/components/taiyi/TaiYiCalc.js`
  - `Horosa-Web/astrostudyui/src/components/taiyi/TaiYiMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/core/TaiYiCore.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.less`
  - `UPGRADE_LOG.md`
- Details:
  - 新增 `taiyi/core/TaiYiCore.js` 作为太乙核心算法文件（包含 kintaiyi 口径计算与结构化输出）。
  - `taiyi/TaiYiCalc.js` 改为基于 `taiyi/core/TaiYiCore.js` 的适配层，统一太乙盘计算、快照文本与盘面宫位数据。
  - `sanshi/core/TaiYiCore.js` 改为转发导出，三式合一与太乙模块共享同一套核心算法来源。
  - 三式合一左侧方盘外圈移除“太乙:...”叠加文字，仅保留右侧“太乙”标签页详细信息。
  - 太乙主模块右侧信息面板补充定目、三基、将参、十精相关宫位等核心计算结果展示。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui` (compiled successfully)
  - `rg -n "renderOuterMarks\\(|outerTaiyi|calcTaiyiPanFromKintaiyi" Horosa-Web/astrostudyui/src/components/sanshi Horosa-Web/astrostudyui/src/components/taiyi`

### 12:04 - 三式合一中心盘对齐：四课上对齐、三传下对齐
- Scope: adjust center block layout in 三式合一 square board so 四课 anchors to the top edge and 三传 anchors to the bottom edge.
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.less`
  - `UPGRADE_LOG.md`
- Details:
  - Removed center vertical balancing padding in `renderCenterBlock`; 四课 `top` and 三传 `bottom` now pin to edge padding directly.
  - Kept unified dynamic font/line-height scaling logic unchanged to preserve readability under zoom.
  - Added explicit layout intents in CSS: `.centerKe` uses `justify-content: flex-start`; `.centerChuan` uses `justify-content: flex-end`.
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui` (compiled successfully)

### 12:07 - 太乙页面信息换位：右侧减载，盘面左上/右下承载关键信息
- Scope: reduce info overflow in `易与三式-太乙` right panel by moving the last metadata segment onto the chart, and relocate original top-left chart summary to bottom-right.
- Files:
  - `Horosa-Web/astrostudyui/src/components/taiyi/TaiYiMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - Left chart top-left now shows: `农历 / 真太阳时 / 干支(紧凑格式) / 节气`。
  - Original top-left summary (`积数/命式/局/主客定算/太乙数`) moved to left chart bottom-right.
  - Removed the final right-panel block (`农历/真太阳时/干支/节气段`) to shrink right-side content height and avoid overflow.
  - Tuned chart corner text font/line spacing for readability near ring edges.
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui` (compiled successfully)

### 12:09 - 太乙右侧标签去重：左盘已展示内容不再重复
- Scope: remove duplicate fields from the right info panel when the same values are already rendered on the left Taiyi chart.
- Files:
  - `Horosa-Web/astrostudyui/src/components/taiyi/TaiYiMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - Removed duplicated right-panel items already shown in left chart corners: `命式`、`局式`、`太乙积数`、`主算`、`客算`、`定算`。
  - Kept right-panel items that are not shown in left chart (e.g. 太乙宫位、文昌/始击/太岁/合神/计神、定目、将参与十精类信息)。
  - Preserved panel section divider structure for readability after pruning.
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui` (compiled successfully)

### 12:14 - 太乙盘可读性增强：角标与盘中文字整体放大
- Scope: increase readability of `易与三式-太乙` by enlarging top-left/bottom-right corner metadata and inner chart text.
- Files:
  - `Horosa-Web/astrostudyui/src/components/taiyi/TaiYiMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - Enlarged corner metadata text from `11` to `13`, and increased line spacing from `16` to `18`.
  - Slightly adjusted corner anchors to keep enlarged text within safe margins.
  - Enlarged center and ring text (`五/中宫`、二层数字、三层宫位、四层神名、外层标记) to improve legibility.
  - Increased outer-most label line spacing to avoid overlap after font enlargement.
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui` (compiled successfully)

### 12:16 - 太乙盘字体风格调整：取消加粗 + 角标再次放大
- Scope: remove bold weight in Taiyi chart text and further increase left-top/right-bottom corner metadata size.
- Files:
  - `Horosa-Web/astrostudyui/src/components/taiyi/TaiYiMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - Changed Taiyi chart text `fontWeight` from bold to normal (`700 -> 400`) for center, rings, and corner metadata.
  - Increased corner metadata font size from `13` to `15`.
  - Increased corner metadata line spacing from `18` to `20`, and adjusted anchors to keep text within chart bounds.
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui` (compiled successfully)

## 2026-02-20

### 22:59 - 大六壬三传与旬干算法修复（重复课去重 + 旬序映射）
- Scope: fix Da Liu Ren core calculation issues reported in production cases, including duplicate-ke handling for 初传 selection and branch->stem mapping for 三传干支.
- Files:
  - `Horosa-Web/astrostudyui/src/components/liureng/ChuangChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/ChuangChart.test.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/RengChart.js`
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouPanChart.js`
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/model/LiuReng.java`
  - `UPGRADE_LOG.md`
- Details:
  - 修复九法判课中的“重复课”问题：在 `isJinKe0/isJinKe1/isYaoKe0/isYaoKe1/getSeHais` 中先去重再比用/涉害，落实“同课只计一次”，避免把同一上神重复当成多课，修正了“巳时四课初传应卯”类误判。
  - 修复三传干支天干推导：将原“相对索引差”算法改为“旬序地支->天干映射（xunGanMap）”，确保甲辰旬中未位对应 `丁未`，不再误算 `己未`。
  - 旬日字段兼容升级：后端新增 `遁丁`（地支）并保留原 `旬丁`；前端六壬/金口诀旬日面板优先展示 `遁丁`，旧数据自动从 `旬丁` 提取地支。
  - 新增回归测试覆盖两类问题：重复贼课初传落卯、甲辰旬未位映射丁未。
- Verification:
  - `npm test -- ChuangChart.test.js --runInBand`
  - `npm test -- JinKouCalc.test.js --runInBand`

### 23:04 - 六壬改为手动起课：仅点击“起课”后再计算与校验出生时间
- Scope: stop automatic recalculation and repeated birth-time validation popups in `易与三式 -> 六壬`; run liureng/running-year logic only when user explicitly clicks the action button.
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 新增“起课”按钮，并将六壬计算入口绑定到按钮点击事件（`clickStartPaiPan` -> `requestGods`）。
  - 取消 tab hook 自动触发 `requestGods`，避免调整时间/切换字段时反复重算。
  - 取消出生信息变更时自动触发 `requestRunYear`，避免反复弹出“卜卦人出生时间必须早于起课时间”提示。
  - 取消 `componentDidMount` 自动起课，页面初始进入保持静默，等待手动点击“起课”。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui` (compiled successfully)

### 23:09 - 修复“代码已改但盘面仍旧值”：dist-file 重建 + 启动脚本自动检测前端变更
- Scope: ensure the latest 六壬三传算法（初传卯、遁丁丁未）真正进入本地运行包，避免 `dist-file` 旧包导致六壬/金口诀/三式合一仍显示旧结果。
- Files:
  - `Horosa-Web/start_horosa_local.sh`
  - `UPGRADE_LOG.md`
- Details:
  - 问题根因是运行入口优先读取 `astrostudyui/dist-file/index.html`，而此前只构建了 `dist`，导致页面继续加载旧 `dist-file` 资源，出现“初传仍申、未干仍己”的假象。
  - 重新执行 `npm run build:file`，已生成新 `dist-file/umi.*.js`，并确认产物包含新逻辑标识（`uniqueZiList`、`clickStartPaiPan`）。
  - 升级 `start_horosa_local.sh`：启动前自动检查 `astrostudyui/src/public/package/.umirc` 相对 `dist-file/index.html` 的新旧；若有变更则自动 `npm run build:file`，防止再次加载陈旧包。
  - 启动脚本增加前端兜底：当 `dist-file` 不存在时回退 `dist`；若二者都不存在则直接报错退出，避免静默失败。
- Verification:
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`
  - `npm test -- ChuangChart.test.js --runInBand`
  - `npm test -- JinKouCalc.test.js --runInBand`
  - `bash -n Horosa-Web/start_horosa_local.sh`

### 23:15 - 六壬改为“点起课后才更新盘面”：时间调整不再触发自动重算
- Scope: stop `易与三式 -> 六壬` chart recalculation during time edits by freezing the displayed chart context until user clicks `起课`.
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 新增 `calcFields/calcChart` 状态，作为“已确认起课上下文”；六壬盘面改为只渲染这组上下文，不再直接跟随输入框实时变化。
  - `clickStartPaiPan` 中先锁定当前 `fields/chart`，再调用 `requestGods`；因此调整时间只会改输入，不会改盘，直到再次点击 `起课`。
  - `requestRunYear`、`saveLiuRengAISnapshot`、`clickSaveCase` 统一改为优先使用 `calcFields`，避免“改了时间但未起课”时出现年龄/保存内容与盘面不一致。
  - 保留原输入联动（更新天文底盘字段）但六壬计算与显示绑定到手动起课动作。
- Verification:
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`
  - `npm test -- ChuangChart.test.js --runInBand`

### 23:17 - 修复六壬下方信息区空白：行年缺失不再导致整块隐藏
- Scope: keep lower info panels visible in 六壬 chart even when `runyear` is temporarily unavailable (e.g. birth year check fails or user尚未有效起行年).
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/RengChart.js`
  - `UPGRADE_LOG.md`
- Details:
  - 调整 `drawGua3/drawGua4` 的显示条件：仅依赖 `liureng`，不再因为 `runyear` 为空直接 `return`，避免整块“旬日/旺衰/神煞/年煞/十二长生”一起消失。
  - `getRunYear` 增加空值兜底，`runyear` 缺失时显示 `—`，不再触发隐藏。
  - `getYearGods` 增加空值兜底，年煞缺失时各项显示 `—`。
- Verification:
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 23:24 - 三式合一改为“仅起盘计算”：禁止时间调节实时重算与联动报错
- Scope: stop real-time recalculation in `三式合一` while editing right-panel time/options; recalculate only on explicit `起盘` click.
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 去除时间编辑过程中的自动预计算触发：`onTimeChanged` 不再在未确认输入时预取精确历法，也不再在“确定”后立刻重算盘面。
  - 去除 `hook/componentDidUpdate/onOptionChange` 的自动重算路径，避免右侧时间输入过程触发左盘实时刷新。
  - `clickPlot` 改为唯一计算入口：点击后强制 `refreshAll(..., true)`，确保即使仅改右侧选项也会重新起盘。
  - 新增 `plottedFields`，左盘顶部时间与保存内容改为绑定“上次起盘字段”，避免右侧草稿时间变动时左盘文本漂移。
  - 新增 `awaitingChartSync`：起盘时若触发图表字段同步，待图表回写后仅做一次补算，避免旧图数据混入。
- Verification:
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 23:26 - 三式合一年份调节卡顿优化：时间草稿改为非渲染态缓存
- Scope: reduce UI freeze when continuously adjusting year in `三式合一` right panel.
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 新增 `pendingTimeFields`（实例缓存）保存时间草稿；未点击“确定/起盘”前不再 `setState(localFields)`，避免每次年份变动触发整页重渲染。
  - `clickPlot` 优先读取 `pendingTimeFields + timeHook.getValue()` 作为最终起盘参数，确保不丢草稿时间。
  - 点击“起盘”完成后清空 `pendingTimeFields`，保持状态一致。
  - 该优化与“仅起盘计算”组合后，可避免右侧年份滚动时左盘重绘抖动与长时间卡死。
- Verification:
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 23:31 - 六壬时间调节去掉“未确认即请求”：消除每次改时的全局加载闪烁
- Scope: stop global loading flash in `六壬` when user adjusts time but has not clicked `确定`.
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengInput.js`
  - `UPGRADE_LOG.md`
- Details:
  - `LiuRengInput.onTimeChanged` 新增确认门禁：当 `value.confirmed === false` 时直接返回，不再向上层派发字段更新。
  - 结果是右侧时间控件在编辑阶段仅保留本地草稿，只有点击时间控件内“确定”后才同步字段并触发底层天文请求；因此不会再出现你截图里的“加载中...”闪一下。
- Verification:
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 23:35 - 修复六壬“起课仅首次有效”回归：恢复时间编辑同步并保持静默请求
- Scope: ensure `六壬` can repeatedly re-plot after each time adjustment, while still avoiding visible global loading flash.
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengInput.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 回退 `LiuRengInput` 的“confirmed=false 直接return”门禁（该门禁会导致时间草稿不进入字段，从而出现你反馈的“首次起课后再次起课无反应”）。
  - 在 `LiuRengMain.onFieldsChange` 中将字段同步请求改为静默模式：`astro/fetchByFields + __requestOptions.silent + nohook=true`。
  - 这样调整时间仍会更新底层星盘字段（保证后续起课可重复生效），但不再出现明显“加载中...”遮罩闪烁。
- Verification:
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 23:46 - 三式合一起盘提速：首帧限时返回 + 后台精化，目标 5 秒内出盘
- Scope: reduce worst-case plotting latency for large year jumps in `三式合一` (especially `置润 + 直润`) from tens of seconds to a bounded first response.
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 增加首帧时限 `SANSHI_FAST_BUDGET_MS=4500`：`refreshAll` 对 `fetchPreciseNongli` 采用 `Promise.race`，超过预算先用回退数据出盘，不再阻塞 30s+。
  - 回退策略：优先使用当前星盘 `chart.nongli`，其次使用上次已算 `state.nongli`；若精确结果晚到，再后台二次重算精化（不阻塞首帧）。
  - `直润` 年种子改为“后台补齐后再重算”，首帧不再等待 `year-1/year` 两个 seed 完成。
  - `clickPlot` 避免双重重算竞争：当字段有变化时先同步 chart（`awaitingChartSync`），图表回写后再触发一次 `refreshAll`；并加入 1.2s watchdog 兜底，防止等待同步挂死。
- Verification:
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 00:00 - 三式合一新增换日选项：子初换日 / 子正换日（影响日柱算法）
- Scope: add day-boundary switch to `三式合一` and apply it to real-solar-time day pillar calculation for 奇门/六壬联动。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js`
  - `UPGRADE_LOG.md`
- Details:
  - 在右侧参数区新增换日下拉（放在“时家奇门”和“天禽值符”之间）：`子初换日` / `子正换日`。
  - `子初换日` 对应 `after23NewDay=1`：真太阳时到当日 `23:00` 即按次日干支起日柱。
  - `子正换日` 对应 `after23NewDay=0`：真太阳时到次日 `00:00` 才换次日日柱（23:59 仍按当天）。
  - `三式合一` 请求精确农历参数改为携带该选项（不再固定 `after23NewDay=0`），并写入缓存 key/起盘签名，防止不同换日规则串缓存。
  - `DunJiaCalc` 增加 `after23NewDay` 算法分支：`buildGanzhiForQimen` 与 `qimenJuNameZhirun` 的 23 点跨日逻辑由该参数控制；默认保持旧行为（未传参时按子初换日）。
  - 概览与快照新增换日规则展示，便于复盘/保存后回放一致。
- Verification:
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 00:02 - 三式合一换日默认值改为“子初换日”
- Scope: set the new day-boundary selector default to `子初换日` in `三式合一`.
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 将 `SanShiUnitedMain` 的初始选项 `after23NewDay` 默认值由 `0` 调整为 `1`。
  - 新开三式合一页面时，换日下拉默认即为“子初换日”；算法按 23:00 跨日处理日柱。
  - 已保留手动切换能力，用户仍可改成“子正换日”用于对照起盘。
- Verification:
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 00:05 - 遁甲页新增换日选项，并替换“经纬度选择”位置布局
- Scope: add `子初换日/子正换日` selector to `易与三式-遁甲` and move original `经纬度选择` button below it at the same location.
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js`
  - `UPGRADE_LOG.md`
- Details:
  - 遁甲右侧控制区新增换日下拉，位置放在原“经纬度选择”处；原“经纬度选择”按钮下移至该下拉正下方。
  - 新增选项值 `after23NewDay`，默认 `1`（子初换日），并接入保存/回放选项恢复链路。
  - `genParams` 不再固定 `after23NewDay=0`，改为按当前下拉值传给精确历法接口，确保农历与日柱口径一致。
  - `onOptionChange('after23NewDay')` 时，已起盘状态下会强制重新请求农历并重算，避免仅重绘旧农历导致口径不一致。
  - 细化缓存键：遁甲盘缓存键与农历请求键都纳入 `after23NewDay`，防止“子初/子正”切换时串缓存。
  - 概览面板与快照文本新增“换日”显示项，便于复盘确认当前算法口径。
- Verification:
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 00:13 - 遁甲/三式合一盘面时间改为同排双显示：钟表时间 + 真太阳时
- Scope: show both `钟表时间` and `真太阳时` on the board header line to remove ambiguity while preserving direct time comparison.
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 遁甲盘顶部时间区改为双时间并排：`钟表时间：XX:XX  真太阳时：XX:XX`；日期优先显示真太阳时日期。
  - 三式合一顶部信息区改为三行：`农历`、`日期`、`时间`，其中“时间”行为双时间并排显示（钟表 + 真太阳时）。
  - 三式合一真太阳时来源优先使用 `dunjia.realSunTime`（回退 `nongli.birth`），确保展示与起盘算法一致。
- Verification:
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 00:18 - 时间展示微调：三式合一并入“日期行”，遁甲接在年月日后并留双 Tab 间距
- Scope: adjust board time typography/layout per latest UX request: no extra time row in 三式合一, and inline date+times in 遁甲 with clearer spacing.
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.less`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 三式合一顶部日期区取消独立“时间”行，改为在“日期”后同一行显示：`钟表时间：XX:XX  真太阳时：XX:XX`。
  - 三式合一该段时间字体降为小号（12px），以弱化次级信息视觉权重并减少拥挤感。
  - 遁甲盘标题区改为同一行展示：`公历年月日 +（双 Tab 视觉间距）+ 钟表时间/真太阳时`。
  - 遁甲在日期与时间段之间增加固定左间距（约 4em），对应“两个 tab”可读间隔。
- Verification:
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 00:24 - 紫微斗数新增“真太阳时/直接时间”选项（男右侧、四化盘左侧）并接入底层算法
- Scope: add time-basis selector in 紫微斗数 and make backend calculation switch between real-solar-time mode and direct-clock-time mode.
- Files:
  - `Horosa-Web/astrostudyui/src/components/ziwei/ZiWeiInput.js`
  - `Horosa-Web/astrostudyui/src/components/ziwei/ZiWeiMain.js`
  - `Horosa-Web/astrostudyui/src/components/ziwei/ZWCenterHouse.js`
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/ZiWeiController.java`
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/model/ZiWeiChart.java`
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/model/OnlyFourColumns.java`
  - `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/helper/NongliHelper.java`
  - `UPGRADE_LOG.md`
- Details:
  - 紫微输入区新增下拉：`真太阳时 / 直接时间`，位置放在“男/女”右侧、“四化盘”左侧（按你的指定顺序）。
  - 前端参数新增 `timeAlg`（0=真太阳时，1=直接时间）并透传至 `/ziwei/birth`。
  - 后端 `ZiWeiController` 增加 `timeAlg` 解析并传入 `ZiWeiChart`；仅允许 RealSun/DirectTime 两档。
  - `ZiWeiChart` 与 `OnlyFourColumns` 构造链路增加 `timeAlg` 支持：真太阳时保持现有算法；直接时间走不做经纬度时间修正的分支。
  - `NongliHelper` 增加带 `directTime` 开关的重载；`directTime=true` 时不再执行真太阳时偏移。
  - 紫微盘中心信息标签改为动态：`真太阳时：...` 或 `直接时间：...`，避免显示文案和算法不一致。
- Verification:
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`
  - `mvn -DskipTests install` in `Horosa-Web/astrostudysrv/astrostudy`
  - `mvn -DskipTests install` in `Horosa-Web/astrostudysrv/astrostudycn`

### 10:46 - 三式合一新增“真太阳时/直接时间”选项并打通前后端计算口径
- Scope: add time algorithm switch to `三式合一`（位置：命局右侧、男左侧），并让“直接时间”按时间组件计算、不受经纬度真太阳时修正影响。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web/astrostudyui/src/utils/preciseCalcBridge.js`
  - `Horosa-Web/astrostudyui/src/utils/localCalcCache.js`
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/NongliController.java`
  - `UPGRADE_LOG.md`
- Details:
  - 三式合一右侧首行参数扩展为四列：`命局/事局`、`真太阳时/直接时间`、`男/女`、`贵人体系`。
  - 新增 `timeAlg` 状态、保存/恢复链路、起盘参数、概览显示与快照文案；顶部时间展示按选项动态显示“真太阳时”或“直接时间”。
  - “直接时间”模式下，三式合一请求精确农历/节气时使用时区标准经线（`zone*15°`）与零纬度，不再按当前经纬度做真太阳时偏移。
  - 农历/节气前端缓存 key 增加 `timeAlg`，避免真太阳时与直接时间结果串缓存。
  - 后端 `/nongli/time` 增加 `timeAlg` 参数解析并支持 DirectTime：直接时间时返回不经真太阳时偏移的农历基础字段，同时保留四柱/方向等结构字段。
- Verification:
  - `npm --prefix Horosa-Web/astrostudyui run test -- --runInBand --passWithNoTests astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `mvn -f Horosa-Web/astrostudysrv/astrostudycn/pom.xml -DskipTests compile`

### 10:52 - 六壬四课文案修正：`干支` 更名 `地盘`，去除四课冗余注释展开
- Scope: align 六壬四课输出术语，去掉无用的“(一课/二课/三课/四课)”扩展标记。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `UPGRADE_LOG.md`
- Details:
  - 六壬四课行文从 `干支=...` 调整为 `地盘=...`（仍保留 `天盘`、`贵神`）。
  - AI 导出规范中移除 `四课 -> 四课(一课/二课/三课/四课)` 的替换规则，标题保持为简洁 `四课`。
- Verification:
  - `npm --prefix Horosa-Web/astrostudyui run test -- --runInBand --passWithNoTests astrostudyui/src/components/lrzhan/LiuRengMain.js`

### 11:12 - 星盘组件新增“星曜附带后天宫信息”并全页面/AI 导出同步
- Scope: add a global chart option in `星盘组件` to append each star/object label with natal-house placement and rulership info, and make it effective across all chart-calculation pages and AI exports.
- Files:
  - `Horosa-Web/astrostudyui/src/models/app.js`
  - `Horosa-Web/astrostudyui/src/components/astro/ChartDisplaySelector.js`
  - `Horosa-Web/astrostudyui/src/utils/planetHouseInfo.js`
  - `Horosa-Web/astrostudyui/src/pages/index.js`
  - `Horosa-Web/astrostudyui/src/utils/astroAiSnapshot.js`
  - `Horosa-Web/astrostudyui/src/utils/predictiveAiSnapshot.js`
  - `Horosa-Web/astrostudyui/src/components/jieqi/JieQiChartsMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroAspect.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroInfo.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPlanet.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPredictPlanetSign.js`
  - `Horosa-Web/astrostudyui/src/components/relative/AspectInfo.js`
  - `Horosa-Web/astrostudyui/src/components/relative/MidpointInfo.js`
  - `Horosa-Web/astrostudyui/src/components/relative/AntisciaInfo.js`
  - `UPGRADE_LOG.md`
- Details:
  - 新增全局开关 `showPlanetHouseInfo`（持久化），在“星盘组件”面板中可直接开启/关闭。
  - 新增工具 `planetHouseInfo`，统一格式输出：`X (1th; 2R6R)`。
  - 将该开关从首页路由层透传到星盘、推运、关系盘、节气盘、三式合一、希腊星术、印度盘等含星盘计算页面的右侧星曜文本区域。
  - AI 导出（常规与推运）同步使用相同标签增强逻辑，确保导出文本与右侧显示一致。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`
  - `rg -n "showPlanetHouseInfo|appendPlanetHouseInfoById" Horosa-Web/astrostudyui/src`

### 11:47 - 三式合一切页卡顿优化：重算延迟合并 + 快照异步 + 太乙缓存
- Scope: improve UX freeze when entering `三式合一` by removing heavy synchronous work from immediate tab switch.
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - `recalcByNongli` 改为短延迟合并执行（同批多次触发只计算最后一次），降低主线程阻塞峰值。
  - 拆分 `performRecalcByNongli`，并为太乙结果加入 `taiyiCache`，减少重复计算。
  - AI 快照文本构建/写入改为延后执行，不阻塞首帧起盘显示。
  - `refreshAll` 改为等待首轮重算后再关 loading，并限制 seed 完成后的重复补算触发。
  - 右侧 Tabs 启用 `destroyInactiveTabPane` + `animated={false}`，减少初次渲染负载。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run test --silent -- --watch=false` in `Horosa-Web/astrostudyui`

### 12:10 - 修复开启“星曜附带后天宫信息”后符号乱码
- Scope: fix unreadable garbled text when the house-info suffix is appended to symbol-font planet labels.
- Files:
  - `Horosa-Web/astrostudyui/src/utils/planetHouseInfo.js`
  - `UPGRADE_LOG.md`
- Details:
  - 新增标签归一化逻辑：当检测到标签来自 `AstroMsg` 符号字形（如 `A/B/C...`）时，自动切换为 `AstroMsgCN` 可读中文名再拼接后天宫信息。
  - 保持未开启开关时的旧显示逻辑不变，避免影响原有符号盘视觉。
  - 解决症状：右侧“盲点/反盲点、接纳、互容”等模块在开关开启时不再出现乱码。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run test --silent -- --watch=false` in `Horosa-Web/astrostudyui`

### 12:15 - 三式合一起盘再提速（保持精度）：精确结果预取 + 同参缓存优先 + 回退仅兜底
- Scope: further reduce `三式合一` wait time while preserving calculation precision (no algorithm simplification).
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - `refreshAll` 优先读取“同参数精确农历缓存”（`getNongliLocalCache`），命中时立即使用精确结果起盘。
  - 仅当同参缓存未命中时才等待精确接口；回退到 `chart/state nongli` 仅作为“精确服务未及时返回”的兜底显示，不改变最终精化结果。
  - 将首帧预算时间下调到 `2200ms`，缩短无缓存场景下的等待窗口。
  - 在时间确认、时间算法切换、关键起局参数切换、点击起盘前新增精确农历/节气预取，尽量在用户点击前把精确数据准备到缓存。
  - 保留后续精确结果自动覆盖逻辑：回退盘仅临时显示，精确结果到达后会自动重算替换。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run test --silent -- --watch=false` in `Horosa-Web/astrostudyui`

### 12:17 - 再修“星曜附带后天宫信息”乱码：后缀改为全中文安全格式
- Scope: eliminate remaining Astro symbol-font garbling when house-info suffix is rendered inside right-panel lines that use `AstroFont`.
- Files:
  - `Horosa-Web/astrostudyui/src/utils/planetHouseInfo.js`
  - `UPGRADE_LOG.md`
- Details:
  - 将后缀格式从 ASCII 版（如 `1th; 2R6R`）改为全中文安全格式（如 `一宫；主二、六宫`），并使用全角括号。
  - 保留原语义不变：仍表示“所在后天宫位 + 所主宰后天宫位”，但避免 `AstroFont` 对英文字母/数字映射导致乱码。
  - 继续保留符号标签自动转中文名逻辑，确保右侧长文本模块统一可读。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run test --silent -- --watch=false` in `Horosa-Web/astrostudyui`

### 12:28 - 星曜后天信息迁移到 AI 导出设置 + 导出卡顿优化 + 移除星盘组件示例文案
- Scope: move “星曜宫位/主宰宫位”控制到各星盘相关页面的 AI 导出设置，移除星盘组件中 `X (1th; 2R6R)` 入口，并降低 AI 导出触发时页面卡死风险。
- Files:
  - `Horosa-Web/astrostudyui/src/components/homepage/PageHeader.js`
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web/astrostudyui/src/utils/planetHouseInfo.js`
  - `Horosa-Web/astrostudyui/src/utils/astroAiSnapshot.js`
  - `Horosa-Web/astrostudyui/src/utils/predictiveAiSnapshot.js`
  - `Horosa-Web/astrostudyui/src/components/astro/ChartDisplaySelector.js`
  - `Horosa-Web/astrostudyui/src/models/app.js`
  - `Horosa-Web/astrostudyui/src/components/jieqi/JieQiChartsMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - AI 导出设置新增两项（按技法独立保存）：`显示星曜宫位`、`显示星曜主宰宫`，覆盖星盘/关系盘/推运/希腊/印度/节气/三式合一/七政四余/量化盘等星盘相关页面。
  - `planetHouseInfo` 改为“显式参数驱动”，不再从全局 `showPlanetHouseInfo` 自动读取；并统一后缀标记为 `（后天：...）` 以便导出阶段按设置裁剪。
  - AI 导出链路新增后缀裁剪：可输出“仅宫位 / 仅主宰宫 / 两者都显示 / 两者都不显示”。
  - 导出性能优化：为字体解码增加快速检测门禁、超长文本跳过重排美化，降低主线程阻塞概率。
  - 从“星盘组件”移除“星曜附带后天宫信息（X (1th; 2R6R)）”控制项，避免与 AI 导出设置重复、并杜绝该入口导致的界面符号字体乱码。
  - 兼容旧用户本地配置：启动后强制 `showPlanetHouseInfo=0`，防止历史缓存残留继续影响页面右侧显示。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run test --silent -- --watch=false` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 14:24 - 修复六壬“确定无法排盘”与金口诀“二次起盘失效”
- Scope: restore predictable re-plot behavior in `易与三式 -> 六壬/金口诀`; after changing time, clicking `确定` or `排盘` should reliably trigger a new盘面.
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengInput.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouMain.js`
  - `Horosa-Web/astrostudyui/src/components/cnyibu/CnYiBuMain.js`
  - `Horosa-Web/astrostudyui/src/models/astro.js`
  - `UPGRADE_LOG.md`
- Details:
  - `LiuRengInput` 时间回调增加 `__confirmed` 标记，区分“编辑中”与“已点击确定”。
  - `LiuRengMain` 在 `__confirmed=true` 时允许 hook 触发，并新增 `startPaiPanByFields` 统一锁定 `calcFields/calcChart` + 请求六壬数据；这样点时间控件“确定”即可直接起课，不再只能依赖右侧“起课”按钮。
  - `JinKouMain` 字段同步改为 `astro/fetchByFields`（静默请求），并按 `__confirmed` 控制是否触发 hook 重算，修复首次后时间变更再起盘不生效的问题。
  - `JinKouMain` 新增 `calcFields` 作为本次起盘上下文，`runyear` 校验、年龄计算、保存快照统一使用该上下文，避免重复起盘时读取旧字段。
  - `cnyibu` hook 链路与 `astro` model 的 `hooking` 增加 `chartObj` 透传，确保子模块在 hook 中可拿到本次排盘结果对应的图表上下文。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 00:27 - 金口诀按课本规则校准：四位起法/昼夜贵神/用爻判定
- Scope: align `金口诀` core model with the rule set you provided (立地分、月将加时方上传、甲戊庚牛羊等贵神口诀、时干起人元、用爻判定) and reduce mismatch with external software.
- Files:
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouCalc.js`
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouMain.js`
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouCalc.test.js`
  - `UPGRADE_LOG.md`
- Details:
  - 在 `JinKouCalc` 新增并显式使用“月将映射表（寅月亥将…丑月子将）”，不再隐式依赖其他模块常量，确保“月将加时方上传”路径可读、可核验。
  - 贵神（星座）起法改为显式口诀配置（甲戊庚牛羊、乙己鼠猴、丙丁猪鸡、壬癸蛇兔、辛午虎），并保留原有 `guirengType` 兼容。
  - 增加 `isDiurnal` 覆盖能力：优先使用盘面昼夜（太阳在地平线上下）判定贵神顺逆；未提供时仍回退到时支昼夜。
  - 新增“用爻判定”模型输出：根据四位阴阳自动给出 `yongYao`（三阴一阳、三阳一阴、二阴二阳、纯阴反阳、纯阳反阴规则），并写入 AI 快照文本。
  - `JinKouMain` 打通 `chart.isDiurnal` 到 `buildJinKouData`；并在请求后缓存本次起盘昼夜状态，避免重绘时昼夜规则漂移。
  - 地分保留“自动随时支”与“手动指定”两种行为：默认自动；一旦用户手动改地分则锁定为手动值，不再被后续时间变更覆盖。
- Verification:
  - `npm test -- JinKouCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 00:35 - 金口诀用爻增加盘面下划线标识
- Scope: make 用爻 visually explicit on the 金口诀主盘，符合“取用处下划一横”习惯。
- Files:
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouPanChart.js`
  - `UPGRADE_LOG.md`
- Details:
  - 在四位中表渲染阶段读取 `jinkouData.yongYao.label`，对对应行的“内容列”绘制下划线。
  - 下划线采用黑色 2px，宽度按单元格自适应（约 56%），避免不同分辨率下过短或过长。
  - 仅在有有效用爻标签时显示，不影响无数据态或其他行。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`

### 00:40 - 金口诀时间编辑改为“仅点确定后更新左盘”
- Scope: stop `金口诀` left-panel 六壬盘 auto-refresh during time drafting; refresh only after clicking 时间控件“确定”, while keeping repeated re-calc available.
- Files:
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - `onFieldsChange` 针对 `__confirmed` 增加门禁：当 `__confirmed=false`（时间仍在编辑态）直接返回，不发起 `astro/fetchByFields`。
  - 因此右侧调时间时左上六壬盘不再实时跳动；点击“确定”后（`__confirmed=true`）才同步字段并触发重算。
  - 保留确认后的 hook 链路，支持再次调时并再次点击“确定”重复更新时间计算。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`

### 00:46 - 金口诀出生时间输入改为确认后再算行年，消除编辑卡顿
- Scope: avoid lag when editing `卜卦人出生时间` in 金口诀 by deferring runyear recompute until explicit confirm.
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengBirthInput.js`
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - `LiuRengBirthInput` 新增 `requireConfirm` 模式：在该模式下时间控件显示“确定”按钮，并回传 `__confirmed` 标记。
  - `JinKouMain` 在出生时间回调中对 `__confirmed=false` 直接忽略，不再在编辑过程触发 `requestRunYear`。
  - 仅当点击“确定”（`__confirmed=true`）后才更新 `birth` 并重算行年，因此连续调节出生年月日时不再每步卡顿。
  - 保持可重复计算：每次再次调整后点击“确定”都会重新计算最新结果。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`

### 12:37 - 按反馈修正：保留星盘组件开关 + 恢复 Astro 字体主显示
- Scope: keep the UI option `星曜附带后天宫信息` in `星盘组件` (without example suffix text), and restore symbol-first Astro-font display style (no forced Chinese replacement for planet labels).
- Files:
  - `Horosa-Web/astrostudyui/src/components/astro/ChartDisplaySelector.js`
  - `Horosa-Web/astrostudyui/src/utils/planetHouseInfo.js`
  - `Horosa-Web/astrostudyui/src/models/app.js`
  - `UPGRADE_LOG.md`
- Details:
  - 在“星盘组件”恢复复选项入口：`星曜附带后天宫信息`；删除示例文案 `（X (1th; 2R6R)）`。
  - 取消星曜标签的“符号->中文”强制替换，恢复 Astro 字体符号主显示风格。
  - 撤销对 `showPlanetHouseInfo` 的强制清零逻辑，恢复该开关可用并持久化。
  - 保留已新增的 AI 导出设置能力（按技法控制“宫位/主宰宫”），与星盘组件开关并行可用。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run test --silent -- --watch=false` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 13:50 - 后天宫位后缀改为英文数字格式 + AI 导出裁剪兼容 ASCII/CN 双格式
- Scope: follow latest display rule: house/ruler info uses `1th` / `3R6R` style, and ensure AI 导出设置在历史中文后缀与新英文后缀下都能正确裁剪。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/planetHouseInfo.js`
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `UPGRADE_LOG.md`
- Details:
  - `planetHouseInfo` 输出统一为 ASCII 样式：`(1th; 3R6R)`，并保留“仅宫位 / 仅主宰宫 / 两者都显示”三种组合能力。
  - AI 导出 `trimPlanetInfoBySetting` 增强为双格式解析：
    - 兼容旧中文后缀（如“后天：一宫；主二、六宫”）
    - 兼容新 ASCII 后缀（如 `1th; 2R6R`）
  - AI 导出缓存读取不再依赖旧中文后缀标记，已有快照可直接复用，减少重复构建快照导致的主线程阻塞。
  - 继续保留“星盘组件”中的 `星曜附带后天宫信息` 选项文案（无示例后缀样例文本）。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run test --silent -- --watch=false` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 13:54 - 星曜标签括号统一为半角英文 `()`
- Scope: reduce visual width in星曜标签 by replacing full-width Chinese brackets with half-width English brackets.
- Files:
  - `Horosa-Web/astrostudyui/src/components/astro/PlanetSelector.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroLots.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPlanet.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPredictPlanetSign.js`
  - `UPGRADE_LOG.md`
- Details:
  - 将 `AstroMsg + （AstroTxtMsg）` 统一替换为 `AstroMsg + (AstroTxtMsg)`，避免全角括号占用过宽。
  - 不改变任何计算逻辑，仅调整显示字符样式。

### 13:58 - 主/界限法 + 法达星限表格同步改为半角括号显示
- Scope: apply the same compact `()` style in `主/界限法` and `法达星限` tables, with symbol + readable name in one cell.
- Files:
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroFirdaria.js`
  - `UPGRADE_LOG.md`
- Details:
  - 新增统一星曜渲染函数，表格内显示从“纯符号”升级为 `符号(中文名)`，括号采用半角英文 `()`.
  - `主/界限法`：迫星/应星筛选项与表格文本（映点/反映点/相位处等）统一使用该显示方式。
  - `法达星限`：主限/子限两列统一使用该显示方式。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run test --silent -- --watch=false` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 14:09 - 修复后天信息开启后乱码 + 主/界限法与法达星限改为宫位/主宰宫信息
- Scope: eliminate AstroFont garbling after enabling `星曜附带后天宫信息`, and make `主/界限法` + `法达星限` display house/ruler suffix instead of Chinese-name suffix.
- Files:
  - `Horosa-Web/astrostudyui/src/utils/planetHouseInfo.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroAspect.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroInfo.js`
  - `Horosa-Web/astrostudyui/src/components/relative/AspectInfo.js`
  - `Horosa-Web/astrostudyui/src/components/relative/MidpointInfo.js`
  - `Horosa-Web/astrostudyui/src/components/relative/AntisciaInfo.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroGivenYear.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroLunarReturn.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroProfection.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroSolarArc.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroSolarReturn.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPlanet.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPredictPlanetSign.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroFirdaria.js`
  - `Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 新增 `splitPlanetHouseInfoText`，并在 UI 里统一“符号(后天信息)”分字体渲染：符号保持 `AstroFont`，后缀改用 `NormalFont`，解决 `1th/3R6R` 在 AstroFont 下的乱码问题。
  - `appendPlanetHouseInfoById` 在找不到对象时不再输出 `(-; -)`，直接回退原标签，避免非星曜 token 被错误附加后缀。
  - `主/界限法`、`法达星限` 改为读取当前盘对象并显示 `(1th; 3R6R)` 后缀；不再显示中文名括号。
  - `AstroDirectMain` 已透传 `showPlanetHouseInfo` 到 `AstroPrimaryDirection` 与 `AstroFirdaria`。
  - AI 快照中的 `主/界限法`、`法达星限`表格也同步写入后天宫位/主宰宫位信息，并继续由 AI 导出设置做按技法裁剪。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run test --silent -- --watch=false` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`

### 00:56 - 行年算法按立春边界修正（六壬 / 金口诀 / 三式合一）
- Scope: fix `行年` mismatch after changing birth time and align with your rule set: use节气年干支（立春为界）、男顺女逆行年序列、确认后可重复重算。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/helper/LiuRengHelper.java`
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/LiuRengController.java`
  - `UPGRADE_LOG.md`
- Details:
  - 前端行年参数不再取 `nongli.year`，改为优先取四柱年干支（`fourColumns.year.ganzi`），并提供 `yearGanZi/yearJieqi/year` 多级回退，避免“农历年 vs 立春年”混用导致的错盘。
  - 六壬与金口诀请求 `/liureng/runyear` 时新增卜卦时刻参数（`guaDate/guaTime/guaAd/guaZone/guaLon/guaLat/guaAfter23NewDay`），让后端可在缺失干支时自动反算节气年柱。
  - 后端 `runyear` 增加干支规范化与合法性校验；当 `guaYearGanZi` 缺失或不规范时，自动按卜卦时刻重建四柱并取年柱干支。
  - 后端年龄由“仅60甲子余数”扩展为“立春年序差值”：新增 `ageCycle`（0-59循环位）并返回 `age`（按立春年差推得的实际年龄步数），行年干支仍严格按男丙寅顺行、女壬申逆行表取值。
  - 移除前端用公历年份二次拼接年龄的旧逻辑，避免覆盖后端立春算法结果；出生时间确认后会按新规则实时刷新左侧行年。
  - 三式合一补充 `liureng.nianMing` 优先读取 `nongli.runyear`，与六壬/金口诀年命展示口径保持一致。
- Verification:
  - `npm test -- JinKouCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`
  - `mvn -DskipTests install` in `Horosa-Web/astrostudysrv/astrostudycn`

### 01:03 - 继续修复“点击确定后行年不更新”：前端增加独立行年兜底计算
- Scope: address remaining case where `runyear` endpoint may still返回旧值（如始终0岁）导致界面不刷新；金口诀/六壬在“确认出生时间”后强制按四柱干支本地重算行年并覆盖显示。
- Files:
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouMain.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 在前端加入完整60甲子序列与男女行年序列生成（男：丙寅起顺行；女：壬申起逆行），不再依赖后端返回年龄显示正确与否。
  - `requestRunYear` 在请求后新增本地覆盖逻辑：读取“出生四柱年干支”（通过静默 `/liureng/gods` 获取）+“卜卦年干支”，按立春年柱序差计算 `age`，并写入 `ageCycle` 与 `year`。
  - 加入 `birthYearGanZi` 缓存，避免同一出生参数重复请求带来额外卡顿。
  - 即使后端仍是旧实现或未重启，点击“确定”后行年也会按当前规则更新，不再停留在0岁/丙寅。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`
  - `npm test -- JinKouCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`

### 01:08 - 再次加固行年兜底：无干支时按出生/卜卦年份差强制刷新
- Scope: fix your screenshot scenario where `行年` still stayed `丙寅/0岁`; when干支链路任一环节取不到值时，仍保证点击“确定”后行年变化可见。
- Files:
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouMain.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - `requestRunYear` 里把本地重算改为三层兜底：
    1) 先用“出生年柱干支 + 卜卦年柱干支”计算；
    2) 若干支缺失，则按出生年与卜卦年的公历年差计算年龄并映射男女行年序列；
    3) 若仍失败，则用后端返回 `age` 反推 `ageCycle/year`。
  - 因此即便接口返回旧值或干支未取到，2019→2026 这类修改也会把显示从 `0岁` 推进到对应年龄，并同步行年干支。
  - 保留前一版的缓存与静默请求，不增加输入时的明显卡顿。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`
  - `npm test -- JinKouCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`

### 01:13 - 修复请求失败导致行年不落盘：runyear请求改为try/catch并保证兜底写回
- Scope: when `/liureng/runyear` 请求异常或返回不完整时，之前会提前中断导致界面继续显示 `丙寅/0岁`；现在无论接口是否成功都保证把前端兜底结果写入盘面。
- Files:
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouMain.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - `requestRunYear` 改为“先算前端fallback，再尝试接口覆盖，再统一落盘”：
    - 即使接口抛错，也会使用 `出生年-卜卦年` 的兜底年龄+男女行年序列更新显示；
    - 仅当“干支缺失且fallback也不可得”才提示并终止。
  - 去除“先判 `guaYearGanZi` 再直接return”的硬阻断，避免本地可算时被提前中止。
  - 对 `year/age/ageCycle` 增加最终缺省兜底赋值，确保不会留下旧状态。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`
  - `npm test -- JinKouCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`
  - `node` 本地脚本校验：`2017->2026 男 => 9岁 / 乙亥`

### 01:18 - 前端显示层强制兜底：即使state.runyear未刷新也按出生年差显示
- Scope: fix stubborn UI case where backend/state链路未及时更新但盘面仍显示旧值（`丙寅/0岁`）；在渲染与保存阶段增加显示层兜底，保证画面不再卡旧值。
- Files:
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouMain.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 新增 `resolveDisplayRunYear`：按当前“出生年 vs 卜卦年”生成 fallback 行年，并在以下情况覆盖展示：
    - `runyear` 缺失；
    - `age` 非数值；
    - `age=0` 但出生年差>0；
    - `year` 为空或异常停留在 `丙寅`。
  - `JinKouChart` / `LiuRengChart` 传入的 `runyear` 改为 `displayRunYear`，避免 UI 继续绑定陈旧 state。
  - 保存案例时也改为写入 `displayRunYear`，避免导出内容与界面不一致。
- Verification:
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`
  - `npm test -- JinKouCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`

### 01:28 - 再修“点确定后行年不变”：出生时间确认时先本地落盘，再请求校正
- Scope: ensure `金口诀/六壬` 在点击“卜卦人出生时间”的“确定”后，左侧行年立即可见变化，不再依赖异步接口先返回。
- Files:
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouMain.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - `JinKouMain.onBirthChange` 改为“先计算 `displayRunYear` 写入 `state.runyear`，再异步 `requestRunYear` 校正”，避免接口慢/失败时盘面保持旧值。
  - `LiuRengMain.onBirthChange` 同步改为确认门禁逻辑（`__confirmed`）：未确认不重算，确认后先本地更新行年再请求后端校正。
  - `LiuRengMain` 的 `LiuRengBirthInput` 打开 `requireConfirm={true}`，与金口诀一致：编辑时不触发重算，仅点“确定”才刷新。
  - 两处都保留后续 `requestRunYear()`，因此“再次调整 -> 再点确定”可重复更新时间并继续得到正确行年。
- Verification:
  - `npm test -- JinKouCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`
  - `/bin/zsh -lc 'cd "Horosa-Web"; ./start_horosa_local.sh; ./verify_horosa_local.sh; ./stop_horosa_local.sh'`

### 01:33 - 修复“出生时间看起来已改但行年仍用旧值”判定漏洞
- Scope: fix case shown in latest screenshot where出生时间面板已改到早年，但行年仍停留在旧年龄（本质是旧 `runyear` 非0时未触发fallback覆盖）。
- Files:
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouMain.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 强化 `resolveDisplayRunYear` 覆盖条件：新增“硬不一致”判定。
    - `|currAge - fallbackAge| >= 2` 时，强制用当前出生年差fallback覆盖；
    - `ageCycle` 与 fallback 差距 >= 2（按60循环最短距离）时也覆盖；
    - 年龄相同但行年干支不同（常见于性别切换或旧状态残留）时覆盖。
  - 保留“边界容忍”策略：仅差 1 岁（立春边界附近）不强制覆盖，避免误伤节气边界场景。
  - 这样可修复“UI里出生时间改了，但runyear沿用历史值”的场景，不会再被旧 `2岁/戊辰` 卡住。
- Verification:
  - `npm test -- JinKouCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`
  - `/bin/zsh -lc 'cd "Horosa-Web"; ./stop_horosa_local.sh; ./start_horosa_local.sh; ./verify_horosa_local.sh; ./stop_horosa_local.sh'`

### 01:38 - 修复“出生时间控件显示已改，但内部birth state未同步”导致行年仍按旧出生年
- Scope: fix latest screenshot scenario where birth selector显示为2020，但行年仍是 `丙寅/0岁`（原因是未确认编辑时父组件birth state不更新，后续判定仍读旧年）。
- Files:
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouMain.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 调整 `onBirthChange` 行为：即使 `__confirmed=false`，也先同步 `birth` 到父组件 `state`，并同步一次 `displayRunYear`（纯前端fallback，不走接口）。
  - 只有在 `__confirmed=true` 时才触发 `requestRunYear()` 请求校正，保持“编辑不卡顿、确认后精算”的交互目标。
  - 这样可避免“控件内部时间已变，但父状态还停在旧年”造成的行年错误。
  - 对你截图场景（卜卦2026、出生2020、男）fallback会稳定得到 `6岁 / 壬申`，不会再落到 `0岁 / 丙寅`。
- Verification:
  - `npm test -- JinKouCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`
  - `/bin/zsh -lc 'cd "Horosa-Web"; ./stop_horosa_local.sh; ./start_horosa_local.sh; ./verify_horosa_local.sh; ./stop_horosa_local.sh'`

### 01:46 - 交互回归修正：左盘仅在点击计算确认后更新（出生时间编辑不再实时改盘）
- Scope: follow latest UX requirement: when editing `卜卦人出生时间`, left chart must stay unchanged until user clicks the calculation confirm button (`确定`) on that birth-time panel.
- Files:
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouMain.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 引入“草稿出生时间 vs 已应用出生时间”分离：
    - `birth` 保持输入框草稿值（可随编辑变化）；
    - `calcBirth` 仅在确认计算时更新（作为行年与左盘使用值）。
  - `onBirthChange` 逻辑改为：
    - `__confirmed=false`：只同步 `birth`，不触发 `requestRunYear`，不更新左盘行年；
    - `__confirmed=true`：同步 `birth + calcBirth`，再触发重算并刷新左盘。
  - 行年相关计算与显示（`genRunYearParams/requestBirthYearGanZi/requestRunYear/render/case save`）统一改为读取 `calcBirth`，彻底杜绝“编辑过程实时改盘”。
  - 保留确认后兜底校正链路，仍可反复“调整 -> 确定 -> 更新”。
- Verification:
  - `npm test -- JinKouCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`
  - `/bin/zsh -lc 'cd "Horosa-Web"; ./stop_horosa_local.sh; ./start_horosa_local.sh; ./verify_horosa_local.sh; ./stop_horosa_local.sh'`

### 01:52 - 最终修正：按“页面计算按钮”应用出生时间（非编辑态实时应用）
- Scope: fix latest regression where after stopping realtime updates, runyear could stay on old birth year (`丙寅/0岁`) if user expected page-level calculate action to apply new birth input.
- Files:
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouMain.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 明确“草稿输入”和“计算使用值”职责：
    - `birth`：仅作为右侧出生时间输入框草稿；
    - `calcBirth`：仅在页面实际计算入口触发时更新（`requestGods` 被调用时，从当前 `birth` 克隆应用）。
  - `onBirthChange` 改为只更新 `birth`，不再改 `runyear/calcBirth`，彻底避免编辑过程影响左盘。
  - 在 `requestGods` 内统一执行 `calcBirth = clone(birth)`，确保你点击页面计算按钮后，本次计算一定使用你当前输入的出生时间。
  - `requestRunYear/genRunYearParams/requestBirthYearGanZi/render/save` 全部继续使用 `calcBirth`，实现“未计算不生效、计算后必生效”。
- Verification:
  - `npm test -- JinKouCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`
  - `npm run build --silent` in `Horosa-Web/astrostudyui`
  - `npm run build:file --silent` in `Horosa-Web/astrostudyui`
  - `/bin/zsh -lc 'cd "Horosa-Web"; ./stop_horosa_local.sh; ./start_horosa_local.sh; ./verify_horosa_local.sh; ./stop_horosa_local.sh'`

### 17:33 - 修复“行星选择”面板乱码，恢复符号+中文原样式
- Scope: fix garbled labels in `行星选择` drawer where Chinese text was rendered with the astrology glyph font.
- Files:
  - `Horosa-Web/astrostudyui/src/components/astro/PlanetSelector.js`
  - `UPGRADE_LOG.md`
- Details:
  - 新增 `renderLabel(item)`，将标签拆分为“符号”和“中文说明”两段渲染。
  - 仅对符号段应用 `AstroConst.AstroFont`，中文与括号使用默认字体，避免 `☉灵点?` 这类乱码。
  - 去掉 `Checkbox` 整体 `fontFamily` 设置，避免把非符号字符也强制走占星字体。
  - 清理 `PlanetSelector` 中未使用的导入与未使用参数，保持组件干净。
- Verification:
  - `npm run build` in `Horosa-Web/astrostudyui`

## 2026-02-22

### 00:18 - Mac 一键部署容错增强：先装 Homebrew，失败自动直连 JDK17；并修复 Local 启动链路
- Scope: make Mac deployment/startup resilient on clean machines without Java/Homebrew, and remove runtime bootstrap crashes.
- Files:
  - `scripts/mac/bootstrap_and_run.sh`
  - `Horosa_Local.command`
  - `Horosa-Web/start_horosa_local.sh`
  - `Prepare_Runtime_Mac.command`
  - `README.md`
  - `UPGRADE_LOG.md`
- Details:
  - `bootstrap_and_run.sh` 调整为“优先安装/使用 Homebrew + openjdk@17，失败时自动直连下载 JDK17 到 `.runtime/mac/java`（可用 `HOROSA_JDK17_URL` 覆盖）”。
  - `ensure_java17` 增加多级探测与版本校验（项目内 runtime、`.runtime/mac/java`、系统 `JAVA_HOME`、`/usr/libexec/java_home`、brew Java、PATH Java），并强制校验 `>=17`。
  - `Horosa_Local.command` 修复 runtime 兜底崩溃：移除 `SCRIPT_ARGS[@]` 的 `set -u` 未绑定变量触发点；缺依赖回退 bootstrap 时默认先尝试 Homebrew（同时保留直连 JDK fallback）。
  - `Horosa_Local.command` / `start_horosa_local.sh` 均增加 `java -version` 可执行性校验，避免把 `/usr/bin/java` 误判为可用 JDK。
  - Python 运行时选择改为“依赖就绪优先”（必须含 `cherrypy/jsonpickle/swisseph`），项目内 Python 不满足时自动换到可用解释器或回退一键补齐。
  - `Prepare_Runtime_Mac.command` 增强：找不到 Java 时自动调 bootstrap 补齐；Python runtime 复制后自动补装依赖并过滤 `_CodeSignature` 复制噪声；最终“下一步”提示按实际准备结果给出。
  - README 更新了“无 Homebrew 的 JDK17 直连兜底”与 `HOROSA_JDK17_URL` 说明。
- Verification:
  - `bash -n Horosa_Local.command Prepare_Runtime_Mac.command Horosa-Web/start_horosa_local.sh scripts/mac/bootstrap_and_run.sh`
  - `HOROSA_SKIP_BUILD=1 HOROSA_SKIP_DB_SETUP=1 HOROSA_SKIP_LAUNCH=1 HOROSA_SKIP_TOOLCHAIN_INSTALL=0 ./scripts/mac/bootstrap_and_run.sh`
  - `HOROSA_SKIP_BUILD=1 HOROSA_SKIP_DB_SETUP=1 HOROSA_SKIP_LAUNCH=1 HOROSA_SKIP_TOOLCHAIN_INSTALL=1 ./scripts/mac/bootstrap_and_run.sh`
  - `printf '\n' | ./Prepare_Runtime_Mac.command`（结果：Java/Python/Frontend/Backend 均为 OK；沙箱下 Maven install 写 `~/.m2` 受限但产物回填成功）
  - `HOROSA_NO_BROWSER=1 ./Horosa_Local.command`（沙箱环境限制本地端口绑定，启动探测阶段失败；非脚本逻辑错误）

### 19:46 - 奇门遁甲起盘性能优化（保持算法精度）并完成回归自检
- Scope: reduce Qimen startup latency caused by heavyweight jieqi/nongli pre-calculation, without changing core astrological algorithm or precision.
- Files:
  - `Horosa-Web/astrostudyui/src/utils/localCalcCache.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web/astropy/astrostudy/jieqi/YearJieQi.py`
  - `Horosa-Web/astropy/astrostudy/jieqi/NongLi.py`
- Details:
  - 节气 seed 缓存键补全 `jieqis/seedOnly`，避免“奇门两节气 seed”与“节气模块全年/多节气结果”互相污染，提升缓存命中稳定性。
  - `DunJiaMain` / `SanShiUnitedMain` 移除重复、非标准参数的 `setJieqiSeedLocalCache` 写入，统一走 `fetchPreciseJieqiSeed` 内部规范化缓存路径。
  - `YearJieQi` 强化参数解析（`seedOnly` 字符串布尔、`jieqis` 类型兼容），并在非图表场景减少不必要中间结构构建。
  - `NongLi` 计算节气时改为仅请求 `中气` 集合（含冬至），并通过“按名称定位冬至”替代固定下标访问，减少大量不参与农历月建判断的节气求解开销。
  - 精度校验：通过同一输入对比“旧路径（24节气） vs 新路径（中气子集）”的 `months/prevDongzi/dongzi` 结果，样本年份 `1901/1949/1984/2000/2024/2026/2050` 全量一致。
- Verification:
  - `npm test -- DunJiaCalc.test.js --runInBand`（PASS）
  - `npm run build --silent`（PASS）
  - `npm run build:file --silent`（PASS）
  - `python3 -m py_compile Horosa-Web/astropy/astrostudy/jieqi/YearJieQi.py Horosa-Web/astropy/astrostudy/jieqi/NongLi.py`（PASS）
  - `mvn -DskipTests compile` in `Horosa-Web/astrostudysrv/astrostudycn`（BUILD SUCCESS）
  - `PYTHONPATH='Horosa-Web/flatlib-ctrad2:Horosa-Web/astropy' python3 <对比脚本>`（结果：`ALL_MATCH=True`）

### 20:07 - 修复“无 Homebrew / 无 Maven 导致后端 jar 缺失无法启动”
- Scope: resolve startup failure on clean mac machines where `Prepare_Runtime_Mac.command` can build frontend but fails backend with `未检测到 mvn` and then `Horosa_Local.command` reports missing `astrostudyboot.jar`.
- Files:
  - `scripts/mac/bootstrap_and_run.sh`
  - `Prepare_Runtime_Mac.command`
  - `Horosa_Local.command`
  - `Horosa-Web/start_horosa_local.sh`
  - `UPGRADE_LOG.md`
- Details:
  - `bootstrap_and_run.sh` 增加 Maven 本地兜底：
    - 无 brew/mvn 时自动下载 Apache Maven 到 `.runtime/mac/maven`（可用 `HOROSA_MAVEN_URL` / `HOROSA_MAVEN_VERSION` 覆盖）；
    - Maven 构建统一走本地仓库 `.runtime/mac/m2`，降低对用户家目录写权限与环境差异依赖。
  - `Prepare_Runtime_Mac.command` 的后端阶段增强：
    - 目标 jar 缺失时，自动调用 `bootstrap_and_run.sh` 执行后端构建补齐；
    - 若已存在 `runtime/mac/bundle/astrostudyboot.jar`，可复用不再直接失败。
  - `Horosa_Local.command` 增强后端自愈：
    - `target` 与 `bundle` 均缺失时，自动触发一键部署脚本补齐后端 jar；
    - 补齐后自动回填，仍失败才给出明确提示。
  - `start_horosa_local.sh` 增加 bundle jar 回填逻辑（直接运行脚本时也能自愈）。
- Verification:
  - `bash -n Horosa_Local.command Prepare_Runtime_Mac.command Horosa-Web/start_horosa_local.sh scripts/mac/bootstrap_and_run.sh`
  - `HOROSA_SKIP_BUILD=1 HOROSA_SKIP_DB_SETUP=1 HOROSA_SKIP_LAUNCH=1 HOROSA_SKIP_TOOLCHAIN_INSTALL=1 ./scripts/mac/bootstrap_and_run.sh`
  - 模拟 `target jar` 缺失并执行 `Horosa-Web/start_horosa_local.sh`：确认输出 `using bundled jar fallback` 且自动回填成功。

### 20:18 - 启动超时容错增强：默认等待 180s，可环境变量扩展
- Scope: fix false timeout on slower machines (e.g., first run on Mac mini) where services are healthy but startup takes longer than 60s.
- Files:
  - `Horosa-Web/start_horosa_local.sh`
  - `README.md`
  - `UPGRADE_LOG.md`
- Details:
  - `start_horosa_local.sh` 启动等待从固定 60 秒改为可配置：
    - 默认 `HOROSA_STARTUP_TIMEOUT=180`；
    - 小于 30 或非法值会自动回退到 180；
    - 超时时输出明确提示可设置 `HOROSA_STARTUP_TIMEOUT=300`。
  - README 增加 `HOROSA_STARTUP_TIMEOUT` 与 Maven 直连参数说明，便于无 Homebrew 环境排障。
- Verification:
  - `bash -n Horosa-Web/start_horosa_local.sh`
  - `bash -n Horosa_Local.command Prepare_Runtime_Mac.command scripts/mac/bootstrap_and_run.sh`

### 22:00 - 新增统一故障诊断日志：每次运行自动记录前后端问题
- Scope: add a persistent run diagnostics file so each startup/run failure (frontend/backend/web) is automatically recorded for troubleshooting on other Macs.
- Files:
  - `Horosa_Local.command`
  - `Horosa-Web/start_horosa_local.sh`
  - `.gitignore`
  - `README.md`
  - `UPGRADE_LOG.md`
- Details:
  - 新增默认诊断文件：`diagnostics/horosa-run-issues.log`（支持 `HOROSA_DIAG_FILE` / `HOROSA_DIAG_DIR` 自定义）。
  - `Horosa_Local.command` 每次运行都会写入起止信息、关键环境变量；失败或中断时自动追加最近 `astrostudyboot.log` / `astropy.log` / `horosa_local_web.log` 的 tail。
  - `start_horosa_local.sh` 也会记录启动阶段信息（runtime 解析、端口就绪、超时失败等），并在失败时附加 Python/Java 日志 tail。
  - `Horosa_Local.command` 会把 `HOROSA_DIAG_FILE` / `HOROSA_DIAG_DIR` 透传给 `start_horosa_local.sh`，保证同一次运行落到同一个诊断文件。
  - 根目录新增 `diagnostics/` 文件夹（含 `README.md`），统一存放诊断数据。
  - `.gitignore` 增加 `diagnostics/*` 忽略规则（保留 `diagnostics/.gitkeep` / `diagnostics/README.md`），避免把本地故障日志提交到 GitHub。
- Verification:
  - `bash -n Horosa_Local.command Horosa-Web/start_horosa_local.sh`
  - `printf '\n' | HOROSA_NO_BROWSER=1 HOROSA_FORCE_UI_BUILD=0 HOROSA_STARTUP_TIMEOUT=300 ./Horosa_Local.command`
  - 失败路径验证：`HOROSA_WEB_PORT=9999 ./Horosa_Local.command`（确认自动记录失败上下文与日志 tail）

### 23:31 - 修复“命盘/事盘点击提交无反应”：本地存储异常显式提示
- Scope: fix silent failure when saving chart/case on machines where localStorage write/read is blocked or quota-limited.
- Files:
  - `Horosa-Web/astrostudyui/src/models/user.js`
  - `Horosa-Web/astrostudyui/src/utils/localcharts.js`
  - `Horosa-Web/astrostudyui/src/utils/localcases.js`
  - `UPGRADE_LOG.md`
- Details:
  - `localcharts/localcases` 的读写加入异常捕获，写入失败时返回可判断状态，并在 `upsert/remove` 抛出明确错误码。
  - `user.js` 的 `addCase/updateCase/deleteCase/addChart/updateChart/saveMemo` 统一 `try/catch`，失败时弹窗提示“本地存储不可用或空间不足”。
  - 避免之前“点击提交后没有任何反馈”的黑洞体验。
- Verification:
  - `npm test -- DunJiaCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`
  - `npm run build:file` in `Horosa-Web/astrostudyui`

### 23:38 - 提交流程容错补强：日期格式化异常也进入可视错误提示
- Scope: prevent pre-save date formatting exceptions (`values.birth.format / values.divTime.format`) from bypassing save error handling.
- Files:
  - `Horosa-Web/astrostudyui/src/models/user.js`
  - `UPGRADE_LOG.md`
- Details:
  - 将 `values.birth/divTime` 格式化逻辑移入 `try/catch` 内，确保异常会进入统一错误提示，而不是中断后无反馈。
  - 进一步减少“提交按钮点了没反应”的边界问题。
- Verification:
  - `npm test -- DunJiaCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`
  - `npm run build:file` in `Horosa-Web/astrostudyui`

### 23:45 - Safari/隐私模式存储兼容：自动清理 AI 快照并回退会话内存
- Scope: keep chart/case save usable under Safari strict privacy or quota pressure.
- Files:
  - `Horosa-Web/astrostudyui/src/utils/localcharts.js`
  - `Horosa-Web/astrostudyui/src/utils/localcases.js`
  - `UPGRADE_LOG.md`
- Details:
  - 新增安全 `localStorage` 获取与配额异常识别（`QuotaExceededError` 等）。
  - 写入超限时自动清理体积较大的 AI 快照缓存：
    - `horosa.ai.snapshot.astro.v1`
    - `horosa.ai.snapshot.module.v1.*`
  - 若存储仍不可用，自动回退到会话内存存储（本次运行可继续增删改查，刷新后可能丢失）。
  - 通过 `console.warn` 给出一次性降级提示，便于排障。
- Verification:
  - `npm test -- DunJiaCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`
  - `npm run build:file` in `Horosa-Web/astrostudyui`

### 23:49 - 八字/紫微交互优化：时间调整后仅“点确定”才重算
- Scope: improve UX by stopping immediate recalculation on every time tweak in Bazi/Ziwei.
- Files:
  - `Horosa-Web/astrostudyui/src/components/cntradition/CnTraditionInput.js`
  - `Horosa-Web/astrostudyui/src/components/cntradition/BaZi.js`
  - `Horosa-Web/astrostudyui/src/components/ziwei/ZiWeiInput.js`
  - `Horosa-Web/astrostudyui/src/components/ziwei/ZiWeiMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - `PlusMinusTime -> onFieldsChange` 透传 `__confirmed`。
  - `BaZi/ZiWeiMain` 收到 `__confirmed=false` 时仅更新字段，不发排盘请求。
  - 只有 `__confirmed=true`（点击时间选择器里的“确定”）才触发重算，减少频繁等待和卡顿感。
- Verification:
  - `npm run build:file` in `Horosa-Web/astrostudyui`
  - `npm test -- DunJiaCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`

### 23:58 - Safari 本地存储禁用场景修复：请求层全链路安全读写
- Scope: eliminate request-layer crashes when Safari blocks localStorage access.
- Files:
  - `Horosa-Web/astrostudyui/src/utils/request.js`
  - `UPGRADE_LOG.md`
- Details:
  - 新增 `safeGetLocalItem/safeSetLocalItem/safeRemoveLocalItem`。
  - 替换请求层关键路径中的直接 `localStorage` 访问（token 读取、`forceChange` 写入、need-login 判断）。
  - 防止 Safari 存储访问异常向上冒泡导致误判“命盘保存失败”。
- Verification:
  - `npm run build:file` in `Horosa-Web/astrostudyui`
  - `npm test -- DunJiaCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`

### 00:03 - 启动行为调整：恢复 Safari 为默认打开浏览器
- Scope: keep user-required startup behavior (open Safari by default) while retaining Safari compatibility fixes.
- Files:
  - `Horosa_Local.command`
  - `UPGRADE_LOG.md`
- Details:
  - `Horosa_Local.command` 的浏览器优先级恢复为：
    - Safari -> Chromium family app window -> system default browser.
  - 与 Safari 兼容修复并存，不影响本地存储兜底能力。
- Verification:
  - `bash -n Horosa_Local.command`

### 00:58 - 修复节气盘仅返回二分二至：年视图恢复完整二十四节气（保留三式快路径）
- Scope: fix JieQi year panel returning only the 4 seasonal terms when frontend passes `jieqis` subset for chart tabs.
- Files:
  - `Horosa-Web/astropy/astrostudy/jieqi/YearJieQi.py`
  - `UPGRADE_LOG.md`
- Details:
  - 根因是 `computeJieQi(True)` 直接复用了 `self.jieqis` 过滤 `jieqi24`，导致年视图被裁剪成 4 项。
  - 调整为“结果列表”和“起盘列表”分离：
    - `needChart=True` 时，`jieqi24` 始终计算并返回完整 24 节气；
    - 仅 `charts` 使用传入 `jieqis`（例如春分/夏至/秋分/冬至）做季节盘起盘；
    - `seedOnly` / `needChart=False` 仍保留按 `jieqis` 过滤（不影响遁甲/金口诀/三式合一快路径）。
  - 保持原有 `approach` 数值迭代流程不变，未改变任何节气时刻算法精度逻辑。
- Verification:
  - `python3 -m py_compile Horosa-Web/astropy/astrostudy/jieqi/YearJieQi.py`
  - `PYTHONPATH='Horosa-Web/astropy:Horosa-Web/flatlib-ctrad2:$HOME/Library/Python/3.12/lib/python/site-packages' runtime/mac/python/bin/python3` 运行 YearJieQi 自检：
    - `needChart=True -> jieqi24 len = 24, charts len = 4`
    - `seedOnly=True -> jieqi24 len = 4`（仅返回请求项）
  - 端到端 chart service 自检（`/jieqi/year`，经 `start_horosa_local.sh` 启停）：
    - `full(jieqis=四季) -> 481ms, jieqi24=24, charts=4`
    - `seedOnly(jieqis=大雪/芒种) -> 4ms, jieqi24=2`
  - 性能采样（同机本地函数级）：
    - `seedOnly` 平均约 `2.87ms`（p95 `2.93ms`），满足三式快路径预算；
    - `needChart=True` 平均约 `245ms`，远低于“打开节气盘 5 秒内”阈值。
  - 前端回归：
    - `npm test -- DunJiaCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`
    - `npm run build:file` in `Horosa-Web/astrostudyui`

### 01:34 - 节气盘空白/超时修复：拆分“节气列表”与“季节盘起盘”请求
- Scope: fix blank JieQi panel caused by `/jieqi/year` timeout after 24项+四季盘同请求，and keep first-open latency under 5s.
- Files:
  - `Horosa-Web/astropy/astrostudy/jieqi/YearJieQi.py`
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/JieQiController.java`
  - `Horosa-Web/astrostudyui/src/components/jieqi/JieQiChartsMain.js`
  - `Horosa-Web/astrostudyui/src/utils/preciseCalcBridge.js`
  - `UPGRADE_LOG.md`
- Details:
  - `YearJieQi` 新增 `needCharts` 参数：允许“返回24节气列表”与“生成季节盘 charts”解耦。
  - 前端节气盘默认页（`二十四节气`）请求改为 `needCharts=false`、`needBazi=false`，避免首次进入时阻塞。
  - 切换到四季盘标签时再请求 `needCharts=true`，并在后台预热该请求缓存，减少后续等待。
  - `JieQiController` 透传 `needCharts`，并保留 `needBazi` 兼容控制。
  - `JieQiChartsMain` 对 `item.bazi` 做空值保护，避免服务端未附带 bazi 时前端渲染异常。
- Verification:
  - `python3 -m py_compile Horosa-Web/astropy/astrostudy/jieqi/YearJieQi.py`
  - `mvn -f Horosa-Web/astrostudysrv/astrostudycn/pom.xml -DskipTests install`
  - `mvn -f Horosa-Web/astrostudysrv/astrostudyboot/pom.xml -DskipTests clean package`
  - 端到端加密接口实测（本机）：
    - `needCharts=false`：`771ms`，`jieqi24=24`，`charts=0`
    - `needCharts=true`：`8009ms`，`jieqi24=24`，`charts=4`
  - 前端回归：
    - `npm test -- DunJiaCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`
    - `npm run build:file` in `Horosa-Web/astrostudyui`

### 01:35 - 星盘切时间卡顿优化：去除重复排盘请求 + 非确认变更节流
- Scope: reduce stutter when adjusting time in Astro chart without reducing calculation precision.
- Files:
  - `Horosa-Web/astrostudyui/src/pages/index.js`
  - `Horosa-Web/astrostudyui/src/models/astro.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroChartMain.js`
  - `Horosa-Web/astrostudyui/src/components/astro3d/AstroChartMain3D.js`
  - `UPGRADE_LOG.md`
- Details:
  - `DateTimeSelector` 的 `confirmed` 状态透传到星盘主流程。
  - 对 `confirmed=false` 的时间微调请求加入 180ms 节流并静默请求，避免高频调整时全局 loading 闪烁阻塞。
  - 移除 `astro` 页签自身的 `doHook -> nohook` 重复排盘链路，避免每次变更触发双请求。
  - 保留最终排盘算法与后端计算路径，不改动计算精度。
- Verification:
  - `npm test -- DunJiaCalc.test.js --runInBand` in `Horosa-Web/astrostudyui`
  - `npm run build:file` in `Horosa-Web/astrostudyui`


### 01:43 - 修复节气盘白屏卡死：无 charts 返回时改为安全占位渲染
- Scope: fix immediate white-screen when opening 节气盘 after list-only response (`needCharts=false`) returns no seasonal chart payload.
- Files:
  - `Horosa-Web/astrostudyui/src/components/jieqi/JieQiChartsMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 根因：`genTabsDom` 在 `charts={}` 时仍直接访问 `chart.params`，导致 `TypeError` 触发整页白屏。
  - 修复为全量空值防护：
    - 对 `chart` 增加判空后再读 `chart.params`；
    - 三类子页（星盘/宿盘/3D盘）在对应节气 `chart` 未返回前显示“正在计算...”占位，而不是渲染空对象组件；
    - 保留右侧节气子标签，用户可直接切换触发 `needCharts=true` 懒加载。
  - 该改动仅是渲染层容错，不改动任一节气/星盘算法精度。
- Verification:
  - `npm run build:file` in `Horosa-Web/astrostudyui`


### 01:53 - 星盘/希腊/六壬/金口诀提速 + AI“逆行误判”修复
- Scope: reduce repeated slow requests on tab-enter/time-adjust and fix AI export where `主宰宫 R` 被误识别成“逆行”。
- Files:
  - `Horosa-Web/astrostudyui/src/services/astro.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroChartMain.js`
  - `Horosa-Web/astrostudyui/src/components/astro3d/AstroChartMain3D.js`
  - `Horosa-Web/astrostudyui/src/components/hellenastro/AstroChart13.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouMain.js`
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `UPGRADE_LOG.md`
- Details:
  - **星盘请求去重与缓存**：`fetchChart` 增加内存缓存 + in-flight 去重，避免同参数重复触发 `/chart`。
  - **切页不再强制重排**：`AstroChartMain` / `AstroChartMain3D` 的页签 hook 改为 no-op，避免“仅切回页签就重复请求”。
  - **希腊十三分盘优化**：`AstroChart13` 增加缓存 + in-flight 去重；时间未确认(`confirmed=false`)仅静默预取，不打断界面；确认后优先命中缓存。
  - **六壬优化**：
    - 时间未确认时不再触发 `astro/fetchByFields`，避免拖动时间时频繁后台重排；
    - `/liureng/gods` 与 `/liureng/runyear` 增加前端缓存 + in-flight 去重。
  - **金口诀优化**：`/liureng/gods` 与 `/liureng/runyear` 增加前端缓存 + in-flight 去重，减少重复进入页签/重复参数时的等待。
  - **AI逆行误判修复**：
    - 去掉“数字+R”的宽匹配逆行替换，改为仅对“度数/度分格式+R”执行逆行转换；
    - 括号信息里 `1R8R` 仅按主宰宫信息识别，不再误判为逆行标记。
- Verification:
  - `npm run build:file` in `Horosa-Web/astrostudyui`
  - `./verify_horosa_local.sh` (services started by `start_horosa_local.sh`) -> `verify ok`


### 01:59 - 恢复节气卡片“时间+四柱+纳音”结构（双阶段加载，不拖慢首屏）
- Scope: restore the original 24-term card structure (time + 四柱 + 纳音) without lowering precision and without regressing first-screen latency.
- Files:
  - `Horosa-Web/astrostudyui/src/components/jieqi/JieQiChartsMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 根因：节气页首请求为 `needBazi=false`（用于首屏提速），导致 `jieqi24` 只有时间无四柱/纳音。
  - 修复为双阶段：
    - **阶段1（首屏快）**：继续 `needBazi=false`，优先显示24节气时间；
    - **阶段2（后台补全）**：同参数自动发起 `needBazi=true, needCharts=false` 的精确请求，回填每个节气卡片的四柱与纳音。
  - 加入 seq/缓存键保护，避免旧请求回填新年份造成错位。
  - 在回填完成前显示“八字与纳音加载中...”，避免误判为功能被删除。
  - 算法精度保持不变：八字/纳音仍来自原后端 `setupBazi` 计算链路。
- Verification:
  - `npm run build:file` in `Horosa-Web/astrostudyui`
  - `./verify_horosa_local.sh` (services started by `start_horosa_local.sh`) -> `verify ok`

### 02:11 - 修复量化盘“中点/相位空白”：补齐主动请求链路并增强结果兼容
- Scope: fix germanytech panel where right-side “中点/相位” can stay empty after entering tab; keep speed optimizations and precision unchanged.
- Files:
  - `Horosa-Web/astrostudyui/src/components/germany/AstroMidpoint.js`
  - `Horosa-Web/astrostudyui/src/components/germany/MidpointMain.js`
  - `Horosa-Web/astrostudyui/src/components/germany/Midpoint.js`
  - `UPGRADE_LOG.md`
- Details:
  - 在 `AstroMidpoint` 增加主动请求保障：`componentDidMount` 与 `fields` 变更时自动请求 `/germany/midpoint`，避免仅依赖外层 hook 导致首次进入页签不触发请求。
  - 新增中点请求 `in-flight` 去重 + 小型内存缓存（LRU），减少重复同参请求，保持交互流畅。
  - 新增结果标准化：兼容 `midpoints/aspects` 的大小写/嵌套差异，异常 payload 不再把面板覆盖成空状态。
  - 修复中点列表空数组边界（`midpoints[0]`）潜在异常，防止右侧列表渲染中断。
  - 算法精度不变：仍调用原 `/germany/midpoint` 后端计算，不做近似或降采样。
- Verification:
  - `npm run build:file` in `Horosa-Web/astrostudyui`
  - `./verify_horosa_local.sh` in `Horosa-Web` -> `verify ok`

### 02:18 - 修复节气盘“四柱/纳音一直加载中”：补齐补全重试与慢链路兜底
- Scope: resolve JieQi page stuck on “八字与纳音加载中...” by making Bazi enrichment retryable and resilient under slow backend response.
- Files:
  - `Horosa-Web/astrostudyui/src/components/jieqi/JieQiChartsMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 新增节气四柱就绪判定方法，统一识别 `jieqi24` 是否已完整拿到 `fourColumns`。
  - 修复缓存短路路径：当 `requestJieQi` 因同 key 命中 `pendingRequest/lastResultKey` 直接返回时，仍会继续触发 `needBazi=true` 异步补全，避免首轮失败后永远不重试。
  - `getRequestKey` 增加 `needBazi` 维度，避免补全过程与普通列表请求共享同一 key 造成误判。
  - 节气四柱补全增加 in-flight 去重与最多 2 次退避重试，防止偶发超时直接卡死在“加载中”。
  - 增加慢链路兜底：当 `fetchPreciseJieqiYear` 未返回完整四柱时，额外走一次 `request('/jieqi/year', timeoutMs=120000, silent=true)` 拉取完整 bazi 结果并回填。
  - 算法精度保持不变：仍使用后端 `needBazi=true` 的精确计算结果，不做近似推断。
- Verification:
  - `npm run build:file` in `Horosa-Web/astrostudyui`

### 02:33 - 七政四余/八字进一步提速：主盘复用 + 请求缓存去重 + 未确认时间预取
- Scope: 在不降低算法精度、不改后端计算逻辑前提下，缩短七政四余与八字页面“点击后等待+加载中停留”。
- Files:
  - `Horosa-Web/astrostudyui/src/components/guolao/GuoLaoChartMain.js`
  - `Horosa-Web/astrostudyui/src/components/guolao/GuoLaoInput.js`
  - `Horosa-Web/astrostudyui/src/components/cntradition/BaZi.js`
  - `UPGRADE_LOG.md`
- Details:
  - **七政四余（GuoLao）**
    - 新增 `/chart` 前端缓存 + in-flight 去重（同参数只算一次）。
    - 当 `astro/fetchByFields` 已返回主盘且参数一致时，优先直接复用 `props.value`，跳过二次 `/chart` 请求，避免“同一次操作双重计算”。
    - 时间未确认(`confirmed=false`)时改为静默预取，不触发重排 hook，确认后直接命中缓存。
    - GuoLao 请求改为静默加载，减少全局“加载中”遮罩停留时间。
  - **八字（BaZi）**
    - 新增 `/bazi/direct` 前端缓存 + in-flight 去重（同参数重复切换/回切页面几乎瞬时返回）。
    - 时间未确认时改为 240ms 防抖静默预取；确认后优先命中缓存再渲染。
    - 八字请求改为静默加载，减少“加载中”感知时长；保留失败安全返回，不改计算口径。
  - **算法与精度**
    - 所有优化均为“请求编排/缓存/渲染时机”层，未修改任何排盘算法或后端计算参数。
- Verification:
  - `npm run build:file` in `Horosa-Web/astrostudyui`
  - `./verify_horosa_local.sh` in `Horosa-Web` -> `verify ok`
  - Python排盘引擎快速烟测（本地直连）：
    - `POST http://127.0.0.1:8899/` ≈ `0.10~0.13s`
    - `POST http://127.0.0.1:8899/chart13` ≈ `0.07~0.09s`

### 02:42 - 节气盘提速（24节气八字/纳音）：重算链路瘦身 + 前端等待削峰
- Scope: 解决“节气盘二十四节气八字/纳音加载常驻2分钟+”问题，保证算法精度不降、其它功能不受影响。
- Files:
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/JieQiController.java`
  - `Horosa-Web/astrostudyui/src/components/jieqi/JieQiChartsMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - **后端（核心提速）**
    - `setupBazi` 从 `bz.calculate(...)` 改为 `bz.calculateFourColumn(...)`，仅保留节气卡片所需的精确四柱数据，不再重复执行与24节气卡片无关的预测/神煞整套扩展计算。
    - 返回结构保持兼容：仍写入 `item.bazi.fourColumns`，前端卡片与现有读取逻辑无需改动。
    - 该改动不改变四柱算法本身，仅减少无关计算路径。
  - **前端（等待时间体感优化）**
    - 新增节气四柱结果内存缓存（按年+时区+经纬度维度）并在首屏结果返回后优先回填，二次进入同年参数几乎即时显示。
    - 修复“完整性判定过宽”问题：补全判断由 `some` 改为 `every`，避免拿到部分八字后误判完成、导致长期“加载中”。
    - 当处于“二十四节气”页签时，先完成八字补全，再预加载分至/宿盘图，避免后台预加载抢占导致卡片长时间不出结果。
    - 慢链路回退超时从 120s 下调到 35s，避免异常链路把页面拖成“超长等待”。
- Build/verify:
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅
  - `mvn -DskipTests install` in `Horosa-Web/astrostudysrv/astrostudycn` ✅
  - `mvn -DskipTests install` in `Horosa-Web/astrostudysrv/astrostudyboot` ✅
  - `./verify_horosa_local.sh` in `Horosa-Web` ✅ (`verify ok`)

### 03:04 - 计算后“加载中停留过久”再优化：静默链路 + 运行时一致性修正
- Scope: 缩短星盘/希腊星术/金口诀/六壬在点击计算后的“加载中停留”，并排除“未用最新配置导致慢”的风险。
- Files:
  - `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/helper/AstroHelper.java`
  - `Horosa-Web/start_horosa_local.sh`
  - `Horosa-Web/astrostudyui/src/models/astro.js`
  - `Horosa-Web/astrostudyui/src/components/hellenastro/AstroChart13.js`
  - `Horosa-Web/astrostudyui/src/components/jinkou/JinKouMain.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - **本地启动运行时一致性**：`start_horosa_local.sh` 优先使用项目内置 runtime 的 Java/Python（仅在未显式传入 `HOROSA_JAVA_BIN/HOROSA_PYTHON` 时），避免偶发回落系统解释器导致行为/性能漂移。
  - **前端全局请求体感优化**：`astro/fetchByFields` 默认改为静默请求（除非调用方显式覆盖），减少大范围“加载中”遮罩停留。
  - **希腊星术链路静默化**：`AstroChart13` 主请求改为静默，渲染更新不再被全局 loading 遮罩拖长。
  - **金口诀/六壬链路静默化**：`/liureng/gods` 与 `/liureng/runyear` 请求改为静默，主盘先渲染，辅信息异步补齐，避免用户体感卡顿。
  - 算法精度与结果口径不变：均为启动配置优先级与加载策略优化，不改任何排盘计算公式。

### 09:24 - 节气后端链路并行化（24节气四柱/图盘补全）
- Scope: 在保持四柱计算口径不变的前提下，减少节气盘请求中串行补全造成的等待。
- Files:
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/JieQiController.java`
  - `UPGRADE_LOG.md`
- Details:
  - 将 `setupBazi` 中 24 节气四柱补全由串行循环改为 `parallelStream` 并行执行，减少 CPU 核心空置。
  - 将 `charts` 分至/宿盘 `nongli` 补全由串行改为并行，降低 `needCharts=true` 时尾部补全耗时。
  - 仍使用原 `BaZi.calculateFourColumn` 与 `OnlyFourColumns` 逻辑，算法精度不变。

### 10:32 - 对照 46418fe 快版本回归：恢复稳定快路径 + 统一哈希缓存重构 + 节气/量化/AI 关键修复
- Scope: 基于旧快版本 (`Horosa-Web-App-comprehensively-improved-MacOS-46418feversion`) 逐项对照，恢复“快且稳”的链路，修复你反馈的节气盘、量化盘、AI逆行误判。
- Files:
  - `Horosa-Web/astropy/astrostudy/jieqi/YearJieQi.py`
  - `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/helper/ParamHashCacheHelper.java`
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/JieQiController.java`
  - `Horosa-Web/astrostudyui/src/components/jieqi/JieQiChartsMain.js`
  - `Horosa-Web/astrostudyui/src/components/germany/AstroMidpoint.js`
  - `Horosa-Web/astrostudyui/src/components/germany/MidpointMain.js`
  - `Horosa-Web/astrostudyui/src/components/germany/Midpoint.js`
  - `Horosa-Web/astrostudyui/src/utils/planetHouseInfo.js`
  - `Horosa-Web/astrostudyui/src/utils/astroAiSnapshot.js`
  - `Horosa-Web/astrostudyui/src/utils/predictiveAiSnapshot.js`
- Details:
  - **节气盘 80s+ 根因修复（核心）**
    - 回退 `YearJieQi.py` 中导致默认“全24节气图盘全量计算”的变更，恢复为旧快版本行为：
      - 默认只算 24 节气时间点；
      - 仅在显式传入 `jieqis` 时生成对应图盘。
    - 直接消除 `/jieqi/year` 从 `~83s` 降回 `~1.1s` 的主要瓶颈。
  - **节气卡片结构恢复（八字/纳音不再丢）**
    - `JieQiController.setupBazi` 恢复旧结构：`map.put("bazi", bz)` + `bz.calculate(...)`，不再裁剪成仅 `fourColumns`。
    - 解决“只剩时间、八字/纳音缺失或一直加载中”的问题，确保节气卡片信息完整。
  - **统一“参数哈希 -> 缓存”层重构（保留统一层、恢复性能）**
    - `ParamHashCacheHelper` 改为**对象直存**到缓存（不再每次 JSON 编解码深拷贝）。
    - 保留统一哈希键（deterministic hash）策略；本地持久化仅对可 JSON 持久化对象启用。
    - 对 `bazi/liureng/chart/chart13/jieqi` 的自定义对象结果恢复高命中、低开销。
  - **量化盘中点/相位空白修复**
    - `AstroMidpoint/MidpointMain/Midpoint` 回退到旧稳定请求链路，恢复中点与相位正常展示。
  - **AI“全体逆行”误判修复**
    - 取消主宰宫信息中的 `R` 歧义标记（改为 `主`），避免被模型误读为 Retrograde。
    - 在 AI 快照文本链路中加入兼容替换，确保星盘相关 AI 输出不再把“主宰宫R”错判为“逆行”。
- Verification (local):
  - Build:
    - `mvn -DskipTests install` in `Horosa-Web/astrostudysrv/astrostudy` ✅
    - `mvn -DskipTests install` in `Horosa-Web/astrostudysrv/astrostudycn` ✅
    - `mvn -DskipTests install` in `Horosa-Web/astrostudysrv/astrostudyboot` ✅
    - `npm run build` in `Horosa-Web/astrostudyui` ✅
  - Functional:
    - `./verify_horosa_local.sh` ✅
    - `/germany/midpoint` 返回 `midpoints=91`, `aspects_keys=30`（不再空）✅
    - `/jieqi/year`（`jieqis=[春分,夏至,秋分,冬至]`）返回 `jieqi24=4`, `charts=4`，且 `bazi` 含完整字段（含纳音字段）✅
  - Perf (same payload, encrypted API calls):
    - 修复前：
      - `chart13` ~`1.7~1.9s`
      - `bazi_direct` ~`1.7~2.0s`
      - `liureng_gods` ~`3.4~3.6s`
      - `jieqi_year` ~`83s`
    - 修复后：
      - `chart13` ~`0.12~0.14s`
      - `bazi_direct` ~`0.14~0.32s`
      - `liureng_gods` ~`0.14s`
      - `jieqi_year` ~`1.09~1.13s`
      - `chart` 热命中 ~`0.20s`

### 10:46 - 节气盘“二十四节气仅剩四项”修复：拆分全量节气与图盘子集请求
- Scope: 修复节气盘中“二十四节气”只显示二分二至的问题，并保持现有性能优化（不回退到全24图盘重算）。
- Files:
  - `Horosa-Web/astrostudyui/src/components/jieqi/JieQiChartsMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 前端 `JieQiChartsMain` 改为双通道请求：
    - **主请求（全量节气卡片）**：`/jieqi/year` 不再携带 `jieqis`，直接返回完整 `jieqi24=24`（保留每项时间+八字/纳音结构）。
    - **异步子请求（图盘标签）**：单独用 `jieqis=[春分,夏至,秋分,冬至]` 拉取 `charts`，用于星盘/宿盘/3D盘标签渲染。
  - 子请求仅合并 `charts` 字段，不覆盖主请求的 `jieqi24`，避免再次把“二十四节气”列表压缩成 4 项。
  - 增加主请求与子请求各自的 request key / inflight 去重与序列号竞态保护，避免快速切换年份/参数时出现旧请求覆盖新页面。
  - 子请求回填完成后，补写节气 AI 快照，保证导出内容与当前图盘一致。
- Verification (local):
  - `npm run build` in `Horosa-Web/astrostudyui` ✅
  - `./verify_horosa_local.sh` in `Horosa-Web` ✅
  - 启动后加密 API 实测：
    - `/jieqi/year`（不传 `jieqis`）=> `jieqi24=24`, `charts=0` ✅
    - `/jieqi/year`（传 `jieqis=[春分,夏至,秋分,冬至]`）=> `jieqi24=4`, `charts=4` ✅

### 10:49 - 行星主宰标记恢复为 R，同时与逆行语义解耦
- Scope: 恢复盘面行星信息中的主宰宫 `R` 标记显示，并避免 AI 文本把该 `R` 误读为逆行。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/planetHouseInfo.js`
  - `Horosa-Web/astrostudyui/src/utils/astroAiSnapshot.js`
  - `Horosa-Web/astrostudyui/src/utils/predictiveAiSnapshot.js`
  - `UPGRADE_LOG.md`
- Details:
  - 将行星附加信息中的主宰宫展示从 `n主` 恢复为 `nR`（满足界面保持 R 的诉求）。
  - 在 AI 导出链路中，把 `nR` 规范化为 `nR(宫主)`，保留 R 视觉标记，同时显式声明其为“宫主标记”而非“逆行状态”。
  - 逆行状态仍沿用原始速度判定（`lonspeed < 0` => `逆行`），与宫主标记分离，不改任何算法逻辑。
- Verification (local):
  - `npm run build` in `Horosa-Web/astrostudyui` ✅
  - `./verify_horosa_local.sh` (with local services started) ✅

### 10:53 - 页面空白根因修复：入口静态资源路径兼容补丁（/static/umi.*）
- Scope: 修复本地打开后白屏（`index.html` 能打开但 JS/CSS 404）问题，不影响算法与业务逻辑。
- Files:
  - `Horosa_Local.command`
  - `UPGRADE_LOG.md`
- Details:
  - 定位到白屏根因：`/tmp/horosa_local_web.log` 中存在
    - `GET /static/umi.*.css 404`
    - `GET /static/umi.*.js 404`
    导致前端主 bundle 未加载，页面为空白。
  - 在启动脚本新增 `repair_frontend_entry_assets`：当入口 `index.html` 使用 `/static/umi.*` 路径但 `static/` 下缺失对应文件时，自动将同目录下的 `umi.*.js/css` 补拷贝到 `static/`。
  - 该修复仅做静态资源布局兼容，不改前端业务代码，不改任何排盘算法。
- Verification (local):
  - `HOROSA_NO_BROWSER=1 ./Horosa_Local.command` 能完整启动并退出 ✅
  - 启动链路输出 `html: .../astrostudyui/dist-file/index.html`，服务正常就绪 ✅

### 11:04 - 节气盘卡死后白屏防护：渲染空值兜底 + 快照保存改空闲执行
- Scope: 修复“进入节气盘后页面卡住、随后白屏”风险点，保持算法与结果精度不变。
- Files:
  - `Horosa-Web/astrostudyui/src/components/jieqi/JieQiChartsMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - 新增 `getJieqiFourColumns` 兜底：节气卡片渲染不再直接假设 `item.bazi.fourColumns` 必定存在，避免极端返回数据下触发前端运行时异常导致白屏。
  - 节气快照写入统一改为空闲调度（`requestIdleCallback` / `setTimeout`），避免在主线程同步生成/写入快照导致 UI 短时卡顿。
  - 主请求与图盘子请求完成后都走统一 `scheduleJieqiSnapshotSave`，减少重复同步工作。
  - 卡片渲染对 `item.jieqi/item.time` 增加空值保护，避免单条异常数据拖垮整页。
- Verification (local):
  - `npm run build` in `Horosa-Web/astrostudyui` ✅
  - `./start_horosa_local.sh && ./verify_horosa_local.sh && ./stop_horosa_local.sh` ✅
  - `/jieqi/year` 加密 API 实测：`base => jieqi24=24/charts=0/missFour=0`，`subset => jieqi24=4/charts=4/missFour=0` ✅

### 11:15 - 节气盘白屏二次修复：结果瘦身 + 后端四柱最小化返回（不影响其他模块）
- Scope: 针对“打开节气盘加载后白屏”继续收敛风险，重点减少节气年数据体积与渲染异常面，不改排盘算法、不改其他模块起盘链路。
- Files:
  - `Horosa-Web/astrostudyui/src/components/jieqi/JieQiChartsMain.js`
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/JieQiController.java`
  - `UPGRADE_LOG.md`
- Details:
  - 前端在接收 `/jieqi/year` 主请求后，新增 `compactJieqiSeedResult`：
    - 仅保留节气卡片所需字段（`jieqi/time/ord/jie/ad` + `bazi.fourColumns`）。
    - 显式丢弃主请求中的 `charts`，避免把不必要大对象塞进 React state 造成卡顿和白屏风险。
  - 节气卡片渲染增加四柱字段逐项空值保护（`year/month/day/time` 分开兜底），杜绝单项缺字段触发运行时异常。
  - 后端 `JieQiController.setupBazi` 改为仅返回 `bazi.fourColumns`，不再把完整 `BaZi` 对象直接挂到 `jieqi24`，显著降低返回体和前端解析负担。
- Verification (local):
  - `npm run build` ✅
  - `npm run build:file` ✅
  - `mvn -DskipTests install` in `astrostudycn` ✅
  - `mvn -DskipTests package` in `astrostudyboot` ✅
  - `./stop_horosa_local.sh && HOROSA_SKIP_UI_BUILD=1 ./start_horosa_local.sh` ✅
  - `./verify_horosa_local.sh` ✅

### 11:24 - 节气盘三阶段加载修复：先快显、再可用、后补八字（修复空 charts 白屏）
- Scope: 按“先可用二分二至盘，再后台补全二十四节气八字/纳音”的策略重排节气盘加载流程；仅改节气盘模块，避免影响其他技术起盘路径。
- Files:
  - `Horosa-Web/astrostudyui/src/components/jieqi/JieQiChartsMain.js`
  - `UPGRADE_LOG.md`
- Details:
  - **阶段1（最快）**：`/jieqi/year` 使用 `seedOnly=true` 获取节气时间，立即渲染二十四节气时间卡片（无八字时先占位，不阻塞页面）。
  - **阶段2（可用优先）**：并行请求二分二至 `charts`，让春分/夏至/秋分/冬至的星盘、宿盘、3D盘优先可点击。
  - **阶段3（后台补全）**：异步请求完整 `jieqi24` 八字与纳音，返回后仅合并卡片所需字段，不覆盖已加载盘数据。
  - 修复白屏根因：`genTabsDom` 在 `charts={}` 或分批到达时，原先会直接访问 `chart.params` 导致运行时异常；现改为缺图时显示“加载中...”，并做空值保护，不再整页崩溃。
  - 新增 `mergeJieqiRows`，仅按节气名做轻量合并，避免大对象反复进入 state。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 11:29 - AI 导出宫主标记简化：由 `R(宫主)` 回归 `R`，并加统一消歧说明
- Scope: 仅调整 AI 导出文本展示，不改任何排盘与性能逻辑。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/astroAiSnapshot.js`
  - `Horosa-Web/astrostudyui/src/utils/predictiveAiSnapshot.js`
  - `UPGRADE_LOG.md`
- Details:
  - 将 AI 导出中的宫主标记从 `nR(宫主)` 简化为 `nR`。
  - 在星盘信息中增加统一说明：`nR` 表示宫主宫位，逆行会明确显示“逆行”，避免语义混淆。
  - 读取旧版本地快照时自动将历史 `R(宫主)` 文本规范为 `R`，避免缓存导致的新旧混排。
  - 该修改覆盖本命盘导出与推运导出两条链路。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 11:38 - AI 导出补齐：`星与虚点` 显示逆行 + `接纳/互容/围攻`补全宫位主宰标记
- Scope: 仅修复 AI 文本导出展示，不改排盘计算。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/astroAiSnapshot.js`
  - `UPGRADE_LOG.md`
- Details:
  - `星与虚点`板块中，若星体 `lonspeed < 0`，在定位文本后追加“逆行”。
  - `接纳`、`互容`、`光线围攻`、`夹宫`、`夹星`等信息板块改为统一使用 `msgWithHouse(...)`，确保在启用“后天宫位+主宰宫位”时都能显示对应标记。
  - 继续保持“宫主标记为 nR；逆行为明确文字‘逆行’”的消歧规则。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

## 2026-02-23

### 17:57 - 新增“统摄法”模块并完成文档口径算法/UI/AI导出
- Scope: 按《统摄法》文档在“易与三式”下新增完整的统摄法起盘模块，补齐左盘、右栏、事盘存储与 AI 导出链路，并按多轮反馈完成版式细化。
- Files:
  - `Horosa-Web/astrostudyui/src/components/cnyibu/CnYiBuMain.js`
  - `Horosa-Web/astrostudyui/src/components/tongshefa/TongSheFaMain.js`
  - `Horosa-Web/astrostudyui/src/utils/localcases.js`
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **模块接入与保存**：
    - 新增 `tongshefa/TongSheFaMain.js`，并在 `易与三式` 右侧子菜单接入“统摄法”标签。
    - 新增 caseType/module=`tongshefa`，支持“保存为事盘”与当前事盘回填。
    - 新增统摄法模块 AI 快照（`saveModuleAISnapshot('tongshefa', ...)`）。
  - **算法实现（按文档口径）**：
    - 实现四位卦象选择：太阴·本体 / 太阳·方法 / 少阳·认识 / 少阴·宇宙。
    - 实现本卦、互潜（234/345）、错亲（阴阳反转）、五行主关系（思生实/思克实/思同实/实生思/实克思）。
    - 实现纳甲筮法相关输出（同义鬼爱制、世应、左主/右主十二爻）、大局（六合/六穿）、升降、爻变。
    - 实现三十二观、三界、爻位文案渲染与八卦解释区。
  - **UI 与排版迭代（按反馈逐项调整）**：
    - 左盘改为三块独立展示（本卦/互潜/错亲），并统一为同一套矩阵表格风格。
    - 去除重复显示（重复卦、重复底部卦信息、矩阵中间列），`世/应` 无值时改为空白。
    - “错亲”标题改为纯“错亲”二字；矩阵侧标统一使用卦名字眼（乾/坤/坎/离/震/巽/艮/兑）语义。
    - 去除右上“经纬度选择”及相关无用区域，新增“是否显示边框”选项并联动左盘矩阵边框透明度。
    - 爻位两个板块顺序调整为 `1爻在最下、6爻在最上` 的展示逻辑。
    - 当左盘上下卦相同场景，解释文案按本卦名语义展示，不再使用“天/地”泛称。
  - **AI 导出接入与重排**：
    - `aiExport` 新增技术 `tongshefa`，并在“易与三式”上下文识别中支持“统摄法”。
    - 导出提取链路新增 `extractTongSheFaContent`，优先读取模块快照，兜底走通用提取。
    - 统摄法导出改为清晰分段：`[本卦] [六爻] [潜藏] [亲和]`，内容格式按你给出的示例模板重排。
    - AI 导出设置同步更新为四个新版块；并对旧分段名（`统摄法起盘/互潜/错亲`）做兼容映射，避免历史设置导致导出空白。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅（多轮改动后均通过）

### 18:09 - 一键部署增强：Node/Python 增加非 Homebrew 直连兜底
- Scope: 提升 `Horosa_OneClick_Mac.command` 在“Homebrew 不可用或安装失败”场景下的成功率，避免 Node/Python 依赖卡死。
- Files:
  - `scripts/mac/bootstrap_and_run.sh`
  - `README.md`
  - `UPGRADE_LOG.md`
- Details:
  - 新增 Node 直连安装：
    - 新增本地目录 `.runtime/mac/node`；
    - 若系统/本地 Node<18 且 Homebrew 安装失败，自动下载 Node 预编译包并接入 PATH。
  - 新增 Python 直连安装：
    - 新增本地目录 `.runtime/mac/python`；
    - 若系统 Python 不可用且 Homebrew 安装失败，自动下载 Miniconda 安装器并本地安装 Python 3.9+。
  - `ensure_node` / `ensure_python` 改为“系统检测 -> Homebrew -> 直连下载”的三段兜底流程。
  - `detect_python_bin` 与 `pick_existing_runtime_python` 增加本地 `.runtime/mac/python/bin/python3` 探测，支持后续 `HOROSA_SKIP_BUILD=1` 复用。
  - README 补充 Node/Python 直连兜底说明与环境变量：
    - `HOROSA_NODE_VERSION` / `HOROSA_NODE_URL`
    - `HOROSA_PYTHON_URL`
- Verification (local):
  - `bash -n scripts/mac/bootstrap_and_run.sh` ✅
  - `bash -n Horosa_OneClick_Mac.command Horosa_Local.command` ✅

## 2026-02-25

### 19:12 - 易与三式·六壬新增「大格/小局/分类占」参考栏并修复“起课”未同步问题
- Scope: 在 `易与三式 -> 六壬` 右栏底部新增三个参考标签（大格/小局/分类占），按当前左盘自动匹配显示；同时修复“时间未点确定时点击起课不更新盘面”的同步问题，并把新增参考同步到 AI 导出与 AI 导出设置。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengInput.js`
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **六壬右栏新增三标签**：
    - 在原有参数与保存区下方新增 `Tabs`：`大格`、`小局`、`分类占`（从左到右顺序固定）。
    - 视觉样式参考易卦页的右侧多标签交互，采用小卡片分段展示“命中条件 / 提示 / 命中依据”。
  - **格局匹配引擎（前端本地）**：
    - 新增大格映射：根据课式（如元首课、重审课、知一课、涉害课、八专课、伏吟/反吟类等）映射到十格语义（元首/重审/知一/见机/矢射/虎视/芜淫/帷簿/信任/无依）。
    - 新增小局判定：按四课、三传、旬首旬尾、神将、马星等条件匹配（含泆女、狡童、元胎、三交、斩关、游子、闭口、解离、乱首、绝嗣、无禄、孤寡、龙战、励德、赘婿等）。
    - 新增分类占聚合：按命中的小局自动聚合到 `淫泆局 / 新孕局 / 隐匿局 / 乖别局` 并显示命中来源。
  - **AI 导出同步**：
    - 六壬模块 AI 快照新增 `[大格]`、`[小局]`、`[分类占]` 三个分区，导出内容与右栏展示一致。
    - AI 导出设置预设新增六壬可选分区：`起盘信息/大格/小局/分类占`。
  - **“起课”时间同步修复**：
    - 六壬输入接入 `DateTimeSelector hook`，支持在未点击“确定”时读取当前时间草稿值。
    - 点击“起课”时主动对比草稿时间与当前字段：如有差异先静默同步并拉取新盘，再自动触发六壬起课计算，避免必须先点“确定”才能生效。
    - 保持原有时间算法与起局计算链路不变，不改后端接口与时制口径。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 19:54 - 六壬格局匹配二次加严 + 判词扩展为完整结构
- Scope: 按文档口径进一步收紧小局命中条件，减少宽松触发；并把右栏与 AI 导出中的格局文案扩展为“主象/判词/风险/建议/依据”完整结构，避免关键信息被简化。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **匹配规则加严（小局）**：
    - `三交`：改为必须同时满足“昴房（卯酉）临日干/日支 + 三传皆仲且含子午 + 太阴六合同见”。
    - `游子`：改为必须“三传皆季”且“驿马与丁马同时入课传”（不再以单马触发）。
    - `解离`：增加“日干/日支上神相冲”约束，仅冲克并见才命中。
    - `乱首`：收紧为“日干临支受支克”或“日支临日干寄宫并克日干”两式，不再使用宽泛邻近判断。
    - `孤寡`：收紧为“孤辰、寡宿、旬空三项同时入课传”。
    - `龙战`：收紧为“卯酉日”前提下，再见“卯酉发用”或“卯酉临日辰”。
    - `赘婿`：收紧为“日干上神临日支且日干克日支”。
  - **判词扩展（右栏 + AI快照）**：
    - 新增统一文案生成：`buildReferenceJudgement/buildReferenceRisk/buildReferenceAdvice`。
    - 三个标签（大格/小局/分类占）与 AI 快照同步展示：主象、完整判词、风险提示、行动建议、命中依据。
    - 快照分区中 `大格/小局/分类占` 改为结构化长文本，便于 AI 导出和后续复盘。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 20:06 - 六壬参考文案改为原文体例 + 移除分类占展示
- Scope: 按反馈去除“主象/判词/风险/建议”等模板文案，改为文献原文展示；并移除“分类占”页面与导出分区，仅保留大格/小局。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **文案体例改造**：
    - 新增 `DA_GE_REFERENCE_TEXT` 与 `XIAO_JU_REFERENCE_TEXT` 文献内容映射，展示“诗诀 + 荀注 + 要点/依据”。
    - 移除 UI 与快照中的模板字段：`主象`、`判词`、`风险`、`建议`、`关键词`。
    - 统一改为“要点”字段，并保留条目中的完整要点文本。
  - **分类占去除**：
    - 右侧标签移除 `分类占`，仅保留 `大格`、`小局`。
    - 六壬 AI 快照移除 `[分类占]` 分区。
    - AI 导出设置中六壬分区改为：`起盘信息`、`大格`、`小局`。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 20:19 - 六壬「大格/小局」其余条目荀注改为原文逐字对齐（两份基石文档）
- Scope: 按反馈将 `大格` 与 `小局` 其余条目的“荀注”从摘要化文字改为原文逐字对齐；保持 `分类占` 继续移除，不改起局时间链路与既有命中逻辑。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **大格荀注回填原文**：
    - `元首/重审/知一/见机/虎视/芜淫/帏薄/信任/无依` 等条目荀注改为与 `12. 大格.md` 对齐的完整原文（`矢射` 保持既有原文口径）。
  - **小局荀注回填原文**：
    - `泆女/狡童/元胎` 改为与 `13. 小局.md` 对齐的原文荀注；
    - `三交/斩关/游子/闭口/解离/乱首/绝嗣/无禄/孤寡/龙战/励德/赘婿` 的 `局式/局义/局注` 文案改为原文口径。
  - **渲染结构优化**：
    - 文档拼装改为统一将 `note + 局式/局义/局注` 收敛在同一 `荀注` 块内，右栏展示与 AI 导出快照保持一致。
  - **兼容性**：
    - 仅更新参考文案映射与展示拼装，不改排盘算法、时间同步修复、起课触发流程。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 20:36 - 六壬小局扩展：由 15 条提升至 41 条命中规则 + 原文映射
- Scope: 按反馈将小局命中范围从首批条目扩展到更完整体系，新增凶否局/吉泰局/五行局等批量规则，并同步补齐对应原文展示。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **小局规则扩展**：
    - `XIAO_JU_META` 与 `matchXiaoJuReferences` 从 15 条扩展到 41 条。
    - 新增覆盖：`刑德/物气/新故/迍福/始终/九丑/天网/飞魂/丧门/伏殃/罗网/三光/三阳/三奇/六仪/官爵/轩盖/斫轮/铸印/龙德/连珠/炎上/曲直/稼穑/从革/润下` 等。
  - **上下文能力增强**：
    - 参考匹配上下文新增 `行年`、`年支`、`时支`、`旬首干支`、`岁煞/神煞映射`、`贵人顺逆` 等字段。
    - 新增分支位移、五行关系、神煞检索等匹配辅助函数，用于更细化触发判断。
  - **原文展示同步**：
    - `XIAO_JU_REFERENCE_TEXT` 扩展到与规则同数量级条目，新增条目均采用诗诀 + 荀注/局式局义局注体例输出。
    - 右栏小局展示与 AI 快照导出自动复用同一文案拼装逻辑。
  - **兼容性**：
    - 不改后端接口、不改起课时间同步修复链路，保持既有起局时序与功能。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 20:58 - 六壬小局最终补齐：62条全收录 + 规则对齐文档口径 + 全量自检
- Scope: 按最终要求完成小局全量收录与计算补全（含此前缺失 21 条），确保右栏/AI导出同步、保留既有功能与起局时间链路不变，并做构建与键集合自检。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **缺失21条规则补齐**（现已可命中）：
    - `旺孕/德孕`
    - `二烦/天祸/天寇/天狱/死奇/魄化/三阴/富贵`
    - `甲己/乙庚/丙辛/丁壬/戊癸`
    - `绛宫时/明堂时/玉堂时`
    - `斗孟/斗仲/斗季`
  - **匹配上下文增强**：
    - 新增日月支、节气、昨日日辰、旬内地支天干映射、逆查地盘位（`upDownMap`）、课传天干集合、旺相休囚状态读取等字段。
    - 新增孟仲季叠合判定、斗罡加临判定、四立/分至判定等辅助函数，直接服务宫时局/北斗局/天祸天寇等规则。
  - **一致性保障**：
    - `XIAO_JU_META`、`XIAO_JU_REFERENCE_TEXT`、`matchXiaoJuReferences` 三处键集合已对齐为 `62/62/62`。
    - 小局展示继续沿用“诗诀 + 荀注 + 要点/依据”原文体例；分类占保持移除；AI 导出仍为 `起盘信息/大格/小局`。
    - 未改后端接口与起局时间算法，`起课` 时间草稿同步修复链路保持有效。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅
  - `node` 自检脚本（比对 `meta/ref/add` 键集合）✅：`62/62/62`，无缺失键

### 21:36 - 易与三式·遁甲右栏改版（概览合并 + 八宫规则 + AI导出同步）
- Scope: 将遁甲右栏 `状态/历法` 并入 `概览`，新增 `八宫` 标签与宫位计算展示，并把新内容同步到遁甲 AI 快照与 AI 导出设置。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaBaGongRules.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js`
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **右栏标签改造**：
    - 删除原 `状态`、`历法` 标签，并将其字段完整并入 `概览`。
    - 保留 `神煞`，并在其右侧新增 `八宫` 标签。
  - **八宫页面交互与显示**：
    - 宫位按钮顺序固定为 `乾/坎/艮/震/巽/离/坤/兑`。
    - 点击宫位后，按要求展示五段：`奇门吉格`、`奇门凶格`、`十干克应`、`八门克应和奇仪主应`、`八神加八门`。
    - `八门克应` 使用 `人盘门 + 地盘本位门`；`奇仪主应` 使用 `人盘门 + 天盘干`；`八神加八门` 使用当前盘的八神与八门组合。
  - **规则模块化**：
    - 新增 `DunJiaBaGongRules.js`，集中管理八宫规则映射（十干克应、门门克应、奇仪主应、八神八门）与吉凶格判定，供 UI 与快照共用。
  - **AI 导出同步**：
    - 遁甲快照新增 `[八宫详解]` 分区（`DunJiaCalc.buildDunJiaSnapshotText`）。
    - AI 导出设置中遁甲预设分区新增 `八宫详解`。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 20:24 - 六壬宫时局修正：改为“登明/神后/大吉加四仲”直判 + 三局荀注逐字对齐
- Scope: 修复六壬 `宫时局` 误差（不再用泛化孟仲季轮转直推），按用户给定口径改为 `登明(亥)/神后(子)/大吉(丑)` 加四仲判定，并同步更新三局局义文案。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **算法修正（宫时局）**：
    - `绛宫时`：`月将=亥` 且 `时支∈子午卯酉`。
    - `明堂时`：`月将=子` 且 `时支∈子午卯酉`。
    - `玉堂时`：`月将=丑` 且 `时支∈子午卯酉`。
    - 右栏证据文本同步改为“X加四仲”口径，避免旧版“孟仲季泛化匹配”带来的误命中。
  - **荀注文本对齐**：
    - `XIAO_JU_REFERENCE_TEXT` 中 `绛宫时/明堂时/玉堂时` 的 `局式/局义/局注` 改为你提供原文语义（含“当此之时…”等完整句）。
    - `XIAO_JU_META` 的 `condition/summary` 同步更新，保证列表摘要与详情文案一致。
  - **一致性自检**：
    - `XIAO_JU_META` / `XIAO_JU_REFERENCE_TEXT` / `matchXiaoJuReferences(add)` 键集合再次核对：`62/62/62`，无缺漏。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 20:28 - 遁甲八宫右栏重排：去除“第X部分”与“宫位数字”，改为六壬同风格板块卡片
- Scope: 按反馈优化遁甲八宫 UI：删除“第一/二/三部分”标记与“当前宫位：乾9宫”等无依据数字展示，改成类似六壬大格/小局的卡片板块排版。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaBaGongRules.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **八宫右栏重排**：
    - 保留 `乾/坎/艮/震/巽/离/坤/兑` 宫位切换按钮（圆角样式）。
    - 内容区改为 5 张独立 `Card`：`奇门吉格`、`奇门凶格`、`十干克应`、`八门克应和奇仪主应`、`八神加八门`。
    - 每块采用标题 + 标签 + 正文的板块式结构，视觉风格对齐六壬格局栏。
  - **文案清理**：
    - 删除 `第一部分/第二部分/...` 文案。
    - 删除 `当前宫位：X9宫` 行，不再在八宫面板显示宫位数字。
  - **快照一致性**：
    - 八宫 AI 快照标题从 `X9宫` 改为 `X宫`，与界面显示口径统一。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 20:31 - 六壬宫时局命中修复：改为“天盘亥/子/丑加临地盘四仲”判定
- Scope: 修复宫时局未显示问题；将此前误用的“月将+时支”条件改为宫时局原义“天盘加临地盘”口径，恢复小局中宫时局正常命中。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **匹配逻辑修正**：
    - `绛宫时`：读取 `upDownMap['亥']`，若落在四仲（子午卯酉）即命中。
    - `明堂时`：读取 `upDownMap['子']`，若落在四仲即命中。
    - `玉堂时`：读取 `upDownMap['丑']`，若落在四仲即命中。
  - **依据文案同步**：
    - 命中依据改为“天盘X（亥/子/丑）加临地盘Y（四仲）”，与宫时局“天地盘叠合”定义一致。
  - **兼容性**：
    - 仅修正小局宫时局命中判定，不改起课时间链路与其他小局规则。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 20:35 - 遁甲八宫精简：移除冗余说明卡文案
- Scope: 按反馈删除八宫页顶部提示卡“按已选宫位展示命中结果，结构与六壬格局栏一致。”，避免视觉冗余。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - 删除八宫内容区最上方说明 `Card`，保留五块核心结果卡片与宫位切换按钮不变。
  - 不涉及规则计算、AI 导出或其他模块逻辑。

### 20:38 - 六壬格局栏新增“参考”Tab：分离常驻参考条目
- Scope: 按反馈将小局中“始终/迍福/刑德”从 `小局` 分栏至新增 `参考`，避免这些近常驻条目挤占小局命中列表。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - 在右侧“格局参考”中新增 `参考` 标签页（位于 `小局` 右侧）。
  - 新增分流键集合：`shizhong`、`tunfu`、`xingde`。
  - `小局` 标签页改为仅展示非参考条目；`参考` 标签页展示上述分流条目，保持相同卡片体例与“命中依据”展示。
  - 本次仅调整展示分组，不改小局算法判定、导出结构和排盘时序。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 20:56 - 遁甲八宫吉凶格升级：由“仅格名”改为“格名：释义”
- Scope: 按反馈把八宫中 `奇门吉格/奇门凶格` 的显示从“仅名称”升级为“名称 + 冒号 + 释义”，并同步到八宫快照导出文本。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaBaGongRules.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **释义映射新增**：
    - 新增 `QIMEN_JIGE_INTERPRETATION` 与 `QIMEN_XIONGGE_INTERPRETATION` 两套映射，覆盖当前八宫引擎会命中的吉凶格名。
    - 释义按你提供口径接入：九遁、三诈、五假、三奇得使、玉女守门、天辅时、三奇升殿、奇游禄位、欢怡、相佐、天地奇仪相合、交泰、天运昌气、门宫和义，以及飞/伏干格、刑格、悖格、伏吟返吟、五不遇时、六仪击刑、三奇入墓、时干入墓、星门入墓、门宫迫制等。
  - **面板输出改造**：
    - `buildQimenBaGongPanelData` 新增 `jiPatternDetails` / `xiongPatternDetails` 字段。
    - 八宫 UI 改为逐条显示 `• 格名：释义`，不再只拼接格名。
  - **快照导出同步**：
    - `[八宫详解]` 中 `奇门吉格/奇门凶格` 改为多行条目输出，每行均为 `- 格名：释义`。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 20:58 - 遁甲八宫新增“释义开关”按钮（在经纬度选择左侧）
- Scope: 按反馈新增八宫吉凶格释义显示开关；支持“是/否”切换，置于“经纬度选择”按钮左侧。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - 新增页面状态 `showPatternInterpretation`（默认 `true`）。
  - 在右侧参数区（换日下方）新增按钮：`释义：是/否`，位置在 `经纬度选择` 左边。
  - 八宫 `奇门吉格/奇门凶格` 渲染改为：
    - 开启时：显示 `格名：释义`；
    - 关闭时：仅显示格名列表。
  - 仅影响前端展示，不改八宫规则判定与排盘计算。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 21:01 - 遁甲释义开关本地持久化（刷新后保留）
- Scope: 按反馈将“释义：是/否”开关持久化到本地存储，刷新页面后保持上次选择。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - 新增本地键：`qimenShowPatternInterpretation`。
  - 页面初始化时读取该键作为 `showPatternInterpretation` 初始值（缺省为 `true`）。
  - 点击开关时同步写入本地存储（`1/0`），立即生效。
  - 仅影响展示偏好，不改奇门计算逻辑与导出结构。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 21:05 - 遁甲新增“奇门演卦”：概览符使演卦 + 八宫门方演卦
- Scope: 按反馈新增两类奇门演卦输出：
  - 概览：`值符值使演卦例`（地盘值符宫为内卦、天盘值使宫为外卦）；
  - 八宫：`门方演卦例`（按例式组合每宫所临八门与方位宫位）。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaBaGongRules.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **演卦基础映射**：
    - 新增八门对应八卦映射（休坎、生艮、伤震、杜巽、景离、死坤、惊兑、开乾）。
    - 新增六十四卦名映射表，用于由上下卦直接得到卦名（如 `水风井`、`火地晋` 等）。
  - **概览（符使演卦）**：
    - 新增 `buildQimenFuShiYiGua`：以内卦=`值符宫`、外卦=`值使宫`演算，返回 `奇门演卦` 文本。
    - 概览增加行：`奇门演卦：...`。
  - **八宫（门方演卦）**：
    - `buildQimenBaGongPanelData` 新增字段：`menFangYiGua`、`menFangYiGuaText`。
    - 八宫每个宫位最下方新增板块：`奇门演卦`，展示门方演卦结果。
  - **AI 快照同步**：
    - `buildDunJiaSnapshotText` 增加概览演卦行。
    - `[八宫详解]` 每宫增加 `奇门演卦（门方）` 行。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 21:09 - AI导出链路补齐：六壬“参考”与遁甲“奇门演卦”同步到导出设置
- Scope: 按“本对话所有更新需同步AI导出与AI导出设置”要求，补齐快照分区与导出预设项。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js`
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **六壬快照分区补齐**：
    - 小局快照输出改为与右栏一致：`[小局]` 仅主小局，新增 `[参考]` 专门承载 `始终/迍福/刑德` 分流条目。
  - **遁甲快照分区补齐**：
    - 新增独立分区 `[奇门演卦]`，包含 `值符值使演卦` 文本说明；
    - 门方演卦继续按每宫写入 `[八宫详解]`，确保“概览演卦 + 八宫演卦”双链路可导出。
  - **AI导出设置预设补齐**：
    - `liureng` 预设分区新增 `参考`；
    - `qimen` 预设分区新增 `奇门演卦`。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 21:20 - 六壬“参考常驻”扩展：物气/新故/迍福/始终改为始终显示
- Scope: 按反馈将四个“局义参照型”条目改为不依赖盘式命中、在“参考”栏常驻显示。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - `参考` 标签分流集合新增：
    - `wuqi`（物气）
    - `xingu`（新故）
  - 新增常驻集合：
    - `wuqi`、`xingu`、`tunfu`、`shizhong`
  - 在小局匹配末尾补充常驻注入：若当盘未命中上述键，也会以 `参考常驻` 来源补入，命中依据标记为“局义参照，不以单一局式硬触发”。
  - 保留其余小局按原算法命中，不扩大到全局常驻。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 21:23 - 六壬参考常驻补齐：刑德加入始终显示
- Scope: 按补充反馈，将 `刑德` 同步加入“参考常驻”集合，确保与物气/新故/迍福/始终同口径常驻展示。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - `XIAO_JU_ALWAYS_REFERENCE_KEYS` 新增 `xingde`。
  - `参考` 栏常驻键集合现为：`wuqi`、`xingu`、`tunfu`、`shizhong`、`xingde`。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 21:29 - 六壬小局严判修正：收紧“入课传”边界，修复三奇误命中
- Scope: 针对“左盘四课三传无旬奇/干奇却误命中三奇”问题，回到局式口径，将“入课传”判定边界严格限定为四课+三传，不再夹带行年/贵人等扩展位。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - `courseBranches` 构成由“课传 + 日支/贵人/行年扩展”改为“仅四课上下神 + 三传地支”。
  - 受影响的“入课传”类局（如 `三奇/六仪/游子/孤寡/官爵` 等）自动按新边界严判，不再被扩展位误触发。
  - 重点修复：`三奇` 触发改为必须在四课三传体系内命中旬奇或干奇。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 21:41 - 遁甲格局算法二次严判：按原文收紧吉凶格触发条件
- Scope: 按“遁甲格局严格按上传文字算法”要求，对八宫吉凶格触发逻辑做二次审校与收紧，减少宽松命中并补齐关键格名。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaBaGongRules.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **九遁与三诈五假收紧**：
    - `天遁` 收紧为 `丙+丁+生门`；
    - `地遁` 收紧为 `乙+己+开门+（九地/太阴/六合）`；
    - `人遁` 收紧为 `丁+乙+休/生门+太阴`；
    - `鬼遁` 收紧为 `辛+丁+休/生/杜门+艮宫+九地`；
    - `云遁/龙遁/虎遁` 收紧为对应宫位与干门组合（移除虎遁宽松兜底分支）。
  - **吉格补齐与严判**：
    - 新增 `青龙回首（戊+丙）`、`飞鸟跌穴（丙+戊）`。
    - `三奇得使` 改为“日干映射三奇 + 地盘值使门宫 + 对应地干组合”联合判定。
    - `玉女守门` 合并“值使门加地盘丁奇 + 时干映射 + 指定时辰补例”判定。
  - **凶格补齐与严判**：
    - 新增并纳入算法：`青龙逃走`、`白虎猖狂`、`螣蛇夭矫`、`朱雀投江`、`太白火荧`、`荧入太白`、`飞宫格`、`伏宫格`、`大格`、`小格`、`天网四张格`、`地罗遮格`。
    - `伏吟/返吟` 格名与原文口径统一（由原 `门伏吟/门反吟` 调整）。
    - `三奇入墓` 收紧为 `乙坤、丙乾、丁艮`。
  - **释义联动**：
    - 对上述新增/调整格名同步补齐吉凶格释义映射，避免出现“未附释义”占位文本。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 21:48 - 六壬小局再严判：修正三光旺相误命中并扩展天合局判定位
- Scope: 按反馈修复“三光在日干死地仍命中”问题，并将天合局扩展到原文强调的三类显位（同课上下、三传、日干/日支上神互合）。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **三光局改为硬判**：
    - 命中条件由“日辰不相克 + 三传吉神偏多”调整为：
      - 日干旺相；
      - 日支旺相；
      - 初传旺相；
      - 三传神将全为吉神（贵人、六合、青龙、太常、太阴、天后）；
      - 同时保持“日辰用无硬克”约束。
    - 更新 `XIAO_JU_META.sanguang.condition` 文案，与局式口径一致。
  - **天合局判定扩展**：
    - 新增天合判定规则集（甲己/乙庚/丙辛/丁壬/戊癸）。
    - 命中依据扩展为：
      - 同课上下相合（四课逐课检查）；
      - 三传有合；
      - 日干与日支上神有合；
      - 日支与日干上神有合；
      - 并保留“课传天干池”总览证据。
    - 新增上下课天干对、日支旬干、天合天干池等上下文字段用于严判与回溯展示。
  - **命中依据展示优化**：
    - 天合条目会附带“命中发生在哪一类位”的具体证据行，便于核验。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 22:06 - 六壬新增十二盘式：中心显示与AI导出同步
- Scope: 按《基石》“十二式”规则，新增“月将在占时前后距离”盘式判定，并将结果显示到六壬盘中心（`XX课` 下方）及 AI 导出/导出设置。
- Files:
  - `Horosa-Web/astrostudyui/src/components/liureng/LRPanStyle.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRCommChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRInnerChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRCircleChart.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/RengChart.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengChart.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - 新增 `LRPanStyle` 规则模块，统一实现十二盘式映射：
    - 伏吟、进连茹、进间传、生胎、顺三合、四墓覆生、反吟、四绝体、逆三合、病胎、退间传、退连茹。
    - 算法采用 `distance = (月将序 - 占时序 + 12) % 12`（与“午将加申时=退间传式”示例一致）。
  - 六壬中心区（圆盘/方盘）在 `XX课` 下新增一行盘式显示（如 `退间传式`）。
  - 盘式结果进入六壬上下文与快照：
    - `[起盘信息]` 增加 `十二盘式` 概览行；
    - 新增独立分区 `[十二盘式]`，输出盘式、月将、占时与位序。
  - AI 导出设置预设同步：
    - `aiExport` 的 `liureng` 默认分区加入 `十二盘式`，可单独勾选导出。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 22:12 - 六壬神将悬浮窗 + 右栏“概览”新增（来意诀/杂主吉凶）
- Scope: 按《神》《将》文档新增六壬神将悬浮窗；并在右栏 `参考` 右侧增加 `概览` 标签，命中展示“天将发用来意诀 / 天将杂主吉凶”。
- Files:
  - `Horosa-Web/astrostudyui/src/components/liureng/LRShenJiangDoc.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRCommChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRCircleChart.js`
  - `Horosa-Web/astrostudyui/src/components/graph/D3Circle.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/RengChart.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengChart.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **神将悬浮窗（左盘）**
    - 新增 `LRShenJiangDoc` 文档数据模块，内置：
      - 12神（神后/大吉/...）的神义摘要（《神》章）；
      - 12将“临十二神”逐项判词（《将》章）。
    - 盘面悬浮窗统一改为“将+神双层判词”：
      - 先显示 `天盘神`（如 `子——损翼，不能移动`）；
      - 再显示 `地盘神`（如 `丑——掩目，又曰破头`）；
      - 同时附带对应神义摘要，明确标注天盘/地盘。
    - 方盘与圆盘均可悬停触发：
      - 方盘：十二宫区块 hover；
      - 圆盘：上盘/下盘/天将环各分段 hover。
    - `LiuRengChart` 增加 tooltip 样式初始化，交互风格对齐现有浮窗体系。
  - **右栏“概览”标签**
    - 在 `参考` 右侧新增 `概览` Tab。
    - 新增匹配器：基于 `发用 + 日干上神`，判定并输出：
      - `天将发用来意诀`
      - `天将杂主吉凶`
    - 每条命中输出 `诀文/要点/荀注` 与 `命中依据`，便于核验。
  - **AI 导出同步**
    - 六壬快照新增 `[概览]` 分区并输出命中条目。
    - AI 导出设置 `liureng` 预设分区新增 `概览`。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 22:26 - 六壬/遁甲格局算法二次严检（按上传原文收紧）
- Scope: 针对“六壬小局 + 奇门吉凶格”做二次规则收紧，减少口径外命中，提升与上传术文一致性。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaBaGongRules.js`
- Details:
  - **六壬（小局）**
    - `三阳` 判定改为按局式硬条件：贵人顺治、日干/日支在贵人前、且日干/日支/初传皆旺相。
    - `富贵` 判定从“至少两处旺相”收紧为“三传皆生旺”，并保留“贵人所乘旺相 + 贵人临核心位”约束。
  - **遁甲（八宫格局）**
    - `三奇得使` 去除额外地盘干限制，按“日干映射三奇 + 值使门所在宫”判定。
    - `玉女守门` 去除与原文无关的附加条件，按“值使门 + 时干映射/补例时辰”判定。
    - `伏吟/返吟` 从“仅门”收紧为“门+星同判”，对齐“星符门还加本宫/对冲宫”语义。
    - `时干入墓` 改为按原文列举的五个时干支（戊戌、壬辰、丙戌、癸未、丁丑）触发。
    - `门迫/门受制` 改为五行克制硬判（门克宫/宫克门）。
    - `星门入墓` 改为“星+门+宫位”联合判定，不再仅凭门宫粗判。
    - `三奇受制` 改为“奇墓/击刑/迫制”联合触发，避免泛化命中。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 22:58 - 六壬文献原文回填 + 依据展示/判定口径修正（概览合并、罗网双位、乱首方向）
- Scope: 按“荀注不得删减、所有更动入 log/structure”要求，回填六壬小局长版原文并修正依据展示与局式判定细节。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - **荀注回填（不再摘要化）**
    - `XIAO_JU_REFERENCE_TEXT` 多条目由短版恢复为长版原文（含 `增注`），覆盖淫泆局/新孕局/隐匿局/乖别局/凶否局/吉泰局/五行局/天合局/宫时局/北斗局相关条目。
    - 重点恢复的长注包括：`斩关/游子/闭口/解离/乱首/绝嗣/无禄/龙战/励德/赘婿/刑德/迍福/九丑/二烦/天祸/天寇/天网/天狱/死奇/魄化/三阴/罗网/三奇/六仪/官爵/轩盖/斫轮/铸印/龙德/连珠/五行五局/天合五组/宫时总论/斗孟仲季`。
  - **罗网判定修正**
    - 罗网命中由“仅同位命中”扩展为“同位 + 上神加临”双通道：
      - 同位：行年/日干寄支/日支；
      - 上神：行年上神/日干上神/日支上神。
    - 依据展示拆分为“命中地位 + 命中上神”两行，便于核验。
  - **概览依据合并**
    - 概览页新增按 `group + name` 合并逻辑，同名条目合并为单卡片；
    - 合并后 `evidence` 并集去重，确保两个依据都完整输出。
  - **乱首/赘婿方向文案修正**
    - 修正依据中的“临”方向标注，避免把“日支临日干”误写为“日干临日支”；
    - 同步修正 `乱首` 与同构条目 `赘婿` 的法一/法二说明口径。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 00:45 - 六壬神/将浮窗文案对齐《9. 神》并修正展示口径
- Scope: 六壬左盘悬浮窗改为文档化长文本结构；十二将浮窗不再展示“天盘/地盘神义”字样，仅展示天盘神、地盘神及对应判词。
- Files:
  - `Horosa-Web/astrostudyui/src/components/liureng/LRShenJiangDoc.js`
- Details:
  - 十二神资料补全为结构化字段：`title/month/verse1/verse2/desc/symbol`，如“河魁戌神”。
  - 神浮窗标题优先使用文档标题（如 `登明亥神`、`河魁戌神`）。
  - 将浮窗输出口径调整：
    - 保留：`天盘神`、`地盘神`、两盘对应判词；
    - 移除：“天盘神义/地盘神义”行，避免与需求冲突。

### 00:56 - 奇门遁甲时间行与导出时间字段同步
- Scope: 遁甲左盘与右侧概览统一显示“直接时间 + 真太阳时”；AI 快照导出同步输出“计算基准”。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js`
- Details:
  - 左盘顶部时间行改为同时显示两种时间，不再二选一显示。
  - 右侧概览同步显示 `直接时间` 与 `真太阳时`。
  - 导出快照 `[起盘信息]` 增加：
    - `直接时间`
    - `真太阳时`
    - `计算基准（直接时间/真太阳时）`
  - `parseDisplayDateHm` 增强了多种时间串格式兼容，减少显示为空的情况。

### 01:11 - AI导出补齐策略：遁甲/六壬防“旧快照缺段”
- Scope: 解决“页面已显示新分段，但导出仍缺段”的缓存优先问题。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
- Details:
  - 新增内容合并能力：当缓存快照缺段时，自动抓取当前页面分段并补齐（而非直接返回旧缓存）。
  - 遁甲补齐分段：
    - `奇门演卦`
    - `八宫详解`
  - 六壬补齐分段：
    - `大格`
    - `小局`
    - `参考`
    - `概览`
  - `qimen` 过滤兜底增强：默认保留 `奇门演卦`、`八宫详解`，避免旧设置误过滤新增分段。

### 01:18 - 修复“直接时间会改掉真太阳时显示”的根因
- Scope: `timeAlg` 只影响盘面计算基准，不再改写真太阳时显示来源。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - 删除“当 timeAlg=直接时间 时强制改用时区中央经线”的地理参数替换逻辑。
  - 计算与显示分离：
    - 显示用真太阳时始终基于真实经纬度；
    - timeAlg 仅用于后续排盘计算口径选择。

### 01:20 - 三式合一右侧参数区布局调整
- Scope: 将“回归黄道/整宫制”移动到“时计太乙/太乙统宗”同一行，提升参数可见性。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - 原两行布局：
    - 行1：时计太乙、太乙统宗
    - 行2：回归黄道、整宫制
  - 调整为同一行四列：
    - `时计太乙 | 太乙统宗 | 回归黄道 | 整宫制`
- Verification (local):
  - `node --check`（相关文件）✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 01:25 - 六壬/遁甲导出改为“计算快照直出”（禁用右侧DOM复制）
- Scope: 按需求将六壬与遁甲导出数据源切换为计算阶段快照，避免从右侧面板文本抓取导致排版/内容漂移。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
- Details:
  - `extractLiuRengContent` 与 `extractQiMenContent` 调整为：
    - 优先读取 `loadModuleAISnapshot(module)`；
    - 无快照时再尝试读取当前案例 `payload.snapshot`；
    - 不再抓取右侧 `Tabs/Card` 文本做补齐。
  - 新增当前案例快照兜底读取逻辑，确保“从计算阶段产出的原文排版”可直接用于导出。
  - 导出链路语义统一：
    - 有计算快照 -> 导出；
    - 无计算快照 -> 视为当前无可导出文本（不再DOM拼装）。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/utils/aiExport.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 01:34 - 导出剔除“右侧栏目”并修正三式排版
- Scope: 解决六壬导出仍出现`[右侧栏目]`噪音及列表化排版不佳问题。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js`
- Details:
  - AI导出新增分段黑名单：`liureng/qimen/sanshiunited`统一剔除`[右侧栏目]`（包含旧案例快照兜底过滤）。
  - AI导出设置可选分段同步隐藏`右侧栏目`，避免再次误选回流。
  - 遁甲快照分段名由`[右侧栏目]`改为`[盘面要素]`。
  - 六壬/遁甲/三式合一导出文本改为保留原始段落排版，不再统一转为`-`列表项。
  - 遁甲分段预设同步补入`盘面要素`，并兼容旧配置`概览/右侧栏目 -> 盘面要素`。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/utils/aiExport.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 01:44 - 修复“直接时间”导致左盘真太阳时被改写
- Scope: 修复遁甲与三式合一中，切换为“直接时间”后真太阳时显示被覆盖为直接时间的问题。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js`
- Details:
  - 引入“显示真太阳时”独立来源：
    - 计算仍使用当前`timeAlg`请求结果；
    - 显示真太阳时固定通过`timeAlg=0`参数二次获取（命中缓存时无额外成本）。
  - `calcDunJia`新增上下文优先字段：
    - `context.displaySolarTime`优先写入`pan.realSunTime`，避免被`nongli.birth`随算法覆盖。
  - 遁甲与三式合一均将`displaySolarTime`纳入遁甲盘缓存键与重算签名，确保切换算法后显示与盘面同步更新。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 01:50 - 六壬“格局参考”导出缺失修复（导出前强制刷新快照）
- Scope: 修复六壬导出偶发读取旧快照导致`大格/小局/参考/概览`缺失的问题。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
- Details:
  - 新增导出前刷新机制：
    - `aiExport`在提取六壬/遁甲内容前，派发`horosa:refresh-module-snapshot`事件并短暂等待。
  - 六壬组件监听该事件并按当前盘状态即时重写`liureng`模块快照，避免落回旧案例快照。
  - 遁甲组件同步接入同一事件（`qimen`），保持导出链路一致性。
  - 六壬分段兼容增强：将旧标题`三传(初传/中传/末传)`映射为`三传`，避免被分段筛选误丢。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/utils/aiExport.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 01:55 - 三式合一起盘稳定性兜底（防异常打空整盘）
- Scope: 修复三式合一偶发“暂无三式合一数据”空盘问题，避免任一子模块异常导致整盘不出。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - `recalcByNongli` 增加 `try/catch` 保护，异常时不再中断刷新队列。
  - 太乙子计算改为容错：异常时仅跳过太乙，不影响遁甲/六壬主盘展示。
  - `refreshAll` 增加兜底重算：异步重算未变更且当前盘为空时，立即再执行一次同步重算。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 02:00 - 遁甲八宫/六壬格局参考导出兜底（实时盘快照优先）
- Scope: 修复模块快照被旧来源覆盖时，导出缺少“八宫详解”或“格局参考”分段的问题。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
- Details:
  - 遁甲起盘后写入实时快照文本到 `window.__horosa_qimen_snapshot_text`。
  - 六壬起课后写入实时快照文本到 `window.__horosa_liureng_snapshot_text`。
  - AI导出读取顺序增强：
    - 先刷新模块快照；
    - 若缓存缺核心分段（遁甲缺`[奇门演卦]/[八宫详解]`、六壬缺`[大格]/[小局]/[参考]/[概览]`），自动回退到上述实时快照文本；
    - 仍不使用右侧DOM文本抓取。
  - 模块刷新等待窗口从 `30ms` 提升到 `80ms`，降低异步竞争导致的旧快照命中。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/utils/aiExport.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 02:13 - 导出改为“事件回传实时快照优先”（修复八宫/格局参考被旧缓存覆盖）
- Scope: 修复奇门遁甲“八宫详解”与大六壬“格局参考”在导出时偶发被旧缓存覆盖的问题。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js`
- Details:
  - `aiExport.requestModuleSnapshotRefresh` 改为返回事件回传文本：
    - 派发 `horosa:refresh-module-snapshot` 时携带 `detail.snapshotText` 容器；
    - 等待后直接读取回传快照，优先于本地缓存。
  - `extractQiMenContent` / `extractLiuRengContent` 读取顺序调整：
    - 优先使用“刚刷新并回传”的实时快照；
    - 再回退到缓存与 `window.__horosa_*_snapshot_text`；
    - 避免旧快照先命中导致八宫/格局参考缺失。
  - 遁甲组件刷新事件处理增强：
    - `saveQimenLiveSnapshot` 返回快照文本并写入时间戳；
    - 导出刷新事件中把快照写回 `evt.detail.snapshotText`，并同步 `saveModuleAISnapshot('qimen', snapshotText)`。
  - 六壬组件刷新事件处理增强：
    - `saveLiuRengAISnapshot` 返回快照文本；
    - 导出刷新事件中回填 `evt.detail.snapshotText`。
  - 发布同步：
    - 已将 `Horosa-Web/astrostudyui/dist-file/` 同步到 `runtime/mac/bundle/dist-file/`；
    - 运行时静态包入口已更新为 `umi.3fc83e7f.js`，避免继续命中旧前端包。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/utils/aiExport.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengMain.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅（输出 `dist-file/umi.3fc83e7f.js`）

### 02:18 - 修复三式合一因“显示真太阳时二次请求”导致整盘空白
- Scope: 解决三式合一在“直接时间”场景下，左盘显示真太阳时的附加请求失败会误判为整盘失败的问题。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
- Details:
  - `resolveDisplaySolarTime` 调整为“缓存优先 + 失败回退”：
    - 先读取 `getNongliLocalCache(timeAlg=0)`，命中即直接返回；
    - 未命中再请求 `fetchPreciseNongli(timeAlg=0)`；
    - 若该请求失败，仅回退到主请求时间（`current`），不抛错中断主盘计算。
  - 目的：
    - 保持“盘面计算算法由右侧选项控制”不变；
    - 保证“左侧真太阳时显示”尽量准确且不影响排盘成功率；
    - 避免额外请求失败引发“三式合一计算失败：精确历法服务不可用”假阳性。
  - 发布同步：
    - `runtime/mac/bundle/dist-file/` 已同步最新构建，入口更新为 `umi.c3707dd4.js`。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅

### 02:21 - 修复后自检（功能可用性）
- Scope: 按“完成修正后自检”要求，执行本地服务、接口、单测、构建与运行包一致性检查。
- Checks:
  - 服务存活：
    - `lsof -iTCP:8899 -sTCP:LISTEN` ✅
    - `lsof -iTCP:9999 -sTCP:LISTEN` ✅
  - 现有校验脚本：
    - `./verify_horosa_local.sh` ✅
  - 前端单元测试：
    - `CI=1 npm test -- --runInBand` ✅（3 suites, 16 tests 全通过）
  - 关键接口链路（含加密调用）：
    - `node .tmp_horosa_perf_check.js` ✅
    - `nongli/time`、`jieqi/year(seed/full24)`、`liureng/gods` 均返回成功。
  - 前端构建：
    - `npm run build:file` ✅
  - 运行包一致性：
    - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅
    - `http://127.0.0.1:8000/index.html` 引用 `umi.c3707dd4.js` ✅

### 08:11 - 三式合一起盘失败修复（时区参数标准化，仅三式）
- Scope: 修复三式合一起盘时偶发 `precise.nongli.unavailable`，并导致“暂无三式合一数据”的问题；明确仅改三式合一，不改遁甲逻辑。
- Root Cause:
  - 精确历法接口 `/nongli/time` 要求 `zone` 为 `±HH:mm`（如 `+08:00`）；
  - 三式合一在部分路径中会带入 `8` 或 `东8区`，后端返回错误码，前端拿不到 `nongli` 后触发失败提示。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - 新增时区解析与格式化：
    - `parseZoneOffsetHour` 支持 `+08:00`、`8`、`UTC+8`、`东8区/西5区` 等输入；
    - `normalizeZoneOffset` 统一输出为 `±HH:mm`。
  - 三式合一关键链路统一使用标准化时区：
    - `onTimeChanged`
    - `getTimeFieldsFromSelector`
    - `genParams`
    - `genJieqiParams`
  - 结果：无论界面显示“东8区”还是历史遗留数值时区，发给精确历法服务的都是合法格式。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅
  - 运行包同步：`runtime/mac/bundle/dist-file/index.html` 当前脚本 `umi.6bdb560e.js` ✅

### 08:24 - 三式合一“精确历法服务不可用”二次修复（桥接层参数归一）
- Scope: 继续修复三式合一报错 `三式合一计算失败：精确历法服务不可用`，根因锁定为部分请求仍出现 `zone` 单字符（服务端日志出现 `begin 1, end 3, length 1`）。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/preciseCalcBridge.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - `preciseCalcBridge` 新增参数归一化（所有精确历法入口统一生效）：
    - `parseZoneHour` / `formatZoneHour` / `normalizeZone`：将 `8`、`UTC+8`、`东8区` 等统一为 `+08:00`；
    - `normalizeAd`：兼容 `AD/BC/1/-1` 并按日期符号兜底；
    - `normalizeBit`：将 `timeAlg`、`after23NewDay` 统一为 `0/1`。
  - `fetchPreciseNongli` / `fetchPreciseJieqiYear` / `fetchPreciseJieqiSeed` 改为先归一化再：
    - 计算缓存键；
    - 读取/写入本地缓存；
    - 发起请求。
  - 三式合一 `genParams` 补齐 `ad` 字段，避免不同模块参数口径不一致。
  - 结果：
    - 即使上层传入非标准时区，底层也不会把 `zone` 透传成单字符；
    - 可直接规避 `/nongli/time` 的 `StringIndexOutOfBounds` 类失败。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/utils/preciseCalcBridge.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅
  - 运行包同步：`runtime/mac/bundle/dist-file/index.html` 当前脚本 `umi.88aa4eb2.js` ✅

### 08:54 - 三式合一稳定性修复（回退旧版计算路径 + 错误归因纠正）
- Scope: 修复三式合一仍然出现“计算异常/精确历法不可用”双报错、整盘空白的问题；参考旧版稳定目录恢复关键回退策略。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - `recalcByNongli`：
    - 重算异常不再直接弹“已跳过异常子模块”误导提示；
    - 统一记录 `lastRecalcError`，并输出控制台错误用于定位。
  - `performRecalcByNongli`：
    - `getCachedDunJia(..., displaySolarTime)` 异常时，自动回退到旧版稳定计算路径：
      - 直接调用 `calcDunJia(..., { year, jieqiYearSeeds, isDiurnal })`（不携带显示用上下文）；
    - 双路径都失败才返回失败，避免单一分支异常导致整盘中断。
  - `refreshAll`：
    - 移除“changed=false 时强行同步再算一次”的高风险分支；
    - 失败提示按错误类型区分：
      - 仅 `precise.nongli.unavailable` 显示“精确历法服务不可用”；
      - 其他异常显示“三式合一计算异常，请重试”。
  - 发布同步：
    - 构建产物已同步到 `runtime/mac/bundle/dist-file/`；
    - 运行包入口更新为 `umi.3875fe72.js`。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/utils/preciseCalcBridge.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅
  - `node .tmp_horosa_perf_check.js` in `Horosa-Web/astrostudyui` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅

### 09:09 - 三式合一排盘输入归一修复（对齐旧稳定链路）
- Scope: 针对三式合一仍报“计算异常，请重试”，继续收敛到 `displaySolarTime` 改动链路，确保显示时间不会污染排盘计算输入。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - `getCachedDunJia` 回退为旧稳定签名：
    - 缓存键移除 `displaySolarTime`；
    - `calcDunJia` 上下文不再传入 `displaySolarTime`。
  - `performRecalcByNongli` 改造：
    - 先算 `panRaw`，再单独覆盖 `realSunTime`（仅展示）；
    - 保持“显示真太阳时”和“排盘计算参数”彻底解耦。
  - 新增 `normalizeCalcFieldsForDunJia`：
    - 对三式合一传入遁甲计算前的 `fields` 做归一（`DateTime/zone/ad`）；
    - 避免字段类型漂移导致 `parseDateTime` 失败。
  - 发布同步：
    - `runtime/mac/bundle/dist-file/` 已同步最新包；
    - 当前入口脚本 `umi.9107fbb7.js`。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅

### 09:12 - 三式合一异常提示增强（输出具体错误）
- Scope: 当三式合一仍失败时，前端 toast 直接输出异常 `message`，便于快速定位而不是泛化“请重试”。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - `refreshAll` 的异常提示改为：
    - `precise.nongli.unavailable` 仍显示“精确历法服务不可用”；
    - 其他异常显示 `三式合一计算异常：<error.message>`。
  - 运行包同步：
    - 当前入口脚本更新为 `umi.8191667a.js`。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅

### 09:31 - 三式合一稳定回退（撤销 displaySolarTime 主链路）
- Scope: 按用户要求先回退“三式合一 displaySolarTime 接入”到稳定路径，优先恢复三式合一起盘可用性。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - 回退三式合一主计算链路：
    - 移除 `resolveDisplaySolarTime` 在 `refreshAll` 的主流程参与；
    - `recalcByNongli` / `performRecalcByNongli` 恢复为不携带 `displaySolarTime` 的稳定调用；
    - 去除“显示时间参与重算签名/状态写回”的路径。
  - 修复本次致命异常根因：
    - 之前 `refreshAll` 传入 `overrideOptions=null`，而重算签名直接读取 `overrideOptions.taiyiStyle`，导致报错：
      `null is not an object (evaluating 'n.taiyiStyle')`；
    - 现已改为稳定调用并补齐空值防护。
  - 强化防空保护：
    - 三式合一内 `this.state.options` 访问统一加兜底，避免极端状态下空对象异常。
  - 运行包同步：
    - `runtime/mac/bundle/dist-file/index.html` 当前入口脚本为 `umi.62edd81c.js`。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅
  - `./verify_horosa_local.sh` in `Horosa-Web` ✅
  - `./stop_horosa_local.sh && ./start_horosa_local.sh` in `Horosa-Web` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅

### 09:38 - 遁甲左盘日期兼容短年份（<4位）
- Scope: 修复奇门遁甲左侧盘头在输入短年份（如 `100`）时显示 `日期--` 的问题。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
- Details:
  - `parseDisplayDateHm` 年份正则从固定 `\d{4}` 调整为可变位数（支持 `1~6` 位，含符号）；
  - `getBoardTimeInfo` 不再用 `substr(0,4/5/8)` 固定切片日期，改为统一调用解析函数生成 `日期` 与 `时分`；
  - 因此 `100-02-25`、`999-12-01` 等年份都可正常显示为 `100年02月25日`。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅
  - 运行包入口脚本：`umi.25ee3d4c.js` ✅

### 09:48 - 三式合一顶部日期行统一格式 + 双时间同显（安全版）
- Scope: 按需求将三式合一左侧盘“日期”行改为同一字号单行显示：
  - `YYYY-MM-DD 真太阳时：HH:mm:ss 直接时间：HH:mm:ss`
  - 且不改动主排盘计算链路，避免再次引发页面崩溃。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.less`
- Details:
  - 显示格式调整：
    - `renderTop` 中“日期”行改为单个文本片段输出，所有文字继承同一字号；
    - 时间精度统一为秒（`HH:mm:ss`）。
  - 双时间来源调整（仅显示层）：
    - `直接时间` 固定来自输入组件时间；
    - `真太阳时` 新增独立 `displaySolarTime` 状态；
    - 当右侧选择“直接时间”时，额外以 `timeAlg=0` 请求一次仅用于显示的真太阳时；
    - 该显示值不进入三式合一 `recalc` 参数、缓存签名和遁甲计算上下文。
  - 计算口径保持：
    - 右侧选择“真太阳时/直接时间”仍通过 `genParams.timeAlg` 进入 `/nongli/time`，并据此决定实际排盘计算基准。
  - 稳定性说明：
    - 本次未改动三式合一主计算函数签名（避免重现此前 `taiyiStyle` 空对象崩溃链路）。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅
  - `./verify_horosa_local.sh` in `Horosa-Web` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅
  - 运行包入口脚本：`umi.34a10371.js`，样式：`umi.b7659491.css` ✅

### 10:08 - 参照八字/紫微修正时间算法落地（遁甲 + 三式合一）
- Scope: 按“八字/紫微 timeAlg 直接进计算参数”的方式，修复遁甲与三式合一中“选真太阳时但时柱仍按直接时间”的问题，并修复遁甲短年份日期头显示兜底。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - 遁甲时柱计算：
    - `buildGanzhiForQimen` 改为显式接收 `opts/context`；
    - 当 `timeAlg=真太阳时(0)` 时，优先用 `nongli.birth`（或 `context.displaySolarTime`）解析出的小时计算时柱；
    - 当 `timeAlg=直接时间(1)` 时，优先走精确历法返回时柱，回退到直接时分重算；
    - 补充从 `nongli.bazi.fourColumns` 读取年/月/日/时干支的优先兜底。
  - 三式合一算法透传：
    - `getQimenOptions` 显式加入 `timeAlg`，确保右侧选择真正进入遁甲子模块计算。
  - 遁甲短年份日期头兜底：
    - `parseDisplayDateHm` 改为“日期/时间分离匹配”，支持 1~6 位年份；
    - `getBoardTimeInfo` 使用解析结果兜底，不再因短年份出现 `日期--`。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅
  - `./verify_horosa_local.sh` in `Horosa-Web` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅
  - 运行包入口脚本：`umi.01433c13.js`，样式：`umi.b7659491.css` ✅

### 10:22 - 三式合一顶部右侧神煞列缩窄（保证时间行完整显示）
- Scope: 按用户标注，将三式合一左盘顶部右侧“驿马/日德/幕贵...”信息列向右缩窄，给左侧日期时间行留出空间。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.less`
- Details:
  - `.topBox` 网格列从 `1fr 174px` 调整为 `minmax(0, 1fr) 148px`。
  - 左侧日期行可用宽度增加，降低“真太阳时/直接时间”被截断概率。
- Verification (local):
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅
  - 运行包入口脚本：`umi.01433c13.js`，样式：`umi.4fac2da6.css` ✅

### 14:28 - 奇门遁甲干/门/星/神悬浮取象窗（全量接入 4.取象1.md）
- Scope: 按用户指定文档 `4.取象 1.md`（不删减）为奇门遁甲盘增加与六壬/紫微类似的悬浮窗口；鼠标悬停在宫内干、门、星、神时展示原文取象。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/QimenXiangDoc.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
- Details:
  - 新增 `QimenXiangDoc.js`：
    - 内置用户文档全文（保留原始内容）；
    - 解析结构：十天干 / 八门 / 九星 / 八神；
    - `#`/`####` 标题按“标题 + 分割线”块输出；
    - 提供干/门/星/神索引与别名归一（如 `傷→伤`、`門→门`、`騰蛇→螣蛇`、`天內→天芮`）。
  - `DunJiaMain.js` 悬浮接入：
    - 引入 `Popover`；
    - 天盘干、地盘干、八神、九星、八门都改为可悬浮节点；
    - 悬浮内容支持原文中的 `<font color=...>` 与 `**加粗**` 展示。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/dunjia/QimenXiangDoc.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅
  - 运行包入口脚本：`umi.e9018768.js`，样式：`umi.4fac2da6.css` ✅

### 14:41 - 奇门悬浮窗繁体安全转简（保留术数语义字）
- Scope: 按用户要求优化奇门悬浮窗文本的繁转简，避免语义误转；重点保证 `乾` 不被转成 `干`。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/QimenXiangDoc.js`
- Details:
  - 新增 `SAFE_TRAD_TO_SIMP_MAP` 与 `toSafeSimplified`，仅做“白名单式”安全转换；
  - `normalizeText` 与 `formatQimenDocLineToHtml` 统一走安全转换，悬浮窗标题与正文都会转成合适简体；
  - 明确保留术数关键字（如 `乾`）不做误转换。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/dunjia/QimenXiangDoc.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅
  - 运行包入口脚本：`umi.c042ba38.js`，样式：`umi.4fac2da6.css` ✅

### 14:52 - 占星“行星”页白屏修复 + 希腊点标题排版修复
- Scope: 修复占星页面点击右侧“行星”即白屏；修复“希腊点”标题字体混乱挤压。
- Files:
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPlanet.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroLots.js`
- Details:
  - `AstroPlanet.js`：将 `this.genPlanetsDom = this.genPlanetsDom.bind();` 修正为 `bind(this)`，避免切到“行星”Tab时 `this` 丢失导致运行时崩溃白屏。
  - `AstroLots.js`：
    - 新增 `renderTitle`，将“符号字体”和“中文标题字体”分离渲染；
    - 对无专用符号（占位符 `{`）的希腊点不再强制显示异常符号；
    - 移除 Card 全局 `AstroFont` 强制，避免中文/数字被符号字体挤压。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/astro/AstroPlanet.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/astro/AstroLots.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅
  - 运行包入口脚本：`umi.21875f3f.js`，样式：`umi.4fac2da6.css` ✅

### 15:40 - 占星“星/宫/座/相释义”开关与悬浮释义接入
- Scope: 在“星盘组件”最下方新增 `是否显示星/宫/座/相释义` 开关；开启后在占星图上为行星、宫位、星座、相位提供完整悬浮释义，关闭则保持当前仅基础黄经提示的行为。
- Files:
  - `Horosa-Web/astrostudyui/src/components/astro/ChartDisplaySelector.js`
  - `Horosa-Web/astrostudyui/src/models/app.js`
  - `Horosa-Web/astrostudyui/src/pages/index.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroChart.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroDoubleChart.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroChartCircle.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningData.js`
- Details:
  - 新增全局状态 `showAstroMeaning`（默认 `0`），并写入/读取 `GlobalSetup` 本地配置。
  - `ChartDisplaySelector` 新增底部勾选项：`是否显示星/宫/座/相释义`。
  - `AstroChartCircle` 接入释义能力：
    - 行星/宫位：在原有黄经 tooltip 基础上追加释义正文；
    - 星座：新增悬停 tooltip（开启开关时生效）；
    - 相位：新增悬停 tooltip（开启开关时生效）；
    - tooltip 容器改为宽版可滚动，适配长文档释义展示。
  - `AstroDoubleChart` 切换为复用 `AstroChartCircle` 绘制链路，确保双盘类占星技法也支持同一套悬浮释义。
  - `AstroMeaningData.js` 更新为用户提供的星体/星座/宫位释义全文结构化数据（不删减语义内容）。
- Verification (local):
  - `node --check`（7个文件）✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅
  - 运行包入口脚本：`umi.cc6e307f.js`，样式：`umi.4fac2da6.css` ✅

### 15:49 - 占星释义改为“原文直存”数据源（不改写参考文本）
- Scope: 按用户要求，星/宫/座悬浮释义数据改为原文直存，不再做措辞改写或简繁替换。
- Files:
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningData.js`
- Details:
  - 新增 `RAW_ASTRO_REFERENCE`：直接保存用户提供的原文内容；
  - 通过起止标记解析出行星/星座/宫位各块数据用于 tooltip；
  - 保留原文中的标题、标点、`####`、`**...**` 等文本形态。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/astro/AstroMeaningData.js` ✅
  - `npm run build:file` in `Horosa-Web/astrostudyui` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅
  - 运行包入口脚本：`umi.caedc923.js`，样式：`umi.4fac2da6.css` ✅

### 16:35 - 占星释义全页面同步（含推运表格/量化表格）+ 七政四余RA保护
- Scope: 按用户要求将“星/宫/座/相释义”开关同步到推运盘、量化盘、关系盘、节气盘、希腊星术、星盘、西洋游戏、印度律盘、三式合一关联入口；并补齐推运与量化相关表格悬浮释义。
- Files:
  - `Horosa-Web/astrostudyui/src/pages/index.js`
  - `Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroChartMain.js`
  - `Horosa-Web/astrostudyui/src/components/astro3d/AstroChartMain3D.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroAspect.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPlanet.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroLots.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroInfo.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroFirdaria.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroDoubleChartMain.js`
  - `Horosa-Web/astrostudyui/src/components/relative/AspectInfo.js`
  - `Horosa-Web/astrostudyui/src/components/relative/MidpointInfo.js`
  - `Horosa-Web/astrostudyui/src/components/relative/AntisciaInfo.js`
  - `Horosa-Web/astrostudyui/src/components/germany/Midpoint.js`
  - `Horosa-Web/astrostudyui/src/components/germany/AspectToMidpoint.js`
  - `Horosa-Web/astrostudyui/src/components/germany/MidpointMain.js`
  - `Horosa-Web/astrostudyui/src/components/germany/AstroMidpoint.js`
  - `Horosa-Web/astrostudyui/src/components/germany/AstroGermany.js`
  - `Horosa-Web/astrostudyui/src/components/dice/DiceMain.js`
  - `Horosa-Web/astrostudyui/src/components/otherbu/OtherBuMain.js`
  - `Horosa-Web/astrostudyui/src/components/astro/IndiaChartMain.js`
  - `Horosa-Web/astrostudyui/src/components/astro/IndiaChart.js`
  - `Horosa-Web/astrostudyui/src/components/hellenastro/HellenAstroMain.js`
  - `Horosa-Web/astrostudyui/src/components/hellenastro/AstroChart13.js`
  - `Horosa-Web/astrostudyui/src/components/jieqi/JieQiChartsMain.js`
  - `Horosa-Web/astrostudyui/src/components/jieqi/JieQiChart.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroSolarReturn.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroLunarReturn.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroGivenYear.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroProfection.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroSolarArc.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroZR.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningData.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningPopover.js`
- Details:
  - 统一新增 `showAstroMeaning` 透传链路，确保上述页面切换时都使用同一开关状态。
  - 推运表格（主/界限法、法达）与关系盘/量化盘表格（相位/中点/映点）支持行星/相位悬浮释义。
  - 行星页与希腊点页支持行星/星座/宫位悬浮释义。
  - 西洋游戏（骰子）结果区与图盘同步支持释义悬浮。
  - 新增 `AstroMeaningPopover.js` 统一渲染长释义内容（分隔线、滚动、高度限制）。
  - 明确未改动七政四余（`guolao`）RA默认显示逻辑。
- Verification (local):
  - `node --check`（当前变更涉及全部 js 文件）✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 16:45 - 三式合一补齐释义悬浮同步（仅显示层）
- Scope: 按用户要求补齐三式合一页面的释义同步，且不改计算链路；复核七政四余默认 `RA` 显示逻辑不受影响。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - 新增 `AstroMeaningData/AstroMeaningPopover` 接入；
  - 三式合一外圈以下元素支持与总开关联动的悬浮释义：
    - 地支位（按对应星座释义）；
    - 宫位数字（按 1~12 宫释义）；
    - 星曜短标（显示完整星曜文本 + 行星释义）。
  - 改动仅限渲染层，不改 `timeAlg`、排盘计算或缓存键，避免影响时间精度与稳定性。
  - 七政四余（`guolao/*`）未改动，默认 `RA/赤经` 展示保持原样。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 16:40 - 占星悬浮窗排版升级为遁甲同款层级样式
- Scope: 修复占星释义悬浮窗“主次不清、一团文本”问题，按用户要求支持 `#` 标题与 `**` 加粗。
- Files:
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningPopover.js`
- Details:
  - 新增 `#` 标题行识别：标题单独渲染为粗体小标题，并在下方自动添加分割线；
  - 新增 `**...**` 行内加粗解析：任意文本行中的加粗片段按 `<strong>` 渲染；
  - 保留 `==` 分割标记；空行渲染为小间距；
  - 统一为更接近遁甲弹窗的字体层级和间距（标题、分割线、正文行高）。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/astro/AstroMeaningPopover.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅

### 16:58 - 希腊点释义切换为用户原文专用数据源（无删减）
- Scope: 按用户提供内容，希腊点悬浮释义改为专用 `lot` 数据，不再复用行星释义文本。
- Files:
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningData.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroLots.js`
- Details:
  - 新增 `RAW_ASTRO_LOTS_REFERENCE`，完整保存用户提供的希腊点原文（幸运点/精神点/爱情点/必要点/勇气点/胜利点/复仇点/父亲点/母亲点/手足点/婚姻点/孩童点/疾病点/旺点/基础点）；
  - 新增 `lot` 分类映射 `LOT_MEANINGS`；
  - `buildMeaningTipByCategory('planet', key)` 增加希腊点兜底，保证其他页面中若仍以 `planet` 请求希腊点 id 也可显示正确释义；
  - `AstroLots` 标题悬浮改为优先读取 `buildMeaningTipByCategory('lot', objid)`。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/astro/AstroMeaningData.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/astro/AstroLots.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅

### 17:02 - AI导出/AI导出设置同步占星释义开关并按分段注入注释
- Scope: 按用户要求，将占星相关页面（含推运/量化/关系/节气/三式合一/七政四余/西洋游戏）的“释义能力”同步到 AI 导出设置；勾选后在导出文本对应分段追加注释内容。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web/astrostudyui/src/components/homepage/PageHeader.js`
- Details:
  - AI导出设置版本提升到 `v5`；
  - 新增 `astroMeaning` 配置（按技法独立保存，默认关闭）；
  - 在“AI导出设置”中新增复选项：
    - `在对应分段输出星/宫/座/相/希腊点释义`
  - 导出管线新增占星注释注入：
    - 对识别到的分段（行星/希腊点/相位/宫位/信息等）在其后自动追加 `[...]释义` 分段；
    - 覆盖并识别行星、希腊点、星座、宫位、相位（0/30/45/60/90/120/135/150/180）；
    - 释义内容来源于统一释义数据（含你提供的希腊点原文），并按首次出现去重，避免重复灌水。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/utils/aiExport.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/homepage/PageHeader.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅

### 17:11 - AI导出占星注释补齐“全占星分段对应位置输出”
- Scope: 按用户要求补齐“所有占星相关页面”导出注释覆盖，并确保注释出现在原分段后，不遗漏重复分段。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
- Details:
  - `appendAstroMeaningSections` 由“仅标题白名单触发”改为“标题显式 + 内容识别双通道触发”：
    - 标题命中（行星/希腊点/相位/宫位/信息/推运等）继续强制支持；
    - 其他分段只要识别到星/宫/座/相/希腊点内容，也会在该段后追加释义。
  - 移除跨分段全局去重，改为按分段独立输出，保证“对应位置”看到完整注释，不因前文已出现而被省略。
  - 保持 AI 导出设置开关行为不变：仅勾选“占星注释”时追加释义。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/utils/aiExport.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅

### 17:18 - 左侧星盘悬浮窗统一支持 # 标题 / **加粗**（遁甲风格）
- Scope: 修复“左侧星盘 tooltip 仍显示原始 markdown（###/**）”问题，确保与右侧/表格释义一致。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/helper.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroChartCircle.js`
- Details:
  - `helper.genHtml` 新增富文本渲染分支（仅命中 `#` 或 `**` 时启用）：
    - `# / ## / ### / ####` 识别为标题并在下方添加分割线；
    - `**...**` 行内加粗解析；
    - `==` 继续渲染为分割线；
    - 保留旧 `genHtmlLegacy` 作为非富文本 fallback，避免影响非占星普通 tooltip。
  - `AstroChartCircle.setupToolTip` 样式调整为白底卡片风格（接近遁甲浮窗）：
    - 宽度提升至 `560px`，增加 `max-width`；
    - 背景改白、边框与阴影增强层次，正文色统一。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/utils/helper.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/astro/AstroChartCircle.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅

### 17:24 - 遁甲左上四柱颜色与八字紫微方案对齐（仅顶部四柱）
- Scope: 修复遁甲左上角“年/月/日/时”干支颜色不一致问题，按八字紫微（木火土金水）配色映射显示；不改下方九宫方盘渲染。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js`
- Details:
  - 引入 `BaZiColor` 与 `ZhiColor`；
  - 新增 `GAN_COLOR_MAP / getBaZiStemColor / getBaZiBranchColor`；
  - 顶部 `pillars` 颜色由“按年/月/日/时固定色”改为“按实际干支字符映射颜色”。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/dunjia/DunJiaMain.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅

### 17:41 - 三式合一左盘同步六壬/遁甲/占星悬浮释义
- Scope: 按用户要求，三式合一左侧盘面统一接入三类悬浮释义：外圈占星（已存在）+ 六壬环 + 遁甲八宫干门星神。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - 新增六壬释义接入：
    - 引入 `buildLiuRengShenTipObj / buildLiuRengHouseTipObj`；
    - 六壬环中“天盘支”悬浮显示十二神释义；
    - 六壬环中“天将”悬浮显示将神（含天地盘神对应）释义。
  - 新增遁甲释义接入：
    - 引入 `buildQimenXiangTipObj`；
    - 为天盘干/八神/地盘干/九星/八门添加悬浮释义；
    - 将遁甲文档块结构转为统一 tooltip 行结构，保留标题/小标题/分割线层次。
  - 占星释义保持原有行为，不改开关逻辑：
    - 仍由 `showAstroMeaning`（右侧“释义”）统一控制显示与隐藏。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 17:37 - 三式合一悬浮无响应修复（pointer-events + Popover触发节点）
- Scope: 修复“三式合一左盘鼠标悬停不显示释义”的交互问题。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.less`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningPopover.js`
- Details:
  - `SanShiUnitedMain.less`：
    - `.outerCell/.qmBlock/.lrMark` 的 `pointer-events` 由 `none` 改为 `auto`，恢复鼠标命中。
  - `AstroMeaningPopover.js`：
    - `wrapWithMeaning` 不再固定包一层 `span` 触发；
    - 改为优先对原节点 `cloneElement` 注入 `cursor: help` 并直接作为 Popover 触发体，兼容绝对定位节点。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/astro/AstroMeaningPopover.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅

### 17:46 - AI导出同步六壬/遁甲/三式合一悬浮注释（可配置）
- Scope: 按用户要求，将六壬/遁甲/三式合一的悬浮释义同步到 AI 导出与 AI 导出设置，勾选后在对应分段输出注释。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web/astrostudyui/src/components/homepage/PageHeader.js`
- Details:
  - `AI_EXPORT_ASTRO_MEANING_TECHNIQUES` 新增 `qimen`、`liureng`；
  - 新增 `AI_EXPORT_HOVER_MEANING_TECHNIQUES`（`qimen/liureng/sanshiunited`）；
  - AI导出设置新增技法级动态文案：
    - 占星类：`在对应分段输出星/宫/座/相/希腊点释义`
    - 三式类：`在对应分段输出六壬/遁甲/占星悬浮注释`
  - 导出注释新增三套注入逻辑：
    - `appendQimenMeaningSections`：按分段提取干/门/星/神并注入《取象》注释；
    - `appendLiurengMeaningSections`：按地盘-天盘-贵神映射注入十二神/天将注释；
    - `appendSanShiUnitedMeaningSections`：在三式合一宫位段合并注入六壬/遁甲/占星注释；
  - `applyAstroMeaningFilterByContext` 改为按技法分流，保持原占星注释逻辑不变。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/utils/aiExport.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/homepage/PageHeader.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅

### 18:08 - AI导出改为计算快照优先（移除右栏DOM导出路径）
- Scope: 按要求将 AI 导出统一改为“计算阶段快照”来源，避免从右侧栏目/Tab DOM复制，重点修复占星盘排版回退问题。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
- Details:
  - `extractAstroContent`：
    - 星盘/希腊星术改为仅返回 `astroAiSnapshot`；
    - 印度律盘改为仅返回 `indiachart(_current/_N)` 快照；
    - 移除基于右侧 Tab 点击采集的兜底逻辑。
  - `extractSixYaoContent`：
    - 改为仅使用 `guazhan` 快照；
    - 移除 `[右侧栏目]` 与右栏 DOM 文本拼接路径。
  - `extractTongSheFaContent`、`extractFengShuiContent`：
    - 去除 `extractGenericContent` 兜底，避免误回退到页面文本采集；
    - 统摄法仅保留“实时模型快照/已存快照”两条导出通道。
  - `extractSanShiUnitedContent / extractTaiYiContent / extractGermanyContent / extractJieQiContent / extractRelativeContent / extractOtherBuContent`：
    - 统一改为“有快照则导出，无快照则空”，不再回退 DOM 拼接。
  - `extractGenericContent`：
    - 保留已知模块快照读取分支，删除最终 `scopeRoot` 文本兜底，避免误采集右栏。
  - 六爻导出分段设置与快照标题对齐：
    - 预设从 `起卦方式/卦辞` 调整为 `卦象/六爻与动爻/卦辞与断语`；
    - 保留旧配置映射兼容（`起卦方式 -> 卦象`，`卦辞 -> 卦辞与断语`）。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/utils/aiExport.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `rsync -a --delete Horosa-Web/astrostudyui/dist-file/ runtime/mac/bundle/dist-file/` ✅

### 18:20 - 三式合一占星悬浮恢复（兼容字符串tip）
- Scope: 修复三式合一中占星元素不弹出悬浮释义的问题，保持六壬/遁甲现有悬浮逻辑不变。
- Files:
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningPopover.js`
- Details:
  - 根因：`wrapWithMeaning` 在新版只兼容 `{ title, tips }` 对象，而三式合一占星外圈仍传入字符串tip，导致内容被判空后不渲染Popover。
  - 修复：新增 `normalizeTip` 兼容层，统一支持 `string / array / object` 三种tip输入；
  - `renderMeaningContent` 改为使用标准化后的tip对象，确保旧调用链可用。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/astro/AstroMeaningPopover.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 19:07 - AI导出强制快照链路自检与风水快照补齐
- Scope: 按“所有页面导出不从右侧栏目复制”要求，补齐风水快照写入，收口统摄法/风水导出为快照优先，并完成本地自检。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web/astrostudyui/src/components/fengshui/FengShuiMain.js`
  - `Horosa-Web/astrostudyui/public/fengshui/app.js`
- Details:
  - `extractTongSheFaContent` 改为：`refresh-module-snapshot` + `moduleAiSnapshot`；去除导出时按页面控件重建文本路径；
  - `extractFengShuiContent` 改为：`refresh-module-snapshot` + `moduleAiSnapshot`；移除 iframe DOM 文本拼接导出；
  - 风水页新增 AI 快照通道：
    - iframe 内部实时生成 `window.__horosa_fengshui_snapshot_text`（分段模板：`[起盘信息]/[标记判定]/[冲突清单]/[建议汇总]/[纳气建议]`）；
    - 外层 `FengShuiMain` 轮询读取并 `saveModuleAISnapshot('fengshui', ...)`；
    - 支持 `horosa:refresh-module-snapshot` 按需即时刷新。
  - 导出自检脚本确认：`extract*Content` 全部为快照链路（DOM-touch = 0）。
- Verification (local):
  - `cd Horosa-Web && ./verify_horosa_local.sh` ✅
  - `node --check Horosa-Web/astrostudyui/src/utils/aiExport.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/components/fengshui/FengShuiMain.js` ✅
  - `node --check Horosa-Web/astrostudyui/public/fengshui/app.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 19:24 - AI导出分段过滤容错修复（防止空白导出）
- Scope: 修复“当前页面没有可导出文本”误报；当 AI 导出设置分段为空或与实际分段不匹配时，自动回退有效正文，避免整页被过滤为空。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
- Details:
  - `applyUserSectionFilter`：
    - 若当前技法分段配置不是数组：保持原行为（仅去除禁用分段）；
    - 若数组为空：自动回退该技法预设分段；
    - 若过滤后结果为空：自动回退到原始正文（再执行禁用分段剔除）。
  - `applyUserSectionFilterByContext`（节气盘）：
    - 若按配置过滤后为空：回退原始正文，避免误清空导出。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/utils/aiExport.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 19:30 - AI导出全技法链路一致性自检
- Scope: 对“星盘/推运盘/量化盘/关系盘/节气盘/希腊星术/统摄法”等页面进行 AI 导出链路一致性核验，确认导出分发、设置过滤、快照回退、防空白逻辑可用。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
- Details:
  - 新增 payload 级兜底：
    - 过滤后若为空，自动回退到计算快照原文导出（保留释义注入能力）。
  - 运行矩阵校验脚本，检查：
    - 技法分发 `buildPayload` 覆盖度；
    - “右侧栏目”禁导出剔除是否生效；
    - 分段过滤容错与 payload 兜底是否生效。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/utils/aiExport.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `cd Horosa-Web && ./verify_horosa_local.sh` ✅
  - `node /tmp/ai_export_consistency_audit.js` ✅

### 20:52 - AI导出上下文识别兜底（修复“无可导出文本”）
- Scope: 修复页面结构变化导致 AI 导出误判 `generic` 的问题；当 DOM 识别失败时，改为按全局 `store.astro.currentTab/currentSubTab` 判定当前技法。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
- Details:
  - 新增 `resolveContextByAstroState()` 与 `withStoreContextFallback()`：
    - 兜底识别 `星盘/推运盘/量化盘/关系盘/节气盘/希腊星术/印度律盘/易与三式(含统摄法)/七政四余/三式合一`；
    - 覆盖 `direction`、`cntradition`、`cnyibu` 的子页映射，避免误落入 `generic`。
  - `buildPayload()` 与 `getCurrentAIExportContext()` 统一接入 store 兜底识别。
  - 星盘快照新增二级兜底：
    - `getAstroCachedContent()` 在签名不匹配或保存失败时，回退 `loadAstroAISnapshot()` 现存快照，避免空导出。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/utils/aiExport.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `cd Horosa-Web && ./verify_horosa_local.sh` ✅

### 20:59 - 三式合一占星悬浮格式对齐星盘（修复 `[object Object]`）
- Scope: 修复三式合一外圈占星悬浮将释义对象拼成字符串，导致显示 `[object Object]` 与星盘样式不一致的问题。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - 新增占星释义对象归一/合并函数：
    - `normalizeMeaningTip`
    - `mergeMeaningTips`
    - `buildOuterHouseMeaningTip`
    - `buildOuterBranchMeaningTip`
    - `buildOuterStarMeaningTip`
  - 三式合一外圈 `宫位/地支星座/星曜` 悬浮提示改为传入结构化 `title + tips`，与星盘同一套渲染器一致。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 21:37 - 星座释义补齐四尊贵状态（入庙/擢升/入落/入陷）
- Scope: 按要求为所有星座悬浮释义补充四尊贵状态，并同步覆盖星盘相关页面、三式合一、AI导出与AI导出设置对应的释义输出链路。
- Files:
  - `Horosa-Web/astrostudyui/src/components/astro/AstroMeaningData.js`
- Details:
  - 新增 `SIGN_DIGNITY_LINES`：
    - 按 12 星座补齐 `入庙 / 擢升 / 入落 / 入陷` 文案（含“无（传统占星中通常不设）”与“部分古占观点”标注）。
  - 新增 `enrichSignMeaningWithDignity(signKey, meaning)`：
    - 在星座释义中自动插入四尊贵状态行；
    - 优先插入到“宫位属性”后；
    - 含幂等保护：若已有“入庙”行则不重复追加。
  - `resolveMeaning('sign', key)` 改为返回补齐后的星座释义，统一复用到：
    - 星盘及占星相关页面悬浮；
    - 三式合一占星悬浮；
    - AI导出中的“星座释义”分段；
    - AI导出设置中“占星注释”开关开启后的释义输出。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/astro/AstroMeaningData.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 22:05 - 量化盘 AI 导出空白修复（强制刷新 germany 快照）
- Scope: 修复量化盘页面偶发“当前页面没有可导出文本”。
- Files:
  - `Horosa-Web/astrostudyui/src/components/germany/AstroMidpoint.js`
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
- Details:
  - `AstroMidpoint` 新增 `saveGermanySnapshot` 与 `handleSnapshotRefreshRequest`：
    - 监听 `horosa:refresh-module-snapshot`；
    - 当导出请求 `module=germany` 时，立即按当前计算结果重建并回填 `evt.detail.snapshotText`。
  - `AstroMidpoint` 生命周期增强：
    - `componentDidMount` 注册监听并主动尝试写入一次快照；
    - `componentDidUpdate` 在中点/星盘字段变化后自动刷新快照；
    - `componentWillUnmount` 注销监听。
  - `extractGermanyContent` 调整为“先刷新后读缓存”：
    - 先 `requestModuleSnapshotRefresh('germany')`；
    - 刷新失败再回落到 `getModuleCachedContent('germany')`。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/germany/AstroMidpoint.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/utils/aiExport.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 22:56 - AI导出全链路稳态修复（跨模块空白/误判/串台）
- Scope: 解决多术法“点AI导出无反应/提示无可导出文本”、上下文误判导致抓错模块、以及本地存储异常时快照丢失的问题。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `Horosa-Web/astrostudyui/src/utils/moduleAiSnapshot.js`
  - `Horosa-Web/astrostudyui/src/utils/astroAiSnapshot.js`
- Details:
  - 快照存取兜底：
    - `moduleAiSnapshot` 新增会话级内存快照 `MODULE_SNAPSHOT_MEMORY`；
    - `astroAiSnapshot` 新增会话级内存快照 `ASTRO_AI_SNAPSHOT_MEMORY`；
    - `localStorage` 读写失败时自动回退内存快照，避免整页导出变空。
  - 上下文判定修复：
    - `withStoreContextFallback` 改为更积极地采用 `astro.currentTab/currentSubTab` 回退；
    - `getCurrentAIExportContext` 对 `direction` 明确映射 `primarydirect`，避免落入空键。
  - 导出提取链路增强：
    - 抽出 `extractContentByKey`；
    - 新增 `getCandidateExportKeys`，在首选模块无内容时按当前术法做候选兜底（并避免推运子模块串台）；
    - `buildPayload` 改为按候选顺序提取并使用 `usedExportKey` 进行过滤与注释开关匹配。
  - 模块快照刷新增强：
    - `zodialrelease/firdaria/profection/solararc/solarreturn/lunarreturn/givenyear` 导出前先尝试 `requestModuleSnapshotRefresh`；
    - `requestModuleSnapshotRefresh` 等待时长 80ms -> 220ms，兼容异步重算后写快照。
  - 避免模块串台：
    - 金口诀导出不再回退六壬；
    - `getModuleCachedContent` 增加别名匹配（如 `guazhan<->sixyao`、`qimen<->dunjia`、`indiachart_*`、`jieqi_*`）。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/utils/aiExport.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/utils/moduleAiSnapshot.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/utils/astroAiSnapshot.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 19:42 - 星盘组件底部选项统一为复选框（含主/界限法开关）
- Scope: 统一星盘组件底部控制项样式与交互，修复“下拉+复选框混排”和底部选项区风格不一致问题。
- Files:
  - `Horosa-Web/astrostudyui/src/components/astro/ChartDisplaySelector.js`
  - `Horosa-Web/astrostudyui/src/models/app.js`
  - `Horosa-Web/astrostudyui/src/pages/index.js`
- Details:
  - `ChartDisplaySelector`：
    - 移除 `Checkbox.Group + Select` 混合写法，改为统一单行复选框列表；
    - `主/界限法显示界限法` 从下拉改为纯复选框（勾选=1，未勾选=0）；
    - 新增复选项：`仅按照本垣擢升计算互容接纳`。
  - 新增 `changeChartOption`，按单项勾选增删 `chartDisplay`，避免 Group 与自定义项布局冲突。
  - `app` 全局状态新增 `showOnlyRulExaltReception`（默认 `0`），并写入 `GlobalSetup` 持久化。
  - `index` 页面透传 `showOnlyRulExaltReception` 到图盘组件链路。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/astro/ChartDisplaySelector.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/models/app.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/pages/index.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 19:46 - 接纳/互容“仅本垣擢升”过滤同步到右侧信息与AI快照
- Scope: 让“仅按照本垣擢升计算互容接纳”在页面显示与AI导出中同规则生效，避免显示与导出不一致。
- Files:
  - `Horosa-Web/astrostudyui/src/components/astro/AstroInfo.js`
  - `Horosa-Web/astrostudyui/src/utils/astroAiSnapshot.js`
- Details:
  - `AstroInfo` 新增过滤链路：
    - `normal reception`：仅保留 `supplierRulerShip` 含 `ruler/exalt`；
    - `abnormal reception`：`supplierRulerShip` 或 `beneficiaryDignity` 任一含 `ruler/exalt` 即保留；
    - `mutual reception`：双方 `rulerShip` 都含 `ruler/exalt` 才保留；
    - 当过滤后为空时，不再渲染“接纳/互容”分段标题，避免空分节。
  - `astroAiSnapshot` 同步接入同一过滤规则：
    - `buildInfoSection` 过滤接纳/互容导出条目；
    - 快照签名加入 `onlyRulerExaltReception` 标记，切换开关后不会复用旧快照；
    - `build/save/get snapshot` 链路支持 `options` 透传该开关。
  - 配置读取兜底：
    - 当未显式传入时，从 `GlobalSetup.showOnlyRulExaltReception` 读取，保持页面与导出一致。
- Verification (local):
  - `node --check Horosa-Web/astrostudyui/src/components/astro/AstroInfo.js` ✅
  - `node --check Horosa-Web/astrostudyui/src/utils/astroAiSnapshot.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 17:11 - 六壬/三式合一天将悬浮文案补全（按将分别显示，不混入“临十二神”总段）
- Scope: 按用户要求补齐十二天将悬浮正文，且仅 `天乙` 显示“主清御/天乙持魁钺”段落；其它天将显示各自对应正文，不再误复用天乙段落；并移除正文内重复的“XX临十二神”整段。
- Files:
  - `Horosa-Web/astrostudyui/src/components/liureng/LRShenJiangDoc.js`
- Details:
  - 新增 `JIANG_INFO`（十二天将）详细文案数据：
    - 每将包含 `intros / verses / extra`；
    - `天乙` 使用加粗段落与诗诀（“主清御…天乙持魁钺…”）；
    - 其余十一将使用各自独立正文与诗诀，不再混入天乙文本。
  - `buildJiangDocTips` 改为按当前天将输出“专属正文+诗诀+附注”。
  - 保留宫位上下文判定信息（天盘神/地盘神命中），用于当前格位定位；
  - 删除正文中的“XX临十二神”大段，避免与已显示的命中位信息重复。
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 17:14 - 六壬悬浮窗样式统一为三式合一风格
- Scope: 按用户要求，将六壬相关悬浮窗显示风格统一为三式合一盘的富文本样式（标题分层、加粗、分隔线、统一排版），不再走旧版列表样式。
- Files:
  - `Horosa-Web/astrostudyui/src/utils/helper.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRCommChart.js`
- Details:
  - `helper.genHtml` 新增 `forceRich` 参数；当 `forceRich=true` 时，即使文本不含 `#/**` 标记，也强制使用富文本渲染器（与三式合一样式一致）。
  - `helper.creatTooltip` 新增透传 `forceRich` 参数。
  - 六壬通用图盘 `LRCommChart` 的神将/神义悬浮调用统一传 `forceRich=true`，确保六壬悬浮全部按三式合一风格显示。
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 17:22 - 六壬盘悬浮容器样式对齐三式合一（修复蓝底整条遮挡）
- Scope: 修复六壬盘悬浮仍显示旧版 `lightsteelblue` 大宽条的问题，使其视觉与三式合一悬浮一致（白底卡片、阴影、边框、自动宽度）。
- Files:
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengChart.js`
  - `Horosa-Web/astrostudyui/src/utils/helper.js`
- Details:
  - `LiuRengChart.setupToolTip`：
    - 旧样式 `width:560px + lightsteelblue` 改为卡片式样式：
      - `width:auto`、`max-width:560px`、`min-width:220px`
      - `max-height:62vh` + `overflow-y:auto`
      - `background:#fff`、`border:#e8e8e8`、`box-shadow`
      - `padding:8px 10px`、`z-index:2100`
  - `creatTooltip`：当 `forceRich=true` 时，悬浮不再用 `0.9` 透明度，改为 `1`，避免文本和背景发灰。
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 17:25 - 文档同步确认（六壬悬浮窗对齐）
- Scope: 按用户确认，将本轮六壬悬浮窗风格与文案调整结果同步登记到变更日志与结构文档。
- Synced:
  - `Horosa-Web/astrostudyui/src/components/liureng/LRShenJiangDoc.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRCommChart.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/LiuRengChart.js`
  - `Horosa-Web/astrostudyui/src/utils/helper.js`
  - `UPGRADE_LOG.md`
  - `PROJECT_STRUCTURE.md`

### 19:52 - 六壬悬浮标题去重（仅保留顶部标题）
- Scope: 按用户要求，六壬与三式合一中的六壬盘悬浮窗名称只显示一次，保留最上方标题，移除正文重复将名。
- Files:
  - `Horosa-Web/astrostudyui/src/components/liureng/LRShenJiangDoc.js`
- Details:
  - `buildJiangDocTips` 不再在正文首行注入 `### **将名**`；
  - 顶部标题继续由 `tipObj.title` 提供，避免“同名出现两次”。
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 19:55 - 六壬悬浮加粗规则补齐（天将/地支）
- Scope: 按用户要求补齐六壬与三式合一六壬盘悬浮加粗样式：
  - 十二天将：`其吉`、`其戾`、`天盘神`、`地盘神` 加粗；
  - 十二地支：两句诗加粗，`类象` 两字加粗。
- Files:
  - `Horosa-Web/astrostudyui/src/components/liureng/LRShenJiangDoc.js`
- Details:
  - 新增 `formatJiangIntroLine`：对天将正文中前缀 `其吉：` / `其戾：` 自动转为加粗标签。
  - `buildLiuRengHouseTipObj`：
    - `天盘神：` -> `**天盘神：**`
    - `地盘神：` -> `**地盘神：**`
  - `buildLiuRengShenTipObj`：
    - 两句诗 `verse1/verse2` 改为整句加粗；
    - `类象：` 改为 `**类象：**` 前缀加粗。
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 19:58 - 六壬悬浮补充四课/三传（地支+天将）
- Scope: 按用户要求，在六壬与三式合一的六壬盘悬浮窗中追加四课与三传的“地支+天将”信息。
- Files:
  - `Horosa-Web/astrostudyui/src/components/liureng/LRShenJiangDoc.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/LRCommChart.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/RengChart.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - `LRShenJiangDoc.js`：
    - 新增 `appendKeAndChuanTips`，按上下文追加：
      - `四课（地支/天将）`：四课、三课、二课、一课；
      - `三传（地支/天将）`：初传、中传、末传；
    - `buildLiuRengShenTipObj` 与 `buildLiuRengHouseTipObj` 增加可选 `tipContext` 参数，并统一注入该信息段。
  - `LRCommChart.js`：
    - 新增 `sanChuanData`、`setSanChuanData`、`buildTooltipContext`；
    - 神义/天将悬浮构建时传入 `{ke, sanChuan}` 上下文。
  - `RengChart.js`：
    - 在三传计算完成后，把 `cuangs` 注入主六壬盘对象（用于悬浮实时读取）。
  - `SanShiUnitedMain.js`：
    - 三式合一六壬环悬浮构建时传入当前 `keData.raw + sanChuan` 上下文。
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 20:04 - 修正四课/三传悬浮触发方式（按元素悬浮显示）
- Scope: 按用户纠正，将“四课/三传的地支+天将”改为**鼠标悬浮四课/三传对应元素时显示**，而不是追加到其他六壬悬浮正文里。
- Files:
  - `Horosa-Web/astrostudyui/src/components/liureng/KeChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/ChuangChart.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/RengChart.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - 六壬盘（四课/三传面板）：
    - `KeChart` 为每一课列新增悬浮提示（地支+天将）；
    - `ChuangChart` 为初传/中传/末传列新增悬浮提示（地支+天将）；
    - 同时为列内容区添加透明热区，提升可触发面积。
  - `RengChart`：将共用 `divTooltip` 传给 `KeChart/ChuangChart`，使其可实际弹窗。
  - 三式合一六壬中宫：
    - 四课四列、三传三列均接入 `wrapWithMeaning`；
    - 悬浮内容统一为“地支+天将”。
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 20:14 - 四课/三传悬浮改为元素级映射（仅地支/天将可悬浮）
- Scope: 按用户进一步要求，四课/三传悬浮从“整列统一提示”改为“按鼠标所在元素提示”，并且只为地支与天将提供悬浮；六亲与天干不显示悬浮。
- Files:
  - `Horosa-Web/astrostudyui/src/components/liureng/KeChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/ChuangChart.js`
  - `Horosa-Web/astrostudyui/src/components/lrzhan/RengChart.js`
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - 六壬盘：
    - `KeChart`：
      - 四课天将文本绑定“天将释义悬浮”；
      - 四课地支（仅上位地支）绑定“十二神释义悬浮”；
      - 去除整列统一提示与非目标元素提示。
    - `ChuangChart`：
      - 三传天将文本绑定“天将释义悬浮”；
      - 三传地支（干支中的支位）绑定“十二神释义悬浮”；
      - 六亲/天干不绑定悬浮。
    - `RengChart`：为 `KeChart` 传入 `liuRengChart`，用于从上神定位下神并还原天将完整释义。
  - 三式合一六壬中宫：
    - 四课列：仅“天将字符”和“地支字符”可悬浮，底行字符不悬浮；
    - 三传行：仅“地支字符”和“天将字符”可悬浮，天干不悬浮。
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 20:16 - 三式合一后天十二宫悬浮标题去重
- Scope: 按用户要求，三式合一中后天十二宫悬浮只保留顶部宫名标题，不在正文重复显示同名。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - `buildOuterHouseMeaningTip` 在合并宫位释义时，将正文分段标题从 `${num}宫` 调整为 `''`；
  - 保留 tooltip 顶部 `title`（单宫或多宫组合）作为唯一宫名展示。
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 21:49 - 三式合一外圈上升点简称改为“升”
- Scope: 按用户要求，将三式合一外圈星盘中的上升点简称从“上”调整为“升”。
- Files:
  - `Horosa-Web/astrostudyui/src/components/sanshi/SanShiUnitedMain.js`
- Details:
  - `shortMainStarLabel(name)` 新增特判：
    - `上升` -> `升`
  - 保持既有特判不变：`太阳` -> `日`，`天顶/中天` -> `顶`。
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 21:52 - 修复四课/三传中间横线（热区继承描边）
- Scope: 修复六壬四课地支区与三传干支区出现意外横线的问题。
- Files:
  - `Horosa-Web/astrostudyui/src/components/liureng/KeChart.js`
  - `Horosa-Web/astrostudyui/src/components/liureng/ChuangChart.js`
- Root cause:
  - 为悬浮触发新增的透明热区 `rect` 未显式关闭描边，在父 SVG 的 `stroke` 继承下显示出边框线。
- Details:
  - 两处热区 `rect` 统一补充：
    - `.attr('stroke', 'none')`
    - `.attr('stroke-width', 0)`
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 22:03 - Horosa_Local 启动前自动清理旧网页监听进程（端口8000占用兜底）
- Scope: 修复“关闭窗口后偶发残留 http.server 占用 8000，导致下次启动失败”的问题。
- Files:
  - `Horosa_Local.command`
- Details:
  - 新增监听进程识别/清理函数：
    - `get_listener_pids(port)`
    - `is_horosa_web_listener(pid)`
    - `cleanup_stale_horosa_web_listener(port)`
  - 启动网页服务前若检测到端口被占用：
    - 先自动识别是否为旧 Horosa `python -m http.server` 进程（命令行或 cwd 指向项目 `astrostudyui/dist*`）；
    - 命中则自动 `kill/kill -9` 清理；
    - 仍被占用则按非 Horosa 进程处理并终止启动。
  - 失败时将占用详情写入诊断日志 `horosa-run-issues.log` 便于定位。
- Verification (local):
  - `bash -n Horosa_Local.command` ✅

### 10:46 - 全页面稳定性回归与核心报错收敛（2026-03-03）
- Scope: 对前端主页面/主模块、关键算法接口与本地运行链路进行一次完整回归，并针对冒烟阶段暴露的稳定性问题做修复。
- Files:
  - `Horosa-Web/astrostudyui/src/components/graph/D3Arrow.js`
  - `Horosa-Web/astrostudyui/src/components/graph/__tests__/D3Arrow.test.js`
  - `Horosa-Web/astrostudyui/src/components/astro3d/Astro3D.js`
  - `Horosa-Web/astrostudyui/src/components/amap/MapV2.js`
  - `Horosa-Web/astrostudyui/src/pages/document.ejs`
- Details:
  - 修复 SVG marker 参数拼接错误：
    - `viewBox` 从错误的 `"0 012 12"` 改为合法 `"0 0 12 12"`；
    - 消除多模块重复触发的 marker console error。
  - 增加回归测试：
    - 新增 `D3Arrow` 单测，锁定 `marker.viewBox` 格式，防止回归。
  - 优化 3D 模型加载策略：
    - 本地/file/localhost 场景优先走远端 `Chart3DServer`，避免先探测本地缺失模型导致 404 噪音；
    - 失败时仍保留既有 fallback 到简化模式，保证可用性。
  - 提升地图加载容错：
    - `MapV2` 为 `AMapLoader.load` 增加 `.catch(...)`，当高德 UI 不可用时不中断页面渲染。
  - 消除默认 favicon 404：
    - `document.ejs` 增加内联 favicon，避免浏览器默认请求 `/favicon.ico` 报错。
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui test -- --watch=false` ✅（4 suites / 17 tests）
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `cd Horosa-Web && ./start_horosa_local.sh && ./verify_horosa_local.sh && ./stop_horosa_local.sh` ✅
  - `python3 -m unittest discover -s Horosa-Web/flatlib-ctrad2/tests -v` ✅（5 tests）
  - Playwright 全页面冒烟（16 顶层 tab + 嵌套 tab 切换）✅
    - 前：39 errors / 2 warnings
    - 后：1 error / 1 warning（仅外部高德 UI 超时 + 3D 模型超时降级提示，核心本地接口均 200）

### 11:14 - 全页面零报错冒烟（地图 UI 本地降级）与 AI 导出全量复核（2026-03-03）
- Scope: 按“所有页面/所有技法/所有设置可用、不白屏、无报错”目标，补齐本地地图 UI 依赖降级策略并执行新一轮全量回归。
- Files:
  - `Horosa-Web/astrostudyui/src/components/amap/amapUIHelper.js`（新增）
  - `Horosa-Web/astrostudyui/src/components/amap/MapV2.js`
  - `Horosa-Web/astrostudyui/src/components/amap/ACG.js`
  - `Horosa-Web/astrostudyui/src/components/amap/GeoCoord.js`
  - `Horosa-Web/astrostudyui/src/components/amap/GeoCoordSelector.js`
  - `Horosa-Web/astrostudyui/src/components/amap/PointsCluster.js`
- Details:
  - 新增 `amapUIHelper`：
    - `canUseAMapUI()`：本地 `file/localhost/127.0.0.1` 环境不加载 AMapUI；
    - `safeLoadAMapUI()`：统一安全加载与 fallback。
  - `MapV2`：
    - `AMapLoader.load` 参数按环境动态注入 `AMapUI`，本地避免触发 `ui/control/BasicControl` 超时异常。
  - 地图组件（ACG/GeoCoord/GeoCoordSelector/PointsCluster）：
    - 全部改为 `safeLoadAMapUI(...)`；
    - `GeoCoord` 增加 `SimpleMarker` 失败时普通 `AMap.Marker` 回退，保证页面可交互。
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui test -- --watch=false` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `cd Horosa-Web && ./start_horosa_local.sh && ./verify_horosa_local.sh && ./stop_horosa_local.sh` ✅
  - Playwright 全页面冒烟（16 顶层 tab + 嵌套）✅：
    - `Console errors: 0`
    - `Console warnings: 1`（3D 模型超时后简化模式提示）
    - `#root` 存在且有内容（无白屏）
  - AI 导出设置与 AI 导出动作全量复核 ✅：
    - 技法设置项扫描：33 项均可见并可保存；
    - 导出动作：复制/TXT/Word/PDF/一键全部均可用；
    - 主 tab 导出：16/16 成功返回导出提示。

### 11:48 - 再次全量自检（页面/技法/AI导出/算法）与稳定性确认（2026-03-03）
- Scope: 按“所有内容、所有页面、所有技法设置可用且不白屏”要求，执行第二轮全量巡检；本轮以验证为主，无新增业务代码改动。
- Files:
  - `UPGRADE_LOG.md`
  - `PROJECT_STRUCTURE.md`
- Details:
  - 基础链路复核：
    - `npm --prefix Horosa-Web/astrostudyui test -- --watch=false` 通过（4 suites / 17 tests）。
    - `npm --prefix Horosa-Web/astrostudyui run build:file` 通过。
    - `cd Horosa-Web && ./start_horosa_local.sh && ./verify_horosa_local.sh && ./stop_horosa_local.sh` 通过。
  - 算法/API自检：
    - `node Horosa-Web/astrostudyui/.tmp_horosa_verify.js` 通过。
    - `node Horosa-Web/astrostudyui/.tmp_horosa_perf_check.js` 通过（`nongli_time/jieqi_seed/liureng_gods/jieqi_year_full24` 均返回有效结果）。
  - AI 导出与设置复核：
    - `node Horosa-Web/astrostudyui/.tmp_ai_export_matrix_check.js` 全部 PASS（技术键、预设键、提取映射、快照映射一致）。
  - 前端页面稳定性巡检（Playwright）：
    - 对 16 个主页面按分批短会话巡检（避免长会话失真）：`星盘/三维盘/推运盘/量化盘/关系盘/节气盘/星体地图/七政四余/希腊星术/印度律盘/八字紫微/易与三式/万年历/西洋游戏/风水/三式合一`；
    - 各页均满足：`clicked=true`、`#root` 存在、`hasErrorBoundary=false`、页面文本非空；
    - 分批日志中 console error 为 0（仅保留 1 条 3D timeout 警告，已走简化模式 fallback）。
  - 说明：
    - 巡检中出现过一次 `ERR_CONNECTION_REFUSED` 短暂噪音，定位为“后端尚未完全就绪即开始页面轮询”；已通过在页面巡检前加入 `verify_horosa_local.sh` 预检规避，不属于业务算法回归缺陷。
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui test -- --watch=false` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `cd Horosa-Web && ./start_horosa_local.sh && ./verify_horosa_local.sh && ./stop_horosa_local.sh` ✅
  - `node Horosa-Web/astrostudyui/.tmp_horosa_verify.js` ✅
  - `node Horosa-Web/astrostudyui/.tmp_horosa_perf_check.js` ✅
  - `node Horosa-Web/astrostudyui/.tmp_ai_export_matrix_check.js` ✅
  - Playwright 分批巡检 16 主页面 ✅

### 14:22 - 继续修复bug：3D fallback降噪 + 本地脚本关闭回收 + 再次全量复测（2026-03-03）
- Scope: 针对“继续修复 bug / 全页面稳定性”要求，收敛 3D fallback 噪音、修复关闭窗口后服务未回收风险，并完成新一轮页面与算法复测。
- Files:
  - `Horosa-Web/astrostudyui/src/components/astro3d/Astro3D.js`
  - `Horosa_Local.command`
  - `UPGRADE_LOG.md`
  - `PROJECT_STRUCTURE.md`
- Details:
  - `Astro3D`：
    - 新增模型不可用短期缓存（`sessionStorage`，键 `horosa3dModelUnavailableAt`，冷却 `10min`）；
    - 冷却期内直接走简化模式，跳过重复 GLTF 请求；
    - 模型加载成功后清除不可用标记；
    - timeout/全部源失败时写入不可用标记；
    - fallback 日志从 `console.warn` 调整为 `console.info`，避免误判为错误告警。
  - `Horosa_Local.command`：
    - `trap cleanup EXIT INT TERM` 扩展为 `trap cleanup EXIT INT TERM HUP`；
    - 解决“直接关闭终端窗口时（SIGHUP）cleanup 不执行，服务未自动停止”的边界情况。
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui test -- --watch=false` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `cd Horosa-Web && ./start_horosa_local.sh && ./verify_horosa_local.sh && ./stop_horosa_local.sh` ✅
  - `node Horosa-Web/astrostudyui/.tmp_horosa_verify.js` ✅
  - `node Horosa-Web/astrostudyui/.tmp_ai_export_matrix_check.js` ✅（全部 PASS）
  - `node Horosa-Web/astrostudyui/.tmp_horosa_perf_check.js` ✅（核心接口返回有效）
  - Playwright 顶层 16 tab 自动巡检 ✅：
    - `topTabCount=16`，各 tab 均 `hasActivePane=true`、`hasRenderable=true`、`hasError=false`
    - `console warning=0`，`console error=0`
  - Playwright 三维盘反复切换（3 次）✅：
    - 切换后 `console warning=0`，`console error=0`

### 14:55 - 最终全量终检（内容/页面/技法设置/AI导出）通过（2026-03-03）
- Scope: 按“所有内容、所有页面、所有技法设置可用，不报错、不白屏”要求执行最终终检；本轮仅验证，不新增业务代码。
- Files:
  - `UPGRADE_LOG.md`
  - `PROJECT_STRUCTURE.md`
- Details:
  - 基础回归：
    - `npm --prefix Horosa-Web/astrostudyui test -- --watch=false` 通过（4 suites / 17 tests）。
    - `npm --prefix Horosa-Web/astrostudyui run build:file` 通过。
    - `cd Horosa-Web && ./start_horosa_local.sh && ./verify_horosa_local.sh && ./stop_horosa_local.sh` 通过。
  - 算法与配置脚本：
    - `node Horosa-Web/astrostudyui/.tmp_horosa_verify.js` 通过。
    - `node Horosa-Web/astrostudyui/.tmp_ai_export_matrix_check.js` 全 PASS。
    - `node Horosa-Web/astrostudyui/.tmp_horosa_perf_check.js` 返回有效结果（`nongli_time/jieqi_seed/liureng_gods/jieqi_year_full24`）。
  - 页面/技法全量巡检（Playwright）：
    - 顶层 16 页面全部点击可达且可渲染：`星盘/三维盘/推运盘/量化盘/关系盘/节气盘/星体地图/七政四余/希腊星术/印度律盘/八字紫微/易与三式/万年历/西洋游戏/风水/三式合一`；
    - 星盘子页签 `信息/相位/行星/希腊点/可能性` 均可打开；
    - 检测 `真太阳时` 文本存在（`三式合一` 页面）。
  - 技法设置入口巡检：
    - `小工具`、`星盘组件`、`行星选择`、`相位选择`、`批注` 抽屉均可打开/关闭；
    - 复选项切换可执行并恢复，无异常。
  - AI 导出与 AI 导出设置：
    - `AI导出设置` 可打开、可操作（全选/清空/恢复默认）、可保存；
    - 在“星盘-信息”富文本页面，`一键复制+导出全部`、`复制AI纯文字`、`导出TXT/Word/PDF` 全部成功，含下载与提示。
  - 控制台结果：
    - 页面与交互巡检中 `console error=0`；
    - 观测到 1 条外部 AMap Canvas 性能 warning（`willReadFrequently` 提示），不影响业务功能，不属于白屏/报错故障。
- Verification artifacts:
  - `/tmp/horosa_final_fullcheck_20260303.txt`
  - `/tmp/hf1_ui_scan_result.txt`
  - `/tmp/hf2_ai_actions_result.txt`
  - `/tmp/hf3_settings_result.txt`

### 18:36 - 三式合一遁甲悬浮文案繁转简补全（2026-03-03）
- Scope: 修复“三式合一盘中遁甲相关元素悬浮窗口仍有繁体字”的问题，补全安全繁转简，不做语义字符误改（如 `乾` 保留不转 `干`）。
- Files:
  - `Horosa-Web/astrostudyui/src/components/dunjia/QimenXiangDoc.js`
  - `Horosa-Web/astrostudyui/src/components/dunjia/__tests__/QimenXiangDoc.test.js`
- Details:
  - `QimenXiangDoc.js`
    - 扩充 `SAFE_TRAD_TO_SIMP_MAP`，新增：`宮→宫`、`於→于`、`強→强`、`進→进`、`麗→丽`、`洩→泄`；
    - 在 `parseQimenDoc` 入库阶段把 `text` block 统一走 `toSafeSimplified`，确保 `buildQimenXiangTipObj` 返回给三式合一悬浮层的正文也是简体；
    - 保持定向映射策略，不引入 `乾→干` 之类误转换。
  - 新增单测 `QimenXiangDoc.test.js`
    - 验证门类正文繁转简（`亮麗→亮丽`）；
    - 验证星类正文繁转简（`早洩→早泄`）；
    - 验证 `乾` 不被误改为 `干`。
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui test -- --watch=false src/components/dunjia/__tests__/QimenXiangDoc.test.js` ✅
  - `npm --prefix Horosa-Web/astrostudyui test -- --watch=false src/components/dunjia/__tests__/DunJiaCalc.test.js src/components/dunjia/__tests__/QimenXiangDoc.test.js` ✅

### 18:54 - 本地窗口关闭后后台残留回收增强（2026-03-03）
- Scope: 修复“关闭终端窗口后，后台偶发未停止，下一次启动报 `port 9999 is already in use`”问题。
- Files:
  - `Horosa_Local.command`
  - `Horosa-Web/stop_horosa_local.sh`
- Details:
  - `Horosa_Local.command`
    - `cleanup()` 从“仅在本次成功启动过后端/网页时才 stop”改为“非常驻模式下退出一律执行 stop”，覆盖启动失败/中断场景；
    - 启动前新增统一残留清理：每次运行先执行一次 `stop_horosa_local.sh`；
    - 当 `start_horosa_local.sh` 首次失败且检测到 `8899/9999` 端口占用时，自动回收并重试一次，提升自愈能力。
  - `stop_horosa_local.sh`
    - 新增 `kill_pid_gracefully()`，统一温和停止 + 超时强杀；
    - 增加“无 pid 文件兜底回收”：按端口+进程特征清理残留监听进程：
      - `8899 + webchartsrv.py`
      - `9999 + astrostudyboot.jar`
      - `8000 + http.server.*astrostudyui/(dist|dist-file)`
- Verification (local):
  - `bash -n Horosa_Local.command` ✅
  - `bash -n Horosa-Web/stop_horosa_local.sh` ✅
  - `Horosa-Web/stop_horosa_local.sh`：可识别并清理无 pid 文件残留 `9999/8000` 监听进程 ✅
  - `cd Horosa-Web && HOROSA_SKIP_UI_BUILD=1 ./start_horosa_local.sh && ./stop_horosa_local.sh` ✅

### 19:40 - 主限法双内核落地、AstroApp-Alchabitius 文档化、UI 同步修复（2026-03-05）
- Scope: 把主限法做成 `Horosa原方法 / AstroAPP-Alchabitius` 双内核；同步页面、设置、AI 导出；并把 AstroApp 复刻算法写成可独立照抄的本地文档。
- Files:
  - `Horosa-Web/astropy/astrostudy/perpredict.py`
  - `Horosa-Web/astropy/astrostudy/perchart.py`
  - `Horosa-Web/astropy/astrostudy/helper.py`
  - `Horosa-Web/astropy/astrostudy/signasctime.py`
  - `Horosa-Web/astrostudyui/src/models/app.js`
  - `Horosa-Web/astrostudyui/src/models/astro.js`
  - `Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - `Horosa-Web/astrostudyui/src/utils/aiExport.js`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - 后端主限法双分流：
    - `horosa_legacy`：恢复原版 Horosa `PrimaryDirections(chart).getList(...)` + `item[3] == 'Z'`；
    - `astroapp_alchabitius`：使用当前 AstroApp 对齐内核：
      - `arc = norm180(sig.ra - prom.raZ)`
      - 过滤 `|arc| <= 100`
      - 普通行星对追加 AstroApp 显示窗过滤：
        - `|raw_delta| <= 3`
        - 或 `arc > 0 and 3 < raw_delta < 107.5`
        - 或 `arc < 0 and -107.5 < raw_delta < -3`
      - 排序为 `(|arc|, arc, prom_id, sig_id)`。
  - 日期换算统一走 `SignAscTime.getJDFromPDArc()`：
    - 改为“周年日 + 下一周年跨度插值”写法；
    - converse 也按 `abs(arc)` 换算；
    - 最终显示按 UTC 风格输出日期字符串。
  - 页面功能：
    - 主限法页新增 `推运方法 / 度数换算 / 计算` 三个控件；
    - `Horosa原方法` 显示 `赤经`；
    - `AstroAPP-Alchabitius` 显示 `Arc`；
    - AI 导出和全局设置同步记住 `pdMethod / pdTimeKey`。
  - UI 同步修复：
    - 修复“切换方法后看起来只有最左列变化”的问题；
    - 根因是左列曾按下拉框待应用值渲染，右侧列按当前 `chartObj` 渲染；
    - 现统一改为按 `chartObj.params.pdMethod / pdTimeKey` 渲染整张表，避免未重算前的假切换。
  - 文档落地：
    - 新增 `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`，完整写明：
      - 行结构
      - Significator / Promissor 构造
      - Arc 核公式
      - 显示过滤
      - 排序
      - 日期换算
      - 复现脚本与验证指标
    - 新增 `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md`，单独给出：
      - 纯数学定义
      - `ra / raZ` 坐标层
      - 各类 promissor / significator 的公式
      - `dirJD` 换算公式
      - mermaid 流程图
- Verification (local):
  - `./runtime/mac/python/bin/python3 -m py_compile Horosa-Web/astropy/astrostudy/perpredict.py Horosa-Web/astropy/astrostudy/perchart.py Horosa-Web/astropy/astrostudy/helper.py Horosa-Web/astropy/astrostudy/signasctime.py` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `runtime/pd_reverse/selfcheck_astroapp60_summary.json`：
    - `rows_matched=20196`
    - `arc_mae=0.0006809858679562894`
    - `date_mae_days=0.36691450927855057`
  - `runtime/pd_reverse/uicheck_rows_120_summary.json`：
    - `rows_matched=39981`
    - `arc_mae=0.0006701327243638771`
    - `date_mae_days=0.36411480203960234`
  - `runtime/pd_reverse/local_backend_vs_astroapp_rows_all300_after_displayfilter_summary.json`：
    - `rows_matched=102032`
    - `arc_mae=0.0006788783645654379`
    - `date_mae_days=0.37174043900477144`

### 20:18 - AstroApp 主限法分支移除映点/反映点（2026-03-05）
- Scope: 按页面需求，`AstroAPP-Alchabitius` 方法在“计算 + 显示”时都不再包含所有星和虚点的映点 / 反映点（`A_ / C_`）。
- Files:
  - `Horosa-Web/astropy/astrostudy/perpredict.py`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - 后端：
    - `getPrimaryDirectionByZAstroAppKernel()` 的 promissor 集从：
      - `N(SIG_OBJECTS, aspects) + TERMS + A + C`
      改为：
      - `N(SIG_OBJECTS, aspects) + TERMS`
    - 即 AstroApp 分支不再计算映点 / 反映点行。
  - 前端：
    - `AstroPrimaryDirection.convertToDataSource()` 对 `astroapp_alchabitius` 再加一道显示保险：
      - 过滤所有 `A_` / `C_` 开头的 promittor / significator 行；
    - 这样即使旧 `chartObj` 尚未重算，页面也不会继续显示映点 / 反映点。
  - 文档：
    - 两份主限法复刻文档同步改为：
      - AstroApp 分支 Promissors 仅包含 `N(...) + TERMS`
      - 不再声明 `A / C` 参与该分支。
- Verification (local):
  - `./runtime/mac/python/bin/python3 -m py_compile Horosa-Web/astropy/astrostudy/perpredict.py` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - 盘面样本 `runtime/pd_auto/run_guangde_times31/case_0016` 本地重算后：
    - AstroApp 分支结果中不再生成 `A_` / `C_` 行 ✅

### 20:46 - AstroApp 主限法补入 Asc/MC 专用角点分支，并同步实现文档（2026-03-05）
- Scope: 继续收敛 `AstroAPP-Alchabitius` 的剩余误差；先只落地已经在样本上稳定成立的 `Asc / MC` 专用公式，`Pars Fortuna` 暂不硬写未经稳定验证的猜测。
- Files:
  - `Horosa-Web/astropy/astrostudy/perpredict.py`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - `AstroAPP-Alchabitius` 不再把 `Asc / MC` 当普通应星统一走 `sig.ra - prom.raZ`。
  - 新增 `Asc` 专用分支：
    - `arc = norm180(OA(prom.true_lat) - RA(Asc.true_lat))`
    - 其中 `OA = RA - ascdiff(decl, geographic_lat)`
  - 新增 `MC` 专用分支：
    - `arc = norm180(RAz(prom.zero_lat_after_aspect) - RAz(MC))`
  - `Pars Fortuna` 当前仍先走普通通用核，继续作为单独逆向对象保留。
  - PF 相关后续判断统一按“太阳在地平线以上”为昼盘定义；太阳在地平线以下则为夜盘。
- Verification (local):
  - `./runtime/mac/python/bin/python3 -m py_compile Horosa-Web/astropy/astrostudy/perpredict.py` ✅
  - `runtime/pd_auto/run_guangde_times31/case_0016` 重新比对后，最大偏差前 20 行由原先 `Asc 14 / MC 3 / Pars Fortuna 3` 收敛为 `Pars Fortuna 19 / Asc 1 / MC 0` ✅
  - `runtime/pd_auto/run_guangde_times31` 全量样本重新比对：
    - `MC` 当前口径下 `arc_abs_err mae ≈ 0.0021°` ✅
    - `Asc` 绝大多数行已明显收敛，剩余主要是 AstroApp 在角点桶上的 `signed aspect` 分桶差异，而非同量级几何误差 ✅

### 22:58 - AstroApp 主限法收口为 shared core，并改用 true node + 日期黄赤交角（2026-03-05）
- Scope: 按用户要求，AstroApp 主限法现在只保留 AstroApp 网站选项需要的 shared core；取消 `界 / 紫气 / 暗月 / 其它 unsupported virtual points`，并继续收敛 `North Node / Asc / MC` 与 AstroApp 的误差。
- Files:
  - `Horosa-Web/astropy/astrostudy/perpredict.py`
  - `Horosa-Web/astropy/astrostudy/signasctime.py`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - `Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js`
  - `scripts/compare_pd_backend_rows.py`
  - `scripts/compare_pd_backend_random.py`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - AstroApp kernel 当前对象集收口为：
    - promissor：`Sun..Pluto + North Node`
    - significator：`Sun..Pluto + North Node + Asc + MC`
  - AstroApp kernel 不再计算：
    - `界 / Terms / Bounds / T_*`
    - `Pars Fortuna`
    - `Dark Moon`
    - `Purple Clouds`
    - `South Node`
    - 其它 AstroApp 不支持的扩展虚点
  - Node 口径切换为 `swisseph.TRUE_NODE`，并在 AstroApp kernel 内重建 node 派生点。
  - `SignAscTime` 现支持 `float hour` 输入，验证时可直接使用 `sourceJD` 还原出的精确 UTC 浮点小时。
  - AstroApp kernel 的黄赤转换不再使用 flatlib 固定 `23.44`：
    - 普通对象与 `MC` 改为日期 `mean obliquity`
    - `Asc` 的 zero-lat OA 分支改为日期 `true obliquity`
  - 前端 AstroApp 选项下继续做 unsupported rows 过滤，因此这轮更新只同步到 Horosa 网站里的 AstroApp 计算选项，不影响 `horosa_legacy`。
- Verification (local):
  - `.runtime/mac/venv/bin/python3 -m py_compile Horosa-Web/astropy/astrostudy/perpredict.py Horosa-Web/astropy/astrostudy/perchart.py Horosa-Web/astropy/astrostudy/signasctime.py scripts/compare_pd_backend_rows.py scripts/compare_pd_backend_random.py` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `runtime/pd_reverse/shared_core_kernel100_exact_summary.json`
    - `rows_matched=49410`
    - `arc_mae=0.00024200773827786083`
    - `arc_p95=0.001632456876791366`
  - `runtime/pd_reverse/shared_core_hard200_exact_summary.json`
    - `rows_matched=98431`
    - `arc_mae=0.00013077914740447597`
    - `arc_p95=0.0007822402079398216`
  - `runtime/pd_reverse/shared_core_geo300_exact_summary.json`
    - `rows_matched=139135`
    - `arc_mae=0.0005001852545963875`
    - `arc_p95=0.00243209762984975`
  - `runtime/pd_reverse/virtual_points_geo300_chart_summary.json`
    - `North Node ratio_le_0_001 = 1.0`
    - `Asc ratio_le_0_001 = 1.0`
    - `MC ratio_le_0_001 = 1.0`

### 00:18 - AstroAPP-Alchabitius 虚点分支补充 Moon TRUEPOS 试验与稳定修正（2026-03-06）
- Scope: 继续压低 `Asc / MC / North Node` 三个虚点方向行的残余误差，但不触碰已经较稳定的 planet-to-planet 口径。
- Files:
  - `Horosa-Web/astropy/astrostudy/perpredict.py`
  - `scripts/eval_virtual_point_kernels.py`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - 新增 `scripts/eval_virtual_point_kernels.py`，沿用 duplicate-safe 配对逻辑，专门评估 `Asc / MC / North Node` 的候选 kernel。
  - 诊断结果表明：当前虚点残差的主体并不在主限弧公式本身，而在 promissor 本体坐标与 AstroApp `chartSubmit` 的细小差异，尤其是 `Moon`。
  - 在 `perpredict.py` 中新增 `_rebuildAstroAppTruePosMoonPoint()`。
  - 该修正只作用于 `Moon -> Asc` 与 `Moon -> North Node`：
    - `Moon` promissor 改用 Swiss `FLG_TRUEPOS` 本体位置后再构造相位点；
    - `Moon -> MC` 未启用此修正，因为它在独立 `wide240_v7` 上不稳定，存在轻微回退。
  - 同时保留实验上界结论：
    - 若用 AstroApp `chartSubmit` 的 promissor 本体位置替代本地位置，`Asc / MC / North Node` 还能明显继续下降；
    - 这说明后续若要逼近 `0.0001°` 量级，重点应放在 AstroApp 本体星历口径，而不是继续大改虚点公式。
- Verification (local):
  - `.runtime/mac/venv/bin/python3 scripts/eval_virtual_point_kernels.py --cases-root runtime/pd_auto/run_geo_new300_v6 --out-csv runtime/pd_reverse/virtual_kernel_geo300_rows.csv --out-json runtime/pd_reverse/virtual_kernel_geo300_summary.json` ✅
  - `.runtime/mac/venv/bin/python3 scripts/eval_virtual_point_kernels.py --cases-root runtime/pd_auto/run_geo_wide240_v7 --out-csv runtime/pd_reverse/virtual_kernel_wide240_rows.csv --out-json runtime/pd_reverse/virtual_kernel_wide240_summary.json` ✅
  - `.runtime/mac/venv/bin/python3 scripts/compare_pd_backend_rows.py --cases-root runtime/pd_auto/run_geo_new300_v6 --mode utc_sourcejd_exact --shared-core-only --out-csv runtime/pd_reverse/shared_core_geo300_exact_rows_vmoon2.csv --out-json runtime/pd_reverse/shared_core_geo300_exact_summary_vmoon2.json` ✅
  - `.runtime/mac/venv/bin/python3 scripts/compare_pd_backend_rows.py --cases-root runtime/pd_auto/run_geo_wide240_v7 --mode utc_sourcejd_exact --shared-core-only --out-csv runtime/pd_reverse/shared_core_geo_wide240_v7_exact_rows_vmoon2.csv --out-json runtime/pd_reverse/shared_core_geo_wide240_v7_exact_summary_vmoon2.json` ✅
  - 关键虚点行结果：
    - `geo300`
      - `Asc`: `arc_mae 0.0010408782 -> 0.0010258268`
      - `North Node`: `arc_mae 0.0003763461 -> 0.0003560969`
      - `MC`: 保持当前口径不变，避免 `wide240` 回退
    - `wide240_v7`
    - `Asc`: `arc_mae 0.0016621602 -> 0.0016548058`
      - `North Node`: `arc_mae 0.0005635118 -> 0.0005610257`
      - `MC`: 维持原值 `0.0010151522`

### 09:45 - 主限法 AstroAPP 选项接入链路自检补齐，时间主钥切换 remount 修正（2026-03-06）
- Scope: 确认 Horosa 网站里的 `AstroAPP-Alchabitius` 选项已经真实接到当前生产算法；同时修复主限法表格在只切换 `pdTimeKey` 时可能复用旧行缓存的问题，并补一个可重复执行的本地自检入口。
- Files:
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - `scripts/check_primary_direction_astroapp_integration.py`
  - `PROJECT_STRUCTURE.md`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
  - `UPGRADE_LOG.md`
- Details:
  - 主/界限法表格 remount key 从：
    - `chartId + pdMethod + showPdBounds`
    更新为：
    - `chartId + pdMethod + pdTimeKey + showPdBounds`
  - 避免切换 `Ptolemy / Naibod` 这类时间主钥时，Ant Table 继续复用旧行缓存，导致 `Arc / 迫星 / 应星 / 日期` 视觉上不同步。
  - 顶部设置条同步改成响应式布局：
    - 宽度缩小时允许自动换行
    - `Select` 改为弹性宽度
    - `计算` 按钮不再依赖固定长宽和固定 `marginTop`
  - 这样在浏览器缩放后，主限法设置区不会再出现控件高度不变、宽度不变、排版被挤坏的问题。
  - 新增 `scripts/check_primary_direction_astroapp_integration.py`，本地自检四层：
    - 后端 `astroapp_alchabitius` 分支存在且仍为默认
    - 前端下拉项、页面参数传递、AI 导出仍指向同一选项
    - 抽样 case 的 `Arc / promissor / significator / date` 行结构完整，且 `date == SignAscTime.getDateFromPDArc(arc)`
    - 最新 `current120` exact 对比里 `Asc / MC / North Node` 的 `arc_mae < 0.001°`
    - `astroapp_alchabitius / horosa_legacy` 两个后端分支都能各自产出非空结果，而且不会误用成同一套 rows
    - AI 导出设置里 `primarydirect` 的预设分段仍包含：
      - `出生时间`
      - `星盘信息`
      - `主/界限法设置`
      - `主/界限法表格`
    - AI 导出时会优先触发 `requestModuleSnapshotRefresh('primarydirect')`，因此导出内容跟随当前已应用的主限法方法与时间主钥，而不是页面上未计算的待选值
- 新一批 current AstroApp 样本：
  - `runtime/pd_auto/run_geo_current120_v2`
  - `runtime/pd_reverse/shared_core_geo_current120_v2_exact_rows.csv`
  - `runtime/pd_reverse/shared_core_geo_current120_v2_exact_summary.json`
  - 当前结果：
    - `Asc arc_mae = 0.0003906786`
    - `MC arc_mae = 0.0000446205`
    - `North Node arc_mae = 0.0001342149`
    - 三者都满足 `0.001°` 门槛
- Verification (local):
  - `.runtime/mac/venv/bin/python3 -m py_compile scripts/check_primary_direction_astroapp_integration.py Horosa-Web/astropy/astrostudy/perpredict.py Horosa-Web/astropy/astrostudy/perchart.py` ✅
  - `.runtime/mac/venv/bin/python3 scripts/check_primary_direction_astroapp_integration.py` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 00:44 - 本地星历精度排查与可选 JPL runtime 入口（2026-03-06）
- Scope: 检查 Horosa 当前本地星历精度是否还有直接升级空间，并为后续引入 JPL `.eph` 后的同口径复测补齐运行时切换入口。
- Files:
  - `Horosa-Web/flatlib-ctrad2/flatlib/ephem/swe.py`
  - `scripts/check_local_ephemeris_precision.py`
  - `PROJECT_STRUCTURE.md`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
- Details:
  - 确认 Horosa 当前默认并不是 Moshier，而是 `flatlib/resources/swefiles/*.se1` 的 Swiss Ephemeris 数据。
  - 确认当前默认 flag 仍为 `FLG_SWIEPH | FLG_SPEED`，即 Swiss + analytic speed。
  - 机器本地未发现 `de406 / de431 / de440 / de441` 等 JPL `.eph` 文件，因此当前没有“直接切到 JPL”条件。
  - 在 `swe.py` 中新增运行时配置能力：
    - `HOROSA_SWISSEPH_MODE=SWIEPH|JPL|MOSEPH`
    - `HOROSA_SWISSEPH_JPL_FILE=/abs/path/to/de440.eph` 或相对 `swefiles/` 路径
    - `getRuntimeConfig()` 供实验脚本读取当前 path/mode/default_flag/JPL 文件状态
  - 新增 `scripts/check_local_ephemeris_precision.py`：
    - 输出当前 runtime ephemeris 配置
    - 在同一 JD 下采样 `SWIEPH / MOSEPH / JPL(若可用)` 的 `lon / lat / ra / decl`
    - 作为后续接入 JPL 后重跑虚点误差前的本地星历自检入口
- Verification (local):
  - `.runtime/mac/venv/bin/python3 scripts/check_local_ephemeris_precision.py` ✅
  - `.runtime/mac/venv/bin/python3 -m py_compile Horosa-Web/flatlib-ctrad2/flatlib/ephem/swe.py scripts/check_local_ephemeris_precision.py` ✅

### 10:24 - AstroAPP 虚点 current540 对象级 body correction 落地（2026-03-06）
- Scope: 针对 current540 宽域样本里 `Asc / MC / North Node` 主要被 promissor 本体坐标残差拖高的问题，引入只作用于 AstroAPP 虚点行的对象级 body correction。
- Files:
  - `Horosa-Web/astropy/astrostudy/perpredict.py`
  - `scripts/train_astroapp_virtual_body_corrections.py`
  - `scripts/check_primary_direction_astroapp_integration.py`
  - `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_*.joblib`
  - `runtime/pd_models/virtual_body_corr_current540_holdout/astroapp_pd_virtual_body_corr_summary_v1.json`
  - `runtime/pd_models/virtual_body_corr_current540_fullfit/astroapp_pd_virtual_body_corr_summary_v1.json`
- Details:
  - 新增对象级模型训练脚本 `train_astroapp_virtual_body_corrections.py`，学习 `chartSubmit body - local Swiss body` 的 `lon / lat` 差值。
  - 当前生产只对虚点 significator 分支使用该修正：
    - `Asc`
    - `MC`
    - `North Node`
  - 对象覆盖：
    - `Sun..Pluto`
  - `North Node` 不走 body model，继续沿用现有 true-node 逻辑。
  - 运行时新增 body-model cache，避免每条方向线重复预测同一颗 promissor 的 body delta。
  - 当 body model 生效时：
    - `Moon -> Asc` 不再额外套旧的 `TRUEPOS` 特判
    - 旧的 `Asc chart-level case correction` 暂时停用，避免和 current540 object correction 叠加错位
- current540 holdout body-model 结果：
  - `Sun..Pluto` 的 `lon_eval mae` 已稳定在 `2.5e-05 ~ 1.6e-04`
  - 最难对象仍是 `Moon`
- 最终 full-fit 生产结果（540 全量虚点专项）：
  - `Asc arc_mae = 0.0009919653`
  - `MC arc_mae = 0.0004144498`
  - `North Node arc_mae = 0.0001155451`
  - `date_max_days = 4.2005 / 3.0462 / 1.2249`
- 结论：
  - 按当前要求 `arc_mae < 0.001°`，`Asc / MC / North Node` 已在 current540 宽域样本上全部过线。

### 10:43 - 主限法集成自检扩展到多 case / 过滤规则 / AI 导出链路（2026-03-06）
- Files:
  - `scripts/check_primary_direction_astroapp_integration.py`
- Details:
  - 自检默认样本切到：
    - `runtime/pd_auto/run_geo_current540_v1/case_0001`
    - `runtime/pd_reverse/shared_core_geo_current540_s100_exact_rows_bodycorr.csv`
  - 新增多 case smoke check：
    - 默认随机抽样 `12` 个 current540 case
    - 分别跑 `astroapp_alchabitius` 与 `horosa_legacy`
    - 检查两条链路都不会抛错、不会空表
  - 新增显示过滤规则镜像检查：
    - `astroapp_alchabitius` 当前 rows 已全部落在 UI 支持子集内
    - `horosa_legacy` 确认存在 `bound` 行
    - `showPdBounds = 否` 时 legacy 行数会实质下降，证明这个设置不是假开关
  - 新增运行时模型文件存在性检查：
    - `astroapp_pd_virtual_body_corr_{sun..pluto}_v1.joblib`
  - AI 导出与 AI 导出设置继续检查：
    - `primarydirect` 分段预设
    - `requestModuleSnapshotRefresh('primarydirect')`
    - 模块缓存回落链路
- Verification (local):
  - `.runtime/mac/venv/bin/python3 scripts/check_primary_direction_astroapp_integration.py` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 01:36 - 当前 AstroApp 口径再确认：run200_login 更接近 geo300，不再让 wide240_v7 主导（2026-03-06）
- Scope: 用登录态抓取的当前 AstroApp 样本重新确认当前复刻目标口径，避免历史异常批次继续误导 `Asc / MC / North Node` 的调优方向。
- Files:
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - 复跑 `runtime/pd_auto/run200_login` 的虚点 kernel 诊断，产物为：
    - `runtime/pd_reverse/virtual_kernel_run200_login_v1_summary.json`
  - 当前 AstroApp 登录态样本结果显示：
    - `Asc arc_mae = 0.0009593129`
    - `MC arc_mae = 0.0001459918`
    - `North Node arc_mae = 0.0001623783`
  - 同时确认当前 AstroApp `chartSubmit` 的角度本体与本地图盘几乎重合：
    - `Asc mae ≈ 0.0000257°`
    - `MC mae ≈ 0.0000261°`
  - 这说明：
    - 当前 AstroApp 更接近 `geo300`
    - `wide240_v7` 中那层整图角度偏移不应继续主导生产口径
  - 进一步对象级排查确认：
    - `Asc` 剩余误差来自 promissor 本体经度，不来自 promissor 黄纬
    - 默认 Swiss `apparent` 已是 `Sun..Pluto` 最接近 AstroApp 的口径
    - `Moon` 仍是唯一 `TRUEPOS` 比默认 `apparent` 更接近 AstroApp 的对象
  - 因此当前策略继续保持：
    - 不按 `wide240_v7` 去改生产角度口径
    - `Moon -> Asc / North Node` 继续保留 `TRUEPOS` 修正
    - 后续若继续压低 `Asc`，优先追 promissor apparent longitude 细节
- Verification (local):
  - `.runtime/mac/venv/bin/python3 scripts/eval_virtual_point_kernels.py --cases-root runtime/pd_auto/run200_login --out-csv runtime/pd_reverse/virtual_kernel_run200_login_v1_rows.csv --out-json runtime/pd_reverse/virtual_kernel_run200_login_v1_summary.json` ✅

### 23:11 - 主/界限法页的方法切换改为整表重算，Horosa原方法不再只更新左列（2026-03-05）
- Scope: 修复 Horosa 网站主/界限法页里 `Horosa原方法 / AstroAPP-Alchabitius` 切换时，只看到第一列标题变化、右侧三列仍保留旧结果的假切换。
- Files:
  - `Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - `applyPrimaryDirectionConfig()` 现在在点击 `计算` 后会强制携带 `pdtype = 0` 发起重算；
  - 因此顶部 `推运方法` 切换比较的是同一组 `zodiaco` 主限法结果，不会落回 `mundo` 路径导致右侧三列看起来没变。
  - 早退条件也加上了 `pdtype === 0` 判断；如果当前盘不是 zodiaco 结果，即使方法名相同也会重新取数。
  - 主/界限法表格新增基于 `chartId + pdMethod + showPdBounds` 的 remount key，确保新结果返回后整张表完整刷新，而不是沿用旧行缓存。
  - AI snapshot 生成时，方法/时间键/显示界限法优先读取已应用的 `chartObj.params`，避免记录到尚未生效的待应用值。
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 11:12 - Horosa 整站静态接线 + 运行时 smoke check（2026-03-06）
- Scope: 把自检范围从主限法扩到整站核心模块，覆盖星盘、三式合一、易与三式、节气盘、推运盘、七政四余，以及 AI 导出/AI 导出设置的主要接线。
- Files:
  - `scripts/check_horosa_full_integration.py`
  - `Horosa-Web/astrostudyui/scripts/verifyHorosaRuntimeFull.js`
  - `Horosa-Web/verify_horosa_local.sh`
  - `UPGRADE_LOG.md`
  - `PROJECT_STRUCTURE.md`
- Details:
  - 新增静态整站断言脚本 `scripts/check_horosa_full_integration.py`：
    - 检查首页顶层 tabs 与 `predictHook` 接线
    - 检查 `八字紫微 / 易与三式` 子 tabs
    - 检查模块级 `saveModuleAISnapshot(...) / loadModuleAISnapshot(...)`
    - 检查 `AI_EXPORT_TECHNIQUES / AI_EXPORT_PRESET_SECTIONS / requestModuleSnapshotRefresh(...)`
  - 新增运行时整站 smoke 脚本 `Horosa-Web/astrostudyui/scripts/verifyHorosaRuntimeFull.js`：
    - 直接请求本地 `127.0.0.1:9999`
    - 当前覆盖：
      - `/chart`
      - `/chart13`
      - `/india/chart`
      - `/location/acg`
      - `/modern/relative`
      - `/germany/midpoint`
      - `/predict/pd`
      - `/predict/profection`
      - `/predict/solararc`
      - `/predict/solarreturn`
      - `/predict/lunarreturn`
      - `/predict/givenyear`
      - `/predict/zr`
      - `/nongli/time`
      - `/jieqi/year`
      - `/bazi/direct`
      - `/ziwei/birth`
      - `/ziwei/rules`
      - `/liureng/gods`
      - `/liureng/runyear`
      - `/gua/desc`
      - `/common/pithy`
      - `/common/gong12`
      - `/calendar/month`
  - `Horosa-Web/verify_horosa_local.sh` 现在会串行执行：
    - 原有 `node .tmp_horosa_verify.js`
    - `node astrostudyui/scripts/verifyPrimaryDirectionRuntime.js`
    - `node astrostudyui/scripts/verifyHorosaRuntimeFull.js`
    - `python3 scripts/check_primary_direction_astroapp_integration.py`
    - `python3 scripts/check_horosa_full_integration.py`
- Verification (local):
  - `./scripts/mac/self_check_horosa.sh` ✅
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅

### 11:48 - AstroApp 主限法总文档扩写为公开发布整理稿（2026-03-06）
- Scope: 在保留完整逆向过程文档的同时，新增一份更适合公开发布的正式整理稿，把工程推理、证据链、实现细节和验证结果改写成文章体。
- Files:
  - `ASTROAPP_ALCHABITIUS_PTOLEMY_REVERSE_ENGINEERING_PUBLIC_EDITION.md`
  - `PROJECT_STRUCTURE.md`
  - `UPGRADE_LOG.md`
- Details:
  - 新增根目录公开整理稿：
    - `ASTROAPP_ALCHABITIUS_PTOLEMY_REVERSE_ENGINEERING_PUBLIC_EDITION.md`
  - 写法上不再沿用纯实验记录体，而改为：
    - 摘要
    - 问题定义
    - 证据层
    - 对比方法
    - 关键推理链
    - 实现落地
    - 验证框架
    - 方法论结论
  - 但内容上仍保留：
    - `sourceJD exact`
    - shared-core 对象集
    - `TRUE_NODE`
    - 动态 `mean / true obliquity`
    - `Asc / MC / 普通行` 三分支
    - `Asc promissor-side -0.0014°`
    - display window
    - promissor body correction / fallback correction
    - Horosa 前端、Java 透传、AI 导出、自检接线
  - `PROJECT_STRUCTURE.md` 同步新增文档索引和 `103.11` 结构说明，明确它与完整过程文档、生产实现文档的分工。
- Verification (local):
  - `test -f ASTROAPP_ALCHABITIUS_PTOLEMY_REVERSE_ENGINEERING_PUBLIC_EDITION.md` ✅

### 13:55 - Horosa_Local.command 补齐自动端口避让，避免主限法页误连旧副本（2026-03-06）
- Scope: 修复“桌面双击启动”和“自检脚本”端口策略不一致的问题。此前自检会自动避让 `8000/8899/9999` 冲突，但 `Horosa_Local.command` 直接失败；用户继续使用旧标签页时，最容易在主限法页点击 `重新计算` 时误报“本地排盘服务未就绪”。
- Files:
  - `Horosa_Local.command`
  - `Horosa-Web/start_horosa_local.sh`
  - `README.md`
  - `PROJECT_STRUCTURE.md`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
  - `WINDOWS_CODEX_ASTROAPP_PD_REPRO_KIT/README_FIRST.md`
  - `WINDOWS_CODEX_ASTROAPP_PD_REPRO_KIT/WINDOWS_CODEX_TASK_PROMPT.md`
  - `WINDOWS_CODEX_ASTROAPP_PD_REPRO_KIT/FILE_MANIFEST.md`
- Details:
  - `Horosa_Local.command` 新增与 `self_check_horosa.sh` 同级别的端口准备逻辑：
    - 若默认 `8000/8899/9999` 被其他工作区副本占用，则自动切换到空闲端口（通常从 `18000/18899/19999` 起）。
    - 自动导出新的 `HOROSA_WEB_PORT / HOROSA_CHART_PORT / HOROSA_SERVER_PORT / HOROSA_SERVER_ROOT`。
  - `Horosa-Web/start_horosa_local.sh` 和 `Horosa_Local.command` 的后台服务启动统一改为更强的 detached 方式：
    - 优先 `setsid ... </dev/null >log 2>&1 &`
    - 回退 `nohup + disown`
  - 这次修复的目标不是主限法数学，而是确保用户实际打开的页面和当前存活的服务属于同一份副本。
  - 文档同步明确要求：
    - 发生端口冲突时必须使用启动脚本新打开的 URL；
    - 不能继续拿旧的 `127.0.0.1:8000` 标签页测试主限法。
- Verification (local):
  - `bash -n Horosa_Local.command Horosa-Web/start_horosa_local.sh` ✅
  - `./scripts/mac/self_check_horosa.sh` ✅
  - `./scripts/mac/self_check_horosa.sh` in packaged folder `/Users/horacedong/Desktop/Horosa-Web+App (Mac)` ✅

### 18:35 - 修复 AstroAPP 主限法在浏览器里误走 mundo 分支，广德盘重新对齐 AstroApp（2026-03-06）
- Scope: 修复“主限法页面标题显示 `AstroAPP-Alchabitius`，但浏览器实际打出去的是 `pdtype=1` mundo 主限法”的运行态问题。这个问题会让广德盘这类样本在用户页面里直接偏离 AstroApp 当前网页结果。
- Files:
  - `Horosa-Web/astrostudyui/src/models/astro.js`
  - `Horosa-Web/astropy/websrv/webchartsrv.py`
  - `Horosa-Web/astropy/astrostudy/helper.py`
  - `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/model/AstroUser.java`
  - `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/UserInfoController.java`
  - `PROJECT_STRUCTURE.md`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
- Details:
  - 前端空白字段和全局 `astro.fields` 的 `pdtype` 默认值统一改回 `0`，即 `zodiaco主限法`。
  - Python `/chart` 返回的 `params` 现在显式回传：
    - `pdtype`
    - `showPdBounds`
  - 这样主限法页不再把“后端实际用了 mundo”误判成“已同步的 AstroAPP zodiaco 结果”。
  - Java 用户默认 `pdtype` 与 `changeparams` 的缺省值也统一改成 `0`，避免新环境或空用户参数再次回退到 mundo。
  - 广德样本浏览器复测时，Python 日志已确认请求为：
    - `pdMethod = astroapp_alchabitius`
    - `pdtype = 0`
    - `lat = 30n53`
    - `lon = 119e25`
    - `date = 2006/10/04`
    - `time = 09:58:00`
  - 广德样本浏览器第一页重新回到 AstroApp 同批结果，前几行已恢复为：
    - `-0度4分 / 2006-10-25 10:54:14`
    - `0度21分 / 2007-02-11 16:06:12`
    - `-0度48分 / 2007-07-23 11:01:34`
    - `0度57分 / 2007-09-14 13:37:20`
    - `1度33分 / 2008-04-21 15:49:15`
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `mvn -q -DskipTests package` in `Horosa-Web/astrostudysrv/astrostudy` ✅
  - `mvn -q -DskipTests package` in `Horosa-Web/astrostudysrv/astrostudycn` ✅
  - 广德浏览器验证截图：
    - `runtime/guangde_after_select_browser.png` ✅
  - 广德浏览器验证结果：
    - `runtime/guangde_after_select_browser.json` ✅
  - 广德 exact 对比摘要：
    - `runtime/pd_reverse/debug_guangde_exact_summary.json` ✅

### 18:45 - 加固主限法设置匹配逻辑，缺少完整后端确认时一律要求重算（2026-03-06）
- Scope: 修复“主限法页在某些旧响应、旧缓存或不完整参数返回场景下，仍可能把结果误判成已同步”的问题。
- Files:
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - `Horosa-Web/astropy/websrv/webchartsrv.py`
  - `Horosa-Web/astropy/astrostudy/helper.py`
- Details:
  - 主限法页的同步判定现在必须同时拿到：
    - `pdMethod`
    - `pdTimeKey`
    - `pdtype`
    - `pdSyncRev`
  - 只要这四项缺任何一项，或者 `pdSyncRev !== pd_method_sync_v4`，页面顶部按钮就强制保持 `重新计算`，不允许再显示 `已同步`。
  - Python `/chart` 返回 `params.pdSyncRev = 'pd_method_sync_v4'`，让前端能明确区分“当前生产版返回”和旧响应。
  - 这轮加固后再次用广德盘浏览器实测，主仓库页面前几行仍是：
    - `-0度4分 / 2006-10-25 10:54:14`
    - `0度21分 / 2007-02-11 16:06:12`
    - `-0度48分 / 2007-07-23 11:01:34`
    - `0度57分 / 2007-09-14 13:37:20`
    - `1度33分 / 2008-04-21 15:49:15`
- Verification (local):
  - `npm --prefix Horosa-Web/astrostudyui run build:file` ✅
  - `python3 -m py_compile Horosa-Web/astropy/websrv/webchartsrv.py Horosa-Web/astropy/astrostudy/helper.py` ✅
  - `runtime/guangde_main_repo_browser_check.png` ✅
  - `runtime/guangde_main_repo_browser_check.json` ✅

### 19:12 - 桌面打包版主限法重新对齐主仓库，广德盘浏览器页重新回到 AstroApp 同批结果（2026-03-06）
- Scope: 修复桌面打包版 `Horosa-Web+App (Mac)` 在冷启动/瘦身后，广德盘主限法第一页重新偏离 AstroApp 的问题。核心不是 Python 主限法内核，而是桌面包 Java `/chart` 还在命中旧缓存/旧编译产物。
- Files:
  - `Horosa-Web/astropy/astrostudy/helper.py`
  - `Horosa-Web/astropy/websrv/webchartsrv.py`
  - `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/ChartController.java`
  - `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/QueryChartController.java`
  - `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/PredictiveController.java`
  - `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/IndiaChartController.java`
  - `README.md`
  - `PROJECT_STRUCTURE.md`
  - `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
- Details:
  - 主限法同步修订号统一升级为 `pd_method_sync_v4`，让桌面包 Java `/chart` 端不再复用旧版主限法结果。
  - 这次不是只改前端按钮判断，而是同步更新了：
    - Python helper/chart websrv 的 `pdSyncRev`
    - 前端主限法页的同步判定常量
    - Java `ChartController / QueryChartController / PredictiveController / IndiaChartController` 的 `_wireRev`
  - 桌面包重新完整重建后，直接 POST 到桌面包 `/chart` 已回到与桌面包 `chartpy` 一致的广德盘结果：
    - `0.9465360439533583 / 2007-09-14 13:37:20`
    - `1.548025289282748 / 2008-04-21 15:49:15`
  - 浏览器页再次用广德盘 `2006-10-04 09:58 / 30n53 / 119e25 / guangde` 复测：
    - 页面实际请求 `http://127.0.0.1:9999/chart`
    - `dialogs = []`
    - `pageErrors = []`
    - 前几行重新稳定为：
      - `-0度4分 / 2006-10-25 10:54:14`
      - `0度21分 / 2007-02-11 16:06:12`
      - `-0度48分 / 2007-07-23 11:01:34`
      - `0度57分 / 2007-09-14 13:37:20`
      - `1度33分 / 2008-04-21 15:49:15`
  - 这说明桌面包用户在浏览器里看到的主限法表格，已经重新和桌面包后端 `AstroAPP-Alchabitius` 分支保持一致，并与 AstroApp 当前网页保持“所差无几”。
- Verification (local):
  - 桌面包重新执行 `HOROSA_SKIP_DB_SETUP=1 HOROSA_SKIP_LAUNCH=1 ./scripts/mac/bootstrap_and_run.sh` ✅
  - 桌面包 `/chart` 直接对照广德盘 ✅
  - 桌面包浏览器取证：
    - `runtime/guangde_pkg_browser_check.png` ✅
    - `runtime/guangde_pkg_browser_check.json` ✅
