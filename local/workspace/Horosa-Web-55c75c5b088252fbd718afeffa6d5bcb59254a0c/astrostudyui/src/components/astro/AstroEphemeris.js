import { Component } from 'react';
import { Spin, Checkbox } from 'antd';
import { XQButton as Button, XQTabs as Tabs } from '../xq-ui';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, astroSymbol, fmtDegree, fmtNum, chartParams, chartRequestKey, cardStyle, SmallTable } from './AstroExtraCommon';
import { classicalGlobalValue, CLASSICAL_GLOBALS_EVENT } from '../../utils/classicalChartGlobals';
import * as AstroText from '../../constants/AstroText';
import * as astroAiSnapshot from '../../utils/astroAiSnapshot';
import { DIRECTION_PAGE_SETTINGS } from '../../utils/directionPageSettings';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { markPanelReady } from '../../utils/perfMark';

const TabPane = Tabs.TabPane;

// [Q-106/T-10] 星历页上线为 AI 技法键 ephemeris:无头快照 builder(与页面同一 /astroextra/ephemeris 请求)。
const ephBirthHeaderLines = (c) => (typeof astroAiSnapshot.buildPredictiveBirthHeaderLines === 'function' ? astroAiSnapshot.buildPredictiveBirthHeaderLines(c) : []);
const ephCurrentMomentLines = (c, x) => (typeof astroAiSnapshot.buildCurrentMomentLines === 'function' ? astroAiSnapshot.buildCurrentMomentLines(c, x) : []);
const ephMethodNoteLines = (k) => (typeof astroAiSnapshot.buildMethodNoteLines === 'function' ? astroAiSnapshot.buildMethodNoteLines(k) : []);
function ephName(id){
	if(id === undefined || id === null || id === ''){ return '-'; }
	return AstroText.AstroTxtMsg[id] || `${id}`;
}
function ephDeg(row){
	try{ return fmtDegree(row); }catch(e){ return '-'; }
}
export function defaultEphemerisWindow(){
	const now = new Date();
	return { startDate: fmtDate(now), endDate: fmtDate(addDays(now, 90)), includeTransits: true };
}
// opts:{ startDate, endDate, includeTransits }(缺=页面缺省:今日起 90 天、含行运触发)。无数据返回 ''(挂载显示「缺失」)。
export async function buildEphemerisSnapshotText(chartObj, opts){
	if(!chartObj){ return ''; }
	const o = { ...defaultEphemerisWindow(), ...(opts || {}) };
	const eclMode = classicalGlobalValue('eclipseTimeMode') || 'max';
	let r = null;
	try{
		const data = await request(`${Constants.ServerRoot}/astroextra/ephemeris`, {
			body: JSON.stringify({
				...chartParams(chartObj),
				startDate: o.startDate, endDate: o.endDate, includeTransits: o.includeTransits !== false,
				...(eclMode !== 'max' ? { eclipseTimeMode: eclMode } : {}),
			}),
			timeoutMs: 90000,
		});
		r = unwrapResult(data) || null;
	}catch(e){ return ''; }
	if(!r){ return ''; }
	const ing = r.ingresses || []; const sta = r.stations || []; const ph = r.lunarPhases || []; const ecl = r.eclipses || []; const ta = r.transitAspects || [];
	if(!ing.length && !sta.length && !ph.length && !ecl.length && !ta.length){ return ''; }
	const CAP = 60;
	const lines = [];
	lines.push(...ephBirthHeaderLines(chartObj));
	lines.push(`[星历事件（入座 · 留逆 · 朔望弦 · 食相）]`);
	lines.push(`区间：${o.startDate} 至 ${o.endDate}（以本命盘地点与时区计;各表最多列 ${CAP} 行）`);
	// [Q-186/T-108 ①] 后端截断(区间/逐日/行运触发)进快照明示,AI 不把截断当「无事件」
	const limText = ephemerisLimitsText(r.params);
	if(limText){ lines.push(`截断说明：${limText}`); }
	lines.push('');
	lines.push('入座：');
	lines.push('| 时间 | 星体 | 进入 | 位置 |');
	lines.push('| --- | --- | --- | --- |');
	if(!ing.length){ lines.push('| — | — | — | — |'); }
	ing.slice(0, CAP).forEach((e)=>lines.push(`| ${e.datetime || '-'} | ${ephName(e.body)} | ${ephName(e.toSign)} | ${ephDeg(e)} |`));
	lines.push('');
	lines.push('留与顺逆转向：');
	lines.push('| 时间 | 星体 | 方向 | 位置 |');
	lines.push('| --- | --- | --- | --- |');
	if(!sta.length){ lines.push('| — | — | — | — |'); }
	sta.slice(0, CAP).forEach((e)=>lines.push(`| ${e.datetime || '-'} | ${ephName(e.body)} | ${e.direction || '-'} | ${ephDeg(e)} |`));
	lines.push('');
	lines.push('朔望弦：');
	lines.push('| 时间 | 月相 | 月亮位置 |');
	lines.push('| --- | --- | --- |');
	if(!ph.length){ lines.push('| — | — | — |'); }
	ph.slice(0, CAP).forEach((e)=>lines.push(`| ${e.datetime || '-'} | ${e.phase || '-'} | ${ephDeg(e)} |`));
	lines.push('');
	lines.push('食相：');
	lines.push('| 时间 | 类型 | 细分 | 位置 | 食分 |');
	lines.push('| --- | --- | --- | --- | --- |');
	if(!ecl.length){ lines.push('| — | — | — | — | — |'); }
	ecl.slice(0, CAP).forEach((e)=>lines.push(`| ${e.datetime || '-'} | ${e.type || '-'} | ${e.eclipseType || '-'} | ${ephDeg(e)} | ${e.digit == null ? '—' : `${fmtNum(e.digit)}${e.band ? ' ' + e.band : ''}`} |`));
	lines.push('');
	lines.push('[行运触发本命]');
	if(o.includeTransits === false){
		lines.push('（未纳入：本次未勾选「行运触发本命」。）');
	}else{
		lines.push('| 时间 | 行运 | 相位 | 本命 | 误差 |');
		lines.push('| --- | --- | --- | --- | --- |');
		if(!ta.length){ lines.push('| — | — | — | — | — |'); }
		ta.slice(0, CAP).forEach((e)=>lines.push(`| ${e.datetime || '-'} | ${ephName(e.transitBody)} | ${fmtNum(e.aspect, 0)}° | ${ephName(e.natalPoint)} | ${fmtNum(e.orb, 3)} |`));
	}
	const tail = [...ephCurrentMomentLines(chartObj, []), ...ephMethodNoteLines('ephemeris')];
	if(tail.length){ lines.push(''); lines.push(...tail); }
	return lines.join('\n');
}

