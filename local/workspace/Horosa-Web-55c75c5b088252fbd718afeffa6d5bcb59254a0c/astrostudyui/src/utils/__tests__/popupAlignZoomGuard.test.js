// [Tahoe 浮层根治] 缩放域 × dom-align 对齐守卫。
//
// 病理复读:桌面壳缩放走 documentElement.style.zoom;CSS zoom 下 getBoundingClientRect
// 返回 rect 域(已缩放)、style.left/top 是 CSS 域(未缩放);dom-align@1.12.4 的
// setLeftTop() 把 rect 域位移直接写进 CSS 域,误差 Δ = (z−1)·[(D−C) + 999z]
// (999 来自它内部的 -999px 探针 ⇒ 常数项;另一项随距离线性放大)。
//
// 本套件的关键设计:**T3 先断言「不打钩子必须复现 bug」再断言「打钩子后精确对齐」**——
// 能复现才证明测试真的踩在病灶上,否则修好修坏都绿(仓库既往多次假绿的教训)。
// 且 jest 走 package.main = dist-node/index.js,**正是被补丁改过、也正是浏览器侧
// dist-web 的同源那份**,不是替身。
import { alignElement, alignPoint } from 'dom-align';
import {
	resolveViewportScale, clientToLayoutPx, getEffectiveScale, getDeclaredZoom,
	installAlignHooks, __resetScaleCacheForTest, ALIGN_ZOOM_KILL_KEY,
} from '../zoomDomain';

const PATCH_MARK = 'horosa:dom-align-zoom';

// ── 假布局模型:rect = f(style.left/top, Z) ──────────────────────────────
// jsdom 不做布局,getBoundingClientRect 恒 0。这里按 CSS zoom 的真实语义搭最小模型:
// 元素的 rect 坐标 = 其 specified left/top × Z(包含块原点 C=0,对应 body{position:fixed;inset:0})。
let Z = 1;
const origRect = Element.prototype.getBoundingClientRect;

function installLayoutModel(){
	Element.prototype.getBoundingClientRect = function(){
		const l = parseFloat(this.style.left) || 0;
		const t = parseFloat(this.style.top) || 0;
		const w = parseFloat(this.style.width) || 0;
		const h = parseFloat(this.style.height) || 0;
		return {
			left: l * Z, top: t * Z, width: w * Z, height: h * Z,
			right: (l + w) * Z, bottom: (t + h) * Z,
			x: l * Z, y: t * Z,
			toJSON(){ return this; },
		};
	};
}
function restoreLayoutModel(){ Element.prototype.getBoundingClientRect = origRect; }

function mkEl(css){
	const el = document.createElement('div');
	el.style.cssText = css;
	document.body.appendChild(el);
	return el;
}

// 期望值:popup 左上角贴 target 左下角(points ['tl','bl'])。
// 目标 rect.left = target.rect.left;目标 rect.top = target.rect.bottom。
function alignAndMeasure(z, hooked){
	Z = z;
	__resetScaleCacheForTest();
	if(hooked){
		window.__HOROSA_ALIGN_SCALE__ = () => z;
		window.__HOROSA_ALIGN_VIEWPORT_SCALE__ = () => 1;
	}else{
		delete window.__HOROSA_ALIGN_SCALE__;
		delete window.__HOROSA_ALIGN_VIEWPORT_SCALE__;
	}
	const target = mkEl('position:absolute;left:600px;top:400px;width:120px;height:32px;');
	const popup = mkEl('position:absolute;left:0px;top:0px;width:200px;height:300px;');
	alignElement(popup, target, {
		points: ['tl', 'bl'],
		offset: [0, 0],
		overflow: { adjustX: 0, adjustY: 0 },   // 关翻转,单测只验基础对齐换算
	});
	const pr = popup.getBoundingClientRect();
	const tr = target.getBoundingClientRect();
	const out = { popupLeftCss: parseFloat(popup.style.left), popupRectLeft: pr.left, targetRectLeft: tr.left, dx: pr.left - tr.left, dy: pr.top - tr.bottom };
	popup.remove(); target.remove();
	return out;
}

