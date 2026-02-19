import { Component } from 'react';
import { Row, Col, Card, Select, Button, Divider, Spin, Tag, message } from 'antd';
import { saveModuleAISnapshot, loadModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import {
	setNongliLocalCache,
	setJieqiSeedLocalCache,
} from '../../utils/localCalcCache';
import {
} from '../../utils/localNongliAdapter';
import {
	fetchPreciseNongli,
	fetchPreciseJieqiSeed,
	warmupCache,
} from '../../utils/preciseCalcBridge';
import sealedImage from '../../assets/sealed.png';
import GeoCoordModal from '../amap/GeoCoordModal';
import PlusMinusTime from '../astro/PlusMinusTime';
import DateTime from '../comp/DateTime';
import { convertLatToStr, convertLonToStr } from '../astro/AstroHelper';
import { getStore } from '../../utils/storageutil';
import {
	SEX_OPTIONS,
	PAIPAN_OPTIONS,
	ZHISHI_OPTIONS,
	YUEJIA_QIJU_OPTIONS,
	QIJU_METHOD_OPTIONS,
	KONG_MODE_OPTIONS,
	MA_MODE_OPTIONS,
	YIXING_OPTIONS,
	calcDunJia,
	buildDunJiaSnapshotText,
} from './DunJiaCalc';

const { Option } = Select;
const FENGJU_OPTIONS = [
	{ value: 0, label: '未封局' },
	{ value: 1, label: '已封局' },
];
const DEFAULT_OPTIONS = {
	sex: 1,
	dateType: 0,
	leapMonthType: 0,
	xuShiSuiType: 0,
	jieQiType: 1,
	paiPanType: 3,
	zhiShiType: 0,
	yueJiaQiJuType: 1,
	yearGanZhiType: 2,
	monthGanZhiType: 1,
	dayGanZhiType: 0,
	qijuMethod: 'zhirun',
	kongMode: 'day',
	yimaMode: 'day',
	shiftPalace: 0,
	fengJu: false,
};

const DUNJIA_BOARD_BASE_WIDTH = 662;
const DUNJIA_BOARD_BASE_HEIGHT = 870;
const DUNJIA_BOARD_BASE = 662;
const DUNJIA_SCALE_MIN = 0.45;
const DUNJIA_SCALE_MAX = 1.35;
const DUNJIA_VERTICAL_RESERVED = 180;
const DUNJIA_WIDTH_PADDING = 22;
const DUNJIA_FONT_STACK = "'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', 'Source Han Sans SC', sans-serif";

// 根据窗口高度动态计算面板最大尺寸
function getDynamicDunjiaMax(viewportHeight) {
	// 高度优先：可用高度 = 窗口高度 - 顶部和底部边距(约200px)
	const availableHeight = viewportHeight - 220;
	// 左侧盘面区域约占整页 16/24，默认按 0.66 估算宽度上限。
	const maxByWidth = typeof window !== 'undefined' && window.innerWidth
		? Math.round(window.innerWidth * 0.66)
		: 800;
	// 取两者的较小值，但不超过1100
	return Math.min(Math.max(availableHeight, 500), maxByWidth, 1100);
}

function clamp(val, min, max){
	return Math.max(min, Math.min(max, val));
}

function getViewportHeight(){
	if(typeof window !== 'undefined' && window.visualViewport && Number.isFinite(window.visualViewport.height) && window.visualViewport.height > 0){
		return Math.round(window.visualViewport.height);
	}
	if(typeof window !== 'undefined' && Number.isFinite(window.innerHeight) && window.innerHeight > 0){
		return window.innerHeight;
	}
	if(typeof document !== 'undefined' && document.documentElement){
		return document.documentElement.clientHeight || 900;
	}
	return 900;
}

function safe(v, d = ''){
	return v === undefined || v === null ? d : v;
}

function getFieldKey(fields){
	if(!fields || !fields.date || !fields.time){
		return '';
	}
	return [
		fields.date.value.format('YYYY-MM-DD'),
		fields.time.value.format('HH:mm:ss'),
		safe(fields.zone && fields.zone.value),
		safe(fields.lon && fields.lon.value),
		safe(fields.lat && fields.lat.value),
		safe(fields.ad && fields.ad.value),
		safe(fields.gender && fields.gender.value),
	].join('|');
}

function getNongliKey(nongli){
	if(!nongli){
		return '';
	}
	return [
		safe(nongli.yearGanZi),
		safe(nongli.monthGanZi),
		safe(nongli.dayGanZi),
		safe(nongli.time),
		safe(nongli.jieqi),
		safe(nongli.runyear),
	].join('|');
}

function getQimenOptionsKey(options){
	if(!options){
		return '';
	}
	return [
		safe(options.sex),
		safe(options.dateType),
		safe(options.leapMonthType),
		safe(options.xuShiSuiType),
		safe(options.jieQiType),
		safe(options.paiPanType),
		safe(options.zhiShiType),
		safe(options.yueJiaQiJuType),
		safe(options.yearGanZhiType),
		safe(options.monthGanZhiType),
		safe(options.dayGanZhiType),
		safe(options.qijuMethod),
		safe(options.kongMode),
		safe(options.yimaMode),
		safe(options.shiftPalace),
		options.fengJu ? 1 : 0,
	].join('|');
}

function buildWarmupPayload(fields, fallbackGender){
	if(!fields || !fields.date || !fields.time || !fields.zone || !fields.lon || !fields.lat){
		return null;
	}
	const genderValue = (fields.gender && fields.gender.value !== undefined && fields.gender.value !== null)
		? fields.gender.value
		: fallbackGender;
	return {
		date: fields.date.value.format('YYYY-MM-DD'),
		time: fields.time.value.format('HH:mm:ss'),
		zone: fields.zone.value,
		lon: fields.lon.value,
		lat: fields.lat.value,
		gpsLat: fields.gpsLat ? fields.gpsLat.value : '',
		gpsLon: fields.gpsLon ? fields.gpsLon.value : '',
		ad: fields.ad ? fields.ad.value : 1,
		gender: genderValue,
	};
}

function toBirthText(fields){
	if(!fields || !fields.date || !fields.time){
		return '';
	}
	return `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`;
}

function normalizeBirthText(txt){
	return `${txt || ''}`.trim().replace(/\//g, '-');
}

function pickChartNongli(fields, chartWrap){
	if(!chartWrap){
		return null;
	}
	const chart = chartWrap.chart ? chartWrap.chart : chartWrap;
	if(!chart || !chart.nongli){
		return null;
	}
	const params = chartWrap.params || {};
	const birthFromChart = normalizeBirthText(params.birth);
	const birthFromFields = normalizeBirthText(toBirthText(fields));
	if(birthFromChart && birthFromFields && birthFromChart !== birthFromFields){
		return null;
	}
	return chart.nongli;
}

function needJieqiYearSeed(options){
	const opt = options || {};
	return opt.paiPanType === 3 && opt.qijuMethod === 'zhirun';
}

function extractIsDiurnalFromChartProp(val){
	if(!val){
		return null;
	}
	const chart = val.chart ? val.chart : val;
	if(chart && chart.isDiurnal !== undefined && chart.isDiurnal !== null){
		return !!chart.isDiurnal;
	}
	return null;
}

class DunJiaMain extends Component {
	constructor(props){
		super(props);

		this.state = {
			loading: false,
			nongli: null,
			pan: null,
			localFields: null,
			hasPlotted: false,
			rightPanelTab: 'overview',
			leftBoardWidth: 0,
			viewportHeight: getViewportHeight(),
			options: {
				...DEFAULT_OPTIONS,
			},
		};

		this.unmounted = false;
		this.jieqiSeedPromises = {};
		this.jieqiYearSeeds = {};
		this.lastRestoredCaseId = null;
		this.timeHook = {};
		this.lastFieldKey = '';
		this.lastPanSignature = '';
		this.pendingNongli = null;
		this.requestSeq = 0;
		this.panCache = new Map();
		this.resizeObserver = null;
		this.onOptionChange = this.onOptionChange.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.onGenderChange = this.onGenderChange.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.genJieqiParams = this.genJieqiParams.bind(this);
		this.ensureJieqiSeed = this.ensureJieqiSeed.bind(this);
		this.getContext = this.getContext.bind(this);
		this.requestNongli = this.requestNongli.bind(this);
		this.genParams = this.genParams.bind(this);
		this.recalc = this.recalc.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.clickPlot = this.clickPlot.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.restoreOptionsFromCurrentCase = this.restoreOptionsFromCurrentCase.bind(this);
		this.parseCasePayload = this.parseCasePayload.bind(this);
		this.captureLeftBoardHost = this.captureLeftBoardHost.bind(this);
		this.handleWindowResize = this.handleWindowResize.bind(this);
		// 添加一个标志来控制是否允许自动计算
		this.autoRecalcEnabled = false;

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				this.restoreOptionsFromCurrentCase();
				// 遁甲模块改为严格手动起盘：外部字段变化不自动触发计算。
			};
		}
	}

	getCachedPan(fields, nongli, options){
		const ctx = this.getContext(fields);
		const key = [
			getFieldKey(fields),
			getNongliKey(nongli),
			getQimenOptionsKey(options),
			safe(ctx && ctx.isDiurnal, ''),
		].join('|');
		if(this.panCache.has(key)){
			return this.panCache.get(key);
		}
		const pan = calcDunJia(fields, nongli, options, ctx);
		this.panCache.set(key, pan);
		if(this.panCache.size > 64){
			const firstKey = this.panCache.keys().next().value;
			if(firstKey){
				this.panCache.delete(firstKey);
			}
		}
		return pan;
	}

	// 添加 shouldComponentUpdate 来避免不必要的重新渲染
	shouldComponentUpdate(nextProps, nextState){
		// 总是允许渲染 loading 状态变化
		if(this.state.loading !== nextState.loading){
			return true;
		}
		// 允许 panel 变化
		if(this.state.pan !== nextState.pan){
			return true;
		}
		// 允许 nongli 变化
		if(this.state.nongli !== nextState.nongli){
			return true;
		}
		// 允许 hasPlotted 变化
		if(this.state.hasPlotted !== nextState.hasPlotted){
			return true;
		}
		// 允许 rightPanelTab 变化
		if(this.state.rightPanelTab !== nextState.rightPanelTab){
			return true;
		}
		// 允许 localFields 时间变化（这是用户主动调整时间）
		if(this.state.localFields !== nextState.localFields){
			const curr = this.state.localFields;
			const next = nextState.localFields;
			if(curr && next){
				const currTime = curr.time && curr.time.value ? curr.time.value.format('YYYY-MM-DD HH:mm:ss') : '';
				const nextTime = next.time && next.time.value ? next.time.value.format('YYYY-MM-DD HH:mm:ss') : '';
				if(currTime !== nextTime){
					return true;
				}
			}
		}
		// 允许 viewport 变化
		if(this.state.viewportHeight !== nextState.viewportHeight || this.state.leftBoardWidth !== nextState.leftBoardWidth){
			return true;
		}
		// 允许 options 变化
		if(this.state.options !== nextState.options){
			return true;
		}
		// 其他情况不重新渲染
		return false;
	}

	componentDidMount(){
		this.unmounted = false;
		this.restoreOptionsFromCurrentCase(true);
		window.addEventListener('resize', this.handleWindowResize);
		this.handleWindowResize();
		// 预热缓存：提前加载数据以加速起盘
		const fields = this.props.fields;
		if(fields && fields.zone && fields.lon && fields.lat){
			warmupCache({
				date: fields.date && fields.date.value ? fields.date.value.format('YYYY-MM-DD') : undefined,
				time: fields.time && fields.time.value ? fields.time.value.format('HH:mm:ss') : undefined,
				zone: fields.zone.value || '8',
				lon: fields.lon.value || '116.4074',
				lat: fields.lat.value || '39.9042',
				gpsLat: fields.gpsLat ? fields.gpsLat.value : '',
				gpsLon: fields.gpsLon ? fields.gpsLon.value : '',
				ad: fields.ad ? fields.ad.value : 1,
				gender: fields.gender ? fields.gender.value : 1,
			}, { mode: 'light' });
		}
	}

	componentDidUpdate(prevProps){
		// 只有在特定情况下才恢复选项，避免不必要的数据读取
		// 主要是避免时间变化时触发不必要的处理
		const prevKey = getFieldKey(prevProps.fields);
		const nextKey = getFieldKey(this.props.fields);
		// 只有当字段完全改变（非时间调整）时才恢复选项
		if(prevKey !== nextKey && this.autoRecalcEnabled){
			this.restoreOptionsFromCurrentCase();
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		window.removeEventListener('resize', this.handleWindowResize);
		if(this.resizeObserver){
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
	}

	captureLeftBoardHost(node){
		if(this.resizeObserver){
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
		this.leftBoardHost = node || null;
		if(this.leftBoardHost && typeof ResizeObserver !== 'undefined'){
			this.resizeObserver = new ResizeObserver(()=>{
				this.handleWindowResize();
			});
			this.resizeObserver.observe(this.leftBoardHost);
		}
		this.handleWindowResize();
	}

	handleWindowResize(){
		const viewportHeight = getViewportHeight();
		// 如果leftBoardHost还没有设置，使用窗口宽度的默认值
		let leftBoardWidth = 0;
		if (this.leftBoardHost) {
			leftBoardWidth = this.leftBoardHost.clientWidth || 0;
		} else if (typeof window !== 'undefined') {
			// 左侧盘面区域约占整页 16/24，取 0.66 作为跨浏览器一致的兜底值。
			leftBoardWidth = Math.round(window.innerWidth * 0.66) || 700;
		}
		// 降低阈值使窗口大小变化时更敏感地更新缩放
		const changed = Math.abs((this.state.leftBoardWidth || 0) - leftBoardWidth) >= 1
			|| Math.abs((this.state.viewportHeight || 0) - viewportHeight) >= 1;
		if(changed){
			this.setState({
				leftBoardWidth,
				viewportHeight,
			});
		}
	}

	calcBoardScale(panelHeight){
		const viewH = this.state.viewportHeight || 900;
		const baseH = typeof panelHeight === 'number' ? panelHeight : (viewH - 20);
		const usableH = Math.min(viewH, baseH);
		const dynamicMax = getDynamicDunjiaMax(usableH);
		const availW = this.state.leftBoardWidth > 0 ? (this.state.leftBoardWidth - DUNJIA_WIDTH_PADDING) : dynamicMax;
		const widthScale = availW / DUNJIA_BOARD_BASE_WIDTH;
		// 高度优先：先按可视高度给出主缩放，再用宽度做上限约束。
		let rawScale = (usableH - DUNJIA_VERTICAL_RESERVED) / DUNJIA_BOARD_BASE_HEIGHT;
		if(Number.isFinite(widthScale) && widthScale > 0){
			rawScale = Math.min(rawScale, widthScale);
		}
		if(!Number.isFinite(rawScale) || rawScale <= 0){
			return 1;
		}
		// 使用基于高度动态计算的最大缩放比例
		const heightBasedScale = (usableH - (DUNJIA_VERTICAL_RESERVED - 30)) / DUNJIA_BOARD_BASE_HEIGHT;
		const dynamicMaxScale = Math.min(heightBasedScale, DUNJIA_SCALE_MAX);
		return clamp(rawScale, DUNJIA_SCALE_MIN, dynamicMaxScale);
	}

	parseCasePayload(raw){
		if(!raw){
			return null;
		}
		if(typeof raw === 'string'){
			try{
				return JSON.parse(raw);
			}catch(e){
				return null;
			}
		}
		if(typeof raw === 'object'){
			return raw;
		}
		return null;
	}

	restoreOptionsFromCurrentCase(force){
		const store = getStore();
		const userState = store && store.user ? store.user : null;
		const currentCase = userState && userState.currentCase ? userState.currentCase : null;
		if(!currentCase || !currentCase.cid || !currentCase.cid.value){
			return;
		}
		const cid = `${currentCase.cid.value}`;
		const updateTime = currentCase.updateTime && currentCase.updateTime.value ? `${currentCase.updateTime.value}` : '';
		const caseVersion = `${cid}|${updateTime}`;
		if(!force && this.lastRestoredCaseId === caseVersion){
			return;
		}
		const sourceModule = currentCase.sourceModule ? currentCase.sourceModule.value : null;
		const caseType = currentCase.caseType ? currentCase.caseType.value : null;
		if(sourceModule !== 'qimen' && caseType !== 'qimen'){
			return;
		}
		const payload = this.parseCasePayload(currentCase.payload ? currentCase.payload.value : null);
		if(!payload){
			return;
		}
		const nextOptions = {
			...this.state.options,
		};
		let changed = false;
		const savedOptions = payload.options && typeof payload.options === 'object' ? payload.options : null;
		if(savedOptions){
			Object.keys(DEFAULT_OPTIONS).forEach((key)=>{
				if(savedOptions[key] !== undefined){
					nextOptions[key] = savedOptions[key];
					changed = true;
				}
			});
		}
		const pan = payload.pan && typeof payload.pan === 'object' ? payload.pan : null;
		if(pan){
			if(pan.shiftPalace !== undefined){
				nextOptions.shiftPalace = pan.shiftPalace;
				changed = true;
			}
			if(pan.fengJu !== undefined){
				nextOptions.fengJu = !!pan.fengJu;
				changed = true;
			}
		}
		this.lastRestoredCaseId = caseVersion;
		if(!changed){
			return;
		}
		this.setState({
			options: nextOptions,
		}, ()=>{
			if(this.state.hasPlotted && this.state.nongli){
				this.recalc(this.state.localFields || this.props.fields, this.state.nongli, nextOptions);
			}
		});
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

	onTimeChanged(value){
		const dt = value.time;
		const confirmed = !!value.confirmed;

		// 严格手动起盘：时间调整仅更新本地字段，不触发全局 fetchByFields。
		if(confirmed){
			const base = this.props.fields || {};
			const localFields = {
				...base,
				date: { value: dt.clone() },
				time: { value: dt.clone() },
				ad: { value: dt.ad },
				zone: { value: dt.zone },
			};
			this.setState({ localFields });
			const warmupParams = buildWarmupPayload(localFields, this.state.options.sex);
			if(warmupParams){
				warmupCache(warmupParams, { mode: 'light', immediate: true });
			}
		}
	}

	onGenderChange(val){
		this.onOptionChange('sex', val);
		this.onFieldsChange({
			gender: { value: val },
		});
	}

	getTimeFieldsFromSelector(baseFields){
		if(!this.timeHook || typeof this.timeHook.getValue !== 'function'){
			return null;
		}
		const draft = this.timeHook.getValue();
		if(!draft || !draft.value || !(draft.value instanceof DateTime)){
			return null;
		}
		const dt = draft.value;
		return {
			...(baseFields || this.state.localFields || this.props.fields || {}),
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		};
	}

	clickPlot(){
		if(this.state.loading){
			return;
		}
		const timeFields = this.getTimeFieldsFromSelector(this.state.localFields || this.props.fields);
		const nextFields = timeFields || this.state.localFields || this.props.fields;
		if(!nextFields){
			return;
		}
		const warmupParams = buildWarmupPayload(nextFields, this.state.options.sex);
		if(warmupParams){
			warmupCache(warmupParams, { mode: 'light', immediate: true });
		}
		this.setState({
			loading: true,
			hasPlotted: true,
			localFields: nextFields,
		}, ()=>{
			this.requestNongli(nextFields, true);
		});
	}

	changeGeo(rec){
		this.onFieldsChange({
			lon: { value: convertLonToStr(rec.lng) },
			lat: { value: convertLatToStr(rec.lat) },
			gpsLon: { value: rec.gpsLng },
			gpsLat: { value: rec.gpsLat },
		});
	}

	genParams(fields){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds){
			return null;
		}
		const genderValue = (flds.gender && flds.gender.value !== undefined && flds.gender.value !== null)
			? flds.gender.value
			: this.state.options.sex;
		const zoneValue = flds.zone && flds.zone.value !== undefined && flds.zone.value !== null
			? flds.zone.value
			: 8;
		const adValue = flds.ad && flds.ad.value !== undefined && flds.ad.value !== null
			? flds.ad.value
			: 1;
		return {
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm:ss'),
			zone: zoneValue,
			lon: flds.lon ? flds.lon.value : '',
			lat: flds.lat ? flds.lat.value : '',
			gpsLat: flds.gpsLat ? flds.gpsLat.value : '',
			gpsLon: flds.gpsLon ? flds.gpsLon.value : '',
			ad: adValue,
			gender: genderValue,
			after23NewDay: 0,
		};
	}

	recalc(fields, nongli, options){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds || !nongli){
			return;
		}
		const fixedOptions = {
			...(options || this.state.options),
			jieQiType: 1,
			yearGanZhiType: 2,
			monthGanZhiType: 1,
			dayGanZhiType: 1,
		};
		const panSignature = [
			getFieldKey(flds),
			getNongliKey(nongli || this.state.nongli),
			getQimenOptionsKey(fixedOptions),
			safe(this.getContext(flds).isDiurnal, ''),
		].join('|');
		if(this.state.pan && panSignature === this.lastPanSignature){
			return;
		}
		const pan = this.getCachedPan(flds, nongli || this.state.nongli, fixedOptions);
		this.lastPanSignature = panSignature;
		this.setState({ pan }, ()=>{
			if(pan){
				saveModuleAISnapshot('qimen', buildDunJiaSnapshotText(pan));
			}
		});
	}

	genJieqiParams(fields, year){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds){
			return null;
		}
		return {
			year: `${year}`,
			ad: flds.ad ? flds.ad.value : 1,
			zone: flds.zone.value,
			lon: flds.lon.value,
			lat: flds.lat.value,
			gpsLat: flds.gpsLat.value,
			gpsLon: flds.gpsLon.value,
			hsys: 0,
			zodiacal: 0,
			doubingSu28: false,
		};
	}

	getContext(fields){
		const flds = fields || this.state.localFields || this.props.fields;
		let year = null;
		if(flds && flds.date && flds.date.value){
			year = parseInt(flds.date.value.format('YYYY'), 10);
		}
		return {
			year,
			jieqiYearSeeds: this.jieqiYearSeeds,
			isDiurnal: extractIsDiurnalFromChartProp(this.props.value),
		};
	}

	async ensureJieqiSeed(fields, year){
		if(!year || Number.isNaN(year)){
			return null;
		}
		if(this.jieqiYearSeeds[year]){
			return this.jieqiYearSeeds[year];
		}
		if(this.jieqiSeedPromises[year]){
			return this.jieqiSeedPromises[year];
		}
		const params = this.genJieqiParams(fields, year);
		if(!params){
			return null;
		}
		this.jieqiSeedPromises[year] = Promise.resolve().then(async()=>{
			let seed = await fetchPreciseJieqiSeed(params);
			if(seed){
				this.jieqiYearSeeds[year] = seed;
				setJieqiSeedLocalCache(params, seed);
			}
			return seed;
		}).finally(()=>{
			delete this.jieqiSeedPromises[year];
		});
		return this.jieqiSeedPromises[year];
	}

	async requestNongli(fields, force){
		const fldsToUse = fields || this.state.localFields || this.props.fields;
		let params = null;
		try{
			params = this.genParams(fldsToUse);
		}catch(e){
			this.setState({ loading: false });
			message.error('遁甲起盘参数无效，请确认时间与经纬度后重试');
			return;
		}
		if(!params){
			this.setState({ loading: false });
			return;
		}
		const fieldKey = getFieldKey(fldsToUse);
		if(!force && this.state.nongli && fieldKey && fieldKey === this.lastFieldKey){
			this.recalc(fldsToUse, this.state.nongli);
			return;
		}
		if(!force && this.pendingNongli && this.pendingNongli.key === fieldKey){
			return this.pendingNongli.promise;
		}
		const seq = ++this.requestSeq;

		const reqPromise = (async ()=>{
			const fixedOptions = {
				...this.state.options,
				jieQiType: 1,
				yearGanZhiType: 2,
				monthGanZhiType: 1,
				dayGanZhiType: 1,
			};
			const shouldWaitSeed = needJieqiYearSeed(fixedOptions);
			try{
				const chartNongli = pickChartNongli(fldsToUse, this.props.value);
				let result = chartNongli;
				if(!result){
					result = await fetchPreciseNongli(params);
				}
				if(!result){
					throw new Error('precise.nongli.unavailable');
				}
				setNongliLocalCache(params, result);
				if(this.unmounted || seq !== this.requestSeq){
					return;
				}
				const flds = fldsToUse;
				let year = null;
				if(flds && flds.date && flds.date.value){
					year = parseInt(flds.date.value.format('YYYY'), 10);
				}
				if(this.unmounted || seq !== this.requestSeq){
					return;
				}
				// 移除不必要的延迟以提升性能
				// await new Promise((resolve)=>setTimeout(resolve, 0));
				if(this.unmounted || seq !== this.requestSeq){
					return;
				}
				const panSignature = [
					getFieldKey(flds),
					getNongliKey(result),
					getQimenOptionsKey(fixedOptions),
					safe(this.getContext(flds).isDiurnal, ''),
				].join('|');
				const pan = this.getCachedPan(flds, result, fixedOptions);
				this.lastFieldKey = fieldKey;
				this.lastPanSignature = panSignature;
				this.setState({
					nongli: result,
					pan,
					loading: false,
				}, ()=>{
					if(pan){
						saveModuleAISnapshot('qimen', buildDunJiaSnapshotText(pan));
					}
				});
				if(year && shouldWaitSeed){
					Promise.all([
						this.ensureJieqiSeed(flds, year - 1),
						this.ensureJieqiSeed(flds, year),
					]).then((seeds)=>{
						if(this.unmounted || seq !== this.requestSeq){
							return;
						}
						if(seeds && seeds[0] && seeds[1]){
							this.recalc(flds, result, fixedOptions);
						}
					}).catch(()=>{});
				}
			}catch(e){
				if(!this.unmounted && seq === this.requestSeq){
					this.setState({ loading: false });
					message.error('遁甲计算失败：精确历法服务不可用');
				}
			}finally{
				if(this.pendingNongli && this.pendingNongli.key === fieldKey && seq === this.requestSeq){
					this.pendingNongli = null;
				}
			}
		})();
		this.pendingNongli = {
			key: fieldKey,
			promise: reqPromise,
		};
		return reqPromise;
	}

	onOptionChange(key, value){
		const options = {
			...this.state.options,
			[key]: value,
		};
		this.setState({ options }, ()=>{
			if(this.state.hasPlotted && this.state.nongli){
				this.recalc(this.state.localFields || this.props.fields, this.state.nongli, options);
			}
		});
	}

	clickSaveCase(){
		const pan = this.state.pan;
		if(!pan){
			message.warning('请先起盘后再保存');
			return;
		}
		const flds = this.state.localFields || this.props.fields;
		if(!flds){
			return;
		}
		const divTime = `${flds.date.value.format('YYYY-MM-DD')} ${flds.time.value.format('HH:mm:ss')}`;
		const snapshot = loadModuleAISnapshot('qimen');
		const payload = {
			module: 'qimen',
			snapshot: snapshot,
			pan: pan,
			options: {
				...this.state.options,
				fengJu: !!this.state.options.fengJu,
			},
		};
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caseadd',
					record: {
						event: `奇门占断 ${divTime}`,
						caseType: 'qimen',
						divTime: divTime,
						zone: flds.zone.value,
						lat: flds.lat.value,
						lon: flds.lon.value,
						gpsLat: flds.gpsLat.value,
						gpsLon: flds.gpsLon.value,
						pos: flds.pos ? flds.pos.value : '',
						payload: payload,
						sourceModule: 'qimen',
					},
				},
			});
		}
	}

	renderCell(cell, metrics){
		const titleColor = cell.hasKongWang ? '#2f54eb' : (cell.isCenter ? '#c7c7c7' : '#5f5f5f');
		let tianGanColor = '#262626';
		if(cell.hasJiXing && cell.hasRuMu){
			tianGanColor = '#722ed1';
		}else if(cell.hasJiXing){
			tianGanColor = '#cf1322';
		}else if(cell.hasRuMu){
			tianGanColor = '#8b5e3c';
		}
		// 八神不跟随值符或天盘干状态染色，保持独立显示。
		const godColor = '#262626';
		const line2Color = cell.hasMenPo ? '#fa8c16' : '#262626';
		const line3Color = '#262626';
		const diGanColor = '#262626';
		const centerMinorColor = '#8c8c8c';
		const cellSize = metrics.cellSize;
		const unifiedFont = metrics.unifiedFont;
		const insetX = metrics.insetX;
		const insetY = metrics.insetY;
		const isGenPalace = cell.palaceNum === 7 || cell.palaceName === '艮';
		const smallFontSize = metrics.smallFontSize;
		const palaceFontSize = metrics.palaceFontSize;
		const centerFontSize = metrics.centerFontSize;
		const cornerGap = metrics.cornerGap;
		const yiMaStyle = isGenPalace
			? { position: 'absolute', left: Math.max(4, Math.round(cornerGap * 0.8)), bottom: Math.max(4, Math.round(cornerGap * 0.66)), fontSize: smallFontSize, lineHeight: `${smallFontSize}px`, color: '#111' }
			: { position: 'absolute', top: Math.max(4, Math.round(cornerGap * 0.66)), right: Math.max(4, Math.round(cornerGap * 0.8)), fontSize: smallFontSize, lineHeight: `${smallFontSize}px`, color: '#111' };

		const palacePosMap = {
			1: { right: cornerGap, bottom: Math.max(4, Math.round(cornerGap * 0.66)) }, // 巽：靠中宫（右下）
			2: { left: '50%', bottom: Math.max(4, Math.round(cornerGap * 0.66)), transform: 'translateX(-50%)' }, // 离：靠中宫（下中）
			3: { left: cornerGap, bottom: Math.max(4, Math.round(cornerGap * 0.66)) }, // 坤：靠中宫（左下）
			4: { right: cornerGap, top: '50%', transform: 'translateY(-50%)' }, // 震：靠中宫（右中）
			6: { left: cornerGap, top: '50%', transform: 'translateY(-50%)' }, // 兑：靠中宫（左中）
			7: { right: cornerGap, top: Math.max(4, Math.round(cornerGap * 0.66)) }, // 艮：靠中宫（右上）
			8: { left: '50%', top: Math.max(4, Math.round(cornerGap * 0.66)), transform: 'translateX(-50%)' }, // 坎：靠中宫（上中）
			9: { left: cornerGap, top: Math.max(4, Math.round(cornerGap * 0.66)) }, // 乾：靠中宫（左上）
		};
		const palaceStyle = palacePosMap[cell.palaceNum] || null;
		const wuHeMap = {
			甲: '己',
			乙: '庚',
			丙: '辛',
			丁: '壬',
			戊: '癸',
			己: '甲',
			庚: '乙',
			辛: '丙',
			壬: '丁',
			癸: '戊',
		};
		const centerGan = cell.tianGan || cell.diGan || '';
		const centerHeGan = centerGan ? (wuHeMap[centerGan] || '') : '';
		const centerItems = [];
		if(centerGan){
			centerItems.push({ text: centerGan, color: centerMinorColor });
		}
		if(centerHeGan){
			centerItems.push({ text: `五合${centerHeGan}`, color: centerMinorColor });
		}

		if(cell.isCenter){
			return (
				<div
					key={`cell_${cell.palaceNum}`}
					style={{
						background: '#f6f6f6',
						borderRadius: Math.max(7, Math.round(cellSize * 0.065)),
						border: '1px solid #ececec',
						height: cellSize,
						padding: 0,
						position: 'relative',
					}}
				>
					<div
						style={{
							position: 'absolute',
							left: '50%',
							top: '50%',
							transform: 'translate(-50%, -50%)',
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							gap: Math.max(1, Math.round(centerFontSize * 0.12)),
						}}
					>
						{centerItems.map((item, idx)=>(
							<div
								key={`center_item_${idx}`}
								style={{
									fontSize: centerFontSize,
									lineHeight: `${centerFontSize}px`,
									fontWeight: 700,
									color: item.color,
								}}
							>
								{item.text}
							</div>
						))}
					</div>
				</div>
			);
		}

		return (
			<div
				key={`cell_${cell.palaceNum}`}
				style={{
					background: '#f6f6f6',
					borderRadius: Math.max(7, Math.round(cellSize * 0.065)),
					border: '1px solid #ececec',
					height: cellSize,
					padding: 0,
					position: 'relative',
				}}
			>
					{cell.isYiMa && (
						<div style={yiMaStyle}>🐎</div>
					)}

				<div
					style={{
							position: 'absolute',
								left: insetX,
								top: insetY,
							fontSize: unifiedFont,
							lineHeight: `${unifiedFont}px`,
							color: tianGanColor,
							fontWeight: 700,
						}}
					>
						{cell.tianGan || ' '}
				</div>
				<div
					style={{
							position: 'absolute',
								left: insetX,
								bottom: insetY,
							fontSize: unifiedFont,
							lineHeight: `${unifiedFont}px`,
							color: diGanColor,
							fontWeight: 700,
						}}
					>
						{cell.diGan || ' '}
				</div>
				<div
					style={{
							position: 'absolute',
								right: insetX,
								top: insetY,
							fontSize: unifiedFont,
							lineHeight: `${unifiedFont}px`,
							color: godColor,
							fontWeight: 700,
						}}
					>
						{cell.god || ' '}
				</div>
				<div
					style={{
						position: 'absolute',
							right: insetX,
							bottom: insetY,
						fontSize: unifiedFont,
						lineHeight: `${unifiedFont}px`,
						color: line3Color,
						fontWeight: 700,
					}}
				>
					{cell.tianXing || ' '}
				</div>
				<div
					style={{
						position: 'absolute',
						left: '50%',
						top: '50%',
						transform: 'translate(-50%, -50%)',
						fontSize: unifiedFont,
						lineHeight: `${unifiedFont}px`,
						color: line2Color,
						fontWeight: 700,
					}}
				>
					{cell.door || ' '}
				</div>

				{!!palaceStyle && (
					<div
						style={{
							position: 'absolute',
							color: titleColor,
							fontSize: palaceFontSize,
							lineHeight: `${palaceFontSize}px`,
							fontWeight: 700,
							...palaceStyle,
						}}
					>
						{cell.palaceName}
					</div>
				)}
			</div>
		);
	}

	renderBoard(panelHeight){
		const pan = this.state.pan;
		if(!this.state.hasPlotted){
			return <Card bordered={false}>点击右侧“起盘”后显示遁甲盘</Card>;
		}
		if(!pan){
			return <Card bordered={false}>暂无遁甲盘数据</Card>;
		}
		const boardScale = this.calcBoardScale(panelHeight);
		const cellSize = clamp(Math.round(214 * boardScale), 92, 288);
		const boardGap = clamp(Math.round(10 * boardScale), 4, 16);
		const boardWidth = (cellSize * 3) + (boardGap * 2);
		const unifiedFont = clamp(Math.round(34 * boardScale), 16, 42);
		const metrics = {
			cellSize,
			unifiedFont,
			insetX: clamp(Math.round(52 * boardScale), 18, 72),
			insetY: clamp(Math.round(40 * boardScale), 14, 58),
			smallFontSize: clamp(Math.round(20 * boardScale), 9, 24),
			palaceFontSize: clamp(Math.round(15 * boardScale), 8, 20),
			centerFontSize: clamp(Math.round(32 * boardScale), 14, 40),
			cornerGap: clamp(Math.round(12 * boardScale), 4, 17),
		};
		const titleFont = clamp(Math.round(18 * boardScale), 12, 24);
		const shiftFont = clamp(Math.round(16 * boardScale), 11, 22);
		const pillarFont = clamp(Math.round(32 * boardScale), 14, 40);
		const pillarLabelFont = clamp(Math.round(24 * boardScale), 11, 32);
		const lineFont = clamp(Math.round(16 * boardScale), 11, 20);
		const lineSubFont = clamp(Math.round(14 * boardScale), 10, 18);
		const dateTitle = `${pan.dateStr.substr(0, 4)}年${pan.dateStr.substr(5, 2)}月${pan.dateStr.substr(8, 2)}日 ${pan.timeStr.substr(0, 5)}`;
		const shiftTitle = pan && pan.shiftPalace > 0 ? `（顺转${pan.shiftPalace}宫）` : '';
		const pillars = [
			{
				key: 'year',
				label: '年',
				gan: (pan.ganzhi.year || '').substr(0, 1),
				zhi: (pan.ganzhi.year || '').substr(1, 1),
				ganColor: '#cf1322',
				zhiColor: '#cf1322',
			},
			{
				key: 'month',
				label: '月',
				gan: (pan.ganzhi.month || '').substr(0, 1),
				zhi: (pan.ganzhi.month || '').substr(1, 1),
				ganColor: '#d48806',
				zhiColor: '#5aa469',
			},
			{
				key: 'day',
				label: '日',
				gan: (pan.ganzhi.day || '').substr(0, 1),
				zhi: (pan.ganzhi.day || '').substr(1, 1),
				ganColor: '#2f54eb',
				zhiColor: '#9c6b30',
			},
			{
				key: 'time',
				label: '时',
				gan: (pan.ganzhi.time || '').substr(0, 1),
				zhi: (pan.ganzhi.time || '').substr(1, 1),
				ganColor: '#9c6b30',
				zhiColor: '#d48806',
			},
		];
		return (
			<Card bordered={false}>
				<div style={{ width: boardWidth }}>
					<div style={{ width: boardWidth, fontFamily: DUNJIA_FONT_STACK }}>
						<div
							style={{
								padding: clamp(Math.round(12 * boardScale), 7, 16),
								borderRadius: clamp(Math.round(14 * boardScale), 8, 18),
								background: '#fbfbfb',
								border: '1px solid #efefef',
								marginBottom: clamp(Math.round(8 * boardScale), 5, 12),
								width: boardWidth,
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
								<div style={{ fontSize: titleFont, lineHeight: `${Math.round(titleFont * 1.2)}px`, fontWeight: 700, color: '#222' }}>
									{dateTitle}
								</div>
								{shiftTitle ? (
									<div style={{ fontSize: shiftFont, lineHeight: `${Math.round(shiftFont * 1.2)}px`, fontWeight: 700, color: '#595959' }}>
										{shiftTitle}
									</div>
								) : null}
							</div>
							<div
								style={{
									marginTop: 6,
									display: 'flex',
									alignItems: 'flex-end',
									gap: 14,
								}}
							>
								{pillars.map((p)=>(
									<div key={`pillar_${p.key}`} style={{ display: 'flex', alignItems: 'center' }}>
										<div
											style={{
												display: 'flex',
												flexDirection: 'column',
												alignItems: 'center',
												lineHeight: 1,
												fontWeight: 700,
												fontSize: pillarFont,
											}}
										>
											<span style={{ color: p.ganColor }}>{p.gan || ' '}</span>
											<span style={{ color: p.zhiColor, marginTop: Math.max(1, Math.round(pillarFont * 0.12)) }}>{p.zhi || ' '}</span>
										</div>
										<span
											style={{
												marginLeft: Math.max(3, Math.round(6 * boardScale)),
												color: '#8c8c8c',
												fontSize: pillarLabelFont,
												lineHeight: 1,
												fontWeight: 700,
											}}
										>
											{p.label}
										</span>
									</div>
								))}
							</div>
							<div style={{ marginTop: Math.max(3, Math.round(6 * boardScale)), fontSize: lineFont, lineHeight: `${Math.round(lineFont * 1.2)}px`, fontWeight: 700, color: '#202020' }}>
								{pan.juText} 值符:{pan.zhiFu} 值使:{pan.zhiShi}
							</div>
							<div style={{ marginTop: Math.max(2, Math.round(4 * boardScale)), fontSize: lineSubFont, lineHeight: `${Math.round(lineSubFont * 1.2)}px`, color: '#595959' }}>
								{pan.options.kongModeLabel}-{pan.kongWang} 旬首-{pan.xunShou}
							</div>
						</div>
						<div style={{ position: 'relative', width: boardWidth }}>
							<div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${cellSize}px)`, gap: boardGap }}>
								{pan.cells.map((cell)=>this.renderCell(cell, metrics))}
							</div>
							{pan.fengJu ? (
								<div
									style={{
										position: 'absolute',
										left: '50%',
										top: '50%',
										transform: 'translate(-50%, -50%)',
										width: '62%',
										maxWidth: Math.round(boardWidth * 0.65),
										opacity: 0.22,
										pointerEvents: 'none',
										zIndex: 9,
									}}
								>
									<img src={sealedImage} alt="雷霆都司印章" style={{ width: '100%', height: 'auto', display: 'block' }} />
								</div>
							) : null}
						</div>
						<div style={{ marginTop: 12 }}>
							<Tag color="red">击刑</Tag>
							<Tag color="#8b5e3c">入墓</Tag>
							<Tag color="#722ed1">击刑+入墓</Tag>
							<Tag color="orange">门迫</Tag>
							<Tag color="blue">空亡</Tag>
							<Tag color="default">🐎 驿马</Tag>
						</div>
					</div>
				</div>
			</Card>
		);
	}

	renderRight(){
		const pan = this.state.pan;
		const opt = this.state.options;
		const panelTab = this.state.rightPanelTab;
		const fields = this.state.localFields || this.props.fields || {};
		let datetm = new DateTime();
		if(fields.date && fields.time){
			const str = `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`;
			datetm = datetm.parse(str, 'YYYY-MM-DD HH:mm:ss');
			if(fields.zone){
				datetm.setZone(fields.zone.value);
			}
		}
		return (
			<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
				<div style={{ paddingBottom: 6, borderBottom: '1px solid #f0f0f0' }}>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
						<div>
							<PlusMinusTime value={datetm} onChange={this.onTimeChanged} hook={this.timeHook} />
						</div>

						<div style={{ display: 'flex', gap: 4 }}>
							<div style={{ flex: 1 }}>
								<Select size="small" value={opt.kongMode} onChange={(v)=>this.onOptionChange('kongMode', v)} style={{ width: '100%' }}>
									{KONG_MODE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div style={{ flex: 1 }}>
								<Select size="small" value={opt.yimaMode} onChange={(v)=>this.onOptionChange('yimaMode', v)} style={{ width: '100%' }}>
									{MA_MODE_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div style={{ flex: 1 }}>
								<Select size="small" value={opt.qijuMethod} disabled={opt.paiPanType !== 3} onChange={(v)=>this.onOptionChange('qijuMethod', v)} style={{ width: '100%' }}>
									{QIJU_METHOD_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div style={{ flex: 1 }}>
								<Select size="small" value={opt.sex} onChange={this.onGenderChange} style={{ width: '100%' }}>
									{SEX_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div style={{ flex: 1 }}>
								<Select size="small" value={opt.shiftPalace} onChange={(v)=>this.onOptionChange('shiftPalace', v)} style={{ width: '100%' }}>
									{YIXING_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
						</div>

						<div style={{ display: 'flex', gap: 4 }}>
							<div style={{ flex: 1 }}>
								<Select size="small" value={opt.paiPanType} onChange={(v)=>this.onOptionChange('paiPanType', v)} style={{ width: '100%' }}>
									{PAIPAN_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div style={{ flex: 1 }}>
								<Select size="small" value={opt.zhiShiType} onChange={(v)=>this.onOptionChange('zhiShiType', v)} style={{ width: '100%' }}>
									{ZHISHI_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div style={{ flex: 1 }}>
								<Select size="small" value={opt.yueJiaQiJuType} disabled={opt.paiPanType !== 1} onChange={(v)=>this.onOptionChange('yueJiaQiJuType', v)} style={{ width: '100%' }}>
									{YUEJIA_QIJU_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
						</div>

						<div style={{ display: 'flex', gap: 4 }}>
							<div style={{ flex: 1 }}>
								<GeoCoordModal onOk={this.changeGeo} lat={fields.gpsLat && fields.gpsLat.value} lng={fields.gpsLon && fields.gpsLon.value}>
									<Button size="small" style={{ width: '100%' }}>经纬度选择</Button>
								</GeoCoordModal>
							</div>
							<div style={{ flex: 1 }}>
								<Select size="small" value={opt.fengJu ? 1 : 0} onChange={(v)=>this.onOptionChange('fengJu', v === 1)} style={{ width: '100%' }}>
									{FENGJU_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
								</Select>
							</div>
							<div style={{ flex: 1 }}>
								<Button
									size="small"
									type="primary"
									style={{ width: '100%' }}
									onClick={this.clickPlot}
									loading={this.state.loading}
									disabled={this.state.loading}
								>
									起盘
								</Button>
							</div>
							<div style={{ flex: 1 }}>
								<Button size="small" style={{ width: '100%' }} onClick={this.clickSaveCase}>保存</Button>
							</div>
						</div>
						<div style={{ textAlign: 'right' }}>
							<span>{fields.lon ? fields.lon.value : ''} {fields.lat ? fields.lat.value : ''}</span>
						</div>
					</div>
				</div>

				<div style={{ display: 'flex', gap: 6, marginTop: 8, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
					<Button size="small" type={panelTab === 'overview' ? 'primary' : 'default'} onClick={()=>this.setState({ rightPanelTab: 'overview' })}>概览</Button>
					<Button size="small" type={panelTab === 'status' ? 'primary' : 'default'} onClick={()=>this.setState({ rightPanelTab: 'status' })}>状态</Button>
					<Button size="small" type={panelTab === 'shensha' ? 'primary' : 'default'} onClick={()=>this.setState({ rightPanelTab: 'shensha' })}>神煞</Button>
					<Button size="small" type={panelTab === 'calendar' ? 'primary' : 'default'} onClick={()=>this.setState({ rightPanelTab: 'calendar' })}>历法</Button>
				</div>

				<Card bordered={false} bodyStyle={{ padding: '10px 12px', maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }} style={{ marginTop: 6 }}>
					{panelTab === 'overview' && (
						<div style={{ lineHeight: '26px' }}>
							<div>命式：{pan ? pan.options.sexLabel : '—'}</div>
							<div>符头：{pan ? pan.fuTou : '—'}</div>
							<div>节气：{pan ? pan.jieqiText : '—'}</div>
							<div>局数：{pan ? pan.juText : '—'}</div>
							<div>旬首：{pan ? pan.xunShou : '—'}</div>
							<div>{pan ? pan.options.kongModeLabel : '空亡'}：{pan ? pan.kongWang : '—'}</div>
							<div>值符：{pan ? pan.zhiFu : '—'}</div>
							<div>值使：{pan ? pan.zhiShi : '—'}</div>
							<div>移星：{pan ? (pan.options.shiftLabel || '原宫') : '原宫'}</div>
							<div>奇门封局：{pan ? (pan.options.fengJuLabel || '未封局') : (opt.fengJu ? '已封局' : '未封局')}</div>
						</div>
					)}

					{panelTab === 'status' && (
						<div style={{ lineHeight: '26px' }}>
							<div>六仪击刑：{pan && pan.liuYiJiXing.length ? pan.liuYiJiXing.join('；') : '无'}</div>
							<div>奇仪入墓：{pan && pan.qiYiRuMu.length ? pan.qiYiRuMu.join('；') : '无'}</div>
							<div>门迫：{pan && pan.menPo && pan.menPo.list.length ? pan.menPo.list.join('；') : '无'}</div>
							<div>空亡宫：{pan && pan.kongWangDesc && pan.kongWangDesc.length ? pan.kongWangDesc.join('；') : '无'}</div>
							<div>{pan && pan.yiMa ? pan.yiMa.text : '日马：无'}</div>
						</div>
					)}

					{panelTab === 'shensha' && (
						<div>
							<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', columnGap: 14, rowGap: 6, lineHeight: '24px' }}>
								{pan && pan.shenSha && pan.shenSha.allItems && pan.shenSha.allItems.length
									? pan.shenSha.allItems.map((item)=>(<div key={`ss_item_${item.name}`}><span style={{ color: '#262626' }}>{item.name}-</span><span style={{ color: '#8c8c8c' }}>{item.value}</span></div>))
									: <div>暂无神煞</div>}
							</div>
						</div>
					)}

					{panelTab === 'calendar' && (
						<div style={{ lineHeight: '26px' }}>
							<div>农历：{pan ? pan.lunarText : '—'}</div>
							<div>真太阳时：{pan ? (pan.realSunTime || '—') : '—'}</div>
							<div>干支：{pan ? `年${pan.ganzhi.year} 月${pan.ganzhi.month} 日${pan.ganzhi.day} 时${pan.ganzhi.time}` : '—'}</div>
							<div>节气段：{pan ? (pan.jiedelta || '—') : '—'}</div>
						</div>
					)}
				</Card>
			</div>
		);
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 'calc(100% - 70px)';
		}else{
			height = height - 20;
		}
		return (
			<div style={{ minHeight: height }}>
				<Spin spinning={this.state.loading}>
					<Row gutter={6}>
						<Col span={16}>
							<div ref={this.captureLeftBoardHost}>
								{this.renderBoard(height)}
							</div>
						</Col>
						<Col span={8}>
							{this.renderRight()}
						</Col>
					</Row>
				</Spin>
			</div>
		);
	}
}

export default DunJiaMain;
