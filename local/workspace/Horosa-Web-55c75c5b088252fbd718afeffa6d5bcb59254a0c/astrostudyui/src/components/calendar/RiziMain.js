import React, { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
import { Tag } from 'antd';
import DateTime from '../comp/DateTime';
import RiziControls from './RiziControls';
import HuangLiDayCard from './HuangLiDayCard';
import { buildHuangliDay } from './huangliDay';
import { personBazi, buildPersonalizedDates } from './riziEngine';
import { buildRiziSnapshotText } from './riziSnapshot';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { markInteractionStart, markPanelReady } from '../../utils/perfMark';
import { calendarPanelShouldUpdate } from './NongLiMain';

const MODULE = 'calendar-rizi';
const ROLE_LABEL = { self: '本人', spouse: '配偶', family: '家人' };
let _pid = 0;
function nextId() { _pid += 1; return `p${_pid}`; }

function reasonTags(reasons) {
	return (reasons || []).map((r, i)=> (
		<Tag key={i} className={`horosa-huangli-tag ${r.t === 'good' ? 'is-good' : (r.t === 'bad' ? 'is-bad' : 'is-neutral')}`}>{r.text}</Tag>
	));
}

// horosa_panel_scu_v1(日子馆拆片)—— 病灶:deferRecompute 先落一次 {computing:true} 让 tab
// 立刻可切,但那一次 setState 会把【榜单全部行】(showAll 时至多 366 行 × 6 段)与【右栏详情】
// (含一次 buildHuangliDay)整个重建一遍,而这两块的内容与 computing 毫无关系。
// 拆成两个 React.memo 子件后,computing / persons 之类不影响可见内容的 state 变化不再穿透:
//   · RiziRankingList 只吃 (list, selectedYmd, onPick) —— 榜单行的输出是这三者的纯函数;
//   · RiziDetail     只吃 (list, selectedYmd)         —— 详情卡的输出是这两者的纯函数。
// list 每次真重算都是新数组引用(buildPersonalizedDates 返回新对象),故「该更新时必更新」;
// onPick 是构造期 bind 的稳定引用。默认浅比较即足,未自定义 areEqual(自定义才容易写错)。
const RiziRankingList = React.memo(function RiziRankingList({ list, selectedYmd, onPick }) {
	return (
		<>
			{list.map((d, i)=> (
				<div key={d.ymd} className={`horosa-rizi-rankrow ${d.ymd === selectedYmd ? 'is-active' : ''}`} onClick={()=> onPick(d.ymd)}>
					<span className={`horosa-rizi-rank-no ${i < 3 ? 'is-medal is-medal-' + (i + 1) : ''}`}>{i + 1}</span>
					<span className='horosa-rizi-rank-date'>{d.ymd}</span>
					<span className='horosa-rizi-rank-week'>周{d.week}</span>
					<span className='horosa-rizi-rank-gz'>{d.ganzhi}</span>
					<Tag className={`horosa-huangli-tag ${d.huangdao === '黄道' ? 'is-good' : 'is-neutral'}`}>{d.jianchu}</Tag>
					<span className={`horosa-rizi-rank-score ${d.score >= 12 ? 'is-hi' : (d.score >= 10 ? 'is-mid' : 'is-lo')}`}>{d.score}分</span>
				</div>
			))}
		</>
	);
});

const RiziDetail = React.memo(function RiziDetail({ list, selectedYmd }) {
	const d = list.find((x)=> x.ymd === selectedYmd);
	if (!d) { return <div className='horosa-empty-hint'>选择吉日查看理由与完整日课</div>; }
	const [y, m, dd] = d.ymd.split('-').map((n)=> parseInt(n, 10));
	return (
		<div className='horosa-rizi-detail'>
			<div className='horosa-tongshu-detail-head'>
				<span className='horosa-tongshu-detail-date'>{d.ymd} {d.lunar}</span>
				<Tag className='horosa-huangli-gz'>{d.ganzhi}日</Tag>
				<Tag className='horosa-huangli-tag is-good'>{d.score}分</Tag>
			</div>
			<div className='horosa-huangli-section'>
				<div className='horosa-huangli-section-title'>为何吉 · 通书</div>
				<div className='horosa-huangli-section-body'><div className='horosa-huangli-tags'>{reasonTags(d.tongshuReasons)}</div></div>
			</div>
			{(d.perPerson || []).map((pp, i)=> (
				<div key={i} className='horosa-huangli-section'>
					<div className='horosa-huangli-section-title'>{ROLE_LABEL[pp.role] || pp.role}{pp.name ? `（${pp.name}）` : ''} · 属{pp.shengxiao} · 得分 {pp.score}</div>
					<div className='horosa-huangli-section-body'>
						<div className='horosa-huangli-tags'>{(pp.reasons || []).length ? reasonTags(pp.reasons) : <span className='horosa-huangli-muted'>本命平和·无冲无扶</span>}</div>
					</div>
				</div>
			))}
			<div className='horosa-huangli-section'>
				<div className='horosa-huangli-section-title'>完整老黄历日课</div>
				<div className='horosa-huangli-section-body'><HuangLiDayCard day={buildHuangliDay(y, m, dd)} /></div>
			</div>
		</div>
	);
});

// 空榜单的稳定空数组:`(result && result.list) || []` 每次造新数组会让 memo 恒失效。
const EMPTY_LIST = [];

class RiziMain extends Component {
	// [R3-A6] 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

	constructor(props) {
		super(props);
		this.state = {
			event: 'marriage',
			year: new DateTime().year || parseInt(new DateTime().format('YYYY'), 10),
			persons: [{ id: 'self', role: 'self', name: '', date: new DateTime(), gender: 1 }],
			result: null,
			selectedYmd: null,
			computing: false,
			showAll: false,
		};
		this._recomputeTimer = null;
		this.toggleShowAll = this.toggleShowAll.bind(this);
		this.onChange = this.onChange.bind(this);
		this.onPersonChange = this.onPersonChange.bind(this);
		this.onAddPerson = this.onAddPerson.bind(this);
		this.onRemovePerson = this.onRemovePerson.bind(this);
		this.recompute = this.recompute.bind(this);
		this.selectRankRow = this.selectRankRow.bind(this);
		this.deferRecompute = this.deferRecompute.bind(this);
		this.saveAISnapshot = this.saveAISnapshot.bind(this);
		this.handleSnapshotRefreshRequest = this.handleSnapshotRefreshRequest.bind(this);
	}

	// 全年扫描（buildPersonalizedDates）冷启约 730ms 同步阻塞主线程 → 首次点日子馆/换年卡死点击。
	// 改：先 setState 显「计算中」令 tab 即时切换、控件即时响应，再于下一宏任务跑重算（防抖：连点只算最后一次）。
	deferRecompute() {
		if (this._recomputeTimer) { clearTimeout(this._recomputeTimer); }
		if (!this.state.computing) { this.setState({ computing: true }); }
		this._recomputeTimer = setTimeout(()=>{
			this._recomputeTimer = null;
			this.recompute();
		}, 16);
	}

	yearOptions() {
		const y0 = this.state.year;
		const opts = [];
		for (let y = y0 - 1; y <= y0 + 3; y++) { opts.push({ value: y, label: `${y} 年` }); }
		return opts;
	}

	// 从 person.date 构造八字（复用本地八字引擎），失败返回 null。
	baziOf(person) {
		try {
			const dt = person.date;
			return personBazi({
				date: dt.format('YYYY-MM-DD'),
				time: dt.format('YYYY-MM-DD HH:mm:ss'),
				gender: person.gender,
			});
		} catch (e) { return null; }
	}

	recompute() {
		const personsWithBazi = this.state.persons.map((p)=> ({ ...p, bazi: this.baziOf(p) }));
		const result = buildPersonalizedDates({ event: this.state.event, persons: personsWithBazi, year: this.state.year, topN: this.state.showAll ? 366 : 20 });
		this.setState({ result, personsWithBazi, computing: false }, ()=>{
			// 选中：保留当前选择（若仍在榜），否则取榜首。
			const list = result.list || [];
			const keep = this.state.selectedYmd && list.some((d)=> d.ymd === this.state.selectedYmd);
			// horosa_panel_ready_v1:榜单(中栏)+ 详情(右栏)在这一步全部落定,是本页最后一次 setState。
			if (!keep) { this.setState({ selectedYmd: list[0] ? list[0].ymd : null }, ()=>{ this.saveAISnapshot(); markPanelReady('calendar'); }); }
			else { this.saveAISnapshot(); markPanelReady('calendar'); }
		});
	}

	onChange(patch) {
		markInteractionStart('calendar');   // horosa_panel_ready_v1 配对起点(改事项/换年)
		this.setState(patch, this.deferRecompute);
	}
	onPersonChange(id, patch) {
		markInteractionStart('calendar');   // horosa_panel_ready_v1 配对起点
		this.setState({ persons: this.state.persons.map((p)=> (p.id === id ? { ...p, ...patch } : p)) }, this.deferRecompute);
	}
	onAddPerson(role) {
		markInteractionStart('calendar');   // horosa_panel_ready_v1 配对起点
		this.setState({ persons: [...this.state.persons, { id: nextId(), role, name: '', date: new DateTime(), gender: role === 'spouse' ? 0 : 1 }] }, this.deferRecompute);
	}
	onRemovePerson(id) {
		markInteractionStart('calendar');   // horosa_panel_ready_v1 配对起点
		this.setState({ persons: this.state.persons.filter((p)=> p.id !== id) }, this.deferRecompute);
	}
	toggleShowAll() {
		markInteractionStart('calendar');   // horosa_panel_ready_v1 配对起点
		this.setState({ showAll: !this.state.showAll }, this.deferRecompute);
	}

	// 榜单行点击：只换选中项（右栏详情重算），中栏榜单数据不变。
	selectRankRow(ymd) {
		markInteractionStart('calendar');   // horosa_panel_ready_v1 配对起点
		this.setState({ selectedYmd: ymd }, ()=>{
			this.saveAISnapshot();
			markPanelReady('calendar');   // horosa_panel_ready_v1:右栏详情落定
		});
	}

	saveAISnapshot() {
		const persons = this.state.personsWithBazi || this.state.persons.map((p)=> ({ ...p, bazi: this.baziOf(p) }));
		const text = `${buildRiziSnapshotText({ event: this.state.event, year: this.state.year, persons, result: this.state.result }) || ''}`.trim();
		if (text) { saveModuleAISnapshot(MODULE, text); }
		return text;
	}

	handleSnapshotRefreshRequest(evt) {
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if (moduleName !== MODULE) { return; }
		const text = this.saveAISnapshot();
		if (text && evt && evt.detail && typeof evt.detail === 'object') { evt.detail.snapshotText = text; }
	}

	componentDidMount() {
		if (typeof window !== 'undefined') { window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest); }
		this.deferRecompute();
	}
	componentWillUnmount() {
		if (typeof window !== 'undefined') { window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest); }
		if (this._recomputeTimer) { clearTimeout(this._recomputeTimer); this._recomputeTimer = null; }
	}

	// horosa_panel_scu_v1:本页【零消费】props.fields —— 渲染只看 state + props.height。
	shouldComponentUpdate(nextProps, nextState) {
		return calendarPanelShouldUpdate(this.props, nextProps, this.state, nextState);
	}

	currentList() {
		const result = this.state.result;
		return (result && result.list) || EMPTY_LIST;
	}

	renderRanking() {
		const result = this.state.result;
		const list = this.currentList();
		if (this.state.computing && !list.length) { return <div className='horosa-empty-hint'>正在计算全年吉日…</div>; }
		if (!list.length) { return <div className='horosa-empty-hint'>请输入当事人生辰，或本年该事项无合适吉日</div>; }
		const total = result.count || list.length;
		return (
			<div className='horosa-rizi-ranking'>
				<div className='horosa-rizi-ranking-head'>
					<span>个性化吉日排行（全年候选 {total}）</span>
					<span className='horosa-rizi-ranking-actions'>
						{this.state.computing ? <span className='horosa-rizi-computing'>计算中…</span> : null}
						{total > 20 ? (
							<span className='horosa-rizi-showall' onClick={this.toggleShowAll}>
								{this.state.showAll ? '仅显示前 20' : `显示全部 ${total}`}
							</span>
						) : null}
					</span>
				</div>
				<RiziRankingList list={list} selectedYmd={this.state.selectedYmd} onPick={this.selectRankRow} />
			</div>
		);
	}

	renderDetail() {
		return <RiziDetail list={this.currentList()} selectedYmd={this.state.selectedYmd} />;
	}

	render() {
		let height = this.props.height ? this.props.height : 760;
		if (height === '100%') { height = '100%'; } else { height = height - 30; }
		return (
			<div className='horosa-tongshu-workbench' style={{ height }}>
				<aside className='horosa-tongshu-left'>
					<RiziControls
						event={this.state.event} year={this.state.year} yearOptions={this.yearOptions()}
						persons={this.state.persons}
						onChange={this.onChange} onPersonChange={this.onPersonChange}
						onAddPerson={this.onAddPerson} onRemovePerson={this.onRemovePerson}
					/>
				</aside>
				<section className='horosa-tongshu-mid'>{this.renderRanking()}</section>
				<aside className='horosa-tongshu-right'>{this.renderDetail()}</aside>
			</div>
		);
	}
}

export default RiziMain;
