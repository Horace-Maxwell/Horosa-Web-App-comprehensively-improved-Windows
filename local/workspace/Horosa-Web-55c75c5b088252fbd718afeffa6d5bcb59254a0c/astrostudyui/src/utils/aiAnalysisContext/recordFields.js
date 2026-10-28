// AI 分析挂载上下文 · 命盘 / 事盘记录 → 起盘字段与参数:出生串解析、主限年数、古典回落、记录转字段与起盘参数、快照元数据、事盘字段与参数、生成快照落存、kinastro 族齿轮透传(非空键 / 日界 / 性别)。
// 由 utils/aiAnalysisContext.js 门面统一对外导出。
import DateTime from '../../components/comp/DateTime';
import { parseCaseDivTimeParts } from '../caseDivTime';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../dayBoundary';
import { chartDayBoundary } from '../dayBoundaryResolve';
import { recordMissingOr } from '../recordFieldsRestore';
import { recordPlaceGroupOrDefault } from '../kentangCaseSave';
import { newChartSeedRecordMissingValue } from '../newChartSeeds';
import { classicalGlobalValue, classicalBackendOverridesFromFields, CLASSICAL_GLOBAL_DEFAULTS } from '../classicalChartGlobals';
// 埃及历七轴随盘键(egypt_*):挂载/存盘 record → fields 透传,astroAiSnapshot.egyptSchoolFromFields 优先消费。
import { EGYPT_RECORD_KEYS } from '../../divination/data/egyptianSchools';
// 「列挂载源」及其纯函数助手抽至轻模块 aiAnalysisSources —— 个别页面只需
// 列源,曾因 import 本文件连带整座 AI 核(~50 技法构建器)进自己的 chunk(46/47 回灌案)。
// 此处 import 供本文件其余函数继续使用,listAnalysisSources 在文件尾 re-export 保旧路径兼容。
import { normalizeTags } from '../aiAnalysisSources';
import { saveModuleAISnapshot } from '../moduleAiSnapshot';
import { GUOLAO_RECORD_FACTORY_DEFAULTS } from '../../components/guolao/GuoLaoChartStyle';   // 覆盖作用域
import { DEFAULT_PD_ASPECTS } from './catalog';
import { normalizeTechniqueKey } from './techniqueKey';
import { buildSourceSignature } from './snapshotMatch';

