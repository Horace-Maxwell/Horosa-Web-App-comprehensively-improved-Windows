# AstroApp `Alchabitius + Ptolemy` 主限法本地复刻：一份适合公开发布的工程整理稿

## 摘要

本文讨论的不是“传统主限法理论如何讲解”，而是一个更具体、也更适合当代工程环境的问题：

**如何在本地系统中，尽可能稳定、可验证地复刻 AstroApp 当前网站所输出的 `Alchabitius + Ptolemy` 主限法结果。**

这个问题的难点并不在于找到一条漂亮的理论公式，而在于把一个真实网站的生产行为分解为若干可验证的层面：

- 输入时间口径
- 支持对象范围
- 坐标变换
- 角点与普通行的差异
- 本体星历的微小偏移
- 表格显示窗、排序与日期换算
- 前端、后端、导出与自检的完整接线

最终，Horosa 本地实现并不是通过“单一数学发现”得到的，而是通过一套逐层收缩误差的逆向方法获得的。当前生产版已经将重点虚点控制在目标阈值以内：

- `Asc < 0.001°`
- `MC < 0.001°`
- `North Node < 0.001°`
- `date_max_days < 7`

对应实现位于：

- [perpredict.py](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/Horosa-Web/astropy/astrostudy/perpredict.py)
- [PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md)
- [ASTROAPP_ALCHABITIUS_PTOLEMY_REVERSE_ENGINEERING_FULL_PROCESS.md](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/ASTROAPP_ALCHABITIUS_PTOLEMY_REVERSE_ENGINEERING_FULL_PROCESS.md)

## 一、问题的定义：复刻“当前网站输出”，而不是抽象理论

必须先明确目标，否则整个工程会迅速发散。

本项目要复刻的，不是所有可能版本的 Alchabitius 主限法，也不是某一本古典教材中的理想形态，而是 AstroApp 当前网站在以下条件下的实际行为：

- `Primary Directions`
- `Direction Method = Alchabitius`
- `Time Key = Ptolemy`
- `Type = In Zodiaco`
- 相位集：`0 / 60 / 90 / 120 / 180`
- 同时保留 `direct + converse`

因此，判断一条实现是否正确的标准，不是“它是否在理论上优雅”，而是：

1. 是否能和 AstroApp 当前网站逐行比较；
2. 是否能稳定通过多批样本；
3. 是否能被接进本地网站并保持显示、导出、自检的一致性。

这意味着整个项目从一开始就必须采取工程复刻而不是纯理论推导的姿态。

## 二、证据层：我们究竟抓取了什么

这套复刻方法成立的前提，是直接使用 AstroApp 的原始输出，而不是只看网页截图或人工记录。

实际使用的证据主要分为三层。

### 1. 主限法结果表

每个 case 目录中的 `dirs.csv` 记录了 AstroApp 当前网站的主限法结果行。它至少提供：

- promissor
- significator
- aspect
- arc
- date

这是逐行对比的直接目标。

### 2. `chartSubmit` 本体坐标

每个 case 目录中的 `chartSubmit_response.xml` 提供当前网站图盘计算时所用的本体坐标，包括：

- 黄经
- 黄纬
- 其它图盘相关原始量

它的价值在于区分两类误差来源：

- 主限法公式本身的误差
- AstroApp 本体星历口径与本地 Swiss 之间的微差

后期虚点误差的进一步收敛，恰恰依赖于这一层。

### 3. 元数据

每个 case 目录中的 `meta.json` 提供：

- `sourceJD`
- 出生日期时间
- 经纬度
- 提交参数

其中 `sourceJD` 极其关键，因为它使得本地可以还原 AstroApp 实际使用的 UTC 浮点时间，而不是只用字符串级别的出生时间近似代替。

## 三、比较方法：为什么不能只做简单键值匹配

真实网站输出的数据并不总是能被一个简单键唯一标识。表中存在：

- 重复逻辑键
- 角点对象与普通对象不同的相位分桶行为
- 同一对象在不同方向下的重复出现

因此，对比策略必须先于公式讨论。

最终采用的核心工具是：

- [compare_pd_backend_rows.py](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/scripts/compare_pd_backend_rows.py)

它实现了三条关键规则。

