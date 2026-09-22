// AI 富文本 markdown 渲染共享件(B-A4):AIAnalysisMain(聊天)与 ReportPane(报告)同一套
// GFM + KaTeX 数学 + 代码块(语言标签/复制按钮)+ DOMPurify 白名单。此前报告侧只有裸
// marked+DOMPurify,与聊天能力不一致(数学不渲染/代码无高亮)——抽此单一来源双侧共用。
// 行为要求:与 AIAnalysisMain 原实现逐字等价(marked 全局配置随本模块加载生效)。
// 三方库统一 interop 兜底(named/default/CJS 任意形态;jest 与 webpack 解析差异下都稳——照 reportExport 的 jspdf 先例)。
import * as _markedMod from 'marked';
import * as _dompurifyMod from 'dompurify';
import * as _katexMod from 'katex';
import 'katex/dist/katex.min.css';
import * as _hljsMod from 'highlight.js/lib/common';
import 'highlight.js/styles/atom-one-dark.css';
import { normalizeMarkdown } from './reportMarkdownNormalize';

const marked = _markedMod.marked || _markedMod.default || _markedMod;
const DOMPurify = _dompurifyMod.default || _dompurifyMod;
const katex = _katexMod.default || _katexMod;
const hljs = _hljsMod.default || _hljsMod;

// 模块级全局配置做能力守卫:jest 的模块解析下 marked 形态可能缺 setOptions/Renderer
// (纯函数测试只 import 不渲染);运行时 webpack 恒完整。渲染入口另有 try/catch 兜底。
try{
	if(marked && typeof marked.setOptions === 'function' && marked.Renderer){
		marked.setOptions({
			gfm: true,
			breaks: true,
			headerIds: false,
			mangle: false,
		});
		// 自定义 code 渲染:包一层 .codeBlock,左上加语言徽章,右上加复制按钮(事件委托)。
		// 注:不在此处做语法高亮;高亮在挂载后由 hljs.highlightElement 单独跑(streaming 中不跑、避免抖动)。
		const mdRenderer = new marked.Renderer();
		const origCode = mdRenderer.code.bind(mdRenderer);
		mdRenderer.code = function(code, infostring, escaped){
			const html = origCode(code, infostring, escaped);
			const langRaw = (infostring || '').trim().split(/\s+/)[0] || '';
			const langLabel = langRaw ? `<span class="xq-code-lang">${langRaw}</span>` : '';
			// 复制按钮的可访问 hint;onClick 由事件委托捕获。
			// [Q-026/M-37] 净化白名单 FORBID_TAGS 含 button → 元素被删只剩裸字「复制」;改 span[role=button](净化放行 role/tabindex)。
			const copyBtn = `<span role="button" tabindex="0" class="xq-code-copy" title="复制" aria-label="复制代码">复制</span>`;
			return `<div class="xq-code-block">${langLabel}${copyBtn}${html}</div>`;
		};
		marked.use({ renderer: mdRenderer });
	}
}catch(_){ /* 配置失败不阻断模块加载;渲染入口有兜底 */ }

// 在 Markdown 之前把 LaTeX 数学预渲染为 HTML(避免 $...$ 被 marked 当作普通文本处理)。
// 支持 $$...$$(块)+ $...$(行内)+ \[...\] + \(...\),行内式不允许跨行;用占位符隔离避免被 marked 改造。
// 占位哨兵用 \u0000(NUL 在正常文本不可能出现=零碰撞);写成转义序列而非字面字节,保源码对 grep/工具链友好。
// [D-R6] 第二参 opts.output:'html'(默认,零回归——应用内气泡/报告详情,katex CSS 全局在)
// | 'mathml'(导出独立文档:HTML 单文件/打印窗,无 katex CSS,浏览器原生渲染 MathML)。
export function preRenderLatex(src, opts){
	const output = (opts && opts.output) || 'html';
	const placeholders = [];
	const escape = (s)=>s.replace(/[&<>]/g, (c)=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]);
	const renderOne = (tex, displayMode)=>{
		try{
			const html = katex.renderToString(tex, { displayMode, throwOnError: false, output });
			placeholders.push(html);
			return `\u0000KATEX${placeholders.length - 1}\u0000`;
		}catch(_){ return escape(tex); }
	};
	let s = src;
	// 块级 $$...$$(多行)
	s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, t)=>renderOne(t.trim(), true));
	// 块级 \[...\]
	s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, t)=>renderOne(t.trim(), true));
	// 行内 \(...\)
	s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_, t)=>renderOne(t.trim(), false));
	// 行内 $...$(不跨行,不与 ${...} 模板字面量冲突——保守要求两侧紧邻非空白字符)。
	s = s.replace(/\$([^\s$][^$\n]*?[^\s$])\$/g, (_, t)=>renderOne(t.trim(), false));
	s = s.replace(/\$([^\s$\n])\$/g, (_, t)=>renderOne(t.trim(), false));
	return { source: s, placeholders };
}

