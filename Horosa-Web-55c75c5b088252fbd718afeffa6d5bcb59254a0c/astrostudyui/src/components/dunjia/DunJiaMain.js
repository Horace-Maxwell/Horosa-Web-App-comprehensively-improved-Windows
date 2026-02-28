import { Component } from 'react';
import { Row, Col, Card, Select, Button, Spin, Tag, Tabs, Tooltip, message } from 'antd';
import { saveModuleAISnapshot, loadModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import {
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
import styles from './DunJiaMain.less';
const { Option } = Select;
const TabPane = Tabs.TabPane;
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
const DUNJIA_SCALE_MIN = 0.64;
const DUNJIA_SCALE_MAX = 1.22;
const DUNJIA_FAST_PLOT_TIMEOUT_MS = 650;

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

function safe(v, d = ''){
	return v === undefined || v === null ? d : v;
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

const QIMEN_TEN_GAN_TEXT = {
	甲: `挺立．老大
权威，名贵，一流
挺拔，上进，奋斗
直爽，高傲
有壳，保护`,
	乙: `柔曲．依附
曲折，柔弱，依附，委婉，骑墙
艺术，希望，美女，妻子
中医，草药，风
沟通`,
	丙: `放射．表现
热烈，权柄，争斗，动乱
希望，光明
雄壮，急躁，虚荣
能源，圆形，宣传`,
	丁: `闪烁．亮眼
突出，尖锐，亮眼，闪烁，奇迹
文字，意义，目光
文书，票证
小三、玉女，IT`,
	戊: `收容．积聚
钱，资本，资产，金融，容器
包容，宽厚，稳重，不变
房子，土地，大肉，胖，厚`,
	己: `阴险．谋划
欲望，邪念，阴险，谋划，弯曲
低洼，坑，陷阱
厕所，排泄，垃圾
小肉，嘴`,
	庚: `凶猛．敌对
凶狠，霸道，武断，肃杀
阻隔，打斗
骨头，坚硬，金属
癌症，武器`,
	辛: `变化．革新
错误，问题，改革，创新
叛逆，激烈，变化，要害
金玉，首饰，颗粒，铜钱`,
	壬: `流动．放纵
聪明，逻辑
无主，迷茫，漂动
风流，纵欲
运输，旅行，动脉`,
	癸: `沉迷．浑浊
浑浊，阴柔，沉溺，迷醉
多情，多愁，多欲
酒、茶、汤、污水、浑浊物
静脉，鞋，鬼`,
};

const QIMEN_DOOR_TEXT = {
	休: `休门（坎，子）
休养：休息、休闲、懒散；旅游、婚姻、家庭
宽松、温和、休止；萎靡、潜伏
物象：公务员、僧道、贵人、旅游度假、娱乐、车船运输、酒水河海`,
	生: `生门（艮，寅，金墓）
生息：生长、生产、生机；生意、利润、利息
土地、房产；连绵延续、活跃发展
物象：生活必需品、交易市场、工厂车间、种植养殖、老板`,
	伤: `伤门（震，卯）
伤害：伤身伤痛、伤人搏斗、攻击捕捉、打猎冒险
竞争、引诱、对抗
物象：武器锐器、爆炸物、公检法、悬崖；军警猎人、司机运动员`,
	杜: `杜门（巽，巳，水墓）
阻塞：阻隔、限制、困难；拥堵、不明、隐藏、躲避
技术、秘密、保密；隐瞒、内向、沉默、防御
物象：墙壁堤坝门窗监狱、专利技术、夜行动物、防御部队`,
	景: `景门（离，午）
亮丽：好看美丽、明星表演、风景繁华
显眼：文书文件、证件信息、喜庆婚宴
急躁、理想、幻想
物象：美色装饰、照片摄影、证书广告、电视电脑、灯光相机`,
	死: `死门（坤，申，木墓）
死寂：安静不动、死亡结束、困境低谷
迟滞呆板、内向保守、深沉
物象：废屋仓库空置房、棺木墓碑、医院殡仪、固定资产`,
	惊: `惊门（兑，酉）
惊恐：惊吓受惊、害怕；口舌诉讼、辩论刺激、嘈杂
物象：律师老师主播导游、音响乐器、闹市KTV、投机比赛`,
	开: `开门（乾，亥，火墓）
开阔：开拓开创、事业工作、单位公权、升迁
开放公开、门面清晰、明朗爽达
物象：平原旷野广场办公室、金银珠宝、车站、飞机飞船`,
};

const QIMEN_STAR_TEXT = {
	蓬: `天蓬（坎，壬癸，黑）
游侠：胆魄、冒险、聪明；好色、阴暗、风流、浪荡；多变、贪大、雄略
行业：风险突破、风月场所、酒吧洗浴、餐饮、水产养殖
物象：伞棚亭桥、鼠蝙蝠鱼、蘑菇与伞叶植物`,
	任: `天任（艮，戊，黄）
农夫：忠厚老实、安稳承担、缓慢辛劳；任劳任怨，性张力偏弱
行业：工业农业制造矿产建筑土木
物象：床椅桌被鞋柜、马牛骆驼、梯丘台阶、稻谷矿物山果`,
	冲: `天冲（震，甲，绿）
武士：冲击冲动、快速敏捷、急迫冒失，雷厉风行
行业：武行军警、商店电器、科技音乐
物象：飞机汽车车站、高楼大树、乐器枪炮烟花、噪动鸣叫之物`,
	辅: `天辅（巽，乙，绿蓝）
师相：辅佐指导、教授学习、文化技术、传播传染
温雅含蓄、谦恭节制、同情包容
行业：文教设计规划、老师工艺、技术支持
物象：衣服护甲桌椅、空调风扇窗帘、电线围栏、葫芦丝瓜泥鳅蛇`,
	英: `天英（离，丙丁，红）
明星：亮丽好看、表现才华、光明刚烈、热情明朗
亦有虚荣浮夸、易怒好胜
行业：演艺社交公关模特、美容电子、电器能源火业
物象：妆容证件花与烟花、灯炉阳台、书与影视媒体`,
	芮: `天芮/天内（坤，己，黄）
医生：疾病问题、麻烦纠偏、修行
沉静内敛、认真严肃、一根筋、钻牛角尖
行业：医疗卫生、中小学教学、器械与肉品加工
物象：药与医院寺观、书店图书馆、病变破损物、花生地瓜家禽孕妇`,
	禽: `天禽
坐镇中宫，不参与八宫变化
主中宫统摄、中和调度`,
	柱: `天柱（兑，辛，白）
柱石：叛逆反调、辩论破坏、独特冷酷
行业：律师检法、销售中介、军事、重工与机械修理
物象：钟表音响乐器、狗鸡鸟、钢管烟囱高塔、脊柱腰椎`,
	心: `天心（乾，庚，白）
君王：中心领导、组织监管、策划庙堂、老成持重
行业：管理经营、规划咨询、整合资源、西医
物象：金银珠宝令印、领导办公室、CBD与塔狮、金属器械`,
};

const QIMEN_GOD_TEXT = {
	值符: `值符（在离，阳火）
领导（替甲）：贵、权、管、显
象：第一、中心、上司、老板、裁判、高档名贵与标志`,
	螣蛇: `螣蛇（在巽，阴火）
妖异：惊、妖、艳；梦、幻；缠、骗、伪
象：奇怪狡猾、虚假难缠、反复善变、情感与疾病反复`,
	太阴: `太阴（在坤，阴金）
阴谋：密、暗；谋、私；护、女；精
象：心思细腻、擅策划、精致艺术、暗中贵人、隐藏之人`,
	六合: `六合（在震，木）
人缘：合、媒、多、伙；婚、恋、约、缘
物象：合作合伙、婚姻人缘、中介牵连、能开合之物、小孩`,
	白虎: `白虎（在兑，阳金）
凶猛：斗、阻、暴；威、霸、害；硬、猛
物象：阻力阻隔、严厉冲动、疾病死伤、公检法与强硬力量`,
	玄武: `玄武（在坎，水）
盗耗：偷、谎、假；黑、贿；晕、迷、玄
物象：偷窃盗贼、迷雾眩晕、不确定不可靠、失物与传闻`,
	九地: `九地（在艮，土）
坚固：稳、固；久、慢；矮、守
物象：稳定厚重、包容关怀、老练守成、低洼地下空间`,
	九天: `九天（在乾，阳金）
高远：远、飞；变、动；高、扬、志、阔
物象：宏大高远、风云激荡、高谈阔论、变动不居、求新求变`,
};

const QIMEN_STATUS_TEXT = {
	击刑: '六仪击刑：多主阻隔、冲突、刑伤与执行受阻，用兵与冒进尤忌。',
	入墓: '三奇入墓：主气机受困、推进乏力，吉事减力，凶事多呈闷滞。',
	门迫: '门迫：吉门遇迫则吉不就，凶门遇迫则凶更甚，需付出更高代价。',
	空亡: '空亡：象意落空、兑现折损，利于虚化避险，不利于实质落地。',
	驿马: '驿马：主迁移、奔波与应变，宜机动，不宜久守。',
};

function normalizeTooltipText(txt){
	return `${safe(txt, '')}`.replace(/\r\n/g, '\n').trim();
}

function normalizeDoorKey(door){
	const txt = `${safe(door, '')}`.replace(/\s/g, '').replace(/门/g, '').replace(/門/g, '');
	return txt ? txt.substring(0, 1) : '';
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
	if(txt === '腾蛇' || txt === '螣蛇'){
		return '螣蛇';
	}
	if(txt === '元武' || txt === '玄武'){
		return '玄武';
	}
	return txt;
}

function getStemInterpretation(gan){
	return QIMEN_TEN_GAN_TEXT[`${safe(gan, '')}`.trim()] || '';
}

function getDoorInterpretation(door){
	const key = normalizeDoorKey(door);
	return QIMEN_DOOR_TEXT[key] || '';
}

function getStarInterpretation(star){
	const key = normalizeStarKey(star);
	return QIMEN_STAR_TEXT[key] || '';
}

function getGodInterpretation(god){
	const key = normalizeGodKey(god);
	return QIMEN_GOD_TEXT[key] || '';
}

function buildDunJiaTooltipNode(title, sections, emptyText){
	const list = (sections || []).filter((item)=>item && normalizeTooltipText(item.text));
	return (
		<div className={styles.djTooltipCard}>
			<div className={styles.djTooltipTitle}>{safe(title, '遁甲释义')}</div>
			{list.length ? list.map((item, idx)=>(
				<div key={`dj_tip_${idx}`} className={styles.djTooltipSection}>
					<div className={styles.djTooltipSectionTitle}>{safe(item.title, '说明')}</div>
					<div className={styles.djTooltipItem}>{normalizeTooltipText(item.text)}</div>
				</div>
			)) : <div className={styles.djTooltipItem}>{emptyText || '暂无释义'}</div>}
		</div>
	);
}

function buildDunJiaElementTooltipNode(cell, focusType){
	if(!cell){
		return buildDunJiaTooltipNode('遁甲释义', [], '暂无释义');
	}
	const palaceName = safe(cell.palaceName, '宫位');
	const palaceNum = safe(cell.palaceNum, '—');
	const doorVal = safe(cell.door, '—');
	const baseDoor = safe(cell.baseDoor, '—');
	const isCenter = !!cell.isCenter;
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
			value: `${palaceName}${palaceNum}`,
			text: '用于定位本宫并联动右侧宫位格局查看。',
		},
		yima: {
			title: '驿马',
			value: '驿马',
			text: QIMEN_STATUS_TEXT.驿马,
		},
	};
	const focus = focusMap[focusType] || focusMap.tianGan;
	const ji = cell.jiPatterns && cell.jiPatterns.length ? cell.jiPatterns.join('、') : '无';
	const xiong = cell.xiongPatterns && cell.xiongPatterns.length ? cell.xiongPatterns.join('、') : '无';
	const statusParts = [];
	if(cell.hasJiXing){
		statusParts.push(QIMEN_STATUS_TEXT.击刑);
	}
	if(cell.hasRuMu){
		statusParts.push(QIMEN_STATUS_TEXT.入墓);
	}
	if(cell.hasMenPo){
		statusParts.push(QIMEN_STATUS_TEXT.门迫);
	}
	if(cell.hasKongWang){
		statusParts.push(QIMEN_STATUS_TEXT.空亡);
	}
	if(cell.isYiMa){
		statusParts.push(QIMEN_STATUS_TEXT.驿马);
	}
	const sections = [
		{ title: '当前宫', text: `${palaceName}${palaceNum}` },
		{ title: '当前值', text: `${focus.title}：${focus.value}` },
		{ title: '元素释义', text: focus.text || '暂无释义' },
	];
	if(!isCenter){
		sections.push(
			{ title: '门位', text: `八门：${doorVal}；本位门：${baseDoor}` },
			{ title: '十干克应', text: safe(cell.tenGanResponse, '无') },
			{ title: '八门克应', text: safe(cell.doorBaseResponse, '无') },
			{ title: '奇仪主应', text: safe(cell.doorGanResponse, '无') },
			{ title: '吉格', text: ji },
			{ title: '凶格', text: xiong },
		);
		if(statusParts.length){
			sections.push({ title: '状态', text: statusParts.join('\n') });
		}
	}
	return buildDunJiaTooltipNode(
		`${palaceName}${palaceNum}宫·${focus.title}`,
		sections,
		'暂无释义'
	);
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
		this.onGenderChange = this.onGenderChange.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.genJieqiParams = this.genJieqiParams.bind(this);
		this.ensureJieqiSeed = this.ensureJieqiSeed.bind(this);
		this.prefetchJieqiSeedForFields = this.prefetchJieqiSeedForFields.bind(this);
		this.prefetchNongliForFields = this.prefetchNongliForFields.bind(this);
		this.getContext = this.getContext.bind(this);
		this.requestNongli = this.requestNongli.bind(this);
		this.getLocalNongliFallback = this.getLocalNongliFallback.bind(this);
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
		const base = this.props.fields || {};
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
			this.setState({ loading: true });
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
				this.lastFieldKey = fieldKey;
				this.lastPanSignature = quickPanSignature;
				this.setState({
					nongli: quickResult,
					pan: quickPan,
					loading: false,
				}, ()=>{
					if(quickPan){
						saveModuleAISnapshot('qimen', buildDunJiaSnapshotText(quickPan));
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
					this.lastFieldKey = fieldKey;
					this.lastPanSignature = finalSignature;
					this.setState({
						nongli: finalResult,
						pan: finalPan,
					}, ()=>{
						if(finalPan){
							saveModuleAISnapshot('qimen', buildDunJiaSnapshotText(finalPan));
						}
					});
				}).catch(()=>null);
			}catch(e){
				if(!this.unmounted && seq === this.requestSeq){
					this.setState({ loading: false });
					message.error('遁甲计算失败：历法数据不可用');
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
								overlayStyle={{ maxWidth: 560 }}
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
					<Tooltip title={yiMaTooltip} placement="top" overlayStyle={{ maxWidth: 560 }}>
						<div style={{ ...yiMaStyle, cursor: 'help', pointerEvents: 'auto' }}>🐎</div>
					</Tooltip>
				)}
				<Tooltip title={tianGanTooltip} placement="top" overlayStyle={{ maxWidth: 560 }}>
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
				<Tooltip title={diGanTooltip} placement="top" overlayStyle={{ maxWidth: 560 }}>
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
				<Tooltip title={godTooltip} placement="top" overlayStyle={{ maxWidth: 560 }}>
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
				<Tooltip title={starTooltip} placement="top" overlayStyle={{ maxWidth: 560 }}>
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
				<Tooltip title={doorTooltip} placement="top" overlayStyle={{ maxWidth: 560 }}>
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
					<Tooltip title={palaceTooltip} placement="top" overlayStyle={{ maxWidth: 560 }}>
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
		const dateParts = parseDateLabel(pan.dateStr);
		const dateTitle = `${dateParts.year}年${dateParts.month}月${dateParts.day}日`;
		const directHm = extractHm(pan.timeStr);
		const solarHm = extractHm(pan.realSunTime);
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
									{dateTitle}
								</div>
								{shiftTitle ? (
									<div style={{ fontSize: 16, lineHeight: '20px', fontWeight: 700, color: '#595959' }}>
										{shiftTitle}
									</div>
								) : null}
							</div>
							<div style={{ marginTop: 4, fontSize: 14, lineHeight: '18px', color: '#434343', fontWeight: 600 }}>
								直接时间：{directHm}　真太阳时：{solarHm}
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
		const selectedCell = pan && pan.cells ? pan.cells.find((item)=>item.palaceNum === selectedPalace) : null;
		const fields = this.state.localFields || this.props.fields || {};
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
			{ label: '真太阳时', value: pan ? (pan.realSunTime || '—') : '—' },
			{ label: '干支', value: pan ? `年${pan.ganzhi.year} 月${pan.ganzhi.month} 日${pan.ganzhi.day} 时${pan.ganzhi.time}` : '—' },
			{ label: '节气段', value: pan ? (pan.jiedelta || '—') : '—' },
		];
		const selectedCellRows = selectedCell ? [
			{ label: '当前宫', value: `${selectedCell.palaceName}${selectedCell.palaceNum}` },
			{ label: '天盘干 / 地盘干', value: `${selectedCell.tianGan || '—'} / ${selectedCell.diGan || '—'}` },
			{ label: '八门 / 本位门', value: `${selectedCell.door || '—'} / ${selectedCell.baseDoor || '—'}` },
			{ label: '九星 / 八神', value: `${selectedCell.tianXing || '—'} / ${selectedCell.god || '—'}` },
			{ label: '十干克应', value: selectedCell.tenGanResponse || '无' },
			{ label: '八门克应', value: selectedCell.doorBaseResponse || '无' },
			{ label: '奇仪主应', value: selectedCell.doorGanResponse || '无' },
		] : [];
		const jiCount = pan && pan.jiPatterns && pan.jiPatterns.length ? pan.jiPatterns.length : 0;
		const xiongCount = pan && pan.xiongPatterns && pan.xiongPatterns.length ? pan.xiongPatterns.length : 0;
		const shenshaCount = pan && pan.shenSha && pan.shenSha.allItems && pan.shenSha.allItems.length ? pan.shenSha.allItems.length : 0;
		const cellJiCount = selectedCell && selectedCell.jiPatterns && selectedCell.jiPatterns.length ? selectedCell.jiPatterns.length : 0;
		const cellXiongCount = selectedCell && selectedCell.xiongPatterns && selectedCell.xiongPatterns.length ? selectedCell.xiongPatterns.length : 0;
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
						<Card bordered={false} className={styles.panelCard} bodyStyle={{ padding: '10px 12px', maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
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
						<Card bordered={false} className={styles.panelCard} bodyStyle={{ padding: '10px 12px', maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
							<div style={{ lineHeight: '26px' }}>
								<div className={styles.sectionHint}>按宫位查看判断</div>
								{selectedCell ? (
									<div className={styles.metricRow}>
										<Tag color="geekblue" className={styles.metricTag}>当前宫 {selectedCell.palaceName}{selectedCell.palaceNum}</Tag>
										<Tag color={cellJiCount ? 'green' : 'default'} className={styles.metricTag}>吉格 {cellJiCount}</Tag>
										<Tag color={cellXiongCount ? 'red' : 'default'} className={styles.metricTag}>凶格 {cellXiongCount}</Tag>
									</div>
								) : null}
								<div className={styles.palaceBtnGrid}>
									{pan && pan.cells ? pan.cells.map((cell)=>(
										<Button
											key={`status_cell_btn_${cell.palaceNum}`}
											size="small"
											type={selectedPalace === cell.palaceNum ? 'primary' : 'default'}
											onClick={()=>this.setState({ selectedPalace: cell.palaceNum })}
										>
											{cell.palaceName}{cell.palaceNum}
										</Button>
									)) : null}
								</div>
								{selectedCell ? (
									<div className={styles.detailCard}>
										{selectedCellRows.map((row, idx)=>(
											<div key={`dj_status_row_${idx}`} className={styles.kvItem}>
												<div className={styles.kvLabel}>{row.label}</div>
												<div className={styles.kvValue}>{row.value}</div>
											</div>
										))}
										<div className={styles.patternBlock}>
											<div className={styles.patternLabel}>吉格</div>
											<div className={styles.patternTags}>
												{selectedCell.jiPatterns && selectedCell.jiPatterns.length
													? selectedCell.jiPatterns.map((name)=>(
														<Tag color="green" key={`dj_ji_${selectedCell.palaceNum}_${name}`} className={styles.patternTag}>{name}</Tag>
													))
													: <Tag className={styles.patternTag}>无</Tag>}
											</div>
										</div>
										<div className={styles.patternBlock}>
											<div className={styles.patternLabel}>凶格</div>
											<div className={styles.patternTags}>
												{selectedCell.xiongPatterns && selectedCell.xiongPatterns.length
													? selectedCell.xiongPatterns.map((name)=>(
														<Tag color="red" key={`dj_xiong_${selectedCell.palaceNum}_${name}`} className={styles.patternTag}>{name}</Tag>
													))
													: <Tag className={styles.patternTag}>无</Tag>}
											</div>
										</div>
									</div>
								) : <div className={styles.emptyText}>暂无宫位判断数据</div>}
							</div>
						</Card>
					</TabPane>
					<TabPane tab="神煞" key="shensha">
						<Card bordered={false} className={styles.panelCard} bodyStyle={{ padding: '10px 12px', maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
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
						<Card bordered={false} className={styles.panelCard} bodyStyle={{ padding: '10px 12px', maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
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
								{this.renderBoard()}
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
