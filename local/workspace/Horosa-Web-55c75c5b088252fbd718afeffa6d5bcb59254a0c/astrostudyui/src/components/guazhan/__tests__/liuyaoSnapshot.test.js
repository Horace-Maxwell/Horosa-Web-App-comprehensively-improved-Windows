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

	test('liuyaoStructLines:火水未济(午月子日,第3爻动)含流派/卦序/用神/卦身/逐爻/动变', () => {
		const st = mkSt('火水未济', 2, nongli);
		const lines = liuyaoStructLines(st).join('\n');
		expect(lines).toContain('[断卦结构');
		expect(lines).toContain('卦序：离宫·三世');
		expect(lines).toContain('用神');
		expect(lines).toContain('卦身：申(不上卦)'); // 古籍§3.16
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
