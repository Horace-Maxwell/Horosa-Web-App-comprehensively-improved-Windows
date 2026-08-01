// 共升星(paranatellonta)斜升法 —— 金标
// 判据全部取自球面天文的恒等式与极限情形,不依赖任何外部数值表。
import {
	obliquity, precessLon, STAR_CATALOG_EPOCH, eclLatFrom, eclToEq,
	obliqueAscension, eclipticDegreeFrames, paransForDegree, circumpolarSplit,
	angDiff, PARAN_KINDS, PARAN_ORB_DEFAULT, PARAN_NOTE,
} from '../../divination/data/egyptianParans';
import { FIXED_STARS, PRECESSION_ARCSEC_PER_YEAR } from '../../divination/data/fixedStars';

const near = (a, b, p = 6) => expect(a).toBeCloseTo(b, p);

describe('球面基元', ()=>{
	test('交角:J2000 ≈ 23.4393°，逐世纪缓减', ()=>{
		near(obliquity(2000), 23.4392911, 6);
		expect(obliquity(2100)).toBeLessThan(obliquity(2000));
		expect(obliquity(1900)).toBeGreaterThan(obliquity(2000));
	});

	test('岁差:历元处不动，每年 50.27″', ()=>{
		expect(precessLon(100, STAR_CATALOG_EPOCH)).toBeCloseTo(100, 9);
		near(precessLon(100, STAR_CATALOG_EPOCH + 3600 / PRECESSION_ARCSEC_PER_YEAR), 101, 6);
		expect(precessLon(359.9, STAR_CATALOG_EPOCH + 1000)).toBeLessThan(360);   // 恒归一化
		expect(precessLon(359.9, STAR_CATALOG_EPOCH + 1000)).toBeGreaterThanOrEqual(0);
	});

	test('angDiff 取最短弧，含 0/360 跨界', ()=>{
		expect(angDiff(1, 359)).toBe(2);
		expect(angDiff(359, 1)).toBe(-2);
		expect(angDiff(10, 10)).toBe(0);
		expect(Math.abs(angDiff(0, 180))).toBe(180);
	});

	test('黄赤互换:黄道上(β=0)的点，赤纬 = asin(sinε sinλ)', ()=>{
		const eps = obliquity(2000);
		[0, 30, 90, 150, 180, 270, 359].forEach((l)=>{
			const eq = eclToEq(l, 0, eps);
			const expected = Math.asin(Math.sin(eps * Math.PI / 180) * Math.sin(l * Math.PI / 180)) * 180 / Math.PI;
			near(eq.dec, expected, 9);
		});
		// 四正点:春分 α=0、夏至 α=90 且 δ=+ε、秋分 α=180、冬至 α=270 且 δ=−ε
		near(eclToEq(0, 0, eps).ra, 0, 9);
		near(eclToEq(90, 0, eps).ra, 90, 6);
		near(eclToEq(90, 0, eps).dec, eps, 9);
		near(eclToEq(270, 0, eps).dec, -eps, 9);
		near(eclToEq(180, 0, eps).ra, 180, 6);
	});

	test('eclLatFrom 与 eclToEq 互逆:任取 β 正推赤纬再反解，回到原 β', ()=>{
		const eps = obliquity(1995);
		[-60, -20, -5, 0, 5, 20, 60].forEach((beta)=>{
			[0, 45, 100, 200, 300].forEach((lon)=>{
				const { dec } = eclToEq(lon, beta, eps);
				const back = eclLatFrom(lon, dec, eps);
				near(back.beta, beta, 6);
				expect(back.clamped).toBe(false);
			});
		});
	});

	test('eclLatFrom:赤纬超出该黄经可达范围时钳边并标记，不产 NaN', ()=>{
		const r = eclLatFrom(0, 89.9, obliquity(2000));
		expect(r.clamped).toBe(true);
		expect(Number.isFinite(r.beta)).toBe(true);
	});
});

