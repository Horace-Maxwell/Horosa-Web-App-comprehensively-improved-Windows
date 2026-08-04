import { fetchPdPoles } from '../../services/astroPd3d';
import { markPanelReady } from '../../utils/perfMark';
import { Component } from 'react';
import { fetchPd3D } from '../../services/astroPd3d'; // [WP-5.2] pd3d 调试透镜(hover 显示引擎坐标,零后端改动)
import { safeLocalStorageSet } from '../../utils/safeStorage';
import { Popover, Checkbox } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from './AstroHelper';
import { appendPlanetHouseInfoById, splitPlanetHouseInfoText, } from '../../utils/planetHouseInfo';
import { buildMeaningTipByCategory, } from './AstroMeaningData';
import { isMeaningEnabled, wrapWithMeaning, } from './AstroMeaningPopover';
import {TableOddRowBgColor} from '../../utils/constants'
import styles from '../../css/styles.less';
import { XQButton as Button, XQInput as Input, XQInputNumber as InputNumber, XQSelect as Select, XQTable as Table } from '../xq-ui';
import XQIcon from '../xq-icons';
import { PD_SCHOOL_PRESETS, PD_SCHOOL_PRESET_OPTIONS, PD_SCHOOL_PRESET_CUSTOM, pdPresetOf } from './pdSchoolPresets';
import PdExtensionPanel from './PdExtensionPanel';
import { SUPPORTED_PD_METHODS,
	SUPPORTED_PD_PROJECTIONS, SUPPORTED_PD_FRAMES, SUPPORTED_PD_FRAMEWORKS,
	PD_PROJECTION_LABELS, PD_FRAME_LABELS, PD_FRAMEWORK_LABELS ,
	PD_SIGNIFICATOR_OPTIONS,
	PD_PROMISSOR_TYPE_OPTIONS,
	SUPPORTED_PD_TIME_KEYS,
	PD_SYNC_REV,
} from '../../utils/primaryDirectionSync';

const Option = Select.Option;
// 🔴 PD_SYNC_REV 只能 import,绝不在此另写字面量。
// 病史:这里曾手抄一份常量,漏跟着 utils/primaryDirectionSync.js 升版 —— 后端响应里的
// pdSyncRev 与本地字面量永不相等 → hasCompleteParams 恒 false → 表格「始终重算」、
// 从不复用已算好的持久化结果。v8→v9 漏改过一次(注释里留了案底),而后又漂到本地 v13
// vs 共享 v15,同一个坑踩了第二次。改成 import 后物理上不可能再漂移。
const DEFAULT_PD_METHOD = 'core_alchabitius';
const DEFAULT_PD_TIME_KEY = 'Ptolemy';
const DEFAULT_PD_TYPE = 0;
// 🔴 方位法白名单同样只 import,不在此另写一份 —— 与上面 PD_SYNC_REV 同型的坑:
// 这里曾手抄一份 13 项数组,与 utils/primaryDirectionSync.js 的 export 并行存在。两份"目前
// 内容一致"只是因为改名时恰好两处都改到了,下一次就未必。白名单的语义(全收以免旧存盘
// 静默回退;下拉另有更窄的已核验集)属于共享真值源那一侧,不该在消费端复制。

// ── 报表字段:列可配置(localStorage 持久化;默认只显核心列避免过宽) ──
const PD_COLUMNS_STORE_KEY = 'horosa.pd.columns.v1';
const PD_ORB_STORE_KEY = 'horosa.pd.orb.v1';
// key → 标题;core=默认可见。Pole(应星极点)为行级引擎输出,行 shape 5 元锁死不含极点 → 留待后续(不占位)。
// 类型语义已融合进迫星列(glyph+语义文本+相位筛选);黄道世界/钥匙/投影×定局为全局设置
// (工具条与快照已示),不再单列。
const PD_OPTIONAL_COLUMNS = [
	{ key: 'dc', title: '顺/逆', core: true },
	{ key: 'age', title: '年龄', core: true },
	{ key: 'orb', title: '影响期', core: false },
	{ key: 'pole', title: '极点 Pole', core: false },
];
const PD_DEFAULT_VISIBLE_COLS = PD_OPTIONAL_COLUMNS.filter((c)=>c.core).map((c)=>c.key);
const PD_ASPECT_GLYPHS = { 0: '☌', 60: '✶', 90: '□', 120: '△', 180: '☍' };
// 平行行第三段=物理轴名(MER 子午/HOR 地平;后端两路径统一,轴收敛后不再有 180/270)。
// 数字键仅为旧档快照兼容:两后端域(MC=0 vs ASC=0)对数字异义,无法可靠回译轴名,
// 故旧数字统一显示中性「平行轴·N°」而非臆断 MC/ASC。
const PD_AXIS_LABEL = { MER: '子午轴', HOR: '地平轴' };

// 迫星 ID → 类型标签(Aspect / Type 列)。ID 语法 <prefix>_<body>_<third>。
function pdRowTypeLabel(promId){
	const parts = `${promId || ''}`.split('_');
	const prefix = parts[0] || '';
	const third = parts.length >= 3 ? parts[2] : '0';
	const asp = Number(third);
	if(prefix === 'N'){
		if(Number.isFinite(asp) && asp === 180){ return '☍ 冲'; }
		return '☌ 本体';
	}
	if(prefix === 'D' || prefix === 'S'){
		const g = PD_ASPECT_GLYPHS[asp] || '';
		return `${g} 相位${asp || ''}°（${prefix === 'D' ? '右' : '左'}）`;
	}
	if(prefix === 'A'){ return '映点'; }
	if(prefix === 'C'){ return '反映点'; }
	if(prefix === 'PD'){ return '赤纬平行'; }
	if(prefix === 'PC'){ return '赤纬反平行'; }
	if(prefix === 'MP'){ return `世界平行·${PD_AXIS_LABEL[third] || (Number.isFinite(asp) ? `平行轴${asp}°` : third)}`; }
	if(prefix === 'RP'){ return `急动平行·${PD_AXIS_LABEL[third] || (Number.isFinite(asp) ? `平行轴${asp}°` : third)}`; }
	if(prefix === 'T'){ return '界分界'; }
	if(prefix === 'HC'){ return '宫始点'; }
	if(prefix === 'FS'){ return '恒星'; }
	if(prefix === 'LT'){ return '阿拉伯点'; }
	return prefix || '—';
}

// 迫星行相位 glyph(融合进迫星列;合/冲走 N 前缀单点,60/90/120 走 D/S 双侧)
function pdRowAspectGlyph(promId){
	const parts = `${promId || ''}`.split('_');
	const prefix = parts[0] || '';
	const asp = Number(parts.length >= 3 ? parts[2] : 0);
	if(prefix === 'N' && asp === 0){ return '☌'; }
	if(prefix === 'N' && asp === 180){ return '☍'; }
	if((prefix === 'D' || prefix === 'S') && PD_ASPECT_GLYPHS[asp]){ return PD_ASPECT_GLYPHS[asp]; }
	return '';
}

// 迫星列「相位/类型」筛选维(与星名筛选同列并存,value 前缀分流)
const PD_PROM_FILTER_EXTRA = [
	{ text: '☌ 合相', value: 'ASP:0' },
	{ text: '✶ 六合 60°', value: 'ASP:60' },
	{ text: '□ 刑 90°', value: 'ASP:90' },
	{ text: '△ 拱 120°', value: 'ASP:120' },
	{ text: '☍ 冲 180°', value: 'ASP:180' },
	{ text: '右相位', value: 'HAND:dexter' },
	{ text: '左相位', value: 'HAND:sinister' },
	{ text: '映点/反映点', value: 'TYPE:anti' },
	{ text: '平行族', value: 'TYPE:par' },
	{ text: '界分界', value: 'TYPE:term' },
	{ text: '宫始点', value: 'TYPE:cusp' },
	{ text: '恒星', value: 'TYPE:star' },
	{ text: '阿拉伯点', value: 'TYPE:lot' },
];

export function pdPromFilterMatch(value, promId){
	const parts = `${promId || ''}`.split('_');
	const prefix = parts[0] || '';
	const asp = Number(parts.length >= 3 ? parts[2] : 0);
	if(`${value}`.indexOf('ASP:') === 0){
		const want = Number(`${value}`.slice(4));
		if(want === 0){ return prefix === 'N' && asp === 0; }
		if(want === 180){ return prefix === 'N' && asp === 180; }
		return (prefix === 'D' || prefix === 'S') && asp === want;
	}
	// 相位方向(用户点单:进迫星列筛选,与相位/类型维并存):判定与行文案渲染同前缀源
	// (D()/S() 的「右相位处/左相位处」),D_=右 dexter / S_=左 sinister;无方向行不命中。
	if(`${value}`.indexOf('HAND:') === 0){ return directionRowAspectHand(promId) === `${value}`.slice(5); }
	if(value === 'TYPE:anti'){ return prefix === 'A' || prefix === 'C'; }
	if(value === 'TYPE:par'){ return prefix === 'PD' || prefix === 'PC' || prefix === 'MP' || prefix === 'RP'; }
	if(value === 'TYPE:term'){ return prefix === 'T'; }
	if(value === 'TYPE:cusp'){ return prefix === 'HC'; }
	if(value === 'TYPE:star'){ return prefix === 'FS'; }
	if(value === 'TYPE:lot'){ return prefix === 'LT'; }
	return null;   // 非扩展值 → 交回星名 indexOf
}
const CORE_PD_SUPPORTED_BASE_IDS = new Set([
	AstroConst.SUN,
	AstroConst.MOON,
	AstroConst.MERCURY,
	AstroConst.VENUS,
	AstroConst.MARS,
	AstroConst.JUPITER,
	AstroConst.SATURN,
	AstroConst.URANUS,
	AstroConst.NEPTUNE,
	AstroConst.PLUTO,
	AstroConst.NORTH_NODE,
	AstroConst.PARS_FORTUNA,
	AstroConst.ASC,
	AstroConst.MC,
	AstroConst.VERTEX,
]);

const PD_PAGE_SIZE_KEY = 'horosa.pd.pageSize';
const PD_PAGE_SIZE_OPTIONS = ['20', '50', '100', '200'];

// 行的相位方向:促发 ID 前缀 D_=右相位(dexter)/S_=左相位(sinister)——与行文案渲染
// (下方 D()/S() 的「右相位处/左相位处」)同一前缀源,天然零分叉;其余(N_/A_/C_/T_)无方向。
// 消费方=迫星列筛选 pdPromFilterMatch 的 HAND: 分支(用户点单:筛选入口在列头下拉)。
export function directionRowAspectHand(promittor){
	const id = `${promittor || ''}`;
	if(id.indexOf('D_') === 0){ return 'dexter'; }
	if(id.indexOf('S_') === 0){ return 'sinister'; }
	return null;
}

