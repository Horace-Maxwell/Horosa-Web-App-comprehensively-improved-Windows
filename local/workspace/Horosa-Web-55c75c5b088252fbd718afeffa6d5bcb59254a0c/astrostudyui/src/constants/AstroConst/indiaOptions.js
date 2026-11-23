// 印度占星页的流派、分盘、大运、问事等选项与缺省
// 从 AstroConst.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { SUN, MOON, MERCURY, VENUS, MARS, JUPITER, SATURN, NORTH_NODE, SOUTH_NODE } from './bodies';

// WP-B 上升宫位(第1宫)参照:默认上升;可选七政/虚点为第1宫(Chandra/Surya Lagna 等,§12.3)
// 或选 1-12 宫为第1宫(旋转宫号)。**纯显示重参照**(§1.6「只改显示参照,不改黄经」),零后端、零回归。
export const INDIA_LAGNA_REF_DEFAULT = 'asc';
export const INDIA_LAGNA_REF_OPTIONS = [
    { label: '默认', options: [{ value: 'asc', label: '上升 Lagna（默认）' }] },
    { label: '七政为第1宫', options: [
        { value: SUN, label: '太阳 Sūrya Lagna' },
        { value: MOON, label: '月亮 Chandra Lagna' },
        { value: MERCURY, label: '水星' },
        { value: VENUS, label: '金星' },
        { value: MARS, label: '火星' },
        { value: JUPITER, label: '木星' },
        { value: SATURN, label: '土星' },
    ] },
    { label: '虚点为第1宫', options: [
        { value: NORTH_NODE, label: '罗睺 Rahu' },
        { value: SOUTH_NODE, label: '计都 Ketu' },
    ] },
    { label: '宫位为第1宫', options: Array.from({ length: 12 }, (_, i)=>({ value: `house${i + 1}`, label: `第${i + 1}宫` })) },
];
export function normalizeIndiaLagnaRef(value){
    if(value === INDIA_LAGNA_REF_DEFAULT){ return INDIA_LAGNA_REF_DEFAULT; }
    const flat = INDIA_LAGNA_REF_OPTIONS.reduce((acc, g)=>acc.concat(g.options.map((o)=>o.value)), []);
    return flat.indexOf(value) >= 0 ? value : INDIA_LAGNA_REF_DEFAULT;
}

// WP-C 星体显示:文字(Su/Mo…默认)↔ 符号(ywastrochart glyph)。纯显示层,零请求(§1.6)。
export const INDIA_PLANET_DISPLAY_TEXT = 'text';
export const INDIA_PLANET_DISPLAY_GLYPH = 'glyph';
export const INDIA_PLANET_DISPLAY_OPTIONS = [
    { value: INDIA_PLANET_DISPLAY_TEXT, label: '文字' },
    { value: INDIA_PLANET_DISPLAY_GLYPH, label: '符号' },
];
export function normalizeIndiaPlanetDisplay(value){
    return value === INDIA_PLANET_DISPLAY_GLYPH ? INDIA_PLANET_DISPLAY_GLYPH : INDIA_PLANET_DISPLAY_TEXT;
}

// 罗睺/计都交点口径:'mean'(平交点,默认零回归)/ 'true'(真交点)。
export const INDIA_NODE_TYPE_DEFAULT = 'mean';
export const INDIA_NODE_TYPE_OPTIONS = [
    { value: 'mean', label: '平交点' },
    { value: 'true', label: '真交点' },
];

export function normalizeIndiaNodeType(value){
    return value === 'true' ? 'true' : INDIA_NODE_TYPE_DEFAULT;
}

