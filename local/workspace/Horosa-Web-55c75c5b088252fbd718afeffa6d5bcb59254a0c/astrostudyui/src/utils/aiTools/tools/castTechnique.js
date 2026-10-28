import { ANALYSIS_CHART_TECHNIQUES, ANALYSIS_CASE_TECHNIQUES, listAnalysisTechniqueOptions, getAnalysisTechniqueContexts, clipContentToBudget, analysisTechniqueLabelMap } from '../../aiAnalysisContext';
import { resolveEffectiveTechniqueOptions, getTechniqueSettingsSchema, effectiveMountBaseline, adjustedMountBaseline, fieldBlankFollowsBaseline, fieldCurrentDefault, isMountFieldVisible, mountContextOf, mountContextLabel } from '../../techniqueMountSettings';   // 与对话页挂载卡同一「生效设置」解析
import { splitContentSections } from '../../aiExport';
import { findAnalysisSourceById } from '../../aiAnalysisSources';
import { withNewChartDefaults } from '../../newChartCapture';
import { DefLat, DefLon, DefGpsLat, DefGpsLon } from '../../constants';
import { parseBirthInput } from '../normalize/birthText';
import { resolvePlaceOffline } from '../normalize/place';
import { resolveZone } from '../normalize/zone';
import { normalizeGender } from '../normalize/gender';
import { geoPairToRecordFields } from '../normalize/geoCompass';
import { getErrorMeta, sanitizeErrorCause } from '../errorCodes';
import { lastFor, pathOfUrl } from '../../requestTelemetry';
import { nowStr, GUIDE, SOURCE_SCHEMA } from './_shared';
import { castInputKeysIn, castInputRejectMessage } from '../castInputKeys';
import { datePartOf } from '../../dateStrSafe';
import DateTime from '../../../components/comp/DateTime';

function techniqueEnum(){
	const set = new Set(ANALYSIS_CHART_TECHNIQUES.concat(ANALYSIS_CASE_TECHNIQUES));
	listAnalysisTechniqueOptions({ sourceType: 'timepoint' }).forEach((o)=>set.add(o.value));
	return Array.from(set);
}

async function geoFrom(src, dateStr, assumptions){
	if(src.place){
		const r = await resolvePlaceOffline(src.place, { dateStr });
		if(!r.resolved){ return { error: { ok: false, code: 'E_PLACE_NOT_FOUND', message: r.candidates && r.candidates.length ? `地名有歧义: ${r.candidates.map((c)=>c.name + '/' + c.region).join('、')}` : `未找到地名「${src.place}」` } }; }
		return { geo: geoPairToRecordFields(r.place.gpsLat, r.place.gpsLon), pos: r.place.name };
	}
	if(Number.isFinite(Number(src.gpsLat)) && Number.isFinite(Number(src.gpsLon))){
		return { geo: geoPairToRecordFields(src.gpsLat, src.gpsLon), pos: '' };
	}
	assumptions.push(`未给地点,按默认坐标 ${DefLat}/${DefLon} 起盘`);
	return { geo: { lat: DefLat, lon: DefLon, gpsLat: DefGpsLat, gpsLon: DefGpsLon }, pos: '' };
}

// 性别缺省与 AI 分析页「起课时间/命盘时间」临时源同形(两处 draft 默认 gender:1),并记 assumption。
function genderOrPageDefault(raw, forCase, assumptions){
	if(raw === undefined || raw === null || raw === ''){
		assumptions.push('性别未给,按男起盘(与 AI 分析页临时源默认一致)');
		return 1;
	}
	const g = normalizeGender(raw, { forCase });
	return g === undefined ? -1 : g;
}

