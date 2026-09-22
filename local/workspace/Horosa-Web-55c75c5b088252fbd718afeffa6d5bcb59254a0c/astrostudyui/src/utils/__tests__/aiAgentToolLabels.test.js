// [批二①] 工具标签合同:每件注册进目录的内置工具都有中文标签(动作条不许出现裸英文名);外部工具即时拼「外部·」。
import { registerBuiltinTools, listTools } from '../aiTools';
import { __resetToolsForTests } from '../aiTools/registry';
import { AGENT_TOOL_LABELS, toolLabel } from '../aiTools/labels';
import { AGENT_TOOL_LABELS as FROM_BAR } from '../../components/aianalysis/AgentActionBar';

beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); });

it('每件内置工具都有中文标签(含目标任务/定时任务/联网检索三件此前漏登记的)', ()=>{
	registerBuiltinTools();
	const names = listTools().map((d)=>d.name);
	expect(names.length).toBeGreaterThanOrEqual(16);
	const bare = names.filter((n)=>!/[\u4e00-\u9fa5]/.test(`${AGENT_TOOL_LABELS[n] || ''}`));
	expect(bare).toEqual([]);
	['create_goal_task', 'schedule_task', 'web_search'].forEach((n)=>{ expect(AGENT_TOOL_LABELS[n]).toBeTruthy(); expect(toolLabel(n)).toBe(AGENT_TOOL_LABELS[n]); });
});

it('外部工具按 ext_ 前缀拼「外部·」;未知名原样;原型键不取', ()=>{
	expect(toolLabel('ext_srv_echo')).toBe('外部·srv_echo');
	expect(toolLabel('nope_tool')).toBe('nope_tool');
	expect(toolLabel('constructor')).toBe('constructor');
});

it('动作条仍导出同一份标签表(既有引用不断链)', ()=>{
	expect(FROM_BAR).toBe(AGENT_TOOL_LABELS);
});
