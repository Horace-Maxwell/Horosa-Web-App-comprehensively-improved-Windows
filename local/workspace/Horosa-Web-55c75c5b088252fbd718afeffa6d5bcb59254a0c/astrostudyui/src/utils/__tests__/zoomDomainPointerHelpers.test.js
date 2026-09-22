// 手写浮层 / 自绘画布的「指针坐标换域」单源(zoomDomain.fixedPopupFrame / pointerToLocal / pointerLocalRatio)。
//
// 这一族的通病:锚点取 rect / clientX(视觉域),视口取 window.innerWidth(物理域),浮层宽高与本地坐标是 CSS 尺寸(布局域),
// 三个域混着比,再把结果当 CSS px 写回 —— 缩放档下浮层离锚点、点位离鼠标差 z 倍。z=1 时三域重合,所以只在缩放档现形。
// 判别向量:同一组输入在 z=1.8(rect 反映缩放的引擎)与 z=1 下,换域后的落点必须指向同一个视觉位置。
import {
	fixedPopupFrame, pointerToLocal, pointerLocalRatio, clientToFixedPx, __resetScaleCacheForTest,
	installSvgCtmShim, getSvgCtmScale, getViewportScale, installOffsetXYShim, getOffsetDomainScale,
} from '../zoomDomain';

const realGBCR = HTMLElement.prototype.getBoundingClientRect;
let Z = 1;

// 「rect 反映缩放」引擎模型:任何内联 left/top/width/height 的元素,rect = 布局值 × Z(jsdom 自身不布局,够探针用)。
function installEngine(z){
	Z = z;
	HTMLElement.prototype.getBoundingClientRect = function(){
		const st = this.style || {};
		const px = (v) => (parseFloat(v) || 0) * Z;
		const left = px(st.left), top = px(st.top), width = px(st.width), height = px(st.height);
		return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top };
	};
	document.documentElement.style.zoom = z === 1 ? '' : String(z);
	__resetScaleCacheForTest();
}

afterEach(() => {
	HTMLElement.prototype.getBoundingClientRect = realGBCR;
	document.documentElement.style.zoom = '';
	__resetScaleCacheForTest();
});

describe('fixedPopupFrame · 手写 fixed 浮层同域工作台', () => {
	it('z=1:逐项恒等(零回归的前提)', () => {
		installEngine(1);
		const f = fixedPopupFrame();
		expect(f.scale).toBe(1);
		expect(f.toFixed(417)).toBe(417);
		expect(f.rect({ left: 10, right: 110, top: 20, bottom: 70, width: 100, height: 50 }))
			.toEqual({ left: 10, right: 110, top: 20, bottom: 70, width: 100, height: 50 });
	});

	it('🔴 z=1.8:锚点换到布局域后,写回的 left 渲染出来正好贴在锚点右侧(视觉位置不漂)', () => {
		installEngine(1.8);
		const f = fixedPopupFrame();
		expect(f.scale).toBeCloseTo(1.8, 5);
		// 锚点右缘在视觉 900px 处;浮层放其右 12 CSS px。
		const anchor = f.rect({ left: 720, right: 900, top: 360, bottom: 396, width: 180, height: 36 });
		const leftCss = anchor.right + 12;
		// 引擎把 style.left 渲染到 leftCss × z:必须 = 900 + 12×1.8(12 是 CSS 间距,视觉上也被放大)
		expect(leftCss * 1.8).toBeCloseTo(900 + 12 * 1.8, 5);
		// 反例(旧写法):直接把 rect.right + 12 当 CSS px → 渲染在 (900+12)×1.8 = 1641.6,离锚点 729 视觉像素
		expect((900 + 12) * 1.8 - 900).toBeGreaterThan(700);
	});

	it('布局视口量不到时回落物理读数,且永不给 0 宽当真值参与夹取', () => {
		installEngine(1);
		const f = fixedPopupFrame();
		expect(f.viewportWidth).toBeGreaterThan(0);
		expect(f.viewportHeight).toBeGreaterThan(0);
	});
});

