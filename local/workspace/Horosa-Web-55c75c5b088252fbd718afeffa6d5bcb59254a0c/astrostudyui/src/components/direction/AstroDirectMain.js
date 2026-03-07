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
import * as AstroHelper from '../astro/AstroHelper';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import { appendPlanetHouseInfoById, } from '../../utils/planetHouseInfo';

const TabPane = Tabs.TabPane;
const AI_EXPORT_PLANET_INFO = {
	showHouse: 1,
	showRuler: 1,
};
const ASTROAPP_PD_SUPPORTED_BASE_IDS = new Set([
	AstroConst.SUN,
	AstroConst.MOON,
	AstroConst.MERCURY,
	AstroConst.VENUS,
	AstroConst.MARS,
	AstroConst.JUPITER,
	AstroConst.SATURN,
	AstroConst.URANUS,
	AstroConst.NEPTUNE,
	AstroConst.PLUTO,
	AstroConst.NORTH_NODE,
	AstroConst.ASC,
	AstroConst.MC,
]);

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

function msgWithHouse(chartObj, id){
	return appendPlanetHouseInfoById(
		msg(id),
		chartObj,
		id,
		AI_EXPORT_PLANET_INFO
	);
}

function degreeText(value, pdMethod){
	if(pdMethod === 'horosa_legacy'){
		const deg = AstroHelper.splitDegree(value);
		return `${deg[0]}度${deg[1]}分`;
	}
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

function primaryDirectionMethodText(val){
	if(val === 'horosa_legacy'){
		return 'Horosa原方法';
	}
	return 'AstroAPP-Alchabitius';
}

function primaryDirectionTimeKeyText(val){
	if(val === 'Ptolemy'){
		return 'Ptolemy';
	}
	return `${val || 'Ptolemy'}`;
}

function directionObjText(text, chartObj){
	if(!text){
		return '';
	}
	const parts = `${text}`.split('_');
	if(parts.length < 2){
		return `${text}`;
	}
	if(parts[0] === 'T'){
		return `${msgWithHouse(chartObj, parts[2])}的${msgWithHouse(chartObj, parts[1])}界`;
	}
	if(parts[0] === 'A'){
		return `${msgWithHouse(chartObj, parts[1])}的映点`;
	}
	if(parts[0] === 'C'){
		return `${msgWithHouse(chartObj, parts[1])}的反映点`;
	}
	if(parts[0] === 'D'){
		return `${msgWithHouse(chartObj, parts[1])}的${parts[2]}度右相位处`;
	}
	if(parts[0] === 'S'){
		return `${msgWithHouse(chartObj, parts[1])}的${parts[2]}度左相位处`;
	}
	if(parts[0] === 'N'){
		if(parts[2] && parts[2] !== '0'){
			return `${msgWithHouse(chartObj, parts[1])}的${parts[2]}度相位处`;
		}
		return `${msgWithHouse(chartObj, parts[1])}`;
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

function baseDirectionObjectId(text){
	const parts = `${text || ''}`.split('_');
	if(parts.length < 3){
		return `${text || ''}`;
	}
	return parts.slice(1, parts.length - 1).join('_').trim();
}

function isAstroAppUnsupportedDirectionRow(pd){
	if(!pd || !pd.length){
		return false;
	}
	if(isBoundDirectionRow(pd)){
		return true;
	}
	const promBase = baseDirectionObjectId(pd[1]);
	const sigBase = baseDirectionObjectId(pd[2]);
	return !ASTROAPP_PD_SUPPORTED_BASE_IDS.has(promBase) || !ASTROAPP_PD_SUPPORTED_BASE_IDS.has(sigBase);
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
	const pdMethod = obj.params && obj.params.pdMethod ? obj.params.pdMethod : 'astroapp_alchabitius';
	const pdTimeKey = obj.params && obj.params.pdTimeKey ? obj.params.pdTimeKey : 'Ptolemy';
	const degreeLabel = pdMethod === 'horosa_legacy' ? '赤经' : 'Arc';
	const pds = allPds.filter((pd)=>{
		if(pdMethod === 'astroapp_alchabitius' && isAstroAppUnsupportedDirectionRow(pd)){
			return false;
		}
		if(!showPdBounds && isBoundDirectionRow(pd)){
			return false;
		}
		return true;
	});

	appendBirthAndChartInfo(lines, obj);

	lines.push('');
	lines.push('[主/界限法设置]');
	lines.push(`推运方法：${primaryDirectionMethodText(pdMethod)}`);
	lines.push(`度数换算：${primaryDirectionTimeKeyText(pdTimeKey)}`);
	lines.push(`显示界限法：${showPdBounds ? '是' : '否'}`);

	lines.push('');
	lines.push('[主/界限法表格]');
	lines.push(`| ${degreeLabel} | 迫星 | 应星 | 日期 |`);
	lines.push('| --- | --- | --- | --- |');
	if(pds.length === 0){
		lines.push('| 无 | 无 | 无 | 无 |');
	}else{
		pds.forEach((pd)=>{
			const degree = degreeText(pd && pd[0], pdMethod);
			const promittor = directionObjText(pd && pd[1], obj);
			const significator = directionObjText(pd && pd[2], obj);
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
			const mainDirect = msgWithHouse(obj, main && main.mainDirect);
			const subs = main && Array.isArray(main.subDirect) ? main.subDirect : [];
			if(subs.length === 0){
				lines.push(`| ${mainDirect || '无'} | 无 | 无 |`);
				rowCount += 1;
				return;
			}
			subs.forEach((sub)=>{
				const subDirect = msgWithHouse(obj, sub && sub.subDirect);
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
		this.applyPrimaryDirectionConfig = this.applyPrimaryDirectionConfig.bind(this);
		this.saveDirectionSnapshot = this.saveDirectionSnapshot.bind(this);
		this.savePrimaryDirectSnapshot = this.savePrimaryDirectSnapshot.bind(this);
		this.saveFirdariaSnapshot = this.saveFirdariaSnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (chartobj)=>{
				let hook = this.state.hook;
				if(hook[this.state.currentTab].fun){
					hook[this.state.currentTab].fun(chartobj);
				}
			};
		}

	}

	savePrimaryDirectSnapshot(){
		const chartObj = this.props.chartObj || {};
		const chartParams = chartObj.params || {};
		const fields = this.props.fields || {};
		const showPdBounds = chartParams.showPdBounds !== undefined
			? chartParams.showPdBounds
			: (fields.showPdBounds ? fields.showPdBounds.value : 1);
		const pdMethod = chartParams.pdMethod
			? chartParams.pdMethod
			: (fields.pdMethod ? fields.pdMethod.value : 'astroapp_alchabitius');
		const pdTimeKey = chartParams.pdTimeKey
			? chartParams.pdTimeKey
			: (fields.pdTimeKey ? fields.pdTimeKey.value : 'Ptolemy');
		const snapshotChartObj = {
			...chartObj,
			params: {
				...(chartObj.params || {}),
				showPdBounds,
				pdMethod,
				pdTimeKey,
			},
		};
		const txt = buildPrimaryDirectSnapshotText(snapshotChartObj);
		if(!txt){
			return '';
		}
		saveModuleAISnapshot('primarydirect', txt, {
			tab: 'primarydirect',
			pdMethod,
			pdTimeKey,
			showPdBounds,
		});
		return txt;
	}

	saveFirdariaSnapshot(){
		const txt = buildFirdariaSnapshotText(this.props.chartObj);
		if(!txt){
			return '';
		}
		saveModuleAISnapshot('firdaria', txt, {
			tab: 'firdaria',
		});
		return txt;
	}

	saveDirectionSnapshot(){
		this.savePrimaryDirectSnapshot();
		if(this.state.currentTab === 'primarydirect'){
			return;
		}
		if(this.state.currentTab === 'firdaria'){
			this.saveFirdariaSnapshot();
		}
	}

	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || typeof evt.detail !== 'object'){
			return;
		}
		if(evt.detail.module === 'primarydirect'){
			const txt = this.savePrimaryDirectSnapshot();
			if(txt){
				evt.detail.snapshotText = txt;
			}
			return;
		}
		if(evt.detail.module === 'firdaria'){
			const txt = this.saveFirdariaSnapshot();
			if(txt){
				evt.detail.snapshotText = txt;
			}
		}
	}

	componentDidMount(){
		if(typeof window !== 'undefined' && window.addEventListener){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		this.saveDirectionSnapshot();
	}

	componentWillUnmount(){
		if(typeof window !== 'undefined' && window.removeEventListener){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
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

	applyPrimaryDirectionConfig(pdMethod, pdTimeKey){
		if(!this.props.dispatch || !this.props.fields){
			return;
		}
		this.props.dispatch({
			type: 'app/save',
			payload: {
				pdMethod,
				pdTimeKey,
			},
		});
		const nextFields = {
			...this.props.fields,
			pdtype: {
				...(this.props.fields.pdtype || { name: ['pdtype'] }),
				value: 0,
			},
			pdMethod: {
				...(this.props.fields.pdMethod || { name: ['pdMethod'] }),
				value: pdMethod,
			},
			pdTimeKey: {
				...(this.props.fields.pdTimeKey || { name: ['pdTimeKey'] }),
				value: pdTimeKey,
			},
		};
		this.props.dispatch({
			type: 'astro/save',
			payload: {
				fields: nextFields,
			},
		});
		this.props.dispatch({
			type: 'astro/fetchByFields',
			payload: {
				...nextFields,
				__requestOptions: {
					silent: true,
					cache: false,
				},
			},
		});
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		height = height - 20;
		const chartParams = this.props.chartObj && this.props.chartObj.params ? this.props.chartObj.params : {};
		const appliedPdMethod = chartParams.pdMethod
			? chartParams.pdMethod
			: (this.props.fields && this.props.fields.pdMethod ? this.props.fields.pdMethod.value : 'astroapp_alchabitius');
		const appliedPdTimeKey = chartParams.pdTimeKey
			? chartParams.pdTimeKey
			: (this.props.fields && this.props.fields.pdTimeKey ? this.props.fields.pdTimeKey.value : 'Ptolemy');

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
								pdMethod={appliedPdMethod}
								pdTimeKey={appliedPdTimeKey}
								onPdConfigApply={this.applyPrimaryDirectionConfig}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
					</TabPane>

					<TabPane tab="黄道星释" key="zodialrelease">
						<AstroZR  
							value={this.props.chartObj} 
							height={this.props.height} 
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.zodialrelease}
							/>
					</TabPane>

					<TabPane tab="法达星限" key="firdaria">
						<AstroFirdaria 
								value={this.props.chartObj} 
								height={height}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
					</TabPane>

					<TabPane tab="小限法" key="profection">
						<AstroProfection 
							value={this.props.chartObj} 
							height={height} 
							chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
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
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
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
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
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
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
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
								showPlanetHouseInfo={this.props.showPlanetHouseInfo}
								showAstroMeaning={this.props.showAstroMeaning}
								hook={this.state.hook.givenyear} 
							/>
					</TabPane>

				</Tabs>
			</div>
		);
	}
}

export default AstroDirectMain;
