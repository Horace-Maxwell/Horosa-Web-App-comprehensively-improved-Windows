// utils/newChartSeeds.js
// 「新盘种子」单源件:随盘键(占星黄道 / 恒星岁差 / 宫制、时间算法、八字长生 / 神煞查法、宿盘宿法、印占选项、主限法口径)的
// 「新命盘缺省 = 你上次亲手设的值」。这些键住在 astro.fields(本盘字段):存命盘时跟着记录走、载入命盘时按记录还原;
// 此前新盘 / 重开软件一律回出厂值,用户体感与「排盘设置改了重开又回去」一样。
//
// 语义(与仓里两个先例同律:classicalChartGlobals 的 schema 种子、七政 ensureGuolaoDefaults 的「只补空」):
//   · 只在**用户亲手改控件**的 handler 里记一笔(recordNewChartSeed*);载入记录 / 全局广播 / 宿主下发 / AI 助手改设置都不记。
//   · 新盘(含重开软件那张缺省盘):models/astro newEmptyFields 的 schema 初值 = 种子值;没存过 = 内建默认,请求体逐字节零回归。
//     schema 里本没有的键(印占大多数 / 顺逆等)只在种子非缺省时才新建 entry,保持「默认态 fields 键集逐字节不变」。
//   · 载入命盘 / 事盘**不播**:applyRecordToFields 先把种子键复位到内建默认(schema 没有的键撤掉),记录里有的键再覆盖 ——
//     记录自带的口径永远优先;记录里没有 = 存档时为默认。
//   · 存盘捕获(captureNonDefaultTechniqueFields)按**内建默认**判「非默认」,不按种子:否则与种子同值的口径不落库,
//     换机 / 改种子之后旧盘静默漂移(与古典口径键 Q-257 同一教训)。
//   · 择日宿主里内嵌的技法页不记种子(口径由工作台下发 / 扫描引擎钉死;各页按 techniqueScope / usesSavedSettings 门控)。
//   · 主限法:没改过 = 内建默认(Alcabitius + Ptolemy 默认路径逐字节不动);改过的种子只作用于新盘。
//   · 八字左栏的「时间算法」仍是本页覆盖层(新命盘 / 载入命盘时复位,Q-314 裁决 A),它复位到的缺省 = 这里的 timeAlg 种子,
//     由「设置 → 全局设置」的「时间算法」项或紫微页亲手改动写入。
import { safeJsonParseFromStorage, safeJsonStringifyToStorage, safeLocalStorageRemove } from './safeStorage';
import * as AstroConst from '../constants/AstroConst';
import {
	DEFAULT_PD_METHOD, DEFAULT_PD_PROJECTION, DEFAULT_PD_FRAME, DEFAULT_PD_FRAMEWORK, DEFAULT_PD_TIME_KEY, DEFAULT_PD_TYPE,
	SUPPORTED_PD_METHODS, SUPPORTED_PD_PROJECTIONS, SUPPORTED_PD_FRAMES, SUPPORTED_PD_FRAMEWORKS,
} from './primaryDirectionSync';

export const NEW_CHART_SEEDS_STORAGE_KEY = 'horosa.chart.newChartSeeds.v1';
export const NEW_CHART_SEEDS_EVENT = 'horosa:new-chart-seeds-changed';

const HSYS_VALUES = (AstroConst.HOUSE_SYSTEM_OPTIONS || []).map((o)=>o.value);
const isStr = (v, max)=>typeof v === 'string' && v.length <= max;
const isJsonObjectText = (v)=>{
	if(!isStr(v, 4000) || !v.trim()){ return false; }
	try{ const o = JSON.parse(v); return !!o && typeof o === 'object' && !Array.isArray(o); }catch(e){ return false; }
};

