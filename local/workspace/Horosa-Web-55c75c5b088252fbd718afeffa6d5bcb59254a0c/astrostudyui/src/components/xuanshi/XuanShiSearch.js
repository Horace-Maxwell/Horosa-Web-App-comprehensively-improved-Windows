import React from 'react';
import { celestialDateWithCalendar } from './xuanshiDate';   // [Q-495/T-457] 天象副标题按来源标历法
import { Spin, Empty, Input } from 'antd';
import { fetchEvents, fetchSearch, fetchCelestial, fetchFigures, fetchStories, fetchTechniques, fetchDynasties, fetchCelestialTerms } from '../../services/xuanshi';

// 统一搜索 / 多维检索结果 —— 承接首页「检索」faceted 面板(ui.search 带 传统/朝代/术数/史书/证据 + q)。
// 玄学事件走 faceted fetchEvents(后端 filter_events 多维),其余来源(天象/人物/故事/术数·朝代·天象词条)按关键词补齐。
// 顶部展示「已选」可移除 facet 标签 + 关键词框,保证库里任何内容都搜得到、且与首页勾选一致。
const arr = (r) => (Array.isArray(r) ? r : ((r && r.items) || []));
const EMPTY_SEL = () => ({ dynasty: [], technique: [], history: [], evidence: '' });
// [Q-493/T-455] 组的「命中数」与「本页显示数」:命中数优先用后端 total(天象/人物/事件都回了),
// 没有 total 的前端过滤组(故事/词条三类)才回落到条目数;显示数=卡片实际画出的条数。
const GROUP_SHOW_MAX = (key) => (key === 'events' ? 24 : 12);
const groupHit = (g) => (Number.isFinite(Number(g && g.total)) ? Number(g.total) : ((g && g.items) || []).length);
const groupShown = (g) => Math.min(((g && g.items) || []).length, GROUP_SHOW_MAX(g && g.key));

export default class XuanShiSearch extends React.Component {
	constructor(props) {
		super(props);
		const f = (props.ui && props.ui.search) || {};
		this.state = {
			q: f.q || '',
			tradition: f.tradition || '',
			sel: {
				dynasty: Array.isArray(f.dynasty) ? f.dynasty.slice() : [],
				technique: Array.isArray(f.technique) ? f.technique.slice() : [],
				history: Array.isArray(f.history) ? f.history.slice() : [],
				evidence: f.evidence || '',
			},
			groups: null, eventsTotal: 0, loading: false, err: '', refs: null,
		};
	}

	async componentDidMount() {
		await this.loadRefs();
		if (this.isActive()) { this.run(); }
	}

	isActive() {
		const { q, tradition, sel } = this.state;
		return !!((q && q.trim()) || tradition || sel.dynasty.length || sel.technique.length || sel.history.length || sel.evidence);
	}

	async loadRefs() {
		try {
			const [t, d, c, s] = await Promise.all([
				fetchTechniques().catch(() => []), fetchDynasties().catch(() => []),
				fetchCelestialTerms().catch(() => []), fetchStories({}).catch(() => []),
			]);
			this.setState({ refs: { techniques: arr(t), dynasties: arr(d), terms: arr(c), stories: arr(s) } });
		} catch (e) { this.setState({ refs: { techniques: [], dynasties: [], terms: [], stories: [] } }); }
	}

	persist() {
		if (this.props.onPersist) {
			const { q, tradition, sel } = this.state;
			this.props.onPersist('search', { q, tradition, dynasty: sel.dynasty, technique: sel.technique, history: sel.history, evidence: sel.evidence });
		}
	}