### 1. duplicate-aware 配对

不是“同键覆盖”，而是：

- 先分桶
- 再在桶内按 arc 最近原则配对

这样重复行不会被错误吞掉。

### 2. 角点虚点的绝对相位桶

对普通对象，保留 signed aspect key；  
对 `Asc / MC` 及相关虚点，则按绝对相位桶处理。

这不是理论规定，而是从 AstroApp 当前输出行为中归纳出的兼容策略。

### 3. `shared-core-only`

最终生产比较只保留 AstroApp 当前稳定支持且映射明确的 shared-core 对象集：

- promissor：`Sun .. Pluto + North Node`
- significator：`Sun .. Pluto + North Node + Asc + MC`

这一步非常重要，因为很多“误差”其实不是算法错，而是比较对象超出了网站当前稳定支持范围。

## 四、第一条决定性推理：时间口径必须切到 `sourceJD`

如果本地只拿 `birth_date + birth_time` 来重建图盘，看起来像是在输入同一个时间，但本质上仍然会有系统误差。原因很简单：

- AstroApp 内部真正参与计算的是 `sourceJD`
- 将其还原为字符串后再喂给本地，精度会被截断

因此最终比较统一采用：

- `utc_sourcejd_exact`

具体做法是：

1. 从 `meta.json` 读取 `sourceJD`
2. 用 `swisseph.revjul(...)` 还原真实 UTC
3. 直接使用浮点小时参与本地图盘计算

这一步不是小优化，而是把“时间输入误差”从问题中剥离出去，使后续误差具有解释价值。

## 五、第二条决定性推理：对象集必须以 AstroApp 当前网站为准

Horosa 原有主限法能计算的对象比 AstroApp 当前网站更多，但复刻目标不是 Horosa 的历史能力，而是 AstroApp 的当前行为。

因此最终将 AstroApp 分支限制在 shared-core 对象集内：

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

- 上述本体
- `Asc`
- `MC`

### 明确排除

- `Terms / Bounds`
- `Pars Fortuna`
- `Dark Moon`
- `Purple Clouds`
- `South Node`
- 其它当前网站映射不稳定或未稳定支持的扩展虚点

这一步并不是功能削弱，而是把目标空间收窄到真正可验证、可收敛的范围。

## 六、第三条决定性推理：Node 必须改为 `TRUE_NODE`

这是整个项目中证据最直接的一环。通过 AstroApp 响应数据可确认：

- 当前网站使用的是 true node，而不是 mean node

因此本地实现中，北交点不能只改显示名，必须从本体层彻底重建：

1. 使用 `swisseph.TRUE_NODE` 获取给定 JD 的真实北交点；
2. 再据此重建其相关派生点。

这部分最终落在：

- [perpredict.py](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/Horosa-Web/astropy/astrostudy/perpredict.py)

中的 node 重建逻辑。

## 七、第四条决定性推理：固定黄赤交角不够，必须使用动态 obliquity

如果用固定常量（例如传统近似值 `23.44°`）做坐标转换，普通行也许看起来问题不大，但虚点和高敏感对象会留下稳定的系统偏差。

后续比较逐步确认，AstroApp 当前网站更接近按日期动态计算的黄赤交角：

- `mean obliquity` 用于普通对象与 `MC`
- `true obliquity` 用于 `Asc` 的 OA 链路

实现上，核心值来自：

```python
eps_true = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][0]
eps_mean = swisseph.calc_ut(jd, swisseph.ECL_NUT)[0][1]
```

这一点说明 AstroApp 的当前实现并非简单依赖固定传统常量，而更接近实时天文坐标口径。

## 八、第五条决定性推理：普通行、`MC` 与 `Asc` 必须分开处理

最早的自然假设是：所有行都可以由同一套 RA 差公式覆盖。实践证明这不成立。

经过逐步验证，最终形成了三类主路径。

### 1. 普通 significator

对 `sig not in {Asc, MC}`：

```text
Arc = norm180(
  RA_mean(sig, true_lat)
  -
  RA_mean(prom_aspected, zero_lat)
)
```

### 2. `MC`

对 `sig = MC`：

