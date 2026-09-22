import React from 'react';
import { Spin, Empty, Select, Input } from 'antd';
import { marked } from 'marked';
import { fetchStories, fetchStory } from '../../services/xuanshi';
import XuanShiStar from './XuanShiStar';

// 故事专题 —— 编辑层 story(已发布 30 篇):专题故事卡(封面字符+标题+摘要+朝代/难度/时长)
// + 详情(body_html 走 prose 成熟 markdown 渲染 + 右栏「专题档案」:频道/朝代/时期/难度/阅读/出处/标签)。
// 后端 stories 返回数组、story 返回单 dict(含 sources/tags);q 走 search_text。
const LIMIT = 200; // 30 篇全取,无需分页

export default class XuanShiStories extends React.Component {
	constructor(props) {
		super(props);
		const f = (props.ui && props.ui.stories) || {};
		this.state = {
			dynasty: f.dynasty || '', q: f.q || '',
			items: [], dynasties: [], loading: false, err: '',
			selected: null, detailLoading: false,
		};
	}

	componentDidMount() { this.load(); this.loadDynastyOptions(); if (this.props.openStorySlug) { this.openDetail(this.props.openStorySlug); } }

	persist() { if (this.props.onPersist) { this.props.onPersist('stories', { dynasty: this.state.dynasty, q: this.state.q, page: 1 }); } }

	async load() {
		const __seq = (this._loadSeq = (this._loadSeq || 0) + 1);   // [Q-496/T-458] 序号守卫:旧响应不覆盖新条件
		this.setState({ loading: true, err: '' });
		try {
			const r = await fetchStories({ status: 'published', dynasty: this.state.dynasty || undefined, q: this.state.q || undefined, limit: LIMIT, offset: 0 }); if(__seq !== this._loadSeq){ return; }
			const items = Array.isArray(r) ? r : (r.items || r.stories || []);
			// [Q-492/T-454] 朝代选项**不再**从当前结果回写:选中某朝代后结果里只剩这一朝,
			// 下拉就只剩这一项(换朝代必须先清空;持久化了朝代再进页首屏同样只有一项)。
			// 这里只做并集补全,完整值域另由 loadDynastyOptions() 的无筛选取数提供。
			const dyn = [...new Set([...(this.state.dynasties || []), ...items.map((s) => s.dynasty).filter(Boolean)])];
			this.setState({ items, dynasties: dyn.length ? dyn : this.state.dynasties, loading: false });
		} catch (e) { this.setState({ loading: false, err: `${e && e.message ? e.message : e}` }); }
		this.persist();
	}

	// [Q-492/T-454] 朝代选项的单一来源:一次无筛选取数(已发布全量 ≤LIMIT),与当前筛选无关。
	async loadDynastyOptions() {
		const __seq = (this._loadSeq = (this._loadSeq || 0) + 1);   // [Q-496/T-458] 序号守卫:旧响应不覆盖新条件
		try {
			const r = await fetchStories({ status: 'published', limit: LIMIT, offset: 0 }); if(__seq !== this._loadSeq){ return; }
			const items = Array.isArray(r) ? r : (r.items || r.stories || []);
			const dyn = [...new Set(items.map((s) => s.dynasty).filter(Boolean))];
			if (dyn.length) { this.setState({ dynasties: dyn }); }
		} catch (e) { /* 选项取不到不影响正文列表 */ }
	}

	setFilter(patch) { this.setState({ ...patch }, () => this.load()); }

	async openDetail(slug) {
		this.setState({ detailLoading: true, selected: { slug } });
		try {
			const r = await fetchStory(slug);
			const story = (r && r.story) ? r.story : r;
			this.setState({ selected: story && story.title ? story : { slug, _err: '故事不存在' }, detailLoading: false });
		} catch (e) { this.setState({ detailLoading: false, selected: { slug, _err: `${e}` } }); }
	}

