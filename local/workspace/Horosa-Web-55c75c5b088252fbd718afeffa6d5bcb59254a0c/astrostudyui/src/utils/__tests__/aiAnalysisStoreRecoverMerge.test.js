// AI 工作区库打开失败 → 内存回退 → 退避后重开:回退期读到的「空」不是库里的真值,不能被当底版整份写回。
// 单例文档(一条固定 id 装一整张表)一律经库内读改写单一入口 mergeStoreRecord:合并函数拿到的永远是库里现存那份;
// 回退期调用时先对内存那份合并、记下合并函数,库重开并回时对库里现存那份重放。
// 库重开派 horosa:ai-store-recovered,页面据此重读;回退期整体替换类操作(恢复工作区 / 整店清空)拒绝,不落到内存里冒充成功。
// 例子表里两种使用方:「回退期写入,恢复后并回」与「回退期读到空、恢复后再写」—— 后者是只测前者时漏掉的那一种。
if(typeof window.indexedDB !== 'undefined'){
	throw new Error('前提失效:jsdom 已定义 indexedDB,fake-indexeddb 的装载顺序需重审');
}
require('fake-indexeddb/auto');
const FIDB = require('fake-indexeddb');
const fs = require('fs');
const path = require('path');

function loadStore(){
	let mod = null;
	jest.isolateModules(()=>{ mod = require('../aiAnalysisStore'); });
	return mod;
}
function flakyFactory(real, failTimes){
	let calls = 0;
	return {
		get calls(){ return calls; },
		open(...args){
			calls += 1;
			if(calls <= failTimes){
				const req = {};
				setTimeout(()=>{ const e = new Error('UnknownError (simulated)'); e.name = 'UnknownError'; req.error = e; if(typeof req.onerror === 'function'){ req.onerror(); } }, 0);
				return req;
			}
			return real.open(...args);
		},
		deleteDatabase(...args){ return real.deleteDatabase(...args); },
	};
}
let nowSpy = null;
let clock = 1700000000000;
beforeEach(()=>{ clock = 1700000000000; nowSpy = jest.spyOn(Date, 'now').mockImplementation(()=>clock); });
afterEach(()=>{ if(nowSpy){ nowSpy.mockRestore(); } window.indexedDB = undefined; });

const DOC = 'test.singleton.v1';
// 测试用的逐键合并:页面这次改的键并进库里现存那份(库里有、这次没提的键留着)
const mergeKeys = (patch)=>(cur)=>({ id: DOC, map: { ...((cur && cur.map) || {}), ...patch } });

async function seedReal(real, map){
	window.indexedDB = real;
	const S0 = loadStore();
	await S0.putStoreRecord(S0.AI_ANALYSIS_STORES.workspaceMeta, { id: DOC, map });
}
async function readReal(real){
	window.indexedDB = real;
	const S = loadStore();
	const rec = await S.getStoreRecord(S.AI_ANALYSIS_STORES.workspaceMeta, DOC);
	return rec && rec.map ? Object.keys(rec.map).sort() : null;
}

