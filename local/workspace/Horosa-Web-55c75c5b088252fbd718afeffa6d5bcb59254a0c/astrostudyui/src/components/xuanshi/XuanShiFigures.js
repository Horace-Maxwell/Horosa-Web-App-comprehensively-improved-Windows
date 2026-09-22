import React from 'react';
import { Spin, Empty, Input, Pagination } from 'antd';
import { fetchFigures, fetchFigure } from '../../services/xuanshi';
import XuanShiStar from './XuanShiStar';
import { dynClass } from './xuanshiDynClass';
import { gregYearShort } from './xuanshiDate';   // [Q-491] 公元前年份写法单源

const PAGE_SIZE = 60; // 列传全列 3469,分页防 DOM 过重(保 <1s)

// 其他频道入口(对齐标准版 channel 头部 quick-links → 星阙子页)
const QUICKLINKS = [
	{ label: '今日观象', key: 'overview' },
	{ label: '术数百科', key: 'encyclopedia' },
	{ label: '星象大典', key: 'celestial' },
	{ label: '灵异秘录', key: 'stories' },
	{ label: '朝代游历', key: 'events' },
];

// 人物列传 —— 忠实源 参考人物页:列传网格(印章+生卒+一句话)+ 详情(biography_html 走 prose markdown 渲染 + 关联事件/故事)。
function lifeSpan(b, d) {
	const a = gregYearShort(b), z = gregYearShort(d);   // [Q-491] 与时间轴、详情共用同一个短标函数
	if (!a && !z) { return ''; }
	return `${a || '?'}—${z || '?'}`;
}

function splitList(s) {
	if (!s) { return []; }
	return `${s}`.split(/[;,、，]\s*/).map((x) => x.trim()).filter(Boolean);
}

