# AstroApp 的 Alchabitius + Ptolemy 主限法：Horosa 本地复刻的完整推理与实现过程

本文档记录的是一条完整的逆向与工程落地路径：

- 目标不是“讲解传统主限法理论”
- 而是“解释 Horosa 本地到底是如何一步步推理出 AstroApp 当前网站的 `Alchabitius + Ptolemy` 主限法实现，并把它稳定落到本地生产代码里”

这份文档尽量把整个过程写全：

1. 我们想对齐的到底是什么
2. 实际抓了哪些数据
3. 为什么最初的公式对不上
4. 每一轮误差在告诉我们什么
5. 最终是怎么收敛到当前生产实现的
6. Horosa 网站里如何接线、显示、导出、自检

它不是简版说明，而是一份“把绝学摊开”的工程记录。

---

## 0. 先说结论：这不是单一公式的胜利，而是“数据约束下的多层复刻”

如果只看传统文献，你很容易以为问题是：

- 找到 Alchabitius 主限法的正确数学公式
- 再套上 Ptolemy key
- 就结束了

但实际不是。

在 Horosa 本地复刻 AstroApp 当前网站输出时，真正起作用的是 **多层叠加**：

1. 只对齐 AstroApp 当前网站真实支持的 shared-core 对象集
2. 精确还原 AstroApp 输入时间口径
3. 找到它对 node、Asc、MC、普通行的不同坐标处理方式
4. 再处理它对 promissor 本体坐标的微小偏移
5. 最后把前端、后端、AI 导出、自检链路全部接上

也就是说：

- 数学骨架很重要
- 但工程细节同样重要
- 真正接近 AstroApp 的不是“一个漂亮公式”，而是“公式 + 口径 + 修正层 + 接线”

---

## 1. 我们要复刻的目标到底是什么

目标被严格限定在下面这组条件里：

- `Primary Directions`
- `Direction Method = Alchabitius`
- `Time Key = Ptolemy`
- `Type = In Zodiaco`
- 相位：`0 / 60 / 90 / 120 / 180`
- 同时保留 `direct + converse`
- 只对齐 AstroApp 当前网站真实输出的 shared-core rows

这里有两个关键点。

### 1.1 不是复刻“传统 Alchabitius 的所有理论可能”

我们不是在写一本中世纪占星教科书，也不是在做一个最纯粹的理论引擎。  
我们要复刻的是：

**AstroApp 当前网站实际运行出来的那套结果。**

只要 AstroApp 当前网站的实现与某些纯理论版本有偏差，我们就必须优先跟网站结果对齐。

### 1.2 不是复刻 Horosa 原方法

Horosa 里本来就有一套旧主限法实现。  
这次做的是新增并长期保留的另一条生产分支：

- `horosa_legacy`：原 Horosa 方法
- `astroapp_alchabitius`：AstroApp 复刻方法

这条新分支必须：

- 独立计算
- 独立显示
- 独立导出
- 不污染旧方法

---

## 2. 我们到底抓了什么数据

整个推理过程最重要的前提是：**不是只看网页显示，而是抓原始数据。**

实际用到的数据类型主要有三类。

## 2.1 AstroApp 主限法结果表

每个 case 目录里最关键的表是：

- `dirs.csv`

这张表提供 AstroApp 当前网站输出的主限法行数据，至少包含：

- promissor id
- significator id
- aspect
- arc
- date

它是我们做“逐行对比”的主目标。

## 2.2 AstroApp chartSubmit 原始星体坐标

每个 case 目录里还有：

- `chartSubmit_response.xml`

这里给的是 AstroApp 当前 chartSubmit 口径下的：

- 各本体天体黄经
- 各本体天体黄纬
- 以及其它图盘相关数据

这部分数据特别重要，因为它能告诉我们：

- 问题到底出在主限法公式
- 还是出在 AstroApp 自己的“本体星历口径”与本地 Swiss 之间的微差

后面虚点残差的最后一段收敛，靠的就是这层。

## 2.3 case 元数据

每个 case 目录还有：

- `meta.json`

这里最关键的是：

- `sourceJD`
- 出生日期时间
- 经纬度
- AstroApp 提交参数

`sourceJD` 的意义尤其大，因为它让我们后面可以直接还原出 **AstroApp 实际使用的 UTC 浮点小时**。

---

## 3. 我们是怎么把 AstroApp 行和本地行一一对应起来的