describe('斜升 / 斜降', ()=>{
	test('赤道上(φ=0)赤经差恒为 0：OA=OD=α（升落即赤经）', ()=>{
		[-40, -10, 0, 10, 40].forEach((dec)=>{
			const r = obliqueAscension(123, dec, 0);
			near(r.ad, 0, 9);
			near(r.oa, 123, 9);
			near(r.od, 123, 9);
			expect(r.circumpolar).toBe(false);
		});
	});

	test('赤道上的星(δ=0)在任何纬度 AD 都为 0', ()=>{
		[-60, -30, 0, 30, 60].forEach((lat)=>{
			near(obliqueAscension(200, 0, lat).ad, 0, 9);
		});
	});

	test('北半球:北赤纬星早升(OA<α)、南赤纬星晚升 —— 与古典口径一致', ()=>{
		const north = obliqueAscension(100, 20, 40);
		const south = obliqueAscension(100, -20, 40);
		expect(north.ad).toBeGreaterThan(0);
		expect(south.ad).toBeLessThan(0);
		expect(angDiff(north.oa, 100)).toBeLessThan(0);
		expect(angDiff(south.oa, 100)).toBeGreaterThan(0);
	});

	test('南半球符号整体翻转', ()=>{
		expect(obliqueAscension(100, 20, -40).ad).toBeLessThan(0);
		expect(obliqueAscension(100, -20, -40).ad).toBeGreaterThan(0);
	});

	test('拱极 / 永不升起:超界时 AD/OA/OD 为 null 并各自标记', ()=>{
		const polar = obliqueAscension(0, 80, 70);      // 同号超界 → 常显
		expect(polar.ad).toBeNull();
		expect(polar.oa).toBeNull();
		expect(polar.circumpolar).toBe(true);
		expect(polar.neverRises).toBe(false);
		const hidden = obliqueAscension(0, -80, 70);    // 异号超界 → 常隐
		expect(hidden.circumpolar).toBe(false);
		expect(hidden.neverRises).toBe(true);
	});

	test('OA/OD 关于 α 对称：(OA+OD)/2 = α', ()=>{
		const r = obliqueAscension(80, 25, 35);
		near(angDiff((r.oa + r.od) / 2, 80), 0, 9);
	});
});

