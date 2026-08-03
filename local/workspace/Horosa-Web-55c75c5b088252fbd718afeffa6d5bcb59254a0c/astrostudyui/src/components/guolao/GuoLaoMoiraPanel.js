import { memo, useState } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { XQTabs as Tabs } from '../xq-ui';
import { FreezeSubTab } from '../comp/FreezeInactive';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { moiraMergeStellarRelationRows as mergeStellarRelationRows, moiraBuildLimitTable as buildLimitTable, moiraCurrentLimitIndex as currentLimitIndex, MOIRA_PLANET_DEFS, } from './GuoLaoMoiraWheel';
import { calcAzimuthLocal } from '../commtools/Azimuth';
import { convertLatStrToDegree, convertLonStrToDegree } from '../astro/AstroHelper';
import { shanAtDeg } from '../fengshui/liqiCore';
import { LIFE_HELPER_LABELS, lifeHelperRow, weakSolidPillars, smallLimitBranch, flyLimitBranches, limitDegreeSpan, childAgeLimitYears, childYearsSpan, childLimitBranch, monthLimitBranch, lunarMonthNumFromBranch, branchElementOf, SU_ELEMENT } from './guolaoMoiraTables';
import { GUOLAO_STAR_NOTES } from './guolaoStarNotes';
import { PALACE_LORD as GL_PALACE_LORD, SU28 as GL_SU28, SU28_DEGREE_LORD as GL_SU28_LORD, HUAYAO_A as GL_HUAYAO_A, EXALT_DEGREE as GL_EXALT, DIGNITY_TABLE as GL_DIGNITY, SIGN_STATUS_SEQ, starDignityStatuses as glStarDignity, starMotionState as glStarMotion, starCombust as glStarCombust } from './guolaoData';
import { computeDongwei as glDongwei, computeXiaoxian as glXiaoxian, computeTongxian as glTongxian, computeYuexian as glYuexian } from './guolaoTransit';
import './GuoLaoMoiraPanel.less';

// [horosa_guolao_render_slice_v1] 一次性惰性求值器(照 UranianDialMain horosa_lazy_right_panels_v1
// 范式):每次 render 新建实例 → 值恒新鲜;未激活 tab 的 thunk 不被 FreezeSubTab 调用 → 整段不算;
// 同一次 render 内多处引用只算一次。
function lazyOnce(fn){
	let value;
	let done = false;
	return ()=>{
		if(!done){
			value = fn();
			done = true;
		}
		return value;
	};
}

// 三主(命主/身主/度主)+ 命宫配干(五虎遁)+ 生年化曜:纯前端从命/身宫地支 + 命度宿 + 年干派生(古法立成)。
const GL_GAN = '甲乙丙丁戊己庚辛壬癸';
const GL_ZHI = '子丑寅卯辰巳午未申酉戌亥';
function glZiChar(zi){ const s = String(zi || ''); for(let i = 0; i < s.length; i++){ if(GL_ZHI.indexOf(s[i]) >= 0){ return s[i]; } } return ''; }
export function deriveGuolaoMasters(life, self, lifeSuName, yearStem, lifeMasterMode){
	const lz = glZiChar(life && life.zi);
	const sz = glZiChar(self && self.zi);
	const lmMode = (lifeMasterMode === 'du' || lifeMasterMode === 'dudegrade') ? lifeMasterMode : 'gong';
	const out = { mingPalaceZi: lz, bodyPalaceZi: sz, lifeMaster: '', bodyMaster: '', degMaster: '', mingStem: '', huayao: '', lifeMasterMode: lmMode, lifeMasterStar: '' };
	if(lz && GL_PALACE_LORD[lz]){ out.lifeMaster = GL_PALACE_LORD[lz][1]; }
	if(sz && GL_PALACE_LORD[sz]){ out.bodyMaster = GL_PALACE_LORD[sz][1]; }
	if(lifeSuName){ const i = GL_SU28.indexOf(glSuChar(lifeSuName)); if(i >= 0){ out.degMaster = GL_SU28_LORD[i]; } }
	const gi = GL_GAN.indexOf(yearStem || '');
	if(gi >= 0 && lz){ const yin = (gi * 2 + 2) % 10; const bi = GL_ZHI.indexOf(lz); out.mingStem = GL_GAN[(yin + (bi - 2 + 12) % 12) % 10]; }
	out.huayao = GL_HUAYAO_A[yearStem || ''] || '';
	// G22/G23 命主取法:gong=命宫宫主(默认)/du=命度度主/dudegrade=贬宫主专度主(果老)。两主始终都显于三主表。
	out.lifeMasterStar = ((out.lifeMasterMode === 'du' || out.lifeMasterMode === 'dudegrade') && out.degMaster) ? out.degMaster : out.lifeMaster;
	return out;
}
function glSuChar(name){ const s = String(name || ''); for(let i = 0; i < s.length; i++){ if(GL_SU28.indexOf(s[i]) >= 0){ return s[i]; } } return ''; }

const PLANET_ORDER = [
	{ id: AstroConst.SUN, name: '日' },
	{ id: AstroConst.MOON, name: '月' },
	{ id: AstroConst.VENUS, name: '金' },
	{ id: AstroConst.JUPITER, name: '木' },
	{ id: AstroConst.MERCURY, name: '水' },
	{ id: AstroConst.MARS, name: '火' },
	{ id: AstroConst.SATURN, name: '土' },
	{ id: AstroConst.SOUTH_NODE, name: '计' },
	{ id: AstroConst.NORTH_NODE, name: '罗' },
	{ id: AstroConst.PURPLE_CLOUDS, name: '炁' },
	{ id: AstroConst.DARKMOON, name: '孛' },
	{ id: AstroConst.URANUS, name: '天' },
	{ id: AstroConst.NEPTUNE, name: '海' },
	{ id: AstroConst.PLUTO, name: '冥' },
];
// 升顶(Asc/MC)角点:仅进「星点动态」表(位置/无庙旺/无自行),不入星曜庙旺列。
const ANGLE_ORDER = [
	{ id: AstroConst.ASC, name: '升' },
	{ id: AstroConst.MC, name: '顶' },
];

const STEM_BRANCHES = ['甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉', '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未', '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳', '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯', '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑', '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥'];

// G6 报时星(时星):chart.timerStar 给七政英文 id(随报时星太阳时档变);映射中文显示。
const PLANET_CN_BY_ID = (function(){ const m = {}; PLANET_ORDER.forEach((d)=>{ m[d.id] = d.name; }); return m; })();
function timerStarName(id){
	const s = id ? (PLANET_CN_BY_ID[id] || msg(id) || `${id}`) : '';
	const full = { 日: '太阳', 月: '太阴', 金: '金星', 木: '木星', 水: '水星', 火: '火星', 土: '土星' }[s] || s;
	return full;
}
const YEAR_STAR_BY_STEM = {
	甲: '火',
	乙: '孛',
	丙: '木',
	丁: '金',
	戊: '土',
	己: '月',
	庚: '水',
	辛: '炁',
	壬: '计',
	癸: '罗',
};
const YEAR_INFO_GROUPS = [
	['天禄', '科名', '天马', '生官'],
	['天暗', '科甲', '地驿'],
	['天福', '文星', '禄元'],
	['天耗', '魁星', '马元', '值难'],
	['天荫', '官星', '天元', '职元'],
	['天贵', '印星', '地元', '局主'],
	['天嗣', '寿元', '人元', '天经'],
	['天刑', '催官', '仁元', '地纬'],
	['天印', '禄神', '血支'],
	['天囚', '喜神', '血忌'],
	['天权', '爵星', '产星', '伤官'],
];
const TEN_GOD_ORG = ['天禄', '天暗', '天福', '天耗', '天荫', '天贵', '天嗣', '天刑', '天印', '天囚', '天权'];
const TEN_GOD_ALT = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];
const SPEED_LIMITS = {
	Venus: { slow: 0.71, fast: 1.245 },
	Jupiter: { slow: 0.05, fast: 0.23 },
	Mercury: { slow: 0.88, fast: 1.50 },
	Mars: { slow: 0.4, fast: 0.70 },
	Saturn: { slow: 0.02, fast: 0.13 },
};

function safeList(val){
	return val && val.length ? val : [];
}

function safeMap(val){
	return val && typeof val === 'object' ? val : {};
}

function joinYearItems(items){
	return safeList(items).map((item)=>{
		if(item && typeof item === 'object'){
			return [item.name, item.star ? `化${item.star}` : ''].filter(Boolean).join(' ');
		}
		return `${item || ''}`;
	}).filter(Boolean).join('、');
}

