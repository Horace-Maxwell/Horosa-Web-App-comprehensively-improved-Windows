import { Component } from 'react';
import { Row, Col, Button, Divider, } from 'antd';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import {randomStr,} from '../../utils/helper';
import * as AstroConst from '../../constants/AstroConst';
import TipsBoard from '../comp/TipsBoard';
import GuoLaoInput from './GuoLaoInput';
import GuoLaoChart from './GuoLaoChart';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import * as AstroText from '../../constants/AstroText';
import * as SZConst from '../suzhan/SZConst';
import * as Su28Helper from '../su28/Su28Helper';

const SIMPLE_TOKEN_MAP = {
	A: '日',
	B: '月',
	C: '水',
	D: '金',
	E: '火',
	F: '木',
	G: '土',
	H: '天王',
	I: '海王',
	J: '冥王',
	K: '北交',
	L: '南交',
	p: '福点',
	v: '暗月',
	w: '紫气',
	y: '凯龙',
	z: '月亮朔望点',
	Y: '月亮平均远地点',
	$: '月亮平均近地点',
	a: '白羊',
	b: '金牛',
	c: '双子',
	d: '巨蟹',
	e: '狮子',
	f: '处女',
	g: '天秤',
	h: '天蝎',
	i: '射手',
	j: '摩羯',
	k: '水瓶',
	l: '双鱼',
	0: '上升',
	1: '天顶',
	2: '天底',
	3: '下降',
	4: '谷神星',
	5: '智神星',
	6: '婚神星',
	7: '灶神星',
	8: '人龙星',
};

function splitDegree(degree){
	let d = Number(degree);
	if(Number.isNaN(d)){
		return [0, 0];
	}
	if(d < 0){
		d += 360;
	}
	const deg = Math.floor(d % 30);
	const min = Math.floor(((d % 30) - deg) * 60);
	return [deg, min];
}

function isEncodedToken(text){
	return /^[A-Za-z0-9${}]$/.test((text || '').trim());
}

function msg(id){
	if(id === undefined || id === null){
		return '';
	}
	if(AstroText.AstroTxtMsg[id]){
		return AstroText.AstroTxtMsg[id];
	}
	if(AstroText.AstroMsg[id]){
		const val = AstroText.AstroMsg[id];
		if(!isEncodedToken(val)){
			return `${val}`;
		}
	}
	const one = `${id}`.trim();
	if(one.length === 1 && SIMPLE_TOKEN_MAP[one]){
		return SIMPLE_TOKEN_MAP[one];
	}
	return `${id}`;
}

function buildGuolaoSnapshotText(params, result){
	const lines = [];
	const chart = result && result.chart ? result.chart : {};
	const houses = chart.houses || [];
	const objects = chart.objects || [];
	const signsRA = result && result.signsRA ? result.signsRA : [];
	const ziGods = result && result.nongli && result.nongli.bazi && result.nongli.bazi.guolaoGods
		? result.nongli.bazi.guolaoGods.ziGods : null;

	lines.push('[起盘信息]');
	lines.push(`日期：${params.date} ${params.time}`);
	lines.push(`时区：${params.zone}`);
	lines.push(`经纬度：${params.lon} ${params.lat}`);

	lines.push('');
	lines.push('[宫位与星体]');
	houses.forEach((house, idx)=>{
		lines.push(`宫位：${msg(house.id) || `第${idx + 1}宫`}`);
		const inHouse = objects.filter((obj)=>obj.house === house.id);
		if(inHouse.length === 0){
			lines.push('星体：无');
			lines.push('');
			return;
		}
		inHouse.forEach((obj)=>{
			const sd = splitDegree(obj.signlon);
			const su28 = obj.su28 ? `，宿:${obj.su28}` : '';
			lines.push(`星体：${msg(obj.id)} ${sd[0]}˚${msg(obj.sign)}${sd[1]}分${su28}`);
		});
		lines.push('');
	});

	if(signsRA.length){
		lines.push('');
		lines.push('[宫位二十八宿]');
		signsRA.forEach((sig)=>{
			lines.push(`${msg(sig.id)}：赤经${Math.round(sig.ra * 1000) / 1000}`);
		});
	}

	if(ziGods){
		lines.push('');
		lines.push('[神煞]');
		Object.keys(ziGods).forEach((zi)=>{
			const one = ziGods[zi] || {};
		const all = one.allGods || [];
		const tai = one.taisuiGods || [];
		lines.push(`${zi}：神煞=${all.join('、') || '无'}；太岁神=${tai.join('、') || '无'}`);
	});
	}
	return lines.join('\n');
}