function readPdVisibleCols(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			const raw = window.localStorage.getItem(PD_COLUMNS_STORE_KEY);
			if(raw){
				const arr = JSON.parse(raw);
				if(Array.isArray(arr)){
					const allow = PD_OPTIONAL_COLUMNS.map((c)=>c.key);
					const picked = arr.filter((k)=>allow.indexOf(k) >= 0);
					return picked;
				}
			}
		}
	}catch(e){ /* 坏值回默认 */ }
	return PD_DEFAULT_VISIBLE_COLS.slice();
}

function readPdOrbYears(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			const v = Number(window.localStorage.getItem(PD_ORB_STORE_KEY));
			if(Number.isFinite(v) && v > 0 && v <= 10){
				return v;
			}
		}
	}catch(e){ /* 坏值回默认 */ }
	return 0.25;   // 默认前后三个月
}

function readPdPageSize(){
	try{
		if(typeof window !== 'undefined' && window.localStorage){
			const v = parseInt(window.localStorage.getItem(PD_PAGE_SIZE_KEY), 10);
			if(Number.isFinite(v) && PD_PAGE_SIZE_OPTIONS.indexOf(`${v}`) >= 0){
				return v;
			}
		}
	}catch(e){
		// localStorage 不可用回默认
	}
	return 50;
}

class AstroPrimaryDirection extends Component{

	constructor(props) {
		super(props);

		this.state = {
			searchYear: '',
			pdMethodValue: props.pdMethod ? props.pdMethod : 'core_alchabitius',
			pdTimeKeyValue: props.pdTimeKey ? props.pdTimeKey : 'Ptolemy',
			pdYearsValue: props.pdYears ? props.pdYears : 100,
			// 方向类型(0黄道/1世俗 in mundo)、向运(顺 direct / 逆 converse,可同时选)、映点、界 — 进阶开关。
			pdTypeValue: props.pdType === 1 ? 1 : 0,
			// 顺逆默认都开(用户偏好):仅显式 0 才关。
			pdDirectValue: props.pdDirect === 0 ? 0 : 1,
			pdConverseValue: props.pdConverse === 0 ? 0 : 1,
			pdAntisciaValue: props.pdAntiscia ? 1 : 0,
			pdTermsValue: props.pdTerms ? 1 : 0,
			// 解耦九键(P1-1 左 rail):props 种子,默认=引擎缺省。
			pdProjectionValue: SUPPORTED_PD_PROJECTIONS.indexOf(props.pdProjection) >= 0 ? props.pdProjection : 'ptolemy',
			pdFrameValue: SUPPORTED_PD_FRAMES.indexOf(props.pdFrame) >= 0 ? props.pdFrame : 'alcabitius',
			pdFrameworkValue: SUPPORTED_PD_FRAMEWORKS.indexOf(props.pdFramework) >= 0 ? props.pdFramework : 'aspect',
			pdParallelValue: props.pdParallel ? 1 : 0,
			pdRaptParallelValue: props.pdRaptParallel ? 1 : 0,
			pdTimeKeyCustomValue: (props.pdTimeKeyCustom && Number(props.pdTimeKeyCustom) > 0) ? Number(props.pdTimeKeyCustom) : null,
			pdSignificatorsValue: Array.isArray(props.pdSignificators) ? props.pdSignificators : [],
			pdPromissorTypesValue: Array.isArray(props.pdPromissorTypes) ? props.pdPromissorTypes : [],
			termsVariantValue: (props.termsVariant === 1 || props.termsVariant === 2) ? props.termsVariant : 0,
			// 分页大小受控+持久化:antd4 在 total>50 时自动显示「X 条/页」选择器,此前 pageSize 写死 50
			// 又无 onChange → 用户改完被立即重置(「点了没反应」)。
			pdPageSize: readPdPageSize(),
			pdVisibleCols: readPdVisibleCols(),
			pdOrbYears: readPdOrbYears(),
			// 工具栏实测真高(换行后随之增大;表格高度按它扣减 → 永不被工具栏遮挡)
			toolbarH: 48,
		}

		this.searchInput = null;
		this.toolbarRef = null;
		this.bindToolbarRef = this.bindToolbarRef.bind(this);

		this.convertToDataSource = this.convertToDataSource.bind(this);
		this.convertText = this.convertText.bind(this);
		this.planetText = this.planetText.bind(this);
		this.T = this.T.bind(this);
		this.A = this.A.bind(this);
		this.C = this.C.bind(this);
		this.D = this.D.bind(this);
		this.S = this.S.bind(this);
		this.N = this.N.bind(this);
		this.baseDirectionObjectId = this.baseDirectionObjectId.bind(this);
		this.isCoreUnsupportedRow = this.isCoreUnsupportedRow.bind(this);

		this.genDateFilterDropdownDom = this.genDateFilterDropdownDom.bind(this);
		this.genDateColFilter = this.genDateColFilter.bind(this);
			this.genStarColFilter = this.genStarColFilter.bind(this);
			this.handleSearch = this.handleSearch.bind(this);
			this.handleReset = this.handleReset.bind(this);
			this.showMeaning = this.showMeaning.bind(this);
		this.handlePdMethodChange = this.handlePdMethodChange.bind(this);
		this.handlePdTimeKeyChange = this.handlePdTimeKeyChange.bind(this);
		this.handlePdCalculate = this.handlePdCalculate.bind(this);
		this.normalizePdMethod = this.normalizePdMethod.bind(this);
		this.normalizePdTimeKey = this.normalizePdTimeKey.bind(this);
		this.normalizePdType = this.normalizePdType.bind(this);
		this.getSelectedPdMethod = this.getSelectedPdMethod.bind(this);
		this.getSelectedPdTimeKey = this.getSelectedPdTimeKey.bind(this);
		this.getAppliedPdState = this.getAppliedPdState.bind(this);
		this.handlePdYearsChange = this.handlePdYearsChange.bind(this);
		this.normalizePdYears = this.normalizePdYears.bind(this);
		this.getSelectedPdYears = this.getSelectedPdYears.bind(this);
		this.handlePdTypeChange = this.handlePdTypeChange.bind(this);
		this.handlePdDirectChange = this.handlePdDirectChange.bind(this);
		this.handlePdConverseChange = this.handlePdConverseChange.bind(this);
		this.handlePdAntisciaChange = this.handlePdAntisciaChange.bind(this);
		this.handlePdTermsChange = this.handlePdTermsChange.bind(this);
		this.getSelectedPdType = this.getSelectedPdType.bind(this);
		this.getSelectedPdDirect = this.getSelectedPdDirect.bind(this);
		this.getSelectedPdConverse = this.getSelectedPdConverse.bind(this);
		this.getSelectedPdAntiscia = this.getSelectedPdAntiscia.bind(this);
		this.getSelectedPdTerms = this.getSelectedPdTerms.bind(this);

			this.objs = AstroConst.LIST_OBJECTS.slice(0);
			this.objs.push(AstroConst.ASC);
			this.objs.push(AstroConst.MC);
			// 宿命点应星行(v12)进 促发/应星 列筛选(候选与行集求交,无行时不出现)。
			this.objs.push(AstroConst.VERTEX);

		}

	/** 工具栏真高观测:换行/收窄导致高度变化时更新 state,表格随之避让(生产级替代固定 48px)。 */
	bindToolbarRef(el){
		this.toolbarRef = el;
		if(this._toolbarRO){
			try{ this._toolbarRO.disconnect(); }catch(e){ /* noop */ }
			this._toolbarRO = null;
		}
		if(!el || typeof ResizeObserver === 'undefined'){
			return;
		}
		const sync = ()=>{
			if(!this.toolbarRef){ return; }
			const h = Math.round(this.toolbarRef.getBoundingClientRect().height);
			if(h > 0 && Math.abs(h - (this.state.toolbarH || 0)) > 1){
				this.setState({ toolbarH: h });
			}
		};
		this._toolbarRO = new ResizeObserver(sync);
		this._toolbarRO.observe(el);
		sync();
	}

	componentWillUnmount(){
		if(this._toolbarRO){
			try{ this._toolbarRO.disconnect(); }catch(e){ /* noop */ }
			this._toolbarRO = null;
		}
	}

	componentDidUpdate(prevProps){
		// horosa_panel_ready_v1:主限法表格页「画完」= 新 value(chartObj)带着新 PD 数据渲染的这一帧。
		// 打在 props 同步守卫**之前** —— 否则「只换时间、pd 配置不变」的绝大多数交互会被 return 掉、永远不打点。
		if(prevProps.value !== this.props.value){
			markPanelReady('direction');
		}
		// 仅当 props 真正变化时才从 props 同步本地 state（镜像 AstroPrimaryDirectionChart 的口径）。
		// 旧逻辑「state≠normalize(props) 就 setState」会把用户对 度数换算/推运方法 的本地改选（如选 Naibod）
		// 立刻反弹回全局旧值，导致表格上方的选项形同只读。改为 prevProps 守卫后：props 稳定→不同步（本地改选保留），
		// 用户点「计算」经 onPdConfigApply 落全局后 props 才变、再同步。仍比旧 state-diff 守卫更严格，绝不重新引入
		// 「旧存盘 pdMethod 规范化≠原 prop → 无限 setState 白屏」（内层 state-diff 守卫亦保留作双保险）。
		if(prevProps.pdMethod === this.props.pdMethod
			&& prevProps.pdTimeKey === this.props.pdTimeKey
			&& prevProps.pdProjection === this.props.pdProjection
			&& prevProps.pdFrame === this.props.pdFrame
			&& prevProps.pdFramework === this.props.pdFramework
			&& prevProps.pdParallel === this.props.pdParallel
			&& prevProps.pdRaptParallel === this.props.pdRaptParallel
			&& prevProps.termsVariant === this.props.termsVariant
			&& prevProps.pdYears === this.props.pdYears
			&& prevProps.pdType === this.props.pdType
			&& prevProps.pdDirect === this.props.pdDirect
			&& prevProps.pdConverse === this.props.pdConverse
			&& prevProps.pdAntiscia === this.props.pdAntiscia
			&& prevProps.pdTerms === this.props.pdTerms){
			return;
		}
		const nextMethod = this.normalizePdMethod(this.props.pdMethod);
		const nextTimeKey = this.normalizePdTimeKey(this.props.pdTimeKey);
		const nextYears = this.normalizePdYears(this.props.pdYears);
		const nextType = this.props.pdType === 1 ? 1 : 0;
		const nextDirect = this.props.pdDirect === 0 ? 0 : 1;
		const nextConverse = this.props.pdConverse === 0 ? 0 : 1;
		const nextAntiscia = this.props.pdAntiscia ? 1 : 0;
		const nextTerms = this.props.pdTerms ? 1 : 0;
		const nextProjection = SUPPORTED_PD_PROJECTIONS.indexOf(this.props.pdProjection) >= 0 ? this.props.pdProjection : 'ptolemy';
		const nextFrame = SUPPORTED_PD_FRAMES.indexOf(this.props.pdFrame) >= 0 ? this.props.pdFrame : 'alcabitius';
		const nextFramework = SUPPORTED_PD_FRAMEWORKS.indexOf(this.props.pdFramework) >= 0 ? this.props.pdFramework : 'aspect';
		const nextParallel = this.props.pdParallel ? 1 : 0;
		const nextRapt = this.props.pdRaptParallel ? 1 : 0;
		const nextTermsVariant = (this.props.termsVariant === 1 || this.props.termsVariant === 2) ? this.props.termsVariant : 0;
		if(this.state.pdMethodValue !== nextMethod
			|| this.state.pdTimeKeyValue !== nextTimeKey
			|| this.state.pdYearsValue !== nextYears
			|| this.state.pdTypeValue !== nextType
			|| this.state.pdDirectValue !== nextDirect
			|| this.state.pdConverseValue !== nextConverse
			|| this.state.pdAntisciaValue !== nextAntiscia
			|| this.state.pdTermsValue !== nextTerms
			|| this.state.pdProjectionValue !== nextProjection
			|| this.state.pdFrameValue !== nextFrame
			|| this.state.pdFrameworkValue !== nextFramework
			|| this.state.pdParallelValue !== nextParallel
			|| this.state.pdRaptParallelValue !== nextRapt
			|| this.state.termsVariantValue !== nextTermsVariant){
			this.setState({
				pdMethodValue: nextMethod,
				pdProjectionValue: nextProjection,
				pdFrameValue: nextFrame,
				pdFrameworkValue: nextFramework,
				pdParallelValue: nextParallel,
				pdRaptParallelValue: nextRapt,
				termsVariantValue: nextTermsVariant,
				pdTimeKeyValue: nextTimeKey,
				pdYearsValue: nextYears,
				pdTypeValue: nextType,
				pdDirectValue: nextDirect,
				pdConverseValue: nextConverse,
				pdAntisciaValue: nextAntiscia,
				pdTermsValue: nextTerms,
			});
		}
	}

