// 太乙盘头 / 快照的「农历」行与节后天数随所选时间基准(与四柱同一本地结果),此前取 /nongli/time 那份(恒按真太阳时):
// 选直接时间(缺省)时日界附近农历写成前一天、日柱却是当天。本地给不出(域外年份)才用历法服务那份。
import { normalizeBackendPan } from '../TaiYiCalc';
import buildLocalBaziResult from '../../../utils/baziLunarLocal';

const backendNongli = { year: '癸卯', month: '腊月', day: '三十', leap: false, jiedelta: '立春后第2天', birth: '2024-02-09 23:40:00' };

test('有本地结果:农历行 / 节后天数取本地那份(随基准);没有才回落历法服务', ()=>{
	const baziLocal = { bazi: { nongli: { yearGZByLunar: '甲辰', month: '正月', day: '初一', leap: false, jiedelta: '立春后第3天', solarTime: '2024-02-10 00:10:00', clockTime: '2024-02-10 00:30:00' } } };
	const pan = normalizeBackendPan({ palace16: [] }, { timeBasis: 'direct' }, backendNongli, baziLocal);
	expect(pan.lunarText).toBe('甲辰年正月初一');
	expect(pan.jiedelta).toBe('立春后第3天');
	const noLocal = normalizeBackendPan({ palace16: [] }, { timeBasis: 'direct' }, backendNongli, null);
	expect(noLocal.lunarText).toBe('癸卯年腊月三十');
	expect(noLocal.jiedelta).toBe('立春后第2天');
});

test('🔴 乌鲁木齐凌晨 00:30:直接时间按当天,真太阳时按前一天(农历日与日柱同一口径)', ()=>{
	const base = { date: '2026-03-05', time: '00:30:00', zone: '+08:00', lon: '87e36', lat: '43n48', gpsLat: 43.8, gpsLon: 87.6, gender: 1 };
	const direct = buildLocalBaziResult({ ...base, timeAlg: 1 }).bazi.nongli;
	const solar = buildLocalBaziResult({ ...base, timeAlg: 0 }).bazi.nongli;
	expect(direct.day).not.toBe(solar.day);
	const pd = normalizeBackendPan({ palace16: [] }, { timeBasis: 'direct' }, backendNongli, { bazi: { nongli: direct } });
	const ps = normalizeBackendPan({ palace16: [] }, { timeBasis: 'trueSolar' }, backendNongli, { bazi: { nongli: solar } });
	expect(pd.lunarText).toContain(direct.day);
	expect(ps.lunarText).toContain(solar.day);
});
