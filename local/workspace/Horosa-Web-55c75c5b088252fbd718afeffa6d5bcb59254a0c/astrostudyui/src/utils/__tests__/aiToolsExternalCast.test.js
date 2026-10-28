// 按用户起卦结果建事盘合同:格式目录 · 六类各用示例输入建档(payload 与页面同形、快照正文必存、挂载经 cast_technique 读回同一份)·
// 六爻三种输入(六爻数 / 背面数 / 报数)与页面同一成卦 · 输入校验 · 数字串容错 · 同题同时刻且同卦同问才去重 · 撤销移入回收站。
jest.mock('../request', ()=>({ __esModule: true, default: jest.fn(async ()=>{ throw new Error('offline'); }) }));
import Ajv from 'ajv';
import { registerBuiltinTools } from '../aiTools';
import { runTool, listTools, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { undoAction, __resetLedgerForTests } from '../aiTools/ledger';
import { setAgentEnabled, setAgentApprovalMode } from '../aiAgent/prefs';
import { getLocalCase } from '../localcases';
import { INPUT_CASTABLE, CAST_SPECS, normalizeCastInputs } from '../aiTools/divinationCast';
import { Gua64, getGua64 } from '../../components/gua/GuaConst';
import { littleEndian } from '../helper';
import { findAnalysisSourceById } from '../aiAnalysisSources';
import { listAnalysisTechniqueOptions } from '../aiAnalysisContext';
import { coinTossToYao, numsToGua } from '../../components/guazhan/LiuYaoCastPad';

const ajv = new Ajv({ allErrors: true, strict: false });
const ctx = (extra)=>({ origin: 'mcp', requestId: 'turnC:0:c1', dispatch: jest.fn(), ...(extra || {}) });
function okShaped(name, r){
	if(!r.ok){ throw new Error(`${name} 失败:${r.code} ${r.message}`); }
	const def = listTools().find((d)=>d.name === name);
	const v = ajv.compile(def.outputSchema);
	if(!v(r.data)){ throw new Error(`${name} data 不合 outputSchema:${JSON.stringify(v.errors)}`); }
}
const payloadOf = (cid)=>{ const p = getLocalCase(cid).payload; return typeof p === 'string' ? JSON.parse(p) : p; };
const base = (extra)=>({ divTime: '2026-03-01 10:00', place: '北京', selectAsAnalysisSource: false, ...(extra || {}) });

beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	registerBuiltinTools();
	setAgentEnabled(true); setAgentApprovalMode('never');
});
afterEach(()=>{ setAgentEnabled(false); });

describe('格式目录', ()=>{
	it('🔴 六类都在、带格式说明与示例;单类过滤;建档工具 additive / records / trash-record,目录工具 read', async ()=>{
		const r = await runTool('list_divination_casts', {}, ctx());
		okShaped('list_divination_casts', r);
		expect(r.data.types.map((t)=>t.caseType)).toEqual(INPUT_CASTABLE);
		r.data.types.forEach((t)=>{ expect(t.inputs.length).toBeGreaterThan(10); expect(typeof t.example).toBe('object'); });
		const one = await runTool('list_divination_casts', { caseType: 'lingqi' }, ctx());
		expect(one.data.types.map((t)=>t.caseType)).toEqual(['lingqi']);
		const def = listTools().find((d)=>d.name === 'cast_divination_case');
		expect(def.level).toBe('additive'); expect(def.category).toBe('records'); expect(def.undoKind).toBe('trash-record');
		expect(listTools().find((d)=>d.name === 'list_divination_casts').level).toBe('read');
	});
});

describe('六类各用示例输入建档', ()=>{
	INPUT_CASTABLE.forEach((type)=>{
		it(`🔴 ${type}:payload.module / 版本与页面同形、快照正文非空;cast_technique 读回的就是这份快照`, async ()=>{
			const spec = CAST_SPECS[type];
			const r = await runTool('cast_divination_case', base({ caseType: type, inputs: spec.example, event: `${type} 示例`, question: '问事业' }), ctx());
			okShaped('cast_divination_case', r);
			expect(r.data.created).toBe(true);
			const rec = getLocalCase(r.data.cid);
			expect(rec.caseType).toBe(type);
			expect(rec.sourceModule).toBe(spec.sourceModule);
			const p = payloadOf(r.data.cid);
			expect(p.module).toBe(spec.module); expect(p.version).toBe(spec.version);
			expect(typeof p.snapshot).toBe('string'); expect(p.snapshot.trim().length).toBeGreaterThan(20);
			expect(p.createdBy).toBe('ai-assistant');
			expect(rec.memo).toBe('问事业');
			// 挂载读回:这张事盘自己的技法键(六爻 = sixyao,其余同类型名;须在挂载抽屉的可挂表里)→ cast_technique 读到的正文含存下的快照
			const key = type === 'liuyao' ? 'sixyao' : type;
			expect(listAnalysisTechniqueOptions(findAnalysisSourceById(r.data.cid)).map((o)=>o.value)).toContain(key);
			const read = await runTool('cast_technique', { source: { kind: 'record', cid: r.data.cid }, technique: key }, ctx({ origin: 'in-app' }));
			if(!read.ok){ throw new Error(`${type} 读回失败:${read.code} ${read.message}`); }
			const line = p.snapshot.split('\n').map((l)=>l.trim()).find((l)=>l.length > 6);
			expect(read.data.content).toContain(line);
		});
	});
});

