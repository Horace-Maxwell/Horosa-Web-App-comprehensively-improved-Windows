# AstroAPP-Alchabitius 主限法复刻说明

本文档只描述 Horosa 当前生产版 `AstroAPP-Alchabitius` 分支，也就是 Horosa 网站里“主/界限法”页面顶部 `推运方法 = AstroAPP-Alchabitius` 时，真正落地运行的那一套主限法实现。

它不是文献抽象版，也不是早期实验版，而是“为了尽量原模原样复现 AstroApp 当前网站输出”而落地到本地 Horosa 的工程实现说明。

配套数学版见：

- `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md`

## 1. 目标与边界

当前复刻目标：

- `Primary Directions`
- `Direction Method = Alchabitius`
- `Time Key = Ptolemy`
- `Type = In Zodiaco`
- 相位：`0 / 60 / 90 / 120 / 180`
- `direct + converse`
- 当前 AstroApp 网站真实支持的 shared-core 对象集

当前不在复刻保证范围内：

- `horosa_legacy / Horosa原方法`
- `Mundo`
- 非 `Ptolemy` 时间键
- AstroApp 不稳定或本地扩展的额外虚点
- `Terms / Bounds / PF / Dark Moon / Purple Clouds / South Node`

换句话说，本地是“精确复刻 AstroApp 当前网站这条共享核心主限法链路”，不是重写一个理论上更纯的 Alchabitius 引擎。

## 2. 入口与接线

后端核心：

- `Horosa-Web/astropy/astrostudy/perpredict.py`
- `Horosa-Web/astropy/astrostudy/perchart.py`
- `Horosa-Web/astropy/astrostudy/signasctime.py`

前端与页面接线：

- `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
- `Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js`
- `Horosa-Web/astrostudyui/src/models/app.js`
- `Horosa-Web/astrostudyui/src/models/astro.js`
- `Horosa-Web/astrostudyui/src/utils/aiExport.js`

服务层透传：

- `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/ChartController.java`
- `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/QueryChartController.java`
- `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/IndiaChartController.java`
- `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/PredictiveController.java`

验证脚本：

- `scripts/check_primary_direction_astroapp_integration.py`
- `scripts/compare_pd_backend_rows.py`
- `Horosa-Web/astrostudyui/scripts/verifyPrimaryDirectionRuntime.js`

## 3. Horosa 网站里到底是怎么切到这条算法的

当前 Horosa 网站的“主/界限法”页是显式双分支：

```python
def getPrimaryDirectionByZ(self):
    if getattr(self.perchart, 'pdMethod', 'astroapp_alchabitius') == 'horosa_legacy':
        pdlist = self.getPrimaryDirectionByZLegacy()
    else:
        pdlist = self.getPrimaryDirectionByZAstroAppKernel()
    self.appendDateStr(pdlist)
    return pdlist
