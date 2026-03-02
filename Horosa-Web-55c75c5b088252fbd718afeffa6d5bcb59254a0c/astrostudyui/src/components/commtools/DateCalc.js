import { Component } from 'react';
import { Row, Col, Button, Divider, Statistic, Select, Input, Modal, InputNumber } from 'antd';
import { randomStr, isNumber } from '../../utils/helper';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import DateTimeSelector from '../comp/DateTimeSelector';
import DateTime from '../comp/DateTime';
import NongLi from '../calendar/NongLi';
import {Week} from '../../msg/types';

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
		const result = data[Constants.ResultKey];

		const st = {
			days: result.days,
			prevDays: result.prevDays,
			dateSelected: null,
		};

		this.setState(st);
	}

    changeNum(val){
        this.setState({
            number: val,
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
        let num = this.state.type * this.state.number;
        let tmpdt = null;
        let dt = this.state.date.clone();
        if(this.tmHook.getValue){
            tmpdt = this.tmHook.getValue();
            dt = tmpdt.value;
        }
        let orgdt = dt.clone();
        dt.addDate(num);
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