// 键表:def = 内建默认(必须 ≡ models/astro newEmptyFields 的 schema 初值;合同测试逐键锁),inSchema = schema 本有此键,
// check = 取值合法性(不合法的种子当没存过;与各页 normalize 同口径)。group 只用于文案 / 分组统计。
export const NEW_CHART_SEED_SPEC = {
	// 占星本命(三式合一同用共享 fields.zodiacal / siderealAyanamsa / hsys;黄道 / 宫制仍是本盘键不入全局,Q-260)
	zodiacal: { def: 0, inSchema: true, group: 'astro', check: (v)=>v === 0 || v === 1 },
	siderealAyanamsa: { def: '', inSchema: true, group: 'astro', check: (v)=>isStr(v, 40) },
	hsys: { def: 1, inSchema: true, group: 'astro', check: (v)=>HSYS_VALUES.indexOf(v) >= 0 },
	// 全局「时间算法」缺省:紫微 / 七政 / 六壬 / 金口诀 / 导出头共用的 fields.timeAlg 由它起始;八字覆盖层复位到它
	timeAlg: { def: 0, inSchema: true, group: 'time', check: (v)=>[0, 1, 2, 3].indexOf(v) >= 0 },
	// 八字
	phaseType: { def: 0, inSchema: true, group: 'bazi', check: (v)=>[0, 1, 2].indexOf(v) >= 0 },
	godKeyPos: { def: '年', inSchema: true, group: 'bazi', check: (v)=>['年', '日', '年日'].indexOf(v) >= 0 },
	// 宿盘宿法(与七政共写同一键;七政首开另有自己的「只补空」仓,默认 2,不在此表)
	doubingSu28: { def: 0, inSchema: true, group: 'suzhan', check: (v)=>[0, 1, 2, 3, 4, 5, 6, 7, 8].indexOf(v) >= 0 },
	// 印占(INDIA_OPTION_FIELD_STATE_MAP 里除大运流月 / 年盘年份 / 三旗这类逐盘输入外的选项)
	indiaHsys: { def: AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT, inSchema: true, group: 'india', check: (v)=>AstroConst.normalizeIndiaHouseSystem(v) === v },
	indiaAyanamsa: { def: AstroConst.INDIA_AYANAMSA_DEFAULT, inSchema: true, group: 'india', check: (v)=>AstroConst.normalizeIndiaAyanamsa(v) === v },
	indiaNodeType: { def: AstroConst.INDIA_NODE_TYPE_DEFAULT, inSchema: false, group: 'india', check: (v)=>v === 'mean' || v === 'true' },
	indiaDashaSystem: { def: AstroConst.INDIA_DASHA_SYSTEM_DEFAULT, inSchema: false, group: 'india', check: (v)=>AstroConst.normalizeIndiaDashaSystem(v) === v },
	indiaDashaSeed: { def: 'moon', inSchema: false, group: 'india', check: (v)=>isStr(v, 40) && v.length > 0 },
	indiaDashaYearLength: { def: AstroConst.INDIA_DASHA_YEAR_DEFAULT, inSchema: false, group: 'india', check: (v)=>typeof v === 'number' && AstroConst.normalizeIndiaDashaYear(v) === v },
	indiaAnnualChartType: { def: AstroConst.INDIA_ANNUAL_CHART_TYPE_DEFAULT, inSchema: false, group: 'india', check: (v)=>AstroConst.normalizeIndiaAnnualChartType(v) === v },
	indiaSthiraStart: { def: 'lagna', inSchema: false, group: 'india', check: (v)=>v === 'lagna' || v === 'brahma' },
	indiaSchool: { def: AstroConst.INDIA_SCHOOL_DEFAULT, inSchema: false, group: 'india', check: (v)=>AstroConst.normalizeIndiaSchool(v) === v },
	indiaVargaVariant: { def: null, inSchema: false, group: 'india', check: (v)=>isJsonObjectText(v) },
	indiaKarakaScheme: { def: AstroConst.INDIA_KARAKA_SCHEME_DEFAULT, inSchema: false, group: 'india', check: (v)=>AstroConst.normalizeIndiaKarakaScheme(v) === v },
	indiaYuddhaCriterion: { def: AstroConst.INDIA_YUDDHA_CRITERION_DEFAULT, inSchema: false, group: 'india', check: (v)=>AstroConst.normalizeIndiaYuddhaCriterion(v) === v },
	indiaDashaVariants: { def: null, inSchema: false, group: 'india', check: (v)=>!!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 },
	indiaVargaSet: { def: '1,9,10,12', inSchema: false, group: 'india', check: (v)=>isStr(v, 40) && /^\d+(,\d+){0,3}$/.test(v) },
	// 主限法口径(方法 / 时间钥匙 / In Zodiaco·Mundo / 流派预设所写的投影·定局·框架·平行)
	pdMethod: { def: DEFAULT_PD_METHOD, inSchema: true, group: 'pd', check: (v)=>SUPPORTED_PD_METHODS.indexOf(v) >= 0 },
	pdTimeKey: { def: DEFAULT_PD_TIME_KEY, inSchema: true, group: 'pd', check: (v)=>isStr(v, 40) && v.length > 0 },
	pdtype: { def: DEFAULT_PD_TYPE, inSchema: true, group: 'pd', check: (v)=>v === 0 || v === 1 },
	pdProjection: { def: DEFAULT_PD_PROJECTION, inSchema: true, group: 'pd', check: (v)=>SUPPORTED_PD_PROJECTIONS.indexOf(v) >= 0 },
	pdFrame: { def: DEFAULT_PD_FRAME, inSchema: true, group: 'pd', check: (v)=>SUPPORTED_PD_FRAMES.indexOf(v) >= 0 },
	pdFramework: { def: DEFAULT_PD_FRAMEWORK, inSchema: true, group: 'pd', check: (v)=>SUPPORTED_PD_FRAMEWORKS.indexOf(v) >= 0 },
	pdParallel: { def: 0, inSchema: true, group: 'pd', check: (v)=>v === 0 || v === 1 },
};
export const NEW_CHART_SEED_KEYS = Object.keys(NEW_CHART_SEED_SPEC);