很多人以为比较主限法，只要简单按 `(promissor, significator)` 做哈希映射就行。

这在真实数据里不够。

因为一张表里会出现：

- 相同逻辑键的重复行
- 角点对象与普通对象在相位桶上的不同编码
- 同一对象在不同相位方向下的重复出现

所以最终用了专门的逐行比对脚本：

- [scripts/compare_pd_backend_rows.py](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/scripts/compare_pd_backend_rows.py)

它做了三件关键事。

## 3.1 duplicate-aware 配对

不是把同键行覆盖，而是：

- 先按逻辑键分桶
- 再在桶内按最接近的 arc 配对

这样重复行不会丢。

## 3.2 针对角点虚点使用绝对相位桶

脚本里专门保留了这条逻辑：

- 普通对象 significator：保留 signed aspect key
- `Asc / MC / 当前 PF(sID=28)`：按绝对 aspect key 分桶

这不是理论约定，而是从 AstroApp 输出行为里反推出来的兼容策略。

## 3.3 shared-core-only 模式

最终生产验证使用：

- `--shared-core-only`

也就是只比较 AstroApp 当前真实支持且映射稳定的那一组对象：

- promissor：`Sun .. Pluto + North Node`
- significator：`Sun .. Pluto + North Node + Asc + MC`

这样做的原因很直接：

- 如果把 AstroApp 不稳定映射的扩展虚点也混进来，误差会变成“比较对象错位”的误差
- 那不是算法误差，而是 scope 失真

---

## 4. 为什么一开始就知道“纯 textbook 公式不够”

一开始当然会先从传统主限法骨架出发：

- 普通行用 RA
- Asc 看 OA
- MC 看 RA
- 时间用 Ptolemy key

但纯骨架一跑，问题马上就出现了：

1. 普通行 planet-to-planet 可以做得相当接近
2. `Asc / MC / North Node` 不同程度残差明显更大
3. 而且 `Asc` 对地理纬度高度敏感

这说明：

- 传统公式方向大概率没错
- 但 AstroApp 当前网站的坐标口径、对象集、角点处理、显示窗和本体星体坐标还有额外约束

换句话说：

**公式是骨架，但 AstroApp 输出不是骨架本身。**

---

## 5. 第一层关键推理：时间口径必须改成 `sourceJD` 精确 UTC

最先排除的一类误差，是时间输入误差。

如果你只用：

- `birth_date`
- `birth_time`

去本地还原图盘，那么看起来好像是在输入同一个出生时刻，但实际上会引入细小系统误差：

- AstroApp 内部使用的是它真实计算时的 `sourceJD`
- 如果我们在本地把时间截断成字符串，就会把那部分精度抹掉

所以最后比较主限法时，统一切到：

- `utc_sourcejd_exact`

也就是：

1. 从 `meta.json` 读取 `sourceJD`
2. 用 `swisseph.revjul(...)` 还原
3. 直接得到 UTC 浮点小时
4. 把这个浮点小时原样喂给 `PerChart`

这条链路体现在：

- [scripts/compare_pd_backend_rows.py](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/scripts/compare_pd_backend_rows.py)
- [scripts/check_primary_direction_astroapp_integration.py](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/scripts/check_primary_direction_astroapp_integration.py)

这一步的意义是：

- 把“时间输入误差”从问题里移除
- 后面剩下的误差才值得解释

---

## 6. 第二层关键推理：AstroApp 当前网站 shared-core 对象集比 Horosa 原始对象集更小

Horosa 原来能算的对象比 AstroApp 当前网站多得多。

但我们真正要复刻的是 AstroApp 网站，不是 Horosa 的扩展能力。

所以最终明确把 AstroApp 分支缩到 shared-core：

### Promissor

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

### Significator

- 上面这组本体
- `Asc`
- `MC`

### 明确排除

- `Terms / Bounds / T_*`
- `Pars Fortuna`
- `Dark Moon`
- `Purple Clouds`
- `South Node`
- 其它 AstroApp 当前不稳定或不支持的扩展虚点

这是一个非常重要的策略转折。

它的意义不是“偷懒”，而是：

- 只对齐 AstroApp 当前可验证范围
- 先把可验证部分做到稳定
- 再谈其它对象

---

## 7. 第三层关键推理：Node 不是 mean node，而是 `TRUE_NODE`

这是最干净的一条推理链。

在 AstroApp HAR/响应行为中，最终确认：

