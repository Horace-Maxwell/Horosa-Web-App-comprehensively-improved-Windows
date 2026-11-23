// 外部智能体看到的那一面:
//  ① 不认的参数键:写入类拒(零写入),读类照做并在回包里点名 —— 此前一律静默剥掉(add_record_tag remove:true 反而把标签加上、拼错的 maxchars 不报错);
//  ② 结果信封:失败恒带 retryable / hint,限流带 retryAfterMs;起盘假设、撤销句柄、被忽略的参数并进 structuredContent;
//  ③ tools/list 投影:只读工具去掉给应用内对话写的克制语;参数结构降成各家接口都收的子集(顶层无组合子、无 if/then、数组必带 items);
//  ④ 技法清单工具与 cast_technique 的技法枚举同一张表。
import { registerTool, runTool, __resetToolsForTests, unknownArgPaths, exportToolManifest } from '../aiTools/registry';
import { registerBuiltinTools } from '../aiTools';
import { externalEnvelope, structuredWithEnvelope, externalToolFace, checkExternalLimits, __resetMcpBridgeForTests } from '../aiAgent/mcpBridge';
import { buildTechniqueRows } from '../aiTools/tools/listTechniques';
import { ANALYSIS_CHART_TECHNIQUES, ANALYSIS_CASE_TECHNIQUES, PAGE_SNAPSHOT_ONLY_TECHNIQUES, listAnalysisTechniqueOptions } from '../aiAnalysisContext';
import { TOOL_ERROR_CODES } from '../aiTools/errorCodes';

const READ = { name: 't_read', level: 'read', undoKind: 'none', description: 'x 仅当用户明确要求时调用', inputSchema: { type: 'object', additionalProperties: false, properties: { q: { type: 'string' }, source: { type: 'object', additionalProperties: false, properties: { kind: { type: 'string' } } }, options: { type: 'object', additionalProperties: true }, rows: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { a: { type: 'integer' } } } } } } };

beforeEach(()=>{ __resetToolsForTests(); window.localStorage.clear(); });

describe('① 不认的参数键', ()=>{
	test('逐层查:顶层 / 嵌套对象 / 数组元素;开放对象(options)不查;最多 20 条', ()=>{
		expect(unknownArgPaths(READ.inputSchema, { q: 'a', maxchars: 5 })).toEqual(['maxchars']);
		expect(unknownArgPaths(READ.inputSchema, { source: { kind: 'natal', brith: 'x' } })).toEqual(['source.brith']);
		expect(unknownArgPaths(READ.inputSchema, { 'source.kind': 'natal' })).toEqual(['source.kind']);
		expect(unknownArgPaths(READ.inputSchema, { options: { anything: 1 } })).toEqual([]);
		expect(unknownArgPaths(READ.inputSchema, { rows: [{ a: 1 }, { a: 2, b: 3 }] })).toEqual(['rows[1].b']);
		expect(unknownArgPaths(READ.inputSchema, { q: 'ok' })).toEqual([]);
		const many = {}; for(let i = 0; i < 40; i++){ many[`k${i}`] = 1; }
		expect(unknownArgPaths(READ.inputSchema, many)).toHaveLength(20);
	});
	test('🔴 写入类:带不认的键 = 拒、不执行、不进账本;回包列出不认的键与可用的键', async ()=>{
		const run = jest.fn(async ()=>({ ok: true, data: {} }));
		registerTool({ name: 't_write', level: 'additive', undoKind: 'none', description: 'x', inputSchema: { type: 'object', additionalProperties: false, required: ['recordId'], properties: { recordId: { type: 'string' }, tag: { type: 'string' } } }, run });
		const r = await runTool('t_write', { recordId: 'local-1', tag: 'a', remove: true }, { origin: 'mcp' });
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_ARGS_INVALID');
		expect(r.message).toContain('remove');
		expect(r.data.unknownArgs).toEqual(['remove']);
		expect(r.data.allowedArgs).toEqual(['recordId', 'tag']);
		expect(run).not.toHaveBeenCalled();
		// 对照:不带那个键照常执行
		expect((await runTool('t_write', { recordId: 'local-1', tag: 'a' }, { origin: 'mcp' })).ok).toBe(true);
		expect(run).toHaveBeenCalledTimes(1);
	});
	test('读类:照做,回包带 ignoredArgs 并在 assumptions 里点名;没有多余键时两样都不加', async ()=>{
		const run = jest.fn(async (args)=>({ ok: true, data: { got: args }, assumptions: ['原有假设'] }));
		registerTool({ ...READ, run });
		const r = await runTool('t_read', { q: 'a', maxchars: 5, source: { kind: 'natal', foo: 1 } }, { origin: 'mcp' });
		expect(r.ok).toBe(true);
		expect(r.ignoredArgs).toEqual(['maxchars', 'source.foo']);
		expect(r.assumptions[0]).toBe('原有假设');
		expect(r.assumptions[1]).toContain('maxchars');
		expect(run.mock.calls[0][0]).toEqual({ q: 'a', source: { kind: 'natal' } });   // 工具拿到的仍是剥过的参数
		const clean = await runTool('t_read', { q: 'a' }, { origin: 'mcp' });
		expect(clean.ignoredArgs).toBeUndefined();
		expect(clean.assumptions).toEqual(['原有假设']);
	});
});

