import { Component } from 'react';
import { Row, Col, Button, Divider, Select, InputNumber, Input, Checkbox, Modal, message } from 'antd';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import * as AstroConst from '../../constants/AstroConst';
import {randomStr, randomNum, littleEndian,} from '../../utils/helper';
import * as LRConst from '../liureng/LRConst';
import { ZSList, ZhangSheng, } from '../liureng/LRZhangSheng';
import ChuangChart from '../liureng/ChuangChart';
import LiuRengChart from './LiuRengChart';
import LiuRengInput from './LiuRengInput';
import LiuRengBirthInput from './LiuRengBirthInput';
import DateTime from '../comp/DateTime';
import { saveModuleAISnapshot, loadModuleAISnapshot } from '../../utils/moduleAiSnapshot';


const InputGroup = Input.Group;
const {Option} = Select;

function cloneDateTimeSafe(val, fallback){
	if(val && val instanceof DateTime){
		return val.clone();
	}
	if(fallback && fallback instanceof DateTime){
		return fallback.clone();
	}
	return new DateTime();
}

function cloneChartSnapshot(chartObj){
	if(!chartObj || typeof chartObj !== 'object'){
		return null;
	}
	try{
		return JSON.parse(JSON.stringify(chartObj));
	}catch(e){
		return chartObj;
	}
}

function buildBirthFields(source, fallbackNow){
	const now = fallbackNow && fallbackNow instanceof DateTime ? fallbackNow : new DateTime();
	const src = source || {};
	const dateVal = src.date && src.date.value ? cloneDateTimeSafe(src.date.value, now.startOf('date')) : now.startOf('date');
	const timeVal = src.time && src.time.value ? cloneDateTimeSafe(src.time.value, now) : now.clone();
	return {
		date: { value: dateVal },
		time: { value: timeVal },
		ad: { value: src.ad && src.ad.value !== undefined ? src.ad.value : now.ad },
		zone: { value: src.zone && src.zone.value ? src.zone.value : now.zone },
		lat: { value: src.lat && src.lat.value ? src.lat.value : Constants.DefLat },
		lon: { value: src.lon && src.lon.value ? src.lon.value : Constants.DefLon },
		gpsLat: { value: src.gpsLat && src.gpsLat.value !== undefined ? src.gpsLat.value : Constants.DefGpsLat },
		gpsLon: { value: src.gpsLon && src.gpsLon.value !== undefined ? src.gpsLon.value : Constants.DefGpsLon },
		gender: { value: src.gender && src.gender.value !== undefined ? src.gender.value : 1 },
		after23NewDay: { value: src.after23NewDay && src.after23NewDay.value !== undefined ? src.after23NewDay.value : 0 },
	};
}

function fmtValue(value){
	if(value === undefined || value === null || value === ''){
		return '无';
	}
	if(value instanceof Array){
		return value.join('、') || '无';
	}
	return `${value}`;
}

function cleanKey(key){
	const txt = `${key || ''}`;
	const idx = txt.indexOf('(');
	if(idx >= 0){
		return txt.substring(0, idx);
	}
	return txt;
}

function appendMapSection(lines, title, obj){
	lines.push(`[${title}]`);
	if(!obj || typeof obj !== 'object'){
		lines.push('无');
		lines.push('');
		return;
	}
	const keys = Object.keys(obj);
	if(keys.length === 0){
		lines.push('无');
		lines.push('');
		return;
	}
	keys.forEach((key)=>{
		lines.push(`${cleanKey(key)}：${fmtValue(obj[key])}`);
	});
	lines.push('');
}

function getChartYue(chartObj){
	if(!chartObj || !chartObj.objects){
		return '';
	}
	for(let i=0; i<chartObj.objects.length; i++){
		const obj = chartObj.objects[i];
		if(obj.id === AstroConst.SUN){
			return LRConst.getSignZi(obj.sign);
		}
	}
	return '';
}

