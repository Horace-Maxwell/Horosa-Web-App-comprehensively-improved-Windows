import { getStore, } from './storageutil';
import { getAstroAISnapshotForCurrent, saveAstroAISnapshot, loadAstroAISnapshot, } from './astroAiSnapshot';
import { loadModuleAISnapshot, } from './moduleAiSnapshot';
import * as AstroConst from '../constants/AstroConst';
import * as AstroText from '../constants/AstroText';
import { buildMeaningTipByCategory, buildAspectMeaningTip, } from '../components/astro/AstroMeaningData';
import { buildQimenXiangTipObj, } from '../components/dunjia/QimenXiangDoc';
import { buildLiuRengShenTipObj, buildLiuRengHouseTipObj, } from '../components/liureng/LRShenJiangDoc';

const SYMBOL_MAP = {
	'☉': '日',
	'☽': '月',
	'☿': '水',
	'♀': '金',
	'♂': '火',
	'♃': '木',
	'♄': '土',
	'♅': '天王',
	'♆': '海王',
	'♇': '冥王',
	'⚷': '凯龙',
	'☊': '北交',
	'☋': '南交',
	'⊗': '福点',
	'♈': '白羊',
	'♉': '金牛',
	'♊': '双子',
	'♋': '巨蟹',
	'♌': '狮子',
	'♍': '处女',
	'♎': '天秤',
	'♏': '天蝎',
	'♐': '射手',
	'♑': '摩羯',
	'♒': '水瓶',
	'♓': '双鱼',
	'☌': '0˚',
	'⚹': '60˚',
	'✶': '60˚',
	'□': '90˚',
	'△': '120˚',
	'☍': '180˚',
	'⚊': '阳爻',
	'⚋': '阴爻',
	'☰': '乾卦',
	'☱': '兑卦',
	'☲': '离卦',
	'☳': '震卦',
	'☴': '巽卦',
	'☵': '坎卦',
	'☶': '艮卦',
	'☷': '坤卦',
	'☯': '阴阳',
};

const COMMON_REPLACERS = [
	{ regex: /\bConjunction\b/gi, value: '0˚' },
	{ regex: /\bSextile\b/gi, value: '60˚' },
	{ regex: /\bSquare\b/gi, value: '90˚' },
	{ regex: /\bTrine\b/gi, value: '120˚' },
	{ regex: /\bOpposition\b/gi, value: '180˚' },
	{ regex: /\bRetrograde\b/gi, value: '逆行' },
	{ regex: /\bDirect\b/gi, value: '顺行' },
	{ regex: /\bruler\b/gi, value: '本垣' },
	{ regex: /\bexalt\b/gi, value: '擢升' },
	{ regex: /\bterm\b/gi, value: '界' },
	{ regex: /\bface\b/gi, value: '十度' },
	{ regex: /\bfall\b/gi, value: '落陷' },
];

const DOMAIN_REPLACERS = {
	sixyao: [
		{ regex: /老阳/g, value: '阳爻(动)' },
		{ regex: /老阴/g, value: '阴爻(动)' },
		{ regex: /少阳/g, value: '阳爻(静)' },
		{ regex: /少阴/g, value: '阴爻(静)' },
		{ regex: /初爻/g, value: '第一爻' },
		{ regex: /上爻/g, value: '第六爻' },
		{ regex: /旬空/g, value: '旬空(空亡)' },
	],
	liureng: [
		{ regex: /旬空/g, value: '旬空(空亡)' },
		{ regex: /三传/g, value: '三传(初传/中传/末传)' },
		{ regex: /贵人/g, value: '贵人(天乙贵人体系)' },
	],
	jinkou: [
		{ regex: /旬空/g, value: '旬空(空亡)' },
		{ regex: /四大空亡/g, value: '四大空亡(金空/水空)' },
		{ regex: /贵神/g, value: '贵神(天将)' },
		{ regex: /将神/g, value: '将神(月将)' },
		{ regex: /地分/g, value: '地分(取课基准)' },
	],
	qimen: [
		{ regex: /值符/g, value: '值符(主事神)' },
		{ regex: /值使/g, value: '值使(主事门)' },
		{ regex: /九星/g, value: '九星(天蓬天任天冲天辅天英天芮天柱天心天禽)' },
		{ regex: /八门/g, value: '八门(休生伤杜景死惊开)' },
		{ regex: /八神/g, value: '八神(值符螣蛇太阴六合白虎玄武九地九天)' },
		{ regex: /遁甲/g, value: '奇门遁甲' },
	],
};

const ENABLE_SVG_TEXT_EXPORT = false;
const AI_EXPORT_SETTINGS_KEY = 'horosa.ai.export.settings.v1';
export const AI_EXPORT_SETTINGS_VERSION = 6;
const AI_EXPORT_SECTION_MIGRATION_VERSION = 6;
const AI_EXPORT_SECTION_MIGRATION_KEYS = ['liureng', 'qimen', 'sanshiunited'];
const AI_EXPORT_PLANET_INFO_DEFAULT = {
	showHouse: 1,
	showRuler: 1,
};
const AI_EXPORT_ASTRO_MEANING_DEFAULT = {
	enabled: 0,
};
const AI_EXPORT_PLANET_INFO_TECHNIQUES = new Set([
	'astrochart',
	'indiachart',
	'astrochart_like',
	'relative',
	'primarydirect',
	'primarydirchart',
	'zodialrelease',
	'firdaria',
	'profection',
	'solararc',
	'solarreturn',
	'lunarreturn',
	'givenyear',
	'decennials',
	'jieqi',
	'jieqi_meta',
	'jieqi_chunfen',
	'jieqi_xiazhi',
	'jieqi_qiufen',
	'jieqi_dongzhi',
	'sanshiunited',
	'guolao',
	'germany',
]);
const AI_EXPORT_ASTRO_MEANING_TECHNIQUES = new Set([
	...Array.from(AI_EXPORT_PLANET_INFO_TECHNIQUES),
	'otherbu',
	'qimen',
	'liureng',
]);
const AI_EXPORT_HOVER_MEANING_TECHNIQUES = new Set([
	'qimen',
	'liureng',
	'sanshiunited',
]);
const JIEQI_SETTING_PRESETS = {
	jieqi_meta: ['节气盘参数'],
	jieqi_chunfen: ['春分星盘', '春分宿盘'],
	jieqi_xiazhi: ['夏至星盘', '夏至宿盘'],
	jieqi_qiufen: ['秋分星盘', '秋分宿盘'],
	jieqi_dongzhi: ['冬至星盘', '冬至宿盘'],
};
const JIEQI_SPLIT_SETTING_KEYS = Object.keys(JIEQI_SETTING_PRESETS);
const JIEQI_SPLIT_TECHNIQUES = [
	{ key: 'jieqi_meta', label: '节气盘-通用参数' },
	{ key: 'jieqi_chunfen', label: '节气盘-春分' },
	{ key: 'jieqi_xiazhi', label: '节气盘-夏至' },
	{ key: 'jieqi_qiufen', label: '节气盘-秋分' },
	{ key: 'jieqi_dongzhi', label: '节气盘-冬至' },
];

const AI_EXPORT_TECHNIQUES = [
	{ key: 'astrochart', label: '星盘' },
	{ key: 'indiachart', label: '印度律盘' },
	{ key: 'astrochart_like', label: '希腊/星体地图' },
	{ key: 'relative', label: '关系盘' },
	{ key: 'primarydirect', label: '推运盘-主/界限法' },
	{ key: 'primarydirchart', label: '推运盘-主限法盘' },
	{ key: 'zodialrelease', label: '推运盘-黄道星释' },
	{ key: 'firdaria', label: '推运盘-法达星限' },
	{ key: 'profection', label: '推运盘-小限法' },
	{ key: 'solararc', label: '推运盘-太阳弧' },
	{ key: 'solarreturn', label: '推运盘-太阳返照' },
	{ key: 'lunarreturn', label: '推运盘-月亮返照' },
	{ key: 'givenyear', label: '推运盘-流年法' },
	{ key: 'decennials', label: '推运盘-十年大运' },
	{ key: 'bazi', label: '八字' },
	{ key: 'ziwei', label: '紫微斗数' },
	{ key: 'suzhan', label: '宿占' },
	{ key: 'sixyao', label: '易卦' },
	{ key: 'tongshefa', label: '统摄法' },
	{ key: 'liureng', label: '六壬' },
	{ key: 'jinkou', label: '金口诀' },
	{ key: 'qimen', label: '奇门遁甲' },
	{ key: 'sanshiunited', label: '三式合一' },
	{ key: 'taiyi', label: '太乙' },
	{ key: 'guolao', label: '七政四余' },
	{ key: 'germany', label: '量化盘' },
	{ key: 'jieqi', label: '节气盘' },
	...JIEQI_SPLIT_TECHNIQUES,
	{ key: 'otherbu', label: '西洋游戏' },
	{ key: 'fengshui', label: '风水' },
	{ key: 'generic', label: '其他页面' },
];

const AI_EXPORT_PRESET_SECTIONS = {
	astrochart: ['起盘信息', '宫位宫头', '星与虚点', '信息', '相位', '行星', '希腊点', '可能性'],
	indiachart: ['星盘信息', '起盘信息', '信息', '相位', '行星', '希腊点', '可能性'],
	astrochart_like: ['起盘信息', '宫位宫头', '星与虚点', '信息', '相位', '行星', '希腊点', '可能性'],
	relative: ['关系起盘信息', 'A对B相位', 'B对A相位', 'A对B中点相位', 'B对A中点相位', 'A对B映点', 'A对B反映点', 'B对A映点', 'B对A反映点', '合成图盘', '影响图盘-星盘A', '影响图盘-星盘B'],
	primarydirect: ['出生时间', '星盘信息', '主/界限法设置', '主/界限法表格'],
	primarydirchart: ['出生时间', '星盘信息', '主限法盘设置', '主限法盘说明'],
	zodialrelease: ['起盘信息', '星盘信息', '基于X点推运'],
	firdaria: ['出生时间', '星盘信息', '法达星限表格'],
	profection: ['星盘信息', '起盘信息', '相位'],
	solararc: ['星盘信息', '起盘信息', '相位'],
	solarreturn: ['星盘信息', '起盘信息', '相位'],
	lunarreturn: ['星盘信息', '起盘信息', '相位'],
	givenyear: ['星盘信息', '起盘信息', '相位'],
	decennials: ['起盘信息', '星盘信息', '十年大运设置', '基于X起运'],
	bazi: ['起盘信息', '四柱与三元', '流年行运概略', '神煞（四柱与三元）'],
	ziwei: ['起盘信息'],
	suzhan: ['起盘信息'],
	sixyao: ['起盘信息', '卦象', '六爻与动爻', '卦辞与断语'],
	tongshefa: ['本卦', '六爻', '潜藏', '亲和'],
	liureng: [
		'起盘信息',
		'十二盘式',
		'十二地盘/十二天盘/十二贵神对应',
		'四课',
		'三传',
		'行年',
		'旬日',
		'旺衰',
		'基础神煞',
		'干煞',
		'月煞',
		'支煞',
		'岁煞',
		'十二长生',
		'大格',
		'小局',
		'参考',
		'概览',
	],
	jinkou: ['起盘信息', '金口诀速览', '金口诀四位', '四位神煞'],
	taiyi: ['起盘信息', '太乙盘', '十六宫标记'],
	qimen: ['起盘信息', '盘型', '盘面要素', '奇门演卦', '八宫详解', '九宫方盘'],
	sanshiunited: [
		'起盘信息',
		'概览',
		'太乙',
		'太乙十六宫',
		'神煞',
		'大六壬',
		'六壬大格',
		'六壬小局',
		'六壬参考',
		'六壬概览',
		'八宫详解',
		'正北坎宫',
		'东北艮宫',
		'正东震宫',
		'东南巽宫',
		'正南离宫',
		'西南坤宫',
		'正西兑宫',
		'西北乾宫',
	],
	guolao: ['起盘信息', '七政四余宫位与二十八宿星曜', '神煞'],
	germany: ['起盘信息'],
	jieqi: ['节气盘参数', '春分星盘', '春分宿盘', '夏至星盘', '夏至宿盘', '秋分星盘', '秋分宿盘', '冬至星盘', '冬至宿盘'],
	...JIEQI_SETTING_PRESETS,
	otherbu: ['起盘信息'],
	fengshui: ['起盘信息', '标记判定', '冲突清单', '建议汇总', '纳气建议'],
	generic: ['起盘信息'],
};

const AI_EXPORT_FORBIDDEN_SECTIONS = {
	liureng: ['右侧栏目'],
	qimen: ['右侧栏目'],
	sanshiunited: ['右侧栏目'],
};
const MODULE_SNAPSHOT_PREFIX = 'horosa.ai.snapshot.module.v1.';

// ywastr* 字体把术语编码到单字符里，复制后只剩字母，需要反解码。
const STANDALONE_TOKEN_MAP = {
	A: '日',
	B: '月',
	C: '水',
	D: '金',
	E: '火',
	F: '木',
	G: '土',
	H: '天王',
	I: '海王',
	J: '冥王',
	K: '北交',
	L: '南交',
	o: '灵点',
	p: '福点',
	q: '弱点',
	r: '爱点',
	s: '勇点',
	t: '赢点',
	u: '罪点',
	v: '暗月',
	w: '紫气',
	y: '凯龙',
	z: '月亮朔望点',
	$: '月亮平均近地点',
	Y: '月亮平均远地点',
	'{': '',
	'0': '上升',
	'1': '天顶',
	'2': '天底',
	'3': '下降',
	'4': '谷神星',
	'5': '智神星',
	'6': '婚神星',
	'7': '灶神星',
	'8': '人龙星',
	// 相位
	M: '0˚',
	N: '30˚',
	O: '45˚',
	P: '60˚',
	R: '90˚',
	S: '120˚',
	T: '135˚',
	V: '150˚',
	W: '180˚',
	Z: '逆行',
};

const ZODIAC_CODE_MAP = {
	a: '白羊',
	b: '金牛',
	c: '双子',
	d: '巨蟹',
	e: '狮子',
	f: '处女',
	g: '天秤',
	h: '天蝎',
	i: '射手',
	j: '摩羯',
	k: '水瓶',
	l: '双鱼',
};

const ZODIAC_STANDALONE_MAP = {
	a: '白羊',
	b: '金牛',
	c: '双子',
	d: '巨蟹',
	e: '狮子',
	f: '处女',
	g: '天秤',
	h: '天蝎',
	i: '射手',
	j: '摩羯',
	k: '水瓶',
	l: '双鱼',
};

function sleep(ms){
	return new Promise((resolve)=>setTimeout(resolve, ms));
}

function textOf(node){
	if(!node){
		return '';
	}
	return (node.innerText || node.textContent || '').trim();
}

function uniqueArray(arr){
	const out = [];
	const seen = new Set();
	arr.forEach((item)=>{
		if(!item){
			return;
		}
		if(!seen.has(item)){
			seen.add(item);
			out.push(item);
		}
	});
	return out;
}

function safe(text, fallback = ''){
	const val = text === undefined || text === null ? '' : `${text}`.trim();
	if(val){
		return val;
	}
	return `${fallback || ''}`;
}

function normalizePlanetInfoSetting(raw){
	const val = raw && typeof raw === 'object' ? raw : {};
	return {
		showHouse: val.showHouse === 1 || val.showHouse === true ? 1 : 0,
		showRuler: val.showRuler === 1 || val.showRuler === true ? 1 : 0,
	};
}

function isPlanetInfoTechnique(key){
	return AI_EXPORT_PLANET_INFO_TECHNIQUES.has(`${key || ''}`);
}

function normalizeAstroMeaningSetting(raw){
	if(raw === 1 || raw === true){
		return { enabled: 1 };
	}
	if(raw === 0 || raw === false){
		return { enabled: 0 };
	}
	const val = raw && typeof raw === 'object' ? raw : {};
	return {
		enabled: val.enabled === 1 || val.enabled === true ? 1 : 0,
	};
}

function isAstroMeaningTechnique(key){
	return AI_EXPORT_ASTRO_MEANING_TECHNIQUES.has(`${key || ''}`);
}

function isHoverMeaningTechnique(key){
	return AI_EXPORT_HOVER_MEANING_TECHNIQUES.has(`${key || ''}`);
}

function getMeaningSettingMetaByTechnique(key){
	if(isHoverMeaningTechnique(key)){
		return {
			title: '悬浮注释（仅AI导出）：',
			checkbox: '在对应分段输出六壬/遁甲/占星悬浮注释',
		};
	}
	if(isAstroMeaningTechnique(key)){
		return {
			title: '占星注释（仅AI导出）：',
			checkbox: '在对应分段输出星/宫/座/相/希腊点释义',
		};
	}
	return {
		title: '',
		checkbox: '',
	};
}

function getPlanetInfoSettingByTechnique(settings, key){
	if(!isPlanetInfoTechnique(key)){
		return {
			showHouse: 0,
			showRuler: 0,
		};
	}
	const source = settings && settings.planetInfo && typeof settings.planetInfo === 'object'
		? settings.planetInfo[key]
		: null;
	if(!source){
		return {
			...AI_EXPORT_PLANET_INFO_DEFAULT,
		};
	}
	return normalizePlanetInfoSetting(source);
}

function getAstroMeaningSettingByTechnique(settings, key){
	if(!isAstroMeaningTechnique(key) && !isHoverMeaningTechnique(key)){
		return {
			enabled: 0,
		};
	}
	const source = settings && settings.astroMeaning && typeof settings.astroMeaning === 'object'
		? settings.astroMeaning[key]
		: null;
	if(!source){
		return {
			...AI_EXPORT_ASTRO_MEANING_DEFAULT,
		};
	}
	return normalizeAstroMeaningSetting(source);
}

function normalizeSectionTitle(title){
	const t = `${title || ''}`.trim();
	if(!t){
		return '';
	}
	if(/^基于.+推运$/.test(t)){
		return '基于X点推运';
	}
	if(/^基于.+起运$/.test(t)){
		return '基于X起运';
	}
	return t;
}

function parseSectionTitleLine(line){
	const txt = `${line || ''}`.trim();
	if(!txt){
		return '';
	}
	let m = txt.match(/^\[(.+)\]$/);
	if(!m || !m[1]){
		m = txt.match(/^【(.+)】$/);
	}
	if(m && m[1]){
		return normalizeSectionTitle(m[1]);
	}
	return '';
}

