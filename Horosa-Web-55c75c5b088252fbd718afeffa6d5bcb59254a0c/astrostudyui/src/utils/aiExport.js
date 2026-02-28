import { getStore, } from './storageutil';
import { getAstroAISnapshotForCurrent, saveAstroAISnapshot, } from './astroAiSnapshot';
import { loadModuleAISnapshot, } from './moduleAiSnapshot';
import { ASTRO_ANNOTATION_SECTION_TITLE, } from '../constants/AstroInterpretation';
import {
	filterPlanetMetaSuffix,
	normalizePlanetMetaDisplay,
	readPlanetMetaDisplayFromStore,
} from './planetMetaDisplay';

const CHART_TAB_LABELS = ['信息', '相位', '行星', '希腊点', '可能性'];
const SIXYAO_TAB_LABELS = ['起卦方式', '卦辞'];

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
	{ key: 'zodialrelease', label: '推运盘-黄道星释' },
	{ key: 'firdaria', label: '推运盘-法达星限' },
	{ key: 'profection', label: '推运盘-小限法' },
	{ key: 'solararc', label: '推运盘-太阳弧' },
	{ key: 'solarreturn', label: '推运盘-太阳返照' },
	{ key: 'lunarreturn', label: '推运盘-月亮返照' },
	{ key: 'givenyear', label: '推运盘-流年法' },
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
	...JIEQI_SPLIT_TECHNIQUES,
	{ key: 'otherbu', label: '西洋游戏' },
	{ key: 'fengshui', label: '风水' },
	{ key: 'generic', label: '其他页面' },
];
const AI_EXPORT_TECHNIQUE_LABEL_MAP = AI_EXPORT_TECHNIQUES.reduce((acc, item)=>{
	acc[item.key] = item.label;
	return acc;
}, {});
const MODULE_SNAPSHOT_ALIASES = {
	guazhan: ['sixyao'],
	sixyao: ['guazhan'],
	qimen: ['dunjia'],
	dunjia: ['qimen'],
	relative: ['relativechart'],
	relativechart: ['relative'],
	indiachart: ['indiachart_current'],
	jieqi: ['jieqi_current'],
};
const AI_EXPORT_PLANET_META_TECHNIQUES = new Set([
	'astrochart',
	'indiachart',
	'astrochart_like',
	'relative',
	'primarydirect',
	'zodialrelease',
	'firdaria',
	'profection',
	'solararc',
	'solarreturn',
	'lunarreturn',
	'givenyear',
	'germany',
	'jieqi',
	'jieqi_meta',
	'jieqi_chunfen',
	'jieqi_xiazhi',
	'jieqi_qiufen',
	'jieqi_dongzhi',
	'sanshiunited',
]);
const AI_EXPORT_PLANET_META_DEFAULT = {
	showHouse: 1,
	showRuler: 1,
};
const AI_EXPORT_ANNOTATION_DEFAULT = 1;
const AI_EXPORT_ANNOTATION_TECHNIQUES = new Set([
	'astrochart',
	'indiachart',
	'astrochart_like',
	'relative',
	'primarydirect',
	'zodialrelease',
	'firdaria',
	'profection',
	'solararc',
	'solarreturn',
	'lunarreturn',
	'givenyear',
	'germany',
]);

