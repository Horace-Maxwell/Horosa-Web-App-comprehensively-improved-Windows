// 主限法表:类定义在这里;模块级助手与类方法按职责拆在 ./primaryDirection/ 下,
// 方法拆片 settingsState · lens · filters · rowText,类后 mixinMethods 挂回原型。读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { markPanelReady } from '../../utils/perfMark';
import { Component } from 'react';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import { Popover } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroHelper from './AstroHelper';
import {TableOddRowBgColor} from '../../utils/constants'
import styles from '../../css/styles.less';
import { XQButton as Button, XQInputNumber as InputNumber, XQSelect as Select, XQTable as Table, XQCheckbox } from '../xq-ui';
import { PD_SCHOOL_PRESET_OPTIONS, PD_SCHOOL_PRESET_CUSTOM } from './pdSchoolPresets';
import PdExtensionPanel from './PdExtensionPanel';
import { getLayoutViewportHeight, getLayoutViewportWidth } from '../../utils/shellZoom';   // 版面尺寸一律读布局域(壳缩放下 documentElement.client* 恒为物理域)
import { SUPPORTED_PD_PROJECTIONS, SUPPORTED_PD_FRAMES, SUPPORTED_PD_FRAMEWORKS, PD_FRAME_LABELS, SUPPORTED_PD_TIME_KEYS, PD_TIME_KEY_LABELS, normalizePdType as normalizePdTypeValue, pickPdExtraSettings, pdExtraSettingsKey, pdProjectionChoiceOptions, pdProjectionChoiceValue, pdDisplayMethod } from '../../utils/primaryDirectionSync';
import { civilWallMsOfStr, civilDateStrOfMs, yearMonthKey } from '../../utils/dateStrSafe';
import { PD_COLUMNS_STORE_KEY, PD_ORB_STORE_KEY, PD_OPTIONAL_COLUMNS, PD_PAGE_SIZE_KEY, PD_PAGE_SIZE_OPTIONS, readPdVisibleCols, readPdOrbYears, readPdPageSize, arrKey } from './primaryDirection/tableConfig';
import { mixinMethods } from '../../utils/mixinMethods';
import { settingsStateMethods } from './primaryDirection/settingsState';
import { lensMethods } from './primaryDirection/lens';
import { filterMethods } from './primaryDirection/filters';
import { rowTextMethods } from './primaryDirection/rowText';
export { pdPromFilterMatch, directionRowAspectHand } from './primaryDirection/rowLabels';

const Option = Select.Option;

class AstroPrimaryDirection extends Component{

