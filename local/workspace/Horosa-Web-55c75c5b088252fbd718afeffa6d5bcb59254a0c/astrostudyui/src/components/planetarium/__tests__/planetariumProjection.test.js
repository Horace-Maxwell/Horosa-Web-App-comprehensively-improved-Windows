import {
	meanObliquityDeg,
	atmosphericRefractionDeg,
	eclipticToEquatorial,
	galacticToEquatorial,
	equatorialToHorizontal,
	projectedEquatorialItem,
	apparentSiderealDegrees,
	localSiderealDeg,
	hourAngleDeg,
	riseTransitSet,
	sunEclipticLongitude,
} from '../planetariumProjection';

// 天文馆投影核(v11):前端必须复刻后端 swisseph.azalt 的「视位置 + 大气折射」,
// 否则暂停态(后端投影)与播放/校准态(前端投影)对不上 -> 标签偏移 + 播放瞬跳。
// 本测试用「与历元/时间无关的天文不变量」钉死公式正确性。
const J2000 = 2451545.0;

describe('planetariumProjection — 黄赤交角(按日期,非 J2000 硬编码)', ()=>{
	test('J2000 平黄赤交角 ≈ 23.4392911°', ()=>{
		expect(meanObliquityDeg(J2000)).toBeCloseTo(23.4392911, 4);
	});
	test('交角随历元缓慢减小(1994 < J2000 之后的 2026)', ()=>{
		const jd1994 = 2449493.5;
		const jd2026 = 2461041.5;
		expect(meanObliquityDeg(jd1994)).toBeGreaterThan(meanObliquityDeg(J2000));
		expect(meanObliquityDeg(J2000)).toBeGreaterThan(meanObliquityDeg(jd2026));
	});
});

describe('planetariumProjection — 银道→赤道(IAU 1958 不变量)', ()=>{
	test('银心 (l=0,b=0) → ra≈266.4°, decl≈−28.9°', ()=>{
		const eq = galacticToEquatorial(0, 0);
		expect(eq.ra).toBeCloseTo(266.4, 1);
		expect(eq.decl).toBeCloseTo(-28.9, 1);
	});
	test('北银极 (l=0,b=90) → ra≈192.86°, decl≈27.13°', ()=>{
		const eq = galacticToEquatorial(0, 90);
		expect(eq.ra).toBeCloseTo(192.85948, 3);
		expect(eq.decl).toBeCloseTo(27.12825, 3);
	});
	test('ra 归一化到 [0,360)', ()=>{
		for(let l=0; l<360; l+=37){
			for(let b=-60; b<=60; b+=30){
				const eq = galacticToEquatorial(l, b);
				expect(eq.ra).toBeGreaterThanOrEqual(0);
				expect(eq.ra).toBeLessThan(360);
				expect(eq.decl).toBeGreaterThanOrEqual(-90);
				expect(eq.decl).toBeLessThanOrEqual(90);
			}
		}
	});
});

describe('planetariumProjection — 黄道→赤道', ()=>{
	test('春分点(0°,0°) → ra≈0, decl≈0', ()=>{
		const eq = eclipticToEquatorial(0, 0, J2000);
		expect(eq.ra).toBeCloseTo(0, 6);
		expect(eq.decl).toBeCloseTo(0, 6);
	});
	test('夏至点(90°,0°) → ra≈90, decl≈+ε(交角)', ()=>{
		const eq = eclipticToEquatorial(90, 0, J2000);
		expect(eq.ra).toBeCloseTo(90, 4);
		expect(eq.decl).toBeCloseTo(meanObliquityDeg(J2000), 4);
	});
	test('秋分点(180°,0°) → ra≈180, decl≈0', ()=>{
		const eq = eclipticToEquatorial(180, 0, J2000);
		expect(eq.ra).toBeCloseTo(180, 4);
		expect(eq.decl).toBeCloseTo(0, 6);
	});
});

