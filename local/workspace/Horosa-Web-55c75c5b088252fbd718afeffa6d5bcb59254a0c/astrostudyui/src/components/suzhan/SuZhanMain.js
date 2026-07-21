import { Component } from 'react';
import { sideSectionIcon } from '../../constants/sideSectionIcons'; // [观象P1]
import { safeLocalStorageSet } from '../../utils/safeStorage';
import { message } from 'antd';
import DateTime from '../comp/DateTime';
import QuickDockBar from '../common/QuickDockBar';
import * as Constants from '../../utils/constants';
import request from '../../utils/request';
import {randomStr,} from '../../utils/helper';
import * as AstroText from '../../constants/AstroText';
import * as AstroConst from '../../constants/AstroConst';
import * as SZConst from './SZConst';
import * as Su28Helper from '../su28/Su28Helper';
import SuZhanInput from './SuZhanInput';
import SuZhanChart from './SuZhanChart';
import { saveModuleAISnapshot, saveModuleAISnapshotLazy, } from '../../utils/moduleAiSnapshot';
import { openKentangCaseDrawer, getKentangSavedCasePayload } from '../../utils/kentangCaseSave';
import { XQTabs as Tabs, XQSideSection  } from '../xq-ui';
import XQIcon from '../xq-icons';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { markPanelReady } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';

const { TabPane } = Tabs;

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

