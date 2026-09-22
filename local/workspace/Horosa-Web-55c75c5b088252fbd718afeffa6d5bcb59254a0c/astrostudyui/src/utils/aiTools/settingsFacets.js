// AI 助手·设置五面(chart/mount/app/classical/technique)的机器可读表 + 原子写入 + 写前快照/恢复。
// 白名单机械来源:chart=changeCond 可接数据键(pages/index.js 白名单的子集)/mount=TECHNIQUE_SETTINGS_SCHEMA/
// app=models/app.js globalSetup 字面量键(显示数组三键只读)/classical=CLASSICAL_PARAM_SPEC/technique=schema localStorage 类。
// 密钥/provider/备份/思考档一律不在面内(硬拒正则)。
import * as AstroConst from '../../constants/AstroConst';
import { APPEARANCE_MODES, normalizeAppearanceMode } from '../appearance';
import { SUPPORTED_PD_METHODS, SUPPORTED_PD_TIME_KEYS } from '../primaryDirectionSync';
import { TRIPLICITY_SYSTEMS } from '../triplicityRulers';
import { SCHOOL_PRESET_OPTIONS } from '../../components/astro/schoolPresets';
import { CLASSICAL_PARAM_SPEC, CLASSICAL_SPEC_KEYS, specByKey } from '../classicalParamSpec';
import { getClassicalChartGlobals, setClassicalChartGlobal } from '../classicalChartGlobals';
import {
	TECHNIQUE_SETTINGS_SCHEMA, getTechniqueSettingsSchema, hasMountSettingsFields, getMountTechniqueDefault,
	saveMountTechniqueDefaults, applyLocalStorageSettings, snapshotLocalStorageSettings, restoreLocalStorageSettings,
	localStorageMountBaseline,
} from '../techniqueMountSettings';
import { DAY_BOUNDARY_AFTER23, DAY_BOUNDARY_AFTER24, normalizeDayBoundary, LATE_ZI_HOUR_NEXT_DAY, LATE_ZI_HOUR_TODAY, normalizeLateZiHourMode, lateZiHourModeToBit } from '../dayBoundary';
import { getStore } from '../storageutil';
import { getWorkspaceBridge } from './workspaceBridge';
import { resolvePlaceOffline } from './normalize/place';
import { geoPairToRecordFields } from './normalize/geoCompass';
import { ZERI_SNAPSHOT_MAX_ROWS_MIN, ZERI_SNAPSHOT_MAX_ROWS_MAX, ZERI_SNAPSHOT_EXPLAIN_ROWS_MIN, ZERI_SNAPSHOT_EXPLAIN_ROWS_MAX, normalizeZeriSnapshotMaxRows, normalizeZeriSnapshotExplainRows } from '../zeriSnapshotPrefs';   // [Q-452 A / Q-453] 择日快照两键

export const SETTING_FACETS = ['chart', 'mount', 'app', 'classical', 'technique'];
export const DENIED_SETTING_KEY_RE = /apiKey|token|secret|provider|horosa\.sec\.|horosa\.perf\.|horosa\.debug\.|horosa\.ai\.analysis\.ui|password/i;

