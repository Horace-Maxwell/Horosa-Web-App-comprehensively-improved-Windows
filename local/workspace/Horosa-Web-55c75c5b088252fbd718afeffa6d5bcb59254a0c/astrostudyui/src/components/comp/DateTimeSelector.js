import React, { Component } from 'react';
import { Row, Col } from 'antd';
import { XQButton as Button, XQInputNumber as InputNumber, XQSelect as Select } from '../xq-ui';

// 年月日四列各需 ≈67px("2026"+内衬+箭头),小于 270px 的行折成两列;zoom=1 的 276px 侧栏仍四列、零改动。
const NARROW_ROW_WIDTH = 270;

import DateTime from './DateTime';
import { fireStepSelectPrefetch } from '../../utils/stepPrefetch';
import { matchesUserQuery } from '../../utils/scriptMode';
import { createDeferredResizeObserver } from '../../utils/deferredResizeObserver';

const Option = Select.Option;

// 按住年 / 月 / 日 / 时 / 分 / 秒任一格拖动 = 连续调这一个单位:往上 / 往右加,往下 / 往左减;每档像素按单位定(SCRUB_PITCH),
// 年 / 分 / 秒快划会加速(一划能跨几十档,不受屏幕高度限制),跨位照常进位。拖动中只在本格即时刷新数字,
// 向宿主提交节流到每 SCRUB_EMIT_MS 一次、松手补最后一次(宿主重算整盘很重,逐档提交会卡)。
// 移动不到 SCRUB_START_PX 就松开 = 普通点击(下拉照常展开、年份框照常聚焦)。按下时不放出 mousedown,所以下拉不会先闪开再收起。
// 每档像素与是否加速按单位分:档数少的(月 12 / 日 31 / 时 24)每档宽、不加速,慢拖每一档都停得住;
// 年 / 分 / 秒档数多,每档窄,只在快划时加速
const SCRUB_PITCH = { y: 6, M: 18, d: 12, h: 12, m: 6, s: 6 };
const SCRUB_ACCEL = { y: true, M: false, d: false, h: false, m: true, s: true };
const SCRUB_START_PX = 3;
const SCRUB_EMIT_MS = 150;
const SCRUB_TITLE = '按住上下 / 左右拖动可连续调整';
function scrubGain(dist){
	// 单次移动的像素距离 → 倍率:正常速度逐档,快划才加速
	if(dist >= 30){ return 4; }
	if(dist >= 18){ return 2; }
	return 1;
}
const SCRUB_UNIT_LABEL = { y: (dt)=>`${dt.ad < 0 ? '前' : ''}${dt.year} 年`, M: (dt)=>`${dt.month} 月`, d: (dt)=>`${dt.date} 日`, h: (dt)=>`${dt.hour} 时`, m: (dt)=>`${dt.minute} 分`, s: (dt)=>`${dt.second} 秒` };
// 年 / 月加减保持「几号」不溢出:先落到 1 号再加,再把日夹到目标月的天数(10-31 加一月 = 11-30,不是 12-01;
// 闰日加一年 = 2-28)。DateTime.addMonth 会让 31 号溢出到下下月,逐档拖 / 步进时 11 月就永远到不了。
function addMonthsKeepDay(dt, n, years){
	const d0 = dt.date;
	dt.date = 1;
	if(years){ dt.addYear(n); }else{ dt.addMonth(n); }
	const max = dt.getMonthDays(dt.year * dt.ad, dt.month);
	dt.date = Math.min(d0, max);
	dt.calcJdn();
	return dt;
}
function addUnit(dt, unit, n){
	if(unit === 'y'){ addMonthsKeepDay(dt, n, true); }else if(unit === 'M'){ addMonthsKeepDay(dt, n, false); }else if(unit === 'd'){ dt.addDate(n); }
	else if(unit === 'h'){ dt.addHour(n); }else if(unit === 'm'){ dt.addMinute(n); }else if(unit === 's'){ dt.addSecond(n); }
	return dt;
}

