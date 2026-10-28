/**
 * 放大档 / 窄栏「盘与控件被压、被撑、被裁」源码闸(真内核由版面巡检 layout_clip 的 BOXSPILL / UNREACH / DEGENERATE / TINYTEXT 判,
 * 视图切换态由 __TABS__=3 逐项量)。
 *   ① display:none 保活包裹的显示态必须显式(display:contents 或带样式的宿主类):显示态写 undefined / {} = 多包一层块盒,
 *      子块「flex:1 + min-height:0」收束到可视高的高度链断掉 —— 内容随内容撑高、被外层 overflow:hidden 裁掉、滚不到
 *   ② 纵向弹性滚动容器里写了 px 最小高的直接子项不许被压(flex-shrink:0 / flex: x 0 y):被压回最小高时多行字越出自身边框、压到下一个
 *      (容器本身 overflow-y:auto,放不下就滚);登记的例外写明理由,登记了却不再出现 = 过期
 *   ③「弹性基准 0 可缩 + 最小高 0 / px + 自身溢出可见」的组合会被压到比内容矮、内容越出到下一块 —— 每条登记理由
 *   ④ 窄网格回落(宽时与原版逐像素相同):信息行标签列下限随行宽收 / 两列信息卡窄时退单列 / 八卦滚与五柱格自动减列 / 五兆三芯片可折行
 *   ⑤ 编年条带分泳道、人物关系图收拢视野(纯函数)
 *   ⑥ 按可用高定边长的方盘:舞台弹性基准 0(打断「舞台按内容 / 盘按舞台百分比」的循环,结果与切换历史无关)、顶端对齐
 */
const fs = require('fs');
const path = require('path');
const { stripComments, parseLess, lessFilesUnder, normSel, mergedDecls } = require('./helpers/lessRules');

const SRC = path.resolve(__dirname, '..', '..');
const read = (r)=>fs.readFileSync(path.join(SRC, r), 'utf8');
const exists = (r)=>fs.existsSync(path.join(SRC, r));

const ALL_RULES = (()=>{
	const out = [];
	lessFilesUnder(SRC).forEach((f, i)=>{ const rs = parseLess(fs.readFileSync(f, 'utf8'), i * 100000); rs.forEach((r)=>{ r.file = path.relative(SRC, f).split(path.sep).join('/'); }); out.push(...rs); });
	return out;
})();
const MERGED = mergedDecls(ALL_RULES);
const val = (d, p)=>(d && d[p] ? d[p].v : '');

