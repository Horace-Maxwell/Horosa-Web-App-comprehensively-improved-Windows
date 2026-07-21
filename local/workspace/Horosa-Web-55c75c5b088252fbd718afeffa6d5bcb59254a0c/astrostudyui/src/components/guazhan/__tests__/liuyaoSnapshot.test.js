import { buildGuaSnapshotText, liuyaoStructLines } from '../GuaZhanMain';
import { Gua64, getGua64 } from '../../gua/GuaConst';

function mkSt(name, movingIdx, nongli, settings){
	getGua64(0); // 触发 initGua64,使 .index 就绪
	const g = Gua64.find((x) => x.name === name);
	const yao = g.value.map((v, i) => ({ value: v, change: i === movingIdx, god: null, name: g.yaoname[i] }));
	return { currentGua: Gua64.indexOf(g), yao, nongli: nongli || {}, guaDesc: {}, liuyaoSettings: settings || null };
}

describe('六爻断卦结构快照(WP-M)', () => {
	const nongli = { dayGanZi: '甲子', monthGanZi: '丙午', yearGanZi: '丙午', time: '子' };

	test('AI快照·断诀命中 同步显示层新增:日月生克/月建六神(monthNum 派生)/新派用神(WP-4/6/7)', () => {
		const { buildSnapshotAnalysis, duanJueLines } = require('../liuyaoSnapshotEx');
		const st = mkSt('火水未济', 2,
			{ dayGanZi: '癸巳', monthGanZi: '乙未', yearGanZi: '丙午', timeGanZi: '壬子', time: '子' },
			{ doctrine: true, shenshaEx: { on: true, set: null }, yueLiushen: true });
		const a = buildSnapshotAnalysis(st);
		expect(a).toBeTruthy();
		expect(a.riYue && a.riYue.perYao.length).toBe(6);
		// 🔴 monthNum 由月建乙未(未)派生=6 → yueLiuShenAnn 不再 null(此前 AI/显示两侧皆空转的死控)
		expect(a.yueLiuShenAnn).toBeTruthy();
		const lines = duanJueLines(a).join('\n');
		expect(lines).toContain('日月生克：');
		expect(lines).toContain('新派量化(用神');
	});

	test('AI快照·占类断语:断语库按占测事项【有界摘要】入 [占类断语](WP-6,总断门+命中门,不命中门排除)', () => {
		const { setDoctrine, doctrineSummaryFor } = require('../../gua/data/liuyaoDoctrineCache');
		const { zhanleiLines } = require('../liuyaoSnapshotEx');
		setDoctrine({
			'总断门第一': [{ source: '孙膑', text: '总断纲领句一' }, { source: '孙膑', text: '总断纲领句二' }],
			'求财门': [{ source: '鬼谷', text: '求财得财之句' }],
			'疾病门': [{ source: '扁鹊', text: '不相干之门' }],
		});
		const items = doctrineSummaryFor('wealth', null, { perMen: 4, cap: 20 });
		expect(items.some((i) => i.men.indexOf('总断') >= 0)).toBe(true);   // 总断门纲领必入
		expect(items.some((i) => i.men.indexOf('求财') >= 0)).toBe(true);   // 求财命中求财门
		expect(items.some((i) => i.men.indexOf('疾病') >= 0)).toBe(false);  // 求财不命中疾病门
		const lines = zhanleiLines({ settings: { askType: 'wealth' }, gua: { name: '乾为天' } }, '乾为天');
		expect(lines.some((l) => l.indexOf('断语·') >= 0)).toBe(true);
		expect(lines.some((l) => l.indexOf('鬼谷') >= 0)).toBe(true);       // 带出处
	});

	test('liuyaoStructLines:火水未济(午月子日,第3爻动)含流派/卦序/用神/卦身/逐爻/动变', () => {
		const st = mkSt('火水未济', 2, nongli);
		const lines = liuyaoStructLines(st).join('\n');
		expect(lines).toContain('[断卦结构');
		expect(lines).toContain('卦序：离宫·三世');
		expect(lines).toContain('用神');
		expect(lines).toContain('卦身：申(不上卦)'); // 古籍
		expect(lines).toContain('变卦：');
		// 动变行已表化(| 爻 | 本卦 | 变卦 | 标记 |):第3爻动 兄弟午火→妻财酉金 值零变化。
		expect(lines).toMatch(/\| 第3爻 \| 兄弟午火 \| 妻财酉金 \| — \|/);
	});

	test('buildGuaSnapshotText 追加结构段且既有段保留(零回归)', () => {
		const st = mkSt('火水未济', 2, nongli);
		const txt = buildGuaSnapshotText({}, st);
		// 既有段
		expect(txt).toContain('[卦象]');
		expect(txt).toContain('本卦：');
		expect(txt).toContain('[卦辞与断语]');
		// 新结构段
		expect(txt).toContain('[断卦结构');
		// 既有 typo 回潮哨兵:不得出现「妻才」
		expect(txt).not.toContain('妻才');
	});

	test('流派切换影响快照:增删卜易关卦身/神煞', () => {
		const def = liuyaoStructLines(mkSt('火水未济', 2, nongli, { school: 'default' })).join('\n');
		const zs = liuyaoStructLines(mkSt('火水未济', 2, nongli, { school: 'zengshan', guashen: false, shensha: { on: false } })).join('\n');
		expect(def).toContain('卦身：');
		expect(def).toContain('天乙贵人');          // 默认带神煞(逐爻表「神煞」列有值,天乙贵人为其一)
		expect(zs).not.toContain('卦身：');         // 增删卜易弃卦身
	});

	test('缺 nongli(挂载无头路径)不抛、仍出结构(无旺衰)', () => {
		const st = mkSt('乾为天', 0, {});
		const lines = liuyaoStructLines(st).join('\n');
		expect(lines).toContain('[断卦结构');
		expect(lines).toContain('卦序：乾宫·本宫');
	});

	test('未起卦(currentGua=null)→ 结构段为空,不污染既有快照', () => {
		expect(liuyaoStructLines({ currentGua: null, yao: [] })).toEqual([]);
	});
});
