import { upsertLocalCase, listLocalCases, CASE_TYPE_OPTIONS } from '../../localcases';
import { recordStorePersisted, STORE_SESSION_ONLY_ASSUMPTION } from '../../recordStoreNotice';
import { caseFieldSnapshot } from '../../kentangCaseSave';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../dayBoundary';
import { DefLat, DefLon, DefGpsLat, DefGpsLon } from '../../constants';
import { parseBirthInput } from '../normalize/birthText';
import { resolvePlaceOffline } from '../normalize/place';
import { resolveZone } from '../normalize/zone';
import { normalizeGender } from '../normalize/gender';
import { normalizeCaseTypeStrict } from '../normalize/caseType';
import { geoPairToRecordFields } from '../normalize/geoCompass';
import { guardAdditive } from '../guardAdditive';
import { nowStr, ctxDispatch, ctxUi, GUIDE, aiOriginOf } from './_shared';
import { agentBatchSelectEnabled } from '../../perfFlags';
import { INPUT_CASTABLE } from '../divinationCast';
import { datePartOf } from '../../dateStrSafe';
import DateTime from '../../../components/comp/DateTime';

const KENTANG = ['liureng', 'jinkou', 'qimen', 'taiyi', 'sanshiunited'];

function buildPayload(meta){
	const fieldsLike = { after23NewDay: { value: defaultAfter23NewDay() }, lateZiHourUseNextDay: { value: defaultLateZiHourUseNextDay() } };
	const base = { module: meta.module, version: 1, savedAt: new Date().toISOString(), fieldSnapshot: caseFieldSnapshot(fieldsLike), createdBy: 'ai-assistant' };
	if(KENTANG.indexOf(meta.module) >= 0){ return base; }
	return { ...base, settings: { zodiacal: 0, siderealAyanamsa: '', hsys: 0, tradition: 1 }, extra: {}, questionCategory: null, topicId: null };
}

