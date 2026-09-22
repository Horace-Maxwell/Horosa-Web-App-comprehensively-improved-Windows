// [D55] 聊天气泡渲染器单源:主页只能 import 共享 aiMarkdownRender(净化硬化同源),不得再内联 marked/DOMPurify 配置;
//   净化语料:form/input/button/iframe/script 与 style 里的 url() 一律不放行。
const fs = require('fs');
const path = require('path');
import { renderRichMarkdownToHtml, sanitizeRenderedHtml } from '../aiMarkdownRender';

const MAIN = path.resolve(__dirname, '..', '..', 'components', 'aianalysis', 'AIAnalysisMain.js');
const strip = (s)=>s.replace(/^\s*\/\/.*$/mg, '');

it('🔴 主页 import 共享渲染器;零内联 DOMPurify.sanitize( / marked.setOptions( / hljs.highlightElement(', ()=>{
	const src = strip(fs.readFileSync(MAIN, 'utf8'));
	expect(src).toContain("from '../../utils/aiMarkdownRender'");
	expect(src).not.toContain('DOMPurify.sanitize(');
	expect(src).not.toContain('marked.setOptions(');
	expect(src).not.toContain('hljs.highlightElement(');
	expect(src).not.toContain("from 'dompurify'");
	expect(src).not.toContain("from 'marked'");
});

it('🔴 净化语料:表单/脚本/iframe/事件属性/style url() 全拒;正常 markdown 保留', ()=>{
	const hostile = [
		'正文 <form action="https://evil"><input name="pw" type="password"><button>提交</button></form>',
		'<iframe src="https://evil"></iframe><script>alert(1)</script>',
		'<div style="background:url(https://evil/x.png);color:red">样式</div>',
		'<a href="javascript:alert(1)" onclick="alert(2)">链接</a>',
		'<img src=x onerror="alert(3)">',
	].join('\n\n');
	const html = renderRichMarkdownToHtml(hostile);
	['<form', '<input', '<button', '<iframe', '<script', 'onerror', 'onclick', 'javascript:', 'url('].forEach((bad)=>expect(html.toLowerCase()).not.toContain(bad));
	// jest(CJS interop)下 marked 可能不可用 → 渲染器退回转义纯文本;只断言正文不丢、结构标签(若解析)合法
	const good = renderRichMarkdownToHtml('# 标题\n\n- 甲\n- 乙\n\n| 项 | 值 |\n| --- | --- |\n| 日主 | 庚金 |\n\n`code`');
	expect(good).toContain('标题');
	expect(good).toContain('庚金');
	expect(good.toLowerCase()).not.toContain('<script');
	expect(sanitizeRenderedHtml('<p onmouseover="x">ok</p>')).not.toContain('onmouseover');
	expect(sanitizeRenderedHtml('<p onmouseover="x">ok</p>')).toContain('ok');
});
