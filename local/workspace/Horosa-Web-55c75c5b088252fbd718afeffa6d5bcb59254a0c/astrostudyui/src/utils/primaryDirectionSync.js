import { randomStr, } from './helper';

// v10 — P1 主限法全面建成（新增 Regiomontanus / Campanus / Topocentric 方位法,
// 走自研 pd_engine 通用引擎；placidus 升级为精确半弧）。升 SYNC_REV 强制旧持久化 chart 回收重算。
// v13 — P0 解耦补齐:投影(pdProjection)×定局(pdFrame)正交两维 + 平行/框架/自定义钥匙/
// S·P 清单/界系变体。升 SYNC_REV 强制旧持久化 chart 回收重算。
export const PD_SYNC_REV = 'pd_method_sync_v26';
export const DEFAULT_PD_METHOD = 'core_alchabitius';
export const DEFAULT_PD_PROJECTION = 'ptolemy';       // = core_alchabitius 的投影分量(锁死组合)
export const DEFAULT_PD_FRAME = 'alcabitius';         // = core_alchabitius 的定局分量(锁死组合)
export const DEFAULT_PD_FRAMEWORK = 'aspect';
export const DEFAULT_PD_TIME_KEY = 'Ptolemy';
export const DEFAULT_PD_TYPE = 0;
// 方向类型:0 = In Zodiaco(默认)/ 1 = In Mundo / 4 = Field Plane(2、3 是后端界推运的内部值,前端不下发)。
export const SUPPORTED_PD_TYPES = [0, 1, 4];
export const PD_TYPE_LABELS = { 0: '黄道（In Zodiaco）', 1: '世俗（In Mundo）', 4: '场平面（Field Plane）' };
export function normalizePdType(value){
	const num = Number(value);
	return SUPPORTED_PD_TYPES.indexOf(num) >= 0 ? num : DEFAULT_PD_TYPE;
}

