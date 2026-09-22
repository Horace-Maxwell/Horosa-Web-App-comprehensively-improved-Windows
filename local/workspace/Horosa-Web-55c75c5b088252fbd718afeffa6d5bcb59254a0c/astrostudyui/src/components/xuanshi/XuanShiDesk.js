import React from 'react';
import { fetchDaily } from '../../services/xuanshi';
import { listBookmarks, removeBookmark, subscribeBookmarks } from './xuanshiBookmarks';
import { safeJsonParseFromStorage, safeJsonStringifyToStorage, safeLocalStorageRemove } from '../../utils/safeStorage';

// 案头(我的)—— 对齐标准版 参考案头页:今日精选 + 私藏(收藏)+ 近探(搜索历史)+ 门径(快捷入口)+ 小贴士。
// 私藏走 xuanshiBookmarks(localStorage,各详情页 ☆ 写入)、近探走 localStorage 搜索历史。
const HIST_KEY = 'horosa.xuanshi.history.v1';
const KIND_LABEL = { story: '故事', figure: '人物', technique: '术数', celestial_term: '天象', celestial: '天象事件', dynasty: '朝代', artifact: '研究', corpus: '原文', event: '事件' };

function readJSON(key) {
	const v = safeJsonParseFromStorage(key);
	return Array.isArray(v) ? v : [];
}

// 供搜索页调用:把一次检索写入近探历史(去重 + 限 20 条;走 safeStorage,跨重启持久、配额满不丢)
// [Q-494/T-456] 近探历史此前只存关键词,重放时又写死「正史」并清空四维 →
// 野载或带维度的那次检索回不去(切「野载」+「狐」再点近探,出来的是正史结果)。
// 现连同那次检索的完整选择(传统 + 朝代/术数/史书/证据)一起存;旧条目没有 sel,重放时按老口径兜底。
export function pushSearchHistory(q, sel) {
	if (!q || !`${q}`.trim()) { return; }
	const list = readJSON(HIST_KEY).filter((h) => h && h.q !== q);
	const entry = { q: `${q}`.trim(), ts: Date.now() };
	if (sel && typeof sel === 'object') {
		entry.sel = {
			tradition: sel.tradition || '',
			q: `${q}`.trim(),
			dynasty: Array.isArray(sel.dynasty) ? sel.dynasty : [],
			technique: Array.isArray(sel.technique) ? sel.technique : [],
			history: Array.isArray(sel.history) ? sel.history : [],
			evidence: sel.evidence || '',
		};
	}
	list.unshift(entry);
	safeJsonStringifyToStorage(HIST_KEY, list.slice(0, 20));
}

// 近探行的副标:让人一眼看出这条是不是带维度/野载(否则点下去结果不同会以为坏了)。
export function searchHistoryFacetHint(h) {
	const sel = h && h.sel;
	if (!sel) { return ''; }
	const parts = [];
	if (sel.tradition && sel.tradition !== '正史') { parts.push(sel.tradition); }
	const dims = ['dynasty', 'technique', 'history'].reduce((n, k) => n + ((sel[k] || []).length), 0) + (sel.evidence ? 1 : 0);
	if (dims) { parts.push(`${dims} 维`); }
	return parts.join(' · ');
}

const QUICKLINKS = [
	{ label: '今日', key: 'overview' },
	{ label: '玄学万象', key: 'events' },
	{ label: '名家', key: 'figures' },
	{ label: '术数', key: 'encyclopedia' },
	{ label: '探索', key: 'search' },
];

export default class XuanShiDesk extends React.Component {
	constructor(props) {
		super(props);
		this.state = { bookmarks: listBookmarks(), history: readJSON(HIST_KEY), daily: null, filter: 'all' };
	}

	componentDidMount() {
		this._unsub = subscribeBookmarks(() => this.setState({ bookmarks: listBookmarks() }));
		fetchDaily().then((d) => { if (d && !d.err && (d.title || d.blurb)) { this.setState({ daily: d }); } }).catch(() => {});
	}

	componentWillUnmount() { if (this._unsub) { this._unsub(); } }

	openBookmark(b) { if (this.props.onOpen) { this.props.onOpen(b.kind, b.ref); } }
	removeBM(e, b) { if (e) { e.stopPropagation(); } removeBookmark(b.kind, b.ref); }

	clearHistory() {
		safeLocalStorageRemove(HIST_KEY);
		this.setState({ history: [] });
	}

	nav(k) { if (this.props.onNav) { this.props.onNav(k); } }

