import { Component, memo } from 'react';
import { claimTrigger, settleTrigger, identityOf } from '../../utils/singleTrigger';   // 双触发收敛
import '../../utils/timeBasisLine';
import '../../utils/recordFieldsRestore';   // 首开只补空的判默认基准
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
// R4-B3(horosa_prefetch_registry_v1):七政三段链式预取登记(R10 情报③)。
import { markPanelReady } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { stepPrefetchEnabled, guolaoMergedPaintEnabled } from '../../utils/perfFlags';
import { registerStepPrefetcher, unregisterStepPrefetcher } from '../../utils/stepPrefetch';
import '../../utils/safeStorage';
import '../../utils/dayBoundary';
import { XQModal, XQTabs as Tabs } from '../xq-ui';
import XQIcon from '../xq-icons';
import * as Constants from '../../utils/constants';
import '../../utils/request';
import {randomStr,} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import '../comp/DateTime';
import QuickDockBar from '../common/QuickDockBar';
import GuoLaoInput from './GuoLaoInput';
import './guolaoData';
import './guolaoTransit';
import GuoLaoChart from './GuoLaoChart';
import GuoLaoMoiraPanel from './GuoLaoMoiraPanel';
import '../../utils/baziLunarLocal';   // 无头/快照路径的流年月支(月限用)
import GuoLaoMoiraWheel, {
	moiraGetZiGods,
	moiraCollectGods,
} from './GuoLaoMoiraWheel';
import GuoLaoMoiraPickWheel from './GuoLaoMoiraPickWheel';
import GuoLaoQizhengWheel from './GuoLaoQizhengWheel';
import { GUOLAO_CHART_STYLE_MOIRA, GUOLAO_CHART_STYLE_PICK, GUOLAO_CHART_STYLE_QIZHENG, getStoredGuolaoChartStyle, getStoredGuolaoDisplay, getStoredMoiraTransitGodsVisible, normalizeGuolaoLifeMode, normalizeGuolaoNodeMode, normalizeGuolaoSu28Mode, setStoredGuolaoChartStyle, setStoredGuolaoLifeMode, setStoredGuolaoNodeMode, setStoredGuolaoSu28Mode, setStoredMoiraTransitGodsVisible, setStoredGuolaoDisplay, getStoredGuolaoElection, setStoredGuolaoElection, getStoredGuolaoEleLifeMode, setStoredGuolaoEleLifeMode, } from './GuoLaoChartStyle';
import { recordNewChartSeeds } from '../../utils/newChartSeeds';
import { sendScopedFields } from '../../utils/scopedFieldsSink';
import { fetchKinastroQizheng, fetchMoiraQizhengRules, fetchQizhengElection, stableMoiraKey, } from '../../services/qizheng';
import { peekCachedPost } from '../../services/_requestCache';
import { getMagneticDeclination } from './electionGeomag';
import { GuoLaoElectionTable, GuoLaoElectionSearch } from './GuoLaoElectionTable';
import { saveModuleAISnapshot, saveModuleAISnapshotLazy, } from '../../utils/moduleAiSnapshot';
import '../../constants/AstroText';
import '../suzhan/SZConst';
import '../su28/Su28Helper';
import '../astro/AstroHelper';
// 组件外的模块级助手(纯函数 / 常量 / 表 / 小组件)按职责拆在 ./main/ 下;组件本体与对外导出面仍在本文件。
import {
	MOIRA_QUICK_ACTIONS, getStoredGuolaoEngineMode, setStoredGuolaoEngineMode, getStoredKinastroQizhengOptions,
	setStoredKinastroQizhengOptions,
} from './main/prefs';
import {
	MOIRA_YEAR_STAR_BY_STEM, MOIRA_YEAR_STAR_SEQ, MOIRA_YEAR_STAR_MAP, MOIRA_TEN_GOD_ORG, MOIRA_TEN_GOD_ALT,
	MOIRA_YEAR_INFO_GROUPS, MOIRA_BIRTH_GOD_ORDER, MOIRA_TRANSIT_GOD_ORDER,
} from './main/moiraConst';
import {
	safeList, safeMap, fmtQizhengKinRowValue, splitQizhengKinDisplayLines, qizhengKinReadingLevel,
	qizhengKinReadingBadge, hasUnverifiedMoiraPatternSource, isIncompleteMoiraRules, moiraStyleLevelMeta,
	applyMoiraStyleLevel, joinNames, joinMoiraYearItems,
} from './main/format';
import { buildAspectRows, clonePlain, applyGuolaoNodeMode, hasGuolaoRiseSetFields } from './main/aspectsNodeMode';
import { GUOLAO_SU28_CACHE_REV, guolaoMem, pushCache, buildGuolaoKey, isChartObjMatchParams, isChartObjSameNatal, fetchGuolaoChartCached } from './main/chartCache';
import { computeGuolaoSeedPatch, fieldsToParams, makeDefaultMoiraTransitTime, paramsWithMoiraTransit } from './main/params';
import {
	stemBranchForYear, yearFromParams, baziStemBranch, baziText, lunarText, buildQuickPlanetRows,
	buildGodRowsFromChart, buildLocalMoiraRules, normalizeGodRows, buildGuolaoSnapshotTextV2,
} from './main/snapshot';
import { toSlashDate, parseDateParts } from '../../utils/dateStrSafe';
import { natalSourceKey, pickKeyedDerived } from '../../utils/derivedChartSource';
// 对外导出面不变:搬进子模块的导出原样重导出
export { applyGuolaoNodeMode } from './main/aspectsNodeMode';
export { guolaoSu28ModeFromFields } from './main/fieldModes';
export { computeGuolaoSeedPatch, warmGuolaoNatal } from './main/params';
export {
	buildHouseSuAndGodsSection, buildGuolaoSnapshotForFields, buildStarDignityMotionSection,
	buildGuolaoWeakSolidSection, buildGuolaoBirthStarsSection, buildGuolaoMastersSection,
	buildGuolaoLimitCalcSection, buildGuolaoAspectSection, buildGuolaoLimitSection,
} from './main/snapshot';

const TabPane = Tabs.TabPane;


// 快照槽的出生签名(对话挂载按它认命主):惰性存与刷新应答同一份。
function guolaoSnapshotMeta(p){
	const q = p || {};
	return { date: q.date, time: q.time, zone: q.zone, lon: q.lon, lat: q.lat };
}

// ── horosa_guolao_scu_slice_v1(PERF-R9 Ship 6)────────────────────────────────
// 原 sCU 是「nextState !== this.state → true」的恒真型:任何一次 setState(哪怕写的是
// render() 压根不读的字段)都要把 4000 行的整棵树 + SVG 大盘重渲一遍。
// 白名单只收**经全文核对 render()/render 子例程从不读取**的字段;拿不准的一律不收(判「变了」)。
//   · tips           —— 仅 onTipClick 写入(2213/2932 两处出现,零读取点);点星提示不该重画整盘。
//   · electionLoading —— 仅做在途标记,渲染层无任何消费点。
const GUOLAO_SCU_IGNORED_STATE = {
	tips: true,
	electionLoading: true,
};

function guolaoStateChangeMatters(prev, next){
	if(prev === next){
		return false;
	}
	if(!prev || !next){
		return true; // 拿不准 → 判「变了」(正确性优先)
	}
	const keys = Object.keys(next);
	if(keys.length !== Object.keys(prev).length){
		return true; // 键集变化 → 判「变了」
	}
	for(let i = 0; i < keys.length; i += 1){
		const k = keys[i];
		if(Object.is(prev[k], next[k])){
			continue;
		}
		if(!GUOLAO_SCU_IGNORED_STATE[k]){
			return true;
		}
	}
	return false;
}

function GuoLaoChartSkeleton(){
	return (
		<div className="horosa-guolao-chart-skeleton" aria-busy="true">
			<div className="horosa-guolao-chart-skeleton-ring" />
			<div className="horosa-guolao-chart-skeleton-ring is-mid" />
			<div className="horosa-guolao-chart-skeleton-ring is-core" />
			<div className="horosa-guolao-chart-skeleton-hint">排盘中…</div>
		</div>
	);
}

// ── horosa_guolao_stage_memo_v1(PERF-R9 Ship 6)───────────────────────────────
// 中栏盘面(三种轮盘 + 骨架)独立成 React.memo 边界:GuoLaoMoiraWheel/PickWheel/GuoLaoChart
// 三者**都没有 sCU**,此前 Main 每重渲一次就把整张 SVG 大盘从头算一遍(几何+神煞环+相位线)。
// 边界内用到的每一个值都由 props 显式传入(无闭包读 this.state/this.props),故默认浅比较
// 完备:任一可见输入变化必重渲,零陈旧。transitParams/declination 在 Main 侧做了按输入记忆化
// (否则每次 render 现造新对象 → 浅比较必失效)。
const GuoLaoChartStage = memo(function GuoLaoChartStage(props){
	const {
		variant, rootValue, value, transitValue, transitParams, transitLoading, moiraRules,
		display, showMoiraTransitGods, election, electionData, declination, declinationOutOfRange,
		height, fields, chartDisplay, planetDisplay, onTipClick, onAgeClick,
	} = props;
	if(variant === 'skeleton'){
		return <GuoLaoChartSkeleton />;
	}
	if(variant === 'pick'){
		return (
			<GuoLaoMoiraPickWheel
				rootValue={rootValue}
				value={value}
				transitValue={transitValue}
				transitParams={transitParams}
				transitLoading={transitLoading}
				moiraRules={moiraRules}
				aspectSet={display.aspects}
				aspectOrbs={display.aspectOrbs}
				hiddenPlanets={display.hiddenPlanets}
				hiddenGodsBirth={display.hiddenGodsBirth}
				hiddenGodsTransit={display.hiddenGodsTransit}
				showDignity={display.dignity}
				showMountains={display.mountains}
				showBirthGods={display.birthGods}
				showAgeRing={display.ageRing}
				limitChildBase={display.limitChildBase}
				onAgeClick={onAgeClick}
				limitYearBoundary={display.limitYearBoundary}
				election={election}
				electionData={electionData}
				declination={declination}
				declinationOutOfRange={declinationOutOfRange}
				height={height}
				fields={fields}
				chartDisplay={chartDisplay}
				planetDisplay={planetDisplay}
				onTipClick={onTipClick}
			/>
		);
	}
	if(variant === 'moira'){
		return (
			<GuoLaoMoiraWheel
				rootValue={rootValue}
				value={value}
				election={election}
				electionData={electionData}
				transitValue={transitValue}
				transitParams={transitParams}
				transitLoading={transitLoading}
				showAspectsMode={display.showAspects === true}
				showMoiraTransitGods={showMoiraTransitGods}
				moiraRules={moiraRules}
				aspectSet={display.aspects}
				aspectOrbs={display.aspectOrbs}
				hiddenPlanets={display.hiddenPlanets}
				hiddenGodsBirth={display.hiddenGodsBirth}
				hiddenGodsTransit={display.hiddenGodsTransit}
				showDignity={display.dignity}
				showMountains={display.mountains}
				showBirthGods={display.birthGods}
				showAgeRing={display.ageRing}
				limitChildBase={display.limitChildBase}
				onAgeClick={onAgeClick}
				limitYearBoundary={display.limitYearBoundary}
				height={height}
				fields={fields}
				chartDisplay={chartDisplay}
				planetDisplay={planetDisplay}
				onTipClick={onTipClick}
			/>
		);
	}
	return (
		<GuoLaoChart
			value={value}
			height={height}
			fields={fields}
			chartDisplay={chartDisplay}
			planetDisplay={planetDisplay}
			onTipClick={onTipClick}
		/>
	);
});

// 换命主时整组复位的派生盘(与构造时初值同形)
const GUOLAO_COMPOSITE_EMPTY = Object.freeze({
	chartObj: null,
	moiraTransitChartObj: null,
	moiraRules: null,
	moiraPanelChartObj: null,
	moiraPanelTransitChartObj: null,
	moiraPanelTransitParams: null,
	electionData: null,
});