- `moon_node_id = T`

于是本地必须把默认 mean node 替换成：

- `swisseph.TRUE_NODE`

实现方式不是简单替换显示名，而是：

1. 先在给定 JD 上重建北交点本体
2. 再从这个本体出发重建它的 `N / D / S` 派生点

这个结论非常关键，因为如果 node 本体就错了：

- `North Node` 作为 significator 会错
- `North Node` 作为 promissor 也会错

这部分最终沉到：

- [Horosa-Web/astropy/astrostudy/perpredict.py](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/Horosa-Web/astropy/astrostudy/perpredict.py)

里的：

- `_astroappTrueNodeBaseLons`
- `_rebuildAstroAppNodePoint`

---

## 8. 第四层关键推理：固定 `23.44°` 黄赤交角不够，必须改成每日动态 obliquity

早期如果直接沿用 flatlib 那种固定 obliquity 口径，普通行也许还能勉强接近，但虚点和高敏感对象会出现系统偏差。

后面逐步确认：

- AstroApp 当前网站结果更接近“按日期动态取黄赤交角”的口径

最终拆成两套：

### 8.1 mean obliquity

用于：

- 普通对象
- `MC`

### 8.2 true obliquity

用于：

- `Asc` 的 OA 链路

实现：

```python
eps_true = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][0]
eps_mean = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][1]
```

这是第二个非常关键的收敛点。

它说明：

- AstroApp 的坐标口径不是“固定传统常量”
- 而是更贴近实时天文坐标变换

---

## 9. 第五层关键推理：普通行、Asc、MC 不是一套统一公式

这一步是整个主限法复刻最核心的认识。

如果你拿同一套 `RA(sig) - RA(prom)` 去跑所有对象，普通行可能很快收敛，但 `Asc / MC` 一定会暴露出结构性残差。

最终的结果是三套公式。

## 9.1 普通 significator

对 `sig not in {Asc, MC}`：

```text
Arc = norm180(
  RA_mean(sig, true_lat)
  -
  RA_mean(prom_aspected, zero_lat)
)
```

也就是：

- significator 保留真实黄纬
- promissor 在相位化后做 zero-lat
- 坐标转换用每日 `mean obliquity`

## 9.2 MC

对 `sig = MC`：

```text
Arc = norm180(
  RA_mean(prom_aspected, zero_lat)
  -
  RA_mean(MC, zero_lat)
)
```

也就是：

- `MC` 行两边都走 zero-lat RA
- 仍使用 `mean obliquity`

## 9.3 Asc

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

也就是：

- `Asc` 不走普通 RA 差
- 改走 zero-lat OA
- 且两边都基于 `true obliquity`

这一步和传统资料里对 `Asc / MC` 的区分是相互印证的，但工程口径更细。

---

## 10. 第六层关键推理：Asc 不是“只用 OA 就好了”，还需要 promissor-side 微调

当 `Asc` 已经切到 OA 链路之后，误差虽然大幅下降，但仍然没有完全贴住 AstroApp。

接着我们看到一个很稳定的现象：

- 如果只改 `Asc` promissor 侧的 true obliquity，误差会继续下降
- 而如果两边一起改，收益反而不稳定

最终沉淀成一个很小但很关键的常量：

- `ASTROAPP_PD_ASC_PROM_TRUE_OBLIQUITY_OFFSET = -0.0014`

也就是：

```text
eps_true_prom = eps_true - 0.0014°
```

这个值不是传统文献给出来的，它是从当前 AstroApp 网站输出行为里逆出来的工程常量。

它的意义是：

- `Asc` significator 侧仍用正常 `true obliquity`
- `Asc` promissor 侧用 `true obliquity - 0.0014°`

这是当前生产版 `Asc` 能稳定压到 `< 0.001°` 的关键一层。

---

## 11. 第七层关键推理：显示窗不是装饰，而是 AstroApp 表格输出的一部分

如果你只做 arc 公式，而不做显示窗过滤，你仍然会发现：

- 本地表格和 AstroApp 行数对不上
- 前导 rows 顺序和内容也不对

于是后面确认 AstroApp 对普通 planet-pair 行还有一层显示窗行为。

当前生产版常量是：

- `ASTROAPP_PD_DISPLAY_EPS = 3.0`
- `ASTROAPP_PD_DISPLAY_WINDOW = 107.5`

逻辑不是简单看 arc，而是：