// ── app 面(全局显示偏好):键集=globalSetup 字面量;三个显示数组只读(v1 不开放改写)。
export const APP_PREF_READONLY_KEYS = ['chartDisplay', 'planetDisplay', 'lotsDisplay'];
export const APP_PREF_EXEMPT_KEYS = ['chartDisplayDefaultsVersion', 'planetDisplayDefaultsVersion'];
function colorThemeOptions(){
	const out = [];
	for(let i = 0; i < 16; i++){
		if(AstroConst.normalizeColorThemeIndex(i) === i){ out.push({ value: i, label: `配色 ${i}` }); }
	}
	return out;
}
const SWITCH_OPTIONS = [{ value: 0, label: '关' }, { value: 1, label: '开' }];
export function appPrefSpec(){
	return [
		{ key: 'chartStyle', label: '盘面风格', type: 'select', options: AstroConst.CHART_STYLE_OPTIONS, normalize: (v)=>AstroConst.normalizeChartStyle(v) },
		{ key: 'wheelArt', label: '盘面美术', type: 'select', options: AstroConst.WHEEL_ART_OPTIONS, normalize: (v)=>AstroConst.normalizeWheelArt(v) },
		{ key: 'planetListStyle', label: '星体列表样式', type: 'select', options: [{ value: 'full', label: '完整' }, { value: 'degreeOnly', label: '仅度数' }, { value: 'glyphOnly', label: '仅符号' }] },
		{ key: 'indiaChartStyle', label: '印度盘式', type: 'select', options: AstroConst.INDIA_CHART_STYLE_OPTIONS, normalize: (v)=>AstroConst.normalizeIndiaChartStyle(v) },
		{ key: 'colorTheme', label: '配色主题', type: 'select', options: colorThemeOptions(), normalize: (v)=>AstroConst.normalizeColorThemeIndex(v) },
		{ key: 'appearanceMode', label: '外观(浅色/深色/跟随系统)', type: 'select', options: APPEARANCE_MODES.map((m)=>({ value: m, label: m })), normalize: (v)=>normalizeAppearanceMode(v) },
		{ key: 'showPdBounds', label: '显示主限界', type: 'switch', options: SWITCH_OPTIONS },
		{ key: 'pdMethod', label: '主限法方法', type: 'select', options: SUPPORTED_PD_METHODS.map((m)=>({ value: m, label: m })) },
		{ key: 'pdTimeKey', label: '主限时间钥', type: 'select', options: SUPPORTED_PD_TIME_KEYS.map((m)=>({ value: m, label: m })) },
		{ key: 'showPlanetHouseInfo', label: '显示星体宫位信息', type: 'switch', options: SWITCH_OPTIONS },
		{ key: 'showAstroMeaning', label: '显示占星释义', type: 'switch', options: SWITCH_OPTIONS },
		{ key: 'showOnlyRulExaltReception', label: '仅显示庙旺互容', type: 'switch', options: SWITCH_OPTIONS },
		{ key: 'schoolPreset', label: '七政流派预设', type: 'select', options: SCHOOL_PRESET_OPTIONS },
		{ key: 'tripSystem', label: '三分主星体系', type: 'select', options: Object.keys(TRIPLICITY_SYSTEMS).map((k)=>({ value: k, label: TRIPLICITY_SYSTEMS[k] })) },
		{ key: 'dayBoundary', label: '日界点', type: 'select', options: [{ value: DAY_BOUNDARY_AFTER23, label: '23 点换日' }, { value: DAY_BOUNDARY_AFTER24, label: '24 点换日' }], normalize: (v)=>normalizeDayBoundary(v) },
		{ key: 'lateZiHourMode', label: '晚子时时柱', type: 'select', options: [{ value: LATE_ZI_HOUR_NEXT_DAY, label: '次日日干起子时' }, { value: LATE_ZI_HOUR_TODAY, label: '今日日干起子时' }], normalize: (v)=>normalizeLateZiHourMode(v) },
		// [Q-452 A / Q-453 裁决 2026-09-18] 择日 AI 快照命中清单上限 / 附判读树行数(全局两键;app/save 持久化,与设置弹窗同源)
		{ key: 'zeriSnapshotMaxRows', label: '择日快照命中清单上限(行)', type: 'number', min: ZERI_SNAPSHOT_MAX_ROWS_MIN, max: ZERI_SNAPSHOT_MAX_ROWS_MAX, normalize: (v)=>normalizeZeriSnapshotMaxRows(v) },
		{ key: 'zeriSnapshotExplainRows', label: '择日快照附判读树行数', type: 'number', min: ZERI_SNAPSHOT_EXPLAIN_ROWS_MIN, max: ZERI_SNAPSHOT_EXPLAIN_ROWS_MAX, normalize: (v)=>normalizeZeriSnapshotExplainRows(v) },
	];
}

