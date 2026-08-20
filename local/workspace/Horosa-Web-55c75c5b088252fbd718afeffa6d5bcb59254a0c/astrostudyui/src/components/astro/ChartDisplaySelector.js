import { Component } from 'react';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { XQCheckItem, XQCheckList, XQSectionTitle, XQSegmented, XQSelect, XQButton } from '../xq-ui';
import TermsEditor from './TermsEditor';
import CustomAyanamsaManager from './CustomAyanamsaManager';
import { setClassicalChartGlobal, classicalGlobalValue } from '../../utils/classicalChartGlobals';
import { scheduleOptionDispatch } from '../../utils/optionDispatchScheduler';
import { getDivinationJudgeGlobals, setDivinationJudgeGlobal } from '../../utils/divinationJudgeGlobals';

const Option = XQSelect.Option;

// 界系（bounds/terms）：全局——影响界主、尊贵评分、互容接纳、围攻日木互容。
// 标签正名与 techniqueMountSettings 同口径:1=校勘本(批判本传承)/2=经典传本(1647 印本传承,旧标「莉莉界」)。
const TERMS_OPTIONS = [
	{ value: 0, label: '埃及界' },
	{ value: 1, label: '托勒密界·校勘本' },
	{ value: 2, label: '托勒密界·经典传本' },
	{ value: 3, label: '迦勒底界' },
	{ value: 4, label: '自定义' },   // [WP-7] 编辑器存表后生效;无合法表下发时自动降级埃及
];

// 双子界序：仅托勒密界·经典传本（termsVariant==2）生效——1647 印本双子末两界与后世校勘本相反,两皆有据。
const GEMINI_BOUND_OPTIONS = [
	{ value: 0, label: '忠原书（♄21–25/♂25–30）' },
	{ value: 1, label: '校勘对调（♂21–25/♄25–30）' },
];

// 三分制（triplicity rulers 体系）：后端 fields.triplicity;默认 Dorothean 零回归。
const TRIPLICITY_OPTIONS = [
	{ value: 'Dorothean', label: '多罗特三主' },
	{ value: 'Ptolemaic', label: '托勒密二主' },
	{ value: 'PtolemaicWaterVariant', label: '水象变体' },
];

// G12 月交点真 / 平：平交点(mean，默认，月平根数)/ 真交点(true，含摄动)。改变 → /chart 重算(交点黄经变，全盘宫位/相位随动)。默认 mean 零回归。
const WEST_NODE_OPTIONS = [
	{ value: 'mean', label: '平交点' },
	{ value: 'true', label: '真交点' },
];

// G13 区分判定:几何地平(geo，默认)/ Ptolemy 5°缓冲(ptolemy5，太阳在上升下 5°内拂晓仍判昼)。改变 → sect 翻转连锁重算全盘。默认 geo 零回归。
// [WP-2] 第三档 apparent=视地平(真日出没·含大气折射;极昼夜后端回落几何)。
const SECT_BUFFER_OPTIONS = [
	{ value: 'geo', label: '几何地平' },
	{ value: 'ptolemy5', label: 'Ptolemy 5°' },
	{ value: 'apparent', label: '视地平（含折射）' },
];
// [WP-2] 天文口径批选项(默认=后端现状零回归)。
const WEST_LILITH_OPTIONS = [
	{ value: 'mean', label: '平均远地点' },
	{ value: 'true', label: '真实远地点' },
];
const STATION_MODE_OPTIONS = [
	{ value: 'off', label: '关（仅逆行 R 标）' },
	{ value: 'exactWindow', label: '距留点 ≤1 日' },
	{ value: 'distance', label: '距留点黄经 ≤2′' },
	{ value: 'absSpeed', label: '日速 <1′' },
	{ value: 'relSpeed', label: '日速 <3% 均速' },
];
const ECLIPSE_TIME_OPTIONS = [
	{ value: 'max', label: '食甚时刻' },
	{ value: 'syzygy', label: '精确朔望' },
];
// [WP-3] 希腊点变体批。
const EROS_CONSTRUCTION_OPTIONS = [
	{ value: 'paulus', label: 'Paulus 式（金星·水星系）' },
	{ value: 'valens', label: 'Valens 式（福点·精神系）' },
];
const LOT_FORTUNE_VARIANT_OPTIONS = [
	{ value: 'standard', label: '标准昼夜式' },
	{ value: 'moonAboveNight', label: '月在地平上恒夜式' },
];
const LOT_PROJECTION_OPTIONS = [
	{ value: 'portion', label: '度数投射' },
	{ value: 'sign', label: '整星座' },
];
// [WP-4] 尊贵与判定批。
const PEREGRINE_SCORE_OPTIONS = [
	{ value: -5, label: '−5（1647）' },
	{ value: 0, label: '不减分' },
];
const ALMUTEN_TRIP_OPTIONS = [
	{ value: 'all', label: '三主全计' },
	{ value: 'sectRulerOnly', label: '仅当值主' },
];
const DOMICILE_MASTER_OPTIONS = [
	{ value: 'domicile', label: '庙主派（Porphyry·Antiochus）' },
	{ value: 'bound', label: '界主派（Valens·Rhetorius）' },
];
const BUSY_PLACES_OPTIONS = [
	{ value: '1,4,5,7,10,11', label: '1·4·5·7·10·11（通行）' },
	{ value: '1,4,7,10', label: '仅四角宫' },
	{ value: '1,2,4,5,7,9,10,11', label: '含 2·9（宽集）' },
	{ value: '1,3,4,5,7,9,10,11', label: '含 3·9（宽集·三九向）' },
];
const PLANETARY_HOUR_OPTIONS = [
	{ value: 'sunrise', label: '日出起算 · 等长时' },
	{ value: 'unequal', label: '昼夜不等时（传统）' },
	{ value: 'equal24', label: '廿四时等分' },
];
// [WP-5a] 容许度体系批。
const ORB_SYSTEM_OPTIONS = [
	{ value: 'perObject', label: '星体轨 · 任一覆盖（现行）' },
	{ value: 'byAspect', label: '按相位名（合冲刑拱 8° · 六合 4°）' },
	{ value: 'wholeSign', label: '整星座位相' },
	{ value: 'wholeSignMoiety', label: '整星座内 · 两轨半距和' },
];
const LUM_BONUS_OPTIONS = [0, 10, 20, 30].map((v)=>({ value: v, label: `${v}%` }));
const TRANSIT_ORB_OPTIONS = [1, 2, 3, 5].map((v)=>({ value: v, label: `${v}°` }));
const SEPARATING_CAP_OPTIONS = [
	{ value: 0, label: '不限' },
	{ value: 1, label: '1°' },
	{ value: 2, label: '2°' },
	{ value: 3, label: '3°' },
];
// [WP-8] 灵学扩展。
const VULCAN_OPTIONS = [
	{ value: 'off', label: '关' },
	{ value: 'weston', label: '轨道根数法' },
	{ value: 'baker', label: '水星系推算' },
];
const RAY_OPTIONS = [
	{ value: 'off', label: '关' },
	{ value: 'equal', label: '等权' },
	{ value: 'weighted', label: '加权' },
];
// [WP-6] 返照专项。
const SOLAR_RETURN_VARIANT_OPTIONS = [
	{ value: 'precise', label: '精确回归（现代）' },
	{ value: 'hellenistic', label: '希腊式（月定上升）' },
];
const RETURN_LAT_OPTIONS = [
	{ value: 'ecliptic', label: '黄道度（常规）' },
	{ value: 'withLatitude', label: '计入黄纬（Umar al-Tabari 法）' },
];

