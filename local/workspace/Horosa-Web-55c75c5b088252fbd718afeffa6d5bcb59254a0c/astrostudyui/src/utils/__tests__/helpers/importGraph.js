// 模块静态导入图 + 环内「求值期抢读」判定(非 .test.js:测试公因子,照 helpers/ 惯例)。
//
// 为什么要它:原生 ESM / webpack 打包后,互相成环的几个模块里,先被求值的那个在顶层读到另一个还没求值的模块的
// export const / let / class(或调用它的函数)= ReferenceError(暂时性死区),整个分包加载失败;jest 走 babel 转 CJS,
// 同样的写法只读到 undefined,不报错 —— jest 全绿、真机坏。函数声明会被提升,只「取值」不调用才安全。
//
// analyzeModules(文件表, { exists }) —— 文件表 = Map(绝对路径 → 源码);exists(路径) 判文件是否在图里(缺省 = 文件表里有)。
//   返回 { graph, sccs, violations, parseErrors }:
//     graph       Map(路径 → Set(依赖路径)):静态 import / export … from / 顶层(求值期)的 require('./x');动态 import() 不算(延后)
//     sccs        强连通分量(只列 ≥ 2 个模块的;每个分量内路径已排序)
//     violations  [{ file, line, name, target, reason }]:同一强连通分量内、模块求值期读到的跨模块绑定不安全的每一处
//   「求值期」= 顶层语句、顶层变量初始化、class 的 extends / static 字段 / 计算键、顶层立即调用的函数体、
//   作为实参交给求值期调用的回调体、被求值期调用的本模块函数的函数体(逐层传递)。
//   「安全」= 目标绑定是函数声明,且这一处只取值、不调用(不在任何调用 / new / 标签模板之内 —— 交给别人的函数也可能被当场调用)。
//   顶层 require 环内模块一律算不安全(拿到的是半成品 exports)。
// scanSourceTree(src 根) —— 读 src 下全部非测试 .js / .jsx(跳过 __tests__ / node_modules / .umi*)并分析。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const PARSE_OPTS = {
	sourceType: 'module',
	plugins: ['jsx', 'classProperties', 'classPrivateProperties', 'classPrivateMethods', 'dynamicImport', 'optionalChaining',
		'nullishCoalescingOperator', 'objectRestSpread', 'exportDefaultFrom', 'decorators-legacy', 'numericSeparator',
		'logicalAssignment', 'topLevelAwait'],
};
const CODE_EXT = /\.jsx?$/;
const NON_CODE = /\.(less|css|json|png|jpe?g|gif|svg|md|txt|wasm|woff2?|ttf)$/i;

// horosa_win_pathsep_posix_v1(Windows 侧移植适配;建议上游化):说明符按「文件表键自己的写法」拼接。
// Windows 上 path.resolve 会给无盘符的根路径补当前盘符(内存判别向量的键 '\virt\a.js' 旁的 './b' → 'C:\virt\b'),
// POSIX 写法的键('/v/src/m.js')还会被拼成反斜杠 ⇒ 判别向量的键一个都查不中、整组静默失明(macOS 恒绿)。
// Windows:不含反斜杠的键按 path.posix、其余按平台 path,一律 join(键已是绝对路径,无须 resolve 补 cwd;
// 真实源码树的键 'C:\…' 结果与 resolve 逐字节相同)。macOS / Linux:path.sep === '/' ⇒ 原式 path.resolve / path.join 不变。
const pathOf = (p)=>((path.sep !== '/' && `${p}`.indexOf('\\') < 0) ? path.posix : path);
const joinRel = (dir, spec)=>(path.sep === '/' ? path.resolve(dir, spec) : pathOf(dir).join(dir, spec));

