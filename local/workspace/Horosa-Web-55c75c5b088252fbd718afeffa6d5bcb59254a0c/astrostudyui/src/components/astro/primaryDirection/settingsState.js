// 主限法表 · 工具条参数:各项改值、当前选值读取与规范化、预设、投影选择、失效原因、已应用参数与是否重算、起算
// 从 AstroPrimaryDirection.js 按职责拆出的 AstroPrimaryDirection 方法:this 仍是 AstroPrimaryDirection 实例,门面里 mixinMethods(AstroPrimaryDirection, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { PD_SCHOOL_PRESETS, pdPresetOf } from '../pdSchoolPresets';
import { SUPPORTED_PD_METHODS, SUPPORTED_PD_PROJECTIONS, SUPPORTED_PD_FRAMES, SUPPORTED_PD_FRAMEWORKS, SUPPORTED_PD_TIME_KEYS, PD_SYNC_REV, normalizePdType as normalizePdTypeValue, pickPdExtraSettings, pdExtraSettingsKey, parsePdProjectionChoice, pdSettingInertReason } from '../../../utils/primaryDirectionSync';
import { createDeferredResizeObserver } from '../../../utils/deferredResizeObserver';
import { DEFAULT_PD_METHOD, DEFAULT_PD_TIME_KEY } from './tableConfig';

