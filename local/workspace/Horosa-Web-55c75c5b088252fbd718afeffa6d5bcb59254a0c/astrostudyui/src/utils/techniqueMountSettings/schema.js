// 技法设置总表 TECHNIQUE_SETTINGS_SCHEMA(技法 → 可调项 → 默认值 → 套用方式)及其登记后补丁
// 从 techniqueMountSettings.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { getDeck as getTarotDeck, DEFAULT_DECK as TAROT_DEFAULT_DECK } from '../../components/tarot/engine/deckRegistry';
import { correspondenceOverlayOn as tarotCorrespondenceOverlayOn } from '../../components/tarot/engine/cardSchema';   // 「显示进阶对应」门控:齿轮与页面 / 占象同一判据
import { resolveSettings as resolveTarotSettings } from '../../components/tarot/engine/reading';
import { HARMONIC_DEFAULT, DRACONIC_HOUSE_MODES, DRACONIC_HOUSE_LABELS } from '../derivedAstroLabs';   // 调波数缺省 / 龙盘宫位口径两家(与辅盘页同源)
import { TRANSFORM_KIND_OPTIONS, TRANSFORM_PLANETS, TRANSFORM_HOUSES, ZODIAC_PAGE_SETTINGS, ZODIAC_VERSIONS } from '../transformCharts';   // 变换盘 / 黄道制选项(与辅盘页同源)
import * as AstroText from '../../constants/AstroText';
import * as AstroConst from '../../constants/AstroConst';
import { newChartSeedRecordMissingValue } from '../newChartSeeds';
import { ASC_RA_MODE_DEFAULT, loadSuzhanAscRaMode, ASC_RA_MODE_OPTIONS } from '../ascRaMode';
import { SHAOZI_KE_OPTIONS, BEIJI_KE_OPTIONS, NANJI_SECTION_OPTIONS, NANJI_JIANCHU_OPTIONS, NANJI_XIU_OPTIONS, NANJI_PASSWORD_OPTIONS, NANJI_CHART_OPTIONS, CHUNZI_KE_OPTIONS, CHUNZI_MANSION_OPTIONS, CHUNZI_RESULT_LIMIT_OPTIONS, ZC_DAY_ZHI, zcEnvOptionsFor, zcEnvShown, ZC_SOUNDS, ZC_KE, ZC_GONG } from '../../components/kinastro/kinastroOptions';
import { tiebanKeOptions, clampTiebanKe } from '../tiebanFrameworkLocal';
import { directionAsporbOptions } from '../../constants/directionAspOrb';
import { storedBaziOptValue } from '../baziStoredOpt';
// 紫微「传本/排盘」开关选项(纯常量叶子模块,无循环导入风险)。挂载侧据此把传本设置进 record →
// buildChartZiweiParams 透传 → buildZiweiSnapshotForParams 临时覆盖 ZWEngineOptions(用毕还原),与 sihuaSchool 同范式。
import { DAXIAN_SPAN_OPTIONS as ZW_DAXIAN_SPAN_OPTIONS, TIANMA_BASIS_OPTIONS as ZW_TIANMA_BASIS_OPTIONS, STAR_SET_OPTIONS as ZW_STAR_SET_OPTIONS, SANPAN_OPTIONS as ZW_SANPAN_OPTIONS, SHANGSHI_OPTIONS as ZW_SHANGSHI_OPTIONS, LEAP_MONTH_OPTIONS as ZW_LEAP_MONTH_OPTIONS, LATE_ZI_OPTIONS as ZW_LATE_ZI_OPTIONS, YEAR_BOUNDARY_OPTIONS as ZW_YEAR_BOUNDARY_OPTIONS, HUOLING_OPTIONS as ZW_HUOLING_OPTIONS, KONG_NAMING_OPTIONS as ZW_KONG_NAMING_OPTIONS, BRIGHTNESS_SOURCE_OPTIONS as ZW_BRIGHTNESS_SOURCE_OPTIONS, LIFE_MASTER_BY_OPTIONS as ZW_LIFE_MASTER_BY_OPTIONS, CHANGSHENG_START_OPTIONS as ZW_CHANGSHENG_START_OPTIONS, CHANGSHENG_DIRECTION_OPTIONS as ZW_CHANGSHENG_DIRECTION_OPTIONS, KONGWANG_STYLE_OPTIONS as ZW_KONGWANG_STYLE_OPTIONS, KUIYUE_OPTIONS as ZW_KUIYUE_OPTIONS, LIU_YUE_BASIS_OPTIONS as ZW_LIU_YUE_BASIS_OPTIONS, LIUNIAN_SIHUA_GAN_OPTIONS as ZW_LIUNIAN_SIHUA_GAN_OPTIONS, ZWEngineOptions } from '../../components/ziwei/ziweiOptions';
import { migrateLegacyQimenSchool } from '../../components/dunjia/DunJiaCalc';
import { GUICE_PRESETS, applyPreset as applyGuicePreset, setOption as setGuiceOption, GUICE_SCHOOL_OPTIONS } from '../../components/guice/guiceSchools';
import { YONG_GONG_OPTIONS as XCT_YONG_GONG_OPTIONS, PI_KOUJING_LABEL as XCT_PI_KOUJING_LABEL } from '../../components/xiaochengtu/core/xiaochengtuConst';
import { LIU_YUE_MONTH_NAMES as FEIGONG_LIU_YUE_MONTH_NAMES } from '../../components/feigong/core/feigongConst';
import { SCHEME_ORDER as BABYLON_SCHEME_ORDER, BABYLON_SCHEMES } from '../../divination/babylon/babylonSchools';
// 通书用事全表 + 六十甲子(叶子数据)。
import { TONGSHU_TERM_CATEGORIES, TONGSHU_TERMS } from '../../components/calendar/tongshuData';
import { GANZHI_60 } from '../../components/fengshui/fengshuiData';
// 六爻判读设置(叶子数据:流派预设/占测事项/神煞表)。
import { LIUYAO_PRESETS, applyPreset as applyLiuyaoPreset } from '../../components/gua/liuyaoSchools';
import { REGION_CHARTS } from '../../divination/data/regionCharts';   // 预置地区盘
import { SOLUNAR_TYPES } from '../../divination/mundane/solunarTypes';   // 恒星派入境八盘种(纯数据)
import { MUNDANE_HORARY_KINDS } from '../../divination/mundane/mundaneHorary';   // 世运卜卦问题类型
import { MUNDANE_RULESETS } from '../../divination/mundane/ruleset';   // 世俗盘规则集(与世俗盘页同源)
import { QUESITED_HOUSE_OPTIONS as GEO_QUESITED_HOUSE_OPTIONS, TURN_HOUSE_LABELS as GEO_TURN_HOUSE_LABELS, PCHART_ZODIAC_OPTIONS as GEO_PCHART_ZODIAC_OPTIONS } from '../../components/geomancy/geomancyOptions';
import { LINGQI_ZHU_META, lingqiZhuChipLabel, lingqiZhuChipTitle } from '../../components/lingqi/lingqiSnapshot';   // 灵棋注家:齿轮文字与页面芯片同源
import { YESNO_MODE_LABEL as TAROT_YESNO_MODE_LABEL } from '../../components/tarot/engine/verdict';
import { EXTRA_RETURN_SNAPSHOT_BODIES, EXTRA_RETURN_BODY_OPTIONS, EXTRA_RETURN_SNAPSHOT_COUNT, EXTRA_RETURN_COUNT_OPTIONS } from '../../components/astro/AstroExtraReturns';   // 多重回归星体表 / 回数档(与页面同源)
import { DIRECTION_PAGE_SETTINGS } from '../directionPageSettings';
import { ZWSchool } from '../../constants/ZWConst';
import { ASTRO_CHART_FIELDS, INDIA_CHART_FIELDS, indiaSchoolPresetDraft, SUZHAN_DEAD_CLASSICAL_KEYS, SUZHAN_SIDEREAL_AYANAMSA_FIELD, PRIMARY_DIRECT_TABLE_FIELDS, PRIMARY_DIRECT_CHART_FIELDS, TRIPLICITY_FIELDS, BALBILLUS_FIELDS, YEARSYSTEM129_FIELDS, DISTRIBUTIONS_FIELDS, AGEPOINT_FIELDS, KEYPOINTS_FIELDS, ZODIAL_RELEASE_FIELDS, DECENNIALS_FIELDS, PLANETARY_ARC_FIELDS, PERSIAN_DIRECTED_FIELDS, PROG_TARGET_FIELDS, NEROMAN_FIELDS, BEZZA_FIELDS, JAY_FIELDS, MICHON_FIELDS, TIMELORD_FIELDS, PREDICTIVE_PERIOD_BASE_FIELDS, PROFECTION_SUMMARY_FIELDS, PREDICTIVE_RETURN_DIR_FIELDS, zcSchoolIs, QUERENT_FIELDS, GUOLAO_FIELDS, GERMANY_FIELDS, GERMANY_SCHOOL_PRESET_KEYS, germanySchoolPresetDraft, tongshuPageSetting } from './astroFields';
import { transformPageSetting, transformKindUses, DIZHI_12, ON_OFF, BAZI_TIME_ALG_OPTIONS, DAY_BOUNDARY_FIELDS, LUNAR_MONTH_OPTIONS, LUNAR_DAY_OPTIONS, SHICHEN_OPTIONS, ZIWEI_TIME_FIELDS, ZIWEI_DAXIAN_OPTIONS, ZW_SWITCH01, TIME_FIELDS_WITH_MEAN, storedPageSetting, markDefaultOption, guiceMetaLabel, guiceMetaOptions } from './fieldAtoms';
import { QIMEN_FIELDS, TAIYI_FIELDS, flattenTaiyiSchoolStored, LIURENG_FIELDS, JINKOU_FIELDS, SANSHI_UNITED_FIELDS, HORARY_FIELDS, flattenHoraryStored, horarySchoolOrDefault, HORARY_JUDGE_FIELDS, horaryJudgeFieldQuestionScoped, ELECTION_FIELDS, flattenElectionStored, SIXYAO_FIELDS, flattenLiuyaoStored, WUZHAO_FIELDS, flattenOptionsStored, TAIXUAN_FIELDS, JINGJUE_FIELDS, SHENYISHU_FIELDS, geoPlanetaryChartOn, tarotCorrespondenceShown } from './divinationFields';

// 塔罗:存档的判读设置住 payload.options.settings(开关存 true / false),齿轮的扁平键覆盖在 payload.options 顶层。
// 基线 = 覆盖层 > 存档 settings(开关 → 1 / 0;不在齿轮档里的值按「随档」)> 随档 —— 抽屉显示存档实际所用,
// 显示条件(尊位版本随元素尊位、计时单位随计时法)也看得见存档值(此前只看齿轮键,随档时永远不出)。
export function flattenTarotStored(payload){
	const o = payload && payload.options && typeof payload.options === 'object' ? payload.options : null;
	if(!o){ return null; }
	const st = o.settings && typeof o.settings === 'object' ? o.settings : {};
	const out = { ...o };
	const schema = TECHNIQUE_SETTINGS_SCHEMA.tarot;
	(schema && schema.fields || []).forEach((f)=>{
		if(out[f.name] !== undefined && out[f.name] !== null && out[f.name] !== ''){ return; }
		let v = st[f.name];
		if(typeof v === 'boolean'){ v = v ? 1 : 0; }
		if(v === undefined || v === null || v === ''){ return; }
		if((f.options || []).some((x)=>`${x.value}` === `${v}`)){ out[f.name] = v; }
	});
	return { ...out, ...tarotCorrespondenceContext(o) };
}

// 塔罗「显示进阶对应」进齿轮:字母 / 路径变体、现代行星注、宫廷两体系四项在页面上只在进阶对应开着时出现
// (变体与现代行星注另要牌组有变体能力),关着时占象按缺省口径算(cardSchema.correspondenceView)。
// 齿轮没有这个开关,开不开由存档决定:牌组 = 存档 deckId(缺 = 缺省牌组),开关 = 存档 settings.showCorrespondences,
// 缺键按 resolveSettings 随牌组缺省 —— 与重算(buildReading)、页面同一条;判据调 correspondenceOverlayOn,不另写。
// 结果作只读上下文键(以 __ 开头,见 mountContextOf)随基线带给显隐判据。
function tarotCorrespondenceContext(options){
	const o = options && typeof options === 'object' ? options : {};
	const st = o.settings && typeof o.settings === 'object' ? o.settings : {};
	const deck = getTarotDeck(o.deckId || TAROT_DEFAULT_DECK);
	const caps = (deck && deck.caps) || {};
	const on = !!deck && tarotCorrespondenceOverlayOn(caps, resolveTarotSettings(deck, st).showCorrespondences);
	return { __tarotCorrespondenceOn: on ? 1 : 0, __tarotCorrespondenceVariant: on && caps.variant ? 1 : 0 };
}

// 轨策齿轮字段名(联动钩子用;取 schema 本身,免得两处手抄)
function GUICE_FIELDS_NAMES(){
	const sc = TECHNIQUE_SETTINGS_SCHEMA.guice;
	return sc && Array.isArray(sc.fields) ? sc.fields.map((f)=>f.name) : [];
}

