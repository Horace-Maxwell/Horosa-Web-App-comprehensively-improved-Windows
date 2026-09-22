// 自动化引擎的缺省依赖(P4 补课·[A4]):三件公共动作的真实实现——此前布局层是裸调 bindAutomationEngine(),
// 三件动作 selectSource / runBrief / archiveIdleConversations 恒为 undefined,用户建的规则一条也跑不动。
// 纪律:本文件挂在布局层(首屏 chunk),零静态 import 运行时/目标任务——runBrief 惰性载入 goalRunner。
import { getWorkspaceUi } from '../../aiTools/workspaceBridge';
import { AI_ANALYSIS_STORES, listStoreRecords, putStoreRecord } from '../../aiAnalysisStore';
import { findAnalysisSourceById } from '../../aiAnalysisSources';
import { desktopNotifyHookRun } from '../../aiAnalysisDesktop';

export const BRIEF_CONV_PREFIX = '自动·简报·';
export const BRIEF_PROMPT = '请给挂载的命盘一页简报:命局特点(3 条)、当前大运/大限要点(2 条)、近期注意(2 条)、一句话总评;每条先结论后依据。';

export function buildDefaultAutomationDeps(extra){
	return {
		// [批三⑥] 通知脚本钩:经壳命令跑用户脚本(非桌面 → 不可用;壳内门与限流都在壳侧)
		notifyScript: async (payload)=>{
			const r = await desktopNotifyHookRun(payload, false);
			if(!r || !r.available){ throw new Error('通知脚本钩仅桌面版可用'); }
			return r;
		},
		// 把新档设为当前分析源:经工作区桥的 ui(AI 分析页在前台才有;不在 → 抛错让引擎记「不可用」通知)
		selectSource: async (cid)=>{
			const ui = getWorkspaceUi();
			if(!ui || typeof ui.selectSource !== 'function'){ throw new Error('当前页面不支持切换分析源(先打开 AI 分析页)'); }
			if(typeof ui.refreshSources === 'function'){ try{ ui.refreshSources(); }catch(e){ /* noop: UI 刷新失败不阻断选源 */ } }
			await ui.selectSource(cid);
			return true;
		},
		// 生成一份简报:一次无头轮落到新会话(origin='automation';写入审批一律拒=零写入)
		runBrief: async ({ cid, techniques, origin } = {})=>{
			const m = await import('../goalRunner');
			const resolved = await m.resolveHeadlessProfile({});
			if(!resolved){ throw new Error('没有可用的接口配置/模型'); }
			const source = cid ? findAnalysisSourceById(cid) : null;
			const keys = Array.isArray(techniques) ? techniques.slice(0, 6) : [];
			const now = new Date().toISOString();
			const conv = await putStoreRecord(AI_ANALYSIS_STORES.conversations, {
				title: `${BRIEF_CONV_PREFIX}${source && source.title ? `${source.title}`.slice(0, 16) : ''}${now.slice(0, 10)}`,
				sourceRef: source ? { id: source.id, sourceType: source.sourceType, title: source.title, module: source.module } : null,
				providerProfileId: resolved.profile.id, providerName: resolved.profile.name, providerType: resolved.profile.providerType, model: resolved.model,
				referenceIds: [], techniqueKeys: keys, systemPrompt: '',
				meta: { kind: 'automation-brief', origin: origin || 'automation' }, lastMessageAt: now, updatedAt: now, createdAt: now, archived: false, favorite: false,
			}, 'conv');
			// [Q-294/AR-30 裁决 2026-09-18] 简报轮用只读注册表视图(与编排子任务同):缺省审批档「全自动」下写入不再直接放行,与「零写入」注释一致
			const readOnlyView = (await import('../readOnlyRegistry')).defaultReadOnlyRegistry();
			const r = await m.runHeadlessTurn({ registry: readOnlyView, profile: resolved.profile, model: resolved.model, conversationId: conv.id, userText: BRIEF_PROMPT, source, techniqueKeys: keys, systemPrompt: '', origin: origin || 'automation', requestApproval: ()=>Promise.resolve(false) });
			if(r && r.error){ throw new Error(r.error); }
			return { conversationId: conv.id };
		},
		// 归档 N 天没动的对话(收藏的不动;可在历史里取消归档);回归档条数
		archiveIdleConversations: async (days)=>{
			const cutoff = Date.now() - Math.max(1, Number(days) || 30) * 86400000;
			const all = (await listStoreRecords(AI_ANALYSIS_STORES.conversations)) || [];
			let n = 0;
			for(let i = 0; i < all.length; i++){
				const c = all[i];
				if(!c || c.archived || c.favorite){ continue; }
				const last = Date.parse(c.lastMessageAt || c.updatedAt || c.createdAt || '') || 0;
				if(!last || last > cutoff){ continue; }
				// eslint-disable-next-line no-await-in-loop
				await putStoreRecord(AI_ANALYSIS_STORES.conversations, { ...c, archived: true }, 'conv');
				n += 1;
			}
			return n;
		},
		...(extra && typeof extra === 'object' ? extra : {}),
	};
}