	render() {
		const { bookmarks, history, daily, filter } = this.state;
		// 收藏分类计数
		const counts = {};
		bookmarks.forEach((b) => { counts[b.kind] = (counts[b.kind] || 0) + 1; });
		const shown = bookmarks.filter((b) => filter === 'all' || b.kind === filter);
		return (
			<div>
				<div className="xuanshi-crumbs">
					<span className="xuanshi-crumb" onClick={() => this.props.onHome && this.props.onHome()}>首页</span>
					<span className="xuanshi-crumb-sep">/</span><span>我的</span>
				</div>
				<h1 className="xuanshi-display is-hero" style={{ fontSize: 'clamp(26px,calc(3.4 * var(--horosa-lvw, 1vw)),38px)' }}>案头</h1>
				<div className="xuanshi-section-sub" style={{ margin: '8px 0 0' }}>私藏 · 检索 · 今日所遇。</div>

				{/* 今日精选 */}
				{daily && (daily.title || daily.blurb) ? (
					<div className="xuanshi-card is-link" style={{ margin: '20px 0 8px', background: 'linear-gradient(140deg, var(--paper-card), var(--vermilion-soft))' }} onClick={() => this.nav('overview')}>
						<div className="xuanshi-eyebrow" style={{ marginBottom: 4 }}>今日精选</div>
						<div className="xuanshi-display is-h2" style={{ fontSize: 18 }}>{daily.title}</div>
						{daily.blurb ? <div className="xuanshi-stat-sub" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>{daily.blurb}</div> : null}
					</div>
				) : null}

				<div className="xuanshi-desk-grid">
					{/* 私藏 */}
					<section>
						<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
							<h2 className="xuanshi-display is-h2" style={{ margin: 0 }}>私藏</h2>
							<span className="xuanshi-stat-sub">共 {bookmarks.length} 条</span>
						</div>
						{bookmarks.length ? (
							<>
								<div className="xuanshi-facet-chips" style={{ marginBottom: 14 }}>
									<span className={`xuanshi-fchip${filter === 'all' ? ' is-active' : ''}`} onClick={() => this.setState({ filter: 'all' })}><span className="xuanshi-fchip-label">全部</span><span className="xuanshi-fchip-n">{bookmarks.length}</span></span>
									{Object.entries(counts).map(([k, n]) => (
										<span key={k} className={`xuanshi-fchip${filter === k ? ' is-active' : ''}`} onClick={() => this.setState({ filter: k })}><span className="xuanshi-fchip-label">{KIND_LABEL[k] || k}</span><span className="xuanshi-fchip-n">{n}</span></span>
									))}
								</div>
								<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
									{shown.map((b, i) => (
										<div className="xuanshi-card is-link" key={i} style={{ position: 'relative' }} onClick={() => this.openBookmark(b)}>
											<span className="xuanshi-chip is-ink">{KIND_LABEL[b.kind] || b.kind}</span>
											<span title="移除收藏" onClick={(e) => this.removeBM(e, b)} style={{ position: 'absolute', top: 8, right: 10, fontSize: 14, color: 'var(--ink-muted)', cursor: 'pointer', lineHeight: 1 }}>×</span>
											<div className="xuanshi-display" style={{ fontSize: 14, marginTop: 6, color: 'var(--ink)', lineHeight: 1.4 }}>{b.title || b.ref}</div>
											{b.subtitle ? <div className="xuanshi-stat-sub" style={{ fontSize: 11, marginTop: 2 }}>{b.subtitle}</div> : null}
										</div>
									))}
								</div>
							</>
						) : (
							<div className="xuanshi-card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-muted)' }}>
								<div style={{ fontSize: 34, opacity: 0.4, marginBottom: 10 }}>☆</div>
								<div>还没有任何收藏。逛 <span className="xuanshi-link" onClick={() => this.nav('figures')}>名家</span> 或 <span className="xuanshi-link" onClick={() => this.nav('stories')}>秘录</span>，遇到喜欢的点 ☆ 即可收下。</div>
							</div>
						)}
					</section>

					{/* 右栏:近探 + 门径 + 小贴士 */}
					<aside style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
						<div className="xuanshi-card">
							<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
								<h3 className="xuanshi-display is-h2" style={{ fontSize: 16, margin: 0 }}>近探</h3>
								{history.length ? <span className="xuanshi-link" style={{ fontSize: 11 }} onClick={() => this.clearHistory()}>清空</span> : null}
							</div>
							{history.length ? (
								<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
									{history.map((h, i) => (
										<div key={i} className="xuanshi-cityrow" style={{ borderBottom: 'none', padding: '4px 8px' }} onClick={() => (this.props.onSearchHistory ? this.props.onSearchHistory(h) : this.nav('search'))}>
											<span className="xuanshi-stat-sub" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>⌕ {h.q}</span>
											{searchHistoryFacetHint(h) ? <span className="xuanshi-chip is-ink" style={{ marginLeft: 6 }}>{searchHistoryFacetHint(h)}</span> : null}
										</div>
									))}
								</div>
							) : (
								<div className="xuanshi-stat-sub" style={{ fontSize: 12 }}>尚无搜索历史。用左栏「<span className="xuanshi-link" onClick={() => this.nav('search')}>统一搜索</span>」全库检索。</div>
							)}
						</div>

						<div className="xuanshi-card">
							<h3 className="xuanshi-display is-h2" style={{ fontSize: 16, margin: '0 0 12px' }}>门径</h3>
							<div className="xuanshi-quicklinks" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
								{QUICKLINKS.map((l) => <span key={l.key} className="xuanshi-quicklink" onClick={() => this.nav(l.key)}>{l.label}</span>)}
							</div>
						</div>

						<div className="xuanshi-card" style={{ background: 'var(--paper-soft)' }}>
							<span className="xuanshi-chip is-gold" style={{ marginRight: 6 }}>小贴士</span>
							<span className="xuanshi-stat-sub" style={{ fontSize: 12.5, lineHeight: 1.7 }}>在故事 / 人物 / 术数 / 天象 / 朝代页点 ☆ 即可收藏，用左栏「统一搜索」全库检索。</span>
						</div>
					</aside>
				</div>
			</div>
		);
	}
}