// 与后端 perpredict._PD_PROJECTION_REGISTRY / _PD_FRAME_HSYS / pdFramework 白名单同步。
export const SUPPORTED_PD_PROJECTIONS = [
	'ptolemy', 'placidus', 'regiomontanus', 'campanus', 'topocentric',
	'zodiacal', 'ra_direct', 'in_zodiaco_lon', 'in_zodiaco_abs', 'horosa_legacy',
	'placidus_under_pole', 'morinus', 'horizontal', 'koch',
];
export const SUPPORTED_PD_FRAMES = [
	'alcabitius', 'placidus', 'regiomontanus', 'campanus', 'topocentric',
	'meridian', 'porphyry', 'equal', 'wholesign', 'morinus', 'koch', 'equal_hour_circle',
];
export const SUPPORTED_PD_FRAMEWORKS = ['aspect', 'bounds', 'release'];
export const PD_PROJECTION_LABELS = {
	ptolemy: 'Ptolemy（半弧）', placidus: 'Placidus（半弧严密）', regiomontanus: 'Regiomontanus',
	campanus: 'Campanus', topocentric: 'Topocentric', zodiacal: '纯黄道（斜升差）',
	ra_direct: '赤经直推', in_zodiaco_lon: 'Along Ecliptic', in_zodiaco_abs: 'Edmund Jones',
	horosa_legacy: 'Horosa原方法',
	placidus_under_pole: 'Placidus under-pole（极下法）',
	morinus: 'Morinus（黄极圈）',
	horizontal: 'Horizontal（地平经圈）',
	koch: 'Koch（出生地）',
};
// S/P 清单扩展选项(与 perchart 白名单同源;追加语义,默认全不选=现状字节)
export const PD_SIGNIFICATOR_OPTIONS = [
	{ value: 'Desc', label: '下降 DSC' },
	{ value: 'IC', label: '天底 IC' },
	{ value: 'Syzygy', label: '产前朔望' },
	{ value: 'Spirit', label: '精神点' },
	{ value: 'Cusps', label: '中间宫始点' },
	{ value: 'Stars', label: '恒星（王星+比尼）' },
	{ value: 'Lots', label: '阿拉伯点（全目录）' },
];
export const PD_PROMISSOR_TYPE_OPTIONS = [
	{ value: 'cusps', label: '宫始点' },
	{ value: 'stars', label: '恒星' },
	{ value: 'lots', label: '阿拉伯点' },
];
// 应星 / 迫星扩展的已选值 → 面板上的名字(AI 自陈行用;未登记的值原样保留)
export function pdExtensionLabels(values, options){
	const list = Array.isArray(values) ? values : [];
	return list.map((v)=>{
		const hit = options.find((o)=>o.value === v);
		return hit ? hit.label : `${v}`;
	});
}
// ---- 主限法设置项登记表(相位侧 / 传统逆向 / 取点四项)----
// 单一来源:请求参数、重算比对、命盘字段、挂载设置、AI 自陈行、扩展面板控件都从这张表生成。
// 请求里只发与缺省不同的值(缺省请求体不变 = 缓存键零回归);后端 perchart 同名解析。
export const PD_EXTRA_SETTING_SPECS = [
	// 几何口径不单设控件:「弧算法」下拉里受影响的方法各列「（改进）/（经典）」两项(inProjection),
	// 自陈行也并进弧算法那一行;哪些组合受影响见 PD_GEOMETRY_APPLIES
	{ key: 'pdGeometry', type: 'select', default: 'improved', label: '几何口径', group: '方向', inProjection: true,
		options: [{ value: 'improved', label: '改进' }, { value: 'classic', label: '经典' }],
		help: '改进 = 严格按球面几何(与赤经起点无关);经典 = 传统程序写法。只在「弧算法」下拉里列了两项的方法上有差别' },
	{ key: 'pdAspectSide', type: 'select', default: 0, label: '相位侧', group: '方向',
		options: [{ value: 0, label: '两侧都出' }, { value: 1, label: '只出右旋' }, { value: 2, label: '只出左旋' }],
		help: '右旋 = 相位点在迫星黄经减相位处,左旋 = 加相位处;只出右旋时本体应星不出合相;冲两侧都出' },
	{ key: 'pdTradConverse', type: 'switch', default: 1, label: '传统逆向', group: '方向',
		help: '开 = 应星被周日运动带到迫星相位点(传统);关 = 迫星相位点被带到应星本命位置' },
	{ key: 'pdIgnoreSigLat', type: 'switch', default: 0, label: '忽略应星黄纬', group: '取点' },
	{ key: 'pdIgnorePromLat', type: 'switch', default: 0, label: '忽略迫星黄纬', group: '取点',
		help: '把迫星黄纬当 0。黄道制下「相位点黄纬」为「在黄道上」时迫星本就不带黄纬,开不开一样;选了其余黄纬档时开它 = 退回在黄道上;世俗照常起作用;Field Plane 下「改进」照常起作用、「经典」不起作用' },
	{ key: 'pdLunarParallax', type: 'switch', default: 0, label: '月亮视差', group: '取点',
		help: '月亮作迫星时用出生地看到的位置(站心);作应星不变' },
	{ key: 'pdTruePosition', type: 'switch', default: 0, label: '真位置', group: '取点',
		help: '本体取几何位置(不计光行时、光行差),福点随日月同步' },
	{ key: 'pdSolarArcRegressive', type: 'switch', default: 0, label: '逆向弧用出生前太阳', group: '方向',
		help: '只对度数Key「真太阳弧(含经典平黄赤交角档)/ Van Dam」:关 = 正负弧都看出生后太阳走过的度数;开 = 负弧改看出生前倒行的太阳。只改日期,弧不变' },
	{ key: 'pdYearDays', type: 'select', default: 0, label: '日期年长', group: '日期', selectWidth: 108,
		options: [{ value: 0, label: '实际天数' }, { value: 1, label: '365 / 366' }],
		help: '弧换成年数后,整年取第 N 个周年,年内零头 × 年长折成天数。实际天数 = 到下一周年日的实际天数(有 2 月 29 日即 366);365 / 366 = 定长年(按日历写法取 365 或 366,规则见帮助手册)。两档同一时刻最多差 1 天,只改日期,弧不变' },
	{ key: 'pdPromAspectLat', type: 'select', default: 0, label: '相位点黄纬', group: '取点', selectWidth: 108,
		options: [{ value: 0, label: '在黄道上' }, { value: 1, label: '合冲带黄纬' }, { value: 2, label: '余弦递减' }, { value: 3, label: '线性递减' }, { value: 4, label: '按宫位' }],
		help: '只对黄道制:迫星相位点带不带黄纬。在黄道上 = 黄纬 0;合冲带黄纬 = 合点取迫星黄纬、冲点取相反数,其余相位仍在黄道上;余弦递减 = 相位点在以迫星为顶点的大圆上,tan 黄纬 = tan 迫星黄纬 × 相位角余弦(合满、四分 0、冲取反);线性递减 = 黄纬 × (1 − 相位角 / 90);按宫位 = 相位点取一个黄纬,让它在所选方位法的宫位里离自己黄道垂足的偏移与迫星本体相同(Placidus / Regiomontanus / Campanus / Topocentric / Horizontal / Koch / Alcabitius / Meridian,其余方位法仍在黄道上)。应星照用自己的黄纬;世俗制不受影响' },
];
export const PD_EXTRA_SETTING_KEYS = PD_EXTRA_SETTING_SPECS.map((s)=>s.key);

function normalizePdExtraValue(spec, raw){
	if(raw === undefined || raw === null || raw === ''){
		return spec.default;
	}
	if(spec.type === 'switch'){
		if(raw === false || raw === 0 || raw === '0' || raw === 'false'){
			return 0;
		}
		return (raw === true || raw === 1 || raw === '1' || raw === 'true') ? 1 : spec.default;
	}
	const hit = spec.options.find((o)=>o.value === raw || `${o.value}` === `${raw}`);
	return hit ? hit.value : spec.default;
}

// 从若干来源(命盘参数 / 字段值 / 记录 / props)依次取第一个有值的,归一后返回全套设置
export function pickPdExtraSettings(...sources){
	const out = {};
	PD_EXTRA_SETTING_SPECS.forEach((spec)=>{
		let raw;
		for(let i = 0; i < sources.length; i++){
			const src = sources[i];
			if(src && src[spec.key] !== undefined && src[spec.key] !== null){
				raw = src[spec.key];
				break;
			}
		}
		out[spec.key] = normalizePdExtraValue(spec, raw);
	});
	return out;
}

