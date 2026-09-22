// [十三轮] 跨链一致性判别网 —— 用户实抓「搜索对不上盘」根治的永久资产。
// 病史:前端 EoT 教科书简式(dayOfYear 粒度,±1-2 分钟误差)vs 后端 swiss 精确 EoT,
// 2026-08-31 差 89 秒 → 六壬择日行 17:14 起而后端酉界 17:15:10,pick(60s 内缩)落
// 上一时辰盘=徽章元首课/主页与概览掩目课两课并存。修=NOAA/Meeus 高精度 EoT+lon 回退
// +pick 内缩 180s。本网钉死三件:EoT 天文精度、跨链时辰界、经度回退。
import { __testing__ } from '../../../utils/baziLunarLocal';
import { computeLiurengScanPan } from '../liurengZeriScanEngine';

const GEO_FULL = { zone: '+08:00', lon: '116e28', lat: '39n54', gpsLon: 116.46, gpsLat: 39.9 };
const timeZiOf = (geo, d, t)=>{
	const pan = computeLiurengScanPan(geo, {}, d, t);
	return ((pan && pan.fourColumns && pan.fourColumns.time) || {}).ganzi || '';
};

describe('[十三轮] EoT 高精度天文锚(NOAA/Meeus;简式回潮必红)', ()=>{
	const eotMin = (dateUtcMs)=>__testing__.equationOfTime(dateUtcMs);
	const ms = (iso)=>Date.parse(iso);
	it('🔴 病灶日锚:2026-08-31 EoT∈(−75,−5)s——年历≈−22s;旧简式 +29s(=89s 界差病灶)必红。\n\t    (后端 Δ=−910 反推 −60,与 NOAA −22 的 38s 残差=后端链附加项+双端秒截断,≤40s 由 pick 180s 内缩三重盖)', ()=>{
		const v = eotMin(ms('2026-08-31T09:00:00Z')) * 60;
		expect(v).toBeGreaterThan(-75);
		expect(v).toBeLessThan(-5);
	});
	it('天文年历四极值点(±25s 带):2/11 谷、5/14 峰、7/26 谷、11/3 峰', ()=>{
		const anchors = [
			['2026-02-11T04:00:00Z', -14.23],
			['2026-05-14T04:00:00Z', 3.65],
			['2026-07-26T04:00:00Z', -6.55],
			['2026-11-03T04:00:00Z', 16.45],
		];
		anchors.forEach(([iso, minutes])=>{
			const v = eotMin(ms(iso));
			expect(Math.abs(v - minutes)).toBeLessThan(25 / 60);
		});
	});
});

describe('[十三轮] 跨链时辰界锚(判定链界=后端 swiss 界,分钟粒度)', ()=>{
	it('🔴 2026-08-31 北京申→酉界=17:15(后端真太阳 16:59:50@17:15:00 实测;修前判定链界在 17:14=用户事故)', ()=>{
		expect(timeZiOf(GEO_FULL, '2026-08-31', '17:14:00').charAt(1)).toBe('申');
		expect(timeZiOf(GEO_FULL, '2026-08-31', '17:15:00').charAt(1)).toBe('酉');
	});
	it('同日子时界(晚子时口径面不涉,验界推移一致性):23 时段时支=子', ()=>{
		expect(timeZiOf(GEO_FULL, '2026-08-31', '23:20:00').charAt(1)).toBe('子');
	});
});

describe('[十三轮] 经度回退判别(lon 缺失不再静默退化钟表口径)', ()=>{
	it('🔴 仅 gpsLon:真太阳校正必须生效(17:05=申;回退被删则退化钟表口径判酉)', ()=>{
		expect(timeZiOf({ zone: '+08:00', gpsLon: 116.46, gpsLat: 39.9 }, '2026-08-31', '17:05:00').charAt(1)).toBe('申');
	});
	it('lon 与 gpsLon 双缺:校正跳过退化钟表(告警路径;17:05=酉=钟表界)', ()=>{
		expect(timeZiOf({ zone: '+08:00' }, '2026-08-31', '17:05:00').charAt(1)).toBe('酉');
	});
});

describe('[十三轮补] 紫微跨链安全边际:后端 RealSun 已改真算式,与前端 EoT 逐项同式', ()=>{
	// 紫微后端 = TimeZiAlg.RealSun(ZiWeiController 非 DirectTime 一律 RealSun)。
	// 旧实现是 366 天查表(含两处实锤 typo,02-24 量级 / 04-10 符号,差 129-130s),本网当时只证 pick 180s 盖得住;
	// 现改为与前端 `baziLunarLocal.equationOfTime` **逐项同式**的 NOAA/Meeus 低阶式 ⇒ 跨链差是浮点级,不再需要余量证明。
	// 判别力:任一侧系数被改 / 任一侧回潮到查表,下面的对拍当场红。
	const fs = require('fs');
	const path = require('path');
	const JAVA = path.join(__dirname, '../../../../../astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/model/RealSunTimeOffset.java');
	const JS = path.join(__dirname, '../../../utils/baziLunarLocal.js');
	const COEFS = ['280.46646', '36000.76983', '0.0003032', '357.52911', '35999.05029', '0.0001537',
		'0.016708634', '0.000042037', '0.0000001267', '23.43929111', '46.8150', '0.00059', '0.001813'];
	it('🔴 两侧同式:NOAA/Meeus 十三个系数逐一在位,五项式形状一致,且都不是查表', ()=>{
		const java = fs.readFileSync(JAVA, 'utf8');
		const js = fs.readFileSync(JS, 'utf8');
		COEFS.forEach((c)=>{
			expect(java.indexOf(c)).toBeGreaterThan(-1);
			expect(js.indexOf(c)).toBeGreaterThan(-1);
		});
		// 五项式(y²sin2L0 − 2e·sinM + 4e·y²·sinM·cos2L0 − ½y⁴·sin4L0 − 1.25e²·sin2M)两侧同形
		expect(/y2 \* sin2L0 - 2(\.0)? \* e \* sinM \+ 4(\.0)? \* e \* y2 \* sinM \* cos2L0 - 0\.5 \* y2 \* y2 \* sin4L0 - 1\.25 \* e \* e \* sin2M/.test(java)).toBe(true);
		expect(/y2 \* sin2L0 - 2 \* e \* sinM \+ 4 \* e \* y2 \* sinM \* cos2L0 - 0\.5 \* y2 \* y2 \* sin4L0 - 1\.25 \* e \* e \* sin2M/.test(js)).toBe(true);
		// 回潮锁:两侧都不得再出现 366 天查表
		expect(java.indexOf('String[] days = new String[]')).toBe(-1);
		expect(java.indexOf('int[] offsets = new int[]')).toBe(-1);
	});
	it('pick 内缩仍是 3 分钟(同式后余量不再吃紧,但内缩不得被摘)', ()=>{
		const engineSrc = fs.readFileSync(path.join(__dirname, '../hourlyScanEngine.js'), 'utf8');
		expect(engineSrc.indexOf('pickInsetMs = 3 * MINUTE_MS') >= 0).toBe(true);
	});
});
