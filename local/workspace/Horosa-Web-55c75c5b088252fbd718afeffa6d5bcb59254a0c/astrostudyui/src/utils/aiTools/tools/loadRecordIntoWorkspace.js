import { getLocalChart } from '../../localcharts';
import { getLocalCase } from '../../localcases';
import { ctxDispatch, ctxUi, GUIDE } from './_shared';
import { pushUiTrail, undoUiTrail } from '../../aiAgent/uiTrail';
import { spotlight } from '../../aiAgent/agentSpotlight';
import { getWorkspaceUi } from '../workspaceBridge';

export default {
	name: 'load_record_into_workspace',
	level: 'additive',
	category: 'workspace',
	undoKind: 'none',
	referenceKeys: ['cid'],   // 引用已存记录(不写库);守卫层显式放行,目录合同锁定只此一件
	description: `把某条已存命盘/事盘载入当前技法工作区(相当于用户在列表里点它),不改任何存档;可选 technique/subTab:载入后顺带切到该技法页(动作条可回到上一页)。${GUIDE}:仅当用户说「打开/载入/切到这张盘」时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['cid'], properties: { cid: { type: 'string', pattern: '^local-' }, technique: { type: 'string', minLength: 1, maxLength: 32, pattern: '^[a-zA-Z][a-zA-Z0-9_-]{0,31}$', description: '载入后切到的技法页键(取自 get_current_context.routes[].key);缺省不切页' }, subTab: { type: 'string', minLength: 1, maxLength: 32, pattern: '^[a-zA-Z][a-zA-Z0-9_-]{0,31}$' } } },
	// [D78] 写前预览:唯一 undoKind none 的写入工具此前没有 preview,每次确认下用户看不到「当前是谁 → 要载入谁」
	preview(args){
		const chart = getLocalChart(args.cid);
		const kase = chart ? null : getLocalCase(args.cid);
		if(!chart && !kase){ return null; }
		const target = chart ? `命盘「${chart.name}」` : `事盘「${kase.event}」`;
		let current = '当前工作区';
		try{
			const ui = getWorkspaceUi();
			const cur = ui && typeof ui.getSelectedSource === 'function' ? ui.getSelectedSource() : null;
			if(cur && cur.title){ current = `当前:${`${cur.title}`.slice(0, 60)}`; }
		}catch(e){ /* noop: 预览只是辅助,读不到当前源就写通用文案 */ }
		return { title: `载入工作区:${target}`, before: `${current}(不落盘,再载入别的档即等于撤销)`, after: `载入${target}${args.technique ? `,并切到 ${args.technique}${args.subTab ? `/${args.subTab}` : ''}` : ''}` };
	},
	async run(args, ctx){
		const dispatch = ctxDispatch(ctx);
		if(!dispatch){ return { ok: false, code: 'E_BRIDGE_UNAVAILABLE', message: '页面尚未就绪' }; }
		// 单条 O(1) 查找(含归档,等价 includeArchived);展开拷贝后派发,不动内核共享引用
		// [批五] 载入即跳:technique 给了就经导航桥切页(与 navigate_to_technique 同一条路,记轨迹可回退;桥缺席/键非法只提示不算失败——载入本身已完成)
		const nav = (label)=>{
			if(!args.technique){ return { navigated: false }; }
			const ui = ctxUi(ctx);
			if(typeof ui.navigate !== 'function' || typeof ui.currentRoute !== 'function'){ return { navigated: false, navNote: '导航桥未就绪,只载入未切页' }; }
			const routes = typeof ui.listRoutes === 'function' ? (ui.listRoutes() || []) : [];
			if(routes.length && !routes.some((r)=>r && r.key === args.technique)){ return { navigated: false, navNote: `没有技法页 ${args.technique},只载入未切页` }; }
			const before = ui.currentRoute() || {};
			if(before.tab === args.technique && (!args.subTab || before.subTab === args.subTab)){ return { navigated: true, tab: args.technique, changed: false }; }
			const r = ui.navigate(args.technique, args.subTab || undefined);
			if(!r || r.ok === false){ return { navigated: false, navNote: (r && r.message) || '切页失败' }; }
			const hit = routes.find((x)=>x && x.key === args.technique);
			const tabLabel = hit && hit.label ? `${hit.label}` : args.technique;
			const turnId = `${(ctx && ctx.requestId) || ''}`.split(':')[0];
			const trailId = pushUiTrail({ kind: 'route', turnId, label: `载入${label}并切到${tabLabel}`, before: { tab: before.tab || null, subTab: before.subTab || null }, after: { tab: args.technique, subTab: r.subTab || args.subTab || null }, undo: ()=>(before.tab ? ui.navigate(before.tab, before.subTab || undefined) : { ok: false, message: '没有上一页' }) });
			spotlight({ selector: '#mainContent', label: `AI 已载入${label}并切到${tabLabel}`, undo: ()=>undoUiTrail(trailId) });
			return { navigated: true, tab: args.technique, changed: true, trailId };
		};
		const chart = getLocalChart(args.cid);
		if(chart){
			dispatch({ type: 'user/setCurrentChart', payload: { ...chart } });
			const n = nav(`命盘「${chart.name}」`);
			return { ok: true, data: { cid: args.cid, kind: 'chart', loaded: true, ...n }, message: `已载入命盘「${chart.name}」${n.navigated ? `,已切到 ${n.tab}` : (n.navNote ? `(${n.navNote})` : '')}`, summary: `载入命盘 ${chart.name}${n.navigated && n.changed ? ` → ${n.tab}` : ''}`, undo: { kind: 'none' } };
		}
		const kase = getLocalCase(args.cid);
		if(kase){
			dispatch({ type: 'user/applyCase', payload: { ...kase } });
			dispatch({ type: 'astro/closeDrawer', payload: {} });
			const n = nav(`事盘「${kase.event}」`);
			return { ok: true, data: { cid: args.cid, kind: 'case', loaded: true, ...n }, message: `已载入事盘「${kase.event}」${n.navigated ? `,已切到 ${n.tab}` : (n.navNote ? `(${n.navNote})` : '')}`, summary: `载入事盘 ${kase.event}${n.navigated && n.changed ? ` → ${n.tab}` : ''}`, undo: { kind: 'none' } };
		}
		return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `未找到记录 ${args.cid}` };
	},
};
