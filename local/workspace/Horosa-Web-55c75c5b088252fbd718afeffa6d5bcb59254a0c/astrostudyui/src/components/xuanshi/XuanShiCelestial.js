import React from 'react';
import { Spin, Empty, Pagination, Select, Input, InputNumber } from 'antd';
import echarts from './echartsCore';
import { fetchCelestial, fetchMicrochronology, fetchDecadeOmens, fetchCelestialEvent } from '../../services/xuanshi';
import { marked } from 'marked';
import { resolveChartDate, collapseSoftBreaks } from './xuanshiDate';
import XuanShiStar from './XuanShiStar';

// 天象事件收藏项(kind=celestial,案头可回跳星象大典)
function celBookmarkItem(e) {
	return {
		kind: 'celestial', ref: e.event_id,
		title: e.date_phrase || (e.original || '').slice(0, 16) || e.event_id,
		subtitle: [e.omen, e.dynasty].filter(Boolean).join(' · '),
	};
}

// 白话与原文字符集重合 >0.85 视为近乎相同(硬古文白话≈原文)→ 隐藏白话免冗余
function nearSame(a, b) { if (!a || !b) { return false; } const sa = new Set(a), sb = new Set(b); let inter = 0; sa.forEach((c) => { if (sb.has(c)) { inter++; } }); return inter / Math.max(sa.size, sb.size, 1) > 0.85; }

// 星象大典(核心)—— 照搬 参考星象大典页:朝代×天象热图(rotate-30 表头+合计+alpha 强度)
// + 十年密度 + 过滤 + 列表 + 详情。点矩阵格 = 按该朝代+天象下钻。

export default class XuanShiCelestial extends React.Component {
	constructor(props) {
		super(props);
		const f = (props.ui && props.ui.celestial) || {};
		this.state = {
			dynasty: f.dynasty || '', omen: (typeof f.omen === 'string' ? f.omen : ''), q: f.q || '', page: f.page || 1,
			history: f.history || '', source: f.source || '', yearFrom: f.yearFrom || '', yearTo: f.yearTo || '',
			crosswalk: f.crosswalk || '', inChapter: f.inChapter || '',
			events: [], total: 0, pages: 0, summary: null,
			loading: false, err: '',
			// 案头点天象事件进来时,首屏直接进详情加载态 → 不先闪整页列表(矩阵/图/事件很重)
			selected: props.openCelestialEvent ? { _loading: true } : null,
			micro: null, microDecade: null, microLoading: false, microPage: 1,
			hover: null, hoverPos: null,
		};
		this._decadeRef = React.createRef();
	}

	// 悬停详情卡(对齐参考:日期 / 原文 / 白话译文 / 来源 / 事件ID),定位贴行右侧、越界翻左
	showHover(e, ev) {
		const rect = e.currentTarget.getBoundingClientRect();
		const W = 360;
		let left = rect.right + 12;
		if (left + W > window.innerWidth - 12) { left = rect.left - W - 12; }
		if (left < 12) { left = 12; }
		const top = Math.min(Math.max(12, rect.top), window.innerHeight - 240);
		this.setState({ hover: ev, hoverPos: { left, top } });
	}
	hideHover() { this.setState({ hover: null }); }

	componentDidMount() {
		this.load();
		this._onResize = () => { if (this._decadeChart) { this._decadeChart.resize(); } };
		// 十年期×天象类 堆叠面积(照搬 参考星象大典页 echarts 配置)
		fetchDecadeOmens().then((d) => { this._decadeData = d; requestAnimationFrame(() => this.initDecadeChart()); }).catch(() => {});
		// 案头·私藏点开天象事件 → 自动按 event_id 拉取并打开该条详情
		if (this.props.openCelestialEvent) { this.openByEventId(this.props.openCelestialEvent); }
	}

