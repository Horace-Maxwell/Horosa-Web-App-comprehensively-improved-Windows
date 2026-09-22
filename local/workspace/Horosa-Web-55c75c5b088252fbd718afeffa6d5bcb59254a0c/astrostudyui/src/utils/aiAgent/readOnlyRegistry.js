// AI 助手·只读注册表视图(单源;[D79] 此前 orchestrator.js 与 aiTools/tools/runAnalysis.js 各有一份同名不同实现):
// manifest 只露 read 级;取/跑 additive 一律拒(复用 E_APPROVAL_DENIED,不新增码);opts.exclude 剔除自身名(无头分析不能再调自己);
// opts.origin 强制来源(无头出口固定 mcp);opts.denyMessage(串或 (name)=>串)沿用各消费方文案。运行时 createAgentTurn({ registry }) 直接吃。
export function readOnlyRegistryView(registry, opts){
	const reg = registry || {};
	const o = opts || {};
	const exclude = Array.isArray(o.exclude) ? o.exclude : [];
	// [Q-294/AR-29 裁决 2026-09-18] 无头 / 只读视图额外排除 category 'ui'(切换技法页、合盘配对等界面动作):外部发起的无人值守分析不得动界面;o.allowUi=true 才保留
	const okDef = (d)=>!!(d && d.level === 'read' && exclude.indexOf(d.name) < 0 && (o.allowUi === true || d.category !== 'ui'));
	const readDef = (name)=>{ const d = typeof reg.getTool === 'function' ? reg.getTool(name) : null; return okDef(d) ? d : null; };
	const deny = (name)=>(typeof o.denyMessage === 'function' ? o.denyMessage(name) : (o.denyMessage || `只读视图:拒绝执行 ${name}`));
	return {
		readOnly: true,
		exportToolManifest(mo){
			const merged = { ...(mo || {}), ...(o.origin ? { includeExternal: false, origin: o.origin } : {}) };
			const list = typeof reg.exportToolManifest === 'function' ? (reg.exportToolManifest(merged) || []) : [];
			return list.filter((t)=>t && readDef(t.name));
		},
		getTool(name){ return readDef(name); },
		async runTool(name, args, ctx){
			if(!readDef(name)){ return { ok: false, code: 'E_APPROVAL_DENIED', message: deny(name) }; }
			return reg.runTool(name, args, o.origin ? { ...(ctx || {}), origin: o.origin } : ctx);
		},
	};
}
