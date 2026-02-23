import { Component } from 'react';
import { Row, Col, Button, Divider, Tabs,} from 'antd';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import {randomStr,} from '../../utils/helper';
import ZiWeiInput from './ZiWeiInput';
import ZiWeiChart from './ZiWeiChart';
import ZWRuleMain from '../ruleziwei/ZWRuleMain';
import TipsBoard from '../comp/TipsBoard';
import * as ZiWeiHelper from './ZiWeiHelper';
import DateTime from '../comp/DateTime';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';

const TabPane = Tabs.TabPane;

function normalizeGan(value){
	if(!value){
		return '';
	}
	return `${value}`.trim().charAt(0);
}

function pickYearGan(chart){
	if(!chart){
		return '';
	}
	if(chart.yearGan){
		return normalizeGan(chart.yearGan);
	}
	if(chart.nongli && chart.nongli.yearGanZi){
		return normalizeGan(chart.nongli.yearGanZi);
	}
	if(chart.nongli && chart.nongli.year){
		return normalizeGan(chart.nongli.year);
	}
	return '';
}

function buildZiWeiFieldKey(fields){
	if(!fields || !fields.date || !fields.time){
		return '';
	}
	const dateVal = fields.date && fields.date.value && fields.date.value.format
		? fields.date.value.format('YYYY-MM-DD')
		: '';
	const timeVal = fields.time && fields.time.value && fields.time.value.format
		? fields.time.value.format('HH:mm:ss')
		: '';
	return [
		dateVal,
		timeVal,
		fields.zone ? fields.zone.value : '',
		fields.lon ? fields.lon.value : '',
		fields.lat ? fields.lat.value : '',
		fields.gender ? fields.gender.value : '',
	].join('|');
}

function collectHouseStars(house){
	const groups = [
		'starsMain',
		'starsAssist',
		'starsEvil',
		'starsOthersGood',
		'starsOthersBad',
		'starsSmall',
		'stars',
	];
	const out = [];
	const seen = new Set();
	groups.forEach((key)=>{
		const arr = house && house[key] ? house[key] : [];
		arr.forEach((item)=>{
			let name = '';
			if(typeof item === 'string'){
				name = item;
			}else{
				name = item && (item.name || item.id) ? (item.name || item.id) : '';
			}
			name = `${name || ''}`.trim();
			if(!name || seen.has(name)){
				return;
			}
			seen.add(name);
			out.push(name);
		});
	});
	return out;
}

function formatStarSiHua(starName, yearGan, lifeGan){
	const tags = [];
	if(yearGan){
		const yearHua = ZiWeiHelper.getSiHua(starName, yearGan);
		if(yearHua){
			tags.push(`生年${yearHua}`);
		}
	}
	if(lifeGan){
		const lifeHua = ZiWeiHelper.getSiHua(starName, lifeGan);
		if(lifeHua){
			tags.push(`命宫${lifeHua}`);
		}
	}
	if(tags.length === 0){
		return starName;
	}
	return `${starName}（${tags.join('，')}）`;
}

function getLifeHouse(chart, houses){
	if(!chart || !houses || houses.length === 0){
		return null;
	}
	if(chart.lifeHouseIndex !== undefined && chart.lifeHouseIndex !== null){
		const idx = Number(chart.lifeHouseIndex);
		if(!Number.isNaN(idx) && houses[idx]){
			return houses[idx];
		}
	}
	return houses.find((house)=>`${house.name || ''}`.includes('命')) || null;
}

