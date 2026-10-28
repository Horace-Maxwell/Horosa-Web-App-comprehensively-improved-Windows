// AI 助手·天星择日征象搜索:列条件类 / 在时间段里搜满足条件树的区间 / 判读单一时刻每个条件是否成立。
// 与择日页「征象搜索」同一条件注册表(divination/zeri/conditionTypes)、同一编译(compileTree)与同一扫描编排(runScan:
// 按自然月切段顺序请求、可取消、每段回报进度);盘面口径 = 全局古典设置(与择日页 / 主排盘同律)。只读、不写任何记录。
import { CONDITION_TYPES, GROUP_TYPES, compileTree, auditTreeAgainstRegistry } from '../../../divination/zeri/conditionTypes';
import { runScan, MAX_SPAN_DAYS_TOTAL } from '../../../divination/zeri/scanOrchestrator';
import { buildZeriRowExplainLines } from '../../../divination/zeri/zeriExplainText';
import { fetchElectionExplain } from '../../../services/electionScan';
import { getClassicalChartGlobals } from '../../classicalChartGlobals';
import { natalClassicalParams } from '../../../components/astro/AstroExtraCommon';
import { resolvePlaceOffline } from '../normalize/place';
import { resolveZone } from '../normalize/zone';
import { GUIDE } from './_shared';

export const ELECTION_RESULT_MAX = 200;
const JOINERS = GROUP_TYPES.filter((g)=>g !== 'not');   // not 由 negate 表达

// ── 条件类目录(给外部 AI 看的参数说明;值域取注册表 options 的 value) ──
function fieldSpec(f){
	const out = { key: f.key, kind: f.kind, label: f.label || f.key };
	if(Array.isArray(f.options) && f.options.length){ out.values = f.options.map((o)=>(o && typeof o === 'object' && o.value !== undefined ? o.value : o)); out.labels = f.options.map((o)=>(o && typeof o === 'object' && o.label !== undefined ? `${o.label}` : `${o}`)); }
	['min', 'max', 'step'].forEach((k)=>{ if(Number.isFinite(f[k])){ out[k] = f[k]; } });
	if(typeof f.showIf === 'function'){ out.conditional = true; }
	return out;
}
// 参数化:任一流派的条件注册表(各家择日与天星同一 spec 形状)
export function listConditionSpecsOf(registry, filterType){
	return Object.keys(registry || {}).filter((t)=>!filterType || t === filterType).map((type)=>{
		const spec = registry[type];
		return { type, label: spec.label || type, category: spec.category || '', defaults: JSON.parse(JSON.stringify(spec.defaults || {})), fields: (spec.fields || []).map(fieldSpec) };
	});
}
export function listElectionConditionSpecs(filterType){
	return listConditionSpecsOf(CONDITION_TYPES, filterType);
}

// ── 外部 AI 写的条件树 → 择日页 UI 树 → compileTree(复用校验 / negate 编译 / compile 钩子) ──
// 组:{ op:'all'|'any'|'xor', negate?, conditions:[…] };叶:{ type, params?, negate? }(params 盖在该类 defaults 上)
function toUiTree(node, joiner, depth, registry, listHint){
	if(depth > 8){ throw new Error('条件树嵌套过深(最多 8 层)'); }
	if(!node || typeof node !== 'object'){ throw new Error('条件节点无效'); }
	if(Array.isArray(node.conditions)){
		const op = JOINERS.indexOf(node.op) >= 0 ? node.op : 'all';
		if(!node.conditions.length){ throw new Error('存在空的条件分组'); }
		return { kind: 'group', negate: !!node.negate, joiner: joiner || 'all', children: node.conditions.map((c)=>toUiTree(c, op, depth + 1, registry, listHint)) };
	}
	const spec = Object.prototype.hasOwnProperty.call(registry, node.type) ? registry[node.type] : null;
	if(!spec){ throw new Error(`未知条件类型:${`${node.type || ''}`.slice(0, 40)}(先用 ${listHint} 查可用类型)`); }
	const params = { ...JSON.parse(JSON.stringify(spec.defaults || {})), ...(node.params && typeof node.params === 'object' ? node.params : {}) };
	return { kind: 'leaf', type: node.type, negate: !!node.negate, joiner: joiner || 'all', params };
}
// 参数化:任一流派(注册表 + 该流派的编译函数);天星择日即 compileAgentTree
export function compileAgentTreeWith(registry, compileFn, tree, listHint){
	const root = Array.isArray(tree && tree.conditions) ? tree : { op: 'all', conditions: [tree] };
	const ui = toUiTree(root, 'all', 0, registry, listHint || 'list_election_conditions');
	const issues = auditTreeAgainstRegistry(ui, registry);
	if(issues.length){ throw new Error(issues.slice(0, 3).join(';')); }
	return { ui, compiled: compileFn(ui) };
}
export function compileAgentTree(tree){
	return compileAgentTreeWith(CONDITION_TYPES, compileTree, tree, 'list_election_conditions');
}

