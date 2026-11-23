// list_zeri_schemes 读各择日页「保存方案 / 最近择时」同一份存储;只读,方案条件树原样回(可复用作 conditions)。
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { setAgentEnabled } from '../aiAgent/prefs';
import { liurengZeriSchemeStore, saveScheme as saveTianxingScheme, pushHistory as pushTianxingHistory } from '../../divination/zeri/schemeStore';

const ctx = { origin: 'mcp', requestId: 'zs' };
beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); setAgentEnabled(true); registerBuiltinTools(); });
afterEach(()=>setAgentEnabled(false));

test('各流派方案:名字 / 条件树 / 口径摘要原样回;最近择时同列', async ()=>{
	const tree = { op: 'all', conditions: [{ type: 'day_ganzhi', params: { gan: '甲' } }] };
	liurengZeriSchemeStore.saveScheme('嫁娶吉日', { cfg: { start: '2026-12-01', end: '2026-12-31', place: '北京' } }, tree);
	liurengZeriSchemeStore.pushHistory({ cfg: { start: '2026-11-01', end: '2026-11-30' } }, tree);
	const r = await runTool('list_zeri_schemes', { school: 'liureng' }, ctx);
	expect(r.ok).toBe(true);
	expect(r.data.schemes.map((s)=>s.name)).toEqual(['嫁娶吉日']);
	expect(r.data.schemes[0].conditions).toEqual(tree);
	expect(r.data.schemes[0].calibre).toEqual(expect.objectContaining({ start: '2026-12-01', place: '北京' }));
	expect(r.data.history.length).toBe(1);
	const noHist = await runTool('list_zeri_schemes', { school: 'liureng', history: false }, ctx);
	expect(noHist.data.history).toBeUndefined();
});

test('天星择日走既有存储;空存储回空数组;不认的流派 schema 拒', async ()=>{
	expect((await runTool('list_zeri_schemes', { school: 'tianxing' }, ctx)).data.schemes).toEqual([]);
	saveTianxingScheme('出行', { start: '2026-12-01' }, { type: 'aspect' });
	pushTianxingHistory({ start: '2026-11-01' }, { type: 'aspect' });
	const r = await runTool('list_zeri_schemes', { school: 'tianxing' }, ctx);
	expect(r.data.schemes[0].name).toBe('出行');
	expect(r.data.history.length).toBe(1);
	expect((await runTool('list_zeri_schemes', { school: 'nope' }, ctx)).ok).toBe(false);
});