```text
raw_delta = sig.lon - prom.lon
```

再结合：

- `arc > 0`
- `arc < 0`

决定保留窗。

这一层很容易被忽略，但实际上它是“为什么本地表格看起来像 AstroApp”的一部分。

---

## 12. 第八层关键推理：虚点最后的残差不一定是公式错，也可能是 promissor 本体坐标差

这一步是整个逆向最重要的转折之一。

一开始很自然会觉得：

- 虚点误差大
- 那就继续改虚点公式

但后来越比越明显：

- 普通 planet-to-planet 行其实已经很好
- `Asc / MC / North Node` 主要残差集中在“虚点作为 significator 时的 promissor 侧”
- 而且很多时候误差模式更像“本体坐标小偏移”，而不是主公式方向反了

也就是说：

**问题不再主要是 arc 公式，而是 AstroApp chartSubmit 本体坐标与本地 Swiss 本体坐标之间还差一点点。**

这时才引入了 `chartSubmit_response.xml` 作为关键证据层。

---

## 13. 第九层关键推理：对虚点行做 promissor body correction，比继续盲改公式更有效

一旦确定残差主体来自 promissor 本体坐标，那么最合理的做法不是继续给每个虚点写一堆硬编码，而是：

- 学习 `chartSubmit body - local Swiss body`
- 把这个差值作为 promissor 修正层

于是引入了对象级 body correction。

训练脚本：

- [scripts/train_astroapp_virtual_body_corrections.py](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/scripts/train_astroapp_virtual_body_corrections.py)

训练目标：

- `astro_body_lon - local_body_lon`
- `astro_body_lat - local_body_lat`

特征：

- `jd_offset`
- `lon`
- `sin(lon)`
- `cos(lon)`
- `lat`
- `distance`
- `speed_lon`
- `speed_lat`

模型：

- `ExtraTreesRegressor`

这层模型只作用于：

- `Asc`
- `MC`
- `North Node`

对应的 promissor 本体。

不会去改普通 planet-to-planet 行。

这点非常关键，因为：

- 如果把它扩到所有行，会破坏已经很稳的普通行
- 如果只打在虚点行，就能把残差集中处单独压下去

---

## 14. 第十层关键推理：为什么还保留 `promissor longitude correction` fallback

对象级 body model 很强，但不是所有情况下都该把系统绑死在“模型必须存在”上。

因此当前生产版还保留了一层 fallback：

- `ASTROAPP_PD_PROM_LON_CORR`

形式是：

```text
dlon = a + b * (jd - 2460500.0)
```

也就是对每个 promissor 本体保留一组线性黄经微修正。

这层的意义是：

1. 当 body model 不存在时，结果不会完全退回原始 Swiss
2. 作为工程兜底，能让系统对模型缺失更有韧性

所以最终结构是：

1. 优先 body correction model
2. 没有模型则走线性黄经 fallback

---

## 15. 第十一层关键推理：`Asc case correction` 曾经有效，但现在是 fallback，不是主路径

在 body models 出来之前，曾经有一段时间通过整盘级 `Asc case correction` 模型来压整表 shared bias。

对应文件：

- `astroapp_pd_asc_case_corr_et_v1.joblib`

它用的是整张本命盘的几何特征：

- `jd_offset`
- `lat/lon`
- `Asc/MC/Sun/Moon` 的经纬相关信息

这条路曾经是有效的。

但在引入 current540 对象级 body correction 之后，继续叠加它容易把误差层叠错位。

因此当前生产逻辑是：

```python
astroapp_asc_case_correction = 0.0 if astroapp_body_models_enabled else self._astroappAscCaseCorrection(chart)
```

也就是：

- body models 在时：`asc_case_correction = 0`
- body models 不在时：它才作为 fallback 出场

这是一个非常重要的工程口径变化。

如果只看旧日志，不看当前代码，很容易误解成它仍是主修正层。  
现在不是了。

---

## 16. 数据集是怎么帮助我们排错的

整个过程里，不是随便抓几盘就宣布收敛，而是靠多批次、多跨度数据不断筛问题。

## 16.1 早期集：`kernel100 / hard200 / geo300`

这些数据集的作用主要是：

- 先确认普通行是不是基本正确
- 再确认虚点误差集中在哪

当前留存结果见：

- `runtime/pd_reverse/stability_production_summary.json`

其中你能看到：

