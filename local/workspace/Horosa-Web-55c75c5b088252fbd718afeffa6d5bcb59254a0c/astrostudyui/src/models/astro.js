import { history } from 'umi';
import {getStore, } from '../utils/storageutil';
import { Modal, } from 'antd';
import DateTime from '../components/comp/DateTime';
import * as service from '../services/astro';
import {randomStr,} from '../utils/helper';
import { DefLat, DefLon, DefGpsLat, DefGpsLon, ServerRoot, } from '../utils/constants';
import { showChartServiceError as showChartServiceErrorRich } from '../components/common/ChartServiceErrorModal';
import { saveAstroAISnapshotLazy, } from '../utils/astroAiSnapshot';
import { hookRafEnabled, fieldsFastCommitEnabled, prewarmRequestsEnabled, speculativePrecomputeEnabled, stepPrefetchArmEnabled, stepPrefetchDepth } from '../utils/perfFlags';
import { submitStepPrefetch, getStepPrefetcher, registerStepSelectHandler } from '../utils/stepPrefetch';
import { perfBegin } from '../utils/perfMark';
// PERF-R10 horosa_step_prefetch_arm_v1:「选步长即武装」——构造器经 registerArmPlanBuilder
// 注入(utils 不反向 import models);settle 兜底武装的档位来自 reportStepUnit 的记录。
import { registerArmPlanBuilder, reportStepUnit, currentStepUnit, shouldArmForTab } from '../utils/stepPrefetchArm';
// PERF-R10 S2(horosa_boot_chart_restore_v1):出盘 settle 后落「上次工作现场」快照(空闲写)。
import { saveBootChartSnapshot } from '../utils/bootChartRestore';
// PERF-R10 Ship5-P2(horosa_option_prefetch_v1):选项 Hamming-1 投机 —— 构参注入同 arm。
import { registerOptionChartTaskBuilder, speculateChartOptions } from '../utils/optionPrefetch';
import { loadLocalFateEvents, saveLocalFateEvents, } from '../utils/localdeeplearn';
import * as AstroConst from '../constants/AstroConst';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../utils/dayBoundary';
import { applyRecordToFields } from '../utils/recordFieldsRestore';
import { classicalGlobalValue, classicalGlobalOverrides, classicalBackendOverridesFromFields } from '../utils/classicalChartGlobals';

let dtm = new DateTime();
const DefaultHouseSystem = 1;

// PERF-R8 P0(纯观测):排盘 saga 成功提交 chartObj 后打 refresh-end mark,并与
// pages/index.js 的 horosa:tab:*:refresh-start 配 measure —— DevTools Performance
// 面板可把「点击→显示」分解为 后端+网络(start→end)与 前端渲染(end→render-complete)。
// 失败静默,零行为影响。
function markChartRefreshEnd(){
	try{
		if(typeof performance !== 'undefined' && performance.mark){
			performance.mark('horosa:chart:refresh-end');
			if(performance.getEntriesByType && performance.measure){
				const starts = performance.getEntriesByType('mark').filter((m)=>m.name.indexOf(':refresh-start') >= 0);
				if(starts.length){
					performance.measure('horosa:chart:refresh', starts[starts.length - 1].name, 'horosa:chart:refresh-end');
				}
			}
		}
	}catch(e){ /* observation only */ }
}

