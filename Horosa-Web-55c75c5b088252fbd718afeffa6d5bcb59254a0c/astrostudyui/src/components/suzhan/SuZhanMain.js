import { Component } from 'react';
import { Row, Col, Button, Divider, } from 'antd';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import {randomStr,} from '../../utils/helper';
import * as AstroText from '../../constants/AstroText';
import * as AstroConst from '../../constants/AstroConst';
import * as SZConst from './SZConst';
import * as Su28Helper from '../su28/Su28Helper';
import SuZhanInput from './SuZhanInput';
import SuZhanChart from './SuZhanChart';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';

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

function chartTypeName(type){
	const map = {};
	map[SZConst.SZChart_NoExternChart] = '无外盘';
	map[SZConst.SZChart_SignChart] = '星座外盘';
	map[SZConst.SZChart_FengYeChart] = '分野外盘';
	map[SZConst.SZChart_BaGuaChart] = '八卦外盘';
	map[SZConst.SZChart_DunJiaChart] = '遁甲外盘';
	map[SZConst.SZChart_TaiYiChart] = '太乙外盘';
	map[SZConst.SZChart_FangWeiChart] = '方位外盘';
	map[SZConst.SZChart_NiXiangChart] = '逆向外盘';
	return map[type] || `${type}`;
}

function chartShapeName(shape){
	return shape === SZConst.SZChart_Circle ? '圆形盘' : '方形盘';
}