// 与 AI 分析页「起课时间/命盘时间」合成源逐字段同形
export async function buildSourceFromArgs(src){
	const assumptions = [];
	if(src.kind === 'record'){
		// 单条 O(1) 查找(命盘先/排除归档,与列表 find 语义一致),免整表构建
		const found = findAnalysisSourceById(src.cid);
		if(!found){ return { error: { ok: false, code: 'E_RECORD_NOT_FOUND', message: `未找到记录 ${src.cid}` } }; }
		return { source: found, assumptions };
	}
	if(src.kind === 'natal'){
		const b = parseBirthInput(src.birth, { calendar: src.calendar || 'solar' });
		if(!b.ok){ return { error: { ok: false, code: b.code, message: '出生时间无法解析或缺少时辰' } }; }
		assumptions.push(...b.assumptions);
		const g = await geoFrom(src, datePartOf(b.birth), assumptions);
		if(g.error){ return g; }
		const z = resolveZone({ userZone: src.zone || b.zoneHint, gpsLat: g.geo.gpsLat, gpsLon: g.geo.gpsLon, dateStr: datePartOf(b.birth) });
		if(z.source === 'fallback'){ assumptions.push('时区按 +08:00 回退'); }
		// 合成的本命源按「新命盘」语义带上设置(新盘种子 + 古典全局 + 你自己的紫微设置,并打代次标记):
		// 此前不带任何设置键 → 种子键回内建默认、紫微回落刚载入那张盘的设置,与页面点「新命盘」排出的不同
		const record = withNewChartDefaults({ birth: b.birth, zone: z.zone, lon: g.geo.lon, lat: g.geo.lat, gpsLon: g.geo.gpsLon, gpsLat: g.geo.gpsLat, gender: genderOrPageDefault(src.gender, false, assumptions), name: src.name || '命盘时间', pos: g.pos || (src.pos ? `${src.pos}`.trim() : '') });
		return { source: { id: 'natal:tool', sourceType: 'chart', title: `命盘时间 · ${b.birth}`, module: 'astrochart', time: b.birth, zone: z.zone, tags: [], snapshotStatus: 'lazy', updatedAt: b.birth, record }, assumptions };
	}
	let divTime = nowStr();
	let nowSlot = -1;
	if(src.divTime){
		const b = parseBirthInput(src.divTime, { calendar: src.calendar || 'solar', timeUnknown: false });
		if(!b.ok){ return { error: { ok: false, code: b.code, message: '起课时间无法解析' } }; }
		divTime = b.birth; assumptions.push(...b.assumptions);
	}else{
		nowSlot = assumptions.push(`起课时间取当前 ${divTime}`) - 1;
	}
	const g = await geoFrom(src, datePartOf(divTime), assumptions);
	if(g.error){ return g; }
	const z = resolveZone({ userZone: src.zone, gpsLat: g.geo.gpsLat, gpsLon: g.geo.gpsLon, dateStr: datePartOf(divTime) });
	// 没给起课时间:「此刻」按起课地的时区换算(DateTime.nowForChart,与页面同一入口);此前本机钟面配起课地时区,本机与起课地不同时区就错开时差
	if(nowSlot >= 0){ divTime = DateTime.nowForChart(z.zone).format('YYYY-MM-DD HH:mm:ss'); assumptions[nowSlot] = `起课时间取当前 ${divTime}`; }
	const record = { divTime, zone: z.zone, lon: g.geo.lon, lat: g.geo.lat, gpsLon: g.geo.gpsLon, gpsLat: g.geo.gpsLat, gender: genderOrPageDefault(src.gender, true, assumptions), sourceModule: '' };
	return { source: { id: 'timepoint:tool', sourceType: 'timepoint', title: `起课时间 · ${divTime}`, module: 'sanshiunited', time: divTime, zone: z.zone, tags: [], snapshotStatus: 'lazy', updatedAt: divTime, record }, assumptions };
}