function extractSectionTitles(content){
	const lines = `${content || ''}`.split('\n');
	const titles = [];
	lines.forEach((line)=>{
		const normalized = parseSectionTitleLine(line);
		if(normalized){
			titles.push(normalized);
		}
	});
	return uniqueArray(titles);
}

function normalizeAIExportSettings(settings){
	const sourceVersion = settings && typeof settings === 'object'
		? parseInt(`${settings.version || 0}`, 10) || 0
		: 0;
	const normalized = {
		version: AI_EXPORT_SETTINGS_VERSION,
		sections: {},
		planetInfo: {},
		astroMeaning: {},
	};
	if(!settings || typeof settings !== 'object'){
		return normalized;
	}
	const sections = settings.sections && typeof settings.sections === 'object' ? settings.sections : {};
	Object.keys(sections).forEach((key)=>{
		const arr = Array.isArray(sections[key]) ? sections[key] : [];
		normalized.sections[key] = uniqueArray(arr.map((item)=>mapLegacySectionTitle(key, item)).filter(Boolean));
	});
	if(sourceVersion < AI_EXPORT_SECTION_MIGRATION_VERSION){
		AI_EXPORT_SECTION_MIGRATION_KEYS.forEach((key)=>{
			if(!Object.prototype.hasOwnProperty.call(sections, key)){
				return;
			}
			const preset = Array.isArray(AI_EXPORT_PRESET_SECTIONS[key]) ? AI_EXPORT_PRESET_SECTIONS[key] : [];
			const merged = uniqueArray([
				...(normalized.sections[key] || []),
				...preset.map((item)=>normalizeSectionTitle(item)).filter(Boolean),
			]);
			normalized.sections[key] = merged;
		});
	}
	const planetInfo = settings.planetInfo && typeof settings.planetInfo === 'object' ? settings.planetInfo : {};
	const legacyPlanetMeta = settings.planetMeta && typeof settings.planetMeta === 'object' ? settings.planetMeta : {};
	Object.keys(planetInfo).forEach((key)=>{
		if(!isPlanetInfoTechnique(key)){
			return;
		}
		normalized.planetInfo[key] = normalizePlanetInfoSetting(planetInfo[key]);
	});
	Object.keys(legacyPlanetMeta).forEach((key)=>{
		if(!isPlanetInfoTechnique(key) || normalized.planetInfo[key]){
			return;
		}
		normalized.planetInfo[key] = normalizePlanetInfoSetting(legacyPlanetMeta[key]);
	});
	const astroMeaning = settings.astroMeaning && typeof settings.astroMeaning === 'object' ? settings.astroMeaning : {};
	const legacyAnnotations = settings.annotations && typeof settings.annotations === 'object' ? settings.annotations : {};
	Object.keys(astroMeaning).forEach((key)=>{
		if(!isAstroMeaningTechnique(key) && !isHoverMeaningTechnique(key)){
			return;
		}
		normalized.astroMeaning[key] = normalizeAstroMeaningSetting(astroMeaning[key]);
	});
	Object.keys(legacyAnnotations).forEach((key)=>{
		if(normalized.astroMeaning[key]){
			return;
		}
		if(!isAstroMeaningTechnique(key) || isHoverMeaningTechnique(key)){
			return;
		}
		normalized.astroMeaning[key] = normalizeAstroMeaningSetting(legacyAnnotations[key]);
	});
	normalized.planetMeta = {
		...normalized.planetInfo,
	};
	normalized.annotations = {};
	Object.keys(normalized.astroMeaning).forEach((key)=>{
		if(isHoverMeaningTechnique(key)){
			return;
		}
		normalized.annotations[key] = normalized.astroMeaning[key].enabled === 1 ? 1 : 0;
	});
	return normalized;
}

function snapshotModuleKeyByContextKey(key){
	if(key === 'sixyao'){
		return 'guazhan';
	}
	return key;
}

function isJieQiSplitSettingKey(key){
	return JIEQI_SPLIT_SETTING_KEYS.includes(key);
}

function getJieQiCachedContent(){
	const current = getModuleCachedContent('jieqi_current');
	const whole = getModuleCachedContent('jieqi');
	return [current, whole].filter(Boolean).join('\n\n');
}

async function requestModuleSnapshotRefresh(moduleName){
	if(!moduleName || typeof window === 'undefined'){
		return '';
	}
	const before = `${getModuleCachedContent(moduleName) || ''}`.trim();
	const detail = {
		module: moduleName,
		snapshotText: '',
	};
	try{
		window.dispatchEvent(new CustomEvent('horosa:refresh-module-snapshot', {
			detail,
		}));
	}catch(e){
		return '';
	}
	// 某些模块会在事件回调里触发异步重算后才写快照；轮询一小段时间。
	const stepMs = 120;
	const maxWaitMs = 3200;
	let waited = 0;
	while(waited <= maxWaitMs){
		const direct = typeof detail.snapshotText === 'string'
			? `${detail.snapshotText}`.trim()
			: '';
		if(direct){
			return direct;
		}
		const cached = `${getModuleCachedContent(moduleName) || ''}`.trim();
		if(cached && (cached !== before || waited >= 480)){
			return cached;
		}
		// 等待下一个轮询周期
		// eslint-disable-next-line no-await-in-loop
		await sleep(stepMs);
		waited += stepMs;
	}
	const direct = typeof detail.snapshotText === 'string'
		? `${detail.snapshotText}`.trim()
		: '';
	if(direct){
		return direct;
	}
	const cached = `${getModuleCachedContent(moduleName) || ''}`.trim();
	return cached || before || '';
}

function getCachedContentForTechnique(key){
	if(key === 'astrochart' || key === 'astrochart_like'){
		return getAstroCachedContent();
	}
	if(key === 'indiachart'){
		return getIndiaCachedContent('');
	}
	if(key === 'jieqi' || isJieQiSplitSettingKey(key)){
		return getJieQiCachedContent();
	}
	if(key === 'generic'){
		return '';
	}
	const moduleKey = snapshotModuleKeyByContextKey(key);
	return getModuleCachedContent(moduleKey);
}

function getOptionsForTechniqueKey(key){
	const preset = AI_EXPORT_PRESET_SECTIONS[key] || [];
	const forbidden = getForbiddenSectionSet(key);
	const cachedTitles = extractSectionTitles(getCachedContentForTechnique(key))
		.map((item)=>mapLegacySectionTitle(key, item))
		.filter(Boolean)
		.filter((item)=>!forbidden || !forbidden.has(normalizeSectionTitle(item)));
	if(isJieQiSplitSettingKey(key)){
		const wanted = new Set(preset.map((item)=>normalizeSectionTitle(item)));
		const filtered = cachedTitles.filter((item)=>wanted.has(normalizeSectionTitle(item)));
		return uniqueArray([...preset, ...filtered]);
	}
	return uniqueArray([...preset, ...cachedTitles].filter((item)=>!forbidden || !forbidden.has(normalizeSectionTitle(item))));
}

function splitContentSections(content){
	const lines = `${content || ''}`.split('\n');
	const sections = [];
	let currentTitle = '';
	let currentLines = [];

	const pushCurrent = ()=>{
		if(!currentTitle && currentLines.every((line)=>!`${line || ''}`.trim())){
			currentLines = [];
			return;
		}
		sections.push({
			title: currentTitle,
			lines: currentLines.slice(0),
		});
		currentLines = [];
	};

	lines.forEach((line)=>{
		const title = parseSectionTitleLine(line);
		if(title){
			if(currentLines.length){
				pushCurrent();
			}
			currentTitle = title;
			currentLines = [line];
			return;
		}
		currentLines.push(line);
	});
	if(currentLines.length){
		pushCurrent();
	}
	return sections;
}