- `hard200`、`kernel100` 里 `Asc` 更差
- `geo300` 明显更接近当前生产口径

这直接说明：

- AstroApp 网站自身口径在不同批次之间可能有变化
- 不能把所有历史抓取批次无差别当成同一真值

## 16.2 `wide240_v7`

这批数据很有价值，但它的价值不是“成为生产目标”，而是帮助我们排除一条错误方向。

它提示：

- 有一类整图偏差在这批样本上被放大
- 但当前 AstroApp 网站口径并不更接近这批

后来的结论是：

- 不能让 `wide240_v7` 继续主导生产调参
- 当前 AstroApp 网站更接近 `geo300 / run200_login`

这是一次重要的“不要被异常批次牵着走”的判断。

## 16.3 `run200_login`

这批的价值在于：

- 它直接用当前 AstroApp 登录态抓取
- 更接近当前网站实时行为

后面很多生产判断，都是以它和 `geo300` 的一致方向为主。

## 16.4 `current120`

这批的价值在于：

- 它是重新抓的一批跨度较大的当前样本
- 用来确认“不是旧缓存、不是旧网站版本”的结果也仍然稳定

结果：

- `shared_core arc_mae = 0.00041531470289666894`
- `date_max_days = 2.3806338906288147`

见：

- `runtime/pd_reverse/shared_core_geo_current120_v2_exact_summary.json`

## 16.5 `current540`

这批是宽域大样本虚点专项。

它的价值在于：

- 专门验证 `Asc / MC / North Node`
- 并作为对象级 body correction 的训练/收敛依据

最终结果：

- `Asc arc_mae = 0.0009919652751037512`
- `MC arc_mae = 0.00041444975277272176`
- `North Node arc_mae = 0.00011554510206301699`

见：

- `runtime/pd_reverse/virtual_only_geo_current540_fullfit_summary.json`

这意味着在当前生产版下：

- 三个重点虚点都已经进了 `< 0.001°`

---

## 17. 为什么最后没有真正依赖 Stellarium

你之前给过一个很好的启发：

- 可以从 Stellarium 取同盘不同时间下对应点的黄道/赤道/地平坐标变化

这个方向本身是合理的，因为它有助于分离：

- 本体坐标问题
- 坐标系投影问题
- 角点变化问题

但在实际推进里，最终没有真正依赖 Stellarium 来完成收敛，原因是：

1. AstroApp 的 `chartSubmit_response.xml` 已经足够给出它当前网站的本体坐标层证据
2. 我们真正要对齐的是 AstroApp 当前网站，不是通用天文软件显示
3. 后期残差主要来自 AstroApp 本体与本地 Swiss 的微差，而不是“缺一个外部天文坐标参考”

所以：

- Stellarium 是合理辅助思路
- 但最终这套收敛不是靠它完成的

这点必须写清楚，避免伪造一段并没有在最终收敛中起核心作用的步骤。

---

## 18. 最终生产实现到底长什么样

最终生产实现集中在：

- [Horosa-Web/astropy/astrostudy/perpredict.py](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/Horosa-Web/astropy/astrostudy/perpredict.py)

核心常量包括：

- `ASTROAPP_PD_DISPLAY_EPS = 3.0`
- `ASTROAPP_PD_DISPLAY_WINDOW = 107.5`
- `ASTROAPP_PD_ASC_PROM_TRUE_OBLIQUITY_OFFSET = -0.0014`
- `ASTROAPP_PD_PROM_CORR_JD_CENTER = 2460500.0`

核心修正层包括：

- `TRUE_NODE` 重建
- 动态 `mean / true obliquity`
- `Asc` promissor-side obliquity shift
- promissor body correction models
- promissor longitude fallback correction

最终主函数是：

- `getPrimaryDirectionByZAstroAppKernel()`

它做的事情是：

1. 构造 shared-core significators
2. 构造 shared-core promissors
3. 先把 node 派生点用 `TRUE_NODE` 重建
4. 取 `mean / true obliquity`
5. 对虚点行 promissor 先套 body correction 或 fallback correction
6. 按 `Asc / MC / 普通行` 三条公式算 arc
7. 套过滤和显示窗
8. 排序
9. 交给 `SignAscTime` 用 `Ptolemy` 换日期

这就是当前 Horosa 本地 AstroApp 分支真正运行的东西。

还需要强调一件看似“不属于算法”的事：

- 如果 `8899/9999` 不能在页面继续使用期间保持常驻