function hasUnverifiedMoiraPatternSource(value){
	return value && (
		value.styleSource === 'moira-dsl-not-evaluated'
		|| value.engine === 'moira-rules-on-horosa-ephemeris'
		|| value.version === 'qizheng-moira-rules-v1'
	);
}

function mergeDefined(){
	const res = {};
	for(let i=0; i<arguments.length; i++){
		const obj = safeMap(arguments[i]);
		Object.keys(obj).forEach((key)=>{
			if(obj[key] !== undefined && obj[key] !== null && obj[key] !== ''){
				res[key] = obj[key];
			}
		});
	}
	return res;
}

function levelText(level){
	if(level === 'good'){
		return '吉';
	}
	if(level === 'bad'){
		return '忌';
	}
	if(level === 'notice'){
		return '察';
	}
	return '平';
}

function joinNames(list){
	const arr = safeList(list).map(formatGodName).filter(Boolean);
	return arr.length ? arr.join('、') : '无';
}

function formatGodName(name){
	let val = `${name || ''}`.replace(/\s+/g, '');
	if(!val){
		return '';
	}
	val = val.split(/[\/／]/)[0];
	const aliases = {
		天乙贵人: '天贵',
		玉堂贵人: '玉贵',
	};
	return aliases[val] || val;
}

function msg(id){
	if(id === undefined || id === null){
		return '';
	}
	return AstroText.AstroMsgCN[id] || AstroText.AstroTxtMsg[id] || AstroText.AstroMsg[id] || `${id}`;
}

function norm(deg){
	let val = Number(deg);
	if(!Number.isFinite(val)){
		return 0;
	}
	val %= 360;
	if(val < 0){
		val += 360;
	}
	return val;
}

// 黄仪/赤仪显示口径(chart.displayCoord 单一真值源;旧数据回退恒星制旧判据)。
function isEclipticDisplay(chart){
	const coord = chart && chart.displayCoord;
	if(coord === 'ecliptic'){ return true; }
	if(coord === 'equatorial'){ return false; }
	const params = chart && chart.params ? chart.params : {};
	return Number(params.doubingSu28) === 4 || Number(params.guolaoZhengSidereal) === 1;
}

function objectLon(obj, preferLon = false){
	const num = Number(obj && (preferLon && obj.lon !== undefined ? obj.lon : (obj.ra !== undefined ? obj.ra : obj.lon)));
	if(Number.isFinite(num)){
		return norm(num);
	}
	const sign = obj && obj.sign ? AstroConst.LIST_SIGNS.indexOf(obj.sign) : -1;
	const signlon = Number(obj && obj.signlon);
	if(sign >= 0 && Number.isFinite(signlon)){
		return norm(sign * 30 + signlon);
	}
	return null;
}

function degreeText(lon){
	const val = norm(lon);
	const deg = Math.floor(val % 30);
	const min = Math.floor(((val % 30) - deg) * 60);
	return `${deg}度${min}分`;
}

function suDegreeText(lon){
	const val = norm(lon);
	const deg = Math.floor(val);
	const min = Math.floor((val - deg) * 60);
	return `${deg}度${min}分`;
}

function signNameFromLon(lon){
	const idx = Math.floor(norm(lon) / 30) % 12;
	return msg(AstroConst.LIST_SIGNS[idx]);
}

function ziFromLon(lon){
	// 七政「宫位序↔地支」镜像:支 = (10 − 宫序 + 12) % 12(白羊=戌、巨蟹=未、水瓶=子)。
	// 旧版把宫序直接当支序(巨蟹→卯),致「位置」列地支与盘面严重错位——已纠正。
	const list = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
	const signIdx = Math.floor(norm(lon) / 30) % 12;
	return list[(10 - signIdx + 12) % 12] || '';
}

function anchorFromObject(chart, id, fallbackId, label){
	const obj = findObject(chart, id) || findObject(chart, fallbackId);
	const lon = objectLon(obj, isEclipticDisplay(chart));
	if(!obj || lon === null){
		return {};
	}
	return {
		longitude: lon,
		signName: signNameFromLon(lon),
		degreeText: degreeText(lon),
		zi: ziFromLon(lon),
		area: msg(obj.id) || label,
		moiraHouse: msg(obj.house) || '',
	};
}

function suHostForLon(chart, lon){
	const val = Number(lon);
	const stars = safeList(chart && chart.fixedStarSu28).map((item)=>({
		name: item.name || item.label || '',
		ra: Number(item.ra),
	})).filter((item)=>item.name && Number.isFinite(item.ra)).sort((a, b)=>a.ra - b.ra);
	if(!stars.length || !Number.isFinite(val)){
		return null;
	}
	const degree = norm(val);
	let star = stars[stars.length - 1];
	for(let i = 0; i < stars.length; i++){
		if(stars[i].ra <= degree){
			star = stars[i];
		}else {
			break;
		}
	}
	const offset = norm(degree - star.ra);
	return {
		name: star.name,
		offset,
		degreeText: suDegreeText(offset),
		value: `${star.name} ${suDegreeText(offset)}`,
	};
}

function compactDegreeText(lon){
	const val = norm(lon);
	const deg = `${Math.floor(val % 30)}`.padStart(2, '0');
	const min = `${Math.floor(((val % 30) - Math.floor(val % 30)) * 60)}`.padStart(2, '0');
	return `${deg}.${min}`;
}

function stemBranchForYear(year){
	const idx = ((Number(year) - 1984) % 60 + 60) % 60;
	return STEM_BRANCHES[idx] || '';
}

function yearFromParams(params){
	const raw = params && params.date ? `${params.date}` : '';
	const match = raw.match(/-?\d{3,4}/);
	return match ? Number(match[0]) : new Date().getFullYear();
}

function dateTextFromParams(params){
	return `${params.date || ''} ${params.time || ''}`.trim();
}

function pickDeep(root, keys){
	const stack = [root];
	const visited = new Set();
	while(stack.length){
		const cur = stack.shift();
		if(!cur || typeof cur !== 'object' || visited.has(cur)){
			continue;
		}
		visited.add(cur);
		for(const key of Object.keys(cur)){
			if(keys.includes(key) && cur[key] !== undefined && cur[key] !== null && cur[key] !== ''){
				return cur[key];
			}
			if(cur[key] && typeof cur[key] === 'object'){
				stack.push(cur[key]);
			}
		}
	}
	return '';
}

function getBazi(root){
	const chart = root && root.chart ? root.chart : {};
	return (chart.nongli && chart.nongli.bazi) || (root && root.nongli && root.nongli.bazi) || {};
}

function textFromBaziPole(value){
	if(value === undefined || value === null || value === ''){
		return '';
	}
	if(typeof value === 'string' || typeof value === 'number'){
		return `${value}`;
	}
	if(typeof value !== 'object'){
		return '';
	}
	const direct = value.text || value.name || value.value || value.ganzi || value.ganZi || value.pillar || value.column;
	if(direct){
		return `${direct}`;
	}
	const stem = safeMap(value.stem);
	const branch = safeMap(value.branch);
	const stemText = stem.cell || stem.text || stem.name || stem.value || value.gan || value.stemText || value.tianGan || '';
	const branchText = branch.cell || branch.text || branch.name || branch.value || value.zhi || value.branchText || value.diZhi || '';
	return `${stemText || ''}${branchText || ''}`;
}

function readBaziPole(bazi, key){
	const data = safeMap(bazi);
	const fourColumns = safeMap(data.fourColumns || data.fourcolumns || data.fourPillars || data.pillars);
	const fourZhuMap = safeMap(fourColumns.fourZhuMap || data.fourZhuMap);
	const zhKeys = {
		year: '年',
		month: '月',
		day: '日',
		time: '时',
	};
	const candidates = [
		data[key],
		fourColumns[key],
		data[`${key}Pole`],
		fourColumns[`${key}Pole`],
		data[`${key}Pillar`],
		fourColumns[`${key}Pillar`],
		data[`${key}Column`],
		fourColumns[`${key}Column`],
		data[`${key}Ganzi`],
		fourColumns[`${key}Ganzi`],
		zhKeys[key] ? fourZhuMap[zhKeys[key]] : '',
	];
	for(const item of candidates){
		const text = textFromBaziPole(item).trim();
		if(text){
			return text;
		}
	}
	return '';
}