// ── chart 面(当前盘口径,走 changeCond 正门):键与值域
export const CHART_FACET_KEYS = ['hsys', 'zodiacal', 'siderealAyanamsa', 'termsVariant', 'triplicity', 'lotReversal', 'sectBuffer', 'lotsDocReverse', 'southchart'];
export const CHART_FACET_PLACE_KEYS = ['place', 'gpsLat', 'gpsLon'];
function chartFacetSpec(){
	const fromSpec = (k)=>{ const s = specByKey(k); return s ? { key: k, label: s.label, type: s.type, options: s.options || SWITCH_OPTIONS, valueType: s.valueType } : null; };
	return [
		{ key: 'hsys', label: '宫位制', type: 'select', options: AstroConst.HOUSE_SYSTEM_OPTIONS, valueType: 'int' },
		{ key: 'zodiacal', label: '黄道', type: 'select', options: [{ value: 0, label: '回归黄道' }, { value: 1, label: '恒星黄道' }], valueType: 'int' },
		{ key: 'siderealAyanamsa', label: '恒星岁差', type: 'select', options: [{ value: '', label: '默认' }].concat(AstroConst.INDIA_AYANAMSA_OPTIONS.map((o)=>({ value: o.value, label: o.label })), [{ value: 'user', label: '自定义槽位' }]), valueType: 'str' },
		fromSpec('termsVariant'), fromSpec('triplicity'), fromSpec('lotReversal'), fromSpec('sectBuffer'), fromSpec('lotsDocReverse'),
		// [Q-229/T-193] 同挂载齿轮:不是显示翻转,是黄经整体 +180° 重算(=「涵义星座」),且仅南纬生效。
		{ key: 'southchart', label: '南半球星座读法：涵义星座（黄经整体转 180°，仅南纬生效）', type: 'switch', options: SWITCH_OPTIONS, valueType: 'int' },
		{ key: 'place', label: '地点(地名,自动解析经纬/时区)', type: 'text' },
		{ key: 'gpsLat', label: '纬度(十进制)', type: 'number', min: -90, max: 90 },
		{ key: 'gpsLon', label: '经度(十进制)', type: 'number', min: -180, max: 180 },
	].filter(Boolean);
}

function fieldValue(fields, k){
	return fields && fields[k] && fields[k].value !== undefined ? fields[k].value : undefined;
}

// 值域校验:返回 { ok, value } (归一后的值) 或 { ok:false }
function validateAgainst(item, raw){
	if(!item){ return { ok: false }; }
	if(item.type === 'number'){
		const n = Number(raw);
		if(!Number.isFinite(n)){ return { ok: false }; }
		if(item.min !== undefined && n < item.min){ return { ok: false }; }
		if(item.max !== undefined && n > item.max){ return { ok: false }; }
		return { ok: true, value: n };
	}
	if(item.type === 'text'){
		return { ok: typeof raw === 'string', value: `${raw}` };
	}
	if(item.type === 'switch'){
		const v = (raw === true || raw === 1 || raw === '1' || raw === 'on') ? 1 : ((raw === false || raw === 0 || raw === '0' || raw === 'off') ? 0 : null);
		return v === null ? { ok: false } : { ok: true, value: v };
	}
	const opts = item.options || [];
	let hit = opts.find((o)=>o.value === raw || `${o.value}` === `${raw}`);
	if(!hit){ hit = opts.find((o)=>`${o.label}` === `${raw}`); }
	if(!hit){ return { ok: false }; }
	let value = hit.value;
	if(item.valueType === 'int' || item.type === 'segmented' && typeof value === 'number'){ value = Number(value); }
	if(item.normalize){ value = item.normalize(value); }
	return { ok: true, value };
}