describe('放大档 / 窄栏盘与控件 · 源码闸', ()=>{
	test('① display:none 保活包裹的显示态显式(不许 undefined / null / {});理气工作区包裹是 display:contents', ()=>{
		const files = [];
		(function walk(d){ fs.readdirSync(d).forEach((n)=>{ const p = path.join(d, n); if(n === '__tests__' || n === 'node_modules'){ return; } if(fs.statSync(p).isDirectory()){ walk(p); }else if(/\.js$/.test(n)){ files.push(p); } }); })(path.join(SRC, 'components'));
		// 只看块级包裹(<div style={…}>):行内小件(图标 / 字符 span)显隐不承担高度链
		const RE = [/<div\b[^>]*style=\{[^}]*\?\s*(undefined|null|\{\s*\})\s*:\s*\{\s*display:\s*'none'\s*\}/, /<div\b[^>]*style=\{[^}]*\{\s*display:\s*'none'\s*\}\s*:\s*(undefined|null|\{\s*\})(?![\w.])/];
		const bad = [];
		files.forEach((p)=>{ const t = stripComments(fs.readFileSync(p, 'utf8')); t.split('\n').forEach((ln, i)=>{ if(RE.some((re)=>re.test(ln))){ bad.push(`${path.relative(SRC, p)}:${i + 1}`); } }); });
		expect(bad).toEqual([]);
		expect(files.length).toBeGreaterThan(200);
		const fsMain = stripComments(read('components/fengshui/FengShuiMain.js'));
		expect(fsMain).toMatch(/<div className="horosa-fengshui-liqi-keepalive" style=\{isLiqi \? \{ display: 'contents' \} : \{ display: 'none' \}\}>\s*<LiqiWorkspace/);
		// 理气网格自己是外层纵向 flex 的子项(flex:1 + min-height:0 收束到可视高)
		const liqi = MERGED.get('.horosa-fengshui-liqi');
		expect(val(liqi, 'flex')).toBe('1 1 auto');
		expect(val(liqi, 'min-height')).toBe('0');
		// 三栏下限带栅格自身宽 %(放大档三栏定值之和比栅格宽时不再整块越出被裁)
		expect(val(liqi, 'grid-template-columns')).toBe('~"minmax(min(300px, 30%), 300px) minmax(min(300px, 30%), 1fr) minmax(min(356px, 34%), 356px)"');
	});

	// ② 纵向弹性滚动容器
	const SCROLLERS = [...MERGED.entries()].filter(([, d])=>/flex/.test(val(d, 'display')) && /column/.test(val(d, 'flex-direction')) && /(auto|scroll)/.test(val(d, 'overflow-y') || val(d, 'overflow'))).map(([s])=>s);
	const childOf = (s)=>SCROLLERS.find((sc)=>(s.startsWith(`${sc} `) && !s.slice(sc.length + 1).includes(' ')) || (s.startsWith(`${sc} > `) && !s.slice(sc.length + 3).includes(' ')));
	const noShrink = (d)=>val(d, 'flex-shrink') === '0' || /^\S+\s+0(\s|$)/.test(val(d, 'flex')) || val(d, 'flex') === 'none';
	const ALLOW_SHRINK = {
		'.horosa-workspace-shell .horosa-3d-side > .horosa-3d-tabs-fill': '页签区下限 320 是有意的压缩下限:页签内容区自己滚(内层 min-height:0 + 滚动),压到下限不越出',
		'.horosa-workspace-shell .horosa-planet-with-lots > div:first-child': '行星列表块本身是滚动盒,压到 160 下限时列表在盒内滚',
	};
	test('② 纵向弹性滚动容器里写了 px 最小高的直接子项不许被压(登记例外写明理由、不许过期)', ()=>{
		const hits = [];
		for(const [s, d] of MERGED.entries()){
			const m = val(d, 'min-height').match(/^(\d+(?:\.\d+)?)px$/);
			if(!m || Number(m[1]) < 16 || !childOf(s) || noShrink(d)){ continue; }
			hits.push(s);
		}
		expect(hits.filter((s)=>!ALLOW_SHRINK[s])).toEqual([]);
		expect(Object.keys(ALLOW_SHRINK).filter((s)=>hits.indexOf(s) < 0)).toEqual([]);
		Object.values(ALLOW_SHRINK).forEach((why)=>expect(why.length).toBeGreaterThan(10));
		expect(SCROLLERS.length).toBeGreaterThan(10);   // 防解析静默失效
		// 子技法竖排导轨:钮不随导轨被压
		expect(noShrink(MERGED.get('.horosa-workspace-shell .horosa-kinastro-technique-rail button'))).toBe(true);
	});

	const ALLOW_BASIS0 = {
		'.horosa-workspace-shell .horosa-geomancy-board-stage.is-fit-height': '舞台高 = 可用高(打断循环百分比);盘按舞台高定边长,缩放态外框定高、向下越出由外层滚动接住',
		'.horosa-yizhangjing-aux .ant-tabs': '页签容器:高度链容器,内容区自己滚',
		'.horosa-workspace-shell .horosa-fill-tabs.ant-tabs > .ant-tabs-content-holder': '页签内容区:面板 height:100% 且 overflow-y:auto,自己滚',
		'.horosa-workspace-shell .horosa-planet-with-lots > div:first-child': '行星列表块本身是滚动盒(内容在盒内滚)',
	};
	test('③ 弹性基准 0 可缩 + 最小高 0 / px + 自身溢出可见:每条登记理由(登记了却不再出现 = 过期)', ()=>{
		const hits = [];
		for(const [s, d] of MERGED.entries()){
			const fl = val(d, 'flex');
			if(!/^\d+(\.\d+)?\s+\d+(\.\d+)?\s+0(px|%)?$/.test(fl) || !(Number(fl.split(/\s+/)[1]) > 0)){ continue; }
			if(!/^(0|\d+(\.\d+)?px)$/.test(val(d, 'min-height'))){ continue; }
			if(/(hidden|clip|auto|scroll)/.test(`${val(d, 'overflow')} ${val(d, 'overflow-y')}`)){ continue; }
			hits.push(s);
		}
		expect(hits.filter((s)=>!ALLOW_BASIS0[s])).toEqual([]);
		expect(Object.keys(ALLOW_BASIS0).filter((s)=>hits.indexOf(s) < 0)).toEqual([]);
		Object.values(ALLOW_BASIS0).forEach((why)=>expect(why.length).toBeGreaterThan(10));
	});

	test('④ 窄网格回落:宽时与原版相同、窄时收标签列 / 退列 / 折行', ()=>{
		const g = (sel, p)=>val(MERGED.get(sel), p);
		expect(g('.horosa-workspace-shell .horosa-huangji-info-row', 'grid-template-columns')).toBe('minmax(~"min(90px, 40%)", 32%) minmax(0, 1fr)');
		expect(g('.horosa-workspace-shell .horosa-kinastro-tieban-fw-grid', 'grid-template-columns')).toMatch(/^repeat\(auto-fit, minmax\(~"max\(min\(260px, 100%\), calc\(\(100% - 14px\) \/ 2 - 1px\)\)", 1fr\)\)$/);
		expect(g('.horosa-workspace-shell .horosa-kinastro-tieban-fw-grid > .horosa-huangji-info-card:nth-child(3)', 'grid-column')).toBe('~"1 / -1"');
		expect(g('.horosa-workspace-shell .horosa-kinastro-tieban-bagua-strip', 'grid-template-columns')).toMatch(/^repeat\(auto-fit, minmax\(~"max\(min\(52px, 100%\), calc\(\(100% - 18px\) \/ 4 - 1px\)\)", 1fr\)\)$/);
		expect(g('.horosa-workspace-shell .horosa-kinastro-tieban-bagua-item > span', 'white-space')).toBe('');
		expect(g('.horosa-workspace-shell .horosa-huangji-ganzhi-grid', 'grid-template-columns')).toBe('repeat(auto-fit, minmax(~"max(64px, calc((100% - 28px) / 5 - 1px))", 1fr))');
		expect(g('.horosa-workspace-shell .horosa-wuzhao-position-main', 'display')).toBe('flex');
		expect(g('.horosa-workspace-shell .horosa-wuzhao-position-main', 'flex-wrap')).toBe('wrap');
		expect(g('.horosa-workspace-shell .horosa-wuzhao-position-main span', 'min-width')).toBe('max-content');
		expect(g('.horosa-workspace-shell .horosa-wuzhao-position-main span', 'flex')).toBe('1 1 0');
		// 数算窄盘(量盘宽挂 data-board-narrow):大运 / 分析格四列退两列;神数正传步骤依据另起一行(视口媒体查询在放大档不中)
		expect(g('.horosa-workspace-shell .horosa-taixuan-board[data-board-narrow] .horosa-kinastro-chunzi-analysis-grid', 'grid-template-columns')).toBe('repeat(2, minmax(0, 1fr))');
		expect(g('.horosa-workspace-shell .horosa-taixuan-board[data-board-narrow] .horosa-kinastro-beiji-dayun-grid', 'grid-template-columns')).toBe('repeat(2, minmax(0, 1fr))');
		expect(g('.horosa-workspace-shell .horosa-taixuan-board[data-board-narrow] .horosa-kinastro-beiji-core', 'grid-template-columns')).toBe('repeat(2, minmax(0, 1fr))');
		expect(g('.horosa-zhengchuan-board[data-board-narrow] .horosa-zhengchuan-step', 'grid-template-columns')).toBe('16px minmax(0, 1fr) auto');
		expect(read('components/shusuan/ZhengChuanMain.js')).toMatch(/horosa-zhengchuan-board" ref=\{ownedBoxSizeRef\(this, 'board', narrowBoardVars\)\}/);
		// 表比卡宽时卡横向滚、短格不拆字;左栏标签兜底断行
		expect(g('.horosa-heluo-center .horosa-huangji-info-card', 'overflow-x')).toBe('auto');
		expect(g('.horosa-canping-center .horosa-huangji-info-card', 'overflow-x')).toBe('auto');
		expect(g('.horosa-heluo-table td:not([colspan])', 'word-break')).toBe('keep-all');
		expect(g('.horosa-workspace-shell .horosa-huangji-select-field > span', 'overflow-wrap')).toBe('break-word');
		expect(g('.horosa-workspace-shell .horosa-info-card-title', 'overflow-wrap')).toBe('break-word');
		// 一掌经权重带段宽不窄于内容、四柱星名不拆字;玄学史天象双列窄时退单列
		expect(g('.horosa-yizhangjing-shishiband .ss-seg', 'min-width')).toBe('max-content');
		expect(g('.horosa-yizhangjing-pcell .pstar', 'white-space')).toBe('nowrap');
		expect(g('.xuanshi-celcols', 'grid-template-columns')).toMatch(/^repeat\(auto-fit, minmax\(~"max\(min\(200px, 100%\), calc\(\(100% - 16px\) \/ 2 - 1px\)\)", 1fr\)\)$/);
	});

	test('⑤ 编年条带分泳道 / 人物关系图收拢视野', ()=>{
		// eslint-disable-next-line global-require
		const { layoutTimelineLanes, timelineLabelPx } = require('../../components/xuanshi/XuanShiTimeline');
		const series = [
			{ macro: '秦', span_start: -221, span_end: -207 }, { macro: '西汉', span_start: -206, span_end: 8 }, { macro: '新莽', span_start: 9, span_end: 23 },
			{ macro: '东汉', span_start: 25, span_end: 220 }, { macro: '三国', span_start: 220, span_end: 280 }, { macro: '西晋', span_start: 265, span_end: 316 },
		];
		const first = -1046; const span = 1912 - first;
		const lab = (s)=>timelineLabelPx(s.macro, `${s.span_start}–${s.span_end}`);
		const { lanes, laneCount } = layoutTimelineLanes(series, first, span, lab);
		expect(laneCount).toBeGreaterThan(1);
		expect(lanes[4]).not.toBe(lanes[5]);   // 三国 / 西晋 并存 → 不同泳道
		// 同一泳道里任意两段的「柱 ∪ 标签」不相交
		const ext = series.map((s)=>{ const l = ((s.span_start - first) / span) * 100; const w = ((s.span_end - s.span_start) / span) * 100; const lw = (lab(s) / 1200) * 100; const c = l + w / 2; return [Math.min(l, c - lw / 2), Math.max(l + w, c + lw / 2)]; });
		for(let i = 0; i < series.length; i += 1){ for(let j = i + 1; j < series.length; j += 1){ if(lanes[i] === lanes[j]){ expect(ext[i][1] <= ext[j][0] || ext[j][1] <= ext[i][0]).toBe(true); } } }
		// 不并存、标签放得下 → 一条泳道(与此前逐像素相同)
		expect(layoutTimelineLanes([{ macro: '唐', span_start: 618, span_end: 907 }, { macro: '宋', span_start: 960, span_end: 1279 }], first, span, lab).laneCount).toBe(1);
		// eslint-disable-next-line global-require
		const { fitTransformFor } = require('../../components/xuanshi/XuanShiPersons');
		const t = fitTransformFor({ x0: -600, y0: -400, x1: 2000, y1: 1200 }, 1400, 800, 40);
		expect(t.k).toBeLessThan(1);
		expect(t.k * ((-600 + 2000) / 2) + t.x).toBeCloseTo(700, 5);
		expect(t.k * ((-400 + 1200) / 2) + t.y).toBeCloseTo(400, 5);
		expect(fitTransformFor({ x0: 600, y0: 300, x1: 800, y1: 500 }, 1400, 800, 40).k).toBe(1);   // 放得下不放大
		const persons = stripComments(read('components/xuanshi/XuanShiPersons.js'));
		expect(persons).toMatch(/\.force\('x', d3\.forceX\(W \/ 2\)\.strength\(/);
		expect(persons).toMatch(/\.force\('y', d3\.forceY\(H \/ 2\)\.strength\(/);
		expect(persons).toMatch(/sim\.on\('end', fit\)/);
		// 收拢视野后名字字号按 1 / k 补偿;放大档另保视觉 ≥ 9 px;1 档 k = 1 时恒为原字号
		// eslint-disable-next-line global-require
		const { personLabelSize } = require('../../components/xuanshi/XuanShiPersons');
		expect(personLabelSize(10, 1, 0.87, 1)).toBe(10);
		expect(personLabelSize(10, 0.5, 0.87, 1)).toBe(20);
		expect(personLabelSize(10, 0.5, 0.3, 1.8) * 0.5 * 0.3 * 1.8).toBeGreaterThanOrEqual(9 - 0.01);
	});

	test('⑥ 按可用高定边长的方盘:舞台弹性基准 0 + 顶端对齐;盘式切换走 is-fit-height', ()=>{
		const st = MERGED.get('.horosa-workspace-shell .horosa-geomancy-board-stage.is-fit-height');
		expect(val(st, 'flex')).toBe('1 1 0');
		expect(val(st, 'min-height')).toBe('0');
		expect(val(st, 'align-items')).toBe('flex-start');
		expect(stripComments(read('components/geomancy/GeomancyMain.js'))).toMatch(/horosa-geomancy-board-stage\$\{\['squarehouse', 'north', 'medieval'\]\.indexOf\(view\) >= 0 \? ' is-fit-height' : ''\}/);
	});


	test('规范选择器工具自检', ()=>{
		expect(normSel(':global(.a)  >  .b')).toBe('.a > .b');
		expect(MERGED.size).toBeGreaterThan(500);
	});
});
