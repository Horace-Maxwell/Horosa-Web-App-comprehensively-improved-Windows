// 无人值守执行(无头常驻服务里的定时任务 / 目标任务):没有人能点「允许」、也没有人回答反问 ——
//   ① 工具只给只读件与「提议」件(propose_*:只挂提案等用户采纳,本身不改档案);其余写入在注册表层直接拒,不看审批档;
//   ② 审批:只放行提议件(它只挂提案,采纳仍要用户本人);其余要人点头的一律拒(含只读件里要确认的联网等);
//      反问不提供(工具回「没有反问通道」,模型自行假设继续);
//   ③ 要调模型的任务须「无头分析出口」开着(与 run_analysis 同一道门);择日到期提醒不调模型,不受此限。
// 🔴 不静态 import 工具目录(aiTools → schedule_task → 本层 成环):注册表在用时惰性载入。
import { readOnlyRegistryView } from '../readOnlyRegistry';
import { isHeadlessEnabled } from '../prefs';

export const UNATTENDED_DENY_MESSAGE = '无人值守运行:只能读取与提出提案,直接写入一律不执行(要改档案请用 propose_* 提议,等用户采纳)';
// 不调模型的定时任务种类(无头分析出口关着也能跑)
export const MODEL_FREE_SCHEDULED_KINDS = ['zeri-reminder'];

export function isProposalTool(def){
	return !!(def && typeof def.name === 'string' && def.name.indexOf('propose_') === 0);
}

// 只读 + 提议件的注册表视图(registry 缺省 = 内置目录)
export async function unattendedRegistry(registry){
	let reg = registry;
	if(!reg){
		const { registerBuiltinTools } = await import('../../aiTools');
		try{ registerBuiltinTools(); }catch(e){ /* 幂等 */ }
		reg = await import('../../aiTools/registry');
	}
	return readOnlyRegistryView(reg, { allowAlso: isProposalTool, denyMessage: UNATTENDED_DENY_MESSAGE });
}

export const approveProposalsOnly = async (call)=>isProposalTool({ name: call && call.name });

// 这件任务要不要调模型;要而出口关着 → 不跑,回给用户的话带开关命令
export function unattendedModelGate(task){
	const kind = task && task.spec && task.spec.kind;
	if(task && task.kind === 'scheduled' && MODEL_FREE_SCHEDULED_KINDS.indexOf(kind) >= 0){ return null; }
	if(isHeadlessEnabled()){ return null; }
	return '要调模型的任务需要先打开无头分析出口:用户本人在终端执行 ./horosa config headless-analysis on';
}

// 调度器的执行体(注入 runSchedulerTick / runScheduledTaskNow 的 runner):过门 → 只读 + 提议注册表 → 审批只放行提议、无反问
export async function runUnattendedScheduledTask(task, ctx){
	const gate = unattendedModelGate(task);
	if(gate){ return { ok: false, error: gate }; }
	const c = ctx || {};
	const registry = await unattendedRegistry(c.registry);
	const m = await import('./taskKinds');
	return m.runScheduledTask(task, { ...c, unattended: true, registry, requestApproval: approveProposalsOnly, requestElicitation: null });
}

// 目标任务起跑的 deps(注入 startGoalTask):同一套只读 + 提议注册表、审批只放行提议、无反问
export async function unattendedGoalDeps(base){
	return { ...(base || {}), unattended: true, registry: await unattendedRegistry(base && base.registry) };
}