export const TREE_SCHEMA = { type: 'object', additionalProperties: true, description: '条件树。组:{ op:"all"|"any"|"xor", negate?:bool, conditions:[子节点…] };叶:{ type:"<条件类>", params?:{…}, negate?:bool }。叶的 params 只需写与 defaults 不同的键;类型与参数值域用 list_election_conditions 查' };
const WHERE_SCHEMA = {
	place: { type: 'string', maxLength: 80, description: '地名(离线解析);与 gpsLat/gpsLon 二选一' },
	gpsLat: { type: 'number', minimum: -90, maximum: 90 },
	gpsLon: { type: 'number', minimum: -180, maximum: 180 },
	zone: { type: 'string', pattern: '^[+-]\\d{2}:\\d{2}$', description: '缺省按地点与日期推算' },
	hsys: { type: 'integer', minimum: 0, maximum: 30, description: '宫制编号(缺省 0,与择日页缺省同)' },
	zodiacal: { type: 'integer', minimum: 0, maximum: 1, description: '0=回归黄道 / 1=恒星黄道' },
};

export function splitDateTime(s, fallbackTime){
	const m = /^(-?\d{1,4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(`${s || ''}`.trim());
	if(!m){ return null; }
	const p = (n)=>`${n}`.padStart(2, '0');
	return { date: `${m[1]}/${p(m[2])}/${p(m[3])}`, time: m[4] !== undefined ? `${p(m[4])}:${m[5]}:${m[6] || '00'}` : fallbackTime };
}

export async function geoOf(args, dateStr){
	if(args.place){
		const r = await resolvePlaceOffline(args.place, { dateStr });
		if(!r.resolved){ return { error: { ok: false, code: 'E_PLACE_NOT_FOUND', message: r.candidates && r.candidates.length ? `地名有歧义: ${r.candidates.map((c)=>`${c.name}/${c.region}`).join('、')}` : `未找到地名「${args.place}」` } }; }
		return { gpsLat: r.place.gpsLat, gpsLon: r.place.gpsLon, pos: r.place.name };
	}
	if(Number.isFinite(Number(args.gpsLat)) && Number.isFinite(Number(args.gpsLon))){ return { gpsLat: Number(args.gpsLat), gpsLon: Number(args.gpsLon), pos: '' }; }
	return { error: { ok: false, code: 'E_ARGS_INVALID', message: '择日搜索需要地点:给 place,或 gpsLat + gpsLon' } };
}

function scanBaseOf(start, end, geo, zone, args){
	return {
		startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time,
		zone, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon,
		hsys: Number(args.hsys || 0), zodiacal: Number(args.zodiacal || 0),
		...natalClassicalParams({ ...getClassicalChartGlobals() }),
		ad: 1, precision: 'minute',
	};
}

export const listElectionConditionsTool = {
	name: 'list_election_conditions',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	cacheable: true,
	description: `天星择日(西洋占星择时)可用的征象条件类:每类的中文名、缺省参数、各参数的取值范围。写 search_election 的条件树前先查这里;只关心一类时给 type。${GUIDE}:用户要求择日 / 择时、需要写条件树时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, properties: { type: { type: 'string', maxLength: 40 } } },
	outputSchema: { type: 'object', required: ['types'], properties: { types: { type: 'array', items: { type: 'object', required: ['type', 'label', 'fields'] } }, joiners: { type: 'array', items: { type: 'string' } } } },
	async run(args){
		const types = listElectionConditionSpecs(args.type);
		if(args.type && !types.length){ return { ok: false, code: 'E_ARGS_INVALID', message: `没有这个条件类:${`${args.type}`.slice(0, 40)}`, data: { available: Object.keys(CONDITION_TYPES) } }; }
		return { ok: true, data: { types, joiners: JOINERS }, summary: `条件类 ${types.length} 种` };
	},
};

export const searchElectionTool = {
	name: 'search_election',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 180000,
	description: `天星择日:在 [start, end] 时间段内(最长约 5 年)搜索满足条件树的时间区间,不写入任何记录。地点给 place 或经纬度;盘面口径按全局设置。返回命中区间(start / end / 区间内的安全取样时刻 pick),先给前 limit 条;再用 explain_election 看某一刻每个条件为何成立。${GUIDE}:用户明确要求在某段时间里找合适时刻时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['start', 'end', 'conditions'],
		properties: {
			start: { type: 'string', maxLength: 20, description: 'YYYY-MM-DD 或 YYYY-MM-DD HH:mm' },
			end: { type: 'string', maxLength: 20, description: 'YYYY-MM-DD 或 YYYY-MM-DD HH:mm' },
			conditions: TREE_SCHEMA,
			...WHERE_SCHEMA,
			limit: { type: 'integer', minimum: 1, maximum: ELECTION_RESULT_MAX, default: 50 },
		},
	},
	outputSchema: {
		type: 'object', required: ['intervals', 'total', 'truncated'],
		properties: { intervals: { type: 'array', items: { type: 'object', required: ['start', 'end'] } }, total: { type: 'integer' }, truncated: { type: 'boolean' }, engineTruncated: { type: 'boolean' }, place: { type: 'string' }, zone: { type: 'string' } },
	},
	async run(args, ctx){
		const report = ctx && typeof ctx.progress === 'function' ? ctx.progress : null;
		const start = splitDateTime(args.start, '00:00:00');
		const end = splitDateTime(args.end, '23:59:59');
		if(!start || !end){ return { ok: false, code: 'E_ARGS_INVALID', message: 'start / end 需写成 YYYY-MM-DD 或 YYYY-MM-DD HH:mm' }; }
		let tree;
		try{ tree = compileAgentTree(args.conditions).compiled; }catch(e){ return { ok: false, code: 'E_ARGS_INVALID', message: `条件树无效:${e && e.message ? e.message : e}` }; }
		const geo = await geoOf(args, start.date.replace(/\//g, '-'));
		if(geo.error){ return geo.error; }
		const zone = args.zone || resolveZone({ gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, dateStr: start.date.replace(/\//g, '-') }).zone || '+08:00';
		const base = scanBaseOf(start, end, geo, zone, args);
		let out;
		try{
			out = await runScan({ base, tree, signal: ctx && ctx.signal, onProgress: report ? (p)=>{ report(p.done, p.total, `已扫 ${p.done}/${p.total} 段,命中 ${p.hits} 个区间`); } : undefined });
		}catch(e){
			if(e && e.name === 'AbortError'){ return { ok: false, code: 'E_ABORTED', message: '本次择日搜索已被停止' }; }
			const msg = e && e.message ? e.message : `${e}`;
			const backend = /未运行|fetch|Failed|ECONN|network/i.test(msg);
			return backend ? { ok: false, code: 'E_CAST_BACKEND_FAILED', message: `择日搜索没算出来:${msg}`, retryable: true } : { ok: false, code: 'E_ARGS_INVALID', message: msg };
		}
		const all = Array.isArray(out.intervals) ? out.intervals : [];
		const limit = args.limit || 50;
		const intervals = all.slice(0, limit).map((iv)=>({ start: iv.start, end: iv.end, ...(iv.pick ? { pick: iv.pick } : {}), ...(iv.pickEnd ? { pickEnd: iv.pickEnd } : {}) }));
		return { ok: true, data: { intervals, total: all.length, truncated: all.length > limit, engineTruncated: !!out.truncated, place: geo.pos || '', zone }, summary: `命中 ${all.length} 个区间${out.truncated ? '(引擎已截断)' : ''}` };
	},
};

export const explainElectionTool = {
	name: 'explain_election',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 60000,
	description: `天星择日判读:给一个时刻与同一棵条件树,逐条说明每个条件在该刻是否成立、实测值是多少(与择日页「详情」同一判读)。时刻通常取 search_election 返回区间的 pick。${GUIDE}:用户问某一刻为什么合 / 不合条件时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['time', 'conditions'],
		properties: { time: { type: 'string', maxLength: 20, description: 'YYYY-MM-DD HH:mm[:ss]' }, conditions: TREE_SCHEMA, ...WHERE_SCHEMA },
	},
	outputSchema: { type: 'object', required: ['pass', 'lines'], properties: { pass: { type: 'boolean' }, lines: { type: 'array', items: { type: 'string' } } } },
	async run(args, ctx){
		const at = splitDateTime(args.time, '00:00:00');
		if(!at){ return { ok: false, code: 'E_ARGS_INVALID', message: 'time 需写成 YYYY-MM-DD HH:mm[:ss]' }; }
		let compiled;
		let ui;
		try{ ({ ui, compiled } = compileAgentTree(args.conditions)); }catch(e){ return { ok: false, code: 'E_ARGS_INVALID', message: `条件树无效:${e && e.message ? e.message : e}` }; }
		const geo = await geoOf(args, at.date.replace(/\//g, '-'));
		if(geo.error){ return geo.error; }
		const zone = args.zone || resolveZone({ gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, dateStr: at.date.replace(/\//g, '-') }).zone || '+08:00';
		const base = scanBaseOf(at, at, geo, zone, args);
		let res;
		try{ res = await fetchElectionExplain({ ...base, conditions: compiled, t: `${at.date} ${at.time}` }, { signal: ctx && ctx.signal }); }
		catch(e){ return { ok: false, code: 'E_CAST_BACKEND_FAILED', message: `判读没算出来:${e && e.message ? e.message : e}`, retryable: true }; }
		const summary = (leaf)=>{ const spec = CONDITION_TYPES[leaf.type] || {}; return `${spec.label || leaf.type} ${JSON.stringify(leaf.params || {})}`; };
		let lines = [];
		try{ lines = buildZeriRowExplainLines(res, ui, summary, ''); }catch(e){ lines = []; }
		const pass = !!(res && (res.pass === true || (res.tree && res.tree.pass === true)));
		return { ok: true, data: { pass, lines, time: `${at.date} ${at.time}`, zone }, summary: `判读 ${pass ? '成立' : '不成立'}` };
	},
};