function filterContentByWantedSections(content, wanted){
	const sections = splitContentSections(content);
	if(sections.length === 0){
		return content;
	}
	if(!wanted || wanted.size === 0){
		return '';
	}
	const kept = sections.filter((sec)=>{
		if(!sec.title){
			return true;
		}
		return wanted.has(normalizeSectionTitle(sec.title));
	});
	if(kept.length === 0){
		return '';
	}
	const out = [];
	kept.forEach((sec)=>{
		if(out.length && out[out.length - 1] !== ''){
			out.push('');
		}
		out.push(...sec.lines);
	});
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function mapLegacySectionTitle(key, title){
	const normalized = normalizeSectionTitle(title);
	if(key === 'tongshefa'){
		if(normalized === '互潜'){
			return '潜藏';
		}
		if(normalized === '错亲'){
			return '亲和';
		}
		if(normalized === '统摄法起盘'){
			return '本卦';
		}
		return normalized;
	}
	if(key === 'qimen'){
		if(normalized === '八宫'){
			return '八宫详解';
		}
		if(normalized === '演卦'){
			return '奇门演卦';
		}
		if(normalized === '九宫'){
			return '九宫方盘';
		}
		if(normalized === '右侧栏目' || normalized === '概览'){
			return '盘面要素';
		}
	}
	if(key === 'liureng'){
		if(normalized === '大格命中'){
			return '大格';
		}
		if(normalized === '小局命中'){
			return '小局';
		}
		if(normalized.startsWith('三传(')){
			return '三传';
		}
	}
	if(key === 'sanshiunited'){
		if(normalized === '状态'){
			return '概览';
		}
		if(normalized === '八宫'){
			return '八宫详解';
		}
		if(normalized === '大格'){
			return '六壬大格';
		}
		if(normalized === '小局'){
			return '六壬小局';
		}
		if(normalized === '参考'){
			return '六壬参考';
		}
		if(normalized === '六壬格局概览'){
			return '六壬概览';
		}
	}
	if(key === 'sixyao'){
		if(normalized === '起卦方式'){
			return '卦象';
		}
		if(normalized === '卦辞'){
			return '卦辞与断语';
		}
	}
	return normalized;
}

function getForbiddenSectionSet(key){
	const list = AI_EXPORT_FORBIDDEN_SECTIONS[key];
	if(!list || !list.length){
		return null;
	}
	return new Set(list.map((item)=>normalizeSectionTitle(item)).filter(Boolean));
}

function stripForbiddenSections(content, key){
	const forbidden = getForbiddenSectionSet(key);
	if(!forbidden || !content){
		return content;
	}
	const sections = splitContentSections(content);
	if(!sections.length){
		return content;
	}
	const kept = sections.filter((sec)=>{
		if(!sec.title){
			return true;
		}
		const title = normalizeSectionTitle(sec.title);
		return !forbidden.has(title);
	});
	if(!kept.length){
		return '';
	}
	const out = [];
	kept.forEach((sec)=>{
		if(out.length && out[out.length - 1] !== ''){
			out.push('');
		}
		out.push(...sec.lines);
	});
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function applyUserSectionFilter(content, key){
	const settings = loadAIExportSettings();
	const selected = settings.sections[key];
	if(!Array.isArray(selected)){
		return stripForbiddenSections(content, key);
	}
	const preset = Array.isArray(AI_EXPORT_PRESET_SECTIONS[key]) ? AI_EXPORT_PRESET_SECTIONS[key] : [];
	const picked = selected.length ? selected.slice(0) : preset.slice(0);
	if(key === 'jinkou'){
		picked.push('金口诀速览');
	}else if(key === 'liureng'){
		// 格局参考为六壬导出的核心内容，避免被旧设置误过滤掉。
		picked.push('大格', '小局', '参考', '概览');
	}else if(key === 'qimen'){
		// 新增分段可能被旧配置遗漏，默认保留遁甲关键输出。
		picked.push('盘面要素', '奇门演卦', '八宫详解');
	}else if(key === 'sanshiunited'){
		// 新增三式合一分段：六壬格局参考与八宫详解。
		picked.push('六壬大格', '六壬小局', '六壬参考', '六壬概览', '八宫详解');
	}
	const forbidden = getForbiddenSectionSet(key);
	const normalizedPicked = picked
		.map((item)=>mapLegacySectionTitle(key, item))
		.filter(Boolean)
		.filter((item)=>!forbidden || !forbidden.has(normalizeSectionTitle(item)));
	const wanted = new Set(uniqueArray(normalizedPicked));
	if(wanted.size === 0){
		return stripForbiddenSections(content, key);
	}
	const filtered = filterContentByWantedSections(content, wanted);
	if(!`${filtered || ''}`.trim()){
		// 用户设置与实际分段不一致时回退原文，避免导出空白。
		return stripForbiddenSections(content, key);
	}
	return stripForbiddenSections(filtered, key);
}

function getJieQiWantedSections(settings){
	const sections = settings && settings.sections && typeof settings.sections === 'object'
		? settings.sections
		: {};
	const hasSplitConfig = JIEQI_SPLIT_SETTING_KEYS.some((key)=>Object.prototype.hasOwnProperty.call(sections, key));
	if(!hasSplitConfig){
		if(!Object.prototype.hasOwnProperty.call(sections, 'jieqi')){
			return null;
		}
		const legacy = Array.isArray(sections.jieqi) ? sections.jieqi : [];
		return new Set(legacy.map((item)=>normalizeSectionTitle(item)));
	}
	const wanted = new Set();
	JIEQI_SPLIT_SETTING_KEYS.forEach((key)=>{
		const defaults = AI_EXPORT_PRESET_SECTIONS[key] || [];
		const picked = Object.prototype.hasOwnProperty.call(sections, key)
			? (Array.isArray(sections[key]) ? sections[key] : [])
			: defaults;
		picked.forEach((item)=>{
			const normalized = normalizeSectionTitle(item);
			if(normalized){
				wanted.add(normalized);
			}
		});
	});
	return wanted;
}

function applyUserSectionFilterByContext(content, key){
	if(key !== 'jieqi'){
		return applyUserSectionFilter(content, key);
	}
	const settings = loadAIExportSettings();
	const wanted = getJieQiWantedSections(settings);
	if(wanted === null){
		return content;
	}
	const filtered = filterContentByWantedSections(content, wanted);
	if(!`${filtered || ''}`.trim()){
		return content;
	}
	return filtered;
}

function trimPlanetInfoBySetting(content, setting){
	const source = `${content || ''}`;
	const mode = normalizePlanetInfoSetting(setting);
	const showHouse = mode.showHouse === 1;
	const showRuler = mode.showRuler === 1;
	if(showHouse && showRuler){
		return source;
	}
	const isPlanetInfoInner = (inner)=>{
		const txt = `${inner || ''}`.trim();
		if(!txt){
			return false;
		}
		if(/^后天[:：]/.test(txt)){
			return true;
		}
		if(/\b\d{1,2}th\b/i.test(txt)){
			return true;
		}
		if(/\b\d{1,2}R(?:\d{1,2}R)*\b/i.test(txt)){
			return true;
		}
		if(/主.+宫/.test(txt)){
			return true;
		}
		if(/宫位未知|主宫未知/.test(txt)){
			return true;
		}
		if(/[一二三四五六七八九十]+宫/.test(txt)){
			return true;
		}
		return false;
	};
	const splitPlanetInfoParts = (inner)=>{
		const txt = `${inner || ''}`.replace(/^后天[:：]\s*/, '').trim();
		const segs = txt.split(/[；;]/).map((item)=>`${item || ''}`.trim()).filter(Boolean);
		let housePart = '';
		let rulerPart = '';
		segs.forEach((seg)=>{
			if(!housePart && /^(\d{1,2}th|-)$/i.test(seg)){
				housePart = seg;
				return;
			}
			if(!rulerPart && /^\d{1,2}R(?:\d{1,2}R)*$/i.test(seg)){
				rulerPart = seg.toUpperCase();
				return;
			}
			if(!rulerPart && (/^主/.test(seg) || /\b\d{1,2}R(?:\d{1,2}R)*\b/i.test(seg))){
				rulerPart = seg;
				return;
			}
			if(!housePart && /宫/.test(seg)){
				housePart = seg;
				return;
			}
			if(!housePart){
				housePart = seg;
				return;
			}
			if(!rulerPart){
				rulerPart = seg;
			}
		});
		if(!housePart){
			const houseMatch = txt.match(/\b(\d{1,2}th|-)\b/i);
			if(houseMatch && houseMatch[1]){
				housePart = houseMatch[1];
			}
		}
		if(!rulerPart){
			const rulerMatch = txt.match(/\b(\d{1,2}R(?:\d{1,2}R)*)\b/i);
			if(rulerMatch && rulerMatch[1]){
				rulerPart = rulerMatch[1].toUpperCase();
			}
		}
		return {
			housePart: `${housePart || ''}`.trim(),
			rulerPart: `${rulerPart || ''}`.trim(),
		};
	};
	const replaceBracket = (whole, left, inner, right)=>{
		if(!isPlanetInfoInner(inner)){
			return whole;
		}
		const one = splitPlanetInfoParts(inner);
		const pieces = [];
		if(showHouse && one.housePart){
			pieces.push(one.housePart);
		}
		if(showRuler && one.rulerPart){
			pieces.push(one.rulerPart);
		}
		if(!pieces.length){
			return '';
		}
		return `${left}${pieces.join('; ')}${right}`;
	};
	let out = source.replace(/([（(])([^（）()]*)([）)])/g, replaceBracket);
	return out
		.replace(/[ \t]{2,}/g, ' ')
		.replace(/([（(])\s*([）)])/g, '')
		.replace(/\n{3,}/g, '\n\n');
}

function applyPlanetInfoFilterByContext(content, key){
	if(!isPlanetInfoTechnique(key)){
		return content;
	}
	const settings = loadAIExportSettings();
	const planetInfo = getPlanetInfoSettingByTechnique(settings, key);
	return trimPlanetInfoBySetting(content, planetInfo);
}

function normalizeWhitespace(text){
	return (text || '')
		.replace(/\r\n/g, '\n')
		.split('\n')
		.map((line)=>line.replace(/[\t ]+/g, ' ').replace(/[ ]+$/g, '').trimEnd())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function replaceStandaloneToken(text, token, replacement){
	const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(`(^|[\\s,，;；:：()\\[\\]{}\\/\\\\|])${esc}(?=$|[\\s,，;；:：()\\[\\]{}\\/\\\\|])`, 'g');
	return text.replace(pattern, `$1${replacement}`);
}

function likelyHasFontEncodedTokens(text){
	const src = `${text || ''}`;
	if(!src){
		return false;
	}
	if(/[☉☽☿♀♂♃♄♅♆♇⚷☊☋⊗♈♉♊♋♌♍♎♏♐♑♒♓☌⚹✶□△☍]/.test(src)){
		return true;
	}
	if(/(^|[\s,，;；:：()\[\]{}\\/|])([A-Za-z${}])(?=$|[\s,，;；:：()\[\]{}\\/|])/m.test(src)){
		return true;
	}
	if(/[a-l](?=\d{1,2}分)/.test(src)){
		return true;
	}
	return false;
}

function replaceFontEncodedTokens(text){
	let out = text || '';

	// 27˚k52分 / 27°k52分 -> 27˚水瓶52分
	out = out.replace(/(^|[^A-Za-z0-9\u4E00-\u9FFF])(\d{1,2})\s*[˚°º]\s*([a-l])\s*([0-5]?\d)\s*分/gi, (m, p1, deg, code, min)=>{
		const zodiac = ZODIAC_CODE_MAP[code.toLowerCase()] || code;
		return `${p1}${deg}˚${zodiac}${min}分`;
	});
	// 16k16分 -> 16˚水瓶16分
	out = out.replace(/(^|[^A-Za-z0-9\u4E00-\u9FFF])(\d{1,2})\s*([a-l])\s*([0-5]?\d)\s*分/gi, (m, p1, deg, code, min)=>{
		const zodiac = ZODIAC_CODE_MAP[code.toLowerCase()] || code;
		return `${p1}${deg}˚${zodiac}${min}分`;
	});

	// A（日）/ 8（人龙星）/ {（信心点） 这类前缀编码，保留括号中的中文名。
	out = out.replace(/(^|[\s\-•*])([A-Za-z0-9${}])\s*[（(]\s*([^）)]+)\s*[）)]/gm, (m, p1, token, label)=>{
		const name = (label || '').trim();
		if(!name){
			const mapped = STANDALONE_TOKEN_MAP[token];
			return `${p1}${mapped || ''}`;
		}
		return `${p1}${name}`;
	});

	Object.keys(STANDALONE_TOKEN_MAP).forEach((token)=>{
		out = replaceStandaloneToken(out, token, STANDALONE_TOKEN_MAP[token]);
	});

	// 星座单字母残留（如: a , 土 , 海王）转中文星座名。
	Object.keys(ZODIAC_STANDALONE_MAP).forEach((token)=>{
		out = replaceStandaloneToken(out, token, ZODIAC_STANDALONE_MAP[token]);
	});

	// 去掉孤立的编码符号残留。
	out = out.replace(/(^|[\s,，;；:：\-•*])([{]+)(?=$|[\s,，;；:：\-•*])/g, '$1');

	return out;
}

function canonicalLine(text){
	return (text || '')
		.replace(/\s+/g, '')
		.replace(/[，,。；;:：、·'"`~!！?？\[\]\(\)（）{}<>《》【】]/g, '')
		.trim();
}

function isNoiseLine(text){
	const val = (text || '').trim();
	if(!val){
		return true;
	}
	if(val === '[图形标注文本]'){
		return true;
	}
	if(val === '打印星盘'){
		return true;
	}
	if(/^[A-Za-z${}|\\/]{1,2}$/.test(val)){
		return true;
	}
	if(/^\[符号U\+[0-9A-F]+\]$/.test(val)){
		return true;
	}
	return false;
}

function beautifyForAI(text){
	const srcLines = (text || '').split('\n');
	const out = [];
	let sectionSeen = new Set();

	const pushLine = (line)=>{
		const val = line.trim();
		if(!val || isNoiseLine(val)){
			return;
		}
		if(/^\[.+\]$/.test(val)){
			if(out.length && out[out.length - 1] !== ''){
				out.push('');
			}
			out.push(val);
			out.push('');
			sectionSeen = new Set();
			return;
		}
		const clean = val.replace(/^[-*]\s*/, '').trim();
		if(!clean || isNoiseLine(clean)){
			return;
		}
		const key = canonicalLine(clean);
		if(!key || sectionSeen.has(key)){
			return;
		}
		sectionSeen.add(key);
		out.push(`- ${clean}`);
		out.push('');
	};

	srcLines.forEach((line)=>{
		if(!line){
			return;
		}
		// 长句按常见断句符拆分，提高可读性
		const broken = line.length > 100 ? line.replace(/([。；;！？!?])/g, '$1\n') : line;
		broken.split('\n').forEach((seg)=>pushLine(seg));
	});

	while(out.length && !out[out.length - 1]){
		out.pop();
	}

	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function collectSvgTexts(root){
	if(!root){
		return [];
	}
	const vals = [];
	root.querySelectorAll('svg text').forEach((n)=>{
		const t = (n.textContent || '').trim();
		if(t){
			vals.push(t);
		}
	});
	return uniqueArray(vals);
}

function getTabsNavItems(container){
	if(!container){
		return [];
	}
	const directNav = Array.from(container.children).find((n)=>n.classList && n.classList.contains('ant-tabs-nav'));
	if(directNav){
		return Array.from(directNav.querySelectorAll('.ant-tabs-tab'));
	}
	return Array.from(container.querySelectorAll('.ant-tabs-nav .ant-tabs-tab'));
}

function getDirectActivePane(container){
	if(!container){
		return null;
	}
	const holder = Array.from(container.children).find((n)=>n.classList && n.classList.contains('ant-tabs-content-holder'));
	if(holder){
		const content = holder.querySelector('.ant-tabs-content');
		if(content){
			const direct = Array.from(content.children).find((n)=>n.classList && n.classList.contains('ant-tabs-tabpane-active'));
			if(direct){
				return direct;
			}
		}
		const any = holder.querySelector('.ant-tabs-tabpane-active');
		if(any){
			return any;
		}
	}
	return container.querySelector('.ant-tabs-tabpane-active');
}

function findTabsContainerByLabels(scopeRoot, labels, requireAll){
	if(!scopeRoot){
		return null;
	}
	const tabs = Array.from(scopeRoot.querySelectorAll('.ant-tabs'));
	for(let i=0; i<tabs.length; i++){
		const tab = tabs[i];
		const names = getTabsNavItems(tab).map((n)=>textOf(n));
		if(names.length === 0){
			continue;
		}
		let ok = false;
		if(requireAll){
			ok = labels.every((k)=>names.some((v)=>v.includes(k)));
		}else{
			ok = labels.some((k)=>names.some((v)=>v.includes(k)));
		}
		if(ok){
			return tab;
		}
	}
	return null;
}

function findTopTabsContainer(root){
	if(!root){
		return null;
	}
	const topLabelHints = [
		'星盘',
		'三维盘',
		'推运盘',
		'量化盘',
		'关系盘',
		'节气盘',
		'希腊星术',
		'印度律盘',
		'八字紫微',
		'易与三式',
		'七政四余',
		'风水',
		'三式合一',
	];
	const tabs = Array.from(root.querySelectorAll('.ant-tabs'));
	let best = null;
	let bestScore = -1;
	let bestNavCount = -1;
	for(let i=0; i<tabs.length; i++){
		const names = getTabsNavItems(tabs[i]).map((n)=>textOf(n));
		if(names.includes('星盘') && names.includes('易与三式')){
			return tabs[i];
		}
		if(!names.length){
			continue;
		}
		let score = 0;
		topLabelHints.forEach((hint)=>{
			if(names.some((txt)=>txt && txt.includes(hint))){
				score += 1;
			}
		});
		const navCount = names.filter(Boolean).length;
		if(score > bestScore || (score === bestScore && navCount > bestNavCount)){
			bestScore = score;
			best = tabs[i];
			bestNavCount = navCount;
		}
	}
	if(best && bestScore > 0){
		return best;
	}
	const leftTabs = root.querySelector('.ant-tabs-left');
	if(leftTabs){
		return leftTabs;
	}
	if(best){
		return best;
	}
	return tabs[0] || null;
}

function detectChartTypeInPane(scopeRoot){
	if(!scopeRoot){
		return '';
	}
	const items = Array.from(scopeRoot.querySelectorAll('.ant-select-selection-item'));
	for(let i=0; i<items.length; i++){
		const txt = textOf(items[i]);
		if(txt.includes('外盘')){
			return txt;
		}
	}
	return '';
}

function findIndiaActivePane(scopeRoot){
	if(!scopeRoot){
		return {
			pane: null,
			label: '',
		};
	}
	const tabs = Array.from(scopeRoot.querySelectorAll('.ant-tabs'));
	for(let i=0; i<tabs.length; i++){
		const tab = tabs[i];
		const names = getTabsNavItems(tab).map((n)=>textOf(n));
		if(!names.some((n)=>n.includes('命盘'))){
			continue;
		}
		if(!names.some((n)=>n.includes('律盘'))){
			continue;
		}
		const active = getTabsNavItems(tab).find((n)=>n.classList.contains('ant-tabs-tab-active'));
		return {
			pane: getDirectActivePane(tab),
			label: textOf(active),
		};
	}
	return {
		pane: null,
		label: '',
	};
}

function resolveActiveContext(){
	const root = document.getElementById('mainContent') || document.body;
	const topTabs = findTopTabsContainer(root);
	if(!topTabs){
		return {
			displayName: '当前技术',
			key: 'generic',
			domain: null,
			scopeRoot: root,
		};
	}

	const topActiveTab = getTabsNavItems(topTabs).find((n)=>n.classList.contains('ant-tabs-tab-active'));
	const topLabel = textOf(topActiveTab) || '当前技术';
	const topPane = getDirectActivePane(topTabs) || root;

	const context = {
		displayName: topLabel,
		key: 'generic',
		domain: null,
		scopeRoot: topPane,
		topLabel,
		subLabel: '',
		chartType: '',
	};

	const predictiveLabelMap = [
		{ label: '主/界限法', key: 'primarydirect', name: '推运盘-主/界限法' },
		{ label: '主限法盘', key: 'primarydirchart', name: '推运盘-主限法盘' },
		{ label: '黄道星释', key: 'zodialrelease', name: '推运盘-黄道星释' },
		{ label: '法达星限', key: 'firdaria', name: '推运盘-法达星限' },
		{ label: '小限法', key: 'profection', name: '推运盘-小限法' },
		{ label: '太阳弧', key: 'solararc', name: '推运盘-太阳弧' },
		{ label: '太阳返照', key: 'solarreturn', name: '推运盘-太阳返照' },
		{ label: '月亮返照', key: 'lunarreturn', name: '推运盘-月亮返照' },
		{ label: '流年法', key: 'givenyear', name: '推运盘-流年法' },
		{ label: '十年大运', key: 'decennials', name: '推运盘-十年大运' },
	];
	const predictiveByTop = predictiveLabelMap.find((item)=>topLabel && topLabel.includes(item.label));
	if(predictiveByTop){
		context.key = predictiveByTop.key;
		context.domain = 'predictive_raw';
		context.displayName = predictiveByTop.name;
		return context;
	}
	// 右侧子标签直接激活时，顶层标题可能不是“推运盘/量化盘/关系盘/印度律盘”等；
	// 这里优先按可见标签做直达识别，避免落入 generic 导致导出误判为空。
	if(topLabel.includes('行星中点')){
		context.key = 'germany';
		context.displayName = '量化盘';
		return context;
	}
	if(topLabel.includes('比较盘') || topLabel.includes('组合盘')
		|| topLabel.includes('影响盘') || topLabel.includes('时空中点盘')
		|| topLabel.includes('马克斯盘')){
		context.key = 'relative';
		context.displayName = `关系盘-${topLabel}`;
		return context;
	}
	if(topLabel.includes('命盘') || /(^|\s)\d+\s*律盘$/.test(topLabel)){
		context.key = 'indiachart';
		context.displayName = '印度律盘';
		return context;
	}
	if(topLabel.includes('节气') || topLabel.includes('春分') || topLabel.includes('夏至')
		|| topLabel.includes('秋分') || topLabel.includes('冬至')){
		context.key = 'jieqi';
		context.displayName = '节气盘';
		return context;
	}
	if(topLabel === '八字' || (topLabel.includes('八字') && !topLabel.includes('八字紫微'))){
		context.key = 'bazi';
		context.displayName = '八字';
		return context;
	}
	if(topLabel.includes('紫微') && !topLabel.includes('八字紫微')){
		context.key = 'ziwei';
		context.displayName = '紫微斗数';
		return context;
	}

	if(topLabel.includes('推运盘')){
		const subTabs = findTabsContainerByLabels(topPane, ['主/界限法', '黄道星释', '法达星限', '小限法', '太阳弧', '太阳返照', '月亮返照', '流年法', '十年大运'], false);
		const subActiveTab = subTabs ? getTabsNavItems(subTabs).find((n)=>n.classList.contains('ant-tabs-tab-active')) : null;
		const subLabel = textOf(subActiveTab);
		context.subLabel = subLabel || '';
		context.scopeRoot = subTabs ? (getDirectActivePane(subTabs) || topPane) : topPane;
		const predictiveBySub = predictiveLabelMap.find((item)=>subLabel && subLabel.includes(item.label));
		if(predictiveBySub){
			context.key = predictiveBySub.key;
			context.domain = 'predictive_raw';
			context.displayName = predictiveBySub.name;
			return context;
		}
		// 子标签识别失败时不要回落到星盘；保留 direction 触发 store 回退，
		// 否则会误读 astrochart 快照并造成“当前页面没有可导出文本”。
		context.key = 'direction';
		context.domain = 'predictive_raw';
		context.displayName = subLabel ? `推运盘-${subLabel}` : '推运盘';
		return context;
	}
	const directCnYiBuMap = [
		{ label: '统摄法', key: 'tongshefa', domain: 'tongshefa', name: '统摄法' },
		{ label: '易卦', key: 'sixyao', domain: 'sixyao', name: '易卦' },
		{ label: '六壬', key: 'liureng', domain: 'liureng', name: '大六壬' },
		{ label: '金口诀', key: 'jinkou', domain: 'jinkou', name: '金口诀' },
		{ label: '遁甲', key: 'qimen', domain: 'qimen', name: '奇门遁甲' },
		{ label: '太乙', key: 'taiyi', domain: null, name: '太乙' },
	];
	const directCnYiBu = directCnYiBuMap.find((item)=>topLabel && topLabel.includes(item.label));
	if(directCnYiBu){
		context.key = directCnYiBu.key;
		context.domain = directCnYiBu.domain;
		context.displayName = directCnYiBu.name;
		return context;
	}
	if(topLabel.includes('星盘') || topLabel.includes('三维盘')){
		context.key = 'astrochart';
		return context;
	}
	if(topLabel.includes('七政四余')){
		context.key = 'guolao';
		return context;
	}
	if(topLabel.includes('量化盘')){
		context.key = 'germany';
		context.displayName = '量化盘';
		return context;
	}
	if(topLabel.includes('节气盘')){
		context.key = 'jieqi';
		context.displayName = '节气盘';
		return context;
	}
	if(topLabel.includes('印度律盘')){
		context.key = 'indiachart';
		context.displayName = '印度律盘';
		return context;
	}
	if(topLabel.includes('希腊星术')
		|| topLabel.includes('星体地图')){
		context.key = 'astrochart_like';
		return context;
	}
	if(topLabel.includes('关系盘')){
		const subTabs = findTabsContainerByLabels(topPane, ['比较盘', '组合盘', '影响盘', '时空中点盘', '马克斯盘'], false);
		const subActiveTab = subTabs ? getTabsNavItems(subTabs).find((n)=>n.classList.contains('ant-tabs-tab-active')) : null;
		const subLabel = textOf(subActiveTab);
		context.key = 'relative';
		context.subLabel = subLabel || '';
		context.scopeRoot = subTabs ? (getDirectActivePane(subTabs) || topPane) : topPane;
		context.displayName = subLabel ? `关系盘-${subLabel}` : '关系盘';
		return context;
	}
	if(topLabel.includes('西洋游戏')){
		context.key = 'otherbu';
		context.displayName = '西洋游戏';
		return context;
	}
	if(topLabel.includes('风水')){
		context.key = 'fengshui';
		context.displayName = '风水';
		return context;
	}
	if(topLabel.includes('三式合一')){
		context.key = 'sanshiunited';
		context.domain = 'sanshiunited';
		context.displayName = '三式合一';
		return context;
	}

	if(topLabel.includes('易与三式')){
		const subTabs = findTabsContainerByLabels(topPane, ['宿盘', '易卦', '六壬', '金口诀', '遁甲', '太乙', '统摄法'], false);
		if(!subTabs){
			context.key = 'cnyibu';
			return context;
		}

		const subActiveTab = getTabsNavItems(subTabs).find((n)=>n.classList.contains('ant-tabs-tab-active'));
		const subLabel = textOf(subActiveTab);
		const subPane = getDirectActivePane(subTabs) || topPane;
		context.scopeRoot = subPane;
		context.subLabel = subLabel;

		if(subLabel.includes('易卦')){
			context.key = 'sixyao';
			context.domain = 'sixyao';
			context.displayName = '易卦';
			return context;
		}

		if(subLabel.includes('统摄法')){
			context.key = 'tongshefa';
			context.domain = 'tongshefa';
			context.displayName = '统摄法';
			return context;
		}

		if(subLabel.includes('六壬')){
			context.key = 'liureng';
			context.domain = 'liureng';
			context.displayName = '大六壬';
			return context;
		}

		if(subLabel.includes('金口诀')){
			context.key = 'jinkou';
			context.domain = 'jinkou';
			context.displayName = '金口诀';
			return context;
		}

		if(subLabel.includes('遁甲')){
			context.key = 'qimen';
			context.domain = 'qimen';
			context.displayName = '奇门遁甲';
			return context;
		}

		if(subLabel.includes('太乙')){
			context.key = 'taiyi';
			context.displayName = '太乙';
			return context;
		}

		if(subLabel.includes('宿盘')){
			const chartType = detectChartTypeInPane(subPane);
			context.chartType = chartType;
			if(chartType.includes('遁甲外盘')){
				context.key = 'qimen';
				context.domain = 'qimen';
				context.displayName = '奇门(遁甲外盘)';
			}else{
				context.key = 'suzhan';
				context.displayName = chartType ? `宿盘(${chartType})` : '宿盘';
			}
			return context;
		}

		context.key = 'cnyibu';
		context.displayName = subLabel || '易与三式';
	}
	if(topLabel.includes('八字紫微')){
		const subTabs = findTabsContainerByLabels(topPane, ['八字', '紫微斗数'], true);
		if(!subTabs){
			context.key = 'cntradition';
			return context;
		}
		const subActiveTab = getTabsNavItems(subTabs).find((n)=>n.classList.contains('ant-tabs-tab-active'));
		const subLabel = textOf(subActiveTab);
		const subPane = getDirectActivePane(subTabs) || topPane;
		context.scopeRoot = subPane;
		context.subLabel = subLabel;
		if(subLabel.includes('八字')){
			context.key = 'bazi';
			context.displayName = '八字';
			return context;
		}
		if(subLabel.includes('紫微')){
			context.key = 'ziwei';
			context.displayName = '紫微斗数';
			return context;
		}
		context.key = 'cntradition';
		context.displayName = subLabel || '八字紫微';
		return context;
	}

	return context;
}

function resolveContextByAstroState(){
	try{
		const store = getStore();
		const astro = store && store.astro ? store.astro : null;
		if(!astro){
			return null;
		}
		const topTab = `${astro.currentTab || ''}`;
		const subTab = `${astro.currentSubTab || ''}`;
		if(!topTab){
			return null;
		}
		const predictiveMap = {
			primarydirect: { key: 'primarydirect', displayName: '推运盘-主/界限法', domain: 'predictive_raw' },
			primarydirchart: { key: 'primarydirchart', displayName: '推运盘-主限法盘', domain: 'predictive_raw' },
			zodialrelease: { key: 'zodialrelease', displayName: '推运盘-黄道星释', domain: 'predictive_raw' },
			firdaria: { key: 'firdaria', displayName: '推运盘-法达星限', domain: 'predictive_raw' },
			profection: { key: 'profection', displayName: '推运盘-小限法', domain: 'predictive_raw' },
			solararc: { key: 'solararc', displayName: '推运盘-太阳弧', domain: 'predictive_raw' },
			solarreturn: { key: 'solarreturn', displayName: '推运盘-太阳返照', domain: 'predictive_raw' },
			lunarreturn: { key: 'lunarreturn', displayName: '推运盘-月亮返照', domain: 'predictive_raw' },
			givenyear: { key: 'givenyear', displayName: '推运盘-流年法', domain: 'predictive_raw' },
			decennials: { key: 'decennials', displayName: '推运盘-十年大运', domain: 'predictive_raw' },
		};
		const cnyibuMap = {
			suzhan: { key: 'suzhan', displayName: '宿盘' },
			guazhan: { key: 'sixyao', displayName: '易卦', domain: 'sixyao' },
			liureng: { key: 'liureng', displayName: '大六壬', domain: 'liureng' },
			jinkou: { key: 'jinkou', displayName: '金口诀', domain: 'jinkou' },
			dunjia: { key: 'qimen', displayName: '奇门遁甲', domain: 'qimen' },
			taiyi: { key: 'taiyi', displayName: '太乙' },
			tongshefa: { key: 'tongshefa', displayName: '统摄法', domain: 'tongshefa' },
		};
		switch(topTab){
		case 'astrochart':
			return { key: 'astrochart', displayName: '星盘' };
		case 'astrochart3D':
			return { key: 'astrochart', displayName: '三维盘' };
		case 'direction':
			return predictiveMap[subTab] || predictiveMap.primarydirect;
		case 'germanytech':
			return { key: 'germany', displayName: '量化盘' };
		case 'relativechart':
			return { key: 'relative', displayName: '关系盘' };
		case 'jieqichart':
			return { key: 'jieqi', displayName: '节气盘' };
		case 'locastro':
			return { key: 'astrochart_like', displayName: '星体地图' };
		case 'hellenastro':
			return { key: 'astrochart_like', displayName: '希腊星术' };
		case 'indiachart':
			return { key: 'indiachart', displayName: '印度律盘' };
		case 'cntradition':
			if(subTab === 'bazi'){
				return { key: 'bazi', displayName: '八字' };
			}
			if(subTab === 'ziwei'){
				return { key: 'ziwei', displayName: '紫微斗数' };
			}
			return { key: 'cntradition', displayName: '八字紫微' };
		case 'cnyibu':
			return cnyibuMap[subTab] || cnyibuMap.suzhan;
		case 'guolao':
			return { key: 'guolao', displayName: '七政四余' };
		case 'otherbu':
			return { key: 'otherbu', displayName: '西洋游戏' };
		case 'fengshui':
			return { key: 'fengshui', displayName: '风水' };
		case 'sanshiunited':
			return { key: 'sanshiunited', displayName: '三式合一', domain: 'sanshiunited' };
		case 'astroreader':
			return { key: 'generic', displayName: '书籍阅读' };
		default:
			return null;
		}
	}catch(e){
		return null;
	}
}

function withStoreContextFallback(context){
	const base = context && typeof context === 'object'
		? { ...context }
		: { key: 'generic', displayName: '当前技术', domain: null, scopeRoot: null };
	const fallback = resolveContextByAstroState();
	if(!fallback || !fallback.key){
		return base;
	}
	const baseKey = `${base.key || ''}`;
	const fallbackKey = `${fallback.key || ''}`;
	const baseKnown = AI_EXPORT_TECHNIQUES.some((item)=>item.key === baseKey);
	const fallbackSpecific = !!fallbackKey && fallbackKey !== 'generic';
	const isBaseUmbrella = baseKey === 'generic'
		|| baseKey === 'cntradition'
		|| baseKey === 'cnyibu'
		|| baseKey === 'direction';
	const isFallbackUmbrella = fallbackKey === 'cntradition'
		|| fallbackKey === 'cnyibu'
		|| fallbackKey === 'direction';
	if(baseKnown && !isBaseUmbrella && isFallbackUmbrella){
		return base;
	}
	const shouldUseFallback = !baseKey
		|| !baseKnown
		|| isBaseUmbrella
		|| (fallbackSpecific && baseKey !== fallbackKey)
		|| (baseKey === fallbackKey && fallbackSpecific);
	if(!shouldUseFallback){
		return base;
	}
	return {
		...base,
		...fallback,
	};
}

function detectJieQiSettingKeyByCurrentSnapshot(){
	const current = `${getModuleCachedContent('jieqi_current') || ''}`;
	return detectJieQiSettingKeyByLabel(current) || 'jieqi_meta';
}

function detectJieQiSettingKeyByLabel(label){
	const txt = `${label || ''}`;
	if(txt.includes('春分')){
		return 'jieqi_chunfen';
	}
	if(txt.includes('夏至')){
		return 'jieqi_xiazhi';
	}
	if(txt.includes('秋分')){
		return 'jieqi_qiufen';
	}
	if(txt.includes('冬至')){
		return 'jieqi_dongzhi';
	}
	return '';
}

function detectJieQiSettingKeyByScope(scopeRoot){
	const tab = findTabsContainerByLabels(scopeRoot, ['春分', '夏至', '秋分', '冬至'], false);
	if(!tab){
		return '';
	}
	const active = getTabsNavItems(tab).find((n)=>n.classList.contains('ant-tabs-tab-active'));
	return detectJieQiSettingKeyByLabel(textOf(active));
}

export function getCurrentAIExportContext(){
	try{
		const context = withStoreContextFallback(resolveActiveContext());
		if(context.key === 'direction'){
			return {
				key: 'primarydirect',
				displayName: context.displayName || '推运盘-主/界限法',
			};
		}
		if(context.key === 'jieqi'){
			const byScope = detectJieQiSettingKeyByScope(context.scopeRoot);
			return {
				key: byScope || detectJieQiSettingKeyByCurrentSnapshot(),
				displayName: context.displayName,
			};
		}
		return {
			key: context.key,
			displayName: context.displayName,
		};
	}catch(e){
		return {
			key: 'generic',
			displayName: '当前页面',
		};
	}
}

export function loadAIExportSettings(){
	try{
		if(typeof window === 'undefined' || !window.localStorage){
			return normalizeAIExportSettings(null);
		}
		const raw = window.localStorage.getItem(AI_EXPORT_SETTINGS_KEY);
		if(!raw){
			return normalizeAIExportSettings(null);
		}
		return normalizeAIExportSettings(JSON.parse(raw));
	}catch(e){
		return normalizeAIExportSettings(null);
	}
}

export function saveAIExportSettings(settings){
	const normalized = normalizeAIExportSettings(settings);
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			window.localStorage.setItem(AI_EXPORT_SETTINGS_KEY, JSON.stringify(normalized));
		}
	}catch(e){
	}
	return normalized;
}

export function listAIExportTechniqueSettings(){
	const settings = loadAIExportSettings();
	return AI_EXPORT_TECHNIQUES.map((item)=>{
		const meaningMeta = getMeaningSettingMetaByTechnique(item.key);
		return {
			key: item.key,
			label: item.label,
			options: getOptionsForTechniqueKey(item.key),
			supportsPlanetInfo: isPlanetInfoTechnique(item.key),
			planetInfo: getPlanetInfoSettingByTechnique(settings, item.key),
			supportsAstroMeaning: isAstroMeaningTechnique(item.key) || isHoverMeaningTechnique(item.key),
			astroMeaning: getAstroMeaningSettingByTechnique(settings, item.key),
			astroMeaningTitle: meaningMeta.title,
			astroMeaningCheckbox: meaningMeta.checkbox,
		};
	});
}

function appendSvgSection(parts, scopeRoot){
	if(!ENABLE_SVG_TEXT_EXPORT){
		return;
	}
	const svgLines = collectSvgTexts(scopeRoot);
	if(svgLines.length){
		parts.push('[图形标注文本]');
		parts.push(svgLines.join('\n'));
	}
}

function getAstroCachedContent(){
	try{
		const store = getStore();
		if(!store || !store.astro){
			const snap = loadAstroAISnapshot();
			return snap && snap.content ? snap.content : '';
		}
		const chartObj = store.astro.chartObj;
		const fields = store.astro.fields;
		const snapshot = getAstroAISnapshotForCurrent(chartObj, fields);
		if(snapshot && snapshot.content){
			return snapshot.content;
		}
		if(chartObj && chartObj.chart){
			const saved = saveAstroAISnapshot(chartObj, fields);
			if(saved && saved.content){
				return saved.content;
			}
		}
		const snap = loadAstroAISnapshot();
		if(snap && snap.content){
			return snap.content;
		}
	}catch(e){
		const snap = loadAstroAISnapshot();
		return snap && snap.content ? snap.content : '';
	}
	return '';
}

function tryParseJSON(raw){
	if(raw === undefined || raw === null){
		return null;
	}
	if(typeof raw !== 'string'){
		return null;
	}
	const txt = raw.trim();
	if(!txt){
		return null;
	}
	if((txt[0] !== '{' || txt[txt.length - 1] !== '}')
		&& (txt[0] !== '[' || txt[txt.length - 1] !== ']')){
		return null;
	}
	try{
		return JSON.parse(txt);
	}catch(e){
		return null;
	}
}

function extractSnapshotText(raw){
	if(raw === undefined || raw === null){
		return '';
	}
	if(typeof raw === 'string'){
		const txt = raw.trim();
		if(!txt){
			return '';
		}
		const parsed = tryParseJSON(txt);
		if(parsed !== null){
			return extractSnapshotText(parsed);
		}
		return txt;
	}
	if(Array.isArray(raw)){
		for(let i=0; i<raw.length; i++){
			const txt = extractSnapshotText(raw[i]);
			if(txt){
				return txt;
			}
		}
		return '';
	}
	if(typeof raw !== 'object'){
		return '';
	}
	if(typeof raw.content === 'string' && raw.content.trim()){
		return raw.content.trim();
	}
	if(typeof raw.text === 'string' && raw.text.trim()){
		return raw.text.trim();
	}
	if(raw.value !== undefined){
		const txt = extractSnapshotText(raw.value);
		if(txt){
			return txt;
		}
	}
	if(raw.snapshot !== undefined){
		const txt = extractSnapshotText(raw.snapshot);
		if(txt){
			return txt;
		}
	}
	if(raw.payload !== undefined){
		const txt = extractSnapshotText(raw.payload);
		if(txt){
			return txt;
		}
	}
	const likelyKeys = ['data', 'result', 'snapshotText', 'moduleSnapshots', 'snapshots', 'modules'];
	for(let i=0; i<likelyKeys.length; i++){
		const key = likelyKeys[i];
		if(raw[key] === undefined){
			continue;
		}
		const txt = extractSnapshotText(raw[key]);
		if(txt){
			return txt;
		}
	}
	const keys = Object.keys(raw);
	for(let i=0; i<keys.length; i++){
		const key = keys[i];
		if(key === 'meta' || key === 'createdAt' || key === 'version' || key === 'module'){
			continue;
		}
		const txt = extractSnapshotText(raw[key]);
		if(txt){
			return txt;
		}
	}
	return '';
}

function getModuleAliasList(moduleName){
	const name = `${moduleName || ''}`.trim();
	if(!name){
		return [];
	}
	const set = new Set([name]);
	if(name === 'guazhan' || name === 'sixyao' || name === 'liuyao'){
		set.add('guazhan');
		set.add('sixyao');
		set.add('liuyao');
	}
	if(name === 'qimen' || name === 'dunjia'){
		set.add('qimen');
		set.add('dunjia');
	}
	if(name === 'primarydirect' || name === 'primarydirchart' || name === 'direction'){
		set.add('primarydirect');
		set.add('primarydirchart');
		set.add('direction');
	}
	if(name === 'decennials' || name === 'decennial'){
		set.add('decennials');
		set.add('decennial');
	}
	if(name === 'zodialrelease' || name === 'zodiacrelease'){
		set.add('zodialrelease');
		set.add('zodiacrelease');
	}
	if(name === 'germany' || name === 'germanytech'){
		set.add('germany');
		set.add('germanytech');
	}
	if(name === 'relative' || name === 'relativechart'){
		set.add('relative');
		set.add('relativechart');
	}
	if(name === 'indiachart' || name === 'indiachart_current' || name.indexOf('indiachart_') === 0){
		set.add('indiachart');
		set.add('indiachart_current');
	}
	if(name === 'jieqi' || name === 'jieqi_current' || name.indexOf('jieqi_') === 0){
		set.add('jieqi');
		set.add('jieqi_current');
	}
	return Array.from(set).filter(Boolean);
}

function getSnapshotFromPayload(payload, aliases){
	if(!payload || typeof payload !== 'object'){
		return '';
	}
	const aliasSet = new Set((aliases || []).map((item)=>`${item || ''}`).filter(Boolean));
	const candidates = [];
	const pushCandidate = (txt, score)=>{
		const val = `${txt || ''}`.trim();
		if(!val){
			return;
		}
		candidates.push({
			text: val,
			score: Number.isNaN(Number(score)) ? 0 : Number(score),
			len: val.length,
		});
	};
	pushCandidate(extractSnapshotText(payload.snapshot), 70);
	if(payload.module && aliasSet.has(`${payload.module}`)){
		pushCandidate(extractSnapshotText(payload.snapshot), 95);
	}
	(aliases || []).forEach((alias)=>{
		if(!alias){
			return;
		}
		pushCandidate(extractSnapshotText(payload[alias]), 96);
		const moduleSnapshots = payload.moduleSnapshots && typeof payload.moduleSnapshots === 'object'
			? payload.moduleSnapshots
			: null;
		if(moduleSnapshots){
			pushCandidate(extractSnapshotText(moduleSnapshots[alias]), 94);
		}
		const modules = payload.modules && typeof payload.modules === 'object'
			? payload.modules
			: null;
		if(modules){
			pushCandidate(extractSnapshotText(modules[alias]), 92);
		}
	});
	const snapshots = payload.snapshots && typeof payload.snapshots === 'object'
		? payload.snapshots
		: null;
	if(snapshots){
		Object.keys(snapshots).forEach((rawKey)=>{
			const key = `${rawKey || ''}`.trim();
			if(!key){
				return;
			}
			let matched = false;
			if(aliasSet.has(key)){
				matched = true;
			}
			if(key.indexOf(MODULE_SNAPSHOT_PREFIX) === 0){
				const suffix = key.substring(MODULE_SNAPSHOT_PREFIX.length);
				if(aliasSet.has(suffix)){
					matched = true;
				}
			}
			if(!matched){
				return;
			}
			pushCandidate(extractSnapshotText(snapshots[rawKey]), 93);
		});
	}
	const seen = new Set();
	const walk = (node, depth)=>{
		if(!node || depth > 4){
			return;
		}
		if(Array.isArray(node)){
			node.forEach((item)=>walk(item, depth + 1));
			return;
		}
		if(typeof node !== 'object'){
			return;
		}
		if(seen.has(node)){
			return;
		}
		seen.add(node);
		Object.keys(node).forEach((rawKey)=>{
			const key = `${rawKey || ''}`.trim();
			if(!key){
				return;
			}
			let matched = false;
			if(aliasSet.has(key)){
				matched = true;
			}
			if(key.indexOf(MODULE_SNAPSHOT_PREFIX) === 0){
				const suffix = key.substring(MODULE_SNAPSHOT_PREFIX.length);
				if(aliasSet.has(suffix)){
					matched = true;
				}
			}
			if(key.indexOf('snapshot') >= 0 || key.indexOf('module') >= 0){
				matched = true;
			}
			if(matched){
				pushCandidate(extractSnapshotText(node[rawKey]), 68 - depth);
			}
			if(depth < 4){
				walk(node[rawKey], depth + 1);
			}
		});
	};
	walk(payload, 0);
	if(!candidates.length){
		return '';
	}
	candidates.sort((a, b)=>{
		if(a.score !== b.score){
			return b.score - a.score;
		}
		return b.len - a.len;
	});
	return candidates[0].text || '';
}

function getSnapshotFromLocalStorageByAliases(aliases){
	try{
		if(typeof window === 'undefined' || !window.localStorage){
			return '';
		}
		const aliasSet = new Set((aliases || []).map((item)=>`${item || ''}`).filter(Boolean));
		if(!aliasSet.size){
			return '';
		}
		const candidates = [];
		for(let i=0; i<window.localStorage.length; i++){
			const key = `${window.localStorage.key(i) || ''}`.trim();
			if(!key || key.indexOf(MODULE_SNAPSHOT_PREFIX) !== 0){
				continue;
			}
			const suffix = key.substring(MODULE_SNAPSHOT_PREFIX.length);
			if(!aliasSet.has(suffix)){
				continue;
			}
			const raw = window.localStorage.getItem(key);
			if(!raw){
				continue;
			}
			const parsed = tryParseJSON(raw);
			const txt = extractSnapshotText(parsed || raw);
			if(!txt){
				continue;
			}
			const createdAt = parsed && parsed.createdAt ? `${parsed.createdAt}` : '';
			candidates.push({
				text: txt,
				createdAt,
				len: txt.length,
			});
		}
		if(!candidates.length){
			return '';
		}
		candidates.sort((a, b)=>{
			if(a.createdAt && b.createdAt && a.createdAt !== b.createdAt){
				return a.createdAt > b.createdAt ? -1 : 1;
			}
			return b.len - a.len;
		});
		return candidates[0].text || '';
	}catch(e){
		return '';
	}
}

function getModuleCachedContent(moduleName){
	if(!moduleName){
		return '';
	}
	const aliases = getModuleAliasList(moduleName);
	for(let i=0; i<aliases.length; i++){
		const snapshot = loadModuleAISnapshot(aliases[i]);
		if(snapshot && snapshot.content){
			return snapshot.content;
		}
	}
	// 兜底：读取当前案例中保存的模块快照（同样来自计算阶段，不依赖右侧DOM采集）。
	try{
		const store = getStore();
		const payloadCandidates = [];
		const pushPayloadCandidate = (one)=>{
			if(one === undefined || one === null){
				return;
			}
			let val = one;
			if(typeof one === 'object' && one.value !== undefined){
				val = one.value;
			}
			if(typeof val === 'string'){
				const parsed = tryParseJSON(val);
				val = parsed !== null ? parsed : val;
			}
			payloadCandidates.push(val);
		};
		const userState = store && store.user ? store.user : null;
		const astroState = store && store.astro ? store.astro : null;
		const appState = store && store.app ? store.app : null;
		pushPayloadCandidate(userState && userState.currentCase ? userState.currentCase.payload : null);
		pushPayloadCandidate(userState && userState.currentChart ? userState.currentChart.payload : null);
		pushPayloadCandidate(astroState && astroState.currentCase ? astroState.currentCase.payload : null);
		pushPayloadCandidate(appState && appState.currentCase ? appState.currentCase.payload : null);
		for(let i=0; i<payloadCandidates.length; i++){
			const fromPayload = getSnapshotFromPayload(payloadCandidates[i], aliases);
			if(fromPayload){
				return fromPayload;
			}
		}
	}catch(e){
		// ignore
	}
	const byStorageScan = getSnapshotFromLocalStorageByAliases(aliases);
	if(byStorageScan){
		return byStorageScan;
	}
	return '';
}

function getModuleSnapshotPayload(moduleName){
	if(!moduleName){
		return null;
	}
	const aliases = getModuleAliasList(moduleName);
	const candidates = [];
	aliases.forEach((alias)=>{
		const snapshot = loadModuleAISnapshot(alias);
		if(!snapshot || !snapshot.content){
			return;
		}
		candidates.push(snapshot);
	});
	if(!candidates.length){
		return null;
	}
	candidates.sort((a, b)=>{
		const aCreated = safe(a && a.createdAt, '');
		const bCreated = safe(b && b.createdAt, '');
		if(aCreated && bCreated && aCreated !== bCreated){
			return aCreated > bCreated ? -1 : 1;
		}
		const aLen = safe(a && a.content, '').length;
		const bLen = safe(b && b.content, '').length;
		return bLen - aLen;
	});
	return candidates[0] || null;
}

function getCurrentStoreFieldSignature(){
	try{
		const store = getStore();
		const astro = store && store.astro ? store.astro : null;
		const fields = astro && astro.fields ? astro.fields : null;
		if(!fields){
			return {
				date: '',
				time: '',
				zone: '',
				lon: '',
				lat: '',
			};
		}
		const fmt = (val, pattern)=>{
			if(!val || typeof val.format !== 'function'){
				return '';
			}
			try{
				return `${val.format(pattern)}`;
			}catch(e){
				return '';
			}
		};
		return {
			date: fmt(fields.date && fields.date.value, 'YYYY-MM-DD'),
			time: fmt(fields.time && fields.time.value, 'HH:mm:ss'),
			zone: safe(fields.zone && fields.zone.value, ''),
			lon: safe(fields.lon && fields.lon.value, ''),
			lat: safe(fields.lat && fields.lat.value, ''),
		};
	}catch(e){
		return {
			date: '',
			time: '',
			zone: '',
			lon: '',
			lat: '',
		};
	}
}

function getSanshiDisplayFieldSignature(scopeRoot){
	const fallback = getCurrentStoreFieldSignature();
	const sig = {
		...fallback,
	};
	if(!scopeRoot){
		return sig;
	}
	const rawText = `${textOf(scopeRoot) || ''}`.replace(/\s+/g, ' ');
	if(!rawText){
		return sig;
	}
	const dateMatched = rawText.match(/(\d{4}[/-]\d{2}[/-]\d{2})/);
	if(dateMatched && dateMatched[1]){
		sig.date = `${dateMatched[1]}`.replace(/\//g, '-');
	}
	// 三式合一左盘固定同时展示“真太阳时/直接时间”，用于导出匹配优先使用直接时间。
	const directMatched = rawText.match(/直接时间[：:]\s*(\d{2}:\d{2}(?::\d{2})?)/);
	if(directMatched && directMatched[1]){
		sig.time = `${directMatched[1]}`;
		return sig;
	}
	const solarMatched = rawText.match(/真太阳时[：:]\s*(\d{2}:\d{2}(?::\d{2})?)/);
	if(solarMatched && solarMatched[1]){
		sig.time = `${solarMatched[1]}`;
	}
	return sig;
}

function normalizeMinuteTime(val){
	const matched = `${val || ''}`.match(/(\d{2}):(\d{2})/);
	if(!matched){
		return '';
	}
	return `${matched[1]}:${matched[2]}`;
}

function parseSanshiDirectStamp(content){
	const txt = `${content || ''}`;
	if(!txt){
		return null;
	}
	const matched = txt.match(/直接时间[：:]\s*([0-9]{4}[/-][0-9]{2}[/-][0-9]{2})\s*([0-9]{2}:[0-9]{2}(?::[0-9]{2})?)/);
	if(!matched){
		return null;
	}
	return {
		date: `${matched[1] || ''}`.replace(/\//g, '-'),
		time: `${matched[2] || ''}`,
	};
}

function isSanshiSnapshotMatchedCurrent(content, snapshotMeta, currentSig){
	const current = currentSig || {};
	if(!current.date || !current.time){
		return true;
	}
	let snapDate = safe(snapshotMeta && snapshotMeta.date, '');
	let snapTime = safe(snapshotMeta && snapshotMeta.time, '');
	const parsedDirect = parseSanshiDirectStamp(content);
	if(!snapDate && parsedDirect && parsedDirect.date){
		snapDate = parsedDirect.date;
	}
	if(!snapTime && parsedDirect && parsedDirect.time){
		snapTime = parsedDirect.time;
	}
	if(!snapDate || !snapTime){
		return false;
	}
	if(snapDate !== current.date){
		return false;
	}
	const curMinute = normalizeMinuteTime(current.time);
	const snapMinute = normalizeMinuteTime(snapTime);
	if(curMinute && snapMinute && curMinute !== snapMinute){
		return false;
	}
	const snapZone = safe(snapshotMeta && snapshotMeta.zone, '');
	if(current.zone && snapZone && current.zone !== snapZone){
		return false;
	}
	const snapLon = safe(snapshotMeta && snapshotMeta.lon, '');
	if(current.lon && snapLon && current.lon !== snapLon){
		return false;
	}
	const snapLat = safe(snapshotMeta && snapshotMeta.lat, '');
	if(current.lat && snapLat && current.lat !== snapLat){
		return false;
	}
	return true;
}

function parseIndiaFractalByLabel(label){
	const txt = `${label || ''}`.trim();
	if(!txt){
		return null;
	}
	if(txt.includes('命盘')){
		return 1;
	}
	const matched = txt.match(/(\d+)\s*律盘/);
	if(!matched){
		return null;
	}
	const val = parseInt(matched[1], 10);
	if(Number.isNaN(val) || val <= 0){
		return null;
	}
	return val;
}

function getIndiaCachedContent(activeLabel){
	const keys = [];
	const fractal = parseIndiaFractalByLabel(activeLabel);
	if(fractal !== null){
		keys.push(`indiachart_${fractal}`);
	}
	keys.push('indiachart_current');
	keys.push('indiachart');

	for(let i=0; i<keys.length; i++){
		const txt = getModuleCachedContent(keys[i]);
		if(txt){
			return txt;
		}
	}
	return '';
}

async function extractAstroContent(context){
	const isAstroLike = context && context.key === 'astrochart_like';
	const topLabel = context && context.topLabel ? context.topLabel : '';
	const isIndia = (context && context.key === 'indiachart') || topLabel.includes('印度律盘');
	if(!isIndia){
		// 星盘系导出固定走计算快照，不读取右侧栏目DOM。
		const cached = getAstroCachedContent();
		return cached || '';
	}
	const scopeRoot = context ? context.scopeRoot : null;
	const indiaActive = findIndiaActivePane(scopeRoot);
	const indiaCached = getIndiaCachedContent(indiaActive ? indiaActive.label : '');
	return indiaCached || '';
}

async function extractSixYaoContent(context){
	void context;
	const refreshedGuazhan = await requestModuleSnapshotRefresh('guazhan');
	if(refreshedGuazhan){
		return refreshedGuazhan;
	}
	const refreshedSixyao = await requestModuleSnapshotRefresh('sixyao');
	if(refreshedSixyao){
		return refreshedSixyao;
	}
	const cached = getModuleCachedContent('guazhan') || getModuleCachedContent('sixyao');
	if(cached){
		return cached;
	}
	// 易卦导出仅使用计算快照，不从右侧DOM复制。
	return '';
}

function hasSectionTitle(content, title){
	const src = `${content || ''}`;
	const target = `${title || ''}`.trim();
	if(!src || !target){
		return false;
	}
	const escaped = escapeRegExp(target);
	const headingPattern = new RegExp(`(?:\\[|【)\\s*${escaped}\\s*(?:\\]|】)`);
	return headingPattern.test(src);
}

function hasAnySectionTitle(content, titles){
	const arr = Array.isArray(titles) ? titles : [titles];
	return arr.some((title)=>hasSectionTitle(content, title));
}

async function extractLiuRengContent(context){
	void context;
	const refreshedSnapshot = await requestModuleSnapshotRefresh('liureng');
	if(refreshedSnapshot){
		const hasGeJuRef = hasAnySectionTitle(refreshedSnapshot, ['大格', '小局', '参考', '概览']);
		if(hasGeJuRef){
			return refreshedSnapshot;
		}
	}
	const cached = getModuleCachedContent('liureng');
	if(cached){
		const hasGeJuRef = hasAnySectionTitle(cached, ['大格', '小局', '参考', '概览']);
		if(hasGeJuRef){
			return cached;
		}
	}
	const liveSnapshot = (typeof window !== 'undefined' && typeof window.__horosa_liureng_snapshot_text === 'string')
		? `${window.__horosa_liureng_snapshot_text}`.trim()
		: '';
	if(liveSnapshot){
		const hasGeJuRef = hasAnySectionTitle(liveSnapshot, ['大格', '小局', '参考', '概览']);
		if(hasGeJuRef){
			return liveSnapshot;
		}
	}
	if(refreshedSnapshot){
		return refreshedSnapshot;
	}
	if(cached){
		return cached;
	}
	// 六壬导出仅使用计算快照，不从右侧DOM复制。
	return '';
}

async function extractJinKouContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('jinkou');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('jinkou');
	if(cached){
		return cached;
	}
	// 金口诀导出不能回退到六壬，避免内容串台。
	return '';
}

async function extractQiMenContent(context){
	void context;
	const refreshedSnapshot = await requestModuleSnapshotRefresh('qimen');
	if(refreshedSnapshot){
		const hasYiGua = hasSectionTitle(refreshedSnapshot, '奇门演卦');
		const hasBaGong = hasSectionTitle(refreshedSnapshot, '八宫详解');
		if(hasYiGua && hasBaGong){
			return refreshedSnapshot;
		}
	}
	const cached = getModuleCachedContent('qimen');
	if(cached){
		const hasYiGua = hasSectionTitle(cached, '奇门演卦');
		const hasBaGong = hasSectionTitle(cached, '八宫详解');
		if(hasYiGua && hasBaGong){
			return cached;
		}
	}
	const liveSnapshot = (typeof window !== 'undefined' && typeof window.__horosa_qimen_snapshot_text === 'string')
		? `${window.__horosa_qimen_snapshot_text}`.trim()
		: '';
	if(liveSnapshot){
		const hasYiGua = hasSectionTitle(liveSnapshot, '奇门演卦');
		const hasBaGong = hasSectionTitle(liveSnapshot, '八宫详解');
		if(hasYiGua && hasBaGong){
			return liveSnapshot;
		}
	}
	if(refreshedSnapshot){
		return refreshedSnapshot;
	}
	if(liveSnapshot){
		return liveSnapshot;
	}
	if(cached){
		return cached;
	}
	// 遁甲导出仅使用计算快照，不从右侧DOM复制。
	return '';
}

async function extractSanShiUnitedContent(context){
	void context;
	const isCompleteSnapshot = (txt)=>{
		const src = `${txt || ''}`;
		if(!src){
			return false;
		}
		const hasLiuRengRef = hasAnySectionTitle(src, ['六壬大格', '六壬小局', '六壬参考', '六壬概览']);
		const hasBaGong = hasSectionTitle(src, '八宫详解');
		return hasLiuRengRef && hasBaGong;
	};
	const getSanshiSnapshotMeta = ()=>{
		const payload = getModuleSnapshotPayload('sanshiunited');
		if(payload && payload.meta && typeof payload.meta === 'object'){
			return payload.meta;
		}
		return null;
	};
	const canUseSnapshot = (txt, meta, preferComplete = false)=>{
		const src = `${txt || ''}`.trim();
		if(!src){
			return false;
		}
		const complete = isCompleteSnapshot(src);
		const matched = isSanshiSnapshotMatchedCurrent(src, meta, currentSig);
		if(strictMatch){
			// 严格模式下以当前盘签名匹配为准，命中即可导出，避免误报“无可导出文本”。
			return matched;
		}
		if(preferComplete){
			return complete;
		}
		return true;
	};
	const currentSig = getSanshiDisplayFieldSignature(context && context.scopeRoot ? context.scopeRoot : null);
	const strictMatch = !!(currentSig.date && currentSig.time);

	const refreshedSnapshot = await requestModuleSnapshotRefresh('sanshiunited');
	const refreshedMeta = getSanshiSnapshotMeta();
	if(canUseSnapshot(refreshedSnapshot, refreshedMeta, true)){
		// 优先信任“本次刷新”结果：由三式合一组件当场生成，最贴近当前盘面。
		return refreshedSnapshot;
	}

	const cached = getModuleCachedContent('sanshiunited');
	const cachedPayload = getModuleSnapshotPayload('sanshiunited');
	if(canUseSnapshot(cached, cachedPayload && cachedPayload.meta, true)){
		return cached;
	}

	if(strictMatch){
		const retrySnapshot = await requestModuleSnapshotRefresh('sanshiunited');
		const retryMeta = getSanshiSnapshotMeta();
		if(canUseSnapshot(retrySnapshot, retryMeta, false)){
			return retrySnapshot;
		}
		// 最后再尝试一次已取到的快照，避免“刷新回调无新文本”导致误空。
		if(canUseSnapshot(refreshedSnapshot, refreshedMeta, false)){
			return refreshedSnapshot;
		}
		if(canUseSnapshot(cached, cachedPayload && cachedPayload.meta, false)){
			return cached;
		}
		// 最后兜底：即便签名不匹配，也优先导出当前可见盘面的最新快照，避免误报空导出。
		if(`${retrySnapshot || ''}`.trim()){
			return retrySnapshot;
		}
		if(`${refreshedSnapshot || ''}`.trim()){
			return refreshedSnapshot;
		}
		if(`${cached || ''}`.trim()){
			return cached;
		}
		return '';
	}

	if(canUseSnapshot(cached, cachedPayload && cachedPayload.meta, false)){
		return cached;
	}
	if(canUseSnapshot(refreshedSnapshot, refreshedMeta, false)){
		return refreshedSnapshot;
	}
	return '';
}

const TONGSHEFA_LABEL_TO_KEY = {
	'太阴·本体': 'taiyin',
	'太阳·方法': 'taiyang',
	'少阳·认识': 'shaoyang',
	'少阴·宇宙': 'shaoyin',
};
const TONGSHEFA_SELECT_KEYS = ['taiyin', 'taiyang', 'shaoyang', 'shaoyin'];

function parseTongSheFaBaguaKey(text){
	const val = `${text || ''}`.replace(/\s+/g, '');
	if(!val){
		return '';
	}
	let m = val.match(/[（(]([乾兑离震巽坎艮坤])[）)]/);
	if(m && m[1]){
		return m[1];
	}
	m = val.match(/([乾兑离震巽坎艮坤])卦/);
	if(m && m[1]){
		return m[1];
	}
	m = val.match(/[乾兑离震巽坎艮坤]/);
	return m && m[0] ? m[0] : '';
}

function hasTongSheFaSelection(selection){
	if(!selection || typeof selection !== 'object'){
		return false;
	}
	return TONGSHEFA_SELECT_KEYS.every((key)=>!!selection[key]);
}

function extractTongSheFaSelection(scopeRoot){
	if(!scopeRoot || !scopeRoot.querySelectorAll){
		return null;
	}
	const out = {};
	const cols = Array.from(scopeRoot.querySelectorAll('.ant-col'));
	cols.forEach((col)=>{
		const labelNode = Array.from(col.children || []).find((node)=>{
			if(!node || node.nodeType !== 1){
				return false;
			}
			const label = `${textOf(node)}`.trim();
			return Object.prototype.hasOwnProperty.call(TONGSHEFA_LABEL_TO_KEY, label);
		});
		if(!labelNode){
			return;
		}
		const label = `${textOf(labelNode)}`.trim();
		const key = TONGSHEFA_LABEL_TO_KEY[label];
		if(!key || out[key]){
			return;
		}
		const select = col.querySelector('.ant-select');
		if(!select){
			return;
		}
		const selectedText = textOf(select.querySelector('.ant-select-selection-item')) || textOf(select);
		const baguaKey = parseTongSheFaBaguaKey(selectedText);
		if(baguaKey){
			out[key] = baguaKey;
		}
	});

	if(hasTongSheFaSelection(out)){
		return out;
	}

	const selects = Array.from(scopeRoot.querySelectorAll('.ant-select'));
	selects.forEach((select)=>{
		if(hasTongSheFaSelection(out)){
			return;
		}
		let label = '';
		const prev = select.previousElementSibling;
		const prevLabel = prev ? `${textOf(prev)}`.trim() : '';
		if(Object.prototype.hasOwnProperty.call(TONGSHEFA_LABEL_TO_KEY, prevLabel)){
			label = prevLabel;
		}
		if(!label){
			const holder = select.closest('.ant-col') || select.parentElement;
			if(holder){
				const allDivs = Array.from(holder.querySelectorAll('div'));
				const found = allDivs.map((node)=>`${textOf(node)}`.trim())
					.find((txt)=>Object.prototype.hasOwnProperty.call(TONGSHEFA_LABEL_TO_KEY, txt));
				if(found){
					label = found;
				}
			}
		}
		if(!label){
			return;
		}
		const key = TONGSHEFA_LABEL_TO_KEY[label];
		if(!key || out[key]){
			return;
		}
		const selectedText = textOf(select.querySelector('.ant-select-selection-item')) || textOf(select);
		const baguaKey = parseTongSheFaBaguaKey(selectedText);
		if(baguaKey){
			out[key] = baguaKey;
		}
	});

	return hasTongSheFaSelection(out) ? out : null;
}

async function extractTongSheFaContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('tongshefa');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('tongshefa');
	if(cached){
		return cached;
	}
	return '';
}

async function extractTaiYiContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('taiyi');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('taiyi');
	if(cached){
		return cached;
	}
	return '';
}

async function extractGermanyContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('germany');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('germany');
	if(cached){
		return cached;
	}
	return '';
}

async function extractJieQiContent(context){
	void context;
	const refreshedCurrent = await requestModuleSnapshotRefresh('jieqi_current');
	if(refreshedCurrent){
		return refreshedCurrent;
	}
	const refreshed = await requestModuleSnapshotRefresh('jieqi');
	if(refreshed){
		return refreshed;
	}
	const cachedCurrent = getModuleCachedContent('jieqi_current');
	if(cachedCurrent){
		return cachedCurrent;
	}
	const cached = getModuleCachedContent('jieqi');
	if(cached){
		return cached;
	}
	return '';
}

async function extractPrimaryDirectContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('primarydirect');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('primarydirect');
	if(cached){
		return cached;
	}
	return '';
}

async function extractPrimaryDirChartContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('primarydirchart');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('primarydirchart');
	if(cached){
		return cached;
	}
	return '';
}

