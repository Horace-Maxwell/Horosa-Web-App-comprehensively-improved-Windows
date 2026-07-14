// 黄历四子 tab（农历/老黄历/通书择日/日子馆）AI 挂载 + 导出别名同步守卫。
// 病根：黄历从 1 tab 扩为 4 tab 后，AI 分析挂载（getTechniqueAliasList）与 AI 导出
// （getModuleAliasList）若不把三子模块并入 calendar 别名集，则通书/日子馆快照永不被 AI 读到。
// 此守卫锁死两函数的 calendar → {calendar-huangli, calendar-tongshu, calendar-rizi} 映射。
import { getTechniqueAliasList } from '../aiAnalysisContext';
import { getModuleAliasList, AI_EXPORT_PRESET_SECTIONS } from '../aiExport';

const SUB_MODULES = ['calendar-huangli', 'calendar-tongshu', 'calendar-rizi'];

describe('黄历四子 tab · AI 挂载别名（getTechniqueAliasList）', () => {
	test('calendar 别名并入老黄历/通书择日/日子馆三子模块', () => {
		const aliases = getTechniqueAliasList('calendar');
		expect(aliases).toContain('calendar');
		SUB_MODULES.forEach((m)=>{ expect(aliases).toContain(m); });
	});
	test('子模块自身别名不反向污染（各自独立）', () => {
		// 老黄历自身别名不应把通书/日子馆并入（避免交叉挂载串味）。
		const hl = getTechniqueAliasList('calendar-huangli');
		expect(hl).toContain('calendar-huangli');
		expect(hl).not.toContain('calendar-rizi');
	});
});

describe('黄历四子 tab · AI 导出别名（getModuleAliasList）', () => {
	test('calendar 导出别名并入三子模块', () => {
		const aliases = getModuleAliasList('calendar');
		expect(aliases).toContain('calendar');
		SUB_MODULES.forEach((m)=>{ expect(aliases).toContain(m); });
	});
});

describe('黄历四子 tab · AI 导出分区预设（AI_EXPORT_PRESET_SECTIONS）', () => {
	test('calendar 预设含四子 tab 全部分区段头', () => {
		const preset = AI_EXPORT_PRESET_SECTIONS.calendar;
		expect(Array.isArray(preset)).toBe(true);
		// 关键分区段头须在预设内（农历月历 / 老黄历日课 / 通书择日 / 日子馆吉日榜）。
		['当月月历', '今日宜忌', '值神值宿', '时辰吉凶', '通书择日', '日子馆·个性化择日', '当事人八字'].forEach((h)=>{
			expect(preset).toContain(h);
		});
		expect(preset.length).toBeGreaterThanOrEqual(12);
	});
});
