import { Component } from 'react';
import { Spin, Row, Col } from 'antd';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { fetchChart } from '../../services/astro';
import AstroChart from './AstroChart';
import { markPanelReady } from '../../utils/perfMark';
import {
	unwrapResult, chartParams, chartRequestKey, fmtNum, fmtDegree,
	cardStyle, SmallTable, symbolWithMeaning,
} from './AstroExtraCommon';
import * as AstroText from '../../constants/AstroText';
import * as AstroConst from '../../constants/AstroConst';
import * as astroAiSnapshot from '../../utils/astroAiSnapshot';

// [Q-185/T-107] 黄经 → { sign, signlon }(摘要卡日月各按自身黄经取座;非法黄经返 null → fmtDegree 出 '-')
export function signItemOfLon(lon){
	const n = Number(lon);
	if(!Number.isFinite(n)){ return null; }
	const norm = ((n % 360) + 360) % 360;
	return { sign: AstroConst.LIST_SIGNS[Math.floor(norm / 30)], signlon: norm % 30 };
}

// ===== G11 产前朔望独立盘 =====
// 自出生时刻回溯最近的朔(日月合)/望(日月冲),取更晚者为产前朔望;以该时刻为新「出生」时刻、
// 出生地不变,调 /chart 排完整盘 → 中栏渲盘 + 右栏摘要卡。后端算法见 astroextra.compute_prenatal_syzygy。
// [Q-106/T-10] 上线为 AI 技法键 prenatalsyzygy:无头 builder 见 buildPrenatalSyzygySnapshotText(主控 aiAnalysisContext 接入)。
const SYZYGY_TYPE_CN = { new: '朔（日月合）', full: '望（日月冲）' };

const psBirthHeaderLines = (c) => (typeof astroAiSnapshot.buildPredictiveBirthHeaderLines === 'function' ? astroAiSnapshot.buildPredictiveBirthHeaderLines(c) : []);
const psCurrentMomentLines = (c, x) => (typeof astroAiSnapshot.buildCurrentMomentLines === 'function' ? astroAiSnapshot.buildCurrentMomentLines(c, x) : []);
const psMethodNoteLines = (k) => (typeof astroAiSnapshot.buildMethodNoteLines === 'function' ? astroAiSnapshot.buildMethodNoteLines(k) : []);
function psName(id){
	if(id === undefined || id === null || id === ''){ return '-'; }
	return AstroText.AstroTxtMsg[id] || `${id}`;
}
// 产前朔望快照(无头):/astroextra/prenatal_syzygy 求朔望 → 以该时刻排完整盘(/chart)列星体位置。求不得返回 ''。
export async function buildPrenatalSyzygySnapshotText(chartObj){
	if(!chartObj){ return ''; }
	const base = chartParams(chartObj);
	let s = null;
	try{
		const data = await request(`${Constants.ServerRoot}/astroextra/prenatal_syzygy`, { body: JSON.stringify(base), silent: true, timeoutMs: 30000 });
		s = unwrapResult(data) || null;
	}catch(e){ s = null; }
	if(!s || !s.type){ return ''; }
	const lines = [];
	lines.push(...psBirthHeaderLines(chartObj));
	lines.push('[产前朔望]');
	lines.push(`类型：${SYZYGY_TYPE_CN[s.type] || s.type}`);
	lines.push(`时刻：${s.datetime || '—'}`);
	lines.push(`出生前：${s.daysBeforeBirth != null ? `${fmtNum(s.daysBeforeBirth, 2)} 天` : '—'}`);
	lines.push(`取度发光体：${psName(s.hylegBody)}（${s.type === 'new' ? '朔→合相度' : '望→地平之上发光体度'}）`);
	lines.push(`取度：${fmtDegree({ sign: s.hylegSign, signlon: s.hylegSignlon })}`);
	const dt = splitDateTime(s.datetime);
	let chart = null;
	if(dt){
		try{
			const rsp = await fetchChart({ ...base, date: dt.date, time: dt.time });
			chart = unwrapResult(rsp) || null;
		}catch(e){ chart = null; }
	}
	lines.push('');
	lines.push('[产前朔望盘·星体位置]');
	const objs = chart && chart.chart && Array.isArray(chart.chart.objects) ? chart.chart.objects : [];
	if(!objs.length){
		lines.push('（产前朔望盘暂缺：未能以朔望时刻排盘。）');
	}else{
		lines.push('（以产前朔望时刻为出生时刻、出生地不变排盘。）');
		lines.push('| 星体 | 星座 | 座内度 |');
		lines.push('| --- | --- | --- |');
		objs.forEach((o)=>{
			if(!o || !o.id){ return; }
			lines.push(`| ${psName(o.id)} | ${psName(o.sign)} | ${o.signlon !== undefined && o.signlon !== null ? fmtNum(o.signlon, 2) + '°' : '-'} |`);
		});
	}
	const tail = [...psCurrentMomentLines(chartObj, []), ...psMethodNoteLines('prenatalsyzygy')];
	if(tail.length){ lines.push(''); lines.push(...tail); }
	return lines.join('\n');
}

