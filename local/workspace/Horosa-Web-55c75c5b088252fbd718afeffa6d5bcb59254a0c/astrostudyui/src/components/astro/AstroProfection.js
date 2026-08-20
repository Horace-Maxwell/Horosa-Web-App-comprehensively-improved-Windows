import { Component } from 'react';
import { Row, Col, Divider, Popover, } from 'antd';
import AstroDoubleChart from './AstroDoubleChart';
import AstroDirectionForm from './AstroDirectionForm';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import * as AstroHelper from './AstroHelper';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { convertToArray} from '../../utils/helper';
import styles from '../../css/styles.less';
import DateTime from '../comp/DateTime';
import { saveModuleAISnapshotLazy, saveModuleAISnapshot, } from '../../utils/moduleAiSnapshot';
import { buildPredictiveSnapshotText, } from '../../utils/predictiveAiSnapshot';
import { appendPlanetHouseInfoById, splitPlanetHouseInfoText, } from '../../utils/planetHouseInfo';
import { XQSegmented, XQSelect } from '../xq-ui';
import { SIGNS } from '../../divination/data/signs';
import UpdatingBadge from '../common/UpdatingBadge';
import { silentTechniquePanelsEnabled } from '../../utils/perfFlags';
import { natalClassicalParams, transitOrbDefault } from './AstroExtraCommon';
import { pruneStaleClassicalParams } from '../../utils/classicalChartGlobals';
import { markPanelReady } from '../../utils/perfMark';
// horosa_stable_react_keys_v1(PERF-R9):本文件的 React key 已从 randomStr(8) 改为内容派生的稳定 key。
// 随机 key 每次渲染都变 → React 无法 diff → 整棵子树卸载重建。此标记供 apply.sh 的
// 幂等守卫与发布哨兵定位;删除它会让重同步后无法自动还原本改动。

// ===== G9 月/日小限 + 多起点(纯前端派生) =====
// flatlib 后端小限盘已连续旋转(年盘自上升),此处的「年/月/日」摘要为离散古典口径的纯前端派生,
// 不改后端、不动既有年盘(零回归)。起点摘要亦纯前端。
const PROFECTION_GRAIN_OPTIONS = [
	{ value: 'y', label: '年' },
	{ value: 'm', label: '月' },
	{ value: 'd', label: '日' },
];
// 起点:上升(默认)/区分光(昼日夜月)/福点/月/MC 所在座。
const PROFECTION_START_OPTIONS = [
	{ value: 'asc', label: '上升（默认）' },
	{ value: 'sect', label: '区分光（昼日夜月）' },
	{ value: 'fortune', label: '福点' },
	{ value: 'moon', label: '月亮' },
	{ value: 'mc', label: '天顶' },
];
const PROFECTION_GRAIN_CN = { y: '年', m: '月', d: '日' };
const PROFECTION_START_CN = { asc: '上升', sect: '区分光', fortune: '福点', moon: '月亮', mc: '天顶' };
// 座序庙主(domicile)→ 行星 glyph 标识(与 AstroText.AstroMsg 一致)。
const PROFECTION_SIGN_RULER_ID = {
	mars: 'Mars', venus: 'Venus', mercury: 'Mercury', moon: 'Moon', sun: 'Sun',
	jupiter: 'Jupiter', saturn: 'Saturn',
};

function profectionPointSignIdx(chartObj, startKey){
	// 从本命盘取起点所在座的序号(0=白羊…11=双鱼);取不到返回 null(降级)。
	const chart = chartObj && chartObj.chart ? chartObj.chart : null;
	if(!chart){ return null; }
	const byId = {};
	(chart.objects || []).forEach((o)=>{ if(o && o.id){ byId[o.id] = o; } });
	(chart.angles || []).forEach((a)=>{ if(a && a.id){ byId[a.id] = a; } });
	let id = AstroConst.ASC;
	if(startKey === 'mc'){ id = AstroConst.MC; }
	else if(startKey === 'moon'){ id = AstroConst.MOON; }
	else if(startKey === 'fortune'){ id = AstroConst.PARS_FORTUNA; }
	else if(startKey === 'sect'){ id = chart.isDiurnal ? AstroConst.SUN : AstroConst.MOON; }
	const o = byId[id];
	if(!o){ return null; }
	if(o.sign && AstroConst.LIST_SIGNS.indexOf(o.sign) >= 0){
		return AstroConst.LIST_SIGNS.indexOf(o.sign);
	}
	if(o.lon != null){ return Math.floor(((o.lon % 360) + 360) % 360 / 30) % 12; }
	return null;
}