function same(a, b){
	if(a === b){ return true; }
	if((a && typeof a === 'object') || (b && typeof b === 'object')){
		try{ return JSON.stringify(a) === JSON.stringify(b); }catch(e){ return false; }
	}
	return false;
}

function readStored(){
	try{
		const raw = safeJsonParseFromStorage(NEW_CHART_SEEDS_STORAGE_KEY);
		const vals = raw && typeof raw === 'object' && raw.values && typeof raw.values === 'object' ? raw.values : {};
		const out = {};
		NEW_CHART_SEED_KEYS.forEach((k)=>{
			if(!Object.prototype.hasOwnProperty.call(vals, k)){ return; }
			const spec = NEW_CHART_SEED_SPEC[k];
			const v = vals[k];
			if(v === null || v === undefined){ return; }
			try{ if(spec.check(v)){ out[k] = v; } }catch(e){ /* 校验函数抛错 = 不合法 */ }
		});
		return out;
	}catch(e){
		return {};
	}
}

function emit(detail){
	try{
		if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
			window.dispatchEvent(new CustomEvent(NEW_CHART_SEEDS_EVENT, { detail }));
		}
	}catch(e){ /* noop */ }
}

export function isNewChartSeedKey(key){
	return Object.prototype.hasOwnProperty.call(NEW_CHART_SEED_SPEC, `${key}`);
}

export function newChartSeedIsInSchema(key){
	const spec = NEW_CHART_SEED_SPEC[key];
	return !!(spec && spec.inSchema);
}

export function newChartSeedInternalDefault(key){
	const spec = NEW_CHART_SEED_SPEC[key];
	return spec ? spec.def : undefined;
}

// 新盘该用的值:存过且合法 → 存的;否则内建默认。永不抛。
export function newChartSeedValue(key){
	const spec = NEW_CHART_SEED_SPEC[key];
	if(!spec){ return undefined; }
	const stored = readStored();
	return Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : spec.def;
}

// 所有存过的种子(只含亲手改过且仍合法的键;缺省态 = {})
export function newChartSeedOverrides(){
	return readStored();
}

