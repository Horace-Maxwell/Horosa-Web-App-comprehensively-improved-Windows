// [批五] 四断链之②:自动化规则「设为当前分析源」此前恒抛(deps 读 bridge.ui,而生产从未登记)——以前的回归锁只是源码 grep(假锁)。
// 行为锁:未登记 → reject 且信息告诉用户先打开 AI 分析页;登记后 → 先刷源再选源;引擎级:record.saved 规则真选源、零「不可用」通知。
import { buildDefaultAutomationDeps } from '../aiAgent/automation/deps';
import { registerWorkspaceUi, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { emitAutomationEvent, __resetAutomationEventsForTests } from '../aiAgent/automation/events';
import { bindAutomationEngine, __resetAutomationEngineForTests } from '../aiAgent/automation/engine';
import { saveRule } from '../aiAgent/automation/ruleStore';
import { setAutomationEnabled } from '../aiAgent/prefs';
import { AI_ANALYSIS_STORES, clearStore, listStoreRecords } from '../aiAnalysisStore';

const tick = ()=>new Promise((r)=>setTimeout(r, 0));
async function settle(n){ for(let i = 0; i < n; i++){ await tick(); } }   // eslint-disable-line no-await-in-loop

beforeEach(async ()=>{ window.localStorage.clear(); __resetWorkspaceBridgeForTests(); __resetAutomationEventsForTests(); __resetAutomationEngineForTests(); await clearStore(AI_ANALYSIS_STORES.automationRules); await clearStore(AI_ANALYSIS_STORES.agentNotices); });
afterEach(()=>{ __resetAutomationEngineForTests(); __resetAutomationEventsForTests(); });

describe('自动化 deps.selectSource', ()=>{
	it('🔴 未登记 ui 面 → reject,信息含「先打开 AI 分析页」', async ()=>{
		const deps = buildDefaultAutomationDeps();
		await expect(deps.selectSource('local-1')).rejects.toThrow('先打开 AI 分析页');
	});
	it('🔴 登记后 → resolve true;refreshSources 先于 selectSource', async ()=>{
		const order = [];
		registerWorkspaceUi({ refreshSources: ()=>order.push('refresh'), selectSource: (cid)=>order.push(`select:${cid}`) });
		const deps = buildDefaultAutomationDeps();
		expect(await deps.selectSource('local-9')).toBe(true);
		expect(order).toEqual(['refresh', 'select:local-9']);
	});
	it('🔴 引擎级:record.saved → select-source 规则真选源,零「不可用」通知', async ()=>{
		const selected = [];
		registerWorkspaceUi({ refreshSources: ()=>{}, selectSource: (cid)=>selected.push(cid) });
		setAutomationEnabled(true);
		await saveRule({ id: 'r-sel', name: '存档即选中', event: 'record.saved', enabled: true, actions: [{ type: 'select-source' }], cooldownMs: 0 });
		bindAutomationEngine(buildDefaultAutomationDeps());
		emitAutomationEvent('record.saved', { kind: 'chart', cid: 'local-77' });
		await settle(50);
		expect(selected).toEqual(['local-77']);
		const notices = await listStoreRecords(AI_ANALYSIS_STORES.agentNotices);
		expect(notices.filter((n)=>`${n.title || ''}${n.body || ''}`.indexOf('不可用') >= 0).length).toBe(0);
	});
});
