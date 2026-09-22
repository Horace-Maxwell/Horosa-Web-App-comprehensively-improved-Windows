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

		// [用户实报 2026-09-17·APP] 段标题「希腊点 / 阿拉伯点」此前与相邻勾选卡合包在一个 <div> 里塞进网格:
		// 抽屉规则 `.xq-check-list .xq-check-item { height: 100% }` 让卡撑满整个包裹格(卡变高一截),
		// 标题被挤出格外压到下一张卡上(「阿拉伯点」叠在「(信心点)」上)。改为标题自成一格、独占整行
		// (grid-column: 1 / -1 走内联样式——LESS 会把 1 / -1 当除法求值),卡与标题各归各行,任何列数下都不重叠。
		const sectionTitleStyle = { gridColumn: '1 / -1', margin: '6px 0 0' };
		// [Q-344/T-325] 分组按归属而非数组序:「赫尔墨斯七点」= 精神 + 爱欲 / 必然 / 勇气 / 胜利 / 报应(福点在行星页),
		// 「行星点」= 水金火木土五点,「阿拉伯点」= 其余;此前赫尔墨斯六点被列在「阿拉伯点」下,按标题找「七星点按昼夜反转」作用集会找错组。
		const HERMETIC = [AstroConst.PARS_SPIRIT, AstroConst.PARS_EROS, AstroConst.PARS_NECESSITY, AstroConst.PARS_COURAGE, AstroConst.PARS_VICTORY, AstroConst.PARS_NEMESIS];
		const PLANET_LOTS = [AstroConst.PARS_MERCURY, AstroConst.PARS_VENUS, AstroConst.PARS_MARS, AstroConst.PARS_JUPITER, AstroConst.PARS_SATURN];
		const groups = [
			['__title_hermetic', '赫尔墨斯七点（精神·爱欲·必然·勇气·胜利·报应；福点见「行星」页）', AstroConst.LOTS.filter((x)=>HERMETIC.includes(x))],
			['__title_planet', '行星点', AstroConst.LOTS.filter((x)=>PLANET_LOTS.includes(x))],
			['__title_arabic', '阿拉伯点', AstroConst.LOTS.filter((x)=>!HERMETIC.includes(x) && !PLANET_LOTS.includes(x))],
		];
		let lots = [];
		groups.forEach(([key, title, items])=>{
			if(!items.length){ return; }
			lots.push(<XQSectionTitle key={key} style={sectionTitleStyle}>{title}</XQSectionTitle>);
			items.forEach((item)=>{
				lots.push(
					<XQCheckItem key={item} checked={lotValues.includes(item)} onClick={()=>this.toggleLot(item)}>
						{this.renderLabel(item)}
					</XQCheckItem>
				);
			});
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
