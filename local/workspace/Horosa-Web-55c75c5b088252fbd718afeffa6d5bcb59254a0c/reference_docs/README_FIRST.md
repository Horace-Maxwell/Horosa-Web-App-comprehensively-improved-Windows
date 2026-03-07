# Windows Codex 复现说明

这份复现包的目标不是“让 Windows 上重新研究一遍主限法”，而是让 Windows 上的 Codex **准确复刻当前这台 Mac 上已经落地成功的 AstroAPP-Alchabitius 主限法实现、UI 接线、AI 导出链路和验证链路**。

如果你把整个文件夹交给 Windows 上的 Codex，正确做法是：

1. 先读本文件
2. 再读 `WINDOWS_CODEX_TASK_PROMPT.md`
3. 按 `snapshot/` 中的相对路径，把文件复制/合并到 Windows 的 Horosa 仓库
4. 保留 `models/` 二进制文件原样
5. 跑验收

不要让 Windows Codex 重新发明算法，也不要让它“按理解重写一版”。

---

## 1. 这个包里到底装了什么

### 1.1 `snapshot/`

这是最重要的部分。

里面放的是当前 Mac 生产版的关键文件快照，目录结构已经按仓库相对路径摆好。  
Windows Codex 的目标应该是：

- 把 `snapshot/` 下面这些文件同步到 Windows 仓库对应位置
- 必要时做三方合并
- 但最终内容必须和这些快照语义一致

### 1.2 `reference_docs/`

这里是理解用资料：