export function pdExtraSettingsDefaults(){
	return pickPdExtraSettings();
}

export function pdExtraRequestParams(values){
	const v = pickPdExtraSettings(values);
	const out = {};
	PD_EXTRA_SETTING_SPECS.forEach((spec)=>{
		if(v[spec.key] !== spec.default){
			out[spec.key] = v[spec.key];
		}
	});
	return out;
}

// 主限法盘(选时刻 → 年 → 弧)用得到的设置项:日期年长与逆向弧口径;其余各项只影响表格出哪些行、弧多少
export const PD_CHART_DATE_SETTING_KEYS = ['pdYearDays', 'pdSolarArcRegressive'];
export function pdChartDateRequestParams(...sources){
	const all = pdExtraRequestParams(pickPdExtraSettings(...sources));
	const out = {};
	PD_CHART_DATE_SETTING_KEYS.forEach((k)=>{
		if(all[k] !== undefined){
			out[k] = all[k];
		}
	});
	return out;
}

export function pdExtraSettingsKey(values){
	const v = pickPdExtraSettings(values);
	return PD_EXTRA_SETTING_KEYS.map((k)=>v[k]).join('.');
}

export function pdExtraSettingValueLabel(spec, value){
	if(spec.type === 'switch'){
		return value ? '是' : '否';
	}
	const opt = spec.options.find((o)=>o.value === value);
	return opt ? opt.label : `${value}`;
}

export function pdExtraSettingLines(values){
	const v = pickPdExtraSettings(values);
	return PD_EXTRA_SETTING_SPECS.filter((spec)=>!spec.inProjection)
		.map((spec)=>`${spec.label}：${pdExtraSettingValueLabel(spec, v[spec.key])}`);
}

// ---- 几何口径(改进 / 经典)真有差别的组合 ----
// [盘类, 弧算法, 盘面宫制或 '*', 是否只在世俗平行开时];与 Python pd_geometry.APPLIES 同表(测试逐项比对),
// 表外组合两档逐行相同。In Mundo 下 Ptolemy 的世俗核由宫制决定,所以带宫制。
export const PD_GEOMETRY_APPLIES = [
	[0, 'placidus', '*', false], [0, 'regiomontanus', '*', false], [0, 'campanus', '*', false],
	[0, 'in_zodiaco_abs', '*', false], [0, 'topocentric', '*', false],
	[0, 'horizontal', '*', false], [0, 'koch', '*', false], [1, 'horizontal', '*', false],
	[4, 'placidus', '*', false], [4, 'regiomontanus', '*', false], [4, 'campanus', '*', false],
	[4, 'in_zodiaco_abs', '*', false],
	[4, 'ptolemy', '*', false], [4, 'morinus', '*', false], [4, 'zodiacal', '*', false], [4, 'ra_direct', '*', false],
	[4, 'placidus_under_pole', '*', false], [4, 'topocentric', '*', false], [4, 'horizontal', '*', false], [4, 'koch', '*', false],
	[1, 'ptolemy', 'alcabitius', false], [1, 'ptolemy', 'porphyry', false],
	[1, 'placidus', '*', false], [1, 'regiomontanus', '*', false], [1, 'campanus', '*', false],
	[1, 'ptolemy', 'meridian', true], [1, 'ptolemy', 'equal', true], [1, 'ptolemy', 'equal_hour_circle', true],
	[1, 'morinus', '*', true],
];
export function pdGeometryApplies({ pdtype, pdProjection, pdFrame, pdParallel } = {}){
	const t = normalizePdType(pdtype);
	const proj = pdProjection || DEFAULT_PD_PROJECTION;
	const frame = pdFrame || DEFAULT_PD_FRAME;
	return PD_GEOMETRY_APPLIES.some(([at, ap, af, needPar])=>at === t && ap === proj
		&& (af === '*' || af === frame) && (!needPar || !!Number(pdParallel)));
}

// 「弧算法」下拉:受影响的方法各列「（改进）」「（经典）」两项,值写成「弧算法|口径」;其余照旧一项
const PD_GEOMETRY_SPEC = PD_EXTRA_SETTING_SPECS.find((s)=>s.key === 'pdGeometry');
export function pdProjectionChoiceOptions(ctx){
	const out = [];
	SUPPORTED_PD_PROJECTIONS.forEach((proj)=>{
		const label = PD_PROJECTION_LABELS[proj] || proj;
		if(pdGeometryApplies({ ...ctx, pdProjection: proj })){
			PD_GEOMETRY_SPEC.options.forEach((o)=>out.push({ value: `${proj}|${o.value}`, label: `${label}（${o.label}）` }));
		}else{
			out.push({ value: proj, label });
		}
	});
	return out;
}
export function pdProjectionChoiceValue(ctx, geometry){
	const proj = SUPPORTED_PD_PROJECTIONS.indexOf(ctx.pdProjection) >= 0 ? ctx.pdProjection : DEFAULT_PD_PROJECTION;
	if(!pdGeometryApplies({ ...ctx, pdProjection: proj })){
		return proj;
	}
	return `${proj}|${pickPdExtraSettings({ pdGeometry: geometry }).pdGeometry}`;
}
// 选中项 → { pdProjection, pdGeometry };选了只列一项的方法,口径回缺省(没有差别,不留暗设置)
export function parsePdProjectionChoice(value){
	const [proj, geo] = `${value || ''}`.split('|');
	return {
		pdProjection: SUPPORTED_PD_PROJECTIONS.indexOf(proj) >= 0 ? proj : DEFAULT_PD_PROJECTION,
		pdGeometry: pickPdExtraSettings({ pdGeometry: geo }).pdGeometry,
	};
}
// 弧算法名(天球顶栏、AI 自陈行):受影响时带「（改进）/（经典）」
export function pdProjectionLabelWithGeometry(ctx, geometry){
	const proj = ctx.pdProjection;
	const label = PD_PROJECTION_LABELS[proj] || proj || '';
	if(!label || !pdGeometryApplies(ctx)){
		return label;
	}
	const geo = pickPdExtraSettings({ pdGeometry: geometry }).pdGeometry;
	return `${label}（${PD_GEOMETRY_SPEC.options.find((o)=>o.value === geo).label}）`;
}

