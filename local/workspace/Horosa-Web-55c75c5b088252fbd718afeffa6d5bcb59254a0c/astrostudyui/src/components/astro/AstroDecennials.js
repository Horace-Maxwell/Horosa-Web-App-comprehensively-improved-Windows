import { Component } from 'react';
import { Row, Col, Divider, Select, Tree } from 'antd';
import AstroChart from './AstroChart';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import {
	DECENNIAL_START_MODE_SECT_LIGHT,
	DECENNIAL_ORDER_ZODIACAL,
	DECENNIAL_ORDER_CHALDEAN,
	DECENNIAL_DAY_METHOD_VALENS,
	DECENNIAL_DAY_METHOD_HEPHAISTIO,
	DECENNIAL_CALENDAR_TRADITIONAL,
	DECENNIAL_CALENDAR_ACTUAL,
	DECENNIAL_TRADITIONAL_PLANETS,
	buildDecennialTimeline,
	getDecennialCalendarLabel,
	getDecennialDisplayText,
	getDecennialNominalHint,
	getDecennialDayMethodLabel,
	getDecennialOrderLabel,
	getDecennialPlanetLongName,
	getDecennialPlanetShortName,
	getDecennialStartLabel,
} from '../../utils/decennials';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import { buildMeaningTipByCategory, } from './AstroMeaningData';
import { isMeaningEnabled, wrapWithMeaning, } from './AstroMeaningPopover';
import styles from '../../css/styles.less';

const { Option } = Select;
const { TreeNode } = Tree;

const AI_MODE_L1_ALL = 'l1_all';
const AI_MODE_L2_IN_L1 = 'l2_in_l1';
const AI_MODE_L3_IN_L2 = 'l3_in_l2';
const AI_MODE_L4_IN_L3 = 'l4_in_l3';

const AI_MODE_ITEMS = [
	{
		value: AI_MODE_L1_ALL,
		label: '输出所有L1（年主星+时间）',
	},
	{
		value: AI_MODE_L2_IN_L1,
		label: '输出某个L1下全部L2（月主星+时间）',
	},
	{
		value: AI_MODE_L3_IN_L2,
		label: '输出某个L2下全部L3（日主星+时间）',
	},
	{
		value: AI_MODE_L4_IN_L3,
		label: '输出某个L3下全部L4（时主星+时间）',
	},
];

const LEVEL_COLORS = ['#0a2e81', '#c81808', '#005000', '#948e33'];
const DECENNIAL_PANEL_RESERVED_HEIGHT = 72;
const DECENNIAL_PANEL_MIN_HEIGHT = 240;

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

function modeLabel(mode){
	const target = AI_MODE_ITEMS.find((item)=>item.value === mode);
	return target ? target.label : AI_MODE_ITEMS[0].label;
}

