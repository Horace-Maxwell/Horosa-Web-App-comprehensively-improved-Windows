// 模块级缓存要有上限(全 src):模块级 `new Map()` / `new Set()` 若在运行期(函数里)不断写入,
// 同一文件里必须有淘汰手段(读 .size 设上限 / .clear() / .delete() / 整体换新);
// 键域本身有限的(按配色、按派别、按页签、按代码里登记的名字)登记在 EXEMPT 并写清键域。
// 来源:卦辞缓存无界、年度吉日榜按日累积从不清理(每扫一年多 365 条)。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const SRC = path.join(__dirname, '..', '..');

// 「文件|变量」→ 键域为什么有限
const EXEMPT = {
	'components/astro3d/labelSprite.js|glowTexCache': '键 = 光点颜色 × 核心比例,取自盘面配色表与主题(有限)',
	'services/_requestCache.js|registry': '键 = 代码里登记的请求命名空间;每个命名空间的条目另有 max 上限',
	'utils/aiAnalysisStore.js|MEMORY_DB': '无 IndexedDB 时的内存替身库,键 = 库名(代码登记);各库条目走与 IndexedDB 相同的淘汰',
	'utils/aiTools/ledger.js|undoHandlers': '键 = 代码里登记的撤销种类',
	'utils/aiTools/zeriSchools.js|cache': '键 = 择日流派名(有限枚举)',
	'utils/idleWarmQueue.js|DATA_WARM_REGISTRY': '键 = 代码里登记的预热任务名',
	'utils/processCacheRegistry.js|REGISTRY': '键 = 代码里登记的缓存名(各模块载入时登记一次)',
	'utils/scriptConvert/hantConverter.js|tradCache': '键 = 单个汉字,上限 = 字库大小',
	'utils/stepPrefetchArm.js|lastUnitByTab': '键 = 页签名(有限)',
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
const isFn = (n)=>n && /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|ClassMethod|ClassPrivateMethod|ObjectMethod)$/.test(n.type);

function scanText(text, rel){
	const ast = parse(text);
	const caches = new Set();
	ast.program.body.forEach((st)=>{
		const d = st.type === 'VariableDeclaration' ? st : (st.type === 'ExportNamedDeclaration' && st.declaration && st.declaration.type === 'VariableDeclaration' ? st.declaration : null);
		if(!d){ return; }
		d.declarations.forEach((x)=>{
			if(x.id.type === 'Identifier' && x.init && x.init.type === 'NewExpression' && x.init.callee.type === 'Identifier' && (x.init.callee.name === 'Map' || x.init.callee.name === 'Set') && !(x.init.arguments || []).length){ caches.add(x.id.name); }
		});
	});
	if(!caches.size){ return []; }
	const runtimeWrites = new Set();
	const bounded = new Set();
	// 运行期写入 = 写在「不在模块加载时立即执行」的函数里(模块顶层 forEach 的回调算加载期)
	const walk = (n, inRuntimeFn, topStmt)=>{
		if(!n || typeof n.type !== 'string'){ return; }
		let runtime = inRuntimeFn;
		if(isFn(n)){
			// 顶层语句里直接作为实参调用的回调(arr.forEach(cb))在加载期执行;其余函数体在运行期
			runtime = runtime || !(topStmt && (topStmt.type === 'ExpressionStatement' || topStmt.type === 'VariableDeclaration') && n.__arg);
		}
		if(n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed && n.callee.object.type === 'Identifier' && caches.has(n.callee.object.name)){
			const X = n.callee.object.name;
			const m = n.callee.property.name;
			if((m === 'set' || m === 'add') && runtime){ runtimeWrites.add(X); }
			if(m === 'clear' || m === 'delete'){ bounded.add(X); }
		}
		if(n.type === 'MemberExpression' && !n.computed && n.object.type === 'Identifier' && caches.has(n.object.name) && n.property.name === 'size'){ bounded.add(n.object.name); }
		if(n.type === 'AssignmentExpression' && n.left.type === 'Identifier' && caches.has(n.left.name)){ bounded.add(n.left.name); }
		if(n.type === 'CallExpression'){ (n.arguments || []).forEach((a)=>{ if(a && typeof a === 'object'){ a.__arg = true; } }); }
		Object.keys(n).forEach((k)=>{
			if(k === 'loc' || k === 'start' || k === 'end' || k === '__arg'){ return; }
			const v = n[k];
			if(Array.isArray(v)){ v.forEach((c)=>walk(c, runtime, topStmt)); } else if(v && typeof v === 'object'){ walk(v, runtime, topStmt); }
		});
	};
	ast.program.body.forEach((st)=>walk(st, false, st));
	return [...runtimeWrites].filter((X)=>!bounded.has(X)).map((X)=>`${rel}|${X}`).filter((id)=>!EXEMPT[id]);
}

describe('模块级缓存要有上限(全 src)', ()=>{
	it('运行期不断写入的模块级 Map / Set 都有淘汰手段或登记了有限键域', ()=>{
		const bad = [];
		listJs(SRC, []).forEach((abs)=>{
			const rel = path.relative(SRC, abs).split(path.sep).join('/');
			bad.push(...scanText(fs.readFileSync(abs, 'utf8'), rel));
		});
		expect(bad).toEqual([]);
	});
	it('豁免表每一条都还命中(过期即红)', ()=>{
		const stale = Object.keys(EXEMPT).filter((id)=>{
			const [rel] = id.split('|');
			const abs = path.join(SRC, rel);
			if(!fs.existsSync(abs)){ return true; }
			const save = EXEMPT[id];
			delete EXEMPT[id];
			const hits = scanText(fs.readFileSync(abs, 'utf8'), rel);
			EXEMPT[id] = save;
			return !hits.includes(id);
		});
		expect(stale).toEqual([]);
	});
	it('判据自证:按日累积无上限必红;有 size 上限 / 加载期一次建表必绿', ()=>{
		expect(scanText('const dayCache = new Map(); export function f(k){ if(!dayCache.has(k)){ dayCache.set(k, 1); } return dayCache.get(k); }', 'x.js')).toEqual(['x.js|dayCache']);
		expect(scanText('const memo = new Map(); export function f(k){ if(memo.size > 100){ memo.clear(); } memo.set(k, 1); }', 'x.js')).toEqual([]);
		expect(scanText('const byKey = new Map(); LIST.forEach((g)=>{ byKey.set(g.k, g); }); export function get(k){ return byKey.get(k); }', 'x.js')).toEqual([]);
	});
});
