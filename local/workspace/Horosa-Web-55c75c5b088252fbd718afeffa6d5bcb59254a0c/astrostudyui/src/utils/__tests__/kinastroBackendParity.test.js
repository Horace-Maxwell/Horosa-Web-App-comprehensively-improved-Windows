// [MU] kinastro/kentang 后端技法 段头 parity 制度化守卫:
// 后端 pan.sections[].title 是这些技法段头的唯一真源(jest 跑不到后端),用 live 实抓金标 fixture
// (kinastroBackendSections.js,2026-07-12 对运行后端逐技法抓+备选项)断言「后端可产段头全集 ⊆ preset[key]」。
// 堵「preset 缩到后端产出之下 → 自定义过导出段的用户被静默删该技法真内容」。
// 与 aiExportRoundtrip 的前端 builder 逐键守卫互补(那侧覆盖 bazi/qimen/india/mundane… 等前端派生技法)。
import { AI_EXPORT_PRESET_SECTIONS } from '../aiExport';
const BACKEND = require('./fixtures/kinastroBackendSections');

// 归一同 aiExport(全角【】→半角、trim);preset 侧本就半角 [X],此处对齐防书写差。
const norm = (s) => `${s || ''}`.replace(/^【|】$/g, '').trim();

describe('[MU] kinastro/kentang 后端段头 ⊆ AI_EXPORT_PRESET_SECTIONS(live 实抓金标)', () => {
	Object.keys(BACKEND).forEach((key) => {
		test(`${key}:后端真产段头全部登记进 preset(缺一即自定义用户被静默删)`, () => {
			const preset = new Set((AI_EXPORT_PRESET_SECTIONS[key] || []).map(norm));
			expect(preset.size).toBeGreaterThan(0);
			const orphan = BACKEND[key].map(norm).filter((h) => !preset.has(h));
			expect(orphan).toEqual([]);
		});
	});

	test('fixture 覆盖全部 14 个后端技法键(防漏抓某技法)', () => {
		const covered = Object.keys(BACKEND).sort();
		const expected = ['beiji', 'cetian', 'chunzi', 'fendjing', 'huangji', 'jingjue', 'nanji',
			'qizhengkin', 'shaozi', 'shenyishu', 'taixuan', 'tieban', 'wuzhao', 'xianqin'].sort();
		expect(covered).toEqual(expected);
	});
});