class GuoLaoChartMain extends Component{
	constructor(props) {
		super(props);
		// 择日内嵌:引擎锁定星阙七政引擎(zeriPageCalibre.QIZHENG_ZERI_LOCKED)—— 本机记忆是「坚七政」也从 Moira 圆盘起
		const engineLocked = this.engineLockedByZeri();
		const rawChartStyle = getStoredGuolaoChartStyle();
		const storedChartStyle = engineLocked && rawChartStyle === GUOLAO_CHART_STYLE_QIZHENG ? GUOLAO_CHART_STYLE_MOIRA : rawChartStyle;
		const storedEngineMode = engineLocked ? 'horosa' : (storedChartStyle === GUOLAO_CHART_STYLE_QIZHENG ? 'kinastro' : getStoredGuolaoEngineMode());
		this.state = {
			chartObj: null,
			moiraTransitTime: makeDefaultMoiraTransitTime(props.fields),
			moiraTransitChartObj: null,
			moiraTransitLoading: false,
			tips: null,
			moiraRules: null,
			moiraPanelChartObj: null,
			moiraPanelTransitChartObj: null,
			moiraPanelTransitParams: null,
			moiraLoading: false,
			bundleLoading: false,
			guolaoDisplay: getStoredGuolaoDisplay(),
			chartStyle: storedEngineMode === 'kinastro' ? GUOLAO_CHART_STYLE_QIZHENG : storedChartStyle,
			// 天星择日双轮(pick 盘式):类B 选项 blob + 类A 立命时刻 + 端点数据
			electionOptions: getStoredGuolaoElection(),
			eleLifeMode: getStoredGuolaoEleLifeMode(),
			electionData: null,
			electionLoading: false,
			electionDeclOutOfRange: false,
			showMoiraTransitGods: getStoredMoiraTransitGodsVisible(),
			moiraQuickDialog: null,
			moiraStyleLevel: 3,
			engineMode: storedEngineMode,
			kinastroOptions: getStoredKinastroQizhengOptions(),
			qizhengKinPan: null,
			qizhengKinLoading: false,
			qizhengKinError: '',
			qizhengKinActiveTab: 'overview',
		};

		this.unmounted = false;
		this.bundleSeq = 0;
		this.chartReqSeq = 0;
		this.moiraReqSeq = 0;
		this.prefetchTimer = null;
		this.moiraTransitReqSeq = 0;
		this.qizhengKinReqSeq = 0;
		this.electionReqSeq = 0;

		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.requestChart = this.requestChart.bind(this);
		this.requestChartObj = this.requestChartObj.bind(this);
		this.requestGuolaoBundle = this.requestGuolaoBundle.bind(this);
		this.onGuolaoDisplayChange = this.onGuolaoDisplayChange.bind(this);
		this.onLimitAgeClick = this.onLimitAgeClick.bind(this);
		this.requestMoiraTransitChart = this.requestMoiraTransitChart.bind(this);
		this.genParams = this.genParams.bind(this);
		this.onTipClick = this.onTipClick.bind(this);
		this.saveGuolaoAISnapshot = this.saveGuolaoAISnapshot.bind(this);
		this.applyChartObj = this.applyChartObj.bind(this);
		this.prefetchChart = this.prefetchChart.bind(this);
		this.requestMoiraRules = this.requestMoiraRules.bind(this);
		this.commitMoiraPanel = this.commitMoiraPanel.bind(this);
		this.ensureGuolaoDefaults = this.ensureGuolaoDefaults.bind(this);
		this.onChartStyleChange = this.onChartStyleChange.bind(this);
		this.onMoiraTransitTimeChange = this.onMoiraTransitTimeChange.bind(this);
		this.onMoiraTransitGodsVisibleChange = this.onMoiraTransitGodsVisibleChange.bind(this);
		this.openMoiraQuickDialog = this.openMoiraQuickDialog.bind(this);
		this.closeMoiraQuickDialog = this.closeMoiraQuickDialog.bind(this);
		this.onMoiraStyleLevelChange = this.onMoiraStyleLevelChange.bind(this);
		this.onEngineModeChange = this.onEngineModeChange.bind(this);
		this.onKinastroOptionChange = this.onKinastroOptionChange.bind(this);
		this.requestKinastroQizheng = this.requestKinastroQizheng.bind(this);
		this.onQizhengKinTabChange = this.onQizhengKinTabChange.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields, chartObj)=>{
				if(this.unmounted){
					return;
				}
				this.requestChartObj(fields, chartObj);
			};
			// 所见那张盘实际所用的 fields(请求过了代次校验、确定上屏的那一次):择日宿主存案取它 —— 内嵌页自己重排、宿主改了工作台没重排、覆盖层里没确定的草稿,都不会让存案的时间地点与所见不一致(两路都按发请求那一拍的 props.fields 起盘)
			this.props.hook.getPlottedFields = ()=>this._plottedFields || null;
			// 时间变化即预热流年盘(与主 /chart 并行;正式流程到流年段时在途/缓存秒中)。
			// 主 /chart 由模型层照发不重复;失败静默,正式请求自兜底。latency: 主盘+流年串行 → max(主盘,流年)。
			this.props.hook.prewarmRequests = (flds)=>{
				if(this.unmounted || this.state.engineMode === 'kinastro'){ return; }
				if(this.state.chartStyle === GUOLAO_CHART_STYLE_QIZHENG){ return; }
				try{
					const tp = paramsWithMoiraTransit(flds || this.props.fields, this.state.moiraTransitTime);
					if(tp){ fetchGuolaoChartCached(tp, { silent: true }).catch(()=>{ /* 预热静默 */ }); }
				}catch(e){ /* 预热失败无害 */ }
			};
			// R4-B3(horosa_prefetch_registry_v1,R10 情报③「七政三段」):七政步进链=本命→流年→
			// 判读规则三段串行,前两段有缓存、第三段(fetchMoiraQizhengRules,几百 ms 重计算)每步必付。
			// 登记的预取任务把三段【链式】全预热(与 requestGuolaoBundle 同构:同 params/同
			// applyGuolaoNodeMode/同 rules 入参形态 → 键逐字节同,真点步进时第三段归零)。
			// (v3.7.1 收敛注:上游链式单任务取代我方「双任务+禁词精确豁免」形态 —— 链在任务体内
			//  经 await 续段发规则请求,白名单只见声明路径 '/chart',豁免机制整体退役 #49。)
			// 🔴 取现时红线:moiraTransitTime 为 null(默认过运=「现在」)时流年/规则两段的键含
			//    构造时刻的「现在」——真点时刻已变,键不同=预热白打且徒增负载 → 该态只暖本命段。
			//    键不同也意味着绝不会错误命中旧「现在」(无「今天被冻住」降级)。
			if(stepPrefetchEnabled()){
				this._guolaoStepPrefetcher = (steppedFields)=>{
					if(this.unmounted || this.state.engineMode === 'kinastro'){
						return [];
					}
					if(this.state.chartStyle === GUOLAO_CHART_STYLE_QIZHENG){
						return [];
					}
					let params = null;
					try{
						params = fieldsToParams(steppedFields);
					}catch(e){
						return [];
					}
					if(!params){
						return [];
					}
					const transitTime = this.state.moiraTransitTime;
					const warmAllStages = transitTime !== null && transitTime !== undefined;
					return [{
						name: 'guolao:natal',
						path: '/chart',
						run: async ()=>{
							const natalRaw = await fetchGuolaoChartCached(params, { silent: true });
							if(!natalRaw || !warmAllStages || this.unmounted){
								return natalRaw || null;
							}
							try{
								const chartObj = applyGuolaoNodeMode(natalRaw, steppedFields);
								const tp = paramsWithMoiraTransit(steppedFields, transitTime);
								let transitObj = null;
								if(tp){
									const tRaw = await fetchGuolaoChartCached(tp, { silent: true }).catch(()=>null);
									transitObj = tRaw ? applyGuolaoNodeMode(tRaw, steppedFields) : null;
								}
								// 第三段:判读规则 —— 结果落 services/qizheng 的 cachedPost 缓存,
								// 真点步进到该时刻时 requestGuolaoBundle 的规则段直接命中。
								await fetchMoiraQizhengRules({
									params,
									chartObj,
									transitParams: tp,
									transitChartObj: transitObj,
								}, { silent: true, timeoutMs: 12000 });
							}catch(e){ /* 后两段预热失败静默:首点回到冷即付 */ }
							return natalRaw;
						},
					}];
				};
				registerStepPrefetcher('guolao', this._guolaoStepPrefetcher);
			}
		}
	}

	// 星盘样式 / 引擎 / 坚七政选项 / 流年神煞显隐 / 显示偏好只归七政主页记忆:择日内嵌实例的改动只作用本页(与起盘口径同一判据)
	persistsGuolaoPrefs(){
		return (this.props.techniqueScope || 'guolao') === 'guolao';
	}

	// 择日内嵌页锁定排盘引擎(另一套引擎的盘与扫描不是同一口径)
	engineLockedByZeri(){
		const e = this.props && this.props.zeriLocked && this.props.zeriLocked.engineMode;
		return !!(e && e.value === 'horosa');
	}

	onChartStyleChange(val){
		if(this.engineLockedByZeri() && val === GUOLAO_CHART_STYLE_QIZHENG){ return; }
		const persist = this.persistsGuolaoPrefs();
		const chartStyle = setStoredGuolaoChartStyle(val, { persist });
		const engineMode = setStoredGuolaoEngineMode(chartStyle === GUOLAO_CHART_STYLE_QIZHENG ? 'kinastro' : 'horosa', { persist });
		const prevEngine = this.state.engineMode;
		this.setState({
			chartStyle,
			engineMode,
			qizhengKinError: '',
		}, ()=>{
			if(engineMode === 'kinastro'){
				this.requestKinastroQizheng();
				return;
			}
			// Moira圆盘 ↔ 天星择日:同一套排盘参数、同一张盘,只是中盘换渲染组件、右栏数据不变。
			// 若引擎未从 kinastro 切回、且已有匹配当前参数的盘数据 → 直接复用,绝不重跑 requestGuolaoBundle 的
			// 多阶段取数(本命→流年→规则),否则每次切样式都把「本命/流年/规则」重算一遍 → 中/右盘多次跳算闪烁。
			// 天星择日双轮所需 electionData 由 componentDidUpdate 的 requestElectionData 单独按需补取(单次 setState)。
			const params = this.genParams();
			const canReuse = prevEngine !== 'kinastro' && this.state.chartObj && params && isChartObjMatchParams(this.state.chartObj, params);
			if(!canReuse){
				this.requestGuolaoBundle(this.state.chartObj || this.props.value);
			}
		});
	}

	onMoiraTransitTimeChange(value){
		const time = value && value.time ? value.time : (value && value.value ? value.value : null);
		if(!time){
			return;
		}
		this.setState({
			moiraTransitTime: time.clone ? time.clone() : time,
		}, ()=>{
			if(!value || value.confirmed !== false){
				this.requestGuolaoBundle(this.state.chartObj || this.props.value);
			}
		});
	}

	// 点击百六大限某岁数格 → 流年跳到该岁对应公历年的 **7月1日 12:00**(用户钦定的取中方式);
	// 复用 onMoiraTransitTimeChange:左栏「Moira流年 时间」随之更新 + 重算流年盘(与手改时间同管道)。
	onLimitAgeClick(year){
		const y = Number(year);
		if(!Number.isFinite(y)){ return; }
		const cur = this.state.moiraTransitTime;
		const next = cur && cur.clone ? cur.clone() : null;
		if(!next || !next.parse){ return; }
		next.parse(`${y}/07/01 12:00:00`, 'YYYY-MM-DD HH:mm:ss');
		this.onMoiraTransitTimeChange({ value: next });
	}

	onMoiraTransitGodsVisibleChange(visible){
		this.setState({
			showMoiraTransitGods: setStoredMoiraTransitGodsVisible(visible, { persist: this.persistsGuolaoPrefs() }),
		});
	}

	onGuolaoDisplayChange(patch){
		const next = setStoredGuolaoDisplay({...this.state.guolaoDisplay, ...(patch || {})}, { persist: this.persistsGuolaoPrefs() });
		this.setState({ guolaoDisplay: next });
	}

	openMoiraQuickDialog(key){
		this.setState({
			moiraQuickDialog: key,
		});
	}

	closeMoiraQuickDialog(){
		this.setState({
			moiraQuickDialog: null,
		});
	}

	onMoiraStyleLevelChange(event){
		const level = Number(event && event.currentTarget ? event.currentTarget.value : null);
		if(!Number.isFinite(level)){
			return;
		}
		this.setState({
			moiraStyleLevel: level,
		});
	}

	onEngineModeChange(value){
		if(this.engineLockedByZeri() && value === 'kinastro'){ return; }
		const persist = this.persistsGuolaoPrefs();
		const engineMode = setStoredGuolaoEngineMode(value, { persist });
		// 内嵌实例按本页现值判(本机记忆可能是主页另一套)
		const storedChartStyle = persist ? getStoredGuolaoChartStyle() : this.state.chartStyle;
		const chartStyle = engineMode === 'kinastro'
			? setStoredGuolaoChartStyle(GUOLAO_CHART_STYLE_QIZHENG, { persist })
			: (storedChartStyle === GUOLAO_CHART_STYLE_QIZHENG ? setStoredGuolaoChartStyle(GUOLAO_CHART_STYLE_MOIRA, { persist }) : storedChartStyle);
		this.setState({
			engineMode,
			chartStyle,
			qizhengKinError: '',
		}, ()=>{
			if(engineMode === 'kinastro'){
				this.requestKinastroQizheng();
			}else if(this.props.fields){
				this.requestChartObj();
			}
		});
	}

	onKinastroOptionChange(key, value){
		const persist = this.persistsGuolaoPrefs();
		const next = setStoredKinastroQizhengOptions({
			...this.state.kinastroOptions,
			[key]: value,
		}, { persist, base: this.state.kinastroOptions });
		this.setState({
			kinastroOptions: next,
		}, ()=>{
			if(this.state.engineMode === 'kinastro'){
				this.requestKinastroQizheng();
			}
		});
	}

	onQizhengKinTabChange(key){
		this.setState({
			qizhengKinActiveTab: key,
		});
	}

	async requestKinastroQizheng(){
		if(!this.props.fields || this.unmounted){
			return null;
		}
		const params = this.genParams();
		if(!params){
			return null;
		}
		const plotFields = this.props.fields;   // genParams 读的这一份
		const options = this.state.kinastroOptions || {};
		const seq = ++this.qizhengKinReqSeq;
		this.setState({
			qizhengKinLoading: true,
			qizhengKinError: '',
		});
		try{
		const pan = await fetchKinastroQizheng({
				...params,
				// fieldsToParams 不含 gender,后端 data.get("gender") 缺省男 → 女命大运与断语恒按男排;此处补透传(1/0 → 后端 gender_cn)。
				gender: (this.props.fields && this.props.fields.gender && this.props.fields.gender.value !== undefined && this.props.fields.gender.value !== null) ? this.props.fields.gender.value : undefined,
				qizhengKinCurrentYear: options.currentYear,
				qizhengKinTransitMode: options.transitMode || 'none',
				qizhengKinTransitDate: options.transitDate || '',
				qizhengKinTransitTime: options.transitTime || '',
				qizhengKinElectionalStartDate: options.electionalStartDate || '',
				qizhengKinElectionalCriteria: options.electionalCriteria || 'general',
				qizhengKinElectionalDays: options.electionalDays || 30,
			});
			if(this.unmounted || seq !== this.qizhengKinReqSeq){
				return pan;
			}
			this._plottedFields = plotFields;
			this.setState({
				qizhengKinPan: pan,
				qizhengKinPanSig: natalSourceKey(params),
				qizhengKinLoading: false,
				qizhengKinError: '',
			}, ()=>{
				// horosa_panel_ready_v1:坚七政(kinastro 引擎)分支的唯一落定点 —— 中栏七政轮
				// 与右栏信息 Tabs 同吃 qizhengKinPan,这一次 setState 之后两栏全部画完。
				markPanelReady('guolao');
			});
			// 🔴 全站共用槽只归主页实例写(择日内嵌实例写它=候选时刻内容污染主页槽,审查实抓)
			if(pan && pan.snapshot && (this.props.techniqueScope || 'guolao') === 'guolao'){
				saveModuleAISnapshot('guolao-qizhengkin', pan.snapshot, {
					date: params.date,
					time: params.time,
					zone: params.zone,
					lon: params.lon,
					lat: params.lat,
				});
			}
			return pan;
		}catch(e){
			if(!this.unmounted && seq === this.qizhengKinReqSeq){
				this.setState({
					qizhengKinLoading: false,
					qizhengKinError: e && e.message ? e.message : '七政四余服务暂不可用',
				}, ()=>{
					// horosa_panel_ready_v1:坚七政失败终态(错误卡上屏即本次交互结束)。
					markPanelReady('guolao');
				});
			}
			return null;
		}
	}

	// 每张新开 / 未存的盘都按本机仓补空(与「新盘种子」同义):不再只在本实例首开时补一次 —— 页面常驻,
	// 本次运行里后来新开的命盘若不补,就按出厂值起盘,要重开软件才跟本机仓。补空本身幂等(只补仍是 schema 初值、
	// 且与本机仓不同的键;左栏改值时同时写本机仓),载入了记录(cid)、择日内嵌一律不补,见 computeGuolaoSeedPatch。
	ensureGuolaoDefaults(){
		if(!this.props.fields || !this.props.dispatch){
			return false;
		}
		const patch = computeGuolaoSeedPatch(this.props.fields, { embedded: (this.props.techniqueScope || 'guolao') !== 'guolao' });
		if(!Object.keys(patch).length){
			return false;
		}
		this.onFieldsChange(patch);
		return true;
	}

	applyChartObj(params, chartObj){
		if(!params || !chartObj || this.unmounted){
			return;
		}
		const key = buildGuolaoKey(params);
		if(key){
			pushCache(guolaoMem, key, clonePlain(chartObj));
		}
		const displayChartObj = applyGuolaoNodeMode(chartObj, this.props.fields);
		// 合批渲染(用户钦定「算好一起出」):主盘暂存,与流年盘+rules 在 commitMoiraPanel 一次放行,
		// 消除 框→主盘→神煞 三段跳。rules 链任何失败路径都有 local-fallback 兜底 commit,不会卡 loading。
		this._pendingMoiraChartObj = displayChartObj;
		this.setState({
			moiraLoading: true,
		});
		this.saveGuolaoAISnapshot(params, displayChartObj);
		this.requestMoiraTransitChart(params, displayChartObj);
	}

	commitMoiraPanel(rules, params, chartObj, transitParams, transitChartObj){
		const nextTransitParams = transitParams || paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime);
		const pendingChartObj = this._pendingMoiraChartObj;
		this._pendingMoiraChartObj = null;
		this.setState({
			...(pendingChartObj ? { chartObj: pendingChartObj } : {}),
			// 流年盘与主盘/rules 同批放行(彻底合批:盘面一次成型,不显示半成品)。
			...(transitChartObj ? { moiraTransitChartObj: transitChartObj, moiraTransitChartObjSig: natalSourceKey(params) } : {}),
			moiraRules: rules,
			moiraPanelChartObj: clonePlain(chartObj),
			moiraPanelTransitChartObj: clonePlain(transitChartObj || this.shownMoiraTransitChartObj()),
			moiraPanelTransitParams: clonePlain(nextTransitParams),
			moiraLoading: false,
		}, ()=>{
			// horosa_panel_ready_v1:旧多段路径的**唯一**终点(applyChartObj→requestMoiraTransitChart
			// →requestMoiraRules 全部汇入此处),中栏盘面 + 右栏 rules 在这一次 setState 里一起落定。
			markPanelReady('guolao');
			// 规则落地即补拍快照:阶段一在 moiraRules 未归时已产首版(lazy 200-800ms
			// 即物化冻结,导出直吃缓存),不补拍则 AI 侧恒丢 [虚实]/[本命化曜]/[流年流曜] 三段、
			// [神煞] 降级历法源——页面/refresh/无头三路都等规则,唯存盘路裸拍(不同构)。
			this.saveGuolaoAISnapshot(params, pendingChartObj || chartObj || this.state.chartObj);
		});
	}

	async requestMoiraRules(params, chartObj, transitParams, transitChartObj){
		if(!params || !chartObj || this.unmounted){
			return;
		}
		const seq = ++this.moiraReqSeq;
		this.setState({
			moiraLoading: true,
		});
		let rsp = null;
		let fallbackReason = 'empty-response';
		try{
			rsp = await fetchMoiraQizhengRules({
				params: params,
				chartObj: chartObj,
				transitParams: transitParams || paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime),
				transitChartObj: transitChartObj || this.shownMoiraTransitChartObj() || null,
			}, {
				silent: true,
				timeoutMs: 12000,
			});
		}catch(e){
			fallbackReason = e && e.message ? e.message : 'request-error';
		}
		if(this.unmounted || seq !== this.moiraReqSeq){
			return;
		}
		const remoteRules = rsp && rsp[Constants.ResultKey] ? rsp[Constants.ResultKey] : null;
		const rules = isIncompleteMoiraRules(remoteRules)
			? buildLocalMoiraRules(params, chartObj, this.props.fields, fallbackReason)
			: remoteRules;
		this.commitMoiraPanel(rules, params, chartObj, transitParams, transitChartObj);
	}

	async prefetchChart(params){
		if(!params){
			return null;
		}
		return fetchGuolaoChartCached(params, {
			silent: true,
		});
	}

	async requestMoiraTransitChart(baseParams, baseChartObj){
		if(!this.props.fields || this.unmounted){
			return null;
		}
		const params = paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime);
		if(baseParams){
			params.lon = baseParams.lon;
			params.lat = baseParams.lat;
			params.gpsLon = baseParams.gpsLon;
			params.gpsLat = baseParams.gpsLat;
			params.doubingSu28 = baseParams.doubingSu28;
			params.guolaoZhengSidereal = baseParams.guolaoZhengSidereal;
			params.zodiacal = baseParams.zodiacal;
			params.guolaoLifeMode = baseParams.guolaoLifeMode;
			params.tradition = baseParams.tradition;
			params.strongRecption = baseParams.strongRecption;
			params.simpleAsp = baseParams.simpleAsp;
			params.virtualPointReceiveAsp = baseParams.virtualPointReceiveAsp;
			params._su28Rev = baseParams._su28Rev || GUOLAO_SU28_CACHE_REV;
		}
		const seq = ++this.moiraTransitReqSeq;
		this.setState({
			moiraTransitLoading: true,
			moiraLoading: true,
		});
		try{
			const result = await fetchGuolaoChartCached(params, {
				silent: true,
			});
			if(this.unmounted || seq !== this.moiraTransitReqSeq){
				return result;
			}
			const displayResult = applyGuolaoNodeMode(result, this.props.fields);
			const rootParams = baseParams || this.genParams();
			const rootChartObj = baseChartObj || this.state.chartObj || applyGuolaoNodeMode(this.props.value, this.props.fields);
			if(!rootParams || !rootChartObj){
				this.setState({
					...(this._pendingMoiraChartObj ? { chartObj: this._pendingMoiraChartObj } : {}),
					moiraTransitChartObj: displayResult,
					moiraTransitChartObjSig: natalSourceKey(rootParams || this.genParams()),
					moiraTransitLoading: false,
					moiraLoading: false,
				}, ()=>{
					// horosa_panel_ready_v1:无根盘/根参数的降级终点(不再走 commitMoiraPanel)。
					markPanelReady('guolao');
				});
				this._pendingMoiraChartObj = null;
				return result;
			}
			// 彻底合批(用户钦定「不显示半成品」):流年盘结果不在此放行,与主盘/rules 一并
			// 在 commitMoiraPanel 单次 setState(消除「主盘→流年环→神煞」三段跳的第二跳)。
			this.setState({
				moiraTransitLoading: false,
			});
			this.requestMoiraRules(rootParams, rootChartObj, params, displayResult);
			return result;
		}catch(e){
			if(!this.unmounted && seq === this.moiraTransitReqSeq){
				const rootParams = baseParams || this.genParams();
				const rootChartObj = baseChartObj || this.state.chartObj || applyGuolaoNodeMode(this.props.value, this.props.fields);
				this.setState({
					moiraTransitLoading: false,
				});
				if(rootParams && rootChartObj){
					this.requestMoiraRules(rootParams, rootChartObj, params, null);
				}else {
					this.setState({
						...(this._pendingMoiraChartObj ? { chartObj: this._pendingMoiraChartObj } : {}),
						moiraLoading: false,
					}, ()=>{
						// horosa_panel_ready_v1:流年盘失败且无根盘的终点。
						markPanelReady('guolao');
					});
					this._pendingMoiraChartObj = null;
				}
			}
			return null;
		}
	}

	async requestChart(params, options){
		if(!params){
			return null;
		}
		const opt = options || {};
		const applyResult = opt.applyResult !== false;
		if(!applyResult){
			return this.prefetchChart(params);
		}
		const seq = ++this.chartReqSeq;
		const result = await fetchGuolaoChartCached(params, {
			silent: opt.silent !== false,
		});
		if(!result || this.unmounted || seq !== this.chartReqSeq){
			return result;
		}
		this.applyChartObj(params, result);
		return result;
	}

	saveGuolaoAISnapshot(params, result){
		const p = params || this.genParams();
		const r = result || this.state.chartObj;
		if(!p || !r){
			return;
		}
		const planetDisplay = this.props.planetDisplay;
		const fields = this.props.fields;
		// 命主取法 / 行运法 / 童限 / 年界按本页显示偏好写(与右栏、大限环同源)
		const displayPrefs = this.state ? this.state.guolaoDisplay : null;
		saveModuleAISnapshotLazy(this.props.techniqueScope || 'guolao', ()=>{
			const base = buildGuolaoSnapshotTextV2(p, r, planetDisplay, fields, this.state ? this.state.moiraRules : null, displayPrefs) || '';
			// 择日宿主经 composeAiSnapshot 拼接择时三段(scope 化,主七政页零影响)
			if(typeof this.props.composeAiSnapshot === 'function'){
				try{ return `${this.props.composeAiSnapshot(base) || base}`; }catch(e){ return base; }
			}
			return base;
		}, guolaoSnapshotMeta(p));
	}

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前盘即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(rehydrate/未重排时缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」,Win 用户实测)。
	// 本组件含两个 key:guolao(果老星宗,实时构建)与 guolao-qizhengkin(七政果老,取后端预置快照)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		let text = '';
		let meta;
		try{
			if(moduleName === (this.props.techniqueScope || 'guolao')){
				const p = this.genParams();
				const r = this.state ? this.state.chartObj : null;
				// 带本盘出生签名写槽(与 saveGuolaoAISnapshot 同一份 meta):不带则刷新一次后槽失去签名,对话挂载认不出是这位命主
				meta = guolaoSnapshotMeta(p);
				if(p && r){
					text = `${buildGuolaoSnapshotTextV2(p, r, this.props.planetDisplay, this.props.fields, this.state ? this.state.moiraRules : null, this.state ? this.state.guolaoDisplay : null) || ''}`.trim();
				}
			}else if(moduleName === 'guolao-qizhengkin' && (this.props.techniqueScope || 'guolao') === 'guolao'){
				// 🔴 全站共用槽只归主页实例应答:择日内嵌实例(techniqueScope='qizhengzeri')在
				// kinastro 档下也持 qizhengKinPan,双实例都答=后注册者用**择日候选时刻**内容
				// 覆写 detail.snapshotText,主页「七政(七政)」导出被污染(审查实抓)。
				const pan = this.shownQizhengKinPan();
				text = `${(pan && pan.snapshot) || ''}`.trim();
			}else{
				return;
			}
		}catch(e){
			text = '';
		}
		if(text && moduleName === (this.props.techniqueScope || 'guolao') && typeof this.props.composeAiSnapshot === 'function'){
			try{ text = `${this.props.composeAiSnapshot(text) || text}`; }catch(e){ /* 拼接失败用基底 */ }
		}
		if(text){
			saveModuleAISnapshot(moduleName, text, meta);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	requestChartObj(fields, chartObj){
		// v-guolao-moira: 收口到单闸门，禁止分步 setState（见 requestGuolaoBundle）。
		this.requestGuolaoBundle(chartObj || this.props.value);
	}

	// 一次性渲染闸门：本命盘 + 流年盘并行取齐 + Moira 规则一次性提交，期间只显示骨架/遮罩，
	// 绝不画半成品。取代旧的 requestChartObj→applyChartObj→requestMoiraTransitChart→requestMoiraRules→commitMoiraPanel 多段提交。
	async requestGuolaoBundle(srcChart){
		if(this.unmounted || this.state.engineMode === 'kinastro'){
			return;
		}
		const params = this.genParams();
		if(!params){
			return;
		}
		const plotFields = this.props.fields;   // genParams 读的这一份
		const style = this.state.chartStyle;
		// 流年盘:Moira/天星择日 在转盘上画;Horosa原盘 不画转盘但右栏「流年星曜/流年七政动态/流年落入」仍需流年盘数据,
		// 故所有样式都取流年盘(否则 classic 下右栏流年段空白显示「无数据」)。坚七政自有流年路径,不在此分支。
		const needTransit = (style !== GUOLAO_CHART_STYLE_QIZHENG);
		// 双触发收敛:同一次取盘,componentDidUpdate(props.value 换新)与 doHook 挂钩(requestChartObj)各进一次;
		// 输入(本命参数 / 流年时刻 / 盘式 / 引擎 / 源盘 / fields 身份)全同 → 第二路跳过,免整套三段重来(见 utils/singleTrigger)。
		const bundleTrig = claimTrigger(this, 'guolaoBundle', JSON.stringify([
			params, this.state.moiraTransitTime ? identityOf(this.state.moiraTransitTime) : 'now', style, this.state.engineMode,
			srcChart ? (srcChart.chartId || identityOf(srcChart)) : null, identityOf(this.props.fields),
		]));
		if(!bundleTrig){
			return;
		}
		const seq = ++this.bundleSeq;
		// 换了命主:本命 / 流年 / 规则整组复位成首次加载(骨架),在途期间不再拿上一位命主的整组盘顶着画;
		// 同一位命主只改设置 → 旧盘留存 + 遮罩「更新中」(isChartObjSameNatal)。
		if(this.state.chartObj && !isChartObjSameNatal(this.state.chartObj, params)){
			this.setState({ ...GUOLAO_COMPOSITE_EMPTY, bundleLoading: true });
		}else{
			this.setState({ bundleLoading: true });
		}
		const transitParams = paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime);
		const reuse = srcChart && isChartObjMatchParams(srcChart, params) && hasGuolaoRiseSetFields(srcChart);
		// 阶段一(冷加载性能):只取本命盘并立即上屏——命盘轮完整、绝不画半成品。
		// 此前 Promise.all([本命,流年]) 把两冷盘塞同一阻塞段(后端冷算串行≈2×单盘=撞 <1s 红线);拆两段后首屏只等本命盘。
		// 流年环/流曜/格局走既有 transitLoading/moiraLoading 过渡态稍后毫秒级补入,默认显示口径不变,缓存键(byte-perfect)不动。
		let natalRaw = null;
		let natalFailed = false;   // 本命盘未取到(抛错或空回)→ 画的是回落旧盘,须报失败让同参可重试
		// 回落旧盘只许是同一位命主的(只改了设置);换了人 → 不画(不能拿上一位命主的盘顶着)
		const fallbackChart = ()=>(isChartObjSameNatal(this.state.chartObj, params) ? this.state.chartObj : null);
		try{
			natalRaw = reuse ? srcChart : await fetchGuolaoChartCached(params, {silent: true});
			if(!reuse && !natalRaw){ natalFailed = true; }
		}catch(e){
			natalFailed = !reuse;
			natalRaw = reuse ? srcChart : null;
		}
		if(seq !== this.bundleSeq || this.unmounted){
			return;
		}
		if(natalRaw && !natalFailed){ this._plottedFields = plotFields; }   // 取不到本命盘时画的是回落旧盘,不算按这份起的
		const chartObj = natalRaw ? applyGuolaoNodeMode(natalRaw, this.props.fields) : fallbackChart();
		this.setState({
			chartObj,
			moiraPanelChartObj: chartObj,
			bundleLoading: false,
			// 流年/规则后台计算中:流曜区/右栏显示过渡态,不画半成品。
			moiraLoading: !!chartObj,
			moiraTransitLoading: needTransit,
		});
		if(chartObj){
			this.saveGuolaoAISnapshot(params, chartObj);
		}
		if(!chartObj){
			settleTrigger(this, 'guolaoBundle', bundleTrig, false);   // 无盘可画 = 失败,同参允许立即重试
			// horosa_panel_ready_v1:取盘失败的终态也要收口,否则本次交互的计时会悬着、
			// 被下一次交互错配(观测口径要求每次交互恰好一条 panel-ready)。
			this.setState({ moiraLoading: false, moiraTransitLoading: false }, ()=>{
				markPanelReady('guolao');
			});
			return;
		}
		if(natalFailed){ settleTrigger(this, 'guolaoBundle', bundleTrig, false); }   // 画的是回落旧盘 → 同参允许重试

		// 阶段二(后台非阻塞):流年盘(needTransit 时)+ Moira 规则,取齐后合并。
		let transitRaw = null;
		if(needTransit){
			try{
				transitRaw = await fetchGuolaoChartCached(transitParams, {silent: true});
			}catch(e){
				transitRaw = null;
			}
			if(seq !== this.bundleSeq || this.unmounted){
				return;
			}
		}
		if(needTransit && !transitRaw){ settleTrigger(this, 'guolaoBundle', bundleTrig, false); }   // 流年盘未取到 → 同参允许重试
		const transitObj = transitRaw ? applyGuolaoNodeMode(transitRaw, this.props.fields) : null;
		// [horosa_guolao_render_slice_v1 G5] 全命中路径中间帧合并:Moira 规则已在缓存(同步窥探)
		// ⇒ 下面的规则取回是 Promise.resolve 级,跳过「先画流年环」的中间 setState,终态一次落齐
		// (终态字节一致,少一整轮重渲)。窥探为假(冷/在途)⇒ 保留中间帧 = 流年环照旧先行上屏,
		// 绝不让流年环等规则往返。窥探真而取时被 LRU 逐出的极角:流年环与规则同帧上屏,终态不变。
		// 流年盘与其来源键 moiraTransitChartObjSig 必须同帧写(shownMoiraTransitChartObj 按键比对;
		// 只写盘不写键 = 合并路径下流年环整个不显示),中间帧与终态帧都带。
		const rulesPeekHit = guolaoMergedPaintEnabled()
			&& peekCachedPost('qizheng/moira', stableMoiraKey({ params, transitParams }));
		if(!rulesPeekHit){
			this.setState({
				moiraTransitChartObj: transitObj,
				moiraTransitChartObjSig: natalSourceKey(params),
				moiraTransitLoading: false,
			});
		}
		let rsp = null;
		let fallbackReason = 'empty-response';
		try{
			rsp = await fetchMoiraQizhengRules({
				params,
				chartObj,
				transitParams,
				transitChartObj: transitObj,
			}, {
				silent: true,
				timeoutMs: 12000,
			});
		}catch(e){
			fallbackReason = e && e.message ? e.message : 'request-error';
		}
		if(seq !== this.bundleSeq || this.unmounted){
			return;
		}
		if(!rsp){ settleTrigger(this, 'guolaoBundle', bundleTrig, false); }   // 规则未取到(走了本地回落)→ 同参允许重试
		const remoteRules = rsp && rsp[Constants.ResultKey] ? rsp[Constants.ResultKey] : null;
		const rules = isIncompleteMoiraRules(remoteRules)
			? buildLocalMoiraRules(params, chartObj, this.props.fields, fallbackReason)
			: remoteRules;
		this.setState({
			moiraRules: rules,
			// G5:流年盘字段并入终态帧(慢路径下与中间帧同引用 = 幂等无额外工作;
			// 合并路径下这里是它唯一的落点)。来源键同帧写(见上 G5 注)。
			moiraTransitChartObj: transitObj,
			moiraTransitChartObjSig: natalSourceKey(params),
			moiraPanelChartObj: chartObj,
			moiraPanelTransitChartObj: transitObj,
			moiraPanelTransitParams: transitParams,
			moiraLoading: false,
			moiraTransitLoading: false,
		}, ()=>{
			// horosa_panel_ready_v1:主路径(单闸门 requestGuolaoBundle)终点 —— 中栏命盘轮 + 流年环
			// + 右栏 Moira 面板(rules/流曜/格局)全部落定的那一次 setState。
			markPanelReady('guolao');
			// 同 commitMoiraPanel:阶段二规则取齐即补拍,快照终版带全 Moira 段。
			this.saveGuolaoAISnapshot(params, chartObj);
		});
	}

	// 当前命主来源键(按 fields 身份记一次)
	curNatalSig(){
		if(this._natalSigFields !== this.props.fields){
			this._natalSigFields = this.props.fields;
			let p = null;
			try{ p = this.genParams(); }catch(e){ p = null; }
			this._natalSig = natalSourceKey(p);
		}
		return this._natalSig;
	}

	// 流年盘 / 七政四余盘只用出自当前命主的那份:换命主后新盘在途 / 取失败时不拿上一位命主的
	shownMoiraTransitChartObj(){
		return pickKeyedDerived(this.state.moiraTransitChartObj, this.state.moiraTransitChartObjSig, this.curNatalSig());
	}

	shownQizhengKinPan(){
		return pickKeyedDerived(this.state.qizhengKinPan, this.state.qizhengKinPanSig, this.curNatalSig());
	}

	genParams(){
		let fields = this.props.fields;
		let params = fieldsToParams(fields);
		return params;
	}

	onFieldsChange(field){
		if(this.props.dispatch && this.props.fields){
			const patch = {
				...(field || {}),
			};
			const hasConfirmedFlag = Object.prototype.hasOwnProperty.call(patch, '__confirmed');
			const confirmed = hasConfirmedFlag ? !!patch.__confirmed : true;
			if(hasConfirmedFlag){
				delete patch.__confirmed;
			}
			// 择日内嵌实例:宿度制 / 命度 / 罗计只改宿主自己的盘 —— 只归一取值,不写七政页的保存值、不记新盘种子
			const mainPage = (this.props.techniqueScope || 'guolao') === 'guolao';
			if(patch.doubingSu28 && Object.prototype.hasOwnProperty.call(patch.doubingSu28, 'value')){
				patch.doubingSu28 = {
					...patch.doubingSu28,
					value: mainPage ? setStoredGuolaoSu28Mode(patch.doubingSu28.value) : normalizeGuolaoSu28Mode(patch.doubingSu28.value),
				};
				// 宿度制与宿盘共写同一键:主页亲手改 = 新命盘缺省(与宿盘同一个「新盘种子」,两页最后一次亲手选的生效)
				if(mainPage){
					recordNewChartSeeds({ doubingSu28: patch.doubingSu28.value });
				}
			}
			if(patch.guolaoLifeMode && Object.prototype.hasOwnProperty.call(patch.guolaoLifeMode, 'value')){
				patch.guolaoLifeMode = {
					...patch.guolaoLifeMode,
					value: mainPage ? setStoredGuolaoLifeMode(patch.guolaoLifeMode.value) : normalizeGuolaoLifeMode(patch.guolaoLifeMode.value),
				};
			}
			if(patch.guolaoNodeMode && Object.prototype.hasOwnProperty.call(patch.guolaoNodeMode, 'value')){
				patch.guolaoNodeMode = {
					...patch.guolaoNodeMode,
					value: mainPage ? setStoredGuolaoNodeMode(patch.guolaoNodeMode.value) : normalizeGuolaoNodeMode(patch.guolaoNodeMode.value),
				};
			}
			// 择日宿主内嵌:改动交给宿主的覆盖层(宿主用新 fields 拉底盘重排),不写主盘
			if(sendScopedFields(this.props, patch, { recompute: confirmed })){
				return;
			}
			let flds = {
				fields: {
					...this.props.fields,
					...patch,
					nohook: false,
				}
			};
			if(!confirmed){
				this.props.dispatch({
					type: 'astro/fetchByFields',
					payload: {
						...flds.fields,
						nohook: true,
						__requestOptions: {
							silent: true,
						},
					},
				});
				if(this.prefetchTimer){
					clearTimeout(this.prefetchTimer);
				}
				this.prefetchTimer = setTimeout(()=>{
					this.prefetchTimer = null;
					if(this.unmounted){
						return;
					}
					this.prefetchChart(fieldsToParams(flds.fields)).catch(()=>{
						return null;
					});
				}, 220);
				return;
			}
			if(this.prefetchTimer){
				clearTimeout(this.prefetchTimer);
				this.prefetchTimer = null;
			}
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: {
					...flds.fields,
					__requestOptions: {
						silent: true,
					},
				},
			});
		}
	}

	onTipClick(tipobj){
		this.setState({
			tips: tipobj,
		});
	}


	// WP-H-2 极速化:重 wrapper sCU —— 全 props 机械浅比(函数型跳过,详 wrapperPropsEqual);
	// state 变化改为**按字段**判定(horosa_guolao_scu_slice_v1):只有当变的字段全部落在
	// 「render() 从不读」白名单里时才跳过,其余一律照旧重渲。
	// 收益:宿主因无关状态重渲时,本重组件整树不再白跑。关 chartSCU 开关 = 恒重渲旧行为。
	shouldComponentUpdate(nextProps, nextState){
		if(guolaoStateChangeMatters(this.state, nextState)){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	componentDidMount(){
		this.unmounted = false;
		// v2.2.1: 监听全局日界 / 晚子时·时柱起干切换 → 重新 fetch 七政四余/Moira 盘。
		// 关键:用 setTimeout 0 延迟到下一 macrotask,让 dva 的 syncFromGlobalLateZiHour subscription
		// 先把 fields.lateZiHourUseNextDay.value 更新到 store + React 把新 props 透给本组件,再 fetch。
		// 否则 this.props.fields 在 listener 同步触发时仍是旧 snapshot,fetch 用的还是旧值,Moira 必须刷新页面才生效。
		if(typeof window !== 'undefined'){
			const refetch = () => {
				if(this.unmounted) return;
				setTimeout(() => {
					if(this.unmounted) return;
					if(this.state.engineMode === 'kinastro'){
						this.requestKinastroQizheng();
					} else if(this.props.fields){
						this.requestChartObj();
					}
				}, 0);
			};
			this._dayBoundaryListener = refetch;
			this._lateZiHourListener = refetch;
			window.addEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			window.addEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if(this.state.engineMode === 'kinastro'){
			this.requestKinastroQizheng();
			return;
		}
		if(this.ensureGuolaoDefaults()){
			return;
		}
		if(this.props.fields){
			this.requestChartObj();
		}
	}

	componentDidUpdate(prevProps, prevState){
		if(this.state.engineMode === 'kinastro'){
			if(prevProps.fields !== this.props.fields || (prevState && prevState.engineMode !== this.state.engineMode)){
				this.requestKinastroQizheng();
			}
			return;
		}
		// 坚七政样式(kinastro 引擎)不起本页的盘、也不补空;切到别的样式那一刻补一次(fields 没变也要补)
		const leftKinastro = !!(prevState && prevState.engineMode === 'kinastro');
		if((prevProps.fields !== this.props.fields || leftKinastro) && this.ensureGuolaoDefaults()){
			return;
		}
		if(prevProps.planetDisplay !== this.props.planetDisplay){
			this.saveGuolaoAISnapshot(null, this.state.chartObj);
		}
		// 命主取法 / 行运法 / 定童限 / 年界 等显示偏好改动后重存页面快照:此前只在盘数据到达时存,
		// 切「行运法」后 [起盘信息] 标签行、[大限] 与 [限法实算] 段仍是旧值(右栏已变)。
		if(prevState && prevState.guolaoDisplay !== this.state.guolaoDisplay && this.state.chartObj){
			this.saveGuolaoAISnapshot(null, this.state.chartObj);
		}
		if(prevProps.value !== this.props.value && this.props.value){
			this.requestGuolaoBundle(this.props.value);
		}
		// 天星择日:pick 盘式且(切入盘式/择时变化/立命时刻变化/流年盘刷新)→ 重取双轮数据;
		// MOIRA 圆盘同触发(西占宫位格吃 staticHousesBySystem,本盘时刻变化时 staticDate 须跟上)。
		if(this.state.chartStyle === GUOLAO_CHART_STYLE_PICK || this.state.chartStyle === GUOLAO_CHART_STYLE_MOIRA){
			const styleSwitched = prevState && prevState.chartStyle !== this.state.chartStyle;
			const timeChanged = prevState && prevState.moiraTransitTime !== this.state.moiraTransitTime;
			const lifeChanged = prevState && prevState.eleLifeMode !== this.state.eleLifeMode;
			const transitArrived = prevState && prevState.moiraTransitChartObj !== this.state.moiraTransitChartObj;
			const valueChanged = prevProps.value !== this.props.value && !!this.props.value;
			if(styleSwitched || timeChanged || lifeChanged || valueChanged || (transitArrived && !this.state.electionData)){
				this.requestElectionData();
			}
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		// R4-B3:反注册步进预取器(防卸载后闭包吃到死组件态)。
		if(this._guolaoStepPrefetcher){
			unregisterStepPrefetcher('guolao', this._guolaoStepPrefetcher);
			this._guolaoStepPrefetcher = null;
		}
		this.moiraReqSeq++;
		this.moiraTransitReqSeq++;
		this.qizhengKinReqSeq++;
		if(typeof window !== 'undefined'){
			if(this._dayBoundaryListener){
				window.removeEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			}
			if(this._lateZiHourListener){
				window.removeEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			}
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if(this.prefetchTimer){
			clearTimeout(this.prefetchTimer);
			this.prefetchTimer = null;
		}
	}

	renderMoiraSection(title, children, extraClass = ''){
		return (
			<div className={`horosa-guolao-quick-section ${extraClass}`.trim()}>
				<div className="horosa-guolao-quick-section-title">{title}</div>
				{children}
			</div>
		);
	}

	renderMoiraEmpty(text){
		return (
			<div className="horosa-guolao-quick-empty">{text}</div>
		);
	}

	renderQuickMeta(items){
		return (
			<div className="horosa-guolao-quick-meta-grid">
				{items.filter((item)=>item && item.value !== undefined && item.value !== null && item.value !== '').map((item)=>(
					<div className="horosa-guolao-quick-meta" key={item.label}>
						<span>{item.label}</span>
						<strong>{item.value}</strong>
					</div>
				))}
			</div>
		);
	}

	renderQuickPlanetRows(rows){
		if(!rows.length){
			return this.renderMoiraEmpty('当前星历响应里没有可输出的星曜数据。');
		}
		return (
			<div className="horosa-guolao-quick-table horosa-guolao-quick-planet-table">
				<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
					<span>星曜</span><span>宫位</span><span>黄道</span><span>宿度</span><span>势态</span><span>速度</span>
				</div>
				{rows.map((row)=>(
					<div className="horosa-guolao-quick-table-row" key={row.id}>
						<strong>{row.name}</strong>
						<span>{row.house || '-'}</span>
						<span>{row.degree || row.signName || '-'}</span>
						<span>{row.su28 ? `${row.su28} ${row.compactDegree}` : row.compactDegree}</span>
						<span>{[row.dignity, row.status].filter(Boolean).join(' / ') || '-'}</span>
						<span>{row.speed || '-'}</span>
					</div>
				))}
			</div>
		);
	}

	renderQuickYearPlanetRows(rows){
		const list = safeList(rows);
		if(!list.length){
			return this.renderMoiraEmpty('当前 Moira 规则层未返回化曜数据。');
		}
		return (
			<div className="horosa-guolao-quick-table horosa-guolao-quick-planet-table">
				<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
					<span>曜</span><span>化曜</span><span>同归项</span><span></span><span></span><span></span>
				</div>
				{list.map((row)=>(
					<div className="horosa-guolao-quick-table-row" key={row.star}>
						<strong>{row.star}</strong>
						<span>{row.changeTo || '-'}</span>
						<span>{joinNames(row.items)}</span>
						<span></span><span></span><span></span>
					</div>
				))}
			</div>
		);
	}

	renderQuickYearGroups(groups){
		const list = safeList(groups);
		if(!list.length){
			return this.renderMoiraEmpty('当前 Moira 规则层未返回天禄至天权数据。');
		}
		return (
			<div className="horosa-guolao-quick-card-grid horosa-guolao-quick-year-grid">
				{list.map((group, idx)=>(
					<div className="horosa-guolao-quick-card" key={`${group.main || 'group'}-${idx}`}>
						<div className="horosa-guolao-quick-card-title">{group.main || '-'}</div>
						<div className="horosa-guolao-quick-card-text">{joinMoiraYearItems(group.items)}</div>
					</div>
				))}
			</div>
		);
	}

	renderQuickYearSignRows(rows){
		const list = safeList(rows);
		if(!list.length){
			return this.renderMoiraEmpty('当前 Moira 规则层未返回命曜数据。');
		}
		return (
			<div className="horosa-guolao-quick-table horosa-guolao-quick-weak-table">
				<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
					<span>宫名</span><span>化曜</span><span>曜名</span><span>宫性</span>
				</div>
				{list.map((row)=>(
					<div className="horosa-guolao-quick-table-row" key={`${row.mode || 'year'}-${row.name}`}>
						<strong>{row.name}</strong>
						<span>{row.star || '-'}</span>
						<span>{row.shortName || '-'}</span>
						<span>{[row.quality, row.zi, row.signName].filter(Boolean).join(' · ')}</span>
					</div>
				))}
			</div>
		);
	}

		renderQuickPatterns(){
			const rules = this.state.moiraRules || {};
			const unverifiedSource = hasUnverifiedMoiraPatternSource(rules);
			const meta = moiraStyleLevelMeta(rules, this.state.moiraStyleLevel);
			const allPatterns = unverifiedSource ? [] : safeList(rules.patterns);
			const byLevel = applyMoiraStyleLevel(allPatterns, meta);
			const patterns = byLevel;
			const warning = rules.styleWarning || (unverifiedSource ? '当前接口返回的是旧版 Horosa 近似格局，不是 Moira 本体的政余喜格/忌格；已在前端屏蔽，避免误读。' : '');
			const good = patterns.filter((item)=>item.level === 'good');
			const bad = patterns.filter((item)=>item.level === 'bad');
			const other = patterns.filter((item)=>item.level !== 'good' && item.level !== 'bad');
			const renderPatternGroup = (type, label, list, emptyText)=>(
				<div className={`horosa-guolao-quick-pattern-group horosa-guolao-quick-pattern-group-${type}`}>
					<div className="horosa-guolao-quick-pattern-group-head">
						<span>{type === 'good' ? '喜' : '忌'}</span>
						<strong>{label}</strong>
						<em>{list.length} 条</em>
					</div>
					<div className="horosa-guolao-quick-pattern-chip-list">
						{list.length ? list.map((item, idx)=>(
							<span key={`${type}-${item.name}-${idx}`} title={item.detail || item.dsl || item.name}>{item.name}</span>
						)) : <i>{emptyText}</i>}
					</div>
				</div>
			);
			return (
				<div className="horosa-guolao-quick-dialog">
					{warning ? this.renderMoiraSection('格局数据源', (
						<div className="horosa-guolao-quick-warning">{warning}</div>
					)) : null}
					{this.renderMoiraSection('显示程度', (
						<div className="horosa-guolao-quick-meta horosa-guolao-quick-style-level">
							<label>
								<span>最低</span>
								<input
									type="range"
									min={meta.min}
									max={meta.max}
									step="1"
									value={meta.level}
									onInput={this.onMoiraStyleLevelChange}
									onChange={this.onMoiraStyleLevelChange}
									onClick={this.onMoiraStyleLevelChange}
									onMouseUp={this.onMoiraStyleLevelChange}
									onKeyUp={this.onMoiraStyleLevelChange}
								/>
								<span>最高</span>
							</label>
							<div className="horosa-guolao-quick-card-text">
								当前 {meta.level} 档，显示格局档位 ≥ {meta.displayLevel}；显示 {patterns.length}/{allPatterns.length} 条命中格局。
							</div>
						</div>
					))}
					<div className="horosa-guolao-quick-pattern-output">
						{renderPatternGroup('good', '政余喜格', good, warning ? 'Moira 真实喜格 DSL 尚未接入，暂不输出正式喜格。' : '当前盘未命中 Moira 喜格。')}
						{renderPatternGroup('bad', '政余忌格', bad, warning ? 'Moira 真实忌格 DSL 尚未接入，暂不输出正式忌格。' : '当前盘未命中 Moira 忌格。')}
					</div>
				{other.length ? this.renderMoiraSection('察看项', (
					<div className="horosa-guolao-quick-card-grid">
						{other.map((item, idx)=>(
							<div className={`horosa-guolao-quick-card horosa-guolao-quick-pattern-${item.level || 'neutral'}`} key={`${item.name}-${idx}`}>
								<div className="horosa-guolao-quick-card-title">{item.name}</div>
								<div className="horosa-guolao-quick-card-text">{item.detail || 'Moira 规则命中，但后端未返回细节。'}</div>
							</div>
						))}
					</div>
				)) : null}
			</div>
		);
	}

	renderQuickYearStars(){
		const birthParams = this.genParams();
		const transitParams = paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime);
		const birthYear = yearFromParams(birthParams);
		const transitYear = yearFromParams(transitParams);
		const birthGz = baziStemBranch(this.state.chartObj, 'year', birthYear);
		const transitGz = stemBranchForYear(transitYear);
		const rules = this.state.moiraRules || {};
		const nativeYearStars = safeMap(rules.yearStars);
		const birthYearStars = safeMap(nativeYearStars.birth);
		const transitYearStars = safeMap(nativeYearStars.transit);
		if(safeList(transitYearStars.groups).length || safeList(birthYearStars.groups).length){
			return (
				<div className="horosa-guolao-quick-dialog">
					{this.renderMoiraSection('年曜化星', this.renderQuickMeta([
						{label: '本命年柱', value: birthYearStars.yearPole || birthGz},
						{label: '流年年柱', value: transitYearStars.yearPole || transitGz},
						{label: '流年时间', value: `${transitParams.date} ${transitParams.time}`},
						{label: '本命首曜', value: birthYearStars.yearStar},
						{label: '流年首曜', value: transitYearStars.yearStar},
						{label: '规则源', value: rules.styleSource || 'moira_s.prop'},
					]))}
					{this.renderMoiraSection('流年化曜', this.renderQuickYearPlanetRows(transitYearStars.planetRows))}
					{this.renderMoiraSection('本命化曜', this.renderQuickYearPlanetRows(birthYearStars.planetRows))}
					{this.renderMoiraSection('流年天禄至天权', this.renderQuickYearGroups(transitYearStars.groups))}
				</div>
			);
		}
		const stem = transitGz.slice(0, 1);
		const currentStar = MOIRA_YEAR_STAR_BY_STEM[stem] || '';
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('年曜化星', this.renderQuickMeta([
					{label: '本命年柱', value: birthGz},
					{label: '流年年柱', value: transitGz},
					{label: '流年时间', value: `${transitParams.date} ${transitParams.time}`},
					{label: 'Moira化曜', value: currentStar ? `${stem}年化${currentStar}` : '未取得流年干'},
					{label: '年曜序', value: MOIRA_YEAR_STAR_SEQ.join('、')},
					{label: '年干序', value: MOIRA_YEAR_STAR_MAP.join('、')},
				]))}
				{this.renderMoiraSection('天禄至天权', (
					<div className="horosa-guolao-quick-card-grid horosa-guolao-quick-year-grid">
						{MOIRA_YEAR_INFO_GROUPS.map((items, idx)=>(
							<div className="horosa-guolao-quick-card" key={items[0]}>
								<div className="horosa-guolao-quick-card-title">{items[0]}</div>
								<div className="horosa-guolao-quick-card-text">{items.slice(1).join('、') || '主项'}</div>
								{idx === 0 && currentStar ? <em>本流年化星：{currentStar}</em> : null}
							</div>
						))}
					</div>
				))}
				{this.renderMoiraSection('十神序', this.renderQuickMeta([
					{label: '原十神序', value: MOIRA_TEN_GOD_ORG.join('、')},
					{label: '替代十神序', value: MOIRA_TEN_GOD_ALT.join('、')},
				]))}
			</div>
		);
	}

	renderQuickWeakSolid(){
		const rules = this.state.moiraRules || {};
		const nativeWeakSolid = safeMap(rules.weakSolid);
		const nativeHouseRows = safeList(nativeWeakSolid.houses);
		if(nativeHouseRows.length){
			return (
				<div className="horosa-guolao-quick-dialog">
					{this.renderMoiraSection('虚实宫位', (
						<div className="horosa-guolao-quick-table horosa-guolao-quick-weak-table">
							<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
								<span>宫位</span><span>虚实</span><span>虚柱</span><span>实柱</span>
							</div>
							{nativeHouseRows.map((house, idx)=>(
								<div className="horosa-guolao-quick-table-row" key={`${house.house}-${idx}`}>
									<strong>{house.house}</strong>
									<span className={house.solid ? 'horosa-guolao-quick-solid' : (house.weak ? 'horosa-guolao-quick-weak' : '')}>{house.label || '-'}</span>
									<span>{joinNames(house.weakPillars)}</span>
									<span>{joinNames(house.solidPillars)}</span>
								</div>
							))}
						</div>
					))}
					{this.renderMoiraSection('Moira口径', this.renderQuickMeta([
						{label: '虚宫', value: '按四柱旬空推虚：Moira computeWeakHouse。'},
						{label: '实宫', value: '按年、月、日、时四柱地支定实。'},
					]))}
				</div>
			);
		}
		const houses = safeList(rules.houses);
		const rows = buildQuickPlanetRows(this.state.chartObj, rules.planets);
		const byHouse = new Map();
		rows.forEach((row)=>{
			const key = row.house || '未定';
			if(!byHouse.has(key)){
				byHouse.set(key, []);
			}
			byHouse.get(key).push(row.name);
		});
		const houseRows = houses.length ? houses : Array.from(byHouse.keys()).map((name)=>({name}));
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('虚实宫位', (
					<div className="horosa-guolao-quick-table horosa-guolao-quick-weak-table">
						<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
							<span>宫位</span><span>虚实</span><span>星曜</span><span>位置</span>
						</div>
						{houseRows.map((house, idx)=>{
							const stars = byHouse.get(house.name) || [];
							return (
								<div className="horosa-guolao-quick-table-row" key={`${house.name}-${idx}`}>
									<strong>{house.name}</strong>
									<span className={stars.length ? 'horosa-guolao-quick-solid' : 'horosa-guolao-quick-weak'}>{stars.length ? '实' : '虚'}</span>
									<span>{stars.length ? stars.join('、') : '无星曜驻守'}</span>
									<span>{[house.zi, house.area, house.signName].filter(Boolean).join(' · ') || '-'}</span>
								</div>
							);
						})}
						{houseRows.length === 0 ? this.renderMoiraEmpty('当前 Moira 规则层未返回宫位虚实数据。') : null}
					</div>
				))}
				{this.renderMoiraSection('Moira口径', this.renderQuickMeta([
					{label: '虚宫', value: '无七政四余驻守的宫位，按 Moira 虚宫线口径展示。'},
					{label: '实宫', value: '有七政四余驻守的宫位，按 Moira 实宫线口径展示。'},
				]))}
			</div>
		);
	}

	renderQuickNatalStars(){
		const rules = this.state.moiraRules || {};
		const nativeRows = safeList(rules.natalYearStars);
		if(nativeRows.length){
			const anchors = safeMap(rules.anchors);
			return (
				<div className="horosa-guolao-quick-dialog">
					{this.renderMoiraSection('命曜', this.renderQuickYearSignRows(nativeRows))}
					{this.renderMoiraSection('命身锚点', this.renderQuickMeta([
						{label: '命度', value: anchors.life ? [anchors.life.signName, anchors.life.degreeText, anchors.life.zi, anchors.life.moiraHouse, anchors.lifeModeName || rules.lifeModeName].filter(Boolean).join(' · ') : ''},
						{label: '身度', value: anchors.self ? [anchors.self.signName, anchors.self.degreeText, anchors.self.zi, anchors.self.moiraHouse].filter(Boolean).join(' · ') : ''},
						{label: '四柱', value: baziText(this.state.chartObj)},
						{label: '规则源', value: rules.styleSource || 'moira_s.prop'},
					]))}
				</div>
			);
		}
		const rows = buildQuickPlanetRows(this.state.chartObj, rules.planets);
		const anchors = safeMap(rules.anchors);
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('命盘星曜', this.renderQuickPlanetRows(rows))}
				{this.renderMoiraSection('命身锚点', this.renderQuickMeta([
					{label: '命度', value: anchors.life ? [anchors.life.signName, anchors.life.degreeText, anchors.life.zi, anchors.life.moiraHouse, anchors.lifeModeName || rules.lifeModeName].filter(Boolean).join(' · ') : ''},
					{label: '身度', value: anchors.self ? [anchors.self.signName, anchors.self.degreeText, anchors.self.zi, anchors.self.moiraHouse].filter(Boolean).join(' · ') : ''},
					{label: '四柱', value: baziText(this.state.chartObj)},
					{label: '农历', value: lunarText(this.state.chartObj)},
				]))}
			</div>
		);
	}

	renderQuickTransitStars(){
		const rows = buildQuickPlanetRows(this.shownMoiraTransitChartObj(), []);
		const transitParams = paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime);
		const transitYear = yearFromParams(transitParams);
		const rules = this.state.moiraRules || {};
		const nativeRows = safeList(rules.transitYearStars);
		const currentYearStars = safeMap(safeMap(rules.yearStars).transit);
		if(nativeRows.length || safeList(currentYearStars.planetRows).length){
			return (
				<div className="horosa-guolao-quick-dialog">
					{this.renderMoiraSection('流曜', this.state.moiraTransitLoading
						? this.renderMoiraEmpty('流年盘正在计算。')
						: this.renderQuickYearSignRows(nativeRows))}
					{this.renderMoiraSection('流年化曜', this.renderQuickYearPlanetRows(currentYearStars.planetRows))}
					{this.renderMoiraSection('流年参数', this.renderQuickMeta([
						{label: '流年时间', value: `${transitParams.date} ${transitParams.time}`},
						{label: '流年干支', value: currentYearStars.yearPole || stemBranchForYear(transitYear)},
						{label: '规则源', value: rules.styleSource || 'moira_s.prop'},
					]))}
				</div>
			);
		}
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('流曜星体', this.state.moiraTransitLoading
					? this.renderMoiraEmpty('流年盘正在计算。')
					: this.renderQuickPlanetRows(rows))}
				{this.renderMoiraSection('流年参数', this.renderQuickMeta([
					{label: '流年时间', value: `${transitParams.date} ${transitParams.time}`},
					{label: '流年干支', value: stemBranchForYear(transitYear)},
					{label: '流年化曜', value: `${stemBranchForYear(transitYear).slice(0, 1)} → ${MOIRA_YEAR_STAR_BY_STEM[stemBranchForYear(transitYear).slice(0, 1)] || '-'}`},
				]))}
			</div>
		);
	}

	renderQuickAspects(){
		const rows = buildAspectRows(this.state.chartObj && this.state.chartObj.aspects);
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('相位列表', rows.length ? (
					<div className="horosa-guolao-quick-table horosa-guolao-quick-aspect-table">
						<div className="horosa-guolao-quick-table-row horosa-guolao-quick-table-head">
							<span>主星</span><span>相位</span><span>客星</span><span>状态</span><span>误差</span>
						</div>
						{rows.map((row)=>(
							<div className="horosa-guolao-quick-table-row" key={row.key}>
								<strong>{row.from}</strong>
								<span>{row.aspect}</span>
								<span>{row.to}</span>
								<span>{row.state}</span>
								<span>{row.orb || '-'}</span>
							</div>
						))}
					</div>
				) : this.renderMoiraEmpty('当前七政盘没有返回可列出的相位数据。'))}
			</div>
		);
	}

	renderQuickGodRows(rows){
		if(!rows.length){
			return this.renderMoiraEmpty('当前盘没有返回可列出的神煞数据。');
		}
		return (
			<div className="horosa-guolao-quick-god-grid">
				{rows.map((row, idx)=>(
					<div className="horosa-guolao-quick-god-card" key={`${row.house}-${row.zi}-${idx}`}>
							<div className="horosa-guolao-quick-card-title">{row.house || row.zi || `宫位${idx + 1}`}</div>
							<div className="horosa-guolao-quick-card-subtitle">{[row.zi, row.signName].filter(Boolean).join(' · ')}</div>
							{safeList(row.gods).length ? <div><span>曜</span>{joinNames(row.gods)}</div> : (
								<>
									<div><span>吉</span>{joinNames(row.goodGods)}</div>
									<div><span>平</span>{joinNames(row.neutralGods)}</div>
									<div><span>忌</span>{joinNames(row.badGods)}</div>
									<div><span>岁</span>{joinNames(row.taisuiGods)}</div>
								</>
							)}
						</div>
					))}
			</div>
		);
	}

	renderQuickGods(){
		const rules = this.state.moiraRules || {};
		const birthRows = normalizeGodRows(safeList(rules.godHits).length ? rules.godHits : buildGodRowsFromChart(this.state.chartObj, this.props.fields), MOIRA_BIRTH_GOD_ORDER);
		const transitRows = normalizeGodRows(safeList(rules.transitGodHits).length ? rules.transitGodHits : buildGodRowsFromChart(this.shownMoiraTransitChartObj(), this.props.fields), MOIRA_TRANSIT_GOD_ORDER);
		return (
			<div className="horosa-guolao-quick-dialog">
				{this.renderMoiraSection('本命神煞', this.renderQuickGodRows(birthRows))}
				{this.renderMoiraSection('流年神煞', this.state.moiraTransitLoading ? this.renderMoiraEmpty('流年神煞正在计算。') : this.renderQuickGodRows(transitRows))}
				{this.renderMoiraSection('Moira显示序', this.renderQuickMeta([
					{label: '本命显示序', value: MOIRA_BIRTH_GOD_ORDER.join('、')},
					{label: '流年显示序', value: MOIRA_TRANSIT_GOD_ORDER.join('、')},
				]))}
			</div>
		);
	}

	renderMoiraQuickContent(key){
		if(this.state.moiraLoading && key !== 'transitStars'){
			return this.renderMoiraEmpty('Moira 规则层正在推演，稍后会自动填入。');
		}
		if(key === 'patterns'){
			return this.renderQuickPatterns();
		}
		if(key === 'yearStars'){
			return this.renderQuickYearStars();
		}
		if(key === 'weakSolid'){
			return this.renderQuickWeakSolid();
		}
		if(key === 'natalStars'){
			return this.renderQuickNatalStars();
		}
		if(key === 'transitStars'){
			return this.renderQuickTransitStars();
		}
		if(key === 'aspects'){
			return this.renderQuickAspects();
		}
		if(key === 'gods'){
			return this.renderQuickGods();
		}
		return this.renderMoiraEmpty('请选择一个快捷功能。');
	}

	// ── 天星择日双轮(pick 盘式)数据链 ──
	// 类A:择时时刻(moiraTransitTime)/立命时刻 → 重取端点;类B:electionOptions → 纯重绘。
	requestElectionData(){
		const fields = this.props.fields;
		// pick=择日双轮全量;MOIRA 圆盘也取(仅用 staticHousesBySystem 画西占不等宫宫位格:
		// 上升=1宫头、逆时针、格宽=真实宫宽,与择日盘同款做法)。
		const styleOk = this.state.chartStyle === GUOLAO_CHART_STYLE_PICK || this.state.chartStyle === GUOLAO_CHART_STYLE_MOIRA;
		if(!fields || !styleOk){
			return;
		}
		const tp = paramsWithMoiraTransit(fields, this.state.moiraTransitTime) || {};
		if(!tp.date || tp.gpsLat === undefined || tp.gpsLon === undefined){
			return;
		}
		const seq = ++this.electionReqSeq;
		this.setState({ electionLoading: true });
		// 紫炁黄经透传自流年 chartObj(与全站四余口径同源,防双引擎漂移)
		const transitChart = this.shownMoiraTransitChartObj() && this.shownMoiraTransitChartObj().chart;
		const extraBodies = [];
		if(transitChart && Array.isArray(transitChart.objects)){
			const ziqi = transitChart.objects.find((o)=>o && o.id === AstroConst.PURPLE_CLOUDS);
			if(ziqi && Number.isFinite(Number(ziqi.lon))){
				extraBodies.push({ id: 'PurpleClouds', label: '炁', lon: Number(ziqi.lon), lat: 0, speed: 0 });
			}
			// 天海冥透传择日动盘外圈(与炁同机制:后端按 lon/lat 算地平方位)。用其真黄纬/日行度以准方位与逆行徽标。
			[[AstroConst.URANUS, '天'], [AstroConst.NEPTUNE, '海'], [AstroConst.PLUTO, '冥']].forEach(([oid, lab])=>{
				const o = transitChart.objects.find((x)=>x && x.id === oid);
				if(o && Number.isFinite(Number(o.lon))){
					extraBodies.push({
						id: oid,
						label: lab,
						lon: Number(o.lon),
						lat: Number.isFinite(Number(o.lat)) ? Number(o.lat) : 0,
						speed: Number.isFinite(Number(o.lonspeed)) ? Number(o.lonspeed) : 0,
					});
				}
			});
		}
		const staticParams = this.genParams() || {};
		const values = {
			date: tp.date,
			time: tp.time || '12:00:00',
			// 静盘时刻(左栏顶部时间):内盘西占宫位/1宫头须与静盘上升同时刻同源
			staticDate: staticParams.date,
			staticTime: staticParams.time,
			zone: tp.zone || '8:00',
			gpsLat: tp.gpsLat,
			gpsLon: tp.gpsLon,
			eleLifeMode: this.state.eleLifeMode,
			// 罗计 / 月孛取法跟盘:与同页主盘、流年盘同一来源(tp = fieldsToParams:盘上的值,盘上缺这一项才回落本机值;
			// 择日里内嵌的盘 = 工作台口径)。此前七政页这里直读本机值,载入「盘上 ≠ 本机」的命盘时择时盘与主盘两套取法
			nodeType: tp.guolaoNodeType === 'true' ? 'true' : 'mean',
			lilithType: tp.guolaoLilithType === 'true' ? 'true' : 'mean',
			ayanamsaDeg: 0,
			extraBodies,
		};
		fetchQizhengElection(values).then((res)=>{
			if(this.unmounted || seq !== this.electionReqSeq){
				return;
			}
			this.setState({ electionData: res, electionLoading: false });
		}).catch(()=>{
			if(this.unmounted || seq !== this.electionReqSeq){
				return;
			}
			// 端点不可达:保留旧数据(有则续显),仅结束 loading;离线兜底由轮盘层的本地方位计算承担
			this.setState({ electionLoading: false });
		});
	}

	// horosa_guolao_render_memo_v1(PERF-R9 Ship 6):render() 内每次都现造的派生值做**按输入记忆化**。
	// 三处调用点(择日表/择日轮/左栏)每渲一帧就跑三遍 paramsWithMoiraTransit + WMM 磁偏模型;
	// 且每次返回新对象 → 下游 memo/浅比较必然失效。键=(fields, moiraTransitTime) 引用,
	// 与既有 componentDidUpdate 的判变口径(prevState.moiraTransitTime !== this.state.moiraTransitTime)
	// 完全一致:任一变化即重算,不存在陈旧。
	memoTransitParams(){
		const fields = this.props.fields;
		const tm = this.state.moiraTransitTime;
		if(this._tpValue && this._tpFields === fields && this._tpTime === tm){
			return this._tpValue;
		}
		this._tpFields = fields;
		this._tpTime = tm;
		this._tpValue = paramsWithMoiraTransit(fields, tm);
		return this._tpValue;
	}

	// 磁偏解析:自行修正=WMM(按择时年月);手动=输入值恒优先。超模型年限打标供角注警示。
	// horosa_guolao_render_memo_v1:同帧多次调用只算一次(键=electionOptions/fields/moiraTransitTime 引用)。
	resolveElectionDeclination(){
		if(this._declValue !== undefined
			&& this._declEle === this.state.electionOptions
			&& this._declFields === this.props.fields
			&& this._declTime === this.state.moiraTransitTime){
			return this._declValue;
		}
		this._declEle = this.state.electionOptions;
		this._declFields = this.props.fields;
		this._declTime = this.state.moiraTransitTime;
		this._declValue = this.computeElectionDeclination();
		return this._declValue;
	}

	computeElectionDeclination(){
		const ele = this.state.electionOptions || {};
		if(ele.adjNorth === false){
			if(this.state.electionDeclOutOfRange){
				// 手动模式不涉模型,清残留标记(下轮 setState 合并,不在 render 中反复触发)
			}
			return Number(ele.magShiftManual) || 0;
		}
		const tp = paramsWithMoiraTransit(this.props.fields, this.state.moiraTransitTime) || {};
		if(tp.gpsLat === undefined || tp.gpsLon === undefined || !tp.date){
			return 0;
		}
		const dp = parseDateParts(tp.date);   // 民用日期串单源解析(公元前前导负号不丢)
		const year = (dp ? dp.year : NaN) + (Math.max(1, (dp && dp.month) || 1) - 1) / 12;
		const res = getMagneticDeclination(year, Number(tp.gpsLon), Number(tp.gpsLat));
		if(res.outOfRange !== this.state.electionDeclOutOfRange && !this._declFlagScheduled){
			this._declFlagScheduled = true;
			window.setTimeout(()=>{
				this._declFlagScheduled = false;
				if(!this.unmounted){
					this.setState({ electionDeclOutOfRange: res.outOfRange });
				}
			}, 0);
		}
		return res.declination;
	}

	// 分宫制 / 天星择日各项 / 立命时刻与其它显示偏好同律:只有七政主页写记忆,择日内嵌实例只改本页
	onGuolaoElectionChange(patch){
		const safe = setStoredGuolaoElection({ ...(this.state.electionOptions || {}), ...(patch || {}) }, { persist: this.persistsGuolaoPrefs(), base: this.state.electionOptions });
		this.setState({ electionOptions: safe });
	}

	// 搜索结果一键设为择日时刻(驱动双轮与流年盘同步重取)
	onPickElectionMoment(row){
		if(!row || !row.date){
			return;
		}
		const cur = this.state.moiraTransitTime;
		const next = cur && cur.clone ? cur.clone() : null;
		if(!next || !next.parse){
			return;
		}
		next.parse(`${toSlashDate(`${row.date}`)} ${row.time || '12:00:00'}`, 'YYYY-MM-DD HH:mm:ss');
		this.onMoiraTransitTimeChange({ value: next });
	}

	onEleLifeModeChange(val){
		const mode = setStoredGuolaoEleLifeMode(val, { persist: this.persistsGuolaoPrefs() });
		this.setState({ eleLifeMode: mode });
	}

	// 化曜/虚实/命曜/流曜/相位 五类信息面板原本没有——注入为右栏常驻 tab(信息不得仅在
	// 快捷弹层可见);格局/神煞面板已有同源信息,不重复注入(格局弹窗仍留盘面徽标入口)。
	// horosa_freeze_subtabs_v1:children 一律传【thunk `()=>节点`】(GuoLaoMoiraPanel 的 extraTabs
	// 契约两种形态都吃,那边统一归一后交 FreezeSubTab)。原先是即时构造的节点 —— 择日表/择日搜索/
	// 相位三块的元素树(含 resolveElectionDeclination()、memoTransitParams()、renderQuickAspects()
	// 三次真计算)在每次本组件重渲时都跑一遍,而右栏同时只显 1 个 tab。
	// [horosa_guolao_render_slice_v1] extraTabs 数组引用稳定化(单槽缓存,照 memoTransitParams 范式):
	// children 全是读 live state 的 thunk,数组重建本身廉价——稳定引用的意义在于不击穿 Panel 侧
	// wrapperPropsEqual 记忆。键必须涵盖「不经 Panel 其它 props 流动」的轴(electionData/electionOptions)
	// + aspects 轴 chartObj(rootValue 可能被 moiraPanelChartObj 覆盖,不可依赖它传导);
	// 其余键(moiraRules/fields/moiraTransitTime 等)与 Panel props 重复=双保险,多余失效无害。
	buildMoiraExtraTabs(){
		const sig = [
			this.state.chartStyle,
			this.state.electionData,
			this.shownMoiraTransitChartObj(),   // 键 = 实际渲染的流年盘(按来源键比对后的那份,与 GuoLaoElectionTable 入参同源)
			this.state.moiraRules,
			this.state.electionOptions,
			this.props.fields,
			this.state.moiraTransitTime,
			this.state.chartObj,
		];
		if(this._extraTabsValue && this._extraTabsSig
			&& this._extraTabsSig.length === sig.length
			&& this._extraTabsSig.every((v, i)=>v === sig[i])){
			return this._extraTabsValue;
		}
		const wrap = (node)=>(<div className="horosa-guolao-moira">{node}</div>);
		const electionTabs = this.state.chartStyle === GUOLAO_CHART_STYLE_PICK ? [
			{ key: 'election', label: '择日', children: ()=>wrap(
				<GuoLaoElectionTable
					electionData={this.state.electionData}
					transitChartObj={this.shownMoiraTransitChartObj()}
					moiraRules={this.state.moiraRules}
					election={this.state.electionOptions}
					declination={this.resolveElectionDeclination()}
				/>
			) },
			{ key: 'electionSearch', label: '搜索', children: ()=>wrap(
				<GuoLaoElectionSearch
					fields={this.props.fields}
					transitParams={this.memoTransitParams()}
					onPickMoment={(row)=>this.onPickElectionMoment(row)}
				/>
			) },
		] : [];
		// 化曜/虚实/命曜/流曜 四 tab 已裁撤:化曜=概览生年化曜+星曜表已有;虚实=概览「虚实四柱」
		// 卡;命曜/流曜=星曜 tab 本命/流年两节已有——信息不重复设 tab(用户钦定)。
		const tabs = [
			...electionTabs,
			{ key: 'aspects', label: '相位', children: ()=>wrap(this.renderQuickAspects()) },
		];
		this._extraTabsSig = sig;
		this._extraTabsValue = tabs;
		return tabs;
	}

	renderMoiraQuickModal(){
		const key = this.state.moiraQuickDialog;
		const meta = MOIRA_QUICK_ACTIONS.find((item)=>item.key === key);
		return (
			<XQModal
				className="horosa-guolao-quick-modal"
				visible={!!key}
				title={meta ? `Moira ${meta.label}` : 'Moira'}
				width={980}
				footer={null}
				destroyOnClose
				onCancel={this.closeMoiraQuickDialog}
			>
				{this.renderMoiraQuickContent(key)}
			</XQModal>
		);
	}

	renderQizhengKinRows(rows){
		const list = safeList(rows);
		if(!list.length){
			return <div className="horosa-qizheng-kin-empty">暂无内容</div>;
		}
		return (
			<div className="horosa-qizheng-kin-row-list">
				{list.map((item, idx)=>{
					const value = fmtQizhengKinRowValue(item);
					const lines = splitQizhengKinDisplayLines(value);
					return (
						<div className="horosa-qizheng-kin-row" key={`${item.label || 'row'}-${idx}`}>
							<span>{item.label}</span>
							<strong className={lines.length > 1 ? 'is-multiline' : ''}>
								{lines.map((line, lineIdx)=>(
									<span className="horosa-qizheng-kin-row-line" key={`${item.label || 'row'}-${idx}-${lineIdx}`}>{line}</span>
								))}
							</strong>
						</div>
					);
				})}
			</div>
		);
	}

	renderQizhengKinSection(section){
		return (
			<div className="horosa-qizheng-kin-info-card" key={section.title}>
				<h4>{section.title}</h4>
				{this.renderQizhengKinRows(section.rows)}
			</div>
		);
	}

	renderQizhengKinReadingCards(section){
		const rows = safeList(section && section.rows);
		return (
			<div className="horosa-qizheng-kin-info-card horosa-qizheng-kin-reading-card">
				<h4>{section && section.title ? section.title : '张果断语'}</h4>
				{rows.length ? (
					<div className="horosa-qizheng-kin-reading-list">
						{rows.map((item, idx)=>{
							const level = qizhengKinReadingLevel(item);
							const value = fmtQizhengKinRowValue(item);
							const lines = splitQizhengKinDisplayLines(value);
							return (
								<div className={`horosa-qizheng-kin-reading-item horosa-qizheng-kin-reading-${level}`} key={`${item.label || 'reading'}-${idx}`}>
									<div className="horosa-qizheng-kin-reading-head">
										<span>{qizhengKinReadingBadge(level)}</span>
										<strong>{item.label || '断语'}</strong>
									</div>
									<div className="horosa-qizheng-kin-reading-detail">
										{lines.map((line, lineIdx)=>(
											<p key={`${item.label || 'reading'}-${idx}-${lineIdx}`}>{line}</p>
										))}
									</div>
								</div>
							);
						})}
					</div>
				) : <div className="horosa-qizheng-kin-empty">暂无断语</div>}
			</div>
		);
	}

	renderQizhengKinMingGongBlock(mingGong){
		const data = safeMap(mingGong);
		return (
			<div className="horosa-qizheng-kin-info-stack">
				<div className="horosa-qizheng-kin-info-card">
					<h4>命宫</h4>
					{this.renderQizhengKinRows([
						{label: '地支', value: data.branch},
						{label: '宫位', value: data.house},
						{label: '入命星', value: data.planets},
					])}
				</div>
				{safeList(data.items).map((item)=>(
					<div className="horosa-qizheng-kin-info-card horosa-qizheng-kin-prose" key={item.title}>
						<h4>{item.title}</h4>
						<p>{item.text}</p>
					</div>
				))}
			</div>
		);
	}

	renderQizhengKinBoard(){
		const pan = this.shownQizhengKinPan();
		if(this.state.qizhengKinLoading && !pan){
			return <div className="horosa-qizheng-kin-status">七政四余排盘中...</div>;
		}
		if(this.state.qizhengKinError && !pan){
			return <div className="horosa-qizheng-kin-status horosa-qizheng-kin-error">{this.state.qizhengKinError}</div>;
		}
		if(!pan){
			return <div className="horosa-qizheng-kin-status">请点击起盘，或调整左侧选项。</div>;
		}
		return <GuoLaoQizhengWheel pan={pan} />;
	}

	renderQizhengKinInfoPanel(){
		const pan = this.shownQizhengKinPan();
		const qz = pan && pan.qizheng ? pan.qizheng : {};
		const sections = safeList(pan && pan.sections);
		const sectionByTitle = new Map(sections.map((item)=>[item.title, item]));
		const options = this.state.kinastroOptions || {};
		const zhangguo = safeMap(qz.zhangguo);
		const mingGong = safeMap(qz.mingGong);
		// horosa_freeze_subtabs_v1 接线:content 一律改为**惰性 thunk**(原先在数组构造时就把
		// 全部 9 个面板的元素树造出来 —— 用户只看得见 1 个)。thunk 由 FreezeSubTab 在
		// 「本面板激活过」时才求值:未激活过=零成本;已激活过的面板切走后保留 DOM/组件实例,
		// 切回时拿本轮最新 thunk 立即重渲(不重挂载、不重取数、不闪烁、不丢滚动位置)。
		const overviewContent = ()=>{
			const list = [
				sectionByTitle.get('起盘'),
				sectionByTitle.get('四柱'),
			].filter(Boolean).map((item)=>this.renderQizhengKinSection(item));
			if(options.showMingGong !== false){
				list.push(this.renderQizhengKinMingGongBlock(mingGong));
			}
			return list;
		};
		const tabs = [
			{key: 'overview', label: '概览', content: overviewContent},
			{key: 'planets', label: '星曜', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('星曜') || {title: '星曜', rows: []})},
			{key: 'houses', label: '宫位', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('十二宫') || {title: '十二宫', rows: []})},
			options.showShensha === false ? null : {key: 'shensha', label: '神煞', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('神煞') || {title: '神煞', rows: []})},
			{key: 'dasha', label: '年限', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('年限') || {title: '年限', rows: []})},
			options.showZhangguo === false ? null : {key: 'readings', label: '断语', content: ()=>(
				<div className="horosa-qizheng-kin-info-stack">
					{this.renderQizhengKinReadingCards(sectionByTitle.get('张果断语') || {title: '张果断语', rows: []})}
					<div className="horosa-qizheng-kin-info-card">
						<h4>格局目录</h4>
						<div className="horosa-qizheng-kin-chip-cloud">
							{Object.keys(safeMap(zhangguo.patternsByCategory)).map((key)=>(
								<span key={key}>{key} {safeList(zhangguo.patternsByCategory[key]).length}</span>
							))}
						</div>
					</div>
				</div>
			)},
			qz.transit ? {key: 'transit', label: '流时', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('流时') || {title: '流时', rows: []})} : null,
			qz.electional ? {key: 'electional', label: '择日', content: ()=>this.renderQizhengKinSection(sectionByTitle.get('择日') || {title: '择日', rows: []})} : null,
			qz.mansions ? {key: 'mansion', label: '宿度', content: ()=>(
				<div className="horosa-qizheng-kin-info-stack">
					{sections.filter((item)=>/宿度$/.test(item.title)).map((item)=>this.renderQizhengKinSection(item))}
				</div>
			)} : null,
		].filter(Boolean);
		const active = tabs.some((item)=>item.key === this.state.qizhengKinActiveTab)
			? this.state.qizhengKinActiveTab
			: (tabs[0] ? tabs[0].key : 'overview');
		return (
			<Tabs
				activeKey={active}
				onChange={this.onQizhengKinTabChange}
				tabPosition="top"
				className="horosa-content-tabs horosa-guolao-tabs horosa-qizheng-kin-tabs"
			>
				{tabs.map((item)=>(
					<TabPane tab={item.label} key={item.key}>
						<FreezeSubTab active={active === item.key}>
							{()=>(
								<div className="horosa-qizheng-kin-info-stack">
									{item.content()}
								</div>
							)}
						</FreezeSubTab>
					</TabPane>
				))}
			</Tabs>
		);
	}

	// 快捷栏契约:kinastro 引擎模式下原 9 键=右栏 Tabs 静态镜像,撤;精确引擎模式原 7 张
	// 速查弹层信息已全部常驻右栏(化曜/虚实/命曜/流曜/相位=注入 extraTabs;格局/神煞=面板
	// 原生 tab,格局另留盘面徽标弹窗入口)——信息不得仅在快捷栏可见。命例保存页头已有,不放。
	renderQuickDock(useKinastroQizheng){
		if(useKinastroQizheng){
			return (
				<QuickDockBar
					page="guolao"
					className="horosa-guolao-quick-dock horosa-qizheng-kin-quick-dock"
					hasResult={!!this.shownQizhengKinPan()}
					dispatch={this.props.dispatch}
				/>
			);
		}
		return (
			<QuickDockBar
				page="guolao"
				className="horosa-guolao-quick-dock"
				hasResult={!!this.state.chartObj}
				dispatch={this.props.dispatch}
			/>
		);
	}

	// 骨架已提为模块级 GuoLaoChartSkeleton(memo 边界内共用);此方法保留为同名转发,
	// 结构逐字节不变。
	renderGuolaoChartSkeleton(){
		return <GuoLaoChartSkeleton />;
	}

	// 神煞筛选清单=数据驱动:从当前盘 godHits/transitGodHits 现场收集全字集(后端 rule 引擎
	// 实际会画的字远多于固定序表——固定序只作排序前缀,新字追加,保证「选择全面+全联动」)。
	// horosa_guolao_render_memo_v1:神煞全字集收集(遍历 godHits/transitGodHits ~107 字 + 排序)
	// 原先**每帧**跑一次并返回新对象(左栏 GuoLaoInput 的 godNamePools prop 因此帧帧变新)。
	// 键=(moiraRules, chartObj, shownMoiraTransitChartObj()) 引用 —— 三者正是收集函数读取的全部输入,
	// 任一变化即重算,勾选↔盘面联动口径不变。
	collectGodNamePools(){
		const rules = this.state.moiraRules;
		const co = this.state.chartObj;
		const tco = this.shownMoiraTransitChartObj();   // 与 computeGodNamePools 实读的同一份(按来源键比对后)
		if(this._godPools && this._godPoolsRules === rules && this._godPoolsChart === co && this._godPoolsTransit === tco){
			return this._godPools;
		}
		this._godPoolsRules = rules;
		this._godPoolsChart = co;
		this._godPoolsTransit = tco;
		this._godPools = this.computeGodNamePools();
		return this._godPools;
	}

	computeGodNamePools(){
		// 与盘面绝对同源:盘面神煞环已切到 rules 引擎(godHits/transitGodHits,Moira prop 规则本尊),
		// 清单从同一 hits 收集(全集 ~107 字,勾选与盘一一联动);rules 未到回退历法 ziGods。
		const rules = this.state.moiraRules || {};
		const pickHits = (hits)=>{
			const out = [];
			const seen = new Set();
			(hits || []).forEach((h)=>{
				[].concat((h && h.gods) || [], (h && h.goodGods) || [], (h && h.neutralGods) || [], (h && h.badGods) || [], (h && h.taisuiGods) || []).forEach((g)=>{
					const name = `${g || ''}`.trim();
					if(name && !seen.has(name)){ seen.add(name); out.push(name); }
				});
			});
			return out;
		};
		const pick = (co)=>{
			const zg = moiraGetZiGods(co, co) || {};
			const out = [];
			const seen = new Set();
			Object.keys(zg).forEach((zi)=>{
				moiraCollectGods(zg, zi).forEach((g)=>{
					if(g && !seen.has(g)){ seen.add(g); out.push(g); }
				});
			});
			return out;
		};
		const orderBy = (names, order)=>{
			const inOrder = order.filter((g)=>names.indexOf(g) >= 0);
			const extras = names.filter((g)=>order.indexOf(g) < 0);
			return inOrder.concat(extras);
		};
		const birthHits = pickHits(rules.godHits);
		const transitHits = pickHits(rules.transitGodHits);
		return {
			birth: orderBy(birthHits.length ? birthHits : pick(this.state.chartObj), MOIRA_BIRTH_GOD_ORDER),
			transit: orderBy(transitHits.length ? transitHits : pick(this.shownMoiraTransitChartObj() || this.state.chartObj), MOIRA_TRANSIT_GOD_ORDER),
		};
	}

	// horosa_guolao_render_slice_v1(W3d-G0):派生盘单键缓存(chartObj/aspects/lots 三引用命中
	// 即复用同一派生对象)—— 见 render 内注记。
	getDerivedChart(chartObj){
		if(!chartObj){
			return {};
		}
		const c = this._derivedChartCache;
		if(c && c.src === chartObj.chart && c.aspects === chartObj.aspects && c.lots === chartObj.lots){
			return c.value;
		}
		const value = { ...(chartObj.chart || {}), aspects: chartObj.aspects || {}, lots: chartObj.lots || [] };
		this._derivedChartCache = { src: chartObj.chart, aspects: chartObj.aspects, lots: chartObj.lots, value };
		return value;
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 'calc(100% - 70px)'
		}else{
			height = height - 20
		}

		let chartObj = this.state.chartObj;
		// horosa_guolao_render_slice_v1(PERF-R12 W3d-G0):渲染期变异根除 —— 旧写法在 render 里
		// 就地把 aspects/lots 挂到 state 里的 chartObj.chart 上(同引用被悄悄改写 = 任何按引用
		// 比较的 memo 边界语义被毁;对抗校验点名「先修这处再上 memo」)。改为**带单键缓存的派生
		// 浅拷贝**:同一 chartObj ⇒ 同一派生引用(下游 React.memo 行为与旧同引用路径逐帧等价),
		// 换盘才换引用;state 对象从此只读。
		const chart = this.getDerivedChart(chartObj);
		const useMoiraWheel = this.state.chartStyle === GUOLAO_CHART_STYLE_MOIRA;
		const usePickWheel = this.state.chartStyle === GUOLAO_CHART_STYLE_PICK;
		const useMoiraLikeWheel = useMoiraWheel || usePickWheel;
		const moiraPanelChartObj = this.state.moiraPanelChartObj || chartObj;
		const moiraPanelTransitChartObj = this.state.moiraPanelTransitChartObj || this.shownMoiraTransitChartObj();
		const moiraPanelTransitParams = this.state.moiraPanelTransitParams || this.memoTransitParams();
		const useKinastroQizheng = this.state.engineMode === 'kinastro';
		const stageTransitParams = this.memoTransitParams();
		const stageDeclination = this.resolveElectionDeclination();

		return (
			<div className={`horosa-guolao-page horosa-astro-redesign horosa-guolao-redesign${useKinastroQizheng ? ' horosa-qizheng-kin-page' : ''}`}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-guolao-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-guolao-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-guolao-input-panel">
							{/* [择日宿主] 左栏插槽(主七政页不传=零渲染) */}
							{typeof this.props.renderLeftExtra === 'function' ? this.props.renderLeftExtra() : null}
							<GuoLaoInput
								fields={this.props.fields}
								onFieldsChange={this.onFieldsChange}
								persistPrefs={(this.props.techniqueScope || 'guolao') === 'guolao'}
								engineMode={this.state.engineMode}
								onEngineModeChange={this.onEngineModeChange}
								kinastroOptions={this.state.kinastroOptions}
								onKinastroOptionChange={this.onKinastroOptionChange}
								chartStyle={this.state.chartStyle}
								onChartStyleChange={this.onChartStyleChange}
								zeriLocked={this.props.zeriLocked}
								moiraTransitTime={this.state.moiraTransitTime}
								onMoiraTransitTimeChange={this.onMoiraTransitTimeChange}
								showMoiraTransitGods={this.state.showMoiraTransitGods}
								onMoiraTransitGodsVisibleChange={this.onMoiraTransitGodsVisibleChange}
								guolaoDisplay={this.state.guolaoDisplay}
								onGuolaoDisplayChange={this.onGuolaoDisplayChange}
								godNamePools={this.collectGodNamePools()}
								electionOptions={this.state.electionOptions}
								onGuolaoElectionChange={(patch)=>this.onGuolaoElectionChange(patch)}
								eleLifeMode={this.state.eleLifeMode}
								onEleLifeModeChange={(val)=>this.onEleLifeModeChange(val)}
								electionDeclination={this.resolveElectionDeclination()}
								electionDeclOutOfRange={this.state.electionDeclOutOfRange}
								onOpenPatternDialog={()=>this.openMoiraQuickDialog('patterns')}
							/>
						</div>
						<div className={`horosa-chart-stage horosa-chart-stage-redesign horosa-guolao-chart-panel xq-chart-renderer xq-chart-renderer-guolao${useMoiraLikeWheel ? ' horosa-guolao-chart-panel-moira' : ''}`}>
							{useKinastroQizheng ? this.renderQizhengKinBoard() : (
								<GuoLaoChartStage
									variant={(this.state.bundleLoading && !chartObj) ? 'skeleton' : usePickWheel ? 'pick' : useMoiraWheel ? 'moira' : 'classic'}
									rootValue={chartObj}
									value={chart}
									transitValue={this.shownMoiraTransitChartObj()}
									transitParams={stageTransitParams}
									transitLoading={this.state.moiraTransitLoading}
									moiraRules={this.state.moiraRules}
									display={this.state.guolaoDisplay}
									showMoiraTransitGods={this.state.showMoiraTransitGods}
									election={this.state.electionOptions}
									electionData={this.state.electionData}
									declination={stageDeclination}
									declinationOutOfRange={this.state.electionDeclOutOfRange}
									height={height}
									fields={this.props.fields}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
									onTipClick={this.onTipClick}
									onAgeClick={this.onLimitAgeClick}
								/>
							)}
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-guolao-info-panel">
							{useKinastroQizheng ? this.renderQizhengKinInfoPanel() : (
									<GuoLaoMoiraPanel
										value={this.state.moiraRules}
										loading={this.state.bundleLoading || this.state.moiraLoading}
										rootValue={moiraPanelChartObj}
										transitValue={moiraPanelTransitChartObj}
										transitParams={moiraPanelTransitParams}
										fields={this.props.fields}
										display={this.state.guolaoDisplay}
										chartMode={usePickWheel ? 'pick' : 'moira'}
										extraTabs={this.buildMoiraExtraTabs()}
									/>
							)}
						</div>
					</div>
					{this.renderQuickDock(useKinastroQizheng)}
				</div>
				{useKinastroQizheng ? null : this.renderMoiraQuickModal()}
			</div>
		);
	}
}

export default GuoLaoChartMain;
// 测试专用别名(选项差分网):模块内构参函数原样导出,零行为变化(与 models/astro.js 的 __fieldsToParamsForTest 同范式)。
export { fieldsToParams as __guolaoFieldsToParamsForTest, paramsWithMoiraTransit as __paramsWithMoiraTransitForTest };
