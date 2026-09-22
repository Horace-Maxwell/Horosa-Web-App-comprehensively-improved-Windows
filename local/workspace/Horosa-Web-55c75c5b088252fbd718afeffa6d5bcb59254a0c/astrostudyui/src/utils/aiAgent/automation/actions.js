// 自动化动作注册表(P4):动作只做「用户自己点也能做」的事,且全部可撤销或无副作用。
// 三件公共动作:把新档设为当前分析源 / 生成一份简报(走无头轮,origin='automation')/ 归档 N 天没动的对话。
import { reportBackgroundFailure } from '../bgSink';
import { pushNotice } from '../tasks/noticeStore';
import { AUTOMATION_EVENTS } from './events';

export const AUTOMATION_ACTION_TYPES = ['select-source', 'start-brief', 'archive-idle-conversations', 'deny', 'notify-script'];
// [Q-294/M-109·AR-21] 动作 × 事件 可达表(面板下拉按事件过滤;ruleStore 保存时拒绝不可达组合并说明):
//   tool.before 只走同步否决通道、异步引擎收不到 → 只有「拒绝执行」可达;「设为当前分析源 / 生成简报」要载荷里的记录 id → 只有「存了命盘或事盘」;
//   其余动作在全部异步事件上可达。未登记的动作类型(外部扩展)不设限。
const ASYNC_EVENTS = AUTOMATION_EVENTS.filter((e)=>e !== 'tool.before');
export const ACTION_EVENT_SUPPORT = {
	'select-source': ['record.saved'],
	'start-brief': ['record.saved'],
	'archive-idle-conversations': ASYNC_EVENTS,
	'deny': ['tool.before'],
	'notify-script': ASYNC_EVENTS,
};
// 面板口径:带自有 cid / instanceId 的动作(只能由代码写入,面板存的是裸 { type })在任何异步事件上都可达
export function actionSupportsEvent(type, event, action){
	const t = `${type || ''}`; const e = `${event || ''}`;
	const list = ACTION_EVENT_SUPPORT[t];
	if(!Array.isArray(list)){ return true; }
	if(list.indexOf(e) >= 0){ return true; }
	if(e !== 'tool.before' && action && ((t === 'select-source' || t === 'start-brief') && action.cid || t === 'export-docx' && action.instanceId)){ return true; }
	return false;
}
export function actionTypesForEvent(event){
	return AUTOMATION_ACTION_TYPES.filter((t)=>actionSupportsEvent(t, event));
}
// 保存闸口径(ruleStore):只拦「无论载荷如何都绝不执行」的硬组合——tool.before 只走同步否决通道(异步引擎收不到)⇒ 非 deny 动作永不跑;
//   deny 在异步事件上只回「配错」。缺 id 类组合不硬拦(载荷 / 动作自带 id 时可达,引擎失败会发通知)。
export function actionEventHardBlocked(type, event){
	const t = `${type || ''}`; const e = `${event || ''}`;
	if(e === 'tool.before'){ return t !== 'deny' ? '「工具执行前」只能配「拒绝执行」(其它动作走不到)' : ''; }
	if(t === 'deny'){ return '「拒绝执行」只对「工具执行前」事件生效'; }
	return '';
}
export const ARCHIVE_IDLE_DAYS_DEFAULT = 30;

// deps 全部注入(测试可换假件);任何动作抛错都由引擎接住并转成通知,绝不反噬调用点
export function buildActionRunners(deps){
	const d = deps || {};
	return {
		'select-source': async (action, detail)=>{
			const cid = `${(detail && detail.payload && detail.payload.cid) || (action && action.cid) || ''}`;
			if(!cid){ return { ok: false, reason: '事件里没有记录 id' }; }
			if(typeof d.selectSource !== 'function'){ return { ok: false, reason: '当前页面不支持切换分析源' }; }
			await d.selectSource(cid);
			return { ok: true, summary: `已把 ${cid} 设为当前分析源` };
		},
		'start-brief': async (action, detail)=>{
			if(typeof d.runBrief !== 'function'){ return { ok: false, reason: '简报动作不可用' }; }
			const cid = `${(action && action.cid) || (detail && detail.payload && detail.payload.cid) || ''}`;
			const out = await d.runBrief({ cid, techniques: Array.isArray(action && action.techniques) ? action.techniques : [], origin: 'automation' });
			return { ok: true, summary: `已生成简报${out && out.conversationId ? `(会话 ${out.conversationId})` : ''}` };
		},
		// [批二④] 拒绝执行:只对 tool.before 生效(引擎同步通道判定);其它事件上配了它 = 配错,明确说
		'deny': async ()=>({ ok: false, reason: '「拒绝执行」只对「工具执行前」事件生效' }),
		// [批三⑥] 运行用户自己的通知脚本(仅桌面壳;壳侧六道门校验路径、零 shell、10s kill、限流);非桌面 = 不可用
		'notify-script': async (action, detail)=>{
			if(typeof d.notifyScript !== 'function'){ return { ok: false, reason: '通知脚本钩仅桌面版可用' }; }
			// [Q-294/M-109·AR-07①] 事件对象字段名是 event(events.js),此前取 detail.name → 脚本收到的 JSON 恒 "event":""
			const payload = { event: `${(detail && (detail.event || detail.name)) || ''}`, title: `${(action && action.title) || (detail && detail.payload && detail.payload.title) || '星阙自动化'}`, at: new Date().toISOString(), payload: detail && detail.payload && typeof detail.payload === 'object' ? detail.payload : {} };
			const r = await d.notifyScript(payload);
			return r && r.ran ? { ok: true, summary: `已运行通知脚本(exit ${r.exit == null ? '?' : r.exit}${r.timedOut ? ',超时被停' : ''})` } : { ok: false, reason: (r && r.reason) || '通知脚本未运行' };
		},
		'archive-idle-conversations': async (action)=>{
			if(typeof d.archiveIdleConversations !== 'function'){ return { ok: false, reason: '归档动作不可用' }; }
			const days = Math.max(1, Math.min(365, Number(action && action.days) || ARCHIVE_IDLE_DAYS_DEFAULT));
			const n = await d.archiveIdleConversations(days);
			return { ok: true, summary: `已归档 ${n} 个 ${days} 天没动过的对话(可在历史里取消归档)` };
		},
	};
}

export async function notifyActionFailure(rule, action, reason){
	try{
		await pushNotice({ level: 'warn', title: `自动化规则「${(rule && rule.name) || ''}」未执行`, body: `${(action && action.type) || ''}:${reason || '未知原因'}`, link: 'settings:automation' });
	}catch(e){ reportBackgroundFailure('automation.notify', e); }
}
