// 写死字色对比度静态检查(全 src 的 .js / .less / .css):界面文字(DOM)上写死的字色,在三套页底上都要 ≥ 3:1。
//
// 为什么:字色写死成一个十六进制 / rgb / 颜色名,它只为一种主题挑过 —— 暗底挑的浅色到了宣纸底上 1.5–2.9:1
// (演禽吉凶 / 风水标记片 / 星盘元素图例 / 名人库空态 #999 …),亮底挑的深色到了暗底上同样看不见。
// 要随主题换的字一律用主题语义色变量(--horosa-text-secondary / -jx-* / -bazi-* / -link / -warn …,由主题合同
// themeContrastContract.test.js 逐条算过);确实画在定色底上的(定色暗面板、实底片、3D 场景上的浮层),字和底都写死、成对给出。
//
// 判据:每处写死的字色(alpha ≥ 0.7;更低的透明字由 inkDimmingGuard 管,antd 缺省墨色由 themeInkGuard 管)按它所处的底算对比度,
// 每个适用主题(亮 · 宣纸 / 亮 · 经典白 / 暗)都要 ≥ 3:1。底怎么定:
//   · 同一个样式对象 / 同一条规则(或 less 嵌套的外层规则,同主题下的覆盖规则优先)写了 background → 按它算
//     (主题变量按各主题取值解析;渐变取每个色标;半透明底先压到页底上);
//   · 定色面板里的字、但底写在别处的 → 登记 FIXED_BG(文件 + 命中处的一段原文 + 面板底色 + 理由),按登记的底色算;
//   · 都没有 → 按该主题的页底(页底 / 实底面板 / 软面板)算。
// 适用主题:less 选择器带 :root[data-horosa-appearance='light' | 'dark'] / light-flavor='classic' 的只算那一档,
// 同一选择器在别的主题有覆盖规则的,那一档由覆盖规则算;JS 里 isDark ? a : b 这类按明暗分支的只算对应那档。
// 范围:JSX 行内 style、带字体属性的样式对象、HTML 字符串 style、el.style.color / d3 .style('color')、less / css 的 color;
// JSX 里引用的同文件或相对 import 的色板常量(X[k] / X.k / 数组 .map 回调里的 e.color)也展开来算。
// 不算:svg 元素上的 style(盘面绘制)、禁用态选择器、svg 绘制规则(同规则有 fill / stroke)、@keyframes;
// 3D / canvas / 图表库的绘制参数对象(画在画布上,不是 DOM 字)登记 NON_DOM(文件 + 理由)。
// 盘面 svg / canvas 里画的字归「盘面随界面主题重画」(audit_chart_theme.py),不在本检查。
// 登记表每条都要写理由;登记了却不再命中 = 红(过期登记)。
import fs from 'fs';
import path from 'path';

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const SRC = path.resolve(__dirname, '../..');
const MIN = 3;
const read = (rel)=>fs.readFileSync(path.join(SRC, rel), 'utf8');

// ── 登记表 ──
// 定色面板:[文件, 命中处的一段原文(JS = 命中行;less = 选择器;'' = 整个文件), 面板底色, 理由]
// 登记的底色取该面板里最亮的那层(字压在最亮的片上最吃亏);半透明的片先压在它上面再算。
const FIXED_BG = [
	['components/planetarium/planetarium.less', 'planetarium', '#1e2e4f', '天文馆整页是定色夜空(.horosa-planetarium-page #050812,侧栏 rgba(7,11,24,.9),按钮 / 片最亮到 rgba(31,48,82,.95)),不随界面主题;按最亮的片算'],
	['layouts/app/02-shell.less', 'pdsphere', '#141720', '主限天球工具条 / 下拉 / 浮层恒为定色暗底(#05080f · #0b1120 · #101725,按钮 rgba(255,255,255,.07) 压在上面 ≈ #141720),不随界面主题'],
	['components/astro3d/AstroPDSphere.js', '', '#141720', '主限天球 3D 场景与它的图例 / 工具条 / 时间轴是定色暗底(#05080f / #070b14,按钮 rgba(255,255,255,.07) ≈ #141720)'],
	['components/xq-ui/styles.less', '.xq-nav-', '#29251f', '导航命令面板是品牌定色暗面板(#050607 – #0b0d10,选中卡片金色淡底压上去最亮 ≈ #29251f),亮暗主题同一套'],
	['components/common/StartupGate.js', '', '#13262a', '启动遮罩与壳启动页同款定色暗底(#0e1414 → 卡片 #121a19,主按钮墨绿淡底 ≈ #13262a),此时主题样式尚未就绪'],
	['components/acg/AcgD3Map.js', '寻宝图 ·', '#1c212a', '地图左下角图例条:底是 th.tipBg(两种地图底都取深色 rgba(16–28,20–33,28–42,.95)),金 / 蓝两色是热力图本身的色'],
	['layouts/app/04-calendar.less', 'is-medal', '#c07b45', '择日排行名次奖牌:金 / 银 / 铜定色渐变实底(两主题同值),字是定色深墨;按最深的铜色算'],
];
function fixedBase(rel, text){
	const fx = FIXED_BG.find(([f, needle])=>f === rel && `${text}`.indexOf(needle) >= 0);
	if(!fx){ return null; }
	fx.used = true;
	return [parseColor(fx[2])];
}
// 画在画布 / 3D 场景 / 图表库里的绘制参数(不是 DOM 文字):[文件, 理由]
const NON_DOM = [
	['components/astro3d/PDSphereEngine.js', '主限天球 three.js 文字精灵的绘制参数(画进 canvas 纹理,在定色暗夜空里;不是 DOM 字)'],
	['components/jinkou/JinKouPanChart.js', '金口诀盘面 d3 svg 绘制(表格格子文字经绘制助手画进 svg;盘面字归盘面主题审计)'],
];
// 其余(装饰,或静态推不出的覆盖关系):[文件, 命中处的一段原文, 理由]
const ALLOW = [
	['layouts/app/06-guolao-modules.less', ') .ant-btn-primary', '命 / 卜各页的暗色按钮组(主按钮 / 悬停 / 聚焦 = 金淡底金字)只在暗色生效:亮色下同组 `:root[light] … .ant-btn { color: var(--horosa-text) !important; background: var(--horosa-surface-solid) !important }` 压住(antd 主按钮同时带 .ant-btn 类,静态按选择器文本推不出)'],
];

// ── 颜色 ──
const NAMED = { white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000', blue: '#0000ff', gray: '#808080', grey: '#808080',
	orange: '#ffa500', yellow: '#ffff00', purple: '#800080', gold: '#ffd700', silver: '#c0c0c0', crimson: '#dc143c', navy: '#000080',
	teal: '#008080', maroon: '#800000', olive: '#808000', lime: '#00ff00', pink: '#ffc0cb', brown: '#a52a2a', darkred: '#8b0000',
	darkgreen: '#006400', lightgray: '#d3d3d3', lightgrey: '#d3d3d3', darkgray: '#a9a9a9', darkgrey: '#a9a9a9', dimgray: '#696969', dimgrey: '#696969',
	goldenrod: '#daa520', darkgoldenrod: '#b8860b', tomato: '#ff6347', orangered: '#ff4500', firebrick: '#b22222', steelblue: '#4682b4',
	royalblue: '#4169e1', dodgerblue: '#1e90ff', seagreen: '#2e8b57', forestgreen: '#228b22', slategray: '#708090', whitesmoke: '#f5f5f5' };