// 去重指纹:类型 + 起卦输入(规整后,键序无关)+ 所问。同一分钟里摇两卦 / 问两件事是两条事盘,不是重复提交。
function stableStringify(v){
	if(Array.isArray(v)){ return `[${v.map(stableStringify).join(',')}]`; }
	if(v && typeof v === 'object'){ return `{${Object.keys(v).sort().filter((k)=>v[k] !== undefined).map((k)=>`${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`; }
	return JSON.stringify(v === undefined ? null : v);
}
function fnv1a(str){
	let h = 0x811c9dc5;
	for(let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
	return h.toString(16).padStart(8, '0');
}
export function caseInputFingerprint({ caseType, inputs, question }){
	const body = stableStringify({ t: `${caseType || ''}`, i: inputs === undefined ? null : inputs, q: `${question || ''}`.trim() });
	return `f1-${fnv1a(body)}-${body.length.toString(36)}`;
}

// 同题 + 同一分钟 + 同类,且起卦输入与所问也相同,才算重复提交(回已有那条)。
// 档里记了指纹(助手建的)按指纹比;没记指纹的旧档 / 用户手建档:带起卦输入的无从比对 → 不当重复(宁可多一条,不丢用户的第二卦),
// 纯凭时间起课的按所问(存在备注里)比。
export function findDuplicateCase(event, divTime, caseType, opts){
	const o = opts || {};
	const key = `${divTime || ''}`.slice(0, 16);
	const fp = o.fingerprint || caseInputFingerprint({ caseType, inputs: o.inputs, question: o.question });
	const hasInputs = o.inputs !== undefined && o.inputs !== null;
	const question = `${o.question || ''}`.trim();
	return listLocalCases({ includeArchived: true }).find((r)=>{
		if(`${r.event || ''}`.trim() !== `${event || ''}`.trim() || `${r.divTime || ''}`.slice(0, 16) !== key || r.caseType !== caseType){ return false; }
		const recFp = r.aiOrigin && r.aiOrigin.inputFingerprint;
		if(recFp){ return recFp === fp; }
		if(hasInputs){ return false; }
		return `${r.memo || ''}`.trim() === question;
	}) || null;
}

// 起课时刻与地点解析(与 cast_divination_case 共用;逐行搬自本工具,行为与文案不变):
// 回 { ok:true, divTime, geo, pos, z } | { ok:false, error:<工具失败回包> };假设说明追加进传入的 assumptions。
export async function resolveCaseTimePlace(args, assumptions){
	let divTime = nowStr();
	let zoneHint;
	let nowSlot = -1;
	if(args.divTime){
		const b = parseBirthInput(args.divTime, { calendar: args.calendar || 'solar' });
		if(!b.ok){ return { ok: false, error: { ok: false, code: b.code, message: `起课时间无法解析: ${args.divTime}` } }; }
		divTime = b.birth; zoneHint = b.zoneHint; assumptions.push(...b.assumptions);
	}else{
		nowSlot = assumptions.push(`起课时间取当前 ${divTime}`) - 1;
	}
	let geo = null;
	let pos = '';
	if(args.place){
		const r = await resolvePlaceOffline(args.place, { dateStr: datePartOf(divTime) });
		if(!r.resolved){ return { ok: false, error: { ok: false, code: 'E_PLACE_NOT_FOUND', message: r.candidates && r.candidates.length ? `地名「${args.place}」有歧义: ${r.candidates.map((c)=>c.name + '/' + c.region).join('、')}` : `未找到地名「${args.place}」`, data: { candidates: r.candidates || [] } } }; }
		geo = geoPairToRecordFields(r.place.gpsLat, r.place.gpsLon); pos = r.place.name;
	}else if(Number.isFinite(Number(args.gpsLat)) && Number.isFinite(Number(args.gpsLon))){
		geo = geoPairToRecordFields(args.gpsLat, args.gpsLon);
	}else{
		geo = { lat: DefLat, lon: DefLon, gpsLat: DefGpsLat, gpsLon: DefGpsLon };
		assumptions.push(`未给地点,按默认坐标 ${DefLat}/${DefLon} 起课`);
	}
	const z = resolveZone({ userZone: args.zone || zoneHint, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, dateStr: datePartOf(divTime) });
	if(z.source === 'fallback'){ assumptions.push('时区按 +08:00 回退'); }
	// 没给起课时间:「此刻」按起课地的时区换算(DateTime.nowForChart,与页面同一入口);此前本机钟面配起课地时区,本机与起课地不同时区就错开时差
	if(nowSlot >= 0){ divTime = DateTime.nowForChart(z.zone).format('YYYY-MM-DD HH:mm:ss'); assumptions[nowSlot] = `起课时间取当前 ${divTime}`; }
	return { ok: true, divTime, geo, pos, z };
}

// 落库 + 刷新列表 + 选中为分析源(批量建档延后到批尾)+ 可选载入工作区(与 cast_divination_case 共用;逐行搬自本工具):
// 回 { ok:true, saved, persisted, selected, selectionDeferred, loaded } | { ok:false, error:<工具失败回包> }
export function persistCaseRecord(toolName, values, args, ctx, assumptions){
	const g = guardAdditive(toolName, values);
	if(!g.ok){ return { ok: false, error: { ok: false, code: g.code, message: '内部守卫拒绝(禁键)' } }; }
	let saved;
	try{ saved = upsertLocalCase(values); }catch(e){ return { ok: false, error: { ok: false, code: 'E_STORE_QUOTA', message: '本地存储空间不足,建事盘失败' } }; }
	// 本机存储不可用:记录只在本次运行里,回 ok + persisted:false 并写明(各建档工具同一口径)
	const persisted = recordStorePersisted('case');
	if(!persisted && assumptions){ assumptions.push(STORE_SESSION_ONLY_ASSUMPTION); }
	const dispatch = ctxDispatch(ctx);
	try{ if(dispatch){ dispatch({ type: 'user/fetchCases', payload: {} }); } }catch(e){ /* noop */ }
	const ui = ctxUi(ctx);
	let selected = false;
	let selectionDeferred = false;
	if(args.selectAsAnalysisSource !== false && typeof ui.selectSource === 'function'){
		// 批量建档(同批多条串行写入,调用方给了 batch / deferSelect):不逐条选中,只登记 cid,由调用方在批尾统一刷新并选中最后一条成功建档
		const canDefer = agentBatchSelectEnabled() && ctx && ctx.batch && ctx.batch.total > 1 && typeof ctx.deferSelect === 'function';
		if(canDefer){
			ctx.deferSelect(saved.cid); selectionDeferred = true; assumptions.push('批量建档:统一在本批结束后选中最后一条');
		}else{
			try{ ui.refreshSources && ui.refreshSources(); ui.selectSource(saved.cid); selected = true; }catch(e){ selected = false; }
		}
	}
	let loaded = false;
	if(args.loadIntoWorkspace && dispatch){
		try{ dispatch({ type: 'user/applyCase', payload: { ...saved } }); dispatch({ type: 'astro/closeDrawer', payload: {} }); loaded = true; }catch(e){ loaded = false; }
	}
	return { ok: true, saved, persisted, selected, selectionDeferred, loaded };
}

export default {
	name: 'create_case_record',
	level: 'additive',
	category: 'records',
	// 输出结构(外部客户端据此校验 structuredContent)
	outputSchema: {
		type: 'object', required: ['cid', 'created', 'duplicate'],
		properties: { cid: { type: 'string' }, created: { type: 'boolean' }, duplicate: { type: 'boolean' }, persisted: { type: 'boolean' }, record: { type: 'object' }, selected: { type: 'boolean' }, loaded: { type: 'boolean' } },
	},
	undoKind: 'trash-record',
	description: `新建一条事盘(占卜/择日案例)档案,起课时间缺省=现在。${GUIDE}:仅当用户明确要求起课/建事盘时调用。六壬/金口诀/奇门/太乙/三式合一/卜卦/择日七类可凭时间起盘;其余(六爻/塔罗/灵棋/报数类等)必须由用户在技法页手动起卦后保存——遇到这些类型直接告诉用户,不要硬建;用户已报出起卦结果的(六爻 / 小六壬 / 灵棋 / 统摄法 / 小成图 / 飞宫)改用 cast_divination_case。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['caseType'],
		properties: {
			caseType: { type: 'string', enum: CASE_TYPE_OPTIONS.map((o)=>o.value), description: '事盘类型键;中文名亦可由 normalize 归一' },
			event: { type: 'string', maxLength: 120, description: '标题;缺省「<技法>占断 <时间>」' },
			question: { type: 'string', maxLength: 2000, description: '所问原文,存为事盘备注' },
			divTime: { type: 'string', maxLength: 60, description: '缺省=现在(本机时间)' },
			calendar: { type: 'string', enum: ['solar', 'lunar'], default: 'solar' },
			gender: { type: 'string', enum: ['male', 'female', 'unknown'] },
			place: { type: 'string', maxLength: 80 },
			gpsLat: { type: 'number', minimum: -90, maximum: 90 },
			gpsLon: { type: 'number', minimum: -180, maximum: 180 },
			zone: { type: 'string', pattern: '^[+-]\\d{2}:\\d{2}$' },
			tags: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 20 } },
			selectAsAnalysisSource: { type: 'boolean', default: true },
			loadIntoWorkspace: { type: 'boolean', default: false },
			allowDuplicate: { type: 'boolean', default: false, description: '同题同一分钟同类且所问相同的事盘已存在时,用户明确要求再建一条才为 true' },
		},
	},
	// 写前预览:归一后的事盘字段(时间缺省=现在只在 run 里定;预览如实写「现在」)
	preview(args){
		const fields = { 事盘类型: `${args.caseType || ''}`, 标题: `${args.event || ''}`, 所问: `${args.question || ''}`.slice(0, 200), 起课时间: args.divTime ? `${args.divTime}` : '现在(本机时间)', 历法: args.calendar || 'solar', 性别: `${args.gender || ''}`, 地点: args.place ? `${args.place}` : (args.gpsLat != null ? `${args.gpsLat}, ${args.gpsLon}` : '') };
		return { title: '新建事盘', before: '', after: Object.keys(fields).filter((k)=>fields[k] !== '').map((k)=>`${k}: ${fields[k]}`).join('\n') };
	},
	async run(args, ctx){
		const assumptions = [];
		const ct = normalizeCaseTypeStrict(args.caseType);
		if(!ct.ok){ return { ok: false, code: 'E_CASE_TYPE_UNKNOWN', message: `未知事盘类型「${args.caseType}」` }; }
		if(!ct.castable){
			return { ok: false, code: 'E_NEEDS_MANUAL_CAST', message: `「${ct.meta.label}」属随机起卦法,不能凭时间起盘;请引导用户到技法页(${ct.meta.tab}${ct.meta.subTab ? '/' + ct.meta.subTab : ''})手动起卦后保存${INPUT_CASTABLE.indexOf(ct.meta.value) >= 0 ? ';用户已报出起卦结果的,改用 cast_divination_case 按结果建事盘' : ''}`, data: { caseType: ct.meta.value, label: ct.meta.label, tab: ct.meta.tab, subTab: ct.meta.subTab, ...(INPUT_CASTABLE.indexOf(ct.meta.value) >= 0 ? { castable: 'cast_divination_case' } : {}) } };
		}
		const tp = await resolveCaseTimePlace(args, assumptions);
		if(!tp.ok){ return tp.error; }
		const { divTime, geo, pos, z } = tp;
		const event = `${args.event || `${ct.meta.label}占断 ${divTime.slice(0, 16)}`}`.trim();
		const inputFingerprint = caseInputFingerprint({ caseType: ct.meta.value, question: args.question });
		const dup = args.allowDuplicate ? null : findDuplicateCase(event, divTime, ct.meta.value, { fingerprint: inputFingerprint, question: args.question });
		if(dup){
			return { ok: true, data: { cid: dup.cid, created: false, duplicate: true, persisted: recordStorePersisted('case') }, message: `已存在同题同时刻、所问相同的事盘「${dup.event}」,未重复新建(确要再建一条请带 allowDuplicate)`, summary: `已有事盘 ${dup.event}`, assumptions };
		}
		const gender = normalizeGender(args.gender, { forCase: true });
		const values = {
			event, caseType: ct.meta.value, divTime, zone: z.zone,
			lat: geo.lat, lon: geo.lon, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, pos,
			group: Array.isArray(args.tags) && args.tags.length ? args.tags : undefined,
			memo: args.question || undefined,
			payload: buildPayload(ct.meta),
			sourceModule: ct.meta.module,
			aiOrigin: aiOriginOf(ctx, 'create_case_record', { inputFingerprint }),
		};
		if(gender !== undefined){ values.gender = gender; }
		const p = persistCaseRecord('create_case_record', values, args, ctx, assumptions);
		if(!p.ok){ return p.error; }
		const { saved, persisted, selected, selectionDeferred, loaded } = p;
		return {
			ok: true,
			data: { cid: saved.cid, created: true, duplicate: false, persisted, castable: true, record: { event: saved.event, caseType: saved.caseType, divTime: saved.divTime, zone: saved.zone, pos: saved.pos, module: saved.sourceModule }, selected, loaded, ...(selectionDeferred ? { selectionDeferred: true } : {}) },
			message: `已新建事盘「${saved.event}」(${ct.meta.label})`,
			summary: `新建事盘 ${saved.event}`,
			assumptions,
			undo: { kind: 'trash-record', payload: { store: 'case', cid: saved.cid } },
		};
	},
};
