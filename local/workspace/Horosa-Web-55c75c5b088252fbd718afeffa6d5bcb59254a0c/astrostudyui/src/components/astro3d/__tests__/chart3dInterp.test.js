// 3D 星盘 WS-2 金标:astronomy-engine 前端星历 vs 后端 chart3d(swisseph)双源对拍。
//
// 参考值两批,均为后端引擎冻结值(与 astropy 独立 swisseph 直算交叉核对过):
//   - T0_REF:J2000 时刻,逐字抄自 astropy/tests/test_chart3d_multicenter.py 的
//     FROZEN_LON[(JD_J2000, center)](该表容差 1e-6 被 pytest 钉死);
//   - WINDOW_REF:J2000 起 30 天窗口(3 天步),由同一 chart3d.state() 引擎生成
//     (python3 -c "chart3d.state(center, JD+k*3)" 逐点取 lon,与 T0_REF 同源同精度)。
// 阈值(计划 WS-2 精度节):绝对值 <0.5°(防大错);30 天 delta-carry 残差 <0.01°
// (播放精度 —— 两星历常差类偏在差分里结构性相消)。覆盖 helio/mars/jupiter/moon
// 四中心各 ≥2 体。
//
// ⚠️ jest 里 three 全族被 threeJestStub 顶替 —— ephemInterp 是纯数学模块
// (astronomy-engine 独立包不受映射影响),本套件直测真实现;文末哨兵钉死
// 「ephemInterp 永不 import three」,防未来把它拖进 stub 射程。
import fs from 'fs';
import path from 'path';
import { eclLonOf, eclOf, deltaCarry, vectorOf, CENTER_BODY_NAME, JD_J2000 } from '../ephemInterp';
import { norm360, shortestArcDelta } from '../morphMath';

const JD0 = 2451545.0;   // J2000.0 = 2000-01-01T12:00Z(与 pytest JD_J2000 同点)

// 角距(0..180):复用最短弧纯数学
const angDist = (a, b)=>Math.abs(shortestArcDelta(norm360(a), norm360(b)));

// J2000 后端冻结黄经(test_chart3d_multicenter.py FROZEN_LON 逐字抄录)
const T0_REF = {
	helio: { Earth: 100.368918699, Mars: 359.438875155, Jupiter: 36.288191699 },
	mars: { Earth: 147.963302121, Sun: 179.438846520, Jupiter: 48.510245761 },
	jupiter: { Earth: 205.253087394, Saturn: 56.478544702 },
	moon: { Earth: 43.323750984, Sun: 280.500212145 },
};

// J2000+3k 天(k=1..10)后端冻结黄经(chart3d.state 同引擎生成)
const WINDOW_REF = {
	helio: {
		Earth: {
			3: 103.427565397, 6: 106.486466416, 9: 109.544893511, 12: 112.602173161,
			15: 115.657862646, 18: 118.711787413, 21: 121.763926788, 24: 124.814449457,
			27: 127.86356588, 30: 130.911171433,
		},
		Mars: {
			3: 1.314577606, 6: 3.185768257, 9: 5.052071288, 12: 6.913175856,
			15: 8.76890369, 18: 10.619096485, 21: 12.463381495, 24: 14.301392134,
			27: 16.133007764, 30: 17.958100363,
		},
		Jupiter: {
			3: 36.561767732, 6: 36.835337099, 9: 37.108814577, 12: 37.38217019,
			15: 37.655496817, 18: 37.92889694, 21: 38.202247904, 24: 38.475422286,
			27: 38.748527491, 30: 39.021652239,
		},
	},
	mars: {
		Earth: {
			3: 150.290378425, 6: 152.617205258, 9: 154.943156512, 12: 157.267599405,
			15: 159.590005563, 18: 161.909920967, 21: 164.226861369, 24: 166.540567812,
			27: 168.851075265, 30: 171.158313945,
		},
		Sun: {
			3: 181.314548738, 6: 183.18573917, 9: 185.052041992, 12: 186.91314639,
			15: 188.768874118, 18: 190.61906684, 21: 192.463351757, 24: 194.301362332,
			27: 196.132977963, 30: 197.958070597,
		},
	},
	jupiter: {
		Earth: {
			3: 205.390505672, 6: 205.557823117, 9: 205.754367829, 12: 205.979401658,
			15: 206.232198009, 18: 206.51195898, 21: 206.817653032, 24: 207.148318034,
			27: 207.503289466, 30: 207.881877362,
		},
		Saturn: {
			3: 56.413704825, 6: 56.348320084, 9: 56.282312574, 12: 56.215659726,
			15: 56.148461942, 18: 56.080829292, 21: 56.012646808, 24: 55.94379497,
			27: 55.874389175, 30: 55.804526183,
		},
	},
	moon: {
		Earth: {
			3: 78.969198372, 6: 114.56659389, 9: 151.040642565, 12: 189.392829688,
			15: 230.722387625, 18: 274.997036256, 21: 319.700765608, 24: 1.582216825,
			27: 39.762889721, 30: 75.65501557,
		},
		Sun: {
			3: 283.493315349, 6: 286.464520297, 9: 289.44285499, 12: 292.457405428,
			15: 295.528487258, 18: 298.655472219, 21: 301.807357852, 24: 304.938080624,
			27: 308.017740561, 30: 311.040693402,
		},
	},
};

