// v1.21 落地页「建议问题」分类。
//
// AI 分析空状态会展示几个建议问题(AI 生成或静态兜底)。点击时需要判断：
//  - software     : 问软件用法/功能(怎么导出、大限怎么看、12宫含义、怎么挂载…) → 注入帮助文档让 AI 据实回答。
//  - case-required: 问某个具体命主/事件(这张盘、今年财运、事业婚姻…) → 需要先挂载案例才能答。
//  - general      : 其它(已挂载时正常发送即可)。
// 用关键词规则判断，不调 LLM（省 token、即时、可单测）。

// 软件用法类：命中任一规则即判为 software，并给出对应 helpKey（指向 HELP_DOCS）。
const SOFTWARE_PATTERNS = [
	{ re: /(重点标注|重点加粗|加粗|写作规范|结论先行|骨架|判断分层|置信度|措辞|统稿|形态自检|生成前校准|速览页)/, helpKey: 'report.writing' },
	{ re: /(导出|下载|保存为|pdf|docx|word|生成报告|报告怎么)/i, helpKey: 'export' },
	{ re: /(怎么|如何|怎样|怎么样).{0,4}挂载|挂载.{0,4}(案例|命盘|事盘)|在哪.{0,6}挂载|怎么.{0,4}(选择|加载|添加).{0,4}(案例|资料)/, helpKey: 'mount' },
	{ re: /(大限|大运|流年|流月|运限|行运).{0,6}(怎么看|如何看|怎么算|怎样看|是什么|含义|代表什么)/, helpKey: 'concepts.daxian' },
	{ re: /(紫微|十二宫|12宫|宫位).{0,6}(含义|是什么|怎么看|都有哪些|哪些|分别|代表什么)/, helpKey: 'concepts.ziwei-palaces' },
	{ re: /(怎么用|怎样用|如何使用|使用说明|用法|这套.{0,4}分析|功能介绍|介绍一下|支持哪些|都支持|能做什么|有哪些功能|下一步|新手|入门|怎么开始|从哪开始)/, helpKey: 'usage' },
];

// 命/事类：问某个具体命主/事件的结果，需要挂载案例。
const CASE_PATTERN = /(这张|这个命|这个盘|此命|此人|该命主|命主|我的命|我的盘|本命|这件事|这次|今年|明年|后年|去年|何时|什么时候|应期|运势|财运|事业|婚姻|婚恋|姻缘|感情|健康|疾病|学业|考试|官司|搬家|置业|吉凶|用神|格局|配偶|子女|父母|六亲|这个事盘|这张事盘)/;

// 「明确指向某个具体案例」的指示词 —— 比 CASE_PATTERN 更严格,只认指代某盘/某人的 deixis,
// 不含「财运/事业」等泛主题词。用于「手动输入但未挂载案例」时是否弹挂载提醒,避免误拦泛问。
const SPECIFIC_CASE_REF = /(这张|这个命|这个盘|这张盘|此命|此人|该命主|这位|本命主|命主的|我的命|我的盘|我这盘|本命盘|这件事|这次事|这个事盘|这张事盘|帮我看看我|分析我的|看我的)/;
// 文本是否明确指向某个具体命主/事件(需要挂载案例才能答)。
export function referencesSpecificCase(text){
	return SPECIFIC_CASE_REF.test(`${text || ''}`);
}

// 静态建议问题(无挂载时也可点；都是软件用法类，点击即带帮助回答)。
export const STARTER_PROMPTS = [
	{ text: '怎么导出 PDF / docx 报告？', category: 'software', helpKey: 'export' },
	{ text: '大限 / 流年怎么看？', category: 'software', helpKey: 'concepts.daxian' },
	{ text: '紫微 12 宫分别代表什么？', category: 'software', helpKey: 'concepts.ziwei-palaces' },
	{ text: '怎么挂载案例来分析？', category: 'software', helpKey: 'mount' },
];

// 判断一个问题的类别。返回 { category: 'software'|'case-required'|'general', helpKey?: string }。
export function classifyQuestion(text){
	const s = `${text || ''}`.trim();
	if(!s){
		return { category: 'general' };
	}
	for(let i = 0; i < SOFTWARE_PATTERNS.length; i++){
		if(SOFTWARE_PATTERNS[i].re.test(s)){
			return { category: 'software', helpKey: SOFTWARE_PATTERNS[i].helpKey };
		}
	}
	if(CASE_PATTERN.test(s)){
		return { category: 'case-required' };
	}
	return { category: 'general' };
}

export default classifyQuestion;
