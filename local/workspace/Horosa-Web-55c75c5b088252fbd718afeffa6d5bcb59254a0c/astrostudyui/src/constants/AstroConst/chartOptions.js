// 宫制 / 岁差 / 黄道选择器与盘面显示选项(含印度盘式)
// 从 AstroConst.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { SIDEREAL } from './bodies';

export const HOUSE_SYSTEM_OPTIONS = [
    { value: 0, label: '整宫制' },
    { value: 1, label: 'Alcabitus' },
    { value: 2, label: 'Regiomontanus' },
    { value: 3, label: 'Placidus' },
    { value: 4, label: 'Koch' },
    { value: 5, label: 'Vehlow Equal' },
    { value: 6, label: 'Polich Page' },
    { value: 7, label: 'Sripati' },
    { value: 8, label: '天顶为10宫中点等宫制' },
    { value: 9, label: 'Porphyry' },
    { value: 10, label: 'Campanus' },
    { value: 11, label: 'Equal' },
    { value: 12, label: 'Equal MC' },
    { value: 13, label: 'Meridian' },
    { value: 14, label: 'Horizontal' },
    { value: 15, label: 'Morinus' },
    { value: 16, label: 'Carter Poli-Equatorial' },
    { value: 17, label: 'Sunshine' },
    { value: 18, label: 'Sunshine Alternate' },
    { value: 19, label: 'Krusinski-Pisa-Goelzer' },
    { value: 20, label: 'Pullen SD' },
    { value: 21, label: 'Pullen SR' },
    { value: 22, label: 'APC Houses' },
    { value: 23, label: 'Savard-A' },
    { value: 24, label: '福点整宫制' },
];

export const HouseSys = HOUSE_SYSTEM_OPTIONS.reduce((result, item)=>{
    result[`${item.value}`] = item.label;
    return result;
}, {});

export const INDIA_AYANAMSA_DEFAULT = 'lahiri';
export const INDIA_AYANAMSA_OPTIONS = [
    // A. 印度主流（Lahiri 族 + 现代）
    { value: 'lahiri', label: 'Lahiri / Chitrapaksha', group: '印度主流' },
    { value: 'lahiri_icrc', label: 'Lahiri ICRC（官定2022）', group: '印度主流' },
    { value: 'lahiri_1940', label: 'Lahiri 1940', group: '印度主流' },
    { value: 'lahiri_vp285', label: 'Lahiri VP285', group: '印度主流' },
    { value: 'raman', label: 'Raman', group: '印度主流' },
    { value: 'krishnamurti', label: 'Krishnamurti / KP', group: '印度主流' },
    { value: 'krishnamurti_vp291', label: 'KP-Senthilathiban (VP291)', group: '印度主流' },
    { value: 'yukteshwar', label: 'Yukteshwar', group: '印度主流' },
    { value: 'jn_bhasin', label: 'J.N. Bhasin', group: '印度主流' },
    { value: 'ushashashi', label: 'Usha/Shashi', group: '印度主流' },
    { value: 'deluce', label: 'De Luce', group: '印度主流' },
    // B. 真星定标 + 古典
    { value: 'true_citra', label: 'True Citra（角宿真星）', group: '真星·古典' },
    { value: 'true_revati', label: 'True Revati（娄宿真星）', group: '真星·古典' },
    { value: 'true_pushya', label: 'True Pushya / 普舍亚', group: '真星·古典' },
    { value: 'true_mula', label: 'True Mula（Chandra Hari）', group: '真星·古典' },
    { value: 'true_sheoran', label: 'Vedic / Sheoran', group: '真星·古典' },
    { value: 'ss_citra', label: 'SS Citra', group: '真星·古典' },
    { value: 'ss_revati', label: 'SS Revati', group: '真星·古典' },
    { value: 'suryasiddhanta', label: 'Surya Siddhanta', group: '真星·古典' },
    { value: 'suryasiddhanta_msun', label: 'Surya Siddhanta（mean Sun）', group: '真星·古典' },
    { value: 'aryabhata', label: 'Aryabhata', group: '真星·古典' },
    { value: 'aryabhata_msun', label: 'Aryabhata（mean Sun）', group: '真星·古典' },
    { value: 'aryabhata_522', label: 'Aryabhata 522', group: '真星·古典' },
    // C. 西占恒星黄道
    { value: 'fagan_bradley', label: 'Fagan/Bradley', group: '西占恒星' },
    { value: 'djwhal_khul', label: 'Djwhal Khul', group: '西占恒星' },
    { value: 'valens_moon', label: 'Vettius Valens', group: '西占恒星' },
    // D. 银道/银心
    { value: 'galcent_0sag', label: 'Galactic Center 0°Sag（银心）', group: '银道/银心' },
    { value: 'galcent_rgilbrand', label: 'Galactic Center（Gil Brand）', group: '银道/银心' },
    { value: 'galcent_mula_wilhelm', label: 'Galactic Center/Mula（Wilhelm）', group: '银道/银心' },
    { value: 'galcent_cochrane', label: 'Galactic Center（Cochrane）', group: '银道/银心' },
    { value: 'galequ_iau1958', label: 'Galactic Equator（IAU1958）', group: '银道/银心' },
    { value: 'galequ_true', label: 'Galactic Equator（true）', group: '银道/银心' },
    { value: 'galequ_mula', label: 'Galactic Equator（mid-Mula）', group: '银道/银心' },
    { value: 'galequ_fiorenza', label: 'Galactic Equator（Fiorenza）', group: '银道/银心' },
    { value: 'galalign_mardyks', label: 'Skydram（Mardyks）', group: '银道/银心' },
    // E. 历史/巴比伦 + 历元
    { value: 'hipparchos', label: 'Hipparchos', group: '历史/历元' },
    { value: 'sassanian', label: 'Sassanian', group: '历史/历元' },
    { value: 'aldebaran_15tau', label: 'Aldebaran 15°Tau', group: '历史/历元' },
    { value: 'babyl_kugler1', label: 'Babylonian/Kugler 1', group: '历史/历元' },
    { value: 'babyl_kugler2', label: 'Babylonian/Kugler 2', group: '历史/历元' },
    { value: 'babyl_kugler3', label: 'Babylonian/Kugler 3', group: '历史/历元' },
    { value: 'babyl_huber', label: 'Babylonian/Huber', group: '历史/历元' },
    { value: 'babyl_etpsc', label: 'Babylonian/Eta Piscium', group: '历史/历元' },
    { value: 'babyl_britton', label: 'Babylonian/Britton', group: '历史/历元' },
    { value: 'j2000', label: 'J2000', group: '历史/历元' },
    { value: 'j1900', label: 'J1900', group: '历史/历元' },
    { value: 'b1950', label: 'B1950', group: '历史/历元' },
];

