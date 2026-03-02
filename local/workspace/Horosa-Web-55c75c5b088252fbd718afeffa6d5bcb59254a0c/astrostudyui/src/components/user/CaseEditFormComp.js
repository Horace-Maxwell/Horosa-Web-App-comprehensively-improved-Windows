import { Component } from 'react';
import CaseData from './CaseData';

export default class CaseEditFormComp extends Component{
	constructor(props) {
		super(props);
		this.clickOk = this.clickOk.bind(this);
		this.clickReturn = this.clickReturn.bind(this);
	}

	clickOk(flds){
		if(this.props.dispatch){
			const vals = {
				currentCase: {
					...flds,
				},
			};
			this.props.dispatch({
				type: 'user/save',
				payload: vals,
			});
			const params = {};
			for(const key in flds){
				params[key] = flds[key].value;
			}
			this.props.dispatch({
				type: 'user/updateCase',
				payload: params,
			});
		}
	}

	clickReturn(){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caselist',
				},
			});
		}
	}

	render(){
		return (
			<div>
				<CaseData
					fields={this.props.fields}
					okTitle='提交'
					returnTitle='返回列表'
					onOk={this.clickOk}
					onReturn={this.clickReturn}
				/>
			</div>
		);
	}
}

