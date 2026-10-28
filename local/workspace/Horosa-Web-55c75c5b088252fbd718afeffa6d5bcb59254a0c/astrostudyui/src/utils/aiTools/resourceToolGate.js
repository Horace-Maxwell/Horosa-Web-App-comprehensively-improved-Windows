// AI 助手·资源面与「按工具名禁用」对齐:每类 horosa:// 资源读的是哪几件工具同样读得到的内容。
// 用户禁了其中任一件(如 list_records / cast_technique),该类资源在 resources/list 不列、resources/read 拒、模版与参数补全也不出 ——
// 否则禁了工具,外部客户端换条资源路照样读到同一份内容。纯常量与解析、零数据层依赖(外部桥可静态引入)。
export const RESOURCE_KIND_TOOLS = Object.freeze({
	chart: Object.freeze(['list_records', 'cast_technique']),
	case: Object.freeze(['list_records', 'cast_technique']),
	material: Object.freeze(['search_materials']),
	task: Object.freeze(['list_tasks', 'get_task']),
	help: Object.freeze([]),   // 技法操作手册:公开说明文字,不对应任何可禁的工具
});

// `horosa://chart/local-1` 或模版 `horosa://chart/{cid}` → 'chart';不是本机资源 → null
export function resourceKindOf(uriOrTemplate){
	const m = /^horosa:\/\/([a-z]+)\//.exec(`${uriOrTemplate == null ? '' : uriOrTemplate}`.trim());
	return m ? m[1] : null;
}

// isDenied(name) → 该工具是否被用户按名禁用
export function resourceKindDenied(kind, isDenied){
	if(!kind || typeof isDenied !== 'function'){ return false; }
	const tools = Object.prototype.hasOwnProperty.call(RESOURCE_KIND_TOOLS, kind) ? RESOURCE_KIND_TOOLS[kind] : [];
	return tools.some((n)=>isDenied(n));
}