describe('🔴 单例文档:回退期读到的空不当真值', ()=>{
	test('回退期读到空 → 恢复后经 mergeStoreRecord 写:库里原有的键不丢', async ()=>{
		const real = new FIDB.IDBFactory();
		await seedReal(real, { a: 1, b: 2 });
		window.indexedDB = flakyFactory(real, 1);
		const S = loadStore();
		const pageView = await S.getStoreRecord(S.AI_ANALYSIS_STORES.workspaceMeta, DOC);   // 回退期:读不到
		expect(pageView).toBe(null);
		expect(S.getAiStoreHealth()).toMatchObject({ degraded: true, retrying: true });
		clock += 60 * 1000;
		await S.mergeStoreRecord(S.AI_ANALYSIS_STORES.workspaceMeta, DOC, mergeKeys({ c: 3 }));
		expect(S.getAiStoreHealth().degraded).toBe(false);
		expect(await readReal(real)).toEqual(['a', 'b', 'c']);
	});
	test('回退期就写(进内存)→ 恢复并回时对库里那份重放,不是「库里有同 id 就丢掉内存那份」', async ()=>{
		const real = new FIDB.IDBFactory();
		await seedReal(real, { a: 1, b: 2 });
		const f = flakyFactory(real, 1);
		window.indexedDB = f;
		const S = loadStore();
		await S.mergeStoreRecord(S.AI_ANALYSIS_STORES.workspaceMeta, DOC, mergeKeys({ c: 3 }));
		await S.mergeStoreRecord(S.AI_ANALYSIS_STORES.workspaceMeta, DOC, mergeKeys({ d: 4 }));
		// 回退期内:内存那份已有这次改的
		const mem = await S.getStoreRecord(S.AI_ANALYSIS_STORES.workspaceMeta, DOC);
		expect(Object.keys(mem.map).sort()).toEqual(['c', 'd']);
		const recovered = [];
		const h = ()=>recovered.push(1);
		window.addEventListener(S.AI_STORE_RECOVERED_EVENT, h);
		clock += 60 * 1000;
		await S.listStoreRecords(S.AI_ANALYSIS_STORES.conversations);   // 任意一次访问触发重开
		window.removeEventListener(S.AI_STORE_RECOVERED_EVENT, h);
		expect(recovered.length).toBe(1);
		expect(f.calls).toBe(2);
		expect(await readReal(real)).toEqual(['a', 'b', 'c', 'd']);
	});
	test('对照:裸 putStoreRecord 整份写回就会盖掉(这正是单例文档必须经合并入口的原因)', async ()=>{
		const real = new FIDB.IDBFactory();
		await seedReal(real, { a: 1, b: 2 });
		window.indexedDB = flakyFactory(real, 1);
		const S = loadStore();
		const pageView = (await S.getStoreRecord(S.AI_ANALYSIS_STORES.workspaceMeta, DOC)) || { id: DOC, map: {} };
		clock += 60 * 1000;
		await S.putStoreRecord(S.AI_ANALYSIS_STORES.workspaceMeta, { ...pageView, map: { ...pageView.map, c: 3 } });
		expect(await readReal(real)).toEqual(['c']);
	});
	test('合并函数回 null = 不写;库里没有这条时拿到 null', async ()=>{
		const real = new FIDB.IDBFactory();
		window.indexedDB = real;
		const S = loadStore();
		const seen = [];
		const r = await S.mergeStoreRecord(S.AI_ANALYSIS_STORES.workspaceMeta, DOC, (cur)=>{ seen.push(cur); return null; });
		expect(seen).toEqual([null]);
		expect(r).toBe(null);
		expect(await readReal(real)).toBe(null);
	});
});

describe('🔴 回退期整体替换类操作拒绝(不落到内存里冒充成功)', ()=>{
	test('clearStore 抛 ai-store.unavailable、库里原样;派生缓存照常可清', async ()=>{
		const real = new FIDB.IDBFactory();
		window.indexedDB = real;
		const S0 = loadStore();
		await S0.putStoreRecord(S0.AI_ANALYSIS_STORES.conversations, { id: 'c1', title: '库里的' });
		window.indexedDB = flakyFactory(real, 99);
		const S = loadStore();
		await expect(S.clearStore(S.AI_ANALYSIS_STORES.conversations)).rejects.toThrow(S.AI_STORE_UNAVAILABLE_ERROR);
		await expect(S.clearStore(S.AI_ANALYSIS_STORES.contextCache)).resolves.toBe(true);
		window.indexedDB = real;
		const S2 = loadStore();
		expect((await S2.listStoreRecords(S2.AI_ANALYSIS_STORES.conversations)).map((x)=>x.id)).toEqual(['c1']);
	});
	test('恢复 AI 工作区:库读不开时一条不动、抛 ai-store.unavailable(先于快照与清店)', async ()=>{
		const real = new FIDB.IDBFactory();
		window.indexedDB = flakyFactory(real, 99);
		const S = loadStore();
		const { restoreWorkspaceStores } = require('../aiWorkspaceRestore');
		const calls = [];
		const deps = {
			assertDurable: S.assertAiStoreDurable,
			clearStore: async (n)=>{ calls.push(`clear:${n}`); },
			bulkPutStoreRecords: async (n)=>{ calls.push(`put:${n}`); },
			listStoreRecords: async (n)=>{ calls.push(`list:${n}`); return []; },
		};
		const plan = { ok: true, present: ['conversations'], absent: [], total: 1, stores: { conversations: [{ id: 'x' }] } };
		await expect(restoreWorkspaceStores(plan, deps)).rejects.toThrow(S.AI_STORE_UNAVAILABLE_ERROR);
		expect(calls).toEqual([]);
	});
	test('没有 IndexedDB 的环境(内存就是唯一存储)不算降级:照常可清', async ()=>{
		window.indexedDB = undefined;
		const S = loadStore();
		await expect(S.assertAiStoreDurable()).resolves.toBe(true);
		await expect(S.clearStore(S.AI_ANALYSIS_STORES.conversations)).resolves.toBe(true);
	});
});