async function extractZodialReleaseContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('zodialrelease');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('zodialrelease');
	if(cached){
		return cached;
	}
	return '';
}

async function extractFirdariaContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('firdaria');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('firdaria');
	if(cached){
		return cached;
	}
	return '';
}

async function extractProfectionContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('profection');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('profection');
	if(cached){
		return cached;
	}
	return '';
}

async function extractSolarArcContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('solararc');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('solararc');
	if(cached){
		return cached;
	}
	return '';
}

async function extractSolarReturnContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('solarreturn');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('solarreturn');
	if(cached){
		return cached;
	}
	return '';
}

async function extractLunarReturnContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('lunarreturn');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('lunarreturn');
	if(cached){
		return cached;
	}
	return '';
}

async function extractGivenYearContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('givenyear');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('givenyear');
	if(cached){
		return cached;
	}
	return '';
}

async function extractDecennialsContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('decennials');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('decennials');
	if(cached){
		return cached;
	}
	return '';
}

async function extractRelativeContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('relative');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('relative');
	if(cached){
		return cached;
	}
	return '';
}

async function extractSimpleModuleContent(moduleName){
	const refreshed = await requestModuleSnapshotRefresh(moduleName);
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent(moduleName);
	if(cached){
		return cached;
	}
	return '';
}

