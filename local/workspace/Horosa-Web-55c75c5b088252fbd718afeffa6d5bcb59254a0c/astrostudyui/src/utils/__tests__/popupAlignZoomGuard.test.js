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

	it('getDeclaredZoom:读 documentElement 内联 zoom,缺席回落 shellZoom', () => {
		document.documentElement.style.zoom = '1.4';
		expect(getDeclaredZoom()).toBeCloseTo(1.4, 6);
		document.documentElement.style.zoom = '';
		expect(getDeclaredZoom()).toBe(1);           // 无 query 无键 → 1
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
