// 六爻 AI 快照回归:之卦/互卦的六亲必须以「本卦之宫」五行论(京房纳甲,与中间栏显示一致)。
// 防 Win issue #30 回归:此前 AI 挂载/导出用变卦自身宫五行算六亲 → 与显示错位、误导 AI。
import { buildGuaSnapshotText } from '../GuaZhanMain';
import { getGua64, LiuQi } from '../../gua/GuaConst';
import { littleEndian } from '../../../utils/helper';

describe('六爻 AI 快照:之卦/互卦六亲按本卦宫(Win#30)', () => {
	test('LiuQi 表:本卦宫火 × 木爻 = 父母(生我);本卦宫水 × 木爻 = 子孙', () => {
		expect(LiuQi['火']['木']).toBe('父母');
		expect(LiuQi['水']['木']).toBe('子孙');
	});

	test('之卦六亲以本卦之宫论,而非变卦自身宫', () => {
		const liweihuo = [1, 0, 1, 1, 0, 1]; // 离为火(离宫·火)
		const g = getGua64(littleEndian(liweihuo));
		const idx = g && g.index;
		expect(idx === 0 || idx).toBeTruthy();
		// 上爻动 → 之卦 = 雷火丰(坎宫·水);其初爻纳甲=卯木
		const yao = liweihuo.map((v, i) => ({ value: v, change: i === 5, name: '', god: '' }));
		const txt = buildGuaSnapshotText({}, { currentGua: idx, yao, nongli: {}, guaDesc: {} });
		const block = txt.match(/之卦\(变卦\)逐爻[\s\S]*?第1爻：[^\n]*/);
		expect(block).toBeTruthy();
		// 卯木:本卦宫火 → 木生火 → 父母(正确,与显示一致);若误用变卦宫水 → 水生木 → 子孙(错)
		expect(block[0]).toMatch(/卯木父母/);
		expect(block[0]).not.toMatch(/卯木子孙/);
	});
});
