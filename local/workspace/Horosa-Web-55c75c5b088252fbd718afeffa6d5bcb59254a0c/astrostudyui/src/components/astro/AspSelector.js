import { Component } from 'react';
import { Checkbox, Row, Col, Tabs, Divider } from 'antd';
import {randomStr} from '../../utils/helper';
import * as AstroHelper from './AstroHelper';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';

const TabPane = Tabs.TabPane;


class AspSelector extends Component{

	constructor(props) {
		super(props);

		this.onChange = this.onChange.bind(this);
	}

	onChange(checkedValues){
		let json = JSON.stringify(checkedValues);
		localStorage.setItem(AstroConst.AspKey, json);
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'app/save',
				payload:{ 
					aspects: checkedValues,
				},
			});		

		}
	}

	render(){
		let allobjs = AstroConst.LIST_ASP.map((item, idx)=>{
			return (
				<Col span={24} key={item}>
					<Checkbox value={item}>
						<span>{AstroText.AstroTxtMsg[item]}</span>
						<span style={{fontFamily: AstroConst.AstroFont}}>{'（' + AstroText.AstroMsg[item] + '）'}</span>
					</Checkbox>
				</Col>
			);
		});

		let val = localStorage.getItem(AstroConst.AspKey);
		if(val === undefined || val === null){
			val = AstroConst.DEFAULT_ASPECTS;
			localStorage.setItem(AstroConst.AspKey, JSON.stringify(val));
		}else{
			val = JSON.parse(val);
		}

		return (
			<div>
				<Checkbox.Group 
					style={{ width: '100%' }} 
					onChange={this.onChange}
					value={val}
				>
					<Row gutter={12}>
						{allobjs}
					</Row>
				</Checkbox.Group>
			</div>
		);
	}
}

export default AspSelector;
