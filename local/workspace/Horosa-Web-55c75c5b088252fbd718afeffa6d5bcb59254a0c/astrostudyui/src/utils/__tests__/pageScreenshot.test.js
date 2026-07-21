// 页面截图守卫纯函数测试(导出附图三守卫:降倍率/WebGL 降级/墨迹;失败恒 null 不 throw)。
import { pickPixelRatio, containsWebglCanvas, screenshotCanvasHasInk, capturePageScreenshot, findActiveTechniquePane, buildScreenshotFontEmbedCSS, registerWebglFrameProvider, captureWebglEngineFrame } from '../pageScreenshot';

// jsdom 无布局(offsetWidth/Height 恒 0),用 defineProperty 造尺寸模拟可见/隐藏面板。
function makeActivePane(w, h, text){
	const el = document.createElement('div');
	el.className = 'ant-tabs-tabpane-active';
	el.textContent = text || '';
	Object.defineProperty(el, 'offsetWidth', { value: w, configurable: true });
	Object.defineProperty(el, 'offsetHeight', { value: h, configurable: true });
	document.body.appendChild(el);
	return el;
}

describe('findActiveTechniquePane 选可见最大激活面板(避 0 尺寸陈旧面板 → #root 回退截到顶部导航)', ()=>{
	afterEach(()=>{ document.body.innerHTML = ''; });
	test('存在 0×0 陈旧激活面板(旧模块未卸载)时,仍选中可见大面板,不返 null 致整页回退', ()=>{
		makeActivePane(0, 0, '陈旧AI分析面板');
		const real = makeActivePane(1600, 1000, '技法三栏内容');
		expect(findActiveTechniquePane()).toBe(real);
	});
	test('多个可见激活面板取面积最大(模块外层三栏 > 嵌套子面板)', ()=>{
		const outer = makeActivePane(1655, 1081, '模块三栏');
		makeActivePane(1400, 900, '嵌套子面板');
		expect(findActiveTechniquePane()).toBe(outer);
	});
	test('全部过小 → null(交由 resolveCaptureTarget 回退 #root)', ()=>{
		makeActivePane(100, 100, '太小');
		expect(findActiveTechniquePane()).toBeNull();
	});
});

describe('pickPixelRatio 尺寸守卫(单边×倍率 ≤ 8000)', ()=>{
	test('小页 2 倍;中页 1 倍;超大页降采样仍出图', ()=>{
		expect(pickPixelRatio(1600, 1000)).toBe(2);
		expect(pickPixelRatio(6000, 1000)).toBe(1);
		const r = pickPixelRatio(20000, 1000);
		expect(r).toBeLessThan(1);
		expect(20000 * r).toBeLessThanOrEqual(8000);
		expect(r).toBeGreaterThanOrEqual(0.25);
	});
	test('退化输入返 1', ()=>{
		expect(pickPixelRatio(0, 0)).toBe(1);
		expect(pickPixelRatio(NaN, undefined)).toBe(1);
	});
});

function fakeTarget(canvases){
	return {
		querySelectorAll: ()=>canvases,
	};
}

describe('containsWebglCanvas WebGL 降级探测', ()=>{
	test('data-engine=three.js 命中', ()=>{
		const c = { getAttribute: (k)=>(k === 'data-engine' ? 'three.js r128' : ''), width: 10, height: 10, getContext: ()=>({}) };
		expect(containsWebglCanvas(fakeTarget([c]))).toBe(true);
	});
	test('已持 webgl 上下文(取 2d 返 null)命中', ()=>{
		const c = { getAttribute: ()=>'', width: 10, height: 10, getContext: (t)=>(t === '2d' ? null : {}) };
		expect(containsWebglCanvas(fakeTarget([c]))).toBe(true);
	});
	test('普通 2d canvas 不命中;零尺寸不命中', ()=>{
		const c2d = { getAttribute: ()=>'', width: 10, height: 10, getContext: (t)=>(t === '2d' ? {} : null) };
		const empty = { getAttribute: ()=>'', width: 0, height: 0, getContext: ()=>null };
		expect(containsWebglCanvas(fakeTarget([c2d, empty]))).toBe(false);
	});
	test('探测异常按最保守(true)', ()=>{
		const bad = { getAttribute: ()=>{ throw new Error('boom'); } };
		expect(containsWebglCanvas(fakeTarget([bad]))).toBe(true);
	});
	test('空目标 false', ()=>{
		expect(containsWebglCanvas(null)).toBe(false);
	});
});