class DateTimeSelector extends Component{
	constructor(props) {
		super(props);

		let tmType = this.props.defaultTimeType ? this.props.defaultTimeType : 'm';
		if(this.props.onlyYear){
			tmType = 'y';
		}else if(this.props.yearMonth){
			tmType = 'M';
		}

		// narrow:根行实宽 < NARROW_ROW_WIDTH 时年月日/时分秒各折成两列。antd 的 lg/xl 断点看的是物理视口,
		// 壳放大后布局宽早已不够(1.8 档 245px 侧栏仍按 xl 四列排 → 每格 61px 放不下 "2026");按容器实宽判定,任何引擎同义。
		this.rootRef = React.createRef();
		this._narrowRO = null;
		this.syncNarrow = this.syncNarrow.bind(this);
		this.state = {
			narrow: false,
			timeType: tmType,
			tik: 0,
			// 年份输入草稿:输入期间不提交(旧行为每键立即重排盘,4/5 位年被打断截半,
			// 如输 7040 只吃到 70)。失焦/回车才 flush 到 changeYear。
			yearDraft: null,
			scrubUnit: null,   // 正在拖动调整的那一格(描金边)
		};
		this._scrub = null;
		this.scrubMove = this.scrubMove.bind(this);
		this.scrubEmit = this.scrubEmit.bind(this);
		this.scrubUp = this.scrubUp.bind(this);
		this.scrubClickGuard = this.scrubClickGuard.bind(this);

		this.datetime = new DateTime();
		this.changing = false;

		this.changeAD = this.changeAD.bind(this);
		this.changeZone = this.changeZone.bind(this);
		this.changeYear = this.changeYear.bind(this);
		this.stageYear = this.stageYear.bind(this);
		this.flushYear = this.flushYear.bind(this);
		this.changeMonth = this.changeMonth.bind(this);
		this.changeDate = this.changeDate.bind(this);
		this.changeHour = this.changeHour.bind(this);
		this.changeMinute = this.changeMinute.bind(this);
		this.changeSecond = this.changeSecond.bind(this);

		this.onChanged = this.onChanged.bind(this);

		this.genMonth = this.genMonth.bind(this);
		this.genDate = this.genDate.bind(this);
		this.genHour = this.genHour.bind(this);
		this.genMinute = this.genMinute.bind(this);
		this.genSecond = this.genSecond.bind(this);
		this.genZone = this.genZone.bind(this);
		this.genTmDom = this.genTmDom.bind(this);
		this.genMdDom = this.genMdDom.bind(this);
		this.filterOption = this.filterOption.bind(this);
		this.genTimeTypeDom = this.genTimeTypeDom.bind(this);
		this.genAdjustDom = this.genAdjustDom.bind(this);
		

		this.clickMinus = this.clickMinus.bind(this);
		this.clickPlus = this.clickPlus.bind(this);
		this.changeTimeType = this.changeTimeType.bind(this);
		this.clickNow = this.clickNow.bind(this);
		this.clickOk = this.clickOk.bind(this);
		this.getCurrentValue = this.getCurrentValue.bind(this);
		this.normalizeValue = this.normalizeValue.bind(this);
		this.isSameDateTime = this.isSameDateTime.bind(this);

		// 本实例发出去、父级还没追上的时刻(连点步进时父级追赶中的中间值要认得,不当外部改动)
		this.emitted = [];
		if(this.props.hook){
			// 取值无副作用:此前读一次就置 changing,之后外部值(弹层里改、双击键入、「此刻」、载入)再也同步不进来,
			// 本控件永久停在旧时刻,「起盘」/ 预取读到旧值又把时间改回去。
			this.props.hook.getValue = ()=>this.getCurrentValue();
		}
	}

	keyOf(dt){
		return dt ? `${dt.ad}|${dt.year}|${dt.month}|${dt.date}|${dt.hour}|${dt.minute}|${dt.second}|${dt.zone}` : '';
	}

	noteEmitted(){
		this.emitted.push(this.keyOf(this.datetime));
		if(this.emitted.length > 32){ this.emitted.shift(); }
	}

	componentDidUpdate(prevProps){
		if(!this.changing){
			return;
		}
		const curVal = this.normalizeValue(this.props.value);
		if(curVal && this.isSameDateTime(curVal, this.datetime)){
			this.changing = false;
			this.emitted = [];
			return;
		}
		// 外部值按数值变了、且不是本实例刚发出去的某一步 → 外部改动,以外部为准重新同步
		const prevVal = this.normalizeValue(prevProps && prevProps.value);
		if(curVal && (!prevVal || !this.isSameDateTime(curVal, prevVal)) && this.emitted.indexOf(this.keyOf(curVal)) < 0){
			this.changing = false;
			this.emitted = [];
			this.datetime = curVal;
			this.setState({ tik: this.state.tik + 1 });
		}
	}

	normalizeValue(val){
		if(!val){
			return null;
		}
		if(val instanceof DateTime){
			return val;
		}
		if(val.value && val.value instanceof DateTime){
			return val.value;
		}
		return null;
	}

	isSameDateTime(a, b){
		if(!a || !b){
			return false;
		}
		return (
			a.ad === b.ad &&
			a.year === b.year &&
			a.month === b.month &&
			a.date === b.date &&
			a.hour === b.hour &&
			a.minute === b.minute &&
			a.second === b.second &&
			a.zone === b.zone
		);
	}

	getCurrentValue(){
		return {
			...this.datetime.getValue(),
			value: this.datetime.clone(),
		};
	}

