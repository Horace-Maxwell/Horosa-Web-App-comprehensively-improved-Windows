#!/usr/bin/env node
/*
 * legacy-engine-floor.js —— 旧系统内核特性下限表(单一出处)+ 判据。
 *
 * 桌面包的最低系统 = tauri.conf.json 的 minimumSystemVersion(12.0)→ 系统内核下限 = macOS 12.0 原装 WebKit(Safari 15.0)。
 * 内核不认的东西分三类,后果各不相同:
 *   ① 脚本语法层:解析期语法错 → **整份脚本一行都不执行**(分包登记不上,依赖它的路由全部加载失败)。
 *      例:正则后行断言 (?<= / (?<!、正则 v 标志、正则修饰组 (?i:…)、重名命名分组、类静态块 static { }。
 *   ② 样式选择器层:选择器列表里只要有一项不认,**整条规则连同列表里其它选择器一起丢弃**。
 *      例::has()、:focus-visible。
 *      规矩:这类伪类不许与普通选择器挤在同一个列表里;:has() 另须配一条「回退类」同义规则(类由 utils/legacyWebkitCompat 在旧内核维护)。
 *   ③ 样式声明层:值不认 → **整条声明丢弃**(含 var() 的声明解析期照单全收、到计算期才作废 → 回 unset,前面写的回退值也被它盖掉)。
 *      例:color-mix()、overflow-wrap: anywhere。
 *      规矩:回退写在 `@supports not (<探测>) { 同一选择器 { 回退声明 } }` 里(嵌在规则里写,LESS 编译时冒泡到规则正后方);
 *      值里没有 var() 时,也可以在同一规则里先写一条同属性的回退声明。现代内核不读 @supports not 块,观感逐像素不变。
 *
 * 判据读的是**构建产物**(dist / dist-file 的 js 与 css;构建脚本收尾跑、发布前自检 [93] 再跑)与源码现编结果(jest 合同)——
 * 源码里看着分开的东西,编译 / 压缩之后才见分晓;第三方包带进来的也一并抓。
 *
 * 用法:
 *   node scripts/legacy-engine-floor.js --dist <产物目录>   扫产物(js 语法 + css 三层);红 = 退出码 1
 *   node scripts/legacy-engine-floor.js --src [<astrostudyui 根>]  扫源码(js 正则 / 静态块 / 行内样式;每个 .less 现编后的 css)
 *   node scripts/legacy-engine-floor.js --self-test          判别向量自证(每条判据各有一红一绿,任一不如预期 = 退出码 1)
 * 合同:src/utils/__tests__/legacyEngineFloor.test.js。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const UI_ROOT = path.resolve(__dirname, '..');

/* ── 下限表 ─────────────────────────────────────────────────────────── */

const FLOOR = {
	macos: '12.0',
	safari: '15.0',
	// 与此处同步的真值:桌面壳的最低系统版本(改了它就要重核下面每一张表)
	configFile: 'Horosa_Desktop_Installer/src-tauri/tauri.conf.json',
};

// ① 脚本语法:出现即红(解析期整份失败)。firstSafari = 第一个认它的 Safari 版本。
const JS_SYNTAX = [
	{ id: 'regex-lookbehind', firstSafari: '16.4', what: '正则后行断言 (?<= / (?<!(切句改用 utils/splitAfterPunct 这类不依赖后行断言的写法)' },
	{ id: 'regex-v-flag', firstSafari: '17.0', what: '正则 v 标志' },
	{ id: 'regex-modifiers', firstSafari: '晚于 15.0', what: '正则修饰组 (?i:…) / (?-i:…)' },
	{ id: 'regex-duplicate-named-groups', firstSafari: '17.0', what: '正则里同名的命名分组' },
	{ id: 'class-static-block', firstSafari: '16.4', what: '类静态块 static { … }' },
];

// ② 选择器:token 出现在选择器里即算。policy:
//   no-mix         —— 不许与不含它的选择器同列(可单独成条:旧内核只丢这一条,现代内核照常)
//   fallback-class —— no-mix 之外,每条规则还须有一条把它换成回退类的同义规则(HAS_FALLBACKS 登记)
const CSS_SELECTORS = [
	{ token: ':has(', firstSafari: '15.4', policy: 'fallback-class' },
	{ token: ':focus-visible', firstSafari: '15.4', policy: 'no-mix' },
	{ token: '::backdrop', firstSafari: '15.4', policy: 'no-mix' },
	{ token: ':modal', firstSafari: '15.6', policy: 'no-mix' },
	{ token: ':dir(', firstSafari: '16.4', policy: 'no-mix' },
	{ token: ':fullscreen', firstSafari: '16.4', policy: 'no-mix' },
	{ token: ':user-invalid', firstSafari: '16.5', policy: 'no-mix' },
	{ token: ':user-valid', firstSafari: '16.5', policy: 'no-mix' },
	{ token: ':popover-open', firstSafari: '17.0', policy: 'no-mix' },
	{ token: '::highlight(', firstSafari: '17.2', policy: 'no-mix' },
	{ token: ':state(', firstSafari: '17.4', policy: 'no-mix' },
	{ token: '::target-text', firstSafari: '18.2', policy: 'no-mix' },
];

// 不认的选择器 → 文档根标记类(utils/legacyWebkitCompat 在不认它的内核上给 <html> 打类;登记须与那边的 LEGACY_SELECTOR_ROOT_FLAGS 逐条相同)。
// 混列(第三方样式里改不了的)可以由「标记类底下、声明相同、单独成条」的同义规则兜住:html.<rootClass> <原选择器项>。
// 样式里不用 @supports selector(…) 判:构建链的前缀插件遇到它直接编译失败(见 CSS_AT_RULE_PARAMS)。
const SELECTOR_ROOT_FLAGS = [
	{ token: ':focus-visible', rootClass: 'horosa-legacy-no-focus-visible' },
];

// :has() 回退类登记:has = 选择器里的 :has 片段(含它前面一起被换掉的部分),fallback = 换成的回退类。
// 每条含 :has 的规则都要有一条「has 片段换成 fallback、声明逐条相同」的兄弟规则(按规则计,不按选择器去重);
// 回退类由 utils/legacyWebkitCompat.applyHasFallbackNow 在不认 :has 的内核上维护(jest 用真 :has 对拍)。
const HAS_FALLBACKS = [
	{ has: ':has(.horosa-main-tab-hidden)', fallback: '.horosa-main-tab-hidden-parent' },
	{ has: ':is(div, section, main):has(> .horosa-bottom-quick-dock)', fallback: '.horosa-bottom-quick-dock-parent' },
];

