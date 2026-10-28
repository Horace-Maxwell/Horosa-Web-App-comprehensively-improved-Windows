// 「加载失败的 Promise 不许被永久缓存」合同(全 src 模块级缓存):
// 模块级 `let X = null` + 函数里 `if(!X){ X = import(…) / load() }` 这种在途 / 结果缓存,失败一次后若不把 X 复位,
// 本会话里之后每次都拿到同一个失败(分包载入一次 503、换了分包哈希而页面还开着,之后永远载不出来);
// 把失败吞成「成功的空值」再缓存(`.catch(()=>{ lib = [] })`)同病,而且更隐蔽——不报错也不重试。
// 正确写法(仓内既有):`X = load().catch((e)=>{ X = null; throw e; })`;Map 缓存失败时 `M.delete(k)`。
// 串行链(`chain = chain.then(fn)`)不是缓存,但同样不许被一次失败卡死:链尾必须吞掉失败(`.catch` 或 then 的第二参)。
// 判据(AST):
//   C1 缓存变量(在 if / || / ?? / 三元里被当「有没有」判过)被赋成 Promise 链:链上必须有回调把它复位成 null / undefined;
//   C2 链里的失败回调不许把别的模块级缓存写成非空值(失败当成功缓存);
//   C3 串行链(右边引用自己,或变量名是 *Chain / *Lock)链尾必须吞掉失败;
//   C4 模块级 Map 的 `.set(k, Promise 链)`:链上必须有 `.delete(…)`(失败时摘掉),否则登记理由。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const SRC = path.join(__dirname, '..', '..');

