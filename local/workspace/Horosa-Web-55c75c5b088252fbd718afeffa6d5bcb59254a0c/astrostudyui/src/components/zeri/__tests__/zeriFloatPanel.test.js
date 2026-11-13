import { fitFloatBox } from '../ZeriFloatPanel';

// 择日概览浮窗的默认框要夹进当前窗口:奇门速览默认 780 高,窗口 760 高时底边与缩放把手会落到窗外够不着。
describe('ZeriFloatPanel — 默认框夹进布局视口', ()=>{
	test('默认高度比窗口还高 → 压到窗口内(四周各留 12),位置跟着收回', ()=>{
		const box = fitFloatBox({ x: 110, y: 40, w: 720, h: 780 }, 380, 420, 1200, 760);
		expect(box.w).toBe(720);
		expect(box.h).toBe(736);
		expect(box.x).toBe(110);
		expect(box.y).toBe(12);
		expect(box.y + box.h).toBeLessThanOrEqual(760 - 12);
	});

	test('窗口够大 → 原样不动', ()=>{
		expect(fitFloatBox({ x: 110, y: 56, w: 680, h: 740 }, 320, 360, 1600, 1000)).toEqual({ x: 110, y: 56, w: 680, h: 740 });
	});

	test('宽度也夹:窄窗下不越出右边', ()=>{
		const box = fitFloatBox({ x: 110, y: 40, w: 720, h: 600 }, 380, 420, 700, 900);
		expect(box.w).toBe(676);
		expect(box.x).toBe(12);
		expect(box.x + box.w).toBeLessThanOrEqual(700 - 12);
	});

	test('窗口比最小尺寸还小 → 保最小尺寸、贴左上(不出负坐标)', ()=>{
		const box = fitFloatBox({ x: 110, y: 40, w: 720, h: 780 }, 380, 420, 300, 300);
		expect(box).toEqual({ x: 0, y: 0, w: 380, h: 420 });
	});

	test('视口量不到(0 / NaN / 缺省)→ 不夹,照给的尺寸来', ()=>{
		const raw = { x: 110, y: 40, w: 720, h: 780 };
		expect(fitFloatBox(raw, 380, 420, 0, 0)).toEqual(raw);
		expect(fitFloatBox(raw, 380, 420, NaN, undefined)).toEqual(raw);
	});

	test('没给框 / 缺字段 → 用最小尺寸兜底', ()=>{
		expect(fitFloatBox(null, 380, 420, 1200, 760)).toEqual({ x: 0, y: 0, w: 380, h: 420 });
		expect(fitFloatBox({ x: 50 }, 380, 420, 1200, 760)).toEqual({ x: 50, y: 0, w: 380, h: 420 });
	});
});
