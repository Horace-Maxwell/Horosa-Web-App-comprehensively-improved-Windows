/**
 * 工作区布局下限 / 盘面最小字视觉下限 / 无底坞页滚动安全区 / 3D 右栏页签区下限 —— 源码闸(真内核由 wkprobe 的 layout_clip 判:
 * UNREACH / SLIT / TINYTEXT / DEADPAD,换档首帧由 zoom_lag 判)。
 *   ① 工作区布局下限三层同值:样式(.workspaceInner min-width / min-height / 排版视口变量地板)、高度派发(zoomDomain 常量)、页面排版视口读数(shellZoom)
 *   ② 按视口给页面定尺寸的组件一律读「页面排版视口」(地板到包络),浮层 / 弹窗仍读真视口
 *   ③ 滚动安全内衬缺省 12px,只有挂了底坞的那一层吃坞高 + 18;不再按页就地压平
 *   ④ 3D 右栏页签区有正的高度下限、右栏整列可滚(明暗两套一致)
 *   ⑤ 盘面最小字视觉下限:纯函数口径 + 设计盒写下限 + 工作区加宽 / 加高接线;按像素直接画的盘登记理由
 *   ⑥ 占星地图标签收进画布
 *   ⑦ 窄栏短标签:策天凶限星名、廿八宿分野宿名列、地占三角式、恒星触发属性
 */
const fs = require('fs');
const path = require('path');
const { importsName } = require('./helpers/importSpecs');

const SRC = path.resolve(__dirname, '..', '..');
const read = (r)=>fs.readFileSync(path.join(SRC, r), 'utf8');
const strip = (t)=>t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/[^\n]*/g, '$1');

