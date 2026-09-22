// 按任务用模型(C4)合同:六槽读写(全空删键/合并/订阅)· resolveRoute 与报告侧同口径(档案缺回落/模型缺回落/同目标 routed:false)·
// roundSlot(行动能力关=终稿;开且未收口=工具轮)· shouldRequestClose(仅终稿≠工具轮且本轮无调用且未收口)· providerOptionsForRoute(同目标原对象;异目标以目标档案为底只带通用键)。
import { MODEL_ROUTES_KEY, ROUTE_SLOTS, readModelRoutes, writeModelRoutes, clearModelRoutes, subscribeModelRoutes, hasAnyRoute, resolveRoute, roundSlot, shouldRequestClose, providerOptionsForRoute, normalizeModelRoutes } from '../aiModelRouting';
import { encodeModelSelection } from '../aiAnalysisProviders';

const pA = { id: 'pa', name: 'A', providerType: 'openai', providerOptions: { max_tokens: 1000, top_p: 0.5 } };
const pB = { id: 'pb', name: 'B', providerType: 'anthropic', providerOptions: { max_tokens: 4000 } };
const profiles = [pA, pB];
const enc = encodeModelSelection;

beforeEach(()=>{ window.localStorage.clear(); });

describe('六槽读写', ()=>{
	it('缺省全空且键不存在;写一槽只存非空;全部清空即删键;订阅收到归一化对象;未知键丢弃', ()=>{
		expect(readModelRoutes()).toEqual({ toolRounds: '', final: '', judge: '', review: '', planner: '', subagent: '' });
		expect(hasAnyRoute(readModelRoutes())).toBe(false);
		const seen = [];
		const off = subscribeModelRoutes((r)=>seen.push(r));
		writeModelRoutes({ final: enc('pb', 'strong'), bogus: 'x' });
		expect(JSON.parse(window.localStorage.getItem(MODEL_ROUTES_KEY))).toEqual({ final: 'pb::strong' });
		expect(readModelRoutes().final).toBe('pb::strong');
		expect(readModelRoutes().bogus).toBeUndefined();
		writeModelRoutes({ final: '' });
		expect(window.localStorage.getItem(MODEL_ROUTES_KEY)).toBe(null);
		writeModelRoutes({ toolRounds: ' pa::cheap ' });
		expect(readModelRoutes().toolRounds).toBe('pa::cheap');
		clearModelRoutes();
		expect(window.localStorage.getItem(MODEL_ROUTES_KEY)).toBe(null);
		off();
		expect(seen.length).toBe(4);
		expect(Object.keys(seen[0]).sort()).toEqual([...ROUTE_SLOTS].sort());
		expect(normalizeModelRoutes('junk')).toEqual({ toolRounds: '', final: '', judge: '', review: '', planner: '', subagent: '' });
	});
});

describe('resolveRoute / roundSlot / shouldRequestClose', ()=>{
	it('空槽回落当前;档案缺回落当前档案;模型缺回落当前模型;同目标 routed:false', ()=>{
		const base = { providerProfiles: profiles, profile: pA, model: 'cheap' };
		expect(resolveRoute('final', { routes: {}, ...base })).toEqual({ profile: pA, model: 'cheap', routed: false, slot: 'final' });
		expect(resolveRoute('final', { routes: { final: enc('pb', 'strong') }, ...base })).toEqual({ profile: pB, model: 'strong', routed: true, slot: 'final' });
		expect(resolveRoute('final', { routes: { final: enc('nope', 'strong') }, ...base }).profile).toBe(pA);
		expect(resolveRoute('final', { routes: { final: enc('pb', '') }, ...base }).model).toBe('cheap');
		expect(resolveRoute('final', { routes: { final: enc('pa', 'cheap') }, ...base }).routed).toBe(false);
	});
	it('🔴 轮槽:总开关关=终稿;开且未收口=工具轮;收口=终稿', ()=>{
		expect(roundSlot({ agentEnabled: false, closing: false })).toBe('final');
		expect(roundSlot({ agentEnabled: true, closing: false })).toBe('toolRounds');
		expect(roundSlot({ agentEnabled: true, closing: true })).toBe('final');
	});
	it('🔴 收口请求:只在(行动能力开·未收口·本轮无调用·终稿目标≠工具轮目标)时为真;全空/同目标/有调用/已收口皆假', ()=>{
		const base = { providerProfiles: profiles, profile: pA, model: 'cheap', agentEnabled: true, closing: false, hadToolCalls: false };
		expect(shouldRequestClose({ ...base, routes: {} })).toBe(false);
		expect(shouldRequestClose({ ...base, routes: { final: enc('pb', 'strong') } })).toBe(true);
		expect(shouldRequestClose({ ...base, routes: { toolRounds: enc('pa', 'cheap'), final: enc('pa', 'cheap') } })).toBe(false);
		expect(shouldRequestClose({ ...base, routes: { toolRounds: enc('pa', 'mini') } })).toBe(true);   // 工具轮 mini,终稿回落当前 cheap ≠ mini
		expect(shouldRequestClose({ ...base, routes: { final: enc('pb', 'strong') }, hadToolCalls: true })).toBe(false);
		expect(shouldRequestClose({ ...base, routes: { final: enc('pb', 'strong') }, closing: true })).toBe(false);
		expect(shouldRequestClose({ ...base, routes: { final: enc('pb', 'strong') }, agentEnabled: false })).toBe(false);
	});
	it('providerOptions:同目标原对象引用;异目标以目标档案为底并只带通用键(temperature/top_p/response_format…),不带 max_tokens 等家族键', ()=>{
		const baseOpts = { temperature: 0.3, top_p: 0.9, max_tokens: 1000, response_format: { type: 'json_object' }, num_ctx: 8192 };
		const same = providerOptionsForRoute({ routed: false, profile: pA, model: 'cheap' }, baseOpts, { profile: pA, model: 'cheap' });
		expect(same).toBe(baseOpts);
		const applied = jest.fn((o)=>({ ...o, thinking: 'applied' }));
		const other = providerOptionsForRoute({ routed: true, profile: pB, model: 'strong' }, baseOpts, { profile: pA, model: 'cheap', thinkingLevel: 'low', applyThinkingLevel: applied });
		expect(other).toEqual({ max_tokens: 4000, thinking: 'applied', temperature: 0.3, top_p: 0.9, response_format: { type: 'json_object' } });
		expect(applied).toHaveBeenCalledWith({ max_tokens: 4000 }, 'low', 'anthropic', 'strong');
		expect(other.num_ctx).toBeUndefined();
	});
});
