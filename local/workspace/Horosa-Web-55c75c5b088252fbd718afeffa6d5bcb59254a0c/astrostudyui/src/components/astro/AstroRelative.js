import { Component } from 'react';
import { Row, Col, Tabs, Input, Button, } from 'antd';
import ChartSearchModal from './ChartSearchModal'
import AstroCompare from '../relative/AstroCompare'
import AstroComposite from '../relative/AstroComposite'
import AstroSynastry from '../relative/AstroSynastry'
import AstroTimeSpace from '../relative/AstroTimeSpace'
import AstroMarks from '../relative/AstroMarks'
import RelativeFloatingPanel from '../relative/RelativeFloatingPanel'
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import * as AstroText from '../../constants/AstroText';
import { buildAstroSnapshotContent, } from '../../utils/astroAiSnapshot';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import {
	appendPlanetMetaName,
} from '../../utils/planetMetaDisplay';

const RELATIVE_SNAPSHOT_PLANET_META = {
	showPostnatal: 1,
	showHouse: 1,
	showRuler: 1,
};

const TabPane = Tabs.TabPane;
const Search = Input.Search;

function msg(id, chartSources){
	if(id === undefined || id === null){
		return '';
	}
	let base = null;
	if(AstroText.AstroTxtMsg[id]){
		base = AstroText.AstroTxtMsg[id];
	}else if(AstroText.AstroMsg[id]){
		base = `${AstroText.AstroMsg[id]}`;
	}else{
		base = `${id}`;
	}
	return appendPlanetMetaName(base, id, chartSources, RELATIVE_SNAPSHOT_PLANET_META);
}

function round3(val){
	if(val === undefined || val === null || Number.isNaN(Number(val))){
		return '';
	}
	return `${Math.round(Number(val) * 1000) / 1000}`;
}

function aspectText(asp){
	const n = Number(asp);
	if(Number.isNaN(n)){
		return `${asp || ''}`;
	}
	return `${n}˚`;
}

function relationNameByKey(key){
	if(key === 'Comp'){
		return '比较盘';
	}
	if(key === 'Composite'){
		return '组合盘';
	}
	if(key === 'Synastry'){
		return '影响盘';
	}
	if(key === 'TimeSpace'){
		return '时空中点盘';
	}
	if(key === 'Marks'){
		return '马克斯盘';
	}
	return key || '关系盘';
}

function pushAspectArray(lines, title, list, chartSources){
	if(!list || list.length === 0){
		return;
	}
	lines.push('');
	lines.push(`[${title}]`);
	list.forEach((obj)=>{
		const objId = obj.id !== undefined ? obj.id : obj.directId;
		lines.push(`主体：${msg(objId, chartSources)}`);
		const objs = obj.objects || [];
		if(objs.length === 0){
			lines.push('无');
			return;
		}
		objs.forEach((natalObj)=>{
			const natalId = natalObj.id !== undefined ? natalObj.id : natalObj.natalId;
			lines.push(`与 ${msg(natalId, chartSources)} 成 ${aspectText(natalObj.aspect)} 相位，误差${round3(natalObj.delta)}`);
		});
		lines.push('');
	});
}

function pushMidpointMap(lines, title, mapObj, chartSources){
	if(!mapObj){
		return;
	}
	const keys = Object.keys(mapObj);
	if(keys.length === 0){
		return;
	}
	lines.push('');
	lines.push(`[${title}]`);
	keys.forEach((key)=>{
		const arr = mapObj[key] || [];
		lines.push(`主体：${msg(key, chartSources)}`);
		if(arr.length === 0){
			lines.push('无');
			return;
		}
		arr.forEach((asp)=>{
			const midpoint = asp.midpoint || {};
			lines.push(`与中点(${msg(midpoint.idA, chartSources)} | ${msg(midpoint.idB, chartSources)}) 成 ${aspectText(asp.aspect)} 相位，误差${round3(asp.delta)}`);
		});
		lines.push('');
	});
}

