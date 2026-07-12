export const GUOLAO_CHART_STYLE_CLASSIC = 'classic';
export const GUOLAO_CHART_STYLE_MOIRA = 'moira';
export const GUOLAO_CHART_STYLE_PICK = 'pick';
export const GUOLAO_CHART_STYLE_QIZHENG = 'qizhengKin';
export const GUOLAO_CHART_STYLE_KEY = 'horosaGuolaoChartStyle';
export const GUOLAO_SU28_MODE_KEY = 'horosaGuolaoSu28Mode';
export const GUOLAO_MOIRA_TRANSIT_GODS_KEY = 'horosaGuolaoMoiraTransitGods';
export const GUOLAO_LIFE_MODE_KEY = 'horosaGuolaoLifeMode';
export const GUOLAO_NODE_MODE_KEY = 'horosaGuolaoNodeMode';
export const GUOLAO_DEFAULT_SU28_MODE = 2;
export const GUOLAO_LIFE_MODE_ASC = 'asc';
export const GUOLAO_LIFE_MODE_YUMAO = 'yumao';       // 日出安命(实际日出)
export const GUOLAO_LIFE_MODE_COTRANS = 'cotrans';
export const GUOLAO_LIFE_MODE_GUMAO = 'gumao';       // 遇卯安命(古法时加太阳顺数至卯)
export const GUOLAO_LIFE_MODE_CUSTOM = 'custom';     // 自定命宫(手动子~亥)
export const GUOLAO_DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const GUOLAO_NODE_MODE_NORTH_KETU = 'northKetuSouthRahu';
export const GUOLAO_NODE_MODE_NORTH_RAHU = 'northRahuSouthKetu';

function getStorage(){
	return typeof localStorage === 'undefined' ? null : localStorage;
}

function readItem(key){
	const storage = getStorage();
	return storage ? storage.getItem(key) : null;
}

function writeItem(key, val){
	const storage = getStorage();
	if(storage){
		try{ storage.setItem(key, val); }catch(e){ /* 配额满等静默:设置丢失可重选,绝不炸渲染 */ }
	}
}

export function getStoredGuolaoChartStyle(){
	const val = readItem(GUOLAO_CHART_STYLE_KEY);
	if(val === GUOLAO_CHART_STYLE_CLASSIC){
		return GUOLAO_CHART_STYLE_CLASSIC;
	}
	if(val === GUOLAO_CHART_STYLE_PICK){
		return GUOLAO_CHART_STYLE_PICK;
	}
	if(val === GUOLAO_CHART_STYLE_QIZHENG){
		return GUOLAO_CHART_STYLE_QIZHENG;
	}
	return GUOLAO_CHART_STYLE_MOIRA;
}

export function setStoredGuolaoChartStyle(val){
	const next = val === GUOLAO_CHART_STYLE_PICK
		? GUOLAO_CHART_STYLE_PICK
		: (val === GUOLAO_CHART_STYLE_QIZHENG
			? GUOLAO_CHART_STYLE_QIZHENG
			: (val === GUOLAO_CHART_STYLE_MOIRA ? GUOLAO_CHART_STYLE_MOIRA : GUOLAO_CHART_STYLE_CLASSIC));
	writeItem(GUOLAO_CHART_STYLE_KEY, next);
	return next;
}

export function getStoredGuolaoSu28Mode(){
	const raw = readItem(GUOLAO_SU28_MODE_KEY);
	if(raw === null || raw === ''){
		return GUOLAO_DEFAULT_SU28_MODE;
	}
	const val = Number(raw);
	return [0, 1, 2, 3, 4, 5, 6, 7, 8].indexOf(val) >= 0 ? val : GUOLAO_DEFAULT_SU28_MODE;
}

export function setStoredGuolaoSu28Mode(val){
	const next = Number(val);
	const mode = [0, 1, 2, 3, 4, 5, 6, 7, 8].indexOf(next) >= 0 ? next : GUOLAO_DEFAULT_SU28_MODE;
	writeItem(GUOLAO_SU28_MODE_KEY, `${mode}`);
	return mode;
}