function resolveSpec(fromFile, spec, exists, srcRoot){
	let base = null;
	if(spec.startsWith('./') || spec.startsWith('../')){ base = joinRel(path.dirname(fromFile), spec); }
	else if(spec.startsWith('@/') && srcRoot){ base = pathOf(srcRoot).join(srcRoot, spec.slice(2)); }
	if(!base || NON_CODE.test(spec)){ return null; }
	for(const c of [base, `${base}.js`, `${base}.jsx`, pathOf(base).join(base, 'index.js'), pathOf(base).join(base, 'index.jsx')]){
		if(CODE_EXT.test(c) && exists(c)){ return c; }
	}
	return null;
}

const isCall = (p)=>p.isCallExpression() || p.isNewExpression() || p.isOptionalCallExpression() || p.isTaggedTemplateExpression();

// 每个模块:导入绑定 / 导出表 / 顶层声明种类 / 依赖边(含是否求值期 require)
function moduleInfo(file, ast, exists, srcRoot){
	const deps = new Set();
	const eagerRequires = [];
	const imports = new Map();     // 本地名 → { target, imported }(imported: 名字 / 'default' / '*')
	const exportsLocal = new Map(); // 导出名 → 本地名
	const reexports = new Map();   // 导出名 → { target, imported }
	const stars = [];              // export * from 的目标
	const declKind = new Map();    // 顶层本地名 → 'function' | 'const' | 'let' | 'var' | 'class' | 'import' | 'value'
	let defaultKind = null;        // export default 的种类
	const body = ast.program.body;
	body.forEach((s)=>{
		if(s.type === 'ImportDeclaration'){
			if(s.importKind === 'type'){ return; }
			const t = resolveSpec(file, s.source.value, exists, srcRoot);
			if(t){ deps.add(t); }
			s.specifiers.forEach((sp)=>{
				const imported = sp.type === 'ImportDefaultSpecifier' ? 'default' : sp.type === 'ImportNamespaceSpecifier' ? '*' : (sp.imported.name || sp.imported.value);
				imports.set(sp.local.name, { target: t, imported });
				declKind.set(sp.local.name, 'import');
			});
			return;
		}
		if(s.type === 'ExportAllDeclaration'){
			const t = resolveSpec(file, s.source.value, exists, srcRoot);
			if(t){ deps.add(t); stars.push(t); }
			return;
		}
		if(s.type === 'ExportNamedDeclaration'){
			if(s.source){
				const t = resolveSpec(file, s.source.value, exists, srcRoot);
				if(t){ deps.add(t); }
				s.specifiers.forEach((sp)=>{
					const exported = sp.exported.name || sp.exported.value;
					const imported = sp.type === 'ExportNamespaceSpecifier' ? '*' : sp.type === 'ExportDefaultSpecifier' ? 'default' : (sp.local.name || sp.local.value);
					reexports.set(exported, { target: t, imported });
				});
				return;
			}
			if(s.declaration){
				const d = s.declaration;
				if(d.type === 'FunctionDeclaration'){ declKind.set(d.id.name, 'function'); exportsLocal.set(d.id.name, d.id.name); }
				else if(d.type === 'ClassDeclaration'){ declKind.set(d.id.name, 'class'); exportsLocal.set(d.id.name, d.id.name); }
				else if(d.type === 'VariableDeclaration'){
					d.declarations.forEach((v)=>{
						Object.keys(traverseIds(v.id)).forEach((n)=>{ declKind.set(n, d.kind); exportsLocal.set(n, n); });
					});
				}
			}
			s.specifiers.forEach((sp)=>{ exportsLocal.set(sp.exported.name || sp.exported.value, sp.local.name); });
			return;
		}
		if(s.type === 'ExportDefaultDeclaration'){
			const d = s.declaration;
			if(d.type === 'FunctionDeclaration'){ defaultKind = 'function'; if(d.id){ declKind.set(d.id.name, 'function'); } }
			else if(d.type === 'ClassDeclaration'){ defaultKind = 'class'; if(d.id){ declKind.set(d.id.name, 'class'); } }
			else if(d.type === 'Identifier'){ defaultKind = { local: d.name }; }
			else { defaultKind = 'value'; }
			return;
		}
		if(s.type === 'FunctionDeclaration' && s.id){ declKind.set(s.id.name, 'function'); return; }
		if(s.type === 'ClassDeclaration' && s.id){ declKind.set(s.id.name, 'class'); return; }
		if(s.type === 'VariableDeclaration'){
			s.declarations.forEach((v)=>{ Object.keys(traverseIds(v.id)).forEach((n)=>declKind.set(n, s.kind)); });
		}
	});
	return { file, ast, deps, eagerRequires, imports, exportsLocal, reexports, stars, declKind, defaultKind };
}

