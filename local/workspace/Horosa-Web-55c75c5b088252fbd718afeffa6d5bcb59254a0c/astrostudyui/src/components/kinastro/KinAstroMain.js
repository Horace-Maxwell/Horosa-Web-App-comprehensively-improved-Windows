// 策天页(术数合盘):类定义在这里;模块级助手与类方法按职责拆在 ./main/ 下,
// 方法拆片 compute · inputPanel · schoolCenters · subTechniques · rightPanel,类后 mixinMethods 挂回原型。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React, { Component } from 'react';   // React/Suspense:神数正传组件级 lazy 所需
// 🔴 流派名表须自【独立常量文件】引 —— 直引那个 lazy 组件会成循环依赖:
//    宿主 → ZhengChuanMain → …，其时该导出解析为 undefined，整页当场崩
//    「Element type is invalid … got: undefined」(实测栽过);且会把其引擎拖回本 chunk。
import { XQSpin } from '../xq-ui';
import { ResultKey } from '../../utils/constants';
import { buildKentangEndpoint } from '../../integrations/kentang/serviceRoot';
import { cachedKentangFetch } from '../../utils/kentangCache';
import { computeKinFieldsResync } from '../../utils/kinAstroFieldsSync';
import UpdatingBadge from '../common/UpdatingBadge';
import { silentTechniquePanelsEnabled } from '../../utils/perfFlags';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';

import { clearPendingTimeOnFieldsChange } from '../../utils/pendingTimeDraft';
import { TECHNIQUE_CONFIG } from './main/config';
import { setRuntimeKinAstroTechnique } from './main/snapshot';
import { KINASTRO_PAGE_SETTINGS } from './main/settings';
import { mixinMethods } from '../../utils/mixinMethods';
import { computeMethods } from './main/compute';
import { inputPanelMethods } from './main/inputPanel';
import { schoolCenterMethods } from './main/schoolCenters';
import { subTechniqueMethods } from './main/subTechniques';
import { rightPanelMethods } from './main/rightPanel';
import { postKinAstro } from './main/snapshot';
import { registerStepPrefetcher, unregisterStepPrefetcher } from '../../utils/stepPrefetch';
export { NANJI_PALACE_OPTIONS } from './main/config';
export { buildKinAstroSnapshotForFields } from './main/snapshot';
export { YZJ_PRESET_LABELS, YZJ_PRESETS, cetianDisplayToggles, KINASTRO_PAGE_SETTINGS, YZJ_PRESET_STATEMAP, YZJ_AUX_TABS, YZJ_STATE_TO_OPT } from './main/settings';