```

含义：

- `pdMethod = horosa_legacy`：走原 Horosa 旧算法
- `pdMethod = astroapp_alchabitius`：走 AstroApp 复刻内核

前端切换步骤是：

1. 顶部选择 `推运方法`
2. 顶部选择 `度数换算`
3. 点击 `计算`
4. `AstroDirectMain.applyPrimaryDirectionConfig(...)` 强制按 `pdtype = 0` 重算
5. Java `/chart` / `/predict/pd` 把 `pdMethod / pdTimeKey` 透传到 Python
6. Python 按当前方法重新计算
7. 主限法表格 remount，整表刷新
8. AI 导出读取当前已应用的 `chartObj.params`

因此：

- 切换 `Horosa原方法 / AstroAPP-Alchabitius` 不是只改标题
- `Arc / 迫星 / 应星 / 日期` 会跟着真实重算
- AI 导出和 AI 导出设置走的是当前已应用的方法，不是旧缓存
- 本地运行时里，`/chart` 必须连到“当前这张网页所属的 backend 副本”：
  - 优先读 URL `srv`
  - 否则按当前本地网页端口推导 backend 端口（`web + 1999`）
  - 再不行才回退旧 `localStorage`
- 这不是 AstroApp 数学公式的一部分，但它是 Horosa 本地稳定复刻 `AstroAPP-Alchabitius` 主限法时必须保留的运行态约束；否则主限法页点击 `计算/重新计算` 会最先暴露成“本地排盘服务未就绪”。

## 4. 当前 shared-core 对象集

### 4.1 Promissor

当前 AstroApp kernel 只计算：

- `Sun`
- `Moon`
- `Mercury`
- `Venus`
- `Mars`
- `Jupiter`
- `Saturn`
- `Uranus`
- `Neptune`
- `Pluto`
- `North Node`

### 4.2 Significator

当前 AstroApp kernel 只计算：

- 上述同一组 `Sun .. Pluto + North Node`
- `Asc`
- `MC`

### 4.3 明确排除

当前 AstroApp 选项下，不参与生产结果且前端会过滤的对象：

- `Terms / Bounds / T_*`
- `Pars Fortuna`
- `Dark Moon`
- `Purple Clouds`
- `South Node`
- 其它 AstroApp 不支持的扩展虚点

## 5. 要原模原样复刻，必须包含的 6 层实现

这是最关键的部分。  
如果只抄主公式，不抄下面这些工程层，本地结果不会接近 AstroApp 当前网站。

### 5.1 对象集与相位集

固定对象集：

- `ASTROAPP_PD_OBJECT_IDS = Sun..Pluto + North Node`

固定相位集：

- `0 / 60 / 90 / 120 / 180`

固定方向集：

- direct + converse 都保留

### 5.2 True Node 重建

AstroApp 当前 HAR 已确认：

- `moon_node_id = T`

所以本地不能用 flatlib 默认 mean node，而是要先用 Swiss `TRUE_NODE` 重建：

```text
North Node = swisseph.TRUE_NODE(jd)
South Node = North Node + 180°
```

然后再对 node 做 `N / D / S` 相位化。

### 5.3 每日动态黄赤交角

不能再用 flatlib 固定 `23.44°`。

必须按当前日期动态取两套黄赤交角：

- 普通对象和 `MC`：`mean obliquity`
- `Asc`：`true obliquity`

实现：

```python
eps_true = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][0]
eps_mean = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][1]
```

### 5.4 虚点专用 promissor 修正层

这是当前生产实现与早期版本差异最大的地方。

当 `significator in {Asc, MC, North Node}` 时，不直接拿本地 Swiss 本体做 promissor，而是走两级修正：

#### 第一优先级：对象级 body correction model

对 `Sun .. Pluto`，如果存在模型文件，就用训练好的 `lon_model + lat_model` 预测：

- `astro_body_lon - local_body_lon`
- `astro_body_lat - local_body_lat`

然后把这个 delta 加回 promissor 本体。

模型文件：

- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_sun_v1.joblib`
- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_moon_v1.joblib`
- `...`
- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_pluto_v1.joblib`

训练脚本：

- `scripts/train_astroapp_virtual_body_corrections.py`

这层修正只作用于虚点行：

- `Asc`
- `MC`
- `North Node`

不会污染普通 planet-to-planet 行。

#### 第二优先级：线性 promissor longitude correction

如果 promissor 没有 body model，就退回到每个本体一组线性黄经修正：

```python
dlon = a + b * (jd - 2460500.0)
```

配置在：

- `ASTROAPP_PD_PROM_LON_CORR`

当前包含：

- `Sun`
- `Moon`
- `Mercury`
- `Venus`
- `Mars`
- `Jupiter`
- `Saturn`
- `Uranus`
- `Neptune`
- `Pluto`
- `North Node`

这层保证即使没有 body model，结果也仍然沿着 AstroApp 当前口径收敛，而不是退回纯 Swiss 原始值。

### 5.5 Asc 专用 OA 微调层

`Asc` 不是普通 `RA(sig) - RA(prom)`。

当前生产版 `Asc` 是：

```text
Arc = norm180( OA_true_zero(prom) - OA_true_zero(Asc) - asc_bias )
```

但 promissor 侧不是普通 `true obliquity`，而是：

```text
eps_true_prom = eps_true - 0.0014°
```

对应常量：

- `ASTROAPP_PD_ASC_PROM_TRUE_OBLIQUITY_OFFSET = -0.0014`

也就是：

- `Asc` significator 侧：`true obliquity`
- `Asc` promissor 侧：`true obliquity - 0.0014°`
- 两边都强制 `zero_lat`

