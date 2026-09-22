// [批五] 界面动作:切到某个技法页(等于用户点主导航)。read 级 + ui 类别:不落盘、不改数据,自动执行但可见可回退——
// 每次切页记进会话内轨迹(动作条「回到上一页」)+ 目标区域闪一圈金边;同一页不重复切;只对 in-app / mcp 开放(目标任务/自动化/定时任务无人看屏,永不导航)。
import { ctxUi, GUIDE } from './_shared';
import { pushUiTrail, undoUiTrail } from '../../aiAgent/uiTrail';
import { spotlight } from '../../aiAgent/agentSpotlight';

const KEY_RE = '^[a-zA-Z][a-zA-Z0-9_-]{0,31}$';

export function routeLabel(routes, key){
	const hit = (routes || []).find((r)=>r && r.key === key);
	return hit && hit.label ? `${hit.label}` : `${key}`;
}

export default {
	name: 'navigate_to_technique',
	level: 'read',
	category: 'ui',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	description: `切换到某个技法页(等于用户点主导航),可带子页签;不改任何数据,动作条可一键回到上一页。${GUIDE}:仅当用户说「打开/切到/去看 X 页」时调用;技法页键先看 get_current_context 的 routes。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['technique'],
		properties: {
			technique: { type: 'string', minLength: 1, maxLength: 32, pattern: KEY_RE, description: '技法页键(取自 get_current_context.routes[].key,如 bazi / ziwei / astrochart / aianalysis)' },
			subTab: { type: 'string', minLength: 1, maxLength: 32, pattern: KEY_RE, description: '子页签键(可选;仅聚合页有)' },
		},
	},
	async run(args, ctx){
		const ui = ctxUi(ctx);
		if(typeof ui.navigate !== 'function' || typeof ui.currentRoute !== 'function'){ return { ok: false, code: 'E_BRIDGE_UNAVAILABLE', message: '页面尚未就绪(导航桥未登记)' }; }
		const routes = typeof ui.listRoutes === 'function' ? (ui.listRoutes() || []) : [];
		if(routes.length && !routes.some((r)=>r && r.key === args.technique)){
			return { ok: false, code: 'E_ARGS_INVALID', message: `没有这个技法页:${args.technique};可用:${routes.map((r)=>r.key).join(' ')}` };
		}
		const label = routeLabel(routes, args.technique);
		const before = ui.currentRoute() || {};
		if(before.tab === args.technique && (!args.subTab || before.subTab === args.subTab)){
			return { ok: true, data: { tab: args.technique, subTab: before.subTab || null, changed: false }, summary: `已在${label}`, message: '已经在该页,无需切换' };
		}
		const r = ui.navigate(args.technique, args.subTab || undefined);
		if(!r || r.ok === false){ return { ok: false, code: 'E_ARGS_INVALID', message: (r && r.message) || '切换失败' }; }
		const turnId = `${(ctx && ctx.requestId) || ''}`.split(':')[0];
		const trailId = pushUiTrail({ kind: 'route', turnId, label: `已切到${label}`, before: { tab: before.tab || null, subTab: before.subTab || null }, after: { tab: args.technique, subTab: r.subTab || args.subTab || null },
			undo: ()=>(before.tab ? ui.navigate(before.tab, before.subTab || undefined) : { ok: false, message: '没有上一页' }) });
		spotlight({ selector: '#mainContent', label: `AI 已切到${label}`, undo: ()=>undoUiTrail(trailId) });
		return { ok: true, data: { tab: args.technique, subTab: r.subTab || args.subTab || null, changed: true, trailId }, summary: `切到${label}`, message: `已切到${label}(动作条可回到上一页)` };
	},
};