const AI_EXPORT_PRESET_SECTIONS = {
	astrochart: ['起盘信息', '宫位宫头', '星与虚点', '信息', '相位', '行星', '希腊点', '可能性', ASTRO_ANNOTATION_SECTION_TITLE],
	indiachart: ['星盘信息', '起盘信息', '信息', '相位', '行星', '希腊点', '可能性', ASTRO_ANNOTATION_SECTION_TITLE],
	astrochart_like: ['起盘信息', '宫位宫头', '星与虚点', '信息', '相位', '行星', '希腊点', '可能性', ASTRO_ANNOTATION_SECTION_TITLE],
	relative: ['关系起盘信息', 'A对B相位', 'B对A相位', 'A对B中点相位', 'B对A中点相位', 'A对B映点', 'A对B反映点', 'B对A映点', 'B对A反映点', '合成图盘', '影响图盘-星盘A', '影响图盘-星盘B'],
	primarydirect: ['出生时间', '星盘信息', '主/界限法表格'],
	zodialrelease: ['起盘信息', '星盘信息', '基于X点推运'],
	firdaria: ['出生时间', '星盘信息', '法达星限表格'],
	profection: ['星盘信息', '起盘信息', '相位'],
	solararc: ['星盘信息', '起盘信息', '相位'],
	solarreturn: ['星盘信息', '起盘信息', '相位'],
	lunarreturn: ['星盘信息', '起盘信息', '相位'],
	givenyear: ['星盘信息', '起盘信息', '相位'],
	bazi: ['起盘信息', '四柱与三元', '流年行运概略', '神煞（四柱与三元）'],
	ziwei: ['起盘信息'],
	suzhan: ['起盘信息'],
	sixyao: ['起盘信息', '起卦方式', '卦辞'],
	tongshefa: ['本卦', '六爻', '潜藏', '亲和'],
	liureng: ['起盘信息'],
	jinkou: ['起盘信息', '金口诀速览', '金口诀四位', '四位神煞'],
	taiyi: ['起盘信息', '太乙盘', '十六宫标记'],
	qimen: ['起盘信息', '盘型', '右侧栏目', '九宫方盘'],
	sanshiunited: ['起盘信息', '概览', '太乙', '太乙十六宫', '神煞', '六壬-概览', '六壬-大格', '六壬-小局', '六壬-参考', '正北坎宫', '东北艮宫', '正东震宫', '东南巽宫', '正南离宫', '西南坤宫', '正西兑宫', '西北乾宫'],
	guolao: ['起盘信息', '七政四余宫位与二十八宿星曜', '神煞'],
	germany: ['起盘信息'],
	jieqi: ['节气盘参数', '春分星盘', '春分宿盘', '夏至星盘', '夏至宿盘', '秋分星盘', '秋分宿盘', '冬至星盘', '冬至宿盘'],
	...JIEQI_SETTING_PRESETS,
	otherbu: ['起盘信息'],
	fengshui: ['起盘信息', '标记判定', '冲突清单', '建议汇总', '纳气建议'],
	generic: ['起盘信息'],
};

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