	showMeaning(){
		return isMeaningEnabled(this.props.showAstroMeaning);
	}

	planetText(id){
		const base = AstroText.AstroMsg[id] ? AstroText.AstroMsg[id] : `${id || ''}`;
		const text = appendPlanetHouseInfoById(
			base,
			this.props.value,
			id,
			this.props.showPlanetHouseInfo
		);
		const one = splitPlanetHouseInfoText(text);
		const labelNode = (
			<span>
				<span style={{fontFamily: AstroConst.AstroFont}}>{one.label}</span>
				{one.info ? <span style={{fontFamily: AstroConst.NormalFont}}>{`(${one.info})`}</span> : null}
			</span>
		);
		return wrapWithMeaning(labelNode, this.showMeaning(), buildMeaningTipByCategory('planet', id));
	}

	isBoundRow(pd){
		if(!pd || !pd.length){
			return false;
		}
		const promittor = pd[1] ? `${pd[1]}` : '';
		const significator = pd[2] ? `${pd[2]}` : '';
		return promittor.indexOf('T_') === 0 || significator.indexOf('T_') === 0;
	}

	isAntisciaRow(pd){
		if(!pd || !pd.length){
			return false;
		}
		const promittor = pd[1] ? `${pd[1]}` : '';
		const significator = pd[2] ? `${pd[2]}` : '';
		return (
			promittor.indexOf('A_') === 0 || promittor.indexOf('C_') === 0 ||
			significator.indexOf('A_') === 0 || significator.indexOf('C_') === 0
		);
	}

	baseDirectionObjectId(text){
		const parts = `${text || ''}`.split('_');
		if(parts.length < 3){
			return `${text || ''}`;
		}
		return parts.slice(1, parts.length - 1).join('_').trim();
	}

	isExtensionRow(pd, appliedPdState){
		// 用户显式开启的扩展/平行行:按前缀与扩展体名放行(与引擎产出前缀一一对应)
		const prom = `${pd && pd[1] || ''}`;
		const sig = `${pd && pd[2] || ''}`;
		if(/^(HC|FS|LT|PD|PC|MP|RP)_/.test(prom)){ return true; }
		const st = appliedPdState || {};
		const sigKeys = Array.isArray(st.pdSignificators) ? st.pdSignificators : [];
		if(sigKeys.length){
			const sigBase = sig.split('_')[1] || '';
			if(sigKeys.indexOf('Syzygy') >= 0 && sigBase === 'Syzygy'){ return true; }
			if(sigKeys.indexOf('Spirit') >= 0 && sigBase === 'Spirit'){ return true; }
			if(sigKeys.indexOf('Cusps') >= 0 && /^Cusp\d+$/.test(sigBase)){ return true; }
			if(sigKeys.indexOf('Desc') >= 0 && sigBase === 'Desc'){ return true; }
			if(sigKeys.indexOf('IC') >= 0 && sigBase === 'IC'){ return true; }
			if(sigKeys.indexOf('Stars') >= 0 || sigKeys.indexOf('Lots') >= 0){
				// 恒星/阿点应星名不定长:非 core 白名单且被显式开启 → 放行
				if(sigBase && !/^(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)$/.test(sigBase)){ return true; }
			}
		}
		return false;
	}

	isCoreUnsupportedRow(pd){
		if(!pd || !pd.length){
			return false;
		}
		if(this.isBoundRow(pd)){
			return true;
		}
		const promBase = this.baseDirectionObjectId(pd[1]);
		const sigBase = this.baseDirectionObjectId(pd[2]);
		return !CORE_PD_SUPPORTED_BASE_IDS.has(promBase) || !CORE_PD_SUPPORTED_BASE_IDS.has(sigBase);
	}

	genStarColFilter(dataIndex, filterKeys, withAspectFilters){
		let filters = [];

		for(let i=0; i<this.objs.length; i++){
			let planet = this.objs[i];
			if(!filterKeys.has(planet)){
				continue;
			}
			let obj = {
				text: this.planetText(planet),
				value: planet,
			}
			filters.push(obj);
		}
		if(withAspectFilters){
			filters = filters.concat(PD_PROM_FILTER_EXTRA);
		}

		let res = {
			filters: filters,
			onFilter: (value, record)=>{
				if(!record[dataIndex]){
					return false;
				}
				const extra = pdPromFilterMatch(value, record[dataIndex]);
				if(extra !== null){
					return extra;
				}
				return record[dataIndex].indexOf(value) >= 0;
			},

		};
		return res;
	}

	genDateColFilter(dataIndex){
		let res = {
			filterDropdown: (option)=>{
				return this.genDateFilterDropdownDom(option)
			},
			onFilterDropdownVisibleChange: (visible)=>{
				if(visible && this.searchInput){
					setTimeout(()=>{ this.searchInput.select()});
				}
			},
			filterIcon: (filtered)=>{
				let dom = (
					<XQIcon name="search" style={{ color: filtered ? 'var(--horosa-accent, #e7bd75)' : undefined }} />
				);
				return dom;
			},
			onFilter: (value, record)=>{
				if(record[dataIndex]){
					let txt = record[dataIndex].toString().toLowerCase();
					return txt.includes(value.toLowerCase());	
				}
				return false;
			},
		};

		return res;
	}

	genDateFilterDropdownDom(option){
		let { setSelectedKeys, selectedKeys, confirm, clearFilters } = option;
		let dom = (
			<div style={{ padding: 8 }}>
				<Input
					ref={node => {
						this.searchInput = node;
					}}
					placeholder={`输入年数`}
					value={selectedKeys[0]}
					onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
					onPressEnter={() => this.handleSearch(selectedKeys, confirm)}
					style={{ width: 188, marginBottom: 8, display: 'block' }}
				/>
				<Button
					type="primary"
					onClick={() => this.handleSearch(selectedKeys, confirm)}
					icon={<XQIcon name="search" />}
					size="small"
					style={{ width: 90, marginRight: 8 }}
				>
					搜索
				</Button>
				<Button onClick={() => this.handleReset(clearFilters)} size="small" style={{ width: 90 }}>
					重置
				</Button>
			</div>
		);

		return dom;
	}

	handleSearch(selectedKeys, confirm){
		confirm();
		this.setState({ searchYear: selectedKeys[0] });	
	}

	handleReset(clearFilters){
		clearFilters();
    	this.setState({ searchYear: '' });
	}

	handlePdMethodChange(value){
		this.setState({
			pdMethodValue: value,
		});
	}

	handlePdTimeKeyChange(value){
		this.setState({
			pdTimeKeyValue: value,
		});
	}

	handlePdYearsChange(value){
		this.setState({
			pdYearsValue: this.normalizePdYears(value),
		});
	}

	_checkboxChecked(e){
		return e && e.target ? !!e.target.checked : !!e;
	}

	handlePdTypeChange(value){
		this.setState({ pdTypeValue: value === 1 ? 1 : 0, });
	}

	handlePdDirectChange(e){
		const checked = this._checkboxChecked(e);
		// 顺向/逆向至少保留其一,避免「两者皆关」的空向运态。
		if(!checked && this.getSelectedPdConverse() !== 1){
			return;
		}
		this.setState({ pdDirectValue: checked ? 1 : 0, });
	}

	handlePdConverseChange(e){
		const checked = this._checkboxChecked(e);
		if(!checked && this.getSelectedPdDirect() !== 1){
			return;
		}
		this.setState({ pdConverseValue: checked ? 1 : 0, });
	}

	handlePdAntisciaChange(e){
		this.setState({ pdAntisciaValue: this._checkboxChecked(e) ? 1 : 0, });
	}

	handlePdTermsChange(e){
		this.setState({ pdTermsValue: this._checkboxChecked(e) ? 1 : 0, });
	}

	getSelectedPdType(){
		return this.state.pdTypeValue === 1 ? 1 : 0;
	}

	getSelectedPdDirect(){
		return this.state.pdDirectValue === 0 ? 0 : 1;
	}

	getSelectedPdConverse(){
		return this.state.pdConverseValue === 1 ? 1 : 0;
	}

	getSelectedPdAntiscia(){
		return this.state.pdAntisciaValue === 1 ? 1 : 0;
	}

	getSelectedPdTerms(){
		return this.state.pdTermsValue === 1 ? 1 : 0;
	}

	getSelectedPdProjection(){
		return SUPPORTED_PD_PROJECTIONS.indexOf(this.state.pdProjectionValue) >= 0 ? this.state.pdProjectionValue : 'ptolemy';
	}

	getSelectedPdFrame(){
		return SUPPORTED_PD_FRAMES.indexOf(this.state.pdFrameValue) >= 0 ? this.state.pdFrameValue : 'alcabitius';
	}

	getSelectedPdFramework(){
		return SUPPORTED_PD_FRAMEWORKS.indexOf(this.state.pdFrameworkValue) >= 0 ? this.state.pdFrameworkValue : 'aspect';
	}

	getSelectedPdParallel(){
		return this.state.pdParallelValue === 1 ? 1 : 0;
	}

	getSelectedPdRaptParallel(){
		// 自洽性:急动平行必须世界主限;pdtype=0 时强制视为关(控件同时置灰)。
		if(this.getSelectedPdType() !== 1){
			return 0;
		}
		return this.state.pdRaptParallelValue === 1 ? 1 : 0;
	}

