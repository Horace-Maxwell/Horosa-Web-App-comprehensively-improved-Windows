// AI 助手·设置六面(chart/mount/app/classical/technique/page)的机器可读表 + 原子写入 + 写前快照/恢复。
// 白名单机械来源:chart=changeCond 可接数据键(pages/index.js 白名单的子集)/mount=TECHNIQUE_SETTINGS_SCHEMA/
// app=全局设置字段表 utils/globalSetupStore GLOBAL_SETUP_FIELDS(显示数组三键只读)/classical=CLASSICAL_PARAM_SPEC/technique=schema localStorage 类/
// page=技法页「排盘设置跨会话保留」(pageSettingsRegistry 登记的页;schema 在各页源文件里,惰性载入后缓存)。
// 密钥/provider/备份/思考档一律不在面内(硬拒正则)。
import * as AstroConst from '../../constants/AstroConst';
import { APPEARANCE_MODES, normalizeAppearanceMode } from '../appearance';
import { SUPPORTED_PD_METHODS, SUPPORTED_PD_TIME_KEYS } from '../primaryDirectionSync';
import { TRIPLICITY_SYSTEMS } from '../triplicityRulers';
import { SCHOOL_PRESET_OPTIONS } from '../../components/astro/schoolPresets';
import { schoolPresetFromFields } from '../../components/astro/schoolPresetFromFields';
import { CLASSICAL_PARAM_SPEC, CLASSICAL_SPEC_KEYS, specByKey } from '../classicalParamSpec';
import { getClassicalChartGlobals, setClassicalChartGlobal } from '../classicalChartGlobals';
import {
	TECHNIQUE_SETTINGS_SCHEMA, getTechniqueSettingsSchema, hasMountSettingsFields, getMountTechniqueDefault,
	saveMountTechniqueDefaults, applyLocalStorageSettings, restoreLocalStorageSettings,
	localStorageMountBaseline, isMountFieldVisible, getTechniqueSettingsCurrentDefaults, mountFieldOptions,
	composeTechniqueDraft, pruneOptionsToNonDefault, sanitizeOptionsToSchema,
} from '../techniqueMountSettings';
import { DAY_BOUNDARY_AFTER23, DAY_BOUNDARY_AFTER24, normalizeDayBoundary, LATE_ZI_HOUR_NEXT_DAY, LATE_ZI_HOUR_TODAY, normalizeLateZiHourMode, announceGlobalSetupChanges } from '../dayBoundary';
import { getStore } from '../storageutil';
import { PAGE_SETTINGS_REGISTRY } from '../pageSettingsRegistry';
import { validateSettingValue } from '../pageSettingsStore';
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from '../safeStorage';
import { getWorkspaceBridge } from './workspaceBridge';
import { isCastInputKey, castInputNeutralOf, pageCastTechnique } from './castInputKeys';
import { resolvePlaceOffline } from './normalize/place';
import { geoPairToRecordFields } from './normalize/geoCompass';
import { dstAwareZoneAt } from '../timezone';
import { newChartSeedValue } from '../newChartSeeds';
import { ZERI_SNAPSHOT_MAX_ROWS_MIN, ZERI_SNAPSHOT_MAX_ROWS_MAX, ZERI_SNAPSHOT_EXPLAIN_ROWS_MIN, ZERI_SNAPSHOT_EXPLAIN_ROWS_MAX, normalizeZeriSnapshotMaxRows, normalizeZeriSnapshotExplainRows } from '../zeriSnapshotPrefs';   // 择日快照两键

export const SETTING_FACETS = ['chart', 'mount', 'app', 'classical', 'technique', 'page'];

// ── page 面(技法页「排盘设置跨会话保留」):页 = pageSettingsRegistry 的 page 键;schema 由各页 definePageSettings 声明,
// 在页面源文件里 —— 惰性载入一次后缓存(不进工具首包)。载入表与登记表逐页对齐(合同看守:多一页 / 少一页即红)。
// 只开放标量(布尔 / 数字 / 字符串,有候选的按候选)与勾选列表;覆盖层 / 子开关表(map)只读。写入走该页自己的 save(同一校验);
// 撤销只还原本次改到的字段(写前没存过 = 删该字段,整份删空 = 删存储键),且须当前值仍等于写后值。已打开的页面在下次载入时按新设置排盘。
export const PAGE_FACET_LOADERS = {
	liureng: ()=>import('../../components/lrzhan/LiuRengMain'),
	dunjia: ()=>import('../../components/dunjia/DunJiaMain'),
	taiyi: ()=>import('../../components/taiyi/TaiYiMain'),
	sanshiunited: ()=>import('../../components/sanshi/SanShiUnitedMain'),
	jinkou: ()=>import('../../components/jinkou/JinKouMain'),
	wuzhao: ()=>import('../../components/wuzhao/WuZhaoMain'),
	geomancy: ()=>import('../../components/geomancy/GeomancyMain'),
	tarot: ()=>import('../../components/tarot/TarotMain'),
	kinastro: ()=>import('../../components/kinastro/KinAstroMain'),
	horary: ()=>import('../../components/horary/HoraryMain'),
	mundane: ()=>import('../../components/mundane/MundaneMain'),
	election: ()=>import('../../components/election/ElectionMain'),
	tianxingzeri: ()=>import('../../components/zeri/TianxingElectionMain'),
	direction: ()=>import('../directionPageSettings'),
	guazhan: ()=>import('../../components/guazhan/GuaZhanMain'),
	acg: ()=>import('../../components/acg/AstroAcg'),
	babylon: ()=>import('../../components/babylon/BabylonMain'),
	fengshui: ()=>import('../../components/fengshui/FengShuiMain'),
};
// 页面面的中文页名(审批卡标题 / 执行后的动作条摘要 / 账本同一套;合同看守:与载入表逐页对齐)
export const PAGE_FACET_TITLES = {
	liureng: '六壬', dunjia: '遁甲', taiyi: '太乙', sanshiunited: '三式', jinkou: '金口诀', wuzhao: '五兆', geomancy: '地占', tarot: '塔罗',
	kinastro: '数算 / 其他命术(策天 · 演禽 · 一掌经等)', horary: '辅盘·卜卦盘', mundane: '辅盘·世俗盘', election: '辅盘·择日盘', tianxingzeri: '天星择日',
	direction: '星运', guazhan: '六爻', acg: '辅盘·占星地图', babylon: '辅盘·巴比伦', fengshui: '风水',
};
// 不进页面面的页(须写理由;合同看守:载入表 ∪ 本表 = 登记表)
export const PAGE_FACET_EXCLUDED = {
	planetarium: '天文馆页模块顶层就要 3D 运行时(进页才加载)与整套星表数据,为改一项显示设置载入不划算;它的设置是纯显示偏好(图层表本就只读),由用户在页内调',
};
const pageApiCache = new Map();
export function pageFacetEntry(page){ return PAGE_SETTINGS_REGISTRY.find((p)=>p && p.page === `${page || ''}`) || null; }
// 载入某页的设置件(definePageSettings 的产物);失败 / 未登记 → null
export async function preparePageFacet(page){
	const entry = pageFacetEntry(page);
	if(!entry || typeof PAGE_FACET_LOADERS[entry.page] !== 'function'){ return null; }
	if(pageApiCache.has(entry.page)){ return pageApiCache.get(entry.page); }
	let api = null;
	try{ const mod = await PAGE_FACET_LOADERS[entry.page](); api = mod && mod[entry.exportName] ? mod[entry.exportName] : null; }catch(e){ api = null; }
	if(api && api.schema && Array.isArray(api.fields)){ pageApiCache.set(entry.page, api); return api; }
	return null;
}
export function __resetPageFacetCacheForTests(){ pageApiCache.clear(); }
function pageFieldType(spec){
	if(!spec){ return 'unknown'; }
	if(spec.type === 'map' || spec.type === 'list'){ return spec.type; }
	return typeof spec.def;
}
// 外部客户端常把布尔 / 数字写成字符串:只在 schema 声明为布尔 / 数字时转,其余原样(值形态严格由该页校验器把关)
function coercePageValue(spec, raw){
	const t = pageFieldType(spec);
	if(t === 'boolean'){ if(raw === 'true' || raw === 1 || raw === '1'){ return true; } if(raw === 'false' || raw === 0 || raw === '0'){ return false; } }
	if(t === 'number' && typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))){ return Number(raw); }
	return raw;
}
// 起卦输入项的提示(describe 给模型看):只拦写具体值;「回到自动」那一档写明可写,挂载面另写可传 null 删掉
function castInputItemHint(facet, technique, key, options){
	const n = castInputNeutralOf(technique, key);
	let back = '';
	if(n.has){
		const opt = Array.isArray(options) ? options.find((o)=>o && sameSettingValue(o.value, n.value)) : null;
		const name = opt && opt.label !== undefined && `${opt.label}` !== '' ? `「${opt.label}」` : (n.value === '' ? '留空' : `${n.value}`);
		back = `;写回${name}(${JSON.stringify(n.value)})= 回到自动,可以写`;
	}
	if(facet === 'page'){ return `起卦输入(该页下次起卦用,决定卦象 / 牌面本身):助手不能写具体值,请用户在技法页亲手选${back}`; }
	return `起卦输入(决定卦象本身):助手不能写具体值,请用户在技法页亲手起卦;要删掉同类默认里已写的这一项(回到不设)传 null${back}`;
}
// 描述里的 default = 当前实际生效的缺省(没写过这一项时真正用的值):全局改过日界 / 古典口径等,就是全局现值,不是 schema 出厂值。
// 出厂值与它不同时另给 schemaDefault(模型据 default 判「现状」,据 schemaDefault 知「出厂是什么」)。
function currentDefaultFields(effective, factory){
	return sameSettingValue(effective, factory) ? { default: effective } : { default: effective, schemaDefault: factory };
}
// 页面面设置项的中文名(审批卡 / 描述里显示):设置件 spec.label 优先;没写 → 同名的挂载齿轮字段的标签(先找该页对应技法,
// 再找任一技法 —— 页面与齿轮同键同义,标签同源);仍没有才回落键名(合同 aiToolsPageFacetLabels 看守:回落键名的只许减不许增)
const mountLabelIndex = { built: false, byTech: {}, any: {} };
function mountFieldLabelOf(tech, key){
	if(!mountLabelIndex.built){
		mountLabelIndex.built = true;
		Object.keys(TECHNIQUE_SETTINGS_SCHEMA).forEach((t)=>{
			const sc = getTechniqueSettingsSchema(t);
			(sc && Array.isArray(sc.fields) ? sc.fields : []).forEach((f)=>{
				if(!f || !f.name || !f.label){ return; }
				mountLabelIndex.byTech[`${t}:${f.name}`] = f.label;
				if(mountLabelIndex.any[f.name] === undefined){ mountLabelIndex.any[f.name] = f.label; }
			});
		});
	}
	return (tech && mountLabelIndex.byTech[`${tech}:${key}`]) || mountLabelIndex.any[key] || '';
}
export function pageFieldLabel(page, key, spec, tech){
	if(spec && typeof spec.label === 'string' && spec.label.trim()){ return spec.label; }
	return mountFieldLabelOf(tech || page, key) || mountFieldLabelOf(page, key) || key;
}
function describePageFacet(page){
	const entry = pageFacetEntry(page);
	const api = entry ? pageApiCache.get(entry.page) : null;
	if(!entry || PAGE_FACET_EXCLUDED[entry.page]){ return { ok: false, code: 'E_SETTING_KEY_NOT_ALLOWED', message: entry ? `技法页 ${entry.page} 的设置不经助手改:${PAGE_FACET_EXCLUDED[entry.page]}` : `没有这个技法页的保存设置:${page};可用:${PAGE_SETTINGS_REGISTRY.map((p)=>p.page).filter((k)=>!PAGE_FACET_EXCLUDED[k]).join(' ')}` }; }
	if(!api){ return { ok: false, code: 'E_SETTING_FACET_UNKNOWN', message: `技法页 ${entry.page} 的设置件没载入` }; }
	// 现值缺省:没存过的键跟随别处(如塔罗随牌组吸附的五项)的页由设置件给 currentDefaults;没给 = schema 出厂值
	const defs = typeof api.currentDefaults === 'function' ? api.currentDefaults() : api.defaults();
	const factory = api.defaults();
	const cur = typeof api.loadSaved === 'function' ? { ...defs, ...api.loadSaved() } : api.load();
	// 起卦输入(五兆起例模式、塔罗牌阵 / 牌组 / 起牌方式、地占起卦方式等)与挂载面同一张表:只读,写具体值即拒
	const castTech = pageCastTechnique(entry.page);
	// 页面上没有控件改的键(登记表 noPageControl):不列、不可写(写它 = 找不到这一项 → 拒),与页面同口径
	const noControl = entry.noPageControl || {};
	const items = api.fields.filter((k)=>!Object.prototype.hasOwnProperty.call(noControl, k)).map((k)=>{
		const spec = api.schema[k] || {};
		const t = pageFieldType(spec);
		const options = Array.isArray(spec.oneOf) ? spec.oneOf.map((v)=>({ value: v, label: `${v}` })) : (t === 'boolean' ? [{ value: true, label: '开' }, { value: false, label: '关' }] : []);
		const castInput = isCastInputKey(castTech, k);
		const settable = !castInput && (t === 'boolean' || t === 'number' || t === 'string' || (t === 'list' && Array.isArray(spec.oneOf)));
		return { key: k, label: pageFieldLabel(entry.page, k, spec, castTech), group: `技法页·${entry.page}`, type: t, options, current: cur[k], ...currentDefaultFields(defs[k], factory[k]), min: spec.min, max: spec.max, settable, ...(castInput ? { hint: castInputItemHint('page', castTech, k, options) } : {}) };
	});
	return { ok: true, items, technique: entry.page, storageKey: entry.storageKey };
}
export const DENIED_SETTING_KEY_RE = /apiKey|token|secret|provider|horosa\.sec\.|horosa\.perf\.|horosa\.debug\.|horosa\.ai\.analysis\.ui|password/i;

