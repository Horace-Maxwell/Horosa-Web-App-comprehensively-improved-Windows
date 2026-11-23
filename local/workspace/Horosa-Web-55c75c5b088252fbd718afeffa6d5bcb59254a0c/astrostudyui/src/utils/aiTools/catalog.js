// AI 助手·工具目录常量与清单导出(单源:应用内 AI 与外部智能体桥共用)。
// 只增不删的目录层保证:不存在删除/覆盖类工具名(registry 注册即拒);参数禁键在 schema 层与
// 运行层双重拒绝(带 cid 走 upsert 即「覆盖更新」,永远不许从工具面进入)。
import { toolLabel } from './labels';   // MCP 导出面 title(标签单源;labels.js 零 import,无环)
export const AGENT_TOOL_LEVELS = ['read', 'additive'];
export const AGENT_UNDO_KINDS = ['none', 'trash-record', 'restore-settings', 'cancel-task', 'restore-record-flag', 'restore-chat-mount', 'discard-material-note'];
// 「所有写入可一键撤销」的显式豁免登记:additive 工具 undoKind 为 none 必须在此登记理由,否则合同测试(aiToolsUndoContract)红;
// 面板/手册文案从这里生成「除 … 外」句,不再手写。
export const UNDO_EXEMPT = Object.freeze({
	load_record_into_workspace: '只切换当前工作区、不改档案;要回到原来那张,再载入它即可(载入命盘时紫微左栏按该盘记下的设置显示,点「新命盘」用回你自己的)',
	propose_record_edit: '只挂提案、不改档案;用户拒绝即作废,采纳后在任务中心可撤销采纳',
	propose_record_archive: '只挂提案、不改档案;用户拒绝即作废,采纳后在任务中心可撤销采纳',
	propose_record_unlink: '只挂提案、不改档案;用户拒绝即作废,采纳后在任务中心可撤销采纳',
	propose_record_recover: '只挂提案、不改档案;用户拒绝即作废,采纳后在任务中心可撤销采纳(重新移入回收站)',
	control_task: '只做收紧(暂停 / 取消);暂停后继续要用户在任务中心手点,取消是终态',
	propose_memory: '只投记忆候选;用户在进阶页「记忆」里确认才生效,丢弃即作废',
	propose_template: '只挂提案、不写入;用户拒绝即作废,采纳后在任务中心可撤销采纳',
	propose_skill_pack: '只挂提案、不写入;用户拒绝即作废,采纳后在任务中心可撤销采纳',
	propose_persona_text: '只挂提案、不写入;用户拒绝即作废,采纳后在任务中心可撤销采纳',
	save_document: '只新增文件、不覆盖;文件在固定导出目录,不再需要时用户自己删',
	chat_in_conversation: '只往对话里新增一问一答(标明来自外部 AI),不改已有消息;不要的那两条用户在对话页删',
});
// 工具类别(审批档可按类别单独收紧;信任档案只对 workspace/query 放行):缺省 query
// ui=界面动作(导航/合盘配对):read 级、不落盘、自动执行、可见可回退;外部客户端看到的 readOnlyHint 为 false(它改的是页面状态)
//   改了会跨会话保留的状态(对话挂载)不算 ui:按只增级写入走审批、进账本(set_chat_mount = workspace)
export const TOOL_CATEGORIES = ['records', 'settings', 'workspace', 'tasks', 'query', 'external', 'interactive', 'ui'];
// 工具来源:builtin=内置目录(只增不删合同的对象);external=用户接入的外部服务器工具(可随服务器断开注销)
export const TOOL_ORIGINS = ['builtin', 'external'];
// 调用来源(ctx.origin)值域;工具可选合同键 origins:[…] = 只对这些来源开放(不在目录/不可调),缺省=全部来源
export const TOOL_CALL_ORIGINS = ['in-app', 'mcp', 'goal', 'automation', 'scheduled', 'orchestrate'];   // orchestrate=多技法编排子任务轮(useChatOrchestrate 已在用,此前不在值域)
export const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{0,47}$/;
export const DENIED_TOOL_NAME_RE = /delete|remove|purge|clear|reset|overwrite|update|rename|import|export|restore|backup|undo/i;
export const FORBIDDEN_ARG_KEYS = ['cid', 'schemaVersion', 'deletedAt', 'updateTime', 'preserveUpdateTime', 'orderKey', 'pinTier', 'pinAt', 'archived', 'starred', 'lastOpenedAt', 'openCount'];
export const GUIDE_PHRASE = '仅当用户明确要求时调用';

// 目录清单 → 纯 JSON(可经 JSON.stringify 无损;供 provider tools 定义与 MCP tools/list)
// 注解只出现在 MCP 导出面(运行时 toolDefs() 只取 name/description/inputSchema 送上游,模型请求体字节零变):
//   openWorldHint 对出网类(external 类别 / 外部服务器工具)为 true(此前恒 false = 对 Codex/Claude Code 谎报「不出网」);
//   title = 中文标签(2025-06-18 起的展示名字段);interactive 类带 anthropic/requiresUserInteraction(Claude Code 每次弹确认、不提供「不再问」)。
export function buildToolManifest(defs){
	return defs.map((d)=>{
		const category = d.category || 'query';
		const origin = d.origin || 'builtin';
		return {
			name: d.name,
			title: toolLabel(d.name),
			description: d.description,
			inputSchema: JSON.parse(JSON.stringify(d.inputSchema)),
			level: d.level,
			category,
			origin,
			annotations: {
				readOnlyHint: d.level === 'read' && category !== 'ui',
				destructiveHint: false,
				// 写入类声明 idempotent:true(同参重复调用状态不再变:星标 / 置顶 / 加标签 / 关联,各有 noChange)也报幂等
				idempotentHint: d.level === 'read' || d.idempotent === true,
				openWorldHint: category === 'external' || origin === 'external',
			},
			// 声明得比缺省 120 s 长的同步工具:把声明预算(毫秒)写进目录条目 —— 桌面壳据此在客户端没给 _meta.timeoutMs 时按它等(键名 = 壳 TOOL_TIMEOUT_META_KEY)
			...((category === 'interactive' || Number(d.timeoutMs) > 120000) ? { _meta: { ...(category === 'interactive' ? { 'anthropic/requiresUserInteraction': true } : {}), ...(Number(d.timeoutMs) > 120000 ? { 'io.horosa/timeoutMs': Number(d.timeoutMs) } : {}) } } : {}),
			// 声明了输出结构的工具:MCP 面透传 outputSchema(桥据此对成功结果恒带 structuredContent);运行时 toolDefs 不取这个键
			...(d.outputSchema ? { outputSchema: JSON.parse(JSON.stringify(d.outputSchema)) } : {}),
		};
	});
}
