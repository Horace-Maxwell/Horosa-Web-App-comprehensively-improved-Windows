// AI 助手·查看动作账本:让模型自报「我/外部客户端/任务做过什么」(只读;不暴露参数全文;撤销只能由用户在界面点按钮)。
import { listActions } from '../ledger';
import { GUIDE } from './_shared';

export const ACTION_ORIGINS = ['all', 'in-app', 'mcp', 'goal', 'scheduled', 'automation'];

export default {
	name: 'list_actions',
	level: 'read',
	category: 'query',
	// 输出结构(外部客户端据此校验 structuredContent)
	outputSchema: {
		type: 'object', required: ['items', 'total', 'shown'],
		properties: { items: { type: 'array', items: { type: 'object' } }, total: { type: 'integer' }, shown: { type: 'integer' }, offset: { type: 'integer' }, nextOffset: { type: ['integer', 'null'] } },
	},
	undoKind: 'none',
	description: `列出助手动作账本(建档/建事盘/改设置/载入等写入动作,含外部客户端与任务来源),每条含 actionId/tool/summary/origin/at/undone;total 是按条件过滤后的条数,翻页用 offset(回包 nextOffset 为下一页起点,null = 没有了)。撤销只能由用户在界面点按钮,本工具不能撤销。${GUIDE}:用户问「你刚才做了什么」「外部程序建了哪些档」时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false,
		properties: {
			limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
			origin: { type: 'string', enum: ACTION_ORIGINS, default: 'all', description: '按来源过滤:in-app=对话内 / mcp=外部客户端 / goal=目标任务 / scheduled=定时任务 / automation=自动规则' },
			includeUndone: { type: 'boolean', default: false, description: '是否包含已撤销的动作' },
			offset: { type: 'integer', minimum: 0, default: 0, description: '跳过前多少条(按过滤后的顺序,新的在前)' },
		},
	},
	async run(args){
		const limit = args.limit || 10;
		const offset = args.offset || 0;
		const origin = args.origin || 'all';
		const matched = listActions()
			.filter((a)=>a && (args.includeUndone || !a.undone))
			.filter((a)=>origin === 'all' || `${a.origin || 'in-app'}` === origin);
		const picked = matched
			.slice(offset, offset + limit)
			.map((a)=>({ actionId: a.id, tool: a.tool, level: a.level, summary: `${a.summary || ''}`.slice(0, 120), origin: a.origin || 'in-app', clientName: a.clientName || undefined, at: a.at, undone: !!a.undone, undoKind: a.undo && a.undo.kind ? a.undo.kind : 'none' }));
		const nextOffset = offset + picked.length < matched.length ? offset + picked.length : null;
		return { ok: true, data: { items: picked, total: matched.length, shown: picked.length, offset, nextOffset, origin }, summary: `账本 ${picked.length} 条(符合条件共 ${matched.length})` };
	},
};
