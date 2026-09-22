// [挂载自检 F-47] 神数正传·大定「所推之年」齿轮(zcDadingYear)无头必须消费:页面按所推之年自八字推运表
// 派生 虚岁/大运/小运/岁君(deriveDadingYearPillars),无头此前只透传不消费 → 恒回落本命四柱。
// 判别向量:同盘 大定 school,所推之年 2020 vs 未填 → 「大运／小运／岁君」行必不同,且岁君=2020 太岁 庚子。
jest.mock('../request', () => ({ __esModule: true, default: jest.fn(async () => ({ Result: {} })) }));
import { regenerateChartTechniqueSnapshot } from '../aiAnalysisContext';
import { deriveDadingYearPillars } from '../zhengchuanDadingLocal';
import { buildLocalBaziResult } from '../baziLunarLocal';

const REC = { cid: 'zc-dading', name: '大定', birth: '1990-05-18 10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gpsLon: 118.45, gpsLat: 31.63, gender: 1, ad: 1 };
const pickLine = (txt, head)=>`${txt}`.split('\n').find((l)=>l.indexOf(head) >= 0) || '';

describe('正传·大定 所推之年 无头派生', ()=>{
	it('🔴 zcDadingYear=2020 → 岁君 庚子;未填 → 回落本命四柱(=旧现状)', async ()=>{
		const base = await regenerateChartTechniqueSnapshot({ ...REC, zcSchool: 'dading' }, 'zhengchuan');
		const withYear = await regenerateChartTechniqueSnapshot({ ...REC, zcSchool: 'dading', zcDadingYear: 2020 }, 'zhengchuan');
		expect(base).toContain('大定神数');
		expect(withYear).toContain('大定神数');
		const l0 = pickLine(base, '大运／小运／岁君');
		const l1 = pickLine(withYear, '大运／小运／岁君');
		expect(l0).toBeTruthy();
		expect(l1).not.toBe(l0);
		expect(l1).toContain('庚子');
		expect(withYear).toContain('| 所推之年 | 2020 |');
		// 未填年:岁君回落年柱(庚午)= 此前现状
		expect(l0).toContain('庚午');
	});
	it('派生函数与页面同源:2020 → 虚岁 31、岁君 庚子', ()=>{
		const bazi = buildLocalBaziResult({ date: '1990-05-18', time: '10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', gender: 1 }).bazi;
		const d = deriveDadingYearPillars(bazi, 2020);
		expect(d.suijun).toBe('庚子');
		expect(d.age).toBe(31);
	});
});
