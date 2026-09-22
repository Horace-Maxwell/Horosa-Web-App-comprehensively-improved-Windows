import { Component } from 'react';
import { XQInputNumber as InputNumber, XQSelect as Select } from '../xq-ui';
import { DefLon } from '../../utils/constants';

const Option = Select.Option;
const inputGroupStyle = { display: 'flex', alignItems: 'center', gap: 6 };

class LonInput extends Component{
	constructor(props) {
		super(props);
		this.state = {
			defValue: DefLon,
		};

		this.onDegreeMinChange = this.onDegreeMinChange.bind(this);
		this.onDegreeChange = this.onDegreeChange.bind(this);
		this.onDirectionChange = this.onDirectionChange.bind(this);
		this.takeParts = this.takeParts.bind(this);
	}

	takeParts(){
		let res = [];
		if(this.props.value === undefined || this.props.value === null){
			return ['e', 119, 19];
		}

		let dir = 'e';
		let parts = this.props.value.split('e');
		if(parts.length < 2){
			parts = this.props.value.split('w');
			dir = 'w';
		}
		if(parts.length < 2){
			// 值里既无 e 也无 w(畸形输入) → 回默认,防 parts[1] 取 undefined 抛错
			return ['e', 119, 19];
		}
		let deg = parseInt(parts[0]);
		if(isNaN(deg)){ deg = 0; }
		let degmin = parts[1];
		if(deg < 0){
			deg = -deg;
			dir = 'w';
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
				// [Q-426/T-392] 度数已到上限 180° 时分只能是 00。
				val = parts[1] + parts[0] + (Number(parts[1]) >= 180 ? '00' : value);
			}
			this.props.onChange(val)
		}
	}

	onDegreeChange(value){
		if(this.props.onChange){
			let val = this.state.defValue;
			let parts = this.takeParts();
			if(parts.length > 0){
				// [Q-426/T-392] 清空度数框保留原度数(此前写回固定 119°);度数达上限 180° 时分钳为 00(否则可组合出 180°59′ 越界坐标)。
				if(value === undefined || value === null || value === '' || isNaN(value)){
					val = parts[1] + parts[0] + parts[2];
				}else{
					const d = Math.max(0, Math.min(180, Number(value)));
					val = d + parts[0] + (d >= 180 ? '00' : parts[2]);
				}
			}
			this.props.onChange(val)
		}
	}

	render(){
		let lonmindom = [];
		for(let i=0; i<60; i++){
			let v = i + '';
			if(i < 10){
				v = '0' + v;
			}
			let optdom = (
				<Option value={v} key={v}>{v}</Option>
			);
			lonmindom.push(optdom);
		}

		let parts = this.takeParts();
		let londir = 'e';
		let deg = 119;
		let degmin = '19';
		if(parts.length > 0){
			londir = parts[0];
			deg = parts[1];
			degmin = parts[2];
		}

		let size = this.props.size ? this.props.size : 'default';

		let onerow = false;
		if(this.props.oneRow){
			onerow = true;
		}

		return (
			<div className={onerow ? 'horosa-lon-input horosa-geo-inline-input' : 'horosa-lon-input'}>
				{
					onerow === false && (
						<Select value={londir} onChange={this.onDirectionChange} size={size} style={{width: '80%'}}>
							<Option value='e'>东经</Option>
							<Option value='w'>西经</Option>
						</Select>	
					)
				}
				<div className="horosa-geo-inline-row" style={inputGroupStyle}>
					{
						onerow && (
							<Select value={londir} onChange={this.onDirectionChange} size={size}>
								<Option value='e'>东经</Option>
								<Option value='w'>西经</Option>
							</Select>	
						)
					}
					<InputNumber min={0} max={180}  step={1} value={deg} size={size}
						onChange={this.onDegreeChange} 
						style={{width:70}}
					/><span className="horosa-geo-unit">度</span>
					<Select onChange={this.onDegreeMinChange} value={degmin} size={size} style={{width: 60}}>
						{lonmindom}
					</Select><span className="horosa-geo-unit">分</span>
				</div>
			</div>
		);
	}
}

export default LonInput;
