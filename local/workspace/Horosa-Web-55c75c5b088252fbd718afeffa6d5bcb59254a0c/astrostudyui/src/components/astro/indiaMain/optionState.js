// 印占页 · 选项表与 state 映射:大运体系 / 起运 / 分盘网格选项、fields ↔ state 映射与播种。
// 只被 components/astro/IndiaChartMain.js 与同目录 indiaMain/ 下的兄弟模块引用。
import * as AstroConst from '../../../constants/AstroConst';

// 大运体系表单一真值源在 AstroConst.INDIA_DASHA_SYSTEM_OPTIONS(载盘回种 norm、AI 挂载齿轮、
// 右栏 Select 三处共用;此前双表分叉曾致 chara/8 条件系存盘载回被打回 vimshottari)。
export const DASHA_SYSTEM_OPTIONS = AstroConst.INDIA_DASHA_SYSTEM_OPTIONS;
// 8 条件 Nakshatra 大运(QW10/11):仅在其起算条件满足时为「主用」,否则引擎仍给全表供「备览」。
export const DASHA_CONDITIONAL_KEYS = ['shodashottari', 'dvadashottari', 'panchottari', 'shatabdika', 'chaturashitiSama', 'dwisaptatiSama', 'shashtihayani', 'shattrimshaSama'];
// Jaimini 星座大运(rasi-based,非 graha):周期=各座到其主星距,与宿系大运渲染口径不同。
export const DASHA_JAIMINI_KEYS = ['chara'];
export const DASHA_SYSTEM_LABEL = {
	vimshottari: 'Vimshottari 大运（120 年）',
	yogini: 'Yogini 大运（36 年 · 8 女神）',
	ashtottari: 'Ashtottari 大运（108 年 · Ardradi）',
	tribhagi: 'Tribhāgī 三分大运（Vimśottarī÷3 · 3 遍×40=120 年）',
	shodashottari: 'Shodashottari 十六上行（116 年 · 条件）',
	dvadashottari: 'Dvadashottari 十二上行（112 年 · 条件）',
	panchottari: 'Panchottari 五上行（105 年 · 条件）',
	shatabdika: 'Shatabdika 百年（100 年 · 条件）',
	chaturashitiSama: 'Chaturashiti-sama 八四均（84 年 · 条件）',
	dwisaptatiSama: 'Dwisaptati-sama 七二均（72 年 · 条件）',
	shashtihayani: 'Shashtihayani 六十（60 年 · 条件）',
	shattrimshaSama: 'Shattrimsha-sama 三六均（36 年 · 条件）',
	chara: 'Chara 耆那星座大运（Jaimini · 按座推）',
	taraDasha: 'Tāra 大运（kendra 强度序 · Vimshottari 年表 · 120 年）',
	akkg: 'AKKG 大运（Karaka Kendradi Graha · AK 播种 · 二轮补足）',
};