// 恒星作迫星时的行编号(后端出表):FS_<星>_0 合 / FS_<星>_180 冲 / FSD_<星>_θ 右相位 / FSS_<星>_θ 左相位。
// 表格、文本、时间轴、天球都从这里解析,别在各处各认一遍前缀。
export const PD_STAR_ID_HEADS = { FS: 'N', FSD: 'D', FSS: 'S' };
// 用户勾了扩展才由引擎产出的迫星行前缀(宫始点 HC / 恒星 FS·FSD·FSS / 阿拉伯点 LT / 平行 PD·PC·MP·RP):
// 表格与 AI 快照在 core 白名单之外照样显示。恒星的右 / 左相位行是 FSD_ / FSS_ —— 此前两处各写正则只认 FS_,
// 恒星迫星的相位行全被当成 core 不支持行滤掉(引擎 1759 行表格只显 997 行)。
export const PD_EXTENSION_PROMISSOR_HEADS = ['HC', ...Object.keys(PD_STAR_ID_HEADS), 'LT', 'PD', 'PC', 'MP', 'RP'];
export function isPdExtensionPromissorId(id){
	return PD_EXTENSION_PROMISSOR_HEADS.indexOf(`${id || ''}`.split('_')[0]) >= 0;
}
export function parsePdStarPointId(id){
	const parts = `${id || ''}`.split('_');
	const head = PD_STAR_ID_HEADS[parts[0]];
	if(!head || parts.length < 3){
		return null;
	}
	const deg = Number(parts[parts.length - 1]);
	return { head, name: parts.slice(1, parts.length - 1).join('_'), deg: Number.isFinite(deg) ? deg : 0 };
}
// 文本版(快照 / 导出 / 行文案):与行星的「X的60度右相位处」同一句式
export function pdStarPointText(id, nameOf){
	const sp = parsePdStarPointId(id);
	if(!sp){
		return null;
	}
	const nm = `恒星 ${(nameOf && nameOf(sp.name)) || sp.name}`;
	if(sp.head === 'D'){
		return `${nm}的${sp.deg}度右相位处`;
	}
	if(sp.head === 'S'){
		return `${nm}的${sp.deg}度左相位处`;
	}
	return sp.deg ? `${nm}的${sp.deg}度相位处` : nm;
}
// 短名版(时间轴章 / 天球盖章)
export function pdStarPointShort(id, nameOf){
	const sp = parsePdStarPointId(id);
	if(!sp){
		return null;
	}
	const nm = `★${(nameOf && nameOf(sp.name)) || sp.name}`;
	if(sp.head === 'D'){
		return `${nm}右${sp.deg}°`;
	}
	if(sp.head === 'S'){
		return `${nm}左${sp.deg}°`;
	}
	return sp.deg ? `${nm}${sp.deg}°` : nm;
}
export const PD_FRAME_LABELS = {
	alcabitius: 'Alcabitius', placidus: 'Placidus', regiomontanus: 'Regiomontanus',
	campanus: 'Campanus', topocentric: 'Topocentric', meridian: 'Meridian',
	porphyry: 'Porphyry', equal: 'Equal（等宫）', wholesign: 'Whole Sign（整宫）',
	morinus: 'Morinus', koch: 'Koch', equal_hour_circle: 'Equal（时圈）',
};
export const PD_FRAMEWORK_LABELS = { aspect: '相位主限', bounds: '界行·分配星', release: '释放（hyleg）' };

// 与后端 perpredict._PD_METHOD_REGISTRY 同步的方位法白名单。
export const SUPPORTED_PD_METHODS = [
	'core_alchabitius', 'horosa_legacy', 'placidus',
	'regiomontanus', 'campanus', 'topocentric',
	'meridian', 'porphyry', 'equal_ecliptic', 'equal_hour_circle',
	'morinus', 'in_zodiaco_lon', 'in_zodiaco_abs',
];

