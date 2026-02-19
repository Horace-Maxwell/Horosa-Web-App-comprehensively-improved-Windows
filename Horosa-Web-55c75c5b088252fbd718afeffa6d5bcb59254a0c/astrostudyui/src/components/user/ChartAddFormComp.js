import { Component } from 'react';
import { Row, Col, Table, Popconfirm, Button,  Input, Select, Pagination, Modal } from 'antd';
import ChartData from './ChartData';

export default class ChartAddFormComp extends Component{
	constructor(props) {
		super(props);

		this.clickOk = this.clickOk.bind(this);
		this.clickReturn = this.clickReturn.bind(this);
	}

	clickOk(flds){
		if(this.props.dispatch){
			let vals = {
				currentChart: {
					...flds,
				}
			}
			this.props.dispatch({
				type: 'user/save',
				payload: vals,
			});

			let params = {};
			for(let key in flds){
				params[key] = flds[key].value;
			}

			this.props.dispatch({
				type: 'user/addChart',
				payload: params,
			});
		}

	}

	clickReturn(){
		if(this.props.dispatch){
			this.props.dispatch({
                type: 'astro/openDrawer',
                payload: {
					key: 'chartlist'
				},
			});
		}

	}

	render(){

		return (
			<div>
				<ChartData 
					fields={this.props.fields}
					okTitle='提交'
					returnTitle='返回列表'
					onOk={this.clickOk}
					onReturn={this.clickReturn}
				/>
			</div>
		)
	}
}
