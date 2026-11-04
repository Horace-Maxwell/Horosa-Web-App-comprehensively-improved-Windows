import { Component } from 'react';
import { Spin, Row, Col } from 'antd';
import { XQInputNumber } from '../xq-ui';
import UpdatingBadge from '../common/UpdatingBadge';
import styles from '../../css/styles.less';
import request from '../../utils/request';
import DateTime from '../comp/DateTime';
import * as Constants from '../../utils/constants';
import { unwrapResult, fmtDegree, chartParams, chartRequestKey, cardStyle, SmallTable, parkLoadFailure, clearLoadFailure, loadParked } from './AstroExtraCommon';
import * as astroAiSnapshot from '../../utils/astroAiSnapshot';
import { natalSourceKey, pickKeyedDerived } from '../../utils/derivedChartSource';

// 回归轴页上线为 AI 技法键 returntimeline:无头快照 builder(与页面同一 /astroextra/returns 请求)。
const rtBirthHeaderLines = (c) => (typeof astroAiSnapshot.buildPredictiveBirthHeaderLines === 'function' ? astroAiSnapshot.buildPredictiveBirthHeaderLines(c) : []);
const rtCurrentMomentLines = (c, x) => (typeof astroAiSnapshot.buildCurrentMomentLines === 'function' ? astroAiSnapshot.buildCurrentMomentLines(c, x) : []);
const rtMethodNoteLines = (k) => (typeof astroAiSnapshot.buildMethodNoteLines === 'function' ? astroAiSnapshot.buildMethodNoteLines(k) : []);
// opts:{ startYear, count }(缺=页面缺省:今年起 12 年)。无行返回 ''。
export async function buildReturnTimelineSnapshotText(chartObj, opts){
	if(!chartObj){ return ''; }
	const o = { startYear: DateTime.wallClockForChart(chartObj.params ? chartObj.params.zone : '').getFullYear(), count: 12, ...(opts || {}) };   // 「今年」按本盘时区
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
		lines.push(`| ${row.year} | ${sr} | ${lr} | ${fmtDegree(row.solarAsc)} | ${fmtDegree(row.lunarAsc)} |`);
	});
	const tail = [...rtCurrentMomentLines(chartObj, []), ...rtMethodNoteLines('returntimeline')];
	if(tail.length){ lines.push(''); lines.push(...tail); }
	return lines.join('\n');
}
import { markPanelReady } from '../../utils/perfMark';

class AstroReturnTimeline extends Component{
	constructor(props){
		super(props);
		const now = DateTime.wallClockForChart(props.value && props.value.params ? props.value.params.zone : '');   // 「今年」按本盘时区
		this.state = {
			startYear: now.getFullYear(),
			count: 12,
			loading: false,
			result: null,
			requestKey: '',
		};
		this.load = this.load.bind(this);
	}

	// AI 导出:回归轴 tab 导出时按页面当前起始年/年数构建快照写回 detail.snapshotText。
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
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){
			this.load();
		}
	}

	ensureLoaded(){
		const key = chartRequestKey(this.props.value, `returns|${this.state.startYear}|${this.state.count}`);
		if(key && key !== this.state.requestKey && !this.state.loading && !loadParked(this, key)){
			setTimeout(this.load, 0);
		}
	}

	async load(){
		const seq = ++this._loadSeq || (this._loadSeq = 1);   // 只认最后一次:换盘 / 改参连发时先发的晚回不覆盖
		const resultSig = natalSourceKey(this.props.value);   // 本次结果出自哪位命主(读时与当前盘比)
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
			if(!this._mounted || seq !== this._loadSeq) return;
			clearLoadFailure(this);
			// horosa_panel_ready_v1:回归轴表(本技法唯一可见内容)落定的那一次 setState。
			this.setState({result: unwrapResult(data) || {}, resultSig, loading: false, requestKey: key}, ()=>{ markPanelReady('direction'); });
		}catch(e){
			if(!this._mounted || seq !== this._loadSeq) return;
			parkLoadFailure(this, key);   // 失败不记成已完成:窗口期后同一张盘自动重试
			this.setState({loading: false});
		}
	}

	// 出自当前命主的结果才用:换盘后新结果在途 / 取失败时 state 里是上一位命主的 → 当没有(同一命主只改设置仍旧表留存)
	shownResult(){
		return pickKeyedDerived(this.state.result, this.state.resultSig, natalSourceKey(this.props.value));
	}

	render(){
		this.ensureLoaded();
		const shown = this.shownResult();
		const rows = shown && shown.rows ? shown.rows : [];
		const height = this.props.height || 700;
		const setNum = (field, min, max)=>(v)=>{ const n = Math.round(Number(v)); if(Number.isFinite(n) && n >= min && n <= max){ this.setState({ [field]: n }); } };
		// 与界推运等表页同一套头卡;改起始年 / 年数即重算(componentDidUpdate 按请求键),不再要「生成」按钮;
		// keep-stale:首次加载才转圈,重取期间旧表留着,右上角「更新中…」
		return (
			<Spin spinning={this.state.loading && !shown}>
				<div style={{ position: 'relative' }}>
				{this.state.loading && shown ? <UpdatingBadge /> : null}
				<div className={`${styles.scrollbar} horosa-balbillus-shell`} style={{ height, overflow: 'auto', paddingRight: 8 }}>
					<div className="horosa-balbillus-head">
						<div className="horosa-balbillus-title">
							回归轴<span className="horosa-balbillus-sub">太阳 / 月亮返照时间轴 · {Number(this.state.startYear)} – {Number(this.state.startYear) + Number(this.state.count) - 1} 年</span>
						</div>
						<div className="horosa-balbillus-desc">
							逐年列出太阳返照的时刻、该年第一次月亮返照的时刻,以及两张返照盘各自的上升。改起始年或年数即重算。
						</div>
						<Row gutter={12} className="horosa-balbillus-controls">
							<Col span={6}>
								<div className="horosa-balbillus-label">起始年</div>
								<XQInputNumber style={{ width: '100%' }} min={-12999} max={16799} step={1} value={Number(this.state.startYear)} onChange={setNum('startYear', -12999, 16799)} />
							</Col>
							<Col span={6}>
								<div className="horosa-balbillus-label">年数</div>
								<XQInputNumber style={{ width: '100%' }} min={1} max={40} step={1} value={Number(this.state.count)} onChange={setNum('count', 1, 40)} />
							</Col>
						</Row>
					</div>
					<div style={cardStyle}>
						<div className="horosa-info-card-title">太阳 / 月亮返照时间轴</div>
						<SmallTable
							rows={rows}
							columns={[
								{key: 'year', title: '年份', width: '10%', align: 'right'},
								{key: 'solarReturn', title: '太阳返照', width: '25%', render: (v)=>(v && v.datetime ? v.datetime : '-')},
								{key: 'lunarReturn', title: '首个月亮返照', width: '25%', render: (v)=>(v && v.datetime ? v.datetime : '-')},
								{key: 'solarAsc', title: '太阳返照上升', width: '20%', render: (v)=>fmtDegree(v)},
								{key: 'lunarAsc', title: '月亮返照上升', render: (v)=>fmtDegree(v)},
							]}
						/>
					</div>
				</div>
				</div>
			</Spin>
		);
	}
}

export default AstroReturnTimeline;
