// R2 尊贵强弱页引擎金标:本质矩阵(随口径)/偶然满分手算/接纳五级与陷弱host/吉化凶化判据/面神像。
import { essentialMatrix, accidentalTable, receptionGrade, receptionReport, bonificationReport, facePositions } from '../dignityReport';
import { runElection } from '../electionEngine';
import { buildFacts } from '../../engine/chartFacts';
import { agrippaFaceImage, DECAN_IMAGES_AGRIPPA } from '../../data/decanImages';
import { buildMockResult } from './electionFixture';

function mkFacts(patch){
	const r = buildMockResult();
	if(patch) patch(r);
	return buildFacts(r);
}
const rowOf = (m, k) => m.find((r) => r.key === k);

describe('五重本质矩阵(随流派口径)', () => {
	it('fixture 手算:月(巨蟹7°)庙+共主三分=+8;金(白羊25°)陷+面=−4;水(双鱼10°)陷弱=−9', () => {
		const m = essentialMatrix(mkFacts(), null);
		const moon = rowOf(m, 'moon');
		expect(moon.domicile).toBe(true);
		expect(moon.triplicityPart).toBe(true);   // Dorothean 水象共主=月
		expect(moon.score).toBe(8);
		const venus = rowOf(m, 'venus');
		expect(venus.detriment).toBe(true);
		expect(venus.face).toBe(true);            // 白羊第3面主金
		expect(venus.score).toBe(-4);
		const mercury = rowOf(m, 'mercury');
		expect(mercury.detriment).toBe(true);
		expect(mercury.fall).toBe(true);
		expect(mercury.score).toBe(-9);
	});
	it('Ptolemy 二主口径:水象无共主 → 月失三分,小计 8→5;bodySet=classical7 不出三王星行', () => {
		const m = essentialMatrix(mkFacts(), { tripSystem: 'ptolemaic', bodySet: 'classical7' });
		expect(rowOf(m, 'moon').score).toBe(5);
		expect(rowOf(m, 'uranus')).toBeUndefined();
		const m10 = essentialMatrix(mkFacts(), null);
		expect(rowOf(m10, 'uranus')).toBeTruthy();
	});
});

describe('偶然尊贵满分表(1647 全表手算锚)', () => {
	it('水星:12宫−5/逆−5/迟−2/东出−2(☿组反号)/日下光−4 = −18', () => {
		const acc = accidentalTable(mkFacts(), null);
		const mer = acc.find((r) => r.key === 'mercury');
		expect(mer.total).toBe(-18);
		expect(mer.items.some((i) => i.key === 'under_beams')).toBe(true);
	});
	it('木星:3宫+1/顺+4/疾+2/西入−2(♃组西入减)/脱焰+5 = +10', () => {
		const acc = accidentalTable(mkFacts(), null);
		const jup = acc.find((r) => r.key === 'jupiter');
		expect(jup.total).toBe(10);
	});
});

describe('接纳五级 + 由陷弱接纳为害', () => {
	it('receptionGrade 序:庙>旺>三分>界>面;fixture 土受纳月为「界」级不判害', () => {
		expect(receptionGrade(['face', 'ruler']).token).toBe('ruler');
		expect(receptionGrade(['term']).cn).toContain('界');
		const recs = receptionReport(mkFacts());
		expect(recs.length).toBe(1);
		expect(recs[0].supplier).toBe('saturn');
		expect(recs[0].grade.token).toBe('term');
		expect(recs[0].harmful).toBe(false);
	});
	it('主人自陷(土 selfDignity=exile,−5)→ 同一接纳判「由陷弱接纳为害」', () => {
		const recs = receptionReport(mkFacts((r) => {
			const sat = r.chart.objects.find((o) => o.id === 'Saturn');
			sat.selfDignity = ['exile'];
		}));
		expect(recs[0].harmful).toBe(true);
		expect(recs[0].text).toContain('为害');
	});
});

describe('吉化/凶化判据', () => {
	it('fixture 整宫凌制三命中:金凌月/金凌火(吉),土凌木(凶);无背离', () => {
		const items = bonificationReport(mkFacts());
		const texts = items.map((i) => i.text).join('|');
		expect(texts).toContain('金星 自优位四分凌制 月亮');
		expect(texts).toContain('土星 自优位四分凌制 木星');
		expect(texts).not.toContain('背离');
	});
	it('背离:水星移狮子(定位星日在双鱼,第8座不相见)→ 出凶化背离项', () => {
		const items = bonificationReport(mkFacts((r) => {
			const mer = r.chart.objects.find((o) => o.id === 'Mercury');
			mer.lon = 130; mer.sign = 'Leo'; mer.signlon = 10;
		}));
		expect(items.map((i) => i.text).join('|')).toContain('水星 与其定位星 太阳 互处背离');
	});
	it('执矛:木星移至日前 9.9°(昼盘派内吉星先升)→ 吉化执矛;燃烧内(<8.5°)不算', () => {
		const hit = bonificationReport(mkFacts((r) => {
			const jup = r.chart.objects.find((o) => o.id === 'Jupiter');
			jup.lon = 345; jup.sign = 'Pisces'; jup.signlon = 15;
		}));
		expect(hit.map((i) => i.text).join('|')).toContain('执矛');
		const burned = bonificationReport(mkFacts((r) => {
			const jup = r.chart.objects.find((o) => o.id === 'Jupiter');
			jup.lon = 350; jup.sign = 'Pisces'; jup.signlon = 20;   // 距日 4.9° → combust
		}));
		expect(burned.map((i) => i.text).join('|')).not.toContain('执矛');
	});
});

describe('面神像与五命点 almuten', () => {
	it('facePositions:上升白羊15°=第2面(日);月巨蟹7°=第1面(金);形像表 36 座全有', () => {
		const f = facePositions(mkFacts());
		expect(f[0].faceIndex).toBe(1);
		expect(f[0].ruler).toBe('sun');
		expect(f[1].faceIndex).toBe(0);
		expect(f[1].ruler).toBe('venus');
		expect(Object.keys(DECAN_IMAGES_AGRIPPA).length).toBe(12);
		Object.keys(DECAN_IMAGES_AGRIPPA).forEach((sg) => expect(DECAN_IMAGES_AGRIPPA[sg].length).toBe(3));
		expect(agrippaFaceImage('aries', 1).agrippa).toContain('女子');
	});
	it('后端带 Syzygy 对象 → almuten 走五命点并注明含产前朔望', () => {
		const r = buildMockResult();
		r.chart.objects.push({ id: 'Syzygy', lon: 100, sign: 'Cancer', signlon: 10, house: 'House4' });
		const j = runElection(r, 'marriage');
		const alm = j.sections.find((s) => s.key === 'almuten');
		const txt = alm.findings.map((f) => f.message).join('|');
		expect(txt).toContain('按五命点计');
		expect(txt).toContain('含产前朔望');
		expect(j.facts.almuten.points.length).toBe(5);
	});
});