// ── options 里不生效的键(ignoredOptions):如实列出,不再静默丢 ──
// 三类:unknown = 该技法的挂载齿轮里没有这一项(含只读快照类技法,它没有可调设置);invalid = 取值不在这一项的可选档内(归一后也对不上),
// 不下发(同类默认里这一项照旧生效);hidden = 这一项此刻不显示(由别的项决定),重算前的剪枝会把它去掉 —— controlledBy 列出决定它显隐的项。
// 显隐判据与重算入口的剪枝(pruneOptionsToNonDefault)同一份上下文:覆盖 > 盘现状基线 > 全局现值 / 缺省,基线 = effectiveMountBaseline(与
// getAnalysisTechniqueContextWithOptions 同锚)。写的就是现值(剪枝剪掉的「等于现状」)不算不生效:起出来的盘本来就是这个值
const hasOwnKey = (o, k)=>!!o && Object.prototype.hasOwnProperty.call(o, k);
function visibilityContext(schema, key, options, baseline){
	const base = adjustedMountBaseline(key, options, baseline);
	const ctx = { ...mountContextOf(base) };   // 基线带的只读上下文键(塔罗进阶对应门控),与抽屉 / 剪枝同一份
	schema.fields.forEach((f)=>{
		const own = hasOwnKey(options, f.name) ? options[f.name] : undefined;
		const blankToBase = fieldBlankFollowsBaseline(f, { ...(base || {}), ...options }) && (own === '' || own === null) && base && base[f.name] !== undefined && base[f.name] !== null && base[f.name] !== '';
		if(own !== undefined && !blankToBase){ ctx[f.name] = own; return; }
		if(base && base[f.name] !== undefined && base[f.name] !== null){ ctx[f.name] = base[f.name]; return; }
		ctx[f.name] = fieldCurrentDefault(f);
	});
	return ctx;
}
// 决定一项显隐的那几项:showWhen 读了哪些键(按真实调用记下,不手写)+ when 对象的键
function visibilityControllers(field, ctx, names){
	const seen = new Set();
	if(field.when && typeof field.when === 'object'){ Object.keys(field.when).forEach((k)=>seen.add(k)); }
	if(typeof field.showWhen === 'function' && typeof Proxy === 'function'){
		const probe = new Proxy(ctx, { get(t, k){ if(typeof k === 'string'){ seen.add(k); } return t[k]; } });
		try{ field.showWhen(probe); }catch(_e){ /* 判据抛错:只记已读到的键 */ }
	}
	// 基线带的只读上下文键(以 __ 开头,齿轮改不了的本盘事实)也算决定项
	return names.filter((n)=>n !== field.name && seen.has(n)).concat([...seen].filter((k)=>k.indexOf('__') === 0 && names.indexOf(k) < 0 && ctx[k] !== undefined && ctx[k] !== null));
}
// 取值在不在这一项的档位里:没有档位的项(数字 / 文本 / 多选)、空值(随存档 / 随流派)一律不判;档值与给的值都按这一项的归一比(开关 1 / true 同一档)
function optionValueKnown(field, v, ctx){
	if(v === '' || v === null || v === undefined || Array.isArray(v) || typeof v === 'object'){ return true; }
	let sets = Array.isArray(field.options) ? field.options : [];
	if(typeof field.optionsFor === 'function'){
		try{ const o = field.optionsFor(ctx); if(Array.isArray(o)){ sets = sets.concat(o); } }catch(_e){ /* 取不到:只按全量档 */ }
	}
	if(!sets.length){ return true; }
	let nv = v;
	if(typeof field.normalize === 'function'){ try{ nv = field.normalize(v); }catch(_e){ nv = v; } }
	const normOf = (x)=>{ if(typeof field.normalize !== 'function'){ return x; } try{ return field.normalize(x); }catch(_e){ return x; } };
	return sets.some((o)=>o && (`${o.value}` === `${v}` || `${o.value}` === `${nv}` || `${normOf(o.value)}` === `${nv}`));
}
const IGNORED_REASON_TEXT = { unknown: '该技法的挂载设置里没有这一项', invalid: '取值不在这一项的可选档内,没有下发', hidden: '这一项此刻不显示,不参与起盘' };
// 回 { options: 去掉不下发项后的显式覆盖, ignored: [{ key, reason, controlledBy?, message }] }
export function classifyCastOptions(technique, explicit, record){
	const opts = explicit && typeof explicit === 'object' && !Array.isArray(explicit) ? explicit : {};
	const keys = Object.keys(opts);
	if(!keys.length){ return { options: opts, ignored: [] }; }
	const schema = getTechniqueSettingsSchema(technique);
	const fields = schema && schema.kind !== 'sectionsOnly' && Array.isArray(schema.fields) ? schema.fields : [];
	const byName = {};
	fields.forEach((f)=>{ byName[f.name] = f; });
	const ignored = [];
	const kept = {};
	const noFieldsHint = schema && schema.kind === 'sectionsOnly' && schema.reason ? `(${schema.reason})` : '';
	keys.forEach((k)=>{
		const f = byName[k];
		if(!f){ ignored.push({ key: k, reason: 'unknown', message: `${IGNORED_REASON_TEXT.unknown}${noFieldsHint}` }); return; }
		let nv = opts[k];
		if(typeof f.normalize === 'function'){ try{ nv = f.normalize(opts[k]); }catch(_e){ nv = undefined; } }
		// 空值(留空 / null)= 不覆盖、随存档或缺省,不算坏值;非空却归一不出 = 坏值
		if(nv === undefined && opts[k] !== undefined && opts[k] !== null && opts[k] !== ''){ ignored.push({ key: k, reason: 'invalid', message: IGNORED_REASON_TEXT.invalid }); return; }
		kept[k] = opts[k];
	});
	if(!fields.length){ return { options: kept, ignored }; }
	const baseline = effectiveMountBaseline(technique, record || {});
	const ctx0 = visibilityContext(schema, technique, kept, baseline);
	Object.keys(kept).forEach((k)=>{
		if(!optionValueKnown(byName[k], kept[k], ctx0)){ ignored.push({ key: k, reason: 'invalid', message: IGNORED_REASON_TEXT.invalid }); delete kept[k]; }
	});
	return { options: kept, ignored };
}
// 显隐在合并同类默认之后判(同类默认里的上级项同样决定子项显不显),与重算入口同一份合并
export function hiddenCastOptions(technique, explicitKeys, merged, record){
	const schema = getTechniqueSettingsSchema(technique);
	if(!schema || schema.kind === 'sectionsOnly' || !Array.isArray(schema.fields) || !merged){ return []; }
	const names = schema.fields.map((f)=>f.name);
	const ctx = visibilityContext(schema, technique, merged, effectiveMountBaseline(technique, record || {}));
	const out = [];
	(explicitKeys || []).forEach((k)=>{
		const f = schema.fields.find((x)=>x.name === k);
		if(!f || !hasOwnKey(merged, k) || isMountFieldVisible(f, ctx, schema)){ return; }
		const controlledBy = visibilityControllers(f, ctx, names);
		const by = controlledBy.length ? `(由 ${controlledBy.map((c)=>mountContextLabel(c) || `${c}=${JSON.stringify(ctx[c] === undefined ? null : ctx[c])}`).join('、')} 决定)` : '';
		out.push({ key: k, reason: 'hidden', ...(controlledBy.length ? { controlledBy } : {}), message: `${IGNORED_REASON_TEXT.hidden}${by}` });
	});
	return out;
}
function ignoredOptionsNote(list){
	return `options 里有 ${list.length} 项没有生效(起盘照常,未用这几项):${list.map((x)=>`${x.key} —— ${x.message}`).join(';')}`;
}

