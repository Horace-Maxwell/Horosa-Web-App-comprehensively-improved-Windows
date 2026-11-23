// 七政四余页 · 盘式 / 流时 / 显示 / 引擎 / 七政选项改值与弹窗开关
// 从 GuoLaoChartMain.js 按职责拆出的 GuoLaoChartMain 方法:this 仍是 GuoLaoChartMain 实例,门面里 mixinMethods(GuoLaoChartMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { GUOLAO_CHART_STYLE_MOIRA, GUOLAO_CHART_STYLE_QIZHENG, getStoredGuolaoChartStyle, normalizeGuolaoLifeMode, normalizeGuolaoNodeMode, normalizeGuolaoSu28Mode, setStoredGuolaoChartStyle, setStoredGuolaoLifeMode, setStoredGuolaoNodeMode, setStoredGuolaoSu28Mode, setStoredMoiraTransitGodsVisible, setStoredGuolaoDisplay } from '../GuoLaoChartStyle';
import { recordNewChartSeeds } from '../../../utils/newChartSeeds';
import { sendScopedFields } from '../../../utils/scopedFieldsSink';
import { setStoredGuolaoEngineMode, setStoredKinastroQizhengOptions } from './prefs';
import { isChartObjMatchParams } from './chartCache';
import { fieldsToParams } from './params';