function buildGuolaoSuSection(result, planetDisplay){
	const chart = result && result.chart ? result.chart : {};
	const suHouses = chart && chart.fixedStarSu28 ? chart.fixedStarSu28 : [];
	const objects = chart && chart.objects ? chart.objects : [];
	const lines = [];
	let visibleSet = null;
	if(planetDisplay && planetDisplay.length){
		visibleSet = new Set(planetDisplay);
	}

	suHouses.forEach((su)=>{
		lines.push(`${su.name}`);
		let inSu = objects.filter((obj)=>{
			if(obj.su28 !== su.name){
				return false;
			}
			if(visibleSet){
				return visibleSet.has(obj.id);
			}
			return AstroConst.isTraditionPlanet(obj.id);
		});
		inSu = inSu.sort((a, b)=>{
			if(a.ra > 300 && b.ra < 30){
				return -1;
			}
			return a.ra - b.ra;
		});
		if(inSu.length === 0){
			lines.push('星体：无');
			lines.push('');
			return;
		}
		inSu.forEach((obj)=>{
			let radeg = Number(obj.ra) - Number(su.ra);
			if(Number.isNaN(radeg)){
				radeg = Number(obj.signlon);
			}
			if(radeg < 0){
				radeg += 360;
			}
			const sd = splitDegree(radeg);
			lines.push(`星体：${msg(obj.id)} ${sd[0]}˚${obj.su28}${sd[1]}分`);
		});
		lines.push('');
	});

	return lines.join('\n').trim();
}

function signFromLon(lon){
	if(lon === undefined || lon === null || Number.isNaN(Number(lon))){
		return null;
	}
	let val = Number(lon) % 360;
	if(val < 0){
		val += 360;
	}
	const idx = Math.floor(val / 30) % 12;
	return AstroConst.LIST_SIGNS[idx];
}

function houseStartModeName(mode){
	return mode === SZConst.SZHouseStart_ASC ? 'ASC起盘' : '八字公式起盘';
}

function resolveHouseStartMode(fields){
	if(fields && fields.houseStartMode && fields.houseStartMode.value !== undefined && fields.houseStartMode.value !== null){
		return parseInt(fields.houseStartMode.value, 10) === SZConst.SZHouseStart_ASC
			? SZConst.SZHouseStart_ASC : SZConst.SZHouseStart_Bazi;
	}
	return SZConst.SZHouseStart_Bazi;
}

function computeAscSignIndex(result, chart, fields){
	const objects = chart && chart.objects ? chart.objects : [];
	const asc = objects.find((obj)=>obj.id === AstroConst.ASC);
	const sun = objects.find((obj)=>obj.id === AstroConst.SUN);
	if(!asc){
		return -1;
	}
	const ascIdx = Math.floor(Number(asc.ra) / 30);
	const mode = resolveHouseStartMode(fields);
	if(mode === SZConst.SZHouseStart_ASC){
		return ascIdx;
	}
	const bazi = (chart && chart.nongli && chart.nongli.bazi)
		|| (result && result.nongli && result.nongli.bazi);
	if(!bazi || !sun){
		return ascIdx;
	}
	const timezi = bazi.time && bazi.time.branch ? bazi.time.branch.cell : null;
	const timesig = timezi ? SZConst.ZiSign[timezi] : null;
	const tmsigidx = timesig ? AstroConst.LIST_SIGNS.indexOf(timesig) : -1;
	if(tmsigidx < 0){
		return ascIdx;
	}
	const sunidx = Math.floor(Number(sun.ra) / 30);
	return (sunidx - tmsigidx - 5 + 24) % 12;
}

function houseFullLabel(house, idx, ascSignIndex){
	let houseName = msg(house && house.id ? house.id : null) || `第${idx + 1}宫`;
	const sign = signFromLon(house ? house.lon : null);
	if(!sign){
		return houseName;
	}
	const signIdx = AstroConst.LIST_SIGNS.indexOf(sign);
	if(signIdx >= 0 && ascSignIndex >= 0){
		const hnum = (signIdx - ascSignIndex + 12) % 12 + 1;
		houseName = `第${hnum}宫`;
	}
	const zi = SZConst.SignZi[sign] || '';
	const area = (SZConst.SZSigns[signIdx] && SZConst.SZSigns[signIdx].length >= 2)
		? `${SZConst.SZSigns[signIdx][0]}${SZConst.SZSigns[signIdx][1]}`
		: '';
	const signName = AstroText.AstroMsgCN[sign] || msg(sign);
	return `${zi}—${area}—${signName}座—${houseName}`;
}