// ③ 声明值。policy:
//   fallback   —— 须有旧内核回退(见文件头);probe = @supports 探测里用来认它的字样
//   prefixed   —— 15.0 只认带前缀的写法:同一规则里须同时有 twin 属性
//   degrade-ok —— 旧内核丢掉也无害(写明理由),只登记不判红
//   forbid     —— 不许出现
const CSS_VALUES = [
	{ id: 'color-mix', firstSafari: '16.2', policy: 'fallback', probe: /color-mix/, test: (p, v)=>/(^|[^\w-])color-mix\(/i.test(v) },
	{ id: 'oklab-oklch', firstSafari: '15.4', policy: 'fallback', probe: /okl(ab|ch)/, test: (p, v)=>/(^|[^\w-])okl(ab|ch)\(/i.test(v) },
	{ id: 'light-dark', firstSafari: '17.5', policy: 'fallback', probe: /light-dark/, test: (p, v)=>/(^|[^\w-])light-dark\(/i.test(v) },
	{ id: 'relative-color', firstSafari: '16.4', policy: 'fallback', probe: /\(\s*from\s/, test: (p, v)=>/(^|[^\w-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(\s*from\s/i.test(v) },
	{ id: 'css-math-ext', firstSafari: '15.4', policy: 'fallback', probe: /(round|mod|rem|sin|cos|tan|asin|acos|atan|atan2|pow|sqrt|hypot|log|exp|abs|sign)\(/, test: (p, v)=>/(^|[^\w-])(round|mod|rem|sin|cos|tan|asin|acos|atan|atan2|pow|sqrt|hypot|log|exp|abs|sign)\(/i.test(v) },
	{ id: 'viewport-units-new', firstSafari: '15.4', policy: 'fallback', probe: /\d[sld]v(h|w|i|b|min|max)/, test: (p, v)=>/\d(?:[sld]v(?:h|w|i|b|min|max))(?![\w-])/i.test(v) },
	{ id: 'container-units', firstSafari: '16.0', policy: 'fallback', probe: /\dcq(w|h|i|b|min|max)/, test: (p, v)=>/\dcq(?:w|h|i|b|min|max)(?![\w-])/i.test(v) },
	{ id: 'overflow-wrap-anywhere', firstSafari: '15.4', policy: 'fallback', probe: /anywhere/, fallbackProps: ['word-break', 'overflow-wrap', 'word-wrap'], fallbackOk: (p, v)=>(p === 'word-break' ? /^break-word\b/i.test(v) : /^break-word\b/i.test(v)), test: (p, v)=>/^(overflow-wrap|word-wrap)$/.test(p) && /^anywhere\b/i.test(v) },
	{ id: 'overflow-clip', firstSafari: '16.0', policy: 'fallback', probe: /\bclip\b/, test: (p, v)=>/^overflow(-x|-y|-inline|-block)?$/.test(p) && /(^|\s)clip(\s|$|!)/i.test(v) },
	{ id: 'backdrop-filter', firstSafari: '18.0(15.0 只认 -webkit- 前缀)', policy: 'prefixed', twin: '-webkit-backdrop-filter', test: (p)=>p === 'backdrop-filter' },
	{ id: 'appearance', firstSafari: '15.4(此前只认 -webkit- 前缀)', policy: 'prefixed', twin: '-webkit-appearance', test: (p)=>p === 'appearance' },
	{ id: 'mask', firstSafari: '15.4(此前只认 -webkit- 前缀)', policy: 'prefixed', twinOf: (p)=>`-webkit-${p}`, test: (p)=>/^mask(-image|-size|-position|-repeat|-origin|-clip|-mode|-composite)?$/.test(p) },
	{ id: 'text-wrap', firstSafari: '17.5', policy: 'degrade-ok', reason: '只影响断行观感(balance / pretty),丢掉后按常规折行', test: (p)=>/^text-wrap(-mode|-style)?$/.test(p) },
	{ id: 'scrollbar-gutter', firstSafari: '18.2', policy: 'degrade-ok', reason: '只影响滚动条占位,丢掉后照常滚动', test: (p)=>p === 'scrollbar-gutter' },
	{ id: 'accent-color', firstSafari: '15.4', policy: 'degrade-ok', reason: '原生勾选框 / 单选钮回到系统色,可用性不变', test: (p)=>p === 'accent-color' },
	{ id: 'content-visibility', firstSafari: '18.0', policy: 'degrade-ok', reason: '只是渲染优化提示,丢掉后照常绘制', test: (p)=>p === 'content-visibility' },
	{ id: 'container-type', firstSafari: '16.0', policy: 'forbid', test: (p)=>p === 'container-type' || p === 'container' },
];

// ④ at 规则:出现即红(整块被丢)。
const CSS_AT_RULES = [
	{ name: 'layer', firstSafari: '15.4' },
	{ name: 'container', firstSafari: '16.0' },
	{ name: 'property', firstSafari: '16.4' },
	{ name: 'scope', firstSafari: '17.4' },
	{ name: 'starting-style', firstSafari: '17.5' },
];

// ④b at 规则参数里不许出现的写法(构建链限制,不是内核限制):出现即红
const CSS_AT_RULE_PARAMS = [
	{ id: 'supports-selector', test: (name, params)=>name === 'supports' && /selector\s*\(/i.test(params), what: '@supports selector(…):构建链的前缀插件(postcss-preset-env 带的旧版前缀插件)遇到它整份样式编译失败;要判选择器支持,走 utils/legacyWebkitCompat 的文档根标记类' },
];

// ⑤ 脚本 API:目标内核没有、由 utils/legacyWebkitCompat.installPolyfills 补上的(jest 逐个删掉原生再核补得回来)
const JS_POLYFILLED = [
	['Array.prototype', 'at'],
	['String.prototype', 'at'],
	['Array.prototype', 'findLast'],
	['Array.prototype', 'findLastIndex'],
	['Object', 'hasOwn'],
	['window', 'requestIdleCallback'],
	['window', 'cancelIdleCallback'],
	['window', 'structuredClone'],
];

// 产物里已核过、确实不会被执行到的出现处(第三方包)。match = 字符串字面量里的一段原文;每条写理由。
// near = 该字面量前 200 字以内必须出现的原文(认得出是哪一处,不按文件名认:产物文件名带哈希)
const DIST_STRING_ALLOW = [
	{ near: 'includeBoundaries?', reason: '表单校验库拼网址正则的源串:只在调用方传 includeBoundaries 时才 new RegExp,全仓没有这样调' },
];

// 源码里允许出现 color-mix( 的脚本(行内样式):登记的函数自带旧内核回退(jest 合同核)
const SRC_INLINE_COLOR_MIX_ALLOW = ['components/dunjia/qimenHarmColors.js'];
// 行内样式 overflowWrap: 'anywhere' 必须同一元素带这个类(类的规则只写在 @supports not 回退块里,现代内核不受影响)
const WRAP_ANYWHERE_FALLBACK_CLASS = 'horosa-legacy-wrap-anywhere';

/* ── 正则 ───────────────────────────────────────────────────────────── */

function regexFeatures(pattern, flags){
	const out = new Set();
	if(/v/.test(flags || '')){ out.add('regex-v-flag'); }
	const p = `${pattern || ''}`;
	const names = [];
	let inClass = false;
	for(let i = 0; i < p.length; i += 1){
		const c = p[i];
		if(c === '\\'){ i += 1; continue; }
		if(inClass){ if(c === ']'){ inClass = false; } continue; }
		if(c === '['){ inClass = true; continue; }
		if(c !== '(' || p[i + 1] !== '?'){ continue; }
		const rest = p.slice(i + 2);
		if(rest.startsWith('<=') || rest.startsWith('<!')){ out.add('regex-lookbehind'); continue; }
		const named = /^<([A-Za-z_$][\w$]*)>/.exec(rest);
		if(named){ names.push(named[1]); continue; }
		if(/^(?=[ims-]*[ims])[ims]*(-[ims]+)?:/.test(rest)){ out.add('regex-modifiers'); }
	}
	if(new Set(names).size !== names.length){ out.add('regex-duplicate-named-groups'); }
	return [...out];
}

// 字符串里(会被拿去 new RegExp 的源串)出现后行断言
const STRING_LOOKBEHIND_RE = /\(\?<[=!]/;

/* ── 脚本(产物 / 源码)──────────────────────────────────────────── */

function walkAst(root, visit){
	const stack = [root];
	while(stack.length){
		const node = stack.pop();
		if(!node || typeof node !== 'object'){ continue; }
		if(Array.isArray(node)){ for(let i = node.length - 1; i >= 0; i -= 1){ stack.push(node[i]); } continue; }
		if(typeof node.type === 'string'){ visit(node); }
		for(const k of Object.keys(node)){
			if(k === 'loc' || k === 'start' || k === 'end' || k === 'range' || k === 'extra' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments'){ continue; }
			const v = node[k];
			if(v && typeof v === 'object'){ stack.push(v); }
		}
	}
}

const lineOf = (code, pos)=>{ let n = 1; for(let i = 0; i < pos && i < code.length; i += 1){ if(code.charCodeAt(i) === 10){ n += 1; } } return n; };

// 产物脚本:acorn 按最新语法解析(解析失败本身也报)→ 正则字面量 / 字符串源串 / 类静态块
function scanJsDist(code, file){
	const acorn = require('acorn');
	const out = [];
	let ast;
	try{
		ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true });
	}catch(e){
		try{ ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true }); }catch(e2){
			out.push({ layer: 'js', id: 'js-parse-error', file, detail: `解析不了:${e.message}` });
			return out;
		}
	}
	walkAst(ast, (n)=>{
		if(n.type === 'Literal' && n.regex){
			regexFeatures(n.regex.pattern, n.regex.flags).forEach((id)=>out.push({ layer: 'js', id, file, line: lineOf(code, n.start), detail: `/${n.regex.pattern.slice(0, 80)}/${n.regex.flags}` }));
		}else if(n.type === 'Literal' && typeof n.value === 'string' && STRING_LOOKBEHIND_RE.test(n.value)){
			const before = code.slice(Math.max(0, n.start - 200), n.start);
			if(!DIST_STRING_ALLOW.some((a)=>before.indexOf(a.near) >= 0)){
				out.push({ layer: 'js', id: 'regex-lookbehind', file, line: lineOf(code, n.start), detail: `字符串源串 ${JSON.stringify(n.value.slice(0, 80))}` });
			}
		}else if(n.type === 'StaticBlock'){
			out.push({ layer: 'js', id: 'class-static-block', file, line: lineOf(code, n.start), detail: 'static { … }' });
		}
	});
	return out;
}

const BABEL_OPTS = { sourceType: 'module', errorRecovery: false, plugins: ['jsx', 'classProperties', 'classPrivateProperties', 'classPrivateMethods', 'classStaticBlock', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport', 'exportDefaultFrom', 'decorators-legacy', 'topLevelAwait'] };

const isRegExpCallee = (c)=>c && c.type === 'Identifier' && c.name === 'RegExp';
const staticText = (n)=>{
	if(!n){ return null; }
	if(n.type === 'StringLiteral'){ return n.value; }
	if(n.type === 'TemplateLiteral'){ return n.quasis.map((q)=>q.value.cooked || '').join('\u0000'); }
	return null;
};
const propName = (k)=>(k && (k.type === 'Identifier' ? k.name : (k.type === 'StringLiteral' ? k.value : null)));

// 源码脚本:@babel/parser → 正则字面量 / new RegExp(字面量) / 类静态块 / 行内样式里的新函数与新值
function scanJsSource(code, file, rel){
	const parser = require('@babel/parser');
	const out = [];
	let ast;
	try{ ast = parser.parse(code, BABEL_OPTS); }catch(e){
		out.push({ layer: 'js', id: 'js-parse-error', file, detail: e.message });
		return out;
	}
	const relPath = `${rel || file}`.split(path.sep).join('/');
	const parents = new Map();
	walkAst(ast, (n)=>{
		for(const k of Object.keys(n)){
			const v = n[k];
			if(k === 'loc' || !v || typeof v !== 'object'){ continue; }
			(Array.isArray(v) ? v : [v]).forEach((c)=>{ if(c && typeof c.type === 'string'){ parents.set(c, n); } });
		}
	});
	const at = (n)=>(n.loc ? n.loc.start.line : 0);
	walkAst(ast, (n)=>{
		if(n.type === 'RegExpLiteral'){
			regexFeatures(n.pattern, n.flags).forEach((id)=>out.push({ layer: 'js', id, file, line: at(n), detail: `/${n.pattern.slice(0, 80)}/${n.flags}` }));
		}else if((n.type === 'NewExpression' || n.type === 'CallExpression') && isRegExpCallee(n.callee)){
			const src = staticText(n.arguments[0]);
			const flags = staticText(n.arguments[1]);
			if(src != null){ regexFeatures(src, flags || '').forEach((id)=>out.push({ layer: 'js', id, file, line: at(n), detail: `RegExp(${JSON.stringify(src.slice(0, 80))})` })); }
		}else if(n.type === 'StaticBlock'){
			out.push({ layer: 'js', id: 'class-static-block', file, line: at(n), detail: 'static { … }' });
		}else if(n.type === 'StringLiteral' || n.type === 'TemplateElement'){
			const v = n.type === 'StringLiteral' ? n.value : (n.value.cooked || '');
			if(/(^|[^\w-])color-mix\(/i.test(v) && SRC_INLINE_COLOR_MIX_ALLOW.indexOf(relPath) < 0){
				out.push({ layer: 'inline', id: 'color-mix', file, line: at(n), detail: '脚本里拼 color-mix(行内样式没有 @supports 可写回退;走登记过的 tint() 一类函数)' });
			}
			if(/overflow-wrap\s*:\s*anywhere/i.test(v)){
				out.push({ layer: 'inline', id: 'overflow-wrap-anywhere', file, line: at(n), detail: '脚本里拼 overflow-wrap: anywhere' });
			}
		}else if(n.type === 'ObjectProperty' && /^(overflowWrap|wordWrap)$/.test(propName(n.key) || '') && n.value && n.value.type === 'StringLiteral' && /^anywhere\b/.test(n.value.value)){
			// 行内样式对象:须是 JSX style={{ … }} 里直接写的,且同一元素的 className 带回退类
			const obj = parents.get(n);
			const exprC = obj && parents.get(obj);
			const attr = exprC && parents.get(exprC);
			const opening = attr && parents.get(attr);
			let ok = false;
			if(attr && attr.type === 'JSXAttribute' && attr.name && attr.name.name === 'style' && opening && opening.type === 'JSXOpeningElement'){
				ok = opening.attributes.some((a)=>a.type === 'JSXAttribute' && a.name && a.name.name === 'className' && a.value
					&& ((a.value.type === 'StringLiteral' && a.value.value.split(/\s+/).indexOf(WRAP_ANYWHERE_FALLBACK_CLASS) >= 0)
						|| JSON.stringify(a.value).indexOf(WRAP_ANYWHERE_FALLBACK_CLASS) >= 0));
			}
			if(!ok){
				out.push({ layer: 'inline', id: 'overflow-wrap-anywhere', file, line: at(n), detail: `行内 overflowWrap: 'anywhere' 须写在 JSX style 里、同一元素 className 带 ${WRAP_ANYWHERE_FALLBACK_CLASS}` });
			}
		}
	});
	return out;
}

/* ── 样式 ───────────────────────────────────────────────────────────── */

// 顶层逗号切选择器列表(括号 / 方括号 / 引号里的逗号不切)
function splitSelectorList(sel){
	const out = [];
	let depth = 0;
	let quote = null;
	let cur = '';
	for(let i = 0; i < sel.length; i += 1){
		const c = sel[i];
		if(quote){ cur += c; if(c === '\\'){ cur += sel[i + 1] || ''; i += 1; }else if(c === quote){ quote = null; } continue; }
		if(c === '"' || c === '\''){ quote = c; cur += c; continue; }
		if(c === '\\'){ cur += c + (sel[i + 1] || ''); i += 1; continue; }
		if(c === '(' || c === '['){ depth += 1; }
		else if(c === ')' || c === ']'){ depth -= 1; }
		if(c === ',' && depth === 0){ out.push(cur.trim()); cur = ''; continue; }
		cur += c;
	}
	if(cur.trim()){ out.push(cur.trim()); }
	return out;
}
const normSel = (s)=>`${s}`.replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, '$1').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
const normVal = (v)=>`${v}`.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
const declKey = (d)=>`${d.prop.toLowerCase()}:${normVal(d.value)}${d.important ? '!important' : ''}`;
const selectorFeatures = (item)=>CSS_SELECTORS.filter((f)=>item.indexOf(f.token) >= 0);
const valueFeatures = (prop, value)=>CSS_VALUES.filter((f)=>f.test(prop.toLowerCase(), `${value}`.trim()));
const HAS_NORM = HAS_FALLBACKS.map((e)=>({ ...e, hasN: normSel(e.has), fallbackN: normSel(e.fallback) }));

function atContext(node){
	const chain = [];
	for(let p = node.parent; p && p.type !== 'root'; p = p.parent){
		if(p.type === 'atrule'){ chain.unshift({ name: `${p.name}`.toLowerCase(), params: `${p.params || ''}`.toLowerCase().replace(/\s+/g, ' ').trim() }); }
	}
	return chain;
}
const isNegSupports = (a)=>a.name === 'supports' && /^not\b/.test(a.params);
const ctxKey = (chain)=>chain.map((a)=>`@${a.name} ${a.params}`).join(' | ');

// 一组 css 文本 → 违规清单。
//   opts.registryUse:收集用到的 :has 登记项(死条目判据用);opts.mode === 'src' 时不判前缀类(源码的前缀由构建补,产物里再判)。
//   混列的「单独成条兄弟规则」跨文件找(层叠是全局的:第三方样式在一份分包里,补的那条在另一份);:has 回退规则与声明回退块只在同一份里找。
function collectRules(css, file, out){
	const postcss = require('postcss');
	let root;
	try{ root = postcss.parse(css, { from: file }); }catch(e){
		out.push({ layer: 'css', id: 'css-parse-error', file, detail: e.message });
		return [];
	}
	root.walkAtRules((a)=>{
		const name = `${a.name}`.toLowerCase().replace(/^-webkit-/, '');
		const hit = CSS_AT_RULES.find((r)=>r.name === name);
		if(hit){ out.push({ layer: 'css', id: `at-${hit.name}`, file, line: a.source && a.source.start && a.source.start.line, detail: `@${a.name} ${`${a.params}`.slice(0, 60)}` }); }
		CSS_AT_RULE_PARAMS.filter((r)=>r.test(name, `${a.params || ''}`)).forEach((r)=>out.push({ layer: 'css', id: r.id, file, line: a.source && a.source.start && a.source.start.line, detail: `@${a.name} ${`${a.params}`.slice(0, 60)} —— ${r.what}` }));
	});
	const rules = [];
	let order = 0;
	root.walkRules((r)=>{
		order += 1;
		const chain = atContext(r);
		if(chain.some((a)=>/keyframes$/.test(a.name))){ return; }
		const items = splitSelectorList(r.selector);
		const decls = (r.nodes || []).filter((n)=>n.type === 'decl');
		rules.push({ file, r, order, chain, ctx: ctxKey(chain.filter((a)=>!isNegSupports(a))), neg: chain.filter(isNegSupports), items, itemsN: items.map(normSel), listN: normSel(items.join(',')), decls, key: decls.map(declKey).join(';') });
	});
	return rules;
}

function scanCssMany(sheets, opts){
	const o = opts || {};
	const out = [];
	const perFile = sheets.map((s)=>({ file: s.file, rules: collectRules(s.css, s.file, out) }));
	// 兄弟规则索引:同一 at 上下文(不计 @supports not)里,按选择器项 → 只含安全选择器的规则
	const byItem = new Map();
	perFile.forEach(({ rules })=>rules.forEach((x)=>{
		if(x.items.some((it)=>selectorFeatures(it).length)){ return; }
		x.itemsN.forEach((it)=>{
			const k = `${x.ctx}\u0001${it}`;
			if(!byItem.has(k)){ byItem.set(k, []); }
			byItem.get(k).push(x);
		});
	}));
	// twin:声明逐条相同、单独成条、不在任何 @supports not 里
	const twinExists = (x, itemN, { sameFile })=>(byItem.get(`${x.ctx}\u0001${itemN}`) || []).some((y)=>y !== x && y.key === x.key
		&& (!sameFile || y.file === x.file) && !y.neg.length);
	const lineOfRule = (x)=>x.r.source && x.r.source.start && x.r.source.start.line;
	const guardedBy = (x, word)=>x.chain.some((a)=>a.name === 'supports' && !/^not\b/.test(a.params) && a.params.indexOf(word) >= 0);

	perFile.forEach(({ file, rules })=>rules.forEach((x)=>{
		// ② 选择器层
		CSS_SELECTORS.forEach((f)=>{
			const withIt = x.items.filter((it)=>it.indexOf(f.token) >= 0);
			if(!withIt.length || guardedBy(x, `selector(${f.token}`)){ return; }
			if(x.neg.some((a)=>a.params.indexOf(`selector(${f.token}`) >= 0)){ return; }   // 只给不认它的内核看的块里写它 —— 那里它本来就不生效
			if(withIt.length < x.items.length){
				// 混列:旧内核整条丢弃 → 列表里不含它的那些项须各有一条单独成条、声明相同的兄弟规则
				// (兄弟规则可以挂在登记的文档根标记类底下:只有不认它的内核才有那个类)
				const flag = SELECTOR_ROOT_FLAGS.find((g)=>g.token === f.token);
				x.items.forEach((it, i)=>{
					if(it.indexOf(f.token) >= 0){ return; }
					const viaFlag = flag && twinExists(x, normSel(`html.${flag.rootClass} ${x.itemsN[i]}`), {});
					if(!viaFlag && !twinExists(x, x.itemsN[i], {})){
						out.push({ layer: 'css', id: 'selector-list-mixed', file, line: lineOfRule(x), detail: `${f.token} 与普通选择器同列(旧内核整条丢弃,${it.slice(0, 60)} 跟着失效):${x.r.selector.slice(0, 160)}` });
					}
				});
			}
			if(f.policy !== 'fallback-class'){ return; }
			withIt.forEach((it)=>{
				const itN = normSel(it);
				const reg = HAS_NORM.find((e)=>itN.indexOf(e.hasN) >= 0);
				if(!reg){
					out.push({ layer: 'css', id: 'has-unregistered', file, line: lineOfRule(x), detail: `未登记的 :has 用法(登记 HAS_FALLBACKS 并写回退类规则):${it.slice(0, 160)}` });
					return;
				}
				if(o.registryUse){ o.registryUse.add(reg.has); }
				const twinN = itN.split(reg.hasN).join(reg.fallbackN);
				if(twinN.indexOf(':has(') >= 0){
					out.push({ layer: 'css', id: 'has-unregistered', file, line: lineOfRule(x), detail: `换掉登记片段后仍含 :has:${it.slice(0, 160)}` });
					return;
				}
				if(!twinExists(x, twinN, { sameFile: true })){
					out.push({ layer: 'css', id: 'has-no-fallback-rule', file, line: lineOfRule(x), detail: `缺回退类同义规则 ${twinN.slice(0, 160)}(声明须与 :has 那条逐条相同、单独成条、同一份样式里)` });
				}
			});
		});
		// ③ 声明层
		x.decls.forEach((d, i)=>{
			const prop = d.prop.toLowerCase();
			const at = d.source && d.source.start && d.source.start.line;
			valueFeatures(prop, d.value).forEach((f)=>{
				if(f.policy === 'degrade-ok'){ return; }
				if(f.policy === 'forbid'){
					out.push({ layer: 'css', id: f.id, file, line: at, detail: `${prop}: ${`${d.value}`.slice(0, 80)}` });
					return;
				}
				if(f.policy === 'prefixed'){
					if(o.mode === 'src'){ return; }
					const twin = f.twin || f.twinOf(prop);
					if(!x.decls.some((e)=>e.prop.toLowerCase() === twin)){
						out.push({ layer: 'css', id: f.id, file, line: at, detail: `${prop} 缺 ${twin}(目标内核只认带前缀的):${x.r.selector.slice(0, 100)}` });
					}
					return;
				}
				// fallback
				if(x.neg.some((a)=>f.probe.test(a.params))){ return; }   // 自己就是回退块里的(回退值本身另由下面判)
				if(x.chain.some((a)=>a.name === 'supports' && !/^not\b/.test(a.params) && f.probe.test(a.params))){ return; }   // 只给认它的内核看
				const fbProps = f.fallbackProps || [prop];
				const isClean = (e)=>fbProps.indexOf(e.prop.toLowerCase()) >= 0
					&& (!f.fallbackOk || f.fallbackOk(e.prop.toLowerCase(), `${e.value}`.trim()))
					&& !valueFeatures(e.prop.toLowerCase(), e.value).some((g)=>g.policy === 'fallback' || g.policy === 'forbid');
				const hasVar = /var\(/i.test(d.value);
				if(!hasVar && x.decls.slice(0, i).some(isClean)){ return; }
				const block = rules.some((y)=>y.order > x.order && y.ctx === x.ctx && y.listN === x.listN
					&& y.neg.some((a)=>f.probe.test(a.params)) && y.decls.some(isClean));
				if(block){ return; }
				out.push({ layer: 'css', id: f.id, file, line: at,
					detail: `${prop}: ${`${d.value}`.slice(0, 90)} 没有旧内核回退(${hasVar ? '值里有 var(),前置回退会被它盖掉;' : ''}写 @supports not (… ${f.probe.source} …) { 同选择器 { ${fbProps.join(' / ')}: 回退值 } })|${x.r.selector.slice(0, 100)}` });
			});
		});
		// 回退块里的回退值本身不许再用新值
		if(x.neg.length){
			x.decls.forEach((d)=>{
				const bad = valueFeatures(d.prop.toLowerCase(), d.value).filter((g)=>g.policy === 'fallback' || g.policy === 'forbid');
				if(bad.length){ out.push({ layer: 'css', id: 'fallback-uses-new-value', file, line: d.source && d.source.start && d.source.start.line, detail: `回退块里的回退值又用了 ${bad.map((g)=>g.id).join(' / ')}:${d.prop}: ${`${d.value}`.slice(0, 80)}` }); }
			});
		}
	}));
	return out;
}

const scanCss = (css, file, opts)=>scanCssMany([{ css, file }], opts);

/* ── 目录扫描 ───────────────────────────────────────────────────────── */

function listFiles(dir, exts, out = []){
	if(!fs.existsSync(dir)){ return out; }
	fs.readdirSync(dir, { withFileTypes: true }).forEach((d)=>{
		if(d.name === 'node_modules' || d.name === '.umi' || d.name === '.umi-production' || d.name === '.umi-test'){ return; }
		const p = path.join(dir, d.name);
		if(d.isDirectory()){ listFiles(p, exts, out); return; }
		if(exts.some((e)=>d.name.endsWith(e))){ out.push(p); }
	});
	return out;
}

function scanDist(dir){
	const violations = [];
	const stats = { js: 0, css: 0, inlineScripts: 0 };
	const registryUse = new Set();
	listFiles(dir, ['.js', '.mjs']).forEach((f)=>{
		stats.js += 1;
		violations.push(...scanJsDist(fs.readFileSync(f, 'utf8'), path.relative(dir, f)));
	});
	const sheets = [];
	listFiles(dir, ['.html']).forEach((f)=>{
		const html = fs.readFileSync(f, 'utf8');
		const re = /<script(?![^>]*\bsrc=)(?![^>]*type=["']?(?:application\/(?:ld\+)?json|text\/template))[^>]*>([\s\S]*?)<\/script>/gi;
		let m;
		while((m = re.exec(html))){
			if(!m[1].trim()){ continue; }
			stats.inlineScripts += 1;
			violations.push(...scanJsDist(m[1], `${path.relative(dir, f)}#内联脚本`));
		}
		const st = /<style[^>]*>([\s\S]*?)<\/style>/gi;
		while((m = st.exec(html))){ stats.inlineStyles = (stats.inlineStyles || 0) + 1; sheets.push({ css: m[1], file: `${path.relative(dir, f)}#内联样式` }); }
	});
	listFiles(dir, ['.css']).forEach((f)=>{
		stats.css += 1;
		sheets.push({ css: fs.readFileSync(f, 'utf8'), file: path.relative(dir, f) });
	});
	violations.push(...scanCssMany(sheets, { registryUse }));
	HAS_FALLBACKS.forEach((e)=>{ if(!registryUse.has(e.has)){ violations.push({ layer: 'css', id: 'has-registry-dead', file: '(下限表)', detail: `登记项 ${e.has} 在产物里没有用点(死条目:清登记或恢复用点)` }); } });
	return { violations, stats };
}

// 源码全集登记表里的 .less 门面(只按序 @import 区段的文件)
function lessFacades(root){
	try{
		const sets = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'source-sets.json'), 'utf8')).sets || {};
		return new Set(Object.keys(sets).filter((k)=>/\.less$/.test(k)));
	}catch(e){ return new Set(); }
}

const isTestPath = (rel)=>/(^|\/)__tests__\//.test(rel) || /\.test\.[jt]sx?$/.test(rel);

function compileLessFile(abs){
	const less = require(path.join(UI_ROOT, 'node_modules', '@umijs', 'deps', 'compiled', 'less'));
	const text = fs.readFileSync(abs, 'utf8').replace(/(@import\s+(\([^)]*\)\s*)?['"])~/g, '$1');
	return less.render(text, { filename: abs, javascriptEnabled: true, paths: [path.dirname(abs), path.join(UI_ROOT, 'node_modules')] }).then((r)=>r.css);
}

async function scanSource(uiRoot){
	const root = uiRoot || UI_ROOT;
	const src = path.join(root, 'src');
	const violations = [];
	const stats = { js: 0, less: 0, css: 0 };
	const registryUse = new Set();
	listFiles(src, ['.js', '.jsx']).forEach((f)=>{
		const rel = path.relative(src, f).split(path.sep).join('/');
		if(isTestPath(rel)){ return; }
		stats.js += 1;
		violations.push(...scanJsSource(fs.readFileSync(f, 'utf8'), path.join('src', rel), rel));
	});
	const facades = lessFacades(root);
	for(const f of listFiles(src, ['.less'])){
		if(facades.has(path.relative(src, f).split(path.sep).join('/'))){ continue; }   // 门面只是把区段按序 @import:区段逐个现编已覆盖
		stats.less += 1;
		let css;
		try{ css = await compileLessFile(f); }catch(e){ violations.push({ layer: 'css', id: 'less-compile-error', file: path.relative(root, f), detail: e.message }); continue; }
		violations.push(...scanCss(css, path.relative(root, f), { registryUse, mode: 'src' }));
	}
	listFiles(src, ['.css']).forEach((f)=>{
		stats.css += 1;
		violations.push(...scanCss(fs.readFileSync(f, 'utf8'), path.relative(root, f), { registryUse, mode: 'src' }));
	});
	HAS_FALLBACKS.forEach((e)=>{ if(!registryUse.has(e.has)){ violations.push({ layer: 'css', id: 'has-registry-dead', file: '(下限表)', detail: `登记项 ${e.has} 在源码样式里没有用点(死条目)` }); } });
	return { violations, stats };
}

/* ── 判别向量(--self-test 与 jest 共用)──────────────────────────────── */

// [名, 输入类型, 输入, 期望命中的判据 id(空数组 = 必须绿)]
const SELF_TEST_VECTORS = [
	['后行断言正则字面量', 'jsDist', 'var s=t.split(/(?<=[。!?])/);', ['regex-lookbehind']],
	['否定后行断言', 'jsDist', 'var r=/(?<!a)b/;', ['regex-lookbehind']],
	['命名分组不算', 'jsDist', 'var r=/(?<y>\\d{4})-(?<m>\\d\\d)/;', []],
	['字符类里的 (?<= 不算', 'jsDist', 'var r=/[(?<=]/;', []],
	['转义的括号不算', 'jsDist', 'var r=/\\(?<=/;', []],
	['v 标志', 'jsDist', 'var r=/[\\p{L}--[a-z]]/v;', ['regex-v-flag']],
	['修饰组', 'jsDist', 'var r=new RegExp("x");var q=/(?i:ab)c/;', ['regex-modifiers']],
	['非捕获组不算修饰组', 'jsDist', 'var r=/(?:ab)c/;', []],
	['类静态块', 'jsDist', 'class A{static{this.x=1}}', ['class-static-block']],
	['类静态字段不算', 'jsDist', 'class A{static x=1; #y=2; m(){return #y in this}}', []],
	['字符串源串里的后行断言', 'jsDist', 'var s="(?<=\\\\s)x";new RegExp(s);', ['regex-lookbehind']],
	['登记过的第三方源串(条件拼接、不被调用)', 'jsDist', 'var t=function(t){return t&&t.includeBoundaries?"(?:(?<=\\\\s|^)(?="+e+")|(?<="+e+")(?=\\\\s|$))":""};', []],
	['切句的等价写法', 'jsDist', 'var s=t.match(/[^。!?]*[。!?]|[^。!?]+$/g);', []],
	['源码 new RegExp 字面量', 'jsSource', 'const r = new RegExp(`(?<=a)b`, "g");', ['regex-lookbehind']],
	['源码行内 color-mix', 'jsSource', 'const s = { background: `color-mix(in srgb, ${c} 10%, transparent)` };', ['color-mix']],
	['源码行内 anywhere 无回退类', 'jsSource', 'const e = <span style={{ overflowWrap: "anywhere" }}>x</span>;', ['overflow-wrap-anywhere']],
	['源码行内 anywhere 带回退类', 'jsSource', `const e = <span className="a ${WRAP_ANYWHERE_FALLBACK_CLASS}" style={{ overflowWrap: "anywhere" }}>x</span>;`, []],
	// :has 三个变异向量 + 基线
	['基线::has 与回退类分写', 'css', '.s :is(div,section,main):has(>.horosa-bottom-quick-dock){--x:1}.s .horosa-bottom-quick-dock-parent{--x:1}', []],
	['变异 A:同名 :has 新用点无回退规则', 'css', '.s :is(div,section,main):has(>.horosa-bottom-quick-dock){--x:1}.s .horosa-bottom-quick-dock-parent{--x:1}.other :is(div, section, main):has(> .horosa-bottom-quick-dock){--x:2}', ['has-no-fallback-rule']],
	['变异 C::has 与回退类合进同一列表', 'css', '.s :is(div,section,main):has(>.horosa-bottom-quick-dock),.s .horosa-bottom-quick-dock-parent{--x:1}', ['selector-list-mixed', 'has-no-fallback-rule']],
	['回退规则声明不同也算缺', 'css', '.s .t:has(.horosa-main-tab-hidden){display:none}.s .t.horosa-main-tab-hidden-parent{display:block}', ['has-no-fallback-rule']],
	['未登记的 :has', 'css', '.a:has(.b){color:red}', ['has-unregistered']],
	['@supports selector(…) 让构建失败', 'css', '@supports selector(:has(*)){.a:has(.b){color:red}}', ['supports-selector']],
	['媒体查询里回退规则须同在', 'css', '@media (max-width:900px){.s .t:has(.horosa-main-tab-hidden){display:none}}.s .t.horosa-main-tab-hidden-parent{display:none}', ['has-no-fallback-rule']],
	['focus-visible 与 hover 同列', 'css', '.pill:hover,.pill:focus-visible{background:red}', ['selector-list-mixed']],
	['focus-visible 单独成条', 'css', '.pill:hover{background:red}.pill:focus-visible{background:red}', []],
	['全是 focus-visible 的列表', 'css', '.a:focus:not(:focus-visible),.b:focus:not(:focus-visible){outline:0}', []],
	['第三方混列由单独成条的同义规则兜住', 'css', '.t a:focus-visible,.t a:hover{color:red}.t a:hover{color:red}', []],
	['第三方混列由文档根标记类底下的同义规则兜住', 'css', '.t a:focus-visible,.t a:hover{color:red}html.horosa-legacy-no-focus-visible .t a:hover{color:red}', []],
	['标记类不对不算', 'css', '.t a:focus-visible,.t a:hover{color:red}html.other .t a:hover{color:red}', ['selector-list-mixed']],
	['color-mix 无回退', 'css', '.a{background:color-mix(in srgb,#f00 10%,transparent)}', ['color-mix']],
	['color-mix 前置静态回退', 'css', '.a{background:rgba(255,0,0,.1);background:color-mix(in srgb,#f00 10%,transparent)}', []],
	['color-mix 含 var 时前置回退无效', 'css', '.a{background:rgba(255,0,0,.1);background:color-mix(in srgb,var(--c) 10%,transparent)}', ['color-mix']],
	['color-mix 含 var 配 @supports not 回退块', 'css', '.a{background:color-mix(in srgb,var(--c) 10%,transparent)}@supports not (color:color-mix(in srgb,red,red)){.a{background:rgba(var(--c-rgb),.1)}}', []],
	['回退块写在前面不算', 'css', '@supports not (color:color-mix(in srgb,red,red)){.a{background:rgba(var(--c-rgb),.1)}}.a{background:color-mix(in srgb,var(--c) 10%,transparent)}', ['color-mix']],
	['回退块的选择器不同不算', 'css', '.a{background:color-mix(in srgb,var(--c) 10%,transparent)}@supports not (color:color-mix(in srgb,red,red)){.b{background:rgba(var(--c-rgb),.1)}}', ['color-mix']],
	['回退值又用 color-mix', 'css', '.a{background:color-mix(in srgb,var(--c) 10%,transparent)}@supports not (color:color-mix(in srgb,red,red)){.a{background:color-mix(in srgb,red 10%,transparent)}}', ['color-mix', 'fallback-uses-new-value']],
	['@supports (color-mix) 里的只给认它的内核', 'css', '@supports (color:color-mix(in srgb,red,red)){.a{background:color-mix(in srgb,var(--c) 10%,transparent)}}', []],
	['anywhere 无回退', 'css', '.a{overflow-wrap:anywhere}', ['overflow-wrap-anywhere']],
	['anywhere 配 @supports not 回退块', 'css', '.a{overflow-wrap:anywhere}@supports not (overflow-wrap:anywhere){.a{word-break:break-word}}', []],
	['anywhere 前置 break-word', 'css', '.a{overflow-wrap:break-word;overflow-wrap:anywhere}', []],
	['anywhere 前面别的断行声明不算回退', 'css', '.a{word-break:keep-all;overflow-wrap:anywhere}', ['overflow-wrap-anywhere']],
	['anywhere 回退块里写的不是 break-word 不算', 'css', '.a{overflow-wrap:anywhere}@supports not (overflow-wrap:anywhere){.a{word-break:keep-all}}', ['overflow-wrap-anywhere']],
	['overflow:clip 前置 hidden', 'css', '.a{overflow:hidden;overflow:clip}', []],
	['overflow:clip 无回退', 'css', '.a{overflow:clip}', ['overflow-clip']],
	['backdrop-filter 缺前缀', 'css', '.a{backdrop-filter:blur(4px)}', ['backdrop-filter']],
	['backdrop-filter 带前缀', 'css', '.a{-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}', []],
	['@layer 整块', 'css', '@layer base{.a{color:red}}', ['at-layer']],
	['text-wrap 丢了无害', 'css', '.a{text-wrap:pretty}', []],
	['lvh 自定义属性名不算单位', 'css', '.a{max-height:calc(var(--horosa-lvh, 1vh)*90)}', []],
	['dvh 单位', 'css', '.a{height:100dvh}', ['viewport-units-new']],
];

function runVector([, kind, input]){
	let hits;
	if(kind === 'jsDist'){ hits = scanJsDist(input, 'vec.js'); }
	else if(kind === 'jsSource'){ hits = scanJsSource(input, 'vec.js', 'vec.js'); }
	else{ hits = scanCss(input, 'vec.css'); }
	return [...new Set(hits.map((h)=>h.id))].sort();
}

function selfTest(){
	const failed = [];
	SELF_TEST_VECTORS.forEach((v)=>{
		const got = runVector(v);
		const want = [...v[3]].sort();
		if(JSON.stringify(got) !== JSON.stringify(want)){ failed.push(`${v[0]}:期望 ${JSON.stringify(want)} 实得 ${JSON.stringify(got)}`); }
	});
	return { total: SELF_TEST_VECTORS.length, failed };
}

const fmt = (v)=>`  [${v.layer}/${v.id}] ${v.file}${v.line ? `:${v.line}` : ''} —— ${v.detail}`;

module.exports = {
	FLOOR, JS_SYNTAX, CSS_SELECTORS, SELECTOR_ROOT_FLAGS, CSS_AT_RULE_PARAMS, HAS_FALLBACKS, CSS_VALUES, CSS_AT_RULES, JS_POLYFILLED, DIST_STRING_ALLOW,
	SRC_INLINE_COLOR_MIX_ALLOW, WRAP_ANYWHERE_FALLBACK_CLASS, SELF_TEST_VECTORS,
	regexFeatures, splitSelectorList, normSel, scanJsDist, scanJsSource, scanCss, scanCssMany, scanDist, scanSource, compileLessFile, runVector, selfTest, fmt,
};

if(require.main === module){
	const args = process.argv.slice(2);
	const mode = args[0];
	const report = (title, res)=>{
		if(res.violations.length){
			console.error(`legacy-engine-floor ${title}:❌ ${res.violations.length} 处不过目标内核 Safari ${FLOOR.safari}(macOS ${FLOOR.macos})下限`);
			res.violations.slice(0, 200).forEach((v)=>console.error(fmt(v)));
			process.exit(1);
		}
		console.log(`legacy-engine-floor ${title}:✅ 全过(${JSON.stringify(res.stats)})`);
	};
	if(mode === '--self-test'){
		const r = selfTest();
		if(r.failed.length){ console.error(`legacy-engine-floor --self-test:❌ ${r.failed.length}/${r.total} 条判别向量不如预期`); r.failed.forEach((f)=>console.error(`  ${f}`)); process.exit(1); }
		console.log(`legacy-engine-floor --self-test:✅ ${r.total} 条判别向量全如预期`);
	}else if(mode === '--dist'){
		const dir = path.resolve(args[1] || path.join(UI_ROOT, 'dist-file'));
		if(!fs.existsSync(dir)){ console.error(`legacy-engine-floor:产物目录不存在 ${dir}`); process.exit(1); }
		report(`--dist ${path.basename(dir)}`, scanDist(dir));
	}else if(mode === '--src'){
		scanSource(args[1] ? path.resolve(args[1]) : UI_ROOT).then((res)=>report('--src', res), (e)=>{ console.error(e); process.exit(1); });
	}else{
		console.error('用法:legacy-engine-floor.js --dist <产物目录> | --src [<astrostudyui 根>] | --self-test');
		process.exit(2);
	}
}
