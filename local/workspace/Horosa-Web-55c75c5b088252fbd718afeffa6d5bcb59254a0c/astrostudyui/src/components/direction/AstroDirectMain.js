// 星运页(组件类在这里;模块级助手按职责拆在 main/ 下):snapshot(主限法 / 法达表的 AI 快照正文与它用到的文字件)
//   · fetchFields(主限法取盘字段、推运响应解包与主限法子页签判定)。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { Component } from 'react';
// PERF-R9 Ship 7(Windows-ahead):技法步进预取登记 + 主限请求预热(预热两件在 ./pdWarm,见该文件头;import 与用法同轮核,gotcha #84)。
import { stepPrefetchEnabled } from '../../utils/perfFlags';
import { registerStepPrefetcher } from '../../utils/stepPrefetch';
import { warmPrimaryDirection, buildPrimaryDirectionRequestPure, registerPdPageClass } from './pdWarm';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { recordNewChartSeeds } from '../../utils/newChartSeeds';
import { message, } from 'antd';
import { XQTabs as Tabs } from '../xq-ui';
import AstroPrimaryDirection from '../astro/AstroPrimaryDirection';
import AstroPrimaryDirectionChart from '../astro/AstroPrimaryDirectionChart';
import { makeLazyBoundary, idleWarm } from '../../utils/lazyBoundary';
import AstroZR from '../astro/AstroZR';
import AstroFirdaria from '../astro/AstroFirdaria';
import AstroDistributions from '../astro/AstroDistributions';
import AstroAgePoint from '../astro/AstroAgePoint';
import AstroSolarReturn from '../astro/AstroSolarReturn';
import AstroLunarReturn from '../astro/AstroLunarReturn';
import AstroGivenYear from '../astro/AstroGivenYear';
import AstroSolarArc from '../astro/AstroSolarArc';
import AstroProfection from '../astro/AstroProfection';
import AstroDecennials from '../astro/AstroDecennials';
import AstroPlanetaryAges from '../astro/AstroPlanetaryAges';
import AstroVedicProgressions from '../astro/AstroVedicProgressions';
import AstroBalbillus from '../astro/AstroBalbillus';
import AstroTriplicityRulers from '../astro/AstroTriplicityRulers';
import AstroKeypoints from '../astro/AstroKeypoints';
import AstroLunationPhase from '../astro/AstroLunationPhase';
import AstroExtraReturns from '../astro/AstroExtraReturns';
import AstroYearSystem129 from '../astro/AstroYearSystem129';
import AstroPlanetaryArc from '../astro/AstroPlanetaryArc';
import AstroPersianDirected from '../astro/AstroPersianDirected';
import AstroJaynesProgressions from '../astro/AstroJaynesProgressions';
import { AstroNeroman, AstroBezzaFigure, AstroJayProfection, AstroMichon, AstroTimeLords } from '../astro/AstroDirectedFigures';
import AstroEphemeris from '../astro/AstroEphemeris';
import AstroProgressions from '../astro/AstroProgressions';
import AstroReturnTimeline from '../astro/AstroReturnTimeline';
import AstroPrenatalSyzygy from '../astro/AstroPrenatalSyzygy';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';

import { PD_SYNC_REV, DEFAULT_PD_METHOD, DEFAULT_PD_TIME_KEY, mergePrimaryDirectionChartObj, normalizePrimaryDirectionSubTabKey, normalizePdType, PD_EXTRA_SETTING_KEYS, pickPdExtraSettings, pdExtraRequestParams, pdExtraSettingsKey } from '../../utils/primaryDirectionSync';
import FreezeInactive from '../comp/FreezeInactive';
import { classicalBackendOverridesFromFields, chartOrbOverridesFromFields, chartOrbSignature, classicalGlobalValue, setClassicalChartGlobal } from '../../utils/classicalChartGlobals';
import { scheduleOptionDispatch } from '../../utils/optionDispatchScheduler';
import { buildPrimaryDirectSnapshotText, buildFirdariaSnapshotText } from './main/snapshot';
import { normalizePdYears, buildPrimaryDirectionFetchFields, unwrapPredictiveResponse, isPrimaryDirectionTabKey } from './main/fetchFields';
export { buildPrimaryDirectSnapshotText, buildFirdariaSnapshotText } from './main/snapshot';
export { buildPrimaryDirectionFetchFields } from './main/fetchFields';

// 🔴 主限天球必须懒加载,绝不可改回静态 import(2026-08-01 用户实报「进入星运台卡死」的真因):
//   静态引它 → AstroPDSphere → PDSphereEngine → three,整条链成为本页 chunk 的**同步依赖**,
//   于是只要进星运页,模块求值期就得先解析完 three(vendors-gl 862KB)+ 引擎(90KB);
//   而本页默认停在「主限法」表格,二十多个子页签里只有「主限天球」一个用得着 3D ——
//   从不打开天球的用户每次进页都白等这份解析,配置一般的机器足以让主线程长时间无响应。
//   本页又是 idle 预取队列 order:1(优先级最高),连「从不进星运页」的用户都可能在空闲期吃到它。
//   天球子页签是 TabPane + FreezeInactive(不激活不挂载),故懒化后「不打开=零成本」天然成立;
//   FreezeInactive.render 自带 TechniqueErrorBoundary,此处无需再包一层边界。
const AstroPDSphere = makeLazyBoundary(
	() => import(/* webpackChunkName: "pd-sphere" */ '../astro3d/AstroPDSphere'),
	{ label: '主限天球', tip: '主限天球加载中…' }
);

const TabPane = Tabs.TabPane;

class AstroDirectMain extends Component{
	// 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(props) {
		super(props);
		const initialTab = normalizePrimaryDirectionSubTabKey(props.currentSubTab);

