// 星盘页字段:空字段表(非默认捕获的基准)与字段 → 排盘请求参数
// 从 astro.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import DateTime from '../../components/comp/DateTime';
import { registerFieldsBaselineFactory } from '../../utils/recordFieldsRestore';
import { DefLat, DefLon, DefGpsLat, DefGpsLon } from '../../utils/constants';
import { newChartSeedValue, newChartSeedExtraEntries } from '../../utils/newChartSeeds';
import { classicalGlobalValue, classicalGlobalOverrides, classicalBackendOverridesFromFields } from '../../utils/classicalChartGlobals';
import { PD_EXTRA_SETTING_KEYS, pdExtraRequestParams } from '../../utils/primaryDirectionSync';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';

let dtm = new DateTime();

// newEmptyFields = 「非默认捕获」的基准注册(工厂注入防循环 import:
// recordFieldsRestore 不能反向 import 本模型)。捕获逻辑与还原清单同居 recordFieldsRestore。
registerFieldsBaselineFactory(()=>newEmptyFields());

export function newEmptyFields(){
	const fields = {
		cid: {
			value: null,
			name: ['cid'],
		},
		ad:{
			value: dtm.ad,
			name: ['ad'],
		},
		date: {
			value: dtm.clone(),   // 不再直接引用模块级 dtm(共享引用被外部改写会串)
			name: ['date'],
		},
		time: {
			value: dtm.clone(),
			name: ['time'],
		},
		zone: {
			value: dtm.zone,
			name: ['zone'],
		},
		lat: {
			value: DefLat,
			name: ['lat'],
		},
		lon: {
			value: DefLon,
			name: ['lon'],
		},
		gpsLat: {
			value: DefGpsLat,
			name: ['gpsLat'],
		},
		gpsLon: {
			value: DefGpsLon,
			name: ['gpsLon'],
		},
		name: {
			value: null,
			name: ['name'],
		},
		pos: {
			value: null,
			name: ['pos'],
		},
		hsys: {
			value: newChartSeedValue('hsys'),   // 新盘种子(缺省宫制见 newChartSeeds)
			name: ['hsys'],
		},
		indiaHsys: {
			value: newChartSeedValue('indiaHsys'),   // 新盘种子(缺省 AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT)
			name: ['indiaHsys'],
		},
		indiaAyanamsa: {
			value: newChartSeedValue('indiaAyanamsa'),   // 新盘种子(缺省 AstroConst.INDIA_AYANAMSA_DEFAULT)
			name: ['indiaAyanamsa'],
		},
		zodiacal: {
			value: newChartSeedValue('zodiacal'),   // 新盘种子(缺省 0)
			name: ['zodiacal'],
		},
		siderealAyanamsa: {
			value: newChartSeedValue('siderealAyanamsa'),   // 新盘种子(缺省 '')
			name: ['siderealAyanamsa'],
		},
		tradition: {
			value: 0,
			name: ['tradition'],
		},
		strongRecption: {
			value: 0,
			name: ['strongRecption'],
		},
		simpleAsp: {
			value: 0,
			name: ['simpleAsp'],
		},
		virtualPointReceiveAsp: {
			value: 0,
			name: ['virtualPointReceiveAsp'],
		},
		doubingSu28: {
			value: newChartSeedValue('doubingSu28'),   // 新盘种子(缺省 0)
			name: ['doubingSu28'],
		},
		guolaoLifeMode: {
			value: 'asc',
			name: ['guolaoLifeMode'],
		},
		guolaoNodeMode: {
			value: 'northKetuSouthRahu',
			name: ['guolaoNodeMode'],
		},
		guolaoAyanamsa: {
			value: '',
			name: ['guolaoAyanamsa'],
		},
		guolaoTrueSolarTime: {
			value: 'true',
			name: ['guolaoTrueSolarTime'],
		},
		guolaoNodeType: {
			value: 'mean',
			name: ['guolaoNodeType'],
		},
		guolaoLilithType: {
			value: 'mean',
			name: ['guolaoLilithType'],
		},
		guolaoZiqiMode: {
			value: 'real',
			name: ['guolaoZiqiMode'],
		},
		guolaoBodyMode: {
			value: 'taiyin',
			name: ['guolaoBodyMode'],
		},
		guolaoTuibianMethod: {
			value: 'jiyuan',
			name: ['guolaoTuibianMethod'],
		},
		guolaoGufaPrecess: {
			value: 0,
			name: ['guolaoGufaPrecess'],
		},
		guolaoEqTropicalAnchor: {
			value: 'dongzhi',
			name: ['guolaoEqTropicalAnchor'],
		},
		// 占星(希腊化)G12/G13/G15/G20-P2:西占月交点真平 / 区分昼夜缓冲 / 迦勒底界狮子首星 / 三分集 / 福点反转。
		// 默认(平/几何地平/狮子木首/Dorothean/反转ON)= 当前零回归;仅非默认才下发(见 fieldsToParams 条件透传)。
		// 种子改从全局仓取(utils/classicalChartGlobals,「设置→星盘设置」写入、safeStorage 持久化):
		// 用户从未改过设置时全局仓值==内建默认 → 逐字节零回归;改过则重启/新盘自动带全局偏好,
		// 载入命盘时 record 显式键(applyRecordToFields)照旧覆盖本种子(每盘保真优先)。
		westNodeType: {
			value: classicalGlobalValue('westNodeType'),
			name: ['westNodeType'],
		},
		sectBuffer: {
			value: classicalGlobalValue('sectBuffer'),
			name: ['sectBuffer'],
		},
		sunriseMode: {
			value: classicalGlobalValue('sunriseMode'),   // 日出 / 日没口径(播种全局;主盘构参只读 fields,缺此键重启后主盘回日心口径)
			name: ['sunriseMode'],
		},
		leoBoundFirst: {
			value: classicalGlobalValue('leoBoundFirst'),
			name: ['leoBoundFirst'],
		},
		triplicity: {
			value: classicalGlobalValue('triplicity'),
			name: ['triplicity'],
		},
		lotReversal: {
			value: classicalGlobalValue('lotReversal'),
			name: ['lotReversal'],
		},
		// 界系/双子界序:schema 历史无此二键(缺省=不下发);仅全局仓非默认时才播种 wrapper,
		// 保持「默认态 fields 键集与请求体逐字节不变」。
		...(classicalGlobalOverrides().termsVariant !== undefined ? {
			termsVariant: { value: classicalGlobalValue('termsVariant'), name: ['termsVariant'] },
		} : {}),
		...(classicalGlobalOverrides().geminiBoundEmended !== undefined ? {
			geminiBoundEmended: { value: classicalGlobalValue('geminiBoundEmended'), name: ['geminiBoundEmended'] },
		} : {}),
		// 2026-07 二批:落宫前移/太阳三态/空亡口径/恒星轨/映点容许度(排盘级,后端 perchart 参数化)。
		// 种子=全局仓值(默认==后端现硬编码值);下发与否由 classicalBackendOverrides 条件判定。
		houseCuspAdvance: {
			value: classicalGlobalValue('houseCuspAdvance'),
			name: ['houseCuspAdvance'],
		},
		cazimiOrb: {
			value: classicalGlobalValue('cazimiOrb'),
			name: ['cazimiOrb'],
		},
		combustOrb: {
			value: classicalGlobalValue('combustOrb'),
			name: ['combustOrb'],
		},
		underBeamsOrb: {
			value: classicalGlobalValue('underBeamsOrb'),
			name: ['underBeamsOrb'],
		},
		vocMode: {
			value: classicalGlobalValue('vocMode'),
			name: ['vocMode'],
		},
		vocIncludeOuter: {
			value: classicalGlobalValue('vocIncludeOuter'),
			name: ['vocIncludeOuter'],
		},
		fixedStarOrb: {
			value: classicalGlobalValue('fixedStarOrb'),
			name: ['fixedStarOrb'],
		},
		fixedStarOrbMode: {
			value: classicalGlobalValue('fixedStarOrbMode'),
			name: ['fixedStarOrbMode'],
		},
		antisciaOrb: {
			value: classicalGlobalValue('antisciaOrb'),
			name: ['antisciaOrb'],
		},
		// 二批第十键 viaCombustaVariant 此前独漏播种(九键有它没有)→用户改 narrow 重启后
		// 首发盘 fields 无此键、classicalBackendOverridesFromFields 取 undefined 不下发,静默回落 standard。
		viaCombustaVariant: {
			value: classicalGlobalValue('viaCombustaVariant'),
			name: ['viaCombustaVariant'],
		},
		// 三个 0/1 流派开关(点公式文档序/交点入旺/土星旺20°):schema 历史无此三键,
		// 照 termsVariant 条件播种范式——仅全局仓非默认才播 wrapper,默认态 fields 键集逐字节不变。
		...(classicalGlobalOverrides().lotsDocReverse !== undefined ? {
			lotsDocReverse: { value: classicalGlobalValue('lotsDocReverse'), name: ['lotsDocReverse'] },
		} : {}),
		...(classicalGlobalOverrides().nodeExaltation !== undefined ? {
			nodeExaltation: { value: classicalGlobalValue('nodeExaltation'), name: ['nodeExaltation'] },
		} : {}),
		// 天文口径批五键:同 termsVariant 条件播种范式(schema 历史无此键,仅全局非默认才播,
		// 默认态 fields 键集逐字节不变;eclipseTimeMode 纯全局显示口径不进 fields)。
		...(classicalGlobalOverrides().combustOwnChariotExempt !== undefined ? {
			combustOwnChariotExempt: { value: classicalGlobalValue('combustOwnChariotExempt'), name: ['combustOwnChariotExempt'] },
		} : {}),
		...(classicalGlobalOverrides().westLilithType !== undefined ? {
			westLilithType: { value: classicalGlobalValue('westLilithType'), name: ['westLilithType'] },
		} : {}),
		...(classicalGlobalOverrides().topocentricMoon !== undefined ? {
			topocentricMoon: { value: classicalGlobalValue('topocentricMoon'), name: ['topocentricMoon'] },
		} : {}),
		...(classicalGlobalOverrides().stationMarking !== undefined ? {
			stationMarking: { value: classicalGlobalValue('stationMarking'), name: ['stationMarking'] },
		} : {}),
		...(classicalGlobalOverrides().hermeticLotsReversal !== undefined ? {
			hermeticLotsReversal: { value: classicalGlobalValue('hermeticLotsReversal'), name: ['hermeticLotsReversal'] },
		} : {}),
		...(classicalGlobalOverrides().erosConstruction !== undefined ? {
			erosConstruction: { value: classicalGlobalValue('erosConstruction'), name: ['erosConstruction'] },
		} : {}),
		...(classicalGlobalOverrides().lotFortuneVariant !== undefined ? {
			lotFortuneVariant: { value: classicalGlobalValue('lotFortuneVariant'), name: ['lotFortuneVariant'] },
		} : {}),
		...(classicalGlobalOverrides().lotFatherCombustAlt !== undefined ? {
			lotFatherCombustAlt: { value: classicalGlobalValue('lotFatherCombustAlt'), name: ['lotFatherCombustAlt'] },
		} : {}),
		...(classicalGlobalOverrides().lotProjection !== undefined ? {
			lotProjection: { value: classicalGlobalValue('lotProjection'), name: ['lotProjection'] },
		} : {}),
		...(classicalGlobalOverrides().dignityDebilities !== undefined ? {
			dignityDebilities: { value: classicalGlobalValue('dignityDebilities'), name: ['dignityDebilities'] },
		} : {}),
		...(classicalGlobalOverrides().almutenTripMode !== undefined ? {
			almutenTripMode: { value: classicalGlobalValue('almutenTripMode'), name: ['almutenTripMode'] },
		} : {}),
		...(classicalGlobalOverrides().planetaryHourMethod !== undefined ? {
			planetaryHourMethod: { value: classicalGlobalValue('planetaryHourMethod'), name: ['planetaryHourMethod'] },
		} : {}),
		...(classicalGlobalOverrides().orbSystem !== undefined ? {
			orbSystem: { value: classicalGlobalValue('orbSystem'), name: ['orbSystem'] },
		} : {}),
		...(classicalGlobalOverrides().luminaryOrbBonus !== undefined ? {
			luminaryOrbBonus: { value: classicalGlobalValue('luminaryOrbBonus'), name: ['luminaryOrbBonus'] },
		} : {}),
		...(classicalGlobalOverrides().aspectIncludeCusps !== undefined ? {
			aspectIncludeCusps: { value: classicalGlobalValue('aspectIncludeCusps'), name: ['aspectIncludeCusps'] },
		} : {}),
		...(classicalGlobalOverrides().aspectIncludeLots !== undefined ? {
			aspectIncludeLots: { value: classicalGlobalValue('aspectIncludeLots'), name: ['aspectIncludeLots'] },
		} : {}),
		...(classicalGlobalOverrides().aspectIncludeMidpoints !== undefined ? {
			aspectIncludeMidpoints: { value: classicalGlobalValue('aspectIncludeMidpoints'), name: ['aspectIncludeMidpoints'] },
		} : {}),
		...(classicalGlobalOverrides().solarReturnVariant !== undefined ? {
			solarReturnVariant: { value: classicalGlobalValue('solarReturnVariant'), name: ['solarReturnVariant'] },
		} : {}),
		...(classicalGlobalOverrides().returnLatitudeMode !== undefined ? {
			returnLatitudeMode: { value: classicalGlobalValue('returnLatitudeMode'), name: ['returnLatitudeMode'] },
		} : {}),
		...(classicalGlobalOverrides().vulcanCalc !== undefined ? {
			vulcanCalc: { value: classicalGlobalValue('vulcanCalc'), name: ['vulcanCalc'] },
		} : {}),
		houseStartMode: {
			// 新盘种子(缺省 0 八字;宿占页亲手改记一笔,旧版偏好 suzhanHouseStartMode 已一次性并入)
			value: newChartSeedValue('houseStartMode'),
			name: ['houseStartMode'],
		},
				predictive: {
					value: 1,
					name: ['predictive'],
				},
				showPdBounds: {
					value: 1,
					name: ['showPdBounds'],
				},
		pdtype: {
			value: newChartSeedValue('pdtype'),   // 新盘种子(缺省 0)
			name: ['pdtype'],
		},
		pdMethod: {
			value: newChartSeedValue('pdMethod'),   // 新盘种子(缺省 'core_alchabitius')
			name: ['pdMethod'],
		},
		pdTimeKey: {
			value: newChartSeedValue('pdTimeKey'),   // 新盘种子(缺省 'Ptolemy')
			name: ['pdTimeKey'],
		},
		// 主限法 P0 补齐维(默认=引擎缺省,fieldsToParams 仅非默认才下发 → 零回归):
		pdProjection: {
			value: newChartSeedValue('pdProjection'),   // 新盘种子(缺省 'ptolemy')
			name: ['pdProjection'],
		},
		pdFrame: {
			value: newChartSeedValue('pdFrame'),   // 新盘种子(缺省 'alcabitius')
			name: ['pdFrame'],
		},
		pdFramework: {
			value: newChartSeedValue('pdFramework'),   // 新盘种子(缺省 'aspect')
			name: ['pdFramework'],
		},
		pdParallel: {
			value: newChartSeedValue('pdParallel'),   // 新盘种子(缺省 0)
			name: ['pdParallel'],
		},
		pdRaptParallel: {
			value: newChartSeedValue('pdRaptParallel'),   // 新盘种子(缺省 0)
			name: ['pdRaptParallel'],
		},
		pdTimeKeyCustom: {
			value: null,
			name: ['pdTimeKeyCustom'],
		},
		pdSignificators: {
			value: newChartSeedValue('pdSignificators'),   // 新盘种子(缺省 null = 不扩展)
			name: ['pdSignificators'],
		},
		pdPromissorTypes: {
			value: newChartSeedValue('pdPromissorTypes'),   // 新盘种子(缺省 null = 不扩展)
			name: ['pdPromissorTypes'],
		},
		// 主限法设置项登记表(相位侧 / 传统逆向 / 取点四项):新盘种子,缺省 = 登记表缺省
		...Object.fromEntries(PD_EXTRA_SETTING_KEYS.map((key)=>[key, { value: newChartSeedValue(key), name: [key] }])),
		pdaspects: {
			value: [0, 60, 90, 120, 180],
			name: ['pdaspects'],
		},
		timeAlg: {
			value: newChartSeedValue('timeAlg'),   // 新盘种子(缺省 0)
			name: ['timeAlg'],
		},
		phaseType: {
			value: newChartSeedValue('phaseType'),   // 新盘种子(缺省 0)
			name: ['phaseType'],
		},
		godKeyPos: {
			value: newChartSeedValue('godKeyPos'),   // 新盘种子(缺省 '年')
			name: ['godKeyPos'],
		},
		orbs:{
			value: undefined,
			name: ['orbs'],
		},
		orbScale:{
			value: undefined,
			name: ['orbScale'],
		},
		after23NewDay: {
			value: defaultAfter23NewDay(),
			name: ['after23NewDay'],
		},
		// v3 第二开关·晚子时·时柱起干模式 (与 after23NewDay 完全独立)
		lateZiHourUseNextDay: {
			value: defaultLateZiHourUseNextDay(),
			name: ['lateZiHourUseNextDay'],
		},
		// schema 本没有的种子键(印占大多数选项):只在种子非缺省时才新建 entry,默认态键集逐字节不变
		...newChartSeedExtraEntries(),
		adjustJieqi: {
			value: 0,
			name: ['adjustJieqi'],
		},
		gender: {
			value: 1,
			name: ['gender'],
		},
		southchart: {
			value: 0,
			name: ['southchart'],
		},
		group: {
			value: null,
			name: ['group'],
		},
		memoZiWei:{
			value: null,
			name: ['memoZiWei'],
		},
		memoBaZi:{
			value: null,
			name: ['memoBaZi'],
		},
		memoAstro:{
			value: null,
			name: ['memoAstro'],
		},
		memo74:{
			value: null,
			name: ['memo74'],
		},
		memoGua:{
			value: null,
			name: ['memoGua'],
		},
		memoLiuReng:{
			value: null,
			name: ['memoLiuReng'],
		},
		memoQiMeng:{
			value: null,
			name: ['memoQiMeng'],
		},
		memoSuZhan:{
			value: null,
			name: ['memoSuZhan'],
		},

	};

	return fields;
}

