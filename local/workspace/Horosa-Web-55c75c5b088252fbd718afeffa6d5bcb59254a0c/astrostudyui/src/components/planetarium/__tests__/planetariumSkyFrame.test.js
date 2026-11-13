import {
	projectedEquatorialItem,
	precessionMatrixJ2000ToDate,
	createSkyFrame,
	buildSkyFrame,
	skySourceUnitInto,
	skyFrameDirection,
	skyFrameAltitudeDeg,
	skyFrameAzimuthDeg,
} from '../planetariumProjection';

// 天文馆播放热路径的矩阵化投影:必须与逐点公式(projectedEquatorialItem → toSkyVector)逐点等价,
// 否则暂停态(逐点)与播放态(矩阵)对不上 —— 线条 / 星点会在按下播放的那一帧挪位。
// 这里把 skyMath.toSkyVector 的式子原样抄一份(那个模块带渲染引擎依赖,测试不引)。
function slowDirection(item, jd, obs, refraction){
	const projected = projectedEquatorialItem(item, jd, obs, refraction);
	const alt = Number(projected.altitudeAppa !== undefined && projected.altitudeAppa !== null ? projected.altitudeAppa : projected.altitudeTrue) || 0;
	const az = ((Number(projected.azimuth) || 0) + 180) % 360;
	const altRad = alt * Math.PI / 180;
	const azRad = az * Math.PI / 180;
	return {
		x: Math.cos(altRad) * Math.sin(azRad),
		y: Math.sin(altRad),
		z: Math.cos(altRad) * Math.cos(azRad),
		altitudeAppa: projected.altitudeAppa,
	};
}

function fastDirection(item, jd, obs, refraction, precession){
	const frame = buildSkyFrame(createSkyFrame(), jd, obs, refraction, precession);
	const cache = new Float64Array(6);
	const kind = skySourceUnitInto(item, cache, 0);
	if(!frame.ok || !kind){
		return null;
	}
	skyFrameDirection(frame, kind, cache[3], cache[4], cache[5]);
	return { kind, x: frame.x, y: frame.y, z: frame.z };
}

const JDS = [2451545.0, 2461041.5, 2461041.5 + 0.37, 2415020.5, 2488070.25];
const OBSERVERS = [
	{ lat: 31.23, lon: 121.47 },
	{ lat: -33.87, lon: 151.21 },
	{ lat: 0, lon: 0 },
	{ lat: 78.2, lon: 15.6 },
	{ lat: 40.71, lon: -74.0 },
];

function sweepItems(){
	const items = [];
	for(let ra = 0; ra < 360; ra += 23){
		for(let decl = -85; decl <= 85; decl += 17){
			items.push({ ra, decl });
			items.push({ ra, decl, epoch: 'J2000' });
			items.push({ kind: 'catalogStar', ra, decl });
			items.push({ lon: ra, lat: decl / 10 });
		}
	}
	items.push({ ra: 0, decl: 90 });
	items.push({ ra: 0, decl: -90 });
	items.push({ lon: 123.4 });
	items.push({ raJ2000: 41.054063, declJ2000: 49.22775, ra: 41.4, decl: 49.3, epoch: 'date' });
	return items;
}

