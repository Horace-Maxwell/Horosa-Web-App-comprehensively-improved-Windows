// [奇门择日 P0] buildLocalNongliLite ≡ buildLocalBaziResult 消费面平价锚。
// 奇门找局扫描用 lite 版供 nongli(跳过三推运等 ≈97% 成本的派生),本测试把两版在奇门引擎
// 全部消费键上钉死:lite.bazi.nongli 的每个键 == 全量版同键(全量版多出的 clockTime/solarTime
// 不在 lite 消费面,不比),fourColumns 四柱干支逐柱相等。
// 网格 = dunjia golden 群临界点(置闰临界 2016-06-03 / 至界双时 2015-12-22 / 晚子时) ×
// timeAlg × after23NewDay × lateZiHourUseNextDay 全组合 —— 任一开关在 lite 内接错即红。
import { buildLocalBaziResult, buildLocalNongliLite } from '../baziLunarLocal';

const DATES = [
	['2026-05-15', '00:12:00'],   // dunjiaSnapshotTableEquiv 冻结基线时刻
	['2016-06-03', '10:30:00'],   // 置闰天数临界盘(芒种窗 dgap=8)
	['2015-12-22', '10:30:00'],   // 冬至至界前
	['2015-12-22', '14:30:00'],   // 冬至至界后
	['2015-01-02', '23:30:00'],   // 晚子时(日柱进位分歧点)
	['2024-12-25', '23:30:00'],   // 晚子时近年对照
];
const GEO = { zone: '+08:00', lon: '120e00', lat: '30n00', gpsLon: 120, gpsLat: 30, ad: 1, gender: 1 };

function fourPillarGanzi(fc){
	return ['year', 'month', 'day', 'time'].map((k)=>(fc && fc[k] ? fc[k].ganzi : null));
}

describe('buildLocalNongliLite 消费面平价(奇门扫描供数)', ()=>{
	DATES.forEach(([date, time])=>{
		[0, 1].forEach((timeAlg)=>{
			[0, 1].forEach((after23NewDay)=>{
				[0, 1].forEach((lateZiHourUseNextDay)=>{
					test(`${date} ${time} timeAlg=${timeAlg} after23=${after23NewDay} lateZi=${lateZiHourUseNextDay}`, ()=>{
						const params = { date, time, ...GEO, timeAlg, after23NewDay, lateZiHourUseNextDay };
						const full = buildLocalBaziResult(params);
						const lite = buildLocalNongliLite(params);
						Object.keys(lite.bazi.nongli).forEach((key)=>{
							expect({ key, value: lite.bazi.nongli[key] }).toEqual({ key, value: full.bazi.nongli[key] });
						});
						expect(fourPillarGanzi(lite.bazi.fourColumns)).toEqual(fourPillarGanzi(full.bazi.fourColumns));
						expect(lite.bazi.gender).toEqual(full.bazi.gender);
					});
				});
			});
		});
	});

	test('lite 不携带推运派生(证明未误走全量重路径)', ()=>{
		const lite = buildLocalNongliLite({ date: '2026-05-15', time: '00:12:00', ...GEO, timeAlg: 1, after23NewDay: 1 });
		expect(lite.bazi.direction).toBeUndefined();
		expect(lite.bazi.mainDirection).toBeUndefined();
		expect(lite.bazi.smallDirection).toBeUndefined();
		expect(lite.bazi.wuxingStat).toBeUndefined();
		expect(lite.local).toBe(true);
	});
});
