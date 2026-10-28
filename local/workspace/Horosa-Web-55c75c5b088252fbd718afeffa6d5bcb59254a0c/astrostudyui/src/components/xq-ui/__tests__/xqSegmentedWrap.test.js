// 分段控件折行档位:各项是等宽列,长的一项放不下它分到的那一份时要折行;宽度随内容伸缩的不误折
import { segmentedWrapLevel, segmentedWrapLevelFor, segmentedWrapLevelFromRects, segmentedZoomOf, SEGMENTED_UNWRAPPED_PAD_X, SEGMENTED_LEVEL_COMPACT, segmentedLevelClass } from '../index';

// 各项「文字宽 + 内衬 + 2」之和(与组件内同一算法)
const sumOf = (tws, pad) => tws.reduce((a, tw) => a + tw + pad + 2, 0);

describe('segmentedWrapLevel', () => {
	it('一行放得下:不折', () => {
		const tws = [24, 17, 41.7];
		expect(segmentedWrapLevel({ sum: sumOf(tws, 20), maxTw: 41.7, count: 3, avail: 200, padX: 20 })).toBe(0);
	});

	it('🔴 判别向量:各项之和放得下、最宽一项连内衬放不进它的等分列 → 不能原样一行(三项分段「甲乙 | 丙丁 | 时区图」100% 档)', () => {
		// 组内宽 182、三列各 60.7、内衬 10/10:「时区图」41.7 > 列内容宽 40.7,标签 white-space: normal → 字被挤成两行
		expect(segmentedWrapLevelFor({ tws: [27.8, 23, 41.7], padX: 20, avail: 182 })).not.toBe(0);
		expect(sumOf([27.8, 23, 41.7], 20)).toBeLessThan(182);                                              // 各项之和判据看不出
		expect((41.7 + 4) * 3).toBeLessThan(182);                                                            // 只留左右 2px 的旧判据也看不出
	});

	it('总宽放得下、长的一项超出它分到的等分列宽:折行(两列放得下就两列)', () => {
		const tws = [30, 30, 100];
		const sum = sumOf(tws, 20);
		expect(sum).toBeLessThanOrEqual(230);   // 按各项之和的旧判据不会折
		expect(segmentedWrapLevel({ sum, maxTw: 100, count: 3, avail: 230 })).toBe(2);
	});

	it('两项、其一很长,连半宽都放不下:一项一行', () => {
		const tws = [95.3, 142.4];
		expect(segmentedWrapLevel({ sum: sumOf(tws, 20), maxTw: 142.4, count: 2, avail: 247 })).toBe(1);
	});

	it('各项之和超出(旧判据)照旧折两列', () => {
		const tws = [52, 52, 52, 52];
		expect(segmentedWrapLevel({ sum: sumOf(tws, 20), maxTw: 52, count: 4, avail: 237 })).toBe(2);
	});

	it('文字进了内衬就算放不下(标签会换行):列宽 60.7、内衬 20 → 文字 38 放得下、39 要收内衬', () => {
		expect(segmentedWrapLevel({ sum: 150, maxTw: 38, count: 3, avail: 182, padX: 20 })).toBe(0);
		expect(segmentedWrapLevel({ sum: 150, maxTw: 39, count: 3, avail: 182, padX: 20 })).toBe(SEGMENTED_LEVEL_COMPACT);
	});

	it('🔴 判别向量:差不到 1px → 收内衬一行(is-compact、不 is-wrapped);收了内衬仍放不下才折', () => {
		// 「甲乙 | 丙丁 | 时区图」100% 档:列内容宽 41.0、「时区图」41.67(差 0.67px);内衬收到 6px 一行放得下
		expect(segmentedWrapLevelFor({ tws: [27.8, 23, 41.67], padX: 20, avail: 3 * 61 })).toBe(SEGMENTED_LEVEL_COMPACT);
		expect(segmentedLevelClass(SEGMENTED_LEVEL_COMPACT)).toBe('is-compact');
		// 五项、差得多:收内衬也放不下 → 两列
		expect(segmentedWrapLevelFor({ tws: [26, 60, 39, 39, 39], padX: 20, avail: 200 })).toBe(2);
		// 页面把未折行内衬收得比 0 6px 还小:没有收内衬这一档
		expect(segmentedWrapLevelFor({ tws: [39, 39, 39], padX: 8, avail: 140 })).toBe(2);
		expect([0, 1, 2].map(segmentedLevelClass)).toEqual(['', 'is-wrapped is-wrapped-single', 'is-wrapped']);
	});

	it('量不到容器宽 / 没有选项:不折', () => {
		expect(segmentedWrapLevel({ sum: 999, maxTw: 999, count: 2, avail: 0 })).toBe(0);
		expect(segmentedWrapLevel({ sum: 0, maxTw: 0, count: 0, avail: 200 })).toBe(0);
	});
});

