// 前端模块导入环合同:
//   ① 同一强连通分量(互相 import 成环的一组模块)里,凡在模块求值期读到的跨模块绑定,必须是函数声明、且只取值不调用 ——
//      原生 ESM / webpack 下,环里先求值的模块在顶层读另一个还没求值的模块的 const / let / class(或调用它的函数)
//      = 暂时性死区 ReferenceError,整个分包加载失败;jest 走 babel 转 CJS 只读到 undefined,不报错(jest 绿、真机坏)。
//   ② 全前端 src 的环清单锁成基线:出现新环、或已有的环吞进新模块,即红(拆掉了环就把基线里那一条删掉 / 缩小)。
//   ③ 拆成子模块的大文件:门面不进环;AI 导出测试缝是叶子(只 import、不被子模块 import)。
// 判据见 helpers/importGraph.js;下面的判别向量必须判红,证明判据没有塌成「永远绿」。
const fs = require('fs');
const path = require('path');
const { analyzeModules, scanSourceTree } = require('./helpers/importGraph');
const { SOURCE_SETS } = require('./helpers/sourceSet');

const SRC = path.resolve(__dirname, '..', '..');
const rel = (f)=>path.relative(SRC, f).split(path.sep).join('/');

// 基线:现存的环(路径相对 src,分量内按字母序)。只许删、缩小,不许增;每条写明为什么暂留。
const CYCLE_BASELINE = [
	// 三式合一页面渲染盘面组件,盘面组件从页面取排盘助手与盘面布局常量(都只在渲染时读)
	['components/sanshi/SanShiUnitedMain.js', 'components/sanshi/SanshiUnitedBoard.js'],
	// AI 导出设置模型 ↔ 段过滤 ↔ 设置分组 ↔ 上下文识别 ↔ 快照查找:设置读写与段过滤函数级互相递归(读设置要规范化、规范化要查段表)
	['utils/aiExport/contextResolve.js', 'utils/aiExport/sectionFilter.js', 'utils/aiExport/settingsGroups.js', 'utils/aiExport/settingsModel.js', 'utils/aiExport/snapshotLookup.js'],
	// 请求层用通用助手的 isObject,通用助手用请求层的 innerHandleError(都只在函数体里用)
	['utils/helper.js', 'utils/request.js'],
];

const mem = (obj)=>new Map(Object.entries(obj).map(([k, v])=>[path.join('/virt', k), v]));
const vio = (files)=>analyzeModules(mem(files)).violations.map((v)=>`${path.basename(v.file)}:${v.name}`);

