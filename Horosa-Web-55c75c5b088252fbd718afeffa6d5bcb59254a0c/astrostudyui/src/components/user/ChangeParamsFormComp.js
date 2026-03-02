import { Component } from 'react';
import { Row, Col, } from 'antd';
import ChartFormData from '../comp/ChartFormData';

export default class ChangeParamsFormComp extends Component{
	constructor(props) {
		super(props);

		this.clickOk = this.clickOk.bind(this);
	}

	clickOk(flds){
		if(this.props.dispatch){
			let vals = {
				fields: {
					...flds,
				}
			}
			this.props.dispatch({
				type: 'astro/save',
				payload: vals,
			});

			let params = {};
			for(let key in flds){
				params[key] = flds[key].value;
			}

			this.props.dispatch({
				type: 'user/changeParams',
				payload: params,
			});
		}

	}


	render(){

		return (
			<div>
				<ChartFormData 
					fields={this.props.fields}
					okTitle='提交'
					needDate={false}
					onOk={this.clickOk}
				/>
			</div>
		)
	}
}