// ── app 面(全局显示偏好):键集=globalSetup 字面量;三个显示数组只读(v1 不开放改写)。
export const APP_PREF_READONLY_KEYS = ['chartDisplay', 'planetDisplay', 'lotsDisplay'];
// colorTheme:全仓无消费者(盘面调色板已由界面明暗单源映射),不再暴露为可设项;键在 globalSetup 里只作迁移兼容保留 → 豁免
export const APP_PREF_EXEMPT_KEYS = ['chartDisplayDefaultsVersion', 'planetDisplayDefaultsVersion', 'colorTheme'];
// 由当前盘反查的只读项:schoolPreset(占星流派预设)在 globalSetup 里只是「上次在下拉里选的」记忆值,
// 改它不改盘(此前开放可改 = 回「已修改」而盘面一项没动);读数改为按当前盘口径反查(与星盘页下拉同一函数)。
// 每个派生项:label / options / hint + 读数函数(按全局仓 state 现算;没有当前盘 = undefined,不编值 ——
// 无头模式没有星盘页 state,此前空字段被反查成整宫制的 Valens)。
const APP_PREF_DERIVED = {
	schoolPreset: {
		label: '占星流派预设(按当前盘口径反查,只读)', group: '当前盘口径', type: 'select', options: SCHOOL_PRESET_OPTIONS,
		hint: '整组切换请用户在星盘页左栏「流派预设」里选;助手可用 facet=chart 逐项改黄道 / 宫制 / 界 / 三分等',
		read: (st)=>{
			const fields = st && st.astro && st.astro.fields;
			if(!fields || typeof fields !== 'object' || !Object.keys(fields).length){ return undefined; }
			return schoolPresetFromFields(fields, st.app ? st.app.tripSystem : undefined);
		},
	},
	// 主限法两项是「新命盘缺省」(新盘种子),只认用户亲手改;助手只读(此前可写 → 绕过「AI 改动不记新盘缺省」)
	pdMethod: {
		label: '主限法方法(新命盘缺省,只读)', group: '新命盘缺省', type: 'select', options: SUPPORTED_PD_METHODS.map((m)=>({ value: m, label: m })),
		hint: '改法:用户在推运·主限法页或主限盘栏里亲手选,那一次就是新命盘缺省',
		read: ()=>newChartSeedValue('pdMethod'),
	},
	pdTimeKey: {
		label: '主限时间钥(新命盘缺省,只读)', group: '新命盘缺省', type: 'select', options: SUPPORTED_PD_TIME_KEYS.map((m)=>({ value: m, label: m })),
		hint: '改法:用户在推运·主限法页或主限盘栏里亲手选,那一次就是新命盘缺省',
		read: ()=>newChartSeedValue('pdTimeKey'),
	},
};
export const APP_PREF_DERIVED_KEYS = Object.keys(APP_PREF_DERIVED);
const SWITCH_OPTIONS = [{ value: 0, label: '关' }, { value: 1, label: '开' }];
export function appPrefSpec(){
	return [
		{ key: 'chartStyle', label: '盘面风格', type: 'select', options: AstroConst.CHART_STYLE_OPTIONS, normalize: (v)=>AstroConst.normalizeChartStyle(v) },
		{ key: 'wheelArt', label: '盘面美术', type: 'select', options: AstroConst.WHEEL_ART_OPTIONS, normalize: (v)=>AstroConst.normalizeWheelArt(v) },
		{ key: 'planetListStyle', label: '星体列表样式', type: 'select', options: [{ value: 'full', label: '完整' }, { value: 'degreeOnly', label: '仅度数' }, { value: 'glyphOnly', label: '仅符号' }] },
		{ key: 'indiaChartStyle', label: '印度盘式', type: 'select', options: AstroConst.INDIA_CHART_STYLE_OPTIONS, normalize: (v)=>AstroConst.normalizeIndiaChartStyle(v) },
		// 「配色主题」(colorTheme)全仓无消费者,盘面调色板已由界面明暗单源映射(utils/appearance.js);该键不再暴露为可设项(模型里的键只作迁移兼容保留)。
		{ key: 'appearanceMode', label: '外观(浅色/深色/跟随系统)', type: 'select', options: APPEARANCE_MODES.map((m)=>({ value: m, label: m })), normalize: (v)=>normalizeAppearanceMode(v) },
		{ key: 'showPdBounds', label: '显示主限界', type: 'switch', options: SWITCH_OPTIONS },
		{ key: 'showPlanetHouseInfo', label: '显示星体宫位信息', type: 'switch', options: SWITCH_OPTIONS },
		{ key: 'showAstroMeaning', label: '显示占星释义', type: 'switch', options: SWITCH_OPTIONS },
		{ key: 'showOnlyRulExaltReception', label: '仅显示庙旺互容', type: 'switch', options: SWITCH_OPTIONS },
		{ key: 'voidClassical', label: '空亡古典义(30° 内)', type: 'switch', options: SWITCH_OPTIONS },
		{ key: 'tripSystem', label: '三分主星体系', type: 'select', options: Object.keys(TRIPLICITY_SYSTEMS).map((k)=>({ value: k, label: TRIPLICITY_SYSTEMS[k] })) },
		{ key: 'dayBoundary', label: '日界点', type: 'select', options: [{ value: DAY_BOUNDARY_AFTER23, label: '23 点换日' }, { value: DAY_BOUNDARY_AFTER24, label: '24 点换日' }], normalize: (v)=>normalizeDayBoundary(v) },
		{ key: 'lateZiHourMode', label: '晚子时时柱', type: 'select', options: [{ value: LATE_ZI_HOUR_NEXT_DAY, label: '次日日干起子时' }, { value: LATE_ZI_HOUR_TODAY, label: '今日日干起子时' }], normalize: (v)=>normalizeLateZiHourMode(v) },
		// 择日 AI 快照命中清单上限 / 附判读树行数(全局两键;app/save 持久化,与设置弹窗同源)
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
		// 同挂载齿轮:不是显示翻转,是黄经整体 +180° 重算(=「涵义星座」),且仅南纬生效。
		{ key: 'southchart', label: '南半球星座读法：涵义星座（黄经整体转 180°，仅南纬生效）', type: 'switch', options: SWITCH_OPTIONS, valueType: 'int' },
		{ key: 'place', label: '地点(地名,自动解析经纬与时区)', type: 'text', hint: `按地名改当前盘的经纬与地名;${CHART_PLACE_ZONE_HINT}` },
		{ key: 'gpsLat', label: '纬度(十进制)', type: 'number', min: -90, max: 90, hint: `按经纬改当前盘的地点:地名清空;${CHART_PLACE_ZONE_HINT}` },
		{ key: 'gpsLon', label: '经度(十进制)', type: 'number', min: -180, max: 180, hint: `按经纬改当前盘的地点:地名清空;${CHART_PLACE_ZONE_HINT}` },
	].filter(Boolean);
}

