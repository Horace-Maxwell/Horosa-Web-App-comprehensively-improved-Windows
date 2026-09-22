// [批五] 界面动作:把两张已存命盘送进合盘页配对(比较盘/组合盘/影响盘/时空中点盘/马克斯盘/评分)。read 级 + ui 类别:
// 不落盘;经导航桥切到合盘页 → 等合盘页登记自己的 ui.relative 面(首次挂载有加载时间,最多等 3s)→ 配对。轨迹可回到上一对。
import { getLocalChart } from '../../localcharts';
import { ctxUi, GUIDE } from './_shared';
import { waitForWorkspaceUi } from '../workspaceBridge';
import { pushUiTrail, undoUiTrail } from '../../aiAgent/uiTrail';
import { spotlight } from '../../aiAgent/agentSpotlight';

export const RELATIVE_MODES = ['Comp', 'Composite', 'Synastry', 'TimeSpace', 'Marks', 'Score'];
export const RELATIVE_WAIT_MS = 3000;

export default {
	name: 'compare_records',
	level: 'read',
	category: 'ui',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	description: `把两张已存命盘送进「合盘」页配对并切到该页(不改任何存档;动作条可回到上一对)。${GUIDE}:仅当用户说「把 A 和 B 合盘 / 比较盘 / 组合盘」时调用;记录 id 先用 list_records 取。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['recordA', 'recordB'],
		properties: {
			recordA: { type: 'string', pattern: '^local-', description: '命盘 A 的记录 id' },
			recordB: { type: 'string', pattern: '^local-', description: '命盘 B 的记录 id' },
			mode: { type: 'string', enum: RELATIVE_MODES, description: '合盘子页:Comp 比较盘 / Composite 组合盘 / Synastry 影响盘 / TimeSpace 时空中点盘 / Marks 马克斯盘 / Score 评分;缺省不改' },
		},
	},
	async run(args, ctx){
		const a = getLocalChart(args.recordA);
		const b = getLocalChart(args.recordB);
		if(!a || !b){ return { ok: false, code: 'E_RECORD_NOT_FOUND', message: `未找到命盘 ${!a ? args.recordA : args.recordB}(合盘只认命盘)` }; }
		if(args.recordA === args.recordB){ return { ok: false, code: 'E_ARGS_INVALID', message: '两张命盘不能相同' }; }
		const ui = ctxUi(ctx);
		if(typeof ui.navigate !== 'function'){ return { ok: false, code: 'E_BRIDGE_UNAVAILABLE', message: '页面尚未就绪(导航桥未登记)' }; }
		const before = typeof ui.currentRoute === 'function' ? (ui.currentRoute() || {}) : {};
		ui.navigate('relativechart');
		const rel = await waitForWorkspaceUi('relative', RELATIVE_WAIT_MS);
		if(!rel || typeof rel.setPair !== 'function'){ return { ok: false, code: 'E_BRIDGE_UNAVAILABLE', message: '合盘页未就绪(等了 3 秒仍未登记配对面)' }; }
		const prevPair = typeof rel.getPair === 'function' ? rel.getPair() : null;
		const r = rel.setPair({ ...a }, { ...b }, args.mode || undefined);
		if(r && r.ok === false){ return { ok: false, code: 'E_ARGS_INVALID', message: r.message || '配对失败' }; }
		const turnId = `${(ctx && ctx.requestId) || ''}`.split(':')[0];
		const label = `${a.name || 'A'} × ${b.name || 'B'}`;
		const trailId = pushUiTrail({ kind: 'pair', turnId, label: `已配对 ${label}`, before: { tab: before.tab || null, pair: prevPair }, after: { tab: 'relativechart', pair: { a: args.recordA, b: args.recordB, mode: args.mode || null } },
			undo: ()=>{ if(prevPair && prevPair.a && prevPair.b){ return rel.setPair(prevPair.a, prevPair.b, prevPair.mode || undefined); } if(typeof rel.clearPair === 'function'){ rel.clearPair(); } if(before.tab && before.tab !== 'relativechart'){ ui.navigate(before.tab, before.subTab || undefined); } return { ok: true }; } });
		spotlight({ selector: '[data-agent-target="relative-pair"]', label: `AI 已配对 ${label}`, undo: ()=>undoUiTrail(trailId) });
		return { ok: true, data: { recordA: args.recordA, recordB: args.recordB, mode: args.mode || null, trailId }, summary: `合盘 ${label}`, message: `已在合盘页配对 ${label}(动作条可回到上一对)` };
	},
};