	renderDetail() {
		const d = this.state.selected;
		if (this.state.detailLoading || (!d.title && !d._err)) { return <div className="xuanshi-center"><Spin tip="载入故事…" /></div>; }
		if (d._err) { return <div className="xuanshi-center"><Empty description={`载入失败:${d._err}`} /></div>; }
		const sources = d.sources || [];
		const tags = d.tags || [];
		const facts = (label, val) => (val && String(val).trim() ? (
			<div style={{ marginBottom: 11 }}>
				<div className="xuanshi-stat-label" style={{ textAlign: 'left', fontSize: 11 }}>{label}</div>
				<div style={{ marginTop: 2, fontSize: 12.5, lineHeight: 1.65, color: 'var(--ink-soft)' }}>{val}</div>
			</div>
		) : null);
		const html = d.body_html || (d.body_md ? marked.parse(String(d.body_md), { gfm: true, breaks: true }) : '');
		const hasAside = d.channel_name || d.dynasty || d.period_label || d.difficulty || d.reading_minutes || sources.length || tags.length;
		return (
			<div>
				<span className="xuanshi-link" onClick={() => this.setState({ selected: null })}>← 返回专题</span>
				<div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, margin: '14px 0 6px' }}>
					<span className="xuanshi-seal is-lg" style={d.accent_color ? { background: d.accent_color } : undefined}>{d.cover_icon || (d.title || '·')[0]}</span>
					<div style={{ flex: 1, minWidth: 0 }}>
						<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
							<h2 className="xuanshi-display is-h2" style={{ marginTop: 2 }}>{d.title}</h2>
							<XuanShiStar item={{ kind: 'story', ref: d.slug, title: d.title, subtitle: d.dynasty || d.period_label || '' }} />
						</div>
						{d.subtitle ? <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 4 }}>{d.subtitle}</div> : null}
					</div>
				</div>
				{d.summary ? <div className="xuanshi-section-sub" style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{d.summary}</div> : null}
				<div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 10 }}>
					<div style={{ flex: '1 1 440px', minWidth: 0, maxWidth: 760 }}>
						{html ? <div className="xuanshi-prose" dangerouslySetInnerHTML={{ __html: html }} /> : <Empty description="暂无正文" />}
					</div>
					{hasAside ? (
						<aside className="xuanshi-card" style={{ flex: '0 0 232px', alignSelf: 'flex-start' }}>
							<div className="xuanshi-stat-label" style={{ textAlign: 'left', marginBottom: 12, color: 'var(--vermilion)', letterSpacing: '.1em' }}>专题档案</div>
							{facts('频道', d.channel_name)}
							{facts('朝代', d.dynasty)}
							{facts('时期', d.period_label)}
							{facts('难度', d.difficulty)}
							{facts('阅读', d.reading_minutes ? `约 ${d.reading_minutes} 分钟` : '')}
							{sources.length ? (
								<div style={{ marginBottom: 11 }}>
									<div className="xuanshi-stat-label" style={{ textAlign: 'left', fontSize: 11 }}>出处({sources.length})</div>
									<div style={{ marginTop: 4 }}>{sources.map((s, i) => <div key={i} style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{s.label || s.citation || s.title || s.ref || s.source || ''}</div>)}</div>
								</div>
							) : null}
							{tags.length ? (
								<div>
									<div className="xuanshi-stat-label" style={{ textAlign: 'left', fontSize: 11 }}>标签</div>
									<div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>{tags.map((t, i) => <span className="xuanshi-chip is-jade" key={i}>{t.name || t.label || t.slug || ''}</span>)}</div>
								</div>
							) : null}
						</aside>
					) : null}
				</div>
			</div>
		);
	}

	render() {
		if (this.state.selected) { return this.renderDetail(); }
		const { items, loading, err, dynasties } = this.state;
		return (
			<div>
				<div className="xuanshi-eyebrow">故事专题</div>
				<h2 className="xuanshi-display is-h2" style={{ marginTop: 6 }}>玄学史话 · 专题</h2>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', margin: '16px 0 14px' }}>
					<Select allowClear showSearch placeholder="朝代" size="small" style={{ minWidth: 140 }} value={this.state.dynasty || undefined}
						options={(dynasties || []).map((x) => (Array.isArray(x) ? { value: x[0], label: `${x[0]} (${x[1]})` } : { value: x, label: x }))}
						onChange={(v) => this.setFilter({ dynasty: v || '' })} filterOption={(i, o) => (o.label || '').indexOf(i) >= 0} />
					<Input.Search placeholder="标题 / 关键词" allowClear size="small" style={{ width: 220 }} defaultValue={this.state.q} onSearch={(v) => this.setFilter({ q: v })} />
					<span className="xuanshi-stat-sub" style={{ marginLeft: 'auto' }}>{items.length} 篇专题</span>
				</div>
				{loading ? <div className="xuanshi-center"><Spin tip="载入…" /></div> : err ? (
					<div className="xuanshi-center"><Empty description={`载入失败:${err}`} /><span className="xuanshi-link" onClick={() => this.load()}>重试</span></div>
				) : !items.length ? <div className="xuanshi-center"><Empty description="暂无故事专题" /></div> : (
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
						{items.map((m) => (
							<div className="xuanshi-card is-link" key={m.slug || m.id} onClick={() => this.openDetail(m.slug)}>
								<div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
									<span className="xuanshi-seal" style={m.accent_color ? { background: m.accent_color } : undefined}>{m.cover_icon || (m.title || '·')[0]}</span>
									<div style={{ flex: 1, minWidth: 0 }}>
										<div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
											<span className="xuanshi-display is-h2" style={{ fontSize: 17 }}>{m.title}</span>
											{m.dynasty ? <span className="xuanshi-chip is-ink">{m.dynasty}</span> : null}
											{m.difficulty ? <span className="xuanshi-chip is-gold">{m.difficulty}</span> : null}
										</div>
										<div className="xuanshi-stat-sub" style={{ marginTop: 5, fontSize: 12.5, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
											{m.summary || m.subtitle || ''}
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		);
	}
}