// ── 太阳三态/空亡/恒星选项（2026-07 二批升排盘级:classicalChartGlobals,后端 perchart 消费,
// 全站显示随动;判读引擎经 judgeLayerOverrides 同吃这组值——单一真值双链同源）────
const CAZIMI_OPTIONS = [
	{ value: 17 / 60, label: '17′（1647）' },
	{ value: 16 / 60, label: '16′（中世纪）' },
	{ value: 1, label: '1°（早期）' },
];
const COMBUST_OPTIONS = [
	{ value: 8.5, label: '8°30′（1647）' },
	{ value: 8, label: '8°（中世纪）' },
	{ value: 15, label: '15°（希腊化）' },
];
const BEAMS_OPTIONS = [
	{ value: 17, label: '17°（1647）' },
	{ value: 15, label: '15°（较古）' },
];
const VOC_MODE_OPTIONS = [
	// 标签勘误(2026-07):后端 isVOC 实为「无入相/正合主相位即空」(1647 口径),旧标「后端按座」系误录。
	{ value: 'classic', label: '无入相即空（1647 · 现行）' },
	{ value: 'by_orb', label: '容许度 12°30′' },
	{ value: 'by_sign_perfect', label: '本座内须完成（现代）' },
	{ value: 'by_sign_orb', label: '本座内入容许度（16c）' },
	{ value: 'kenodromia', label: '30° 法（希腊化）' },
	{ value: 'exempt4', label: '无入相＋四座豁免（中世纪）' },
];

// 落宫宫头前移(five-degree rule):5°=传统默认/0°=纯宫界;整宫制天然豁免,随当前分宫制宫头。
const HOUSE_CUSP_ADVANCE_OPTIONS = [
	{ value: 5, label: '5°（传统）' },
	{ value: 3, label: '3°' },
	{ value: 1, label: '1°' },
	{ value: 0, label: '0°（纯宫界）' },
];

// 映点接触容许度(后端 chart.antiscias 同座 signlon 差)。
const ANTISCIA_ORB_OPTIONS = [0.5, 1, 1.5, 2, 3].map((v) => ({ value: v, label: `${v}°` }));

// 燃烧之路边界(后端 isViaCombust 全站显示随动;2026-07 由旧窄口径 208–217 归正为传统 195–225 默认)。
const VIA_COMBUSTA_OPTIONS = [
	{ value: 'standard', label: '天秤15°–天蝎15°（传统）' },
	{ value: 'narrow', label: '窄口径（天秤28°–天蝎7°）' },
	{ value: 'scorpioFull', label: '天秤后15°＋天蝎全宫' },
	{ value: 'bothFull', label: '天秤＋天蝎全段' },
];

// 正相位(partile)判据:主盘相位表「正」标记列 + 卜卦尊贵计分共用(纯前端,不进排盘请求)。
const PARTILE_OPTIONS = [
	{ value: 'same_degree', label: '同整数度（1647）' },
	{ value: 'le3', label: '≤3°（1677）' },
	{ value: 'le1', label: '≤1°（现代）' },
];
const STAR_ORB_MODE_OPTIONS = [
	{ value: 'school', label: '按流派平轨' },
	{ value: 'byMagnitude', label: '按星等' },
];
const STAR_ORB_OPTIONS = [1, 1.5, 2, 3, 5].map((v) => ({ value: v, label: `${v}°` }));

// 盘面显示四子组（成熟分组）：每子组一个小标题 + 勾选列表。
// 3D 盘（已淘汰，改天文馆）与 CHART_INFOINCIRCLE 不列。
function buildDisplayGroups(C){
	const raw = [
		{ title: '星体与宿', cols: 2, opts: [C.CHART_PLANETS, C.CHART_SU27, C.CHART_SU28_TEXT] },
		{ title: '相位', cols: 2, opts: [C.CHART_ASP_LINES, C.CHART_THREEPLANETASP] },
		{ title: '度数与刻度', cols: 2, opts: [C.CHART_HOUSEDEGREE, C.CHART_TXTPLANET, C.CHART_OUTERDEG, C.CHART_INNERDEG, C.CHART_ANGLELINE] },
		{ title: '显示样式', cols: 2, opts: [C.CHART_PLANETCOLORWITHSIGN, C.CHART_TXTPLANETFORWARD] },
		// [WP-9] 盘面增强:角宫三元组徽/盘心行星时·日主星/盘心 RAMC/符号盘(隐度数)。
		{ title: '盘面增强', cols: 2, opts: [C.CHART_ANGULAR_TRIAD, C.CHART_CENTER_HOURS, C.CHART_CENTER_RAMC, C.CHART_GLYPH_ONLY] },
	];
	return raw.map((s)=>({ ...s, opts: s.opts.filter((o)=>o !== undefined && o !== null) }));
}

