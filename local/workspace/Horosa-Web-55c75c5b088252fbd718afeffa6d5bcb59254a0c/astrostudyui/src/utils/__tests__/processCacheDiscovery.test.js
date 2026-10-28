// 进程内结果缓存登记处的静态发现合同(全 src,AST):
// 模块级的 Map / Set / 对象 / 变量缓存,只要在「发请求的函数」里被写入(请求结果或在途 Promise 存进去),
// 就必须在同一文件里经 registerProcessCache 登记清空函数(清空函数里引用到它),或在下表登记「为什么不必登记」。
// 动态自检(设置差分闸的缺省两遍)只在跑到的上下文与盘变体里生效;只在兄弟上下文 / 扫描点命中的新缓存靠本合同兜住。
// 「发请求的函数」= 函数体里调 request / fetch / cachedKentangFetch / postKentang,或调同文件里这样的函数(逐层传递)。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const SRC = path.join(__dirname, '..', '..');

// 「文件|变量」→ 理由(不在挂载 / 导出 / 审计取样链上,或只做在途去重)
const EXEMPT = {
	'services/xuanshi.js|_requestCache': '玄学史检索结果复用,只被玄学史页与检索工具读;与盘、与排盘设置无关',
	'services/rules.js|ZIWEI_RULES_CACHE': '紫微规则表(静态数据),与盘、与设置无关',
	'components/huangji/HuangJiMain.js|CLASSIC_FULL_PENDING': '在途去重,落定即删(结果缓存 CLASSIC_FULL_CACHE 已登记)',
	// 不是盘的计算结果:资源 / 连接 / 状态
	'models/astro.js|chartMainAbortCtl': '请求中止句柄,不是结果缓存',
	'utils/aiExportPdfVector.js|_fontBytesPromise': '字体文件字节(静态资源)',
	'utils/aiExportPdfVector.js|_boldFontBytesPromise': '字体文件字节(静态资源)',
	'utils/pageScreenshot.js|_screenshotFontCssPromise': '字体样式(静态资源)',
	'utils/astrodata/celebrityDb.js|dbPromise': '名人库数据库连接句柄',
	'utils/astrodata/celebrityDb.js|testDb': '测试注入的数据库句柄',
	'utils/backendBootGate.js|readyRoots': '后端就绪状态,不是计算结果',
	'utils/backendBootGate.js|waiters': '等待后端就绪的回调队列',
	'utils/backendIdentity.js|_lastOutcome': '后端身份探测状态,不是计算结果',
	'utils/backendIdentity.js|_inflight': '后端身份探测的在途去重',
};