function buildZiWeiSnapshotText(params, result){
	const chart = result && result.chart ? result.chart : {};
	const houses = chart.houses || [];
	const yearGan = pickYearGan(chart);
	const lifeHouse = getLifeHouse(chart, houses);
	const lifeGan = lifeHouse && lifeHouse.ganzi ? normalizeGan(lifeHouse.ganzi) : '';
	const lines = [];

	lines.push('[起盘信息]');
	lines.push(`日期：${params.date} ${params.time}`);
	lines.push(`时区：${params.zone}`);
	lines.push(`经纬度：${params.lon} ${params.lat}`);
	lines.push(`性别：${params.gender}`);
	if(yearGan){
		lines.push(`生年天干：${yearGan}`);
	}
	if(lifeHouse && lifeHouse.name){
		lines.push(`命宫：${lifeHouse.name}${lifeHouse.ganzi ? `（${lifeHouse.ganzi}）` : ''}`);
	}
	if(lifeGan){
		lines.push(`命宫天干：${lifeGan}`);
	}

	lines.push('');
	lines.push('[宫位总览]');
	houses.forEach((house, idx)=>{
		const name = house.name || house.id || `宫位${idx + 1}`;
		const ganzi = house.ganzi || '';
		const direction = house.direction && house.direction.length === 2 ? `${house.direction[0]}~${house.direction[1]}` : '';
		const stars = collectHouseStars(house);
		lines.push(`${name}：大限=${direction || '无'}，干支=${ganzi || '无'}`);
		if(stars.length > 0){
			lines.push(`星曜：${stars.map((starName)=>formatStarSiHua(starName, yearGan, lifeGan)).join('、')}`);
		}else{
			lines.push('星曜：无');
		}
		lines.push('');
	});
	return lines.join('\n');
}

