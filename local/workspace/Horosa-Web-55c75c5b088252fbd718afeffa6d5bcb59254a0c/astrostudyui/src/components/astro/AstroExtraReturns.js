import { Component } from 'react';
import { Spin } from 'antd';
import { XQSelect as Select } from '../xq-ui';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, chartParams, chartRequestKey, astroSymbol } from './AstroExtraCommon';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
// [YB] 三段补厚共享 helper(起盘信息/当前时点/方法说明)。namespace import + typeof 守卫:
// 测试环境可能部分 mock astroAiSnapshot(只留 buildAstroSnapshotContent 等),缺函数时回 [] 保底。
import * as astroAiSnapshot from '../../utils/astroAiSnapshot';

const birthHeaderLines = (c) => (typeof astroAiSnapshot.buildPredictiveBirthHeaderLines === 'function' ? astroAiSnapshot.buildPredictiveBirthHeaderLines(c) : []);
const currentMomentLines = (c, x) => (typeof astroAiSnapshot.buildCurrentMomentLines === 'function' ? astroAiSnapshot.buildCurrentMomentLines(c, x) : []);
const methodNoteLines = (k) => (typeof astroAiSnapshot.buildMethodNoteLines === 'function' ? astroAiSnapshot.buildMethodNoteLines(k) : []);
import * as AstroConst from '../../constants/AstroConst';
import styles from '../../css/styles.less';
import { markPanelReady } from '../../utils/perfMark';

const Option = Select.Option;
const BODIES = [
	{ key: 'Saturn', cn: '土星返照', period: '≈29.5 年', glyph: AstroConst.SATURN },
	{ key: 'Jupiter', cn: '木星返照', period: '≈11.9 年', glyph: AstroConst.JUPITER },
	{ key: 'Node', cn: '月交返照', period: '≈18.6 年', glyph: AstroConst.NORTH_NODE },
];
function bodyMeta(k){ return BODIES.find((b) => b.key === k) || BODIES[0]; }

async function fetchReturns(chartObj, body, count){
	if(!chartObj){ return null; }
	try{
		const data = await request(`${Constants.ServerRoot}/astroextra/planetreturn`, {
			body: JSON.stringify({ ...chartParams(chartObj), body, count }),
			timeoutMs: 90000,
		});
		return unwrapResult(data) || (data && data.Result) || data;
	}catch(e){ return null; }
}

// AI 快照（请求型，内部拉三体返照）。section 头 [多重回归] 与 aiExport preset 对齐。
export async function buildExtraReturnsSnapshotText(chartObj){
	if(!chartObj){ return ''; }
	const bodyLines = [];
	for(let i = 0; i < BODIES.length; i++){
		const b = BODIES[i];
		// bug 修:导出此前只取 4 回而 UI 取 5 回(组件 state.count=5)→ 对齐 5。
		const r = await fetchReturns(chartObj, b.key, 5);
		const rows = (r && r.returns) || [];
		if(!rows.length){ continue; }
		// bug 修:导出此前缺各回 time 与本命黄经 natalLon(UI 逐行/页脚均有)→ 补进每行;
		// 既有「第N回 日期」字段顺序不变,新字段(时刻表+本命黄经,口径同 UI toFixed(1))追加在行尾。
		const datesTxt = rows.map((x) => `第${x.which}回 ${x.date}`).join('，');
		const timesTxt = rows.map((x) => `第${x.which}回 ${x.time || '-'}`).join('，');
		const natalLonTxt = (r && r.natalLon !== undefined && r.natalLon !== null) ? `；本命黄经 ${Number(r.natalLon).toFixed(1)}°` : '';
		bodyLines.push(`${b.cn}（${b.period}）：${datesTxt}；时刻：${timesTxt}${natalLonTxt}`);
	}
	if(!bodyLines.length){ return ''; }
	const lines = [];
	// [YB] 头部盘主生辰([起盘信息];无数据 helper 自返 [],不产空段头)。
	lines.push(...birthHeaderLines(chartObj));
	lines.push('[多重回归]');
	lines.push(...bodyLines);
	// [YB] 尾部 [当前时点]+[方法说明](返照日期表即周期节点,按导出时刻自查,不另加定位行)。
	const tail = [...currentMomentLines(chartObj), ...methodNoteLines('extrareturns')];
	if(tail.length){
		lines.push('');
		lines.push(...tail);
	}
	return lines.join('\n');
}

