// 命盘 record → astro.fields 载入还原清单（单一真值源）。
//
// 背景：buildLocalChartRecord(localcharts.js) 保存的排盘选项键，多年来「保存面/参数面(fieldsToParams)
// 加了、载入面(fetchByChartData) 漏了」逐键漂移 → 载入命例后 hsys/zodiacal/termsVariant/guolao*/india*/
// gender 等静默沿用上一张盘的值（透传断链）。本清单被 fetchByChartData 迭代消费，同时被制度化哨兵
// (recordFieldsRestore.test.js) 直接 import 做集合运算：
//   保存键 ∩ fieldsToParams 消费键 ⊆ 本清单 ∪ 手工还原核心键 —— 未来新增「保存+消费」键漏登记即红。
// 新增可还原键 = 此处加一行（parse 与保存侧强转一致）。
//
// 显式不入清单（哨兵按豁免表核对）：
// - AI-builder 直读 record.* 的键（紫微传本族/八字 school/pdDirect 等页面自有 options 直读键）——
//   不在 astro.fields 消费面，走 buildFieldObject/挂载链，已有 aiExportRoundtrip 哨兵。
// - 元数据信封（isPub/creator/updateTime/payload/sourceModule/chartType）。
// - 手工还原核心（cid/birth→date/time/ad/zone/lat/lon/name/pos + memo×8）：无条件覆盖语义，留在 saga。
// 另注：guolaoZiqiMode 在 fields schema 但功能冻结（恒 'real'，不下发不保存）。
// ad(公元前=-1)自全年份域工程起显式保存并在此还原:旧记录无 ad 键→跳过(零回归),
// 新记录与 birth 串前导负号一致(幂等双保险)。