class ZiWeiMain extends Component{
	constructor(props) {
		super(props);
		this.state = {
			result: null,
			rules: null,
			currentDirectionIndex: null,
			indicator: null,
			cnt: 0,
			tips: null,
		};

		this.unmounted = false;
		this.requestSeq = 0;
		this.lastFieldKey = buildZiWeiFieldKey(this.props.fields);
		this.lastRequestKey = '';

		this.requestZiWei = this.requestZiWei.bind(this);
		this.genParams = this.genParams.bind(this);
		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onChangeDirection = this.onChangeDirection.bind(this);
		this.getNowDirectionIdx = this.getNowDirectionIdx.bind(this);
		this.genDirectionDom = this.genDirectionDom.bind(this);
		this.indicate = this.indicate.bind(this);
		this.onTipClick = this.onTipClick.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				this.requestZiWei(fields);
			};
		}
	}

	onFieldsChange(field){
		if(this.props.dispatch && this.props.fields){
			let flds = {
				fields: {
					...this.props.fields,
					...field,
				}
			};
			this.props.dispatch({
				type: 'astro/save',
				payload: flds
			});
			this.lastFieldKey = buildZiWeiFieldKey(flds.fields);
			this.requestZiWei(flds.fields);
		}
	}

	onChangeDirection(value){
		let ind = this.state.indicator;
		let cnt = this.state.cnt;
		this.setState({
			currentDirectionIndex: value,
			indicator: ind,
			cnt: cnt+1,
		});
	}

	genParams(fields){
		let flds = fields ? fields : this.props.fields;
		const params = {
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm:ss'),
			zone: flds.zone.value,
			lon: flds.lon.value,
			lat: flds.lat.value,
			gpsLat: flds.gpsLat.value,
			gpsLon: flds.gpsLon.value,
			gender: flds.gender.value,
			after23NewDay: 0,
		}
		return params;
	}

	async requestZiWei(fields){
		if(fields === undefined || fields === null){
			return;
		}
		const requestKey = buildZiWeiFieldKey(fields);
		if(requestKey && this.lastRequestKey === requestKey){
			return;
		}
		this.lastRequestKey = requestKey;
		const seq = ++this.requestSeq;
		const params = this.genParams(fields);

		const data = await request(`${Constants.ServerRoot}/ziwei/birth`, {
			body: JSON.stringify(params),
		});
		if(this.unmounted || seq !== this.requestSeq){
			return;
		}
		const result = data[Constants.ResultKey]

		const rules = await request(`${Constants.ServerRoot}/ziwei/rules`, {
			body: JSON.stringify({}),
		});
		if(this.unmounted || seq !== this.requestSeq){
			return;
		}

		let currentIdx = this.getNowDirectionIdx(result.chart);

		const st = {
			result: result,
			rules: rules[Constants.ResultKey],
			currentDirectionIndex: currentIdx,
		};


		this.setState(st);
		this.lastFieldKey = requestKey;
		saveModuleAISnapshot('ziwei', buildZiWeiSnapshotText(params, result), {
			date: params.date,
			time: params.time,
			zone: params.zone,
			lon: params.lon,
			lat: params.lat,
		});
	}

	getNowDirectionIdx(chartobj){
		if(chartobj.birth === undefined || chartobj.birth === null){
			return null;
		}
		let now = new DateTime();
		let y = now.format('YYYY');
		let year = parseInt(y);
		let birth = parseInt(chartobj.birth.substr(0,4));
		let age = year - birth + 1;
		for(let i = 0; i<12; i++){
			let house = chartobj.houses[i];
			if(house.direction[0]<= age && age<=house.direction[1]){
				return i;
			}
		}
		return null;
	}

	genDirectionDom(chart){
		if(chart.houses === undefined || chart.houses === null){
			return null;
		}
		let startidx = chart.lifeHouseIndex;

		let dom = [];
		for(let i=0; i<12; i++){
			let idx = 0;
			if(ZiWeiHelper.isDirCloseWise(chart)){
				idx = (startidx + i) % 12;
			}else{
				idx = (startidx - i + 12) % 12;
			}
			let house = chart.houses[idx];
			let txt1 = house.direction[0] + '~' + house.direction[1];
			let txt2 = house.ganzi + '限';
			let lbl = (
				<Row>
					<Col span={24} style={{textAlign: 'center'}}>{txt1}</Col>
					<Col span={24} style={{textAlign: 'center'}}>{txt2}</Col>
				</Row>
			);
			let btntype = null;
			if(this.state.currentDirectionIndex !== null && this.state.currentDirectionIndex === idx){
				btntype = 'primary';
			}
			let rad = (
				<Col span={8} key={randomStr(8)}>
					<Button 
						type={btntype}
						onClick={()=>{this.onChangeDirection(idx);}} 
						style={{width: '100%', height: 50}}
					>
						{lbl}
					</Button>
				</Col>
			);
			dom.push(rad);
		}
		return dom;
	}

	indicate(zwIndicator){
		this.setState({
			indicator: zwIndicator,
		});
	}

	onTipClick(tipobj){
		this.setState({
			tips: tipobj,
		});
	}

	componentDidMount(){
		this.unmounted = false;
		if(this.props.fields){
			this.requestZiWei(this.props.fields);
		}
	}

	componentDidUpdate(){
		const nextKey = buildZiWeiFieldKey(this.props.fields);
		if(nextKey && nextKey !== this.lastFieldKey){
			this.lastFieldKey = nextKey;
			this.lastRequestKey = '';
			this.requestZiWei(this.props.fields);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		this.requestSeq++;
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 'calc(100% - 70px)'
		}else{
			height = height - 40
		}

		let chart = this.state.result ? this.state.result.chart : {};
		let dirIndex = this.state.currentDirectionIndex;
		let doms = this.genDirectionDom(chart);

		let tipheight = 270;
		let docwid = document.documentElement.clientWidth;
		if(docwid <= 1440){
			tipheight = 120;
		}

		return (
			<div>
				<Row gutter={6}>
					<Col span={16}>
						<ZiWeiChart 
							value={chart} 
							height={height} 
							fields={this.props.fields}  
							dirIndex={dirIndex}
							indicate={this.indicate}
							rules={this.state.rules}
							onTipClick={this.onTipClick}
						/>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>
								<ZiWeiInput 
									fields={this.props.fields} 
									onFieldsChange={this.onFieldsChange}
								/>
							</Col>
						</Row>
						<Divider />
						<Row>
							<Col span={24}>
								<Tabs defaultActiveKey="1" tabPosition='top'>
									<TabPane tab="行运" key="1">
										<Row>
											{doms}
										</Row>										
									</TabPane>
									<TabPane tab="资料参考" key="2">
										<ZWRuleMain height={height} rules={this.state.rules} />
									</TabPane>
								</Tabs>

							</Col>
						</Row>
						<Row>
							<Col span={24}>
								<TipsBoard 
									height={tipheight}
									value={this.state.tips} 
								/>
							</Col>
						</Row>
					</Col>
				</Row>
			</div>

		);
	}
}

export default ZiWeiMain;