describe('① 工作区布局下限三层同值', () => {
	const zd = require('../zoomDomain');
	const less = strip(read('layouts/app/13-layout-module.less'));
	const inner = (less.match(/\.workspaceInner\s*\{([\s\S]*?)\n\}/) || [])[1] || '';
	const outer = (less.match(/\.workspaceOuter\s*\{([\s\S]*?)\n\}/) || [])[1] || '';
	test('样式层的宽 / 高下限与 zoomDomain 常量同值;外层两向都可滚', () => {
		expect(zd.WORKSPACE_MIN_LAYOUT_W).toBe(960);
		expect(zd.WORKSPACE_MIN_LAYOUT_H).toBe(488);
		expect(zd.PAGE_MIN_LAYOUT_VIEWPORT_W).toBe(zd.WORKSPACE_MIN_LAYOUT_W);
		expect(zd.PAGE_MIN_LAYOUT_VIEWPORT_H - zd.WORKSPACE_MIN_LAYOUT_H).toBe(72);   // 页头 72
		expect(inner).toMatch(new RegExp(`min-width:\\s*~?"?calc\\(max\\(${zd.WORKSPACE_MIN_LAYOUT_W}px, 100%\\)`));
		expect(inner).toMatch(new RegExp(`min-height:\\s*~?"?calc\\(max\\(${zd.WORKSPACE_MIN_LAYOUT_H}px, 100%\\)`));
		expect(outer).toMatch(/overflow-x:\s*auto/);
		expect(outer).toMatch(/overflow-y:\s*auto/);   // 有高度地板而外层不可滚 = 底部被裁(595 的事故),两者同时成立
	});
	test('排版视口变量在工作区内地板到包络 / 100(根上发布的原始值另一份)', () => {
		expect(inner).toMatch(new RegExp(`--horosa-lvw:\\s*~?"?max\\(${zd.PAGE_MIN_LAYOUT_VIEWPORT_W / 100}px, var\\(--horosa-lvw-raw, 1vw\\)\\)`));
		expect(inner).toMatch(new RegExp(`--horosa-lvh:\\s*~?"?max\\(${zd.PAGE_MIN_LAYOUT_VIEWPORT_H / 100}px, var\\(--horosa-lvh-raw, 1vh\\)\\)`));
		const pub = read('utils/layoutViewportVars.js');
		expect(pub).toMatch(/setProperty\(LAYOUT_VW_RAW_VAR,/);
		expect(pub).toMatch(/setProperty\(LAYOUT_VH_RAW_VAR,/);
	});
	test('页面排版视口读数地板到同一包络', () => {
		const sz = require('../shellZoom');
		const orig = window.innerHeight;
		expect(typeof sz.getPageLayoutHeight).toBe('function');
		expect(typeof sz.getPageLayoutWidth).toBe('function');
		// jsdom 量不到 fixed 探针 → 退物理读数;无论读数多少,结果都不低于包络
		expect(sz.getPageLayoutHeight()).toBeGreaterThanOrEqual(zd.PAGE_MIN_LAYOUT_VIEWPORT_H);
		expect(sz.getPageLayoutWidth()).toBeGreaterThanOrEqual(zd.PAGE_MIN_LAYOUT_VIEWPORT_W);
		expect(window.innerHeight).toBe(orig);
	});
});

describe('② 按视口给页面定尺寸的组件读页面排版视口', () => {
	const PAGE_SIZERS = [
		'components/dunjia/DunJiaMain.js',
		'components/sanshi/SanShiUnitedMain.js',
		'components/germany/UranianHouseFrames.js',
		'components/germany/UranianDialMain.js',
		'components/germany/UranianGraphicEphemeris.js',
		'components/fengshui/charts/EightPalaceDisk.js',
	];
	test.each(PAGE_SIZERS)('%s:页面排版用 getPageLayout*,不再用真视口读数', (f)=>{
		const t = strip(read(f));
		expect(t).toMatch(/getPageLayout(Height|Width)\(\)/);
		expect(t).not.toMatch(/getLayoutViewport(Height|Width)\(\)/);
	});
});

describe('③ 滚动安全内衬只给真挂了底坞的那一层', () => {
	const base = strip(read('layouts/app/01-base.less'));
	test('缺省 12px;坞父层(:has(> 底坞))换成坞高 + 18', () => {
		expect(base).toMatch(/--horosa-scroll-safe-bottom:\s*12px;/);
		expect(base).toMatch(/--horosa-scroll-safe-bottom-docked:\s*calc\(var\(--horosa-bottom-dock-height\) \+ 18px\);/);
		expect(base).toMatch(/:has\(> \.horosa-bottom-quick-dock\)\s*\{\s*--horosa-scroll-safe-bottom:\s*var\(--horosa-scroll-safe-bottom-docked\);/);
		expect(base).toMatch(/\.horosa-bottom-quick-dock-parent\s*\{\s*--horosa-scroll-safe-bottom:\s*var\(--horosa-scroll-safe-bottom-docked\);/);
		// 缺省值不许再引用坞高(那就是「没坞的页也吃 82px」)
		expect(base).not.toMatch(/--horosa-scroll-safe-bottom:\s*calc\(var\(--horosa-bottom-dock-height\)/);
	});
	// 嵌在「坞的父层」之内、却不该吃坞安全区的局部(登记理由);无坞页本身不许再就地压平(缺省已是 12px)
	const LOCAL_12 = {
		'.horosa-workspace-shell .xq-panel.horosa-3d-side': '3D 右栏页签内部自滚,底坞是单独网格行(节气 3D 盘嵌在挂坞的页里)',
		// 择日工作台整页无底坞,嵌入的技法页会渲染自己的底坞结构(宿主与嵌入页的坞父层都压回 12px;:has 与旧引擎回退类分写)
		'.horosa-workspace-shell .horosa-zeri-host': '择日宿主整层',
		'.horosa-workspace-shell .horosa-zeri-host :is(div, section, main):has(> .horosa-bottom-quick-dock)': '择日宿主里嵌入页的坞父层',
		'.horosa-workspace-shell .horosa-zeri-host .horosa-bottom-quick-dock-parent': '同上,不认 :has 的旧引擎走回退类',
	};
	test('就地把变量压回 12px 的只许是登记过的局部(漏一页就是一处死带;无坞页缺省已是 12px)', () => {
		const dir = path.join(SRC, 'layouts/app');
		const bad = [];
		const seen = new Set();
		fs.readdirSync(dir).filter((n)=>n.endsWith('.less') && n !== '01-base.less').forEach((n)=>{
			const t = strip(fs.readFileSync(path.join(dir, n), 'utf8'));
			const re = /([^{}]+)\{[^{}]*--horosa-scroll-safe-bottom:\s*12px/g;
			let m;
			while((m = re.exec(t))){ const sel = m[1].trim(); seen.add(sel); if(!LOCAL_12[sel]){ bad.push(`${n}: ${sel}`); } }
		});
		expect(bad).toEqual([]);
		expect(Object.keys(LOCAL_12).filter((k)=>!seen.has(k))).toEqual([]);
	});
});

describe('④ 3D 右栏:页签区高度下限 + 右栏整列可滚', () => {
	const t = strip(read('layouts/app/05-astro.less'));
	test('.horosa-3d-tabs-fill 有正的 min-height;.horosa-3d-side 纵向 auto', () => {
		const fill = (t.match(/\.horosa-3d-side > \.horosa-3d-tabs-fill\s*\{([^}]*)\}/) || [])[1] || '';
		const mh = Number((fill.match(/min-height:\s*(\d+)px/) || [])[1] || 0);
		expect(mh).toBeGreaterThanOrEqual(280);
		expect(t).toMatch(/\.horosa-workspace-shell \.horosa-3d-side\s*\{\s*overflow-x:\s*hidden;\s*overflow-y:\s*auto;/);
	});
	test('右栏页签实测高量到就用(下限交给样式),不再只认 > 160', () => {
		const m3 = strip(read('components/astro3d/AstroChartMain3D.js'));
		expect(m3).not.toMatch(/h > 160/);
		expect(m3).toMatch(/if\(h > 0 && Math\.abs\(h - \(this\.state\.tabH \|\| 0\)\) > 6\)/);
	});
});

describe('⑤ 盘面最小字视觉下限', () => {
	const F = require('../chartTextFloor');
	test('最小渲染尺寸 = 设计下限 × min(1, 地板 / (最小字号 × 档位));档位越大要的越小,不超过设计尺寸', () => {
		const floor = F.CHART_TEXT_FLOOR_PX;   // 产品侧按整 9 px 反推(判据按 9 − 容差判,留出迭代取整的余量)
		// 七政 Moira:viewBox 1180、最小字 12.32;1.8 档 ≈ 0.40 × 1180
		const m18 = F.designBoxMinRenderSize(1180, 1180, 12.32, 1.8);
		expect(m18.width).toBe(Math.ceil(1180 * floor / (12.32 * 1.8)));
		expect(m18.height).toBe(m18.width);
		// 只在放大档生效:1 档 / 缩小档不提要求(版面一字不变)
		expect(F.designBoxMinRenderSize(1180, 1180, 12.32, 1).width).toBe(0);
		expect(F.designBoxMinRenderSize(1180, 1180, 12.32, 0.7).width).toBe(0);
		// 字号本身太小:最多要到设计尺寸
		expect(F.designBoxMinRenderSize(640, 640, 3, 1.5).width).toBe(640);
		expect(F.designBoxMinRenderSize(0, 640, 3, 1).width).toBe(0);
	});
	test('不动点迭代:中栏吃掉加宽量的比例 α < 1 时收敛到 (需求 − 原宽) / α,α = 1 一步到位', () => {
		const run = (alpha, need, base)=>{
			let e = 0;
			for(let i = 0; i < 40; i += 1){
				const size = base + alpha * e;
				const n = F.nextFloorExtra([{ need, size }], e);
				if(Math.abs(n - e) < 1){ return e; }
				e = n;
			}
			return e;
		};
		expect(run(1, 600, 348)).toBe(252);
		expect(Math.abs(run(0.71, 600, 348) - 252 / 0.71)).toBeLessThan(3);
		// 够了的盘不托住加宽量
		expect(F.nextFloorExtra([{ need: 300, size: 500 }], 100)).toBe(0);
	});
	test('只给说了算的那条轴提需求(方盘被宽卡住时不托住加高量)', () => {
		const t = strip(read('utils/chartTextFloor.js'));
		expect(t).toMatch(/const widthBinds = \(pw \/ mw\) <= \(ph \/ mh\);/);
		expect(t).toMatch(/ws\.push\(\{ need: widthBinds \? need\.width : Math\.min\(need\.width, L\), size: L \}\)/);
		expect(t).toMatch(/hs\.push\(\{ need: widthBinds \? Math\.min\(need\.height, H\) : need\.height, size: H \}\)/);
	});
	test('svg 计算字号的换算系数单源(正常引擎恒为 1)', () => {
		expect(F.svgFontReadScale()).toBe(1);
	});
	test('设计盒把下限写在 svg 上;工作区内层带标记、样式按发布量加宽 / 加高;开机安装', () => {
		expect(read('utils/svgDesignBox.js')).toMatch(/setAttribute\(MIN_MARK, `\$\{Number\(minWidth\) \|\| 0\},\$\{Number\(minHeight\) \|\| 0\}`\)/);
		expect(read('layouts/app.js')).toMatch(/className=\{styles\.workspaceInner\} data-horosa-workspace-inner="1"/);
		const less = read('layouts/app/13-layout-module.less');
		expect(less).toMatch(/var\(--horosa-chart-floor-extra, 0px\)/);
		expect(less).toMatch(/var\(--horosa-chart-floor-extra-h, 0px\)/);
		const app = read('models/app.js');
		expect(app).toMatch(/require\('\.\.\/utils\/chartTextFloor'\)\.installChartTextFloor\(\)/);
		expect(app).toMatch(/window\.addEventListener\('horosa:chart-floor'/);
		expect(app).toMatch(/chartFloorExtra: floorExtra,/);
		expect(F.CHART_FLOOR_EVENT).toBe('horosa:chart-floor');
	});
	test('紫微 / 金口诀走设计盒,设计尺寸按最小字号定', () => {
		const zw = read('components/ziwei/ZWChart.js');
		const d = Number((zw.match(/export const ZW_DESIGN_MIN = (\d+);/) || [])[1] || 0);
		expect(d).toBeGreaterThanOrEqual(780);   // 设计尺寸下最小字要 ≥ 9 px(520 时宫内小星 / 四化徽最小字只有 2.3 px)
		const jk = read('components/jinkou/JinKouPanChart.js');
		expect(jk).toMatch(/const \{ width, height \} = fitSvgDesignBox\(svgdom, JK_DESIGN_MIN_W, JK_DESIGN_MIN_H\);/);
		expect(strip(read('components/jinkou/JinKouMain.js'))).not.toMatch(/702|JINKOU_BOARD_MIN_H/);
		expect(read('layouts/app/22-tail-fixes.less')).not.toMatch(/max\(100%, 702px\)/);
	});
	// 按 svg 布局尺寸直接当绘制坐标的盘:要么走设计盒(盘变小时等比缩、按最小字号反推最小渲染尺寸),要么登记理由。
	const DRAW_BY_PIXEL = {
		'components/suzhan/SuZhanChart.js': '只量宿主给 svg 定尺寸,绘制交给 SZChart(设计盒 520)',
		'components/ziwei/ZiWeiChart.js': '只量盘舞台给 viewport / svg 定尺寸,绘制交给 ZWChart(设计盒)',
		'components/guazhan/GuaZhanChart.js': '只量宿主给 svg 定尺寸,绘制交给 GZChart(设计盒 720×660)',
		'components/lrzhan/LiuRengChart.js': '只量宿主给 svg 定尺寸;盘头按 fitSvgTextWidth 缩到行宽,四课三传格按宿主等比',
		'components/lrzhan/RengChart.js': '圆盘按 min(宽, 高) 定半径、字号随半径等比;1.8 档最小字视觉 ≥ 9(真内核 TINYTEXT 看守)',
		'components/guolao/GuoLaoChart.js': '七政圆盘按 min(宽, 高) 定半径、字号随半径等比(Moira 版走固定 viewBox 1180,由最小字视觉下限加宽)',
		'components/guolao/GLChart.js': '七政旧盘(GuoLaoChart 的绘制体)按半径等比',
		'components/gua/GuaChartDiv.js': '卦象小图(卦名 / 爻线),字号固定、不随盘缩',
		'components/gua/GuaChart.js': '卦象小图,字号固定、不随盘缩',
		'components/astro/AstroDoubleChart.js': '双盘圆盘按 min(宽, 高) 定半径,字号随半径等比(1.8 档最小字视觉 ≥ 9)',
		'components/astro/AstroChartCircle.js': '占星圆盘绘制体,按半径等比',
		'components/astro/AstroChart.js': '占星圆盘按 min(宽, 高) 定半径,分度数字随半径等比(1.8 档最小字视觉 14 px)',
		'components/astro3d/AstroChart3D.js': '3D 画布按宿主尺寸重排(不画 svg 字)',
	};
	test('按像素直接画的盘:走设计盒或登记理由;登记了却不再出现 = 过期', () => {
		const out = [];
		const found = new Set();
		const walk = (d)=>{ fs.readdirSync(d).forEach((n)=>{ const p = path.join(d, n); if(fs.statSync(p).isDirectory()){ if(n !== '__tests__'){ walk(p); } }else if(n.endsWith('.js')){ out.push(p); } }); };
		walk(path.join(SRC, 'components'));
		const bad = [];
		out.forEach((p)=>{
			const rel = path.relative(SRC, p).split(path.sep).join('/');
			const t = strip(fs.readFileSync(p, 'utf8'));
			if(!/\b(svgdom|svgDom|svg)\.clientWidth\b/.test(t)){ return; }
			found.add(rel);
			if(/fitSvgDesignBox\(/.test(t)){ return; }
			if(!DRAW_BY_PIXEL[rel]){ bad.push(rel); }
		});
		expect(bad).toEqual([]);
		expect(Object.keys(DRAW_BY_PIXEL).filter((k)=>!found.has(k))).toEqual([]);
		Object.values(DRAW_BY_PIXEL).forEach((why)=>expect(why.length).toBeGreaterThan(8));
	});
});

describe('⑤′ 方盘不按窗口底封顶(整页加高时能长大)—— 窗口余高单源 utils/viewportCap', () => {
	const VC = require('../viewportCap');
	const F = require('../chartTextFloor');
	function rig({ wsBottom, viewportH = 760, top = 100 }){
		document.body.innerHTML = '';
		const ws = document.createElement('div'); ws.setAttribute('data-horosa-workspace-inner', '1');
		const el = document.createElement('div'); ws.appendChild(el); document.body.appendChild(ws);
		ws.getBoundingClientRect = ()=>({ top: 0, bottom: wsBottom, left: 0, right: 100, width: 100, height: wsBottom });
		el.getBoundingClientRect = ()=>({ top, bottom: top + 10, left: 0, right: 100, width: 100, height: 10 });
		Object.defineProperty(window, 'innerHeight', { value: viewportH, configurable: true });
		return el;
	}
	afterEach(()=>{ document.body.innerHTML = ''; F.__resetChartTextFloorForTests(); });
	test('整页不滚:余高 = 窗口底 − 盘上沿 − gap(常规窗口与此前逐值相同);整页可滚:0 = 不封顶', () => {
		const el = rig({ wsBottom: 760 });
		expect(VC.pageScrollsBeyondViewport()).toBe(false);
		expect(VC.viewportRemainHeight(el, 8)).toBe(760 - 100 - 8);
		const el2 = rig({ wsBottom: 1008 });
		expect(VC.pageScrollsBeyondViewport()).toBe(true);
		expect(VC.viewportRemainHeight(el2, 8)).toBe(0);
	});
	test('宿盘 / 七政方盘 / 六壬方盘都经单源取窗口余高;太乙盘不再按窗口右 / 下沿钳', () => {
		[['components/suzhan/SuZhanChart.js', /viewportRemainHeight\(svgdom, VIEWPORT_BOTTOM_GAP, \{ footer: true \}\)/],
			['components/guolao/GuoLaoChart.js', /viewportRemainHeight\(svgdom, VIEWPORT_BOTTOM_GAP, \{ footer: true \}\)/],
			['components/lrzhan/RengChart.js', /viewportRemainHeight\(hostEl, 8\)/]].forEach(([f, re])=>{
			const t = strip(read(f));
			expect([f, re.test(t), importsName(read(f), { name: 'viewportRemainHeight', from: '../../utils/viewportCap' })]).toEqual([f, true, true]);
		});
		expect(strip(read('components/taiyi/TaiYiMain.js'))).not.toMatch(/getLayoutViewport(Width|Height)\(\)/);
	});
	test('全仓扫描:「窗口底 − 元素上沿」的封顶写法只许在单源里出现', () => {
		const files = [];
		const walk = (d)=>{ fs.readdirSync(d).forEach((n)=>{ const p = path.join(d, n); if(fs.statSync(p).isDirectory()){ if(n !== '__tests__' && n !== 'node_modules'){ walk(p); } }else if(/\.js$/.test(n)){ files.push(p); } }); };
		['components', 'utils', 'layouts', 'models', 'pages'].forEach((d)=>walk(path.join(SRC, d)));
		// 窗口高(innerHeight / 布局视口读数 / 窗口底变量)减某个 .top / Top;鼠标事件坐标(clientX / clientY − rect.left / top)不算
		const RE = /(innerHeight|ViewportHeight\(\)|bottomLimit|vpH)[^;\n]{0,60}-\s*[\w.]*(\.top|Top)\b/;
		const bad = files.filter((p)=>!/utils[\\/]viewportCap\.js$/.test(p)).filter((p)=>strip(fs.readFileSync(p, 'utf8')).split('\n').some((ln)=>RE.test(ln) && !/client[XY]\s*-/.test(ln))).map((p)=>path.relative(SRC, p));
		expect(bad).toEqual([]);
		expect(files.length).toBeGreaterThan(200);   // 防遍历静默失效
	});
});

describe('⑤‴ 盘面最小字下限:1 档 / 缩小档不量字(结果恒为 0,短路)、HTML 盘设计宽缩放走同一加宽口径、定死标记随现场撤', () => {
	const F = require('../chartTextFloor');
	function stage(){
		document.body.innerHTML = '';
		const main = document.createElement('div'); main.id = 'mainContent';
		const inner = document.createElement('div'); inner.setAttribute('data-horosa-workspace-inner', '1');
		main.appendChild(inner); document.body.appendChild(main);
		return { main, inner, extra: ()=>parseFloat(inner.style.getPropertyValue('--horosa-chart-floor-extra')) || 0 };
	}
	function svgBoard(inner){
		const ns = 'http://www.w3.org/2000/svg';
		const host = document.createElement('div');
		const svg = document.createElementNS(ns, 'svg');
		svg.setAttribute('viewBox', '0 0 780 780');
		const t = document.createElementNS(ns, 'text'); t.textContent = '禄'; t.style.fontSize = '13.4px'; svg.appendChild(t);
		host.appendChild(svg); inner.appendChild(host);
		Object.defineProperty(svg, 'clientWidth', { get: ()=>283, configurable: true });
		Object.defineProperty(svg, 'clientHeight', { get: ()=>283, configurable: true });
		Object.defineProperty(host, 'clientWidth', { get: ()=>283, configurable: true });
		Object.defineProperty(host, 'clientHeight', { get: ()=>404, configurable: true });
		Object.defineProperty(svg, 'viewBox', { value: { baseVal: { width: 780, height: 780 } }, configurable: true });
		svg.getClientRects = ()=>[{}];
		t.getBoundingClientRect = ()=>({ width: 10, height: 10 });
		const I = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse(){ return I; }, multiply(){ return I; } };
		svg.getScreenCTM = ()=>I; t.getScreenCTM = ()=>I;
		return svg;
	}
	let clock = 0;
	beforeEach(()=>{ clock = 0; jest.spyOn(Date, 'now').mockImplementation(()=>(clock += 500)); });
	afterEach(()=>{ jest.restoreAllMocks(); document.documentElement.style.zoom = ''; document.body.innerHTML = ''; F.__resetChartTextFloorForTests(); });
	test('1 档:一次样式读取都不做,加量 0;从 1.8 调回 1 档时残留加量清零一次', () => {
		const { inner, extra } = stage();
		svgBoard(inner);
		document.documentElement.style.zoom = '1.8';
		for(let i = 0; i < 5; i += 1){ F.runChartTextFloorNow(); }
		expect(extra()).toBeGreaterThan(0);
		document.documentElement.style.zoom = '';
		const spy = jest.spyOn(window, 'getComputedStyle');
		const r1 = F.runChartTextFloor();
		expect(r1).toEqual({ width: 0, height: 0, changed: true });
		expect(extra()).toBe(0);
		const r2 = F.runChartTextFloor();
		expect(r2).toEqual({ width: 0, height: 0, changed: false });
		expect(spy).not.toHaveBeenCalled();
	});
	test('HTML 盘按设计宽缩放(外框挂 scaled):放大档按缩放后的视觉字号反推加宽,收敛到视觉 9 px', () => {
		const { inner, extra } = stage();
		document.documentElement.style.zoom = '1.8';
		const outer = document.createElement('div'); outer.setAttribute(F.HTML_DESIGN_BOX_ATTR, 'scaled');
		const box = document.createElement('div');
		const txt = document.createElement('span'); txt.textContent = '左证'; txt.style.fontSize = '10px';
		box.appendChild(txt); outer.appendChild(box); inner.appendChild(outer);
		const W = ()=>Math.floor(246 + 0.7 * extra());
		Object.defineProperty(outer, 'clientWidth', { get: W, configurable: true });
		Object.defineProperty(outer, 'clientHeight', { get: ()=>300, configurable: true });
		outer.getClientRects = ()=>[{}];
		txt.getBoundingClientRect = ()=>({ width: 20, height: 10 });
		// jsdom 不排版:比例按「外框宽 / 设计宽 640」由桩给(与组件同一口径)
		const real = window.getComputedStyle.bind(window);
		jest.spyOn(window, 'getComputedStyle').mockImplementation((el)=>{ const cs = real(el); if(el === box){ const k = Math.min(1, W() / 640); return { transform: `matrix(${k}, 0, 0, ${k}, 0, 0)`, visibility: 'visible', display: 'block', opacity: '1', fontSize: cs.fontSize }; } return cs; });
		for(let i = 0; i < 60; i += 1){ F.runChartTextFloorNow(); }
		const k = Math.min(1, W() / 640);
		expect(10 * k * 1.8).toBeGreaterThanOrEqual(F.CHART_TEXT_FLOOR_PX - 0.2);
		expect(extra()).toBeGreaterThan(0);
		expect(extra()).toBeLessThan(400);
		// 收敛后不来回翻:字够大时照样托住已加的量(此前够大就不提需求,加量一撤盘又缩回去,每拍翻一次)
		const settled = extra();
		const seen = new Set();
		for(let i = 0; i < 10; i += 1){ F.runChartTextFloorNow(); seen.add(extra()); }
		expect([...seen].every((v)=>Math.abs(v - settled) <= 1)).toBe(true);
	});
	test('定死标记在换档 / 宿主尺寸变了 ≥ 16px 时撤(源码锁)', () => {
		const t = strip(read('utils/chartTextFloor.js'));
		expect(t).toMatch(/function unstickIfMoved\(tr, el, z\)/);
		expect((t.match(/unstickIfMoved\(track\.get\(/g) || []).length).toBe(2);
		expect((t.match(/tr\.stuckAt = stuckSiteOf\(/g) || []).length).toBe(4);
		// 按设计宽缩的 HTML 盘恒为宽说了算(盘高随宽走、向下越出由外层滚动接住;按宿主高比会误判成高说了算、不加宽)
		expect(t).toMatch(/const widthBinds = b\.getAttribute\(HTML_DESIGN_BOX_ATTR\) === 'scaled' \|\|/);
	});
});

describe('⑥ 占星地图标签收进画布', () => {
	const { clampChipTranslate } = require('../../components/acg/acgLabelClamp');
	const bb = { x: -9, y: -7, width: 18, height: 14 };
	const pad = { x: 3.5, y: 2 };
	const W = 1613; const H = 818;
	const inside = (p)=>(p.x + bb.x - pad.x >= 0 && p.x + bb.x + bb.width + pad.x <= W && p.y + bb.y - pad.y >= 0 && p.y + bb.y + bb.height + pad.y <= H);
	test('经度 ±180 贴边 / 纬度 ±83 贴边的芯片完全落在画布内;放得下时位置不变', () => {
		[[0, 400], [W, 400], [800, 0], [800, H], [0, 0], [W, H], [-5, 300], [W + 5, 300]].forEach(([x, y])=>{
			const p = clampChipTranslate(x, y, bb, pad, W, H);
			expect(`${x},${y}:${inside(p)}`).toBe(`${x},${y}:true`);
		});
		expect(clampChipTranslate(800, 400, bb, pad, W, H)).toEqual({ x: 800, y: 400 });
		expect(clampChipTranslate(5, 5, bb, pad, 0, 0)).toEqual({ x: 5, y: 5 });   // 画布未就绪:不动
	});
	test('芯片就位函数把贴边的芯片挪进画布、放得下时不改写', () => {
		const { placeChip } = require('../../components/acg/acgLabelClamp');
		const g = { tf: null, attr(k, v){ if(k === 'transform'){ this.tf = v; } return this; } };
		placeChip(g, [0, 400], bb, pad, { w: W, h: H });
		expect(g.tf).toBe('translate(13.5,400.0)');
		const g2 = { tf: null, attr(k, v){ if(k === 'transform'){ this.tf = v; } return this; } };
		placeChip(g2, [800, 400], bb, pad, { w: W, h: H });
		expect(g2.tf).toBe(null);
	});
	test('芯片(label)与恒星名都经收边函数', () => {
		const t = strip(read('components/acg/AcgD3Map.js'));
		const label = (t.match(/\n\tlabel\(lonlat, glyphText, color\) \{([\s\S]*?)\n\t\}/) || [])[1] || '';
		expect(label).toMatch(/placeChip\(g, xy, bb, \{ x: px, y: py \}, this\.size\);/);
		expect(t).toMatch(/const c = clampChipTranslate\(xy\[0\], xy\[1\], \{ x: sb\.x - xy\[0\]/);
		expect(t).toMatch(/tn\.attr\('x', c\.x\.toFixed\(1\)\)/);
	});
});

describe('⑦ 窄栏短标签', () => {
	const t = strip(read('layouts/app/12-india-tarot-geomancy.less'));
	test('策天凶限:头部可折行、星名按内容宽不收缩', () => {
		expect(t).toMatch(/\.horosa-cetian-xiong-head \{[^}]*flex-wrap:\s*wrap/);
		expect(t).toMatch(/\.horosa-cetian-xiong-stars \{[^}]*flex:\s*0 0 auto[^}]*max-width:\s*100%/);
	});
	test('廿八宿分野:宿名列有最小宽、表可横滚', () => {
		expect(t).toMatch(/\.horosa-cetian-fenye-row \{[^}]*grid-template-columns:\s*44px 96px minmax\(8em, 1fr\)/);
		expect(t).toMatch(/\.horosa-cetian-fenye-table \{ overflow-x:\s*auto; \}/);
	});
	test('地占三角式可收缩并在词间换行', () => {
		const g = strip(read('components/geomancy/GeomancyMain.less'));
		expect(g).toMatch(/\.horosa-geomancy-triangle-row \{[\s\S]*?\.horosa-geomancy-triad-expr \{\s*flex:\s*0 1 auto;\s*min-width:\s*0;\s*max-width:\s*100%;/);
	});
	test('分段控件折行档一律回到网格排布(局部 display:flex 只管未折行时的样子)', () => {
		const t22 = strip(read('layouts/app/22-tail-fixes.less'));
		expect(t22).toMatch(/\.xq-segmented\.is-wrapped\.ant-radio-group \{\s*display:\s*grid !important;/);
	});
	test('右栏行星 / 希腊点两个滚动盒各有高度下限,容器整体可滚', () => {
		const a5 = strip(read('layouts/app/05-astro.less'));
		expect(a5).toMatch(/\.horosa-planet-with-lots \{[^}]*overflow-y:\s*auto;/);
		expect(a5).toMatch(/\.horosa-planet-with-lots > div:first-child \{[^}]*min-height:\s*160px;/);
		expect(a5).toMatch(/\.horosa-lots-under-planets \{[^}]*min-height:\s*170px;/);
	});
	test('六宫框高度单一来源:不再写「height − 常数」的滚动盒 / 中列底线', () => {
		const t = strip(read('components/germany/UranianHouseFrames.js'));
		expect(t).not.toMatch(/maxHeight:\s*Math\.max\(320, height - 24\)/);
		expect(t).not.toMatch(/minHeight:\s*Math\.max\(320, height - 24\)/);
		expect(t).toMatch(/wrapperClassName="horosa-frames-spin"/);
		expect(strip(read('layouts/app/05-astro.less'))).toMatch(/\.horosa-frames-table-wrap \.ant-table-tbody > tr > td \{\s*white-space:\s*nowrap;/);
	});
	test('恒星触发属性标签走短标签折行单源', () => {
		const a = read('components/astro/AstroAnalysisLab.js');
		expect(importsName(a, { name: 'withLabelCell', from: '../../utils/labelCell' })).toBe(true);
		expect((a.match(/withLabelCell\(\{color:/g) || []).length).toBe(2);
	});
});

describe('⑤″ 加量控制器在真 DOM 桩上收敛、定死的盘不失控', () => {
	const F = require('../chartTextFloor');
	// 桩:一张被等比缩小的盘(viewBox 780 × 780、最小字 13.4),中栏吃到加宽量的 alpha 倍;定死的盘 alpha = 0
	function rig(alpha){
		document.body.innerHTML = '';
		document.documentElement.style.zoom = '1.8';
		const main = document.createElement('div'); main.id = 'mainContent';
		const inner = document.createElement('div'); inner.setAttribute('data-horosa-workspace-inner', '1');
		const host = document.createElement('div');
		const ns = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(ns, 'svg');
		svg.setAttribute('viewBox', '0 0 780 780');
		svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
		const t = document.createElementNS(ns, 'text'); t.textContent = '禄'; t.style.fontSize = '13.4px'; svg.appendChild(t);
		host.appendChild(svg); inner.appendChild(host); main.appendChild(inner); document.body.appendChild(main);
		const extra = ()=>parseFloat(inner.style.getPropertyValue('--horosa-chart-floor-extra')) || 0;
		const size = ()=>Math.floor(283 + alpha * extra());
		Object.defineProperty(svg, 'clientWidth', { get: size, configurable: true });
		Object.defineProperty(svg, 'clientHeight', { get: ()=>404, configurable: true });
		Object.defineProperty(host, 'clientWidth', { get: size, configurable: true });
		Object.defineProperty(host, 'clientHeight', { get: ()=>404, configurable: true });
		Object.defineProperty(svg, 'viewBox', { value: { baseVal: { width: 780, height: 780 } }, configurable: true });   // jsdom 没有 SVGAnimatedRect
		svg.getClientRects = ()=>[{}];
		t.getBoundingClientRect = ()=>({ width: 10, height: 10 });
		const I = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse(){ return I; }, multiply(){ return I; } };
		svg.getScreenCTM = ()=>I; t.getScreenCTM = ()=>I;
		return { extra, size };
	}
	// 每次扫描之间按 500ms 走钟(版面跟上的等待 SETTLE_MS = 400 之后才判定死)
	let clock = 0;
	beforeEach(()=>{ clock = 0; jest.spyOn(Date, 'now').mockImplementation(()=>(clock += 500)); });
	afterEach(()=>{ jest.restoreAllMocks(); document.documentElement.style.zoom = ''; document.body.innerHTML = ''; F.__resetChartTextFloorForTests(); });
	test('中栏只吃到三成加宽量(侧栏按百分比分走其余):逐步加到需求为止(不因单步长得少 + 取整被判定死)', () => {
		const r = rig(0.3);
		for(let i = 0; i < 40; i += 1){ F.runChartTextFloorNow(); }
		const need = F.designBoxMinRenderSize(780, 780, 13.4, 1.8).width;
		expect(r.size()).toBeGreaterThanOrEqual(need - 1);
		expect(r.extra()).toBeLessThan(60);
	});
	test('盘被别的盒子定死(加宽了也不变大):判定死后不再加,加量有界', () => {
		const r = rig(0);
		for(let i = 0; i < 60; i += 1){ F.runChartTextFloorNow(); }
		expect(r.extra()).toBeLessThan(200);
	});
	test('加量改动后不到 400ms 不判定死(版面要经事件 → 高度派发 → 重渲染才跟上);到点后照判', () => {
		Date.now.mockImplementation(()=>(clock += 50));   // 每拍只过 50ms:一直在「等版面跟上」窗口里
		const r = rig(0);
		for(let i = 0; i < 6; i += 1){ F.runChartTextFloorNow(); }
		const early = r.extra();
		expect(early).toBeGreaterThan(16);   // 没被提前判定死(定死的盘早判会把加量撤回 0)
		Date.now.mockImplementation(()=>(clock += 500));
		for(let i = 0; i < 60; i += 1){ F.runChartTextFloorNow(); }
		expect(r.extra()).toBeLessThan(early + 200);
		const t = strip(read('utils/chartTextFloor.js'));
		expect(t).toMatch(/if\(!syncMode && sinceApply < SETTLE_MS\)\{ deferRun\(SETTLE_MS - sinceApply\);/);
		expect((t.match(/canJudgeStuck && extra[WH] >= anchor\.e[wh] \+ 16/g) || []).length).toBe(4);
	});
});
