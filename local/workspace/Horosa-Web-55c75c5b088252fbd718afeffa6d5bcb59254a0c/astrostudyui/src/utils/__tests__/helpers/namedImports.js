// 具名导入必须真被导出(非 .test.js:测试公因子,照 helpers/ 惯例)。
//
// 为什么要它:webpack 4 / umi 3 对「导入的名字目标模块并不导出」只给一条警告,构建照过;jest(babel 转 CJS)里那个名字是
// undefined,不报错。眼下没用到这个名字就无害,哪天谁顺手用了,运行时就是 undefined(典型来历:目标模块改名 / 删了导出,
// 导入方没跟;或者导出写在会被剥掉的块里,块外的导入还在)。
//
// missingNamedImports(文件表, { exists, srcRoot }) —— 文件表 = Map(绝对路径 → 源码)。
//   对每条相对路径(./ ../)或 @/ 别名的 import { a, b as c } / import d / export { a } from,目标是文件表里的 .js / .jsx 模块时,
//   核目标的导出集合(export 声明 / export { } / export default / export * from 递归)里真有这个名字。
//   目标模块是 CommonJS(module.exports / exports.x)或解析失败、export * 指向认不出的模块 → 不判(无从静态确定导出集合)。
//   测试文件里对同一来源写了 jest.mock('<来源>', 工厂) 的 → 不判(工厂可以提供模块本身没有的名字)。
//   返回 [{ file, line, name, target }]。
// scanSourceTree(src 根) —— src 下全部 .js / .jsx(含测试;跳过 node_modules / .umi*)。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const { PARSE_OPTS } = require('./importGraph');

const CODE_EXT = /\.jsx?$/;
const NON_CODE = /\.(less|css|json|png|jpe?g|gif|svg|md|txt|wasm|woff2?|ttf)$/i;

// horosa_win_pathsep_posix_v1(Windows 侧移植适配;建议上游化):说明符按「文件表键自己的写法」拼接。
// Windows 上 path.resolve 会把 POSIX 写法的键('/v/src/m.js' 旁的 './m')拼成 'C:\v\src\m'(补盘符 + 改反斜杠),
// 无盘符的根路径键同样被补盘符 ⇒ 判别向量的键一个都查不中、悬空导入一条都报不出(macOS 恒绿)。
// Windows:不含反斜杠的键按 path.posix、其余按平台 path,一律 join(键已是绝对路径,无须 resolve 补 cwd;
// 真实源码树的键 'C:\…' 结果与 resolve 逐字节相同)。macOS / Linux:path.sep === '/' ⇒ 原式 path.resolve / path.join 不变。
// 同款见 helpers/importGraph.js(两份 resolveSpec 同步改)。
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

function bindingNames(node, out){
	if(!node){ return out; }
	if(node.type === 'Identifier'){ out.push(node.name); }
	else if(node.type === 'ObjectPattern'){ node.properties.forEach((p)=>bindingNames(p.type === 'RestElement' ? p.argument : p.value, out)); }
	else if(node.type === 'ArrayPattern'){ node.elements.forEach((e)=>bindingNames(e, out)); }
	else if(node.type === 'AssignmentPattern'){ bindingNames(node.left, out); }
	else if(node.type === 'RestElement'){ bindingNames(node.argument, out); }
	return out;
}

const CJS_RE = /(^|[^.\w$])module\.exports\s*=|(^|[^.\w$])exports\.[A-Za-z_$][\w$]*\s*=/m;

function missingNamedImports(files, opts = {}){
	const exists = opts.exists || ((p)=>files.has(p));
	const srcRoot = opts.srcRoot || null;
	const asts = new Map();
	const parseOf = (f)=>{
		if(!asts.has(f)){
			let ast = null;
			try { ast = parser.parse(files.get(f), PARSE_OPTS); } catch(e){ ast = null; }
			asts.set(f, ast);
		}
		return asts.get(f);
	};
	const exportCache = new Map();
	// 导出集合:{ names: Set, open: bool }(open = 无从静态确定,不判)
	const exportsOf = (f, seen = new Set())=>{
		if(exportCache.has(f)){ return exportCache.get(f); }
		if(seen.has(f)){ return { names: new Set(), open: false }; }
		seen.add(f);
		const src = files.get(f);
		const ast = src == null ? null : parseOf(f);
		const r = { names: new Set(), open: false };
		if(!ast || CJS_RE.test(src)){ r.open = true; exportCache.set(f, r); return r; }
		ast.program.body.forEach((s)=>{
			if(s.type === 'ExportNamedDeclaration'){
				const d = s.declaration;
				if(d && d.declarations){ d.declarations.forEach((v)=>bindingNames(v.id, []).forEach((n)=>r.names.add(n))); }
				else if(d && d.id){ r.names.add(d.id.name); }
				(s.specifiers || []).forEach((sp)=>r.names.add(sp.exported.name || sp.exported.value));
			} else if(s.type === 'ExportDefaultDeclaration'){
				r.names.add('default');
			} else if(s.type === 'ExportAllDeclaration'){
				if(s.exported){ r.names.add(s.exported.name || s.exported.value); return; }
				const t = resolveSpec(f, s.source.value, exists, srcRoot);
				if(!t){ r.open = true; return; }
				const sub = exportsOf(t, seen);
				if(sub.open){ r.open = true; }
				sub.names.forEach((n)=>{ if(n !== 'default'){ r.names.add(n); } });
			}
		});
		exportCache.set(f, r);
		return r;
	};
	const out = [];
	for(const f of files.keys()){
		const ast = parseOf(f);
		if(!ast){ continue; }
		const src = files.get(f);
		const mocked = new Set();
		if(/\.test\.jsx?$/.test(f)){
			const re = /jest\.(?:mock|doMock)\(\s*(['"])([^'"]+)\1\s*,/g;
			let m;
			while((m = re.exec(src))){ mocked.add(m[2]); }
		}
		ast.program.body.forEach((s)=>{
			const isImport = s.type === 'ImportDeclaration' && s.importKind !== 'type';
			const isReexport = s.type === 'ExportNamedDeclaration' && s.source;
			if(!isImport && !isReexport){ return; }
			const spec = s.source.value;
			if(mocked.has(spec)){ return; }
			const t = resolveSpec(f, spec, exists, srcRoot);
			if(!t){ return; }
			const ex = exportsOf(t);
			if(ex.open){ return; }
			(s.specifiers || []).forEach((sp)=>{
				let name = null;
				if(sp.type === 'ImportSpecifier'){ name = sp.imported.name || sp.imported.value; }
				else if(sp.type === 'ImportDefaultSpecifier'){ name = 'default'; }
				else if(sp.type === 'ExportSpecifier'){ name = sp.local.name || sp.local.value; }
				else if(sp.type === 'ExportDefaultSpecifier'){ name = 'default'; }
				if(name && !ex.names.has(name)){
					out.push({ file: f, line: (sp.loc && sp.loc.start.line) || 0, name, target: t });
				}
			});
		});
	}
	return out;
}

function scanSourceTree(srcRoot){
	const files = new Map();
	(function walk(d){
		fs.readdirSync(d, { withFileTypes: true }).forEach((e)=>{
			if(e.name === 'node_modules' || e.name.startsWith('.umi')){ return; }
			const p = path.join(d, e.name);
			if(e.isDirectory()){ walk(p); }
			else if(CODE_EXT.test(e.name)){ files.set(p, fs.readFileSync(p, 'utf8')); }
		});
	})(srcRoot);
	return { files, missing: missingNamedImports(files, { srcRoot }) };
}

module.exports = { missingNamedImports, scanSourceTree };
