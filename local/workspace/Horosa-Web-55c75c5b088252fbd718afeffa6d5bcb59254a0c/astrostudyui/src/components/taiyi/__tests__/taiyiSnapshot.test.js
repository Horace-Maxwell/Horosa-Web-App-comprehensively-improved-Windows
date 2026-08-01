// 太乙 AI 快照(buildTaiyiSnapshotLines)补新字段哨兵 + 流派覆盖入快照(E1/E2)。
// buildTaiyiSnapshotText → buildTaiyiSnapshotLines 是 live AI 快照真源;新派生(纳音/十精/五子元/六合)+
// 格局九式 + _schoolNote 必进快照,保证 AI 与 UI 同源。
import { buildTaiyiSnapshotLines } from '../core/TaiYiCore';
import { applyTaiyiSchool } from '../core/taiyiSchool';

function mkPan(over){
	return {
		dateStr: '2026-07-22', timeStr: '11:36', taiyiPalace: '艮', taiyiNum: 3, skyeyes: '申', sf: '午', jigod: '申', se: '坤',
		homeCal: 16, awayCal: 40, setCal: 22, homeGeneral: 6, awayGeneral: 4, homeVGen: 8, awayVGen: 2,
		homeGeneralPalace: '酉', awayGeneralPalace: '卯', homeVGenPalace: '子', awayVGenPalace: '午',
		kingbase: '巳', officerbase: '子', pplbase: '巳', wufuNum: 1, bigyoNum: 3, smyoNum: 3, hegod: '未', accNum: 10155943,
		taishui: '午', kook: { num: 55, year: '阳55局' }, ganzhi: { year: '丙午', month: '甲午', day: '丁酉', time: '丙午' },
		jiyuan: '第一纪甲子元', tn: 0, fgd: '子', skyyi: '子', earthyi: '午', zhifu: '子', flyfu: '午',
		wufuPalace: '乾', kingfu: '子', taijun: '午', flybird: '子', threewindPalace: '子', fivewindPalace: '午', eightwindPalace: '子',
		bigyoPalace: '艮', smyoPalace: '艮', ...(over || {}),
	};
}

describe('太乙 AI 快照补齐(E1/E2)', () => {
	test('buildTaiyiSnapshotLines 含 纳音/五子元/合神六合/十精', () => {
		const lines = buildTaiyiSnapshotLines(mkPan({}));
		const text = lines.join('\n');
		expect(text).toMatch(/纳音：.*·/);
		expect(text).toMatch(/五子元：.*元/);
		expect(text).toMatch(/合神六合：合神未·六合午/);
		expect(text).toMatch(/十精\(二目·八将\)：文昌·申/);
	});
	test('格局九式入快照(始击午·宫2 与客大将4对宫3? 用同宫案) 击式', () => {
		// 始击午(宫2)与主大将2 同宫 → 击式必现
		const lines = buildTaiyiSnapshotLines(mkPan({ sf: '午', homeGeneral: 2 }));
		expect(lines.join('\n')).toMatch(/格局：.*击/);
	});
	test('🔴 流派覆盖入快照:非默认 school 经 applyTaiyiSchool → _schoolNote → 快照含「流派覆盖」', () => {
		// E1 修复的语义:regenerate 侧须 applyTaiyiSchool,覆盖后 pan._schoolNote 进快照。
		const base = mkPan({ ganzhi: { year: '丙午' }, kook: { num: 55, year: '阳55局' } });
		const covered = applyTaiyiSchool(base, { jishen: '逆' }).pan;
		expect(covered._schoolNote).toBeTruthy();
		const lines = buildTaiyiSnapshotLines(covered);
		expect(lines.join('\n')).toMatch(/流派覆盖：.*计神/);
	});
	test('默认 school:快照无「流派覆盖」行(零回归)', () => {
		const lines = buildTaiyiSnapshotLines(mkPan({}));
		expect(lines.join('\n')).not.toMatch(/流派覆盖/);
	});
});