export function normalizeGuolaoLifeMode(val){
	if(val === GUOLAO_LIFE_MODE_YUMAO){
		return GUOLAO_LIFE_MODE_YUMAO;
	}
	if(val === GUOLAO_LIFE_MODE_COTRANS){
		return GUOLAO_LIFE_MODE_COTRANS;
	}
	if(val === GUOLAO_LIFE_MODE_GUMAO){
		return GUOLAO_LIFE_MODE_GUMAO;
	}
	// R2 自定命宫:命度法值=地支(子~亥)即手动命宫,后端按地支当 custom 算。
	if(GUOLAO_DIZHI.indexOf(val) >= 0){
		return val;
	}
	return GUOLAO_LIFE_MODE_ASC;
}

// R3 身宫法:taiyin/youjin 或 地支(子~亥=自定身宫)。
export function normalizeGuolaoBodyMode(val){
	if(val === 'youjin'){ return 'youjin'; }
	if(GUOLAO_DIZHI.indexOf(val) >= 0){ return val; }
	return 'taiyin';
}

export function getStoredGuolaoLifeMode(){
	return normalizeGuolaoLifeMode(readItem(GUOLAO_LIFE_MODE_KEY));
}

export function setStoredGuolaoLifeMode(val){
	const mode = normalizeGuolaoLifeMode(val);
	writeItem(GUOLAO_LIFE_MODE_KEY, mode);
	return mode;
}

export function normalizeGuolaoNodeMode(val){
	if(val === GUOLAO_NODE_MODE_NORTH_RAHU){
		return GUOLAO_NODE_MODE_NORTH_RAHU;
	}
	return GUOLAO_NODE_MODE_NORTH_KETU;
}

export function getStoredGuolaoNodeMode(){
	return normalizeGuolaoNodeMode(readItem(GUOLAO_NODE_MODE_KEY));
}

export function setStoredGuolaoNodeMode(val){
	const mode = normalizeGuolaoNodeMode(val);
	writeItem(GUOLAO_NODE_MODE_KEY, mode);
	return mode;
}

// 恒星制岁差(ayanāṃśa,G2):空=郑氏默认(零回归);否则 47 制式之 key,仅恒星/赤道宿度制生效。
export const GUOLAO_AYANAMSA_KEY = 'horosaGuolaoAyanamsa';
export function getStoredGuolaoAyanamsa(){
	return readItem(GUOLAO_AYANAMSA_KEY) || '';
}
export function setStoredGuolaoAyanamsa(val){
	const v = val ? String(val) : '';
	writeItem(GUOLAO_AYANAMSA_KEY, v);
	return v;
}

// G6 报时星太阳时:true=真(默认零回归)/mean=平/off=钟表。
export const GUOLAO_TRUE_SOLAR_TIME_KEY = 'horosaGuolaoTrueSolarTime';
export function getStoredGuolaoTrueSolarTime(){
	const v = readItem(GUOLAO_TRUE_SOLAR_TIME_KEY);
	return (v === 'mean' || v === 'off') ? v : 'true';
}
export function setStoredGuolaoTrueSolarTime(val){
	const v = (val === 'mean' || val === 'off') ? val : 'true';
	writeItem(GUOLAO_TRUE_SOLAR_TIME_KEY, v);
	return v;
}