	async run() {
		if (!this.isActive()) { this.setState({ groups: null }); this.persist(); return; }
		this.setState({ loading: true, err: '' });
		const { q, tradition, sel } = this.state;
		const ql = (q || '').trim();
		try {
			const [evRes, cel, fig] = await Promise.all([
				fetchEvents({
					tradition: tradition || undefined,
					dynasties: sel.dynasty.length ? sel.dynasty : undefined,
					techniques: sel.technique.length ? sel.technique : undefined,
					histories: sel.history.length ? sel.history : undefined,
					evidence: sel.evidence || undefined,
					q: ql || undefined,
					page: 1, page_size: 40,
				}).catch(() => ({})),
				ql ? fetchCelestial({ q: ql, page_size: 20 }).catch(() => ({})) : Promise.resolve({}),
				ql ? fetchFigures({ status: 'all', q: ql, limit: 24 }).catch(() => ({})) : Promise.resolve({}),
			]);
			const refs = this.state.refs || { techniques: [], dynasties: [], terms: [], stories: [] };
			const qll = ql.toLowerCase();
			const filt = (a) => (!qll ? [] : (a || []).filter((x) => `${x.name || ''}${x.one_liner || ''}${x.alt_names || ''}${x.title || ''}`.toLowerCase().includes(qll)));
			const evItems = arr(evRes);
			const groups = [
				{ key: 'events', label: '玄学事件', total: (evRes && evRes.total) || evItems.length, items: evItems.map((x) => ({ id: x.event_id, title: x.title, sub: `${x.tradition || ''}${x.dynasty ? ' · ' + x.dynasty : ''}${x.history ? ' · 《' + x.history + '》' : ''}`, snip: x.modern_text || x.original_text, chips: [x.techniques ? `${x.techniques}`.split(/[;,、，]/)[0] : '', x.evidence === '高' ? '高证据' : ''].filter(Boolean) })) },
				// [Q-493/T-455] 天象只取 20 条、人物只取 24 条:组标题与汇总行此前写的是「取回条数」,
				// 被读成命中数(q=流星 实际命中 12071,标题却写 20)。两端本就回了 total,这里接上。
				{ key: 'celestial', label: '天象', total: (cel && Number.isFinite(Number(cel.total))) ? Number(cel.total) : undefined, items: ((cel && cel.events) || []).map((x) => ({ title: `${x.omen || '天象'} · ${x.dynasty || ''}`, sub: celestialDateWithCalendar(x) || '', snip: x.original })) },
				{ key: 'figures', label: '人物列传', total: (fig && Number.isFinite(Number(fig.total))) ? Number(fig.total) : undefined, items: ((fig && fig.items) || []).map((x) => ({ title: x.name, sub: x.dynasty || '', snip: x.one_liner })) },
				{ key: 'stories', label: '故事专题', items: filt(refs.stories).map((x) => ({ title: x.title || x.name, sub: '', snip: x.one_liner || x.summary })) },
				{ key: 'tech', label: '术数词条', items: filt(refs.techniques).map((x) => ({ title: x.name, sub: x.category || '', snip: x.one_liner })) },
				{ key: 'dyn', label: '朝代词条', items: filt(refs.dynasties).map((x) => ({ title: x.name, sub: '', snip: x.one_liner })) },
				{ key: 'terms', label: '天象词条', items: filt(refs.terms).map((x) => ({ title: x.name, sub: x.alt_names && x.alt_names !== 'None' ? x.alt_names : '', snip: x.one_liner })) },
			].filter((g) => g.items.length);
			this.setState({ groups, loading: false });
			this.persist();
		} catch (e) { this.setState({ loading: false, err: `${e && e.message ? e.message : e}` }); }
	}

	setKeyword(v) { this.setState({ q: v }, () => this.run()); }

	removeFacet(dim, val) {
		if (dim === 'tradition') { this.setState({ tradition: '' }, () => this.run()); return; }
		if (dim === 'evidence') { this.setState({ sel: { ...this.state.sel, evidence: '' } }, () => this.run()); return; }
		const arrv = this.state.sel[dim].filter((x) => x !== val);
		this.setState({ sel: { ...this.state.sel, [dim]: arrv } }, () => this.run());
	}

	clearAll() { this.setState({ q: '', tradition: '', sel: EMPTY_SEL(), groups: null }, () => this.persist()); }

	// 已选 facet 标签(可移除)
	renderPills() {
		const { tradition, sel } = this.state;
		const pills = [];
		if (tradition) { pills.push({ dim: 'tradition', val: tradition, label: `传统 · ${tradition}` }); }
		sel.dynasty.forEach((v) => pills.push({ dim: 'dynasty', val: v, label: `朝代 · ${v}` }));
		sel.technique.forEach((v) => pills.push({ dim: 'technique', val: v, label: `术数 · ${v}` }));
		sel.history.forEach((v) => pills.push({ dim: 'history', val: v, label: `典籍 · 《${v}》` }));
		if (sel.evidence) { pills.push({ dim: 'evidence', val: sel.evidence, label: `证据 · ${sel.evidence}` }); }
		if (!pills.length) { return null; }
		return (
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center', margin: '10px 0 4px' }}>
				<span className="xuanshi-stat-sub" style={{ marginRight: 2 }}>已选</span>
				{pills.map((p) => (
					<span key={p.dim + p.val} className="xuanshi-chip is-vermilion" style={{ cursor: 'pointer' }} onClick={() => this.removeFacet(p.dim, p.val)} title="移除">
						{p.label} <span style={{ opacity: 0.7, marginLeft: 2 }}>×</span>
					</span>
				))}
				<span className="xuanshi-link" style={{ fontSize: 12 }} onClick={() => this.clearAll()}>清空所有</span>
			</div>
		);
	}