	constructor(props) {
		super(props);

		this.state = {
			searchYear: '',
			pdMethodValue: props.pdMethod ? props.pdMethod : 'core_alchabitius',
			pdTimeKeyValue: props.pdTimeKey ? props.pdTimeKey : 'Ptolemy',
			pdYearsValue: props.pdYears ? props.pdYears : 100,
			// 方向类型(0黄道/1世俗 in mundo)、向运(顺 direct / 逆 converse,可同时选)、映点、界 — 进阶开关。
			pdTypeValue: normalizePdTypeValue(props.pdType),
			// 顺逆默认都开(用户偏好):仅显式 0 才关。
			pdDirectValue: props.pdDirect === 0 ? 0 : 1,
			pdConverseValue: props.pdConverse === 0 ? 0 : 1,
			pdAntisciaValue: props.pdAntiscia ? 1 : 0,
			pdTermsValue: props.pdTerms ? 1 : 0,
			// 解耦九键(左 rail):props 种子,默认=引擎缺省。
			pdProjectionValue: SUPPORTED_PD_PROJECTIONS.indexOf(props.pdProjection) >= 0 ? props.pdProjection : 'ptolemy',
			pdFrameValue: SUPPORTED_PD_FRAMES.indexOf(props.pdFrame) >= 0 ? props.pdFrame : 'alcabitius',
			pdFrameworkValue: SUPPORTED_PD_FRAMEWORKS.indexOf(props.pdFramework) >= 0 ? props.pdFramework : 'aspect',
			pdParallelValue: props.pdParallel ? 1 : 0,
			pdRaptParallelValue: props.pdRaptParallel ? 1 : 0,
			pdTimeKeyCustomValue: (props.pdTimeKeyCustom && Number(props.pdTimeKeyCustom) > 0) ? Number(props.pdTimeKeyCustom) : null,
			pdSignificatorsValue: Array.isArray(props.pdSignificators) ? props.pdSignificators : [],
			pdPromissorTypesValue: Array.isArray(props.pdPromissorTypes) ? props.pdPromissorTypes : [],
			// 设置项登记表(相位侧 / 传统逆向 / 取点四项):全套归一值
			pdExtraValue: pickPdExtraSettings(props.pdExtra),
			termsVariantValue: (()=>{ const n = Number(props.termsVariant); return (Number.isFinite(n) && n >= 0 && n <= 4) ? n : 0; })(),
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
		// 扩展面板的应星 / 迫星勾选以方法引用传给 PdExtensionPanel,不绑定则回调里 this 为空、一勾选就崩
		this.handlePdSignificatorsChange = this.handlePdSignificatorsChange.bind(this);
		this.handlePdPromissorTypesChange = this.handlePdPromissorTypesChange.bind(this);
		this.handlePdExtraSettingChange = this.handlePdExtraSettingChange.bind(this);
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
			&& prevProps.pdTerms === this.props.pdTerms
			&& pdExtraSettingsKey(prevProps.pdExtra) === pdExtraSettingsKey(this.props.pdExtra)
			// 应星 / 迫星扩展与自定义钥匙率同样会在别处改(3D 天球的扩展面板、载入命盘):漏了这三项,
			// 天球那边取消的勾选回到表格页仍是旧勾选,表格还误报「待计算」
			&& arrKey(prevProps.pdSignificators) === arrKey(this.props.pdSignificators)
			&& arrKey(prevProps.pdPromissorTypes) === arrKey(this.props.pdPromissorTypes)
			&& prevProps.pdTimeKeyCustom === this.props.pdTimeKeyCustom){
			return;
		}
		const nextMethod = this.normalizePdMethod(this.props.pdMethod);
		const nextTimeKey = this.normalizePdTimeKey(this.props.pdTimeKey);
		const nextYears = this.normalizePdYears(this.props.pdYears);
		const nextType = normalizePdTypeValue(this.props.pdType);
		const nextDirect = this.props.pdDirect === 0 ? 0 : 1;
		const nextConverse = this.props.pdConverse === 0 ? 0 : 1;
		const nextAntiscia = this.props.pdAntiscia ? 1 : 0;
		const nextTerms = this.props.pdTerms ? 1 : 0;
		const nextProjection = SUPPORTED_PD_PROJECTIONS.indexOf(this.props.pdProjection) >= 0 ? this.props.pdProjection : 'ptolemy';
		const nextFrame = SUPPORTED_PD_FRAMES.indexOf(this.props.pdFrame) >= 0 ? this.props.pdFrame : 'alcabitius';
		const nextFramework = SUPPORTED_PD_FRAMEWORKS.indexOf(this.props.pdFramework) >= 0 ? this.props.pdFramework : 'aspect';
		const nextParallel = this.props.pdParallel ? 1 : 0;
		const nextRapt = this.props.pdRaptParallel ? 1 : 0;
		const nextTermsVariant = (()=>{ const n = Number(this.props.termsVariant); return (Number.isFinite(n) && n >= 0 && n <= 4) ? n : 0; })();
		const nextExtra = pickPdExtraSettings(this.props.pdExtra);
		const nextSignificators = Array.isArray(this.props.pdSignificators) ? this.props.pdSignificators : [];
		const nextPromissorTypes = Array.isArray(this.props.pdPromissorTypes) ? this.props.pdPromissorTypes : [];
		const nextTimeKeyCustom = (this.props.pdTimeKeyCustom && Number(this.props.pdTimeKeyCustom) > 0) ? Number(this.props.pdTimeKeyCustom) : null;
		if(this.state.pdMethodValue !== nextMethod
			|| pdExtraSettingsKey(this.state.pdExtraValue) !== pdExtraSettingsKey(nextExtra)
			|| arrKey(this.state.pdSignificatorsValue) !== arrKey(nextSignificators)
			|| arrKey(this.state.pdPromissorTypesValue) !== arrKey(nextPromissorTypes)
			|| (this.state.pdTimeKeyCustomValue || null) !== nextTimeKeyCustom
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
				pdExtraValue: nextExtra,
				pdSignificatorsValue: nextSignificators,
				pdPromissorTypesValue: nextPromissorTypes,
				pdTimeKeyCustomValue: nextTimeKeyCustom,
			});
		}
	}

	render(){
		let chart = this.props.value ? this.props.value : {};
		let predictives = chart.predictives ? chart.predictives : {};
		let pds = predictives.primaryDirection ? predictives.primaryDirection : [];
		const appliedPdMethod = pdDisplayMethod(this.props.pdMethod, this.getAppliedPdState().pdProjection);
		const isHorosaLegacy = appliedPdMethod === 'horosa_legacy';
		const viewportWidth = typeof document !== 'undefined' && document.documentElement
			? getLayoutViewportWidth()
			: 1440;
		const compactControls = viewportWidth < 1280;

		let height = this.props.height ? this.props.height : getLayoutViewportHeight() - 50;
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
		const tableKey = `${chart.chartId ? chart.chartId : 'pd'}:${appliedPdMethod}:${appliedPdTimeKey}:${appliedPdState.pdtype}:${appliedPdState.pdDirect}:${appliedPdState.pdConverse}:${appliedPdState.pdAntiscia}:${appliedPdState.pdTerms}:${this.props.showPdBounds === 0 || this.props.showPdBounds === false ? 0 : 1}:${appliedPdState.pdProjection}:${appliedPdState.pdFrame}:${appliedPdState.pdFramework}:${appliedPdState.pdParallel}:${appliedPdState.pdRaptParallel}:${appliedPdState.termsVariant}:${(appliedPdState.pdSignificators || []).join('.')}:${(appliedPdState.pdPromissorTypes || []).join('.')}:${appliedPdState.pdTimeKeyCustom || ''}:${pdExtraSettingsKey(appliedPdState.pdExtra)}:${appliedPdState.syncRev || 'nosync'}`;
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
			|| pdExtraSettingsKey(this.state.pdExtraValue) !== pdExtraSettingsKey(appliedPdState.pdExtra)
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
		// 宽度随选中项:受影响的方法带「（改进）/（经典）」后缀,定宽会把后缀截成省略号
		const methodSelectStyle = { width: 'auto', minWidth: compactControls ? 108 : 124, maxWidth: 260, flex: '0 0 auto', };
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
			const w = civilWallMsOfStr(b.trim());   // 民用历墙钟轴(公元前历史纪年、1582 以前儒略历)
			return Number.isFinite(w) ? w : null;   // 解析失败 → 年龄列显 —
		})();
		const ageOf = (dateText)=>{
			if(birthMs === null || !dateText){ return '—'; }
			const w = civilWallMsOfStr(`${dateText}`.trim());
			if(!Number.isFinite(w)){ return '—'; }
			return ((w - birthMs) / (365.25 * 24 * 3600 * 1000)).toFixed(1);
		};
		const orbYears = this.state.pdOrbYears || 0.25;
		const orbRangeOf = (dateText)=>{
			// 民用历墙钟轴上前后各挪 orb 年(1582 以前儒略历、公元前历史纪年),标签取年月
			const w = civilWallMsOfStr(`${dateText || ''}`.trim());
			if(!Number.isFinite(w)){ return '—'; }
			const ms = orbYears * 365.25 * 24 * 3600 * 1000;
			const fmt = (t)=>yearMonthKey(civilDateStrOfMs(t));
			return `${fmt(w - ms)} ~ ${fmt(w + ms)}`;
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
				return this.renderLensPopover(text, record); // hover 透镜:迫星/应星引擎坐标
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
			// 引擎出的应期日期是 **UTC 墙钟**(signasctime 以 Datetime.fromJD(jd, 0) 取);
			// 列头此前不注,东八区用户临近午夜的应期会与本地日期差一天。引擎受金标约束不动,只补标注。
			title: <span title='应期日期为世界时(UTC)墙钟;本地时区换算后可能相差一天'>日期(UTC)</span>,
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
			const shownPoles = this.shownPdPolesData();
			if(!shownPoles){ this.requestPdPoles(); }
			const polesMap = shownPoles || {};
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
						<span style={labelStyle} title='决定主限弧:表格 Arc 与应期日期随它变;盘面宫头不受影响。受几何口径影响的方法各列「（改进）/（经典）」两项'>弧算法</span>
						{/* 值为「弧算法|口径」(受影响的方法)或弧算法本身(其余) */}
						<Select
							size='small'
							style={methodSelectStyle}
							value={pdProjectionChoiceValue(this.pdProjectionChoiceContext(), (this.state.pdExtraValue || {}).pdGeometry)}
							onChange={(v)=>this.handlePdProjectionChoiceChange(v)}
							dropdownMatchSelectWidth={false}
						>
							{pdProjectionChoiceOptions(this.pdProjectionChoiceContext()).map((o)=>(
								<Option key={o.value} value={o.value}>{o.label}</Option>
							))}
						</Select>
					</span>
					<span style={groupStyle}>
						<span style={labelStyle} title='决定盘面与天球的宫头位置;In Zodiaco / Field Plane 下主限弧与应期日期不随它变。In Mundo 选 Ptolemy 弧算法时,它同时决定世俗位置按哪一法分(Alcabitius / Porphyry / Meridian / Equal 等),弧随之变'>盘面宫制</span>
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
							{/* 钥匙全域取 sync 单一真值源(与主限法盘同一份列表与名字) */}
							{SUPPORTED_PD_TIME_KEYS.map((k)=>(
								<Option key={k} value={k}>{PD_TIME_KEY_LABELS[k] || k}</Option>
							))}
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
							<Option value={4}>Field Plane</Option>
						</Select>
					</span>
					<span style={checkGroupStyle}>
						<span style={labelStyle}>向运</span>
						<XQCheckbox
							style={{ ...checkboxStyle, ...(this.pdInertReason('pdDirect') ? { opacity: 0.5 } : null) }}
							checked={this.getSelectedPdDirect() === 1}
							onChange={this.handlePdDirectChange}
						><span title={this.pdInertReason('pdDirect') ? `当前不起作用:${this.pdInertReason('pdDirect')}` : ''}>顺</span></XQCheckbox>
						<XQCheckbox
							style={{ ...checkboxStyle, ...(this.pdInertReason('pdConverse') ? { opacity: 0.5 } : null) }}
							checked={this.getSelectedPdConverse() === 1}
							onChange={this.handlePdConverseChange}
						><span title={this.pdInertReason('pdConverse') ? `当前不起作用:${this.pdInertReason('pdConverse')}` : ''}>逆</span></XQCheckbox>
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
						extraSettings={this.state.pdExtraValue}
						onExtraSettingChange={(k, v)=>this.handlePdExtraSettingChange(k, v)}
						inertContext={this.getPdInertContext()}
						extraCount={(this.getSelectedPdAntiscia() === 1 ? 1 : 0)
							+ (this.getSelectedPdTerms() === 1 ? 1 : 0)
							+ (this.getSelectedPdParallel() === 1 ? 1 : 0)
							+ (this.getSelectedPdRaptParallel() === 1 ? 1 : 0)}
						extraSection={(
							<>
								{/* 原工具栏「附加」四开关平移(用户点单):handlers/勾选态/禁用逻辑逐字保留,
								    仅排布从工具栏横排改面板竖排(与左侧两组 Group 同款节奏)。 */}
								<XQCheckbox
									style={{ marginLeft: 0, ...(this.pdInertReason('pdAntiscia') ? { opacity: 0.5 } : null) }}
									disabled={!!this.pdInertReason('pdAntiscia') && this.getSelectedPdAntiscia() !== 1}
									checked={this.getSelectedPdAntiscia() === 1}
									onChange={this.handlePdAntisciaChange}
								><span title={this.pdInertReason('pdAntiscia') ? `当前不起作用:${this.pdInertReason('pdAntiscia')}` : ''}>映点</span></XQCheckbox>
								<XQCheckbox
									style={{ marginLeft: 0, ...(this.pdInertReason('pdTerms') ? { opacity: 0.5 } : null) }}
									disabled={!!this.pdInertReason('pdTerms') && this.getSelectedPdTerms() !== 1}
									checked={this.getSelectedPdTerms() === 1}
									onChange={this.handlePdTermsChange}
								><span title={this.pdInertReason('pdTerms') ? `当前不起作用:${this.pdInertReason('pdTerms')}` : ''}>界</span></XQCheckbox>
								{this.getSelectedPdTerms() === 1 ? (
									<Select
										size='small'
										style={{ width: 96 }}
										value={this.getSelectedTermsVariant()}
										onChange={(v)=>this.handleTermsVariantChange(v)}
										dropdownMatchSelectWidth={false}
									>
										<Option value={0}>埃及界</Option>
										<Option value={1}>托勒密界·校勘本</Option>
										<Option value={2}>托勒密界·经典传本</Option>
										<Option value={3}>迦勒底界</Option>
										<Option value={4}>自定义</Option>
									</Select>
								) : null}
								<XQCheckbox
									style={{ marginLeft: 0, ...(this.pdInertReason('pdParallel') ? { opacity: 0.5 } : null) }}
									disabled={!!this.pdInertReason('pdParallel') && this.getSelectedPdParallel() !== 1}
									checked={this.getSelectedPdParallel() === 1}
									onChange={(e)=>this.handlePdParallelChange(e)}
								><span title={this.pdInertReason('pdParallel') ? `当前不起作用:${this.pdInertReason('pdParallel')}` : ''}>{this.getSelectedPdType() === 1 ? '世界平行' : '平行'}</span></XQCheckbox>
								<XQCheckbox
									style={{ marginLeft: 0 }}
									checked={this.getSelectedPdRaptParallel() === 1}
									disabled={this.getSelectedPdType() !== 1}
									onChange={(e)=>this.handlePdRaptParallelChange(e)}
								>
									<span title={this.getSelectedPdType() !== 1 ? '急动平行是严格世界主限技法：先把「方向」切到 In Mundo' : ''}>急动</span>
								</XQCheckbox>
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
									<XQCheckbox
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
									>{c.title}</XQCheckbox>
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
									: (pds.length === 0 ? '可加大年龄上限、在工具栏「扩展」里多勾几类应星 / 迫星,或换一种弧算法再试'
										: '点表头「迫星」等列的筛选漏斗,放宽或重置筛选即可看到')}</div>
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
mixinMethods(AstroPrimaryDirection, settingsStateMethods, lensMethods, filterMethods, rowTextMethods);   // 方法按职责拆在 ./primaryDirection/ 下(见各文件头),挂回原型

export default AstroPrimaryDirection;
