// [Z8·印度择日] 前端注册表金标(远端判定形——判定逻辑在 astropy india_election_scan,
// pytest 金标 9 例看守;此处守前后端契约面):
// ①类型键集与后端 CONDITION_TYPES 逐键成对(直读 py 文件正则抽——后端加叶前端未接=红)
// ②判定表 py↔js 逐值 diff(guolao_const↔guolaoData 关键四表——[184] 升级形,两侧任一改=红)
// ③spec 契约+树编译(产物直发后端 conditions,形状=kernel 树契约)。
import fs from 'fs';
import path from 'path';
import { INDIA_CONDITION_TYPES, newIndiaLeaf, newIndiaGroup, indiaLeafSummary, compileIndiaTree, IN_NAK27 } from '../indiaZeriConditionTypes';

const PY_ROOT = path.join(__dirname, '..', '..', '..', '..', '..', 'astropy', 'astrostudy');
const readPy = (f)=>fs.readFileSync(path.join(PY_ROOT, f), 'utf8');

describe('[Z8] 🔴 前后端契约对拍', ()=>{
	it('🔴 类型键集 ≡ 后端 CONDITION_TYPES(py 文件直读;后端加叶前端未接=红)', ()=>{
		const py = readPy('india_election_scan.py');
		const m = py.match(/CONDITION_TYPES = \{([\s\S]*?)\n\}/);
		expect(m ? 'ok' : 'py CONDITION_TYPES 未定位').toBe('ok');
		const pyKeys = [...m[1].matchAll(/'([a-z_]+)':\s*\{/g)].map((x)=>x[1]).sort();
		expect(Object.keys(INDIA_CONDITION_TYPES).sort()).toEqual(pyKeys);
	});

	it('🔴 27 宿名表与 IndiaChartMain.NAKSHATRAS 同序同名(值域同源)', ()=>{
		const main = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'components', 'astro', 'IndiaChartMain.js'), 'utf8');
		IN_NAK27.forEach((n)=>{
			expect(main).toContain(`['${n}',`);
		});
		expect(IN_NAK27.length).toBe(27);
	});

	it('🔴 端点薄壳与挂载在位(webchartsrv route+srv 文件;拆=择日断链)', ()=>{
		const mount = fs.readFileSync(path.join(PY_ROOT, '..', 'websrv', 'webchartsrv.py'), 'utf8');
		expect(mount).toContain('"mount": "/indiaelectionscan"');
		const srv = fs.readFileSync(path.join(PY_ROOT, '..', 'websrv', 'webindiaelectionscansrv.py'), 'utf8');
		expect(srv).toContain('india_election_scan.scan(');
		expect(srv).toContain('india_election_scan.explain_at(');
	});
});

describe('[Z8] 注册表契约+编译', ()=>{
	it('每类 spec 契约齐(≥10 类;远端形 evaluate 缺省合法)', ()=>{
		const keys = Object.keys(INDIA_CONDITION_TYPES);
		expect(keys.length).toBeGreaterThanOrEqual(11);
		keys.forEach((k)=>{
			const s = INDIA_CONDITION_TYPES[k];
			expect(typeof s.summary(s.defaults)).toBe('string');
			expect(typeof s.category).toBe('string');
			expect(Array.isArray(s.fields)).toBe(true);
		});
		
	});

	it('树编译:产物=kernel 树契约+validate 抓空', ()=>{
		const tree = compileIndiaTree({ ...newIndiaGroup('all'), children: [newIndiaLeaf('tithi'), { ...newIndiaLeaf('vara'), joiner: 'all' }] });
		expect(tree.type).toBe('all');
		expect(tree.conditions[0].type).toBe('tithi');
		expect(()=>compileIndiaTree({ kind: 'group', joiner: 'all', children: [{ kind: 'leaf', type: 'tithi', joiner: 'all', params: { values: [] } }] })).toThrow();
		expect(indiaLeafSummary(newIndiaLeaf('day_kalam'))).toContain('Rahu');
	});
});
