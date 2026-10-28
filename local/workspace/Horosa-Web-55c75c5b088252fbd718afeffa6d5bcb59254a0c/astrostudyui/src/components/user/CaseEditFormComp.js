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
				currentCaseRecord: null,   // 表单值已不是原样记录(补取 / 覆盖层改走表单字段兜底;保存成功后 setCurrentCase 重设)
			};
			this.props.dispatch({
				type: 'user/save',
				payload: vals,
			});
			const params = {};
			// 只提交有值的键:没读进表单的键不以空值提交(内核也不让 undefined 盖旧值)
			for(const key in flds){
				if(flds[key] && flds[key].value !== undefined){ params[key] = flds[key].value; }
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