// 「文件|规则|变量」→ 理由
const EXEMPT = {
	'utils/rsahelper.js|C2|gcmSelfTest': '响应加密能力自测:失败即锁定走旧路径(失效安全,不反复试探);它是能力判定状态,不是缓存的载入结果',
	'utils/aiAnalysisStore.js|C2|openDbPromise': '只有 VersionError(库被更新版本升过,重试无益)钉死成会话级内存模式,记健康态、派事件,横幅告知;其它打开失败一律复位、退避后下次访问重试(aiAnalysisStoreOpenRetry.test.js)',
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
function each(n, f){
	if(!n || typeof n.type !== 'string'){ return; }
	f(n);
	Object.keys(n).forEach((k)=>{
		if(k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments'){ return; }
		const v = n[k];
		if(Array.isArray(v)){ v.forEach((c)=>each(c, f)); } else if(v && typeof v === 'object'){ each(v, f); }
	});
}
const isNil = (n)=>n && (n.type === 'NullLiteral' || (n.type === 'Identifier' && n.name === 'undefined'));
const methodCall = (n, names)=>n && n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed && names.includes(n.callee.property.name);
const isPromiseStatic = (n, names)=>n && n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.type === 'Identifier' && n.callee.object.name === 'Promise' && names.includes(n.callee.property.name);
// 只看表达式自身的调用脊(a.then(…).catch(…) 的 a / then / catch),不看回调里面嵌套的 Promise
function isPromiseChain(n){
	if(isPromiseStatic(n, ['resolve'])){ return false; }   // 现成的已兑现值:不会失败(失败回调里写它另由 C2 管)
	let cur = n;
	while(cur){
		if(cur.type === 'AwaitExpression'){ return false; }   // await 后才赋值 = 只缓存成功
		if(cur.type === 'Import' || (cur.type === 'CallExpression' && cur.callee.type === 'Import')){ return true; }
		if(cur.type === 'NewExpression' && cur.callee.type === 'Identifier' && cur.callee.name === 'Promise'){ return true; }
		if(isPromiseStatic(cur, ['resolve', 'reject', 'race', 'all', 'allSettled', 'any'])){ return true; }
		if(methodCall(cur, ['then', 'catch', 'finally'])){ return true; }
		if(cur.type === 'CallExpression' && cur.callee.type === 'MemberExpression'){ cur = cur.callee.object; continue; }
		return false;
	}
	return false;
}
// 链的最外层是否吞掉失败:最外层调用是 .catch(…) / .then(a, b),或 .then/.finally 包在一个已吞失败的链外;
// Promise.race / any 只要有一臂吞掉失败(或是只 resolve 的定时器)即不会被卡死
function outerSwallows(n){
	let cur = n;
	if(isPromiseStatic(cur, ['race', 'any']) && cur.arguments[0] && cur.arguments[0].type === 'ArrayExpression'){
		return cur.arguments[0].elements.some((e)=>outerSwallows(e) || (e && e.type === 'NewExpression'));
	}
	while(cur && cur.type === 'CallExpression' && cur.callee.type === 'MemberExpression'){
		const name = cur.callee.property.name;
		if(name === 'catch'){ return true; }
		if(name === 'then' && cur.arguments.length >= 2){ return true; }
		if(name !== 'then' && name !== 'finally'){ return false; }
		cur = cur.callee.object;
	}
	return false;
}
// 失败回调:.catch(fn) 的 fn、.then(a, fn) 的 fn
function failureHandlers(n){
	const out = [];
	each(n, (m)=>{
		if(methodCall(m, ['catch']) && m.arguments[0]){ out.push(m.arguments[0]); }
		if(methodCall(m, ['then']) && m.arguments[1]){ out.push(m.arguments[1]); }
	});
	return out;
}

function scanText(text, rel){
	const ast = parse(text);
	const modLet = new Set();
	const modMap = new Set();
	ast.program.body.forEach((st)=>{
		const d = st.type === 'VariableDeclaration' ? st : (st.type === 'ExportNamedDeclaration' && st.declaration && st.declaration.type === 'VariableDeclaration' ? st.declaration : null);
		if(!d){ return; }
		d.declarations.forEach((x)=>{
			if(x.id.type !== 'Identifier'){ return; }
			if(d.kind === 'let'){ modLet.add(x.id.name); }
			if(x.init && x.init.type === 'NewExpression' && x.init.callee.type === 'Identifier' && x.init.callee.name === 'Map'){ modMap.add(x.id.name); }
		});
	});
	const hits = [];
	const add = (rule, name)=>{
		const id = `${rel}|${rule}|${name}`;
		if(!EXEMPT[id] && !hits.includes(id)){ hits.push(id); }
	};
	// 缓存判定:变量在 if / 三元的判定里,或作 || ?? && 左侧
	const memo = new Set();
	each(ast.program, (n)=>{
		const mark = (t)=>each(t, (m)=>{ if(m.type === 'Identifier' && modLet.has(m.name)){ memo.add(m.name); } });
		if(n.type === 'IfStatement' || n.type === 'ConditionalExpression'){ mark(n.test); }
		if(n.type === 'LogicalExpression'){ mark(n.left); }
	});
	const resets = (expr, name)=>{
		let ok = false;
		each(expr, (m)=>{ if(m.type === 'AssignmentExpression' && m.left.type === 'Identifier' && m.left.name === name && isNil(m.right)){ ok = true; } });
		return ok;
	};
	each(ast.program, (n)=>{
		if(n.type === 'AssignmentExpression' && n.operator === '=' && n.left.type === 'Identifier' && modLet.has(n.left.name) && isPromiseChain(n.right)){
			const X = n.left.name;
			// 串行链 = 右边「读」了自己(复位语句里的赋值目标不算读)
			const targets = new Set();
			each(n.right, (m)=>{ if(m.type === 'AssignmentExpression' && m.left.type === 'Identifier' && m.left.name === X){ targets.add(m.left); } });
			let selfRef = false;
			each(n.right, (m)=>{ if(m.type === 'Identifier' && m.name === X && !targets.has(m)){ selfRef = true; } });
			const chain = selfRef || /(Chain|Lock)$/.test(X);
			if(chain){
				if(!outerSwallows(n.right)){ add('C3', X); }
			}else if(memo.has(X) && !resets(n.right, X)){
				add('C1', X);
			}
		}
		if(methodCall(n, ['set']) && n.callee.object.type === 'Identifier' && modMap.has(n.callee.object.name) && n.arguments[1] && isPromiseChain(n.arguments[1])){
			let del = false;
			each(n.arguments[1], (m)=>{ if(methodCall(m, ['delete'])){ del = true; } });
			if(!del){ add('C4', n.callee.object.name); }
		}
	});
	// C2:任何失败回调(.catch(fn) / .then(a, fn))里把模块级缓存写成非空值 = 失败当成功缓存
	failureHandlers(ast.program).forEach((h)=>{
		each(h, (m)=>{
			if(m.type === 'AssignmentExpression' && m.operator === '=' && m.left.type === 'Identifier' && modLet.has(m.left.name) && memo.has(m.left.name) && !isNil(m.right)){ add('C2', m.left.name); }
		});
	});
	return hits;
}

describe('加载失败的 Promise 不被永久缓存(全 src 模块级缓存)', ()=>{
	it('没有失败后永不复位的缓存 / 失败当成功的缓存 / 会被一次失败卡死的串行链', ()=>{
		const bad = [];
		const seen = new Set();
		listJs(SRC, []).forEach((abs)=>{
			const rel = path.relative(SRC, abs).split(path.sep).join('/');
			const text = fs.readFileSync(abs, 'utf8');
			scanText(text, rel).forEach((h)=>bad.push(h));
			Object.keys(EXEMPT).filter((id)=>id.startsWith(`${rel}|`)).forEach((id)=>seen.add(id));
		});
		expect(bad).toEqual([]);
	});
	it('豁免表每一条都还命中(过期即红)', ()=>{
		const stale = [];
		Object.keys(EXEMPT).forEach((id)=>{
			const rel = id.split('|')[0];
			const abs = path.join(SRC, rel);
			if(!fs.existsSync(abs)){ stale.push(id); return; }
			const save = EXEMPT[id];
			delete EXEMPT[id];
			const hits = scanText(fs.readFileSync(abs, 'utf8'), rel);
			EXEMPT[id] = save;
			if(!hits.includes(id)){ stale.push(id); }
		});
		expect(stale).toEqual([]);
	});
	it('判据自证:修前写法必红,仓内正确写法必绿', ()=>{
		const red = {
			C1: "let p = null; export function load(){ if(!p){ p = import('./x.json').then((m)=>m.default || m); } return p; }",
			C2: "let lib = null; let loading = null; export function load(){ if(lib){ return Promise.resolve(lib); } if(!loading){ loading = import('./c.json').then((m)=>{ lib = m; return lib; }).catch(()=>{ lib = []; return lib; }); } return loading; }",
			C3: 'let chain = Promise.resolve(); export function run(fn){ chain = chain.then(fn); return chain; }',
			C4: 'const cache = new Map(); export function get(k){ if(!cache.has(k)){ cache.set(k, fetchX(k).then((r)=>r.json())); } return cache.get(k); }',
		};
		Object.keys(red).forEach((rule)=>{
			expect(scanText(red[rule], 'f.js').some((h)=>h.split('|')[1] === rule)).toBe(true);
		});
		const green = [
			"let p = null; export function load(){ if(!p){ p = import('./x.json').then((m)=>m.default || m).catch((e)=>{ p = null; throw e; }); } return p; }",
			"let lib = null; let loading = null; export function load(){ if(lib){ return Promise.resolve(lib); } if(!loading){ loading = import('./c.json').then((m)=>{ lib = m; return lib; }).catch(()=>{ loading = null; return []; }); } return loading; }",
			'let chain = Promise.resolve(); export function run(fn){ const r = chain.then(fn); chain = r.then(()=>undefined, ()=>undefined); return r; }',
			'let inflight = null; export function prune(){ if(inflight){ return inflight; } inflight = wait().then(()=>work()).catch(()=>0).then((n)=>{ inflight = null; return n; }); return inflight; }',
			"let lib = null; async function load(){ if(lib) return lib; try{ lib = await import('x'); return lib; }catch(e){ return null; } }",
			'const cache = new Map(); export function get(k){ if(!cache.has(k)){ cache.set(k, fetchX(k).catch((e)=>{ cache.delete(k); throw e; })); } return cache.get(k); }',
		];
		green.forEach((code)=>{ expect([code, scanText(code, 'f.js')]).toEqual([code, []]); });
	});
});