// ── 折行判据不吃自己的输出 ─────────────────────────────────────────────
// 折行后内衬由 0 10px 变成 0 6px。判据若按「当前态」的内衬量,在一段容器宽度里:未折行判「折」→ 折了按 6px 量判「不折」→ 再折……
// 每次 ResizeObserver 回调翻一次,一行两行来回闪。判据一律按未折行档的内衬,结果与当前折没折无关。
describe('segmentedWrapLevelFor · 内衬口径', () => {
	const levelAt = (tws, pad, avail) => segmentedWrapLevelFor({ tws, padX: pad, avail });

	it('🔴 判别向量:闪烁带确实存在 —— 同一宽度按两档内衬量,结论相反(所以判据只能取一档)', () => {
		// 三项三字(文字宽 39):未折档 Σ = 3×(39+20+2) = 183,折行档 Σ = 3×(39+12+2) = 159;内宽 172 落在两者之间
		expect(levelAt([39, 39, 39], 20, 172)).toBe(SEGMENTED_LEVEL_COMPACT);
		expect(levelAt([39, 39, 39], 12, 172)).toBe(0);
	});

	it('与按各项之和的原判据逐值一致(未折行档内衬)', () => {
		[[24, 17, 41.7], [30, 30, 100], [95.3, 142.4], [52, 52, 52, 52]].forEach((tws) => {
			[0, 120, 182, 230, 237, 247, 400].forEach((avail) => {
				expect(levelAt(tws, 20, avail)).toBe(segmentedWrapLevel({ sum: sumOf(tws, 20), maxTw: Math.max(...tws), count: tws.length, avail, padX: 20 }));
			});
		});
		expect(segmentedWrapLevelFor({ tws: [39, 39, 39], avail: 172 })).toBe(levelAt([39, 39, 39], SEGMENTED_UNWRAPPED_PAD_X, 172));
	});
});