```text
Arc = norm180(
  RA_mean(prom_aspected, zero_lat)
  -
  RA_mean(MC, zero_lat)
)
```

### 3. `Asc`

对 `sig = Asc`：

```text
Arc = norm180(
  OA_true_zero_shifted_prom(prom_aspected)
  -
  OA_true_zero(Asc)
)
```

这一步与传统资料里“`MC` 看 RA、`Asc` 看 OA”的结构是吻合的，但工程实现更细，因为每一侧到底用真实黄纬还是 zero-lat，并不是文献直接给出的，而是通过 AstroApp 输出行为逐步识别出来的。

## 九、第六条决定性推理：`Asc` 还需要 promissor-side 微调

当 `Asc` 已经切换到 OA 路径后，误差会明显下降，但仍然不足以贴住当前网站。

继续实验后发现：

- 若只调整 promissor 侧的 `true obliquity`，误差继续下降；
- 若两边一起调整，则收益不稳定。

于是最终引入一个工程常量：

- `ASTROAPP_PD_ASC_PROM_TRUE_OBLIQUITY_OFFSET = -0.0014`

其含义是：

- `Asc` significator 侧仍使用正常 `true obliquity`
- promissor 侧则使用 `true obliquity - 0.0014°`

这一常量不是理论文献提供的，而是网站行为逆向的结果。它也是当前 `Asc` 能稳定压到 `< 0.001°` 的关键层之一。

## 十、第七条决定性推理：显示窗属于输出行为的一部分

如果只关心 arc 公式，而忽略 AstroApp 的表格显示逻辑，那么最终即使 arc 很接近，页面行数和排序也会明显不同。

因此当前生产版还包含显示窗逻辑，核心常量为：

- `ASTROAPP_PD_DISPLAY_EPS = 3.0`
- `ASTROAPP_PD_DISPLAY_WINDOW = 107.5`

其本质不是“界面装饰”，而是 AstroApp 表格生成规则的一部分。  
这也是为什么最终复刻不是一个单纯的数学问题，而是“计算 + 呈现”共同构成的系统问题。

## 十一、第八条决定性推理：残差后期主要来自 promissor 本体坐标，而不是公式方向

一开始，看到虚点误差较大，很容易继续怀疑虚点公式本身。  
但随着普通 planet-to-planet 行稳定收敛、`Asc / MC / North Node` 仍留下相对固定残差，问题的性质已经改变了：

- 普通公式骨架大致正确
- 剩余误差更像 promissor 本体坐标的细小偏移

这正是 `chartSubmit_response.xml` 发挥决定作用的地方。它显示：

- AstroApp 当前网站本体坐标与本地 Swiss 之间确实存在微差
- 这些微差会在虚点行上被放大

因此，后期最有效的不是继续盲改公式，而是学习并补偿本体坐标差。

## 十二、第九条决定性推理：对象级 body correction 比整表硬编码更优

一旦确认问题主要来自 promissor 本体坐标差，最自然的工程方案就是建立对象级 correction layer。

训练脚本：

- [train_astroapp_virtual_body_corrections.py](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/scripts/train_astroapp_virtual_body_corrections.py)

目标：

- 学习 `astro_body - local_swiss_body`

特征包括：

- `jd_offset`
- `lon`
- `sin(lon)`
- `cos(lon)`
- `lat`
- `distance`
- `speed_lon`
- `speed_lat`

模型为：

- `ExtraTreesRegressor`

这层 correction 只作用于：

- `Asc`
- `MC`
- `North Node`

对应虚点行所使用的 promissor 本体。

它不扩散到所有 planet-to-planet 行，原因很清楚：普通行本来就已经稳定，盲目扩散只会破坏已经正确的部分。

## 十三、为什么仍保留线性 promissor fallback correction

对象级 body model 是主路径，但系统不能完全依赖“模型一定存在”。因此当前生产版还保留了线性 fallback correction：

```text
dlon = a + b * (jd - 2460500.0)
```

这层不是主力，而是工程兜底：

1. 没有模型时，不至于完全回退到原始 Swiss；
2. 使系统在模型文件缺失时仍然具有可运行性。

因此当前结构是：

1. 优先 body correction model
2. 其次使用线性 longitude fallback

## 十四、`asc_case_correction` 的地位：从主修正层退为 fallback