export function fieldsToParams(fields){
	const params = {
		cid: fields.cid.value,
		ad: fields.date.value.ad,
		date: fields.date.value.format('YYYY/MM/DD'),
		time: fields.time.value.format('HH:mm:ss'),
		zone: fields.date.value.zone,
		lat: fields.lat.value,
		lon: fields.lon.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		hsys: fields.hsys.value,
		southchart: fields.southchart.value,
		zodiacal: fields.zodiacal.value,
		siderealAyanamsa: fields.siderealAyanamsa ? fields.siderealAyanamsa.value : '',
		// 自定义恒星黄道 'user' 档:随行附历元参数(fields 优先,缺读当前槽;后端 SIDM_USER)。
		...((fields.siderealAyanamsa && `${fields.siderealAyanamsa.value}` === 'user')
			? require('../../utils/customCalibreStores').userAyanParamsFrom((k) => (fields[k] ? fields[k].value : undefined))
			: {}),
		tradition: fields.tradition.value,
		// termsVariant/geminiBoundEmended 手写条件段已删:spread(下行)按 spec 全覆盖
		// 且归一化更严(int 强转+值域校验);旧手写段在 spread 前=恒被覆盖的死代码,唯一「生效」
		// 场景是 termsVariant=4 无合法表时 spread 自删而手写键存活→请求带 4 被后端回落——
		// 删除后前端即降级不发 4,恰是 WP-7 设计意图。
		// 2026-07 二批九键(落宫/三态/空亡/恒星/映点):共享 helper 条件透传,默认不下发零回归。
		...classicalBackendOverridesFromFields(fields),
		doubingSu28: fields.doubingSu28.value,
		guolaoLifeMode: fields.guolaoLifeMode ? fields.guolaoLifeMode.value : 'asc',   // R2 含地支(自定命宫,BaZi 按地支当 custom)
		// 七政四余 G6/G10/G11：报时星太阳时(真/平/关)+ 四余取法(罗计真平/月孛真平)。默认(真/平/平)不下发 → body 零变、不扰缓存键(同 termsVariant 条件透传);仅非默认才传 Java→Python。
		...(fields.guolaoTrueSolarTime && (fields.guolaoTrueSolarTime.value === 'mean' || fields.guolaoTrueSolarTime.value === 'off') ? { trueSolarTime: fields.guolaoTrueSolarTime.value } : {}),
		...(fields.guolaoNodeType && fields.guolaoNodeType.value === 'true' ? { guolaoNodeType: 'true' } : {}),
		...(fields.guolaoLilithType && fields.guolaoLilithType.value === 'true' ? { guolaoLilithType: 'true' } : {}),
		// 授时历古法(用制 6)推变法 + 古宿岁差:仅非默认(纪元闭式·不随岁差)才下发 → body 零变、不扰缓存键(同上条件透传)。
		...(fields.guolaoTuibianMethod && (fields.guolaoTuibianMethod.value === 'jintui' || fields.guolaoTuibianMethod.value === 'huiyuan') ? { guolaoTuibianMethod: fields.guolaoTuibianMethod.value } : {}),
		...(fields.guolaoGufaPrecess && (fields.guolaoGufaPrecess.value === 1 || fields.guolaoGufaPrecess.value === '1') ? { guolaoGufaPrecess: 1 } : {}),
		...(fields.guolaoEqTropicalAnchor && fields.guolaoEqTropicalAnchor.value === 'chunfen' ? { guolaoEqTropicalAnchor: 'chunfen' } : {}),
		// 占星(希腊化)G12/G13/G15/G20-P2:西占月交点真平 / 区分昼夜缓冲 / 迦勒底界狮子首星 / 三分集 / 福点反转。
		// 默认(平/几何地平/狮子木首/Dorothean/反转ON)不下发 → body 零变、不扰缓存键(同 termsVariant/guolao* 条件透传);仅非默认才传给 Java→Python。
		...(fields.westNodeType && fields.westNodeType.value === 'true' ? { westNodeType: 'true' } : {}),
		...(fields.sectBuffer && fields.sectBuffer.value === 'ptolemy5' ? { sectBuffer: 'ptolemy5' } : {}),
		...(fields.leoBoundFirst && (fields.leoBoundFirst.value === 1 || fields.leoBoundFirst.value === '1') ? { leoBoundFirst: 1 } : {}),
		...(fields.triplicity && fields.triplicity.value && fields.triplicity.value !== 'Dorothean' ? { triplicity: fields.triplicity.value } : {}),
		...(fields.lotReversal && (fields.lotReversal.value === 0 || fields.lotReversal.value === '0') ? { lotReversal: 0 } : {}),
		// lotsDocReverse/nodeExaltation 两个 0/1 开关已并入
		// classicalBackendOverridesFromFields 单一真值源(上方 spread),此处不再手写——
		// 曾因手写副本只覆盖主盘,13宫盘/12分盘/合盘全部丢参(与主盘同档流派分叉)。
		strongRecption: fields.strongRecption.value,
		simpleAsp: fields.simpleAsp.value,
		virtualPointReceiveAsp: fields.virtualPointReceiveAsp.value,
		predictive: fields.predictive.value,
		showPdBounds: fields.showPdBounds ? fields.showPdBounds.value : 1,
		pdtype: fields.pdtype ? fields.pdtype.value : 0,
		pdMethod: fields.pdMethod ? fields.pdMethod.value : 'core_alchabitius',
		pdTimeKey: fields.pdTimeKey ? fields.pdTimeKey.value : 'Ptolemy',
		...(fields.pdProjection && fields.pdProjection.value && fields.pdProjection.value !== 'ptolemy' ? { pdProjection: fields.pdProjection.value } : {}),
		...(fields.pdFrame && fields.pdFrame.value && fields.pdFrame.value !== 'alcabitius' ? { pdFrame: fields.pdFrame.value } : {}),
		...(fields.pdFramework && fields.pdFramework.value && fields.pdFramework.value !== 'aspect' ? { pdFramework: fields.pdFramework.value } : {}),
		...(fields.pdParallel && (fields.pdParallel.value === 1 || fields.pdParallel.value === '1') ? { pdParallel: 1 } : {}),
		...(fields.pdRaptParallel && (fields.pdRaptParallel.value === 1 || fields.pdRaptParallel.value === '1') ? { pdRaptParallel: 1 } : {}),
		...(fields.pdTimeKeyCustom && fields.pdTimeKeyCustom.value ? { pdTimeKeyCustom: fields.pdTimeKeyCustom.value } : {}),
		...(fields.pdSignificators && Array.isArray(fields.pdSignificators.value) && fields.pdSignificators.value.length ? { pdSignificators: fields.pdSignificators.value } : {}),
		...(fields.pdPromissorTypes && Array.isArray(fields.pdPromissorTypes.value) && fields.pdPromissorTypes.value.length ? { pdPromissorTypes: fields.pdPromissorTypes.value } : {}),
		...pdExtraRequestParams(Object.fromEntries(PD_EXTRA_SETTING_KEYS.map((key)=>[key, fields[key] ? fields[key].value : undefined]))),
		pdaspects: fields.pdaspects.value,
		name: fields.name.value,
		pos: fields.pos.value,
		group: fields.group ? fields.group.value : null,
		after23NewDay: (fields.after23NewDay && fields.after23NewDay.value !== undefined) ? fields.after23NewDay.value : defaultAfter23NewDay(),
		lateZiHourUseNextDay: (fields.lateZiHourUseNextDay && fields.lateZiHourUseNextDay.value !== undefined) ? fields.lateZiHourUseNextDay.value : defaultLateZiHourUseNextDay(),
		orbs: (fields.orbs && fields.orbs.value) ? fields.orbs.value : undefined,
		orbScale: (fields.orbScale && fields.orbScale.value) ? fields.orbScale.value : undefined,
	};

	if(params.pdaspects && params.pdaspects instanceof String){
		params.pdaspects = JSON.parse(params.pdaspects);
	}

	return params;
}
