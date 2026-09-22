import React from 'react';
import { fetchFacets } from '../../services/xuanshi';

// 首页多维检索 —— 对齐标准版首页「检索」模块:
// 传统(正史/野载)顶层切分 → 朝代/语料 · 术数 · 史书/典籍 · 证据 五维 facet(各带实时计数)
// + 实时「匹配 N 条玄学事件」+ 去检索 CTA + 示例预设。
// 单端点 /facets 同时返回稳定选项列表与「当前选择下重算」的计数;勾选即去抖重取。
const TRAD_ZHENGSHI = '正史';
const TRAD_YEZAI = '野载';
const EMPTY_SEL = () => ({ dynasty: [], technique: [], history: [], evidence: '' });

// 示例预设(对齐标准版 examples)
const EXAMPLES = [
	{ label: '袁天纲', cfg: { q: '袁天纲' } },
	{ label: '扶乩', cfg: { q: '扶乩' } },
	{ label: '彗孛', cfg: { q: '彗孛' } },
	{ label: '唐 × 星占', cfg: { dynasty: ['唐'], technique: ['星占'] } },
	{ label: '宋 × 太一', cfg: { dynasty: ['宋'], technique: ['太一'] } },   // [TL-37] 此前「宋 × 望气」命中 0 条;宋代技法面里太一 11 条最多
	{ label: '高证据条目', cfg: { evidence: '高' } },
	{ label: '野载 · 志怪', cfg: { tradition: TRAD_YEZAI, dynasty: ['志怪笔记'] } },
	{ label: '野载 × 冥报', cfg: { tradition: TRAD_YEZAI, technique: ['冥报'] } },
];