// 大运起点(seed):标准取月亮宿;支持改取七政/节点/上升/特殊上升/副星(虚点)任一点的宿起运。
// 与后端 _dasha_seed_lon(seed) 同 key;后端解析该点 D1 黄经→宿→主→余额,全体系(标准+条件)同享。
export const DASHA_SEED_DEFAULT = 'moon';
// 导出供 techniqueMountSettings 内联镜像做 === 防漂移断言(AI 挂载大运起点下拉与本盘同源)。
export const DASHA_SEED_OPTIONS = [
	{ label: '七政', options: [
		{ value: 'moon', label: '月亮 Moon · 标准' },
		{ value: 'sun', label: '太阳 Sun' },
		{ value: 'mars', label: '火星 Mars' },
		{ value: 'mercury', label: '水星 Mercury' },
		{ value: 'jupiter', label: '木星 Jupiter' },
		{ value: 'venus', label: '金星 Venus' },
		{ value: 'saturn', label: '土星 Saturn' },
	] },
	{ label: '节点 / 上升', options: [
		{ value: 'rahu', label: '罗睺 Rahu' },
		{ value: 'ketu', label: '计都 Ketu' },
		{ value: 'asc', label: '上升 Lagna' },
	] },
	{ label: '特殊上升', options: [
		{ value: 'bhavaLagna', label: 'Bhava Lagna 命运上升' },
		{ value: 'horaLagna', label: 'Hora Lagna 时上升' },
		{ value: 'ghatikaLagna', label: 'Ghati Lagna 漏刻上升' },
		{ value: 'sreeLagna', label: 'Sree Lagna 吉祥上升' },
	] },
	{ label: '副星 · 虚点', options: [
		{ value: 'gulika', label: 'Gulika 土曜子' },
		{ value: 'maandi', label: 'Maandi 摩底' },
		{ value: 'dhuma', label: 'Dhuma 烟' },
		{ value: 'vyatipata', label: 'Vyatipata' },
		{ value: 'parivesha', label: 'Parivesha 晕' },
		{ value: 'indrachapa', label: 'Indrachapa 虹' },
		{ value: 'upaketu', label: 'Upaketu' },
	] },
];
export const DASHA_SEED_LABEL = {};
DASHA_SEED_OPTIONS.forEach((g)=>g.options.forEach((o)=>{ DASHA_SEED_LABEL[o.value] = o.label; }));

// ── 印占选项「fields ↔ 组件 state」双向同步映射(命盘储存四本账的第一公里)──
// 🔴 根因(2026-07-27 审计实锤):localcharts/recordFieldsRestore/aiAnalysisContext 三段早已成对,
// 但组件把选项全存在自身 state、从不写回 dva fields → 存盘时 values.india* 恒 undefined/默认,
// 整条 per-record 持久化空转;载盘还原亦因 state-first 读值而被默认值盖掉。
// 修法:① 每个选项 change 后 persistIndiaOption 写穿 dva;② 构造期/载盘(fields 引用变)时
// adoptIndiaOptionFields 以 fields 为真相回种 state。两向都走本表,加键只改一处。
export const INDIA_OPTION_FIELD_STATE_MAP = [
	{ field: 'indiaHsys', state: 'indiaHsysValue', norm: (v)=>AstroConst.normalizeIndiaHouseSystem(v) },
	{ field: 'indiaAyanamsa', state: 'indiaAyanamsaValue', norm: (v)=>AstroConst.normalizeIndiaAyanamsa(v) },
	{ field: 'indiaNodeType', state: 'indiaNodeTypeValue', norm: (v)=>(v === 'true' ? 'true' : 'mean') },
	{ field: 'indiaDashaSystem', state: 'dashaSystem', norm: (v)=>AstroConst.normalizeIndiaDashaSystem(v) },
	{ field: 'indiaDashaSeed', state: 'dashaSeed', norm: (v)=>(DASHA_SEED_LABEL[v] ? v : DASHA_SEED_DEFAULT) },
	{ field: 'indiaDashaYearLength', state: 'indiaDashaYearLength', norm: (v)=>AstroConst.normalizeIndiaDashaYear(v) },
	{ field: 'indiaAnnualChartType', state: 'indiaAnnualChartType', norm: (v)=>AstroConst.normalizeIndiaAnnualChartType(v) },
	{ field: 'indiaSthiraStart', state: 'indiaSthiraStart', norm: (v)=>(v === 'brahma' ? 'brahma' : 'lagna') },
	{ field: 'indiaTransitDate', state: 'indiaTransitDateValue', norm: (v)=>(v ? String(v) : null) },
	{ field: 'indiaTajakaYear', state: 'indiaTajakaYearValue', norm: (v)=>{ const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; } },
	{ field: 'indiaSchool', state: 'indiaSchool', norm: (v)=>AstroConst.normalizeIndiaSchool(v) },
	{ field: 'indiaVargaVariant', state: 'indiaVargaVariantMap', norm: (v)=>{
		const m = AstroConst.normalizeIndiaVargaVariantMap(v);
		return Object.keys(m).length ? m : null;
	} },
	{ field: 'indiaKarakaScheme', state: 'indiaKarakaScheme', norm: (v)=>AstroConst.normalizeIndiaKarakaScheme(v) },
	{ field: 'indiaYuddhaCriterion', state: 'indiaYuddhaCriterion', norm: (v)=>AstroConst.normalizeIndiaYuddhaCriterion(v) },
	{ field: 'indiaDashaVariants', state: 'indiaDashaVariants', norm: (v)=>{
		const m = AstroConst.normalizeIndiaDashaVariants(v);
		return Object.keys(m).length ? m : null;
	} },
	{ field: 'indiaVargaSet', state: 'vargaSetFractals', norm: (v)=>{
		const arr = (Array.isArray(v) ? v : String(v || '').split(',')).map((x)=>parseInt(x, 10)).filter((x)=>!Number.isNaN(x));
		const valid = arr.filter((x)=>VARGA_GRID_OPTIONS.some((o)=>parseInt(o.value, 10) === x));
		return valid.length ? valid.slice(0, VARGA_GRID_MAX) : null;
	} },
];