describe('六爻三种输入 = 页面同一成卦', ()=>{
	it('🔴 六爻数:7/9 为阳、6/9 为动;卦序与爻名同 getGua64;快照含本卦名', async ()=>{
		const r = await runTool('cast_divination_case', base({ caseType: 'liuyao', inputs: { yao: [7, 8, 9, 7, 6, 8] }, event: '六爻数' }), ctx());
		okShaped('cast_divination_case', r);
		const g = payloadOf(r.data.cid).gua;
		const lines = [1, 0, 1, 1, 0, 0];
		const idx = getGua64(littleEndian(lines)).index;
		expect(g.currentGua).toBe(idx);
		expect(g.yao.map((y)=>y.value)).toEqual(lines);
		expect(g.yao.map((y)=>y.change)).toEqual([false, false, true, false, true, false]);
		expect(g.yao.map((y)=>y.name)).toEqual(Gua64[idx].yaoname);
		expect(g.guaOrigin).toBe('cast');
		expect(payloadOf(r.data.cid).snapshot).toContain(Gua64[idx].name);
	});
	it('背面数走页面 coinTossToYao(字背口径跟设置);报数走 numsToGua', async ()=>{
		const coins = [1, 2, 3, 0, 1, 2];
		const r1 = await runTool('cast_divination_case', base({ caseType: 'liuyao', inputs: { coins }, event: '背面数' }), ctx());
		okShaped('cast_divination_case', r1);
		const ys = coins.map((b)=>coinTossToYao(b, 'standard'));
		expect(payloadOf(r1.data.cid).gua.yao.map((y)=>y.value)).toEqual(ys.map((y)=>y.value));
		expect(payloadOf(r1.data.cid).gua.yao.map((y)=>y.change)).toEqual(ys.map((y)=>y.change));
		const r2 = await runTool('cast_divination_case', base({ caseType: 'liuyao', inputs: { numbers: [8, 3, 6] }, event: '报数' }), ctx());
		okShaped('cast_divination_case', r2);
		const g = numsToGua(8, 3, 6);
		expect(payloadOf(r2.data.cid).gua.yao.map((y)=>y.value)).toEqual(g.lines);
		expect(payloadOf(r2.data.cid).gua.yao.map((y, i)=>(y.change ? i + 1 : 0)).filter(Boolean)).toEqual(g.moving);
	});
});