describe('pointerToLocal · 指针 → 元素本地坐标(不问缩放值)', () => {
	function fakeEl(layoutW, layoutH, rect){
		return { offsetWidth: layoutW, offsetHeight: layoutH, clientWidth: layoutW, clientHeight: layoutH, getBoundingClientRect: () => rect };
	}

	it('🔴 rect 反映缩放的引擎(1.8 档):视觉位移折回布局域', () => {
		const el = fakeEl(300, 200, { left: 90, top: 50, width: 540, height: 360 });
		const p = pointerToLocal({ clientX: 90 + 270, clientY: 50 + 180 }, el);
		expect(p.x).toBeCloseTo(150, 5);   // 画布正中
		expect(p.y).toBeCloseTo(100, 5);
		expect(p.kx).toBeCloseTo(1 / 1.8, 5);
	});

	it('rect 不反映缩放的引擎:比值恒 1,原值不动(不需要认引擎)', () => {
		const el = fakeEl(300, 200, { left: 90, top: 50, width: 300, height: 200 });
		const p = pointerToLocal({ clientX: 240, clientY: 150 }, el);
		expect(p).toMatchObject({ x: 150, y: 100, kx: 1, ky: 1 });
	});

	it('元素带 CSS 缩放变换(rect 被放大 2 倍)同样成立', () => {
		const el = fakeEl(100, 100, { left: 0, top: 0, width: 200, height: 200 });
		expect(pointerToLocal({ clientX: 100, clientY: 50 }, el)).toMatchObject({ x: 50, y: 25 });
	});

	it('<svg> 根(无 offsetWidth、rect 可能含溢出内容)→ 比值取最近的 HTML 祖先,不被虚宽带偏', () => {
		const parent = fakeEl(400, 200, { left: 0, top: 0, width: 720, height: 360 });
		const svg = { offsetWidth: undefined, offsetHeight: undefined, clientWidth: 400, clientHeight: 200, parentElement: parent, getBoundingClientRect: () => ({ left: -30, top: 0, width: 810, height: 360 }) };
		const k = pointerLocalRatio(svg);
		expect(k.kx).toBeCloseTo(1 / 1.8, 5);
		expect(k.ky).toBeCloseTo(1 / 1.8, 5);
	});

	it('100% 档逐值恒等:布局宽取整、rect 宽带小数时比值吸附到 1(不让 0.999 悄悄乘进坐标);真实缩放档不受吸附影响', () => {
		const el = fakeEl(333, 187, { left: 10, top: 20, width: 333.34, height: 187.49 });
		expect(pointerToLocal({ clientX: 110, clientY: 70 }, el)).toMatchObject({ x: 100, y: 50, kx: 1, ky: 1 });
		const zoomed = fakeEl(333, 187, { left: 0, top: 0, width: 333.34 * 1.1, height: 187.49 * 1.1 });   // 最小档距 10%
		expect(pointerLocalRatio(zoomed).kx).toBeCloseTo(333 / (333.34 * 1.1), 6);
		expect(pointerLocalRatio(zoomed).kx).not.toBe(1);
	});

	it('量不到布局盒(svg 内部节点 / 未布局)→ 回落实测缩放的倒数,绝不产 NaN / Infinity', () => {
		installEngine(1.8);
		const r = pointerLocalRatio({ offsetWidth: 0, offsetHeight: 0, clientWidth: 0, clientHeight: 0 }, { left: 0, top: 0, width: 0, height: 0 });
		expect(r.kx).toBeCloseTo(1 / 1.8, 5);
		expect(r.ky).toBeCloseTo(1 / 1.8, 5);
		expect(Number.isFinite(r.kx) && Number.isFinite(r.ky)).toBe(true);
	});

	it('clientToFixedPx 与 pointerLocalRatio 在同一引擎下互为一致(同一个 1/z)', () => {
		expect(clientToFixedPx(540, 1.8)).toBeCloseTo(300, 5);
	});
});

// ── SVG getScreenCTM 缩放一致性垫片 ───────────────────────────────────────────
// 引擎模型:矩阵停在布局域(不反映 CSS zoom),rect / clientX 在视觉域 —— 真 WebKit 实测形态(1.8 档:盘面正中点逆变换落到 viewBox 外)。
class M {
	constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0){ Object.assign(this, { a, b, c, d, e, f }); }
	multiply(n){ return new M(this.a * n.a + this.c * n.b, this.b * n.a + this.d * n.b, this.a * n.c + this.c * n.d, this.b * n.c + this.d * n.d, this.a * n.e + this.c * n.f + this.e, this.b * n.e + this.d * n.f + this.f); }
	scale(k){ return this.multiply(new M(k, 0, 0, k, 0, 0)); }
	inverse(){ const det = this.a * this.d - this.b * this.c; return new M(this.d / det, -this.b / det, -this.c / det, this.a / det, (this.c * this.f - this.d * this.e) / det, (this.b * this.e - this.a * this.f) / det); }
	apply(x, y){ return { x: this.a * x + this.c * y + this.e, y: this.b * x + this.d * y + this.f }; }
}