export const TECHNIQUE_SETTINGS_SCHEMA = {
	// ---- A 类：命盘星盘系（fields 驱动）----
	// 星盘挂载快照不含中式二十八宿内容(月宿=印度 nakshatra、月站=阿拉伯月站),doubingSu28 对星盘正文零消费 → 撤此齿轮
	// (宿占/七政条目照旧,与页面九档同源)。
	astrochart: { kind: 'record', fields: ASTRO_CHART_FIELDS.filter((f)=>f.name !== 'doubingSu28') },
	// 聚合键改为只读:内容=辅盘页派生盘模块快照(只认本命主);57 个占星齿轮对它拨的是本命请求(病形④⑤),撤下。
	astrochart_like: { kind: 'sectionsOnly', reason: '十三分盘/十二分盘/调波盘/龙盘:辅盘页对这张盘出过图就用那一份(只认本命主),没出过按缺省参数现算;重置盘/变换盘/黄道制只并辅盘页已出的。要按指定参数(调波数、重置地点等)取,请单独挂对应的那一张。' },
	// 派生盘五键各自独立(读本键模块快照;内容勾选走各键 preset;要改盘参数到辅盘页重出)。
	hellenastro: { kind: 'sectionsOnly', reason: '十三分盘:辅盘页对这张盘出过图就用那一份(只认本命主),没出过按出生信息现算;没有可调设置。' },
	dwadasamsa: { kind: 'sectionsOnly', reason: '十二分盘:辅盘页对这张盘出过图就用那一份(只认本命主),没出过按出生信息现算;没有可调设置。' },
	harmonic: { kind: 'record', emptyHint: '调波盘按出生信息现算;辅盘页按同一个调波数出过图就直接用那一份。', fields: [
		{ name: 'harmonic', label: '调波数 (1-360)', type: 'number', default: HARMONIC_DEFAULT, min: 1, max: 360, step: 1, group: '调波盘' },
	] },
	draconic: { kind: 'record', emptyHint: '龙盘按出生信息现算;辅盘页按同一宫位口径出过图就直接用那一份。', fields: [
		// 缺省 = 辅盘页保存的宫位口径(页面改过即随之)
		{ name: 'draconicHouses', label: '宫位口径', type: 'select', default: 'whole', globalCurrent: ()=>{ try{ return require('../../components/auxchart/AstroDraconicLab').DRACONIC_PAGE_SETTINGS.load().houseMode; }catch(e){ return undefined; } }, group: '龙盘',
			options: DRACONIC_HOUSE_MODES.map((v)=>({ value: v, label: DRACONIC_HOUSE_LABELS[v] })) },
	] },
	// 变换盘 / 黄道制:各项缺省 = 辅盘页保存值(globalCurrent);在这里改 = 只对这次挂载 / 这次调用生效,不动辅盘页的保存值
	transformchart: { kind: 'record', emptyHint: '变换盘按辅盘页保存的变换种类与选项现算;在这里可单独指定这一次用哪种变换。', fields: [
		{ name: 'transformKind', label: '变换', type: 'select', default: 'inverted', globalCurrent: ()=>transformPageSetting('kind'), group: '变换盘', options: TRANSFORM_KIND_OPTIONS },
		{ name: 'transformPlanet', label: '基准星', type: 'select', default: 'Moon', globalCurrent: ()=>transformPageSetting('planet'), group: '变换盘', options: TRANSFORM_PLANETS.map((v)=>({ value: v, label: AstroText.AstroMsgCN[v] || v })),
			showWhen: (d)=>transformKindUses(d.transformKind, 'planet') },
		{ name: 'transformShift', label: '宫位同转', type: 'select', default: 0, globalCurrent: ()=>(transformPageSetting('shift') ? 1 : 0), group: '变换盘', options: [{ value: 0, label: '不转(缺省)' }, { value: 1, label: '同转' }], normalize: (v)=>((v === true || `${v}` === '1' || `${v}` === 'true') ? 1 : 0),
			showWhen: (d)=>transformKindUses(d.transformKind, 'shift') },
		{ name: 'transformHouse', label: '对应宫头', type: 'select', default: 1, globalCurrent: ()=>transformPageSetting('house'), group: '变换盘', options: TRANSFORM_HOUSES.map((n)=>({ value: n, label: `${n} 宫` })),
			showWhen: (d)=>transformKindUses(d.transformKind, 'house') },
		{ name: 'transformVariant', label: '口径', type: 'select', default: 'improved', globalCurrent: ()=>transformPageSetting('variant'), group: '变换盘', options: [{ value: 'improved', label: '改进' }, { value: 'classic', label: '经典' }],
			showWhen: (d)=>transformKindUses(d.transformKind, 'variant') },
	] },
	zodiacsystems: { kind: 'record', emptyHint: '黄道制按辅盘页保存的黄道版本现算;在这里可单独指定这一次用哪个版本。', fields: [
		{ name: 'zodiacVersion', label: '黄道版本', type: 'select', default: 'z13a', globalCurrent: ()=>{ try{ return ZODIAC_PAGE_SETTINGS.load().version; }catch(e){ return undefined; } }, group: '黄道制', options: ZODIAC_VERSIONS.map((v)=>({ value: v.value, label: v.label })) },
	] },
	relocation: { kind: 'record', emptyHint: '重置盘:出生时刻不变,只换地点重算宫位与四角。两项都留空 = 辅盘页出过哪张用哪张,没出过按出生地(与本命相同)。', fields: [
		{ name: 'relocLat', label: '重置地点·纬度 (北正南负;只给经度时取出生地纬度)', type: 'number', default: '', min: -90, max: 90, step: 0.0001, group: '重置盘', placeholder: '如 31.2304' },
		{ name: 'relocLon', label: '重置地点·经度 (东正西负;只给纬度时取出生地经度)', type: 'number', default: '', min: -180, max: 180, step: 0.0001, group: '重置盘', placeholder: '如 121.4737' },
	] },
	indiachart: { kind: 'record', fields: INDIA_CHART_FIELDS, emptyHint: '印度盘按出生信息起盘，可调岁差制/分宫制。',
		// 抽屉里换流派:像页面换派那样把宫制 / 岁差(及主大运)写成该派预设(之后仍可逐项再改)
		onDraftChange: (draft, name, value)=>(name === 'indiaSchool' && value ? { ...draft, ...indiaSchoolPresetDraft(value) } : draft),
		// 覆盖只带了流派(旧存的挂载配置 / 助手只改流派)、与盘上流派不同:没带的宫制 / 岁差 / 主大运取该派预设 ——
		// 记录缺这几个键时构造器取的是页面载入值(出厂值),不再另按流派补,换派的预设由这里给(与抽屉、页面同一张表)
		expandMergeOptions: (options, record)=>{
			const sc = options && options.indiaSchool;
			if(!sc){ return options; }
			const cur = record && record.indiaSchool ? record.indiaSchool : AstroConst.INDIA_SCHOOL_DEFAULT;
			if(AstroConst.normalizeIndiaSchool(sc) === AstroConst.normalizeIndiaSchool(cur)){ return options; }
			const preset = indiaSchoolPresetDraft(sc);
			const out = { ...options };
			Object.keys(preset).forEach((k)=>{ if(out[k] === undefined || out[k] === null || out[k] === ''){ out[k] = preset[k]; } });
			return out;
		} },
	// 宿占=占星起盘 + 宿盘专属「人事十二宫起宫」(ASC起盘/八字公式起盘,SZConst.SZHouseStart_*);
	// 独立拼 fields(不污染 astrochart 共用的 ASTRO_CHART_FIELDS)。默认 0=八字公式起盘=现状。
	// houseStartMode 缺键时构造器取 newChartSeedRecordMissingValue(并入时冻结的旧版偏好,
	// aiAnalysisContext buildFieldObject)——globalCurrent 同源,旧档缺键+当时偏好为 ASC 时拨回
	// 默认档不再被剪空;埃及历七轴对宿占是死齿轮(buildSuzhanSnapshotText 不产【埃及历】段),
	// 从共享 ASTRO_CHART_FIELDS 过滤掉,免误导。
	// 宿占快照只读宫位 id/黄经、传统星体所在宫/赤经/黄经度/宿名、宿距星赤经、生时时支(SuZhanMain.buildSuzhanSnapshotText):
	// 尊贵/界主/福点/相位/空亡/燃烧/返照/推算行星/容许度等 40 个西占古典判读键对宿占正文零消费(与 egypt_* 同理)→ 一并过滤。
	// 宿占事盘的宿法 / 起宫只存在 payload.options(记录顶层没有):基线从那里读,否则抽屉显示荀爽、选回荀爽被剪成死开关;命盘顶层带这两键,不受影响
	// recordPayloadKeys:平铺键缺席时取存档 payload.options(宿占存案另存黄道 / 宫制 / 岁差,与 SuZhanMain SUZHAN_CASE_CHART_KEYS 同)
	suzhan: { kind: 'record', recordPayloadKeys: ['houseStartMode', 'doubingSu28', 'zodiacal', 'hsys', 'siderealAyanamsa'], fields: [...ASTRO_CHART_FIELDS.filter((f)=>!`${f.name}`.startsWith('egypt_') && f.group !== '盘面细节' && SUZHAN_DEAD_CLASSICAL_KEYS.indexOf(f.name) < 0).map((f)=>(f.name === 'siderealAyanamsa' ? SUZHAN_SIDEREAL_AYANAMSA_FIELD(f) : f)), {
		name: 'houseStartMode', label: '人事十二宫', type: 'select', default: 0,
		globalCurrent: ()=>newChartSeedRecordMissingValue('houseStartMode'),   // 与页面载入缺键同口径(并入时冻结的旧版偏好)
		group: '排盘',
		options: [{ value: 0, label: '八字公式起盘（默认）' }, { value: 1, label: 'ASC起盘' }],
	}, {
		// 上升取法(改进 = 真赤经 / 经典 = 东点黄经):宿占页设置(horosa.suzhan.settings.v1),记录里没有 → 跟页面现值;
		// 只在 ASC 起盘时起作用(八字公式起盘不读上升赤经),无头重算经 suzhanFieldsForRecord 带进 fields.ascRaMode
		name: 'ascRaMode', label: '上升取法', type: 'select', default: ASC_RA_MODE_DEFAULT,
		globalCurrent: ()=>loadSuzhanAscRaMode(),
		group: '排盘',
		showWhen: (d)=>Number(d.houseStartMode) === 1,
		options: ASC_RA_MODE_OPTIONS.map((o)=>({ value: o.value, label: o.value === ASC_RA_MODE_DEFAULT ? `${o.label}（默认）` : o.label })),
	}] },
	// 演禽/策天：经 ken 后端按出生时间起盘（纯命盘类、无事盘）。
	// 注：禽星盘只取生辰原始时刻，ken 引擎不消费 日界/晚子时/真太阳时换算（parseFieldsDateTime 只读 date/time/zone/lat/lon）→
	// 此前挂 TIME_FIELDS 是「可选但无效」的死设置，移除以免误导（各挂载设置界面都不再显示无效项）。
	// kinastro 族齿轮范式:'' 哨兵=按盘面时间/后端自出(prune 剪掉,payload 不带键=现状零回归);
	// 非空值经 case 分支 optionsOverride 透传,与页面 buildPayload 同键直达 ken 后端(cetian 已验范式)。
	// 家庭/亲属/四柱覆写等「内容/数据」项不入齿轮(faRelatedPeople 同理),仍随页面存档。
	xianqin: { kind: 'record', group: '演禽', fields: [
		// 旧 emptyHint「无独立可调排盘设置」不实:页面有 入式历法/农历锚点 四项且 buildPayload 真下发。
		{ name: 'calendarMode', label: '入式历法', type: 'select', default: '', blankFollowsBaseline: true, group: '入式', options: [
			{ value: '', label: '随盘自出（默认）' }, { value: 'autoLunar', label: '自动换算农历' },
			// 值须与页面 KinAstroMain / 后端 CALENDAR_MODES 同键('solarAsLunar');此前写 'solarNumeric' 后端不认 → 静默回落自动农历。
			{ value: 'manualLunar', label: '手动农历' }, { value: 'solarAsLunar', label: '公历数值入式' },
		] },
		// 三键只在手动农历入式下被后端读取(webxianqinsrv 293-296)
		{ name: 'lunarYear', label: '农历年(空=自出)', type: 'number', default: '', group: '入式', showWhen: (d)=>d.calendarMode === 'manualLunar' },
		{ name: 'lunarMonth', label: '农历月(空=自出)', type: 'number', default: '', min: 1, max: 12, group: '入式', showWhen: (d)=>d.calendarMode === 'manualLunar' },
		{ name: 'lunarDay', label: '农历日(空=自出)', type: 'number', default: '', min: 1, max: 30, group: '入式', showWhen: (d)=>d.calendarMode === 'manualLunar' },
	] },
	// qizhengkin:页面设置走 fetchKinastroQizheng 专用请求(qizhengKin* 键)+localStorage,与挂载
	// postKinAstro 路由的消费面未实证同构 → 按铁律「不放无效选项」暂不登,留待后端消费面证实后接线。
	// 后端 webqizhengkinsrv.pan() 读 qizhengKin* 七键且与无头 postKinAstro 同端点(此前「消费面未实证」的空集理由已被推翻);
	// 值域与页面 GuoLaoInput 七政设置同源(currentYear/transitMode/electionalCriteria…);缺省=页面缺省(当前年/none/general/30 天)。
	qizhengkin: { kind: 'record', group: '七政(kentang)', fields: [
		{ name: 'qizhengKinCurrentYear', label: '推运年份(空=当前年)', type: 'number', default: '', min: 1, max: 9999, group: '行运' },
		{ name: 'qizhengKinTransitMode', label: '流时', type: 'select', default: 'none', group: '行运', options: [
			{ value: 'none', label: '关闭(默认)' }, { value: 'same', label: '同刻' }, { value: 'now', label: '此刻' }, { value: 'custom', label: '自定' },
		] },
		{ name: 'qizhengKinTransitDate', label: '流时日期(自定时)', type: 'date', default: '', group: '行运', showWhen: (d)=>d && d.qizhengKinTransitMode === 'custom' },
		{ name: 'qizhengKinTransitTime', label: '流时时间(自定时)', type: 'time', default: '', group: '行运', showWhen: (d)=>d && d.qizhengKinTransitMode === 'custom' },
		{ name: 'qizhengKinElectionalStartDate', label: '择日起日(空=出生日)', type: 'date', default: '', group: '择时' },
		{ name: 'qizhengKinElectionalCriteria', label: '择日用途', type: 'select', default: 'general', group: '择时', options: [
			{ value: 'general', label: '通用(默认)' }, { value: 'marriage', label: '嫁娶' }, { value: 'travel', label: '出行' }, { value: 'business', label: '开市' }, { value: 'moving', label: '搬迁' },
		] },
		{ name: 'qizhengKinElectionalDays', label: '择日天数', type: 'number', default: 30, min: 1, max: 60, group: '择时' },
	] },
	shaozi: { kind: 'record', group: '邵子神数', fields: [
		// 档位与页面同一份;留空 = 后端缺省初刻(不是由盘推出)
		{ name: 'ke', label: '刻数', type: 'select', default: '', group: '考刻', options: [{ value: '', label: '缺省（初刻）' }, ...SHAOZI_KE_OPTIONS] },
		{ name: 'useKey', label: '64钥匙细调', type: 'select', default: '', blankFollowsBaseline: true, group: '考刻', options: [
			{ value: '', label: '随盘（默认）' }, { value: 1, label: '启用' }, { value: 0, label: '关闭' },
		] },
	] },
	tieban: { kind: 'record', group: '铁板神数', fields: [
		{ name: 'method', label: '算法', type: 'select', default: '', blankFollowsBaseline: true, group: '起数', options: [
			{ value: '', label: '随盘（默认）' }, { value: 'kunji', label: '扣入法' }, { value: 'suanpan', label: '算盘打数' },
		] },
		{ name: 'startAge', label: '起运年龄(空=自出)', type: 'number', default: '', min: 0, max: 120, group: '起数' },   // 与页面/后端 0–120 同域(此前 20)
		{ name: 'dayunSteps', label: '大运步数(空=自出)', type: 'number', default: '', min: 1, max: 12, group: '起数' },
		// 考刻 ke / 钥匙细调 useKey 撤:从邵子神数照抄,铁板后端 pan 只读 gender/method/startAge/dayunSteps,页面也只在邵子页渲染 → 死齿轮。
		// [框架推演] 段口径(纯前端 buildTiebanFramework;页面存档带此段而无头曾整段缺失):
		{ name: 'tiebanSchool', label: '流派（口径说明）', type: 'select', default: 'south', group: '框架推演', options: [
			{ value: 'south', label: '南派(岭南)' }, { value: 'north', label: '北派(中州)' },
		] },
		{ name: 'tiebanKeSystem', label: '刻制', type: 'select', default: 'qing8', group: '框架推演', options: [
			{ value: 'qing8', label: '清八刻' }, { value: 'ming100', label: '明百刻' }, { value: 'dou12', label: '十二刻斗宫' },
		] },
		// 刻位档随刻制(与页面 / 引擎同一份 tiebanKeOptions:十二刻·斗宫 1–12,其余 1–8)
		{ name: 'tiebanKe', label: '考刻刻位', type: 'select', default: 1, group: '框架推演', normalize: (v)=>Number(v),
			options: tiebanKeOptions('dou12'), optionsFor: (d)=>tiebanKeOptions(d && d.tiebanKeSystem),
			displayValue: (v, d)=>clampTiebanKe(v, d && d.tiebanKeSystem) },   // 超出所选刻制上限的刻位回显初刻(引擎同样按初刻算)
	] },
	fendjing: { kind: 'record', group: '鬼谷分定经', fields: [
		{ name: 'stemOverride', label: '两头钳', type: 'select', default: '', blankFollowsBaseline: true, group: '两头钳', options: [
			{ value: '', label: '随盘（默认）' }, { value: 0, label: '自动换算' }, { value: 1, label: '手动指定' },
		] },
		{ name: 'yearStem', label: '年干(手订时)', type: 'select', default: '', group: '两头钳',
			showWhen: (d)=>d.stemOverride === 1 || d.stemOverride === '1',
			options: [{ value: '', label: '自出' }, ...['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].map((g)=>({ value: g, label: g }))] },
		{ name: 'hourStem', label: '时干(手订时)', type: 'select', default: '', group: '两头钳',
			showWhen: (d)=>d.stemOverride === 1 || d.stemOverride === '1',
			options: [{ value: '', label: '自出' }, ...['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].map((g)=>({ value: g, label: g }))] },
	] },
	beiji: { kind: 'record', group: '北极神数', fields: [
		{ name: 'beijiKeMode', label: '刻法', type: 'select', default: '', blankFollowsBaseline: true, group: '取数', options: [
			{ value: '', label: '随盘（默认）' }, { value: 'auto', label: '自动换算' }, { value: 'manual', label: '手动指定' },
		] },
		{ name: 'beijiKe', label: '刻（手动时）', type: 'select', default: '', group: '取数',
			showWhen: (d)=>d.beijiKeMode === 'manual', options: [{ value: '', label: '自出（按时刻推刻）' }, ...BEIJI_KE_OPTIONS] },
		{ name: 'beijiLookupCode', label: '条文码(空=不查;取数字前 4 位,不足 4 位不查)', type: 'text', default: '', group: '取数' },   // webbeijisrv 173-192
		{ name: 'beijiKeyword', label: '关键词(空=不筛;少于 2 字不检索)', type: 'text', default: '', group: '取数' },
	] },
	nanji: { kind: 'record', group: '南极神数', fields: [
		// 值域与页面 / 后端同名:''=随盘 / solar=公历精算 / manual=手动古法(后端只认 manual;
		// 旧 'lunar' 档静默=公历 → 归一为 '')。手动六键仅 manual 显示(showWhen),空值=按本命自出(后端)。
		{ name: 'nanjiMode', label: '起盘方式', type: 'select', default: '', blankFollowsBaseline: true, group: '起盘', options: [
			{ value: '', label: '随盘（默认）' }, { value: 'solar', label: '公历精算' }, { value: 'manual', label: '手动古法' },
		], normalize: (v)=>((v === 'lunar') ? '' : v) },
		{ name: 'nanjiAfterLichun', label: '立春', type: 'select', default: '', blankFollowsBaseline: true, group: '起盘', options: [
			{ value: '', label: '随盘（默认）' }, { value: '1', label: '立春后' }, { value: '0', label: '立春前' },
		], showWhen: (d)=>d.nanjiMode === 'manual' },
		{ name: 'nanjiLunarYear', label: '历年(空=自出)', type: 'number', default: '', group: '起盘', showWhen: (d)=>d.nanjiMode === 'manual' },
		{ name: 'nanjiSolarMonth', label: '节月(节气月序,寅=1;空=自出)', type: 'number', default: '', min: 1, max: 12, group: '起盘', showWhen: (d)=>d.nanjiMode === 'manual' },
		{ name: 'nanjiHourZhi', label: '时支(空=自出)', type: 'select', default: '', group: '起盘', showWhen: (d)=>d.nanjiMode === 'manual',
			options: [{ value: '', label: '自出' }, ...DIZHI_12.map((z)=>({ value: z, label: z }))] },
		{ name: 'nanjiDayGan', label: '日干(空=自出)', type: 'select', default: '', group: '起盘', showWhen: (d)=>d.nanjiMode === 'manual',
			options: [{ value: '', label: '自出(按出生时刻)' }, ...['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'].map((g)=>({ value: g, label: g }))] },
		{ name: 'nanjiDayZhi', label: '日支(空=自出)', type: 'select', default: '', group: '起盘', showWhen: (d)=>d.nanjiMode === 'manual',
			options: [{ value: '', label: '自出(本命日支)' }, ...DIZHI_12.map((z)=>({ value: z, label: z }))] },   // 与日干阴阳不合时不取(后端在四柱段注明)
		// 推演诸项档位与页面同一份(值同页面,建除 / 宿名 / 密码为库内繁体键);留空时宫部 / 推演宫由盘推出,
		// 建除 / 宿 / 密码 / 星图 / 宿度是后端固定缺省(建 / 角 / 海异山同 / 第1图 / 1 度),不是由盘推出
		{ name: 'nanjiSection', label: '宫部', type: 'select', default: '', group: '推演', options: [{ value: '', label: '按本命（自出）' }, ...NANJI_SECTION_OPTIONS] },
		{ name: 'nanjiJianchu', label: '建除', type: 'select', default: '', group: '推演', options: [{ value: '', label: '缺省（建）' }, ...NANJI_JIANCHU_OPTIONS] },
		{ name: 'nanjiXiu', label: '二十八宿', type: 'select', default: '', group: '推演', options: [{ value: '', label: '缺省（角）' }, ...NANJI_XIU_OPTIONS] },
		{ name: 'nanjiPasswordCode', label: '密码', type: 'select', default: '', group: '推演', options: [{ value: '', label: '缺省（海异山同）' }, ...NANJI_PASSWORD_OPTIONS] },
		{ name: 'nanjiChart', label: '星图', type: 'select', default: '', group: '推演', normalize: (v)=>(v === '' || v === undefined || v === null ? '' : Number(v)), options: [{ value: '', label: '缺省（第1图）' }, ...NANJI_CHART_OPTIONS] },
		{ name: 'nanjiPalace', label: '推演宫', type: 'select', default: '', group: '推演',
			options: [{ value: '', label: '自出（宫部首支）' }, ...DIZHI_12.map((z)=>({ value: z, label: z }))] },
		{ name: 'nanjiDegree', label: '宿度(空=1 度)', type: 'number', default: '', min: 0, max: 30, step: 0.5, group: '推演' },   // 与页面同值域(0 可达)
	] },
	chunzi: { kind: 'record', group: '蠢子数', fields: [
		// 刻法/刻数只改起盘段「刻法/刻」两行(条文库无时辰×刻同诗,候选条文不随刻变)——标签明示「仅标注」
		{ name: 'chunziKeMode', label: '刻法（仅标注）', type: 'select', default: '', blankFollowsBaseline: true, group: '取数', options: [
			{ value: '', label: '随盘（默认）' }, { value: 'auto', label: '自动换算' }, { value: 'manual', label: '手动指定' }, { value: 'none', label: '不取刻数' },   // 补页面有的档
		] },
		{ name: 'chunziKe', label: '刻数（仅标注）', type: 'select', default: '', group: '取数',
			showWhen: (d)=>d.chunziKeMode === 'manual', options: [{ value: '', label: '自出（按时辰内位置推刻）' }, ...CHUNZI_KE_OPTIONS] },   // 手动刻法下留空,后端按时辰内已过分钟自推刻数(十刻,每 12 分一刻)
		{ name: 'chunziLunarMode', label: '月日匹配', type: 'select', default: '', blankFollowsBaseline: true, group: '取数', options: [
			{ value: '', label: '随盘（默认）' }, { value: 'auto', label: '随当前日期' }, { value: 'manual', label: '手动月日' }, { value: 'none', label: '关闭' },
		] },
		// 手动农历才读(webchunzisrv 279-293;auto 档后端真换算农历)
		{ name: 'chunziLunarMonth', label: '农历月(空=自出)', type: 'number', default: '', min: 1, max: 12, group: '取数', showWhen: (d)=>d.chunziLunarMode === 'manual' },
		{ name: 'chunziLunarDay', label: '农历日(空=自出)', type: 'number', default: '', min: 1, max: 30, group: '取数', showWhen: (d)=>d.chunziLunarMode === 'manual' },
		{ name: 'chunziMansion', label: '宿名', type: 'select', default: '', group: '取数', options: [{ value: '', label: '缺省（室）' }, ...CHUNZI_MANSION_OPTIONS] },   // 后端已归一简体;留空 = 后端固定缺省「室」
		{ name: 'chunziHourBranch', label: '时辰', type: 'select', default: '', group: '取数',
			options: [{ value: '', label: '按本命时支' }, ...DIZHI_12.map((z)=>({ value: z, label: z }))] },
		{ name: 'chunziLookupCode', label: '条文代码(空=不查)', type: 'text', default: '', group: '筛选' },
		{ name: 'chunziKeyword', label: '关键词(空=不筛)', type: 'text', default: '', group: '筛选' },
		{ name: 'chunziTags', label: '多标签(逗号分隔;空=不筛)', type: 'text', default: '', group: '筛选' },
		// 档值是字符串(与页面同);旧记录 / 旧模板存的是数字 → 归一成字符串才对得上档
		{ name: 'chunziResultLimit', label: '显示数量', type: 'select', default: '', group: '筛选', options: [{ value: '', label: '默认（20条）' }, ...CHUNZI_RESULT_LIMIT_OPTIONS],
			normalize: (v)=>(v === undefined || v === null ? v : `${v}`) },   // 档位与页面同
	] },
	// 策天飞星：算法(书/原)+原法子选项 + 5 显示开关；全默认=现状(prune 为空，零字节差)。show_* 经 payload 下发后端过滤输出段/行。
	// chartRoute: payload kind 但登记在 ANALYSIS_CHART_TECHNIQUES 走 A 路(历史双例);覆盖与现状
	// 都在 record 平铺键(regenerate case 从 record.* 手抄回塞),基线锚用平铺而非 payload 段。
	// baselineSource 显式为空:策天只读记录平铺键,不把记录里别的模块注入的整份 payload 当存档段(同名键会让抽屉显示外来值)
	cetian: { kind: 'payload', optionsPath: '', chartRoute: true, baselineSource: ()=>null, group: '策天飞星', fields: [
		{ name: 'method', label: '算法', type: 'select', default: 'book', group: '排盘方法', options: [
			{ value: 'book', label: '书法·策天本法' },
			{ value: 'kentang', label: '原法·标准紫微' },
		] },
		// 标签与策天页同(「农历」「正曜」,半角括号)
		{ name: 'lunarMode', label: '农历', type: 'select', default: 'sxtwl', group: '排盘方法', when: { method: 'kentang' }, options: [
			{ value: 'sxtwl', label: '天文历算(修正)' },
			{ value: 'classic', label: '原(闰月旧法)' },
		] },
		{ name: 'starOrder', label: '正曜', type: 'select', default: 'reverse', group: '排盘方法', when: { method: 'kentang' }, options: [
			{ value: 'reverse', label: '逆布(书)' },
			{ value: 'forward', label: '顺布(原)' },
		] },
		// 书法(移语本)口径与流年——与左栏/buildPayload 三方同键(死开关教训:任一缺位=挂载死齿轮)。
		{ name: 'brightnessSchool', label: '庙旺', type: 'select', default: 'yiyu', group: '书法口径', when: { method: 'book' }, options: [
			{ value: 'yiyu', label: '移语本·诸星格' },
			{ value: 'quanji', label: '全集本·诗诀' },
		] },
		{ name: 'shenGongMode', label: '身宫', type: 'select', default: 'yizheng', group: '书法口径', when: { method: 'book' }, options: [
			{ value: 'yizheng', label: '引证图口径' },
			{ value: 'literal', label: '正文直读' },
		] },
		{ name: 'daxianMode', label: '大限', type: 'select', default: 'yiyu', group: '书法口径', when: { method: 'book' }, options: [
			{ value: 'yiyu', label: '阳年从命·阴年从身' },
			{ value: 'legacy', label: '顺从命·逆从身(旧)' },
		] },
		{ name: 'tianluoMode', label: '罗网', type: 'select', default: 'benshu', group: '书法口径', when: { method: 'book' }, options: [
			{ value: 'benshu', label: '本书·月日法' },
			{ value: 'zhongtian', label: '中天太极·月时法' },
		] },
		{ name: 'palaceNameMode', label: '宫名', type: 'select', default: 'common', group: '书法口径', when: { method: 'book' }, options: [
			{ value: 'common', label: '通行十二宫' },
			{ value: 'monk', label: '僧道起法' },
		] },
		// 值域与页面流年下拉同(今年前后 120 年)
		{ name: 'liunianYear', label: '流年(留空=当年)', type: 'number', default: '', min: new Date().getFullYear() - 120, max: new Date().getFullYear() + 120, group: '流年', when: { method: 'book' } },
		{ name: 'liunianQishaMode', label: '七煞', type: 'select', default: 'shengshi', group: '流年', when: { method: 'book' }, options: [
			{ value: 'shengshi', label: '生时法' },
			{ value: 'suishu', label: '岁数法' },
		] },
		{ name: 'showBrightness', label: '庙旺标注', type: 'switch', options: ON_OFF, default: 1, group: '显示选项' },
		{ name: 'showLiunian', label: '流年飞星', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showShensha', label: '神煞四表', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showZaYao', label: '杂曜', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showDuanjue', label: '断诀', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showXiu', label: '廿八宿', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showBianyao', label: '十干变曜', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'book' } },
		{ name: 'showWuXingJu', label: '五行局', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'kentang' } },
		{ name: 'showSihua', label: '四化', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'kentang' } },
		{ name: 'showFlying', label: '飞星格局', type: 'switch', options: ON_OFF, default: 1, group: '显示选项', when: { method: 'kentang' } },
		{ name: 'showSolarTerm', label: '节气', type: 'switch', options: ON_OFF, default: 1, group: '显示选项' },   // 两算法都过滤该行,撤 when
	] },
	// 皇极经世：双栖——命盘侧按出生重算(buildHuangJiSnapshotForFields)，又可存事盘。
	// kind='payload'(optionsPath'' 顶层铺平;旧注误称「同列 sectionsOnly」——与实现不符,已勘正):
	// 齿轮顶层键优先、存档 payload.options.{historyYear,classicKey,classicSectionIndex,xinyiOptions} 打底(regenerate 双源读)。
	huangji: { kind: 'payload', optionsPath: '', chartRoute: true,
		// 事盘存档层映射(payload.options + 嵌套 xinyiOptions,键名不同构):chartRoute 合成基线
		// =存档打底+record 平铺覆盖 —— 只锚平铺时事盘抽屉恒显 schema 想象值(A 类实锤同型)。
		baselineSource: (p)=>{
			const ho = p && p.options && typeof p.options === 'object' ? p.options : null;
			if(!ho){ return null; }
			const hx = ho.xinyiOptions && typeof ho.xinyiOptions === 'object' ? ho.xinyiOptions : {};
			const out = { classicKey: ho.classicKey, historyYear: ho.historyYear, classicSectionIndex: ho.classicSectionIndex,
				xinyiMethod: hx.method, upperNum: hx.upperNum, lowerNum: hx.lowerNum,
				upperStrokes: hx.upperStrokes, lowerStrokes: hx.lowerStrokes, objectGua: hx.objectGua, direction: hx.direction };
			Object.keys(out).forEach((k)=>{ if(out[k] === undefined || out[k] === null){ delete out[k]; } });
			return Object.keys(out).length ? out : null;
		},
		fields: [
		// 历史年:只决定「年表」页查哪一年(元会运世与各卦按起课时间算,不随它变;留空=按起课/出生年,即无头现状)。
		{ name: 'historyYear', label: '历史年(留空=按盘面年)', type: 'number', default: '', group: '典籍' },
		{ name: 'classicKey', label: '经典', type: 'select', default: 'huangji_jingshi_shu', group: '典籍',
			options: [
				// 档名与皇极页同(页面下拉显示后端经典表的书名)
				{ value: 'huangji_jingshi_shu', label: '皇極經世書' },
				{ value: 'xinyi_fawei', label: '皇極經世心易發微' },
				{ value: 'guanwu_yanyi', label: '皇極經世觀物外篇衍義' },
			] },
		// 挂载缺省改为起心易(与页面缺省 datetime 同,此前挂载「不算心易」与页面快照两处不同形);标签统一用页面文案
		{ name: 'xinyiMethod', label: '起卦法', type: 'select', default: 'datetime', group: '心易發微',
			optionShown: (o)=>o.value !== 'none',   // 页面没有「不算心易」:只在存档已是它时列出
			options: [
				{ value: 'none', label: '不算心易' },
				{ value: 'datetime', label: '年月日時起卦(默认)' },
				{ value: 'number', label: '先天数起卦' },
				// 值须与页面 HuangJiMain 选项/后端 webwangjisrv._xinyi_result 同键('character'/'direction');
				// 此前写 'strokes'/'object' → 后端不识一律回落「两数起卦」,笔画/物象四齿轮恒死(页面本身用对键)。
				{ value: 'character', label: '字数起卦' },
				{ value: 'direction', label: '后天方位起卦' },
			] },
		{ name: 'upperNum', label: '上卦数', type: 'number', default: 5, min: 1, max: 999, group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'number' },
		{ name: 'lowerNum', label: '下卦数', type: 'number', default: 10, min: 1, max: 999, group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'number' },
		{ name: 'upperStrokes', label: '上/左笔画', type: 'number', default: 5, min: 1, max: 99, group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'character' },
		{ name: 'lowerStrokes', label: '下/右笔画', type: 'number', default: 8, min: 1, max: 99, group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'character' },
		{ name: 'objectGua', label: '物象', type: 'select', default: '離', group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'direction',
			options: ['乾', '兌', '離', '震', '巽', '坎', '艮', '坤'].map((g)=>({ value: g, label: g })) },
		{ name: 'direction', label: '方位', type: 'select', default: '南', group: '心易發微', showWhen: (d)=>d && d.xinyiMethod === 'direction',
			options: ['南', '北', '東', '西', '東南', '東北', '西南', '西北', '中'].map((g)=>({ value: g, label: g })) },   // 与页面同含「中」
	] },
	// 合盘:两盘技法无法单命主重算,快照单源=合盘页所存(选项在合盘页改即重存)。
	relative: { kind: 'sectionsOnly', reason: '合盘须两张盘,挂载读合盘页当前所存快照;要改关系类型/两盘请到合盘页操作,改后即自动更新。' },

	// ---- A 类：星运（主限法 + 三分主星 / Balbillus / 关键点 可调；其余推运参数固定=现状则空 schema）----
	// 拆分（P5）：表格用年限范围(pdYears,无 datetime)，盘用单一时刻(datetime,无 pdYears)。
	primarydirect: { kind: 'record', fields: PRIMARY_DIRECT_TABLE_FIELDS },
	primarydirchart: { kind: 'record', fields: PRIMARY_DIRECT_CHART_FIELDS },
	// 这三者的 standalone builder 已收 (chartObj,opts)；regen 据 record.* 组 opts 传入（见 aiAnalysisContext）。
	triplicityrulers: { kind: 'record', fields: TRIPLICITY_FIELDS },
	balbillus: { kind: 'record', fields: BALBILLUS_FIELDS },
	yearsystem129: { kind: 'record', fields: YEARSYSTEM129_FIELDS },
	distributions: { kind: 'record', fields: DISTRIBUTIONS_FIELDS },
	agepoint: { kind: 'record', fields: AGEPOINT_FIELDS },
	keypoints: { kind: 'record', fields: KEYPOINTS_FIELDS },
	// 批3：以下推运 builder 加了 opts 形参 + regen 据 record.* 传入（见 aiAnalysisContext regenerateChartTechniqueSnapshot）。
	zodialrelease: { kind: 'record', fields: ZODIAL_RELEASE_FIELDS },
	decennials: { kind: 'record', fields: DECENNIALS_FIELDS },
	planetaryarc: { kind: 'record', fields: PLANETARY_ARC_FIELDS },
	persiandirected: { kind: 'record', fields: PERSIAN_DIRECTED_FIELDS },
	// [Windows #80] 回归黄道二次推运:与恒星支同一后端同一 builder,齿轮同形。
	prog: { kind: 'record', fields: PROG_TARGET_FIELDS },
	vedicprog: { kind: 'record', fields: PROG_TARGET_FIELDS },
	jaynesprog: { kind: 'record', fields: PROG_TARGET_FIELDS },
	// 推运图族四法:页面同一套设置(星运页保存值)
	neroman: { kind: 'record', fields: NEROMAN_FIELDS },
	bezzafigure: { kind: 'record', fields: BEZZA_FIELDS },
	jayprofection: { kind: 'record', fields: JAY_FIELDS },
	michon: { kind: 'record', fields: MICHON_FIELDS },
	timelords: { kind: 'record', fields: TIMELORD_FIELDS },
	// 目标时刻型 5 法：共用 buildPredictivePeriodSnapshot(chartObj,key,opts)。profection/solararc 只 4 基项；
	// 3 返照(solarreturn/lunarreturn/givenyear)另加 异地 dirLat/dirLon。
	profection: { kind: 'record', fields: [...PREDICTIVE_PERIOD_BASE_FIELDS, ...PROFECTION_SUMMARY_FIELDS] },   // +小限粒度/起点
	solararc: { kind: 'record', fields: PREDICTIVE_PERIOD_BASE_FIELDS.map((f)=>(f.name === 'asporb' ? { ...f, options: directionAsporbOptions(true) } : f)) },   // 弧类:不列「双星容许度相加除以2」
	// 返照三法:页面已隐藏「南北交逆移」(对返照法不适用),Python 三端点不读,快照却照打「月交点逆行：是」→ schema 去掉该字段(与页面同形)。
	solarreturn: { kind: 'record', fields: [...PREDICTIVE_PERIOD_BASE_FIELDS.filter((f)=>f.name !== 'nodeRetrograde'), ...PREDICTIVE_RETURN_DIR_FIELDS] },
	lunarreturn: { kind: 'record', fields: [...PREDICTIVE_PERIOD_BASE_FIELDS.filter((f)=>f.name !== 'nodeRetrograde'), ...PREDICTIVE_RETURN_DIR_FIELDS] },
	givenyear: { kind: 'record', fields: [...PREDICTIVE_PERIOD_BASE_FIELDS.filter((f)=>f.name !== 'nodeRetrograde'), ...PREDICTIVE_RETURN_DIR_FIELDS] },

	// ---- A 类：八字 / 紫微（时间类）----
	bazi: { kind: 'record', fields: [
		// 八字 timeAlg=3 档（真太阳时/直接时间/春分定卯时，源 CnTraditionInput），不复用 2 档 TIME_FIELDS；日界/晚子时共用。
		// 「春分定卯时」页面置灰(未实现,同直接时间):不列(已选者仍显示)
		{ name: 'timeAlg', label: '时间算法', type: 'select', options: BAZI_TIME_ALG_OPTIONS, default: 0, group: '时间换算', optionShown: (o)=>o.value !== 2 },
		...DAY_BOUNDARY_FIELDS,
		// 计算选项（CnTraditionInput phaseType）：长生 火土同/水土同/阳顺阴逆——原 schema 误标「标准/变体」且漏值 2（选不到）。
		{ name: 'phaseType', label: '长生', type: 'select', default: 0, group: '取用', options: [
			{ value: 0, label: '长生火土同（阴阳同序，默认）' },
			{ value: 1, label: '长生水土同（阴阳同序）' },
			{ value: 2, label: '长生阳顺阴逆' },
		] },
		// 神煞主位（CnTraditionInput godKeyPos）：年/日/年日——原 schema 漏「年日」。
		{ name: 'godKeyPos', label: '神煞查法', type: 'select', default: '年', group: '取用', options: [
			{ value: '年', label: '按年柱查（默认）' },
			{ value: '日', label: '按日柱查' },
			{ value: '年日', label: '年柱日柱都查' },
		] },
		// 盘法 4 项（CnTraditionInput 命宫起法/月律分野/起运精度/藏干版本）：BaZi.js:722/767-771 据 baziOpt 触发重算并转发后端,
		//   改命宫/月令分野/起运岁/藏干打分 → 真改 ground-truth。live 盘走 BaZi.js 自身 params;但 AI 挂载侧走 buildChartBaziParams,
		//   此前漏转发 → 挂载/导出快照这 4 项恒默认。补 4 字段 + buildChartBaziParams 同补转发(读 record,与 school 同范式)。默认即现状零回归。
		{ name: 'minggongMethod', label: '命宫起法', type: 'select', default: 'tongxing', globalCurrent: ()=>storedBaziOptValue('minggongMethod'), group: '盘法', options: [
			{ value: 'tongxing', label: '通行版（默认）' },
			{ value: 'shufa', label: '子平数法' },
		] },
		{ name: 'fenyeVersion', label: '月律分野', type: 'select', default: 'common', globalCurrent: ()=>storedBaziOptValue('fenyeVersion'), group: '盘法', options: [
			{ value: 'common', label: '通行版（默认）' },
			{ value: 'fajue', label: '法诀版' },
		] },
		// 南半球月令(只对南纬生效):不对冲 = 月柱同北半球(八字页缺省);对冲 = 月支取对冲之支、按年干重起月干。
		{ name: 'southMonth', label: '南半球月令', type: 'select', default: 'none', globalCurrent: ()=>storedBaziOptValue('southMonth'), group: '盘法', options: [
			{ value: 'none', label: '不对冲（默认）' },
			{ value: 'chong', label: '对冲' },
		] },
		{ name: 'dayunPrecision', label: '起运精度', type: 'select', default: 'precise', globalCurrent: ()=>storedBaziOptValue('dayunPrecision'), group: '盘法', options: [
			{ value: 'precise', label: '精确(年月日时,默认)' },
			{ value: 'integer', label: '整数(取整岁)' },
		] },
		{ name: 'cangVersion', label: '藏干版本', type: 'select', default: 'common', globalCurrent: ()=>storedBaziOptValue('cangVersion'), group: '盘法', options: [
			{ value: 'common', label: '通行版（默认）' },
			{ value: 'fenye', label: '分野加权' },
		] },
		// 节气微调（adjustJieqi）：本地引擎尚未实现该算法 → 暂从挂载设置面隐藏，避免选了不生效误导。
		// 字段仍由 model/buildFieldObject 保留默认 0（不破坏存档/快照结构）。Java 后端算法（BaZi.java
		// adjustJieqiInfo）供日后本地实现参考：仅当出生纬度 23.5°<|lat|<66.5° 时调整，把每个节气的儒略日
		// JDN 平移 delta 天后据以定月柱——北纬 delta=(lat−35)×2、南纬 delta=(lat+35)×2（35°为基准纬度）。
		// { name: 'adjustJieqi', label: '节气微调', type: 'switch', options: ON_OFF, default: 0, group: '取用' },
		// 断命流派(CnTraditionInput school):进快照(切「当前主用流派」标注)。merge 进 record.school →
		// buildChartBaziParams 挂上 params.school → buildBaziSnapshotText 据此标注;缺省 zonghe=现状。各派对照数据恒全算,此项只切主标注。
		{ name: 'school', label: '主用流派', type: 'select', default: 'zonghe', globalCurrent: ()=>storedBaziOptValue('school'), group: '流派', options: [
			{ value: 'zonghe', label: '传统综合（默认）' },
			{ value: 'fuyi', label: '扶抑派' },
			{ value: 'geju', label: '格局派' },
			{ value: 'tiaohou', label: '调候派' },
			{ value: 'bingyao', label: '病药派' },
			{ value: 'tongguan', label: '通关派' },
			{ value: 'mangpai', label: '盲派' },
			{ value: 'nayin', label: '纳音古法' },
		] },
		// 年龄口径 / 生肖归属:只改快照文字(大运岁数按虚岁 / 周岁;生肖按立春 / 正月初一岁首),与页面左栏同两档;
		// 缺省 = 八字页保存的档(页面出快照读的就是它)。进快照的项齿轮都得有,否则 AI 侧不可调也看不见
		{ name: 'ageStyle', label: '年龄', type: 'select', default: 'nominal', globalCurrent: ()=>storedBaziOptValue('ageStyle'), group: '盘法', options: [
			{ value: 'nominal', label: '虚岁' },
			{ value: 'real', label: '周岁' },
		] },
		{ name: 'zodiacBoundary', label: '生肖归属', type: 'select', default: 'lichun', globalCurrent: ()=>storedBaziOptValue('zodiacBoundary'), group: '盘法', options: [
			{ value: 'lichun', label: '立春' },
			{ value: 'lunar', label: '正月初一' },
		] },
		// 天医口径:换四柱 / 流运神煞里天医(与地医)的落支;缺省 = 八字页保存的档(起盘参数同名键)
		{ name: 'tianyiSchool', label: '天医口径', type: 'select', default: 'xieji', globalCurrent: ()=>storedBaziOptValue('tianyiSchool'), group: '取用', options: [
			{ value: 'xieji', label: '协纪辨方书(兼地医)' },
			{ value: 'ziping', label: '子平(月支退一位)' },
		] },
		// 多运限(批A)：流年(逗号年份串) / 流月(节气月序1–12) / 流日(锚定首流年首流月,公历日1–31) / 流时(时辰序0–11)。
		// 全空(默认)=不追加多运限段=现状(守「默认即现状」)。流月读现成 subDirect[].flowMonths；流日/流时调 buildFlowDays/Hours。
		{ name: 'liunianSel', label: '流年(公历年,逗号分隔,如 2024,2025)', type: 'text', default: '', group: '运限' },
		{ name: 'liuyueSel', label: '流月(节气月序1–12,可多选)', type: 'multiselect', default: [], group: '运限', options: LUNAR_MONTH_OPTIONS },
		{ name: 'liuriSel', label: '流日(公历日1–31,可多选,锚定首流年首流月)', type: 'multiselect', default: [], group: '运限', options: LUNAR_DAY_OPTIONS },
		{ name: 'liushiSel', label: '流时(时辰序0–11子起,可多选,锚定首流日)', type: 'multiselect', default: [], group: '运限', options: SHICHEN_OPTIONS },
	] },
	ziwei: { kind: 'record', fields: [
		...ZIWEI_TIME_FIELDS,
		// 四化流派:进快照(切流派改星曜四化标注 + 后端格局判定)。merge 进 record.sihuaSchool →
		// buildChartZiweiParams 挂上 params.sihuaSchool → buildZiweiSnapshotForParams 临时切单例复算(用毕还原)。
		{ name: 'sihuaSchool', label: '四化流派', type: 'select', default: 'beipai', globalCurrent: ()=>ziweiGlobalValue('sihuaSchool'), group: '流派', options: [
			{ value: 'beipai', label: '通用·飞星(默认)' },
			{ value: 'zhongzhou', label: '中州派' },
			{ value: 'quanshu', label: '全书系' },
			{ value: 'beixiang', label: '北派(天相忌)' },
			{ value: 'custom', label: '自定义' },
		] },
		// 四化流派选 custom 时的随盘自定义表(JSON,形状 {"干":["禄星","权星","科星","忌星"]});
		// 留空=custom 档回落本机编辑器所存表。builder 端 normalizeSihuaCustomTable 校验,坏值不注入。
		{ name: 'sihuaCustomTable', label: '自定义四化表(JSON,配合流派=自定义)', type: 'text', default: '', group: '流派', showWhen: (d)=>d.sihuaSchool === 'custom',
			placeholder: '{"甲":["廉贞","破军","武曲","太阳"],...} 留空=用本机表' },
		// [Windows #80] 运限组提前:此前排在 40 项的最末组(时间换算→流派→传本 19 项→流派叠层 10 项→运限),
		//   460px 抽屉里要一路滚到底才看得见,用户报障「似乎没找着流年的勾选项」。仅调声明顺序,渲染按声明序分组。
		// 多选语义：大限/流年/流月对所选每项各产一段(流年×流月笛卡尔);流日/流时锚定到所选的第一个上层。
		// 全空(默认)=不追加[运限]段=现状(守「默认即现状」,逐字节一致)。总段数上限~50,超限截断+提示行。
		// 小限顺逆(P1-B):流年段「小限：」行的宫序方向(ZWLuckPanel buildXiaoxianItems 消费;
		// 曾只读全局 localStorage,schema 放出 liunianSel 却调不到顺逆口径 → 半截可控)。
		// 只影响流年段「小限」行:需填流年才生效
		{ name: 'ziweiXiaoxianYinyang', label: '小限顺逆(随流年段出)', type: 'select', default: '0', globalCurrent: ()=>ziweiGlobalValue('xiaoxianMode'), group: '运限', showWhen: (d)=>!!`${d.liunianSel || ''}`.trim(), options: [
			{ value: '0', label: '男顺女逆（默认）' }, { value: '1', label: '阳男阴女顺（中州）' },
		] },
		{ name: 'daxianSel', label: '大限(命盘宫位序0–11,可多选)', type: 'multiselect', default: [], group: '运限', options: ZIWEI_DAXIAN_OPTIONS },
		// [Windows #80] 标签此前叫「流年小限」——用户找「流年」找不着(报障原话「紫微挂载设置里似乎没找着流年的勾选项」)。
		//   这里留空≠不给流年:[运限概览] 段无条件给全大限×流年的年份干支映射;填年份才另出该年的完整流曜与四化落宫。
		{ name: 'liunianSel', label: '流年(公历年,逗号分隔,如 1996,2000;小限随年并出;留空=只看运限概览)', type: 'text', default: '', group: '运限' },
		{ name: 'liuyueSel', label: '流月(农历月1–12,可多选)', type: 'multiselect', default: [], group: '运限', options: LUNAR_MONTH_OPTIONS },
		{ name: 'liuriSel', label: '流日(农历日1–31,可多选,锚定首个上层)', type: 'multiselect', default: [], group: '运限', options: LUNAR_DAY_OPTIONS },
		{ name: 'liushiSel', label: '流时(时辰序0–11子起,可多选,锚定首个上层)', type: 'multiselect', default: [], group: '运限', options: SHICHEN_OPTIONS },

		// 传本/排盘开关(本地引擎):任一非默认 → buildZiweiSnapshotForParams 临时覆盖 ZWEngineOptions 并以本地引擎重排盘+重算格局,
		// 使挂载/导出快照与该盘传本设置一致;全默认(缺省·被 pruneOptionsToNonDefault 剪掉不进 record)=回退全局单例=现状逐字节一致。
		{ name: 'daxianSpan', label: '大限跨度', type: 'select', default: 10, globalCurrent: ()=>ziweiGlobalValue('daxianSpan'), group: '传本', options: ZW_DAXIAN_SPAN_OPTIONS },
		{ name: 'tianmaBasis', label: '天马依据', type: 'select', default: 'month', globalCurrent: ()=>ziweiGlobalValue('tianmaBasis'), group: '传本', options: ZW_TIANMA_BASIS_OPTIONS },
		{ name: 'starSet', label: '星集', type: 'select', default: 'full', globalCurrent: ()=>ziweiGlobalValue('starSet'), group: '传本', options: ZW_STAR_SET_OPTIONS },
		{ name: 'sanPan', label: '观察盘', type: 'select', default: 'tian', globalCurrent: ()=>ziweiGlobalValue('sanPan'), group: '传本', options: ZW_SANPAN_OPTIONS },
		{ name: 'shangShi', label: '天伤天使', type: 'select', default: 'fixed', globalCurrent: ()=>ziweiGlobalValue('shangShi'), group: '传本', options: ZW_SHANGSHI_OPTIONS },
		{ name: 'leapMonth', label: '闰月归月', type: 'select', default: 'mid_split', globalCurrent: ()=>ziweiGlobalValue('leapMonth'), group: '传本', options: ZW_LEAP_MONTH_OPTIONS },
		{ name: 'lateZi', label: '晚子时', type: 'select', default: 'global', globalCurrent: ()=>ziweiGlobalValue('lateZi'), group: '传本', options: ZW_LATE_ZI_OPTIONS },
		{ name: 'yearBoundary', label: '定年界线', type: 'select', default: 'lunar_1_1', globalCurrent: ()=>ziweiGlobalValue('yearBoundary'), group: '传本', options: ZW_YEAR_BOUNDARY_OPTIONS },
		{ name: 'huoling', label: '火铃起宫', type: 'select', default: 'sanhe', globalCurrent: ()=>ziweiGlobalValue('huoling'), group: '传本', options: ZW_HUOLING_OPTIONS },
		{ name: 'kongNaming', label: '空劫命名', type: 'select', default: 'modern', globalCurrent: ()=>ziweiGlobalValue('kongNaming'), group: '传本', options: ZW_KONG_NAMING_OPTIONS },
		{ name: 'brightnessSource', label: '星曜亮度', type: 'select', default: 'zi_jian', globalCurrent: ()=>ziweiGlobalValue('brightnessSource'), group: '传本', options: ZW_BRIGHTNESS_SOURCE_OPTIONS },
		// 亮度=自定义时的随盘亮度表(JSON,形状 {"星":{"支":"档"}};档=庙旺得地利平闲不陷)。
		// 留空=custom 档回落本机编辑器所存表;builder 端 normalizeBrightnessCustomTable 校验,坏值不注入。
		{ name: 'brightnessCustomTable', label: '自定义亮度表(JSON,配合亮度=自定义)', type: 'text', default: '', group: '传本', showWhen: (d)=>d.brightnessSource === 'custom',
			placeholder: '{"紫微":{"子":"平","丑":"庙"},...} 留空=用本机表' },
		{ name: 'lifeMasterBy', label: '命主取法', type: 'select', default: 'year_branch', globalCurrent: ()=>ziweiGlobalValue('lifeMasterBy'), group: '传本', options: ZW_LIFE_MASTER_BY_OPTIONS },
		{ name: 'changshengStart', label: '长生十二神', type: 'select', default: 'shui_tu', globalCurrent: ()=>ziweiGlobalValue('changshengStart'), group: '传本', options: ZW_CHANGSHENG_START_OPTIONS },
		{ name: 'changshengDirection', label: '长生顺逆', type: 'select', default: 'yinyang', globalCurrent: ()=>ziweiGlobalValue('changshengDirection'), group: '传本', options: ZW_CHANGSHENG_DIRECTION_OPTIONS },
		{ name: 'kongwangStyle', label: '空亡星式', type: 'select', default: 'double', globalCurrent: ()=>ziweiGlobalValue('kongwangStyle'), group: '传本', options: ZW_KONGWANG_STYLE_OPTIONS },
		{ name: 'kuiYue', label: '魁钺歌诀', type: 'select', default: 'jia_wu_geng', globalCurrent: ()=>ziweiGlobalValue('kuiYue'), group: '传本', options: ZW_KUIYUE_OPTIONS },
		{ name: 'liuYueBasis', label: '流月起法', type: 'select', default: 'doujun', globalCurrent: ()=>ziweiGlobalValue('liuYueBasis'), group: '传本', options: ZW_LIU_YUE_BASIS_OPTIONS },
		{ name: 'liunianSihuaGan', label: '流年四化', type: 'select', default: 'year_gan', globalCurrent: ()=>ziweiGlobalValue('liunianSihuaGan'), group: '传本', options: ZW_LIUNIAN_SIHUA_GAN_OPTIONS },
		// 流派叠层显示(纯后处理,开则挂载/导出快照注入对应 ground-truth 段:童限/三限/气数位/借宫/太岁)。默认全关=现状。
		{ name: 'childLimit', label: '童限(上大限前逐岁本命宫)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('childLimit'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'zhongxian', label: '沈氏三限(大限细分2.5年中限)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('zhongxian'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'huoPan', label: '活盘(点宫为太极点重排宫名)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('huoPan'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'qishuWei', label: '河洛气数位(官禄宫干四化回照)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('qishuWei'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'borrowPalace', label: '中州借宫(空宫借对宫正曜)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('borrowPalace'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'taiSuiRuGua', label: '紫云太岁入卦(关系人生肖落宫)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('taiSuiRuGua'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'flowLuanXi', label: '流鸾流喜(运限流曜)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('flowLuanXi'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'flowHuoLing', label: '流火流铃(运限流曜)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('flowHuoLing'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'flowShenshaOnChart', label: '流年神煞上盘(将前/岁前随流年)', type: 'switch', default: 0, globalCurrent: ()=>ziweiGlobalValue('flowShenshaOnChart'), group: '流派叠层', options: ON_OFF, normalize: ZW_SWITCH01 },
		{ name: 'taiSuiRelatives', label: '太岁关系人(支[:角色[:性别]],如 午:母:female 子)', type: 'text', default: '', globalCurrent: ()=>ziweiGlobalValue('taiSuiRelatives'), group: '流派叠层', showWhen: (d)=>(`${d.taiSuiRuGua}` === '1' || d.taiSuiRuGua === true),   /* 需开紫云太岁入卦 */
			// text→[{branch,role,sex}] 归一(与 live UI 同结构):否则 buildZiweiOverlayLines/taiSuiRuGua 的 Array.isArray 判死、挂载侧太岁入卦段静默丢失。
			// 文法扩展 `支[:角色[:性别]]`;裸支向后兼容(role/sex 空)。
			normalize: (v)=>{ if(Array.isArray(v)){ return v; } const bs = `${v == null ? '' : v}`.split(/[,，\s]+/).map((x)=>x.trim()).filter(Boolean); return bs.map((tok)=>{ const seg = tok.split(/[:：]/); return { branch: seg[0], role: seg[1] || '', sex: seg[2] || '' }; }); } },
		// 运限层(多选,批A)：大限已逐宫含于[宫位总览];选所选层即让快照追加[运限]段(逐层钻取四化落宫+流曜)。
		// 流年/流月/流日/流时是盘面交互导航,本由 chart 本地推算(无后端参数)→ 复用 ZWLuckPanel 同口径构造器。
	] },

	// ---- A 类：数算（时间换算 + 流派）----
	// 邵子参评数 method(明法/古法)：buildCanpingSnapshotForRecord/canpingLiunianSeries 透传 opts.method →
	// dayPalace(canpingLocal) 改命宫取法(明法=月支反向 / 古法=日支)，真改快照(round-trip 通)。默认 ming === 现状。
	// 神数正传 zc*：流派/求测时辰/父母年龄/元运/虚岁 → record.zc* → builder opts。
	// 缺省 → builder 回默认（铁板 + 本人时柱作求测时辰）＝现状，字节级一致。
	zhengchuan: { kind: 'record', fields: [
		...TIME_FIELDS_WITH_MEAN,
		{ name: 'zcSchool', label: '流派', type: 'select', default: 'tieban', group: '流派', options: [
			{ value: 'tieban', label: '铁板神数（默认）' },
			{ value: 'shaozi', label: '邵子神数' },
			{ value: 'dading', label: '大定神数' },
			{ value: 'liuqin', label: '六亲属相姓氏断' },
			{ value: 'xinyi', label: '铁算心易（查询）' },
		] },
		{ name: 'zcAskGz', label: '求测时辰（干支，留空取本人时柱）', type: 'text', default: '', group: '铁板', showWhen: zcSchoolIs('tieban') },
		{ name: 'zcFatherAge', label: '父生我时年龄', type: 'number', default: 27, min: 12, max: 99, group: '邵子', showWhen: zcSchoolIs('shaozi') },   // 值域与页面同
		{ name: 'zcMotherAge', label: '母生我时年龄', type: 'number', default: 26, min: 12, max: 99, group: '邵子', showWhen: zcSchoolIs('shaozi') },
		{ name: 'zcYuan', label: '元运（先天命卦余五特例）', type: 'select', default: 'zhong', group: '邵子', showWhen: zcSchoolIs('shaozi'), options: [
			{ value: 'shang', label: '上元' },
			{ value: 'zhong', label: '中元（默认）' },
			{ value: 'xia', label: '下元' },
		] },
		// 大定七位:四柱由生辰定，余三位(大运/小运/岁君)与虚岁皆由【所推之流年】派生 ——
		// 故此处主控亦是流年一项，下四格留作古法特例之手订(留空即自出)。
		{ name: 'zcDadingYear', label: '所推流年（余者自出）', type: 'number', default: 0, group: '大定', showWhen: zcSchoolIs('dading') },
		{ name: 'zcAge', label: '虚岁（留空自出）', type: 'number', default: 0, group: '大定', showWhen: zcSchoolIs('dading') },
		{ name: 'zcDayun', label: '大运（干支，留空自出）', type: 'text', default: '', group: '大定', showWhen: zcSchoolIs('dading') },
		{ name: 'zcXiaoyun', label: '小运（干支，留空自出）', type: 'text', default: '', group: '大定', showWhen: zcSchoolIs('dading') },
		{ name: 'zcSuijun', label: '岁君（干支，留空自出即当年太岁）', type: 'text', default: '', group: '大定', showWhen: zcSchoolIs('dading') },
		// 下拉档与神数页同:演算时辰 12 支(白天 / 昼夜两组四象),天象档随所选时辰(卯—申为天四象,其余为地四象;空 = 取本人时支、按时辰取首项)
		{ name: 'zcAskHourZhi', label: '演算时辰（留空取本人时支）', type: 'select', default: '', group: '六亲', showWhen: zcSchoolIs('liuqin'),
			options: [{ value: '', label: '（取本人时支）' }, ...DIZHI_12.map((z)=>({ value: z, label: `${z}时${ZC_DAY_ZHI.indexOf(z) >= 0 ? '（白天·天四象）' : '（昼夜·地四象）'}` }))] },
		{ name: 'zcEnv', label: '演算时天象', type: 'select', default: '', group: '六亲', showWhen: zcSchoolIs('liuqin'),
			options: [{ value: '', label: '（按时辰取首项）' }, ...zcEnvOptionsFor('')],
			// 档位随演算时辰(与神数页同一份 zcEnvOptionsFor);不属所选时辰那一套的天象回显「按时辰取首项」(引擎按首项算)。
			// 演算时辰留空 = 本人时支:抽屉按本盘四柱注入只读的 __zcOwnHourZhi(mountDraftContextFor);取不到时两组都列
			optionsFor: (d)=>[{ value: '', label: '（按时辰取首项）' }, ...zcEnvOptionsFor(d && (d.zcAskHourZhi || d.__zcOwnHourZhi))],
			displayValue: (v, d)=>zcEnvShown(d && (d.zcAskHourZhi || d.__zcOwnHourZhi), v) },
		{ name: 'zcItem', label: '查询项目', type: 'select', default: '父母', group: '心易', showWhen: zcSchoolIs('xinyi'), options: [
			{ value: '父母', label: '父母（默认）' }, { value: '兄弟', label: '兄弟' }, { value: '姻緣', label: '姻緣' },
			{ value: '子孫', label: '子孫' }, { value: '官祿', label: '官祿' }, { value: '疾病', label: '疾病' },
		] },
		// 心易五项与页面同为下拉(档位逐字取页面:声音 16 档 / 刻数 8 档 / 八宫 / 地支 / 余数 1–12);此前是文本框,可填后端不认的值
		{ name: 'zcSound', label: '声音', type: 'select', default: '日', group: '心易', showWhen: zcSchoolIs('xinyi'), options: ZC_SOUNDS.map((x)=>({ value: x, label: x })) },
		{ name: 'zcKe', label: '刻数', type: 'select', default: '一刻', group: '心易', showWhen: zcSchoolIs('xinyi'), options: ZC_KE.map((x)=>({ value: x, label: x })) },
		{ name: 'zcGong', label: '八宫', type: 'select', default: '乾', group: '心易', showWhen: zcSchoolIs('xinyi'), options: ZC_GONG.map((x)=>({ value: x, label: x })) },
		{ name: 'zcXqZhi', label: '性情项 · 地支', type: 'select', default: '子', group: '心易', showWhen: zcSchoolIs('xinyi'), options: DIZHI_12.map((x)=>({ value: x, label: x })) },
		{ name: 'zcXqYushu', label: '性情项 · 余数', type: 'select', default: '1', group: '心易', showWhen: zcSchoolIs('xinyi'), normalize: (v)=>(v === undefined || v === null ? v : `${v}`),
			options: Array.from({ length: 12 }, (_, i)=>({ value: `${i + 1}`, label: `${i + 1}` })) },
	] },
	canping: { kind: 'record', fields: [
		// 参评数以年柱纳音+月支+时支起,日柱/时干不入算(引擎 calculate 只回显 fourPillars)——
		// 日界/晚子时两档在本技法页面与无头皆无任何产物差异(差分闸 43/40 次候选×盘变体×日期扫描零差分),按「不放无效选项」撤下;时间算法保留。
		...TIME_FIELDS_WITH_MEAN.filter((f)=>f.name === 'timeAlg'),
		{ name: 'method', label: '取法', type: 'select', default: 'ming', group: '取法', options: [
			{ value: 'ming', label: '明法（月支反向，默认）' },
			{ value: 'gu', label: '古法（八字日支）' },
		] },
		// 大运排法三档与页面同枚举:此前挂载不暴露 → 页面选档挂载恒默认(不同构死角)。
		// baziStyle=八字真源注入(节气起运,与八字盘同源);默认 mingGongQiyun === 现状(零回归)。
		{ name: 'dayunRule', label: '大运排法', type: 'select', default: 'mingGongQiyun', group: '取法', options: [
			{ value: 'mingGongQiyun', label: '命宫顺行 · 生日推起运（默认）' },
			{ value: 'mingGongOne', label: '命宫顺行 · 恒一岁起' },
			{ value: 'baziStyle', label: '八字大运法（与八字盘同源）' },
		] },
	] },
	// 河洛 quHuaGong(取化工法)：无头 builder 恒按真实节气算化工(与河洛页同源);两档只差「四立前 18 日土用期是否补坤艮/反乾兑」。
	// 旧标签「月支近似」「真实节气」是早先的区分项,已不实 → 按真实差别改写。
	heluo: { kind: 'record', fields: [
		...TIME_FIELDS_WITH_MEAN,
		{ name: 'quHuaGong', label: '取化工法（皆按真实节气）', type: 'select', default: 'tuWangKunGen', group: '取化工', options: [
			{ value: 'tuWangKunGen', label: '土王寄坤艮（土用期补坤艮／反乾兑，默认）' },
			{ value: 'siFangBoOnly', label: '直取四方伯（土用期不补，仅四方伯卦）' },
		] },
		{ name: 'ziShuMode', label: '取数法', type: 'select', default: 'pair', group: '起卦分歧', options: [
			{ value: 'pair', label: '成对全取（古本，默认）' },
			{ value: 'single', label: '每支取一' },
		] },
		{ name: 'jiGongMode', label: '五寄中宫', type: 'select', default: 'manualSanYuan', group: '起卦分歧', options: [
			{ value: 'manualSanYuan', label: '三元表（默认）' },
			{ value: 'legacy', label: '旧法·性别' },
		] },
		{ name: 'pureGanKunVariant', label: '纯乾坤落爻', type: 'select', default: 'current', group: '起卦分歧', options: [
			{ value: 'current', label: '通行（节气半年，默认）' },
			{ value: 'alt', label: '抄本异（反向·待核）' },
		] },
		{ name: 'zhiZunEnabled', label: '三至尊卦', type: 'switch', options: ON_OFF, default: 1, group: '起卦分歧', normalize: (v)=>(v === true || v === 1 || v === '1') },
		{ name: 'liunianStep2', label: '流年次步', type: 'select', default: 'ying', group: '推运分歧', options: [
			{ value: 'ying', label: '应爻法（默认）' },
			{ value: 'sequential', label: '顺行（初→上）' },
		] },
		// 「流月起月 liuYueMode」齿轮撤下:快照只到流年卦、不含流月段,拨两档正文逐字相同(页面钻取表照常读该键);
		// 若日后把流月表纳入快照(需拍板:正文显著加长)再恢复此齿轮。
		{ name: 'huangdiOffset', label: '纪年基准（黄帝纪元差，默认 2697）', type: 'number', default: 2697, min: 0, max: 16799, group: '断验' },   // 值域与页面同(0 可达)
	] },
	// 诸方杂术:玛雅历 / 十三月亮历前端算;人类图 / 灵名字母按出生资料请后端重算
	// pageStoreBound:齿轮缺省 = 诸方页保存值(globalCurrent),AI 重算记录缺键时也按同一份补(fillPageBoundDefaults)。
	// 此前只有齿轮读页面值、重算写死出厂值:页面改 584285 → 没开过诸方页的盘挂载,齿轮显示 584285、快照仍是 584283。
	zhufang: { kind: 'record', fields: [
		{ name: 'mayanCorrelation', label: '玛雅历·关联常数', type: 'select', default: 584283, pageStoreBound: true, globalCurrent: ()=>storedPageSetting('horosa.zhufang.settings.v1', 'mayanCorrelation', [584283, 584285, 584286]), options: [
			{ value: 584283, label: '584283（默认）' },
			{ value: 584285, label: '584285' },
			{ value: 584286, label: '584286' },
		] },
		{ name: 'hdTrueNode', label: '人类图·交点', type: 'select', default: 'true', pageStoreBound: true, globalCurrent: ()=>{ const v = storedPageSetting('horosa.zhufang.settings.v1', 'hdTrueNode', [true, false]); return v === undefined ? undefined : (v ? 'true' : 'mean'); }, options: [
			{ value: 'true', label: '真交点（默认）' },
			{ value: 'mean', label: '平交点' },
		] },
		{ name: 'spiritQuadrant', label: '灵名字母·象限', type: 'select', default: 1, pageStoreBound: true, globalCurrent: ()=>storedPageSetting('horosa.zhufang.settings.v1', 'spiritQuadrant', [1, 2, 3]), options: [
			{ value: 1, label: '1 · 4 · 7 · 10 宫（默认）' },
			{ value: 2, label: '2 · 5 · 8 · 11 宫' },
			{ value: 3, label: '3 · 6 · 9 · 12 宫' },
		] },
	] },
	// 东亚诸术:纯前端按出生资料重算(易卦星盘另取本命盘);齿轮与页面左栏同两项
	// 字段名带 dongya 前缀:fenyeVersion 是八字齿轮的平铺键,共用会互相带动;缺省跟本页左栏保存值
	dongya: { kind: 'record', fields: [
		{ name: 'dongyaFenyeVersion', label: '算命学·藏干表', type: 'select', default: 'common', pageStoreBound: true, globalCurrent: ()=>storedPageSetting('horosa.dongya.settings.v1', 'fenyeVersion', ['common', 'fajue']), options: [
			{ value: 'common', label: '通行版（默认）' },
			{ value: 'fajue', label: '法诀版' },
		] },
		{ name: 'dongyaIchingMerge', label: '易卦星盘·星卦合入', type: 'select', default: 'horizon', pageStoreBound: true, globalCurrent: ()=>storedPageSetting('horosa.dongya.settings.v1', 'ichingMerge', ['horizon', 'upper', 'lower']), options: [
			{ value: 'horizon', label: '按地平上下（默认）' },
			{ value: 'upper', label: '恒合上卦' },
			{ value: 'lower', label: '恒合下卦' },
		] },
		// 流年(页面上的流年框不跨会话记住;挂载可在这里指定一年看,留空 = 今年)。藏占按藏历年,洛书 / 天中杀按公历年
		{ name: 'dongyaFlowYear', label: '流年(留空 = 今年)', type: 'number', default: '', min: 1, max: 9999, group: '流年', placeholder: '空 → 今年', blankFollowsBaseline: true },
	] },
	yizhangjing: { kind: 'record', fields: [
		// 一掌经只用时支不用时干:「晚子时·时柱进次日」在本技法无产物差异(差分闸 40 次零差分),撤下;日界(日柱→神煞合参层)与时间算法保留。
		// 日界只进「神煞合参层」(一掌经本体只用时支):合参层关时隐藏、不计数不下发
		...TIME_FIELDS_WITH_MEAN.filter((f)=>f.name !== 'lateZiHourUseNextDay').map((f)=>(f.name === 'after23NewDay'
			? { ...f, label: '日界（日柱换日;仅神煞合参层）', showWhen: (d)=>(d.shenshaLayer === true || `${d.shenshaLayer}` === '1') }
			: f)),
		{ name: 'shunniRule', label: '顺逆规则', type: 'select', default: 'yangNanYinNv', group: '排盘分歧', options: [
			{ value: 'yangNanYinNv', label: '阳男阴女（默认）' },
			{ value: 'menShunNvNi', label: '男顺女逆' },
		] },
		{ name: 'mingGongMethod', label: '命宫定法', type: 'select', default: 'shiShang', group: '排盘分歧', options: [
			{ value: 'shiShang', label: '时上起命（默认）' },
			{ value: 'shuZhiMao', label: '数至卯' },
		] },
		{ name: 'dingYue', label: '定月法', type: 'select', default: 'nongli', group: '排盘分歧', options: [
			{ value: 'nongli', label: '农历月（默认）' },
			{ value: 'jieqi', label: '节气月' },
		] },
		{ name: 'dayunLength', label: '大限运长', type: 'select', default: 7, group: '推运分歧', options: [
			{ value: 7, label: '一宫7年（默认）' },
			{ value: 10, label: '一宫10年' },
		] },
		{ name: 'dayunStartAge', label: '大限起运', type: 'select', default: 'mi', group: '推运分歧', options: [
			{ value: 'mi', label: '秘传起运（默认）' },
			{ value: 'age1', label: '1岁连续' },
		] },
		// 随「逐年法」互斥显隐(与页面同):小限两键只在小限法、流年十二神只在流年法
		{ name: 'xiaoxianStart', label: '小限起宫', type: 'select', default: 'ri', group: '推运分歧', showWhen: (d)=>d.annualMethod !== 'liunian', options: [
			{ value: 'ri', label: '日柱宫（默认）' },
			{ value: 'yue', label: '月柱宫' },
		] },
		{ name: 'flowShenSet', label: '流年十二神', type: 'select', default: 'A', group: '推运分歧', showWhen: (d)=>d.annualMethod !== 'xiaoxian', options: [
			{ value: 'A', label: '甲组·太阳系（默认）' },
			{ value: 'B', label: '乙组·六合系' },
			{ value: 'C', label: '丙组·岁破系' },
		] },
		{ name: 'annualMethod', label: '逐年法', type: 'select', default: 'xiaoxian', group: '推运分歧', options: [
			{ value: 'xiaoxian', label: '小限（默认）' },
			{ value: 'liunian', label: '流年十二神' },
		] },
		{ name: 'xiaoxianDir', label: '小限顺逆', type: 'select', default: 'chart', group: '推运分歧', showWhen: (d)=>d.annualMethod !== 'liunian', options: [
			{ value: 'chart', label: '随盘向（默认）' },
			{ value: 'always', label: '一律顺行' },
		] },
		// 定月 = 节气月时没有闰月可言,页面置灰,齿轮不列
		{ name: 'leapRule', label: '闰月细则', type: 'select', default: 'half', group: '排盘分歧', showWhen: (d)=>d.dingYue !== 'jieqi', options: [
			{ value: 'half', label: '十五折半（默认）' },
			{ value: 'midnight', label: '夜半折半' },
		] },
		{ name: 'zaoZiAdjust', label: '早子调宫', type: 'switch', options: ON_OFF, default: 0, group: '排盘分歧', normalize: (v)=>(v === true || v === 1 || v === '1') },
		{ name: 'starNaming', label: '星名系统', type: 'select', default: 'A', group: '命宫与盘', options: [
			{ value: 'A', label: 'A·主流（默认）' },
			{ value: 'B', label: 'B·异名' },
			{ value: 'C', label: 'C·改名' },
		] },
		{ name: 'daoTerm', label: '六道术语', type: 'select', default: 'gui', group: '命宫与盘', options: [
			{ value: 'gui', label: '鬼道·修罗道（默认）' },
			{ value: 'edao', label: '饿鬼道·阿修罗道' },
		] },
		{ name: 'gradeSet', label: '品级分类', type: 'select', default: 'standard', group: '命宫与盘', options: [
			{ value: 'standard', label: '主流（默认）' },
			{ value: 'variant', label: '变体·天驿归凶' },
		] },
		{ name: 'chongfanKou', label: '重犯口诀', type: 'select', default: 'alpha', group: '断语分歧', options: [
			{ value: 'alpha', label: '常见组（默认）' },
			{ value: 'beta', label: '异传组' },
		] },
		{ name: 'tongxianShow', label: '童限', type: 'switch', options: ON_OFF, default: 1, group: '推运分歧', normalize: (v)=>(v === true || v === 1 || v === '1') },
		{ name: 'shenshaLayer', label: '神煞合参', type: 'switch', options: ON_OFF, default: 0, group: '合参层', normalize: (v)=>(v === true || v === 1 || v === '1') },
	] },

	// ---- B 类：事盘 options 驱动 ----
	// 基线按存档 options,旧存「阴盘」盘式先迁移(与页面载档 / 无头重算同一 migrateLegacyQimenSchool)
	// 事盘设置在 payload.options;命盘结构在 payload.qimen.options(与重算 regenerateQimenSnapshot 同一读法)
	qimen: { kind: 'payload', optionsPath: 'options', fields: QIMEN_FIELDS, baselineSource: (payload)=>{
		const chartShape = !!(payload && payload.qimen && typeof payload.qimen === 'object');
		const qs = chartShape ? payload.qimen : payload;
		const o = qs && qs.options && typeof qs.options === 'object' ? qs.options : null;
		if(!o){ return null; }
		// 存成命盘的盘类恒为命局(页面载入即命局;早先存的没记这一项)
		return migrateLegacyQimenSchool(chartShape && (o.chartCategory === undefined || o.chartCategory === null || o.chartCategory === '') ? { ...o, chartCategory: 'ming' } : o);
	} },
	taiyi: { kind: 'payload', optionsPath: 'options', fields: TAIYI_FIELDS, baselineSource: (payload)=>flattenTaiyiSchoolStored(payload, 'school', 'school_') },
	// 皇极轨策：🔴 kind='payload' —— 起卦所得(卦与动爻)是报数/字占/时辰之冻结值，永不按挂载重算
	// （重算即伪造一个不同之卦）；然其后诸演算(演数/卦变/断法/十应)皆自已冻结之卦派生 → 可随 options 重算。
	// 覆盖逐项按页面 setOption 落:改了单项、偏离存档所选预设 → 流派标「自定义」(页面同);
	// 否则存档「大定」预设被齿轮改掉数字配卦后,引擎仍按流派=大定出定数,与页面做不出的组合同盘
	guice: { kind: 'payload', optionsPath: 'options', group: '皇极轨策',
		// 流派先落(像页面「流派预设」那样套该派开关组,起卦法留着),其余逐项改(偏离预设 → 标自定义);「自定义」只是状态,不套预设
		applyOverrides: (stored, pruned)=>{
			let acc = { ...(stored || {}) };
			if(pruned.school !== undefined && GUICE_PRESETS[pruned.school]){ acc = applyGuicePreset(pruned.school, acc); }
			else if(pruned.school === 'custom'){ acc = { ...acc, school: 'custom' }; }
			return Object.keys(pruned).filter((k)=>k !== 'school').reduce((a, k)=>setGuiceOption(a, k, pruned[k]), acc);
		},
		// 齿轮换了流派:剪枝基准里受预设联动的项取该派的值(与重算「先套派、后调项」同序),否则「新派 + 某项恰等于存档值」被剪掉
		adjustPruneBaseline: (base, options)=>{
			if(!base || !options || !GUICE_PRESETS[options.school] || options.school === base.school){ return base; }
			const preset = applyGuicePreset(options.school, base);
			const out = { ...base };
			GUICE_FIELDS_NAMES().forEach((k)=>{ if(k !== 'school' && preset[k] !== undefined){ out[k] = preset[k]; } });
			return out;
		},
		// 整张草稿的抽屉里:换流派 = 套该派开关组(页面同);改单项 = 像页面那样逐项改,偏离所选预设时流派显示「自定义」
		onDraftChange: (draft, name, value)=>{
			if(name === 'school'){
				if(!GUICE_PRESETS[value]){ return draft; }
				const preset = applyGuicePreset(value, draft);
				const out = { ...draft };
				GUICE_FIELDS_NAMES().forEach((k)=>{ if(preset[k] !== undefined){ out[k] = preset[k]; } });
				return out;
			}
			if(GUICE_FIELDS_NAMES().indexOf(name) < 0){ return draft; }
			const next = setGuiceOption(draft, name, value);
			const out = { ...draft };
			GUICE_FIELDS_NAMES().forEach((k)=>{ if(next[k] !== undefined){ out[k] = next[k]; } });
			return out;
		},
		fields: [
		// 流派预设(与轨策页左栏同一张表;「自定义」是状态显示 —— 只在现值是它时列出)
		{ name: 'school', label: '流派预设', type: 'select', default: 'default', group: '流派',
			options: [...markDefaultOption(GUICE_SCHOOL_OPTIONS, 'default'), { value: 'custom', label: '自定义' }],
			optionShown: (o)=>o.value !== 'custom' },
		// 字段名与档名取轨策页同一份表(GUICE_OPTION_META);页面档名没写缺省的,齿轮在缺省档后补「（默认）」
		{ name: 'yanshuFa', label: guiceMetaLabel('yanshuFa'), type: 'select', default: 'ce', group: '演数', options: guiceMetaOptions('yanshuFa', 'ce') },
		{ name: 'qiguaShu', label: guiceMetaLabel('qiguaShu'), type: 'select', default: 'xiantian', group: '演数', options: guiceMetaOptions('qiguaShu', 'xiantian') },
		{ name: 'jiGongMode', label: guiceMetaLabel('jiGongMode'), type: 'select', default: 'ganrou', group: '演数', showWhen: (d)=>d.qiguaShu === 'houtian', options: guiceMetaOptions('jiGongMode', 'ganrou') },   /* 只在数字配卦 = 后天正数时起作用 */
		{ name: 'shiyingSet', label: guiceMetaLabel('shiyingSet'), type: 'select', default: 'xinyifawei', group: '断法', options: guiceMetaOptions('shiyingSet', 'xinyifawei') },
		// 显示条件与页面 schoolNeeds 同:六十甲子定数唯九畴数之系用之(「大定」预设即九畴;改掉数字配卦则流派随之标自定义,
		// 见上 applyOverrides);时方、神煞梅花不用;神煞附于时方(时方关则无效)
		{ name: 'dadingTable', label: guiceMetaLabel('dadingTable'), type: 'select', default: 'xinyifawei', group: '断法', showWhen: (d)=>d.qiguaShu === 'jiuchou', options: guiceMetaOptions('dadingTable', 'xinyifawei') },
		// 🔴 数系/时方/神煞 三项此前【漏登】—— 面板里根本调不着，而它们是九开关中的三个。
		//    (schema 会渲染成挂载设置里的真设置项，漏登=用户在挂载设置里见不到此项。)
		//    起卦法不登:其决定卦本身，而卦是【冻结值】—— 按挂载重起即伪造一个用户没见过的卦。
		{ name: 'shuXi', label: guiceMetaLabel('shuXi'), type: 'select', default: 'zhouyi', group: '断法', options: guiceMetaOptions('shuXi', 'zhouyi') },
		{ name: 'shiFang', label: guiceMetaLabel('shiFang'), type: 'switch', options: ON_OFF, default: false, group: '断法', normalize: (v)=>(v === true || v === 1 || v === '1'), showWhen: (d)=>d.shuXi !== 'meihua' },
		{ name: 'shenSha', label: guiceMetaLabel('shenSha'), type: 'switch', options: ON_OFF, default: false, group: '断法', normalize: (v)=>(v === true || v === 1 || v === '1'), showWhen: (d)=>d.shuXi !== 'meihua' && (d.shiFang === true || d.shiFang === 1 || d.shiFang === '1') },
	] },
	// 小六壬:课(三数)=冻结值不登;流派可重排(换环重排三传,三数不变)。
	xiaoliuren: { kind: 'payload', optionsPath: 'options', group: '小六壬', fields: [
		{ name: 'school', label: '流派', type: 'select', default: 'main', group: '起课', options: [
			{ value: 'main', label: '主流六宫（默认）' }, { value: 'dao', label: '道门九宫' },
		] },
		{ name: 'showOneThree', label: '一↔三(跨传关系行;古籍无定论,只列关系)', type: 'switch', options: ON_OFF, default: true, group: '判读',
			normalize: (v)=>(v === true || v === 1 || v === '1'), showWhen: (d)=>d.school === 'dao' },
	] },
	// 小成图:卦(起卦所出)=冻结值,起卦法/配数流派皆不登(重配=伪造卦);用宫可重排推演。
	xiaochengtu: { kind: 'payload', optionsPath: 'options', group: '小成图', fields: [
		{ name: 'yongGong', label: '用宫(推演起点)', type: 'select', default: 1, group: '推演', options: markDefaultOption(XCT_YONG_GONG_OPTIONS, 1) },   // 档名与小成图页同一份
		// 闢(离心)一象之辞两传本相反(往/來/闔三象两本一致):正传=古籍原文、异文=另本情伪论所推。
		{ name: 'piKoujing', label: '闢卦细判', type: 'select', default: 'zheng', group: '判读',
			options: markDefaultOption([{ value: 'zheng', label: XCT_PI_KOUJING_LABEL.zheng }, { value: 'yiwen', label: XCT_PI_KOUJING_LABEL.yiwen }], 'zheng') },
	] },
	// 飞宫小奇门:局(起支)=冻结值不登;命宫年龄性别只重排命宫目,不动局。
	feigong: { kind: 'payload', optionsPath: 'options', group: '飞宫小奇门', fields: [
		{ name: 'mingAge', label: '命宫年龄', type: 'number', default: null, group: '命宫' },
		{ name: 'mingGender', label: '命宫性别', type: 'select', default: 'male', group: '命宫', options: [
			{ value: 'male', label: '男（值五看戊）' }, { value: 'female', label: '女（值五看己）' },
		] },
		// 流月/河魁口径:payload.options 已存、builder 已消费(buildFeiGongSnapshotText o.liuYueMonth/o.koujing),曾只差齿轮。
		// 原写「留空=不列流月」,但 builder 是 `o.liuYueMonth || 1`(与右栏同源:未选即按正月),
		// 留空与选「1月」逐字同产 —— 「不列」这一档在本技法根本不可表达。按实况改文案(输出零变化)。
		{ name: 'liuYueMonth', label: '流月(留空=按正月)', type: 'select', default: '', group: '推演', options: [
			{ value: '', label: '正月（默认·与右栏同源,未选即按正月）' },
			...FEIGONG_LIU_YUE_MONTH_NAMES.map((m, i)=>({ value: i + 1, label: `${m}月` })),   // 档名与右栏流月下拉同
		] },
		{ name: 'koujing', label: '河魁口径', type: 'select', default: 'zheng', group: '推演', options: [
			{ value: 'zheng', label: '正传·收（默认）' }, { value: 'yi', label: '异文·开' },
		] },
	] },
	liureng: { kind: 'payload', optionsPath: '', fields: LIURENG_FIELDS.concat(QUERENT_FIELDS) },
	// 基线:存档顶层;「是否手选」随档(diFenAuto / wuxingAuto 为真 = 页面是自动档)→ 显示为「自动」,不露当时解析出的具体值
	jinkou: { kind: 'payload', optionsPath: '', fields: JINKOU_FIELDS.concat(QUERENT_FIELDS), baselineSource: (payload)=>{
		const p = payload && typeof payload === 'object' ? payload : null;
		if(!p){ return null; }
		const out = { ...p };
		if(p.diFenAuto === true){ out.diFen = 'auto'; }
		if(p.wuxingAuto === true){ out.wuxing = 'auto'; }
		return out;
	} },
	sanshiunited: { kind: 'payload', optionsPath: 'options', fields: SANSHI_UNITED_FIELDS, baselineSource: (payload)=>migrateLegacyQimenSchool(flattenTaiyiSchoolStored(payload, 'taiyiSchool', 'taiyiSchool_')) },
	// 卜卦/择日盘的存档现状住 payload.extra.*(流派/判读口径/事类专项)与顶层 questionCategory;
	// 此前 optionsPath '' 只看顶层 → 基线恒退 schema 默认:抽屉显「综合·经典主流」撒谎,存了非默认类别/流派的案例
	// 「拨回默认」被剪空(值不可表达)。baselineSource 把存档层展平成 schema 字段名(hp_*/ep_* 前缀同齿轮键)。
	horary: { kind: 'payload', optionsPath: '', fields: HORARY_FIELDS, baselineSource: (payload)=>flattenHoraryStored(payload),
		// 换流派像页面一样清空逐项判读覆盖(HoraryMain 换派连同 horaryOverrides:{} 一起落):重算那边存档覆盖起点取空,
		// 这里剪枝基准的 hp_* 跟着取「随流派」—— 否则「新派 + 某项恰等于存档值」被剪掉,重算却已清掉存档那一项
		adjustPruneBaseline: (base, options)=>{
			// 流派是空串 / null(导入的数据、手改的 JSON 才带得进来)= 没设,不算换派(与重算侧 horaryGearSchoolChanged 同口径)
			if(!base || !options || options.horarySchool === undefined || options.horarySchool === null || options.horarySchool === ''
				|| horarySchoolOrDefault(options.horarySchool) === horarySchoolOrDefault(base.horarySchool)){ return base; }
			const out = { ...base };
			HORARY_JUDGE_FIELDS.forEach((f)=>{ if(!horaryJudgeFieldQuestionScoped(f)){ out[f.name] = ''; } });   // 问谁的事 / 问者性别属这一问,不随流派清
			return out;
		},
		// 整张草稿的抽屉里换流派:逐项判读参数回「随流派」(页面同),否则草稿里还是存档的旧值、与上面的基准一比全成了覆盖
		onDraftChange: (draft, name, value)=>{
			if(name !== 'horarySchool' || value === undefined || value === null || value === ''){ return draft; }
			const out = { ...draft };
			HORARY_JUDGE_FIELDS.forEach((f)=>{ if(!horaryJudgeFieldQuestionScoped(f)){ out[f.name] = ''; } });
			return out;
		},
	},
	election: { kind: 'payload', optionsPath: '', fields: ELECTION_FIELDS, baselineSource: (payload)=>flattenElectionStored(payload) },

	// ---- C 类：builder 自读 localStorage ----
	// localScopeHint:助手改技法本地设置时的作用范围 —— 七政页每个实例只在头一次打开时补一次空(ensureGuolaoDefaults;主 Tab 切走不卸载),
	// 打开时是「坚七政」样式则不补,切到别的样式后左栏字段头一次有变化(换盘、改时间地点或改左栏任一项)时补到那时的盘上
	guolao: { kind: 'localStorage', fields: GUOLAO_FIELDS,
		localScopeHint: '只在本次运行头一次打开七政页时补一次(打开时星盘样式若是「坚七政」,改为切到别的样式后、左栏头一次有变化时补到那时的盘上 —— 换盘、改时间地点或改左栏任一项都算):那张盘未载入记录、该项仍为出厂值才补上;此后新开的盘、当前已载入的盘都不变,重开软件后再补(改当前盘请用户在七政页左栏选;AI 分析口径用 facet=mount)',
		// 审批卡与写入回包给用户看的同义句(不写参数名、不用「请用户…」)
		localScopeHintForUser: '生效时机:本次打开软件后第一次进入七政页时,对还没载入记录、这一项仍是默认值的盘补上(进页时星盘样式若是「坚七政」,则在切到别的样式后、左栏第一次有变化时补上 —— 换盘、改时间地点或改左栏任一项都算);之后新开的盘和已载入的盘不受影响,下次重开软件再进七政页时再补。要改当前这张盘,请在七政页左栏选;只想改 AI 分析用的设置,请到 AI 分析的「挂载设置」' },

	// ---- D 类 / 无重算：只暴露内容勾选 ----
	// 换流派像页面 UranianDialMain.changeSchool 一样套该派预设(中点 / 个人点容许度、六宫框、严格因子集);选回「随全局」四项回随全局。
	// 只在换派时生效,不换派零回归(与六爻 / 卜卦齿轮同一模式)
	germany: { kind: 'record', fields: GERMANY_FIELDS,
		onDraftChange: (draft, name, value)=>{
			if(name !== 'school'){ return draft; }
			const out = { ...draft };
			if(value === '' || value === undefined || value === null){
				GERMANY_SCHOOL_PRESET_KEYS.forEach((k)=>{ out[k] = ''; });
				return out;
			}
			return { ...out, ...germanySchoolPresetDraft(value) };
		},
	},
	// 巴比伦占星:record 类可重算(恒星黄道·毕宿锚固定口径,体系定义即坐标,无可调齿轮);
	// 派系(阶梯/锯齿)只影响数理星历页显示,挂载快照恒取默认基线=零回归。
	// 🔴 旧 emptyHint「派系只影响数理星历页显示」与 babylonSchools.appliesTo:['horoscope',…] 直接矛盾:
	// ephemerisSource/solstice/era 均作用于被挂载的个人星盘页。页面派系是 state 不落档 → 齿轮为唯一持久入口。
	babylon: { kind: 'record', fields: [
		// 档名与巴比伦页派系同一份(BABYLON_SCHEMES.cn);此前另写一套简名,还和「位置源」的选项名相近
		{ name: 'babylonScheme', label: '派系', type: 'select', default: 'swissA10', group: '派系',
			options: BABYLON_SCHEME_ORDER.map((k)=>({ value: k, label: BABYLON_SCHEMES[k].cn })) },
		// 「位置源」只被页面历象表格消费(BabylonEphemeris 按源自算);无头快照的历象摘要恒取后端
		// 实位星历,该齿轮在挂载链无任何消费点 → 留着=「标注撒谎」候选,按「不放无效选项」撤下(页面开关不受影响)。
		// 「分至规范」齿轮已撤:快照只作表头声明、无任何量消费它(与已撤「位置源」同形);页面派系 state 仍可选。
		{ name: 'babylonEra', label: '纪元显示', type: 'select', default: 'seleucid', group: '派系', options: [
			{ value: 'seleucid', label: '塞琉古纪元(S.E.)' }, { value: 'arsacid', label: '安息纪元(= S.E.−64)' },
		] },
	] },
	// 老黄历:纯日期确定复算,无齿轮
	huangli: { kind: 'sectionsOnly', reason: '老黄历按起课日期确定复算,无可调参数;内容勾选照常。' },
	// 黄历择日:日课判定同 huangli 零参数;择吉三段随宿主快照槽实时产出,内容勾选照常。
	huanglizeri: { kind: 'sectionsOnly', reason: '黄历择日日课零可调参数;择吉配置/条件/命中随快照实时产出。' },
	// 八字择日:盘面口径随宿主工作台(与主八字页同枚举),快照槽实时产出;挂载复算不适用。
	bazizeri: { kind: 'sectionsOnly', reason: '八字择日盘面口径由择日工作台冻结,快照(八字全文+择时三段)实时产出;内容勾选照常。' },
	taiyizeri: { kind: 'sectionsOnly', reason: '太乙择日盘面口径由择日工作台冻结,快照(太乙全文+择时三段)实时产出;内容勾选照常。' },
	ziweizeri: { kind: 'sectionsOnly', reason: '紫微择日盘面口径由择日工作台冻结,快照(紫微全文+择时三段)实时产出;内容勾选照常。' },
	liurengzeri: { kind: 'sectionsOnly', reason: '六壬择日盘面口径由择日工作台冻结,快照(六壬全文+择时三段)实时产出;内容勾选照常。' },
	sanshizeri: { kind: 'sectionsOnly', reason: '三式择日盘面口径由择日工作台冻结,快照(三式合一全文+择时三段)实时产出;内容勾选照常。' },
	qizhengzeri: { kind: 'sectionsOnly', reason: '七政择日盘面口径由择日工作台冻结,快照(七政全文+择时三段)实时产出;内容勾选照常。' },
	indiazeri: { kind: 'sectionsOnly', reason: '印度择日盘面口径由择日工作台冻结,快照(印占全文+择时三段)实时产出;内容勾选照常。' },
	// 通书择日:齿轮落 payload.tongshu(regenerate 读 {...defaults, ...p.tongshu} —— 该读点此前无任何写入方)
	// 缺省 = 通书页保存的设置(页面起断读的就是它;重算的底同源,见 regenCase 'tongshu')—— 此前缺省恒董公 / 嫁娶,页面改过流派的用户 AI 按另一派断
	tongshu: { kind: 'payload', optionsPath: 'tongshu', group: '通书择日', fields: [
		{ name: 'school', label: '流派', type: 'select', default: 'donggong', globalCurrent: ()=>tongshuPageSetting('school'), options: [
			{ value: 'donggong', label: '董公择日' },
			{ value: 'qimen', label: '奇门叠数（裴晋公·唐）' },
			{ value: 'sanyuanliexiu', label: '三垣列宿加临（古法）' },
			{ value: 'wutu', label: '天元乌兔' },
			{ value: 'sanyuan', label: '三元玄空大卦' },
		] },
		// 用事:全流派快照「用事：」抬头行 + 董公宜忌判读消费(曾缺 → 挂载恒「嫁娶」)。全表按类分组平铺。
		// 页面只在董公流派下出用事选择(schoolNeeds),齿轮同
		{ name: 'event', label: '用事', type: 'select', default: '嫁娶', globalCurrent: ()=>tongshuPageSetting('event'), showWhen: (d)=>(d.school || 'donggong') === 'donggong',
			// 同名用事在多类里重复出现(如「启钻」营建 / 丧葬各一条)时并成一档、标签列全类 —— 此前两档同值,选第二个显示成第一个
			options: TONGSHU_TERM_CATEGORIES.reduce((acc, cat)=>{
				(TONGSHU_TERMS[cat] || []).forEach((t)=>{
					const hit = acc.find((o)=>o.value === t.name);
					if(hit){ hit.label = `${hit.label.split('·').slice(0, -1).join('·')}/${cat}·${t.name}`; return; }
					acc.push({ value: t.name, label: `${cat}·${t.name}` });
				});
				return acc;
			}, []) },
		{ name: 'liexiuUse', label: '列宿用事类(三垣列宿加临)', type: 'select', default: '建宅', globalCurrent: ()=>tongshuPageSetting('liexiuUse'), showWhen: (d)=>d.school === 'sanyuanliexiu', options: [
			{ value: '建宅', label: '建宅·营造' },
			{ value: '修造', label: '修造·安门灶' },
			{ value: '安葬', label: '安葬·丧事' },
			{ value: '造命', label: '造命·择时立命' },
		] },
		// 主事仙命年(三元玄空档消费;曾缺 → 玄空派恒按甲子命年判)。when 对象式条件显隐。
		{ name: 'mingYear', label: '主事仙命年(三元玄空)', type: 'select', default: '甲子', globalCurrent: ()=>tongshuPageSetting('mingYear'), when: { school: 'sanyuan' },
			options: GANZHI_60.map((g)=>({ value: g, label: g })) },
		// zuoShan 已删:双重幽灵 —— 无任何流派声明 needs.zuoShan(页面控件永不渲染),快照 builder 全文不消费
		// (三元玄空段末自注「坐向卦须六十四卦天圆图…本法从缺」);齿轮选它 100% 无效果。
	] },
	// 🔴 旧定性「sectionsOnly 不可改卦象」过宽:不可改的只有卦象本身;21 项判读口径经冻结卦重算恒安全。
	sixyao: { kind: 'payload', optionsPath: 'liuyaoSettings', group: '六爻', fields: SIXYAO_FIELDS,
		// 存档现状住 payload.gua.liuyaoSettings(存档层);optionsPath 顶层是覆盖层(merge 写入、
		// mergeLiuyaoGearSettings 与存档合并)。基线锚必须读存档层,否则恒退 schema 默认。
		baselineSource: (payload)=>flattenLiuyaoStored(payload),
		// 齿轮换了流派:受流派联动的键按目标预设的值作剪枝基准(与重算「先套派、后调项」同序)——
		// 否则「新派 + 某项等于存档值」被剪掉,重算按预设值出(页面上做得出这个组合,显示为自定义)
		adjustPruneBaseline: (base, options)=>{
			if(!base || !options || options.school === undefined || options.school === base.school || !LIUYAO_PRESETS[options.school]){ return base; }
			const preset = applyLiuyaoPreset(options.school, base);
			['askType', 'yongOverride', 'benming'].forEach((k)=>{ if(base[k] !== undefined){ preset[k] = base[k]; } });
			return { ...base, ...flattenLiuyaoStored({ gua: { liuyaoSettings: preset } }), school: base.school };
		},
		// 整张草稿的抽屉里换流派:像页面「切换流派」那样把目标预设的细项写回草稿(占测事项 / 用神 / 本命留草稿值),
		// 否则草稿里还是存档的旧细项,与上面按预设作的剪枝基准一比,全成了「显式改回存档值」→ 结果成了自定义
		onDraftChange: (draft, name, value)=>{
			if(name !== 'school' || !LIUYAO_PRESETS[value]){ return draft; }
			const preset = applyLiuyaoPreset(value, draft);
			['askType', 'yongOverride', 'benming'].forEach((k)=>{ if(draft[k] !== undefined){ preset[k] = draft[k]; } });
			const flat = flattenLiuyaoStored({ gua: { liuyaoSettings: preset } }) || {};
			const out = { ...draft };
			SIXYAO_FIELDS.forEach((f)=>{ if(flat[f.name] !== undefined){ out[f.name] = flat[f.name]; } });
			out.school = value;
			return out;
		},
		emptyHint: '卦象与动爻取自已存起卦结果、恒不重起;以下皆为判读口径。' },
	tongshefa: { kind: 'sectionsOnly', reason: '统摄法基于已起卦象的确定性结果，仅可调纳入内容、不可重算。' },
	// 已存的世俗盘事盘照旧直读存档快照;按起课时间起 / 拨了下面的设置时现算(aiAnalysisContext/regenMundane,正文与页面同一个构建函数)
	mundane: { kind: 'payload', optionsPath: '', emptyHint: '世俗盘按起课时间定起盘时刻:入宫盘取当年(或指定年份)的节气入宫时刻;新满月 / 日月食取起课时间之前最近的一次;地区盘取所选地区的建置时刻(不选 = 本盘时间地点即建置);行星周期与世运卜卦就用起课时间;恒星派入境 / 吠陀世运取当年(或指定年份)的恒星入境时刻。', fields: [
		{ name: 'mundaneType', label: '盘种', type: 'select', default: 'ingress', group: '世俗盘', options: [
			{ value: 'ingress', label: '入宫盘' }, { value: 'newmoon', label: '新月图' }, { value: 'fullmoon', label: '满月图' }, { value: 'solecl', label: '日食图' }, { value: 'lunecl', label: '月食图' },
			{ value: 'region', label: '地区盘' }, { value: 'cycles', label: '行星周期' }, { value: 'solunar', label: '恒星派入境' }, { value: 'vedicmundane', label: '吠陀世运' }, { value: 'mundanehorary', label: '世运卜卦' },
		] },
		{ name: 'ingressTerm', label: '入宫节气', type: 'select', default: '春分', group: '世俗盘', options: ['春分', '夏至', '秋分', '冬至'].map((v)=>({ value: v, label: v })), showWhen: (d)=>(d.mundaneType || 'ingress') === 'ingress' },
		{ name: 'ingressYear', label: '年份(空=起课时间那年)', type: 'number', default: '', min: -12999, max: 16799, step: 1, group: '世俗盘', showWhen: (d)=>['ingress', 'solunar', 'vedicmundane'].indexOf(d.mundaneType || 'ingress') >= 0 },
		{ name: 'regionKey', label: '地区', type: 'select', default: '', group: '世俗盘', showWhen: (d)=>d.mundaneType === 'region', options: [{ value: '', label: '本盘时间地点即建置' }].concat(Object.keys(REGION_CHARTS).map((k)=>({ value: k, label: REGION_CHARTS[k].cn }))) },
		{ name: 'regionCandidate', label: '建置时刻候选', type: 'select', default: 'a', group: '世俗盘', showWhen: (d)=>d.mundaneType === 'region' && !!d.regionKey, options: [{ value: 'a', label: '首候选(最通行)' }, { value: 'b', label: '候选 b' }, { value: 'c', label: '候选 c' }] },
		{ name: 'regionTargetYear', label: '推运目标年(空=选了地区取起课那年,本盘即建置取今年)', type: 'number', default: '', min: -12999, max: 16799, step: 1, group: '世俗盘', showWhen: (d)=>d.mundaneType === 'region' },
		{ name: 'solunarType', label: '入境盘种', type: 'select', default: 'capsolar', group: '世俗盘', showWhen: (d)=>d.mundaneType === 'solunar', options: SOLUNAR_TYPES.map((t)=>({ value: t.key, label: t.cn })) },
		{ name: 'vedicEvent', label: '入境盘', type: 'select', default: 'ingress_0', group: '世俗盘', showWhen: (d)=>d.mundaneType === 'vedicmundane', options: [{ value: 'ingress_0', label: '梅沙入境(年度主盘)' }, { value: 'ingress_90', label: '夏季盘' }, { value: 'ingress_180', label: '秋季盘' }, { value: 'ingress_270', label: '冬季盘' }] },
		{ name: 'mhKind', label: '问题类型', type: 'select', default: 'war', group: '世俗盘', showWhen: (d)=>d.mundaneType === 'mundanehorary', options: MUNDANE_HORARY_KINDS.map((k)=>({ value: k.key, label: k.cn })) },
		{ name: 'mundaneRuleset', label: '规则集', type: 'select', default: 'modern', globalCurrent: ()=>{ try{ return require('../../components/mundane/MundaneMain').MUNDANE_PAGE_SETTINGS.load().mundaneRuleset; }catch(e){ return undefined; } }, group: '口径',
			options: MUNDANE_RULESETS.map((r)=>({ value: r.key, label: r.label })) },
	] },
	// 分至:起课时间源按时点那一年现算二分二至四盘;没有可调设置(宫制等随记录)
	jieqi: { kind: 'payload', optionsPath: '', fields: [], emptyHint: '分至按起课时间那一年起二分二至四盘与二十四节气,没有可调设置。' },
	tianxing: { kind: 'sectionsOnly', reason: '天星择日按存档快照直读(征象搜索结果为一次性产物,不按时间复算);要改条件请在择日页重搜后重存。' },
	qimenzeri: { kind: 'sectionsOnly', reason: '奇门择日按存档快照直读(找局结果为一次性产物,不按时间复算);要改条件/参数请在择日页重找后重存。' },
	// auxchart 页面键在挂载链会被映射成子 tab 技法键(aiExport auxchartMap 同构),此处条目永不命中
	// —— 曾挂着一条孤儿 sectionsOnly(挂载链未接),删除以免误导。
	// 报数/揲蓍 等确定性起卦术（均已在 CASE_TYPE_OPTIONS 可存为事盘 + saveModuleAISnapshot 存模块快照）：
	// 此前可存事盘却挂不上，补登记 sectionsOnly（挂载走缓存、不重算），与 sixyao/tongshefa/mundane 同范式。
	// 注：otherbu(骰子,随机)/fengshui(风水)/jieqi(节气盘) 暂不在 CASE_TYPE_OPTIONS（无事盘存储），不在此补挂载——见 windows/AGENTS 交接。
	// 起课时间挂载补全后,4 个数算技法 builder 收 opts → 可按用户挂载设置真重算:
	// taixuan/jingjue: seed 覆盖时间派生; wuzhao: mode/number/manual; shenyishu: hourSource/manualHour/seasonSource/manualSeason。
	// 默认值与各 Main.js state.* 同 → 不改时与现状字节级一致(守「默认即现状」)。
	// 四技法页面存档落 payload.options.*,齿轮 merge 写顶层(重算 `p[key] ?? options[key]` 顶层优先);
	// 此前基线只看顶层 → 抽屉恒显 schema 默认、「拨回默认」被剪。基线=存档 options 打底 + 顶层覆盖。
	wuzhao: { kind: 'payload', optionsPath: '', fields: WUZHAO_FIELDS, baselineSource: (payload)=>flattenOptionsStored(payload) },
	taixuan: { kind: 'payload', optionsPath: '', fields: TAIXUAN_FIELDS, baselineSource: (payload)=>flattenOptionsStored(payload) },
	jingjue: { kind: 'payload', optionsPath: '', fields: JINGJUE_FIELDS, baselineSource: (payload)=>flattenOptionsStored(payload) },
	shenyishu: { kind: 'payload', optionsPath: '', fields: SHENYISHU_FIELDS, baselineSource: (payload)=>flattenOptionsStored(payload) },
	// 🔴 天文地占旧定性「sectionsOnly」过宽:figure 由 seedMode:'manual'+seed 冻结(存档已带),
	// 判读轴(流派/层级/占星体系/所问宫/转宫)重算恒不换卦;seedMode/seed/question 不登(登=可伪造新卦)。
	// 默认 '' = 随档(prune 剪掉 → builder 落存档值);granular(传本逐项改写 dict)非控件型,随档回放不进齿轮。
	geomancy: { kind: 'payload', optionsPath: 'options', group: '天文地占',
		// 换流派预设像页面一样清空传本逐项改写(GeomancyMain.changeGeomancyOpt:换 tradition 连同 granular:{} 一起落);
		// 不换派时存档的逐项改写照旧随档回放。存档缺流派 = 页面默认古典定局派
		applyOverrides: (stored, pruned)=>{
			const st = stored && typeof stored === 'object' ? stored : {};
			const changed = pruned && pruned.tradition !== undefined && `${pruned.tradition}` !== `${st.tradition || 'european_classical'}`;
			const out = { ...st, ...(pruned || {}) };
			if(changed){ out.granular = {}; }
			return out;
		},
		fields: [
		{ name: 'tradition', label: '流派预设', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' },
			{ value: 'european_classical', label: '古典定局派' }, { value: 'european_planetary', label: '行星共鸣派' },
			{ value: 'european_modern', label: '现代综合派(判读同古典口径)' }, { value: 'arabic_raml', label: '阿拉伯沙占派' },
			{ value: 'india_ramal', label: '印度骰占派' }, { value: 'sikidy', label: '异或表盘(Sikidy)' },
			{ value: 'hakata', label: '四片盘(Hakata)' },
			// 起盘后页面按后端回传的全部 9 派可选(这两派显示名与 GeomancyMain TRADITION_EXTRA_LABELS 同)
			{ value: 'greek', label: '希腊拜占庭派' }, { value: 'ifa', label: '西非同族对照' },
		] },
		{ name: 'readingScope', label: '读取范围', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' },
			{ value: 'L0', label: 'L0 仅判官' }, { value: 'L1', label: 'L1 三图(证·判)' },
			{ value: 'L2', label: 'L2 盾牌全局' }, { value: 'L3', label: 'L3 十二宫' }, { value: 'L4', label: 'L4 占星定局' },
		] },
		{ name: 'zodiacSystem', label: '黄道体系', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'classical', label: '古典定局体系' }, { value: 'planetary', label: '行星归属体系' },
			{ value: 'planetary_alt', label: '行星归属·乙(另一传本表)' },
		] },
		// 图形入宫三式:与落星法(granular,非控件型故不登齿轮)是正交两维
		{ name: 'housePlacement', label: '图形入宫', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认顺铺）' }, { value: 'sequential', label: '顺铺(一至十二卦入一至十二宫)' },
			{ value: 'angular', label: '四正入宫(果宫取合成卦)' }, { value: 'golden_dawn', label: '近世学派置换' },
		] },
		// 所问宫 / 转宫档名与地占页同一份(geomancyOptions.js)
		{ name: 'quesitedHouse', label: '所问宫', type: 'select', default: '', blankFollowsBaseline: true, group: '判读',
			options: [{ value: '', label: '随档/问类预设（默认）' }, ...GEO_QUESITED_HOUSE_OPTIONS.map((o)=>({ value: o.v, label: `第 ${o.v} 宫 · ${o.label}` }))] },
		{ name: 'turnTo', label: '转宫(以某宫为新命宫)', type: 'select', default: '', group: '判读',
			options: [{ value: '', label: '不转(本命起,默认)' }, ...GEO_TURN_HOUSE_LABELS.map((lb, i)=>({ value: i + 1, label: `第 ${i + 1} 宫 · ${lb}` }))] },
		// 另起行星地占盘四键(页面左栏同名四项,地占快照 buildGeomancySnapshotForFields 已读):''=随档;此前只在页面设置 → 无头起盘改不到。
		// 后三项只在「起」时有用(页面同):showWhen 跟实际是否起盘(存档 true 或齿轮选 1)
		{ name: 'planetaryChart', label: '另起行星地占盘', type: 'select', default: '', blankFollowsBaseline: true, group: '行星地占盘', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '起' }, { value: 0, label: '不起' },
		] },
		{ name: 'planetaryChartZodiac', label: '星座对应表', type: 'select', default: '', blankFollowsBaseline: true, group: '行星地占盘', showWhen: geoPlanetaryChartOn, options: [
			{ value: '', label: '随档（默认）' }, ...GEO_PCHART_ZODIAC_OPTIONS.map((o)=>({ value: o.key, label: o.label })),
		] },
		{ name: 'planetaryChartNodes', label: '加北交·南交(南交取对宫)', type: 'select', default: '', blankFollowsBaseline: true, group: '行星地占盘', showWhen: geoPlanetaryChartOn, options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '加' }, { value: 0, label: '不加' },
		] },
		{ name: 'planetaryChartExtras', label: '加月孛·三王星', type: 'select', default: '', blankFollowsBaseline: true, group: '行星地占盘', showWhen: geoPlanetaryChartOn, options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '加' }, { value: 0, label: '不加' },
		] },
	] },
	// 灵棋经:卦(棋数)=冻结值不登(重掷=伪造一个用户没见过的卦);注家显示/课断/断诗/问类
	// 皆判读显示层,''=随档(三态 select,免 switch 默认值静默覆盖档内口径)。
	lingqi: { kind: 'payload', optionsPath: 'options', group: '灵棋经', emptyHint: '棋势取自已存起卦结果、恒不重掷;以下皆为判读显示口径。', fields: [
		// 注家四项:齿轮文字与页面左栏芯片同一份(简称 + 悬停全名;lingqiZhuChipLabel / lingqiZhuChipTitle 单源)
		...LINGQI_ZHU_META.map((zm)=>({ name: `zhu_${zm.key}`, label: lingqiZhuChipLabel(zm), title: lingqiZhuChipTitle(zm), type: 'select', default: '', blankFollowsBaseline: true, group: '注家', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '显示' }, { value: 0, label: '隐藏' },
		] })),
		{ name: 'zhu_ke', label: '课断', title: '此课总断', type: 'select', default: '', blankFollowsBaseline: true, group: '注家', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '显示' }, { value: 0, label: '隐藏' },
		] },
		{ name: 'zhu_shi', label: '断诗', title: '诗曰 / 又曰', type: 'select', default: '', blankFollowsBaseline: true, group: '注家', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '显示' }, { value: 0, label: '隐藏' },
		] },
		{ name: 'category', label: '问类', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'general', label: '通用' }, { value: 'career', label: '仕途' },
			{ value: 'wealth', label: '求财' }, { value: 'marriage', label: '婚姻' }, { value: 'health', label: '疾病' },
			{ value: 'travel', label: '行人' }, { value: 'lawsuit', label: '官讼' }, { value: 'home', label: '家宅' },
		] },
	] },
	// 🔴 塔罗旧定性同上:牌面只由 deckId/spreadType/seed 决定(存档写死 manual+seed),
	// settings 全落判读层 —— 同一副牌不同判读文本恒安全;deckId/spreadType/seed/question 不登。
	tarot: { kind: 'payload', optionsPath: 'options', group: '塔罗', baselineSource: (payload)=>flattenTarotStored(payload), fields: [
		{ name: 'meaningSystem', label: '牌义体系', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'manual', label: '逐牌义' }, { value: 'waite', label: 'Waite 1911' },
			{ value: 'degrees', label: '数字度(马赛)' },
		] },
		{ name: 'reversalMode', label: '逆位读法', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'stored', label: '预存逆位义' }, { value: 'blocked', label: '受阻/压抑' },
			{ value: 'internal', label: '内化/私密' }, { value: 'opposite', label: '相反/反义' },
			{ value: 'reduced', label: '减弱' }, { value: 'excess', label: '过度/失衡' },
			{ value: 'delayed', label: '延迟/时机' }, { value: 'projection', label: '投射' }, { value: 'misuse', label: '误用/错向' },
			{ value: 'negation', label: '不是/没有' }, { value: 'breakthrough', label: '突破/解脱' }, { value: 're_words', label: '回撤/重审' },
			{ value: 'retreat', label: '回退前课' },
		] },
		// 变体 / 现代行星注 / 宫廷两体系:存档关着进阶对应时不出、不计、不下发(关着不生效,见 tarotCorrespondenceContext)
		{ name: 'variant', label: '字母/路径变体', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', showWhen: tarotCorrespondenceShown('__tarotCorrespondenceVariant'), options: [
			{ value: '', label: '随档（默认）' }, { value: 'A', label: 'A 金色黎明' }, { value: 'B', label: 'B 托特' }, { value: 'C', label: 'C 大陆' },
		] },
		// 档名与顺序取塔罗页(通行五法 + 进阶三法,YESNO_MODE_LABEL)
		{ name: 'verdictMode', label: 'Yes/No 定局法', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' },
			...['majority', 'orientation', 'single', 'numeric', 'polarity', 'weighted_center', 'anchor', 'single3'].map((m)=>({ value: m, label: TAROT_YESNO_MODE_LABEL[m] })),
		] },
		{ name: 'dignities', label: '元素尊位', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
		] },
		{ name: 'suitElementSwap', label: '火/风互换(少数派)', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
		] },
		// TP9 判读齿轮扩容(五书补齐):全部判读显示层——同一副牌不同判读文本;牌面(deckId/spreadType/seed/牌池/朝向生成)恒不入。
		{ name: 'quintMode', label: '精华牌口径', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'standard', label: '通行' }, { value: 'fool22', label: '愚人廿二(数值加法)' },
		] },
		// 元素尊位实际为开才出尊位版本:基线 flattenTarotStored 把存档 settings.dignities 摊成 1 / 0;选「随档」(空)时可能是开,照出
		{ name: 'edVersion', label: '尊位版本(元素尊位开时)', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', showWhen: (d)=>`${d.dignities}` === '1' || d.dignities === '' || d.dignities === undefined || d.dignities === null, options: [
			{ value: '', label: '随档（默认）' }, { value: 'modern', label: '现行三档' }, { value: 'mathers', label: '原典四档' },
		] },
		{ name: 'ookTable', label: '开钥计数表', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'standard', label: '通行' }, { value: 'sephira', label: '质点' },
		] },
		{ name: 'astroModern', label: '三元素大牌附现代行星注', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', showWhen: tarotCorrespondenceShown('__tarotCorrespondenceVariant'), options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
		] },
		{ name: 'timingMethod', label: '计时法', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 'suit_unit', label: '花色单位' }, { value: 'major_number', label: '大牌数字' },
			{ value: 'major_zodiac', label: '大牌星座' }, { value: 'decan_full', label: '旬星全谱' }, { value: 'ace_hunt', label: '翻至王牌' },
		] },
		{ name: 'timingUnit', label: '计时单位(大牌数字法)', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', showWhen: (d)=>d.timingMethod === 'major_number' || d.timingMethod === '' || d.timingMethod === undefined || d.timingMethod === null, options: [   // 只在大牌数字法下有用(选「随档」时可能是,照出)
			{ value: '', label: '随档（默认）' }, { value: '天', label: '天' }, { value: '周', label: '周' }, { value: '月', label: '月' },
		] },
		{ name: 'courtElementSystem', label: '宫廷元素体系', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', showWhen: tarotCorrespondenceShown('__tarotCorrespondenceOn'), options: [
			{ value: '', label: '随档（默认）' }, { value: 'gd', label: '元素中元素' }, { value: 'alt', label: '位阶制' },
		] },
		{ name: 'courtZodiacSystem', label: '宫廷星座体系', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', showWhen: tarotCorrespondenceShown('__tarotCorrespondenceOn'), options: [
			{ value: '', label: '随档（默认）' }, { value: 'gd_span', label: '跨段' }, { value: 'simple', label: '单座制' },
		] },
		{ name: 'crossingUpright', label: '交叉牌横置(恒正读)', type: 'select', default: '', blankFollowsBaseline: true, group: '判读', options: [
			{ value: '', label: '随档（默认）' }, { value: 1, label: '开' }, { value: 0, label: '关' },
		] },
	] },
};

