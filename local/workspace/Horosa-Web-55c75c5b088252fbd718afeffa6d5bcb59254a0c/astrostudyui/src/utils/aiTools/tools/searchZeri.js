// 各流派择日搜索(黄历 / 八字 / 紫微 / 六壬 / 太乙 / 奇门 / 七政 / 印度):列条件类 / 在时间段里搜满足条件树的区间 / 判读单一时刻。
// 与各择日页同一注册表、同一编译、同一扫描引擎;口径与各择日页同一构参(工作台出厂参数;紫微 / 八字另读技法页设置,回包 calibre 写明);本命可选(命盘档案或出生时间)。只读、不写任何记录。
// 天星择日仍用 search_election(条件与口径不同)。条件树写法与 search_election 相同。
import { GUIDE, RECORD_ID_PATTERN } from './_shared';
import { splitDateTime, geoOf, compileAgentTreeWith, listConditionSpecsOf, TREE_SCHEMA } from './searchElection';
import { resolveZone } from '../normalize/zone';
import { geoPairToRecordFields } from '../normalize/geoCompass';
import { buildZeriRowExplainLines } from '../../../divination/zeri/zeriExplainText';
import { runSegmentedRemoteScan } from '../../../divination/zeri/scanOrchestrator';
import { wallTextToMs, nonexistentWallDateMessage } from '../../../divination/zeri/hourlyScanEngine';
import { getLocalChart } from '../../localcharts';
import { ZERI_SCHOOLS, ZERI_UNSUPPORTED, ZERI_AI_MAX_SPAN_DAYS, zeriSchoolMeta, loadZeriSchool, natalArgsOfRecord, natalFromBirth, remotePayloadOf, normalizeRemoteRows } from '../zeriSchools';

export const ZERI_RESULT_MAX = 200;
const SCHOOL_ENUM = ZERI_SCHOOLS.concat(Object.keys(ZERI_UNSUPPORTED));
const SCHOOL_SCHEMA = { type: 'string', enum: SCHOOL_ENUM, description: `流派:${ZERI_SCHOOLS.map((k)=>`${k}=${zeriSchoolMeta(k).label}`).join(' / ')}(sanshi 暂不开放)` };
const WHERE = {
	place: { type: 'string', maxLength: 80, description: '地名(离线解析);与 gpsLat/gpsLon 二选一;黄历择日不需要' },
	gpsLat: { type: 'number', minimum: -90, maximum: 90 },
	gpsLon: { type: 'number', minimum: -180, maximum: 180 },
	zone: { type: 'string', pattern: '^[+-]\\d{2}:\\d{2}$', description: '缺省按地点与日期推算' },
};
const NATAL = {
	natalRecordId: { type: 'string', pattern: RECORD_ID_PATTERN, maxLength: 80, description: '用事人命盘档案 id(八字 / 紫微 / 六壬择日可选;解锁本命类条件)' },
	natalBirth: { type: 'string', maxLength: 30, description: '或直接给用事人出生时间 YYYY-MM-DD HH:mm(与 natalRecordId 二选一)' },
	natalGender: { type: 'string', enum: ['male', 'female'] },
	indiaNatal: { type: 'object', additionalProperties: false, properties: { moonNak: { type: 'integer', minimum: 1, maximum: 27 }, moonSign: { type: 'integer', minimum: 1, maximum: 12 } }, description: '印度择日的本命月宿(1-27)/ 月座(1-12),塔拉力 / 月力条件要用' },
};
const unsupported = (school)=>({ ok: false, code: 'E_ARGS_INVALID', message: ZERI_UNSUPPORTED[school] || `不支持的流派:${school}` });