	render() {
		const { q, groups, loading, err } = this.state;
		const evGroup = groups && groups.find((g) => g.key === 'events');
		const total = groups ? groups.reduce((n, g) => n + g.items.length, 0) : 0;
		return (
			<div>
				<div className="xuanshi-crumbs">
					<span className="xuanshi-crumb" onClick={() => this.props.onHome && this.props.onHome()}>首页</span>
					<span className="xuanshi-crumb-sep">/</span>
					<span>检索结果</span>
				</div>
				<div className="xuanshi-eyebrow">统一检索</div>
				<h2 className="xuanshi-display is-h2" style={{ marginTop: 6 }}>事件 / 天象 / 人物 / 词条 全库检索</h2>
				<div style={{ margin: '14px 0' }}>
					<Input.Search placeholder="再叠加关键词:人名 / 朝代 / 术法 / 天象 / 原文" allowClear enterButton size="large" style={{ maxWidth: 560 }} defaultValue={q} onSearch={(v) => this.setKeyword(v)} />
				</div>
				{this.renderPills()}
				{loading ? <div className="xuanshi-center"><Spin tip="检索中…" /></div> : err ? (
					<div className="xuanshi-center"><Empty description={`检索失败:${err}`} /></div>
				) : !groups ? (
					<div className="xuanshi-hint">从首页「检索」勾选 传统 / 朝代 / 术数 / 史书 / 证据，或在此输入关键词 —— 跨「玄学事件 / 天象 / 人物列传 / 故事 / 词条」全库检索。</div>
				) : !total ? (
					<div className="xuanshi-center"><Empty description="无匹配,试试放宽条件或换关键词" /></div>
				) : (
					<div>
						<div className="xuanshi-section-sub" style={{ marginTop: 6 }}>
							共 {evGroup ? (evGroup.total || evGroup.items.length).toLocaleString() : 0} 条玄学事件
							{groups.filter((g) => g.key !== 'events').map((g) => ` · ${groupHit(g).toLocaleString()} ${g.label}`).join('')}
						</div>
						{groups.map((g) => (
							<div key={g.key} style={{ marginBottom: 24 }}>
								{/* [Q-493/T-455] 标题=命中数;取回/显示不足时补「列前 N」,不再拿取回条数冒充命中数 */}
								<div className="xuanshi-stat-label" style={{ textAlign: 'left', marginBottom: 8 }}>{g.label}（{groupHit(g).toLocaleString()}{groupHit(g) > groupShown(g) ? `,列前 ${groupShown(g)}` : ''}）</div>
								<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
									{g.items.slice(0, GROUP_SHOW_MAX(g.key)).map((it, i) => (
										<div className={`xuanshi-card${it.id ? ' is-link' : ''}`} key={it.id || i} onClick={() => { if (it.id && this.props.onOpenEvent) { this.props.onOpenEvent(it.id); } }}>
											<div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
												<span className="xuanshi-display is-h2" style={{ fontSize: 15 }}>{it.title}</span>
												{it.sub ? <span className="xuanshi-chip is-ink">{it.sub}</span> : null}
												{(it.chips || []).map((c) => <span key={c} className="xuanshi-chip is-jade">{c}</span>)}
											</div>
											{it.snip ? <div className="xuanshi-stat-sub" style={{ fontSize: 12, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{it.snip}</div> : null}
										</div>
									))}
								</div>
								{g.key === 'events' && (g.total || 0) > 24 ? <div className="xuanshi-stat-sub" style={{ marginTop: 6 }}>…共 {g.total.toLocaleString()} 条,显示前 24</div> : null}
							</div>
						))}
					</div>
				)}
			</div>
		);
	}
}