	clickOk(){
		// 🔴 先落未提交的年份草稿(输入不被截半):年份是半受控草稿(yearDraft),仅失焦/回车 flush。
		// 用户输入年份后未失焦直接点「确定」时(尤其点确定未必触发 InputNumber blur),草稿未落 →
		// getCurrentValue 读旧 this.datetime → 年份截半退回旧年(如输 12026 变 2026)。此处同步把草稿
		// 落到 this.datetime(clone+setYear,不走 changeYear→onChanged;showAdjust=false 路径 onDirectChanged
		// 会再调 clickOk,走 onChanged 会递归)。月/日/时是 Select 即时提交,无此问题。
		const draft = this.state.yearDraft;
		if(draft !== null && draft !== undefined && draft !== ''){
			const n = Number(draft);
			if(Number.isFinite(n) && n >= 1 && n !== this.datetime.year){
				const dt = this.datetime.clone();
				dt.setYear(n);
				this.datetime = dt;
			}
			if(this.state.yearDraft !== null){ this.setState({ yearDraft: null }); }
		}
		const res = {
			...this.getCurrentValue(),
			confirmed: true,
		};
		// Keep local edit value until parent props catches up.(先记再发:父级同步更新时 componentDidUpdate 已认得这一步)
		this.changing = true;
		this.noteEmitted();
		if(this.props.onChange){
			this.props.onChange(res);
		}
	}

	onDirectChanged(val){
		this.datetime = val;
		if(val.value && val.value instanceof DateTime){
			this.datetime = val.value;
		}
		this.clickOk();

		this.setState({
			tik: this.state.tik + 1,
		});
	}

	onChanged(val, step){
		let needAjust = this.props.showAdjust ? true : false;
		if(needAjust === false){
			this.onDirectChanged(val);
			}else{
				this.datetime = val;
				if(val.value && val.value instanceof DateTime){
					this.datetime = val.value;
				}
				this.changing = true;
				this.noteEmitted();
				// Keep parent fields synced with selector values to avoid stale time usage.
				if(this.props.onChange){
					this.props.onChange({
						...this.getCurrentValue(),
						confirmed: !!this.props.confirmOnAdjust,
						// 步进预取(WP-P1)的方向提示:仅步进/此刻点击附带 {unit,dir},
						// 供下游预取「下一步」盘;非步进路径(格子编辑)不带 —— 纯多余字段,
						// 消费方(changeCond)剥离后不落 fields,别的 onChange 消费者零影响。
						...(step ? { step } : {}),
					});
				}
				this.setState({
					tik: this.state.tik + 1,
				});	
			}
	}

	clickNow(){
		// 按当前面板时区取此刻(此前 new DateTime() = 系统本地钟面 + 写死 +08:00 → 非东八区系统上「此刻」错 N 小时);
		// 面板时区缺省 +08:00 时与旧行为逐字节相同
		const zone = this.datetime && typeof this.datetime.zone === 'string' && this.datetime.zone ? this.datetime.zone : '+08:00';
		let dt = DateTime.nowInZone(zone);
		this.onChanged(dt, { unit: this.state.timeType, dir: 0 });
	}

	// 只显示日期时步长只在 年 / 月 / 天 里取(与步长下拉同口径);其余照旧
	effectiveTimeType(){
		const t = this.state.timeType;
		if(this.props.showTime === false && !this.props.onlyYear && !this.props.yearMonth && ['y', 'M', 'd'].indexOf(t) < 0){
			return 'd';
		}
		return t;
	}

	changeTimeType(val){
		this.setState({
			timeType: val
		});
		// 选定步长那一刻即预取前后各 2 步(opt-in 宿主:主盘/步进面 PlusMinusTime/PD;
		// 日历/表单抽屉等无关上下文不挂此 prop=零行为)。第一下点 ± 也不冷。
		// 函数形态=宿主【本地】预取器 —— 自持 fields 的盘面(卜卦/择日/世俗 DivinationChartShell 等)
		// 必须用自己的构参+请求路径保键逐字节等,全局 handler(store fields+fieldsToParams)对它们是错键空烧;
		// truthy=全局 handler(主链 store fields,现状零回归)。
		if(typeof this.props.stepSelectPrefetch === 'function'){
			try{ this.props.stepSelectPrefetch(val); }catch(e){ /* 预取失败无害 */ }
		}else if(this.props.stepSelectPrefetch){
			fireStepSelectPrefetch(val);
		}
	}

	clickMinus(){
		let ctype = this.effectiveTimeType();
		let dt = this.datetime.clone();
		if(ctype === 'y'){
			addMonthsKeepDay(dt, -1, true);
		}else if(ctype === 'M'){
			addMonthsKeepDay(dt, -1, false);
		}else if(ctype === 'd'){
			dt.addDate(-1);
		}else if(ctype === 'h'){
			dt.addHour(-1);
		}else if(ctype === 'm'){
			dt.addMinute(-4)
		}

		if(this.props.startTime){
			if(dt.jdn < this.props.startTime.jdn){
				throw "cannot before startTime: " + this.props.startTime.getValue().tm;
			}
		}

		this.onChanged(dt, { unit: ctype, dir: -1 });
	}