function addDays(date, days){
	const dt = new Date(date.getTime());
	dt.setDate(dt.getDate() + days);
	return dt;
}

function fmtDate(date){
	const y = date.getFullYear();
	const m = `${date.getMonth() + 1}`.padStart(2, '0');
	const d = `${date.getDate()}`.padStart(2, '0');
	return `${y}-${m}-${d}`;
}

// 后端 date_time_from_jd 形态 {date,time,datetime,jd} → 'YYYY-MM-DD'(缺则 '-')
function fmtDateOf(item){
	return (item && (item.date || (item.datetime ? `${item.datetime}`.split(' ')[0] : ''))) || '-';
}

// [Q-186/T-108 ①] params.limits → 快照/页面共用的截断说明句(无截断返 '')
export function ephemerisLimitsText(params){
	const p = params || null;
	const lim = p && p.limits;
	if(!lim){ return ''; }
	const notes = [];
	if(lim.rangeTruncated){
		notes.push(`区间超过 ${lim.rangeDays} 天上限，有效区间 ${fmtDateOf(p.startDate)} 至 ${fmtDateOf(p.endDate)}（请求至 ${fmtDateOf(lim.requestedEndDate)}）`);
	}
	if(lim.dailyTruncated){ notes.push(`每日位置只列前 ${lim.dailyDays} 天`); }
	if(lim.transitTruncated){ notes.push(`行运触发共 ${lim.transitTotal} 条，按时间先后只列前 ${lim.transitLimit} 条`); }
	return notes.length ? `${notes.join('；')}（缩小日期范围可查看全部）` : '';
}

class AstroEphemeris extends Component{
	constructor(props){
		super(props);
		const now = new Date();
		this.state = {
			startDate: fmtDate(now),
			endDate: fmtDate(addDays(now, 90)),
			includeTransits: DIRECTION_PAGE_SETTINGS.load().ephemerisTransits,   // 上次亲手设的值(没存过 = 勾选)
			loading: false,
			result: null,
			requestKey: '',
			// 受控子页签(原 defaultActiveKey='events'):FreezeSubTab 需要知道哪一页在前台。
			viewTab: 'events',
		};
		this.load = this.load.bind(this);
		this.change = this.change.bind(this);
		this.changeViewTab = this.changeViewTab.bind(this);
	}