function parseColor(v){
	const s = `${v}`.trim().toLowerCase();
	if(NAMED[s]){ return parseColor(NAMED[s]); }
	let m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)(%?)\s*)?\)$/);
	if(m){ return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : (m[5] ? +m[4] / 100 : +m[4]) }; }
	m = s.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
	if(m){
		let h = m[1]; if(h.length <= 4){ h = h.split('').map((c)=>c + c).join(''); }
		return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
	}
	return null;
}
const over = (fg, bg)=>({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const lum = (c)=>{ const f = (x)=>{ const v = x / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
function contrast(fg, bg){ const f = over(fg, bg); const a = lum(f), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
// 只看 var(--x, 兜底) 之外的部分
const outsideFallback = (value)=>{ let v = `${value}`; let prev; do{ prev = v; v = v.replace(/var\(\s*--[\w-]+\s*,[^()]*(?:\([^()]*\)[^()]*)*\)/g, ''); }while(v !== prev); return v; };
// 写死的不透明字色:整个值就是一个颜色字面量(alpha ≥ 0.7)
function literalInk(value){
	if(value === null || value === undefined){ return null; }
	const raw = `${value}`.replace(/!important/g, '').trim();
	if(/var\(/.test(raw)){ return null; }   // 主题变量(兜底位不算)
	const c = parseColor(raw);
	return c && c.a >= 0.7 ? { c, s: raw } : null;
}

// ── 主题(01-base 的亮 / 经典白 / 暗块 + 02-shell 挂在根上的占星组)──
const BASE = read('layouts/app/01-base.less');
const SHELL = read('layouts/app/02-shell.less');
function blockVars(src, selectorLine){
	const i = src.indexOf(selectorLine);
	if(i < 0){ throw new Error(`主题块没找到:${selectorLine}`); }
	const j = src.indexOf('\n    }', i);
	const body = src.slice(i + selectorLine.length, j).replace(/\/\*[\s\S]*?\*\//g, '');
	const out = {}; const re = /(--[\w-]+)\s*:\s*([^;]+);/g; let m = re.exec(body);
	while(m){ out[m[1]] = m[2].trim(); m = re.exec(body); }
	return out;
}
const LIGHT = blockVars(BASE, '    :root {');
const CLASSIC = blockVars(BASE, "    :root[data-horosa-light-flavor='classic'] {");
const DARK = blockVars(BASE, "    :root[data-horosa-appearance='dark'] {");
const ASTRO_DARK = blockVars(SHELL, '    .ant-dropdown {');
const ASTRO_LIGHT = blockVars(SHELL, "    :root[data-horosa-appearance='light'] .ant-dropdown {");
const THEMES = {
	light: { ...ASTRO_DARK, ...ASTRO_LIGHT, ...LIGHT },
	classic: { ...ASTRO_DARK, ...ASTRO_LIGHT, ...LIGHT, ...CLASSIC },
	dark: { ...ASTRO_DARK, ...LIGHT, ...DARK },
};
const ALL_THEMES = ['light', 'classic', 'dark'];
// 解析一个值里的 var()(按主题取值,解析不到用兜底);返回解析后的文本或 null(解析不到又没兜底)
function resolveVars(theme, value, depth = 0){
	let v = `${value}`; let guard = 0;
	const re = /var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*(?:\([^()]*\)[^()]*)*\))*))?\)/;
	while(re.test(v) && guard++ < 20){
		v = v.replace(re, (m, name, fb)=>{
			const t = THEMES[theme][name];
			if(t !== undefined && depth < 8){ return resolveVars(theme, t, depth + 1) || ''; }
			return fb !== undefined ? fb.trim() : '\u0000';
		});
	}
	return v.indexOf('\u0000') >= 0 ? null : v;
}
// 底:返回该主题下的不透明底色列表;null = 这条声明不给底(透明 / 继承 / 解析不到)
function backgroundsOf(theme, value){
	if(!value){ return null; }
	const v = resolveVars(theme, `${value}`.replace(/!important/g, ''));
	if(!v || /^\s*(transparent|none|inherit|initial|unset|currentcolor)\s*$/i.test(v)){ return null; }
	const stops = [];
	const re = /#[0-9a-f]{3,8}\b|rgba?\([^()]*\)|\b[a-z]+\b/gi;
	let m = re.exec(v);
	while(m){ const c = parseColor(m[0]); if(c){ stops.push(c); } m = re.exec(v); }
	if(!stops.length){ return null; }
	if(/color-mix|url\(/i.test(v)){ return null; }
	return stops;
}
function pageBackgrounds(theme){
	const pick = (n)=>parseColor(resolveVars(theme, THEMES[theme][n]));
	const bg = pick('--horosa-bg');
	const out = [bg, pick('--horosa-surface-solid')];
	const soft = pick('--horosa-panel-soft');
	if(soft && soft.a >= 0.5){ out.push(over(soft, bg)); }
	return out;
}
const PAGE = { light: pageBackgrounds('light'), classic: pageBackgrounds('classic'), dark: pageBackgrounds('dark') };
// 字在某主题某底上的最差对比度(底半透明则压到该主题各页底上)
// base = 半透明底压在什么上(缺省该主题页底;登记的定色面板则压在面板底上)
function worstOn(ink, theme, bgs, base){
	let w = 99;
	const under = base || PAGE[theme];
	(bgs || under).forEach((b)=>{
		const layers = b.a >= 0.999 ? [b] : under.map((p)=>over(b, p));
		layers.forEach((l)=>{ w = Math.min(w, contrast(ink, l)); });
	});
	return w;
}
const fmt = (c)=>`#${[c.r, c.g, c.b].map((x)=>Math.round(x).toString(16).padStart(2, '0')).join('')}`;

// ════════════════ JS ════════════════
const PARSE_OPTS = { sourceType: 'module', plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport', 'exportDefaultFrom', 'decorators-legacy'] };
const SVG_TAGS = new Set('svg g text tspan textPath line path circle rect ellipse polygon polyline defs marker use image foreignObject clipPath mask pattern linearGradient radialGradient stop symbol'.split(' '));
const TEXT_PROPS = /^(fontSize|fontWeight|fontFamily|lineHeight|letterSpacing|whiteSpace|textAlign|fontStyle|textOverflow|wordBreak|fontVariantNumeric|textDecoration)$/;
const keyName = (p)=>p && p.key && (p.key.name || p.key.value);
const tagName = (o)=>{ const n = o.name; if(n.type === 'JSXIdentifier'){ return n.name; } if(n.type === 'JSXMemberExpression'){ return n.property.name; } return ''; };
const DARK_TEST = /(?:^|[^\w])(?:is)?dark(?:mode|theme)?(?:[^\w]|$)|appearance\s*={2,3}\s*['"]dark['"]|['"]dark['"]\s*={2,3}/i;
const LIGHT_TEST = /(?:^|[^\w])(?:is)?light(?:mode|theme)?(?:[^\w]|$)|appearance\s*={2,3}\s*['"]light['"]|['"]light['"]\s*={2,3}/i;

const MODULES = new Map();
function moduleAst(abs){
	if(MODULES.has(abs)){ return MODULES.get(abs); }
	let ast = null;
	try{ ast = parser.parse(fs.readFileSync(abs, 'utf8'), PARSE_OPTS); }catch(e){ ast = null; }
	MODULES.set(abs, ast);
	return ast;
}
function resolveImport(fromFile, spec){
	if(!/^\./.test(spec)){ return null; }
	const base = path.resolve(path.dirname(fromFile), spec);
	const cands = [base, `${base}.js`, path.join(base, 'index.js')];
	return cands.find((c)=>fs.existsSync(c) && fs.statSync(c).isFile()) || null;
}
// 模块顶层的 const 初值 / export
function topLevelInit(ast, name){
	if(!ast){ return null; }
	for(const st of ast.program.body){
		const decl = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
		if(decl && decl.type === 'VariableDeclaration'){
			for(const d of decl.declarations){ if(d.id.type === 'Identifier' && d.id.name === name && d.init){ return d.init; } }
		}
	}
	return null;
}
function propValues(obj, prop){
	const out = [];
	obj.properties.forEach((p)=>{
		if(p.type !== 'ObjectProperty'){ return; }
		if(prop === null || keyName(p) === prop){ out.push(p.value); }
	});
	return out;
}
// 求值:返回 [{ v: 字符串, themes }](只收能静态拿到的字符串;对象 / 数组用 kind 返回给成员访问)
function evalNode(node, ctx, depth = 0, themes = ALL_THEMES, scope = null){
	if(!node || depth > 6){ return []; }
	switch(node.type){
	case 'StringLiteral': return [{ v: node.value, themes }];
	case 'TemplateLiteral': return node.expressions.length ? [] : [{ v: node.quasis[0].value.cooked, themes }];
	case 'ConditionalExpression': {
		const src = ctx.src.slice(node.test.start, node.test.end);
		let a = themes; let b = themes;
		if(DARK_TEST.test(src) && !LIGHT_TEST.test(src)){ a = themes.filter((t)=>t === 'dark'); b = themes.filter((t)=>t !== 'dark'); }
		else if(LIGHT_TEST.test(src) && !DARK_TEST.test(src)){ a = themes.filter((t)=>t !== 'dark'); b = themes.filter((t)=>t === 'dark'); }
		return [...evalNode(node.consequent, ctx, depth + 1, a, scope), ...evalNode(node.alternate, ctx, depth + 1, b, scope)];
	}
	case 'LogicalExpression': return [...evalNode(node.left, ctx, depth + 1, themes, scope), ...evalNode(node.right, ctx, depth + 1, themes, scope)];
	case 'Identifier': {
		// 常量的初值若是 isDark ? a : b,要按明暗分支走 evalNode(evalObj 不分主题)
		const b = scope && scope.getBinding(node.name);
		let init = null;
		if(b && b.kind === 'const' && b.path.isVariableDeclarator() && b.path.node.id.type === 'Identifier' && b.path.node.init){ init = b.path.node.init; }
		else if(!b || b.scope.path.type === 'Program'){ init = topLevelInit(ctx.ast, node.name); }
		if(init && (init.type === 'ConditionalExpression' || init.type === 'LogicalExpression')){
			return evalNode(init, ctx, depth + 1, themes, b ? b.path.scope : ctx.programScope);
		}
	}
	// falls through
	case 'MemberExpression':
	case 'OptionalMemberExpression': {
		const objs = evalObj(node, ctx, depth + 1, scope);
		const out = [];
		objs.forEach((o)=>{ if(o.str !== undefined){ out.push({ v: o.str, themes }); } });
		return out;
	}
	default: return [];
	}
}
// 把表达式求成「值节点」集合:{ node, ctx }(对象 / 数组 / 字符串);跟同文件顶层常量与相对 import
function evalObj(node, ctx, depth, scope = null){
	if(!node || depth > 6){ return []; }
	if(node.type === 'StringLiteral'){ return [{ str: node.value }]; }
	if(node.type === 'TemplateLiteral' && !node.expressions.length){ return [{ str: node.quasis[0].value.cooked }]; }
	if(node.type === 'ObjectExpression' || node.type === 'ArrayExpression'){ return [{ node, ctx }]; }
	if(node.type === 'ConditionalExpression'){ return [...evalObj(node.consequent, ctx, depth + 1, scope), ...evalObj(node.alternate, ctx, depth + 1, scope)]; }
	if(node.type === 'LogicalExpression'){ return [...evalObj(node.left, ctx, depth + 1, scope), ...evalObj(node.right, ctx, depth + 1, scope)]; }
	if(node.type === 'Identifier'){
		// 数组 .map / .forEach … 回调参数:展开成数组元素
		const el0 = ctx.callbackParams && ctx.callbackParams.get(node);
		if(el0){ return el0.flatMap((arr)=>arr.node.type === 'ArrayExpression' ? arr.node.elements.flatMap((e)=>evalObj(e, arr.ctx, depth + 1)) : []); }
		// 局部 const(函数体内 const color = X[k] || Y)
		const b = scope && scope.getBinding(node.name);
		if(b && b.kind === 'const' && b.path.isVariableDeclarator() && b.path.node.id.type === 'Identifier' && b.path.node.init && b.scope.path.type !== 'Program'){
			return evalObj(b.path.node.init, ctx, depth + 1, b.path.scope);
		}
		// 本文件顶层常量
		const init = topLevelInit(ctx.ast, node.name);
		if(init){ return evalObj(init, ctx, depth + 1, ctx.programScope); }
		// 相对 import
		const imp = ctx.imports[node.name];
		if(imp && imp.kind === 'named'){
			const m = moduleCtx(imp.file);
			const i2 = m && topLevelInit(m.ast, imp.name);
			return i2 ? evalObj(i2, m, depth + 1) : [];
		}
		if(imp && imp.kind === 'ns'){ return [{ ns: imp.file }]; }
		return [];
	}
	if(node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression'){
		const bases = evalObj(node.object, ctx, depth + 1, scope);
		const out = [];
		bases.forEach((b)=>{
			if(b.ns){
				if(node.computed){ return; }
				const m = moduleCtx(b.ns);
				const i2 = m && topLevelInit(m.ast, node.property.name);
				if(i2){ out.push(...evalObj(i2, m, depth + 1)); }
				return;
			}
			if(!b.node){ return; }
			if(b.node.type === 'ObjectExpression'){
				const key = node.computed ? (node.property.type === 'StringLiteral' ? node.property.value : null) : node.property.name;
				propValues(b.node, key).forEach((v)=>out.push(...evalObj(v, b.ctx, depth + 1, b.ctx === ctx ? scope : null)));
			}else if(b.node.type === 'ArrayExpression' && node.computed){
				b.node.elements.forEach((e)=>out.push(...evalObj(e, b.ctx, depth + 1, b.ctx === ctx ? scope : null)));
			}
		});
		return out;
	}
	return [];
}
const CTX_CACHE = new Map();
function moduleCtx(abs){
	if(CTX_CACHE.has(abs)){ return CTX_CACHE.get(abs); }
	const ast = moduleAst(abs);
	const ctx = ast ? { ast, src: fs.readFileSync(abs, 'utf8'), file: abs, imports: importsOf(ast, abs) } : null;
	CTX_CACHE.set(abs, ctx);
	return ctx;
}
function importsOf(ast, abs){
	const out = {};
	ast.program.body.forEach((st)=>{
		if(st.type !== 'ImportDeclaration'){ return; }
		const file = resolveImport(abs, st.source.value);
		if(!file){ return; }
		st.specifiers.forEach((s)=>{
			if(s.type === 'ImportSpecifier'){ out[s.local.name] = { kind: 'named', file, name: s.imported.name || s.imported.value }; }
			else if(s.type === 'ImportNamespaceSpecifier' || s.type === 'ImportDefaultSpecifier'){ out[s.local.name] = { kind: 'ns', file }; }
		});
	});
	return out;
}

function scanJs(rel, src, abs){
	let ast;
	try{ ast = parser.parse(src, PARSE_OPTS); }catch(e){ return [`${rel}: 解析失败 ${e.message}`]; }
	const ctx = { ast, src, file: abs || path.join(SRC, rel), imports: abs ? importsOf(ast, abs) : {}, callbackParams: new Map() };
	const lines = src.split('\n');
	const hits = [];
	traverse(ast, { Program(p){ ctx.programScope = p.scope; p.stop(); } });
	// 数组 .map / .forEach / .filter 回调的第一个参数 → 数组本身(供 e.color 展开)
	traverse(ast, {
		CallExpression(p){
			const c = p.node.callee;
			if(!(c.type === 'MemberExpression' && !c.computed && /^(map|forEach|filter|flatMap|find|some|every)$/.test(c.property.name))){ return; }
			const fn = p.node.arguments[0];
			if(!fn || !/FunctionExpression$/.test(fn.type) || !fn.params[0] || fn.params[0].type !== 'Identifier'){ return; }
			let base = c.object;
			// X.filter(...).map(e => …) 这类链:取最里层的数组
			while(base.type === 'CallExpression' && base.callee.type === 'MemberExpression' && /^(filter|slice|concat|sort)$/.test(base.callee.property.name)){ base = base.callee.object; }
			const arrs = evalObj(base, ctx, 0).filter((x)=>x.node && x.node.type === 'ArrayExpression');
			if(!arrs.length){ return; }
			const name = fn.params[0].name;
			p.get('arguments.0').traverse({ Identifier(q){ if(q.node.name === name && q.isReferencedIdentifier()){ ctx.callbackParams.set(q.node, arrs); } } });
		},
	});
	const check = (valueNode, bgNode, node, what, scope)=>{
		const vals = evalNode(valueNode, ctx, 0, ALL_THEMES, scope);
		const bgVals = bgNode ? evalNode(bgNode, ctx, 0, ALL_THEMES, scope) : [];
		const base = fixedBase(rel, lines[node.loc.start.line - 1]);
		vals.forEach(({ v, themes })=>{
			const ink = literalInk(v);
			if(!ink){ return; }
			themes.forEach((t)=>{
				const bgs = bgVals.length ? bgVals.map((b)=>backgroundsOf(t, b.v)).filter(Boolean).flat() : [];
				if(bgs.length && bgs.every((b)=>b.a >= 0.999 && fmt(b) === fmt(ink.c))){ return; }   // 字与底同色 = 色块,无字
				const ratio = worstOn(ink.c, t, bgs.length ? bgs : null, base);
				if(ratio < MIN){
					const ln = node.loc.start.line;
					hits.push({ at: `${rel}:${ln}`, line: lines[ln - 1], msg: `${rel}:${ln} ${what} ${ink.s} · ${t}${bgs.length ? ` 底 ${bgVals.map((b)=>b.v).join(' / ')}` : ' 页底'} = ${ratio.toFixed(2)} | ${lines[ln - 1].trim().slice(0, 120)}` });
				}
			});
		});
	};
	const bgOf = (obj)=>{
		const p = obj.properties.find((x)=>x.type === 'ObjectProperty' && /^(background|backgroundColor)$/.test(keyName(x)));
		return p ? p.value : null;
	};
	traverse(ast, {
		ObjectProperty(p){
			if(keyName(p.node) !== 'color'){ return; }
			const obj = p.parentPath.node;
			if(obj.type !== 'ObjectExpression'){ return; }
			const holder = p.parentPath.parentPath; const attr = holder && holder.parentPath;
			const isStyle = holder && holder.node.type === 'JSXExpressionContainer' && attr && attr.node.type === 'JSXAttribute' && attr.node.name.name === 'style';
			if(isStyle){
				const opening = attr.parentPath.node;
				if(SVG_TAGS.has(tagName(opening))){ return; }
				for(let q = attr.parentPath.parentPath; q; q = q.parentPath){ if(q.node.type === 'JSXElement' && SVG_TAGS.has(tagName(q.node.openingElement))){ return; } }
				check(p.node.value, bgOf(obj), p.node, 'style.color', p.scope);
				return;
			}
			// 不直接挂在元素上的:带字体属性的才算文字样式(3D / 画布绘制参数登记 NON_DOM)
			const props = obj.properties.filter((x)=>x.type === 'ObjectProperty').map(keyName);
			if(props.some((k)=>TEXT_PROPS.test(k))){ check(p.node.value, bgOf(obj), p.node, '文字样式对象 color'); }
		},
		CallExpression(p){
			// d3 / jQuery 式 .style('color', v)
			const c = p.node.callee; const a = p.node.arguments;
			if(c.type === 'MemberExpression' && !c.computed && c.property.name === 'style' && a.length >= 2 && a[0].type === 'StringLiteral' && a[0].value === 'color'){
				check(a[1], null, p.node, ".style('color')", p.scope);
			}
		},
		AssignmentExpression(p){
			// el.style.color = v
			const l = p.node.left;
			if(l.type === 'MemberExpression' && !l.computed && l.property.name === 'color' && l.object.type === 'MemberExpression' && !l.object.computed && l.object.property.name === 'style'){
				check(p.node.right, null, p.node, 'style.color =', p.scope);
			}
		},
		JSXAttribute(p){
			// 底在行内(色板实底)、字色在 less 类里(.pill { color: #fff }):按类的字色 × 行内底算
			if(p.node.name.name !== 'style' || !p.node.value || p.node.value.type !== 'JSXExpressionContainer'){ return; }
			const obj = p.node.value.expression;
			if(obj.type !== 'ObjectExpression' || obj.properties.some((x)=>x.type === 'ObjectProperty' && keyName(x) === 'color')){ return; }
			const bgNode = bgOf(obj);
			if(!bgNode){ return; }
			const opening = p.parentPath.node;
			if(SVG_TAGS.has(tagName(opening))){ return; }
			const cn = opening.attributes.find((a)=>a.type === 'JSXAttribute' && a.name.name === 'className');
			if(!cn || !cn.value){ return; }
			const cnText = cn.value.type === 'StringLiteral' ? cn.value.value
				: (cn.value.type === 'JSXExpressionContainer' && cn.value.expression.type === 'TemplateLiteral' ? cn.value.expression.quasis.map((q)=>q.value.cooked).join(' ') : '');
			const classes = cnText.split(/\s+/).filter(Boolean);
			const bgVals = evalNode(bgNode, ctx, 0, ALL_THEMES, p.scope);
			if(!bgVals.length){ return; }
			const ln = p.node.loc.start.line;
			classes.forEach((c)=>{
				const inks = SELFTEST_CLASS_INK.get(c) || classInk().get(c);
				if(!inks){ return; }
				ALL_THEMES.forEach((t)=>{
					const e = inks.filter((x)=>x.themes.includes(t)).sort((a, b)=>a.themes.length - b.themes.length)[0];
					const ink = e && parseColor(resolveVars(t, e.value) || '');
					if(!ink){ return; }
					const bgs = bgVals.map((b)=>backgroundsOf(t, b.v)).filter(Boolean).flat();
					if(!bgs.length){ return; }
					const ratio = worstOn(ink, t, bgs, fixedBase(rel, lines[ln - 1]));
					if(ratio < MIN){
						hits.push({ at: `${rel}:${ln}`, line: lines[ln - 1], msg: `${rel}:${ln} 行内底 × .${c} 字色 ${e.value} · ${t} 底 ${bgVals.map((b)=>b.v).join(' / ')} = ${ratio.toFixed(2)} | ${lines[ln - 1].trim().slice(0, 120)}` });
					}
				});
			});
		},
		'StringLiteral|TemplateElement'(p){
			const raw = p.node.type === 'StringLiteral' ? p.node.value : p.node.value.cooked;
			if(!raw || raw.indexOf('style=') < 0){ return; }
			const re = /style=\\?["']([^"']*)\\?["']/g;
			let m = re.exec(raw);
			while(m){
				const st = m[1];
				const col = st.match(/(?:^|;)\s*color\s*:\s*([^;]+)/);
				const bg = st.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/);
				if(col){
					const ink = literalInk(col[1]);
					if(ink){
						ALL_THEMES.forEach((t)=>{
							const bgs = bg ? backgroundsOf(t, bg[1]) : null;
							const ratio = worstOn(ink.c, t, bgs, fixedBase(rel, lines[p.node.loc.start.line - 1]));
							if(ratio < MIN){
								const ln = p.node.loc.start.line;
								hits.push({ at: `${rel}:${ln}`, line: lines[ln - 1], msg: `${rel}:${ln} HTML 字符串 color ${ink.s} · ${t} = ${ratio.toFixed(2)}` });
							}
						});
					}
				}
				m = re.exec(raw);
			}
		},
	});
	return hits;
}

// ════════════════ LESS / CSS ════════════════
function stripLessComments(s){
	let t = s.replace(/\/\*[\s\S]*?\*\//g, (m)=>m.replace(/[^\n]/g, ' '));
	t = t.replace(/(^|[^:'"\\])\/\/[^\n]*/g, (m, p1)=>p1 + ' '.repeat(m.length - p1.length));
	return t;
}
// 按顶层逗号切选择器(括号里的逗号不切)
function splitSel(sel){
	const out = []; let depth = 0; let cur = '';
	for(const ch of sel){
		if(ch === '(' ){ depth++; } else if(ch === ')'){ depth--; }
		if(ch === ',' && depth === 0){ out.push(cur.trim()); cur = ''; } else { cur += ch; }
	}
	if(cur.trim()){ out.push(cur.trim()); }
	return out;
}
const AT_PASS = /^@(media|supports|container|document)\b/;
// 主题限定:返回 { themes, key }
const THEME_Q = [
	[/:root:not\(\[data-horosa-appearance=['"]?dark['"]?\]\)/g, ['light', 'classic']],
	[/:root:not\(\[data-horosa-appearance=['"]?light['"]?\]\)/g, ['dark']],
	[/(?::root|html|body)?\[data-horosa-light-flavor=['"]?classic['"]?\]/g, ['classic']],
	[/(?::root|html|body)?\[data-horosa-appearance=['"]?dark['"]?\]/g, ['dark']],
	[/(?::root|html|body)?\[data-horosa-appearance=['"]?light['"]?\]/g, ['light', 'classic']],
];
function qualify(full){
	let themes = ALL_THEMES; let k = full;
	THEME_Q.forEach(([re, ts])=>{
		if(re.test(k)){ themes = themes.filter((t)=>ts.includes(t)); }
		re.lastIndex = 0;
		k = k.replace(re, ' ');
	});
	k = k.replace(/:global\(\s*([^()]*(?:\([^()]*\)[^()]*)*)\)/g, '$1').replace(/:global\b/g, ' ').replace(/(^|\s):root(?=\s|$)/g, ' ')
		.replace(/\(\s*\)/g, ' ').replace(/\s+/g, ' ').trim();
	return { themes, key: k };
}
// 规则表:每条 = { sels: [{ full, themes, key }], decls, parent, line }
function lessRules(src){
	const s = stripLessComments(src);
	const vars = {};
	s.replace(/(?:^|\n)\s*@([\w-]+)\s*:\s*([^;{}]+);/g, (m, k, v)=>{ vars[k] = v.trim(); return m; });
	const subst = (v)=>v.replace(/@\{?([\w-]+)\}?/g, (m, k)=>(vars[k] !== undefined ? vars[k] : m));
	const rules = [];
	const root = { sels: [{ full: '', themes: ALL_THEMES, key: '' }], decls: [], parent: null, at: false };
	const stack = [root];
	let buf = ''; let bufLine = 1; let line = 1; let dp = 0;
	const flush = ()=>{
		const t = buf.trim();
		if(t){ const m = t.match(/^([a-zA-Z-]+)\s*:\s*([\s\S]+)$/); if(m){ stack[stack.length - 1].decls.push({ prop: m[1].toLowerCase(), value: subst(m[2].trim()), line: bufLine }); } }
		buf = '';
	};
	for(let i = 0; i < s.length; i++){
		const c = s[i];
		if(c === '\n'){ line++; }
		if(c === '('){ dp++; } if(c === ')'){ dp = Math.max(0, dp - 1); }
		if(dp === 0 && c === '{'){
			const sel = buf.trim().replace(/\s+/g, ' ');
			const parent = stack[stack.length - 1];
			let sels;
			if(AT_PASS.test(sel) || sel === ':global' || sel === '' ){ sels = parent.sels; }
			else if(/^@/.test(sel)){ sels = [{ full: sel, themes: [], key: sel }]; }
			else{
				sels = [];
				parent.sels.forEach((ps)=>splitSel(sel).forEach((cs)=>{
					const full = cs.indexOf('&') >= 0 ? cs.replace(/&/g, ps.full) : `${ps.full} ${cs}`.trim();
					sels.push({ full, ...qualify(full) });
				}));
			}
			const rule = { sels, decls: [], parent, line: bufLine, sel, at: /^@keyframes/.test(sel) || parent.at };
			rules.push(rule); stack.push(rule); buf = ''; continue;
		}
		if(dp === 0 && c === ';'){ flush(); continue; }
		if(dp === 0 && c === '}'){ flush(); if(stack.length > 1){ stack.pop(); } continue; }
		if(!buf.trim()){ bufLine = line; }
		buf += c;
	}
	return rules;
}
const INACTIVE_SEL = /:disabled|\[disabled\]|disabled|[-.]is-(?:off|busy|loading)(?![\w-])/i;

function scanLess(rel, src){
	const rules = lessRules(src);
	// 按 key 收「谁在哪个主题声明了 color / background」
	const byKey = new Map();
	rules.forEach((r)=>r.sels.forEach((s)=>{
		if(!byKey.has(s.key)){ byKey.set(s.key, []); }
		byKey.get(s.key).push({ rule: r, sel: s });
	}));
	const declOf = (r, prop)=>{
		const ds = r.decls.filter((d)=>(prop === 'background' ? /^background(-color)?$/.test(d.prop) : d.prop === prop));
		return ds.length ? ds[ds.length - 1] : null;
	};
	// 某 key 在某主题下最具体的一条声明(主题集越窄越优先;同宽取源码靠后)
	const pickFor = (key, theme, prop)=>{
		const cands = (byKey.get(key) || []).filter((x)=>x.sel.themes.includes(theme) && declOf(x.rule, prop));
		if(!cands.length){ return null; }
		cands.sort((a, b)=>(a.sel.themes.length - b.sel.themes.length) || (b.rule.line - a.rule.line));
		return { ...cands[0], decl: declOf(cands[0].rule, prop) };
	};
	// 最后一个复合选择器里的类名集合(.a.b:hover → [a, b])
	const lastClasses = (key)=>{
		const parts = key.replace(/::?[\w-]+(\([^()]*\))?/g, '').split(/[\s>+~]+/).filter(Boolean);
		const last = parts[parts.length - 1] || '';
		return (last.match(/\.[\w一-龥-]+/g) || []);
	};
	const variantBackgrounds = (key, theme)=>{
		const mine = lastClasses(key);
		const out = [];
		byKey.forEach((list, k2)=>{
			if(k2 === key){ return; }
			const theirs = lastClasses(k2);
			// 同一元素:末段类名是超集(.pill.cat-a),或整条是更具体上下文下的同一选择器(.group-good .head span)
			if(!(mine.length && mine.every((c)=>theirs.includes(c))) && !k2.endsWith(` ${key}`)){ return; }
			const pick = list.filter((x)=>x.sel.themes.includes(theme) && declOf(x.rule, 'background') && !declOf(x.rule, 'color'));
			pick.forEach((x)=>{
				const v = declOf(x.rule, 'background').value;
				const b = backgroundsOf(theme, v);
				if(b){ out.push({ bgs: b, value: v }); }
			});
		});
		return out;
	};
	const hits = [];
	rules.forEach((r)=>{
		if(r.at){ return; }
		const paint = r.decls.some((d)=>/^(?:fill|stroke)(?:-|$)/.test(d.prop));
		const d = declOf(r, 'color');
		if(!d || paint){ return; }
		const ink = literalInk(d.value);
		if(!ink){ return; }
		r.sels.forEach((s)=>{
			if(INACTIVE_SEL.test(s.full)){ return; }
			s.themes.forEach((t)=>{
				// 同 key 在本主题有更窄的覆盖规则写了 color → 那一档由它算
				const winner = pickFor(s.key, t, 'color');
				if(winner && winner.rule !== r && winner.sel.themes.length < s.themes.length){ return; }
				// 交互态(:hover / :focus …)的字色被该主题下同元素「常态 + !important」的字色压住
				if(!/!important/.test(d.value)){
					const baseKey = s.key.replace(/:(?:hover|focus|active|focus-visible|focus-within)\b/g, '');
					const imp = baseKey !== s.key && (byKey.get(baseKey) || []).some((x)=>x.sel.themes.includes(t) && x.sel.themes.length < s.themes.length
						&& declOf(x.rule, 'color') && /!important/.test(declOf(x.rule, 'color').value));
					if(imp){ return; }
				}
				// 底:本 key 本主题 → 外层规则(同主题)→ 登记的定色面板 → 页底
				let bgs = null; let bgFrom = '页底';
				const keys = [s.key];
				for(let q = r.parent; q && q.parent; q = q.parent){
					const anc = q.sels.find((x)=>x.full && s.full.startsWith(x.full) && x.full !== s.full);
					if(anc){ keys.push(anc.key); }
				}
				// 平铺写法的外层(.chip.is-selected .chip-top → .chip.is-selected)
				const segs = s.key.split(/\s*[\s>+~]\s*/).filter(Boolean);
				for(let n = segs.length - 1; n >= 1; n--){
					const prefix = s.key.slice(0, s.key.lastIndexOf(segs[n])).replace(/[\s>+~]+$/, '').trim();
					if(prefix && !keys.includes(prefix)){ keys.push(prefix); }
				}
				for(const k of keys){
					const hit = k ? pickFor(k, t, 'background') : null;
					const b = hit && backgroundsOf(t, hit.decl.value);
					if(b){ bgs = b; bgFrom = hit.decl.value.slice(0, 60); break; }
				}
				// 本规则只给字色、底由「同一元素的变体规则」给(.pill.cat-x { background } / .row.is-up .badge { background }):
				// 变体自己不再写字色的,每个变体底都要算
				if(!bgs){
					const vb = variantBackgrounds(s.key, t);
					if(vb.length){ bgs = vb.flatMap((x)=>x.bgs); bgFrom = `变体底 ${vb.map((x)=>x.value.slice(0, 40)).join(' / ')}`; }
				}
				const base = fixedBase(rel, s.full);
				if(base){ bgFrom = `登记底 ${fmt(base[0])}${bgs ? ` 上的 ${bgFrom}` : ''}`; }
				if(bgs && bgs.some((b)=>b.a >= 0.999 && fmt(b) === fmt(ink.c))){ return; }   // 字与底(或底的色标)同色 = 色块(图例点),无字
				const ratio = worstOn(ink.c, t, bgs, base);
				if(ratio < MIN){ hits.push({ at: `${rel}:${d.line}`, line: s.full, msg: `${rel}:${d.line} color ${ink.s} · ${t} 底 ${bgFrom} = ${ratio.toFixed(2)} | ${s.full.length > 160 ? `${s.full.slice(0, 70)} … ${s.full.slice(-80)}` : s.full}` }); }
			});
		});
	});
	return hits;
}

// ════════════════ 汇总 ════════════════
function walk(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const p = path.join(dir, e.name);
		if(e.isDirectory()){ if(e.name === '__tests__' || e.name === 'node_modules' || e.name.startsWith('.umi')){ return; } walk(p, out); }
		else if(/\.(less|css|js)$/.test(e.name)){ out.push(p); }
	});
	return out;
}
const FILES = walk(SRC, []);
// less 里「单个类」的字色(供 JSX 行内底 × 类字色配对):类名 → [{ value, themes }]
let CLASS_INK = null;
const SELFTEST_CLASS_INK = new Map([['t-pill-white', [{ value: '#fff', themes: ALL_THEMES }]], ['t-pill-solid', [{ value: 'var(--horosa-on-solid)', themes: ALL_THEMES }]]]);
function classInk(){
	if(CLASS_INK){ return CLASS_INK; }
	CLASS_INK = new Map();
	FILES.filter((f)=>!f.endsWith('.js')).forEach((f)=>{
		lessRules(fs.readFileSync(f, 'utf8')).forEach((r)=>{
			if(r.at){ return; }
			const d = r.decls.filter((x)=>x.prop === 'color').pop();
			if(!d){ return; }
			r.sels.forEach((sel)=>{
				const parts = sel.key.split(/[\s>+~]+/).filter(Boolean);
				const last = parts[parts.length - 1] || '';
				const m = last.match(/^\.([\w-]+)$/);   // 只认「末段就是一个类」(带状态 / 变体的不算缺省字色)
				if(!m){ return; }
				if(!CLASS_INK.has(m[1])){ CLASS_INK.set(m[1], []); }
				CLASS_INK.get(m[1]).push({ value: d.value, themes: sel.themes });
			});
		});
	});
	return CLASS_INK;
}
function allHits(){
	const out = [];
	FILES.forEach((f)=>{
		// horosa_win_pathsep_posix_v1(Windows 侧移植适配;建议上游化):`path.relative` 在 Windows 返回反斜杠分隔
		// (`components\acg\AcgD3Map.js`),而 ALLOW / FIXED_BG / NON_DOM 三张登记表都按 POSIX 写法比对 ⇒ 画布文件不再跳过、
		// 定色面板的登记底色不生效、合法登记全被报成违规且登记表反被判「过期」(macOS 恒绿)。归一到 POSIX;判据零放宽。
		const rel = path.relative(SRC, f).split(path.sep).join('/');
		const src = fs.readFileSync(f, 'utf8');
		if(rel.endsWith('.js')){
			if(!/color|background/i.test(src) || NON_DOM.some(([nf])=>nf === rel)){ return; }
			out.push(...scanJs(rel, src, f));
		}else{
			out.push(...scanLess(rel, src));
		}
	});
	return out;
}
const allowed = (h)=>ALLOW.find(([f, needle])=>h.at.startsWith(`${f}:`) && `${h.line}`.indexOf(needle) >= 0);

describe('写死的字色在三套页底上都要 ≥ 3:1(否则用主题语义色,或字与底成对写死)', ()=>{
	it('判据自证:构造的坏样本必须被抓到、好样本放过', ()=>{
		const js = (code)=>scanJs('t.js', code).map((h)=>h.msg);
		// 坏:暗底挑的浅色压宣纸底 / 亮底挑的深色压暗底 / 灰 #999 / 常量色板 / 数组回调 / HTML 字符串 / d3
		expect(js("const a = <span style={{ color: '#f0c060' }}>金</span>;")).toHaveLength(2);
		expect(js("const a = <span style={{ color: '#222' }}>x</span>;")).toHaveLength(1);
		expect(js("const a = <div style={{ color: '#999', padding: 12 }}>空</div>;")).toHaveLength(2);
		expect(js("const C = { 吉: '#7cb342', 凶: '#c0392b' }; const a = <b style={{ color: C[k] }}>{k}</b>;").length).toBeGreaterThan(0);
		expect(js("const L = [{ n: '火', color: '#e8804f' }]; const a = L.map((e)=><i style={{ color: e.color }}>{e.n}</i>);").length).toBeGreaterThan(0);
		expect(js("const h = '<b style=\"color:#d4a017\">x</b>';").length).toBeGreaterThan(0);
		expect(js("sel.style('color', '#bbb');").length).toBeGreaterThan(0);
		expect(js("const S = { a: '#e08a4b' }; function f(k){ const color = S[k] || 'var(--horosa-gold)'; return <i style={{ color }}>x</i>; }").length).toBeGreaterThan(0);
		expect(js("function f(){ const color = 'var(--horosa-gold)'; return <i style={{ color }}>x</i>; }")).toHaveLength(0);
		// 行内色板实底 × less 类字色
		expect(js("const C = { good: '#27AE60' }; const a = <span className=\"t-pill-white\" style={{ background: C.good }}>1</span>;")).toHaveLength(3);
		expect(js("const a = <span className=\"t-pill-solid\" style={{ background: 'var(--horosa-jx-ji)' }}>1</span>;")).toHaveLength(0);
		expect(js("const a = <span className=\"t-pill-solid\" style={{ background: '#27AE60' }}>1</span>;")).toHaveLength(2);
		expect(js("el.style.color = '#ccc';").length).toBeGreaterThan(0);
		expect(js("const t = { fontSize: 12, color: '#aaa' };").length).toBeGreaterThan(0);
		expect(js("const a = <b style={{ background: '#d4a017', color: '#fff' }}>门</b>;")).toHaveLength(3);
		// 好:主题变量 / 成对定色 / svg / 按明暗分支 / 绘制参数(无字体属性)/ 兜底位
		expect(js("const a = <span style={{ color: 'var(--horosa-text-secondary)' }}>x</span>;")).toHaveLength(0);
		expect(js("const a = <span style={{ color: 'var(--horosa-x, #f0c060)' }}>x</span>;")).toHaveLength(0);
		expect(js("const a = <b style={{ background: '#0b0d10', color: '#f2cf91' }}>x</b>;")).toHaveLength(0);
		expect(js("const a = <svg><text style={{ color: '#f0c060' }}>子</text></svg>;")).toHaveLength(0);
		expect(js("const a = <span style={{ color: isDark ? '#efe6d2' : '#1c1611' }}>x</span>;")).toHaveLength(0);
		expect(js("function f(){ const dark = isDarkNow(); const txt = dark ? '#cabb92' : '#463919'; return <span style={{ color: txt }}>x</span>; }")).toHaveLength(0);
		expect(js("const m = makeSprite('x', { worldSize: 7, color: '#ffffff' });")).toHaveLength(0);
		expect(js("const a = <span style={{ color: 'inherit' }}>x</span>;")).toHaveLength(0);
		expect(js("const a = <b style={{ background: 'var(--horosa-accent)', color: 'var(--horosa-on-accent)' }}>x</b>;")).toHaveLength(0);
		// 实底随主题换值、字却写死:暗色 accent 是浅金,白字不够
		expect(js("const a = <b style={{ background: 'var(--horosa-accent)', color: '#fff' }}>x</b>;")).toHaveLength(1);
		const less = (code)=>scanLess('t.less', code).map((h)=>h.msg);
		expect(less('.a { color: #e8c07a; }')).toHaveLength(2);
		expect(less(":root[data-horosa-appearance='dark'] .a { color: #5e548e; }")).toHaveLength(1);
		expect(less(":root[data-horosa-appearance='dark'] .a { color: #e8c07a; }")).toHaveLength(0);
		// 基础规则是暗色挑的,亮色有覆盖 → 只算暗色那档
		expect(less(".a { color: #e8c07a; } :root[data-horosa-appearance='light'] .a { color: var(--horosa-text); }")).toHaveLength(0);
		expect(less(":global { .p { .a { color: #e8c07a; } } :root[data-horosa-appearance='light'] .p .a { color: #7a541c; } }")).toHaveLength(0);
		// 字与底成对(同规则 / 外层规则)
		expect(less('.a { background: #0b0d10; color: #e8c07a; }')).toHaveLength(0);
		expect(less('.p { background: #0b0d10; .a { color: #e8c07a; } }')).toHaveLength(0);
		expect(less('.p { background: #0b0d10; .a { color: #2b2620; } }').length).toBeGreaterThan(0);
		expect(less('.chip.is-sel { background: #9a6a25; } .chip.is-sel .top { color: #fff; }')).toHaveLength(0);
		expect(less('.a { background: var(--horosa-accent); color: #fff; }')).toHaveLength(1);
		// 底写在同一元素的变体规则上:每个变体底都算
		expect(less('.pill { color: #fff; } .pill.cat-a { background: #9a6a25; } .pill.cat-b { background: #0e7383; }')).toHaveLength(0);
		expect(less('.badge { color: #fff; } .w.is-up .badge { background: var(--horosa-jade); }')).toHaveLength(1);
		expect(less('.a { background: var(--horosa-accent); color: var(--horosa-on-accent); }')).toHaveLength(0);
		expect(less('.a:disabled { color: #ccc; } .b { fill: #ccc; color: #ccc; } @keyframes k { 0% { color: #eee; } }')).toHaveLength(0);
		expect(less('@x: #e8c07a; .a { color: @x; }')).toHaveLength(2);
		expect(less('.a { color: var(--horosa-text); } .b { color: inherit; } .c { color: currentColor; }')).toHaveLength(0);
	});

	it('判据没失明:扫到的文件数像样、主题页底解析得到', ()=>{
		expect(FILES.filter((f)=>f.endsWith('.less')).length).toBeGreaterThan(30);
		expect(FILES.filter((f)=>f.endsWith('.js')).length).toBeGreaterThan(500);
		ALL_THEMES.forEach((t)=>{ expect([t, PAGE[t].length >= 2 && PAGE[t].every((c)=>c && c.a === 1)]).toEqual([t, true]); });
		expect(lum(PAGE.dark[0])).toBeLessThan(0.02);
		expect(lum(PAGE.light[0])).toBeGreaterThan(0.8);
	});

	it('全仓:界面文字的写死字色在适用主题的底上都 ≥ 3:1(登记表之外)', ()=>{
		const bad = allHits().filter((h)=>!allowed(h)).map((h)=>h.msg);
		expect(bad).toEqual([]);
	});

	it('登记表:写了理由、仍然命中(不再命中 = 过期,删掉;文件本身不在这份检出里的不算)', ()=>{
		const hits = allHits();
		const here = (f)=>fs.existsSync(path.join(SRC, f));
		FIXED_BG.filter(([f])=>here(f)).forEach(([f, needle, bg, why])=>{
			expect([f, needle, `${why || ''}`.trim().length > 4, !!parseColor(bg), fs.existsSync(path.join(SRC, f))]).toEqual([f, needle, true, true, true]);
			expect([f, needle, !!FIXED_BG.find((x)=>x[0] === f && x[1] === needle).used]).toEqual([f, needle, true]);
		});
		NON_DOM.filter(([f])=>here(f)).forEach(([f, why])=>{ expect([f, `${why || ''}`.trim().length > 4]).toEqual([f, true]); });
		ALLOW.filter(([f])=>here(f)).forEach(([f, needle, why])=>{
			expect([f, needle, `${why || ''}`.trim().length > 4]).toEqual([f, needle, true]);
			expect([f, needle, hits.some((h)=>h.at.startsWith(`${f}:`) && `${h.line}`.indexOf(needle) >= 0)]).toEqual([f, needle, true]);
		});
	});

	it('风水八卦标记片:选中片 = 色板定色实底 + 白字(--chip 由组件按色板写入,静态扫不到),色板每色压白字都 ≥ 3:1', ()=>{
		const eng = read('components/fengshui/fengshuiEngine.js');
		const i = eng.indexOf('export const BAGUA_MARKER_TYPES = [');
		expect(i).toBeGreaterThanOrEqual(0);
		const block = eng.slice(i, eng.indexOf('];', i));
		const colors = (block.match(/color:\s*'(#[0-9a-fA-F]{6})'/g) || []).map((m)=>m.match(/#[0-9a-fA-F]{6}/)[0]);
		expect(colors.length).toBeGreaterThanOrEqual(12);
		expect(read('components/fengshui/FengShuiMain.js')).toMatch(/style=\{\{ '--chip': t\.color \}\}/);
		expect(read('layouts/app/15-fengshui.less')).toMatch(/\.horosa-fengshui-chip\.active \{[^}]*color: #fff;[^}]*background: var\(--chip, #9a6a25\)/);
		const white = parseColor('#fff');
		const bad = [...colors, '#9a6a25'].filter((c)=>contrast(white, parseColor(c)) < MIN).map((c)=>`${c} = ${contrast(white, parseColor(c)).toFixed(2)}`);
		expect(bad).toEqual([]);
	});

	it('NON_DOM 登记的文件确实是画布 / 3D / 图表绘制(去掉登记后应有命中,否则登记多余)', ()=>{
		NON_DOM.forEach(([f])=>{
			const abs = path.join(SRC, f);
			expect([f, scanJs(f, fs.readFileSync(abs, 'utf8'), abs).length > 0]).toEqual([f, true]);
		});
	});
});
