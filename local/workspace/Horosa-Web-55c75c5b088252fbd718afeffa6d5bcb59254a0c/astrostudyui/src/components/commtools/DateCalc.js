import { Component } from 'react';
import { Row, Col, Divider, Statistic } from 'antd';
import { XQButton as Button, XQInputNumber as InputNumber, XQSelect as Select } from '../xq-ui';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import DateTimeSelector from '../comp/DateTimeSelector';
import DateTime from '../comp/DateTime';
import NongLi from '../calendar/NongLi';
import {Week} from '../../msg/types';

// [Q-311/T-292] 起始日 + 整数天数 → 目标 DateTime(JDN 加减;保留时分秒与时区;公元前用 ad=-1 + 正年数)
export function dateCalcTarget(orgdt, num){
	const n = Math.trunc(Number(num)) || 0;
	const destJdn = orgdt.getOnlyDateNum() + n;
	const ymd = orgdt.calDateFromJdn(destJdn);
	return new DateTime({
		ad: ymd[0] < 0 ? -1 : 1,
		year: Math.abs(ymd[0]),
		month: ymd[1],
		date: ymd[2],
		hour: orgdt.hour,
		minute: orgdt.minute,
		second: orgdt.second,
		zone: orgdt.zone,
	});
}

const { Option } = Select;

export default class DateCalc extends Component{
	constructor(props) {
		super(props);
        this.state = {
            date: new DateTime(),
            number: 0,
            type: 1,

            destDate: new DateTime(),

			lon: '120e00',
			lat: '0n00',
			days: [],
			prevDays: [],
			dateSelected: null,

        }

        this.tmHook = {
            getValue: null,
        }

		this.genParams = this.genParams.bind(this);
		this.requestNongli = this.requestNongli.bind(this);

        this.onTimeChanged = this.onTimeChanged.bind(this);
        this.onDestTimeChanged = this.onDestTimeChanged.bind(this);
        this.changeNum = this.changeNum.bind(this);
        this.changeType = this.changeType.bind(this);

        this.calculate = this.calculate.bind(this);
        this.genResultDom = this.genResultDom.bind(this);
        this.clickDate = this.clickDate.bind(this);
    }

	genParams(){
		const params = {
			date: this.state.destDate.format('YYYY-MM-DD'),
			zone: this.state.destDate.zone,
			lon: this.state.lon,
		}
		return params;
	}

	async requestNongli(){
		const params = this.genParams();

		const data = await request(`${Constants.ServerRoot}/calendar/month`, {
			body: JSON.stringify(params),
		});
		if(!data){ return; }   // 空载荷守卫:request() 吞错 resolve undefined(网络层失败),此次不更新、重试即恢复
		const result = data[Constants.ResultKey];

		const st = {
			days: result.days,
			prevDays: result.prevDays,
			dateSelected: null,
		};

		this.setState(st);
	}

    changeNum(val){
        // [Q-311/T-292 ④] 天数只收整数:小数天数曾得非法日期「1990-05-19.5」
        const n = Number(val);
        this.setState({
            number: Number.isFinite(n) ? Math.trunc(Math.abs(n)) : 0,
        });
    }

    changeType(val){
        this.setState({
            type: val,
        });
    }

	onTimeChanged(dt){
		this.setState({
			date: dt.value,
		}, ()=>{
			this.calculate();
		});
	}

    onDestTimeChanged(dt){
        let destJdn = dt.value.getOnlyDateNum();
        let jdn = this.state.date.getOnlyDateNum();
        let delta = destJdn - jdn;
        let type = delta < 0 ? -1 : 1;
        this.setState({
            type: type,
            number: Math.abs(delta),
            destDate: dt.value,
        }, ()=>{
			this.calculate();
		});
    }

