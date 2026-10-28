// 引用的主题变量必须真有定义(全 src 的 .less / .css / .js;字色、底色、线色、阴影、字族……一切 --horosa-* 引用)。
//
// 为什么:var(--horosa-x, 兜底) 里的 --horosa-x 若全仓从未定义,浏览器恒取兜底 —— 兜底都是只为一种主题挑的定色
// (字色 #888 / #999 在宣纸底 2.8–3.5:1;底色 #fafafa 在暗色下是一块白;线色 rgba(0,0,0,.12) 在暗底上看不见);
// 没写兜底的则整条声明作废(阴影 / 字族直接失效)。
// 曾经这样「从未定义」的有:字色 --horosa-text-muted / -text-tertiary / -info / -warn / -success …;
// 非字色 --horosa-border-soft(79 处)/ -astro-border / -surface-sunken / -astro-card-hover / -surface-2 / -bg-soft /
// -primary-soft / -panel / -panel-solid / -card-bg / -row-alt / -font-ui / -modal-shadow …,已改名为已有变量或补进根主题块。
//
// 判红:引用(less / css 里任何 var(--horosa-x),JS 字符串里的 var(--horosa-x),以及 cssVar / getPropertyValue 读的
// '--horosa-x')了全仓没有任何定义的 --horosa-* 变量。定义 = less / css 里的「--horosa-x:」、JS 样式对象键 '--horosa-x'、
// setProperty('--horosa-x', …)、以及赋给常量的变量名字面量(运行时 setProperty(常量, …) 写入的)。
// 盘面绘制色若必须引用一个只在盘面组件里注入的变量,登记进 ALLOW 并写理由;登记了却不再命中 = 红。
import fs from 'fs';
import path from 'path';

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const SRC = path.resolve(__dirname, '../..');

// [变量名, 理由]
const ALLOW = [
	['--horosa-wheelart-angle', '印度方盘「轴点星」名字色:盘面美术档注入的盘面绘制色,兜底即设计值(盘面不在界面字色合同,归 audit_chart_theme.py)'],
	['--horosa-chart-stroke', '汉堡学派盘面 svg 的线色(currentColor 兜底,给盘面线条继承用,不是界面字)'],
];

function walk(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const p = path.join(dir, e.name);
		if(e.isDirectory()){
			if(e.name === '__tests__' || e.name === 'node_modules' || e.name.startsWith('.umi')){ return; }
			walk(p, out);
		}else if(/\.(less|css|js)$/.test(e.name)){
			out.push(p);
		}
	});
	return out;
}
const stripBlock = (s)=>s.replace(/\/\*[\s\S]*?\*\//g, (m)=>m.replace(/[^\n]/g, ' '));
const stripLine = (s)=>s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p1)=>p1 + ' '.repeat(m.length - p1.length));