function lunarText(root){
	const chart = root && root.chart ? root.chart : {};
	const nongli = chart.nongli || root.nongli || {};
	return nongli.text || nongli.nongli || nongli.lunar || nongli.lunarText || '';
}

function baziStemBranch(root, key, fallbackYear){
	const bazi = getBazi(root);
	const pole = readBaziPole(bazi, key);
	if(pole){
		return pole;
	}
	if(key === 'year'){
		return stemBranchForYear(fallbackYear);
	}
	return '';
}

function baziText(root){
	const bazi = getBazi(root);
	const direct = bazi.text || bazi.name || bazi.fourColumnsText || bazi.fourPillarsText;
	if(direct){
		return direct;
	}
	return ['year', 'month', 'day', 'time'].map((key)=>readBaziPole(bazi, key)).filter(Boolean).join(' ');
}

function findObject(chart, id){
	const objects = chart && chart.objects ? chart.objects : [];
	return objects.find((obj)=>obj.id === id);
}

function planetStatus(obj){
	const speed = Number(obj && obj.lonspeed);
	if(!Number.isFinite(speed)){
		return '顺';
	}
	if(speed < -0.000001){
		return '逆';
	}
	if(Math.abs(speed) < 0.002){
		return '留';
	}
	const limit = SPEED_LIMITS[obj.id];
	if(limit){
		const abs = Math.abs(speed);
		if(abs < limit.slow){
			return '迟';
		}
		if(abs > limit.fast){
			return '速';
		}
	}
	return '顺';
}

// 伏(焦伤):偕日相 combust/cazimi 或与太阳黄经差 <8°(§4.5)。仅日月五星之 月五星判;太阳本身与四余(罗计孛炁=虚星)不判。
const COMBUST_ELIGIBLE = new Set([AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, AstroConst.MARS, AstroConst.JUPITER, AstroConst.SATURN]);
// 西占 8° 焦伤判定(与 Moira 3°「伏」分治:后者单一真值在 guolaoData.starCombust)。
// 本函数现仅供导出契约/测试消费,生产渲染一律走 motionState(glStarMotion+glStarCombust)。
export function isCombustObj(obj, lon, sunLon, id){
	if(!obj || !COMBUST_ELIGIBLE.has(id)){ return false; }
	if(obj.phase === 'combust' || obj.phase === 'cazimi'){ return true; }
	const l = Number(lon), s = Number(sunLon);
	if(!Number.isFinite(l) || !Number.isFinite(s)){ return false; }
	let d = Math.abs(l - s) % 360;
	if(d > 180){ d = 360 - d; }
	return d < 8;
}

// G25 擢升度数:七政在擢升本座时标峰值度,距峰≤1°标「精擢」(EXALT_DEGREE 派生自 PALACE_LORD)。
function exaltText(name, lon){
	const e = GL_EXALT[name];
	if(!e || !Number.isFinite(lon)){ return ''; }
	const v = norm(lon);
	if(Math.floor(v / 30) % 12 !== e.signIndex){ return ''; }
	const dist = Math.abs((v % 30) - e.deg);
	return dist <= 1 ? `精擢${e.deg}°` : `擢${e.deg}°`;
}

// (旧 GL_MOTION_SPEC/motionText 已删:与 Moira 单源 guolaoData.STAR_SPEED_SPEC 五项漂移的
//  第二份同型实现,且其产出的 motion/combust 字段无任何生产消费者——渲染只读 motionState。)

// Moira 庙旺殿喜口径(与后端 dignity() 同表同序):入垣(宫主)/升殿(擢升)/失垣(对宫)/落陷。
// 七政专判,四余/交点为虚星不判;本命行后端 rule.dignity 已给,流年行 rule 为空由此表补算,前后端单一口径。
const MOIRA_SIGN_DIGNITY = [
	[AstroConst.MARS, AstroConst.SUN, AstroConst.VENUS, AstroConst.SATURN],
	[AstroConst.VENUS, AstroConst.MOON, AstroConst.MARS, null],
	[AstroConst.MERCURY, null, AstroConst.JUPITER, null],
	[AstroConst.MOON, AstroConst.JUPITER, AstroConst.SATURN, null],
	[AstroConst.SUN, null, AstroConst.SATURN, null],
	[AstroConst.MERCURY, AstroConst.MERCURY, AstroConst.JUPITER, AstroConst.VENUS],
	[AstroConst.VENUS, AstroConst.SATURN, AstroConst.MARS, AstroConst.SUN],
	[AstroConst.MARS, null, AstroConst.VENUS, AstroConst.MOON],
	[AstroConst.JUPITER, null, AstroConst.MERCURY, null],
	[AstroConst.SATURN, AstroConst.MARS, AstroConst.MOON, AstroConst.JUPITER],
	[AstroConst.SATURN, null, AstroConst.SUN, null],
	[AstroConst.JUPITER, AstroConst.VENUS, AstroConst.MERCURY, AstroConst.MERCURY],
];
const MOIRA_DIGNITY_WORDS = ['入垣', '升殿', '失垣', '落陷'];
function moiraDignityOf(id, lon){
	if(!Number.isFinite(lon)){ return ''; }
	const row = MOIRA_SIGN_DIGNITY[Math.floor(norm(lon) / 30) % 12] || [];
	for(let i = 0; i < 4; i++){
		if(row[i] && row[i] === id){ return MOIRA_DIGNITY_WORDS[i]; }
	}
	return '';
}

// 庙旺(从 DIGNITY_TABLE 派生,单一真值源):七政按地支宫取庙/旺/落/陷/平。本命+流年一致(不依赖后端 rule.dignity)。
// DIGNITY_TABLE 行=日月水金火木土,列=子..亥;地支(子base)=(10-黄道宫序+12)%12(戌=白羊)。
function dignityFromTable(name, lon){
	const row = GL_DIGNITY[name];
	if(!row || !Number.isFinite(lon)){ return ''; }
	const signIdx = Math.floor(norm(lon) / 30) % 12;
	const ziCol = ((10 - signIdx) % 12 + 12) % 12;
	return row[ziCol] || '';
}


function buildPlanetRows(chart, rulePlanets){
	const byRule = new Map(safeList(rulePlanets).map((item)=>[item.id, item]));
	const sunLon = objectLon(findObject(chart, AstroConst.SUN), isEclipticDisplay(chart));
	return PLANET_ORDER.map((def)=>{
		const obj = findObject(chart, def.id);
		const lon = objectLon(obj, isEclipticDisplay(chart));
		if(!obj || lon === null){
			return null;
		}
		const rule = byRule.get(def.id) || {};
		// Moira 庙旺所属(殿垣庙旺乐喜怒):按古法地支查表 + 躔擢升度峰值加「殿」;天海冥无表项 → []。
		const _zhi = ziFromLon(lon);
		const _ex = GL_EXALT[def.name];
		const _atPeak = !!(_ex && Math.floor(norm(lon) / 30) % 12 === _ex.signIndex && Math.abs((norm(lon) % 30) - _ex.deg) <= 1);
		return {
			id: def.id,
			name: def.name,
			signName: rule.signName || msg(obj.sign),
			degreeText: rule.degreeText || degreeText(lon),
			compactDegree: compactDegreeText(lon),
			su28: obj.su28 || rule.su28 || '',
			// 「宫/宿度」列宿内度(Moira 07井木47 式):按 fixedStarSu28 真距星宿界;无宿界数据回退宿名+宫内度。
			suDegText: (function(){
				const host = suHostForLon(chart, lon);
				if(!host || !host.name || !Number.isFinite(host.offset)){ return ''; }
				const d = Math.floor(host.offset);
				const m = Math.floor((host.offset - d) * 60);
				return `${String(d).padStart(2, '0')}${host.name}${SU_ELEMENT[host.name] || ''}${String(m).padStart(2, '0')}`;
			})(),
			house: rule.moiraHouse || msg(obj.house) || '',
			dignity: rule.dignity || '',
			lon,
			// 「位置」列(用户钦定格式):宫内度2位 + 所在地支 + 分2位,如 01午50
			signDegreeText: (function(){
				const inSign = norm(lon) % 30;
				const dd = Math.floor(inSign);
				const mm = Math.floor((inSign - dd) * 60);
				return `${String(dd).padStart(2, '0')}${ziFromLon(lon)}${String(mm).padStart(2, '0')}`;
			})(),
			dignityMoira: (rule.dignity && rule.dignity !== '平') ? rule.dignity : moiraDignityOf(def.id, lon), // Moira 口径(本命=后端,流年=同表前端补算)
			dignityTable: dignityFromTable(def.name, lon),     // 庙旺(单一真值源 DIGNITY_TABLE,本命+流年一致)
			exalt: exaltText(def.name, lon),                   // G25 擢升度数(旺度峰值)
			status: planetStatus(obj),
			speed: Number(obj.lonspeed),
			zhi: _zhi,
			signStatus: glStarDignity(def.name, _zhi, _atPeak),                       // Moira 庙旺所属(殿垣庙旺乐喜怒)
			// Moira 速度态(顺逆留伏迟速):伏用 Moira 合日 3°(glStarCombust,与 AI 快照同源),非 isCombustObj 的 8° 焦伤。
			motionState: glStarMotion(def.name, Number(obj.lonspeed), glStarCombust(def.name, lon, sunLon)),
		};
	}).filter(Boolean);
}