export function normalizeIndiaAyanamsa(value){
    const found = INDIA_AYANAMSA_OPTIONS.find((item)=>item.value === value);
    return found ? found.value : INDIA_AYANAMSA_DEFAULT;
}

export const INDIA_HOUSE_SYSTEM_DEFAULT = 0;
export const INDIA_HOUSE_SYSTEM_OPTIONS = [
    // Vedic 常用
    { value: 0, label: '整宫制 Whole Sign', group: 'Vedic 常用' },
    { value: 5, label: '等宫·命起宫 Equal', group: 'Vedic 常用' },
    { value: 6, label: 'Vehlow 等宫·命居宫中', group: 'Vedic 常用' },
    { value: 7, label: 'Sripati（Bhāva Chalit）', group: 'Vedic 常用' },
    { value: 9, label: 'Porphyry 波菲', group: 'Vedic 常用' },
    { value: 3, label: 'KP / Placidus', group: 'Vedic 常用' },
    // 其他象限/等分制
    { value: 4, label: 'Koch', group: '其他象限/等分制' },
    { value: 10, label: 'Campanus', group: '其他象限/等分制' },
    { value: 2, label: 'Regiomontanus', group: '其他象限/等分制' },
    { value: 8, label: 'Alcabitus', group: '其他象限/等分制' },
    { value: 11, label: 'Morinus', group: '其他象限/等分制' },
    { value: 12, label: 'Meridian / Axial', group: '其他象限/等分制' },
    { value: 13, label: 'Polich-Page / Topocentric', group: '其他象限/等分制' },
    { value: 14, label: 'Equal MC', group: '其他象限/等分制' },
    { value: 15, label: 'Azimuthal / Horizon', group: '其他象限/等分制' },
    { value: 16, label: 'Carter Poli-Equatorial', group: '其他象限/等分制' },
    { value: 17, label: 'Sunshine', group: '其他象限/等分制' },
    { value: 18, label: 'Sunshine Alt', group: '其他象限/等分制' },
    { value: 19, label: 'Krusinski', group: '其他象限/等分制' },
    { value: 20, label: 'Pullen SD', group: '其他象限/等分制' },
    { value: 21, label: 'Pullen SR', group: '其他象限/等分制' },
    { value: 22, label: 'APC Houses', group: '其他象限/等分制' },
    { value: 23, label: 'Savard-A', group: '其他象限/等分制' },
    { value: 24, label: 'Equal 2', group: '其他象限/等分制' },
];