	getSelectedTermsVariant(){
		const v = this.state.termsVariantValue;
		return (v === 1 || v === 2) ? v : 0;
	}

	getSelectedPdTimeKeyCustom(){
		const v = Number(this.state.pdTimeKeyCustomValue);
		return (Number.isFinite(v) && v > 0) ? v : null;
	}

	// 当前九维的 preset 反查(受控显示;单项被改 → 'custom')。
	getSelectedPdPreset(){
		return pdPresetOf({
			pdProjection: this.getSelectedPdProjection(),
			pdFrame: this.getSelectedPdFrame(),
			pdtype: this.getSelectedPdType(),
			pdDirect: this.getSelectedPdDirect(),
			pdConverse: this.getSelectedPdConverse(),
			pdTimeKey: this.getSelectedPdTimeKey(),
			pdFramework: this.getSelectedPdFramework(),
			pdParallel: this.state.pdParallelValue === 1 ? 1 : 0,
		});
	}

	// 选档 = 一次性写多维(custom 不可主动选,忽略)。
	handlePdPresetChange(preset){
		const p = PD_SCHOOL_PRESETS[preset];
		if(!p){
			return;
		}
		this.setState({
			pdProjectionValue: p.pdProjection,
			pdFrameValue: p.pdFrame,
			pdTypeValue: p.pdtype,
			pdDirectValue: p.pdDirect,
			pdConverseValue: p.pdConverse,
			pdTimeKeyValue: p.pdTimeKey,
			pdFrameworkValue: p.pdFramework,
			pdParallelValue: p.pdParallel,
		});
	}

	handlePdProjectionChange(value){
		this.setState({ pdProjectionValue: SUPPORTED_PD_PROJECTIONS.indexOf(value) >= 0 ? value : 'ptolemy' });
	}

	handlePdFrameChange(value){
		this.setState({ pdFrameValue: SUPPORTED_PD_FRAMES.indexOf(value) >= 0 ? value : 'alcabitius' });
	}

	handlePdFrameworkChange(value){
		this.setState({ pdFrameworkValue: SUPPORTED_PD_FRAMEWORKS.indexOf(value) >= 0 ? value : 'aspect' });
	}

	handlePdParallelChange(e){
		this.setState({ pdParallelValue: e.target.checked ? 1 : 0 });
	}

	handlePdRaptParallelChange(e){
		this.setState({ pdRaptParallelValue: e.target.checked ? 1 : 0 });
	}

	handleTermsVariantChange(value){
		this.setState({ termsVariantValue: (value === 1 || value === 2) ? value : 0 });
	}

	handlePdTimeKeyCustomChange(value){
		const v = Number(value);
		this.setState({ pdTimeKeyCustomValue: (Number.isFinite(v) && v > 0) ? v : null });
	}

	handlePdSignificatorsChange(vals){
		this.setState({ pdSignificatorsValue: Array.isArray(vals) ? vals : [] });
	}

	handlePdPromissorTypesChange(vals){
		this.setState({ pdPromissorTypesValue: Array.isArray(vals) ? vals : [] });
	}

	requestPdPoles(){
		// Pole 列:极点随 (盘,投影,S 集) 变;按组合键去重,列开着才取。
		const chart = this.props.value || {};
		const params = chart.params || {};
		if(!params.birth){ return; }
		const applied = this.getAppliedPdState();
		const birthParts = `${params.birth}`.split(' ');
		const body = {
			date: birthParts[0], time: birthParts[1] || '00:00:00',
			ad: params.ad ? params.ad : 1, zone: params.zone,
			lat: params.lat, lon: params.lon, gpsLat: params.gpsLat, gpsLon: params.gpsLon,
			hsys: params.hsys, zodiacal: params.zodiacal, siderealAyanamsa: params.siderealAyanamsa,
			pdProjection: applied.pdProjection, pdFrame: applied.pdFrame,
			pdtype: applied.pdtype,
			...(Array.isArray(params.pdSignificators) && params.pdSignificators.length ? { pdSignificators: params.pdSignificators } : {}),
		};
		const key = JSON.stringify(body);
		if(this.pdPolesKey === key){ return; }
		this.pdPolesKey = key;
		fetchPdPoles(body).then((res)=>{
			if(this.pdPolesKey !== key){ return; }
			const poles = res && res.poles ? res.poles : (res && res.data && res.data.poles ? res.data.poles : null);
			this.setState({ pdPolesData: poles || {} });
		}).catch(()=>{
			if(this.pdPolesKey === key){ this.setState({ pdPolesData: {} }); }
		});
	}

	handlePdCalculate(){
		if(!this.needsPdRecompute()){
			return;
		}
		if(this.props.onPdConfigApply){
			this.props.onPdConfigApply(
				this.state.pdMethodValue,
				this.state.pdTimeKeyValue,
				this.getSelectedPdYears(),
				{
					pdtype: this.getSelectedPdType(),
					direct: this.getSelectedPdDirect() === 1,
					converse: this.getSelectedPdConverse() === 1,
					antiscia: this.getSelectedPdAntiscia() === 1,
					terms: this.getSelectedPdTerms() === 1,
					projection: this.getSelectedPdProjection(),
					frame: this.getSelectedPdFrame(),
					framework: this.getSelectedPdFramework(),
					parallel: this.getSelectedPdParallel() === 1,
					raptParallel: this.getSelectedPdRaptParallel() === 1,
					timeKeyCustom: this.getSelectedPdTimeKeyCustom(),
					significators: this.state.pdSignificatorsValue,
					promissorTypes: this.state.pdPromissorTypesValue,
					termsVariant: this.getSelectedTermsVariant(),
				}
			);
		}
	}

	normalizePdMethod(value){
		// 白名单：与后端 perpredict._PD_METHOD_REGISTRY + perchart 白名单同步。
		// 未识别 method 回退到默认 (core_alchabitius)，护住 Alcabitius+Ptolemy 字节级一致。
		if(SUPPORTED_PD_METHODS.indexOf(value) >= 0){
			return value;
		}
		return DEFAULT_PD_METHOD;
	}

	normalizePdTimeKey(value){
		// 🔴 单一来源:primaryDirectionSync.SUPPORTED_PD_TIME_KEYS(此前组件内手写 22 键旧表
		// 与 sync 分叉 → 选 User/NaibodRA/AscendantArc/VanDam 被静默打回 Ptolemy=自定义钥匙死开关)。
		if(SUPPORTED_PD_TIME_KEYS.indexOf(value) >= 0){
			return value;
		}
		return DEFAULT_PD_TIME_KEY;
	}

	normalizePdType(value){
		const num = Number(value);
		if(Number.isNaN(num)){
			return DEFAULT_PD_TYPE;
		}
		return num;
	}

	getSelectedPdMethod(){
		return this.normalizePdMethod(this.state.pdMethodValue);
	}

	getSelectedPdTimeKey(){
		return this.normalizePdTimeKey(this.state.pdTimeKeyValue);
	}

	normalizePdYears(value){
		const n = Math.round(Number(value));
		if(!Number.isFinite(n)){
			return 100;
		}
		return Math.max(1, Math.min(3000, n));
	}

	getSelectedPdYears(){
		return this.normalizePdYears(this.state.pdYearsValue);
	}

	getAppliedPdState(){
		const chart = this.props.value ? this.props.value : {};
		const params = chart && chart.params ? chart.params : {};
		const hasMethod = params.pdMethod !== undefined && params.pdMethod !== null && `${params.pdMethod}` !== '';
		const hasTimeKey = params.pdTimeKey !== undefined && params.pdTimeKey !== null && `${params.pdTimeKey}` !== '';
		const hasPdType = params.pdtype !== undefined && params.pdtype !== null && `${params.pdtype}` !== '';
		const syncRev = params.pdSyncRev ? `${params.pdSyncRev}` : '';
		const hasCompleteParams = hasMethod && hasTimeKey && hasPdType && syncRev === PD_SYNC_REV;
		return {
			hasCompleteParams,
			pdMethod: this.normalizePdMethod(hasMethod ? params.pdMethod : this.props.pdMethod),
			pdTimeKey: this.normalizePdTimeKey(hasTimeKey ? params.pdTimeKey : this.props.pdTimeKey),
			pdtype: this.normalizePdType(hasPdType ? params.pdtype : (this.props.pdType === 1 ? 1 : DEFAULT_PD_TYPE)),
			pdDirect: ((params.pdDirect !== undefined && params.pdDirect !== null ? params.pdDirect : (this.props.pdDirect !== undefined ? this.props.pdDirect : 1)) === 0) ? 0 : 1,
			pdConverse: (params.pdConverse !== undefined && params.pdConverse !== null ? params.pdConverse : this.props.pdConverse) ? 1 : 0,
			pdAntiscia: (params.pdAntiscia !== undefined && params.pdAntiscia !== null ? params.pdAntiscia : this.props.pdAntiscia) ? 1 : 0,
			pdTerms: (params.pdTerms !== undefined && params.pdTerms !== null ? params.pdTerms : this.props.pdTerms) ? 1 : 0,
			pdYears: this.normalizePdYears(params.pdYears !== undefined && params.pdYears !== null ? params.pdYears : this.props.pdYears),
			pdProjection: (SUPPORTED_PD_PROJECTIONS.indexOf(params.pdProjection) >= 0 ? params.pdProjection
				: (SUPPORTED_PD_PROJECTIONS.indexOf(this.props.pdProjection) >= 0 ? this.props.pdProjection : 'ptolemy')),
			pdFrame: (SUPPORTED_PD_FRAMES.indexOf(params.pdFrame) >= 0 ? params.pdFrame
				: (SUPPORTED_PD_FRAMES.indexOf(this.props.pdFrame) >= 0 ? this.props.pdFrame : 'alcabitius')),
			pdFramework: (SUPPORTED_PD_FRAMEWORKS.indexOf(params.pdFramework) >= 0 ? params.pdFramework
				: (SUPPORTED_PD_FRAMEWORKS.indexOf(this.props.pdFramework) >= 0 ? this.props.pdFramework : 'aspect')),
			pdParallel: (params.pdParallel !== undefined && params.pdParallel !== null ? params.pdParallel : this.props.pdParallel) ? 1 : 0,
			pdRaptParallel: (params.pdRaptParallel !== undefined && params.pdRaptParallel !== null ? params.pdRaptParallel : this.props.pdRaptParallel) ? 1 : 0,
			termsVariant: (()=>{ const v = params.termsVariant !== undefined && params.termsVariant !== null ? Number(params.termsVariant) : Number(this.props.termsVariant); return (v === 1 || v === 2) ? v : 0; })(),
			pdSignificators: Array.isArray(params.pdSignificators) ? params.pdSignificators : (Array.isArray(this.props.pdSignificators) ? this.props.pdSignificators : []),
			pdPromissorTypes: Array.isArray(params.pdPromissorTypes) ? params.pdPromissorTypes : (Array.isArray(this.props.pdPromissorTypes) ? this.props.pdPromissorTypes : []),
			pdTimeKeyCustom: (()=>{ const v = Number(params.pdTimeKeyCustom !== undefined && params.pdTimeKeyCustom !== null ? params.pdTimeKeyCustom : this.props.pdTimeKeyCustom); return (Number.isFinite(v) && v > 0) ? v : null; })(),
			syncRev,
		};
	}

