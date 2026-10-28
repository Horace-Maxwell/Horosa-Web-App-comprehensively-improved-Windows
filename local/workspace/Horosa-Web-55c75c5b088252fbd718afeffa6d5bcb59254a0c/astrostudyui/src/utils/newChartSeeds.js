// utils/newChartSeeds.js
// 「新盘种子」单源件:随盘键(占星黄道 / 恒星岁差 / 宫制、时间算法、八字长生 / 神煞查法、宿盘宿法、宿占人事十二宫起宫、印占选项、主限法口径)的
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
import { safeJsonParseFromStorage, safeJsonStringifyToStorage, safeLocalStorageRemove, safeLocalStorageGet, safeLocalStorageSet } from './safeStorage';
import * as AstroConst from '../constants/AstroConst';
import {
	DEFAULT_PD_METHOD, DEFAULT_PD_PROJECTION, DEFAULT_PD_FRAME, DEFAULT_PD_FRAMEWORK, DEFAULT_PD_TIME_KEY, DEFAULT_PD_TYPE,
	SUPPORTED_PD_METHODS, SUPPORTED_PD_PROJECTIONS, SUPPORTED_PD_FRAMES, SUPPORTED_PD_FRAMEWORKS,
} from './primaryDirectionSync';

export const NEW_CHART_SEEDS_STORAGE_KEY = 'horosa.chart.newChartSeeds.v1';
export const NEW_CHART_SEEDS_EVENT = 'horosa:new-chart-seeds-changed';

const HSYS_VALUES = AstroConst.HOUSE_SYSTEM_OPTIONS.map((o)=>o.value);
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
	// 全局「时间算法」缺省:紫微 / 七政 / 导出头共用的 fields.timeAlg 由它起始;八字覆盖层复位到它。
	// 六壬 / 奇门 / 三式各在本页保存自己的时间算法、不写共用字段;金口诀 / 太乙用各自的「时间基准」
	timeAlg: { def: 0, inSchema: true, group: 'time', check: (v)=>[0, 1, 2, 3].indexOf(v) >= 0 },
	// 八字
	phaseType: { def: 0, inSchema: true, group: 'bazi', check: (v)=>[0, 1, 2].indexOf(v) >= 0 },
	godKeyPos: { def: '年', inSchema: true, group: 'bazi', check: (v)=>['年', '日', '年日'].indexOf(v) >= 0 },
	// 宿盘宿法(与七政共写同一键;两页亲手改都记这里,七政仓只作镜像;旧版只在七政仓的值一次性并入,缺省 0)
	doubingSu28: { def: 0, inSchema: true, group: 'suzhan', check: (v)=>[0, 1, 2, 3, 4, 5, 6, 7, 8].indexOf(v) >= 0 },
	// 宿占人事十二宫起宫(0 八字 / 1 上升):此前只存在宿占偏好里(suzhanHouseStartMode),新盘读它、存盘判非默认也按它 ——
	// 偏好是上升时存上升盘不落键,换机或改偏好后旧盘漂;载入事盘还会改写偏好。现种子是唯一来源(偏好只作镜像)。
	// 例外:旧记录缺这个键时按「存盘时的偏好」理解(recordMissingFallback:一次性并入时把当时的偏好冻结下来,
	// 此后不随种子变),此后新存的记录恒带这个键(alwaysCapture)。
	houseStartMode: { def: 0, inSchema: true, group: 'suzhan', check: (v)=>v === 0 || v === 1, alwaysCapture: true, recordMissingFallback: true },
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

