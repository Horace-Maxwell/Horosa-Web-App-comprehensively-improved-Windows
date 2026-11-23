import { Component } from 'react';
import { classicalBackendOverridesFromPlain, chartOrbOverridesFromPlain } from '../../utils/classicalChartGlobals';
import { userAyanParamsFrom } from '../../utils/customCalibreStores';   // 'user' 恒星黄道历元参数
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Row, Col, } from 'antd';
import { XQButton as Button, XQCard as Card, XQSelect as Select, XQTabs as Tabs } from '../xq-ui';
import QuickDockBar from '../common/QuickDockBar';
import AstroChartMain from '../astro/AstroChartMain';
import GeoCoordModal from '../amap/GeoCoordModal';
import SuZhanMain from '../suzhan/SuZhanMain';
// 🔴 3D 盘必须懒加载,绝不可改回静态 import(与星运页同族病灶,2026-08-01 一并治理):
//   静态引它 → AstroChartMain3D → AstroChart3D → Astro3D → three + OrbitControls/GLTFLoader/
//   DRACOLoader/Stats/lil-gui/FontLoader + 两个大 JSON 字体&模型资产,整条链成为本页 chunk 的
//   **同步依赖** —— 进节气页(24 节气各自的星盘/宿盘页签)就得先解析完这一大坨,而只有「3D盘」
//   那个页签用得着。本页已有 render3d 条件门(不激活不挂载),懒化后「不打开=零成本」天然成立。
//   注:本页无 FreezeInactive,故边界由 makeLazyBoundary 自带的 TechniqueErrorBoundary 提供。
import { makeLazyBoundary, idleWarm } from '../../utils/lazyBoundary';
import * as Constants from '../../utils/constants';
import * as AstroConst from '../../constants/AstroConst';
import { randomStr } from '../../utils/helper';
import {convertLatStrToDegree, convertLonStrToDegree, convertLatToStr, convertLonToStr} from '../astro/AstroHelper';
import { dstAwareZoneAt } from '../../utils/timezone';
import styles from '../../css/styles.less';
import DateTime from '../comp/DateTime';
import DateTimeSelector from '../comp/DateTimeSelector';
import { getHousesOption } from '../comp/CompHelper'
import { saveModuleAISnapshot, clearModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { fetchPreciseJieqiYear } from '../../utils/preciseCalcBridge';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import UpdatingBadge from '../common/UpdatingBadge';
import { paramsToFields, hookBirthSig, fieldsToState } from './main/fields';
import { getSeedCacheKey, getJieqiFourColumns, compactJieqiSeedResult, mergeJieqiRows, cacheJieqiSeedRows, findJieqiRow, loadJieqiChart, mergeJieQiCharts, isJieQiChartCompatible } from './main/charts';
import { buildJieQiSnapshotText, parseJieQiTab, buildJieQiCurrentSnapshotText, tabNeedsJieqiCharts, jieqiSnapshotMeta } from './main/snapshot';
import { markPanelReady } from '../../utils/perfMark';
import { prefetchJieqiYearNeighbors } from '../../utils/preciseCalcBridge';
export { hookBirthSig, warmJieqiYear } from './main/fields';
export { mergeJieQiCharts, isJieQiChartCompatible } from './main/charts';
export { buildJieQiSnapshotText, buildJieQiSnapshotForRecordFields, buildJieQiCurrentSnapshotText } from './main/snapshot';

const TabPane = Tabs.TabPane;

// horosa_shallow_scu_v1:逐键浅比较。**未知即"变了"** —— 键数不同 / 任一键引用不同 → 返回 false
// (调用方据此 return true 照常渲染)。绝不做深比较,绝不放过任何不确定的字段。
//
// ★复核补丁(horosa_scu_arraywise_v1):只按引用比会让本 sCU **永久空转**。
//   pages/index.js:667 `let aryfields = convertToArray(fields);` 在 AstroIndex 每次 render 里
//   重新建数组 → 传下来的 fieldsAry 引用恒变 → shallowSame 恒 false → sCU 恒返 true,
//   等于没加。而 convertToArray 只是把 fields 的**同一批子对象**塞进新数组(helper.js:548
//   `res.push(obj[key])`),元素引用在 fields 未变时逐个不变。故对数组降一级做**逐元素引用**比:
//   长度相等且每个元素 === → 判同。这仍然是纯引用语义(不看元素内部字段),
//   与"宁可多渲、绝不漏渲"取向一致 —— 元素对象只要被换过引用就立刻判"变了"。
//   同款问题在 utils/chartUpdateGuard.js 的 wrapperPropsEqual 上也存在(它对 fieldsAry 走
//   Object.is),那是共享件、不在本轮授权范围,已在汇报里点名交主控。
function sameArrayByRef(a, b){
	if(a.length !== b.length){ return false; }
	for(let i=0; i<a.length; i++){
		if(a[i] !== b[i]){ return false; }
	}
	return true;
}
function shallowSame(a, b){
	if(a === b){ return true; }
	if(!a || !b || typeof a !== 'object' || typeof b !== 'object'){ return false; }
	const ka = Object.keys(a);
	const kb = Object.keys(b);
	if(ka.length !== kb.length){ return false; }
	for(let i=0; i<ka.length; i++){
		const k = ka[i];
		if(!Object.prototype.hasOwnProperty.call(b, k)){ return false; }
		if(a[k] === b[k]){ continue; }
		if(Array.isArray(a[k]) && Array.isArray(b[k]) && sameArrayByRef(a[k], b[k])){ continue; }
		return false;
	}
	return true;
}
const {Option, OptGroup} = Select
// 3D 盘懒加载(见上方 makeLazyBoundary 引用处的说明:绝不可改回静态 import)
const AstroChartMain3D = makeLazyBoundary(
	() => import(/* webpackChunkName: "astro-chart-3d" */ '../astro3d/AstroChartMain3D'),
	{ label: '3D 盘', tip: '3D 盘加载中…' }
);

export class JieQiChartsMain extends Component{
	// v3.6.0 收敛注(#78 双 sCU 防复发):上游同类内也带一份通用 wrapperPropsEqual 渲染守卫,
	// 与本类内另一份我方细化守卫重复(JS 后者静默胜出)。按「单一 sCU」纪律移除上游份,
	// 我方守卫语义为其超集(state 引用变照常放行 + 页面专属无关键剔除)。
	constructor(props) {
		super(props);

		let now = new DateTime();
		this.state = {
			divid: 'div_' + randomStr(8),
			currentTab: '二十四节气',
			result: {},
			time: now,
			zone: now.zone,
			lat: Constants.DefLat,
			lon: Constants.DefLon,
			ad: now.ad,
			hsys: 0,
			zodiacal: 0,
			siderealAyanamsa: '',
			doubingSu28: 0,
			gpsLat: Constants.DefGpsLat,
			gpsLon: Constants.DefGpsLon,
			jieqis: ['春分', '夏至', '秋分', '冬至'],
			fields: {},

			hook:{
				suzhan:{
					fun: null
				},
				chart3d:{
					fun: null
				},	
			},
		}

		this.unmounted = false;
		this.snapshotTimer = null;
		this.requestSeq = 0;
		this.pendingSeedRequest = null;
		this.lastSeedResultKey = '';
		this.chartRequestSeq = 0;
		this.pendingChartRequest = null;
		this.lastChartResultKey = '';
		this.baziRequestSeq = 0;
		this.pendingBaziRequest = null;
		this.lastBaziResultKey = '';

		this.changeTab = this.changeTab.bind(this);
		this.requestJieQi = this.requestJieQi.bind(this);
		this.requestJieQiCharts = this.requestJieQiCharts.bind(this);
		this.requestJieQiBazi = this.requestJieQiBazi.bind(this);
		this.currentTabNeedsCharts = this.currentTabNeedsCharts.bind(this);
		this.ensureChartsForTab = this.ensureChartsForTab.bind(this);
		this.genParams = this.genParams.bind(this);
		this.genSeedParams = this.genSeedParams.bind(this);
		this.genChartParams = this.genChartParams.bind(this);

		this.onLatChanged = this.onLatChanged.bind(this);
		this.onLonChanged = this.onLonChanged.bind(this);
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.onZoneChanged = this.onZoneChanged.bind(this);
		this.onAdChanged = this.onAdChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.changeHsys = this.changeHsys.bind(this);
		this.changeZodiacal = this.changeZodiacal.bind(this);
		this.onSuZhanFieldsChange = this.onSuZhanFieldsChange.bind(this);

		this.gen24JieqiDom = this.gen24JieqiDom.bind(this);
		this.genTabsDom = this.genTabsDom.bind(this);
		this.renderBottomQuickDock = this.renderBottomQuickDock.bind(this);
		this.saveCurrentJieQiSnapshot = this.saveCurrentJieQiSnapshot.bind(this);
		this.scheduleJieqiSnapshotSave = this.scheduleJieqiSnapshotSave.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		let params = this.genSeedParams();
		this.state.fields = paramsToFields(params);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				if(fields){
					let st = fieldsToState(fields);
					// 全局 hook 只在「出生时空真变」时覆盖本页年份/时区/地点;仅改设置(宫制/黄道/古典口径…)或
					// 内嵌左栏点「重算星盘」时,保留用户用「上一年/下一年」/工具条改过的年份与地点(此前一律整组重置回主盘)。
					if(this._lastHookBirthSig !== undefined && this._lastHookBirthSig === hookBirthSig(fields)){
						['time', 'ad', 'zone', 'lat', 'lon', 'gpsLat', 'gpsLon'].forEach((k)=>{ delete st[k]; });
					}
					this._lastHookBirthSig = hookBirthSig(fields);
					this.setState(st, ()=>{
						if(this.unmounted){
							return;
						}
						this.requestJieQi();
					});
				}else{
					this.requestJieQi();
				}
			};
		}

	}

	genParams(includeJieqis=true){
		const params = {
			year: this.state.time.format('YYYY'),
			ad: this.state.ad,
			zone: this.state.zone,
			lon: this.state.lon,
			lat: this.state.lat,
			hsys: this.state.hsys,
			zodiacal: this.state.zodiacal,
			siderealAyanamsa: this.state.siderealAyanamsa,
			gpsLat: this.state.gpsLat,
			gpsLon: this.state.gpsLon,
			doubingSu28: this.state.doubingSu28,
			after23NewDay: defaultAfter23NewDay(),
			lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
		};
		// 🔴 古典口径 16 键随分至盘透传:fieldsToState 早已把它们提进 state,但 genParams
		// 曾不输出 → 下游条件透传与 classicalBackendOverridesFromPlain 恒空、缓存键六项恒
		// undefined,「六构参点自动同步」的承诺在分至盘这一路断链(用户改界系/三分/福点反转…
		// 二分二至四盘静默走后端默认,与主盘系统性分叉且改设置也不重取)。
		[
			'termsVariant', 'geminiBoundEmended', 'leoBoundFirst', 'triplicity', 'lotReversal',
			'westNodeType', 'sectBuffer',
		].forEach((k)=>{
			const v = this.state[k];
			if(v !== undefined && v !== null && v !== ''){ params[k] = v; }
		});
		// 古典九键覆盖走单源 helper:自带 fixedStarOrb→starOrb / fixedStarOrbMode→starOrbMode 的
		// 后端名映射与「仅非默认才下发」纪律 —— 🔴 曾按前端名直发,恒星容许度两键后端 data.get
		// 恒未命中(16 键断链只真通了 14 键),且默认值也进请求体与主盘构参纪律分叉。
		Object.assign(params, classicalBackendOverridesFromPlain(this.state));
		// 随盘容许度(设置 → 容许度设置):二分二至盘的相位与主盘同一套
		Object.assign(params, chartOrbOverridesFromPlain(this.state));
		// 'user' 恒星黄道:历元两键随 params(fields 有值优先,缺读当前槽)。
		if(`${this.state.siderealAyanamsa}` === 'user'){
			Object.assign(params, userAyanParamsFrom((k)=>this.state[k]));
		}
		if(includeJieqis){
			params.jieqis = this.state.jieqis;
		}
		return params;
	}

	genSeedParams(){
		return this.genParams(false);
	}

	genChartParams(seedParams){
		const base = seedParams || this.genSeedParams();
		return {
			...base,
			jieqis: this.state.jieqis,
		};
	}

	currentTabNeedsCharts(tab){
		return tabNeedsJieqiCharts(tab || this.state.currentTab, this.state.jieqis);
	}

	ensureChartsForTab(tab){
		if(!this.currentTabNeedsCharts(tab)){
			return null;
		}
		const titleInfo = parseJieQiTab(tab || this.state.currentTab, this.state.jieqis);
		const title = titleInfo && titleInfo.title ? titleInfo.title : null;
		if(title && this.state.result && this.state.result.charts && this.state.result.charts[title]){
			return Promise.resolve(this.state.result.charts[title]);
		}
		const seedParams = this.genSeedParams();
		return this.requestJieQiCharts(seedParams, this.requestSeq);
	}

	getSeedRequestKey(params){
		const p = params || this.genSeedParams();
		return [
			getSeedCacheKey(p),
			p && p.hsys,
			p && p.zodiacal,
			p && p.doubingSu28,
			p && p.seedOnly ? 1 : 0,
		].join('|');
	}

	getChartRequestKey(params, tab){
		const p = params || this.genSeedParams();
		const info = parseJieQiTab(tab || this.state.currentTab, this.state.jieqis);
		const title = info && info.title ? info.title : '';
		// 与 getChartCacheKey 同维(曾少 siderealAyanamsa 与古典六键 → 换岁差/界系时
		// 去重键不变,pendingChartRequest 会把新一轮请求当重复丢掉)。
		return [
			getSeedCacheKey(p),
			p && p.hsys,
			p && p.zodiacal,
			p && p.siderealAyanamsa,
			p && p.doubingSu28,
			p && p.termsVariant,
			p && p.triplicity,
			p && p.lotReversal,
			p && p.westNodeType,
			p && p.sectBuffer,
			p && p.leoBoundFirst,
			p && p.after23NewDay,
			p && p.lateZiHourUseNextDay,
			title,
		].join('|');
	}

	async requestJieQi(){
		const seedParams = this.genSeedParams();
		const needsCharts = this.currentTabNeedsCharts();
		const flds = paramsToFields(seedParams, this.state.fields);
		const seq = ++this.requestSeq;
		this.setState({
			fields: flds,
		});
		const chartsPromise = needsCharts
			? this.requestJieQiCharts(seedParams, seq, this.state.currentTab)
			: null;
		const baziPromise = this.requestJieQiBazi(seedParams, seq);
		// horosa_panel_ready_v1:本族的「画完」不是单点 —— 中栏 24 节气总览来自 bazi 请求,
		// 右栏盘来自 charts 请求,两者各自 setState。故取**两者都落定**之后为就绪点
		// (命中缓存的一路会立即 resolve,不影响另一路)。markPanelReady 内部双 rAF 逼近本帧已绘,
		// 且同一次交互只记第一条;markInteractionStart 未打过时(挂载首刷)自动空转。
		Promise.all([chartsPromise, baziPromise]).then(()=>{
			if(this.unmounted){ return; }
			markPanelReady('jieqichart');
		}).catch(()=>{ /* 失败不记样本 */ });
		return baziPromise;
	}

	async requestJieQiCharts(seedParams, seedSeq, tab){
		const currentTab = tab || this.state.currentTab;
		const info = parseJieQiTab(currentTab, this.state.jieqis);
		if(!info || !info.title){
			return null;
		}
		const title = info.title;
		const reqParams = seedParams || this.genSeedParams();
		const reqKey = this.getChartRequestKey(reqParams, currentTab);
		if(this.pendingChartRequest && this.pendingChartRequest.key === reqKey){
			return this.pendingChartRequest.promise;
		}
		const cachedChart = this.state.result
			&& this.state.result.charts
			? this.state.result.charts[title]
			: null;
		if(this.state.result
			&& this.state.result.charts
			&& cachedChart
			&& isJieQiChartCompatible(cachedChart, reqParams)){
			this.lastChartResultKey = reqKey;
			return cachedChart;
		}
		const seq = ++this.chartRequestSeq;
		const reqPromise = (async()=>{
			let rows = this.state.result && Array.isArray(this.state.result.jieqi24)
				? this.state.result.jieqi24 : [];
			let row = findJieqiRow(rows, title);
			if(!row || !row.time){
				rows = await this.requestJieQiBazi(reqParams, seedSeq);
				row = findJieqiRow(rows, title);
			}
			if(!row || !row.time || this.unmounted){
				return null;
			}
			if(seedSeq !== undefined && seedSeq !== this.requestSeq){
				return null;
			}
			if(seq !== this.chartRequestSeq){
				return null;
			}
			// keep-stale:旧盘留存,后台重取期间盘网格挂统一角标;抛错/空回包(request 失败可能
			// resolve undefined)吞掉只收角标,绝不清旧盘
			this.setState({ updating: true });
			let chartObj = null;
			try{
				chartObj = await loadJieqiChart(reqParams, title, row.time);
			}catch(e){
				chartObj = null;
			}
			if(this.unmounted){
				return chartObj;
			}
			// 本轮已被更新一轮盘请求顶掉:角标交由新请求收尾,这里不动(避免旧请求回来掐灭新一轮角标)
			if(seq !== this.chartRequestSeq){
				return chartObj;
			}
			if(!chartObj || (seedSeq !== undefined && seedSeq !== this.requestSeq)){
				this.setState({ updating: false });
				return chartObj;
			}
			this.lastChartResultKey = reqKey;
			this.setState((prev)=>{
				const prevResult = prev.result || {};
				return {
					updating: false,
					result: {
						...prevResult,
						// 种子参数(年份/地点/宫制/黄道/岁差/宿度制/古典键)变了,其余节气的旧盘一并丢弃——
						// 此前 charts 只增不清、兼容判定只在访问该盘页签时做 → 整年快照 [节气盘参数] 新值、各盘旧盘混参。
						charts: mergeJieQiCharts(prevResult.charts, title, chartObj, reqParams),
					},
				};
				}, ()=>{
					this.saveCurrentJieQiSnapshot(this.state.currentTab, this.state.result, this.state.fields);
					this.scheduleJieqiSnapshotSave(this.state.result, this.state.fields, reqParams);
				});
			return chartObj;
		})().finally(()=>{
			if(this.pendingChartRequest && this.pendingChartRequest.seq === seq){
				this.pendingChartRequest = null;
			}
		});
		this.pendingChartRequest = {
			key: reqKey,
			seq,
			promise: reqPromise,
		};
		return reqPromise;
	}

	async requestJieQiBazi(seedParams, seedSeq){
		const reqKey = this.getSeedRequestKey(seedParams);
		if(this.pendingBaziRequest && this.pendingBaziRequest.key === reqKey){
			return this.pendingBaziRequest.promise;
		}
		if(this.lastBaziResultKey === reqKey
			&& this.state.result
			&& Array.isArray(this.state.result.jieqi24)
			&& this.state.result.jieqi24.some((item)=>item && item.bazi && item.bazi.fourColumns)){
			return this.state.result.jieqi24;
		}
		const seq = ++this.baziRequestSeq;
		const reqPromise = (async()=>{
			const fullResult = await fetchPreciseJieqiYear(seedParams);
			if(fullResult){
				// PERF-R8 P3:当前年取到后静默预取 year±1(同参仅换年;幂等三层缓存;
				// generation 门控防连点风暴)→ 年份步进=命中即时。失败静默。
				prefetchJieqiYearNeighbors(seedParams);
			}
			if(!fullResult || this.unmounted){
				return fullResult;
			}
			if(seedSeq !== undefined && seedSeq !== this.requestSeq){
				return fullResult;
			}
			if(seq !== this.baziRequestSeq){
				return fullResult;
			}
			const compact = compactJieqiSeedResult(fullResult);
			const fullRows = compact && Array.isArray(compact.jieqi24) ? compact.jieqi24 : [];
			if(!fullRows.length){
				return fullRows;
			}
			cacheJieqiSeedRows(seedParams, fullRows);
			this.lastBaziResultKey = reqKey;
			this.setState((prev)=>{
				const prevResult = prev.result || {};
				const mergedJieqi24 = mergeJieqiRows(prevResult.jieqi24, fullRows);
				return {
					result: {
						...prevResult,
						jieqi24: mergedJieqi24,
					},
				};
			}, ()=>{
				this.saveCurrentJieQiSnapshot(this.state.currentTab, this.state.result, this.state.fields);
				this.scheduleJieqiSnapshotSave(this.state.result, this.state.fields, seedParams);
			});
			return fullRows;
		})().finally(()=>{
			if(this.pendingBaziRequest && this.pendingBaziRequest.seq === seq){
				this.pendingBaziRequest = null;
			}
		});
		this.pendingBaziRequest = {
			key: reqKey,
			seq,
			promise: reqPromise,
		};
		return reqPromise;
	}

	// 快照 meta 的参数:最近一次存快照时的起盘参数(没有就按当前状态现算)
	snapshotParams(){
		if(this.lastSnapshotParams){ return this.lastSnapshotParams; }
		try{ return this.genSeedParams(); }catch(e){ return {}; }
	}

	scheduleJieqiSnapshotSave(result, fields, params){
		if(this.snapshotTimer){
			if(typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function'){
				window.cancelIdleCallback(this.snapshotTimer);
			}else{
				clearTimeout(this.snapshotTimer);
			}
			this.snapshotTimer = null;
		}
		this.lastSnapshotParams = params || null;
		const saveJob = ()=>{
			if(this.unmounted){
				return;
			}
			saveModuleAISnapshot('jieqi', buildJieQiSnapshotText(result, fields, this.state.jieqis, this.props.planetDisplay), jieqiSnapshotMeta(params));
			saveModuleAISnapshot('jieqi_current', buildJieQiCurrentSnapshotText(this.state.currentTab, result, fields, this.state.jieqis, this.props.planetDisplay), jieqiSnapshotMeta(params, this.state.currentTab));
		};
		// 节气快照在空闲时保存，避免主线程卡顿。
		if(typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'){
			this.snapshotTimer = window.requestIdleCallback(saveJob, { timeout: 1200 });
		}else{
			this.snapshotTimer = setTimeout(saveJob, 220);
		}
	}

	changeTab(key){
		this.setState({
			currentTab: key,
		}, ()=>{
			this.ensureChartsForTab(key);
			this.saveCurrentJieQiSnapshot(key);
			if(this.props.dispatch){
				this.props.dispatch({
					type: 'astro/save',
					payload: {
					currentSubTab: key,
					},
				});
			}	
		});
	}

	saveCurrentJieQiSnapshot(currentTab, result, flds){
		const tab = currentTab || this.state.currentTab;
		// 不传 = 屏上那一份(结果与时刻成对取;调用方要么两样都传、要么都不传)
		const rs = result === undefined ? this.state.result : result;
		const fields = flds === undefined ? this.state.fields : flds;
		const txt = buildJieQiCurrentSnapshotText(tab, rs, fields, this.state.jieqis, this.props.planetDisplay);
		if(!txt){
			// 非盘页签(总览/参数)本就不产「当前盘」快照 → 必须真清槽:此前早退且 save 空文不覆盖,
			// 上一次访问的单盘常驻,导出优先取 jieqi_current → 吐旧盘、上下文键也据此误判分键。
			clearModuleAISnapshot('jieqi_current');
			return;
		}
		saveModuleAISnapshot('jieqi_current', txt, jieqiSnapshotMeta(this.snapshotParams(), tab));
	}

	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'jieqi' && moduleName !== 'jieqi_current'){
			return;
		}
		const result = this.state ? this.state.result : null;
		const fields = this.state ? this.state.fields : null;
		const jieqis = this.state ? this.state.jieqis : null;
		const currentTab = this.state ? this.state.currentTab : null;
		let text = '';
		try{
			if(moduleName === 'jieqi_current'){
				text = `${buildJieQiCurrentSnapshotText(currentTab, result, fields, jieqis, this.props.planetDisplay) || ''}`.trim();
			}else{
				text = `${buildJieQiSnapshotText(result, fields, jieqis, this.props.planetDisplay) || ''}`.trim();
			}
		}catch(e){
			text = '';
		}
		if(text){
			// 与平时写槽同一份 meta(此前只传两个参数:刷新一次槽的 meta 就变成 {},读盘方丢了年份 / 时区 / 经纬)
			saveModuleAISnapshot(moduleName, text, jieqiSnapshotMeta(this.snapshotParams(), moduleName === 'jieqi_current' ? currentTab : undefined));
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	onAdChanged(value){
		this.setState({
			ad: value,
		}, ()=>{
			this.requestJieQi()
		});
	}

	onTimeChanged(val){
		// 工具条 AD/BC 走 DateTimeSelector.changeAD → 只改 DateTime.ad;此前 state.ad 不跟着改 →
		// year(带符号)与 ad 两路不同形(主盘为公元前时切回 AD,后端仍按 ad=-1 起四柱)。与宿盘内嵌时空面板(写 ad)同口径。
		const next = { time: val.value };
		if(val && val.value && (val.value.ad === 1 || val.value.ad === -1)){ next.ad = val.value.ad; }
		this.setState(next, ()=>{
			this.requestJieQi()
		});
	}

	onZoneChanged(val){
		this.setState({
			zone: val,
		}, ()=>{
			this.requestJieQi()
		});
	}

	onLatChanged(value){
		// 经纬度文本即真坐标(WGS84,与选点弹窗 / AI 地名解析同口径):gps 直接取它,不再当高德加偏点反算
		let geo = { lat: convertLatStrToDegree(value), lon: convertLonStrToDegree(this.state.lon) };

		this.setState({
			lat: value,
			gpsLat: geo.lat,
			gpsLon: geo.lon
		});

	}

	onLonChanged(value){
		let geo = { lat: convertLatStrToDegree(this.state.lat), lon: convertLonStrToDegree(value) };   // 同上:文本即真坐标
		this.setState({
			lon: value,
			gpsLat: geo.lat,
			gpsLon: geo.lon
		});
	}

	changeGeo(rec){
		// 选新地点时按新坐标自动校正时区(未在 atlas 内手改时区时),genParams 读 this.state.zone。
		// setZone 仅改时区标签、保留钟面时刻(见 DateTime.setZone),不移位时间。
		const patch = {
			lon: convertLonToStr(rec.lng),
			lat: convertLatToStr(rec.lat),
			gpsLon: rec.gpsLng,
			gpsLat: rec.gpsLat,
		};
		const cur = this.state.time;
		try{
			if(rec.zone){
				patch.zone = rec.zone;
				if(cur && cur.clone){ const d = cur.clone(); d.setZone(rec.zone); patch.time = d; }
			}else{
				const ds = (cur && cur.format) ? cur.format('YYYY-MM-DD') : null;
				const z = dstAwareZoneAt(rec.gpsLat, rec.gpsLng, ds);
				if(z && z.offset){
					patch.zone = z.offset;
					if(cur && cur.clone){ const d = cur.clone(); d.setZone(z.offset); patch.time = d; }
				}
			}
		}catch(e){ /* 推断失败保留原时区 */ }
		this.setState(patch, ()=>{
			this.requestJieQi()
		});
	}

	changeZodiacal(val){
		const parsed = AstroConst.parseZodiacSelectValue(val);
		this.setState({
			zodiacal: parsed.zodiacal,
			siderealAyanamsa: parsed.siderealAyanamsa,
		}, ()=>{
			this.requestJieQi()
		})
	}

	changeHsys(val){
		this.setState({
			hsys: val,
		}, ()=>{
			this.requestJieQi()
		})
	}

	onSuZhanFieldsChange(changedFields){
		const patch = changedFields || {};
		const mergedFields = {
			...(this.state.fields || {}),
			...patch,
		};
		const statePatch = {
			fields: mergedFields,
		};
		const needReload = ['date', 'time', 'ad', 'zone', 'lat', 'lon', 'gpsLat', 'gpsLon', 'doubingSu28']
			.some((key)=>Object.prototype.hasOwnProperty.call(patch, key));

		if(patch.date && patch.date.value){
			statePatch.time = patch.date.value;
		}
		if(patch.zone && patch.zone.value !== undefined && patch.zone.value !== null){
			statePatch.zone = patch.zone.value;
		}
		if(patch.ad && patch.ad.value !== undefined && patch.ad.value !== null){
			statePatch.ad = patch.ad.value;
		}
		if(patch.lat && patch.lat.value){
			statePatch.lat = patch.lat.value;
		}
		if(patch.lon && patch.lon.value){
			statePatch.lon = patch.lon.value;
		}
		if(patch.gpsLat && patch.gpsLat.value !== undefined && patch.gpsLat.value !== null){
			statePatch.gpsLat = patch.gpsLat.value;
		}
		if(patch.gpsLon && patch.gpsLon.value !== undefined && patch.gpsLon.value !== null){
			statePatch.gpsLon = patch.gpsLon.value;
		}
		if(patch.doubingSu28 && patch.doubingSu28.value !== undefined && patch.doubingSu28.value !== null){
			statePatch.doubingSu28 = patch.doubingSu28.value;
		}

		this.setState(statePatch, ()=>{
			if(needReload){
				this.requestJieQi();
				return;
			}
			this.saveCurrentJieQiSnapshot(this.state.currentTab, this.state.result, this.state.fields);
		});
	}

	gen24JieqiDom(){
		let dom = null;
		if(this.state.result.jieqi24 === undefined || this.state.result.jieqi24 === null){
			return dom;
		}

		// horosa_jieqi24_memo_v1:中栏总览只取决于 jieqi24 这一个数组(纯数据 → 纯 JSX,无 props/state
		// 其它入参)。数组引用没变时复用上次的元素树 —— 24 张卡 ×2 行干支/纳音的 map 不再重算,
		// 也让 React 对这段直接走 bailout。数据一变(合并出新数组)引用即变,立刻重建,不会陈旧。
		const src = this.state.result.jieqi24;
		if(this._jieqi24Memo && this._jieqi24Memo.src === src){
			return this._jieqi24Memo.dom;
		}

		let cols = src.map((item, idx)=>{
			const fourCols = getJieqiFourColumns(item);
			const key = item && item.jieqi ? item.jieqi : `jieqi_${idx}`;
			const yearCol = fourCols && fourCols.year ? fourCols.year : null;
			const monthCol = fourCols && fourCols.month ? fourCols.month : null;
			const dayCol = fourCols && fourCols.day ? fourCols.day : null;
			const timeCol = fourCols && fourCols.time ? fourCols.time : null;
			// 有盘的节气(二分二至)卡片点即开该节气盘;其余节气只列时刻与四柱
			const openable = !!(item && item.jieqi && (this.state.jieqis || []).indexOf(item.jieqi) >= 0);
			return (
				<Col key={key} span={6}>
					<Card title={item && item.jieqi ? item.jieqi : ''} bordered={false}
						hoverable={openable}
						className={openable ? 'horosa-jieqi-card-openable' : undefined}
						style={openable ? { cursor: 'pointer' } : undefined}
						onClick={openable ? ()=>this.changeTab(item.jieqi) : undefined}>
						<Row>
							<Col span={24}>{item && item.time ? item.time : ''}</Col>
							{
								yearCol && (
									<Col span={24} style={{textAlign:'center'}}>
										<Row gutter={6}>
											<Col span={6}>
												{yearCol.ganzi}
											</Col>
											<Col span={6}>
												{monthCol ? monthCol.ganzi : ''}
											</Col>
											<Col span={6}>
												{dayCol ? dayCol.ganzi : ''}
											</Col>
											<Col span={6}>
												{timeCol ? timeCol.ganzi : ''}
											</Col>
										</Row>
									</Col>	
								)
							}
							{
								yearCol && (
									<Col span={24} style={{textAlign:'center'}}>
										<Row gutter={6}>
											<Col span={6}>
												{yearCol.naying}
											</Col>
											<Col span={6}>
												{monthCol ? monthCol.naying : ''}
											</Col>
											<Col span={6}>
												{dayCol ? dayCol.naying : ''}
											</Col>
											<Col span={6}>
												{timeCol ? timeCol.naying : ''}
											</Col>
										</Row>
									</Col>	
								)
							}
						</Row>					
					</Card>
				</Col>
			);
		});

		dom = (
			<Row gutter={12}>
				{cols}
			</Row>
		);
		this._jieqi24Memo = { src, dom };
		return dom;
	}

	genTabsDom(height){
		let tabs = [];
		const charts = this.state.result && this.state.result.charts ? this.state.result.charts : {};
		for(let i=0; i<this.state.jieqis.length; i++){
			let title = this.state.jieqis[i];
			let chart = charts[title];
			if(!chart){
				tabs.push(
					<TabPane tab={title+'星盘'} key={title}>
						<div style={{ padding: 12 }}>加载中...</div>
					</TabPane>
				);
				tabs.push(
					<TabPane tab={title+'宿盘'} key={'宿盘'+title}>
						<div style={{ padding: 12 }}>加载中...</div>
					</TabPane>
				);
				tabs.push(
					<TabPane tab={title+'3D盘'} key={'3D盘'+title}>
						<div style={{ padding: 12 }}>加载中...</div>
					</TabPane>
				);
				continue;
			}
			let flds = {
				...(this.props.fields || {}),
				...(this.state.fields || {}),
			};
			if(chart.params){
				flds = paramsToFields(chart.params, flds);
			}
			const starKey = title;
			const suKey = '宿盘'+title;
			const d3Key = '3D盘'+title;
			const renderStar = this.state.currentTab === starKey;
			const renderSu = this.state.currentTab === suKey;
			const render3d = this.state.currentTab === d3Key;
			let tab = (
				<TabPane tab={title+'星盘'} key={starKey}>
					{renderStar ? (
						<AstroChartMain embeddedSubChart
							hidehsys={1}
							hidezodiacal={1}
							hidedateselector={true}
							hideRecalc   /* 内嵌星盘的「重算星盘」实为重算隐藏主盘,对本分至盘无意义 → 不渲染 */
							height={height}
							fields={flds}
							value={chart}
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							showPlanetHouseInfo={this.props.showPlanetHouseInfo}
							showAstroMeaning={this.props.showAstroMeaning}
							chartStyle={this.props.chartStyle}
							wheelArt={this.props.wheelArt}
							dispatch={this.props.dispatch}
						/>) : null}
				</TabPane>

			);
			tabs.push(tab);

			let sztab = (
				<TabPane tab={title+'宿盘'} key={suKey}>
					{renderSu ? (
					<SuZhanMain
						value={chart}
						height={height}
						hideQuickDock={true}
						embeddedReadOnly
						fields={flds}
						chartDisplay={this.props.chartDisplay}
						planetDisplay={this.props.planetDisplay}
						hook={this.state.hook.suzhan}
						onFieldsChange={this.onSuZhanFieldsChange}
						dispatch={this.props.dispatch}
					/>) : null}
				</TabPane>
			);
			tabs.push(sztab);

			let tab3d = (
				<TabPane tab={title+'3D盘'} key={d3Key}>
					{render3d ? (
						<AstroChartMain3D
							hidehsys={1}
							hidezodiacal={1}
							hidedateselector={true}
							needChart3D={true}
							value={chart}
							height={height}
							fields={flds}
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}	
							showPlanetHouseInfo={this.props.showPlanetHouseInfo}
							showAstroMeaning={this.props.showAstroMeaning}
						/>) : null}
				</TabPane>
			);
			tabs.push(tab3d);

		}

		return tabs;
	}

	// 快捷栏契约:节气选择交给中栏总览网格(点即开盘),本栏只放「页面上没有」的动词——
	// 年份翻页(左栏改时间要开日期控件多步,这里一键)与当前节气的三种视图切换。
	// 旧版把 24 节气×3 种盘全铺成 73+ 个按钮(目录复制),已废弃。
	// state.time 是 DateTime 实例(onTimeChanged/requestJieQi 消费同型),不能塞 moment/字符串。
	shiftJieQiYear(delta){
		if(delta === 0){
			this.onTimeChanged({ value: new DateTime() });
			return;
		}
		const cur = this.state.time;
		const base = cur && cur.clone && cur.setYear ? cur.clone() : new DateTime();
		// 天文纪年无 0 年:BC1(-1)+1 曾算成 0 → setYear 把 0 复位回 BC1,「下一年」在公元前 1 年卡死;跨 0 直接跳过。
		let target = base.ad * base.year + delta;
		if(target === 0){ target = delta > 0 ? 1 : -1; }
		base.setYear(target);
		this.onTimeChanged({ value: base });
	}

	switchJieQiView(type){
		const info = parseJieQiTab(this.state.currentTab, this.state.jieqis);
		if(!info){
			return;
		}
		const key = type === 'astro' ? info.title
			: (type === 'suzhan' ? `宿盘${info.title}` : `3D盘${info.title}`);
		this.changeTab(key);
	}

	renderBottomQuickDock(){
		const info = parseJieQiTab(this.state.currentTab, this.state.jieqis);
		const onChartTab = !!info;
		const hasCharts = !!(this.state.result && this.state.result.charts
			&& Object.keys(this.state.result.charts).length);
		return (
			<QuickDockBar
				page="jieqi"
				className="horosa-jieqi-quick-dock"
				hasResult={hasCharts || (this.state.jieqis || []).length > 0}
				primary={{
					key: 'overview',
					label: '二十四节气',
					active: this.state.currentTab === '二十四节气',
					onClick: ()=>this.changeTab('二十四节气'),
				}}
				extras={[
					{ key: 'prevYear', label: '上一年', icon: 'quickTransit', needsResult: false, onClick: ()=>this.shiftJieQiYear(-1) },
					{ key: 'thisYear', label: '回今年', icon: 'quickComposite', needsResult: false, onClick: ()=>this.shiftJieQiYear(0) },
					{ key: 'nextYear', label: '下一年', icon: 'quickTransit', needsResult: false, onClick: ()=>this.shiftJieQiYear(1) },
					{ key: 'viewAstro', label: '星盘', icon: 'quickNote', disabled: !onChartTab, active: onChartTab && info.type === 'astro', onClick: ()=>this.switchJieQiView('astro') },
					{ key: 'viewSuzhan', label: '宿盘', icon: 'quickReturn', disabled: !onChartTab, active: onChartTab && info.type === 'suzhan', onClick: ()=>this.switchJieQiView('suzhan') },
					{ key: 'view3d', label: '3D盘', icon: 'quickComposite', disabled: !onChartTab, active: onChartTab && info.type === 'astro3d', onClick: ()=>this.switchJieQiView('astro3d') },
				]}
				dispatch={this.props.dispatch}
			/>
		);
	}

	componentDidMount(){
		this.unmounted = false;
		// 3D 盘 chunk 空闲预热:不打开 3D 页签=零成本,真去点时通常已就绪。卸载时必须 cancel。
		this._cancel3dWarm = idleWarm(AstroChartMain3D, { timeout: 2500 });
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if(this.props.fields){
			let st = fieldsToState(this.props.fields);
			this.setState(st, ()=>{
				if(this.unmounted){
					return;
				}
				this.requestJieQi();
			});
		}else{
			this.requestJieQi();
		}
	}

	// horosa_shallow_scu_v1:本组件此前**无 sCU**,父层(pages/index.js)任何一次 re-render 都会
	// 让这棵 1800 行的树连同 24 张卡片 + 右栏盘整树重算。这里只做「props 与 state 都逐键同引用
	// 才跳过」的最保守判断:任何键的引用变化(含 result/fields/time/hook)一律返回 true 照常渲染,
	// 键数不同也返回 true。因此只会跳过**输入完全没变**的重复渲染,不可能漏更新。
	shouldComponentUpdate(nextProps, nextState){
		if(!shallowSame(this.props, nextProps)){ return true; }
		if(!shallowSame(this.state, nextState)){ return true; }
		return false;
	}

	componentDidUpdate(prevProps){
		const fieldsChanged = prevProps.fields !== this.props.fields;
		const planetChanged = prevProps.planetDisplay !== this.props.planetDisplay;
		if(!fieldsChanged && !planetChanged){
			return;
		}
		if(this.state.currentTab && this.state.currentTab.indexOf('宿盘') >= 0){
			this.saveCurrentJieQiSnapshot(this.state.currentTab, this.state.result, this.state.fields);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._cancel3dWarm){ this._cancel3dWarm(); this._cancel3dWarm = null; }
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if(this.snapshotTimer){
			if(typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function'){
				window.cancelIdleCallback(this.snapshotTimer);
			}else{
				clearTimeout(this.snapshotTimer);
			}
			this.snapshotTimer = null;
		}
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		let contentHeight = height;
		if(height === '100%'){
			contentHeight = '100%';
		}else if(typeof height === 'number'){
			contentHeight = Math.max(260, height - 118);
		}
		let style = {
			height: '100%',
			overflowY:'auto', 
			overflowX:'hidden',
		};

		const tabs = this.genTabsDom(contentHeight);

		let jieqi24dom = this.gen24JieqiDom();

		let showInput = true;
		if(this.state.currentTab.indexOf('宿盘') >= 0){
			showInput = false;
		}

		return (
			// position:relative=角标定位上下文;多盘网格统一一枚角标(不逐张小盘各挂)
			<div id={this.state.divid} className="horosa-jieqi-page" style={{position: 'relative'}}>
				{this.state.updating && this.state.result && this.state.result.charts && Object.keys(this.state.result.charts).length > 0 ? <UpdatingBadge /> : null}
				{
					showInput && (
					<Row className="horosa-jieqi-toolbar" gutter={6} align="middle">
						<Col span={8}>
							<DateTimeSelector
								value={this.state.time}
								onlyYear={true}
								showTime={false}
								showAdjust={false}
								onChange={this.onTimeChanged}
							/>
						</Col>
						<Col span={3}>
							<Select
								style={{width: '100%'}}
								onChange={this.changeZodiacal}
								dropdownMatchSelectWidth={false}
								value={AstroConst.zodiacSelectValue(this.state.zodiacal, this.state.siderealAyanamsa)} size='small'>
								{AstroConst.groupOptions(AstroConst.buildZodiacOptions()).map((grp)=>(
									<OptGroup label={grp.group} key={grp.group}>
										{grp.items.map((item)=>(<Option value={item.value} key={item.value}>{item.label}</Option>))}
									</OptGroup>
								))}
							</Select>
						</Col>
						<Col span={3}>
							<Select style={{width:140}}
								onChange={this.changeHsys}
								value={this.state.hsys} 
								size='small'>
								{/* 本页继承主盘宫制:主盘 25 档,此前只列 9 档 → 继承第 10–25 档时显示裸数字且无法重选 */}
								{ getHousesOption(true) }
							</Select>
						</Col>
						<Col span={2}>
							<GeoCoordModal 
								onOk={this.changeGeo}
								lat={this.state.gpsLat} lng={this.state.gpsLon}
							>
								<Button size='small'>经纬度选择</Button>
							</GeoCoordModal>
						</Col>
						<Col span={4}>
							<span>{this.state.lon + ' ' + this.state.lat}</span>
						</Col>
					</Row>
	
					)
				}
				<Tabs 
					activeKey={this.state.currentTab}
					tabPosition='right'
					onChange={this.changeTab}
					destroyInactiveTabPane={true}
					className="horosa-jieqi-tabs"
					style={{ height: '100%' }}
				>
					<TabPane tab='二十四节气' key='二十四节气'>
						<div className={styles.scrollbar} style={style}>
						{jieqi24dom}
						</div>
					</TabPane>
					{ tabs }
				</Tabs>
				{this.renderBottomQuickDock()}
			</div>
		);
	}
}

export default JieQiChartsMain;
