// [压测二轮·D6] 自动化引擎失控面:跨规则事件环(A 的动作发 B 的事件,B 的动作又发 A 的事件)、事件风暴、
// 「动作恒失败 → 冷却不写 → 通知刷屏」、以及「引擎注入的 deps 从来就是空的(三件公共动作恒不可用)」。
// 现有合同在 automationEngine.test.js;本文件只加压测/失控向量,不重复既有断言。
import fs from 'fs';
import path from 'path';
import { emitAutomationEvent, __resetAutomationEventsForTests } from '../aiAgent/automation/events';
import { saveRule, listRules } from '../aiAgent/automation/ruleStore';
import { handleAutomationEvent, bindAutomationEngine, __resetAutomationEngineForTests } from '../aiAgent/automation/engine';
import { buildActionRunners } from '../aiAgent/automation/actions';
import { setAutomationEnabled } from '../aiAgent/prefs';
import { AI_ANALYSIS_STORES, clearStore, listStoreRecords } from '../aiAnalysisStore';

const detail = (event, payload)=>({ event, payload: payload || {}, at: '2026-01-01T00:00:00.000Z' });
const tick = ()=>new Promise((r)=>setTimeout(r, 0));
async function settle(maxTicks, stop){
	for(let i = 0; i < maxTicks; i++){
		// eslint-disable-next-line no-await-in-loop
		await tick();
		if(typeof stop === 'function' && stop()){ return; }
	}
}

// 用例结束后让所有假动作停手(链式发事件的用例不能把余波带进下一条用例)
let live = true;

beforeEach(async ()=>{
	window.localStorage.clear();
	live = true;
	__resetAutomationEventsForTests();
	__resetAutomationEngineForTests();
	await clearStore(AI_ANALYSIS_STORES.automationRules);
	await clearStore(AI_ANALYSIS_STORES.agentNotices);
	setAutomationEnabled(true);
});
afterEach(()=>{ live = false; __resetAutomationEngineForTests(); __resetAutomationEventsForTests(); });

describe('A1 跨规则事件环', ()=>{
	it('🔴 A1 A↔B 互发事件(B 发出的事件不带 origin)→ 链深度必须被掐死,总触发 ≤3', async ()=>{
		// 当前代码为何红:engine.js:40-41 的深度守卫**只**认 `payload.origin === 'automation'`。
		// 动作自己去发事件时(actions.js 的三件动作都可能间接触发数据层的 record.saved / task.done),
		// payload 里没有 origin —— 守卫失效,A→B→A→B… 无限自激;规则冷却设 0 时更是一路跑到底。
		// 正解:引擎侧记链深度 MAX_CHAIN_DEPTH=2(与 origin 无关)。
		await saveRule({ id: 'rA', name: 'A', event: 'record.saved', enabled: true, actions: [{ type: 'select-source', cid: 'local-1' }], cooldownMs: 0 });
		await saveRule({ id: 'rB', name: 'B', event: 'task.done', enabled: true, actions: [{ type: 'archive-idle-conversations' }], cooldownMs: 0 });
		let total = 0;
		const HARD_STOP = 30;   // 兜底:当前代码下这条链不会自己停,超过即判红并收手
		bindAutomationEngine({
			selectSource: async ()=>{ total += 1; if(live && total < HARD_STOP){ emitAutomationEvent('task.done', { taskId: 't1' }); } },
			archiveIdleConversations: async ()=>{ total += 1; if(live && total < HARD_STOP){ emitAutomationEvent('record.saved', { cid: 'local-1' }); } return 1; },
		});
		emitAutomationEvent('record.saved', { cid: 'local-1' });
		await settle(400, ()=>total >= HARD_STOP);
		expect(total).toBeGreaterThan(0);        // 判别力:链确实起来了
		expect(total).toBeLessThanOrEqual(3);
	}, 60000);
});

describe('A2 事件风暴', ()=>{
	it('🔴 A2 一秒 500 条事件:最多处理 20 条,其余明确跳过;emitAutomationEvent 每条同步返回 <5ms', async ()=>{
		// 当前代码为何红:engine.js 只有「每事件最多 MAX_RULES_PER_EVENT 条规则」这一道闸,
		// **没有**每秒事件数上限 —— 一次批量导入/批量建档发出的几百条 record.saved 会逐条跑完整套
		// listRules + 动作 + markRuleFired(每条两次 IDB),把主线程和 IDB 队列一起压住。
		await saveRule({ id: 'r1', name: '设为当前源', event: 'record.saved', enabled: true, actions: [{ type: 'select-source' }], cooldownMs: 0 });
		const ran = [];
		bindAutomationEngine({ selectSource: async (cid)=>{ ran.push(cid); } });
		let maxSyncMs = 0;
		for(let i = 0; i < 500; i++){
			const t0 = Date.now();
			emitAutomationEvent('record.saved', { cid: `local-${i}` });
			maxSyncMs = Math.max(maxSyncMs, Date.now() - t0);
		}
		expect(maxSyncMs).toBeLessThan(5);
		await settle(300, ()=>ran.length > 20);
		expect(ran.length).toBeGreaterThan(0);   // 判别力:确实在处理
		expect(ran.length).toBeLessThanOrEqual(20);
	}, 120000);
});

