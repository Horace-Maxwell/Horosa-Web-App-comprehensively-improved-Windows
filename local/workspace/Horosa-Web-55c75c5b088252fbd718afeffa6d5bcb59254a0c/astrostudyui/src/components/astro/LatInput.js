import { Component } from 'react';
import { Select, Input, InputNumber, } from 'antd';
import { DefLat, DefGpsLat, } from '../../utils/constants';

const Option = Select.Option;
const InputGroup = Input.Group;

class LatInput extends Component{
	constructor(props) {
		super(props);
		this.state = {
			defValue: DefLat,
		};

		this.onDegreeMinChange = this.onDegreeMinChange.bind(this);
		this.onDegreeChange = this.onDegreeChange.bind(this);
		this.onDirectionChange = this.onDirectionChange.bind(this);
		this.takeParts = this.takeParts.bind(this);
	}

	takeParts(){
		let res = [];
		if(this.props.value === undefined || this.props.value === null){
			return ['n', 26, 4];
		}

		let dir = 'n';
		let parts = this.props.value.split('n');
		if(parts.length < 2){
			parts = this.props.value.split('s');
			dir = 's';
		}
		let deg = parseInt(parts[0]);
		let degmin = parts[1];
		if(deg < 0){
			deg = -deg;
			dir = 's';
		}
		if(degmin.indexOf('-') === 0){
			degmin = degmin.substr(1);
		}
		res.push(dir);
		res.push(deg);
		res.push(degmin);
		return res;
	}

	onDirectionChange(value, option){
		if(this.props.onChange){
			let val = this.state.defValue;
			let parts = this.takeParts();
			if(parts.length > 0){
				val = parts[1] + value + parts[2];
			}
			this.props.onChange(val)
		}

	}

	onDegreeMinChange(value, option){
		if(this.props.onChange){
			let val = this.state.defValue;
			let parts = this.takeParts();
			if(parts.length > 0){
				val = parts[1] + parts[0] + value;
			}
			this.props.onChange(val)	
		}
	}

	onDegreeChange(value){
		if(this.props.onChange){
			let val = this.state.defValue;
			let parts = this.takeParts();
			if(parts.length > 0){
				if(value === undefined || value === null || value === '' || isNaN(value)){
					val = '26' + parts[0] + parts[2];
				}else{
					val = value + parts[0] + parts[2];
				}
			}
			this.props.onChange(val)
		}
	}

	render(){
		let latmindom = [];
		for(let i=0; i<60; i++){
			let v = i + '';
			if(i < 10){
				v = '0' + v;
			}
			let optdom = (
				<Option value={v} key={v}>{v}</Option>
			);
			latmindom.push(optdom);
		}

		let parts = this.takeParts();
		let latdir = 'n';
		let deg = 16;
		let degmin = '04';
		if(parts.length > 0){
			latdir = parts[0];
			deg = parts[1];
			degmin = parts[2];
		}

		let size = this.props.size ? this.props.size : 'default';

		let onerow = false;
		if(this.props.oneRow){
			onerow = true;
		}

		return (
			<div>
				{
					onerow === false && (
						<Select value={latdir} onChange={this.onDirectionChange} size={size} style={{width:'80%'}}>
							<Option value='n'>北纬</Option>
							<Option value='s'>南纬</Option>
						</Select>	
					)
				}
				<InputGroup >
					{
						onerow && (
							<Select value={latdir} onChange={this.onDirectionChange} size={size}>
								<Option value='n'>北纬</Option>
								<Option value='s'>南纬</Option>
							</Select>		
						)
					}
					<InputNumber min={0} max={90} step={1} value={deg} size={size} 
						onChange={this.onDegreeChange} 
						style={{width: 70}}
					/><span>度&nbsp;&nbsp;</span>
					<Select onChange={this.onDegreeMinChange} value={degmin} size={size} style={{width: 60}}>
						{latmindom}
					</Select><span>分</span>
				</InputGroup>
			</div>
		);
	}
}

export default LatInput;
