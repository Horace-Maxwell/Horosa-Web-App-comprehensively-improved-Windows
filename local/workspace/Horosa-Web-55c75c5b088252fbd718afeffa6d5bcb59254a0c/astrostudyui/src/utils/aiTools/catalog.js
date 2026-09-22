// AI 助手·工具目录常量与清单导出(单源:应用内 AI 与外部智能体桥共用)。
// 只增不删的目录层保证:不存在删除/覆盖类工具名(registry 注册即拒);参数禁键在 schema 层与
// 运行层双重拒绝(带 cid 走 upsert 即「覆盖更新」,永远不许从工具面进入)。
import { toolLabel } from './labels';   // [D89] MCP 导出面 title(标签单源;labels.js 零 import,无环)
export const AGENT_TOOL_LEVELS = ['read', 'additive'];
export const AGENT_UNDO_KINDS = ['none', 'trash-record', 'restore-settings', 'cancel-task', 'restore-record-flag'];
// [D42] 「所有写入可一键撤销」的显式豁免登记:additive 工具 undoKind 为 none 必须在此登记理由,否则合同测试(aiToolsUndoContract)红;
// 面板/手册文案从这里生成「除 … 外」句,不再手写。
export const UNDO_EXEMPT = Object.freeze({
	load_record_into_workspace: '只切换当前工作区、不落盘;再载入别的档即等于撤销',
});
// 工具类别(审批档可按类别单独收紧;信任档案只对 workspace/query 放行):缺省 query
// [批五] ui=界面动作(导航/合盘配对):read 级、不落盘、自动执行、可见可回退;外部客户端看到的 readOnlyHint 为 false(它改的是页面状态)
export const TOOL_CATEGORIES = ['records', 'settings', 'workspace', 'tasks', 'query', 'external', 'interactive', 'ui'];
// 工具来源:builtin=内置目录(只增不删合同的对象);external=用户接入的外部服务器工具(可随服务器断开注销)
export const TOOL_ORIGINS = ['builtin', 'external'];
// [批三③] 调用来源(ctx.origin)值域;工具可选合同键 origins:[…] = 只对这些来源开放(不在目录/不可调),缺省=全部来源
export const TOOL_CALL_ORIGINS = ['in-app', 'mcp', 'goal', 'automation', 'scheduled', 'orchestrate'];   // [D14] orchestrate=多技法编排子任务轮(useChatOrchestrate 已在用,此前不在值域)
export const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{0,47}$/;
export const DENIED_TOOL_NAME_RE = /delete|remove|purge|clear|reset|overwrite|update|rename|import|export|restore|backup|undo/i;
export const FORBIDDEN_ARG_KEYS = ['cid', 'schemaVersion', 'deletedAt', 'updateTime', 'preserveUpdateTime', 'orderKey', 'pinTier', 'pinAt', 'archived', 'starred', 'lastOpenedAt', 'openCount'];
export const GUIDE_PHRASE = '仅当用户明确要求时调用';

// 目录清单 → 纯 JSON(可经 JSON.stringify 无损;供 provider tools 定义与 MCP tools/list)
// [D89] 注解只出现在 MCP 导出面(运行时 toolDefs() 只取 name/description/inputSchema 送上游,模型请求体字节零变):
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
				idempotentHint: d.level === 'read',
				openWorldHint: category === 'external' || origin === 'external',
			},
			...(category === 'interactive' ? { _meta: { 'anthropic/requiresUserInteraction': true } } : {}),
		};
	});
}
