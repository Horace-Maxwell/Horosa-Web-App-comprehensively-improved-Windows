// [Z7·七政择日] 前端注册表金标(远端判定形——判定逻辑在 astropy qizheng_election_scan,
// pytest 金标 8 例看守;此处守前后端契约面):
// ①类型键集与后端 CONDITION_TYPES 逐键成对(直读 py 文件正则抽——后端加叶前端未接=红)
// ②判定表 py↔js 逐值 diff(guolao_const↔guolaoData 关键四表——[184] 升级形,两侧任一改=红)
// ③spec 契约+树编译(产物直发后端 conditions,形状=kernel 树契约)。
import fs from 'fs';
import path from 'path';
import { QIZHENG_CONDITION_TYPES, newQizhengLeaf, newQizhengGroup, qizhengLeafSummary, compileQizhengTree, QZ_BODIES } from '../qizhengZeriConditionTypes';
import { SU28, SU28_DISTANCE, SU28_JIAO_START_MODERN, SU28_JIAO_START_ANCIENT, DIGNITY_TABLE, HUAYAO_A, SIYU_DAILY_RATE, SU28_DEGREE_LORD } from '../../../components/guolao/guolaoData';

const PY_ROOT = path.join(__dirname, '..', '..', '..', '..', '..', 'astropy', 'astrostudy');
const readPy = (f)=>fs.readFileSync(path.join(PY_ROOT, f), 'utf8');

describe('[Z7] 🔴 前后端契约对拍', ()=>{
	it('🔴 类型键集 ≡ 后端 CONDITION_TYPES(py 文件直读;后端加叶前端未接=红)', ()=>{
		const py = readPy('qizheng_election_scan.py');
		const m = py.match(/CONDITION_TYPES = \{([\s\S]*?)\n\}/);
		expect(m ? 'ok' : 'py CONDITION_TYPES 未定位').toBe('ok');
		const pyKeys = [...m[1].matchAll(/'([a-z_]+)':\s*\{/g)].map((x)=>x[1]).sort();
		expect(Object.keys(QIZHENG_CONDITION_TYPES).sort()).toEqual(pyKeys);
	});

	it('🔴 判定表 py↔js 逐值 diff(guolao_const↔guolaoData 四关键表)', ()=>{
		const py = readPy('guolao_const.py');
		// SU28_DISTANCE
		const md = py.match(/SU28_DISTANCE = \[([^\]]+)\]/);
		expect(md[1].split(',').map((x)=>Number(x.trim())).filter((x)=>!Number.isNaN(x))).toEqual(SU28_DISTANCE);
		// 起点两常量
		expect(py).toContain(`SU28_JIAO_START_MODERN = ${SU28_JIAO_START_MODERN}`);
		expect(py).toContain(`SU28_JIAO_START_ANCIENT = ${SU28_JIAO_START_ANCIENT}`);
		// DIGNITY_TABLE 逐曜逐宫
		Object.keys(DIGNITY_TABLE).forEach((body)=>{
			const row = py.match(new RegExp(`"${body}":\\s*\\[([^\\]]+)\\]`));
			expect(row ? 'ok' : `py DIGNITY 缺 ${body}`).toBe('ok');
			const pyRow = [...row[1].matchAll(/"([^"]+)"/g)].map((x)=>x[1]);
			expect(pyRow).toEqual(DIGNITY_TABLE[body]);
		});
		// HUAYAO_A 十干
		Object.keys(HUAYAO_A).forEach((gan)=>{
			expect(py).toContain(`"${gan}": "${HUAYAO_A[gan]}"`);
		});
		// 四余行度率
		Object.keys(SIYU_DAILY_RATE).forEach((k)=>{
			expect(py).toContain(`"${k}": ${SIYU_DAILY_RATE[k]}`);
		});
		// 度主循环(js 派生表首七项=木金土日月火水)
		expect(SU28_DEGREE_LORD.slice(0, 7)).toEqual(['木', '金', '土', '日', '月', '火', '水']);
	});

	it('🔴 端点薄壳与挂载在位(webchartsrv route+srv 文件;拆=择日断链)', ()=>{
		const mount = fs.readFileSync(path.join(PY_ROOT, '..', 'websrv', 'webchartsrv.py'), 'utf8');
		expect(mount).toContain('"mount": "/qizhengelectionscan"');
		const srv = fs.readFileSync(path.join(PY_ROOT, '..', 'websrv', 'webqizhengelectionscansrv.py'), 'utf8');
		expect(srv).toContain('qizheng_election_scan.scan(');
		expect(srv).toContain('qizheng_election_scan.explain_at(');
	});
});

