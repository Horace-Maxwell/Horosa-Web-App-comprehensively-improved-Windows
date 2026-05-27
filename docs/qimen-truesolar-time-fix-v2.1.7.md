# 奇门/三式 真太阳时定盘修复（v2.1.7）

> 首发版本：**v2.1.7 / 2.1.7-runtime1**　日期：2026-05-26
> 范围：奇门遁甲后端请求时间口径 —— 选「真太阳时」时按真太阳时刻排盘（此前被当直接时间）。
> 面向 Windows 同步：**纯前端（`astrostudyui/components/dunjia/DunJiaCalc.js`），重建 `build:file`；不动 Java/Python，无需重编 `astrostudyboot.jar`**。
> 来源：用户在「三式合一」实测发现——选真太阳时，奇门盘却按直接时间排（时柱错位）。

---

## 1. 根因

奇门排盘请求 `fetchQimenPan`（`components/dunjia/DunJiaCalc.js`）用 `parseDateTime(fields)` 取**钟表时（直接时间）**作为 `year/month/day/hour/minute` 发给后端 `/qimen/pan`；后端 `webqimensrv` 只把 `realSunTime` 回显、**不参与计算**。因此无论用户选「真太阳时」还是「直接时间」，奇门盘一律按直接时间排。

对照：同文件的前端自算 `calcDunJia` 用 `resolveCalcDateTime`（`timeAlg===0` → 取 `nongli.birth` 的真太阳时刻）、太乙 `fetchTaiyiPan` 用 `resolveCalculationDateTime`（`timeBasis==='trueSolar'` → 取 `nongli.birth`）——都正确；唯独 `fetchQimenPan` 漏了这步。

**实例**：1993-02-01 11:24:30，真太阳时 10:46。原输出时柱 `戊午`（午时，按 11:24）；应为 `丁巳`（巳时，按真太阳时 10:46）。

## 2. 修复

`fetchQimenPan` 改为复用既有 `resolveCalcDateTime`：
```js
const baseDt = parseDateTime(fields);
const opt = options || {};
const dt = resolveCalcDateTime(baseDt, nongli, opt, context);   // timeAlg=0 → 真太阳时刻(nongli.birth/displaySolarTime)
```
- `timeAlg===0`（真太阳时，默认）→ 用 `nongli.birth` 校正后的时刻发后端；`===1`（直接时间）→ 用钟表时。
- 与前端 `calcDunJia` 及太乙完全一致。
- **共享函数**：独立「遁甲」页与「三式合一」一并修好。

## 3. 影响面（真太阳时/直接时间 全面核对）
| 式/页 | 修前 | 修后 |
| --- | --- | --- |
| 奇门遁甲 | ❌ 用直接时间 | ✅ 按所选口径（走 `resolveCalcDateTime`） |
| 三式·六壬 | ❌ 跟随奇门四柱错 | ✅ 级联修复（`buildLrNongli` 取 `dunjia.ganzhi` 日/时柱） |
| 三式·太乙 | ✅ 本就正确（`timeBasis`） | ✅ 不变 |
| 紫微 | ✅ 传 `timeAlg` 给后端 | ✅ 不变 |
| 西洋占星 | 用精确时刻，无 `timeAlg` | N/A |

- 顶部「直接时间 / 真太阳时」**显示标签未动**——`resolveDisplaySolarTime` 本就正确（`timeAlg=0` 时主盘即真太阳时，标签直接显示）。
- 独立遁甲页 `paiPanType===1`（前端自算）路径四柱取自**八字引擎**（`nongli.bazi.fourColumns`，正确处理节气），时柱已按 `timeAlg` 走——无 kinqimen 日级月柱隐患。

## 4. 验证
- `npm run build:file` 通过；逻辑核对：`resolveCalcDateTime({hour:11,minute:24},{birth:"1993-02-01 10:46"},{timeAlg:0})` → `{hour:10,minute:46}` → 后端 `kinqimen.Qimen(...,10,46)` → 巳时 → 丁巳時。
- 应用内：三式/遁甲选真太阳时 → 奇门时柱应为 `丁巳`；切「直接时间」→ `戊午`。

## 5. Windows 同步
仅前端：同步 `Horosa-Web/astrostudyui/src/components/dunjia/DunJiaCalc.js`，`npm run build && npm run build:file`（顺序）。**不动 Java/Python，无需重编 `astrostudyboot.jar`**。逐版本台账见 [`windows-sync-handoff.md`](windows-sync-handoff.md)。
