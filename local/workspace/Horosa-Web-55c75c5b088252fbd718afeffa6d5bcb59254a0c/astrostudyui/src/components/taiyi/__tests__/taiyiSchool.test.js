import { applyTaiyiSchool, isDefaultSchool, normalizeTaiyiSchool, DEFAULT_TAIYI_SCHOOL } from '../core/taiyiSchool';

const basePan = () => ({
	taiyiPalace: '艮', taiyiNum: 3, skyeyes: '申', sf: '艮', jigod: '寅',
	homeCal: 16, awayCal: 3, setCal: 22, homeGeneral: 6, awayGeneral: 3,
	kingbase: '子', officerbase: '亥', pplbase: '寅', wufuNum: 1, bigyoNum: 9, smyoNum: 9,
	kook: { num: 55, year: '阳33局' }, ganzhi: { year: '丙午' }, dateStr: '2026-06-22', tn: 0,
});

describe('太乙 流派覆盖层(§33/§44)', () => {
	test('默认 = 空操作(字节不变)', () => {
		const p = basePan();
		const r = applyTaiyiSchool(p, DEFAULT_TAIYI_SCHOOL);
		expect(r.overrides.size).toBe(0);
		expect(r.pan.homeCal).toBe(16);
		expect(r.pan.awayCal).toBe(3);
		expect(r.pan.skyeyes).toBe('申');
		expect(r.pan.kingbase).toBe('子');
		expect(isDefaultSchool(DEFAULT_TAIYI_SCHOOL)).toBe(true);
		expect(isDefaultSchool({ jishen: '逆' })).toBe(false);
	});
	test('计神方向=逆 → 计神/始击 重算 + 主客算改几何', () => {
		const r = applyTaiyiSchool(basePan(), { jishen: '逆' });
		expect(r.pan.jigod).toBe('申'); // 丙午年支午,逆:(2-6+12)%12=8→申
		expect(r.overrides.has('jigod')).toBe(true);
		expect(r.overrides.has('sf')).toBe(true);
		expect(r.geoSuan).toBe(true);
		expect(r.overrides.has('homeCal')).toBe(true);
		expect(r.overrides.has('awayCal')).toBe(true);
		expect(typeof r.pan.homeCal).toBe('number');
	});
	test('文昌重留=无重留 → 文昌重算', () => {
		const r = applyTaiyiSchool(basePan(), { wenchang: '无重留' });
		expect(r.overrides.has('skyeyes')).toBe(true);
		expect(r.geoSuan).toBe(true);
	});
	test('客算间辰=无加一 → 客算几何重算', () => {
		const r = applyTaiyiSchool(basePan(), { keJianChen: '无加一' });
		expect(r.geoSuan).toBe(true);
		expect(r.overrides.has('awayCal')).toBe(true);
	});
	test('三基起宫=金镜 → 君臣基重算(起戌)', () => {
		const r = applyTaiyiSchool(basePan(), { sanji: '金镜' });
		expect(r.overrides.has('kingbase')).toBe(true);
		expect(r.overrides.has('officerbase')).toBe(true);
		expect(r.pan.kingbase).not.toBe('子'); // 起戌 ≠ 原值
	});
	test('游神方向=顺 → 大小游重算', () => {
		const r = applyTaiyiSchool(basePan(), { youshen: '顺' });
		expect(r.overrides.has('bigyoNum')).toBe(true);
		expect(r.overrides.has('smyoNum')).toBe(true);
	});
	test('附流派注记 _schoolNote(供AI快照)', () => {
		const r = applyTaiyiSchool(basePan(), { jishen: '逆', sanji: '金镜' });
		expect(r.pan._schoolNote).toContain('计神');
		expect(r.pan._schoolNote).toContain('三基起宫');
	});
	test('normalizeTaiyiSchool 补全默认', () => {
		expect(normalizeTaiyiSchool({ jishen: '顺' })).toEqual({ ...DEFAULT_TAIYI_SCHOOL, jishen: '顺' });
	});
	// —— D2 始击坐标(实验·存疑待源) ——
	test('始击坐标=九宫:始击间神投影至后一正宫 + 客算几何重算 + 存疑徽标', () => {
		const p = { ...basePan(), sf: '寅' };   // 寅=间神(idx3)→后一正宫卯(idx4)
		const r = applyTaiyiSchool(p, { shijiCoord: '九宫' });
		expect(r.pan.sf).toBe('卯');
		expect(r.overrides.has('sf')).toBe(true);
		expect(r.overrides.has('awayCal')).toBe(true);   // 客算连带几何重算
		expect(r.pan._shijiExperimental).toBe(true);
		expect(r.pan._schoolNote).toContain('始击坐标');
		expect(r.pan._schoolNote).toContain('存疑');
	});
	test('始击坐标=十六神:始击留环位不动、客算仍几何重算', () => {
		const p = { ...basePan(), sf: '寅' };
		const r = applyTaiyiSchool(p, { shijiCoord: '十六神' });
		expect(r.pan.sf).toBe('寅');                       // 十六神坐标保留几何位
		expect(r.overrides.has('awayCal')).toBe(true);
		expect(r.pan._shijiExperimental).toBe(true);
	});
	test('始击坐标=默认:空操作(不标实验)', () => {
		const r = applyTaiyiSchool(basePan(), { shijiCoord: 'default' });
		expect(r.pan._shijiExperimental).toBeUndefined();
		expect(isDefaultSchool({ shijiCoord: 'default' })).toBe(true);
	});
});
