import { Component } from 'react';
import { Row, Col, Button, Divider, } from 'antd';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import DateTimeSelector from '../comp/DateTimeSelector';
import { convertLonToStr, convertLatToStr } from '../astro/AstroHelper';
import { randomStr, } from '../../utils/helper';
import DateTime from '../comp/DateTime';
import NongLi from './NongLi';
import GuaChartDiv from '../gua/GuaChartDiv';
import {Week} from '../../msg/types';


class NongLiMain extends Component{
	constructor(props) {
		super(props);
		this.state = {
			date: new DateTime(),
			gpsLon: this.props.fields.gpsLon.value,
			gpsLat: this.props.fields.gpsLat.value,
			lon: '120e00',
			lat: '0n00',
			days: [],
			prevDays: [],
			dateSelected: null,
			yearGua: null,
		};

		this.genParams = this.genParams.bind(this);
		this.requestNongli = this.requestNongli.bind(this);
		this.onTimeChanged = this.onTimeChanged.bind(this);
		this.changeGeo = this.changeGeo.bind(this);
		this.genSelectDateDom = this.genSelectDateDom.bind(this);
		this.clickDate = this.clickDate.bind(this);
		this.clickYearGua = this.clickYearGua.bind(this);
		this.requestYearGua = this.requestYearGua.bind(this);
	}

	genParams(){
		const params = {
			date: this.state.date.format('YYYY-MM-DD'),
			zone: this.state.date.zone,
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

	async requestYearGua(){
		if(this.state.dateSelected === undefined || this.state.dateSelected === null){
			return null;
		}
		let date = this.state.dateSelected;
		let gua = date.qimengYearGua;
		if(gua === undefined || gua === null){
			return;
		}

		let params = {
			name: [gua],
		}
		const data = await request(`${Constants.ServerRoot}/gua/desc`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey];

		const st = {
			yearGua: result[gua],
		};

		this.setState(st);
	}

	onTimeChanged(dt){
		this.setState({
			date: dt.value,
		}, ()=>{
			this.requestNongli();
		});
	}

	changeGeo(rec){
		this.setState({
			lat: convertLatToStr(rec.lat),
			lon: convertLonToStr(rec.lng),
			gpsLat: rec.gpsLat,
			gpsLon: rec.gpsLng,
		}, ()=>{
			this.requestNongli();
		});
	}

	clickDate(date){
		let lastdt = this.state.dateSelected;
		let lastGua = lastdt ? lastdt.qimengYearGua : null;
		let same = lastGua === date.qimengYearGua;

		this.setState({
			dateSelected: date,
		}, ()=>{
			if(!same){
				this.requestYearGua();
			}
		});
	}

	clickYearGua(){
		this.requestYearGua();
	}

	genSelectDateDom(){
		if(this.state.dateSelected === undefined || this.state.dateSelected === null){
			return null;
		}
		let date = this.state.dateSelected;
		let parts = date.birth.split(' ');
		let month = date.month + date.day;
		if(date.leap){
			month = '闰'+month;
		}

		let mt = '';
		if(date.dayInt === 1){
			mt = '朔月';
		}else if(date.dayInt === 15){
			mt = '望月';
		}

		let row = (
			<Row key={randomStr(8)}>
				<Col span={24}>
					<span>{parts[0]}</span>&nbsp;
					<span>{Week[date.dayOfWeek+'']}</span>
				</Col>
				<Col span={24}>
					<span>年纳音：{date.yearNaying}</span>
				</Col>
				<Col span={24}>
					<span>{date.year}年{month}</span>
				</Col>
				<Col span={24}>
					<span>{date.yearJieqi}年</span>&nbsp;
					<span>{date.monthGanZi}月</span>&nbsp;
					<span>{date.dayGanZi}日</span>&nbsp;					
					<span>{date.time}时</span>&nbsp;					
				</Col>
				<Col span={24}>
					(此处月干支以当天中午12点计算是否跨节气来决定。)
				</Col>
				<Col span={24}>
					<span>{date.jiedelta}，{date.chef}</span>
				</Col>
				{
					date.jieqi && (
						<Col span={24}>
							<Divider />
							<span>{date.jieqi}</span>&nbsp;
							<span>{date.jieqiTime}</span>&nbsp;
						</Col>	
					)
				}
				{
					date.jieqi && (
						<Col span={24}>
							<span>jdn:{date.jieqiJdn}</span>&nbsp;					
						</Col>	
					)
				}
				{
					date.moonTime && (
						<Col span={24}>
							<Divider />
							<span>{mt}</span>&nbsp;
							<span>{date.date}&nbsp;{date.moonTime}</span>&nbsp;
						</Col>	
					)
				}
				{
					date.moonTime && (
						<Col span={24}>
							<span>jdn：{date.moonJdn}</span>&nbsp;					
						</Col>	
					)
				}
				<Col span={24}><Divider /></Col>
				{
					date.qimengYearGua && (
						<Col span={24}>
							<Button type='link' onClick={this.clickYearGua}>奇门年卦：{date.qimengYearGua}</Button>
						</Col>	
					)
				}
				{
					this.state.yearGua && (
						<Col span={24}>
							<Row>
								<Col span={6}>
									<GuaChartDiv value={this.state.yearGua} height={30} width={40} />
								</Col>
								<Col span={18}>
									<a href={this.state.yearGua.url} target='_blank'>{this.state.yearGua.desc}</a>
								</Col>
							</Row>
						</Col>
					)
				}
			</Row>
		);


		return row;
	}

	componentDidMount(){
		this.requestNongli();
	}


	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 'calc(100% - 30px)'
		}else{
			height = height - 30;
		}

		let seldatedom = this.genSelectDateDom();

		return (
			<div>
				<Row gutter={6}>
					<Col span={16}>
						<NongLi 
							height={height}
							date={this.state.date}
							days={this.state.days}
							prevDays={this.state.prevDays}
							focusDate={this.state.date}
							onDateClick={this.clickDate}
						/>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>
								<DateTimeSelector 
									value={this.state.date}
									defaultTimeType='M'
									showTime={false}
									showAdjust={true}
									onlyMonthAdjust={true}
									onChange={this.onTimeChanged} 
								/>

							</Col>
						</Row>
						<Divider />
						{seldatedom}
					</Col>
				</Row>
			</div>
		);
	}
}

export default NongLiMain;