// 单例文档 = 一条固定 id 装一整张表。全 src 里对 workspace_meta 写固定 id 的地方,
// 要么经 mergeStoreRecord,要么登记在下表并写明为什么整份替换是对的。新增单例写点不表态即红。
describe('源码合同:workspace_meta 单例写点必须经合并入口或表态', ()=>{
	const { parseModule } = require('./helpers/importSpecs');
	const traverse = require('@babel/traverse').default;
	const SRC = path.resolve(__dirname, '../..');
	const WHOLE_REPLACE_OK = {
		// 文件(相对 src):理由
		'utils/aiWorkspaceRestore.js': '恢复进度句柄:每次恢复整条写当次状态,不累积内容',
		'utils/ziweiCustomTablesPersist.js': '自定义表镜像:本机存储里的现表才是真值,镜像整份跟随它',
	};
	function walk(dir, acc){
		fs.readdirSync(dir, { withFileTypes: true }).forEach((e)=>{
			const p = path.join(dir, e.name);
			if(e.isDirectory()){ if(e.name !== '__tests__' && e.name !== '.umi' && e.name !== '.umi-production'){ walk(p, acc); } }
			else if(/\.js$/.test(e.name)){ acc.push(p); }
		});
		return acc;
	}
	const isMetaStoreArg = (n)=>n && n.type === 'MemberExpression' && n.property && n.property.name === 'workspaceMeta';
	// 首参是 workspaceMeta、第二参是对象字面量且 id 不是从别处带来的(字面量 / 常量 / 条件选常量)= 单例写点
	function singletonPuts(src){
		const out = [];
		let ast = null;
		try{ ast = parseModule(src); }catch(e){ return out; }
		traverse(ast, {
			CallExpression(p){
				const c = p.node.callee;
				const name = c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && c.property && c.property.name);
				if(['putStoreRecord', 'bulkPutStoreRecords'].indexOf(name) < 0){ return; }
				const [a0, a1] = p.node.arguments;
				if(!isMetaStoreArg(a0) && !(a0 && a0.type === 'MemberExpression' && a0.property && a0.property.name === 'metaStore')){ return; }
				if(!a1 || a1.type !== 'ObjectExpression'){ return; }
				const idProp = a1.properties.find((pr)=>pr.type === 'ObjectProperty' && pr.key && (pr.key.name === 'id' || pr.key.value === 'id'));
				if(!idProp){ return; }
				const isConstName = (n)=>n && n.type === 'Identifier' && /^[A-Z][A-Z0-9_]+$/.test(n.name);
				// 固定 id:字面量 / 全大写常量 / 条件选常量 / 常量表取值(MIRROR_IDS[kind]);局部变量按它的初值判
				const fixedExpr = (v, depth = 0)=>{
					if(!v || depth > 3){ return false; }
					if(v.type === 'StringLiteral' || isConstName(v)){ return true; }
					if(v.type === 'ConditionalExpression'){ return fixedExpr(v.consequent, depth + 1) && fixedExpr(v.alternate, depth + 1); }
					if(v.type === 'MemberExpression'){ return isConstName(v.object); }
					if(v.type === 'Identifier'){
						const b = p.scope.getBinding(v.name);
						if(b && b.path && b.path.isVariableDeclarator()){ return fixedExpr(b.path.node.init, depth + 1); }
					}
					return false;
				};
				const fixed = fixedExpr(idProp.value);
				if(fixed){ out.push({ line: p.node.loc.start.line, tag: /TPL/.test(src.split('\n')[p.node.loc.start.line - 1] + (src.split('\n')[p.node.loc.start.line] || '')) ? 'tpl' : '' }); }
			},
		});
		return out;
	}
	test('全 src 单例写点都已表态', ()=>{
		const bad = [];
		walk(SRC, []).forEach((f)=>{
			const src = fs.readFileSync(f, 'utf8');
			if(src.indexOf('StoreRecord') < 0){ return; }
			const rel = path.relative(SRC, f).split(path.sep).join('/');
			singletonPuts(src).forEach((hit)=>{
				const k = hit.tag ? `${rel}#${hit.tag}` : rel;
				if(!WHOLE_REPLACE_OK[k] && !WHOLE_REPLACE_OK[rel]){ bad.push(`${rel}:${hit.line}`); }
			});
		});
		expect(bad).toEqual([]);
	});
	test('判别力:常量 id 的整份写即红;按记录 id 的普通写不算单例', ()=>{
		expect(singletonPuts("putStoreRecord(AI_ANALYSIS_STORES.workspaceMeta, { id: SOME_DOC_ID, edits });").length).toBe(1);
		expect(singletonPuts("putStoreRecord(AI_ANALYSIS_STORES.workspaceMeta, { id: 'x.v1', edits });").length).toBe(1);
		expect(singletonPuts("putStoreRecord(AI_ANALYSIS_STORES.workspaceMeta, { ...it, key: it.id }, 'aimem');").length).toBe(0);
		expect(singletonPuts("putStoreRecord(AI_ANALYSIS_STORES.conversations, { id: 'c1' });").length).toBe(0);
		expect(singletonPuts("mergeStoreRecord(AI_ANALYSIS_STORES.workspaceMeta, 'x.v1', (cur)=>cur);").length).toBe(0);
		expect(singletonPuts("function f(kind){ const id = IDS[kind]; return putStoreRecord(AI_ANALYSIS_STORES.workspaceMeta, { id, json }); }").length).toBe(1);
		expect(singletonPuts("function f(rec){ const id = rec.id; return putStoreRecord(AI_ANALYSIS_STORES.workspaceMeta, { id, json }); }").length).toBe(0);
	});
	test('登记表里的每一项都还在(撤掉写点要一并撤表)', ()=>{
		Object.keys(WHOLE_REPLACE_OK).forEach((k)=>{
			const [rel, tag] = k.split('#');
			const f = path.join(SRC, rel);
			expect(fs.existsSync(f)).toBe(true);
			const hits = singletonPuts(fs.readFileSync(f, 'utf8'));
			expect(hits.filter((h)=>(tag ? h.tag === tag : true)).length).toBeGreaterThan(0);
		});
	});
});

describe('源码合同:库重开后页面重读、恢复工作区先确认库打开', ()=>{
	const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的门面按全集读
	const read = (rel)=>readSource(path.resolve(__dirname, '../..', rel));
	test('AI 分析页:订阅库重开事件重载工作区;恢复工作区传 assertDurable、库读不开时如实提示', ()=>{
		const src = read('components/aianalysis/AIAnalysisMain.js');
		expect(src).toMatch(/addEventListener\(AI_STORE_RECOVERED_EVENT/);
		expect(src).toMatch(/restoreWorkspaceStores\([^)]*assertDurable:\s*assertAiStoreDurable/);
		expect(src).toMatch(/AI_STORE_UNAVAILABLE_ERROR\)\{\s*message\.error\(AI_STORE_UNAVAILABLE_MESSAGE\)/);
	});
});
