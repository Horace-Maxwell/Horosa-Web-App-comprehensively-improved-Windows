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
		this.changePlanetMetaFlag = this.changePlanetMetaFlag.bind(this);
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

	changePlanetMetaFlag(key, checked){
		if(!this.props.dispatch){
			return;
		}
		const current = this.props.planetMetaDisplay || {};
		const next = {
			showPostnatal: current.showPostnatal === 1 ? 1 : 0,
			showHouse: current.showHouse === 1 ? 1 : 0,
			showRuler: current.showRuler === 1 ? 1 : 0,
			[key]: checked ? 1 : 0,
		};
		this.props.dispatch({
			type: 'app/save',
			payload: {
				planetMetaDisplay: next,
			},
		});
	}

	render(){
		const planetMetaDisplay = this.props.planetMetaDisplay || {};
		const showPostnatal = planetMetaDisplay.showPostnatal === 1;
		const showHouse = planetMetaDisplay.showHouse === 1;
		const showRuler = planetMetaDisplay.showRuler === 1;
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
					<Col span={24}>星曜附加信息：</Col>
					<Col span={24}>
						<Checkbox
							checked={showPostnatal}
							onChange={(e)=>this.changePlanetMetaFlag('showPostnatal', e.target.checked)}
						>
							显示后天宫位
						</Checkbox>
					</Col>
					<Col span={24}>
						<Checkbox
							checked={showHouse}
							disabled={!showPostnatal}
							onChange={(e)=>this.changePlanetMetaFlag('showHouse', e.target.checked)}
						>
							显示星曜宫位
						</Checkbox>
					</Col>
					<Col span={24}>
						<Checkbox
							checked={showRuler}
							disabled={!showPostnatal}
							onChange={(e)=>this.changePlanetMetaFlag('showRuler', e.target.checked)}
						>
							显示星曜主宰星
						</Checkbox>
					</Col>
				</Row>
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