export default {
	name: 'cast_technique',
	level: 'read',
	category: 'query',
	// 输出结构(外部客户端据此校验 structuredContent)
	outputSchema: {
		type: 'object', required: ['key', 'content', 'truncated', 'totalChars'],
		properties: {
			key: { type: 'string' }, title: { type: ['string', 'null'] }, module: { type: ['string', 'null'] }, status: { type: 'string' },
			content: { type: 'string' }, truncated: { type: 'boolean' }, totalChars: { type: 'integer' },
			sections: { type: 'array', items: { type: 'string' } }, pickedChars: { type: 'integer' }, sectionAligned: { type: 'boolean' }, omittedSections: { type: 'array', items: { type: 'string' } },
			// options 里没有生效的键(如实列出,起盘照常):unknown 齿轮里没有 / invalid 取值不在档内(未下发)/ hidden 此刻不显示(controlledBy = 决定它显隐的项)
			ignoredOptions: { type: 'array', items: { type: 'object', required: ['key', 'reason', 'message'], properties: { key: { type: 'string' }, reason: { type: 'string', enum: ['unknown', 'invalid', 'hidden'] }, controlledBy: { type: 'array', items: { type: 'string' } }, message: { type: 'string' } } } },
		},
	},
	undoKind: 'none',
	timeoutMs: 120000,
	description: `对某条已存命盘/事盘、或一个临时时间点/临时出生数据,无头起盘并返回该技法的结构化快照文本供你分析,不写入任何记录。${GUIDE}:仅当用户要求分析某技法、且上下文里没有该技法内容时调用。六爻/塔罗/灵棋等随机起卦法不能凭时间起(会伪造卦象):对已存事盘只读其存盘结果;对临时时间点仅允许时间卦。。内容很长时先用 sections 只取需要的段(段名见返回的 omittedSections 或报错里的 availableSections),比调大 maxChars 省得多`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['technique', 'source'],
		properties: {
			technique: { type: 'string', enum: techniqueEnum() },
			source: SOURCE_SCHEMA,
			options: { type: 'object', additionalProperties: true, description: '该技法挂载设置覆盖,键/值域以 describe_settings(facet=mount) 为准;没生效的键(齿轮里没有 / 取值不在档内 / 此刻不显示)回包 ignoredOptions 逐项列出;起卦输入(种子 / 报数 / 起例模式 / 卦象等)写具体值一律拒;写回「自动」那一档(如金口诀地分 auto)= 不覆盖,照常放行' },
			maxChars: { type: 'integer', minimum: 500, maximum: 60000, default: 7000, description: '缺省 7000(< 运行时回喂预算 8000,避免二次截断)' },
			sections: { type: 'array', items: { type: 'string' }, maxItems: 12, description: '只取这些段(按段名子串匹配,如「行星」「宫位总览」);不传=全文按 maxChars 段对齐截断。分析只需要某几段时先按段取,省一大截上下文' },
		},
	},
	// 起盘串行化:部分技法(如七政)的挂载覆盖是「快照全局→改写→重算→还原」,并行两次会把用户全局设置留在中间态。
	// 链条按「本次结束 / 超时 / 调用方信号中止」三者先到者推进:一次挂死的起盘不再堵死整条链;排队中被中止立刻出队。
	async run(args, ctx){
		const signal = ctx && ctx.signal;
		// 外部客户端要了进度(本次调用有自己的响应流)才有 ctx.progress;四步:排队 → 解析时间地点 → 起盘计算 → 整理快照
		const report = ctx && typeof ctx.progress === 'function' ? ctx.progress : null;
		if(signal && signal.aborted){ return { ok: false, code: 'E_ABORTED', message: '本轮已被停止,起盘未执行' }; }
		// 覆盖里带起卦输入键的具体值(种子 / 报数 / 起例模式 / 卦象…)= 凭参数伪造卦象,或把已存事盘按另一组输入重起:整次拒,不排队不起盘
		// (写回「自动」那一档 = 不覆盖,不算;拒绝话术按技法给对出路)
		const castKeys = castInputKeysIn(args.technique, args.options);
		if(castKeys.length){
			const label = analysisTechniqueLabelMap([args.technique])[args.technique] || '';
			return { ok: false, code: 'E_ARGS_INVALID', message: castInputRejectMessage(args.technique, castKeys, { label }), data: { castInputKeys: castKeys } };
		}
		if(report){ report(0, 4, '排队等前一次起盘结束'); }
		const prev = castChain;
		let release = null;
		const mine = new Promise((r)=>{ release = r; });
		const timer = castSleep(CAST_CHAIN_WAIT_MS);
		const guards = [mine, timer.promise];
		if(signal){ guards.push(castAbortPromise(signal)); }
		castChain = prev.then(()=>Promise.race(guards)).catch(()=>{}).then(()=>{ timer.cancel(); });
		try{
			const waits = [prev.catch(()=>{})];
			if(signal){ waits.push(castAbortPromise(signal).then(()=>{ throw Object.assign(new Error('本轮已被停止'), { code: 'E_ABORTED' }); })); }
			try{ await Promise.race(waits); }
			catch(e){ return { ok: false, code: 'E_ABORTED', message: '本轮已被停止,起盘未执行' }; }
			const runP = runCast(args, report);
			if(!signal){ return await runP; }
			return await Promise.race([runP, castAbortPromise(signal).then(()=>({ ok: false, code: 'E_ABORTED', message: '本轮已被停止,起盘结果已丢弃' }))]);
		}finally{ release(); }
	},
};

