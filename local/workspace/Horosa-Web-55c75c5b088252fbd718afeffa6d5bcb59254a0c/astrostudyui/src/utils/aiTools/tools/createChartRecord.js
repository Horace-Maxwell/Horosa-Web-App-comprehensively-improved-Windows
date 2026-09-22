import { upsertLocalChart, listLocalCharts, getLocalChartsStoreHealth } from '../../localcharts';
import { markFieldsCaptured } from '../../recordFieldsRestore';   // [Q-256/T-219]
import { parseBirthInput } from '../normalize/birthText';
import { resolvePlaceOffline } from '../normalize/place';
import { resolveZone } from '../normalize/zone';
import { normalizeGender } from '../normalize/gender';
import { geoPairToRecordFields } from '../normalize/geoCompass';
import { guardAdditive } from '../guardAdditive';
import { ctxDispatch, ctxUi, GUIDE } from './_shared';
import { agentBatchSelectEnabled } from '../../perfFlags';

export function findDuplicateChart(name, birth){
	const key = `${birth || ''}`.slice(0, 16);
	return listLocalCharts({ includeArchived: true }).find((r)=>`${r.name || ''}`.trim() === `${name || ''}`.trim() && `${r.birth || ''}`.slice(0, 16) === key) || null;
}

export default {
	name: 'create_chart_record',
	level: 'additive',
	category: 'records',
	undoKind: 'trash-record',
	description: `按用户口述的姓名/出生时间/地点/性别新建一条命盘档案并(默认)在 AI 分析页选中它。${GUIDE}:仅当用户明确说要建档/保存/记下这个人时调用;信息不全(无出生时间或地点)先追问,不要编造;本工具永远新建、绝不修改已有档案;同名同生辰已存在时直接返回已有 cid。`,
	inputSchema: {
		type: 'object', additionalProperties: false, required: ['name', 'birth'],
		anyOf: [{ required: ['place'] }, { required: ['gpsLat', 'gpsLon'] }],
		properties: {
			name: { type: 'string', minLength: 1, maxLength: 60 },
			birth: { type: 'string', minLength: 4, maxLength: 60, description: "优先 'YYYY-MM-DD HH:mm';也接受「1990年1月1日早上8点」;农历须写「农历」并给年月日时,闰月写「闰四月」;公元前写「前100年」或「-0100-03-01」" },
			calendar: { type: 'string', enum: ['solar', 'lunar'], default: 'solar' },
			timeUnknown: { type: 'boolean', default: false, description: '用户明确说不知道出生时辰时才为 true(按 12:00 建档并在备注注明)' },
			gender: { type: 'string', enum: ['male', 'female', 'unknown'], default: 'unknown' },
			place: { type: 'string', maxLength: 80 },
			gpsLat: { type: 'number', minimum: -90, maximum: 90 },
			gpsLon: { type: 'number', minimum: -180, maximum: 180 },
			zone: { type: 'string', pattern: '^[+-]\\d{2}:\\d{2}$', description: '仅用户明说时区时填' },
			tags: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 20 } },
			memo: { type: 'string', maxLength: 2000 },
			allowDuplicate: { type: 'boolean', default: false, description: '用户明确要求再建一条同名同生辰时才为 true' },
			selectAsAnalysisSource: { type: 'boolean', default: true },
			loadIntoWorkspace: { type: 'boolean', default: false },
		},
	},
	// [批二③] 写前预览:归一后的记录字段(出生文本按同一解析器归一;地名只显示原文,不在预览里做离线解析)
	preview(args){
		const b = parseBirthInput(args.birth, { calendar: args.calendar || 'solar', timeUnknown: !!args.timeUnknown });
		const fields = { 名字: `${args.name || ''}`, 出生: b.ok ? b.birth : `${args.birth || ''}`, 历法: args.calendar || 'solar', 性别: `${args.gender || ''}`, 出生地: args.place ? `${args.place}` : (args.gpsLat != null ? `${args.gpsLat}, ${args.gpsLon}` : '') };
		if(args.zone){ fields['时区'] = `${args.zone}`; }
		return { title: '新建命盘', before: '', after: Object.keys(fields).filter((k)=>fields[k] !== '').map((k)=>`${k}: ${fields[k]}`).join('\n') };
	},
	async run(args, ctx){
		const assumptions = [];
		const b = parseBirthInput(args.birth, { calendar: args.calendar || 'solar', timeUnknown: !!args.timeUnknown });
		if(!b.ok){
			return { ok: false, code: b.code, message: b.code === 'E_BIRTH_TIME_MISSING' ? '缺少出生时辰:请向用户追问;若用户明确不知道,再以 timeUnknown=true 重试' : `出生时间无法解析: ${args.birth}` };
		}
		assumptions.push(...b.assumptions);
		let geo = null;
		let pos = '';
		if(args.place){
			const r = await resolvePlaceOffline(args.place, { dateStr: b.birth.slice(0, 10) });
			if(!r.resolved){
				return { ok: false, code: 'E_PLACE_NOT_FOUND', message: r.candidates && r.candidates.length ? `地名「${args.place}」有歧义,请让用户确认: ${r.candidates.map((c)=>c.name + '/' + c.region).join('、')}` : `未找到地名「${args.place}」`, data: { candidates: r.candidates || [] } };
			}
			geo = geoPairToRecordFields(r.place.gpsLat, r.place.gpsLon);
			pos = r.place.name;
			if(r.confidence === 'medium'){ assumptions.push(`地名按最接近的「${r.place.name}」解析`); }
		}else{
			geo = geoPairToRecordFields(args.gpsLat, args.gpsLon);
			if(!geo){ return { ok: false, code: 'E_ARGS_INVALID', message: '经纬度不合法' }; }
		}
		const z = resolveZone({ userZone: args.zone || b.zoneHint, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, dateStr: b.birth.slice(0, 10) });
		if(!args.zone && b.zoneHint){ assumptions.push(`时区取自出生时间串后缀 ${b.zoneHint}`); }
		if(z.source === 'dst-aware'){ assumptions.push(`时区按地点+日期推断 ${z.zone}`); }
		if(z.source === 'fallback'){ assumptions.push('时区无法推断,按 +08:00'); }
		const dup = findDuplicateChart(args.name, b.birth);
		if(dup && !args.allowDuplicate){
			return { ok: true, data: { cid: dup.cid, created: false, duplicate: true, persisted: true, record: { name: dup.name, birth: dup.birth, zone: dup.zone, pos: dup.pos } }, message: `已存在同名同生辰档案「${dup.name}」(${dup.birth}),未重复新建;如需再建请明确说明`, summary: `已有档案 ${dup.name}`, assumptions };
		}
		let memo = args.memo || '';
		if(!b.timeGiven){ memo = `${memo ? memo + '\n' : ''}出生时辰未知,按正午 12:00 建档`; }
		const values = {
			name: `${args.name}`.trim(), birth: b.birth, zone: z.zone,
			lat: geo.lat, lon: geo.lon, gpsLat: geo.gpsLat, gpsLon: geo.gpsLon, pos,
			gender: normalizeGender(args.gender),
			group: Array.isArray(args.tags) && args.tags.length ? args.tags : undefined,
			memo: memo || undefined,
			aiOrigin: { actionId: ctx.actionId, tool: 'create_chart_record', at: new Date().toISOString(), origin: ctx.origin || 'in-app' },
		};
		const g = guardAdditive('create_chart_record', values);
		if(!g.ok){ return { ok: false, code: g.code, message: '内部守卫拒绝(禁键)' }; }
		markFieldsCaptured(values);   // [Q-256/T-219] AI 建档=新记录:载入时清单键一律默认(不沿用当前页面设置)
		let saved;
		try{
			saved = upsertLocalChart(values);
		}catch(e){
			return { ok: false, code: 'E_STORE_QUOTA', message: '本地存储空间不足,建档失败' };
		}
		const health = getLocalChartsStoreHealth() || {};
		if(health.lastWriteFailed){ return { ok: false, code: 'E_STORE_NOT_PERSISTED', message: `建档未落盘: ${health.lastFailureReason || '存储错误'}` }; }
		const persisted = health.mode !== 'memory';
		if(!persisted){ assumptions.push('存储处于内存模式,记录重启后可能丢失'); }
		const dispatch = ctxDispatch(ctx);
		try{ if(dispatch){ dispatch({ type: 'user/fetchCharts', payload: {} }); } }catch(e){ /* noop */ }
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
			try{ dispatch({ type: 'user/setCurrentChart', payload: { ...saved } }); loaded = true; }catch(e){ loaded = false; }
		}
		return {
			ok: true,
			data: { cid: saved.cid, created: true, duplicate: false, persisted, record: { name: saved.name, birth: saved.birth, zone: saved.zone, lat: saved.lat, lon: saved.lon, gpsLat: saved.gpsLat, gpsLon: saved.gpsLon, pos: saved.pos, gender: saved.gender }, selected, loaded, ...(selectionDeferred ? { selectionDeferred: true } : {}) },
			message: `已新建命盘档案「${saved.name}」${saved.birth} ${pos || ''}`,
			summary: `新建命盘 ${saved.name}`,
			assumptions,
			undo: { kind: 'trash-record', payload: { store: 'chart', cid: saved.cid } },
		};
	},
};
