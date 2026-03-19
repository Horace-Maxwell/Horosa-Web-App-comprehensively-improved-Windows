import { Component } from 'react';
import { Row, Col, Card, Select, Button, Spin, Tag, Tabs, Tooltip, message } from 'antd';
import { saveModuleAISnapshot, loadModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import {
	getNongliLocalCache,
	setNongliLocalCache,
	setJieqiSeedLocalCache,
} from '../../utils/localCalcCache';
import {
	extractNongliFromChartWrap,
	buildLocalJieqiYearSeed,
} from '../../utils/localNongliAdapter';
import {
	fetchPreciseNongli,
	fetchPreciseJieqiSeed,
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
import {
	QIMEN_TEN_GAN_TOOLTIP_TEXT,
	QIMEN_DOOR_TOOLTIP_TEXT,
	QIMEN_STAR_TOOLTIP_TEXT,
	QIMEN_GOD_TOOLTIP_TEXT,
} from '../../constants/QimenTooltipTexts';
import { renderMarkdownLiteBlock } from '../../utils/markdownLiteReact';
import styles from './DunJiaMain.less';
const { Option } = Select;
const TabPane = Tabs.TabPane;
const FENGJU_OPTIONS = [
	{ value: 0, label: '未封局' },
	{ value: 1, label: '已封局' },
];
const TIME_ALG_OPTIONS = [
	{ value: 0, label: '真太阳时' },
	{ value: 1, label: '直接时间' },
];
const DEFAULT_OPTIONS = {
	sex: 1,
	timeAlg: 0,
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
const DUNJIA_BAGONG_ORDER = [
	{ title: '正北坎宫', palaceNum: 8 },
	{ title: '东北艮宫', palaceNum: 7 },
	{ title: '正东震宫', palaceNum: 4 },
	{ title: '东南巽宫', palaceNum: 1 },
	{ title: '正南离宫', palaceNum: 2 },
	{ title: '西南坤宫', palaceNum: 3 },
	{ title: '正西兑宫', palaceNum: 6 },
	{ title: '西北乾宫', palaceNum: 9 },
];

const DUNJIA_BOARD_BASE_WIDTH = 662;
const DUNJIA_BOARD_BASE_HEIGHT = 870;
const DUNJIA_SCALE_MIN = 0.48;
const DUNJIA_SCALE_MAX = 1.22;
const DUNJIA_FAST_PLOT_TIMEOUT_MS = 650;
const DUNJIA_MIN_HEIGHT = 320;

function clamp(val, min, max){
	return Math.max(min, Math.min(max, val));
}

function getViewportHeight(){
	if(typeof window !== 'undefined' && Number.isFinite(window.innerHeight) && window.innerHeight > 0){
		return window.innerHeight;
	}
	if(typeof document !== 'undefined' && document.documentElement){
		return document.documentElement.clientHeight || 900;
	}
	return 900;
}

function toNumber(val){
	if(typeof val === 'number' && Number.isFinite(val)){
		return val;
	}
	if(typeof val === 'string'){
		const txt = val.trim();
		if(/^[-+]?\d+(\.\d+)?(px)?$/i.test(txt)){
			const n = parseFloat(txt);
			return Number.isFinite(n) ? n : null;
		}
	}
	return null;
}

function resolveBoundedHeight(rawHeight){
	let h = toNumber(rawHeight);
	if(h === null){
		h = getViewportHeight();
	}
	return Math.max(DUNJIA_MIN_HEIGHT, h);
}

function safe(v, d = ''){
	return v === undefined || v === null ? d : v;
}

function formatPatternValue(items){
	return items && items.length ? items.join('\n') : '无';
}

function extractHm(timeText){
	const txt = `${safe(timeText, '')}`.trim();
	if(!txt){
		return '--:--';
	}
	const matched = txt.match(/(\d{1,2}:\d{2})(:\d{2})?/);
	if(!matched || !matched[1]){
		return txt;
	}
	const seg = matched[1].split(':');
	return `${seg[0].padStart(2, '0')}:${seg[1]}`;
}

function normalizeTimeAlg(value){
	return parseInt(value, 10) === 1 ? 1 : 0;
}

function buildDisplaySolarParams(params){
	if(!params){
		return null;
	}
	return {
		...params,
		timeAlg: 0,
	};
}

function parseDateLabel(dateText){
	const txt = `${safe(dateText, '')}`.trim();
	const m = txt.match(/^(\d+)-(\d{1,2})-(\d{1,2})$/);
	if(m){
		return {
			year: m[1],
			month: m[2].padStart(2, '0'),
			day: m[3].padStart(2, '0'),
		};
	}
	const arr = txt.split(/[-/]/).filter(Boolean);
	if(arr.length >= 3){
		return {
			year: arr[0],
			month: arr[1].padStart(2, '0'),
			day: arr[2].padStart(2, '0'),
		};
	}
	return {
		year: '----',
		month: '--',
		day: '--',
	};
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
		safe(fields.timeAlg && fields.timeAlg.value),
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
		safe(options.timeAlg),
		options.fengJu ? 1 : 0,
	].join('|');
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

const QIMEN_TEN_GAN_TEXT = QIMEN_TEN_GAN_TOOLTIP_TEXT;
const QIMEN_DOOR_TEXT = QIMEN_DOOR_TOOLTIP_TEXT;
const QIMEN_STAR_TEXT = QIMEN_STAR_TOOLTIP_TEXT;
const QIMEN_GOD_TEXT = QIMEN_GOD_TOOLTIP_TEXT;

const QIMEN_STATUS_TEXT = {
	击刑: '六仪击刑：多主阻隔、冲突、刑伤与执行受阻，用兵与冒进尤忌。',
	入墓: '三奇入墓：主气机受困、推进乏力，吉事减力，凶事多呈闷滞。',
	门迫: '门迫：吉门遇迫则吉不就，凶门遇迫则凶更甚，需付出更高代价。',
	空亡: '空亡：象意落空、兑现折损，利于虚化避险，不利于实质落地。',
	驿马: '驿马：主迁移、奔波与应变，宜机动，不宜久守。',
};
const DUNJIA_TOOLTIP_OVERLAY_STYLE = { maxWidth: 560 };
const DUNJIA_TOOLTIP_INNER_STYLE = {
	background: '#ffffff',
	color: '#111827',
	border: '1px solid #dbe5f1',
	borderRadius: 8,
	boxShadow: '0 8px 24px rgba(15, 23, 42, 0.14)',
	padding: '8px 10px',
};
const QIMEN_TOOLTIP_CHAR_MAP = {
	門: '门',
	開: '开',
	傷: '伤',
	驚: '惊',
	陰: '阴',
	陽: '阳',
	離: '离',
	兌: '兑',
	黃: '黄',
	綠: '绿',
	藍: '蓝',
	騰: '腾',
	內: '内',
	沖: '冲',
	輔: '辅',
	麗: '丽',
	風: '风',
	險: '险',
	鬥: '斗',
	體: '体',
	臺: '台',
	與: '与',
	廣: '广',
	層: '层',
	醫: '医',
	氣: '气',
	關: '关',
	貴: '贵',
	龍: '龙',
	變: '变',
	遠: '远',
	飛: '飞',
	壯: '壮',
	闊: '阔',
	圖: '图',
	樓: '楼',
	處: '处',
	書: '书',
	證: '证',
	經: '经',
	網: '网',
};

function normalizeQimenTooltipZh(raw){
	// Intentionally preserve "乾" as trigram text; do not convert "乾" to "干".
	const txt = `${safe(raw, '')}`;
	if(!txt){
		return '';
	}
	return txt.replace(/[門開傷驚陰陽離兌黃綠藍騰內沖輔麗風險鬥體臺與廣層醫氣關貴龍變遠飛壯闊圖樓處書證經網]/g, (ch)=>QIMEN_TOOLTIP_CHAR_MAP[ch] || ch);
}

function normalizeTooltipText(txt){
	return normalizeQimenTooltipZh(`${safe(txt, '')}`.replace(/\r\n/g, '\n')).trim();
}

function isRedundantQimenGanSummaryText(text){
	const raw = `${safe(text, '')}`.replace(/\s/g, '');
	if(!raw){
		return false;
	}
	return raw.indexOf('天盘干') >= 0 && raw.indexOf('地盘干') >= 0;
}

function normalizeDoorKey(door){
	const txt = `${safe(door, '')}`.replace(/\s/g, '').replace(/门/g, '').replace(/門/g, '');
	if(!txt){
		return '';
	}
	const head = txt.substring(0, 1);
	return ({
		開: '开',
		傷: '伤',
		驚: '惊',
	})[head] || head;
}

function normalizeStarKey(star){
	const txt = `${safe(star, '')}`.replace(/\s/g, '');
	if(!txt){
		return '';
	}
	if(txt.indexOf('芮') >= 0 || txt.indexOf('内') >= 0 || txt.indexOf('內') >= 0){
		return '芮';
	}
	if(txt.indexOf('禽') >= 0){
		return '禽';
	}
	if(txt.indexOf('蓬') >= 0){
		return '蓬';
	}
	if(txt.indexOf('任') >= 0){
		return '任';
	}
	if(txt.indexOf('冲') >= 0 || txt.indexOf('沖') >= 0){
		return '冲';
	}
	if(txt.indexOf('辅') >= 0 || txt.indexOf('輔') >= 0){
		return '辅';
	}
	if(txt.indexOf('英') >= 0){
		return '英';
	}
	if(txt.indexOf('柱') >= 0){
		return '柱';
	}
	if(txt.indexOf('心') >= 0){
		return '心';
	}
	return txt.substring(0, 1);
}

function normalizeGodKey(god){
	const txt = `${safe(god, '')}`.replace(/\s/g, '');
	if(!txt){
		return '';
	}
	return ({
		值符: '值符',
		符: '值符',
		腾蛇: '螣蛇',
		螣蛇: '螣蛇',
		騰蛇: '螣蛇',
		蛇: '螣蛇',
		太阴: '太阴',
		太陰: '太阴',
		阴: '太阴',
		陰: '太阴',
		六合: '六合',
		合: '六合',
		白虎: '白虎',
		虎: '白虎',
		元武: '玄武',
		玄武: '玄武',
		玄: '玄武',
		九地: '九地',
		地: '九地',
		九天: '九天',
		天: '九天',
	})[txt] || txt;
}

function getStemInterpretation(gan){
	return normalizeQimenTooltipZh(QIMEN_TEN_GAN_TEXT[`${safe(gan, '')}`.trim()] || '');
}

function getDoorInterpretation(door){
	const key = normalizeDoorKey(door);
	return normalizeQimenTooltipZh(QIMEN_DOOR_TEXT[key] || '');
}

function getStarInterpretation(star){
	const key = normalizeStarKey(star);
	return normalizeQimenTooltipZh(QIMEN_STAR_TEXT[key] || '');
}

function getGodInterpretation(god){
	const key = normalizeGodKey(god);
	return normalizeQimenTooltipZh(QIMEN_GOD_TEXT[key] || '');
}

function buildDunJiaTooltipNode(title, sections, emptyText){
	const list = (sections || []).filter((item)=>item && normalizeTooltipText(item.text));
	return (
		<div className={styles.djTooltipCard}>
			<div className={styles.djTooltipTitle}>{normalizeQimenTooltipZh(safe(title, '遁甲释义'))}</div>
			{list.length ? list.map((item, idx)=>(
				<div key={`dj_tip_${idx}`} className={styles.djTooltipSection}>
					<div className={styles.djTooltipSectionTitle}>{normalizeQimenTooltipZh(safe(item.title, '说明'))}</div>
					<div className={styles.djTooltipItem}>
						{renderMarkdownLiteBlock(normalizeTooltipText(item.text), `dj_tip_${idx}`)}
					</div>
				</div>
			)) : <div className={styles.djTooltipItem}>{renderMarkdownLiteBlock(emptyText || '暂无释义', 'dj_tip_empty')}</div>}
		</div>
	);
}

function buildDunJiaElementTooltipNode(cell, focusType){
	if(!cell){
		return buildDunJiaTooltipNode('遁甲释义', [], '暂无释义');
	}
	const doorVal = normalizeQimenTooltipZh(safe(cell.door, '—'));
	const focusMap = {
		tianGan: {
			title: '天盘干',
			value: safe(cell.tianGan, '—'),
			text: getStemInterpretation(cell.tianGan),
		},
		diGan: {
			title: '地盘干',
			value: safe(cell.diGan, '—'),
			text: getStemInterpretation(cell.diGan),
		},
		god: {
			title: '八神',
			value: safe(cell.god, '—'),
			text: getGodInterpretation(cell.god),
		},
		star: {
			title: '九星',
			value: safe(cell.tianXing, '—'),
			text: getStarInterpretation(cell.tianXing),
		},
		door: {
			title: '八门',
			value: doorVal,
			text: getDoorInterpretation(doorVal),
		},
		palace: {
			title: '宫位',
			value: `${safe(cell.palaceName, '宫位')}${safe(cell.palaceNum, '—')}`,
			text: '用于定位本宫方位。',
		},
		yima: {
			title: '驿马',
			value: '驿马',
			text: QIMEN_STATUS_TEXT.驿马,
		},
	};
	const focus = focusMap[focusType] || focusMap.tianGan;
	const title = `${focus.title}释义`;
	const sections = [
		{ title: '释义', text: focus.text || '暂无释义' },
	];
	// 八门在无值时保留门名，防止出现空提示。
	if(focusType === 'door' && !normalizeTooltipText(focus.text) && normalizeTooltipText(doorVal)){
		sections[1].text = `八门为${doorVal}，暂无条目释义。`;
	}
	return buildDunJiaTooltipNode(
		title,
		sections,
		'暂无释义'
	);
}

class DunJiaMain extends Component {
	constructor(props){
		super(props);

		this.state = {
			loading: false,
			moduleError: null,
			nongli: null,
			pan: null,
			displaySolarTime: '',
			localFields: null,
			hasPlotted: false,
			rightPanelTab: 'overview',
			selectedPalace: 1,
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
		this.prefetchSeedTimer = null;
		this.onOptionChange = this.onOptionChange.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.onTimeAlgChange = this.onTimeAlgChange.bind(this);
		this.onGenderChange = this.onGenderChange.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.genJieqiParams = this.genJieqiParams.bind(this);
		this.ensureJieqiSeed = this.ensureJieqiSeed.bind(this);
		this.prefetchJieqiSeedForFields = this.prefetchJieqiSeedForFields.bind(this);
		this.prefetchNongliForFields = this.prefetchNongliForFields.bind(this);
		this.getContext = this.getContext.bind(this);
		this.requestNongli = this.requestNongli.bind(this);
		this.getLocalNongliFallback = this.getLocalNongliFallback.bind(this);
		this.resolveDisplaySolarTime = this.resolveDisplaySolarTime.bind(this);
		this.withPanDisplaySolarTime = this.withPanDisplaySolarTime.bind(this);
		this.genParams = this.genParams.bind(this);
		this.recalc = this.recalc.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.clickPlot = this.clickPlot.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.restoreOptionsFromCurrentCase = this.restoreOptionsFromCurrentCase.bind(this);
		this.parseCasePayload = this.parseCasePayload.bind(this);
		this.captureLeftBoardHost = this.captureLeftBoardHost.bind(this);
		this.handleWindowResize = this.handleWindowResize.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				this.restoreOptionsFromCurrentCase();
				if(fields){
					this.setState({
						localFields: fields,
					});
					this.prefetchJieqiSeedForFields(fields);
					this.prefetchNongliForFields(fields);
				}
			};
		}
	}

	getLocalNongliFallback(fields){
		const chartWrap = this.props && this.props.value
			? this.props.value
			: (this.props && this.props.chart ? this.props.chart : null);
		return extractNongliFromChartWrap(chartWrap, fields);
	}

	async resolveDisplaySolarTime(params, primaryNongli){
		if(!params){
			return safe(primaryNongli && primaryNongli.birth, '');
		}
		const current = safe(primaryNongli && primaryNongli.birth, '');
		if(normalizeTimeAlg(params.timeAlg) === 0){
			return current;
		}
		const solarParams = buildDisplaySolarParams(params);
		const cachedSolar = getNongliLocalCache(solarParams);
		if(cachedSolar && cachedSolar.birth){
			return safe(cachedSolar.birth, current);
		}
		try{
			const solarNongli = await fetchPreciseNongli(solarParams);
			if(solarNongli){
				setNongliLocalCache(solarParams, solarNongli);
			}
			return safe(solarNongli && solarNongli.birth, current);
		}catch(e){
			return current;
		}
	}

	withPanDisplaySolarTime(panInput, displaySolarTime){
		const pan = panInput || null;
		if(!pan){
			return pan;
		}
		const nextSolar = safe(displaySolarTime, '') || safe(pan.realSunTime, '');
		if(safe(pan.realSunTimeDisplay, '') === nextSolar){
			return pan;
		}
		return {
			...pan,
			realSunTimeDisplay: nextSolar,
		};
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

	componentDidMount(){
		this.unmounted = false;
		this.restoreOptionsFromCurrentCase(true);
		window.addEventListener('resize', this.handleWindowResize);
		this.handleWindowResize();
		this.prefetchJieqiSeedForFields(this.state.localFields || this.props.fields);
		this.prefetchNongliForFields(this.state.localFields || this.props.fields);
	}

	componentDidUpdate(){
		this.restoreOptionsFromCurrentCase();
	}

	componentWillUnmount(){
		this.unmounted = true;
		window.removeEventListener('resize', this.handleWindowResize);
		if(this.prefetchSeedTimer){
			clearTimeout(this.prefetchSeedTimer);
			this.prefetchSeedTimer = null;
		}
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
		const leftBoardWidth = this.leftBoardHost ? this.leftBoardHost.clientWidth : 0;
		const changed = Math.abs((this.state.leftBoardWidth || 0) - leftBoardWidth) >= 2
			|| Math.abs((this.state.viewportHeight || 0) - viewportHeight) >= 2;
		if(changed){
			this.setState({
				leftBoardWidth,
				viewportHeight,
			});
		}
	}

	calcBoardScale(){
		const viewH = this.state.viewportHeight || 900;
		const availW = this.state.leftBoardWidth > 0 ? (this.state.leftBoardWidth - 22) : DUNJIA_BOARD_BASE_WIDTH;
		const widthScale = availW / DUNJIA_BOARD_BASE_WIDTH;
		// 高度优先：先按可视高度给出主缩放，再用宽度做上限约束。
		let rawScale = (viewH - 230) / DUNJIA_BOARD_BASE_HEIGHT;
		if(Number.isFinite(widthScale) && widthScale > 0){
			rawScale = Math.min(rawScale, widthScale);
		}
		if(!Number.isFinite(rawScale) || rawScale <= 0){
			return 1;
		}
		return clamp(rawScale, DUNJIA_SCALE_MIN, DUNJIA_SCALE_MAX);
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
		const savedOptions = payload.options && typeof payload.options === 'object' ? payload.options : null;
		if(savedOptions){
			Object.keys(DEFAULT_OPTIONS).forEach((key)=>{
				if(savedOptions[key] !== undefined){
					nextOptions[key] = savedOptions[key];
				}
			});
		}
		const pan = payload.pan && typeof payload.pan === 'object' ? payload.pan : null;
		if(pan){
			if(pan.shiftPalace !== undefined){
				nextOptions.shiftPalace = pan.shiftPalace;
			}
			if(pan.fengJu !== undefined){
				nextOptions.fengJu = !!pan.fengJu;
			}
		}
		const changed = getQimenOptionsKey(nextOptions) !== getQimenOptionsKey(this.state.options);
		this.lastRestoredCaseId = caseVersion;
		if(!changed){
			return;
		}
		this.setState({
			options: nextOptions,
		}, ()=>{
			const calcFields = this.state.localFields || this.props.fields;
			const canRecalc = this.state.nongli
				&& getFieldKey(calcFields)
				&& getFieldKey(calcFields) === this.lastFieldKey;
			if(this.state.hasPlotted && canRecalc){
				this.recalc(this.state.localFields || this.props.fields, this.state.nongli, nextOptions);
			}
		});
	}

	onFieldsChange(field, syncOnly){
		if(this.props.dispatch){
			const flds = {
				...(this.props.fields || {}),
				...field,
			};
			if(syncOnly){
				this.props.dispatch({
					type: 'astro/save',
					payload: {
						fields: flds,
					},
				});
				return;
			}
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: flds,
			});
		}
	}

	onTimeChanged(value){
		const dt = value.time;
		const base = this.state.localFields || this.props.fields || {};
		const localFields = {
			...base,
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		};
		this.setState({ localFields });
		if(this.prefetchSeedTimer){
			clearTimeout(this.prefetchSeedTimer);
		}
		this.prefetchSeedTimer = setTimeout(()=>{
			this.prefetchSeedTimer = null;
			if(this.unmounted){
				return;
			}
			this.prefetchJieqiSeedForFields(localFields);
			this.prefetchNongliForFields(localFields);
		}, 120);
	}

	onTimeAlgChange(val){
		const nextVal = normalizeTimeAlg(val);
		const baseFields = this.state.localFields || this.props.fields || {};
		const options = {
			...this.state.options,
			timeAlg: nextVal,
		};
		const localFields = {
			...baseFields,
			timeAlg: { value: nextVal },
		};
		this.jieqiYearSeeds = {};
		this.jieqiSeedPromises = {};
		this.panCache.clear();
		this.lastPanSignature = '';
		this.lastFieldKey = '';
		this.onFieldsChange({
			timeAlg: { value: nextVal },
		}, true);
		this.setState({ localFields, options }, ()=>{
			this.prefetchNongliForFields(localFields);
			this.prefetchJieqiSeedForFields(localFields);
			if(this.state.hasPlotted){
				this.requestNongli(localFields, true);
			}
		});
	}

	onGenderChange(val){
		this.onOptionChange('sex', val);
		this.onFieldsChange({
			gender: { value: val },
		}, true);
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
		const nextKey = getFieldKey(nextFields);
		const curKey = getFieldKey(this.props.fields);
		if(nextKey && nextKey !== curKey){
			this.onFieldsChange({
				date: { value: nextFields.date.value.clone() },
				time: { value: nextFields.time.value.clone() },
				ad: { value: nextFields.ad.value },
				zone: { value: nextFields.zone.value },
			}, true);
		}
		this.setState({
			hasPlotted: true,
			localFields: nextFields,
			moduleError: null,
		}, ()=>{
			const shouldForce = !this.state.nongli || getFieldKey(nextFields) !== this.lastFieldKey;
			this.requestNongli(nextFields, shouldForce);
		});
	}

	changeGeo(rec){
		this.onFieldsChange({
			lon: { value: convertLonToStr(rec.lng) },
			lat: { value: convertLatToStr(rec.lat) },
			gpsLon: { value: rec.gpsLng },
			gpsLat: { value: rec.gpsLat },
		}, true);
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
		const timeAlgRaw = flds.timeAlg && flds.timeAlg.value !== undefined && flds.timeAlg.value !== null
			? parseInt(flds.timeAlg.value, 10)
			: null;
		const timeAlgValue = Number.isNaN(timeAlgRaw) ? null : timeAlgRaw;
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
			timeAlg: (timeAlgValue === 0 || timeAlgValue === 1) ? timeAlgValue : undefined,
			after23NewDay: 0,
		};
	}

	recalc(fields, nongli, options){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds || !nongli){
			return;
		}
		const timeAlgRaw = flds.timeAlg && flds.timeAlg.value !== undefined && flds.timeAlg.value !== null
			? parseInt(flds.timeAlg.value, 10)
			: null;
		const fixedOptions = {
			...(options || this.state.options),
			jieQiType: 1,
			yearGanZhiType: 2,
			monthGanZhiType: 1,
			dayGanZhiType: 1,
		};
		if(timeAlgRaw === 0 || timeAlgRaw === 1){
			fixedOptions.timeAlg = timeAlgRaw;
		}
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
		const displayPan = this.withPanDisplaySolarTime(pan, this.state.displaySolarTime);
		this.lastPanSignature = panSignature;
		this.setState({ pan: displayPan }, ()=>{
			if(displayPan){
				saveModuleAISnapshot('qimen', buildDunJiaSnapshotText(displayPan));
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
			if(!seed){
				seed = buildLocalJieqiYearSeed(year, params.zone);
			}
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

	prefetchJieqiSeedForFields(fields){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds || !flds.date || !flds.date.value){
			return;
		}
		const fixedOptions = {
			...this.state.options,
			jieQiType: 1,
			yearGanZhiType: 2,
			monthGanZhiType: 1,
			dayGanZhiType: 1,
		};
		if(!needJieqiYearSeed(fixedOptions)){
			return;
		}
		const year = parseInt(flds.date.value.format('YYYY'), 10);
		if(!year || Number.isNaN(year)){
			return;
		}
		Promise.all([
			this.ensureJieqiSeed(flds, year - 1),
			this.ensureJieqiSeed(flds, year),
		]).catch(()=>null);
	}

	prefetchNongliForFields(fields){
		const flds = fields || this.state.localFields || this.props.fields;
		if(!flds){
			return;
		}
		let params = null;
		try{
			params = this.genParams(flds);
		}catch(e){
			return;
		}
		if(!params){
			return;
		}
		fetchPreciseNongli(params).then((result)=>{
			if(result){
				setNongliLocalCache(params, result);
			}
		}).catch(()=>null);
	}

	async requestNongli(fields, force){
		const fldsToUse = fields || this.state.localFields || this.props.fields;
		let params = null;
		try{
			params = this.genParams(fldsToUse);
		}catch(e){
			this.setState({
				moduleError: '当前时间或地理参数无效，请确认后重试。',
				loading: false,
			});
			message.error('遁甲起盘参数无效，请确认时间与经纬度后重试');
			return;
		}
		if(!params){
			return;
		}
		const fieldKey = getFieldKey(fldsToUse);
		if(!force && this.state.nongli && fieldKey && fieldKey === this.lastFieldKey){
			this.recalc(fldsToUse, this.state.nongli);
			return;
		}
		if(this.pendingNongli && this.pendingNongli.key === fieldKey){
			return this.pendingNongli.promise;
		}
		const seq = ++this.requestSeq;
		if(force && !this.state.loading){
			this.setState({
				loading: true,
				moduleError: null,
			});
		}

		const reqPromise = (async ()=>{
			const fixedOptions = {
				...this.state.options,
				jieQiType: 1,
				yearGanZhiType: 2,
				monthGanZhiType: 1,
				dayGanZhiType: 1,
			};
			const shouldWaitSeed = needJieqiYearSeed(fixedOptions);
			const flds = fldsToUse;
			let year = null;
			if(flds && flds.date && flds.date.value){
				year = parseInt(flds.date.value.format('YYYY'), 10);
			}
			const waitSeed = !!(year && shouldWaitSeed);
			const seedPromise = waitSeed ? Promise.all([
				this.ensureJieqiSeed(flds, year - 1),
				this.ensureJieqiSeed(flds, year),
			]).catch(()=>null) : null;
			const missingSeed = waitSeed && (!this.jieqiYearSeeds[year - 1] || !this.jieqiYearSeeds[year]);
			if(missingSeed && !this.state.loading){
				this.setState({ loading: true });
			}
			try{
				const preciseNongliPromise = fetchPreciseNongli(params).catch(()=>null);
				let quickPrecise = await Promise.race([
					preciseNongliPromise,
					new Promise((resolve)=>setTimeout(()=>resolve(null), DUNJIA_FAST_PLOT_TIMEOUT_MS)),
				]);
				let quickResult = quickPrecise || this.getLocalNongliFallback(flds);
				let usedFallbackNongli = !quickPrecise;
				if(!quickResult){
					quickResult = await preciseNongliPromise;
					usedFallbackNongli = false;
				}
				if(!quickResult){
					throw new Error('nongli.unavailable');
				}
				setNongliLocalCache(params, quickResult);
				const quickDisplaySolarTime = await this.resolveDisplaySolarTime(params, quickResult);
				if(waitSeed && missingSeed){
					const localPrev = buildLocalJieqiYearSeed(year - 1, params.zone);
					const localCurr = buildLocalJieqiYearSeed(year, params.zone);
					if(localPrev && localCurr){
						this.jieqiYearSeeds[year - 1] = localPrev;
						this.jieqiYearSeeds[year] = localCurr;
						const pPrev = this.genJieqiParams(flds, year - 1);
						const pCurr = this.genJieqiParams(flds, year);
						if(pPrev){
							setJieqiSeedLocalCache(pPrev, localPrev);
						}
						if(pCurr){
							setJieqiSeedLocalCache(pCurr, localCurr);
						}
					}
				}
				if(this.unmounted || seq !== this.requestSeq){
					return;
				}
				const quickPanSignature = [
					getFieldKey(flds),
					getNongliKey(quickResult),
					getQimenOptionsKey(fixedOptions),
					safe(this.getContext(flds).isDiurnal, ''),
				].join('|');
				const quickPan = this.getCachedPan(flds, quickResult, fixedOptions);
				const displayQuickPan = this.withPanDisplaySolarTime(quickPan, quickDisplaySolarTime);
				this.lastFieldKey = fieldKey;
				this.lastPanSignature = quickPanSignature;
				this.setState({
					moduleError: null,
					nongli: quickResult,
					pan: displayQuickPan,
					displaySolarTime: quickDisplaySolarTime,
					loading: false,
				}, ()=>{
					if(displayQuickPan){
						saveModuleAISnapshot('qimen', buildDunJiaSnapshotText(displayQuickPan));
					}
				});
				// 后台补齐精确历法与节气种子，不阻塞首屏起盘时间。
				Promise.resolve().then(async ()=>{
					const preciseResult = await preciseNongliPromise;
					if(preciseResult){
						setNongliLocalCache(params, preciseResult);
					}
					if(waitSeed){
						const seeds = await seedPromise;
						if((!seeds || !seeds[0] || !seeds[1]) && (!this.jieqiYearSeeds[year - 1] || !this.jieqiYearSeeds[year])){
							const localPrev = buildLocalJieqiYearSeed(year - 1, params.zone);
							const localCurr = buildLocalJieqiYearSeed(year, params.zone);
							if(localPrev && localCurr){
								this.jieqiYearSeeds[year - 1] = localPrev;
								this.jieqiYearSeeds[year] = localCurr;
								const pPrev = this.genJieqiParams(flds, year - 1);
								const pCurr = this.genJieqiParams(flds, year);
								if(pPrev){
									setJieqiSeedLocalCache(pPrev, localPrev);
								}
								if(pCurr){
									setJieqiSeedLocalCache(pCurr, localCurr);
								}
							}
						}
					}
					if(this.unmounted || seq !== this.requestSeq){
						return;
					}
					const finalResult = preciseResult || quickResult;
					const finalSignature = [
						getFieldKey(flds),
						getNongliKey(finalResult),
						getQimenOptionsKey(fixedOptions),
						safe(this.getContext(flds).isDiurnal, ''),
					].join('|');
					const needUpgrade = usedFallbackNongli
						|| finalSignature !== this.lastPanSignature
						|| getNongliKey(finalResult) !== getNongliKey(this.state.nongli);
					if(!needUpgrade){
						return;
					}
					const finalPan = this.getCachedPan(flds, finalResult, fixedOptions);
					const finalDisplaySolarTime = await this.resolveDisplaySolarTime(params, finalResult);
					const displayFinalPan = this.withPanDisplaySolarTime(finalPan, finalDisplaySolarTime);
					this.lastFieldKey = fieldKey;
					this.lastPanSignature = finalSignature;
					this.setState({
						moduleError: null,
						nongli: finalResult,
						pan: displayFinalPan,
						displaySolarTime: finalDisplaySolarTime,
					}, ()=>{
						if(displayFinalPan){
							saveModuleAISnapshot('qimen', buildDunJiaSnapshotText(displayFinalPan));
						}
					});
				}).catch(()=>null);
			}catch(e){
				if(!this.unmounted && seq === this.requestSeq){
					const errText = `${safe(e && e.message, '')}`.toLowerCase();
					const moduleError = errText.indexOf('nongli.unavailable') >= 0
						? '历法数据暂时不可用，当前无法完成遁甲起盘。'
						: (safe(e && e.message, '').trim() || '遁甲模块初始化失败，请重试。');
					this.setState({
						loading: false,
						moduleError,
					});
					message.error(moduleError);
					if(e){
						console.error('[DunJia] requestNongli failed', e);
					}
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
			this.prefetchJieqiSeedForFields(this.state.localFields || this.props.fields);
			const calcFields = this.state.localFields || this.props.fields;
			const canRecalc = this.state.nongli
				&& getFieldKey(calcFields)
				&& getFieldKey(calcFields) === this.lastFieldKey;
			if(this.state.hasPlotted && canRecalc){
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

	renderCell(cell){
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
		const unifiedFont = 34;
		const insetX = 52;
		const insetY = 40;
		const isGenPalace = cell.palaceNum === 7 || cell.palaceName === '艮';
		const yiMaStyle = isGenPalace
			? { position: 'absolute', left: 10, bottom: 8, fontSize: 20, lineHeight: '20px', color: '#111' }
			: { position: 'absolute', top: 8, right: 10, fontSize: 20, lineHeight: '20px', color: '#111' };

		const palacePosMap = {
			1: { right: 12, bottom: 8 }, // 巽：靠中宫（右下）
			2: { left: '50%', bottom: 8, transform: 'translateX(-50%)' }, // 离：靠中宫（下中）
			3: { left: 12, bottom: 8 }, // 坤：靠中宫（左下）
			4: { right: 12, top: '50%', transform: 'translateY(-50%)' }, // 震：靠中宫（右中）
			6: { left: 12, top: '50%', transform: 'translateY(-50%)' }, // 兑：靠中宫（左中）
			7: { right: 12, top: 8 }, // 艮：靠中宫（右上）
			8: { left: '50%', top: 8, transform: 'translateX(-50%)' }, // 坎：靠中宫（上中）
			9: { left: 12, top: 8 }, // 乾：靠中宫（左上）
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
		const isSelected = this.state.selectedPalace === cell.palaceNum;
		const cardStyle = {
			background: '#f6f6f6',
			borderRadius: 14,
			border: isSelected ? '2px solid #1677ff' : '1px solid #ececec',
			height: 214,
			padding: 0,
			position: 'relative',
			cursor: 'pointer',
		};
		const tianGanTooltip = buildDunJiaElementTooltipNode(cell, 'tianGan');
		const diGanTooltip = buildDunJiaElementTooltipNode(cell, 'diGan');
		const godTooltip = buildDunJiaElementTooltipNode(cell, 'god');
		const starTooltip = buildDunJiaElementTooltipNode(cell, 'star');
		const doorTooltip = buildDunJiaElementTooltipNode(cell, 'door');
		const palaceTooltip = buildDunJiaElementTooltipNode(cell, 'palace');
		const yiMaTooltip = buildDunJiaElementTooltipNode(cell, 'yima');
		if(cell.isCenter){
			return (
				<div
					key={`cell_${cell.palaceNum}`}
					style={cardStyle}
					onClick={()=>this.setState({ selectedPalace: cell.palaceNum })}
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
							gap: 4,
						}}
					>
						{centerItems.map((item, idx)=>(
							<Tooltip
								key={`center_item_tt_${idx}`}
								title={idx === 0 ? tianGanTooltip : diGanTooltip}
								placement="top"
								overlayStyle={DUNJIA_TOOLTIP_OVERLAY_STYLE}
								overlayInnerStyle={DUNJIA_TOOLTIP_INNER_STYLE}
							>
								<div
									key={`center_item_${idx}`}
									style={{
										fontSize: 32,
										lineHeight: '32px',
										fontWeight: 700,
										color: item.color,
										cursor: 'help',
										pointerEvents: 'auto',
									}}
								>
									{item.text}
								</div>
							</Tooltip>
						))}
					</div>
				</div>
			);
		}

		return (
			<div
				key={`cell_${cell.palaceNum}`}
				style={cardStyle}
				onClick={()=>this.setState({ selectedPalace: cell.palaceNum })}
			>
				{cell.isYiMa && (
					<Tooltip title={yiMaTooltip} placement="top" overlayStyle={DUNJIA_TOOLTIP_OVERLAY_STYLE} overlayInnerStyle={DUNJIA_TOOLTIP_INNER_STYLE}>
						<div style={{ ...yiMaStyle, cursor: 'help', pointerEvents: 'auto' }}>🐎</div>
					</Tooltip>
				)}
				<Tooltip title={tianGanTooltip} placement="top" overlayStyle={DUNJIA_TOOLTIP_OVERLAY_STYLE} overlayInnerStyle={DUNJIA_TOOLTIP_INNER_STYLE}>
					<div
						style={{
							position: 'absolute',
							left: insetX,
							top: insetY,
							fontSize: unifiedFont,
							lineHeight: `${unifiedFont}px`,
							color: tianGanColor,
							fontWeight: 700,
							cursor: 'help',
							pointerEvents: 'auto',
						}}
					>
						{cell.tianGan || '　'}
					</div>
				</Tooltip>
				<Tooltip title={diGanTooltip} placement="top" overlayStyle={DUNJIA_TOOLTIP_OVERLAY_STYLE} overlayInnerStyle={DUNJIA_TOOLTIP_INNER_STYLE}>
					<div
						style={{
							position: 'absolute',
							left: insetX,
							bottom: insetY,
							fontSize: unifiedFont,
							lineHeight: `${unifiedFont}px`,
							color: diGanColor,
							fontWeight: 700,
							cursor: 'help',
							pointerEvents: 'auto',
						}}
					>
						{cell.diGan || '　'}
					</div>
				</Tooltip>
				<Tooltip title={godTooltip} placement="top" overlayStyle={DUNJIA_TOOLTIP_OVERLAY_STYLE} overlayInnerStyle={DUNJIA_TOOLTIP_INNER_STYLE}>
					<div
						style={{
							position: 'absolute',
							right: insetX,
							top: insetY,
							fontSize: unifiedFont,
							lineHeight: `${unifiedFont}px`,
							color: godColor,
							fontWeight: 700,
							cursor: 'help',
							pointerEvents: 'auto',
						}}
					>
						{cell.god || '　'}
					</div>
				</Tooltip>
				<Tooltip title={starTooltip} placement="top" overlayStyle={DUNJIA_TOOLTIP_OVERLAY_STYLE} overlayInnerStyle={DUNJIA_TOOLTIP_INNER_STYLE}>
					<div
						style={{
							position: 'absolute',
							right: insetX,
							bottom: insetY,
							fontSize: unifiedFont,
							lineHeight: `${unifiedFont}px`,
							color: line3Color,
							fontWeight: 700,
							cursor: 'help',
							pointerEvents: 'auto',
						}}
					>
						{cell.tianXing || '　'}
					</div>
				</Tooltip>
				<Tooltip title={doorTooltip} placement="top" overlayStyle={DUNJIA_TOOLTIP_OVERLAY_STYLE} overlayInnerStyle={DUNJIA_TOOLTIP_INNER_STYLE}>
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
							cursor: 'help',
							pointerEvents: 'auto',
						}}
					>
						{cell.door || '　'}
					</div>
				</Tooltip>

				{!!palaceStyle && (
					<Tooltip title={palaceTooltip} placement="top" overlayStyle={DUNJIA_TOOLTIP_OVERLAY_STYLE} overlayInnerStyle={DUNJIA_TOOLTIP_INNER_STYLE}>
						<div
							style={{
								position: 'absolute',
								color: titleColor,
								fontSize: 15,
								lineHeight: '15px',
								fontWeight: 700,
								cursor: 'help',
								pointerEvents: 'auto',
								...palaceStyle,
							}}
						>
							{cell.palaceName}
						</div>
					</Tooltip>
				)}
			</div>
		);
	}

	renderBoard(){
		const pan = this.state.pan;
		if(!this.state.hasPlotted){
			return <Card bordered={false}>点击右侧“起盘”后显示遁甲盘</Card>;
		}
		if(!pan){
			return <Card bordered={false}>暂无遁甲盘数据</Card>;
		}
		const cellSize = 214;
		const boardGap = 10;
		const boardWidth = (cellSize * 3) + (boardGap * 2);
		const boardScale = this.calcBoardScale();
		const scaledWidth = Math.round(boardWidth * boardScale);
		const dateParts = parseDateLabel(pan.calcDateStr || pan.dateStr);
		const dateTitle = `${dateParts.year}年${dateParts.month}月${dateParts.day}日`;
		const directHm = extractHm(pan.directTimeStr || pan.timeStr);
		const solarHm = extractHm(pan.realSunTimeDisplay || pan.realSunTime);
		const dateTimeTitle = `${dateTitle}　直接时间：${directHm}　真太阳时：${solarHm}`;
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
				<div style={{ width: scaledWidth, maxWidth: '100%' }}>
					<div style={{ width: boardWidth, transform: `scale(${boardScale})`, transformOrigin: 'top left' }}>
						<div
							style={{
								padding: 12,
								borderRadius: 14,
								background: '#fbfbfb',
								border: '1px solid #efefef',
								marginBottom: 8,
								width: boardWidth,
								maxWidth: '100%',
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
								<div style={{ fontSize: 18, lineHeight: '22px', fontWeight: 700, color: '#222' }}>
									{dateTimeTitle}
								</div>
								{shiftTitle ? (
									<div style={{ fontSize: 16, lineHeight: '20px', fontWeight: 700, color: '#595959' }}>
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
												fontSize: 32,
											}}
										>
											<span style={{ color: p.ganColor }}>{p.gan || ' '}</span>
											<span style={{ color: p.zhiColor, marginTop: 4 }}>{p.zhi || ' '}</span>
										</div>
										<span
											style={{
												marginLeft: 6,
												color: '#8c8c8c',
												fontSize: 24,
												lineHeight: 1,
												fontWeight: 700,
											}}
										>
											{p.label}
										</span>
									</div>
								))}
							</div>
							<div style={{ marginTop: 6, fontSize: 16, lineHeight: '20px', fontWeight: 700, color: '#202020' }}>
								{pan.juText} 值符:{pan.zhiFu} 值使:{pan.zhiShi}
							</div>
							<div style={{ marginTop: 4, fontSize: 14, lineHeight: '18px', color: '#595959' }}>
								{pan.options.kongModeLabel}-{pan.kongWang} 旬首-{pan.xunShou}
							</div>
						</div>
						<div style={{ position: 'relative', width: boardWidth, maxWidth: '100%' }}>
							<div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${cellSize}px)`, gap: boardGap }}>
								{pan.cells.map((cell)=>this.renderCell(cell))}
							</div>
							{pan.fengJu ? (
								<div
									style={{
										position: 'absolute',
										left: '50%',
										top: '50%',
										transform: 'translate(-50%, -50%)',
										width: '62%',
										maxWidth: 430,
										opacity: 0.22,
										pointerEvents: 'none',
										zIndex: 9,
									}}
								>
									<img src={sealedImage} alt="雷霆都司印章" style={{ width: '100%', height: 'auto', display: 'block' }} />
								</div>
							) : null}
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
		const selectedPalace = this.state.selectedPalace || 1;
		const palaceMap = {};
		if(pan && Array.isArray(pan.cells)){
			pan.cells.forEach((cell)=>{
				if(cell && cell.palaceNum){
					palaceMap[cell.palaceNum] = cell;
				}
			});
		}
		const bagongRows = DUNJIA_BAGONG_ORDER
			.map((item)=>{
				const cell = palaceMap[item.palaceNum];
				if(!cell){
					return null;
				}
				const titleTxt = `${item.title || ''}`;
				const shortMatch = titleTxt.match(/([乾兑离震巽坎艮坤])宫/);
				return {
					key: `${item.palaceNum}`,
					title: item.title,
					shortTitle: shortMatch ? `${shortMatch[1]}宫` : `${safe(cell.palaceName, '')}${safe(cell.palaceNum, '')}`,
					cell,
				};
			})
			.filter(Boolean);
		const selectedBagongRow = bagongRows.find((row)=>row.cell.palaceNum === selectedPalace) || bagongRows[0] || null;
		const selectedCell = selectedBagongRow ? selectedBagongRow.cell : null;
		const fields = this.state.localFields || this.props.fields || {};
		const timeAlgValue = normalizeTimeAlg(
			fields.timeAlg && fields.timeAlg.value !== undefined && fields.timeAlg.value !== null
				? fields.timeAlg.value
				: opt.timeAlg
		);
		let datetm = new DateTime();
		if(fields.date && fields.time){
			const str = `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`;
			datetm = datetm.parse(str, 'YYYY-MM-DD HH:mm:ss');
			if(fields.zone){
				datetm.setZone(fields.zone.value);
			}
		}
		const overviewRows = [
			{ label: '命式', value: pan ? pan.options.sexLabel : '—' },
			{ label: '符头', value: pan ? pan.fuTou : '—' },
			{ label: '节气', value: pan ? pan.jieqiText : '—' },
			{ label: '局数', value: pan ? pan.juText : '—' },
			{ label: '旬首', value: pan ? pan.xunShou : '—' },
			{ label: pan ? pan.options.kongModeLabel : '空亡', value: pan ? pan.kongWang : '—' },
			{ label: '值符', value: pan ? pan.zhiFu : '—' },
			{ label: '值使', value: pan ? pan.zhiShi : '—' },
			{ label: '移星', value: pan ? (pan.options.shiftLabel || '原宫') : '原宫' },
			{ label: '奇门封局', value: pan ? (pan.options.fengJuLabel || '未封局') : (opt.fengJu ? '已封局' : '未封局') },
		];
		const calendarRows = [
			{ label: '农历', value: pan ? pan.lunarText : '—' },
			{ label: '真太阳时', value: pan ? (pan.realSunTimeDisplay || pan.realSunTime || '—') : '—' },
			{ label: '干支', value: pan ? `年${pan.ganzhi.year} 月${pan.ganzhi.month} 日${pan.ganzhi.day} 时${pan.ganzhi.time}` : '—' },
			{ label: '节气段', value: pan ? (pan.jiedelta || '—') : '—' },
		];
		const selectedCellLines = selectedCell ? [
			`十干克应：${safe(selectedCell.tenGanResponse, '无')}`,
			`八门克应：${safe(selectedCell.doorBaseResponse, '无')}`,
			`奇仪主应：${safe(selectedCell.doorGanResponse, '无')}`,
			`吉格：${formatPatternValue(selectedCell.jiPatterns)}`,
			`凶格：${formatPatternValue(selectedCell.xiongPatterns)}`,
		].filter((line)=>!isRedundantQimenGanSummaryText(line)) : [];
		const jiCount = pan && pan.jiPatterns && pan.jiPatterns.length ? pan.jiPatterns.length : 0;
		const xiongCount = pan && pan.xiongPatterns && pan.xiongPatterns.length ? pan.xiongPatterns.length : 0;
		const shenshaCount = pan && pan.shenSha && pan.shenSha.allItems && pan.shenSha.allItems.length ? pan.shenSha.allItems.length : 0;
		const cellJiCount = selectedCell && selectedCell.jiPatterns && selectedCell.jiPatterns.length ? selectedCell.jiPatterns.length : 0;
		const cellXiongCount = selectedCell && selectedCell.xiongPatterns && selectedCell.xiongPatterns.length ? selectedCell.xiongPatterns.length : 0;
		const cellLineCount = selectedCellLines.length;
		return (
			<div className={styles.rightPanel}>
				<div className={styles.rightTopBlock}>
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
								<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
									<Select size="small" value={timeAlgValue} onChange={this.onTimeAlgChange} style={{ width: '100%' }}>
										{TIME_ALG_OPTIONS.map((item)=><Option key={item.value} value={item.value}>{item.label}</Option>)}
									</Select>
									<GeoCoordModal onOk={this.changeGeo} lat={fields.gpsLat && fields.gpsLat.value} lng={fields.gpsLon && fields.gpsLon.value}>
										<Button size="small" style={{ width: '100%' }}>经纬度选择</Button>
									</GeoCoordModal>
								</div>
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
						<div className={styles.coordText}>
							<span>{fields.lon ? fields.lon.value : ''} {fields.lat ? fields.lat.value : ''}</span>
						</div>
					</div>
				</div>

				<Tabs
					activeKey={panelTab}
					onChange={(key)=>this.setState({ rightPanelTab: key })}
					className={styles.panelTabs}
				>
					<TabPane tab="概览" key="overview">
						<Card bordered={false} className={styles.panelCard} bodyStyle={{ padding: '10px 12px' }}>
							<div className={styles.metricRow}>
								<Tag color={jiCount ? 'green' : 'default'} className={styles.metricTag}>吉格 {jiCount}</Tag>
								<Tag color={xiongCount ? 'red' : 'default'} className={styles.metricTag}>凶格 {xiongCount}</Tag>
								<Tag color={shenshaCount ? 'blue' : 'default'} className={styles.metricTag}>神煞 {shenshaCount}</Tag>
							</div>
							<div className={styles.kvList}>
								{overviewRows.map((row, idx)=>(
									<div key={`dj_overview_${idx}`} className={styles.kvItem}>
										<div className={styles.kvLabel}>{row.label}</div>
										<div className={styles.kvValue}>{row.value}</div>
									</div>
								))}
							</div>
						</Card>
					</TabPane>
					<TabPane tab="格局" key="status">
						<Card bordered={false} className={styles.panelCard} bodyStyle={{ padding: '10px 12px' }}>
							<div style={{ lineHeight: '26px' }}>
								<div className={styles.sectionHint}>按宫位查看判断</div>
								{selectedCell ? (
									<div className={styles.metricRow}>
										<Tag color="geekblue" className={styles.metricTag}>当前 {selectedBagongRow ? selectedBagongRow.title : `${selectedCell.palaceName}${selectedCell.palaceNum}宫`}</Tag>
										<Tag color={cellLineCount ? 'blue' : 'default'} className={styles.metricTag}>条目 {cellLineCount}</Tag>
										<Tag color={cellJiCount ? 'green' : 'default'} className={styles.metricTag}>吉格 {cellJiCount}</Tag>
										<Tag color={cellXiongCount ? 'red' : 'default'} className={styles.metricTag}>凶格 {cellXiongCount}</Tag>
									</div>
								) : null}
								<div className={styles.palaceBtnGrid2}>
									{bagongRows.map((row)=>(
										<Button
											key={`status_cell_btn_${row.cell.palaceNum}`}
											size="small"
											type={selectedBagongRow && selectedBagongRow.cell.palaceNum === row.cell.palaceNum ? 'primary' : 'default'}
											onClick={()=>this.setState({ selectedPalace: row.cell.palaceNum })}
										>
											{row.shortTitle || row.title}
										</Button>
									))}
								</div>
								{selectedCell ? (
									<div className={styles.bgSection}>
										<div className={styles.bgTitle}>{selectedBagongRow ? selectedBagongRow.title : `${selectedCell.palaceName}${selectedCell.palaceNum}宫`}</div>
											{selectedCellLines.map((line, idx)=>{
												const txt = `${line || ''}`;
												const colonIdx = txt.indexOf('：');
												const label = colonIdx >= 0 ? txt.substring(0, colonIdx) : `判断${idx + 1}`;
												const value = colonIdx >= 0 ? txt.substring(colonIdx + 1) : txt;
												return (
													<div key={`dj_status_row_${selectedCell.palaceNum}_${idx}`} className={styles.bgLineCard}>
														<div className={styles.bgLineLabel}>{label}</div>
														<div className={styles.bgLineValue}>{value}</div>
													</div>
												);
											})}
											</div>
									) : <div className={styles.emptyText}>暂无宫位判断数据</div>}
								</div>
						</Card>
					</TabPane>
					<TabPane tab="神煞" key="shensha">
						<Card bordered={false} className={styles.panelCard} bodyStyle={{ padding: '10px 12px' }}>
							<div className={styles.shenshaGrid}>
								{pan && pan.shenSha && pan.shenSha.allItems && pan.shenSha.allItems.length
									? pan.shenSha.allItems.map((item)=>(
										<div key={`ss_item_${item.name}`} className={styles.shenshaItem}>
											<span className={styles.shenshaName}>{item.name}</span>
											<span className={styles.shenshaValue}>{item.value}</span>
										</div>
									))
									: <div className={styles.emptyText}>暂无神煞</div>}
							</div>
						</Card>
					</TabPane>
					<TabPane tab="历法" key="calendar">
						<Card bordered={false} className={styles.panelCard} bodyStyle={{ padding: '10px 12px' }}>
							<div className={styles.kvList}>
								{calendarRows.map((row, idx)=>(
									<div key={`dj_calendar_${idx}`} className={styles.kvItem}>
										<div className={styles.kvLabel}>{row.label}</div>
										<div className={styles.kvValue}>{row.value}</div>
									</div>
								))}
							</div>
						</Card>
					</TabPane>
				</Tabs>
			</div>
		);
	}

	renderModuleError(){
		const errorText = safe(this.state.moduleError, '').trim() || '当前模块暂时不可用，请稍后重试。';
		return (
			<div style={{ height: '100%', padding: 12, boxSizing: 'border-box' }}>
				<Card
					bordered={false}
					style={{ height: '100%' }}
					bodyStyle={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
				>
					<div style={{ maxWidth: 560, textAlign: 'center' }}>
						<div style={{ fontSize: 18, fontWeight: 600, color: '#262626', marginBottom: 12 }}>遁甲模块暂时无法显示</div>
						<div style={{ color: '#595959', lineHeight: '24px', marginBottom: 20 }}>{errorText}</div>
						<div style={{ color: '#8c8c8c', lineHeight: '22px', marginBottom: 20 }}>你可以重试当前模块，或切换到其他页签后再返回。</div>
						<div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
							<Button type="primary" onClick={this.clickPlot}>重试当前模块</Button>
							<Button onClick={()=>this.setState({ moduleError: null })}>关闭错误提示</Button>
						</div>
					</div>
				</Card>
			</div>
		);
	}

	render(){
		const height = resolveBoundedHeight(this.props.height);
		if(this.state.moduleError){
			return (
				<div style={{ height, maxHeight: height, overflow: 'hidden' }}>
					{this.renderModuleError()}
				</div>
			);
		}
		return (
			<div style={{ height, maxHeight: height, overflow: 'hidden' }}>
				<Spin spinning={this.state.loading}>
					<Row gutter={6} style={{ height: '100%' }}>
						<Col span={16} style={{ height: '100%', overflow: 'hidden', minWidth: 0 }}>
							<div ref={this.captureLeftBoardHost} style={{ height: '100%', overflow: 'hidden' }}>
								{this.renderBoard()}
							</div>
						</Col>
					<Col span={8} style={{ height: '100%', overflow: 'hidden', minWidth: 0 }}>
							<div style={{ height: '100%', maxHeight: height, overflow: 'hidden' }}>
								{this.renderRight()}
							</div>
					</Col>
					</Row>
				</Spin>
			</div>
		);
	}
}

export default DunJiaMain;