// 星运系里「参数固定 = 现状」的纯推运技法：无可调重算项，但仍登记（显式 emptySchema）让自检无遗漏、UI 显示「仅内容勾选」。
// 批3 已为 zodialrelease/decennials/planetaryarc/persiandirected/vedicprog/jaynesprog/profection/solararc/
//   solarreturn/lunarreturn/givenyear 配了真 fields（上方显式登记），故从空集移除。
const PROGRESSION_EMPTY_KEYS = [
	'firdaria', 'planetaryages',
	'lunationphase',
	'prenatalsyzygy',
];

// 星历 / 回归轴 / 多重回归:区间、起始年与年数、星体与回数此前只是页面上的查询输入,挂载与外部智能体只能拿到
// 「今日起 90 天」「今年起 12 年」「土木月交各 5 回」这一份。现在是挂载设置(都留缺省 = 与此前逐字相同)。
TECHNIQUE_SETTINGS_SCHEMA.ephemeris = { kind: 'record', emptyHint: '星历按区间列入座 / 留逆 / 朔望弦 / 食相与行运触发;两项都留空 = 今日起 90 天。', fields: [
	{ name: 'ephStartDate', label: '起始日期(空=今日)', type: 'date', default: '', group: '区间' },
	{ name: 'ephEndDate', label: '结束日期(空=起始日后 90 天)', type: 'date', default: '', group: '区间' },
] };