// 与后端时间换算白名单同步(perpredict:STATIC_TIME_KEY_SCALES + 每盘常数 + 动态钥匙)。按类排列:
// 古典与平均日行 → 真太阳弧(动态)→ 每盘常数(生日 / 真午夜太阳日行)→ 角点计时(动态)→ 各家常数 → 符号量度 → 自定义。
// 「（经典）」键 = 传统程序的写法(平黄赤交角 / 出生后一日 / 写死的截断常数),紧跟在各自的改进键后面。
export const SUPPORTED_PD_TIME_KEYS = [
	'Ptolemy', 'Naibod', 'NaibodRA',
	'TrueSolarArc', 'TrueSolarArcMean', 'VanDam', 'SymbolicSolarArc',
	'Simmonite', 'BirthdaySunLon', 'Kepler', 'KeplerClassic', 'Brahe', 'BraheClassic',
	'AscendantArc', 'VerticalArc',
	'Cardano', 'Umar', 'Wollner', 'WollnerClassic', 'Plantiko', 'SynodicYear', 'SynodicYearClassic', 'Kundig',
	'SymbolicDegree', 'SymbolicYear', 'SymbolicMoon', 'SymbolicMoonClassic', 'SymbolicMonth', 'SymbolicWeek',
	'Quarterly', 'Quinary', 'Septenary', 'Novenary', 'NovenaryClassic', 'Duodenary', 'SubDuodenary', 'SelfMeasure',
	'User',
];

// 方位法 / 时间换算的 label 字典 — 用于 UI 显示 + AI 导出 + 储存。
export const PD_METHOD_LABELS = {
	core_alchabitius: 'Alchabitius',
	placidus: 'Placidus（半弧）',
	regiomontanus: 'Regiomontanus',
	campanus: 'Campanus',
	topocentric: 'Topocentric',
	meridian: 'Meridian',
	porphyry: 'Porphyry',
	equal_ecliptic: 'Equal（黄道）',
	equal_hour_circle: 'Equal（时圈）',
	morinus: 'Morinus',
	in_zodiaco_lon: 'Along Ecliptic',
	in_zodiaco_abs: 'Edmund Jones',
	horosa_legacy: 'Horosa原方法',
};
export const PD_TIME_KEY_LABELS = {
	Ptolemy: 'Ptolemy',
	Naibod: 'Naibod',
	TrueSolarArc: '真太阳弧',
	TrueSolarArcMean: '真太阳弧（经典 · 平黄赤交角）',
	SymbolicSolarArc: '太阳弧（黄经）',
	Kundig: 'Kündig',
	Cardano: 'Cardano',
	Umar: 'Umar al-Tabari',
	Wollner: 'Wöllner',
	WollnerClassic: 'Wöllner（经典 0.9860361°）',
	Plantiko: 'Plantiko',
	Simmonite: 'Simmonite（生日赤经日行）',
	BirthdaySunLon: '生日黄经日行',
	SynodicYear: 'Synodic Year',
	SynodicYearClassic: 'Synodic Year（经典 0.98435°）',
	Kepler: 'Kepler（真午夜赤经日行）',
	KeplerClassic: 'Kepler（经典 · 出生后一日）',
	Brahe: 'Brahe（真午夜赤经日行）',
	BraheClassic: 'Brahe（经典 · 出生后一日）',
	SymbolicDegree: 'Symbolic Degree',
	SymbolicYear: 'Symbolic Year',
	SymbolicMoon: 'Symbolic Moon',
	SymbolicMoonClassic: 'Symbolic Moon（经典 13.167°）',
	SymbolicMonth: 'Symbolic Month',
	SymbolicWeek: 'Symbolic Week（1° = 7 年）',
	Quarterly: 'Quarterly',
	Quinary: 'Quinary',
	Septenary: 'Septenary',
	Duodenary: 'Duodenary',
	SubDuodenary: 'Sub-Duodenary',
	Novenary: 'Novenary',
	NovenaryClassic: 'Novenary（经典 3.3333°）',
	SelfMeasure: 'Self-Measure',
	NaibodRA: 'Naibod-in-RA',
	AscendantArc: 'Ascendant-arc（上升弧计时）',
	VerticalArc: 'Vertical-arc（垂直弧计时）',
	VanDam: 'Van Dam（真弧）',
	User: '自定义（每年度数）',
};

// 旧单维 pdMethod ↔ 解耦两维(投影,分宫)双向映射。
// 🔴 与后端 perpredict._PD_METHOD_TO_PAIR 逐项同步(单一真值源;改一处必改两处)。
// frame 为 null 者(in_zodiaco_lon/in_zodiaco_abs/horosa_legacy)= 分宫回落本命盘宫制。
export const PD_METHOD_TO_PAIR = {
	core_alchabitius: ['ptolemy', 'alcabitius'],
	placidus: ['placidus', 'placidus'],
	regiomontanus: ['regiomontanus', 'regiomontanus'],
	campanus: ['campanus', 'campanus'],
	topocentric: ['topocentric', 'topocentric'],
	meridian: ['ptolemy', 'meridian'],
	porphyry: ['ptolemy', 'porphyry'],
	equal_ecliptic: ['ptolemy', 'equal'],
	equal_hour_circle: ['ptolemy', 'equal_hour_circle'],
	morinus: ['morinus', 'morinus'],
	in_zodiaco_lon: ['in_zodiaco_lon', null],
	in_zodiaco_abs: ['in_zodiaco_abs', null],
	horosa_legacy: ['horosa_legacy', null],
};