describe('screenshotCanvasHasInk 墨迹守卫(阈值同 aiExport.canvasHasInk)', ()=>{
	function fakeCanvas(w, h, inkRow){
		return {
			width: w,
			height: h,
			getContext: ()=>({
				getImageData: (x, y, ww, hh)=>{
					const data = new Uint8ClampedArray(ww * hh * 4);
					data.fill(255);
					if(inkRow != null && inkRow >= y && inkRow < y + hh){
						const off = (inkRow - y) * ww * 4;
						data[off] = 0; data[off + 1] = 0; data[off + 2] = 0; data[off + 3] = 255;
					}
					return { data };
				},
			}),
		};
	}
	test('全白 false;有墨 true;异常 false 不 throw', ()=>{
		expect(screenshotCanvasHasInk(fakeCanvas(100, 200))).toBe(false);
		expect(screenshotCanvasHasInk(fakeCanvas(100, 200, 5))).toBe(true);
		expect(screenshotCanvasHasInk(null)).toBe(false);
	});
});

// ★截图符号乱码守卫(2026-07-14):星盘符号是「字母→glyph」字体,截图不嵌该字体则回退裸字母(A/B/C/D…)。
// 根因二:CSS url() 须相对**样式表**解析,相对页面会 fetch 到 SPA 兜底 index.html(200 但 HTML)→ 字体损坏。
// 名不写死(动态取 @font-face family),三锚:①URL 经 sheet.href 解析;②magic-byte 挡 HTML兜底(不把 HTML 当字体);
// ③尺寸上限挡 CJK 大字体(避 WKWebView 全量抓 hang)。反锚:改回 skipFonts / 相对页面解析 / 漏 magic·尺寸 → 立刻红。
describe('buildScreenshotFontEmbedCSS 符号字体内嵌(截图 glyph 不成裸字母)', ()=>{
	const origFetch = global.fetch;
	const origSheets = Object.getOwnPropertyDescriptor(document, 'styleSheets');
	function fakeFontSheet(href, faces){
		return {
			href,
			cssRules: faces.map(([family, srcUrl])=>({
				type: 5, // CSSRule.FONT_FACE_RULE
				style: { getPropertyValue: (p)=> p === 'font-family' ? family : (p === 'src' ? `url("${srcUrl}") format("woff2")` : '') },
			})),
		};
	}
	const WOFF2 = new Uint8Array([0x77, 0x4F, 0x46, 0x32, 1, 2, 3, 4]).buffer;   // 'wOF2' 真字体
	const HTML = new Uint8Array([0x3C, 0x21, 0x44, 0x4F, 0x43]).buffer;          // '<!DOC' SPA 兜底
	const BIG = new Uint8Array(400 * 1024).buffer;                               // 超 300KB(CJK 类)
	afterEach(()=>{
		if(origSheets){ Object.defineProperty(document, 'styleSheets', origSheets); }
		global.fetch = origFetch;
	});
	test('嵌同源小真字体 + URL 相对样式表解析 + magic 挡 HTML兜底 + 尺寸挡大字体', async ()=>{
		const sheet = fakeFontSheet('http://app/static/umi.css', [
			['glyphA', './static/glyphA.woff2'],   // 正常小真字体 → 嵌
			['glyphB', './static/glyphB.woff2'],   // 正常小真字体 → 嵌
			['brokenC', './static/brokenC.woff2'], // fetch 返 HTML(SPA 兜底)→ magic 挡
			['bigCJK', './static/cjk.woff2'],      // 超大 → 尺寸挡
		]);
		Object.defineProperty(document, 'styleSheets', { value: [sheet], configurable: true });
		const fetched = [];
		global.fetch = jest.fn(async (url)=>{
			url = String(url); fetched.push(url);
			const body = /brokenC/.test(url) ? HTML : (/cjk/.test(url) ? BIG : WOFF2);
			return { ok: true, status: 200, arrayBuffer: async ()=> body };
		});
		const css = await buildScreenshotFontEmbedCSS();
		expect(css).toMatch(/font-family:'glyphA'/);
		expect(css).toMatch(/font-family:'glyphB'/);
		expect(css).not.toMatch(/brokenC/);   // ②HTML 兜底被 magic-byte 挡(绝不把 HTML 当字体内嵌)
		expect(css).not.toMatch(/bigCJK/);    // ③大字体被尺寸上限挡
		// ①URL 相对样式表(/static/umi.css)解析:./static/glyphA.woff2 → /static/static/glyphA.woff2(非相对页面)
		expect(fetched.some((u)=> /\/static\/static\/glyphA\.woff2$/.test(u))).toBe(true);
		// base64 data URI 内联(非 URL 引用 → html-to-image 无需再抓)
		expect(css).toMatch(/src:url\(data:font\/woff2;base64,[A-Za-z0-9+/=]+\)/);
	});
});

