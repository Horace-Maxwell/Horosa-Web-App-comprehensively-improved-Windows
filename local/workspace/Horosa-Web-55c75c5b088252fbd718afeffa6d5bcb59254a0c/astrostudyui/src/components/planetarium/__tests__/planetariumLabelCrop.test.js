// 天文馆名牌纹理裁剪(babylon/labelCrop.js):屏上位置 / 大小 / 像素密度不变,只少建没字的那一大片纹理。
import { labelCropRect, labelRectCovers, labelPlanePositions, isFullLabelRect } from '../babylon/labelCrop';

const TEX_W = 1024;
const TEX_H = 512;
const isPow2 = (n)=>n > 0 && (n & (n - 1)) === 0;

describe('天文馆名牌纹理裁剪', ()=>{
	const metrics = { width: 192, asc: 84, desc: 12, left: 0, right: 190 };
	const base = { texW: TEX_W, texH: TEX_H, tx: 416, ty: 312, lineWidth: 9 };

	test('裁剪块盖住墨迹外框,尺寸是 2 的幂,原点对齐 16 像素,落在整幅之内', ()=>{
		const out = labelCropRect({ ...base, metrics });
		expect(out).not.toBeNull();
		const { rect, need } = out;
		expect(isPow2(rect.w)).toBe(true);
		expect(isPow2(rect.h)).toBe(true);
		expect(rect.x % 16).toBe(0);
		expect(rect.y % 16).toBe(0);
		expect(rect.x).toBeGreaterThanOrEqual(0);
		expect(rect.y).toBeGreaterThanOrEqual(0);
		expect(rect.x + rect.w).toBeLessThanOrEqual(TEX_W);
		expect(rect.y + rect.h).toBeLessThanOrEqual(TEX_H);
		expect(labelRectCovers(rect, need, TEX_W, TEX_H)).toBe(true);
		// 比整幅小得多才有意义
		expect(rect.w * rect.h).toBeLessThan(TEX_W * TEX_H / 2);
	});

	test('量不到墨迹外框就返回 null,由调用方走整幅', ()=>{
		expect(labelCropRect({ ...base, metrics: { width: 192 } })).toBeNull();
		expect(labelCropRect({ ...base, metrics: null })).toBeNull();
		expect(labelCropRect({ ...base, texW: 0, metrics })).toBeNull();
	});

	test('字宽到占满整幅时退回整幅', ()=>{
		const wide = { width: 990, asc: 84, desc: 12, left: 0, right: 990 };
		const { rect } = labelCropRect({ ...base, tx: 16, metrics: wide });
		expect(rect.x).toBe(0);
		expect(rect.w).toBe(TEX_W);
	});

	test('贴着右 / 下边的字:裁剪块往回收,不伸出整幅', ()=>{
		const { rect, need } = labelCropRect({ ...base, tx: 820, ty: 490, metrics });
		expect(rect.x + rect.w).toBeLessThanOrEqual(TEX_W);
		expect(rect.y + rect.h).toBeLessThanOrEqual(TEX_H);
		expect(labelRectCovers(rect, need, TEX_W, TEX_H)).toBe(true);
	});

	test('换成更宽的字后旧裁剪块盖不住 → 判定要换纹理', ()=>{
		const first = labelCropRect({ ...base, metrics });
		const wider = labelCropRect({ ...base, metrics: { ...metrics, width: 520, right: 518 } });
		expect(labelRectCovers(first.rect, wider.need, TEX_W, TEX_H)).toBe(false);
		expect(labelRectCovers(wider.rect, wider.need, TEX_W, TEX_H)).toBe(true);
		expect(labelRectCovers(null, wider.need, TEX_W, TEX_H)).toBe(false);
	});

	test('整幅裁剪块 → 牌面顶点与原牌面逐一相同', ()=>{
		const planeW = 58;
		const planeH = 29;
		const basePositions = [-29, -14.5, 0, 29, -14.5, 0, 29, 14.5, 0, -29, 14.5, 0];
		const full = { x: 0, y: 0, w: TEX_W, h: TEX_H };
		expect(isFullLabelRect(full, TEX_W, TEX_H)).toBe(true);
		const out = labelPlanePositions(basePositions, full, TEX_W, TEX_H, planeW, planeH);
		out.forEach((v, i)=>expect(v).toBeCloseTo(basePositions[i], 9));
	});

	test('裁剪块 → 牌面取原牌面里同一块子矩形(每个纹理像素在牌面上的大小不变)', ()=>{
		const planeW = 58;
		const planeH = 29;
		const basePositions = [-29, -14.5, 0, 29, -14.5, 0, 29, 14.5, 0, -29, 14.5, 0];
		const rect = { x: 400, y: 192, w: 256, h: 128 };
		expect(isFullLabelRect(rect, TEX_W, TEX_H)).toBe(false);
		const out = labelPlanePositions(basePositions, rect, TEX_W, TEX_H, planeW, planeH);
		const xs = [out[0], out[3], out[6], out[9]];
		const ys = [out[1], out[4], out[7], out[10]];
		const w = Math.max(...xs) - Math.min(...xs);
		const h = Math.max(...ys) - Math.min(...ys);
		expect(w / rect.w).toBeCloseTo(planeW / TEX_W, 9);
		expect(h / rect.h).toBeCloseTo(planeH / TEX_H, 9);
		// 左缘 = 原牌面里纹理第 400 列所在处;上缘 = 第 192 行所在处(画布 y 向下、牌面 y 向上)
		expect(Math.min(...xs)).toBeCloseTo((400 / TEX_W - 0.5) * planeW, 9);
		expect(Math.max(...ys)).toBeCloseTo((0.5 - 192 / TEX_H) * planeH, 9);
		// 顶点顺序不变:左下、右下、右上、左上
		expect(out[0]).toBeLessThan(out[3]);
		expect(out[1]).toBeLessThan(out[7]);
	});
});
