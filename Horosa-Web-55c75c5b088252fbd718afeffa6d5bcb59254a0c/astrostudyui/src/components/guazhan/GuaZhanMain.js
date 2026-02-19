import { Component } from 'react';
import { Row, Col, Button, Divider, Select, InputNumber, Input, Checkbox, Tabs, message } from 'antd';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import * as AstroConst from '../../constants/AstroConst';
import {randomStr, randomNum, littleEndian,} from '../../utils/helper';
import GuaZhanInput from './GuaZhanInput';
import GuaZhanChart from './GuaZhanChart';
import GuaDesc from './GuaDesc';
import { getGua64, Gua64, Gua8, randYao, ZiList, HourZi, SixGods, getXunEmpty } from '../gua/GuaConst';
import DateTime from '../comp/DateTime';
import { saveModuleAISnapshot, loadModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { getStore } from '../../utils/storageutil';
import { fetchPreciseNongli } from '../../utils/preciseCalcBridge';
import { setNongliLocalCache } from '../../utils/localCalcCache';
import styles from '../../css/styles.less';

const InputGroup = Input.Group;
const {Option} = Select;
const { TabPane } = Tabs;

function guaText(gua){
	if(!gua){
		return '';
	}
	const ord = gua.ord !== undefined ? `第${gua.ord}卦` : '';
	const house = gua.house ? `${gua.house.name || ''}宫${gua.house.elem || ''}` : '';
	return `${ord} ${gua.name || ''} ${gua.desc || ''} ${house}`.trim();
}

function lineText(line){
	if(line === undefined || line === null){
		return '';
	}
	return `${line}`.trim();
}

function buildGuaSnapshotText(fields, st){
	const lines = [];
	const nowGua = st && st.currentGua !== null && Gua64[st.currentGua] ? Gua64[st.currentGua] : null;
	const yao = st && st.yao ? st.yao : [];
	const nongli = st && st.nongli ? st.nongli : {};
	const guaDesc = st && st.guaDesc ? st.guaDesc : {};
	const fieldTime = (fields && fields.date && fields.time)
		? `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`
		: '';
	const startTime = lineText(nongli.birth) || fieldTime;
	const yearGz = lineText(nongli.yearJieqi || nongli.year || nongli.yearGanZi);
	const monthGz = lineText(nongli.monthGanZi);
	const dayGz = lineText(nongli.dayGanZi);
	const timeGz = lineText(nongli.time || nongli.timeGanZi);
	const monthXunEmpty = monthGz.length >= 2 ? getXunEmpty(monthGz.substr(0, 1), monthGz.substr(1, 1)) : '';
	const dayXunEmpty = dayGz.length >= 2 ? getXunEmpty(dayGz.substr(0, 1), dayGz.substr(1, 1)) : '';

	lines.push('[起盘信息]');
	if(fieldTime){
		lines.push(`日期：${fieldTime}`);
	}
	if(fields && fields.zone){
		lines.push(`时区：${fields.zone.value}`);
	}
	if(fields && fields.lon && fields.lat){
		lines.push(`经纬度：${fields.lon.value} ${fields.lat.value}`);
	}
	if(startTime){
		lines.push(`起卦时间：${startTime}${timeGz ? ` ${timeGz}时` : ''}`);
	}
	if(yearGz || monthGz || dayGz || timeGz){
		lines.push(`干支：年${yearGz || '无'} 月${monthGz || '无'} 日${dayGz || '无'} 时${timeGz || '无'}`);
	}
	if(monthXunEmpty || dayXunEmpty){
		lines.push(`旬空：月空${monthXunEmpty || '无'} 日空${dayXunEmpty || '无'}`);
	}

	lines.push('');
	lines.push('[卦象]');
	if(nowGua){
		lines.push(`本卦：${guaText(nowGua)}`);
	}else{
		lines.push('本卦：未生成');
	}
	if(guaDesc.guaMiddle){
		lines.push(`互卦：${guaText(guaDesc.guaMiddle)}`);
	}
	if(guaDesc.guaRes){
		lines.push(`之卦：${guaText(guaDesc.guaRes)}`);
	}

	lines.push('');
	lines.push('[六爻与动爻]');
	if(!yao || yao.length === 0){
		lines.push('暂无爻线数据');
	}else{
		yao.forEach((item, idx)=>{
			const yaoType = item.value === 1 ? '阳爻' : (item.value === 0 ? '阴爻' : '未定');
			const moving = item.change ? '（动）' : '（静）';
			const god = item.god ? `，六神:${item.god}` : '';
			const name = item.name ? `，爻名:${item.name}` : '';
			lines.push(`第${idx + 1}爻：${yaoType}${moving}${god}${name}`);
		});
	}

	lines.push('');
	lines.push('[卦辞与断语]');
	['guaOrg', 'guaMiddle', 'guaRes'].forEach((key)=>{
		const one = guaDesc[key];
		if(!one){
			return;
		}
		const label = key === 'guaOrg' ? '本卦' : (key === 'guaMiddle' ? '互卦' : '之卦');
		lines.push(`${label}：${guaText(one)}`);
		if(one['卦辞']){
			lines.push(`卦辞：${one['卦辞']}`);
		}
		if(one['彖']){
			lines.push(`彖曰：${one['彖']}`);
		}
		if(one['象']){
			lines.push(`象曰：${one['象']}`);
		}
		const yaoci = one['爻辞'] || [];
		const yaox = one['爻象'] || [];
		yaoci.forEach((text, idx)=>{
			const xiang = yaox[idx] ? `；象曰：${yaox[idx]}` : '';
			lines.push(`第${idx + 1}爻辞：${text}${xiang}`);
		});
		lines.push('');
	});

	return lines.join('\n');
}

class GuaZhanMain extends Component{
	constructor(props) {
		super(props);

		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.genYao = this.genYao.bind(this);
		this.randomYao = this.randomYao.bind(this);
		this.randomGua = this.randomGua.bind(this);
		this.genGua = this.genGua.bind(this);
		this.genGua64OptDom = this.genGua64OptDom.bind(this);
		this.changeGua = this.changeGua.bind(this);
		this.filterGua = this.filterGua.bind(this);
		this.getCurrentGua = this.getCurrentGua.bind(this);
		this.setupYao = this.setupYao.bind(this);
		this.emptyYao = this.emptyYao.bind(this);
		this.getYaoColor = this.getYaoColor.bind(this);
		this.genParams = this.genParams.bind(this);
		this.genTimeGua = this.genTimeGua.bind(this);
		this.clickTimeGua = this.clickTimeGua.bind(this);
		this.genGua8Doms = this.genGua8Doms.bind(this);
		this.upGuaIdxChanged = this.upGuaIdxChanged.bind(this);
		this.downGuaIdxChanged = this.downGuaIdxChanged.bind(this);
		this.custGuaDongYaoChanged = this.custGuaDongYaoChanged.bind(this);
		this.numGuaDongYaoChanged = this.numGuaDongYaoChanged.bind(this);
		this.numberChanged = this.numberChanged.bind(this);
		this.clickCustGua = this.clickCustGua.bind(this);
		this.clickNumGua = this.clickNumGua.bind(this);
		this.genFields = this.genFields.bind(this);
		this.dongyaoChanged = this.dongyaoChanged.bind(this);
		this.getDongYaos = this.getDongYaos.bind(this);
		this.fillYaoGods = this.fillYaoGods.bind(this);
		this.getGuasId = this.getGuasId.bind(this);
		this.getTimeFieldsFromSelector = this.getTimeFieldsFromSelector.bind(this);
		this.requestGuaDescReturn = this.requestGuaDescReturn.bind(this);
		this.requestGuaDesc = this.requestGuaDesc.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.parseCasePayload = this.parseCasePayload.bind(this);
		this.restoreFromCurrentCase = this.restoreFromCurrentCase.bind(this);

		this.state = {
			yao: this.emptyYao(),
			btnDisabled: [false, false, false, false, false, false],
			btnName: [
				'随机一爻', '随机二爻', '随机三爻', '随机四爻', '随机五爻', '随机六爻'
			],
			btnGenGua: '整卦随机',
			currentGua: null,
			nongli: null,
			custGuaDongYao: -1,
			numGuaDongYao: -1,
			upGuaIdx: null,
			downGuaIdx:null,
			number: null,
			guaDesc: null,
		};

		this.unmounted = false;
		this.lastRestoredCaseId = null;
		this.timeHook = {};
		this.genColor = [AstroConst.AstroColor.Stroke, '#a01306', '#948e33', '#7b5cbc', '#0b0e66'];
		this.colorIndex = 0;
		this.periodTask = null;
		this.guaPeriodTask = null;

		if(this.props.hook){
			this.props.hook.fun = (fields)=>{
				if(this.unmounted){
					return;
				}
				this.restoreFromCurrentCase();
			};
		}
	}

	parseCasePayload(raw){
		if(!raw){
			return null;
		}
		if(typeof raw === 'string'){
			try{
				return JSON.parse(raw);
			}catch(e){
				return null;
			}
		}
		if(typeof raw === 'object'){
			return raw;
		}
		return null;
	}

	restoreFromCurrentCase(force){
		const store = getStore();
		const userState = store && store.user ? store.user : null;
		const currentCase = userState && userState.currentCase ? userState.currentCase : null;
		if(!currentCase || !currentCase.cid || !currentCase.cid.value){
			return;
		}
		const cid = `${currentCase.cid.value}`;
		const updateTime = currentCase.updateTime && currentCase.updateTime.value ? `${currentCase.updateTime.value}` : '';
		const caseVersion = `${cid}|${updateTime}`;
		if(!force && this.lastRestoredCaseId === caseVersion){
			return;
		}
		const sourceModule = currentCase.sourceModule ? currentCase.sourceModule.value : null;
		const caseType = currentCase.caseType ? currentCase.caseType.value : null;
		if(sourceModule !== 'guazhan' && caseType !== 'liuyao'){
			return;
		}
		const payload = this.parseCasePayload(currentCase.payload ? currentCase.payload.value : null);
		if(!payload){
			return;
		}
		const rawState = payload.gua && typeof payload.gua === 'object'
			? payload.gua
			: (payload.state && typeof payload.state === 'object' ? payload.state : null);
		if(!rawState){
			return;
		}
		const empty = this.emptyYao();
		const rawYao = rawState.yao instanceof Array ? rawState.yao : [];
		const yao = empty.map((item, idx)=>{
			const one = rawYao[idx] || {};
			const value = one.value === 0 || one.value === 1 ? one.value : item.value;
			return {
				...item,
				value: value,
				change: !!one.change,
				name: one.name !== undefined ? one.name : item.name,
				god: one.god !== undefined ? one.god : item.god,
				color: one.color || item.color,
			};
		});
		const nextState = {
			yao: yao,
			currentGua: rawState.currentGua !== undefined ? rawState.currentGua : null,
			nongli: rawState.nongli && typeof rawState.nongli === 'object' ? rawState.nongli : null,
			guaDesc: rawState.guaDesc && typeof rawState.guaDesc === 'object' ? rawState.guaDesc : null,
			custGuaDongYao: rawState.custGuaDongYao !== undefined ? rawState.custGuaDongYao : -1,
			numGuaDongYao: rawState.numGuaDongYao !== undefined ? rawState.numGuaDongYao : -1,
			upGuaIdx: rawState.upGuaIdx !== undefined ? rawState.upGuaIdx : null,
			downGuaIdx: rawState.downGuaIdx !== undefined ? rawState.downGuaIdx : null,
			number: rawState.number !== undefined ? rawState.number : null,
		};
		this.lastRestoredCaseId = caseVersion;
		this.setState(nextState, ()=>{
			if(!this.state.guaDesc && this.state.currentGua !== null){
				this.requestGuaDesc();
			}
		});
	}

	clickTimeGua(fields){
		const flds = this.genFields(fields);
		if(!flds){
			return;
		}
		if(!fields){
			const patch = this.getTimeFieldsFromSelector();
			if(patch){
				this.onFieldsChange(patch);
			}
		}
		this.requestNongli(flds);
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

	getTimeFieldsFromSelector(){
		if(!this.timeHook || !this.timeHook.getValue){
			return null;
		}
		const raw = this.timeHook.getValue();
		const dt = raw && raw.value && raw.value instanceof DateTime
			? raw.value
			: (raw && raw.time && raw.time instanceof DateTime ? raw.time : null);
		if(!dt){
			return null;
		}
		return {
			date: { value: dt.clone() },
			time: { value: dt.clone() },
			ad: { value: dt.ad },
			zone: { value: dt.zone },
		};
	}

	genFields(baseFields){
		const flds = {
			...(baseFields || this.props.fields || {}),
		};
		const patch = this.getTimeFieldsFromSelector();
		if(patch){
			return {
				...flds,
				...patch,
			};
		}
		return flds;
	}

	getGuasId(){
		let guaIdx = this.state.currentGua;
		if(guaIdx === null){
			return null;
		}
		let gua = Gua64[guaIdx];
		if(gua === undefined || gua === null){
			return null;
		}
		let yaos = gua.value.slice(0);
		let orgId = yaos.join('');

		let dongs = this.getDongYaos();
		for(let i=0; i<dongs.length; i++){
			let idx = dongs[i];
			yaos[idx] = yaos[idx] ? 0 : 1;
		}
		let resId = yaos.join('');

		yaos = [];
		yaos[0] = gua.value[1];
		yaos[1] = gua.value[2];
		yaos[2] = gua.value[3];
		yaos[3] = gua.value[2];
		yaos[4] = gua.value[3];
		yaos[5] = gua.value[4];
		let middleId = yaos.join('');

		let obj = {
			guaOrg: orgId,
			guaRes: resId,
			guaMiddle: middleId,
		};

		return obj;
	}

	async requestGuaDescReturn(){
		let desc = null;
		let guaids = this.getGuasId();
		if(guaids){
			let params = {
				name: [guaids.guaOrg, guaids.guaRes, guaids.guaMiddle],
			};
			
			const descdata = await request(`${Constants.ServerRoot}/gua/desc`, {
				body: JSON.stringify(params),
			});
	
			const descresult = descdata[Constants.ResultKey];
	
			desc = {
				guaOrg: descresult[guaids.guaOrg],
				guaRes: descresult[guaids.guaRes],
				guaMiddle: descresult[guaids.guaMiddle],
			};
		}

		return desc;
	}

	async requestGuaDesc(){
		let desc = await this.requestGuaDescReturn();
		this.setState({
			guaDesc: desc,
		});
	}

	async requestNongli(fields, completeHandle){
		if(fields === undefined || fields === null){
			return;
		}
		const params = this.genParams(fields);
		const result = await fetchPreciseNongli(params);
		if(!result){
			return;
		}
		setNongliLocalCache(params, result);

		const st = {
			nongli: result,
		};

		this.setState(st, ()=>{
			if(completeHandle){
				completeHandle()
			}else{
				this.genTimeGua();
			}
		});
	}

	genTimeGua(){
		let nl = this.state.nongli;
		if(nl === undefined || nl === null){
			return;
		}

		let y = ZiList.indexOf(nl.year.substr(1)) + 1;
		let m = nl.monthInt;
		let d = nl.dayInt;
		let t = ZiList.indexOf(nl.time.substr(1)) + 1;
		let up = (y+m+d) % 8 - 1;
		let down = (y+m+d+t) % 8 - 1;
		up = up < 0 ? 7 : up;
		down = down < 0 ? 7 : down;
		let cyao = (y+m+d+t) % 6 - 1;
		cyao = cyao < 0 ? 5 : cyao;

		let upGua = Gua8[up];
		let downGua = Gua8[down];
		let yao = this.emptyYao();

		for(let i=0; i<downGua.value.length; i++){
			yao[i].value = downGua.value[i];
		}
		for(let i=0; i<upGua.value.length; i++){
			yao[i+3].value = upGua.value[i];
		}
		yao[cyao].change = true;
		let guaidx = this.getCurrentGua(yao);
		this.setupYao(yao, guaidx);	

		this.setState({
			yao: yao,
			currentGua: guaidx,
		}, ()=>{
			this.requestGuaDesc();
		});						

	}

	clickNumGua(){
		if(this.state.number === undefined || this.state.number === null 
			|| this.state.number === '' || this.state.number < 0){
			return;
		}

		let nstr = this.state.number + '';
		let pos = Math.floor(nstr.length / 2);
		let upcnt = 0;
		let downcnt = 0;
		for(let i=0; i<pos; i++){
			let n = nstr.charAt(i);
			let v = new Number(n);
			upcnt = upcnt + v;
		}
		let up = upcnt % 8 - 1;
		up = up < 0 ? 7 : up;

		for(let i=pos; i<nstr.length; i++){
			let n = nstr.charAt(i);
			let v = new Number(n);
			downcnt = downcnt + v;
		}
		let down = downcnt % 8 - 1;
		down = down < 0 ? 7 : down;

		let dong = upcnt + downcnt;

		let upGua = Gua8[up];
		let downGua = Gua8[down];
		let yao = this.emptyYao();
		for(let i=0; i<3; i++){
			yao[i].value = downGua.value[i];
		}
		for(let i=0; i<3; i++){
			yao[i+3].value = upGua.value[i];
		}

		let idx = dong % 6 - 1;
		idx = idx < 0 ? 5 : idx;
		let dyOpt = this.state.numGuaDongYao;
		if(dyOpt === -1){
			let dt = new Date();
			let h = dt.getHours();
			let zi = HourZi[h];
			let ziidx = ZiList.indexOf(zi) + 1;
			idx = (dong + ziidx) % 6 - 1;
			idx = idx < 0 ? 5 : idx;
		}else if(dyOpt === -2){
			idx = (dong + randomNum()) % 6 - 1;
			idx = idx < 0 ? 5 : idx;
		}else if(dyOpt === -3){
			idx = dong % 6 - 1;
			idx = idx < 0 ? 5 : idx;
		}else{
			idx = dyOpt;
		}
		yao[idx].change = true;

		let guaidx = this.getCurrentGua(yao);
		this.setupYao(yao, guaidx);	

		let flds = this.genFields();
		this.requestNongli(flds, ()=>{
			this.setState({
				yao: yao,
				currentGua: guaidx,
			}, ()=>{
				this.requestGuaDesc();
			});							
		});
	}

	clickCustGua(){
		if(this.state.upGuaIdx === undefined || this.state.upGuaIdx === null || this.state.upGuaIdx === '' ||
			this.state.downGuaIdx === undefined || this.state.downGuaIdx === null || this.state.downGuaIdx === ''){
			return;
		}

		let up = Gua8[this.state.upGuaIdx];
		let down = Gua8[this.state.downGuaIdx];
		let yao = this.emptyYao();
		for(let i=0; i<3; i++){
			yao[i].value = down.value[i];
		}
		for(let i=0; i<3; i++){
			yao[i+3].value = up.value[i];
		}

		let idx = (this.state.upGuaIdx + 1 + this.state.downGuaIdx + 1) % 6 - 1;
		idx = idx < 0 ? 5 : idx;
		let dyOpt = this.state.custGuaDongYao;
		if(dyOpt === -1){
			let dt = new Date();
			let h = dt.getHours();
			let zi = HourZi[h];
			let ziidx = ZiList.indexOf(zi) + 1;
			idx = (this.state.upGuaIdx + 1 + this.state.downGuaIdx + 1 + ziidx) % 6 - 1;
			idx = idx < 0 ? 5 : idx;
		}else if(dyOpt === -2){
			idx = (this.state.upGuaIdx + 1 + this.state.downGuaIdx + 1 + randomNum()) % 6 - 1;
			idx = idx < 0 ? 5 : idx;
		}else if(dyOpt === -3){
			idx = (this.state.upGuaIdx + 1 + this.state.downGuaIdx + 1) % 6 - 1;
			idx = idx < 0 ? 5 : idx;
		}else{
			idx = dyOpt;
		}
		yao[idx].change = true;

		let guaidx = this.getCurrentGua(yao);
		this.setupYao(yao, guaidx);	

		let flds = this.genFields();
		this.requestNongli(flds, ()=>{
			this.setState({
				yao: yao,
				currentGua: guaidx,
			}, ()=>{
				this.requestGuaDesc();
			});							
		});
	}

	emptyYao(){
		let yao = [{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		},{
			value:-1, change:false, color:AstroConst.AstroColor.Stroke, name:null
		}];
		return yao;
	}

	getYaoColor(){
		return AstroConst.AstroColor.Stroke;
	}

	filterGua(value, option){
		const item = option.props.rec;
		let txt = item.name+'-'+item.house.name+'宫'+item.house.elem;
		if(txt.indexOf(value) >= 0){
			return true;
		}
		return false;
	}

	changeGua(value, option){
		let gua = Gua64[value];
		if(gua === undefined || gua === null){
			this.setState({
				yao: this.emptyYao(),
				currentGua: null,
				upGuaIdx: null,
				downGuaIdx: null,
				number: null,
				nongli: null,
				guaDesc: null,
			});
			return;
		}
		let yao = [];
		for(let i=0; i<gua.value.length; i++){
			yao[i] = {
				value: gua.value[i],
				name: gua.yaoname[i],
				color: this.getYaoColor()
			};
		}
		this.setState({
			yao: yao,
			currentGua: value,
		}, ()=>{
			this.requestGuaDesc();
		});
	}

	getCurrentGua(yaos){
		let bits = [];
		for(let i=0; i<yaos.length; i++){
			let yao = yaos[i];
			bits[i] = yao.value;
		}
		let key = littleEndian(bits);
		let gua = getGua64(key);
		if(gua){
			return gua.index;
		}
		return null;
	}

	setupYao(yaos, guaidx){
		if(guaidx === undefined || guaidx === null){
			return;
		}
		let gua = Gua64[guaidx];
		if(gua === undefined || gua === null){
			return;
		}
		for(let i=0; i<yaos.length; i++){
			yaos[i].name = gua.yaoname[i];
		}
	}

	genGua64OptDom(){
		let doms = Gua64.map((item, idx)=>{
			let txt = item.name+'-'+item.house.name+'宫'+item.house.elem;
			return (
				<Option value={idx} key={idx} rec={item}>{txt}</Option>
			);
		});

		return doms;
	}

	randomGua(stopAct){
		if(stopAct){
			if(this.guaPeriodTask !== null){
				clearInterval(this.guaPeriodTask);
				this.guaPeriodTask = null;
			}
			let yao = this.state.yao;
			let cnt = randomNum(2) % 10;
			while(cnt > 0){
				for(let i=0; i<yao.length; i++){
					let ryao = randYao();
					yao[i].value = ryao.value;
					yao[i].change = ryao.change;
					yao[i].color = this.getYaoColor();
				}
				cnt = cnt - 1;
			}
			let guaidx = this.getCurrentGua(yao);
			this.setupYao(yao, guaidx);

			let flds = this.genFields();
			this.requestNongli(flds, ()=>{
				this.setState({
					yao: yao,
					currentGua: guaidx,
				}, ()=>{
					this.requestGuaDesc();
				});							
			});
		}else{
			if(this.guaPeriodTask === null){
				this.guaPeriodTask = setInterval(()=>{
					let yao = this.state.yao;
					for(let i=0; i<yao.length; i++){
						let ryao = randYao();
						yao[i].value = ryao.value;
						yao[i].change = ryao.change;
						yao[i].color = this.getYaoColor();
					}
					let guaidx = this.getCurrentGua(yao);
					this.setupYao(yao, guaidx);	
					this.setState({
						yao: yao,
						currentGua: guaidx,
					});						
				}, 200);
			}
		}
	}

	randomYao(idx, stopAct){
		if(stopAct){
			if(this.periodTask !== null){
				clearInterval(this.periodTask);
				this.periodTask = null;
			}
			let yao = this.state.yao;
			let cnt = randomNum(2) % 50;
			let ryao = randYao();
			while(cnt > 0){
				ryao = randYao();
				cnt = cnt - 1;
			}
			yao[idx].value = ryao.value;
			yao[idx].change = ryao.change;
			yao[idx].color = this.getYaoColor();
			let guaidx = this.getCurrentGua(yao);
			this.setupYao(yao, guaidx);
			this.setState({
				yao: yao,
				currentGua: guaidx,
			});	

			let completGua = true;
			for(let i=0; i<yao.length; i++){
				if(yao[i].value < 0){
					completGua = false;
					break;
				}
			}			
			if(completGua){
				let flds = this.genFields();
				this.requestNongli(flds, ()=>{
					this.setState({
						yao: yao,
						currentGua: guaidx,
					}, ()=>{
						this.requestGuaDesc();
					});							
				});	
			}			
		}else{
			if(this.periodTask === null){
				this.periodTask = setInterval(() => {
					let yao = this.state.yao;
					let ryao = randYao();
					yao[idx].value = ryao.value;
					yao[idx].change = ryao.change;
					this.colorIndex = this.colorIndex + 1;
					let coloridx = this.colorIndex % this.genColor.length;
					yao[idx].color = this.genColor[coloridx];
					let guaidx = this.getCurrentGua(yao);
					this.setupYao(yao, guaidx);
					this.setState({
						yao: yao,
						currentGua: guaidx,
					});						
				}, 100);	
			}
		}
	}

	genGua(){
		let btnName = this.state.btnGenGua;
		let stopAct = false;
		let act = btnName.substr(0, 2);
		if(act === '停止'){
			stopAct = true;
			btnName = '整卦随机';
		}else{
			btnName = '停止随机';
		}

		this.setState({
			btnGenGua: btnName,
		}, ()=>{
			this.randomGua(stopAct);
		});

	}

	genYao(idx){
		let btnDisabled = this.state.btnDisabled;
		let btnName = this.state.btnName;
		let sz = btnDisabled.length;
		let stopAct = false;
		for(let i=0; i<sz; i++){
			let act = btnName[i].substr(0, 2);
			if(act === '停止'){
				stopAct = true;
				break;
			}
		}

		let str = btnName[idx].substr(2);
		if(stopAct){
			btnName[idx] = '随机' + str;
			for(let i=0; i<sz; i++){
				btnDisabled[i] = false;
			}
		}else{
			btnName[idx] = '停止' + str;
			for(let i=0; i<sz; i++){
				btnDisabled[i] = true;
			}
			btnDisabled[idx] = false;
		}

		this.setState({
			btnDisabled: btnDisabled,
			btnName: btnName,
		}, ()=>{
			this.randomYao(idx, stopAct);
		});
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

			this.clickTimeGua(flds.fields);
		}
	}

	genGua8Doms(){
		let doms = Gua8.map((item, idx)=>{
			return (
				<Option key={idx} value={idx}>{item.name+item.elem}</Option>
			);
		});
		return doms;
	}

	getDongYaos(){
		let values = [];
		for(let i=0; i<this.state.yao.length; i++){
			let obj = this.state.yao[i];
			if(obj.change){
				values.push(i);
			}
		}
		return values;
	}

	downGuaIdxChanged(val){
		this.setState({
			downGuaIdx: val,
		}, ()=>{
			this.clickCustGua();
		});
	}

	upGuaIdxChanged(val){
		this.setState({
			upGuaIdx: val,
		}, ()=>{
			this.clickCustGua();
		});		
	}

	custGuaDongYaoChanged(val){
		this.setState({
			custGuaDongYao: val,
		}, ()=>{
			this.clickCustGua();
		});		
	}

	numGuaDongYaoChanged(val){
		this.setState({
			numGuaDongYao: val,
		}, ()=>{
			this.clickNumGua();
		});		
	}

	numberChanged(val){
		this.setState({
			number: val,
		});
	}

	dongyaoChanged(checkedValues){
		let completGua = true;
		let yao = this.state.yao;
		for(let i=0; i<yao.length; i++){
			let obj = yao[i];
			if(obj.value < 0){
				completGua = false;
				break;
			}
		}
		if(completGua){
			for(let i=0; i<yao.length; i++){
				yao[i].change = false;
			}
			for(let i=0; i<checkedValues.length; i++){
				let val = checkedValues[i];
				yao[val].change = true;
			}
			this.setState({
				yao: yao,
			}, ()=>{
				this.requestGuaDesc();
			});
		}
	}

	fillYaoGods(yao){
		let nongli = this.state.nongli;
		if(nongli === undefined || nongli === null){
			return yao;
		}
		let daygan = nongli.dayGanZi.substr(0, 1);
		let gods = SixGods[daygan];
		let len = gods.length;
		for(let i=0; i<len; i++){
			yao[i].god = gods[i];
		}
		return yao;
	}

	componentDidMount(){
		this.unmounted = false;
		this.restoreFromCurrentCase(true);
	}

	componentDidUpdate(prevProps, prevState){
		this.restoreFromCurrentCase();
		if(prevProps.fields !== this.props.fields
			|| prevState.currentGua !== this.state.currentGua
			|| prevState.yao !== this.state.yao
			|| prevState.nongli !== this.state.nongli
			|| prevState.guaDesc !== this.state.guaDesc){
			saveModuleAISnapshot('guazhan', buildGuaSnapshotText(this.props.fields, this.state));
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
	}

	clickSaveCase(){
		if(this.state.currentGua === null){
			message.warning('请先完成起卦后再保存');
			return;
		}
		const flds = this.props.fields;
		if(!flds){
			return;
		}
		const divTime = `${flds.date.value.format('YYYY-MM-DD')} ${flds.time.value.format('HH:mm:ss')}`;
		const snapshot = loadModuleAISnapshot('guazhan');
		const guaState = {
			currentGua: this.state.currentGua,
			yao: this.state.yao,
			nongli: this.state.nongli,
			guaDesc: this.state.guaDesc,
			custGuaDongYao: this.state.custGuaDongYao,
			numGuaDongYao: this.state.numGuaDongYao,
			upGuaIdx: this.state.upGuaIdx,
			downGuaIdx: this.state.downGuaIdx,
			number: this.state.number,
		};
		const payload = {
			module: 'guazhan',
			version: 2,
			savedAt: new Date().toISOString(),
			snapshot: snapshot,
			gua: guaState,
		};
		if(this.props.dispatch){
			this.props.dispatch({
				type: 'astro/openDrawer',
				payload: {
					key: 'caseadd',
					record: {
						event: `六爻占断 ${divTime}`,
						caseType: 'liuyao',
						divTime: divTime,
						zone: flds.zone.value,
						lat: flds.lat.value,
						lon: flds.lon.value,
						gpsLat: flds.gpsLat.value,
						gpsLon: flds.gpsLon.value,
						pos: flds.pos ? flds.pos.value : '',
						payload: payload,
						sourceModule: 'guazhan',
					},
				},
			});
		}
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 'calc(100% - 70px)'
		}else{
			height = height - 20
		}

		let tabheight = height - 290;

		let chartObj = this.props.value;
		let chart = chartObj ? chartObj.chart : {};

		let opts = this.genGua64OptDom();

		let upopts = this.genGua8Doms();
		let downopts = this.genGua8Doms();

		let dyvalues = this.getDongYaos();
		let yao = this.fillYaoGods(this.state.yao);

		let guadesc = this.state.guaDesc;

		return (
			<div>
				<Row gutter={6}>
					<Col span={16}>
						<GuaZhanChart 
							value={chart} 
							height={height} 
							fields={this.props.fields}  
							nongli={this.state.nongli}
							yao={yao}
							chartDisplay={this.props.chartDisplay}
							planetDisplay={this.props.planetDisplay}
						/>
					</Col>
					<Col span={8}>
						<Row>
							<Col span={24}>
								<GuaZhanInput 
									fields={this.props.fields} 
									hook={this.timeHook}
									onFieldsChange={this.onFieldsChange}
								/>
							</Col>
						</Row>
						<Row style={{ marginTop: 8 }}>
							<Col span={24}>
								<Button style={{ width: '100%' }} onClick={this.clickSaveCase}>保存</Button>
							</Col>
						</Row>
						<Divider />
						<Row gutter={12} style={{marginBottom: 10}}>
							<Col span={24}>
								<Select 
									allowClear={true} showSearch={true} showArrow={true}
									placeholder='64卦'
									filterOption={this.filterGua}
									style={{width: '100%'}} 
									value={this.state.currentGua}
									onChange={this.changeGua}
								>
									{opts}
								</Select>
							</Col>
						</Row>

						<div style={{marginBottom: 10}}>
							<Checkbox.Group onChange={this.dongyaoChanged} value={dyvalues}>
								<Row gutter={12}>
									<Col span={12}><Checkbox value={0}>第一爻动</Checkbox></Col>
									<Col span={12}><Checkbox value={1}>第二爻动</Checkbox></Col>
									<Col span={12}><Checkbox value={2}>第三爻动</Checkbox></Col>
									<Col span={12}><Checkbox value={3}>第四爻动</Checkbox></Col>
									<Col span={12}><Checkbox value={4}>第五爻动</Checkbox></Col>
									<Col span={12}><Checkbox value={5}>第六爻动</Checkbox></Col>
								</Row>
							</Checkbox.Group>
						</div>

						<Tabs 
							defaultActiveKey='method' tabPosition='top'
							style={{ height: tabheight }}
						>
							<TabPane tab="起卦方式" key="method">
								<div className={styles.scrollbar} style={{height: tabheight}}>
									<Row gutter={12} style={{marginBottom:10}}>
										<Col span={12}>
											<Button onClick={()=>{this.clickTimeGua()}}>时间起卦</Button>
										</Col>
										<Col span={12}><Button onClick={this.genGua}>{this.state.btnGenGua}</Button></Col>
									</Row>
									<Row gutter={12}>
										<Col span={12}><Button disabled={this.state.btnDisabled[0]} onClick={()=>{this.genYao(0);}}>{this.state.btnName[0]}</Button></Col>
										<Col span={12}><Button disabled={this.state.btnDisabled[1]} onClick={()=>{this.genYao(1);}}>{this.state.btnName[1]}</Button></Col>
										<Col span={12}><Button disabled={this.state.btnDisabled[2]} onClick={()=>{this.genYao(2);}}>{this.state.btnName[2]}</Button></Col>
										<Col span={12}><Button disabled={this.state.btnDisabled[3]} onClick={()=>{this.genYao(3);}}>{this.state.btnName[3]}</Button></Col>
										<Col span={12}><Button disabled={this.state.btnDisabled[4]} onClick={()=>{this.genYao(4);}}>{this.state.btnName[4]}</Button></Col>
										<Col span={12}><Button disabled={this.state.btnDisabled[5]} onClick={()=>{this.genYao(5);}}>{this.state.btnName[5]}</Button></Col>
									</Row>
									<Row gutter={12} style={{marginTop: 20}}>
										<Col span={12}>
											<InputNumber style={{width: '100%'}} value={this.state.number} onChange={this.numberChanged} min={0} />
										</Col>
										<Col span={12}><Button style={{width:'90%'}} onClick={this.clickNumGua}>数字起卦</Button></Col>
										<Col span={24}>
											<Select onChange={this.numGuaDongYaoChanged} value={this.state.numGuaDongYao} style={{width:'95%'}}>
												<Option value={-3}>数字直接决定动爻</Option>
												<Option value={-2}>附加一个随机数决定动爻</Option>
												<Option value={-1}>附加时辰决定动爻</Option>
												<Option value={0}>第一动爻</Option>
												<Option value={1}>第二动爻</Option>
												<Option value={2}>第三动爻</Option>
												<Option value={3}>第四动爻</Option>
												<Option value={4}>第五动爻</Option>
												<Option value={5}>第六动爻</Option>
											</Select>

										</Col>
									</Row>

									<Row gutter={12} style={{marginTop: 20}}>
										<Col span={12}>
											<InputGroup compact>
												<label style={{ width: '40%', fontSize:18 }}>上卦</label>
												<Select style={{ width: '60%' }}
													allowClear={true} 
													value={this.state.upGuaIdx}
													onChange={this.upGuaIdxChanged}
												>
													{upopts}
												</Select>
											</InputGroup>
										</Col>
										<Col span={12}>
											<InputGroup compact>
												<label style={{ width: '40%', fontSize:18 }}>下卦</label>
												<Select style={{ width: '60%' }}
													allowClear={true} 
													value={this.state.downGuaIdx}
													onChange={this.downGuaIdxChanged}
												>
													{downopts}
												</Select>
											</InputGroup>							
										</Col>
									</Row>
									<Row gutter={12} >
										<Col span={15}>
											<Select onChange={this.custGuaDongYaoChanged} value={this.state.custGuaDongYao} style={{width:'100%'}}>
												<Option value={-3}>先天卦数直接决定动爻</Option>
												<Option value={-2}>附加一个随机数决定动爻</Option>
												<Option value={-1}>附加时辰决定动爻</Option>
												<Option value={0}>第一动爻</Option>
												<Option value={1}>第二动爻</Option>
												<Option value={2}>第三动爻</Option>
												<Option value={3}>第四动爻</Option>
												<Option value={4}>第五动爻</Option>
												<Option value={5}>第六动爻</Option>
											</Select>
										</Col>
										<Col span={9}>
											<Button style={{width:'98%'}} onClick={this.clickCustGua}>自定义起卦</Button>
										</Col>

									</Row>
								</div>
							</TabPane>

							<TabPane tab="卦辞" key="gua">
								<GuaDesc height={tabheight} value={guadesc} />
							</TabPane>
						</Tabs>

					</Col>
				</Row>
			</div>

		);
	}
}

export default GuaZhanMain;