	needsPdRecompute(){
		let chart = this.props.value ? this.props.value : {};
		let predictives = chart.predictives ? chart.predictives : {};
		let pds = predictives.primaryDirection ? predictives.primaryDirection : [];
		const appliedPdState = this.getAppliedPdState();
		const selectedPdMethod = this.getSelectedPdMethod();
		const selectedPdTimeKey = this.getSelectedPdTimeKey();
		const appliedPdMethod = appliedPdState.pdMethod;
		const appliedPdTimeKey = appliedPdState.pdTimeKey;
		if(selectedPdMethod !== appliedPdMethod || selectedPdTimeKey !== appliedPdTimeKey){
			return true;
		}
		if(this.getSelectedPdYears() !== appliedPdState.pdYears){
			return true;
		}
		// 方向类型(黄道/世俗)、向运(顺/逆)、映点、界 任一与已落库不同 → 需重算。
		if(this.getSelectedPdType() !== appliedPdState.pdtype){
			return true;
		}
		if(this.getSelectedPdProjection() !== appliedPdState.pdProjection){ return true; }
		if(this.getSelectedPdFrame() !== appliedPdState.pdFrame){ return true; }
		if(this.getSelectedPdFramework() !== appliedPdState.pdFramework){ return true; }
		if(this.getSelectedPdParallel() !== appliedPdState.pdParallel){ return true; }
		if(this.getSelectedPdRaptParallel() !== appliedPdState.pdRaptParallel){ return true; }
		if(this.getSelectedTermsVariant() !== appliedPdState.termsVariant){ return true; }
		// S/P 清单扩展:数组按序列化比对(勾选变化必须触发重算,否则勾了不生效=死开关)
		if(JSON.stringify(this.state.pdSignificatorsValue || []) !== JSON.stringify(appliedPdState.pdSignificators || [])){ return true; }
		if(JSON.stringify(this.state.pdPromissorTypesValue || []) !== JSON.stringify(appliedPdState.pdPromissorTypes || [])){ return true; }
		if((this.getSelectedPdTimeKeyCustom() || null) !== (appliedPdState.pdTimeKeyCustom || null)){ return true; }
		if(this.getSelectedPdDirect() !== appliedPdState.pdDirect){
			return true;
		}
		if(this.getSelectedPdConverse() !== appliedPdState.pdConverse){
			return true;
		}
		if(this.getSelectedPdAntiscia() !== appliedPdState.pdAntiscia){
			return true;
		}
		if(this.getSelectedPdTerms() !== appliedPdState.pdTerms){
			return true;
		}
		if(!appliedPdState.hasCompleteParams){
			return true;
		}
		return !(Array.isArray(pds) && pds.length > 0);
	}


	// [WP-5.2] pd3d 调试透镜:首次 hover 懒拉一次 pd3d(与主限天球同引擎同参),Popover 显示
	// 该行迫星/应星的引擎坐标(λ/β/α/δ 双口径)。失败静默(透镜是调试辅助,不打扰主表)。
	ensureLensPoints(){
		if(this._lensLoading || (this.state && this.state.lensPoints)){ return; }
		const chart = this.props.value || {};
		const p = chart.params || {};
		if(!p.birth && !p.date){ return; }
		const birthParts = `${p.birth || ''}`.trim().split(/\s+/);
		const req = {
			date: (p.date || (birthParts[0] || '').replace(/-/g, '/')),
			time: (p.time || birthParts[1] || '12:00:00'),
			ad: p.ad !== undefined ? p.ad : 1,
			zone: p.zone, lat: p.lat, lon: p.lon, gpsLat: p.gpsLat, gpsLon: p.gpsLon,
			hsys: p.hsys !== undefined ? p.hsys : 0, southchart: p.southchart || 0,
			zodiacal: p.zodiacal || 0, siderealAyanamsa: p.siderealAyanamsa || '',
			tradition: 0, predictive: true, includePrimaryDirection: true,
			showPdBounds: 1,
			pdtype: this.props.pdType || 0,
			pdMethod: this.props.pdMethod || 'core_alchabitius',
			pdTimeKey: this.props.pdTimeKey || 'Ptolemy',
			pdYears: this.props.pdYears || 100,
			pdDirect: 1, pdConverse: 1,
			pdAntiscia: this.props.pdAntiscia || 0, pdTerms: this.props.pdTerms || 0,
			pdaspects: [0, 60, 90, 120, 180],
		};
		this._lensLoading = true;
		fetchPd3D(req).then((res)=>{
			this._lensLoading = false;
			const r = res && (res.Result || res);
			if(r && r.points){ this.setState({ lensPoints: r.points }); }
		}).catch(()=>{ this._lensLoading = false; });
	}
	lensCoordText(id){
		const pts = (this.state && this.state.lensPoints) || null;
		const pt = pts && pts[id];
		if(!pt){ return pts ? '(引擎点表无此 id)' : '坐标载入中…(hover 稍候)'; }
		const f = (v)=>{ const d = Math.floor(Math.abs(v)); const mn = Math.round((Math.abs(v) - d) * 60); return `${v < 0 ? '-' : ''}${d}°${mn < 10 ? '0' : ''}${mn}′`; };
		return `λ=${f(((Number(pt.lon) % 360) + 360) % 360)} β=${f(Number(pt.lat) || 0)} · α=${f(Number(pt.ra))} δ=${f(Number(pt.decl))}${Number.isFinite(Number(pt.raZ)) ? ` · 投影α=${f(Number(pt.raZ))} δ=${f(Number(pt.declZ))}` : ''}`;
	}
	renderLensPopover(text, record){
		return (
			<Popover trigger="hover" mouseEnterDelay={0.35}
				onOpenChange={(open)=>{ if(open){ this.ensureLensPoints(); } }}
				content={
					<div style={{ fontSize: 12, lineHeight: 1.8, maxWidth: 380 }}>
						<div><b>迫星</b> {this.convertText(record.Promittor)}：{this.lensCoordText(record.Promittor)}</div>
						<div><b>应星</b> {this.convertText(record.Significator)}：{this.lensCoordText(record.Significator)}</div>
						<div style={{ opacity: 0.65 }}>引擎坐标与主限天球/表格同源(pd3d);λβ=黄道 αδ=赤道,投影=β取0。</div>
					</div>
				}>
				<span style={{ cursor: 'help' }}>{this.convertText(text)}</span>
			</Popover>
		);
	}

	convertToDataSource(pds){
		let filterKeys = new Set();
		const showPdBounds = !(this.props.showPdBounds === 0 || this.props.showPdBounds === false);
		const appliedPdMethod = this.props.pdMethod ? this.props.pdMethod : 'core_alchabitius';
		// 用户显式勾选「映点 / 界」后,core_alchabitius 也须显示对应行(纯公式核现已支持,
		// 不再像旧核那样恒滤——否则勾了开关却看不到任何变化)。
		const appliedPdState = this.getAppliedPdState();
		const appliedAntiscia = appliedPdState.pdAntiscia === 1;
		const appliedTerms = appliedPdState.pdTerms === 1;
		const hideAntisciaRows = appliedPdMethod === 'core_alchabitius' && !appliedAntiscia;
		const hideUnsupportedCoreRows = appliedPdMethod === 'core_alchabitius';
		if(pds === undefined || pds === null){
			return {
				ds: [],
				filterKeys: filterKeys,
			};
		}
		// showPdBounds(显示界限法)只对 core_alchabitius 旧路径有意义(它恒算界限法、由此开关显隐)。
		// 新方位法的「界(T_)」行只在用户勾选 pdTerms 时才由引擎产出,故应直接显示,不再被 showPdBounds 隐藏
		// (否则用户勾了「界」却因 showPdBounds 关而看不到任何变化——映点同理由 pdAntiscia 控制、非 core 不隐藏)。
		const hideBoundRows = !showPdBounds && appliedPdMethod === 'core_alchabitius' && !appliedTerms;
		let res = [];
		for(let i=0; i<pds.length; i++){
			let pd = pds[i];
			// isCoreUnsupportedRow 把所有「界(T_)」行也判为 unsupported;用户勾选「界」后这些是
			// 合法行,须放行(否则 core_alchabitius 勾了界仍看不到 T_ 行)。
			// 🔴 扩展行放行:core 支持集是「历史默认体」白名单,用户显式勾选的扩展
			// (应星 Syzygy/Spirit/CuspN/恒星/阿点、迫星 HC_/FS_/LT_、平行 PD_/PC_/MP_/RP_)
			// 是引擎新算的合法行,被它误滤=勾了扩展表格恒 656 死不变(用户实锤三连)。
			if(hideUnsupportedCoreRows && this.isCoreUnsupportedRow(pd)
				&& !(appliedTerms && this.isBoundRow(pd))
				&& !this.isExtensionRow(pd, appliedPdState)){
				continue;
			}
			if(hideBoundRows && this.isBoundRow(pd)){
				continue;
			}
			if(hideAntisciaRows && this.isAntisciaRow(pd)){
				continue;
			}

			let data = {
				Seq: i,
				Degree: pd[0],
				Promittor: pd[1],
				Significator: pd[2],
				Cat: pd[3],
				Date: pd[4],
			}
			res.push(data);

			const promBase = this.baseDirectionObjectId(data.Promittor);
			const sigBase = this.baseDirectionObjectId(data.Significator);
			if(promBase){
				filterKeys.add(promBase);
			}
			if(sigBase){
				filterKeys.add(sigBase);
			}
		}
		return {
			ds: res,
			filterKeys: filterKeys
		};
	}

	T(parts){
		let dom = (
			<div>
				{this.planetText(parts[2])}&nbsp;的&nbsp;
				{this.planetText(parts[1])}&nbsp;界
			</div>
		);
		return dom;
	}

	A(parts){
		let dom = (
			<div>
				{this.planetText(parts[1])}&nbsp;的映点
			</div>
		);
		return dom;
	}
	C(parts){
		let dom = (
			<div>
				{this.planetText(parts[1])}&nbsp;的反映点
			</div>
		);
		return dom;
	}