async function extractOtherBuContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('otherbu');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('otherbu');
	if(cached){
		return cached;
	}
	return '';
}

async function extractFengShuiContent(context){
	void context;
	const refreshed = await requestModuleSnapshotRefresh('fengshui');
	if(refreshed){
		return refreshed;
	}
	const cached = getModuleCachedContent('fengshui');
	if(cached){
		return cached;
	}
	return '';
}

async function extractGenericContent(context){
	if(context.key === 'suzhan'){
		const cached = getModuleCachedContent('suzhan');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'guolao'){
		const cached = getModuleCachedContent('guolao');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'bazi'){
		const cached = getModuleCachedContent('bazi');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'ziwei'){
		const cached = getModuleCachedContent('ziwei');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'germany'){
		const cached = getModuleCachedContent('germany');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'jieqi'){
		const cachedCurrent = getModuleCachedContent('jieqi_current');
		if(cachedCurrent){
			return cachedCurrent;
		}
		const cached = getModuleCachedContent('jieqi');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'zodialrelease'){
		const cached = getModuleCachedContent('zodialrelease');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'decennials'){
		const cached = getModuleCachedContent('decennials');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'relative'){
		const cached = getModuleCachedContent('relative');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'otherbu'){
		const cached = getModuleCachedContent('otherbu');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'qimen'){
		const cached = getModuleCachedContent('qimen');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'sanshiunited'){
		const cached = getModuleCachedContent('sanshiunited');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'tongshefa'){
		const cached = getModuleCachedContent('tongshefa');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'sixyao'){
		const cached = getModuleCachedContent('guazhan');
		if(cached){
			return cached;
		}
	}
	if(context.key === 'jinkou'){
		const cached = getModuleCachedContent('jinkou');
		if(cached){
			return cached;
		}
	}

	void context;
	return '';
}

