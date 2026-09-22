import { upsertLocalCase, listLocalCases, getLocalCasesStoreHealth, CASE_TYPE_OPTIONS } from '../../localcases';
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
import { nowStr, ctxDispatch, ctxUi, GUIDE } from './_shared';
import { agentBatchSelectEnabled } from '../../perfFlags';

const KENTANG = ['liureng', 'jinkou', 'qimen', 'taiyi', 'sanshiunited'];

function buildPayload(meta){
	const fieldsLike = { after23NewDay: { value: defaultAfter23NewDay() }, lateZiHourUseNextDay: { value: defaultLateZiHourUseNextDay() } };
	const base = { module: meta.module, version: 1, savedAt: new Date().toISOString(), fieldSnapshot: caseFieldSnapshot(fieldsLike), createdBy: 'ai-assistant' };
	if(KENTANG.indexOf(meta.module) >= 0){ return base; }
	return { ...base, settings: { zodiacal: 0, siderealAyanamsa: '', hsys: 0, tradition: 1 }, extra: {}, questionCategory: null, topicId: null };
}

export function findDuplicateCase(event, divTime, caseType){
	const key = `${divTime || ''}`.slice(0, 16);
	return listLocalCases({ includeArchived: true }).find((r)=>`${r.event || ''}`.trim() === `${event || ''}`.trim() && `${r.divTime || ''}`.slice(0, 16) === key && r.caseType === caseType) || null;
}

export default {
	name: 'create_case_record',
	level: 'additive',
	category: 'records',
	undoKind: 'trash-record',
	description: `新建一条事盘(占卜/择日案例)档案,起课时间缺省=现在。${GUIDE}:仅当用户明确要求起课/建事盘时调用。六壬/金口诀/奇门/太乙/三式合一/卜卦/择日七类可凭时间起盘;其余(六爻/塔罗/灵棋/报数类等)必须由用户在技法页手动起卦后保存——遇到这些类型直接告诉用户,不要硬建。`,
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
		},
	},
	// [批二③] 写前预览:归一后的事盘字段(时间缺省=现在只在 run 里定;预览如实写「现在」)
	preview(args){
		const fields = { 事盘类型: `${args.caseType || ''}`, 标题: `${args.event || ''}`, 所问: `${args.question || ''}`.slice(0, 200), 起课时间: args.divTime ? `${args.divTime}` : '现在(本机时间)', 历法: args.calendar || 'solar', 性别: `${args.gender || ''}`, 地点: args.place ? `${args.place}` : (args.gpsLat != null ? `${args.gpsLat}, ${args.gpsLon}` : '') };
		return { title: '新建事盘', before: '', after: Object.keys(fields).filter((k)=>fields[k] !== '').map((k)=>`${k}: ${fields[k]}`).join('\n') };
	},
	async run(args, ctx){
		const assumptions = [];
		const ct = normalizeCaseTypeStrict(args.caseType);
		if(!ct.ok){ return { ok: false, code: 'E_CASE_TYPE_UNKNOWN', message: `未知事盘类型「${args.caseType}」` }; }
		if(!ct.castable){
			return { ok: false, code: 'E_NEEDS_MANUAL_CAST', message: `「${ct.meta.label}」属随机起卦法,不能凭时间起盘;请引导用户到技法页(${ct.meta.tab}${ct.meta.subTab ? '/' + ct.meta.subTab : ''})手动起卦后保存`, data: { caseType: ct.meta.value, label: ct.meta.label, tab: ct.meta.tab, subTab: ct.meta.subTab } };
		}
		let divTime = nowStr();
		let zoneHint;
		if(args.divTime){
			const b = parseBirthInput(args.divTime, { calendar: args.calendar || 'solar' });
			if(!b.ok){ return { ok: false, code: b.code, message: `起课时间无法解析: ${args.divTime}` }; }
			divTime = b.birth; zoneHint = b.zoneHint; assumptions.push(...b.assumptions);
		}else{
			assumptions.push(`起课时间取当前 ${divTime}`);
		}
		let geo = null;
		let pos = '';
		if(args.place){
			const r = await resolvePlaceOffline(args.place, { dateStr: divTime.slice(0, 10) });
			if(!r.resolved){ return { ok: false, code: 'E_PLACE_NOT_FOUND', message: r.candidates && r.candidates.length ? `地名「${args.place}」有歧义: ${r.candidates.map((c)=>c.name + '/' + c.region).join('、')}` : `未找到地名「${args.place}」`, data: { candidates: r.candidates || [] } }; }
			geo = geoPairToRecordFields(r.place.gpsLat, r.place.gpsLon); pos = r.place.name;
		}else if(Number.isFinite(Number(args.gpsLat)) && Number.isFinite(Number(args.gpsLon))){
			geo = geoPairToRecordFields(args.gpsLat, args.gpsLon);
		}else{
			geo = { lat: DefLat, lon: DefLon, gpsLat: DefGpsLat, gpsLon: DefGpsLon };
			assumptions.push(`未给地点,按默认坐标 ${DefLat}/${DefLon} 起课`);
		}
		const z = resolveZone({ userZone: args.zone || zoneHint, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, dateStr: divTime.slice(0, 10) });
		if(z.source === 'fallback'){ assumptions.push('时区按 +08:00 回退'); }
		const event = `${args.event || `${ct.meta.label}占断 ${divTime.slice(0, 16)}`}`.trim();
		const dup = findDuplicateCase(event, divTime, ct.meta.value);
		if(dup){
			return { ok: true, data: { cid: dup.cid, created: false, duplicate: true, persisted: true }, message: `已存在同题同时刻事盘「${dup.event}」,未重复新建`, summary: `已有事盘 ${dup.event}`, assumptions };
		}
		const gender = normalizeGender(args.gender, { forCase: true });
		const values = {
			event, caseType: ct.meta.value, divTime, zone: z.zone,
			lat: geo.lat, lon: geo.lon, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, pos,
			group: Array.isArray(args.tags) && args.tags.length ? args.tags : undefined,
			memo: args.question || undefined,
			payload: buildPayload(ct.meta),
			sourceModule: ct.meta.module,
			aiOrigin: { actionId: ctx.actionId, tool: 'create_case_record', at: new Date().toISOString(), origin: ctx.origin || 'in-app' },
		};
		if(gender !== undefined){ values.gender = gender; }
		const g = guardAdditive('create_case_record', values);
		if(!g.ok){ return { ok: false, code: g.code, message: '内部守卫拒绝(禁键)' }; }
		let saved;
		try{ saved = upsertLocalCase(values); }catch(e){ return { ok: false, code: 'E_STORE_QUOTA', message: '本地存储空间不足,建事盘失败' }; }
		const health = getLocalCasesStoreHealth() || {};
		if(health.lastWriteFailed){ return { ok: false, code: 'E_STORE_NOT_PERSISTED', message: `事盘未落盘: ${health.lastFailureReason || '存储错误'}` }; }
		const persisted = health.mode !== 'memory';
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
