// [批二⑩] 按槽思考档合同:键读写(缺省不存在;非法档/非法槽剔除;全空删键;订阅)· providerOptionsForRoute 槽档优先:同目标无槽档=原对象、有槽档=剥旧键再施加、'off'=剥净;异目标按槽档施加 · 路由卡每行有思考下拉且打开不写键。
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { ROUTE_OPTIONS_KEY, ROUTE_SLOTS, readRouteOptions, writeRouteOptions, clearRouteOptions, subscribeRouteOptions, normalizeRouteOptions, hasAnyRouteOption, slotThinking, stripThinkingOptions, providerOptionsForRoute, MODEL_ROUTES_KEY } from '../aiModelRouting';
import { applyThinkingLevel } from '../aiAnalysisProviders';
import ChatModelRoutesPanel from '../../components/aianalysis/chat/ChatModelRoutesPanel';

beforeEach(()=>{ window.localStorage.clear(); });

it('键:缺省不存在;写合法档落键;非法档/非法槽剔除;清槽=删条;全空=删键;订阅', ()=>{
	expect(readRouteOptions()).toEqual({});
	const seen = []; const off = subscribeRouteOptions((ro)=>seen.push(ro));
	writeRouteOptions({ final: { thinking: 'high' }, bogus: { thinking: 'high' }, judge: { thinking: 'nope' } });
	expect(readRouteOptions()).toEqual({ final: { thinking: 'high' } });
	expect(JSON.parse(window.localStorage.getItem(ROUTE_OPTIONS_KEY))).toEqual({ final: { thinking: 'high' } });
	writeRouteOptions({ toolRounds: { thinking: 'custom:8192' } });
	expect(slotThinking(readRouteOptions(), 'toolRounds')).toBe('custom:8192');
	writeRouteOptions({ final: { thinking: '' }, toolRounds: { thinking: '' } });
	expect(window.localStorage.getItem(ROUTE_OPTIONS_KEY)).toBe(null);
	off();
	expect(seen.length).toBe(3);
	expect(normalizeRouteOptions({ final: 'high', review: { thinking: 'off' } })).toEqual({ review: { thinking: 'off' } });
	expect(hasAnyRouteOption({})).toBe(false);
	writeRouteOptions({ review: { thinking: 'low' } }); clearRouteOptions();
	expect(window.localStorage.getItem(ROUTE_OPTIONS_KEY)).toBe(null);
});

it('stripThinkingOptions 剥三家思考键不动其它;generationConfig 只剥 thinkingConfig', ()=>{
	expect(stripThinkingOptions({ temperature: 0.3, thinking: { type: 'enabled', budget_tokens: 2048 }, reasoning_effort: 'high', generationConfig: { thinkingConfig: { thinkingBudget: 1 }, maxOutputTokens: 9 } })).toEqual({ temperature: 0.3, generationConfig: { maxOutputTokens: 9 } });
	expect(stripThinkingOptions({ generationConfig: { thinkingConfig: { thinkingBudget: 1 } } })).toEqual({});
	expect(stripThinkingOptions(undefined)).toEqual({});
});

it('🔴 providerOptionsForRoute:同目标无槽档=原对象(现状);有槽档=剥旧键按槽档施加;off=剥净;异目标按槽档而非全局档', ()=>{
	const pA = { id: 'a', providerType: 'anthropic', providerOptions: { temperature: 0.2 } };
	const pB = { id: 'b', providerType: 'anthropic', providerOptions: { top_p: 0.9 } };
	const base = applyThinkingLevel({ temperature: 0.2 }, 'low', 'anthropic', 'm');
	expect(base.thinking.budget_tokens).toBe(2048);
	const unrouted = { routed: false, profile: pA, model: 'm', slot: 'final' };
	expect(providerOptionsForRoute(unrouted, base, { profile: pA, model: 'm', thinkingLevel: 'low', applyThinkingLevel, routeOptions: {} })).toBe(base);
	expect(providerOptionsForRoute(unrouted, base, { profile: pA, model: 'm', thinkingLevel: 'low', applyThinkingLevel })).toBe(base);
	const hi = providerOptionsForRoute(unrouted, base, { profile: pA, model: 'm', thinkingLevel: 'low', applyThinkingLevel, routeOptions: { final: { thinking: 'high' } } });
	expect(hi.thinking.budget_tokens).toBe(16000);
	expect(hi.temperature).toBe(0.2);
	expect(base.thinking.budget_tokens).toBe(2048);   // 不改原对象
	const offd = providerOptionsForRoute(unrouted, base, { profile: pA, model: 'm', thinkingLevel: 'low', applyThinkingLevel, routeOptions: { final: { thinking: 'off' } } });
	expect(offd).toEqual({ temperature: 0.2 });
	// 别的槽设了档,本槽不受影响
	expect(providerOptionsForRoute(unrouted, base, { profile: pA, model: 'm', thinkingLevel: 'low', applyThinkingLevel, routeOptions: { judge: { thinking: 'high' } } })).toBe(base);
	// 异目标:全局 low,槽档 max → 目标档案为底施加 max(封顶 32768),并带通用键
	const routed = { routed: true, profile: pB, model: 'strong', slot: 'final' };
	const r1 = providerOptionsForRoute(routed, base, { profile: pA, model: 'm', thinkingLevel: 'low', applyThinkingLevel, routeOptions: { final: { thinking: 'max' } } });
	expect(r1.thinking.budget_tokens).toBe(32768);
	expect(r1.top_p).toBe(0.9);
	expect(r1.temperature).toBe(0.2);
	const r0 = providerOptionsForRoute(routed, base, { profile: pA, model: 'm', thinkingLevel: 'low', applyThinkingLevel, routeOptions: {} });
	expect(r0.thinking.budget_tokens).toBe(2048);
});

describe('路由卡', ()=>{
	let host;
	beforeEach(()=>{ host = document.createElement('div'); document.body.appendChild(host); });
	afterEach(()=>{ act(()=>{ ReactDOM.unmountComponentAtNode(host); }); host.remove(); });
	it('每槽一只思考下拉;打开不写两把键;只设思考档也算「已设置」;全部清空同时清两键', ()=>{
		act(()=>{ ReactDOM.render(<ChatModelRoutesPanel providerProfiles={[{ id: 'a', name: 'A', providerType: 'openai', models: ['m1'] }]} />, host); });
		expect(host.querySelectorAll('[data-route-thinking]').length).toBe(ROUTE_SLOTS.length);
		expect(host.querySelector('[data-model-routes-panel]').getAttribute('data-active')).toBe('0');
		expect(window.localStorage.getItem(ROUTE_OPTIONS_KEY)).toBe(null);
		expect(window.localStorage.getItem(MODEL_ROUTES_KEY)).toBe(null);
		act(()=>{ writeRouteOptions({ final: { thinking: 'high' } }); });
		expect(host.querySelector('[data-model-routes-panel]').getAttribute('data-active')).toBe('1');
		const clear = host.querySelector('[data-model-routes-clear="1"]');
		act(()=>{ clear.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
		expect(window.localStorage.getItem(ROUTE_OPTIONS_KEY)).toBe(null);
		expect(host.querySelector('[data-model-routes-panel]').getAttribute('data-active')).toBe('0');
	});
});