TECHNIQUE_SETTINGS_SCHEMA.returntimeline = { kind: 'record', emptyHint: '回归轴列逐年的太阳返照与首个月亮返照;都留缺省 = 今年起 12 年。', fields: [
	{ name: 'rtStartYear', label: '起始年(空=今年)', type: 'number', default: '', min: -12999, max: 16799, step: 1, group: '区间', placeholder: '如 2030' },
	{ name: 'rtCount', label: '年数 (1-40)', type: 'number', default: 12, min: 1, max: 40, step: 1, group: '区间' },
] };

TECHNIQUE_SETTINGS_SCHEMA.extrareturns = { kind: 'record', emptyHint: '列出各星回到本命黄经的日期;缺省 = 土星 / 木星 / 月交三体各 5 回。', fields: [
	{ name: 'erBodies', label: '星体', type: 'multiselect', default: EXTRA_RETURN_SNAPSHOT_BODIES.slice(), group: '多重回归', options: EXTRA_RETURN_BODY_OPTIONS },
	{ name: 'erCount', label: '回数', type: 'select', default: EXTRA_RETURN_SNAPSHOT_COUNT, group: '多重回归', options: EXTRA_RETURN_COUNT_OPTIONS.map((n)=>({ value: n, label: `${n} 回` })) },
] };