    calculate(){
        const days = Math.trunc(Math.abs(Number(this.state.number))) || 0;
        let num = this.state.type * days;
        let tmpdt = null;
        let dt = this.state.date.clone();
        if(this.tmHook.getValue){
            tmpdt = this.tmHook.getValue();
            dt = tmpdt.value;
        }
        let orgdt = dt.clone();
        // [Q-311/T-292 ①②③] 目标日期 = 起始日 JDN + n → 历日(getOnlyDateNum ↔ calDateFromJdn 互逆;与反向拨目标 onDestTimeChanged 同源):
        // 此前逐月加天数(DateTime.addDate)跨 1582-10-05…14 改历段少算 10 天、公元前闰年判错,反向拨目标后又被它改写。
        // 共享 addDate(时间选择器 ±日步进)不在本页改动范围。
        dt = dateCalcTarget(orgdt, num);
        this.setState({
            destDate: dt,
            date: orgdt,
        }, ()=>{
            this.requestNongli();
        });
    }

	clickDate(date){
		this.setState({
			dateSelected: date,
		});
	}

    genResultDom(){
        let dt = this.state.destDate;
        let str = dt.format('YYYY-MM-DD');
        // [Q-309/T-315 ③] 点日历日格此前只写 dateSelected、界面零反应 → 在结果旁读出所点日(公历 + 农历 + 干支/节气,有则显)。
        const sel = this.state.dateSelected;
        if(sel && sel.birth){
            const parts = [];
            const ymd = `${sel.birth}`.split(' ')[0];
            if(ymd){ parts.push(ymd); }
            const nl = [sel.month, sel.dayInt !== undefined && sel.dayInt !== null ? sel.dayInt : sel.day].filter((x)=>x !== undefined && x !== null && x !== '').join('');
            if(nl){ parts.push(`农历${nl}`); }
            if(sel.ganzi){ parts.push(sel.ganzi); }
            if(sel.jieqi){ parts.push(sel.jieqi); }
            return `${str}　·　所点：${parts.join(' ')}`;
        }
        return str;
    }

    componentDidMount(){
        this.requestNongli();
    }

    render(){

        let height = 400;
        let title = '';
        let txt = this.genResultDom();

        return (
            <div>
                <Row>
                    <Col span={24}>
                        <DateTimeSelector 
                            value={this.state.date}
                            defaultTimeType='M'
                            showTime={false}
                            showAdjust={true}
                            onlyMonthAdjust={true}
                            onChange={this.onTimeChanged} 
                            hook={this.tmHook}
                        />
                    </Col>
                </Row>

                <Row gutter={12} style={{marginTop:20, marginBottom: 20,}}>
                    <Col span={8}>
                        <Select value={this.state.type} onChange={this.changeType} style={{ width: "100%"}}>
                            <Option value={1}>增加</Option>
                            <Option value={-1}>减少</Option>
                        </Select>
                    </Col>
                    <Col span={8}>
                        <InputNumber style={{ width: "100%"}} 
                            value={this.state.number} min={0} step={1} 
                            onChange={this.changeNum}
                        />
                    </Col>
                    <Col span={2}>
                        <span>天</span>
                    </Col>
                    <Col span={4}>
                        <Button type='primary' onClick={this.calculate}>计算</Button>
                    </Col>
                </Row>

                <Divider orientation='left'>计算结果</Divider>
                <Row gutter={12}>
                    <Col span={8}>
                        <Statistic title={title} value={txt} valueStyle={{wordBreak:'break-all', wordWrap: 'break-word'}} />
                    </Col>
                    <Col span={16}>
                        <DateTimeSelector 
                            value={this.state.destDate}
                            defaultTimeType='M'
                            showTime={false}
                            showAdjust={true}
                            onlyMonthAdjust={true}
                            onChange={this.onDestTimeChanged} 
                        />
                    </Col>
                </Row>
                <Row style={{marginTop:20}}>
                    <Col span={24}>
                        <NongLi 
							height={height}
							date={this.state.destDate}
							days={this.state.days}
							prevDays={this.state.prevDays}
                            focusDate={this.state.destDate}
							onDateClick={this.clickDate}
						/>
                    </Col>    
                </Row>

            </div>
        )
    }

}