// 表格 / 快照 / 主限法盘按哪种「方法口径」显示行(Horosa原方法另有一套:列头显「赤经」、不按 core 白名单滤行、照出界 / 映点行):
// 旧单维键 pdMethod 与解耦后的弧算法 pdProjection 选到 Horosa原方法 是同一种算法(引擎两路逐行相同),显示口径也必须相同 ——
// 此前只认 pdMethod,从工具条「弧算法」选 Horosa原方法 时列头仍显 Arc、原方法独有的行被当成 core 不支持行滤掉。
export function pdDisplayMethod(pdMethod, pdProjection){
	if(`${pdProjection || ''}` === 'horosa_legacy'){ return 'horosa_legacy'; }
	return pdMethod ? `${pdMethod}` : 'core_alchabitius';
}

// 世俗 / Field Plane 下有专属实现的 (投影, 分宫);其余组合退回核内基线,界面照实注明。
const PD_MUNDO_DEDICATED_PROJECTIONS = ['placidus', 'regiomontanus', 'campanus', 'topocentric', 'morinus', 'horizontal', 'koch'];
const PD_MUNDO_DEDICATED_PTOLEMY_FRAMES = ['alcabitius', 'meridian', 'equal_hour_circle'];
const PD_FIELD_PLANE_DEDICATED_PROJECTIONS = ['ptolemy', 'placidus', 'regiomontanus', 'campanus', 'morinus', 'in_zodiaco_abs', 'in_zodiaco_lon'];

// 设置项在当前「方向 × 弧算法 × 度数Key」下不改变任何一行时的原因(界面置灰 + 悬停说明);起作用返回空串。
// 依据各方法的取点 / 逆向换算定义(perpredict 的 _pdApplyLatitudeOptions / _pdNeoConverse 等),并由引擎全量矩阵
// (两盘 × 三种方向 × 全部弧算法 × 每个设置值逐行比对,夹具 __tests__/fixtures/pdSettingInertMatrix.json)双向锁定:
// 矩阵里不起作用的组合这里必须给出原因,起作用的必须返回空串。
const PD_LEGACY_INERT_KEYS = ['pdTradConverse', 'pdIgnoreSigLat', 'pdIgnorePromLat', 'pdLunarParallax', 'pdTruePosition',
	'pdPromAspectLat', 'pdSolarArcRegressive', 'pdAntiscia', 'pdTerms', 'pdParallel', 'pdDirect', 'pdConverse'];
const PD_LEGACY_REASON = 'Horosa原方法是本程序沿革保留的旧内核,黄道制下不读这一项;换其余弧算法才起作用';
// 表里本就列四轴应星(上升 / 天顶 / 下降 / 天底)的世俗核:应星扩展再勾下降 / 天底只是重复
const PD_MUNDO_AXIS_KERNELS = ['ptolemy', 'placidus', 'regiomontanus', 'campanus', 'morinus', 'horizontal', 'koch'];
const PD_SOLAR_RA_TIME_KEYS = ['TrueSolarArc', 'TrueSolarArcMean', 'VanDam'];
const PD_ECLIPTIC_POINT_PROJECTIONS = ['zodiacal', 'ra_direct'];   // 黄道制下全部点投到黄道上(黄纬恒 0)

/**
 * @param key 设置键(取点与方向各项 / 映点 / 界 / 平行 / 急动 / 顺逆 / 应星迫星扩展)
 * @param ctx { pdtype, projection, geometry, timeKey, values }(values = 当前取点与方向各项的值)
 */
