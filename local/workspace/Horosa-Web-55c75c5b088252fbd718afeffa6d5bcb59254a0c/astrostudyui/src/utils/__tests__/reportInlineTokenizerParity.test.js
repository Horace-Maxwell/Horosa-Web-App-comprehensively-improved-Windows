// [E11] 行内解析四链 parity 金标。
//
// 改版前四条链各养一份 `\*\*(.+?)\*\*` 正则,能力互不相同(转义不认、嵌套不认、删除线不认)
// ⇒ 应用内看到的加粗、docx 里的加粗、PDF 里的加粗、导出 HTML 里的加粗**可以不一样**。
// 本组用例把「同一段文字,四条链认出的加粗集合必须完全相同」钉死。
//   ① marked          —— 应用内详情页(aiMarkdownRender)
//   ② mdInlineSegments —— 矢量 PDF / 样式化 PDF(唯一 tokenizer)
//   ③ mdInlineToRuns   —— docx(必须调用 ②,不得自养正则)
//   ④ inlineMd         —— 导出 HTML / 打印 / 栅格 PDF(必须调用 ②,不得自养正则)
import fs from 'fs';
import path from 'path';
import { mdInlineSegments } from '../aiExportDocModel';
import { repairInlineEmphasis } from '../reportMarkdownNormalize';

// 🔴 jest 里 `import 'marked'` 拿不到可用的库:umi-test 捆绑的 jest file transformer 把
// marked 的 dist 当资产处理(与 docx/three 同款病理,见 test/docxJestShim.js 头注),
// `marked.setOptions` 恒 undefined —— aiMarkdownRender 正是因此才带能力守卫。
// 本例要的正是「marked 真实产出」这个对照物,故照 docxJestShim 的办法读 UMD 源码按 CJS 求值。
// 只在本文件生效,不动全局 moduleNameMapper(免得让其它套件里本来惰性的 marked 突然活过来)。
const marked = (()=>{
	// eslint-disable-next-line global-require
	const fs = require('fs');
	// eslint-disable-next-line global-require
	const path = require('path');
	const src = fs.readFileSync(path.resolve(__dirname, '../../../node_modules/marked/lib/marked.umd.js'), 'utf8');
	const mod = { exports: {} };
	// eslint-disable-next-line no-new-func
	new Function('exports', 'module', 'require', src)(mod.exports, mod, require);
	const m = mod.exports.marked || mod.exports.default || mod.exports;
	m.setOptions({ gfm: true, breaks: true, headerIds: false, mangle: false });
	return m;
})();

const CASES = [
	'**甲**：乙*丙*`丁`戊',
	'- **事业方向**：宜商贸,应期在**2027(丁未)年**。',
	'**A** 与 **B** 并见',
	'***粗斜***内容',
	'**多层`代码`混排** 说明',
	'关键窗口 **2028年公历8-9月** 到来',
	'**（一）**总论与 **「核心」**要点',
	'2**3**4 幂次',
	'转义 \\*不是记号\\* 与 **真粗**',
	'**注意：**这是正文',
	'**《易经》**有云',
	'**吉**、**凶**并见',
	'公式 a*b*c',
	'普通中文',
	'**结论**：见 [附录](#a) 链接',
	'** 记号内侧带空格 **也要一致',
	// [E11-N] 真机 A/B(deepseek 实跑 18 篇)抓到的形状:判断句加粗 + 句内时间窗又加粗 = 嵌套。
	// 修复前四链在此**真的不一致**(marked 认第一个内层 <strong>,mdInlineSegments 不认),
	// 是本组唯一一条从真实模型输出里捞回来的用例 —— 也是「写了加粗却不粗」的头号病因。
	'**唯需注意火旺之时（如 **2026(丙午)年**、**2027(丁未)年**）官星受制。**',
	'**综上,**2028(戊申)年**后金水进气。**',
];

const boldFromMarked = (s)=>{
	const out = [];
	const html = marked.parseInline(s);
	const re = /<strong>([\s\S]*?)<\/strong>/g;
	let m;
	while((m = re.exec(html))){
		out.push(m[1].replace(/<[^>]+>/g, '')
			.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
	}
	return out;
};
const boldFromTokenizer = (s)=>{
	const out = [];
	let cur = '';
	mdInlineSegments(s).forEach((g)=>{ if(g.bold){ cur += g.text; } else if(cur){ out.push(cur); cur = ''; } });
	if(cur){ out.push(cur); }
	return out;
};

describe('[E11] 四链行内解析 parity', ()=>{
	CASES.forEach((raw)=>{
		test(`加粗集合一致:${JSON.stringify(raw).slice(0, 40)}`, ()=>{
			// 报告链的真实上游会先跑记号修复,parity 契约建立在修复之后
			const s = repairInlineEmphasis(raw);
			expect(boldFromTokenizer(s)).toEqual(boldFromMarked(s));
		});
	});
	test('记号一律被消化:分段拼回 = 原文剥掉记号(星号/反引号绝不字面落产物)', ()=>{
		expect(mdInlineSegments('- **事业方向**：宜商贸').map((g)=>g.text).join(''))
			.toBe('- 事业方向：宜商贸');
		expect(mdInlineSegments('a \\*b\\* c').map((g)=>g.text).join('')).toBe('a *b* c');
	});
	test('新增能力:粗斜 / 删除线 / 转义 / 嵌套', ()=>{
		expect(mdInlineSegments('***X***')).toEqual([{ text: 'X', bold: true, em: true }]);
		expect(mdInlineSegments('~~废~~留')).toEqual([{ text: '废', del: true }, { text: '留' }]);
		expect(mdInlineSegments('**多层`码`混**')).toEqual([
			{ text: '多层', bold: true }, { text: '码', bold: true, code: true }, { text: '混', bold: true },
		]);
	});
});

describe('[E11] 单源纪律:docx / 导出 HTML 两端不得再自养 `**` 正则', ()=>{
	const read = (rel)=>fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
	test('docxCommon.mdInlineToRuns 走 mdInlineSegments', ()=>{
		const src = read('docxCommon.js');
		expect(src).toContain("import { mdInlineSegments } from './aiExportDocModel'");
		expect(src.includes('/\\*\\*(.+?)\\*\\*|')).toBe(false);   // 负锚:旧正则不得复活
	});
});