### 5.6 Asc chart-level correction 是 fallback，不是当前主路径

代码里仍保留了：

- `astroapp_pd_asc_case_corr_et_v1.joblib`

和：

- `_astroappAscCaseCorrection(chart)`

但当前生产逻辑是：

```python
astroapp_body_models_enabled = any(model_exists for Sun..Pluto)
astroapp_asc_case_correction = 0.0 if astroapp_body_models_enabled else self._astroappAscCaseCorrection(chart)
```

这意味着：

- 只要 body models 存在，`Asc case correction` 就不启用
- 它现在是 fallback 兜底，不是主要生产修正层

当前生产精度主要来自：

1. `TRUE_NODE` 重建
2. 动态 `mean/true obliquity`
3. `Asc` promissor-side obliquity shift
4. 虚点行 promissor body correction models
5. promissor longitude fallback correction

## 6. 当前生产公式

### 6.1 普通 significator

对 `sig not in {Asc, MC}`：

```text
Arc = norm180(
  RA_mean(sig, true_lat)
  -
  RA_mean(prom_aspected, zero_lat)
)
```

### 6.2 Asc

对 `sig = Asc`：

```text
Arc = norm180(
  OA_true_zero_shifted_prom(prom_aspected)
  -
  OA_true_zero(Asc)
  -
  asc_case_correction
)
```

其中当前生产态通常：

- `asc_case_correction = 0`
- 因为 body models 已存在

### 6.3 MC

对 `sig = MC`：

```text
Arc = norm180(
  RA_mean(prom_aspected, zero_lat)
  -
  RA_mean(MC, zero_lat)
)
```

### 6.4 统一归一化

```python
def _norm180(deg):
    return (float(deg) + 180.0) % 360.0 - 180.0
```

所以：

- `Arc > 0`：direct
- `Arc < 0`：converse

## 7. 过滤与排序

生产版还必须包含这层显示过滤，否则表格不会像 AstroApp。

### 7.1 行过滤

会跳过：

- `prom_id == sig_id`
- `base(prom) == base(sig)`
- `abs(arc) <= eps`
- `abs(arc) > 100`

### 7.2 普通 planet-to-planet 显示窗

只对普通 planet pair 再套一层显示窗：

- `ASTROAPP_PD_DISPLAY_EPS = 3.0`
- `ASTROAPP_PD_DISPLAY_WINDOW = 107.5`

用的不是 arc 本身，而是：

```text
raw_delta = sig.lon - prom.lon
```

再结合 arc 正负决定保留窗。

### 7.3 排序

```text
sort by (abs(arc), arc, prom_id, sig_id)
```

## 8. 日期换算

日期仍交给：

- `Horosa-Web/astropy/astrostudy/signasctime.py`

时间键当前固定：

- `Ptolemy`

当前线上/本地验证的关键不是重写日期算法，而是输入口径统一成：

- `utc_sourcejd_exact`

也就是直接从 AstroApp `sourceJD` 还原出 UTC 浮点小时，原样喂给 `PerChart`，避免字符串截断。

## 9. 前端显示与 AI 导出如何保持同步

### 9.1 页面显示

当前页面上方设置区由：

- `AstroPrimaryDirection.js`

负责。

点击 `计算` 后：

- `AstroDirectMain.applyPrimaryDirectionConfig(...)`

会把：

- `pdMethod`
- `pdTimeKey`
- `pdtype = 0`

一起送去重算，并显式带 `cache: false` 绕过前端 chart 内存缓存。

主限法表格 remount key 已包含：

- `chartId`
- `pdMethod`
- `pdTimeKey`
- `showPdBounds`

所以方法一切换，整表会重新装载，不会沿用旧 rows。

另外，当前页面还额外防一类运行态假不同步：

- 如果 `chart.params.pdtype !== 0`
- 即使 `pdMethod / pdTimeKey` 文字没变

主限法页也会把它视为“未同步状态”，按钮显示为 `重新计算`。

这是因为之前真实出现过一种情况：

- 后端 AstroApp kernel 已经是对的
- 但页面沿用了旧 chart state
- 用户看到的 rows 不是当前后端结果

所以当前生产版要求：