describe('installSvgCtmShim · getScreenCTM 与 clientX 同域', () => {
	const proto = window.SVGGraphicsElement ? window.SVGGraphicsElement.prototype : null;
	let savedCtm; let savedCreate; let savedRect;
	let engineReflectsZoom = false;

	beforeEach(() => {
		if(!proto){ return; }
		savedCtm = proto.getScreenCTM; savedCreate = SVGSVGElement.prototype.createSVGMatrix; savedRect = SVGElement.prototype.getBoundingClientRect;
		delete proto.__horosaCtmShim;
		// 被测盘面:viewBox 1000×500 渲染成 400×200、摆在 (100,80) —— 布局域矩阵 [0.4,0,0,0.4,100,80];探针 rect 恒为单位矩阵。
		proto.getScreenCTM = function(){
			const probe = this.tagName === 'rect' && this.getAttribute('width') === '100';
			const base = probe ? new M() : new M(0.4, 0, 0, 0.4, 100, 80);
			return engineReflectsZoom ? new M(Z, 0, 0, Z, 0, 0).multiply(base) : base;
		};
		SVGSVGElement.prototype.createSVGMatrix = () => new M();
		SVGElement.prototype.getBoundingClientRect = function(){ const w = (parseFloat(this.getAttribute('width')) || 0) * Z; return { left: 0, top: 0, width: w, height: w, right: w, bottom: w }; };
	});
	afterEach(() => {
		if(!proto){ return; }
		proto.getScreenCTM = savedCtm; SVGSVGElement.prototype.createSVGMatrix = savedCreate; SVGElement.prototype.getBoundingClientRect = savedRect;
		delete proto.__horosaCtmShim;
		engineReflectsZoom = false;
	});

	const mk = () => { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); document.body.appendChild(svg); return svg; };

	it('🔴 矩阵不反映缩放的引擎(1.8 档):垫片后,视觉域正中点逆变换回到 viewBox 正中', () => {
		if(!proto){ return; }
		installEngine(1.8);
		expect(installSvgCtmShim()).toBe(true);
		expect(getSvgCtmScale()).toBeCloseTo(1.8, 5);
		const svg = mk();
		// 视觉域里盘面 = (180,144) 720×360 ⇒ 正中 (540,324)
		const p = svg.getScreenCTM().inverse().apply(540, 324);
		expect(p.x).toBeCloseTo(500, 4);
		expect(p.y).toBeCloseTo(250, 4);
		svg.remove();
	});

	it('反例自证:不装垫片,同一点被映到 viewBox 之外(这把尺有牙)', () => {
		if(!proto){ return; }
		installEngine(1.8);
		const svg = mk();
		const p = svg.getScreenCTM().inverse().apply(540, 324);
		expect(p.x).toBeCloseTo(1100, 4);   // viewBox 宽只有 1000
		svg.remove();
	});

	it('矩阵本来就反映缩放的引擎:实测比值 = 1,垫片等于没装(不认引擎只认实测)', () => {
		if(!proto){ return; }
		engineReflectsZoom = true;
		installEngine(1.8);
		installSvgCtmShim();
		expect(getSvgCtmScale()).toBe(1);
		const svg = mk();
		const p = svg.getScreenCTM().inverse().apply(540, 324);
		expect(p.x).toBeCloseTo(500, 4);
		svg.remove();
	});

	it('100% 档:不量、不建 DOM,原矩阵原样返回', () => {
		if(!proto){ return; }
		installEngine(1);
		installSvgCtmShim();
		const svg = mk();
		const m = svg.getScreenCTM();
		expect([m.a, m.d, m.e, m.f]).toEqual([0.4, 0.4, 100, 80]);
		svg.remove();
	});

	it('回退阀:horosa.compat.svgCtmZoom=0 时恒等', () => {
		if(!proto){ return; }
		installEngine(1.8);
		window.localStorage.setItem('horosa.compat.svgCtmZoom', '0');
		try{ installSvgCtmShim(); expect(getSvgCtmScale()).toBe(1); }
		finally{ window.localStorage.removeItem('horosa.compat.svgCtmZoom'); }
	});
});