PROGRESSION_EMPTY_KEYS.forEach((key)=>{
	if(!TECHNIQUE_SETTINGS_SCHEMA[key]){
		TECHNIQUE_SETTINGS_SCHEMA[key] = {
			kind: 'record',
			fields: [],
			emptyHint: '该推运按本命盘的默认参数生成，挂载仅支持内容勾选。',
		};
	}
});

// 星运族的口径只有一套(星运页保存值,utils/directionPageSettings):这些齿轮字段的「现状默认」= 星运页保存的值
// (没保存过 = 出厂默认),AI 重算缺键时回落同一份(fillPageBoundDefaults)。此前齿轮基线与重算都只认出厂默认:
// 页面上把界推运发放点改成天顶,AI 分析 / 报告里仍按上升算,而且是否读到页面口径还取决于有没有打开过那一页。
// 键:技法 → { 齿轮字段: 星运页字段 };开关字段(交点逆移)页面存布尔、齿轮用 0/1。
export const DIRECTION_PAGE_BOUND_FIELDS = {
	persiandirected: { rateKey: 'persianRateKey', direction: 'persianDirection', maxYears: 'persianMaxYears', persianYear: 'persianYear' },
	decennials: { startMode: 'decennialStartMode', orderType: 'decennialOrderType', dayMethod: 'decennialDayMethod', calendarType: 'decennialCalendarType' },
	triplicityrulers: { division: 'triplicityDivision', lifespan: 'triplicityLifespan' },
	keypoints: { mode: 'keypointsMode' },
	prog: { minorVariant: 'minorVariant' },
	vedicprog: { minorVariant: 'minorVariant' },
	jaynesprog: { minorVariant: 'minorVariant' },
	profection: { nodeRetrograde: 'nodeRetrograde', profGrain: 'profGrain', profStart: 'profStart' },
	solararc: { nodeRetrograde: 'nodeRetrograde' },
	planetaryarc: { nodeRetrograde: 'nodeRetrograde' },
	balbillus: { startPlanet: 'balbillusStartPlanet', yearType: 'balbillusYearType', mode: 'balbillusMode', subRule: 'balbillusSubRule' },
	yearsystem129: { ys129StartPlanet: 'ys129StartPlanet', ys129Order: 'ys129Order', ys129YearType: 'ys129YearType', ys129SubRule: 'ys129SubRule' },
	distributions: { distReleaser: 'distReleaser', distMethod: 'distMethod', distYear: 'distYear', distYears: 'distYears' },
	agepoint: { apMethod: 'apMethod', apEvents: 'apEvents', apYear: 'apYear', apMaxAge: 'apMaxAge' },
	neroman: { nerK: 'nerK', nerT0: 'nerT0', nerKeepDec: 'nerKeepDec', nerOrb: 'nerOrb' },
	bezzafigure: { bezzaOrb: 'bezzaOrb' },
	jayprofection: { jayFrom: 'jayFrom' },
	michon: { michonOrb: 'michonOrb', michonSwap: 'michonSwap', michonEqual: 'michonEqual' },
	timelords: { tlMethod: 'tlMethod', tlYearType: 'tlYearType', tlMovingYear: 'tlMovingYear', tlTurnStart: 'tlTurnStart', tlTurnOrder: 'tlTurnOrder', tlOrbMode: 'tlOrbMode', tlAnnualDays: 'tlAnnualDays', tlAnnualOrder: 'tlAnnualOrder', tlReleaser: 'tlReleaser', tlVariant: 'tlVariant', tlNineTime: 'tlNineTime', tlNineReverse: 'tlNineReverse', tlRateKind: 'tlRateKind', tlMovingStart: 'tlMovingStart', tlDevBasis: 'tlDevBasis', tlDiurnalMode: 'tlDiurnalMode' },
};

