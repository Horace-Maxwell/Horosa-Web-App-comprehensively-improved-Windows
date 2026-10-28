// 进程内结果缓存(经 registerProcessCache 登记的模块级 Map / Set)写入前必须判「业务错误不进缓存」:
// 后端算不出时 HTTP 200、ResultCode 0,却在信封或 Result 里带 err;只判「结果为真」就把错误包存下,
// 之后同参一直命中这份错误,直到重启。判据单一出处 resultEnvelope(responseCacheable / responseHasBusinessError)。
// 合同:登记过的缓存的每个写点,外层 if 条件或同一块里前面的 if 用到了判据;不是网络结果的写点(本地算出的 / 兜底 /
// 登记处本身)登记在下表,写明理由。新写点不表态即红。
import fs from 'fs';
import path from 'path';

const { parseModule } = require('./helpers/importSpecs');
const traverse = require('@babel/traverse').default;
const SRC = path.resolve(__dirname, '../..');
const JUDGE = /^(responseCacheable|responseHasBusinessError)$/;

// 「文件|缓存|写入的值」→ 理由
const NOT_NETWORK_RESULT = {
	'components/cntradition/BaZi.js|baziMem|clonePlain(localResult)': '本地引擎算出的结果,不是后端回包',
	'components/cntradition/BaZi.js|baziDirectMem|clonePlain(localResult)': '本地引擎算出的结果,不是后端回包',
	'utils/preciseCalcBridge.js|nongliMem|localHit': '本机缓存命中(写入本机缓存时已判过)',
	'utils/preciseCalcBridge.js|nongliMem|softFallback': '本地兜底算出的结果',
	'utils/preciseCalcBridge.js|nongliMem|fallback': '本地兜底算出的结果',
	'utils/preciseCalcBridge.js|jieqiYearMem|localHit': '本机缓存命中(写入本机缓存时已判过)',
	'utils/preciseCalcBridge.js|jieqiYearMem|fallback': '本地兜底算出的结果',
	'utils/preciseCalcBridge.js|jieqiSeedMem|localHit': '本机缓存命中',
	'utils/preciseCalcBridge.js|jieqiSeedMem|result': '由已判过的节气年表拼出的种子(错误包没有 jieqi24,拼不出)',
	'utils/divinationTimeDraft.js|nongliMemo|out': '本地农历换算结果',
	'utils/divinationTimeDraft.js|remoteNongliMemo|out': '远端几张表拼出的农历(拼不出回 null,不写)',
	'utils/requestDedupe.js|done|{ at: Date.now(), value: persisted }': '持久层回放的值(写入持久层时已判过)',
	'utils/requestDedupe.js|warm|{ at: Date.now(), value: persisted }': '持久层回放的值(写入持久层时已判过)',
	'utils/requestDedupe.js|done|hit': '同一层命中后挪到最新(值早已判过)',
	'utils/requestDedupe.js|warm|warmHit': '同一层命中后挪到最新(值早已判过)',
	'utils/requestDedupe.js|done|{ at: Date.now(), value: warmHit.value }': 'L2 命中提升到 L1(值早已判过)',
	'services/_requestCache.js|registry|s': '命名空间登记处,不是结果',
	'utils/processCacheRegistry.js|REGISTRY|clear': '缓存登记处本身',
	'components/astro/IndiaChart.js|indiaChartCache|resolved': '写前按载荷判据 hasCurrentJyotishPayload 校验(错误包没有载荷)',
	'services/astro.js|chartMem|clonePlain(rsp)': '写前只认带 Result.params 的有效盘(错误包没有 params)',
};