// parse: 'int'|'num'|'str'|'raw'|'object' —— 与 buildLocalChartRecord 保存侧强转一一对应。
export const RECORD_FIELDS_RESTORE_MANIFEST = [
	// ── 既有手写条件块迁入（行为等价）─────────────────────────────
	{ key: 'ad', parse: 'int' },
	{ key: 'gender', parse: 'int' },
	{ key: 'group', parse: 'raw' },
	{ key: 'after23NewDay', parse: 'int' },
	{ key: 'lateZiHourUseNextDay', parse: 'int' },
	{ key: 'timeAlg', parse: 'int' },
	{ key: 'orbs', parse: 'object' },
	{ key: 'orbScale', parse: 'raw' },
	// ── 占星核心排盘选项（fields schema + fieldsToParams 消费）──────
	{ key: 'hsys', parse: 'raw' },
	{ key: 'zodiacal', parse: 'int' },
	{ key: 'siderealAyanamsa', parse: 'str' },
	{ key: 'tradition', parse: 'int' },
	{ key: 'termsVariant', parse: 'int' },        // schema 无此键 → 还原时新建 entry
	{ key: 'customTermsDay' },                     // [F14] termsVariant=4 的随盘表体(昼);对象值原样
	{ key: 'customTermsNight' },                   // [F14] 夜表(可缺=同昼)
	{ key: 'geminiBoundEmended', parse: 'int' },  // 双子界序(仅经典传本受影响);schema 无此键 → 还原时新建 entry
	// 2026-07 二批九键(落宫前移/太阳三态/空亡口径/恒星轨/映点容许度)。
	{ key: 'houseCuspAdvance', parse: 'int' },
	{ key: 'cazimiOrb', parse: 'num' },
	{ key: 'combustOrb', parse: 'num' },
	{ key: 'underBeamsOrb', parse: 'num' },
	{ key: 'vocMode', parse: 'str' },
	{ key: 'vocIncludeOuter', parse: 'int' },
	{ key: 'fixedStarOrb', parse: 'num' },
	{ key: 'fixedStarOrbMode', parse: 'str' },
	{ key: 'antisciaOrb', parse: 'num' },
	// 2026-07 四批:燃烧之路边界档(与 localcharts 落库键成对;partileDef 纯前端不随盘)。
	{ key: 'viaCombustaVariant', parse: 'str' },
	// [WP-2] 天文口径批(eclipseTimeMode 为纯全局显示口径不随盘)
	{ key: 'combustOwnChariotExempt', parse: 'int' },
	{ key: 'westLilithType', parse: 'str' },
	{ key: 'topocentricMoon', parse: 'int' },
	{ key: 'stationMarking', parse: 'str' },
	// [WP-3] 希腊点变体批
	{ key: 'hermeticLotsReversal', parse: 'int' },
	{ key: 'erosConstruction', parse: 'str' },
	{ key: 'lotFortuneVariant', parse: 'str' },
	{ key: 'lotFatherCombustAlt', parse: 'int' },
	{ key: 'lotProjection', parse: 'str' },
	// [WP-4] 尊贵与判定批(后端三键;peregrine/domicileMaster/dynamical/busyPlaces 纯全局不随盘)
	{ key: 'dignityDebilities', parse: 'int' },
	{ key: 'almutenTripMode', parse: 'str' },
	{ key: 'planetaryHourMethod', parse: 'str' },
	// [WP-5a] 容许度体系批(后端两键;transitOrb/只显入相/离相上限 纯前端不随盘)
	{ key: 'orbSystem', parse: 'str' },
	{ key: 'luminaryOrbBonus', parse: 'int' },
	// [WP-5b] 相位对象扩展三开关
	{ key: 'aspectIncludeCusps', parse: 'int' },
	{ key: 'aspectIncludeLots', parse: 'int' },
	{ key: 'aspectIncludeMidpoints', parse: 'int' },
	// [WP-6] 返照专项两键
	{ key: 'solarReturnVariant', parse: 'str' },
	{ key: 'returnLatitudeMode', parse: 'str' },
	// [WP-7] 自定义恒星黄道历元参数(仅 siderealAyanamsa='user' 时有值)
	{ key: 'userAyanT0', parse: 'num' },           // 自定义恒星黄道历元 JD('user' 档随盘;capture 特例 [R2-9] 兜底捕当前槽)
	{ key: 'userAyanDeg', parse: 'num' },          // 历元 ayanamsa 度值(同上)
	// [WP-8] 灵学扩展(rayWeighting 纯全局不随盘)
	{ key: 'vulcanCalc', parse: 'str' },
	{ key: 'doubingSu28', parse: 'num' },
	{ key: 'houseStartMode', parse: 'num' },       // 宿占人事十二宫起宫(ASC/八字):存盘后须还原,否则载入回退默认
	{ key: 'southchart', parse: 'int' },
	{ key: 'strongRecption', parse: 'int' },
	{ key: 'simpleAsp', parse: 'int' },
	{ key: 'virtualPointReceiveAsp', parse: 'int' },
	{ key: 'westNodeType', parse: 'str' },
	{ key: 'sectBuffer', parse: 'str' },
	{ key: 'leoBoundFirst', parse: 'int' },
	{ key: 'triplicity', parse: 'str' },
	{ key: 'lotReversal', parse: 'int' },
	// 希腊补齐三开关:与 localcharts 落库键成对(存了不还原=载入后盘变样)
	{ key: 'lotsDocReverse', parse: 'int' },
	{ key: 'nodeExaltation', parse: 'int' },
	{ key: 'gpsLat', parse: 'raw' },
	{ key: 'gpsLon', parse: 'raw' },
	// ── 主限法视图键（schema + fieldsToParams）───────────────────
	{ key: 'pdMethod', parse: 'raw' },
	{ key: 'pdTimeKey', parse: 'raw' },
	{ key: 'pdtype', parse: 'int' },
	// P0 解耦补齐九键(与 localcharts 落库键成对):
	{ key: 'pdProjection', parse: 'raw' },
	{ key: 'pdFrame', parse: 'raw' },
	{ key: 'pdFramework', parse: 'raw' },
	{ key: 'pdParallel', parse: 'int' },
	{ key: 'pdRaptParallel', parse: 'int' },
	{ key: 'pdTimeKeyCustom', parse: 'raw' },
	{ key: 'pdSignificators', parse: 'raw' },
	{ key: 'pdPromissorTypes', parse: 'raw' },
	// ── 埃及流派七轴(egypt_*):快照链 egyptSchoolFromFields 消费,页面不受钳制 ──
	{ key: 'egypt_decanRuler', parse: 'raw' },
	{ key: 'egypt_decanAnchor', parse: 'raw' },
	{ key: 'egypt_decanNaming', parse: 'raw' },
	{ key: 'egypt_starClock', parse: 'raw' },
	{ key: 'egypt_calendarAnchor', parse: 'raw' },
	{ key: 'egypt_petosirisMod', parse: 'int' },
	{ key: 'egypt_godEdition', parse: 'raw' },
	// ── 八字 UI 键（CnTraditionInput 从 fields 消费）───────────────
	{ key: 'phaseType', parse: 'int' },
	{ key: 'godKeyPos', parse: 'raw' },
	{ key: 'adjustJieqi', parse: 'int' },
	// ── 七政四余起盘设置（GuoLaoChartMain guolaoFieldValue/fieldsToParams）─
	{ key: 'guolaoLifeMode', parse: 'raw' },
	{ key: 'guolaoBodyMode', parse: 'raw' },
	{ key: 'guolaoNodeMode', parse: 'raw' },
	{ key: 'guolaoTrueSolarTime', parse: 'raw' },
	{ key: 'guolaoNodeType', parse: 'raw' },
	{ key: 'guolaoLilithType', parse: 'raw' },
	{ key: 'guolaoTuibianMethod', parse: 'raw' },
	{ key: 'guolaoEqTropicalAnchor', parse: 'raw' },
	{ key: 'guolaoAyanamsa', parse: 'str' },
	{ key: 'guolaoGufaPrecess', parse: 'int' },
	// ── 印占（IndiaChartMain 从 fields.* 读，缺键回退默认）─────────
	{ key: 'indiaHsys', parse: 'raw' },
	{ key: 'indiaAyanamsa', parse: 'str' },
	{ key: 'indiaNodeType', parse: 'str' },       // schema 无 → 新建 entry（下同）
	{ key: 'indiaDashaSystem', parse: 'str' },
	{ key: 'indiaSthiraStart', parse: 'str' },
	{ key: 'indiaDashaSeed', parse: 'raw' },
	{ key: 'indiaTransitDate', parse: 'raw' },
	{ key: 'indiaTajakaYear', parse: 'raw' },
	{ key: 'indiaVargaSet', parse: 'raw' },
	{ key: 'indiaDashaYearLength', parse: 'raw' },  // G5 年长(数值原样)
	{ key: 'indiaAnnualChartType', parse: 'str' },  // G13 年盘口径
	{ key: 'indiaSchool', parse: 'str' },           // 五支流派(语境层)
	{ key: 'indiaVargaVariant', parse: 'raw' },     // W1-A 分盘变体(JSON 串)
	{ key: 'indiaDashaVariants', parse: 'raw' },    // 大运流派开关(21 键 JSON 对象/串)
	{ key: 'indiaVarshaLat', parse: 'raw' },        // 年盘地点(居住地)覆盖
	{ key: 'indiaVarshaLon', parse: 'raw' },
	{ key: 'indiaKarakaScheme', parse: 'str' },     // W1-B 卡拉卡方案
	{ key: 'indiaYuddhaCriterion', parse: 'str' },  // W1-C 星曜战判据
];