function profectionSignRulerId(signIdx){
	const name = AstroConst.LIST_SIGNS[((signIdx % 12) + 12) % 12];
	const key = name ? name.toLowerCase() : '';
	const dom = SIGNS[key] ? SIGNS[key].domicile : null;
	return PROFECTION_SIGN_RULER_ID[dom] || null;
}

// 计算所选粒度/起点的离散小限派生结果。
// 入:本命 birth(DateTime) + 目标 datetime(DateTime) + grain('y'|'m'|'d') + startKey + 本命盘。
// 出:{ ageYears, startSignIdx, yearSignIdx, yearHouse, signIdx, house, rulerId, monthsIntoYear } 或 null。
function deriveProfection(birthDt, targetDt, grain, startKey, chartObj){
	const startSignIdx = profectionPointSignIdx(chartObj, startKey);
	if(startSignIdx === null || !birthDt || !targetDt){ return null; }
	const birthJdn = birthDt.jdn || (birthDt.calcJdn ? birthDt.calcJdn() : 0);
	const targetJdn = targetDt.jdn || (targetDt.calcJdn ? targetDt.calcJdn() : 0);
	let days = targetJdn - birthJdn;
	if(!(days >= 0)){ days = 0; }
	const YEAR_DAYS = 365.2422;
	const age = Math.floor(days / YEAR_DAYS);               // 已满整岁(12/24/36 岁回上升)
	const yearSignIdx = (startSignIdx + age) % 12;          // 当年小限座
	const yearHouse = (age % 12) + 1;                        // 当年小限宫
	const daysIntoYear = days - age * YEAR_DAYS;            // 当年周年以来天数(月/日推进用)
	const MONTH_DAYS = YEAR_DAYS / 12.0;                    // ≈30.4368 天/月
	let monthsIntoYear = Math.floor(daysIntoYear / MONTH_DAYS);
	monthsIntoYear = Math.max(0, Math.min(11, monthsIntoYear));
	const monthSignIdx = (yearSignIdx + monthsIntoYear) % 12;
	const daysIntoMonth = daysIntoYear - monthsIntoYear * MONTH_DAYS;
	const DAY_STEP = 2.5;                                   // 360/12/12=2.5 天/座
	let daysAdv = Math.floor(daysIntoMonth / DAY_STEP);
	daysAdv = Math.max(0, Math.min(11, daysAdv));
	const daySignIdx = (monthSignIdx + daysAdv) % 12;
	let signIdx = yearSignIdx;
	let house = yearHouse;
	if(grain === 'm'){ signIdx = monthSignIdx; house = ((monthSignIdx - startSignIdx + 12) % 12) + 1; }
	else if(grain === 'd'){ signIdx = daySignIdx; house = ((daySignIdx - startSignIdx + 12) % 12) + 1; }
	return {
		ageYears: age,
		startSignIdx,
		yearSignIdx,
		yearHouse,
		signIdx,
		house,
		rulerId: profectionSignRulerId(signIdx),
		monthsIntoYear,
	};
}

class AstroProfection extends Component{