export function pdSettingInertReason(key, ctx){
	const c = ctx || {};
	const t = normalizePdType(c.pdtype);
	const proj = c.projection || DEFAULT_PD_PROJECTION;
	const v = pickPdExtraSettings(c.values || {});
	if(t === 0 && proj === 'horosa_legacy' && PD_LEGACY_INERT_KEYS.indexOf(key) >= 0){
		// 旧内核只接管 In Zodiaco;世俗 / Field Plane 下选它仍走各自的内核,这些项照常起作用
		return PD_LEGACY_REASON;
	}
	switch(key){
		case 'pdTradConverse':
			if(t === 4){ return 'Field Plane 的相位点本就是迫星在动,传统 / 新式逆向是同一条弧'; }
			if(t === 0 && proj === 'in_zodiaco_abs'){ return 'Edmund Jones 的弧不分方向,逆向写法不影响结果'; }
			return '';
		case 'pdDirect':
		case 'pdConverse':
			if(t === 0 && proj === 'in_zodiaco_abs'){ return 'Edmund Jones 的弧不分方向,顺 / 逆勾选对它不起作用'; }
			return '';
		case 'pdIgnoreSigLat':
			// 世俗制的 Along Ecliptic 走世俗核(用应星真位置),不在此列
			if(proj === 'morinus' || (proj === 'in_zodiaco_lon' && t !== 1) || (t === 0 && PD_ECLIPTIC_POINT_PROJECTIONS.indexOf(proj) >= 0)){
				return '该弧算法按应星的黄道度数取点(黄纬恒为 0),忽略与否结果相同';
			}
			return '';
		case 'pdIgnorePromLat':
			if(t === 0 && (PD_ECLIPTIC_POINT_PROJECTIONS.indexOf(proj) >= 0 || proj === 'in_zodiaco_lon')){
				return '该弧算法把迫星点投到黄道上(黄纬恒为 0),忽略与否结果相同';
			}
			if(t === 0 && !v.pdPromAspectLat){ return '黄道制下「相位点黄纬」为「在黄道上」时迫星相位点本就不带黄纬;改选其余黄纬档后此项才起作用'; }
			if(t === 4 && proj === 'in_zodiaco_lon'){ return 'Along Ecliptic 只用黄经,不带黄纬'; }
			if(t === 4 && `${c.geometry || ''}` === 'classic'){ return 'Field Plane「（经典）」口径下此项不起作用(相位点照借黄纬)'; }
			return '';
		case 'pdPromAspectLat':
			// Field Plane 选 Along Ecliptic 时走的是黄道制的沿黄道核,此项照常起作用
			if(t !== 0 && !(t === 4 && proj === 'in_zodiaco_lon')){ return '世俗制与 Field Plane 用天体真位置,不受此项影响'; }
			if(PD_ECLIPTIC_POINT_PROJECTIONS.indexOf(proj) >= 0){ return '该弧算法把所有点投到黄道上(黄纬恒为 0),此项不起作用'; }
			return '';
		case 'pdSolarArcRegressive':
			if(PD_SOLAR_RA_TIME_KEYS.indexOf(`${c.timeKey || ''}`) < 0){ return '只对度数Key「真太阳弧 / Van Dam」起作用'; }
			return '';
		case 'pdRaptParallel':
			if(t !== 1){ return '急动平行是严格世界主限技法:先把「方向」切到 In Mundo'; }
			return '';
		default:
			return '';
	}
}

/**
 * 应星 / 迫星扩展的单个选项在当前方向 × 弧算法下不改变任何一行时的原因(同上,夹具 pdExtensionInertMatrix.json 双向锁定)。
 * @param group 'pdSignificators' | 'pdPromissorTypes';@param value 选项值(Desc / IC / Syzygy … / cusps …)
 */
export function pdExtensionOptionInertReason(group, value, ctx){
	const c = ctx || {};
	const t = normalizePdType(c.pdtype);
	const proj = c.projection || DEFAULT_PD_PROJECTION;
	if(t === 0 && proj === 'horosa_legacy'){ return PD_LEGACY_REASON; }
	if(group === 'pdSignificators' && (value === 'Desc' || value === 'IC')){
		if(t === 1 && PD_MUNDO_AXIS_KERNELS.indexOf(proj) >= 0){ return '这一世俗核的表里本就列四轴应星(上升 / 天顶 / 下降 / 天底),再勾只是重复'; }
		if(t === 4 && proj !== 'in_zodiaco_lon'){ return 'Field Plane 的表里本就列四轴应星(上升 / 天顶 / 下降 / 天底),再勾只是重复'; }
	}
	return '';
}

/** 方向类型 × (投影, 分宫) 无专属实现时的界面注记;有专属实现返回空串。 */
export function pdTypeBaselineNote(pdtype, projection, frame){
	const t = normalizePdType(pdtype);
	const proj = projection || DEFAULT_PD_PROJECTION;
	const fr = frame || DEFAULT_PD_FRAME;
	if(t === 1){
		const dedicated = PD_MUNDO_DEDICATED_PROJECTIONS.indexOf(proj) >= 0
			|| (proj === 'ptolemy' && PD_MUNDO_DEDICATED_PTOLEMY_FRAMES.indexOf(fr) >= 0);
		return dedicated ? '' : '（世界主限下走核内基线）';
	}
	if(t === 4){
		return PD_FIELD_PLANE_DEDICATED_PROJECTIONS.indexOf(proj) >= 0 ? '' : '（Field Plane 下走核内基线）';
	}
	return '';
}

/** pdMethod → [投影, 分宫];未知回落默认对。 */
export function pdPairOfMethod(method){
	return PD_METHOD_TO_PAIR[method] || [DEFAULT_PD_PROJECTION, DEFAULT_PD_FRAME];
}

/** (投影, 分宫) → pdMethod 反查;无单维等价(正交自由组合)返回 null。 */
export function pdMethodOfPair(projection, frame){
	const p = projection || DEFAULT_PD_PROJECTION;
	const f = frame || DEFAULT_PD_FRAME;
	const hit = Object.keys(PD_METHOD_TO_PAIR).find((k)=>{
		const pair = PD_METHOD_TO_PAIR[k];
		return pair[0] === p && (pair[1] === f || (pair[1] === null && f === DEFAULT_PD_FRAME));
	});
	return hit || null;
}

