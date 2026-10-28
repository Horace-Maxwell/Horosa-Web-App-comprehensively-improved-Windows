// AI 助手·后台任务查询:列出 / 读取本机后台任务(目标任务 / 定时任务 / 扫描)的状态与结果。
// 只读、零动作;任务实体单源 aiAgent/tasks/taskStore(listTasks / getTask);结果正文与日志按上限截断。
import { listTasks, getTask, TASK_KINDS, TASK_STATUSES, TASK_TERMINAL } from '../../aiAgent/tasks/taskStore';
import { GUIDE } from './_shared';

export const TASK_LIST_MAX = 50;
export const TASK_RESULT_MAX_CHARS = 50000;
export const TASK_LOG_LINES_MAX = 200;
const STATUS_FILTERS = TASK_STATUSES.concat(['active', 'terminal']);
// 工具描述与 kind 枚举列的任务类别:目标任务 / 定时任务 / 扫描
export const LIST_TASK_KINDS = TASK_KINDS.filter((k)=>['goal', 'scheduled', 'scan'].indexOf(k) >= 0);

function statusFilterOf(status){
	if(!status){ return undefined; }
	if(status === 'terminal'){ return TASK_TERMINAL.slice(); }
	if(status === 'active'){ return TASK_STATUSES.filter((s)=>TASK_TERMINAL.indexOf(s) < 0); }
	return status;
}

// 列表摘要:不带 spec / result / log 正文(要细节走 get_task)
export function summarizeTask(t){
	return {
		taskId: `${t.id}`, kind: t.kind, title: t.title, status: t.status, progress: t.progress, origin: t.origin,
		createdAt: t.createdAt || null, updatedAt: t.updatedAt || null, nextRunAt: t.nextRunAt || null, lastRunAt: t.lastRunAt || null,
	};
}

function resultText(result){
	if(result === null || result === undefined){ return ''; }
	if(typeof result === 'string'){ return result; }
	if(typeof result === 'object' && typeof result.content === 'string'){ return result.content; }
	try{ return JSON.stringify(result); }catch(e){ return `${result}`; }
}

function logLine(entry){
	if(entry === null || entry === undefined){ return ''; }
	if(typeof entry === 'string'){ return entry; }
	const at = entry.at ? `${entry.at} ` : '';
	const msg = entry.message !== undefined ? entry.message : (entry.text !== undefined ? entry.text : entry);
	return `${at}${typeof msg === 'string' ? msg : JSON.stringify(msg)}`;
}

// 详情(工具与 horosa://task/<id> 资源共用):日志取最后 logLines 行,结果正文按 resultChars 截断并如实标注
export function detailOfTask(t, opts){
	const o = opts || {};
	const logLines = Math.max(0, Math.min(TASK_LOG_LINES_MAX, Number.isFinite(o.logLines) ? o.logLines : 20));
	const resultChars = Math.max(200, Math.min(TASK_RESULT_MAX_CHARS, Number.isFinite(o.resultChars) ? o.resultChars : 4000));
	const full = resultText(t.result);
	const log = (Array.isArray(t.log) ? t.log : []).slice(-logLines).map(logLine);
	return {
		...summarizeTask(t),
		budget: t.budget || null, spent: t.spent || null, missedPolicy: t.missedPolicy, conversationId: t.conversationId || null,
		instructions: Array.isArray(t.instructions) ? t.instructions.map((x)=>`${typeof x === 'string' ? x : (x && x.text) || ''}`.slice(0, 500)) : [],
		result: full.length > resultChars ? `${full.slice(0, resultChars)}\n[truncated: 剩余 ${full.length - resultChars} 字符]` : full,
		resultChars: full.length,
		resultTruncated: full.length > resultChars,
		log,
		logTotal: Array.isArray(t.log) ? t.log.length : 0,
	};
}

