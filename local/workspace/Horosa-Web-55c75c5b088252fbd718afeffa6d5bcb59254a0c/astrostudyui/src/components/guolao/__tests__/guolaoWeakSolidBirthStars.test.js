// [v44 硬缺修] 果老 [虚实]/[本命化曜] 段 builder(纯函数):有数据出段、无数据空串(零字节变化)。
// 段头与 preset 的一致性由 aiExportRoundtrip 全树守卫另行机器闸。
import { buildGuolaoWeakSolidSection, buildGuolaoBirthStarsSection } from '../GuoLaoChartMain';

describe('果老 [虚实] 段 builder', ()=>{
	it('无 weakSolid 数据 → 空串不抛', ()=>{
		expect(buildGuolaoWeakSolidSection(null)).toBe('');
		expect(buildGuolaoWeakSolidSection({})).toBe('');
		expect(buildGuolaoWeakSolidSection({ weakSolid: { houses: [] } })).toBe('');
	});

	it('宫位行 → GFM 表(宫位|虚实|虚柱|实柱)+口径行', ()=>{
		const out = buildGuolaoWeakSolidSection({ weakSolid: { houses: [
			{ house: '命宫', label: '实', solid: true, weakPillars: [], solidPillars: ['年', '日'] },
			{ house: '财帛', label: '虚', weak: true, weakPillars: ['月'], solidPillars: [] },
		] } });
		const lines = out.split('\n');
		expect(lines[0]).toBe('| 宫位 | 虚实 | 虚柱 | 实柱 |');
		expect(lines[1]).toBe('| --- | --- | --- | --- |');
		expect(lines[2]).toContain('| 命宫 | 实 |');
		expect(lines[2]).toContain('年、日');
		expect(lines[3]).toContain('| 财帛 | 虚 | 月 |');
		expect(out).toMatch(/口径：虚宫按四柱旬空推虚；实宫按年、月、日、时四柱地支定实。/);
	});
});

describe('果老 [本命化曜] 段 builder', ()=>{
	it('无 birth planetRows → 空串不抛', ()=>{
		expect(buildGuolaoBirthStarsSection(null)).toBe('');
		expect(buildGuolaoBirthStarsSection({ yearStars: { birth: { planetRows: [] } } })).toBe('');
	});

	it('本命化曜行+十神序+天禄至天权 三◆子块', ()=>{
		const out = buildGuolaoBirthStarsSection({ yearStars: { birth: {
			yearPole: '丙午',
			planetRows: [
				{ star: '木', changeTo: '天贵', items: ['岁星'] },
				{ star: '火', changeTo: '天刑', items: [] },
			],
		} } });
		expect(out).toMatch(/^本命年柱：丙午$/m);
		expect(out).toMatch(/^◆ 本命化曜$/m);
		expect(out).toMatch(/^木：化天贵（同归：岁星）$/m);
		expect(out).toMatch(/^火：化天刑$/m);
		expect(out).toMatch(/^◆ 十神序（参考）$/m);
		expect(out).toMatch(/原十神序：天禄、/);
		expect(out).toMatch(/替代十神序：比肩、/);
		expect(out).toMatch(/^◆ 天禄至天权（年曜主项）$/m);
	});
});