function buildLiuRengLayout(chartObj, nongli, guirengType){
	if(!chartObj || !nongli || !nongli.time){
		return null;
	}
	const yue = getChartYue(chartObj);
	if(!yue){
		return null;
	}
	const downZi = LRConst.ZiList.slice(0);
	const upZi = LRConst.ZiList.slice(0);
	const yueIndexs = [];
	const timezi = nongli.time.substr(1);
	const yueIdx = LRConst.ZiList.indexOf(yue);
	const tmIdx = LRConst.ZiList.indexOf(timezi);
	if(yueIdx < 0 || tmIdx < 0){
		return null;
	}
	const delta = yueIdx - tmIdx;
	for(let i=0; i<12; i++){
		const idx = (i + delta + 12) % 12;
		yueIndexs[i] = idx;
		upZi[i] = LRConst.ZiList[idx];
	}

	const houseTianJiang = LRConst.TianJiang.slice(0);
	const guizi = LRConst.getGuiZi({
		nongli: {
			dayGanZi: nongli.dayGanZi,
		},
		isDiurnal: chartObj ? chartObj.isDiurnal : true,
	}, guirengType);
	let houseidx = 0;
	for(let i=0; i<12; i++){
		const zi = LRConst.ZiList[yueIndexs[i]];
		if(zi === guizi){
			houseidx = i;
			break;
		}
	}
	const housezi = LRConst.ZiList[houseidx];
	if(LRConst.SummerZiList.indexOf(housezi) >= 0){
		for(let i=0; i<12; i++){
			const idx = (houseidx - i + 12) % 12;
			houseTianJiang[i] = LRConst.TianJiang[idx];
		}
	}else{
		for(let i=0; i<12; i++){
			const idx = (i - houseidx + 12) % 12;
			houseTianJiang[i] = LRConst.TianJiang[idx];
		}
	}

	return {
		yue,
		timezi,
		guizi,
		downZi,
		upZi,
		houseTianJiang,
	};
}

function buildKeData(layout, nongli){
	const result = {
		raw: [],
		lines: [],
	};
	if(!layout || !nongli || !nongli.dayGanZi){
		return result;
	}
	const dayGanZi = nongli.dayGanZi;
	const daygan = dayGanZi.substr(0, 1);
	const dayzi = dayGanZi.substr(1, 1);

	const idx1 = layout.downZi.indexOf(LRConst.GanJiZi[daygan]);
	if(idx1 < 0){
		return result;
	}
	const ke1zi = layout.upZi[idx1];
	const ke1 = [layout.houseTianJiang[idx1], ke1zi, daygan];

	const idx2 = layout.downZi.indexOf(ke1zi);
	const ke2zi = idx2 >= 0 ? layout.upZi[idx2] : '';
	const ke2 = [idx2 >= 0 ? layout.houseTianJiang[idx2] : '', ke2zi, ke1zi];

	const idx3 = layout.downZi.indexOf(dayzi);
	const ke3zi = idx3 >= 0 ? layout.upZi[idx3] : '';
	const ke3 = [idx3 >= 0 ? layout.houseTianJiang[idx3] : '', ke3zi, dayzi];

	const idx4 = layout.downZi.indexOf(ke3zi);
	const ke4zi = idx4 >= 0 ? layout.upZi[idx4] : '';
	const ke4 = [idx4 >= 0 ? layout.houseTianJiang[idx4] : '', ke4zi, ke3zi];

	const all = [ke1, ke2, ke3, ke4];
	const names = ['一课', '二课', '三课', '四课'];
	all.forEach((item, idx)=>{
		result.lines.push(`${names[idx]}：地盘=${item[2]}，天盘=${item[1]}，贵神=${item[0]}`);
	});
	result.raw = all;
	return result;
}

