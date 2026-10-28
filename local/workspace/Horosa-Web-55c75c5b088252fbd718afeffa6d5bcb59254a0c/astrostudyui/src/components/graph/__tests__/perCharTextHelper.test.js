// 逐字出图(一个字一个 <text>)只走 GraphHelper.appendPerCharText:它给每个字的节点挂整词定字属性,
// 界面繁体按整词转再取那一位(天将环「天后」逐字画仍是「天后」)。
// 静态守卫:凡把 split('') 拆出来的字(直接或经变量)交给 d3 的 .data(...) 去画字的,判红 —— 必须改走 appendPerCharText。
// JSX 同理:split('') / Array.from(串) 派生的数组 .map(...) 出 <text> / <tspan> / <span> 文字节点的,
// 每个节点必须带整词属性(展开 scriptWordAttrs(整词, 位次) / tianJiangShortAttrs(...),或直接写 data-hant-word)。
import fs from 'fs';
import path from 'path';
import * as d3 from 'd3';
import { appendPerCharText, drawTextH } from '../GraphHelper';
import { toHant } from '../../../utils/scriptConvert/hantConverter';
import { applyScriptMode, SCRIPT_HANT, __resetScriptModeForTest, __setConverterForTest } from '../../../utils/scriptMode';

const parser = require('@babel/parser');
const SRC = path.join(__dirname, '..', '..', '..');
const FN = /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|ClassMethod|ObjectMethod|ClassPrivateMethod)$/;

function kids(n, cb){
	Object.keys(n).forEach((k)=>{
		if(k === 'loc'){ return; }
		const c = n[k];
		if(Array.isArray(c)){ c.forEach((x)=>{ if(x && typeof x.type === 'string'){ cb(x); } }); }
		else if(c && typeof c === 'object' && typeof c.type === 'string'){ cb(c); }
	});
}
const isSplitEmpty = (n)=>n && n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.property
	&& n.callee.property.name === 'split' && n.arguments.length === 1 && n.arguments[0].type === 'StringLiteral' && n.arguments[0].value === '';