	clickPlus(){
		let ctype = this.effectiveTimeType();
		let dt = this.datetime.clone();
		if(ctype === 'y'){
			addMonthsKeepDay(dt, 1, true);
		}else if(ctype === 'M'){
			addMonthsKeepDay(dt, 1, false);
		}else if(ctype === 'd'){
			dt.addDate(1);
		}else if(ctype === 'h'){
			dt.addHour(1);
		}else if(ctype === 'm'){
			dt.addMinute(4)
		}
		this.onChanged(dt, { unit: ctype, dir: 1 });

	}

	changeAD(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		let dt = this.datetime.clone();
		dt.setAd(val);
		this.onChanged(dt);
	}

	changeZone(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		let dt = this.datetime.clone();
		dt.setZone(val);
		this.onChanged(dt);
	}

	changeYear(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		let dt = this.datetime.clone();
		dt.setYear(val);
		this.onChanged(dt);
	}

	// 年份输入三段:onChange 暂存草稿 → 失焦/回车 flush 提交 → 清草稿
	stageYear(val){
		this.setState({ yearDraft: val });
	}

	flushYear(){
		const v = this.state.yearDraft;
		this.setState({ yearDraft: null });
		if(v === undefined || v === null || v === ''){
			return;
		}
		const n = Number(v);
		if(!Number.isFinite(n) || n < 1){
			return;
		}
		if(n !== this.datetime.year){
			this.changeYear(n);
		}
	}

	changeMonth(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		let dt = this.datetime.clone();
		dt.setMonth(val);
		this.onChanged(dt);
	}

	changeDate(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		let dt = this.datetime.clone();
		dt.setDay(val);
		this.onChanged(dt);
	}

	changeHour(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		let dt = this.datetime.clone();
		dt.setHour(val);
		this.onChanged(dt);
	}

	changeMinute(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		let dt = this.datetime.clone();
		dt.setMinute(val);
		this.onChanged(dt);
	}

	changeSecond(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		let dt = this.datetime.clone();
		dt.setSecond(val);
		this.onChanged(dt);
	}

	filterOption(input, option){
		if(option.props.children){
			return matchesUserQuery(option.props.children + '', input);
		}
		return false;
	}

	genMonth(){
		let m = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
		let opts = []
		for(let i=0; i<12; i++){
			let opt = (
				<Option value={i+1} key={i}>{m[i]}</Option>
			);
			opts.push(opt);
		}

		let dom = (
			<Select
				style={{width: '100%'}} size='small' 
				placeholder='月' showSearch
				value={this.datetime.month} 
				onChange={this.changeMonth} 
				filterOption={this.filterOption}
			>
				{opts}
			</Select>
		)

		return this.scrubCell('M', dom);
	}

	genDate(){
		let opts = []
		for(let i=1; i<=31; i++){
			let opt = (
				<Option value={i} key={i}>{i}</Option>
			);
			opts.push(opt);
		}

		let dom = (
			<Select
				style={{width: '100%'}} size='small' 
				placeholder='日' showSearch
				value={this.datetime.date} 
				onChange={this.changeDate} 
				filterOption={this.filterOption}
			>
				{opts}
			</Select>
		)

		return this.scrubCell('d', dom);
	}


	genHour(){
		let opts = [(
			<Option value={0} key={0}>0点子</Option>
		),(
			<Option value={1} key={1}>1点</Option>
		),(
			<Option value={2} key={2}>2点丑</Option>
		),(
			<Option value={3} key={3}>3点</Option>
		),(
			<Option value={4} key={4}>4点寅</Option>
		),(
			<Option value={5} key={5}>5点</Option>
		),(
			<Option value={6} key={6}>6点卯</Option>
		),(
			<Option value={7} key={7}>7点</Option>
		),(
			<Option value={8} key={8}>8点辰</Option>
		),(
			<Option value={9} key={9}>9点</Option>
		),(
			<Option value={10} key={10}>10点巳</Option>
		),(
			<Option value={11} key={11}>11点</Option>
		),(
			<Option value={12} key={12}>12点午</Option>
		),(
			<Option value={13} key={13}>13点</Option>
		),(
			<Option value={14} key={14}>14点未</Option>
		),(
			<Option value={15} key={15}>15点</Option>
		),(
			<Option value={16} key={16}>16点申</Option>
		),(
			<Option value={17} key={17}>17点</Option>
		),(
			<Option value={18} key={18}>18点酉</Option>
		),(
			<Option value={19} key={19}>19点</Option>
		),(
			<Option value={20} key={20}>20点戌</Option>
		),(
			<Option value={21} key={21}>21点</Option>
		),(
			<Option value={22} key={22}>22点亥</Option>
		),(
			<Option value={23} key={23}>23点</Option>
		)];

		let dom = (
			<Select
				style={{width: '100%'}} size='small' 
				placeholder='时' showSearch
				value={this.datetime.hour} 
				onChange={this.changeHour} 
				filterOption={this.filterOption}
			>
				{opts}
			</Select>
		)

		return this.scrubCell('h', dom);
	}