class ChartDisplaySelector extends Component{

	constructor(props) {
		super(props);
		// [WP-7] 两个自定义 Modal 的开合态。
		this.state = { termsEditorOpen: false, ayanMgrOpen: false };
		this.changeChartOption = this.changeChartOption.bind(this);
		this.changeVoidClassical = this.changeVoidClassical.bind(this);
		this.changeShowPlanetHouseInfo = this.changeShowPlanetHouseInfo.bind(this);
		this.changeShowAstroMeaning = this.changeShowAstroMeaning.bind(this);
		this.changeOnlyRulerExaltReception = this.changeOnlyRulerExaltReception.bind(this);
	}

	changeChartOption(opt, checked){
		if(!this.props.dispatch){ return; }
		const current = Array.isArray(this.props.value) ? [...this.props.value] : [];
		const idx = current.indexOf(opt);
		if(checked && idx < 0){ current.push(opt); }
		if(!checked && idx >= 0){ current.splice(idx, 1); }
		this.props.dispatch({ type: 'app/save', payload: { chartDisplay: current } });
	}

	// ── /chart 级古典参数统一写链：全局仓(持久化+广播,辅盘/合盘/分至盘热同步) + app UI 记忆
	// (termsVariant 等既有键保持双写兼容) + astro fields(主盘) + fetchByFields 重排。
	// 默认值零回归(fieldsToParams 条件透传,默认不下发)。──
	applyClassicalField(key, val, appMirror){
		setClassicalChartGlobal(key, val);
		if(!this.props.dispatch){ this.forceUpdate(); return; }
		if(appMirror){
			this.props.dispatch({ type: 'app/save', payload: { [key]: val } });
		}
		const flds = { ...(this.props.fields || {}) };
		flds[key] = { value: val, name: [key] };
		this.props.dispatch({ type: 'astro/save', payload: { fields: flds } });
		// 触发重算（fieldsToParams 条件透传→/chart）;缺核心字段（未起盘）时 fetchByFields 自身有护栏。
		// [R4-B5b] 经选项通道调度(leading 立发+250ms trailing 并帧):连改 5 档古典参数
		// /chart 实发 ≤2;save 恒立即(UI 即时反映),只有重算派发进调度器。delta=本键增量,
		// base 派发时点从 this.props.fields 重取(时间键恒最新,不覆盖时间轴在途变更)。
		if(flds.date && flds.time && flds.lat && flds.lon){
			scheduleOptionDispatch((payload)=>{
				this.props.dispatch({ type: 'astro/fetchByFields', payload });
			}, { [key]: { value: val, name: [key] } }, ()=>({ ...(this.props.fields || {}) }));
		}
		this.forceUpdate();
	}

	// 判读级全局参数（卜卦/择日判读引擎;不动 /chart 请求）：写仓+广播即可,消费面监听事件自重跑。
	applyJudgeGlobal(key, val){
		setDivinationJudgeGlobal(key, val);
		this.forceUpdate();
	}

	// G10 空亡古典义(30°内):默认 OFF=按本座义;开=固定 30°窗口。只写 app(格局页相位动态读 props.voidClassical 自动重算),
	// 走 /astroextra/analysis 非 /chart,故不动 fields/不重起盘(会话态,有意不持久)。
	changeVoidClassical(on){
		if(!this.props.dispatch){ return; }
		this.props.dispatch({ type: 'app/save', payload: { voidClassical: on ? 1 : 0 } });
	}

	changeShowPlanetHouseInfo(checked){
		if(!this.props.dispatch){ return; }
		this.props.dispatch({ type: 'app/save', payload: { showPlanetHouseInfo: checked ? 1 : 0 } });
	}

	changeShowAstroMeaning(checked){
		if(!this.props.dispatch){ return; }
		this.props.dispatch({ type: 'app/save', payload: { showAstroMeaning: checked ? 1 : 0 } });
	}

	changeOnlyRulerExaltReception(checked){
		if(!this.props.dispatch){ return; }
		this.props.dispatch({ type: 'app/save', payload: { showOnlyRulExaltReception: checked ? 1 : 0 } });
	}

	// fields 优先、全局仓兜底（fields 无该键时显示全局偏好——重启后未起盘也能正确回显）。
	fieldOr(key){
		const f = this.props.fields && this.props.fields[key];
		if(f && f.value !== undefined && f.value !== null){ return f.value; }
		return classicalGlobalValue(key);
	}