function nodeLine(item, calendarType){
	if(!item){
		return '无';
	}
	const label = getDecennialPlanetLongName(item.planet);
	const nominalHint = getDecennialNominalHint(item, calendarType);
	const suffix = nominalHint ? `（名义：${nominalHint}）` : '';
	return `${label}-${item.date || getDecennialDisplayText(item, calendarType)}${suffix}${item.active ? '-当前' : ''}`;
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

function buildDecennialAISnapshot(chartObj, params, settings, timelineMeta, list, aiState){
	const lines = [];
	appendBirthAndChart(lines, chartObj, params);

	lines.push('');
	lines.push('[十年大运设置]');
	lines.push(`起运主星：${getDecennialStartLabel(chartObj, settings.startMode)}`);
	lines.push(`实际起运：${getDecennialPlanetLongName(timelineMeta.resolvedStartPlanet)}`);
	lines.push(`分配次序：${getDecennialOrderLabel(settings.orderType)}`);
	lines.push(`日限体系：${getDecennialDayMethodLabel(settings.dayMethod)}`);
	lines.push(`时间口径：${getDecennialCalendarLabel(settings.calendarType)}`);

	lines.push('');
	lines.push(`[基于${getDecennialPlanetLongName(timelineMeta.resolvedStartPlanet)}起运]`);
	lines.push(`AI输出模式：${modeLabel(aiState.aiMode)}`);

	const selected = resolveSelectedNodes(list, aiState);
	if(selected.l1List.length === 0){
		lines.push('无推运数据');
		return lines.join('\n');
	}

	if(aiState.aiMode === AI_MODE_L1_ALL){
		selected.l1List.forEach((item, idx)=>{
			lines.push(`L1-${idx + 1}：${nodeLine(item, settings.calendarType)}`);
		});
		return lines.join('\n');
	}

	if(!selected.l1){
		lines.push('未找到L1数据');
		return lines.join('\n');
	}
	lines.push(`L1-${selected.l1Idx + 1}：${nodeLine(selected.l1, settings.calendarType)}`);

	if(aiState.aiMode === AI_MODE_L2_IN_L1){
		if(selected.l2List.length === 0){
			lines.push('无L2数据');
		}else{
			selected.l2List.forEach((item, idx)=>{
				lines.push(`L2-${idx + 1}：${nodeLine(item, settings.calendarType)}`);
			});
		}
		return lines.join('\n');
	}

	if(!selected.l2){
		lines.push('未找到L2数据');
		return lines.join('\n');
	}
	lines.push(`L2-${selected.l2Idx + 1}：${nodeLine(selected.l2, settings.calendarType)}`);

	if(aiState.aiMode === AI_MODE_L3_IN_L2){
		if(selected.l3List.length === 0){
			lines.push('无L3数据');
		}else{
			selected.l3List.forEach((item, idx)=>{
				lines.push(`L3-${idx + 1}：${nodeLine(item, settings.calendarType)}`);
			});
		}
		return lines.join('\n');
	}

	if(!selected.l3){
		lines.push('未找到L3数据');
		return lines.join('\n');
	}
	lines.push(`L3-${selected.l3Idx + 1}：${nodeLine(selected.l3, settings.calendarType)}`);

	const l4List = selected.l3 && Array.isArray(selected.l3.sublevel) ? selected.l3.sublevel : [];
	if(l4List.length === 0){
		lines.push('无L4数据');
	}else{
		l4List.forEach((item, idx)=>{
			lines.push(`L4-${idx + 1}：${nodeLine(item, settings.calendarType)}`);
		});
	}
	return lines.join('\n');
}

class AstroDecennials extends Component{
	constructor(props) {
		super(props);

		this.unmounted = false;

		this.changeStartMode = this.changeStartMode.bind(this);
		this.changeOrderType = this.changeOrderType.bind(this);
		this.changeDayMethod = this.changeDayMethod.bind(this);
		this.changeCalendarType = this.changeCalendarType.bind(this);
		this.changeAIMode = this.changeAIMode.bind(this);
		this.changeAIL1 = this.changeAIL1.bind(this);
		this.changeAIL2 = this.changeAIL2.bind(this);
		this.changeAIL3 = this.changeAIL3.bind(this);
		this.changeExpandedKeys = this.changeExpandedKeys.bind(this);
		this.rebuildTimeline = this.rebuildTimeline.bind(this);
		this.genNatalParams = this.genNatalParams.bind(this);
		this.genAIOutputDom = this.genAIOutputDom.bind(this);
		this.genSettingsDom = this.genSettingsDom.bind(this);
		this.genTreeNodes = this.genTreeNodes.bind(this);
		this.renderPlanetToken = this.renderPlanetToken.bind(this);
		this.saveAISnapshot = this.saveAISnapshot.bind(this);
		this.showMeaning = this.showMeaning.bind(this);

		const qryparam = this.props.value ? this.genNatalParams(this.props.value) : {};
		this.state = {
			params: qryparam,
			settings: {
				startMode: DECENNIAL_START_MODE_SECT_LIGHT,
				orderType: DECENNIAL_ORDER_ZODIACAL,
				dayMethod: DECENNIAL_DAY_METHOD_VALENS,
				calendarType: DECENNIAL_CALENDAR_TRADITIONAL,
			},
			list: [],
			timelineMeta: {
				resolvedStartPlanet: AstroConst.SUN,
			},
			expandedKeys: [],
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
				const param = this.genNatalParams(chartObj);
				this.setState({
					params: param,
				}, ()=>{
					this.rebuildTimeline(chartObj);
				});
			};
		}
	}

	componentDidMount(){
		this.unmounted = false;
		this.rebuildTimeline(this.props.value);
		this.saveAISnapshot();
	}

	componentDidUpdate(prevProps, prevState){
		if(prevProps.value !== this.props.value){
			const param = this.props.value ? this.genNatalParams(this.props.value) : {};
			this.setState({
				params: param,
			}, ()=>{
				this.rebuildTimeline(this.props.value);
			});
			return;
		}
		if(
			prevState.list !== this.state.list ||
			prevState.timelineMeta !== this.state.timelineMeta ||
			prevState.settings !== this.state.settings ||
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

	showMeaning(){
		return isMeaningEnabled(this.props.showAstroMeaning);
	}

	genNatalParams(chartObj){
		const qryparam = chartObj ? chartObj.params || {} : {};
		return {
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
	}

	rebuildTimeline(chartObj = this.props.value){
		if(!chartObj){
			return;
		}
		const timelineMeta = buildDecennialTimeline(chartObj, this.state.settings);
		this.setState({
			list: Array.isArray(timelineMeta.list) ? timelineMeta.list : [],
			timelineMeta,
			expandedKeys: (timelineMeta.list || []).map((item)=>item.key),
		});
	}

	saveAISnapshot(){
		const content = buildDecennialAISnapshot(
			this.props.value,
			this.state.params,
			this.state.settings,
			this.state.timelineMeta,
			this.state.list,
			this.state
		);
		saveModuleAISnapshot('decennials', content, {
			tab: 'decennials',
			startMode: this.state.settings.startMode,
			orderType: this.state.settings.orderType,
			dayMethod: this.state.settings.dayMethod,
			calendarType: this.state.settings.calendarType,
			l1: this.state.aiL1Idx,
			l2: this.state.aiL2Idx,
			l3: this.state.aiL3Idx,
			mode: this.state.aiMode,
		});
	}

	changeStartMode(value){
		this.setState({
			settings: {
				...this.state.settings,
				startMode: value,
			},
			aiL1Idx: 0,
			aiL2Idx: 0,
			aiL3Idx: 0,
		}, ()=>{
			this.rebuildTimeline();
		});
	}

	changeOrderType(value){
		this.setState({
			settings: {
				...this.state.settings,
				orderType: value,
			},
			aiL1Idx: 0,
			aiL2Idx: 0,
			aiL3Idx: 0,
		}, ()=>{
			this.rebuildTimeline();
		});
	}

	changeDayMethod(value){
		this.setState({
			settings: {
				...this.state.settings,
				dayMethod: value,
			},
			aiL1Idx: 0,
			aiL2Idx: 0,
			aiL3Idx: 0,
		}, ()=>{
			this.rebuildTimeline();
		});
	}

	changeCalendarType(value){
		this.setState({
			settings: {
				...this.state.settings,
				calendarType: value,
			},
		}, ()=>{
			this.rebuildTimeline();
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

	changeExpandedKeys(expandedKeys){
		this.setState({
			expandedKeys,
		});
	}

	renderPlanetToken(planet){
		const node = (
			<span>
				<span style={{ fontFamily: AstroConst.AstroFont }}>{AstroText.AstroMsg[planet]}&nbsp;</span>
				<span style={{ fontFamily: AstroConst.NormalFont }}>{getDecennialPlanetShortName(planet)}</span>
			</span>
		);
		return wrapWithMeaning(node, this.showMeaning(), buildMeaningTipByCategory('planet', planet));
	}

	genTreeNodes(list){
		return (Array.isArray(list) ? list : []).map((item)=>{
			const displayText = getDecennialDisplayText(item, this.state.settings.calendarType);
			const nominalHint = getDecennialNominalHint(item, this.state.settings.calendarType);
			const titleStyle = {
				color: LEVEL_COLORS[item.level - 1] || LEVEL_COLORS[0],
				padding: '2px 6px',
				borderRadius: 4,
				background: item.active ? '#fff3bf' : 'transparent',
				fontWeight: item.active ? 600 : 400,
				wordBreak: 'break-word',
			};
			const title = (
				<div style={titleStyle}>
					<span>
						<span style={{ fontFamily: AstroConst.NormalFont }}>{`L${item.level} `}</span>
						{this.renderPlanetToken(item.planet)}
						{item.active ? <span style={{ fontFamily: AstroConst.NormalFont }}>{' 当前'}</span> : null}
					</span>
					<span style={{ fontFamily: AstroConst.NormalFont }}>{` ${item.date || displayText}`}</span>
					{nominalHint ? (
						<div style={{ fontFamily: AstroConst.NormalFont, fontSize: 12, color: '#666', marginTop: 2 }}>
							{`名义：${nominalHint}`}
						</div>
					) : null}
				</div>
			);
			return (
				<TreeNode key={item.key} title={title}>
					{this.genTreeNodes(item.sublevel)}
				</TreeNode>
			);
		});
	}

	genAIOutputDom(){
		const selected = resolveSelectedNodes(this.state.list, this.state);

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
								<Option value={`${idx}`} key={`l1_${idx}`}>{`L1-${idx + 1} ${nodeLine(item, this.state.settings.calendarType)}`}</Option>
							))}
						</Select>
					</div>
				)}

				{(this.state.aiMode === AI_MODE_L3_IN_L2 || this.state.aiMode === AI_MODE_L4_IN_L3) && (
					<div style={{ marginBottom: 8 }}>
						<div style={{ marginBottom: 4 }}>L2选择</div>
						<Select size='small' value={`${selected.l2Idx}`} style={{ width: '100%' }} onChange={this.changeAIL2}>
							{selected.l2List.map((item, idx)=>(
								<Option value={`${idx}`} key={`l2_${idx}`}>{`L2-${idx + 1} ${nodeLine(item, this.state.settings.calendarType)}`}</Option>
							))}
						</Select>
					</div>
				)}

				{this.state.aiMode === AI_MODE_L4_IN_L3 && (
					<div style={{ marginBottom: 8 }}>
						<div style={{ marginBottom: 4 }}>L3选择</div>
						<Select size='small' value={`${selected.l3Idx}`} style={{ width: '100%' }} onChange={this.changeAIL3}>
							{selected.l3List.map((item, idx)=>(
								<Option value={`${idx}`} key={`l3_${idx}`}>{`L3-${idx + 1} ${nodeLine(item, this.state.settings.calendarType)}`}</Option>
							))}
						</Select>
					</div>
				)}
			</div>
		);
	}

	genSettingsDom(){
		const resolved = this.state.timelineMeta.resolvedStartPlanet || AstroConst.SUN;
		const startOptions = [
			{ value: DECENNIAL_START_MODE_SECT_LIGHT, label: '得时光体（昼日夜月）' },
			...DECENNIAL_TRADITIONAL_PLANETS.map((planet)=>({
				value: planet,
				label: getDecennialPlanetLongName(planet),
			})),
		];

		return (
			<div>
				<div style={{ marginBottom: 8 }}>
					<div style={{ marginBottom: 4 }}>起运主星</div>
					<Select size='small' value={this.state.settings.startMode} style={{ width: '100%' }} onChange={this.changeStartMode}>
						{startOptions.map((item)=>(
							<Option value={item.value} key={item.value}>{item.label}</Option>
						))}
					</Select>
					<div style={{ marginTop: 4, color: '#666', fontSize: 12 }}>
						{`当前实际起运：${getDecennialPlanetLongName(resolved)}`}
					</div>
				</div>

				<div style={{ marginBottom: 8 }}>
					<div style={{ marginBottom: 4 }}>分配次序</div>
					<Select size='small' value={this.state.settings.orderType} style={{ width: '100%' }} onChange={this.changeOrderType}>
						<Option value={DECENNIAL_ORDER_ZODIACAL}>实际黄道次序</Option>
						<Option value={DECENNIAL_ORDER_CHALDEAN}>迦勒底星序</Option>
					</Select>
				</div>

				<div style={{ marginBottom: 8 }}>
					<div style={{ marginBottom: 4 }}>日限体系</div>
					<Select size='small' value={this.state.settings.dayMethod} style={{ width: '100%' }} onChange={this.changeDayMethod}>
						<Option value={DECENNIAL_DAY_METHOD_VALENS}>Valens（精确）</Option>
						<Option value={DECENNIAL_DAY_METHOD_HEPHAISTIO}>Hephaistio（原表日数）</Option>
					</Select>
				</div>

				<div style={{ marginBottom: 8 }}>
					<div style={{ marginBottom: 4 }}>时间口径</div>
					<Select size='small' value={this.state.settings.calendarType} style={{ width: '100%' }} onChange={this.changeCalendarType}>
						<Option value={DECENNIAL_CALENDAR_TRADITIONAL}>360天/年（按30天/月换算）</Option>
						<Option value={DECENNIAL_CALENDAR_ACTUAL}>365.25天/年（按回归年换算）</Option>
					</Select>
					<div style={{ marginTop: 4, color: '#666', fontSize: 12 }}>
						{this.state.settings.calendarType === DECENNIAL_CALENDAR_TRADITIONAL
							? '当前显示：具体日期；下方附带文档名义区间'
							: `当前显示：${getDecennialCalendarLabel(this.state.settings.calendarType)}`}
					</div>
				</div>
			</div>
		);
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		const panelHeight = Math.max(DECENNIAL_PANEL_MIN_HEIGHT, height - DECENNIAL_PANEL_RESERVED_HEIGHT);
		const style = {
			height: `${panelHeight}px`,
			maxHeight: `${panelHeight}px`,
			overflowY: 'auto',
			overflowX: 'hidden',
		};
		const resolved = this.state.timelineMeta.resolvedStartPlanet || AstroConst.SUN;
		return (
			<div>
				<Row gutter={6}>
					<Col span={14}>
						<AstroChart
							value={this.props.value}
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							lotsDisplay={this.props.lotsDisplay}
							showAstroMeaning={this.props.showAstroMeaning}
							backgroundColor='aliceblue'
							height={height}
						/>
					</Col>
					<Col span={6}>
						<Divider>{`基于${getDecennialPlanetShortName(resolved)}起运`}</Divider>
						<div className={styles.scrollbar} style={style}>
							<Tree
								expandedKeys={this.state.expandedKeys}
								onExpand={this.changeExpandedKeys}
								selectable={false}
							>
								{this.genTreeNodes(this.state.list)}
							</Tree>
						</div>
					</Col>
					<Col span={4}>
						<div className={styles.scrollbar} style={style}>
							<Row>
								<Col span={24}>
									<Divider>设置</Divider>
									{this.genSettingsDom()}
									<Divider>AI输出选择</Divider>
									{this.genAIOutputDom()}
								</Col>
							</Row>
						</div>
					</Col>
				</Row>
			</div>
		);
	}
}

export default AstroDecennials;