describe('planetariumProjection — 大气折射(对齐 swisseph 1000mbar/20℃)', ()=>{
	test('天顶折射 ≈ 0', ()=>{
		expect(atmosphericRefractionDeg(90)).toBeLessThan(1e-3);
	});
	test('地平线折射 ≈ 0.35°~0.6°(标准 ~34′ 量级)', ()=>{
		const r = atmosphericRefractionDeg(0);
		expect(r).toBeGreaterThan(0.35);
		expect(r).toBeLessThan(0.6);
	});
	test('折射随高度单调减小', ()=>{
		expect(atmosphericRefractionDeg(5)).toBeGreaterThan(atmosphericRefractionDeg(20));
		expect(atmosphericRefractionDeg(20)).toBeGreaterThan(atmosphericRefractionDeg(45));
		expect(atmosphericRefractionDeg(45)).toBeGreaterThan(atmosphericRefractionDeg(85));
	});
	test('地平线以下不加折射(返回 0)', ()=>{
		expect(atmosphericRefractionDeg(-2)).toBe(0);
	});
});

describe('planetariumProjection — 赤道→地平(不变量)', ()=>{
	// 北天极(decl=90°)的地平高度 = 观测纬度,与 ra/时间无关 —— 经典天文不变量。
	[0, 26.0764, 36, 51.5].forEach((lat)=>{
		test(`北天极真高度 ≈ 观测纬度 ${lat}°`, ()=>{
			const pos = equatorialToHorizontal(123.4, 90, 2449493.5, { lat, lon: 116 });
			expect(pos.altitudeTrue).toBeCloseTo(lat, 5);
		});
	});
	test('地平线以上:视高度 = 真高度 + 折射(> 真高度)', ()=>{
		const pos = equatorialToHorizontal(0, 36, J2000, { lat: 36, lon: 0 });
		// 该星过中天附近(高度高),折射很小但为正
		expect(pos.altitudeAppa).toBeGreaterThan(pos.altitudeTrue);
		expect(pos.altitudeAppa - pos.altitudeTrue).toBeLessThan(0.05);
	});
	test('方位角落在 [0,360)', ()=>{
		const pos = equatorialToHorizontal(200, -10, J2000, { lat: 36, lon: 116 });
		expect(pos.azimuth).toBeGreaterThanOrEqual(0);
		expect(pos.azimuth).toBeLessThan(360);
	});
});

describe('planetariumProjection — projectedEquatorialItem', ()=>{
	test('缺 ra/decl 时按黄经 lon 推导(星宿/黄道标签路径)', ()=>{
		const item = { lon: 90, lat: 0, name: '测试宿' };
		const p = projectedEquatorialItem(item, J2000, { lat: 36, lon: 116 });
		expect(Number.isFinite(p.ra)).toBe(true);
		expect(Number.isFinite(p.decl)).toBe(true);
		// 夏至黄经 → decl 接近 +交角
		expect(p.decl).toBeCloseTo(meanObliquityDeg(J2000), 3);
	});
	test('可见性按视高度标注', ()=>{
		const below = projectedEquatorialItem({ ra: 0, decl: -90 }, J2000, { lat: 36, lon: 116 });
		expect(below.visible).toBe(false);
		expect(below.horizonState).toBe('地平线下');
		const above = projectedEquatorialItem({ ra: 123.4, decl: 90 }, J2000, { lat: 36, lon: 116 });
		expect(above.visible).toBe(true);
		expect(above.horizonState).toBe('可见');
	});
});