// 印度占星五大流派(预设包·软联动):切派写默认岁差/宫制/相位范式 + 可见右栏 tab 子集,
// 但用户仍可单独覆盖(软联动);默认 parashari = 现状零行为差异。tab key 见 13 TabPane(1-13)。
export const INDIA_SCHOOL_DEFAULT = 'parashari';
export const INDIA_SCHOOL_OPTIONS = [
    { value: 'parashari', label: 'Parāśarī 帕拉萨拉(默认)' },
    { value: 'jaimini', label: 'Jaimini 贾米尼' },
    { value: 'tajika', label: 'Tājika 塔吉卡(年盘)' },
    { value: 'kp', label: 'KP 系统' },
    { value: 'nadi', label: 'Nāḍī 纳迪' },
    { value: 'western_sidereal', label: 'Western Sidereal 西方恒星(对照)' },
];
// ── 大运年长(§10.1.5 五档;默认 365.25 儒略与既有输出字节一致)──
export const INDIA_DASHA_YEAR_OPTIONS = [
    { value: 365.25, label: '365.25 儒略年(默认)' },
    { value: 365.2425, label: '365.2425 格里年' },
    { value: 360, label: '360 Savana 年' },
    { value: 365.2422, label: '365.2422 回归年' },
    { value: 365.2563, label: '365.2563 恒星年' },
];
export const INDIA_DASHA_YEAR_DEFAULT = 365.25;
export function normalizeIndiaDashaYear(value){
    const v = Number(value);
    return INDIA_DASHA_YEAR_OPTIONS.some((o)=>Math.abs(o.value - v) < 1e-6) ? v : INDIA_DASHA_YEAR_DEFAULT;
}

// ── 宿数口径(27 默认 / 28 含 Abhijit)。🔴 纯显示/择吉层:不进请求、不进缓存键;
//    Vimshottari/月宿起运/D9/Pada/Tara 恒按 27 宿(权威 §4.3 铁律,引擎同口径)。──
export const INDIA_NAKSHATRA_COUNT_OPTIONS = [
    { value: 27, label: '27 宿(标准)' },
    { value: 28, label: '28 宿(含牛宿 Abhijit)' },
];
export const INDIA_NAKSHATRA_COUNT_DEFAULT = 27;
export function normalizeIndiaNakshatraCount(value){
    return Number(value) === 28 ? 28 : 27;
}

// ── 年盘口径(§15.3):太阳返照(默认零回归)/ 阴历返照 Tithi Pravesh(取最接近生日之回归)──
export const INDIA_ANNUAL_CHART_TYPE_OPTIONS = [
    { value: 'varsha', label: '太阳返照 Varṣa' },
    { value: 'tithi', label: '阴历返照 Tithi Praveśa' },
];
export const INDIA_ANNUAL_CHART_TYPE_DEFAULT = 'varsha';
export function normalizeIndiaAnnualChartType(value){
    return value === 'tithi' ? 'tithi' : 'varsha';
}

// [Windows #80] 挂载分盘可选集单一真值源:挂载齿轮的「挂载分盘」与「附加分盘」两处选项、
//   以及附加分盘简表的段内小标题都读它 —— 免得 D 序号与中文名在三处各写各的。
//   类象译名与印度页分盘页签 / 分盘集网格同一套(此前这里另写一套,D9 写「婚姻」、页面写「合作」,AI 快照用的是这套)
export const INDIA_MOUNT_VARGA_OPTIONS = [
    { value: 1, label: 'D1 命盘' }, { value: 2, label: 'D2 财产' }, { value: 3, label: 'D3 兄妹' },
    { value: 4, label: 'D4 资质' }, { value: 7, label: 'D7 子嗣' }, { value: 9, label: 'D9 合作' },
    { value: 10, label: 'D10 事业' }, { value: 12, label: 'D12 父辈' }, { value: 16, label: 'D16 座驾' },
    { value: 20, label: 'D20 灵魂' }, { value: 24, label: 'D24 教育' }, { value: 27, label: 'D27 生命' },
    { value: 30, label: 'D30 厄运' }, { value: 40, label: 'D40 母系' }, { value: 45, label: 'D45 父系' },
    { value: 60, label: 'D60 业力' },
];
export function indiaMountVargaLabel(chartnum){
    const n = parseInt(chartnum, 10);
    if(Number.isNaN(n) || n <= 0){ return ''; }
    const hit = INDIA_MOUNT_VARGA_OPTIONS.find((o)=>o.value === n);
    return hit ? hit.label : `D${n}`;
}
// 附加分盘:主盘之外再挂几张分盘的简表。上限 4 张(与 indiaVargaSet 同口径),
// 去重并剔除主盘自身由调用方做(此处只做值域与数量归一)。空数组 = 现状零回归。
export const INDIA_MOUNT_EXTRA_VARGA_MAX = 4;
export function normalizeIndiaExtraVargas(value){
    let raw = value;
    if(typeof raw === 'string'){
        raw = raw.trim() ? raw.split(/[,，\s]+/) : [];
    }
    if(!Array.isArray(raw)){ return []; }
    const out = [];
    raw.forEach((item)=>{
        const n = parseInt(item, 10);
        if(Number.isNaN(n) || n <= 1){ return; }
        if(!INDIA_MOUNT_VARGA_OPTIONS.some((o)=>o.value === n)){ return; }
        if(out.indexOf(n) >= 0){ return; }
        if(out.length >= INDIA_MOUNT_EXTRA_VARGA_MAX){ return; }
        out.push(n);
    });
    return out;
}