function pushAntisciaArray(lines, title, arr, typeLabel, chartSources){
	if(!arr || arr.length === 0){
		return;
	}
	lines.push('');
	lines.push(`[${title}]`);
	arr.forEach((item)=>{
		lines.push(`${msg(item.idA, chartSources)} 与 ${msg(item.idB, chartSources)} 成${typeLabel}，误差${round3(item.delta)}`);
	});
}

function buildRelativeSnapshotText(comp){
	const lines = [];
	const relationName = relationNameByKey(comp.currentTab);
	const res = comp.result || {};
	const chartSources = res;

	lines.push('[关系起盘信息]');
	lines.push(`盘型：${relationName}`);
	if(comp.chartA && comp.chartA.record){
		lines.push(`星盘A：${comp.chartA.record.name} ${comp.chartA.record.birth}`);
		lines.push(`星盘A经纬度：${comp.chartA.record.lon} ${comp.chartA.record.lat}`);
	}
	if(comp.chartB && comp.chartB.record){
		lines.push(`星盘B：${comp.chartB.record.name} ${comp.chartB.record.birth}`);
		lines.push(`星盘B经纬度：${comp.chartB.record.lon} ${comp.chartB.record.lat}`);
	}
	if(comp.params){
		lines.push(`宫制：${comp.params.hsys}`);
		lines.push(`黄道：${comp.params.zodiacal}`);
	}

	if(comp.currentTab === 'Comp'){
		pushAspectArray(lines, 'A对B相位', res.inToOutAsp, chartSources);
		pushAspectArray(lines, 'B对A相位', res.outToInAsp, chartSources);
		pushMidpointMap(lines, 'A对B中点相位', res.inToOutMidpoint, chartSources);
		pushMidpointMap(lines, 'B对A中点相位', res.outToInMidpoint, chartSources);
		pushAntisciaArray(lines, 'A对B映点', res.inToOutAnti, '映点', chartSources);
		pushAntisciaArray(lines, 'A对B反映点', res.inToOutCAnti, '反映点', chartSources);
		pushAntisciaArray(lines, 'B对A映点', res.outToInAnti, '映点', chartSources);
		pushAntisciaArray(lines, 'B对A反映点', res.outToInCAnti, '反映点', chartSources);
	}

	if((comp.currentTab === 'Composite' || comp.currentTab === 'TimeSpace') && res.chart){
		lines.push('');
		lines.push('[合成图盘]');
		lines.push(buildAstroSnapshotContent(res, null));
	}

	if((comp.currentTab === 'Synastry' || comp.currentTab === 'Marks') && (res.inner || res.outer)){
		if(res.inner && res.inner.chart){
			lines.push('');
			lines.push('[影响图盘-星盘A]');
			lines.push(buildAstroSnapshotContent(res.inner, null));
		}
		if(res.outer && res.outer.chart){
			lines.push('');
			lines.push('[影响图盘-星盘B]');
			lines.push(buildAstroSnapshotContent(res.outer, null));
		}
	}
	return lines.join('\n');
}

class AstroRelative extends Component{