// 升顶(Asc/MC)角点行:仅位置(宫/宿度/位置);无庙旺、无自行 —— 仅供「星点动态」表尾追加。
function buildAngleRows(chart){
	if(!chart){ return []; }
	const ecl = isEclipticDisplay(chart);
	return ANGLE_ORDER.map((def)=>{
		const obj = findObject(chart, def.id);
		const lon = objectLon(obj, ecl);
		if(!obj || lon === null){ return null; }
		const host = suHostForLon(chart, lon);
		const suDegText = (host && host.name && Number.isFinite(host.offset))
			? `${String(Math.floor(host.offset)).padStart(2, '0')}${host.name}${SU_ELEMENT[host.name] || ''}${String(Math.floor((host.offset - Math.floor(host.offset)) * 60)).padStart(2, '0')}`
			: '';
		const inSign = norm(lon) % 30;
		const signDegreeText = `${String(Math.floor(inSign)).padStart(2, '0')}${ziFromLon(lon)}${String(Math.floor((inSign - Math.floor(inSign)) * 60)).padStart(2, '0')}`;
		return {
			id: def.id,
			name: def.name,
			house: msg(obj.house) || '',
			signName: msg(obj.sign) || '',
			su28: obj.su28 || '',
			compactDegree: compactDegreeText(lon),
			suDegText,
			signDegreeText,
			lon,
			signStatus: [],
			motionState: '',
			isAngle: true,
		};
	}).filter(Boolean);
}

function yearInfoRows(title, stemBranch){
	const stem = stemBranch ? stemBranch.slice(0, 1) : '';
	return YEAR_INFO_GROUPS.map((items, idx)=>({
		title: idx === 0 ? title : '',
		main: items[0],
		items,
		yearStar: idx === 0 ? (YEAR_STAR_BY_STEM[stem] || '') : '',
	}));
}

function Section({title, children}){
	return (
		<div className="horosa-guolao-moira-section">
			<div className="horosa-guolao-moira-section-title">{title}</div>
			{children}
		</div>
	);
}

function KeyValueGrid({items}){
	return (
		<div className="horosa-guolao-moira-kv-grid">
			{items.filter((item)=>item && item.value !== undefined && item.value !== '').map((item)=>(
				<div className="horosa-guolao-moira-kv" key={item.label}>
					<span>{item.label}</span>
					<strong>{item.value}</strong>
				</div>
			))}
		</div>
	);
}

// 地平方位表(对照 Moira pref_show_horiz「显示地平方位」):每曜 罗盘方位角/真高度/所临山。
// 纯前端球面三角(calcAzimuthLocal,0=南顺时针 → 罗盘向+180),误差<0.5° 足够方位显示。
function AzimuthTable({rootValue, chart, params}){
	const jdn = Number(pickDeep(rootValue, ['jdn', 'julianDay', 'jd', 'jdUt']));
	const latObs = params && params.lat ? convertLatStrToDegree(params.lat) : null;
	const lonObs = params && params.lon ? convertLonStrToDegree(params.lon) : null;
	if(!Number.isFinite(jdn) || latObs === null || lonObs === null){
		return <div className="horosa-guolao-moira-empty">缺少儒略日/经纬,无法计算地平方位。</div>;
	}
	const objects = safeList(chart && chart.objects);
	const rows = MOIRA_PLANET_DEFS.map((def)=>{
		const obj = objects.find((o)=>o && o.id === def.id);
		if(!obj || !Number.isFinite(Number(obj.lon))){
			return null;
		}
		let res = null;
		try{
			res = calcAzimuthLocal({
				jdn,
				latObs,
				lonObs,
				coordLon: Number(obj.lon),
				coordLat: Number.isFinite(Number(obj.lat)) ? Number(obj.lat) : 0,
				coordType: 0,
			});
		}catch(e){
			return null;
		}
		if(!res){
			return null;
		}
		const azCompass = ((Number(res.azimuth) + 180) % 360 + 360) % 360;
		const alt = Number(res.altitudeTrue);
		return {
			id: def.id,
			name: def.label,
			az: azCompass,
			alt,
			shan: shanAtDeg(azCompass),
		};
	}).filter(Boolean);
	if(!rows.length){
		return <div className="horosa-guolao-moira-empty">当前盘无可计算的星曜。</div>;
	}
	return (
		<div className="horosa-guolao-moira-table">
			<div className="horosa-guolao-moira-table-row horosa-guolao-moira-table-head">
				<span>星</span><span>方位角</span><span>高度</span><span>所临山</span>
			</div>
			{rows.map((item)=>(
				<div className="horosa-guolao-moira-table-row" key={`az-${item.id}`}>
					<strong>{item.name}</strong>
					<span>{item.az.toFixed(1)}°</span>
					<span>{item.alt >= 0 ? '+' : ''}{item.alt.toFixed(1)}°</span>
					<span>{item.shan || '-'}山</span>
				</div>
			))}
		</div>
	);
}

// 星点动态表(本命/流年各一份):七政 + 四余(罗计炁孛) + 天海冥 + 升顶(角点)。
// 所属列=Moira 庙旺(殿垣庙旺乐喜怒,照 moira_t.prop 星辰X 表)+擢升徽标;速度列=Moira 速度态(顺逆留伏迟速)。
// 天海冥无庙旺/升顶无庙旺无自行 → 相应列显 '-'。宿度/位置随宿度制与左栏选择实时变。
function StarPointTable({rows, angleRows}){
	const list = safeList(rows).concat(safeList(angleRows));
	if(!list.length){
		return <div className="horosa-guolao-moira-empty">当前响应无可判星点动态的数据。</div>;
	}
	return (
		<div className="horosa-guolao-moira-table horosa-guolao-moira-table-5col">
			<div className="horosa-guolao-moira-table-row horosa-guolao-moira-table-head">
				<span>星</span><span>宫/宿度</span><span>位置</span><span>所属</span><span>速度</span>
			</div>
			{list.map((item)=>{
				// 去前导宫号(本命) + 取别名前段(流年房号翻译含「子女宫 / 男女宫」双名,只留首名)。
				const houseName = String(item.house || item.signName || '')
					.replace(/^\s*\d+\s*宫\s*[-·、]?\s*/, '')
					.split(/\s*\/\s*/)[0].trim()
					.replace(/宫$/, '');
				const belong = [safeList(item.signStatus).join('·'), item.exalt].filter(Boolean).join(' ');
				return (
				<div className="horosa-guolao-moira-table-row" key={`sp-state-${item.id}`}>
					<strong>{item.name}</strong>
					<span>{[houseName, item.suDegText || (item.su28 ? `${item.su28}${item.compactDegree}` : item.compactDegree)].filter(Boolean).join(' ')}</span>
					<span>{item.signDegreeText || '-'}</span>
					<span>{belong || '-'}</span>
					<span>{item.motionState || '-'}</span>
				</div>
				);
			})}
		</div>
	);
}

// 年曜化曜表(照 Moira prop year_info 版式):每行 主曜︵化︶ + 诸从词︵化︶。
// birth=全表(含月/命/局依赖词:值难/职元/局主/天经/地纬/天元/地元/人元);
// transit=Moira 原版流年精简模板(上述词依本命而定,流年语境刻意留空)——非缺数据。
// 替代十神映射(照 Moira alt_year_info 模板对位:天贵位为空,保留原名)。
const TEN_GOD_ALT_MAP = { 天禄: '比肩', 天暗: '劫财', 天福: '食神', 天耗: '伤官', 天荫: '偏财', 天嗣: '正财', 天刑: '七杀', 天印: '正官', 天囚: '偏印', 天权: '正印' };
function tenGodName(name, seq){
	return (seq === 'alt' && TEN_GOD_ALT_MAP[name]) ? TEN_GOD_ALT_MAP[name] : name;
}