function applyReplacers(text, replacers){
	let out = text;
	replacers.forEach((item)=>{
		out = out.replace(item.regex, item.value);
	});
	return out;
}

function replaceKnownSymbols(text, domain){
	let output = text || '';
	if(likelyHasFontEncodedTokens(output)){
		output = replaceFontEncodedTokens(output);
	}
	Object.keys(SYMBOL_MAP).forEach((key)=>{
		output = output.split(key).join(` ${SYMBOL_MAP[key]} `);
	});

	output = applyReplacers(output, COMMON_REPLACERS);
	if(domain && DOMAIN_REPLACERS[domain]){
		output = applyReplacers(output, DOMAIN_REPLACERS[domain]);
	}

	output = output.replace(/[\u4DC0-\u4DFF]/g, (ch)=>{
		const idx = ch.charCodeAt(0) - 0x4DC0 + 1;
		return ` 六十四卦#${idx} `;
	});

	// 私有区字符多为字体残留，不输出乱码标记，直接清理。
	output = output.replace(/[\uE000-\uF8FF]/g, ' ');

	output = output
		.replace(/[°º]/g, '˚')
		.replace(/[−﹣]/g, '-')
		.replace(/([0-9]+)\s*[′']/g, '$1分')
		.replace(/([0-9]+)\s*[″"]/g, '$1秒')
		.replace(/℞/g, '逆行')
		.replace(/\uFFFD/g, '[异常字符]')
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
		.replace(/\u200B/g, '')
		.replace(/\u00A0/g, ' ')
		.replace(/[ ]{2,}/g, ' ');
	if(domain !== 'sanshiunited'){
		output = output
			.replace(/([+-]?\d+(?:\.\d+)?)\s*度\s*R\b/g, '$1度 逆行')
			.replace(/(\d{1,2}\s*˚\s*(?:[^\s，,；;]{0,6})\s*\d{1,2}\s*分)\s*R\b/g, '$1 逆行');
	}

	return output;
}

function normalizeText(text, domain){
	let output = replaceKnownSymbols(text, domain);
	output = output.replace(/\r\n/g, '\n');
	output = output
		.split('\n')
			.map((line)=>line.replace(/[ \t]+$/g, ''))
			.join('\n');
	output = output.replace(/\n{3,}/g, '\n\n');
	if(domain === 'predictive_raw'
		|| domain === 'tongshefa'
		|| domain === 'liureng'
		|| domain === 'qimen'
		|| domain === 'sanshiunited'){
		return output.trim();
	}
	if(output.length > 120000){
		return normalizeWhitespace(output);
	}
	output = beautifyForAI(output);
	return output.trim();
}

const ASTRO_MEANING_PLANET_IDS = [
	AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, AstroConst.MARS, AstroConst.JUPITER,
	AstroConst.SATURN, AstroConst.URANUS, AstroConst.NEPTUNE, AstroConst.PLUTO, AstroConst.NORTH_NODE, AstroConst.SOUTH_NODE,
];
const ASTRO_MEANING_LOT_IDS = [
	AstroConst.PARS_FORTUNA, AstroConst.PARS_SPIRIT, AstroConst.PARS_VENUS, AstroConst.PARS_MERCURY, AstroConst.PARS_MARS,
	AstroConst.PARS_JUPITER, AstroConst.PARS_SATURN, AstroConst.PARS_FATHER, AstroConst.PARS_MOTHER, AstroConst.PARS_BROTHERS,
	AstroConst.PARS_WEDDING_MALE, AstroConst.PARS_WEDDING_FEMALE, AstroConst.PARS_SONS, AstroConst.PARS_DISEASES,
	AstroConst.PARS_LIFE, AstroConst.PARS_RADIX,
];

function escapeRegExp(text){
	return `${text || ''}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function astroMeaningDisplayName(id){
	return AstroText.AstroMsgCN[id] || AstroText.AstroTxtMsg[id] || `${id || ''}`;
}

function buildAliasMap(entries){
	const aliasMap = new Map();
	entries.forEach((entry)=>{
		const id = entry.id;
		(entry.aliases || []).forEach((alias)=>{
			const a = `${alias || ''}`.trim();
			if(!a){
				return;
			}
			if(!aliasMap.has(a)){
				aliasMap.set(a, []);
			}
			const arr = aliasMap.get(a);
			if(!arr.includes(id)){
				arr.push(id);
			}
		});
	});
	return aliasMap;
}

const EXTRA_LOT_ALIASES = {
	[AstroConst.PARS_FORTUNA]: ['幸运点', 'Lot of Fortune'],
	[AstroConst.PARS_SPIRIT]: ['精神点', 'Lot of Spirit'],
	[AstroConst.PARS_VENUS]: ['爱情点', 'Lot of Eros'],
	[AstroConst.PARS_MERCURY]: ['必要点', 'Lot of Necessity'],
	[AstroConst.PARS_MARS]: ['勇气点', 'Lot of Courage'],
	[AstroConst.PARS_JUPITER]: ['胜利点', 'Lot of Victory'],
	[AstroConst.PARS_SATURN]: ['复仇点', 'Lot of Nemesis'],
	[AstroConst.PARS_FATHER]: ['父亲点', 'Lot of The Father'],
	[AstroConst.PARS_MOTHER]: ['母亲点', 'Lot of The Mother'],
	[AstroConst.PARS_BROTHERS]: ['手足点', 'Lot of Siblings'],
	[AstroConst.PARS_WEDDING_MALE]: ['婚姻点', 'Lot of Marriage'],
	[AstroConst.PARS_WEDDING_FEMALE]: ['婚姻点', 'Lot of Marriage'],
	[AstroConst.PARS_SONS]: ['孩童点', 'Lot of Children'],
	[AstroConst.PARS_DISEASES]: ['疾病点', 'Lot of Illness'],
	[AstroConst.PARS_LIFE]: ['旺点', 'Lot of Exaltation'],
	[AstroConst.PARS_RADIX]: ['基础点', 'Lot of Foundation'],
};

const PLANET_ALIAS_MAP = buildAliasMap(ASTRO_MEANING_PLANET_IDS.map((id)=>({
	id,
	aliases: uniqueArray([
		AstroText.AstroMsgCN[id],
		AstroText.AstroTxtMsg[id],
		`${id}`,
	]),
})));

const LOT_ALIAS_MAP = buildAliasMap(ASTRO_MEANING_LOT_IDS.map((id)=>({
	id,
	aliases: uniqueArray([
		AstroText.AstroMsgCN[id],
		AstroText.AstroTxtMsg[id],
		...(EXTRA_LOT_ALIASES[id] || []),
		`${id}`,
	]),
})));

const SIGN_ALIAS_MAP = buildAliasMap((AstroConst.LIST_SIGNS || []).map((id)=>({
	id,
	aliases: uniqueArray([
		AstroText.AstroMsgCN[id],
		AstroText.AstroTxtMsg[id],
		`${id}`,
	]),
})));

const HOUSE_ALIAS_MAP = buildAliasMap((AstroConst.LIST_HOUSES || []).map((id)=>({
	id,
	aliases: uniqueArray([
		AstroText.AstroMsg[id],
		AstroText.AstroMsgCN[id],
		AstroText.AstroTxtMsg[id],
		`${id}`,
	]),
})));

function lineContainsAlias(line, alias, options = {}){
	const txt = `${line || ''}`;
	if(!txt || !alias){
		return false;
	}
	if(alias.length === 1){
		const escaped = escapeRegExp(alias);
		const pattern = new RegExp(`(^|[\\s,，;；:：()（）\\[\\]{}\\/\\\\|\\-])(${escaped})(?=$|[\\s,，;；:：()（）\\[\\]{}\\/\\\\|\\-])`, 'g');
		const weakPlanetAlias = options.category === 'planet'
			&& ['日', '月', '水', '金', '火', '木', '土'].includes(alias);
		let matched = pattern.exec(txt);
		while(matched){
			const prefix = matched[1] || '';
			const start = (matched.index || 0) + prefix.length;
			const tail = txt.slice(start + alias.length).replace(/^\s+/, '');
			// 避免把“五行界”的“木/火/土/金/水”误判为行星简称。
			if(weakPlanetAlias && /^界/.test(tail)){
				matched = pattern.exec(txt);
				continue;
			}
			return true;
		}
		return false;
	}
	return txt.includes(alias);
}

function detectIdsByAliasMap(lines, aliasMap, options = {}){
	const out = new Set();
	const src = Array.isArray(lines) ? lines : [];
	if(!src.length){
		return out;
	}
	aliasMap.forEach((ids, alias)=>{
		for(let i=0; i<src.length; i++){
			if(lineContainsAlias(src[i], alias, options)){
				ids.forEach((id)=>out.add(id));
				break;
			}
		}
	});
	return out;
}

function detectAspectDegreesFromLines(lines){
	const found = new Set();
	(lines || []).forEach((line)=>{
		const txt = `${line || ''}`;
		if(!txt){
			return;
		}
		const regex = /(^|[^\d])(0|30|45|60|90|120|135|150|180)\s*˚/g;
		let matched = regex.exec(txt);
		while(matched){
			const deg = parseInt(matched[2], 10);
			if(!Number.isNaN(deg)){
				found.add(deg);
			}
			matched = regex.exec(txt);
		}
	});
	return found;
}

function buildMeaningLinesForIds(category, ids, title){
	const lines = [];
	const arr = Array.from(ids || []);
	if(!arr.length){
		return lines;
	}
	lines.push(`【${title}】`);
	arr.forEach((id)=>{
		const tip = buildMeaningTipByCategory(category, id);
		if(!tip){
			return;
		}
		lines.push(`### ${astroMeaningDisplayName(id)}`);
		if(tip.title){
			lines.push(`${tip.title}`);
		}
		(tip.tips || []).forEach((one)=>{
			lines.push(`${one}`);
		});
		lines.push('');
	});
	while(lines.length && lines[lines.length - 1] === ''){
		lines.pop();
	}
	return lines;
}

function buildMeaningLinesForAspects(degrees){
	const lines = [];
	const arr = Array.from(degrees || []).sort((a, b)=>a - b);
	if(!arr.length){
		return lines;
	}
	lines.push('【相位释义】');
	arr.forEach((deg)=>{
		const tip = buildAspectMeaningTip(deg, null, null);
		if(!tip){
			return;
		}
		lines.push(`### ${deg}˚`);
		if(tip.title){
			lines.push(`${tip.title}`);
		}
		(tip.tips || []).forEach((one)=>{
			lines.push(`${one}`);
		});
		lines.push('');
	});
	while(lines.length && lines[lines.length - 1] === ''){
		lines.pop();
	}
	return lines;
}

function joinSectionBlocks(sections){
	if(!Array.isArray(sections) || sections.length === 0){
		return '';
	}
	const out = [];
	sections.forEach((sec)=>{
		if(!sec || !Array.isArray(sec.lines) || !sec.lines.length){
			return;
		}
		if(out.length && out[out.length - 1] !== ''){
			out.push('');
		}
		out.push(...sec.lines);
	});
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function getSectionMeaningMode(title){
	const t = `${title || ''}`;
	if(!t || t.includes('释义')){
		return {
			skip: true,
			explicit: false,
			forceAllPlanets: false,
			forceAllLots: false,
		};
	}
	const explicit = t.includes('行星')
		|| t.includes('希腊点')
		|| t.includes('相位')
		|| t.includes('宫位')
		|| t.includes('星与虚点')
		|| t === '信息'
		|| t === '星盘信息'
		|| t === '可能性'
		|| t.includes('推运');
	return {
		skip: false,
		explicit,
		forceAllPlanets: t.includes('行星'),
		forceAllLots: t.includes('希腊点'),
	};
}

function appendAstroMeaningSections(content){
	const sections = splitContentSections(content);
	if(!sections || sections.length === 0){
		return content;
	}

	const outSections = [];
	const seen = {
		planets: new Set(),
		lots: new Set(),
		signs: new Set(),
		houses: new Set(),
		aspects: new Set(),
	};
	sections.forEach((sec)=>{
		outSections.push(sec);
		const mode = getSectionMeaningMode(sec && sec.title);
		if(mode.skip){
			return;
		}
		const lines = (sec.lines || []).slice(1);
		let planets = detectIdsByAliasMap(lines, PLANET_ALIAS_MAP, { category: 'planet' });
		let lots = detectIdsByAliasMap(lines, LOT_ALIAS_MAP, { category: 'lot' });
		const signs = detectIdsByAliasMap(lines, SIGN_ALIAS_MAP, { category: 'sign' });
		const houses = detectIdsByAliasMap(lines, HOUSE_ALIAS_MAP, { category: 'house' });
		const aspects = detectAspectDegreesFromLines(lines);

		if(mode.forceAllPlanets && planets.size === 0){
			planets = new Set(ASTRO_MEANING_PLANET_IDS);
		}
		if(mode.forceAllLots && lots.size === 0){
			lots = new Set(ASTRO_MEANING_LOT_IDS);
		}
		const hasDetected = planets.size > 0
			|| lots.size > 0
			|| signs.size > 0
			|| houses.size > 0
			|| aspects.size > 0;
		if(!mode.explicit && !hasDetected){
			return;
		}

		const uniquePlanets = new Set(Array.from(planets).filter((id)=>!seen.planets.has(id)));
		const uniqueLots = new Set(Array.from(lots).filter((id)=>!seen.lots.has(id)));
		const uniqueSigns = new Set(Array.from(signs).filter((id)=>!seen.signs.has(id)));
		const uniqueHouses = new Set(Array.from(houses).filter((id)=>!seen.houses.has(id)));
		const uniqueAspects = new Set(Array.from(aspects).filter((deg)=>!seen.aspects.has(deg)));

		const meaningLines = []
			.concat(buildMeaningLinesForIds('planet', uniquePlanets, '星释义'))
			.concat(buildMeaningLinesForIds('lot', uniqueLots, '希腊点释义'))
			.concat(buildMeaningLinesForIds('sign', uniqueSigns, '星座释义'))
			.concat(buildMeaningLinesForIds('house', uniqueHouses, '宫位释义'))
			.concat(buildMeaningLinesForAspects(uniqueAspects));

		if(!meaningLines.length){
			return;
		}
		uniquePlanets.forEach((id)=>seen.planets.add(id));
		uniqueLots.forEach((id)=>seen.lots.add(id));
		uniqueSigns.forEach((id)=>seen.signs.add(id));
		uniqueHouses.forEach((id)=>seen.houses.add(id));
		uniqueAspects.forEach((deg)=>seen.aspects.add(deg));
		outSections.push({
			title: `${sec.title}释义`,
			lines: [
				`[${sec.title}释义]`,
				...meaningLines,
			],
		});
	});

	const appended = joinSectionBlocks(outSections);
	return appended || content;
}

const LIURENG_BRANCH_ORDER = '子丑寅卯辰巳午未申酉戌亥'.split('');
const QIMEN_STEM_ORDER = '甲乙丙丁戊己庚辛壬癸'.split('');
const QIMEN_DOOR_ORDER = ['休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门'];
const QIMEN_STAR_ORDER = ['天蓬', '天任', '天冲', '天辅', '天英', '天芮', '天禽', '天柱', '天心'];
const QIMEN_GOD_ORDER = ['值符', '螣蛇', '太阴', '六合', '白虎', '玄武', '九地', '九天'];

const QIMEN_DOOR_MAP = {
	休: '休门',
	生: '生门',
	伤: '伤门',
	杜: '杜门',
	景: '景门',
	死: '死门',
	惊: '惊门',
	開: '开门',
	开: '开门',
	休门: '休门',
	生门: '生门',
	伤门: '伤门',
	杜门: '杜门',
	景门: '景门',
	死门: '死门',
	惊门: '惊门',
	开门: '开门',
};
const QIMEN_STAR_MAP = {
	蓬: '天蓬',
	任: '天任',
	冲: '天冲',
	沖: '天冲',
	辅: '天辅',
	輔: '天辅',
	英: '天英',
	芮: '天芮',
	禽: '天禽',
	柱: '天柱',
	心: '天心',
	天蓬: '天蓬',
	天任: '天任',
	天冲: '天冲',
	天輔: '天辅',
	天辅: '天辅',
	天英: '天英',
	天芮: '天芮',
	天禽: '天禽',
	天柱: '天柱',
	天心: '天心',
};
const QIMEN_GOD_MAP = {
	符: '值符',
	值符: '值符',
	蛇: '螣蛇',
	腾蛇: '螣蛇',
	螣蛇: '螣蛇',
	阴: '太阴',
	太陰: '太阴',
	太阴: '太阴',
	合: '六合',
	六合: '六合',
	虎: '白虎',
	白虎: '白虎',
	玄: '玄武',
	玄武: '玄武',
	地: '九地',
	九地: '九地',
	天: '九天',
	九天: '九天',
};

function sortByOrderSet(values, order){
	const arr = Array.from(values || []);
	if(!arr.length){
		return arr;
	}
	const idxMap = new Map();
	(order || []).forEach((txt, idx)=>idxMap.set(txt, idx));
	return arr.sort((a, b)=>{
		const ai = idxMap.has(a) ? idxMap.get(a) : 999;
		const bi = idxMap.has(b) ? idxMap.get(b) : 999;
		if(ai !== bi){
			return ai - bi;
		}
		return `${a}`.localeCompare(`${b}`);
	});
}

function normalizeQimenStem(raw){
	const txt = `${raw || ''}`.trim();
	if(!txt){
		return '';
	}
	const match = txt.match(/[甲乙丙丁戊己庚辛壬癸]/);
	return match ? match[0] : '';
}

function normalizeQimenDoor(raw){
	const txt = `${raw || ''}`.trim();
	if(!txt){
		return '';
	}
	const key = txt.replace(/門/g, '门');
	return QIMEN_DOOR_MAP[key] || QIMEN_DOOR_MAP[key.substring(0, 1)] || '';
}

function normalizeQimenStar(raw){
	const txt = `${raw || ''}`.trim();
	if(!txt){
		return '';
	}
	return QIMEN_STAR_MAP[txt] || QIMEN_STAR_MAP[txt.substring(0, 1)] || '';
}

function normalizeQimenGod(raw){
	const txt = `${raw || ''}`.trim();
	if(!txt){
		return '';
	}
	return QIMEN_GOD_MAP[txt] || QIMEN_GOD_MAP[txt.substring(0, 1)] || '';
}

function collectQimenTokensFromSectionLines(lines){
	const stems = new Set();
	const doors = new Set();
	const stars = new Set();
	const gods = new Set();
	const src = Array.isArray(lines) ? lines : [];

	const addByList = (list, type)=>{
		(list || []).forEach((one)=>{
			const txt = `${one || ''}`.trim();
			if(!txt){
				return;
			}
			if(type === 'stem'){
				const v = normalizeQimenStem(txt);
				if(v){
					stems.add(v);
				}
				return;
			}
			if(type === 'door'){
				const v = normalizeQimenDoor(txt);
				if(v){
					doors.add(v);
				}
				return;
			}
			if(type === 'star'){
				const v = normalizeQimenStar(txt);
				if(v){
					stars.add(v);
				}
				return;
			}
			if(type === 'god'){
				const v = normalizeQimenGod(txt);
				if(v){
					gods.add(v);
				}
			}
		});
	};

	src.forEach((line)=>{
		const txt = `${line || ''}`.trim();
		if(!txt){
			return;
		}
		const detailMatch = txt.match(/天盘干[：:]\s*([甲乙丙丁戊己庚辛壬癸]).*?八神[：:]\s*([^\s；;，,]+).*?九星[：:]\s*([^\s；;，,]+).*?地盘干[：:]\s*([甲乙丙丁戊己庚辛壬癸])/);
		if(detailMatch){
			addByList([detailMatch[1], detailMatch[4]], 'stem');
			addByList([detailMatch[2]], 'god');
			addByList([detailMatch[3]], 'star');
		}
		const lineMap = [
			{ prefix: '地盘', type: 'stem' },
			{ prefix: '天盘', type: 'stem' },
			{ prefix: '人盘', type: 'door' },
			{ prefix: '神盘', type: 'god' },
		];
		lineMap.forEach((item)=>{
			const m = txt.match(new RegExp(`^${item.prefix}\\s*[：:]\\s*(.+)$`));
			if(!m || !m[1]){
				return;
			}
			const list = `${m[1]}`.split(/[\s、,，;；/]+/).filter(Boolean);
			addByList(list, item.type);
		});
		if(!txt.includes('宫')){
			return;
		}
		const m = txt.match(/^[^：:]+[：:]\s*(.+)$/);
		if(!m || !m[1]){
			return;
		}
		const list = `${m[1]}`.split(/[\s、,，;；/]+/).filter(Boolean);
		if(list.length >= 5){
			addByList([list[0], list[4]], 'stem');
			addByList([list[1]], 'god');
			addByList([list[2]], 'door');
			addByList([list[3]], 'star');
			return;
		}
		addByList(list, 'stem');
		addByList(list, 'god');
		addByList(list, 'door');
		addByList(list, 'star');
	});

	return {
		stems,
		doors,
		stars,
		gods,
	};
}

function buildQimenTipLines(type, key){
	const tipObj = buildQimenXiangTipObj(type, key);
	if(!tipObj){
		return [];
	}
	const lines = [];
	lines.push(`### ${safe(tipObj.title, key)}`);
	const blocks = Array.isArray(tipObj.blocks) ? tipObj.blocks : [];
	blocks.forEach((block)=>{
		if(!block){
			return;
		}
		if(block.type === 'blank'){
			lines.push('');
			return;
		}
		if(block.type === 'divider'){
			lines.push('==');
			return;
		}
		if(block.type === 'subTitle'){
			lines.push(`### ${safe(block.text, '')}`);
			return;
		}
		const plain = safe(block.text, '').replace(/<[^>]+>/g, '');
		lines.push(plain);
	});
	lines.push('');
	return lines;
}

function buildQimenMeaningLinesByTokens(tokens){
	const lines = [];
	const stems = sortByOrderSet(tokens && tokens.stems, QIMEN_STEM_ORDER);
	const doors = sortByOrderSet(tokens && tokens.doors, QIMEN_DOOR_ORDER);
	const stars = sortByOrderSet(tokens && tokens.stars, QIMEN_STAR_ORDER);
	const gods = sortByOrderSet(tokens && tokens.gods, QIMEN_GOD_ORDER);

	if(stems.length){
		lines.push('【十天干释义】');
		stems.forEach((one)=>{
			lines.push(...buildQimenTipLines('stem', one));
		});
	}
	if(doors.length){
		lines.push('【八门释义】');
		doors.forEach((one)=>{
			lines.push(...buildQimenTipLines('door', one));
		});
	}
	if(stars.length){
		lines.push('【九星释义】');
		stars.forEach((one)=>{
			lines.push(...buildQimenTipLines('star', one));
		});
	}
	if(gods.length){
		lines.push('【八神释义】');
		gods.forEach((one)=>{
			lines.push(...buildQimenTipLines('god', one));
		});
	}
	while(lines.length && lines[lines.length - 1] === ''){
		lines.pop();
	}
	return lines;
}

function normalizeLiurengBranch(raw){
	const match = `${raw || ''}`.match(/[子丑寅卯辰巳午未申酉戌亥]/);
	return match ? match[0] : '';
}

function normalizeLiurengJiang(raw){
	const txt = `${raw || ''}`
		.replace(/（[^）]*）/g, '')
		.replace(/\([^)]*\)/g, '')
		.replace(/^贵神/, '')
		.replace(/^神将/, '')
		.trim();
	return txt;
}

function collectLiurengEntriesFromSectionLines(lines){
	const entries = [];
	const src = Array.isArray(lines) ? lines : [];
	let currentBranch = '';
	src.forEach((line)=>{
		const txt = `${line || ''}`.trim();
		if(!txt){
			return;
		}
		const branchMark = txt.match(/「([子丑寅卯辰巳午未申酉戌亥])\s*[-－]/);
		if(branchMark && branchMark[1]){
			currentBranch = branchMark[1];
		}
		const m = txt.match(/地盘\s*([子丑寅卯辰巳午未申酉戌亥]).*?天盘\s*([子丑寅卯辰巳午未申酉戌亥]).*?贵神[:：]?\s*([^\s；;，,]+)/);
		if(m && m[1] && m[2] && m[3]){
			entries.push({
				di: m[1],
				tian: m[2],
				jiang: normalizeLiurengJiang(m[3]),
			});
			return;
		}
		const s = txt.match(/六壬[:：].*?天盘[:：]\s*([子丑寅卯辰巳午未申酉戌亥]).*?神将[:：]\s*([^\s；;，,]+)/);
		if(s && s[1] && s[2] && currentBranch){
			entries.push({
				di: currentBranch,
				tian: s[1],
				jiang: normalizeLiurengJiang(s[2]),
			});
		}
	});
	const uniq = [];
	const seen = new Set();
	entries.forEach((one)=>{
		if(!one || !one.di || !one.tian || !one.jiang){
			return;
		}
		const key = `${one.di}|${one.tian}|${one.jiang}`;
		if(seen.has(key)){
			return;
		}
		seen.add(key);
		uniq.push(one);
	});
	return uniq;
}

function buildLiurengTipLines(tipObj){
	if(!tipObj){
		return [];
	}
	const lines = [];
	lines.push(`### ${safe(tipObj.title, '')}`);
	(tipObj.tips || []).forEach((one)=>{
		lines.push(`${one}`);
	});
	lines.push('');
	return lines;
}

function buildLiurengMeaningLinesByEntries(entries){
	const lines = [];
	const branchSet = new Set();
	(entries || []).forEach((one)=>{
		if(one && one.tian){
			branchSet.add(one.tian);
		}
	});
	const branches = sortByOrderSet(branchSet, LIURENG_BRANCH_ORDER);
	if(branches.length){
		lines.push('【十二神释义】');
		branches.forEach((branch)=>{
			lines.push(...buildLiurengTipLines(buildLiuRengShenTipObj(branch)));
		});
	}
	const houseTips = [];
	const seenHouse = new Set();
	(entries || []).forEach((one)=>{
		if(!one){
			return;
		}
		const key = `${one.di}|${one.tian}|${one.jiang}`;
		if(seenHouse.has(key)){
			return;
		}
		seenHouse.add(key);
		const tip = buildLiuRengHouseTipObj(one.jiang, one.tian, one.di);
		if(tip){
			houseTips.push(tip);
		}
	});
	if(houseTips.length){
		lines.push('【天将释义】');
		houseTips.forEach((tip)=>{
			lines.push(...buildLiurengTipLines(tip));
		});
	}
	while(lines.length && lines[lines.length - 1] === ''){
		lines.pop();
	}
	return lines;
}

function appendQimenMeaningSections(content){
	const sections = splitContentSections(content);
	if(!sections || !sections.length){
		return content;
	}
	const relevantTitles = new Set(['盘型', '盘面要素', '九宫方盘', '八宫详解']);
	const outSections = [];
	sections.forEach((sec)=>{
		outSections.push(sec);
		const title = `${sec && sec.title ? sec.title : ''}`.trim();
		if(!title || title.includes('注释') || title.includes('释义')){
			return;
		}
		if(!relevantTitles.has(title)){
			return;
		}
		const tokens = collectQimenTokensFromSectionLines((sec.lines || []).slice(1));
		const meaningLines = buildQimenMeaningLinesByTokens(tokens);
		if(!meaningLines.length){
			return;
		}
		outSections.push({
			title: `${title}注释`,
			lines: [
				`[${title}注释]`,
				...meaningLines,
			],
		});
	});
	return joinSectionBlocks(outSections) || content;
}

function appendLiurengMeaningSections(content){
	const sections = splitContentSections(content);
	if(!sections || !sections.length){
		return content;
	}
	const outSections = [];
	sections.forEach((sec)=>{
		outSections.push(sec);
		const title = `${sec && sec.title ? sec.title : ''}`.trim();
		if(!title || title.includes('注释') || title.includes('释义')){
			return;
		}
		if(title !== '十二地盘/十二天盘/十二贵神对应' && title !== '大六壬'){
			return;
		}
		const entries = collectLiurengEntriesFromSectionLines((sec.lines || []).slice(1));
		const meaningLines = buildLiurengMeaningLinesByEntries(entries);
		if(!meaningLines.length){
			return;
		}
		outSections.push({
			title: `${title}注释`,
			lines: [
				`[${title}注释]`,
				...meaningLines,
			],
		});
	});
	return joinSectionBlocks(outSections) || content;
}

function appendSanShiUnitedMeaningSections(content){
	const sections = splitContentSections(content);
	if(!sections || !sections.length){
		return content;
	}
	const outSections = [];
	sections.forEach((sec)=>{
		outSections.push(sec);
		const title = `${sec && sec.title ? sec.title : ''}`.trim();
		if(!title || title.includes('注释') || title.includes('释义')){
			return;
		}
		const isPalaceSection = title.includes('宫');
		const isLiuRengRefSection = title.indexOf('六壬') === 0;
		if(!isPalaceSection && title !== '大六壬' && !isLiuRengRefSection){
			return;
		}
		const lines = (sec.lines || []).slice(1);
		const qimenTokens = collectQimenTokensFromSectionLines(lines);
		const liurengEntries = collectLiurengEntriesFromSectionLines(lines);
		const planets = detectIdsByAliasMap(lines, PLANET_ALIAS_MAP);
		const lots = detectIdsByAliasMap(lines, LOT_ALIAS_MAP);
		const signs = detectIdsByAliasMap(lines, SIGN_ALIAS_MAP);
		const houses = detectIdsByAliasMap(lines, HOUSE_ALIAS_MAP);
		const aspects = detectAspectDegreesFromLines(lines);

		const meaningLines = []
			.concat(buildQimenMeaningLinesByTokens(qimenTokens))
			.concat(buildLiurengMeaningLinesByEntries(liurengEntries))
			.concat(buildMeaningLinesForIds('planet', planets, '星释义'))
			.concat(buildMeaningLinesForIds('lot', lots, '希腊点释义'))
			.concat(buildMeaningLinesForIds('sign', signs, '星座释义'))
			.concat(buildMeaningLinesForIds('house', houses, '宫位释义'))
			.concat(buildMeaningLinesForAspects(aspects));
		if(!meaningLines.length){
			return;
		}
		outSections.push({
			title: `${title}注释`,
			lines: [
				`[${title}注释]`,
				...meaningLines,
			],
		});
	});
	return joinSectionBlocks(outSections) || content;
}

function applyAstroMeaningFilterByContext(content, key){
	const support = isAstroMeaningTechnique(key) || isHoverMeaningTechnique(key);
	if(!support){
		return content;
	}
	const settings = loadAIExportSettings();
	const mode = getAstroMeaningSettingByTechnique(settings, key);
	if(mode.enabled !== 1){
		return content;
	}
	if(key === 'qimen'){
		return appendQimenMeaningSections(content);
	}
	if(key === 'liureng'){
		return appendLiurengMeaningSections(content);
	}
	if(key === 'sanshiunited'){
		return appendSanShiUnitedMeaningSections(content);
	}
	return appendAstroMeaningSections(content);
}

function safeFileName(name){
	const val = (name || 'export')
		.replace(/[\\/:*?"<>|]/g, '_')
		.replace(/\s+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '');
	return val || 'export';
}

function escapeHtml(str){
	return (str || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function pad2(num){
	return `${num}`.padStart(2, '0');
}

function formatDateTime(date){
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function formatStamp(date){
	return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}_${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
}

function downloadBlob(filename, content, mime){
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.style.display = 'none';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

async function copyText(text){
	if(navigator.clipboard && window.isSecureContext){
		try{
			await navigator.clipboard.writeText(text);
			return true;
		}catch(e){
			// 继续回退到 execCommand，避免权限异常导致无提示。
		}
	}
	const ta = document.createElement('textarea');
	ta.value = text;
	ta.setAttribute('readonly', '');
	ta.style.position = 'fixed';
	ta.style.left = '-9999px';
	document.body.appendChild(ta);
	ta.select();
	ta.setSelectionRange(0, ta.value.length);
	let ok = false;
	try{
		ok = document.execCommand('copy');
	}catch(e){
		ok = false;
	}
	document.body.removeChild(ta);
	return ok;
}

function printAsPdf(title, text){
	const win = window.open('', '_blank');
	if(!win){
		return false;
	}
	const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4; margin: 16mm; }
body { font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; color: #111; }
pre { white-space: pre-wrap; word-break: break-word; line-height: 1.5; font-size: 12px; }
</style>
</head>
<body>
<pre>${escapeHtml(text)}</pre>
<script>
window.onload = function(){
  setTimeout(function(){ window.print(); }, 120);
};
</script>
</body>
</html>`;
	win.document.open();
	win.document.write(html);
	win.document.close();
	return true;
}

function exportTxt(payload){
	downloadBlob(`${payload.filenameBase}.txt`, payload.text, 'text/plain;charset=utf-8');
}

function exportWord(payload){
	const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(payload.tech)}</title>
</head>
<body>
<pre style="white-space: pre-wrap; word-break: break-word; font-family: 'Microsoft YaHei', Arial, sans-serif; line-height: 1.5;">${escapeHtml(payload.text)}</pre>
</body>
</html>`;
	downloadBlob(`${payload.filenameBase}.doc`, html, 'application/msword;charset=utf-8');
}

function normalizeExportKey(key){
	const val = `${key || ''}`;
	if(val === 'direction'){
		return 'primarydirect';
	}
	return val;
}

function isStrictSpecificExportKey(key){
	const val = normalizeExportKey(key);
	if(!val){
		return false;
	}
	if(val === 'generic' || val === 'cntradition' || val === 'cnyibu'){
		return false;
	}
	return AI_EXPORT_TECHNIQUES.some((item)=>item.key === val);
}

function isPredictiveExportKey(key){
	const val = normalizeExportKey(key);
	return val === 'primarydirect'
		|| val === 'primarydirchart'
		|| val === 'zodialrelease'
		|| val === 'firdaria'
		|| val === 'profection'
		|| val === 'solararc'
		|| val === 'solarreturn'
		|| val === 'lunarreturn'
		|| val === 'givenyear'
		|| val === 'decennials';
}

function isAstroFamilyExportKey(key){
	const val = normalizeExportKey(key);
	if(!val){
		return false;
	}
	if(isPredictiveExportKey(val)){
		return true;
	}
	return val === 'astrochart'
		|| val === 'astrochart_like'
		|| val === 'indiachart'
		|| val === 'relative'
		|| val === 'germany'
		|| val === 'jieqi'
		|| val === 'guolao';
}

function getTechniqueLabelByKey(key){
	const found = AI_EXPORT_TECHNIQUES.find((item)=>item.key === `${key || ''}`);
	return found ? found.label : '';
}

function getPayloadDisplayName(usedExportKey, context){
	const contextKey = normalizeExportKey(context && context.key ? context.key : '');
	const contextName = `${context && context.displayName ? context.displayName : ''}`.trim();
	if(usedExportKey === 'astrochart'){
		return getTechniqueLabelByKey('astrochart') || contextName || '当前技术';
	}
	if(usedExportKey === 'astrochart_like'){
		return getTechniqueLabelByKey('astrochart_like') || contextName || '当前技术';
	}
	if(usedExportKey === 'suzhan'){
		return getTechniqueLabelByKey('suzhan') || contextName || '当前技术';
	}
	if(contextName && contextKey && contextKey === usedExportKey && contextKey !== 'generic'){
		return contextName;
	}
	return getTechniqueLabelByKey(usedExportKey) || contextName || '当前技术';
}

function getCandidateExportKeys(context){
	const keys = [];
	const primary = normalizeExportKey(context && context.key ? context.key : '');
	if(primary){
		keys.push(primary);
	}
	const hasPrimarySpecific = !!primary && primary !== 'generic';
	const stateContext = resolveContextByAstroState();
	const stateKey = normalizeExportKey(stateContext && stateContext.key ? stateContext.key : '');
	const shouldAppendStateKey = !!stateKey && (
		!hasPrimarySpecific
		|| stateKey === primary
		|| !isStrictSpecificExportKey(primary)
	);
	if(shouldAppendStateKey){
		keys.push(stateKey);
	}

	const topInfo = [
		context && context.topLabel ? context.topLabel : '',
		context && context.displayName ? context.displayName : '',
		stateContext && stateContext.displayName ? stateContext.displayName : '',
	].join(' ');
	const predictiveKeys = ['primarydirect', 'primarydirchart', 'zodialrelease', 'firdaria', 'profection', 'solararc', 'solarreturn', 'lunarreturn', 'givenyear', 'decennials'];
	const primaryIsPredictive = isPredictiveExportKey(primary);
	const stateIsPredictive = isPredictiveExportKey(stateKey);
	// 仅在上下文无法定位具体推运子模块时，才展开推运候选全量兜底；
	// 避免“太阳弧导出成主限法”这类串台。
	if((topInfo.includes('推运盘') || stateIsPredictive) && !primaryIsPredictive){
		keys.push(...predictiveKeys);
	}
	if(topInfo.includes('三式合一') && !hasPrimarySpecific){
		keys.push('sanshiunited', 'qimen', 'jinkou', 'liureng', 'sixyao', 'tongshefa', 'taiyi');
	}
	if(topInfo.includes('易与三式') && !hasPrimarySpecific){
		keys.push('suzhan', 'sixyao', 'jinkou', 'liureng', 'qimen', 'taiyi', 'tongshefa');
	}
	if((topInfo.includes('八字紫微') || topInfo.includes('八字') || topInfo.includes('紫微')) && !hasPrimarySpecific){
		keys.push('bazi', 'ziwei');
	}
	if(topInfo.includes('量化盘') && !hasPrimarySpecific){
		keys.push('germany');
	}
	if(topInfo.includes('关系盘') && !hasPrimarySpecific){
		keys.push('relative');
	}
	if(topInfo.includes('七政四余') && !hasPrimarySpecific){
		keys.push('guolao');
	}
	if(topInfo.includes('节气盘') && !hasPrimarySpecific){
		keys.push('jieqi');
	}
	if(topInfo.includes('印度律盘') && !hasPrimarySpecific){
		keys.push('indiachart');
	}
	if((topInfo.includes('星盘') || topInfo.includes('三维盘') || topInfo.includes('希腊星术') || topInfo.includes('星体地图')) && !hasPrimarySpecific){
		keys.push('astrochart', 'astrochart_like');
	}

	// 兜底候选：确保上下文误判时仍能从计算快照抓到内容。
	if(!hasPrimarySpecific){
		keys.push('astrochart', 'astrochart_like', 'indiachart', 'relative', 'germany', 'jieqi', 'guolao', 'bazi', 'ziwei', 'qimen', 'liureng', 'jinkou', 'sanshiunited', 'tongshefa', 'sixyao', 'taiyi', 'otherbu', 'fengshui');
	}

	return uniqueArray(keys.map((key)=>normalizeExportKey(key)).filter(Boolean));
}

function getRescueExportKeys(context, fallbackStateContext, triedKeys){
	const tried = triedKeys instanceof Set ? triedKeys : new Set();
	const keys = [];
	const push = (...arr)=>{
		arr.forEach((item)=>{
			const key = normalizeExportKey(item);
			if(!key || key === 'generic'){
				return;
			}
			if(tried.has(key)){
				return;
			}
			if(keys.includes(key)){
				return;
			}
			keys.push(key);
		});
	};

	const contextKey = normalizeExportKey(context && context.key ? context.key : '');
	const stateKey = normalizeExportKey(fallbackStateContext && fallbackStateContext.key ? fallbackStateContext.key : '');
	const hasContextSpecific = isStrictSpecificExportKey(contextKey);
	const topInfo = [
		context && context.topLabel ? context.topLabel : '',
		context && context.displayName ? context.displayName : '',
		fallbackStateContext && fallbackStateContext.displayName ? fallbackStateContext.displayName : '',
	].join(' ');

	push(contextKey);
	if(!hasContextSpecific){
		push(stateKey);
	}
	if(hasContextSpecific){
		if(contextKey === 'jieqi'){
			push('jieqi', 'jieqi_current');
			return keys;
		}
		push(contextKey);
		return keys;
	}
	if(topInfo.includes('推运盘') || topInfo.includes('主/界限法') || topInfo.includes('法达星限')
		|| topInfo.includes('太阳弧') || topInfo.includes('太阳返照') || topInfo.includes('月亮返照')){
		push('primarydirect', 'primarydirchart', 'firdaria', 'zodialrelease', 'profection', 'solararc', 'solarreturn', 'lunarreturn', 'givenyear', 'decennials');
	}
	if(topInfo.includes('三式合一')){
		push('sanshiunited', 'qimen', 'jinkou', 'liureng', 'sixyao', 'tongshefa', 'taiyi', 'astrochart');
	}
	if(topInfo.includes('易与三式') || topInfo.includes('六壬') || topInfo.includes('金口诀') || topInfo.includes('遁甲')){
		push('jinkou', 'liureng', 'qimen', 'sixyao', 'tongshefa', 'taiyi', 'suzhan');
	}
	if(topInfo.includes('八字') || topInfo.includes('紫微')){
		push('bazi', 'ziwei');
	}
	if(topInfo.includes('关系盘')){
		push('relative');
	}
	if(topInfo.includes('量化盘')){
		push('germany');
	}
	if(topInfo.includes('节气盘')){
		push('jieqi');
	}
	if(topInfo.includes('印度律盘')){
		push('indiachart', 'astrochart');
	}
	if(topInfo.includes('七政四余')){
		push('guolao', 'astrochart_like', 'astrochart');
	}
	if(topInfo.includes('星盘') || topInfo.includes('希腊星术') || topInfo.includes('星体地图') || topInfo.includes('三维盘')){
		push('astrochart', 'astrochart_like', 'indiachart');
	}
	// 终极兜底：按术法族群补全，避免误报“无可导出文本”。
	push(
		'astrochart', 'astrochart_like', 'indiachart',
		'relative', 'germany', 'jieqi',
		'primarydirect', 'primarydirchart', 'zodialrelease', 'firdaria', 'profection', 'solararc', 'solarreturn', 'lunarreturn', 'givenyear', 'decennials',
		'sanshiunited', 'qimen', 'liureng', 'jinkou', 'sixyao', 'tongshefa', 'taiyi', 'suzhan',
		'guolao', 'otherbu', 'fengshui',
		'bazi', 'ziwei',
	);
	return keys;
}

async function extractContentByKey(exportKey, context){
	if(exportKey === 'astrochart' || exportKey === 'astrochart_like' || exportKey === 'indiachart'){
		return extractAstroContent(context);
	}
	if(exportKey === 'germany'){
		return extractGermanyContent(context);
	}
	if(exportKey === 'jieqi'){
		return extractJieQiContent(context);
	}
	if(exportKey === 'primarydirect'){
		return extractPrimaryDirectContent(context);
	}
	if(exportKey === 'primarydirchart'){
		return extractPrimaryDirChartContent(context);
	}
	if(exportKey === 'zodialrelease'){
		return extractZodialReleaseContent(context);
	}
	if(exportKey === 'firdaria'){
		return extractFirdariaContent(context);
	}
	if(exportKey === 'profection'){
		return extractProfectionContent(context);
	}
	if(exportKey === 'solararc'){
		return extractSolarArcContent(context);
	}
	if(exportKey === 'solarreturn'){
		return extractSolarReturnContent(context);
	}
	if(exportKey === 'lunarreturn'){
		return extractLunarReturnContent(context);
	}
	if(exportKey === 'givenyear'){
		return extractGivenYearContent(context);
	}
	if(exportKey === 'decennials'){
		return extractDecennialsContent(context);
	}
	if(exportKey === 'sixyao'){
		return extractSixYaoContent(context);
	}
	if(exportKey === 'liureng'){
		return extractLiuRengContent(context);
	}
	if(exportKey === 'jinkou'){
		return extractJinKouContent(context);
	}
	if(exportKey === 'qimen'){
		return extractQiMenContent(context);
	}
	if(exportKey === 'sanshiunited'){
		return extractSanShiUnitedContent(context);
	}
	if(exportKey === 'tongshefa'){
		return extractTongSheFaContent(context);
	}
	if(exportKey === 'taiyi'){
		return extractTaiYiContent(context);
	}
	if(exportKey === 'relative'){
		return extractRelativeContent(context);
	}
	if(exportKey === 'guolao'){
		return extractSimpleModuleContent('guolao');
	}
	if(exportKey === 'suzhan'){
		return extractSimpleModuleContent('suzhan');
	}
	if(exportKey === 'bazi'){
		return extractSimpleModuleContent('bazi');
	}
	if(exportKey === 'ziwei'){
		return extractSimpleModuleContent('ziwei');
	}
	if(exportKey === 'otherbu'){
		return extractOtherBuContent(context);
	}
	if(exportKey === 'fengshui'){
		return extractFengShuiContent(context);
	}
	return extractGenericContent(context);
}

async function buildPayload(){
	const context = withStoreContextFallback(resolveActiveContext());
	const exportKey = normalizeExportKey(context.key);
	const now = new Date();

	let content = '';
	let usedExportKey = exportKey;
	const fallbackStateContext = resolveContextByAstroState();
	const fallbackStateKey = normalizeExportKey(fallbackStateContext && fallbackStateContext.key ? fallbackStateContext.key : '');
	const candidateKeys = getCandidateExportKeys(context);

	for(let i=0; i<candidateKeys.length; i++){
		const key = candidateKeys[i];
		const candidateContext = (fallbackStateKey && key === fallbackStateKey)
			? { ...context, ...fallbackStateContext }
			: context;
		const txt = await extractContentByKey(key, candidateContext);
		if(txt && `${txt}`.trim()){
			content = txt;
			usedExportKey = key;
			break;
		}
	}
	if(!content){
		content = await extractContentByKey(usedExportKey, context);
	}
	if(!`${content || ''}`.trim()){
		const tried = new Set(candidateKeys.map((key)=>normalizeExportKey(key)).filter(Boolean));
		const rescueKeys = getRescueExportKeys(context, fallbackStateContext, tried);
		for(let i=0; i<rescueKeys.length; i++){
			const key = rescueKeys[i];
			const candidateContext = (fallbackStateKey && key === fallbackStateKey)
				? { ...context, ...fallbackStateContext }
				: context;
			// eslint-disable-next-line no-await-in-loop
			const txt = await extractContentByKey(key, candidateContext);
			if(txt && `${txt}`.trim()){
				content = txt;
				usedExportKey = key;
				break;
			}
		}
	}

	const rawSnapshotContent = stripForbiddenSections(content, usedExportKey);
	content = applyUserSectionFilterByContext(rawSnapshotContent, usedExportKey);
	let planetSettingKey = usedExportKey;
	if(usedExportKey === 'jieqi'){
		planetSettingKey = detectJieQiSettingKeyByScope(context.scopeRoot) || detectJieQiSettingKeyByCurrentSnapshot() || 'jieqi';
	}
	content = applyPlanetInfoFilterByContext(content, planetSettingKey);
	content = normalizeText(content, context.domain);
	content = applyAstroMeaningFilterByContext(content, planetSettingKey)
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	if(!content && rawSnapshotContent){
		// 兜底：设置过滤链条异常时，回退到计算快照原文，避免“无可导出文本”误报。
		content = applyAstroMeaningFilterByContext(normalizeText(rawSnapshotContent, context.domain), planetSettingKey)
			.replace(/\n{3,}/g, '\n\n')
			.trim();
	}
	const displayName = getPayloadDisplayName(usedExportKey, context);
	const stamp = formatStamp(now);
	const time = formatDateTime(now);
	const filenameBase = `horosa_${safeFileName(displayName)}_${stamp}`;
	const header = [
		`技术: ${displayName}`,
		`导出时间: ${time}`,
		`页面: ${window.location.href}`,
		'说明: 当前激活技术面板专属导出；符号已转为AI可识别文本。',
		'',
		'========== 内容开始 =========='
	].join('\n');
	const text = `${header}\n${content}\n========== 内容结束 ==========`;

	return {
		tech: displayName,
		content,
		text,
		filenameBase,
	};
}

export async function runAIExport(action){
	try{
		const payload = await buildPayload();
		const pure = (payload.content || '').replace(/\s/g, '');
		if(!pure){
			return { ok: false, message: '当前页面没有可导出文本。' };
		}

		if(action === 'copy'){
			const ok = await copyText(payload.text);
			return { ok: ok, message: ok ? 'AI纯文字已复制。' : '复制失败，请手动导出TXT。' };
		}
		if(action === 'txt'){
			exportTxt(payload);
			return { ok: true, message: 'TXT 已导出。' };
		}
		if(action === 'word'){
			exportWord(payload);
			return { ok: true, message: 'Word 已导出。' };
		}
		if(action === 'pdf'){
			const ok = printAsPdf(payload.tech, payload.text);
			return { ok: ok, message: ok ? 'PDF 打印窗口已打开。' : 'PDF 窗口被浏览器拦截。' };
		}
		if(action === 'all'){
			const copied = await copyText(payload.text);
			exportTxt(payload);
			exportWord(payload);
			const pdfOk = printAsPdf(payload.tech, payload.text);
			return {
				ok: true,
				message: copied
					? (pdfOk ? '已完成复制 + TXT/Word/PDF。' : '已完成复制 + TXT/Word，PDF窗口被拦截。')
					: (pdfOk ? '已导出TXT/Word/PDF（复制失败）。' : '已导出TXT/Word（复制失败，PDF窗口被拦截）。')
			};
		}
		return { ok: false, message: '未知导出动作。' };
	}catch(e){
		const msg = e && e.message ? e.message : 'AI导出异常，请重试。';
		return { ok: false, message: msg };
	}
}