	render(){
		// 标签一律走正常字体（继承抽屉字族）：这些选项标签全是中文 + 偶含数字/度数（如「30°内」），
		// 绝不能套 ywastro 占星符号字体——否则拉丁数字/度数被映射成 glyph 乱码（曾渲染成 `Ibclxc°`）。
		// 本抽屉无任何需要行星 / 星座符号的纯 glyph 标签，故全部用正常文本。
		const currentDisplay = Array.isArray(this.props.value) ? this.props.value : [];
		const tvRaw = this.fieldOr('termsVariant');
		const termsVariant = ([1, 2, 3, 4].indexOf(tvRaw) >= 0) ? tvRaw : 0;   // [R2-6] 放行自定义(4),否则选完回显跳回埃及
		const geminiEmended = (this.fieldOr('geminiBoundEmended') === 1 || this.fieldOr('geminiBoundEmended') === '1') ? 1 : 0;
		const triplicity = this.fieldOr('triplicity') || 'Dorothean';
		const westNodeType = this.fieldOr('westNodeType') === 'true' ? 'true' : 'mean';
		const sectBuffer = (['ptolemy5', 'apparent'].indexOf(this.fieldOr('sectBuffer')) >= 0) ? this.fieldOr('sectBuffer') : 'geo';
		// [WP-2] 天文口径批读值。
		const ownChariotOn = (this.fieldOr('combustOwnChariotExempt') === 1 || this.fieldOr('combustOwnChariotExempt') === '1');
		const westLilithType = this.fieldOr('westLilithType') === 'true' ? 'true' : 'mean';
		const topoMoonOn = (this.fieldOr('topocentricMoon') === 1 || this.fieldOr('topocentricMoon') === '1');
		const stationMarking = (this.fieldOr('stationMarking') || 'off') + '';
		const eclipseTimeMode = classicalGlobalValue('eclipseTimeMode') || 'max';   // 纯全局键(不进 fields)
		// [WP-3] 希腊点变体批读值。
		const hermeticLotsReversalOn = !(this.fieldOr('hermeticLotsReversal') === 0 || this.fieldOr('hermeticLotsReversal') === '0');
		const erosConstruction = (this.fieldOr('erosConstruction') || 'paulus') + '';
		const lotFortuneVariant = (this.fieldOr('lotFortuneVariant') || 'standard') + '';
		const lotFatherCombustAltOn = (this.fieldOr('lotFatherCombustAlt') === 1 || this.fieldOr('lotFatherCombustAlt') === '1');
		const lotProjection = (this.fieldOr('lotProjection') || 'portion') + '';
		// [WP-4] 尊贵与判定批读值(peregrine/domicileMaster/dynamical/busyPlaces 纯全局键)。
		const dignityDebilitiesOn = !(this.fieldOr('dignityDebilities') === 0 || this.fieldOr('dignityDebilities') === '0');
		const peregrineScore = Number(classicalGlobalValue('peregrineScore'));
		const almutenTripMode = (this.fieldOr('almutenTripMode') || 'all') + '';
		const domicileMasterMethod = (classicalGlobalValue('domicileMasterMethod') || 'domicile') + '';
		const dynamicalDivisionsOn = (classicalGlobalValue('dynamicalDivisions') === 1);
		const busyPlaces = (classicalGlobalValue('busyPlaces') || '1,4,5,7,10,11') + '';
		const planetaryHourMethod = (this.fieldOr('planetaryHourMethod') || 'sunrise') + '';
		// [WP-5a] 容许度体系批读值(transitOrb/onlyApplying/separatingCap 纯全局键)。
		const orbSystem = (this.fieldOr('orbSystem') || 'perObject') + '';
		const luminaryOrbBonus = (() => { const n = parseInt(this.fieldOr('luminaryOrbBonus') + '', 10); return [0, 10, 20, 30].indexOf(n) >= 0 ? n : 0; })();
		const transitOrb = Number(classicalGlobalValue('transitOrb')) || 1;
		const aspectShowOnlyApplyingOn = (classicalGlobalValue('aspectShowOnlyApplying') === 1);
		const separatingOrbCap = Number(classicalGlobalValue('separatingOrbCap')) || 0;
		// [WP-5b] 相位对象扩展三开关读值。
		const aspectIncludeCuspsOn = (this.fieldOr('aspectIncludeCusps') === 1 || this.fieldOr('aspectIncludeCusps') === '1');
		const aspectIncludeLotsOn = (this.fieldOr('aspectIncludeLots') === 1 || this.fieldOr('aspectIncludeLots') === '1');
		const aspectIncludeMidpointsOn = (this.fieldOr('aspectIncludeMidpoints') === 1 || this.fieldOr('aspectIncludeMidpoints') === '1');
		// [WP-6] 返照专项读值。
		const solarReturnVariant = (this.fieldOr('solarReturnVariant') || 'precise') + '';
		const returnLatitudeMode = (this.fieldOr('returnLatitudeMode') || 'ecliptic') + '';
		// [WP-8] 灵学扩展读值(rayWeighting 纯全局键)。
		const vulcanCalc = (this.fieldOr('vulcanCalc') || 'off') + '';
		const rayWeighting = (classicalGlobalValue('rayWeighting') || 'off') + '';
		const leoBoundFirst = (this.fieldOr('leoBoundFirst') === 1 || this.fieldOr('leoBoundFirst') === '1');
		const lotReversalOn = !(this.fieldOr('lotReversal') === 0 || this.fieldOr('lotReversal') === '0');
		const voidClassicalOn = (this.props.voidClassical === 1 || this.props.voidClassical === '1' || this.props.voidClassical === true);
		// 2026-07 二批(排盘级,fields 优先全局仓兜底):落宫前移/三态/空亡/恒星/映点。
		const houseCuspAdvance = (() => { const n = parseInt(this.fieldOr('houseCuspAdvance') + '', 10); return [0, 1, 3, 5].indexOf(n) >= 0 ? n : 5; })();
		const numOr = (k, d) => { const n = Number(this.fieldOr(k)); return Number.isFinite(n) ? n : d; };
		const cazimiOrb = numOr('cazimiOrb', 17 / 60);
		const combustOrb = numOr('combustOrb', 8.5);
		const underBeamsOrb = numOr('underBeamsOrb', 17);
		const vocMode = (this.fieldOr('vocMode') || 'classic') + '';
		const vocIncludeOuterOn = (this.fieldOr('vocIncludeOuter') === 1 || this.fieldOr('vocIncludeOuter') === '1' || this.fieldOr('vocIncludeOuter') === true);
		const fixedStarOrb = numOr('fixedStarOrb', 1);
		const fixedStarOrbMode = (this.fieldOr('fixedStarOrbMode') || 'school') + '';
		const antisciaOrb = numOr('antisciaOrb', 1);
		const viaCombustaVariant = (this.fieldOr('viaCombustaVariant') || 'standard') + '';
		const partileDef = (this.fieldOr('partileDef') || 'same_degree') + '';
		// [对标战役 0c] 三死配置上 UI:此前后端+Java+存档链全通但全站无开关,用户无法开启。
		const lotsDocReverseOn = (this.fieldOr('lotsDocReverse') === 1 || this.fieldOr('lotsDocReverse') === '1');
		const nodeExaltationOn = (this.fieldOr('nodeExaltation') === 1 || this.fieldOr('nodeExaltation') === '1');
		const jg = getDivinationJudgeGlobals();
		const displayGroups = buildDisplayGroups(AstroConst);

		const renderOpt = (opt)=>{
			const checked = currentDisplay.includes(opt);
			return (
				<XQCheckItem key={opt} checked={checked} onClick={()=>this.changeChartOption(opt, !checked)}>
					<span className="horosa-selector-label">{AstroText.ChartOptionText[opt + '']}</span>
				</XQCheckItem>
			);
		};
		// boolItem 支持 disabled（置灰 + 拦截点击）与 hint（次级提示，如「仅校勘本生效」）。
		const boolItem = (key, label, on, handler, opts)=>{
			const { disabled = false, hint = null } = opts || {};
			return (
				<XQCheckItem
					key={key}
					checked={on}
					disabled={disabled}
					onClick={disabled ? undefined : (()=>handler(!on))}
				>
					<span className="horosa-selector-label">
						{label}
						{hint ? <span className="horosa-selector-label-hint">{hint}</span> : null}
					</span>
				</XQCheckItem>
			);
		};
		// 设置行：标签左 · 控件右（放不下时控件整体换行仍右对齐）。
		const cell = (label, control)=>(
			<div className="horosa-terms-cell" key={label}>
				<span className="horosa-terms-label">{label}</span>
				<span className="horosa-terms-control">{control}</span>
			</div>
		);

		return (
			<div className="horosa-selector-drawer">
				{/* ① 盘面显示 —— 四子组勾选卡 + 盘面美术(与左栏「星盘样式」卡同源,写 app model 全局生效) */}
				<div className="horosa-selector-section">
					<XQSectionTitle>盘面显示</XQSectionTitle>
					{displayGroups.map((s)=>(
						<div className="horosa-selector-subgroup" key={s.title}>
							<div className="horosa-selector-subtitle">{s.title}</div>
							<XQCheckList columns={s.cols}>
								{s.opts.map(renderOpt)}
							</XQCheckList>
						</div>
					))}
					<div className="horosa-selector-subgroup">
						<div className="horosa-selector-inline-row">
							<div className="horosa-selector-subtitle">行星列表密度</div>
							<span className="horosa-selector-inline-control">
								<XQSegmented
									value={(this.props.planetListStyle === 'degreeOnly' || this.props.planetListStyle === 'glyphOnly') ? this.props.planetListStyle : 'full'}
									options={[{ value: 'full', label: '完整' }, { value: 'degreeOnly', label: '仅度数' }, { value: 'glyphOnly', label: '仅符号' }]}
									onChange={(e)=>{
										const v = e && e.target ? e.target.value : e;
										if(this.props.dispatch){ this.props.dispatch({ type: 'app/save', payload: { planetListStyle: v } }); }
									}} />
							</span>
						</div>
					</div>
					<div className="horosa-selector-subgroup">
						<div className="horosa-selector-inline-row">
							<div className="horosa-selector-subtitle">盘面美术</div>
							<span className="horosa-selector-inline-control">
								<XQSelect
									size="small"
									style={{width: 200}}
									value={AstroConst.normalizeWheelArt(this.props.wheelArt)}
									dropdownMatchSelectWidth={false}
									onChange={(e)=>{
										const wheelArt = e && e.target ? e.target.value : e;
										if(this.props.dispatch){
											this.props.dispatch({ type: 'app/save', payload: { wheelArt } });
										}
									}}
								>
									{AstroConst.WHEEL_ART_OPTIONS.map((item)=>(<Option value={item.value} key={item.value}>{item.label}</Option>))}
								</XQSelect>
							</span>
						</div>
					</div>
				</div>

				{/* ② 经典尊贵显示 —— 盘面尊贵三环 */}
				<div className="horosa-selector-section">
					<XQSectionTitle>经典尊贵显示</XQSectionTitle>
					<XQCheckList columns={2}>
						{[AstroConst.CHART_TRIP, AstroConst.CHART_SIGNRULER, AstroConst.CHART_TERM]
							.filter((o)=>o !== undefined && o !== null)
							.map(renderOpt)}
					</XQCheckList>
				</div>

				{/* ③ 古典计算（全盘生效 · /chart 级）：写全局仓+主盘 fields,辅盘/合盘/分至盘同步透传。
				    [WP-1] 平铺改 8 子组(spec group 同名;照①「盘面显示」subtitle 先例)——对标战役
				    新键按组归位,后续包只在对应组内追加 cell/boolItem。 */}
				<div className="horosa-selector-section">
					<XQSectionTitle>古典计算 · 全盘生效</XQSectionTitle>
					<div className="horosa-selector-scope-note">下列口径随排盘全局生效：主盘、星运推运、辅盘（卜卦 / 择日 / 分盘）、合盘、分至盘同步透传；卜卦盘内由流派预设绑定的键以流派为准。</div>
					<div className="horosa-selector-subgroup">
						<div className="horosa-selector-subtitle">界与尊贵</div>
						<div className="horosa-terms-grid">
							{cell('界系（界主 · 尊贵 · 互容接纳）',
								<XQSegmented value={termsVariant} options={TERMS_OPTIONS} onChange={(e)=>this.applyClassicalField('termsVariant', e && e.target ? e.target.value : e, true)} />)}
							{termsVariant === 3 ? (
								<div className="horosa-terms-note">
									迦勒底界系规则推演重建：仅白羊有据,余座按宽度 [8,7,6,5,4] + 元素昼序推得、夜盘土水互换,仅供参研,请审慎采用。
								</div>
							) : null}
							{cell('双子界序（1647 印本两皆有据）',
								termsVariant === 2
									? <XQSegmented value={geminiEmended} options={GEMINI_BOUND_OPTIONS} onChange={(e)=>this.applyClassicalField('geminiBoundEmended', e && e.target ? e.target.value : e)} />
									: <span className="horosa-selector-label-hint">仅经典传本生效</span>)}
							{cell('自定义界表（选「自定义」档生效）',
								<XQButton size="small" onClick={()=>this.setState({ termsEditorOpen: true })}>编辑界表…</XQButton>)}
							{cell('三分制（triplicity 主星体系）',
								<XQSegmented value={triplicity} options={TRIPLICITY_OPTIONS} onChange={(e)=>this.applyClassicalField('triplicity', e && e.target ? e.target.value : e)} />)}
							{cell('游离（外来）减分（择日尊贵矩阵）',
								<XQSegmented value={peregrineScore} options={PEREGRINE_SCORE_OPTIONS} onChange={(e)=>{ setClassicalChartGlobal('peregrineScore', e && e.target ? e.target.value : e); this.forceUpdate(); }} />)}
							{cell('Almuten 三分计分',
								<XQSegmented value={almutenTripMode} options={ALMUTEN_TRIP_OPTIONS} onChange={(e)=>this.applyClassicalField('almutenTripMode', e && e.target ? e.target.value : e)} />)}
						</div>
						<XQCheckList columns={2}>
							{boolItem(
								'leobf',
								'托勒密界 · 狮子土星优先',
								leoBoundFirst,
								(on)=>this.applyClassicalField('leoBoundFirst', on ? 1 : 0, true),
								termsVariant === 1 ? null : { disabled: true, hint: '仅校勘本生效' }
							)}
							{boolItem('digdeb', '弱陷计负分（陷 −5 · 落 −4）', dignityDebilitiesOn, (on)=>this.applyClassicalField('dignityDebilities', on ? 1 : 0))}
						</XQCheckList>
					</div>
					<div className="horosa-selector-subgroup">
						<div className="horosa-selector-subtitle">昼夜与区分</div>
						<div className="horosa-terms-grid">
							{cell('区分判定（昼 / 夜 · sect）',
								<XQSegmented value={sectBuffer} options={SECT_BUFFER_OPTIONS} onChange={(e)=>this.applyClassicalField('sectBuffer', e && e.target ? e.target.value : e, true)} />)}
							{cell('月交点（真 / 平 · 全盘随动）',
								<XQSegmented value={westNodeType} options={WEST_NODE_OPTIONS} onChange={(e)=>this.applyClassicalField('westNodeType', e && e.target ? e.target.value : e, true)} />)}
							{cell('主宰主星判法（Domicile Master）',
								<XQSegmented value={domicileMasterMethod} options={DOMICILE_MASTER_OPTIONS} onChange={(e)=>{ setClassicalChartGlobal('domicileMasterMethod', e && e.target ? e.target.value : e); this.forceUpdate(); }} />)}
							{cell('有利宫位（chrematistikoi）',
								<XQSelect size="small" style={{ width: 232 }} value={busyPlaces} dropdownMatchSelectWidth={false}
									onChange={(val)=>{ setClassicalChartGlobal('busyPlaces', val); this.forceUpdate(); }}>
									{BUSY_PLACES_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
								</XQSelect>)}
							{cell('行星时制式',
								<XQSegmented value={planetaryHourMethod} options={PLANETARY_HOUR_OPTIONS} onChange={(e)=>this.applyClassicalField('planetaryHourMethod', e && e.target ? e.target.value : e)} />)}
						</div>
						<XQCheckList columns={2}>
							{boolItem('nodeex', '交点入旺（北交旺双子 · 南交旺射手）', nodeExaltationOn, (on)=>this.applyClassicalField('nodeExaltation', on ? 1 : 0))}
							{boolItem('dyndiv', '动力学区分（象限强度分区）', dynamicalDivisionsOn, (on)=>{ setClassicalChartGlobal('dynamicalDivisions', on ? 1 : 0); this.forceUpdate(); })}
						</XQCheckList>
					</div>
					<div className="horosa-selector-subgroup">
						<div className="horosa-selector-subtitle">太阳三态</div>
						<div className="horosa-terms-grid">
							{cell('日心 cazimi',
								<XQSegmented value={cazimiOrb} options={CAZIMI_OPTIONS} onChange={(e)=>this.applyClassicalField('cazimiOrb', e && e.target ? e.target.value : e)} />)}
							{cell('燃烧上界',
								<XQSegmented value={combustOrb} options={COMBUST_OPTIONS} onChange={(e)=>this.applyClassicalField('combustOrb', e && e.target ? e.target.value : e)} />)}
							{cell('日光束外界（偕日相束级恒逐星弧）',
								<XQSegmented value={underBeamsOrb} options={BEAMS_OPTIONS} onChange={(e)=>this.applyClassicalField('underBeamsOrb', e && e.target ? e.target.value : e)} />)}
						</div>
						<XQCheckList columns={2}>
							{boolItem('ownchariot', '界内三分内免燃烧（own chariot · Porphyry）', ownChariotOn, (on)=>this.applyClassicalField('combustOwnChariotExempt', on ? 1 : 0))}
						</XQCheckList>
					</div>
					<div className="horosa-selector-subgroup">
						<div className="horosa-selector-subtitle">月亮与空亡</div>
						<div className="horosa-terms-grid">
							{cell('空亡口径（月亮 isVOC 全盘随动）',
								<XQSelect size="small" style={{ width: 232 }} value={vocMode} dropdownMatchSelectWidth={false}
									onChange={(val)=>this.applyClassicalField('vocMode', val)}>
									{VOC_MODE_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
								</XQSelect>)}
							{cell('燃烧之路边界（月亮凶区 · 全站随动）',
								<XQSelect size="small" style={{ width: 232 }} value={viaCombustaVariant} dropdownMatchSelectWidth={false}
									onChange={(val)=>this.applyClassicalField('viaCombustaVariant', val)}>
									{VIA_COMBUSTA_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
								</XQSelect>)}
							{cell('黑月莉莉丝（真 / 平远地点）',
								<XQSegmented value={westLilithType} options={WEST_LILITH_OPTIONS} onChange={(e)=>this.applyClassicalField('westLilithType', e && e.target ? e.target.value : e)} />)}
						</div>
						<XQCheckList columns={2}>
							{boolItem('topomoon', '月亮站心视差修正（福点随动）', topoMoonOn, (on)=>this.applyClassicalField('topocentricMoon', on ? 1 : 0))}
							{boolItem('voidcl', '空亡古典义（30°内，关则按本座义）', voidClassicalOn, this.changeVoidClassical)}
							{boolItem(
								'vocouter',
								'空亡计三王星',
								vocIncludeOuterOn,
								(on)=>this.applyClassicalField('vocIncludeOuter', on ? 1 : 0),
								vocMode === 'classic' ? { disabled: true, hint: '仅非 1647 口径生效' } : null
							)}
						</XQCheckList>
					</div>
					<div className="horosa-selector-subgroup">
						<div className="horosa-selector-subtitle">希腊点</div>
						<div className="horosa-terms-grid">
							{cell('爱欲 · 必然构成',
								<XQSegmented value={erosConstruction} options={EROS_CONSTRUCTION_OPTIONS} onChange={(e)=>this.applyClassicalField('erosConstruction', e && e.target ? e.target.value : e)} />)}
							{cell('福点公式变体',
								<XQSegmented value={lotFortuneVariant} options={LOT_FORTUNE_VARIANT_OPTIONS} onChange={(e)=>this.applyClassicalField('lotFortuneVariant', e && e.target ? e.target.value : e)} />)}
							{cell('点度计数法',
								<XQSegmented value={lotProjection} options={LOT_PROJECTION_OPTIONS} onChange={(e)=>this.applyClassicalField('lotProjection', e && e.target ? e.target.value : e)} />)}
						</div>
						<XQCheckList columns={2}>
							{boolItem('lotrev', '福点按昼夜反转（关则恒昼式）', lotReversalOn, (on)=>this.applyClassicalField('lotReversal', on ? 1 : 0, true))}
							{boolItem('hermrev', '七星点按昼夜反转（关则恒同式 · 批判本校勘）', hermeticLotsReversalOn, (on)=>this.applyClassicalField('hermeticLotsReversal', on ? 1 : 0))}
							{boolItem('lotsdoc', '四点文档序公式（婚·子·友·疾）', lotsDocReverseOn, (on)=>this.applyClassicalField('lotsDocReverse', on ? 1 : 0))}
							{boolItem('fatheralt', '父点土星伏时替代式（Dorotheus 系）', lotFatherCombustAltOn, (on)=>this.applyClassicalField('lotFatherCombustAlt', on ? 1 : 0))}
						</XQCheckList>
					</div>
					<div className="horosa-selector-subgroup">
						<div className="horosa-selector-subtitle">相位与容许度</div>
						<div className="horosa-terms-grid">
							{cell('容许度判据体系',
								<XQSelect size="small" style={{ width: 232 }} value={orbSystem} dropdownMatchSelectWidth={false}
									onChange={(val)=>this.applyClassicalField('orbSystem', val)}>
									{ORB_SYSTEM_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
								</XQSelect>)}
							{cell('发光体 · 四轴轨加成',
								<XQSegmented value={luminaryOrbBonus} options={LUM_BONUS_OPTIONS} onChange={(e)=>this.applyClassicalField('luminaryOrbBonus', e && e.target ? e.target.value : e)} />)}
							{cell('行运相位容许度（推运族初值）',
								<XQSegmented value={transitOrb} options={TRANSIT_ORB_OPTIONS} onChange={(e)=>{ setClassicalChartGlobal('transitOrb', e && e.target ? e.target.value : e); this.forceUpdate(); }} />)}
							{cell('离相显示上限（相位表）',
								<XQSegmented value={separatingOrbCap} options={SEPARATING_CAP_OPTIONS} onChange={(e)=>{ setClassicalChartGlobal('separatingOrbCap', e && e.target ? e.target.value : e); this.forceUpdate(); }} />)}
							{cell('正相位 partile 判据（相位表标记 · 尊贵计分）',
								<XQSegmented value={partileDef} options={PARTILE_OPTIONS} onChange={(e)=>this.applyClassicalField('partileDef', e && e.target ? e.target.value : e)} />)}
							{cell('映点接触容许度',
								<XQSelect size="small" style={{ width: 120 }} value={antisciaOrb} dropdownMatchSelectWidth={false}
									onChange={(val)=>this.applyClassicalField('antisciaOrb', val)}>
									{ANTISCIA_ORB_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
								</XQSelect>)}
						</div>
						<XQCheckList columns={2}>
							{boolItem('onlyapp', '相位表只显入相', aspectShowOnlyApplyingOn, (on)=>{ setClassicalChartGlobal('aspectShowOnlyApplying', on ? 1 : 0); this.forceUpdate(); })}
							{boolItem('aspcusps', '宫头参与相位（≤3°）', aspectIncludeCuspsOn, (on)=>this.applyClassicalField('aspectIncludeCusps', on ? 1 : 0))}
							{boolItem('asplots', '希腊点参与相位（点为受体 · ≤3°）', aspectIncludeLotsOn, (on)=>this.applyClassicalField('aspectIncludeLots', on ? 1 : 0))}
							{boolItem('aspmid', '中点参与相位（日月四轴 · 硬相 ≤1.5°）', aspectIncludeMidpointsOn, (on)=>this.applyClassicalField('aspectIncludeMidpoints', on ? 1 : 0))}
						</XQCheckList>
					</div>
					<div className="horosa-selector-subgroup">
						<div className="horosa-selector-subtitle">恒星与天象</div>
						<div className="horosa-terms-grid">
							{cell('恒星轨档（汇合恒星 · 恒星触发）',
								<XQSegmented value={fixedStarOrbMode} options={STAR_ORB_MODE_OPTIONS} onChange={(e)=>this.applyClassicalField('fixedStarOrbMode', e && e.target ? e.target.value : e)} />)}
							{cell('恒星平轨值',
								<XQSelect size="small" style={{ width: 120 }} value={fixedStarOrb} dropdownMatchSelectWidth={false}
									onChange={(val)=>this.applyClassicalField('fixedStarOrb', val)}>
									{STAR_ORB_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
								</XQSelect>)}
							{cell('留驻判定（盘面 S·D 标）',
								<XQSelect size="small" style={{ width: 232 }} value={stationMarking} dropdownMatchSelectWidth={false}
									onChange={(val)=>this.applyClassicalField('stationMarking', val)}>
									{STATION_MODE_OPTIONS.map((o)=>(<Option key={o.value} value={o.value}>{o.label}</Option>))}
								</XQSelect>)}
							{cell('食时刻口径（星历食相表）',
								<XQSegmented value={eclipseTimeMode} options={ECLIPSE_TIME_OPTIONS} onChange={(e)=>{ setClassicalChartGlobal('eclipseTimeMode', e && e.target ? e.target.value : e); this.forceUpdate(); }} />)}
							{cell('自定义恒星黄道（黄道下拉「自定义」档）',
								<XQButton size="small" onClick={()=>this.setState({ ayanMgrOpen: true })}>管理历元槽位…</XQButton>)}
						</div>
					</div>
					<div className="horosa-selector-subgroup">
						<div className="horosa-selector-subtitle">返照与推运</div>
						<div className="horosa-terms-grid">
							{cell('太阳返照法',
								<XQSegmented value={solarReturnVariant} options={SOLAR_RETURN_VARIANT_OPTIONS} onChange={(e)=>this.applyClassicalField('solarReturnVariant', e && e.target ? e.target.value : e)} />)}
							{cell('返照落宫投影',
								<XQSegmented value={returnLatitudeMode} options={RETURN_LAT_OPTIONS} onChange={(e)=>this.applyClassicalField('returnLatitudeMode', e && e.target ? e.target.value : e)} />)}
						</div>
					</div>
					<div className="horosa-selector-subgroup">
						<div className="horosa-selector-subtitle">宫位与落宫</div>
						<div className="horosa-terms-grid">
							{cell('行星落宫 · 宫头前移（整宫制豁免）',
								<XQSegmented value={houseCuspAdvance} options={HOUSE_CUSP_ADVANCE_OPTIONS} onChange={(e)=>this.applyClassicalField('houseCuspAdvance', e && e.target ? e.target.value : e)} />)}
						</div>
					</div>
				</div>

				{/* ④ 卜卦 · 择日判读 —— divinationJudgeGlobals(纯判读两键;三态/空亡/恒星等已升上方全盘生效组) */}
				<div className="horosa-selector-section">
					<XQSectionTitle>卜卦 · 择日判读</XQSectionTitle>
					<div className="horosa-selector-scope-note">仅下列两项只作用于卜卦盘 / 择日盘的判读引擎；卜卦流派学理已绑定的项恒以流派为准。其余古典口径（落宫 / 三态 / 空亡 / 恒星 / 映点）已在上方「古典计算 · 全盘生效」组，全站排盘与显示随动。</div>
					<XQCheckList columns={2}>
						{boolItem('cmss', '燃烧限同座（异座不判燃烧）', !!jg.combustMitigateSameSign, (on)=>this.applyJudgeGlobal('combustMitigateSameSign', on))}
						{boolItem('antiscia', '映点参与判读（隐合 / 隐冲）', !!jg.antiscia, (on)=>this.applyJudgeGlobal('antiscia', on))}
					</XQCheckList>
				</div>

				{/* ⑤ 解释与计算 */}
				{/* ⑥ 灵学扩展([WP-8];近代推算体系,默认全关) */}
				<div className="horosa-selector-section">
					<XQSectionTitle>灵学扩展</XQSectionTitle>
					<div className="horosa-selector-scope-note">以下为近代灵学体系推算项，非古典文献口径；默认关闭。祝融星为推算行星（无天文实体）。</div>
					<div className="horosa-terms-grid">
						{cell('祝融星（推算行星）',
							<XQSegmented value={vulcanCalc} options={VULCAN_OPTIONS} onChange={(e)=>this.applyClassicalField('vulcanCalc', e && e.target ? e.target.value : e)} />)}
						{cell('七射线权重',
							<XQSegmented value={rayWeighting} options={RAY_OPTIONS} onChange={(e)=>{ setClassicalChartGlobal('rayWeighting', e && e.target ? e.target.value : e); this.forceUpdate(); }} />)}
					</div>
				</div>

				{/* [WP-7] 两个自定义 Modal(常挂条件渲染;保存后 forceUpdate 刷新回显)。 */}
				{this.state.termsEditorOpen ? (
					<TermsEditor open onClose={()=>this.setState({ termsEditorOpen: false })}
						onSaved={()=>{ this.applyClassicalField('termsVariant', 4, true); }} />
				) : null}
				{this.state.ayanMgrOpen ? (
					<CustomAyanamsaManager open onClose={()=>this.setState({ ayanMgrOpen: false })}
						onChanged={()=>this.forceUpdate()} />
				) : null}
				<div className="horosa-selector-section">
					<XQSectionTitle>解释与计算</XQSectionTitle>
					<XQCheckList columns={3}>
						{boolItem('phi', '星曜附带后天宫信息', this.props.showPlanetHouseInfo === 1 || this.props.showPlanetHouseInfo === true, this.changeShowPlanetHouseInfo)}
						{boolItem('mean', '是否显示星 / 宫 / 座 / 相释义', this.props.showAstroMeaning === 1 || this.props.showAstroMeaning === true, this.changeShowAstroMeaning)}
						{boolItem('rec', '仅按本垣擢升计算互容接纳', this.props.showOnlyRulExaltReception === 1 || this.props.showOnlyRulExaltReception === true, this.changeOnlyRulerExaltReception)}
					</XQCheckList>
				</div>
			</div>
		);
	}
}

export default ChartDisplaySelector;
