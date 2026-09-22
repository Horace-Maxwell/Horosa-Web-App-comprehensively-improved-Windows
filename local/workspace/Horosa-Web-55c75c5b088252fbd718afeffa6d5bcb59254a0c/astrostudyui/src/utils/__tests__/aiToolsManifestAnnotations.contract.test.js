// [D89] MCP 导出面工具注解真话:openWorldHint 对出网类(external 类别 / 外部服务器工具)为 true(此前恒 false = 对 Codex/Claude Code 谎报「不出网」);
//   title = 中文标签单源;interactive 类带 anthropic/requiresUserInteraction(Claude Code 每次弹确认、不提供「不再问」);
//   负锚:运行时 toolDefs() 送上游的定义只含 name/description/inputSchema(注解只在 MCP 面,模型请求体字节零变)。
import { registerBuiltinTools } from '../aiTools';
import { exportToolManifest, registerTool, __resetToolsForTests } from '../aiTools/registry';
import { buildToolManifest, TOOL_CATEGORIES } from '../aiTools/catalog';
import { toolLabel } from '../aiTools/labels';
import { createAgentTurn } from '../aiAgent/runtime';
import { setAgentEnabled, setWebSearchEnabled, setWebFetchEnabled } from '../aiAgent/prefs';
import * as registry from '../aiTools/registry';

beforeEach(()=>{ window.localStorage.clear(); __resetToolsForTests(); registerBuiltinTools(); setAgentEnabled(true); setWebSearchEnabled(true); setWebFetchEnabled(true); });

it('🔴 openWorldHint:external 类别与外部服务器工具 true,其余 false;readOnlyHint 对 ui 类 false;destructiveHint 恒 false', ()=>{
	registerTool({ name: 'ext_demo_time', level: 'read', category: 'query', origin: 'external', description: 'd', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, run: async ()=>({ ok: true }) });
	const man = exportToolManifest({ includeExternal: true, includeDisabled: true });
	const by = {}; man.forEach((t)=>{ by[t.name] = t; });
	expect(by.web_search.annotations.openWorldHint).toBe(true);
	expect(by.web_fetch.annotations.openWorldHint).toBe(true);
	expect(by.ext_demo_time.annotations.openWorldHint).toBe(true);
	['list_records', 'create_chart_record', 'cast_technique', 'navigate_to_technique', 'ask_user'].forEach((n)=>{ expect(by[n].annotations.openWorldHint).toBe(false); });
	man.forEach((t)=>{
		expect(t.annotations.destructiveHint).toBe(false);
		expect(t.annotations.readOnlyHint).toBe(t.level === 'read' && t.category !== 'ui');
		expect(t.annotations.idempotentHint).toBe(t.level === 'read');
		expect(TOOL_CATEGORIES).toContain(t.category);
	});
});

it('🔴 title = 标签单源且非空;interactive 类(ask_user / note_progress)带 anthropic/requiresUserInteraction,其余无 _meta', ()=>{
	const man = exportToolManifest({ includeDisabled: true });
	man.forEach((t)=>{
		expect(t.title).toBe(toolLabel(t.name));
		expect(`${t.title || ''}`.length).toBeGreaterThan(0);
		if(t.category === 'interactive'){ expect(t._meta).toEqual({ 'anthropic/requiresUserInteraction': true }); }
		else{ expect(t._meta).toBeUndefined(); }
	});
	expect(man.filter((t)=>t.category === 'interactive').map((t)=>t.name).sort()).toEqual(['ask_user', 'note_progress']);
	// 纯函数形状:注解四键齐全且可 JSON 无损
	const one = buildToolManifest([{ name: 'x_tool', level: 'read', category: 'external', origin: 'builtin', description: 'd', inputSchema: { type: 'object' } }])[0];
	expect(JSON.parse(JSON.stringify(one)).annotations).toEqual({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true });
});

it('🔴 负锚:运行时送上游的工具定义只含 name/description/inputSchema(注解 / title / _meta 不进模型请求体)', ()=>{
	const agent = createAgentTurn({ profile: { id: 'p' }, model: 'm', registry });
	const defs = agent.toolDefs();
	expect(Array.isArray(defs) && defs.length).toBeTruthy();
	defs.forEach((d)=>{ expect(Object.keys(d).sort()).toEqual(['description', 'inputSchema', 'name']); });
});