class KinAstroMain extends Component{
	constructor(props){
		super(props);
		const technique = props.technique || 'shaozi';
		this.config = TECHNIQUE_CONFIG[technique] || TECHNIQUE_CONFIG.shaozi;
		this.state = {
			loading: false,
			pan: null,
			rightPanelTab: 'overview',
			gender: '1',
			// fields→state 上次同步来源标记（computeKinFieldsResync 用）；不进 optionKeys 观察器。
			fieldsSyncSrc: null,
			// 策天飞星双法:算法(书法/原法) + 原法子选项(农历/正曜)
			cetianMethod: 'book',
			cetianLunarMode: 'sxtwl',
			cetianStarOrder: 'reverse',
			// 策天 5 显示开关(默认 1=显示=现状,仅过滤输出不改算法)
			cetianShowWuXingJu: 1,
			cetianShowSihua: 1,
			cetianShowFlying: 1,
			cetianShowBrightness: 1,
			cetianShowSolarTerm: 1,
			// 书法(移语本)口径与流年选项 —— 仅 method='book' 生效,原法不透传不显示
			cetianBrightnessSchool: 'yiyu',     // 庙旺口径:移语本诸星格(默认)/quanji 全集本诗诀
			cetianShenGongMode: 'yizheng',      // 身宫取整:引证图口径(默认)/literal 正文直读
			cetianDaxianMode: 'yiyu',           // 大限起宫:阳年从命阴年从身(默认)/legacy 顺从命逆从身
			cetianTianluoMode: 'benshu',        // 天罗地网:本书月日法(默认)/zhongtian 中天太极月时法
			cetianPalaceNameMode: 'common',     // 宫名:通行(默认)/monk 僧道起法
			cetianLiunianYear: new Date().getFullYear(),  // 流年年份(点选,默认今年)
			cetianLiunianQishaMode: 'shengshi', // 流年七煞:生时法(默认)/suishu 岁数法
			// 中宫内容档位只存「改动代次」不存值 —— 值恒按当前 serviceKey 从 LS 现读。
			// 🔴 策天与演禽复用同一个 KinAstroMain 实例(technique 走 props),把档位缓存进 state
			// 会跟着上一个技法漂:实测在策天调成「全量信息」后切到演禽,盘画的是演禽自己的档,
			// 下拉却显示策天那档 —— 控件与实际不符比档位错更误导人。
			centerContentRev: 0,
			// 书法 6 显示开关(默认 1=显示)
			cetianShowLiunian: 1,
			cetianShowShensha: 1,
			cetianShowZaYao: 1,
			cetianShowDuanjue: 1,
			cetianShowXiu: 1,
			cetianShowBianyao: 1,
			// 典籍全文(惰性拉取 /cetian/texts,组件态缓存)
			cetianTexts: null,
			cetianTextsLoading: false,
			ke: '初刻',
			useKey: '1',
			pillarOverride: '0',
			yearGz: '',
			monthGz: '',
			dayGz: '',
			hourGz: '',
			calendarMode: 'autoLunar',
			lunarYear: 2026,
			lunarMonth: 1,
			lunarDay: 1,
			tiebanMethod: 'kunji',
			tiebanStartAge: 0,
			tiebanDayunSteps: 8,
			tiebanSchool: 'south',      // 流派 §3.1:south 南派(默认·港台主流) / north 北派(中州)
			tiebanKeSystem: 'qing8',    // 刻制 §11.4:qing8 清八刻(默认) / ming100 明百刻 / dou12 十二刻斗宫
			tiebanKe: 1,                // 考刻刻位 1-8(框架层示意;精确刻分走后端考刻)
			tiebanTwinFen: 'off',       // 双胞胎三分 §11.6:off / shang上 / zhong中 / xia下
			tiebanGuofang: false,       // 过房/养子 对条标注 §11.6
			fatherBirthYear: null,
			fatherDeathYear: null,
			motherBirthYear: null,
			motherDeathYear: null,
			siblingsInfo: '',
			maritalStatus: '',
			childrenInfo: '',
				fendjingStemOverride: '0',
				fendjingYearStem: '甲',
				fendjingHourStem: '甲',
				beijiKeMode: 'auto',
				beijiKe: '1',
				beijiLookupCode: '',
				beijiKeyword: '',
				nanjiMode: 'solar',
				nanjiAfterLichun: '1',
				nanjiLunarYear: 2026,
				nanjiSolarMonth: 1,
				nanjiDay: 1,
				nanjiHourZhi: '子',
				nanjiDayGan: '',
				nanjiDayZhi: '',
				// 推演三项缺省改「按本命」(空=后端按本盘自出:宫部=本命宫部、建除「建」、宿「角」),与无头挂载同源;
				// 此前写死 子部/建/張 → 页面与挂载快照不逐字同(帮助称相同)。
				nanjiSection: '',
				nanjiJianchu: '',
				nanjiXiu: '',
				nanjiPasswordCode: '海異山同',
				nanjiChart: 1,
				nanjiPalace: '',   // 自出(宫部首支,后端按盘推出);此前写死「子」,与挂载缺省不同 → 同一张盘页面与快照推演宫不一致
				nanjiDegree: 1,
				chunziKeMode: 'auto',
				chunziKe: '3',
				chunziLunarMode: 'auto',
				chunziLunarMonth: 1,
				chunziLunarDay: 1,
				chunziLookupCode: '',
				chunziKeyword: '',
				chunziTags: '',
				chunziMansion: '',      // 空=按本命/后端缺省(与无头同源)
				chunziHourBranch: '',
				chunziResultLimit: '20',
				canpingMethod: 'ming',
				canpingDayun: 'mingGongQiyun',   // 此前未初始化 → 下拉空白(引擎按 || 'mingGongQiyun' 用默认档)
				heluoQuHuaGong: 'tuWangKunGen',
				heluoZiShu: 'pair',            // 取数法【分歧B】pair 成对全取★ / single 每支阴阳取一
				heluoJiGong: 'manualSanYuan',  // 五寄中宫【分歧D】manualSanYuan 三元表★ / legacy 旧代码
				heluoZhiZun: true,             // 三至尊卦【分歧E】坎屯蹇 实现★ / 忽略
				heluoPureGanKun: 'current',    // 纯乾坤落爻【分歧F】current★ / alt 抄本异
				heluoLiunianStep2: 'ying',     // 流年第二步【分歧H】ying 应爻法★ / sequential 顺行
				heluoLiuYueMode: 'ying',       // 流月起月【分歧】ying 应爻校准★(古籍实证例) / legacy 现行序
				heluoHuangdiOffset: '2697',    // 纪年基准【分歧J】黄帝纪元差,公历+此=黄帝年(默认 2697)
				heluoShowLiuRi: true,          // 流日显示(展开流月后是否列 30 日)
				zhengchuanSchool: 'tieban',    // 流派:铁板神数★ / 邵子神数 / 大定神数
				zhengchuanAskGz: '',           // 求测时辰干支(铁板必需;留空则取本人时柱)
				zhengchuanFatherAge: '27',     // 父生我时年龄(邵子必需)
				zhengchuanMotherAge: '26',     // 母生我时年龄(邵子必需)
				zhengchuanYuan: 'zhong',       // 元运(邵子先天命卦余5特例):上元/中元★/下元
				zhengchuanDadingYear: '',      // 所推之流年(大定;主控 —— 虚岁/大运/小运/岁君尽由此派生)
				zhengchuanAge: '',             // 虚岁(大定;留空由流年派生。手填者优先,留作古法特例)
				                               // 🔴 默认须【空】:留 '40' 则「手订」恒真、且恒压过流年派生 —— 那还是老样子
				zhengchuanDayun: '',           // 大运干支(大定;留空取月柱)
				zhengchuanXiaoyun: '',         // 小运干支(大定;留空取时柱)
				zhengchuanSuijun: '',          // 岁君干支(大定;留空取年柱)
				zhengchuanAskHourZhi: '',      // 演算时辰支(六亲·玄机卦;留空取本人时支)
				zhengchuanEnv: '',             // 演算时天象(六亲·玄机卦;留空按时辰取天/地四象首项)
				zhengchuanItem: '父母',        // 查询项目(心易)★
				zhengchuanSound: '日',         // 声音(心易)★
				zhengchuanKe: '一刻',          // 刻数(心易·八刻分命)★
				zhengchuanGong: '乾',          // 八宫(心易·八刻分命)★
				zhengchuanXqZhi: '子',         // 性情项地支(心易)★
				zhengchuanXqYushu: '1',        // 性情项余数 1..12(心易)★
				yizhangjingPreset: 'michuan',       // 流派预设:秘传口诀★（默认全套开关＝下方各★）
				yizhangjingShunni: 'yangNanYinNv',  // 顺逆规则:阳男阴女★ / 男顺女逆
				yizhangjingMingGong: 'shiShang',    // 命宫定法:时上起命★ / 数至卯
				yizhangjingDayunLen: '7',           // 大限运长:7年★ / 10年
				yizhangjingStartAge: 'mi',          // 大限起运岁:秘传★ / 1岁连续
				yizhangjingXiaoStart: 'ri',         // 小限起宫:日柱宫★ / 月柱宫
				yizhangjingXiaoDir: 'chart',        // 小限顺逆:随盘向★ / 一律顺行
				yizhangjingAnnual: 'xiaoxian',      // 逐年法:小限★ / 流年十二神（互斥）
				yizhangjingFlowSet: 'A',            // 流年十二神:甲组★ / 乙 / 丙
				yizhangjingTongxian: true,          // 童限:开★ / 关（仅大限起运>1岁有内容）
				yizhangjingChongfan: 'alpha',       // 重犯口诀:常见组★ / 异传组
				yizhangjingDingYue: 'nongli',       // 定月法:农历月★ / 节气月
				yizhangjingLeapRule: 'half',        // 闰月细则:十五折半★ / 夜半折半（默认十五折半＝改造前口径,零回归）
				yizhangjingZaoZi: false,            // 早子调宫:关★（仅生时=子时生效）
				yizhangjingStarNaming: 'A',         // 星名系统:A主流★ / B异名 / C改名（纯显示层,不改盘）
				yizhangjingDaoTerm: 'gui',          // 六道术语:鬼道★ / 饿鬼道（纯显示层）
				yizhangjingGradeSet: 'standard',    // 品级分类:主流★ / 变体(天驿归凶,改九品/命格)
				yizhangjingShensha: false,          // 神煞合参层(默认关)
				...KINASTRO_PAGE_SETTINGS.loadSaved(),   // 上次亲手设的口径(只并入保存过的键;没存过 = 上面的出厂值原样)
			};
		this.unmounted = false;
		this.timeHook = {};
		this.requestSeq = 0;
		// 网络层去重:同一(serviceKey+payload)的请求若已在途,后到的等价触发跳过(不重打后端)。
		// 起盘/改设置/切技法经 dispatch→save(props 变)+doHook(hook 回调)两路+各入口会对同一输入
		// 重复触发 fetchPan;requestSeq 只挡「结果应用」,这里挡「重复网络请求」。输入变 → 签名变 → 不跳过。
		this._inFlightSig = null;
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.onZcOwnHourZhi = this.onZcOwnHourZhi.bind(this);
		this.prefetchStepSelect = this.prefetchStepSelect.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.clickPlot = this.clickPlot.bind(this);
		this.setYizhangjingTab = this.setYizhangjingTab.bind(this);
		this.fetchPan = this.fetchPan.bind(this);
		this.setRightPanelTab = this.setRightPanelTab.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				this.fetchPan(fields || this.props.fields);
			};
			// 🔴 chartFree 契约(极速化快车道):本页中右栏【零】消费共享 chartObj(全部由 fields
			// 驱动本组件自算/自取)。声明后 fetchByFields 对本页走快车道:fields 立即提交、
			// 不等 /chart 网络 —— 本页从「等一次网络(~230ms)」变「点击即出(<100ms)」。
			// 若日后本页开始读 props.value/chartObj,必须删掉此行(有静态哨兵机械核)。
			this.props.hook.chartFree = true;
		}
	}

	// 重 wrapper sCU(照 BaZi/ZiWeiMain 既有范式):全 props 机械浅比(函数型视为恒等,
	// 开关 horosa.perf.chartSCU 关=恒重渲旧行为),state 引用变照常重渲(setState 恒换引用)。
	// 收益:激活态下宿主无关 dispatch 不再整树白跑本重组件。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){ return true; }
		return !wrapperPropsEqual(this.props, nextProps);
	}

	// horosa_prefetch_registry_v1(PERF-R10 P6):数算/其他/演禽 的步进预取登记。
	// 「已步进 fields」走与真点完全相同的 buildPayload+postKinAstro 路径(缓存键
	// serviceKey|payload 逐字节同键);native 技法(参评/河洛/正传/一掌经,本地引擎)
	// 与构参失败一律返回 [](零网络)。登记键 = 页签归属键(v3.6.0 起随上游 hostModuleKey
	// 语义:被宿主页嵌用时按宿主键登记,与 setRuntimeKinAstroTechnique/markPanelReady 同源);
	// 换轨跨模块键(mingother↔yanqin)时必须迁移登记,否则新键查不到预取器。
	_syncStepPrefetcher(){
		const key = this.props.hostModuleKey || this.config.moduleKey;
		if(this._stepPrefetchKey === key && this._stepPrefetcher){
			return;
		}
		if(this._stepPrefetchKey && this._stepPrefetcher){
			unregisterStepPrefetcher(this._stepPrefetchKey, this._stepPrefetcher);
		}
		this._stepPrefetcher = (steppedFields)=>{
			try{
				if(this.config.native){ return []; }
				const payload = this.buildPayload(steppedFields);
				if(!payload){ return []; }
				const sk = this.config.serviceKey;
				return [{
					name: sk,
					path: `/${sk}/pan`,
					run: ()=> postKinAstro(sk, payload).catch(()=>{ /* 预取失败静默 */ }),
				}];
			}catch(e){
				return [];
			}
		};
		this._stepPrefetchKey = key;
		registerStepPrefetcher(key, this._stepPrefetcher);
	}

	componentDidMount(){
		this.unmounted = false;
		setRuntimeKinAstroTechnique(this.props.hostModuleKey || this.config.moduleKey, this.config.serviceKey);
		this._syncStepPrefetcher();
		// fields→state 首次同步（性别+农历锚点）；此后 didUpdate 用同一 helper 做标记式重同步，
		// 载入命例（fields 变）时性别/锚点必随记录刷新（修透传断链），手动切换不被无关变化冲掉。
		const nextState = computeKinFieldsResync(this.props.fields, this.state.fieldsSyncSrc) || {};
		// 全局日界点 / 晚子时·时柱起干 切换 → 重新 fetchPan(buildPayload 经 chartDayBoundary:本盘没值时实时读全局)
		if(typeof window !== 'undefined'){
			this._dayBoundaryListener = (ev) => {
				const v = ev && ev.detail ? ev.detail.after23NewDay : null;
				if((v === 0 || v === 1) && this.props.fields){
					this.fetchPan(this.props.fields);
				}
			};
			window.addEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
			this._lateZiHourListener = (ev) => {
				const v = ev && ev.detail ? ev.detail.lateZiHourUseNextDay : null;
				if((v === 0 || v === 1) && this.props.fields){
					this.fetchPan(this.props.fields);
				}
			};
			window.addEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		this.setState(nextState, ()=>this.fetchPan(this.props.fields));
	}

	componentDidUpdate(prevProps, prevState){
		clearPendingTimeOnFieldsChange(this, prevProps);
		if(prevProps.technique !== this.props.technique){
			this.config = TECHNIQUE_CONFIG[this.props.technique || 'shaozi'] || TECHNIQUE_CONFIG.shaozi;
			setRuntimeKinAstroTechnique(this.props.hostModuleKey || this.config.moduleKey, this.config.serviceKey);
			this._syncStepPrefetcher();
			this.requestSeq += 1;
			this.setState({
				pan: null,
				rightPanelTab: 'overview',
					loading: false,
				// fields 与技法同帧变化的角落：早退前也要重同步，否则本分支吞掉载入命例的性别/锚点变化。
				...(computeKinFieldsResync(this.props.fields, this.state.fieldsSyncSrc) || {}),
			}, ()=>this.fetchPan(this.props.fields));
			return;
		}
		setRuntimeKinAstroTechnique(this.props.hostModuleKey || this.config.moduleKey, this.config.serviceKey);
		if(prevProps.fields !== this.props.fields && this.props.fields){
			// 🔴 载入命例（fields 变化）必须重同步 fields→state 拷贝（性别/农历锚点），否则 buildPayload
			// 与下传技法的 gender 停留旧值（透传断链 L2）。标记式检测：手动切换不被无关变化冲掉。
			// 重同步 setState 后 optionKeys 观察器会补发同参 fetchPan，由 fetchPan 的 _inFlightSig 去重。
			const resync = computeKinFieldsResync(this.props.fields, this.state.fieldsSyncSrc);
			if(resync){
				this.setState(resync, ()=>this.fetchPan(this.props.fields));
			}else{
				this.fetchPan(this.props.fields);
			}
		}
		const optionKeys = [
			'gender', 'ke', 'useKey', 'pillarOverride', 'yearGz', 'monthGz', 'dayGz', 'hourGz',
			'calendarMode', 'lunarYear', 'lunarMonth', 'lunarDay',
			'tiebanMethod', 'tiebanStartAge', 'tiebanDayunSteps',
			'fatherBirthYear', 'fatherDeathYear', 'motherBirthYear', 'motherDeathYear',
				'siblingsInfo', 'maritalStatus', 'childrenInfo',
				'fendjingStemOverride', 'fendjingYearStem', 'fendjingHourStem',
				'beijiKeMode', 'beijiKe', 'beijiLookupCode', 'beijiKeyword',
				'nanjiMode', 'nanjiAfterLichun', 'nanjiLunarYear', 'nanjiSolarMonth', 'nanjiDay',
				'nanjiHourZhi', 'nanjiDayGan', 'nanjiDayZhi', 'nanjiSection', 'nanjiJianchu',
				'nanjiXiu', 'nanjiPasswordCode', 'nanjiChart', 'nanjiPalace', 'nanjiDegree',
				'chunziKeMode', 'chunziKe', 'chunziLunarMode', 'chunziLunarMonth', 'chunziLunarDay',
				'chunziLookupCode', 'chunziKeyword', 'chunziTags', 'chunziMansion', 'chunziHourBranch',
				'chunziResultLimit',
			];
		if(optionKeys.some((key)=>prevState[key] !== this.state[key])){
			this.fetchPan(this.props.fields);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(this._stepPrefetchKey && this._stepPrefetcher){
			unregisterStepPrefetcher(this._stepPrefetchKey, this._stepPrefetcher);
			this._stepPrefetchKey = null;
			this._stepPrefetcher = null;
		}
		if(typeof window !== 'undefined' && this._dayBoundaryListener){
			window.removeEventListener('horosa:day-boundary-changed', this._dayBoundaryListener);
		}
		if(typeof window !== 'undefined' && this._lateZiHourListener){
			window.removeEventListener('horosa:late-zi-hour-mode-changed', this._lateZiHourListener);
		}
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	// 策天典籍全文:惰性拉取 /cetian/texts(一次加载,组件态缓存;失败可重试)。
	loadCetianTexts = async ()=>{
		if(this.state.cetianTexts || this.state.cetianTextsLoading){
			return;
		}
		this.setState({ cetianTextsLoading: true });
		try{
			// 只打本机计算服务(Java 没有 /cetian/texts,失败改走它只会多一跳 404)
			const raw = await cachedKentangFetch(buildKentangEndpoint('cetian', 'texts'), { method: 'GET' }, { retries: 0 });
			const rsp = JSON.parse(await raw.text());
			const texts = rsp && rsp[ResultKey] && rsp[ResultKey].texts ? rsp[ResultKey].texts : null;
			this.setState({ cetianTexts: texts, cetianTextsLoading: false });
		}catch(e){
			this.setState({ cetianTextsLoading: false });
		}
	};

	render(){
		const embedded = !!this.props.hideQuickDock;
		const chartRendererClass = this.config.serviceKey === 'xianqin' || this.config.serviceKey === 'cetian' ? ' xq-chart-renderer-ziwei' : '';
		const showTechniqueRail = this.config.showRail || (Array.isArray(this.props.techniqueTabs) && this.props.techniqueTabs.length > 1);
		let pageStyle = { height: '100%', minHeight: 0, overflow: 'hidden' };
		if(embedded){
			pageStyle = { height: '100%', minHeight: 0, overflow: 'hidden' };
		}
		return (
			<div className={`horosa-huangji-page horosa-astro-redesign horosa-huangji-redesign horosa-kinastro-redesign horosa-kinastro-module-${this.config.moduleKey} horosa-kinastro-${this.config.serviceKey}-redesign${embedded ? ' horosa-huangji-embedded' : ''}`} style={pageStyle}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-huangji-redesign-layout">
					{/* WP-C keep-stale:重取时【有旧盘】就不压暗(Spin 只在首载兜底),角标代之 ——
					    旧盘全程可读可操作,新盘到达单次 setState 整体替换(印占同款)。开关关=旧局部 Spin。 */}
					<XQSpin spinning={this.state.loading && (!silentTechniquePanelsEnabled() || !this.state.pan)}>
						<div className={`horosa-astro-redesign-grid horosa-huangji-redesign-grid horosa-kinastro-grid${showTechniqueRail ? ' has-technique-rail' : ''}`} style={{ position: 'relative' }}>
							<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-huangji-input-panel">
								{this.renderInputPanel()}
							</div>
							<div className={`horosa-chart-stage horosa-chart-stage-redesign horosa-huangji-chart-panel xq-chart-renderer${chartRendererClass}`} style={{ position: 'relative' }}>
								{this.state.loading && this.state.pan && silentTechniquePanelsEnabled() ? <UpdatingBadge /> : null}
								<div className="horosa-huangji-board-host horosa-kinastro-board-host">{this.renderCenterSlot()}</div>
							</div>
							<div className="horosa-inspector-panel horosa-astro-content-panel horosa-huangji-info-panel">
								<div className="horosa-side-panel-heading horosa-huangji-info-heading-main">
									<div>
										<div className="horosa-side-panel-title">{this.config.infoTitle}</div>
										<div className="horosa-side-panel-subtitle">{this.config.infoSubTitle}</div>
									</div>
								</div>
								{this.renderRightPanel()}
							</div>
							{this.renderTechniqueRail()}
						</div>
					</XQSpin>
					{!this.props.hideQuickDock && this.renderBottomQuickDock()}
				</div>
			</div>
		);
	}
}
mixinMethods(KinAstroMain, computeMethods, inputPanelMethods, schoolCenterMethods, subTechniqueMethods, rightPanelMethods);   // 方法按职责拆在 ./main/ 下(见各文件头),挂回原型

export default KinAstroMain;