// 解构模式里的全部绑定名
function traverseIds(node, out = {}){
	if(!node){ return out; }
	if(node.type === 'Identifier'){ out[node.name] = true; }
	else if(node.type === 'ObjectPattern'){ node.properties.forEach((p)=>traverseIds(p.type === 'RestElement' ? p.argument : p.value, out)); }
	else if(node.type === 'ArrayPattern'){ node.elements.forEach((e)=>traverseIds(e, out)); }
	else if(node.type === 'AssignmentPattern'){ traverseIds(node.left, out); }
	else if(node.type === 'RestElement'){ traverseIds(node.argument, out); }
	return out;
}

// 模块 info 的导出名 name 最终落在哪:{ file, kind }(kind: 'function' 安全取值;其余不安全;file 不在同一分量 = 已求值完、安全)
function resolveExport(infos, file, name, seen = new Set()){
	const key = `${file}#${name}`;
	if(seen.has(key)){ return { file, kind: 'unknown' }; }
	seen.add(key);
	const info = infos.get(file);
	if(!info){ return { file, kind: 'external' }; }
	if(name === 'default'){
		const dk = info.defaultKind;
		if(dk && typeof dk === 'object'){ return resolveLocal(infos, info, dk.local, seen); }
		if(dk){ return { file, kind: dk }; }
		if(info.exportsLocal.has('default')){ return resolveLocal(infos, info, info.exportsLocal.get('default'), seen); }
		if(info.reexports.has('default')){ const r = info.reexports.get('default'); return r.target ? resolveExport(infos, r.target, r.imported, seen) : { file, kind: 'external' }; }
		return { file, kind: 'unknown' };
	}
	if(info.exportsLocal.has(name)){ return resolveLocal(infos, info, info.exportsLocal.get(name), seen); }
	if(info.reexports.has(name)){
		const r = info.reexports.get(name);
		if(!r.target){ return { file, kind: 'external' }; }
		if(r.imported === '*'){ return { file: r.target, kind: 'namespace' }; }
		return resolveExport(infos, r.target, r.imported, seen);
	}
	for(const t of info.stars){
		const got = resolveExport(infos, t, name, seen);
		if(got.kind !== 'unknown'){ return got; }
	}
	return { file, kind: 'unknown' };
}
function resolveLocal(infos, info, local, seen){
	const kind = info.declKind.get(local);
	if(kind === 'import'){
		const imp = info.imports.get(local);
		if(!imp.target){ return { file: info.file, kind: 'external' }; }
		if(imp.imported === '*'){ return { file: imp.target, kind: 'namespace' }; }
		return resolveExport(infos, imp.target, imp.imported, seen);
	}
	return { file: info.file, kind: kind || 'unknown' };
}

