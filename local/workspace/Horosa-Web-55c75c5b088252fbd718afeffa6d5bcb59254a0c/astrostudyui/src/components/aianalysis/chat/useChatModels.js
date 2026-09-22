// AI 助手·按任务用模型(C4)页面钩子:AIAnalysisMain 只留 ≤10 行插座——每轮开始前 pickRound(拿本轮档案/模型/providerOptions 并告知 agent),
// 流结束后 afterRound(无调用且终稿≠工具轮 → agent.requestClose 再收口一轮)。六槽全空时 pickRound 原样返回入参(零字节变化)。
import React from 'react';
import { readModelRoutes, subscribeModelRoutes, resolveRoute, roundSlot, shouldRequestClose, providerOptionsForRoute, hasAnyRoute, readRouteOptions, hasAnyRouteOption } from '../../../utils/aiModelRouting';
import { applyThinkingLevel } from '../../../utils/aiAnalysisProviders';

export function useChatModels(deps){
	const depsRef = React.useRef(deps || {});
	depsRef.current = deps || {};
	const [routes, setRoutes] = React.useState(()=>readModelRoutes());
	React.useEffect(()=>subscribeModelRoutes((r)=>setRoutes(r)), []);
	const routesRef = React.useRef(routes);
	routesRef.current = routes;

	// Turn 创建用的工具轮目标(caps 按 档案::模型 记,须与真正发工具的那轮同键)
	const pickTool = React.useCallback(({ profile, model })=>{
		const r = routesRef.current;
		if(!hasAnyRoute(r)){ return { profile, model, routed: false, slot: 'toolRounds' }; }
		return resolveRoute('toolRounds', { routes: r, providerProfiles: depsRef.current.providerProfiles, profile, model });
	}, []);

	// 每轮:按 agent 状态选槽 → 解析目标 → 重建 providerOptions(同目标=原对象)→ 告知 agent 本轮模型
	const pickRound = React.useCallback(({ agent, profile, model, providerOptions, thinkingLevel })=>{
		const r = routesRef.current;
		const agentEnabled = !!(agent && agent.enabled);
		const closing = agentEnabled && typeof agent.isClosing === 'function' ? agent.isClosing() : false;
		const ro = readRouteOptions();   // [批二⑩] 按槽思考档:每轮直接读键(缺省不存在 = 零变化)
		if(!hasAnyRoute(r) && !hasAnyRouteOption(ro)){
			if(agentEnabled && typeof agent.setRoundModel === 'function'){ agent.setRoundModel(model); }
			return { profile, model, providerOptions, routed: false, slot: roundSlot({ agentEnabled, closing }) };
		}
		const route = resolveRoute(roundSlot({ agentEnabled, closing }), { routes: r, providerProfiles: depsRef.current.providerProfiles, profile, model });
		const opts = providerOptionsForRoute(route, providerOptions, { profile, model, thinkingLevel, applyThinkingLevel, routeOptions: ro });
		if(agentEnabled && typeof agent.setRoundModel === 'function'){ agent.setRoundModel(route.model); }
		return { profile: route.profile, model: route.model, providerOptions: opts, routed: route.routed, slot: route.slot };
	}, []);

	// 流结束、settleRound 之前:本轮无调用且终稿目标≠工具轮目标 → 请求再收口一轮(终稿模型作答)
	const afterRound = React.useCallback(({ agent, profile, model })=>{
		const r = routesRef.current;
		if(!agent || !agent.enabled || !hasAnyRoute(r)){ return false; }
		const want = shouldRequestClose({
			routes: r, agentEnabled: true, closing: typeof agent.isClosing === 'function' ? agent.isClosing() : false,
			hadToolCalls: typeof agent.currentCallCount === 'function' ? agent.currentCallCount() > 0 : false,
			providerProfiles: depsRef.current.providerProfiles, profile, model,
		});
		if(want && typeof agent.requestClose === 'function'){ agent.requestClose(); }
		return want;
	}, []);

	return { routes, active: hasAnyRoute(routes), pickTool, pickRound, afterRound };
}
