// AI 助手·工具目录合同(静态):目录形状、只增不删的四层机械保证、import 图守卫。
// 这些断言是「哨兵」——绿本身不是证据,所以每组都带判别向量。
const fs = require('fs');
const path = require('path');
import Ajv from 'ajv';
import { registerBuiltinTools, BUILTIN_TOOL_DEFS } from '../aiTools';
import { exportToolManifest, __resetToolsForTests } from '../aiTools/registry';
import { AGENT_TOOL_LEVELS, AGENT_UNDO_KINDS, TOOL_NAME_PATTERN, DENIED_TOOL_NAME_RE, FORBIDDEN_ARG_KEYS, GUIDE_PHRASE, TOOL_CATEGORIES, TOOL_ORIGINS } from '../aiTools/catalog';
import { CASE_TYPE_OPTIONS } from '../localcases';
import { TIME_CASTABLE_DIVINATION } from '../aiAnalysisContext';
import { TIME_CASTABLE_MIRROR } from '../aiTools/normalize/caseType';

const EXPECTED = ['resolve_place', 'list_records', 'get_current_context', 'describe_settings', 'get_settings', 'cast_technique', 'create_chart_record', 'create_case_record', 'set_settings', 'load_record_into_workspace', 'ask_user', 'list_actions', 'search_materials', 'create_goal_task', 'schedule_task', 'web_search', 'note_progress', 'web_fetch', 'run_analysis', 'navigate_to_technique', 'compare_records', 'star_record', 'pin_record', 'add_record_tag'];
const TOOLS_DIR = path.resolve(__dirname, '..', 'aiTools');