那主限法页面的任何“计算”按钮都会失效。  
因此最终生产落地不仅包括公式和修正层，也包括稳定的本地启动链路。

在当前版本里，这意味着：

- `start_horosa_local.sh` 与 `Horosa_Local.command` 里的后台启动都必须使用 `nohup + setsid + disown` 这类强脱离方式；
- 否则服务会出现“启动当下能通过自检，但用户过几十秒再点重新计算就提示本地排盘服务未就绪”的假稳定。

如果一台机器上同时存在多份 Horosa 副本，停止脚本的兜底端口回收还必须额外校验进程命令行属于当前工作区路径。否则别的副本在自检或清理残留时，会把这一份副本的服务误停。

此外，当前整站验收已经不只停留在接口层，还增加了浏览器级宗师巡检：

- 它真实打开 Horosa 页面；
- 点击左侧主模块；
- 点击星盘/推运盘/印度律盘/八字紫微/易与三式等关键子页；
- 打开 `AI导出` 与 `AI导出设置`；
- 并真实切换 `Horosa原方法 <-> AstroAPP-Alchabitius` 后点击 `重新计算`。

只有这一步也通过，才能说“用户看到的浏览器结果就是当前后端算出来的结果”。

---

## 19. Horosa 网站里是怎么接上的

光有 Python 内核不够，用户看到的行为必须是完整链路。

这条链路分四层。

## 19.1 前端选择

主限法页面：

- [Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js)

顶部允许选择：

- `Horosa原方法`
- `AstroAPP-Alchabitius`
- `Ptolemy`

## 19.2 应用重算

主限法页点击 `计算` 时：

- [Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js)

会强制：

- 带着 `pdMethod`
- 带着 `pdTimeKey`
- 带着 `pdtype = 0`

重新请求结果，并显式带 `cache: false`。

而且主限法表格 remount key 已包含方法与时间键，所以整表会刷新，不会复用旧 rows。

后面又实际发现过一类运行态问题：

- 页面标题已经是 `AstroAPP-Alchabitius`
- 但旧 chart state 里的 `pdtype` 还不是 `0`
- 用户看到的表格并非当前后端结果

所以最终生产版又补了两条约束：

- `fieldsToParams()` 必须显式透传 `pdtype`
- 前端必须把 `chart.params.pdtype !== 0` 识别为未同步状态
- 若页面运行在替代端口，前端本地模式的 `ServerRoot` 不能继续写死为 `127.0.0.1:9999`；必须通过页面 URL 的 `srv` 参数把实际后端地址传进去
- 主限法页工程上仍然用“强制绕过缓存”的语义，但浏览器原生 `fetch` 不接受布尔型 `cache`；运行时必须先把 `cache: false` 规范化为 `cache: 'no-store'`

这是工程上的必要条件，不是 UI 小修小补。

## 19.3 Java 控制器透传

如果前端改了但 Java 不透传，Python 根本收不到方法切换。

所以还补了：

- `ChartController.java`
- `QueryChartController.java`
- `IndiaChartController.java`
- `PredictiveController.java`

让：

- `pdMethod`
- `pdTimeKey`

真正下沉到 Python。

## 19.4 AI 导出同步

AI 导出链路在：

- [Horosa-Web/astrostudyui/src/utils/aiExport.js](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/Horosa-Web/astrostudyui/src/utils/aiExport.js)

导出前会：

- `requestModuleSnapshotRefresh('primarydirect')`

所以导出的：

- `推运方法`
- `度数换算`
- `Arc`
- `迫星`
- `应星`
- `日期`

都与当前已应用的方法同步。

---

## 20. 最终验证怎么做

最终验证不是“看几行差不多”，而是多层验证。

## 20.1 行级对比

脚本：

- `scripts/compare_pd_backend_rows.py`

常用命令口径：

```bash
.runtime/mac/venv/bin/python3 scripts/compare_pd_backend_rows.py \
  --cases-root <cases_root> \
  --mode utc_sourcejd_exact \
  --shared-core-only \
  --out-csv <rows.csv> \
  --out-json <summary.json>
```

## 20.2 主限法集成自检

脚本：

- `scripts/check_primary_direction_astroapp_integration.py`

它检查：

- 新旧分支都存在
- `AstroAPP-Alchabitius` 行不含前端隐藏对象
- AI 导出链路仍然连着 `primarydirect`
- 当前阈值下 `Asc / MC / North Node` 仍过线