describe('A3 失败也要冷却', ()=>{
	it('🔴 A3 动作恒失败的规则:同一冷却期内第二条事件 skipped=cooldown,失败通知恰 1 条', async ()=>{
		// 当前代码为何红:engine.js:66-72 只有 `anyRan` 为真才 markRuleFired ——
		// 一条动作恒失败的规则永远写不进 lastFiredAt,于是每来一条事件就重试一次、
		// 每次都经 actions.js:48-51 推一条 warn 通知 → 通知中心被同一条规则刷屏。
		// 正解:「尝试即计冷却」(markRuleFired 放在尝试处,与成功与否无关)。
		await saveRule({ id: 'rf', name: '恒失败', event: 'app.start', enabled: true, actions: [{ type: 'select-source' }], cooldownMs: 60000 });
		const deps = { selectSource: async ()=>{ throw new Error('炸了'); } };
		const first = await handleAutomationEvent(detail('app.start', { cid: 'local-1' }), { deps });
		expect(first.fired).toEqual([]);
		expect(first.skipped).toEqual([{ ruleId: 'rf', reason: 'all-actions-failed' }]);
		const rules = await listRules();
		expect(rules[0].lastFiredAt).not.toBe('');
		const second = await handleAutomationEvent(detail('app.start', { cid: 'local-1' }), { deps, now: Date.now() });
		expect(second.skipped).toEqual([{ ruleId: 'rf', reason: 'cooldown' }]);
		const notices = await listStoreRecords(AI_ANALYSIS_STORES.agentNotices);
		expect(notices.length).toBe(1);
	});
});

describe('A4 引擎 deps 接线', ()=>{
	it('🔴 A4 源码锁:bindAutomationEngine 真的被喂了 selectSource / runBrief / archiveIdleConversations 三件', ()=>{
		// 当前代码为何红:layouts/app.js:66 是**裸调** `bindAutomationEngine();`(:64 那次只在带报告套件的构建里、且只带 exportReportDocx),
		// 于是 actions.js 的三件公共动作 d.selectSource / d.runBrief / d.archiveIdleConversations 恒为 undefined ——
		// 用户建的规则一条也跑不动,只会不停推「动作不可用」通知。
		// 判据同时接受两种修法:三键直接写在 app.js 的调用参数里,或走共享构造器 aiAgent/automation/deps.js。
		const appPath = path.resolve(__dirname, '..', '..', 'layouts', 'app.js');
		const src = fs.readFileSync(appPath, 'utf8');
		const idxs = [];
		for(let i = src.indexOf('bindAutomationEngine('); i >= 0; i = src.indexOf('bindAutomationEngine(', i + 1)){ idxs.push(i); }
		expect(idxs.length).toBeGreaterThan(0);
		const callSites = idxs.map((k)=>src.slice(k, k + 1200)).join('\n');
		let depsSrc = '';
		try{ depsSrc = fs.readFileSync(path.resolve(__dirname, '..', 'aiAgent', 'automation', 'deps.js'), 'utf8'); }catch(e){ depsSrc = ''; }
		if(depsSrc){ expect(callSites).toMatch(/buildDefaultAutomationDeps|automationDeps/); }
		const wired = `${callSites}\n${depsSrc}`;
		['selectSource', 'runBrief', 'archiveIdleConversations'].forEach((k)=>{ expect(wired).toContain(k); });
	});

	it('A4b 判别力:deps 为空时三件公共动作确实全部不可用(这正是裸调造成的现状)', async ()=>{
		const runners = buildActionRunners({});
		expect(await runners['select-source']({}, detail('record.saved', { cid: 'local-1' }))).toEqual({ ok: false, reason: '当前页面不支持切换分析源' });
		expect(await runners['start-brief']({}, detail('task.done', {}))).toEqual({ ok: false, reason: '简报动作不可用' });
		expect(await runners['archive-idle-conversations']({})).toEqual({ ok: false, reason: '归档动作不可用' });
	});
});