function splitDateTime(s){
	const str = `${s || ''}`.trim();
	if(!str){ return null; }
	const parts = str.replace('T', ' ').split(' ');
	return { date: (parts[0] || '').replace(/-/g, '/'), time: parts[1] || '12:00:00' };
}

class AstroPrenatalSyzygy extends Component{
	constructor(props){
		super(props);
		this.state = { loading: false, syzygy: null, chart: null, key: '' };
		this.load = this.load.bind(this);
	}

	// [Q-106/T-10] AI 导出:产前朔望 tab 导出时构建快照写回 detail.snapshotText。
	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'prenatalsyzygy' || !this.props.value){ return; }
		buildPrenatalSyzygySnapshotText(this.props.value).then((txt)=>{ evt.detail.snapshotText = txt || ''; }).catch(()=>{});
	}
	componentDidMount(){
		this._mounted = true; this.load();
		this._onSnapshotRefresh = (evt)=>this.handleSnapshotRefreshRequest(evt);
		if(typeof window !== 'undefined'){ window.addEventListener('horosa:refresh-module-snapshot', this._onSnapshotRefresh); }
	}
	componentWillUnmount(){
		this._mounted = false;
		if(typeof window !== 'undefined' && this._onSnapshotRefresh){ window.removeEventListener('horosa:refresh-module-snapshot', this._onSnapshotRefresh); }
	}
	componentDidUpdate(){
		const key = chartRequestKey(this.props.value, 'prenatalsyzygy');
		if(key && key !== this.state.key && !this.state.loading){ this.load(); }
	}

	async load(){
		if(!this.props.value){ return; }
		const key = chartRequestKey(this.props.value, 'prenatalsyzygy');
		const base = chartParams(this.props.value);
		this.setState({ loading: true });
		let syzygy = null;
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/prenatal_syzygy`, {
				body: JSON.stringify(base),
				silent: true,
				timeoutMs: 30000,
			});
			syzygy = unwrapResult(data) || null;
		}catch(e){ syzygy = null; }
		if(!this._mounted){ return; }
		// 以朔望时刻为新出生时刻 + 出生地不变,排完整盘。
		let chart = null;
		const dt = syzygy && syzygy.type ? splitDateTime(syzygy.datetime) : null;
		if(dt){
			try{
				const chartBody = { ...base, date: dt.date, time: dt.time };
				const rsp = await fetchChart(chartBody);
				chart = unwrapResult(rsp) || null;
			}catch(e){ chart = null; }
		}
		if(!this._mounted){ return; }
		// horosa_panel_ready_v1:朔望摘要 + 朔望盘两件都已就绪的那一次 setState(中栏盘与右栏同源)。
		this.setState({ syzygy, chart, loading: false, key }, ()=>{ markPanelReady('direction'); });
		// [Q-106/T-10] AI 快照已由主控接入(aiAnalysisContext 'prenatalsyzygy' → buildPrenatalSyzygySnapshotText)。
	}

	renderSummary(){
		const s = this.state.syzygy;
		const sm = (id)=>symbolWithMeaning(id, this.props.showAstroMeaning);
		if(!s || !s.type){
			return (
				<div style={cardStyle}>
					<div className="horosa-info-card-title">产前朔望</div>
					<div style={{opacity: 0.65}}>未能求得产前朔望（极区或星历不可用）。</div>
				</div>
			);
		}
		const rows = [
			{ k: '类型', v: SYZYGY_TYPE_CN[s.type] || s.type },
			{ k: '时刻', v: s.datetime || '—' },
			{ k: '出生前', v: s.daysBeforeBirth != null ? `${fmtNum(s.daysBeforeBirth, 2)} 天` : '—' },
		];
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">产前朔望</div>
				<SmallTable
					rows={rows}
					rowKey={(r)=>r.k}
					columns={[
						{ key: 'k', title: '项' },
						{ key: 'v', title: '值' },
					]}
				/>
				<div style={{marginTop: 8, fontSize: 12.5, lineHeight: 2}}>
					{/* [Q-185/T-107] 日月各按自身黄经取座(此前太阳恒取取度发光体所在座、月亮非取度体时座为「-」:望且月在地平上的盘两行皆错) */}
					<div>{sm('Sun')} <span style={{opacity: 0.8}}>太阳</span> {fmtDegree(signItemOfLon(s.sunLon))}</div>
					<div>{sm('Moon')} <span style={{opacity: 0.8}}>月亮</span> {fmtDegree(signItemOfLon(s.moonLon))}</div>
				</div>
			</div>
		);
	}

	renderHyleg(){
		const s = this.state.syzygy;
		if(!s || !s.type){ return null; }
		const sm = (id)=>symbolWithMeaning(id, this.props.showAstroMeaning);
		return (
			<div style={cardStyle}>
				<div className="horosa-info-card-title">取度（发光体）</div>
				<div style={{fontSize: 12.5, lineHeight: 2}}>
					<div>
						<span style={{opacity: 0.8}}>取度发光体：</span>{sm(s.hylegBody)}
						<span style={{opacity: 0.65, fontSize: 11, marginLeft: 6}}>{s.type === 'new' ? '朔→合相度' : '望→地平之上发光体度'}</span>
					</div>
					<div><span style={{opacity: 0.8}}>取度：</span>{fmtDegree({ sign: s.hylegSign, signlon: s.hylegSignlon })}</div>
				</div>
			</div>
		);
	}

	renderChart(height){
		const chart = this.state.chart;
		if(!chart || !chart.chart){
			return (
				<div style={{ ...cardStyle, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--horosa-text-soft)' }}>
					求得产前朔望后显示完整盘
				</div>
			);
		}
		return (
			<AstroChart
				value={chart}
				chartDisplay={this.props.chartDisplay}
				chartStyle={this.props.chartStyle}
				wheelArt={this.props.wheelArt}
				planetDisplay={this.props.planetDisplay}
				lotsDisplay={this.props.lotsDisplay}
				showAstroMeaning={this.props.showAstroMeaning}
				height={height}
			/>
		);
	}

	render(){
		const height = this.props.height || 640;
		return (
			<Spin spinning={this.state.loading}>
				<Row gutter={6} style={{ height }}>
					<Col span={17} style={{ height: '100%' }}>
						{this.renderChart(height)}
					</Col>
					<Col span={7} className="horosa-scrollbar" style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', paddingRight: 6 }}>
						{this.renderSummary()}
						{this.renderHyleg()}
					</Col>
				</Row>
			</Spin>
		);
	}
}

export default AstroPrenatalSyzygy;