describe('② 结果信封', ()=>{
	test('失败:retryable 查表(工具显式给了照工具的)+ hint = 表里的下一步;成功两样都不带;恒标 untrusted', ()=>{
		const bad = externalEnvelope({ ok: false, code: 'E_RECORD_NOT_FOUND', message: '未找到' });
		expect(bad.retryable).toBe(false);
		expect(bad.hint).toBe(TOOL_ERROR_CODES.E_RECORD_NOT_FOUND.act);
		expect(bad.untrusted).toBe(true);
		expect(externalEnvelope({ ok: false, code: 'E_CAST_BACKEND_FAILED', message: 'x' }).retryable).toBe(true);
		expect(externalEnvelope({ ok: false, code: 'E_RECORD_NOT_FOUND', message: 'x', retryable: true }).retryable).toBe(true);
		const ok = externalEnvelope({ ok: true, data: { a: 1 }, assumptions: ['按男起盘'], ignoredArgs: ['x'], undo: { actionId: 'act-1' } });
		expect('retryable' in ok).toBe(false);
		expect('hint' in ok).toBe(false);
		expect(ok.assumptions).toEqual(['按男起盘']);
		expect(ok.ignoredArgs).toEqual(['x']);
		expect(ok.untrusted).toBe(true);
	});
	test('两处开关类的下一步写明桌面与无头两种做法', ()=>{
		['E_APPROVAL_DENIED', 'E_TOOL_DISABLED'].forEach((c)=>{ expect(TOOL_ERROR_CODES[c].act).toContain('桌面'); expect(TOOL_ERROR_CODES[c].act).toContain('./horosa config'); });
	});
	test('🔴 限流:可重试并给出还要等多久(桶里最早一条滑出窗口);写入额度同理', ()=>{
		__resetMcpBridgeForTests();
		const policy = { approval: 'auto', maxCallsPerMinute: 2, maxAdditivePerHour: 1 };
		const t0 = 1000000;
		expect(checkExternalLimits('c1', 'read', policy, t0).ok).toBe(true);
		expect(checkExternalLimits('c1', 'read', policy, t0 + 10000).ok).toBe(true);
		const over = checkExternalLimits('c1', 'read', policy, t0 + 15000);
		expect(over).toMatchObject({ ok: false, code: 'E_LIMIT', retryable: true, retryAfterMs: 45000 });
		const env = externalEnvelope(over);
		expect(env.retryable).toBe(true);
		expect(env.retryAfterMs).toBe(45000);
		// 窗口滑过之后放行
		expect(checkExternalLimits('c1', 'read', policy, t0 + 60001).ok).toBe(true);
	});
	test('structuredContent:补上 data 里没有的信封键,不覆盖工具自己的同名字段,空值不补', ()=>{
		const env = externalEnvelope({ ok: true, message: '已建档', assumptions: ['时区按地点推断'], undo: { actionId: 'act-9', kind: 'trash-record' }, replayed: true, data: { cid: 'local-1', message: '工具自己的' } });
		const sc = structuredWithEnvelope({ cid: 'local-1', message: '工具自己的' }, env);
		expect(sc).toEqual({ cid: 'local-1', message: '工具自己的', assumptions: ['时区按地点推断'], undo: { actionId: 'act-9', kind: 'trash-record' }, replayed: true });
		expect(structuredWithEnvelope({ a: 1 }, externalEnvelope({ ok: true, data: { a: 1 } }))).toEqual({ a: 1 });
	});
});