	genMinute(){
		let opts = []
		for(let i=0; i<60; i++){
			let opt = (
				<Option value={i} key={i}>{i}分</Option>
			);
			opts.push(opt);
		}

		let dom = (
			<Select
				style={{width: '100%'}} size='small' 
				placeholder='分' showSearch
				value={this.datetime.minute} 
				onChange={this.changeMinute} 
				filterOption={this.filterOption}
			>
				{opts}
			</Select>
		)

		return this.scrubCell('m', dom);
	}

	genSecond(){
		let opts = []
		for(let i=0; i<60; i++){
			let opt = (
				<Option value={i} key={i}>{i}秒</Option>
			);
			opts.push(opt);
		}

		let dom = (
			<Select
				style={{width: '100%'}} size='small' 
				placeholder='秒' showSearch
				value={this.datetime.second} 
				onChange={this.changeSecond} 
				filterOption={this.filterOption}
			>
				{opts}
			</Select>
		)

		return this.scrubCell('s', dom);
	}

	genZone(){
		let dom = (
			<Select 
				style={{width: '100%'}} size='small' 
				placeholder='时区' showSearch
				value={this.datetime.zone} 
				onChange={this.changeZone}
				filterOption={this.filterOption}				
			>
				<Option value="+00:00" key="+00:00">东0区</Option>
				<Option value="+01:00" key="+01:00">东1区</Option>
				<Option value="+02:00" key="+02:00">东2区</Option>
				<Option value="+03:00" key="+03:00">东3区</Option>
				<Option value="+04:00" key="+04:00">东4区</Option>
				<Option value="+04:30" key="+04:30">东4.5</Option>
				<Option value="+05:00" key="+05:00">东5区</Option>
				<Option value="+05:30" key="+05:30">东5.5</Option>
				<Option value="+06:00" key="+06:00">东6区</Option>
				<Option value="+07:00" key="+07:00">东7区</Option>
				<Option value="+08:00" key="+08:00">东8区</Option>
				<Option value="+09:00" key="+09:00">东9区</Option>
				<Option value="+10:00" key="+10:00">东10</Option>
				<Option value="+11:00" key="+11:00">东11</Option>
				<Option value="+12:00" key="+12:00">东12</Option>
				<Option value="-01:00" key="-01:00">西1区</Option>
				<Option value="-02:00" key="-02:00">西2区</Option>
				<Option value="-03:00" key="-03:00">西3区</Option>
				<Option value="-04:00" key="-04:00">西4区</Option>
				<Option value="-04:30" key="-04:30">西4.5</Option>
				<Option value="-05:00" key="-05:00">西5区</Option>
				<Option value="-05:30" key="-05:30">西5.5</Option>
				<Option value="-06:00" key="-06:00">西6区</Option>
				<Option value="-07:00" key="-07:00">西7区</Option>
				<Option value="-07:30" key="-07:30">西7.5</Option>
				<Option value="-08:00" key="-08:00">西8区</Option>
				<Option value="-09:00" key="-09:00">西9区</Option>
				<Option value="-10:00" key="-10:00">西10</Option>
				<Option value="-11:00" key="-11:00">西11</Option>
			</Select>

		);

		return dom;
	}

	componentDidMount(){
		const el = this.rootRef ? this.rootRef.current : null;
		if(el && typeof ResizeObserver !== 'undefined'){
			try{
				this._narrowRO = createDeferredResizeObserver(this.syncNarrow);
				this._narrowRO.observe(el);
			}catch(e){ this._narrowRO = null; }
		}
		this.syncNarrow();
	}

	componentWillUnmount(){
		if(this._narrowRO){ try{ this._narrowRO.disconnect(); }catch(e){ /* ignore */ } this._narrowRO = null; }
		this._unmounted = true;
		this.scrubDetach();
	}

	// ---- 按住拖动调单位 ----
	scrubCell(unit, child){
		return (
			<div className={`xq-dt-scrub${this.state.scrubUnit === unit ? ' xq-dt-scrubbing' : ''}`} data-scrub-unit={unit} title={SCRUB_TITLE}
				onPointerDownCapture={(e)=>this.scrubDown(e, unit)} onClickCapture={this.scrubClickGuard}>
				{child}
				{this.state.scrubUnit === unit ? <span className="xq-dt-scrub-bubble" aria-hidden="true">{SCRUB_UNIT_LABEL[unit](this.datetime)}</span> : null}
			</div>
		);
	}

