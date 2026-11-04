// 「改单开关 → 流派标自定义」须可逆:改回到偏离前流派的组合即归回该流派;凑成别的预设不改标。
// 曾只进不出:改回后仍显示「自定义(已偏离预设)」——演禽 / 皇极轨策 / 六爻三处同款写法同修。
import * as yq from '../yanqinSchools';
import * as gc from '../../guice/guiceSchools';
import * as ly from '../../gua/liuyaoSchools';

describe('流派 自定义 ↔ 预设 可逆', () => {
	test('演禽:改月禽口诀再改回 → 归回池本理', () => {
		const a = yq.applyPreset('chibenli');
		const b = yq.setOption(a, 'monthVerse', 'B');
		expect(b.school).toBe('custom');
		expect(yq.setOption(b, 'monthVerse', 'A').school).toBe('chibenli');
	});
	test('演禽:参筹 / 江西开关组合相同,改回优先回原流派', () => {
		const j = yq.setOption(yq.applyPreset('jiangxi'), 'sansuo', 'both');
		expect(j.school).toBe('custom');
		expect(yq.setOption(j, 'sansuo', 'fanqin').school).toBe('jiangxi');
	});
	test('演禽:凑成别的预设不改标(仍是自定义组合)', () => {
		const c = yq.setOption(yq.applyPreset('chibenli'), 'qinWuxing', 'wangfu');
		expect(c.school).toBe('custom');
	});
	test('皇极轨策:改演数再改回 → 归回原流派', () => {
		const a = gc.applyPreset('default');
		const b = gc.setOption(a, 'yanshuFa', a.yanshuFa === 'ce' ? 'gui' : 'ce');
		expect(b.school).toBe('custom');
		expect(gc.setOption(b, 'yanshuFa', a.yanshuFa).school).toBe('default');
	});
	test('六爻:改土长生再改回 → 归回原流派', () => {
		const a = ly.applyPreset('default');
		const b = ly.setOption(a, 'tuChangsheng', a.tuChangsheng === 'fire' ? 'water' : 'fire');
		expect(b.school).toBe('custom');
		expect(ly.setOption(b, 'tuChangsheng', a.tuChangsheng).school).toBe('default');
	});
});