// (投影,分宫)与方法一致性单源(主限法盘页 + 无头 primarydirchart 共用):
//   显式 pair 与方法反查一致 → 用显式;方法有单维等价且不一致 → 按方法推导;方法为自由组合(反查 null)→ 保留显式 pair。
//   此前请求恒显式带 pdFrame,后端 frame 优先 → 改「方法」对外圈宫头零效果,快照标 Placidus 宫头仍 Alcabitius。
export function pdPairParamsFor(method, explicitProjection, explicitFrame){
	const proj = explicitProjection || DEFAULT_PD_PROJECTION;
	const frame = explicitFrame || DEFAULT_PD_FRAME;
	const m = method || '';
	if(!m || pdMethodOfPair(proj, frame) === m){
		return { pdProjection: proj, pdFrame: frame };
	}
	const pair = pdPairOfMethod(m);
	if(!pair || !pair[0]){
		return { pdProjection: proj, pdFrame: frame };
	}
	return { pdProjection: pair[0], pdFrame: pair[1] || frame };
}

export function getPdMethodLabel(value){
	if(value && PD_METHOD_LABELS[value]){
		return PD_METHOD_LABELS[value];
	}
	return PD_METHOD_LABELS[DEFAULT_PD_METHOD];
}

export function getPdTimeKeyLabel(value){
	if(value && PD_TIME_KEY_LABELS[value]){
		return PD_TIME_KEY_LABELS[value];
	}
	return PD_TIME_KEY_LABELS[DEFAULT_PD_TIME_KEY];
}
const VALID_DIRECTION_SUB_TABS = new Set([
	'primarydirect',
	'primarydirchart',
	// WS-3 主限天球(3D):三件套登记之一 —— 本表 + models/astro shouldIncludePrimaryDirection
	// + jest 枚举断言,缺一即「tab 键被吞回 primarydirect / 载入不带 PD 数据」的隐性坏。
	'primarydirsphere',
	'firdaria',
	'profection',
	'solararc',
	'solarreturn',
	'lunarreturn',
	'givenyear',
	'decennials',
	'zodialrelease',
	'planetaryages',
	'vedicprog',
	'jaynesprog',
	'planetaryarc',
	'persiandirected',
	'yearsystem129',
	'balbillus',
	'triplicityrulers',
	'keypoints',
	'lunationphase',
	'extrareturns',
	'ephemeris',
	'progressions',
	'returntimeline',
	'distributions',
	'agepoint',
	'prenatalsyzygy',
]);

export function normalizePrimaryDirectionSubTabKey(key){
	return VALID_DIRECTION_SUB_TABS.has(key)
		? key
		: 'primarydirect';
}

export function mergePrimaryDirectionChartObj(chartObj, options = {}){
	const {
		pdRows,
		showPdBounds,
		pdMethod,
		pdTimeKey,
		pdtype,
		pdDirect,
		pdConverse,
		pdAntiscia,
		pdTerms,
		pdProjection,
		pdFrame,
		pdFramework,
		pdParallel,
		pdRaptParallel,
		pdTimeKeyCustom,
		pdSignificators,
		pdPromissorTypes,
		pdExtra,
		termsVariant,
		name,
		pos,
		chartId,
	} = options;
	const nextChartId = chartId === undefined ? randomStr(8) : chartId;
	return {
		...(chartObj || {}),
		params: {
			...((chartObj && chartObj.params) || {}),
			...(name !== undefined ? { name, } : {}),
			...(pos !== undefined ? { pos, } : {}),
			showPdBounds: showPdBounds === 0 ? 0 : 1,
			pdtype: normalizePdType(pdtype),
			// 顺逆默认都开(用户偏好):仅显式 0 才关。
			pdDirect: pdDirect === 0 ? 0 : 1,
			pdConverse: pdConverse === 0 ? 0 : 1,
			pdAntiscia: pdAntiscia ? 1 : 0,
			pdTerms: pdTerms ? 1 : 0,
			pdMethod: pdMethod || DEFAULT_PD_METHOD,
			pdProjection: pdProjection || DEFAULT_PD_PROJECTION,
			pdFrame: pdFrame || DEFAULT_PD_FRAME,
			pdFramework: pdFramework || DEFAULT_PD_FRAMEWORK,
			pdParallel: pdParallel ? 1 : 0,
			pdRaptParallel: pdRaptParallel ? 1 : 0,
			termsVariant: (()=>{ const n = Number(termsVariant); return (Number.isFinite(n) && n >= 0 && n <= 4) ? n : 0; })(),   // 放行 0-4;null/undefined/NaN 恒 0
			...(pdTimeKeyCustom !== undefined ? { pdTimeKeyCustom, } : {}),
			// 🔴 空数组=显式全清:必须落库覆盖旧值(`&&length` 会让清空后旧勾选残留、
			// 天球扩展 Popover 勾选回弹/清空失灵);仅 undefined(调用方未传)才保旧。
			...(Array.isArray(pdSignificators) ? { pdSignificators, } : {}),
			...(Array.isArray(pdPromissorTypes) ? { pdPromissorTypes, } : {}),
			// 设置项登记表里的键:调用方传了 pdExtra 才落(全套归一值),未传保旧
			...(pdExtra ? pickPdExtraSettings(pdExtra) : {}),
			pdTimeKey: pdTimeKey || DEFAULT_PD_TIME_KEY,
			pdSyncRev: PD_SYNC_REV,
		},
		predictives: {
			...((chartObj && chartObj.predictives) || {}),
			primaryDirection: Array.isArray(pdRows) ? pdRows : [],
		},
		...(nextChartId ? { chartId: nextChartId, } : {}),
	};
}