// schema 本没有的键:只在种子非缺省时才新建 entry(默认态 fields 键集逐字节不变)。给 newEmptyFields 展开用。
export function newChartSeedExtraEntries(){
	const out = {};
	const stored = readStored();
	NEW_CHART_SEED_KEYS.forEach((k)=>{
		const spec = NEW_CHART_SEED_SPEC[k];
		if(spec.inSchema || !Object.prototype.hasOwnProperty.call(stored, k) || same(stored[k], spec.def)){ return; }
		out[k] = { value: stored[k], name: [k] };
	});
	return out;
}

// 载入记录前的复位:schema 本有的种子键回内建默认(只动 fields 里已有的 entry,新建 entry),schema 没有的撤掉。
// 返回新对象;记录里有的键由调用方随后覆盖。
export function resetNewChartSeedKeysToInternalDefaults(fields){
	const out = { ...(fields || {}) };
	NEW_CHART_SEED_KEYS.forEach((k)=>{
		const spec = NEW_CHART_SEED_SPEC[k];
		if(out[k] === undefined){ return; }
		if(spec.inSchema){
			if(!same(out[k] && out[k].value, spec.def)){ out[k] = { ...out[k], value: spec.def }; }
		}else{
			delete out[k];
		}
	});
	return out;
}

// 记一笔(用户亲手改)。不合法 / 非种子键忽略;值 == 内建默认即撤掉该键(与从未改过同形)。返回真正写入的键名。
export function recordNewChartSeeds(patch){
	if(!patch || typeof patch !== 'object'){ return []; }
	const stored = readStored();
	const written = [];
	Object.keys(patch).forEach((k)=>{
		const spec = NEW_CHART_SEED_SPEC[k];
		if(!spec){ return; }
		const v = patch[k] && typeof patch[k] === 'object' && !Array.isArray(patch[k]) && Object.prototype.hasOwnProperty.call(patch[k], 'value') && Object.keys(patch[k]).length <= 2 && Object.prototype.hasOwnProperty.call(patch[k], 'name')
			? patch[k].value : patch[k];   // 既收裸值也收 fields entry 形态({ value, name })
		if(v === undefined){ return; }
		if(v === null || same(v, spec.def)){
			if(Object.prototype.hasOwnProperty.call(stored, k)){ delete stored[k]; written.push(k); }
			return;
		}
		let ok = false;
		try{ ok = !!spec.check(v); }catch(e){ ok = false; }
		if(!ok){ return; }
		if(!same(stored[k], v)){ stored[k] = v; written.push(k); }
	});
	if(!written.length){ return written; }
	try{
		if(Object.keys(stored).length){ safeJsonStringifyToStorage(NEW_CHART_SEEDS_STORAGE_KEY, { values: stored }); }
		else{ safeLocalStorageRemove(NEW_CHART_SEEDS_STORAGE_KEY); }
	}catch(e){ /* 配额:静默 */ }
	emit({ keys: written });
	return written;
}

export function recordNewChartSeed(key, value){
	return recordNewChartSeeds({ [key]: value });
}

export function subscribeNewChartSeeds(fn){
	if(typeof window === 'undefined' || typeof fn !== 'function'){ return ()=>{}; }
	const h = (e)=>fn(e && e.detail ? e.detail : {});
	window.addEventListener(NEW_CHART_SEEDS_EVENT, h);
	const sh = (e)=>{ const k = e && e.key != null ? `${e.key}` : ''; if(!k || k === NEW_CHART_SEEDS_STORAGE_KEY){ fn({ keys: ['*'] }); } };
	window.addEventListener('storage', sh);
	return ()=>{ window.removeEventListener(NEW_CHART_SEEDS_EVENT, h); window.removeEventListener('storage', sh); };
}

export function __resetNewChartSeedsForTest(){
	try{ safeLocalStorageRemove(NEW_CHART_SEEDS_STORAGE_KEY); }catch(e){ /* noop */ }
}