// ── W1-A 分盘变体(仅列引擎已实现集合,与后端 VARGA_VARIANT_CHOICES 锁死同构;
//    默认全 standard = 零下发零回归。label 与引擎对照卡同名)──
export const INDIA_VARGA_VARIANT_CHARTS = [
    { chartnum: 2, key: 'd2', label: 'D2 Horā 二分盘', options: [
        { value: 'standard', label: '标准 Parāśara' },
        { value: 'parivritti', label: 'Parivṛtti 循环' },
        { value: 'kashinatha', label: 'Kāśīnātha 财富·依主星' },
    ] },
    { chartnum: 3, key: 'd3', label: 'D3 Drekkāṇa 三分盘', options: [
        { value: 'standard', label: '标准 Parāśara' },
        { value: 'parivritti', label: 'Parivṛtti 循环' },
        { value: 'jagannatha', label: 'Jagannātha' },
        { value: 'somanatha', label: 'Somanātha 奇顺偶逆' },
    ] },
    { chartnum: 5, key: 'd5', label: 'D5 Pañcāṃśa 五分盘', options: [
        { value: 'standard', label: '标准 奇白羊偶天秤' },
        { value: 'parashara', label: 'Parāśara 主星序' },
    ] },
    { chartnum: 11, key: 'd11', label: 'D11 Rudrāṃśa 十一分盘', options: [
        { value: 'standard', label: '标准 动定双起' },
        { value: 'cyclic', label: '连续循环' },
    ] },
    { chartnum: 24, key: 'd24', label: 'D24 Siddhāṃśa 廿四分盘', options: [
        { value: 'standard', label: '标准' },
        { value: 'correct', label: 'Narasiṃha 偶座逆' },
    ] },
    { chartnum: 30, key: 'd30', label: 'D30 Triṃśāṃśa 卅分盘', options: [
        { value: 'standard', label: '标准 不等分' },
        { value: 'equal', label: '等分 1°' },
    ] },
];
export function normalizeIndiaVargaVariantMap(value){
    // dict/JSON 串双收;只留合法非 standard 项 → {} = 默认。
    let raw = value;
    if(typeof raw === 'string'){
        try{ raw = JSON.parse(raw); }catch(e){ return {}; }
    }
    if(!raw || typeof raw !== 'object' || Array.isArray(raw)){ return {}; }
    const out = {};
    INDIA_VARGA_VARIANT_CHARTS.forEach((c)=>{
        const v = raw[String(c.chartnum)] !== undefined ? raw[String(c.chartnum)] : raw[c.chartnum];
        if(v && v !== 'standard' && c.options.some((o)=>o.value === v)){
            out[String(c.chartnum)] = v;
        }
    });
    return out;
}

// ── W1-B Chara Kāraka 方案:8(默认,含罗睺)/7(古典) ──
export const INDIA_KARAKA_SCHEME_DEFAULT = '8';
export const INDIA_KARAKA_SCHEME_OPTIONS = [
    { value: '8', label: '8 卡拉卡（默认·含罗睺）' },
    { value: '7', label: '7 卡拉卡（古典·无罗睺）' },
];
export function normalizeIndiaKarakaScheme(value){
    return String(value) === '7' ? '7' : '8';
}