function contains(n, pred){
	let hit = false;
	const v = (x)=>{ if(hit){ return; } if(pred(x)){ hit = true; return; } if(FN.test(x.type)){ return; } kids(x, v); };
	v(n);
	return hit;
}
// 返回 [行号…]:split('') 派生(按函数作用域传播变量,内层函数继承外层)的数组进了 .data(...)
function findPerCharDataSites(text){
	const ast = parser.parse(text, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport'], errorRecovery: true });
	const out = [];
	const scan = (fnNode, inherited)=>{
		const tainted = new Set(inherited);
		const bad = (x)=>isSplitEmpty(x) || (x.type === 'Identifier' && tainted.has(x.name));
		for(let r = 0; r < 3; r += 1){
			const v = (n)=>{
				if(n !== fnNode && FN.test(n.type)){ return; }
				if(n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init && contains(n.init, bad)){ tainted.add(n.id.name); }
				if(n.type === 'AssignmentExpression' && n.left.type === 'Identifier' && contains(n.right, bad)){ tainted.add(n.left.name); }
				kids(n, v);
			};
			v(fnNode);
		}
		const v = (n)=>{
			if(n !== fnNode && FN.test(n.type)){ scan(n, tainted); return; }
			if(n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.property && n.callee.property.name === 'data'
				&& n.arguments.length && contains(n.arguments[0], bad)){ out.push(n.loc.start.line); }
			kids(n, v);
		};
		v(fnNode);
	};
	scan(ast.program, []);
	return out;
}
// Array.from(串):参数是标识符 / 成员 / 字符串 / 模板串 / String(…)(Array.from({ length }) / new Set 之类不是拆字)
const isArrayFrom = (n)=>n && n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object && n.callee.object.name === 'Array'
	&& n.callee.property && n.callee.property.name === 'from' && n.arguments.length === 1
	&& /^(Identifier|MemberExpression|StringLiteral|TemplateLiteral)$/.test(n.arguments[0].type) || (n && n.type === 'CallExpression' && n.callee.type === 'MemberExpression'
	&& n.callee.object && n.callee.object.name === 'Array' && n.callee.property && n.callee.property.name === 'from' && n.arguments.length === 1
	&& n.arguments[0].type === 'CallExpression' && n.arguments[0].callee.type === 'Identifier' && n.arguments[0].callee.name === 'String');
const TEXT_TAGS = new Set(['text', 'tspan', 'span']);
const WORD_ATTR_FNS = new Set(['scriptWordAttrs', 'tianJiangShortAttrs', 'perCharTextProps']);
// JSX 元素带了整词属性:{...scriptWordAttrs(…)} 一类展开,或直接写了 data-hant-word
function hasWordAttr(el){
	return (el.openingElement.attributes || []).some((a)=>{
		if(a.type === 'JSXSpreadAttribute'){
			const c = a.argument;
			return c && c.type === 'CallExpression' && ((c.callee.type === 'Identifier' && WORD_ATTR_FNS.has(c.callee.name)) || (c.callee.type === 'MemberExpression' && c.callee.property && WORD_ATTR_FNS.has(c.callee.property.name)));
		}
		return a.type === 'JSXAttribute' && a.name && a.name.name === 'data-hant-word';
	});
}
// 返回 [行号…]:split('') / Array.from(…) 派生的数组 .map(cb),cb 返回的 <text> / <tspan> / <span> 没带整词属性
function findPerCharJsxSites(text){
	const ast = parser.parse(text, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport'], errorRecovery: true });
	const out = [];
	const scan = (fnNode, inherited)=>{
		const tainted = new Set(inherited);
		// 拆字数组本身(不是「里面用到过拆字」):split('') / Array.from(串) / 拆字变量,及其 slice / filter / reverse / concat
		const derives = (x)=>!!x && (isSplitEmpty(x) || isArrayFrom(x) || (x.type === 'Identifier' && tainted.has(x.name))
			|| (x.type === 'CallExpression' && x.callee.type === 'MemberExpression' && x.callee.property && ['slice', 'filter', 'reverse', 'concat'].indexOf(x.callee.property.name) >= 0 && derives(x.callee.object)));
		for(let r = 0; r < 3; r += 1){
			const v = (n)=>{
				if(n !== fnNode && FN.test(n.type)){ return; }
				if(n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init && derives(n.init)){ tainted.add(n.id.name); }
				if(n.type === 'AssignmentExpression' && n.left.type === 'Identifier' && derives(n.right)){ tainted.add(n.left.name); }
				kids(n, v);
			};
			v(fnNode);
		}
		const v = (n)=>{
			if(n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.property && n.callee.property.name === 'map'
				&& derives(n.callee.object) && n.arguments.length && FN.test(n.arguments[0].type)){
				const cb = n.arguments[0];
				const els = [];
				const w = (x)=>{ if(x.type === 'JSXElement'){ const nm = x.openingElement.name; if(nm.type === 'JSXIdentifier' && TEXT_TAGS.has(nm.name)){ els.push(x); } } if(x !== cb && FN.test(x.type)){ return; } kids(x, w); };
				w(cb);
				if(els.some((el)=>!hasWordAttr(el))){ out.push(n.loc.start.line); }
			}
			if(n !== fnNode && FN.test(n.type)){ scan(n, tainted); return; }
			kids(n, v);
		};
		v(fnNode);
	};
	scan(ast.program, []);
	return [...new Set(out)];
}
// 另一路正在改的逐字 JSX 点(合并后应已修好;修好仍留在这里 = 红,删掉这一行)
const JSX_PENDING_ELSEWHERE = {};

// Array.from(串):实参看得出是字符串(模板串 / 字面量 / 拼接 / String(…) / …Text(…) / toString())才算拆字,Array.from(集合) 不算
const strExpr = (a)=>a && (a.type === 'TemplateLiteral' || a.type === 'StringLiteral' || (a.type === 'BinaryExpression' && a.operator === '+')
	|| (a.type === 'CallExpression' && ((a.callee.type === 'Identifier' && /^String$|Text$|Str$/.test(a.callee.name))
		|| (a.callee.type === 'MemberExpression' && a.callee.property && /^(toString|trim|slice|substring)$/.test(a.callee.property.name)))));
const isArrayFromStr = (n)=>n && n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.type === 'Identifier'
	&& n.callee.object.name === 'Array' && n.callee.property && n.callee.property.name === 'from' && n.arguments.length === 1 && strExpr(n.arguments[0]);
const isCharSplit = (n)=>isSplitEmpty(n) || isArrayFromStr(n);
const PER_CHAR_DRAWERS = { drawTextH: [1, 13], drawTextV: [1, 13], appendPerCharText: [1, 2] };   // 名 → [字数组的位, 整词的位]
const PER_CHAR_TAGS = new Set(['text', 'tspan', 'span']);
// 返回 [{ kind, line }]:
//  'derived' —— 拆字后又截取 / 重拼(只画整词的一部分)的数组交给逐字画字函数,却没把整词传进去(整词被截);
//  'jsx'     —— 拆字数组 .map(...) 出 <text> / <tspan> / <span> 文字节点,却没挂整词定字属性(perCharTextProps / data-hant-word)。
function findPerCharWordSites(text){
	const ast = parser.parse(text, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport'], errorRecovery: true });
	const out = [];
	const scan = (fnNode, inheritedPure, inheritedDerived)=>{
		const pure = new Set(inheritedPure);
		const derived = new Set(inheritedDerived);
		const any = (x)=>isCharSplit(x) || (x.type === 'Identifier' && (pure.has(x.name) || derived.has(x.name)));
		for(let r = 0; r < 3; r += 1){
			const v = (n)=>{
				if(n !== fnNode && FN.test(n.type)){ return; }
				const bind = (name, init)=>{
					if(!init){ return; }
					if(isCharSplit(init) || (init.type === 'Identifier' && pure.has(init.name))){ pure.add(name); }
					else if(contains(init, any)){ derived.add(name); }
				};
				if(n.type === 'VariableDeclarator' && n.id.type === 'Identifier'){ bind(n.id.name, n.init); }
				if(n.type === 'AssignmentExpression' && n.left.type === 'Identifier'){ bind(n.left.name, n.right); }
				kids(n, v);
			};
			v(fnNode);
		}
		const jsxHasWordAttr = (el)=>el.openingElement.attributes.some((a)=>(a.type === 'JSXSpreadAttribute' && a.argument.type === 'CallExpression'
			&& a.argument.callee.type === 'Identifier' && /^(perCharTextProps|scriptWordAttrs|tianJiangShortAttrs)$/.test(a.argument.callee.name))
			|| (a.type === 'JSXAttribute' && a.name && a.name.name === 'data-hant-word'));
		const v = (n)=>{
			if(n !== fnNode && FN.test(n.type)){ scan(n, pure, derived); return; }
			if(n.type === 'CallExpression' && n.callee.type === 'Identifier' && PER_CHAR_DRAWERS[n.callee.name]){
				const [di, wi] = PER_CHAR_DRAWERS[n.callee.name];
				const a = n.arguments[di];
				const w = n.arguments[wi];
				const isDerived = a && ((a.type === 'Identifier' && derived.has(a.name)) || (a.type !== 'Identifier' && !isCharSplit(a) && contains(a, any)));
				const noWord = !w || (w.type === 'Identifier' && w.name === 'undefined');
				if(isDerived && noWord){ out.push({ kind: 'derived', line: n.loc.start.line }); }
			}
			if(n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.property && n.callee.property.name === 'map'
				&& any(n.callee.object) && n.arguments[0] && FN.test(n.arguments[0].type)){
				const cb = n.arguments[0];
				const p0 = cb.params[0] && cb.params[0].type === 'Identifier' ? cb.params[0].name : null;
				const walkJsx = (x)=>{
					if(x.type === 'JSXElement'){
						const nm = x.openingElement.name && x.openingElement.name.name;
						const usesChar = p0 && contains({ type: 'Wrap', c: x.children }, (y)=>y.type === 'Identifier' && y.name === p0);
						if(PER_CHAR_TAGS.has(nm) && usesChar && !jsxHasWordAttr(x)){ out.push({ kind: 'jsx', line: x.loc.start.line }); return; }
					}
					kids(x, walkJsx);
				};
				walkJsx(cb.body);
			}
			kids(n, v);
		};
		v(fnNode);
	};
	scan(ast.program, [], []);
	return out;
}
// 高亮拆段:正文按正则 split 成多段、.map 成 JSX 节点(高亮词包一层、其余另成节点)—— 每段文字节点都要挂「整段 + 起始位次」
// (scriptWordAttrs(整段, 位次)),界面繁体才按整段转;直接把字符串段落回成裸文本节点(… : p)也算漏挂。返回行号。
const isRegexArg = (a)=>a && (a.type === 'RegExpLiteral' || a.type === 'Identifier' || (a.type === 'NewExpression' && a.callee.type === 'Identifier' && a.callee.name === 'RegExp'));
function findSplitHighlightSites(text){
	const ast = parser.parse(text, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport'], errorRecovery: true });
	const out = [];
	const splitVars = new Set();
	const isRegexSplit = (n)=>n && n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.property
		&& n.callee.property.name === 'split' && n.arguments.length === 1 && isRegexArg(n.arguments[0]) && !isSplitEmpty(n);
	const v1 = (n)=>{ if(n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && isRegexSplit(n.init)){ splitVars.add(n.id.name); } kids(n, v1); };
	v1(ast.program);
	const hasCtx = (el)=>el.openingElement.attributes.some((a)=>a.type === 'JSXSpreadAttribute' && a.argument.type !== 'CallExpression' ? true
		: (a.type === 'JSXSpreadAttribute' && a.argument.callee.type === 'Identifier' && /^(scriptWordAttrs|perCharTextProps)$/.test(a.argument.callee.name)));
	const v = (n)=>{
		if(n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.property && n.callee.property.name === 'map'
			&& (isRegexSplit(n.callee.object) || (n.callee.object.type === 'Identifier' && splitVars.has(n.callee.object.name)))
			&& n.arguments[0] && FN.test(n.arguments[0].type)){
			const cb = n.arguments[0];
			const p0 = cb.params[0] && cb.params[0].type === 'Identifier' ? cb.params[0].name : null;
			let jsx = false; let bare = false; let missing = false;
			const w = (x)=>{
				if(x.type === 'JSXElement'){
					jsx = true;
					const usesP = p0 && contains({ type: 'Wrap', c: x.children }, (y)=>y.type === 'Identifier' && y.name === p0);
					if(usesP && !hasCtx(x)){ missing = true; }
					return;
				}
				if(x.type === 'ConditionalExpression'){ [x.consequent, x.alternate].forEach((b)=>{ if(b.type === 'Identifier' && b.name === p0){ bare = true; } }); }
				if(x.type === 'ReturnStatement' && x.argument && x.argument.type === 'Identifier' && x.argument.name === p0){ bare = true; }
				if(FN.test(x.type) && x !== cb){ return; }
				kids(x, w);
			};
			w(cb.body.type === 'Identifier' ? { type: 'Wrap', c: [] } : cb.body);
			if(jsx && (bare || missing)){ out.push(n.loc.start.line); }
		}
		kids(n, v);
	};
	v(ast.program);
	return out;
}
function srcFiles(){
	const out = [];
	const walk = (d)=>fs.readdirSync(d, { withFileTypes: true }).forEach((e)=>{
		const f = path.join(d, e.name);
		if(e.isDirectory()){ if(['__tests__', 'node_modules', 'test'].indexOf(e.name) < 0){ walk(f); } return; }
		if(/\.js$/.test(e.name) && !/\.test\.js$/.test(e.name)){ out.push(f); }
	});
	walk(path.join(SRC, 'components'));
	walk(path.join(SRC, 'utils'));
	return out;
}

describe('静态守卫:逐字出图只走 appendPerCharText', ()=>{
	test('全站没有把 split(\'\') 出来的字直接交给 .data(...) 的画字点', ()=>{
		const hits = [];
		srcFiles().forEach((f)=>{
			const t = fs.readFileSync(f, 'utf8');
			if(t.indexOf("split('')") < 0){ return; }
			findPerCharDataSites(t).forEach((line)=>hits.push(`${path.relative(SRC, f)}:${line}`));
		});
		expect(hits).toEqual([]);
	});
	test('JSX:split(\'\') / Array.from 出来的字逐个画成文字节点,每个都带整词属性', ()=>{
		const hits = [];
		const pendingSeen = new Set();
		srcFiles().forEach((f)=>{
			const t = fs.readFileSync(f, 'utf8');
			if(t.indexOf("split('')") < 0 && t.indexOf('Array.from(') < 0){ return; }
			const rel = path.relative(SRC, f).split(path.sep).join('/');
			const sites = findPerCharJsxSites(t);
			if(JSX_PENDING_ELSEWHERE[rel]){ if(sites.length){ pendingSeen.add(rel); } return; }
			sites.forEach((line)=>hits.push(`${rel}:${line}`));
		});
		expect(hits).toEqual([]);
		// 登记的另一路待修点:修好了就从表里删(登记不过期)
		expect(Object.keys(JSX_PENDING_ELSEWHERE).filter((rel)=>!pendingSeen.has(rel))).toEqual([]);
	});
	test('JSX 判据自证:没带整词属性的认得出,带了的不报', ()=>{
		expect(findPerCharJsxSites("const A = ({ s })=>(<g>{s.split('').map((ch, i)=>(<text key={i}>{ch}</text>))}</g>);")).toEqual([1]);
		expect(findPerCharJsxSites("function A({ s }){ const cs = Array.from(s);\n return cs.map((c, i)=><tspan key={i}>{c}</tspan>); }")).toEqual([2]);
		expect(findPerCharJsxSites("const A = ({ s })=>(<g>{s.split('').map((ch, i)=>(<text key={i} {...scriptWordAttrs(s, i)}>{ch}</text>))}</g>);")).toEqual([]);
		expect(findPerCharJsxSites("const A = ({ s })=>(<g>{s.split('').map((ch, i)=>(<text key={i} data-hant-word={s}>{ch}</text>))}</g>);")).toEqual([]);
		expect(findPerCharJsxSites("const A = ({ xs })=>(<g>{xs.map((x, i)=>(<text key={i}>{x}</text>))}</g>);")).toEqual([]);
		expect(findPerCharJsxSites("const A = ()=>(<g>{Array.from({ length: 4 }).map((_, i)=>(<span key={i}>x</span>))}</g>);")).toEqual([]);
		expect(findPerCharJsxSites("const A = ({ s })=>(<g>{s.split('').slice(0, 2).map((ch, i)=>(<text key={i}>{ch}</text>))}</g>);")).toEqual([1]);
	});
	test('风水罗经 / 线法 / 六十四卦圆图的逐字竖排只有一份(带整词属性)', ()=>{
		const lp = fs.readFileSync(path.join(SRC, 'components/fengshui/charts/LuopanDial.js'), 'utf8');
		expect(lp).not.toMatch(/function RadialText/);
		const { importsName } = require('../../../utils/__tests__/helpers/importSpecs');
		expect(importsName(lp, { name: 'RadialText', from: './chartGeom' })).toBe(true);
		expect(fs.readFileSync(path.join(SRC, 'components/fengshui/charts/chartGeom.js'), 'utf8')).toContain('{...scriptWordAttrs(s, i)}');
	});
	test('判据自证:直接 / 经变量 / 经截取 / 闭包里的写法都认得出;助手内部与非拆字数据不误报', ()=>{
		expect(findPerCharDataSites("function f(g, t){ g.selectAll('text').data(t.split('')).enter().append('text'); }")).toEqual([1]);
		expect(findPerCharDataSites("function f(g, t){ let a = t.split('');\n let b = [a[0], a[1]];\n g.selectAll('text').data(b).enter().append('text'); }")).toEqual([3]);
		expect(findPerCharDataSites("function f(g, t){ const a = t.split('');\n [1].forEach(()=>{ g.selectAll('text').data(a).enter(); }); }")).toEqual([2]);
		expect(findPerCharDataSites("function f(g, t){ const a = t.split('');\n appendPerCharText(g, a, t); }\nfunction h(g){ const a = ['x', 'y'];\n g.selectAll('text').data(a); }")).toEqual([]);
	});
	test('扫描面不塌缩:原先的逐字画字点都已改走助手', ()=>{
		['components/graph/D3Circle.js', 'components/szdunjia/SZDunJiaChartCircle.js', 'components/sztaiyi/SZTaiYiChartCircle.js', 'components/astro/AstroChartCircle.js', 'components/guolao/GuoLaoNatalChart.js'].forEach((f)=>{
			expect(fs.readFileSync(path.join(SRC, f), 'utf8')).toMatch(/appendPerCharText\(/);
		});
	});
});

describe('静态守卫:逐字画字带整词(截取后画 / JSX 逐字)', ()=>{
	const scanAll = ()=>{
		const hits = {};
		srcFiles().forEach((f)=>{
			const t = fs.readFileSync(f, 'utf8');
			if(t.indexOf("split('')") < 0 && t.indexOf('Array.from(') < 0){ return; }
			const rel = path.relative(SRC, f).split(path.sep).join('/');
			findPerCharWordSites(t).forEach((h)=>{ (hits[rel] = hits[rel] || []).push(`${h.kind}:${h.line}`); });
		});
		return hits;
	};
	test('全站没有「截了整词又不传整词」与「JSX 逐字不挂整词属性」的画字点', ()=>{
		const hits = scanAll();
		const bad = Object.keys(hits).map((f)=>`${f} ${hits[f].join(',')}`);
		expect(bad).toEqual([]);
	});
	test('判别力:截取后不传整词 / JSX 逐字不挂属性都认得出;传了整词、挂了属性、未拆字的不误报', ()=>{
		expect(findPerCharWordSites("function f(s, g){ const a = g.split('');\n const d = [a[0], a[1]];\n drawTextV(s, d, 0, 0, 1, 1, 1, 'c'); }")).toEqual([{ kind: 'derived', line: 3 }]);
		expect(findPerCharWordSites("function f(s, g){ const a = g.split('');\n const d = [a[0], a[1]];\n drawTextV(s, d, 0, 0, 1, 1, 1, 'c', undefined, undefined, undefined, undefined, undefined, g); }")).toEqual([]);
		expect(findPerCharWordSites("function f(s, g){ drawTextH(s, g.split(''), 0, 0, 1, 1, 1); }")).toEqual([]);
		expect(findPerCharWordSites("const T = (t)=>t.split('').map((ch, k)=>(\n<text key={k}>{ch}</text>));")).toEqual([{ kind: 'jsx', line: 2 }]);
		expect(findPerCharWordSites("const T = (t)=>{ const cs = Array.from(`${t}`);\n return cs.map((ch, k)=><tspan key={k}>{ch}</tspan>); };")).toEqual([{ kind: 'jsx', line: 2 }]);
		expect(findPerCharWordSites("const T = (m)=>Array.from(m.keys()).map((x, k)=><span key={k}>{x}</span>);")).toEqual([]);
		expect(findPerCharWordSites("const T = (t)=>Array.from(String(t)).map((ch, k)=><text key={k} {...perCharTextProps(t, k, ch)}>{ch}</text>);")).toEqual([]);
		expect(findPerCharWordSites("const T = (xs)=>xs.map((x, k)=><text key={k}>{x}</text>);")).toEqual([]);
	});
	test('七政两张轮盘的逐字弧形文字已挂整词属性', ()=>{
		['components/guolao/GuoLaoMoiraWheel.js', 'components/guolao/GuoLaoMoiraPickWheel.js'].forEach((f)=>{
			expect(fs.readFileSync(path.join(SRC, f), 'utf8')).toMatch(/\{\.\.\.perCharTextProps\(word, k, ch\)\}/);
		});
	});
});

describe('静态守卫:高亮拆段的每段带整段语境', ()=>{
	test('全站按正则拆段出 JSX 的地方,每段都挂 scriptWordAttrs(整段, 位次)', ()=>{
		const hits = [];
		srcFiles().forEach((f)=>{
			const t = fs.readFileSync(f, 'utf8');
			if(t.indexOf('.split(') < 0){ return; }
			findSplitHighlightSites(t).forEach((line)=>hits.push(`${path.relative(SRC, f)}:${line}`));
		});
		expect(hits).toEqual([]);
	});
	test('判别力:裸文本段 / 高亮节点不挂属性都认得出;挂了的不误报', ()=>{
		expect(findSplitHighlightSites("function f(b, re){ return b.split(re).map((p, i)=>(i % 2 ? <mark key={i}>{p}</mark> : p)); }")).toEqual([1]);
		expect(findSplitHighlightSites("function f(b){ const parts = b.split(/(x)/g);\n return parts.map((p, i)=><mark key={i} {...scriptWordAttrs(b, i)}>{p}</mark>); }")).toEqual([]);
		expect(findSplitHighlightSites("function f(b){ return b.split(/,/).map((p, i)=><li key={i}>{p}</li>); }")).toEqual([1]);
		expect(findSplitHighlightSites("function f(b){ return b.split(/,/).map((p)=>p.trim()); }")).toEqual([]);
	});
});

describe('perCharTextProps(JSX 逐字)', ()=>{
	const { perCharTextProps } = require('../../../utils/scriptMode');
	test('整词逐位:挂整词与位次;单字 / 越位 / 字对不上不挂', ()=>{
		expect(perCharTextProps('天后', 1, '后')).toEqual({ 'data-hant-word': '天后', 'data-hant-idx': '1' });
		expect(perCharTextProps('天后', 0)).toEqual({ 'data-hant-word': '天后', 'data-hant-idx': '0' });
		expect(perCharTextProps('后', 0, '后')).toEqual({});
		expect(perCharTextProps('天后', 2, '(')).toEqual({});
		expect(perCharTextProps('天后', 1, '後')).toEqual({});
	});
	test('drawTextV 只画前两字、传整词:繁体按整词定字', async ()=>{
		__resetScriptModeForTest(); __setConverterForTest(toHant); document.body.innerHTML = '';
		const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		document.body.appendChild(host);
		const { drawTextV } = require('../GraphHelper');
		drawTextV(d3.select(host), ['天', '后'], 0, 0, 20, 40, 1, undefined, undefined, undefined, undefined, undefined, undefined, '天后星');
		expect(Array.from(host.querySelectorAll('text')).map((t)=>t.getAttribute('data-hant-word'))).toEqual(['天后星', '天后星']);
		await applyScriptMode(SCRIPT_HANT);
		expect(host.textContent).toBe('天后');
		__resetScriptModeForTest();
	});
});

describe('appendPerCharText 行为', ()=>{
	beforeEach(()=>{ __resetScriptModeForTest(); __setConverterForTest(toHant); document.body.innerHTML = ''; });
	afterAll(()=>{ __resetScriptModeForTest(); });
	const mk = ()=>{ const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); document.body.appendChild(s); return s; };

	test('整词逐字:繁体下仍按整词定字', async ()=>{
		const host = mk();
		appendPerCharText(d3.select(host).append('g'), '天后'.split('')).text((d)=>d);
		await applyScriptMode(SCRIPT_HANT);
		expect(host.textContent).toBe('天后');
	});
	test('只画整词前几位 / 后面另拼了节点:与整词逐位相符的挂属性,其余不挂', async ()=>{
		const host = mk();
		const sel = appendPerCharText(d3.select(host).append('g'), ['天', '后', '(3)'], '天后').text((d)=>d);
		const nodes = sel.nodes();
		expect(nodes[0].getAttribute('data-hant-word')).toBe('天后');
		expect(nodes[1].getAttribute('data-hant-idx')).toBe('1');
		expect(nodes[2].hasAttribute('data-hant-word')).toBe(false);
		await applyScriptMode(SCRIPT_HANT);
		expect(nodes.map((n)=>n.textContent).join('')).toBe('天后(3)');
	});
	test('drawTextH 经同一助手(单一入口)', ()=>{
		const host = mk();
		drawTextH(d3.select(host), '天后'.split(''), 0, 0, 40, 20, 1);
		expect(Array.from(host.querySelectorAll('text')).map((t)=>t.getAttribute('data-hant-word'))).toEqual(['天后', '天后']);
		const code = fs.readFileSync(path.join(SRC, 'components/graph/GraphHelper.js'), 'utf8').replace(/\/\/.*$/gm, '');
		expect(code.match(/\.data\(/g).length).toBe(1);
	});
});
