import { Component } from 'react';
import { Row, Col, Radio, Divider, Select, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from './AstroHelper';
import AstroChart from './AstroChart';
import ZodiacalRelease from './ZodiacalRelease';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { randomStr, } from '../../utils/helper';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import styles from '../../css/styles.less';

const RadioGroup = Radio.Group;
const Option = Select.Option;

const AI_MODE_L1_ALL = 'l1_all';
const AI_MODE_L2_IN_L1 = 'l2_in_l1';
const AI_MODE_L3_IN_L2 = 'l3_in_l2';
const AI_MODE_L4_IN_L3 = 'l4_in_l3';

const AI_MODE_ITEMS = [
	{
		value: AI_MODE_L1_ALL,
		label: '输出所有L1（星座+时间）',
	},
	{
		value: AI_MODE_L2_IN_L1,
		label: '输出某个L1下全部L2',
	},
	{
		value: AI_MODE_L3_IN_L2,
		label: '输出某个L2下全部L3',
	},
	{
		value: AI_MODE_L4_IN_L3,
		label: '输出某个L3下全部L4',
	},
];

function safeIdx(idx, len){
	if(!len || len <= 0){
		return 0;
	}
	const num = Number(idx);
	if(Number.isNaN(num) || num < 0){
		return 0;
	}
	if(num >= len){
		return len - 1;
	}
	return num;
}

function signName(sign){
	if(!sign){
		return '无';
	}
	return AstroText.AstroTxtMsg[sign] || `${sign}`;
}

function nodeLine(item){
	if(!item){
		return '无';
	}
	const sign = signName(item.sign);
	const date = item.date || '无';
	return item.isLB ? `${sign}-${date}-LB` : `${sign}-${date}`;
}

function markZRSpecialFlags(list, parentSignIdx){
	if(!Array.isArray(list) || list.length === 0){
		return [];
	}
	let oppositeCnt = 0;
	return list.map((item)=>{
		const sign = item && item.sign;
		const level = item && item.level ? Number(item.level) : 0;
		const sigIdx = AstroConst.LIST_SIGNS.indexOf(sign);

		let isLB = false;
		if(
			level > 1 &&
			parentSignIdx >= 0 &&
			sigIdx >= 0 &&
			((sigIdx + 6) % 12) === parentSignIdx
		){
			oppositeCnt += 1;
			if(oppositeCnt === 2){
				isLB = true;
			}
		}

		const sublevel = item && Array.isArray(item.sublevel)
			? markZRSpecialFlags(item.sublevel, sigIdx)
			: [];

		return {
			...item,
			isLB,
			sublevel,
		};
	});
}

function modeLabel(mode){
	const target = AI_MODE_ITEMS.find((item)=>item.value === mode);
	return target ? target.label : AI_MODE_ITEMS[0].label;
}

function resolveSelectedNodes(list, aiState){
	const l1List = Array.isArray(list) ? list : [];
	const l1Idx = safeIdx(aiState.aiL1Idx, l1List.length);
	const l1 = l1List[l1Idx] || null;

	const l2List = l1 && Array.isArray(l1.sublevel) ? l1.sublevel : [];
	const l2Idx = safeIdx(aiState.aiL2Idx, l2List.length);
	const l2 = l2List[l2Idx] || null;

	const l3List = l2 && Array.isArray(l2.sublevel) ? l2.sublevel : [];
	const l3Idx = safeIdx(aiState.aiL3Idx, l3List.length);
	const l3 = l3List[l3Idx] || null;

	return {
		l1List, l1Idx, l1,
		l2List, l2Idx, l2,
		l3List, l3Idx, l3,
	};
}

function appendBirthAndChart(lines, chartObj, params){
	const obj = chartObj || {};
	const chart = obj.chart || {};
	const p = params || obj.params || {};

	lines.push('[起盘信息]');
	if(p.birth){
		lines.push(`出生时间：${p.birth}${chart.dayofweek ? ` ${chart.dayofweek}` : ''}`);
	}
	if(chart.nongli && chart.nongli.birth){
		lines.push(`真太阳时：${chart.nongli.birth}`);
	}
	if(p.date || p.time){
		lines.push(`起盘时间：${p.date || ''} ${p.time || ''}`.trim());
	}
	if(p.lon || p.lat){
		lines.push(`经纬度：${p.lon || ''} ${p.lat || ''}`.trim());
	}
	if(p.zone !== undefined && p.zone !== null){
		lines.push(`时区：${p.zone}`);
	}
	if(p.tradition){
		lines.push(`历法：${p.tradition}`);
	}

	lines.push('');
	lines.push('[星盘信息]');
	const zodiacalRaw = chart.zodiacal || AstroConst.ZODIACAL[`${p.zodiacal}`];
	if(zodiacalRaw){
		lines.push(`黄道：${AstroText.AstroTxtMsg[zodiacalRaw] || zodiacalRaw}`);
	}
	const hsys = AstroConst.HouseSys[`${p.hsys}`] || chart.hsys;
	if(hsys){
		lines.push(`宫制：${hsys}`);
	}
	if(chart.isDiurnal !== undefined && chart.isDiurnal !== null){
		lines.push(`盘型：${chart.isDiurnal ? '日生盘' : '夜生盘'}`);
	}
}

function buildZRAISnapshot(chartObj, params, basePoint, list, aiState){
	const lines = [];
	appendBirthAndChart(lines, chartObj, params);

	lines.push('');
	lines.push(`[基于${AstroText.AstroTxtMsg[basePoint] || basePoint}推运]`);
	lines.push(`AI输出模式：${modeLabel(aiState.aiMode)}`);

	const annotated = markZRSpecialFlags(list, -1);
	const selected = resolveSelectedNodes(annotated, aiState);

	if(selected.l1List.length === 0){
		lines.push('无推运数据');
		return lines.join('\n');
	}

	if(aiState.aiMode === AI_MODE_L1_ALL){
		selected.l1List.forEach((item, idx)=>{
			lines.push(`L1-${idx + 1}：${nodeLine(item)}`);
		});
		return lines.join('\n');
	}

	if(!selected.l1){
		lines.push('未找到L1数据');
		return lines.join('\n');
	}
	lines.push(`L1-${selected.l1Idx + 1}：${nodeLine(selected.l1)}`);

	if(aiState.aiMode === AI_MODE_L2_IN_L1){
		if(selected.l2List.length === 0){
			lines.push('无L2数据');
		}else{
			selected.l2List.forEach((item, idx)=>{
				lines.push(`L2-${idx + 1}：${nodeLine(item)}`);
			});
		}
		return lines.join('\n');
	}

	if(!selected.l2){
		lines.push('未找到L2数据');
		return lines.join('\n');
	}
	lines.push(`L2-${selected.l2Idx + 1}：${nodeLine(selected.l2)}`);

	if(aiState.aiMode === AI_MODE_L3_IN_L2){
		if(selected.l3List.length === 0){
			lines.push('无L3数据');
		}else{
			selected.l3List.forEach((item, idx)=>{
				lines.push(`L3-${idx + 1}：${nodeLine(item)}`);
			});
		}
		return lines.join('\n');
	}

	if(!selected.l3){
		lines.push('未找到L3数据');
		return lines.join('\n');
	}
	lines.push(`L3-${selected.l3Idx + 1}：${nodeLine(selected.l3)}`);

	const l4List = selected.l3 && Array.isArray(selected.l3.sublevel) ? selected.l3.sublevel : [];
	if(l4List.length === 0){
		lines.push('无L4数据');
	}else{
		l4List.forEach((item, idx)=>{
			lines.push(`L4-${idx + 1}：${nodeLine(item)}`);
		});
	}

	return lines.join('\n');
}

class AstroZR extends Component{
	constructor(props) {
		super(props);

		this.unmounted = false;

		this.changePoint = this.changePoint.bind(this);
		this.genConditionDom = this.genConditionDom.bind(this);
		this.requestDirection = this.requestDirection.bind(this);
		this.genNatalParams = this.genNatalParams.bind(this);
		this.requestData = this.requestData.bind(this);
		this.changeAIMode = this.changeAIMode.bind(this);
		this.changeAIL1 = this.changeAIL1.bind(this);
		this.changeAIL2 = this.changeAIL2.bind(this);
		this.changeAIL3 = this.changeAIL3.bind(this);
		this.genAIOutputDom = this.genAIOutputDom.bind(this);
		this.saveAISnapshot = this.saveAISnapshot.bind(this);

		let qryparam = {};
		if(this.props.value){
			qryparam = this.genNatalParams(this.props.value);
		}
		this.state = {
			params: {
				...qryparam,
				stopLevelIdx: 3,
				startSign: null,
			},
			basePoint: AstroConst.PARS_FORTUNA,
			list: [],
			aiMode: AI_MODE_L1_ALL,
			aiL1Idx: 0,
			aiL2Idx: 0,
			aiL3Idx: 0,
		};

		if(this.props.hook){
			this.props.hook.fun = (chartObj)=>{
				if(this.unmounted || chartObj === undefined || chartObj === null){
					return;
				}
				let param = this.genNatalParams(chartObj);
				let params = {
					...this.state.params,
					...param,
				};
				this.setState({
					params: params
				}, ()=>{
					this.requestData();
				});
			};
		}
	}

	componentDidMount(){
		this.unmounted = false;
		this.requestData();
		this.saveAISnapshot();
	}

	componentDidUpdate(prevProps, prevState){
		if(
			prevProps.value !== this.props.value ||
			prevState.basePoint !== this.state.basePoint ||
			prevState.list !== this.state.list ||
			prevState.aiMode !== this.state.aiMode ||
			prevState.aiL1Idx !== this.state.aiL1Idx ||
			prevState.aiL2Idx !== this.state.aiL2Idx ||
			prevState.aiL3Idx !== this.state.aiL3Idx
		){
			this.saveAISnapshot();
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
	}

	requestData(){
		let params = {
			...this.state.params
		};
		if(this.props.value){
			this.requestDirection(params);
		}
	}

	genNatalParams(chartObj){
		let qryparam = chartObj ? chartObj.params : {};
		if(qryparam.birth){
			let parts = qryparam.birth.split(' ');
			qryparam.date = parts[0];
			qryparam.time = parts[1];
		}
		let params = {
			date: qryparam.date,
			time: qryparam.time,
			zone: qryparam.zone,
			lon: qryparam.lon,
			lat: qryparam.lat,
			hsys: qryparam.hsys,
			tradition: qryparam.tradition,
			birth: qryparam.birth,
			zodiacal: qryparam.zodiacal,
		};
		return params;
	}

	async requestDirection(params){
		const data = await request(`${Constants.ServerRoot}/predict/zr`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey] || {};

		const st = {
			list: Array.isArray(result.zr) ? result.zr : [],
			params: {
				...params,
			},
		};

		this.setState(st);
	}

	saveAISnapshot(){
		const content = buildZRAISnapshot(
			this.props.value,
			this.state.params,
			this.state.basePoint,
			this.state.list,
			this.state
		);
		saveModuleAISnapshot('zodialrelease', content, {
			tab: 'zodialrelease',
			mode: this.state.aiMode,
			basePoint: this.state.basePoint,
			l1: this.state.aiL1Idx,
			l2: this.state.aiL2Idx,
			l3: this.state.aiL3Idx,
		});
	}

	changePoint(e){
		if(this.props.value === undefined || this.props.value === null){
			return;
		}
		let pnt = AstroHelper.getObject(this.props.value, e.target.value);
		let params = {
			...this.state.params,
			startSign: pnt.sign,
		};
		this.setState({
			params: params,
			basePoint: e.target.value,
			aiL1Idx: 0,
			aiL2Idx: 0,
			aiL3Idx: 0,
		}, ()=>{
			this.requestData();
		});
	}

	changeAIMode(value){
		this.setState({
			aiMode: value,
			aiL1Idx: 0,
			aiL2Idx: 0,
			aiL3Idx: 0,
		});
	}

	changeAIL1(value){
		this.setState({
			aiL1Idx: Number(value) || 0,
			aiL2Idx: 0,
			aiL3Idx: 0,
		});
	}

	changeAIL2(value){
		this.setState({
			aiL2Idx: Number(value) || 0,
			aiL3Idx: 0,
		});
	}

	changeAIL3(value){
		this.setState({
			aiL3Idx: Number(value) || 0,
		});
	}

	genConditionDom(){
		const radioStyle = {
			display: 'block',
			height: '30px',
			lineHeight: '30px',
		};

		let pnts = [
			AstroConst.PARS_FORTUNA, AstroConst.PARS_SPIRIT, AstroConst.PARS_MERCURY,
			AstroConst.PARS_VENUS, AstroConst.PARS_MARS, AstroConst.PARS_JUPITER,
			AstroConst.PARS_SATURN,
			AstroConst.ASC, AstroConst.DESC, AstroConst.MC, AstroConst.IC
		];

		let radios = pnts.map((item)=>{
			return (
				<Radio style={radioStyle} value={item} key={randomStr(8)}>
					<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[item]}&nbsp;</span>
					<span style={{fontFamily: AstroConst.NormalFont}}>{AstroText.AstroTxtMsg[item]}&nbsp;</span>
				</Radio>
			);
		});

		return (
			<RadioGroup onChange={this.changePoint} value={this.state.basePoint}>
				{radios}
			</RadioGroup>
		);
	}

	genAIOutputDom(){
		const annotated = markZRSpecialFlags(this.state.list, -1);
		const selected = resolveSelectedNodes(annotated, this.state);

		return (
			<div>
				<div style={{ marginBottom: 8 }}>
					<div style={{ marginBottom: 4 }}>输出范围</div>
					<Select size='small' value={this.state.aiMode} style={{ width: '100%' }} onChange={this.changeAIMode}>
						{AI_MODE_ITEMS.map((item)=>(
							<Option value={item.value} key={item.value}>{item.label}</Option>
						))}
					</Select>
				</div>

				{this.state.aiMode !== AI_MODE_L1_ALL && (
					<div style={{ marginBottom: 8 }}>
						<div style={{ marginBottom: 4 }}>L1选择</div>
						<Select size='small' value={`${selected.l1Idx}`} style={{ width: '100%' }} onChange={this.changeAIL1}>
							{selected.l1List.map((item, idx)=>(
								<Option value={`${idx}`} key={`l1_${idx}`}>{`L1-${idx + 1} ${nodeLine(item)}`}</Option>
							))}
						</Select>
					</div>
				)}

				{(this.state.aiMode === AI_MODE_L3_IN_L2 || this.state.aiMode === AI_MODE_L4_IN_L3) && (
					<div style={{ marginBottom: 8 }}>
						<div style={{ marginBottom: 4 }}>L2选择</div>
						<Select size='small' value={`${selected.l2Idx}`} style={{ width: '100%' }} onChange={this.changeAIL2}>
							{selected.l2List.map((item, idx)=>(
								<Option value={`${idx}`} key={`l2_${idx}`}>{`L2-${idx + 1} ${nodeLine(item)}`}</Option>
							))}
						</Select>
					</div>
				)}

				{this.state.aiMode === AI_MODE_L4_IN_L3 && (
					<div style={{ marginBottom: 8 }}>
						<div style={{ marginBottom: 4 }}>L3选择</div>
						<Select size='small' value={`${selected.l3Idx}`} style={{ width: '100%' }} onChange={this.changeAIL3}>
							{selected.l3List.map((item, idx)=>(
								<Option value={`${idx}`} key={`l3_${idx}`}>{`L3-${idx + 1} ${nodeLine(item)}`}</Option>
							))}
						</Select>
					</div>
				)}
			</div>
		);
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		let style = {
			height: (height - 20) + 'px',
			overflowY: 'auto',
			overflowX: 'hidden',
		};

		let condDom = null;
		if(this.props.value){
			condDom = this.genConditionDom(this.props.value);
		}
		const aiOutputDom = this.genAIOutputDom();

		return (
			<div>
				<Row gutter={6}>
					<Col span={14}>
						<AstroChart value={this.props.value}
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							backgroundColor='aliceblue' height={height}
						/>

					</Col>
					<Col span={6}>
						<Divider>基于{AstroText.AstroTxtMsg[this.state.basePoint]}推运</Divider>
						<ZodiacalRelease
							height={height}
							value={this.state.list}
						/>
					</Col>
					<Col span={4}>
						<div className={styles.scrollbar} style={style}>
							<Row>
								<Col span={24}>
									<Divider>推运基点选择</Divider>
									{condDom}
									<Divider>AI输出选择</Divider>
									{aiOutputDom}
								</Col>
							</Row>
						</div>
					</Col>
				</Row>

			</div>
		);
	}
}

export default AstroZR