// 一个标识符引用在不在求值期执行:返回 null = 延后(在没被当场调用的函数体里);否则 { called }(它本身处在某个调用之内)
function evalContext(idPath, eagerFns){
	let called = false;
	let inBody = true;   // 还在引用所在的那层函数体里(只这一层的调用算「它被调用」)
	let child = null;
	let p = idPath;
	while(p.parentPath){
		const parent = p.parentPath;
		// 方法 / 函数的计算键(class { [X]() {} })在定义处求值;其余部分(参数、函数体)只在被调用时求值
		const viaComputedKey = p.isFunction() && p.node.computed && child === p.node.key;
		if(p.isFunction() && !viaComputedKey){
			const fnNode = p.node;
			const viaCall = isCall(parent) && (parent.node.callee === fnNode || parent.node.tag === fnNode || (parent.node.arguments || []).includes(fnNode));
			const named = p.isFunctionDeclaration() && fnNode.id ? fnNode.id.name
				: (parent.isVariableDeclarator() && parent.node.init === fnNode && parent.node.id.type === 'Identifier' ? parent.node.id.name : null);
			const topLevel = p.isFunctionDeclaration() ? parent.isProgram() || parent.isExportNamedDeclaration() || parent.isExportDefaultDeclaration()
				: parent.isVariableDeclarator() && !!parent.parentPath.parentPath && (parent.parentPath.parentPath.isProgram() || parent.parentPath.parentPath.isExportNamedDeclaration());
			if(viaCall){ inBody = false; }                                        // 立即调用 / 交给求值期调用的回调:函数体在求值期跑
			else if(named && topLevel && eagerFns.has(named)){ return { called }; }  // 被求值期调用的本模块函数
			else { return null; }
		}else if((parent.isClassProperty() || parent.isClassPrivateProperty()) && parent.node.value === p.node && !parent.node.static){
			return null;   // 实例字段初值:构造时才求值
		}
		if(inBody && isCall(parent)){ called = true; }
		child = p.node;
		p = parent;
	}
	return { called };
}

