// [压测二轮·D6] 账本写不进去时的合同(用户拍板):**写不进账本就拒绝执行**——「可一键撤销」是对用户的承诺,
// 不能因为 localStorage 满了就悄悄降级成「做了但撤不了」。另:账本已积到上百条时,配额失败要先裁半再重试。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { appendAction, listActions, LEDGER_KEY, LEDGER_MAX, __resetLedgerForTests } from '../aiTools/ledger';
import { listLocalCharts } from '../localcharts';

const NEW_CHART = { name: '张三', birth: '1990-01-01 08:00', place: '北京', gender: 'male' };
const ctx = ()=>({ origin: 'in-app', requestId: 'r1', dispatch: jest.fn(), ui: { selectSource: jest.fn(), refreshSources: jest.fn() } });

// 只让「账本键」写入撞配额;其余键(命盘库等)照常可写 —— 否则「零写入」断言是假的(什么都写不进当然零写入)
function trapLedgerQuota(){
	const realSet = window.localStorage.setItem.bind(window.localStorage);
	const attempts = [];
	jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(k, v){
		if(`${k}` === LEDGER_KEY){
			attempts.push(`${v}`);
			const e = new Error('The quota has been exceeded.');
			e.name = 'QuotaExceededError';
			throw e;
		}
		return realSet(`${k}`, v);
	});
	return attempts;
}

beforeEach(()=>{
	window.localStorage.clear();
	jest.restoreAllMocks();
	jest.spyOn(console, 'warn').mockImplementation(()=>{});
	__resetToolsForTests();
	__resetLedgerForTests();
	__resetWorkspaceBridgeForTests();
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	registerBuiltinTools();
});

it('🔴 L1 账本写入撞配额 → create_chart_record 回 ok:false / E_LEDGER_UNAVAILABLE 且零写入(命盘库不增一条)', async ()=>{
	// 当前代码为何红:ledger.js:19-21 的 writeAll 是 `try{ safeJsonStringifyToStorage(...) }catch(e){ /* 账本写失败不阻断 */ }`
	// —— 而 safeJsonStringifyToStorage 撞配额时连抛都不抛,直接回 false;appendAction(ledger.js:49-55)
	// 完全不看返回值。于是 registry.js:129-142 记完「账本」(其实什么也没记)照样回 ok:true:
	// 记录真的建了、账本里没有这条、动作条上没有撤销按钮 —— 承诺的「可一键撤销」当场作废。
	expect(listLocalCharts({}).length).toBe(0);
	trapLedgerQuota();
	const r = await runTool('create_chart_record', NEW_CHART, ctx());
	expect(r.ok).toBe(false);
	expect(r.code).toBe('E_LEDGER_UNAVAILABLE');
	expect(listLocalCharts({}).length).toBe(0);
	expect(listActions().length).toBe(0);
});

it('L1b 判别力:账本可写时同一调用照常成功、落库并带 undo(说明上一条不是「建档本来就坏」)', async ()=>{
	const r = await runTool('create_chart_record', NEW_CHART, ctx());
	expect(r.ok).toBe(true);
	expect(r.data.created).toBe(true);
	expect(r.undo.kind).toBe('trash-record');
	expect(listLocalCharts({}).length).toBe(1);
	expect(listActions().length).toBe(1);
});

it('🔴 L2 账本已积 150 条时撞配额 → 先裁掉一半再重试(而不是拿同一份整表重写两次)', async ()=>{
	// 当前代码为何红:ledger.js:20 只写一次 `list.slice(0, LEDGER_MAX)`;safeStorage 内部的那次重试
	// 用的是**同一个 value**(safeStorage.js safeLocalStorageSet 的 quota 分支只清可再生缓存后原样重写)——
	// 账本本身太大导致的配额失败因此永远救不回来。正解:writeAll 撞配额时裁半重试。
	expect(LEDGER_MAX).toBe(200);
	for(let i = 0; i < 150; i++){
		appendAction({ id: `act-${i}`, origin: 'in-app', tool: 'create_chart_record', level: 'additive', args: { name: `甲${i}` }, summary: `建档 ${i}`, result: { ok: true }, undo: { kind: 'none' } });
	}
	expect(listActions().length).toBe(150);
	const attempts = trapLedgerQuota();
	appendAction({ id: 'act-new', origin: 'in-app', tool: 'create_chart_record', level: 'additive', args: {}, summary: '新的一条', result: { ok: true }, undo: { kind: 'none' } });
	const sizes = attempts.map((v)=>{ try{ return JSON.parse(v).length; }catch(e){ return -1; } });
	expect(sizes.length).toBeGreaterThanOrEqual(2);
	expect(sizes[0]).toBe(151);
	expect(Math.min.apply(null, sizes)).toBeLessThanOrEqual(Math.ceil(sizes[0] / 2));
});

it('🔴 D17 预留成功、提交失败 → 记录已落地但 ledgerLost:true / undo.kind none,并派 horosa:agent-ledger-lost 事件(此前全仓无人消费)', async ()=>{
	const realSet = window.localStorage.setItem.bind(window.localStorage);
	let ledgerWrites = 0;
	jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(k, v){
		if(`${k}` === LEDGER_KEY){
			ledgerWrites += 1;
			if(ledgerWrites >= 2){ const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; }
		}
		return realSet(`${k}`, v);
	});
	const seen = [];
	const onLost = (e)=>seen.push(e.detail);
	window.addEventListener('horosa:agent-ledger-lost', onLost);
	try{
		const r = await runTool('create_chart_record', NEW_CHART, ctx());
		expect(r.ok).toBe(true);
		expect(r.ledgerLost).toBe(true);
		expect(r.undo.kind).toBe('none');
		expect(listLocalCharts({}).length).toBe(1);   // 记录真的落地了(承诺降级如实告知,而不是假装没做)
		expect(seen.length).toBe(1);
		expect(seen[0].tool).toBe('create_chart_record');
		expect(seen[0].origin).toBe('in-app');
		expect(typeof seen[0].actionId).toBe('string');
	}finally{ window.removeEventListener('horosa:agent-ledger-lost', onLost); }
});
