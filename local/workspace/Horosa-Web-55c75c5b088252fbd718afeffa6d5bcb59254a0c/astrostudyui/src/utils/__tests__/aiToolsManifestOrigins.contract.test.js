// [进阶复查 D14·2026-09-08] 每来源目录合同:运行时向模型宣告的目录 = exportToolManifest({ origin });
// 凡宣告的工具在该来源下 runTool 永不回 E_TOOL_DISABLED(宣告即可调;参数不合规回 E_ARGS_INVALID 等属正常)。
import { registerBuiltinTools } from '../aiTools';
import { exportToolManifest, runTool, __resetToolsForTests } from '../aiTools/registry';
import { TOOL_CALL_ORIGINS } from '../aiTools/catalog';
import { createAgentTurn } from '../aiAgent/runtime';
import { setAgentEnabled } from '../aiAgent/prefs';

beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); registerBuiltinTools(); setAgentEnabled(true); });

it('🔴 每个来源:运行时目录 = exportToolManifest({origin});in-app 含界面/旗标五件而 goal/automation/scheduled/orchestrate 不含', ()=>{
	const UI_FIVE = ['navigate_to_technique', 'compare_records', 'star_record', 'pin_record', 'add_record_tag'];
	expect(TOOL_CALL_ORIGINS).toContain('orchestrate');
	TOOL_CALL_ORIGINS.forEach((origin)=>{
		const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', origin });
		const names = (agent.toolDefs() || []).map((t)=>t.name);
		expect(`${origin}:${names.join(',')}`).toBe(`${origin}:${exportToolManifest({ origin }).map((t)=>t.name).join(',')}`);
		if(origin === 'in-app' || origin === 'mcp'){ UI_FIVE.forEach((n)=>expect(names).toContain(n)); }
		else { UI_FIVE.forEach((n)=>expect(names).not.toContain(n)); }
	});
});

it('🔴 宣告即可调:每来源目录里的每件工具,以该来源直呼都不回 E_TOOL_DISABLED', async ()=>{
	for(const origin of TOOL_CALL_ORIGINS){
		const names = exportToolManifest({ origin }).map((t)=>t.name);
		expect(names.length).toBeGreaterThan(5);
		for(const n of names){
			// 空参调用:能跑的跑,不能跑的回参数类码;唯独不许「宣告了却拒来源」
			const r = await runTool(n, {}, { origin, requestId: `t-${origin}-${n}` });
			expect(`${n}@${origin}=${r && r.code}`).not.toContain('E_TOOL_DISABLED');
		}
	}
});