describe('前端模块导入环 · 判据自证(内存模块图)', ()=>{
	it('🔴 环内顶层读对方的 export const → 红;只读函数声明(取值)→ 绿;无环时读 const → 绿', ()=>{
		expect(vio({
			'a.js': "import { B } from './b';\nexport const A = B + 1;\n",
			'b.js': "import { A } from './a';\nexport const B = 2;\nexport function useA(){ return A; }\n",
		})).toEqual(['a.js:B']);
		expect(vio({
			'a.js': "import { fb } from './b';\nexport const T = { fb };\n",
			'b.js': "import { T } from './a';\nexport function fb(){ return T; }\n",
		})).toEqual([]);
		expect(vio({
			'a.js': "import { B } from './b';\nexport const A = B + 1;\n",
			'b.js': 'export const B = 2;\n',
		})).toEqual([]);
	});

	it('🔴 求值期调用环内函数 → 红(顶层调用 / 回调里调用 / 被顶层调用的本模块函数里调用 / 作实参交出去)', ()=>{
		const b = "import { X } from './a';\nexport function fb(){ return 1; }\nexport function useX(){ return X; }\n";
		expect(vio({ 'a.js': "import { fb } from './b';\nexport const X = fb();\n", 'b.js': b })).toEqual(['a.js:fb']);
		expect(vio({ 'a.js': "import { fb } from './b';\nexport const X = 1;\n[1, 2].forEach(()=>{ fb(); });\n", 'b.js': b })).toEqual(['a.js:fb']);
		expect(vio({ 'a.js': "import { fb } from './b';\nfunction build(){ return fb(); }\nexport const X = build();\n", 'b.js': b })).toEqual(['a.js:fb']);
		expect(vio({ 'a.js': "import { fb } from './b';\nexport const X = [3, 1].map(fb);\n", 'b.js': b })).toEqual(['a.js:fb']);
		// 只定义、没被求值期调用的函数里调用 = 延后,绿
		expect(vio({ 'a.js': "import { fb } from './b';\nexport const X = 1;\nexport function later(){ return fb(); }\nexport const lazy = ()=>fb();\n", 'b.js': b })).toEqual([]);
	});

	it('🔴 命名空间成员 / 转手重导出 / 默认导出 / class extends 与 static 字段都按落点判', ()=>{
		const back = "import { X } from './a';\nexport function useX(){ return X; }\n";
		// import * as NS:读 const 成员红、取函数成员绿
		expect(vio({ 'a.js': "import * as NS from './b';\nexport const X = NS.C;\n", 'b.js': `${back}export const C = 1;\n` })).toEqual(['a.js:C']);
		expect(vio({ 'a.js': "import * as NS from './b';\nexport const X = { f: NS.useX };\n", 'b.js': back })).toEqual([]);
		// export { C as D } from './c':落到环内 const 红;落到环外模块绿(环外依赖先求值完)
		expect(vio({
			'a.js': "import { D } from './b';\nexport const X = D;\n",
			'b.js': `${back}export { C as D } from './c';\n`,
			'c.js': "import { X } from './a';\nexport const C = 1;\nexport function useX(){ return X; }\n",
		})).toEqual(['a.js:D']);
		expect(vio({
			'a.js': "import { D } from './b';\nexport const X = D;\n",
			'b.js': `${back}export { C as D } from './c';\n`,
			'c.js': 'export const C = 1;\n',
		})).toEqual([]);
		// 默认导出:函数声明取值绿,对象字面量红
		expect(vio({ 'a.js': "import d from './b';\nexport const X = { d };\n", 'b.js': `${back}export default function dd(){ return 1; }\n` })).toEqual([]);
		expect(vio({ 'a.js': "import d from './b';\nexport const X = { d };\n", 'b.js': `${back}export default { k: 1 };\n` })).toEqual(['a.js:default']);
		// class:extends 环内 class 红;static 字段读 const 红;实例字段延后绿
		expect(vio({ 'a.js': "import { Base } from './b';\nexport class X extends Base {}\n", 'b.js': "import { X } from './a';\nexport class Base { m(){ return X; } }\n" })).toEqual(['a.js:Base']);
		expect(vio({ 'a.js': "import { C } from './b';\nexport class X { static s = C; }\n", 'b.js': `${back}export const C = 1;\n` })).toEqual(['a.js:C']);
		expect(vio({ 'a.js': "import { C } from './b';\nexport class X { s = C; }\n", 'b.js': `${back}export const C = 1;\n` })).toEqual([]);
	});

	it('🔴 边:静态 import / export … from / export * / 裸导入 / 顶层 require 都算;动态 import() 与函数体里的 require 不算', ()=>{
		const g = (files)=>analyzeModules(mem(files)).sccs.length;
		const b = "import './a';\n";
		expect(g({ 'a.js': "export * from './b';\n", 'b.js': b })).toBe(1);
		expect(g({ 'a.js': "export { x } from './b';\n", 'b.js': `${b}export const x = 1;\n` })).toBe(1);
		expect(g({ 'a.js': "import './b';\n", 'b.js': b })).toBe(1);
		expect(g({ 'a.js': "const m = require('./b');\nexport default m;\n", 'b.js': b })).toBe(1);
		expect(vio({ 'a.js': "const m = require('./b');\nexport default m;\n", 'b.js': b })).toEqual(['a.js:require']);
		expect(g({ 'a.js': "export function f(){ return import('./b'); }\n", 'b.js': b })).toBe(0);
		expect(g({ 'a.js': "export function f(){ return require('./b'); }\n", 'b.js': b })).toBe(0);
	});
});