async function prepare(args, t0, t1){
	const sch = await loadZeriSchool(args.school);
	if(!sch){ return { error: unsupported(args.school) }; }
	let compiled;
	let ui;
	try{ ({ ui, compiled } = compileAgentTreeWith(sch.registry, sch.compile, args.conditions, 'list_zeri_conditions')); }
	catch(e){ return { error: { ok: false, code: 'E_ARGS_INVALID', message: `条件树无效:${e && e.message ? e.message : e}` } }; }
	const dateStr = t0.date.replace(/\//g, '-');
	let geo = { zone: '+08:00' };
	if(sch.needsPlace){
		const g = await geoOf(args, dateStr);
		if(g.error){ return { error: g.error }; }
		const rec = geoPairToRecordFields(g.gpsLat, g.gpsLon);
		const zone = args.zone || resolveZone({ gpsLat: g.gpsLat, gpsLon: g.gpsLon, dateStr }).zone || '+08:00';
		geo = { zone, lon: rec.lon, lat: rec.lat, gpsLon: g.gpsLon, gpsLat: g.gpsLat, ad: 1, pos: g.pos || '' };
	}
	const options = { ...(typeof sch.defaults === 'function' ? sch.defaults() : {}) };
	// 本命:只对认本命的三家;解析不出就照无本命搜(本命类条件会不成立),并如实说明
	let natalLabel = '';
	if(sch.natal === true && typeof sch.resolveNatal === 'function' && (args.natalRecordId || args.natalBirth)){
		let nArgs = null;
		if(args.natalRecordId){
			const rec = getLocalChart(args.natalRecordId);
			if(!rec){ return { error: { ok: false, code: 'E_RECORD_NOT_FOUND', message: `没有这张命盘:${`${args.natalRecordId}`.slice(0, 80)}` } }; }
			nArgs = natalArgsOfRecord(rec);
		}else{
			nArgs = natalFromBirth(args.natalBirth, args.zone || geo.zone, args.natalGender === 'female' ? 0 : 1);
		}
		const natal = nArgs ? sch.resolveNatal(nArgs) : null;
		if(!natal){ return { error: { ok: false, code: 'E_ARGS_INVALID', message: '用事人本命解析失败(出生时间需写成 YYYY-MM-DD HH:mm)' } }; }
		options._natal = natal;
		natalLabel = `${natal.label || ''}`;
	}
	const cfg = { startDate: dateStr, startTime: t0.time.slice(0, 5), endDate: t1.date.replace(/\//g, '-'), endTime: t1.time.slice(0, 5) };
	// 所用口径如实写进回包(与择日页同一构参;紫微 / 八字读你的技法页设置)
	let calibre = '';
	try{ calibre = typeof sch.calibreOf === 'function' ? `${sch.calibreOf(options) || ''}` : ''; }catch(e){ calibre = ''; }
	if(!calibre){ calibre = args.school === 'qimen' ? '奇门页的排盘设置' : '工作台出厂参数'; }
	return { sch, compiled, ui, geo, options, cfg, natalLabel, calibre };
}

export const listZeriConditionsTool = {
	name: 'list_zeri_conditions',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	outputSchema: { type: 'object', required: ['school', 'types'], properties: { school: { type: 'string' }, label: { type: 'string' }, granularity: { type: 'string' }, maxSpanDays: { type: 'integer' }, types: { type: 'array', items: { type: 'object', required: ['type', 'label'] } } } },
	description: `某一流派择日(黄历 / 八字 / 紫微 / 六壬 / 太乙 / 奇门 / 七政 / 印度)可用的条件类:中文名、缺省参数、各参数取值。写 search_zeri 的条件树前先查这里;只关心一类时给 type。天星择日用 list_election_conditions。${GUIDE}:用户要求按某流派择日时调用。`,
	inputSchema: { type: 'object', additionalProperties: false, required: ['school'], properties: { school: SCHOOL_SCHEMA, type: { type: 'string', maxLength: 40 } } },
	async run(args){
		const sch = await loadZeriSchool(args.school);
		if(!sch){ return unsupported(args.school); }
		const types = listConditionSpecsOf(sch.registry, args.type);
		if(args.type && !types.length){ return { ok: false, code: 'E_ARGS_INVALID', message: `${sch.label}没有这个条件类:${`${args.type}`.slice(0, 40)}` }; }
		return { ok: true, data: { school: args.school, label: sch.label, granularity: sch.granularity, maxSpanDays: sch.maxSpanDays, types }, summary: `${sch.label}条件 ${types.length} 类` };
	},
};

export const searchZeriTool = {
	name: 'search_zeri',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 180000,
	outputSchema: {
		type: 'object', required: ['school', 'intervals', 'total', 'truncated'],
		properties: { school: { type: 'string' }, intervals: { type: 'array', items: { type: 'object', required: ['start', 'end'] } }, total: { type: 'integer' }, truncated: { type: 'boolean' }, engineTruncated: { type: 'boolean' }, place: { type: 'string' }, zone: { type: 'string' }, natal: { type: 'string' }, calibre: { type: 'string' } },
	},
	description: `按某一流派择日:在 [start, end] 内搜满足条件树的时间区间(黄历按日;八字 / 紫微 / 六壬 / 太乙 / 奇门按时,一次最长一年;七政 / 印度经本机服务,最长约 5 年),不写入任何记录。口径与该流派择日页同一构参:工作台出厂参数,紫微再加你的紫微设置、八字再加八字页的南半球月令 / 命宫起法(奇门 = 你在奇门页设的排盘设置),回包 calibre 写明所用口径;八字 / 紫微 / 六壬可带用事人本命。返回区间与安全取样时刻 pick;再用 explain_zeri 看某一刻每个条件为何成立。${GUIDE}:用户要求按八字 / 紫微 / 黄历等挑日子时调用;条件类先用 list_zeri_conditions 查。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['school', 'start', 'end', 'conditions'],
		properties: {
			school: SCHOOL_SCHEMA,
			start: { type: 'string', maxLength: 20, description: 'YYYY-MM-DD 或 YYYY-MM-DD HH:mm' },
			end: { type: 'string', maxLength: 20, description: 'YYYY-MM-DD 或 YYYY-MM-DD HH:mm' },
			conditions: TREE_SCHEMA,
			...WHERE,
			...NATAL,
			limit: { type: 'integer', minimum: 1, maximum: ZERI_RESULT_MAX, default: 50 },
		},
	},
	async run(args, ctx){
		const report = ctx && typeof ctx.progress === 'function' ? ctx.progress : null;
		const t0 = splitDateTime(args.start, '00:00:00');
		const t1 = splitDateTime(args.end, '23:59:59');
		if(!t0 || !t1){ return { ok: false, code: 'E_ARGS_INVALID', message: 'start / end 需写成 YYYY-MM-DD 或 YYYY-MM-DD HH:mm' }; }
		const missing = nonexistentWallDateMessage(t0.date, t1.date);
		if(missing){ return { ok: false, code: 'E_ARGS_INVALID', message: missing }; }
		// 跨度在民用历墙钟轴上量(与扫描引擎同轴:1582 以前儒略历、跨改历不多算 10 天)
		const span = (wallTextToMs(t1.date.replace(/\//g, '-')) - wallTextToMs(t0.date.replace(/\//g, '-'))) / 86400e3;
		const cap = ZERI_AI_MAX_SPAN_DAYS[args.school];
		if(!Number.isFinite(span) || span < 0){ return { ok: false, code: 'E_ARGS_INVALID', message: '时间范围无效:结束须晚于起始' }; }
		if(cap && span > cap){ return { ok: false, code: 'E_ARGS_INVALID', message: `跨度 ${Math.ceil(span)} 天超过这一流派一次搜索的上限 ${cap} 天,请缩小范围分段搜` }; }
		const p = await prepare(args, t0, t1);
		if(p.error){ return p.error; }
		const { sch, compiled, geo, options, cfg } = p;
		const onProgress = report ? (x)=>{ try{ report(x.done, x.total, `已扫 ${x.done}/${x.total},命中 ${x.hits || 0} 个区间`); }catch(e){ /* 进度失败不影响搜索 */ } } : undefined;
		let rows = [];
		let engineTruncated = false;
		try{
			if(sch.granularity === 'remote'){
				const out = await runSegmentedRemoteScan({ payload: remotePayloadOf(args.school, cfg, geo, options, compiled, args.indiaNatal), fetchFn: sch.fetchScan, signal: ctx && ctx.signal, onProgress });
				rows = normalizeRemoteRows(out.intervals); engineTruncated = !!out.truncated;
			}else if(sch.granularity === 'day'){
				const out = await sch.scan({ cfg, tree: compiled, signal: ctx && ctx.signal, onProgress });
				rows = out.intervals || []; engineTruncated = !!out.truncated;
			}else{
				const out = await sch.scan({ cfg, geoParams: { zone: geo.zone, lon: geo.lon, lat: geo.lat, gpsLon: geo.gpsLon, gpsLat: geo.gpsLat, ad: 1, gender: 1 }, options, tree: compiled, signal: ctx && ctx.signal, onProgress });
				rows = out.intervals || []; engineTruncated = !!out.truncated;
			}
		}catch(e){
			if(e && e.name === 'AbortError'){ return { ok: false, code: 'E_ABORTED', message: '本次择日搜索已被停止' }; }
			const msg = e && e.message ? e.message : `${e}`;
			const backend = sch.granularity === 'remote' && /未运行|fetch|Failed|ECONN|network|超时/i.test(msg);
			return backend ? { ok: false, code: 'E_CAST_BACKEND_FAILED', message: `择日搜索没算出来:${msg}`, retryable: true } : { ok: false, code: 'E_ARGS_INVALID', message: msg };
		}
		const limit = args.limit || 50;
		const pickRow = (r)=>{
			const o = { start: r.start, end: r.end };
			['pick', 'pickEnd', 'badge', 'pillarText', 'mingText', 'juText', 'keTi', 'sanchuan', 'days'].forEach((k)=>{ if(r[k] !== undefined && r[k] !== null && r[k] !== ''){ o[k] = r[k]; } });
			if(Number.isFinite(r.durationMin)){ o.durationMin = r.durationMin; }
			return o;
		};
		return {
			ok: true,
			data: { school: args.school, intervals: rows.slice(0, limit).map(pickRow), total: rows.length, truncated: rows.length > limit, engineTruncated, place: geo.pos || '', zone: geo.zone, calibre: p.calibre, ...(p.natalLabel ? { natal: p.natalLabel } : {}) },
			summary: `${sch.label}命中 ${rows.length} 个区间${engineTruncated ? '(引擎已截断)' : ''}`,
		};
	},
};

export const explainZeriTool = {
	name: 'explain_zeri',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	origins: ['in-app', 'mcp'],
	timeoutMs: 60000,
	outputSchema: { type: 'object', required: ['pass', 'lines'], properties: { pass: { type: 'boolean' }, lines: { type: 'array', items: { type: 'string' } }, time: { type: 'string' }, calibre: { type: 'string' } } },
	description: `某一流派择日判读:给一个时刻与同一棵条件树,逐条说明每个条件在该刻是否成立(与择日页「详情」同一判读)。时刻通常取 search_zeri 返回区间的 pick。${GUIDE}:用户问某一刻为什么合 / 不合时调用。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['school', 'time', 'conditions'],
		properties: { school: SCHOOL_SCHEMA, time: { type: 'string', maxLength: 20, description: 'YYYY-MM-DD HH:mm(黄历只看日期)' }, conditions: TREE_SCHEMA, ...WHERE, ...NATAL },
	},
	async run(args, ctx){
		const at = splitDateTime(args.time, '12:00:00');
		if(!at){ return { ok: false, code: 'E_ARGS_INVALID', message: 'time 需写成 YYYY-MM-DD HH:mm' }; }
		const missingAt = nonexistentWallDateMessage(at.date);
		if(missingAt){ return { ok: false, code: 'E_ARGS_INVALID', message: missingAt }; }
		const p = await prepare(args, at, at);
		if(p.error){ return p.error; }
		const { sch, compiled, ui, geo, options, cfg } = p;   // p.calibre 随回包
		const t = `${cfg.startDate} ${at.time.slice(0, 5)}`;
		let res;
		try{
			if(sch.granularity === 'remote'){
				res = await sch.fetchExplain({ ...remotePayloadOf(args.school, cfg, geo, options, compiled, args.indiaNatal), t }, { signal: ctx && ctx.signal });
			}else if(sch.granularity === 'day'){
				res = sch.explain({ tree: compiled, t });
			}else{
				res = sch.explain({ geoParams: { zone: geo.zone, lon: geo.lon, lat: geo.lat, gpsLon: geo.gpsLon, gpsLat: geo.gpsLat, ad: 1, gender: 1 }, options, tree: compiled, t });
			}
		}catch(e){
			return { ok: false, code: sch.granularity === 'remote' ? 'E_CAST_BACKEND_FAILED' : 'E_ARGS_INVALID', message: `判读没算出来:${e && e.message ? e.message : e}`, ...(sch.granularity === 'remote' ? { retryable: true } : {}) };
		}
		if(!res || res.err || !res.tree){ return { ok: false, code: 'E_ARGS_INVALID', message: `这一刻判读不了(${(res && res.err) || '无结果'})` }; }
		const summary = (leaf)=>{ const spec = (sch.registry || {})[leaf.type] || {}; return `${spec.label || leaf.type} ${JSON.stringify(leaf.params || {})}`; };
		let lines = [];
		try{ lines = buildZeriRowExplainLines(res, ui, summary, ''); }catch(e){ lines = []; }
		return { ok: true, data: { pass: !!(res.tree && res.tree.pass === true), lines, time: res.t || t, calibre: p.calibre }, summary: `${sch.label}判读 ${res.tree && res.tree.pass ? '成立' : '不成立'}` };
	},
};
