// [E11] 行内强调记号修复金标(repairInlineEmphasis)。
// 用户实测反馈「AI 报告很多时候没有正常加粗」,其中一类根因是 LLM 产出的 `**` 记号带畸形:
// 记号内侧带空格 / 用了下划线 / 全角星号 / 跨行 / 落单半截 —— 四条消费链对它们表现各异,
// 轻则不加粗、重则把字面星号原样渲出。本组用例是「必须修」与「绝不能动」的双向锚。
import { repairInlineEmphasis, normalizeMarkdown } from '../reportMarkdownNormalize';
import { mdInlineSegments } from '../aiExportDocModel';

const boldOf = (s)=>{
	const out = [];
	let cur = '';
	mdInlineSegments(s).forEach((g)=>{ if(g.bold){ cur += g.text; } else if(cur){ out.push(cur); cur = ''; } });
	if(cur){ out.push(cur); }
	return out;
};

describe('[E11] repairInlineEmphasis 必须修的五类畸形', ()=>{
	test('① 记号内侧空格(三种形态)—— CommonMark 下本来完全不成粗体', ()=>{
		expect(repairInlineEmphasis('** 重点 **说明')).toBe('**重点** 说明');
		expect(repairInlineEmphasis('** 重点**说明')).toBe('**重点**说明');
		expect(repairInlineEmphasis('**重点 **说明')).toBe('**重点** 说明');
		expect(boldOf(repairInlineEmphasis('** 重点 **说明'))).toEqual(['重点']);
	});
	test('② `__中文__` 中文词内下划线 → 转 `**`(下划线不允许词内强调)', ()=>{
		expect(repairInlineEmphasis('命宫__天机__化禄')).toBe('命宫**天机**化禄');
	});
	test('③ 全角星号成对 → 半角', ()=>{
		expect(repairInlineEmphasis('＊＊全角＊＊内容')).toBe('**全角**内容');
	});
	test('④ 跨行粗体 → 逐行各自闭合(导出侧三条链都是逐行解析,不拆就断)', ()=>{
		expect(repairInlineEmphasis('**上半\n下半**')).toBe('**上半**\n**下半**');
	});
	test('⑤ 落单一枚 `**`:引导词形态闭在冒号前 / 短尾闭在行尾 / 长尾剥记号', ()=>{
		expect(repairInlineEmphasis('**事业方向：宜商贸,后续还有很多话要说'))
			.toBe('**事业方向**：宜商贸,后续还有很多话要说');
		expect(repairInlineEmphasis('**短结论')).toBe('**短结论**');
		const longTail = '**' + '这是一段很长很长的正文而且完全没有闭合记号'.repeat(2);
		expect(repairInlineEmphasis(longTail).indexOf('**')).toBe(-1);   // 宁可不加粗,也不让整段变粗
	});
});

describe('[E11] 负锚:本来就对的一律逐字节不动', ()=>{
	const KEEP = [
		'**A** 与 **B** 并见',
		'- **事业方向**：宜商贸',
		'关键窗口 **2028年公历8-9月** 到来',
		'公式 a*b*c 的乘号',
		'注意 5*3=15 与 **重点** 同段',
		'***粗斜***内容',
		'调用 `__init__` 方法',                 // 行内码保护:标识符不得被当成强调记号
		'路径 `a ** b` 保持',
		'2**3**4 幂次',
		'| 维度 | 判读 |\n|---|---|\n| **命宫** | **吉** |',
		'- 条目\n  **续段**：内容',              // 列表续行的缩进不得被吃掉
		'普通中文没有任何记号',
		'**（一）**总论与 **「核心」**要点',
	];
	KEEP.forEach((s)=>{
		test(`不动:${JSON.stringify(s).slice(0, 42)}`, ()=>{ expect(repairInlineEmphasis(s)).toBe(s); });
	});
	test('空/异常输入安全', ()=>{
		expect(repairInlineEmphasis('')).toBe('');
		expect(repairInlineEmphasis(null)).toBe('');
		expect(repairInlineEmphasis(undefined)).toBe('');
	});
	test('幂等:修过一次再修输出相同', ()=>{
		const src = '** 重点 **与 __要点__ 和 **落单';
		const once = repairInlineEmphasis(src);
		expect(repairInlineEmphasis(once)).toBe(once);
	});
});