	async openByEventId(eventId) {
		try {
			const r = await fetchCelestialEvent(eventId);
			const ev = (r && (r.event || r.item)) || r;
			if (ev && (ev.event_id || ev.original || ev.omen)) { this.setState({ selected: ev }); return; }
			this.setState({ selected: null }); // 空结果 → 回列表(不卡加载态)
		} catch (e) { this.setState({ selected: null }); } // 拉取失败 → 回列表
	}

	componentWillUnmount() {
		if (this._decadeChart) { this._decadeChart.dispose(); this._decadeChart = null; }
		if (this._hostRO) { try { this._hostRO.disconnect(); } catch (e) { /* noop */ } this._hostRO = null; }
		if (this._onResize) { window.removeEventListener('resize', this._onResize); }
	}

	// 照搬标准版 参考星象大典页 的 echarts 堆叠面积配置(palette/stack/areaStyle 0.55/smooth 0.2/legend scroll)
	initDecadeChart() {
		const el = this._decadeRef && this._decadeRef.current;
		const data = this._decadeData;
		if (!el || !data || !data.decades) { return; }
		const isDark = document.documentElement.getAttribute('data-horosa-appearance') === 'dark';
		if (this._decadeChart) { this._decadeChart.dispose(); }
		const chart = echarts.init(el, null, { renderer: 'canvas', width: el.clientWidth || undefined, height: 360 });
		this._decadeChart = chart;
		const palette = ['#a63d2a', '#4d7560', '#b48a3c', '#8a7e6b', '#d99a6c', '#6c8a99', '#9a6c8a', '#6c9a73', '#a89060', '#7a8a6c'];
		chart.setOption({
			backgroundColor: 'transparent',
			color: palette,
			tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
			legend: { type: 'scroll', bottom: 0, textStyle: { color: isDark ? '#c0b7a3' : '#4a4036', fontSize: 11 } },
			grid: { left: 50, right: 20, top: 16, bottom: 38 },
			xAxis: {
				type: 'category', data: data.decades.map((d) => d + 's'),
				axisLabel: { color: isDark ? '#8a8170' : '#8a7e6b', fontSize: 10 },
				axisLine: { lineStyle: { color: isDark ? '#3a3225' : '#cfc4a8' } },
			},
			yAxis: {
				type: 'value', axisLabel: { color: isDark ? '#8a8170' : '#8a7e6b' },
				splitLine: { lineStyle: { color: isDark ? '#221c14' : '#ebe2cb' } },
			},
			series: (data.series || []).map((s) => ({
				name: s.omen || s.name, type: 'line', stack: 'all', areaStyle: { opacity: 0.55 },
				smooth: 0.2, symbol: 'none', emphasis: { focus: 'series' }, data: s.data,
			})),
		});
		window.addEventListener('resize', this._onResize);
		// [Tahoe 订阅补齐] 容器 RO 与 window resize 双通道(事件断链引擎下 RO 兜底)。
		try {
			if (typeof ResizeObserver !== 'undefined' && !this._hostRO) {
				this._hostRO = new ResizeObserver(this._onResize);
				this._hostRO.observe(el);
			}
		} catch (e) { this._hostRO = null; }
	}

	renderDecadeChart() {
		return (
			<div className="xuanshi-card" style={{ padding: 18 }}>
				<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
					<h2 className="xuanshi-display is-h2" style={{ fontSize: 17, margin: 0 }}>公历十年期 × 天象类 时序</h2>
					<span className="xuanshi-stat-sub" style={{ fontSize: 11 }}>面积 = 该十年期事件数</span>
				</div>
				<div ref={this._decadeRef} style={{ width: '100%', height: 360 }} />
			</div>
		);
	}

	persist() {
		if (this.props.onPersist) {
			this.props.onPersist('celestial', { dynasty: this.state.dynasty, omen: this.state.omen, q: this.state.q, page: this.state.page, history: this.state.history, source: this.state.source, yearFrom: this.state.yearFrom, yearTo: this.state.yearTo, crosswalk: this.state.crosswalk, inChapter: this.state.inChapter });
		}
	}

