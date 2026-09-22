import { ANALYSIS_CHART_TECHNIQUES, ANALYSIS_CASE_TECHNIQUES, listAnalysisTechniqueOptions, getAnalysisTechniqueContexts, clipContentToBudget } from '../../aiAnalysisContext';
import { resolveEffectiveTechniqueOptions } from '../../techniqueMountSettings';   // [Q-330] 与对话页挂载卡同一「生效设置」解析
import { splitContentSections } from '../../aiExport';
import { findAnalysisSourceById } from '../../aiAnalysisSources';
import { DefLat, DefLon, DefGpsLat, DefGpsLon } from '../../constants';
import { parseBirthInput } from '../normalize/birthText';
import { resolvePlaceOffline } from '../normalize/place';
import { resolveZone } from '../normalize/zone';
import { normalizeGender } from '../normalize/gender';
import { geoPairToRecordFields } from '../normalize/geoCompass';
import { getErrorMeta, sanitizeErrorCause } from '../errorCodes';
import { lastFor, pathOfUrl } from '../../requestTelemetry';
import { nowStr, GUIDE, SOURCE_SCHEMA } from './_shared';

function techniqueEnum(){
	const set = new Set(ANALYSIS_CHART_TECHNIQUES.concat(ANALYSIS_CASE_TECHNIQUES));
	try{ listAnalysisTechniqueOptions({ sourceType: 'timepoint' }).forEach((o)=>set.add(o.value)); }catch(e){ /* noop */ }
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
		const g = await geoFrom(src, b.birth.slice(0, 10), assumptions);
		if(g.error){ return g; }
		const z = resolveZone({ userZone: src.zone || b.zoneHint, gpsLat: g.geo.gpsLat, gpsLon: g.geo.gpsLon, dateStr: b.birth.slice(0, 10) });
		if(z.source === 'fallback'){ assumptions.push('时区按 +08:00 回退'); }
		const record = { birth: b.birth, zone: z.zone, lon: g.geo.lon, lat: g.geo.lat, gpsLon: g.geo.gpsLon, gpsLat: g.geo.gpsLat, gender: genderOrPageDefault(src.gender, false, assumptions), name: src.name || '命盘时间', pos: g.pos };
		return { source: { id: 'natal:tool', sourceType: 'chart', title: `命盘时间 · ${b.birth}`, module: 'astrochart', time: b.birth, zone: z.zone, tags: [], snapshotStatus: 'lazy', updatedAt: b.birth, record }, assumptions };
	}
	let divTime = nowStr();
	if(src.divTime){
		const b = parseBirthInput(src.divTime, { calendar: src.calendar || 'solar', timeUnknown: false });
		if(!b.ok){ return { error: { ok: false, code: b.code, message: '起课时间无法解析' } }; }
		divTime = b.birth; assumptions.push(...b.assumptions);
	}else{
		assumptions.push(`起课时间取当前 ${divTime}`);
	}
	const g = await geoFrom(src, divTime.slice(0, 10), assumptions);
	if(g.error){ return g; }
	const z = resolveZone({ userZone: src.zone, gpsLat: g.geo.gpsLat, gpsLon: g.geo.gpsLon, dateStr: divTime.slice(0, 10) });
	const record = { divTime, zone: z.zone, lon: g.geo.lon, lat: g.geo.lat, gpsLon: g.geo.gpsLon, gpsLat: g.geo.gpsLat, gender: genderOrPageDefault(src.gender, true, assumptions), sourceModule: '' };
	return { source: { id: 'timepoint:tool', sourceType: 'timepoint', title: `起课时间 · ${divTime}`, module: 'sanshiunited', time: divTime, zone: z.zone, tags: [], snapshotStatus: 'lazy', updatedAt: divTime, record }, assumptions };
}

export default {
	name: 'cast_technique',
	level: 'read',
	category: 'query',
	undoKind: 'none',
	timeoutMs: 120000,
	description: `对某条已存命盘/事盘、或一个临时时间点/临时出生数据,无头起盘并返回该技法的结构化快照文本供你分析,不写入任何记录。${GUIDE}:仅当用户要求分析某技法、且上下文里没有该技法内容时调用。六爻/塔罗/灵棋等随机起卦法不能凭时间起(会伪造卦象):对已存事盘只读其存盘结果;对临时时间点仅允许时间卦。。内容很长时先用 sections 只取需要的段(段名见返回的 omittedSections 或报错里的 availableSections),比调大 maxChars 省得多`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['technique', 'source'],
		properties: {
			technique: { type: 'string', enum: techniqueEnum() },
			source: SOURCE_SCHEMA,
			options: { type: 'object', additionalProperties: true, description: '该技法挂载设置覆盖,键/值域以 describe_settings(facet=mount) 为准' },
			maxChars: { type: 'integer', minimum: 500, maximum: 60000, default: 7000, description: '缺省 7000(< 运行时回喂预算 8000,避免二次截断)' },
			sections: { type: 'array', items: { type: 'string' }, maxItems: 12, description: '只取这些段(按段名子串匹配,如「行星」「宫位总览」);不传=全文按 maxChars 段对齐截断。分析只需要某几段时先按段取,省一大截上下文' },
		},
	},
	// 起盘串行化:部分技法(如七政)的挂载覆盖是「快照全局→改写→重算→还原」,并行两次会把用户全局设置留在中间态。
	// [T1] 链条按「本次结束 / 超时 / 调用方信号中止」三者先到者推进:一次挂死的起盘不再堵死整条链;排队中被中止立刻出队。
	async run(args, ctx){
		const signal = ctx && ctx.signal;
		if(signal && signal.aborted){ return { ok: false, code: 'E_ABORTED', message: '本轮已被停止,起盘未执行' }; }
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
			const runP = runCast(args);
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

async function runCast(args){
	{
		const built = await buildSourceFromArgs(args.source);
		if(built.error){ return built.error; }
		const source = built.source;
		const allowed = listAnalysisTechniqueOptions(source).map((o)=>o.value);
		if(allowed.indexOf(args.technique) < 0){
			return { ok: false, code: 'E_TECHNIQUE_NOT_ALLOWED', message: `该源不可起「${args.technique}」;可用: ${allowed.join(', ')}`, data: { allowed } };
		}
		// [Q-330/Q-285] 先取「同类默认」(与对话页挂载卡、无头入口同一解析),显式 options 覆盖其上。
		// 此前工具只认显式 options:用户在挂载卡里设过同类默认,AI 用 cast_technique 起出来的快照口径与页面不同。
		const baseOptions = (resolveEffectiveTechniqueOptions([args.technique], { record: source.record || null }) || {})[args.technique] || null;
		const mergedOptions = (baseOptions || args.options)
			? { ...(baseOptions || {}), ...(args.options && typeof args.options === 'object' ? args.options : {}) }
			: null;
		const opts = mergedOptions && Object.keys(mergedOptions).length ? { techniqueOptions: { [args.technique]: mergedOptions } } : {};
		const chartFailureBefore = chartFailureFingerprint(lastFor(CHART_FAIL_PATH));
		let contexts;
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
		const max = args.maxChars || 7000;
		// [P1-1] 按段取:段名子串匹配(大小写与空白不敏感);一段都没匹上直接报错并附可用段名,
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
				...(sectionAligned ? { sectionAligned: true, omittedSections: clip.omittedTitles } : {}) },
			assumptions: built.assumptions,
			summary: `起盘 ${c.title || args.technique}`,
		};
	}
}