function parseBirthString(text, zone = '+08:00'){
	const raw = `${text || ''}`.trim();
	const matched = raw.match(/^(-?\d+)-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
	if(!matched){
		return new DateTime({ zone });
	}
	const yearVal = parseInt(matched[1], 10);
	return new DateTime({
		ad: yearVal < 0 ? -1 : 1,
		year: Math.abs(yearVal),
		month: parseInt(matched[2], 10),
		date: parseInt(matched[3], 10),
		hour: parseInt(matched[4] || '0', 10),
		minute: parseInt(matched[5] || '0', 10),
		second: parseInt(matched[6] || '0', 10),
		zone: zone || '+08:00',
	});
}

// (normalizeTags 已迁 aiAnalysisSources.js —— 顶部 import)

// 主限推算年数兜底:与 AstroPrimaryDirection.normalizePdYears 同口径(取整、夹 1–3000、坏值回退 100)。
function normalizePdYearsValue(value){
	if(value === undefined || value === null || value === ''){
		return 100;
	}
	const n = Math.round(Number(value));
	if(!Number.isFinite(n)){
		return 100;
	}
	return Math.max(1, Math.min(3000, n));
}

// 古典口径键缺席时的取值 —— 与页面载入同一口径(recordFieldsRestore):带随盘代次标记的盘(存盘时「值 == 出厂不落键」)
// 缺键 = 出厂默认;早先没打标记的旧盘缺键 = 当前全局(页面沿用当前值)。此前一律取全局现值(界系 / 双子界序一律取 0),
// 全局改过的用户,同一张盘页面与 AI 按两套口径。
export function recordClassicalFallback(record, key){
	// 缺键取值单源 recordMissingValue(页面载入 / 齿轮基线同一份):带标记 = spec 默认;旧盘 = 当前全局
	return recordMissingOr(record, key, ()=>classicalGlobalValue(key));
}

// 记录 → 技法页用的完整字段对象(与 AI 挂载 / 无头重算同一构造;盘面截图挂载等不经载入流程的渲染方用它)
export function buildRecordFieldObject(record){
	return buildFieldObject(record || {});
}

// 七政起盘键缺席:带随盘代次标记 = 存盘时是出厂值(与页面载入同);旧记录 undefined → 构造器回落本机七政仓(照旧)
function guolaoRecordMissing(record, key){
	return recordMissingOr(record, key, undefined);
}

// 其余清单键缺席(主限法解耦键 / 印占 / 八字 / 日界 / 宿占……):同一个单源。value 档 = 页面载入后的值;
// drop 档(页面撤出)= undefined 不下发;旧记录 = legacy(各键既有回落,不变)
const missing = (record, key, legacy)=>recordMissingOr(record, key, legacy, undefined);

export function buildFieldObject(record){
	// 起课时间合成的 timepoint record 用 divTime 不用 birth(参 AIAnalysisMain.js:1029),
	// 旧实现只读 record.birth → 撞 fallback `new DateTime({zone})` 用当前系统时间起盘,
	// 太玄/荆诀/五兆/神易数 等 backend 拿到时再格式化就出 NaN-undefined-undefined。
	// 兜底 birth ?? divTime,两者皆同口径 'YYYY-MM-DD HH:mm:ss' 即可被 parseBirthString 正确匹配。
	const birthText = record.birth || record.divTime || '';
	const birth = parseBirthString(birthText, record.zone);
	// 地点整组取(与载入事盘同一出口):坏档换默认坐标整组,不再按键各取各的拼出半组
	const place = recordPlaceGroupOrDefault(record);
	return {
		cid: { value: record.cid || null },
		ad: { value: birth.ad },
		date: { value: birth.clone().startOf('date') },
		time: { value: birth.clone() },
		zone: { value: record.zone || birth.zone || '+08:00' },
		lat: { value: place.lat },
		lon: { value: place.lon },
		gpsLat: { value: place.gpsLat !== undefined ? place.gpsLat : 0 },
		gpsLon: { value: place.gpsLon !== undefined ? place.gpsLon : 0 },
		name: { value: record.name || '' },
		pos: { value: place.pos || '' },
		// 🔴 缺省回退 1(Alcabitius)=技法页 DefaultHouseSystem 同源:R4「非默认才落键」
		// 存盘后大多数默认盘 record 无 hsys 键,此前回退 0(整宫制) ⇒ 同一记录有旧快照时按 1 复用、
		// 无快照 fresh 重算按 0 起盘 —— 挂载内容随快照槽状态换宫制,且与技法页(恒 1)分叉。
		hsys: { value: record.hsys !== undefined ? record.hsys : missing(record, 'hsys', 1) },
		zodiacal: { value: record.zodiacal !== undefined ? record.zodiacal : missing(record, 'zodiacal', 0) },
		// 恒星黄道盘挂载 AI 时,沿用该盘保存的 ayanāṃśa(缺省 ''=后端默认 Lahiri),
		// 使 AI 快照行星经度与盘面一致(全链路:储存→挂载→AI)。
		siderealAyanamsa: { value: record.siderealAyanamsa !== undefined ? record.siderealAyanamsa : missing(record, 'siderealAyanamsa', '') },
		// user 档历元参数随盘还原(record 有才建;缺=读全局当前槽由 fieldParams 兜)
		...(record.userAyanT0 !== undefined && record.userAyanT0 !== null ? { userAyanT0: { value: record.userAyanT0 } } : {}),
		...(record.userAyanDeg !== undefined && record.userAyanDeg !== null ? { userAyanDeg: { value: record.userAyanDeg } } : {}),
		// AI 挂载「每技法设置」可覆盖的占星排盘开关:优先读 record(挂载重算时 merge 进 record.*),
		// 缺省回退现状默认(0)→ 不调任何项时与现状逐字一致(守「默认即现状」)。
		tradition: { value: record.tradition !== undefined && record.tradition !== null ? record.tradition : missing(record, 'tradition', 0) },
		termsVariant: { value: record.termsVariant !== undefined && record.termsVariant !== null ? record.termsVariant : recordClassicalFallback(record, 'termsVariant') },
		// 随盘界表表体(termsVariant=4):record 有才建 entry → overrides getVal 直取随盘表,零膨胀
		...(Array.isArray(record.customTermsDay) ? { customTermsDay: { value: record.customTermsDay } } : {}),
		...(Array.isArray(record.customTermsNight) ? { customTermsNight: { value: record.customTermsNight } } : {}),
		// 占星(希腊化)G12/G13/G15/G20-P2:西占月交点真平 / 区分缓冲 / 狮子土星优先 / 三分集 / 福点反转。
		// 挂载重算优先读 record,缺省回退零回归默认(平/几何/木首/Dorothean/反转ON)→ 不调任何项与现状逐字一致;
		// 经 fieldsToParams 条件透传(默认不下发)→ /chart 复算 → AI 快照行星尊贵/界主/福点与盘面一致。
		westNodeType: { value: record.westNodeType !== undefined && record.westNodeType !== null ? record.westNodeType : recordClassicalFallback(record, 'westNodeType') },
		sectBuffer: { value: record.sectBuffer !== undefined && record.sectBuffer !== null ? record.sectBuffer : recordClassicalFallback(record, 'sectBuffer') },
		leoBoundFirst: { value: record.leoBoundFirst !== undefined && record.leoBoundFirst !== null ? record.leoBoundFirst : recordClassicalFallback(record, 'leoBoundFirst') },
		triplicity: { value: record.triplicity !== undefined && record.triplicity !== null ? record.triplicity : recordClassicalFallback(record, 'triplicity') },
		lotReversal: { value: record.lotReversal !== undefined && record.lotReversal !== null ? record.lotReversal : recordClassicalFallback(record, 'lotReversal') },
		// 希腊补齐三开关(点公式文档口径/交点旺/土星旺20°):与 localcharts 落库键+recordFieldsRestore
		// 还原键成对 ⇒ 挂载复算与所存盘逐字一致。三键升正仓后缺省改读全局现值
		// (与下方古典口径 10 键同理:record 缺键=「随全局」;全局=默认 0 时 helper 判等仍不下发=零回归)。
		lotsDocReverse: { value: record.lotsDocReverse !== undefined && record.lotsDocReverse !== null ? record.lotsDocReverse : recordClassicalFallback(record, 'lotsDocReverse') },
		nodeExaltation: { value: record.nodeExaltation !== undefined && record.nodeExaltation !== null ? record.nodeExaltation : recordClassicalFallback(record, 'nodeExaltation') },
		// 双子界序校勘(0/1):fieldParams 的条件透传早已在读它 —— 🔴 此处曾不产该字段,
		// 那行透传恒为永假分支(死透传),挂载改「双子界序」永不生效。
		geminiBoundEmended: { value: record.geminiBoundEmended !== undefined && record.geminiBoundEmended !== null ? record.geminiBoundEmended : recordClassicalFallback(record, 'geminiBoundEmended') },
		// 🔴 古典口径 10 键(空亡口径/焦伤·核心·日光束界值/宫头前移/恒星容许度·档/映点容许度/燃烧之路边界):
		// 曾整段断链 —— live 主盘 fieldsToParams 走 classicalBackendOverridesFromFields,而 AI 侧本函数
		// 不产字段 + fieldParams 不接 helper,挂载改这 10 项 UI 打 regenerated 绿标、正文逐字节不变。
		// 缺省读全局现值(页面种子=classicalGlobalValue,存盘「值==种子不落键」→
		// record 缺键=「随全局」;此前回退 undefined=内建,改过全局的用户挂载重算与页面分叉)。
		// 全局=默认时 helper 判等仍不下发 = 字节级零回归。
		houseCuspAdvance: { value: record.houseCuspAdvance !== undefined && record.houseCuspAdvance !== null ? record.houseCuspAdvance : recordClassicalFallback(record, 'houseCuspAdvance') },
		cazimiOrb: { value: record.cazimiOrb !== undefined && record.cazimiOrb !== null ? record.cazimiOrb : recordClassicalFallback(record, 'cazimiOrb') },
		combustOrb: { value: record.combustOrb !== undefined && record.combustOrb !== null ? record.combustOrb : recordClassicalFallback(record, 'combustOrb') },
		underBeamsOrb: { value: record.underBeamsOrb !== undefined && record.underBeamsOrb !== null ? record.underBeamsOrb : recordClassicalFallback(record, 'underBeamsOrb') },
		vocMode: { value: record.vocMode !== undefined && record.vocMode !== null ? record.vocMode : recordClassicalFallback(record, 'vocMode') },
		vocIncludeOuter: { value: record.vocIncludeOuter !== undefined && record.vocIncludeOuter !== null ? record.vocIncludeOuter : recordClassicalFallback(record, 'vocIncludeOuter') },
		fixedStarOrb: { value: record.fixedStarOrb !== undefined && record.fixedStarOrb !== null ? record.fixedStarOrb : recordClassicalFallback(record, 'fixedStarOrb') },
		fixedStarOrbMode: { value: record.fixedStarOrbMode !== undefined && record.fixedStarOrbMode !== null ? record.fixedStarOrbMode : recordClassicalFallback(record, 'fixedStarOrbMode') },
		antisciaOrb: { value: record.antisciaOrb !== undefined && record.antisciaOrb !== null ? record.antisciaOrb : recordClassicalFallback(record, 'antisciaOrb') },
		viaCombustaVariant: { value: record.viaCombustaVariant !== undefined && record.viaCombustaVariant !== null ? record.viaCombustaVariant : recordClassicalFallback(record, 'viaCombustaVariant') },
		// 天文口径批(record 缺键=随全局;全局=默认时 helper 判等不下发=零回归)
		combustOwnChariotExempt: { value: record.combustOwnChariotExempt !== undefined && record.combustOwnChariotExempt !== null ? record.combustOwnChariotExempt : recordClassicalFallback(record, 'combustOwnChariotExempt') },
		westLilithType: { value: record.westLilithType !== undefined && record.westLilithType !== null ? record.westLilithType : recordClassicalFallback(record, 'westLilithType') },
		topocentricMoon: { value: record.topocentricMoon !== undefined && record.topocentricMoon !== null ? record.topocentricMoon : recordClassicalFallback(record, 'topocentricMoon') },
		stationMarking: { value: record.stationMarking !== undefined && record.stationMarking !== null ? record.stationMarking : recordClassicalFallback(record, 'stationMarking') },
		// 希腊点变体批(record 缺键=随全局)
		hermeticLotsReversal: { value: record.hermeticLotsReversal !== undefined && record.hermeticLotsReversal !== null ? record.hermeticLotsReversal : recordClassicalFallback(record, 'hermeticLotsReversal') },
		erosConstruction: { value: record.erosConstruction !== undefined && record.erosConstruction !== null ? record.erosConstruction : recordClassicalFallback(record, 'erosConstruction') },
		lotFortuneVariant: { value: record.lotFortuneVariant !== undefined && record.lotFortuneVariant !== null ? record.lotFortuneVariant : recordClassicalFallback(record, 'lotFortuneVariant') },
		lotFatherCombustAlt: { value: record.lotFatherCombustAlt !== undefined && record.lotFatherCombustAlt !== null ? record.lotFatherCombustAlt : recordClassicalFallback(record, 'lotFatherCombustAlt') },
		lotProjection: { value: record.lotProjection !== undefined && record.lotProjection !== null ? record.lotProjection : recordClassicalFallback(record, 'lotProjection') },
		// 尊贵与判定批后端三键
		dignityDebilities: { value: record.dignityDebilities !== undefined && record.dignityDebilities !== null ? record.dignityDebilities : recordClassicalFallback(record, 'dignityDebilities') },
		almutenTripMode: { value: record.almutenTripMode !== undefined && record.almutenTripMode !== null ? record.almutenTripMode : recordClassicalFallback(record, 'almutenTripMode') },
		planetaryHourMethod: { value: record.planetaryHourMethod !== undefined && record.planetaryHourMethod !== null ? record.planetaryHourMethod : recordClassicalFallback(record, 'planetaryHourMethod') },
		orbSystem: { value: record.orbSystem !== undefined && record.orbSystem !== null ? record.orbSystem : recordClassicalFallback(record, 'orbSystem') },
		luminaryOrbBonus: { value: record.luminaryOrbBonus !== undefined && record.luminaryOrbBonus !== null ? record.luminaryOrbBonus : recordClassicalFallback(record, 'luminaryOrbBonus') },
		aspectIncludeCusps: { value: record.aspectIncludeCusps !== undefined && record.aspectIncludeCusps !== null ? record.aspectIncludeCusps : recordClassicalFallback(record, 'aspectIncludeCusps') },
		aspectIncludeLots: { value: record.aspectIncludeLots !== undefined && record.aspectIncludeLots !== null ? record.aspectIncludeLots : recordClassicalFallback(record, 'aspectIncludeLots') },
		aspectIncludeMidpoints: { value: record.aspectIncludeMidpoints !== undefined && record.aspectIncludeMidpoints !== null ? record.aspectIncludeMidpoints : recordClassicalFallback(record, 'aspectIncludeMidpoints') },
		solarReturnVariant: { value: record.solarReturnVariant !== undefined && record.solarReturnVariant !== null ? record.solarReturnVariant : recordClassicalFallback(record, 'solarReturnVariant') },
		returnLatitudeMode: { value: record.returnLatitudeMode !== undefined && record.returnLatitudeMode !== null ? record.returnLatitudeMode : recordClassicalFallback(record, 'returnLatitudeMode') },
		vulcanCalc: { value: record.vulcanCalc !== undefined && record.vulcanCalc !== null ? record.vulcanCalc : recordClassicalFallback(record, 'vulcanCalc') },
		strongRecption: { value: record.strongRecption !== undefined && record.strongRecption !== null ? record.strongRecption : missing(record, 'strongRecption', 0) },
		simpleAsp: { value: record.simpleAsp !== undefined && record.simpleAsp !== null ? record.simpleAsp : missing(record, 'simpleAsp', 0) },
		virtualPointReceiveAsp: { value: record.virtualPointReceiveAsp !== undefined && record.virtualPointReceiveAsp !== null ? record.virtualPointReceiveAsp : missing(record, 'virtualPointReceiveAsp', 0) },
		doubingSu28: { value: record.doubingSu28 !== undefined && record.doubingSu28 !== null ? Number(record.doubingSu28) : missing(record, 'doubingSu28', 0) },
		// 宿占人事十二宫起宫:优先读 record(存盘/挂载重算);记录缺键 = 与页面载入同口径
		// (newChartSeedRecordMissingValue:旧记录按当时的偏好理解 —— 并入时冻结的旧版偏好,之后不随种子变;schema globalCurrent 同源)
		houseStartMode: { value: record.houseStartMode !== undefined && record.houseStartMode !== null ? Number(record.houseStartMode) : missing(record, 'houseStartMode', ()=>newChartSeedRecordMissingValue('houseStartMode')) },
		predictive: { value: 1 },
		showPdBounds: { value: 1 },
		pdtype: { value: (record.pdtype === undefined || record.pdtype === null ? missing(record, 'pdtype', 0) : record.pdtype) === 1 ? 1 : 0 },
		// P0 起 record 可能持久化用户实选 (placidus / 其它 timeKey)；优先读 record，
		// 不存在时回退到默认 Alcabitius+Ptolemy (守 v2.5.3 默认路径字节级一致)。
		pdMethod: { value: record.pdMethod || missing(record, 'pdMethod', 'core_alchabitius') || 'core_alchabitius' },
		pdTimeKey: { value: record.pdTimeKey || missing(record, 'pdTimeKey', 'Ptolemy') || 'Ptolemy' },
		// 主限法进阶开关(向运顺逆 / 映点 / 界):顺逆默认都开(用户偏好),映点/界默认关。
		pdDirect: { value: record.pdDirect === 0 ? 0 : 1 },
		pdConverse: { value: record.pdConverse === 0 ? 0 : 1 },
		pdAntiscia: { value: record.pdAntiscia ? 1 : 0 },
		pdTerms: { value: record.pdTerms ? 1 : 0 },
		// 主限推算年数:挂载「每技法设置」可经 record.pdYears 覆盖(默认 100、范围 1–3000,
		// 与 AstroPrimaryDirection.normalizePdYears / perchart.py 兜底一致;>360 走多圈复发行)。缺省→100=现状字节级一致。
		pdYears: { value: normalizePdYearsValue(record.pdYears) },
		// 🔴 主限法解耦八键(弧算法/盘面宫制/框架/平行/急动平行/自定义钥匙率/应星扩展/迫星扩展):
		// 曾在挂载链全死(cetian 同型)—— schema 有、本函数无 → mergeOptionsIntoRecord 写进 record 当场蒸发。
		// 缺省 undefined → fieldParams 条件透传全部跳过 = 默认路径字节零回归(golden540 恒绿)。
		pdProjection: { value: record.pdProjection !== undefined && record.pdProjection !== null ? record.pdProjection : missing(record, 'pdProjection', undefined) },
		pdFrame: { value: record.pdFrame !== undefined && record.pdFrame !== null ? record.pdFrame : missing(record, 'pdFrame', undefined) },
		pdFramework: { value: record.pdFramework !== undefined && record.pdFramework !== null ? record.pdFramework : missing(record, 'pdFramework', undefined) },
		pdParallel: { value: record.pdParallel !== undefined && record.pdParallel !== null ? record.pdParallel : missing(record, 'pdParallel', undefined) },
		pdRaptParallel: { value: record.pdRaptParallel !== undefined && record.pdRaptParallel !== null ? record.pdRaptParallel : missing(record, 'pdRaptParallel', undefined) },
		pdTimeKeyCustom: { value: record.pdTimeKeyCustom !== undefined && record.pdTimeKeyCustom !== null ? record.pdTimeKeyCustom : missing(record, 'pdTimeKeyCustom', undefined) },
		pdSignificators: { value: Array.isArray(record.pdSignificators) ? record.pdSignificators : (record.pdSignificators === undefined || record.pdSignificators === null ? missing(record, 'pdSignificators', undefined) : undefined) },
		pdPromissorTypes: { value: Array.isArray(record.pdPromissorTypes) ? record.pdPromissorTypes : (record.pdPromissorTypes === undefined || record.pdPromissorTypes === null ? missing(record, 'pdPromissorTypes', undefined) : undefined) },
		pdaspects: { value: DEFAULT_PD_ASPECTS.slice(0) },
		// 时间算法(0=真太阳时按经度校正 / 1=直接时间用钟表时)+ 晚子时口径须从存盘读取,
		// 否则 canping/heluo 等八字类快照会对「直接时间」盘错用真太阳时校正、忽略晚子时设置(口径与显示不一致)。
		timeAlg: { value: (record.timeAlg !== undefined && record.timeAlg !== null) ? record.timeAlg : missing(record, 'timeAlg', 0) },
		phaseType: { value: record.phaseType !== undefined && record.phaseType !== null ? record.phaseType : missing(record, 'phaseType', 0) },
		godKeyPos: { value: record.godKeyPos !== undefined && record.godKeyPos !== null ? record.godKeyPos : missing(record, 'godKeyPos', '年') },
		after23NewDay: { value: (record.after23NewDay !== undefined && record.after23NewDay !== null) ? record.after23NewDay : missing(record, 'after23NewDay', defaultAfter23NewDay) },
		lateZiHourUseNextDay: { value: (record.lateZiHourUseNextDay !== undefined && record.lateZiHourUseNextDay !== null) ? record.lateZiHourUseNextDay : missing(record, 'lateZiHourUseNextDay', defaultLateZiHourUseNextDay) },
		adjustJieqi: { value: record.adjustJieqi !== undefined && record.adjustJieqi !== null ? record.adjustJieqi : missing(record, 'adjustJieqi', 0) },
		gender: { value: record.gender !== undefined && record.gender !== null ? record.gender : 1 },
		southchart: { value: record.southchart !== undefined && record.southchart !== null ? record.southchart : missing(record, 'southchart', 0) },
		// 七政四余命度/身宫/罗计模式:挂载设置可经 record 携带(缺省 undefined → builder 回退全局 localStorage 默认,即现状)。
		guolaoLifeMode: { value: record.guolaoLifeMode !== undefined && record.guolaoLifeMode !== null ? record.guolaoLifeMode : guolaoRecordMissing(record, 'guolaoLifeMode') },
		guolaoBodyMode: { value: record.guolaoBodyMode !== undefined && record.guolaoBodyMode !== null ? record.guolaoBodyMode : guolaoRecordMissing(record, 'guolaoBodyMode') },
		// 七政四余 G6/G10/G11/G12/WP-D 起盘设置:GuoLaoChartMain 的 guolaoFieldValue/guolaoAyanamsaFromFields 据
		// fields.<key> 读回算盘(报时星太阳时/罗计真平/月孛真平/恒星黄道岁差/授时古法推变·古宿岁差·赤道锚点)。
		// 优先读存盘 record(buildLocalChartRecord 已落库);缺省 undefined → guolaoFieldValue 回退全局 localStorage 默认
		// (=现状零回归,与 guolaoLifeMode/Body/Node 同口径)。仅当存盘携带该值时,AI 挂载快照与保存时盘面一致。
		guolaoTrueSolarTime: { value: record.guolaoTrueSolarTime !== undefined && record.guolaoTrueSolarTime !== null ? record.guolaoTrueSolarTime : guolaoRecordMissing(record, 'guolaoTrueSolarTime') },
		guolaoNodeType: { value: record.guolaoNodeType !== undefined && record.guolaoNodeType !== null ? record.guolaoNodeType : guolaoRecordMissing(record, 'guolaoNodeType') },
		guolaoLilithType: { value: record.guolaoLilithType !== undefined && record.guolaoLilithType !== null ? record.guolaoLilithType : guolaoRecordMissing(record, 'guolaoLilithType') },
		guolaoAyanamsa: { value: record.guolaoAyanamsa !== undefined && record.guolaoAyanamsa !== null ? record.guolaoAyanamsa : guolaoRecordMissing(record, 'guolaoAyanamsa') },
		guolaoTuibianMethod: { value: record.guolaoTuibianMethod !== undefined && record.guolaoTuibianMethod !== null ? record.guolaoTuibianMethod : guolaoRecordMissing(record, 'guolaoTuibianMethod') },
		guolaoGufaPrecess: { value: record.guolaoGufaPrecess !== undefined && record.guolaoGufaPrecess !== null ? record.guolaoGufaPrecess : guolaoRecordMissing(record, 'guolaoGufaPrecess') },
		guolaoEqTropicalAnchor: { value: record.guolaoEqTropicalAnchor !== undefined && record.guolaoEqTropicalAnchor !== null ? record.guolaoEqTropicalAnchor : guolaoRecordMissing(record, 'guolaoEqTropicalAnchor') },
		// 命主取法/行运法/童限基数(horosaGuolaoDisplay JSON 罐,per-key storage 盖不住 → record 链):
		guolaoLifeMasterMode: { value: record.guolaoLifeMasterMode !== undefined && record.guolaoLifeMasterMode !== null ? record.guolaoLifeMasterMode : undefined },
		guolaoMinorLimitType: { value: record.guolaoMinorLimitType !== undefined && record.guolaoMinorLimitType !== null ? record.guolaoMinorLimitType : undefined },
		guolaoTongxianBase: { value: record.guolaoTongxianBase !== undefined && record.guolaoTongxianBase !== null ? record.guolaoTongxianBase : undefined },
		guolaoLimitChildBase: { value: record.guolaoLimitChildBase !== undefined && record.guolaoLimitChildBase !== null ? record.guolaoLimitChildBase : undefined },   // 定童限随记录走
		guolaoLimitYearBoundary: { value: record.guolaoLimitYearBoundary ? record.guolaoLimitYearBoundary : undefined },   // 大限年界随记录走(空 = 随七政显示偏好)
		// 印占：岁差制/分宫制/交点(挂载设置可调,缺省回退印占默认)。
		indiaHsys: { value: record.indiaHsys !== undefined && record.indiaHsys !== null ? record.indiaHsys : missing(record, 'indiaHsys', undefined) },
		indiaAyanamsa: { value: record.indiaAyanamsa !== undefined && record.indiaAyanamsa !== null ? record.indiaAyanamsa : missing(record, 'indiaAyanamsa', undefined) },
		indiaNodeType: { value: record.indiaNodeType !== undefined && record.indiaNodeType !== null ? record.indiaNodeType : missing(record, 'indiaNodeType', undefined) },
		indiaDashaSystem: { value: record.indiaDashaSystem !== undefined && record.indiaDashaSystem !== null ? record.indiaDashaSystem : missing(record, 'indiaDashaSystem', undefined) },
		// Sthira 起座(lagna/brahma):IndiaChart.fieldsToParams 读 fields.indiaSthiraStart→仅非默认 'lagna' 才下发 →
		// 默认 undefined→快照 Sthira 座运走 lagna(后端缺键即 lagna)=现状零回归;挂载/存盘携 brahma 则 AI 与盘一致。
		indiaSthiraStart: { value: record.indiaSthiraStart !== undefined && record.indiaSthiraStart !== null ? record.indiaSthiraStart : missing(record, 'indiaSthiraStart', undefined) },
		// 大运起点 seed / 过运日期 / 年度盘年份 / 分盘集:IndiaChart.fieldsToParams 经 pickOpt 读 fields.indiaDashaSeed/
		// indiaTransitDate/indiaTajakaYear/indiaVargaSet 下发后端。同源却漏透传 → 改这 4 项后挂载快照仍取默认盘、与界面不符。
		// 缺省 undefined → 后端缺键回退默认(seed=moon / 过运=今日 / 年度=当前年 / 分盘集=单盘)=现状零回归;携带则 AI 与盘一致。
		indiaDashaSeed: { value: record.indiaDashaSeed !== undefined && record.indiaDashaSeed !== null ? record.indiaDashaSeed : missing(record, 'indiaDashaSeed', undefined) },
		indiaTransitDate: { value: record.indiaTransitDate !== undefined && record.indiaTransitDate !== null ? record.indiaTransitDate : missing(record, 'indiaTransitDate', undefined) },
		indiaTajakaYear: { value: record.indiaTajakaYear !== undefined && record.indiaTajakaYear !== null ? record.indiaTajakaYear : missing(record, 'indiaTajakaYear', undefined) },
		indiaVargaSet: { value: record.indiaVargaSet !== undefined && record.indiaVargaSet !== null ? record.indiaVargaSet : missing(record, 'indiaVargaSet', undefined) },
		// 三旗盘/问事 Praśna(fieldsToParams 读 indiaTripataki/indiaPrashna*;此前无头恒不产 → 两段对挂载恒死)。
		// 缺省 undefined = 不下发(与页面未开三旗/未起卦时零 churn 契约同构)。schools 数组 → 页面同形逗号串。
		indiaTripataki: { value: (record.indiaTripataki === 1 || record.indiaTripataki === '1' || record.indiaTripataki === true) ? 1 : undefined },
		indiaPrashnaTime: { value: record.indiaPrashnaTime ? `${record.indiaPrashnaTime}` : undefined },
		indiaPrashnaNumber: { value: record.indiaPrashnaNumber !== undefined && record.indiaPrashnaNumber !== null && record.indiaPrashnaNumber !== '' ? record.indiaPrashnaNumber : undefined },
		indiaPrashnaMatter: { value: record.indiaPrashnaMatter ? record.indiaPrashnaMatter : undefined },
		indiaPrashnaSchools: { value: Array.isArray(record.indiaPrashnaSchools) ? (record.indiaPrashnaSchools.length ? record.indiaPrashnaSchools.join(',') : undefined) : (record.indiaPrashnaSchools ? `${record.indiaPrashnaSchools}` : undefined) },
		indiaPrashnaCuspMode: { value: record.indiaPrashnaCuspMode ? record.indiaPrashnaCuspMode : undefined },
		indiaPrashnaPrimaryHouse: { value: record.indiaPrashnaPrimaryHouse !== undefined && record.indiaPrashnaPrimaryHouse !== null && record.indiaPrashnaPrimaryHouse !== '' ? record.indiaPrashnaPrimaryHouse : undefined },
		// G5 年长 / G13 年盘口径:fieldsToParams 仅非默认才下发 → 缺省 undefined = 现状零回归;
		// 挂载/存盘携带则 AI 大运/年度快照与盘一致(漏透传 = AI 快照取默认盘,本模块已犯过)。
		indiaDashaYearLength: { value: record.indiaDashaYearLength !== undefined && record.indiaDashaYearLength !== null ? record.indiaDashaYearLength : missing(record, 'indiaDashaYearLength', undefined) },
		indiaAnnualChartType: { value: record.indiaAnnualChartType !== undefined && record.indiaAnnualChartType !== null ? record.indiaAnnualChartType : missing(record, 'indiaAnnualChartType', undefined) },
		indiaSchool: { value: record.indiaSchool !== undefined && record.indiaSchool !== null ? record.indiaSchool : missing(record, 'indiaSchool', undefined) },
		indiaVargaVariant: { value: record.indiaVargaVariant !== undefined && record.indiaVargaVariant !== null ? record.indiaVargaVariant : missing(record, 'indiaVargaVariant', undefined) },
		indiaKarakaScheme: { value: record.indiaKarakaScheme !== undefined && record.indiaKarakaScheme !== null ? record.indiaKarakaScheme : missing(record, 'indiaKarakaScheme', undefined) },
		indiaYuddhaCriterion: { value: record.indiaYuddhaCriterion !== undefined && record.indiaYuddhaCriterion !== null ? record.indiaYuddhaCriterion : missing(record, 'indiaYuddhaCriterion', undefined) },
		// 大运流派开关(21 键 JSON 对象)+年盘地点:漏透传 = AI 挂载复算按默认口径(账实不符)。
		indiaDashaVariants: { value: record.indiaDashaVariants !== undefined && record.indiaDashaVariants !== null ? record.indiaDashaVariants : missing(record, 'indiaDashaVariants', undefined) },
		indiaVarshaLat: { value: record.indiaVarshaLat !== undefined && record.indiaVarshaLat !== null ? record.indiaVarshaLat : missing(record, 'indiaVarshaLat', undefined) },
		indiaVarshaLon: { value: record.indiaVarshaLon !== undefined && record.indiaVarshaLon !== null ? record.indiaVarshaLon : missing(record, 'indiaVarshaLon', undefined) },
		guolaoNodeMode: { value: record.guolaoNodeMode !== undefined && record.guolaoNodeMode !== null ? record.guolaoNodeMode : guolaoRecordMissing(record, 'guolaoNodeMode') },
		// 容许度（对齐 models/astro.js fieldsToParams）：
		//  - orbScale(整体缩放,数字):挂载可经 record.orbScale 覆盖(0.5–2.5,默认1);缺省/1 → undefined(后端零回归=现状)。
		//  - orbs(逐星对象):仅当挂载开「沿用本盘自定义容许度」(record.useStoredOrbs)时才下发存盘 record.orbs;
		//    默认不下发(=现状,后端用默认容许度)。对象型不进 prune 比较(prune 只看 useStoredOrbs 布尔)。
		orbScale: { value: (record.orbScale !== undefined && record.orbScale !== null && Number(record.orbScale) !== 1 && Number.isFinite(Number(record.orbScale))) ? Number(record.orbScale) : undefined },
		orbs: { value: (record.useStoredOrbs && record.orbs && typeof record.orbs === 'object' && Object.keys(record.orbs).length) ? record.orbs : undefined },
		// 埃及历七轴(egypt_*):astroAiSnapshot 的 egyptSchoolFromFields(fields) 读 fields['egypt_'+k].value,
		// 🔴 曾不产这些字段 → 恒返 null 恒落全局 currentEgyptSchool(),「随盘键优先」承诺落空。
		// 缺省 undefined → egyptSchoolFromFields 判假仍回落全局 = 零回归;挂载/存盘携带则【埃及历】段随盘。
		...EGYPT_RECORD_KEYS.reduce((acc, k)=>{
			acc[k] = { value: record[k] !== undefined && record[k] !== null ? record[k] : undefined };
			return acc;
		}, {}),
		group: { value: normalizeTags(record.group) },
	};
}

export function fieldParams(fields){
	return {
		cid: null,
		ad: fields.date.value.ad,
		date: fields.date.value.format('YYYY/MM/DD'),
		time: fields.time.value.format('HH:MM:SS'),
		zone: fields.date.value.zone,
		lat: fields.lat.value,
		lon: fields.lon.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		hsys: fields.hsys.value,
		southchart: fields.southchart.value,
		zodiacal: fields.zodiacal.value,
		siderealAyanamsa: fields.siderealAyanamsa ? fields.siderealAyanamsa.value : '',
		...((fields.siderealAyanamsa && `${fields.siderealAyanamsa.value}` === 'user')
			? require('../customCalibreStores').userAyanParamsFrom((k) => (fields[k] ? fields[k].value : undefined))
			: {}),
		tradition: fields.tradition.value,
		doubingSu28: fields.doubingSu28.value,
		strongRecption: fields.strongRecption.value,
		simpleAsp: fields.simpleAsp.value,
		virtualPointReceiveAsp: fields.virtualPointReceiveAsp.value,
		predictive: fields.predictive.value,
		showPdBounds: fields.showPdBounds.value,
		pdtype: fields.pdtype.value,
		pdMethod: fields.pdMethod.value,
		pdTimeKey: fields.pdTimeKey.value,
		pdDirect: fields.pdDirect ? fields.pdDirect.value : 1,
		pdConverse: fields.pdConverse ? fields.pdConverse.value : 0,
		pdAntiscia: fields.pdAntiscia ? fields.pdAntiscia.value : 0,
		pdTerms: fields.pdTerms ? fields.pdTerms.value : 0,
		pdYears: fields.pdYears ? fields.pdYears.value : 100,
		// 主限法解耦八键条件透传(照抄 models/astro.js fieldsToParams,默认不下发零回归):
		...(fields.pdProjection && fields.pdProjection.value && fields.pdProjection.value !== 'ptolemy' ? { pdProjection: fields.pdProjection.value } : {}),
		...(fields.pdFrame && fields.pdFrame.value && fields.pdFrame.value !== 'alcabitius' ? { pdFrame: fields.pdFrame.value } : {}),
		...(fields.pdFramework && fields.pdFramework.value && fields.pdFramework.value !== 'aspect' ? { pdFramework: fields.pdFramework.value } : {}),
		...(fields.pdParallel && (fields.pdParallel.value === 1 || fields.pdParallel.value === '1') ? { pdParallel: 1 } : {}),
		...(fields.pdRaptParallel && (fields.pdRaptParallel.value === 1 || fields.pdRaptParallel.value === '1') ? { pdRaptParallel: 1 } : {}),
		...(fields.pdTimeKeyCustom && fields.pdTimeKeyCustom.value ? { pdTimeKeyCustom: fields.pdTimeKeyCustom.value } : {}),
		...(fields.pdSignificators && Array.isArray(fields.pdSignificators.value) && fields.pdSignificators.value.length ? { pdSignificators: fields.pdSignificators.value } : {}),
		...(fields.pdPromissorTypes && Array.isArray(fields.pdPromissorTypes.value) && fields.pdPromissorTypes.value.length ? { pdPromissorTypes: fields.pdPromissorTypes.value } : {}),
		pdaspects: fields.pdaspects.value,
		// 容许度（对齐 models/astro.js fieldsToParams:248-249）：falsy → undefined（不下发=后端零回归）。
		orbs: (fields.orbs && fields.orbs.value) ? fields.orbs.value : undefined,
		orbScale: (fields.orbScale && fields.orbScale.value) ? fields.orbScale.value : undefined,
		// 🔴 手抄漂移补齐(对拍闸 W3 永久看守):此前 AI 链缺这三组,与 fieldsToParams 分叉——
		// 日界/晚子时开关随盘存档却不进 AI 重算请求(四柱口径与技法页分叉);七政命度模式同漏。
		// 条件透传:缺省不下发=后端默认零回归(与 models 侧同口径)。
		...(fields.after23NewDay && fields.after23NewDay.value !== undefined && fields.after23NewDay.value !== null ? { after23NewDay: fields.after23NewDay.value } : {}),
		...(fields.lateZiHourUseNextDay && fields.lateZiHourUseNextDay.value !== undefined && fields.lateZiHourUseNextDay.value !== null ? { lateZiHourUseNextDay: fields.lateZiHourUseNextDay.value } : {}),
		...(fields.guolaoLifeMode && fields.guolaoLifeMode.value && fields.guolaoLifeMode.value !== 'asc' ? { guolaoLifeMode: fields.guolaoLifeMode.value } : {}),
		// 🔴 七政六键此前只在技法页下发,AI 挂载重算不带 ⇒ 报时星太阳时/四余取法/
		// 推变法/古宿岁差/回归锚随盘存非默认时,挂载盘与技法页分叉。条件透传照抄 fieldsToParams 同款。
		...(fields.guolaoTrueSolarTime && (fields.guolaoTrueSolarTime.value === 'mean' || fields.guolaoTrueSolarTime.value === 'off') ? { trueSolarTime: fields.guolaoTrueSolarTime.value } : {}),
		...(fields.guolaoNodeType && fields.guolaoNodeType.value === 'true' ? { guolaoNodeType: 'true' } : {}),
		...(fields.guolaoLilithType && fields.guolaoLilithType.value === 'true' ? { guolaoLilithType: 'true' } : {}),
		...(fields.guolaoTuibianMethod && (fields.guolaoTuibianMethod.value === 'jintui' || fields.guolaoTuibianMethod.value === 'huiyuan') ? { guolaoTuibianMethod: fields.guolaoTuibianMethod.value } : {}),
		...(fields.guolaoGufaPrecess && (fields.guolaoGufaPrecess.value === 1 || fields.guolaoGufaPrecess.value === '1') ? { guolaoGufaPrecess: 1 } : {}),
		...(fields.guolaoEqTropicalAnchor && fields.guolaoEqTropicalAnchor.value === 'chunfen' ? { guolaoEqTropicalAnchor: 'chunfen' } : {}),
		// 🔴 希腊化开关六项：此前本函数只转发 tradition，漏这六项 ⇒ AI 重算盘对界系/交点/区分缓冲/
		// 狮首界/三分集/福点反转全不敏感（与所选流派档分叉）。按 models/astro.js fieldsToParams 同款
		// **条件透传**补齐：默认值不下发 → 请求体与缓存键逐字节不变（改成无条件传即全量回归）。
		// termsVariant/geminiBoundEmended 手写行随 models/astro.js 同步删除:spread(下方)
		// 按 spec 全覆盖且归一更严;两侧同删=fieldParams≡fieldsToParams 对拍闸恰等。
		...(fields.westNodeType && fields.westNodeType.value === 'true' ? { westNodeType: 'true' } : {}),
		...(fields.sectBuffer && fields.sectBuffer.value === 'ptolemy5' ? { sectBuffer: 'ptolemy5' } : {}),
		...(fields.leoBoundFirst && (fields.leoBoundFirst.value === 1 || fields.leoBoundFirst.value === '1') ? { leoBoundFirst: 1 } : {}),
		...(fields.triplicity && fields.triplicity.value && fields.triplicity.value !== 'Dorothean' ? { triplicity: fields.triplicity.value } : {}),
		...(fields.lotReversal && (fields.lotReversal.value === 0 || fields.lotReversal.value === '0') ? { lotReversal: 0 } : {}),
		// 🔴 古典口径覆盖走 classicalBackendOverridesFromFields 单一真值源(与 models/astro.js:390 同款):
		// 覆盖 宫头前移/日心/焦伤/日光束/空亡口径(+外行星)/恒星容许度·档(含 starOrb/starOrbMode 名映射)/
		// 映点容许度/燃烧之路边界 + lotsDocReverse/nodeExaltation 两开关。
		// 此前开关在此手写、其余 10 键整段缺失 —— 手写副本正是主盘/挂载分叉的病根,并入单源。
		...classicalBackendOverridesFromFields(fields),
		name: fields.name.value,
		pos: fields.pos.value,
		group: fields.group.value,
	};
}

export function buildSnapshotMetaFromRecord(record, extraMeta = {}){
	const parts = buildSourceSignature({
		sourceType: record && record.birth ? 'chart' : 'case',
		record,
	});
	return {
		date: parts.date || '',
		time: parts.time || '',
		zone: parts.zone || '',
		lon: parts.lon || '',
		lat: parts.lat || '',
		...extraMeta,
	};
}

// 事盘口径键:顶层优先,再读 payload.fieldSnapshot(事盘经起课抽屉存的日界 / 晚子时 / 时间算法在这里),与页面载入
// (models/user applyCase)同一读法 —— 此前只读顶层,这类事盘无头重算一律回落全局 / 0。
function caseFieldValue(record, key){
	if(!record){ return undefined; }
	const top = record[key];
	if(top !== undefined && top !== null && top !== ''){ return top; }
	let pl = record.payload;
	if(typeof pl === 'string' && pl){
		try{ pl = JSON.parse(pl); }catch(e){ pl = null; }
	}
	const snap = pl && pl.fieldSnapshot && typeof pl.fieldSnapshot === 'object' ? pl.fieldSnapshot : null;
	const v = snap ? snap[key] : undefined;
	return v === undefined || v === null || v === '' ? undefined : v;
}

export function buildCaseSnapshotFields(record){
	// 起课时刻与载入事盘同一判据 / 同一规范写法(caseDivTime;T / 多空白 / 只有日期 = 12:00 与页面一致)
	const divParts = parseCaseDivTimeParts(record && record.divTime);
	const dt = parseBirthString(divParts ? divParts.canonical : (record && (record.divTime || record.updateTime || '')), record && record.zone ? record.zone : '+08:00');
	const _a23 = caseFieldValue(record, 'after23NewDay');
	const _lzi = caseFieldValue(record, 'lateZiHourUseNextDay');
	const _tAlg = caseFieldValue(record, 'timeAlg');
	return {
		ad: { value: dt.ad },
		date: { value: dt.clone() },
		time: { value: dt.clone() },
		zone: { value: record && record.zone ? record.zone : dt.zone || '+08:00' },
		lon: { value: record && record.lon ? record.lon : '' },
		lat: { value: record && record.lat ? record.lat : '' },
		gpsLon: { value: record && record.gpsLon !== undefined ? record.gpsLon : 0 },
		gpsLat: { value: record && record.gpsLat !== undefined ? record.gpsLat : 0 },
		gender: { value: record && record.gender !== undefined && record.gender !== null ? record.gender : 1 },
		after23NewDay: { value: _a23 !== undefined ? _a23 : defaultAfter23NewDay() },
		lateZiHourUseNextDay: { value: _lzi !== undefined ? _lzi : defaultLateZiHourUseNextDay() },
		timeAlg: { value: _tAlg !== undefined ? _tAlg : 0 },
	};
}

// 🔴 第二参 gearOptions:日界/晚子时齿轮值**优先**(record 兜底,再全局兜底)。
// 此前四柱农历(fetchPreciseNongli 的入参)只读 record —— 挂载拨日界齿轮时局/置闰跟着变、
// 日柱不变(B-2 半通死开关,仅 23:00-59 生辰显形,肉眼最难发现的一类)。齿轮与局同源后闭环。
// opts.withTimeAlg:起课时间算法也带上(齿轮 → 记录顶层 → fieldSnapshot → 0)。只给「页面按时间算法取农历」的技法
// (奇门 / 六爻);太乙等页面恒按真太阳时取农历的不带,保持与页面一致。
export function buildCaseSnapshotParams(record, gearOptions, opts){
	const fields = buildCaseSnapshotFields(record || {});
	const g = gearOptions && typeof gearOptions === 'object' ? gearOptions : {};
	const pickDayRule = (name, recordFallback, globalFallback)=>{
		if(g[name] !== undefined && g[name] !== null && g[name] !== ''){
			return parseInt(`${g[name]}`, 10);
		}
		return recordFallback !== undefined ? recordFallback : globalFallback();
	};
	return {
		date: fields.date.value.format('YYYY-MM-DD'),
		time: fields.time.value.format('HH:mm:ss'),
		ad: fields.date.value.ad || 1,
		zone: fields.zone.value,
		lon: fields.lon.value,
		lat: fields.lat.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		after23NewDay: pickDayRule('after23NewDay', (fields.after23NewDay && fields.after23NewDay.value !== undefined) ? fields.after23NewDay.value : undefined, defaultAfter23NewDay),
		lateZiHourUseNextDay: pickDayRule('lateZiHourUseNextDay', (fields.lateZiHourUseNextDay && fields.lateZiHourUseNextDay.value !== undefined) ? fields.lateZiHourUseNextDay.value : undefined, defaultLateZiHourUseNextDay),
		...((opts && opts.withTimeAlg) ? { timeAlg: (g.timeAlg !== undefined && g.timeAlg !== null && g.timeAlg !== '') ? Number(g.timeAlg) : Number(fields.timeAlg.value || 0) } : {}),
	};
}

function getSnapshotSaveModuleName(key){
	if(key === 'sixyao'){
		return 'guazhan';
	}
	return key;
}

export function getCaseGenderLabel(record){
	return `${record && record.gender !== undefined && record.gender !== null ? record.gender : ''}` === '0' ? '女' : '男';
}

// 快照正文的规范形(单一来源):存槽与当场回给调用方的都是这一份。此前当场算出的正文原样回(不少构建器结尾带一个换行),
// 存进槽的是去掉首尾空白的 —— 同一张盘第一次起盘与之后读槽的回包差一个结尾换行(同一输入两次结果不同)
export function canonicalSnapshotText(content){
	return `${content || ''}`.trim();
}

export function saveGeneratedTechniqueSnapshot(key, content, record, extraMeta = {}){
	const text = canonicalSnapshotText(content);
	if(!text){
		return null;
	}
	return saveModuleAISnapshot(
		getSnapshotSaveModuleName(normalizeTechniqueKey(key)),
		text,
		buildSnapshotMetaFromRecord(record, extraMeta)
	);
}

// kinastro 族齿轮透传 helper:只透非空('' = 按盘面/后端自出),与页面 buildPayload 同键。
export function pickKin(record, keys){
	const out = {};
	keys.forEach((k)=>{
		const v = record && record[k];
		if(v !== undefined && v !== null && v !== ''){ out[k] = v; }
	});
	return out;
}
// 日界 / 晚子时两键:与页面 buildPayload 同一函数 chartDayBoundary(record 有值优先,缺读全局现值;两键恒下发)。
export function kinDayBoundary(record){
	return chartDayBoundary(buildFieldObject(record || {}));
}
// gender 随档(页面 normBinaryGender 同口径:'0'/女/Female → '0',余 '1')。
export function kinGenderOverride(record){
	const g = record && record.gender;
	if(g === undefined || g === null || g === ''){ return {}; }
	const sg = `${g}`.trim();
	return { gender: (sg === '0' || sg === '女' || sg === 'Female' || sg === 'female' || sg === 'F') ? '0' : '1' };
}