function buildSanChuanData(layout, keRaw, nongli, chartObj){
	if(!layout || !keRaw || keRaw.length !== 4 || !nongli){
		return null;
	}
	try{
		const helper = new ChuangChart({
			owner: null,
			chartObj: {
				nongli: {
					dayGanZi: nongli.dayGanZi,
				},
				isDiurnal: chartObj ? chartObj.isDiurnal : true,
			},
			nongli: nongli,
			ke: keRaw,
			liuRengChart: {
				upZi: layout.upZi,
				downZi: layout.downZi,
				houseTianJiang: layout.houseTianJiang,
			},
			x: 0,
			y: 0,
			width: 0,
			height: 0,
		});
		helper.genCuangs();
		return helper.cuangs || null;
	}catch(e){
		return null;
	}
}

function buildLiuRengSnapshotText(params, liureng, runyear, chartObj, guirengType, zhangshengElem, gender){
	const lines = [];
	const nongli = liureng && liureng.nongli ? liureng.nongli : (chartObj && chartObj.nongli ? chartObj.nongli : {});
	const layout = buildLiuRengLayout(chartObj, nongli, guirengType);
	const keData = buildKeData(layout, nongli);
	const sanChuan = buildSanChuanData(layout, keData.raw, nongli, chartObj);
	const xingbie = `${gender}` === '1' ? '男' : '女';

	lines.push('[起盘信息]');
	if(params){
		lines.push(`日期：${params.date} ${params.time}`);
		lines.push(`时区：${params.zone}`);
		lines.push(`经纬度：${params.lon} ${params.lat}`);
	}
	if(nongli && nongli.birth){
		lines.push(`真太阳时：${nongli.birth}`);
	}
	if(liureng && liureng.fourColumns){
		const cols = liureng.fourColumns;
		lines.push(`四柱：${fmtValue(cols.year && cols.year.ganzi)}年 ${fmtValue(cols.month && cols.month.ganzi)}月 ${fmtValue(cols.day && cols.day.ganzi)}日 ${fmtValue(cols.time && cols.time.ganzi)}时`);
	}
	lines.push(`贵人体系：${guirengType === 0 ? '六壬法贵人' : (guirengType === 1 ? '遁甲法贵人' : '星占法贵人')}`);
	lines.push(`十二长生五行：${fmtValue(zhangshengElem)}`);
	lines.push(`问测人性别：${xingbie}`);
	lines.push('');

	lines.push('[十二地盘/十二天盘/十二贵神对应]');
	if(layout){
		for(let i=0; i<12; i++){
			lines.push(`${i + 1}. 地盘${layout.downZi[i]} -> 天盘${layout.upZi[i]} -> 贵神${layout.houseTianJiang[i]}`);
		}
	}else{
		lines.push('无');
	}
	lines.push('');

	lines.push('[四课]');
	if(keData.lines.length){
		keData.lines.forEach((line)=>lines.push(line));
	}else{
		lines.push('无');
	}
	lines.push('');

	lines.push('[三传]');
	if(sanChuan){
		lines.push(`课式：${fmtValue(sanChuan.name)}`);
		const names = ['初传', '中传', '末传'];
		for(let i=0; i<3; i++){
			const gz = sanChuan.cuang && sanChuan.cuang[i] ? sanChuan.cuang[i] : '无';
			const lq = sanChuan.liuQin && sanChuan.liuQin[i] ? sanChuan.liuQin[i] : '无';
			const gs = sanChuan.tianJiang && sanChuan.tianJiang[i] ? sanChuan.tianJiang[i] : '无';
			lines.push(`${names[i]}：干支=${gz}；六亲=${lq}；贵神=${gs}`);
		}
	}else{
		lines.push('无');
	}
	lines.push('');

	lines.push('[行年]');
	if(runyear){
		lines.push(`行年干支：${fmtValue(runyear.year)}`);
		lines.push(`年龄：${fmtValue(runyear.age)}岁`);
		lines.push(`性别：${xingbie}`);
	}else{
		lines.push('无');
	}
	lines.push('');

	appendMapSection(lines, '旬日', liureng ? liureng.xun : null);
	appendMapSection(lines, '旺衰', liureng ? liureng.season : null);
	appendMapSection(lines, '基础神煞', liureng ? liureng.gods : null);
	appendMapSection(lines, '干煞', liureng ? liureng.godsGan : null);
	appendMapSection(lines, '月煞', liureng ? liureng.godsMonth : null);
	appendMapSection(lines, '支煞', liureng ? liureng.godsZi : null);

	lines.push('[岁煞]');
	const yearGods = liureng && liureng.godsYear ? liureng.godsYear.taisui1 : null;
	if(yearGods){
		LRConst.TaiSui.forEach((name)=>{
			lines.push(`${name}：${fmtValue(yearGods[name])}`);
		});
	}else{
		lines.push('无');
	}
	lines.push('');

	lines.push('[十二长生]');
	if(zhangshengElem){
		ZSList.forEach((item)=>{
			const key = `${zhangshengElem}_${item}`;
			lines.push(`${item}：${fmtValue(ZhangSheng.wxphase[key])}`);
		});
	}else{
		lines.push('无');
	}
	return lines.join('\n').trim();
}