function walk(dir, acc){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
		const p = path.join(dir, e.name);
		if(e.isDirectory()){ if(e.name !== '__tests__' && e.name !== '.umi' && e.name !== '.umi-production'){ walk(p, acc); } }
		else if(/\.js$/.test(e.name)){ acc.push(p); }
	});
	return acc;
}
function scan(src){
	const out = [];
	const ast = parseModule(src);
	const caches = new Set();
	ast.program.body.forEach((st)=>{
		const decls = st.type === 'VariableDeclaration' ? st.declarations
			: (st.type === 'ExportNamedDeclaration' && st.declaration && st.declaration.type === 'VariableDeclaration' ? st.declaration.declarations : []);
		decls.forEach((d)=>{
			if(d.id.type === 'Identifier' && d.init && d.init.type === 'NewExpression' && ['Map', 'Set'].indexOf(d.init.callee.name) >= 0 && !/inflight|pending/i.test(d.id.name)){ caches.add(d.id.name); }
		});
	});
	const hasJudge = (node)=>{ let h = false; traverse.cheap(node, (n)=>{ if(n.type === 'CallExpression' && n.callee.type === 'Identifier' && JUDGE.test(n.callee.name)){ h = true; } }); return h; };
	traverse(ast, {
		CallExpression(p){
			const c = p.node.callee;
			let v = null; let valueNode = null;
			if(c.type === 'Identifier' && c.name === 'pushCache' && p.node.arguments[0] && p.node.arguments[0].type === 'Identifier'){ v = p.node.arguments[0].name; valueNode = p.node.arguments[2]; }
			else if(c.type === 'MemberExpression' && c.property && c.property.name === 'set' && c.object.type === 'Identifier'){ v = c.object.name; valueNode = p.node.arguments[1] || p.node.arguments[0]; }
			if(!v || !caches.has(v)){ return; }
			let guarded = false;
			for(let q = p; q && !q.isProgram(); q = q.parentPath){
				if(q.isIfStatement() && hasJudge(q.node.test)){ guarded = true; }
				if(q.parentPath && q.parentPath.isBlockStatement()){
					const body = q.parentPath.node.body;
					const i = body.indexOf(q.node);
					for(let k = 0; k < i; k++){ if(body[k].type === 'IfStatement' && hasJudge(body[k].test)){ guarded = true; } }
				}
			}
			const valueText = valueNode ? src.slice(valueNode.start, valueNode.end) : '';
			out.push({ cache: v, value: valueText, line: p.node.loc.start.line, guarded });
		},
	});
	return out;
}

describe('源码合同:登记过的结果缓存写入前判业务错误', ()=>{
	const files = walk(SRC, []).filter((f)=>fs.readFileSync(f, 'utf8').indexOf('registerProcessCache(') >= 0);
	test('全 src 写点都已判或已表态', ()=>{
		const bad = [];
		files.forEach((f)=>{
			const rel = path.relative(SRC, f).split(path.sep).join('/');
			scan(fs.readFileSync(f, 'utf8')).forEach((w)=>{
				if(w.guarded){ return; }
				// 值以登记的写法开头即可(多行的值只取开头那个标识符 / 调用)
				const hit = Object.keys(NOT_NETWORK_RESULT).some((k)=>{
					const [kf, kc, kv] = k.split('|');
					return kf === rel && kc === w.cache && (w.value === kv || w.value.indexOf(`${kv}`) === 0);
				});
				if(!hit){ bad.push(`${rel}:${w.line} ${w.cache} ← ${w.value.slice(0, 40)}`); }
			});
		});
		expect(bad).toEqual([]);
	});
	test('判别力:只判结果为真即红;判过 / 早退判过不红', ()=>{
		const head = "const mem = new Map(); registerProcessCache('x', ()=>mem.clear());\n";
		expect(scan(`${head}function f(){ return request(u).then((data)=>{ const r = data.Result; if(key && r){ pushCache(mem, key, r); } return r; }); }`)[0].guarded).toBe(false);
		expect(scan(`${head}function f(){ return request(u).then((data)=>{ const r = data.Result; if(key && r && responseCacheable(data)){ pushCache(mem, key, r); } return r; }); }`)[0].guarded).toBe(true);
		expect(scan(`${head}async function f(){ const v = await run(); if(!responseCacheable(v)){ return v; } mem.set(key, v); return v; }`)[0].guarded).toBe(true);
	});
	test('登记表里的每一项都还在(撤掉写点要一并撤表)', ()=>{
		Object.keys(NOT_NETWORK_RESULT).forEach((k)=>{
			const [kf, kc, kv] = k.split('|');
			const f = path.join(SRC, kf);
			expect(fs.existsSync(f)).toBe(true);
			const ws = scan(fs.readFileSync(f, 'utf8')).filter((w)=>w.cache === kc && (w.value === kv || w.value.indexOf(kv) === 0));
			expect([k, ws.length > 0]).toEqual([k, true]);
		});
	});
});

describe('🔴 行为:业务错误包不进技法缓存', ()=>{
	test('3D 盘状态缓存:同参第一次回 Result.err → 第二次重新请求、拿到真结果', async ()=>{
		jest.resetModules();
		const calls = [];
		jest.doMock('../request', ()=>({ __esModule: true, default: jest.fn(async ()=>{ calls.push(1); return calls.length === 1 ? { ResultCode: 0, Result: { err: 'param error' } } : { ResultCode: 0, Result: { ok: 1 } }; }) }));
		const { fetchChart3DState } = require('../../services/astro3d');
		await fetchChart3DState({ a: 1 });
		const second = await fetchChart3DState({ a: 1 });
		expect(calls.length).toBe(2);
		expect(second).toEqual({ ResultCode: 0, Result: { ok: 1 } });
		const third = await fetchChart3DState({ a: 1 });   // 真结果照常进缓存
		expect(calls.length).toBe(2);
		expect(third).toEqual(second);
		jest.dontMock('../request');
	});
});
