import { Component } from 'react';
import { Row, Col, Button, Divider, Select, InputNumber, message} from 'antd';
import { randomStr, isNumber } from '../../utils/helper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import {BaziMonthTime, SixtyJiaZi} from '../../constants/ZWConst';
import MainDirectionSimple from '../cntradition/MainDirectionSimple';

const { Option } = Select;

const BaziInverseKey = 'baziInverse';

export default class InverseBazi extends Component{
	constructor(props) {
		super(props);

        let json = localStorage.getItem(BaziInverseKey);
        let st = {};
        if(json){
            try{
                st = JSON.parse(json);
            }catch(e){

            }
        }

        this.state = {
            year: st.year,
            month: st.month,
            date: st.date,
            time: st.time,
            desc: 1,
            count: 1,
            fromYear: null,
            gender: 1,
            dates: [],
            paibazi: null,
        }

        this.requestDates = this.requestDates.bind(this);
        this.genDom = this.genDom.bind(this);
        this.changeYear = this.changeYear.bind(this);
        this.changeMonth = this.changeMonth.bind(this);
        this.changeDate = this.changeDate.bind(this);
        this.changeTime = this.changeTime.bind(this);
        this.changeCount = this.changeCount.bind(this);
        this.changeDesc = this.changeDesc.bind(this);
        this.changeFromYear = this.changeFromYear.bind(this);
        this.changeGender = this.changeGender.bind(this);

        this.genMonthOptions = this.genMonthOptions.bind(this);
        this.genTimeOptions = this.genTimeOptions.bind(this);

        this.saveState = this.saveState.bind(this);
    }

    saveState(){
        let json = JSON.stringify(this.state);
        localStorage.setItem(BaziInverseKey, json);
    }

	async requestDates(){
        let st = this.state;
        if(st.year === undefined || st.year === null){
            message.error('年柱不能为空');
            return;
        }
        if(st.month === undefined || st.month === null){
            message.error('月柱不能为空');
            return;
        }
        if(st.date === undefined || st.date === null){
            message.error('日柱不能为空');
            return;
        }
        if(st.time === undefined || st.time === null){
            message.error('时柱不能为空');
            return;
        }

        let params = {
            Year: st.year,
            Month: st.month,
            Date: st.date,
            Time: st.time,
            Count: st.count,
            Desc: st.desc,
            FromYear: st.fromYear,
        }


		const data = await request(`${Constants.ServerRoot}/common/inversebazi`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey];
        let dates = result.Dates;
        let dtparts = dates[0].split(' ');

        let bzparams = {
            date: dtparts[0],
            time: dtparts[1],
            gender: this.state.gender,
            zone: '+08:00',
            lon: '119e19',
            lat: '26n04',
        };

        const pbzres = await request(`${Constants.ServerRoot}/bazi/direct`, {
			body: JSON.stringify(bzparams),
		});

		this.setState({
            dates: result.Dates,
            paibazi: pbzres[Constants.ResultKey],
        });
	}

    changeYear(val){
        this.setState({
            year: val,
            month: null,
            paibazi: null,
            dates: [],
        }, ()=>{
            this.saveState();
        });
    }

    changeMonth(val){
        this.setState({
            month: val,
            paibazi: null,
            dates: [],
        }, ()=>{
            this.saveState();
        });
    }

    changeDate(val){
        this.setState({
            date: val,
            time: null,
            paibazi: null,
            dates: [],
        }, ()=>{
            this.saveState();
        });
    }

    changeTime(val){
        this.setState({
            time: val,
        }, ()=>{
            this.saveState();
        });
    }

    changeDesc(val){
        this.setState({
            desc: val,
        });
    }

    changeCount(val){
        this.setState({
            count: val,
        });
    }

    changeFromYear(val){
        this.setState({
            fromYear: val == 0 ? -1 : val,
        });
    }

    changeGender(val){
        this.setState({
            gender: val,
            paibazi: null,
        });
    }

    genDom(){
        let cols = this.state.dates.map((item, idx)=>{
            return (
                <Col span={24} key={randomStr(8)}>
                    <span>{item}</span>
                </Col>
            )
        });
        let bzdir = null;
        if(this.state.paibazi){
            let dirHeight = 550;
            bzdir = (
                <MainDirectionSimple value={this.state.paibazi.bazi} height={dirHeight} />
            )
        }
        let res = (
            <div>
                <Row gutter={6} style={{marginBottom: 10}}>{cols}</Row>
                {bzdir}
            </div>
        );

        return res;
    }

