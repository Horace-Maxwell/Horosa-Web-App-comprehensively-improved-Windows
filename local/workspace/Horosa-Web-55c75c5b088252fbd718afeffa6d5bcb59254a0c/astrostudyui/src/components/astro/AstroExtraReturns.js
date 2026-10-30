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
import { natalSourceKey, pickKeyedDerived } from '../../utils/derivedChartSource';
import { markPanelReady } from '../../utils/perfMark';

const Option = Select.Option;
// 可选星体:回到本命黄经的地心平均间隔(水金地心平均与太阳同为一年,火星约 2 年一回但逆行年份前后差数月)
const BODIES = [
	{ key: 'Saturn', cn: '土星返照', period: '≈29.5 年', glyph: AstroConst.SATURN },
	{ key: 'Jupiter', cn: '木星返照', period: '≈11.9 年', glyph: AstroConst.JUPITER },
	{ key: 'Node', cn: '月交返照', period: '≈18.6 年', glyph: AstroConst.NORTH_NODE },
	{ key: 'Sun', cn: '太阳返照', period: '≈1 年', glyph: AstroConst.SUN },
	{ key: 'Moon', cn: '月亮返照', period: '≈27.3 天', glyph: AstroConst.MOON },
	{ key: 'Mercury', cn: '水星返照', period: '≈1 年', glyph: AstroConst.MERCURY },
	{ key: 'Venus', cn: '金星返照', period: '≈1 年', glyph: AstroConst.VENUS },
	{ key: 'Mars', cn: '火星返照', period: '≈1.9 年', glyph: AstroConst.MARS },
	{ key: 'Uranus', cn: '天王星返照', period: '≈84 年', glyph: AstroConst.URANUS },
	{ key: 'Neptune', cn: '海王星返照', period: '≈165 年', glyph: AstroConst.NEPTUNE },
	{ key: 'Pluto', cn: '冥王星返照', period: '≈248 年', glyph: AstroConst.PLUTO },
];
// AI 快照只取三个人生周期体(其余星体在页面上逐个查看)
const SNAPSHOT_BODIES = ['Saturn', 'Jupiter', 'Node'];
const COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12];
function bodyMeta(k){ return BODIES.find((b) => b.key === k) || BODIES[0]; }

// 一回里的全部经过(逆行时同一回会过本命黄经三次);没找到的回 found=false
function returnPasses(x){
	return Array.isArray(x && x.passes) ? x.passes : [];
}