	// [Q-106/T-10] AI 导出:星历 tab 导出时响应刷新事件,按页面当前区间/勾选构建快照写回 detail.snapshotText。
	handleSnapshotRefreshRequest(evt){
		if(!evt || !evt.detail || evt.detail.module !== 'ephemeris' || !this.props.value){ return; }
		buildEphemerisSnapshotText(this.props.value, { startDate: this.state.startDate, endDate: this.state.endDate, includeTransits: this.state.includeTransits })
			.then((txt)=>{ evt.detail.snapshotText = txt || ''; }).catch(()=>{});
	}

	componentDidMount(){
		this._mounted = true;
		this.load();
		this._onSnapshotRefresh = (evt)=>this.handleSnapshotRefreshRequest(evt);
		if(typeof window !== 'undefined'){ window.addEventListener('horosa:refresh-module-snapshot', this._onSnapshotRefresh); }
		// [SURF-T2] 食时刻口径为纯全局键(不进 fields/props):抽屉改档不触发本组件任何 React 更新,
		// buildRequestKey 的 didUpdate 比对永远没机会跑 → 监听全局事件补上这跳(load 内有键比对防重复拉)。
		this._onClassicalGlobals = () => { this.componentDidUpdate({}); };
		if(typeof window !== 'undefined'){ window.addEventListener(CLASSICAL_GLOBALS_EVENT, this._onClassicalGlobals); }
	}

	componentWillUnmount(){
		this._mounted = false;
		if(typeof window !== 'undefined' && this._onClassicalGlobals){ window.removeEventListener(CLASSICAL_GLOBALS_EVENT, this._onClassicalGlobals); }
		if(typeof window !== 'undefined' && this._onSnapshotRefresh){ window.removeEventListener('horosa:refresh-module-snapshot', this._onSnapshotRefresh); }
	}

	// [F1 根修] 请求键唯一算法:三处(didUpdate/ensureLoaded/load)必走同一函数——
	// 曾因 load 键尾加了 eclMode 段而另两处没加,默认态两键永不相等 → 无限重取循环。
	buildRequestKey(){
		const eclMode = classicalGlobalValue('eclipseTimeMode') || 'max';
		return chartRequestKey(this.props.value, `ephemeris|${this.state.startDate}|${this.state.endDate}|${this.state.includeTransits ? 1 : 0}|${eclMode === 'max' ? '' : eclMode}`);
	}

	componentDidUpdate(prevProps){
		const key = this.buildRequestKey();
		if(key && key !== this.state.requestKey && !this.state.loading){
			this.load();
		}
	}

	ensureLoaded(){
		const key = this.buildRequestKey();
		if(key && key !== this.state.requestKey && !this.state.loading){
			setTimeout(this.load, 0);
		}
	}

	changeViewTab(key){
		this.setState({ viewTab: key });
	}

	change(key, value){
		if(key === 'includeTransits'){ DIRECTION_PAGE_SETTINGS.save({ ephemerisTransits: !!value }); }   // 起止日期是输入,不落
		this.setState({[key]: value});
	}

	async load(){
		if(this._mounted === false){ return; }   // [SURF-R5g] ensureLoaded 的 setTimeout 在卸载后触发的微窗守卫
		if(!this.props.value){
			return;
		}
		// [WP-2] 食时刻口径(纯全局键,非默认才随请求与缓存键;默认 'max'=食甚零回归)。
		const eclMode = classicalGlobalValue('eclipseTimeMode') || 'max';
		const key = this.buildRequestKey();
		this.setState({loading: true});
		try{
			const data = await request(`${Constants.ServerRoot}/astroextra/ephemeris`, {
				body: JSON.stringify({
					...chartParams(this.props.value),
					startDate: this.state.startDate,
					endDate: this.state.endDate,
					includeTransits: this.state.includeTransits,
					...(eclMode !== 'max' ? { eclipseTimeMode: eclMode } : {}),
				}),
				timeoutMs: 90000,
			});
			if(!this._mounted) return;
			// horosa_panel_ready_v1:星历结果(四个子页签的内容全部同源于 result)落定的那一次 setState。
			this.setState({result: unwrapResult(data) || {}, loading: false, requestKey: key}, ()=>{ markPanelReady('direction'); });
		}catch(e){
			if(!this._mounted) return;
			this.setState({loading: false, requestKey: key});
		}
	}