export function seedIndiaOptionState(fields){
	// 构造期/载盘回种:仅取 fields 中「显式带值」的键(空值不动默认,保零回归)。
	const patch = {};
	if(!fields){ return patch; }
	INDIA_OPTION_FIELD_STATE_MAP.forEach(({ field, state, norm })=>{
		const entry = fields[field];
		if(entry && entry.value !== undefined && entry.value !== null && entry.value !== ''){
			const v = norm(entry.value);
			if(v !== null && v !== undefined){ patch[state] = v; }
		}
	});
	return patch;
}

// 分盘集(多盘并列网格)可选分盘:D1..D60(与 state.hook 同口径)。label = D{n} · 类象。
export const VARGA_GRID_OPTIONS = [
	{ value: 1, name: 'Rashi', label: 'D1 · 命盘' },
	{ value: 2, name: 'Hora', label: 'D2 · 财产' },
	{ value: 3, name: 'Drekkana', label: 'D3 · 兄妹' },
	{ value: 4, name: 'Chaturthamsa', label: 'D4 · 资质' },
	{ value: 5, name: 'Panchamsa', label: 'D5 · 世俗' },
	{ value: 6, name: 'Shashthamsa', label: 'D6 · 疾病' },
	{ value: 7, name: 'Saptamsa', label: 'D7 · 子嗣' },
	{ value: 8, name: 'Ashthamsa', label: 'D8 · 困难' },
	{ value: 9, name: 'Navamsa', label: 'D9 · 合作' },
	{ value: 10, name: 'Dasamsa', label: 'D10 · 事业' },
	{ value: 11, name: 'Rudramsa', label: 'D11 · 增长' },
	{ value: 12, name: 'Dwadasamsa', label: 'D12 · 父辈' },
	{ value: 16, name: 'Shodasamsa', label: 'D16 · 座驾' },
	{ value: 20, name: 'Vimsamsa', label: 'D20 · 灵魂' },
	{ value: 24, name: 'Chaturvimsamsa', label: 'D24 · 教育' },
	{ value: 27, name: 'Nakshatramsa', label: 'D27 · 生命' },
	{ value: 30, name: 'Trimsamsa', label: 'D30 · 厄运' },
	{ value: 40, name: 'Khavedamsa', label: 'D40 · 母系' },
	{ value: 45, name: 'Akshavedamsa', label: 'D45 · 父系' },
	{ value: 60, name: 'Shashtyamsa', label: 'D60 · 业力' },
];
export const VARGA_GRID_LABEL = VARGA_GRID_OPTIONS.reduce((acc, o)=>{ acc[o.value] = o.label; return acc; }, {});
export const VARGA_GRID_MAX = 4;
// 默认四盘:命盘 D1 / 合作 D9(婚配核心) / 事业 D10 / 父辈 D12——印度盘最常对照组。
export const VARGA_GRID_DEFAULT = [1, 9, 10, 12];