export function normalizeIndiaHouseSystem(value){
    const numeric = Number(value);
    const found = INDIA_HOUSE_SYSTEM_OPTIONS.find((item)=>item.value === numeric);
    return found ? found.value : INDIA_HOUSE_SYSTEM_DEFAULT;
}

// 按 options 的 group 字段分组(保持首见顺序)，供 antd Select 的 OptGroup 渲染。
export function groupOptions(options){
    const order = [];
    const map = {};
    (options || []).forEach((item)=>{
        const g = item.group || '';
        if(!(g in map)){ map[g] = []; order.push(g); }
        map[g].push(item);
    });
    return order.map((g)=>({ group: g, items: map[g] }));
}

// ===== 通用「黄道」选择器(回归黄道 + 恒星黄道·全 47 ayanāṃśa) =====
// 复合值编码:'tropical' | 'sidereal:<ayanamsaKey>'。回归仍走 zodiacal=0、恒星走 zodiacal=1 + siderealAyanamsa,
// 向后兼容:旧的 zodiacal=1(无 ayanamsa)显示为 Lahiri(= Swiss Ephemeris 现默认)。
export const ZODIAC_SELECT_TROPICAL = 'tropical';
// 西洋盘「黄道」下拉的分组全量选项(回归黄道 + 恒星·各组 ayanāṃśa,复用 INDIA_AYANAMSA_OPTIONS)。
export function buildZodiacOptions(){
    const out = [{ value: ZODIAC_SELECT_TROPICAL, label: '回归黄道', group: '回归黄道' }];
    INDIA_AYANAMSA_OPTIONS.forEach((o)=>{
        out.push({ value: `sidereal:${o.value}`, label: o.label, group: `恒星·${o.group}` });
    });
    // 自定义恒星黄道:历元槽在「星盘设置 → 恒星与天象 → 自定义恒星黄道…」管理;
    // 未设当前槽时后端回落 Lahiri(不炸盘)。
    out.push({ value: 'sidereal:user', label: '自定义（历元槽位）', group: '恒星·自定义' });
    return out;
}
// (zodiacal, siderealAyanamsa) → 下拉当前值
export function zodiacSelectValue(zodiacal, ayan){
    if(Number(zodiacal) !== 1){ return ZODIAC_SELECT_TROPICAL; }
    return `sidereal:${ayan || 'lahiri'}`;
}
// 下拉值 → { zodiacal, siderealAyanamsa }
export function parseZodiacSelectValue(v){
    const s = `${v == null ? '' : v}`;
    if(s.indexOf('sidereal:') === 0){ return { zodiacal: 1, siderealAyanamsa: s.slice('sidereal:'.length) }; }
    if(s === 'sidereal' || s === '1'){ return { zodiacal: 1, siderealAyanamsa: 'lahiri' }; }
    return { zodiacal: 0, siderealAyanamsa: '' };
}
// nakshatra 宿主行星 英文→中文(与印占 DASHA_SEQUENCE label 一致),恒星黄道盘行星「月宿」栏用。
export const NAK_LORD_CN = {
    Ketu: '计都', Venus: '金星', Sun: '太阳', Moon: '月亮', Mars: '火星',
    Rahu: '罗睺', Jupiter: '木星', Saturn: '土星', Mercury: '水星',
};
// 由 ayanāṃśa key 取短标签(复用黄道下拉同款 INDIA_AYANAMSA_OPTIONS label)。无 key/未知返回原值。
export function ayanamsaLabel(key){
    if(!key){ return ''; }
    if(key === 'user'){ return '自定义（历元槽位）'; }   // AI 快照/显示层词条(否则出「恒星黄道·user」原始键)
    const hit = INDIA_AYANAMSA_OPTIONS.find((o)=>o.value === key);
    return hit ? hit.label : key;
}
// 黄道显示文案:回归黄道 / 恒星黄道·<ayan> / 恒星黄道(无具体岁差时)。统一显示+AI 快照口径,避免硬编码 Lahiri。
export function zodiacalDisplayText(zodiacalRaw, ayanKey){
    const isSid = zodiacalRaw === SIDEREAL || `${zodiacalRaw}` === '1' || zodiacalRaw === '恒星黄道';
    if(!isSid){ return '回归黄道'; }
    const lab = ayanamsaLabel(ayanKey);
    return lab ? `恒星黄道·${lab}` : '恒星黄道';
}

