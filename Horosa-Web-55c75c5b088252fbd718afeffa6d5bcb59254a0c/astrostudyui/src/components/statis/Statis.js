import { Component } from 'react';
import { Statistic, Row, Col, Button, Divider } from 'antd';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import PointsCluster from '../amap/PointsCluster';

class Statis extends Component{

	constructor(props) {
		super(props);

		this.state={
			result: {},
			points: [],
			limit: 1000,
		};

		this.clickQuery = this.clickQuery.bind(this);
		this.requestStatis = this.requestStatis.bind(this);
		this.requestChartsGps = this.requestChartsGps.bind(this);
	}

	async requestStatis(){
		const params = {};
		const data = await request(`${Constants.ServerRoot}/statis/count`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey]

		const st = {
			result: result,
			points: [],
		};

		this.setState(st, ()=>{
			this.requestChartsGps("0");
		});
	}

	async requestChartsGps(cid, pnts){
		const params = {
			cid: cid,
			limit: this.state.limit,
		};
		const data = await request(`${Constants.ServerRoot}/statis/chartsgps`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey];
		const sz = result.length;

		let dtpnt = pnts;
		if(dtpnt === undefined || dtpnt === null){
			dtpnt = this.state.points;
		}
		let points = dtpnt.concat(result);
		if(sz === this.state.limit){
			let last = result[sz - 1];
			this.requestChartsGps(last.cid, points);
		}else{
			this.setState({
				points: points,
			})
		}
	}

	clickQuery(){
		this.requestStatis();
	}

	componentDidMount(){
		this.requestStatis();
	}

	render(){
		let height = this.props.height ? this.props.height - 50 : 700;
		let style = {
			height: height + 'px',
			overflowY:'auto', 
			overflowX: 'hidden',
		};

		let mapHeight = height - 120;

		return (
			<div style={style}>
				<Row gutter={16}>
					<Col span={5}>
						<Statistic title='注册用户数' value={this.state.result.Users} />
					</Col>
					<Col span={5}>
						<Statistic title='日活跃连接数' value={this.state.result.OnlineClients} />
					</Col>
					<Col span={5}>
						<Statistic title='日活跃注册用户数' value={this.state.result.OnlineUsers} />
					</Col>
					<Col span={5}>
						<Statistic title='总星盘数' value={this.state.result.Charts} />
					</Col>
					<Col span={4} style={{textAlign: 'center'}}>
						<Button onClick={this.clickQuery} type='primary'>查询</Button>
					</Col>
				</Row>

				<Divider orientation='left'>星盘分布</Divider>
				<PointsCluster 
					height={mapHeight}
					value={this.state.points}
				/>
			</div>
		);
	}
}

export default Statis;