	scrubDown(e, unit){
		if(e.button !== 0 || this.props.disabled || this._scrub){ return; }
		const host = e.currentTarget;
		const input = host.querySelector('input');
		// 年份框正在打字 / 下拉已经展开:不接管,照常选字、选项
		if(host.querySelector('.ant-select-open') || (unit === 'y' && input && typeof document !== 'undefined' && document.activeElement === input)){ return; }
		e.preventDefault();
		this._scrub = { unit, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, acc: 0, base: this.datetime.clone(), steps: 0, active: false, host, pid: e.pointerId, emittedKey: this.keyOf(this.datetime) };
		try{ host.setPointerCapture(e.pointerId); }catch(err){ /* 不支持捕获时靠窗口监听 */ }
		window.addEventListener('pointermove', this.scrubMove);
		window.addEventListener('pointerup', this.scrubUp);
		window.addEventListener('pointercancel', this.scrubUp);
	}

	scrubMove(e){
		const s = this._scrub;
		if(!s){ return; }
		const mx = e.clientX - s.x;
		const my = e.clientY - s.y;
		s.x = e.clientX;
		s.y = e.clientY;
		if(!s.active){
			if(Math.abs(e.clientX - s.x0) < SCRUB_START_PX && Math.abs(e.clientY - s.y0) < SCRUB_START_PX){ return; }
			s.active = true;
			if(typeof document !== 'undefined' && document.body){ document.body.classList.add('xq-dt-scrub-active'); }
		}
		// 上 / 右为正;按这一下移动的距离加速
		const raw = mx - my;
		const pitch = SCRUB_PITCH[s.unit] || 8;
		s.acc += raw * (SCRUB_ACCEL[s.unit] ? scrubGain(Math.hypot(mx, my)) : 1);
		const steps = s.acc >= 0 ? Math.floor(s.acc / pitch) : Math.ceil(s.acc / pitch);
		if(steps === s.steps){ return; }
		const dt = addUnit(s.base.clone(), s.unit, steps);
		if(this.props.startTime && this.props.disablePreStartTime && dt.jdn < this.props.startTime.jdn){
			s.acc = s.steps * pitch;   // 顶到起点:不再往下累计,回拖立即生效
			return;
		}
		s.steps = steps;
		// 本格即时刷新(不等宿主);提交节流
		this.datetime = dt;
		this.changing = true;
		this.setState({ scrubUnit: s.unit, yearDraft: null, tik: this.state.tik + 1 });
		if(!this._scrubTimer){
			this._scrubTimer = setTimeout(()=>{ this._scrubTimer = null; this.scrubEmit(); }, SCRUB_EMIT_MS);
		}
	}

	scrubEmit(){
		const s = this._scrub || this._scrubLast;
		const key = this.keyOf(this.datetime);
		if(!s || key === s.emittedKey){ return; }
		s.emittedKey = key;
		this.onChanged(this.datetime.clone(), { unit: s.unit, dir: s.steps > 0 ? 1 : -1 });
	}