function buildHouseSuAndGodsSection(result, planetDisplay, fields){
	const chart = result && result.chart ? result.chart : {};
	const houses = chart && chart.houses ? chart.houses : [];
	const objects = chart && chart.objects ? chart.objects : [];
	const ascSignIndex = computeAscSignIndex(result, chart, fields);
	let visibleSet = null;
	if(planetDisplay && planetDisplay.length){
		visibleSet = new Set(planetDisplay);
	}
	const lines = [];

	houses.forEach((house, idx)=>{
		lines.push(`宫位：${houseFullLabel(house, idx, ascSignIndex)}`);
		let inHouse = objects.filter((obj)=>{
			if(obj.house !== house.id){
				return false;
			}
			if(visibleSet){
				return visibleSet.has(obj.id);
			}
			return AstroConst.isTraditionPlanet(obj.id);
		});
		inHouse = inHouse.sort((a, b)=>{
			if(a.ra > 300 && b.ra < 30){
				return -1;
			}
			return a.ra - b.ra;
		});

		const sign = signFromLon(house.lon);

		if(inHouse.length === 0){
			lines.push('二十八宿：无');
			lines.push('星曜：无');
			lines.push('');
			return;
		}
		const suMap = new Map();
		inHouse.forEach((obj)=>{
			const su = obj.su28 || '未知宿';
			if(!suMap.has(su)){
				suMap.set(su, []);
			}
			suMap.get(su).push(obj);
		});

		const suKeys = Array.from(suMap.keys()).sort((a, b)=>{
			const ia = Su28Helper.Su28.indexOf(a);
			const ib = Su28Helper.Su28.indexOf(b);
			if(ia < 0 && ib < 0){
				return `${a}`.localeCompare(`${b}`);
			}
			if(ia < 0){
				return 1;
			}
			if(ib < 0){
				return -1;
			}
			return ia - ib;
		});

		suKeys.forEach((su)=>{
			const list = suMap.get(su) || [];
			lines.push(`二十八宿：${su}`);
			list.forEach((obj)=>{
				let radeg = Number(obj.ra);
				if(!Number.isNaN(radeg)){
					const suRef = (chart.fixedStarSu28 || []).find((it)=>it.name === su);
					if(suRef && suRef.ra !== undefined && suRef.ra !== null){
						radeg = Number(obj.ra) - Number(suRef.ra);
						if(radeg < 0){
							radeg += 360;
						}
					}else{
						radeg = Number(obj.signlon);
					}
				}else{
					radeg = Number(obj.signlon);
				}
				const sd = splitDegree(radeg);
				lines.push(`星曜：${msg(obj.id)} ${sd[0]}˚${su}${sd[1]}分`);
			});
		});
		lines.push('');
	});
	return lines.join('\n').trim();
}

function buildHouseGodsSection(result, fields){
	const chart = result && result.chart ? result.chart : {};
	const houses = chart && chart.houses ? chart.houses : [];
	const ascSignIndex = computeAscSignIndex(result, chart, fields);
	const rootZiGods = result && result.nongli && result.nongli.bazi && result.nongli.bazi.guolaoGods
		? result.nongli.bazi.guolaoGods.ziGods : null;
	const chartZiGods = chart && chart.nongli && chart.nongli.bazi && chart.nongli.bazi.guolaoGods
		? chart.nongli.bazi.guolaoGods.ziGods : null;
	const ziGods = chartZiGods || rootZiGods || null;
	const lines = [];

	houses.forEach((house, idx)=>{
		lines.push(`宫位：${houseFullLabel(house, idx, ascSignIndex)}`);
		const sign = signFromLon(house.lon);
		const zi = sign ? SZConst.SignZi[sign] : null;
		const gz = ziGods && zi ? ziGods[zi] : null;
		const allGods = gz ? []
			.concat(gz.goodGods || [])
			.concat(gz.neutralGods || [])
			.concat(gz.badGods || []) : [];
		const taiGods = gz ? (gz.taisuiGods || []) : [];
		lines.push(`神煞：${allGods.join('、') || '无'}`);
		lines.push(`太岁神：${taiGods.join('、') || '无'}`);
		lines.push('');
	});

	return lines.join('\n').trim();
}

