// 金口诀页 · 时间 / 本命 / 五行 / 地分 / 月将 / 占时 / 流派改值、预取与起课入口
// 从 JinKouMain.js 按职责拆出的 JinKouMain 方法:this 仍是 JinKouMain 实例,门面里 mixinMethods(JinKouMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { lockDayBoundary } from '../../../utils/dayBoundaryLock';
import * as Constants from '../../../utils/constants';
import request from '../../../utils/request';
import * as LRConst from '../../liureng/LRConst';
import DateTime from '../../comp/DateTime';
import { buildJinKouData, fetchJinKouPan, normalizeKinjinkouData } from '../JinKouCalc';
import { resolveJinKouDiFen, normalizeZiFromText } from '../JinKouState';
import { chartDrawGuardEnabled, stepPrefetchEnabled, kentangCacheEnabled, stepSelectPrefetchEnabled } from '../../../utils/perfFlags';
import { deriveBenMingFromRunYear, deriveXuSuiFromRunYear, getAppliedBirth } from './runYear';
import { sameSigArr, JINKOU_PAGE_SETTINGS } from './pageState';

export const inputMethods = {
	onFieldsChange(field){
		const patch = {
			...(field || {}),
		};
		const hasConfirmedFlag = Object.prototype.hasOwnProperty.call(patch, '__confirmed');
		const confirmed = hasConfirmedFlag ? !!patch.__confirmed : true;
		if(hasConfirmedFlag && !confirmed){
			// 时间弹层里改了还没点「确定」:记成草稿(与六壬同一输入面、同一口径),点「起课」按草稿起
			delete patch.__confirmed;
			this.pendingFields = { ...(this.props.fields || {}), ...patch };
			return;
		}
		if(hasConfirmedFlag){
			delete patch.__confirmed;
		}
		this.pendingFields = null;
		// 用户拍板: 左栏改过 after23NewDay 后,全局事件不再覆盖。
		if(field && Object.prototype.hasOwnProperty.call(field, 'after23NewDay')){
			lockDayBoundary(this, 'after23');
			if(this.props.dispatch){
				this.props.dispatch({ type: 'astro/setAfter23BoundaryUserOverrode', payload: { value: true } });
			}
		}
		// v2.2.1: 时柱开关同款局部覆盖 — 同时设本地 flag 和 dva 中央 flag
		if(field && Object.prototype.hasOwnProperty.call(field, 'lateZiHourUseNextDay')){
			lockDayBoundary(this, 'lateZi');
			if(this.props.dispatch){
				this.props.dispatch({ type: 'astro/setLateZiHourUserOverrode', payload: { value: true } });
			}
		}
		if(this.props.dispatch && this.props.fields){
			const flds = {
				...this.props.fields,
				...patch,
			};
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: {
					...flds,
					__requestOptions: {
						silent: true,
					},
					nohook: !confirmed,
				},
			});
			// 步进时静默备下 T+1 的 gods+pan(链与 requestGods 完全同源)
			if(confirmed && patch.__stepHint){
				this.prefetchNextStepJinkou(flds, patch.__stepHint);
			}
		}
	},

	// 顺向 +1 步预取:genGodsParams→/liureng/gods(requestDedupe 缓存)→
	// resolveJinKouDiFen(同款选项解析)→fetchJinKouPan(kentangCache)——与 requestGods
	// 消费链逐环同源 → 键逐字节等。失败静默;开关关=零行为。
	prefetchNextStepJinkou(baseFields, stepHint){
		try{
			if(!stepPrefetchEnabled() || !kentangCacheEnabled()){ return; }
			if(!stepHint || !stepHint.dir){ return; }
			const dt0 = baseFields && baseFields.date && baseFields.date.value;
			if(!dt0 || typeof dt0.clone !== 'function'){ return; }
			if(this.prefetchStepTimer){ clearTimeout(this.prefetchStepTimer); }
			this.prefetchStepTimer = setTimeout(()=>{
				this.prefetchStepTimer = null;
				if(this.unmounted){ return; }
				this._prefetchJinkouAtStep(baseFields, stepHint.unit || 'm', stepHint.dir);
			}, 150);
		}catch(e){ /* 预取失败无害 */ }
	},

	// 取数内核:以 baseFields 时间为基走 1 步×dir,同源链(genGodsParams→/liureng/gods→
	// fetchJinKouPan)预取该时刻课盘。settle 链(+1 同向)与选步长(±1 双向)共用。
	_prefetchJinkouAtStep(baseFields, unit, dir){
		try{
			const dt0 = baseFields && baseFields.date && baseFields.date.value;
			if(!dt0 || typeof dt0.clone !== 'function'){ return; }
			const dt2 = dt0.clone();
			if(unit === 'y'){ dt2.addYear(dir); }
			else if(unit === 'M'){ dt2.addMonth(dir); }
			else if(unit === 'd'){ dt2.addDate(dir); }
			else if(unit === 'h'){ dt2.addHour(dir); }
			else { dt2.addMinute(4 * dir); }
			const flds2 = {
				...baseFields,
				date: { value: dt2.clone() },
				time: { value: dt2.clone() },
				ad: { value: dt2.ad },
				zone: { value: dt2.zone },
			};
			const params = this.genGodsParams(flds2);
			if(!params){ return; }
			request(`${Constants.ServerRoot}/liureng/gods`, {
				body: JSON.stringify(params),
				silent: true,
			}).then((data)=>{
				const result = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
				if(!result || !result.liureng || this.unmounted){ return null; }
				const timeZi = normalizeZiFromText(result.liureng.nongli.time);
				const diFen = resolveJinKouDiFen(
					this.state.diFen,
					this.state.diFenAuto === true,
					timeZi,
					!!this.state.liureng
				);
				return fetchJinKouPan(flds2, result.liureng.nongli, {
					diFen: diFen,
					yueJiang: this.state.yueJiang,
					zhanShi: this.state.zhanShi,
					timeBasis: this.state.timeBasis,
				});
			}).catch(()=>null);
		}catch(e){ /* 预取失败无害 */ }
	},

	// 选步长即预取:金口诀 gods→pan 双段链是本页主耗时,全局 handler 只罩 /chart ——
	// 以当前时间 ±1 双向预热课盘,选完步长第一下步进即命中。同 unit 5s 去重。
	prefetchStepSelect(unit){
		try{
			if(!stepPrefetchEnabled() || !kentangCacheEnabled() || !stepSelectPrefetchEnabled() || !unit){ return; }
			const now = Date.now();
			if(this._lastStepSel && this._lastStepSel.unit === unit && (now - this._lastStepSel.at) < 5000){ return; }
			this._lastStepSel = { unit, at: now };
			const flds = this.props.fields || {};
			this._prefetchJinkouAtStep(flds, unit, 1);
			this._prefetchJinkouAtStep(flds, unit, -1);
		}catch(e){ /* 预取失败无害 */ }
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
		const next = { birth: flds };
		// 性别与日期时间不同：不需要「确认」语义，改了就该立刻生效（右栏性别、行年男顺女逆、
		// 中栏性别格、xingNian.gender 全看 calcBirth）。原先只写 birth，要等下次起课才更新，
		// 用户在左栏把性别改成女、右栏却一直显示男。此处把性别单独同步进 calcBirth。
		const prevGender = this.state.calcBirth && this.state.calcBirth.gender ? this.state.calcBirth.gender.value : undefined;
		const nextGender = flds.gender ? flds.gender.value : undefined;
		if(this.state.calcBirth && nextGender !== undefined && nextGender !== prevGender){
			next.calcBirth = { ...this.state.calcBirth, gender: { ...(this.state.calcBirth.gender || {}), value: nextGender } };
		}
		// 出生档变更即作废旧行年(与六壬同律):旧档 runyear(含 birthGanZi)滞留 state
		// 会被 resolveDisplayRunYear 的 ±1 岁容差放行、且 merged 展开保留旧 birthGanZi →
		// 快照/旬法吃旧档。清空 → 年差法 fallback 即刻接管,requestRunYear 归来再精修。
		next.runyear = null;
		this.setState(next, ()=>{
			// 行年男顺女逆随性别翻转 → 重取行年并重存挂载快照(与流派 setter 同律)。
			// 条件放宽到「改生日也重取」:清空后年差法 fallback 只有 age/year,
			// 旬法的 birthGanZi(生年干支)唯后端能给——只在性别变时重取则改生日后旬法段恒空。
			if(this.state.liureng){
				this.requestRunYear();
			}
		});
	},

	onWuXingChange(val){
		// wuxingAuto=false 起，requestGods 不再拿日干五行覆写用户的手选值
		// （原先改一下地分/月将/占时/时间基准就把用户选的「木」静默打回日干的「金」）。
		// 选「自动」即回到缺省档:置 wuxingAuto=true 并按当前课的日干立刻回算,
		// 此前一旦手选过就再也回不去自动(下拉里根本没有这一项)。
		if(val === 'auto'){
			const dayGanZi = (this.state.liureng && this.state.liureng.nongli && this.state.liureng.nongli.dayGanZi) || '';
			const autoWx = LRConst.GanZiWuXing[dayGanZi.substr(0, 1)] || this.state.wuxing;
			this.setState({ wuxing: autoWx, wuxingAuto: true }, ()=>{
				this.saveJinKouSnapshot(null, this.state.liureng, this.state.runyear, autoWx, this.state.guireng, this.state.diFen);
			});
			return;
		}
		this.setState({
			wuxing: val,
			wuxingAuto: false,
		}, ()=>{
			this.saveJinKouSnapshot(null, this.state.liureng, this.state.runyear, val, this.state.guireng, this.state.diFen);
		});
	},

	onDiFenChange(val){
		// 选「自动」即回缺省档:置 diFenAuto=true,由 resolveJinKouDiFen 按占时支重取。
		if(val === 'auto'){
			this.setState({ diFenAuto: true }, ()=>{
				if(this.state.liureng){
					this.requestGods(this.state.calcFields || this.props.fields);
				}else{
					this.saveJinKouSnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, this.state.guireng, this.state.diFen);
				}
			});
			return;
		}
		this.setState({
			diFen: val,
			diFenAuto: false,
		}, ()=>{
			if(this.state.liureng){
				this.requestGods(this.state.calcFields || this.props.fields);
			}else{
				this.saveJinKouSnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, this.state.guireng, val);
			}
		});
	},

	onYueJiangChange(val){
		this.setState({
			yueJiang: val,
		}, ()=>{
			if(this.state.liureng){
				this.requestGods(this.state.calcFields || this.props.fields);
			}
		});
	},

	onZhanShiChange(val){
		this.setState({
			zhanShi: val,
		}, ()=>{
			if(this.state.liureng){
				this.requestGods(this.state.calcFields || this.props.fields);
			}
		});
	},

	// 排盘流派切换(月将换将/贵人昼夜表/起贵神盘/盘式)：纯前端确定性重算，只触发重渲染(无需后端)。
	onSchoolChange(key, val){
		JINKOU_PAGE_SETTINGS.save({ [key]: val });   // 用户亲手改的流派 → 落盘
		this.setState({ [key]: val }, ()=>{
			// 与五行/贵人/地分 setter 同律:流派改后重存挂载快照,否则 AI 挂载读旧流派盘文
			// (导出有 refresh 事件自愈,挂载路径读缓存无自愈)。
			if(this.state.liureng){
				this.saveJinKouSnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, this.state.guireng, this.state.diFen, this.state.jinkouPan);
			}
		});
	},

	// 组装显示用金口诀数据：流派非默认时以本地确定性重算为准(后端不解流派)；默认时走后端盘(零回归)。
	assembleJinKouData(liureng, backendPan, runYearOverride){
		// 签名 = 装配实际消费的全部输入(liureng/backendPan 引用 + 地分/贵神/昼夜/月将/占时/三流派/盘式)。
		// 全等 → 复用上次结果(同输入必同输出,引用稳定);任一变 → 真重算。切右栏 tab 不动这些 → 跳过引擎重跑。
		// runYearOverride:快照路径传收口后的行年(state.runyear 裸拍是挂载恒旧的病根,
		// 收口只堵文本参不堵此处=旬法/本命/虚岁三键绕道);缺省(render 路径)沿用 state。
		const effRunYear = runYearOverride !== undefined ? runYearOverride : this.state.runyear;
		const guardOn = chartDrawGuardEnabled();
		const sigArr = [
			liureng, backendPan,
			this.state.diFen, this.state.guireng, this.state.calcIsDiurnal,
			this.state.yueJiang, this.state.zhanShi,
			this.state.schoolYueJiang, this.state.schoolGuiTable, this.state.schoolGuiPan,
			this.state.panShi, this.state.soilChangSheng,
			// wuxing 决定 phaseTable(十二长生表)：漏进签名 → 切五行时右栏长生表被缓存钉死在旧五行。
			this.state.wuxing,
			// 专题起式与行年（新增消费输入，须进签名否则切专题不重算）
			this.state.topicKey, this.state.shiJianKind, this.state.askKey, this.state.timeScope,
			// 行年旬法只吃这两个派生值(非整个 runyear 对象),避免每轮取回都判失效
			effRunYear ? effRunYear.birthGanZi : '',
			effRunYear ? effRunYear.age : '',
		];
		if(guardOn && this._jinkouDataCache && sameSigArr(this._jinkouDataCache.sig, sigArr)){
			return this._jinkouDataCache.data;
		}

		let result;
		if(!liureng){
			result = normalizeKinjinkouData(backendPan, null);
		}else{
			const appliedBirthForCalc = getAppliedBirth(this.state);
			const local = buildJinKouData(liureng, {
				diFen: this.state.diFen,
				guirengType: this.state.guireng,
				isDiurnal: this.state.calcIsDiurnal,
				yueJiang: this.state.yueJiang,
				zhanShi: this.state.zhanShi,
				schoolYueJiang: this.state.schoolYueJiang,
				schoolGuiTable: this.state.schoolGuiTable,
				schoolGuiPan: this.state.schoolGuiPan,
				panShi: this.state.panShi,
				soilChangSheng: this.state.soilChangSheng,
				wuxing: this.state.wuxing,
				// 专题起式（未选则引擎侧为 null，零额外开销）
				topicKey: this.state.topicKey,
				shiJianKind: this.state.shiJianKind,
				askKey: this.state.askKey,
				timeScope: this.state.timeScope,
				benMing: deriveBenMingFromRunYear(effRunYear),
				// 金口诀行年（旬法）：生年干支取自问测人档（runyear 留档），虚岁优先取左栏输入，
				// 未填则回落既有干支流年之岁数；与既有干支流年两法并存互不覆盖。
				birthGanZi: effRunYear ? effRunYear.birthGanZi : '',
				gender: appliedBirthForCalc && appliedBirthForCalc.gender ? appliedBirthForCalc.gender.value : 1,
				age: deriveXuSuiFromRunYear(effRunYear),
			});
			const isDefault = this.schoolsAllDefault();
			// 日柱两源分叉闸：/liureng/gods 与 /jinkou/pan 各自定日柱(现都随「时间基准」取时间算法)；
			// 跨日界(晚子时)时两者若判不齐，日柱会差一天。
			// 此时若照用 pan，就成了「盘面按 pan 的日干起人元、右栏一切解读按 liureng 的日干」，
			// 一张课两个日干。判不齐即退回本地引擎(全程只吃 liureng 日干，自洽)。
			const panDay = backendPan && backendPan.ganzhi ? backendPan.ganzhi.day : '';
			const lrDay = liureng && liureng.nongli ? liureng.nongli.dayGanZi : '';
			const dayAligned = !panDay || !lrDay || `${panDay}` === `${lrDay}`;
			result = (isDefault && dayAligned) ? normalizeKinjinkouData(backendPan, local) : local;
			if(isDefault && !dayAligned){
				result.daySourceNote = `课时恰在换日处：两种算法的日柱不同（「${panDay}」日 / 「${lrDay}」日），已统一取「${lrDay}」日推算。`;
			}
			// 三盘环已由本地引擎按当前流派现算（buildJinKouPlates），不再有「待续」占位。
			// 仅当本地未能产出（月将/占时缺失）时才回落后端环，两者都没有才说明。
			if(!isDefault && (!result.plates || !result.plates.length)){
				if(backendPan && Array.isArray(backendPan.plates) && backendPan.plates.length){
					result.plates = backendPan.plates;
				}else{
					result.platesNote = '月将或占时未定，三盘环待起课后产出 —— 先以上方四位盘为准';
				}
			}
		}

		if(guardOn){
			this._jinkouDataCache = { sig: sigArr, data: result };
		}
		return result;
	},

	// 五项流派/盘法是否全缺省 —— 只有全缺省(且两源日柱对齐)时页面才采用后端 /jinkou/pan;
	// 任一项非缺省即改走本地引擎 buildJinKouData。本地引擎吃 /liureng/gods 的农历,而那份农历随「时间基准」
	// 取时间算法(genGodsParams),所以两条路径「时间基准」都生效,不置灰。
	schoolsAllDefault(){
		return (this.state.schoolYueJiang || 'zhongqi') === 'zhongqi'
			&& (this.state.schoolGuiTable || 'shiwu') === 'shiwu'
			&& (this.state.schoolGuiPan || 'di') === 'di'
			&& (this.state.panShi || 'yang') === 'yang'
			&& (this.state.soilChangSheng || 'shen') === 'shen';
	},

	onTimeBasisChange(val){
		JINKOU_PAGE_SETTINGS.save({ timeBasis: val });   // 用户亲手改的时间基准 → 落盘
		this.setState({
			timeBasis: val,
		}, ()=>{
			if(this.state.liureng){
				this.requestGods(this.state.calcFields || this.props.fields);
			}
		});
	},

	setRightPanelTab(key){
		this.setState({
			rightPanelTab: key,
		});
	},

	// 「起课」草稿优先(与六壬、三式合一同一口径):有未确认的时间草稿 → 先把它落成当前盘(全局取数回来经 hook 起课);
	// 没有草稿按当前时刻起课。
	clickStartCast(){
		const draft = this.pendingFields;
		this.pendingFields = null;
		if(draft && draft.date && draft.time && this.props.dispatch && this.props.fields){
			const cur = this.props.fields;
			const fmt = (f)=>(f && f.value && typeof f.value.format === 'function' ? f.value.format('YYYY-MM-DD HH:mm:ss') : '');
			if(fmt(draft.date) !== fmt(cur.date) || fmt(draft.time) !== fmt(cur.time)){
				this.onFieldsChange({ date: draft.date, time: draft.time, ad: draft.ad, zone: draft.zone });
				return;
			}
		}
		this.requestGods(this.state.calcFields || this.props.fields);
	},

	// 快捷栏契约:「此刻起课」:课时=当下,走全局 fields 受控回流(hook 链随新盘自动 requestGods)。
	// 只补 date/time/ad——zone/经纬是用户所在地设置不动。
	clickPlotNow(){
		this.pendingFields = null;   // 此刻起课 = 放弃弹层里没确认的时间
		if(!this.props.dispatch || !this.props.fields){
			return;
		}
		const now = new DateTime();
		this.props.dispatch({
			type: 'astro/fetchByFields',
			payload: {
				...this.props.fields,
				date: { value: now.clone() },
				time: { value: now.clone() },
				ad: { value: now.ad },
			},
		});
	},
};