describe('T1 缩放域纯函数', () => {
	it('resolveViewportScale:同域→1 / 布局域→z / z=1 恒为 1', () => {
		expect(resolveViewportScale(1000, 1000, 0.8)).toBe(1);       // clientWidth 与 innerWidth 同域(本仓实况)
		expect(resolveViewportScale(1250, 1000, 0.8)).toBe(0.8);     // clientWidth 是布局域 → 需补偿
		expect(resolveViewportScale(1234, 999, 1)).toBe(1);
		expect(resolveViewportScale(0, 0, 0.8)).toBe(1);             // 读数缺失→安全回落
	});
	it('clientToLayoutPx:z=1 恒等;z≠1 精确除;非数安全', () => {
		expect(clientToLayoutPx(123.4, 1)).toBe(123.4);
		expect(clientToLayoutPx(80, 0.8)).toBe(100);
		expect(clientToLayoutPx(90, 0.9)).toBeCloseTo(100, 6);
		expect(clientToLayoutPx('x', 0.8)).toBe('x');
	});
});

describe('T2 实测探针', () => {
	beforeEach(() => { __resetScaleCacheForTest(); document.documentElement.style.zoom = ''; try{ window.localStorage.removeItem(ALIGN_ZOOM_KILL_KEY); }catch(e){ /* ignore */ } });
	afterEach(() => { restoreLayoutModel(); document.documentElement.style.zoom = ''; });

	it('🔴 默认档(声明=1):返回 1 且**探针 DOM 从未创建**(零 reflow 成本锁)', () => {
		installLayoutModel();
		Z = 1;
		const spy = jest.spyOn(document.body, 'appendChild');
		expect(getEffectiveScale()).toBe(1);
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it('声明 0.8 且引擎生效 → 实测 0.8', () => {
		installLayoutModel();
		Z = 0.8;
		document.documentElement.style.zoom = '0.8';
		expect(getEffectiveScale()).toBeCloseTo(0.8, 6);
	});

	it('🔴 声明 0.8 但引擎**不生效** → 实测 1(老 macOS 逐字节不变锁)', () => {
		installLayoutModel();
		Z = 1;                                   // 引擎没应用 zoom:探针量出原宽
		document.documentElement.style.zoom = '0.8';
		expect(getEffectiveScale()).toBe(1);
	});

	it('kill-switch=0 → 恒 1', () => {
		installLayoutModel();
		Z = 0.8;
		document.documentElement.style.zoom = '0.8';
		window.localStorage.setItem(ALIGN_ZOOM_KILL_KEY, '0');
		expect(getEffectiveScale()).toBe(1);
		window.localStorage.removeItem(ALIGN_ZOOM_KILL_KEY);
	});

	it('缓存:同声明值只测一次;声明值变化后重测', () => {
		installLayoutModel();
		Z = 0.8;
		document.documentElement.style.zoom = '0.8';
		expect(getEffectiveScale()).toBeCloseTo(0.8, 6);
		const spy = jest.spyOn(document.body, 'appendChild');
		expect(getEffectiveScale()).toBeCloseTo(0.8, 6);
		expect(spy).not.toHaveBeenCalled();          // 命中缓存
		document.documentElement.style.zoom = '1.2';
		Z = 1.2;
		expect(getEffectiveScale()).toBeCloseTo(1.2, 6);
		expect(spy).toHaveBeenCalled();              // 声明变了必须重测
		spy.mockRestore();
	});

	// 契约已于 2026-09-19 更换(不是把测试改绿):旧契约「inline 缺席回落 shellZoom(query/键)」本身就是病灶——
	// query/键是壳的**启动传输层**,运行期不更新;壳调回 100% 时恰恰把 inline 清空 ⇒ 读回启动旧档。
	it('getDeclaredZoom:只读 documentElement 内联 zoom;缺席 = 1;近 1 脏值按 1', () => {
		document.documentElement.style.zoom = '1.4';
		expect(getDeclaredZoom()).toBeCloseTo(1.4, 6);
		document.documentElement.style.zoom = '';
		expect(getDeclaredZoom()).toBe(1);
		document.documentElement.style.zoom = '1.0000000000000002';   // 老壳 f64 累加脏值
		expect(getDeclaredZoom()).toBe(1);
	});

	it('🔴 [运行期真值] 0.8 档启动 → 运行时调回 100%(壳清空 inline,键仍是启动旧值):声明=1、补偿除数=1', () => {
		installLayoutModel();
		// 启动:global.js 把 0.8 镜像到 inline,引擎生效;首个浮层打开 → 实测 0.8 入缓存(键 = 声明值 0.8)
		window.localStorage.setItem('horosa.shell.zoom', '0.8');
		Z = 0.8;
		document.documentElement.style.zoom = '0.8';
		expect(getEffectiveScale()).toBeCloseTo(0.8, 6);
		// 运行时 ⌘+ 调回 100%:壳的 __HOROSA_APPLY_SHELL_ZOOM(1) 把 inline 清成空串;URL query 不变(jsdom 里用键模拟
		// 「传输层还留着启动旧值」——旧实现每次读 query 还会把键冲回旧值)
		Z = 1;
		document.documentElement.style.zoom = '';
		expect(getDeclaredZoom()).toBe(1);           // 旧实现:0.8(读回传输层)
		expect(getEffectiveScale()).toBe(1);         // 旧实现:声明 0.8 → 命中启动缓存 → 0.8 → 全站浮层错位 (1/0.8−1)(D+999)
		window.localStorage.removeItem('horosa.shell.zoom');
	});
});

describe('T3 dom-align 对齐行为(测的就是被补丁的真文件)', () => {
	beforeEach(() => { installLayoutModel(); __resetScaleCacheForTest(); });
	afterEach(() => {
		restoreLayoutModel();
		delete window.__HOROSA_ALIGN_SCALE__;
		delete window.__HOROSA_ALIGN_VIEWPORT_SCALE__;
		Z = 1;
	});

	it('🔴 zoom=1:装钩子与不装钩子结果**完全相同**(零回归锁)', () => {
		const a = alignAndMeasure(1, false);
		const b = alignAndMeasure(1, true);
		expect(b.popupLeftCss).toBe(a.popupLeftCss);
		expect(Math.abs(a.dx)).toBeLessThan(1);      // 且本就是对齐的
		expect(Math.abs(a.dy)).toBeLessThan(1);
	});

	it('🔴 zoom=0.8 不装钩子:**必须复现 bug**,且偏差逐位吻合病理闭式解', () => {
		const r = alignAndMeasure(0.8, false);
		expect(Math.abs(r.dx)).toBeGreaterThan(50);  // 真的错了(不是测试踩空)
		// 闭式解 Δ = (z−1)(D−C) + z·(preset − floor(preset·z)),preset = −999(库内探针)。
		// 末项的 floor 来自 dom-align getClientPosition 的 `x = Math.floor(box.left)`。
		// z=0.8, D=480, C=0 ⇒ (−0.2)(480) + 0.8·(−999+800) = −96 − 159.2 = −255.2。
		const z = 0.8; const D = 600 * z; const preset = -999;
		const expected = (z - 1) * D + z * (preset - Math.floor(preset * z));
		expect(r.dx).toBeCloseTo(expected, 6);       // 6 位小数级吻合 = 病理模型被逐位锁死
	});

	// 补丁后残差来源:上述 floor 取整,恒 < 1 CSS px ⇒ 亚像素、肉眼不可见。
	// 不要把容差收紧到 0——那不是补丁的问题,是库读坐标时主动取整的。
	it('zoom=0.7/0.8/0.9/1.2/1.8 装钩子:popup 与 target 精确对齐(<1px)', () => {
		[0.7, 0.8, 0.9, 1.2, 1.8].forEach((z) => {
			const r = alignAndMeasure(z, true);
			expect(Math.abs(r.dx)).toBeLessThan(1);
			expect(Math.abs(r.dy)).toBeLessThan(1);
		});
	});

	// 🔴 此前 T3 全用 `window.__HOROSA_ALIGN_SCALE__ = () => z` 的**桩**,恰好绕开了出事的「声明值 → 缓存 → 补偿除数」真链路,
	// 所以这条缺陷在 jest 里结构性不可见。本例装**真钩子**并走完「启动 → 开浮层 → 运行时换档 → 再开浮层」的生命周期。
	it('🔴 [运行期真值] 真钩子全链:0.8 档启动开过浮层 → 调回 100% → 再换 1.2,三拍都精确对齐', () => {
		delete window.__HOROSA_ALIGN_SCALE__;
		delete window.__HOROSA_ALIGN_VIEWPORT_SCALE__;
		installAlignHooks();
		const open = () => {
			const target = mkEl('position:absolute;left:600px;top:400px;width:120px;height:32px;');
			const popup = mkEl('position:absolute;left:0px;top:0px;width:200px;height:300px;');
			alignElement(popup, target, { points: ['tl', 'bl'], offset: [0, 0], overflow: { adjustX: 0, adjustY: 0 } });
			const pr = popup.getBoundingClientRect(); const tr = target.getBoundingClientRect();
			const out = { dx: pr.left - tr.left, dy: pr.top - tr.bottom };
			popup.remove(); target.remove();
			return out;
		};
		window.localStorage.setItem('horosa.shell.zoom', '0.8');     // 传输层里的启动旧值,全程不变(= URL query 的处境)
		Z = 0.8; document.documentElement.style.zoom = '0.8';
		let r = open();
		expect(Math.abs(r.dx)).toBeLessThan(1); expect(Math.abs(r.dy)).toBeLessThan(1);
		Z = 1; document.documentElement.style.zoom = '';             // 壳调回 100%:inline 清空
		r = open();
		// 旧实现此处 dx = (1/0.8−1)·(600+999) ≈ +399.75、dy = (1/0.8−1)·(432+999) ≈ +357.75 —— 与实测位移同式
		expect(Math.abs(r.dx)).toBeLessThan(1); expect(Math.abs(r.dy)).toBeLessThan(1);
		Z = 1.2; document.documentElement.style.zoom = '1.2';
		r = open();
		expect(Math.abs(r.dx)).toBeLessThan(1); expect(Math.abs(r.dy)).toBeLessThan(1);
		document.documentElement.style.zoom = '';
		window.localStorage.removeItem('horosa.shell.zoom');
	});

	it('alignPoint(右键菜单路径)在 zoom=0.8 下同样精确', () => {
		Z = 0.8;
		__resetScaleCacheForTest();
		window.__HOROSA_ALIGN_SCALE__ = () => 0.8;
		window.__HOROSA_ALIGN_VIEWPORT_SCALE__ = () => 1;
		const popup = mkEl('position:absolute;left:0px;top:0px;width:160px;height:120px;');
		alignPoint(popup, { clientX: 400, clientY: 300 }, { points: ['tl'], overflow: { adjustX: 0, adjustY: 0 } });
		const pr = popup.getBoundingClientRect();
		expect(Math.abs(pr.left - 400)).toBeLessThan(1);
		expect(Math.abs(pr.top - 300)).toBeLessThan(1);
		popup.remove();
	});
});

// ── T3b 翻转 / 夹紧半程(adjustY)── 旧守卫把 overflow 全关,且 jsdom 的视口读数全为 0 ⇒ getVisibleRectForElement 恒返回 null,
// dom-align 的「触发器是否在可视区内 → 要不要翻转 / 夹紧」整段从未被任何测试执行过。真机病:壳放大档下,左栏靠下的下拉明明上方放得下
// 却不翻转、直接伸出窗口底边(真 WebKit 1.8 档 570 个样本里 14 个,超出 53~192 视觉 px)。根因:祖先裁剪循环把 rect 域的 offset
// 与布局域的 clientWidth/Height **直接相加** ⇒ z>1 时把滚动祖先的可视区算矮,触发器被判「不可见」,翻转 / 夹紧被整段跳过。
describe('T3b 翻转半程:滚动祖先的可视区必须在 rect 域里算', () => {
	const VW = 1440; const VH = 900;                     // 视口读数与 rect 同域(真机实测:WebKit 与 Chromium 皆然)
	const saved = {};
	function stubViewport(){
		['clientWidth', 'clientHeight'].forEach((k) => {
			saved[k] = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, k) || Object.getOwnPropertyDescriptor(window.Element.prototype, k);
			Object.defineProperty(window.HTMLElement.prototype, k, {
				configurable: true,
				get(){
					if(this === document.documentElement){ return k === 'clientWidth' ? VW : VH; }
					return parseFloat(k === 'clientWidth' ? this.style.width : this.style.height) || 0;   // 布局域(CSS px)
				},
			});
		});
		saved.iw = window.innerWidth; saved.ih = window.innerHeight;
		window.innerWidth = VW; window.innerHeight = VH;
		document.body.style.overflow = 'hidden';
	}
	function restoreViewport(){
		['clientWidth', 'clientHeight'].forEach((k) => { if(saved[k]){ Object.defineProperty(window.HTMLElement.prototype, k, saved[k]); } else { delete window.HTMLElement.prototype[k]; } });
		window.innerWidth = saved.iw; window.innerHeight = saved.ih;
		document.body.style.overflow = '';
	}
	beforeEach(() => { installLayoutModel(); __resetScaleCacheForTest(); stubViewport(); });
	afterEach(() => {
		restoreViewport(); restoreLayoutModel();
		delete window.__HOROSA_ALIGN_SCALE__; delete window.__HOROSA_ALIGN_VIEWPORT_SCALE__;
		document.documentElement.style.zoom = ''; Z = 1;
	});

	// 几何取自真机 1.8 档:左栏 CSS(top 78, 高 363)→ rect(140 .. 793);触发器 CSS top 294 高 36 → rect(529 .. 594);
	// 下拉 CSS 高 266 → rect 高 478:放正下 594+478 > 900 出视口,翻到正上 529−478 = 51 ≥ 0 放得下 ⇒ 必须翻转。
	function openNearPanelBottom(){
		const panel = mkEl('position:absolute;overflow:auto;left:4px;top:78px;width:330px;height:363px;');
		const target = mkEl('position:absolute;left:16px;top:294px;width:140px;height:36px;');
		panel.appendChild(target);
		const popup = mkEl('position:absolute;left:0px;top:0px;width:140px;height:266px;');
		alignElement(popup, target, { points: ['tl', 'bl'], offset: [0, 4], overflow: { adjustX: 1, adjustY: 1 } });
		const pr = popup.getBoundingClientRect(); const tr = target.getBoundingClientRect();
		const out = { popTop: pr.top, popBottom: pr.bottom, trigTop: tr.top, trigBottom: tr.bottom };
		popup.remove(); panel.remove();
		return out;
	}

	it('🔴 z=1.8 真钩子:触发器在滚动祖先可视区下半部 → 下拉翻到正上(不伸出视口底)', () => {
		installAlignHooks();
		Z = 1.8; document.documentElement.style.zoom = '1.8';
		const r = openNearPanelBottom();
		expect(r.popBottom).toBeLessThanOrEqual(VH + 1);                    // 旧实现:≈ 594+4+478 = 1076,伸出视口 176
		expect(Math.abs(r.popBottom - (r.trigTop - 4))).toBeLessThan(2);    // 翻到正上:下拉底贴触发器顶(offset 翻号)
	});

	it('🔴 z=1:同一几何按 1 倍放得下 → 不翻转,与未打补丁逐位相同(零回归锁)', () => {
		Z = 1; document.documentElement.style.zoom = '';
		delete window.__HOROSA_ALIGN_SCALE__; delete window.__HOROSA_ALIGN_VIEWPORT_SCALE__;
		const a = openNearPanelBottom();
		installAlignHooks();
		const b = openNearPanelBottom();
		expect(b.popTop).toBe(a.popTop);
		expect(Math.abs(a.popTop - (a.trigBottom + 4))).toBeLessThan(1);
	});
});

// ── T3c 较旧的 macOS WebKit 语义:rect **不**反映缩放(rect 域 = 布局域),而 clientWidth / innerHeight 仍报物理尺寸 ──────────────
// 这类引擎上「可见视口」在 rect 域里只有 物理 ÷ 缩放。对齐库拿物理尺寸当可见区 ⇒ 放大档以为下方还有大片空间,靠下的下拉不翻转、
// 直接伸出窗口底边(headless 双引擎闸 E2 语义实抓:超出 69 视觉 px)。两处都要对:视口系数改直接量(此前靠 rect 缩放 = 1 提前返回 1)、
// 补丁 v3 让 body overflow:hidden 分支的「文档尺寸」读数也过这个系数(否则 max() 又被物理值顶回去)。
describe('T3c rect 不反映缩放的引擎 · 放大档下拉必须翻转', () => {
	const VW = 1440; const VH = 900; const ZOOM = 1.8;
	const saved = {};
	beforeEach(() => {
		__resetScaleCacheForTest();
		// rect = 布局值 × 1;唯独「铺满视口的 fixed 元素」量出来是 物理 ÷ 缩放(这就是该引擎上视口在 rect 域的真实大小)
		Element.prototype.getBoundingClientRect = function(){
			const st = this.style;
			if(st.position === 'fixed' && st.right === '0px'){ return { left: 0, top: 0, width: VW / ZOOM, height: VH / ZOOM, right: VW / ZOOM, bottom: VH / ZOOM, x: 0, y: 0, toJSON(){ return this; } }; }
			const l = parseFloat(st.left) || 0; const t = parseFloat(st.top) || 0; const w = parseFloat(st.width) || 0; const h = parseFloat(st.height) || 0;
			return { left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t, toJSON(){ return this; } };
		};
		['clientWidth', 'clientHeight'].forEach((k) => {
			saved[k] = Object.getOwnPropertyDescriptor(window.HTMLElement.prototype, k) || Object.getOwnPropertyDescriptor(window.Element.prototype, k);
			Object.defineProperty(window.HTMLElement.prototype, k, { configurable: true, get(){ if(this === document.documentElement){ return k === 'clientWidth' ? VW : VH; } return parseFloat(k === 'clientWidth' ? this.style.width : this.style.height) || 0; } });
		});
		saved.iw = window.innerWidth; saved.ih = window.innerHeight;
		window.innerWidth = VW; window.innerHeight = VH;
		document.body.style.overflow = 'hidden';
		document.documentElement.style.zoom = String(ZOOM);
	});
	afterEach(() => {
		['clientWidth', 'clientHeight'].forEach((k) => { if(saved[k]){ Object.defineProperty(window.HTMLElement.prototype, k, saved[k]); } else { delete window.HTMLElement.prototype[k]; } });
		window.innerWidth = saved.iw; window.innerHeight = saved.ih;
		document.body.style.overflow = ''; document.documentElement.style.zoom = '';
		restoreLayoutModel();
		delete window.__HOROSA_ALIGN_SCALE__; delete window.__HOROSA_ALIGN_VIEWPORT_SCALE__;
		__resetScaleCacheForTest();
	});

	// rect 域里可见视口 = 800 × 500。触发器 294..330,下拉高 266:放正下 334..600 伸出 100;翻到正上 24..290 放得下。
	function openLow(){
		const target = mkEl('position:absolute;left:16px;top:294px;width:140px;height:36px;');
		const popup = mkEl('position:absolute;left:0px;top:0px;width:140px;height:266px;');
		alignElement(popup, target, { points: ['tl', 'bl'], offset: [0, 4], overflow: { adjustX: 1, adjustY: 1 } });
		const pr = popup.getBoundingClientRect(); const tr = target.getBoundingClientRect();
		popup.remove(); target.remove();
		return { popTop: pr.top, popBottom: pr.bottom, trigTop: tr.top, trigBottom: tr.bottom };
	}

	it('🔴 真钩子:下拉翻到触发器正上方,不伸出可见视口底(物理 900 ÷ 1.8 = 500)', () => {
		installAlignHooks();
		expect(window.__HOROSA_ALIGN_SCALE__()).toBe(1);                       // rect 不反映缩放 ⇒ 写回补偿自动静默
		expect(window.__HOROSA_ALIGN_VIEWPORT_SCALE__()).toBeCloseTo(1 / ZOOM, 4);
		const r = openLow();
		expect(r.popBottom).toBeLessThanOrEqual(VH / ZOOM + 1);
		expect(Math.abs(r.popBottom - (r.trigTop - 4))).toBeLessThan(2);
	});

	it('反例自证:视口系数钉成 1(旧实现)时同一几何不翻转、伸出可见视口 —— 这把尺有牙', () => {
		installAlignHooks();
		window.__HOROSA_ALIGN_VIEWPORT_SCALE__ = () => 1;
		const r = openLow();
		expect(r.popBottom).toBeGreaterThan(VH / ZOOM + 50);
	});
});

describe('T4 补丁完整性哨兵', () => {
	const fs = require('fs');
	const path = require('path');
	const root = path.resolve(__dirname, '..', '..', '..');
	const files = ['node_modules/dom-align/dist-node/index.js', 'node_modules/dom-align/dist-web/index.js'];

	it('两份产物(jest 走 dist-node / webpack 走 dist-web)都带补丁标记', () => {
		files.forEach((f) => {
			const p = path.join(root, f);
			expect(fs.existsSync(p)).toBe(true);
			expect(fs.readFileSync(p, 'utf8')).toContain(PATCH_MARK);
		});
	});

	it('🔴 防半修:两处除法在每份产物里各出现一次', () => {
		files.forEach((f) => {
			const src = fs.readFileSync(path.join(root, f), 'utf8');
			expect((src.match(/off = off \/ __hz/g) || []).length).toBe(1);
			expect((src.match(/_off = _off \/ __hz/g) || []).length).toBe(1);
			expect((src.match(/__horosaAlignScale/g) || []).length).toBeGreaterThanOrEqual(3);
		});
	});

	it('🔴 v2 防半修:祖先裁剪循环四个布局域读数都换到 rect 域(每份产物各恰 1 处)', () => {
		files.forEach((rel) => {
			const src = fs.readFileSync(path.join(root, rel), 'utf8');
			expect(src.indexOf('horosa:dom-align-zoom v3') >= 0).toBe(true);   // 标记随补丁版本走(v3 含 v2 全部锚)
			['pos.left += el.clientLeft * __hzc;', 'pos.top += el.clientTop * __hzc;', 'pos.left + el.clientWidth * __hzc);', 'pos.top + el.clientHeight * __hzc);', 'var __hzc = __horosaAlignScale(el);']
				.forEach((tok) => expect(src.split(tok).length - 1).toBe(1));
			// 未补形态不得残留(半修 = 一边乘了一边没乘,比不修更糟)
			expect(/pos\.top \+ el\.clientHeight\);/.test(src)).toBe(false);
			expect(/pos\.left \+ el\.clientWidth\);/.test(src)).toBe(false);
		});
	});

	it('🔴 v3 防半修:body overflow:hidden 分支的「文档尺寸」两条读数都过视口系数(每份产物各恰 1 处,未补形态零残留)', () => {
		files.forEach((rel) => {
			const src = fs.readFileSync(path.join(root, rel), 'utf8');
			['documentWidth = win.innerWidth * __vs;', 'documentHeight = win.innerHeight * __vs;']
				.forEach((tok) => expect(src.split(tok).length - 1).toBe(1));
			expect(/documentWidth = win\.innerWidth;/.test(src)).toBe(false);
			expect(/documentHeight = win\.innerHeight;/.test(src)).toBe(false);
			// __vs 必须先于使用处定义(P5 在同一函数里):定义在前、两处使用在后
			const def = src.indexOf('var __vs = __horosaViewportScale(win);');
			expect(def).toBeGreaterThan(0);
			expect(src.indexOf('documentHeight = win.innerHeight * __vs;')).toBeGreaterThan(def);
		});
	});

	it('dom-align 仍是 1.12.4(升级即红,强制重审补丁锚点)', () => {
		const pkg = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/dom-align/package.json'), 'utf8'));
		expect(pkg.version).toBe('1.12.4');
	});

	it('全树只有一份 dom-align(补丁覆盖面完整性前提)', () => {
		// horosa_win_shell_free_scan_v1(Windows 侧移植适配;建议上游化 Mac)
		// 原实现走 `execSync('find … -maxdepth 4 -type d -name dom-align')`。**Windows 上 `find` 是
		// 另一个命令**(cmd 内建的 find 是「在文件里搜文本」,不接受 -maxdepth/-type/-name),
		// execSync 直接抛错 ⇒ 本用例在 Windows 恒红,与被测事实无关。
		// 改为纯 Node 等价遍历:同样解引用软链、同样限深 4、同样只数目录名为 dom-align 的目录。
		let nm = path.join(root, 'node_modules');
		if(!fs.existsSync(nm)){ return; }       // 依赖未安装时不误红(装完自然覆盖)
		// 🔴 先解引用:node_modules 常被做成指向共享依赖树的软链,遍历默认**不跟随**软链
		// (fs.existsSync 却跟随)⇒ 不解引用会得 0 命中的假红。
		nm = fs.realpathSync(nm);
		const found = [];
		const walk = (dir, depth) => {
			if(depth > 4){ return; }
			let ents = [];
			try{ ents = fs.readdirSync(dir, { withFileTypes: true }); }catch(e){ return; }
			ents.forEach((ent) => {
				if(!ent.isDirectory()){ return; }
				const full = path.join(dir, ent.name);
				if(ent.name === 'dom-align'){ found.push(full); return; }
				walk(full, depth + 1);
			});
		};
		walk(nm, 1);
		expect(found.length).toBe(1);
	});

	it('antd 浮层不走 transform 路径(P4 防御性补丁的前提假设锁)', () => {
		const p = path.join(root, 'node_modules/antd/lib/_util/placements.js');
		if(!fs.existsSync(p)){ return; }
		expect(fs.readFileSync(p, 'utf8')).not.toContain('useCssTransform');
	});

	it('构建链三处挂载齐全(postinstall/build/build:file)', () => {
		const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
		['postinstall', 'build', 'build:file'].forEach((k) => {
			expect(pkg.scripts[k]).toContain('patch-dom-align-zoom');
		});
	});
});

describe('T2b 钩子安装', () => {
	it('installAlignHooks 装齐三个全局,且诊断函数可用', () => {
		installAlignHooks();
		expect(typeof window.__HOROSA_ALIGN_SCALE__).toBe('function');
		expect(typeof window.__HOROSA_ALIGN_VIEWPORT_SCALE__).toBe('function');
		expect(typeof window.__HOROSA_ALIGN_DIAG__).toBe('function');
		const d = window.__HOROSA_ALIGN_DIAG__();
		expect(d).toHaveProperty('declared');
		expect(d).toHaveProperty('effectiveScale');
		expect(d).toHaveProperty('viewportScale');
		delete window.__HOROSA_ALIGN_SCALE__;
		delete window.__HOROSA_ALIGN_VIEWPORT_SCALE__;
	});
});
