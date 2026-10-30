// components/astro/AstroAgePoint.js
// 年龄推进点（Age Point）：年龄点自上升点起逐宫顺行，每宫 6 年、72 年一周。
// 推进方式(Koch 宫 / 等速 5°/年)、事件(全部点 × 五相位 / 只报合七星)、年长、年限四项口径见 utils/agePointOptions(各处共用同一份)。
// 报每岁落座 / 落宫与事件精确岁数。后端 /predict/agepoint。
import { civilInstantMsOfStr } from '../../utils/dateStrSafe';
import { Component } from 'react';
import { Spin, Row, Col } from 'antd';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, astroSymbol, chartParams, chartRequestKey, cardStyle, SmallTable, parkLoadFailure, clearLoadFailure, loadParked } from './AstroExtraCommon';
import * as AstroText from '../../constants/AstroText';
import * as AstroConst from '../../constants/AstroConst';
import { XQSelect as Select } from '../xq-ui';
import { DIRECTION_PAGE_SETTINGS } from '../../utils/directionPageSettings';
import { AP_METHODS, AP_EVENTS, AP_YEARS, AP_SPANS, normalizeApSettings, apRequestParams, apSettingsLine, apAspectText } from '../../utils/agePointOptions';
// [YB] 三段补厚共享 helper(起盘信息/当前时点/方法说明)。namespace import + typeof 守卫:
// 测试环境可能部分 mock astroAiSnapshot(只留 buildAstroSnapshotContent 等),缺函数时回 [] 保底。
import * as astroAiSnapshot from '../../utils/astroAiSnapshot';
import { natalSourceKey, pickKeyedDerived } from '../../utils/derivedChartSource';
import { markPanelReady } from '../../utils/perfMark';

const Option = Select.Option;
const birthHeaderLines = (c) => (typeof astroAiSnapshot.buildPredictiveBirthHeaderLines === 'function' ? astroAiSnapshot.buildPredictiveBirthHeaderLines(c) : []);
const currentMomentLines = (c, x) => (typeof astroAiSnapshot.buildCurrentMomentLines === 'function' ? astroAiSnapshot.buildCurrentMomentLines(c, x) : []);
const methodNoteLines = (k) => (typeof astroAiSnapshot.buildMethodNoteLines === 'function' ? astroAiSnapshot.buildMethodNoteLines(k) : []);

// AI 快照用中文名(astroSymbol 字形在纯文本里不可读)。
function apName(id){
	if(id === undefined || id === null || id === ''){ return '-'; }
	return AstroText.AstroTxtMsg[id] || `${id}`;
}

// 一行内多个事件:后端 points[i].aspects=[{aspectTo,aspectAge,aspectType,side}](精确穿越岁数);旧字段 aspectTo 仅首个 → 兼容回退。
function rowAspects(p){
	if(!p){ return []; }
	if(Array.isArray(p.aspects) && p.aspects.length){ return p.aspects; }
	return p.aspectTo ? [{ aspectTo: p.aspectTo, aspectAge: p.aspectAge, aspectType: 0, side: '' }] : [];
}

// 事件全集:后端 crossings(按岁升序,精确岁数);旧后端无此字段 → 由 points 行的 aspects 拼出。
function keyCrossings(ap, points){
	if(ap && Array.isArray(ap.crossings) && ap.crossings.length){ return ap.crossings; }
	const out = [];
	(points || []).forEach((p)=>{ rowAspects(p).forEach((a)=>out.push({ age: Number.isFinite(Number(a.aspectAge)) ? Number(a.aspectAge) : p.age, aspectTo: a.aspectTo, aspect: a.aspectType || 0, side: a.side || '' })); });
	return out;
}

function fmtAge(v){
	const n = Number(v);
	if(!Number.isFinite(n)){ return `${v}`; }
	return Number.isInteger(n) ? `${n}` : n.toFixed(2).replace(/\.?0+$/, '');
}
const eventTxt = (c) => `${apAspectText(c.aspect !== undefined ? c.aspect : c.aspectType, c.side)}${apName(c.aspectTo)}`;

// 请求体 = 本盘排盘参数 + 与出厂值不同的年龄推进点口径(出厂值不带,请求与旧版逐字节相同)
export function agePointRequestBody(chartObj, opts){
	return { ...chartParams(chartObj), ...apRequestParams(opts) };
}

