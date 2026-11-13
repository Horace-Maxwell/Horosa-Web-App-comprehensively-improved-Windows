import { Component } from 'react';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { XQCheckItem, XQSettingGroup, XQTabs } from '../xq-ui';
import { unavailableIn } from '../../constants/planetAvailability';

const TabPane = XQTabs.TabPane;

// 「行星」页分组:按星点的性质归组(七政 / 三王星 / 交点与月亮虚点 / 四轴与敏感点 / 小行星 / 中点)。
// 登记表之外的星点一律落进末尾「其它」组 —— 以后 LIST_POINTS 加了新点,这里忘了登记也不会从面板上消失。
const PLANET_GROUPS = [
	{ key: 'seven', title: '七政', hint: '日月五星', items: [
		AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS,
		AstroConst.MARS, AstroConst.JUPITER, AstroConst.SATURN,
	] },
	{ key: 'outer', title: '三王星', items: [AstroConst.URANUS, AstroConst.NEPTUNE, AstroConst.PLUTO] },
	{ key: 'nodes', title: '交点与月亮虚点', items: [
		AstroConst.NORTH_NODE, AstroConst.SOUTH_NODE, AstroConst.DARKMOON, AstroConst.PURPLE_CLOUDS,
		AstroConst.INTP_APOG, AstroConst.INTP_PERG,
	] },
	{ key: 'angles', title: '四轴与敏感点', items: [
		AstroConst.ASC, AstroConst.DESC, AstroConst.MC, AstroConst.IC,
		AstroConst.PARS_FORTUNA, AstroConst.SYZYGY,
	] },
	{ key: 'asteroids', title: '小行星', items: [
		AstroConst.CHIRON, AstroConst.PHOLUS, AstroConst.CERES, AstroConst.PALLAS, AstroConst.JUNO, AstroConst.VESTA,
	] },
	{ key: 'midpoints', title: '中点', items: [AstroConst.MOONSUN, AstroConst.SATURNMARS, AstroConst.JUPITERVENUS] },
];

// 「希腊点」页分组按归属而非数组序:「赫尔墨斯七点」= 精神 + 爱欲 / 必然 / 勇气 / 胜利 / 报应(福点在行星页),
// 「行星点」= 水金火木土五点,「阿拉伯点」= 其余;按标题找「六星点按昼夜反转」的作用集不会找错组。
const HERMETIC = [
	AstroConst.PARS_SPIRIT, AstroConst.PARS_EROS, AstroConst.PARS_NECESSITY,
	AstroConst.PARS_COURAGE, AstroConst.PARS_VICTORY, AstroConst.PARS_NEMESIS,
];
const PLANET_LOTS = [
	AstroConst.PARS_MERCURY, AstroConst.PARS_VENUS, AstroConst.PARS_MARS, AstroConst.PARS_JUPITER, AstroConst.PARS_SATURN,
];

export function buildPlanetGroups(){
	const all = AstroConst.LIST_POINTS;
	const used = {};
	const groups = [];
	const elsewhere = all.filter((item)=>!!unavailableIn(item));
	elsewhere.forEach((item)=>{ used[item] = true; });
	PLANET_GROUPS.forEach((g)=>{
		const items = g.items.filter((item)=>all.includes(item) && !used[item]);
		items.forEach((item)=>{ used[item] = true; });
		if(items.length){ groups.push({ ...g, items }); }
	});
	const rest = all.filter((item)=>!used[item]);
	if(rest.length){ groups.push({ key: 'rest', title: '其它', items: rest }); }
	// 本面板只服务西洋盘族;汉堡八虚星与七政命度点在这里勾了也画不出来(各有专属页面),
	// 故置灰并说明去处 —— 留着可见但点不动,好过让人反复点一个毫无反应的开关。
	if(elsewhere.length){
		groups.push({ key: 'elsewhere', title: '其它盘专属', hint: '本盘不绘制', items: elsewhere, locked: true });
	}
	return groups;
}

export function buildLotGroups(){
	const all = AstroConst.LOTS;
	return [
		{ key: 'hermetic', title: '赫尔墨斯七点', hint: '福点在「行星」页', items: all.filter((x)=>HERMETIC.includes(x)) },
		{ key: 'planet', title: '行星点', hint: '水金火木土', items: all.filter((x)=>PLANET_LOTS.includes(x)) },
		{ key: 'arabic', title: '阿拉伯点', items: all.filter((x)=>!HERMETIC.includes(x) && !PLANET_LOTS.includes(x)) },
	].filter((g)=>g.items.length);
}

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
			<span className="xq-pick-item">
				<span className="xq-pick-glyph" style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[item]}</span>
				<span className="xq-pick-name">{AstroText.AstroTxtMsg[item]}</span>
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

	// 整组全选 / 清空:只动本组的项,其余组的勾选与原有先后次序原样保留。
	setGroup(values, items, on){
		const cur = Array.isArray(values) ? values : [];
		const next = cur.filter((x)=>!items.includes(x));
		return on ? next.concat(items) : next;
	}

	togglePlanet(item){
		const planetValues = Array.isArray(this.props.value) ? this.props.value : [];
		this.onChange(this.toggleValue(planetValues, item));
	}

	toggleLot(item){
		const lotValues = Array.isArray(this.props.lots) ? this.props.lots : [];
		this.onLotsChange(this.toggleValue(lotValues, item));
	}

	renderGroup(group, values, toggle, commit){
		const { items, locked } = group;
		const picked = items.filter((item)=>values.includes(item)).length;
		const allOn = picked === items.length;
		const extra = locked ? null : (
			<button
				type="button"
				className="xq-setting-group-action"
				onClick={()=>commit(this.setGroup(values, items, !allOn))}
			>
				{allOn ? '清空' : '全选'}
			</button>
		);
		const hint = locked ? group.hint : `${group.hint ? `${group.hint} · ` : ''}${picked} / ${items.length}`;
		return (
			<XQSettingGroup key={group.key} title={group.title} hint={hint} extra={extra}>
				<div className="xq-pick-grid">
					{items.map((item)=>{
						const only = locked ? unavailableIn(item) : '';
						return (
							<XQCheckItem
								key={item}
								disabled={!!only}
								title={only ? `本盘不绘制;请到「${only}」查看` : undefined}
								checked={!only && values.includes(item)}
								onClick={()=>toggle(item)}
							>
								{this.renderLabel(item)}
							</XQCheckItem>
						);
					})}
				</div>
				{locked ? <div className="xq-setting-note">这几项只在各自的盘里绘制：汉堡学派虚星见「量化盘」，命度点见「七政四余盘」。</div> : null}
			</XQSettingGroup>
		);
	}

	render(){
		const planetValues = Array.isArray(this.props.value) ? this.props.value : [];
		const lotValues = Array.isArray(this.props.lots) ? this.props.lots : [];

		return (
			<div className="horosa-selector-drawer horosa-pick-panel">
				<XQTabs defaultActiveKey="1" tabPosition='top'>
					<TabPane tab="行星" key="1">
						<div className="horosa-setting-body">
							{buildPlanetGroups().map((g)=>this.renderGroup(g, planetValues, this.togglePlanet, this.onChange))}
						</div>
					</TabPane>
					<TabPane tab="希腊点" key="2">
						<div className="horosa-setting-body">
							{buildLotGroups().map((g)=>this.renderGroup(g, lotValues, this.toggleLot, this.onLotsChange))}
						</div>
					</TabPane>
				</XQTabs>
			</div>
		);
	}
}

export default PlanetSelector;
