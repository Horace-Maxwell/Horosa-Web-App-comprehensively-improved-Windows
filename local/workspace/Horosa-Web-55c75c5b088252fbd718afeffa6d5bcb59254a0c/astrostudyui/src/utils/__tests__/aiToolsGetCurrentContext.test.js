// [批五] 四断链之①:get_current_context 的 analysisSource 此前恒 null——生产从未登记过工作区 ui 面。
// 本文件是行为锁(不是源码 grep):无登记 → null;登记 → 读到当前源与路由;本 Turn 传入的 ui 覆盖登记;注销只删自己的键;等待就绪。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, registerWorkspaceUi, getWorkspaceUi, waitForWorkspaceUi, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';

const ctx = (extra)=>({ origin: 'in-app', requestId: 't1:0:c1', dispatch: jest.fn(), ...(extra || {}) });

beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); __resetWorkspaceBridgeForTests(); registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() }); registerBuiltinTools(); });

describe('get_current_context × 工作区 ui 面', ()=>{
	it('🔴 无登记:analysisSource 为 null、route 为 null、routes 为空(这正是修前生产的恒态)', async ()=>{
		const r = await runTool('get_current_context', {}, ctx());
		expect(r.ok).toBe(true);
		expect(r.data.analysisSource).toBe(null);
		expect(r.data.route).toBe(null);
		expect(r.data.routes).toEqual([]);
	});
	it('🔴 登记后:读到当前源与路由;注销后回 null', async ()=>{
		const off = registerWorkspaceUi({
			getSelectedSource: ()=>({ id: 'local-1', sourceType: 'chart', title: '张三', module: 'astrochart' }),
			currentRoute: ()=>({ tab: 'bazi', subTab: null }),
			listRoutes: ()=>[{ key: 'bazi', label: '八字' }, { key: 'ziwei', label: '紫微' }],
		});
		const r = await runTool('get_current_context', {}, ctx());
		expect(r.data.analysisSource.title).toBe('张三');
		expect(r.data.route).toEqual({ tab: 'bazi', subTab: null });
		expect(r.data.routes.map((x)=>x.key)).toEqual(['bazi', 'ziwei']);
		off();
		const r2 = await runTool('get_current_context', {}, ctx());
		expect(r2.data.analysisSource).toBe(null);
		expect(r2.data.routes).toEqual([]);
	});
	it('本 Turn 传入的 ctx.ui 覆盖登记的同名键(页面回调优先)', async ()=>{
		registerWorkspaceUi({ getSelectedSource: ()=>({ id: 'local-1', title: '登记的' }) });
		const r = await runTool('get_current_context', {}, ctx({ ui: { getSelectedSource: ()=>({ id: 'local-2', title: '本轮的' }) } }));
		expect(r.data.analysisSource.title).toBe('本轮的');
	});
	it('registerWorkspaceUi:注销只删自己登记且引用未变的键;后来者覆盖的键不被误删', ()=>{
		const f1 = ()=>1; const f2 = ()=>2; const g = ()=>3;
		const off1 = registerWorkspaceUi({ selectSource: f1, refreshSources: g });
		registerWorkspaceUi({ selectSource: f2 });
		off1();
		expect(getWorkspaceUi().selectSource).toBe(f2);
		expect(getWorkspaceUi().refreshSources).toBe(undefined);
	});
	it('waitForWorkspaceUi:已就绪立即回;未就绪等事件;超时回 null', async ()=>{
		registerWorkspaceUi({ relative: { setPair: ()=>({ ok: true }) } });
		expect(typeof (await waitForWorkspaceUi('relative', 50)).setPair).toBe('function');
		__resetWorkspaceBridgeForTests();
		const p = waitForWorkspaceUi('relative', 500);
		setTimeout(()=>registerWorkspaceUi({ relative: { setPair: ()=>({ ok: true }) } }), 20);
		expect(typeof (await p).setPair).toBe('function');
		__resetWorkspaceBridgeForTests();
		expect(await waitForWorkspaceUi('relative', 30)).toBe(null);
	});
});