		this.state = {
			currentTab: initialTab,
			hook:{
				primarydirect:{
					fun: null
				},
				primarydirchart:{
					fun: null
				},
				primarydirsphere:{
					fun: null
				},
				firdaria:{
					fun: null
				},
				distributions:{
					fun: null
				},
				agepoint:{
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
				lunarreturn:{
					fun: null
				},
				givenyear:{
					fun: null
				},
				decennials:{
					fun: null
				},
				planetaryages:{
					fun: null
				},
				vedicprog:{
					fun: null
				},
				balbillus:{
					fun: null
				},
				triplicityrulers:{
					fun: null
				},
				keypoints:{
					fun: null
				},
				lunationphase:{
					fun: null
				},
				extrareturns:{
					fun: null
				},
				neroman:{
					fun: null
				},
				bezzafigure:{
					fun: null
				},
				jayprofection:{
					fun: null
				},
				michon:{
					fun: null
				},
				timelords:{
					fun: null
				},
				yearsystem129:{
					fun: null
				},
				planetaryarc:{
					fun: null
				},
				persiandirected:{
					fun: null
				},
				jaynesprog:{
					fun: null
				},
					zodialrelease:{
						fun: null
					},
					ephemeris:{
						fun: null
					},
					progressions:{
						fun: null
					},
					returntimeline:{
						fun: null
					},
					prenatalsyzygy:{
						fun: null
					},

				},
		};

		this.changeTab = this.changeTab.bind(this);
		this.applyPrimaryDirectionConfig = this.applyPrimaryDirectionConfig.bind(this);
		this.saveDirectionSnapshot = this.saveDirectionSnapshot.bind(this);
		this.savePrimaryDirectSnapshot = this.savePrimaryDirectSnapshot.bind(this);
		this.saveFirdariaSnapshot = this.saveFirdariaSnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.ensurePrimaryDirectionReady = this.ensurePrimaryDirectionReady.bind(this);
		this.requestPrimaryDirectionRows = this.requestPrimaryDirectionRows.bind(this);
		this.buildPrimaryDirectionRequest = this.buildPrimaryDirectionRequest.bind(this);
		this.getDesiredPdConfig = this.getDesiredPdConfig.bind(this);
		this.needsPrimaryDirectionLoad = this.needsPrimaryDirectionLoad.bind(this);
		this.syncCurrentSubTab = this.syncCurrentSubTab.bind(this);
		this.savePrimaryDirectionRows = this.savePrimaryDirectionRows.bind(this);

		this.unmounted = false;
		this.primaryDirectionInflightKey = '';
		this.primaryDirectionRequestSeq = 0;

		if(this.props.hook){
			this.props.hook.fun = (chartobj)=>{
				let hook = this.state.hook;
				if(hook[this.state.currentTab].fun){
					hook[this.state.currentTab].fun(chartobj);
				}
			};
			// PERF-R9 Ship 7:星运页默认子页(主限 primarydirect)的 /predict/pd 与主 /chart
			// 互不依赖(pd 的构参只吃 fields + 盘上的 pd 配置)—— 在 /chart 返回【之前】并行发出,
			// latency 从「网络 + 技法」变「max(网络, 技法)」。silent、丢结果、绝不 setState。
			// 闸:horosa.perf.prewarmRequests(模型层判定,关=此函数不被调用,逐字节旧序)。
			this.props.hook.prewarmRequests = (flds)=>{
				if(this.unmounted){
					return;
				}
				if(!isPrimaryDirectionTabKey(this.state.currentTab)){
					return;
				}
				try{
					warmPrimaryDirection(this.props.chartObj, flds || this.props.fields);
				}catch(e){ /* 预热失败无害:正式请求自兜底 */ }
			};
			// horosa_prefetch_registry_v1(PERF-R9 Ship 7):主限推运 /predict/pd 是确定性纯计算
			// (同 盘+主限配置 恒同表)→ 登记步进预取。构参走与首点同一 pure builder。
			// 🔴 登记必须在组件内:pd 配置来自组件所在页的 props/盘面态,模块级构不出同键 body。
			if(stepPrefetchEnabled()){
				registerStepPrefetcher('direction', (steppedFields)=>{
					if(this.unmounted || !isPrimaryDirectionTabKey(this.state.currentTab)){
						return [];
					}
					// 只有 date/time 随步进走;pd 配置(方法/年数/顺逆)取当前盘面 —— 与用户
					// 真点下一步时发出的 body 逐字节同键。
					if(!buildPrimaryDirectionRequestPure(this.props.chartObj, steppedFields, {})){
						return [];
					}
					return [{
						name: 'direction:pd',
						path: '/predict/pd',
						run: ()=> warmPrimaryDirection(this.props.chartObj, steppedFields),
					}];
				});
			}
		}

	}

	syncCurrentSubTab(){
		if(!this.props.dispatch){
			return;
		}
		const nextTab = normalizePrimaryDirectionSubTabKey(this.state.currentTab);
		if(this.props.currentSubTab === nextTab){
			return;
		}
		this.props.dispatch({
			type: 'astro/save',
			payload: {
				currentSubTab: nextTab,
			}
		});
	}

