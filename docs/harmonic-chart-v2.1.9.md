# 调波盘绘制（谐波盘本体）— v2.1.9（#9）

> 辅盘「调波盘」此前只渲染两张数表（调波位置 + 调波合相），从不画盘本身。本次让它复用量化盘的星盘 UI，绘制**调波变换后的完整星盘**（ASC/星/宫/相位都按调波数变换）。

## 性质
**前端（`astrostudyui`）+ Python（`astropy`，随源码 rsync）。⚠️ 不动 Java → 不需重编 `astrostudyboot.jar`。**

## 根因 / 背景
- `components/auxchart/AstroHarmonicLab.js` 旧实现只有 input + 两张表，无圆形盘。
- 量化盘（`germany/MidpointMain.js`）的盘是「直接拿现成命盘对象交给 `astro/AstroChart` 渲染」——可直接复用这套 UI；只需把喂进去的盘对象换成**调波盘对象**。

## 改动

### 后端（Python，rsync，无需重编 jar）
- `astropy/astrostudy/thirteenthchart.py` 新增 `HarmonicChart` 类：与既有 `ThirteenthChart` 同构（逐点 `relocate` + `perchart.reinit()`），变换改为 `newlon = (lon * harmonic) % 360`；ASC/MC 同样变换、DESC/IC = +180；房宫按调波后 ASC 做 equal-30（与十三分盘一致）。
- `astropy/astrostudy/astroextra.py` `build_harmonic`：在算完 `positions/conjunctions`（用于数表，保持不变）后，对同一 `perchart` 套用 `HarmonicChart(perchart, harmonic).apply()`，再返回**完整盘对象** `chart`（`params` + `perchart.getChartObj()` + `aspects{normal/immediate/sign}` + `lots` + `receptions/mutuals/declParallel`，与 `/chart` 同形）。
- **复用现成 `/astroextra/harmonic` 端点**（已在本地经 Java `:9999` 正常代理），不新增路由——避免 Java/网关未配新路径导致本地或线上 404。响应新增 `chart` 字段为**增量、非破坏**。

### 前端（`astrostudyui` → `npm run build` 然后 `npm run build:file`）
- `components/auxchart/AstroHarmonicLab.js` 重写为量化盘布局：外层套用既有 class `horosa-aux-module-page xq-chart-renderer xq-chart-renderer-germany` → `horosa-midpoint-{host,workbench,layout,chart-col,side-col}`（直接复用量化盘的填充/居中 CSS，`app.less` 内已定义）。
  - 左 `Col span=18`（`horosa-midpoint-chart-col`）：`astro/AstroChart value={result.chart}` 画大盘，透传 `planetDisplay/chartDisplay/lotsDisplay/showAstroMeaning`。
  - 右 `Col span=6`（`horosa-midpoint-side-col`）：调波数 input + 计算按钮 + 调波位置 / 调波合相 两表。
  - **注意**：最外层不能再包 `Spin`——`app.less` 的填充选择器要求 `horosa-aux-module-page` 是 active tabpane 的**直接子元素**，中间夹 `Spin` 会断链导致整页塌成 0×0。
- `components/auxchart/AuxChartMain.js`：给 `<AstroHarmonicLab>` 补传 `planetDisplay/chartDisplay/lotsDisplay/showAstroMeaning`（此前只传了 `value/height`），使盘按左栏星显选择绘制（对齐 germany/hellen 兄弟）。

## 验证
- `npm run build` + `npm run build:file` 均 exit 0。
- 浏览器实测（dev :8000 + 本地 :9999/:8899）：辅盘→调波盘，大盘填满中右区；改调波数 H6→H9 盘与表即时重绘（A 65.47°×9 → 天蝎 19.24° 与表吻合）；明暗模式均正常（深色下大盘与侧栏都对）；控制台无实质报错（仅全局既有的 antd `Tabs.TabPane` 过时警告）。

## 是否重编 jar
**否。** 仅前端 + Python（astropy）。Windows 端同步后只需重建前端（`build` 然后 `build:file`），Python 随源码同步即可，无需重编 `astrostudyboot.jar`。
