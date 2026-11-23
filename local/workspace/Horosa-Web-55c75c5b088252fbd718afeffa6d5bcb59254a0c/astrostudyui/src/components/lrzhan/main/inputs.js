// 六壬页 · 时间 / 盘式 / 本命 / 五行 / 贵人 / 起课法改值与起课入口
// 从 LiuRengMain.js 按职责拆出的 LiuRengMain 方法:this 仍是 LiuRengMain 实例,门面里 mixinMethods(LiuRengMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { lockDayBoundary } from '../../../utils/dayBoundaryLock';
import DateTime from '../../comp/DateTime';
import { clearModuleAISnapshot } from '../../../utils/moduleAiSnapshot';
import { castSourceKey, castChartFor, castFailureKeeps } from '../../../utils/derivedChartSource';
import { sendScopedFields } from '../../../utils/scopedFieldsSink';
import { LIURENG_PAGE_SETTINGS } from './castLayout';

export const inputMethods = {
	onFieldsChange(field){
		const patch = {
			...(field || {}),
		};
		const hasConfirmedFlag = Object.prototype.hasOwnProperty.call(patch, '__confirmed');
		const confirmed = hasConfirmedFlag ? !!patch.__confirmed : true;
		if(hasConfirmedFlag && !confirmed){
			delete patch.__confirmed;
			this.pendingFields = {
				...(this.props.fields || {}),
				...patch,
			};
			return;
		}
		if(hasConfirmedFlag){
			delete patch.__confirmed;
		}
		this.pendingFields = null;
		// 用户拍板: 左栏改过 after23NewDay/guaAfter23NewDay 后,全局事件不再覆盖。(择日内嵌实例只记本实例,不动主页的标志)
		if(field && (Object.prototype.hasOwnProperty.call(field, 'after23NewDay') || Object.prototype.hasOwnProperty.call(field, 'guaAfter23NewDay'))){
			lockDayBoundary(this, 'after23');
			if(this.props.dispatch && !this.props.techniqueScope){
				this.props.dispatch({ type: 'astro/setAfter23BoundaryUserOverrode', payload: { value: true } });
			}
		}
		// v2.2.1: 左栏改过 lateZiHourUseNextDay 后,全局事件不再覆盖。
		if(field && Object.prototype.hasOwnProperty.call(field, 'lateZiHourUseNextDay')){
			lockDayBoundary(this, 'lateZi');
			if(this.props.dispatch && !this.props.techniqueScope){
				this.props.dispatch({ type: 'astro/setLateZiHourUserOverrode', payload: { value: true } });
			}
		}
		// 择日宿主内嵌:改动交给宿主的覆盖层(宿主用新 fields 拉底盘重排),不写主盘
		const scoped = sendScopedFields(this.props, patch);
		if(!scoped && this.props.dispatch && this.props.fields){
			let flds = {
				fields: {
					...this.props.fields,
					...patch,
				}
			};
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: {
					...flds.fields,
					__requestOptions: {
						silent: true,
					},
					nohook: !confirmed,
				},
			});
		}
		// 即时重算: after23NewDay/guaAfter23NewDay 改变时立即重新起课(不依赖用户手动点起课)
		if(field && (Object.prototype.hasOwnProperty.call(field, 'after23NewDay') || Object.prototype.hasOwnProperty.call(field, 'guaAfter23NewDay'))){
			const updatedFields = { ...(this.props.fields || {}), ...patch };
			this.requestGods(updatedFields);
		}
	},

	onChartTypeChange(value){
		this.setState({
			chartType: value,
		});
	},

	onBirthChange(field){
		const patch = {
			...(field || {}),
		};
		if(Object.prototype.hasOwnProperty.call(patch, '__confirmed')){
			delete patch.__confirmed;
		}
		const flds = {
			...this.state.birth,
			...patch,
		};
		this.setState({
			birth: flds,
			// 出生档变更即作废旧行年:不清则改卜卦人信息后、后端行年归来前,旧档行年
			// 滞留 state——resolveDisplayRunYear 的 ±1 岁容差(立春界/岁首口径正常差)会放行改生年
			// ±1 场景的旧值。清空 → 本地年差法全量接管,起课/快照/render 三路即刻一致。
			runyear: null,
		});
	},

	startPaiPanByFields(fields, chartObj){
		const calcFields = fields || this.props.fields;
		// 底盘只认与本次起课同一时刻地点的那张(castChartFor):对不上就是上一刻的底盘(主盘在途 / 取失败),不拿它起这一课
		const chartWrap = castChartFor(chartObj === undefined || chartObj === null ? this.props.value : chartObj, calcFields);
		const calcChart = chartWrap && chartWrap.chart ? chartWrap.chart : null;
		if(!calcFields || !calcChart){
			return;
		}
		// 底盘、起课时刻与课在 requestGods 回包时同一次落定:在途期间屏上仍是上一课的整套,不拼出「新底盘配上一课的课」
		this.requestGods(calcFields, calcChart);
	},

	// 底盘取失败(宿主取不到这一刻的 /chart):与屏上那一课同一起课时刻地点 → 留存;换了时刻 / 地点 → 清掉课与底盘
	// (盘区留空,连同本页 AI 快照槽),在途的起课 / 行年作废 —— 与起课取失败同一口径
	settleCastChartFailure(fields){
		if(!fields || castFailureKeeps(castSourceKey(this.state.calcFields), castSourceKey(fields))){ return; }
		this._godsReqSeq = (this._godsReqSeq || 0) + 1;
		this._runYearReqSeq = (this._runYearReqSeq || 0) + 1;
		this.setState({ liureng: null, runyear: null, calcFields: fields, calcChart: null });
		clearModuleAISnapshot(this.props.techniqueScope || 'liureng');
	},

	// 这一课的底盘:调用方给的(已核过同一时刻)> 屏上那一课的(同一课只改设置)> 主盘(同一时刻才认);都没有 → null
	lessonChartFor(fields, castChart){
		if(castChart){ return castChart; }
		const key = castSourceKey(fields);
		if(key && key === castSourceKey(this.state.calcFields) && this.state.calcChart){ return this.state.calcChart; }
		const wrap = castChartFor(this.props.value, fields);
		return wrap && wrap.chart ? wrap.chart : null;
	},

	// 时间算法 ≠ 真太阳时:起课(天地盘 / 四课 / 三传 / 贵人 / 起课法加临 / 分昼夜 / 十二盘式)与盘头四柱同一时刻。
	// /chart 的农历恒按真太阳时,/liureng/gods 的农历随所选时间算法 —— 此前只有盘头四柱换了口径,选「直接时间」后
	// 盘头写午时、天盘却按巳时转。与三式合一 chartForLr、AI 无头重算同做法(gods 农历覆盖盘的农历)。
	// 两份农历不是同一时刻(改时间后两个请求先后回来)时不合并;按 (chart, gods 农历, 时间算法) 记忆化保持引用稳定
	// (起课缓存与盘面重画判据靠引用)。
	lrChartFor(chart){
		const ta = this.state.timeAlg;
		const ln = this.state.liureng && this.state.liureng.nongli ? this.state.liureng.nongli : null;
		if(!chart || !ta || !ln || !chart.nongli){ return chart; }
		const a = chart.nongli.clockTime;
		const b = ln.clockTime;
		if(a && b && `${a}`.slice(0, 16) !== `${b}`.slice(0, 16)){ return chart; }
		const m = this._lrChartMemo;
		if(m && m.chart === chart && m.ln === ln && m.ta === ta){ return m.out; }
		const out = { ...chart, nongli: { ...chart.nongli, ...ln } };
		this._lrChartMemo = { chart, ln, ta, out };
		return out;
	},

	getTimeFieldsFromSelector(baseFields){
		if(!this.timeHook || typeof this.timeHook.getValue !== 'function'){
			return null;
		}
		const draft = this.timeHook.getValue();
		if(!draft || !draft.value || !(draft.value instanceof DateTime)){
			return null;
		}
		const dt = draft.value;
		return {
			...(baseFields || this.pendingFields || this.props.fields || {}),
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		};
	},

	clickStartPaiPan(){
		// 草稿优先(与三式合一同一口径):时间弹层里改了还没点「确定」的草稿在 pendingFields 里;
		// timeHook 挂在时间栏下方的加减微调控件上,它的值是已确认的时刻 —— 此前它排在前面,把草稿盖回旧时刻
		// (弹层改到 14 点、直接点「起课」,仍按 10 点起)。没有草稿时才用微调控件的值兜底(连点步进、父级还没跟上)。
		const nextFields = this.pendingFields || this.getTimeFieldsFromSelector(this.props.fields) || this.props.fields;
		if(!nextFields){
			return;
		}
		const currentFields = this.props.fields || {};
		const patchFields = {};
		const patchDateTime = (key)=>{
			if(nextFields[key] && nextFields[key].value instanceof DateTime){
				patchFields[key] = { value: nextFields[key].value.clone() };
			}
		};
		const patchRaw = (key)=>{
			if(nextFields[key] && nextFields[key].value !== undefined){
				patchFields[key] = { value: nextFields[key].value };
			}
		};
		const maybePatchDateTime = (key, format)=>{
			const nextVal = nextFields[key] && nextFields[key].value instanceof DateTime ? nextFields[key].value.format(format) : '';
			const currVal = currentFields[key] && currentFields[key].value instanceof DateTime ? currentFields[key].value.format(format) : '';
			if(nextVal !== currVal){
				patchDateTime(key);
			}
		};
		const maybePatchRaw = (key)=>{
			const nextVal = nextFields[key] && nextFields[key].value !== undefined ? `${nextFields[key].value}` : '';
			const currVal = currentFields[key] && currentFields[key].value !== undefined ? `${currentFields[key].value}` : '';
			if(nextVal !== currVal){
				patchRaw(key);
			}
		};
		maybePatchDateTime('date', 'YYYY-MM-DD HH:mm:ss');
		maybePatchDateTime('time', 'YYYY-MM-DD HH:mm:ss');
		maybePatchRaw('ad');
		maybePatchRaw('zone');
		maybePatchRaw('lon');
		maybePatchRaw('lat');
		maybePatchRaw('gpsLon');
		maybePatchRaw('gpsLat');
		maybePatchRaw('gender');
		maybePatchRaw('after23NewDay');
		const needChartSync = Object.keys(patchFields).length > 0;
		this.pendingFields = null;
		if(needChartSync){
			if(sendScopedFields(this.props, patchFields)){
				return;
			}
			if(this.props.dispatch){
				this.props.dispatch({
					type: 'astro/fetchByFields',
					payload: {
						...currentFields,
						...patchFields,
						__requestOptions: {
							silent: true,
						},
					},
				});
			}
			return;
		}
		this.startPaiPanByFields(nextFields);
	},

	onWuXingChange(val){
		this.setState({
			wuxing: val,
			wuxingUserSet: true,   // 用户明选 → 此后起课不再按日干重置
		}, ()=>{
			this.saveLiuRengAISnapshot(null, this.state.liureng, this.state.runyear, val, this.state.guireng);
		});
	},

	// 只有独立六壬页读写保存值;择日宿主里内嵌的那份(techniqueScope='liurengzeri')不读不写(理由见 LIURENG_PAGE_SETTINGS 注)。
	usesSavedSettings(){
		return (this.props.techniqueScope || 'liureng') === 'liureng';
	},

	// 排盘设置落盘的唯一入口:只在用户亲手改控件的 handler 里调。非设置字段(选时时辰 / 演数数字)丢进来会被忽略。
	persistSetting(partial){
		if(!this.usesSavedSettings()){ return; }
		LIURENG_PAGE_SETTINGS.save(partial);
	},

	// 时间算法改档 → 时柱可变 → 必须真重新起课(不是纯显示层)。
	onTimeAlgChange(val){
		const next = val === 1 ? 1 : 0;
		this.persistSetting({ timeAlg: next });
		this.setState({ timeAlg: next }, ()=>{
			this.requestGods(this.props.fields);
		});
	},

	onGuiRengChange(val){
		this.persistSetting({ guireng: val });
		this.setState({
			guireng: val,
		}, ()=>{
			this.saveLiuRengAISnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, val);
		});
	},

	onCastMethodChange(val){
		// 起课法仅改天地盘加临（不动 /chart 计算），同贵人体系：setState 触发重渲染即重排，无需重新起课。
		this.persistSetting({ castMethod: val });
		this.setState({
			castMethod: val,
		}, ()=>{
			this.saveLiuRengAISnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, this.state.guireng);
		});
	},

	handleCastField(field, val){
		// 选时/演数/换将/分昼夜：同起课法，皆只改天地盘加临或昼夜，不重新起课。
		this.persistSetting({ [field]: val });
		this.setState({ [field]: val }, ()=>{
			this.saveLiuRengAISnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, this.state.guireng);
		});
	},

	// 快捷栏契约:起课主键常驻(左栏起课钮在长表单下会滚出视野,主键豁免)+「此刻起课」
	// 一键把课时设为当下并重排;9 张神煞 meta 卡收进「速查」弹层(原先常驻铺满=目录化)。
	// 只补 date/time——zone/经纬是用户所在地设置,动了反而起错课;ad 不动,DateTime 为
	// 绝对时刻,历法标记只是左栏录入形态。
	clickStartNowPaiPan(){
		const now = new DateTime();
		if(sendScopedFields(this.props, { date: { value: now.clone() }, time: { value: now.clone() } })){
			this.pendingFields = null;
			return;
		}
		if(!this.props.dispatch){
			return;
		}
		const currentFields = this.props.fields || {};
		this.pendingFields = null;
		this.props.dispatch({
			type: 'astro/fetchByFields',
			payload: {
				...currentFields,
				date: { value: now.clone() },
				time: { value: now.clone() },
				__requestOptions: {
					silent: true,
				},
			},
		});
	},
};