// 把 AI 输出的 Markdown 渲染为安全 HTML(GFM:标题/列表/表格/代码/引用/链接),再交给气泡渲染。
export function renderRichMarkdownToHtml(text){
	const raw = `${text || ''}`;
	if(!raw.trim()){
		return '';
	}
	try{
		const pre = preRenderLatex(normalizeMarkdown(raw));
		const html = marked.parse(pre.source);
		const restored = html.replace(/\u0000KATEX(\d+)\u0000/g, (_, idx)=>pre.placeholders[Number(idx)] || '');
		return sanitizeRenderedHtml(restored);
	}catch(e){
		console.warn('markdown render failed', e);
		// 解析失败时退回纯文本(经同一套净化中和),至少不丢内容
		return sanitizeRenderedHtml(raw);
	}
}

// AI 输出 → DOM 的唯一净化口(信任边界:上游可被投毒,净化失守=注入脚本可直呼壳命令/工具桥)。
// 白名单=聊天(math 系)∪报告(img 嵌图,dataURL 命盘截图)两侧并集,双消费方共用;
// 显式禁掉 AI 回复里永无正当用途的标签/属性(表单跳转/base/meta/外链样式/iframe/object/embed),
// style 里剥 url()/expression()(覆盖层钓鱼与老引擎脚本面)。语料锁:aiMarkdownRenderSanitize.test.js。
const SANITIZE_CONFIG = Object.freeze({
	ADD_ATTR: ['target', 'rel', 'class', 'type', 'title', 'aria-label', 'style', 'src', 'alt', 'role', 'tabindex'],
	ADD_TAGS: ['math', 'mrow', 'mi', 'mn', 'mo', 'msup', 'msub', 'mfrac', 'mtext', 'annotation', 'semantics', 'img'],
	FORBID_TAGS: ['form', 'input', 'button', 'select', 'textarea', 'base', 'meta', 'link', 'style', 'iframe', 'object', 'embed', 'applet', 'frame', 'frameset'],
	FORBID_ATTR: ['action', 'formaction', 'srcdoc', 'ping', 'xlink:href'],
});
let styleHookInstalled = false;
function installStyleHook(){
	if(styleHookInstalled || !DOMPurify || typeof DOMPurify.addHook !== 'function'){ return; }
	styleHookInstalled = true;
	DOMPurify.addHook('uponSanitizeAttribute', (_node, data)=>{
		if(data && data.attrName === 'style' && typeof data.attrValue === 'string' && /url\s*\(|expression\s*\(|javascript:|@import/i.test(data.attrValue)){
			data.attrValue = data.attrValue.replace(/url\s*\([^)]*\)/gi, '').replace(/expression\s*\([^)]*\)/gi, '').replace(/javascript:/gi, '').replace(/@import[^;]*;?/gi, '');
		}
	});
}
export function sanitizeRenderedHtml(html){
	installStyleHook();
	return DOMPurify.sanitize(`${html || ''}`, SANITIZE_CONFIG);
}
export function __sanitizeConfigForTests(){
	return SANITIZE_CONFIG;
}

// 代码块语法高亮:对容器内未高亮过的 <pre><code> 跑 hljs.highlightElement。
// 消费方在内容 settle 后(非 streaming 中)调用,避免流式期间反复高亮抖动。
export function highlightCodeUnder(el){
	if(!el || typeof el.querySelectorAll !== 'function') return;
	const nodes = el.querySelectorAll('pre > code:not(.hljs)');
	nodes.forEach((node)=>{
		try{ hljs.highlightElement(node); }catch(_){ /* 静默 */ }
	});
}
