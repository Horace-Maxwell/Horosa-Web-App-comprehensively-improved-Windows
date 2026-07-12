// 页面截图守卫纯函数测试(导出附图三守卫:降倍率/WebGL 降级/墨迹;失败恒 null 不 throw)。
import { pickPixelRatio, containsWebglCanvas, screenshotCanvasHasInk, capturePageScreenshot } from '../pageScreenshot';

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