	D(parts){
		// 类型融合:相位 glyph 织进语义文本(单行,「的」后度数前)
		let dom = (
			<div style={{whiteSpace: 'nowrap'}}>
				{this.planetText(parts[1])}&nbsp;的&nbsp;
				<span style={{opacity: 0.85}}>{PD_ASPECT_GLYPHS[Number(parts[2])] || ''}</span>
				<span style={{fontFamily: AstroConst.NormalFont}}>{parts[2]}</span>&nbsp;度右相位处
			</div>
		);
		return dom;
	}
	S(parts){
		let dom = (
			<div style={{whiteSpace: 'nowrap'}}>
				{this.planetText(parts[1])}&nbsp;的&nbsp;
				<span style={{opacity: 0.85}}>{PD_ASPECT_GLYPHS[Number(parts[2])] || ''}</span>
				<span style={{fontFamily: AstroConst.NormalFont}}>{parts[2]}</span>&nbsp;度左相位处
			</div>
		);
		return dom;
	}
	N(parts){
		let dom = (
			<div>
				{this.pdBodyText(parts[1])}&nbsp;
			</div>
		);
		if(parts[2] !== '0'){
			dom = (
				<div style={{whiteSpace: 'nowrap'}}>
					{this.planetText(parts[1])}&nbsp;的&nbsp;
					<span style={{opacity: 0.85}}>{PD_ASPECT_GLYPHS[Number(parts[2])] || ''}</span>
					<span style={{fontFamily: AstroConst.NormalFont}}>{parts[2]}</span>&nbsp;度相位处
				</div>
			); 
		}
		return dom;
	}

	convertText(text){
		let parts = text.split('_');
		let txt = text;
		if(parts[0] === 'T'){
			txt = this.T(parts);
		}else if(parts[0] === 'A'){
			txt = this.A(parts);
		}else if(parts[0] === 'C'){
			txt = this.C(parts);
		}else if(parts[0] === 'D'){
			txt = this.D(parts);
		}else if(parts[0] === 'S'){
			txt = this.S(parts);
		}else if(parts[0] === 'N'){
			txt = this.N(parts);
		}else if(parts[0] === 'PD'){
			txt = this.ParallelPoint(parts, '平行点');
		}else if(parts[0] === 'PC'){
			txt = this.ParallelPoint(parts, '反平行点');
		}else if(parts[0] === 'MP'){
			txt = this.MundaneParallel(parts, '世界平行');
		}else if(parts[0] === 'RP'){
			txt = this.MundaneParallel(parts, '急动平行');
		}else if(parts[0] === 'FS'){
			txt = this.FixedStarPoint(parts);
		}else if(parts[0] === 'LT'){
			txt = this.LotPoint(parts);
		}else if(parts[0] === 'HC'){
			txt = this.CuspPoint(parts);
		}
		return txt;
	}

	// ── 扩展点语义渲染(与既有 D/S/N 同风格;绝不裸 ID) ──
	ParallelPoint(parts, label){
		return (
			<div style={{whiteSpace: 'nowrap'}}>
				{this.planetText(parts[1])}&nbsp;的{label}
			</div>
		);
	}
	MundaneParallel(parts, label){
		const axis = { '0': 'MC', '90': 'ASC', '180': 'IC', '270': 'DSC' }[parts[2]] || parts[2];
		return (
			<div style={{whiteSpace: 'nowrap'}}>
				{this.planetText(parts[1])}&nbsp;的{label}·<span style={{fontFamily: AstroConst.NormalFont}}>{axis}</span>
			</div>
		);
	}
	FixedStarPoint(parts){
		return (
			<div style={{whiteSpace: 'nowrap'}}>
				恒星·<span style={{fontFamily: AstroConst.NormalFont}}>{parts[1]}</span>
			</div>
		);
	}
	LotPoint(parts){
		const name = `${parts[1] || ''}`.replace(/^Pars /, '');
		return (
			<div style={{whiteSpace: 'nowrap'}}>
				<span style={{fontFamily: AstroConst.NormalFont}}>{name}</span>&nbsp;点
			</div>
		);
	}
	CuspPoint(parts){
		const m = /^Cusp(\d+)$/.exec(`${parts[1] || ''}`);
		return (
			<div style={{whiteSpace: 'nowrap'}}>
				第&nbsp;<span style={{fontFamily: AstroConst.NormalFont}}>{m ? m[1] : parts[1]}</span>&nbsp;宫头
			</div>
		);
	}
	// 应星侧扩展 body 语义(N_Syzygy_0/N_Spirit_0/N_CuspN_0/N_<Star|Pars X>_0)
	pdBodyText(name){
		const n = `${name || ''}`;
		if(n === 'Syzygy'){ return <span>产前朔望</span>; }
		if(n === 'Spirit'){ return <span>精神点</span>; }
		const mc = /^Cusp(\d+)$/.exec(n);
		if(mc){ return <span>第 {mc[1]} 宫头</span>; }
		if(/^Pars /.test(n) && n !== 'Pars Fortuna'){ return <span>{n.replace(/^Pars /, '')} 点</span>; }
		return this.planetText(n);
	}