export const CAST_CHAIN_WAIT_MS = 120000;   // 与 timeoutMs 同量级:后来者最多等前一次起盘这么久
let castChain = Promise.resolve();
function castAbortPromise(signal){
	return new Promise((resolve)=>{ if(signal.aborted){ resolve(); return; } signal.addEventListener('abort', ()=>resolve(), { once: true }); });
}
function castSleep(ms){
	let t = null;
	const promise = new Promise((resolve)=>{ t = setTimeout(resolve, ms); });
	return { promise, cancel: ()=>{ if(t){ clearTimeout(t); t = null; } } };
}

// 起盘请求的失败留痕落在这个路径下(排盘走 `${ServerRoot}/chart`)。
const CHART_FAIL_PATH = '/chart';

// 留痕指纹:同一条记录两次取到逐字段一样 = 本次起盘期间没产生新的失败,那条是旧账不能拿来冒充。
// 用指纹而不是「时刻晚于起始」判据:留痕与起盘起始完全可能落在同一毫秒,时间戳比较会随机假阳/假阴。
function chartFailureFingerprint(e){
	return e ? `${e.at}|${e.kind}|${e.name}|${e.url}|${e.status}|${e.code}` : '';
}

// 只把定位得上的骨架交出去(白名单再过一道):绝不带请求体/响应头/令牌/带 query 的完整 URL。
function freshChartFailureCause(before){
	const e = lastFor(CHART_FAIL_PATH);
	if(!e || chartFailureFingerprint(e) === before){ return null; }
	return sanitizeErrorCause({ kind: e.kind, status: e.status, code: e.code, name: e.name, at: e.at, path: pathOfUrl(e.url) });
}

