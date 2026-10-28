// 择日载入存案「载回所见」:存案记下所见那张盘(zeri.plotted);载回时按还原后的工作台重建的底板与它逐键比,
// 不同的并进覆盖层再重排。场景:点选 / 起盘之后在工作台改了地点却没重排就存 —— 底板与所见那张盘不同,
// 此前载回按工作台 + 覆盖层重排,盘的地点是工作台改过的那个,与存案时屏幕上那张、与快照都对不上。
import { setGlobalStore } from '../../../utils/storageutil';
import { buildZeriCasePayload, plottedOverlayDiff, restoreZeriWorkbenchFromCase } from '../zeriCaseRestore';

jest.mock('../../../services/astro', () => ({ fetchChart: jest.fn(async () => ({ Result: null })) }));

const HOSTS = [
	['八字择日', ()=>require('../BaziZeriMain').default, 'bazizeri', 'baziHook'],
	['紫微择日', ()=>require('../ZiweiZeriMain').default, 'ziweizeri', 'ziweiHook'],
	['七政择日', ()=>require('../QizhengZeriMain').default, 'qizhengzeri', 'qizhengHook'],
	['印度择日', ()=>require('../IndiaZeriMain').default, 'indiazeri', 'indiaHook'],
];
const TOKYO = { zone: '+09:00', lon: '139e45', lat: '35n40', gpsLon: 139.75, gpsLat: 35.67, ad: 1, pos: '东京' };

function mkHost(Cls, hookName){
	const h = new Cls({ dispatch: jest.fn() });
	h.setState = function(p, cb){ const patch = typeof p === 'function' ? p(this.state) : p; if(patch){ this.state = { ...this.state, ...patch }; } if(cb){ cb(); } };
	h.plots = [];
	h[hookName].fun = (f)=>{ h.plots.push(f); };
	return h;
}
const fv = (f, k)=>(f && f[k] ? f[k].value : undefined);

afterEach(()=>{ setGlobalStore({}); });

describe.each(HOSTS)('%s', (_n, load, scope, hookName)=>{
	test('🔴 工作台地点改了未重排就存 → 载回盘的地点 = 所见那张盘(存案记录的地点)', ()=>{
		const Cls = load();
		const h = mkHost(Cls, hookName);
		const seen = h.buildFields(false);   // 所见那张盘:工作台缺省地点
		expect(fv(seen, 'pos')).not.toBe('东京');
		h[hookName].getPlottedFields = ()=>seen;
		h.state.geo = { ...TOKYO };           // 工作台改了地点,没重排
		const zeri = buildZeriCasePayload(h, seen);
		expect(zeri.plotted).toBeTruthy();
		expect(zeri.geo.pos).toBe('东京');    // 工作台存的是改过的
		// 载回:新开的宿主,显式载入这条
		setGlobalStore({ user: { caseApplySeq: 1, appliedCaseCid: 'zp-1', currentCase: {
			cid: { value: 'zp-1' }, updateTime: { value: 't' }, caseType: { value: scope }, sourceModule: { value: scope },
			payload: { value: JSON.stringify({ module: scope, zeri }) } } } });
		const h2 = mkHost(Cls, hookName);
		h2.replotAfterRestore = function(){ this[hookName].fun(this.buildFields(false)); };
		expect(restoreZeriWorkbenchFromCase(h2, scope)).toBe(true);
		expect(h2.state.geo.pos).toBe('东京');   // 工作台照存案
		const last = h2.plots[h2.plots.length - 1];
		['lon', 'lat', 'pos', 'zone'].forEach((k)=>{ expect([k, fv(last, k)]).toEqual([k, fv(seen, k)]); });
		// 差异进了覆盖层(左栏「回到工作台」一键可清)
		expect(fv(h2.state.embedPatch, 'pos')).toBe(fv(seen, 'pos'));
	});
	test('底板与所见相同:覆盖层不添键;旧存案没有 plotted:照旧按工作台', ()=>{
		const Cls = load();
		const h = mkHost(Cls, hookName);
		const seen = h.buildFields(false);
		expect(plottedOverlayDiff(h, buildZeriCasePayload(h, seen).plotted)).toBe(null);
		expect(plottedOverlayDiff(h, undefined)).toBe(null);
		const z = buildZeriCasePayload(h, null);
		expect(z.plotted).toBeUndefined();
	});
});