export function taskDetailText(d){
	const lines = [
		`【任务】${d.title}(${d.kind} · ${d.status}${Number.isFinite(d.progress) ? ` · ${d.progress}%` : ''})`,
		`任务 id:${d.taskId}`,
		`创建:${d.createdAt || '—'};更新:${d.updatedAt || '—'}${d.nextRunAt ? `;下次运行:${d.nextRunAt}` : ''}${d.lastRunAt ? `;上次运行:${d.lastRunAt}` : ''}`,
	];
	if(d.instructions && d.instructions.length){ lines.push('', '[指令]', ...d.instructions); }
	if(d.log && d.log.length){ lines.push('', `[日志](最后 ${d.log.length} / 共 ${d.logTotal} 行)`, ...d.log); }
	if(d.result){ lines.push('', '[结果]', d.result); }
	return lines.join('\n');
}

export const listTasksTool = {
	name: 'list_tasks',
	level: 'read',
	category: 'tasks',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	description: `列出本机后台任务(目标任务 / 定时任务 / 扫描)的摘要:状态、进度、下次 / 上次运行时间,新的在前。status 可填具体状态,或 active(未结束)/ terminal(已结束)。total 是按条件过滤后的条数,翻页用 offset(回包 nextOffset 为下一页起点,null = 没有了)。要看日志与结果用 get_task。${GUIDE}:用户问「后台任务跑得怎么样 / 有哪些任务」时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false,
		properties: {
			status: { type: 'string', enum: STATUS_FILTERS },
			kind: { type: 'string', enum: LIST_TASK_KINDS },
			limit: { type: 'integer', minimum: 1, maximum: TASK_LIST_MAX, default: 20 },
			offset: { type: 'integer', minimum: 0, default: 0 },
		},
	},
	outputSchema: {
		type: 'object', required: ['items', 'total'],
		properties: {
			items: { type: 'array', items: { type: 'object', required: ['taskId', 'kind', 'status', 'title'], properties: { taskId: { type: 'string' }, kind: { type: 'string' }, status: { type: 'string' }, title: { type: 'string' }, progress: { type: 'number' } } } },
			total: { type: 'integer' },
			offset: { type: 'integer' },
			nextOffset: { type: ['integer', 'null'] },
		},
	},
	async run(args){
		const all = await listTasks({ kind: args.kind, status: statusFilterOf(args.status) });
		const limit = args.limit || 20;
		const offset = args.offset || 0;
		const items = all.slice(offset, offset + limit).map(summarizeTask);
		const nextOffset = offset + items.length < all.length ? offset + items.length : null;
		return { ok: true, data: { items, total: all.length, offset, nextOffset }, summary: `任务 ${items.length}/共 ${all.length}` };
	},
};

export const getTaskTool = {
	name: 'get_task',
	level: 'read',
	category: 'tasks',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	description: `读取一个后台任务的详情:状态、预算与已用、指令、最后若干行日志、结果正文(按 resultChars 截断)。taskId 用 list_tasks 取。${GUIDE}:用户要看某个任务的进度、日志或结果时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['taskId'],
		properties: {
			taskId: { type: 'string', minLength: 1, maxLength: 80 },
			logLines: { type: 'integer', minimum: 0, maximum: TASK_LOG_LINES_MAX, default: 20 },
			resultChars: { type: 'integer', minimum: 200, maximum: TASK_RESULT_MAX_CHARS, default: 4000 },
		},
	},
	outputSchema: {
		type: 'object', required: ['taskId', 'kind', 'status', 'title', 'result', 'log'],
		properties: { taskId: { type: 'string' }, kind: { type: 'string' }, status: { type: 'string' }, title: { type: 'string' }, result: { type: 'string' }, resultTruncated: { type: 'boolean' }, log: { type: 'array', items: { type: 'string' } } },
	},
	async run(args){
		const t = await getTask(`${args.taskId}`);
		if(!t){ return { ok: false, code: 'E_TASK_NOT_FOUND', message: `没有这个任务:${`${args.taskId}`.slice(0, 80)}` }; }
		const d = detailOfTask(t, args);
		return { ok: true, data: d, summary: `任务 ${d.title} · ${d.status}` };
	},
};
