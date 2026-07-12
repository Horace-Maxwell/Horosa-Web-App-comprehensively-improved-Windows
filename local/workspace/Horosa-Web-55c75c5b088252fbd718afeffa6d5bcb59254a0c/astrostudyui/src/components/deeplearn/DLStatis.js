import { Component } from 'react';
import { Statistic, Row, Col } from 'antd';
import { XQButton as Button } from '../xq-ui';
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
		try{
			const data = await request(`${Constants.ServerRoot}/deeplearn/count`, {
				body: JSON.stringify(params),
			});
			if(!this._mounted) return;
			if(!data){ return; }   // 空载荷守卫:request() 吞错 resolve undefined(网络层失败),此次不更新、重试即恢复
			const result = data[Constants.ResultKey]

			const st = {
				result: result,
			};

			this.setState(st);
		}catch(e){
			// 统计接口失败仅告警，保持空数据不崩
			console.warn(e);
		}
	}

	clickQuery(){
		this.requestStatis();
	}

	componentDidMount(){
		this._mounted = true;
		this.requestStatis();
	}

	componentWillUnmount(){
		this._mounted = false;
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
