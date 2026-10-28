import { classifyQuestion, referencesSpecificCase, STARTER_PROMPTS } from '../aiAnalysisStarterPrompts';
import { HELP_DOCS, buildSoftwareHelpContext } from '../aiAnalysisHelpDocs';

describe('classifyQuestion', ()=>{
	test('软件用法类: 导出 → software/export', ()=>{
		expect(classifyQuestion('怎么导出 PDF / docx？')).toEqual({ category: 'software', helpKey: 'export' });
	});

	test('软件用法类: 大限/流年怎么看 → software/concepts.daxian', ()=>{
		expect(classifyQuestion('大限 / 流年怎么看？')).toEqual({ category: 'software', helpKey: 'concepts.daxian' });
	});

	test('软件用法类: 紫微12宫含义 → software/concepts.ziwei-palaces', ()=>{
		expect(classifyQuestion('紫微 12 宫分别代表什么？')).toEqual({ category: 'software', helpKey: 'concepts.ziwei-palaces' });
	});

	test('软件用法类: 挂载 → software/mount', ()=>{
		expect(classifyQuestion('怎么挂载案例来分析？')).toEqual({ category: 'software', helpKey: 'mount' });
	});

	test('软件用法类: 无挂载时的静态用法示例 → software/usage', ()=>{
		expect(classifyQuestion('先帮我说明这套AI分析的用法')).toEqual({ category: 'software', helpKey: 'usage' });
		expect(classifyQuestion('介绍一下星阙都支持哪些术数')).toEqual({ category: 'software', helpKey: 'usage' });
		expect(classifyQuestion('我想分析命盘，下一步该怎么做')).toEqual({ category: 'software', helpKey: 'usage' });
	});

	test('命/事类: 问具体命主 → case-required', ()=>{
		expect(classifyQuestion('帮我分析这个命主的事业财运').category).toBe('case-required');
		expect(classifyQuestion('这个命主今年流年怎样').category).toBe('case-required');
		expect(classifyQuestion('这张事盘的吉凶判断').category).toBe('case-required');
	});

	test('referencesSpecificCase: 仅明确指向具体案例时 true, 泛主题词不误判', ()=>{
		expect(referencesSpecificCase('这张盘的事业如何')).toBe(true);
		expect(referencesSpecificCase('帮我分析这个命主的财运')).toBe(true);
		expect(referencesSpecificCase('我的命格适合什么职业')).toBe(true);
		// 泛主题/how-to 不应被当成「具体命/事」拦截
		expect(referencesSpecificCase('财运怎么算')).toBe(false);
		expect(referencesSpecificCase('大运是什么意思')).toBe(false);
		expect(referencesSpecificCase('')).toBe(false);
	});

	test('空/泛化 → general', ()=>{
		expect(classifyQuestion('').category).toBe('general');
		expect(classifyQuestion('你好').category).toBe('general');
		expect(classifyQuestion(null).category).toBe('general');
	});

	test('STARTER_PROMPTS 的 helpKey 都能在 HELP_DOCS 找到', ()=>{
		STARTER_PROMPTS.forEach((p)=>{
			expect(typeof HELP_DOCS[p.helpKey]).toBe('string');
		});
	});

	test('buildSoftwareHelpContext: 已知 key 返回对应文档, 未知 key 回退 usage', ()=>{
		expect(buildSoftwareHelpContext('export')).toContain(HELP_DOCS.export.slice(0, 8));
		expect(buildSoftwareHelpContext('不存在的key')).toContain(HELP_DOCS.usage.slice(0, 10));
	});
});
