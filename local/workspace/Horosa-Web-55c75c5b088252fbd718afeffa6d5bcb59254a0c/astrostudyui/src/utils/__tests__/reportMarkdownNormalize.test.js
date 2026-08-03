import { normalizeMarkdown, closeStreamingInlineMd } from '../reportMarkdownNormalize';

describe('reportMarkdownNormalize', ()=>{
	test('句号紧贴的 ### 标题 → 前面插入空行（用户反馈的串行 bug）', ()=>{
		const out = normalizeMarkdown('每一波"伏"。。### 事业方向\n命宫癸干破军化禄');
		expect(out).toContain('\n\n### 事业方向');
		expect(out).not.toMatch(/。###/); // 不再有「句号紧贴###」
	});

	test('无标点但 3+ 个 # 的紧贴标题 → 也插入空行', ()=>{
		const out = normalizeMarkdown('命宫破军化禄入迁移### 财帛分析');
		expect(out).toContain('迁移\n\n### 财帛分析');
	});

	test('异常省略号 / 重复句号收缩', ()=>{
		expect(normalizeMarkdown('到此结束。。。。')).toBe('到此结束。。');
		expect(normalizeMarkdown('未完待续....')).toBe('未完待续...');
	});

	test('代码围栏 ``` 内的内容不被改动（围栏外照常修正）', ()=>{
		const src = '说明：\n```\nconst a = 1; // foo### bar\n```\n正文。。### 标题';
		const out = normalizeMarkdown(src);
		expect(out).toContain('foo### bar');   // 围栏内保持原样
		expect(out).toContain('\n\n### 标题');  // 围栏外仍被修正
	});

	test('C#/F# 等单 # 标识符不被误判为标题', ()=>{
		expect(normalizeMarkdown('他擅长 C# 和 F# 编程')).toBe('他擅长 C# 和 F# 编程');
	});

	test('4~6 级标题(####/#####)不被误拆成孤立 #（v1.22 回归——AI 真实用 #### 子标题）', ()=>{
		// 行首 #### 原样保留(不拆出单独 #)
		expect(normalizeMarkdown('#### 性别与干支格局\n此命为乾造')).toBe('#### 性别与干支格局\n此命为乾造');
		expect(normalizeMarkdown('##### 五级标题\n内容')).toBe('##### 五级标题\n内容');
		// 多个 #### 子标题之间不产生任何孤立 # 行
		const multi = normalizeMarkdown('#### A\n甲乙丙\n\n#### B\n丁戊己');
		expect((multi.match(/(^|\n)[ \t]*#{1,6}[ \t]*(\n|$)/g) || []).length).toBe(0);
		expect(multi).toContain('#### A');
		expect(multi).toContain('#### B');
		// 紧贴句末的 #### 整体另起,不拆 #
		const glued = normalizeMarkdown('上文结束。#### 新子段');
		expect(glued).toContain('#### 新子段');
		expect(glued).not.toMatch(/(^|\n)[ \t]*#[ \t]*(\n|$)/);
	});

	test('只有 # 没有文字的孤立行被清除', ()=>{
		expect(normalizeMarkdown('正文\n#\n更多')).toBe('正文\n\n更多');
		expect(normalizeMarkdown('段落一\n###\n段落二')).toBe('段落一\n\n段落二');
	});

	test('已正确换行的标题不重复加空行；普通/空文本原样返回', ()=>{
		expect(normalizeMarkdown('前言\n\n### 已在新行\n正文')).toBe('前言\n\n### 已在新行\n正文');
		expect(normalizeMarkdown('普通一段话，没有任何标题。')).toBe('普通一段话，没有任何标题。');
		expect(normalizeMarkdown('')).toBe('');
		expect(normalizeMarkdown(null)).toBe('');
	});

	test('~ / ～ 统一转短横线 -（防 GFM 删除线划掉年龄/年份范围）', ()=>{
		expect(normalizeMarkdown('当前大运 壬申 (25~34岁)')).toBe('当前大运 壬申 (25-34岁)');
		expect(normalizeMarkdown('大限 2～11 岁')).toBe('大限 2-11 岁'); // 全角 ～
		expect(normalizeMarkdown('2019~2028 年')).toBe('2019-2028 年');
	});

	test('代码围栏内的 ~ 不被替换（保护代码语义）', ()=>{
		const src = '正文 1~2\n```\nconst a = b ~ c;\n```\n正文 3~4';
		const out = normalizeMarkdown(src);
		expect(out).toContain('正文 1-2');   // 围栏外转
		expect(out).toContain('b ~ c');       // 围栏内保留
		expect(out).toContain('正文 3-4');
	});

	// [E5] 行内代码与 URL 中的 ~ 受占位保护(此前无差别替换,`a ~ b` 与 /~user 路径被改写)。
	test('行内代码/URL 中的 ~ 受保护,正文 ~ 照转', ()=>{
		expect(normalizeMarkdown('25~34岁 与 `a ~ b` 及 1～3年'))
			.toBe('25-34岁 与 `a ~ b` 及 1-3年');
		expect(normalizeMarkdown('见 https://x.cn/~user/p?a=1 与 5~8月'))
			.toBe('见 https://x.cn/~user/p?a=1 与 5-8月');
	});
});

// [E5] 流式软闭合:未闭合 **/`/``` 末尾补齐(仅渲染路径;settle 后原文重渲染自愈)。
describe('closeStreamingInlineMd 流式软闭合', ()=>{
	test('未闭合 ** 末尾补一枚;成对不动', ()=>{
		expect(closeStreamingInlineMd('结论是**必成')).toBe('结论是**必成**');
		expect(closeStreamingInlineMd('已**闭合**的段落')).toBe('已**闭合**的段落');
	});
	test('未闭合围栏补闭栏,围栏内记号不做行内补齐', ()=>{
		expect(closeStreamingInlineMd('```js\nconst a = 1;')).toBe('```js\nconst a = 1;\n```');
		expect(closeStreamingInlineMd('```\na ** b\n```\n正文')).toBe('```\na ** b\n```\n正文');
	});
	test('行内码未闭补一枚;行内码内的 ** 不算记号', ()=>{
		expect(closeStreamingInlineMd('看这段`half')).toBe('看这段`half`');
		expect(closeStreamingInlineMd('有`a ** b`的行内码')).toBe('有`a ** b`的行内码');
	});
	test('幂等与空输入', ()=>{
		const once = closeStreamingInlineMd('结论是**必成');
		expect(closeStreamingInlineMd(once)).toBe(once);
		expect(closeStreamingInlineMd('')).toBe('');
		expect(closeStreamingInlineMd(null)).toBe('');
	});
});
