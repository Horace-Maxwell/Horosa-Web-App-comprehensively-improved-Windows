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

const EXPECTED = ['resolve_place', 'list_records', 'get_current_context', 'describe_settings', 'get_settings', 'cast_technique', 'create_chart_record', 'create_case_record', 'set_settings', 'load_record_into_workspace', 'ask_user', 'list_actions', 'search_materials', 'create_goal_task', 'schedule_task', 'web_search', 'note_progress', 'web_fetch', 'run_analysis', 'navigate_to_technique', 'compare_records', 'star_record', 'pin_record', 'add_record_tag',
	// 外部客户端读面补齐(任务 / 合盘 / 天星择日 / 玄学史 / 当前页 / 私人内容三件)
	'list_tasks', 'get_task', 'cast_relative', 'list_election_conditions', 'search_election', 'explain_election', 'search_xuanshi', 'get_xuanshi_item', 'read_current_page', 'list_conversations', 'get_conversation', 'get_record_detail',
	// 只增写入(断事日志 / 关系边)与界面动作(对话挂载)
	'append_record_journal', 'link_records', 'set_chat_mount',
	// 按用户起卦结果建事盘 + 输入格式目录
	'list_divination_casts', 'cast_divination_case',
	// 档案提案(只挂提案,采纳只由用户在任务中心决定)
	'propose_record_edit', 'propose_record_archive', 'list_proposals',
	// 各流派择日搜索
	'list_zeri_conditions', 'search_zeri', 'explain_zeri',
	// 名人库(检索 / 分类 / 详情 只读 + 存成命盘 只增)
	'search_celebrities', 'list_celebrity_categories', 'get_celebrity', 'create_celebrity_chart'];
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

// 禁键扫描:运行层守卫只看顶层参数键(guardAdditive),所以——
// ① 顶层出现任何禁键都判红(载入工具的顶层 cid 由 referenceKeys 显式声明放行,下一组锁定只此一件);
// ② 嵌套在引用对象里的 cid(cast_technique / run_analysis 的 source、cast_relative 的 a / b)只许读类工具:
//    读类不写库,cid 只是「指认哪张档案」;写类 / 界面类嵌套 cid 一律判红,其它禁键嵌套也判红。
function forbiddenSchemaHits(d){
	const top = Object.keys((d.inputSchema && d.inputSchema.properties) || {});
	const all = collectKeys(d.inputSchema, []);
	const hits = [];
	top.forEach((k)=>{ if(FORBIDDEN_ARG_KEYS.indexOf(k) >= 0 && !(d.name === 'load_record_into_workspace' && k === 'cid')){ hits.push(k); } });
	const nestedKeys = all.slice();
	top.forEach((k)=>{ const i = nestedKeys.indexOf(k); if(i >= 0){ nestedKeys.splice(i, 1); } });
	nestedKeys.forEach((k)=>{ if(FORBIDDEN_ARG_KEYS.indexOf(k) >= 0 && !(k === 'cid' && d.level === 'read')){ hits.push(k); } });
	return hits;
}

beforeEach(()=>{ __resetToolsForTests(); });

