// 拆成子模块的大文件(登记表 scripts/source-sets.json)合同:登记闭合 / 读法 / 门面形态 / 子模块不回引门面(样式门面 app.less:只有 @import、区段配平)。
// 登记不闭合 = 新子模块里的代码逃出全部「读源码」的检查(读不到 → 判缺席 → 假绿)。
const fs = require('fs');
const path = require('path');
const { readSource, sourceSetFiles, SOURCE_SETS, PY_SOURCE_SETS, SOURCE_SETS_MANIFEST } = require('./helpers/sourceSet');

const SRC = path.resolve(__dirname, '..', '..');
const UI = path.resolve(SRC, '..');
const REPO = path.resolve(UI, '..', '..');
const FACADES = Object.keys(SOURCE_SETS);
// horosa_ws_dirname_agnostic_v1(Windows 侧移植适配):上游按 `REPO/Horosa-Web/astropy` 定位,把工作区目录名写死成 Horosa-Web;
// Windows 侧工作区带哈希后缀(Horosa-Web-<sha>)⇒ pySets 九条全 ENOENT。改为本 UI 根的同级 astropy:macOS 上解析到同一目录(行为等价)。
const ASTROPY = path.join(UI, '..', 'astropy');
const PY_FACADES = Object.keys(PY_SOURCE_SETS);
const pyModule = (rel)=>rel.replace(/\.py$/, '').split('/').join('.');