function YearGroupTable({groups, tenGodSeq}){
	const list = safeList(groups);
	if(!list.length){
		return null;
	}
	return (
		<div className="horosa-guolao-moira-yeargroup-table">
			{list.map((row, idx)=>(
				<div className="horosa-guolao-moira-yeargroup-row" key={`${row.main}-${idx}`}>
					<strong>
						{tenGodName(row.main, tenGodSeq)}
						{row.mainStar ? <i>{row.mainStar}</i> : null}
					</strong>
					<span>
						{safeList(row.items).slice(1).map((item, j)=>(
							<em key={`${item.name}-${j}`}>
								{item.name}
								{item.star ? <i>{item.star}</i> : null}
							</em>
						))}
					</span>
				</div>
			))}
		</div>
	);
}

// 宫位化曜合并表:本命化曜 + 流年化曜 同列于十二宫(用户钦定顺序 命财兄田子奴夫疾迁官福相)。
// 曜名(shortName)随其化曜(star)派生(如各土宫→福食),故随化曜同格不拆列;宫性(强弱·地支·星座)命/流共享(十二宫本命固定,已 live 核实 natal==transit)。
const YEARSIGN_PALACE_ORDER = ['命宫', '财帛', '兄弟', '田宅', '子女', '奴仆', '夫妻', '疾厄', '迁移', '官禄', '福德', '相貌'];
function normYearSignPalace(name){
	let n = String(name || '').trim().replace(/宫$/, '');
	if(n === '男女' || n === '子孙' || n === '男' || n === '子'){ n = '子女'; }   // 子女宫在本仓数据名为「男女」,归一
	return n;
}
// 纯函数:按钦定宫序合并本命/流年年曜化曜,返回 [{name, natalText, transitText, sign}]。零丢失(异名宫兜底补末)。
export function mergeOrderedYearStars(natalRows, transitRows){
	const natal = safeList(natalRows);
	const transit = safeList(transitRows);
	if(!natal.length && !transit.length){ return []; }
	const toMap = (list)=>{ const m = new Map(); list.forEach((r)=>{ if(r && r.name){ m.set(normYearSignPalace(r.name), r); } }); return m; };
	const nMap = toMap(natal);
	const tMap = toMap(transit);
	const seen = new Set();
	const out = [];
	const cell = (r)=>r ? [r.star, r.shortName].filter(Boolean).join(' ') : '';
	const emit = (key)=>{
		if(seen.has(key)){ return; }
		const nr = nMap.get(key);
		const tr = tMap.get(key);
		if(!nr && !tr){ return; }
		seen.add(key);
		const base = nr || tr;
		out.push({
			name: base.name,
			natalText: cell(nr),
			transitText: cell(tr),
			sign: [base.quality, base.zi, base.signName].filter(Boolean).join(' · '),
		});
	};
	YEARSIGN_PALACE_ORDER.forEach((p)=>emit(normYearSignPalace(p)));
	natal.forEach((r)=>r && r.name && emit(normYearSignPalace(r.name)));      // 兜底:非标准宫名按原序补末
	transit.forEach((r)=>r && r.name && emit(normYearSignPalace(r.name)));
	return out;
}

// 渲染:宫 | 本命(化曜·曜名) | 流年(化曜·曜名) | 宫性。
function YearSignMergedTable({natalRows, transitRows}){
	const rows = mergeOrderedYearStars(natalRows, transitRows);
	if(!rows.length){ return null; }
	return (
		<div className="horosa-guolao-moira-table horosa-guolao-moira-yearsign-table horosa-guolao-moira-yearsign-merged">
			<div className="horosa-guolao-moira-table-row horosa-guolao-moira-table-head">
				<span>宫</span><span>本命</span><span>流年</span><span>宫性</span>
			</div>
			{rows.map((item)=>(
				<div className="horosa-guolao-moira-table-row" key={`ysm-${item.name}`}>
					<strong>{item.name}</strong>
					<span>{item.natalText || '-'}</span>
					<span>{item.transitText || '-'}</span>
					<span>{item.sign || '-'}</span>
				</div>
			))}
		</div>
	);
}

function StellarRelationTable({rows}){
	const list = safeList(rows).filter((item)=>safeList(item.main).length || safeList(item.same).length || safeList(item.transitMain).length || safeList(item.transitSame).length);
	if(!list.length){
		return <div className="horosa-guolao-moira-empty">当前星宿未形成可摘录的落宿/同经信息。</div>;
	}
	return (
		<div className="horosa-guolao-moira-table horosa-guolao-moira-stellar-table">
			<div className="horosa-guolao-moira-table-row horosa-guolao-moira-table-head">
				<span>宿</span><span>本命落入</span><span>本命同经</span><span>流年落入</span>
			</div>
			{list.map((item)=>(
				<div className="horosa-guolao-moira-table-row" key={`stellar-${item.index}-${item.name}`}>
					<strong>{item.label || item.name}</strong>
					<span>{joinNames(item.main)}</span>
					<span>{joinNames(item.same)}</span>
					<span>{[joinNames(item.transitMain), safeList(item.transitSame).length ? `同经：${joinNames(item.transitSame)}` : ''].filter((val)=>val && val !== '无').join('；') || '无'}</span>
				</div>
			))}
		</div>
	);
}

function hasRenderableChart(rootValue){
	return safeList(rootValue && rootValue.chart && rootValue.chart.objects).length > 0;
}

function buildPanelFallbackValue(rootValue){
	return {
		engine: 'horosa-local-moira-panel-fallback',
		engineLabel: 'Moira政余格局',
		summary: '',
		styleWarning: '',
		params: mergeDefined(rootValue && rootValue.params),
		anchors: {},
		houses: [],
		planets: [],
		patterns: [],
		godHits: [],
	};
}