在 body models 出现之前，整盘级 `Asc case correction` 曾经是压低 shared bias 的有效方法。  
但在对象级 correction 成熟后，如果继续叠加这层修正，容易出现偏移叠加问题。

因此当前生产逻辑改为：

- body model 存在时，不再使用 `asc_case_correction`
- 只有在模型缺失时，它才作为 fallback 出场

这是一个典型的工程演化案例：  
同一工具在某一阶段是主修正层，进入下一阶段后则应当退居兜底位置。

## 十五、实现的真正完成，发生在“网站接线”而不是算法文件内部

如果只在 Python 中完成算法，而没有把前后端链路打通，那么这项工作并不算完成。

当前 Horosa 的完整接线包括：

### 1. Python 内核

- [perpredict.py](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/Horosa-Web/astropy/astrostudy/perpredict.py)

核心入口：

- `getPrimaryDirectionByZAstroAppKernel()`

### 2. 图盘参数承接

- [perchart.py](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/Horosa-Web/astropy/astrostudy/perchart.py)
- [webchartsrv.py](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/Horosa-Web/astropy/websrv/webchartsrv.py)

### 3. 前端方法切换

- [AstroPrimaryDirection.js](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/Horosa-Web/astrostudyui/src/components/astro/AstroPrimaryDirection.js)
- [AstroDirectMain.js](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/Horosa-Web/astrostudyui/src/components/direction/AstroDirectMain.js)

其中：

- `AstroAPP-Alchabitius`
- `Horosa原方法`
- `Ptolemy`

都必须真实透传，而不是停留在前端文字层面。

后期又补了一层很关键的运行态约束：

- `fieldsToParams()` 必须把 `pdtype` 真正送到 `/chart`
- 点击重算必须显式绕过前端 chart 缓存
- 如果 `chart.params.pdtype !== 0`，页面必须认定当前 rows 未同步
- 如果当前副本因为端口冲突改跑在替代端口，前端还必须通过页面 URL `srv` 参数切换到正确的本地 `ServerRoot`
- 浏览器原生 `fetch` 不接受布尔型 `cache`；所以运行时代码必须把 `cache: false` 规范化成 `cache: 'no-store'`

否则就会出现一种很迷惑的假象：

- 后端已经与 AstroApp 当前网页高度接近
- 用户页面仍显示旧 rows
- 结果看起来像“算法没复刻对”

实际上错的是页面运行态同步，而不是主限公式。

同理，若本地排盘服务没有稳定常驻，用户也会误以为“主限法有问题”。  
所以工程实现里还必须保证：

- 页面仍在使用时，`8899/9999` 不能被验收脚本或外层 shell 顺手带走。
- 当前版本里，这要求本地启动脚本把后台服务用 `nohup + setsid + disown` 这类方式真正脱离父 shell，而不是只把它们放到普通后台。
- 若同机存在多个 Horosa 副本，停止脚本还必须限定只回收当前工作区的服务实例，否则一个副本的验收会干掉另一个副本正在提供的主限法服务。

我们还额外加入了浏览器级验收，而不是只检查接口返回：

- 真正打开 Horosa 页面；
- 点击左侧主模块和关键右栏技术页；
- 打开 `AI导出` 与 `AI导出设置`；
- 在主限法页真实切换 `Horosa原方法` 与 `AstroAPP-Alchabitius` 并重新计算。

这一步的意义是，证明“页面看到的内容”与“后端刚算出来的 rows”一致，而不是仅仅证明后端接口本身正确。

### 4. Java 控制器透传

- `ChartController.java`
- `QueryChartController.java`
- `IndiaChartController.java`
- `PredictiveController.java`

这些控制器保证：

- `pdMethod`
- `pdTimeKey`

能真正进入 Python 计算层。

### 5. AI 导出与 AI 导出设置

- [aiExport.js](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/Horosa-Web/astrostudyui/src/utils/aiExport.js)

导出前会主动刷新 `primarydirect` 快照，因此：

- `Arc`
- `迫星`
- `应星`
- `日期`
- `推运方法`
- `度数换算`

都与当前已应用的方法一致。

## 十六、验证框架：没有可重复验证，就没有“复刻”

