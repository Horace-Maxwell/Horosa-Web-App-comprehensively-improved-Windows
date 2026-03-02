import { Component } from 'react';
import { Row, Col, Button, Divider, Statistic, Select, Input, InputNumber } from 'antd';
import { randomStr, isNumber } from '../../utils/helper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';

const Option = Select.Option;
const InputGroup = Input.Group;

class CoordTrans extends Component{
	constructor(props) {
		super(props);

		this.state = {
			lat: 0,
			lon: 0,
			coordType: -1,
			result: {
				lat: 0,
				lon: 0,
			}
		}

		this.changeCoordType = this.changeCoordType.bind(this);
		this.changeLat = this.changeLat.bind(this);
		this.changeLon = this.changeLon.bind(this);
		this.requestCalc = this.requestCalc.bind(this);
	}

	async requestCalc(){
		let params = {
			lat: this.state.lat,
			lon: this.state.lon,
			type: this.state.coordType,
		}

		const data = await request(`${Constants.ServerRoot}/calc/cotrans`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey]

		const st = {
			result: result,
		};

		this.setState(st);
	}

	changeLat(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		if(typeof val === 'string' && !isNumber(val)){
			return;
		}
		this.setState({
			lat: val,
		})
	}

	changeLon(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		if(typeof val === 'string' && !isNumber(val)){
			return;
		}
		this.setState({
			lon: val,
		})		
	}

	changeCoordType(val){
		if(val === undefined || val === null || val === ''){
			return;
		}
		this.setState({
			coordType: val,
		})		
	}


	render(){
		let restxt = '赤道坐标';
		let lattxt = '赤纬';
		let lontxt = '赤经';
		if(this.state.coordType === 1){
			restxt = '黄道坐标';
			lattxt = '黄纬';
			lontxt = '黄经';
		}

		let londeg = Math.round(this.state.result.lon * 1000) / 1000 + 'º';
		let latdeg = Math.round(this.state.result.lat * 1000) / 1000 + 'º';

		return (
			<div>
				<Row>
					<Col span={6}>
						<Select value={this.state.coordType} onChange={this.changeCoordType}>
							<Option value={-1}>黄道坐标</Option>
							<Option value={1}>赤道坐标</Option>
						</Select>
					</Col>
					<Col span={9}>
						<InputGroup >
							<span>经：</span>
							<InputNumber min={0} max={360} step={0.001} value={this.state.lon} 
								onChange={this.changeLon} 
								style={{width: 120}}
							/><span>度</span>
						</InputGroup>
					</Col>
					<Col span={9}>
						<InputGroup >
							<span>纬：</span>
							<InputNumber min={-90} max={90} step={0.001} value={this.state.lat} 
								onChange={this.changeLat} 
								style={{width: 120}}
							/><span>度</span>
						</InputGroup>
					</Col>
				</Row>
				<Row style={{marginTop: 20}}>
					<Col offset={18} span={6}>
						<Button type='primary' onClick={this.requestCalc}>计算</Button>
					</Col>
				</Row>

				<Divider orientation='left'  style={{marginTop: 20}}>{restxt}</Divider>
				<Row style={{marginTop: 20}}>
					<Col span={12}>
						<Statistic title={lontxt} value={londeg} />
					</Col>
					<Col span={12}>
						<Statistic title={lattxt} value={latdeg} />
					</Col>
				</Row>

			</div>
		)
	}
}

export default CoordTrans;