// ── W1-C 星曜战判据:latitude(默认,纬北者胜)/longitude(黄经小者胜) ──
export const INDIA_YUDDHA_CRITERION_DEFAULT = 'latitude';
export const INDIA_YUDDHA_CRITERION_OPTIONS = [
    { value: 'latitude', label: '纬度更北者胜（默认）' },
    { value: 'longitude', label: '黄经较小者胜' },
];
export function normalizeIndiaYuddhaCriterion(value){
    return value === 'longitude' ? 'longitude' : 'latitude';
}

// ── 中栏盘面模式:single(既有三盘式,默认)/ sbc 全吉盘 / tripataki 三旗盘。
//    纯前端渲染选择,不进请求参数(三旗数据 opt-in 由其面板按钮控制)。──
export const INDIA_STAGE_MODE_OPTIONS = [
    { value: 'single', label: '本命盘(北/南/东)' },
    { value: 'sbc', label: '全吉盘 SBC(28 宿方阵)' },
    { value: 'tripataki', label: '三旗盘 Tri-patākī' },
];
export const INDIA_STAGE_MODE_DEFAULT = 'single';
export function normalizeIndiaStageMode(value){
    return INDIA_STAGE_MODE_OPTIONS.some((o)=>o.value === value) ? value : INDIA_STAGE_MODE_DEFAULT;
}

// ── 问事 Praśna(§12.7/§25.1/§25.2)──
export const INDIA_PRASHNA_MATTER_OPTIONS = [
    { value: 'marriage', label: '婚姻(2/7/11)' },
    { value: 'wealth', label: '财务(2/6/10/11)' },
    { value: 'children', label: '子女(2/5/11)' },
    { value: 'career', label: '事业(2/6/10/11)' },
    { value: 'illness', label: '疾病(6/8/12)' },
    { value: 'travel', label: '外出(3/9/12)' },
    { value: 'general', label: '通用(不裁决)' },
];
export const INDIA_PRASHNA_MATTER_DEFAULT = 'general';
export function normalizeIndiaPrashnaMatter(value){
    return INDIA_PRASHNA_MATTER_OPTIONS.some((o)=>o.value === value) ? value : INDIA_PRASHNA_MATTER_DEFAULT;
}
// 宫始定法:asc_driven(默认,几何自洽)/ time_placidus(权威字面,给失配度)。
// equal_from_asc 仅极地降级,不入可选项(引擎自动降并注明)。
export const INDIA_PRASHNA_CUSP_MODE_OPTIONS = [
    { value: 'asc_driven_placidus', label: '上升反解 Placidus(默认)' },
    { value: 'time_placidus', label: '问时 Placidus(字面口径)' },
];
export const INDIA_PRASHNA_CUSP_MODE_DEFAULT = 'asc_driven_placidus';
export function normalizeIndiaPrashnaCuspMode(value){
    return INDIA_PRASHNA_CUSP_MODE_OPTIONS.some((o)=>o.value === value) ? value : INDIA_PRASHNA_CUSP_MODE_DEFAULT;
}
export const INDIA_PRASHNA_SCHOOL_OPTIONS = [
    { value: 'kp', label: 'KP 问时(1–249)' },
    { value: 'parashari', label: 'Parāśarī 问事' },
    { value: 'tajika', label: 'Tājika 问事' },
];