describe('planetariumProjection — 矩阵化投影与逐点公式等价', ()=>{
	[true, false].forEach((refraction)=>{
		test(`全天扫点 × 多历元 × 多观测点(折射${refraction ? '开' : '关'})`, ()=>{
			let checked = 0;
			let worst = 0;
			JDS.forEach((jd)=>{
				OBSERVERS.forEach((obs)=>{
					sweepItems().forEach((item)=>{
						const slow = slowDirection(item, jd, obs, refraction);
						const fast = fastDirection(item, jd, obs, refraction);
						expect(fast).not.toBeNull();
						const d = Math.max(Math.abs(slow.x - fast.x), Math.abs(slow.y - fast.y), Math.abs(slow.z - fast.z));
						worst = Math.max(worst, d);
						checked += 1;
					});
				});
			});
			expect(checked).toBeGreaterThan(5000);
			// 单位球上 1e-9 ≈ 0.0002 角秒;乘上天球半径也远小于一个像素。
			expect(worst).toBeLessThan(1e-9);
		});
	});

	test('传入调用方缓存的岁差矩阵(半天内复用)与现算一致到亚角秒', ()=>{
		const jd = 2461041.5;
		const cached = precessionMatrixJ2000ToDate(jd - 0.5);
		const item = { kind: 'catalogStar', ra: 101.287, decl: -16.716 };
		const obs = { lat: 31.23, lon: 121.47 };
		const a = fastDirection(item, jd, obs, true);
		const b = fastDirection(item, jd, obs, true, cached);
		expect(Math.abs(a.x - b.x)).toBeLessThan(1e-6);
		expect(Math.abs(a.y - b.y)).toBeLessThan(1e-6);
		expect(Math.abs(a.z - b.z)).toBeLessThan(1e-6);
	});

	test('归类顺序与逐点公式一致:J2000 基底优先,其次当日赤道,最后黄道;认不了的返回 0', ()=>{
		const cache = new Float64Array(6);
		expect(skySourceUnitInto({ ra: 10, decl: 20 }, cache, 0)).toBe(1);
		expect(skySourceUnitInto({ ra: 10, decl: 20, epoch: 'J2000' }, cache, 0)).toBe(2);
		expect(skySourceUnitInto({ kind: 'catalogStar', ra: 10, decl: 20 }, cache, 0)).toBe(2);
		expect(skySourceUnitInto({ raJ2000: 10, declJ2000: 20, ra: 11, decl: 21, epoch: 'date' }, cache, 0)).toBe(2);
		expect(cache[1]).toBe(10);
		expect(cache[2]).toBe(20);
		expect(skySourceUnitInto({ lon: 100, lat: 1 }, cache, 0)).toBe(3);
		expect(skySourceUnitInto({ lon: 100 }, cache, 0)).toBe(3);
		expect(skySourceUnitInto({ name: '无坐标' }, cache, 0)).toBe(0);
		expect(skySourceUnitInto(null, cache, 0)).toBe(0);
		expect(skySourceUnitInto({ ra: 'abc', decl: 1 }, cache, 0)).toBe(0);
	});

	test('坐标变了才重算单位向量;没变直接复用缓存', ()=>{
		const cache = new Float64Array(6);
		const item = { ra: 30, decl: 0 };
		skySourceUnitInto(item, cache, 0);
		expect(cache[3]).toBeCloseTo(Math.cos(Math.PI / 6), 12);
		cache[3] = 123; // 标记:同键再来不应被改写
		skySourceUnitInto(item, cache, 0);
		expect(cache[3]).toBe(123);
		item.ra = 60;
		skySourceUnitInto(item, cache, 0);
		expect(cache[3]).toBeCloseTo(0.5, 12);
	});

	test('时刻或经度不是有限数 → frame.ok = false(调用方回落逐点路径);观测点缺项按 0 处理,与逐点公式同口径', ()=>{
		expect(buildSkyFrame(createSkyFrame(), NaN, { lat: 0, lon: 0 }, true).ok).toBe(false);
		expect(buildSkyFrame(createSkyFrame(), undefined, { lat: 0, lon: 0 }, true).ok).toBe(false);
		expect(buildSkyFrame(createSkyFrame(), 2461041.5, { lat: 31, lon: 'x' }, true).ok).toBe(false);
		expect(buildSkyFrame(createSkyFrame(), 2461041.5, null, true).ok).toBe(true);
		const item = { ra: 88.79, decl: 7.41 };
		[{ lat: 31 }, {}, { lon: 121.47 }].forEach((obs)=>{
			const slow = slowDirection(item, 2461041.5, obs, true);
			const fast = fastDirection(item, 2461041.5, obs, true);
			expect(Math.abs(slow.x - fast.x)).toBeLessThan(1e-9);
			expect(Math.abs(slow.y - fast.y)).toBeLessThan(1e-9);
			expect(Math.abs(slow.z - fast.z)).toBeLessThan(1e-9);
		});
	});

	test('地平线下的点不受折射开关影响;贴地平线的点被抬高', ()=>{
		const jd = 2461041.5;
		const obs = { lat: 31.23, lon: 121.47 };
		const frameOn = buildSkyFrame(createSkyFrame(), jd, obs, true);
		const frameOff = buildSkyFrame(createSkyFrame(), jd, obs, false);
		// 直接喂场景系里的方向:m 的逆 = 转置,取一个真高度 0.3° 与一个 -20° 的方向反推赤道向量。
		const toEquatorial = (frame, x, y, z)=>{
			const m = frame.m;
			return [m[0] * x + m[3] * y + m[6] * z, m[1] * x + m[4] * y + m[7] * z, m[2] * x + m[5] * y + m[8] * z];
		};
		const dir = (altDeg)=>{
			const a = altDeg * Math.PI / 180;
			return [Math.cos(a) * 0.6, Math.sin(a), Math.cos(a) * 0.8];
		};
		const low = toEquatorial(frameOn, ...dir(0.3));
		const deep = toEquatorial(frameOn, ...dir(-20));
		const yOn = skyFrameDirection(frameOn, 1, low[0], low[1], low[2]);
		const yOff = skyFrameDirection(frameOff, 1, low[0], low[1], low[2]);
		expect(yOn).toBeGreaterThan(yOff);
		expect(Math.hypot(frameOn.x, frameOn.y, frameOn.z)).toBeCloseTo(1, 12);
		const dOn = skyFrameDirection(frameOn, 1, deep[0], deep[1], deep[2]);
		const dOff = skyFrameDirection(frameOff, 1, deep[0], deep[1], deep[2]);
		expect(dOn).toBe(dOff);
	});

	test('读数面板用的视高度 / 展示方位与逐点公式同制(方位不差 180°)', ()=>{
		let worstAlt = 0;
		let worstAz = 0;
		let checked = 0;
		[true, false].forEach((refraction)=>{
			JDS.slice(0, 3).forEach((jd)=>{
				OBSERVERS.forEach((obs)=>{
					const frame = buildSkyFrame(createSkyFrame(), jd, obs, refraction);
					const cache = new Float64Array(6);
					sweepItems().forEach((item)=>{
						const slow = projectedEquatorialItem(item, jd, obs, refraction);
						const kind = skySourceUnitInto(item, cache, 0);
						skyFrameDirection(frame, kind, cache[3], cache[4], cache[5]);
						const alt = skyFrameAltitudeDeg(frame);
						const az = skyFrameAzimuthDeg(frame);
						expect(az).toBeGreaterThanOrEqual(0);
						expect(az).toBeLessThan(360);
						worstAlt = Math.max(worstAlt, Math.abs(alt - slow.altitudeAppa));
						// 方位差按大圆弧折算(乘 cos 高度),天顶 / 天底附近方位本身不定。
						let d = Math.abs(az - slow.azimuth);
						if(d > 180){ d = 360 - d; }
						worstAz = Math.max(worstAz, d * Math.cos(alt * Math.PI / 180));
						checked += 1;
					});
				});
			});
		});
		expect(checked).toBeGreaterThan(5000);
		expect(worstAlt).toBeLessThan(1e-6);
		expect(worstAz).toBeLessThan(1e-6);
	});
});