describe('[Z7] 注册表契约+编译', ()=>{
	it('每类 spec 契约齐(≥10 类;远端形 evaluate 缺省合法)', ()=>{
		const keys = Object.keys(QIZHENG_CONDITION_TYPES);
		expect(keys.length).toBeGreaterThanOrEqual(10);
		keys.forEach((k)=>{
			const s = QIZHENG_CONDITION_TYPES[k];
			expect(typeof s.summary(s.defaults)).toBe('string');
			expect(typeof s.category).toBe('string');
			expect(Array.isArray(s.fields)).toBe(true);
		});
		expect(QZ_BODIES.length).toBe(11);
	});

	it('树编译:产物=kernel 树契约(组 type/conditions;叶 type/params)+validate 抓空', ()=>{
		const tree = compileQizhengTree({ ...newQizhengGroup('all'), children: [newQizhengLeaf('dignity'), { ...newQizhengLeaf('day_night'), joiner: 'any' }] });
		expect(tree.type).toBe('any');
		expect(Array.isArray(tree.conditions)).toBe(true);
		expect(tree.conditions[0].type).toBe('dignity');
		expect(tree.conditions[0].params.body).toBe('木');
		expect(()=>compileQizhengTree({ kind: 'group', joiner: 'all', children: [{ kind: 'leaf', type: 'body_in_gong', joiner: 'all', params: { body: '月', values: [] } }] })).toThrow();
		expect(qizhengLeafSummary(newQizhengLeaf('combust'))).toContain('伏焦');
	});
	it('🔴 [W7] 七态表 py↔js 逐曜恰等 + 迟速谱五星恰等(镜像表 diff 锚——单边改必红)', ()=>{
		const fs2 = require('fs');
		const path2 = require('path');
		const py = fs2.readFileSync(path2.join(__dirname, '../../../../../astropy/astrostudy/guolao_const.py'), 'utf8');
		// SIGN_STATUS_RAW:js 源 vs py 镜像逐曜串恰等
		const jsSrc = fs2.readFileSync(path2.join(__dirname, '../../../components/guolao/guolaoData.js'), 'utf8');
		const grab = (src, head)=>{
			const i = src.indexOf(head);
			const seg = src.slice(i, src.indexOf('}', i));
			const out = {};
			seg.replace(/["']?([日月金木水火土计罗炁孛])["']?\s*:\s*["']([^"']+)["']/g, (mm, k, v)=>{ out[k] = v; return mm; });
			return out;
		};
		const jsTab = grab(jsSrc, 'SIGN_STATUS_RAW');
		const pyTab = grab(py, 'QIZHENG_SIGN_STATUS_RAW');
		expect(Object.keys(jsTab).sort()).toEqual(Object.keys(pyTab).sort());
		Object.keys(jsTab).forEach((k)=>{ expect({ k, v: pyTab[k] }).toEqual({ k, v: jsTab[k] }); });
		// SPEED_SPEC 五星 stat/slow/fast 恰等
		const grabSpec = (src, head)=>{
			const i = src.indexOf(head);
			const seg = src.slice(i, src.indexOf('};', i) >= 0 ? src.indexOf('};', i) : src.indexOf('}\n', i));
			const out = {};
			seg.replace(/([金木水火土])["']?\s*:\s*\{[^}]*?stat["']?\s*:\s*([\d.]+)[^}]*?slow["']?\s*:\s*([\d.]+)[^}]*?fast["']?\s*:\s*([\d.]+)/g, (mm, k, a, b, c)=>{ out[k] = [Number(a), Number(b), Number(c)]; return mm; });
			return out;
		};
		const jsSpec = grabSpec(jsSrc, 'STAR_SPEED_SPEC');
		const pySpec = grabSpec(py, 'QIZHENG_SPEED_SPEC');
		['金', '木', '水', '火', '土'].forEach((k)=>{ expect({ k, v: pySpec[k] }).toEqual({ k, v: jsSpec[k] }); });
	});

});