function isElementVisible(node){
	if(!node || !(node instanceof HTMLElement)){
		return false;
	}
	const style = window.getComputedStyle(node);
	if(!style || style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none'){
		return false;
	}
	const rect = node.getBoundingClientRect();
	return rect.width > 1 && rect.height > 1;
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

function normalizeSectionTitle(title){
	const t = `${title || ''}`.trim();
	if(!t){
		return '';
	}
	if(/^基于.+推运$/.test(t)){
		return '基于X点推运';
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

function supportsPlanetMetaSettingsForTechnique(key){
	return AI_EXPORT_PLANET_META_TECHNIQUES.has(key);
}

function supportsAnnotationSettingsForTechnique(key){
	return AI_EXPORT_ANNOTATION_TECHNIQUES.has(key);
}

function normalizeAIExportPlanetMeta(raw){
	const src = raw && typeof raw === 'object' ? raw : {};
	return {
		showHouse: src.showHouse === 0 || src.showHouse === false ? 0 : 1,
		showRuler: src.showRuler === 0 || src.showRuler === false ? 0 : 1,
	};
}

function resolveAIExportPlanetMetaForKey(settings, key){
	const storeDisplay = normalizePlanetMetaDisplay(readPlanetMetaDisplayFromStore());
	if(!supportsPlanetMetaSettingsForTechnique(key)){
		return storeDisplay;
	}
	const all = settings && settings.planetMeta && typeof settings.planetMeta === 'object'
		? settings.planetMeta
		: {};
	const cfg = normalizeAIExportPlanetMeta(all[key] || AI_EXPORT_PLANET_META_DEFAULT);
	return {
		showPostnatal: storeDisplay.showPostnatal,
		showHouse: cfg.showHouse,
		showRuler: cfg.showRuler,
	};
}

function normalizeAIExportSettings(settings){
	const normalized = {
		version: 1,
		sections: {},
		planetMeta: {},
		annotations: {},
	};
	if(!settings || typeof settings !== 'object'){
		return normalized;
	}
	const sections = settings.sections && typeof settings.sections === 'object' ? settings.sections : {};
	Object.keys(sections).forEach((key)=>{
		const arr = Array.isArray(sections[key]) ? sections[key] : [];
		normalized.sections[key] = uniqueArray(arr.map((item)=>normalizeSectionTitle(item)).filter(Boolean));
	});
	const planetMeta = settings.planetMeta && typeof settings.planetMeta === 'object' ? settings.planetMeta : {};
	Object.keys(planetMeta).forEach((key)=>{
		if(!supportsPlanetMetaSettingsForTechnique(key)){
			return;
		}
		normalized.planetMeta[key] = normalizeAIExportPlanetMeta(planetMeta[key]);
	});
	const annotations = settings.annotations && typeof settings.annotations === 'object' ? settings.annotations : {};
	Object.keys(annotations).forEach((key)=>{
		if(!supportsAnnotationSettingsForTechnique(key)){
			return;
		}
		normalized.annotations[key] = annotations[key] === 0 || annotations[key] === false ? 0 : 1;
	});
	return normalized;
}

function snapshotModuleKeyByContextKey(key){
	if(key === 'sixyao'){
		return 'guazhan';
	}
	return key;
}

function getTechniqueLabelByKey(key){
	return AI_EXPORT_TECHNIQUE_LABEL_MAP[key] || '当前技术';
}

function isJieQiSplitSettingKey(key){
	return JIEQI_SPLIT_SETTING_KEYS.includes(key);
}

function getCachedContentByKeyWithContext(key, context){
	if(key === 'indiachart'){
		const indiaActive = context ? findIndiaActivePane(context.scopeRoot) : null;
		return getIndiaCachedContent(indiaActive ? indiaActive.label : '');
	}
	return getCachedContentForTechnique(key);
}

function resolveCachedContentByContext(context){
	const fallbackContext = resolveContextByAstroState();
	const candidates = uniqueArray([
		context && context.key ? context.key : '',
		fallbackContext && fallbackContext.key ? fallbackContext.key : '',
	].filter(Boolean));
	for(let i=0; i<candidates.length; i++){
		const key = candidates[i];
		const content = getCachedContentByKeyWithContext(key, context);
		if(content && `${content}`.trim()){
			return {
				key,
				content,
			};
		}
	}
	return {
		key: context && context.key ? context.key : 'generic',
		content: '',
	};
}

async function waitForCachedContentByContext(context, waitMs = 2400){
	let resolved = resolveCachedContentByContext(context);
	if(resolved.content && `${resolved.content}`.trim()){
		return resolved;
	}
	const startedAt = Date.now();
	while((Date.now() - startedAt) < waitMs){
		await sleep(160);
		resolved = resolveCachedContentByContext(context);
		if(resolved.content && `${resolved.content}`.trim()){
			return resolved;
		}
	}
	return resolved;
}

function getJieQiCachedContent(){
	const current = getModuleCachedContent('jieqi_current');
	const whole = getModuleCachedContent('jieqi');
	return [current, whole].filter(Boolean).join('\n\n');
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
	const cachedTitles = extractSectionTitles(getCachedContentForTechnique(key));
	if(isJieQiSplitSettingKey(key)){
		const wanted = new Set(preset.map((item)=>normalizeSectionTitle(item)));
		const filtered = cachedTitles.filter((item)=>wanted.has(normalizeSectionTitle(item)));
		return uniqueArray([...preset, ...filtered]);
	}
	return uniqueArray([...preset, ...cachedTitles]);
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

function applyUserSectionFilter(content, key){
	const settings = loadAIExportSettings();
	const selected = settings.sections[key];
	if(!selected){
		return content;
	}
	const picked = selected.slice(0);
	if(key === 'jinkou'){
		picked.push('金口诀速览');
	}
	const wanted = new Set(uniqueArray(picked.map((item)=>mapLegacySectionTitle(key, item)).filter(Boolean)));
	return filterContentByWantedSections(content, wanted);
}

function mapLegacySectionTitle(key, title){
	const normalized = normalizeSectionTitle(title);
	if(key !== 'tongshefa'){
		return normalized;
	}
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
	return filterContentByWantedSections(content, wanted);
}

function resolvePlanetMetaContextKey(context){
	const key = context && context.key ? context.key : 'generic';
	if(key !== 'jieqi'){
		return key;
	}
	const byScope = detectJieQiSettingKeyByScope(context.scopeRoot);
	return byScope || detectJieQiSettingKeyByCurrentSnapshot() || 'jieqi';
}

function applyPlanetMetaFilterByContext(content, context){
	const settings = loadAIExportSettings();
	const settingKey = resolvePlanetMetaContextKey(context);
	const display = resolveAIExportPlanetMetaForKey(settings, settingKey);
	return filterPlanetMetaSuffix(content, display);
}

function resolveAnnotationFlagForKey(settings, key){
	if(!supportsAnnotationSettingsForTechnique(key)){
		return AI_EXPORT_ANNOTATION_DEFAULT;
	}
	const all = settings && settings.annotations && typeof settings.annotations === 'object'
		? settings.annotations
		: {};
	const raw = all[key];
	return raw === 0 || raw === false ? 0 : 1;
}

function removeAnnotationSection(content){
	const sections = splitContentSections(content);
	if(!sections.length){
		return content;
	}
	const kept = sections.filter((sec)=>normalizeSectionTitle(sec.title) !== normalizeSectionTitle(ASTRO_ANNOTATION_SECTION_TITLE));
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

function applyAnnotationFilterByContext(content, context){
	const settings = loadAIExportSettings();
	if(resolveAnnotationFlagForKey(settings, context.key) === 1){
		return content;
	}
	return removeAnnotationSection(content);
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
	const directNav = Array.from(container.children).find((n)=>{
		return n && n.classList && n.classList.contains('ant-tabs-nav');
	});
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
		if(!isElementVisible(tab)){
			continue;
		}
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
	const tabs = Array.from(root.querySelectorAll('.ant-tabs'));
	for(let i=0; i<tabs.length; i++){
		const tab = tabs[i];
		if(!isElementVisible(tab)){
			continue;
		}
		const names = getTabsNavItems(tab).map((n)=>textOf(n));
		if(names.includes('星盘') && names.includes('易与三式')){
			return tab;
		}
	}
	const tabsLeft = root.querySelector('.ant-tabs-left');
	if(tabsLeft && isElementVisible(tabsLeft)){
		return tabsLeft;
	}
	return tabs.find((tab)=>isElementVisible(tab)) || tabs[0] || null;
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

function resolveContextByAstroState(){
	try{
		const store = getStore();
		const astro = store && store.astro ? store.astro : null;
		if(!astro){
			return null;
		}
		const tab = `${astro.currentTab || ''}`;
		const subTab = `${astro.currentSubTab || ''}`;
		const predictiveMap = {
			primarydirect: '推运盘-主/界限法',
			zodialrelease: '推运盘-黄道星释',
			firdaria: '推运盘-法达星限',
			profection: '推运盘-小限法',
			solararc: '推运盘-太阳弧',
			solarreturn: '推运盘-太阳返照',
			lunarreturn: '推运盘-月亮返照',
			givenyear: '推运盘-流年法',
		};
		if(tab === 'astrochart' || tab === 'astrochart3D'){
			return { key: 'astrochart', domain: null, displayName: '星盘' };
		}
		if(tab === 'direction'){
			const key = predictiveMap[subTab] ? subTab : 'primarydirect';
			return { key, domain: 'predictive_raw', displayName: predictiveMap[key] || '推运盘-主/界限法' };
		}
		if(tab === 'germanytech'){
			return { key: 'germany', domain: null, displayName: '量化盘' };
		}
		if(tab === 'relativechart'){
			return { key: 'relative', domain: null, displayName: '关系盘' };
		}
		if(tab === 'jieqichart'){
			return { key: 'jieqi', domain: null, displayName: '节气盘' };
		}
		if(tab === 'locastro' || tab === 'hellenastro'){
			return { key: 'astrochart_like', domain: null, displayName: tab === 'hellenastro' ? '希腊星术' : '星体地图' };
		}
		if(tab === 'guolao'){
			return { key: 'guolao', domain: null, displayName: '七政四余' };
		}
		if(tab === 'indiachart'){
			return { key: 'indiachart', domain: null, displayName: '印度律盘' };
		}
		if(tab === 'cntradition'){
			if(subTab === 'bazi'){
				return { key: 'bazi', domain: null, displayName: '八字' };
			}
			if(subTab === 'ziwei'){
				return { key: 'ziwei', domain: null, displayName: '紫微斗数' };
			}
			return { key: 'cntradition', domain: null, displayName: '八字紫微' };
		}
		if(tab === 'cnyibu'){
			const map = {
				suzhan: { key: 'suzhan', domain: null, displayName: '宿盘' },
				guazhan: { key: 'sixyao', domain: 'sixyao', displayName: '易卦' },
				liureng: { key: 'liureng', domain: 'liureng', displayName: '大六壬' },
				jinkou: { key: 'jinkou', domain: 'jinkou', displayName: '金口诀' },
				dunjia: { key: 'qimen', domain: 'qimen', displayName: '奇门遁甲' },
				taiyi: { key: 'taiyi', domain: null, displayName: '太乙' },
				tongshefa: { key: 'tongshefa', domain: 'tongshefa', displayName: '统摄法' },
			};
			return map[subTab] || { key: 'cnyibu', domain: null, displayName: '易与三式' };
		}
		if(tab === 'otherbu'){
			return { key: 'otherbu', domain: null, displayName: '西洋游戏' };
		}
		if(tab === 'fengshui'){
			return { key: 'fengshui', domain: null, displayName: '风水' };
		}
		if(tab === 'sanshiunited'){
			return { key: 'sanshiunited', domain: 'sanshiunited', displayName: '三式合一' };
		}
		return null;
	}catch(e){
		return null;
	}
}

function withStoreContextFallback(context){
	const storeContext = resolveContextByAstroState();
	if(!storeContext){
		return context;
	}
	if(context && context.key && context.key !== 'generic'){
		return context;
	}
	return {
		...(context || {}),
		key: storeContext.key || (context ? context.key : 'generic'),
		domain: storeContext.domain !== undefined ? storeContext.domain : (context ? context.domain : null),
		displayName: storeContext.displayName || (context ? context.displayName : '当前技术'),
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
		{ label: '黄道星释', key: 'zodialrelease', name: '推运盘-黄道星释' },
		{ label: '法达星限', key: 'firdaria', name: '推运盘-法达星限' },
		{ label: '小限法', key: 'profection', name: '推运盘-小限法' },
		{ label: '太阳弧', key: 'solararc', name: '推运盘-太阳弧' },
		{ label: '太阳返照', key: 'solarreturn', name: '推运盘-太阳返照' },
		{ label: '月亮返照', key: 'lunarreturn', name: '推运盘-月亮返照' },
		{ label: '流年法', key: 'givenyear', name: '推运盘-流年法' },
	];
	const predictiveByTop = predictiveLabelMap.find((item)=>topLabel && topLabel.includes(item.label));
	if(predictiveByTop){
		context.key = predictiveByTop.key;
		context.domain = 'predictive_raw';
		context.displayName = predictiveByTop.name;
		return context;
	}

	if(topLabel.includes('推运盘')){
		const subTabs = findTabsContainerByLabels(topPane, ['主/界限法', '黄道星释', '法达星限', '小限法', '太阳弧', '太阳返照', '月亮返照', '流年法'], false);
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
		context.key = 'astrochart';
		context.displayName = subLabel ? `推运盘-${subLabel}` : '推运盘';
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
		const subTabs = findTabsContainerByLabels(topPane, ['宿盘', '易卦', '六壬', '金口诀'], true);
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
		const subTabs = findTabsContainerByLabels(topPane, ['八字', '紫微斗数'], false);
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
	return AI_EXPORT_TECHNIQUES.map((item)=>{
		return {
			key: item.key,
			label: item.label,
			options: getOptionsForTechniqueKey(item.key),
			supportsPlanetMeta: supportsPlanetMetaSettingsForTechnique(item.key),
			supportsAnnotation: supportsAnnotationSettingsForTechnique(item.key),
		};
	});
}

async function captureTabsContentByLabels(scopeRoot, labels){
	const container = findTabsContainerByLabels(scopeRoot, labels, true);
	if(!container){
		return null;
	}

	const tabNodes = getTabsNavItems(container);
	if(tabNodes.length === 0){
		return null;
	}

	const activeBefore = textOf(tabNodes.find((n)=>n.classList.contains('ant-tabs-tab-active')));
	const out = {};

	for(let i=0; i<labels.length; i++){
		const label = labels[i];
		const node = tabNodes.find((n)=>textOf(n).includes(label));
		if(!node){
			continue;
		}
		const clickNode = node.querySelector('.ant-tabs-tab-btn') || node;
		clickNode.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		await sleep(120);
		const pane = getDirectActivePane(container);
		out[label] = normalizeWhitespace(textOf(pane));
	}

	if(activeBefore){
		const restore = tabNodes.find((n)=>textOf(n).includes(activeBefore));
		if(restore){
			const clickNode = restore.querySelector('.ant-tabs-tab-btn') || restore;
			clickNode.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			await sleep(60);
		}
	}

	return out;
}

function getSummaryLines(scopeRoot, keywords){
	const lines = normalizeWhitespace(textOf(scopeRoot))
		.split('\n')
		.map((s)=>s.trim())
		.filter(Boolean);
	const all = uniqueArray(lines);

	const dtRegex = /\d{4}[-\/]\d{1,2}[-\/]\d{1,2}\s+\d{1,2}:\d{2}:\d{2}/;
	const picked = [];
	all.forEach((line)=>{
		if(/^(经纬度选择|打印星盘|确定|此刻|回归黄道|整宫制)$/.test(line)){
			return;
		}
		if(dtRegex.test(line)){
			picked.push(line);
			return;
		}
		if(keywords.some((k)=>line.includes(k))){
			picked.push(line);
		}
	});
	const unique = uniqueArray(picked);
	return unique.filter((line, idx)=>{
		return !unique.some((other, j)=>{
			if(j === idx){
				return false;
			}
			return other.length > line.length && other.includes(line);
		});
	});
}

function extractRightColumnText(scopeRoot){
	if(!scopeRoot){
		return '';
	}
	const cols = Array.from(scopeRoot.querySelectorAll('.ant-col-8'));
	if(cols.length === 0){
		return '';
	}
	let best = '';
	cols.forEach((col)=>{
		const t = normalizeWhitespace(textOf(col));
		if(t.length > best.length){
			best = t;
		}
	});
	return best;
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
			return '';
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
	}catch(e){
		return '';
	}
	return '';
}

function getModuleCachedContent(moduleName){
	if(!moduleName){
		return '';
	}
	const alias = MODULE_SNAPSHOT_ALIASES[moduleName] || [];
	const keys = uniqueArray([moduleName, ...alias].filter(Boolean));
	for(let i=0; i<keys.length; i++){
		const snapshot = loadModuleAISnapshot(keys[i]);
		if(snapshot && snapshot.content){
			return snapshot.content;
		}
	}
	return '';
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
	const key = context && context.key ? context.key : '';
	const topLabel = context && context.topLabel ? context.topLabel : '';
	const isIndia = key === 'indiachart' || topLabel.includes('印度律盘');
	if(isIndia){
		return getIndiaCachedContent('');
	}
	return getAstroCachedContent();
}

async function extractSixYaoContent(context){
	return getModuleCachedContent('guazhan') || '';
}

async function extractLiuRengContent(context){
	return getModuleCachedContent('liureng') || '';
}

async function extractJinKouContent(context){
	return getModuleCachedContent('jinkou') || '';
}

async function extractQiMenContent(context){
	return getModuleCachedContent('qimen') || '';
}

async function extractSanShiUnitedContent(context){
	return getModuleCachedContent('sanshiunited') || '';
}

async function extractTongSheFaContent(context){
	return getModuleCachedContent('tongshefa') || '';
}

async function extractTaiYiContent(context){
	return getModuleCachedContent('taiyi') || '';
}

async function extractGermanyContent(context){
	return getModuleCachedContent('germany') || '';
}

async function extractJieQiContent(context){
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
	const cached = getModuleCachedContent('primarydirect');
	if(cached){
		return cached;
	}
	return '';
}

async function extractZodialReleaseContent(context){
	const cached = getModuleCachedContent('zodialrelease');
	if(cached){
		return cached;
	}
	return '';
}

async function extractFirdariaContent(context){
	const cached = getModuleCachedContent('firdaria');
	if(cached){
		return cached;
	}
	return '';
}

async function extractProfectionContent(context){
	const cached = getModuleCachedContent('profection');
	if(cached){
		return cached;
	}
	return '';
}

async function extractSolarArcContent(context){
	const cached = getModuleCachedContent('solararc');
	if(cached){
		return cached;
	}
	return '';
}

async function extractSolarReturnContent(context){
	const cached = getModuleCachedContent('solarreturn');
	if(cached){
		return cached;
	}
	return '';
}

async function extractLunarReturnContent(context){
	const cached = getModuleCachedContent('lunarreturn');
	if(cached){
		return cached;
	}
	return '';
}

async function extractGivenYearContent(context){
	const cached = getModuleCachedContent('givenyear');
	if(cached){
		return cached;
	}
	return '';
}

async function extractRelativeContent(context){
	return getModuleCachedContent('relative') || '';
}

async function extractOtherBuContent(context){
	return getModuleCachedContent('otherbu') || '';
}

async function extractFengShuiContent(context){
	return getModuleCachedContent('fengshui') || '';
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
	output = replaceFontEncodedTokens(output);
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
		output = output.replace(/([0-9˚分秒]+)\s*R\b/g, '$1 逆行');
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
	if(domain === 'predictive_raw'){
		return output.trim();
	}
	output = beautifyForAI(output);
	return output.trim();
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
		await navigator.clipboard.writeText(text);
		return true;
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

async function buildPayload(){
	const context = withStoreContextFallback(resolveActiveContext());
	const now = new Date();
	let resolved = await waitForCachedContentByContext(context);
	let exportKey = resolved.key || context.key || 'generic';
	if((!resolved.content || !`${resolved.content}`.trim()) && context && context.key && context.key !== 'generic'){
		resolved = await waitForCachedContentByContext({
			...context,
			key: context.key,
		});
		exportKey = resolved.key || context.key || exportKey;
	}
	const exportContext = {
		...context,
		key: exportKey,
		displayName: context.displayName || getTechniqueLabelByKey(exportKey),
	};
	let content = resolved.content || '';
	content = applyUserSectionFilterByContext(content, exportKey);
	content = applyPlanetMetaFilterByContext(content, exportContext);
	content = applyAnnotationFilterByContext(content, exportContext);
	content = normalizeText(content, exportContext.domain);
	const stamp = formatStamp(now);
	const time = formatDateTime(now);
	const filenameBase = `horosa_${safeFileName(exportContext.displayName)}_${stamp}`;
	const header = [
		`技术: ${exportContext.displayName}`,
		`导出时间: ${time}`,
		`页面: ${window.location.href}`,
		'说明: 当前激活技术面板专属导出；符号已转为AI可识别文本。',
		'',
		'========== 内容开始 =========='
	].join('\n');
	const text = `${header}\n${content}\n========== 内容结束 ==========`;

	return {
		tech: exportContext.displayName,
		content,
		text,
		filenameBase,
	};
}

export async function runAIExport(action){
	const payload = await buildPayload();
	const pure = (payload.content || '').replace(/\s/g, '');
	if(!pure){
		return { ok: false, message: '当前页面暂无可导出的排盘快照，请先完成起盘。' };
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
}