class LiuRengMain extends Component{
	constructor(props) {
		super(props);
		let now = new DateTime();
		let birth = buildBirthFields(this.props.fields, now);

		this.state = {
			birth: birth,
			liureng: null,
			runyear: null,
			wuxing: '土',
			guireng: 2,
			calcChart: null,
			isCalculating: false,
		};

		this.unmounted = false;

		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.onBirthChange = this.onBirthChange.bind(this);
		this.onWuXingChange = this.onWuXingChange.bind(this);
		this.onGuiRengChange = this.onGuiRengChange.bind(this);
		this.genWuXingDoms = this.genWuXingDoms.bind(this);
		this.genGodsParams = this.genGodsParams.bind(this);
		this.genRunYearParams = this.genRunYearParams.bind(this);
		this.requestGods = this.requestGods.bind(this);
		this.requestRunYear = this.requestRunYear.bind(this);
		this.saveLiuRengAISnapshot = this.saveLiuRengAISnapshot.bind(this);
		this.clickCalcCase = this.clickCalcCase.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);

		if(this.props.hook){
			this.props.hook.fun = ()=>{};
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
				type: 'astro/fetchByFields',
				payload: flds.fields
			});
		}
	}

	onBirthChange(field){
		let flds = {
			...this.state.birth,
			...field,
		};
		this.setState({
			birth: flds,
		});
	}

	onWuXingChange(val){
		this.setState({
			wuxing: val,
		}, ()=>{
			this.saveLiuRengAISnapshot(null, this.state.liureng, this.state.runyear, val, this.state.guireng);
		});
	}

	onGuiRengChange(val){
		this.setState({
			guireng: val,
		}, ()=>{
			this.saveLiuRengAISnapshot(null, this.state.liureng, this.state.runyear, this.state.wuxing, val);
		});
	}

	saveLiuRengAISnapshot(params, liureng, runyear, wuxing, guirengType){
		if(!liureng){
			return;
		}
		const flds = this.props.fields;
		const baseParams = params ? params : (flds ? this.genGodsParams(flds) : null);
		if(!baseParams){
			return;
		}
		const chartObj = this.state.calcChart ? this.state.calcChart : (this.props.value && this.props.value.chart ? this.props.value.chart : null);
		const finalZone = baseParams.zone !== undefined ? baseParams.zone : (flds && flds.zone ? flds.zone.value : '');
		const finalLon = baseParams.lon !== undefined ? baseParams.lon : (flds && flds.lon ? flds.lon.value : '');
		const finalLat = baseParams.lat !== undefined ? baseParams.lat : (flds && flds.lat ? flds.lat.value : '');
		const saveParams = {
			...baseParams,
			zone: finalZone,
			lon: finalLon,
			lat: finalLat,
		};
		saveModuleAISnapshot('liureng', buildLiuRengSnapshotText(
			saveParams,
			liureng,
			runyear,
			chartObj,
			guirengType,
			wuxing,
			this.state.birth && this.state.birth.gender ? this.state.birth.gender.value : 1
		), {
			date: saveParams.date,
			time: saveParams.time,
			zone: saveParams.zone,
			lon: saveParams.lon,
			lat: saveParams.lat,
		});
	}

	genRunYearParams(){
		let flds = this.state.birth;
		const params = {
			ad: flds.date.value.ad,
			date: flds.date.value.format('YYYY-MM-DD'),
			time: flds.time.value.format('HH:mm'),
			zone: flds.date.value.zone,
			lon: flds.lon.value,
			lat: flds.lat.value,
			gender: flds.gender.value,
			after23NewDay: flds.after23NewDay.value,
			guaYearGanZi: this.state.liureng.nongli.year,
		}
		return params;
	}

	genGodsParams(fields){
		let params = null;
		let flds = fields ? fields : this.props.fields;
		if(flds.params){
			let dtparts = flds.params.birth.split(' ');
			params = {
				...flds.params,
				date: dtparts[0],
				time: dtparts[1],
			};
	
		}else{
			params = {
				date: flds.date.value.format('YYYY-MM-DD'),
				time: flds.time.value.format('HH:mm'),
				zone: flds.date.value.zone,
				ad: flds.date.value.ad,
				lon: flds.lon.value,
				lat: flds.lat.value,
			};	
		}

		if(this.props.value){
			let chartObj = this.props.value.chart;
			if(chartObj){
				let yue = null;
				for(let i=0; i<chartObj.objects.length; i++){
					let obj = chartObj.objects[i];
					if(obj.id === AstroConst.SUN){
						yue = LRConst.getSignZi(obj.sign);
						break;
					}
				}	
				// params.yue = yue;	
				// params.isDiurnal = chartObj.isDiurnal;
			}
		}
		return params;
	}

	async requestGods(fields, chartSnapshot){
		if(fields === undefined || fields === null){
			return false;
		}
		const params = this.genGodsParams(fields);

		const data = await request(`${Constants.ServerRoot}/liureng/gods`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey]
		
		let dayGanZi = result.liureng.nongli.dayGanZi;
		let dayGan = dayGanZi.substr(0, 1);
		let wx = LRConst.GanZiWuXing[dayGan];
		const st = {
			liureng: result.liureng,
			wuxing: wx,
			calcChart: chartSnapshot || null,
		};

		return new Promise((resolve)=>{
			this.setState(st, ()=>{
				this.saveLiuRengAISnapshot(params, result.liureng, this.state.runyear, wx, this.state.guireng);
				resolve(true);
			});
		});
	}

	async requestRunYear(){
		if(this.state.liureng === null){
			return false;
		}
		
		const params = this.genRunYearParams();
		if(this.state.birth.date.value.year > this.props.fields.date.value.year){
			Modal.error({
				title: '出生年份必须小于卜卦年份'
			});
			return false;
		}

		const data = await request(`${Constants.ServerRoot}/liureng/runyear`, {
			body: JSON.stringify(params),
		});
		const result = data[Constants.ResultKey]

		let age = this.props.fields.date.value.year - this.state.birth.date.value.year;
		age = Math.floor(age / 60) * 60 + result.age;
		result.age = age;
		
		const st = {
			runyear: result,
		};

		return new Promise((resolve)=>{
			this.setState(st, ()=>{
				this.saveLiuRengAISnapshot(null, this.state.liureng, result, this.state.wuxing, this.state.guireng);
				resolve(true);
			});
		});
	}

	async clickCalcCase(){
		if(this.state.isCalculating){
			return;
		}
		if(!this.props.fields){
			return;
		}
		const chartSnapshot = cloneChartSnapshot(this.props.value && this.props.value.chart ? this.props.value.chart : null);
		this.setState({
			isCalculating: true,
		});
		try{
			const ok = await this.requestGods(this.props.fields, chartSnapshot);
			if(ok){
				await this.requestRunYear();
			}
		}finally{
			if(!this.unmounted){
				this.setState({
					isCalculating: false,
				});
			}
		}
	}

	clickSaveCase(){
		if(!this.state.liureng){
			message.warning('请先完成起课后再保存');
			return;
		}
		const flds = this.props.fields;
		if(!flds){
			return;
		}
		const divTime = `${flds.date.value.format('YYYY-MM-DD')} ${flds.time.value.format('HH:mm:ss')}`;
		const snapshot = loadModuleAISnapshot('liureng');
		const payload = {
			module: 'liureng',
			snapshot: snapshot,
			liureng: this.state.liureng,
			runyear: this.state.runyear,
			wuxing: this.state.wuxing,
			guireng: this.state.guireng,
		};
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caseadd',
					record: {
						event: `六壬占断 ${divTime}`,
						caseType: 'liureng',
						divTime: divTime,
						zone: flds.zone.value,
						lat: flds.lat.value,
						lon: flds.lon.value,
						gpsLat: flds.gpsLat.value,
						gpsLon: flds.gpsLon.value,
						pos: flds.pos ? flds.pos.value : '',
						payload: payload,
						sourceModule: 'liureng',
					},
				},
			});
		}
	}

	genWuXingDoms(){
		let res = LRConst.WuXing.map((item, idx)=>{
			return (
				<Option key={idx} value={item.elem}>十二长生：{item.elem}--{item.ganzi}</Option>
			);
		});
		return res;

	}

	componentDidMount(){
		this.unmounted = false;
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

		let chart = this.state.calcChart;

		let wxdoms = this.genWuXingDoms();
		return (
			<div>
				<Row gutter={6}>
					<Col span={16}>
						<LiuRengChart 
							value={chart} 
							liureng={this.state.liureng}
							runyear={this.state.runyear}
							gender={this.state.birth.gender.value}
							zhangshengElem={this.state.wuxing}
							guireng={this.state.guireng}
							height={height} 
							fields={this.props.fields}  
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
						/>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>
								<LiuRengInput 
									fields={this.props.fields} 
									onFieldsChange={this.onFieldsChange}
								/>
							</Col>
						</Row>
						<Row style={{ marginTop: 8 }}>
							<Col span={12}>
								<Button
									type='primary'
									style={{ width: '100%' }}
									onClick={this.clickCalcCase}
									loading={this.state.isCalculating}
								>
									起课
								</Button>
							</Col>
							<Col span={12}>
								<Button style={{ width: '100%' }} onClick={this.clickSaveCase}>保存</Button>
							</Col>
						</Row>
						<Divider orientation='left'>卜卦人出生时间</Divider>
						<Row>
							<Col span={24}>
								<LiuRengBirthInput 
									fields={this.state.birth} 
									onFieldsChange={this.onBirthChange}
								/>
							</Col>
						</Row>
						<Divider />
						<Row>
							<Col span={24}>
								<Select value={this.state.wuxing} onChange={this.onWuXingChange} style={{width: '100%'}}>
									{wxdoms}
								</Select>
							</Col>
							<Col span={24}>
								<Select value={this.state.guireng} onChange={this.onGuiRengChange} style={{width: '100%'}}>
									<Option value={0}>六壬法贵人</Option>
									<Option value={1}>遁甲法贵人</Option>
									<Option value={2}>星占法贵人</Option>
								</Select>
							</Col>
						</Row>

					</Col>
				</Row>
			</div>

		);
	}
}

export default LiuRengMain;