// 年龄推进点 AI 快照(无头):内部 fetch /predict/agepoint,与组件同口径。aiAnalysisContext 复算用。
export async function buildAgePointSnapshotText(chartObj, opts){
	if(!chartObj){ return ''; }
	let r = {};
	try{
		const data = await request(`${Constants.ServerRoot}/predict/agepoint`, {
			body: JSON.stringify(agePointRequestBody(chartObj, opts)),
			timeoutMs: 60000,
		});
		r = unwrapResult(data) || {};
	}catch(e){
		return '';
	}
	return buildAgePointSnapshotFromResult(chartObj, r, opts);
}

export function buildAgePointSnapshotFromResult(chartObj, r, opts){
	const ap = (r && r.agepoint) || {};
	const points = ap.points || [];
	if(!points.length){ return ''; }  // 无年龄推进点数据=该技法在本盘缺失,挂载显示「缺失」而非空表头。
	const crossings = keyCrossings(ap, points);
	const st = normalizeApSettings({ ...(opts || {}), ...(ap.settings || {}) });
	const lines = [];
	// [YB] 头部盘主生辰([起盘信息];无数据 helper 自返 [],不产空段头)。
	lines.push(...birthHeaderLines(chartObj));
	lines.push('[年龄推进点（Age Point / Huber）]');
	lines.push(`年龄点自上升点起逐宫顺行，每宫 6 年、72 年回到上升。${apSettingsLine(st)}。年龄点经过本命点或其相位点的岁数为人生关键节点。`);
	if(crossings.length){
		lines.push('');
		lines.push('关键岁数（精确穿越岁数）：' + crossings.map((c) => `${fmtAge(c.age)}岁${eventTxt(c)}${c.date ? `(${c.date})` : ''}`).join('；'));
	}
	lines.push('');
	lines.push('| 年龄 | 日期 | 落座 | 宫 | 事件（穿越岁数） |');
	lines.push('| --- | --- | --- | --- | --- |');
	points.forEach((p)=>{
		const sign = `${apName(p.sign)}${(p.signlon !== undefined && p.signlon !== null) ? ' ' + p.signlon + '°' : ''}`;
		const asp = rowAspects(p).map((a) => `${eventTxt(a)}${Number.isFinite(Number(a.aspectAge)) ? `(${fmtAge(a.aspectAge)}岁)` : ''}`).join('、');
		lines.push(`| ${p.age}岁 | ${p.date || '-'} | ${sign} | ${p.house}宫 | ${asp || '—'} |`);
	});
	// [YB] 尾部 [当前时点]+[方法说明];定位行=当前年龄对应的年龄点行(取 age≤当前年龄的最大行)。
	const extraLines = [];
	const birthRaw = (chartObj && chartObj.params && chartObj.params.birth) ? `${chartObj.params.birth}`.trim() : '';
	const birthMs = birthRaw ? civilInstantMsOfStr(birthRaw.replace(/\//g, '-').replace(' ', 'T')) : NaN;   // 民用历真实时刻(1582 以前 / 公元前)
	if(Number.isFinite(birthMs)){
		const curAge = (Date.now() - birthMs) / (365.2425 * 24 * 3600 * 1000);
		let curPoint = null;
		points.forEach((p)=>{
			if(Number(p.age) <= curAge && (!curPoint || Number(p.age) > Number(curPoint.age))){ curPoint = p; }
		});
		if(curPoint){
			const curSign = `${apName(curPoint.sign)}${(curPoint.signlon !== undefined && curPoint.signlon !== null) ? ' ' + curPoint.signlon + '°' : ''}`;
			const curAsp = rowAspects(curPoint).map((a) => `${eventTxt(a)}${Number.isFinite(Number(a.aspectAge)) ? `(${fmtAge(a.aspectAge)}岁)` : ''}`).join('、');
			extraLines.push(`当前年龄点：${curPoint.age}岁 落${curSign}，第${curPoint.house}宫${curAsp ? `，${curAsp}` : ''}`);
		}
		const next = crossings.find((c) => Number(c.age) > curAge);
		if(next){ extraLines.push(`下一事件：${fmtAge(next.age)}岁${eventTxt(next)}${next.date ? `（${next.date}）` : ''}`); }
	}
	const tail = [...currentMomentLines(chartObj, extraLines), ...methodNoteLines('agepoint')];
	if(tail.length){
		lines.push('');
		lines.push(...tail);
	}
	return lines.join('\n');
}

const SETTING_KEYS = ['apMethod', 'apEvents', 'apYear', 'apMaxAge'];

class AstroAgePoint extends Component {
	constructor(props){
		super(props);
		const sv = DIRECTION_PAGE_SETTINGS.load();   // 上次亲手设的四项口径
		this.state = {
			loading: false, result: null, requestKey: '',
			apMethod: sv.apMethod, apEvents: sv.apEvents, apYear: sv.apYear, apMaxAge: sv.apMaxAge,
		};
		this.load = this.load.bind(this);
		this.changeOpt = this.changeOpt.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	componentDidMount(){
		this._mounted = true;
		this.load();
		if(typeof window !== 'undefined'){ window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest); }
	}

	componentWillUnmount(){
		this._mounted = false;
		if(typeof window !== 'undefined'){ window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest); }
	}

	settings(){
		const o = {};
		SETTING_KEYS.forEach((k)=>{ o[k] = this.state[k]; });
		return normalizeApSettings(o);
	}

	requestKeyOf(){
		const st = this.settings();
		return chartRequestKey(this.props.value, `agepoint|${SETTING_KEYS.map((k)=>st[k]).join('|')}`);
	}

	// AI导出:在年龄推进点 tab 导出时响应刷新事件,把快照(内部 fetch /predict/agepoint 后)写回 detail.snapshotText,export 轮询读取。
	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'agepoint' || !this.props.value){ return; }
		buildAgePointSnapshotText(this.props.value, this.settings()).then((txt)=>{ evt.detail.snapshotText = txt || ''; }).catch(()=>{});
	}

	componentDidUpdate(){
		const k = this.requestKeyOf();
		if(k && k !== this.state.requestKey && !this.state.loading && !loadParked(this, k)){ this.load(); }
	}

	ensureLoaded(){
		const k = this.requestKeyOf();
		if(k && k !== this.state.requestKey && !this.state.loading && !loadParked(this, k)){ setTimeout(this.load, 0); }
	}

	changeOpt(key, val){
		DIRECTION_PAGE_SETTINGS.save({ [key]: val });
		this.setState({ [key]: val });   // componentDidUpdate 见请求键变了即重取
	}

	async load(){
		const seq = ++this._loadSeq || (this._loadSeq = 1);   // 只认最后一次:换盘 / 改参连发时先发的晚回不覆盖
		const resultSig = natalSourceKey(this.props.value);   // 本次结果出自哪位命主(读时与当前盘比)
		if(!this.props.value){ return; }
		const k = this.requestKeyOf();
		this.setState({ loading: true });
		try{
			const data = await request(`${Constants.ServerRoot}/predict/agepoint`, {
				body: JSON.stringify(agePointRequestBody(this.props.value, this.settings())),
				timeoutMs: 60000,
			});
			if(!this._mounted || seq !== this._loadSeq) return;
			if(!data){   // request() 吞错 resolve undefined:保留旧表,窗口期后自动重试
				parkLoadFailure(this, k);
				this.setState({ loading: false });
				return;
			}
			clearLoadFailure(this);
			// horosa_panel_ready_v1:年龄推进点表(本技法唯一可见内容)落定的那一次 setState。
			this.setState({ result: unwrapResult(data) || {}, resultSig, loading: false, requestKey: k }, ()=>{ markPanelReady('direction'); });
		}catch(e){
			if(!this._mounted || seq !== this._loadSeq) return;
			parkLoadFailure(this, k);   // 失败不记成已完成:窗口期后同一张盘自动重试
			this.setState({ loading: false });
		}
	}

	// 出自当前命主的结果才用:换盘后新结果在途 / 取失败时 state 里是上一位命主的 → 当没有(同一命主只改设置仍旧表留存)
	shownResult(){
		return pickKeyedDerived(this.state.result, this.state.resultSig, natalSourceKey(this.props.value));
	}

	render(){
		this.ensureLoaded();
		const r = this.shownResult() || {};
		const ap = r.agepoint || {};
		const points = ap.points || [];
		const keyAges = keyCrossings(ap, points);   // 精确穿越岁数(连续解),非整岁邻域采样
		// 摘要只列最强的合 / 冲(全部点 × 五相位时事件上百个,其余相位逐岁表里都有)
		const strongOnly = keyAges.some((c)=>[60, 90, 120].indexOf(Number(c.aspect)) >= 0);
		const summary = strongOnly ? keyAges.filter((c)=>Number(c.aspect) === 0 || Number(c.aspect) === 180) : keyAges;
		const height = this.props.height ? this.props.height - 20 : 700;
		const sym = (id) => astroSymbol(id);
		const echo = ap.settings || null;
		const eventNode = (a, i) => (
			<span key={i} style={{ marginRight: 8, whiteSpace: 'nowrap' }}>
				<span style={{ fontFamily: AstroConst.NormalFont, fontSize: 11.5 }}>{apAspectText(a.aspect !== undefined ? a.aspect : a.aspectType, a.side)}</span>
				<span style={{ fontFamily: 'AstroFont', color: '#c0392b', marginLeft: 2 }}>{sym(a.aspectTo)}</span>
				{Number.isFinite(Number(a.aspectAge !== undefined ? a.aspectAge : a.age)) ? <span style={{ opacity: 0.75, marginLeft: 2 }}>{fmtAge(a.aspectAge !== undefined ? a.aspectAge : a.age)}岁</span> : null}
			</span>
		);
		return (
			<Spin spinning={this.state.loading && !this.shownResult()}>
				<div className="horosa-balbillus-shell" style={{ height, overflow: 'auto', paddingRight: 8 }}>
					<div className="horosa-balbillus-head">
						<div className="horosa-balbillus-title">
							年龄推进点<span className="horosa-balbillus-sub">Age Point · 每宫 6 年、72 年一周</span>
						</div>
						<div className="horosa-balbillus-desc">
							年龄点自上升点起逐宫顺行：Koch 宫档按各宫宽窄在 6 年里匀速走完一宫（宽宫走得快），等速档自上升每年 5°。年龄点经过本命点或其相位点的岁数为人生关键节点。
						</div>
						<Row gutter={12} className="horosa-balbillus-controls">
							<Col span={6}>
								<div className="horosa-balbillus-label">推进方式</div>
								<Select value={this.state.apMethod} onChange={(v) => this.changeOpt('apMethod', v)} style={{ width: '100%' }}>
									{AP_METHODS.map((o) => <Option value={o.value} key={o.value}>{o.label}</Option>)}
								</Select>
							</Col>
							<Col span={6}>
								<div className="horosa-balbillus-label">事件</div>
								<Select value={this.state.apEvents} onChange={(v) => this.changeOpt('apEvents', v)} style={{ width: '100%' }}>
									{AP_EVENTS.map((o) => <Option value={o.value} key={o.value}>{o.label}</Option>)}
								</Select>
							</Col>
							<Col span={6}>
								<div className="horosa-balbillus-label">年长</div>
								<Select value={this.state.apYear} onChange={(v) => this.changeOpt('apYear', v)} style={{ width: '100%' }}>
									{AP_YEARS.map((o) => <Option value={o.value} key={o.value}>{o.label}</Option>)}
								</Select>
							</Col>
							<Col span={6}>
								<div className="horosa-balbillus-label">年限</div>
								<Select value={this.state.apMaxAge} onChange={(v) => this.changeOpt('apMaxAge', v)} style={{ width: '100%' }}>
									{AP_SPANS.map((n) => <Option value={n} key={n}>{`${n} 岁`}</Option>)}
								</Select>
							</Col>
						</Row>
					</div>
					<div style={cardStyle}>
						{summary.length > 0 && (
							<div style={{ marginBottom: 10, fontSize: 13, lineHeight: '22px' }}>
								<span style={{ opacity: 0.7, marginRight: 6 }}>{strongOnly ? '关键岁数（合 / 冲，精确穿越岁数；四分 / 三分 / 六合见下表）：' : '关键岁数（精确穿越岁数）：'}</span>
								{summary.map(eventNode)}
							</div>
						)}
						<SmallTable
							rowKey={(row) => row.age}
							rows={points}
							columns={[
								{ key: 'age', title: '年龄', render: (v) => `${v} 岁` },
								{ key: 'date', title: '日期', render: (v) => v || '-' },
								{ key: 'sign', title: '落座', render: (v, row) => <span style={{ whiteSpace: 'nowrap' }}><span style={{ fontFamily: 'AstroFont', marginRight: 4 }}>{sym(v)}</span>{row.signlon}°</span> },
								{ key: 'house', title: '宫', render: (v) => `${v} 宫` },
								{ key: 'aspectTo', title: '事件（穿越岁数）', render: (v, row) => {
									const asps = rowAspects(row);
									return asps.length ? asps.map(eventNode) : '—';
								} },
							]}
						/>
						<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginTop: 6 }}>
							{echo ? `${apSettingsLine(echo)}；宫 = ${echo.apMethod === 'koch' ? 'Koch 宫' : '上升起等宫'}。` : (points.length ? '本地服务未回显口径（服务版本较旧，表为 Koch 宫 · 只报合七星的旧结果）；重启本地服务后四项口径生效。' : '')}
						</div>
					</div>
				</div>
			</Spin>
		);
	}
}

export default AstroAgePoint;