	constructor(props) {
		super(props);
		this.unmounted = false;

		// horosa_no_mutate_chart_params_v1:同 genNatalParams —— 在副本上派生 date/time,不写共享盘对象。
		const srcParams = (this.props.value && this.props.value.params) ? this.props.value.params : {};
		let qryparam = { ...srcParams };
		if(qryparam.birth){
			let parts = qryparam.birth.split(' ');
			qryparam.date = parts[0];
			qryparam.time = parts[1];
		}

		let now = new DateTime();
		this.state = {
			params: {
				date: qryparam.date,
				time: qryparam.time,
				ad: qryparam.ad ? qryparam.ad : 1,
				zone: qryparam.zone,
				dirZone: qryparam.zone,
				lon: qryparam.lon,
				lat: qryparam.lat,
				gpsLat: qryparam.gpsLat,
				gpsLon: qryparam.gpsLon,
				hsys: qryparam.hsys,
				zodiacal: qryparam.zodiacal, siderealAyanamsa: qryparam.siderealAyanamsa,
				tradition: qryparam.tradition,
				datetime: now,
				tmType: 'y',
				nodeRetrograde: false,
				asporb: transitOrbDefault(),
			},
			dirChart: null,
			// G9:小限粒度(年/月/日,默认年=现状) + 起点(上升默认)。纯前端摘要,不影响后端年盘请求。
			profGrain: 'y',
			profStart: 'asc',
		};

		if(this.state.params.date){
			let dtstr = this.state.params.datetime.format('YYYY-MM-DD');
			if(dtstr === this.state.params.date){
				this.state.params.datetime.add(1, 'd');
			}
		}else{
			this.state.params.date = now.format('YYYY-MM-DD');
			this.state.params.datetime.add(1, 'd');
		}

		this.submit = this.submit.bind(this);
		this.fieldsChanged = this.fieldsChanged.bind(this);
		this.requestDirection = this.requestDirection.bind(this);
		this.genNatalParams = this.genNatalParams.bind(this);
		this.requestData = this.requestData.bind(this);
		this.genAspectDom = this.genAspectDom.bind(this);
		this.renderPlanetLabel = this.renderPlanetLabel.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
		this.changeProfGrain = this.changeProfGrain.bind(this);
		this.changeProfStart = this.changeProfStart.bind(this);
		this.renderProfectionSummary = this.renderProfectionSummary.bind(this);

		if(this.props.hook){
			this.props.hook.fun = (chartObj)=>{
				if(this.unmounted || chartObj === undefined || chartObj === null){
					return;
				}
				let param = this.genNatalParams(chartObj);
				// [SURF-T1] 增量 merge 粘滞剔除:非默认改回默认后 param 不带键,旧值不得残留(见 classicalChartGlobals)。
				let params = pruneStaleClassicalParams({
					...this.state.params,
					...param,
				}, param);
				this.setState({
					params: params
				}, ()=>{
					this.requestData();
				})
			};
		}

	}

	renderPlanetLabel(chartWrap, id){
		const text = appendPlanetHouseInfoById(
			AstroText.AstroMsg[id],
			chartWrap,
			id,
			this.props.showPlanetHouseInfo
		);
		const one = splitPlanetHouseInfoText(text);
		return (
			<span>
				<span style={{fontFamily: AstroConst.AstroFont}}>{one.label}</span>
				{one.info ? <span style={{fontFamily: AstroConst.NormalFont}}>{`(${one.info})`}</span> : null}
			</span>
		);
	}

