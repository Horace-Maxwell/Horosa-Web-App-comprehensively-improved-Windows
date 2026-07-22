import React, { Component } from 'react';
import { Row, Col } from 'antd';
import { XQButton as Button, XQInputNumber as InputNumber, XQSelect as Select } from '../xq-ui';

import DateTime from './DateTime';
import { fireStepSelectPrefetch } from '../../utils/stepPrefetch';

const Option = Select.Option;

class DateTimeSelector extends Component{
	constructor(props) {
		super(props);

		let tmType = this.props.defaultTimeType ? this.props.defaultTimeType : 'm';
		if(this.props.onlyYear){
			tmType = 'y';
		}else if(this.props.yearMonth){
			tmType = 'M';
		}

		this.state = {
			timeType: tmType,
			tik: 0,
			// 年份输入草稿:输入期间不提交(旧行为每键立即重排盘,4/5 位年被打断截半,
			// 如输 7040 只吃到 70)。失焦/回车才 flush 到 changeYear。
			yearDraft: null,
		};

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

		if(this.props.hook){
			this.props.hook.getValue = ()=>{
				const res = this.getCurrentValue();
				// Keep local edit value until parent props catches up.
				this.changing = true;
				return res;
			};
		}
	}

	componentDidUpdate(){
		if(!this.changing){
			return;
		}
		const curVal = this.normalizeValue(this.props.value);
		if(curVal && this.isSameDateTime(curVal, this.datetime)){
			this.changing = false;
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
		if(this.props.onChange){
			this.props.onChange(res);
		}
		// Keep local edit value until parent props catches up.
		this.changing = true;
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
		let dt = new DateTime();
		this.onChanged(dt, { unit: this.state.timeType, dir: 0 });
	}

	changeTimeType(val){
		this.setState({
			timeType: val
		});
		// [R3-A1] 选定步长那一刻即预取前后各 2 步(opt-in 宿主:主盘/步进面 PlusMinusTime/PD;
		// 日历/表单抽屉等无关上下文不挂此 prop=零行为)。第一下点 ± 也不冷。
		if(this.props.stepSelectPrefetch){
			fireStepSelectPrefetch(val);
		}
	}

	clickMinus(){
		let ctype = this.state.timeType;
		let dt = this.datetime.clone();
		if(ctype === 'y'){
			dt.addYear(-1);
		}else if(ctype === 'M'){
			dt.addMonth(-1);
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
		let ctype = this.state.timeType;
		let dt = this.datetime.clone();
		if(ctype === 'y'){
			dt.addYear(1);
		}else if(ctype === 'M'){
			dt.addMonth(1);
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
			let val = option.props.children + '';
			let idx = val.toLowerCase().indexOf(input.toLowerCase());
			return idx >= 0;
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

		return dom;
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

		return dom;
	}

	genZone(){
		let dom = [(
			<Option value="+00:00" key="+00:00">东0区</Option>
		),(
			<Option value="+01:00" key="+01:00">东1区</Option>
		),(
			<Option value="+02:00" key="+02:00">东2区</Option>
		),(
			<Option value="+03:00" key="+03:00">东3区</Option>
		),(
			<Option value="+04:00" key="+04:00">东4区</Option>
		),(
			<Option value="+04:30" key="+04:30">东4.5</Option>
		),(
			<Option value="+05:00" key="+05:00">东5区</Option>
		),(
			<Option value="+05:30" key="+05:30">东5.5</Option>
		),(
			<Option value="+06:00" key="+06:00">东6区</Option>
		),(
			<Option value="+07:00" key="+07:00">东7区</Option>
		),(
			<Option value="+08:00" key="+08:00">东8区</Option>
		),(
			<Option value="+09:00" key="+09:00">东9区</Option>
		),(
			<Option value="+10:00" key="+10:00">东10</Option>
		),(
			<Option value="+11:00" key="+11:00">东11</Option>
		),(
			<Option value="+12:00" key="+12:00">东12</Option>
		),(
			<Option value="-01:00" key="-01:00">西1区</Option>
		),(
			<Option value="-02:00" key="-02:00">西2区</Option>
		),(
			<Option value="-03:00" key="-03:00">西3区</Option>
		),(
			<Option value="-04:00" key="-04:00">西4区</Option>
		),(
			<Option value="-04:30" key="-04:30">西4.5</Option>
		),(
			<Option value="-05:00" key="-05:00">西5区</Option>
		),(
			<Option value="-05:30" key="-05:30">西5.5</Option>
		),(
			<Option value="-06:00" key="-06:00">西6区</Option>
		),(
			<Option value="-07:00" key="-07:00">西7区</Option>
		),(
			<Option value="-07:30" key="-07:30">西7.5</Option>
		),(
			<Option value="-08:00" key="-08:00">西8区</Option>
		),(
			<Option value="-09:00" key="-09:00">西9区</Option>
		),(
			<Option value="-10:00" key="-10:00">西10</Option>
		),(
			<Option value="-11:00" key="-11:00">西11</Option>
		)];

		return dom;
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

		return dom;
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

		return dom;
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

		return dom;
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


		let month = this.genMonth();
		let m = (
			<Col key="dts-month" lg={12} xl={6}>
				{month}
			</Col>
		);

		let date = this.genDate()
		let d = (
			<Col key="dts-date" lg={12} xl={6}>
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

		let zn = this.genZone();
		let zone = (
			<Col key="dts-zone" lg={12} xl={6}>
				{zn}
			</Col>
		);
		
		let hour = this.genHour();
		let h = (
			<Col key="dts-hour" lg={12} xl={6}>
				{hour}
			</Col>
		);

		let minu = this.genMinute();
		let m = (
			<Col key="dts-minute" lg={12} xl={6}>
				{minu}
			</Col>
		);
		
		let sec = this.genSecond();
		let s = (
			<Col key="dts-second" lg={12} xl={6}>
				{sec}
			</Col>
		);
		
		doms.push(zone);
		doms.push(h);
		doms.push(m);
		doms.push(s);
		
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
		let timetypedom = this.genTimeTypeDom();
		let row = (
			<Row>
				<Col span={4}>
					<Button size='small' iconName='minus' onClick={this.clickMinus} style={{width: '100%'}} />
				</Col>
				<Col span={6}>
					{timetypedom}
				</Col>
				<Col span={4}>
					<Button size='small' iconName='plus' onClick={this.clickPlus} style={{width: '100%'}} />
				</Col>
				<Col span={5}>
					<Button size='small' onClick={this.clickNow} style={{width: '100%'}}>
						<span>此刻</span>
					</Button>
				</Col>
				<Col span={5}>
					<Button size='small' onClick={this.clickOk} style={{width: '100%'}}>
						<span>确定</span>
					</Button>
				</Col>
			</Row>
		);
		if(this.props.onlyYear){
			row = (
				<Row>
					<Col span={5}>
						<Button size='small' iconName='minus' onClick={this.clickMinus} style={{width: '100%'}} />
					</Col>
					<Col span={6}>
						{timetypedom}
					</Col>
					<Col span={5}>
						<Button size='small' iconName='plus' onClick={this.clickPlus} style={{width: '100%'}} />
					</Col>
					<Col span={8}>
						<Button size='small' onClick={this.clickOk} style={{width: '100%'}}>
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
						<Button size='small' iconName='minus' onClick={this.clickMinus} style={{width: '100%'}} />
					</Col>
					<Col span={6}>
						{timetypedom}
					</Col>
					<Col span={3}>
						<Button size='small' iconName='plus' onClick={this.clickPlus} style={{width: '100%'}} />
					</Col>
					<Col span={4}>
						<Button size='small' onClick={this.clickOk} style={{width: '100%'}}>
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
			<Row>
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