// G10-13 四余取法:罗计交点 mean/true、月孛远地点 mean/true、紫炁 real(今法真算)/tablet(28年立成)。默认皆现状零回归。
export const GUOLAO_NODE_TYPE_KEY = 'horosaGuolaoNodeType';
export function getStoredGuolaoNodeType(){
	return readItem(GUOLAO_NODE_TYPE_KEY) === 'true' ? 'true' : 'mean';
}
export function setStoredGuolaoNodeType(val){
	const v = val === 'true' ? 'true' : 'mean';
	writeItem(GUOLAO_NODE_TYPE_KEY, v);
	return v;
}
export const GUOLAO_LILITH_TYPE_KEY = 'horosaGuolaoLilithType';
export function getStoredGuolaoLilithType(){
	return readItem(GUOLAO_LILITH_TYPE_KEY) === 'true' ? 'true' : 'mean';
}
export function setStoredGuolaoLilithType(val){
	const v = val === 'true' ? 'true' : 'mean';
	writeItem(GUOLAO_LILITH_TYPE_KEY, v);
	return v;
}
export const GUOLAO_ZIQI_MODE_KEY = 'horosaGuolaoZiqiMode';
// 紫炁取法当前只有 'real' 一档生效;'tablet'(28年立成)是后端零消费的假档,已从 UI 隐藏。
// 旧用户 localStorage 可能残留 'tablet',此处一律归一回 'real',防止透传死参导致落宫异常。
export function getStoredGuolaoZiqiMode(){
	return 'real';
}
export function setStoredGuolaoZiqiMode(){
	writeItem(GUOLAO_ZIQI_MODE_KEY, 'real');
	return 'real';
}
// WP-D 授时历古法(用制 6)推变黄道术法:jiyuan=纪元闭式(默认)/jintui=进退/huiyuan=会圆球面近似。仅 mode6 生效。
export const GUOLAO_TUIBIAN_METHOD_KEY = 'horosaGuolaoTuibianMethod';
export function getStoredGuolaoTuibianMethod(){
	const v = readItem(GUOLAO_TUIBIAN_METHOD_KEY);
	return (v === 'jintui' || v === 'huiyuan') ? v : 'jiyuan';
}
export function setStoredGuolaoTuibianMethod(val){
	const v = (val === 'jintui' || val === 'huiyuan') ? val : 'jiyuan';
	writeItem(GUOLAO_TUIBIAN_METHOD_KEY, v);
	return v;
}
// WP-D 授时历古法 古宿随岁差:0=宿界钉死元时(默认·永不变盘)/1=宿界东移≈50.29″/年。仅 mode6 生效。
export const GUOLAO_GUFA_PRECESS_KEY = 'horosaGuolaoGufaPrecess';
export function getStoredGuolaoGufaPrecess(){
	return readItem(GUOLAO_GUFA_PRECESS_KEY) === '1' ? 1 : 0;
}
export function setStoredGuolaoGufaPrecess(val){
	const v = (val === 1 || val === '1' || val === true) ? 1 : 0;
	writeItem(GUOLAO_GUFA_PRECESS_KEY, String(v));
	return v;
}
// 额外档·赤道回归制(用制 7)黄道零点锚定:dongzhi 牛前冬至(默认)/ chunfen 春分壁2.3。仅 mode7 生效。
export const GUOLAO_EQ_TROPICAL_ANCHOR_KEY = 'horosaGuolaoEqTropicalAnchor';
export function getStoredGuolaoEqTropicalAnchor(){
	return readItem(GUOLAO_EQ_TROPICAL_ANCHOR_KEY) === 'chunfen' ? 'chunfen' : 'dongzhi';
}
export function setStoredGuolaoEqTropicalAnchor(val){
	const v = val === 'chunfen' ? 'chunfen' : 'dongzhi';
	writeItem(GUOLAO_EQ_TROPICAL_ANCHOR_KEY, v);
	return v;
}

// G34 流派预设(一键套各开关组合,依古籍各派特征 §1.3/§11;选后回 custom 可微调)。
// fields=类A(透传重算) display=类B(纯显示)。琴堂逢酉重八字/果老专度主洞微/天官化曜年干/弧角天星赤道真太阳。
export const GUOLAO_SCHOOL_PRESETS = {
	qintang: { fields: { guolaoLifeMode: 'yumao', guolaoBodyMode: 'youjin', guolaoTrueSolarTime: 'mean', doubingSu28: 2 }, display: { lifeMasterMode: 'gong', minorLimitType: '' } },
	guolao: { fields: { guolaoLifeMode: 'yumao', guolaoBodyMode: 'taiyin', guolaoTrueSolarTime: 'true', doubingSu28: 2 }, display: { lifeMasterMode: 'dudegrade', minorLimitType: 'dongwei', motionState: true } },
	tianguan: { fields: { guolaoLifeMode: 'cotrans', guolaoBodyMode: 'taiyin', guolaoNodeType: 'true', guolaoTrueSolarTime: 'true', doubingSu28: 2 }, display: { lifeMasterMode: 'du', minorLimitType: '' } },
	huujiao: { fields: { guolaoLifeMode: 'asc', guolaoBodyMode: 'taiyin', guolaoNodeType: 'true', guolaoTrueSolarTime: 'true', doubingSu28: 5 }, display: { lifeMasterMode: 'gong', minorLimitType: '', motionState: true } },
};

