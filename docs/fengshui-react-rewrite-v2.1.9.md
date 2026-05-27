# 风水纳气盘 iframe→React 重写 — v2.1.9（#11）

> 原风水工具是独立 canvas 站点经 `<iframe>` 嵌入，导致明暗主题、占屏布局、与主 app 的一致性都差。本次按用户要求**全 React 重写**：取消 iframe/独立地位，做成一等公民；功能对等、全明暗、占满屏、保留 AI 快照挂载。

## 性质
**纯前端（`astrostudyui`）。⚠️ 不动 Java/Python → 不需重编 `astrostudyboot.jar`。**

## 背景 / 现状
- 旧 `components/fengshui/FengShuiMain.js` 是 `<iframe src="/fengshui/index.html?embedded=horosa">` 壳；真正逻辑在 `public/fengshui/{index.html, app.js(2377 行 canvas), styles.css}`，全局 `document.getElementById` 驱动。
- iframe 隔离 → 明暗主题不跟随、底部大空隙、与主 app 风格割裂。

## 改动（均在 `astrostudyui`，`npm run build` 然后 `npm run build:file`）
1. **新增 `components/fengshui/fengshuiEngine.js`** —— 从 `public/fengshui/app.js` 移植的**框架无关引擎类**：常量（`SECTORS` 八方/`MARKER_TYPES`/气水数与色）、画布绘制（`drawAll`/纳气盘/`drawRotatedRect`/`drawMarkers`/合成导出）、几何（旋转/吸附/缩放平移/盘心/盘旋转）、判定（`evaluateMarker`/`getSectorForPoint`）、撤销重做、导出（PNG/判定报告 PNG/PDF-打印窗口）、AI 快照文本；状态封装在实例上，鼠标事件自挂。**改进**：画布按工作区尺寸铺满、户型图居中绘制，纳气盘可延伸到图外空白区**不被裁切**（旧版画布=图片尺寸，盘易被裁）。
2. **重写 `components/fengshui/FengShuiMain.js`** —— Antd 重构：顶栏快捷按钮 + 左控件 Tabs（基础/纳气盘/标注/导出）+ 工作区 Tabs（画布/判定/要点）+ `<canvas ref>`；`ResizeObserver`→`engine.resize()`；`keydown`→`engine.handleKey`（撤销/重做/Esc）；引擎 `onChange(viewModel)`→React 渲染控件；**AI 快照**：`saveModuleAISnapshot('fengshui', vm.snapshotText)` + 响应 `horosa:refresh-module-snapshot`。**删除 iframe**。
3. **`layouts/app.less`** 末尾加 `:global { .horosa-fengshui-app … }` 一组布局 + 明暗样式（用 `--horosa-*` 变量；术数语义色：气红 `rgb(180,30,30)`/水蓝 `rgb(20,30,100)` 在 canvas 内不变）。
4. **嵌入模式专属裁剪**：原 app.js 在 `EMBEDDED_MODE`（`?embedded=horosa`）本就隐藏并禁用「项目管理 / 项目文件导入导出 / 最近 / 自动保存」（独立站点专用）。React 版按此**一致略去**，只复刻嵌入态在用的全部功能（上传/框选/旋转/门向/纳气盘四参/标记全套/工作区/撤销重做/缩放平移吸附/导出三种/AI 快照）。

## 关键坑（务必记住）
- **`app.less` 是 CSS Module**：顶层裸类名会被哈希成 `xxx___hash`，不匹配 JSX 里的普通 className。新增全局类**必须包在 `:global { … }` 里**（否则样式"看似加载实则不生效"）。
- **canvas 必须绝对定位**（`position:absolute; inset:0`）：否则它 in-flow 时，引擎按宿主高设 canvas、canvas 又撑高宿主，配合 `ResizeObserver` 形成正反馈→高度失控（实测涨到 1.5w+ px）。
- flex 填充链每层 `min-height:0`，根 `.horosa-fengshui-app` `display:flex;flex-direction:column` + 内联 height。

## 验证
- `npm run build` + `npm run build:file` 通过。
- 浏览器实测（dev :8000）：注入测试户型图→自动进框选→鼠标框选房屋→纳气盘出现（八方数字/名称、气红水蓝、外接房屋框且延伸到图外不被裁）→放置「入户门」标记→「判定」tab 列出「6·西北(乾)·气位·位置合适」+ 汇总「气位正确 1 项…」→ `localStorage['horosa.ai.snapshot.module.v1.fengshui']` 已写入；**深色 / 浅色模式均正常**；占满屏、无底部空隙。

## 是否重编 jar
**否。** 纯前端。`public/fengshui/` 旧独立站点文件可暂留（已无引用），后续可单独清理。Windows 端同步后仅重建前端。