// ── 量测换到同一个域 ─────────────────────────────────────────────
// 文字宽(Range)与容器宽(getBoundingClientRect)是视觉域,内衬(getComputedStyle)与常数是布局域;缩放 ≠ 1 时混着算会判错。
describe('segmentedWrapLevelFromRects · 缩放档同判', () => {
	// 一组 CSS 布局几何(印占「北印 | 南印 | 东印」一类三项)在 z 档下的实测值:文字宽、容器视觉宽 ×z,布局宽与内衬不变
	const at = (z, { tws, padX, groupCss })=>segmentedWrapLevelFromRects({
		twRects: tws.map((w)=>w * z), padX, groupRectWidth: groupCss * z, groupLayoutWidth: groupCss,
	});
	const ZS = [0.7, 1, 1.25, 1.8];

	it('🔴 同一组几何在 0.7 / 1 / 1.25 / 1.8 档判定相同', () => {
		[
			{ tws: [27.8, 23, 41.7], padX: 20, groupCss: 190 },
			{ tws: [28, 28, 28], padX: 20, groupCss: 130 },
			{ tws: [28, 28, 28], padX: 20, groupCss: 160 },
			{ tws: [28, 28, 28], padX: 20, groupCss: 200 },
			{ tws: [95.3, 142.4], padX: 20, groupCss: 255 },
			{ tws: [52, 52, 52, 52], padX: 8, groupCss: 245 },
		].forEach((g)=>{
			const base = segmentedWrapLevelFor({ tws: g.tws, padX: g.padX, avail: g.groupCss - 8 });
			ZS.forEach((z)=>expect([g, z, at(z, g)]).toEqual([g, z, base]));
		});
	});

	it('🔴 判别向量:不换域(视觉宽直接与布局常数相加)在 1.8 档该折不折、0.7 档放得下却折', () => {
		const mixed = (z, g)=>segmentedWrapLevelFor({ tws: g.tws.map((w)=>w * z), padX: g.padX, avail: g.groupCss * z - 8 });
		const tight = { tws: [28, 28, 28], padX: 20, groupCss: 160 };   // 布局域:(28 + 22) × 3 = 150 ≤ 内宽 152 → 放得下
		const loose = { tws: [28, 28, 28], padX: 20, groupCss: 150 };   // 布局域:150 > 内宽 142 → 放不下
		expect(at(1, tight)).toBe(0);
		expect(at(1, loose)).toBeGreaterThan(0);
		expect(mixed(0.7, tight)).toBeGreaterThan(0);                  // 混算:0.7 档误折
		expect(mixed(1.8, loose)).toBe(0);                              // 混算:1.8 档漏折
		expect(at(0.7, tight)).toBe(0);
		expect(at(1.8, loose)).toBeGreaterThan(0);
	});

	it('z 取同一元素的视觉宽 / 布局宽;量不到布局宽或差不到半像素时当作没缩放', () => {
		expect(segmentedZoomOf(360, 200)).toBeCloseTo(1.8);
		expect(segmentedZoomOf(140, 200)).toBeCloseTo(0.7);
		expect(segmentedZoomOf(190.4, 190)).toBe(1);
		expect(segmentedZoomOf(180, 0)).toBe(1);
	});
});