// ── describe / get
export function describeFacet(facet, technique){
	if(SETTING_FACETS.indexOf(facet) < 0){ return { ok: false, code: 'E_SETTING_FACET_UNKNOWN' }; }
	const store = getStore() || {};
	if(facet === 'chart'){
		const fields = store.astro && store.astro.fields ? store.astro.fields : {};
		return { ok: true, items: chartFacetSpec().map((it)=>({ key: it.key, label: it.label, group: '当前盘口径', type: it.type, options: it.options || [], current: it.key === 'place' ? fieldValue(fields, 'pos') : fieldValue(fields, it.key), min: it.min, max: it.max, settable: true })) };
	}
	if(facet === 'app'){
		const app = store.app || {};
		const items = appPrefSpec().map((it)=>({ key: it.key, label: it.label, group: '全局显示偏好', type: it.type, options: it.options || [], current: app[it.key], settable: true }));
		APP_PREF_READONLY_KEYS.forEach((k)=>items.push({ key: k, label: `${k}(显示项数组,只读)`, group: '全局显示偏好', type: 'array', options: [], current: app[k], settable: false }));
		return { ok: true, items };
	}
	if(facet === 'classical'){
		const cur = getClassicalChartGlobals() || {};
		return { ok: true, items: CLASSICAL_PARAM_SPEC.map((s)=>({ key: s.key, label: s.label, group: s.group, type: s.type, options: s.options || SWITCH_OPTIONS, current: cur[s.key], default: s.default, settable: s.send !== 'never', hint: s.hint })) };
	}
	const t = `${technique || ''}`;
	const schema = getTechniqueSettingsSchema(t);
	if(!schema || !hasMountSettingsFields(t)){ return { ok: false, code: 'E_SETTING_KEY_NOT_ALLOWED', message: `技法 ${t} 无可调设置(可用: ${Object.keys(TECHNIQUE_SETTINGS_SCHEMA).filter((k)=>hasMountSettingsFields(k)).join(', ')})` }; }
	if(facet === 'technique' && schema.kind !== 'localStorage'){ return { ok: false, code: 'E_SETTING_KEY_NOT_ALLOWED', message: `技法 ${t} 不是本地设置类(请用 facet=mount)` }; }
	const current = facet === 'mount' ? getMountTechniqueDefault(t) : localStorageMountBaseline(t);
	const items = schema.fields.filter((f)=>{ try{ return !f.showWhen || f.showWhen(current || {}); }catch(e){ return true; } })
		.map((f)=>{
			const opts = f.options || (f.type === 'switch' ? SWITCH_OPTIONS : []);
			// 只把校验器认得的类型标可改:number/text/switch/带 options 的选择类;multiselect/date/time 等一律只读
			const settable = f.type === 'number' || f.type === 'text' || f.type === 'switch' || (Array.isArray(opts) && opts.length > 0 && ['multiselect', 'date', 'datetime', 'time', 'json', 'array'].indexOf(f.type) < 0);
			return { key: f.name, label: f.label, group: f.group || schema.group || t, type: f.type, options: opts, current: current ? current[f.name] : undefined, default: f.default, min: f.min, max: f.max, settable };
		});
	return { ok: true, items, technique: t };
}

// ── 原子校验:返回 { ok, values?, code?, badKey? }
export function validateFacetValues(facet, technique, values){
	const d = describeFacet(facet, technique);
	if(!d.ok){ return d; }
	const out = {};
	const keys = Object.keys(values || {});
	if(!keys.length){ return { ok: false, code: 'E_SETTING_VALUE_INVALID', message: 'values 为空' }; }
	for(const k of keys){
		if(DENIED_SETTING_KEY_RE.test(k)){ return { ok: false, code: 'E_SETTING_KEY_NOT_ALLOWED', badKey: k }; }
		const item = d.items.find((it)=>it.key === k);
		if(!item || item.settable === false){ return { ok: false, code: 'E_SETTING_KEY_NOT_ALLOWED', badKey: k }; }
		const spec = facet === 'app' ? appPrefSpec().find((s)=>s.key === k) : (facet === 'chart' ? chartFacetSpec().find((s)=>s.key === k) : item);
		const v = validateAgainst(spec || item, values[k]);
		if(!v.ok){ return { ok: false, code: 'E_SETTING_VALUE_INVALID', badKey: k }; }
		out[k] = v.value;
	}
	if(facet === 'chart'){
		const hasLat = Object.prototype.hasOwnProperty.call(out, 'gpsLat');
		const hasLon = Object.prototype.hasOwnProperty.call(out, 'gpsLon');
		// 只给一半经纬度 = 静默 no-op 却回「已修改」:整体拒
		if(hasLat !== hasLon){ return { ok: false, code: 'E_SETTING_VALUE_INVALID', badKey: hasLat ? 'gpsLon' : 'gpsLat', message: 'gpsLat 与 gpsLon 必须同时给出' }; }
		if(hasLat && Object.prototype.hasOwnProperty.call(out, 'place')){ return { ok: false, code: 'E_SETTING_VALUE_INVALID', badKey: 'place', message: 'place 与经纬度只能给其一' }; }
	}
	return { ok: true, values: out };
}