// 同义旧仓一次性并入:旧版七政页的宿度制只存在七政自己的仓(horosaGuolaoSu28Mode),新命盘缺省却看种子 ——
// 两页各认一份,最后一次亲手选的不一定生效。现两页亲手改都记种子(七政仓只作镜像),旧仓里已有的非默认值并入一次。
export const NEW_CHART_SEEDS_LEGACY_FLAG = 'horosa.chart.newChartSeeds.legacyMerged.v1';
// 记录缺键时的取值(recordMissingFallback 的键):并入时冻结的旧版偏好 { 键: 值 }。冻结后不随种子变 ——
// 此前取种子现值,用户之后在宿盘亲手改起宫,同一张旧盘再载入就变了
export const NEW_CHART_SEEDS_RECORD_MISSING_KEY = 'horosa.chart.newChartSeeds.recordMissing.v1';
function readRecordMissingFrozen(){
	const o = safeJsonParseFromStorage(NEW_CHART_SEEDS_RECORD_MISSING_KEY);
	return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
}
function freezeRecordMissing(key, value, force){
	const o = readRecordMissingFrozen();
	if(!force && Object.prototype.hasOwnProperty.call(o, key)){ return o[key]; }
	o[key] = value;
	safeJsonStringifyToStorage(NEW_CHART_SEEDS_RECORD_MISSING_KEY, o);   // 写不进(配额)时下次再冻;本函数永不抛
	return value;
}
const GLOBAL_SETUP_KEY = 'globalSetup';   // 与 utils/constants GlobalSetupKey 同名(此处不引 constants,免循环)
const LEGACY_SEED_MIRRORS = {
	doubingSu28: { key: 'horosaGuolaoSu28Mode', parse: (s)=>Number(s) },
	houseStartMode: { key: 'suzhanHouseStartMode', parse: (s)=>(parseInt(s, 10) === 1 ? 1 : 0) },
};
function mergeLegacyOnce(out){
	try{
		if(typeof window === 'undefined' || !window.localStorage){ return out; }
		if(safeLocalStorageGet(NEW_CHART_SEEDS_LEGACY_FLAG) === '1'){ return out; }
		let changed = false;
		Object.keys(LEGACY_SEED_MIRRORS).forEach((k)=>{
			const m = LEGACY_SEED_MIRRORS[k];
			const spec = NEW_CHART_SEED_SPEC[k];
			const raw = safeLocalStorageGet(m.key);
			let legacy = spec.def;
			if(raw !== null && raw !== undefined && raw !== ''){
				const v = m.parse(raw);
				let ok = false;
				try{ ok = !!spec.check(v); }catch(e){ ok = false; }
				if(ok){ legacy = v; }
			}
			// 旧记录缺这个键 = 当时等于旧版偏好:冻结下来(只冻一次)
			if(spec.recordMissingFallback){ freezeRecordMissing(k, legacy); }
			if(Object.prototype.hasOwnProperty.call(out, k)){
				// 种子已有值:旧仓只作镜像,同步成种子值(此前不改,读旧仓的地方与新盘实际用的种子不一致)
				if(`${raw}` !== `${out[k]}`){ safeLocalStorageSet(m.key, `${out[k]}`); }
				return;
			}
			if(!same(legacy, spec.def)){ out[k] = legacy; changed = true; }
		});
		// 主限法方法 / 时间钥匙的旧仓在全局设置(globalSetup)里:启动时曾拿它盖过种子,两处存储各说各话。现种子唯一,
		// 旧仓里与内建默认不同的值并入一次(种子已有的不动)
		const gs = safeJsonParseFromStorage(GLOBAL_SETUP_KEY);
		if(gs && typeof gs === 'object'){
			['pdMethod', 'pdTimeKey'].forEach((k)=>{
				if(Object.prototype.hasOwnProperty.call(out, k)){ return; }
				const v = gs[k];
				const spec = NEW_CHART_SEED_SPEC[k];
				if(v === undefined || v === null || v === '' || same(v, spec.def)){ return; }
				let ok = false;
				try{ ok = !!spec.check(v); }catch(e){ ok = false; }
				if(ok){ out[k] = v; changed = true; }
			});
		}
		if(changed){ safeJsonStringifyToStorage(NEW_CHART_SEEDS_STORAGE_KEY, { values: out }); }
		safeLocalStorageSet(NEW_CHART_SEEDS_LEGACY_FLAG, '1');
	}catch(e){ /* 并入失败:下次再试 */ }
	return out;
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
		return mergeLegacyOnce(out);
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

// 存盘恒捕获(不按「非默认才落」):判不出旧记录缺键是「当时为默认」还是「当时等于偏好」的键用它
export function newChartSeedAlwaysCaptured(key){
	const spec = NEW_CHART_SEED_SPEC[key];
	return !!(spec && spec.alwaysCapture);
}

// 记录缺这个键时载入用什么:一般种子键 = 内建默认(记录口径优先、种子不播给载入的记录);
// 标了 recordMissingFallback 的(旧版只按偏好判非默认、缺键 = 当时等于偏好)= 一次性并入时冻结的旧版偏好(之后不随种子变)
export function newChartSeedRecordMissingValue(key){
	const spec = NEW_CHART_SEED_SPEC[key];
	if(!spec){ return undefined; }
	if(!spec.recordMissingFallback){ return spec.def; }
	readStored();   // 确保一次性并入已跑过(并入时冻结旧版偏好)
	const frozen = readRecordMissingFrozen();
	if(Object.prototype.hasOwnProperty.call(frozen, key)){
		let ok = false;
		try{ ok = !!spec.check(frozen[key]); }catch(e){ ok = false; }
		if(ok){ return frozen[key]; }
	}
	// 并入早于冻结机制(或冻结值坏了 —— 坏值覆盖写):以此刻的种子值冻结,此后固定
	return freezeRecordMissing(key, newChartSeedValue(key), true);
}

// 只读版:有合法冻结值就返回它,否则返回「此刻读会冻成的值」(种子现值),**不写存储** —— 恢复计划(预览与执行共用)用,
// 预览不得先把值冻进本机(此前预览一次就多出一把冻结值键,「先预览再恢复」与「直接恢复」结果不同)
export function peekNewChartSeedRecordMissingValue(key){
	const spec = NEW_CHART_SEED_SPEC[key];
	if(!spec){ return undefined; }
	if(!spec.recordMissingFallback){ return spec.def; }
	const frozen = readRecordMissingFrozen();
	if(Object.prototype.hasOwnProperty.call(frozen, key)){
		let ok = false;
		try{ ok = !!spec.check(frozen[key]); }catch(e){ ok = false; }
		if(ok){ return frozen[key]; }
	}
	return newChartSeedValue(key);
}

// 恢复备份前按原始包键集定的计划(包里没带的旧版状态,由本机这边补齐):
//   clearFlag —— 包里有旧版同义存储(七政宿度制 / 宿占起宫 / 全局设置的主限两项)却没有并入标志(旧版导出的包):
//                恢复后清掉本机并入标志,让恢复回来的旧仓值再并入一次(种子已有的不动);
//   freeze    —— 旧版导出的包(有设置,却既无冻结值也无并入标志):旧记录缺键时的取值按包的口径直接写定 ——
//                包里有旧版镜像键按它解析,没有 = 来源机从没改过 = 内建缺省(旧版里键缺席即缺省)。
//                此前靠「删冻结值、再读恢复回来的镜像」重冻:包里没有镜像键时读到的是本机镜像,表达不了「来源为缺省」;
//   backfill  —— 冻结值会因恢复而变(包里带了不同的冻结值 / 旧版包的口径与本机不同):恢复前先把本机缺这个键的命盘补成本机原来的取值,
//                本机这些旧盘不因恢复而改口径(冻结值是整机一份,记录却是合并的)。
//   pkgCaliber —— 包的口径已知(新版包冻结值合法 / 判为旧版包)时这个键在包里的取值。恢复只在补了才改变结果时用它给包里缺键的命盘
//                显式补上(unifiedBackup.fillPackageChartsMissing):冻结值会变(backfill 有这个键),或本机同 cid 那张显式带了不同的值
//                (同 cid 合并时包里缺的键不盖本机值 —— 不补则那张盘其余字段按包、唯独这一项按本机);口径相同的不补
//   新版包的冻结值不合法(手改 / 损坏;正常导出都校验过)→ 按旧版包同一推法取包的口径并写定冻结值,补记与冻结同源,坏值不进记录;
//                镜像键那一段也坏(推不出)→ 口径未知,写定为本机原来的取值(本机旧盘不翻,不补记、不记 pkgCaliber)。旧版包的镜像段坏同此;
//                包里冻结值整值不可用(null / 解析不出 / 数组 / 对象里没有这一键)而校验和对得上、又推不出口径时同此(它会被整值写回)。
//   keepLocal —— 上面这几格「保留本机原来的取值」的键(预览 / 结果里冻结值那一行据此如实写)
//   opts.settingsComplete === false(导出时设置面没读全)的包缺冻结值 / 并入标志不算旧版包,也不清本机并入标志:漏读 ≠ 来源机是缺省,口径按未知处理
//   opts.untrustedKeys:校验和不符的原始键(恢复时不写回)——冻结值 / 镜像键落在里面时这个键的口径按未知处理(不拿坏段的值补导入的盘)
//   (refreeze 保留为空数组:旧调用方读它不出错)
export function planNewChartSeedsRestore(rawPkg, opts){
	const raw = rawPkg && typeof rawPkg === 'object' ? rawPkg : {};
	const has = (o, k)=>Object.prototype.hasOwnProperty.call(o, k);
	const plan = { clearFlag: false, refreeze: [], backfill: {}, freeze: {}, pkgCaliber: {}, keepLocal: {} };
	if(!Object.keys(raw).length){ return plan; }
	const untrusted = new Set((opts && Array.isArray(opts.untrustedKeys)) ? opts.untrustedKeys.map((k)=>`${k}`) : []);
	// 校验和不符的镜像键 / 全局设置不写回,也不算「包里有旧版同义存储」
	let hasLegacy = Object.keys(LEGACY_SEED_MIRRORS).some((k)=>has(raw, LEGACY_SEED_MIRRORS[k].key) && !untrusted.has(LEGACY_SEED_MIRRORS[k].key));
	if(!hasLegacy && has(raw, GLOBAL_SETUP_KEY) && !untrusted.has(GLOBAL_SETUP_KEY)){
		try{
			const gs = JSON.parse(`${raw[GLOBAL_SETUP_KEY]}`);
			hasLegacy = !!(gs && typeof gs === 'object' && (gs.pdMethod !== undefined || gs.pdTimeKey !== undefined));
		}catch(e){ hasLegacy = false; }
	}
	const settingsIncomplete = !!(opts && opts.settingsComplete === false);
	plan.clearFlag = hasLegacy && !has(raw, NEW_CHART_SEEDS_LEGACY_FLAG) && !settingsIncomplete;
	let pkgFrozen = null;
	const frozenUntrusted = untrusted.has(NEW_CHART_SEEDS_RECORD_MISSING_KEY);
	if(has(raw, NEW_CHART_SEEDS_RECORD_MISSING_KEY) && !frozenUntrusted){
		try{ const o = JSON.parse(`${raw[NEW_CHART_SEEDS_RECORD_MISSING_KEY]}`); pkgFrozen = o && typeof o === 'object' && !Array.isArray(o) ? o : null; }catch(e){ pkgFrozen = null; }
	}
	// 冻结值那一段校验和不符:包里有这个键(不是旧版包),值不可信 → 口径未知。解析不出的冻结值:没有并入标志、且设置面没标不全时
	// 照旧按旧版包推;有标志(新版包恒带)或设置面标了不全时口径未知,冻结值整值写回之后写定为本机原来(写回前)的取值(见下 !known 分支)
	const legacyPkg = !pkgFrozen && !frozenUntrusted && !has(raw, NEW_CHART_SEEDS_LEGACY_FLAG) && !settingsIncomplete;
	const checked = (spec, v)=>{ try{ return v !== null && v !== undefined && !!spec.check(v); }catch(e){ return false; } };
	// 旧版包的推法:包里有旧版镜像键按它解析,没有 = 来源机从没改过 = 内建缺省
	const legacyValue = (k, spec)=>{
		const m = LEGACY_SEED_MIRRORS[k];
		if(m && has(raw, m.key) && raw[m.key] !== null && raw[m.key] !== undefined && raw[m.key] !== ''){
			const v = m.parse(raw[m.key]);
			if(checked(spec, v)){ return v; }
		}
		return spec.def;
	};
	NEW_CHART_SEED_KEYS.forEach((k)=>{
		const spec = NEW_CHART_SEED_SPEC[k];
		if(!spec.recordMissingFallback){ return; }
		const localV = peekNewChartSeedRecordMissingValue(k);
		let pkgV0;
		let known = false;
		if(pkgFrozen && has(pkgFrozen, k)){
			if(checked(spec, pkgFrozen[k])){
				pkgV0 = pkgFrozen[k];
			}else{
				const mFrozen = LEGACY_SEED_MIRRORS[k];
				// 冻结值坏、镜像键那一段也坏:推不出包的口径 —— 显式保住本机口径(坏的冻结值照样写回,不盖掉则下次读按种子现值重冻,本机缺键旧盘翻转)
				if(mFrozen && untrusted.has(mFrozen.key)){ plan.freeze[k] = localV; plan.keepLocal[k] = true; return; }
				pkgV0 = legacyValue(k, spec);
				plan.freeze[k] = pkgV0;   // 坏的冻结值不写回:按包的口径写定,冻结值与补记值同源
			}
			known = true;
		}else if(legacyPkg){
			const m = LEGACY_SEED_MIRRORS[k];
			// 镜像键那一段坏了:旧版包的口径推不出来 —— 显式保住本机口径(旧版包没有冻结值,恢复时本机冻结值被复位,不写定则按种子现值重冻)
			if(m && untrusted.has(m.key)){ plan.freeze[k] = localV; plan.keepLocal[k] = true; return; }
			pkgV0 = legacyValue(k, spec);
			plan.freeze[k] = pkgV0;   // 恒写定(恢复时冻结值可能被复位,不写则下次读按种子现值重冻)
			known = true;
		}
		if(!known){
			// 口径未知(包里没有这一键 / 冻结值整值不可用或校验和不符 / 设置面没读全)—— 一律写定本机原来的取值(不补记、不记 pkgCaliber):
			// 恢复时本机冻结值可能被整值写回或按「来源为默认」复位,不写定则下次读按种子现值重冻,本机缺键旧盘翻转。
			// 与兄弟格(冻结值坏且镜像也坏 / 旧版包镜像坏)同一条规则;设置面不完整时写回本机原值是幂等的。
			// 此前只在「包里有冻结值键且可信」时写定:设置面完整、带并入标志却没有冻结值的包把本机冻结值复位,旧盘翻转
			plan.freeze[k] = localV;
			plan.keepLocal[k] = true;
			return;
		}
		plan.pkgCaliber[k] = pkgV0;
		// 冻结值会因恢复而变:本机缺这个键的命盘先补成本机原来的取值
		if(!same(pkgV0, localV)){ plan.backfill[k] = localV; }
	});
	return plan;
}

// 恢复写完设置之后执行计划的后半(清并入标志 / 删要重冻的冻结值;下次读种子即按恢复回来的旧仓重新并入)。
// 返回 { freezeFailed: [键], freezeKeptLegal: [键] }:写定后回读对不上的键(配额写不进)—— 结果里冻结值那一行据此写失败,不写「已保留 / 已写定」;
// 其中现存冻结值仍合法的(整值写回也没写进,还是本机原来的取值)另列,失败文案据此说清旧盘按什么显示
export function applyNewChartSeedsRestorePlan(plan){
	const out = { freezeFailed: [], freezeKeptLegal: [] };
	if(!plan){ return out; }
	try{
		if(plan.clearFlag){ safeLocalStorageRemove(NEW_CHART_SEEDS_LEGACY_FLAG); }
		if(plan.refreeze && plan.refreeze.length){
			const o = readRecordMissingFrozen();
			plan.refreeze.forEach((k)=>{ delete o[k]; });
			if(Object.keys(o).length){ safeJsonStringifyToStorage(NEW_CHART_SEEDS_RECORD_MISSING_KEY, o); }
			else{ safeLocalStorageRemove(NEW_CHART_SEEDS_RECORD_MISSING_KEY); }
		}
	}catch(e){ /* 存储失败:照旧,不影响恢复本身 */ }
	if(plan.freeze && typeof plan.freeze === 'object'){
		Object.keys(plan.freeze).forEach((k)=>{
			try{ freezeRecordMissing(k, plan.freeze[k], true); }catch(e){ /* 按回读判 */ }
			let now = {};
			try{ now = readRecordMissingFrozen(); }catch(e){ now = {}; }
			if(!Object.prototype.hasOwnProperty.call(now, k) || JSON.stringify(now[k]) !== JSON.stringify(plan.freeze[k])){
				out.freezeFailed.push(k);
				const spec = NEW_CHART_SEED_SPEC[k];
				let legal = false;
				try{ legal = Object.prototype.hasOwnProperty.call(now, k) && now[k] !== null && now[k] !== undefined && !!(spec && spec.check(now[k])); }catch(e){ legal = false; }
				if(legal){ out.freezeKeptLegal.push(k); }
			}
		});
	}
	return out;
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
			// 记录缺键时的取值(一般 = 内建默认;个别旧版按偏好判非默认的键 = 并入时冻结的旧版偏好,见 newChartSeedRecordMissingValue)
			const target = newChartSeedRecordMissingValue(k);
			if(!same(out[k] && out[k].value, target)){ out[k] = { ...out[k], value: target }; }
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

// 写共用字段的口子(主页 changeCond / 合盘子盘 onChange)统一调用:把这次真写进去的种子键记一笔。
// fromAgent(AI 助手改当前盘口径 / 撤销)与 programmatic(程序回写)不记 —— 新盘缺省只认用户亲手改。
export function recordSeedsForFieldWrite(prevFields, nextFields, values){
	const v = values || {};
	if(v.fromAgent || v.programmatic){ return []; }
	const patch = {};
	NEW_CHART_SEED_KEYS.forEach((k)=>{
		const nx = nextFields && nextFields[k];
		const pv = prevFields && prevFields[k];
		if(nx && nx !== pv && nx.value !== undefined){ patch[k] = nx.value; }
	});
	return Object.keys(patch).length ? recordNewChartSeeds(patch) : [];
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
	safeLocalStorageRemove(NEW_CHART_SEEDS_STORAGE_KEY); safeLocalStorageRemove(NEW_CHART_SEEDS_LEGACY_FLAG); safeLocalStorageRemove(NEW_CHART_SEEDS_RECORD_MISSING_KEY);
}
