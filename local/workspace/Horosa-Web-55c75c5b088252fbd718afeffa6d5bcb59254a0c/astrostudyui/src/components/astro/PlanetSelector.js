import { Component } from 'react';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { XQCheckItem, XQCheckList, XQSectionTitle, XQTabs } from '../xq-ui';
import { unavailableIn } from '../../constants/planetAvailability';

const TabPane = XQTabs.TabPane;


class PlanetSelector extends Component{

	constructor(props) {
		super(props);

		this.onChange = this.onChange.bind(this);
		this.onLotsChange = this.onLotsChange.bind(this);
		this.togglePlanet = this.togglePlanet.bind(this);
		this.toggleLot = this.toggleLot.bind(this);
	}

	renderLabel(item){
		return (
			<span>
				<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[item]}</span>
				<span>&nbsp;({AstroText.AstroTxtMsg[item]})</span>
			</span>
		);
	}

	onChange(checkedValues){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'app/save',
				payload:{ 
					planetDisplay: checkedValues,
				},
			});		

		}
	}

	onLotsChange(checkedValues){
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'app/save',
				payload:{ 
					lotsDisplay: checkedValues
				},
			});		

		}
	}

	toggleValue(values, item){
		const next = Array.isArray(values) ? values.slice(0) : [];
		const idx = next.indexOf(item);
		if(idx >= 0){
			next.splice(idx, 1);
		}else{
			next.push(item);
		}
		return next;
	}

	togglePlanet(item){
		const planetValues = Array.isArray(this.props.value) ? this.props.value : [];
		this.onChange(this.toggleValue(planetValues, item));
	}

	toggleLot(item){
		const lotValues = Array.isArray(this.props.lots) ? this.props.lots : [];
		this.onLotsChange(this.toggleValue(lotValues, item));
	}

	render(){
		const planetValues = Array.isArray(this.props.value) ? this.props.value : [];
		const lotValues = Array.isArray(this.props.lots) ? this.props.lots : [];

		// 本面板只服务西洋盘族;汉堡八虚星与七政命度点在这里勾了也画不出来(各有专属页面),
		// 故置灰并说明去处 —— 留着可见但点不动,好过让人反复点一个毫无反应的开关。
		let allobjs = AstroConst.LIST_POINTS.map((item)=>{
			const only = unavailableIn(item);
			return (
				<XQCheckItem key={item} disabled={!!only} title={only ? `本盘不绘制;请到「${only}」查看` : undefined}
					checked={!only && planetValues.includes(item)} onClick={()=>this.togglePlanet(item)}>
					{this.renderLabel(item)}
				</XQCheckItem>
			);
		});

		let lots = AstroConst.LOTS.map((item, idx)=>{
			let col = (
				<XQCheckItem key={item} checked={lotValues.includes(item)} onClick={()=>this.toggleLot(item)}>
						{this.renderLabel(item)}
				</XQCheckItem>
			);
			if(idx === 0){
				col = (
					<div key={item}>
						<XQSectionTitle>希腊点</XQSectionTitle>
						<XQCheckItem checked={lotValues.includes(item)} onClick={()=>this.toggleLot(item)}>
							{this.renderLabel(item)}
						</XQCheckItem>
					</div>
				);
			}else if(idx === 5){
				col = (
					<div key={item}>
						<XQCheckItem checked={lotValues.includes(item)} onClick={()=>this.toggleLot(item)}>
							{this.renderLabel(item)}
						</XQCheckItem>
						<XQSectionTitle>阿拉伯点</XQSectionTitle>
					</div>
				);
			}

			return col;
		});

		return (
			<div className="horosa-selector-drawer">
				<XQTabs defaultActiveKey="1" tabPosition='top'>
					<TabPane tab="行星" key="1">
						<XQCheckList>{allobjs}</XQCheckList>
					</TabPane>
					<TabPane tab="希腊点" key="2">
						<XQCheckList>{lots}</XQCheckList>
					</TabPane>
				</XQTabs>
			</div>
		);
	}
}

export default PlanetSelector;