export const settingsStateMethods = {
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
			// 布局域读数(offsetHeight);rect.height 在标准化 zoom 引擎下已×z,拿它抵扣布局高会错 z 倍。
			const h = Math.round(this.toolbarRef.offsetHeight || 0);
			if(h > 0 && Math.abs(h - (this.state.toolbarH || 0)) > 1){
				this.setState({ toolbarH: h });
			}
		};
		this._toolbarRO = createDeferredResizeObserver(sync);
		this._toolbarRO.observe(el);
		sync();
	},

	handlePdMethodChange(value){
		this.setState({
			pdMethodValue: value,
		});
	},

	handlePdTimeKeyChange(value){
		this.setState({
			pdTimeKeyValue: value,
		});
	},

	handlePdYearsChange(value){
		this.setState({
			pdYearsValue: this.normalizePdYears(value),
		});
	},

	_checkboxChecked(e){
		return e && e.target ? !!e.target.checked : !!e;
	},

	handlePdTypeChange(value){
		this.setState({ pdTypeValue: normalizePdTypeValue(value), });
	},

	handlePdDirectChange(e){
		const checked = this._checkboxChecked(e);
		// 顺向/逆向至少保留其一,避免「两者皆关」的空向运态。
		if(!checked && this.getSelectedPdConverse() !== 1){
			return;
		}
		this.setState({ pdDirectValue: checked ? 1 : 0, });
	},

	handlePdConverseChange(e){
		const checked = this._checkboxChecked(e);
		if(!checked && this.getSelectedPdDirect() !== 1){
			return;
		}
		this.setState({ pdConverseValue: checked ? 1 : 0, });
	},

	handlePdAntisciaChange(e){
		this.setState({ pdAntisciaValue: this._checkboxChecked(e) ? 1 : 0, });
	},

	handlePdTermsChange(e){
		this.setState({ pdTermsValue: this._checkboxChecked(e) ? 1 : 0, });
	},

	getSelectedPdType(){
		return normalizePdTypeValue(this.state.pdTypeValue);
	},

	getSelectedPdDirect(){
		return this.state.pdDirectValue === 0 ? 0 : 1;
	},

	getSelectedPdConverse(){
		return this.state.pdConverseValue === 1 ? 1 : 0;
	},

	getSelectedPdAntiscia(){
		return this.state.pdAntisciaValue === 1 ? 1 : 0;
	},

	getSelectedPdTerms(){
		return this.state.pdTermsValue === 1 ? 1 : 0;
	},

	getSelectedPdProjection(){
		return SUPPORTED_PD_PROJECTIONS.indexOf(this.state.pdProjectionValue) >= 0 ? this.state.pdProjectionValue : 'ptolemy';
	},

	getSelectedPdFrame(){
		return SUPPORTED_PD_FRAMES.indexOf(this.state.pdFrameValue) >= 0 ? this.state.pdFrameValue : 'alcabitius';
	},

	getSelectedPdFramework(){
		return SUPPORTED_PD_FRAMEWORKS.indexOf(this.state.pdFrameworkValue) >= 0 ? this.state.pdFrameworkValue : 'aspect';
	},

	getSelectedPdParallel(){
		return this.state.pdParallelValue === 1 ? 1 : 0;
	},

	getSelectedPdRaptParallel(){
		// 自洽性:急动平行必须世界主限;pdtype=0 时强制视为关(控件同时置灰)。
		if(this.getSelectedPdType() !== 1){
			return 0;
		}
		return this.state.pdRaptParallelValue === 1 ? 1 : 0;
	},

	getSelectedTermsVariant(){
		const v = this.state.termsVariantValue;
		return (Number.isFinite(Number(v)) && v >= 0 && v <= 4) ? Number(v) : 0;
	},

	getSelectedPdTimeKeyCustom(){
		const v = Number(this.state.pdTimeKeyCustomValue);
		return (Number.isFinite(v) && v > 0) ? v : null;
	},

	// 当前九维的 preset 反查(受控显示;单项被改 → 'custom')。相位点黄纬住在扩展设置里。
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
			pdPromAspectLat: (this.state.pdExtraValue || {}).pdPromAspectLat,
		});
	},

	// 选档 = 一次性写多维(custom 不可主动选,忽略)。
	handlePdPresetChange(preset){
		const p = PD_SCHOOL_PRESETS[preset];
		if(!p){
			return;
		}
		this.setState((st)=>({
			pdProjectionValue: p.pdProjection,
			pdFrameValue: p.pdFrame,
			pdTypeValue: p.pdtype,
			pdDirectValue: p.pdDirect,
			pdConverseValue: p.pdConverse,
			pdTimeKeyValue: p.pdTimeKey,
			pdFrameworkValue: p.pdFramework,
			pdParallelValue: p.pdParallel,
			pdExtraValue: pickPdExtraSettings({ ...(st.pdExtraValue || {}), pdPromAspectLat: p.pdPromAspectLat || 0 }),
		}));
	},

	handlePdProjectionChange(value){
		this.setState({ pdProjectionValue: SUPPORTED_PD_PROJECTIONS.indexOf(value) >= 0 ? value : 'ptolemy' });
	},

	// 「弧算法」下拉的上下文:哪些方法列「改进 / 经典」两项由盘类、宫制、平行决定(见 PD_GEOMETRY_APPLIES)
	pdProjectionChoiceContext(){
		return {
			pdtype: this.getSelectedPdType(),
			pdProjection: this.getSelectedPdProjection(),
			pdFrame: this.getSelectedPdFrame(),
			pdParallel: this.getSelectedPdParallel(),
		};
	},

	// 选中项同时定弧算法与几何口径(只列一项的方法口径回缺省)
	handlePdProjectionChoiceChange(value){
		const { pdProjection, pdGeometry } = parsePdProjectionChoice(value);
		this.setState((st)=>({
			pdProjectionValue: pdProjection,
			pdExtraValue: pickPdExtraSettings({ ...(st.pdExtraValue || {}), pdGeometry }),
		}));
	},

	handlePdFrameChange(value){
		this.setState({ pdFrameValue: SUPPORTED_PD_FRAMES.indexOf(value) >= 0 ? value : 'alcabitius' });
	},

	handlePdFrameworkChange(value){
		this.setState({ pdFrameworkValue: SUPPORTED_PD_FRAMEWORKS.indexOf(value) >= 0 ? value : 'aspect' });
	},

	handlePdParallelChange(e){
		this.setState({ pdParallelValue: e.target.checked ? 1 : 0 });
	},

	handlePdRaptParallelChange(e){
		this.setState({ pdRaptParallelValue: e.target.checked ? 1 : 0 });
	},

	handleTermsVariantChange(value){
		this.setState({ termsVariantValue: (Number.isFinite(Number(value)) && value >= 0 && value <= 4) ? Number(value) : 0 });
	},

	handlePdTimeKeyCustomChange(value){
		const v = Number(value);
		this.setState({ pdTimeKeyCustomValue: (Number.isFinite(v) && v > 0) ? v : null });
	},

	handlePdSignificatorsChange(vals){
		this.setState({ pdSignificatorsValue: Array.isArray(vals) ? vals : [] });
	},

	handlePdPromissorTypesChange(vals){
		this.setState({ pdPromissorTypesValue: Array.isArray(vals) ? vals : [] });
	},

	handlePdExtraSettingChange(key, value){
		this.setState((st)=>({ pdExtraValue: pickPdExtraSettings({ ...(st.pdExtraValue || {}), [key]: value }) }));
	},

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
					extra: this.state.pdExtraValue,
				}
			);
		}
	},

	normalizePdMethod(value){
		// 白名单：与后端 perpredict._PD_METHOD_REGISTRY + perchart 白名单同步。
		// 未识别 method 回退到默认 (core_alchabitius)，护住 Alcabitius+Ptolemy 字节级一致。
		if(SUPPORTED_PD_METHODS.indexOf(value) >= 0){
			return value;
		}
		return DEFAULT_PD_METHOD;
	},

	normalizePdTimeKey(value){
		// 🔴 单一来源:primaryDirectionSync.SUPPORTED_PD_TIME_KEYS(此前组件内手写 22 键旧表
		// 与 sync 分叉 → 选 User/NaibodRA/AscendantArc/VanDam 被静默打回 Ptolemy=自定义钥匙死开关)。
		if(SUPPORTED_PD_TIME_KEYS.indexOf(value) >= 0){
			return value;
		}
		return DEFAULT_PD_TIME_KEY;
	},

	normalizePdType(value){
		return normalizePdTypeValue(value);
	},

	getSelectedPdMethod(){
		return this.normalizePdMethod(this.state.pdMethodValue);
	},

	getSelectedPdTimeKey(){
		return this.normalizePdTimeKey(this.state.pdTimeKeyValue);
	},

	// 当前选择下不起作用的设置置灰 + 说明(规则单源 pdSettingInertReason;扩展面板与工具条共用这份上下文)
	getPdInertContext(){
		return {
			pdtype: this.getSelectedPdType(),
			projection: this.getSelectedPdProjection(),
			geometry: (this.state.pdExtraValue || {}).pdGeometry,
			timeKey: this.getSelectedPdTimeKey(),
			values: this.state.pdExtraValue,
		};
	},

	pdInertReason(key){
		return pdSettingInertReason(key, this.getPdInertContext());
	},

	normalizePdYears(value){
		const n = Math.round(Number(value));
		if(!Number.isFinite(n)){
			return 100;
		}
		return Math.max(1, Math.min(3000, n));
	},

	getSelectedPdYears(){
		return this.normalizePdYears(this.state.pdYearsValue);
	},

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
			pdtype: this.normalizePdType(hasPdType ? params.pdtype : normalizePdTypeValue(this.props.pdType)),
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
			termsVariant: (()=>{ const v = params.termsVariant !== undefined && params.termsVariant !== null ? Number(params.termsVariant) : Number(this.props.termsVariant); return (Number.isFinite(v) && v >= 0 && v <= 4) ? v : 0; })(),   // [R2-12](v 已 Number)
			pdSignificators: Array.isArray(params.pdSignificators) ? params.pdSignificators : (Array.isArray(this.props.pdSignificators) ? this.props.pdSignificators : []),
			pdPromissorTypes: Array.isArray(params.pdPromissorTypes) ? params.pdPromissorTypes : (Array.isArray(this.props.pdPromissorTypes) ? this.props.pdPromissorTypes : []),
			pdTimeKeyCustom: (()=>{ const v = Number(params.pdTimeKeyCustom !== undefined && params.pdTimeKeyCustom !== null ? params.pdTimeKeyCustom : this.props.pdTimeKeyCustom); return (Number.isFinite(v) && v > 0) ? v : null; })(),
			pdExtra: pickPdExtraSettings(params, this.props.pdExtra),
			syncRev,
		};
	},

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
		if(pdExtraSettingsKey(this.state.pdExtraValue) !== pdExtraSettingsKey(appliedPdState.pdExtra)){ return true; }
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
	},
};