describe('绝对对拍(J2000,四中心 vs 后端冻结值 <0.5° 防大错)', () => {
	Object.keys(T0_REF).forEach((center)=>{
		test(`${center} 中心:全部对拍体绝对差 <0.5°`, () => {
			const bodies = Object.keys(T0_REF[center]);
			expect(bodies.length).toBeGreaterThanOrEqual(2);   // 计划要求:每中心 ≥2 体
			bodies.forEach((body)=>{
				const ae = eclLonOf(body, center, JD0);
				const d = angDist(ae, T0_REF[center][body]);
				expect(d).toBeLessThan(0.5);
				// 记录性收紧:实测双源真实吻合度在 0.02° 量级(光行差口径差),
				// 若未来漂出一个数量级 = 帧/口径接错,提前咬住
				expect(d).toBeLessThan(0.05);
			});
		});
	});
});

describe('30 天窗口 delta-carry 残差(播放精度 <0.01°)', () => {
	Object.keys(WINDOW_REF).forEach((center)=>{
		test(`${center} 中心:全部体 × 10 采样点 残差 <0.01°`, () => {
			Object.keys(WINDOW_REF[center]).forEach((body)=>{
				const lonBackend0 = T0_REF[center][body];
				const lonAe0 = eclLonOf(body, center, JD0);
				Object.keys(WINDOW_REF[center][body]).forEach((dayKey)=>{
					const day = Number(dayKey);
					const lonAeT = eclLonOf(body, center, JD0 + day);
					const carried = deltaCarry(lonBackend0, lonAe0, lonAeT);
					const resid = angDist(carried, WINDOW_REF[center][body][dayKey]);
					expect(resid).toBeLessThan(0.01);
				});
			});
		});
	});
});

describe('统一公式结构性质', () => {
	test('helio 即 center=Sun 特例:行星心看太阳 = 日心看该行星的精确镜像(差恰 180°,纬反号)', () => {
		['mars', 'jupiter'].forEach((center)=>{
			const sunFrom = eclOf('Sun', center, JD0);
			const helioOf = eclOf(CENTER_BODY_NAME[center], 'helio', JD0);
			// 同一向量取负:黄经差精确 180°、黄纬精确反号、距离相等(浮点位级)
			expect(angDist(sunFrom.lon, norm360(helioOf.lon + 180))).toBeLessThan(1e-9);
			expect(sunFrom.lat + helioOf.lat).toBeCloseTo(0, 9);
			expect(sunFrom.dist).toBeCloseTo(helioOf.dist, 12);
		});
	});
	test('月心合成(Earth+GeoMoon):月心看地球 = 地心看月球的反向量;地月距在真实范围', () => {
		const earthFromMoon = vectorOf('Earth', 'moon', JD0);
		const moonFromEarth = vectorOf('Moon', 'geo', JD0);
		expect(earthFromMoon.x).toBeCloseTo(-moonFromEarth.x, 12);
		expect(earthFromMoon.y).toBeCloseTo(-moonFromEarth.y, 12);
		expect(earthFromMoon.z).toBeCloseTo(-moonFromEarth.z, 12);
		const distAU = Math.sqrt(earthFromMoon.x ** 2 + earthFromMoon.y ** 2 + earthFromMoon.z ** 2);
		expect(distAU).toBeGreaterThan(0.0023);   // 近地点 ~0.00238 AU
		expect(distAU).toBeLessThan(0.0028);      // 远地点 ~0.00271 AU
	});
	test('deltaCarry 跨 0°/360° 归一:结果恒在 [0,360) 且差分语义精确', () => {
		expect(deltaCarry(359, 10, 12)).toBeCloseTo(1, 12);          // 359+2 → 1
		expect(deltaCarry(0.5, 350, 348)).toBeCloseTo(358.5, 12);    // 0.5−2 → 358.5
		expect(deltaCarry(180, 100, 100)).toBeCloseTo(180, 12);      // 零差分=原值
		for(let k = 0; k < 24; k += 1){
			const v = deltaCarry(k * 37.5, k * 91.25, k * 13.75 + 5);
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(360);
		}
	});
});

describe('纯模块哨兵(three 隔离)', () => {
	test('ephemInterp.js 永不 import three(jest stub 射程之外,真实现可直测)', () => {
		const src = fs.readFileSync(path.join(__dirname, '..', 'ephemInterp.js'), 'utf8');
		expect(src).not.toMatch(/from\s+['"]three['"]/);
		expect(src).not.toMatch(/require\(\s*['"]three['"]\s*\)/);
		expect(src).toMatch(/from\s+['"]astronomy-engine['"]/);
	});
	test('JD_J2000 单源常量与本套件锚点一致', () => {
		expect(JD_J2000).toBe(JD0);
	});
});