// 换地点时的时区:与页面左栏换地点同一口径(星盘页 changeGeo)—— 按新坐标 + 盘上日期(夏令时按那一天)求时区,
// 只改时区、保留钟面时刻(DateTime.setZone);推不出该地时区 / 盘上没有日期时时区不改。撤销一并还原时区
export const CHART_PLACE_ZONE_HINT = '时区与页面上换地点一致:换成该地在盘上日期的时区(夏令时按那一天),钟面时刻不变;推不出该地时区时不改;撤销时时区一并还原';
// 时区写法 → 分钟数(±HH:MM,也认 +8:00 / +0800);不合法 → null
export function zoneOffsetMinutes(z){
	const m = /^([+-])(\d{1,2}):?(\d{2})$/.exec(`${z === undefined || z === null ? '' : z}`.trim());
	if(!m || Number(m[2]) > 14 || Number(m[3]) > 59){ return null; }
	return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}
// 盘上日期对象(changeCond 认的 tm):要能 format / clone / setZone 才能「只改时区、保留钟面」
function chartDateTimeOf(fields){
	const dv = fields && fields.date ? fields.date.value : undefined;
	return dv && typeof dv.format === 'function' && typeof dv.clone === 'function' && typeof dv.setZone === 'function' ? dv : null;
}
// 写前预览与执行共用:按该地 + 盘上日期定时区。回 { change, zone?, before, day?, reason? }
//   change=true:要换成 zone;reason:'same'(该地时区与盘上相同)/ 'unknown'(推不出该地时区)/ 'no-date'(盘上没有可改时区的日期)
export function planChartZoneForGeo(gpsLat, gpsLon, store){
	const st = store || getStore() || {};
	const fields = st.astro && st.astro.fields ? st.astro.fields : {};
	const dt = chartDateTimeOf(fields);
	const before = fieldValue(fields, 'zone') !== undefined ? fieldValue(fields, 'zone') : (dt ? dt.zone : undefined);
	if(!dt){ return { change: false, reason: 'no-date', before }; }
	let day = '';
	try{ day = `${dt.format('YYYY-MM-DD')}`; }catch(e){ day = ''; }
	if(!day){ return { change: false, reason: 'no-date', before }; }
	let info = null;
	try{
		const la = Number(gpsLat);
		const lo = Number(gpsLon);
		info = Number.isFinite(la) && Number.isFinite(lo) ? dstAwareZoneAt(la, lo, day) : null;
	}catch(e){ info = null; }
	const zone = info && info.offset ? `${info.offset}` : '';
	const zm = zoneOffsetMinutes(zone);
	if(zm === null){ return { change: false, reason: 'unknown', before, day }; }
	if(zm === zoneOffsetMinutes(before)){ return { change: false, reason: 'same', zone, before, day }; }
	return { change: true, zone, before, day };
}
// 按计划给 changeCond 的时刻:盘上日期克隆后只改时区(钟面不动);不改 = null
function chartZoneTm(store, zone){
	const st = store || getStore() || {};
	const dt = chartDateTimeOf(st.astro && st.astro.fields ? st.astro.fields : {});
	if(!dt || zoneOffsetMinutes(zone) === null){ return null; }
	const tm = dt.clone();
	tm.setZone(`${zone}`);
	return tm;
}

function fieldValue(fields, k){
	return fields && fields[k] && fields[k].value !== undefined ? fields[k].value : undefined;
}

// 文本项上限:够写地名 / 逗号串 / 考刻之类,挡住把整篇正文塞进设置
export const SETTING_TEXT_MAX = 2000;
const NUMERIC_TEXT_RE = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/;
// 数值:只收有限数字或纯数字字符串 —— null / '' / 数组 / 布尔此前经 Number() 变成 0 / 1 / 首元素被静默收下。
// 例外:缺省值本身是「空」(''/null,语义 = 留空自出)的字段,传同一个空值 = 回到自出,原样收。
function parseStrictNumber(raw){
	if(typeof raw === 'number'){ return Number.isFinite(raw) ? raw : null; }
	if(typeof raw === 'string' && NUMERIC_TEXT_RE.test(raw)){ const n = Number(raw); return Number.isFinite(n) ? n : null; }
	return null;
}

// 值域校验:返回 { ok, value } (归一后的值) 或 { ok:false }
// 开关类的几种写法(1 / 0 / true / false 及其字符串):下拉档是布尔或 0/1 时按字段 normalize 归一后再对档
const BOOLISH_RAW = [true, false, 1, 0, '1', '0', 'true', 'false'];

// field:技法齿轮的 schema 字段(带 normalize;describe 出的条目不带函数)
function validateAgainst(item, raw, field){
	if(!item){ return { ok: false }; }
	if(item.type === 'number'){
		const emptyDefault = item.default === '' || item.default === null;
		if(emptyDefault && (raw === '' || raw === null)){ return { ok: true, value: item.default }; }
		const n = parseStrictNumber(raw);
		if(n === null){ return { ok: false }; }
		if(typeof item.min === 'number' && n < item.min){ return { ok: false }; }
		if(typeof item.max === 'number' && n > item.max){ return { ok: false }; }
		return { ok: true, value: n };
	}
	if(item.type === 'text'){
		if(typeof raw !== 'string' || raw.length > SETTING_TEXT_MAX){ return { ok: false }; }
		return { ok: true, value: raw };
	}
	if(item.type === 'switch'){
		const v = (raw === true || raw === 1 || raw === '1' || raw === 'on') ? 1 : ((raw === false || raw === 0 || raw === '0' || raw === 'off') ? 0 : null);
		return v === null ? { ok: false } : { ok: true, value: v };
	}
	const opts = item.options || [];
	const normalize = field && typeof field.normalize === 'function' ? field.normalize : item.normalize;
	let hit = opts.find((o)=>o.value === raw || `${o.value}` === `${raw}`);
	// 只对档值本身是布尔(true / false)的开关下拉做这一步(如封局):0 / 1 两档的枚举(时间算法等)与数值档(刻位 / 容许度)
	// 带 Number 归一,放开了会把 true 收成 1、'true' 收成 0 —— 那些照旧只认档值本身
	const boolishOptions = opts.length > 0 && opts.some((o)=>typeof o.value === 'boolean') && opts.every((o)=>typeof o.value === 'boolean' || o.value === '');
	if(!hit && normalize && boolishOptions && BOOLISH_RAW.indexOf(raw) >= 0){
		// 下拉档是布尔 / 0-1 的开关项(封局 / 揲筮模式等):助手按开关习惯传 1 / true 也认
		let nv;
		try{ nv = normalize(raw); }catch(_e){ nv = undefined; }
		if(nv !== undefined && nv !== null){ hit = opts.find((o)=>o.value === nv || `${o.value}` === `${nv}`); }
	}
	if(!hit){ hit = opts.find((o)=>`${o.label}` === `${raw}`); }
	if(!hit){ return { ok: false }; }
	let value = hit.value;
	if(item.valueType === 'int' || item.type === 'segmented' && typeof value === 'number'){ value = Number(value); }
	if(normalize){ value = normalize(value); }
	return { ok: true, value };
}

// ── describe / get
// 要工作区桥才写得了的面(单一判据):当前盘口径走页面的 changeCond,全局显示偏好走 dva dispatch。桥上没有对应函数
//   (无头模式 / 页面未就绪)= 描述标只读并写明原因、校验即拒、写入与撤销都回 E_BRIDGE_UNAVAILABLE —— 四处同读这一个函数
const BRIDGE_FACETS = {
	chart: { fn: 'changeCond', message: '当前不在盘面工作区,无法改当前盘口径' },
	app: { fn: 'dispatch', message: '没有打开的星阙界面(页面尚未就绪,或在无头模式),无法写入全局偏好' },
};
export function facetBridgeBlock(facet){
	const need = BRIDGE_FACETS[facet];
	if(!need){ return null; }
	const bridge = getWorkspaceBridge() || {};
	return typeof bridge[need.fn] === 'function' ? null : { code: 'E_BRIDGE_UNAVAILABLE', message: need.message };
}
function markFacetReadOnly(facet, out){
	const blk = facetBridgeBlock(facet);
	if(!blk || !out || !out.ok){ return out; }
	return { ...out, readOnly: blk, items: (out.items || []).map((it)=>({ ...it, settable: false, hint: blk.message })) };
}