// ── 对齐库「可见视口」系数:直接量,不靠 rect 缩放推断 ─────────────────────────────
// 物理视口 1728 宽。rect 反映缩放的引擎:铺满元素的 rect 宽 = 1728 → 系数 1;rect 不反映缩放的引擎(较旧的 macOS WebKit):rect 宽 = 1728 ÷ z。
describe('getViewportScale · 对齐库可见视口换到 rect 域', () => {
	let savedCW;
	const setEngine = (z, rectReflectsZoom) => {
		HTMLElement.prototype.getBoundingClientRect = function(){
			const st = this.style || {};
			if(st.position === 'fixed' && st.right === '0px'){ const w = rectReflectsZoom ? 1728 : 1728 / z; return { left: 0, top: 0, width: w, height: w * 0.58, right: w, bottom: w * 0.58 }; }
			const px = (v) => (parseFloat(v) || 0) * (rectReflectsZoom ? z : 1);
			const width = px(st.width);
			return { left: px(st.left), top: 0, width, height: 0, right: px(st.left) + width, bottom: 0 };
		};
		document.documentElement.style.zoom = z === 1 ? '' : String(z);
		__resetScaleCacheForTest();
	};
	beforeEach(() => {
		savedCW = Object.getOwnPropertyDescriptor(document.documentElement, 'clientWidth');
		Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => 1728 });
	});
	afterEach(() => {
		if(savedCW){ Object.defineProperty(document.documentElement, 'clientWidth', savedCW); }else{ delete document.documentElement.clientWidth; }
	});

	it('rect 反映缩放的引擎:系数恒 1(对齐库读数一字不变)', () => {
		setEngine(1.8, true);
		expect(getViewportScale()).toBe(1);
	});

	it('🔴 rect 不反映缩放的引擎 · 放大档:系数 = 1/z(此前恒 1 → 靠下的下拉不翻转、伸出窗口底边)', () => {
		setEngine(1.8, false);
		expect(getViewportScale()).toBeCloseTo(1 / 1.8, 4);
	});

	it('rect 不反映缩放的引擎 · 缩小档:系数 = 1/z(此前恒 1 → 明明放得下却被提前翻转 / 夹紧)', () => {
		setEngine(0.8, false);
		expect(getViewportScale()).toBeCloseTo(1.25, 4);
	});

	it('100% 档:不量、不建 DOM,恒 1', () => {
		setEngine(1, false);
		expect(getViewportScale()).toBe(1);
	});
});

// ── MouseEvent.offsetX / offsetY 垫片 ─────────────────────────────────────────
// 引擎模型:offsetX/Y 报视觉域(= clientX − 目标 rect.left,未折回布局域)—— 系统浏览器内核在 CSS zoom 下的实测形态。
describe('installOffsetXYShim · offsetX/Y 回到规范说的 CSS 本地坐标', () => {
	const proto = MouseEvent.prototype;
	let savedX; let savedY; let reflectsZoom = true;
	beforeEach(() => {
		savedX = Object.getOwnPropertyDescriptor(proto, 'offsetX'); savedY = Object.getOwnPropertyDescriptor(proto, 'offsetY');
		delete proto.__horosaOffsetShim;
		// 被模拟的引擎 getter:视觉域读数(reflectsZoom=false 时模拟「内核已按规范报布局域」)
		Object.defineProperty(proto, 'offsetX', { configurable: true, enumerable: true, get(){ return reflectsZoom ? this.clientX : this.clientX / Z; } });
		Object.defineProperty(proto, 'offsetY', { configurable: true, enumerable: true, get(){ return reflectsZoom ? this.clientY : this.clientY / Z; } });
	});
	afterEach(() => {
		if(savedX){ Object.defineProperty(proto, 'offsetX', savedX); } else { delete proto.offsetX; }
		if(savedY){ Object.defineProperty(proto, 'offsetY', savedY); } else { delete proto.offsetY; }
		delete proto.__horosaOffsetShim;
		reflectsZoom = true;
	});

	it('🔴 1.8 档:400×200 盒子正中(视觉 360,180)读回 (200,100)', () => {
		installEngine(1.8);
		expect(installOffsetXYShim()).toBe(true);
		expect(getOffsetDomainScale()).toBeCloseTo(1.8, 5);
		const ev = new MouseEvent('mousemove', { clientX: 360, clientY: 180 });
		expect(ev.offsetX).toBeCloseTo(200, 4);
		expect(ev.offsetY).toBeCloseTo(100, 4);
	});

	it('内核本来就按规范报布局域:实测比值 = 1,读数原样(不认引擎只认实测)', () => {
		reflectsZoom = false;
		installEngine(1.8);
		installOffsetXYShim();
		expect(getOffsetDomainScale()).toBe(1);
		const ev = new MouseEvent('mousemove', { clientX: 360, clientY: 180 });
		expect(ev.offsetX).toBeCloseTo(200, 4);
	});

	it('100% 档:走原 getter,不量、不建 DOM', () => {
		installEngine(1);
		installOffsetXYShim();
		const ev = new MouseEvent('mousemove', { clientX: 123, clientY: 45 });
		expect(ev.offsetX).toBe(123);
		expect(getOffsetDomainScale()).toBe(1);
	});

	it('探针事件用自定义事件名,不惊动业务监听', () => {
		installEngine(1.8);
		installOffsetXYShim();
		let seen = 0;
		const h = () => { seen += 1; };
		['mousemove', 'mousedown', 'click'].forEach((t) => window.addEventListener(t, h, true));
		getOffsetDomainScale();
		['mousemove', 'mousedown', 'click'].forEach((t) => window.removeEventListener(t, h, true));
		expect(seen).toBe(0);
	});

	it('回退阀:horosa.compat.offsetXYZoom=0 时恒等', () => {
		installEngine(1.8);
		installOffsetXYShim();
		window.localStorage.setItem('horosa.compat.offsetXYZoom', '0');
		try{ expect(new MouseEvent('mousemove', { clientX: 360 }).offsetX).toBe(360); }
		finally{ window.localStorage.removeItem('horosa.compat.offsetXYZoom'); }
	});
});

