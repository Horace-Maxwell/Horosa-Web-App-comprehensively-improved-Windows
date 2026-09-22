// 行动能力总开关文案 ≡ 工具目录(abilityCopy 单源):每件写入工具的中文标签、界面动作标签、豁免句都在;面板函数逐字等于生成句。
import { registerBuiltinTools, listTools } from '../aiTools';
import { __resetToolsForTests } from '../aiTools/registry';
import { agentAbilityCopy, mcpConfirmCopy } from '../aiTools/abilityCopy';
import { UNDO_EXEMPT } from '../aiTools/catalog';
import { toolLabel } from '../aiTools/labels';
import { agentAbilityCopyText } from '../../components/aianalysis/AgentAbilityPanel';
import { mcpConfirmCopyText } from '../../components/aianalysis/ExternalAgentPanel';

beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); });

it('🔴 生成句含每件 additive 工具标签 + 每件 ui 动作标签 + 只增不删 + 豁免句;外部工具不进句', ()=>{
	registerBuiltinTools();
	const defs = listTools();
	const text = agentAbilityCopy(defs.concat([{ name: 'ext_x', level: 'read', category: 'external', origin: 'external' }]));
	defs.filter((d)=>d.level === 'additive').forEach((d)=>expect(text).toContain(toolLabel(d.name)));
	defs.filter((d)=>d.level === 'read' && d.category === 'ui').forEach((d)=>expect(text).toContain(toolLabel(d.name)));
	expect(text).toContain('所有写入只增不删');
	expect(text).toContain(`除「${Object.keys(UNDO_EXEMPT).map(toolLabel).join('、')}」外每个写入都可在对话里一键撤销`);
	expect(text).not.toContain('外部·');
	expect(text).not.toContain('读取工作区');   // 读类不进「能做什么」
});

it('🔴 面板文案 = 「开启后,」+ 生成句 + 「。默认关闭。」;空目录也不炸', ()=>{
	expect(agentAbilityCopyText()).toBe(`开启后,${agentAbilityCopy(listTools())}。默认关闭。`);
	expect(agentAbilityCopy([])).toContain('所有写入只增不删');
});

// [Q-294/M-109·AR-26] 本机 MCP 首开确认文案 ≡ 目录里对 origin=mcp 开放的工具:改设置 / 切换界面 / 出网 都要在;只对 in-app 开放的工具不进句;不再宣称「不会删除或覆盖」
it('🔴 MCP 首开确认文案由目录生成:含 mcp 可达的写入 / 界面 / 出网工具,不含仅 in-app 工具,不含「不会删除或覆盖」;面板函数与生成句逐字相等', ()=>{
	registerBuiltinTools();
	const defs = listTools();
	const text = mcpConfirmCopy(defs);
	defs.filter((d)=>d.level === 'additive' && (!d.origins || d.origins.indexOf('mcp') >= 0)).forEach((d)=>expect(text).toContain(toolLabel(d.name)));
	defs.filter((d)=>Array.isArray(d.origins) && d.origins.indexOf('mcp') < 0).forEach((d)=>expect(text).not.toContain(toolLabel(d.name)));
	expect(text).toContain('切换界面');
	expect(text).toContain('出网');
	expect(text).toContain('独立审批档');
	expect(text).not.toContain('不会删除或覆盖');
	expect(mcpConfirmCopyText()).toBe(mcpConfirmCopy(listTools()));
	expect(mcpConfirmCopy([])).toContain('读取快照与无头起盘');
});