// pendingValues:本次要写的值(校验时传)—— 只用于判字段此刻是否显示(先改流派 / 盘式再改它带出的子项,同一次写入里能一起改)
export function describeFacet(facet, technique, pendingValues){
	if(SETTING_FACETS.indexOf(facet) < 0){ return { ok: false, code: 'E_SETTING_FACET_UNKNOWN' }; }
	if(facet === 'page'){ return describePageFacet(technique); }   // 调用方须先 await preparePageFacet
	const store = getStore() || {};
	if(facet === 'chart'){
		const fields = store.astro && store.astro.fields ? store.astro.fields : {};
		return markFacetReadOnly('chart', { ok: true, items: chartFacetSpec().map((it)=>({ key: it.key, label: it.label, group: '当前盘口径', type: it.type, options: it.options || [], current: it.key === 'place' ? fieldValue(fields, 'pos') : fieldValue(fields, it.key), min: it.min, max: it.max, settable: true, ...(it.hint ? { hint: it.hint } : {}) })) });
	}
	if(facet === 'app'){
		const app = store.app || {};
		const items = appPrefSpec().map((it)=>({ key: it.key, label: it.label, group: '全局显示偏好', type: it.type, options: it.options || [], current: app[it.key], settable: true }));
		APP_PREF_READONLY_KEYS.forEach((k)=>items.push({ key: k, label: `${k}(显示项数组,只读)`, group: '全局显示偏好', type: 'array', options: [], current: app[k], settable: false }));
		APP_PREF_DERIVED_KEYS.forEach((k)=>{
			const d = APP_PREF_DERIVED[k];
			items.push({ key: k, label: d.label, group: d.group, type: d.type, options: d.options, current: d.read(store), settable: false, hint: d.hint });
		});
		return markFacetReadOnly('app', { ok: true, items });
	}
	if(facet === 'classical'){
		const cur = getClassicalChartGlobals() || {};
		return { ok: true, items: CLASSICAL_PARAM_SPEC.map((s)=>({ key: s.key, label: s.label, group: s.group, type: s.type, options: s.options || SWITCH_OPTIONS, current: cur[s.key], default: s.default, settable: s.send !== 'never', hint: s.hint })) };
	}
	const t = `${technique || ''}`;
	const schema = getTechniqueSettingsSchema(t);
	if(!schema || !hasMountSettingsFields(t)){ return { ok: false, code: 'E_SETTING_KEY_NOT_ALLOWED', message: `技法 ${t} 无可调设置(可用: ${Object.keys(TECHNIQUE_SETTINGS_SCHEMA).filter((k)=>hasMountSettingsFields(k)).join(', ')})` }; }
	if(facet === 'technique' && schema.kind !== 'localStorage'){ return { ok: false, code: 'E_SETTING_KEY_NOT_ALLOWED', message: `技法 ${t} 不是本地设置类(请用 facet=mount)` }; }
	const current = facet === 'mount' ? getMountTechniqueDefault(t) : techniqueFacetBaseline(t);
	// 显示条件与挂载抽屉同一判据 isMountFieldVisible(函数式 showWhen + 对象式 when),吃完整草稿 = 全局现值缺省 + 模板 / 本机值 + 本次要写的值。
	// 此前只拿稀疏的模板判、且不认对象式 when:缺省档下隐藏的子项照样列成可改,同一次写入里先改流派再改它带出的子项却被拒
	const curDefaults = getTechniqueSettingsCurrentDefaults(t);
	// 挂载面按联动规则合成草稿(与挂载抽屉、生成时剪枝同一份):选了六爻某流派,细项按该派预设判显隐 ——
	// 平铺叠加会把该派关掉的子项(如神煞起例)列成可改,写进去生成时却被剪掉
	const preCtx = facet === 'mount' ? composeTechniqueDraft(t, curDefaults, current || {}) : { ...curDefaults, ...(current || {}) };
	// 本次要删的键(mount 面传 null)按删后实际生效的值判显隐 = 全局现值缺省(不是 null 本身)
	const pend = {};
	Object.keys(pendingValues && typeof pendingValues === 'object' ? pendingValues : {}).forEach((k)=>{
		pend[k] = (facet === 'mount' && pendingValues[k] === null) ? curDefaults[k] : pendingValues[k];
	});
	const visCtx = facet === 'mount' ? composeTechniqueDraft(t, curDefaults, { ...(current || {}), ...pend }) : { ...preCtx, ...pend };
	const items = schema.fields.filter((f)=>isMountFieldVisible(f, visCtx, schema))
		.map((f)=>{
			// 档位与抽屉同一判据 mountFieldOptions:页面藏起的档不列(现值所在档照列),校验即按它拒
			let opts = f.options ? mountFieldOptions(f, visCtx, preCtx[f.name]) : (f.type === 'switch' ? SWITCH_OPTIONS : []);
			// 技法本地设置面只收字段写明的那几档(身宫法:自定身宫只随盘);现值所在档照列
			if(facet === 'technique' && Array.isArray(f.techniqueFacetValues) && Array.isArray(opts)){
				opts = opts.filter((o)=>f.techniqueFacetValues.some((x)=>sameSettingValue(x, o.value)) || sameSettingValue(o.value, preCtx[f.name]));
			}
			// 起卦输入键(种子 / 报数 / 起例模式等,见 castInputKeys)只读:改了 = 凭参数伪造卦象或把已存事盘重起
			const castInput = facet === 'mount' && isCastInputKey(t, f.name);
			// 只把校验器认得的类型标可改:number/text/switch/带 options 的选择类;multiselect/date/time 等一律只读
			// 键名撞上密钥类硬拒正则的(如南极「密码」)写入恒被拒:描述也如实标只读,不报可改
			const denied = DENIED_SETTING_KEY_RE.test(f.name);
			// 技法本地设置面只写字段自己的存储键:没有存储键的字段(值存在技法页的显示设置里)写了什么也不存;存储键只是新盘种子镜像的
			// (宿度制:页面与 AI 挂载都不读它)写了也不生效 —— 如实标只读
			const noStore = facet === 'technique' && !f.storageKey;
			const seedMirror = facet === 'technique' && !!f.storageIsSeedMirror;
			const settable = !castInput && !denied && !noStore && !seedMirror && (f.type === 'number' || f.type === 'text' || f.type === 'switch' || (Array.isArray(opts) && opts.length > 0 && ['multiselect', 'date', 'datetime', 'time', 'json', 'array'].indexOf(f.type) < 0));
			// 「随流派」空档写进同类默认 = 去掉案例存档里这一项的逐项覆盖(与挂载抽屉同义),不是「不设」:如实告诉模型
			const blankHint = facet !== 'mount' ? {} : (f.blankMeansFollowSchool
				? { hint: '空串「随流派」= 去掉案例存档里这一项的逐项覆盖、按流派取值;不想动它就别写这个键;要删掉同类默认里已写的这一项(回到不设)传 null' }
				: (f.blankHint ? { hint: `${f.blankHint};要删掉同类默认里已写的这一项(回到不设)传 null` } : {}));
			// 只读的类型(日期 / 多选 / 时刻等)写不了值,但同类默认里已写的这一项能删(传 null):如实告诉模型;
			// 技法本地设置面可写的项写明作用范围(字段另写的优先;只收几档的字段另说明)
			const readOnlyHint = facet === 'mount' && !settable ? { hint: '只读(此类型助手写不了值);要删掉同类默认里已写的这一项(回到不设)传 null' }
				: (facet === 'technique' && settable ? { hint: [techniqueFieldScopeHint(f, schema), f.techniqueFacetValuesHint].filter((x)=>x).join(';') } : blankHint);
			return { key: f.name, label: f.label, group: f.group || schema.group || t, type: f.type, options: opts, current: current ? current[f.name] : undefined, ...currentDefaultFields(curDefaults[f.name], f.default), min: f.min, max: f.max, settable, ...(seedMirror && f.recordKey ? { current: newChartSeedValue(f.recordKey) } : {}), ...(castInput ? { hint: castInputItemHint('mount', t, f.name, opts) } : (denied ? { hint: '此项助手不能改,请用户在技法页设置' } : (noStore ? { hint: '此项不在技法本地设置里(存在技法页的显示设置中),助手在这里改不了:请用户在技法页改;AI 分析口径用 facet=mount' } : (seedMirror ? { hint: '此项随盘:改当前盘请用户在技法页左栏选;新命盘缺省只认用户亲手改;AI 分析口径用 facet=mount' } : readOnlyHint)))) };
		});
	return { ok: true, items, technique: t };
}

// 挂载面写入的两条拒绝(写前预览与执行同一份判据):只删键且同类默认里本来就没有这几项 = 没有可删的;删完同类默认变空 = 拒
export function planMountWrite(technique, values){
	const prior = { ...getMountTechniqueDefault(technique) };
	const merged = { ...prior };
	const vals = values && typeof values === 'object' ? values : {};
	const dels = Object.keys(vals).filter((k)=>vals[k] === null);
	Object.keys(vals).forEach((k)=>{ if(vals[k] === null){ delete merged[k]; }else{ merged[k] = vals[k]; } });
	// 只有删键、且同类默认里本来就没有这几项:什么也没删,不记一笔「已修改」
	if(dels.length && dels.length === Object.keys(vals).length && dels.every((k)=>!Object.prototype.hasOwnProperty.call(prior, k))){
		return { ok: false, code: 'E_SETTING_NO_CHANGE', message: `同类默认里没有 ${dels.join('、')} 这一项,没有可删的` };
	}
	// [ai-tools:never-empty-mount-write] 空对象=删键,助手写入路径永不走空;只有撤销恢复可传 prior
	if(!Object.keys(merged).length){ return { ok: false, message: '删掉这几项后同类默认就空了:要整个恢复默认,请用户在挂载设置里点「恢复默认」' }; }
	return { ok: true, merged, prior };
}