// 失败三路各有各的下一步,不能糊成一句:异常/status=error=算了但算不出;后端标记=请求根本没拿到结果
// (可重试);其余=真的没内容(缺料或该技法本就无输出)。此前三路共用一句「需…在线」的文案,
// 把请求层故障说成计算服务离线,纯本地技法的用户照着去查服务=白查。
function castFailure(code, technique, extra){
	const meta = getErrorMeta(code);
	return { ok: false, code, message: `「${technique}」${meta.userText};${meta.act}`, ...(extra || {}) };
}

async function runCast(args, report){
	{
		if(report){ report(1, 4, '解析时间与地点'); }
		const built = await buildSourceFromArgs(args.source);
		if(built.error){ return built.error; }
		const source = built.source;
		const allowed = listAnalysisTechniqueOptions(source).map((o)=>o.value);
		if(allowed.indexOf(args.technique) < 0){
			return { ok: false, code: 'E_TECHNIQUE_NOT_ALLOWED', message: `该源不可起「${args.technique}」;可用: ${allowed.join(', ')}`, data: { allowed } };
		}
		// 先取「同类默认」(与对话页挂载卡、无头入口同一解析),显式 options 覆盖其上。
		// 此前工具只认显式 options:用户在挂载卡里设过同类默认,AI 用 cast_technique 起出来的快照口径与页面不同。
		const baseOptions = (resolveEffectiveTechniqueOptions([args.technique], { record: source.record || null }) || {})[args.technique] || null;
		// 显式 options 先分拣:齿轮里没有的 / 取值不在档内的不下发(取值不在档内的那项,同类默认里有就照旧用同类默认的)
		const sorted = classifyCastOptions(args.technique, args.options, source.record || null);
		const explicitOptions = sorted.options;
		const mergedOptions = (baseOptions || Object.keys(explicitOptions).length)
			? { ...(baseOptions || {}), ...explicitOptions }
			: null;
		const ignoredOptions = sorted.ignored.concat(hiddenCastOptions(args.technique, Object.keys(explicitOptions), mergedOptions, source.record || null));
		const opts = mergedOptions && Object.keys(mergedOptions).length ? { techniqueOptions: { [args.technique]: mergedOptions } } : {};
		const chartFailureBefore = chartFailureFingerprint(lastFor(CHART_FAIL_PATH));
		let contexts;
		if(report){ report(2, 4, `起盘计算:${args.technique}`); }
		try{
			contexts = await getAnalysisTechniqueContexts(source, [args.technique], opts);
		}catch(e){
			const f = castFailure('E_CAST_FAILED', args.technique);
			return { ...f, message: `${f.message}(${e && e.message ? e.message : e})` };
		}
		const c = contexts && contexts[0];
		const content = c && c.content ? `${c.content}` : '';
		if(!content.trim()){
			const status = c ? c.status : 'missing';
			if(status === 'error'){
				return castFailure('E_CAST_FAILED', args.technique, { data: { status } });
			}
			// 请求层没拿到结果(构造器自报的后端失败标记):可重试,并附本次起盘期间新产生的失败留痕骨架。
			if(c && c.meta && c.meta.chartFetchFailed){
				const cause = freshChartFailureCause(chartFailureBefore);
				return castFailure('E_CAST_BACKEND_FAILED', args.technique, { retryable: true, ...(cause ? { cause } : {}), data: { status } });
			}
			return castFailure('E_SNAPSHOT_MISSING', args.technique, { data: { status } });
		}
		if(report){ report(3, 4, '整理快照'); }
		const max = args.maxChars || 7000;
		// 按段取:段名子串匹配(大小写与空白不敏感);一段都没匹上直接报错并附可用段名,
		// 免得模型拿到一份空文本还以为技法没内容。
		const wanted = Array.isArray(args.sections) ? args.sections.map((x)=>`${x || ''}`.trim()).filter(Boolean) : [];
		let picked = content;
		if(wanted.length){
			const all = splitContentSections(content);
			const hit = all.filter((sec)=>sec.title && wanted.some((w)=>`${sec.title}`.indexOf(w) >= 0));
			if(!hit.length){
				return castFailure('E_SECTION_NOT_FOUND', args.technique, { data: { availableSections: all.map((sec)=>sec.title).filter(Boolean).slice(0, 40) } });
			}
			picked = hit.map((sec)=>sec.lines.join('\n')).join('\n');
		}
		const truncated = picked.length > max;
		// 段对齐优先:有段结构时整段整段地裁并回报略去的段名(模型可据此再按段取);
		// 无段结构的快照仍走旧的字符截断,输出逐字节与改动前相同。
		const clip = truncated ? clipContentToBudget(picked, Math.max(200, max - 64)) : null;
		const sectionAligned = !!(clip && clip.sectionAligned);
		const outContent = !truncated ? picked
			: (sectionAligned ? `${clip.text}\n[truncated: 剩余 ${picked.length - clip.text.length} 字符]`
				: picked.slice(0, max) + `\n[truncated: 剩余 ${picked.length - max} 字符]`);
		return {
			ok: true,
			data: { key: c.key || args.technique, title: c.title, module: c.module, status: c.status || 'ready', content: outContent, truncated, totalChars: content.length,
				...(wanted.length ? { sections: wanted, pickedChars: picked.length } : {}),
				...(sectionAligned ? { sectionAligned: true, omittedSections: clip.omittedTitles } : {}),
				...(ignoredOptions.length ? { ignoredOptions } : {}) },
			assumptions: ignoredOptions.length ? built.assumptions.concat([ignoredOptionsNote(ignoredOptions)]) : built.assumptions,
			summary: `起盘 ${c.title || args.technique}`,
		};
	}
}