// 月交点按本盘设置取平 / 真交点(缺省平交点),与盘面所画交点同一个
function nodeTypeText(chartObj){
	const p = (chartObj && chartObj.params) || {};
	return (p.westNodeType === 'true' || p.guolaoNodeType === 'true') ? '真交点' : '平交点';
}

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
	for(let i = 0; i < SNAPSHOT_BODIES.length; i++){
		const b = bodyMeta(SNAPSHOT_BODIES[i]);
		// bug 修:导出此前只取 4 回而 UI 取 5 回(组件 state.count=5)→ 对齐 5。
		const r = await fetchReturns(chartObj, b.key, 5);
		const rows = (r && r.returns) || [];
		if(!rows.length){ continue; }
		// bug 修:导出此前缺各回 time 与本命黄经 natalLon(UI 逐行/页脚均有)→ 补进每行;
		// 既有「第N回 日期」字段顺序不变,新字段(时刻表+本命黄经,口径同 UI toFixed(1))追加在行尾。
		// 逆行三过:同一回列出全部过程(顺→逆→顺),单过仍是一个日期
		const datesTxt = rows.map((x) => {
			if(x.found === false){ return `第${x.which}回 范围内未找到`; }
			const ps = returnPasses(x).length > 1 ? returnPasses(x) : null;
			return ps ? `第${x.which}回 ${ps.map((pp) => `${pp.date}${pp.retrograde ? '(逆)' : ''}`).join('/')}` : `第${x.which}回 ${x.date}`;
		}).join('，');
		const timesTxt = rows.map((x) => `第${x.which}回 ${x.found === false ? '-' : (x.time || '-')}`).join('，');
		const natalLonTxt = (r && r.natalLon !== undefined && r.natalLon !== null) ? `；本命黄经 ${Number(r.natalLon).toFixed(1)}°` : '';
		const nodeTxt = b.key === 'Node' ? `（${nodeTypeText(chartObj)}）` : '';
		bodyLines.push(`${b.cn}${nodeTxt}（${b.period}）：${datesTxt}；时刻：${timesTxt}${natalLonTxt}`);
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
		this.changeCount = this.changeCount.bind(this);
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
		const seq = ++this._loadSeq || (this._loadSeq = 1);   // 只认最后一次:换盘 / 改参连发时先发的晚回不覆盖
		const resultSig = natalSourceKey(this.props.value);   // 本次结果出自哪位命主(读时与当前盘比)
		if(!this.props.value){ return; }
		const key = chartRequestKey(this.props.value, `returns|${this.state.body}|${this.state.count}`);
		if(key === this.state.requestKey && this.shownData()){ return; }
		this.setState({ loading: true });
		const r = await fetchReturns(this.props.value, this.state.body, this.state.count);
		if(!this._mounted || seq !== this._loadSeq) return;
		// horosa_panel_ready_v1:多重回归表(本技法唯一可见内容)落定的那一次 setState。
		this.setState({ data: r, dataSig: resultSig, loading: false, requestKey: key }, ()=>{ markPanelReady('direction'); });
	}

	changeBody(v){ this.setState({ body: v, requestKey: '' }, this.load); }

	changeCount(v){ this.setState({ count: Number(v) || 5, requestKey: '' }, this.load); }

	// 出自当前命主的结果才用:换盘后新结果在途 / 取失败时 state 里是上一位命主的 → 当没有(同一命主只改设置仍旧表留存)
	shownData(){
		return pickKeyedDerived(this.state.data, this.state.dataSig, natalSourceKey(this.props.value));
	}

	render(){
		const height = this.props.height ? this.props.height : 760;
		const meta = bodyMeta(this.state.body);
		const rows = (this.shownData() && this.shownData().returns) || [];
		const data = this.shownData();
		const zodiacText = (this.props.value && this.props.value.params && Number(this.props.value.params.zodiacal) === 1) ? '恒星黄道' : '回归黄道';
		return (
			<div className={styles.scrollbar} style={{ height: `${height - 20}px`, overflowY: 'auto', overflowX: 'hidden', padding: '4px 8px 12px' }}>
				<div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>多重回归<span style={{ fontSize: 12, color: 'var(--horosa-text-secondary)', marginLeft: 8, fontWeight: 400 }}>行星回到本命黄经的时刻 · 人生周期标记</span></div>
				<div style={{ fontSize: 11.5, color: 'var(--horosa-text-secondary)', lineHeight: '17px', marginBottom: 10 }}>第 n 回 = 该星从出生起走满 n 圈、回到本命黄经那一次；逆行年份同一回会经过本命黄经三次，逐次列出。常用：土返≈29.5 年（成熟/责任/结构转折）、木返≈12 年（扩展/机遇）、月交返≈18.6 年（关系/方向循环）。</div>
				<div style={{ display: 'flex', gap: 8, marginBottom: 12, maxWidth: 360 }}>
					<Select value={this.state.body} onChange={this.changeBody} style={{ flex: 1 }}>
						{BODIES.map((b) => <Option key={b.key} value={b.key}>{b.cn}（{b.period}）</Option>)}
					</Select>
					<Select value={this.state.count} onChange={this.changeCount} style={{ width: 96 }}>
						{COUNT_OPTIONS.map((n) => <Option key={n} value={n}>前 {n} 回</Option>)}
					</Select>
				</div>
				<Spin spinning={this.state.loading}>
					{rows.length ? (
						<div style={{ border: '1px solid rgba(128,128,128,0.12)', borderRadius: 8, overflow: 'hidden' }}>
							{rows.map((x, i) => {
								if(x.found === false){
									return (
										<div key={i} style={{ borderTop: i ? '1px solid rgba(128,128,128,0.06)' : 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', fontSize: 12.5 }}>
											<span style={{ fontSize: 16 }}>{astroSymbol(meta.glyph)}</span>
											<span style={{ width: 48, whiteSpace: 'nowrap', color: 'var(--horosa-text-secondary)' }}>第 {x.which} 回</span>
											<span style={{ flex: 1, color: 'var(--horosa-text-secondary)' }}>范围内未找到（星历范围外）</span>
										</div>
									);
								}
								// 同一回内多次经过(逆行三过):全列;单过时一行
								const passes = returnPasses(x).length > 1 ? returnPasses(x) : null;
								return (
								<div key={i} style={{ borderTop: i ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
									<div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', fontSize: 12.5 }}>
										<span style={{ fontSize: 16 }}>{astroSymbol(meta.glyph)}</span>
										<span style={{ width: 48, whiteSpace: 'nowrap', color: 'var(--horosa-text-secondary)' }}>第 {x.which} 回</span>
										<span style={{ flex: 1, fontWeight: 600 }}>{x.date}{passes ? <span style={{ fontWeight: 400, color: 'var(--horosa-text-secondary)', marginLeft: 6 }}>（共 {passes.length} 过 · 首过）</span> : null}</span>
										<span style={{ color: 'var(--horosa-text-secondary)' }}>{x.time || ''}</span>
									</div>
									{passes ? passes.map((pp, j) => (
										<div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 12px 6px 70px', fontSize: 12, opacity: 0.8 }}>
											<span style={{ width: 52, whiteSpace: 'nowrap' }}>第 {pp.pass} 过{pp.retrograde ? '（逆）' : ''}</span>
											<span style={{ flex: 1 }}>{pp.date}</span>
											<span style={{ color: 'var(--horosa-text-secondary)' }}>{pp.time || ''}</span>
										</div>
									)) : null}
								</div>
								);
							})}
							<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', padding: '6px 12px' }}>
								本命黄经 {(data && data.natalLon != null) ? Number(data.natalLon).toFixed(2) + '°' : ''}（{zodiacText}{this.state.body === 'Node' ? `，${nodeTypeText(this.props.value)}` : ''}，与本盘设置一致）；时刻为当地时间，swisseph 精算到秒。
							</div>
						</div>
					) : (
						<div style={{ fontSize: 12.5, color: 'var(--horosa-text-secondary)', padding: '12px 0' }}>{this.state.loading ? '' : '暂无返照数据（请确认本地服务运行且本命盘已排出）。'}</div>
					)}
				</Spin>
			</div>
		);
	}
}

export default AstroExtraReturns;
