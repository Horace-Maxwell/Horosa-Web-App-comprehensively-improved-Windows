// [Q-446/T-409] 分至整年快照:① 每节气恒出 [X3D盘] 段(指引段,不重复盘数据);② [X星盘] 段与「当前页签」快照同名段同口径(全口径 buildAstroSnapshotContent)。
import { buildJieQiSnapshotText, buildJieQiCurrentSnapshotText } from '../JieQiChartsMain';
import { AI_EXPORT_PRESET_SECTIONS } from '../../../utils/aiExport';

function mkChart(lonBase){
	const houses = Array.from({ length: 12 }, (_, i) => ({ id: `House${i + 1}`, lon: (lonBase + i * 30) % 360, sign: 'Aries', signlon: (lonBase + i * 30) % 30 }));
	return { params: { birth: '2026/03/20 17:46:00', zone: '+08:00', lon: '119e19', lat: '26n04' }, chart: {
		houses, objects: [{ id: 'Sun', lon: lonBase + 5, sign: 'Aries', signlon: 5, house: 'House1', lonspeed: 1 }, { id: 'Moon', lon: lonBase + 95, sign: 'Cancer', signlon: 5, house: 'House4', lonspeed: 13 }],
		angles: [{ id: 'Asc', lon: lonBase, sign: 'Aries', signlon: 0 }],
	} };
}
const RESULT = { charts: { 春分: mkChart(0), 夏至: mkChart(90) } };
const JIEQIS = ['春分', '夏至'];

describe('分至 整年快照 · 3D 段与口径统一', () => {
	const year = buildJieQiSnapshotText(RESULT, null, JIEQIS, []);
	it('每节气三段齐:[X星盘]/[X宿盘]/[X3D盘];3D 段为指引段且全部段名已登记 preset', () => {
		JIEQIS.forEach((t) => {
			expect(year).toContain(`[${t}星盘]`);
			expect(year).toContain(`[${t}宿盘]`);
			expect(year).toContain(`[${t}3D盘]\n3D 盘为「${t}星盘」同一节气盘的三维视图`);
		});
		const heads = year.match(/^\[[^\]]+\]$/gm).map((h) => h.slice(1, -1));
		heads.forEach((h) => expect(AI_EXPORT_PRESET_SECTIONS.jieqi).toContain(h));
	});
	it('[X星盘] 正文 == 当前页签快照同名段正文(同一 builder、同一口径)', () => {
		const sec = (txt, head, nextHead) => { const i = txt.indexOf(head) + head.length; const j = nextHead ? txt.indexOf(nextHead, i) : txt.length; return txt.slice(i, j < 0 ? txt.length : j).trim(); };
		const yearSpring = sec(year, '[春分星盘]', '[春分宿盘]');
		const cur = buildJieQiCurrentSnapshotText('春分', RESULT, null, JIEQIS, []);
		expect(cur.startsWith('[春分星盘]')).toBe(true);
		expect(yearSpring).toBe(sec(cur, '[春分星盘]', null));
		expect(yearSpring.length).toBeGreaterThan(80);
	});
});

// [Q-224/T-180] 整年快照补 [二十四节气] 段(交节时刻+四柱)与「未拉取四盘」明示;段名已登记 preset。
describe('分至 整年快照 · [二十四节气] 段与未拉取明示', () => {
	const jieqi24 = [
		{ ord: 1, jieqi: '立春', time: '2026-02-04 04:02', bazi: { fourColumns: { year: { ganzi: '丙午' }, month: { ganzi: '庚寅' }, day: { ganzi: '甲子' }, time: { ganzi: '丙寅' } } } },
		{ ord: 2, jieqi: '雨水', time: '2026-02-18 23:52', fourColumns: { year: { ganzi: '丙午' }, month: { ganzi: '庚寅' }, day: { ganzi: '戊寅' }, time: { ganzi: '壬子' } } },
	];
	it('默认页签(四盘未拉取)导出:有 [二十四节气] 表 + 未拉取说明,不再只剩参数头', () => {
		const txt = buildJieQiSnapshotText({ jieqi24, charts: {} }, null, ['春分', '夏至', '秋分', '冬至'], []);
		expect(txt).toContain('[二十四节气]');
		expect(txt).toContain('| 立春 | 2026-02-04 04:02 | 丙午 | 庚寅 | 甲子 | 丙寅 |');
		expect(txt).toContain('| 雨水 | 2026-02-18 23:52 | 丙午 | 庚寅 | 戊寅 | 壬子 |');
		expect(txt).toContain('说明：春分、夏至、秋分、冬至的星盘 / 宿盘尚未拉取');
		expect(AI_EXPORT_PRESET_SECTIONS.jieqi).toContain('二十四节气');
	});
	it('已拉取的节气不列入未拉取说明;无 jieqi24 时不出该段(零回归)', () => {
		const txt = buildJieQiSnapshotText({ jieqi24, charts: { 春分: mkChart(0) } }, null, ['春分', '夏至'], []);
		expect(txt).toContain('说明：夏至的星盘 / 宿盘尚未拉取');
		expect(txt).not.toContain('春分的星盘');
		const bare = buildJieQiSnapshotText(RESULT, null, JIEQIS, []);
		expect(bare).not.toContain('[二十四节气]');
		expect(bare).not.toContain('尚未拉取');
	});
});