// G34 流派预设匹配(纯函数,单一真值源;供左栏「流派预设」下拉派生「当前流派」+ jest 守卫)。
// 入参:已解析的类A字段值 f(guolaoLifeMode/guolaoBodyMode/guolaoTrueSolarTime/guolaoNodeType/doubingSu28)
// 与类B显示值 d(lifeMasterMode/minorLimitType/motionState)。当前配置恰好命中某预设定义的「全部键值」→ 回该预设键;
// 否则 'custom'(帮助文档「选后即显所选流派,微调后回自定」的诚实语义)。各预设键值组合互斥,故至多命中一个。
// 预设只定义部分键(如 qintang 不设 motionState)——匹配只校验预设自身声明的键,其余键不参与(agnostic)。
export function matchSchoolPreset(f, d){
	const ff = f || {};
	const dd = d || {};
	const cur = {
		guolaoLifeMode: normalizeGuolaoLifeMode(ff.guolaoLifeMode),
		guolaoBodyMode: ff.guolaoBodyMode,
		guolaoTrueSolarTime: ff.guolaoTrueSolarTime,
		guolaoNodeType: ff.guolaoNodeType,
		doubingSu28: Number(ff.doubingSu28),
	};
	const dcur = {
		lifeMasterMode: dd.lifeMasterMode || 'gong',
		minorLimitType: dd.minorLimitType || '',
		motionState: !!dd.motionState,
	};
	const keys = Object.keys(GUOLAO_SCHOOL_PRESETS);
	for(let i = 0; i < keys.length; i++){
		const p = GUOLAO_SCHOOL_PRESETS[keys[i]];
		const pf = p.fields || {};
		const pd = p.display || {};
		let hit = true;
		Object.keys(pf).forEach((k)=>{
			const want = k === 'doubingSu28' ? Number(pf[k]) : `${pf[k]}`;
			const got = k === 'doubingSu28' ? cur.doubingSu28 : `${cur[k]}`;
			if(want !== got){ hit = false; }
		});
		Object.keys(pd).forEach((k)=>{
			const want = k === 'motionState' ? !!pd[k] : `${pd[k]}`;
			const got = k === 'motionState' ? dcur.motionState : `${dcur[k]}`;
			if(want !== got){ hit = false; }
		});
		if(hit){ return keys[i]; }
	}
	return 'custom';
}

// G20 身宫法:taiyin=太阴落宫(果老,默认零回归)/youjin=逢酉(琴堂)。类A(进 moira params,QizhengMoira 重算身宫/格局)。
export const GUOLAO_BODY_MODE_KEY = 'horosaGuolaoBodyMode';
export function getStoredGuolaoBodyMode(){
	return normalizeGuolaoBodyMode(readItem(GUOLAO_BODY_MODE_KEY));
}
export function setStoredGuolaoBodyMode(val){
	const v = normalizeGuolaoBodyMode(val);
	writeItem(GUOLAO_BODY_MODE_KEY, v);
	return v;
}

// G15 sunrise 命度法 已并入 guolaoLifeMode(asc/yumao/cotrans/sunrise);此处仅身宫法独立键。

export function getStoredMoiraTransitGodsVisible(){
	// 流年神煞圈恒开(开关已下线;half 单盘布局保留在代码中,当前不可达)。
	return true;
}

export function setStoredMoiraTransitGodsVisible(visible){
	const next = visible !== false;
	writeItem(GUOLAO_MOIRA_TRANSIT_GODS_KEY, next ? '1' : '0');
	return next;
}