describe('拆成子模块的大文件 · 登记表合同', ()=>{
	it('登记表读得出,且就是这八个门面', ()=>{
		expect(SOURCE_SETS_MANIFEST).toBe(path.join(UI, 'scripts', 'source-sets.json'));
		expect(FACADES.slice().sort()).toEqual([
			'components/aianalysis/AIAnalysisMain.js', 'components/astro/IndiaChartMain.js', 'components/guolao/GuoLaoChartMain.js',
			'components/lrzhan/LiuRengMain.js', 'components/planetarium/PlanetariumBabylon.js',
			'layouts/app.less', 'utils/aiAnalysisContext.js', 'utils/aiExport.js',
		]);
	});

	it.each(FACADES)('🔴 %s:门面与登记的子模块都在,子模块目录里每个与门面同扩展名的文件都登记了(闭合)', (rel)=>{
		const set = SOURCE_SETS[rel];
		const ext = path.extname(rel);
		expect(fs.existsSync(path.join(SRC, rel))).toBe(true);
		set.files.forEach((f)=>{ expect(path.extname(f)).toBe(ext); expect(fs.existsSync(path.join(SRC, set.dir, f))).toBe(true); });
		const onDisk = fs.readdirSync(path.join(SRC, set.dir)).filter((f)=>f.endsWith(ext)).sort();
		expect(onDisk).toEqual(set.files.slice().sort());
		expect(new Set(set.files).size).toBe(set.files.length);
	});

	it.each(FACADES.filter((rel)=>rel.endsWith('.js')))('%s:readSource = 子模块(登记次序)+ 门面(最后)首尾相接;未登记的文件原样读', (rel)=>{
		const set = SOURCE_SETS[rel];
		const files = sourceSetFiles(path.join(SRC, rel));
		expect(files).toEqual([...set.files.map((f)=>path.join(SRC, set.dir, f)), path.join(SRC, rel)]);
		expect(readSource(path.join(SRC, rel))).toBe(files.map((f)=>fs.readFileSync(f, 'utf8')).join(''));
		files.forEach((f)=>{ expect(fs.readFileSync(f, 'utf8').endsWith('\n')).toBe(true); });   // 首尾相接不粘行
	});

	it('未登记的文件:sourceSetFiles 只含它自己,readSource 与 fs 原样读一致', ()=>{
		const f = path.join(SRC, 'utils', 'aiAnalysisSources.js');
		expect(sourceSetFiles(f)).toEqual([f]);
		expect(readSource(f)).toBe(fs.readFileSync(f, 'utf8'));
	});

	it.each(FACADES.filter((rel)=>rel.endsWith('.js')))('🔴 %s:子模块不从门面 import(门面 ↔ 子模块不成环)', (rel)=>{
		const set = SOURCE_SETS[rel];
		const parser = require('@babel/parser');
		const facadeAbs = path.join(SRC, rel);
		let seen = 0;
		set.files.forEach((f)=>{
			const fp = path.join(SRC, set.dir, f);
			const ast = parser.parse(fs.readFileSync(fp, 'utf8'), { sourceType: 'module', plugins: ['jsx', 'classProperties', 'dynamicImport'] });
			const specs = ast.program.body.filter((s)=>s.source && /Import|Export/.test(s.type)).map((s)=>s.source.value);
			seen += specs.length;
			specs.filter((s)=>s.startsWith('.')).forEach((s)=>{ expect(`${f} → ${path.resolve(path.dirname(fp), s)}`).not.toBe(`${f} → ${facadeAbs.replace(/\.js$/, '')}`); });
		});
		expect(seen).toBeGreaterThan(set.files.length);   // 判据自证:确实抽到了导入
	});

	it.each(['utils/aiExport.js', 'utils/aiAnalysisContext.js'])('%s:门面只有导入与重导出(实现全在子模块)', (rel)=>{
		const parser = require('@babel/parser');
		const ast = parser.parse(fs.readFileSync(path.join(SRC, rel), 'utf8'), { sourceType: 'module' });
		ast.program.body.forEach((s)=>{
			const ok = s.type === 'ImportDeclaration' && s.specifiers.length === 0
				|| s.type === 'ExportNamedDeclaration' && !!s.source && !s.declaration;
			expect(`${s.type}@${s.loc.start.line}:${ok}`).toMatch(/:true$/);
		});
	});

	it('🔴 layouts/app.less:门面只有 @import 与那一对 :global { },区段按登记次序各被引一次', ()=>{
		const set = SOURCE_SETS['layouts/app.less'];
		const lines = fs.readFileSync(path.join(SRC, 'layouts', 'app.less'), 'utf8').split('\n').filter((l)=>l.trim() && !l.trim().startsWith('//'));
		lines.forEach((l)=>{ expect(`${l}:${/^@import '[^']+';$/.test(l) || l === ':global {' || l === '}'}`).toMatch(/:true$/); });
		expect(lines.filter((l)=>l === ':global {').length).toBe(1);
		expect(lines.filter((l)=>l === '}').length).toBe(1);
		const parts = lines.map((l)=>l.match(/^@import '\.\/app\/([^']+)';$/)).filter(Boolean).map((m)=>m[1]);
		expect(parts).toEqual(set.files);
	});

	it('🔴 layouts/app.less:readSource = 门面里的区段 @import 原位展开(区段全文按原位,门面其余行原样)', ()=>{
		const set = SOURCE_SETS['layouts/app.less'];
		const facade = path.join(SRC, 'layouts', 'app.less');
		const files = sourceSetFiles(facade);
		expect(files).toEqual([...set.files.map((f)=>path.join(SRC, set.dir, f)), facade]);
		const want = fs.readFileSync(facade, 'utf8').split('\n').map((l)=>{
			const m = l.match(/^@import '\.\/app\/([^']+)';$/);
			return m ? fs.readFileSync(path.join(SRC, set.dir, m[1]), 'utf8').replace(/\n$/, '') : l;
		}).join('\n');
		const got = readSource(facade);
		expect(got).toBe(want);
		// 判据自证:展开后没有剩下指向区段的 @import,且确实比门面长得多
		expect(/@import '\.\/app\//.test(got)).toBe(false);
		expect(got.length).toBeGreaterThan(fs.readFileSync(facade, 'utf8').length * 100);
		files.forEach((f)=>{ expect(fs.readFileSync(f, 'utf8').endsWith('\n')).toBe(true); });
	});

	it.each(SOURCE_SETS['layouts/app.less'].files)('🔴 layouts/app/%s:花括号配平(拆点落在规则之间,没把一条规则劈成两半)', (f)=>{
		const txt = fs.readFileSync(path.join(SRC, 'layouts', 'app', f), 'utf8')
			.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/(["'])(?:\\.|(?!\1).)*\1/g, '');
		let depth = 0; let min = 0;
		for(const c of txt){ if(c === '{'){ depth += 1; } else if(c === '}'){ depth -= 1; min = Math.min(min, depth); } }
		expect({ depth, min }).toEqual({ depth: 0, min: 0 });
	});

	// horosa_win_shell_layout_v1(Windows 侧移植适配):这一条核 macOS 发布预检(Horosa_Desktop_Installer/scripts/preflight)读同一份登记表;
	// Windows 发布自检(release_selfcheck.py)的哨兵按具体文件钉,不读登记表(上游再拆文件 = 哨兵直接红,按新落点改钉)。只在预检脚本缺席时跳过。
	(fs.existsSync(path.join(REPO, 'Horosa_Desktop_Installer', 'scripts', 'preflight', 'lib.sh')) ? it : it.skip)('🔴 发布前自检与检查器读的是同一份登记表', ()=>{
		const lib = fs.readFileSync(path.join(REPO, 'Horosa_Desktop_Installer', 'scripts', 'preflight', 'lib.sh'), 'utf8');
		expect(lib).toContain('PF_SRC_SETS_JSON="${REPO_ROOT}/Horosa-Web/astrostudyui/scripts/source-sets.json"');
		expect(lib).toContain('pf_src_set_check');
		const tool = require(path.join(REPO, 'Horosa_Desktop_Installer', 'scripts', 'source_sets.js'));
		FACADES.forEach((rel)=>{ expect(tool.sourceSetFiles(path.join(SRC, rel))).toEqual(sourceSetFiles(path.join(SRC, rel))); });
		Object.keys(PY_SOURCE_SETS).forEach((rel)=>{ const f = path.join(ASTROPY, rel); expect(tool.sourceSetFiles(f)).toEqual(sourceSetFiles(f)); });
	});
});

describe('Python 计算引擎里拆成子模块的大文件 · 登记表合同(pySets)', ()=>{
	it('pySets 就是这三个门面', ()=>{
		expect(PY_FACADES.slice().sort()).toEqual(['astrostudy/astroextra.py', 'astrostudy/india/jyotish_engine.py', 'astrostudy/perchart.py']);
	});

	it.each(PY_FACADES)('🔴 %s:门面与登记的子模块都在,子包里每个 .py(只有文档串的 __init__.py 除外)都登记了(闭合)', (rel)=>{
		const set = PY_SOURCE_SETS[rel];
		expect(fs.existsSync(path.join(ASTROPY, rel))).toBe(true);
		expect(fs.existsSync(path.join(ASTROPY, set.dir, '__init__.py'))).toBe(true);
		set.files.forEach((f)=>{ expect(path.extname(f)).toBe('.py'); expect(fs.existsSync(path.join(ASTROPY, set.dir, f))).toBe(true); });
		const onDisk = fs.readdirSync(path.join(ASTROPY, set.dir)).filter((f)=>f.endsWith('.py') && f !== '__init__.py').sort();
		expect(onDisk).toEqual(set.files.slice().sort());
		expect(new Set(set.files).size).toBe(set.files.length);
		const init = fs.readFileSync(path.join(ASTROPY, set.dir, '__init__.py'), 'utf8');
		expect(init.trim()).toMatch(/^"""[^]*"""$/);   // __init__.py 只有文档串(不登记、不放代码)
	});

	it.each(PY_FACADES)('%s:readSource = 子模块(登记次序)+ 门面(最后)首尾相接', (rel)=>{
		const set = PY_SOURCE_SETS[rel];
		const files = sourceSetFiles(path.join(ASTROPY, rel));
		expect(files).toEqual([...set.files.map((f)=>path.join(ASTROPY, set.dir, f)), path.join(ASTROPY, rel)]);
		expect(readSource(path.join(ASTROPY, rel))).toBe(files.map((f)=>fs.readFileSync(f, 'utf8')).join(''));
		files.forEach((f)=>{ expect(fs.readFileSync(f, 'utf8').endsWith('\n')).toBe(true); });
	});

	it.each(PY_FACADES)('🔴 %s:子模块不从本门面 import,子模块之间只引登记在前的(无环);门面按登记次序导入全部子模块', (rel)=>{
		const set = PY_SOURCE_SETS[rel];
		const facadeMod = pyModule(rel);
		const pkgMod = pyModule(set.dir);
		const order = set.files.map((f)=>f.replace(/\.py$/, ''));
		let seen = 0;
		set.files.forEach((f, i)=>{
			const src = fs.readFileSync(path.join(ASTROPY, set.dir, f), 'utf8');
			const mods = [...src.matchAll(/^(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm)].map((m)=>m[1] || m[2]);
			seen += mods.length;
			mods.forEach((m)=>{
				expect(`${f} → ${m}`).not.toBe(`${f} → ${facadeMod}`);
				if(m.startsWith(`${pkgMod}.`)){
					const j = order.indexOf(m.slice(pkgMod.length + 1));
					expect(`${f} → ${m}:${j >= 0 && j < i}`).toBe(`${f} → ${m}:true`);
				}
			});
		});
		expect(seen).toBeGreaterThan(set.files.length);   // 判据自证:确实抽到了导入
		const facade = fs.readFileSync(path.join(ASTROPY, rel), 'utf8');
		const imported = [...facade.matchAll(new RegExp(`^from ${pkgMod.replace(/\./g, '\\.')}\\.(\\w+) import`, 'gm'))].map((m)=>m[1]);
		expect(imported).toEqual(order);
	});
});

describe('读源码的测试 · 写法合同(全集读法不许被绕过 / 截函数体不许越界)', ()=>{
	const parser = require('@babel/parser');
	const traverse = require('@babel/traverse').default;
	const { fnBody, isSourceSetPart } = require('./helpers/sourceSet');
	const PARSE = { sourceType: 'module', plugins: ['jsx', 'classProperties', 'dynamicImport', 'optionalChaining', 'nullishCoalescingOperator', 'objectRestSpread'] };
	const FACADE_BASES = FACADES.map((f)=>path.basename(f));
	const PART_BASES = [...new Set(Object.values(SOURCE_SETS).flatMap((s)=>s.files))];
	// 「下一个函数 / 导出」式的截取终点:`\nasync function ` / `\nexport ` / `\n\tfunction ` / `\nconst ` …
	const END_MARKER = /^\n[\t ]*(?:export |async function |function |const |let |class )/;
	const listTests = (dir, out = [])=>{
		fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
			const p = path.join(dir, e.name);
			if(e.isDirectory()){ if(e.name !== 'node_modules'){ listTests(p, out); } }
			else if(/\.test\.js$/.test(e.name)){ out.push(p); }
		});
		return out;
	};
	const literalOf = (n)=>(n && n.type === 'StringLiteral' ? n.value : n && n.type === 'TemplateLiteral' && !n.expressions.length ? n.quasis[0].value.cooked : null);
	// 一个测试文件的三类违规:① 读全集的文本上拿「下一个函数」当终点;② 裸 readFileSync 读登记门面;③ 按文件名筛出门面、漏掉子模块却不按全集读
	function lintTestSource(code){
		const ast = parser.parse(code, PARSE);
		const out = [];
		const usesReadSource = /\breadSource\b/.test(code);
		const wrappers = new Set();
		traverse(ast, {
			CallExpression(p){
				const c = p.node.callee;
				const prop = c.type === 'MemberExpression' && !c.computed ? c.property.name : null;
				if(usesReadSource && ['indexOf', 'lastIndexOf', 'search', 'split'].includes(prop)){
					const v = literalOf(p.node.arguments[0]);
					if(v !== null && END_MARKER.test(v)){ out.push(`end-marker@${p.node.loc.start.line}`); }
				}
				if(prop === 'readFileSync' || (c.type === 'Identifier' && c.name === 'readFileSync')){
					const fn = p.getFunctionParent();
					const nm = fn && (fn.node.id ? fn.node.id.name : fn.parentPath.isVariableDeclarator() ? fn.parentPath.node.id.name : null);
					if(nm){ wrappers.add(nm); }
					const lits = [];
					const viaBinding = (q)=>{
						const b = q.scope.getBinding(q.node.name);
						if(b && b.path.isVariableDeclarator() && b.path.node.init){ JSON.stringify(b.path.node.init).replace(/"value":"([^"]*)"/g, (m, v)=>{ lits.push(v); return m; }); }
					};
					p.get('arguments').forEach((a)=>{
						if(a.isIdentifier()){ viaBinding(a); }
						a.traverse({ StringLiteral(q){ lits.push(q.node.value); }, Identifier: viaBinding });
						const own = literalOf(a.node);
						if(own !== null){ lits.push(own); }
					});
					if(lits.some((v)=>FACADE_BASES.some((b)=>v.endsWith(b)))){ out.push(`raw-facade@${p.node.loc.start.line}`); }
				}
			},
			RegExpLiteral(p){
				if(!/\\\.(?:jsx?|less)|\(js\|jsx\)|\.js/.test(p.node.pattern)){ return; }
				let re;
				try{ re = new RegExp(p.node.pattern, p.node.flags.replace(/[gy]/g, '')); }catch(e){ return; }
				if(FACADE_BASES.some((b)=>re.test(b)) && !PART_BASES.some((b)=>re.test(b)) && !(/\bisSourceSetPart\b/.test(code) && usesReadSource)){
					out.push(`name-filter@${p.node.loc.start.line}`);
				}
			},
		});
		// 包一层的读文件函数:读的是门面也算裸读
		traverse(ast, {
			CallExpression(p){
				const c = p.node.callee;
				if(c.type !== 'Identifier' || !wrappers.has(c.name)){ return; }
				const lits = [];
				JSON.stringify(p.node.arguments).replace(/"value":"([^"]*)"/g, (m, v)=>{ lits.push(v); return m; });
				if(lits.some((v)=>FACADE_BASES.some((b)=>v.endsWith(b)))){ out.push(`raw-facade@${p.node.loc.start.line}`); }
			},
		});
		return out;
	}

	it('🔴 判别向量:三类违规各自必被抓到;按全集读的正确写法不报', ()=>{
		expect(lintTestSource("const { readSource } = require('./helpers/sourceSet');\nconst s = readSource(f);\nconst e = s.indexOf('\\nasync function ', 3);\n")).toEqual(['end-marker@3']);
		expect(lintTestSource("const { readSource } = require('./helpers/sourceSet');\nconst s = readSource(f);\nconst e = s.indexOf('\\n\\tfunction ');\n")).toEqual(['end-marker@3']);
		expect(lintTestSource("const s = fs.readFileSync(path.join(SRC, 'components', 'astro', 'IndiaChartMain.js'), 'utf8');\n")).toEqual(['raw-facade@1']);
		expect(lintTestSource("const F = path.join(SRC, 'utils/aiExport.js');\nconst s = fs.readFileSync(F, 'utf8');\n")).toEqual(['raw-facade@2']);
		expect(lintTestSource("const read = (r)=>fs.readFileSync(path.join(SRC, r), 'utf8');\nconst s = read('layouts/app.less');\n")).toEqual(['raw-facade@2']);
		expect(lintTestSource("const mains = ALL.filter((f)=>/Main\\.js$/.test(f));\nmains.forEach((f)=>fs.readFileSync(f, 'utf8'));\n")).toEqual(['name-filter@1']);
		// 正确写法:按全集读、走查跳过子模块、按全文件后缀筛(子模块也选中)
		expect(lintTestSource("const { readSource, isSourceSetPart } = require('./helpers/sourceSet');\nconst mains = ALL.filter((f)=>/Main\\.js$/.test(f) && !isSourceSetPart(f));\nconst s = readSource(path.join(SRC, 'utils/aiExport.js'));\nconst b = fnBody(s, 'function x(');\n")).toEqual([]);
		expect(lintTestSource("const all = walk(dir).filter((f)=>/\\.js$/.test(f)).map((f)=>fs.readFileSync(f, 'utf8'));\n")).toEqual([]);
	});

	it('🔴 全仓 __tests__:没有越界截取、没有裸读门面、没有按名筛门面却不按全集读(本文件核门面原文形态,除外)', ()=>{
		const SELF = path.join(__dirname, 'sourceSetManifest.test.js');
		const files = listTests(SRC).filter((f)=>f !== SELF);
		expect(files.length).toBeGreaterThan(500);   // 判据自证:扫到了整棵树
		const bad = [];
		files.forEach((f)=>{ lintTestSource(fs.readFileSync(f, 'utf8')).forEach((v)=>bad.push(`${path.relative(SRC, f)}:${v}`)); });
		expect(bad).toEqual([]);
	});

	it('🔴 fnBody:登记的每个 .js 全集里每个顶层函数声明,截出来的恰好是它自己(babel 解析路径与字符配平退路两条都核)', ()=>{
		let n = 0;
		FACADES.filter((rel)=>rel.endsWith('.js')).forEach((rel)=>{
			const all = readSource(path.join(SRC, rel));
			const unparsable = `(((((\n${all}`;   // 解析不了 → 走字符配平退路
			sourceSetFiles(path.join(SRC, rel)).forEach((f)=>{
				const code = fs.readFileSync(f, 'utf8');
				parser.parse(code, PARSE).program.body.forEach((st)=>{
					const d = /^Export/.test(st.type) && st.declaration ? st.declaration : st;
					if(d.type !== 'FunctionDeclaration' || !d.id){ return; }
					const sig = `${d.async ? 'async ' : ''}function ${d.id.name}(`;
					const want = code.slice(d.start, d.end);
					n += 1;
					expect(`${rel}:${d.id.name}:${fnBody(all, sig) === want}`).toBe(`${rel}:${d.id.name}:true`);
					expect(`${rel}:${d.id.name}:scan:${fnBody(unparsable, sig) === want}`).toBe(`${rel}:${d.id.name}:scan:true`);
				});
			});
		});
		expect(n).toBeGreaterThan(500);
		// 方法签名(从方法名起)、注释里提到的签名不算、找不到回 null、表达式体箭头函数回 null
		const t = "// function foo( 在注释里\nclass A {\n\tasync foo(a = { x: '}' }){ return `${a}}`; }\n}\nconst g = (x)=>x + 1;\n";
		expect(fnBody(t, 'foo(')).toBe("foo(a = { x: '}' }){ return `${a}}`; }");
		expect(fnBody(t, 'function foo(')).toBe(null);
		expect(fnBody(t, 'function nope(')).toBe(null);
		expect(fnBody(t, 'const g = (')).toBe(null);
		expect(fnBody(`(((\n${t}`, 'foo(')).toBe("foo(a = { x: '}' }){ return `${a}}`; }");
		expect(typeof isSourceSetPart).toBe('function');
	});
});