function parseValue(parse, raw){
	if(parse === 'int'){
		const n = parseInt(`${raw}`, 10);
		return Number.isNaN(n) ? undefined : n;
	}
	if(parse === 'num'){
		const n = Number(raw);
		return Number.isNaN(n) ? undefined : n;
	}
	if(parse === 'str'){
		return `${raw}`;
	}
	if(parse === 'object'){
		return raw && typeof raw === 'object' ? raw : undefined;
	}
	return raw; // raw：原样（保存侧亦原样，避免破坏非字符串类型如 vargaSet 数组）
}

// 把 record 里存在的清单键条件还原进 fields —— 纯函数、不可变：
// - 返回新 fields 对象；命中键写入「新 entry」{...旧entry, value}（schema 缺键则新建 {name:[key], value}），
//   使下游 prevProps/值比对能看见变化（旧实现就地改共享 entry → prev 与 next 同对象，比对失明）。
// - record 缺键/null/解析失败(NaN) 一律跳过 → legacy 记录零冲击（保持当前 fields 现值）。
// - 绝不改 baseFields 及其 entry；未命中键保持 entry 同一性。
export function applyRecordToFields(baseFields, record){
	const fields = { ...(baseFields || {}) };
	if(!record || typeof record !== 'object'){
		return fields;
	}
	RECORD_FIELDS_RESTORE_MANIFEST.forEach(({ key, parse })=>{
		const raw = record[key];
		if(raw === undefined || raw === null){
			return;
		}
		const value = parseValue(parse, raw);
		if(value === undefined){
			return;
		}
		fields[key] = { ...(fields[key] || { name: [key] }), value };
	});
	return fields;
}

