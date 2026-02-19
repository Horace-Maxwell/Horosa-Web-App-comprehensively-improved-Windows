import { Component } from 'react';
import { Checkbox, Row, Col, Select } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';

const Option = Select.Option;

class ChartDisplaySelector extends Component{

	constructor(props) {
		super(props);

		this.onChange = this.onChange.bind(this);
		this.changeShowPdBounds = this.changeShowPdBounds.bind(this);
	}

	onChange(checkedValues){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'app/save',
				payload:{ 
					chartDisplay: checkedValues,
				},
			});		

		}
	}

	changeShowPdBounds(val){
		if(!this.props.dispatch){
			return;
		}
		this.props.dispatch({
			type: 'app/save',
			payload:{
				showPdBounds: val,
			},
		});

		let flds = {
			...(this.props.fields || {}),
		};
		if(!flds.showPdBounds){
			flds.showPdBounds = {
				value: val,
				name: ['showPdBounds'],
			};
		}else{
			flds.showPdBounds.value = val;
		}
		this.props.dispatch({
			type: 'astro/save',
			payload:{
				fields: flds,
			},
		});
	}

	render(){
		let allobjs = AstroConst.CHART_OPTIONS.map((opt, idx)=>{
			return (
				<Col span={24} key={opt}>
					<Checkbox value={opt} style={{fontFamily: AstroConst.AstroFont}}>
						{AstroText.ChartOptionText[opt+'']}
					</Checkbox>
				</Col>
			);
		});

		return (
			<div>
				<Checkbox.Group 
					style={{ width: '100%' }} 
					onChange={this.onChange}
					value={this.props.value}
				>
					<Row gutter={12}>
						{allobjs}
					</Row>
				</Checkbox.Group>
				<Row gutter={12} style={{marginTop: 14}}>
					<Col span={24}>主/界限法显示界限法：</Col>
					<Col span={24}>
						<Select
							value={this.props.showPdBounds === 0 ? 0 : 1}
							onChange={this.changeShowPdBounds}
							style={{width: '100%'}}
						>
							<Option value={1}>是</Option>
							<Option value={0}>否</Option>
						</Select>
					</Col>
				</Row>
			</div>
		);
	}
}

export default ChartDisplaySelector;