function houseStartModeName(mode){
	return mode === SZConst.SZHouseStart_ASC ? 'ASC起盘' : '八字公式起盘';
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

function resolveHouseStartMode(fields){
	if(fields && fields.houseStartMode && fields.houseStartMode.value !== undefined && fields.houseStartMode.value !== null){
		return parseInt(fields.houseStartMode.value, 10) === SZConst.SZHouseStart_ASC
			? SZConst.SZHouseStart_ASC : SZConst.SZHouseStart_Bazi;
	}
	return SZConst.SZHouseStart_Bazi;
}

function computeAscSignIndex(rootObj, chart, fields){
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
		|| (rootObj && rootObj.nongli && rootObj.nongli.bazi);
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

function buildHouseObjectLines(chart){
	const lines = [];
	const houses = chart.houses || [];
	const objects = chart.objects || [];
	houses.forEach((house)=>{
		lines.push(`${msg(house.id)}`);
		const inHouse = objects.filter((obj)=>obj.house === house.id);
		if(inHouse.length === 0){
			lines.push('星体：无');
			return;
		}
		inHouse.forEach((obj)=>{
			const sd = splitDegree(obj.signlon);
			const su28 = obj.su28 ? `，宿:${obj.su28}` : '';
			lines.push(`星体：${msg(obj.id)} ${sd[0]}˚${msg(obj.sign)}${sd[1]}分${su28}`);
		});
	});
	return lines;
}

function buildSu28ObjectLines(chart, planetDisplay){
	const lines = [];
	const suHouses = chart && chart.fixedStarSu28 ? chart.fixedStarSu28 : [];
	const objects = chart && chart.objects ? chart.objects : [];
	const suMap = new Map();
	suHouses.forEach((su)=>{
		suMap.set(su.name, su);
	});

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

	return lines;
}

function buildHouseSuLines(rootObj, chart, planetDisplay, fields){
	const lines = [];
	const houses = chart && chart.houses ? chart.houses : [];
	const objects = chart && chart.objects ? chart.objects : [];
	const ascSignIndex = computeAscSignIndex(rootObj, chart, fields);
	let visibleSet = null;
	if(planetDisplay && planetDisplay.length){
		visibleSet = new Set(planetDisplay);
	}

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

	return lines;
}

function buildSuzhanSnapshotText(chartObj, fields, planetDisplay){
	const lines = [];
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};

	lines.push('[起盘信息]');
	if(fields && fields.date && fields.time){
		lines.push(`日期：${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`);
	}
	if(fields && fields.zone){
		lines.push(`时区：${fields.zone.value}`);
	}
	if(fields && fields.lon && fields.lat){
		lines.push(`经纬度：${fields.lon.value} ${fields.lat.value}`);
	}
	if(fields && fields.szchart){
		lines.push(`外盘：${chartTypeName(fields.szchart.value)}`);
	}
	if(fields && fields.szshape){
		lines.push(`盘型：${chartShapeName(fields.szshape.value)}`);
	}
	if(fields && fields.doubingSu28){
		lines.push(`宿法：${fields.doubingSu28.value === 1 ? '斗柄定房法' : '现实距星法'}`);
	}
	if(fields && fields.houseStartMode){
		lines.push(`人事十二宫起盘：${houseStartModeName(fields.houseStartMode.value)}`);
	}

	lines.push('');
	lines.push('[宿盘宫位与二十八宿星曜]');
	lines.push(...buildHouseSuLines(chartObj, chart, planetDisplay, fields));

	return lines.join('\n');
}

function buildQimenSnapshotText(chartObj, fields){
	const lines = [];
	const chart = chartObj && chartObj.chart ? chartObj.chart : {};

	lines.push('[起盘信息]');
	if(fields && fields.date && fields.time){
		lines.push(`日期：${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`);
	}
	if(fields && fields.zone){
		lines.push(`时区：${fields.zone.value}`);
	}
	if(fields && fields.lon && fields.lat){
		lines.push(`经纬度：${fields.lon.value} ${fields.lat.value}`);
	}
	lines.push('盘型：奇门(遁甲外盘)');
	if(fields && fields.doubingSu28){
		lines.push(`宿法：${fields.doubingSu28.value === 1 ? '斗柄定房法' : '现实距星法'}`);
	}
	if(fields && fields.houseStartMode){
		lines.push(`人事十二宫起盘：${houseStartModeName(fields.houseStartMode.value)}`);
	}

	lines.push('');
	lines.push('[九宫与宫内星体]');
	lines.push(...buildHouseObjectLines(chart));

	return lines.join('\n');
}


class SuZhanMain extends Component{
	constructor(props) {
		super(props);
		this.state = {

		};

		this.unmounted = false;

		this.onFieldsChange = this.onFieldsChange.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
			};
		}
	}

	onFieldsChange(field){
		if(this.props.onFieldsChange){
			this.props.onFieldsChange(field);
			return;
		}
		if(this.props.dispatch && this.props.fields){
			let flds = {
				fields: {
					...this.props.fields,
					...field,
				}
			};
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: flds.fields
			});
		}
	}

	componentDidMount(){
		this.unmounted = false;
		if(this.props.fields){
			saveModuleAISnapshot('suzhan', buildSuzhanSnapshotText(this.props.value, this.props.fields, this.props.planetDisplay));
			if(this.props.fields.szchart && this.props.fields.szchart.value === SZConst.SZChart_DunJiaChart){
				saveModuleAISnapshot('qimen', buildQimenSnapshotText(this.props.value, this.props.fields));
			}
		}
	}

	componentDidUpdate(prevProps){
		if(prevProps.value !== this.props.value || prevProps.fields !== this.props.fields || prevProps.planetDisplay !== this.props.planetDisplay){
			saveModuleAISnapshot('suzhan', buildSuzhanSnapshotText(this.props.value, this.props.fields, this.props.planetDisplay));
			if(this.props.fields && this.props.fields.szchart && this.props.fields.szchart.value === SZConst.SZChart_DunJiaChart){
				saveModuleAISnapshot('qimen', buildQimenSnapshotText(this.props.value, this.props.fields));
			}
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

		let chartObj = this.props.value;
		let chart = chartObj ? chartObj.chart : {};
		chart.aspects = chartObj ? chartObj.aspects : {};
		chart.lots = chartObj ? chartObj.lots : [];

		return (
			<div>
				<Row gutter={6}>
					<Col span={16}>
						<SuZhanChart 
							value={chart} 
							height={height} 
							fields={this.props.fields}  
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
						/>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>
								<SuZhanInput 
									fields={this.props.fields} 
									onFieldsChange={this.onFieldsChange}
								/>
							</Col>
						</Row>
						<Divider />
					</Col>
				</Row>
			</div>

		);
	}
}

export default SuZhanMain;
