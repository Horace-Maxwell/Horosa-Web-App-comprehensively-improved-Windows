import { Component } from 'react';
import { Row, Col, Tabs, Input, Button, } from 'antd';
import AstroPrimaryDirection from '../astro/AstroPrimaryDirection';
import AstroZR from '../astro/AstroZR';
import AstroFirdaria from '../astro/AstroFirdaria';
import AstroSolarReturn from '../astro/AstroSolarReturn';
import AstroLunarReturn from '../astro/AstroLunarReturn';
import AstroGivenYear from '../astro/AstroGivenYear';
import AstroSolarArc from '../astro/AstroSolarArc';
import AstroProfection from '../astro/AstroProfection';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import {
	appendPlanetMetaName,
} from '../../utils/planetMetaDisplay';

const DIRECT_SNAPSHOT_PLANET_META = {
	showPostnatal: 1,
	showHouse: 1,
	showRuler: 1,
};

const TabPane = Tabs.TabPane;

function msg(id){
	if(id === undefined || id === null){
		return '';
	}
	if(AstroText.AstroTxtMsg[id]){
		return AstroText.AstroTxtMsg[id];
	}
	if(AstroText.AstroMsg[id]){
		return `${AstroText.AstroMsg[id]}`;
	}
	return `${id}`;
}

function msgWithMeta(id, chartSources, displayOptions){
	const base = msg(id);
	return appendPlanetMetaName(base, id, chartSources, displayOptions || DIRECT_SNAPSHOT_PLANET_META);
}

function degreeText(value){
	const num = Number(value);
	if(Number.isNaN(num)){
		return `${value || ''}`.trim();
	}
	const neg = num < 0 ? '-' : '';
	const abs = Math.abs(num);
	const d = Math.floor(abs);
	let m = Math.floor((abs - d) * 60);
	if(m >= 60){
		m = 0;
	}
	return `${neg}${d}度${m}分`;
}

function directionObjText(text, chartSources, displayOptions){
	if(!text){
		return '';
	}
	const parts = `${text}`.split('_');
	if(parts.length < 2){
		return `${text}`;
	}
	if(parts[0] === 'T'){
		return `${msgWithMeta(parts[2], chartSources, displayOptions)}的${msgWithMeta(parts[1], chartSources, displayOptions)}界`;
	}
	if(parts[0] === 'A'){
		return `${msgWithMeta(parts[1], chartSources, displayOptions)}的映点`;
	}
	if(parts[0] === 'C'){
		return `${msgWithMeta(parts[1], chartSources, displayOptions)}的反映点`;
	}
	if(parts[0] === 'D'){
		return `${msgWithMeta(parts[1], chartSources, displayOptions)}的${parts[2]}度右相位处`;
	}
	if(parts[0] === 'S'){
		return `${msgWithMeta(parts[1], chartSources, displayOptions)}的${parts[2]}度左相位处`;
	}
	if(parts[0] === 'N'){
		if(parts[2] && parts[2] !== '0'){
			return `${msgWithMeta(parts[1], chartSources, displayOptions)}的${parts[2]}度相位处`;
		}
		return `${msgWithMeta(parts[1], chartSources, displayOptions)}`;
	}
	return `${text}`;
}

function isBoundDirectionRow(pd){
	if(!pd || !pd.length){
		return false;
	}
	const promittor = pd[1] ? `${pd[1]}` : '';
	const significator = pd[2] ? `${pd[2]}` : '';
	return promittor.indexOf('T_') === 0 || significator.indexOf('T_') === 0;
}