describe('XQSegmented · 真组件闭环(ResizeObserver 反复回调,折行类不来回翻)', () => {
	const React = require('react');
	const ReactDOM = require('react-dom');
	const { act } = require('react-dom/test-utils');
	const { XQSegmented } = require('../index');
	let host;
	let observers;
	let groupWidth;
	let unwrappedPad;
	const saved = {};
	beforeEach(() => {
		observers = [];
		groupWidth = 180;
		unwrappedPad = 10;
		saved.RO = global.ResizeObserver;
		saved.createRange = document.createRange;
		saved.gcs = window.getComputedStyle;
		saved.rect = window.HTMLElement.prototype.getBoundingClientRect;
		global.ResizeObserver = class { constructor(cb){ this.cb = cb; observers.push(this); } observe(){} disconnect(){} };
		// 文字宽 = 字数 × 13;内衬:在已挂 is-wrapped 的组里 6px(22-tail-fixes 的规则),否则按未折行档
		document.createRange = () => ({ node: null, selectNodeContents(n){ this.node = n; }, getClientRects(){ return [{ width: `${this.node.textContent}`.length * 13 }]; } });
		window.getComputedStyle = (el) => {
			const inWrapped = !!(el.closest && el.closest('.xq-segmented.is-wrapped'));
			const pad = `${inWrapped ? 6 : unwrappedPad}px`;
			return { paddingLeft: pad, paddingRight: pad, getPropertyValue: () => '' };
		};
		window.HTMLElement.prototype.getBoundingClientRect = function rect(){
			const w = this.classList && this.classList.contains('xq-segmented') ? groupWidth : 0;
			return { width: w, height: 0, left: 0, top: 0, right: w, bottom: 0, x: 0, y: 0 };
		};
		host = document.createElement('div');
		document.body.appendChild(host);
	});
	afterEach(() => {
		act(() => { ReactDOM.unmountComponentAtNode(host); });
		host.remove();
		global.ResizeObserver = saved.RO;
		document.createRange = saved.createRange;
		window.getComputedStyle = saved.gcs;
		window.HTMLElement.prototype.getBoundingClientRect = saved.rect;
	});
	const OPTIONS = [{ value: 'a', label: '甲乙丙' }, { value: 'b', label: '丁戊己' }, { value: 'c', label: '庚辛壬' }];
	const groupClass = () => host.querySelector('.xq-segmented').className;
	// 当前档:wrap = 折行(两列 / 一项一行),compact = 收内衬一行,'' = 原样
	const state = () => (/\bis-wrapped\b/.test(groupClass()) ? 'wrap' : (/\bis-compact\b/.test(groupClass()) ? 'compact' : ''));
	const pump = (n) => {
		const seen = [];
		for(let i = 0; i < n; i++){
			act(() => { observers.forEach((o) => o.cb([])); });
			seen.push(state());
		}
		return seen;
	};

	it('🔴 内宽落在闪烁带(按两档内衬结论相反):收内衬后反复回调仍然收内衬,一次都不翻回', () => {
		act(() => { ReactDOM.render(<XQSegmented value="a" options={OPTIONS} onChange={() => {}} />, host); });
		expect(state()).toBe('compact');
		expect(pump(6)).toEqual(['compact', 'compact', 'compact', 'compact', 'compact', 'compact']);
		expect(groupClass()).not.toMatch(/\bis-wrapped\b/);
	});

	it('放得下的宽度不折;收窄 → 收内衬 / 折行;变宽到放得下 → 解除(判据仍跟随真实宽度)', () => {
		groupWidth = 400;
		act(() => { ReactDOM.render(<XQSegmented value="a" options={OPTIONS} onChange={() => {}} />, host); });
		expect(state()).toBe('');
		groupWidth = 180;
		expect(pump(3)).toEqual(['compact', 'compact', 'compact']);
		groupWidth = 140;   // 内宽 132 < 收内衬 Σ 159 → 两列
		expect(pump(3)).toEqual(['wrap', 'wrap', 'wrap']);
		groupWidth = 400;
		expect(pump(3)).toEqual(['', '', '']);
	});

	it('页面覆盖了未折行内衬(如左右各 4px):按页面实测的未折行内衬判,折行后不改口径', () => {
		unwrappedPad = 4;
		// 未折档 Σ = 3×(39+8+2) = 147;内宽 140 → 折;折后若按 6px 量 Σ = 159 仍折 —— 关键是用的是 8 不是缺省 20
		groupWidth = 148;
		act(() => { ReactDOM.render(<XQSegmented value="a" options={OPTIONS} onChange={() => {}} />, host); });
		expect(pump(4)).toEqual(['wrap', 'wrap', 'wrap', 'wrap']);   // 页面内衬 8 已小于收内衬档,没有收内衬这一档
		groupWidth = 160;   // 内宽 152 ≥ 147:按页面内衬放得下(按缺省 20 会误判成折)
		expect(pump(2)).toEqual(['', '']);
	});
});

