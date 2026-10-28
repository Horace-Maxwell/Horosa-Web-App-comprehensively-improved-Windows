// AI 导出段名改过字形(风水「成員卦象」→「成员卦象」):
// ① 设置里存着旧名(顶栏「AI 导出设置」与各技法设置同一份)→ 读出来就是现名,勾选对得上现在的段;
// ② 升级前缓存的快照里段名还是旧写法 → 按现名过滤时不被当陌生段丢掉。
import { saveAIExportSettings, loadAIExportSettings, filterContentByWantedSections } from '../aiExport';

describe('AI 导出旧段名迁移', () => {
	beforeEach(()=>{ window.localStorage.clear(); });
	test('设置里存的旧名读出来是现名(去重)', () => {
		const saved = saveAIExportSettings({ version: 60, sections: { fengshui: ['成員卦象', '成员卦象'] } });
		expect(saved.sections.fengshui).toEqual(['成员卦象']);
		expect(loadAIExportSettings().sections.fengshui).toEqual(['成员卦象']);
	});
	test('升级前缓存的快照:旧写法的段按现名勾选照样留下,没勾的照样滤掉', () => {
		const content = '[成員卦象]\n乾为父\n\n[其他段]\n内容';
		expect(filterContentByWantedSections(content, new Set(['成员卦象']))).toBe('[成員卦象]\n乾为父');
		expect(filterContentByWantedSections(content, new Set(['其他段']))).toBe('[其他段]\n内容');
	});
	test('印占「分盘吉位」段名改正(Vaiśeṣikāṁśa 吉位计数,非 Viṃśopaka 20 分力):旧名设置与旧快照都按现名认', () => {
		const saved = saveAIExportSettings({ version: 60, sections: { indiachart: ['分盘吉位 Vimśopaka', 'Vimśopaka 分盘 20 分力'] } });
		expect(saved.sections.indiachart).toEqual(['分盘吉位 Vaiśeṣikāṁśa', 'Vimśopaka 分盘 20 分力']);
		const content = '[分盘吉位 Vimśopaka]\n木星 六4\n\n[Vimśopaka 分盘 20 分力]\n木 12';
		expect(filterContentByWantedSections(content, new Set(['分盘吉位 Vaiśeṣikāṁśa']))).toBe('[分盘吉位 Vimśopaka]\n木星 六4');
	});
});