// [E11-N] 嵌套加粗 —— 真机 A/B 实测(deepseek 18 篇)抓到的头号「写了加粗却不粗」病因。
// 病根是本仓规则自身:②判断句加粗 与 ③一切时间窗加粗,在「判断句里含时间窗」时相撞。
// CommonMark 无 `**` 嵌套 ⇒ 时间窗反而不粗、顿号被加粗。处置=摘最外层那对,留内层时间窗。
describe('[E11-N] 解嵌套加粗:留内层时间窗,摘外层整句', ()=>{
	const boldOf = (s)=>{ const out = []; let cur = '';
		mdInlineSegments(s).forEach((g)=>{ if(g.bold){ cur += g.text; } else if(cur){ out.push(cur); cur = ''; } });
		if(cur){ out.push(cur); } return out; };

	test('🔴 真实模型产出:修前时间窗不粗且顿号被加粗,修后恰好反过来', ()=>{
		const raw = '**唯需注意火旺之时（如 **2026(丙午)年**、**2027(丁未)年**）官星受制。**';
		expect(boldOf(raw)).toEqual(['唯需注意火旺之时（如 ', '、', '）官星受制。']);   // 病态实证
		expect(boldOf(repairInlineEmphasis(raw))).toEqual(['2026(丙午)年', '2027(丁未)年']);
	});
	test('单个内层时间窗同样解开', ()=>{
		expect(boldOf(repairInlineEmphasis('**综上,**2028(戊申)年**后金水进气。**')))
			.toEqual(['2028(戊申)年']);
	});
	test('嵌套解开后不再有嵌套(幂等,再修不动)', ()=>{
		const raw = '**判断（如 **2026年**、**2027年**）收束。**';
		const once = repairInlineEmphasis(raw);
		expect(repairInlineEmphasis(once)).toBe(once);
		expect(/\*\*[^*\n]*\*\*[^*\n]*\*\*[^*\n]*\*\*/.test(once) && once.indexOf('**') === 0).toBe(false);
	});

	// 负锚:顺序加粗与嵌套加粗的记号枚数完全相同(`**a** b **c**` vs `**a **b** c**`),
	// 只能靠 flanking(记号前/后是否紧贴非空白)区分 —— 判错就会把正常的连续加粗拆掉。
	test('🔴 顺序加粗(记号枚数相同)绝不能被误判成嵌套', ()=>{
		['**甲**、**乙**、**丙**', '前置 **A** 中间 **B** 后置', '**a**b**c**',
			'- **事业方向**：宜商贸,关键窗口 **2028年**', '**整句加粗没有内层记号。**',
		].forEach((s)=>expect(repairInlineEmphasis(s)).toBe(s));
	});
	test('行内码里的记号不参与嵌套判定(占位保护在先)', ()=>{
		const s = '`x = **a **b** c**` 与 **真粗**';
		expect(repairInlineEmphasis(s)).toBe(s);
	});
	test('奇数枚记号走既有的半截补全,不进解嵌套', ()=>{
		expect(repairInlineEmphasis('**未闭合的半截')).toBe('**未闭合的半截**');
	});
});

describe('[E11] 已挂进 normalizeMarkdown(渲染与四种导出的共同上游)', ()=>{
	test('normalizeMarkdown 会带上记号修复', ()=>{
		expect(normalizeMarkdown('** 重点 **说明')).toContain('**重点**');
	});
	test('代码围栏内一律不动(围栏由 normalizeMarkdown 切分挡在外面)', ()=>{
		const src = '正文 ** 重点 ** 在此\n\n```\nx = ** 不该动 **\n```\n';
		const out = normalizeMarkdown(src);
		expect(out).toContain('**重点**');
		expect(out).toContain('x = ** 不该动 **');
	});
});