describe('capturePageScreenshot 失败恒 null 铁律', ()=>{
	test('WebGL 目标 → degraded 标记(不 throw、不出图)', async ()=>{
		const webglCanvas = { getAttribute: ()=>'', width: 10, height: 10, getContext: (t)=>(t === '2d' ? null : {}) };
		const target = {
			querySelectorAll: ()=>[webglCanvas],
			offsetWidth: 800,
			offsetHeight: 600,
		};
		const ret = await capturePageScreenshot({ target });
		expect(ret).toMatchObject({ degraded: true, reason: 'webgl' });
	});
	test('目标过小 → null', async ()=>{
		const target = { querySelectorAll: ()=>[], offsetWidth: 40, offsetHeight: 40 };
		const ret = await capturePageScreenshot({ target });
		expect(ret).toBeNull();
	});
});

// [WP-5.4] WebGL 引擎自渲染帧通道:注册 provider 后,WebGL 页不再一刀降级——先取引擎帧。
describe('[WP-5.4] registerWebglFrameProvider 引擎帧通道', ()=>{
	const FRAME = { dataUrl: `data:image/png;base64,${'A'.repeat(2100)}`, width: 800, height: 600 };
	const webglTarget = ()=>({
		querySelectorAll: ()=>[{ getAttribute: ()=>'', width: 10, height: 10, getContext: (t)=>(t === '2d' ? null : {}) }],
		offsetWidth: 800,
		offsetHeight: 600,
	});
	test('①栈尾优先+反注册干净(僵尸 provider 不残留)', ()=>{
		const unregA = registerWebglFrameProvider(()=>({ ...FRAME, width: 1 }));
		const unregB = registerWebglFrameProvider(()=>({ ...FRAME, width: 2 }));
		expect(captureWebglEngineFrame().width).toBe(2); // 后挂载者优先
		unregB();
		expect(captureWebglEngineFrame().width).toBe(1);
		unregA();
		expect(captureWebglEngineFrame()).toBeNull();
	});
	test('②provider 抛错/短帧被守卫吞掉,不拖累其余', ()=>{
		const unregA = registerWebglFrameProvider(()=>FRAME);
		const unregB = registerWebglFrameProvider(()=>{ throw new Error('boom'); });
		const unregC = registerWebglFrameProvider(()=>({ dataUrl: 'data:,', width: 1, height: 1 }));
		expect(captureWebglEngineFrame().width).toBe(800);
		unregA(); unregB(); unregC();
	});
	test('③WebGL 页+provider 在场 → 出引擎帧(engineFrame 标记);无 provider → 原 degraded 行为', async ()=>{
		const unreg = registerWebglFrameProvider(()=>FRAME);
		const withProvider = await capturePageScreenshot({ target: webglTarget() });
		expect(withProvider).toMatchObject({ engineFrame: true, width: 800, height: 600 });
		unreg();
		const without = await capturePageScreenshot({ target: webglTarget() });
		expect(without).toMatchObject({ degraded: true, reason: 'webgl' });
	});
});
