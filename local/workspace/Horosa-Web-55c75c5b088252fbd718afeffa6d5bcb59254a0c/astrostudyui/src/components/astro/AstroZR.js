import { Component } from 'react';
import { singleTriggerPredictiveEnabled } from '../../utils/perfFlags';
import { Row, Col, Radio, Divider, } from 'antd';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from './AstroHelper';
import AstroChart from './AstroChart';
import ZodiacalRelease from './ZodiacalRelease';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { randomStr, } from '../../utils/helper';
import { saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import { buildCurrentMomentLines, buildMethodNoteLines, } from '../../utils/astroAiSnapshot';
import { fetchChart } from '../../services/astro';
import styles from '../../css/styles.less';
import { XQSelect as Select } from '../xq-ui';
import UpdatingBadge from '../common/UpdatingBadge';
import { silentTechniquePanelsEnabled } from '../../utils/perfFlags';
import { markPanelReady } from '../../utils/perfMark';

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

// [YB v42] 补厚 helper 容错:个别测试套件整模块 mock astroAiSnapshot 且只保留部分导出,
// 缺失导出经 import 拿到 undefined → 直接调用会炸掉整个 builder;生产环境恒为函数,此守卫零行为差。
const safeHelperLines = (fn, ...args)=>(typeof fn === 'function' ? fn(...args) : []);

// [YB v42] ZR 期起讫定位:期起=date('YYYY-MM-DD'),期讫=下一期起(末期回退 date+days 天);解析失败即跳过。
function zrPeriodStartMs(item){
	const t = Date.parse(`${(item && item.date) || ''}`.trim().replace(/\//g, '-'));
	return Number.isNaN(t) ? null : t;
}
function zrLocateCurrent(items, nowMs){
	const list = Array.isArray(items) ? items : [];
	for(let i = 0; i < list.length; i++){
		const start = zrPeriodStartMs(list[i]);
		if(start === null){ continue; }
		const next = i + 1 < list.length ? list[i + 1] : null;
		const nextStart = next ? zrPeriodStartMs(next) : null;
		const days = Number(list[i] && list[i].days);
		const end = nextStart !== null ? nextStart : (Number.isFinite(days) ? start + days * 86400000 : null);
		if(end !== null && nowMs >= start && nowMs < end){
			// 起讫优先用后端原样日期串(Date.parse 按 UTC 解、按本地时区回格式会漂 1 天);仅末期讫日需自算。
			return {
				item: list[i],
				startText: `${list[i].date}`,
				endText: nextStart !== null ? `${next.date}` : zrFmtDayUTC(end),
			};
		}
	}
	return null;
}
function zrFmtDayUTC(ms){
	const d = new Date(ms);
	const p2 = (n)=>(n < 10 ? `0${n}` : `${n}`);
	return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}
// 「当前所处：L1 X期（…至…）/ L2 Y期（…至…）」——用 timeline 数据找含今日的期;找不到返 ''(该行省略)。
function zrCurrentPeriodLine(list){
	const now = Date.now();
	const l1 = zrLocateCurrent(list, now);
	if(!l1){ return ''; }
	let text = `当前所处：L1 ${signName(l1.item.sign)}期（${l1.startText} 至 ${l1.endText}）`;
	const l2 = zrLocateCurrent(l1.item.sublevel, now);
	if(l2){
		text += ` / L2 ${signName(l2.item.sign)}期（${l2.startText} 至 ${l2.endText}）`;
	}
	return text;
}

// [YB v42] 外壳:内核正文(多路 return,逐字不动)+ 尾部 [当前时点]/[方法说明](共享 helper;段头已登 preset)。
function buildZRAISnapshot(chartObj, params, basePoint, list, aiState){
	const body = buildZRAISnapshotBody(chartObj, params, basePoint, list, aiState);
	const cur = zrCurrentPeriodLine(list);
	const lines = [body, ''];
	lines.push(...safeHelperLines(buildCurrentMomentLines, chartObj, cur ? [cur] : []));
	lines.push(...safeHelperLines(buildMethodNoteLines, 'zodialrelease'));
	while(lines.length && lines[lines.length - 1] === ''){ lines.pop(); }
	return lines.join('\n');
}

function buildZRAISnapshotBody(chartObj, params, basePoint, list, aiState){
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

// AI 挂载「黄道星释」可调项默认（=组件初始 state / 无头默认；不调任何项 → 输出逐字不变）。
const ZR_DEFAULT_OPTS = {
	basePoint: AstroConst.PARS_FORTUNA,
	aiMode: AI_MODE_L1_ALL,
	aiL1Idx: 0,
	aiL2Idx: 0,
	aiL3Idx: 0,
};
// 11 个推运基点（与 genConditionDom 一致）——挂载 schema 复用，杜绝手写错值。
export const ZR_BASE_POINTS = [
	AstroConst.PARS_FORTUNA, AstroConst.PARS_SPIRIT, AstroConst.PARS_MERCURY,
	AstroConst.PARS_VENUS, AstroConst.PARS_MARS, AstroConst.PARS_JUPITER,
	AstroConst.PARS_SATURN,
	AstroConst.ASC, AstroConst.DESC, AstroConst.MC, AstroConst.IC,
];
// AI 输出层级（aiMode）选项（与 AI_MODE_ITEMS 一致）——挂载 schema 复用。
export const ZR_AI_MODES = AI_MODE_ITEMS.map((item)=>({ value: item.value, label: item.label }));

// 黄道星释（zodiacal releasing）AI 快照(无头):内部 fetch /predict/zr,默认福点(Pars Fortuna)基点 + L1 全列概览。
// aiAnalysisContext 复算用;无 zr 数据即返 '' → 挂载显示「缺失」。
function zrNatalParamsStandalone(chartObj, startSign){
	const qp = (chartObj && chartObj.params) ? chartObj.params : {};
	let date = qp.date;
	let time = qp.time;
	if(qp.birth){
		const parts = `${qp.birth}`.split(' ');
		date = date || parts[0];
		time = time || parts[1];
	}
	return {
		date,
		time,
		zone: qp.zone,
		lon: qp.lon,
		lat: qp.lat,
		hsys: qp.hsys,
		tradition: qp.tradition,
		birth: qp.birth,
		zodiacal: qp.zodiacal, siderealAyanamsa: qp.siderealAyanamsa,
		startSign: startSign !== undefined ? startSign : null,
		stopLevelIdx: 3,
	};
}

// opts（AI 挂载「每技法设置」）：basePoint(11 基点) + aiMode(L1全/L2/L3/L4) + aiL1Idx/aiL2Idx/aiL3Idx。
// 缺省/坏值经 ZR_DEFAULT_OPTS 回退 → 与现状逐字一致(守「默认即现状」)。
export async function buildZodialReleaseSnapshotText(chartObj, opts){
	if(!chartObj){
		return '';
	}
	try{
		const o = { ...ZR_DEFAULT_OPTS, ...(opts && typeof opts === 'object' ? opts : {}) };
		const basePoint = ZR_BASE_POINTS.indexOf(o.basePoint) >= 0 ? o.basePoint : AstroConst.PARS_FORTUNA;
		const aiMode = AI_MODE_ITEMS.some((m)=>m.value === o.aiMode) ? o.aiMode : AI_MODE_L1_ALL;
		// 基点 → startSign（取该点所在星座）；福点等同现状传 null（后端按福点起）。
		let startSign = null;
		if(basePoint !== AstroConst.PARS_FORTUNA){
			const pnt = AstroHelper.getObject(chartObj, basePoint);
			startSign = pnt ? pnt.sign : null;
		}
		const params = zrNatalParamsStandalone(chartObj, startSign);
		// WP-C 极速化:无头快照复算也走 silent,不触发全局满屏 Spin 压暗(失败经外层 catch 回 '')。
		const data = await request(`${Constants.ServerRoot}/predict/zr`, {
			body: JSON.stringify(params),
			timeoutMs: 60000,
			silent: silentTechniquePanelsEnabled(),
		});
		const result = (data && data[Constants.ResultKey]) || {};
		const list = Array.isArray(result.zr) ? result.zr : [];
		if(!list.length){
			return '';
		}
		return buildZRAISnapshot(
			chartObj,
			params,
			basePoint,
			list,
			{
				aiMode,
				aiL1Idx: Number(o.aiL1Idx) || 0,
				aiL2Idx: Number(o.aiL2Idx) || 0,
				aiL3Idx: Number(o.aiL3Idx) || 0,
			}
		) || '';
	}catch(e){
		return '';
	}
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
		this.loadWholeSignChart = this.loadWholeSignChart.bind(this);
		this.changeAIMode = this.changeAIMode.bind(this);
		this.changeAIL1 = this.changeAIL1.bind(this);
		this.changeAIL2 = this.changeAIL2.bind(this);
		this.changeAIL3 = this.changeAIL3.bind(this);
		this.genAIOutputDom = this.genAIOutputDom.bind(this);
		this.saveAISnapshot = this.saveAISnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);

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
			selectedSign: null,   // 点运高亮:当前点选的 ZR 期所在星座(传 AstroChart 高亮本座+4/7/10座)
			wsChartObj: null,     // 整宫制专盘:黄道星释默认用整宫制(hsys=0),只喂本视图盘,其它盘零影响
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
				this.loadWholeSignChart(chartObj);
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
		this.loadWholeSignChart(this.props.value);
		this.saveAISnapshot();
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	componentDidUpdate(prevProps, prevState){
		if(prevProps.value !== this.props.value){
			this.loadWholeSignChart(this.props.value);
		}
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
		if(this._deepTimer){ clearTimeout(this._deepTimer); this._deepTimer = null; }
		if(typeof window !== 'undefined'){
			if(window.cancelIdleCallback && this._deepIdle){ window.cancelIdleCallback(this._deepIdle); this._deepIdle = null; }
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	requestData(){
		if(!this.props.value){ return; }
		// 性能:打开/切基点时先只算 L1(stopLevelIdx=0,秒出),页面稳定(idle)后再后台补全 L2–L4(stopLevelIdx=3)。
		// 原先一次算满 4 层递归 → 打开明显卡。
		this.requestDirection({ ...this.state.params, stopLevelIdx: 0 }, true);
	}

	scheduleDeepFetch(){
		if(typeof window !== 'undefined' && window.cancelIdleCallback && this._deepIdle){ window.cancelIdleCallback(this._deepIdle); this._deepIdle = null; }
		if(this._deepTimer){ clearTimeout(this._deepTimer); this._deepTimer = null; }
		const run = ()=>{
			if(this.unmounted || !this.props.value){ return; }
			this.requestDirection({ ...this.state.params, stopLevelIdx: 3 }, false);
		};
		if(typeof window !== 'undefined' && window.requestIdleCallback){
			this._deepIdle = window.requestIdleCallback(run, { timeout: 1500 });
		}else{
			this._deepTimer = setTimeout(run, 350);
		}
	}

	// #2 整宫制:黄道星释是依星座(整宫)释放的希腊化时主技法,盘面理应用整宫制(每座=一宫,宫线落座界)。
	// 但绝不改本命盘/其它任何盘——这里照本命起盘参数原样另起一张 hsys=0 的专盘(仅覆盖宫制,ad/southchart 等全保留),
	// 只喂给本视图的 AstroChart;fetchChart 按 params 缓存(hsys=0 与本命 hsys 不同键,互不污染)。失败则回退本命盘(graceful)。
	loadWholeSignChart(chartObj){
		if(!chartObj || !chartObj.params){ return; }
		const raw = chartObj.params || {};
		const natal = this.genNatalParams(chartObj);   // 由 birth 规整出 date/time,保证齐全
		const wsParams = { ...raw, ...natal, hsys: 0 };
		// WP-G 双触发收敛:hook.fun 与 componentDidUpdate(value 引用变恒真)两路各调一次本函数,
		// 同参第二次白跑(网络层被 chartMem 兜成 0,但解包+setState 重渲照付)。同签名直接跳过;
		// 参数真变(换生辰/宫制)→ 签名变照常重取。关 singleTriggerPredictive 开关=旧双跑。
		const sig = JSON.stringify(wsParams);
		if(singleTriggerPredictiveEnabled() && this._wsSig === sig){
			return;
		}
		this._wsSig = sig;
		// fetchChart 回的是信封 {ResultCode, Result, headers};真正盘对象在 Result(本命盘 this.props.value 亦是已解包的 Result)。
		// 必须解包 rsp[ResultKey] 再取 .chart——直接读 rsp.chart 恒 undefined 会静默回退本命盘(本命非整宫 → 宫线不落座界)。
		fetchChart(wsParams).then((rsp)=>{
			const result = rsp && rsp[Constants.ResultKey];
			if(this.unmounted || !result || !result.chart || result.err){ return; }
			this.setState({ wsChartObj: result });
		}).catch(()=>{ /* 回退本命盘 */ });
	}

	genNatalParams(chartObj){
		// horosa_no_mutate_chart_params_v1(PERF-R9 Ship 6):此前是 `let qryparam = chartObj.params`
		// 然后直接 `qryparam.date = …` —— 就地变异**共享的盘对象**。副作用是真的:
		// AstroExtraCommon.chartRequestKey 把 params.date/time 计入请求键,于是「本技法有没有被挂载过」
		// 会改变其它技法的缓存键。改为在本地副本上派生(birth 仍是唯一真源),盘对象自此只读。
		const src = (chartObj && chartObj.params) ? chartObj.params : {};
		let qryparam = { ...src };
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
			zodiacal: qryparam.zodiacal, siderealAyanamsa: qryparam.siderealAyanamsa,
		};
		return params;
	}

	async requestDirection(params, isQuick){
		// WP-C 极速化:silent=不触发全局满屏 Spin 压暗(keep-stale:旧期表留存+「更新中…」角标,
		// 新数据到达单次 setState 整体替换 —— 印占同款范式)。关 silentTechniquePanels 开关=旧全屏。
		this.setState({ updating: true });
		let data = null;
		try{
			data = await request(`${Constants.ServerRoot}/predict/zr`, {
				body: JSON.stringify(params),
				silent: silentTechniquePanelsEnabled(),
			});
		}catch(e){
			// 请求失败防御:静默保持现有期表,不产生 Unhandled Rejection。
			if(!this.unmounted){ this.setState({ updating: false }); }
			return;
		}
		if(this.unmounted){ return; }
		if(!data){ this.setState({ updating: false }); return; }   // 空载荷守卫:request() 吞错 resolve undefined(网络层失败),此次不更新、重试即恢复
		const result = data[Constants.ResultKey] || {};

		this.setState({
			list: Array.isArray(result.zr) ? result.zr : [],
			updating: false,
			// state.params 恒保 stopLevelIdx=3(全深目标);仅快取那次临时下发 0。保 3 供 AI 快照/再切基点取全深一致。
			params: { ...params, stopLevelIdx: 3 },
		}, ()=>{
			// horosa_panel_ready_v1:期表(中栏盘高亮 + 右栏基点/AI 选择皆由 list 派生)落定的提交点。
			// 快取那一枪也算就绪 —— 用户此刻已看到完整可读的期表,深取只是补深层级(补完再打一次即被去重丢弃)。
			markPanelReady('direction');
			if(isQuick){ this.scheduleDeepFetch(); }
		});
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

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前显示的盘即时重建快照并回填,
	// 保证「显示什么就导出什么」——不依赖快照缓存是否已物化(reload/rehydrate 后缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」)。构建逻辑与 saveAISnapshot 完全一致。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'zodialrelease'){
			return;
		}
		if(!this.props.value || !Array.isArray(this.state.list) || this.state.list.length === 0){
			return;
		}
		let text = '';
		try{
			text = `${buildZRAISnapshot(
				this.props.value,
				this.state.params,
				this.state.basePoint,
				this.state.list,
				this.state
			) || ''}`.trim();
		}catch(e){
			text = '';
		}
		if(text){
			saveModuleAISnapshot('zodialrelease', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	changePoint(e){
		if(this.props.value === undefined || this.props.value === null){
			return;
		}
		const v = e.target.value;
		let startSign;
		if(AstroConst.LIST_SIGNS.indexOf(v) >= 0){
			startSign = v;   // 12 星座基点:直接从该座释放(后端 /predict/zr 直吃 startSign)
		}else{
			const pnt = AstroHelper.getObject(this.props.value, v);
			startSign = pnt ? pnt.sign : null;
		}
		let params = {
			...this.state.params,
			startSign: startSign,
		};
		this.setState({
			params: params,
			basePoint: v,
			selectedSign: null,   // 切基点清掉点运高亮
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
			height: '28px',
			lineHeight: '28px',
			whiteSpace: 'nowrap',
		};
		const colHead = { fontSize: 11, opacity: 0.55, marginBottom: 2, letterSpacing: '0.04em' };

		let pnts = [
			AstroConst.PARS_FORTUNA, AstroConst.PARS_SPIRIT, AstroConst.PARS_MERCURY,
			AstroConst.PARS_VENUS, AstroConst.PARS_MARS, AstroConst.PARS_JUPITER,
			AstroConst.PARS_SATURN,
			AstroConst.ASC, AstroConst.DESC, AstroConst.MC, AstroConst.IC
		];

		const mkRadio = (item)=>(
			<Radio style={radioStyle} value={item} key={`zrbp_${item}`}>
				<span style={{fontFamily: AstroConst.AstroFont}}>{AstroText.AstroMsg[item]}&nbsp;</span>
				<span style={{fontFamily: AstroConst.NormalFont}}>{AstroText.AstroTxtMsg[item]}</span>
			</Radio>
		);

		// 第二列:十二星座基点(glyph + 两字座名,如「白羊」),用户可从任意星座释放;不占额外纵向空间。
		return (
			<RadioGroup onChange={this.changePoint} value={this.state.basePoint} style={{ width: '100%' }}>
				<Row gutter={6}>
					<Col span={12}>
						<div style={colHead}>福点 / 行星 / 四轴</div>
						{pnts.map(mkRadio)}
					</Col>
					<Col span={12}>
						<div style={colHead}>十二星座</div>
						{AstroConst.LIST_SIGNS.map(mkRadio)}
					</Col>
				</Row>
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
						{/* keep-stale 角标:重取期间旧期表留存,主盘右上角提示「更新中…」;首次加载(无旧期表)不显示 */}
						<div style={{ position: 'relative' }}>
							{this.state.updating && this.state.list && this.state.list.length > 0 ? <UpdatingBadge /> : null}
							<AstroChart value={this.state.wsChartObj || this.props.value}
								chartDisplay={this.props.chartDisplay}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
								zrHighlightSign={this.state.selectedSign}
								chartStyle={AstroConst.CHART_STYLE_ORIGINAL}
								height={height}
							/>
						</div>

					</Col>
					<Col span={6}>
						<Divider>基于{AstroText.AstroTxtMsg[this.state.basePoint]}推运</Divider>
						<ZodiacalRelease
							height={height}
							value={this.state.list}
							onSignClick={(sign)=>this.setState({ selectedSign: sign })}
							selectedSign={this.state.selectedSign}
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
