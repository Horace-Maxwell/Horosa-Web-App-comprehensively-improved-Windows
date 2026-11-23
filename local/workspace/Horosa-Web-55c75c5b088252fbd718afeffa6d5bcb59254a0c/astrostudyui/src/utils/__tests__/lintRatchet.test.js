/**
 * @jest-environment node
 */
// 静态检查棘轮(判据单源 scripts/lint-ratchet.js;规则 .eslintrc.js;只许减少的语义在 scripts/ratchet-core.js,与 ui-ratchet 共用)。
// ① 每一项都真能抓到它该抓的写法(规则被关掉 / 解析器配错 = 整项恒 0 的假绿);② 全仓逐文件计数不超基线(只拦上升;收紧由发布前自检的 --check-tight 查)。
// ESLint 8 内部按包的子路径导出取模块,umi-test 捆绑的旧 jest 解析器不认 —— 一律起独立 node 子进程跑同一个 ESLint 单源实例(makeEslint)。
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFileSync, spawnSync } = require('child_process');

const UI_ROOT = path.resolve(__dirname, '..', '..', '..');
const core = require(path.join(UI_ROOT, 'scripts', 'ratchet-core.js'));

jest.setTimeout(180000);

// 一次子进程查完全部探针代码段:回 [{ 计数项: 次数 }](与棘轮同一个 ESLint 实例、同一张规则 → 计数项映射)
const PROBES = {};
function probe(name, code){ PROBES[name] = code; }
let RESULTS = null;
function runProbes(){
	const driver = path.join(os.tmpdir(), `lint-ratchet-probe-${process.pid}.js`);
	fs.writeFileSync(driver, `
const path = require('path');
const L = require(${JSON.stringify(path.join(UI_ROOT, 'scripts', 'lint-ratchet.js'))});
const probes = ${JSON.stringify(PROBES)};
(async ()=>{
	const eslint = L.makeEslint({ cache: false });
	const out = {};
	for(const [name, code] of Object.entries(probes)){
		const [r] = await eslint.lintText(code, { filePath: path.join(L.SRC, 'components', '__lintProbe__', 'Probe.js') });
		const c = {};
		r.messages.forEach((m)=>{ if(m.fatal){ c.parse = (c.parse || 0) + 1; return; } const k = L.RULE_METRIC[m.ruleId]; if(k){ c[k] = (c[k] || 0) + 1; } });
		out[name] = c;
	}
	process.stdout.write(JSON.stringify(out));
})().catch((e)=>{ console.error(e); process.exit(3); });
`);
	try{ return JSON.parse(execFileSync(process.execPath, [driver], { cwd: UI_ROOT, encoding: 'utf8' })); }
	finally{ fs.unlinkSync(driver); }
}

probe('undefFn', "export function f(){ return helperNotImported(1); }\n");
probe('undefJsx', "export const A = ()=>(<XQInputNumber />);\n");
probe('autoJsx', "export const A = ()=>(<div>x</div>);\n");
probe('unusedSpec', "import { a, b } from './x';\nexport const y = a;\n");
probe('jsxUsed', "import Comp from './Comp';\nexport const y = ()=>(<Comp />);\n");
probe('hookInIf', "import React from 'react';\nexport function C({ on }){ if(on){ React.useState(0); } return null; }\n");
probe('hookDeps', "import React from 'react';\nexport function C({ v }){ React.useEffect(()=>{ console.log(v); }, []); return null; }\n");
probe('imgAlt', "export const A = ()=>(<img src=\"x.png\" />);\n");
probe('ariaTypo', "export const A = ()=>(<div aria-lable=\"x\" />);\n");
probe('lateImport', "import a from './a';\nconst k = 1;\nimport b from './b';\nexport default [a, b, k];\n");
probe('topImports', "import a from './a';\nimport b from './b';\nexport default [a, b];\n");
probe('syntax', "export class A { static x = 1; y = ()=>this?.z ?? 0; load(){ return import('./b'); } }\n");

beforeAll(()=>{ RESULTS = runProbes(); });
const at = (name)=>RESULTS[name] || {};

describe('每一项都真能抓到(判别力)', ()=>{
	it('🔴 undef:用了没 import 的函数 / 组件;自动 JSX 运行时下不显式引 React 的 JSX 不算', ()=>{
		expect(at('undefFn').undef).toBe(1);
		expect(at('undefJsx').undef).toBe(1);
		expect(at('autoJsx').undef).toBeUndefined();
	});
	it('🔴 unused:没用的 import 说明符;JSX 里用到的算用到', ()=>{
		expect(at('unusedSpec').unused).toBe(1);
		expect(at('jsxUsed').unused).toBeUndefined();
	});
	it('🔴 hooksRules / hooksDeps', ()=>{
		expect(at('hookInIf').hooksRules).toBe(1);
		expect(at('hookDeps').hooksDeps).toBe(1);
	});
	it('🔴 a11y:图片缺替代文字 / 写错的 aria 属性', ()=>{
		expect(at('imgAlt').a11y).toBe(1);
		expect(at('ariaTypo').a11y).toBe(1);
	});
	it('🔴 lateImport:import 写在代码之后', ()=>{
		expect(at('lateImport').lateImport).toBe(1);
		expect(at('topImports').lateImport).toBeUndefined();
	});
	it('本仓用到的语法(类属性 / 可选链 / 空值合并 / 动态 import)都能解析', ()=>{
		expect(at('syntax').parse).toBeUndefined();
	});
});

describe('公共核语义(ui-ratchet 与本棘轮共用)', ()=>{
	it('只许减少:新增 / 上升报 increases,下降报 loose', ()=>{
		const base = { metrics: { unused: { 'a.js': 2, 'b.js': 1 } } };
		const cur = { metrics: { unused: { 'a.js': 3, 'c.js': 1 } } };
		const { increases, loose } = core.compareMetrics(cur, base, ['unused']);
		expect(increases.map((x)=>x.file).sort()).toEqual(['a.js', 'c.js']);
		expect(loose.map((x)=>x.file)).toEqual(['b.js']);
	});
});

