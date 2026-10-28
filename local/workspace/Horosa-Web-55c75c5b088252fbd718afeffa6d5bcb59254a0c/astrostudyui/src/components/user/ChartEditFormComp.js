import { Component } from 'react';
import ChartData from './ChartData';

export default class ChartEditFormComp extends Component{
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

			// 只提交有值的键:没读进表单的随盘键不以空值提交(内核也不让 undefined 盖旧值,两道保险)
			let params = {};
			for(let key in flds){
				if(flds[key] && flds[key].value !== undefined){ params[key] = flds[key].value; }
			}

			this.props.dispatch({
				type: 'user/updateChart',
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