describe('共升星实算', ()=>{
	const LAT = 30.05;      // 北纬约 30°(埃及一带)
	const YEAR = 2000;

	test('目标度自身的四类量自洽:黄道度用 β=0 求得', ()=>{
		const f = eclipticDegreeFrames(120, LAT, obliquity(YEAR));
		expect(Number.isFinite(f.ra)).toBe(true);
		expect(Number.isFinite(f.dec)).toBe(true);
		expect(Number.isFinite(f.oa)).toBe(true);
		near(angDiff((f.oa + f.od) / 2, f.ra), 0, 9);
	});

	test('自洽性铁证:把某颗恒星自身的黄经当目标度，该星必与之同升', ()=>{
		// 取一颗黄纬很小的星(角宿一 β≈−2°):其黄经处的黄道度与它本人斜升几乎同值
		const spica = FIXED_STARS.find((s)=>s.name_en === 'Spica');
		const lon = precessLon(spica.lon_1995, YEAR);
		const hits = paransForDegree(lon, LAT, YEAR, 3);
		const self = hits.find((h)=>h.star.name_en === 'Spica' && h.kind === 'rise');
		expect(self).toBeTruthy();
		expect(Math.abs(self.delta)).toBeLessThan(3);
	});

	test('中天判据独立于纬度(赤经相等即可)，升落判据依赖纬度', ()=>{
		const lon = 45;
		const a = paransForDegree(lon, 10, YEAR, 2).filter((h)=>h.kind === 'culminate').map((h)=>h.star.name_en);
		const b = paransForDegree(lon, 55, YEAR, 2).filter((h)=>h.kind === 'culminate').map((h)=>h.star.name_en);
		expect(a).toEqual(b);
		const r1 = paransForDegree(lon, 10, YEAR, 2).filter((h)=>h.kind === 'rise').map((h)=>h.star.name_en);
		const r2 = paransForDegree(lon, 55, YEAR, 2).filter((h)=>h.kind === 'rise').map((h)=>h.star.name_en);
		expect(JSON.stringify(r1)).not.toBe(JSON.stringify(r2));
	});

	test('结果随年代变化(岁差真的参与)', ()=>{
		const now = paransForDegree(200, LAT, 2000, 1).map((h)=>`${h.star.name_en}|${h.kind}`);
		const then = paransForDegree(200, LAT, 0, 1).map((h)=>`${h.star.name_en}|${h.kind}`);
		expect(JSON.stringify(now)).not.toBe(JSON.stringify(then));
	});

	test('容许度单调:放大 orb 只增不减命中', ()=>{
		const small = paransForDegree(150, LAT, YEAR, 0.5).length;
		const big = paransForDegree(150, LAT, YEAR, 4).length;
		expect(big).toBeGreaterThanOrEqual(small);
	});

	test('输出按 |delta| 升序，且每条 delta 都在 orb 内', ()=>{
		const hits = paransForDegree(70, LAT, YEAR, 2.5);
		for(let i = 1; i < hits.length; i++){
			expect(Math.abs(hits[i].delta)).toBeGreaterThanOrEqual(Math.abs(hits[i - 1].delta));
		}
		hits.forEach((h)=>{
			expect(Math.abs(h.delta)).toBeLessThanOrEqual(2.5);
			expect(PARAN_KINDS.map((k)=>k.key)).toContain(h.kind);
			expect(typeof h.star.name_cn).toBe('string');
		});
	});

	test('全黄道 360 度扫描:不抛、不产 NaN、每度命中数有限', ()=>{
		for(let l = 0; l < 360; l += 5){
			const hits = paransForDegree(l, LAT, YEAR, PARAN_ORB_DEFAULT);
			expect(Array.isArray(hits)).toBe(true);
			expect(hits.length).toBeLessThan(FIXED_STARS.length * 4);
			hits.forEach((h)=>expect(Number.isFinite(h.delta)).toBe(true));
		}
	});

	test('极端纬度不抛:两极与赤道都给出合法结构', ()=>{
		[-89.9, -66.6, 0, 66.6, 89.9].forEach((lat)=>{
			const hits = paransForDegree(100, lat, YEAR, 2);
			hits.forEach((h)=>expect(Number.isFinite(h.delta)).toBe(true));
			const sp = circumpolarSplit(lat, YEAR);
			expect(Array.isArray(sp.always)).toBe(true);
			expect(Array.isArray(sp.never)).toBe(true);
			// 同一颗星不可能既常显又常隐
			const both = sp.always.filter((a)=>sp.never.some((n)=>n.name_en === a.name_en));
			expect(both).toEqual([]);
		});
	});

	test('高纬度才出现拱极/常隐;赤道附近一颗都没有', ()=>{
		expect(circumpolarSplit(0, YEAR).always.length).toBe(0);
		expect(circumpolarSplit(0, YEAR).never.length).toBe(0);
		const polar = circumpolarSplit(80, YEAR);
		expect(polar.always.length + polar.never.length).toBeGreaterThan(0);
	});

	test('非法入参回空而非乱判', ()=>{
		expect(paransForDegree(NaN, 30, 2000)).toEqual([]);
		expect(paransForDegree(100, NaN, 2000)).toEqual([]);
		expect(paransForDegree(100, 30, 2000, 1, [])).toEqual([]);
		expect(paransForDegree(100, 30, 2000, 1, null)).toEqual([]);
		expect(circumpolarSplit(NaN, 2000)).toEqual({ always: [], never: [] });
	});

	test('缺坐标的表项被跳过而非产 NaN', ()=>{
		const bad = [{ name_cn: '缺', name_en: 'X' }, { name_cn: '半', name_en: 'Y', lon_1995: 10 }];
		expect(paransForDegree(10, 30, 2000, 5, bad)).toEqual([]);
	});

	test('说明文案在位，且不含章节号与「手册」字样', ()=>{
		expect(PARAN_NOTE.length).toBeGreaterThan(40);
		expect(PARAN_NOTE.indexOf('§')).toBe(-1);
		expect(PARAN_NOTE.indexOf('手册')).toBe(-1);
		PARAN_KINDS.forEach((k)=>{
			expect(k.label.length).toBeGreaterThan(0);
			expect(k.note.indexOf('§')).toBe(-1);
		});
	});
});