describe('planetariumProjection — ① 天球外观去折射开关(applyRefraction)', ()=>{
	const obs = { lat: 40, lon: 116 };
	const jd = 2461041.5;

	test('地表观测(默认 applyRefraction=true):altitudeAppa ≥ altitudeTrue(带折射)', ()=>{
		const g = equatorialToHorizontal(80, 20, jd, obs);
		expect(g.altitudeAppa).toBeGreaterThanOrEqual(g.altitudeTrue);
	});
	test('天球外观(applyRefraction=false):altitudeAppa === altitudeTrue(几何原貌、过地平线不偏转)', ()=>{
		const o = equatorialToHorizontal(80, 20, jd, obs, false);
		expect(o.altitudeAppa).toBeCloseTo(o.altitudeTrue, 10);
	});
	test('折射量:贴地平线>0、天顶≈0(关闭后归零)', ()=>{
		expect(atmosphericRefractionDeg(0)).toBeGreaterThan(0.3);
		expect(atmosphericRefractionDeg(89)).toBeCloseTo(0, 2);
	});
	test('projectedEquatorialItem 透传 applyRefraction', ()=>{
		const item = { ra: 80, decl: 20 };
		const ground = projectedEquatorialItem(item, jd, obs, true);
		const orbit = projectedEquatorialItem(item, jd, obs, false);
		expect(orbit.altitudeAppa).toBeCloseTo(orbit.altitudeTrue, 10);
		expect(ground.altitudeAppa).toBeGreaterThanOrEqual(ground.altitudeTrue);
	});
});

describe('planetariumProjection — 恒星时 / 时角 / 升中天落(B2)', ()=>{
	const jd = 2461000.3;
	test('本地恒星时 = 视恒星时 + 经度(mod 360)', ()=>{
		const lst = localSiderealDeg(jd, 120);
		const want = (((apparentSiderealDegrees(jd) + 120) % 360) + 360) % 360;
		expect(lst).toBeCloseTo(want, 9);
		expect(lst).toBeGreaterThanOrEqual(0);
		expect(lst).toBeLessThan(360);
	});
	test('时角 = LST − RA;子午线上(HA=0)对应 RA=LST,且 HA∈[0,360)', ()=>{
		const lst = localSiderealDeg(jd, 100);
		expect(hourAngleDeg(jd, 100, lst)).toBeCloseTo(0, 9);
		const ha = hourAngleDeg(jd, 100, 33);
		expect(ha).toBeGreaterThanOrEqual(0);
		expect(ha).toBeLessThan(360);
	});
	test('赤道天体(decl 0)在赤道观测者:升↔落约半个恒星日,transit 居中', ()=>{
		const r = riseTransitSet(180, 0, jd, { lat: 0, lon: 0 });
		expect(r.riseJd).toBeDefined();
		expect(r.setJd).toBeDefined();
		expect(r.setJd - r.riseJd).toBeCloseTo(2 * (90.567 / 360.98564736629), 2);
		expect(r.transitJd).toBeCloseTo((r.riseJd + r.setJd) / 2, 6);
	});
	test('高纬:恒显(circumpolar)/ 恒隐(neverRises)', ()=>{
		const up = riseTransitSet(120, 89, jd, { lat: 80, lon: 0 });
		expect(up.circumpolar).toBe(true);
		expect(up.riseJd).toBeUndefined();
		const down = riseTransitSet(120, -89, jd, { lat: 80, lon: 0 });
		expect(down.neverRises).toBe(true);
		expect(down.setJd).toBeUndefined();
	});
});

describe('planetariumProjection — 太阳黄经 / 日行迹(F2)', ()=>{
	test('J2000.0 太阳黄经 ≈ 280.4°(摩羯)', ()=>{
		expect(Math.abs(sunEclipticLongitude(2451545.0) - 280.4)).toBeLessThan(1.5);
	});
	test('2000 夏至前后 ≈ 90°', ()=>{
		expect(Math.abs(sunEclipticLongitude(2451716.6) - 90)).toBeLessThan(2);
	});
	test('始终落在 [0,360)', ()=>{
		[2451545, 2461000, 2400000, 2470000].forEach((j)=>{
			const lon = sunEclipticLongitude(j);
			expect(lon).toBeGreaterThanOrEqual(0);
			expect(lon).toBeLessThan(360);
		});
	});
});

// ── 岁差(T-203):J2000 星表 / 连线数据投影前须按当日历元岁差,否则与当日的日月行星 / 二十八宿距星同屏两套历元。
import { precessJ2000ToDate, precessionMatrixJ2000ToDate, applyPrecessionMatrixInto, isJ2000Item } from '../planetariumProjection';