// 当前工作区盘的身份:回灌快照只允许回到同一张盘(用户中途载入别的盘时撤销必须拒)
function workspaceChartIdentity(store){
	const u = store && store.user ? store.user : {};
	const cid = u.currentChart && u.currentChart.cid && u.currentChart.cid.value !== undefined ? `${u.currentChart.cid.value}` : '';
	const fields = store && store.astro && store.astro.fields ? store.astro.fields : {};
	const name = fieldValue(fields, 'name');
	const date = fieldValue(fields, 'date');
	let day = '';
	try{ day = date && typeof date.format === 'function' ? date.format('YYYY-MM-DD') : (date === undefined ? '' : `${date}`); }catch(e){ day = ''; }
	return `${cid}|${name === undefined ? '' : name}|${day}`;
}

// 广播给不走 dva 的技法页(紫微/奇门等靠事件同步日界点/晚子时并重算)——写入与撤销回灌共用
function broadcastAppPrefEvents(values){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){
			if(values.dayBoundary !== undefined){
				window.dispatchEvent(new CustomEvent('horosa:day-boundary-changed', { detail: { dayBoundary: values.dayBoundary, after23NewDay: values.dayBoundary === DAY_BOUNDARY_AFTER24 ? 0 : 1 } }));
			}
			if(values.lateZiHourMode !== undefined){
				window.dispatchEvent(new CustomEvent('horosa:late-zi-hour-mode-changed', { detail: { lateZiHourMode: values.lateZiHourMode, lateZiHourUseNextDay: lateZiHourModeToBit(values.lateZiHourMode) } }));
			}
		}
	}catch(e){ /* noop */ }
}

// ── 快照
export function snapshotFacet(facet, technique, keys){
	const store = getStore() || {};
	if(facet === 'chart'){
		const fields = store.astro && store.astro.fields ? store.astro.fields : {};
		const app = store.app || {};
		const snap = {};
		// 缺键(如默认态未播种的 termsVariant/lotsDocReverse)记「有效值」=全局值→规格默认,否则 JSON 落盘丢 undefined,撤销无法回到写前状态
		['hsys', 'zodiacal', 'siderealAyanamsa', 'termsVariant', 'triplicity', 'lotReversal', 'sectBuffer', 'lotsDocReverse', 'southchart', 'lat', 'lon', 'gpsLat', 'gpsLon', 'pos'].forEach((k)=>{
			let v = fieldValue(fields, k);
			if(v === undefined && app[k] !== undefined){ v = app[k]; }
			if(v === undefined){ const sp = specByKey(k); if(sp && sp.default !== undefined){ v = sp.default; } }
			if(v !== undefined){ snap[k] = v; }
		});
		return { facet, snapshot: snap, identity: workspaceChartIdentity(store) };
	}
	if(facet === 'app'){
		const app = store.app || {};
		const snap = {};
		(keys || []).forEach((k)=>{ snap[k] = app[k]; });
		return { facet, snapshot: snap };
	}
	if(facet === 'classical'){
		const cur = getClassicalChartGlobals() || {};
		const snap = {};
		(keys || []).forEach((k)=>{ snap[k] = cur[k]; });
		return { facet, snapshot: snap };
	}
	if(facet === 'mount'){
		return { facet, technique, snapshot: { ...getMountTechniqueDefault(technique) } };
	}
	return { facet, technique, snapshot: snapshotLocalStorageSettings(technique) };
}