export const HSYS_Whole_Sign = 'Whole Sign';
export const HSYS_Alcabitus = 'Alcabitus';
export const HSYS_Regiomontanus = 'Regiomontanus';
export const HSYS_Placidus = 'Placidus';
export const HSYS_Koch = 'Koch';
export const HSYS_Vehlow_Equal = 'Vehlow Equal';
export const HSYS_PolichPage = 'Polich Page';
export const HSYS_Sripati = 'Sripati';
export const HSYS_Porphyry = 'Porphyrius';
export const HSYS_Campanus = 'Campanus';
export const HSYS_Equal = 'Equal';
export const HSYS_Equal_MC = 'Equal MC';
export const HSYS_Meridian = 'Meridian';
export const HSYS_Horizontal = 'Azimuthal';
export const HSYS_Morinus = 'Morinus';
export const HSYS_Carter_Poli_Equatorial = 'Carter Poli-Equatorial';
export const HSYS_Sunshine = 'Sunshine';
export const HSYS_Sunshine_Alt = 'Sunshine Alternate';
export const HSYS_Krusinski = 'Krusinski-Pisa-Goelzer';
export const HSYS_Pullen_SD = 'Pullen SD';
export const HSYS_Pullen_SR = 'Pullen SR';
export const HSYS_APC = 'APC Houses';
export const HSYS_Savard_A = 'Savard-A';
export const HSYS_Fortuna_Whole = 'Fortuna_Whole';

export const STAR_ALGENIB = 'Algenib'
export const STAR_ALPHERATZ = 'Alpheratz'
export const STAR_ZAUR = 'Zaur'
export const STAR_ALGOL = 'Algol'
export const STAR_ALCYONE = 'Alcyone'
export const STAR_ALDEBARAN = 'Aldebaran'
export const STAR_RIGEL = 'Rigel'
export const STAR_CAPELLA = 'Capella'
export const STAR_BETELGEUSE = 'Betelgeuse'
export const STAR_SIRIUS = 'Sirius'
export const STAR_CANOPUS = 'Canopus'
export const STAR_CASTOR = 'Castor'
export const STAR_POLLUX = 'Pollux'
export const STAR_PROCYON = 'Procyon'
export const STAR_ASELLUS_BOREALIS = 'Asellus Borealis'
export const STAR_ASELLUS_AUSTRALIS = 'Asellus Australis'
export const STAR_ALPHARD = 'Alphard'
export const STAR_REGULUS = 'Regulus'
export const STAR_DENEBOLA = 'Denebola'
export const STAR_ALGORAB = 'Algorab'
export const STAR_SPICA = 'Spica'
export const STAR_ARCTURUS = 'Arcturus'
export const STAR_ALPHECCA = 'Alphecca'
export const STAR_ZUBEN_ELGENUBI = 'Zuben Elgenubi'
export const STAR_ZUBEN_ELSCHEMALI = 'Zuben Eshamali'
export const STAR_UNUKALHAI = 'Unukalhai'
export const STAR_AGENA = 'Agena'
export const STAR_RIGEL_CENTAURUS = 'Rigel Kentaurus'
export const STAR_ANTARES = 'Antares'
export const STAR_LESATH = 'Lesath'
export const STAR_VEGA = 'Vega'
export const STAR_ALTAIR = 'Altair'
export const STAR_DENEB_ALGEDI = 'Deneb Algedi'
export const STAR_FOMALHAUT = 'Fomalhaut'
export const STAR_DENEB_ADIGE = 'Deneb'  // Alpha-Cygnus
export const STAR_ACHERNAR = 'Achernar'

