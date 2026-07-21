import { Component } from 'react';
import { fetchPd3D } from '../../services/astroPd3d'; // pd3d 调试透镜(hover 显示引擎坐标,零后端改动)
import { safeLocalStorageSet } from '../../utils/safeStorage';
import { Checkbox, Popover } from 'antd';
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

const Option = Select.Option;
// 与 utils/primaryDirectionSync.js 保持一致（P0 曾漏改本地 v8→v9 致始终重算,P1 统一到 v10,主限法改进统一到 v11）。
const PD_SYNC_REV = 'pd_method_sync_v12';
const DEFAULT_PD_METHOD = 'core_alchabitius';
const DEFAULT_PD_TIME_KEY = 'Ptolemy';
const DEFAULT_PD_TYPE = 0;
// 与后端 perpredict._PD_METHOD_REGISTRY + perchart 白名单同步的方位法白名单
// （识别用；下拉仅露已逐位核验的方位法）。
const SUPPORTED_PD_METHODS = [
	'core_alchabitius', 'horosa_legacy',
	'meridian', 'porphyry', 'equal_ecliptic', 'equal_hour_circle',
];
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
			// 分页大小受控+持久化:antd4 在 total>50 时自动显示「X 条/页」选择器,此前 pageSize 写死 50
			// 又无 onChange → 用户改完被立即重置(「点了没反应」)。
			pdPageSize: readPdPageSize(),
		}

		this.searchInput = null;

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

	componentDidUpdate(prevProps){
		// 仅当 props 真正变化时才从 props 同步本地 state（镜像 AstroPrimaryDirectionChart 的口径）。
		// 旧逻辑「state≠normalize(props) 就 setState」会把用户对 度数换算/推运方法 的本地改选（如选 Naibod）
		// 立刻反弹回全局旧值，导致表格上方的选项形同只读。改为 prevProps 守卫后：props 稳定→不同步（本地改选保留），
		// 用户点「计算」经 onPdConfigApply 落全局后 props 才变、再同步。仍比旧 state-diff 守卫更严格，绝不重新引入
		// 「旧存盘 pdMethod 规范化≠原 prop → 无限 setState 白屏」（内层 state-diff 守卫亦保留作双保险）。
		if(prevProps.pdMethod === this.props.pdMethod
			&& prevProps.pdTimeKey === this.props.pdTimeKey
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
		if(this.state.pdMethodValue !== nextMethod
			|| this.state.pdTimeKeyValue !== nextTimeKey
			|| this.state.pdYearsValue !== nextYears
			|| this.state.pdTypeValue !== nextType
			|| this.state.pdDirectValue !== nextDirect
			|| this.state.pdConverseValue !== nextConverse
			|| this.state.pdAntisciaValue !== nextAntiscia
			|| this.state.pdTermsValue !== nextTerms){
			this.setState({
				pdMethodValue: nextMethod,
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

	genStarColFilter(dataIndex, filterKeys){
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

		let res = {
			filters: filters,
			onFilter: (value, record)=>{
				if(record[dataIndex]){
					return record[dataIndex].indexOf(value) >= 0;
				}
				return false;
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
		// 白名单：与后端 STATIC_TIME_KEY_SCALES + 动态 key 同步。未识别 timeKey 回退默认 Ptolemy (scale=1.0)。
		const VALID = [
			'Ptolemy', 'Naibod', 'TrueSolarArc', 'SymbolicSolarArc',
			'Cardano', 'Umar', 'Wollner', 'Plantiko', 'Simmonite', 'SynodicYear',
			'Kepler', 'Brahe', 'Kundig', 'SymbolicDegree', 'SymbolicYear', 'SymbolicMoon',
			'SymbolicMonth', 'Quarterly', 'Quinary', 'Duodenary', 'Novenary', 'SelfMeasure',
		];
		if(VALID.indexOf(value) >= 0){
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
			if(hideUnsupportedCoreRows && this.isCoreUnsupportedRow(pd) && !(appliedTerms && this.isBoundRow(pd))){
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
		let dom = (
			<div>
				{this.planetText(parts[1])}&nbsp;的&nbsp;
				<span style={{fontFamily: AstroConst.NormalFont}}>{parts[2]}</span>&nbsp;度右相位处
			</div>
		);
		return dom;
	}
	S(parts){
		let dom = (
			<div>
				{this.planetText(parts[1])}&nbsp;的&nbsp;
				<span style={{fontFamily: AstroConst.NormalFont}}>{parts[2]}</span>&nbsp;度左相位处
			</div>
		);
		return dom;
	}
	N(parts){
		let dom = (
			<div>
				{this.planetText(parts[1])}&nbsp;
			</div>
		);
		if(parts[2] !== '0'){
			dom = (
				<div>
					{this.planetText(parts[1])}&nbsp;的&nbsp;
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
		}
		return txt;
	}

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
		// 顶部工具栏强制单行(无第二行,否则会遮挡表格),空间不够时下拉收窄 + 横向滚动兜底;实测约 48px。
		const controlHeight = 48;
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
		const tableKey = `${chart.chartId ? chart.chartId : 'pd'}:${appliedPdMethod}:${appliedPdTimeKey}:${appliedPdState.pdtype}:${appliedPdState.pdDirect}:${appliedPdState.pdConverse}:${appliedPdState.pdAntiscia}:${appliedPdState.pdTerms}:${this.props.showPdBounds === 0 || this.props.showPdBounds === false ? 0 : 1}:${appliedPdState.syncRev || 'nosync'}`;
		const isPdConfigDirty = (
			this.getSelectedPdMethod() !== appliedPdState.pdMethod
			|| this.getSelectedPdTimeKey() !== appliedPdState.pdTimeKey
			|| this.getSelectedPdYears() !== appliedPdState.pdYears
			|| this.getSelectedPdType() !== appliedPdState.pdtype
			|| this.getSelectedPdDirect() !== appliedPdState.pdDirect
			|| this.getSelectedPdConverse() !== appliedPdState.pdConverse
			|| this.getSelectedPdAntiscia() !== appliedPdState.pdAntiscia
			|| this.getSelectedPdTerms() !== appliedPdState.pdTerms
			|| !appliedPdState.hasCompleteParams
		);
		const needsPdRecompute = this.needsPdRecompute();
		// 单行工具栏:一个横向 flex 条,nowrap + 横向滚动兜底(绝不换行遮挡表格)。
		// 空间不够时各下拉自动收窄(width 固定值),不遮挡文字。
		const toolbarStyle = {
			border: '1px solid var(--horosa-border, #d9d9d9)',
			borderRadius: 4,
			backgroundColor: 'var(--horosa-panel-bg, #fff)',
			padding: '6px 10px',
			marginBottom: controlBottom,
			flex: '0 0 auto',
			display: 'flex',
			alignItems: 'center',
			flexWrap: 'nowrap',
			gap: compactControls ? 8 : 12,
			overflowX: 'auto',
			whiteSpace: 'nowrap',
		};
		const groupStyle = {
			display: 'inline-flex',
			alignItems: 'center',
			gap: 6,
			flex: '0 0 auto',
		};
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

		let columns = [{
			title: isHorosaLegacy ? '赤经' : 'Arc',
			dataIndex: 'Degree',
			key: 'Degree',
			width: '25%',
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
			width: '25%',
			render: (text, record)=>{
				return this.renderLensPopover(text, record); // hover 透镜:迫星/应星引擎坐标
			},
			...this.genStarColFilter('Promittor', filterKeys)
		},{
			title: '应星',
			dataIndex: 'Significator',
			key: 'Significator',
			width: '25%',
			render: (text, record)=>{
				return this.convertText(text);
			},
			...this.genStarColFilter('Significator', filterKeys)
		},{
			title: '日期',
			dataIndex: 'Date',
			key: 'Date',
			width: '25%',
			render: (text, record)=>{
				return text;
			},
			...this.genDateColFilter('Date')
		}];


		
		return (
			<div className={`${styles.scrollbar} horosa-primary-direction-page`} style={style}>
				<div className='horosa-primary-direction-toolbar' style={toolbarStyle}>
					<span style={groupStyle}>
						<span style={labelStyle}>方法</span>
						<Select
							size='small'
							style={methodSelectStyle}
							value={this.getSelectedPdMethod()}
							onChange={this.handlePdMethodChange}
							dropdownMatchSelectWidth={false}
						>
							<Option value='core_alchabitius'>Alchabitius</Option>
							<Option value='meridian'>Meridian</Option>
							<Option value='porphyry'>Porphyry</Option>
							<Option value='equal_ecliptic'>Equal（黄道）</Option>
							<Option value='equal_hour_circle'>Equal（时圈）</Option>
						</Select>
					</span>
					<span style={groupStyle}>
						<span style={labelStyle}>度数</span>
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
						</Select>
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
					<span style={groupStyle}>
						<span style={labelStyle}>向运</span>
						<Checkbox
							checked={this.getSelectedPdDirect() === 1}
							onChange={this.handlePdDirectChange}
						>顺</Checkbox>
						<Checkbox
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
					<span style={groupStyle}>
						<span style={labelStyle}>附加</span>
						<Checkbox
							checked={this.getSelectedPdAntiscia() === 1}
							onChange={this.handlePdAntisciaChange}
						>映点</Checkbox>
						<Checkbox
							checked={this.getSelectedPdTerms() === 1}
							onChange={this.handlePdTermsChange}
						>界</Checkbox>
					</span>
					<Button
						type='primary'
						size='small'
						style={{...buttonStyle, marginLeft: 'auto'}}
						onClick={this.handlePdCalculate}
						disabled={!needsPdRecompute}
					>
						{needsPdRecompute ? (isPdConfigDirty ? '重新计算' : '计算') : '已同步'}
					</Button>
				</div>
				<div style={tableWrapStyle}>
					<Table
						className='horosa-primary-direction-table'
						key={tableKey}
						dataSource={ds} columns={columns} 
						rowKey='Seq'  
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
						scroll={{x: '100%', y: tblY }}
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