export function buildHouseObjectLines(chart){
	const lines = [];
	const houses = chart.houses || [];
	const objects = chart.objects || [];
	if(houses.length === 0){
		return lines;
	}
	lines.push('| 宫位 | 星体 | 度 | 座 | 分 | 宿 |');
	lines.push('| --- | --- | --- | --- | --- | --- |');
	houses.forEach((house)=>{
		const inHouse = objects.filter((obj)=>obj.house === house.id);
		if(inHouse.length === 0){
			lines.push(`| ${msg(house.id)} | 无 | — | — | — | — |`);
			return;
		}
		inHouse.forEach((obj, k)=>{
			const sd = splitDegree(obj.signlon);
			lines.push(`| ${k === 0 ? msg(house.id) : '—'} | ${msg(obj.id)} | ${sd[0]} | ${msg(obj.sign)} | ${sd[1]} | ${obj.su28 || '—'} |`);
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
			// [X1·P2-12] 环形序须对称全序:跨 0°RA 的宫,300°+ 侧在前、30°- 侧在后,两向都要判;
			// 旧版只判一侧(非对称比较器,Array.sort 行为未定义 → 宫内列序随实现漂移)。
			if(a.ra > 300 && b.ra < 30){ return -1; }
			if(b.ra > 300 && a.ra < 30){ return 1; }
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

// [v2 排版] 宫宿三行组(宫位：/二十八宿：/星曜：×12 宫)折叠成 GFM 表行(经归一器直通、docx/PDF 渲染真表)。
// 单一真值仍是 buildHouseSuLines(UI「宫宿」tab 与本表同源共用,故不动原函数,只做排版折叠):
// 单元格值=原行全角冒号后文本逐字搬运(一宫多宿/多曜以「、」并列;空宫沿用原「无」),数值零变更。
function foldHouseSuLinesToTable(suLines){
	const rows = [];
	let cur = null;
	(suLines || []).forEach((line)=>{
		const t = `${line || ''}`;
		if(t.indexOf('宫位：') === 0){
			cur = { house: t.slice('宫位：'.length), su: [], stars: [] };
			rows.push(cur);
			return;
		}
		if(!cur){
			return;
		}
		if(t.indexOf('二十八宿：') === 0){
			cur.su.push(t.slice('二十八宿：'.length));
			return;
		}
		if(t.indexOf('星曜：') === 0){
			cur.stars.push(t.slice('星曜：'.length));
		}
	});
	if(!rows.length){
		return [];
	}
	const out = ['| 宫位 | 二十八宿 | 星曜 |', '| --- | --- | --- |'];
	rows.forEach((r)=>{
		out.push(`| ${r.house} | ${r.su.join('、') || '无'} | ${r.stars.join('、') || '无'} |`);
	});
	return out;
}

export function buildSuzhanSnapshotText(chartObj, fields, planetDisplay){
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
	lines.push(...foldHouseSuLinesToTable(buildHouseSuLines(chartObj, chart, planetDisplay, fields)));

	return lines.join('\n');
}

// [MU parity] 宿盘遁甲外盘曾把薄快照(仅 [起盘信息]+[九宫与宫内星体])写进共享奇门模块槽,
// latest-wins 覆盖真奇门(DunJia)快照 → 奇门导出吐错内容+丢真奇门 17 段;且 [九宫与宫内星体] 是奇门
// 旧段名(真奇门现产 [九宫方盘]/[旺相休囚死·月令能量]),不在奇门 preset。已删该跨模块写入与其专用 builder。
// 遁甲外盘型已在 buildSuzhanSnapshotText 的 [起盘信息] 以「外盘：遁甲外盘」标注,足够 AI 识别。

function fieldValue(fields, key, fallback = null){
	if(!fields || !fields[key] || fields[key].value === undefined || fields[key].value === null){
		return fallback;
	}
	return fields[key].value;
}

function buildSuZhanCaseOptions(fields){
	return {
		szchart: fieldValue(fields, 'szchart', SZConst.SZChart.chart),
		szshape: fieldValue(fields, 'szshape', SZConst.SZChart.shape),
		doubingSu28: fieldValue(fields, 'doubingSu28', 0),
		houseStartMode: fieldValue(fields, 'houseStartMode', SZConst.SZChart.houseStartMode),
	};
}


class SuZhanMain extends Component{
	constructor(props) {
		super(props);
		this.state = {
			rightPanelTab: 'overview',
		};

		this.unmounted = false;

		this.onFieldsChange = this.onFieldsChange.bind(this);
		this.restoreFromCurrentCase = this.restoreFromCurrentCase.bind(this);
		this.clickSaveCase = this.clickSaveCase.bind(this);
		this.setRightPanelTab = this.setRightPanelTab.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

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

	restoreFromCurrentCase(force){
		const saved = getKentangSavedCasePayload('suzhan');
		if(!saved || !saved.payload){
			return false;
		}
		if(!force && this.lastRestoredCaseId === saved.caseVersion){
			return false;
		}
		const payload = saved.payload;
		const options = payload.options && typeof payload.options === 'object' ? payload.options : {};
		const patch = {};
		['szchart', 'szshape', 'doubingSu28', 'houseStartMode'].forEach((key)=>{
			if(options[key] !== undefined && options[key] !== null){
				patch[key] = { value: options[key] };
			}
		});
		if(patch.szchart){
			SZConst.SZChart.chart = parseInt(patch.szchart.value, 10);
			safeLocalStorageSet('suzhanChartType', patch.szchart.value);
		}
		if(patch.szshape){
			SZConst.SZChart.shape = parseInt(patch.szshape.value, 10);
			safeLocalStorageSet('suzhanChartShape', patch.szshape.value);
		}
		if(patch.houseStartMode){
			const houseStartMode = parseInt(patch.houseStartMode.value, 10) === SZConst.SZHouseStart_ASC
				? SZConst.SZHouseStart_ASC : SZConst.SZHouseStart_Bazi;
			patch.houseStartMode.value = houseStartMode;
			SZConst.SZChart.houseStartMode = houseStartMode;
			safeLocalStorageSet('suzhanHouseStartMode', houseStartMode);
		}
		this.lastRestoredCaseId = saved.caseVersion;
		if(Object.keys(patch).length > 0 && this.props.dispatch){
			this.props.dispatch({
				type: 'astro/fetchByFields',
				payload: {
					...(this.props.fields || {}),
					...patch,
				},
			});
		}
		if(payload.snapshot){
			saveModuleAISnapshot('suzhan', payload.snapshot);
		}
		return Object.keys(patch).length > 0;
	}

	clickSaveCase(){
		if(!this.props.fields){
			message.warning('当前宿盘资料未就绪');
			return;
		}
		const snapshot = buildSuzhanSnapshotText(this.props.value, this.props.fields, this.props.planetDisplay);
		openKentangCaseDrawer({
			dispatch: this.props.dispatch,
			fields: this.props.fields,
			module: 'suzhan',
			label: '宿盘',
			payload: {
				options: buildSuZhanCaseOptions(this.props.fields),
				chart: this.props.value || null,
				snapshot,
			},
		});
	}

	// [PERF-R9 Ship 6] 重 wrapper sCU（照 AstroChartMain / BaZi / GuaZhanMain 既有范式）——
	// 全 props 机械浅比（函数型视为恒等，详 wrapperPropsEqual；开关 horosa.perf.chartSCU 关=恒重渲旧行为），
	// state 换引用照常重渲（setState 恒换引用，故本组件自身任何状态变化一律不受影响）。
	// 收益：容器（CnYiBuMain / AuxChartMain）的 dock 每动作补三拍 forceUpdate —— forceUpdate 只跳过
	// 自身 sCU，子组件的照跑 —— 此后这三拍不再重建本重组件的整棵 JSX。
	// 🔴 正确性：只在【全部 props 逐键相等】时跳过；键数不等 / 任一非函数键换引用即返 true。
	//    本组件不依赖【父重渲】来拉模块级可变态：农历远程缓存走 subscribeRemoteNongli → this.forceUpdate()，
	//    forceUpdate 本就绕过自身 sCU，故不会因本改动而漏刷。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	componentDidMount(){
		this.unmounted = false;
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		if(this.restoreFromCurrentCase(true)){
			return;
		}
		if(this.props.fields){
			const value = this.props.value;
			const fields = this.props.fields;
			const planetDisplay = this.props.planetDisplay;
			// [MU parity] 只写自己的 'suzhan' 槽;遁甲外盘详情作为宿盘的图变体,不再写共享 'qimen' 槽
			// (旧行为 latest-wins 把真奇门(DunJia)的快照覆盖成宿盘薄外盘 → qimen 导出吐错内容+丢真奇门段)。
			// 外盘型已在 buildSuzhanSnapshotText 的 [起盘信息] 标注「外盘：遁甲外盘」。
			saveModuleAISnapshotLazy('suzhan', ()=>buildSuzhanSnapshotText(value, fields, planetDisplay));
		}
	}

	componentDidUpdate(prevProps){
		// horosa_panel_ready_v1:宿盘之中栏(SuZhanChart)与右栏(概览/宫宿/快照)全由 props 纯派生 ——
		// 没有「取数落定」的那一次 setState,故就绪点=这些 props 变更所引发的这一次 commit。
		// 放在 restoreFromCurrentCase 早退之前:载入事盘也是一次真实的画完。
		if(prevProps.value !== this.props.value || prevProps.fields !== this.props.fields
			|| prevProps.planetDisplay !== this.props.planetDisplay || prevProps.chartDisplay !== this.props.chartDisplay){
			markPanelReady('cnyibu');
		}
		if(this.restoreFromCurrentCase(false)){
			return;
		}
		if(prevProps.value !== this.props.value || prevProps.fields !== this.props.fields || prevProps.planetDisplay !== this.props.planetDisplay){
			const value = this.props.value;
			const fields = this.props.fields;
			const planetDisplay = this.props.planetDisplay;
			// [MU parity] 同上:只写 'suzhan' 槽,不污染共享 'qimen' 槽。
			saveModuleAISnapshotLazy('suzhan', ()=>buildSuzhanSnapshotText(value, fields, planetDisplay));
		}
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		let text = '';
		try{
			if(moduleName === 'suzhan'){
				const value = this.props.value;
				const fields = this.props.fields;
				const planetDisplay = this.props.planetDisplay;
				if(fields){
					text = `${buildSuzhanSnapshotText(value, fields, planetDisplay) || ''}`.trim();
				}
			}else{
				// [MU parity] SuZhan 不再响应 'qimen' 刷新请求(真奇门快照由 DunJia 组件供;
				// 宿盘遁甲外盘只走自己的 'suzhan' 槽,不冒充/覆盖共享 'qimen')。
				return;
			}
		}catch(e){
			text = '';
		}
		if(text){
			saveModuleAISnapshot(moduleName, text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	setRightPanelTab(key){
		this.setState({
			rightPanelTab: key,
		});
	}

	renderInputPanel(){
		return (
			<div className="horosa-suzhan-input-stack">
				<div>
					<div className="horosa-side-panel-title">宿盘设置</div>
					<div className="horosa-side-panel-subtitle">时间、地点与宿盘选项</div>
				</div>
				<XQSideSection iconName={sideSectionIcon('time')} title="时间、地点与选项" storageKey="suzhan.s0" className="horosa-suzhan-input-section">
					<div className="horosa-suzhan-input-embed">
						<SuZhanInput
							fields={this.props.fields}
							onFieldsChange={this.onFieldsChange}
						/>
					</div>
				</XQSideSection>
			</div>
		);
	}

	renderInfoRows(){
		const fields = this.props.fields || {};
		const chartObj = this.props.value || {};
		const chart = chartObj.chart || {};
		const fieldTime = fields.date && fields.time
			? `${fields.date.value.format('YYYY-MM-DD')} ${fields.time.value.format('HH:mm:ss')}`
			: '—';
		const geo = fields.lon && fields.lat ? `${fields.lon.value} ${fields.lat.value}` : '—';
		const rows = [
			['起盘时间', fieldTime],
			['地点', geo],
			['外盘', fields.szchart ? chartTypeName(fields.szchart.value) : chartTypeName(SZConst.SZChart.chart)],
			['盘型', fields.szshape ? chartShapeName(fields.szshape.value) : chartShapeName(SZConst.SZChart.shape)],
			['宿法', fields.doubingSu28 && fields.doubingSu28.value === 1 ? '斗柄定房法' : '现实距星法'],
			['人事十二宫', fields.houseStartMode ? houseStartModeName(fields.houseStartMode.value) : houseStartModeName(SZConst.SZChart.houseStartMode)],
			['宫位数', chart.houses ? chart.houses.length : '—'],
			['星曜数', chart.objects ? chart.objects.length : '—'],
			['二十八宿', chart.fixedStarSu28 ? chart.fixedStarSu28.length : '—'],
		];
		return rows.map(([label, value])=>(
			<div className="horosa-suzhan-info-row" key={label}>
				<span>{label}</span>
				<strong>{value}</strong>
			</div>
		));
	}

	renderHouseSuRows(){
		const chartObj = this.props.value || {};
		const chart = chartObj.chart || {};
		const lines = buildHouseSuLines(chartObj, chart, this.props.planetDisplay, this.props.fields);
		if(!lines.length){
			return <div className="horosa-suzhan-empty">暂无宫宿数据</div>;
		}
		return lines.map((line, idx)=>{
			if(!line){
				return null;
			}
			const isHead = line.indexOf('宫位：') === 0 || line.indexOf('二十八宿：') === 0;
			return (
				<div className={isHead ? 'horosa-suzhan-line is-head' : 'horosa-suzhan-line'} key={`${idx}_${line}`}>
					{line}
				</div>
			);
		});
	}

	renderRightPanel(){
		// horosa_freeze_subtabs_v1:右栏三页签冻结。
		// 附带根治一处纯浪费:buildSuzhanSnapshotText(全盘转文本)原先在【每次】renderRightPanel 顶部
		// 无条件求值,而它只被「快照」这一个页签消费 —— 现挪进该页签的函数式 children,
		// 只在快照页真要画时才算。输出逐字不变(纯函数、同入参),故非降级。
		const activeKey = this.state.rightPanelTab;
		return (
			<Tabs activeKey={activeKey} onChange={this.setRightPanelTab} defaultActiveKey="overview" tabPosition="top" className="horosa-suzhan-tabs">
				<TabPane tab="概览" key="overview">
					<FreezeSubTab active={activeKey === 'overview'}>{() => (
						<div className="horosa-suzhan-info-card">
							{this.renderInfoRows()}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="宫宿" key="houses">
					<FreezeSubTab active={activeKey === 'houses'}>{() => (
						<div className="horosa-suzhan-line-list">
							{this.renderHouseSuRows()}
						</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="快照" key="snapshot">
					<FreezeSubTab active={activeKey === 'snapshot'}>{() => (
						<pre className="horosa-suzhan-snapshot">{buildSuzhanSnapshotText(this.props.value, this.props.fields, this.props.planetDisplay)}</pre>
					)}</FreezeSubTab>
				</TabPane>
			</Tabs>
		);
	}

	// 快捷栏契约:「此刻起盘」:盘时=当下并立即重排(走全局 fields 受控回流,左栏跟显)。
	// 只补 date/time/ad——zone/经纬是用户所在地设置不动。
	clickPlotNow(){
		const now = new DateTime();
		this.onFieldsChange({
			date: { value: now.clone() },
			time: { value: now.clone() },
			ad: { value: now.ad },
		});
	}

	// 快捷栏契约:右栏 tab 镜像与跨页目录撤除,只放本页没有的动词。
	// cnyibu 容器经此声明透传渲染(勿在此放页面上已有的控件)。
	getQuickDockConfig(){
		return {
			hasResult: !!this.props.value,
			extras: [
				{ key: 'nowPlot', label: '此刻起盘', icon: 'quickTransit', needsResult: false, onClick: ()=>this.clickPlotNow() },
			],
			save: ()=>this.clickSaveCase(),
		};
	}

	renderBottomQuickDock(){
		return (
			<QuickDockBar
				page="suzhan"
				className="horosa-suzhan-quick-dock"
				dispatch={this.props.dispatch}
				{...this.getQuickDockConfig()}
			/>
		);
	}

	render(){
		let height = this.props.height ? this.props.height : 760;
		if(height === '100%'){
			height = 760
		}else{
			height = height - 20
		}

		let chartObj = this.props.value;
		// chartObj 可能是部分态(有 params 无 chart,如 PD 先行落盘的历史脏数据)——按 .chart
		// 存在性守卫;浅拷贝后再挂 aspects/lots,不就地改 store 里的对象。
		let chart = (chartObj && chartObj.chart) ? { ...chartObj.chart } : {};
		chart.aspects = chartObj ? chartObj.aspects : {};
		chart.lots = chartObj ? chartObj.lots : [];

			return (
				<div className={`horosa-suzhan-page horosa-astro-redesign horosa-suzhan-redesign${this.props.hideQuickDock ? ' horosa-suzhan-embedded' : ''}`} style={{ height: height, minHeight: height, overflow: 'hidden' }}>
				<div className="horosa-astro-layout horosa-astro-redesign-layout horosa-suzhan-redesign-layout">
					<div className="horosa-astro-redesign-grid horosa-suzhan-redesign-grid">
						<div className="horosa-astro-context-panel horosa-astro-input-panel horosa-suzhan-input-panel">
							{this.renderInputPanel()}
						</div>
						<div className="horosa-chart-stage horosa-chart-stage-redesign horosa-suzhan-chart-panel xq-chart-renderer xq-chart-renderer-suzhan">
							<div className="horosa-suzhan-board-host">
								<SuZhanChart
									value={chart}
									height={Math.max(560, height - 22)}
									fields={this.props.fields}
									chartDisplay={this.props.chartDisplay}
									planetDisplay={this.props.planetDisplay}
								/>
							</div>
						</div>
						<div className="horosa-inspector-panel horosa-astro-content-panel horosa-suzhan-info-panel">
							<div className="horosa-side-panel-heading horosa-suzhan-info-heading">
								<div>
									<div className="horosa-side-panel-title">宿盘信息</div>
									<div className="horosa-side-panel-subtitle">概览、宫宿与快照</div>
								</div>
							</div>
							{this.renderRightPanel()}
						</div>
					</div>
					{!this.props.hideQuickDock && this.renderBottomQuickDock()}
				</div>
			</div>

		);
	}
}

export default SuZhanMain;