// ── 有排版时:真实排版下试排(不靠估算的可用宽)─────────────────────────────────────
// 模拟排版:控件放在「随内容定宽」的容器里(宽 = min(外部约束 W, 所需宽)),折没折、几列由类名决定;矩形 ×z(视觉域),
// clientWidth / scrollWidth 是布局域。旧判据拿自身宽当可用宽:一折就缩、缩了更折(锁存);试排只看外部约束。
describe('XQSegmented · 试排定档(随内容定宽的容器 / 换档 / 缩放)', () => {
	const React = require('react');
	const ReactDOM = require('react-dom');
	const { act } = require('react-dom/test-utils');
	const { XQSegmented, segmentedLineCount } = require('../index');
	let host; let observers; let env;
	const saved = {};
	const TEXT_W = { 完整: 26, 仅度数: 39, 仅符号: 39, 甲乙: 27.8, 丙丁: 23, 时区图: 41.7, 多罗特三主: 65, 托勒密二主: 65, 水象变体: 52 };
	const layout = (group)=>{
		const btns = [...group.querySelectorAll('.ant-radio-button-wrapper')];
		const tws = btns.map((b)=>TEXT_W[b.textContent.trim()] || 30);
		const wrapped = group.classList.contains('is-wrapped');
		const single = group.classList.contains('is-wrapped-single');
		const compact = group.classList.contains('is-compact');
		const pad = (wrapped || compact) ? 12 : 20;
		const cols = !wrapped ? btns.length : (single ? 1 : 2);
		let need;
		if(!wrapped){ need = env.equal ? Math.max(...tws.map((t)=>t + pad)) * cols + 8 : tws.reduce((a, t)=>a + t + pad, 0) + 8; }
		else{ need = Math.max(...tws.map((t)=>t + pad)) * cols + 8; }
		const gw = Math.min(env.W, need);
		const colW = (gw - 8) / cols;
		const items = btns.map((b, i)=>{
			const natural = tws[i] + pad;
			const w = (!wrapped && !env.equal) ? natural : colW;    // 内容定宽列:项按自然宽排(放不下就越出控件框)
			return { b, w, natural, tw: tws[i], pad };
		});
		let x = 4;
		const pos = items.map((it, i)=>{
			if(wrapped){ const c = i % cols; return { left: 4 + c * colW, w: colW }; }
			const p = { left: x, w: it.w }; x += it.w; return p;
		});
		return { gw, items, pos, wrapped };
	};
	const find = (el)=>{
		const group = el.closest && el.closest('.xq-segmented');
		if(!group){ return null; }
		const L = layout(group);
		if(el === group){ return { kind: 'group', L }; }
		const b = el.closest('.ant-radio-button-wrapper');
		const i = L.items.findIndex((it)=>it.b === b);
		return i < 0 ? null : { kind: el === b ? 'item' : 'label', L, i };
	};
	beforeEach(() => {
		observers = [];
		env = { W: 400, z: 1, equal: false };
		saved.RO = global.ResizeObserver;
		saved.createRange = document.createRange;
		saved.rect = window.HTMLElement.prototype.getBoundingClientRect;
		saved.cw = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, 'clientWidth') || Object.getOwnPropertyDescriptor(window.Element.prototype, 'clientWidth');
		saved.sw = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, 'scrollWidth') || Object.getOwnPropertyDescriptor(window.Element.prototype, 'scrollWidth');
		global.ResizeObserver = class { constructor(cb){ this.cb = cb; observers.push(this); } observe(){} disconnect(){} };
		Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { configurable: true, get(){ const f = find(this); if(!f){ return 0; } if(f.kind === 'group'){ return f.L.gw - 2; } return Math.max(0, f.L.pos[f.i].w - (f.kind === 'item' ? 0 : 0)); } });
		Object.defineProperty(window.HTMLElement.prototype, 'scrollWidth', { configurable: true, get(){ const f = find(this); if(!f){ return 0; } if(f.kind === 'group'){ return f.L.gw - 2; } const it = f.L.items[f.i]; const box = f.L.pos[f.i].w;
			// 两列时按钮 white-space: nowrap → 字放不下就溢出;一行时标签会换行(不溢出,改成多行)
			return f.L.wrapped ? Math.max(box, it.natural) : box; } });
		window.HTMLElement.prototype.getBoundingClientRect = function rect(){
			const f = find(this); const z = env.z;
			if(!f){ return { width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 }; }
			if(f.kind === 'group'){ return { width: f.L.gw * z, height: 30 * z, left: 0, top: 0, right: f.L.gw * z, bottom: 30 * z }; }
			const p = f.L.pos[f.i]; const it = f.L.items[f.i];
			const w = f.L.wrapped ? p.w : Math.max(p.w, it.natural);
			return { width: w * z, height: 24 * z, left: p.left * z, top: 0, right: (p.left + w) * z, bottom: 24 * z };
		};
		document.createRange = () => ({ node: null, selectNodeContents(n){ this.node = n; }, getClientRects(){
			const f = find(this.node); const z = env.z;
			if(!f || f.kind === 'group'){ return []; }
			const it = f.L.items[f.i]; const box = f.L.pos[f.i].w;
			// 一行档的等宽列:字宽 + 内衬放不进列宽 → 标签折成两行
			if(!f.L.wrapped && env.equal && it.tw + it.pad > box){ return [{ width: (it.tw / 2) * z, height: 14 * z, top: 0, bottom: 14 * z }, { width: (it.tw / 2) * z, height: 14 * z, top: 15 * z, bottom: 29 * z }]; }
			return [{ width: it.tw * z, height: 14 * z, top: 0, bottom: 14 * z }];
		} });
		host = document.createElement('div');
		document.body.appendChild(host);
	});
	afterEach(() => {
		act(() => { ReactDOM.unmountComponentAtNode(host); });
		host.remove();
		global.ResizeObserver = saved.RO;
		document.createRange = saved.createRange;
		window.HTMLElement.prototype.getBoundingClientRect = saved.rect;
		if(saved.cw){ Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', saved.cw); } else { delete window.HTMLElement.prototype.clientWidth; }
		if(saved.sw){ Object.defineProperty(window.HTMLElement.prototype, 'scrollWidth', saved.sw); } else { delete window.HTMLElement.prototype.scrollWidth; }
	});
	const groupClass = () => host.querySelector('.xq-segmented').className;
	const level = () => (/\bis-wrapped-single\b/.test(groupClass()) ? 1 : (/\bis-wrapped\b/.test(groupClass()) ? 2 : (/\bis-compact\b/.test(groupClass()) ? SEGMENTED_LEVEL_COMPACT : 0)));
	const pump = (n = 2) => { for(let i = 0; i < n; i++){ act(() => { observers.forEach((o) => o.cb([])); }); } return level(); };
	const mount = (opts) => { act(() => { ReactDOM.render(<XQSegmented value="a" options={opts} onChange={() => {}} />, host); }); return level(); };
	const DRAWER = [{ value: 'a', label: '多罗特三主' }, { value: 'b', label: '托勒密二主' }, { value: 'c', label: '水象变体' }];
	const LINE = [{ value: 'a', label: '甲乙' }, { value: 'b', label: '丙丁' }, { value: 'c', label: '时区图' }];

	it('行数按矩形上沿差数(同一行中英文字体上沿差一两像素不算换行;相邻两行字形矩形重叠也认得出)', () => {
		expect(segmentedLineCount([{ width: 10, height: 14, top: 0, bottom: 14 }, { width: 8, height: 13, top: 1.5, bottom: 14.5 }])).toBe(1);
		expect(segmentedLineCount([{ width: 10, height: 14, top: 0, bottom: 14 }, { width: 8, height: 14, top: 15, bottom: 29 }])).toBe(2);
		// line-height: 1 下相邻两行的字形矩形上下重叠(真 WebKit 实测「时区图」:1647–1664 与 1661–1678)
		expect(segmentedLineCount([{ width: 27.8, height: 17, top: 1647, bottom: 1664 }, { width: 13.9, height: 17, top: 1661, bottom: 1678 }])).toBe(2);
		expect(segmentedLineCount([])).toBe(0);
	});

	it('🔴 随内容定宽的容器:外部放得下 → 一行;外部收窄 → 折;再放宽 → 回到一行(不锁存)', () => {
		expect(mount(DRAWER)).toBe(0);
		env.W = 120;
		expect(pump()).toBeGreaterThan(0);
		env.W = 400;
		expect(pump()).toBe(0);
	});

	it('🔴 缩放 0.7 / 1 / 1.8 档(矩形 ×z、布局量不变)结论相同;先 1.8 再回 1 不锁存', () => {
		mount(DRAWER);
		[[400, 0], [200, 2], [150, 1]].forEach(([W, want]) => {
			[0.7, 1, 1.8, 1].forEach((z) => { env.W = W; env.z = z; expect([W, z, pump()]).toEqual([W, z, want]); });
		});
	});

	it('🔴 等宽列:字连内衬放不进它的列(标签折成两行)、收内衬就放得下 → 收内衬一行(三项分段里的「时区图」);再窄才折两列', () => {
		env.equal = true; env.W = 190;
		expect(mount(LINE)).toBe(SEGMENTED_LEVEL_COMPACT);
		expect(groupClass()).not.toMatch(/\bis-wrapped\b/);
		env.W = 160;
		expect(pump()).toBe(2);
		env.W = 230;
		expect(pump()).toBe(0);
	});

	it('试排前后类名一字不变(只在同一帧里临时摘挂)', () => {
		mount(DRAWER);
		env.W = 120; pump();
		const before = groupClass();
		const { segmentedTrialLevel } = require('../index');
		segmentedTrialLevel(host.querySelector('.xq-segmented'));
		expect(groupClass()).toBe(before);
	});
});

