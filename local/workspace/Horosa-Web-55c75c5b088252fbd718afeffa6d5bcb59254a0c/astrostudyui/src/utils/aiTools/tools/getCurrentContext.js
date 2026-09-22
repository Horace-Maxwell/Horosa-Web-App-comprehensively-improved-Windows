import { getLocalChartsStoreHealth, listLocalCharts } from '../../localcharts';
import { getLocalCasesStoreHealth, listLocalCases } from '../../localcases';
import { listActions } from '../ledger';
import { CHART_FACET_KEYS } from '../settingsFacets';
import { ctxStore, ctxUi, GUIDE } from './_shared';

function fv(fields, k){ return fields && fields[k] ? fields[k].value : undefined; }
function fmt(v, f){ try{ return v && typeof v.format === 'function' ? v.format(f) : (v === undefined ? undefined : `${v}`); }catch(e){ return `${v}`; } }

export default {
	name: 'get_current_context',
	level: 'read',
	category: 'workspace',
	undoKind: 'none',
	description: `读取当前工作区状态(当前技法页与可导航的技法页表 routes、当前盘的时间/地点/口径、当前事盘、AI 分析页选中的源、存储健康、最近助手动作)。回答「现在这张盘…」类问题前先调用。${GUIDE}。`,
	inputSchema: { type: 'object', additionalProperties: false, properties: {} },
	async run(args, ctx){
		const store = ctxStore(ctx);
		const astro = store.astro || {};
		const user = store.user || {};
		const fields = astro.fields || {};
		const workspaceChart = { cid: user.currentChart && user.currentChart.cid ? user.currentChart.cid.value : undefined, name: fv(fields, 'name'), birth: [fmt(fv(fields, 'date'), 'YYYY-MM-DD'), fmt(fv(fields, 'time'), 'HH:mm:ss')].filter(Boolean).join(' '), zone: fv(fields, 'zone'), lat: fv(fields, 'lat'), lon: fv(fields, 'lon'), pos: fv(fields, 'pos'), gender: fv(fields, 'gender') };
		CHART_FACET_KEYS.forEach((k)=>{ workspaceChart[k] = fv(fields, k); });
		const cc = user.currentCase || null;
		const currentCase = cc ? { cid: cc.cid && cc.cid.value !== undefined ? cc.cid.value : cc.cid, event: cc.event && cc.event.value !== undefined ? cc.event.value : cc.event, caseType: cc.caseType && cc.caseType.value !== undefined ? cc.caseType.value : cc.caseType } : null;
		const ui = ctxUi(ctx);
		let analysisSource = null;
		try{ analysisSource = typeof ui.getSelectedSource === 'function' ? ui.getSelectedSource() : null; }catch(e){ analysisSource = null; }
		// [批五] 当前路由与可导航的技法页表(navigate_to_technique 的键值域;页面未登记桥时为 null / [])
		let route = null; let routes = [];
		try{ route = typeof ui.currentRoute === 'function' ? (ui.currentRoute() || null) : null; }catch(e){ route = null; }
		try{ routes = typeof ui.listRoutes === 'function' ? (ui.listRoutes() || []) : []; }catch(e){ routes = []; }
		return {
			ok: true,
			data: {
				currentTab: astro.currentTab, currentSubTab: astro.currentSubTab,
				workspaceChart, currentCase, analysisSource, route, routes,
				storeHealth: { charts: getLocalChartsStoreHealth(), cases: getLocalCasesStoreHealth() },
				counts: { charts: listLocalCharts({}).length, cases: listLocalCases({}).length },
				recentActions: listActions(5).map((a)=>({ actionId: a.id, tool: a.tool, summary: a.summary, undone: !!a.undone, at: a.at })),
			},
			summary: '当前工作区状态',
		};
	},
};