describe('③ tools/list 投影', ()=>{
	test('只读工具去掉克制语,写入类保留;连续句号收成一个', ()=>{
		const read = externalToolFace({ name: 'r', level: 'read', category: 'query', description: '读取设置。仅当用户明确要求时调用。', inputSchema: { type: 'object', properties: {} } });
		expect(read.description).toBe('读取设置。');
		const read2 = externalToolFace({ name: 'r2', level: 'read', category: 'query', description: '起盘。仅当用户明确要求时调用:仅当用户要求分析某技法时调用。。后文', inputSchema: { type: 'object', properties: {} } });
		expect(read2.description).toBe('起盘。仅当用户要求分析某技法时调用。后文');
		const write = externalToolFace({ name: 'w', level: 'additive', category: 'records', description: '新建命盘。仅当用户明确要求时调用。', inputSchema: { type: 'object', properties: {} } });
		expect(write.description).toContain('仅当用户明确要求时调用');
		const ui = externalToolFace({ name: 'u', level: 'read', category: 'ui', description: '切页。仅当用户明确要求时调用。', inputSchema: { type: 'object', properties: {} } });
		expect(ui.description).toContain('仅当用户明确要求时调用');
	});
	test('参数结构:顶层 anyOf 摘掉并把「至少给其一」写进说明;嵌套 if/then/allOf 摘掉;数组补 items;原定义不被改动', () => {
		const schema = { type: 'object', additionalProperties: false, anyOf: [{ required: ['place'] }, { required: ['gpsLat', 'gpsLon'] }], properties: { place: { type: 'string' }, source: { type: 'object', properties: { kind: { type: 'string' } }, allOf: [{ if: { properties: { kind: { const: 'record' } } }, then: { required: ['cid'] } }] }, values: { type: ['object', 'array'] } } };
		const frozen = JSON.stringify(schema);
		const face = externalToolFace({ name: 'c', level: 'additive', category: 'records', description: '新建', inputSchema: schema });
		expect(face.inputSchema.anyOf).toBeUndefined();
		expect(face.inputSchema.properties.source.allOf).toBeUndefined();
		expect(face.inputSchema.properties.values.items).toEqual({});
		expect(face.inputSchema.additionalProperties).toBe(false);
		expect(face.description).toBe('新建。参数里以下几组至少给一组:place;或 gpsLat + gpsLon。');
		expect(JSON.stringify(schema)).toBe(frozen);
	});
	test('🔴 整份内置目录过投影:无一处组合子 / if-then / 缺 items 的数组;每件工具仍有名字、说明、object 型参数结构', ()=>{
		registerBuiltinTools();
		const bad = [];
		const walk = (o, p, top)=>{
			if(Array.isArray(o)){ o.forEach((v, i)=>walk(v, `${p}[${i}]`, top)); return; }
			if(!o || typeof o !== 'object'){ return; }
			Object.keys(o).forEach((k)=>{ if(['anyOf', 'oneOf', 'allOf', 'if', 'then', 'else', 'not'].indexOf(k) >= 0 && p.split('.').pop() !== 'properties'){ bad.push(`${top}:${p}.${k}`); } walk(o[k], `${p}.${k}`, top); });
			const ts = Array.isArray(o.type) ? o.type : [o.type];
			if(ts.indexOf('array') >= 0 && o.items === undefined && typeof o.type !== 'object'){ bad.push(`${top}:${p} 数组无 items`); }
		};
		const all = exportToolManifest({ includeExternal: false, includeDisabled: true, origin: 'mcp' }).map(externalToolFace);
		expect(all.length).toBeGreaterThan(40);
		all.forEach((t)=>{ expect(t.name).toBeTruthy(); expect(`${t.description}`.length).toBeGreaterThan(10); expect(t.inputSchema.type).toBe('object'); walk(t.inputSchema, '', t.name); });
		expect(bad).toEqual([]);
		// 判别:投影前确实有组合子(否则上面的断言是空转)
		const raw = exportToolManifest({ includeExternal: false, includeDisabled: true, origin: 'mcp' });
		expect(raw.some((t)=>JSON.stringify(t.inputSchema).indexOf('"anyOf"') >= 0 || JSON.stringify(t.inputSchema).indexOf('"allOf"') >= 0)).toBe(true);
	});
});