// 命盘轮显示偏好（纯前端、即时联动、不触发后端重取）
export const GUOLAO_DISPLAY_KEY = 'horosaGuolaoDisplay';
export const GUOLAO_ALL_ASPECTS = ['會', '衝', '刑', '合', '半合', '半刑', '四合'];
// lifeMasterMode 命主取法(gong宫主默认/du度主);minorLimitType 行运法(''古度默认/dongwei洞微/xiaoxian小限/yuexian月限/tongxian童限);
// motionState 留伏迟疾 / mingGan 五虎遁配干 / huayao 化曜圈 / dignityExtended 庙旺扩展多选 —— 均类B 纯前端显示偏好。
export const GUOLAO_LIFE_MASTER_MODES = ['gong', 'du', 'dudegrade'];
export const GUOLAO_MINOR_LIMIT_TYPES = ['', 'minor', 'month', 'tong', 'dongwei'];
export const GUOLAO_DIGNITY_EXT_KEYS = ['exalt', 'triplicity', 'term', 'face'];
export const GUOLAO_TONGXIAN_BASES = ['tong10', 'gu9', 'xu11'];   // 童限基数(类B):tong10通行十年默认/gu9古九岁/xu11虚十一
// 🔴 Moira 设置项(类B 纯前端重绘,均照 Moira TimeDialog):
//  定童限 child_period —— 9 九年起(默认)/ 10 十年起(童限年数 base)。
//  大限年界 —— gregorian 公历元旦(Moira 硬编码默认)/ lichun 立春 / dongzhi 冬至(birthFrac 基准;后二者=超 Moira 增强项)。
export const GUOLAO_LIMIT_CHILD_BASES = [9, 10];
export const GUOLAO_LIMIT_YEAR_BOUNDARIES = ['gregorian', 'lichun', 'dongzhi'];
export const GUOLAO_DEFAULT_DISPLAY = {
	aspects: ['會', '衝', '刑', '合', '半合'],
	dignity: true,
	mountains: false,
	birthGods: true,
	ageRing: true,
	lifeMasterMode: 'gong',
	minorLimitType: '',
	motionState: false,
	mingGan: false,
	huayao: false,
	dignityExtended: [],
	tongxianBase: 'tong10',
	limitChildBase: 9,          // 定童限:9 九年起(默认)/ 10 十年起
	limitYearBoundary: 'gregorian', // 大限年界:gregorian 公历元旦(Moira 默认)/ lichun 立春 / dongzhi 冬至
	// 星曜/神煞可见性与相位容许度(对照 Moira PlanetDialog/AspectDialog;类B纯重绘):
	// 隐藏名单语义——空数组=全部显示(默认零变化);aspectOrbs 空对象=用内置默认 orb。
	hiddenPlanets: [],
	hiddenGodsBirth: [],
	hiddenGodsTransit: [],
	tenGodSeq: 'org',
	showAspects: false,
	aspectOrbs: {},
	showAzimuth: false,
};

function normHiddenList(v){
	return Array.isArray(v) ? v.filter((x)=>typeof x === 'string' && x).slice(0, 128) : [];
}

function normAspectOrbs(v){
	if(!v || typeof v !== 'object'){
		return {};
	}
	const out = {};
	Object.keys(v).forEach((key)=>{
		const num = Number(v[key]);
		if(Number.isFinite(num) && num >= 0 && num <= 30){
			out[key] = num;
		}
	});
	return out;
}

function normLifeMasterMode(v){ return GUOLAO_LIFE_MASTER_MODES.indexOf(v) >= 0 ? v : 'gong'; }
function normMinorLimitType(v){ return GUOLAO_MINOR_LIMIT_TYPES.indexOf(v) >= 0 ? v : ''; }
function normDignityExt(v){ return Array.isArray(v) ? v.filter((k)=>GUOLAO_DIGNITY_EXT_KEYS.indexOf(k) >= 0) : []; }
function normTongxianBase(v){ return GUOLAO_TONGXIAN_BASES.indexOf(v) >= 0 ? v : 'tong10'; }
function normLimitChildBase(v){ return Number(v) === 10 ? 10 : 9; }
function normLimitYearBoundary(v){ return GUOLAO_LIMIT_YEAR_BOUNDARIES.indexOf(v) >= 0 ? v : 'gregorian'; }

function cloneDefaultDisplay(){
	return {
		aspects: [...GUOLAO_DEFAULT_DISPLAY.aspects],
		dignity: GUOLAO_DEFAULT_DISPLAY.dignity,
		mountains: GUOLAO_DEFAULT_DISPLAY.mountains,
		birthGods: GUOLAO_DEFAULT_DISPLAY.birthGods,
		ageRing: GUOLAO_DEFAULT_DISPLAY.ageRing,
		lifeMasterMode: GUOLAO_DEFAULT_DISPLAY.lifeMasterMode,
		minorLimitType: GUOLAO_DEFAULT_DISPLAY.minorLimitType,
		motionState: GUOLAO_DEFAULT_DISPLAY.motionState,
		mingGan: GUOLAO_DEFAULT_DISPLAY.mingGan,
		huayao: GUOLAO_DEFAULT_DISPLAY.huayao,
		dignityExtended: [...GUOLAO_DEFAULT_DISPLAY.dignityExtended],
		tongxianBase: GUOLAO_DEFAULT_DISPLAY.tongxianBase,
		limitChildBase: GUOLAO_DEFAULT_DISPLAY.limitChildBase,
		limitYearBoundary: GUOLAO_DEFAULT_DISPLAY.limitYearBoundary,
		hiddenPlanets: [],
		hiddenGodsBirth: [],
		hiddenGodsTransit: [],
		tenGodSeq: 'org',
		showAspects: false,
		aspectOrbs: {},
		showAzimuth: false,
	};
}