// ── 写入(调用方已过 validateFacetValues)
export async function applyFacetValues(facet, technique, values){
	const bridge = getWorkspaceBridge() || {};
	if(facet === 'chart'){
		const patch = {};
		Object.keys(values).forEach((k)=>{ if(CHART_FACET_KEYS.indexOf(k) >= 0){ patch[k] = values[k]; } });
		if(values.place !== undefined || values.gpsLat !== undefined){
			let geo = null;
			let pos;
			if(values.place !== undefined){
				const r = await resolvePlaceOffline(values.place);
				if(!r.resolved){ return { ok: false, code: 'E_PLACE_NOT_FOUND', message: r.candidates && r.candidates.length ? `地名有歧义,候选: ${r.candidates.map((c)=>c.name + '/' + c.region).join('、')}` : '地名未找到' }; }
				geo = geoPairToRecordFields(r.place.gpsLat, r.place.gpsLon);
				pos = r.place.name;
			}else{
				geo = geoPairToRecordFields(values.gpsLat, values.gpsLon);
				pos = '';
				if(!geo){ return { ok: false, code: 'E_SETTING_VALUE_INVALID', badKey: 'gpsLat' }; }
			}
			Object.assign(patch, geo, { pos });
		}
		if(typeof bridge.changeCond !== 'function'){ return { ok: false, code: 'E_BRIDGE_UNAVAILABLE', message: '当前不在盘面工作区,无法改当前盘口径' }; }
		bridge.changeCond({ ...patch, confirmed: true });
		return { ok: true, applied: patch };
	}
	if(facet === 'app'){
		const dispatch = bridge.dispatch;
		if(typeof dispatch !== 'function'){ return { ok: false, code: 'E_BRIDGE_UNAVAILABLE', message: '页面尚未就绪,无法写入全局偏好' }; }
		dispatch({ type: 'app/save', payload: { ...values } });
		broadcastAppPrefEvents(values);
		return { ok: true, applied: values };
	}
	if(facet === 'classical'){
		Object.keys(values).forEach((k)=>{ if(CLASSICAL_SPEC_KEYS.indexOf(k) >= 0){ setClassicalChartGlobal(k, values[k]); } });
		return { ok: true, applied: values };
	}
	if(facet === 'mount'){
		const merged = { ...getMountTechniqueDefault(technique), ...values };
		// [ai-tools:never-empty-mount-write] 空对象=删键,助手写入路径永不走空;只有撤销恢复可传 prior
		if(!Object.keys(merged).length){ return { ok: false, code: 'E_SETTING_VALUE_INVALID' }; }
		saveMountTechniqueDefaults(technique, merged);
		return { ok: true, applied: values };
	}
	applyLocalStorageSettings(technique, values);
	return { ok: true, applied: values };
}

// ── 恢复(仅撤销路径调用)
export function restoreSettingsSnapshot(payload){
	const { facet, technique, snapshot, identity } = payload || {};
	if(!facet){ return { ok: false, code: 'E_UNDO_NOT_APPLICABLE' }; }
	const bridge = getWorkspaceBridge() || {};
	if(facet === 'chart'){
		if(typeof bridge.changeCond !== 'function'){ return { ok: false, code: 'E_BRIDGE_UNAVAILABLE' }; }
		// 工作区已换成别的盘:回灌会把 A 盘的旧口径/经纬写进 B 盘 → 拒
		if(identity && identity !== workspaceChartIdentity(getStore() || {})){ return { ok: false, code: 'E_UNDO_RECORD_CHANGED' }; }
		const patch = {};
		Object.keys(snapshot || {}).forEach((k)=>{ if(snapshot[k] !== undefined){ patch[k] = snapshot[k]; } });
		bridge.changeCond({ ...patch, confirmed: true });
		return { ok: true };
	}
	if(facet === 'app'){
		if(typeof bridge.dispatch !== 'function'){ return { ok: false, code: 'E_BRIDGE_UNAVAILABLE' }; }
		bridge.dispatch({ type: 'app/save', payload: { ...(snapshot || {}) } });
		broadcastAppPrefEvents(snapshot || {});
		return { ok: true };
	}
	if(facet === 'classical'){
		Object.keys(snapshot || {}).forEach((k)=>{ setClassicalChartGlobal(k, snapshot[k]); });
		return { ok: true };
	}
	if(facet === 'mount'){
		saveMountTechniqueDefaults(technique, snapshot || {});   // prior 为空 = 回归现状(删键),撤销专用
		return { ok: true };
	}
	restoreLocalStorageSettings(snapshot);
	return { ok: true };
}
