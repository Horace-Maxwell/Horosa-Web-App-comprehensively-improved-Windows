import { Component } from 'react';
import { Checkbox, Row, Col, Tabs, Divider, Button } from 'antd';
import {randomStr} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { getAllLines, } from './AcgHelper';



class AstroLinesSelector extends Component{

	constructor(props) {
		super(props);

		this.lines = getAllLines();
		this.lineCols = this.lines.map((itm, index)=>{
			let parts = itm.split(':');
			let planet = parts[0];
			let ang = parts[1];
			let col = (
				<Col span={6} key={itm}>
					<Checkbox value={itm} style={{fontFamily: AstroConst.AstroFont, fontSize:'150%'}}>
						{AstroText.AstroMsg[planet]}&nbsp;
						{AstroText.AstroMsg['Asp0']}&nbsp;
						{AstroText.AstroMsg[ang]}
					</Checkbox>
				</Col>
			);
			return col;
		});

		this.onChange = this.onChange.bind(this);
		this.removeAll = this.removeAll.bind(this);
		this.selectAll = this.selectAll.bind(this);

	}

	selectAll(){
		if(this.props.onChange){
			this.props.onChange(this.lines);		
		}		
	}

	removeAll(){
		if(this.props.onChange){
			this.props.onChange([]);		
		}		
	}

	onChange(checkedValues){
		if(this.props.onChange){
			this.props.onChange(checkedValues);		
		}
	}

	render(){

		return (
			<div>
				<Row>
					<Col span={12}>
						<Button onClick={this.selectAll}>全选</Button>
					</Col>
					<Col span={12}>
						<Button onClick={this.removeAll}>全部清除</Button>
					</Col>
				</Row>
				<Row style={{marginTop:10}}>
					<Col span={24}>
						<Checkbox.Group 
							style={{ width: '100%' }} 
							onChange={this.onChange}
							value={this.props.value}
						>
							<Row gutter={12}>
								{this.lineCols}
							</Row>
						</Checkbox.Group>

					</Col>
				</Row>
			</div>
		);
	}

}

export default AstroLinesSelector;