// 每派默认:ayanamsa / hsys(分宫数) / aspectParadigm(中栏相位范式) / tabs(可见右栏 tab key 集)。
export const INDIA_SCHOOL_DEFAULTS = {
    // '14' 问事 Praśna(parashari/tajika/kp 三派;jaimini/nadi 不设,§16.3 适用矩阵)
    // '15' 校时 Rectification(五派全开:定盘是所有流派之前置)
    // dashaFocus:该派主 dasha 取向(∈ 大运体系值集则切 dashaSystem;否则仅作面板定位/摘要显示);
    // primaryTab:切派后落地主场 tab;positioning:一句定位(选择器 tooltip+摘要,五支手册定位表)。
    parashari: { ayanamsa: 'lahiri', hsys: 0, aspectParadigm: 'graha', dashaFocus: 'vimshottari', primaryTab: '3',
        positioning: '全局本命·性格·事业·财富·整体人生',
        tabs: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17'] },
    jaimini: { ayanamsa: 'lahiri', hsys: 0, aspectParadigm: 'rasi', dashaFocus: 'chara', primaryTab: '9',
        positioning: '寿命·出身·灵性·事件本质(星座逻辑)',
        tabs: ['1', '2', '3', '4', '7', '9', '13', '15'] },
    tajika: { ayanamsa: 'lahiri', hsys: 0, aspectParadigm: 'tajika', dashaFocus: 'mudda', primaryTab: '11',
        positioning: '流年·一年内事件·应期(太阳回归年盘)',
        tabs: ['1', '2', '3', '11', '14', '15'] },
    kp: { ayanamsa: 'krishnamurti', hsys: 3, aspectParadigm: 'kp', dashaFocus: 'vimshottari', primaryTab: '6',
        positioning: '精准择时·是否判定·卜卦(sub-lord 细分)',
        tabs: ['1', '3', '5', '6', '10', '14', '15'] },
    nadi: { ayanamsa: 'lahiri', hsys: 0, aspectParadigm: 'nadi', dashaFocus: 'jupiterProgression', primaryTab: '16',
        positioning: '事件细节·世代·配偶父母信息(D150 极细分·木星 karaka)',
        tabs: ['16', '1', '3', '4', '8', '15'] },
    // 第 6 派 Western Sidereal(Fagan/Bradley 恒星黄道 + Placidus):严格说非印度本土,
    // 但共享恒星黄道、常被并列比较 → 对照用途;经度相位范式现无 → 退到 graha(面板标注)。
    // tabs 去 Jaimini/Tājika/KP/Nāḍī 专属页;'15' 校时全派恒开(定盘是一切流派之前置)。
    western_sidereal: { ayanamsa: 'fagan_bradley', hsys: 3, aspectParadigm: 'graha', dashaFocus: 'vimshottari', primaryTab: '1',
        positioning: '西方恒星占星(对照档,共享恒星黄道)',
        tabs: ['1', '2', '3', '4', '13', '15'] },
};

export function normalizeIndiaSchool(value){
    return INDIA_SCHOOL_OPTIONS.find((item)=>item.value === value) ? value : INDIA_SCHOOL_DEFAULT;
}

// ── 印占·流派开关(23 枚举键;引擎 dasha_variants.VARIANT_SPECS 同源镜像)──
// 🔴 默认值=现状行为字节零回归;文献另荐口径以「(文献…)」标注,绝不作缺省。标签中性化零作者名。
export const INDIA_DASHA_VARIANT_GROUPS = [
    { key: 'nakshatra', label: '星宿大运' },
    { key: 'jaimini', label: '座运 Jaimini' },
    { key: 'kalachakra', label: 'Kālachakra' },
    { key: 'graha', label: '行星运' },
    { key: 'ayus', label: '寿命与年盘' },
    { key: 'avastha', label: '行星状态' },
];
export const INDIA_DASHA_VARIANT_SPECS = [
    { key: 'vedhaBlockers', label: '过运 Vedha 遮蔽者', group: 'graha', default: 'all',
      options: [{ value: 'all', label: '罗计计入(默认)' }, { value: 'exclude_nodes', label: '罗计不作遮蔽者' }],
      tip: 'Vedha(遮蔽)由落于对应宫的他曜实施;罗睺/计都是否可作遮蔽者各家不一,默认计入=既有口径' },
    { key: 'ashtottariReckoning', label: 'Aṣṭottarī 子型', group: 'nakshatra', default: 'ardradi',
      options: [{ value: 'ardradi', label: 'Ārdrā 起(默认)' }, { value: 'krittikadi', label: 'Kṛttikā 起' },
                { value: 'auto_by_rahu', label: '依罗睺位自动(文献推荐)' }],
      tip: '宿→曜映射锚:同块序自 Ārdrā 或 Kṛttikā 起;自动=罗睺自上升三角位取 Kṛttikā 型' },
    { key: 'charaDirection', label: 'Chara 方向', group: 'jaimini', default: 'lagna_parity_sign',
      options: [{ value: 'lagna_parity_sign', label: '上升奇偶象(默认)' }, { value: 'ninth_foot', label: '第9座足性(主流)' }],
      tip: '主流口径按自上升第 9 座奇足/偶足定全序方向,期长亦按全序方向计数' },
    { key: 'charaDignity', label: 'Chara 尊位修正', group: 'jaimini', default: 'plus_minus_one',
      options: [{ value: 'plus_minus_one', label: '庙旺±1(默认)' }, { value: 'none', label: '不施(主流)' }],
      tip: '座主庙旺 +1 年/落陷 −1 年;主流实践多不施' },
    { key: 'jaiminiStrengthOrder', label: '强弱判据序', group: 'jaimini', default: 'standard',
      options: [{ value: 'standard', label: '标准链(默认)' }, { value: 'ak_first', label: 'AK 优先' }],
      tip: '座运种子/双主取强的逐级判据次序;AK 优先=含 Ātmakāraka 者径强' },
    { key: 'rasiAntarFirst', label: '座运中运首座', group: 'jaimini', default: 'dasa_sign_first',
      options: [{ value: 'dasa_sign_first', label: '大运座先(默认)' }, { value: 'dasa_sign_last', label: '次座起·大运座末' }],
      tip: '中运自大运座本身起,或自次座起而大运座排最后' },
    { key: 'rasiAntarSplit', label: 'Chara 中运分割', group: 'jaimini', default: 'proportional',
      options: [{ value: 'proportional', label: '按主期比例(默认)' }, { value: 'equal', label: '12 等分(文献默认)' }],
      tip: '仅作用于 Chara 座运的中运期长显示分割:按各座自身期长占比,或均分为 12 份' },
    { key: 'chakraDayStart', label: 'Chakra 昼夜起座', group: 'jaimini', default: 'bphs',
      options: [{ value: 'bphs', label: '古典(夜=上升座/昼=上升主座)' }, { value: 'reversed', label: '反转变体' }],
      tip: 'Chakra(每座 10 年)的起座规则;黄昏窗权威未详按昼夜二分' },
    { key: 'varnadaPeriodRule', label: 'Varṇada 期长', group: 'jaimini', default: 'count_to_lord',
      options: [{ value: 'count_to_lord', label: '数到座主(默认)' }, { value: 'equal_nine', label: '等长(文献分歧)' }],
      tip: '等长派:每座恒 9 年(首轮总 108,二轮 12−9=3);数到座主派:数至宫主为期(与 Nārāyaṇa 同核)。两派文献分歧,各自真算' },   // 旧文案「选中亦按数到座主」已过期,引擎早已真算等长
    { key: 'kalachakraCycle', label: '周期换接法', group: 'kalachakra', default: 'carry',
      options: [{ value: 'carry', label: '进位(默认)' }, { value: 'repeat', label: '循环' },
                { value: 'same_nak_carry', label: '同宿进位' }, { value: 'reset', label: '归零（现与「循环」同果）' }],   // 两档同分支
      tip: 'paramāyus 用尽后如何续轮;进位绝不跨 savya/apasavya 组;差异仅首轮后显现' },
    { key: 'kalachakraApplicability', label: '适用条件', group: 'kalachakra', default: 'universal',
      options: [{ value: 'universal', label: '普适(默认)' }, { value: 'navamsa_stronger', label: '月 navāṁśa 强才主用' }],
      tip: '变体仅标注适用性,不禁算' },
    { key: 'naisargikaOrder', label: 'Naisargika 排序', group: 'graha', default: 'fixed_natural',
      options: [{ value: 'fixed_natural', label: '固定自然序(默认)' }, { value: 'kendra_strength', label: 'kendra 强度序' }],
      tip: '成长-衰老固定序,或自月亮起按 kendra→panaphara→apoklima;年数不变' },
    { key: 'ayurdayaMethod', label: '寿命法选定', group: 'ayus', default: 'auto',
      options: [{ value: 'auto', label: '自动(最强定法,默认)' }, { value: 'pindayu', label: 'Piṇḍāyu' },
                { value: 'nisargayu', label: 'Nisargāyu' }, { value: 'amsayu', label: 'Aṁśāyu' }],
      tip: '{上升,日,月}最强者定法:日强→Piṇḍāyu/月强→Nisargāyu/上升强→Aṁśāyu;可手动指定' },
    // 缺省改「同 Piṇḍāyu 施减」(Jātaka Pārijāta 5.6 / 5.12–13:Nisargāyu 与 Piṇḍāyu 同法);「全期不减」与盘无关,改非缺省
    { key: 'nisargayuHarana', label: 'Nisargāyu 减算', group: 'ayus', default: 'pindayu_like',
      options: [{ value: 'pindayu_like', label: '同 Piṇḍāyu 施减(默认)' }, { value: 'none', label: '全期不减(与盘无关,仅参考)' }],
      tip: '施与 Piṇḍāyu 相同的弧缩放与减算(默认);「全期不减」只按自然寿表原样合计,与行星位置无关' },
    { key: 'amsayuMultiplier', label: 'Aṁśāyu 倍数', group: 'ayus', default: 'majority_highest',
      options: [{ value: 'majority_highest', label: '多数派取最高(默认)' }, { value: 'bphs_literal', label: '古典逐字' },
                { value: 'saravali_multiply', label: '相乘合并' }],
      tip: '庙旺/逆×3·自座/vargottama×2 的组合口径(重算总值)' },
    { key: 'krurodayaDenominator', label: 'Krurodaya 减式', group: 'ayus', default: 'zodiac21600',
      options: [{ value: 'zodiac21600', label: '式 A:命宫座内角分/21600(默认)' }, { value: 'nav108', label: '式 B:全周 navāṁśa 序/108(文献推荐)' }],
      // 两档不是同一量的两种分母:式 A 分子=命宫座内角分(0–1800),最多减总和的 1/12;式 B 分子=自白羊起的 navāṁśa 序(1–108),可减至近全额;量级差 1–23 倍
      tip: '凶星升上升时对总和一次减的算式。两档不是同一量的两种分母:式 A=命宫座内角分(0–1800)/21600,最多减 1/12;式 B=自白羊起的 navāṁśa 序(1–108)/108,可减至近全额。改档即改判读总值' },
    { key: 'ayuClassBoundaries', label: '寿命档边界', group: 'ayus', default: 'bphs_32_64_120',
      options: [{ value: 'bphs_32_64_120', label: '32/64/120(默认)' }, { value: 'popular_32_70', label: '32/70' }],
      tip: '短/中/长寿分档锚点' },
    { key: 'satruksetraExemption', label: '敌座豁免', group: 'ayus', default: 'retrograde',
      options: [{ value: 'retrograde', label: '逆行豁免(默认)' }, { value: 'mars', label: '火星豁免' }],
      tip: '敌座减 1/3 的豁免条件两读' },
    { key: 'annualNakYearBasis', label: 'Mudda/年 Yoginī 年基', group: 'ayus', default: 'classical360',
      options: [{ value: 'classical360', label: '360 古典(默认)' }, { value: 'julian365_25', label: '365.25' }],
      tip: '年内宿系运的总日基;比例不变' },
    { key: 'patyayiniYearConstant', label: 'Patyāyinī 年常量', group: 'ayus', default: 'gregorian365_2425',
      options: [{ value: 'gregorian365_2425', label: '365.2425(默认)' }, { value: 'd365', label: '365(文献默认)' },
                { value: 'sidereal365_2563', label: '365.2563' }, { value: 'savana360', label: '360' }],
      tip: 'Patyāyinī 总日数常量' },
    { key: 'patyayiniLagnaPoint', label: 'Patyāyinī 上升取点', group: 'ayus', default: 'degree',
      options: [{ value: 'degree', label: '座内度数(默认)' }, { value: 'cusp', label: '宫首(文献默认)' }],
      tip: '上升的 krisamsa 取实际座内度或宫首 0°' },
    { key: 'deeptadiKhala', label: 'Dīptādi 凶恶 / 困弱归属', group: 'avastha', default: 'malefic_sign',
      options: [{ value: 'malefic_sign', label: '落恶曜之座为凶恶(默认)' }, { value: 'debilitation', label: '落陷为凶恶(BPHS 通行)' }],
      tip: 'Dīptādi 情态两种通行口径:默认 = 落恶曜所主之座为 Khala(凶恶)、落陷与中性座为 Dīna(困弱);BPHS 通行 = 落陷为 Khala、中性座为 Dīna,「落恶曜之座」不另成态' },
    { key: 'haddaScheme', label: 'Hadda 界法', group: 'ayus', default: 'egyptian',
      options: [{ value: 'egyptian', label: '埃及界(默认)' }, { value: 'equal6', label: '等 6° 五分' }],
      tip: '界主分法:埃及不等界(日月永不为界主)或等 6° 五分' },
];
export function normalizeIndiaDashaVariants(raw){
    // dict/JSON 双收;只留「合法键+合法值+非默认」;解析失败/空 → {}(=全默认零 churn)。
    let data = raw;
    if(typeof raw === 'string'){
        try{ data = JSON.parse(raw); }catch(e){ return {}; }
    }
    if(!data || typeof data !== 'object' || Array.isArray(data)){ return {}; }
    const out = {};
    INDIA_DASHA_VARIANT_SPECS.forEach((spec)=>{
        const v = data[spec.key];
        if(v === undefined || v === null){ return; }
        const sv = `${v}`;
        if(sv !== spec.default && spec.options.some((o)=>o.value === sv)){
            out[spec.key] = sv;
        }
    });
    return out;
}
export function serializeIndiaDashaVariants(map){
    // 键序稳定的 JSON(缓存键/下发共用);空 map → ''(不下发)。
    const m = normalizeIndiaDashaVariants(map);
    const keys = Object.keys(m).sort();
    if(!keys.length){ return ''; }
    const stable = {};
    keys.forEach((k)=>{ stable[k] = m[k]; });
    return JSON.stringify(stable);
}

export function getIndiaSchoolDefaults(school){
    return INDIA_SCHOOL_DEFAULTS[normalizeIndiaSchool(school)] || INDIA_SCHOOL_DEFAULTS[INDIA_SCHOOL_DEFAULT];
}

// 大运体系:vimshottari(120 年,默认)/ yogini(36 年 8 女神)/ ashtottari(108 年 Ardradi)。
export const INDIA_DASHA_SYSTEM_DEFAULT = 'vimshottari';
export const INDIA_DASHA_SYSTEM_OPTIONS = [
    { value: 'vimshottari', label: 'Vimshottari' },
    { value: 'yogini', label: 'Yogini' },
    { value: 'ashtottari', label: 'Ashtottari' },
    { value: 'tribhagi', label: 'Tribhāgī（÷3）' },
    { value: 'shodashottari', label: 'Shodashottari' },
    { value: 'dvadashottari', label: 'Dvadashottari' },
    { value: 'panchottari', label: 'Panchottari' },
    { value: 'shatabdika', label: 'Shatabdika' },
    { value: 'chaturashitiSama', label: 'Chaturashiti' },
    { value: 'dwisaptatiSama', label: 'Dwisaptati' },
    { value: 'shashtihayani', label: 'Shashtihayani' },
    { value: 'shattrimshaSama', label: 'Shattrimsha' },
    { value: 'chara', label: 'Chara' },
    { value: 'taraDasha', label: 'Tāra(强度序)' },
    { value: 'akkg', label: 'AKKG(AK 播种)' },
];
// 前端展示体系(数据恒在响应 dasha 块;不下发 dashaSystem 参数 → 与默认同缓存键零请求)。
export const INDIA_DASHA_DISPLAY_ONLY_SYSTEMS = ['taraDasha', 'akkg'];

export function normalizeIndiaDashaSystem(value){
    const found = INDIA_DASHA_SYSTEM_OPTIONS.find((item)=>item.value === value);
    return found ? found.value : INDIA_DASHA_SYSTEM_DEFAULT;
}