function analyzeModules(files, opts = {}){
	const exists = opts.exists || ((p)=>files.has(p));
	const srcRoot = opts.srcRoot || null;
	const infos = new Map();
	const parseErrors = [];
	for(const [file, code] of files){
		let ast;
		try{ ast = parser.parse(code, PARSE_OPTS); }catch(e){ parseErrors.push(`${file}: ${e.message}`); continue; }
		const info = moduleInfo(file, ast, exists, srcRoot);
		// 顶层(求值期)的 require('./x') 也是边;函数体里的 require 延后,不算(源码里没有 require( 字样的不必走树)
		if(code.includes('require(')){
			traverse(ast, {
				CallExpression(p){
					const n = p.node;
					if(n.callee.type !== 'Identifier' || n.callee.name !== 'require' || !n.arguments[0] || n.arguments[0].type !== 'StringLiteral'){ return; }
					const t = resolveSpec(file, n.arguments[0].value, exists, srcRoot);
					if(!t){ return; }
					if(evalContext(p, new Set()) !== null){ info.deps.add(t); info.eagerRequires.push({ target: t, line: n.loc.start.line }); }
				},
			});
		}
		infos.set(file, info);
	}
	const graph = new Map([...infos].map(([f, i])=>[f, i.deps]));
	// Tarjan(迭代版,免深递归)
	const index = new Map(); const low = new Map(); const onStack = new Set(); const stack = []; const comp = new Map(); const all = [];
	let counter = 0;
	for(const start of graph.keys()){
		if(index.has(start)){ continue; }
		const work = [[start, [...(graph.get(start) || [])].filter((d)=>graph.has(d)), 0]];
		index.set(start, counter); low.set(start, counter); counter += 1; stack.push(start); onStack.add(start);
		while(work.length){
			const top = work[work.length - 1];
			const [v, succ] = top;
			if(top[2] < succ.length){
				const w = succ[top[2]]; top[2] += 1;
				if(!index.has(w)){
					index.set(w, counter); low.set(w, counter); counter += 1; stack.push(w); onStack.add(w);
					work.push([w, [...(graph.get(w) || [])].filter((d)=>graph.has(d)), 0]);
				}else if(onStack.has(w)){ low.set(v, Math.min(low.get(v), index.get(w))); }
				continue;
			}
			work.pop();
			if(work.length){ const u = work[work.length - 1][0]; low.set(u, Math.min(low.get(u), low.get(v))); }
			if(low.get(v) === index.get(v)){
				const c = []; let w;
				do{ w = stack.pop(); onStack.delete(w); c.push(w); comp.set(w, all.length); }while(w !== v);
				all.push(c.sort());
			}
		}
	}
	const sccs = all.filter((c)=>c.length > 1).sort((a, b)=>a[0].localeCompare(b[0]));
	const violations = [];
	sccs.forEach((c)=>{
		const members = new Set(c);
		c.forEach((file)=>{
			const info = infos.get(file);
			info.eagerRequires.filter((r)=>members.has(r.target)).forEach((r)=>{
				violations.push({ file, line: r.line, name: 'require', target: r.target, reason: '求值期 require 环内模块(拿到半成品 exports)' });
			});
			// 本模块被求值期调用的函数(逐层传递,到不动点):它们的函数体也在求值期执行
			const localFns = new Set([...info.declKind].filter(([, k])=>k === 'function' || k === 'const' || k === 'let' || k === 'var').map(([n])=>n));
			const eagerFns = new Set();
			let grew = true;
			while(grew){
				grew = false;
				traverse(info.ast, {
					ReferencedIdentifier(p){
						const n = p.node.name;
						if(!localFns.has(n) || eagerFns.has(n)){ return; }
						const b = p.scope.getBinding(n);
						if(!b || b.scope.block.type !== 'Program'){ return; }
						const ctx = evalContext(p, eagerFns);
						if(ctx && ctx.called){ eagerFns.add(n); grew = true; }
					},
				});
			}
			traverse(info.ast, {
				ReferencedIdentifier(p){
					const local = p.node.name;
					const imp = info.imports.get(local);
					if(!imp || !imp.target || !members.has(imp.target)){ return; }
					const b = p.scope.getBinding(local);
					if(!b || b.kind !== 'module'){ return; }
					if(p.parentPath.isExportSpecifier()){ return; }   // export { x }:活绑定转手,不读值
					const ctx = evalContext(p, eagerFns);
					if(!ctx){ return; }
					let name = imp.imported;
					let target = imp.target;
					let resolved;
					if(name === '*'){
						const mem = p.parentPath;
						if(mem.isMemberExpression() && mem.node.object === p.node && !mem.node.computed){
							name = mem.node.property.name;
							resolved = resolveExport(infos, target, name);
						}else{ resolved = { file: target, kind: 'namespace' }; }
					}else{ resolved = resolveExport(infos, target, name); }
					if(!members.has(resolved.file) || resolved.kind === 'external'){ return; }
					const line = p.node.loc ? p.node.loc.start.line : 0;
					if(resolved.kind !== 'function'){
						violations.push({ file, line, name, target: resolved.file, reason: `求值期读环内模块的 ${resolved.kind}(不是函数声明,先求值的一方读到暂时性死区)` });
					}else if(ctx.called){
						violations.push({ file, line, name, target: resolved.file, reason: '求值期调用环内模块的函数(它所在的模块可能还没求值)' });
					}
				},
			});
		});
	});
	return { graph, sccs, violations, parseErrors };
}

function listSourceFiles(dir, out = []){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const p = path.join(dir, e.name);
		if(e.isDirectory()){
			if(e.name === '__tests__' || e.name === 'node_modules' || e.name.startsWith('.umi')){ return; }
			listSourceFiles(p, out);
		}else if(CODE_EXT.test(e.name) && !/\.test\.jsx?$/.test(e.name)){
			out.push(p);
		}
	});
	return out;
}

function scanSourceTree(srcRoot){
	const files = new Map(listSourceFiles(srcRoot).sort().map((f)=>[f, fs.readFileSync(f, 'utf8')]));
	return analyzeModules(files, { srcRoot });
}

module.exports = { analyzeModules, scanSourceTree, listSourceFiles, resolveSpec, PARSE_OPTS };