- `fieldsToParams()` 显式透传 `pdtype`
- `applyPrimaryDirectionConfig()` 强制 `cache: false`
- 表格直接显示 `predictives.primaryDirection` 的 `pd[0]/pd[1]/pd[2]/pd[4]`

此外，启动入口也必须配套成立：

- `Horosa_Local.command` 若发现默认 `8000/8899/9999` 已被其他 Horosa 副本占用，必须自动切到空闲端口并打开新 URL；
- 用户不能继续停留在旧的 `127.0.0.1:8000` 标签页里测试主限法；
- 因为主限法页会触发实时重算，它会最先暴露“页面连着旧副本/旧端口，但当前副本服务根本不在那组端口上”的问题。

这三件事缺一不可。

### 9.2 AI 导出

AI 导出与 AI 导出设置当前都绑定：

- `primarydirect`

导出前会：

```text
requestModuleSnapshotRefresh('primarydirect')
```

因此导出拿的是当前已应用的方法，而不是用户尚未点击“计算”的临时选择。

导出分区：

- `出生时间`
- `星盘信息`
- `主/界限法设置`
- `主/界限法表格`

导出的：

- `推运方法`
- `度数换算`
- `Arc`
- `迫星`
- `应星`
- `日期`

与页面当前结果同步。

## 10. 要在别人的 Mac 上原模原样跑出来，必须带哪些文件

只复制代码还不够，下面这些必须一起带：

### 10.1 核心代码

- `Horosa-Web/astropy/astrostudy/perpredict.py`
- `Horosa-Web/astropy/astrostudy/perchart.py`
- `Horosa-Web/astropy/astrostudy/signasctime.py`
- Java 控制器透传改动
- 前端主限法页面与 AI 导出改动

### 10.2 模型文件

- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_asc_case_corr_et_v1.joblib`
- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_asc_case_corr_et_v1.json`
- `Horosa-Web/astropy/astrostudy/models/astroapp_pd_virtual_body_corr_*.joblib`

### 10.3 自检脚本

- `scripts/check_primary_direction_astroapp_integration.py`
- `Horosa-Web/astrostudyui/scripts/verifyPrimaryDirectionRuntime.js`
- `Horosa-Web/verify_horosa_local.sh`
- `scripts/mac/self_check_horosa.sh`

如果模型目录没带齐，本地仍能运行，但不会是“当前生产版 AstroApp 近似口径”。

## 11. 当前验证口径

主验证脚本：

```bash
.runtime/mac/venv/bin/python3 scripts/compare_pd_backend_rows.py \
  --cases-root <cases_root> \
  --mode utc_sourcejd_exact \
  --shared-core-only \
  --out-csv <rows.csv> \
  --out-json <summary.json>
```

整站主限法自检脚本：

```bash
.runtime/mac/venv/bin/python3 scripts/check_primary_direction_astroapp_integration.py
node Horosa-Web/astrostudyui/scripts/verifyPrimaryDirectionRuntime.js
```

浏览器级宗师巡检脚本：

```bash
/Users/horacedong/miniconda3/bin/python scripts/browser_horosa_master_check.py
```

它会真实打开本地 Horosa 页面并点击：

- 左侧 16 个主模块
- 星盘右栏 `信息 / 相位 / 行星 / 希腊点 / 可能性`
- 推运盘右栏全部技术
- 希腊星术 `十三分盘`
- 印度律盘全部可见数律盘
- 八字紫微全部子页
- 易与三式全部子页
- `AI导出` / `AI导出设置`
- 主限法 `Horosa原方法 <-> AstroAPP-Alchabitius` 切换并重新计算

当前这两层自检除了校验算法分支和阈值，还会额外断言：

- 主限法表格直接绑定后端 `predictives.primaryDirection`
- 页面列值直接来自：
  - `Degree = pd[0]`
  - `Promittor = pd[1]`
  - `Significator = pd[2]`
  - `Date = pd[4]`

也就是说，当前生产版不仅要求“后端算对”，还要求“用户页面看到的就是后端算出来的 rows”。

另外，运行这套主限法还有一个基础前提：

- 本地 `8899 / 9999` 服务必须在页面继续使用期间保持常驻

所以当前启动链路还要求：