function buildGuolaoSnapshotTextV2(params, result, planetDisplay, fields){
	const lines = [];
	const chart = result && result.chart ? result.chart : {};
	const rootZiGods = result && result.nongli && result.nongli.bazi && result.nongli.bazi.guolaoGods
		? result.nongli.bazi.guolaoGods.ziGods : null;
	const chartZiGods = chart && chart.nongli && chart.nongli.bazi && chart.nongli.bazi.guolaoGods
		? chart.nongli.bazi.guolaoGods.ziGods : null;
	const ziGods = chartZiGods || rootZiGods || null;

	lines.push('[起盘信息]');
	lines.push(`日期：${params.date} ${params.time}`);
	lines.push(`时区：${params.zone}`);
	lines.push(`经纬度：${params.lon} ${params.lat}`);
	if(fields && fields.houseStartMode){
		lines.push(`人事十二宫起盘：${houseStartModeName(fields.houseStartMode.value)}`);
	}
	lines.push('');

	lines.push('[七政四余宫位与二十八宿星曜]');
	lines.push(buildHouseSuAndGodsSection(result, planetDisplay, fields) || '无');
	lines.push('');
	lines.push('[神煞]');
	lines.push(buildHouseGodsSection(result, fields) || '无');
	return lines.join('\n').trim();
}

function fieldsToParams(fields){
	const params = {
		date: fields.date.value.format('YYYY/MM/DD'),
		time: fields.time.value.format('HH:mm:ss'),
		zone: fields.zone.value,
		lat: fields.lat.value,
		lon: fields.lon.value,
		gpsLat: fields.gpsLat.value,
		gpsLon: fields.gpsLon.value,
		hsys: 0,
		zodiacal: 0,
		tradition: fields.tradition.value,
		doubingSu28: fields.doubingSu28.value,
		strongRecption: fields.strongRecption.value,
		simpleAsp: fields.simpleAsp.value,
		virtualPointReceiveAsp: fields.virtualPointReceiveAsp.value,
		predictive: 0,
		name: fields.name.value,
		pos: fields.pos.value,
	};

	return params;
}


class GuoLaoChartMain extends Component{
	constructor(props) {
		super(props);
		this.state = {
			chartObj: null,
			tips: null,
		};

		this.unmounted = false;

		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.requestChart = this.requestChart.bind(this);
		this.requestChartObj = this.requestChartObj.bind(this);
		this.genParams = this.genParams.bind(this);
		this.onTipClick = this.onTipClick.bind(this);
		this.saveGuolaoAISnapshot = this.saveGuolaoAISnapshot.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				this.requestChartObj(fields);
			};
		}
	}

	async requestChart(params){
		const data = await request(`${Constants.ServerRoot}/chart`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey]

		const st = {
			chartObj: result,
		};

		this.setState(st);
		this.saveGuolaoAISnapshot(params, result);
	}

	saveGuolaoAISnapshot(params, result){
		const p = params || this.genParams();
		const r = result || this.state.chartObj;
		if(!p || !r){
			return;
		}
		saveModuleAISnapshot('guolao', buildGuolaoSnapshotTextV2(p, r, this.props.planetDisplay, this.props.fields), {
			date: p.date,
			time: p.time,
			zone: p.zone,
			lon: p.lon,
			lat: p.lat,
		});
	}

	requestChartObj(fields){
		let params = null;
		if(fields){
			params = fieldsToParams(fields);
		}else{
			params = this.genParams();
		}
		this.requestChart(params);
	}

	genParams(){
		let fields = this.props.fields;
		let params = fieldsToParams(fields);
		return params;
	}

	onFieldsChange(field){
		if(this.props.dispatch && this.props.fields){
			let flds = {
				fields: {
					...this.props.fields,
					...field,
					nohook: false,
				}
			};
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: flds.fields
			});
		}
	}

	onTipClick(tipobj){
		this.setState({
			tips: tipobj,
		});
	}

	componentDidMount(){
		this.unmounted = false;
		if(this.props.fields){
			this.requestChartObj();
		}
	}

	componentDidUpdate(prevProps){
		if(prevProps.planetDisplay !== this.props.planetDisplay){
			this.saveGuolaoAISnapshot(null, this.state.chartObj);
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 'calc(100% - 70px)'
		}else{
			height = height - 20
		}

		let chartObj = this.state.chartObj;
		let chart = chartObj ? chartObj.chart : {};
		chart.aspects = chartObj ? chartObj.aspects : {};
		chart.lots = chartObj ? chartObj.lots : [];

		let tipheight = 270;
		let docwid = document.documentElement.clientWidth;
		if(docwid <= 1440){
			tipheight = 120;
		}

		return (
			<div>
				<Row gutter={6}>
					<Col span={16}>
						<GuoLaoChart 
							value={chart} 
							height={height} 
							fields={this.props.fields}  
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
							onTipClick={this.onTipClick}
						/>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>
								<GuoLaoInput 
									fields={this.props.fields} 
									onFieldsChange={this.onFieldsChange}
								/>
							</Col>
						</Row>
						<Divider />
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

export default GuoLaoChartMain;