- `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
- `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md`
- `PROJECT_STRUCTURE.md`
- `UPGRADE_LOG.md`

重点看前两份。

### 1.3 `expected_results/`

这里放的是当前 Mac 上已经通过的生产结果摘要，用来给 Windows 侧做对照：

- `stability_production_summary.json`
- `virtual_only_geo_current540_fullfit_summary.json`
- `shared_core_geo_current120_v2_exact_summary.json`

这些不是训练素材，而是验收基准。

---

## 2. Windows 上要复现的目标到底是什么

不是泛泛的“有一个主限法选项”，而是下面这些同时成立：

### 2.1 算法目标

Horosa 网站中：

- 进入 `推运盘 -> 主/界限法`
- 选择 `AstroAPP-Alchabitius`
- 选择 `Ptolemy`
- 点击 `计算`

后端必须真实切到 `astroapp_alchabitius` 分支，而不是只改前端标签。

### 2.2 UI / 显示目标

切换 `Horosa原方法` 和 `AstroAPP-Alchabitius` 时：

- 整表重算
- `Arc / 迫星 / 应星 / 日期` 同步变化
- 不能只变第一列标题
- 不能沿用旧缓存
- `fieldsToParams()` 必须显式透传 `pdtype`
- 点击 `计算` 必须强制绕过前端 chart 内存缓存
- 如果 `chart.params.pdtype !== 0`，页面必须把当前 rows 视为未同步状态
- 本地启动脚本必须让 `8899/9999` 脱离父 shell 持续运行，否则页面虽然还开着，点击 `计算` 会误报 `127.0.0.1:8899` 未就绪
- 停止脚本的兜底端口回收必须限定在当前工作区副本内，不能按通用进程名跨副本清理

### 2.3 AI 导出目标

AI 导出和 AI 导出设置必须跟随当前已应用的方法：

- 导出前刷新 `primarydirect` 快照
- 导出的 `推运方法 / 度数换算 / Arc / 迫星 / 应星 / 日期` 与页面当前结果一致

### 2.4 精度目标

当前 Mac 生产版标准：

- `Asc < 0.001°`
- `MC < 0.001°`
- `North Node < 0.001°`
- `date_max_days < 7`

当前生产结果可直接看：

- `expected_results/stability_production_summary.json`
- `expected_results/virtual_only_geo_current540_fullfit_summary.json`

---

## 3. 必须原样保留的实现要点

Windows Codex **不能自行简化** 下面这些点。

### 3.1 shared-core 对象集限制

当前 AstroApp 分支只保留：

- Promissor: `Sun..Pluto + North Node`
- Significator: `Sun..Pluto + North Node + Asc + MC`

不要把：

- PF
- Bounds
- Dark Moon
- Purple Clouds
- South Node

重新塞回 AstroApp 分支。

### 3.2 True Node

必须是：

- `TRUE_NODE`

不是 mean node。

### 3.3 动态 obliquity

不能用固定 `23.44°`。

必须按日期取：

- `mean obliquity`
- `true obliquity`

### 3.4 Asc 专用公式

`Asc` 不是普通 `RA(sig) - RA(prom)`。

它必须保留当前生产版的：

- zero-lat OA 双边口径
- promissor-side `true obliquity - 0.0014°`

### 3.5 虚点行 promissor body correction

对 `Asc / MC / North Node` 行，当前生产版优先使用：

- `astroapp_pd_virtual_body_corr_*.joblib`

这些模型必须二进制原样复制，不要手工改、不要重新序列化、不要转文本。

### 3.6 fallback promissor longitude correction

即使没有 body model，也必须保留：

- `ASTROAPP_PD_PROM_LON_CORR`

### 3.7 Asc case correction 现在只是 fallback

当前代码里 `astroapp_pd_asc_case_corr_et_v1.joblib` 仍保留，但它是 fallback，不是主路径。

只要 body models 在，`asc_case_correction` 就应保持 `0`。

### 3.8 显示窗和排序

不能只复刻 arc 公式。

还必须保留：

- `ASTROAPP_PD_DISPLAY_EPS`
- `ASTROAPP_PD_DISPLAY_WINDOW`
- `sort by (absArc, arc, prom_id, sig_id)`

否则表格顺序和显示范围会偏。

---

## 4. 文件怎么用

### 4.1 最安全的用法

让 Windows Codex 以 **仓库根目录为基准** 执行：

1. 读取 `snapshot/` 下的文件
2. 逐个对照目标仓库相对路径
3. 把这些内容合并到 Windows 仓库
4. 对 `models/` 目录做二进制复制

### 4.2 不建议的用法

不要让 Windows Codex：

- 只读文档然后自己手写
- 根据数学描述重新实现一版
- 省略前端接线
- 省略 Java 透传
- 省略 AI 导出链路
- 省略验证脚本

因为这样做很容易“算法像了，但运行态不一致”。

---

## 5. 建议的 Windows 执行顺序

### 第一步：先同步 Python 主限法核心

先处理：

- `snapshot/Horosa-Web/astropy/astrostudy/perpredict.py`
- `snapshot/Horosa-Web/astropy/astrostudy/perchart.py`
- `snapshot/Horosa-Web/astropy/astrostudy/signasctime.py`
- `snapshot/Horosa-Web/astropy/astrostudy/models/*`

### 第二步：再同步前端主限法与 AI 导出

再处理：

- `snapshot/Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
- `snapshot/Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js`
- `snapshot/Horosa-Web/astrostudyui/src/models/app.js`
- `snapshot/Horosa-Web/astrostudyui/src/models/astro.js`
- `snapshot/Horosa-Web/astrostudyui/src/utils/aiExport.js`

### 第三步：同步 Java 控制器透传

再处理：

- `snapshot/Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/ChartController.java`
- `snapshot/Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/QueryChartController.java`
- `snapshot/Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/IndiaChartController.java`
- `snapshot/Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/PredictiveController.java`

### 第四步：同步验证脚本

最后处理：

- `snapshot/scripts/check_primary_direction_astroapp_integration.py`
- `snapshot/scripts/check_horosa_full_integration.py`
- `snapshot/scripts/compare_pd_backend_rows.py`
- `snapshot/scripts/train_astroapp_virtual_body_corrections.py`
- `snapshot/scripts/train_astroapp_asc_case_correction.py`
- `snapshot/Horosa-Web/astrostudyui/scripts/verifyPrimaryDirectionRuntime.js`
- `snapshot/Horosa-Web/astrostudyui/scripts/verifyHorosaRuntimeFull.js`
- `snapshot/Horosa-Web/verify_horosa_local.sh`

---

## 6. 模型文件的特别要求

这是最容易被 Windows 侧忽略的点。

### 必须复制的模型

至少要有：

- `astroapp_pd_asc_case_corr_et_v1.joblib`
- `astroapp_pd_asc_case_corr_et_v1.json`
- `astroapp_pd_virtual_body_corr_sun_v1.joblib`
- `astroapp_pd_virtual_body_corr_moon_v1.joblib`
- `astroapp_pd_virtual_body_corr_mercury_v1.joblib`
- `astroapp_pd_virtual_body_corr_venus_v1.joblib`
- `astroapp_pd_virtual_body_corr_mars_v1.joblib`
- `astroapp_pd_virtual_body_corr_jupiter_v1.joblib`
- `astroapp_pd_virtual_body_corr_saturn_v1.joblib`
- `astroapp_pd_virtual_body_corr_uranus_v1.joblib`
- `astroapp_pd_virtual_body_corr_neptune_v1.joblib`
- `astroapp_pd_virtual_body_corr_pluto_v1.joblib`

### 复制要求

- 必须是 **binary-safe copy**
- 不能重新保存
- 不能尝试文本化
- 不能让 Git 自动替换成别的内容

### 不要做的事

不要让 Windows Codex：

- 重新训练这些模型
- 试图“换一个更现代的模型”
- 删除 `joblib` 依赖
- 把 body correction 改成规则表

因为当前目标是复刻 Mac 生产版，不是重做研究。

---

## 7. Windows 上建议的命令与验收

以下不是必须逐字执行，但 Windows Codex 应该以这些验收点为目标。

### 7.1 代码级检查

- 前端能构建
- Python 脚本能导入
- Java 控制器仍正常编译

### 7.2 主限法专项检查

应该至少运行：

```bash
python scripts/check_primary_direction_astroapp_integration.py
```

通过条件：

- 输出 `status: ok`
- `Asc / MC / North Node` 在阈值内
- `astroapp_alchabitius` 与 `horosa_legacy` 两条分支都存在

### 7.3 整站 smoke check

如果 Windows 本地服务能起：

```bash
node Horosa-Web/astrostudyui/scripts/verifyPrimaryDirectionRuntime.js
node Horosa-Web/astrostudyui/scripts/verifyHorosaRuntimeFull.js
```

### 7.4 页面级验收

需要人工或自动化确认：

1. 打开主限法
2. 选择 `AstroAPP-Alchabitius`
3. 点击 `计算`
4. 记录 rows 数与第一行
5. 切到 `Horosa原方法`
6. 再点 `计算`
7. 确认 rows 数和前导结果不同
8. 打开 AI 导出
9. 确认导出里的 `推运方法` 与当前方法一致

---

## 8. 对 Windows Codex 的硬约束

你可以直接把下面这些要求交给它：

- 不要重新设计主限法
- 不要删模型
- 不要把 `AstroAPP-Alchabitius` 改成近似实现
- 不要破坏 `Horosa原方法`
- 不要只改 Python 不改前端
- 不要只改前端不改 Java 透传
- 不要只改显示不改 AI 导出
- 不要把 Mac 上的文档当成历史资料忽略掉

它的任务是：

**把这份包里的现成生产实现，准确搬到 Windows 仓库。**

---

## 9. 最终验收标准

Windows 侧完成后，应该能同时满足：

1. `AstroAPP-Alchabitius` 真正调用当前生产版算法
2. `Horosa原方法` 仍保持独立分支
3. 切换方法后，表格整体重算并刷新
4. AI 导出和 AI 导出设置跟随当前已应用的方法
5. `Asc / MC / North Node` 仍满足 `< 0.001°`
6. 页面主限法表格直接显示后端 `predictives.primaryDirection` 的 `pd[0]/pd[1]/pd[2]/pd[4]`
7. 不出现白屏、报错、空表、无响应设置

如果某一步做不到，优先怀疑：

- 模型文件没复制
- Java 控制器没透传 `pdMethod / pdTimeKey`
- 前端没触发 `pdtype = 0` 重算
- 前端没有用 `cache: false` 触发真正重算
- 表格不是直接绑定后端 rows
- AI 导出没刷新 `primarydirect`

---

## 10. 推荐阅读顺序

给 Windows Codex 的推荐阅读顺序：

1. `WINDOWS_CODEX_TASK_PROMPT.md`
2. `reference_docs/PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
3. `reference_docs/PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md`
4. `FILE_MANIFEST.md`
5. `snapshot/` 里的对应代码文件

如果只看一份，就先看：

- `WINDOWS_CODEX_TASK_PROMPT.md`
