// R2 恒星深化金标:41 星表完整性/Behenian 15(末位异本双标)/四王者守望/性质分歧双列/新星岁差位/王者命中注记。
import { FIXED_STARS, starLonAt, starOrbFor } from '../../data/fixedStars';
import { runElection } from '../electionEngine';
import { buildMockResult } from './electionFixture';

const by = (en) => FIXED_STARS.find((s) => s.name_en === en);

describe('星表完整性与元数据', () => {
	it('41 星全带星等;新增 10 星在位', () => {
		expect(FIXED_STARS.length).toBe(41);
		FIXED_STARS.forEach((s) => expect(typeof s.magnitude).toBe('number'));
		['Bellatrix', 'Algorab', 'Alphecca', 'Zuben Elgenubi', 'Zuben Eschamali', 'Bungula', 'Ras Alhague', 'Lesath', 'Achernar', 'Alkaid'].forEach((en) => expect(by(en)).toBeTruthy());
	});
	it('Behenian:核心 14 星全标注;末位异本双标(摇光/北落师门);带宝石草药者 ≥13', () => {
		const beh = FIXED_STARS.filter((s) => s.behenian);
		expect(beh.length).toBe(16);
		['Algol', 'Alcyone', 'Aldebaran', 'Capella', 'Sirius', 'Procyon', 'Regulus', 'Algorab', 'Spica', 'Arcturus', 'Alphecca', 'Antares', 'Vega', 'Deneb Algedi'].forEach((en) => expect(by(en).behenian).toBeTruthy());
		expect(by('Alkaid').behenian.use).toContain('异本');
		expect(by('Fomalhaut').behenian.order).toBe('15*');
		expect(beh.filter((s) => s.behenian.gem).length).toBeGreaterThanOrEqual(13);
	});
	it('四王者:守望方位+波斯名+天使全备且各归其方', () => {
		expect(by('Aldebaran').royal).toEqual({ watcher: '东', persian: 'Tascheter', angel: '米迦勒 Michael' });
		expect(by('Regulus').royal.watcher).toBe('北');
		expect(by('Antares').royal.watcher).toBe('西');
		expect(by('Fomalhaut').royal.watcher).toBe('南');
		expect(FIXED_STARS.filter((s) => s.royal).length).toBe(4);
	});
	it('性质分歧双列:参宿七(木土↔木火)/角宿一/鬼宿星团带 natureVariants', () => {
		expect(by('Rigel').natureVariants.length).toBe(2);
		expect(by('Spica').natureVariants).toBeTruthy();
		expect(by('Praesepe').natureVariants).toBeTruthy();
	});
	it('新星岁差:氐宿一 2000 年实位 ≈ 天蝎15°05′(±2′)', () => {
		const lon2000 = starLonAt(by('Zuben Elgenubi').lon_1995, 2000);
		expect(Math.abs(lon2000 - 225.083)).toBeLessThan(0.034);
	});
});

describe('引擎面:王者命中注记 + 星等轨', () => {
	it('命度移至轩辕十四(当年实位)→ 恒星模块出「四王者·北方守望」注记', () => {
		const r = buildMockResult();
		const reg = starLonAt(by('Regulus').lon_1995, 2025);
		const asc = r.chart.objects.find((o) => o.id === 'Asc');
		asc.lon = reg;
		const j = runElection(r, 'marriage');
		const sec = j.sections.find((s) => s.key === 'fixed_stars');
		expect(sec.findings.map((f) => f.message).join('|')).toContain('四王者·北方守望');
	});
	it('starOrbFor byMagnitude:一等星 7.5°/王者封顶 5°/暗星团 1.5°;新星吃档', () => {
		expect(starOrbFor(by('Achernar'), { fixedStarOrbMode: 'byMagnitude' })).toBe(7.5);
		expect(starOrbFor(by('Regulus'), { fixedStarOrbMode: 'byMagnitude' })).toBe(5);
		expect(starOrbFor(by('Aculeus'), { fixedStarOrbMode: 'byMagnitude' })).toBe(1.5);
	});
});
