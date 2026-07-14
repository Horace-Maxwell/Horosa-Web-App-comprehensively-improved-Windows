// 天元乌兔 golden：癸亥年(1983)七月起日案例（源异文经实历勘正）。
// 太阳日 初一己巳/初十戊寅/十九丁亥/廿八丙申；太阴日 初四壬申/十三辛巳/廿二庚寅。
// 初一=1983-08-09。失败=起日算法错，不得改测试将就。
import { wutuForDate, wutuMonth, PAISHAN_STAR } from '../wutu';

describe('天元乌兔 · 九星表', () => {
	test('九宫→九星（日月木金水吉·土孛火罗计凶）', () => {
		expect(PAISHAN_STAR[8].name).toBe('太阳');
		expect(PAISHAN_STAR[2].name).toBe('太阴');
		expect(PAISHAN_STAR[1].jx).toBe('good');   // 水星吉
		expect(PAISHAN_STAR[9].jx).toBe('bad');    // 火星凶
		expect(PAISHAN_STAR[5].jx).toBe('bad');    // 土星凶
	});
});

describe('天元乌兔 · 癸亥七月起日案例', () => {
	const sun = [['1983-08-09', '己巳'], ['1983-08-18', '戊寅'], ['1983-08-27', '丁亥'], ['1983-09-05', '丙申']];
	const moon = [['1983-08-12', '壬申'], ['1983-08-21', '辛巳'], ['1983-08-30', '庚寅']];

	test('四太阳日皆值太阳', () => {
		sun.forEach(([ymd, gz])=>{
			const [y, m, d] = ymd.split('-').map(Number);
			const r = wutuForDate({ y, m, d });
			expect(r.dayGZ).toBe(gz);
			expect(r.isSun).toBe(true);
			expect(r.star).toBe('太阳');
		});
	});

	test('三太阴日皆值太阴', () => {
		moon.forEach(([ymd, gz])=>{
			const [y, m, d] = ymd.split('-').map(Number);
			const r = wutuForDate({ y, m, d });
			expect(r.dayGZ).toBe(gz);
			expect(r.isMoon).toBe(true);
			expect(r.star).toBe('太阴');
		});
	});

	test('月列表：太阳/太阴日干支集与案例一致', () => {
		const M = wutuMonth({ y: 1983, m: 8, d: 15 });
		expect(M.sunDays.map((x)=> x.dayGZ)).toEqual(['己巳', '戊寅', '丁亥', '丙申']);
		expect(M.moonDays.map((x)=> x.dayGZ)).toEqual(['壬申', '辛巳', '庚寅']);
	});
});