	render(){
		let chart = this.props.value ? this.props.value : {};
		let predictives = chart.predictives ? chart.predictives : {};
		let pds = predictives.primaryDirection ? predictives.primaryDirection : [];
		const appliedPdMethod = this.props.pdMethod ? this.props.pdMethod : 'core_alchabitius';
		const isHorosaLegacy = appliedPdMethod === 'horosa_legacy';
		const viewportWidth = typeof document !== 'undefined' && document.documentElement
			? document.documentElement.clientWidth
			: 1440;
		const compactControls = viewportWidth < 1280;

		let height = this.props.height ? this.props.height : document.documentElement.clientHeight - 50;
		// 工具栏高度:**实测真高**(ResizeObserver 写入 state.toolbarH),窄窗自动换行时表格随之下移。
		// 旧法「强制单行 + 固定 48px + 横向滚动」在 1024px 窗口下把「扩展/列/计算」推到滚动区
		// 600+px 外(marginLeft:auto 叠加溢出)→ 用户看不到也点不到关键按钮(实测实锤)。
		const controlHeight = this.state.toolbarH || 48;
		const controlBottom = 10;
		// 预留账目(实测校准,两个方向都踩过——多了表底空白、少了分页整行被裁不可见):
		// scroll.y 只管表体;容器(overflow hidden)内实际还有 工具栏(48+10mb=58)、表头(size=small ~35px)、
		// 分页行(24px 控件 + margin-top 10 = 34px)。旧值 表头39/分页56(误按 16×2 margin)总超 ~42px →
		// 页底残留 ~40px 空条(此前被「容器偏矮」的页底空白掩盖,测真高填满后暴露)。据实测校准至贴合。
		const tableHeaderReserve = 35;
		const paginationReserve = 34;
		const bottomSafeReserve = 6;
		const tableReserve = controlHeight + controlBottom + tableHeaderReserve + paginationReserve + bottomSafeReserve;
		let tblY = height - tableReserve;
		if(tblY < 200){
			tblY = 200;
		}

		let style = {
			height: height,
			overflow: 'hidden',
			display: 'flex',
			flexDirection: 'column',
		};
		let tableWrapStyle = {
			flex: '1 1 auto',
			minHeight: 0,
		};

		let dsres = this.convertToDataSource(pds);
		let ds = dsres.ds;
		let filterKeys = dsres.filterKeys;
		const appliedPdState = this.getAppliedPdState();
		const appliedPdTimeKey = appliedPdState.pdTimeKey;
		const tableKey = `${chart.chartId ? chart.chartId : 'pd'}:${appliedPdMethod}:${appliedPdTimeKey}:${appliedPdState.pdtype}:${appliedPdState.pdDirect}:${appliedPdState.pdConverse}:${appliedPdState.pdAntiscia}:${appliedPdState.pdTerms}:${this.props.showPdBounds === 0 || this.props.showPdBounds === false ? 0 : 1}:${appliedPdState.pdProjection}:${appliedPdState.pdFrame}:${appliedPdState.pdFramework}:${appliedPdState.pdParallel}:${appliedPdState.pdRaptParallel}:${appliedPdState.termsVariant}:${(appliedPdState.pdSignificators || []).join('.')}:${(appliedPdState.pdPromissorTypes || []).join('.')}:${appliedPdState.pdTimeKeyCustom || ''}:${appliedPdState.syncRev || 'nosync'}`;
		const isPdConfigDirty = (
			this.getSelectedPdMethod() !== appliedPdState.pdMethod
			|| this.getSelectedPdTimeKey() !== appliedPdState.pdTimeKey
			|| this.getSelectedPdYears() !== appliedPdState.pdYears
			|| this.getSelectedPdType() !== appliedPdState.pdtype
			|| this.getSelectedPdDirect() !== appliedPdState.pdDirect
			|| this.getSelectedPdConverse() !== appliedPdState.pdConverse
			|| this.getSelectedPdAntiscia() !== appliedPdState.pdAntiscia
			|| this.getSelectedPdTerms() !== appliedPdState.pdTerms
			|| this.getSelectedPdProjection() !== appliedPdState.pdProjection
			|| this.getSelectedPdFrame() !== appliedPdState.pdFrame
			|| this.getSelectedPdFramework() !== appliedPdState.pdFramework
			|| this.getSelectedPdParallel() !== appliedPdState.pdParallel
			|| this.getSelectedPdRaptParallel() !== appliedPdState.pdRaptParallel
			|| this.getSelectedTermsVariant() !== appliedPdState.termsVariant
			|| !appliedPdState.hasCompleteParams
		);
		const needsPdRecompute = this.needsPdRecompute();
		// 工具栏:横向 flex 条,**空间不足自动换行**(每组 inline-flex 内部仍 nowrap,标签与控件不拆散);
		// 表格高度按实测工具栏真高扣减 → 换行也绝不遮挡表格。窄窗下拉同步收窄。
		const toolbarStyle = {
			border: '1px solid var(--horosa-border, #d9d9d9)',
			borderRadius: 4,
			backgroundColor: 'var(--horosa-panel-bg, #fff)',
			padding: '6px 10px',
			marginBottom: controlBottom,
			flex: '0 0 auto',
			display: 'flex',
			alignItems: 'center',
			flexWrap: 'wrap',
			rowGap: 8,
			gap: compactControls ? 8 : 12,
			whiteSpace: 'nowrap',
		};
		const groupStyle = {
			display: 'inline-flex',
			alignItems: 'center',
			gap: 6,
			flex: '0 0 auto',
		};
		// 勾选组更紧:antd 的 .ant-checkbox-wrapper+.ant-checkbox-wrapper 自带 margin-left:8,
		// 叠加 gap 后每对相邻勾选框间距 14px —— 顶栏最占地方的就是这几组。归零 margin 后
		// 间距只由 gap(5)决定,一行省下约 45px。
		const checkGroupStyle = { ...groupStyle, gap: 5 };
		const checkboxStyle = { marginLeft: 0, flex: '0 0 auto' };
		const labelStyle = {
			whiteSpace: 'nowrap',
			color: 'var(--horosa-text, #333)',
			flex: '0 0 auto',
		};
		// 方位法名称最长,给稍宽;其余收窄到刚好不遮文字。
		const methodSelectStyle = { width: compactControls ? 108 : 124, flex: '0 0 auto', };
		const timeKeySelectStyle = { width: compactControls ? 88 : 96, flex: '0 0 auto', };
		// 方向类型显示英文 In Zodiaco / In Mundo,稍加宽避免截断。
		const typeSelectStyle = { width: compactControls ? 90 : 100, flex: '0 0 auto', };
		const yearsInputStyle = { width: compactControls ? 64 : 72, flex: '0 0 auto', };
		const buttonStyle = {
			minWidth: 84,
			height: 30,
			flex: '0 0 auto',
		};

		// 报表列:核心四列 + 可配置列(类型/顺逆/黄道世界/年龄/钥匙/投影×定局/影响期)。
		const visibleCols = this.state.pdVisibleCols || [];
		const hasCol = (k)=>visibleCols.indexOf(k) >= 0;
		const birthMs = (()=>{
			const b = chart.params && chart.params.birth ? `${chart.params.birth}` : '';
			if(!b){ return null; }
			const d = new Date(b.replace(' ', 'T'));
			return Number.isFinite(d.getTime()) ? d.getTime() : null;   // BC 盘等解析失败 → 年龄列显 —
		})();
		const ageOf = (dateText)=>{
			if(birthMs === null || !dateText){ return '—'; }
			const d = new Date(`${dateText}`.replace(' ', 'T'));
			if(!Number.isFinite(d.getTime())){ return '—'; }
			return ((d.getTime() - birthMs) / (365.25 * 24 * 3600 * 1000)).toFixed(1);
		};
		const orbYears = this.state.pdOrbYears || 0.25;
		const orbRangeOf = (dateText)=>{
			const d = new Date(`${dateText || ''}`.replace(' ', 'T'));
			if(!Number.isFinite(d.getTime())){ return '—'; }
			const ms = orbYears * 365.25 * 24 * 3600 * 1000;
			const fmt = (t)=>{ const x = new Date(t); return `${x.getFullYear()}-${`${x.getMonth() + 1}`.padStart(2, '0')}`; };
			return `${fmt(d.getTime() - ms)} ~ ${fmt(d.getTime() + ms)}`;
		};
		let columns = [{
			title: isHorosaLegacy ? '赤经' : 'Arc',
			dataIndex: 'Degree',
			key: 'Degree',
			width: 88,	// 实测最长「-11度49分」= 69px
			render: (text, record)=>{
				if(isHorosaLegacy){
					let deg = AstroHelper.splitDegree(text);
					return deg[0] + '度' + deg[1] + '分';
				}
				const num = Number(text);
				if(!Number.isNaN(num)){
					const sign = num < 0 ? '-' : '';
					const abs = Math.abs(num);
					let deg = Math.floor(abs);
					let min = Math.round((abs - deg) * 60);
					if(min >= 60){
						deg += 1;
						min = 0;
					}
					return `${sign}${deg}度${min}分`;
				}
				let deg = AstroHelper.splitDegree(text);
				return deg[0] + '度' + deg[1] + '分';
			},
		},{
			title: '迫星',
			dataIndex: 'Promittor',
			key: 'Promittor',
			// 🔴 全表列宽按「实测内容宽 + 内边距 + 表头筛选图标」设定,且**每一列都必须给 width**:
			// antd 在 table-layout:fixed 下按 width 比例分配,这样无论「列」怎么勾选,各列都按自身
			// 内容占比拿到宽度、不会有某列独大。反例(都踩过):①三列曾是 25%+25%+104px —— 日期
			// 装不下「2026-08-08 21:27:27」(实测 146px)要折两行,而迫星/应星各 25% 远超所需;
			// ②给迫星不设 width 让它吃剩余 —— 它独吞到 985px,反把「影响期」挤成两行。
			// 迫星实测最长 219px(形如 D(9th; 5R10R) 的 □90 度右相位处),是全表最长文本列。
			width: 260,
			render: (text, record)=>{
				// 类型语义已织进 convertText 模板(D/S/N glyph 单行);透镜保留
				return this.renderLensPopover(text, record); // [WP-5.2] hover 透镜:迫星/应星引擎坐标
			},
			...this.genStarColFilter('Promittor', filterKeys, true)
		},{
			title: '应星',
			dataIndex: 'Significator',
			key: 'Significator',
			// 实测最长 94px(D(9th; 5R10R)),多数行只是一个 glyph;下限由表头「应星」+ 筛选漏斗定。
			width: 104,
			render: (text, record)=>{
				return this.convertText(text);
			},
			...this.genStarColFilter('Significator', filterKeys)
		},{
			title: '日期',
			dataIndex: 'Date',
			key: 'Date',
			// 实测「2026-08-14 14:01:34」= 146px,+ 筛选图标与内边距;nowrap 兜底不折行。
			width: 184,
			render: (text, record)=>{
				return <span style={{ whiteSpace: 'nowrap' }}>{text}</span>;
			},
			...this.genDateColFilter('Date')
		}];
		// 可配置列插装:类型插迫星前;顺逆/黄道世界插应星后;年龄/钥匙/投影×定局/影响期缀尾。
		// 列序:顺/逆 | Arc | 年龄 | 迫星 | 应星 | 日期 | [影响期] | [极点]
		if(hasCol('age')){
			columns.splice(1, 0, { title: '年龄', key: 'PdAge', width: 60,	// 实测最长「10.6」= 30px
				render: (_t, record)=>ageOf(record.Date) });
		}
		if(hasCol('dc')){
			columns.unshift({ title: '顺/逆', key: 'PdDC', width: 60,	// 内容「顺 D」28px,表头 3 字为准
				render: (_t, record)=>(Number(record.Degree) < 0 ? '逆 C' : '顺 D') });
		}
		const tailCols = [];
		if(hasCol('orb')){
			tailCols.push({ title: `影响期(±${orbYears < 1 ? `${Math.round(orbYears * 12)}月` : `${orbYears}年`})`, key: 'PdOrb', width: 172,	// 实测「2026-05 ~ 2026-11」= 133px,表头更长;给足防折行
				render: (_t, record)=>orbRangeOf(record.Date) });
		}
		if(hasCol('pole')){
			if(!this.state.pdPolesData){ this.requestPdPoles(); }
			const polesMap = this.state.pdPolesData || {};
			tailCols.push({ title: '极点', key: 'PdPole', width: 76,	// 实测最长「-17.76°」= 52px
				render: (_t, record)=>{
					const base = `${record.Significator || ''}`.split('_')[1];
					const v = polesMap[base];
					return (v === undefined || v === null) ? '—' : `${Number(v).toFixed(2)}°`;
				} });
		}
		columns = columns.concat(tailCols);


		
		return (
			<div className={`${styles.scrollbar} horosa-primary-direction-page`} style={style}>
				<div className='horosa-primary-direction-toolbar' style={toolbarStyle} ref={this.bindToolbarRef}>
					<span style={groupStyle}>
						<span style={labelStyle}>流派</span>
						<Select
							size='small'
							style={{ width: compactControls ? 96 : 110, flex: '0 0 auto' }}
							value={this.getSelectedPdPreset()}
							onChange={(v)=>this.handlePdPresetChange(v)}
							dropdownMatchSelectWidth={false}
						>
							{PD_SCHOOL_PRESET_OPTIONS.map((o)=>(
								<Option key={o.value} value={o.value} disabled={o.value === PD_SCHOOL_PRESET_CUSTOM}>{o.label}</Option>
							))}
						</Select>
					</span>
					{/* 正名:旧「方位法」在占星语境常被读成宫制,而它其实只决定弧;
					    宫制另有其维 → 两个标签各自点名作用域(完整解释走 title,不占横向空间)。 */}
					<span style={groupStyle}>
						<span style={labelStyle} title='决定主限弧:表格 Arc 与应期日期随它变;盘面宫头不受影响'>弧算法</span>
						<Select
							size='small'
							style={methodSelectStyle}
							value={this.getSelectedPdProjection()}
							onChange={(v)=>this.handlePdProjectionChange(v)}
							dropdownMatchSelectWidth={false}
						>
							{SUPPORTED_PD_PROJECTIONS.map((v)=>(
								<Option key={v} value={v}>{PD_PROJECTION_LABELS[v] || v}</Option>
							))}
						</Select>
					</span>
					<span style={groupStyle}>
						<span style={labelStyle} title='只决定盘面与天球的宫头位置;主限弧与应期日期不随它变(与弧算法正交)'>盘面宫制</span>
						<Select
							size='small'
							style={{ width: compactControls ? 104 : 118, flex: '0 0 auto' }}
							value={this.getSelectedPdFrame()}
							onChange={(v)=>this.handlePdFrameChange(v)}
							dropdownMatchSelectWidth={false}
						>
							{SUPPORTED_PD_FRAMES.map((v)=>(
								<Option key={v} value={v}>{PD_FRAME_LABELS[v] || v}</Option>
							))}
						</Select>
					</span>
					<span style={groupStyle}>
						<span style={labelStyle}>度数Key</span>
						<Select
							size='small'
							style={timeKeySelectStyle}
							value={this.getSelectedPdTimeKey()}
							onChange={this.handlePdTimeKeyChange}
							dropdownMatchSelectWidth={false}
						>
							<Option value='Ptolemy'>Ptolemy</Option>
							<Option value='Naibod'>Naibod</Option>
							<Option value='TrueSolarArc'>真太阳弧</Option>
							<Option value='SymbolicSolarArc'>太阳弧（黄经）</Option>
							<Option value='Cardano'>Cardano</Option>
							<Option value='Umar'>Umar al-Tabari</Option>
							<Option value='Wollner'>Wöllner</Option>
							<Option value='Plantiko'>Plantiko</Option>
							<Option value='Simmonite'>Simmonite</Option>
							<Option value='SynodicYear'>Synodic Year</Option>
							<Option value='Kepler'>Kepler</Option>
							<Option value='Brahe'>Brahe</Option>
							<Option value='Kundig'>Kündig</Option>
							<Option value='SymbolicDegree'>Symbolic Degree</Option>
							<Option value='SymbolicYear'>Symbolic Year</Option>
							<Option value='SymbolicMoon'>Symbolic Moon</Option>
							<Option value='SymbolicMonth'>Symbolic Month</Option>
							<Option value='Quarterly'>Quarterly</Option>
							<Option value='Quinary'>Quinary</Option>
							<Option value='Duodenary'>Duodenary</Option>
							<Option value='Novenary'>Novenary</Option>
							<Option value='SelfMeasure'>Self-Measure</Option>
							<Option value='NaibodRA'>Naibod-in-RA</Option>
							<Option value='AscendantArc'>Ascendant-arc（界行）</Option>
							<Option value='VanDam'>Van Dam（真弧）</Option>
							<Option value='User'>自定义（每年度数）</Option>
						</Select>
						{this.getSelectedPdTimeKey() === 'User' ? (
							<InputNumber
								size='small'
								min={0.001}
								max={30}
								step={0.01}
								style={{ width: compactControls ? 76 : 86, flex: '0 0 auto' }}
								value={this.getSelectedPdTimeKeyCustom() || 1.0}
								onChange={(v)=>this.handlePdTimeKeyCustomChange(v)}
							/>
						) : null}
					</span>
					<span style={groupStyle}>
						<span style={labelStyle}>方向</span>
						<Select
							size='small'
							style={typeSelectStyle}
							value={this.getSelectedPdType()}
							onChange={this.handlePdTypeChange}
							dropdownMatchSelectWidth={false}
						>
							<Option value={0}>In Zodiaco</Option>
							<Option value={1}>In Mundo</Option>
						</Select>
					</span>
					<span style={checkGroupStyle}>
						<span style={labelStyle}>向运</span>
						<Checkbox
							style={checkboxStyle}
							checked={this.getSelectedPdDirect() === 1}
							onChange={this.handlePdDirectChange}
						>顺</Checkbox>
						<Checkbox
							style={checkboxStyle}
							checked={this.getSelectedPdConverse() === 1}
							onChange={this.handlePdConverseChange}
						>逆</Checkbox>
					</span>
					<span style={groupStyle}>
						<span style={labelStyle}>年数</span>
						<InputNumber
							size='small'
							min={1}
							max={3000}
							step={1}
							precision={0}
							style={yearsInputStyle}
							value={this.getSelectedPdYears()}
							onChange={this.handlePdYearsChange}
						/>
					</span>
					{/* 「附加」四开关(映点/界/平行/急动)已收进「扩展」面板第三组(用户点单:
					    工具栏腾位)——JSX 原样平移进 extraSection 插槽,handlers/禁用逻辑零改。 */}
					{/* 操作区成组:扩展 | 列 | 计算 永远相邻并整体右对齐,换行时不被拆散(旧法各自
					    独立 + 「列」marginLeft:auto → 窄窗换行后「扩展」孤悬左侧、中间大片空白)。 */}
					<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: '0 0 auto', marginLeft: 'auto' }}>
					{/* 面板本体与 3D 天球 pane 共用(PdExtensionPanel)——两处曾各写一份几乎逐字相同
					    的 JSX,改一处必漏另一处(已实测发生过:字号 12 vs 11、金线深浅不一)。
					    这里用 theme 皮肤档:报表区跟随 App 主题,继承通用 popover 色即正确。 */}
					<PdExtensionPanel
						variant='theme'
						significators={this.state.pdSignificatorsValue}
						promissorTypes={this.state.pdPromissorTypesValue}
						onSignificatorsChange={this.handlePdSignificatorsChange}
						onPromissorTypesChange={this.handlePdPromissorTypesChange}
						extraCount={(this.getSelectedPdAntiscia() === 1 ? 1 : 0)
							+ (this.getSelectedPdTerms() === 1 ? 1 : 0)
							+ (this.getSelectedPdParallel() === 1 ? 1 : 0)
							+ (this.getSelectedPdRaptParallel() === 1 ? 1 : 0)}
						extraSection={(
							<>
								{/* 原工具栏「附加」四开关平移(用户点单):handlers/勾选态/禁用逻辑逐字保留,
								    仅排布从工具栏横排改面板竖排(与左侧两组 Group 同款节奏)。 */}
								<Checkbox
									style={{ marginLeft: 0 }}
									checked={this.getSelectedPdAntiscia() === 1}
									onChange={this.handlePdAntisciaChange}
								>映点</Checkbox>
								<Checkbox
									style={{ marginLeft: 0 }}
									checked={this.getSelectedPdTerms() === 1}
									onChange={this.handlePdTermsChange}
								>界</Checkbox>
								{this.getSelectedPdTerms() === 1 ? (
									<Select
										size='small'
										style={{ width: 96 }}
										value={this.getSelectedTermsVariant()}
										onChange={(v)=>this.handleTermsVariantChange(v)}
										dropdownMatchSelectWidth={false}
									>
										<Option value={0}>埃及界</Option>
										<Option value={1}>托勒密界</Option>
										<Option value={2}>莉莉界</Option>
									</Select>
								) : null}
								<Checkbox
									style={{ marginLeft: 0 }}
									checked={this.getSelectedPdParallel() === 1}
									onChange={(e)=>this.handlePdParallelChange(e)}
								>{this.getSelectedPdType() === 1 ? '世界平行' : '平行'}</Checkbox>
								<Checkbox
									style={{ marginLeft: 0 }}
									checked={this.getSelectedPdRaptParallel() === 1}
									disabled={this.getSelectedPdType() !== 1}
									onChange={(e)=>this.handlePdRaptParallelChange(e)}
								>
									<span title={this.getSelectedPdType() !== 1 ? '急动平行是严格世界主限技法：先把「方向」切到 In Mundo' : ''}>急动</span>
								</Checkbox>
							</>
						)}
						buttonStyle={{ ...buttonStyle, minWidth: 56 }}
					/>
					<Popover
						trigger='click'
						placement='bottomRight'
						getPopupContainer={(t)=>t.parentNode}
						content={(
							<div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 172 }}>
								<span style={{ fontSize: 12, fontWeight: 600, paddingBottom: 5, borderBottom: '1px solid rgba(215, 173, 105, 0.3)' }}>显示列</span>
								{PD_OPTIONAL_COLUMNS.map((c)=>(
									<Checkbox
										key={c.key}
										style={{ marginLeft: 0 }}
										checked={(this.state.pdVisibleCols || []).indexOf(c.key) >= 0}
										onChange={(e)=>{
											const cur = (this.state.pdVisibleCols || []).slice();
											const idx = cur.indexOf(c.key);
											if(e.target.checked && idx < 0){ cur.push(c.key); }
											if(!e.target.checked && idx >= 0){ cur.splice(idx, 1); }
											this.setState({ pdVisibleCols: cur });
											safeLocalStorageSet(PD_COLUMNS_STORE_KEY, JSON.stringify(cur));
										}}
									>{c.title}</Checkbox>
								))}
								<span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 5, borderTop: '1px solid rgba(215, 173, 105, 0.22)' }}>
									<span>影响期(年)</span>
									<InputNumber
										size='small'
										min={0.25}
										max={10}
										step={0.25}
										style={{ width: 72 }}
										value={this.state.pdOrbYears || 0.25}
										onChange={(v)=>{
											const n = Number(v);
											const next = (Number.isFinite(n) && n > 0 && n <= 10) ? n : 0.25;
											this.setState({ pdOrbYears: next });
											safeLocalStorageSet(PD_ORB_STORE_KEY, `${next}`);
										}}
									/>
								</span>
							</div>
						)}
					>
						<Button size='small' style={{...buttonStyle, minWidth: 52}}>列</Button>
					</Popover>
					<Button
						type='primary'
						size='small'
						style={buttonStyle}
						onClick={this.handlePdCalculate}
						disabled={!needsPdRecompute}
					>
						{needsPdRecompute ? (isPdConfigDirty ? '重新计算' : '计算') : '已同步'}
					</Button>
					</span>
				</div>
				{appliedPdState.pdFramework === 'bounds' ? (
					<div style={{ flex: '0 0 auto', marginBottom: 6, fontSize: 12, color: 'var(--horosa-text-soft, #8a8f99)' }}>
						界行·分配星框架：应星＝上升 ASC，迫星＝界分界线（斜升差＝上升时间同源口径）。
					</div>
				) : null}
				{appliedPdState.pdFramework === 'release' ? (
					<div style={{ flex: '0 0 auto', marginBottom: 6, fontSize: 12, color: 'var(--horosa-text-soft, #8a8f99)' }}>
						释放框架：应星＝hyleg（五释放位置×昼夜自动选定），迫星＝anareta。释放框架（hyleg-anareta）为古典寿限技术的还原：仅展示定向弧与对应年龄。寿命计算是历史技术，各家规则分歧极大，不应据以预测真实寿命。
					</div>
				) : null}
				<div style={tableWrapStyle}>
					<Table
						className='horosa-primary-direction-table'
						key={tableKey}
						dataSource={ds} columns={columns}
						rowKey='Seq'
						/* 空态分三档:全局 ConfigProvider 的中文「暂无数据」只是兜底,说不出「为什么空、
						   下一步做什么」。三档分别是:还没按当前设置算过 / 算过但该区间真没命中 /
						   算出来了却被工具栏筛选隐藏 —— 每档给一句可执行的下一步。
						   注:本文件只 import { Component },没有 React 在作用域,故不用 <> Fragment
						   (jest 的 classic runtime 会编译成 React.createElement(React.Fragment) 而炸)。 */
						locale={{ emptyText: (
							<div style={{ padding: '30px 14px', textAlign: 'center', lineHeight: 1.9,
								color: 'var(--horosa-text-soft, #8a8f99)', fontSize: 13 }}>
								<div>{pds.length === 0 && needsPdRecompute ? '尚未按当前设置计算'
									: (pds.length === 0 ? '此设置下,该年龄区间没有命中的定向'
										: `已算出 ${pds.length} 条,但都被当前筛选隐藏了`)}</div>
								<div style={{ fontSize: 12, opacity: 0.85 }}>{pds.length === 0 && needsPdRecompute ? '改完设置后,点工具栏右侧的「计算」出表'
									: (pds.length === 0 ? '可加大年龄上限、放宽允星,或换一种弧算法再试'
										: '放宽工具栏的「相位」筛选即可看到')}</div>
							</div>
						) }}
						pagination={{
							pageSize: this.state.pdPageSize,
							showSizeChanger: true,
							pageSizeOptions: PD_PAGE_SIZE_OPTIONS,
							showTotal: (total)=>`共 ${total} 条`,
							// 受控 pageSize 必须接 onChange,否则选择器选完即被重置(用户实告「点了没反应」)。
							onChange: (page, pageSize)=>{
								if(pageSize && pageSize !== this.state.pdPageSize){
									this.setState({ pdPageSize: pageSize });
									try{
										if(typeof window !== 'undefined' && window.localStorage){
											safeLocalStorageSet(PD_PAGE_SIZE_KEY, `${pageSize}`);
										}
									}catch(e){
										// 持久化失败不影响本会话生效
									}
								}
							},
						}}
						bordered size='small'
						/* 🔴 scroll.x 必须是**数值**(列宽总和),不能给 '100%'。
						   病理(窄窗实测):给 '100%' 时 antd 认为无需横向滚动 → 不装「表头↔表体
						   scrollLeft 同步」;而表体自身 CSS overflow-x:auto 照样能滚。结果 1100px 窗口下
						   拖动表体,数据列滚了、**表头不动**(实测 body.scrollLeft=61 而 header.scrollLeft=0),
						   列标题与数据错位;且 .ant-table-header 是 overflow:hidden,最右列表头被裁 54px 看不到。
						   给列宽总和后 antd 才把 table 的 min-width 设成该值并启用同步。列可配置 → 动态求和。 */
						scroll={{ x: columns.reduce((sx, c)=>sx + (Number(c.width) || 0), 0) || '100%', y: tblY }}
						onRow={(record, index)=>{
							let rowstyle = {};
							if(index % 2 === 1){
								rowstyle = {
									style: { backgroundColor: TableOddRowBgColor, },
								};
							}
							return {
								...rowstyle,
							}
						}}
					/>		
				</div>
			</div>
		);
	}
}

export default AstroPrimaryDirection;