	getDesiredPdConfig(chartObj, override = {}){
		const chart = chartObj || this.props.chartObj || {};
		const params = chart.params || {};
		const fields = this.props.fields || {};
		// 解析顺序:override(本次「计算」选择) → chart.params(已落库) → fields(表单) → 默认。
		const pick = (key)=>{
			if(override[key] !== undefined && override[key] !== null){
				return override[key];
			}
			if(params[key] !== undefined && params[key] !== null){
				return params[key];
			}
			if(fields[key] && fields[key].value !== undefined && fields[key].value !== null){
				return fields[key].value;
			}
			return undefined;
		};
		const toFlag = (v)=>(v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0;
		// 顺向 / 逆向 默认都开(用户偏好「顺逆都开」):仅显式 0/false 才关。
		const offIf = (v)=>(v === 0 || v === '0' || v === false || v === 'false') ? 0 : 1;
		const pdDirect = offIf(pick('pdDirect'));
		const pdConverse = offIf(pick('pdConverse'));
		return {
			pdMethod: override.pdMethod || (params.pdMethod
				? params.pdMethod
				: (fields.pdMethod ? fields.pdMethod.value : DEFAULT_PD_METHOD)),
			pdTimeKey: override.pdTimeKey || (params.pdTimeKey
				? params.pdTimeKey
				: (fields.pdTimeKey ? fields.pdTimeKey.value : DEFAULT_PD_TIME_KEY)),
			pdYears: normalizePdYears(override.pdYears !== undefined && override.pdYears !== null ? override.pdYears
				: (params.pdYears !== undefined && params.pdYears !== null ? params.pdYears
				: (fields.pdYears ? fields.pdYears.value : 100))),
			// 方向类型是三值(0 In Zodiaco / 1 In Mundo / 4 Field Plane),不是开关:此前按 0/1 开关归一 → Field Plane 恒被压成 0
			pdtype: normalizePdType(pick('pdtype')),
			pdDirect,
			pdConverse,
			pdAntiscia: toFlag(pick('pdAntiscia')),
			pdTerms: toFlag(pick('pdTerms')),
			// P0 解耦补齐维:投影/定局/框架/平行×2/自定义率/S·P 清单/界系(默认=引擎缺省)。
			pdProjection: pick('pdProjection') || 'ptolemy',
			pdFrame: pick('pdFrame') || 'alcabitius',
			pdFramework: pick('pdFramework') || 'aspect',
			pdParallel: toFlag(pick('pdParallel')),
			pdRaptParallel: toFlag(pick('pdRaptParallel')),
			pdTimeKeyCustom: (()=>{ const v = pick('pdTimeKeyCustom'); const n = Number(v); return (v !== undefined && Number.isFinite(n) && n > 0) ? n : null; })(),
			pdSignificators: Array.isArray(pick('pdSignificators')) && pick('pdSignificators').length ? pick('pdSignificators') : null,
			pdPromissorTypes: Array.isArray(pick('pdPromissorTypes')) && pick('pdPromissorTypes').length ? pick('pdPromissorTypes') : null,
			termsVariant: (()=>{ const v = Number(pick('termsVariant')); return (v >= 1 && v <= 4) ? v : 0; })(),
			// 设置项登记表(相位侧 / 传统逆向 / 取点四项):同一解析顺序,全套归一值
			pdExtra: pickPdExtraSettings(override.pdExtra, params,
				PD_EXTRA_SETTING_KEYS.reduce((acc, key)=>{
					if(fields[key]){ acc[key] = fields[key].value; }
					return acc;
				}, {})),
		};
	}

	buildPrimaryDirectionRequest(chartObj, override = {}){
		const chart = chartObj || this.props.chartObj || {};
		const desired = this.getDesiredPdConfig(chart, override);
		const nextFields = buildPrimaryDirectionFetchFields(
			override.fields || this.props.fields,
			chart,
			desired.pdMethod,
			desired.pdTimeKey,
			desired.pdYears,
			{
				pdtype: desired.pdtype,
				direct: desired.pdDirect === 1,
				converse: desired.pdConverse === 1,
				antiscia: desired.pdAntiscia === 1,
				terms: desired.pdTerms === 1,
				extra: desired.pdExtra,
			}
		);
		const dateValue = nextFields.date && nextFields.date.value;
		const timeValue = nextFields.time && nextFields.time.value;
		if(!dateValue || !timeValue || !dateValue.format || !timeValue.format){
			return null;
		}
		const dateStr = dateValue.format('YYYY/MM/DD');
		const timeStr = timeValue.format('HH:mm:ss');
		// 畸形日期(NaN)绝不发请求——否则后端 Datetime 抛错弹「param error」。
		if(`${dateStr}`.indexOf('NaN') >= 0 || `${timeStr}`.indexOf('NaN') >= 0){
			return null;
		}
		return {
			date: dateStr,
			time: timeStr,
			ad: nextFields.ad && nextFields.ad.value !== undefined ? nextFields.ad.value : (dateValue.ad !== undefined ? dateValue.ad : 1),
			zone: nextFields.zone ? nextFields.zone.value : undefined,
			lat: nextFields.lat ? nextFields.lat.value : undefined,
			lon: nextFields.lon ? nextFields.lon.value : undefined,
			gpsLat: nextFields.gpsLat ? nextFields.gpsLat.value : undefined,
			gpsLon: nextFields.gpsLon ? nextFields.gpsLon.value : undefined,
			hsys: nextFields.hsys ? nextFields.hsys.value : 0,
			southchart: nextFields.southchart ? nextFields.southchart.value : 0,
			zodiacal: nextFields.zodiacal ? nextFields.zodiacal.value : 0, siderealAyanamsa: nextFields.siderealAyanamsa ? nextFields.siderealAyanamsa.value : '',
			tradition: nextFields.tradition ? nextFields.tradition.value : 0,
			strongRecption: nextFields.strongRecption ? nextFields.strongRecption.value : 0,
			simpleAsp: nextFields.simpleAsp ? nextFields.simpleAsp.value : 0,
			virtualPointReceiveAsp: nextFields.virtualPointReceiveAsp ? nextFields.virtualPointReceiveAsp.value : 0,
			doubingSu28: nextFields.doubingSu28 ? nextFields.doubingSu28.value : 0,
			predictive: true,
			includePrimaryDirection: true,
			showPdBounds: nextFields.showPdBounds ? nextFields.showPdBounds.value : 1,
			pdtype: desired.pdtype,
			pdMethod: desired.pdMethod,
			pdTimeKey: desired.pdTimeKey,
			pdYears: desired.pdYears,
			pdDirect: desired.pdDirect,
			pdConverse: desired.pdConverse,
			pdAntiscia: desired.pdAntiscia,
			pdTerms: desired.pdTerms,
			pdProjection: desired.pdProjection,
			pdFrame: desired.pdFrame,
			pdFramework: desired.pdFramework,
			pdParallel: desired.pdParallel,
			pdRaptParallel: desired.pdRaptParallel,
			...(desired.pdTimeKeyCustom ? { pdTimeKeyCustom: desired.pdTimeKeyCustom } : {}),
			...(desired.pdSignificators ? { pdSignificators: desired.pdSignificators } : {}),
			...(desired.pdPromissorTypes ? { pdPromissorTypes: desired.pdPromissorTypes } : {}),
			...pdExtraRequestParams(desired.pdExtra),
			termsVariant: desired.termsVariant,
			// 古典设置单源接入(此前仅 termsVariant 手拼=其余古典档对主限族空转;
			// /predict/pd 装饰器统一 push,条件发送保默认态字节不变=golden 540 天然守护)。
			// 页面显式界系必须胜出:desired.termsVariant 的真值序=override(本次对话框
			// 选择)>params(已落库)>fields,而 spread 在其后会用 fields 值静默覆盖——全局仓非默认
			// 时主限页任何异档选择「永不可达」。剔除 spread 里的 termsVariant(delete 法保键序=
			// 不翻缓存键);非自定义界(≠4)时连剔表体伴生键,防已废 12 座表随请求。
			...(()=>{
				const cls = classicalBackendOverridesFromFields(nextFields || {});
				delete cls.termsVariant;
				if(desired.termsVariant !== 4){
					delete cls.customTermsDay; delete cls.customTermsNight;
				}else if(!cls.customTermsDay){
					// 页面显式选自定义界(4)而 fields≠4:spread 无从附表(WP-7 触发条件=
					// fields 值为 4)——裸发 4 后端静默回落埃及,而 UI/params/快照全标「自定义界表」
					// 且 needsPrimaryDirectionLoad 判 4===4 永久停错档。随盘 fields 表体优先,
					// 回落本机编辑器仓;仍无表=照 chartRequest.js WP-7 口径降级不发 4。
					const fDay = nextFields && nextFields.customTermsDay ? nextFields.customTermsDay.value : undefined;
					const fNight = nextFields && nextFields.customTermsNight ? nextFields.customTermsNight.value : undefined;
					let day = Array.isArray(fDay) && fDay.length === 12 ? fDay : null;
					let night = Array.isArray(fNight) && fNight.length === 12 ? fNight : null;
					if(!day){
						try{
							const t = require('../../utils/customCalibreStores').loadCustomTerms();
							if(t && Array.isArray(t.day) && t.day.length === 12){ day = t.day; night = Array.isArray(t.night) && t.night.length === 12 ? t.night : night; }
						}catch(e){ /* 无编辑器仓=降级 */ }
					}
					if(day){
						cls.customTermsDay = day;
						if(night){ cls.customTermsNight = night; }
					}else{
						// 无表降级埃及:手写 termsVariant 行在本 IIFE 之前已求值(对象字面量按序),
						// 改 desired 无效——由 spread 同名键覆盖(spread 在后=后者胜)。
						cls.termsVariant = 0;
					}
				}
				return cls;
			})(),
			// 随盘容许度:主限请求回来的那份盘会写回全局当本命盘用,不带就把相位表冲回默认容许度
			...chartOrbOverridesFromFields(nextFields || {}),
			pdaspects: nextFields.pdaspects ? nextFields.pdaspects.value : [0, 60, 90, 120, 180],
			name: nextFields.name ? nextFields.name.value : null,
			pos: nextFields.pos ? nextFields.pos.value : null,
			cid: null,
		};
	}

	needsPrimaryDirectionLoad(chartObj){
		if(!isPrimaryDirectionTabKey(this.state.currentTab)){
			return false;
		}
		const chart = chartObj || this.props.chartObj || {};
		const params = chart.params || {};
		const predictives = chart.predictives || {};
		const pds = Array.isArray(predictives.primaryDirection) ? predictives.primaryDirection : [];
		const desired = this.getDesiredPdConfig(chart);
		const hasCompleteParams = !!(
			params.pdMethod
			&& params.pdTimeKey
			&& params.pdtype !== undefined
			&& `${params.pdSyncRev || ''}` === PD_SYNC_REV
		);
		if((params.pdMethod || desired.pdMethod) !== desired.pdMethod){
			return true;
		}
		if((params.pdTimeKey || desired.pdTimeKey) !== desired.pdTimeKey){
			return true;
		}
		if(normalizePdYears(params.pdYears !== undefined && params.pdYears !== null ? params.pdYears : desired.pdYears) !== desired.pdYears){
			return true;
		}
		if(!hasCompleteParams){
			return true;
		}
		// 解耦九键漂移 → 重算(与 pdMethod 同级的真实算法维)。
		if((params.pdProjection || 'ptolemy') !== desired.pdProjection){ return true; }
		if((params.pdFrame || 'alcabitius') !== desired.pdFrame){ return true; }
		if((params.pdFramework || 'aspect') !== desired.pdFramework){ return true; }
		if(((params.pdParallel ? 1 : 0)) !== desired.pdParallel){ return true; }
		if(((params.pdRaptParallel ? 1 : 0)) !== desired.pdRaptParallel){ return true; }
		if(((params.termsVariant >= 1 && params.termsVariant <= 4) ? params.termsVariant : 0) !== desired.termsVariant){ return true; }
		if(pdExtraSettingsKey(params) !== pdExtraSettingsKey(desired.pdExtra)){ return true; }
		// pdtype/pdDirect/pdConverse/pdAntiscia/pdTerms 现为真实选项,已随 chart.params 持久化;
		// desired(无 override)即取自 params,故自动加载不因开关而误触发(显式重算走表格「计算」按钮)。
		return pds.length === 0;
	}

	savePrimaryDirectionRows(chartObj, req, pdRows, options = {}){
		if(!this.props.dispatch){
			return;
		}
		// base 盘不完整(如 /chart 失败后 chartObj 为空)时绝不落盘:merge 会合成只有 pd 系
		// params、无 chart/无 params.zone 的部分态对象,写入全局后宿占/3D 等消费方按
		// chartObj truthy 解引用 .chart/.params.zone 即崩(2026-07-16 诊断实证链)。
		if(!chartObj || !chartObj.chart){
			return;
		}
		const nextChartObj = mergePrimaryDirectionChartObj(chartObj, {
			pdRows,
			showPdBounds: req.showPdBounds,
			pdMethod: req.pdMethod,
			pdTimeKey: req.pdTimeKey,
			pdYears: req.pdYears,
			pdtype: req.pdtype,
			pdDirect: req.pdDirect,
			pdConverse: req.pdConverse,
			pdAntiscia: req.pdAntiscia,
			pdTerms: req.pdTerms,
			pdProjection: req.pdProjection,
			pdFrame: req.pdFrame,
			pdFramework: req.pdFramework,
			pdParallel: req.pdParallel,
			pdRaptParallel: req.pdRaptParallel,
			// req 是完整 desired 解析产物:无键=用户显式清空 → 归一成 null/[] 落库覆盖旧值,
			// 否则清空后旧勾选残留在 params,天球扩展 Popover 勾选回弹、清空失灵。
			pdTimeKeyCustom: req.pdTimeKeyCustom !== undefined ? req.pdTimeKeyCustom : null,
			pdSignificators: Array.isArray(req.pdSignificators) ? req.pdSignificators : [],
			pdPromissorTypes: Array.isArray(req.pdPromissorTypes) ? req.pdPromissorTypes : [],
			pdExtra: pickPdExtraSettings(req),
			termsVariant: req.termsVariant,
			name: req.name,
			pos: req.pos,
			chartId: options.chartId,
		});
		const payload = {
			chartObj: nextChartObj,
		};
		if(options.fields){
			payload.fields = options.fields;
		}
		this.props.dispatch({
			type: 'astro/save',
			payload,
		});
		if(options.runHook && options.fields){
			this.props.dispatch({
				type: 'astro/doHook',
				payload: {
					chartObj: nextChartObj,
					fields: options.fields,
				},
			});
		}
	}

	async requestPrimaryDirectionRows(options = {}){
		const chartObj = options.chartObj || this.props.chartObj || {};
		const req = this.buildPrimaryDirectionRequest(chartObj, options);
		if(!req || !this.props.dispatch){
			return;
		}
		const reqKey = JSON.stringify({
			tab: this.state.currentTab,
			date: req.date,
			time: req.time,
			zone: req.zone,
			lat: req.lat,
			lon: req.lon,
			hsys: req.hsys,
			zodiacal: req.zodiacal, siderealAyanamsa: req.siderealAyanamsa,
			pdMethod: req.pdMethod,
			pdTimeKey: req.pdTimeKey,
			pdYears: req.pdYears,
			showPdBounds: req.showPdBounds,
			pdtype: req.pdtype,
			pdDirect: req.pdDirect,
			pdConverse: req.pdConverse,
			pdAntiscia: req.pdAntiscia,
			pdTerms: req.pdTerms,
			pdProjection: req.pdProjection, pdFrame: req.pdFrame, pdFramework: req.pdFramework,
			pdParallel: req.pdParallel, pdRaptParallel: req.pdRaptParallel,
			pdTimeKeyCustom: req.pdTimeKeyCustom, pdSignificators: req.pdSignificators,
			pdPromissorTypes: req.pdPromissorTypes, termsVariant: req.termsVariant,
			pdExtra: pdExtraSettingsKey(req),
			pdaspects: req.pdaspects,
			// spread 古典键(cazimiOrb/sectBuffer 等)不逐键枚举,整包兜底进 key——
			// 否则「同 pd 键、异古典档」两请求在在途窗内被误去重(完成后自愈,但窗内丢档)。
			cls: classicalBackendOverridesFromFields(this.props.fields || {}),
			orb: chartOrbSignature(chartOrbOverridesFromFields(this.props.fields || {})),
		});
		if(this.primaryDirectionInflightKey === reqKey){
			return;
		}
		this.primaryDirectionInflightKey = reqKey;
		const seq = ++this.primaryDirectionRequestSeq;
		let result = null;
		try{
			const data = await request(`${Constants.ServerRoot}/predict/pd`, {
				body: JSON.stringify(req),
			});
			result = unwrapPredictiveResponse(data);
		}catch(e){
			result = null;
		}
		if(this.unmounted || seq !== this.primaryDirectionRequestSeq){
			return;
		}
		this.primaryDirectionInflightKey = '';
		const pdRows = result && Array.isArray(result.pd) ? result.pd : null;
		if(!pdRows){
			// 失败不静默:applied 不动(merge 不跑),按钮保持「重新计算」;可见提示防「假已同步」体感
			try{ message.warning('主限法计算未完成（服务未响应），请点「重新计算」重试'); }catch(e){ /* SSR/测试环境无 message */ }
			return;
		}
		this.savePrimaryDirectionRows(chartObj, req, pdRows, {
			fields: options.fields,
			runHook: !!options.runHook,
			chartId: options.chartId,
		});
	}

	ensurePrimaryDirectionReady(){
		if(!this.needsPrimaryDirectionLoad()){
			this.primaryDirectionInflightKey = '';
			return;
		}
		this.requestPrimaryDirectionRows();
	}

	savePrimaryDirectSnapshot(){
		const chartObj = this.props.chartObj || {};
		const chartParams = chartObj.params || {};
		const fields = this.props.fields || {};
		// 同上:回显恒 1,取值序必须 fields 优先(与表格 convertToDataSource 同源),
		// 否则选「否」的用户表格没有界限法行、快照里却有,还写着「显示界限法:是」。
		const showPdBounds = (fields.showPdBounds && fields.showPdBounds.value !== undefined && fields.showPdBounds.value !== null)
			? fields.showPdBounds.value
			: (chartParams.showPdBounds !== undefined ? chartParams.showPdBounds : 1);
		const pdMethod = chartParams.pdMethod
			? chartParams.pdMethod
			: (fields.pdMethod ? fields.pdMethod.value : 'core_alchabitius');
		const pdTimeKey = chartParams.pdTimeKey
			? chartParams.pdTimeKey
			: (fields.pdTimeKey ? fields.pdTimeKey.value : 'Ptolemy');
		const snapshotChartObj = {
			...chartObj,
			params: {
				...(chartObj.params || {}),
				showPdBounds,
				pdMethod,
				pdTimeKey,
			},
		};
		const txt = buildPrimaryDirectSnapshotText(snapshotChartObj);
		if(!txt){
			return '';
		}
		// meta 是挂载面板显示与快照识别用的「这份快照按哪组设置算的」——P0/P2 九键
		// 不进 meta 则用户在 AI 分析里看不出快照对应投影/分宫/扩展,与正文自相矛盾。
		saveModuleAISnapshot('primarydirect', txt, {
			tab: 'primarydirect',
			pdMethod,
			pdTimeKey,
			showPdBounds,
			pdProjection: chartParams.pdProjection || 'ptolemy',
			pdFrame: chartParams.pdFrame || 'alcabitius',
			pdFramework: chartParams.pdFramework || 'aspect',
			pdtype: normalizePdType(chartParams.pdtype),
			pdParallel: chartParams.pdParallel ? 1 : 0,
			pdRaptParallel: chartParams.pdRaptParallel ? 1 : 0,
			termsVariant: (chartParams.termsVariant >= 1 && chartParams.termsVariant <= 4) ? chartParams.termsVariant : 0,
			...(chartParams.pdTimeKeyCustom ? { pdTimeKeyCustom: chartParams.pdTimeKeyCustom } : {}),
			...(Array.isArray(chartParams.pdSignificators) && chartParams.pdSignificators.length
				? { pdSignificators: chartParams.pdSignificators } : {}),
			...(Array.isArray(chartParams.pdPromissorTypes) && chartParams.pdPromissorTypes.length
				? { pdPromissorTypes: chartParams.pdPromissorTypes } : {}),
		});
		return txt;
	}

	saveFirdariaSnapshot(){
		const txt = buildFirdariaSnapshotText(this.props.chartObj);
		if(!txt){
			return '';
		}
		saveModuleAISnapshot('firdaria', txt, {
			tab: 'firdaria',
		});
		return txt;
	}

	saveDirectionSnapshot(){
		this.savePrimaryDirectSnapshot();
		if(this.state.currentTab === 'primarydirect'){
			return;
		}
		if(this.state.currentTab === 'firdaria'){
			this.saveFirdariaSnapshot();
		}
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || typeof evt.detail !== 'object'){
			return;
		}
		if(evt.detail.module === 'primarydirect'){
			const txt = this.savePrimaryDirectSnapshot();
			if(txt){
				evt.detail.snapshotText = txt;
			}
			return;
		}
		if(evt.detail.module === 'firdaria'){
			const txt = this.saveFirdariaSnapshot();
			if(txt){
				evt.detail.snapshotText = txt;
			}
		}
	}

