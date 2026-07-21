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

// ===== G11 产前朔望独立盘 =====
// 自出生时刻回溯最近的朔(日月合)/望(日月冲),取更晚者为产前朔望;以该时刻为新「出生」时刻、
// 出生地不变,调 /chart 排完整盘 → 中栏渲盘 + 右栏摘要卡。后端算法见 astroextra.compute_prenatal_syzygy。
// AI 快照留 TODO 待主控接(不写 aiAnalysisContext)。
const SYZYGY_TYPE_CN = { new: '朔（日月合）', full: '望（日月冲）' };

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

	componentDidMount(){ this._mounted = true; this.load(); }
	componentWillUnmount(){ this._mounted = false; }
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
		// TODO(AI 快照):产前朔望快照由主控统一接入(不在此写 aiAnalysisContext);
		// 待接入点 = 此处 syzygy + chart 已就绪,可构建「产前朔望」模块快照。
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
					<div>{sm('Sun')} <span style={{opacity: 0.8}}>太阳</span> {fmtDegree({ sign: s.hylegSign, signlon: s.hylegBody === 'Sun' ? s.hylegSignlon : (s.sunLon % 30) })}</div>
					<div>{sm('Moon')} <span style={{opacity: 0.8}}>月亮</span> {fmtDegree({ sign: (s.hylegBody === 'Moon' ? s.hylegSign : undefined), signlon: s.moonLon % 30, lon: s.moonLon })}</div>
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