describe('量测探针的拆除 · 中途抛错也不留在 body 里', () => {
	const probes = () => Array.from(document.body.children).filter((n) => n.getAttribute && n.getAttribute('aria-hidden') === 'true');

	it('🔴 getViewportScale:rect 读数抛错 → 探针已拆、回落 1', () => {
		const savedCW = Object.getOwnPropertyDescriptor(document.documentElement, 'clientWidth');
		Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => 1728 });
		try{
			document.documentElement.style.zoom = '1.8';
			__resetScaleCacheForTest();
			HTMLElement.prototype.getBoundingClientRect = function(){ throw new Error('boom'); };
			const before = probes().length;
			expect(getViewportScale()).toBe(1);
			expect(probes().length).toBe(before);
		}finally{
			if(savedCW){ Object.defineProperty(document.documentElement, 'clientWidth', savedCW); }else{ delete document.documentElement.clientWidth; }
		}
	});

	it('🔴 getSvgCtmScale:矩阵读数抛错 → 探针已拆、回落 1', () => {
		const proto = window.SVGGraphicsElement ? window.SVGGraphicsElement.prototype : null;
		if(!proto){ return; }
		const saved = proto.getScreenCTM; const savedRect = SVGElement.prototype.getBoundingClientRect;
		delete proto.__horosaCtmShim;
		// 两个读数都炸:模块里可能还留着前面用例装垫片时抓到的原始矩阵读法,只炸矩阵那一只会被它绕过去(这条用例就没牙)。
		proto.getScreenCTM = function(){ throw new Error('boom'); };
		SVGElement.prototype.getBoundingClientRect = function(){ throw new Error('boom'); };
		try{
			installEngine(1.8);
			const before = probes().length;
			expect(getSvgCtmScale()).toBe(1);
			expect(probes().length).toBe(before);
		}finally{
			proto.getScreenCTM = saved; SVGElement.prototype.getBoundingClientRect = savedRect;
			delete proto.__horosaCtmShim;
		}
	});

	it('🔴 getOffsetDomainScale:探针事件读数抛错 → 探针已拆、回落 1', () => {
		const proto = MouseEvent.prototype;
		const sx = Object.getOwnPropertyDescriptor(proto, 'offsetX'); const sy = Object.getOwnPropertyDescriptor(proto, 'offsetY');
		delete proto.__horosaOffsetShim;
		Object.defineProperty(proto, 'offsetX', { configurable: true, enumerable: true, get(){ throw new Error('boom'); } });
		Object.defineProperty(proto, 'offsetY', { configurable: true, enumerable: true, get(){ return 0; } });
		try{
			expect(installOffsetXYShim()).toBe(true);
			installEngine(1.8);
			const before = probes().length;
			expect(getOffsetDomainScale()).toBe(1);
			expect(probes().length).toBe(before);
		}finally{
			if(sx){ Object.defineProperty(proto, 'offsetX', sx); } else { delete proto.offsetX; }
			if(sy){ Object.defineProperty(proto, 'offsetY', sy); } else { delete proto.offsetY; }
			delete proto.__horosaOffsetShim;
		}
	});
});
