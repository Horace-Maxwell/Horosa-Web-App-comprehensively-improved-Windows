import { Component } from 'react';
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
			// 透传非表单字段：模块特殊设置(payload)与来源标记(sourceModule/chartType)随命盘存档。
			// 占星正常新增命盘时这些恒为 null/undefined → 行为逐字节不变；仅当其他模块(如奇门)注入 payload 时生效。
			if(this.props.fields){
				if(this.props.fields.payload){ params.payload = this.props.fields.payload.value; }
				if(this.props.fields.sourceModule){ params.sourceModule = this.props.fields.sourceModule.value; }
				if(this.props.fields.chartType){ params.chartType = this.props.fields.chartType.value; }
				// 「存为命盘」(按当前盘新建)记当前所见;其余新增按新命盘缺省(addChart 据此分)
				if(this.props.fields.fromCurrent){ params.fromCurrent = !!this.props.fields.fromCurrent.value; }
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
