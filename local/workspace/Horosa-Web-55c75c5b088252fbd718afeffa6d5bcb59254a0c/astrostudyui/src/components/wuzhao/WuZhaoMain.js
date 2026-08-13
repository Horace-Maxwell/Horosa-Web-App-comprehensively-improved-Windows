import QuickDockBar from '../common/QuickDockBar';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
// 🔴 必须显式 import React:JSX 转译后是 React.createElement,webpack 下有自动注入
// 兜着,但 jest 直测 render / SSR 场景会 ReferenceError(仓库既有教训)。
import React, { Component } from 'react';
import { InputNumber, Spin } from 'antd';
import DateTime from '../comp/DateTime';
import SpaceTimePanel, { buildDateTimeFromFields, formatSpaceTime } from '../comp/SpaceTimePanel';
import { subscribeRemoteNongli, geoPatchFromRec } from '../../utils/divinationTimeDraft';
import XQIcon from '../xq-icons';
import { XQButton as Button, XQSelect as Select, XQTabs as Tabs, XQSideSection, SIDE_COLLAPSE_STORE_KEY } from '../xq-ui';
import { safeJsonParseFromStorage, safeJsonStringifyToStorage } from '../../utils/safeStorage';
import { saveModuleAISnapshotLazy, saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { ServerRoot, ResultKey } from '../../utils/constants';
import { buildKentangEndpoint } from '../../integrations/kentang/serviceRoot';
import { stepPrefetchEnabled, kentangCacheEnabled } from '../../utils/perfFlags';
import { cachedKentangFetch } from '../../utils/kentangCache';
import { openKentangCaseDrawer, getKentangSavedCasePayload } from '../../utils/kentangCaseSave';
import { formatHumanValue } from '../../utils/humanReadableFields';
import { defaultAfter23NewDay, defaultLateZiHourUseNextDay } from '../../utils/dayBoundary';
import { parseDateParts } from '../../utils/dateStrSafe';
// 我方结果缓存(techniqueResultCacheEnabled/cachedKentangCall)已按 #78 收敛 SOP 退役 ——
// 上游自带的 kentangCacheEnabled + cachedKentangFetch 是其超集,上面已 import,勿重复引入。
import { markPanelReady } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';
import WuZhaoBoard from './WuZhaoBoard';

const { Option } = Select;
const { TabPane } = Tabs;

const MODE_OPTIONS = [
	{ value: 'ganzhi', label: '干支起盘' },
	{ value: 'day', label: '日干起盘' },
	{ value: 'hour', label: '时干起盘' },
	{ value: 'minute', label: '分干起盘' },
	{ value: 'tang', label: '唐代正法揲筮' },
	{ value: 'dunhuang', label: '敦煌校录揲筮' },
	{ value: 'qian', label: '以钱代筮' },
	{ value: 'zhushu', label: '直输五兆数' },
];

// 敦煌校录揲筮「数→五行」两派口径(文档内并存,做成可切;默认挂一回加)
const SHIFA_VARIANT_OPTIONS = [
	{ value: 'guayi', label: '挂一回加（0策水·5火·10木·15金·20土）' },
	{ value: 'jiaolu', label: '校录原案（0策土·5水·10火·15木·20金）' },
];

// 以钱代筮:四钱一掷,阳面数 → 撒币五行 → 取克之者为成卦五行
const QIAN_OPTIONS = [
	{ value: 4, label: '四阳（撒币火→水）' },
	{ value: 3, label: '三阳一阴（金→火）' },
	{ value: 2, label: '二阳二阴（土→木）' },
	{ value: 1, label: '一阳三阴（木→金）' },
	{ value: 0, label: '四阴（水→土）' },
];

const ZHAO_NUM_OPTIONS = [
	{ value: 1, label: '一·水' },
	{ value: 2, label: '二·火' },
	{ value: 3, label: '三·木' },
	{ value: 4, label: '四·金' },
	{ value: 5, label: '五·土' },
];

// short = 闭合态短标签(半宽格放得下);label = 下拉展开时的全称
const XINGSHEN_MONTH_OPTIONS = [
	{ value: 'lunar', short: '农历月', label: '农历月（《要诀略》本法）' },
	{ value: 'jieqi', short: '节气月', label: '节气月（月建）' },
];

const BEAST_VIEW_OPTIONS = [
	{ value: 'yougong', short: '游宫', label: '游宫六神（日干）' },
	{ value: 'xingshen', short: '行神', label: '行神六神（月家）' },
	{ value: 'both', short: '双显', label: '双显' },
];

// 类占九门(与后端 wuzhao_leizhan.MEN_ORDER 同序);右栏据 leizhanTab 只出所选之门
const LEIZHAN_MEN = ['卜病', '卜官事', '卜财', '卜行人', '卜六亲',
	'卜宅田丘墓', '卜数射覆', '卜怪异', '杂卜'];

const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const GENDER_OPTIONS = [
	{ value: '', label: '未指定' },
	{ value: 'male', label: '男' },
	{ value: 'female', label: '女' },
];

const POSITION_ORDER = ['兆', '木鄉', '火鄉', '土鄉', '金鄉', '水鄉'];
const DEFAULT_SPLITS = [18, 8, 5, 2, 1, 1];
const DEFAULT_QIAN_THROWS = [2, 2, 2, 2, 2, 2];
const DEFAULT_ZHAO_NUMS = [3, 3, 3, 3, 3, 3];

// 🔴 存案 round-trip 单源:save / restore / payload 三处全由此键集驱动。
// 手写白名单是「加了新档位却在载入时静默丢」的经典坑(奇门三式事盘已踩)。
// calc = 参与后端计算(进 payload,构成缓存键维度);view = 纯显示态(只入存案,不发请求)。
const OPTION_KEYS = {
	calc: ['mode', 'number', 'manual', 'manualSplits', 'shifaVariant',
		'qianThrows', 'qianAuto', 'zhaoNums', 'xingshenMonth', 'mingZhi', 'gender'],
	view: ['beastView', 'centerView', 'leizhanTab', 'rightPanelTab', 'panelWide'],
};
const ALL_OPTION_KEYS = [...OPTION_KEYS.calc, ...OPTION_KEYS.view];

// 对外导出计算类键集:AI 挂载 builder(aiAnalysisContext)按此键集透传,
// 不得另抄一份白名单——抄一份就必然漏新档位(挂载设置能设、builder 读不到 = 死开关)。
export const WUZHAO_CALC_OPTION_KEYS = OPTION_KEYS.calc.slice();

const DEFAULT_OPTIONS = {
	mode: 'ganzhi',
	number: 0,
	manual: false,
	manualSplits: DEFAULT_SPLITS,
	shifaVariant: 'guayi',
	qianThrows: DEFAULT_QIAN_THROWS,
	qianAuto: true,
	zhaoNums: DEFAULT_ZHAO_NUMS,
	xingshenMonth: 'lunar',
	mingZhi: '',
	gender: '',
	beastView: 'both',
	centerView: 'board',
	leizhanTab: LEIZHAN_MEN[0],
	rightPanelTab: 'overview',
	panelWide: false,
};

// 左栏展宽态在本机持久:复用侧栏折叠态那一张 map(绝不逐项另开 localStorage key
// —— localStorage 配额写满事故的既有教训)。
const PANEL_WIDE_STORE_KEY = 'wuzhao.panelWide';

function readPanelWide(){
	try{
		const map = safeJsonParseFromStorage(SIDE_COLLAPSE_STORE_KEY);
		if(map && typeof map === 'object' && typeof map[PANEL_WIDE_STORE_KEY] === 'boolean'){
			return map[PANEL_WIDE_STORE_KEY];
		}
	}catch(e){}
	return false;
}

function writePanelWide(value){
	try{
		const map = safeJsonParseFromStorage(SIDE_COLLAPSE_STORE_KEY);
		const next = (map && typeof map === 'object' && !Array.isArray(map)) ? map : {};
		next[PANEL_WIDE_STORE_KEY] = !!value;
		safeJsonStringifyToStorage(SIDE_COLLAPSE_STORE_KEY, next);
	}catch(e){}
}

function pickOptions(source, keys){
	const out = {};
	keys.forEach((key)=>{
		if(source && source[key] !== undefined){
			out[key] = source[key];
		}
	});
	return out;
}

function appendUnique(list, value){
	const text = value ? `${value}`.replace(/\/$/, '') : '';
	if(text && /^https?:\/\/.+/i.test(text) && list.indexOf(text) < 0){
		list.push(text);
	}
}

function parseFieldsDateTime(fields){
	if(!fields || !fields.date || !fields.time || !fields.date.value || !fields.time.value){
		return null;
	}
	const dateStr = fields.date.value.format('YYYY-MM-DD');
	const timeStr = fields.time.value.format('HH:mm:ss');
	// BC 安全解析:'-7040-07-19' 裸 split('-') 会撕成 [NaN,7040,7,19](年 NaN 静默传播)
	const _dp = parseDateParts(dateStr);
	const d = _dp ? [_dp.year, _dp.month, _dp.day] : [];
	const t = timeStr.split(':').map((item)=>parseInt(item, 10));
	if(d.length < 3 || t.length < 2){
		return null;
	}
	return {
		year: d[0],
		month: d[1],
		day: d[2],
		hour: t[0],
		minute: t[1],
		second: t[2] || 0,
		date: dateStr,
		time: timeStr,
		zone: fields.zone && fields.zone.value ? fields.zone.value : '',
		after23NewDay: defaultAfter23NewDay(),
		lateZiHourUseNextDay: defaultLateZiHourUseNextDay(),
	};
}

async function postWuZhaoRaw(path, payload){
	const roots = [];
	const endpoints = [];
	if(typeof window !== 'undefined'){
		try{
			const params = new URLSearchParams(window.location.search || '');
			['wuzhaoSrv', 'kinwuzhaoSrv', 'kinastroSrv', 'kentangSrv', 'kinSrv'].forEach((key)=>{
				appendUnique(roots, params.get(key));
			});
		}catch(e){}
	}
	appendUnique(roots, ServerRoot);
	if(/:9999(?:\/)?$/i.test(ServerRoot)){
		appendUnique(roots, ServerRoot.replace(/:9999(?:\/)?$/i, ':8892'));
	}
	appendUnique(roots, 'http://127.0.0.1:8892');
	appendUnique(endpoints, buildKentangEndpoint('wuzhao', path));
	roots.forEach((root)=>appendUnique(endpoints, `${root}/wuzhao/${path}`));
	appendUnique(endpoints, `${ServerRoot}/wuzhao/${path}`);

	let lastError = null;
	for(let i=0; i<endpoints.length; i++){
		try{
			const rawResponse = await cachedKentangFetch(endpoints[i], {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json; charset=UTF-8',
				},
				body: JSON.stringify(payload),
			}, { retries: 0 });
			const rawText = await rawResponse.text();
			const rsp = rawText ? JSON.parse(rawText) : null;
			if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
				throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'wuzhao.local.fetch.failed');
			}
			return rsp && rsp[ResultKey] ? rsp[ResultKey] : rsp;
		}catch(e){
			lastError = e;
		}
	}
	try{
		const rawResponse = await cachedKentangFetch(`${ServerRoot}/wuzhao/${path}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json; charset=UTF-8',
			},
			body: JSON.stringify(payload),
		}, { retries: 0 });
		const rawText = await rawResponse.text();
		const rsp = rawText ? JSON.parse(rawText) : null;
		if(!rsp || (rsp.ResultCode !== undefined && rsp.ResultCode !== 0)){
			throw new Error(rsp && rsp[ResultKey] ? `${rsp[ResultKey]}` : 'wuzhao.fetch.failed');
		}
		return rsp && rsp[ResultKey] ? rsp[ResultKey] : rsp;
	}catch(e){
		lastError = e || lastError;
	}
	throw lastError || new Error('wuzhao.fetch.failed');
}

// horosa_kentang_result_cache_v1 —— 五兆 /wuzhao/pan 直连缓存,**带确定性判据**。
// 🔴 五兆并非整体确定性:后端 webwuzhaosrv._calculate 里
//    day/hour/minute/tang 四种起盘在【未给手动折竹数】时走 kinwuzhao.WuzhaoCalculator.random_split
//    (random.randint,每次不同)——对这条路缓存会把随机揲筮结果钉死 = 功能降级,严禁。
//    只有 ① mode==='ganzhi'(干支数值法 gangzhi_paipan,纯计算)
//        ② manual===true(手动折竹:manualSplits 全量入 payload,后端不再摇随机)
//    这两种才是「同 payload 必同盘」。故下方 wuzhaoCacheable 为准入闸,不满足即直连(与今日逐字一致)。
// v3.5.1 收敛:结果级缓存退役 —— Raw 内部已走上游 utils/kentangCache;上述「自动揲筮
// 不可缓存」的守卫下沉到 kentangCache.payloadCacheable(horosa_wuzhao_random_guard_v1,
// Windows-ahead:上游矩阵把 wuzhao 误标 deterministic,fetch 级缓存会把无 seed 的
// random.randint 揲筮钉死 —— 在唯一缓存层拦,比在每个调用点拦更不可能漏)。
function postWuZhao(path, payload){
	return postWuZhaoRaw(path, payload);
}

function fmtValue(value){
	return formatHumanValue(value);
}

function buildSnapshotText(pan){
	if(!pan){
		return '暂无五兆数据';
	}
	if(pan.snapshot){
		return pan.snapshot;
	}
	const lines = [];
	(pan.sections || []).forEach((section)=>{
		lines.push(`[${section.title}]`);
		(section.rows || []).forEach((row)=>{
			lines.push(`${row.label}：${fmtValue(row.value)}`);
		});
		lines.push('');
	});
	return lines.join('\n').trim();
}

function modeUsesManualSplits(mode){
	return ['day', 'hour', 'minute', 'tang'].indexOf(mode) >= 0;
}

const MODE_VALUES = MODE_OPTIONS.map((item)=>item.value);

// 挂载场景默认回落干支起例:随机揲筮/掷钱在「按时间点重算」下不可复现。
const MOUNT_DETERMINISTIC_MODES = ['ganzhi', 'zhushu'];

function normalizeCalcOptions(source){
	const o = source || {};
	const mode = MODE_VALUES.indexOf(o.mode) >= 0 ? o.mode : DEFAULT_OPTIONS.mode;
	const sixNums = (value, fallback, min, max)=>{
		const list = Array.isArray(value) && value.length === 6 ? value : fallback;
		return list.map((item, idx)=>{
			const n = Number(item);
			// 坏值回落到「该位」的默认值(非首位默认值),免六数被首位污染
			if(!isFinite(n)){ return fallback[idx]; }
			return Math.max(min, Math.min(max, Math.round(n)));
		});
	};
	return {
		mode,
		number: Math.max(0, Math.min(9, Number(o.number) || 0)),
		manual: !!o.manual,
		manualSplits: sixNums(o.manualSplits, DEFAULT_SPLITS, 1, 35),
		shifaVariant: o.shifaVariant === 'jiaolu' ? 'jiaolu' : 'guayi',
		qianThrows: sixNums(o.qianThrows, DEFAULT_QIAN_THROWS, 0, 4),
		qianAuto: o.qianAuto === undefined ? DEFAULT_OPTIONS.qianAuto : !!o.qianAuto,
		zhaoNums: sixNums(o.zhaoNums, DEFAULT_ZHAO_NUMS, 1, 5),
		xingshenMonth: o.xingshenMonth === 'jieqi' ? 'jieqi' : 'lunar',
		mingZhi: BRANCHES.indexOf(o.mingZhi) >= 0 ? o.mingZhi : '',
		gender: (o.gender === 'male' || o.gender === 'female') ? o.gender : '',
	};
}

// AI 起课时间挂载入口:默认 mode='ganzhi'(干支起例,纯时间确定)+ 不报数;
// opts 允许用户在挂载设置里覆盖起兆法与古法层参数。随机类起兆法(揲筮/自动掷钱)
// 在挂载场景回落干支起例——挂载按时间点重算,随机盘每次不同即不可复现。
export async function buildWuZhaoSnapshotForFields(fields, opts){
	const dt = parseFieldsDateTime(fields);
	if(!dt){ return ''; }
	try{
		const calc = normalizeCalcOptions(opts);
		if(MOUNT_DETERMINISTIC_MODES.indexOf(calc.mode) < 0){
			const manualReproducible = (calc.mode === 'qian' && !calc.qianAuto)
				|| (modeUsesManualSplits(calc.mode) && calc.manual);
			if(!manualReproducible){ calc.mode = 'ganzhi'; }
		}
		const pan = await postWuZhao('pan', { ...dt, ...calc });
		return buildSnapshotText(pan);
	}catch(e){ return ''; }
}

class WuZhaoMain extends Component{
	// [R3-A6] 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(props){
		super(props);
		this.state = {
			loading: false,
			pan: null,
			...DEFAULT_OPTIONS,
			panelWide: readPanelWide(),
		};
		this.unmounted = false;
		this.timeHook = {};
		this.requestSeq = 0;
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.clickPlot = this.clickPlot.bind(this);
		this.fetchPan = this.fetchPan.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.restoreFromCurrentCase = this.restoreFromCurrentCase.bind(this);
		this.setRightPanelTab = this.setRightPanelTab.bind(this);
		this.changeMode = this.changeMode.bind(this);
		this.changeManual = this.changeManual.bind(this);
		this.changeSplit = this.changeSplit.bind(this);
		this.changeQianThrow = this.changeQianThrow.bind(this);
		this.changeZhaoNum = this.changeZhaoNum.bind(this);
		this.rollQian = this.rollQian.bind(this);
		this.togglePanelWide = this.togglePanelWide.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				if(!this.restoreFromCurrentCase()){
					this.fetchPan(fields || this.props.fields);
				}
			};
		}
	}


	componentDidMount(){
		this._unsubNongli = subscribeRemoteNongli(() => this.forceUpdate());
		this.unmounted = false;
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if(!this.restoreFromCurrentCase(true)){
			this.fetchPan(this.props.fields);
		}
	}

	componentDidUpdate(prevProps, prevState){
		if(prevProps.fields !== this.props.fields && this.props.fields){
			if(!this.restoreFromCurrentCase()){
				this.fetchPan(this.props.fields);
			}
		}
		if(this.skipNextOptionFetch){
			this.skipNextOptionFetch = false;
			return;
		}
		// 计算类档位变化才重取;显示类(六神视图/中栏视图/类占门类/右栏页签)只 setState。
		// [X1·P1-9] 报数只在干支起盘参算;掷钱明细只在非自动掷钱时参算——
		// 其余情形改之不得触发重取(随机起兆无 seed,重取=重掷,是「假生效」)。
		const calcChanged = OPTION_KEYS.calc.some((key)=>{
			if(prevState[key] === this.state[key]){ return false; }
			if(key === 'number'){ return this.state.mode === 'ganzhi'; }
			if(key === 'qianThrows'){ return this.state.mode === 'qian' && !this.state.qianAuto; }
			if(key === 'zhaoNums'){ return this.state.mode === 'zhushu'; }
			if(key === 'manualSplits'){ return modeUsesManualSplits(this.state.mode) && this.state.manual; }
			if(key === 'shifaVariant'){ return this.state.mode === 'dunhuang'; }
			if(key === 'qianAuto'){ return this.state.mode === 'qian'; }
			return true;
		});
		if(calcChanged){
			this.fetchPan(this.props.fields);
		}
	}

	componentWillUnmount(){
		if(this._unsubNongli){ this._unsubNongli(); }
		this.unmounted = true;
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前盘即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(rehydrate/未重排时缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'wuzhao'){
			return;
		}
		const pan = this.state ? this.state.pan : null;
		if(!pan){
			return;
		}
		let text = '';
		try{
			text = `${buildSnapshotText(pan) || ''}`.trim();
		}catch(e){
			text = '';
		}
		if(text){
			saveModuleAISnapshot('wuzhao', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	restoreFromCurrentCase(force){
		const saved = getKentangSavedCasePayload('wuzhao');
		if(!saved || !saved.payload){
			return false;
		}
		if(!force && this.lastRestoredCaseId === saved.caseVersion){
			// 🔴 [X1] 去重命中曾返 false → componentDidUpdate 落 else 分支 fetchPan,
			// 把已还原的冻结盘网络重取覆盖:manual=false 的自动揲筮无 seed,重取=重掷,还原盘≠保存盘。
			// 已持有冻结盘 → 返 true 拦下重取;盘确实丢了才放行向下重还原。
			if(this.state.pan){ return true; }
		}
		const payload = saved.payload;
		const options = payload.options && typeof payload.options === 'object' ? payload.options : {};
		this.lastRestoredCaseId = saved.caseVersion;
		this.requestSeq += 1;
		this.skipNextOptionFetch = true;
		// 🔴 键集驱动还原:存案里出现过的键一律回灌,新增档位不会在载入时静默丢。
		// 计算类键先过一遍归一:旧存案/脏存案里的空串与非法值不得直接落进 state
		// (会让左栏 Select 显示空、payload 带脏值)。显示类键原样回灌。
		const restored = pickOptions(options, ALL_OPTION_KEYS);
		const calcPresent = pickOptions(options, OPTION_KEYS.calc);
		if(Object.keys(calcPresent).length){
			const normalized = normalizeCalcOptions({ ...this.state, ...calcPresent });
			Object.keys(calcPresent).forEach((key)=>{ restored[key] = normalized[key]; });
		}
		this.setState({
			loading: false,
			pan: payload.pan || null,
			...restored,
		}, ()=>{
			const pan = this.state.pan;
			saveModuleAISnapshotLazy('wuzhao', ()=>buildSnapshotText(pan));
		});
		return true;
	}

	onFieldsChange(field){
		if(this.props.dispatch){
			const flds = {
				...(this.props.fields || {}),
				...field,
			};
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: flds,
			});
		}
	}

	// [自由起盘] 左栏经纬度选择 → 经纬 + 时区自动校正 + 重锚时间 + 地名(经度影响真太阳时→时柱)。
	changeGeo(rec){
		this.onFieldsChange(geoPatchFromRec(rec, this.props.fields));
	}
	onTimeChanged(value){
		const dt = value.time;
		this.onFieldsChange({
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
			// [R3-A2] 步进方向提示:驱动 astro model settle 后 /chart ±步预取(消费后即剥离)
			...(value.step ? { __stepHint: value.step } : {}),
		});
		this.prefetchDraftPan();
	}

	// [R3-A4] 草稿时间一变即预取该时刻 pan:字段源与 clickPlot 完全同源
	// (getTimeFieldsFromSelector),payload 走 buildPanPayload 单源 → 键逐字节等;
	// 用户点「起盘」即缓存命中 ≈ 瞬间。失败静默;开关关=零行为。
	prefetchDraftPan(){
		try{
			if(!stepPrefetchEnabled() || !kentangCacheEnabled()){ return; }
			if(this.prefetchDraftTimer){ clearTimeout(this.prefetchDraftTimer); }
			this.prefetchDraftTimer = setTimeout(()=>{
				this.prefetchDraftTimer = null;
				if(this.unmounted){ return; }
				try{
					const flds = this.getTimeFieldsFromSelector(this.props.fields) || this.props.fields;
					const payload = this.buildPanPayload(flds);
					if(!payload){ return; }
					postWuZhao('pan', payload).catch(()=>null);
				}catch(e){ /* 预取失败无害 */ }
			}, 150);
		}catch(e){ /* 预取失败无害 */ }
	}

	getTimeFieldsFromSelector(baseFields){
		if(!this.timeHook || !this.timeHook.getValue){
			return null;
		}
		const raw = this.timeHook.getValue();
		const dt = raw && raw.value && raw.value instanceof DateTime
			? raw.value
			: (raw && raw.time && raw.time instanceof DateTime ? raw.time : null);
		if(!dt){
			return null;
		}
		const patch = {
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		};
		return {
			...(baseFields || {}),
			...patch,
		};
	}

	clickPlot(){
		const nextFields = this.getTimeFieldsFromSelector(this.props.fields) || this.props.fields;
		if(!nextFields){
			return;
		}
		if(nextFields.date && nextFields.time && nextFields.zone){
			this.onFieldsChange({
				date: nextFields.date,
				time: nextFields.time,
				ad: nextFields.ad,
				zone: nextFields.zone,
			});
		}
		this.fetchPan(nextFields);
	}

	// [R3-A4] pan 请求体单源:fetchPan 与草稿预取共用同一构造 → 缓存键逐字节等(预取生效前提)。
	// 计算类键集驱动:新增档位自动进 payload,缓存键维度天然完备。
	buildPanPayload(fields){
		const dt = parseFieldsDateTime(fields);
		if(!dt){ return null; }
		return {
			...dt,
			...pickOptions(this.state, OPTION_KEYS.calc),
		};
	}

	async fetchPan(fields){
		const payload = this.buildPanPayload(fields);
		if(!payload){
			return;
		}
		const reqSeq = ++this.requestSeq;
		this.setState({ loading: true });
		try{
			const pan = await postWuZhao('pan', payload);
			if(this.unmounted || reqSeq !== this.requestSeq){
				return;
			}
			this.setState({ pan, loading: false }, ()=>{
				// horosa_panel_ready_v1:pan 落定 = 中栏与右栏(皆由 pan 派生)画完的那一次 setState。
				markPanelReady('cnyibu');
				saveModuleAISnapshotLazy('wuzhao', ()=>buildSnapshotText(pan));
			});
		}catch(e){
			console.warn('kinwuzhao backend failed', e);
			if(!this.unmounted && reqSeq === this.requestSeq){
				this.setState({ loading: false });
			}
		}
	}

	clickSaveCase(){
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			fields: this.props.fields,
			module: 'wuzhao',
			label: '五兆',
			payload: {
				// 🔴 键集驱动存案:与 restoreFromCurrentCase 同源,加档位不必两处同改。
				options: pickOptions(this.state, ALL_OPTION_KEYS),
				pan: this.state.pan,
				snapshot: buildSnapshotText(this.state.pan),
			},
		});
	}

	setRightPanelTab(key){
		this.setState({ rightPanelTab: key });
	}

	changeMode(value){
		const nextMode = value || 'ganzhi';
		this.setState({ mode: nextMode, manual: modeUsesManualSplits(nextMode) ? this.state.manual : false });
	}

	changeManual(value){
		if(!modeUsesManualSplits(this.state.mode)){
			this.setState({ manual: false });
			return;
		}
		this.setState({ manual: value === 'manual' });
	}

	changeSplit(index, value){
		const next = [...this.state.manualSplits];
		next[index] = value || 1;
		this.setState({ manualSplits: next });
	}

	changeQianThrow(index, value){
		const next = [...this.state.qianThrows];
		next[index] = value === undefined || value === null ? 2 : Number(value);
		this.setState({ qianThrows: next, qianAuto: false });
	}

	changeZhaoNum(index, value){
		const next = [...this.state.zhaoNums];
		next[index] = value === undefined || value === null ? 3 : Number(value);
		this.setState({ zhaoNums: next });
	}

	// 左栏展宽:窄栏下八式起兆的诸多档位要靠滚动才见,且长标签换行挤压。
	// 展宽后左栏占三分之一强、选项网格转多列,一屏看全;纯显示态,不触发重算。
	togglePanelWide(){
		const next = !this.state.panelWide;
		this.setState({ panelWide: next });
		writePanelWide(next);
	}

	// 掷钱:本地随机四钱六掷后落成明细并转手动,使所得之盘可复现、可存案。
	rollQian(){
		const next = [];
		for(let i=0; i<6; i++){
			let yang = 0;
			for(let c=0; c<4; c++){ yang += Math.random() < 0.5 ? 1 : 0; }
			next.push(yang);
		}
		this.setState({ qianThrows: next, qianAuto: false });
	}

	renderInputPanel(){
		const fields = this.props.fields || {};
		const datetm = buildDateTimeFromFields(fields);
		const canUseManualSplits = modeUsesManualSplits(this.state.mode);
		const manualModeValue = canUseManualSplits ? (this.state.manual ? 'manual' : 'auto') : 'computed';
		return (
			<div className="horosa-huangji-input-stack horosa-wuzhao-input-stack">
				<div className="horosa-wuzhao-panel-head">
					<div>
						<div className="horosa-side-panel-title">五兆设置</div>
						<div className="horosa-side-panel-subtitle">时间、起盘法与揲筮选项</div>
					</div>
					<Button
						size="small"
						className="horosa-wuzhao-panel-toggle"
						onClick={this.togglePanelWide}
						title={this.state.panelWide ? '回到三栏（盘面与信息栏复现）' : '设置栏占满工作区，一屏看全全部档位'}
					>
						{this.state.panelWide ? '回三栏' : '全宽'}
					</Button>
				</div>
				<SpaceTimePanel
					fields={fields}
					value={datetm}
					timeText={formatSpaceTime(fields, '---- -- -- --:--:--')}
					onTimeChange={this.onTimeChanged}
					timeHook={this.timeHook}
					onGeoChange={this.changeGeo}
				/>
				<XQSideSection iconName="other" title="五兆选项" storageKey="wuzhao.opts" className="horosa-huangji-input-section">
					<div className="horosa-huangji-select-grid">
						<label className="horosa-huangji-select-field is-wide">
							<span>起盘方式</span>
							<Select value={this.state.mode} onChange={this.changeMode}>
								{MODE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
						<label className="horosa-huangji-select-field">
							<span>报数</span>
							{/* [X1·P1-9] 报数仅「干支起盘」参算(其余起兆法不吃 num);其余模式禁用免「改了触发随机重掷」假生效。
							    max 收 9:后端 >9 即 mod9,曾致左栏显 45 而概览/AI 显 0 同屏矛盾。
							    ⚠️ 干支法对干支序数总和取五为模 → 相差 5 的报数必得同一盘(实测 0-9 恰 5 个相异盘),
							    非死开关而是等价类,故照实标注(说明文另起整行,不挤在窄格里逐字换行)。 */}
							<InputNumber value={this.state.number} min={0} max={9} disabled={this.state.mode !== 'ganzhi'} onChange={(v)=>this.setState({ number: v || 0 })} />
						</label>
						{/* 揲筮模式只对折竹／唐法有意义;其余起兆法本无「自动随机 vs 手动复现」之别,
						    与其留一个标签失真的禁用控件(死开关观感),不如按法隐藏。 */}
						{canUseManualSplits ? (
							<label className="horosa-huangji-select-field is-wide">
								<span>揲筮模式</span>
								<Select value={manualModeValue} onChange={this.changeManual}>
									<Option value="auto">自动随机</Option>
									<Option value="manual">手动复现</Option>
								</Select>
							</label>
						) : null}
					</div>
					{this.state.mode === 'dunhuang' ? (
						<div className="horosa-huangji-select-grid">
							<label className="horosa-huangji-select-field is-wide">
								<span>筮法口径</span>
								<Select value={this.state.shifaVariant} onChange={(v)=>this.setState({ shifaVariant: v || 'guayi' })}>
									{SHIFA_VARIANT_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</label>
						</div>
					) : null}
					<div className="horosa-wuzhao-split-note">
						{this.state.mode === 'ganzhi'
							? '报数取五为模：相差 5 的报数得同一盘（0≡5、1≡6、2≡7、3≡8、4≡9），十个取值实出五盘。'
							: '本起盘方式不吃报数（仅干支起盘参算），故报数框置灰。'}
					</div>
				</XQSideSection>
				{this.state.mode === 'qian' ? (
					<XQSideSection iconName="quickComposite" title="掷钱六次" storageKey="wuzhao.qian" className="horosa-huangji-input-section">
						<div className="horosa-wuzhao-split-grid is-qian">
							{POSITION_ORDER.map((item, idx)=>(
								<label className="horosa-huangji-select-field is-wide" key={item}>
									<span>{item.replace('鄉', '乡')}</span>
									<Select value={this.state.qianThrows[idx]} onChange={(v)=>this.changeQianThrow(idx, v)}>
										{QIAN_OPTIONS.map((opt)=><Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
									</Select>
								</label>
							))}
						</div>
						<div className="horosa-huangji-action-row is-inline">
							<Button onClick={this.rollQian}>自动掷钱</Button>
							<Button type={this.state.qianAuto ? 'primary' : 'default'} onClick={()=>this.setState({ qianAuto: !this.state.qianAuto })}>
								{this.state.qianAuto ? '每次起盘重掷' : '用上列定数'}
							</Button>
						</div>
						<div className="horosa-wuzhao-split-note">四钱一掷记阳面数，阳面多寡定撒币五行，取克之者为成卦五行。</div>
					</XQSideSection>
				) : null}
				{this.state.mode === 'zhushu' ? (
					<XQSideSection iconName="quickComposite" title="五兆卜数" storageKey="wuzhao.zhushu" className="horosa-huangji-input-section">
						<div className="horosa-wuzhao-split-grid">
							{POSITION_ORDER.map((item, idx)=>(
								<label className="horosa-huangji-select-field" key={item}>
									<span>{item.replace('鄉', '乡')}</span>
									<Select value={this.state.zhaoNums[idx]} onChange={(v)=>this.changeZhaoNum(idx, v)}>
										{ZHAO_NUM_OPTIONS.map((opt)=><Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
									</Select>
								</label>
							))}
						</div>
						<div className="horosa-wuzhao-split-note">线下实占所得六数直录：一水、二火、三木、四金、五土。</div>
					</XQSideSection>
				) : null}
				{canUseManualSplits ? (
					<XQSideSection iconName="quickComposite" title="手动六数" storageKey="wuzhao.manual" className="horosa-huangji-input-section">
						<div className="horosa-wuzhao-split-grid">
							{POSITION_ORDER.map((item, idx)=>(
								<label className="horosa-huangji-select-field" key={item}>
									<span>{item.replace('鄉', '乡')}</span>
									<InputNumber
										value={this.state.manualSplits[idx]}
										min={1}
										max={35}
										disabled={!this.state.manual}
										onChange={(v)=>this.changeSplit(idx, v)}
									/>
								</label>
							))}
						</div>
						<div className="horosa-wuzhao-split-note">
							手动复现只在选择“手动复现”后参与日干、时干、分干与唐代正法计算。
						</div>
					</XQSideSection>
				) : null}
				{/* 选项一律半宽两列排布;闭合态用 optionLabelProp 显短标签防截断,
				    下拉展开仍按内容宽出全称(XQSelect 默认 dropdownMatchSelectWidth=false)。 */}
				<XQSideSection iconName="other" title="断法与类占" storageKey="wuzhao.duanfa" className="horosa-huangji-input-section">
					<div className="horosa-huangji-select-grid">
						<label className="horosa-huangji-select-field">
							<span>六神显示</span>
							<Select value={this.state.beastView} optionLabelProp="label" onChange={(v)=>this.setState({ beastView: v || 'both' })}>
								{BEAST_VIEW_OPTIONS.map((item)=>(
									<Option key={item.value} value={item.value} label={item.short}>{item.label}</Option>
								))}
							</Select>
						</label>
						<label className="horosa-huangji-select-field">
							<span>行神月制</span>
							<Select value={this.state.xingshenMonth} optionLabelProp="label" onChange={(v)=>this.setState({ xingshenMonth: v || 'lunar' })}>
								{XINGSHEN_MONTH_OPTIONS.map((item)=>(
									<Option key={item.value} value={item.value} label={item.short}>{item.label}</Option>
								))}
							</Select>
						</label>
						{/* 类占门类:原在右栏作九个按钮独占大片版面,移来左栏作下拉。
						    纯显示态(不进 payload、不触发重取),右栏据此只出该门。 */}
						<label className="horosa-huangji-select-field">
							<span>类占门类</span>
							<Select value={this.state.leizhanTab} onChange={(v)=>this.setState({ leizhanTab: v || LEIZHAN_MEN[0] })}>
								{LEIZHAN_MEN.map((item)=><Option key={item} value={item}>{item}</Option>)}
							</Select>
						</label>
						<label className="horosa-huangji-select-field">
							<span>年命支</span>
							<Select value={this.state.mingZhi} onChange={(v)=>this.setState({ mingZhi: v || '' })}>
								<Option value="">未指定</Option>
								{BRANCHES.map((item)=><Option key={item} value={item}>{item}</Option>)}
							</Select>
						</label>
						<label className="horosa-huangji-select-field">
							<span>性别</span>
							<Select value={this.state.gender} onChange={(v)=>this.setState({ gender: v || '' })}>
								{GENDER_OPTIONS.map((item)=><Option key={item.value || 'none'} value={item.value}>{item.label}</Option>)}
							</Select>
						</label>
					</div>
					<div className="horosa-wuzhao-split-note">类占门类只改右栏所示之门，不重排盘；年命支与性别用于行年、年立与官禄位诸法，不填则该类条目留空不臆断。</div>
				</XQSideSection>
				<div className="horosa-huangji-action-row">
					<Button type="primary" onClick={this.clickPlot}>起盘</Button>
				</div>
			</div>
		);
	}

	renderPositionCard(item){
		const flags = item.flags || [];
		return (
			<div className="horosa-wuzhao-position-card" key={item.key}>
				<div className="horosa-wuzhao-position-head">
					<strong>{item.label}</strong>
					<span>{item.palace || '—'}宫</span>
				</div>
				<div className="horosa-wuzhao-number">{fmtValue(item.number)}</div>
				<div className="horosa-wuzhao-position-main">
					<span>{fmtValue(item.element)}</span>
					<span>{fmtValue(item.relation)}</span>
					<span>{fmtValue(item.beast)}</span>
				</div>
				<div className="horosa-wuzhao-position-foot">
					<span>{item.prosperity ? `旺相 ${item.prosperity}` : '旺相 —'}</span>
					<em>{flags.length ? flags.join(' · ') : '无特殊标记'}</em>
				</div>
			</div>
		);
	}

	renderCenter(){
		const pan = this.state.pan;
		if(!pan){
			return <div className="horosa-huangji-empty">暂无五兆数据</div>;
		}
		const gz = pan.ganzhi || {};
		const gzItems = [
			{ label: '年柱', value: gz.year },
			{ label: '月柱', value: gz.month },
			{ label: '日柱', value: gz.day },
			{ label: '时柱', value: gz.hour },
			{ label: '分柱', value: gz.minute },
		];
		const positions = pan.positions || [];
		const classic = pan.classic || null;
		const isBoard = this.state.centerView !== 'card';
		return (
			<div className="horosa-wuzhao-board">
				<div className="horosa-huangji-board-header">
					<div>
						<h2 className="horosa-wuzhao-title">五兆</h2>
					</div>
					<div className="horosa-wuzhao-view-switch">
						<Button size="small" type={isBoard ? 'primary' : 'default'} onClick={()=>this.setState({ centerView: 'board' })}>兆图</Button>
						<Button size="small" type={isBoard ? 'default' : 'primary'} onClick={()=>this.setState({ centerView: 'card' })}>卡片</Button>
					</div>
					<div className="horosa-huangji-board-time">{`${fmtValue(pan.dateStr)} ${fmtValue(pan.timeStr)}`}</div>
				</div>
				<div className="horosa-huangji-meta-grid horosa-wuzhao-meta-grid">
					<div><span>起盘方式</span><strong>{pan.modeLabel || '—'}</strong></div>
					<div><span>节气</span><strong>{pan.solarTerm || '—'}</strong></div>
					<div><span>农历</span><strong>{pan.lunarDate && pan.lunarDate.text ? pan.lunarDate.text : '—'}</strong></div>
					<div><span>上/下柱</span><strong>{fmtValue(pan.upperGanzhi)} / {fmtValue(pan.lowerGanzhi)}</strong></div>
					{classic ? <div><span>本兆·身宫支</span><strong>{fmtValue(classic.zhaoElem)}兆{fmtValue(classic.zhiElem)}支</strong></div> : null}
					{classic ? <div><span>旬·休王</span><strong>{fmtValue(classic.xun)}　{fmtValue(classic.qi && classic.qi.zhaoWangshuai)}（{fmtValue(classic.qi && classic.qi.zhaoQi)}）</strong></div> : null}
					<div className="horosa-huangji-ganzhi-card">
						<span>干支</span>
						<div className="horosa-huangji-ganzhi-grid">
							{gzItems.map((item)=>(
								<div className="horosa-huangji-ganzhi-item" key={item.label}>
									<em>{item.label}</em>
									<strong>{fmtValue(item.value)}</strong>
								</div>
							))}
						</div>
					</div>
				</div>
				{isBoard ? (
					<WuZhaoBoard positions={positions} classic={classic} beastView={this.state.beastView} />
				) : (
					<div className="horosa-wuzhao-board-grid">
						{positions.map((item)=>this.renderPositionCard(item))}
					</div>
				)}
			</div>
		);
	}

	renderRows(sections){
		const list = sections || [];
		if(!list.length){
			return <div className="horosa-huangji-empty">暂无数据</div>;
		}
		return list.map((section)=>(
			<div className="horosa-huangji-info-card" key={section.title}>
				<div className="horosa-huangji-info-heading">{section.title}</div>
				{(section.rows || []).map((row, idx)=>(
					<div className="horosa-huangji-info-row" key={`${section.title}_${row.label}_${idx}`}>
						<span>{row.label}</span>
						<strong>{fmtValue(row.value)}</strong>
					</div>
				))}
			</div>
		));
	}

	// 🔴 按 section.key 取段,不用下标切片:后端只增不改地追加新段时,下标切片会把新段
	// 静默吞掉(或错位显示),而键取法天然免疫。旧盘无 key 时按既有次第兜底。
	sectionsByKey(keys){
		const pan = this.state.pan;
		const list = pan && pan.sections ? pan.sections : [];
		const legacy = ['qipan', 'shishi', 'zhao', 'muxiang', 'huoxiang', 'tuxiang', 'jinxiang', 'shuixiang', 'flags'];
		return list.filter((section, idx)=>{
			const key = section.key || legacy[idx];
			return keys.indexOf(key) >= 0;
		});
	}

	renderLeizhan(){
		const pan = this.state.pan;
		const classic = pan && pan.classic ? pan.classic : null;
		const leizhan = classic && classic.leizhan ? classic.leizhan : null;
		if(!leizhan){
			return <div className="horosa-huangji-empty">暂无类占数据</div>;
		}
		const order = (classic.leizhanOrder && classic.leizhanOrder.length) ? classic.leizhanOrder : Object.keys(leizhan);
		const activeMen = order.indexOf(this.state.leizhanTab) >= 0 ? this.state.leizhanTab : order[0];
		const block = leizhan[activeMen] || {};
		// 门类选择已移至左栏「断法与类占」的下拉:九个按钮独占右栏大片版面,
		// 而九门是「看哪一门」的设置项,与其余断法档位同属左栏语境。
		return (
			<div className="horosa-huangji-section-list">
				<div className="horosa-wuzhao-men-hint">
					当前门类：<strong>{activeMen}</strong>
					<em>（在左栏「断法与类占 · 类占门类」切换）</em>
				</div>
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">{activeMen}·本盘命中</div>
					{(block.rules || []).length ? (block.rules || []).map((item, idx)=>(
						<div className="horosa-wuzhao-rule" key={`${item.title}_${idx}`}>
							<strong>{item.title}</strong>
							<p>{item.text}</p>
							{item.source ? <cite>{item.source}</cite> : null}
							{item.suspect ? <em className="horosa-wuzhao-suspect">原卷存疑：{item.suspect}</em> : null}
						</div>
					)) : <div className="horosa-huangji-info-row"><span>命中</span><strong>无</strong></div>}
				</div>
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">{activeMen}·通则条文</div>
					{(block.texts || []).map((pair, idx)=>(
						<div className="horosa-wuzhao-rule" key={`t_${idx}`}>
							<strong>{pair[0]}</strong>
							<p>{pair[1]}</p>
						</div>
					))}
				</div>
			</div>
		);
	}

	renderDuanci(){
		const pan = this.state.pan;
		const classic = pan && pan.classic ? pan.classic : null;
		if(!classic){
			return <div className="horosa-huangji-empty">暂无断辞数据</div>;
		}
		const zz = classic.duanciZhaozhi || {};
		const ss = classic.duanciSishi || {};
		const zayan = classic.zayan || {};
		return (
			<div className="horosa-huangji-section-list">
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">兆局</div>
					<p className="horosa-wuzhao-quote">{(classic.zhaoJu || {}).head}</p>
					{(classic.zhaoJu || {}).zongxiang ? <p className="horosa-wuzhao-quote">{classic.zhaoJu.zongxiang}</p> : null}
					{(classic.changsheng || {}).text ? <p className="horosa-wuzhao-quote">{classic.changsheng.text}</p> : null}
				</div>
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">廿五式·本盘所见</div>
					{(classic.duanci25 || []).map((item, idx)=>(
						<div className="horosa-wuzhao-rule" key={`d_${idx}`}>
							<strong>{`${item.xiang}（${item.xiangRole}）见${item.zhiElem}支`}</strong>
							<p>{item.text}</p>
							{item.suspect ? <em className="horosa-wuzhao-suspect">原卷存疑：{item.suspect}</em> : null}
						</div>
					))}
				</div>
				{zz.text ? (
					<div className="horosa-huangji-info-card">
						<div className="horosa-huangji-info-heading">{zz.title}·总断</div>
						<p className="horosa-wuzhao-quote">{zz.text}</p>
					</div>
				) : null}
				{(ss.text || ss.missing) ? (
					<div className="horosa-huangji-info-card">
						<div className="horosa-huangji-info-heading">候四时准则</div>
						{ss.text ? <p className="horosa-wuzhao-quote">{ss.text}</p> : null}
						{ss.missing ? <em className="horosa-wuzhao-suspect">{ss.missing}</em> : null}
						{ss.suspect ? <em className="horosa-wuzhao-suspect">原卷存疑：{ss.suspect}</em> : null}
					</div>
				) : null}
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">乡支名词</div>
					{(classic.positions || []).slice(1).map((item, idx)=>{
						const x13 = item.xiang13 || {};
						if(!x13.name){ return null; }
						return (
							<div className="horosa-wuzhao-rule" key={`x_${idx}`}>
								<strong>{`${item.label}·${x13.name}`}<i className="horosa-wuzhao-group">{x13.group}</i></strong>
								<p>{x13.text}</p>
							</div>
						);
					})}
				</div>
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">杂言·本盘命中</div>
					{(zayan.items || []).map((item, idx)=>(
						<div className="horosa-wuzhao-rule" key={`z_${idx}`}>
							<strong>{item.kind}</strong>
							<p>{item.text}</p>
							{item.detail ? <cite>{item.detail}</cite> : null}
						</div>
					))}
					{(zayan.ruXiang || []).map((item, idx)=>(
						<div className="horosa-wuzhao-rule" key={`r_${idx}`}>
							<strong>{`${item.xiang}·${item.name}`}</strong>
							<p>{item.text}</p>
						</div>
					))}
					{(classic.ruHeFang || []).map((item, idx)=>(
						<div className="horosa-wuzhao-rule" key={`f_${idx}`}>
							<strong>{`入何方·${item.title}`}</strong>
							<p>{item.text}</p>
							<cite>{`本盘入${item.ruGan}乡（${item.ruElem}）${item.xiangPresent ? '，盘中见此支' : ''}`}</cite>
						</div>
					))}
				</div>
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">头身足</div>
					{Object.keys((classic.toushenzu || {}).parts || {}).map((part)=>(
						<div className="horosa-huangji-info-row" key={part}>
							<span>{part}</span>
							<strong>{(classic.toushenzu.parts[part] || []).map((it)=>`${it.xiang}见${it.zhi}${it.fuyi ? `·${it.fuyi}` : ''}`).join('；')}</strong>
						</div>
					))}
					<p className="horosa-wuzhao-quote">{(classic.toushenzu || {}).head}</p>
				</div>
			</div>
		);
	}

	renderJunzi(){
		const pan = this.state.pan;
		const classic = pan && pan.classic ? pan.classic : null;
		if(!classic){
			return <div className="horosa-huangji-empty">暂无数据</div>;
		}
		const jz = classic.junzi || {};
		const bl = jz.boluo || {};
		const sm = classic.shenming || {};
		const qi = classic.qi || {};
		return (
			<div className="horosa-huangji-section-list">
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">君子小人</div>
					<p className="horosa-wuzhao-quote">{jz.head}</p>
					<div className="horosa-huangji-info-row"><span>本盘</span><strong>{jz.role || '不成君子小人之别'}</strong></div>
					<div className="horosa-huangji-info-row"><span>判据</span><strong>{jz.reason}</strong></div>
					{(jz.texts || []).map((text, idx)=><p className="horosa-wuzhao-quote" key={`j_${idx}`}>{text}</p>)}
					{classic.junziZhaozhi ? <p className="horosa-wuzhao-quote">{classic.junziZhaozhi}</p> : null}
					<p className="horosa-wuzhao-quote">{jz.yinyangRule}</p>
				</div>
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">剥落卦</div>
					{bl.hit ? (
						<div>
							<p className="horosa-wuzhao-quote">{bl.text}</p>
							<div className="horosa-huangji-info-row"><span>阴阳日</span><strong>{bl.dayYinYang || '—'}　{bl.verdict || ''}</strong></div>
						</div>
					) : <div className="horosa-huangji-info-row"><span>本盘</span><strong>非剥落之局</strong></div>}
					<p className="horosa-wuzhao-quote">{bl.rule}</p>
				</div>
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">身命</div>
					<p className="horosa-wuzhao-quote">{sm.head}</p>
					<div className="horosa-huangji-info-row"><span>本盘</span><strong>{sm.verdict || '非身克命、命克身之属'}</strong></div>
					<div className="horosa-huangji-info-row"><span>断</span><strong>{sm.detail}</strong></div>
					{sm.text ? <p className="horosa-wuzhao-quote">{sm.text}</p> : null}
				</div>
				<div className="horosa-huangji-info-card">
					<div className="horosa-huangji-info-heading">四时休王</div>
					<div className="horosa-huangji-info-row"><span>时令</span><strong>{qi.season || '—'}</strong></div>
					{Object.keys(qi.map || {}).map((elem)=>(
						<div className="horosa-huangji-info-row" key={elem}>
							<span>{elem}兆</span><strong>{qi.map[elem]}</strong>
						</div>
					))}
					<p className="horosa-wuzhao-quote">{qi.text}</p>
					{qi.suspect ? <em className="horosa-wuzhao-suspect">原卷存疑：{qi.suspect}</em> : null}
				</div>
			</div>
		);
	}

	renderWeijie(){
		const pan = this.state.pan;
		const classic = pan && pan.classic ? pan.classic : null;
		const list = (classic && classic.weijie) || [];
		if(!list.length){ return null; }
		return (
			<div className="horosa-huangji-info-card">
				<div className="horosa-huangji-info-heading">未解之谜（原卷存疑，不参与断卦）</div>
				{list.map((item, idx)=>(
					<div className="horosa-wuzhao-rule is-suspect" key={`w_${idx}`}>
						<strong>{item.title}</strong>
						<p>{item.text}</p>
					</div>
				))}
			</div>
		);
	}

	renderRightPanel(){
		const pan = this.state.pan;
		const classic = pan && pan.classic ? pan.classic : null;
		const flagRows = [];
		(pan && pan.positions ? pan.positions : []).forEach((item)=>{
			if(item.flags && item.flags.length){
				flagRows.push({ label: item.label, value: item.flags.join('、') });
			}
		});
		const tabs = ['overview', 'positions', 'duanci', 'junzi', 'najia', 'shensha', 'leizhan'];
		const activeKey = tabs.indexOf(this.state.rightPanelTab) >= 0 ? this.state.rightPanelTab : 'overview';
		return (
			<Tabs activeKey={activeKey} onChange={this.setRightPanelTab} defaultActiveKey="overview" tabPosition="top" className="horosa-huangji-tabs">
				<TabPane tab="概览" key="overview">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'overview'}>{() => (
						<div className="horosa-huangji-section-list">
							{this.renderRows(this.sectionsByKey(['qipan', 'shishi']))}
							{this.renderRows([{ title: '孤虚关籥将军', rows: flagRows.length ? flagRows : [{ label: '标记', value: '无' }] }])}
							{this.renderShifaDetail()}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="六位" key="positions">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'positions'}>{() => (
						<div className="horosa-huangji-section-list">
							{this.renderRows(this.sectionsByKey(['zhao', 'muxiang', 'huoxiang', 'tuxiang', 'jinxiang', 'shuixiang']))}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="断辞" key="duanci">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'duanci'}>{() => this.renderDuanci()}</FreezeSubTab>
				</TabPane>
				<TabPane tab="君子小人" key="junzi">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'junzi'}>{() => this.renderJunzi()}</FreezeSubTab>
				</TabPane>
				<TabPane tab="纳甲" key="najia">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'najia'}>{() => (
						<div className="horosa-huangji-section-list">
							{this.renderRows(this.sectionsByKey(['najia']))}
							{classic ? this.renderLiuqinFen(classic) : null}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="神煞行神" key="shensha">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'shensha'}>{() => (
						<div className="horosa-huangji-section-list">
							{this.renderRows(this.sectionsByKey(['shensha', 'xingshen']))}
							{this.renderWeijie()}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="类占" key="leizhan">
					{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
					<FreezeSubTab active={activeKey === 'leizhan'}>{() => this.renderLeizhan()}</FreezeSubTab>
				</TabPane>
			</Tabs>
		);
	}

	renderShifaDetail(){
		const pan = this.state.pan;
		const detail = pan && pan.shifaDetail ? pan.shifaDetail : null;
		if(!detail || !detail.rows || !detail.rows.length){ return null; }
		const title = detail.kind === 'qian' ? '掷钱明细'
			: (detail.kind === 'dunhuang' ? '揲筮明细' : '五兆卜数');
		return (
			<div className="horosa-huangji-info-card">
				<div className="horosa-huangji-info-heading">{title}{detail.variantLabel ? `（${detail.variantLabel}）` : ''}</div>
				{detail.rows.map((row)=>(
					<div className="horosa-huangji-info-row" key={row.index}>
						<span>{`${row.position}`.replace('鄉', '乡')}</span>
						<strong>
							{detail.kind === 'qian' ? `${row.yinyang}　撒币${row.coinElement} → ${row.element}（${row.num}）` : null}
							{detail.kind === 'dunhuang' ? `剩${row.remain}策 → ${row.element}（${row.num}）` : null}
							{detail.kind === 'zhushu' ? `${row.num}　${row.element}` : null}
						</strong>
					</div>
				))}
			</div>
		);
	}

	renderLiuqinFen(classic){
		const nj = classic.najia || {};
		const yy = nj.liuqinYinYang || {};
		const gh = nj.liuqinGanHe || {};
		return (
			<div className="horosa-huangji-info-card">
				<div className="horosa-huangji-info-heading">细分六亲</div>
				<div className="horosa-huangji-info-row"><span>五行阴阳法</span><strong>
					{`我${yy.me || '—'}·弟${yy.brother || '—'}·长子${yy.son || '—'}·次女${yy.daughter || '—'}·父${yy.father || '—'}·母${yy.mother || '—'}·正妻${yy.wife || '—'}·偏财${yy.concubine || '—'}·长辈男${yy.elderMale || '—'}女${yy.elderFemale || '—'}`}
				</strong></div>
				<p className="horosa-wuzhao-quote">{yy.rule}</p>
				<div className="horosa-huangji-info-row"><span>干合生克法</span><strong>
					{`我${gh.me || '—'}·妻${gh.wife || '—'}·母${gh.mother || '—'}·父${gh.father || '—'}·子${gh.son || '—'}·女${gh.daughter || '—'}`}
				</strong></div>
				<p className="horosa-wuzhao-quote">{gh.rule}</p>
			</div>
		);
	}

	// 快捷栏契约:右栏 tab 镜像撤除;快捷栏只放本页没有的动词,配置由 cnyibu 容器透传渲染。
	getQuickDockConfig(){
		return {
			hasResult: !!this.state.pan,
			primary: { key: 'plot', label: '起盘', onClick: ()=>this.clickPlot() },
			save: ()=>this.clickSaveCase(),
		};
	}

	renderBottomQuickDock(){
		return (
			<QuickDockBar
				page="wuzhao"
				className="horosa-huangji-quick-dock"
				dispatch={this.props.dispatch}
				{...this.getQuickDockConfig()}
			/>
		);
	}

	render(){
		const embedded = !!this.props.hideQuickDock;
		let height = this.props.height ? this.props.height : 760;
		let pageStyle = { height, minHeight: height, overflow: 'hidden' };
		if(embedded){
			pageStyle = { height: '100%', minHeight: 0, overflow: 'hidden' };
		}else if(height === '100%'){
			height = 760;
			pageStyle = { height, minHeight: height, overflow: 'hidden' };
		}else{
			height = height - 20;
			pageStyle = { height, minHeight: height, overflow: 'hidden' };
		}
		return (
			<div className={`horosa-huangji-page horosa-astro-redesign horosa-huangji-redesign horosa-wuzhao-redesign${embedded ? ' horosa-huangji-embedded' : ''}${this.state.panelWide ? ' is-panel-wide' : ''}`} style={pageStyle}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-huangji-redesign-layout">
					<Spin spinning={this.state.loading}>
						<div className="horosa-astro-redesign-grid horosa-huangji-redesign-grid">
							<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-huangji-input-panel">
								{this.renderInputPanel()}
							</div>
							<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-huangji-chart-panel xq-chart-renderer">
								<div className="horosa-huangji-board-host">{this.renderCenter()}</div>
							</div>
							<div className="horosa-inspector-panel horosa-astro-content-panel horosa-huangji-info-panel">
								<div className="horosa-side-panel-heading horosa-huangji-info-heading-main">
									<div>
										<div className="horosa-side-panel-title">五兆信息</div>
										<div className="horosa-side-panel-subtitle">六位与标记</div>
									</div>
								</div>
								{this.renderRightPanel()}
							</div>
						</div>
					</Spin>
					{!this.props.hideQuickDock && this.renderBottomQuickDock()}
				</div>
			</div>
		);
	}
}

export default WuZhaoMain;
