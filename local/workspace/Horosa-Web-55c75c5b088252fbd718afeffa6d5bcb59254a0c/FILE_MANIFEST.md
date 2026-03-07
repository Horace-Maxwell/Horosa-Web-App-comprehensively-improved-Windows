# 文件清单

这个文件列出复现包里每一类资料的作用。

## 1. 顶层文档

- `README_FIRST.md`
  - 给人看的总说明，讲清楚这个包怎么用、哪些点不能改、怎么验收。
- `WINDOWS_CODEX_TASK_PROMPT.md`
  - 直接给 Windows Codex 的任务提示。
- `FILE_MANIFEST.md`
  - 本文件。

## 2. `reference_docs/`

- `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
  - 当前生产版主限法工程实现说明。
- `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md`
  - 当前生产版数学骨架 + 工程修正层说明。
- `PROJECT_STRUCTURE.md`
  - 项目结构与主限法实现记录位置说明。
- `UPGRADE_LOG.md`
  - 改动日志。

## 3. `expected_results/`

- `stability_production_summary.json`
  - 当前生产版稳定集结果。
- `virtual_only_geo_current540_fullfit_summary.json`
  - 当前大样本虚点专项结果。
- `shared_core_geo_current120_v2_exact_summary.json`
  - 当前跨度较大的新样本摘要结果。

## 4. `snapshot/` 下的关键代码

### 4.1 Python 主限法核心

- `Horosa-Web/astropy/astrostudy/perpredict.py`
- `Horosa-Web/astropy/astrostudy/perchart.py`
- `Horosa-Web/astropy/astrostudy/signasctime.py`

### 4.2 模型文件

- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_asc_case_corr_et_v1.joblib`
- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_asc_case_corr_et_v1.json`
- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_jupiter_v1.joblib`
- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_mars_v1.joblib`
- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_mercury_v1.joblib`
- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_moon_v1.joblib`
- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_neptune_v1.joblib`
- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_pluto_v1.joblib`
- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_saturn_v1.joblib`
- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_sun_v1.joblib`
- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_uranus_v1.joblib`
- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_venus_v1.joblib`

### 4.3 前端主限法与 AI 导出

- `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
- `Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js`
- `Horosa-Web/astrostudyui/src/models/app.js`
- `Horosa-Web/astrostudyui/src/models/astro.js`
- `Horosa-Web/astrostudyui/src/utils/aiExport.js`
- `Horosa-Web/astrostudyui/src/utils/constants.js`
- `Horosa-Web/astrostudyui/src/utils/request.js`

### 4.4 Java 控制器透传

- `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/ChartController.java`
- `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/QueryChartController.java`
- `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/IndiaChartController.java`
- `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/PredictiveController.java`

### 4.5 验证脚本

- `scripts/check_primary_direction_astroapp_integration.py`
- `scripts/check_horosa_full_integration.py`
- `scripts/compare_pd_backend_rows.py`
- `scripts/train_astroapp_virtual_body_corrections.py`
- `scripts/train_astroapp_asc_case_correction.py`
- `Horosa-Web/astrostudyui/scripts/verifyPrimaryDirectionRuntime.js`
- `Horosa-Web/astrostudyui/scripts/verifyHorosaRuntimeFull.js`
- `Horosa-Web/start_horosa_local.sh`
- `Horosa-Web/verify_horosa_local.sh`
- `scripts/browser_horosa_master_check.py`
- `scripts/mac/self_check_horosa.sh`
- `Horosa_SelfCheck_Mac.command`

补充说明：
- `verifyPrimaryDirectionRuntime.js` 现在不仅校验 `/chart` 与 `/predict/pd` 的主限法 rows 一致，还会断言前端主限法表格源码直接绑定后端 `pd[0]/pd[1]/pd[2]/pd[4]`。
- `check_primary_direction_astroapp_integration.py` 现在也会检查：
  - `pdtype` 透传
  - `cache: false` 强制重算
  - 主限法页未同步状态识别
- `constants.js` 现在必须保留本地 `ServerRoot` 的动态解析逻辑：
  - `srv` 查询参数
  - 当前网页端口推导 backend（`webPort + 1999`）
  - `localStorage.horosaLocalServerRoot`
  - 默认回退 `127.0.0.1:9999`
- `request.js` 现在必须保留对布尔型 `cache` 的运行时规范化；否则主限法页点击“重新计算”会在前端原生 `fetch` 层直接抛错。
- `start_horosa_local.sh` 现在必须保留 `nohup` 启动 `8899/9999` 的行为，否则服务会在外层脚本结束后消失，页面点击“计算”会误报 `127.0.0.1:8899` 未就绪。
- 当前 Mac 生产版进一步把 detached 启动强化成了 `nohup + setsid + disown`；Windows 复刻时也必须保留等价语义。
- `Horosa_Local.command` 现在默认也必须让服务常驻，否则用户关闭启动窗口后，浏览器中的“重新计算”会再次触发“排盘服务未就绪”。
- `Horosa_Local.command` 还必须在默认 `8000/8899/9999` 被其他副本占用时自动切到空闲端口，否则用户继续使用旧 `127.0.0.1:8000` 页面时，主限法页会最先暴露出“本地排盘服务未就绪”。
- `verify_horosa_local.sh` 现在会在找到带 `playwright` 的 Python 时自动补跑 `scripts/browser_horosa_master_check.py`；这层浏览器巡检也属于当前生产验收的一部分。
- `stop_horosa_local.sh` 现在必须把兜底端口回收限制在当前工作区路径内，否则另一份 Horosa 副本会被误停。
- `self_check_horosa.sh` 现在还必须支持在默认 `8899/9999/8000` 被占用时自动切到空闲端口，否则多副本环境下会把“验收失败”误当成网站故障。

## 5. 使用原则

- `reference_docs/` 用于理解
- `snapshot/` 用于复刻
- `expected_results/` 用于验收

如果 Windows Codex 只能选一个目录重点使用，应该优先看：

- `snapshot/`

如果 Windows Codex 只能选一份说明文档，应该优先看：

- `WINDOWS_CODEX_TASK_PROMPT.md`
