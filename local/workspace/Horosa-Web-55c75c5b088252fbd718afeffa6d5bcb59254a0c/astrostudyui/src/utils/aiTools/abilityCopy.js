// AI 助手·行动能力总开关文案生成器(单源;零副作用):从工具目录派生「开启后能做什么 / 哪些写入可撤销」,
// 面板(AgentAbilityPanel)实时生成,应用内手册的同一句由合同测试 agentAbilityCopy.contract 锁定与之逐字相等——
// 此前文案手写、停在批五前四项,新工具加进目录后手册与面板继续撒谎(D42)。
import { UNDO_EXEMPT } from './catalog';
import { toolLabel } from './labels';

const WRITE_ORDER = ['records', 'settings', 'workspace', 'tasks'];

export function agentAbilityCopy(defs){
	const list = Array.isArray(defs) ? defs.filter((d)=>d && d.origin !== 'external') : [];
	const writes = list.filter((d)=>d.level === 'additive');
	const uiReads = list.filter((d)=>d.level === 'read' && d.category === 'ui');
	const byCat = (cat)=>writes.filter((d)=>(d.category || 'query') === cat).map((d)=>toolLabel(d.name));
	const groups = WRITE_ORDER.map(byCat).filter((g)=>g.length);
	const rest = writes.filter((d)=>WRITE_ORDER.indexOf(d.category || 'query') < 0).map((d)=>toolLabel(d.name));
	if(rest.length){ groups.push(rest); }
	const parts = groups.map((g)=>g.join(' / '));
	if(uiReads.length){ parts.push(`${uiReads.map((d)=>toolLabel(d.name)).join(' / ')}(界面动作,不落盘)`); }
	const exempt = writes.filter((d)=>Object.prototype.hasOwnProperty.call(UNDO_EXEMPT, d.name)).map((d)=>toolLabel(d.name));
	// [Q-294/AR-27 裁决 2026-09-18] 任务类(目标 / 定时)缺省立即开跑,「撤销」只对尚未开跑的有效 → 文案如实
	const undoPart = (exempt.length ? `除「${exempt.join('、')}」外每个写入都可在对话里一键撤销` : '每个写入都可在对话里一键撤销') + '（目标任务 / 定时任务缺省立即开跑，只有尚未开跑的可撤销；生成报告随「目标任务」开关一并开启）';
	return `AI 可在你明确要求时${parts.join('、')};所有写入只增不删,${undoPart}`;
}

// [Q-294/M-109·AR-26] 本机 MCP 服务首开确认文案同样从目录派生(只取对 origin=mcp 开放的工具):此前手写只列「新增命盘/事盘、无头起盘与读取快照」
//   并称「不会删除或覆盖任何数据」,而目录里还有改设置 / 收藏·置顶·打标签 / 切换界面 / 建任务 / 出网检索等。外部客户端的审批档独立于应用内三档。
export function mcpConfirmCopy(defs){
	const list = (Array.isArray(defs) ? defs : []).filter((d)=>d && d.origin !== 'external' && (!Array.isArray(d.origins) || d.origins.indexOf('mcp') >= 0));
	const writes = list.filter((d)=>d.level === 'additive');
	const byCat = (cat)=>writes.filter((d)=>(d.category || 'query') === cat).map((d)=>toolLabel(d.name));
	const groups = WRITE_ORDER.map(byCat).filter((g)=>g.length);
	const rest = writes.filter((d)=>WRITE_ORDER.indexOf(d.category || 'query') < 0).map((d)=>toolLabel(d.name));
	if(rest.length){ groups.push(rest); }
	const parts = groups.map((g)=>g.join(' / '));
	const uiReads = list.filter((d)=>d.level === 'read' && d.category === 'ui').map((d)=>toolLabel(d.name));
	const outbound = list.filter((d)=>d.category === 'external').map((d)=>toolLabel(d.name));
	if(uiReads.length){ parts.push(`${uiReads.join(' / ')}(切换界面)`); }
	if(outbound.length){ parts.push(`${outbound.join(' / ')}(出网,须先开对应开关)`); }
	const exempt = writes.filter((d)=>Object.prototype.hasOwnProperty.call(UNDO_EXEMPT, d.name)).map((d)=>toolLabel(d.name));
	const undoPart = exempt.length ? `除「${exempt.join('、')}」外每个写入都可撤销` : '每个写入都可撤销';
	const can = parts.length ? `读取快照与无头起盘,并可${parts.join('、')}` : '读取快照与无头起盘';
	return `开启后,本机上的外部程序(如 Codex / Claude Code)可通过星阙${can};所有写入只增不删,每个动作记入助手动作账本,${undoPart}。外部客户端另有独立审批档(下方「外部客户端策略」,缺省全自动直接执行),应用内的审批档与类别档不约束它(「按工具名禁用」仍生效)。仅监听本机回环地址,凭令牌访问。`;
}
