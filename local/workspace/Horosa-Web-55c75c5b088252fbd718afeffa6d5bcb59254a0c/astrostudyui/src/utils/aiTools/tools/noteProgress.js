// AI 助手·进度清单 note_progress(借鉴 Claude Code 的 todo 面板):多步任务里模型把步骤与状态报出来,动作条头部实时显示。
// read/interactive:零落库、零副作用、不进账本;每次调用整份替换(最多 20 条),Turn 结束即随 trace 留在气泡里。
import { GUIDE } from './_shared';

export const PROGRESS_MAX_ITEMS = 20;
export const PROGRESS_STATUSES = ['todo', 'doing', 'done'];

export default {
	name: 'note_progress',
	level: 'read',
	category: 'interactive',
	undoKind: 'none',
	timeoutMs: 2000,
	description: `记录/更新本轮的进度清单(最多 ${PROGRESS_MAX_ITEMS} 条,每次整份替换),让用户看到你正在做什么、做到哪一步。只显示不落库。${GUIDE}:多步任务(≥3 步)开始前先列出步骤,每完成一步更新状态;单步问答不要调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['items'],
		properties: {
			items: {
				type: 'array', minItems: 1, maxItems: PROGRESS_MAX_ITEMS,
				items: {
					type: 'object', additionalProperties: false, required: ['text'],
					properties: {
						text: { type: 'string', minLength: 1, maxLength: 120 },
						status: { type: 'string', enum: PROGRESS_STATUSES, default: 'todo' },
					},
				},
			},
		},
	},
	async run(args){
		const items = (Array.isArray(args.items) ? args.items : []).slice(0, PROGRESS_MAX_ITEMS).map((it)=>({ text: `${(it && it.text) || ''}`.trim().slice(0, 120), status: PROGRESS_STATUSES.indexOf(it && it.status) >= 0 ? it.status : 'todo' })).filter((it)=>it.text);
		const done = items.filter((it)=>it.status === 'done').length;
		return { ok: true, data: { items, done, total: items.length }, summary: `进度 ${done}/${items.length}${items.find((it)=>it.status === 'doing') ? `:${items.find((it)=>it.status === 'doing').text}` : ''}` };
	},
};