class AstroExtraReturns extends Component{
	constructor(props){
		super(props);
		this.state = { body: 'Saturn', count: 5, loading: false, data: null, requestKey: '' };
		this.load = this.load.bind(this);
		this.changeBody = this.changeBody.bind(this);
		this.saveAISnapshot = this.saveAISnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	componentDidMount(){
		this._mounted = true;
		this.load();
		this.saveAISnapshot();
		if(typeof window !== 'undefined'){ window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest); }
	}

	componentDidUpdate(prev){
		if(prev.value !== this.props.value){ this.setState({ requestKey: '' }, this.load); this.saveAISnapshot(); }
	}

	componentWillUnmount(){
		this._mounted = false;
		if(typeof window !== 'undefined'){ window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest); }
	}

	async saveAISnapshot(){
		const txt = await buildExtraReturnsSnapshotText(this.props.value);
		saveModuleAISnapshot('extrareturns', txt, { tab: 'extrareturns' });
		return txt;
	}

	async handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'extrareturns'){ return; }
		const txt = await this.saveAISnapshot();
		if(txt){ evt.detail.snapshotText = txt; }
	}

	async load(){
		if(!this.props.value){ return; }
		const key = chartRequestKey(this.props.value, `returns|${this.state.body}|${this.state.count}`);
		if(key === this.state.requestKey && this.state.data){ return; }
		this.setState({ loading: true });
		const r = await fetchReturns(this.props.value, this.state.body, this.state.count);
		if(!this._mounted) return;
		// horosa_panel_ready_v1:多重回归表(本技法唯一可见内容)落定的那一次 setState。
		this.setState({ data: r, loading: false, requestKey: key }, ()=>{ markPanelReady('direction'); });
	}

	changeBody(v){ this.setState({ body: v, requestKey: '' }, this.load); }

	render(){
		const height = this.props.height ? this.props.height : 760;
		const meta = bodyMeta(this.state.body);
		const rows = (this.state.data && this.state.data.returns) || [];
		return (
			<div className={styles.scrollbar} style={{ height: `${height - 20}px`, overflowY: 'auto', overflowX: 'hidden', padding: '4px 8px 12px' }}>
				<div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>多重回归<span style={{ fontSize: 12, opacity: 0.55, marginLeft: 8, fontWeight: 400 }}>土星 / 木星 / 月交 返照 · 人生周期标记</span></div>
				<div style={{ fontSize: 11.5, opacity: 0.6, lineHeight: '17px', marginBottom: 10 }}>行星返照到本命黄经的时刻 = 重要人生周期节点：土返≈29.5 年（成熟/责任/结构转折）、木返≈12 年（扩展/机遇）、月交返≈18.6 年（关系/方向循环）。</div>
				<div style={{ marginBottom: 12, maxWidth: 240 }}>
					<Select value={this.state.body} onChange={this.changeBody} style={{ width: '100%' }}>
						{BODIES.map((b) => <Option key={b.key} value={b.key}>{b.cn}（{b.period}）</Option>)}
					</Select>
				</div>
				<Spin spinning={this.state.loading}>
					{rows.length ? (
						<div style={{ border: '1px solid rgba(128,128,128,0.12)', borderRadius: 8, overflow: 'hidden' }}>
							{rows.map((x, i) => (
								<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderTop: i ? '1px solid rgba(128,128,128,0.06)' : 'none', fontSize: 12.5 }}>
									<span style={{ fontSize: 16 }}>{astroSymbol(meta.glyph)}</span>
									<span style={{ width: 48, opacity: 0.6 }}>第 {x.which} 回</span>
									<span style={{ flex: 1, fontWeight: 600 }}>{x.date}</span>
									<span style={{ opacity: 0.55 }}>{x.time || ''}</span>
								</div>
							))}
							<div style={{ fontSize: 10.5, opacity: 0.45, padding: '6px 12px' }}>返照本命黄经 {(this.state.data && this.state.data.natalLon != null) ? this.state.data.natalLon.toFixed(1) + '°' : ''}（swisseph 精算）。</div>
						</div>
					) : (
						<div style={{ fontSize: 12.5, opacity: 0.55, padding: '12px 0' }}>{this.state.loading ? '' : '暂无返照数据（请确认本地服务运行且本命盘已排出）。'}</div>
					)}
				</Spin>
			</div>
		);
	}
}

export default AstroExtraReturns;