function directionPageValue(field, pageKey){
	const v = DIRECTION_PAGE_SETTINGS.load()[pageKey];
	if(v === undefined || v === null){
		return undefined;
	}
	return field.type === 'switch' ? (v ? 1 : 0) : v;
}

Object.keys(DIRECTION_PAGE_BOUND_FIELDS).forEach((key)=>{
	const schema = TECHNIQUE_SETTINGS_SCHEMA[key];
	if(!schema || !Array.isArray(schema.fields)){
		return;
	}
	const map = DIRECTION_PAGE_BOUND_FIELDS[key];
	// 字段对象可能被几门技法共用:复制一份再挂 globalCurrent,不改动共用的那份
	schema.fields = schema.fields.map((field)=>{
		const pageKey = map[field.name];
		if(!pageKey){
			return field;
		}
		const bound = { ...field, pageBoundKey: pageKey };
		bound.globalCurrent = ()=>directionPageValue(bound, pageKey);
		return bound;
	});
});

// 把一份「可能含默认值」的 options 收敛为「只保留与默认不同的项」（默认即现状：空对象 = 不覆盖）。
// 🔴 比较锚升级「非默认」→「非现状」:第三参 baseline(该盘实际生效值,如 record/
// 存档 payload)存在时,比较锚 = baseline[name](present)?? field.default。
// 由来(用户实锤):astrochart hsys 的 schema default=0(整宫制)而存盘现状恒为 1(Alcabitus)——
// 「选整宫制」≡「选 schema 默认」被三道 prune 连剪,该值**永远不可表达**;凡 schema 默认 ≠
// 盘存值的字段(zodiacal/termsVariant/tradition…)同构发病。锚到盘现状后:与盘不同才算覆盖,
// 调回盘现状=不覆盖(「默认即现状」契约的正确实现——现状是盘的现状,不是 schema 的想象)。
// 无 baseline(模板等无盘场景)回退 schema default 旧语义。
// 「现状默认」单源:field.globalCurrent(全局仓种子键——页面种子=全局现值、
// 存盘「值==种子不落键」,record 缺键的真实语义=「随全局」而非内建 schema 默认;15 键族
// westNodeType 系+古典口径 10 键)优先于 field.default。prune 比较锚与抽屉基线显示共用。
// 紫微 A 类基线锚=全局单例现值(ZWEngineOptions/ZWSchool),非裸 schema 默认。
// builder 缺省回退的正是这两个单例——基线读同一变量 = 与回退口径 by construction 恒等:
// 左栏(全局)开了太岁入卦时,挂载拨「关」若锚 schema 默认(0)会被 prune 剪空 → 走 live
// 快照(读全局=开)→ 开关不生效(Win Issue#76 用户实锤;WP-1 termsVariant 同型病)。
// switch 型单例存 boolean、schema 用 0/1 —— 归一到 0/1(prune 是字符串化比较,'true'≠'1'会假 override)。
function ziweiGlobalValue(key){
	const v = key === 'sihuaSchool' ? ZWSchool.school : ZWEngineOptions[key];
	if(v === undefined || v === null){ return undefined; }
	if(typeof v === 'boolean'){ return v ? 1 : 0; }
	// 对象数组(taiSuiRelatives)必须转文本形:text 字段的抽屉输入框 `${value}` 渲染,
	// 数组直出=显示 [object Object] 且用户一编辑就切出垃圾关系人(复审 F2 实抓)。
	if(Array.isArray(v)){
		return v.map((r)=>(r && typeof r === 'object' ? [r.branch, r.role, r.sex].filter(Boolean).join(':') : `${r}`)).join(' ');
	}
	return v;
}
