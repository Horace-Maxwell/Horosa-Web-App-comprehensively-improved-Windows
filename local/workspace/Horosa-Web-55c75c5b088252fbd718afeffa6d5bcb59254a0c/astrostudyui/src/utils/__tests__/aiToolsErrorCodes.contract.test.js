// AI 助手·工具错误码单一真源合同:
//   ① 源码扫描到的码集合 == errorCodes.js 冻结表 == docs/AI_AGENT_RUNTIME.md §8 表(三者相等,一个不多一个不少);
//   ② cast_technique 失败三路判别向量(异常态 / 后端失败标记 / 空快照)各出对应码,后端失败路 retryable=true 且 cause 无敏感键;
//   ③ 回喂信封 ok:false 恒带 retryable(缺省查表)与可选 cause;ok:true 不带这两键;判别戳与既有键序不变;
//   ④ 负锚:castTechnique.js 源码不含误导文案「需本机计算服务在线」(请求层故障不得说成计算服务离线);
//   ⑤ registry 写前快照失败 → E_SETTING_SNAPSHOT_FAILED(不再借用取值类码)。
// 这些断言是「哨兵」——绿本身不是证据,所以每组都带判别向量。
const fs = require('fs');
const path = require('path');

jest.mock('../aiAnalysisContext', ()=>({
	ANALYSIS_CHART_TECHNIQUES: ['astrochart', 'bazi'],
	ANALYSIS_CASE_TECHNIQUES: [],
	listAnalysisTechniqueOptions: jest.fn(()=>[{ value: 'astrochart' }, { value: 'bazi' }]),
	getAnalysisTechniqueContexts: jest.fn(async ()=>[]),
}));
jest.mock('../aiAnalysisSources', ()=>({ findAnalysisSourceById: jest.fn(()=>null) }));

import { TOOL_ERROR_CODES, TOOL_ERROR_CODE_LIST, TOOL_ERROR_LAYERS, getErrorMeta, isRetryable, sanitizeErrorCause, ERROR_CAUSE_KEYS } from '../aiTools/errorCodes';
import { formatToolResultContent } from '../aiAgent/protocol';
import { getAnalysisTechniqueContexts } from '../aiAnalysisContext';
import { recordRequestFailure, __resetRequestTelemetryForTests } from '../requestTelemetry';
import castTool from '../aiTools/tools/castTechnique';
import { registerTool, runTool, __resetToolsForTests } from '../aiTools/registry';

const UTILS_DIR = path.resolve(__dirname, '..');
const UI_ROOT = path.resolve(__dirname, '..', '..', '..');
const REPO_ROOT = path.resolve(UI_ROOT, '..', '..');
const DOC_PATH = path.join(REPO_ROOT, 'docs', 'AI_AGENT_RUNTIME.md');
const CAST_PATH = path.join(UTILS_DIR, 'aiTools', 'tools', 'castTechnique.js');
const SCAN_DIRS = [path.join(UTILS_DIR, 'aiTools'), path.join(UTILS_DIR, 'aiAgent'), path.join(UI_ROOT, 'src', 'integrations')];
const CODE_RE = /'(E_[A-Z0-9_]+)'/g;
const SENSITIVE_KEYS = ['body', 'headers', 'token', 'authorization', 'message', 'url'];