describe('校验 / 容错 / 去重 / 撤销', ()=>{
	it('🔴 输入不合格各自报 E_ARGS_INVALID 且带格式说明;不支持的类型被参数校验拒;一张都没建', async ()=>{
		const bads = [
			['liuyao', { yao: [7, 8, 9] }], ['liuyao', { yao: [7, 8, 9, 7, 6, 5] }], ['liuyao', {}], ['liuyao', { coins: [4, 0, 0, 0, 0, 0] }],
			['xiaoliuren', { nums: [0, 1, 2] }], ['lingqi', { counts: [5, 0, 0] }], ['lingqi', { counts: [1, 1, 1], category: 'nope' }],
			['tongshefa', { taiyin: '乾', taiyang: '乾', shaoyang: '乾', shaoyin: '甲' }], ['xiaochengtu', { up: '乾', lo: 'x' }], ['xiaochengtu', { up: '乾', lo: '坤', dongYaos: [7] }],
			['feigong', { zhi: '甲' }], ['feigong', { zhi: '午', dayGanZi: '甲' }],
		];
		for(let i = 0; i < bads.length; i++){
			const [type, inputs] = bads[i];
			const r = await runTool('cast_divination_case', base({ caseType: type, inputs, event: `坏${i}` }), ctx());   // eslint-disable-line no-await-in-loop
			expect(`${type}:${r.code}`).toBe(`${type}:E_ARGS_INVALID`);
			expect(r.data && r.data.inputs).toBeTruthy();
		}
		expect((await runTool('cast_divination_case', base({ caseType: 'liureng', inputs: {} }), ctx())).code).toBe('E_ARGS_INVALID');
	});
	it('数字串容错("7" → 7);同题同时刻同类、同卦再建 → 回已有 cid;撤销 = 移入回收站', async ()=>{
		expect(normalizeCastInputs({ yao: ['7', 8, ' 9 '], tag: '7' })).toEqual({ yao: [7, 8, 9], tag: '7' });
		const r = await runTool('cast_divination_case', base({ caseType: 'xiaoliuren', inputs: { nums: ['3', '15', '7'] }, event: '数字串' }), ctx());
		okShaped('cast_divination_case', r);
		expect(payloadOf(r.data.cid).nums).toEqual([3, 15, 7]);
		// 同一组数(字符串 / 数字两种写法规整后相同)= 重复提交 → 回已有那条
		const dup = await runTool('cast_divination_case', base({ caseType: 'xiaoliuren', inputs: { nums: [3, 15, 7] }, event: '数字串' }), ctx());
		expect(dup.data.duplicate).toBe(true); expect(dup.data.cid).toBe(r.data.cid);
		expect(r.undo.kind).toBe('trash-record');
		expect(undoAction(r.undo.actionId).ok).toBe(true);
		expect(getLocalCase(r.data.cid)).toBeFalsy();
	});
	it('🔴 同一分钟里摇两卦(同题同类、卦不同)→ 两条都落库;卦相同但所问不同 → 也是两条;allowDuplicate 才再建同一卦', async ()=>{
		const a = await runTool('cast_divination_case', base({ caseType: 'xiaoliuren', inputs: { nums: [1, 2, 3] }, event: '同分钟' }), ctx());
		const b = await runTool('cast_divination_case', base({ caseType: 'xiaoliuren', inputs: { nums: [4, 5, 6] }, event: '同分钟' }), ctx());
		okShaped('cast_divination_case', a); okShaped('cast_divination_case', b);
		expect(b.data.created).toBe(true); expect(b.data.duplicate).toBe(false);
		expect(b.data.cid).not.toBe(a.data.cid);
		expect(payloadOf(a.data.cid).nums).toEqual([1, 2, 3]);
		expect(payloadOf(b.data.cid).nums).toEqual([4, 5, 6]);
		const q = await runTool('cast_divination_case', base({ caseType: 'xiaoliuren', inputs: { nums: [1, 2, 3] }, event: '同分钟', question: '另一件事' }), ctx());
		expect(q.data.created).toBe(true); expect(q.data.cid).not.toBe(a.data.cid);
		// 完全相同的重复提交(同题 / 同分钟 / 同类 / 同卦 / 同问)→ 回已有那条,不新建
		const again = await runTool('cast_divination_case', base({ caseType: 'xiaoliuren', inputs: { nums: ['1', '2', '3'] }, event: '同分钟' }), ctx());
		expect(again.data.duplicate).toBe(true); expect(again.data.cid).toBe(a.data.cid); expect(again.data.created).toBe(false);
		const forced = await runTool('cast_divination_case', base({ caseType: 'xiaoliuren', inputs: { nums: [1, 2, 3] }, event: '同分钟', allowDuplicate: true }), ctx());
		expect(forced.data.created).toBe(true); expect(forced.data.cid).not.toBe(a.data.cid);
	});
	it('飞宫:给了日干支就照用;不给按起课日日柱(本地农历)', async ()=>{
		const r1 = await runTool('cast_divination_case', base({ caseType: 'feigong', inputs: { zhi: '午', dayGanZi: '甲子' }, event: '飞宫甲子' }), ctx());
		okShaped('cast_divination_case', r1);
		const p1 = payloadOf(r1.data.cid);
		expect([p1.qiZhi, p1.dayGan, p1.dayZhi]).toEqual(['午', '甲', '子']);
		expect(p1.options.useDayGZ).toBe(false);
		const r2 = await runTool('cast_divination_case', base({ caseType: 'feigong', inputs: { num: 7 }, event: '飞宫报数' }), ctx());
		okShaped('cast_divination_case', r2);
		const p2 = payloadOf(r2.data.cid);
		expect(p2.qiZhi).toBe('午');   // 7 → 第 7 支
		expect(p2.dayGan.length).toBe(1); expect(p2.dayZhi.length).toBe(1);
		expect(p2.options.useDayGZ).toBe(true);
	});
});