	// [Q-186/T-108 ①] 后端三道上限(区间 ≤732 天 / 逐日 ≤370 天 / 行运触发 ≤600 条,按时间序截)此前静默;
	// 现由 params.limits 明示:有效区间 + 各截断提示(缩小区间可查看全部)。
	renderLimitsNotice(){
		const text = ephemerisLimitsText(this.state.result && this.state.result.params);
		if(!text){ return null; }
		return (
			<div className="horosa-ephemeris-limits" style={{ fontSize: 12, color: 'var(--horosa-muted, #666)', margin: '0 0 8px 4px' }}>{text}</div>
		);
	}

	renderToolbar(){
		return (
			<div style={{...cardStyle, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center'}}>
				<label>开始 <input type="date" value={this.state.startDate} onChange={(e)=>this.change('startDate', e.target.value)} /></label>
				<label>结束 <input type="date" value={this.state.endDate} onChange={(e)=>this.change('endDate', e.target.value)} /></label>
				<Checkbox checked={this.state.includeTransits} onChange={(e)=>this.change('includeTransits', e.target.checked)}>行运触发本命</Checkbox>
				<Button size="small" onClick={this.load}>刷新星历</Button>
			</div>
		);
	}

	renderEvents(rows, columns){
		return <SmallTable rows={rows || []} columns={columns} />;
	}

	renderDaily(rows){
		const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
		// 逐日行数 = 选定天数。后端逐日上限 370 天(params.limits.dailyTruncated 由 renderLimitsNotice 明示);
		// 本地 1500 行只是 SmallTable 无虚拟化的渲染保险(现口径下不会触发),保留兜底。
		const all = rows || [];
		const MAX_DAILY = 1500;
		const shown = all.length > MAX_DAILY ? all.slice(0, MAX_DAILY) : all;
		return (
			<div>
				<SmallTable
					rows={shown}
					columns={[
						{key: 'date', title: '日期'},
						...planets.map((id)=>({
							key: id,
							title: astroSymbol(id),
							render: (_v, row)=>row.positions && row.positions[id] ? fmtDegree(row.positions[id]) : '-',
						})),
					]}
				/>
				{all.length > shown.length ? (
					<div style={{ fontSize: 12, color: 'var(--horosa-muted, #666)', marginTop: 4 }}>逐日行数过多，已显示前 {shown.length} 行（缩小日期范围以查看全部）。</div>
				) : null}
			</div>
		);
	}

	render(){
		this.ensureLoaded();
		const result = this.state.result || {};
		const height = this.props.height ? this.props.height - 20 : 720;
		const viewTab = this.state.viewTab || 'events';
		return (
			<Spin spinning={this.state.loading}>
				<div style={{height, overflow: 'auto', paddingRight: 8}}>
					{this.renderToolbar()}
					{this.renderLimitsNotice()}
					{/* horosa_freeze_subtabs_v1:四个子页签此前全部常驻渲染 —— 其中「每日位置」最多 1500 行
					    × 8 列的自绘表(SmallTable 无虚拟化),用户就算从没点开也每次重画。改受控 + FreezeSubTab:
					    只画前台那一个,从未激活过的面板延迟首渲。★这里刻意**不做虚拟化**:该表要能被 Ctrl+F
					    页内查找、被打印/截图完整取到,窗口化切片会真降级;延迟+冻结把成本降到零而不动可见语义。
					    ★用**函数式** children:节点式会让 renderEvents/renderDaily 在父组件每次 render 时
					    照样把整棵元素树建出来(1500 行 × 8 列),冻结就白做了;函数式则未渲染时根本不求值。 */}
					<Tabs activeKey={viewTab} onChange={this.changeViewTab} tabPosition="top">
						<TabPane tab="事件" key="events">
							<FreezeSubTab active={viewTab === 'events'}>{() => (<>
							<div style={cardStyle}>
								<div className="horosa-info-card-title">入座</div>
								{this.renderEvents(result.ingresses, [
									{key: 'datetime', title: '时间'},
									{key: 'body', title: '星体', render: (v)=>astroSymbol(v)},
									{key: 'toSign', title: '进入', render: (v)=>astroSymbol(v)},
									{key: 'sign', title: '位置', render: (_v, row)=>fmtDegree(row)},
								])}
							</div>
							<div style={cardStyle}>
								<div className="horosa-info-card-title">留与顺逆转向</div>
								{this.renderEvents(result.stations, [
									{key: 'datetime', title: '时间'},
									{key: 'body', title: '星体', render: (v)=>astroSymbol(v)},
									{key: 'direction', title: '方向'},
									{key: 'sign', title: '位置', render: (_v, row)=>fmtDegree(row)},
								])}
							</div>
							<div style={cardStyle}>
								<div className="horosa-info-card-title">朔望弦</div>
								{this.renderEvents(result.lunarPhases, [
									{key: 'datetime', title: '时间'},
									{key: 'phase', title: '月相'},
									{key: 'sign', title: '月亮位置', render: (_v, row)=>fmtDegree(row)},
								])}
							</div>
							<div style={cardStyle}>
								<div className="horosa-info-card-title">食相</div>
								{this.renderEvents(result.eclipses, [
									{key: 'datetime', title: '时间'},
									{key: 'type', title: '类型'},
									{key: 'eclipseType', title: '细分'},
									{key: 'sign', title: '位置', render: (_v, row)=>fmtDegree(row)},
									{key: 'digit', title: '食分', render: (v, row)=> (v == null ? '—' : <span>{fmtNum(v)}<span style={{opacity: 0.6, fontSize: 11, marginLeft: 4}}>{row.band || ''}</span></span>)},
								])}
							</div>
							</>)}</FreezeSubTab>
						</TabPane>
						<TabPane tab="行运触发" key="transits">
							<FreezeSubTab active={viewTab === 'transits'}>{() => (<>
							<div style={cardStyle}>
								{this.renderEvents(result.transitAspects, [
									{key: 'datetime', title: '时间'},
									{key: 'transitBody', title: '行运', render: (v)=>astroSymbol(v)},
									{key: 'aspect', title: '相位', render: (v)=>`${fmtNum(v, 0)}°`},
									{key: 'natalPoint', title: '本命', render: (v)=>astroSymbol(v)},
									{key: 'orb', title: '误差', render: (v)=>fmtNum(v, 3)},
								])}
							</div>
							</>)}</FreezeSubTab>
						</TabPane>
						<TabPane tab="每日位置" key="daily">
							<FreezeSubTab active={viewTab === 'daily'}>{() => (<>
							<div style={cardStyle}>{this.renderDaily(result.dailyPositions)}</div>
							</>)}</FreezeSubTab>
						</TabPane>
						<TabPane tab="升落现象" key="visibility">
							<FreezeSubTab active={viewTab === 'visibility'}>{() => (<>
							<div style={cardStyle}>
								<div className="horosa-info-card-title">升落与中天</div>
								{this.renderEvents(result.riseSet, [
									{key: 'body', title: '星体', render: (v)=>astroSymbol(v)},
									{key: 'rise', title: '升起', render: (v)=>v && v.datetime ? v.datetime : '-'},
									{key: 'set', title: '落下', render: (v)=>v && v.datetime ? v.datetime : '-'},
									{key: 'upperTransit', title: '上中天', render: (v)=>v && v.datetime ? v.datetime : '-'},
									{key: 'lowerTransit', title: '下中天', render: (v)=>v && v.datetime ? v.datetime : '-'},
								])}
							</div>
							<div style={cardStyle}>
								<div className="horosa-info-card-title">行星现象</div>
								{this.renderEvents(result.phenomena, [
									{key: 'body', title: '星体', render: (v)=>astroSymbol(v)},
									{key: 'phaseAngle', title: '相位角', render: (v)=>fmtNum(v)},
									{key: 'phase', title: '照明', render: (v)=>fmtNum(v)},
									{key: 'elongation', title: '距角', render: (v)=>fmtNum(v)},
									{key: 'magnitude', title: '星等', render: (v)=>fmtNum(v)},
								])}
							</div>
							<div style={cardStyle}>
								<div className="horosa-info-card-title">晨昏偕日</div>
								{this.renderEvents(result.heliacal, [
									{key: 'body', title: '星体', render: (v)=>astroSymbol(v)},
									{key: 'rising', title: '偕日升', render: (v)=>v && v.datetime ? v.datetime : '-'},
									{key: 'setting', title: '偕日落', render: (v)=>v && v.datetime ? v.datetime : '-'},
								])}
							</div>
							</>)}</FreezeSubTab>
						</TabPane>
					</Tabs>
				</div>
			</Spin>
		);
	}
}

export default AstroEphemeris;