export function getStoredGuolaoDisplay(){
	const raw = readItem(GUOLAO_DISPLAY_KEY);
	if(!raw){
		return cloneDefaultDisplay();
	}
	try{
		const parsed = JSON.parse(raw) || {};
		return {
			aspects: Array.isArray(parsed.aspects)
				? parsed.aspects.filter((a)=>GUOLAO_ALL_ASPECTS.indexOf(a) >= 0)
				: [...GUOLAO_DEFAULT_DISPLAY.aspects],
			dignity: parsed.dignity !== false,
			mountains: parsed.mountains === true,
			// 神煞圈/年龄环恒开(开关已下线,Moira 几何恒定;忽略历史残留关闭态)
			birthGods: true,
			ageRing: true,
			lifeMasterMode: normLifeMasterMode(parsed.lifeMasterMode),
			minorLimitType: normMinorLimitType(parsed.minorLimitType),
			motionState: parsed.motionState === true,
			mingGan: parsed.mingGan === true,
			huayao: parsed.huayao === true,
			dignityExtended: normDignityExt(parsed.dignityExtended),
			tongxianBase: normTongxianBase(parsed.tongxianBase),
			limitChildBase: normLimitChildBase(parsed.limitChildBase),
			limitYearBoundary: normLimitYearBoundary(parsed.limitYearBoundary),
			hiddenPlanets: normHiddenList(parsed.hiddenPlanets),
			// 本命/流年神煞名单独立(旧版单名单 hiddenGods 自动迁移到两边)
			hiddenGodsBirth: normHiddenList(parsed.hiddenGodsBirth !== undefined ? parsed.hiddenGodsBirth : parsed.hiddenGods),
			hiddenGodsTransit: normHiddenList(parsed.hiddenGodsTransit !== undefined ? parsed.hiddenGodsTransit : parsed.hiddenGods),
			tenGodSeq: parsed.tenGodSeq === 'alt' ? 'alt' : 'org',
			showAspects: parsed.showAspects === true,
			aspectOrbs: normAspectOrbs(parsed.aspectOrbs),
			showAzimuth: parsed.showAzimuth === true,
		};
	}catch(e){
		return cloneDefaultDisplay();
	}
}

export function setStoredGuolaoDisplay(next){
	const safe = {
		aspects: Array.isArray(next && next.aspects)
			? next.aspects.filter((a)=>GUOLAO_ALL_ASPECTS.indexOf(a) >= 0)
			: [...GUOLAO_DEFAULT_DISPLAY.aspects],
		dignity: !(next && next.dignity === false),
		mountains: !!(next && next.mountains === true),
		birthGods: true,
		ageRing: true,
		lifeMasterMode: normLifeMasterMode(next && next.lifeMasterMode),
		minorLimitType: normMinorLimitType(next && next.minorLimitType),
		motionState: !!(next && next.motionState === true),
		mingGan: !!(next && next.mingGan === true),
		huayao: !!(next && next.huayao === true),
		dignityExtended: normDignityExt(next && next.dignityExtended),
		tongxianBase: normTongxianBase(next && next.tongxianBase),
		limitChildBase: normLimitChildBase(next && next.limitChildBase),
		limitYearBoundary: normLimitYearBoundary(next && next.limitYearBoundary),
		hiddenPlanets: normHiddenList(next && next.hiddenPlanets),
		hiddenGodsBirth: normHiddenList(next && next.hiddenGodsBirth),
		hiddenGodsTransit: normHiddenList(next && next.hiddenGodsTransit),
		tenGodSeq: (next && next.tenGodSeq === 'alt') ? 'alt' : 'org',
		showAspects: !!(next && next.showAspects === true),
		aspectOrbs: normAspectOrbs(next && next.aspectOrbs),
		showAzimuth: !!(next && next.showAzimuth === true),
	};
	writeItem(GUOLAO_DISPLAY_KEY, JSON.stringify(safe));
	return safe;
}

