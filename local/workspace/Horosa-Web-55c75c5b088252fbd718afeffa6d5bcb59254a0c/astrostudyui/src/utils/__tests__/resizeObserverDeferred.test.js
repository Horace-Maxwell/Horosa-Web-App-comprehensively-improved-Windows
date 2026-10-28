/**
 * ResizeObserver 回调不许同步改尺寸(否则「ResizeObserver loop completed with undelivered notifications」,
 * 丢掉的那次通知还会让版面停在旧尺寸 —— 遁甲每个子页签 / 三式 / 三式择日 / AI 进阶实抓)。
 *
 *   ① 统一入口 utils/deferredResizeObserver:回调挪到下一帧、同帧多次通知按目标合并、断开即取消待跑的回调。
 *   ② 源码里直接 new ResizeObserver 只许出现在登记表里(每条写明为什么不会回环);新增的一律走统一入口。
 */
const fs = require('fs');
const path = require('path');
import { createDeferredResizeObserver } from '../deferredResizeObserver';

const SRC = path.resolve(__dirname, '..', '..');
const SKIP_DIRS = new Set(['__tests__', 'node_modules', 'dist', 'dist-file', '.umi', '.umi-production']);
function walk(dir, out){
	for(const name of fs.readdirSync(dir)){
		const p = path.join(dir, name);
		const st = fs.statSync(p);
		if(st.isDirectory()){ if(!SKIP_DIRS.has(name)){ walk(p, out); } }
		else if(/\.js$/.test(name)){ out.push(p); }
	}
	return out;
}
const rel = (p)=>path.relative(SRC, p).split(path.sep).join('/');

// 直接 new ResizeObserver 的登记表:文件 → 为什么不会回环
const DIRECT_RO = {
	'utils/deferredResizeObserver.js': '统一入口本身',
	'utils/chartDrawGuard.js': '回调只置位,重画排进下一帧(schedule)',
	'models/app.js': '观察最外层版面容器(尺寸由外壳决定、不随页内内容变),当帧同步工作区高不会回到它自身',
	'components/calendar/NongLi.js': '回调只按根宽改格内字号 / 行距档(变量与 state),不改被观察根的宽;逐拍收敛由 calendarCellFit 测试锁',
	'components/xq-ui/index.js': '分段控件折行:回调只在结论翻转时写一次开关(结论不变不写),闭环由 xqSegmentedWrap 测试锁',
	'components/direction/AstroDirectMain.js': '回调里 requestAnimationFrame 再量',
	'components/astro3d/AstroPDSphere.js': '回调里 requestAnimationFrame 再量',
	'components/astro3d/AstroChartMain3D.js': '回调里 setTimeout 去抖再量',
	'components/lrzhan/LiuRengChart.js': '观察宿主、回调排进下一帧重画;换档当帧就地重画也只改宿主里的 svg,不回到被观察的宿主',
};

