// AI 助手·诊断:与 /doctor 同一份结构化自检(buildDoctorReport)+ 存储体检(runArchiveHealthCheck)。只读。
// 对外只回状态与计数:不回模型配置、上游错误原文、后台失败的消息原文(可能带路径或命盘摘要),也不导出诊断包。
import { buildDoctorReport } from '../../aiChat/doctor';
import { runArchiveHealthCheck } from '../../archiveHealthCheck';
import { isAgentEnabled, getAgentApprovalMode, isGoalEnabled, isSchedulerEnabled, isAutomationEnabled, isExternalToolsEnabled, isWebSearchEnabled } from '../../aiAgent/prefs';
import { desktopMcpServerStatus, isDesktopBridgeAvailable } from '../../aiAnalysisDesktop';
import { listBackgroundFailures } from '../../aiAgent/bgSink';
import { getIdbStatsForDebug } from '../../aiAnalysisStore';
import { SCHEDULER_LAST_TICK_KEY } from '../../aiAgent/tasks/scheduler';
import { ServerRoot } from '../../constants';
import { GUIDE } from './_shared';

// 对外可回的行(状态 / 计数);model / backendError / sessionAllow / toolPolicy 等不回
export const DIAGNOSTIC_ROW_KEYS = ['backend', 'desktop', 'agent', 'subswitches', 'mcp', 'heartbeat', 'idb', 'bgFailures'];

const safe = (fn, fb)=>{ try{ const v = fn(); return v === undefined ? fb : v; }catch(e){ return fb; } };

export async function collectDiagnostics(){
	let mcp = { available: false };
	try{ mcp = (await desktopMcpServerStatus()) || { available: false }; }catch(e){ mcp = { available: false }; }
	const bg = safe(()=>listBackgroundFailures(), []);
	const report = buildDoctorReport({
		backend: { root: ServerRoot },
		desktop: { bridge: safe(()=>isDesktopBridgeAvailable(), false) },
		agent: { enabled: safe(isAgentEnabled, false), approval: safe(getAgentApprovalMode, ''), goal: safe(isGoalEnabled, false), scheduler: safe(isSchedulerEnabled, false),
			automation: safe(isAutomationEnabled, false), external: safe(isExternalToolsEnabled, false), webSearch: safe(isWebSearchEnabled, false) },
		mcp,
		heartbeat: { lastTickAt: safe(()=>window.localStorage.getItem(SCHEDULER_LAST_TICK_KEY) || '', ''), schedulerEnabled: safe(isSchedulerEnabled, false) },
		idb: { stats: safe(()=>getIdbStatsForDebug(), {}) },
		bgFailures: [],
	});
	const bgN = Array.isArray(bg) ? bg.length : 0;
	const rows = report.rows.filter((r)=>DIAGNOSTIC_ROW_KEYS.indexOf(r.key) >= 0)
		.map((r)=>(r.key === 'bgFailures' ? { ...r, value: `${bgN} 条`, level: bgN ? 'warn' : 'ok' } : r));
	const storage = safe(()=>runArchiveHealthCheck(), []).map((x)=>({ name: x.name, ok: !!x.ok, detail: `${x.detail || ''}` }));
	const worst = rows.some((r)=>r.level === 'bad') || storage.some((s)=>!s.ok) ? (rows.some((r)=>r.level === 'bad') ? 'bad' : 'warn') : (rows.some((r)=>r.level === 'warn') ? 'warn' : 'ok');
	const text = ['星阙诊断(状态与计数)']
		.concat(rows.map((r)=>`[${r.level}] ${r.label}:${r.value}`))
		.concat(storage.map((s)=>`[${s.ok ? 'ok' : 'warn'}] 存储·${s.name}:${s.detail}`))
		.join('\n');
	return { worst, rows, storage, text };
}

export const getDiagnosticsTool = {
	name: 'get_diagnostics',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 20000,
	description: `星阙运行诊断:后端 / 桌面桥 / 行动能力开关 / 本机 MCP 服务 / 调度心跳 / 本地库计数 / 后台失败条数,加存储体检(记录完整性、回收站一致性、影子副本、备份)。与对话页 /doctor 同一份自检;只回状态与计数,不回日志原文与模型配置。${GUIDE}:用户说软件不对劲、要排查时先调用。`,
	inputSchema: { type: 'object', additionalProperties: false, properties: {} },
	outputSchema: { type: 'object', required: ['worst', 'rows', 'storage', 'content'], properties: {
		worst: { type: 'string', enum: ['ok', 'warn', 'bad'] },
		rows: { type: 'array', items: { type: 'object' } },
		storage: { type: 'array', items: { type: 'object' } },
		content: { type: 'string' },
	} },
	async run(){
		const d = await collectDiagnostics();
		return { ok: true, data: { worst: d.worst, rows: d.rows, storage: d.storage, content: d.text }, summary: `诊断:${d.worst}` };
	},
};

export default getDiagnosticsTool;