// 从相关事件聚合 词→计数 降序(B5 同案合作人物/主要术数,客户端聚合,无需后端 deep)
function tallyFrom(events, fields, exclude) {
	const m = {};
	(events || []).forEach((e) => {
		fields.forEach((f) => splitList(e[f]).forEach((w) => {
			if (!w || (exclude && w === exclude)) { return; }
			m[w] = (m[w] || 0) + 1;
		}));
	});
	return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

export default class XuanShiFigures extends React.Component {
	constructor(props) {
		super(props);
		const f = (props.ui && props.ui.figures) || {};
		this.state = {
			dynasty: f.dynasty || '', q: f.q || '', page: f.page || 1,
			items: [], total: 0, dynasties: [], loading: false, err: '',
			selected: null, detailLoading: false,
		};
	}

	componentDidMount() {
		this.load();
		// 从案头·私藏跳入:自动打开该人物详情
		if (this.props.openFigureSlug) { this.openDetail(this.props.openFigureSlug); }
	}

	persist() { if (this.props.onPersist) { this.props.onPersist('figures', { dynasty: this.state.dynasty, q: this.state.q, page: this.state.page }); } }

	async load() {
		const __seq = (this._loadSeq = (this._loadSeq || 0) + 1);   // [Q-496/T-458] 序号守卫:旧响应不覆盖新条件
		this.setState({ loading: true, err: '' });
		try {
			const r = await fetchFigures({ status: 'all', dynasty: this.state.dynasty || undefined, q: this.state.q || undefined, limit: PAGE_SIZE, offset: (this.state.page - 1) * PAGE_SIZE }); if(__seq !== this._loadSeq){ return; }
			this.setState({ items: r.items || r.figures || [], total: r.total || 0, dynasties: r.dynasties || this.state.dynasties, loading: false });
		} catch (e) { this.setState({ loading: false, err: `${e && e.message ? e.message : e}` }); }
		this.persist();
	}

	setFilter(patch) { this.setState({ ...patch, page: 1 }, () => this.load()); }

	async openDetail(slug) {
		this.setState({ detailLoading: true, selected: { slug } });
		try {
			const r = await fetchFigure(slug);
			this.setState({ selected: r.figure ? { ...r.figure, links: r.links, related_events: r.related_events } : r, detailLoading: false });
		} catch (e) { this.setState({ detailLoading: false, selected: { slug, _err: `${e}` } }); }
	}

	renderDetail() {
		const d = this.state.selected;
		if (this.state.detailLoading || (!d.name && !d._err)) { return <div className="xuanshi-center"><Spin tip="载入列传…" /></div>; }
		if (d._err) { return <div className="xuanshi-center"><Empty description={`载入失败:${d._err}`} /></div>; }
		const span = lifeSpan(d.birth_year, d.death_year);
		const rel = d.related_events || [];
		const stories = d.stories || (d.links && d.links.stories) || [];
		// B5 客户端聚合:同案合作人物(同案 operators/consultants 去自身)/ 主要术数(techniques)
		const coPersons = tallyFrom(rel, ['operators', 'consultants', 'targets'], d.name).slice(0, 12);
		const coTechs = tallyFrom(rel, ['techniques'], null).slice(0, 10);
		// 一张相关事件富卡片(对齐标准版 参考人物详情页:四要素 + 史书原文∥白话译文 + 出处)
		const eventCard = (e) => (
			<div className="xuanshi-card" id={`xsf-ev-${e.event_id}`} key={e.event_id} style={{ marginBottom: 14, cursor: 'default' }}>
				<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
					<span className="xuanshi-display is-h2" style={{ fontSize: 16, lineHeight: 1.4 }}>{e.title || e.event_id}</span>
					{e.period ? <span className="xuanshi-chip is-ink">{e.period}</span> : null}
					{e.history ? <span className="xuanshi-chip">《{e.history}》{e.volume_no || e.volume ? `卷${e.volume_no || e.volume}` : ''}</span> : null}
					{e.evidence ? <span className="xuanshi-chip is-gold">证据 · {e.evidence}</span> : null}
					{splitList(e.techniques).slice(0, 2).map((t) => <span className="xuanshi-chip is-jade" key={t}>{t}</span>)}
				</div>
				{(e.operators || e.trigger || e.procedure || e.outcome) ? (
					<dl className="xuanshi-facts">
						{e.operators ? <div><dt>参与</dt><dd>{e.operators}{e.consultants ? ` → ${e.consultants}` : ''}</dd></div> : null}
						{e.trigger ? <div><dt>触发</dt><dd>{e.trigger}</dd></div> : null}
						{e.procedure ? <div className="is-wide"><dt>过程</dt><dd>{e.procedure}</dd></div> : null}
						{e.outcome ? <div className="is-wide"><dt>结果</dt><dd style={{ color: 'var(--ink)' }}>{e.outcome}</dd></div> : null}
					</dl>
				) : null}
				{(e.original_text || e.modern_text) ? (
					<div className="xuanshi-ev-cols">
						<div className="xuanshi-ev-col is-original">
							<div className="xuanshi-ev-col-label">史书原文</div>
							{e.original_text ? <div className="xuanshi-ev-col-body" style={{ fontFamily: 'var(--xs-serif)' }}>{e.original_text}</div> : <div className="xuanshi-stat-sub" style={{ fontStyle: 'italic' }}>原文待整理</div>}
						</div>
						<div className="xuanshi-ev-col is-modern">
							<div className="xuanshi-ev-col-label">白话译文</div>
							{e.modern_text ? <div className="xuanshi-ev-col-body">{e.modern_text}</div> : <div className="xuanshi-stat-sub" style={{ fontStyle: 'italic' }}>译文待补</div>}
						</div>
					</div>
				) : null}
				{e.citation ? <div className="xuanshi-stat-sub" style={{ marginTop: 8, fontSize: 11 }}>出处:{e.citation}</div> : null}
			</div>
		);
		const sideCard = (label, body) => (
			<div className="xuanshi-meta-card">
				<div className="xuanshi-meta-label">{label}</div>
				{body}
			</div>
		);
		return (
			<div>
				{/* 面包屑 */}
				<div className="xuanshi-crumbs">
					<span className="xuanshi-crumb" onClick={() => this.setState({ selected: null })}>人物列传</span>
					<span className="xuanshi-crumb-sep">/</span>
					<span style={{ color: 'var(--ink-soft)' }}>{d.name}</span>
				</div>
				{/* 头部 */}
				<div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, margin: '4px 0 6px' }}>
					<span className="xuanshi-seal is-lg">{(d.name || '·')[0]}</span>
					<div style={{ flex: 1, minWidth: 0 }}>
						<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
							<h2 className="xuanshi-display is-h2" style={{ marginTop: 2 }}>{d.name}</h2>
							<XuanShiStar item={{ kind: 'figure', ref: d.slug, title: d.name, subtitle: d.dynasty || '' }} />
						</div>
						{d.alt_names ? <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 4, fontFamily: 'var(--xs-serif)' }}>{d.alt_names}</div> : (d.pinyin ? <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 4, letterSpacing: '.05em' }}>{d.pinyin}</div> : null)}
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
							{d.dynasty ? <span className={`chip chip-dyn chip-dyn-${dynClass(d.dynasty)}`}>{d.dynasty}</span> : null}
							{span ? <span className="xuanshi-chip is-gold">{span}</span> : null}
							{rel.length ? <span className="xuanshi-chip">参与 {rel.length} 起玄学事件</span> : null}
						</div>
						{d.one_liner ? <div style={{ marginTop: 12, fontSize: 15, color: 'var(--ink)', fontFamily: 'var(--xs-serif)', lineHeight: 1.8, paddingLeft: '0.9rem', borderLeft: '2px solid var(--vermilion)' }}>{d.one_liner}</div> : null}
					</div>
				</div>

				<div className="xuanshi-detail-grid" style={{ marginTop: 16 }}>
					{/* 正文 + 相关事件 */}
					<div style={{ minWidth: 0 }}>
						{d.biography_html
							? <div className="xuanshi-prose" dangerouslySetInnerHTML={{ __html: d.biography_html }} />
							: (d.biography_md ? <div className="xuanshi-prose" style={{ whiteSpace: 'pre-wrap' }}>{d.biography_md}</div> : null)}
						{rel.length ? (
							<div style={{ marginTop: 22 }}>
								<h3 className="xuanshi-display is-h2" style={{ fontSize: 20, marginBottom: 4 }}>相关玄学事件 <span className="xuanshi-stat-sub" style={{ fontSize: 13 }}>共 {rel.length} 起</span></h3>
								<div style={{ marginTop: 12 }}>{rel.map(eventCard)}</div>
							</div>
						) : null}
					</div>

					{/* 右栏 */}
					<aside style={{ minWidth: 0 }}>
						<span className="xuanshi-link" onClick={() => this.setState({ selected: null })}>← 返回列传</span>
						{rel.length ? sideCard(`相关事件目录 (${rel.length})`, (
							<ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 360, overflowY: 'auto' }}>
								{rel.slice(0, 40).map((e) => (
									<li key={e.event_id} style={{ marginBottom: 5 }}>
										<span className="xuanshi-link" style={{ fontSize: 13, lineHeight: 1.4 }} onClick={() => { const el = document.getElementById(`xsf-ev-${e.event_id}`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }}>{e.title || e.event_id}</span>
									</li>
								))}
								{rel.length > 40 ? <li className="xuanshi-stat-sub" style={{ fontSize: 11 }}>…还有 {rel.length - 40} 起</li> : null}
							</ul>
						)) : null}
						{stories.length ? sideCard(`相关故事 (${stories.length})`, (
							<ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
								{stories.map((s, i) => <li key={s.slug || i} style={{ marginBottom: 5, fontSize: 13, color: 'var(--ink-soft)' }}>{s.title || s.name}</li>)}
							</ul>
						)) : null}
						{coPersons.length ? sideCard('同案合作人物', (
							<div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
								{coPersons.map(([name, n]) => <span className="xuanshi-chip is-gold" key={name}>{name} · {n}</span>)}
							</div>
						)) : null}
						{coTechs.length ? sideCard('主要术数', (
							<div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
								{coTechs.map(([name, n]) => <span className="xuanshi-chip is-jade" key={name}>{name} · {n}</span>)}
							</div>
						)) : null}
					</aside>
				</div>
			</div>
		);
	}

	render() {
		if (this.state.selected) { return this.renderDetail(); }
		const { items, total, loading, err, dynasties } = this.state;
		const nav = (k) => { if (this.props.onNav) { this.props.onNav(k); } };
		const dynList = (dynasties || []).map((x) => Array.isArray(x) ? { name: x[0], count: x[1] } : { name: x, count: 0 });
		return (
			<div>
				{/* 面包屑 */}
				<div className="xuanshi-crumbs">
					<span className="xuanshi-crumb" onClick={() => this.props.onHome && this.props.onHome()}>首页</span>
					<span className="xuanshi-crumb-sep">/</span><span>频道</span>
					<span className="xuanshi-crumb-sep">/</span><span>玄学名家</span>
				</div>

				{/* 头部:标题 + 副题 + 描述 + 其他频道入口 */}
				<div className="xuanshi-chan-head">
					<div>
						<div className="xuanshi-eyebrow">频道</div>
						<h1 className="xuanshi-display is-hero" style={{ fontSize: 'clamp(26px,calc(3.4 * var(--horosa-lvw, 1vw)),38px)', marginTop: 6 }}>玄学名家</h1>
						<div className="xuanshi-display" style={{ fontSize: 18, marginTop: 8, color: 'var(--ink)' }}>千年术士、方士、相师列传</div>
						<div className="xuanshi-section-sub" style={{ margin: '8px 0 0' }}>李淳风、袁天纲、林灵素、桑道茂、陶仲文…… 历代玄学人物的故事与影响。</div>
					</div>
					<div className="xuanshi-quicklinks">
						{QUICKLINKS.map((l) => (
							<span key={l.key} className="xuanshi-quicklink" onClick={() => nav(l.key)}>{l.label}</span>
						))}
					</div>
				</div>

				{/* 搜索条 + 计数 */}
				<div className="xuanshi-chan-search">
					<Input.Search placeholder="搜索人物姓名 / 别名 / 拼音…" allowClear enterButton="搜索" size="middle" style={{ flex: 1, minWidth: 220, maxWidth: 480 }}
						defaultValue={this.state.q} key={`fq-${this.state.dynasty}`} onSearch={(v) => this.setFilter({ q: v })} />
					<span className="xuanshi-stat-sub" style={{ marginLeft: 'auto', fontSize: 12.5 }}>共 <b style={{ color: 'var(--ink)' }}>{(total || items.length).toLocaleString()}</b> 位人物</span>
				</div>

				{/* 朝代 chips */}
				{dynList.length ? (
					<div className="xuanshi-facet-chips" style={{ margin: '14px 0 18px' }}>
						{/* [Q-490] 「全部」的计数要与同行其余 chip 同口径(全库分布),不能用带 朝代+搜索词 条件的 total ——
						    选「唐」后这里会变成 420、搜「李」后又变一个数,看起来像「全库只剩这些人」。当前结果数在上面
						    「共 N 位人物」那行,两处各司其职。 */}
						<span className={`chip${!this.state.dynasty ? ' chip-vermilion' : ''}`} style={{ cursor: 'pointer' }} onClick={() => this.setFilter({ dynasty: '' })}>全部 · {dynList.reduce((n, d) => n + (Number(d.count) || 0), 0).toLocaleString()}</span>
						{dynList.map((d) => (
							<span key={d.name} className={this.state.dynasty === d.name ? 'chip chip-vermilion' : `chip chip-dyn chip-dyn-${dynClass(d.name)}`} style={{ cursor: 'pointer' }} onClick={() => this.setFilter({ dynasty: d.name })}>{d.name} · {d.count}</span>
						))}
					</div>
				) : null}

				{loading ? <div className="xuanshi-center"><Spin tip="载入…" /></div> : err ? (
					<div className="xuanshi-center"><Empty description={`载入失败:${err}`} /><span className="xuanshi-link" onClick={() => this.load()}>重试</span></div>
				) : !items.length ? <div className="xuanshi-center"><Empty description="没有符合条件的人物" /></div> : (
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))', gap: 14 }}>
						{items.map((m) => {
							const nm = m.name || '·';
							const sealFont = nm.length >= 4 ? 13 : (nm.length === 3 ? 16 : 20);
							// [Q-491] 卡片此前直拼原值,公元前年份带负号(老子「-571—-471」),与详情页的「前571—前471」两套写法
							const sheng = lifeSpan(m.birth_year, m.death_year);
							return (
								<div className="xuanshi-card is-link" key={m.slug || m.id} onClick={() => this.openDetail(m.slug)}>
									<div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
										<span className="xuanshi-fig-seal" style={{ fontSize: sealFont }}>{nm}</span>
										<div style={{ flex: 1, minWidth: 0 }}>
											<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
												{m.dynasty ? <span className={`chip chip-dyn chip-dyn-${dynClass(m.dynasty)}`}>{m.dynasty}</span> : null}
												{sheng ? <span className="xuanshi-chip" style={{ fontVariantNumeric: 'tabular-nums' }}>{sheng}</span> : null}
												{m.status === 'published' ? <span className="xuanshi-chip is-gold" title="精撰词条">★</span> : null}
											</div>
											<div className="xuanshi-display is-h2" style={{ fontSize: 17, marginTop: 5 }}>{nm}</div>
											{m.alt_names && m.alt_names !== 'None' ? <div className="xuanshi-stat-sub" style={{ fontSize: 11, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.alt_names}</div> : null}
										</div>
									</div>
									{m.one_liner ? <div className="xuanshi-stat-sub" style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.65, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.one_liner}</div> : null}
								</div>
							);
						})}
					</div>
				)}
				{total > PAGE_SIZE ? (
					<div style={{ marginTop: 18, textAlign: 'center' }}>
						<Pagination simple current={this.state.page} total={total} pageSize={PAGE_SIZE} showSizeChanger={false} onChange={(p) => this.setState({ page: p, selected: null }, () => this.load())} />
					</div>
				) : null}
			</div>
		);
	}
}