export const inputMethods = {
	// 星盘样式 / 引擎 / 坚七政选项 / 流年神煞显隐 / 显示偏好只归七政主页记忆:择日内嵌实例的改动只作用本页(与起盘口径同一判据)
	persistsGuolaoPrefs(){
		return (this.props.techniqueScope || 'guolao') === 'guolao';
	},

	// 择日内嵌页锁定排盘引擎(另一套引擎的盘与扫描不是同一口径)
	engineLockedByZeri(){
		const e = this.props && this.props.zeriLocked && this.props.zeriLocked.engineMode;
		return !!(e && e.value === 'horosa');
	},

	onChartStyleChange(val){
		if(this.engineLockedByZeri() && val === GUOLAO_CHART_STYLE_QIZHENG){ return; }
		const persist = this.persistsGuolaoPrefs();
		const chartStyle = setStoredGuolaoChartStyle(val, { persist });
		const engineMode = setStoredGuolaoEngineMode(chartStyle === GUOLAO_CHART_STYLE_QIZHENG ? 'kinastro' : 'horosa', { persist });
		const prevEngine = this.state.engineMode;
		this.setState({
			chartStyle,
			engineMode,
			qizhengKinError: '',
		}, ()=>{
			if(engineMode === 'kinastro'){
				this.requestKinastroQizheng();
				return;
			}
			// Moira圆盘 ↔ 天星择日:同一套排盘参数、同一张盘,只是中盘换渲染组件、右栏数据不变。
			// 若引擎未从 kinastro 切回、且已有匹配当前参数的盘数据 → 直接复用,绝不重跑 requestGuolaoBundle 的
			// 多阶段取数(本命→流年→规则),否则每次切样式都把「本命/流年/规则」重算一遍 → 中/右盘多次跳算闪烁。
			// 天星择日双轮所需 electionData 由 componentDidUpdate 的 requestElectionData 单独按需补取(单次 setState)。
			const params = this.genParams();
			const canReuse = prevEngine !== 'kinastro' && this.state.chartObj && params && isChartObjMatchParams(this.state.chartObj, params);
			if(!canReuse){
				this.requestGuolaoBundle(this.state.chartObj || this.props.value);
			}
		});
	},

	onMoiraTransitTimeChange(value){
		const time = value && value.time ? value.time : (value && value.value ? value.value : null);
		if(!time){
			return;
		}
		this.setState({
			moiraTransitTime: time.clone ? time.clone() : time,
		}, ()=>{
			if(!value || value.confirmed !== false){
				this.requestGuolaoBundle(this.state.chartObj || this.props.value);
			}
		});
	},

	// 点击百六大限某岁数格 → 流年跳到该岁对应公历年的 **7月1日 12:00**(用户钦定的取中方式);
	// 复用 onMoiraTransitTimeChange:左栏「Moira流年 时间」随之更新 + 重算流年盘(与手改时间同管道)。
	onLimitAgeClick(year){
		const y = Number(year);
		if(!Number.isFinite(y)){ return; }
		const cur = this.state.moiraTransitTime;
		const next = cur && cur.clone ? cur.clone() : null;
		if(!next || !next.parse){ return; }
		next.parse(`${y}/07/01 12:00:00`, 'YYYY-MM-DD HH:mm:ss');
		this.onMoiraTransitTimeChange({ value: next });
	},

	onMoiraTransitGodsVisibleChange(visible){
		this.setState({
			showMoiraTransitGods: setStoredMoiraTransitGodsVisible(visible, { persist: this.persistsGuolaoPrefs() }),
		});
	},

	onGuolaoDisplayChange(patch){
		const next = setStoredGuolaoDisplay({...this.state.guolaoDisplay, ...(patch || {})}, { persist: this.persistsGuolaoPrefs() });
		this.setState({ guolaoDisplay: next });
	},

	openMoiraQuickDialog(key){
		this.setState({
			moiraQuickDialog: key,
		});
	},

	closeMoiraQuickDialog(){
		this.setState({
			moiraQuickDialog: null,
		});
	},

	// 滑块(XQSlider)回数值;兼容事件对象(原生滑块曾要挂五个事件才跟得上 WebKit,统一件不需要)
	onMoiraStyleLevelChange(event){
		const level = Number(typeof event === 'number' ? event : (event && event.currentTarget ? event.currentTarget.value : null));
		if(!Number.isFinite(level)){
			return;
		}
		this.setState({
			moiraStyleLevel: level,
		});
	},

	onEngineModeChange(value){
		if(this.engineLockedByZeri() && value === 'kinastro'){ return; }
		const persist = this.persistsGuolaoPrefs();
		const engineMode = setStoredGuolaoEngineMode(value, { persist });
		// 内嵌实例按本页现值判(本机记忆可能是主页另一套)
		const storedChartStyle = persist ? getStoredGuolaoChartStyle() : this.state.chartStyle;
		const chartStyle = engineMode === 'kinastro'
			? setStoredGuolaoChartStyle(GUOLAO_CHART_STYLE_QIZHENG, { persist })
			: (storedChartStyle === GUOLAO_CHART_STYLE_QIZHENG ? setStoredGuolaoChartStyle(GUOLAO_CHART_STYLE_MOIRA, { persist }) : storedChartStyle);
		this.setState({
			engineMode,
			chartStyle,
			qizhengKinError: '',
		}, ()=>{
			if(engineMode === 'kinastro'){
				this.requestKinastroQizheng();
			}else if(this.props.fields){
				this.requestChartObj();
			}
		});
	},

	// key 可以是一组键值(同时改几项时用:分两次调,第二次读到的还是旧状态,前一项会被盖掉)
	onKinastroOptionChange(key, value){
		const persist = this.persistsGuolaoPrefs();
		const patch = (key && typeof key === 'object') ? key : { [key]: value };
		const next = setStoredKinastroQizhengOptions({
			...this.state.kinastroOptions,
			...patch,
		}, { persist, base: this.state.kinastroOptions });
		this.setState({
			kinastroOptions: next,
		}, ()=>{
			if(this.state.engineMode === 'kinastro'){
				this.requestKinastroQizheng();
			}
		});
	},

	onQizhengKinTabChange(key){
		this.setState({
			qizhengKinActiveTab: key,
		});
	},

	onFieldsChange(field){
		if(this.props.dispatch && this.props.fields){
			const patch = {
				...(field || {}),
			};
			const hasConfirmedFlag = Object.prototype.hasOwnProperty.call(patch, '__confirmed');
			const confirmed = hasConfirmedFlag ? !!patch.__confirmed : true;
			if(hasConfirmedFlag){
				delete patch.__confirmed;
			}
			// 择日内嵌实例:宿度制 / 命度 / 罗计只改宿主自己的盘 —— 只归一取值,不写七政页的保存值、不记新盘种子
			const mainPage = (this.props.techniqueScope || 'guolao') === 'guolao';
			if(patch.doubingSu28 && Object.prototype.hasOwnProperty.call(patch.doubingSu28, 'value')){
				patch.doubingSu28 = {
					...patch.doubingSu28,
					value: mainPage ? setStoredGuolaoSu28Mode(patch.doubingSu28.value) : normalizeGuolaoSu28Mode(patch.doubingSu28.value),
				};
				// 宿度制与宿盘共写同一键:主页亲手改 = 新命盘缺省(与宿盘同一个「新盘种子」,两页最后一次亲手选的生效)
				if(mainPage){
					recordNewChartSeeds({ doubingSu28: patch.doubingSu28.value });
				}
			}
			if(patch.guolaoLifeMode && Object.prototype.hasOwnProperty.call(patch.guolaoLifeMode, 'value')){
				patch.guolaoLifeMode = {
					...patch.guolaoLifeMode,
					value: mainPage ? setStoredGuolaoLifeMode(patch.guolaoLifeMode.value) : normalizeGuolaoLifeMode(patch.guolaoLifeMode.value),
				};
			}
			if(patch.guolaoNodeMode && Object.prototype.hasOwnProperty.call(patch.guolaoNodeMode, 'value')){
				patch.guolaoNodeMode = {
					...patch.guolaoNodeMode,
					value: mainPage ? setStoredGuolaoNodeMode(patch.guolaoNodeMode.value) : normalizeGuolaoNodeMode(patch.guolaoNodeMode.value),
				};
			}
			// 择日宿主内嵌:改动交给宿主的覆盖层(宿主用新 fields 拉底盘重排),不写主盘
			if(sendScopedFields(this.props, patch, { recompute: confirmed })){
				return;
			}
			let flds = {
				fields: {
					...this.props.fields,
					...patch,
					nohook: false,
				}
			};
			if(!confirmed){
				this.props.dispatch({
					type: 'astro/fetchByFields',
					payload: {
						...flds.fields,
						nohook: true,
						__requestOptions: {
							silent: true,
						},
					},
				});
				if(this.prefetchTimer){
					clearTimeout(this.prefetchTimer);
				}
				this.prefetchTimer = setTimeout(()=>{
					this.prefetchTimer = null;
					if(this.unmounted){
						return;
					}
					this.prefetchChart(fieldsToParams(flds.fields)).catch(()=>{
						return null;
					});
				}, 220);
				return;
			}
			if(this.prefetchTimer){
				clearTimeout(this.prefetchTimer);
				this.prefetchTimer = null;
			}
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: {
					...flds.fields,
					__requestOptions: {
						silent: true,
					},
				},
			});
		}
	},

	onTipClick(tipobj){
		this.setState({
			tips: tipobj,
		});
	},
};