	componentDidMount(){
		this.unmounted = false;
		// 天球 chunk 空闲预热:不打开天球=零成本(它只在空闲拍拉取,不占进页面这一帧),
		// 真去点「主限天球」时通常已就绪,体感不比静态 import 差。卸载时必须 cancel。
		this._cancelSphereWarm = idleWarm(AstroPDSphere, { timeout: 2500 });
		if(typeof window !== 'undefined' && window.addEventListener){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		this.syncCurrentSubTab();
		this.ensurePrimaryDirectionReady();
		this.saveDirectionSnapshot();
		// (原 horosa_pdsphere_lazy_v1 的空闲预热已退役:上游 v3.6.2 的 idleWarm 是超集 ——
		//  它在 componentWillUnmount 里 cancel,我方那版没有。见本文件顶部 idleWarm 调用。)
		// 底部空白根治:静态 props.height-20 比实际工作区矮(链上全满仅本模块 inline 高偏矮)→ Tabs/表格
		// 皆按偏矮值设死高度,页底留空白(用户实告 主限法 页底空条)。改测根容器真高驱动各页签高度。
		this.measureRootHeight();
		// 🔴 祖先滚动归零闸:overflow:hidden 挡不住 scrollIntoView/focus 等编程式滚动
		// (选中时间轴章后滚轮,焦点链会把 hidden 祖先滚出视口——App 实告)。捕获期监听全局 scroll,
		// 凡「本页祖先容器」被滚出即刻复位,机械保证本页任何交互不产生页面级位移。
		this._scrollZeroGuard = (e)=>{
			const t = e && e.target;
			if(!t || !this.rootEl){ return; }
			// 🔴 页面级滚动(target=document/window)不再放行:WKWebView pageZoom≠1/拖拽 autoscroll 会
			// 编程式滚动 scrollingElement(html/body 的 overflow:hidden 挡不住编程滚)——真机 0.9 缩放实告。
			// rAF 复归一帧:WebKit 可能在同帧内恢复滚动位。
			if(t === document || t === window){
				const zero = ()=>{
					const se = document.scrollingElement;
					if(se){ se.scrollTop = 0; se.scrollLeft = 0; }
					if(document.documentElement){ document.documentElement.scrollTop = 0; document.documentElement.scrollLeft = 0; }
					if(document.body){ document.body.scrollTop = 0; document.body.scrollLeft = 0; }
				};
				zero();
				if(typeof requestAnimationFrame === 'function'){ requestAnimationFrame(zero); }
				return;
			}
			// 🔴 页内相关容器(祖先或后代)按「方向合法性」归零:overflow 为 auto/scroll 的
			// 方向=设计滚动(右栏列表纵滚/时间轴轨道横滚)一律放行;hidden 方向被滚(焦点滚动/
			// 拖拽 autoscroll/编程滚)=溢出泄漏,归零。绝不可按容器一刀切——曾把推运右栏
			// 纵滚整体锁死(真机实告)。
			const related = (typeof t.contains === 'function' && t.contains(this.rootEl)) || (typeof this.rootEl.contains === 'function' && this.rootEl.contains(t));
			if(related && (t.scrollTop || t.scrollLeft)){
				let cs = null;
				try{ cs = window.getComputedStyle(t); }catch(e){ /* ignore */ }
				const oy = cs ? cs.overflowY : '';
				const ox = cs ? cs.overflowX : '';
				if(t.scrollTop && oy !== 'auto' && oy !== 'scroll'){ t.scrollTop = 0; }
				if(t.scrollLeft && ox !== 'auto' && ox !== 'scroll'){ t.scrollLeft = 0; }
			}
		};
		window.addEventListener('scroll', this._scrollZeroGuard, true);
		if(typeof ResizeObserver !== 'undefined' && this.rootEl){
			this._roRoot = new ResizeObserver(()=>{
				if(this._rafRoot){ cancelAnimationFrame(this._rafRoot); }
				this._rafRoot = requestAnimationFrame(()=> this.measureRootHeight());
			});
			this._roRoot.observe(this.rootEl);
			// 🔴 子页高取自 Tabs 内容区(见 measureRootHeight),而内容区会在根容器尺寸不变时自己变高矮
			// (本页 CSS 分包晚到、边框/内距后生效:实测首拍 806、落定后 804);根容器 RO 对此无感 → 子页
			// 停在首拍值,比面板高 2px,外层滚动条常驻。把内容区本身也纳入观察,变了就重量。
			try{
				const content = this.rootEl.querySelector('.ant-tabs-content') || this.rootEl.querySelector('.ant-tabs-content-holder');
				if(content){ this._roRoot.observe(content); }
			}catch(e){ /* 无内容区时只观察根 */ }
		}
	}

	// 测根容器真高(填满工作区);>120 才采信,变化才 setState(防抖风暴)。回退=静态 props.height-20。
	// 🔴 取 min(自身高, 父容器 clientHeight):自身高会被内容撑大(实测比父可用高多 16px+,App 窄窗下更多),
	// 按撑大值设 Tabs/pane 高度 → 整块超出工作区 → 页面可上下滚、底部时间轴被滚出视口。
	measureRootHeight(){
		if(this.unmounted || !this.rootEl){ return; }
		// 🔴 量高必须用布局域 clientHeight,勿用 getBoundingClientRect().height:
		// 壳级 CSS zoom 下 rect 返回×zoom 的视觉值(0.9 时偏小 ~10%),当布局值用会把
		// pane 设矮 → 底部恒空带(真机 0.9 实告)。1:1 时两者等值=零回归。
		let h = this.rootEl.clientHeight;
		const parent = this.rootEl.parentElement;
		if(parent && parent.clientHeight > 120){ h = Math.min(h, parent.clientHeight); }
		// 🔴
		// 子页拿到的 height 若按根容器算(826),而真正装子页的页签面板只有 824(Tabs 自身边框等吃掉 2px),
		// 子页根 div 就比面板高 2px → 面板 overflow-y:auto 立刻长出整条滚动条(含滚动槽=那条空带)。
		// 直接量 Tabs 内容区(页签面板的父,与面板同高)= 子页真正可用高,任何 Tabs 皮肤/边框下都对。
		// 实测(本机 WebKit,窗高 900):根 826 / .ant-tabs-content-holder 806 / .ant-tabs-content 与页签面板 804 —— 必须量到
		// 面板那一层(.ant-tabs-content 与面板同高);量 holder 仍多 2px,滚动条照旧长出来。
		try{
			// 首选当前页签面板本身(链条已定高:Tabs 100% → holder → content → 面板,面板 = 子页真正可用高);
			// 面板缺席时退到 content / holder。绝不再从子页自身的高度反推(那是循环)。
			const pane = this.rootEl.querySelector('.ant-tabs-tabpane-active');
			const content = this.rootEl.querySelector('.ant-tabs-content') || this.rootEl.querySelector('.ant-tabs-content-holder');
			const box = (pane && pane.clientHeight > 120) ? pane : content;
			if(box && box.clientHeight > 120){ h = Math.min(h, box.clientHeight); }
		}catch(e){ /* 无 Tabs 内容区(极旧 antd)时沿用根容器高 */ }
		if(h > 120 && h !== this.state.containerH){ this.setState({ containerH: h }); }
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._cancelSphereWarm){ this._cancelSphereWarm(); this._cancelSphereWarm = null; }
		if(this._scrollZeroGuard){ window.removeEventListener('scroll', this._scrollZeroGuard, true); this._scrollZeroGuard = null; }
		if(typeof window !== 'undefined' && window.removeEventListener){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if(this._roRoot){ try{ this._roRoot.disconnect(); }catch(e){} this._roRoot = null; }
		if(this._rafRoot){ cancelAnimationFrame(this._rafRoot); this._rafRoot = null; }
	}

	componentDidUpdate(prevProps, prevState){
		if(prevProps.currentSubTab !== this.props.currentSubTab){
			const nextTab = normalizePrimaryDirectionSubTabKey(this.props.currentSubTab);
			if(nextTab !== this.state.currentTab){
				this.setState({ currentTab: nextTab }, ()=>{
					this.ensurePrimaryDirectionReady();
					this.saveDirectionSnapshot();
					const hook = this.state.hook[nextTab];
					if(hook && hook.fun){
						hook.fun(this.props.chartObj);
					}
				});
				return;
			}
		}
		if(
			prevState.currentTab !== this.state.currentTab ||
			prevProps.chartObj !== this.props.chartObj ||
			prevProps.fields !== this.props.fields ||
			this.state.currentTab === 'primarydirect' ||
			this.state.currentTab === 'firdaria'
		){
			this.saveDirectionSnapshot();
		}
		if(prevState.currentTab !== this.state.currentTab || prevProps.currentSubTab !== this.props.currentSubTab){
			this.syncCurrentSubTab();
		}
		if(
			prevState.currentTab !== this.state.currentTab
			|| prevProps.chartObj !== this.props.chartObj
			|| prevProps.fields !== this.props.fields
		){
			this.ensurePrimaryDirectionReady();
		}
	}

	changeTab(key){
		let hook = this.state.hook;
		this.setState({
			currentTab: key,
		}, ()=>{
			this.syncCurrentSubTab();
			this.ensurePrimaryDirectionReady();
			this.saveDirectionSnapshot();
			if(hook[key].fun){
				hook[key].fun(this.props.chartObj);
			}
		});
	}

	applyPrimaryDirectionConfig(pdMethod, pdTimeKey, pdYears, options){
		if(!this.props.dispatch || !this.props.fields){
			return;
		}
		const opt = options || {};
		// 「新盘种子」:主限法口径(方法 / 时间钥匙 / In Zodiaco·Mundo / 投影·定局·框架·平行 / 「扩展」弹层全部项)的亲手改动 = 新命盘缺省;
		// 没改过 = 内建默认,Alcabitius + Ptolemy 默认路径逐字节不动
		const seedList = (v)=>(Array.isArray(v) && v.length ? v : null);
		recordNewChartSeeds({
			pdMethod, pdTimeKey, pdtype: normalizePdType(opt.pdtype),
			...(opt.projection ? { pdProjection: opt.projection } : {}),
			...(opt.frame ? { pdFrame: opt.frame } : {}),
			...(opt.framework ? { pdFramework: opt.framework } : {}),
			pdParallel: opt.parallel ? 1 : 0,
			pdRaptParallel: opt.raptParallel ? 1 : 0,
			pdAntiscia: opt.antiscia ? 1 : 0,
			pdTerms: opt.terms ? 1 : 0,
			...(Array.isArray(opt.significators) ? { pdSignificators: seedList(opt.significators) } : {}),
			...(Array.isArray(opt.promissorTypes) ? { pdPromissorTypes: seedList(opt.promissorTypes) } : {}),
			...(opt.extra ? pickPdExtraSettings(opt.extra) : {}),
		});
		const resolvedPdYears = pdYears !== undefined && pdYears !== null
			? normalizePdYears(pdYears)
			: this.getDesiredPdConfig(this.props.chartObj).pdYears;
		this.props.dispatch({
			type: 'app/save',
			payload: {
				pdMethod,
				pdTimeKey,
				pdYears: resolvedPdYears,
				pdtype: normalizePdType(opt.pdtype),
				pdDirect: opt.direct === false ? 0 : 1,
				// 统一 0/1 数字编码:此前混入布尔,而 PD 链下游惯例是 `x === 0 ? 0 : 1`,
				// 布尔 false 会被错判成 1(开),埋给未来消费者的雷。
				pdConverse: opt.converse ? 1 : 0,
				pdAntiscia: opt.antiscia ? 1 : 0,
				pdTerms: opt.terms ? 1 : 0,
				...(opt.projection ? { pdProjection: opt.projection } : {}),
				...(opt.frame ? { pdFrame: opt.frame } : {}),
				...(opt.framework ? { pdFramework: opt.framework } : {}),
				pdParallel: opt.parallel ? 1 : 0,
				pdRaptParallel: opt.raptParallel ? 1 : 0,
				...(opt.timeKeyCustom ? { pdTimeKeyCustom: opt.timeKeyCustom } : {}),
				...(Array.isArray(opt.significators) ? { pdSignificators: opt.significators } : {}),
				...(Array.isArray(opt.promissorTypes) ? { pdPromissorTypes: opt.promissorTypes } : {}),
				...(opt.termsVariant !== undefined ? { termsVariant: (opt.termsVariant >= 1 && opt.termsVariant <= 4) ? opt.termsVariant : 0 } : {}),
				...(opt.extra ? pickPdExtraSettings(opt.extra) : {}),
			},
		});
		const nextFields = buildPrimaryDirectionFetchFields(
			this.props.fields,
			this.props.chartObj,
			pdMethod,
			pdTimeKey,
			resolvedPdYears,
			opt
		);
		this.props.dispatch({
			type: 'astro/saveUserFields',
			payload: {
				fields: nextFields,
			},
		});
		// 界系覆写全局:工具条所选界系 ≠ 全局现值 → 写全局仓(localStorage+广播,全站派生盘
		// 下次构参即读到)并按 ChartDisplaySelector.applyClassicalField 同律调度主盘重算(fields 已在上面回写)。
		// 同值(缺省路径:工具条本就从全局播种)零动作 → 请求体/缓存键/主盘字节不变。
		if(opt.termsVariant !== undefined){
			const tv = (opt.termsVariant >= 1 && opt.termsVariant <= 4) ? Number(opt.termsVariant) : 0;
			if(Number(classicalGlobalValue('termsVariant')) !== tv){
				setClassicalChartGlobal('termsVariant', tv);
				if(nextFields.date && nextFields.time && nextFields.lat && nextFields.lon){
					scheduleOptionDispatch((payload)=>{
						this.props.dispatch({ type: 'astro/fetchByFields', payload });
					}, { termsVariant: { value: tv, name: ['termsVariant'] } }, ()=>({ ...(this.props.fields || {}) }));
				}
			}
		}
		this.requestPrimaryDirectionRows({
			chartObj: this.props.chartObj,
			fields: nextFields,
			pdMethod,
			pdTimeKey,
			pdYears: resolvedPdYears,
			// 把本次「计算」选择的进阶开关作为 override 直传,优先级高于已落库 params,
			// 确保用户新选的 方向类型/顺逆/映点/界 立即进入 /predict/pd 请求体。
			pdtype: normalizePdType(opt.pdtype),
			pdDirect: opt.direct === false ? 0 : 1,
			pdConverse: opt.converse ? 1 : 0,
			pdAntiscia: opt.antiscia ? 1 : 0,
			pdTerms: opt.terms ? 1 : 0,
			...(opt.projection ? { pdProjection: opt.projection } : {}),
			...(opt.frame ? { pdFrame: opt.frame } : {}),
			...(opt.framework ? { pdFramework: opt.framework } : {}),
			pdParallel: opt.parallel ? 1 : 0,
			pdRaptParallel: opt.raptParallel ? 1 : 0,
			...(opt.timeKeyCustom ? { pdTimeKeyCustom: opt.timeKeyCustom } : {}),
			...(Array.isArray(opt.significators) ? { pdSignificators: opt.significators } : {}),
			...(Array.isArray(opt.promissorTypes) ? { pdPromissorTypes: opt.promissorTypes } : {}),
			...(opt.termsVariant !== undefined ? { termsVariant: (opt.termsVariant >= 1 && opt.termsVariant <= 4) ? opt.termsVariant : 0 } : {}),
			...(opt.extra ? { pdExtra: pickPdExtraSettings(opt.extra) } : {}),
			runHook: true,
		});
	}

	render(){
		// 测得的根容器真高优先(填满工作区、消页底空白);未测到时回退静态 props.height-20。
		let height = (this.state.containerH && this.state.containerH > 120)
			? this.state.containerH
			: ((this.props.height ? this.props.height : 760) - 20);
		const chartParams = this.props.chartObj && this.props.chartObj.params ? this.props.chartObj.params : {};
		const appliedPdMethod = chartParams.pdMethod
			? chartParams.pdMethod
			: (this.props.fields && this.props.fields.pdMethod ? this.props.fields.pdMethod.value : 'core_alchabitius');
		const appliedPdTimeKey = chartParams.pdTimeKey
			? chartParams.pdTimeKey
			: (this.props.fields && this.props.fields.pdTimeKey ? this.props.fields.pdTimeKey.value : 'Ptolemy');
		const appliedPdYears = normalizePdYears(chartParams.pdYears !== undefined && chartParams.pdYears !== null
			? chartParams.pdYears
			: (this.props.fields && this.props.fields.pdYears ? this.props.fields.pdYears.value : 100));
		// In Zodiaco(0,黄道) / In Mundo(1,世俗) / Field Plane(4) + 向运方向(converse) + 映点 / 界 开关——
		// 均从已落库 chart.params 读取(applyPrimaryDirectionConfig 写入),缺省回退黄道/顺向/关。
		// pdtype 前端只下发 0 / 1 / 4——「界」不是 pdtype=2/3(后端界推运内部值),
		// 而是 pdTerms 开关产出的行级 cat='T';天球徽章按类别 + pdTerms 尾缀「+界」呈现,与实算一致。
		const appliedPdType = normalizePdType(chartParams.pdtype);
		// 顺向 direct 默认开:仅当已落库显式为 0 才关(缺省/未定义都按开)。
		// 漏传此 prop 会让表格 componentDidUpdate 把「顺」误判为 undefined→默认 1,
		// 导致选「仅逆」算完后「顺」又自动勾上,显示与实算对不上。
		const appliedPdDirect = chartParams.pdDirect === 0 ? 0 : 1;
		// 默认「顺逆都开」(用户偏好):pdConverse 缺省/未定义都按开;仅显式落库为 0/false 才关。
		const appliedPdConverse = (chartParams.pdConverse === 0 || chartParams.pdConverse === false) ? 0 : 1;
		const appliedPdAntiscia = chartParams.pdAntiscia ? 1 : 0;
		const appliedPdTerms = chartParams.pdTerms ? 1 : 0;
		// 解耦九键:与上同口径(params 已落库 → fields → 默认),交由 getDesiredPdConfig 统一解析。
		const appliedPdExt = this.getDesiredPdConfig(this.props.chartObj);

		return (
			<div className="horosa-direction-page xq-chart-renderer xq-chart-renderer-direction" ref={(el)=>{ this.rootEl = el; }} style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
				{/* 🔴 Tabs 必须铺满页根(100%),不能写成 containerH 的 px:
				    此前 Tabs 高 = containerH、子页高也 = containerH,而页签面板 = Tabs − holder 上下边框 2px,
				    子页恒比面板高 2px → 外层滚动条常驻;若再按面板重量,Tabs 跟着缩 2px,面板又比子页矮 2px,
				    循环下去每拍缩 2px(WebKit 实测 806 → 804 → 802 …)。链条定高后子页量面板一次即准。 */}
				<Tabs
					activeKey={this.state.currentTab} tabPosition='right'
					onChange={this.changeTab}
					style={{ height: '100%' }}
				>
					<TabPane tab="赤纬推运" key="jaynesprog">
						<FreezeInactive active={this.state.currentTab === "jaynesprog"}>
							<AstroJaynesProgressions
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="恒星推运" key="vedicprog">
						<FreezeInactive active={this.state.currentTab === "vedicprog"}>
							<AstroVedicProgressions
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="推运" key="progressions">
						<FreezeInactive active={this.state.currentTab === "progressions"}>
							<AstroProgressions
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="主限法" key="primarydirect">
						<FreezeInactive active={this.state.currentTab === "primarydirect"}>
							<AstroPrimaryDirection
								value={this.props.chartObj} height={height}
								showPdBounds={this.props.fields && this.props.fields.showPdBounds ? this.props.fields.showPdBounds.value : 1}
								pdMethod={appliedPdMethod}
								pdTimeKey={appliedPdTimeKey}
								pdYears={appliedPdYears}
								pdType={appliedPdType}
								pdDirect={appliedPdDirect}
								pdConverse={appliedPdConverse}
								pdAntiscia={appliedPdAntiscia}
								pdTerms={appliedPdTerms}
								pdProjection={appliedPdExt.pdProjection}
								pdFrame={appliedPdExt.pdFrame}
								pdFramework={appliedPdExt.pdFramework}
								pdParallel={appliedPdExt.pdParallel}
								pdRaptParallel={appliedPdExt.pdRaptParallel}
								pdTimeKeyCustom={appliedPdExt.pdTimeKeyCustom}
								pdSignificators={appliedPdExt.pdSignificators}
								pdPromissorTypes={appliedPdExt.pdPromissorTypes}
								pdExtra={appliedPdExt.pdExtra}
								termsVariant={appliedPdExt.termsVariant}
								buildRequest={this.buildPrimaryDirectionRequest}
								onPdConfigApply={this.applyPrimaryDirectionConfig}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="界推运" key="distributions">
						<FreezeInactive active={this.state.currentTab === "distributions"}>
						<AstroDistributions
							value={this.props.chartObj}
							height={height}
						/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="年龄推进点" key="agepoint">
						<FreezeInactive active={this.state.currentTab === "agepoint"}>
						<AstroAgePoint
							value={this.props.chartObj}
							height={height}
						/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="星历" key="ephemeris">
						<FreezeInactive active={this.state.currentTab === "ephemeris"}>
							<AstroEphemeris
								value={this.props.chartObj}
								height={height}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="回归轴" key="returntimeline">
						<FreezeInactive active={this.state.currentTab === "returntimeline"}>
							<AstroReturnTimeline
								value={this.props.chartObj}
								height={height}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="主限法盘" key="primarydirchart">
						<FreezeInactive active={this.state.currentTab === "primarydirchart"}>
							<AstroPrimaryDirectionChart
								value={this.props.chartObj}
								height={height}
								showPdBounds={this.props.fields && this.props.fields.showPdBounds ? this.props.fields.showPdBounds.value : 1}
								pdMethod={appliedPdMethod}
								pdTimeKey={appliedPdTimeKey}
								pdYears={appliedPdYears}
								pdType={appliedPdType}
								pdDirect={appliedPdDirect}
								pdConverse={appliedPdConverse}
								pdAntiscia={appliedPdAntiscia}
								pdTerms={appliedPdTerms}
								pdProjection={appliedPdExt.pdProjection}
								pdFrame={appliedPdExt.pdFrame}
								pdFramework={appliedPdExt.pdFramework}
								pdParallel={appliedPdExt.pdParallel}
								pdRaptParallel={appliedPdExt.pdRaptParallel}
								pdTimeKeyCustom={appliedPdExt.pdTimeKeyCustom}
								pdSignificators={appliedPdExt.pdSignificators}
								pdPromissorTypes={appliedPdExt.pdPromissorTypes}
								pdExtra={appliedPdExt.pdExtra}
								termsVariant={appliedPdExt.termsVariant}
								fields={this.props.fields}
								dispatch={this.props.dispatch}
								onPdConfigApply={this.applyPrimaryDirectionConfig}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								hook={this.state.hook.primarydirchart}
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="主限天球" key="primarydirsphere">
						<FreezeInactive active={this.state.currentTab === "primarydirsphere"}>
							{/* AI 快照复用主限表既有段(buildPrimaryDirectSnapshotText→'primarydirect'),
							    本组件零新增快照段 —— 防 AI 段表漂移;pd3d 构参直接复用
							    buildPrimaryDirectionRequest(与 /predict/pd 同一构参函数,零复刻)。 */}
							<AstroPDSphere
								value={this.props.chartObj}
								height={height}
								active={this.state.currentTab === "primarydirsphere"}
								pdMethod={appliedPdMethod}
								pdTimeKey={appliedPdTimeKey}
								pdYears={appliedPdYears}
								pdType={appliedPdType}
								pdDirect={appliedPdDirect}
								pdConverse={appliedPdConverse}
								pdAntiscia={appliedPdAntiscia}
								pdTerms={appliedPdTerms}
								pdProjection={appliedPdExt.pdProjection}
								pdFrame={appliedPdExt.pdFrame}
								pdFramework={appliedPdExt.pdFramework}
								pdParallel={appliedPdExt.pdParallel}
								pdRaptParallel={appliedPdExt.pdRaptParallel}
								pdTimeKeyCustom={appliedPdExt.pdTimeKeyCustom}
								pdSignificators={appliedPdExt.pdSignificators}
								pdPromissorTypes={appliedPdExt.pdPromissorTypes}
								pdExtra={appliedPdExt.pdExtra}
								termsVariant={appliedPdExt.termsVariant}
								buildRequest={this.buildPrimaryDirectionRequest}
								onPdConfigApply={this.applyPrimaryDirectionConfig}
							/>
						</FreezeInactive>
					</TabPane>
						<TabPane tab="演进推运" key="neroman">
							<FreezeInactive active={this.state.currentTab === "neroman"}>
							<AstroNeroman
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>
						<TabPane tab="Bezza 推运图" key="bezzafigure">
							<FreezeInactive active={this.state.currentTab === "bezzafigure"}>
							<AstroBezzaFigure
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

					<TabPane tab="波斯向运" key="persiandirected">
						<FreezeInactive active={this.state.currentTab === "persiandirected"}>
							<AstroPersianDirected
								value={this.props.chartObj}
								height={height}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								chartDisplay={this.props.chartDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="行星弧" key="planetaryarc">
						<FreezeInactive active={this.state.currentTab === "planetaryarc"}>
							<AstroPlanetaryArc
								value={this.props.chartObj}
								height={height}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								chartDisplay={this.props.chartDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="小限法" key="profection">
						<FreezeInactive active={this.state.currentTab === "profection"}>
						<AstroProfection
							value={this.props.chartObj}
							height={height}
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.profection}
							/>

						</FreezeInactive>
					</TabPane>
						<TabPane tab="周日小限" key="jayprofection">
							<FreezeInactive active={this.state.currentTab === "jayprofection"}>
							<AstroJayProfection
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

					<TabPane tab="太阳弧" key="solararc">
						<FreezeInactive active={this.state.currentTab === "solararc"}>
						<AstroSolarArc
							value={this.props.chartObj}
							height={height}
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.solararc}
							/>

						</FreezeInactive>
					</TabPane>

					<TabPane tab="太阳返照" key="solarreturn">
						<FreezeInactive active={this.state.currentTab === "solarreturn"}>
						<AstroSolarReturn
							value={this.props.chartObj}
							wheelArt={this.props.wheelArt}
							height={height}
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.solarreturn}
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="月亮返照" key="lunarreturn">
						<FreezeInactive active={this.state.currentTab === "lunarreturn"}>
						<AstroLunarReturn
							value={this.props.chartObj}
							wheelArt={this.props.wheelArt}
							height={height}
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.lunarreturn}
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="流年法" key="givenyear">
						<FreezeInactive active={this.state.currentTab === "givenyear"}>
						<AstroGivenYear
							value={this.props.chartObj}
							wheelArt={this.props.wheelArt}
							height={height}
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.givenyear}
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="法达星限" key="firdaria">
						<FreezeInactive active={this.state.currentTab === "firdaria"}>
						<AstroFirdaria
								value={this.props.chartObj}
								height={height}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="十年大运" key="decennials">
						<FreezeInactive active={this.state.currentTab === "decennials"}>
						<AstroDecennials
							value={this.props.chartObj}
							wheelArt={this.props.wheelArt}
							height={height}
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							showPlanetHouseInfo={this.props.showPlanetHouseInfo}
							showAstroMeaning={this.props.showAstroMeaning}
							hook={this.state.hook.decennials}
						/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="黄道星释" key="zodialrelease">
						<FreezeInactive active={this.state.currentTab === "zodialrelease"}>
						<AstroZR
							value={this.props.chartObj}
							height={height}
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.zodialrelease}
							/>
						</FreezeInactive>
					</TabPane>

					<TabPane tab="行星年龄" key="planetaryages">
						<FreezeInactive active={this.state.currentTab === "planetaryages"}>
							<AstroPlanetaryAges
								value={this.props.chartObj}
								wheelArt={this.props.wheelArt}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

					<TabPane tab="129年系统" key="yearsystem129">
						<FreezeInactive active={this.state.currentTab === "yearsystem129"}>
							<AstroYearSystem129
								value={this.props.chartObj}
								height={height}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</FreezeInactive>
						</TabPane>

						<TabPane tab="Balbillus" key="balbillus">
							<FreezeInactive active={this.state.currentTab === "balbillus"}>
							<AstroBalbillus
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

						<TabPane tab="三分主星" key="triplicityrulers">
							<FreezeInactive active={this.state.currentTab === "triplicityrulers"}>
							<AstroTriplicityRulers
								value={this.props.chartObj}
								height={height}
								showAstroMeaning={this.props.showAstroMeaning}
								tripSystem={this.props.tripSystem}
							/>
							</FreezeInactive>
						</TabPane>

						<TabPane tab="数字相位" key="keypoints">
							<FreezeInactive active={this.state.currentTab === "keypoints"}>
							<AstroKeypoints
								value={this.props.chartObj}
								height={height}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

						<TabPane tab="月相推运" key="lunationphase">
							<FreezeInactive active={this.state.currentTab === "lunationphase"}>
							<AstroLunationPhase
								value={this.props.chartObj}
								height={height}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

						<TabPane tab="产前朔望" key="prenatalsyzygy">
							<FreezeInactive active={this.state.currentTab === "prenatalsyzygy"}>
							<AstroPrenatalSyzygy
								value={this.props.chartObj}
								wheelArt={this.props.wheelArt}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

						<TabPane tab="多重回归" key="extrareturns">
							<FreezeInactive active={this.state.currentTab === "extrareturns"}>
							<AstroExtraReturns
								value={this.props.chartObj}
								height={height}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

						<TabPane tab="双黄道" key="michon">
							<FreezeInactive active={this.state.currentTab === "michon"}>
							<AstroMichon
								value={this.props.chartObj}
								height={height}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>
						<TabPane tab="时主轮转" key="timelords">
							<FreezeInactive active={this.state.currentTab === "timelords"}>
							<AstroTimeLords
								value={this.props.chartObj}
								height={height}
								wheelArt={this.props.wheelArt}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
							</FreezeInactive>
						</TabPane>

					</Tabs>
			</div>
		);
	}
}

registerPdPageClass(AstroDirectMain);   // horosa_pd_warm_module_v1:预热借类方法本体,类在此登记(见 ./pdWarm)
export {
	AstroDirectMain,
	warmPrimaryDirection,
};
export default AstroDirectMain;