export default class XuanShiFacetSearch extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			tradition: props.tradition || TRAD_ZHENGSHI,
			q: props.q || '',
			sel: { ...EMPTY_SEL(), ...(props.sel || {}) },
			traditions: [
				{ key: TRAD_ZHENGSHI, label: '正史玄学', count: 1666 },
				{ key: TRAD_YEZAI, label: '野载玄学', count: 6255 },
			],
			options: { dynasty: [], technique: [], history: [], evidence: [] },
			totals: { xuanxue_events: 0, corpus_paragraphs: 0 },
			loading: true,
		};
		this._timer = null;
		this._reqSeq = 0;
	}

	componentDidMount() { this._mounted = true; this.reload(); }

	componentWillUnmount() { this._mounted = false; if (this._timer) { clearTimeout(this._timer); } }

	get isYezai() { return this.state.tradition === TRAD_YEZAI; }
	get groupLabel() { return this.isYezai ? '语料' : '朝代'; }
	get bookLabel() { return this.isYezai ? '典籍' : '史书'; }

	// 拉取选项 + 当前选择下的实时计数(单端点)
	async reload() {
		const seq = ++this._reqSeq;
		this.setState({ loading: true });
		const { tradition, q, sel } = this.state;
		try {
			const r = await fetchFacets({
				tradition,
				q: q && q.trim() ? q.trim() : undefined,
				dynasty: sel.dynasty,
				technique: sel.technique,
				history: sel.history,
				evidence: sel.evidence || undefined,
			});
			if (seq !== this._reqSeq || !this._mounted) { return; } // 仅采纳最新一次且仍挂载
			this.setState({
				traditions: (r && r.traditions) || this.state.traditions,
				options: (r && r.options) || { dynasty: [], technique: [], history: [], evidence: [] },
				totals: (r && r.totals) || { xuanxue_events: 0, corpus_paragraphs: 0 },
				loading: false,
			});
		} catch (e) {
			if (seq !== this._reqSeq) { return; }
			this.setState({ loading: false });
		}
	}

	// 去抖重取(勾选/输入后)
	scheduleReload() {
		if (this._timer) { clearTimeout(this._timer); }
		this._timer = setTimeout(() => this.reload(), 160);
	}

	setTradition(key) {
		if (key === this.state.tradition) { return; }
		// 切传统 → 清空下层(朝代/语料、典籍互不通用)
		this.setState({ tradition: key, sel: EMPTY_SEL(), q: '' }, () => this.reload());
	}

	toggle(facet, value) {
		const arr = this.state.sel[facet].slice();
		const i = arr.indexOf(value);
		if (i >= 0) { arr.splice(i, 1); } else { arr.push(value); }
		this.setState({ sel: { ...this.state.sel, [facet]: arr } }, () => this.scheduleReload());
	}

	setEvidence(v) {
		const next = this.state.sel.evidence === v ? '' : v;
		this.setState({ sel: { ...this.state.sel, evidence: next } }, () => this.scheduleReload());
	}

	setQ(v) { this.setState({ q: v }, () => this.scheduleReload()); }

	hasAnyFilter() {
		const { q, sel } = this.state;
		return !!(q.trim() || sel.dynasty.length || sel.technique.length || sel.history.length || sel.evidence);
	}

	clearAll() {
		this.setState({ q: '', sel: EMPTY_SEL() }, () => this.reload());
	}

	// 当前选择对象(传给 onSearch)
	selection() {
		const { tradition, q, sel } = this.state;
		return {
			tradition, q: q.trim(),
			dynasty: sel.dynasty.slice(), technique: sel.technique.slice(),
			history: sel.history.slice(), evidence: sel.evidence,
		};
	}

	submit(e) {
		if (e && e.preventDefault) { e.preventDefault(); }
		if (this.props.onSearch) { this.props.onSearch(this.selection()); }
	}

	// 示例:套用预设并直接去检索(嵌入式 SPA 下即点即查更直观)
	preset(cfg) {
		const tradition = cfg.tradition || TRAD_ZHENGSHI;
		const sel = {
			...EMPTY_SEL(),
			dynasty: cfg.dynasty ? cfg.dynasty.slice() : [],
			technique: cfg.technique ? cfg.technique.slice() : [],
			history: cfg.history ? cfg.history.slice() : [],
			evidence: cfg.evidence || '',
		};
		const q = cfg.q || '';
		this.setState({ tradition, q, sel }, () => {
			this.reload();
			if (this.props.onSearch) { this.props.onSearch({ tradition, q: q.trim(), ...sel }); }
		});
	}

	renderFacetRow(label, dim, opts, isEvidence) {
		const { sel } = this.state;
		// 史书/典籍可达上百(野载典籍 ~150),加滚动罩防撑爆版面
		const scroll = dim === 'history' && (opts || []).length > 18;
		return (
			<div className="xuanshi-facet-row" key={dim}>
				<span className="xuanshi-facet-key">{label}</span>
				<div className={`xuanshi-facet-chips${scroll ? ' is-scroll' : ''}`}>
					{(opts || []).map((o) => {
						const active = isEvidence ? sel.evidence === o.name : sel[dim].indexOf(o.name) >= 0;
						const zero = o.count === 0 && !active;
						const lbl = dim === 'history' ? `《${o.name}》` : (isEvidence ? `${o.name}证据` : o.name);
						return (
							<button
								type="button"
								key={dim + '-' + o.name}
								className={`xuanshi-fchip${active ? ' is-active' : ''}${zero ? ' is-zero' : ''}`}
								onClick={() => (isEvidence ? this.setEvidence(o.name) : this.toggle(dim, o.name))}
							>
								<span className="xuanshi-fchip-label">{lbl}</span>
								<span className="xuanshi-fchip-n">{o.count}</span>
							</button>
						);
					})}
				</div>
			</div>
		);
	}

	render() {
		const { tradition, q, traditions, options, totals, loading } = this.state;
		const zs = traditions.find((t) => t.key === TRAD_ZHENGSHI) || { count: 1666 };
		const ye = traditions.find((t) => t.key === TRAD_YEZAI) || { count: 6255 };
		return (
			<div className="xuanshi-facet-search">
				<div style={{ marginBottom: 14 }}>
					<h2 className="xuanshi-display is-h2" style={{ margin: 0 }}>检索</h2>
					<div className="xuanshi-stat-sub" style={{ marginTop: 4, fontSize: 12.5 }}>
						正史玄学 <b>{(zs.count || 0).toLocaleString()}</b> 条 · 野载玄学 <b>{(ye.count || 0).toLocaleString()}</b> 条 · 多维检索 · 典籍原文中钻取。
					</div>
				</div>

				{/* 大搜索框 */}
				<form className="xuanshi-search-box" onSubmit={(e) => this.submit(e)}>
					<span className="xuanshi-search-icon" aria-hidden="true">⌕</span>
					<input
						type="text"
						className="xuanshi-search-input"
						placeholder="人物 · 术数 · 原文 · 朝代…"
						value={q}
						autoComplete="off"
						onChange={(e) => this.setQ(e.target.value)}
					/>
					<button type="submit" className="xuanshi-search-go">检索</button>
				</form>

				{/* Facet 面板 */}
				<div className="xuanshi-facets">
					{/* 传统 */}
					<div className="xuanshi-facet-row">
						<span className="xuanshi-facet-key">传统</span>
						<div className="xuanshi-facet-chips">
							{traditions.map((t) => (
								<button
									type="button"
									key={'trad-' + t.key}
									className={`xuanshi-fchip is-trad${tradition === t.key ? ' is-active' : ''}`}
									onClick={() => this.setTradition(t.key)}
								>
									<span className="xuanshi-fchip-label">{t.label}</span>
									<span className="xuanshi-fchip-n">{t.count}</span>
								</button>
							))}
						</div>
					</div>
					{this.renderFacetRow(this.groupLabel, 'dynasty', options.dynasty, false)}
					{this.renderFacetRow('术数', 'technique', options.technique, false)}
					{this.renderFacetRow(this.bookLabel, 'history', options.history, false)}
					{this.renderFacetRow('证据', 'evidence', options.evidence, true)}
				</div>

				{/* 实时计数 + CTA */}
				<div className="xuanshi-search-summary">
					<div className="xuanshi-summary-left">
						{loading ? (
							<span className="xuanshi-summary-loading">检索中…</span>
						) : (
							<span className="xuanshi-summary-counts">
								匹配 <b>{(totals.xuanxue_events || 0).toLocaleString()}</b> 条玄学事件
							</span>
						)}
						{this.hasAnyFilter() ? (
							<button type="button" className="xuanshi-clear-btn" onClick={() => this.clearAll()}>清空</button>
						) : null}
					</div>
					<button type="button" className="xuanshi-btn-ink" onClick={(e) => this.submit(e)}>去检索 →</button>
				</div>

				{/* 示例 */}
				<div className="xuanshi-examples">
					<span className="xuanshi-examples-label">示例</span>
					{EXAMPLES.map((ex) => (
						<button type="button" key={ex.label} className="xuanshi-example" onClick={() => this.preset(ex.cfg)}>{ex.label}</button>
					))}
				</div>
			</div>
		);
	}
}
