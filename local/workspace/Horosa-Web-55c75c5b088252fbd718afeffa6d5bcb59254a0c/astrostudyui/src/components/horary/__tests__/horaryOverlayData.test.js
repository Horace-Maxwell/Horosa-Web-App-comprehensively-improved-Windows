// horaryOverlayData.test.js —— 卜卦中栏判读叠层(二期)数据构建器哨兵：
// 开关全关=null(Circle 零动作)/memo 稳引用(重绘签名短路前提)/映点公式/恒星带 lon/连线端点为盘面 chartId。
import { buildMockResult } from '../../../divination/election/__tests__/electionFixture';
import { buildHoraryOverlay, __resetHoraryOverlayMemoForTest } from '../horaryOverlayData';

beforeEach(() => { __resetHoraryOverlayMemoForTest(); });

const ALL_OFF = { overlayPerfection: false, overlayAntiscia: false, overlayTerms: false, overlayStars: false };

describe('buildHoraryOverlay', () => {
	test('开关全关 → null;空盘/坏盘 → null', () => {
		const r = buildMockResult();
		expect(buildHoraryOverlay(r, ALL_OFF)).toBeNull();
		expect(buildHoraryOverlay(null, {})).toBeNull();
		expect(buildHoraryOverlay({ err: 'x' }, {})).toBeNull();
	});

	test('缺省 extra = 四层全开;memo 同盘同设置返回同一引用', () => {
		const r = buildMockResult();
		const a = buildHoraryOverlay(r, {});
		const b = buildHoraryOverlay(r, {});
		expect(a).toBeTruthy();
		expect(b).toBe(a);                       // 稳引用 → AstroChart 签名/sCU 短路
		expect(a.terms).toBe(true);
		// 换开关 → 新对象;换回 → 因单槽 memo 已失效重算,但内容等价
		const c = buildHoraryOverlay(r, { overlayTerms: false });
		expect(c).not.toBe(a);
		expect(c.terms).toBe(false);
	});

	test('完成法连线端点是盘面 chartId(大写),via 仅传递/汇集才有', () => {
		const r = buildMockResult();
		const ov = buildHoraryOverlay(r, { overlayAntiscia: false, overlayTerms: false, overlayStars: false });
		if(ov && ov.perfection && ov.perfection.lines.length){
			ov.perfection.lines.forEach((ln) => {
				expect(ln.from && ln.from[0]).toBe(ln.from[0].toUpperCase());
				expect(ln.to && ln.to[0]).toBe(ln.to[0].toUpperCase());
				expect(['direct', 'relay', 'antiscion', 'broken']).toContain(ln.kind);
				if(ln.kind !== 'relay'){ expect(ln.via === undefined || ln.via === null).toBe(true); }
			});
		}
	});

	test('映点公式 (180−λ) mod 360 + 落宫头 ≤1° 加重标记', () => {
		const r = buildMockResult();
		const ov = buildHoraryOverlay(r, { overlayPerfection: false, overlayTerms: false, overlayStars: false });
		expect(ov && Array.isArray(ov.antiscia) && ov.antiscia.length > 0).toBe(true);
		const byId = {};
		ov.antiscia.forEach((m) => { byId[m.id] = m; });
		r.chart.objects.forEach((o) => {
			const m = byId[o.id];
			if(!m){ return; }   // 引擎星集(七政±)之外的点不入叠层
			const expect_alon = ((180 - o.lon) % 360 + 360) % 360;
			expect(Math.abs(m.alon - expect_alon)).toBeLessThan(1e-9);
			expect(typeof m.onCusp).toBe('boolean');
		});
	});

	test('恒星命中带轮缘定位 lon(引擎 starLon 纯增字段)且同星去重', () => {
		const r = buildMockResult();
		const ov = buildHoraryOverlay(r, { overlayPerfection: false, overlayAntiscia: false, overlayTerms: false });
		if(ov && ov.stars){
			const names = ov.stars.map((s) => s.name + '@' + Math.round(s.lon * 100));
			expect(new Set(names).size).toBe(names.length);
			ov.stars.forEach((s) => {
				expect(typeof s.lon).toBe('number');
				expect(s.lon).toBeGreaterThanOrEqual(0);
				expect(s.lon).toBeLessThan(360);
			});
		}
	});

	test('判读异常不拖垮盘面:畸形 chart 绝不抛,判读子层静默缺席(至多剩 terms 开关)', () => {
		const bad = { chart: { objects: null, houses: null } };
		let ov = null;
		expect(() => { ov = buildHoraryOverlay(bad, {}); }).not.toThrow();
		if(ov){
			expect(ov.perfection).toBeUndefined();
			expect(ov.antiscia).toBeUndefined();
			expect(ov.stars).toBeUndefined();
		}
	});
});