// 此刻隐藏的字段被写时的提示:逐个上级候选逐档代入,找出让它显示的那一项并点名;
// 上级项本面写不了、或子项显示出来也写不了时,接上那一项自己的说明(只在拒绝路径上跑)
function hiddenFieldHint(facet, technique, key, values, curItems){
	const base = '此项此刻不显示';
	const sch = getTechniqueSettingsSchema(technique);
	const fields = sch && Array.isArray(sch.fields) ? sch.fields : [];
	// 候选里优先点名「只动这一项」的上级:改流派之类会连带改一串细项,能用更直接的开关就点直接的那个
	const vals = values && typeof values === 'object' ? values : {};
	const curDefaults = getTechniqueSettingsCurrentDefaults(technique);
	const current = facet === 'mount' ? (getMountTechniqueDefault(technique) || {}) : (techniqueFacetBaseline(technique) || {});
	const draftOf = (ov)=>(facet === 'mount' ? composeTechniqueDraft(technique, curDefaults, ov) : { ...curDefaults, ...ov });
	const before = draftOf({ ...current, ...vals });
	let best = null;
	for(const p of fields){
		if(p.name === key){ continue; }
		const cands = Array.isArray(p.options) ? p.options : (p.type === 'switch' ? SWITCH_OPTIONS : []);
		for(const o of cands){
			if(!o || o.value === undefined){ continue; }
			const probe = describeFacet(facet, technique, { ...vals, [p.name]: o.value });
			const child = probe.ok ? (probe.items || []).find((x)=>x.key === key) : null;
			if(!child){ continue; }
			const after = draftOf({ ...current, ...vals, [p.name]: o.value });
			const knock = Object.keys(after).filter((k)=>k !== p.name && `${after[k]}` !== `${before[k]}`).length;
			if(!best || knock < best.knock){ best = { p, o, child, knock }; }
			break;
		}
		if(best && best.knock === 0){ break; }
	}
	if(!best){ return `${base}:它只在某个上级选项取特定档时才显示(先看 describe_settings 里各项的现值)`; }
	const { p, o, child } = best;
	const parentNow = curItems.find((x)=>x.key === p.name);
	let msg = `${base}:上级项「${p.label || p.name}」(${p.name})取「${o.label !== undefined ? o.label : o.value}」时才显示`;
	if(!parentNow){ msg += ';上级项此刻也不显示'; }
	else if(parentNow.settable === false){ msg += `;上级项此面改不了${parentNow.hint ? `(${parentNow.hint})` : ''}`; }
	if(child.settable === false){ msg += `;此项显示出来也改不了${child.hint ? `(${child.hint})` : ''}`; }
	return msg;
}

// 起卦输入键写的是不是「回到自动」那一档:先按字面比;再按该项档位归一(按档名写「自动」、开关写 true 等)后比
function castInputNeutralValue(technique, key, raw, item, field){
	const n = castInputNeutralOf(technique, key);
	if(!n.has || raw === undefined || raw === null || typeof raw === 'object'){ return { ok: false }; }
	if(`${raw}` === `${n.value}`){ return { ok: true, value: n.value }; }
	if(item && (item.type === 'switch' || (Array.isArray(item.options) && item.options.length))){
		const v = validateAgainst({ ...item, type: item.type === 'boolean' ? 'select' : item.type }, raw, field);
		if(v.ok && sameSettingValue(v.value, n.value)){ return { ok: true, value: n.value }; }
	}
	return { ok: false };
}