当前验证分为四层。

### 1. 行级对比

- [compare_pd_backend_rows.py](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/scripts/compare_pd_backend_rows.py)

负责逐行配对、误差统计与 shared-core 比较。

### 2. 主限法集成自检

- [check_primary_direction_astroapp_integration.py](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/scripts/check_primary_direction_astroapp_integration.py)

负责检查：

- 新旧方法双分支是否并存
- 方法切换是否真实影响 `/chart` 与 `/predict/pd`
- AI 导出链路是否仍指向 `primarydirect`
- 在完整仓库中，阈值验证是否仍然过线
- 在精简部署包中，是否能降级为不依赖大 runtime 的轻校验

### 3. 主限法运行时 smoke check

- [verifyPrimaryDirectionRuntime.js](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/Horosa-Web/astrostudyui/scripts/verifyPrimaryDirectionRuntime.js)

### 4. 整站 smoke check

- [verifyHorosaRuntimeFull.js](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/Horosa-Web/astrostudyui/scripts/verifyHorosaRuntimeFull.js)
- [check_horosa_full_integration.py](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/scripts/check_horosa_full_integration.py)

这几层共同保证：主限法增强不会破坏 Horosa 整站。

## 十七、当前结果：我们到底复刻到了什么程度

代表性结果包括：

- `run200_login`
- `geo300`
- `current120`
- `current540`

其中当前生产版最关键的虚点专项结果为：

- `Asc arc_mae = 0.0009919652751037512`
- `MC arc_mae = 0.00041444975277272176`
- `North Node arc_mae = 0.00011554510206301699`

并且：

- `date_max_days = 4.200450747739524 / 3.0462396615184844 / 1.2248965478502214`

因此，在当前网站版本与当前本地实现之间，重点虚点已经满足：

- `arc_mae < 0.001°`
- `date_max_days < 7`

这不是“单盘偶然命中”，而是多批样本反复比较后的稳定结果。

## 十八、方法论上的真正结论

如果把整个项目压缩成一句话，那么真正值得公开的经验不是某条神秘公式，而是下面这个判断：

**AstroApp 的主限法不能被理解为一条孤立公式，它必须被理解为“输入口径 + 对象范围 + 坐标转换 + 本体修正 + 显示规则 + 前后端接线 + 验证体系”共同构成的生产系统。**

这也是为什么很多“我知道 Alchabitius 理论”的人，仍然无法稳定复刻 AstroApp 当前网站输出。  
他们掌握的是骨架，但缺少系统。

## 十九、对公开传播的建议

如果要把这项工作公开分享，最合理的做法不是只发布结果截图，而应同时保留三层材料：

### 1. 生产实现说明

- [PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_REPLICATION.md)

### 2. 数学流程说明

- [PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/PRIMARY_DIRECTION_ASTROAPP_ALCHABITIUS_MATH_FLOW.md)

### 3. 完整逆向过程档案

- [ASTROAPP_ALCHABITIUS_PTOLEMY_REVERSE_ENGINEERING_FULL_PROCESS.md](/Users/horacedong/Desktop/Horosa-Primary%20Direction%20Trial/ASTROAPP_ALCHABITIUS_PTOLEMY_REVERSE_ENGINEERING_FULL_PROCESS.md)

本文档则适合作为公开发布的整理稿：  
既保留工程结论和证据链，也把行文从实验记录整理成正式论述。

## 二十、结语

所谓“绝学”，真正可贵的地方从来不是“只有少数人会”，而是“它能否被完整地讲明白，并且被别人复现”。

如果一项技术只能留下结论，不能留下证据、推理和实现路径，那么它迟早会退化成模糊的口耳相传。  
而当 AI 和工程工具已经足够强大时，把过程公开出来，反而是保护方法本身最有效的方式。

就这个项目而言，真正值得公开的，不只是 Horosa 现在已经很接近 AstroApp 的结果，而是：

- 我们是如何定义目标的；
- 我们是如何抓原始证据的；
- 我们如何知道哪一步是理论骨架，哪一步是网站口径；
- 我们如何把一组误差，逐步变成一套可运行、可显示、可导出、可自检的系统。

这才是这份整理稿希望留下的东西。