// ── 折行样式的作用域 ───────────────────────────────────────────────
// 抽屉 / 弹窗挂在 body 下,不在 .horosa-workspace-shell 里;折行规则若以主壳为前缀,那里的分段控件判成折行也不会折。
describe('is-wrapped 样式:主壳内外都生效、只作用于 XQSegmented', () => {
	const path = require('path');
	const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');
	const css = readSource(path.resolve(__dirname, '../../../layouts/app.less'));
	// 取所有「按折行类生效」的规则(选择器里有 .xq-segmented.is-wrapped;:not(.is-wrapped) 那种排除写法不算;去掉注释)
	const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').matchAll(/([^{};]*\.xq-segmented\.is-wrapped[^{};]*)\{/g)].map((m) => m[1].trim());

	it('🔴 三条折行规则都在,前缀是 :is(.horosa-workspace-shell, body)(特异性与原主壳前缀同为一个类)', () => {
		expect(rules.length).toBe(3);
		rules.forEach((sel) => {
			expect(sel.startsWith(':is(.horosa-workspace-shell, body) .xq-segmented.is-wrapped')).toBe(true);
			const rest = sel.replace(/^:is\([^)]*\)\s*/, '');
			expect((rest.match(/\.[A-Za-z][\w-]*/g) || []).length).toBeGreaterThanOrEqual(3);   // + :is 的一个类 ≥ (0,4,0)
		});
	});

	it('🔴 收内衬规则只收内衬(padding 0 6px)、前缀同折行规则;不改排布', () => {
		const clean = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
		const m = [...clean.matchAll(/([^{};]*\.xq-segmented\.is-compact[^{};]*)\{([^}]*)\}/g)];
		expect(m.length).toBe(1);
		expect(m[0][1].trim()).toBe(':is(.horosa-workspace-shell, body) .xq-segmented.is-compact .ant-radio-button-wrapper');
		expect(m[0][2].replace(/\s+/g, ' ').trim()).toBe('padding: 0 6px;');
	});

	it('🔴 抽屉(挂 body、不在主壳)里的分段控件也命中;主壳里照旧命中;没有 xq-segmented 的 antd Radio 不命中', () => {
		document.body.innerHTML = `
			<div class="horosa-workspace-shell"><div id="inShell" class="xq-segmented is-wrapped is-wrapped-single ant-radio-group"><label id="inShellBtn" class="ant-radio-button-wrapper"></label></div></div>
			<div class="ant-drawer"><div id="inDrawer" class="xq-segmented is-wrapped is-wrapped-single ant-radio-group"><label id="inDrawerBtn" class="ant-radio-button-wrapper"></label></div></div>
			<div class="ant-modal"><div id="plain" class="is-wrapped is-wrapped-single ant-radio-group"><label id="plainBtn" class="ant-radio-button-wrapper"></label></div></div>`;
		rules.forEach((sel) => {
			const btn = /ant-radio-button-wrapper\s*$/.test(sel);
			expect([`${sel}`, document.getElementById(btn ? 'inShellBtn' : 'inShell').matches(sel)]).toEqual([`${sel}`, true]);
			expect([`${sel}`, document.getElementById(btn ? 'inDrawerBtn' : 'inDrawer').matches(sel)]).toEqual([`${sel}`, true]);
			expect([`${sel}`, document.getElementById(btn ? 'plainBtn' : 'plain').matches(sel)]).toEqual([`${sel}`, false]);
		});
		document.body.innerHTML = '';
	});
});
