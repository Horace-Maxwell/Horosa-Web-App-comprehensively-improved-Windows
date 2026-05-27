# 八字/太乙/五兆 月柱交節邊界修复（v2.1.8 批次）

> 日期：2026-05-26　范围：`vendor/kinwuzhao`、`vendor/kinastro`、`vendor/kintaiyi` 的四柱月柱（年柱）。
> 面向 Windows 同步：**纯 vendored Python，随 runtime 包 rsync，不需重编 `astrostudyboot.jar`**。
> 来源：v2.1.6 修 kinqimen 月柱后，主动扫描发现同类「日级月柱」bug 遍布其他三个 kentang 引擎。

---

## 1. 根因（与 kinqimen #53/#9 同类）
这三个引擎都用 sxtwl 的**日级** `getMonthGZ()` 取月柱：交節當日整日已跳入新月，故交節當日、交節時刻**之前**的時間被誤算進新月（立春時年柱同樣問題）。例：2005-05-05 立夏交節 17:52，16:30 月柱被算成辛巳，應為庚辰。

受影响面（kinastro 尤其广，是八字引擎）：
- **kinwuzhao**：五兆 + 其八字。
- **kinastro**：八字、数算（邵子/铁板/鬼谷/北极/南极/蠢子/万化）、演禽、七政四余——全经 `_compute_four_pillars`。
- **kintaiyi**：太乙四柱（`kintaiyi.py` `_get_gangzhi` → `config.gangzhi`）。

（前端八字页走 `lunar-javascript`，本就按精确节气算，**无此 bug**；kinqimen 已在 v2.1.6 修复。）

## 2. 修复（逐引擎照搬 kinqimen 修法）
统一：取 sxtwl 日级月柱后，若当日交 **12「节」**（立春/驚蟄/清明/立夏/芒種/小暑/立秋/白露/寒露/立冬/大雪/小寒）之一，且给定时刻**早于** `getJieQiJD()` 精确交节时刻 → 沿用**前一日**月柱；**立春**兼校年柱。
- `vendor/kinwuzhao/jieqi.py` `gangzhi`：+`JD2DD` import、`JIE_TERMS`、校正块（其 `jqmc` 0=冬至 → 名取 `jqmc[getJieQi()]`）。
- `vendor/kinastro/astro/bazi/calculator.py` `_compute_four_pillars`：+`JD2DD` import、用既有 `MONTH_JIE_INDICES`（节=奇数索引，立春=3）判节、校正块。
- `vendor/kintaiyi/src/kintaiyi/config.py` `gangzhi`：+`JD2DD` import、`JIE_TERMS`、校正块（`jqmc` 0=冬至但列表起小寒 → 名取 `jieqi.jqmc[getJieQi()-1]`，同 kinqimen）。

> 注意各引擎 `jqmc` 顺序/索引约定不同，已逐一核对。局数表/其余逻辑未动。

## 3. 验证
`Horosa-Web/vendor/test_month_pillar_boundary.py`（subprocess 逐引擎跑，因模块名冲突无法同进程 import）：三引擎 × 5 用例（2005-05-05 16:30→庚辰、18:00→辛巳、4-20→庚辰、立春前→甲申年丁丑月、立春后→乙酉年戊寅月）**ALL PASS**。

## 4. Windows 同步
同步 `vendor/{kinwuzhao/jieqi.py, kinastro/astro/bazi/calculator.py, kintaiyi/src/kintaiyi/config.py}` + 测试文件。**不需重编 jar**；vendored Python 随 runtime 包发布。前端八字页无需改。