- `start_horosa_local.sh` 用 `nohup + setsid + disown` 这类不会随父 shell 退出而消失的方式启动后端服务
- `Horosa_Local.command` 也必须默认保持服务常驻，不能再依赖用户保留启动窗口
- `Horosa_Local.command` 对本地网页 `8000` 也要使用同等级别的 detached 启动；否则用户看到页面后，稍后点 `计算/重新计算` 仍可能发现服务已经跟着启动窗口一起死掉
- `Horosa_Local.command` 若切到替代端口，必须把实际 `HOROSA_SERVER_ROOT` 通过页面 URL `srv` 参数送给前端；否则主限法页虽然能打开，但点击 `重新计算` 仍会打到旧的 `127.0.0.1:9999`
- `Horosa_SelfCheck_Mac.command` 默认不再在验收结束后自动把刚启动的服务停掉
- `stop_horosa_local.sh` 的兜底端口回收只允许处理当前工作区副本的服务
- `self_check_horosa.sh` 在默认端口被另一份副本占用时必须自动切到空闲端口完成当前副本验收
- `verify_horosa_local.sh` 若本机有 Playwright 运行环境，应把浏览器级宗师巡检也一起跑掉；否则只能证明接口和接线无误，不能证明“用户手上看到的浏览器画面也没岔子”
- 主限法页在当前方法/时间钥已经同步且页面已有 rows 时，不应再额外请求 `/chart`；否则它会成为唯一一个在“重复点击当前结果”时还访问后端的页面
- 主限法页强制重算使用的 `cache: false` 不能原样落到浏览器原生 `fetch`；运行时代码必须先把它规范化为 `cache: 'no-store'`，否则请求会在前端直接抛异常，表现成“本地服务未就绪”

否则主限法页面虽然还能打开，但用户一点击 `计算` 就会得到 `127.0.0.1:8899` 未就绪的假故障。

## 12. 当前生产结果

### 12.1 稳定集

结果文件：

- `runtime/pd_reverse/stability_production_summary.json`

当前稳定集结果：

- `run200_login`
  - `shared_core arc_mae = 0.00022132906505383096`
  - `Asc arc_mae = 0.0003325791052690479`
  - `MC arc_mae = 0.000030617101092214876`
  - `North Node arc_mae = 0.00009889820385835736`
- `geo300`
  - `shared_core arc_mae = 0.00022178467378535262`
  - `Asc arc_mae = 0.0003879264973732093`
  - `MC arc_mae = 0.000030600772530614015`
  - `North Node arc_mae = 0.00009942357381868132`

### 12.2 当前大样本虚点专项

结果文件：

- `runtime/pd_reverse/virtual_only_geo_current540_fullfit_summary.json`

当前 `540` case 虚点专项：

- `Asc arc_mae = 0.0009919652751037512`
- `MC arc_mae = 0.00041444975277272176`
- `North Node arc_mae = 0.00011554510206301699`

因此按当前生产目标：

- `Asc < 0.001°`
- `MC < 0.001°`
- `North Node < 0.001°`
- `date_max_days < 7`

已经满足。

## 13. 一句话版本

如果要“原模原样实现 Horosa 本地这套和 AstroApp 非常接近的主限法”，不能只实现 Alchabitius 数学骨架，必须把下面这些一起做进去：

1. `shared-core` 对象集限制
2. `TRUE_NODE` 重建
3. 动态 `mean / true obliquity`
4. `Asc` 的 zero-lat OA 双边口径
5. `Asc` promissor-side `-0.0014°` true-obliquity shift
6. 虚点行 promissor body correction models
7. promissor longitude fallback correction
8. AstroApp 显示窗与排序
9. `Ptolemy` 日期换算
10. Horosa 前端、AI 导出、服务层透传、自检脚本一起同步

少任何一层，结果都会偏离当前生产版。

## 14. 浏览器运行态一致性补充

除了上面的数学与对象集口径，当前生产版还依赖一个容易被忽略的前提：

- 浏览器真正打给后端的 `pdtype` 必须是 `0`

原因是：

- `AstroAPP-Alchabitius` 这条当前生产链默认对应 `zodiaco主限法`
- 如果浏览器状态里残留了 `pdtype = 1`，那么页面标题虽然仍会显示 `AstroAPP-Alchabitius`，但后端实际会走 `mundo主限法`
- 这种偏差会让像广德盘 `2006-10-04 09:58 / 30n53 / 119e25` 这样的样本在第一页就明显偏离 AstroApp