describe('ResizeObserver 回调延帧', () => {
	test('② 直接 new ResizeObserver 只在登记表里;登记了却不再出现 = 过期', () => {
		const found = new Set();
		const extra = [];
		for(const f of walk(SRC, [])){
			const t = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
			if(/new\s+(?:window\.|global\.|self\.)?ResizeObserver\s*\(/.test(t)){   // 带 window. 前缀的也算(曾漏掉 4 处)
				const r = rel(f);
				found.add(r);
				if(!DIRECT_RO[r]){ extra.push(r); }
			}
		}
		expect(extra).toEqual([]);
		expect(Object.keys(DIRECT_RO).filter((k)=>!found.has(k))).toEqual([]);
		Object.values(DIRECT_RO).forEach((why)=>expect(why.length).toBeGreaterThan(4));
	});

	describe('① 统一入口的行为', () => {
		let rafQ;
		let origRO;
		let origRaf;
		let origCaf;
		let instances;
		beforeEach(()=>{
			rafQ = new Map();
			let seq = 0;
			origRaf = global.requestAnimationFrame;
			origCaf = global.cancelAnimationFrame;
			global.requestAnimationFrame = (fn)=>{ seq += 1; rafQ.set(seq, fn); return seq; };
			global.cancelAnimationFrame = (h)=>{ rafQ.delete(h); };
			origRO = global.ResizeObserver;
			instances = [];
			global.ResizeObserver = class {
				constructor(cb){ this.cb = cb; this.targets = new Set(); instances.push(this); }
				observe(el){ this.targets.add(el); }
				unobserve(el){ this.targets.delete(el); }
				disconnect(){ this.targets.clear(); }
				fire(entries){ this.cb(entries, this); }
			};
		});
		afterEach(()=>{
			global.ResizeObserver = origRO;
			global.requestAnimationFrame = origRaf;
			global.cancelAnimationFrame = origCaf;
		});
		const flush = ()=>{ const q = Array.from(rafQ.values()); rafQ.clear(); q.forEach((fn)=>fn()); };

		test('回调不在通知当拍执行,下一帧执行一次;同帧多次通知按目标合并', () => {
			const calls = [];
			const ro = createDeferredResizeObserver((entries)=>calls.push(entries.map((e)=>`${e.target.id}:${e.w}`)));
			const a = { id: 'a' };
			const b = { id: 'b' };
			ro.observe(a); ro.observe(b);
			instances[0].fire([{ target: a, w: 1 }]);
			instances[0].fire([{ target: a, w: 2 }, { target: b, w: 5 }]);
			expect(calls).toEqual([]);
			flush();
			expect(calls).toEqual([['a:2', 'b:5']]);
			flush();
			expect(calls.length).toBe(1);
		});

		test('断开后待跑的回调作废;重新 observe 恢复', () => {
			const calls = [];
			const ro = createDeferredResizeObserver(()=>calls.push(1));
			const a = { id: 'a' };
			ro.observe(a);
			instances[0].fire([{ target: a }]);
			ro.disconnect();
			flush();
			expect(calls).toEqual([]);
			ro.observe(a);
			instances[0].fire([{ target: a }]);
			flush();
			expect(calls).toEqual([1]);
		});

		test('rAF 同步回调(测试桩 / 兜底实现)时也不卡死:每次通知都能再排队', () => {
			global.requestAnimationFrame = (fn)=>{ fn(); return 7; };
			const calls = [];
			const ro = createDeferredResizeObserver((entries)=>calls.push(entries[0].w));
			const a = { id: 'a' };
			ro.observe(a);
			instances[0].fire([{ target: a, w: 1 }]);
			instances[0].fire([{ target: a, w: 2 }]);
			expect(calls).toEqual([1, 2]);
		});

		test('没有 ResizeObserver 的环境返回 null', () => {
			global.ResizeObserver = undefined;
			expect(createDeferredResizeObserver(()=>{})).toBeNull();
		});
	});
});

describe('③ 表格内观察器通知延帧(antd 表格量列宽同帧改尺寸 → 回环)', () => {
	// eslint-disable-next-line global-require
	const { installTableResizeObserverDefer } = require('../deferredResizeObserver');
	const mk = ()=>{
		const rafQ = [];
		const inst = [];
		class FakeRO { constructor(cb){ this.cb = cb; inst.push(this); } observe(){} unobserve(){} disconnect(){} fire(entries){ this.cb(entries, this); } }
		const win = { ResizeObserver: FakeRO, requestAnimationFrame: (fn)=>{ rafQ.push(fn); return rafQ.length; }, localStorage: { getItem: ()=>null } };
		return { win, rafQ, inst };
	};
	const { THIRD_PARTY_RO_DEFER_SCOPE } = require('../deferredResizeObserver');
	const el = (inTable)=>({ closest: (sel)=>(sel === THIRD_PARTY_RO_DEFER_SCOPE && inTable ? {} : null) });
	test('表内目标挪到下一帧且同帧合并;表外目标照原生同步;只装一次', () => {
		const { win, rafQ, inst } = mk();
		expect(installTableResizeObserverDefer(win)).toBe(true);
		expect(installTableResizeObserverDefer(win)).toBe(false);
		const calls = [];
		const ro = new win.ResizeObserver((entries)=>calls.push(entries.length));
		const a = el(true); const b = el(false);
		inst[0].fire([{ target: a }]);
		inst[0].fire([{ target: a }, { target: b }]);
		expect(calls).toEqual([]);
		expect(rafQ.length).toBe(1);
		rafQ.shift()();
		expect(calls).toEqual([2]);
		inst[0].fire([{ target: b }]);
		expect(calls).toEqual([2, 1]);
		ro.disconnect();
	});
	test('延帧范围 = 表格 + 页签导航(rc-tabs 量导航条同帧改尺寸的回环同族)', () => {
		expect(THIRD_PARTY_RO_DEFER_SCOPE.split(',').map((x)=>x.trim()).sort()).toEqual(['.ant-table', '.ant-tabs-nav']);
		if(typeof document !== 'undefined'){
			document.body.innerHTML = '<div class="ant-tabs"><div class="ant-tabs-nav"><div class="ant-tabs-nav-wrap"><div class="ant-tabs-nav-list" id="nl"></div></div></div><div class="ant-tabs-content-holder" id="ch"></div></div>';
			expect(!!document.getElementById('nl').closest(THIRD_PARTY_RO_DEFER_SCOPE)).toBe(true);
			expect(!!document.getElementById('ch').closest(THIRD_PARTY_RO_DEFER_SCOPE)).toBe(false);   // 页签内容区(盘面)不延帧
			document.body.innerHTML = '';
		}
	});
	test('回退阀关掉就不装', () => {
		const { win } = mk();
		win.localStorage.getItem = (k)=>(k === 'horosa.compat.tableRoDefer' ? '0' : null);
		expect(installTableResizeObserverDefer(win)).toBe(false);
	});
	test('开机最早一批 import 就装好(早于第三方组件模块抓走原生观察器)', () => {
		const g = fs.readFileSync(path.join(SRC, 'global.js'), 'utf8');
		const imports = [...g.matchAll(/^import [^\n]*$/gm)].map((m)=>m[0]);
		expect(imports.findIndex((l)=>/tableResizeObserverBoot/.test(l))).toBeLessThanOrEqual(1);
	});
});

describe('④ 换档当拍同步重量(换档后第一帧盘面即按终值排)', () => {
	// eslint-disable-next-line global-require
	const { registerZoomSyncRemeasure, inZoomChangeFrame } = require('../zoomSyncRemeasure');
	test('resize 当拍同步跑登记的量盘函数;只有声明缩放真变了才算换档帧,标志跨到下一帧末才清;注销后不再跑', () => {
		const q = [];
		const origRaf = global.requestAnimationFrame;
		global.requestAnimationFrame = (fn)=>{ q.push(fn); return q.length; };
		try{
			let n = 0;
			document.documentElement.style.zoom = '';
			const off = registerZoomSyncRemeasure(()=>{ n += 1; });
			// 普通窗口 resize(拖窗 / 壳的 resize 桥):量盘函数照跑,但不是换档帧 —— 盘面观察器不在通知回调里同步重画
			window.dispatchEvent(new Event('resize'));
			expect(n).toBe(1);
			expect(inZoomChangeFrame()).toBe(false);
			// 壳换档:先改文档缩放、再同步派发 resize
			document.documentElement.style.zoom = '1.8';
			window.dispatchEvent(new Event('resize'));
			expect(n).toBe(2);
			expect(inZoomChangeFrame()).toBe(true);
			q.shift()();                       // 本帧动画回调(先于观察器通知):标志仍在
			expect(inZoomChangeFrame()).toBe(true);
			q.shift()();                       // 下一帧
			expect(inZoomChangeFrame()).toBe(false);
			// 同档再来一次 resize:不是换档
			window.dispatchEvent(new Event('resize'));
			expect(inZoomChangeFrame()).toBe(false);
			off();
			window.dispatchEvent(new Event('resize'));
			expect(n).toBe(3);
		}finally{ global.requestAnimationFrame = origRaf; document.documentElement.style.zoom = ''; }
	});
	test('按盘量尺寸的两条入口(boxSizeVars / 盘面 svg 观察器)都登记了换档当拍同步', () => {
		expect(fs.readFileSync(path.join(SRC, 'utils/boxSizeVars.js'), 'utf8')).toMatch(/unreg = registerZoomSyncRemeasure\(apply\)/);
		const g = fs.readFileSync(path.join(SRC, 'utils/chartDrawGuard.js'), 'utf8');
		expect(g).toMatch(/registerZoomSyncRemeasure\(/);
		expect(g).toMatch(/if\(inZoomChangeFrame\(\)\)\{/);
	});
});

describe('⑤ 换档帧同步重量登记表(延帧观察器在换档帧里由工作区观察器同步跑)', () => {
	// eslint-disable-next-line global-require
	const DR = require('../deferredResizeObserver');
	let rafQ; let origRO; let origRaf; let origCaf; let instances;
	beforeEach(()=>{
		rafQ = new Map(); let seq = 0;
		origRaf = global.requestAnimationFrame; origCaf = global.cancelAnimationFrame;
		global.requestAnimationFrame = (fn)=>{ seq += 1; rafQ.set(seq, fn); return seq; };
		global.cancelAnimationFrame = (h)=>{ rafQ.delete(h); };
		origRO = global.ResizeObserver; instances = [];
		global.ResizeObserver = class { constructor(cb){ this.cb = cb; instances.push(this); } observe(){} unobserve(){} disconnect(){} fire(entries){ this.cb(entries, this); } };
	});
	afterEach(()=>{ global.ResizeObserver = origRO; global.requestAnimationFrame = origRaf; global.cancelAnimationFrame = origCaf; });
	const flush = ()=>{ const q = Array.from(rafQ.values()); rafQ.clear(); q.forEach((fn)=>fn()); };
	const box = (w, h)=>{ const el = document.createElement('div'); Object.defineProperty(el, 'clientWidth', { value: w, configurable: true }); Object.defineProperty(el, 'clientHeight', { value: h, configurable: true }); document.body.appendChild(el); return el; };

	test('observe 即登记、disconnect 即撤登记;同步跑按目标现量给 contentRect,当拍执行', () => {
		const before = DR.__zoomFrameRegistrySize();
		const calls = [];
		const ro = DR.createDeferredResizeObserver((entries)=>calls.push(entries.map((e)=>`${e.contentRect.width}x${e.contentRect.height}`)));
		const a = box(320, 200);
		ro.observe(a);
		expect(DR.__zoomFrameRegistrySize()).toBe(before + 1);
		expect(DR.runZoomFrameResizeObservers()).toBeGreaterThanOrEqual(1);
		expect(calls).toEqual([['320x200']]);
		ro.disconnect();
		expect(DR.__zoomFrameRegistrySize()).toBe(before);
		document.body.removeChild(a);
	});

	test('同步跑撤掉本帧已排的延帧回调;随后到达的同尺寸原生通知被剔掉,尺寸不同的照常延帧', () => {
		const calls = [];
		const ro = DR.createDeferredResizeObserver((entries)=>calls.push(entries.map((e)=>e.contentRect.width)));
		const a = box(500, 300);
		ro.observe(a);
		instances[0].fire([{ target: a, contentRect: { width: 400, height: 300 } }]);   // 旧尺寸的通知先排了队
		DR.runZoomFrameResizeObservers();
		expect(calls).toEqual([[500]]);
		flush();
		expect(calls).toEqual([[500]]);                                                   // 排队的旧回调已撤
		instances[0].fire([{ target: a, contentRect: { width: 500, height: 300 } }]);   // 换档帧随后到达的原生通知:同尺寸 → 剔掉
		flush();
		expect(calls).toEqual([[500]]);
		instances[0].fire([{ target: a, contentRect: { width: 520, height: 300 } }]);   // 之后真变了:照常延帧
		expect(calls).toEqual([[500]]);
		flush();
		expect(calls).toEqual([[500], [520]]);
		ro.disconnect();
		document.body.removeChild(a);
	});

	test('补跑一遍只跑目标现量变了的观察器(第一遍回调改了版面时同帧补齐)', () => {
		const calls = [];
		const ro = DR.createDeferredResizeObserver((entries)=>calls.push(entries.map((e)=>e.contentRect.width)));
		const a = box(300, 200);
		ro.observe(a);
		DR.runZoomFrameResizeObservers();
		expect(calls).toEqual([[300]]);
		DR.runZoomFrameResizeObservers({ changedOnly: true });
		expect(calls).toEqual([[300]]);                                  // 没变:不补跑
		Object.defineProperty(a, 'clientWidth', { value: 293, configurable: true });   // 第一遍之后冒出滚动条
		DR.runZoomFrameResizeObservers({ changedOnly: true });
		expect(calls).toEqual([[300], [293]]);
		ro.disconnect();
		document.body.removeChild(a);
	});

	test('换档帧里文档根挂过渡抑制类,下一帧末撤掉', () => {
		const q = [];
		const origRaf = global.requestAnimationFrame;
		global.requestAnimationFrame = (fn)=>{ q.push(fn); return q.length; };
		try{
			// eslint-disable-next-line global-require
			const { markZoomChangeFrame, inZoomChangeFrame } = require('../zoomSyncRemeasure');
			while(inZoomChangeFrame() && q.length){ q.shift()(); }
			markZoomChangeFrame();
			expect(document.documentElement.classList.contains('horosa-zoom-switching')).toBe(true);
			q.shift()(); q.shift()();
			expect(document.documentElement.classList.contains('horosa-zoom-switching')).toBe(false);
		}finally{ global.requestAnimationFrame = origRaf; }
		expect(fs.readFileSync(path.join(SRC, 'layouts/app/22-tail-fixes.less'), 'utf8')).toMatch(/html\.horosa-zoom-switching \*,[\s\S]{0,120}transition: none !important;/);
	});

	test('工作区观察器在换档帧里调登记表并同帧补跑(盘面最小字下限同步就位);紫微 / 3D 宿主观察器走统一入口(换档首帧即终值)', () => {
		const app = fs.readFileSync(path.join(SRC, 'models/app.js'), 'utf8');
		expect(app).toMatch(/if\(zs\.inZoomChangeFrame\(\)\)\{[\s\S]{0,400}dr\.runZoomFrameResizeObservers\(\);[\s\S]{0,400}floor\.runChartTextFloorNow\(\);[\s\S]{0,120}runZoomFrameResizeObservers\(\{ changedOnly: true \}\)/);
		expect(app).toMatch(/installZoomChangeWatch\(\)/);
		for(const f of ['components/ziwei/ZiWeiChart.js', 'components/astro3d/AstroChart3D.js']){
			expect(`${f}:${/createDeferredResizeObserver\(/.test(fs.readFileSync(path.join(SRC, f), 'utf8'))}`).toBe(`${f}:true`);
		}
	});
});