describe('④ 技法清单', ()=>{
	test('覆盖两张登记表与起课时间可起集的全部键,一键一行', ()=>{
		const rows = buildTechniqueRows();
		const keys = rows.map((r)=>r.key);
		expect(new Set(keys).size).toBe(keys.length);
		const want = new Set([...ANALYSIS_CHART_TECHNIQUES, ...ANALYSIS_CASE_TECHNIQUES, ...listAnalysisTechniqueOptions({ sourceType: 'timepoint' }).map((o)=>o.value)]);
		expect(new Set(keys)).toEqual(want);
		rows.forEach((r)=>{ expect(r.label).toBeTruthy(); expect(r.sources.length).toBeGreaterThan(0); });
	});
	test('来源与现算 / 只读已存的标注同登记表一致', ()=>{
		const rows = buildTechniqueRows();
		const byKey = {}; rows.forEach((r)=>{ byKey[r.key] = r; });
		const tp = new Set(listAnalysisTechniqueOptions({ sourceType: 'timepoint' }).map((o)=>o.value));
		rows.forEach((r)=>{ expect(r.sources.indexOf('timepoint') >= 0).toBe(tp.has(r.key)); });
		ANALYSIS_CHART_TECHNIQUES.forEach((k)=>{
			// 只读已存结果的(合盘等)临时出生资料起不出来,只标已存档案
			expect(byKey[k].sources).toEqual(PAGE_SNAPSHOT_ONLY_TECHNIQUES.indexOf(k) >= 0 ? ['record'] : expect.arrayContaining(['record', 'natal']));
			expect(byKey[k].compute).toBe(PAGE_SNAPSHOT_ONLY_TECHNIQUES.indexOf(k) >= 0 ? 'stored' : 'compute');
		});
		ANALYSIS_CASE_TECHNIQUES.filter((k)=>ANALYSIS_CHART_TECHNIQUES.indexOf(k) < 0).forEach((k)=>{ expect(byKey[k].compute).toBe(tp.has(k) ? 'compute' : 'stored'); expect(byKey[k].sources.indexOf('natal')).toBe(-1); });
		expect(byKey.relative.note).toContain('cast_relative');
		// 派生盘五张如今能现算(此前只能读辅盘页已出的)
		['hellenastro', 'dwadasamsa', 'harmonic', 'draconic', 'relocation'].forEach((k)=>expect(byKey[k].compute).toBe('compute'));
	});
});

describe('cast_technique 拒绝话术写中文名', ()=>{
	it('合盘用临时出生资料起 → 话术写「合盘」并括注技法键,不只念键名', async ()=>{
		registerBuiltinTools();
		const { setAgentEnabled } = require('../aiAgent/prefs');
		setAgentEnabled(true);
		try{
			const r = await runTool('cast_technique', { technique: 'relative', source: { kind: 'natal', birth: '1990-01-01 08:00', gpsLat: 39.9, gpsLon: 116.4, zone: '+08:00' } }, { origin: 'mcp', requestId: 't:0:c1' });
			expect(r.code).toBe('E_TECHNIQUE_NOT_ALLOWED');
			expect(r.message).toMatch(/^「[^」a-z]+」\(relative\)/);
		}finally{ setAgentEnabled(false); }
	});
});