function listJs(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((d)=>{
		if(d.name === 'node_modules' || d.name === '__tests__' || d.name === '.umi' || d.name === '.umi-production'){ return; }
		const p = path.join(dir, d.name);
		if(d.isDirectory()){ listJs(p, out); return; }
		if(/\.(js|jsx)$/.test(d.name) && !/\.test\.js$/.test(d.name)){ out.push(p); }
	});
	return out;
}
const parse = (text)=>parser.parse(text, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport', 'nullishCoalescingOperator'], errorRecovery: true });
const SKIP = new Set(['loc', 'start', 'end', 'leadingComments', 'trailingComments', 'innerComments', 'extra']);
function each(n, f){
	if(!n || typeof n.type !== 'string'){ return; }
	f(n);
	Object.keys(n).forEach((k)=>{
		if(SKIP.has(k)){ return; }
		const v = n[k];
		if(Array.isArray(v)){ v.forEach((c)=>each(c, f)); } else if(v && typeof v === 'object'){ each(v, f); }
	});
}
const REQUEST_CALLEES = new Set(['request', 'fetch', 'cachedKentangFetch', 'postKentang']);
const calleeName = (c)=>{
	if(c.type === 'Identifier'){ return c.name; }
	if(c.type === 'MemberExpression' && !c.computed && c.property.type === 'Identifier' && c.object.type === 'Identifier' && c.object.name === 'window'){ return c.property.name; }
	return null;
};
const isCacheInit = (init)=>init && (
	(init.type === 'NewExpression' && init.callee.type === 'Identifier' && ['Map', 'Set', 'WeakMap'].includes(init.callee.name))
	|| (init.type === 'ObjectExpression' && init.properties.length === 0)
	|| init.type === 'NullLiteral'
);

// 一个文件里:模块级缓存变量 → 是否在发请求的函数里被写入、是否被登记
function scanText(text){
	const ast = parse(text);
	const caches = new Set();
	ast.program.body.forEach((st)=>{
		const decl = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
		if(decl && decl.type === 'VariableDeclaration'){
			decl.declarations.forEach((d)=>{ if(d.id.type === 'Identifier' && isCacheInit(d.init)){ caches.add(d.id.name); } });
		}
	});
	if(!caches.size){ return []; }
	// 函数(顶层声明 / 顶层箭头 / 类方法 / 对象方法)
	const fns = [];
	each(ast, (n)=>{
		if(/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|ClassMethod|ObjectMethod)$/.test(n.type)){ fns.push(n); }
	});
	const nameOf = new Map();
	ast.program.body.forEach((st)=>{
		const decl = st.type === 'ExportNamedDeclaration' || st.type === 'ExportDefaultDeclaration' ? st.declaration : st;
		if(!decl){ return; }
		if(decl.type === 'FunctionDeclaration' && decl.id){ nameOf.set(decl, decl.id.name); }
		if(decl.type === 'VariableDeclaration'){
			decl.declarations.forEach((d)=>{ if(d.id.type === 'Identifier' && d.init && /Function/.test(d.init.type)){ nameOf.set(d.init, d.id.name); } });
		}
	});
	const callsIn = (fn)=>{ const out = new Set(); each(fn.body, (n)=>{ if(n.type === 'CallExpression'){ const c = calleeName(n.callee); if(c){ out.add(c); } } }); return out; };
	const requesting = new Set();
	const fnCalls = fns.map((fn)=>({ fn, calls: callsIn(fn) }));
	let grew = true;
	while(grew){
		grew = false;
		fnCalls.forEach(({ fn, calls })=>{
			const nm = nameOf.get(fn);
			if(requesting.has(fn)){ return; }
			if([...calls].some((c)=>REQUEST_CALLEES.has(c) || [...requesting].some((r)=>nameOf.get(r) === c))){
				requesting.add(fn);
				if(nm){ grew = true; }
			}
		});
	}
	// 写入:X.set(...) / X.add(...) / X[k] = ... / X = 非空
	const writtenIn = new Set();
	fns.filter((fn)=>requesting.has(fn)).forEach((fn)=>{
		each(fn.body, (n)=>{
			if(n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.type === 'Identifier' && caches.has(n.callee.object.name)
				&& !n.callee.computed && ['set', 'add'].includes(n.callee.property.name)){ writtenIn.add(n.callee.object.name); }
			// 交给别的函数去写(pushCache(cache, k, v) 这类):当作写入(保守)
			if(n.type === 'CallExpression' && n.arguments.some((a)=>a.type === 'Identifier' && caches.has(a.name))){
				n.arguments.forEach((a)=>{ if(a.type === 'Identifier' && caches.has(a.name)){ writtenIn.add(a.name); } });
			}
			if(n.type === 'AssignmentExpression'){
				const l = n.left;
				if(l.type === 'MemberExpression' && l.object.type === 'Identifier' && caches.has(l.object.name)){ writtenIn.add(l.object.name); }
				if(l.type === 'Identifier' && caches.has(l.name) && n.right.type !== 'NullLiteral'){ writtenIn.add(l.name); }
			}
		});
	});
	// 登记:registerProcessCache(name, 清空函数) 的实参里引用到它(或引用到引用它的同文件函数)
	const registered = new Set();
	each(ast, (n)=>{
		if(n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'registerProcessCache' && n.arguments[1]){
			const ids = new Set();
			each(n.arguments[1], (x)=>{ if(x.type === 'Identifier'){ ids.add(x.name); } });
			fns.forEach((fn)=>{ if(ids.has(nameOf.get(fn))){ each(fn.body, (x)=>{ if(x.type === 'Identifier'){ ids.add(x.name); } }); } });
			ids.forEach((i)=>{ if(caches.has(i)){ registered.add(i); } });
		}
	});
	return [...writtenIn].map((v)=>({ name: v, registered: registered.has(v) }));
}

describe('进程内结果缓存:发请求的函数写入的模块级缓存必须登记或豁免', ()=>{
	const all = [];
	listJs(SRC, []).forEach((file)=>{
		const rel = path.relative(SRC, file).split(path.sep).join('/');
		const text = fs.readFileSync(file, 'utf8');
		if(!/\b(request|fetch|cachedKentangFetch|postKentang)\s*\(/.test(text)){ return; }
		scanText(text).forEach((c)=>all.push({ key: `${rel}|${c.name}`, registered: c.registered }));
	});

	test('未登记、也未豁免的 = 红', ()=>{
		const bad = all.filter((c)=>!c.registered && !EXEMPT[c.key]).map((c)=>c.key);
		expect(bad).toEqual([]);
	});
	test('豁免表不过期:登记过的就从豁免表删掉,文件 / 变量已不在的也删掉', ()=>{
		const keys = new Set(all.map((c)=>c.key));
		const stale = Object.keys(EXEMPT).filter((k)=>{
			if(!fs.existsSync(path.join(SRC, k.split('|')[0]))){ return false; }
			const hit = all.find((c)=>c.key === k);
			return !keys.has(k) || (hit && hit.registered);
		});
		expect(stale).toEqual([]);
	});
	test('判别力:已登记的结果缓存认得出;撤掉登记就红', ()=>{
		const india = fs.readFileSync(path.join(SRC, 'components/astro/IndiaChart.js'), 'utf8');
		const got = scanText(india);
		expect(got.filter((c)=>c.registered).map((c)=>c.name)).toEqual(expect.arrayContaining(['indiaChartCache']));
		const unregistered = scanText(india.replace(/registerProcessCache\('india\.chart'[^\n]*\n/, '\n'));
		expect(unregistered.filter((c)=>!c.registered).map((c)=>c.name)).toEqual(expect.arrayContaining(['indiaChartCache']));
		const toy = 'const memo = new Map();\nasync function load(k){ const r = await request(`/x/${k}`); memo.set(k, r); return r; }';
		expect(scanText(toy)).toEqual([{ name: 'memo', registered: false }]);
		expect(scanText(`${toy}\nregisterProcessCache('toy', ()=>memo.clear());`)).toEqual([{ name: 'memo', registered: true }]);
	});
});
