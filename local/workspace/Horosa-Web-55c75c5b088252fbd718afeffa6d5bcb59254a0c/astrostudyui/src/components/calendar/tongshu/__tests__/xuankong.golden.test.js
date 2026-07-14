// 三元玄空 golden：古法案例一逐格复算（实历相符）+ 五吉判定 + 60甲子配卦。失败=数据/引擎错。
// 注：古法案例二书载 1966-6-12 午时四柱全午（时甲午/日丙午…），但实历该日为壬寅日——书为图解理想化四柱，
// 且书中对 4-9 配对时而称「生成」时而称「同旺」（4、9 既同金又成河图生成对，术语宽松）；故案例二只验五吉规则本身。
import { wuji, xuankongForHour } from '../xuankong';
import { LIUSHI_JIAZI_GUA } from '../xuankongData';

describe('玄空 · 六十甲子配卦 + 五吉', () => {
	test('60 条齐全，五行数无 5（中土不入卦）', () => {
		expect(Object.keys(LIUSHI_JIAZI_GUA).length).toBe(60);
		expect(Object.values(LIUSHI_JIAZI_GUA).some((v)=> v.wxNum === 5)).toBe(false);
		expect(LIUSHI_JIAZI_GUA['甲子'].gua).toBe('坤为地');
		expect(LIUSHI_JIAZI_GUA['甲午'].gua).toBe('乾为天');
	});

	test('五吉判定（不含歧义配对）', () => {
		expect(wuji(4, 4)).toBe('同旺');       // 同数
		expect(wuji(4, 6)).toBe('合十');       // 4+6=10
		expect(wuji(4, 2)).toBe('克入');       // 火(2)克金(4)
		expect(wuji(2, 3)).toBe('生入');       // 木(3)生火(2)，非合十(2+3≠10)
		expect(wuji(4, 3)).toBeNull();         // 金克木=克出，非入
		expect(wuji(4, 9)).toBeTruthy();       // 金 4-9：河图生成对（吉，书或称生成或同旺）
	});
});

describe('玄空 · 古法案例一（1966-3-19 巳时·实历相符）', () => {
	const r = xuankongForHour({ y: 1966, m: 3, d: 19, hourZhi: '巳' });
	test('四柱卦象 = 年丙午/月辛卯/日丁丑/时乙巳', () => {
		expect(r.pillars.year.gz).toBe('丙午');
		expect(r.pillars.month.gz).toBe('辛卯');
		expect(r.pillars.day.gz).toBe('丁丑');
		expect(r.pillars.time.gz).toBe('乙巳');
		expect(r.pillars.day.gua).toBe('泽雷随');
		expect(r.pillars.day.wxNum).toBe(4);
	});
	test('五吉：时克入·月克入·年同旺 → 上上吉', () => {
		expect(r.wuji.timeVsDay).toBe('克入');
		expect(r.wuji.monthVsDay).toBe('克入');
		expect(r.wuji.yearVsDay).toBe('同旺');
		expect(r.level.name).toBe('上上吉');
	});
	test('卦运合十格局（年月时各与日运合十：3+7=10）', () => {
		expect(r.geju).toBeTruthy();
		expect(r.geju.name).toContain('合十');
	});
});

describe('玄空 · 天人配合（日对仙命·60甲子）', () => {
	test('仙命戊午=火风鼎(3木)，日柱金则克入', () => {
		// 造一金日课验证：日对仙命 = 金克木 = 克入（书案例二结论）。
		const r = xuankongForHour({ y: 1966, m: 3, d: 19, hourZhi: '巳' }, '戊午'); // 日丁丑4金
		expect(r.ming.gua).toBe('火风鼎');
		expect(r.ming.wxNum).toBe(3);
		expect(r.dayVsMing).toBe('克入');      // 日金(4)对仙命木(3)
	});
});
