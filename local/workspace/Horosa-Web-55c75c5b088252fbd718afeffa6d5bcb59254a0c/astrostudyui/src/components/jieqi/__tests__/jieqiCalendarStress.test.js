// 黄历/分至(calendar/jieqi)穷尽压测:这两技法重计算在后端(/nongli/time、/jieqi/year、/chart),
//   前端可纯函数压测的面=①节气年种子 buildLocalJieqiYearSeed(全年24节气本地推算,lunar-javascript,兼作日干支引擎)
//   ②盘缓存兼容判 isJieQiChartCompatible(10 键比对)。后端依赖部分已标注、不在前端压测范围。
//   断言:①不抛 ②结构完整(节气名/时刻格式/日干支合法) ③本地单次<阈值。
import { buildLocalJieqiYearSeed } from '../../../utils/localNongliAdapter';
import { isJieQiChartCompatible } from '../JieQiChartsMain';

const TERMS24 = ['小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'];
const GAN = '甲乙丙丁戊己庚辛壬癸';
const ZHI = '子丑寅卯辰巳午未申酉戌亥';
function isGanzhi(s){ return typeof s === 'string' && s.length === 2 && GAN.indexOf(s[0]) >= 0 && ZHI.indexOf(s[1]) >= 0; }

describe('黄历/分至穷尽压测 · 前端纯函数面', ()=>{
	// 节气年种子:覆盖大跨度年份(含远古/未来/BC 边界式整数)× 多时区 → 不抛 + 每节气结构完整 + 时刻按年单调。
	test('buildLocalJieqiYearSeed 跨年份(1900..2100 步20=11)× 4时区:不抛 + 节气名合法 + 时刻格式 + 日干支合法 + 年内时间递增', ()=>{
		const years = [];
		for(let y = 1900; y <= 2100; y += 20){ years.push(y); }
		const zones = ['+08:00', 'UTC', '+00:00', '-05:00'];
		let n = 0;
		years.forEach((y)=>{
			zones.forEach((zone)=>{
				let seed = null;
				expect(()=>{ seed = buildLocalJieqiYearSeed(y, zone); }).not.toThrow();
				expect(seed && typeof seed === 'object').toBe(true);
				const keys = Object.keys(seed);
				expect(keys.length).toBeGreaterThanOrEqual(22); // 表锚 7/1,通常全 24(冬至属上年12月)
				let prevTime = '';
				TERMS24.forEach((term)=>{
					if(!seed[term]){ return; }
					const e = seed[term];
					expect(e.term).toBe(term);
					expect(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(e.time)).toBe(true);
					expect(/^\d{8}$/.test(e.dateKey)).toBe(true);
					expect(isGanzhi(e.dayGanzhi)).toBe(true); // 日干支引擎(getDayGanZhi)透传验证
					// 小寒..大雪(前23节)在本历年内按标准序递增;冬至属上年12月(表锚 7/1 所致),不纳入此链。
					if(term !== '冬至'){
						if(prevTime){ expect(e.time >= prevTime).toBe(true); }
						prevTime = e.time;
					}
				});
				n++;
			});
		});
		expect(n).toBe(11 * 4);
	});

	test('非法年份/缺参容错:NaN→null,不抛', ()=>{
		expect(buildLocalJieqiYearSeed('abc')).toBeNull();
		expect(()=> buildLocalJieqiYearSeed(undefined)).not.toThrow();
	});

	test('确定性:同年同区两次种子完全一致(无随机)', ()=>{
		const a = buildLocalJieqiYearSeed(2026, '+08:00');
		const b = buildLocalJieqiYearSeed(2026, '+08:00');
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
	});

	// 盘缓存兼容判:基准盘 × 逐键变异(17 键) → 同则 true、任一异则 false。
	// 🔴 变异清单必须与 isJieQiChartCompatible 的比对键逐键同步:曾扩到 17 键后本测试
	// 仍只变异 10 键 —— 新增 7 键中 5 键(triplicity/lotReversal/westNodeType/sectBuffer/
	// leoBoundFirst)零守卫,从清单删键不会红。
	test('isJieQiChartCompatible:全等→true;17 比对键逐一变异→false(缓存失效面全覆盖)', ()=>{
		const base = {
			year: 2026, ad: 1, zone: '+08:00', lat: '26n04', lon: '119e19', gpsLat: 26.04, gpsLon: 119.19,
			hsys: 3, zodiacal: 1, siderealAyanamsa: 'lahiri', doubingSu28: 0, termsVariant: 0,
			triplicity: 'dorothean', lotReversal: 0, westNodeType: 0, sectBuffer: 0, leoBoundFirst: 0,
		};
		expect(isJieQiChartCompatible({ params: { ...base } }, { ...base })).toBe(true);
		const mutate = {
			year: 2027, ad: -1, zone: '+09:00', lat: '30n00', lon: '120e00',
			gpsLat: 30.0, gpsLon: 120.0, hsys: 0, zodiacal: 0, siderealAyanamsa: 'raman',
			doubingSu28: 1, termsVariant: 1, triplicity: 'ptolemaic', lotReversal: 1,
			westNodeType: 1, sectBuffer: 3, leoBoundFirst: 1,
		};
		let n = 0;
		Object.keys(mutate).forEach((key)=>{
			const req = { ...base, [key]: mutate[key] };
			expect(isJieQiChartCompatible({ params: { ...base } }, req)).toBe(false);
			n++;
		});
		expect(n).toBe(17); // 17 比对键全覆盖(与 isJieQiChartCompatible 清单等长)
	});

	test('isJieQiChartCompatible:岁差/古典口径变化必判不兼容(须重取),无关键不影响', ()=>{
		// 🔴 旧断言锁的恰是被证伪的行为(「siderealAyanamsa 变化不影响兼容」)——
		// 换岁差时 zodiacal 恒 1、其余键全等 → 判兼容直接返旧盘,请求根本不发,
		// 与同文件 getChartCacheKey 已含该键的口径矛盾。现按正口径改锁。
		const base = { year: 2026, ad: 1, zone: '+08:00', lat: '26n04', lon: '119e19', gpsLat: 26.04, gpsLon: 119.19, hsys: 3, zodiacal: 1, doubingSu28: 0, siderealAyanamsa: 'lahiri' };
		expect(isJieQiChartCompatible({ params: { ...base } }, { ...base, somethingElse: 42 })).toBe(true);
		expect(isJieQiChartCompatible({ params: { ...base } }, { ...base, siderealAyanamsa: 'raman' })).toBe(false);
		expect(isJieQiChartCompatible({ params: { ...base } }, { ...base, termsVariant: 1 })).toBe(false);
	});

	test('本地引擎单次耗时<阈值(期望<500ms,>1s 标红):一年24节气推算', ()=>{
		const t0 = Date.now();
		buildLocalJieqiYearSeed(2026, '+08:00');
		expect(Date.now() - t0).toBeLessThan(1000);
	});
});
