import { Component } from 'react';
import { Checkbox, Row, Col } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';

class ChartDisplaySelector extends Component{

	constructor(props) {
		super(props);

		this.onChange = this.onChange.bind(this);
		this.changeShowPdBounds = this.changeShowPdBounds.bind(this);
		this.changeStrongRecption = this.changeStrongRecption.bind(this);
		this.changeAstroAnnotation = this.changeAstroAnnotation.bind(this);
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

	changeShowPdBounds(checked){
		if(!this.props.dispatch){
			return;
		}
		const val = checked ? 1 : 0;
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
		this.props.dispatch({
			type: 'astro/fetchByFields',
			payload: flds,
		});
	}

	changeStrongRecption(checked){
		if(!this.props.dispatch){
			return;
		}
		const val = checked ? 1 : 0;
		let flds = {
			...(this.props.fields || {}),
		};
		if(!flds.strongRecption){
			flds.strongRecption = {
				value: val,
				name: ['strongRecption'],
			};
		}else{
			flds.strongRecption.value = val;
		}
		this.props.dispatch({
			type: 'astro/save',
			payload:{
				fields: flds,
			},
		});
		this.props.dispatch({
			type: 'astro/fetchByFields',
			payload: flds,
		});
	}

	changeAstroAnnotation(checked){
		if(!this.props.dispatch){
			return;
		}
		this.props.dispatch({
			type: 'app/save',
			payload: {
				showAstroAnnotation: checked ? 1 : 0,
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
		const showPdBounds = !(this.props.showPdBounds === 0 || this.props.showPdBounds === false);
		const strongRecption = !!(this.props.fields && this.props.fields.strongRecption && this.props.fields.strongRecption.value === 1);
		const showAstroAnnotation = this.props.showAstroAnnotation === 1;
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
							显示星曜主宰宫
						</Checkbox>
					</Col>
				</Row>
				<Row gutter={12} style={{marginTop: 14}}>
					<Col span={24}>
						<Checkbox
							checked={showPdBounds}
							onChange={(e)=>this.changeShowPdBounds(e.target.checked)}
						>
							主/界限法显示界限法
						</Checkbox>
					</Col>
					<Col span={24}>
						<Checkbox
							checked={strongRecption}
							onChange={(e)=>this.changeStrongRecption(e.target.checked)}
						>
							仅按照本垣擢升计算互容接纳
						</Checkbox>
					</Col>
					<Col span={24}>
						<Checkbox
							checked={showAstroAnnotation}
							onChange={(e)=>this.changeAstroAnnotation(e.target.checked)}
						>
							显示星/宫/座/相释义
						</Checkbox>
					</Col>
				</Row>
			</div>
		);
	}
}

export default ChartDisplaySelector;