// ── 天星择日双轮(pick 盘式)选项:类B 纯重绘 blob + 类A 立命时刻单键 ──
export const GUOLAO_ELECTION_KEY = 'horosaGuolaoElection';
export const GUOLAO_ELECTION_DEFAULT = {
	dynMode: 'horizon',        // horizon 地平动盘 | quick 黄道动盘
	hsys: 'P',                 // 黄道动盘分宫制 P/K/O/R/C/A/V/X/H/T/B
	degreeDisplay: 'mountain', // mountain 二十四山 | zodiac 十二宫
	ziZheng: 'true',           // true 正北 | magnetic 磁北
	alignNorth: true,          // 子正在下
	plate: 'di',               // 二十四山盘:tian 天盘 | di 地盘 | ren 人盘
	wuxing: 'main',            // main 正体五行 | combo 化合五行
	adjNorth: true,            // 自行修正磁偏(WMM 自动;false=手动磁北度数)
	magShiftManual: 0,         // 手动磁北度数(十进制,东偏+)
	zuoShanDeg: 0,             // 座山度数(罗盘方位 0-360)
	showCompass: true,         // 显示罗盘(指北针+十字)
};
const GUOLAO_ELECTION_HSYS = ['P', 'K', 'O', 'R', 'C', 'A', 'V', 'X', 'H', 'T', 'B'];

export function getStoredGuolaoElection(){
	const raw = readItem(GUOLAO_ELECTION_KEY);
	const def = { ...GUOLAO_ELECTION_DEFAULT };
	if(!raw){
		return def;
	}
	try{
		const p = JSON.parse(raw) || {};
		return {
			dynMode: p.dynMode === 'quick' ? 'quick' : 'horizon',
			hsys: GUOLAO_ELECTION_HSYS.indexOf(p.hsys) >= 0 ? p.hsys : 'P',
			degreeDisplay: p.degreeDisplay === 'zodiac' ? 'zodiac' : 'mountain',
			ziZheng: p.ziZheng === 'magnetic' ? 'magnetic' : 'true',
			alignNorth: p.alignNorth !== false,
			plate: (p.plate === 'tian' || p.plate === 'ren') ? p.plate : 'di',
			wuxing: p.wuxing === 'combo' ? 'combo' : 'main',
			adjNorth: p.adjNorth !== false,
			magShiftManual: Number.isFinite(Number(p.magShiftManual)) ? Number(p.magShiftManual) : 0,
			zuoShanDeg: Number.isFinite(Number(p.zuoShanDeg)) ? ((Number(p.zuoShanDeg) % 360) + 360) % 360 : 0,
			// 罗盘层恒显(开关已撤,用户钦定):无视历史存储恒 true,防旧 false 值无 UI 可恢复。
			showCompass: true,
		};
	}catch(e){
		return def;
	}
}

export function setStoredGuolaoElection(next){
	const cur = getStoredGuolaoElection();
	const merged = { ...cur, ...(next || {}) };
	const safe = {
		dynMode: merged.dynMode === 'quick' ? 'quick' : 'horizon',
		hsys: GUOLAO_ELECTION_HSYS.indexOf(merged.hsys) >= 0 ? merged.hsys : 'P',
		degreeDisplay: merged.degreeDisplay === 'zodiac' ? 'zodiac' : 'mountain',
		ziZheng: merged.ziZheng === 'magnetic' ? 'magnetic' : 'true',
		alignNorth: merged.alignNorth !== false,
		plate: (merged.plate === 'tian' || merged.plate === 'ren') ? merged.plate : 'di',
		wuxing: merged.wuxing === 'combo' ? 'combo' : 'main',
		adjNorth: merged.adjNorth !== false,
		magShiftManual: Number.isFinite(Number(merged.magShiftManual)) ? Number(merged.magShiftManual) : 0,
		zuoShanDeg: Number.isFinite(Number(merged.zuoShanDeg)) ? ((Number(merged.zuoShanDeg) % 360) + 360) % 360 : 0,
		showCompass: true,
	};
	writeItem(GUOLAO_ELECTION_KEY, JSON.stringify(safe));
	return safe;
}

// 立命时刻(类A,变更须重取择日数据):sunrise/noon/sunset/custom
export const GUOLAO_ELE_LIFE_MODE_KEY = 'horosaGuolaoEleLifeMode';
export function getStoredGuolaoEleLifeMode(){
	const v = readItem(GUOLAO_ELE_LIFE_MODE_KEY);
	return ['sunrise', 'noon', 'sunset', 'custom'].indexOf(v) >= 0 ? v : 'sunrise';
}
export function setStoredGuolaoEleLifeMode(val){
	const v = ['sunrise', 'noon', 'sunset', 'custom'].indexOf(val) >= 0 ? val : 'sunrise';
	writeItem(GUOLAO_ELE_LIFE_MODE_KEY, v);
	return v;
}
