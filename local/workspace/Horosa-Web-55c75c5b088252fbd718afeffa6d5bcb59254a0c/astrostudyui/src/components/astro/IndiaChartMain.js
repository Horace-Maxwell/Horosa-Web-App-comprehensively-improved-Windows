import { zeriLockProps } from '../../divination/zeri/zeriPageCalibre';
import { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { sideSectionIcon } from '../../constants/sideSectionIcons';
import IndiaChart from './IndiaChart';
import { INDIA_TABLE_SETTINGS } from '../../utils/indiaExtraTables';
import IndiaSbcChart from './IndiaSbcChart';
import IndiaTripatakiChart from './IndiaTripatakiChart';
import IndiaExtraTables from './indiaMain/IndiaExtraTables';
import { safeLocalStorageGet } from '../../utils/safeStorage';
import DateTime from '../comp/DateTime';
import SpaceTimePanel from '../comp/SpaceTimePanel';
import * as AstroConst from '../../constants/AstroConst';
import { XQSegmented as Segmented, XQSelect as Select, XQTabs as Tabs, XQSideSection } from '../xq-ui';
// 组件外的模块级助手(纯函数 / 常量 / 表 / 小组件)与组件方法(optionChanges · dashaPanels · chartPanels · tajakaPanels · statePanels · prashnaPanels;类后 mixinMethods 挂回原型)按职责拆在 ./indiaMain/ 下;
// 构造、生命周期、render 与对外导出面仍在本文件。
import { DASHA_SEED_DEFAULT, INDIA_OPTION_FIELD_STATE_MAP, seedIndiaOptionState, VARGA_GRID_OPTIONS, VARGA_GRID_MAX, VARGA_GRID_DEFAULT, indiaSnapshotScope } from './indiaMain/optionState';
import { INDIA_DEGREE_DISPLAY_DEGREE, INDIA_DEGREE_DISPLAY_OPTIONS } from './indiaMain/dasha';
import { getJyotish, resolveJyotishChartObj, hasUsableJyotishChart, buildDashaFieldsKey } from './indiaMain/jyotishData';
import { mixinMethods } from '../../utils/mixinMethods';
import { optionChangeMethods } from './indiaMain/optionChanges';
import { dashaPanelMethods } from './indiaMain/dashaPanels';
import { chartPanelMethods } from './indiaMain/chartPanels';
import { tajakaPanelMethods } from './indiaMain/tajakaPanels';
import { statePanelMethods } from './indiaMain/statePanels';
import { prashnaPanelMethods } from './indiaMain/prashnaPanels';
import { canBuildIndiaChartParams, cloneIndiaFieldsForJyotish } from './indiaMain/jyotishData';
import { fieldsToParams, requestIndiaChartData } from './IndiaChart';
import { registerStepPrefetcher } from '../../utils/stepPrefetch';
import { stepPrefetchEnabled } from '../../utils/perfFlags';
// 对外导出面不变:搬进子模块的导出原样重导出
export { DASHA_SEED_OPTIONS, INDIA_OPTION_FIELD_STATE_MAP, seedIndiaOptionState } from './indiaMain/optionState';

const TabPane = Tabs.TabPane;
const {Option, OptGroup} = Select;

class IndiaChartMain extends Component{
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
		this.transitEventsMemo = {};   // 穿界表的选择与结果:切页签会卸载组件,记在这里才不丢
		// 显示口径(判定表 / 补充表三项 + 宿数 / 中栏盘面 / 盘面叠加):上次亲手选的,没存过 = 出厂值
		const indiaSaved = INDIA_TABLE_SETTINGS.load();
		this.state = {
			currentTab: "Natal",
			currentFractal: 1,
			dashaChartObj: null,
			dashaLoading: false,
			// 最近一次成功取数的盘(stale-while-revalidate):切换/重取期间面板回退显示它,
			// 避免清盘空白 + 满屏「载入中/计算中」大框;算好后被新盘替换。首次加载前为 null → 仍走 dashaLoading 提示。
			lastChartObj: null,
			// 后台重取中标志(非阻塞):配合 lastChartObj 在角落显轻量「更新中…」角标,不盖盘不挡操作。
			dashaUpdating: false,
			dashaFieldsKey: '',
			dashaChartKey: '',
			dashaPopoverItem: null,
			dashaPopoverStyle: null,
			// 当前展开的主运 key(inline 手风琴,代替原 popover)。null=全收起。
			dashaExpandedKey: null,
			dashaExpandedAntarKey: null,
			// WP-D 大运钻取路径:存各级选中项的索引([mahaIdx, antarIdx, …],最深 4 → 第5级息运)。
			// 存索引而非对象 → 每次 render 对当前 dasha 重解析,换盘/换体系不会留陈旧对象。
			dashaDrillPath: [],
			mainChartObj: null,
			mainChartKey: '',
			activeJyotishFields: null,
			activeJyotishKey: '',
			jyotishTab: '3',
			// Yoga 判定表与补充表的显示口径:上次亲手选的(没存过 = 改进 / 只看成立),写在两张表的下拉里
			// (同一份设置件里的宿数 / 中栏盘面 / 盘面叠加三项由下面各自的键按 indiaSaved 覆盖,值相同)
			...INDIA_TABLE_SETTINGS.load(),
			dashaSystem: 'vimshottari',
			dashaSeed: DASHA_SEED_DEFAULT,
			indiaSthiraStart: 'lagna',   // Sthira 起座:lagna(默认)/brahma(BPHS §10.5)
			indiaTransitDateValue: null,   // 行运过运日期(null=默认今日);走 indiaTransitDate→transitDate 透传
			prasnaNumber: 1,               // Praśna 卜卦问数 1-249(纯前端查 KP249 静态表,不透传)
			kpFullTableOpen: false,        // B2:KP 全 249 段表折叠区
			indiaOverlayBB: indiaSaved.indiaOverlayBB === true,   // B4:盘面叠加 Bhrigu Bindu(出厂关;上次亲手选的跨会话保留)
			kpFullTablePage: 0,            // B2:分页页码(25 行/页)
			// ── G5/G6/G13/G8/G7:新设置(全部缺省=零 churn / 零回归)──
			indiaDashaYearLength: AstroConst.INDIA_DASHA_YEAR_DEFAULT,     // 年长(仅非 365.25 下发)
			indiaVargaVariantMap: {},                                      // W1-A 分盘变体 {chartnum:variant},{}=全标准
			indiaKarakaScheme: AstroConst.INDIA_KARAKA_SCHEME_DEFAULT,     // W1-B 卡拉卡方案('8' 默认)
			indiaYuddhaCriterion: AstroConst.INDIA_YUDDHA_CRITERION_DEFAULT, // W1-C 星曜战判据
			indiaNakshatraCount: AstroConst.normalizeIndiaNakshatraCount(indiaSaved.indiaNakshatraCount), // 27/28 宿(纯显示,不下发;跨会话保留)
			indiaAnnualChartType: AstroConst.INDIA_ANNUAL_CHART_TYPE_DEFAULT, // 年盘口径(仅 tithi 下发)
			indiaStageMode: AstroConst.normalizeIndiaStageMode(indiaSaved.indiaStageMode), // 中栏盘面(纯前端渲染选择;跨会话保留)
			// 三旗 opt-in(开启才带 tripataki=1 重取):上次停在三旗盘 → 首次取数就带上,否则重开后三旗盘无数据
			indiaTripatakiOn: AstroConst.normalizeIndiaStageMode(indiaSaved.indiaStageMode) === 'tripataki',
			indiaTripatakiCenter: 'moon',   // 三旗中心(月/土,前端查表零请求)
			indiaTripatakiMonth: 1,
			indiaSbcFocus: 'moon',          // SBC 参照(月宿/升宿,前端查表零请求)
			indiaShowRiskFactors: false,    // G4 风险因子区块(伦理敏感,默认关)
			// ── 问事 Praśna(G1/G12):起卦=显式动作,时间一次性冻结为字符串 ──
			prashnaCast: null,              // {time,number,matter,schools,cuspMode,primaryHouse}|null
			prashnaNumberInput: 1,
			prashnaMatterInput: AstroConst.INDIA_PRASHNA_MATTER_DEFAULT,
			prashnaSchoolsInput: ['kp'],
			prashnaCuspModeInput: AstroConst.INDIA_PRASHNA_CUSP_MODE_DEFAULT,
			prashnaPrimaryHouseInput: null,
			// ── 校时器(G11):抽屉 + 试算/采用两级;设置走 safeStorage 持久化 ──
			rectifyDrawerOpen: false,
			rectifyRunning: false,
			rectifyResult: null,
			// 生时校正三偏好:每次跑校正都会存 horosa.india.rectify.prefs.v1,此处读回
			// (曾写了从不读 —— 三偏好重开永远回默认)。损坏/缺失回落默认三值。
			...((()=>{
				const defaults = { rectifyWindowMinutes: 30, rectifyStepSeconds: 60, rectifyRpSource: 'anchor' };
				try{
					const raw = safeLocalStorageGet('horosa.india.rectify.prefs.v1');
					const p0 = raw ? JSON.parse(raw) : null;
					if(!p0 || typeof p0 !== 'object'){ return defaults; }
					return {
						rectifyWindowMinutes: Number.isFinite(Number(p0.w)) && Number(p0.w) > 0 ? Number(p0.w) : defaults.rectifyWindowMinutes,
						rectifyStepSeconds: Number.isFinite(Number(p0.s)) && Number(p0.s) > 0 ? Number(p0.s) : defaults.rectifyStepSeconds,
						// 白名单=真实值域(anchor|candidate|custom,与 rectification.RP_SOURCES 同);
					// 🔴 曾误写 'now'(全链不存在)→ 用户选 candidate 存盘成功、重开被拒回落 anchor。
					rectifyRpSource: ['anchor', 'candidate', 'custom'].indexOf(p0.rp) >= 0 ? p0.rp : defaults.rectifyRpSource,
					};
				}catch(e){ return defaults; }
			})()),
			// WP-A 相映:点盘中某星 → 高亮其相映宫;再点取消/点他星切换。null=无。
			indiaAspectSource: null,
			indiaHsysValue: null,
			indiaAyanamsaValue: null,
			indiaNodeTypeValue: null,
			indiaSchool: AstroConst.INDIA_SCHOOL_DEFAULT,
			indiaDashaVariants: null,   // 大运流派开关(21 键;null=全默认)
			indiaAspectParadigm: AstroConst.INDIA_SCHOOL_DEFAULTS[AstroConst.INDIA_SCHOOL_DEFAULT].aspectParadigm,
			visibleTabKeys: AstroConst.INDIA_SCHOOL_DEFAULTS[AstroConst.INDIA_SCHOOL_DEFAULT].tabs,
			indiaTajakaYearValue: null,
			tajakaYearInput: '',
			degreeDisplayMode: INDIA_DEGREE_DISPLAY_DEGREE,
			// WP-C 星体显示:文字 / 符号(glyph)。WP-N §1.6 纯显示开关:逆时针(宫格方向)。
			indiaPlanetDisplayMode: AstroConst.INDIA_PLANET_DISPLAY_TEXT,
			indiaCounterClockwise: true,
			// WP-B 上升宫位(第1宫)参照:默认上升,可选七政/虚点/宫1-12 为第1宫。纯显示重参照(§1.6/§12.3)。
			indiaLagnaRef: AstroConst.INDIA_LAGNA_REF_DEFAULT,
			// 分盘集:多盘并列 2×2 网格。vargaSetOpen 开关;vargaSetFractals 选定分盘(最多 4)。
			vargaSetOpen: false,
			vargaSetFractals: VARGA_GRID_DEFAULT.slice(),
			hook: {
				Natal:{
					txt:'命盘',
					fractal: 1,
					fun: null
				},
				Hora:{
					txt:'财产',
					fractal: 2,
					fun: null
				},
				Drekkana:{
					txt:'兄妹',
					fractal: 3,
					fun: null
				},
				Chaturthamsa:{
					txt:'资质',
					fractal: 4,
					fun: null
				},
				Panchamsa:{
					txt:'世俗',
					fractal: 5,
					fun: null
				},
				Shashthamsa:{
					txt:'疾病',
					fractal: 6,
					fun: null
				},
				Saptamsa:{
					txt:'子嗣',
					fractal: 7,
					fun: null
				},
				Ashthamsa:{
					txt:'困难',
					fractal: 8,
					fun: null
				},
				Navamsa:{
					txt:'合作',
					fractal: 9,
					fun: null
				},
				Dasamsa:{
					txt:'事业',
					fractal: 10,
					fun: null
				},
				Rudramsa:{
					txt:'增长',
					fractal: 11,
					fun: null
				},
				Dwadasamsa:{
					txt:'父辈',
					fractal: 12,
					fun: null
				},
				Shodasamsa:{
					txt:'座驾',
					fractal: 16,
					fun: null
				},
				Vimsamsa:{
					txt:'灵魂',
					fractal: 20,
					fun: null
				},
				Chaturvimsamsa:{
					txt:'教育',
					fractal: 24,
					fun: null
				},
				Nakshatramsa:{
					txt:'生命',
					fractal: 27,
					fun: null
				},
				Trimsamsa:{
					txt:'厄运',
					fractal: 30,
					fun: null
				},
				Khavedamsa:{
					txt:'母系',
					fractal: 40,
					fun: null
				},
				Akshavedamsa:{
					txt:'父系',
					fractal: 45,
					fun: null
				},
				Shashtyamsa:{
					txt:'业力',
					fractal: 60,
					fun: null
				},
	
			},
		};

		this.changeTab = this.changeTab.bind(this);
		this.changeIndiaDashaVariant = this.changeIndiaDashaVariant.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.changeTime = this.changeTime.bind(this);
			this.changeGeo = this.changeGeo.bind(this);
			this.changeHsys = this.changeHsys.bind(this);
			this.changeIndiaAyanamsa = this.changeIndiaAyanamsa.bind(this);
			// 载盘/含设置的 fields → 构造期回种 state(否则 state 默认值盖掉记录里的设置)
			// 映射表各 state 键的出厂值(取自上面的 state 字面量本身,单源):载入记录 / 新命盘时 fields 里缺席的键要回到它
			this._indiaOptionStateDefaults = {};
			INDIA_OPTION_FIELD_STATE_MAP.forEach(({ state })=>{ const v = this.state[state]; this._indiaOptionStateDefaults[state] = Array.isArray(v) ? v.slice() : (v && typeof v === 'object' ? { ...v } : v); });
			Object.assign(this.state, seedIndiaOptionState(props.fields));
			if(this.state.indiaSchool && this.state.indiaSchool !== AstroConst.INDIA_SCHOOL_DEFAULT){
				const seededDef = AstroConst.getIndiaSchoolDefaults(this.state.indiaSchool) || {};
				if(Array.isArray(seededDef.tabs) && seededDef.tabs.length){
					this.state.visibleTabKeys = seededDef.tabs;
					this.state.jyotishTab = (seededDef.primaryTab && seededDef.tabs.indexOf(seededDef.primaryTab) >= 0)
						? seededDef.primaryTab : seededDef.tabs[0];
				}
				if(seededDef.aspectParadigm){ this.state.indiaAspectParadigm = seededDef.aspectParadigm; }
			}
			this.persistIndiaOption = this.persistIndiaOption.bind(this);
			this.changeVargaVariant = this.changeVargaVariant.bind(this);
			this.changeKarakaScheme = this.changeKarakaScheme.bind(this);
			this.changeYuddhaCriterion = this.changeYuddhaCriterion.bind(this);
			this.changeDashaYearLength = this.changeDashaYearLength.bind(this);
			this.changeNakshatraCount = this.changeNakshatraCount.bind(this);
			this.changeAnnualChartType = this.changeAnnualChartType.bind(this);
			this.changeStageMode = this.changeStageMode.bind(this);
			this.castPrashna = this.castPrashna.bind(this);
			this.clearPrashna = this.clearPrashna.bind(this);
			this.updatePrashnaParam = this.updatePrashnaParam.bind(this);
			this.changeIndiaSchool = this.changeIndiaSchool.bind(this);
			this.changeIndiaNodeType = this.changeIndiaNodeType.bind(this);
		this.changeIndiaTajakaYear = this.changeIndiaTajakaYear.bind(this);
			this.toggleVargaSet = this.toggleVargaSet.bind(this);
			this.changeVargaSetFractals = this.changeVargaSetFractals.bind(this);
			this.changeDegreeDisplayMode = this.changeDegreeDisplayMode.bind(this);
			this.changeIndiaChartStyle = this.changeIndiaChartStyle.bind(this);
		this.requestDashaChart = this.requestDashaChart.bind(this);
		this.showDashaSubPopover = this.showDashaSubPopover.bind(this);
		this.changeDashaSystem = this.changeDashaSystem.bind(this);
		this.changeDashaSeed = this.changeDashaSeed.bind(this);
		this.changeTransitDate = this.changeTransitDate.bind(this);
		this.toggleIndiaAspect = this.toggleIndiaAspect.bind(this);
		this.changeIndiaPlanetDisplayMode = this.changeIndiaPlanetDisplayMode.bind(this);
		this.changeIndiaCounterClockwise = this.changeIndiaCounterClockwise.bind(this);
		this.changeIndiaLagnaRef = this.changeIndiaLagnaRef.bind(this);
		this.toggleDashaExpanded = this.toggleDashaExpanded.bind(this);
		this.toggleDashaAntarExpanded = this.toggleDashaAntarExpanded.bind(this);
		this.drillDasha = this.drillDasha.bind(this);
		this.dashaBreadcrumbTo = this.dashaBreadcrumbTo.bind(this);
		this.hideDashaSubPopover = this.hideDashaSubPopover.bind(this);
		this.changeJyotishTab = this.changeJyotishTab.bind(this);
		this.handleMainChartLoad = this.handleMainChartLoad.bind(this);
			this.lastDashaRequestKey = '';
			this.lastObservedFieldsKey = '';
			this.mainIndiaChartRef = null;
			// horosa_india_fields_memo_v1 / horosa_india_settings_memo_v1 的实例级缓存槽
			// (见 withIndiaOptionFields / resolveDateTime / resolveSplitItems 上的注释)。
			this._optionFieldsMemo = null;
			this._optionFieldsMemoSrc = null;
			this._optionFieldsMemoKey = null;
			this._datetmMemo = null;
			this._datetmMemoKey = null;
			this._splitItemsMemo = null;
			this._splitOptionsMemo = null;

		this.tmHook = {
			getValue: null,
		};

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				let hook = this.state.hook;
				if(hook[this.state.currentTab].fun){
					let fld = {
						...fields,
						chartnum: {
							value: this.state.currentFractal
						}
					}
					hook[this.state.currentTab].fun(fld)
				}
				this.requestDashaChart(this.withIndiaOptionFields(fields));
			};
			// 择日宿主点结果行时回写扫描口径(岁差制 / 交点按工作台、分宫制按锁定值):左栏亲手改过的覆盖掉,只改本盘、不落盘
			this.props.hook.applyZeriCalibre = (partial)=>new Promise((resolve)=>{
				const p = partial && typeof partial === 'object' ? partial : {};
				const patch = {};
				if(p.indiaAyanamsa !== undefined){ patch.indiaAyanamsaValue = AstroConst.normalizeIndiaAyanamsa(p.indiaAyanamsa); }
				if(p.indiaNodeType !== undefined){ patch.indiaNodeTypeValue = AstroConst.normalizeIndiaNodeType(p.indiaNodeType); }
				if(p.indiaHsys !== undefined){ patch.indiaHsysValue = AstroConst.normalizeIndiaHouseSystem(p.indiaHsys); }
				if(this._mounted === false || !Object.keys(patch).length){ resolve(); return; }
				this.setState(patch, resolve);
			});
			// 所见那张盘实际起盘所用的 fields(择日宿主存案取它):分盘组网格打开时取当前分盘格,否则取默认视图的主盘
			// (默认视图那份印度盘不自取、数据来自主盘请求 requestDashaChart);分盘号是本页附加的,不算时间地点
			this.props.hook.getPlottedFields = ()=>{
				let f = null;
				if(this.state.vargaSetOpen){
					const h = this.state.hook && this.state.hook[this.state.currentTab];
					f = h && typeof h.getPlottedFields === 'function' ? h.getPlottedFields() : null;
				}else{
					f = this._plottedMainFields || null;
				}
				if(!f || typeof f !== 'object'){ return null; }
				const rest = { ...f };
				delete rest.chartnum;
				return rest;
			};
			// PERF-R9 Ship 7:/india/chart 与主 /chart 互不依赖(印占盘只吃 fields + 本页选项)——
			// 在 /chart 返回【之前】并行发出:latency 从「网络 + 技法」变「max(网络, 技法)」。
			// silent(requestIndiaChartData 内置)、丢结果、绝不 setState。
			// 闸:horosa.perf.prewarmRequests(模型层判定,关=此函数不被调用,逐字节旧序)。
			this.props.hook.prewarmRequests = (flds)=>{
				try{
					const params = this.buildIndiaPrefetchParams(flds || this.props.fields);
					if(params){
						requestIndiaChartData(params).catch(()=>{ /* 预热静默 */ });
					}
				}catch(e){ /* 预热失败无害 */ }
			};
			// horosa_prefetch_registry_v1(PERF-R9 Ship 7):/india/chart 是确定性纯计算
			// (同 生辰+分盘/大运体系 恒同盘)→ 登记步进预取。
			// 🔴 登记必须在组件内:分盘号/大运体系/ayanamsa 全在 this.state,模块级构不出同键 body。
			if(stepPrefetchEnabled()){
				registerStepPrefetcher('indiachart', (steppedFields)=>{
					const params = this.buildIndiaPrefetchParams(steppedFields);
					if(!params){
						return [];
					}
					return [{
						name: 'india:chart',
						path: '/india/chart',
						run: ()=> requestIndiaChartData(params),
					}];
				});
			}
		}

	}

	// PERF-R9 Ship 7:预热/预取的构参权威入口 —— 与 requestDashaChart 首点【同一路径】
	// (withIndiaOptionFields → cloneIndiaFieldsForJyotish → fieldsToParams + chartnum)。
	// 差一个字节 indiaChartCache 的键就不同 = 白预取。构不出参时返 null(静默跳过)。
	buildIndiaPrefetchParams(fields){
		try{
			const src = this.withIndiaOptionFields(fields || this.props.fields);
			if(!canBuildIndiaChartParams(src)){
				return null;
			}
			const jyotishFields = cloneIndiaFieldsForJyotish(src);
			const params = fieldsToParams(jyotishFields);
			params.chartnum = (jyotishFields.indiaActiveFractal && jyotishFields.indiaActiveFractal.value) || 1;
			return params;
		}catch(e){
			return null;
		}
	}

	// 原 toggleTripataki 无任何 JSX 调用(死方法)已删:三旗盘唯一入口=左栏「中栏盘面」选三旗(changeStageMode)。

	componentDidMount(){
		this._mounted = true;
		let hook = this.state.hook;
		if(hook[this.state.currentTab].fun){
			hook[this.state.currentTab].fun()
		}
		const fields = this.withIndiaOptionFields(this.props.fields);
		this.lastObservedFieldsKey = buildDashaFieldsKey(fields);
		this.requestDashaChart(fields);
	}

	componentWillUnmount(){
		this._mounted = false;
	}

	componentDidUpdate(prevProps, prevState){
		// 载盘含设置 → 先采纳进 state;setState 会再触发一轮 didUpdate,届时 state 已同步、按新键重取
		if(this.adoptIndiaOptionFields(prevProps)){
			return;
		}
		const fields = this.withIndiaOptionFields(this.props.fields);
		const currentFieldsKey = buildDashaFieldsKey(fields);
		if(currentFieldsKey && currentFieldsKey !== this.lastObservedFieldsKey){
			this.lastObservedFieldsKey = currentFieldsKey;
			this.requestDashaChart(fields);
			return;
		}
		if(currentFieldsKey && currentFieldsKey !== this.lastDashaRequestKey && !hasUsableJyotishChart(this.state, currentFieldsKey) && !this.state.dashaLoading){
			this.requestDashaChart(fields);
		}
	}

	render(){
		let fields = this.withIndiaOptionFields(this.props.fields);
		const indiaHsys = fields.indiaHsys
			? AstroConst.normalizeIndiaHouseSystem(fields.indiaHsys.value)
			: AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT;
		const indiaAyanamsa = fields.indiaAyanamsa
			? AstroConst.normalizeIndiaAyanamsa(fields.indiaAyanamsa.value)
			: AstroConst.INDIA_AYANAMSA_DEFAULT;
		const indiaNodeType = fields.indiaNodeType
			? AstroConst.normalizeIndiaNodeType(fields.indiaNodeType.value)
			: AstroConst.INDIA_NODE_TYPE_DEFAULT;
		let jyotishFields = this.state.activeJyotishFields || fields;
		let chartHeight = '100%';
		// horosa_india_settings_memo_v1:原地 new DateTime() 改走实例 memo(逻辑逐字同源,
		// 见 resolveDateTime),使左栏设置面板的 value prop 引用稳定。
		const datetm = this.resolveDateTime(fields);
			const currentHook = this.state.hook[this.state.currentTab] || this.state.hook.Natal;
			const indiaChartStyle = AstroConst.normalizeIndiaChartStyle(this.props.indiaChartStyle);
			const degreeDisplayMode = this.state.degreeDisplayMode || INDIA_DEGREE_DISPLAY_DEGREE;
			const indiaPlanetDisplayMode = AstroConst.normalizeIndiaPlanetDisplay(this.state.indiaPlanetDisplayMode);
			const indiaCounterClockwise = this.state.indiaCounterClockwise !== false;
			const indiaLagnaRef = AstroConst.normalizeIndiaLagnaRef(this.state.indiaLagnaRef);
			// horosa_india_settings_memo_v1:splitItems/splitOptions 原每帧重建两个数组
			// (内容恒定,只是引用每次都变 → 「当前分盘」Select 的 options 白重建、memo 恒失配)。
			// 改走 resolveSplitItems 一次性 memo,内容逐字同源。
			const splitItems = this.resolveSplitItems();
			const splitOptions = this._splitOptionsMemo;

			return (
			<div className="horosa-india-chart-main horosa-astro-redesign horosa-india-redesign">
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-india-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-india-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-india-input-panel">
							{/* [择日宿主] 左栏插槽(主印度页不传=零渲染) */}
							{typeof this.props.renderLeftExtra === 'function' ? this.props.renderLeftExtra() : null}
							<div className="horosa-india-input-stack">
								<div className="horosa-side-panel-heading">
									<div>
										<div className="horosa-side-panel-title">印占设置</div>
										<div className="horosa-side-panel-subtitle">时间、地点与分盘选项</div>
									</div>
								</div>
								<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
								<SpaceTimePanel
									fields={fields}
									value={datetm}
									onTimeChange={this.changeTime}
									timeHook={this.tmHook}
									onGeoChange={this.changeGeo}
								/>
								</XQSideSection>
								<XQSideSection iconName={sideSectionIcon('switches')} title="选项" storageKey="india.s1" className="horosa-side-input-section">
										<div className="horosa-india-select-grid">
											<div className="horosa-india-select-field horosa-india-school-field">
												<span>流派</span>{/* C3:定位句进 Option(title+行内小注) */}
												<Select
													size="small"
													style={{width: '100%'}}
													value={this.state.indiaSchool}
													onChange={this.changeIndiaSchool}
													dropdownMatchSelectWidth={false}
												>
													{AstroConst.INDIA_SCHOOL_OPTIONS.map((item)=>{
														const d = AstroConst.getIndiaSchoolDefaults(item.value) || {};
														return (
															<Option value={item.value} key={item.value} title={d.positioning || ''}>
																{item.label}{d.positioning ? <span style={{ color: 'var(--horosa-text-secondary)', fontSize: '0.85em' }}> · {d.positioning}</span> : null}
															</Option>
														);
													})}
												</Select>
											</div>
											<div className="horosa-india-select-field">
												<span>岁差制</span>
												<Select
													size="small"
													style={{width: '100%'}}
													value={indiaAyanamsa}
													onChange={this.changeIndiaAyanamsa}
													dropdownMatchSelectWidth={false}
												>
													{AstroConst.groupOptions(AstroConst.INDIA_AYANAMSA_OPTIONS).map((grp)=>(
														<OptGroup label={grp.group} key={grp.group}>
															{grp.items.map((item)=>(
																<Option value={item.value} key={item.value}>{item.label}</Option>
															))}
														</OptGroup>
													))}
												</Select>
											</div>
											<div className="horosa-india-select-field">
												<span>分宫制</span>
												<Select
													size="small"
													style={{width: '100%'}}
													value={indiaHsys}
													onChange={this.changeHsys}
													dropdownMatchSelectWidth={false}
													disabled={!!zeriLockProps(this.props.zeriLocked, 'indiaHsys', indiaHsys, this.props.zeriRestoredLocks).disabled}
													title={zeriLockProps(this.props.zeriLocked, 'indiaHsys', indiaHsys, this.props.zeriRestoredLocks).title}
												>
													{AstroConst.groupOptions(AstroConst.INDIA_HOUSE_SYSTEM_OPTIONS).map((grp)=>(
														<OptGroup label={grp.group} key={grp.group}>
															{grp.items.map((item)=>(
																<Option value={item.value} key={item.value}>{item.label}</Option>
															))}
														</OptGroup>
													))}
												</Select>
											</div>
											<div className="horosa-india-select-field">
												<span>交点</span>
												<Select
													size="small"
													style={{width: '100%'}}
													value={indiaNodeType}
													onChange={this.changeIndiaNodeType}
													dropdownMatchSelectWidth={false}
												>
													{AstroConst.INDIA_NODE_TYPE_OPTIONS.map((item)=>(
														<Option value={item.value} key={item.value}>{item.label}</Option>
													))}
												</Select>
											</div>
												<div className="horosa-india-select-field">
													<span>当前分盘</span>
													<Select
													size="small"
													style={{width: '100%'}}
													value={this.state.currentTab}
													onChange={this.changeTab}
													dropdownMatchSelectWidth={false}
												>
													{splitOptions.map((item)=>(
														<Option value={item.value} key={item.value}>{item.label}</Option>
													))}
													</Select>
												</div>
												<div className="horosa-india-select-field">
													<span>完整度数</span>
													<Select
														size="small"
														style={{width: '100%'}}
														value={degreeDisplayMode}
														onChange={this.changeDegreeDisplayMode} dropdownMatchSelectWidth={false}
													>
														{INDIA_DEGREE_DISPLAY_OPTIONS.map((item)=>(
															<Option value={item.value} key={item.value}>{item.label}</Option>
														))}
													</Select>
												</div>
											</div>
									<div className="horosa-india-vargaset-block">
										<div className="horosa-india-vargaset-head">
											<span className="horosa-side-section-title">分盘集</span>
											<button
												type="button"
												className={`horosa-india-vargaset-toggle${this.state.vargaSetOpen ? ' is-active' : ''}`}
												onClick={this.toggleVargaSet}
											>{this.state.vargaSetOpen ? '并列 2×2' : '单盘'}</button>
										</div>
										{this.state.vargaSetOpen ? (
											<Select
												mode="multiple"
												size="small"
												style={{width: '100%'}}
												value={this.state.vargaSetFractals}
												onChange={this.changeVargaSetFractals}
												maxTagCount="responsive"
												placeholder="选择分盘（最多 4）"
												dropdownMatchSelectWidth={false}
											>
												{VARGA_GRID_OPTIONS.map((item)=>(
													<Option
														value={item.value}
														key={item.value}
														disabled={this.state.vargaSetFractals.length >= VARGA_GRID_MAX && this.state.vargaSetFractals.indexOf(item.value) < 0}
													>{item.label}</Option>
												))}
											</Select>
										) : null}
									</div>
									<div className="horosa-india-style-block">
										<div className="horosa-side-section-title">中栏盘面</div>
										<Select
											size="small"
											style={{ width: '100%' }}
											value={this.state.indiaStageMode}
											onChange={this.changeStageMode}
											dropdownMatchSelectWidth={false}
										>
											{AstroConst.INDIA_STAGE_MODE_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
										</Select>
									</div>
									{this.state.indiaStageMode === 'single' ? (
									<div className="horosa-india-style-block">
										<div className="horosa-side-section-title">盘式</div>
										<Segmented
											value={indiaChartStyle}
											onChange={this.changeIndiaChartStyle}
											options={AstroConst.INDIA_CHART_STYLE_OPTIONS}
										/>
									</div>
									) : null}
									<div className="horosa-india-style-block">
										<div className="horosa-side-section-title">第1宫参照</div>
										<Select
											size="small"
											style={{ width: '100%' }}
											value={indiaLagnaRef}
											onChange={this.changeIndiaLagnaRef}
											dropdownMatchSelectWidth={false}
										>
											{AstroConst.INDIA_LAGNA_REF_OPTIONS.map((grp)=>(
												<OptGroup key={grp.label} label={grp.label}>
													{grp.options.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
												</OptGroup>
											))}
										</Select>
									</div>
									<div className="horosa-india-select-grid">
										<div className="horosa-india-select-field">
											<span>星体</span>
											<Select
												size="small"
												style={{ width: '100%' }}
												value={indiaPlanetDisplayMode}
												onChange={this.changeIndiaPlanetDisplayMode}
												dropdownMatchSelectWidth={false}
											>
												{AstroConst.INDIA_PLANET_DISPLAY_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
											</Select>
										</div>
										<div className="horosa-india-select-field">
											<span>盘面叠加</span>
											<Select
												size="small"
												style={{ width: '100%' }}
												value={this.state.indiaOverlayBB ? 'bb' : 'none'}
												onChange={(v)=>{ const on = (v && v.target ? v.target.value : v) === 'bb'; INDIA_TABLE_SETTINGS.save({ indiaOverlayBB: on }); this.setState({ indiaOverlayBB: on }); }}
												dropdownMatchSelectWidth={false}
											>
												<Option value="none">无（默认）</Option>
												<Option value="bb">Bhrigu Bindu 福德点</Option>
											</Select>
										</div>
										{indiaChartStyle !== AstroConst.INDIA_CHART_STYLE_SOUTH && this.state.indiaStageMode === 'single' ? (
											<div className="horosa-india-select-field">
												<span>显示方向</span>
												<Select
													size="small"
													style={{ width: '100%' }}
													value={indiaCounterClockwise ? 'ccw' : 'cw'}
													onChange={(v)=>this.changeIndiaCounterClockwise((v && v.target ? v.target.value : v) === 'ccw')}
													dropdownMatchSelectWidth={false}
												>
													<Option value="ccw">逆时针</Option>
													<Option value="cw">顺时针</Option>
												</Select>
											</div>
										) : null}
									</div>
								</XQSideSection>
								<XQSideSection iconName={sideSectionIcon('switches')} title="流派与算法" storageKey="india.dashaVariants" defaultOpen={false} className="horosa-side-input-section">
									{(()=>{
										const curVariants = AstroConst.normalizeIndiaDashaVariants(this.state.indiaDashaVariants);
										const nCustom = Object.keys(curVariants).length;
										// 流派预设按 tabs 过滤右栏,而本节 29 项开关此前无条件渲染:KP 派下「宿数口径」
										// 「Hadda 界法」「Patyāyinī」拨了页面无任何可见面。开关 → 其可见面所在页签;该页签被本派隐藏
										// 即置灰 + title 说明(照本站「条件依赖即置灰」先例;不改产物,切回含该页签的流派即恢复)。
										const _vis = this.state.visibleTabKeys || [];
										const _TAB_NAME = { 1: '分盘', 2: '五支', 3: '大运', 4: '星曜', 9: '映象', 10: '行运', 11: '年度' };
										const _TAB_OF_SPEC = { vedhaBlockers: ['10'], deeptadiKhala: ['4'], haddaScheme: ['11'], patyayiniYearConstant: ['11'], patyayiniLagnaPoint: ['11'], annualNakYearBasis: ['11'] };
										const hiddenNote = (tabKeys)=>{
											if(!tabKeys || !tabKeys.length || tabKeys.some((k)=>_vis.indexOf(k) >= 0)){ return ''; }
											return `本派未显示「${tabKeys.map((k)=>_TAB_NAME[k] || k).join(' / ')}」页,本项无可见面,故置灰;切到含该页签的流派即恢复`;
										};
										const _deadNak = hiddenNote(['2']);
										const _deadKaraka = hiddenNote(['9']);
										const _deadYuddha = hiddenNote(['4']);
										const _deadVarga = hiddenNote(['1']);
										return (
											<div className="horosa-india-variant-panel">
												<div className="horosa-india-variant-group">
													<div className="horosa-india-select-field horosa-india-variant-field" title={_deadNak || undefined}>
														<span>宿数口径</span>
														<Select
															size="small"
															style={{width: '100%'}}
															value={this.state.indiaNakshatraCount}
															onChange={this.changeNakshatraCount}
															disabled={!!_deadNak}
															dropdownMatchSelectWidth={false}
														>
															{AstroConst.INDIA_NAKSHATRA_COUNT_OPTIONS.map((o)=>(
																<Option key={o.value} value={o.value}>{o.label}</Option>
															))}
														</Select>
													</div>
													{AstroConst.INDIA_DASHA_VARIANT_GROUPS.map((grp)=>
														AstroConst.INDIA_DASHA_VARIANT_SPECS
															.filter((it)=>it.group === grp.key)
															.map((spec)=>{ const _dead = hiddenNote(_TAB_OF_SPEC[spec.key]); return (
																<div key={spec.key} className="horosa-india-select-field horosa-india-variant-field" title={_dead || spec.tip}>
																	<span>{spec.label}{curVariants[spec.key] ? <em className="horosa-india-variant-dot">·改</em> : null}</span>
																	<Select
																		size="small"
																		style={{width: '100%'}}
																		value={curVariants[spec.key] || spec.default}
																		onChange={(v)=>this.changeIndiaDashaVariant(spec.key, v)}
																		disabled={!!_dead}
																		dropdownMatchSelectWidth={false}
																	>
																		{spec.options.map((o)=>(
																			<Option key={o.value} value={o.value}>{o.label}</Option>
																		))}
																	</Select>
																</div>
															); }))}
													{AstroConst.INDIA_VARGA_VARIANT_CHARTS.map((c)=>(
														<div className="horosa-india-select-field horosa-india-variant-field" key={c.key} title={_deadVarga || undefined}>
															<span>{c.label.split(' ')[0]} {c.label.split(' ')[1]}</span>
															<Select
																size="small"
																style={{ width: '100%' }}
																value={(this.state.indiaVargaVariantMap || {})[String(c.chartnum)] || 'standard'}
																onChange={(v)=>this.changeVargaVariant(c.chartnum, v)}
																disabled={!!_deadVarga}
																dropdownMatchSelectWidth={false}
															>
																{c.options.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
															</Select>
														</div>
													))}
													<div className="horosa-india-select-field horosa-india-variant-field" title={_deadKaraka || undefined}>
														<span>Chara Kāraka</span>
														<Select
															size="small"
															style={{ width: '100%' }}
															value={this.state.indiaKarakaScheme}
															onChange={this.changeKarakaScheme}
															disabled={!!_deadKaraka}
															dropdownMatchSelectWidth={false}
														>
															{AstroConst.INDIA_KARAKA_SCHEME_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
														</Select>
													</div>
													<div className="horosa-india-select-field horosa-india-variant-field" title={_deadYuddha || undefined}>
														<span>星曜战判据</span>
														<Select
															size="small"
															style={{ width: '100%' }}
															value={this.state.indiaYuddhaCriterion}
															onChange={this.changeYuddhaCriterion}
															disabled={!!_deadYuddha}
															dropdownMatchSelectWidth={false}
														>
															{AstroConst.INDIA_YUDDHA_CRITERION_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
														</Select>
													</div>
												</div>
											</div>
										);
									})()}
								</XQSideSection>
							</div>
						</div>
						<div className={`horosa-chart-stage horosa-chart-stage-redesign horosa-india-chart-panel${this.state.vargaSetOpen ? ' horosa-india-varga-grid-stage' : ''}`} style={{ position: 'relative' }}>
							{/* keep-stale 轻量角标:后台重取中且有旧盘可显时,角落提示「更新中…」(非阻塞、不盖盘、不挡操作);
							    替代原满屏「等待排盘数据/载入中/大运计算中」大框。首次加载(无 lastChartObj)走盘自身占位/dashaLoading。 */}
							{this.state.dashaUpdating && this.shownLastChartObj() ? (
								<div style={{ position: 'absolute', top: 10, right: 14, zIndex: 6, fontSize: 11.5, lineHeight: '18px', color: 'var(--horosa-text-secondary, rgba(180,184,196,0.92))', background: 'var(--horosa-panel-soft, rgba(20,22,28,0.72))', border: '1px solid var(--horosa-border, rgba(255,255,255,0.12))', padding: '2px 10px', borderRadius: 11, pointerEvents: 'none', WebkitBackdropFilter: 'blur(2px)', backdropFilter: 'blur(2px)' }}>更新中…</div>
							) : null}
							{this.state.indiaStageMode === 'sbc' && !this.state.vargaSetOpen ? (
								<IndiaSbcChart
									value={((this.state.mainChartObj || this.shownLastChartObj() || {}).jyotish || {}).sarvatobhadra}
									focusRef={this.state.indiaSbcFocus}
									height={chartHeight}
								/>
							) : this.state.indiaStageMode === 'tripataki' && !this.state.vargaSetOpen ? (
								<IndiaTripatakiChart
									value={((this.state.mainChartObj || this.shownLastChartObj() || {}).jyotish || {}).tripataki}
									center={this.state.indiaTripatakiCenter}
									monthIndex={this.state.indiaTripatakiMonth}
									onMonthChange={(m)=>this.setState({ indiaTripatakiMonth: m })}
									onCenterChange={(v)=>this.setState({ indiaTripatakiCenter: v })}
									height={chartHeight}
								/>
							) : this.state.vargaSetOpen
								? this.renderVargaGrid(fields, { indiaChartStyle, indiaAyanamsa, indiaHsys, indiaNodeType, degreeDisplayMode, indiaPlanetDisplayMode, indiaCounterClockwise, indiaLagnaRef })
								: (
								<IndiaChart
									key={`${this.state.currentTab}_${indiaChartStyle}_${indiaAyanamsa}_${indiaHsys}_${indiaNodeType}`}
									chartOnly
									snapshotScope={indiaSnapshotScope(this.props.techniqueScope)}   /* 择日内嵌:快照只写宿主槽 */
									composeAiSnapshot={this.props.composeAiSnapshot}
									suppressFetch={!this.state.vargaSetOpen}
									chartObj={this.state.mainChartObj || this.shownLastChartObj()}
									aspectSourceId={this.state.indiaAspectSource}
									aspectParadigm={this.state.indiaAspectParadigm}
									onPlanetClick={this.toggleIndiaAspect}
									ref={(node)=>{ this.mainIndiaChartRef = node; }}
									chartnum={currentHook.fractal}
							onChange={this.onFieldsChange}
								fields={fields}
								height={chartHeight}
									chartDisplay={this.props.chartDisplay}
										indiaChartStyle={indiaChartStyle}
										indiaAyanamsa={indiaAyanamsa}
										indiaHsys={indiaHsys}
										indiaNodeType={indiaNodeType}
										degreeDisplayMode={degreeDisplayMode}
										planetGlyphMode={indiaPlanetDisplayMode}
										counterClockwise={indiaCounterClockwise}
										lagnaRef={indiaLagnaRef}
										overlayPoints={this.buildOverlayPoints()}
										planetDisplay={this.props.planetDisplay || AstroConst.DEFAULT_OBJECTS}	/* 缺 props 兜默认集:曾回退「不过滤=全画」,择日内嵌宿主盘面被 33 个西占 Pars 淹没(用户实报) */
								lotsDisplay={this.props.lotsDisplay || []}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={currentHook}
								dispatch={this.props.dispatch}
								onChartLoad={this.handleMainChartLoad}
							/>
								)}
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-india-info-panel">
							<Tabs activeKey={this.state.jyotishTab} onChange={this.changeJyotishTab} tabPosition="top" className="horosa-content-tabs horosa-india-tabs">
								{[
									{ key: '1', tab: '分盘', content: ()=>(
										<div className="horosa-india-split-page">
										<div className="horosa-india-split-list">
											<button
												type="button"
												className={`horosa-india-split-button${this.state.currentTab === 'Natal' ? ' is-active' : ''}`}
												onClick={()=>this.changeTab('Natal')}
											>
												<strong>D1</strong>
												<span>命盘</span>
											</button>
											{splitItems.map((item)=>(
												<button
													type="button"
													key={item.key}
													className={`horosa-india-split-button${this.state.currentTab === item.key ? ' is-active' : ''}`}
													onClick={()=>this.changeTab(item.key)}
												>
													<strong>D{item.fractal}</strong>
													<span>{item.txt || `${item.fractal}分盘`}</span>
												</button>
											))}
										</div>
										{this.renderVargaAnalysisCards(jyotishFields)}
									</div>
									) },
									{ key: '2', tab: '五支', content: ()=>this.renderPanchangaPanel(jyotishFields) },
									{ key: '3', tab: '大运', content: ()=>this.renderDashaPanel(jyotishFields) },
									{ key: '4', tab: '星曜', content: ()=>this.renderPlanetStatePanel(jyotishFields) },
									{ key: '5', tab: '八分', content: ()=>this.renderAshtakavargaPanel(jyotishFields) },
									{ key: '6', tab: 'KP/择时', content: ()=>this.renderKpMuhurtaPanel(jyotishFields) },
									{ key: '7', tab: 'Yoga', content: ()=>this.renderYogaPanel(jyotishFields) },
									{ key: '8', tab: '副星', content: ()=>this.renderUpagrahaPanel(jyotishFields) },
									{ key: '9', tab: '映象', content: ()=>this.renderJaiminiPanel(jyotishFields) },
									{ key: '10', tab: '行运', content: ()=>this.renderGocharaPanel(jyotishFields) },
									{ key: '11', tab: '年度', content: ()=>this.renderTajakaPanel(jyotishFields) },
									{ key: '12', tab: '化解', content: ()=>this.renderRemediesPanel(jyotishFields) },
									{ key: '13', tab: '敌友', content: ()=>this.renderMaitriPanel(jyotishFields) },
									{ key: '14', tab: '问事', content: ()=>this.renderPrashnaPanel(jyotishFields) },
									{ key: '15', tab: '校时', content: ()=>this.renderRectifyPanel(jyotishFields) },
									{ key: '16', tab: '纳迪', content: ()=>this.renderNadiPanel(jyotishFields) },
									{ key: '17', tab: '补充表', content: ()=>{
										const jyotish = getJyotish(resolveJyotishChartObj(this.state, jyotishFields));
										return <IndiaExtraTables data={jyotish ? jyotish.extraTables : null} failed={!!jyotish && !jyotish.extraTables} variant={this.state.dirahVariant} onChange={(patch)=>this.setState(patch)} />;
									} },
								].filter((t)=>this.state.visibleTabKeys.indexOf(t.key) >= 0).map((t)=>(
									// 惰性 content:仅当前活动 tab 构建面板(其余 antd 本就不挂载,此处连「建好再丢」也省去)。
									// 各面板是 this.state+图数据的纯派生(无 pane 内部 state),激活时重建结果逐字一致、不丢状态。
									// 唯一带内部 state 的穿界表把选择和结果记在宿主的 transitEventsMemo,切回来照原样恢复。
									<TabPane tab={t.tab} key={t.key}>{t.key === this.state.jyotishTab ? t.content() : null}</TabPane>
								))}
							</Tabs>
						</div>
					</div>
					{this.renderQuickDock()}
				</div>
			</div>
		);
	}
}
mixinMethods(IndiaChartMain, optionChangeMethods, dashaPanelMethods, chartPanelMethods, tajakaPanelMethods, statePanelMethods, prashnaPanelMethods);   // 方法按职责拆在 ./indiaMain/ 下(见各文件头),挂回原型

export default IndiaChartMain;