    genMonthOptions(){
        let year = this.state.year;
        if(year === undefined || year === null){
            return null;
        }
        let gan = year.substr(0, 1);
        let monthes = BaziMonthTime.month[gan];
        let opts = monthes.map((item, idx)=>{
            return (
                <Option key={randomStr(8)} value={item}>{item}</Option>
            );
        })
        return opts;
    }

    genTimeOptions(){
        let date = this.state.date;
        if(date === undefined || date === null){
            return null;
        }
        let gan = date.substr(0, 1);
        let times = BaziMonthTime.time[gan];
        let opts = times.map((item, idx)=>{
            return (
                <Option key={randomStr(8)} value={item}>{item}</Option>
            );
        })
        return opts;
    }

    componentDidMount(){
        let dt = new Date();
        this.setState({
            fromYear: dt.getFullYear(),
        })
    }

    render(){
        let dom = this.genDom();
        let yopts = SixtyJiaZi.map((item, idx)=>{
            return (
                <Option key={randomStr(8)} value={item}>{item}</Option>
            )
        });
        let dopts = SixtyJiaZi.map((item, idx)=>{
            return (
                <Option key={randomStr(8)} value={item}>{item}</Option>
            )
        });
        let mopts = this.genMonthOptions();
        let topts = this.genTimeOptions();

        return (
            <div>
                <Row gutter={12}>
                    <Col span={6}>年柱</Col>
                    <Col span={6}>月柱</Col>
                    <Col span={6}>日柱</Col>
                    <Col span={6}>时柱</Col>
                </Row>
                <Row gutter={12}>
                    <Col span={6}>
                        <Select 
                            style={{width: '100%'}}
                            showSearch
                            allowClear
                            value={this.state.year}
                            placeholder='年柱'
                            onChange={this.changeYear}
                            filterOption={(input, option) => {
                                return option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0
                            }}
                        >
                            {yopts}
                        </Select>
                    </Col>
                    <Col span={6}>
                        <Select 
                            style={{width: '100%'}}
                            showSearch
                            allowClear
                            value={this.state.month}
                            placeholder='月柱'
                            onChange={this.changeMonth}
                            filterOption={(input, option) => {
                                return option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0
                            }}
                        >
                            {mopts}
                        </Select>
                    </Col>
                    <Col span={6}>
                        <Select 
                            style={{width: '100%'}}
                            showSearch
                            allowClear
                            value={this.state.date}
                            placeholder='日柱'
                            onChange={this.changeDate}
                            filterOption={(input, option) => {
                                return option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0
                            }}
                        >
                            {dopts}
                        </Select>
                    </Col>
                    <Col span={6}>
                        <Select 
                            style={{width: '100%'}}
                            showSearch
                            allowClear
                            value={this.state.time}
                            placeholder='时柱'
                            onChange={this.changeTime}
                            filterOption={(input, option) => {
                                return option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0
                            }}
                        >
                            {topts}
                        </Select>
                    </Col>
                </Row>
                <Row gutter={12} style={{marginTop: 20}}>
                    <Col span={6}>启始年份</Col>
                    <Col span={6}>查找方向</Col>
                    <Col span={6}>结果时间数量</Col>
                    <Col span={6}></Col>
                </Row>
                <Row gutter={12} style={{marginBottom: 20}}>
                    <Col span={6}>
                        <InputNumber style={{width: '100%'}} 
                            value={this.state.fromYear} 
                            onChange={this.changeFromYear}
                            placeholder='启始年份'
                            max={5000}
                            min={-5000}
                            step={1}
                        />
                    </Col>
                    <Col span={6}>
                        <Select value={this.state.desc} onChange={this.changeDesc} style={{width: '100%'}}>
                            <Option value={1}>向前查</Option>
                            <Option value={0}>向后查</Option>
                        </Select>
                    </Col>
                    <Col span={6}>
                        <InputNumber style={{width: '100%'}} 
                            value={this.state.count} 
                            onChange={this.changeCount}
                            placeholder='结果时间数量'
                            max={3}
                            mix={1}
                            step={1}
                        />
                    </Col>
                    <Col span={3}>
                        <Select value={this.state.gender} onChange={this.changeGender} style={{width: '100%'}}>
                            <Option value={0}>女</Option>
                            <Option value={1}>男</Option>
                        </Select>
                    </Col>
                    <Col span={3}>
                        <Button type='primary' onClick={this.requestDates}>查找</Button>
                    </Col>
                </Row>
                <Divider orientation='left'>结果时间与第一个时间的大运概略：</Divider>
                {dom}
            </div>
        )
    }
}