// ── [R4 随盘保真·非默认捕获] ────────────────────────────────────────────────
// 「存为命盘」此前只存表单信封 ~31 基础键,技法排盘设置(宫制/黄道/界系/主限/七政/印占等
// 住在 astro.fields 的键)不随盘 → 载入后跟全局当前值走,同一命例重开会随全局漂移。
// 埃及历「非默认才落键」范式推广(用户拍板):保存命盘时凡当前 fields ≠ schema 默认即随盘捕获。
// - 捕获面 = RECORD_FIELDS_RESTORE_MANIFEST 键集(保存捕获↔载入还原对称闭合,同居本文件防漂移;
//   manifest 外键不捕获 —— 捕了也没人还原);
// - 基准 = models/astro newEmptyFields 的 schema 初值,经工厂注册注入(astro 已 import 本文件,
//   反向 import 即循环,故用注册);schema 无此键(termsVariant 族)= fields 出现即非默认;
// - 全默认零落键(旧记录体积语义零变);对象值(orbs)按 JSON 串比对;
// - 调用方(models/user addChart)对 param 已有键不覆写 —— 表单信封值优先。
let fieldsBaselineFactory = null;

export function registerFieldsBaselineFactory(fn){
	fieldsBaselineFactory = typeof fn === 'function' ? fn : null;
}

export function captureNonDefaultTechniqueFields(fields){
	if(!fields || typeof fields !== 'object'){
		return {};
	}
	let baseline = {};
	try{
		baseline = fieldsBaselineFactory ? (fieldsBaselineFactory() || {}) : {};
	}catch(e){
		baseline = {};
	}
	const out = {};
	RECORD_FIELDS_RESTORE_MANIFEST.forEach(({ key })=>{
		const entry = fields[key];
		if(!entry || entry.value === undefined || entry.value === null){
			return;
		}
		const v = entry.value;
		const defEntry = baseline[key];
		const def = defEntry ? defEntry.value : undefined;
		const same = (v !== null && typeof v === 'object') || (def !== null && typeof def === 'object')
			? JSON.stringify(v) === JSON.stringify(def)
			: v === def;
		if(!same){
			out[key] = v;
		}
	});
	// [F14] 自定义界表随盘:termsVariant=4 且 fields 未带表体 → 从编辑器仓捕当前合法表
	// (否则表体只活在本机 localStorage,换机/清仓后旧盘静默变埃及)。
	try{
		// [R2-9] 自定义恒星黄道随盘:user 档且 fields 未带历元 → 捕当前槽两参
		// (否则历元只活在本机槽位,换机/换槽后同一记录静默按彼时彼机的槽或回落 Lahiri)。
		const ayanEntry = fields.siderealAyanamsa;
		if(ayanEntry && `${ayanEntry.value}` === 'user' && out.userAyanT0 === undefined){
			const { userAyanParamsFrom } = require('./customCalibreStores');
			const ap = userAyanParamsFrom((k) => (fields[k] ? fields[k].value : undefined)) || {};
			if(Number.isFinite(ap.userAyanT0) && Number.isFinite(ap.userAyanDeg)){
				out.userAyanT0 = ap.userAyanT0;
				out.userAyanDeg = ap.userAyanDeg;
			}
		}
		const tvEntry = fields.termsVariant;
		if(tvEntry && Number(tvEntry.value) === 4 && out.customTermsDay === undefined){
			const { loadCustomTerms, validateTermsTable } = require('./customCalibreStores');
			const tbl = loadCustomTerms();
			if(tbl && tbl.day && validateTermsTable(tbl.day) === true){
				out.customTermsDay = tbl.day;
				if(tbl.night && validateTermsTable(tbl.night) === true){ out.customTermsNight = tbl.night; }
			}
		}
	}catch(e){ /* 捕获失败不阻断存盘 */ }
	return out;
}

export default { RECORD_FIELDS_RESTORE_MANIFEST, applyRecordToFields };