function GuoLaoMoiraPanel(props){
	// horosa_freeze_subtabs_v1 接线:本面板的 Tabs 原为【非受控】(defaultActiveKey),拿不到 active
	// 就没法冻结 —— 按 FreezeSubTab 的前提先改受控(接线方自己改,组件不代劳)。
	// hooks 必须在下面几处 early return 之前调用,故置于函数体最顶。
	const [moiraTab, setMoiraTab] = useState('overview');
	const rootValue = props.rootValue || {};
	const value = props.value || ((!props.loading && hasRenderableChart(rootValue)) ? buildPanelFallbackValue(rootValue) : null);
	const birthChart = rootValue.chart || {};
	const transitRoot = props.transitValue || {};
	const transitChart = transitRoot.chart || {};
	const params = mergeDefined(value && value.params, rootValue.params);
	const transitParams = safeMap(props.transitParams);
	const display = props.display || {};   // 类B 显示偏好:命主取法/留伏迟疾/五虎遁/行运法/定童限等
	const limitChildBase = Number(display.limitChildBase) === 10 ? 10 : 9; // 定童限 base(9 九年/10 十年),与大限环同口径
	// 宿主页注入的补充 tab(化曜/虚实/命曜/流曜/相位等)——信息常驻右栏,不再只藏在快捷弹层里。
	// 契约 { key, label, children }:children 既可是【节点】也可是【thunk `()=>节点`】——
	// 两种形态都受支持(下方统一归一为 thunk 交给 FreezeSubTab 惰性求值)。推荐 thunk:
	// 未激活过的 tab 连元素树都不构造(宿主 GuoLaoChartMain.buildMoiraExtraTabs 已改 thunk 侧)。
	const extraTabs = Array.isArray(props.extraTabs) ? props.extraTabs.filter(Boolean) : [];

	if(props.loading && !value){
		return (
			<div className="horosa-guolao-moira">
				{[0, 1, 2, 3, 4, 5].map((i)=>(<div className="horosa-guolao-moira-skeleton-row" key={i} />))}
			</div>
		);
	}
	if(!value){
		return (
			<div className="horosa-guolao-moira">
				<div className="horosa-guolao-moira-empty">Moira 规则层等待当前七政盘完成后载入。</div>
			</div>
		);
	}

	const anchors = value.anchors || {};
	const life = anchors.life && Object.keys(anchors.life).length
		? anchors.life
		: anchorFromObject(birthChart, AstroConst.LIFEMASTERDEG74, AstroConst.ASC, '命度点');
	const self = anchors.self && Object.keys(anchors.self).length
		? anchors.self
		: anchorFromObject(birthChart, AstroConst.MOON, AstroConst.ASC, '身度参考');
	const lifeSuHost = suHostForLon(birthChart, life.longitude);
	const selfSuHost = suHostForLon(birthChart, self.longitude);
	const unverifiedPatternSource = hasUnverifiedMoiraPatternSource(value);
	const styleWarning = value.styleWarning || (unverifiedPatternSource ? '当前接口返回的是旧版 Horosa 近似格局，不是 Moira 本体的政余喜格/忌格；已屏蔽为正式格局输出。' : '');
	const patterns = unverifiedPatternSource ? [] : safeList(value.patterns);
	const planets = safeList(value.planets);
		// [horosa_guolao_render_slice_v1] 星点/角点四表只有「星曜」tab 消费、星宿同经表只有「宫限」tab
		// 消费 —— 包 lazyOnce 后未激活 tab 一行不算(此前每次面板重渲无条件全算五段)。
		const getNatalPlanetRows = lazyOnce(()=> buildPlanetRows(birthChart, planets));
		const getTransitPlanetRows = lazyOnce(()=> buildPlanetRows(transitChart, []));
		const getNatalAngleRows = lazyOnce(()=> buildAngleRows(birthChart));       // 升顶(Asc/MC)角点 → 星点动态表尾
		const getTransitAngleRows = lazyOnce(()=> buildAngleRows(transitChart));
		const godHits = safeList(value.godHits);
		const yearStars = safeMap(value.yearStars);
		const birthYearStars = safeMap(yearStars.birth);
		const currentYearStars = safeMap(yearStars.transit);
		const natalYearStars = safeList(value.natalYearStars);
		const transitYearStars = safeList(value.transitYearStars);
		const transitGodHits = safeList(value.transitGodHits);
		const houses = safeList(value.houses);
	const getStellarRelationRows = lazyOnce(()=> mergeStellarRelationRows(birthChart, transitChart));
	const birthYear = yearFromParams(params);
	const transitYear = yearFromParams(transitParams);
	const birthYearText = baziStemBranch(rootValue, 'year', birthYear);
	const transitYearText = stemBranchForYear(transitYear);
	const age = transitYear - birthYear + 1;
	const apparentSolar = pickDeep(rootValue, ['apparentSolar', 'apparent_solar', 'apparentSolarTime', 'solarTime', 'trueSolarTime']) || (birthChart.nongli && birthChart.nongli.birth);
	const sunrise = pickDeep(rootValue, ['sunrise', 'sunRise', 'sunriseTime', 'sunRiseTime', 'sun_rise', 'guolaoSunRiseTime']);
	const sunset = pickDeep(rootValue, ['sunset', 'sunSet', 'sunsetTime', 'sunSetTime', 'sun_set']);
	const moonrise = pickDeep(rootValue, ['moonrise', 'moonRise', 'moonriseTime', 'moonRiseTime', 'moon_rise']);
	const moonset = pickDeep(rootValue, ['moonset', 'moonSet', 'moonsetTime', 'moonSetTime', 'moon_set']);
	const hasRiseSet = sunrise || sunset || moonrise || moonset;

	// horosa_freeze_subtabs_v1:五个原生 tab 的 children 一律改为【惰性 thunk】—— 原先在 items
	// 数组构造时就把全部五个面板的元素树造出来(其中「概览」内还有三处 (()=>{…})() 立即求值的
	// 限度/小限/宫限计算),而用户只看得见 1 个。thunk 由 FreezeSubTab 在「本面板激活过」时才求值。
	const rawItems = [
				{ key: 'overview', label: '概览', children: ()=>(<>
				<Section title="起盘与流年">
				<KeyValueGrid items={[
					{label: '计算法', value: '地心计算法'},
					{label: '本命时间', value: dateTextFromParams(params)},
					{label: '本命四柱', value: baziText(rootValue) || birthYearText},
					{label: '流年时间', value: dateTextFromParams(transitParams)},
					{label: '本命农历', value: lunarText(rootValue)},
					{label: '流年', value: `${transitYearText} ${transitYear}，${Number.isFinite(age) ? `${age}岁` : ''}`},
					{label: '地点', value: [params.lon, params.lat].filter(Boolean).join(' ')},
				]} />
			</Section>

			<Section title="真太阳与出没">
				<KeyValueGrid items={[
					{label: '真太阳时间', value: apparentSolar || dateTextFromParams(params)},
					{label: '日出', value: sunrise},
					{label: '日落', value: sunset},
					{label: '月出', value: moonrise},
					{label: '月落', value: moonset},
					{label: '报时星(时星)', value: timerStarName(birthChart && birthChart.timerStar)},
				]} />
				{hasRiseSet ? null : <div className="horosa-guolao-moira-note">日月出没接口未给出独立字段，当前先以起盘时间和盘面星曜为准。</div>}
			</Section>

			<Section title="命身与限度">
				<div className="horosa-guolao-moira-anchor-grid">
					<div className="horosa-guolao-moira-anchor">
						<span>命主/命度</span>
						<strong>{life.signName || '随盘面'} {life.degreeText || ''}</strong>
						<em>{[life.zi, life.area, life.moiraHouse, anchors.lifeModeName || value.lifeModeName].filter(Boolean).join(' · ')}</em>
					</div>
					<div className="horosa-guolao-moira-anchor">
						<span>身主/身度</span>
						<strong>{self.signName || '随盘面'} {self.degreeText || ''}</strong>
						<em>{[self.zi, self.area, self.moiraHouse].filter(Boolean).join(' · ')}</em>
					</div>
				</div>
				<div className="horosa-guolao-moira-anchor-grid horosa-guolao-moira-su-anchor-grid">
					<div className="horosa-guolao-moira-anchor">
						<span>命度宿主</span>
						<strong>{lifeSuHost ? lifeSuHost.value : '随盘面'}</strong>
					</div>
					<div className="horosa-guolao-moira-anchor">
						<span>身度宿主</span>
						<strong>{selfSuHost ? selfSuHost.value : '随盘面'}</strong>
					</div>
				</div>
				{(()=>{
					// 三主(命主/身主/度主)+ 命宫配干(五虎遁)+ 生年化曜:纯前端派生(古法立成),additive 零回归。
					const ms = deriveGuolaoMasters(life, self, lifeSuHost && lifeSuHost.name, (birthYearText || '').slice(0, 1), display.lifeMasterMode);
					const items = [];
					const useDu = ms.lifeMasterMode === 'du' || ms.lifeMasterMode === 'dudegrade';
					if(ms.lifeMasterStar){ items.push({ label: useDu ? '命主(度主)' : '命主(宫主)', value: ms.lifeMasterStar }); }
					if(ms.lifeMaster){ items.push({ label: '命宫宫主', value: ms.lifeMaster }); }
					if(ms.degMaster){ items.push({ label: '命度度主(宿主曜)', value: ms.degMaster }); }
					if(ms.bodyMaster){ items.push({ label: '身主(身宫宫主)', value: ms.bodyMaster }); }
					if(ms.mingStem && ms.mingPalaceZi){ items.push({ label: '命宫配干(五虎遁)', value: `${ms.mingStem}${ms.mingPalaceZi}` }); }
					if(ms.huayao){ items.push({ label: '生年化曜(A诀)', value: ms.huayao }); }
					return items.length ? (<><div className="horosa-guolao-moira-subtitle">三主 · 命宫配干 · 化曜（{useDu ? '专度主' : '主宫主'}）</div><KeyValueGrid items={items} /></>) : null;
				})()}
			</Section>
				{(()=>{
					// Moira 信息区四表(照其本命盘右上版式):难仇恩用(度/宫两役行,主星五行查表;备标签「难财恩用」仅 Moira PICK_MODE 用)、
					// 虚实四柱(虚=旬空)、飞限/小限、限度/至(黄道座+度分;宿度精排在盘面)。
					const ms2 = deriveGuolaoMasters(life, self, lifeSuHost && lifeSuHost.name, (birthYearText || '').slice(0, 1), display.lifeMasterMode);
					const rows = [];
					const duElem = ms2.degMaster ? `${ms2.degMaster}`.charAt(0) : '';
					const gongElem = ms2.lifeMaster ? `${ms2.lifeMaster}`.charAt(0) : branchElementOf(life && life.zi ? `${life.zi}`.slice(-1) : '');
					const duRow = lifeHelperRow(duElem);
					const gongRow = lifeHelperRow(gongElem);
					if(duRow){ rows.push({ head: '度', main: duElem, roles: duRow }); }
					if(gongRow){ rows.push({ head: '宫', main: gongElem, roles: gongRow }); }
					const baziObj = getBazi(rootValue);
					const pillarOf = (key)=>{
						const col = baziObj && baziObj[key];
						if(!col){ return ''; }
						if(col.text){ return col.text; }
						const stem = col.stem && col.stem.cell ? col.stem.cell : '';
						const branch = col.branch && col.branch.cell ? col.branch.cell : '';
						return `${stem}${branch}`;
					};
					const pillars = [pillarOf('year'), pillarOf('month'), pillarOf('day'), pillarOf('time')];
					const ws = pillars.some(Boolean) ? weakSolidPillars(pillars) : null;
					const lifeLon = Number(life && life.longitude);
					const hasLife = Number.isFinite(lifeLon) && Number.isFinite(age);
					const SIGN_BRANCH_LOCAL = ['戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥'];
					const fmtLimitDeg = (deg)=>{
						const v = ((Number(deg) % 360) + 360) % 360;
						const sign = Math.floor(v / 30);
						const inDeg = v - sign * 30;
						const d = Math.floor(inDeg);
						const m = Math.floor((inDeg - d) * 60);
						return `${String(d).padStart(2, '0')}${SIGN_BRANCH_LOCAL[sign]}${String(m).padStart(2, '0')}`;
					};
					// 飞限/童限边界=童限岁数上限四舍值;限度度数首宫=童限不四舍值(照 Moira getChildLimit true/false)。
					// 勿用 flyLimitBranches/limitDegreeSpan 默认 5/11,否则童限边界与首宫年数皆错。
					const childLimit = hasLife ? childAgeLimitYears(lifeLon, limitChildBase) : 5;
					const childSpan = hasLife ? childYearsSpan(lifeLon, limitChildBase) : 11;
					const fly = hasLife ? flyLimitBranches(lifeLon, Math.max(0, age - 1), childLimit) : null;
					const span = hasLife ? limitDegreeSpan(lifeLon, age, childSpan) : null;
					const childZhi = hasLife && age <= childLimit ? childLimitBranch(lifeLon, age) : '';
					// 月限(照 Moira getMonthLimit):生月支 / 流年时刻月支 → 农历月序(月建口径);数据缺则空。
					const monthBranchCell = (col)=>{ const b = col && col.branch; return (b && (b.cell || b.text)) || ''; };
					const monthZhi = hasLife ? monthLimitBranch(lifeLon, age,
						lunarMonthNumFromBranch(monthBranchCell(getBazi(rootValue).month)),
						lunarMonthNumFromBranch(monthBranchCell(getBazi(transitRoot).month))) : '';
					if(!rows.length && !ws && !hasLife){ return null; }
					return (
						<>
							{rows.length ? (
								<Section title="难仇恩用（主星五行四役）">
									<div className="horosa-guolao-moira-yeargroup-table">
										{rows.map((row)=>(
											<div className="horosa-guolao-moira-yeargroup-row" key={`helper-${row.head}`}>
												<strong>{row.head}<i>{row.main}</i></strong>
												<span>
													{LIFE_HELPER_LABELS.map((lab, li)=>(
														<em key={`${row.head}-${lab}`}>{lab}<i>{row.roles[li]}</i></em>
													))}
												</span>
											</div>
										))}
									</div>
								</Section>
							) : null}
							{ws ? (
								<Section title="虚实四柱（虚＝旬空）">
									<KeyValueGrid items={[
										{ label: '虚', value: ws.weak.join('') },
										{ label: '实', value: ws.solid.join('') },
									]} />
								</Section>
							) : null}
							{hasLife ? (
								<Section title={`飞限 · 童限 · 小限 · 月限 · 限度（${age} 岁 · ${transitYearText}年）`}>
									<KeyValueGrid items={[
										fly && fly.branches.length ? { label: '飞限', value: fly.branches.join('/') + (fly.halfYear ? '（各半年）' : '') } : null,
										childZhi ? { label: '童限', value: childZhi } : null,
										{ label: '小限', value: smallLimitBranch(lifeLon, age) },
										monthZhi ? { label: '月限', value: monthZhi } : null,
										span ? { label: '限度', value: fmtLimitDeg(span.from) } : null,
										span ? { label: '至', value: fmtLimitDeg(span.to) } : null,
									].filter(Boolean)} />
								</Section>
							) : null}
						</>
					);
				})()}
				{(()=>{
					// G31/G32 行运法(类B 选择):''古度限度法(默认)/dongwei洞微大限/minor小限/month月限/tong童限。各派算法 §10。
					const limitType = display.minorLimitType || '';
					const sunLon = objectLon(findObject(birthChart, AstroConst.SUN), isEclipticDisplay(birthChart));
					const mz = life && life.zi;
					if(limitType === '' && Number.isFinite(Number(life.longitude)) && Number.isFinite(birthYear)){
						const limitRows = buildLimitTable(Number(life.longitude), birthYear, limitChildBase);
						const curIdx = Number.isFinite(age) ? currentLimitIndex(limitRows, age) : -1;
						return (
							<Section title="大限（古度限度法 · 自命宫整宫界起 · 照 Moira）">
								<div className="horosa-guolao-moira-house-list horosa-guolao-moira-limit-list">
									{limitRows.map((row, idx)=>(
										<div key={row.index} className={idx === curIdx ? 'horosa-guolao-moira-limit-current' : undefined}>
											<strong>{row.index}. {row.palace}</strong>
											<span>{row.fromAge}–{row.toAge} 岁</span>
											<em>{row.fromYear}–{row.toYear}{idx === curIdx ? ' · 当前大限' : ''}</em>
										</div>
									))}
								</div>
							</Section>
						);
					}
					if(!Number.isFinite(Number(sunLon)) || !mz){ return null; }
					if(limitType === 'dongwei'){
						const dw = glDongwei(Number(sunLon) % 30);
						// WP-E 飞星吊度:当前洞微限内、按岁取本年吊度(逐宫每年 30/宫年数,入度链式)。
						let curDiaodu = null;
						if(Number.isFinite(age)){
							const curRow = dw.rows.find((rr)=> age >= rr.fromAge && age < rr.toAge);
							if(curRow && curRow.diaodu && curRow.diaodu.length){
								curDiaodu = curRow.diaodu.reduce((best, d)=> (d.age <= age + 1e-6 && (!best || d.age > best.age)) ? d : best, null) || curRow.diaodu[0];
							}
						}
						return (
							<Section title={`洞微大限（命宫顺行 · 各宫年数 · 飞星吊度 · 起限 ${dw.startAge} 岁）`}>
								{curDiaodu ? (
									<div className="horosa-guolao-moira-meta-note">本年飞星吊度 ≈ {curDiaodu.deg}°（{age} 岁）</div>
								) : null}
								<div className="horosa-guolao-moira-house-list horosa-guolao-moira-limit-list">
									{dw.rows.map((row)=>{
										const cur = Number.isFinite(age) && age >= row.fromAge && age < row.toAge;
										return (
											<div key={row.index} className={cur ? 'horosa-guolao-moira-limit-current' : undefined}>
												<strong>{row.index}. {row.palace}</strong>
												<span>{row.fromAge}–{row.toAge} 岁</span>
												<em>{row.years} 年 · 入{row.entryDeg}°·每年{row.perYearDeg}°{cur ? ' · 当前洞微限' : ''}</em>
											</div>
										);
									})}
								</div>
							</Section>
						);
					}
					if(limitType === 'tong'){
						const tx = glTongxian(Number(sunLon), display.tongxianBase || 'tong10');
						const _baseName = { tong10: '通行十年', gu9: '古九岁', xu11: '虚十一(早不过11)' }[tx.baseVariant] || '通行十年';
						return (<Section title={`童限（命财疾妻福顺排 · 基数${_baseName}）`}><KeyValueGrid items={[
							{ label: '童限顺排', value: tx.palaces.join('→') },
							{ label: '出童限(约)', value: `${tx.exitAge} 岁` },
						]} /></Section>);
					}
					if(limitType === 'month'){
						// 生月按月柱地支(节气月,寅=正月);月柱缺则回退阳历月。七政四余月限用节气月口径。
						const monthZhi = glZiChar((baziStemBranch(rootValue, 'month') || '').slice(-1));
						let bMonth = 1;
						const mzi = GL_ZHI.indexOf(monthZhi);
						if(mzi >= 0){ bMonth = ((mzi - 2) % 12 + 12) % 12 + 1; }
						else { const bp = String((params && (params.birth || params.date)) || '').replace(/[/T-]/g, ' ').trim().split(/\s+/); bMonth = bp.length >= 2 ? (parseInt(bp[1], 10) || 1) : 1; }
						const yx = Number.isFinite(age) ? glYuexian(mz, age, bMonth) : null;
						return (<Section title={`月限（小限宫起生月逆寻 · 生月${bMonth}）`}><KeyValueGrid items={[
							...(yx ? [{ label: `月限(${age}岁)`, value: `${yx.palaceName}（${yx.palaceZi}）` }] : [{ label: '月限', value: '需年龄/生月' }]),
						]} /></Section>);
					}
					// minor 小限(默认非空时)
					const xx = Number.isFinite(age) ? glXiaoxian(mz, age) : null;
					return (<Section title="小限（生年支加命宫逆数）"><KeyValueGrid items={[
						...(xx ? [{ label: `小限(${age}岁)`, value: `${xx.palaceName}（${xx.palaceZi}）` }] : [{ label: '小限', value: '需年龄' }]),
					]} /></Section>);
				})()}

				</>) },
				{ key: 'stars', label: '星曜', children: ()=>(<>
				<Section title="宫位化曜（本命 / 流年）">
					<YearSignMergedTable natalRows={natalYearStars} transitRows={transitYearStars} />
				</Section>

				{display.showAzimuth === true ? (
					<Section title="地平方位（方位角 · 高度 · 所临山）">
						<AzimuthTable rootValue={rootValue} chart={birthChart} params={params} />
					</Section>
				) : null}

				<Section title="本命星点动态（庙旺所属 · 速度）">
					<StarPointTable rows={getNatalPlanetRows()} angleRows={getNatalAngleRows()} />
				</Section>

				<Section title="流年星点动态（庙旺所属 · 速度）">
					<StarPointTable rows={getTransitPlanetRows()} angleRows={getTransitAngleRows()} />
				</Section>

				<Section title="年曜与十神">
					<KeyValueGrid items={[
						{label: '本命年柱', value: birthYearStars.yearPole || birthYearText},
						{label: '流年年柱', value: currentYearStars.yearPole || transitYearText},
						{label: '本命首曜', value: birthYearStars.yearStar},
						{label: '流年首曜', value: currentYearStars.yearStar || `${transitYearText.slice(0, 1)} → ${YEAR_STAR_BY_STEM[transitYearText.slice(0, 1)] || '-'}`},
						{label: '原十神序', value: safeList(yearStars.tenGodListOrg).length ? yearStars.tenGodListOrg.join('、') : TEN_GOD_ORG.join('、')},
						{label: '替代十神序', value: safeList(yearStars.tenGodListAlt).length ? yearStars.tenGodListAlt.join('、') : TEN_GOD_ALT.join('、')},
					]} />
					{safeList(birthYearStars.groups).length ? (
						<>
							<div className="horosa-guolao-moira-yeargroup-title">本命年曜（全表）</div>
							<YearGroupTable groups={birthYearStars.groups} tenGodSeq={display.tenGodSeq} />
						</>
					) : null}
					{safeList(currentYearStars.groups).length ? (
						<>
							<div className="horosa-guolao-moira-yeargroup-title">流年年曜（月命局诸元随本命，流年从简）</div>
							<YearGroupTable groups={currentYearStars.groups} tenGodSeq={display.tenGodSeq} />
						</>
					) : null}
					{!safeList(birthYearStars.groups).length && !safeList(currentYearStars.groups).length ? (
						<div className="horosa-guolao-moira-year-groups">
							{yearInfoRows('年曜', transitYearText).map((row, idx)=>(
								<div key={`${row.main}-${idx}`}>
									<strong>{row.main}</strong>
									<span>{row.items.slice(1).join('、') || '主项'}</span>
									{row.yearStar ? <em>化禄：{row.yearStar}</em> : null}
								</div>
							))}
						</div>
					) : null}
			</Section>

			</>) },
				{ key: 'palace', label: '宫限', children: ()=>(<>
				<Section title="十二宫位">
				<div className="horosa-guolao-moira-house-list">
					{houses.map((item)=>(
						<div key={`${item.index}-${item.name}`}>
							<strong>{item.name}</strong>
							<span>{item.zi} · {item.area} · {item.signName}</span>
							<em>{item.moiraStarHouse}</em>
						</div>
					))}
				</div>
			</Section>

				<Section title="星宿落入与同经">
					<StellarRelationTable rows={getStellarRelationRows()} />
				</Section>

			</>) },
				{ key: 'gods', label: '神煞', children: ()=>(<>
				<Section title="神煞全表">
				<div className="horosa-guolao-moira-gods">
					{godHits.map((item)=>(
							<div className="horosa-guolao-moira-god" key={`${item.house}-${item.zi}`}>
								<strong>{item.house}</strong>
								<span>{item.zi} · {item.signName}</span>
								{safeList(item.gods).length ? <div>曜：{joinNames(item.gods)}</div> : (
									<>
										<div>吉：{joinNames(item.goodGods)}</div>
										<div>平：{joinNames(item.neutralGods)}</div>
										<div>忌：{joinNames(item.badGods)}</div>
										<div>太岁：{joinNames(item.taisuiGods)}</div>
									</>
								)}
							</div>
						))}
					{godHits.length === 0 ? <div className="horosa-guolao-moira-empty">当前盘未返回可摘录的七政神煞。</div> : null}
					</div>
				</Section>

				{transitGodHits.length ? (
					<Section title="流年神煞">
						<div className="horosa-guolao-moira-gods">
							{transitGodHits.map((item)=>(
								<div className="horosa-guolao-moira-god" key={`now-${item.house}-${item.zi}`}>
									<strong>{item.house}</strong>
									<span>{item.zi} · {item.signName}</span>
									<div>曜：{joinNames(item.gods || item.taisuiGods)}</div>
								</div>
							))}
						</div>
					</Section>
				) : null}

				</>) },
				{ key: 'pattern', label: '格局', children: ()=>(
				<Section title="政余格局">
				{styleWarning ? <div className="horosa-guolao-moira-warning">{styleWarning}</div> : null}
				{patterns.length ? (
					<div className="horosa-guolao-moira-patterns">
						{patterns.map((item, idx)=>(
							<div className={`horosa-guolao-moira-pattern horosa-guolao-moira-pattern-${item.level || 'neutral'}`} key={`${item.name || 'pattern'}-${idx}`}>
								<div className="horosa-guolao-moira-pattern-head">
									<span>{levelText(item.level)}</span>
									<strong>{item.name}</strong>
								</div>
								<div className="horosa-guolao-moira-pattern-detail">{item.detail}</div>
							</div>
						))}
					</div>
				) : <div className="horosa-guolao-moira-empty">当前盘未命中已接入的 Moira 政余喜格/忌格。</div>}
			</Section>
				) },
				...extraTabs,
	];
	// 受控化 + 防呆:activeKey 不在现存 tab 集内(如择日/搜索两 tab 随 chartStyle 出现/消失,
	// 停在已消失的 key 上会显空白)→ 回落到第一个 tab。
	const tabKeys = rawItems.map((item)=> item && item.key);
	const activeKey = tabKeys.indexOf(moiraTab) >= 0 ? moiraTab : (tabKeys[0] || 'overview');
	return (
		<div className="horosa-guolao-moira">
			<Tabs className="horosa-content-tabs horosa-guolao-tabs horosa-guolao-moira-tabs" tabPosition="top" activeKey={activeKey} onChange={setMoiraTab} items={rawItems.map((item)=>({
				...item,
				// 冻结 ≠ 卸载:非激活面板只是 sCU 跳过重渲,DOM/组件实例/滚动位置/展开态全留,
				// 切回时拿本轮最新 thunk 立即渲一帧(不重挂载、不重取数、不闪烁)。
				children: (
					<FreezeSubTab active={activeKey === item.key}>
						{typeof item.children === 'function' ? item.children : ()=> item.children}
					</FreezeSubTab>
				),
			}))} />
		</div>
	);
}

// [horosa_guolao_render_slice_v1] props 侧 memo(语义同各 Main 的 wrapperPropsEqual sCU:全 props
// 机械浅比、函数型视为恒等、开关 horosa.perf.chartSCU 关=恒重渲旧行为;内部 useState 切 tab 不受
// memo 影响照常重渲)。宿主 extraTabs 已单槽缓存稳定引用,宿主无关抖动不再整树白跑本重面板。
export default memo(GuoLaoMoiraPanel, wrapperPropsEqual);
