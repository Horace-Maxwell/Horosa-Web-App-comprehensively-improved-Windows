import { Component } from 'react';
import { Spin } from 'antd';
import { XQButton as Button } from '../xq-ui';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, fmtDegree, chartParams, chartRequestKey, cardStyle, SmallTable } from './AstroExtraCommon';
import * as astroAiSnapshot from '../../utils/astroAiSnapshot';

// [Q-106/T-10] 回归轴页上线为 AI 技法键 returntimeline:无头快照 builder(与页面同一 /astroextra/returns 请求)。
const rtBirthHeaderLines = (c) => (typeof astroAiSnapshot.buildPredictiveBirthHeaderLines === 'function' ? astroAiSnapshot.buildPredictiveBirthHeaderLines(c) : []);
const rtCurrentMomentLines = (c, x) => (typeof astroAiSnapshot.buildCurrentMomentLines === 'function' ? astroAiSnapshot.buildCurrentMomentLines(c, x) : []);
const rtMethodNoteLines = (k) => (typeof astroAiSnapshot.buildMethodNoteLines === 'function' ? astroAiSnapshot.buildMethodNoteLines(k) : []);
function rtDeg(v){
	if(!v){ return '-'; }
	try{ return fmtDegree(v); }catch(e){ return '-'; }
}
// opts:{ startYear, count }(缺=页面缺省:今年起 12 年)。无行返回 ''。
export async function buildReturnTimelineSnapshotText(chartObj, opts){
	if(!chartObj){ return ''; }
	const o = { startYear: new Date().getFullYear(), count: 12, ...(opts || {}) };
	let rows = [];
	try{
		const data = await request(`${Constants.ServerRoot}/astroextra/returns`, {
			body: JSON.stringify({ ...chartParams(chartObj), startYear: o.startYear, count: o.count }),
			timeoutMs: 45000,
		});
		const r = unwrapResult(data) || {};
		rows = Array.isArray(r.rows) ? r.rows : [];
	}catch(e){ return ''; }
	if(!rows.length){ return ''; }
	const lines = [];
	lines.push(...rtBirthHeaderLines(chartObj));
	lines.push('[太阳/月亮返照时间轴]');
	lines.push(`区间：${o.startYear} 年起 ${o.count} 年（太阳返照 = 太阳回到本命度;首个月亮返照 = 该年首个月亮回本命度）`);
	lines.push('| 年份 | 太阳返照 | 首个月亮返照 | 太阳返照上升 | 月亮返照上升 |');
	lines.push('| --- | --- | --- | --- | --- |');
	rows.forEach((row)=>{
		const sr = row.solarReturn && row.solarReturn.datetime ? row.solarReturn.datetime : '-';
		const lr = row.lunarReturn && row.lunarReturn.datetime ? row.lunarReturn.datetime : '-';
		lines.push(`| ${row.year} | ${sr} | ${lr} | ${rtDeg(row.solarAsc)} | ${rtDeg(row.lunarAsc)} |`);
	});
	const tail = [...rtCurrentMomentLines(chartObj, []), ...rtMethodNoteLines('returntimeline')];
	if(tail.length){ lines.push(''); lines.push(...tail); }
	return lines.join('\n');
}
import { markPanelReady } from '../../utils/perfMark';

class AstroReturnTimeline extends Component{
	constructor(props){
		super(props);
		const now = new Date();
		this.state = {
			startYear: now.getFullYear(),
			count: 12,
			loading: false,
			result: null,
			requestKey: '',
		};
		this.load = this.load.bind(this);
	}

	// [Q-106/T-10] AI 导出:回归轴 tab 导出时按页面当前起始年/年数构建快照写回 detail.snapshotText。
	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'returntimeline' || !this.props.value){ return; }
		buildReturnTimelineSnapshotText(this.props.value, { startYear: Number(this.state.startYear) || new Date().getFullYear(), count: Number(this.state.count) || 12 })
			.then((txt)=>{ evt.detail.snapshotText = txt || ''; }).catch(()=>{});
	}

	componentDidMount(){
		this._mounted = true;
		this.load();
		this._onSnapshotRefresh = (evt)=>this.handleSnapshotRefreshRequest(evt);
		if(typeof window !== 'undefined'){ window.addEventListener('horosa:refresh-module-snapshot', this._onSnapshotRefresh); }
	}

	componentWillUnmount(){
		this._mounted = false;
		if(typeof window !== 'undefined' && this._onSnapshotRefresh){ window.removeEventListener('horosa:refresh-module-snapshot', this._onSnapshotRefresh); }
	}

	componentDidUpdate(prevProps){
		const key = chartRequestKey(this.props.value, `returns|${this.state.startYear}|${this.state.count}`);
		if(key && key !== this.state.requestKey && !this.state.loading){
			this.load();
		}
	}

	ensureLoaded(){
		const key = chartRequestKey(this.props.value, `returns|${this.state.startYear}|${this.state.count}`);
		if(key && key !== this.state.requestKey && !this.state.loading){
			setTimeout(this.load, 0);
		}
	}

	async load(){
		if(!this.props.value){
			return;
		}
		const key = chartRequestKey(this.props.value, `returns|${this.state.startYear}|${this.state.count}`);
		this.setState({loading: true});
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/returns`, {
				body: JSON.stringify({
					...chartParams(this.props.value),
					startYear: this.state.startYear,
					count: this.state.count,
				}),
				timeoutMs: 45000,
			});
			if(!this._mounted) return;
			// horosa_panel_ready_v1:回归轴表(本技法唯一可见内容)落定的那一次 setState。
			this.setState({result: unwrapResult(data) || {}, loading: false, requestKey: key}, ()=>{ markPanelReady('direction'); });
		}catch(e){
			if(!this._mounted) return;
			this.setState({loading: false, requestKey: key});
		}
	}

	render(){
		this.ensureLoaded();
		const rows = this.state.result && this.state.result.rows ? this.state.result.rows : [];
		return (
			<Spin spinning={this.state.loading}>
				<div style={{height: this.props.height || 700, overflow: 'auto', paddingRight: 8}}>
					<div style={{...cardStyle, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center'}}>
						<label>起始年 <input type="number" value={this.state.startYear} onChange={(e)=>this.setState({startYear: e.target.value})} /></label>
						<label>年数 <input type="number" min="1" max="40" value={this.state.count} onChange={(e)=>this.setState({count: e.target.value})} /></label>
						<Button size="small" onClick={this.load}>生成时间轴</Button>
					</div>
					<div style={cardStyle}>
						<div className="horosa-info-card-title">太阳/月亮返照时间轴</div>
						<SmallTable
							rows={rows}
							columns={[
								{key: 'year', title: '年份'},
								{key: 'solarReturn', title: '太阳返照', render: (v)=>v && v.datetime ? v.datetime : '-'},
								{key: 'lunarReturn', title: '首个月亮返照', render: (v)=>v && v.datetime ? v.datetime : '-'},
								{key: 'solarAsc', title: '太阳返照上升', render: (v)=>v ? fmtDegree(v) : '-'},
								{key: 'lunarAsc', title: '月亮返照上升', render: (v)=>v ? fmtDegree(v) : '-'},
							]}
						/>
					</div>
				</div>
			</Spin>
		);
	}
}

export default AstroReturnTimeline;
