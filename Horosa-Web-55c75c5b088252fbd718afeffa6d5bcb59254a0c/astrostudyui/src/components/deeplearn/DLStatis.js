import { Component } from 'react';
import { Statistic, Row, Col, Button, Divider } from 'antd';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';


class DLStatis extends Component{

	constructor(props) {
		super(props);

		this.state = {
			result: {},
		};

		this.requestStatis = this.requestStatis.bind(this);
		this.clickQuery = this.clickQuery.bind(this);
	}

	async requestStatis(){
		const params = {};
		const data = await request(`${Constants.ServerRoot}/deeplearn/count`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey]

		const st = {
			result: result,
		};

		this.setState(st);
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


		return (
			<div style={style}>
				<Row gutter={16}>
					<Col span={5}>
						<Statistic title='六亲数据样本数' value={this.state.result.CountSample10000} />
					</Col>
					<Col span={5}>
						<Statistic title='富贵程度样本数' value={this.state.result.CountSample20000} />
					</Col>
					<Col span={5}>
						<Statistic title='职业数据样本数' value={this.state.result.CountSample30000} />
					</Col>
					<Col span={5}>
						<Statistic title='死亡方式样本数' value={this.state.result.CountSample40000} />
					</Col>
					<Col span={4} style={{textAlign: 'center'}}>
						<Button onClick={this.clickQuery} type='primary'>查询</Button>
					</Col>
				</Row>


			</div>
		)
	}

}

export default DLStatis;
