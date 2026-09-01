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

describe('[十三轮补] 紫微跨链安全边际:RealSun 表档全年最坏差 < pick 内缩(机械证明骑线被盖)', ()=>{
	// 紫微后端=TimeZiAlg.RealSun 查表档(ZiWeiController 非 DirectTime 一律 RealSun;与六壬走
	// swiss 不同支)。表数据从 Java 源实读(搬运保真同 py 镜像先例);含两处实锤 typo
	// (02-24 量级/04-10 符号,差 129-130s)——修表=改用户所见须拍板,本网只证 pick 180s 盖得住。
	const fs = require('fs');
	const path = require('path');
	const JAVA = path.join(__dirname, '../../../../../astrostudysrv/astrostudy/src/main/java/spacex/astrostudy/model/RealSunTimeOffset.java');
	it('🔴 全年 |表−NOAA| 最坏差 ≤ 150s,且 < hourlyScanEngine pick 内缩 180s(内缩被调小或表被改坏必红)', ()=>{
		const src = fs.readFileSync(JAVA, 'utf8');
		const days = src.match(/String\[\] days = new String\[\] \{([\s\S]*?)\};/)[1].match(/"(\d{2}-\d{2})"/g).map((s)=>s.slice(1, -1));
		const offs = src.match(/int\[\] offsets = new int\[\] \{([\s\S]*?)\};/)[1].split(',').map((s)=>s.trim()).filter(Boolean).map((e)=>{
			const m = e.match(/^(-?\d+)\*60([+-]\d+)$/);
			return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
		});
		expect(days.length).toBe(366);
		expect(offs.length).toBe(366);
		expect(offs.filter(Number.isNaN)).toEqual([]);
		const { equationOfTime } = require('../../../utils/baziLunarLocal').__testing__;
		let worst = 0;
		days.forEach((md, i)=>{
			if(md === '02-29'){ return; }
			const d = Math.abs(offs[i] - equationOfTime(Date.parse(`2026-${md}T04:00:00Z`)) * 60);
			if(d > worst){ worst = d; }
		});
		expect(worst).toBeLessThanOrEqual(150);
		const engineSrc = fs.readFileSync(path.join(__dirname, '../hourlyScanEngine.js'), 'utf8');
		expect(engineSrc.indexOf('pickInsetMs = 3 * MINUTE_MS') >= 0).toBe(true);
		expect(worst).toBeLessThan(180);
	});
});