	genNatalParams(chartObj){
		// horosa_no_mutate_chart_params_v1(PERF-R9 Ship 6):此前是 `let qryparam = chartObj.params`
		// 然后直接 `qryparam.date = …` —— 就地变异**共享的盘对象**。副作用是真的:
		// AstroExtraCommon.chartRequestKey 把 params.date/time 计入请求键,于是「本技法有没有被挂载过」
		// 会改变其它技法的缓存键。改为在本地副本上派生(birth 仍是唯一真源,chartParams 侧本就有同款回退),
		// 盘对象自此只读 —— 这也是任何按引用比较的 memo/sCU 能成立的前提。
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
			ad: qryparam.ad ? qryparam.ad : 1,
			zone: qryparam.zone,
			dirZone: qryparam.zone,
			lon: qryparam.lon,
			lat: qryparam.lat,
			gpsLat: qryparam.gpsLat,
			gpsLon: qryparam.gpsLon,
			hsys: qryparam.hsys,
			tradition: qryparam.tradition,
			zodiacal: qryparam.zodiacal, siderealAyanamsa: qryparam.siderealAyanamsa,
			// [0d] 古典口径段(单源):此前只带 4-6 基础键,改界系/三分/宫头5°律后与主盘口径静默分叉。
			...natalClassicalParams(qryparam),
		};
		return params;
	}

	requestData(){
		let params = {
			...this.state.params
		};
		params.datetime = params.datetime.format('YYYY-MM-DD HH:mm');
		if(this.props.value){
			this.requestDirection(params);
		}
	}

	async requestDirection(params){
		// [SURF-R5p] 乱序/混代防(B 断面):双在途旧响应后回=盘面与快照回滚;快照 chartValue
		// 此前取回调时刻 props=与响应混代——请求时捕获,与 params/result 同代(响应内产范式)。
		const seq = ++this._reqSeq || (this._reqSeq = 1);
		const chartValueAtRequest = this.props.value;
		// 空回包/请求失败防御:后端未就绪、无效生辰等场景 request 可能抛错或返回空——
		// 静默保持现盘,不产生 Unhandled Rejection(此前 data 为 undefined 时读 Result 直接炸红屏)。
		let data = null;
		// WP-C 极速化:silent=不触发全局满屏 Spin 压暗(keep-stale:旧盘留存+「更新中…」角标,
		// 新盘到达单次 setState 整体替换 —— 印占同款范式)。关 silentTechniquePanels 开关=旧全屏。
		this.setState({ updating: true });
		try{
			data = await request(`${Constants.ServerRoot}/predict/profection`, {
				body: JSON.stringify(params),
				silent: silentTechniquePanelsEnabled(),
			});
		}catch(e){
			if(this.unmounted || seq !== this._reqSeq){ return; }
			this.setState({ updating: false });
			return;
		}
		if(this.unmounted || seq !== this._reqSeq){ return; }
		const result = data ? data[Constants.ResultKey] : null;
		if(!result){
			this.setState({ updating: false });
			return;
		}
		let tm = new DateTime();
		let dt = tm.parse(params.datetime, 'YYYY-MM-DD HH:mm:ss');
		if(params.dirZone){
			dt.setZone(params.dirZone);
		}
		const st = {
			dirChart: result,
			updating: false,
			params: {
				...params,
				datetime: dt,
			},
		};

		this.setState(st, ()=>{
			// horosa_panel_ready_v1:推运盘数据落定(中栏盘 + 右栏相位同源于 st.dirChart)的唯一提交点。
			markPanelReady('direction');
			const chartValue = chartValueAtRequest;
			saveModuleAISnapshotLazy('profection', ()=>buildPredictiveSnapshotText(chartValue, st.params, result, 'profection'), {
				module: 'profection',
			});
		});
	}

	submit(values){
		let params = {
			...this.state.params,
		};
		if(values.zone){
			params.dirZone = values.zone;
		}
		if(values.ad){
			params.ad = values.ad;
		}
		if(values.datetime){
			params.datetime = values.datetime.format('YYYY-MM-DD HH:mm:ss');
		}

		this.requestDirection(params);
	}

	fieldsChanged(changedFields){
		let params = {
			...this.state.params
		}
		if(changedFields.datetime && changedFields.datetime.value){
			if(changedFields.datetime.value instanceof DateTime){
				params.datetime = changedFields.datetime.value;
			}else{
				params.datetime = changedFields.datetime.value.time;
			}
			params.ad = changedFields.datetime.value.ad;
		}
		if(changedFields.zone && changedFields.zone.value){
			params.dirZone = changedFields.zone.value;
		}
		if(changedFields.tmType && changedFields.tmType){
			params.tmType = changedFields.tmType.value;
		}
		if(changedFields.asporb){
			params.asporb = changedFields.asporb.value;
		}
		if(changedFields.nodeRetrograde){
			params.nodeRetrograde = changedFields.nodeRetrograde.value;
		}

		this.setState({
			params: params
		});
	}

	// horosa_aspect_dom_memo_v1(PERF-R9 Ship 6):右栏相位清单的输出**只**由三样东西决定 ——
	// state.dirChart(推运结果对象,每次请求整体替换)、props.value(本命盘)、props.showPlanetHouseInfo
	// (renderPlanetLabel 唯一读到的 prop)。三者引用全同 ⇒ 输出逐字节相同,直接复用上次的元素树:
	// 「更新中」角标开合、其它右栏控件(如小限粒度/起点)改动等与相位无关的重渲不再重建数百个 React 元素。
	// 任一引用变化(含内容整体替换)立即重建 —— 不存在陈旧,亦不依赖任何深比较。
	genAspectDom(){
		const cache = this._aspectDomCache;
		if(cache
			&& cache.dir === this.state.dirChart
			&& cache.natal === this.props.value
			&& cache.phi === this.props.showPlanetHouseInfo){
			return cache.dom;
		}
		const dom = this.buildAspectDom();
		this._aspectDomCache = {
			dir: this.state.dirChart,
			natal: this.props.value,
			phi: this.props.showPlanetHouseInfo,
			dom: dom,
		};
		return dom;
	}

	buildAspectDom(){
		if(this.state.dirChart === undefined || this.state.dirChart === null){
			return null;
		}

		let aspects = this.state.dirChart.chart.aspects;
		let divs = [];
		for(let i=0; i<aspects.length; i++){
			let obj = aspects[i];
			if(obj.objects.length === 0){
				continue;
			}
			let coldivs = [];
			let natalObjs = obj.objects;
			for(let j=0; j<natalObjs.length; j++){
				let natalObj = natalObjs[j];
				let asp = natalObj.aspect;
				let dom = (
					<div key={natalObj.natalId + j}>
						<span style={{fontFamily: AstroConst.AstroFont}}>&emsp;{AstroText.AstroMsg['Asp' + asp]}&nbsp;</span>
						<span>{this.renderPlanetLabel(this.props.value, natalObj.natalId)}&nbsp;</span>
						<span style={{fontFamily: AstroConst.NormalFont}}>
							误差{Math.round(natalObj.delta * 1000)/1000}
						</span>
					</div>
				);
				coldivs.push(dom);
			}
			let domtitle = (
				<Col key={i} span={12}>
					<div>
						<span style={{fontFamily: AstroConst.NormalFont}}>行运&nbsp;</span>
						<span>{this.renderPlanetLabel(this.state.dirChart, obj.directId)}</span>
					</div>
					{coldivs}
				</Col>
			);
			divs.push(domtitle);
		}

		let rows = [];
		let cols = [];
		for(let i=0; i<divs.length; i++){
			if(i % 2 === 0){
				if(i > 0){
					let dom = (
						<div key={`row-${i}`}>
							<Row>
								{cols}
							</Row>
							<Divider dashed />
						</div>
					);	
					rows.push(dom);		
				}
				cols = [];
			}
			cols.push(divs[i]);
		}
		rows.push((
			<Row key="row-last">
				{cols}
			</Row>
		));

		let dom = (
			<div>
				{rows}
			</div>
		);
		return dom;
	}

	componentDidMount(){
		this.unmounted = false;
		if(typeof window !== 'undefined'){
			window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
		this.requestData();
	}

	componentWillUnmount(){
		this.unmounted = true;
		if(typeof window !== 'undefined'){
			window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		}
	}

	// AI 导出/挂载实时取数:导出侧派发 refresh 事件,这里用当前显示的推运盘即时构建快照并回填,
	// 保证「显示什么就导出什么」——不依赖懒存缓存是否已物化(reload/rehydrate 缓存可能为空,
	// 此前缺此监听 → 显示有盘却报「当前页面没有可导出文本」)。
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'profection'){
			return;
		}
		// 空值守卫:推运盘(dirChart)未算出时不构建,避免把占位/空盘存进去。
		if(!this.props.value || !this.state.dirChart){
			return;
		}
		let text = '';
		try{
			text = `${buildPredictiveSnapshotText(this.props.value, this.state.params, this.state.dirChart, 'profection') || ''}`.trim();
		}catch(e){
			text = '';
		}
		if(text){
			saveModuleAISnapshot('profection', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){
				evt.detail.snapshotText = text;
			}
		}
	}

	changeProfGrain(e){
		const val = e && e.target ? e.target.value : e;
		this.setState({ profGrain: val });
	}

	changeProfStart(val){
		this.setState({ profStart: val });
	}

	// G9 小限派生摘要(纯前端):按所选粒度/起点显示当前小限座 · 宫 · 主星;月/日另显年级座作参照。
	renderProfectionSummary(){
		const grain = this.state.profGrain || 'y';
		const startKey = this.state.profStart || 'asc';
		let birthDt = null;
		const p = this.state.params;
		if(p && p.date){
			birthDt = new DateTime();
			try{ birthDt.parse(`${p.date} ${p.time || '12:00:00'}`, 'YYYY-MM-DD HH:mm:ss'); }
			catch(e){ try{ birthDt.parse(p.date, 'YYYY-MM-DD'); }catch(e2){ birthDt = null; } }
		}
		const targetDt = p ? p.datetime : null;
		const info = deriveProfection(birthDt, targetDt, grain, startKey, this.props.value);
		const glyphFont = { fontFamily: AstroConst.AstroFont };
		const normFont = { fontFamily: AstroConst.NormalFont };
		const signGlyph = (idx)=>{
			const name = AstroConst.LIST_SIGNS[((idx % 12) + 12) % 12];
			return <span style={glyphFont}>{AstroText.AstroMsg[name]}</span>;
		};
		const signCn = (idx)=>{
			const name = AstroConst.LIST_SIGNS[((idx % 12) + 12) % 12];
			return AstroText.AstroTxtMsg[name] || name;
		};
		const planet = (id)=> id ? (
			<span><span style={glyphFont}>{AstroText.AstroMsg[id]}</span><span style={normFont}>{AstroText.AstroTxtMsg[id] ? `（${AstroText.AstroTxtMsg[id]}）` : ''}</span></span>
		) : <span style={{opacity: 0.6}}>—</span>;
		return (
			<div style={{marginBottom: 10}}>
				<div style={{display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8}}>
					<XQSegmented value={grain} onChange={this.changeProfGrain} options={PROFECTION_GRAIN_OPTIONS} />
					<XQSelect size="small" value={startKey} onChange={this.changeProfStart} style={{minWidth: 132}} dropdownMatchSelectWidth={false}>
						{PROFECTION_START_OPTIONS.map((it)=>(<XQSelect.Option value={it.value} key={it.value}>{it.label}</XQSelect.Option>))}
					</XQSelect>
				</div>
				{!info ? (
					<div style={{opacity: 0.65, fontSize: 12}}>排盘后显示小限摘要。</div>
				) : (
					<div style={{fontSize: 12.5, lineHeight: 2}}>
						<div>
							<span style={normFont}>{PROFECTION_GRAIN_CN[grain]}小限（自{PROFECTION_START_CN[startKey]}）：</span>
							{signGlyph(info.signIdx)} <span style={normFont}>{signCn(info.signIdx)}</span>
							<span style={normFont}>　第 {info.house} 宫</span>
						</div>
						<div><span style={normFont}>主星：</span>{planet(info.rulerId)}</div>
						<div style={{opacity: 0.75}}><span style={normFont}>满 {info.ageYears} 岁</span>{grain !== 'y' ? <span style={normFont}>　当年 {info.monthsIntoYear + 1} 月</span> : null}</div>
						{grain !== 'y' ? (
							<div style={{opacity: 0.65}}><span style={normFont}>年级参照：</span>{signGlyph(info.yearSignIdx)} <span style={normFont}>{signCn(info.yearSignIdx)} · 第 {info.yearHouse} 宫</span></div>
						) : null}
					</div>
				)}
			</div>
		);
	}

	render(){
		let chartObj = {
			natualChart: this.props.value,
			dirChart: this.state.dirChart,
		};

		let param = this.state.params;
		let tm = new DateTime();
		let fields = {
			startDate: {
				value: tm.parse(param.date, 'YYYY-MM-DD'),
				name: ['startDate'],
			},
			datetime: {
				value: param.datetime,
				name: ['datetime'],
			},
			lat: {
				value: param.lat,
				name: ['lat'],
			},
			lon: {
				value: param.lon,
				name: ['lon'],
			},
			gpsLat: {
				value: param.gpsLat,
				name: ['gpsLat'],
			},
			gpsLon: {
				value: param.gpsLon,
				name: ['gpsLon'],
			},
			tmType: {
				value: param.tmType,
				name: ['tmType'],
			},
			ad: {
				value: param.ad,
				name: ['ad'],
			},
			nodeRetrograde: {
				value: param.nodeRetrograde,
				name: ['nodeRetrograde'],
			},
			asporb: {
				value: param.asporb,
				name: ['asporb'],
			}
		};
		let fieldsary = convertToArray(fields);

		let aspdom = this.genAspectDom();

		let height = this.props.height ? this.props.height : 760;
		let style = {
			height: (height-20) + 'px',
			overflowY:'auto', 
			overflowX:'hidden',
		};


		return (
			<div>
				<Row gutter={6}>
					<Col span={17}>
						<div style={{ position: 'relative' }}>
							{this.state.updating && this.state.dirChart ? <UpdatingBadge /> : null}
							<AstroDoubleChart value={chartObj} 
								height={height}
								planetDisplay={this.props.planetDisplay}
								lotsDisplay={this.props.lotsDisplay}
								chartDisplay={this.props.chartDisplay}
								showAstroMeaning={this.props.showAstroMeaning}
							/>
						</div>
					</Col>
					<Col span={7}>
						<div className={styles.scrollbar} style={style}>
							<Row>
								<Col span={24}>
									<AstroDirectionForm {...fields}
										fieldsAry={fieldsary}
										onFieldsChange={this.fieldsChanged}
										onSubmit={this.submit}
									/>
								</Col>
							</Row>
							<Divider orientation="left">小限摘要</Divider>
							{this.renderProfectionSummary()}
							<Divider orientation="left">相位</Divider>
							{aspdom}
						</div>
					</Col>
				</Row>
			</div>
		)
	}
}

export default AstroProfection;