function appendBirthAndChartInfo(lines, chartObj){
	const obj = chartObj || {};
	const params = obj.params || {};
	const chart = obj.chart || {};
	lines.push('[出生时间]');
	if(params.birth){
		lines.push(`出生时间：${params.birth}${chart.dayofweek ? ` ${chart.dayofweek}` : ''}`);
	}else{
		lines.push('出生时间：无');
	}
	if(chart.nongli && chart.nongli.birth){
		lines.push(`真太阳时：${chart.nongli.birth}`);
	}

	lines.push('');
	lines.push('[星盘信息]');
	if(params.lon || params.lat){
		lines.push(`经纬度：${params.lon || ''} ${params.lat || ''}`.trim());
	}
	if(params.zone !== undefined && params.zone !== null){
		lines.push(`时区：${params.zone}`);
	}
	const zodiacalRaw = chart.zodiacal || AstroConst.ZODIACAL[`${params.zodiacal}`];
	const zodiacal = zodiacalRaw === AstroConst.SIDEREAL ? (AstroText.AstroTxtMsg[AstroConst.SIDEREAL] || zodiacalRaw) : zodiacalRaw;
	if(zodiacal){
		lines.push(`黄道：${zodiacal}`);
	}
	const hsys = AstroConst.HouseSys[`${params.hsys}`] || chart.hsys;
	if(hsys){
		lines.push(`宫制：${hsys}`);
	}
	if(chart.isDiurnal !== undefined && chart.isDiurnal !== null){
		lines.push(`盘型：${chart.isDiurnal ? '日生盘' : '夜生盘'}`);
	}
}

function buildPrimaryDirectSnapshotText(chartObj){
	const lines = [];
	const obj = chartObj || {};
	const allPds = obj.predictives && Array.isArray(obj.predictives.primaryDirection) ? obj.predictives.primaryDirection : [];
	const showPdBounds = !(obj.params && (obj.params.showPdBounds === 0 || obj.params.showPdBounds === false));
	const pds = showPdBounds ? allPds : allPds.filter((pd)=>!isBoundDirectionRow(pd));

	appendBirthAndChartInfo(lines, obj);

	lines.push('');
	lines.push('[主/界限法表格]');
	lines.push('| 赤经 | 迫星 | 应星 | 日期 |');
	lines.push('| --- | --- | --- | --- |');
	if(pds.length === 0){
		lines.push('| 无 | 无 | 无 | 无 |');
	}else{
		pds.forEach((pd)=>{
			const degree = degreeText(pd && pd[0]);
			const promittor = directionObjText(pd && pd[1], chartObj, DIRECT_SNAPSHOT_PLANET_META);
			const significator = directionObjText(pd && pd[2], chartObj, DIRECT_SNAPSHOT_PLANET_META);
			const date = pd && pd[4] ? `${pd[4]}` : '';
			lines.push(`| ${degree || '无'} | ${promittor || '无'} | ${significator || '无'} | ${date || '无'} |`);
		});
	}
	return lines.join('\n');
}

function buildFirdariaSnapshotText(chartObj){
	const lines = [];
	const obj = chartObj || {};
	const firdaria = obj.predictives && Array.isArray(obj.predictives.firdaria) ? obj.predictives.firdaria : [];
	appendBirthAndChartInfo(lines, obj);

	lines.push('');
	lines.push('[法达星限表格]');
	lines.push('| 主限 | 子限 | 日期 |');
	lines.push('| --- | --- | --- |');
	if(firdaria.length === 0){
		lines.push('| 无 | 无 | 无 |');
	}else{
		let rowCount = 0;
		firdaria.forEach((main)=>{
			const mainDirect = msgWithMeta(main && main.mainDirect, chartObj, DIRECT_SNAPSHOT_PLANET_META);
			const subs = main && Array.isArray(main.subDirect) ? main.subDirect : [];
			if(subs.length === 0){
				lines.push(`| ${mainDirect || '无'} | 无 | 无 |`);
				rowCount += 1;
				return;
			}
			subs.forEach((sub)=>{
				const subDirect = msgWithMeta(sub && sub.subDirect, chartObj, DIRECT_SNAPSHOT_PLANET_META);
				const date = sub && sub.date ? `${sub.date}` : '';
				lines.push(`| ${mainDirect || '无'} | ${subDirect || '无'} | ${date || '无'} |`);
				rowCount += 1;
			});
		});
		if(rowCount === 0){
			lines.push('| 无 | 无 | 无 |');
		}
	}
	return lines.join('\n');
}

class AstroDirectMain extends Component{