describe('目录形状', ()=>{
	it('内置五十一件恰好注册,名字集合精确', ()=>{
		const names = registerBuiltinTools().map((t)=>t.name).sort();
		expect(names).toEqual([...EXPECTED].sort());
		expect(BUILTIN_TOOL_DEFS.length).toBe(51);
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
			const hit = forbiddenSchemaHits(d);
			expect(`${d.name}: ${hit.join(',')}`).toBe(`${d.name}: `);
		});
	});
	it('判别向量:顶层禁键 / 写类嵌套 cid / 读类嵌套其它禁键 一律判红;读类引用对象里的 cid 放行', ()=>{
		const nested = (key)=>({ type: 'object', additionalProperties: false, properties: { source: { type: 'object', properties: { [key]: { type: 'string' } } } } });
		expect(forbiddenSchemaHits({ name: 'probe_a', level: 'additive', inputSchema: nested('cid') })).toEqual(['cid']);
		expect(forbiddenSchemaHits({ name: 'probe_b', level: 'read', inputSchema: { type: 'object', properties: { cid: { type: 'string' } } } })).toEqual(['cid']);
		expect(forbiddenSchemaHits({ name: 'probe_c', level: 'read', inputSchema: nested('deletedAt') })).toEqual(['deletedAt']);
		expect(forbiddenSchemaHits({ name: 'probe_d', level: 'read', inputSchema: nested('cid') })).toEqual([]);
		expect(forbiddenSchemaHits({ name: 'probe_e', level: 'ui', inputSchema: nested('cid') })).toEqual(['cid']);
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

describe('同参去重准入(cacheable)合同', ()=>{
	it('cacheable 只出现在 read 级;四件纯查询工具已声明;cacheKey 若有必为函数;manifest 不带 cacheable/cacheKey', ()=>{
		BUILTIN_TOOL_DEFS.forEach((d)=>{
			if(d.cacheable !== undefined){ expect(typeof d.cacheable).toBe('boolean'); }
			if(d.cacheable){ expect(d.level).toBe('read'); }
			if(d.cacheKey !== undefined){ expect(typeof d.cacheKey).toBe('function'); }
		});
		['list_records', 'describe_settings', 'get_settings', 'resolve_place'].forEach((n)=>{ expect(BUILTIN_TOOL_DEFS.find((d)=>d.name === n).cacheable).toBe(true); });
		registerBuiltinTools();
		exportToolManifest().forEach((t)=>{ expect(t.cacheable).toBeUndefined(); expect(t.cacheKey).toBeUndefined(); });
		// 判别向量:写入类声明 cacheable / cacheKey 非函数 → 注册即拒
		const { registerTool } = require('../aiTools/registry');
		const base = { level: 'additive', undoKind: 'none', description: `x ${GUIDE_PHRASE}`, inputSchema: { type: 'object', additionalProperties: false, properties: {} }, run: async ()=>({ ok: true }) };
		expect(()=>registerTool({ ...base, name: 'probe_write_cache', cacheable: true })).toThrow(/read/);
		expect(()=>registerTool({ ...base, name: 'probe_read_key', level: 'read', cacheKey: 'nope' })).toThrow(/cacheKey/);
		expect(()=>registerTool({ ...base, name: 'probe_read_flag', level: 'read', cacheable: 'yes' })).toThrow(/cacheable/);
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
		// 只看执行主体 runToolOnce(预查函数 peekNoChange 里也有守卫 / 校验,序同样是守卫先于 Ajv)
		const all = fs.readFileSync(path.join(TOOLS_DIR, 'registry.js'), 'utf8');
		const body = all.slice(all.indexOf('async function runToolOnce('));
		expect(body.length).toBeLessThan(all.length);
		const src = body.split('\n');
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

// 按源码静态读目录的工具(按写入级别把全部写入工具收进组合用例)只认一种定义写法:工具对象第一行 name、紧跟 level,
// 写入级工具的功能开关写成 enabled: ()=>开关函数()。换了写法 = 那件工具从静态读出的目录里消失(新写入工具没进组合用例也没人知道)→ 这里红。
describe('目录定义写法(静态读目录的前提)', ()=>{
	const DEF_RE = /\n\tname: '([a-z_]+)',\n\tlevel: '([a-z]+)',\n((?:\t[^\n]*\n){0,8})/g;
	function staticCatalog(){
		const out = {};
		fs.readdirSync(path.join(TOOLS_DIR, 'tools')).filter((n)=>n.endsWith('.js')).forEach((n)=>{
			const src = fs.readFileSync(path.join(TOOLS_DIR, 'tools', n), 'utf8');
			let m;
			DEF_RE.lastIndex = 0;
			while((m = DEF_RE.exec(src))){
				const en = /\tenabled: \(\)=>(\w+)\(\)/.exec(m[3]);
				out[m[1]] = { level: m[2], enabled: !!en };
			}
		});
		return out;
	}
	test('注册后的每件工具都能按源码读出名字、级别与有无功能开关,且与运行时一致', ()=>{
		const live = registerBuiltinTools();
		const stat = staticCatalog();
		// 写入级的功能开关要读得出来(组合用例据此打开开关,否则拿到「未启用」);只读级只要名字与级别
		const bad = live.filter((d)=>!stat[d.name] || stat[d.name].level !== d.level || (d.level === 'additive' && stat[d.name].enabled !== (typeof d.enabled === 'function'))).map((d)=>`${d.name}:${d.level}`);
		expect(bad).toEqual([]);
		expect(live.filter((d)=>d.level === 'additive').length).toBeGreaterThan(10);
	});
	test('判别力:name 与 level 之间插了别的键 / 开关不是 ()=>函数() 写法 → 读不到', ()=>{
		const one = (src)=>{ DEF_RE.lastIndex = 0; const m = DEF_RE.exec(src); return m ? [m[1], m[2], !!/\tenabled: \(\)=>(\w+)\(\)/.exec(m[3])] : null; };
		expect(one("export default {\n\tname: 'x_tool',\n\tlevel: 'additive',\n\tenabled: ()=>isOn(),\n};\n")).toEqual(['x_tool', 'additive', true]);
		expect(one("export default {\n\tname: 'x_tool',\n\tcategory: 'records',\n\tlevel: 'additive',\n};\n")).toBe(null);
		expect(one("export default {\n\tname: 'x_tool',\n\tlevel: 'additive',\n\tenabled: isOn,\n};\n")).toEqual(['x_tool', 'additive', false]);
	});
});