describe('前端模块导入环 · 全前端 src', ()=>{
	let scan;
	beforeAll(()=>{ scan = scanSourceTree(SRC); });

	it('全部源码都解析得了(解析失败的文件逃出判据)', ()=>{
		expect(scan.parseErrors).toEqual([]);
		expect(scan.graph.size).toBeGreaterThan(1000);   // 判据自证:确实扫到了整棵树
	});

	it('🔴 环内求值期跨模块读取全部安全(只取函数声明的值、不调用)', ()=>{
		expect(scan.violations.map((v)=>`${rel(v.file)}:${v.line} ${v.name} ← ${rel(v.target)}:${v.reason}`)).toEqual([]);
	});

	it('🔴 环清单不超出基线(新环 / 已有环吞进新模块即红);基线里已经拆掉的环要删', ()=>{
		const current = scan.sccs.map((c)=>c.map(rel));
		const grown = current.filter((c)=>!CYCLE_BASELINE.some((b)=>c.every((f)=>b.includes(f))));
		expect(grown).toEqual([]);
		const stale = CYCLE_BASELINE.filter((b)=>!current.some((c)=>c.filter((f)=>b.includes(f)).length >= 2));
		expect(stale).toEqual([]);
	});

	it('🔴 拆成子模块的门面都不在环里;AI 导出测试缝是叶子(不被任何模块 import、不在环里)', ()=>{
		const inCycle = new Set(scan.sccs.flat().map(rel));
		Object.keys(SOURCE_SETS).filter((f)=>f.endsWith('.js')).forEach((f)=>{ expect(`${f}:${inCycle.has(f)}`).toBe(`${f}:false`); });
		const seam = path.join(SRC, 'utils', 'aiExport', 'testingSeam.js');
		const importers = [...scan.graph].filter(([, deps])=>deps.has(seam)).map(([f])=>rel(f));
		expect(importers).toEqual(['utils/aiExport.js']);
		expect(inCycle.has('utils/aiExport/testingSeam.js')).toBe(false);
	});

	it('🔴 判别向量(真实源码改一处):环内加 const 并在另一子模块顶层读它 → 红;把 meaning 拉回环里 → 它顶层建别名表时调用 uniqueArray 被抓到', ()=>{
		const dir = path.join(SRC, 'utils', 'aiExport');
		const base = new Map(fs.readdirSync(dir).filter((f)=>f.endsWith('.js')).map((f)=>[path.join(dir, f), fs.readFileSync(path.join(dir, f), 'utf8')]));
		expect(analyzeModules(base).violations).toEqual([]);
		const m1 = new Map(base);
		const sm = path.join(dir, 'settingsModel.js');
		const cr = path.join(dir, 'contextResolve.js');
		m1.set(sm, `${m1.get(sm)}\nexport const PROBE_CONST = 1;\n`);
		m1.set(cr, `import { PROBE_CONST } from './settingsModel';\n${m1.get(cr)}\nexport const PROBE_READ = { PROBE_CONST };\n`);
		expect(analyzeModules(m1).violations.map((v)=>`${path.basename(v.file)}:${v.name}`)).toEqual(['contextResolve.js:PROBE_CONST']);
		const m2 = new Map(base);
		const sg = path.join(dir, 'settingsGroups.js');
		m2.set(sg, `import { normalizeText as PROBE_BACK_EDGE } from './meaning';\n${m2.get(sg)}\nexport function probeUse(){ return PROBE_BACK_EDGE; }\n`);
		const got = analyzeModules(m2).violations.map((v)=>`${path.basename(v.file)}:${v.name}`);
		expect(got.length).toBeGreaterThan(0);
		expect(got.every((v)=>v === 'meaning.js:uniqueArray')).toBe(true);
	});
});