// ── 原子校验:返回 { ok, values?, code?, badKey? }
export function validateFacetValues(facet, technique, values){
	// 缺桥的面整面拒(与描述标只读同一判据),不落到逐键的「不在可改白名单」
	const blocked = facetBridgeBlock(facet);
	if(blocked){ return { ok: false, ...blocked }; }
	let d = describeFacet(facet, technique, values);
	if(!d.ok){ return d; }
	// 上级项可按档名写(如「时家」):显隐要按归一后的档值判,否则按档名算出的上级值对不上,同一次写的子项被误判隐藏
	if((facet === 'mount' || facet === 'technique') && values && typeof values === 'object'){
		const sch0 = getTechniqueSettingsSchema(d.technique);
		const normed = { ...values };
		let changed = false;
		Object.keys(values).forEach((k)=>{
			if(values[k] === null){ return; }
			const it = (d.items || []).find((x)=>x.key === k);
			if(!it || it.settable === false){ return; }
			const fld = sch0 && Array.isArray(sch0.fields) ? sch0.fields.find((f)=>f.name === k) : null;
			const v = validateAgainst(it, values[k], fld);
			if(v.ok && !sameSettingValue(v.value, values[k])){ normed[k] = v.value; changed = true; }
		});
		if(changed){
			const d2 = describeFacet(facet, technique, normed);
			if(d2.ok){ d = d2; }
		}
	}
	const out = {};
	const keys = Object.keys(values || {});
	if(!keys.length){ return { ok: false, code: 'E_SETTING_VALUE_INVALID', message: 'values 为空' }; }
	// 起卦输入键(挂载面按技法、页面面按该页对应的技法):写具体值即拒;删键(挂载面传 null)与写回「自动」那一档放行
	const castTech = facet === 'mount' ? d.technique : (facet === 'page' ? pageCastTechnique(d.technique) : '');
	for(const k of keys){
		if(DENIED_SETTING_KEY_RE.test(k)){ const it = (d.items || []).find((x)=>x.key === k); return { ok: false, code: 'E_SETTING_KEY_NOT_ALLOWED', badKey: k, ...(it && it.hint ? { hint: it.hint } : {}) }; }
		let castNeutral = null;
		if(castTech && isCastInputKey(castTech, k) && !(facet === 'mount' && values[k] === null)){
			const it0 = (d.items || []).find((x)=>x.key === k);
			const sch0 = facet === 'mount' ? getTechniqueSettingsSchema(d.technique) : null;
			const fld0 = sch0 && Array.isArray(sch0.fields) ? sch0.fields.find((f)=>f.name === k) : null;
			castNeutral = castInputNeutralValue(castTech, k, values[k], it0, fld0);
			if(!castNeutral.ok){ return { ok: false, code: 'E_SETTING_KEY_NOT_ALLOWED', badKey: k, castInput: true }; }
		}
		// 挂载面:null = 把同类默认里的这一项删掉(回到不设);空串在「随流派」项上另有含义(去掉案例存档里这一项),删不回不设。
		// 删键不会造出无效设置:只要是这个技法的设置字段就放行,不看它此刻显不显(此刻隐藏着的旧键也要删得掉)
		if(facet === 'mount' && values[k] === null){
			const sch = getTechniqueSettingsSchema(d.technique);
			if(!sch || !Array.isArray(sch.fields) || !sch.fields.some((f)=>f.name === k)){ return { ok: false, code: 'E_SETTING_KEY_NOT_ALLOWED', badKey: k }; }
			out[k] = null;
			continue;
		}
		const item = d.items.find((it)=>it.key === k);
		if(!item){
			// 是这个技法的设置字段、只是此刻不显示(显隐取决于某个上级选项,可能在别的组):拒绝里点名上级项与档位,不只报「不在白名单」
			const sch = (facet === 'mount' || facet === 'technique') ? getTechniqueSettingsSchema(d.technique) : null;
			const hidden = !!(sch && Array.isArray(sch.fields) && sch.fields.some((f)=>f.name === k));
			return { ok: false, code: 'E_SETTING_KEY_NOT_ALLOWED', badKey: k, ...(hidden ? { hint: hiddenFieldHint(facet, d.technique, k, values, d.items || []) } : {}) };
		}
		if(item.settable === false && !castNeutral){ return { ok: false, code: 'E_SETTING_KEY_NOT_ALLOWED', badKey: k, ...(item.hint ? { hint: item.hint } : {}) }; }
		if(facet === 'page'){
			// 页面面:该页自己的校验器(值形态严格;候选外 / 越界 / 类型不对一律拒)
			const pspec = pageApiCache.get(d.technique).schema[k];
			const pv = validateSettingValue(pspec, coercePageValue(pspec, castNeutral ? castNeutral.value : values[k]));
			if(!pv.ok){ return { ok: false, code: 'E_SETTING_VALUE_INVALID', badKey: k }; }
			out[k] = pv.value;
			continue;
		}
		// 起卦输入写回「自动」那一档:就写表里那一值(日期 / 时刻类只读项没有档位,不走通用校验)
		if(castNeutral){ out[k] = castNeutral.value; continue; }
		const spec = facet === 'app' ? appPrefSpec().find((s)=>s.key === k) : (facet === 'chart' ? chartFacetSpec().find((s)=>s.key === k) : item);
		const tSchema = (facet === 'mount' || facet === 'technique') ? getTechniqueSettingsSchema(d.technique) : null;
		const field = tSchema && Array.isArray(tSchema.fields) ? tSchema.fields.find((f)=>f.name === k) : null;
		const v = validateAgainst(spec || item, values[k], field);
		if(!v.ok){ return { ok: false, code: 'E_SETTING_VALUE_INVALID', badKey: k, ...(facet === 'technique' && field && field.techniqueFacetValuesHint ? { hint: field.techniqueFacetValuesHint } : {}) }; }
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

// 广播给不走 dva 的技法页(紫微/奇门等靠事件同步日界点/晚子时并重算)——写入与撤销回灌共用;派发走全局字段通道单源
function broadcastAppPrefEvents(values){
	announceGlobalSetupChanges(values);
}

// ── 快照(逐键)
// 只记本次要改的那几个键:写前值(snapshot)+ 写后值(written,写入后由 captureWrittenValues 补记)。
// 撤销逐键核对「当前值 == 写后值」:任一键在写入后被用户或另一次改动改过 → 整次拒(E_UNDO_RECORD_CHANGED),一键不动;
// 核对通过才只还原这几个键 —— 同一面里后来手改的其它键、另一次助手改动改的别的键都不碰(两次改动按任意顺序撤销互不串改)。
// 例外:mount 面删键的撤销要求同类默认整张没再变过(writtenTemplate,见 captureWrittenValues);之后同一技法又有改动,请倒序撤。
// 写前「没有这个键」= snapshot 里不带它,还原即删键(chart 面记有效值,见 chartEffectiveValue)。
// 地点一组 = 经纬四键 + 地名 + 时区(换地点时时区随之换,撤销一并还原)
const CHART_PLACE_STORED_KEYS = ['lat', 'lon', 'gpsLat', 'gpsLon', 'pos', 'zone'];
// 盘面字段里不能按同名键下发给 changeCond 的:时区只经 tm(盘上日期只改时区)改 —— 写入与撤销都按这张表换成对应的下发键
export const CHART_COND_KEY_VIA = { zone: 'tm' };
function chartCondPatch(patch){
	const out = { ...patch };
	Object.keys(CHART_COND_KEY_VIA).forEach((k)=>{ delete out[k]; });
	return out;
}

function hasOwn(o, k){ return !!o && Object.prototype.hasOwnProperty.call(o, k); }

// 设置值相等:null / undefined 视为同一个「空」;标量按字面比(盘面字段里 0 与 '0' 是同一档);对象按序列化比
export function sameSettingValue(a, b){
	if(a === b){ return true; }
	const na = a === undefined || a === null;
	const nb = b === undefined || b === null;
	if(na || nb){ return na && nb; }
	if(typeof a !== 'object' && typeof b !== 'object'){ return `${a}` === `${b}`; }
	try{ return JSON.stringify(a) === JSON.stringify(b); }catch(e){ return false; }
}

// chart 面:本次给的键 → 盘面字段键(地点三键落成经纬四键 + pos);没给键 = null(取全部可回灌字段)
function chartWantedKeys(keys){
	if(!Array.isArray(keys)){ return null; }
	const want = [];
	keys.forEach((k)=>{ (CHART_FACET_PLACE_KEYS.indexOf(k) >= 0 ? CHART_PLACE_STORED_KEYS : [k]).forEach((m)=>{ if(want.indexOf(m) < 0){ want.push(m); } }); });
	return want;
}
// 技法本地设置的作用范围:技法表上写的(schema.localScopeHint)优先,这是缺省句;
// 字段另有作用方式的:localScopeHint 整句替换、localScopeExtra 在后面补一句。
// 两个版本:describe 的提示给模型看(带参数名);写前预览(审批卡)与写入成功的回包用户也看得到,用面向用户的那句
// (localScopeHintForUser / 下面的缺省句):不写参数名、不用「请用户…」的说法,意思与给模型的那句一致
const TECHNIQUE_LOCAL_SCOPE_HINT = '只在本次运行头一次打开该技法页时补一次:那张盘未载入记录、该项仍为出厂值才补上;本次运行已打开过该页之后新开的盘、当前已载入的盘都不变,重开软件后头一次打开该页再补(改当前盘请用户在技法页左栏选;AI 分析口径用 facet=mount)';
const TECHNIQUE_LOCAL_SCOPE_HINT_FOR_USER = '生效时机:本次打开软件后第一次进入该技法页时,对还没载入记录、这一项仍是默认值的盘补上;之后新开的盘和已载入的盘不受影响,下次重开软件再进该页时再补。要改当前这张盘,请在技法页左栏选;只想改 AI 分析用的设置,请到 AI 分析的「挂载设置」';
// 技法本地设置面的现状 = 本机仓;存储键只是新盘种子镜像的字段(宿度制)取新盘缺省 —— describe 的现值、子项显隐与写入时的剪枝同一份
function techniqueFacetBaseline(t){
	const out = { ...(localStorageMountBaseline(t) || {}) };
	const schema = getTechniqueSettingsSchema(t);
	(schema && Array.isArray(schema.fields) ? schema.fields : []).forEach((f)=>{
		if(f.storageIsSeedMirror && f.recordKey){
			const sv = newChartSeedValue(f.recordKey);
			if(sv !== undefined){ out[f.name] = sv; }
		}
	});
	return out;
}
function scopeHintOf(o, forUser){
	if(!o){ return ''; }
	return (forUser && o.localScopeHintForUser) || o.localScopeHint || '';
}
function techniqueFieldScopeHint(f, schema, forUser){
	const base = scopeHintOf(f, forUser) || scopeHintOf(schema, forUser) || (forUser ? TECHNIQUE_LOCAL_SCOPE_HINT_FOR_USER : TECHNIQUE_LOCAL_SCOPE_HINT);
	return f && f.localScopeExtra ? `${base};${f.localScopeExtra}` : base;
}
// 本次写到的键各自的作用范围句:同一句的键并成一组;只有一组时只写那一句。
// opts.forUser:审批卡与写入回包用(面向用户的句子;分组时写字段的中文名而不是键名)
export function techniqueScopeNote(technique, keys, opts){
	const forUser = !!(opts && opts.forUser);
	const schema = getTechniqueSettingsSchema(`${technique || ''}`);
	const fields = schema && Array.isArray(schema.fields) ? schema.fields : [];
	const groups = [];
	(Array.isArray(keys) ? keys : []).forEach((k)=>{
		const f = fields.find((x)=>x.name === k);
		const h = techniqueFieldScopeHint(f, schema, forUser);
		const name = forUser && f && f.label ? f.label : k;
		const g = groups.find((x)=>x.hint === h);
		if(g){ g.keys.push(name); }else{ groups.push({ hint: h, keys: [name] }); }
	});
	if(groups.length <= 1){ return groups.length ? groups[0].hint : ''; }
	return groups.map((g)=>`${g.keys.join('、')}:${g.hint}`).join(';');
}
// 本次给的一个键落到哪些存储键(写前快照 / 写后值的键):chart 面的地点键 = 整组地点(经纬四键 + 地名),technique 面 = 字段的存储键
// (字段没有存储键 = 空表,调用方按「判不了」处理);其余面同名
export function facetStoredKeysOf(facet, technique, key){
	if(facet === 'chart'){ return chartWantedKeys([key]); }
	if(facet === 'technique'){ return techniqueStorageKeysFor(technique, [key]); }
	return [key];
}
// 缺键(如默认态未播种的 termsVariant/lotsDocReverse)取「有效值」=全局值→规格默认,否则 JSON 落盘丢 undefined,撤销无法回到写前状态
function chartEffectiveValue(store, k){
	const fields = store && store.astro && store.astro.fields ? store.astro.fields : {};
	const app = (store && store.app) || {};
	let v = fieldValue(fields, k);
	// 时区:盘面没有单独的时区字段时取盘上日期自带的时区(与 planChartZoneForGeo 的「改前」同一读法)
	if(v === undefined && k === 'zone'){ const dt = chartDateTimeOf(fields); if(dt && dt.zone !== undefined){ v = dt.zone; } }
	if(v === undefined && app[k] !== undefined){ v = app[k]; }
	if(v === undefined){ const sp = specByKey(k); if(sp && sp.default !== undefined){ v = sp.default; } }
	return v;
}
// technique 面(本地设置类):字段名 → 存储键;没给键 = 该技法全部存储键
function techniqueStorageKeysFor(technique, keys){
	const schema = getTechniqueSettingsSchema(technique);
	if(!schema || schema.kind !== 'localStorage' || !Array.isArray(schema.fields)){ return []; }
	return schema.fields.filter((f)=>f.storageKey && (!Array.isArray(keys) || keys.indexOf(f.name) >= 0)).map((f)=>f.storageKey);
}
// page 面存储原文 → { obj, values }(坏数据 / 没存过 → 空表,与该页读端同口径)
function readPageStored(storageKey){
	const raw = safeLocalStorageGet(storageKey);
	if(!raw){ return { obj: null, values: {} }; }
	try{
		const obj = JSON.parse(raw);
		const vals = obj && typeof obj === 'object' && obj.values && typeof obj.values === 'object' && !Array.isArray(obj.values) ? obj.values : {};
		return { obj: obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null, values: { ...vals } };
	}catch(e){
		return { obj: null, values: {} };
	}
}

// 逐键读「当前值」—— 写前快照、写后补记、撤销核对三处共用同一读法。回 { 键: 值 },读不到的键不出现;
// technique 面的键是存储键、值是原文串,没存过 = null(与 restoreLocalStorageSettings 同形)。
export function readFacetValues(facet, technique, keys){
	const out = {};
	const list = Array.isArray(keys) ? keys : [];
	const put = (k, v)=>{ if(v !== undefined){ out[k] = v; } };
	if(facet === 'chart'){
		const store = getStore() || {};
		list.forEach((k)=>put(k, chartEffectiveValue(store, k)));
		return out;
	}
	if(facet === 'app'){
		const st = getStore() || {};
		const app = st.app || {};
		list.forEach((k)=>put(k, APP_PREF_DERIVED[k] ? APP_PREF_DERIVED[k].read(st) : app[k]));
		return out;
	}
	if(facet === 'classical'){
		const cur = getClassicalChartGlobals() || {};
		list.forEach((k)=>put(k, cur[k]));
		return out;
	}
	if(facet === 'mount'){
		const cur = getMountTechniqueDefault(technique) || {};
		list.forEach((k)=>{ if(hasOwn(cur, k)){ put(k, cur[k]); } });
		return out;
	}
	if(facet === 'page'){
		const entry = pageFacetEntry(technique);
		if(!entry){ return out; }
		const { values } = readPageStored(entry.storageKey);
		list.forEach((k)=>{ if(hasOwn(values, k)){ put(k, values[k]); } });
		return out;
	}
	list.forEach((sk)=>{ const v = safeLocalStorageGet(sk); out[sk] = v === undefined ? null : v; });
	return out;
}

export function snapshotFacet(facet, technique, keys){
	const store = getStore() || {};
	if(facet === 'chart'){
		// 可回灌字段全集(changeCond 认得的口径键 + 经纬四键 + pos);本次只取改到的那几个
		const want = chartWantedKeys(keys);
		const stored = [];
		['hsys', 'zodiacal', 'siderealAyanamsa', 'termsVariant', 'triplicity', 'lotReversal', 'sectBuffer', 'lotsDocReverse', 'southchart', 'lat', 'lon', 'gpsLat', 'gpsLon', 'pos', 'zone'].forEach((k)=>{
			if(!want || want.indexOf(k) >= 0){ stored.push(k); }
		});
		const snapshot = readFacetValues('chart', technique, stored);
		// 盘上没有地名字段 = 地名为空(与判「有没有变化」同义):记成空串,撤销时地名一并还原
		if(stored.indexOf('pos') >= 0 && !hasOwn(snapshot, 'pos')){ snapshot.pos = ''; }
		return { facet, keys: stored, snapshot, identity: workspaceChartIdentity(store) };
	}
	if(facet === 'app' || facet === 'classical'){
		const ks = Array.isArray(keys) ? keys.slice() : [];
		return { facet, keys: ks, snapshot: readFacetValues(facet, technique, ks) };
	}
	if(facet === 'mount'){
		const ks = Array.isArray(keys) ? keys.slice() : Object.keys(getMountTechniqueDefault(technique) || {});
		return { facet, technique, keys: ks, snapshot: readFacetValues('mount', technique, ks) };
	}
	if(facet === 'page'){
		// 逐键(该页存储原文里 values 下的字段;当时没存过的键 = 不带,撤销即删该键,整份删空则删存储键)
		const entry = pageFacetEntry(technique);
		if(!entry){ return { facet, technique, keys: [], snapshot: {} }; }
		const ks = Array.isArray(keys) ? keys.slice() : entry.fields.slice();
		return { facet, technique: entry.page, keys: ks, snapshot: readFacetValues('page', entry.page, ks) };
	}
	const sks = techniqueStorageKeysFor(technique, keys);
	return { facet, technique, keys: sks, snapshot: readFacetValues(facet, technique, sks) };
}

// 写入后补记写后值。同步落盘的面(classical / mount / page / technique)按同一读法读回(含各自的归一);
// chart / app 经页面状态派发、由页面刷新回全局仓,写后值取本次实际下发的值(applied)。
export function captureWrittenValues(before, applied){
	if(!before || typeof before !== 'object'){ return before; }
	const keys = Array.isArray(before.keys) ? before.keys : [];
	let written = {};
	if(before.facet === 'chart' || before.facet === 'app'){
		const src = applied && typeof applied === 'object' ? applied : {};
		keys.forEach((k)=>{ if(hasOwn(src, k) && src[k] !== undefined){ written[k] = src[k]; } });
	}else{
		written = readFacetValues(before.facet, before.technique, keys);
	}
	// mount 面删过键(写前有、写后无):另记写后整张同类默认 —— 删键的写后值是「没有」,用户之后整份重存 / 恢复默认时这一键照样「没有」,
	// 逐键核对恒通过,撤销会把旧那项塞进用户新存的模板;记下整张,撤销时要求整张没变
	if(before.facet === 'mount'){
		const snap = before.snapshot && typeof before.snapshot === 'object' ? before.snapshot : {};
		const deleted = keys.some((k)=>hasOwn(snap, k) && !hasOwn(written, k));
		if(deleted){ return { ...before, written, writtenTemplate: { ...(getMountTechniqueDefault(before.technique) || {}) } }; }
	}
	return { ...before, written };
}

// chart 面写入计划:本次给的值 → 下发补丁(口径键 + 地点一组 + 时区)。执行与「有没有变化」的判定同一份(placeResult = 地名解析结果,只按地名写时要)
function chartWritePlan(values, placeResult){
	const patch = {};
	let zonePlan = null;
	let zoneTm = null;
	Object.keys(values).forEach((k)=>{ if(CHART_FACET_KEYS.indexOf(k) >= 0){ patch[k] = values[k]; } });
	if(values.place !== undefined || values.gpsLat !== undefined){
		let geo = null;
		let pos;
		if(values.place !== undefined){
			const r = placeResult;
			if(!r || !r.resolved){ return { ok: false, code: 'E_PLACE_NOT_FOUND', message: r && r.candidates && r.candidates.length ? `地名有歧义,候选: ${r.candidates.map((c)=>c.name + '/' + c.region).join('、')}` : '地名未找到' }; }
			geo = geoPairToRecordFields(r.place.gpsLat, r.place.gpsLon);
			pos = r.place.name;
		}else{
			geo = geoPairToRecordFields(values.gpsLat, values.gpsLon);
			pos = '';
			if(!geo){ return { ok: false, code: 'E_SETTING_VALUE_INVALID', badKey: 'gpsLat' }; }
		}
		Object.assign(patch, geo, { pos });
		// 时区随地点(与页面换地点同一口径,见 planChartZoneForGeo):换 = 盘上日期只改时区下发(tm),写后值记新时区;
		// 不换 = 写后值记现时区(撤销核对「当前 == 写后」用)
		zonePlan = planChartZoneForGeo(geo.gpsLat, geo.gpsLon);
		if(zonePlan.change){
			zoneTm = chartZoneTm(null, zonePlan.zone);
			if(!zoneTm){ zonePlan = { ...zonePlan, change: false, reason: 'no-date' }; }
		}
		const zoneAfter = zonePlan.change ? zonePlan.zone : zonePlan.before;
		if(zoneAfter !== undefined && zoneAfter !== null){ patch.zone = zoneAfter; }
	}
	return { ok: true, patch, zonePlan, zoneTm };
}

// ── 「有没有变化」单源判据:按存储键判(写前有没有、写后有没有、值同不同)。
// 写前预览(审批前就拒)、执行后的回包与撤销核对三处同一口径 —— 此前预览按「含缺省的现值」判、执行按存储键判,
// 「从没存过、值恰好等于缺省」的项预览说无变化、执行却落了盘(外部每次确认档因此免审写入)。
// 存储值相等:chart 面地名「没有 / null / 空串」同义(新盘地名初值 null,按经纬度写会写成空串,界面上没有变化);其余按 sameSettingValue
export function storedSettingValueSame(facet, sk, a, b){
	if(facet === 'chart' && sk === 'pos'){
		const blank = (x)=>x === undefined || x === null || x === '';
		if(blank(a) && blank(b)){ return true; }
	}
	return sameSettingValue(a, b);
}
function storedKeyChanged(facet, before, after, sk){
	const hb = hasOwn(before, sk);
	const ha = hasOwn(after, sk);
	if(facet === 'chart' && sk === 'pos' && storedSettingValueSame(facet, sk, hb ? before[sk] : undefined, ha ? after[sk] : undefined)){ return false; }
	if(hb && ha){ return !storedSettingValueSame(facet, sk, before[sk], after[sk]); }
	return hb !== ha;
}
// 本次给的键里真正改到存储的那些(before = 写前快照的 snapshot,after = 写后值 written 或预测的写后值)
export function settingsChangedKeys(facet, technique, values, before, after){
	const b = before && typeof before === 'object' ? before : {};
	const a = after && typeof after === 'object' ? after : {};
	return Object.keys(values || {}).filter((k)=>{
		const sks = facetStoredKeysOf(facet, technique, k) || [];
		if(!sks.length){ return true; }   // 判不了(没有存储键):照列
		return sks.some((sk)=>storedKeyChanged(facet, b, a, sk));
	});
}
// 写入计划(纯读,不落盘):按与 applyFacetValues 同一份写法预测写后存储值,再按上面的判据得出改到的键。
// values 须已过 validateFacetValues;opts.placeResult = chart 面按地名写时的解析结果(没有 = 判不了)。
// 回 { known, changedKeys, before }:known=false(判不了 / 执行会另行拒绝)时调用方不得据此判「无变化」
export function planSettingsWrite(facet, technique, values, opts){
	const o = opts || {};
	const keys = Object.keys(values || {});
	const before = snapshotFacet(facet, technique, keys);
	const snap = before && before.snapshot && typeof before.snapshot === 'object' ? before.snapshot : {};
	const stored = Array.isArray(before && before.keys) ? before.keys : [];
	const unknown = { known: false, changedKeys: keys.slice(), before };
	let predicted = null;
	if(facet === 'chart'){
		if(values.place !== undefined && !o.placeResult){ return unknown; }
		const plan = chartWritePlan(values, o.placeResult);
		if(!plan.ok){ return unknown; }
		predicted = {};
		stored.forEach((k)=>{ if(hasOwn(plan.patch, k) && plan.patch[k] !== undefined){ predicted[k] = plan.patch[k]; } });
	}else if(facet === 'app'){
		predicted = {};
		stored.forEach((k)=>{ if(hasOwn(values, k) && values[k] !== undefined){ predicted[k] = values[k]; } });
	}else if(facet === 'classical'){
		predicted = { ...snap };
		stored.forEach((k)=>{ if(hasOwn(values, k) && CLASSICAL_SPEC_KEYS.indexOf(k) >= 0){ predicted[k] = values[k]; } });
	}else if(facet === 'mount'){
		const plan = planMountWrite(technique, values);
		if(!plan.ok){ return unknown; }
		const saved = sanitizeOptionsToSchema(`${technique || ''}`, plan.merged) || {};
		predicted = {};
		stored.forEach((k)=>{ if(hasOwn(saved, k)){ predicted[k] = saved[k]; } });
	}else if(facet === 'page'){
		const entry = pageFacetEntry(technique);
		const api = entry ? pageApiCache.get(entry.page) : null;
		if(!api || !api.schema){ return unknown; }
		predicted = { ...snap };
		keys.forEach((k)=>{
			if(api.fields.indexOf(k) < 0){ return; }
			const r = validateSettingValue(api.schema[k], values[k]);
			if(r.ok){ predicted[k] = r.value; }
		});
	}else if(facet === 'technique'){
		const schema = getTechniqueSettingsSchema(technique);
		if(!schema || schema.kind !== 'localStorage' || !Array.isArray(schema.fields)){ return unknown; }
		// 与 applyLocalStorageSettings 同一剪枝:等于现状(宿度制取新盘缺省)的不写
		const pruned = pruneOptionsToNonDefault(technique, values, techniqueFacetBaseline(technique)) || {};
		predicted = { ...snap };
		schema.fields.forEach((f)=>{ if(f.storageKey && stored.indexOf(f.storageKey) >= 0 && hasOwn(pruned, f.name)){ predicted[f.storageKey] = `${pruned[f.name]}`; } });
	}else{
		return unknown;
	}
	return { known: true, changedKeys: settingsChangedKeys(facet, technique, values, snap, predicted), before };
}

// ── 写入(调用方已过 validateFacetValues)
export async function applyFacetValues(facet, technique, values){
	const bridge = getWorkspaceBridge() || {};
	if(facet === 'chart'){
		const placeResult = values.place !== undefined ? await resolvePlaceOffline(values.place) : null;
		const plan = chartWritePlan(values, placeResult);
		if(!plan.ok){ return plan; }
		const { patch, zonePlan, zoneTm } = plan;
		const blk = facetBridgeBlock('chart');
		if(blk){ return { ok: false, ...blk }; }
		bridge.changeCond({ ...chartCondPatch(patch), ...(zoneTm ? { tm: zoneTm } : {}), confirmed: true, fromAgent: true });   // AI 改当前盘:不记新盘缺省(时区经 tm 下发,写后值 applied 仍记时区)
		const note = zonePlan && zonePlan.change ? `时区随地点改为 ${zonePlan.zone}(原 ${zonePlan.before === undefined || zonePlan.before === null || zonePlan.before === '' ? '未设' : zonePlan.before};该地在盘上日期 ${zonePlan.day} 的时区,钟面时刻不变)` : '';
		return { ok: true, applied: patch, ...(note ? { note } : {}) };
	}
	if(facet === 'app'){
		const blk = facetBridgeBlock('app');
		if(blk){ return { ok: false, ...blk }; }
		const dispatch = bridge.dispatch;
		dispatch({ type: 'app/save', payload: { ...values } });
		broadcastAppPrefEvents(values);
		return { ok: true, applied: values };
	}
	if(facet === 'classical'){
		Object.keys(values).forEach((k)=>{ if(CLASSICAL_SPEC_KEYS.indexOf(k) >= 0){ setClassicalChartGlobal(k, values[k]); } });
		return { ok: true, applied: values };
	}
	if(facet === 'mount'){
		const plan = planMountWrite(technique, values);
		if(!plan.ok){ return { ok: false, code: plan.code || 'E_SETTING_VALUE_INVALID', message: plan.message }; }
		const merged = plan.merged;
		saveMountTechniqueDefaults(technique, merged);
		return { ok: true, applied: values };
	}
	if(facet === 'page'){
		const entry = pageFacetEntry(technique);
		const api = entry ? pageApiCache.get(entry.page) : null;
		if(!api){ return { ok: false, code: 'E_SETTING_FACET_UNKNOWN', message: '技法页的设置件没载入' }; }
		const written = api.save(values) || [];
		if(written.length !== Object.keys(values).length){ return { ok: false, code: 'E_SETTING_VALUE_INVALID', message: `只写进了 ${written.join(',') || '0 项'}` }; }
		return { ok: true, applied: values, note: '已打开的技法页在下次载入时按新设置排盘' };
	}
	// 写入时剪枝(隐藏的子项不写)按 describe 同一份现状判显隐:宿度制取新盘缺省,不按本机镜像键
	applyLocalStorageSettings(technique, values, techniqueFacetBaseline(technique));
	return { ok: true, applied: values };
}

// ── 恢复(仅撤销路径调用)
// 载荷 = snapshotFacet + captureWrittenValues 的产物 { facet, technique, keys, snapshot, written, identity? }。
// 旧版本记下的整面快照没有写后值:无从核对之后是否被改过,不自动恢复(恢复 = 可能盖掉用户后来的改动)。
export function restoreSettingsSnapshot(payload){
	const { facet, technique, snapshot, written, identity } = payload || {};
	if(!facet || SETTING_FACETS.indexOf(facet) < 0){ return { ok: false, code: 'E_UNDO_NOT_APPLICABLE' }; }
	const keys = payload && Array.isArray(payload.keys) ? payload.keys.map((k)=>`${k}`) : null;
	if(!keys || !written || typeof written !== 'object'){
		return { ok: false, code: 'E_UNDO_NOT_APPLICABLE', message: '这条设置改动没有记下写后值(旧版本记录),无法核对之后是否被改过;请在设置页手工回改' };
	}
	const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
	const bridge = getWorkspaceBridge() || {};
	// 只认各面自己登记的键(不信载荷里的任意键)
	let page = null;
	if(facet === 'chart'){
		if(facetBridgeBlock('chart')){ return { ok: false, ...facetBridgeBlock('chart') }; }
		// 工作区已换成别的盘:回灌会把 A 盘的旧口径/经纬写进 B 盘 → 拒
		if(identity && identity !== workspaceChartIdentity(getStore() || {})){ return { ok: false, code: 'E_UNDO_RECORD_CHANGED' }; }
		const universe = snapshotFacet('chart').keys;
		if(keys.some((k)=>universe.indexOf(k) < 0)){ return { ok: false, code: 'E_UNDO_NOT_APPLICABLE' }; }
	}else if(facet === 'app'){
		if(facetBridgeBlock('app')){ return { ok: false, ...facetBridgeBlock('app') }; }
		const allowed = appPrefSpec().map((sp)=>sp.key);
		if(keys.some((k)=>allowed.indexOf(k) < 0)){ return { ok: false, code: 'E_UNDO_NOT_APPLICABLE' }; }
	}else if(facet === 'page'){
		page = pageFacetEntry(technique);
		if(!page || keys.some((k)=>page.fields.indexOf(k) < 0)){ return { ok: false, code: 'E_UNDO_NOT_APPLICABLE' }; }
	}else if(facet === 'technique'){
		const allowed = techniqueStorageKeysFor(technique);
		if(keys.some((k)=>allowed.indexOf(k) < 0)){ return { ok: false, code: 'E_UNDO_NOT_APPLICABLE' }; }
	}
	// 逐键核对:当前值仍等于写后值才动;任一键被改过 → 整次拒,一键不动
	const cur = readFacetValues(facet, page ? page.page : technique, keys);
	const moved = keys.filter((k)=>!storedSettingValueSame(facet, k, cur[k], written[k]));
	if(moved.length){
		return { ok: false, code: 'E_UNDO_RECORD_CHANGED', keys: moved, message: `${moved.join('、')} 在这次改动之后又被改过,未自动恢复;请在设置页手工回改` };
	}
	if(facet === 'mount' && payload.writtenTemplate && typeof payload.writtenTemplate === 'object'){
		const now = getMountTechniqueDefault(technique) || {};
		const tk = Object.keys(payload.writtenTemplate);
		const same = Object.keys(now).length === tk.length && tk.every((k)=>sameSettingValue(now[k], payload.writtenTemplate[k]));
		if(!same){ return { ok: false, code: 'E_UNDO_RECORD_CHANGED', message: '这次删掉的设置之后同类默认又被整份改过,未自动恢复;请在挂载设置里手工回改' }; }
	}
	if(!keys.length){ return { ok: true }; }
	if(facet === 'chart'){
		const patch = {};
		keys.forEach((k)=>{ if(hasOwn(snap, k) && snap[k] !== undefined){ patch[k] = snap[k]; } });
		// 时区经盘上日期下发(changeCond 只认 tm 改时区):与写入同一做法,只改时区、钟面不动;与现值相同不下发
		const backTm = hasOwn(patch, 'zone') && zoneOffsetMinutes(patch.zone) !== zoneOffsetMinutes(cur.zone) ? chartZoneTm(null, patch.zone) : null;
		bridge.changeCond({ ...chartCondPatch(patch), ...(backTm ? { tm: backTm } : {}), confirmed: true, fromAgent: true });   // 撤销 AI 改动:同样不记新盘缺省
		return { ok: true };
	}
	if(facet === 'app'){
		const back = {};
		keys.forEach((k)=>{ if(hasOwn(snap, k)){ back[k] = snap[k]; } });
		bridge.dispatch({ type: 'app/save', payload: back });
		broadcastAppPrefEvents(back);
		return { ok: true };
	}
	if(facet === 'classical'){
		keys.forEach((k)=>{ setClassicalChartGlobal(k, snap[k]); });
		return { ok: true };
	}
	if(facet === 'mount'){
		// 以现存的同类默认为底,只把这几个键回到写前(写前没有 = 删键);整份删空 = 删该技法键(撤销专用)
		const next = { ...(getMountTechniqueDefault(technique) || {}) };
		keys.forEach((k)=>{ if(hasOwn(snap, k)){ next[k] = snap[k]; }else{ delete next[k]; } });
		saveMountTechniqueDefaults(technique, next);
		return { ok: true };
	}
	if(facet === 'page'){
		const { obj, values } = readPageStored(page.storageKey);
		keys.forEach((k)=>{ if(hasOwn(snap, k)){ values[k] = snap[k]; }else{ delete values[k]; } });
		if(Object.keys(values).length){
			safeLocalStorageSet(page.storageKey, JSON.stringify({ ...(obj || {}), v: obj && obj.v !== undefined ? obj.v : 1, values }));
		}else{
			safeLocalStorageRemove(page.storageKey);
		}
		return { ok: true };
	}
	const back = {};
	keys.forEach((k)=>{ back[k] = hasOwn(snap, k) ? snap[k] : null; });
	restoreLocalStorageSettings(back);
	return { ok: true };
}