function walk(dir, out){
	if(!fs.existsSync(dir)){ return out; }
	fs.readdirSync(dir).forEach((n)=>{
		const full = path.join(dir, n);
		if(fs.statSync(full).isDirectory()){ walk(full, out); }else if(n.endsWith('.js') && !/\.(test|spec)\.js$/.test(n)){ out.push(full); }
	});
	return out;
}
// 剥单行注释/块注释行:注释里复写的码字面量不算「源码在用」(字面量哨兵×注释双向陷阱)
function codeText(file){
	return fs.readFileSync(file, 'utf8').split('\n').filter((l)=>!/^\s*(\/\/|\*|\/\*)/.test(l)).map((l)=>l.replace(/\/\/.*$/, '')).join('\n');
}
function scanSourceCodes(){
	const set = new Set();
	SCAN_DIRS.forEach((d)=>walk(d, []).filter((f)=>path.basename(f) !== 'errorCodes.js').forEach((f)=>{
		const txt = codeText(f);
		let m;
		while((m = CODE_RE.exec(txt)) !== null){ set.add(m[1]); }
	}));
	return set;
}
function docSection8Codes(){
	const md = fs.readFileSync(DOC_PATH, 'utf8');
	const start = md.search(/^## 8\./m);
	expect(start).toBeGreaterThanOrEqual(0);
	const rest = md.slice(start + 1);
	const next = rest.search(/^## /m);
	const sec = next >= 0 ? rest.slice(0, next) : rest;
	const set = new Set();
	sec.split('\n').forEach((line)=>{
		const m = /^\|\s*`(E_[A-Z0-9_]+)`\s*\|/.exec(line);
		if(m){ set.add(m[1]); }
	});
	return { set, sec };
}
const sorted = (s)=>Array.from(s).sort();

beforeEach(()=>{
	window.localStorage.clear();
	__resetRequestTelemetryForTests();
	getAnalysisTechniqueContexts.mockReset();
	getAnalysisTechniqueContexts.mockImplementation(async ()=>[]);
});

describe('① 三集合相等:源码扫描 == 冻结表 == 文档 §8', ()=>{
	it('源码里用到的每个 E_ 码都在表里,表里每个码源码都在用(含两枚新码)', ()=>{
		const scanned = scanSourceCodes();
		expect(scanned.size).toBeGreaterThanOrEqual(30);   // 判别向量:扫描器真扫到了东西
		expect(scanned.has('E_CAST_BACKEND_FAILED')).toBe(true);
		expect(scanned.has('E_SETTING_SNAPSHOT_FAILED')).toBe(true);
		expect(sorted(scanned)).toEqual(TOOL_ERROR_CODE_LIST.slice());
		expect(sorted(Object.keys(TOOL_ERROR_CODES))).toEqual(TOOL_ERROR_CODE_LIST.slice());
	});
	it('文档 §8 表逐码一行,集合与表相等;表头固定', ()=>{
		const { set, sec } = docSection8Codes();
		expect(sec.indexOf('| 码 | 层 | 可重试 | 产出方 | 用户可做 |')).toBeGreaterThanOrEqual(0);
		expect(sorted(set)).toEqual(TOOL_ERROR_CODE_LIST.slice());
	});
	it('表项形状:layer∈枚举、retryable 布尔、act/emit/userText 非空、since 为 ISO 日期;表与列表冻结;唯一可重试码=后端起盘失败', ()=>{
		TOOL_ERROR_CODE_LIST.forEach((code)=>{
			const m = TOOL_ERROR_CODES[code];
			expect(TOOL_ERROR_LAYERS).toContain(m.layer);
			expect(typeof m.retryable).toBe('boolean');
			['act', 'emit', 'userText'].forEach((k)=>expect(`${code}.${k}=${m[k]}`).toMatch(/=.+$/));
			expect(m.since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(Object.isFrozen(m)).toBe(true);
		});
		expect(Object.isFrozen(TOOL_ERROR_CODES)).toBe(true);
		expect(Object.isFrozen(TOOL_ERROR_CODE_LIST)).toBe(true);
		expect(TOOL_ERROR_CODE_LIST.filter((c)=>isRetryable(c))).toEqual(['E_CAST_BACKEND_FAILED']);
		expect(getErrorMeta('E_CAST_BACKEND_FAILED').layer).toBe('backend');
		expect(getErrorMeta('E_SETTING_SNAPSHOT_FAILED').layer).toBe('tool');
	});
	it('未知码 → {layer:unknown, retryable:false};isRetryable 对 undefined/垃圾恒 false', ()=>{
		expect(getErrorMeta('E_NOPE')).toEqual(expect.objectContaining({ layer: 'unknown', retryable: false }));
		expect(getErrorMeta(undefined).layer).toBe('unknown');
		expect(isRetryable('E_NOPE')).toBe(false);
		expect(isRetryable(undefined)).toBe(false);
		expect(isRetryable({})).toBe(false);
	});
});

describe('② cast_technique 失败三路判别向量', ()=>{
	const src = { kind: 'natal', birth: '1990-01-01 08:00', gpsLat: 39.9, gpsLon: 116.4, gender: 'male' };
	it('status=error → E_CAST_FAILED(不可重试)', async ()=>{
		getAnalysisTechniqueContexts.mockImplementation(async ()=>[{ key: 'astrochart', title: '星盘', module: 'astrochart', status: 'error', content: '', meta: {} }]);
		const r = await castTool.run({ technique: 'astrochart', source: src });
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_CAST_FAILED');
		expect(r.retryable).not.toBe(true);
		expect(r.data.status).toBe('error');
	});
	it('meta.chartFetchFailed → E_CAST_BACKEND_FAILED,retryable=true,cause=本次起盘窗口内最近一条 /chart 失败留痕且无敏感键', async ()=>{
		getAnalysisTechniqueContexts.mockImplementation(async ()=>{
			// 仿请求层:起盘期间 /chart 失败被留痕(带 query 与敏感文本,都不得进 cause)
			recordRequestFailure({ url: 'http://127.0.0.1:9999/chart?token=abc', kind: 'unreachable', silent: true, name: 'TypeError', message: 'Failed to fetch body=secret', status: undefined, code: undefined });
			return [{ key: 'astrochart', title: '星盘', module: 'astrochart', status: 'missing', content: '', meta: { chartFetchFailed: true } }];
		});
		const r = await castTool.run({ technique: 'astrochart', source: src });
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_CAST_BACKEND_FAILED');
		expect(r.retryable).toBe(true);
		expect(r.cause).toEqual(expect.objectContaining({ kind: 'unreachable', path: '/chart', name: 'TypeError' }));
		expect(typeof r.cause.at).toBe('number');
		Object.keys(r.cause).forEach((k)=>expect(ERROR_CAUSE_KEYS).toContain(k));
		SENSITIVE_KEYS.forEach((k)=>expect(Object.prototype.hasOwnProperty.call(r.cause, k)).toBe(false));
		expect(JSON.stringify(r.cause)).not.toMatch(/secret|token=abc/);
		// 经信封回喂:retryable 与 cause 原样透出,message 取表内固定文案
		const env = JSON.parse(formatToolResultContent(r, { maxChars: 8000 }).content);
		expect(env.retryable).toBe(true);
		expect(env.cause.kind).toBe('unreachable');
		expect(env.message).toContain(TOOL_ERROR_CODES.E_CAST_BACKEND_FAILED.userText);
	});
	it('后端失败标记但起盘窗口内无 /chart 留痕(如遥测关闭/更早的旧失败)→ 仍 E_CAST_BACKEND_FAILED,不带 cause(不拿陈旧记录冒充)', async ()=>{
		// 起盘前的旧失败:不在本次窗口内
		recordRequestFailure({ url: 'http://127.0.0.1:9999/chart', kind: 'http5xx', name: 'Error', message: 'old', status: 500 });
		const old = Date.now() - 60000;
		getAnalysisTechniqueContexts.mockImplementation(async ()=>[{ key: 'astrochart', status: 'missing', content: '', meta: { chartFetchFailed: true } }]);
		const r = await castTool.run({ technique: 'astrochart', source: src, __castWindowStart: old });
		expect(r.code).toBe('E_CAST_BACKEND_FAILED');
		expect(r.retryable).toBe(true);
		// 窗口判定以 runCast 自己记的起始时刻为准(参数不可注入),上面的旧记录早于起始 → 无 cause
		expect(r.cause).toBeUndefined();
	});
	it('空快照(无标记)→ E_SNAPSHOT_MISSING,文案「该技法未产出内容」,不再把请求层故障说成计算服务离线', async ()=>{
		getAnalysisTechniqueContexts.mockImplementation(async ()=>[{ key: 'astrochart', status: 'missing', content: '', meta: {} }]);
		const r = await castTool.run({ technique: 'astrochart', source: src });
		expect(r.code).toBe('E_SNAPSHOT_MISSING');
		expect(r.retryable).not.toBe(true);
		expect(r.message).toContain('该技法未产出内容');
		expect(r.message).not.toMatch(/计算服务在线/);
		// 构造器根本没回该技法(contexts 为空)同样走缺失路
		getAnalysisTechniqueContexts.mockImplementation(async ()=>[]);
		const r2 = await castTool.run({ technique: 'astrochart', source: src });
		expect(r2.code).toBe('E_SNAPSHOT_MISSING');
		expect(r2.data.status).toBe('missing');
	});
	it('负锚④:castTechnique.js 源码(含注释)不含「需本机计算服务在线」;正文里三枚码都在', ()=>{
		const raw = fs.readFileSync(CAST_PATH, 'utf8');
		expect(raw.indexOf('需本机计算服务在线')).toBe(-1);
		const txt = codeText(CAST_PATH);
		['E_CAST_FAILED', 'E_CAST_BACKEND_FAILED', 'E_SNAPSHOT_MISSING'].forEach((c)=>expect(txt.indexOf(`'${c}'`)).toBeGreaterThanOrEqual(0));
	});
});

describe('③ 回喂信封 retryable/cause', ()=>{
	it('ok:false 恒带 retryable(缺省查表;显式布尔优先);cause 经白名单过滤;键序=戳,ok,code,retryable,cause,message,…', ()=>{
		const a = JSON.parse(formatToolResultContent({ ok: false, code: 'E_CAST_BACKEND_FAILED', message: 'm', cause: { kind: 'unreachable', status: 0, at: 1, path: '/chart', body: 'B', headers: { a: 1 }, token: 'T', url: 'http://x/?q=1', nested: { deep: 1 } } }, { maxChars: 8000 }).content);
		expect(a.retryable).toBe(true);
		expect(a.cause).toEqual({ kind: 'unreachable', status: 0, at: 1, path: '/chart' });
		expect(Object.keys(a)).toEqual(['__horosaType', 'untrusted', 'ok', 'code', 'retryable', 'cause', 'message']);
		const b = JSON.parse(formatToolResultContent({ ok: false, code: 'E_CAST_FAILED', message: 'm' }, { maxChars: 8000 }).content);
		expect(b.retryable).toBe(false);
		expect('cause' in b).toBe(false);
		expect(Object.keys(b)).toEqual(['__horosaType', 'untrusted', 'ok', 'code', 'retryable', 'message']);
		// 显式 retryable 优先于查表(工具比表更懂现场);非布尔值不算显式
		expect(JSON.parse(formatToolResultContent({ ok: false, code: 'E_CAST_FAILED', retryable: true }, { maxChars: 8000 }).content).retryable).toBe(true);
		expect(JSON.parse(formatToolResultContent({ ok: false, code: 'E_CAST_BACKEND_FAILED', retryable: false }, { maxChars: 8000 }).content).retryable).toBe(false);
		expect(JSON.parse(formatToolResultContent({ ok: false, code: 'E_CAST_BACKEND_FAILED', retryable: 'yes' }, { maxChars: 8000 }).content).retryable).toBe(true);
		// 未知码/无码 → false
		expect(JSON.parse(formatToolResultContent({ ok: false, code: 'E_X' }, { maxChars: 8000 }).content).retryable).toBe(false);
		expect(JSON.parse(formatToolResultContent({ ok: false }, { maxChars: 8000 }).content).retryable).toBe(false);
	});
	it('ok:true 不带 retryable/cause(即便工具误带);判别戳不变;截断路径同样带 retryable', ()=>{
		const ok = JSON.parse(formatToolResultContent({ ok: true, data: { a: 1 }, retryable: true, cause: { kind: 'x' } }, { maxChars: 8000 }).content);
		expect(ok).toEqual({ __horosaType: 'toolResult', untrusted: true, ok: true, data: { a: 1 } });
		const big = formatToolResultContent({ ok: false, code: 'E_CAST_BACKEND_FAILED', message: 'm', cause: { kind: 'timeout' }, data: { blob: 'z'.repeat(20000) } }, { maxChars: 1000 });
		expect(big.truncated).toBe(true);
		const p = JSON.parse(big.content);
		expect(p.retryable).toBe(true);
		expect(p.cause).toEqual({ kind: 'timeout' });
		expect(p.__horosaType).toBe('toolResult');
		expect(p.untrusted).toBe(true);
	});
	it('sanitizeErrorCause:只留白名单标量键、长串截断、空/非对象 → null', ()=>{
		expect(sanitizeErrorCause(null)).toBeNull();
		expect(sanitizeErrorCause('str')).toBeNull();
		expect(sanitizeErrorCause({ body: 'x', headers: {} })).toBeNull();
		expect(sanitizeErrorCause({ kind: 'k', status: '500', code: 7, name: 'E', at: 3, path: '/p', extra: 1 })).toEqual({ kind: 'k', status: '500', code: 7, name: 'E', at: 3, path: '/p' });
		expect(sanitizeErrorCause({ kind: 'x'.repeat(500) }).kind.length).toBeLessThanOrEqual(80);
		expect(sanitizeErrorCause({ kind: { nested: 1 }, path: ['a'] })).toBeNull();
	});
});

describe('⑤ registry 写前快照失败码', ()=>{
	beforeEach(()=>{ __resetToolsForTests(); });
	it('restore-settings 工具 snapshot() 抛错 → E_SETTING_SNAPSHOT_FAILED,run 不执行,零账本', async ()=>{
		const run = jest.fn(async ()=>({ ok: true }));
		registerTool({ name: 'set_probe_settings', level: 'additive', undoKind: 'restore-settings', inputSchema: { type: 'object', additionalProperties: false, properties: { v: { type: 'string' } } }, snapshot: async ()=>{ throw new Error('boom'); }, run });
		const r = await runTool('set_probe_settings', { v: '1' }, { origin: 'in-app' });
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_SETTING_SNAPSHOT_FAILED');
		expect(r.message).toContain('boom');
		expect(run).not.toHaveBeenCalled();
		expect(window.localStorage.getItem('horosa.ai.agent.ledger.v1')).toBeNull();
	});
});