function walk(dir, out){
	fs.readdirSync(dir).forEach((n)=>{
		const full = path.join(dir, n);
		if(fs.statSync(full).isDirectory()){ walk(full, out); }else if(n.endsWith('.js')){ out.push(full); }
	});
	return out;
}
function code(file){
	return fs.readFileSync(file, 'utf8').split('\n').filter((l)=>!/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
}
function collectKeys(schema, out){
	if(!schema || typeof schema !== 'object'){ return out; }
	if(schema.properties){ Object.keys(schema.properties).forEach((k)=>{ out.push(k); collectKeys(schema.properties[k], out); }); }
	['oneOf', 'anyOf', 'allOf'].forEach((kw)=>{ (schema[kw] || []).forEach((s)=>collectKeys(s, out)); });
	if(schema.items){ collectKeys(schema.items, out); }
	return out;
}

beforeEach(()=>{ __resetToolsForTests(); });

describe('目录形状', ()=>{
	it('内置二十四件恰好注册,名字集合精确', ()=>{
		const names = registerBuiltinTools().map((t)=>t.name).sort();
		expect(names).toEqual([...EXPECTED].sort());
		expect(BUILTIN_TOOL_DEFS.length).toBe(24);
	});
	it('每件:命名正则/level 正向集合/undoKind 集合/描述含引导句/顶层 additionalProperties:false', ()=>{
		BUILTIN_TOOL_DEFS.forEach((d)=>{
			expect(TOOL_NAME_PATTERN.test(d.name)).toBe(true);
			expect(DENIED_TOOL_NAME_RE.test(d.name)).toBe(false);
			expect(AGENT_TOOL_LEVELS).toContain(d.level);
			expect(AGENT_UNDO_KINDS).toContain(d.undoKind);
			expect(d.description.indexOf(GUIDE_PHRASE)).toBeGreaterThanOrEqual(0);
			expect(d.inputSchema.type).toBe('object');
			expect(d.inputSchema.additionalProperties).toBe(false);
			expect(typeof d.run).toBe('function');
			// P0:类别 ∈ 表(审批按类别收紧的依据);enabled 若声明须函数;内置件 origin 缺省或 builtin
			expect(TOOL_CATEGORIES).toContain(d.category);
			if(d.enabled !== undefined){ expect(typeof d.enabled).toBe('function'); }
			if(d.origin !== undefined){ expect(d.origin).toBe('builtin'); }
		});
	});
	it('restore-settings 类必带 snapshot;read 类 undoKind 必为 none', ()=>{
		BUILTIN_TOOL_DEFS.forEach((d)=>{
			if(d.undoKind === 'restore-settings'){ expect(typeof d.snapshot).toBe('function'); }
			if(d.level === 'read'){ expect(d.undoKind).toBe('none'); }
		});
	});
	it('manifest 纯 JSON 往返恒等,且 destructiveHint 恒 false', ()=>{
		registerBuiltinTools();
		const m = exportToolManifest();
		expect(JSON.parse(JSON.stringify(m))).toEqual(m);
		m.forEach((t)=>{
			expect(t.annotations.destructiveHint).toBe(false);
			// 界面动作(ui 类别)改的是页面状态:对外部客户端不标 readOnly(它会把只读工具当成可随意调用)
			expect(t.annotations.readOnlyHint).toBe(t.level === 'read' && t.category !== 'ui');
			expect(TOOL_CATEGORIES).toContain(t.category);
			expect(t.origin).toBe('builtin');
		});
	});
	it('每个 inputSchema 可被 Ajv 编译(coerce/defaults 同 runTool 配置)', ()=>{
		const ajv = new Ajv({ allErrors: true, strict: false, coerceTypes: true, useDefaults: true });
		BUILTIN_TOOL_DEFS.forEach((d)=>{ expect(typeof ajv.compile(d.inputSchema)).toBe('function'); });
	});
});

describe('只增不删·schema 层', ()=>{
	it('任何工具的 schema 树里都不出现禁键(cid 等内核元字段)', ()=>{
		BUILTIN_TOOL_DEFS.forEach((d)=>{
			const keys = collectKeys(d.inputSchema, []);
			const hit = keys.filter((k)=>FORBIDDEN_ARG_KEYS.indexOf(k) >= 0 && !(d.name === 'load_record_into_workspace' || d.name === 'cast_technique'));
			expect(`${d.name}: ${hit.join(',')}`).toBe(`${d.name}: `);
		});
	});
	it('🔴 引用键放行只允许载入工具声明;写库类(trash-record)永不声明 referenceKeys', ()=>{
		BUILTIN_TOOL_DEFS.forEach((d)=>{
			if(d.name === 'load_record_into_workspace'){ expect(d.referenceKeys).toEqual(['cid']); return; }
			expect(d.referenceKeys).toBeUndefined();
		});
	});
	it('判别向量:禁键集合本身含 cid(哨兵锚)', ()=>{
		expect(FORBIDDEN_ARG_KEYS).toContain('cid');
		expect(FORBIDDEN_ARG_KEYS).toContain('deletedAt');
	});
	it('事盘类型枚举 = CASE_TYPE_OPTIONS 值集(toEqual 锁)', ()=>{
		const def = BUILTIN_TOOL_DEFS.find((d)=>d.name === 'create_case_record');
		expect(def.inputSchema.properties.caseType.enum).toEqual(CASE_TYPE_OPTIONS.map((o)=>o.value));
	});
	it('可凭时间起盘镜像 = 权威常量(toEqual 锁;常量不可搬家)', ()=>{
		expect(TIME_CASTABLE_MIRROR).toEqual(TIME_CASTABLE_DIVINATION);
	});
});

describe('只增不删·静态层(import 图守卫)', ()=>{
	const files = walk(TOOLS_DIR, []);
	it('扫描器看得见目录(≥ 20 文件)', ()=>{ expect(files.length).toBeGreaterThanOrEqual(20); });
	it('禁裸 localStorage.setItem/removeItem', ()=>{
		const bad = files.filter((f)=>/localStorage\.(setItem|removeItem|clear)\s*\(/.test(code(f)));
		expect(bad.map((f)=>path.relative(TOOLS_DIR, f))).toEqual([]);
	});
	it('禁 import 备份/交换格式/回收站清理/回收站恢复', ()=>{
		const re = /from\s+['"][^'"]*(unifiedBackup|interchangeFormats|purgeTrash|clearTrash|FromTrash)[^'"]*['"]/;
		const bad = files.filter((f)=>re.test(code(f)));
		expect(bad.map((f)=>path.relative(TOOLS_DIR, f))).toEqual([]);
	});
	it('removeLocalChart(/removeLocalCase( 只允许出现在 ledger.js 撤销路径', ()=>{
		const bad = files.filter((f)=>/removeLocal(Chart|Case)\s*\(/.test(code(f)) && path.basename(f) !== 'ledger.js');
		expect(bad.map((f)=>path.relative(TOOLS_DIR, f))).toEqual([]);
		expect(/removeLocal(Chart|Case)\s*\(/.test(code(path.join(TOOLS_DIR, 'ledger.js')))).toBe(true);
	});
	it('saveMountTechniqueDefaults( 只在 settingsFacets.js(带 token)与 ledger.js', ()=>{
		const bad = files.filter((f)=>/saveMountTechniqueDefaults\s*\(/.test(code(f)) && ['settingsFacets.js', 'ledger.js'].indexOf(path.basename(f)) < 0);
		expect(bad.map((f)=>path.relative(TOOLS_DIR, f))).toEqual([]);
		expect(fs.readFileSync(path.join(TOOLS_DIR, 'settingsFacets.js'), 'utf8').indexOf('[ai-tools:never-empty-mount-write]')).toBeGreaterThan(0);
	});
	it('判别向量:扫描器在人造违规上必须判红', ()=>{
		const tmp = path.join(TOOLS_DIR, 'tools', '__probe_forbidden__.js');
		fs.writeFileSync(tmp, "import { purgeTrash } from '../../unifiedBackup';\nlocalStorage.removeItem('x');\nremoveLocalChart('c');\n");
		try{
			const c = code(tmp);
			expect(/localStorage\.(setItem|removeItem|clear)\s*\(/.test(c)).toBe(true);
			expect(/removeLocal(Chart|Case)\s*\(/.test(c)).toBe(true);
			expect(/from\s+['"][^'"]*(unifiedBackup)[^'"]*['"]/.test(c)).toBe(true);
		}finally{ fs.unlinkSync(tmp); }
	});
});

describe('只增不删·注册表层(P0:外部来源/功能开关/注销限制)', ()=>{
	const { registerTool, unregisterTool, runTool, getTool } = require('../aiTools/registry');
	const base = { level: 'read', undoKind: 'none', description: `x ${GUIDE_PHRASE}`, inputSchema: { type: 'object', additionalProperties: false, properties: {} }, run: async ()=>({ ok: true, data: 1 }) };
	it('origin/category 值域校验;缺省 origin=builtin category=query', ()=>{
		expect(()=>registerTool({ ...base, name: 'probe_origin', origin: 'alien' })).toThrow(/origin/);
		expect(()=>registerTool({ ...base, name: 'probe_cat', category: 'nope' })).toThrow(/category/);
		expect(()=>registerTool({ ...base, name: 'probe_enabled', enabled: true })).toThrow(/enabled/);
		registerTool({ ...base, name: 'probe_defaults' });
		expect(getTool('probe_defaults')).toEqual(expect.objectContaining({ origin: 'builtin', category: 'query' }));
		expect(TOOL_ORIGINS).toEqual(['builtin', 'external']);
	});
	it('🔴 unregisterTool 只允许 origin external:内置件注销返回 false 且仍在;外部件注销 true 且消失', ()=>{
		registerBuiltinTools();
		expect(unregisterTool('create_chart_record')).toBe(false);
		expect(getTool('create_chart_record')).toBeTruthy();
		registerTool({ ...base, name: 'ext_probe_time', origin: 'external', category: 'external' });
		expect(exportToolManifest().some((t)=>t.name === 'ext_probe_time')).toBe(true);
		expect(exportToolManifest({ includeExternal: false }).some((t)=>t.name === 'ext_probe_time')).toBe(false);
		expect(unregisterTool('ext_probe_time')).toBe(true);
		expect(getTool('ext_probe_time')).toBeFalsy();
	});
	it('enabled() 为 false:不进 manifest(includeDisabled 才进);runTool → E_TOOL_DISABLED 且不执行', async ()=>{
		let on = false;
		const run = jest.fn(async ()=>({ ok: true }));
		registerTool({ ...base, name: 'probe_gated', enabled: ()=>on, run });
		expect(exportToolManifest().some((t)=>t.name === 'probe_gated')).toBe(false);
		expect(exportToolManifest({ includeDisabled: true }).some((t)=>t.name === 'probe_gated')).toBe(true);
		const r = await runTool('probe_gated', {}, { origin: 'in-app' });
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_TOOL_DISABLED');
		expect(run).not.toHaveBeenCalled();
		on = true;
		expect(exportToolManifest().some((t)=>t.name === 'probe_gated')).toBe(true);
		expect((await runTool('probe_gated', {}, { origin: 'in-app' })).ok).toBe(true);
	});
	it('禁用判定位于 getTool 之后、guardAdditive 之前(行号序;守卫仍先于 Ajv)', ()=>{
		const src = fs.readFileSync(path.join(TOOLS_DIR, 'registry.js'), 'utf8').split('\n');
		const at = (needle)=>src.findIndex((l)=>l.indexOf(needle) >= 0);
		const iGet = at('const def = getTool(name);');
		const iDis = at('if(!toolEnabled(def)){');
		const iGuard = at('const guard = guardAdditive(def.name, args, def.referenceKeys);');
		const iVal = at('const validated = validateArgs(def, args);');
		expect(iGet).toBeGreaterThan(0);
		expect(iDis).toBeGreaterThan(iGet);
		expect(iGuard).toBeGreaterThan(iDis);
		expect(iVal).toBeGreaterThan(iGuard);
	});
});
