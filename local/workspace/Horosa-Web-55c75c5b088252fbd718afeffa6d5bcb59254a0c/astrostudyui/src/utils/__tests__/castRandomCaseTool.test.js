// cast_random_case软件代摇;随机结果随事盘落盘可复现;一问一次(recast 才重摇);始终要审批(不论审批档)。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests, getTool } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { __resetLedgerForTests } from '../aiTools/ledger';
import { setAgentEnabled } from '../aiAgent/prefs';
import { resolveApprovalDecision } from '../aiAgent/approvalPolicy';
import { getLocalCase } from '../localcases';
import { randomInputsOf } from '../aiTools/tools/castRandomCase';

const ctx = ()=>({ origin: 'in-app', requestId: 'rc', dispatch: jest.fn() });
const payloadOf = (cid)=>{ const p = getLocalCase(cid).payload; return typeof p === 'string' ? JSON.parse(p) : p; };
beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	setAgentEnabled(true);
	registerBuiltinTools();
});

test('随机源:六爻蓍草 / 掷钱出 6–9 六爻,灵棋三层各 0–4,太玄 / 荆诀的种子是真随机记录', ()=>{
	for(let i = 0; i < 50; i++){
		randomInputsOf('liuyao').inputs.yao.forEach((v)=>expect([6, 7, 8, 9]).toContain(v));
		randomInputsOf('liuyao', 'coins').inputs.coins.forEach((v)=>expect(v >= 0 && v <= 3).toBe(true));
		randomInputsOf('lingqi').inputs.counts.forEach((v)=>expect(v >= 0 && v <= 4).toBe(true));
	}
	expect(randomInputsOf('taixuan').inputs.seed).toMatch(/^tr1-[0-9a-f]{64}$/);
	expect(randomInputsOf('jingjue').inputs.seed).toMatch(/^tr1-[0-9a-f]{64}$/);
});
test('六爻代摇:建事盘、卦随事盘冻结、标软件代摇;同问再摇拒,recast 才行', async ()=>{
	const r = await runTool('cast_random_case', { caseType: 'liuyao', question: '这次面试能过吗', divTime: '2026-03-01 10:00', place: '北京' }, ctx());
	expect(r.ok).toBe(true);
	const p = payloadOf(r.data.cid);
	expect(p.randomCast).toMatchObject({ by: 'software', question: '这次面试能过吗', method: 'yarrow' });
	expect(p.gua && (p.gua.yao || p.gua.currentGua)).toBeTruthy();
	expect(`${p.snapshot || ''}`.trim()).not.toBe('');
	const again = await runTool('cast_random_case', { caseType: 'liuyao', question: '这次面试能过吗' }, ctx());
	expect([again.ok, again.data && again.data.cid]).toEqual([false, r.data.cid]);
	const re = await runTool('cast_random_case', { caseType: 'liuyao', question: '这次面试能过吗', recast: true }, ctx());
	expect(re.ok).toBe(true);
	expect(payloadOf(re.data.cid).randomCast.recast).toBe(true);
});
test('塔罗代抽:种子冻结进 payload(复现靠种子)', async ()=>{
	const r = await runTool('cast_random_case', { caseType: 'tarot', question: '感情走向', divTime: '2026-03-01 10:00', place: '北京' }, ctx());
	expect(r.ok).toBe(true);
	const p = payloadOf(r.data.cid);
	expect(p.options.seed).toMatch(/^tr1-(?:[0-9a-f]{2}){384,}$/);   // 真随机记录(主洗牌 + 三指定牌 + 切牌 + 计时)
	expect(p.randomCast.by).toBe('software');
});
test('始终要审批:全自动档 / 放行名单 / 本会话免问都不跳过;只读档拒', ()=>{
	const def = getTool('cast_random_case');
	expect(def.alwaysConfirm).toBe(true);
	expect(resolveApprovalDecision({ level: 'additive', def, args: {}, mode: 'never', categories: {}, toolPolicy: { allow: ['cast_random_case'] }, sessionAllow: ()=>true })).toBe('ask');
	expect(resolveApprovalDecision({ level: 'additive', def, args: {}, mode: 'read-only', categories: {} })).toBe('deny');
	expect(resolveApprovalDecision({ level: 'additive', def: getTool('star_record'), args: {}, mode: 'never', categories: {} })).toBe('auto');
});