	scrubUp(){
		const s = this._scrub;
		this.scrubDetach();
		if(!s){ return; }
		try{ s.host.releasePointerCapture(s.pid); }catch(err){ /* 已释放 */ }
		if(s.active){
			if(this._scrubTimer){ clearTimeout(this._scrubTimer); this._scrubTimer = null; }
			this._scrubLast = s;
			this.scrubEmit();   // 松手补最后一次
			this._scrubLast = null;
			// 拖完松手不再触发一次点击(否则下拉会被点开)
			this._suppressClick = true;
			setTimeout(()=>{ this._suppressClick = false; }, 0);
			if(!this._unmounted){ this.setState({ scrubUnit: null }); }
			return;
		}
		// 没拖动 = 普通点击:年份框聚焦全选,下拉展开(按下时拦了 mousedown,这里补一次)
		const input = s.host.querySelector('input');
		if(s.unit === 'y'){
			if(input){ input.focus(); if(input.select){ input.select(); } }
			return;
		}
		const sel = s.host.querySelector('.ant-select-selector');
		if(sel && typeof MouseEvent !== 'undefined'){
			sel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, view: window }));
		}
	}

	scrubClickGuard(e){
		if(this._suppressClick){ e.stopPropagation(); e.preventDefault(); }
	}

	scrubDetach(){
		this._scrub = null;
		if(this._unmounted && this._scrubTimer){ clearTimeout(this._scrubTimer); this._scrubTimer = null; }
		if(typeof window !== 'undefined'){
			window.removeEventListener('pointermove', this.scrubMove);
			window.removeEventListener('pointerup', this.scrubUp);
			window.removeEventListener('pointercancel', this.scrubUp);
		}
		if(typeof document !== 'undefined' && document.body){ document.body.classList.remove('xq-dt-scrub-active'); }
	}

	syncNarrow(){
		if(this._unmounted){ return; }
		const el = this.rootRef ? this.rootRef.current : null;
		if(!el){ return; }
		const w = el.clientWidth;
		const narrow = w > 0 && w < NARROW_ROW_WIDTH;
		if(narrow !== this.state.narrow){ this.setState({ narrow }); }
	}

	genMdDom(){
		let doms = []
		if(this.props.onlyYear){
			if(this.props.needZone){
				let zone = this.genZone();
				let zdom = (
					<Col key="dts-zone-only" lg={8} xl={8}>
						{zone}
					</Col>
				);
				return zdom;
			}else{
				return null;
			}
		}else if(this.props.yearMonth){
			let month = this.genMonth();
			let m = (
				<Col key="dts-month-ym" lg={12} xl={8}>
					{month}
				</Col>
			);	
			doms.push(m);
			return doms;
		}


		const mdXl = this.state.narrow ? 12 : 6;
		let month = this.genMonth();
		let m = (
			<Col key="dts-month" lg={12} xl={mdXl}>
				{month}
			</Col>
		);

		let date = this.genDate()
		let d = (
			<Col key="dts-date" lg={12} xl={mdXl}>
				{date}
			</Col>
		);

		doms.push(m);
		doms.push(d);

		return doms;
	}

	genTmDom(){
		let doms = []
		if(this.props.showTime === false || this.props.onlyYear || this.props.yearMonth){
			return null;
		}
		// showZone / showSeconds(缺省 true=现状):宿主的请求只到分、时区随本命时(波斯向运「推运时间」行),
		// 这两列拨了零后果且显示值回弹 → 由宿主显式关掉;列宽按实际列数均分。
		const showZone = this.props.showZone !== false;
		const showSeconds = this.props.showSeconds !== false;
		const count = 2 + (showZone ? 1 : 0) + (showSeconds ? 1 : 0);
		const xl = this.state.narrow ? 12 : Math.floor(24 / count);

		let zn = this.genZone();
		let zone = (
			<Col key="dts-zone" lg={12} xl={xl}>
				{zn}
			</Col>
		);
		
		let hour = this.genHour();
		let h = (
			<Col key="dts-hour" lg={12} xl={xl}>
				{hour}
			</Col>
		);

		let minu = this.genMinute();
		let m = (
			<Col key="dts-minute" lg={12} xl={xl}>
				{minu}
			</Col>
		);
		
		let sec = this.genSecond();
		let s = (
			<Col key="dts-second" lg={12} xl={xl}>
				{sec}
			</Col>
		);
		
		if(showZone){ doms.push(zone); }
		doms.push(h);
		doms.push(m);
		if(showSeconds){ doms.push(s); }
		
		return doms;
	}

	genTimeTypeDom(){
		let dom = (
			<Select style={{width: '100%'}}
				value={this.state.timeType} 
				size='small' 
				onChange={this.changeTimeType}>
				<Option value='y'>年</Option>
				<Option value='M'>月</Option>
				<Option value='d'>天</Option>
				<Option value='h'>小时</Option>
				<Option value='m'>四分钟</Option>
			</Select>
		);
		if(this.props.showTime === false && !this.props.onlyYear && !this.props.yearMonth){
			// 只显示日期(如通书择日):步进只给 年 / 月 / 天 —— 小时 / 四分钟改的是看不见的时刻,对日期无用
			dom = (
				<Select style={{width: '100%'}}
					value={['y', 'M', 'd'].indexOf(this.state.timeType) >= 0 ? this.state.timeType : 'd'}
					size='small'
					onChange={this.changeTimeType}>
					<Option value='y'>年</Option>
					<Option value='M'>月</Option>
					<Option value='d'>天</Option>
				</Select>
			);
		}
		if(this.props.onlyYear){
			dom = (
				<Select style={{width: '100%'}}
					value={this.state.timeType} 
					size='small' 
					onChange={this.changeTimeType}>
					<Option value='y'>年</Option>
				</Select>
			);
		}else if(this.props.onlyMonthAdjust || this.props.yearMonth){
			dom = (
				<Select style={{width: '100%'}}
					value={this.state.timeType} 
					size='small' 
					onChange={this.changeTimeType}>
					<Option value='y'>年</Option>
					<Option value='M'>月</Option>
				</Select>
			);
		}

		return dom;
	}

	genAdjustDom(){
		// 行宽 <270 时 ⊖/选择/⊕ 一行、此刻/确定 折第二行(span 总和 >24 antd 自动换行),选择框才放得下「四分钟」。
		const narrow = !!(this.state && this.state.narrow);
		let timetypedom = this.genTimeTypeDom();
		let row = (
			<Row>
				<Col span={narrow ? 4 : 4}>
					<Button iconName='minus' onClick={this.clickMinus} style={{width: '100%'}} />
				</Col>
				<Col span={narrow ? 10 : 6}>
					{timetypedom}
				</Col>
				<Col span={narrow ? 4 : 4}>
					<Button iconName='plus' onClick={this.clickPlus} style={{width: '100%'}} />
				</Col>
				<Col span={narrow ? 12 : 5}>
					<Button onClick={this.clickNow} style={{width: '100%'}}>
						<span>此刻</span>
					</Button>
				</Col>
				<Col span={narrow ? 12 : 5}>
					<Button onClick={this.clickOk} style={{width: '100%'}}>
						<span>确定</span>
					</Button>
				</Col>
			</Row>
		);
		// 紧凑时间块的步进行(adjustOnly)一律是 ⊖ / 步长 / ⊕ / 此刻 / 确定 五格(时区在单击打开的编辑器里改);
		// 只按年 / 按年月的专用排法只用在完整编辑器里
		if(this.props.adjustOnly){
			return row;
		}
		if(this.props.onlyYear){
			row = (
				<Row>
					<Col span={5}>
						<Button iconName='minus' onClick={this.clickMinus} style={{width: '100%'}} />
					</Col>
					<Col span={6}>
						{timetypedom}
					</Col>
					<Col span={5}>
						<Button iconName='plus' onClick={this.clickPlus} style={{width: '100%'}} />
					</Col>
					<Col span={8}>
						<Button onClick={this.clickOk} style={{width: '100%'}}>
							<span>确定</span>
						</Button>
					</Col>
				</Row>	
			);
		}else if(this.props.yearMonth){
			let zone = this.genZone();
			row = (
				<Row>
					<Col span={8}>
						{zone}
					</Col>
					<Col span={3}>
						<Button iconName='minus' onClick={this.clickMinus} style={{width: '100%'}} />
					</Col>
					<Col span={6}>
						{timetypedom}
					</Col>
					<Col span={3}>
						<Button iconName='plus' onClick={this.clickPlus} style={{width: '100%'}} />
					</Col>
					<Col span={4}>
						<Button onClick={this.clickOk} style={{width: '100%'}}>
							<span>确定</span>
						</Button>
					</Col>
				</Row>	
			);
		}
		return row;
	}

	render(){
		if(this.props.value){
			if(this.changing === false){
				this.datetime = this.props.value;
				if(this.props.value.value && this.props.value.value instanceof DateTime){
					this.datetime = this.props.value.value;
				}
				this.changing = false;
			}
		}

		let adspan = 12;
		let yearspan = 12;

		let adspanLg = 6;
		let yearspanLg = 6

		if(this.props.onlyYear){
			adspan = 8;
			yearspan = 16
			adspanLg = 8;
			yearspanLg = 16;
			if(this.props.needZone){
				adspan = 8;
				yearspan = 8
				adspanLg = 8;
				yearspanLg = 8;	
			}
		}else if(this.props.yearMonth){
			adspan = 8;
			yearspan = 8
			adspanLg = 8;
			yearspanLg = 8;
			if(this.props.needZone){
				adspan = 12;
				yearspan = 12;
				adspanLg = 6;
				yearspanLg = 6;	
			}
		}

		if(this.state.narrow){ adspanLg = adspan; yearspanLg = yearspan; }
		let mdDom = this.genMdDom();
		let tmDom = this.genTmDom();
		let needAdjust = this.props.showAdjust ? true : false;
		let adjustDom = this.genAdjustDom();

		if(this.props.adjustOnly){
			return (
				<Row className="xq-datetime-adjust-only">
					<Col span={24}>
						{adjustDom}
					</Col>
				</Row>
			);
		}

		return (
			<Row ref={this.rootRef}>
				<Col span={24}>
					<Row>
						<Col lg={adspan} xl={adspanLg}>
							<Select size='small' 
								value={this.datetime.ad} 
								onChange={this.changeAD}
								style={{width: '100%'}}
							>
								<Option value={-1} key={-1}>BC</Option>
								<Option value={1} key={1}>AD</Option>
							</Select>
						</Col>

						<Col lg={yearspan} xl={yearspanLg}>
							{this.scrubCell('y', (
								<InputNumber
									style={{width: '100%'}}
									size='small'
									min={1}
									max={this.datetime.ad < 0 ? 12999 : 16799}
									value={this.state.yearDraft !== null ? this.state.yearDraft : this.datetime.year}
									onChange={this.stageYear}
									onBlur={this.flushYear}
									onPressEnter={this.flushYear}
									placeholder='年'
								/>
							))}
						</Col>
						{mdDom}
					</Row>
				</Col>
				{ 
					tmDom !== null && (
						<Col span={24}>
							<Row>
								{tmDom}
							</Row>
						</Col>
					)
				}
				{
					needAdjust && (
						<Col span={24}>
							{adjustDom}
						</Col>
					)
				}

			</Row>
		)
	}
}

export default DateTimeSelector;