function newEmptyFields(){
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
			value: dtm,
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
			value: DefaultHouseSystem,
			name: ['hsys'],
		},
		indiaHsys: {
			value: AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT,
			name: ['indiaHsys'],
		},
		indiaAyanamsa: {
			value: AstroConst.INDIA_AYANAMSA_DEFAULT,
			name: ['indiaAyanamsa'],
		},
		zodiacal: {
			value: 0,
			name: ['zodiacal'],
		},
		siderealAyanamsa: {
			value: '',
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
			value: 0,
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
		houseStartMode: {
			// [X1] 宿占「人事十二宫起盘」持久化读回:写侧存 localStorage(suzhanHouseStartMode),
			// 初值曾硬编码 0 → 用户选 ASC 重启即静默回退八字公式起盘。SSR/jest 无 localStorage 时守 0。
			value: (typeof localStorage !== 'undefined' && parseInt(localStorage.getItem('suzhanHouseStartMode'), 10) === 1) ? 1 : 0,
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
			value: 0,
			name: ['pdtype'],
		},
		pdMethod: {
			value: 'core_alchabitius',
			name: ['pdMethod'],
		},
		pdTimeKey: {
			value: 'Ptolemy',
			name: ['pdTimeKey'],
		},
		// 主限法 P0 补齐维(默认=引擎缺省,fieldsToParams 仅非默认才下发 → 零回归):
		pdProjection: {
			value: 'ptolemy',
			name: ['pdProjection'],
		},
		pdFrame: {
			value: 'alcabitius',
			name: ['pdFrame'],
		},
		pdFramework: {
			value: 'aspect',
			name: ['pdFramework'],
		},
		pdParallel: {
			value: 0,
			name: ['pdParallel'],
		},
		pdRaptParallel: {
			value: 0,
			name: ['pdRaptParallel'],
		},
		pdTimeKeyCustom: {
			value: null,
			name: ['pdTimeKeyCustom'],
		},
		pdSignificators: {
			value: null,
			name: ['pdSignificators'],
		},
		pdPromissorTypes: {
			value: null,
			name: ['pdPromissorTypes'],
		},
		pdaspects: {
			value: [0, 60, 90, 120, 180],
			name: ['pdaspects'],
		},
		timeAlg: {
			value: 0,
			name: ['timeAlg'],
		},
		phaseType: {
			value: 0,
			name: ['phaseType'],
		},
		godKeyPos: {
			value: '年',
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

function fieldsToParams(fields){
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
		tradition: fields.tradition.value,
		// 界系(bounds)：默认 0/缺省 不下发 → /chart body 零变 + 不扰缓存键(同 pd*/orbScale 条件透传口径);仅非 0 才传给 Java→Python。
		...(fields.termsVariant && fields.termsVariant.value ? { termsVariant: fields.termsVariant.value } : {}),
		// 双子界序(仅托勒密界·经典传本受影响):默认/0 不下发=忠原书零回归;1 才传(与卜卦 chartRequest 同口径)。
		...(fields.geminiBoundEmended && fields.geminiBoundEmended.value ? { geminiBoundEmended: 1 } : {}),
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
		// lotsDocReverse/nodeExaltation/saturnExalt20 三个 0/1 开关已并入
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

function shouldIncludePrimaryDirection(state){
	// primarydirsphere = WS-3 主限天球(3D):与表格/盘同吃 PD 数据(/chart 携带
	// predictives.primaryDirection),三件套登记之一(另两处:primaryDirectionSync
	// VALID_DIRECTION_SUB_TABS + jest 枚举断言)。
	return !!(
		state
		&& state.currentTab === 'direction'
		&& (state.currentSubTab === 'primarydirect'
			|| state.currentSubTab === 'primarydirchart'
			|| state.currentSubTab === 'primarydirsphere')
	);
}

function isValidChartResponse(rsp){
	return rsp !== undefined && rsp !== null && rsp.Result !== undefined && rsp.Result !== null;
}

// Mac issue #12 / Win #11 #14: 委托到 components/common/ChartServiceErrorModal 渲染富对话框
// (dva 的 model parser 不支持 JSX,所以 React 端必须放独立组件文件)。
// fallback 用经典 Modal.error 防止任何加载/导入异常导致用户拿不到反馈。
function showChartServiceError(extraDetail){
	// 先探活再定弹窗:服务在线但本次计算失败(如参数异常/超出星历数据域)≠「服务未就绪」。
	// 误报「未就绪」会把用户引向重启/防火墙排查,掩盖真实原因(全年份域工程实测坑)。
	try {
		fetch(`${ServerRoot}/horosaIdentity`, { method: 'GET' }).then((r) => {
			if(r && r.ok){
				Modal.error({
					title: '排盘失败：该时刻或参数计算失败',
					content: '本地服务在线,但此次排盘未能完成。常见原因:日期超出星历数据域(公元前 12999 ~ 公元 16799)、参数组合异常。请调整时间/参数后重试;若反复失败请反馈该时刻。',
				});
			}else{
				showChartServiceErrorRich(extraDetail);
			}
		}).catch(() => {
			showChartServiceErrorRich(extraDetail);
		});
	} catch(e) {
		Modal.error({ title: '排盘失败：本地排盘服务未就绪。请确认 Horosa 本地服务仍在运行后重试。' });
	}
}


function closeAllDrawer(msg){
	console.log(msg);
	const drawer = {
		query: false,
		selectplanet: false,
		selectchartdisplay: false,
		selectasp: false,
		selectorb: false,
		register: false,
		login: false,
		resetpwd: false,
		changepwd: false,
		changeparams: false,
		chartlist: false,
		chartedit: false,
		chartadd: false,
		caselist: false,
		caseedit: false,
		caseadd: false,
		chartdeeplearn: false,
		memo: false,
		chartsgps: false,
		commtools: false,
		homepage: false,
	};
	return drawer;
}

// doHook rAF 合并用:未执行的上一帧任务句柄(latest-wins,见 *doHook)。
let pendingHookFrame = null;
// 「点时间→出盘」快车道之世代号:每次 fetchByFields 递增;/chart 返回时若已非当代,
// 该响应作废(不 save 不弹错)——快速连拨时间时旧响应绝不覆写新状态(latest-wins)。
// 只在 fieldsFastCommit 开关开启时参与判定:关开关=连丢弃行为一起回到旧序。
let fieldsEpoch = 0;

// —— WP-P1 步进预取:主请求 settle 后,把「下一步」的盘预先算好塞进缓存 ——
// 步长套用与 DateTimeSelector 的 clickPlus/clickMinus 逐字节同法('m'档=±4 分钟);
// 深度 k 的时间必须【克隆后逐次 add*】(月末 clamp 与用户连点出的真序列一致,
// 1月31日+1M+1M=3月28日≠+2M —— 一步到位会臆造出用户永远点不出来的参数,预取即白打)。
function applyPrefetchStep(dt, unit, dir){
	if(unit === 'y'){ dt.addYear(dir); }
	else if(unit === 'M'){ dt.addMonth(dir); }
	else if(unit === 'd'){ dt.addDate(dir); }
	else if(unit === 'h'){ dt.addHour(dir); }
	else { dt.addMinute(4 * dir); }
	return dt;
}

function buildStepPrefetchTasks(fieldValues, stepHint, astroState){
	const dt0 = fieldValues && fieldValues.date && fieldValues.date.value;
	// 🔴 能力守卫必须查全步进方法,不能只查 clone:预取是优化,任何「不像 DateTime」的
	// 日期态(异常来源/测试替身)都必须让它整体静默让路,而不是把 TypeError 抛进
	// fetchByFields 主流程(全量 umi 抓过一次:mock date 缺 addMinute 直接崩主 saga)。
	if(!dt0 || typeof dt0.clone !== 'function'
		|| typeof dt0.addYear !== 'function' || typeof dt0.addMonth !== 'function'
		|| typeof dt0.addDate !== 'function' || typeof dt0.addHour !== 'function'
		|| typeof dt0.addMinute !== 'function'){
		return [];
	}
	// 计划(数组序 == 提交序):
	//   有向(用户已点 ±):[+1, -1, +2..+depth] —— 同向连点压倒性,反向覆盖「拨过头往回」;
	//     depth 缺省 2 时逐字节等于旧 [+1,+2,-1] 的提交序(tech+1,chart+1,tech-1,chart-1,chart+2,tech+2)。
	//   武装(PERF-R10 horosa_step_prefetch_arm_v1,dir=0 且带 depth):[±1, ±2, .. ±depth]
	//     对称交错(+ 先)—— 选完步长 +/− 概率对等,±1 即时命中,远窗吃空闲。
	//   旧调用(无 depth、无向):[±1] 各一,行为不变。
	const depth = stepHint && Number.isFinite(stepHint.depth)
		? Math.max(0, Math.min(5, Math.floor(stepHint.depth)))
		: 0;
	let plan;
	if(stepHint && stepHint.dir){
		const d = Math.max(2, depth || 2);
		plan = [{ k: 1, dir: stepHint.dir }, { k: 1, dir: -stepHint.dir }];
		for(let k = 2; k <= d; k += 1){
			plan.push({ k, dir: stepHint.dir });
		}
	}else if(depth > 0){
		plan = [];
		for(let k = 1; k <= depth; k += 1){
			plan.push({ k, dir: 1 });
			plan.push({ k, dir: -1 });
		}
	}else{
		plan = [{ k: 1, dir: 1 }, { k: 1, dir: -1 }];
	}
	const unit = (stepHint && stepHint.unit) || 'm';
	// 本地漏斗技法(紫微/遁甲)的武装:/chart 不在其步进路径上,预取它纯属浪费 —— 只做技法端点。
	const skipChart = !!(stepHint && stepHint.skipChart);
	// Phase B:当前技法登记的端点(kentang pan 等)——用技法自己的请求函数,落其自己的缓存。
	// 🔴 传给登记方的必须是【已步进到目标时间的 fields】(旧版传的是基准 fields,构出来的
	//    是「此刻」的参数 —— 与用户下一步要看的盘不是同一张,预取白打)。
	const extra = getStepPrefetcher(astroState.currentTab);
	const chartTasks = [];
	const techTasks = [];
	for(const pl of plan){
		// 整个单步构造包进 try:clone 出来的对象若丢了步进能力(能力守卫只能查 dt0 自身)、
		// 或构参路径抛任何异常,都只作废这一个占位 —— 预取构造永不外抛。
		let f2;
		let label;
		let param;
		try{
			let dt = dt0.clone();
			for(let i = 0; i < pl.k; i += 1){
				dt = applyPrefetchStep(dt, unit, pl.dir);
			}
			f2 = {
				...fieldValues,
				date: { ...fieldValues.date, value: dt },
				time: { ...fieldValues.time, value: dt },
			};
			label = `${pl.dir > 0 ? '+' : '-'}${pl.k}${unit}`;
			param = fieldsToParams(f2);   // 🔴 与正式请求同一构参路径 —— 缓存键逐字节同键是预取生效的唯一前提
		}catch(e){
			chartTasks.push(null);         // 非法日期(如越 startTime)静默跳过(占位保序)
			techTasks.push(null);
			continue;
		}
		param.cid = null;
		param.includePrimaryDirection = shouldIncludePrimaryDirection(astroState);
		if(skipChart){
			chartTasks.push(null);   // 本地漏斗武装:占位保序,只发技法端点
		}else{
			chartTasks.push({
				name: `chart${label}`,
				path: '/chart',
				// silent+零重试:预取失败静默、绝不退避风暴;结果自动进 chartMem+requestDedupe
				run: ()=> service.fetchChart(param, { silent: true, retry: { retries: 0 } }),
			});
		}
		let mine = null;
		if(extra){
			try{
				const more = extra(f2, stepHint);
				if(Array.isArray(more) && more.length){
					mine = more.map((t)=>({ ...t, name: `${(t && t.name) || 'tech'}${label}` }));
				}
			}catch(e){ /* 技法预取器出错不碍主流程 */ }
		}
		techTasks.push(mine);
	}
	// PERF-R9 Ship 7 排序结论保持「排序即价值」:近窗(k==1)技法端点先于 chart(非占星页
	// gate 面板的是技法端点,旧序 chart 在前时技法任务恒被预算砍掉);远窗(k>=2)chart 先把
	// 共享底盘备好、技法端点跟队。plan 数组序即提交序,经典有向 [+1,-1,+2] 在此规则下的输出
	// 与旧实现([技法+1, chart+1, 技法-1, chart-1, chart+2, 技法+2])逐字节同序。
	const tasks = [];
	const emit = (arr, idx)=>{
		const v = arr[idx];
		if(!v){ return; }
		if(Array.isArray(v)){ tasks.push(...v); return; }
		tasks.push(v);
	};
	for(let i = 0; i < plan.length; i += 1){
		if(plan[i].k <= 1){
			emit(techTasks, i);
			emit(chartTasks, i);
		}else{
			emit(chartTasks, i);
			emit(techTasks, i);
		}
	}
	return tasks;
}

// [R3-A1] 选步长即预取处理器:DateTimeSelector 选定步长档(opt-in 宿主)→ 以 store 现
// fields 双向 ±1、±2 预取(键构造与真点同源 = buildStepPrefetchTasks 唯一路径)。
// 无 store/无 fields(启动早期/测试)静默跳过;预算 4 任务(调度器硬顶 5)。
registerStepSelectHandler((unit)=>{
	const store = getStore();
	if(!store || !store.astro || !store.astro.fields){
		return;
	}
	const st = store.astro;
	// horosa_step_prefetch_arm_v1(Windows 武装引擎接管上游触发线):
	// · 上游触发面(opt-in 宿主 + 5s 去重)保持原样;此处把「±2 固定窗」升级为
	//   ±stepPrefetchDepth 全窗(默认 3;技法端点任务随 chart 一起构造,见 builder);
	// · reportStepUnit 记录该技法最近档位 —— settle 兜底武装(无 stepHint 分支)靠它
	//   取档,「不选步长直接点 ±」的第一下也命中;
	// · NO_ARM 技法(随机/取现时/流式/浏览型)由 shouldArmForTab 拦下,零任务。
	if(!(stepPrefetchArmEnabled() && shouldArmForTab(st.currentTab))){
		return;
	}
	reportStepUnit(st.currentTab, unit);
	submitStepPrefetch(
		buildStepPrefetchTasks(st.fields, { unit, dir: 0, depth: stepPrefetchDepth() }, st)
	);
});

function hooking(hook, currentTab, fields, chartObj){
	if(currentTab === 'indiachart' || currentTab === 'locastro'
		|| currentTab === 'hellenastro' || currentTab === 'guolao'
		|| currentTab === 'germanytech' || currentTab === 'jieqichart'
		|| currentTab === 'cntradition' || currentTab === 'cnyibu' || currentTab === 'otherbu'
		|| currentTab === 'fengshui' || currentTab === 'sanshiunited' || currentTab === 'aianalysis'
		|| currentTab === 'bazi' || currentTab === 'ziwei' || currentTab === 'guazhan'
		|| currentTab === 'liureng' || currentTab === 'dunjia' || currentTab === 'taiyi'
		|| currentTab === 'shusuan' || currentTab === 'yanqin' || currentTab === 'mingother'
		|| currentTab === 'auxchart' || currentTab === 'planetarium'){
		if(hook[currentTab].fun){
			hook[currentTab].fun(fields, chartObj)
		}
	}else if(currentTab === 'direction'){
		if(hook[currentTab].fun){
			hook[currentTab].fun(chartObj);
		}
	}else if(currentTab === 'astroreader'){
		if(hook[currentTab].fun){
			hook[currentTab].fun();
		}
	}

}

let now = new DateTime();

// 具名导出(仅供金标):键等性锁要机械验证「预取构出的 param ≡ 用户真点会发出的 param」,
// 私有函数测不到 —— 导出不改任何运行时行为(dva 只吃 default)。
export { fieldsToParams as __fieldsToParamsForTest, buildStepPrefetchTasks as __buildStepPrefetchTasksForTest };

// PERF-R10 horosa_step_prefetch_arm_v1:把任务构造器注入武装模块(utils 不反向 import models)。
// 选步长/切页/本地漏斗 settle 的武装全部经由它,与真点步进共用同一 fieldsToParams 路径 ——
// 「预取参数与用户真点逐字节同键」的纪律因此自动继承。
registerArmPlanBuilder((fieldValues, hint, astroState)=>buildStepPrefetchTasks(fieldValues, hint, astroState));

// PERF-R10 horosa_option_prefetch_v1:选项投机的 /chart 变体任务构造器 —— 与真点/步进预取
// 共用同一 fieldsToParams 路径(键逐字节同是命中的唯一前提)。
registerOptionChartTaskBuilder((variantFields, astroState)=>{
	const param = fieldsToParams(variantFields);
	param.cid = null;
	param.includePrimaryDirection = shouldIncludePrimaryDirection(astroState);
	return {
		name: 'chart',
		path: '/chart',
		run: ()=> service.fetchChart(param, { silent: true, retry: { retries: 0 } }),
	};
});

export default { 
	namespace: 'astro',
	state:{
		height: 660,
		chartObj: null,
		drawerVisible: closeAllDrawer('init'),
		currentTab: 'astrochart',
		currentSubTab: null,
		currentChart: null,
		memoType: 0,
		memo: '',

		deeplearn: null,

		predictHook:{
			astrochart:{
				fun: null
			},
			bazi:{
				fun: null
			},
			ziwei:{
				fun: null
			},
			planetarium:{
				fun: null
			},
			planetarium:{
				fun: null
			},
			direction:{
				fun: null
			},
			profection:{
				fun: null
			},
			solararc:{
				fun: null
			},
			solarreturn:{
				fun: null
			},
			zodialrelease:{
				fun: null
			},
			locastro:{
				fun: null
			},
			hellenastro:{
				fun: null
			},
			indiachart:{
				fun: null
			},
			relativechart:{
				fun: null
			},
			germanytech:{
				fun: null
			},
			auxchart:{
				fun: null
			},
			jieqichart:{
				fun: null
			},
			cntradition:{
				fun: null
			},
			cnyibu:{
				fun: null
			},
			guazhan:{
				fun: null
			},
			liureng:{
				fun: null
			},
			dunjia:{
				fun: null
			},
			taiyi:{
				fun: null
			},
			shusuan:{
				fun: null
			},
			yanqin:{
				fun: null
			},
			mingother:{
				fun: null
			},
			calendar:{
				fun: null
			},
			otherbu:{
				fun: null
			},
			fengshui:{
				fun: null
			},
			sanshiunited:{
				fun: null
			},
			aianalysis:{
				fun: null
			},
			astroreader:{
				fun: null
			},
			admintools:{
				fun: null
			},
			guolao:{
				fun: null
			},

		},

		// [2026-07 五批] fields 初始态单源化:此前是与 newEmptyFields() 平行的手写字面量,
		// 缺 27 键(全部古典播种键 + guolao/india 键)→ app 启动首发 nowChart 链拿到的 fields
		// 无播种键,「设置→星盘设置」全局偏好在重启后对主页首发盘全部失效(直到抽屉再改一次
		// 被 applyClassicalField patch 救回)。单源 = newEmptyFields()(种子读全局仓);
		// 仅时间四键保留原字面量语义(date 归零到当日 00:00 的 startOf 口径)。
		fields: {
			...newEmptyFields(),
			ad: { value: now.ad, name: ['ad'] },
			date: { value: now.startOf('date'), name: ['date'] },
			time: { value: now.clone(), name: ['time'] },
			zone: { value: now.zone, name: ['zone'] },
		},
	},
	

	reducers: {
		save(state, {payload: values}){
			// [R3-A2 中央防漏网] __stepHint 是「步进方向提示」瞬态字段,只供 fetchByFields
			// 消费(其内已剥);个别宿主(紫微/八字/三式 syncFields)把 patch 原样 save ——
			// 在唯一入口统一剥离,保证它永不落 redux/存档。
			if(values && values.fields && Object.prototype.hasOwnProperty.call(values.fields, '__stepHint')){
				const { __stepHint, ...cleanFields } = values.fields;
				values = { ...values, fields: cleanFields };
			}
			let st = { ...state, ...values, };
			let tab = values.currentTab ? values.currentTab : state.currentTab;
			let subtab = values.currentSubTab ? values.currentSubTab : state.currentSubTab;

			if(values.currentChart){
				return st;
			}

			const currentChart = state.currentChart;
			if(currentChart === undefined || currentChart === null){
				return st;
			}

			if(tab && (values.memoType === undefined || values.memoType === null)){
				let type = 0;
				let memo = currentChart.memoAstro.value;
				if(tab === 'bazi'){
					type = 1;
					memo = currentChart.memoBaZi.value;
				}else if(tab === 'ziwei'){
					type = 2;
					memo = currentChart.memoZiWei.value;
				}else if(tab === 'guazhan'){
					type = 4;
					memo = currentChart.memoGua.value;
				}else if(tab === 'liureng'){
					type = 5;
					memo = currentChart.memoLiuReng.value;
				}else if(tab === 'dunjia' || tab === 'taiyi'){
					type = 6;
					memo = currentChart.memoQiMeng.value;
				}else if(tab === 'cntradition'){
					if(subtab && subtab === 'bazi'){
						type = 1;
						memo = currentChart.memoBaZi.value;
					}else if(subtab && subtab === 'ziwei'){
						type = 2;
						memo = currentChart.memoZiWei.value;
					}else if(subtab && subtab === '74'){
						type = 3;
						memo = currentChart.memo74.value;
					}else{
						type = 2;
						memo = currentChart.memoZiWei.value;
					}
				}else if(tab === 'cnyibu'){
					if(subtab && subtab === 'suzhan'){
						type = 7;
						memo = currentChart.memoSuZhan.value;
					}else if(subtab && subtab === 'guazhan'){
						type = 4;
						memo = currentChart.memoGua.value;
					}else if(subtab && subtab === 'liureng'){
						type = 5;
						memo = currentChart.memoLiuReng.value;
					}else if(subtab && subtab === 'jinkou'){
						type = 5;
						memo = currentChart.memoLiuReng.value;
					}else{
						type = 4;
						memo = currentChart.memoGua.value;
					}
				}else if(tab === 'guolao'){
					type = 3;
					memo = currentChart.memo74.value;
				}
				st.memoType = type;	
				st.memo = memo;
			}else if(values.memoType !== undefined && values.memoType !== null && 
				(values.byChartData === undefined || values.byChartData === null)){
				let type = values.memoType;
				let memo = currentChart.memoAstro.value;
				if(type === 1){
					memo = currentChart.memoBaZi.value;
				}else if(type === 2){
					memo = currentChart.memoZiWei.value;
				}else if(type === 3){
					memo = currentChart.memo74.value;
				}else if(type === 4){
					memo = currentChart.memoGua.value;
				}else if(type === 5){
					memo = currentChart.memoLiuReng.value;
				}else if(type === 6){
					memo = currentChart.memoQiMeng.value;
				}else if(type === 7){
					memo = currentChart.memoSuZhan.value;
				}
				st.memo = memo;
			}

			if(values.memo){
				st.memo = values.memo;
			}

			return st;
		},

		syncAfter23NewDay(state, { payload }){
			const value = payload && payload.after23NewDay;
			if(value !== 0 && value !== 1) return state;
			// 用户拍板: 左栏改过 after23NewDay 后,全局同步不再覆盖(最高权限)。
			// _after23BoundaryUserOverrode 由各 Main 在用户改局部下拉时通过 setAfter23BoundaryUserOverrode reducer 写入。
			if(state && state._after23BoundaryUserOverrode) return state;
			const next = { ...state };
			if(next.fields && next.fields.after23NewDay){
				next.fields = {
					...next.fields,
					after23NewDay: { ...next.fields.after23NewDay, value },
				};
			}
			return next;
		},

		syncLateZiHourMode(state, { payload }){
			const value = payload && payload.lateZiHourUseNextDay;
			if(value !== 0 && value !== 1) return state;
			// v2.2.1: 用户拍板 — 左栏改过 lateZiHourUseNextDay 后,全局同步不再覆盖(最高权限)。
			// _lateZiHourUserOverrode 由各 Main 在用户改局部下拉时通过 setLateZiHourUserOverrode reducer 写入。
			if(state && state._lateZiHourUserOverrode) return state;
			const next = { ...state };
			if(next.fields && next.fields.lateZiHourUseNextDay){
				next.fields = {
					...next.fields,
					lateZiHourUseNextDay: { ...next.fields.lateZiHourUseNextDay, value },
				};
			}
			return next;
		},

		setAfter23BoundaryUserOverrode(state, { payload }){
			// 由 Main 组件在用户改局部下拉时 dispatch,锁定主盘 fields 不被全局事件覆盖(共享 fields 路径)。
			return { ...state, _after23BoundaryUserOverrode: !!(payload && payload.value) };
		},

		setLateZiHourUserOverrode(state, { payload }){
			// v2.2.1 同款语义:左栏改过 lateZiHourUseNextDay 后,锁定不被全局事件覆盖。
			return { ...state, _lateZiHourUserOverrode: !!(payload && payload.value) };
		},
	},

	effects: {
		*closeDrawer({ payload: values }, { call, put }){
			let drawer = closeAllDrawer('*closeDrawer');
            yield put({
                type: 'save',
                payload: {  
					drawerVisible: drawer,
                },
            });

		},

		*openDrawer({ payload: values }, { call, put, select }){
			let drawer = closeAllDrawer('*openDrawer');
			drawer[values.key] = true;

            yield put({
                type: 'save',
                payload: {  
					drawerVisible: drawer,
                },
            });

			if(values.key === 'register' || values.key === 'resetpwd'){
				yield put({
					type: 'app/fetchImgToken',
					payload: { },
				});	
			}else if(values.key === 'chartadd'){
				yield put({
					type: 'user/newCurrentChart',
					payload: values.record ? values.record : { },
				});
			}else if(values.key === 'chartlist'){
				yield put({
					type: 'user/fetchCharts',
					payload: { },
				});
			}else if(values.key === 'caselist'){
				yield put({
					type: 'user/fetchCases',
					payload: { },
				});
			}else if(values.key === 'caseadd'){
				yield put({
					type: 'user/newCurrentCase',
					payload: values.record ? values.record : {},
				});
			}else if(values.key === 'caseedit'){
				let record = values.record;
				if(record){
					yield put({
						type: 'user/setCurrentCase',
						payload: {
							...values.record,
							drawerVisible: drawer,
						},
					});
				}else{
					const userstate = yield select((s)=>s.user);
					if(userstate.currentCase && userstate.currentCase.cid && userstate.currentCase.cid.value){
						let caze = userstate.currentCase;
						record = {
							cid: caze.cid.value,
							event: caze.event.value,
							caseType: caze.caseType.value,
							divTime: caze.divTime.value,
							zone: caze.zone.value,
							lat: caze.lat.value,
							lon: caze.lon.value,
							gpsLat: caze.gpsLat.value,
							gpsLon: caze.gpsLon.value,
							pos: caze.pos.value,
							isPub: caze.isPub.value,
							creator: caze.creator.value,
							updateTime: caze.updateTime.value,
							group: caze.group.value,
							payload: caze.payload.value,
							sourceModule: caze.sourceModule.value,
							drawerVisible: drawer,
						};
						yield put({
							type: 'user/setCurrentCase',
							payload: record,
						});
					}else{
						yield put({
							type: 'openDrawer',
							payload: {
								key: 'caseadd',
							},
						});
					}
				}
			}else if(values.key === 'chartdeeplearn'){
				let record = values.record;
				if(record){
					yield put({
						type: 'fetchFateEvents',
						payload: record,
					});		
				}else{
					const userstate = yield select((s)=>s.user);
					if(userstate.currentChart.cid.value && userstate.currentChart.cid.value !== ''){
						let chart = userstate.currentChart;
						let tm = chart.birth.value.clone();
						record = {
							birth: tm,
							zone: chart.zone.value,
							ad: tm.ad,
							lat: chart.lat.value,
							lon: chart.lon.value,
							gpsLat: chart.gpsLat.value,
							gpsLon: chart.gpsLon.value,
							name: chart.name.value,
							pos: chart.pos.value,
							gender: parseInt(chart.gender.value + ''),
							isPub: chart.isPub.value,
							cid: chart.cid.value,
							creator: chart.creator.value,
							updateTime: chart.updateTime.value,
							group: chart.group.value,
						};
						yield put({
							type: 'fetchFateEvents',
							payload: record,
						});			
					}
				}
			}else if(values.key === 'chartedit'){
				let record = values.record;
				if(record){
					yield put({
						type: 'user/setCurrentChart',
						payload: {
							...values.record, 
							drawerVisible: drawer
						},
					});		
				}else{
					const userstate = yield select((s)=>s.user);
					if(userstate.currentChart.cid.value && userstate.currentChart.cid.value !== ''){
						let chart = userstate.currentChart;
						let tm = chart.birth.value.clone();
						record = {
							birth: tm,
							zone: chart.zone.value,
							ad: tm.ad,
							lat: chart.lat.value,
							lon: chart.lon.value,
							gpsLat: chart.gpsLat.value,
							gpsLon: chart.gpsLon.value,
							name: chart.name.value,
							pos: chart.pos.value,
							gender: parseInt(chart.gender.value + ''),
							isPub: chart.isPub.value,
							cid: chart.cid.value,
							creator: chart.creator.value,
							updateTime: chart.updateTime.value,
							group: chart.group.value,
							memoAstro: chart.memoAstro.value,
							memoBaZi: chart.memoBaZi.value,
							memoZiWei: chart.memoZiWei.value,
							memo74: chart.memo74.value,
							memoGua: chart.memoGua.value,
							memoLiuReng: chart.memoLiuReng.value,
							memoQiMeng: chart.memoQiMeng.value,
							memoSuZhan: chart.memoSuZhan.value,
							payload: chart.payload ? chart.payload.value : null,
							sourceModule: chart.sourceModule ? chart.sourceModule.value : null,
							chartType: chart.chartType ? chart.chartType.value : null,
							drawerVisible: drawer,
						};
						yield put({
							type: 'user/setCurrentChart',
							payload: record,
						});			
					}else{
						yield put({
							type: 'openDrawer',
							payload: {
								key: 'chartadd',
							},
						});			
					}
		
				}
			}else if(values.key === 'planetselect'){

			}else if(values.key === 'statistic'){

			}else if(values.key === 'homepage'){

			}

		},


		// perf T-6(speculativePrecompute):排盘表单编辑期的「只暖缓存」预计算。参数构造与
		// 下方 *fetch 逐字节一致(date/time/ad/zone/cid + includePrimaryDirection),但结果只进
		// services/astro 的 chartMem/chartInflight —— 不落任何 state、不关抽屉、不触发 hook、
		// 不弹错误。用户点「提交」时 *fetch 的 fetchChart 直接命中缓存或加入在途请求 →
		// 点击→显示 ≈ 渲染耗时。任何失败静默(投机性质,正式路径行为不变)。
		*precomputeFetch({ payload: values }, { call, select }){
			try{
				if(!speculativePrecomputeEnabled()){ return; }
				if(!values || !values.date || typeof values.date.format !== 'function'){ return; }
				if(values.lon === undefined || values.lon === null || values.lon === ''
					|| values.lat === undefined || values.lat === null || values.lat === ''){
					return; // 表单未填完整,预取无意义(且避免以半参数占缓存槽)
				}
				const param = {
					...values,
					date: values.date.format('YYYY/MM/DD'),
					time: values.date.format('HH:mm:ss'),
					ad: values.date.ad,
					zone: values.date.zone,
					cid: null,
				};
				if(param.pdaspects && param.pdaspects instanceof String){
					param.pdaspects = JSON.parse(param.pdaspects);
				}
				const astroState = yield select((state)=>state.astro);
				param.includePrimaryDirection = shouldIncludePrimaryDirection(astroState);
				yield call(service.fetchChart, param, { silent: true, disableLoading: true });
			}catch(e){
				// speculative only — never surface
			}
		},

		*fetch({ payload: values }, { call, put, select }){
			const param = {
				...values,
				date: values.date.format('YYYY/MM/DD'),
				time: values.date.format('HH:mm:ss'),
				ad: values.date.ad,
				zone: values.date.zone,
				cid: null,
			};

			if(param.pdaspects && param.pdaspects instanceof String){
				param.pdaspects = JSON.parse(param.pdaspects);
			}
			const astroState = yield select((state)=>state.astro);
			param.includePrimaryDirection = shouldIncludePrimaryDirection(astroState);

			const rsp = yield call(service.fetchChart, param);
			if(!isValidChartResponse(rsp)){
				showChartServiceError();
				return;
			}
			const Result = rsp.Result;
			Result.params.name = values.name;
			Result.params.pos = values.pos;
			Result.chartId = randomStr(8);
			saveAstroAISnapshotLazy(Result, values);

			let drawer = closeAllDrawer('*fetch');

            yield put({
                type: 'save',
                payload: {
					chartObj: Result,
					drawerVisible: drawer,
                },
            });
			markChartRefreshEnd();

			if(values.nohook){
				return;
			}

            const state = yield select((s)=>s.astro);
			yield put({
                type: 'doHook',
                payload: {  
					chartObj: Result,
					fields: state.fields,
                },
            });
		},

		*fetchByChartData({ payload: values }, { call, put, select }){
            const state = yield select((s)=>s.astro);
			// 载入还原（不可变）：record 里保存的每个排盘选项键按 RECORD_FIELDS_RESTORE_MANIFEST 条件还原
			// （record 缺键=保持当前值，legacy 零冲击）；命中键与下方核心键一律写「新 entry」——
			// 旧实现 {...state.fields} 后就地改共享 entry，① 组件层 prevProps 与 props 同对象、值比对失明,
			// ② /chart 失败时 state 已被改一半（脏写）。清单见 utils/recordFieldsRestore.js（哨兵守全枚举）。
			const fields = applyRecordToFields(state.fields, values);
			const setF = (key, value)=>{ fields[key] = { ...(fields[key] || { name: [key] }), value }; };

			let tm = new DateTime();
			tm.parse(values.birth, 'YYYY-MM-DD HH:mm:ss');
			// 🔴 ad 权威 = birth 串前导负号(birth 由 format('YYYY-MM-DD') 产出,必然反映 date.value.ad)。
			// record.ad 可能与 birth 不同步(存量 BC 记录 ad 误存 1 → 旧式 setAd(1) 把 BC 强转成 AD 12026,
			// 与当前显示恰好相同 → 载入"时间不变/无反应")。故负号带 -1 时优先,别被错误 record.ad 覆盖。
			const birthIsBc = typeof values.birth === 'string' && values.birth.trim().charAt(0) === '-';
			tm.setAd(birthIsBc ? -1 : (values.ad ? values.ad : 1));
			tm.setZone(values.zone);

			setF('cid', values.cid);
			setF('date', tm);
			setF('time', tm);
			setF('zone', tm.zone);
			setF('lat', values.lat);
			setF('lon', values.lon);
			setF('name', values.name);
			setF('pos', values.pos);
			setF('ad', tm.ad);

			const param = fieldsToParams(fields);
			const astroState = yield select((allState)=>allState.astro);
			param.includePrimaryDirection = shouldIncludePrimaryDirection(astroState);
			const rsp = yield call(service.fetchChart, param);
			if(!isValidChartResponse(rsp)){
				showChartServiceError();
				return;
			}
			const Result = rsp.Result;
			Result.params.name = values.name;
			Result.params.pos = values.pos;
			Result.chartId = randomStr(8);
			saveAstroAISnapshotLazy(Result, fields);

			// memo×8：无条件覆盖语义（record 无备注 = 清空该备注），与还原键的条件语义不同，故留手工。
			setF('memo74', values.memo74);
			setF('memoBaZi', values.memoBaZi);
			setF('memoZiWei', values.memoZiWei);
			setF('memoAstro', values.memoAstro);
			setF('memoGua', values.memoGua);
			setF('memoLiuReng', values.memoLiuReng);
			setF('memoQiMeng', values.memoQiMeng);
			setF('memoSuZhan', values.memoSuZhan);

			let type = state.memoType;
			let memo = '';
			if(type === 0){
				memo = fields.memoAstro.value;
			}else if(type === 1){
				memo = fields.memoBaZi.value;
			}else if(type === 2){
				memo = fields.memoZiWei.value;
			}else if(type === 3){
				memo = fields.memo74.value;
			}else if(type === 4){
				memo = fields.memoGua.value;
			}else if(type === 5){
				memo = fields.memoLiuReng.value;
			}else if(type === 6){
				memo = fields.memoQiMeng.value;
			}else if(type === 7){
				memo = fields.memoSuZhan.value;
			}
			yield put({
                type: 'save',
                payload: {
					chartObj: Result,
					fields: fields,
					byChartData: true,
					memo: memo,
					memoType: type,
                },
            });
			markChartRefreshEnd();
			// horosa_boot_chart_restore_v1(载入命盘也刷新现场)。util 内部构不出合法 record
			// 会自答 null,此处仍包 try:快照是优化,任何异常不许碰载入主流程。
			try{
				saveBootChartSnapshot(fields, state.currentTab);
			}catch(e){ /* optimization only — never surface */ }

			if(values.nohook){
				return;
			}

			yield put({
                type: 'doHook',
                payload: {
					chartObj: Result,
					fields: fields,
					drawerVisible: values.drawerVisible,
                },
            });

			if(values.drawerVisible){
				yield put({
					type: 'save',
					payload: {  
						drawerVisible: values.drawerVisible,
					},
				});	
			}
		},

		*fetchByFields({ payload: values }, { call, put, select }){
			const requestOptions = values && values.__requestOptions && typeof values.__requestOptions === 'object'
				? values.__requestOptions
				: { silent: true };
			const fieldValues = {
				...(values || {}),
			};
			if(Object.prototype.hasOwnProperty.call(fieldValues, '__requestOptions')){
				delete fieldValues.__requestOptions;
			}
			// 步进方向提示(WP-P1):只驱动 settle 后的预取,同 __requestOptions 一样绝不落 state.fields
			const stepHint = fieldValues.__stepHint;
			if(Object.prototype.hasOwnProperty.call(fieldValues, '__stepHint')){
				delete fieldValues.__stepHint;
			}
			const param = fieldsToParams(fieldValues);
			param.cid = null;
			const astroState = yield select((state)=>state.astro);
			param.includePrimaryDirection = shouldIncludePrimaryDirection(astroState);
			// [A8 生产接线] 交互真尺:改动进入 → compute(响应/提交)→ commit(rAF 渲染近似)。
			// 取消/失败路径不记(避免把 stale 响应算进延迟分布)。
			const pm = perfBegin(astroState.currentTab || 'chart', stepHint ? `step:${stepHint.unit}` : 'fields');

			// —— 「点时间→出盘」快车道(2026-07 极速化大修) ——
			// 病根:此前 fields 的 save 排在 /chart 网络之后 → 纯本地技法(八字/数算/风水…)
			// 也被迫等一次网络(实测热态 229ms 占总延迟 70%),网络失败则 fields 根本不更新。
			// 修法:当前 tab 的 hook 自述 chartFree(=本页中右栏不消费 chartObj)时,fields 立即
			// 提交+立即 doHook —— 本地技法一次性整体出(<100ms);/chart 照发,回来单独补 chartObj。
			// 非 chartFree 页维持「到齐才 save{fields+chartObj}」的原子性(逐字节旧序),但先把
			// 本页的请求集并行预热(prewarm,silent,经 requestDedupe 在途共享)→ latency=max 而非 sum。
			const fastCommitOn = fieldsFastCommitEnabled();
			const epoch = fastCommitOn ? ++fieldsEpoch : 0;
			const activeHook = astroState.predictHook && astroState.predictHook[astroState.currentTab];
			const fastPath = fastCommitOn && !!(activeHook && activeHook.chartFree === true);

			let fld = {
				...fieldValues,
				nohook: false,
			}

			if(fastPath){
				yield put({
					type: 'save',
					payload: { fields: fld },
				});
				pm.computed();
				if(!values.nohook){
					// 喂旧 chartObj:chartFree 契约=hook 不读它(有静态哨兵守),只用 fields。
					yield put({
						type: 'doHook',
						payload: { chartObj: astroState.chartObj, fields: fld },
					});
					pm.committed();
				}
			}else if(fastCommitOn && prewarmRequestsEnabled() && activeHook && typeof activeHook.prewarmRequests === 'function'){
				// fire-and-forget:组件自述的预热函数(silent 请求),失败静默——正式请求照常兜底。
				try{ activeHook.prewarmRequests(fld); }catch(e){ /* 预热失败无害 */ }
			}

			const rsp = yield call(service.fetchChart, param, requestOptions);
			if(fastCommitOn && epoch !== fieldsEpoch){
				// 已有更新的一次时间变更在途/完成 —— 本响应作废,静默丢弃(连错误弹窗也不弹:
				// 旧请求失败不该打断用户正在进行的新操作;新请求自有其成败路径)。
				return;
			}
			if(!isValidChartResponse(rsp)){
				showChartServiceError();
				return;
			}
			const Result = rsp.Result;
			if(!fastPath){ pm.computed(); }
			Result.params.name = fieldValues.name.value;
			Result.params.pos = fieldValues.pos.value;
			if(fieldValues.orbs && fieldValues.orbs.value){ Result.params.orbs = fieldValues.orbs.value; }
			if(fieldValues.orbScale && fieldValues.orbScale.value){ Result.params.orbScale = fieldValues.orbScale.value; }
			Result.chartId = randomStr(8);
			saveAstroAISnapshotLazy(Result, fieldValues);

			if(fastPath){
				// fields 已先行提交且引用未变 —— 只补 chartObj,不重放 fields(免二次 didUpdate)、
				// 不重发 doHook(chartFree 页不消费 chartObj;其余页由各自 tab 切换签名兜底)。
				yield put({
					type: 'save',
					payload: { chartObj: Result },
				});
				// horosa_interaction_span_v1(PERF-R9 Ship 0a):快车道过去在这里直接 return,
				// **从不打 refresh-end** —— 而 chartObj.chartId 变了,pages/index.js 的
				// render-complete 照样触发,于是它拿上一次的陈旧 end 做起点,八字/紫微/数算
				// 三族一直在报**伪造**的渲染时间。补上这一行,三族的观测才是真的。
				markChartRefreshEnd();
				// 快照+武装+投机全是优化:整块 try —— 任何异常静默,绝不许碰快车道主流程。
				try{
					saveBootChartSnapshot(fieldValues, astroState.currentTab);   // horosa_boot_chart_restore_v1
					if(stepHint){
						// settle 后预取「下一步」:用户已停手+主盘已回,天然错峰(风暴防护在调度器内)
						reportStepUnit(astroState.currentTab, stepHint.unit);
						submitStepPrefetch(buildStepPrefetchTasks(fieldValues, { ...stepHint, depth: stepPrefetchDepth() }, astroState));
					}else if(stepPrefetchArmEnabled() && shouldArmForTab(astroState.currentTab)){
						// PERF-R10 horosa_step_prefetch_arm_v1:无向 settle(初盘/确定/改设置/切回)
						// 也武装当前档位 ±depth —— 单位取该技法最近一次选择/步进的档位,不再硬编码 'm',
						// 于是「不选步长直接点 ±」的第一下也命中。
						submitStepPrefetch(buildStepPrefetchTasks(fieldValues, { unit: currentStepUnit(astroState.currentTab), dir: 0, depth: stepPrefetchDepth() }, astroState));
					}
					// horosa_option_prefetch_v1:选项二值轴的 Hamming-1 变体走空闲通道(与步进泵分队)。
					speculateChartOptions(fieldValues, astroState);
				}catch(e){ /* optimization only — never surface */ }
				return;
			}

            yield put({
                type: 'save',
                payload: {
					chartObj: Result,
					fields: fld,
                },
            });
			markChartRefreshEnd();
			try{
				saveBootChartSnapshot(fieldValues, astroState.currentTab);   // horosa_boot_chart_restore_v1
			}catch(e){ /* optimization only — never surface */ }

			if(values.nohook){
				return;
			}

			yield put({
                type: 'doHook',
                payload: {
					chartObj: Result,
					fields: fld,
                },
            });
			pm.committed();

			// 同快车道分支:优化整块 try,异常静默不碰主流程。
			try{
				if(stepHint){
					reportStepUnit(astroState.currentTab, stepHint.unit);
					submitStepPrefetch(buildStepPrefetchTasks(fieldValues, { ...stepHint, depth: stepPrefetchDepth() }, astroState));
				}else if(stepPrefetchArmEnabled() && shouldArmForTab(astroState.currentTab)){
					// 同快车道分支:无向 settle 也武装(horosa_step_prefetch_arm_v1)。
					submitStepPrefetch(buildStepPrefetchTasks(fieldValues, { unit: currentStepUnit(astroState.currentTab), dir: 0, depth: stepPrefetchDepth() }, astroState));
				}
				// horosa_option_prefetch_v1:同快车道分支。
				speculateChartOptions(fieldValues, astroState);
			}catch(e){ /* optimization only — never surface */ }

		},

		*doHook({ payload: values }, { call, put }){
			// rAF 化(流畅度):hooking 同步遍历 predictHook 命令式刷新各技法面板,曾与主盘渲染
			// 挤在同一帧。改为下一帧执行:主盘先上屏,技法面板随后刷新;cancel 上一帧未执行的
			// 任务(latest-wins,连发只跑最后一次)。predictHook/currentTab 在回调时刻重读
			// (防延迟一帧后打到已切走的 tab/已注销的 hook);fields/chartObj 用触发时 payload
			// (数据正确性)。已核查全部 5 个 dispatch 点之后均无依赖 hooking 同步完成的代码。
			const runHooking = ()=>{
				// rAF 回调内不可 yield select;getStore 需守卫(RootLayout 首渲染前为空,同 app.js 修法)
				const store = getStore();
				if(!store || !store.astro){
					return;
				}
				const state = store.astro;
				hooking(state.predictHook, state.currentTab, values.fields, values.chartObj);
			};
			if(hookRafEnabled() && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'){
				if(pendingHookFrame !== null){
					window.cancelAnimationFrame(pendingHookFrame);
				}
				pendingHookFrame = window.requestAnimationFrame(()=>{
					pendingHookFrame = null;
					runHooking();
				});
				return;
			}
			runHooking();
		},

		// 「重算当前」/「重算星盘」用这个:拿状态里已录的 fields 重排。
		// 从前这两个入口都 dispatch nowChart 且 payload 为空 → nowChart 内 fields===undefined
		// 就走 newEmptyFields()(=此刻新盘),于是按钮名写着「重算」、行为却是把已录生辰清成当下,
		// 误点即丢盘。起此刻新盘仍走 nowChart 空 payload(「新命盘」按钮的语义)。
		*recalcChart(_, { put, select }){
			const st = yield select((s)=>s.astro);
			yield put({ type: 'nowChart', payload: { fields: st && st.fields ? st.fields : undefined } });
		},
		*nowChart({ payload: values }, { call, put, select }){
			let fields = values.fields;
			if(fields === undefined || fields === null){
				fields = newEmptyFields();
			}
			const param = fieldsToParams(fields);
			const astroState = yield select((state)=>state.astro);
			param.includePrimaryDirection = shouldIncludePrimaryDirection(astroState);

			const rsp = yield call(service.fetchChart, param);
			if(!isValidChartResponse(rsp)){
				showChartServiceError();
				return;
			}
			const Result = rsp.Result;
			Result.chartId = randomStr(8);
			// 确保「基本信息」名称/地点反映当前输入 fields(后端参数白名单可能不回显 name/pos → 跳转后无需手动按确定即同步)
			if(!Result.params){ Result.params = {}; }
			if(fields && fields.name){ Result.params.name = fields.name.value; }
			if(fields && fields.pos){ Result.params.pos = fields.pos.value; }
			saveAstroAISnapshotLazy(Result, fields);

			let drawer = closeAllDrawer('*nowChart');
            yield put({
                type: 'save',
                payload: {  
					fields: fields,
					chartObj: Result,
					drawerVisible: drawer,
                },
            });

            const state = yield select((s)=>s.astro);
			let hook = state.predictHook;
			hooking(hook, state.currentTab, fields, Result);

		},

		*setHomePage({ payload: values }, { call, put, select }){
			if(values.path === undefined || values.path === null){
				return;
			}

			let path = values.path;
			if(path[0] === 'astroreader'){
				const userState = yield select((s)=>s.user);
				if(userState.userInfo === undefined || userState.userInfo === null){
					yield put({
						type: 'save',
						payload: {
							currentTab: 'astrochart',
						},
					});		
					return;
				}	
			}

			let payload = {
				currentTab: path[0],
			};
			if(path.length > 1){
				payload.currentSubTab = path[1];
			}

			yield put({
				type: 'save',
				payload: payload,
			});

		},

		*fetchFateEvents({ payload: values }, { call, put }){
			yield put({
				type: 'user/setCurrentChart',
				payload: {
					...values,
					skipFetchByChartData: true,
				},
			});		

			const param = {
				Cid: values.cid,
			};
			const localOnly = true;
			if(localOnly){
				const localResult = loadLocalFateEvents(values.cid);
				yield put({
					type: 'save',
					payload: {
						deeplearn: localResult,
					},
				});
				return;
			}

			let rsp = null;
			try{
				rsp = yield call(service.fetchFateEvents, param);
			}catch(e){
				rsp = null;
			}
			if(!rsp || !rsp.Result){
				const localResult = loadLocalFateEvents(values.cid);
				yield put({
					type: 'save',
					payload: {
						deeplearn: localResult,
					},
				});
				return;
			}
			const Result = rsp.Result;

            yield put({
                type: 'save',
                payload: {  
					deeplearn: Result,
                },
            });

		},

		*deeplearn({ payload: values }, { call, put, select }){
            const state = yield select((s)=>s.astro);
			if(state.deeplearn){
				let param = {
					Cid: state.deeplearn.Cid,
					Val10000: state.deeplearn.Val10000,
					Val20000: state.deeplearn.Val20000,
					Val30000: state.deeplearn.Val30000,
					Val40000: state.deeplearn.Val40000,
				};
				const localOnly = true;
				if(localOnly){
					saveLocalFateEvents(param);
				}else{
					try{
						yield call(service.dlTrain, param);
					}catch(e){
						saveLocalFateEvents(param);
					}
				}
			}

            yield put({
                type: 'openDrawer',
                payload: {  
					key: 'chartlist'
                },
            });

		},

		*syncAndRecalcFromDayBoundary(_, { put, select }) {
			const state = yield select(s => s.astro);
			if(state && state.fields){
				yield put({
					type: 'fetchByFields',
					payload: {
						...state.fields,
						__requestOptions: { silent: true },
					},
				});
			}
		},

	},

	subscriptions: {
		syncFromGlobalDayBoundary({ dispatch }){
			if(typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
			const handler = (ev) => {
				const detail = ev && ev.detail ? ev.detail : {};
				const value = detail.after23NewDay;
				if(value === 0 || value === 1){
					dispatch({ type: 'syncAfter23NewDay', payload: { after23NewDay: value } });
					dispatch({ type: 'syncAndRecalcFromDayBoundary' });
				}
			};
			window.addEventListener('horosa:day-boundary-changed', handler);
		},

		syncFromGlobalLateZiHour({ dispatch }){
			if(typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
			const handler = (ev) => {
				const detail = ev && ev.detail ? ev.detail : {};
				const value = detail.lateZiHourUseNextDay;
				if(value === 0 || value === 1){
					dispatch({ type: 'syncLateZiHourMode', payload: { lateZiHourUseNextDay: value } });
					dispatch({ type: 'syncAndRecalcFromDayBoundary' });
				}
			};
			window.addEventListener('horosa:late-zi-hour-mode-changed', handler);
		},
	},

}