describe('planetariumProjection — 岁差 J2000 → 当日(Meeus 21.b 判别向量)', ()=>{
	// Meeus《天文算法》例 21.b:θ Persei 施自行后 J2000 α=41.054063° δ=+49.227750°,岁差到 2028-11-13.19(JD 2462088.69)
	// → α=41.547214° δ=+49.348483°(书中值)。
	const JD_2028 = 2462088.69;
	test('θ Persei 例:与书中值吻合到 1e-4°', ()=>{
		const p = precessJ2000ToDate(41.054063, 49.227750, JD_2028);
		expect(p.ra).toBeCloseTo(41.547214, 3);
		expect(p.decl).toBeCloseTo(49.348483, 3);
	});
	test('J2000 时刻岁差为恒等', ()=>{
		const p = precessJ2000ToDate(201.2983, -11.1614, J2000);
		expect(p.ra).toBeCloseTo(201.2983, 6);
		expect(p.decl).toBeCloseTo(-11.1614, 6);
	});
	test('矩阵版与便捷版逐位一致;逆向(2028→J2000 反算)误差 < 1e-9°', ()=>{
		const m = precessionMatrixJ2000ToDate(JD_2028);
		const out = applyPrecessionMatrixInto(m, 41.054063, 49.227750, { ra: 0, decl: 0 });
		const p = precessJ2000ToDate(41.054063, 49.227750, JD_2028);
		expect(out.ra).toBeCloseTo(p.ra, 9);
		expect(out.decl).toBeCloseTo(p.decl, 9);
		// 矩阵正交:转置即逆
		const r = degToRadLocal(out.ra), d = degToRadLocal(out.decl);
		const x = Math.cos(d) * Math.cos(r), y = Math.cos(d) * Math.sin(r), z = Math.sin(d);
		const x0 = m[0] * x + m[3] * y + m[6] * z, y0 = m[1] * x + m[4] * y + m[7] * z, z0 = m[2] * x + m[5] * y + m[8] * z;
		expect(Math.atan2(y0, x0) * 180 / Math.PI).toBeCloseTo(41.054063, 8);
		expect(Math.asin(z0) * 180 / Math.PI).toBeCloseTo(49.227750, 8);
	});
	test('公元 1000 年角宿一(Spica)岁差量级 ≈ 14°(与全站扫描抓到的「同屏两套历元」差值同量级)', ()=>{
		const jd1000 = 2086308.0; // ≈ 1000-01-01
		const p = precessJ2000ToDate(201.2983, -11.1614, jd1000);
		const dRa = Math.abs(p.ra - 201.2983);
		expect(dRa).toBeGreaterThan(10);
		expect(dRa).toBeLessThan(16);
	});
	test('projectedEquatorialItem:J2000 项先岁差再投影,产物带 raJ2000/declJ2000 且重复投影不叠加(幂等)', ()=>{
		const jd = JD_2028;
		const obs = { lat: 39.9, lon: 116.4 };
		const item = { ra: 41.054063, decl: 49.227750, epoch: 'J2000' };
		const once = projectedEquatorialItem(item, jd, obs, false);
		expect(once.ra).toBeCloseTo(41.547214, 3);
		expect(once.raJ2000).toBeCloseTo(41.054063, 9);
		expect(once.epoch).toBe('date');
		const twice = projectedEquatorialItem(once, jd, obs, false);
		expect(twice.ra).toBeCloseTo(once.ra, 9);
		expect(twice.altitudeAppa).toBeCloseTo(once.altitudeAppa, 9);
		// 当日历元数据(无 epoch 标)不动
		const plain = projectedEquatorialItem({ ra: 41.054063, decl: 49.227750 }, jd, obs, false);
		expect(plain.ra).toBeCloseTo(41.054063, 9);
		expect(isJ2000Item({ kind: 'catalogStar' })).toBe(true);
		expect(isJ2000Item({ ra: 1, decl: 2 })).toBe(false);
	});
});
function degToRadLocal(d){ return d * Math.PI / 180; }