	constructor(props) {
		super(props);

		this.state = {
			currentTab: 'primarydirect',
			hook:{
				primarydirect:{
					fun: null
				},
				firdaria:{
					fun: null
				},
				profection:{
					fun: null
				},
				solararc:{
					fun: null
				},
				solarreturn:{
					fun: null
				},
				lunarreturn:{
					fun: null
				},
				givenyear:{
					fun: null
				},
				zodialrelease:{
					fun: null
				},
	
			},
		};

		this.changeTab = this.changeTab.bind(this);
		this.saveDirectionSnapshot = this.saveDirectionSnapshot.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (chartobj)=>{
				let hook = this.state.hook;
				if(hook[this.state.currentTab].fun){
					hook[this.state.currentTab].fun(chartobj);
				}
			};
		}

	}

	saveDirectionSnapshot(){
		const chartObj = this.props.chartObj || {};
		const fields = this.props.fields || {};
		const showPdBounds = fields.showPdBounds ? fields.showPdBounds.value : 1;
		const snapshotChartObj = {
			...chartObj,
			params: {
				...(chartObj.params || {}),
				showPdBounds,
			},
		};
		saveModuleAISnapshot('primarydirect', buildPrimaryDirectSnapshotText(snapshotChartObj), {
			tab: 'primarydirect',
		});
		if(this.state.currentTab === 'primarydirect'){
			return;
		}
		if(this.state.currentTab === 'firdaria'){
			saveModuleAISnapshot('firdaria', buildFirdariaSnapshotText(this.props.chartObj), {
				tab: 'firdaria',
			});
		}
	}

	componentDidMount(){
		this.saveDirectionSnapshot();
	}

	componentDidUpdate(prevProps, prevState){
		if(
			prevState.currentTab !== this.state.currentTab ||
			prevProps.chartObj !== this.props.chartObj ||
			prevProps.fields !== this.props.fields ||
			this.state.currentTab === 'primarydirect' ||
			this.state.currentTab === 'firdaria'
		){
			this.saveDirectionSnapshot();
		}
	}

	changeTab(key){
		let hook = this.state.hook;
		this.setState({
			currentTab: key,
		}, ()=>{
			this.saveDirectionSnapshot();
			if(hook[key].fun){
				hook[key].fun(this.props.chartObj);
			}
			if(this.props.dispatch){
				this.props.dispatch({
					type: 'astro/save',
					payload: {
						currentSubTab: key,
					}
				})
			}
		});
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		height = height - 20;

		return (
			<div>
				<Tabs 
					defaultActiveKey={this.state.currentTab} tabPosition='right'
					onChange={this.changeTab}
					style={{ height: height }}
				>
					<TabPane tab="主/界限法" key="primarydirect">
						<AstroPrimaryDirection  
							value={this.props.chartObj} height={height}
							showPdBounds={this.props.fields && this.props.fields.showPdBounds ? this.props.fields.showPdBounds.value : 1}
						/>
					</TabPane>

					<TabPane tab="黄道星释" key="zodialrelease">
						<AstroZR  
							value={this.props.chartObj} 
							height={this.props.height} 
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							hook={this.state.hook.zodialrelease}
						/>
					</TabPane>

					<TabPane tab="法达星限" key="firdaria">
						<AstroFirdaria 
							value={this.props.chartObj} 
							height={height}
						/>
					</TabPane>

					<TabPane tab="小限法" key="profection">
						<AstroProfection 
							value={this.props.chartObj} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							hook={this.state.hook.profection} 
						/>

					</TabPane>

					<TabPane tab="太阳弧" key="solararc">
						<AstroSolarArc 
							value={this.props.chartObj} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							hook={this.state.hook.solararc} 
						/>

					</TabPane>

					<TabPane tab="太阳返照" key="solarreturn">
						<AstroSolarReturn 
							value={this.props.chartObj} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							hook={this.state.hook.solarreturn} 
						/>
					</TabPane>

					<TabPane tab="月亮返照" key="lunarreturn">
						<AstroLunarReturn 
							value={this.props.chartObj} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							hook={this.state.hook.lunarreturn} 
						/>
					</TabPane>

					<TabPane tab="流年法" key="givenyear">
						<AstroGivenYear 
							value={this.props.chartObj} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							hook={this.state.hook.givenyear} 
						/>
					</TabPane>

				</Tabs>
			</div>
		);
	}
}

export default AstroDirectMain;