export const CHART_PLANETS = 1;
export const CHART_ASP_LINES = 2;
export const CHART_SU27 = 4;
export const CHART_TRIP = 8;
export const CHART_PLANETCOLORWITHSIGN = 16;
export const CHART_HOUSEDEGREE = 32;
export const CHART_INFOINCIRCLE = 64;
export const CHART_ANGLELINE = 128;
export const CHART_TXTPLANETFORWARD = 256;
export const CHART_SIGNRULER = 512;
export const CHART_TERM = 1024;
export const CHART_OUTERDEG = 2048;
export const CHART_INNERDEG = 4096;
export const CHART_TXTPLANET = 8192;
export const CHART_THREEPLANETASP = 16384;
export const CHART_SU28_TEXT = 32768;
export const CHART_3D_SKYBALL_LATLINE = 65536;
export const CHART_3D_EARTH_LATLINE = 131072;
export const CHART_3D_EARTH_LONLINE = 262144;
export const CHART_3D_EARTH_RADIUS_SAMESKY = 524288;
export const CHART_3D_EARTH = 1048576;
export const CHART_3D_PLANET_SYM = 2097152;
// 盘面增强四位:角宫三元组徽/盘心行星时·日主星/盘心赤经上升/符号盘(隐度数)。
export const CHART_ANGULAR_TRIAD = 4194304;
export const CHART_CENTER_HOURS = 8388608;
export const CHART_CENTER_RAMC = 16777216;
export const CHART_GLYPH_ONLY = 33554432;
export const CHART_OPTIONS = [
    CHART_PLANETS, 
    CHART_ASP_LINES, 
    CHART_SU27,
    CHART_TRIP,
    CHART_PLANETCOLORWITHSIGN,
    CHART_HOUSEDEGREE,
    CHART_INFOINCIRCLE,
    CHART_ANGLELINE,
    CHART_TXTPLANET,
    CHART_TXTPLANETFORWARD,
    CHART_SIGNRULER,
    CHART_TERM,
    CHART_OUTERDEG,
    CHART_INNERDEG,
    CHART_THREEPLANETASP,
    CHART_SU28_TEXT,
    CHART_3D_SKYBALL_LATLINE,
    CHART_3D_EARTH_LATLINE,
    CHART_3D_EARTH_LONLINE,
    CHART_3D_EARTH_RADIUS_SAMESKY,
    CHART_3D_EARTH,
    CHART_3D_PLANET_SYM,
    CHART_ANGULAR_TRIAD,
    CHART_CENTER_HOURS,
    CHART_CENTER_RAMC,
    CHART_GLYPH_ONLY
];
export const CHART_DEFAULTOPTS = [
    CHART_PLANETS, 
    CHART_ASP_LINES,
    CHART_PLANETCOLORWITHSIGN,
    CHART_HOUSEDEGREE,
    CHART_ANGLELINE,
    CHART_TXTPLANET,
    CHART_TXTPLANETFORWARD
];

export const CHART_STYLE_CURRENT = 'current';
export const CHART_STYLE_ORIGINAL = 'original';

export const CHART_STYLE_OPTIONS = [
    { value: CHART_STYLE_CURRENT, label: '清简' },
    { value: CHART_STYLE_ORIGINAL, label: '经典' },
];

export function normalizeChartStyle(value){
    const found = CHART_STYLE_OPTIONS.find((item)=>item.value === value);
    return found ? found.value : CHART_STYLE_CURRENT;
}

// 盘面美术(wheel art):西占各技法共用的盘体画法。classic=经典圆盘(现状唯一画法,恒缺省);
// 其余四档为方形覆盘(whole-sign 格盘):hellenistic 复用东印井字、northIndian/southIndian 复用印度盘几何、
// medieval 为独立排版(1/4/7/10 恒居内方形四边中点三角)。归一层缺省恒 classic —— 不传参调用方零字节漂移。
export const WHEEL_ART_CLASSIC = 'classic';
export const WHEEL_ART_HELLENISTIC = 'hellenistic';
export const WHEEL_ART_MEDIEVAL = 'medieval';
export const WHEEL_ART_NORTH_INDIAN = 'northIndian';
export const WHEEL_ART_SOUTH_INDIAN = 'southIndian';

export const WHEEL_ART_OPTIONS = [
    { value: WHEEL_ART_CLASSIC, label: '经典圆盘' },
    { value: WHEEL_ART_HELLENISTIC, label: '希腊盘' },
    { value: WHEEL_ART_MEDIEVAL, label: '中世纪盘' },
    { value: WHEEL_ART_NORTH_INDIAN, label: '北印度盘' },
    { value: WHEEL_ART_SOUTH_INDIAN, label: '南印度盘' },
];

export function normalizeWheelArt(value){
    const found = WHEEL_ART_OPTIONS.find((item)=>item.value === value);
    return found ? found.value : WHEEL_ART_CLASSIC;
}

export const INDIA_CHART_STYLE_NORTH = 'north';
export const INDIA_CHART_STYLE_SOUTH = 'south';
export const INDIA_CHART_STYLE_EAST = 'east';

export const INDIA_CHART_STYLE_OPTIONS = [
    { value: INDIA_CHART_STYLE_NORTH, label: '北印' },
    { value: INDIA_CHART_STYLE_SOUTH, label: '南印' },
    { value: INDIA_CHART_STYLE_EAST, label: '东印' },
];

export function normalizeIndiaChartStyle(value){
    const found = INDIA_CHART_STYLE_OPTIONS.find((item)=>item.value === value);
    return found ? found.value : INDIA_CHART_STYLE_SOUTH;
}
