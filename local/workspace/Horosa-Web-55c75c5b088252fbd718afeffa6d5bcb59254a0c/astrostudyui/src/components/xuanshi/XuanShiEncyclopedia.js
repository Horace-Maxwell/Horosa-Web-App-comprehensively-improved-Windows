import React from 'react';
import { Spin, Empty } from 'antd';
import { fetchTechniques, fetchDynasties, fetchCelestialTerms } from '../../services/xuanshi';
import XuanShiStar from './XuanShiStar';

// 词条分类 → 收藏 kind
const CAT_KIND = { techniques: 'technique', dynasties: 'dynasty', terms: 'celestial_term' };

// 词条百科 —— 忠实源 参考词条页 / 天象词条:三类(术数12/朝代22/天象14)切换 + 词条网格 + body_html prose 详情。
// 三端点 list 项已含 body_html,直接渲染(无需额外详情拉取);body 走 .xuanshi-prose 成熟 markdown 排印。
function spanDisp(s, e) {
	if (s == null) { return ''; }
	const f = (y) => (Number(y) < 0 ? `前${-Number(y)}` : `${y}`);
	return `${f(s)}—${f(e)}`;
}
const CATS = [
	{ key: 'techniques', label: '术数词条', fetch: fetchTechniques, sub: (x) => x.category },
	{ key: 'dynasties', label: '朝代词条', fetch: fetchDynasties, sub: (x) => spanDisp(x.span_start, x.span_end) },
	{ key: 'terms', label: '天象词条', fetch: fetchCelestialTerms, sub: (x) => x.alt_names },
];

export default class XuanShiEncyclopedia extends React.Component {
	constructor(props) {
		super(props);
		const f = (props.ui && props.ui.encyclopedia) || {};
		this.state = { cat: f.cat || 'techniques', data: {}, loading: false, err: '', selected: null };
	}

	componentDidMount() {
		// 案头·私藏点开词条 → 切到对应分类 + 自动打开该词条详情
		const oe = this.props.openEncEntry;
		if (oe && oe.cat) { this.setState({ cat: oe.cat }, () => this.load(oe.cat, oe.slug)); }
		else { this.load(this.state.cat); }
	}

	persist() { if (this.props.onPersist) { this.props.onPersist('encyclopedia', { cat: this.state.cat }); } }

	async load(cat, openSlug) {
		const __seq = (this._loadSeq = (this._loadSeq || 0) + 1);   // [Q-496/T-458] 序号守卫
		let list = this.state.data[cat];
		if (!list) {
			this.setState({ loading: true, err: '' });
			try {
				const def = CATS.find((c) => c.key === cat);
				const r = await def.fetch(); if(__seq !== this._loadSeq){ return; }
				list = Array.isArray(r) ? r : (r.items || []);
				this.setState({ data: { ...this.state.data, [cat]: list }, loading: false });
			} catch (e) { this.setState({ loading: false, err: `${e && e.message ? e.message : e}` }); return; }
		}
		if (openSlug && list) {
			const entry = list.find((m) => String(m.slug) === String(openSlug));
			if (entry) { this.setState({ selected: entry }); }
		}
	}

	setCat(cat) { this.setState({ cat, selected: null }, () => { this.load(cat); this.persist(); }); }

	renderDetail(d) {
		return (
			<div style={{ maxWidth: 760 }}>
				<span className="xuanshi-link" onClick={() => this.setState({ selected: null })}>← 返回词条</span>
				<div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0 6px' }}>
					<span className="xuanshi-seal">{(d.name || '·')[0]}</span>
					<h2 className="xuanshi-display is-h2" style={{ flex: 1, minWidth: 0 }}>{d.name}</h2>
					<XuanShiStar item={{ kind: CAT_KIND[this.state.cat] || 'technique', ref: d.slug, title: d.name, subtitle: d.category || '' }} />
				</div>
				<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
					{d.category ? <span className="xuanshi-chip is-vermilion">{d.category}</span> : null}
					{d.span_start != null ? <span className="xuanshi-chip is-gold">{spanDisp(d.span_start, d.span_end)}</span> : null}
					{d.alt_names && d.alt_names !== 'None' ? <span className="xuanshi-chip is-ink">{d.alt_names}</span> : null}
				</div>
				{d.one_liner ? <div className="xuanshi-section-sub" style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{d.one_liner}</div> : null}
				{d.body_html
					? <div className="xuanshi-prose" style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: d.body_html }} />
					: (d.body_md ? <div className="xuanshi-prose" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{d.body_md}</div> : null)}
			</div>
		);
	}

	render() {
		if (this.state.selected) { return this.renderDetail(this.state.selected); }
		const { cat, data, loading, err } = this.state;
		const def = CATS.find((c) => c.key === cat);
		const list = data[cat] || [];
		return (
			<div>
				<div className="xuanshi-eyebrow">词条百科</div>
				<h2 className="xuanshi-display is-h2" style={{ marginTop: 6 }}>术数 · 朝代 · 天象 词条</h2>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '14px 0' }}>
					{CATS.map((c) => <span key={c.key} className={`xuanshi-chip ${cat === c.key ? 'is-vermilion' : 'is-ink'}`} style={{ cursor: 'pointer', fontSize: 13, padding: '3px 14px' }} onClick={() => this.setCat(c.key)}>{c.label}</span>)}
					<span className="xuanshi-stat-sub" style={{ marginLeft: 'auto' }}>{list.length} 条</span>
				</div>
				{loading ? <div className="xuanshi-center"><Spin tip="载入词条…" /></div> : err ? (
					<div className="xuanshi-center"><Empty description={`载入失败:${err}`} /><span className="xuanshi-link" onClick={() => this.load(cat)}>重试</span></div>
				) : !list.length ? <div className="xuanshi-center"><Empty description="无词条" /></div> : (
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
						{list.map((m) => (
							<div className="xuanshi-card is-link" key={m.slug || m.id} onClick={() => this.setState({ selected: m })}>
								<div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
									<span className="xuanshi-seal">{(m.name || '·')[0]}</span>
									<div style={{ flex: 1, minWidth: 0 }}>
										<div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
											<span className="xuanshi-display is-h2" style={{ fontSize: 17 }}>{m.name}</span>
											{def.sub(m) && def.sub(m) !== 'None' ? <span className="xuanshi-chip is-ink">{def.sub(m)}</span> : null}
										</div>
										<div className="xuanshi-stat-sub" style={{ marginTop: 5, fontSize: 12.5, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.one_liner || ''}</div>
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