// var(--horosa-x …) 里的变量名;--horosa-bazi-${k} 这类拼出来的(名字后紧跟 $ 或 {)不算
function varRefs(value){
	const out = [];
	const re = /var\(\s*(--horosa-[\w-]+)(?![\w$\-{])/g;
	let m = re.exec(value);
	while(m){ if(!/-$/.test(m[1])){ out.push(m[1]); } m = re.exec(value); }
	return out;
}

function collectDefs(files){
	const defs = new Set();
	files.forEach((f)=>{
		const s = stripLine(stripBlock(fs.readFileSync(f, 'utf8')));
		const add = (re)=>{ let m = re.exec(s); while(m){ defs.add(m[1]); m = re.exec(s); } };
		add(/(?:^|[\s;{(,])(--horosa-[\w-]+)\s*:/g);                    // less / css 声明
		add(/['"`](--horosa-[\w-]+)['"`]\s*:/g);                         // JS 样式对象键
		add(/setProperty\(\s*['"`](--horosa-[\w-]+)['"`]/g);             // 运行时写入
		add(/=\s*['"`](--horosa-[\w-]+)['"`]\s*[;,\n]/g);                // 变量名常量(再交给 setProperty)
	});
	return defs;
}

// less / css:任何声明里的 var(--horosa-x)
function usesLess(file, src){
	const s = stripLine(stripBlock(src));
	const out = [];
	const re = /var\(\s*(--horosa-[\w-]+)(?![\w$\-{])/g;
	let m = re.exec(s);
	while(m){
		if(!/-$/.test(m[1])){ out.push({ v: m[1], at: `${file}:${s.slice(0, m.index).split('\n').length}` }); }
		m = re.exec(s);
	}
	return out;
}

// JS:字符串 / 模板里的 var(--horosa-x),以及 cssVar('--horosa-x') / getPropertyValue('--horosa-x') 读取
const READ_FN = /^(cssVar|readVar|getVar|getPropertyValue|readCssVar)$/;
function usesJs(file, src){
	const out = [];
	if(src.indexOf('--horosa-') < 0){ return out; }
	let ast;
	try{
		ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport', 'exportDefaultFrom', 'decorators-legacy'] });
	}catch(e){
		return [{ v: '(解析失败)', at: `${file}: ${e.message}` }];
	}
	traverse(ast, {
		'StringLiteral|TemplateElement'(p){
			const raw = p.node.type === 'StringLiteral' ? p.node.value : p.node.value.cooked;
			if(!raw || raw.indexOf('--horosa-') < 0){ return; }
			varRefs(raw).forEach((v)=>out.push({ v, at: `${file}:${p.node.loc.start.line}` }));
		},
		CallExpression(p){
			const c = p.node.callee;
			const name = c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && !c.computed ? c.property.name : '');
			const a0 = p.node.arguments[0];
			if(READ_FN.test(name) && a0 && a0.type === 'StringLiteral' && /^--horosa-[\w-]+$/.test(a0.value)){
				out.push({ v: a0.value, at: `${file}:${p.node.loc.start.line}` });
			}
		},
	});
	return out;
}

// 只在某个作用域里定义的变量:作用域外引用时同样恒取兜底(冷蓝 --horosa-astro-blue 只在塔罗页定义,太乙 / 择日里取兜底 #7fa8d8,
// 宣纸底 2.4:1)。字色引用的变量必须在根主题块(01-base 各 :root 块 + 02-shell 挂在 :root 上的那组)有定义,
// 确属作用域局部色板的登记进 SCOPED(变量名前缀 + 理由:它只在哪个作用域里用、作用域外靠什么兜底)。
const SCOPED = [
	['--horosa-huangji-', '皇极 / 灵棋 / 五兆等「卜」页的局部色板,定义在 .horosa-huangji-redesign 作用域(亮暗两块);作用域外的引用一律带 var(--horosa-text-secondary) 一类根变量兜底'],
	['--horosa-ziwei-house-title', '策天 / 演禽紫微盘作用域里覆盖紫微宫名色(11-kinastro 亮暗两块);作用域外的引用带 var(--horosa-ziwei-house-name) 根变量兜底'],
	['--horosa-lv', '布局视口单位 --horosa-lvw / --horosa-lvh(及工作区地板用的 -raw 两份):运行时由 utils/layoutViewportVars.js 写到 :root(setProperty),引用处都带 1vw / 1vh 兜底'],
	['--horosa-chart-floor-extra', '盘面最小字视觉下限要求的工作区加宽 / 加高量:运行时由 utils/chartTextFloor.js 写到工作区内层(setProperty 常量名),唯一引用处 13-layout-module 带 0px 兜底'],
];

const FILES = walk(SRC, []);
const DEFS = collectDefs(FILES);
function undefinedColorUses(){
	const out = [];
	FILES.forEach((f)=>{
		const rel = path.relative(SRC, f);
		const src = fs.readFileSync(f, 'utf8');
		const uses = rel.endsWith('.js') ? usesJs(rel, src) : usesLess(rel, src);
		uses.forEach((u)=>{ if(!DEFS.has(u.v)){ out.push(u); } });
	});
	return out;
}

function rootDefs(){
	const base = stripBlock(fs.readFileSync(path.join(SRC, 'layouts/app/01-base.less'), 'utf8'));
	const shell = stripBlock(fs.readFileSync(path.join(SRC, 'layouts/app/02-shell.less'), 'utf8'));
	const out = new Set();
	const add = (txt)=>{ const re = /(--horosa-[\w-]+)\s*:/g; let m = re.exec(txt); while(m){ out.add(m[1]); m = re.exec(txt); } };
	// 01-base 里以 :root 开头的块
	const re = /(^|\n)\s*(:root[^{]*)\{([^{}]*)\}/g;
	let m = re.exec(base);
	while(m){ add(m[3]); m = re.exec(base); }
	// 02-shell 挂在 :root 上的那组(选择器表以 :root 起头)
	const re2 = /\n\s*(:root(?:\[[^\]]*\])?,[^{]*)\{([^{}]*)\}/g;
	m = re2.exec(shell);
	while(m){ add(m[2]); m = re2.exec(shell); }
	return out;
}
const ROOT_DEFS = rootDefs();

// 同一文件里自己定义、自己引用的(某页作用域内的局部变量)不算跨作用域引用
const LOCAL_DEFS = new Map();
function localDefs(f){
	if(!LOCAL_DEFS.has(f)){ LOCAL_DEFS.set(f, collectDefs([f])); }
	return LOCAL_DEFS.get(f);
}

describe('引用的主题变量必须有定义(字色 / 底色 / 线色 / 阴影 / 字族,一切 --horosa-*)', ()=>{
	it('判据自证:构造样本', ()=>{
		expect(varRefs('var(--horosa-text-muted, #888)')).toEqual(['--horosa-text-muted']);
		expect(varRefs('var(--horosa-bazi-${k})')).toEqual([]);
		expect(varRefs('var(--horosa-a, var(--horosa-b))')).toEqual(['--horosa-a', '--horosa-b']);
		expect(usesLess('a.less', '.x { color: var(--horosa-foo, #888); background-color: var(--horosa-bar); }').map((u)=>u.v)).toEqual(['--horosa-foo', '--horosa-bar']);
		expect(usesLess('a.less', '/* color: var(--horosa-foo) */ .x { border: 1px solid var(--horosa-border-soft, rgba(0,0,0,.12)); font-family: var(--horosa-font-ui); }').map((u)=>u.v)).toEqual(['--horosa-border-soft', '--horosa-font-ui']);
		expect(usesJs('a.js', "const a = <i style={{ color: 'var(--horosa-foo, #999)', background: 'var(--horosa-bar)' }} />;").map((u)=>u.v)).toEqual(['--horosa-foo', '--horosa-bar']);
		expect(usesJs('a.js', "const a = <i style={{ color: ok ? 'var(--horosa-foo)' : 'var(--horosa-baz)' }} />;").map((u)=>u.v)).toEqual(['--horosa-foo', '--horosa-baz']);
		expect(usesJs('a.js', "const h = '<b style=\"color:var(--horosa-foo)\">x</b>';").map((u)=>u.v)).toEqual(['--horosa-foo']);
		expect(usesJs('a.js', "const box = { boxShadow: `0 1px 2px var(--horosa-shadow-x)` }; const c = cssVar('--horosa-panel', '#fff');").map((u)=>u.v)).toEqual(['--horosa-shadow-x', '--horosa-panel']);
		expect(usesJs('a.js', "el.style.setProperty('--horosa-x', '1px'); const k = `--horosa-bazi-${w}`;")).toEqual([]);
		// 定义的几种写法都认
		const tmp = collectDefs([path.join(SRC, 'layouts/app/01-base.less')]);
		expect(tmp.has('--horosa-text-secondary')).toBe(true);
		expect(tmp.has('--horosa-muted')).toBe(true);
	});

	it('判据没失明:定义集与扫描面像样', ()=>{
		expect(DEFS.size).toBeGreaterThan(150);
		expect(FILES.filter((f)=>f.endsWith('.js')).length).toBeGreaterThan(500);
		// 运行时 setProperty 写入的变量(版面视口宽)也被认作已定义
		expect(DEFS.has('--horosa-lvw')).toBe(true);
	});

	it('全仓:引用的 --horosa-* 都有定义(登记表之外)', ()=>{
		const allow = new Set(ALLOW.map(([v])=>v));
		const bad = undefinedColorUses().filter((u)=>!allow.has(u.v)).map((u)=>`${u.at} ${u.v}`);
		expect(bad).toEqual([]);
	});

	it('全仓:引用的 --horosa-* 在根主题块有定义(只在作用域里定义的局部色板,登记 SCOPED;同文件自定义自引用的不算)', ()=>{
		const allow = new Set(ALLOW.map(([v])=>v));
		const bad = [];
		FILES.forEach((f)=>{
			const rel = path.relative(SRC, f);
			const src = fs.readFileSync(f, 'utf8');
			(rel.endsWith('.js') ? usesJs(rel, src) : usesLess(rel, src)).forEach((u)=>{
				if(ROOT_DEFS.has(u.v) || allow.has(u.v) || !DEFS.has(u.v)){ return; }   // 全仓未定义的由上一条管
				if(localDefs(f).has(u.v)){ return; }
				if(SCOPED.some(([prefix])=>u.v.startsWith(prefix))){ return; }
				bad.push(`${u.at} ${u.v}`);
			});
		});
		expect(bad).toEqual([]);
		expect(ROOT_DEFS.has('--horosa-text-secondary') && ROOT_DEFS.has('--horosa-astro-muted') && ROOT_DEFS.size > 150).toBe(true);
		SCOPED.forEach(([prefix, why])=>{ expect([prefix, `${why || ''}`.trim().length > 4]).toEqual([prefix, true]); });
		// SCOPED 过期检查:登记的前缀仍有作用域外(别的文件)的引用
		const crossUse = (prefix)=>FILES.some((f)=>{
			const rel = path.relative(SRC, f);
			const src = fs.readFileSync(f, 'utf8');
			return (rel.endsWith('.js') ? usesJs(rel, src) : usesLess(rel, src)).some((u)=>u.v.startsWith(prefix) && !ROOT_DEFS.has(u.v) && !localDefs(f).has(u.v));
		});
		SCOPED.forEach(([prefix])=>{ expect([prefix, crossUse(prefix)]).toEqual([prefix, true]); });
	});

	it('登记表:写了理由,且该变量仍未定义、仍被引用(否则删掉)', ()=>{
		const uses = undefinedColorUses();
		ALLOW.forEach(([v, why])=>{
			expect([v, `${why || ''}`.trim().length > 4]).toEqual([v, true]);
			expect([v, DEFS.has(v)]).toEqual([v, false]);
			expect([v, uses.some((u)=>u.v === v)]).toEqual([v, true]);
		});
	});
});