	async load() {
		this.setState({ loading: true, err: '' });
		try {
			const r = await fetchCelestial({
				dynasty: this.state.dynasty || undefined,
				omen: this.state.omen || undefined,
				history: this.state.history || undefined,
				source: this.state.source || undefined,
				year_from: this.state.yearFrom !== '' ? this.state.yearFrom : undefined,
				year_to: this.state.yearTo !== '' ? this.state.yearTo : undefined,
				has_crosswalk: this.state.crosswalk !== '' ? this.state.crosswalk : undefined,
				in_chapter: this.state.inChapter !== '' ? this.state.inChapter : undefined,
				q: this.state.q || undefined,
				page: this.state.page, page_size: 20,
			});
			this.setState({
				events: r.events || r.items || [], total: r.total || 0, pages: r.pages || 0,
				// global_summary 恒为全库口径(KPI/筛选器选项源);仅首拉或缺失时落库,后续筛选不覆盖
				summary: r.global_summary || this.state.summary, loading: false,
			});
		} catch (e) { this.setState({ loading: false, err: `${e && e.message ? e.message : e}` }); }
		this.persist();
	}

	setFilter(patch) { this.setState({ ...patch, page: 1 }, () => this.load()); }

	// 十年密度下钻:取该年代逐年天象(微年表);再点同一年代则收起
	async loadMicro(decade) {
		if (this.state.microDecade === decade) { this.setState({ microDecade: null, micro: null }); return; }
		this.setState({ microDecade: decade, micro: null, microLoading: true, microPage: 1 });
		try {
			const r = await fetchMicrochronology({ decade }); // 该年代全部事件(不受列表 omen 过滤影响)
			// 源数据同一天象在多个 topic CSV 各存一份(原文最多重复 32 次)→ 按(原文+日期)去重
			const seen = new Set();
			const events = (r.events || []).filter((e) => { const k = `${e.original || e.interpretation || ''}|${e.modern_date_disp || e.date_phrase || ''}`; if (seen.has(k)) { return false; } seen.add(k); return true; });
			this.setState({ micro: { ...r, events }, microLoading: false });
		} catch (e) { this.setState({ microLoading: false }); }
	}