	constructor(props) {
		super(props);
		this.state = {
			currentTab: 'Comp',
			currentRelative: 0,
			chartA: null,
			chartB: null,
			floatingPanelVisible: true,
			floatingPanelCollapsed: false,
			hook: {
				Comp:{
					txt:'比较盘',
					relative: 0,
					result: null,
					fun: null
				},
				Composite:{
					txt:'组合盘',
					relative: 1,
					result: null,
					fun: null
				},
				Synastry:{
					txt:'影响盘',
					relative: 2,
					result: null,
					fun: null
				},
				TimeSpace:{
					txt:'时空中点盘',
					relative: 3,
					result: null,
					fun: null
				},
				Marks:{
					txt:'马克斯盘',
					relative: 4,
					result: null,
					fun: null
				},

			},
		}

		this.changeTab = this.changeTab.bind(this);
		this.selectChartA = this.selectChartA.bind(this);
		this.selectChartB = this.selectChartB.bind(this);
		this.clickDoChart = this.clickDoChart.bind(this);
		this.doChart = this.doChart.bind(this);
		this.genParams = this.genParams.bind(this);
		this.toggleFloatingPanel = this.toggleFloatingPanel.bind(this);
		this.toggleFloatingPanelCollapse = this.toggleFloatingPanelCollapse.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				let hook = this.state.hook;
				if(hook[this.state.currentTab].fun){
					let res = hook[this.state.currentTab].result;
					hook[this.state.currentTab].fun(res);
				}
			};
		}

	}

	genParams(){
		if(this.state.chartA === null || this.state.chartB === null){
			return null;
		}
		let recA = this.state.chartA.record;
		let recB = this.state.chartB.record;
		let birthA = recA.birth.split(' ');
		let birthB = recB.birth.split(' ');

		let params = {
			inner: {
				date: birthA[0],
				time: birthA[1],
				zone: recA.zone,
				lat: recA.lat,
				lon: recA.lon
			},
			outer: {
				date: birthB[0],
				time: birthB[1],
				zone: recB.zone,
				lat: recB.lat,
				lon: recB.lon
			},
			hsys: 0,
			zodiacal: 0,
			relative: this.state.currentRelative
		}

		if(this.props.fields){
			params.hsys = this.props.fields.hsys.value;
			params.zodiacal = this.props.fields.zodiacal.value;
		}

		return params;
	}

	async doChart(){
		if(this.state.chartA === null || this.state.chartB === null){
			return;
		}

		const params = this.genParams();
		if(params === null){
			return;
		}

		const data = await request(`${Constants.ServerRoot}/modern/relative`, {
			body: JSON.stringify(params),
		});

		const res = data[Constants.ResultKey];
		
		let hook = this.state.hook;
		hook[this.state.currentTab].result = res;
		const st = {
			hook: hook
		};

		this.setState(st, ()=>{
			let hook = this.state.hook[this.state.currentTab];
			if(hook && hook.fun){
				hook.fun(res);
			}
			saveModuleAISnapshot('relative', buildRelativeSnapshotText({
				currentTab: this.state.currentTab,
				currentRelative: this.state.currentRelative,
				chartA: this.state.chartA,
				chartB: this.state.chartB,
				params: params,
				result: res,
			}), {
				relation: this.state.currentTab,
				chartA: this.state.chartA && this.state.chartA.record ? this.state.chartA.record.name : null,
				chartB: this.state.chartB && this.state.chartB.record ? this.state.chartB.record.name : null,
			});
		});

	}

	changeTab(key){
		let hook = this.state.hook;
		this.setState({
			currentTab: key,
			currentRelative: hook[key].relative
		}, ()=>{
			if(this.state.chartA !== null && this.state.chartB !== null){
				this.doChart();
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

	selectChartA(rec){
		if(this.props.fields){
			rec.hsys = this.props.fields.hsys.value;
			rec.zodiacal = this.props.fields.zodiacal.value;
		}

		if(rec){
			let txt = `${rec.name} ${rec.birth}`
			this.setState({
				chartA: {
					txt: txt,
					record: rec,
				}
			}, ()=>{
				if(this.state.chartA !== null && this.state.chartB !== null){
					this.doChart()
				}
			});
		}else{
			this.setState({
				chartA: null
			})
		}
	}

	selectChartB(rec){
		if(rec){
			let txt = `${rec.name} ${rec.birth}`
			this.setState({
				chartB: {
					txt: txt,
					record: rec,
				}
			}, ()=>{
				if(this.state.chartA !== null && this.state.chartB !== null){
					this.doChart()
				}
			});
		}else{
			this.setState({
				chartB: null
			})
		}		
	}

	clickDoChart(){
		this.doChart()
	}

	toggleFloatingPanel(){
		this.setState({
			floatingPanelVisible: !this.state.floatingPanelVisible,
		});
	}

	toggleFloatingPanelCollapse(){
		this.setState({
			floatingPanelCollapsed: !this.state.floatingPanelCollapsed,
		});
	}


	render(){
		let height = this.props.height ? this.props.height : 760;
		height = height - 50

		let chartAtxt = this.state.chartA ? this.state.chartA.txt : null;
		let chartBtxt = this.state.chartB ? this.state.chartB.txt : null;

		let hook = this.state.hook;

		return (
			<div>
				<Row gutter={12}>
					<Col span={8}>
						<ChartSearchModal onOk={this.selectChartA}>
							<Search placeholder="星盘A" value={chartAtxt} onChange={(e)=>{}} />
						</ChartSearchModal>
					</Col>
					<Col span={8}>
						<ChartSearchModal onOk={this.selectChartB}>
							<Search placeholder="星盘B" value={chartBtxt} onChange={(e)=>{}} />
						</ChartSearchModal>
					</Col>
					<Col span={8}>
						<Button onClick={this.clickDoChart}>排盘</Button>
						<Button style={{marginLeft: 8}} onClick={this.toggleFloatingPanel}>
							{this.state.floatingPanelVisible ? '隐藏浮窗' : '显示浮窗'}
						</Button>
					</Col>
				</Row>
				<Row gutter={12} style={{marginTop: 10}}>
					<Col span={24}>
						<Tabs 
							defaultActiveKey={this.state.currentTab} tabPosition='right'
							onChange={this.changeTab}
							style={{ height: height }}
						>
							<TabPane tab="比较盘" key="Comp">
								<AstroCompare
									value={hook.Comp.result}
									height={height}
									fields={this.props.fields}
									chartA={this.state.chartA}
									chartB={this.state.chartB}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
									lotsDisplay={this.props.lotsDisplay}	
									hook={hook.Comp}	
								/>
							</TabPane>
							<TabPane tab="组合盘" key="Composite">
								<AstroComposite 
									value={hook.Composite.result}
									height={height}
									fields={this.props.fields}
									chartA={this.state.chartA}
									chartB={this.state.chartB}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
									lotsDisplay={this.props.lotsDisplay}	
									hook={hook.Composite}	
								/>
							</TabPane>
							<TabPane tab="影响盘" key="Synastry">
								<AstroSynastry 
									value={hook.Synastry.result}
									height={height}
									fields={this.props.fields}
									chartA={this.state.chartA}
									chartB={this.state.chartB}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
									lotsDisplay={this.props.lotsDisplay}	
									hook={hook.Synastry}	
								/>
							</TabPane>
							<TabPane tab="时空中点盘" key="TimeSpace">
								<AstroTimeSpace 
									value={hook.TimeSpace.result}
									height={height}
									fields={this.props.fields}
									chartA={this.state.chartA}
									chartB={this.state.chartB}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
									lotsDisplay={this.props.lotsDisplay}	
									hook={hook.TimeSpace}	
								/>
							</TabPane>
							<TabPane tab="马克斯盘" key="Marks">
								<AstroMarks 
									value={hook.Marks.result}
									height={height}
									fields={this.props.fields}
									chartA={this.state.chartA}
									chartB={this.state.chartB}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
									lotsDisplay={this.props.lotsDisplay}	
									hook={hook.Marks}	
								/>
							</TabPane>

						</Tabs>
					</Col>
				</Row>
				<RelativeFloatingPanel
					visible={this.state.floatingPanelVisible}
					collapsed={this.state.floatingPanelCollapsed}
					onToggleCollapse={this.toggleFloatingPanelCollapse}
					modeKey={this.state.currentTab}
					result={hook[this.state.currentTab] ? hook[this.state.currentTab].result : null}
					chartA={this.state.chartA}
					chartB={this.state.chartB}
					fields={this.props.fields}
					planetDisplay={this.props.planetDisplay}
					lotsDisplay={this.props.lotsDisplay}
				/>
			</div>
		);
	}
}

export default AstroRelative;
