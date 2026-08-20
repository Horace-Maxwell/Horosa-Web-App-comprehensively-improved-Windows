import { Component } from 'react';
import { Spin, Checkbox } from 'antd';
import { XQButton as Button, XQTabs as Tabs } from '../xq-ui';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { unwrapResult, astroSymbol, fmtDegree, fmtNum, chartParams, chartRequestKey, cardStyle, SmallTable } from './AstroExtraCommon';
import { classicalGlobalValue, CLASSICAL_GLOBALS_EVENT } from '../../utils/classicalChartGlobals';
import { FreezeSubTab } from '../comp/FreezeInactive';
import { markPanelReady } from '../../utils/perfMark';

const TabPane = Tabs.TabPane;

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

class AstroEphemeris extends Component{
	constructor(props){
		super(props);
		const now = new Date();
		this.state = {
			startDate: fmtDate(now),
			endDate: fmtDate(addDays(now, 90)),
			includeTransits: true,
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

	componentDidMount(){
		this._mounted = true;
		this.load();
		// [SURF-T2] 食时刻口径为纯全局键(不进 fields/props):抽屉改档不触发本组件任何 React 更新,
		// buildRequestKey 的 didUpdate 比对永远没机会跑 → 监听全局事件补上这跳(load 内有键比对防重复拉)。
		this._onClassicalGlobals = () => { this.componentDidUpdate({}); };
		if(typeof window !== 'undefined'){ window.addEventListener(CLASSICAL_GLOBALS_EVENT, this._onClassicalGlobals); }
	}

	componentWillUnmount(){
		this._mounted = false;
		if(typeof window !== 'undefined' && this._onClassicalGlobals){ window.removeEventListener(CLASSICAL_GLOBALS_EVENT, this._onClassicalGlobals); }
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
		// 逐日行数 = 选定天数。上限 1500（~4 年）兼顾 SmallTable 无虚拟化的渲染性能：
		// 常见范围（含 1–2 年）不截断；仅极端长区间触发上限并给提示，杜绝静默丢弃（同波斯向运范式）。
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