	renderMatrix() {
		const s = this.state.summary;
		if (!s || !s.matrix_rows || !s.matrix_omens) { return null; }
		const omens = s.matrix_omens;
		const mx = s.max_cell || 1;
		return (
			<div className="xuanshi-card" style={{ marginTop: 18, padding: 18, overflowX: 'auto' }}>
				<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
					<h2 className="xuanshi-display is-h2" style={{ fontSize: 17, margin: 0 }}>朝代 × 天象类 热图</h2>
					<span className="xuanshi-stat-sub" style={{ fontSize: 11 }}>点击单元下钻；颜色深浅 = 数量</span>
				</div>
				<table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 12 }}>
					<thead>
						<tr>
							<th style={{ textAlign: 'left', paddingRight: 8, color: 'var(--ink-muted)', fontWeight: 400, minWidth: 80 }}>朝代</th>
							{omens.map((o) => (
								<th key={o} style={{ minWidth: 48, height: 56, color: 'var(--ink-muted)', fontWeight: 400, verticalAlign: 'bottom' }}>
									<span onClick={() => this.setFilter({ omen: o, dynasty: '' })} style={{ display: 'inline-block', transform: 'rotate(-30deg)', transformOrigin: 'bottom left', whiteSpace: 'nowrap', cursor: 'pointer' }}>{o}</span>
								</th>
							))}
							<th style={{ paddingRight: 8, textAlign: 'right', color: 'var(--ink-muted)', fontWeight: 400, minWidth: 48 }}>合计</th>
						</tr>
					</thead>
					<tbody>
						{s.matrix_rows.map((row) => (
							<tr key={row.macro}>
								<th style={{ textAlign: 'left', paddingRight: 8, fontFamily: 'var(--xs-serif)', color: 'var(--ink)', fontWeight: 400 }}>
									<span onClick={() => this.setFilter({ dynasty: row.macro, omen: '' })} style={{ cursor: 'pointer' }}>{row.macro}</span>
								</th>
								{row.cells.map((c) => {
									const ratio = mx ? c.n / mx : 0;
									const alpha = 0.06 + ratio * 0.85;
									return (
										<td key={c.omen}
											onClick={() => (c.n ? this.setFilter({ dynasty: row.macro, omen: c.omen }) : null)}
											title={`${row.macro} · ${c.omen} · ${c.n} 条`}
											style={{
												textAlign: 'center', width: 48, height: 28, borderRadius: 3,
												background: `rgba(166,61,42,${alpha.toFixed(3)})`,
												color: alpha > 0.5 ? '#fff8ee' : 'var(--ink)',
												cursor: c.n ? 'pointer' : 'default', fontVariantNumeric: 'tabular-nums',
											}}>{c.n > 0 ? c.n : ''}</td>
									);
								})}
								<td style={{ paddingRight: 8, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--xs-serif)', color: 'var(--ink-soft)' }}>{(row.total || 0).toLocaleString()}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		);
	}

	renderDecades() {
		const s = this.state.summary;
		if (!s || !s.by_decade || !s.by_decade.length) { return null; }
		const maxN = s.max_decade_n || Math.max(...s.by_decade.map((d) => d[1]), 1);
		return (
			<div className="xuanshi-card" style={{ marginTop: 14, padding: 14 }}>
				<div className="xuanshi-stat-label" style={{ textAlign: 'left', marginBottom: 10 }}>十年密度 · 点柱下钻逐年微年表</div>
				<div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 70, overflowX: 'auto' }}>
					{s.by_decade.map((d) => (
						<div key={d[0]} title={`${d[0]}年代:${d[1]} 条(点看微年表)`} onClick={() => this.loadMicro(d[0])} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto', cursor: 'pointer' }}>
							<div style={{ width: 7, height: `${Math.max(2, 60 * d[1] / maxN)}px`, background: this.state.microDecade === d[0] ? 'var(--vermilion)' : 'var(--jade)', borderRadius: '2px 2px 0 0', transition: 'background .15s' }} />
						</div>
					))}
				</div>
			</div>
		);
	}

	renderMicro() {
		const { micro, microDecade, microLoading } = this.state;
		if (microDecade == null) { return null; }
		const decLabel = microDecade < 0 ? `公元前 ${Math.abs(microDecade)}` : `公元 ${microDecade}`;
		const evs = (micro && micro.events) || [];
		const PAGE = 50;
		const mp = this.state.microPage || 1;
		const pageEvs = evs.slice((mp - 1) * PAGE, mp * PAGE);
		return (
			<div className="xuanshi-card" style={{ marginTop: 12, padding: 14 }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
					<span className="xuanshi-stat-label" style={{ textAlign: 'left' }}>{decLabel} 年代 · 微年表{evs.length ? `(${evs.length} 条)` : ''}</span>
					<span className="xuanshi-link" style={{ fontSize: 12, marginLeft: 'auto' }} onClick={() => this.setState({ microDecade: null, micro: null })}>收起</span>
				</div>
				{microLoading ? <div className="xuanshi-center" style={{ minHeight: 80 }}><Spin tip="载入微年表…" /></div>
					: !evs.length ? <Empty description="该年代无带年天象" image={Empty.PRESENTED_IMAGE_SIMPLE} />
						: (
							<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
								{pageEvs.map((e) => (
									<div key={e.event_id} className="xuanshi-card is-link" style={{ padding: '7px 11px', display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => this.setState({ selected: e })}>
										<span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--vermilion)', fontFamily: 'var(--xs-serif)', minWidth: 64, fontSize: 13 }}>{e.modern_date_disp || (e.year != null ? (e.year < 0 ? `前${-e.year}` : e.year) : '—')}</span>
										<span className="xuanshi-chip is-vermilion">{e.omen}</span>
										<span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.original || e.date_phrase || e.interpretation || ''}</span>
										{e.history ? <span className="xuanshi-chip is-ink">{`《${e.history}》`}</span> : null}
									</div>
								))}
								{evs.length > PAGE ? <div style={{ marginTop: 12, textAlign: 'center' }}><Pagination simple current={mp} total={evs.length} pageSize={PAGE} showSizeChanger={false} onChange={(p) => this.setState({ microPage: p })} /></div> : null}
							</div>
						)}
			</div>
		);
	}

	// 源 CSV / 史书 两列(对齐标准版底部双列;点击即筛选)
	renderSourceCols() {
		const sm = this.state.summary || {};
		const sources = sm.by_source || [];
		const histories = sm.by_history || [];
		if (!sources.length && !histories.length) { return null; }
		const col = (label, list, key, wrap) => (
			<div className="xuanshi-celcol">
				<div className="xuanshi-stat-label" style={{ textAlign: 'left', marginBottom: 8 }}>{label}</div>
				<div className="xuanshi-celcol-list">
					{list.map((d) => {
						const name = Array.isArray(d) ? d[0] : d;
						const n = Array.isArray(d) ? d[1] : '';
						const active = this.state[key] === name;
						return (
							<div key={name} className={`xuanshi-celcol-row${active ? ' is-active' : ''}`} onClick={() => this.setFilter({ [key]: active ? '' : name })}>
								<span className="xuanshi-celcol-name">{wrap ? `《${name}》` : name}</span>
								<span className="xuanshi-celcol-n">{(n || 0).toLocaleString()}</span>
							</div>
						);
					})}
				</div>
			</div>
		);
		return (
			<div className="xuanshi-celcols">
				{col('源 CSV', sources, 'source', false)}
				{col('史书', histories, 'history', true)}
			</div>
		);
	}

	renderDetail() {
		const d = this.state.selected;
		// 案头深链进来的加载骨架(避免先闪列表;拉到事件后即换为正文)
		if (d && d._loading) {
			return (
				<div>
					<span className="xuanshi-link" onClick={() => this.setState({ selected: null })}>← 返回列表</span>
					<div className="xuanshi-center" style={{ minHeight: 320 }}><Spin tip="载入天象…" /></div>
				</div>
			);
		}
		const field = (label, val) => (val ? (
			<div style={{ marginBottom: 13 }}>
				<div className="xuanshi-stat-label" style={{ textAlign: 'left' }}>{label}</div>
				<div className="xuanshi-prose" style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: marked.parse(collapseSoftBreaks(String(val)), { gfm: true, breaks: false }) }} />
			</div>
		) : null);
		const metaText = (label, val) => (val && String(val).trim() ? (
			<div style={{ marginBottom: 11 }}>
				<div className="xuanshi-stat-label" style={{ textAlign: 'left', fontSize: 11 }}>{label}</div>
				<div style={{ marginTop: 2, fontSize: 12.5, lineHeight: 1.65, color: 'var(--ink-soft)' }}>{val}</div>
			</div>
		) : null);
		const hasMeta = d.citation || d.date_phrase || d.era || d.subject || d.action || d.target || d.routing_theme;
		return (
			<div>
				<span className="xuanshi-link" onClick={() => this.setState({ selected: null })}>← 返回</span>
				<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
						<h2 className="xuanshi-display is-h2" style={{ margin: 0 }}>{d.omen || '天象'} · {d.dynasty || ''}{d.modern_date_disp ? ` · ${d.modern_date_disp}` : ''}</h2>
						<XuanShiStar item={celBookmarkItem(d)} />
					</div>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 18px' }}>
					{d.omen ? <span className="xuanshi-chip is-vermilion">{d.omen}</span> : null}
					{d.dynasty ? <span className="xuanshi-chip is-ink">{d.dynasty}</span> : null}
					{d.history ? <span className="xuanshi-chip is-gold">《{d.history}》{d.volume_no ? `卷${d.volume_no}` : ''}</span> : null}
					{d.has_crosswalk ? <span className="xuanshi-chip is-jade">有交叉</span> : null}
				</div>
				<div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
					<div style={{ flex: '1 1 440px', minWidth: 0, maxWidth: 880 }}>
						{field('原文', d.original)}
						{nearSame(d.modern, d.original) ? null : field('白话', d.modern)}
						{field('解读', d.interpretation)}
						{(() => {
							const rd = this.props.onChartLink ? resolveChartDate(d) : null;
							if (!rd) { return null; }
							return (
								<div style={{ marginTop: 14 }}>
									<div className="xuanshi-hint" style={{ marginBottom: 8 }}>{rd.exact ? `公历 ${rd.md}` : `${rd.disp}(按年份最早)`} —— 排此历史日之盘(按朝代都城近似经纬)</div>
									<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
										<span className="xuanshi-btn is-primary" onClick={() => this.props.onChartLink(d, 'astrochart')}>排此日 · 占星盘</span>
										<span className="xuanshi-btn" onClick={() => this.props.onChartLink(d, 'guolao')}>排此日 · 七政四余</span>
										<span className="xuanshi-btn" onClick={() => this.props.onChartLink(d, 'planetarium')}>此时此地 · 天文馆</span>
									</div>
								</div>
							);
						})()}
					</div>
					{hasMeta ? (
						<aside className="xuanshi-card" style={{ flex: '0 0 300px', alignSelf: 'flex-start' }}>
							<div className="xuanshi-stat-label" style={{ textAlign: 'left', marginBottom: 12, color: 'var(--vermilion)', letterSpacing: '.1em' }}>天象档案</div>
							{metaText('出处', d.citation)}
							{metaText('原历日', d.date_phrase)}
							{metaText('纪年', d.era)}
							{metaText('主体', d.subject)}
							{metaText('动作', d.action)}
							{metaText('对象', d.target)}
							{metaText('公历', d.modern_date_disp || d.modern_date)}
							{metaText('主题', d.routing_theme)}
						</aside>
					) : null}
				</div>
			</div>
		);
	}

	render() {
		if (this.state.selected) { return this.renderDetail(); }
		const { events, total, pages, page, loading, err, summary } = this.state;
		const sm = summary || {};
		const opt = (arr) => (arr || []).map((d) => Array.isArray(d) ? { value: d[0], label: `${d[0]} (${(d[1] || 0).toLocaleString()})` } : { value: d, label: d });
		const histOpt = (sm.by_history || []).map((d) => Array.isArray(d) ? { value: d[0], label: `《${d[0]}》${d[1] ? ' (' + d[1].toLocaleString() + ')' : ''}` } : { value: d, label: `《${d}》` });
		const isFiltered = !!(this.state.dynasty || this.state.omen || this.state.history || this.state.source || this.state.yearFrom !== '' || this.state.yearTo !== '' || this.state.crosswalk !== '' || this.state.inChapter !== '' || this.state.q);
		const kpis = [
			{ label: '全库事件', n: sm.total, color: 'var(--vermilion)' },
			{ label: '当前筛选', n: total, color: 'var(--jade)' },
			{ label: '已交叉社会事件', n: sm.has_crosswalk, color: 'var(--gold)' },
			{ label: '精选章稿样本', n: sm.in_chapter, color: 'var(--ink-soft)' },
		];
		return (
			<div>
				{/* 面包屑 + 标题 + 摘要 */}
				<div className="xuanshi-crumbs">
					<span className="xuanshi-crumb" onClick={() => this.props.onHome && this.props.onHome()}>首页</span>
					<span className="xuanshi-crumb-sep">/</span><span>星象大典</span>
				</div>
				<h1 className="xuanshi-display is-hero" style={{ fontSize: 'clamp(26px,3.4vw,38px)' }}>星象大典</h1>
				<div className="xuanshi-section-sub" style={{ maxWidth: 920, margin: '8px 0 0' }}>
					汇集正史天文、灾异、微年表、流星形态与社会交叉记录，统一归一到 <b style={{ color: 'var(--ink)' }}>朝代 × 天象类 × 史书 × 公历时间</b> 视图。
					全库 <b style={{ color: 'var(--vermilion)' }}>{(sm.total || 0).toLocaleString()}</b> 事件 · <b>{(sm.with_year || 0).toLocaleString()}</b> 可推公历年 · <b>{(sm.has_crosswalk || 0).toLocaleString()}</b> 已做同日近日交叉 · <b>{(sm.in_chapter || 0).toLocaleString()}</b> 已入正式章稿
				</div>

				{/* KPI 卡 */}
				<div className="xuanshi-kpi-grid">
					{kpis.map((k) => (
						<div className="xuanshi-kpi-card" key={k.label}>
							<div className="xuanshi-kpi-label">{k.label}</div>
							<div className="xuanshi-kpi-num" style={{ color: k.color }}>{(k.n || 0).toLocaleString()}</div>
						</div>
					))}
				</div>

				{/* 筛选面板 */}
				<div className="xuanshi-celfilter">
					<Input.Search placeholder='关键词（原文 / 解读 / 干支 …）' allowClear size="small" style={{ minWidth: 200, flex: '2 1 200px' }} defaultValue={this.state.q} key={`cq-${isFiltered}`} onSearch={(v) => this.setFilter({ q: v })} />
					<Select allowClear showSearch size="small" placeholder="朝代:全部" style={{ flex: '1 1 130px' }} value={this.state.dynasty || undefined}
						options={opt(sm.by_dynasty)} onChange={(v) => this.setFilter({ dynasty: v || '' })} filterOption={(i, o) => (o.label || '').indexOf(i) >= 0} />
					<Select allowClear showSearch size="small" placeholder="天象类:全部" style={{ flex: '1 1 130px' }} value={this.state.omen || undefined}
						options={opt(sm.by_omen)} onChange={(v) => this.setFilter({ omen: v || '' })} filterOption={(i, o) => (o.label || '').indexOf(i) >= 0} />
					<Select allowClear showSearch size="small" placeholder="史书:全部" style={{ flex: '1 1 130px' }} value={this.state.history || undefined}
						options={histOpt} onChange={(v) => this.setFilter({ history: v || '' })} filterOption={(i, o) => (o.label || '').indexOf(i) >= 0} />
					<Select allowClear showSearch size="small" placeholder="源 CSV:全部" style={{ flex: '1 1 150px' }} value={this.state.source || undefined}
						options={opt(sm.by_source)} onChange={(v) => this.setFilter({ source: v || '' })} filterOption={(i, o) => (o.label || '').indexOf(i) >= 0} />
					<InputNumber size="small" placeholder="起年" style={{ flex: '0 1 92px' }} value={this.state.yearFrom !== '' ? this.state.yearFrom : null} onChange={(v) => this.setFilter({ yearFrom: v == null ? '' : v })} />
					<InputNumber size="small" placeholder="终年" style={{ flex: '0 1 92px' }} value={this.state.yearTo !== '' ? this.state.yearTo : null} onChange={(v) => this.setFilter({ yearTo: v == null ? '' : v })} />
					<Select size="small" placeholder="同日近日:不限" style={{ flex: '1 1 130px' }} value={this.state.crosswalk || undefined} allowClear
						options={[{ value: '1', label: '仅 ✓ 有交叉' }, { value: '0', label: '仅 ✗ 无交叉' }]} onChange={(v) => this.setFilter({ crosswalk: v || '' })} />
					<Select size="small" placeholder="章稿:不限" style={{ flex: '1 1 120px' }} value={this.state.inChapter || undefined} allowClear
						options={[{ value: '1', label: '仅 ✓ 已收' }, { value: '0', label: '仅 ✗ 未收' }]} onChange={(v) => this.setFilter({ inChapter: v || '' })} />
					{isFiltered ? <span className="xuanshi-link" style={{ fontSize: 12, alignSelf: 'center' }} onClick={() => this.setState({ dynasty: '', omen: '', history: '', source: '', yearFrom: '', yearTo: '', crosswalk: '', inChapter: '', q: '', page: 1 }, () => this.load())}>清空</span> : null}
				</div>

				{this.renderMatrix()}
				<div className="xuanshi-cel-mid">
					{this.renderDecadeChart()}
					{this.renderSourceCols()}
				</div>

				<div style={{ marginTop: 18 }}>
					{loading ? <div className="xuanshi-center"><Spin tip="检索…" /></div> : err ? (
						<div className="xuanshi-center"><Empty description={`载入失败:${err}`} /><span className="xuanshi-link" onClick={() => this.load()}>重试</span></div>
					) : !events.length ? <div className="xuanshi-center"><Empty description="无匹配天象" /></div> : (
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
							{events.map((e) => (
								<div className="xuanshi-card is-link" key={e.event_id} style={{ position: 'relative' }}
									onClick={() => this.setState({ selected: e })}
									onMouseEnter={(ev) => this.showHover(ev, e)} onMouseLeave={() => this.hideHover()}>
									<div style={{ position: 'absolute', top: 8, right: 10, zIndex: 2 }}>
										<XuanShiStar item={celBookmarkItem(e)} />
									</div>
									<div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, paddingRight: 22 }}>
										<span className="xuanshi-chip is-vermilion">{e.omen}</span>
										{e.dynasty ? <span className="xuanshi-chip is-ink">{e.dynasty}</span> : null}
										{e.modern_date_disp ? <span className="xuanshi-chip is-gold">{e.modern_date_disp}</span> : null}
									</div>
									<div className="xuanshi-stat-sub" style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--ink-soft)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
										{e.original || e.interpretation || e.date_phrase || ''}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
				{pages > 1 ? (
					<div style={{ marginTop: 18, textAlign: 'center' }}>
						<Pagination simple current={page} total={total} pageSize={20} showSizeChanger={false} onChange={(p) => this.setState({ page: p }, () => this.load())} />
					</div>
				) : null}

				{/* 悬浮详情卡(对齐参考:日期 / 原文 / 白话译文 / 解读 / 来源 · 事件ID) */}
				{this.state.hover ? (
					<div className="xuanshi-micro-hover" style={this.state.hoverPos ? { left: this.state.hoverPos.left, top: this.state.hoverPos.top } : undefined}>
						{this.state.hover.omen ? <span className="xuanshi-chip is-jade" style={{ marginBottom: 8, display: 'inline-block' }}>{this.state.hover.omen}</span> : null}
						<div className="xuanshi-mh-field"><div className="k">日期</div><div className="v">{this.state.hover.date_phrase || '—'}{this.state.hover.modern_date_disp ? ` · 公历 ${this.state.hover.modern_date_disp}` : ''}</div></div>
						{this.state.hover.original ? <div className="xuanshi-mh-field"><div className="k">原文</div><div className="v" style={{ fontFamily: 'var(--xs-serif)' }}>{collapseSoftBreaks(this.state.hover.original)}</div></div> : null}
						{this.state.hover.modern && !nearSame(this.state.hover.modern, this.state.hover.original) ? <div className="xuanshi-mh-field"><div className="k">白话译文</div><div className="v" style={{ borderLeft: '3px solid var(--jade)', paddingLeft: 8 }}>{collapseSoftBreaks(this.state.hover.modern)}</div></div> : null}
						{this.state.hover.interpretation ? <div className="xuanshi-mh-field"><div className="k">解读</div><div className="v" style={{ color: 'var(--jade)' }}>{collapseSoftBreaks(this.state.hover.interpretation)}</div></div> : null}
						<div className="xuanshi-mh-meta">{this.state.hover.source_label || (this.state.hover.history ? `《${this.state.hover.history}》` : '')}{this.state.hover.event_id ? `${(this.state.hover.source_label || this.state.hover.history) ? ' · ' : ''}事件ID ${this.state.hover.event_id}` : ''}</div>
					</div>
				) : null}
			</div>
		);
	}
}
