import { Component } from 'react';
import { XQInputNumber as InputNumber, XQSelect as Select } from '../xq-ui';
import { DefLat } from '../../utils/constants';

const Option = Select.Option;
const inputGroupStyle = { display: 'flex', alignItems: 'center', gap: 6 };

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
		if(parts.length < 2){
			// 值里既无 n 也无 s(畸形输入) → 回默认,防 parts[1] 取 undefined 抛错
			return ['n', 26, 4];
		}
		let deg = parseInt(parts[0]);
		if(isNaN(deg)){ deg = 0; }
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
				// [Q-426/T-392] 度数已到上限 90° 时分只能是 00。
				val = parts[1] + parts[0] + (Number(parts[1]) >= 90 ? '00' : value);
			}
			this.props.onChange(val)	
		}
	}

	onDegreeChange(value){
		if(this.props.onChange){
			let val = this.state.defValue;
			let parts = this.takeParts();
			if(parts.length > 0){
				// [Q-426/T-392] 清空度数框保留原度数(此前写回固定 26°);度数达上限 90° 时分钳为 00(否则可组合出 90°59′ 越界坐标)。
				if(value === undefined || value === null || value === '' || isNaN(value)){
					val = parts[1] + parts[0] + parts[2];
				}else{
					const d = Math.max(0, Math.min(90, Number(value)));
					val = d + parts[0] + (d >= 90 ? '00' : parts[2]);
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
		let deg = 26;   // [Q-426] 渲染兜底与取值兜底(26)一致
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
			<div className={onerow ? 'horosa-lat-input horosa-geo-inline-input' : 'horosa-lat-input'}>
				{
					onerow === false && (
						<Select value={latdir} onChange={this.onDirectionChange} size={size} style={{width:'80%'}}>
							<Option value='n'>北纬</Option>
							<Option value='s'>南纬</Option>
						</Select>	
					)
				}
				<div className="horosa-geo-inline-row" style={inputGroupStyle}>
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
					/><span className="horosa-geo-unit">度</span>
					<Select onChange={this.onDegreeMinChange} value={degmin} size={size} style={{width: 60}}>
						{latmindom}
					</Select><span className="horosa-geo-unit">分</span>
				</div>
			</div>
		);
	}
}

export default LatInput;