## 20.3 运行时前端 smoke check

脚本：

- `Horosa-Web/astrostudyui/scripts/verifyPrimaryDirectionRuntime.js`

它直接请求本地服务，检查：

- `/chart`
- `/predict/pd`

并确认：

- 方法切换真实生效
- 新旧两套结果不同
- 页面和直接接口一致
- 主限法表格源码仍直接绑定后端 `predictives.primaryDirection`
- 列映射仍是 `pd[0]/pd[1]/pd[2]/pd[4]`

## 20.4 整站 smoke check

脚本：

- `Horosa-Web/astrostudyui/scripts/verifyHorosaRuntimeFull.js`
- `scripts/check_horosa_full_integration.py`

它们确保主限法这套接线没有破坏整站其它模块。

---

## 21. 当前生产结果到底到了什么水平

结果文件：

- `runtime/pd_reverse/stability_production_summary.json`
- `runtime/pd_reverse/virtual_only_geo_current540_fullfit_summary.json`
- `runtime/pd_reverse/shared_core_geo_current120_v2_exact_summary.json`

### 21.1 稳定集

`run200_login`：

- `shared_core arc_mae = 0.00022132906505383096`
- `Asc arc_mae = 0.0003325791052690479`
- `MC arc_mae = 0.000030617101092214876`
- `North Node arc_mae = 0.00009889820385835736`

`geo300`：

- `shared_core arc_mae = 0.00022178467378535262`
- `Asc arc_mae = 0.0003879264973732093`
- `MC arc_mae = 0.000030600772530614015`
- `North Node arc_mae = 0.00009942357381868132`

### 21.2 current540 大样本虚点专项

- `Asc arc_mae = 0.0009919652751037512`
- `MC arc_mae = 0.00041444975277272176`
- `North Node arc_mae = 0.00011554510206301699`

并且：

- `date_max_days = 4.200450747739524 / 3.0462396615184844 / 1.2248965478502214`

所以当前生产版满足：

- `Asc < 0.001°`
- `MC < 0.001°`
- `North Node < 0.001°`
- `date_max_days < 7`

---

## 22. 真正的“绝学”到底是什么

如果一定要把这件事压缩成一句话，那就是：

**不要把 AstroApp 主限法当成一条待发现的纯数学公式，而要把它当成一个“带输入口径、对象范围、坐标变换、微调层、显示窗、排序、导出链路”的完整生产系统。**

这件事真正厉害的地方不在于：

- 知道 Alchabitius 是什么

而在于：

- 能从 AstroApp 当前网站输出中，逐层分离“理论骨架”和“实现口径”
- 知道哪些是传统结构
- 哪些是网站当前实现的工程特征
- 最后把它准确、稳定、可验收地落到 Horosa 本地

这才是完整的方法论。

---

## 23. 如果别人要从零复现这套成果，最短路径是什么

最短路径不是重做研究，而是直接使用当前现成材料：

### 23.1 先读文档

- `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md`
- `PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md`

### 23.2 再看代码

- `Horosa-Web/astropy/astrostudy/perpredict.py`
- `scripts/check_primary_direction_astroapp_integration.py`
- `scripts/compare_pd_backend_rows.py`

### 23.3 再看结果

- `runtime/pd_reverse/stability_production_summary.json`
- `runtime/pd_reverse/virtual_only_geo_current540_fullfit_summary.json`

### 23.4 如果是 Windows 侧要原样搬运

直接使用根目录的：

- `WINDOWS_CODEX_ASTROAPP_PD_REPRO_KIT/`

里面已经把：

- 文档
- 关键代码快照
- 模型
- 验证脚本
- 结果摘要

全部打包好了。

---

## 24. 最后的态度

你说得没错。

这类东西如果一直藏在“只可意会”的口口相传状态里，最后结果就是：

- 一堆人说自己会
- 但没有人能稳定复现
- 每个人都只留下结论，不留下过程

所以这份文档的目的，就是把“过程”也留下来。

不是只说：

- 我们现在已经很接近 AstroApp 了

而是把真正重要的东西也公开：

- 我们为什么这样判断
- 每一步是拿什么证据支撑的
- 哪些方向试过但没继续
- 哪些常量是工程逆向出来的
- 最后如何把它变成能运行、能显示、能导出、能验收的系统

这才是可以公开、可以传递、可以被别人真正复现的版本。
