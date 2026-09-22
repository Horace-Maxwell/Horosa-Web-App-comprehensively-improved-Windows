// [进阶审计 D6] 跨窗口同步合同:进阶页六类订阅(模型路由/槽参数/具名方案/口径/口径分层/上下文策略)此前只听本窗 CustomEvent,
// 第二个窗口改了键,本窗口的卡片与胶囊永远陈旧(端到端用例 S155 双窗口实抓)。现在同时听 storage 事件(只在别的窗口写入时触发;key 为空=整库被清)。
import { subscribeModelRoutes, subscribeRouteOptions, subscribeRouteProfiles, MODEL_ROUTES_KEY, ROUTE_OPTIONS_KEY, ROUTE_PROFILES_KEY } from '../aiModelRouting';
import { subscribePersona, PERSONA_KEY } from '../aiChat/persona';
import { subscribePersonaLayers, PERSONA_LAYERS_KEY } from '../aiChat/personaLayers';
import { subscribeContextPolicy, CHAT_CONTEXT_POLICY_KEY } from '../aiChatHistory';

const fire = (key)=>window.dispatchEvent(new window.StorageEvent('storage', { key }));
const CASES = [
	['subscribeModelRoutes', subscribeModelRoutes, MODEL_ROUTES_KEY, ()=>window.localStorage.setItem(MODEL_ROUTES_KEY, JSON.stringify({ final: 'p1::m1' })), (v)=>v.final === 'p1::m1'],
	['subscribeRouteOptions', subscribeRouteOptions, ROUTE_OPTIONS_KEY, ()=>window.localStorage.setItem(ROUTE_OPTIONS_KEY, JSON.stringify({ judge: { maxTokens: 321 } })), (v)=>v.judge && v.judge.maxTokens === 321],
	['subscribeRouteProfiles', subscribeRouteProfiles, ROUTE_PROFILES_KEY, ()=>window.localStorage.setItem(ROUTE_PROFILES_KEY, JSON.stringify({ profiles: { 甲: { routes: {}, routeOptions: {} } }, active: '甲' })), (v)=>v.active === '甲'],
	['subscribePersona', subscribePersona, PERSONA_KEY, ()=>window.localStorage.setItem(PERSONA_KEY, JSON.stringify({ text: '跨窗口径', enabled: true })), (v)=>v.text === '跨窗口径' && v.enabled === true],
	['subscribePersonaLayers', subscribePersonaLayers, PERSONA_LAYERS_KEY, ()=>window.localStorage.setItem(PERSONA_LAYERS_KEY, JSON.stringify({ bySubject: { c1: '层' }, byTechnique: {} })), (v)=>v.bySubject && v.bySubject.c1 === '层'],
	['subscribeContextPolicy', subscribeContextPolicy, CHAT_CONTEXT_POLICY_KEY, ()=>window.localStorage.setItem(CHAT_CONTEXT_POLICY_KEY, JSON.stringify({ historyMode: 'legacy' })), (v)=>v.historyMode === 'legacy'],
];

describe('[D6] 进阶页订阅听跨窗口 storage 事件', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); });
	afterEach(()=>{ window.localStorage.clear(); });
	test.each(CASES)('🔴 %s:本键的 storage 事件 → 回调收到重读值;无关键不触发;key=null(整库清空)触发;退订后不再触发', (name, subscribe, key, write, check)=>{
		const got = [];
		const off = subscribe((v)=>got.push(v));
		write();                       // 模拟另一窗口写入(本窗不会有 CustomEvent)
		fire('horosa.some.other.key');
		expect(got.length).toBe(0);
		fire(key);
		expect(got.length).toBe(1);
		expect(check(got[0])).toBe(true);
		fire(null);
		expect(got.length).toBe(2);
		off();
		fire(key);
		expect(got.length).toBe(2);
	});
});
