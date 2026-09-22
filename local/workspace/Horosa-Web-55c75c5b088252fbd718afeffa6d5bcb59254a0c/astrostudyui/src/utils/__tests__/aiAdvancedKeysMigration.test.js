// [G8] 进阶页 .v1 键的坏值/旧形/非 JSON 迁移:读端必须回缺省、不抛、不把未知字段带进结果;修一次后重读稳定(幂等)。
import { readContextPolicy, CHAT_CONTEXT_POLICY_KEY } from '../aiChatHistory';
import { readModelRoutes, readRouteOptions, readRouteProfiles, MODEL_ROUTES_KEY, ROUTE_OPTIONS_KEY, ROUTE_PROFILES_KEY } from '../aiModelRouting';
import { readPersona, PERSONA_KEY } from '../aiChat/persona';
import { readPersonaLayers, PERSONA_LAYERS_KEY } from '../aiChat/personaLayers';
import { getAgentApprovalCategories, getExternalPolicy, getToolPolicy, AGENT_APPROVAL_CATEGORIES_KEY, AGENT_EXTERNAL_POLICY_KEY, AGENT_TOOL_POLICY_KEY } from '../aiAgent/prefs';

const READERS = [
	[CHAT_CONTEXT_POLICY_KEY, readContextPolicy],
	[MODEL_ROUTES_KEY, readModelRoutes],
	[ROUTE_OPTIONS_KEY, readRouteOptions],
	[ROUTE_PROFILES_KEY, readRouteProfiles],
	[PERSONA_KEY, readPersona],
	[PERSONA_LAYERS_KEY, readPersonaLayers],
	[AGENT_APPROVAL_CATEGORIES_KEY, getAgentApprovalCategories],
	[AGENT_EXTERNAL_POLICY_KEY, getExternalPolicy],
	[AGENT_TOOL_POLICY_KEY, getToolPolicy],
];
const BAD_VALUES = ['', 'null', '[]', '42', '"str"', '{', '{"__proto__":{"x":1}}', '{"unknownField":1,"nested":{"deep":[1,2,3]}}', 'undefined', ' ', JSON.stringify('x'.repeat(200000))];

beforeEach(()=>{ window.localStorage.clear(); });

it('🔴 九个读端:缺键 ⇒ 缺省对象;坏值/旧形/非 JSON 一律不抛且与缺省同构(键集合相等,未知字段不带入)', ()=>{
	READERS.forEach(([key, read])=>{
		window.localStorage.removeItem(key);
		const dv = read();
		expect(dv && typeof dv === 'object').toBe(true);
		const dvKeys = Object.keys(dv).sort();
		BAD_VALUES.forEach((bad)=>{
			window.localStorage.setItem(key, bad);
			let got;
			expect(()=>{ got = read(); }).not.toThrow();
			expect(got && typeof got === 'object').toBe(true);
			expect(Object.keys(got).sort()).toEqual(dvKeys);
			expect(Object.prototype.hasOwnProperty.call(got, 'unknownField')).toBe(false);
		});
	});
});

it('读端幂等:同一坏值读两次逐字段相等;"null" 与缺键同构', ()=>{
	READERS.forEach(([key, read])=>{
		window.localStorage.setItem(key, '{"bogus":true}');
		expect(JSON.stringify(read())).toBe(JSON.stringify(read()));
		window.localStorage.setItem(key, 'null');
		const a = JSON.stringify(read());
		window.localStorage.removeItem(key);
		expect(JSON.stringify(read())).toBe(a);
	});
});