因此当前生产实现还要求：

1. `astrostudyui/src/models/astro.js`
   - 空白字段和全局 `fields` 的 `pdtype` 默认值必须是 `0`
2. `astropy/websrv/webchartsrv.py`
3. `astropy/astrostudy/helper.py`
   - `/chart` 回传的 `params` 必须显式带上 `pdtype` 和 `showPdBounds`
4. Java 用户参数默认值也必须是 `0`

广德盘这轮浏览器取证文件：

- `runtime/guangde_after_select_browser.json`
- `runtime/guangde_after_select_browser.png`

其中浏览器第一页已经重新回到这批结果：

- `-0度4分 / 2006-10-25 10:54:14`
- `0度21分 / 2007-02-11 16:06:12`
- `-0度48分 / 2007-07-23 11:01:34`
- `0度57分 / 2007-09-14 13:37:20`
- `1度33分 / 2008-04-21 15:49:15`

这和 AstroApp 当前网页同一批广德样本的前几条已经重新对齐。

## 15. 主限法设置匹配的最终约束

当前生产版不再允许主限法页面用“默认值”或“不完整 chart.params”推断自己已经同步。

现在浏览器侧只要出现下面任一情况：

- `params.pdMethod` 缺失
- `params.pdTimeKey` 缺失
- `params.pdtype` 缺失
- `params.pdSyncRev` 缺失
- `params.pdSyncRev !== 'pd_method_sync_v4'`

页面顶部就必须显示 `重新计算`，而不能显示 `已同步`。

只有当后端明确返回：

- `pdMethod`
- `pdTimeKey`
- `pdtype`
- `pdSyncRev = 'pd_method_sync_v4'`

并且它们和当前下拉选择完全一致时，主限法页面才允许进入 `已同步` 状态。

这样做的目的只有一个：

- 防止任何旧缓存、旧服务、旧返回、缺字段返回，在视觉上伪装成“当前 AstroAPP 主限法结果”。

## 16. 桌面打包版必须同步 `_wireRev`

这条约束后来在桌面打包版 `Horosa-Web+App (Mac)` 上又被验证了一遍。

如果桌面包只同步了 Python 主限法实现，但没有同步 Java `/chart` 控制器里的 `_wireRev`，就会出现一种很隐蔽的坏状态：

- `chartpy` 直接计算出来的广德盘已经是正确的；
- 但桌面包 Java `/chart` 仍可能命中旧缓存/旧编译产物；
- 浏览器第一页就会重新偏离 AstroApp 当前网页结果。

因此当前生产版要求下面这几处同时升级到同一个同步修订号：

- `Horosa-Web/astropy/astrostudy/helper.py`
- `Horosa-Web/astropy/websrv/webchartsrv.py`
- `Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js`
- `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/ChartController.java`
- `Horosa-Web/astrostudysrv/astrostudycn/src/main/java/spacex/astrostudycn/controller/QueryChartController.java`
- `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/PredictiveController.java`
- `Horosa-Web/astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/controller/IndiaChartController.java`

当前统一值是：

- `pd_method_sync_v4`

桌面包这轮重新完整重建后，再次用广德盘 `2006-10-04 09:58 / 30n53 / 119e25 / guangde` 做浏览器取证：

- 页面实际请求的是桌面包自己的 `/chart`
- `dialogs = []`
- `pageErrors = []`
- 前几行重新回到：
  - `-0度4分 / 2006-10-25 10:54:14`
  - `0度21分 / 2007-02-11 16:06:12`
  - `-0度48分 / 2007-07-23 11:01:34`
  - `0度57分 / 2007-09-14 13:37:20`
  - `1度33分 / 2008-04-21 15:49:15`

对应取证文件：

- `runtime/guangde_pkg_browser_check.json`
- `runtime/guangde_pkg_browser_check.png`

这一步的意义不是“又改了一次数学”，而是证明：

- 桌面打包版里的浏览器页面
- 桌面打包版里的 Java `/chart`
- 桌面打包版里的 Python `AstroAPP-Alchabitius`

现在已经重新收敛到同一套生产结果。
