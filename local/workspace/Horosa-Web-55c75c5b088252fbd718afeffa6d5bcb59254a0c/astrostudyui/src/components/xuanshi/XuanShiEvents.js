import React from 'react';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import { Spin, Empty, Input } from 'antd';
import { fetchEvents, fetchEvent, fetchEventsMeta } from '../../services/xuanshi';
import { marked } from 'marked';
import { resolveChartDate, collapseSoftBreaks } from './xuanshiDate';
import { dynClass } from './xuanshiDynClass';
import XuanShiStar from './XuanShiStar';

// 白话与原文字符集重合度 >0.85 视为近乎相同(源库少数硬古文白话≈原文)→ 隐藏白话免冗余
function nearSame(a, b) { if (!a || !b) { return false; } const sa = new Set(a), sb = new Set(b); let inter = 0; sa.forEach((c) => { if (sb.has(c)) { inter++; } }); return inter / Math.max(sa.size, sb.size, 1) > 0.85; }

// 玄学万象 —— 正史 / 野载 玄学事件浏览。对齐标准版:传统切换 + 朝代游历(图标+计数)
// + 史书细分 + 密/中/摘 密度 + list-rows 富行 + 富翻页 + 点击详情(original_text 原样含出处)。

function splitList(s) {
	if (!s) { return []; }
	return `${s}`.split(/[;,、，]\s*/).map((x) => x.trim()).filter(Boolean);
}

export default class XuanShiEvents extends React.Component {
	constructor(props) {
		super(props);
		const f = (props.ui && props.ui.events) || {};
		let density = 'medium';
		try { density = localStorage.getItem('xuanshi:density:events') || 'medium'; } catch (e) { /* noop */ }
		this.state = {
			tradition: f.tradition || '正史',
			dynasty: f.dynasty || '',
			history: f.history || '',
			q: f.q || '',
			page: f.page || 1,
			density,
			items: [], total: 0, pages: 0,
			loading: false, err: '',
			meta: null,
			selected: null, detailLoading: false,
		};
	}

	componentDidMount() {
		this.load();
		this.loadMeta();
		// 从首页检索结果跳入:自动打开该事件详情(覆盖在列表之上)
		if (this.props.openEventId) { this.openDetail(this.props.openEventId); }
	}

	async loadMeta() {
		try {
			const meta = await fetchEventsMeta(this.state.tradition);
			this.setState({ meta });
		} catch (e) { /* 头部统计失败不挡列表 */ }
	}

	persist() {
		if (this.props.onPersist) {
			this.props.onPersist('events', { tradition: this.state.tradition, dynasty: this.state.dynasty, history: this.state.history, q: this.state.q, page: this.state.page });
		}
	}

	async load() {
		this.setState({ loading: true, err: '' });
		try {
			const r = await fetchEvents({
				tradition: this.state.tradition || undefined,
				dynasty: this.state.dynasty || undefined,
				history: this.state.history || undefined,
				q: this.state.q || undefined,
				page: this.state.page,
				page_size: 20,
			});
			this.setState({ items: r.items || [], total: r.total || 0, pages: r.pages || 0, loading: false });
		} catch (e) {
			this.setState({ loading: false, err: `${e && e.message ? e.message : e}` });
		}
		this.persist();
	}

	setFilter(patch, resetPage = true) {
		// 切传统:重置朝代/史书选择 + 重拉头部元数据(朝代游历随传统换轴)
		const tradChanged = ('tradition' in patch) && patch.tradition !== this.state.tradition;
		const next = { ...patch, ...(resetPage ? { page: 1 } : {}) };
		if (tradChanged) { next.dynasty = ''; next.history = ''; }
		this.setState(next, () => { this.load(); if (tradChanged) { this.loadMeta(); } });
	}

	setDensity(d) {
		this.setState({ density: d });
		try { safeLocalStorageSet('xuanshi:density:events', d); } catch (e) { /* noop */ }
	}

	async openDetail(id) {
		this.setState({ detailLoading: true, selected: { event_id: id } });
		try {
			const d = await fetchEvent(id);
			this.setState({ selected: d, detailLoading: false });
		} catch (e) {
			this.setState({ detailLoading: false, selected: { event_id: id, _err: `${e}` } });
		}
	}

	// 返回列表并(可选)套用过滤,供面包屑用
	backToList(patch) {
		this.setState({ selected: null }, () => { if (patch) { this.setFilter(patch); } });
	}

	renderDetail() {
		const d = this.state.selected;
		if (this.state.detailLoading || !d.title) {
			if (!d._err) { return <div className="xuanshi-center"><Spin tip="载入事件…" /></div>; }
		}
		if (d._err) { return <div className="xuanshi-center"><Empty description={`载入失败:${d._err}`} /></div>; }
		const md = (val) => marked.parse(collapseSoftBreaks(String(val)), { gfm: true, breaks: false });
		// 段落框:原文(ink·纯文本)/白话(gold·md)/解读(vermilion·md)
		const fieldBox = (label, val, variant, isMd) => (val ? (
			<div className={`xuanshi-field is-${variant}`}>
				<div className="xuanshi-field-label">{label}</div>
				{isMd
					? <div className="xuanshi-field-body" dangerouslySetInnerHTML={{ __html: md(val) }} />
					: <div className="xuanshi-field-body" style={{ whiteSpace: 'pre-line', fontFamily: 'var(--xs-serif)' }}>{val}</div>}
			</div>
		) : null);
		const isYezai = d.tradition === '野载';
		const techs = splitList(d.techniques);
		const sameDyn = d.same_dyn || [];
		const sameHist = d.same_hist || [];
		const relList = (title, arr) => (arr.length ? (
			<div style={{ flex: '1 1 240px', minWidth: 0 }}>
				<h3 className="xuanshi-display is-h2" style={{ fontSize: 15, marginBottom: 8 }}>{title}</h3>
				<ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
					{arr.map((r) => (
						<li key={r.event_id} style={{ marginBottom: 6 }}>
							<span className="xuanshi-link" style={{ fontSize: 13, lineHeight: 1.45 }} onClick={() => this.openDetail(r.event_id)}>{r.title || r.event_id}</span>
							{r.history ? <div className="xuanshi-stat-sub" style={{ fontSize: 11 }}>《{r.history}》{r.volume_no ? `卷${r.volume_no}` : ''}</div> : null}
						</li>
					))}
				</ul>
			</div>
		) : null);
		return (
			<div>
				{/* 面包屑 */}
				<div className="xuanshi-crumbs">
					<span className="xuanshi-crumb" onClick={() => this.backToList()}>玄学万象</span>
					<span className="xuanshi-crumb-sep">/</span>
					<span className="xuanshi-crumb" onClick={() => this.backToList({ tradition: d.tradition || '' })}>{d.tradition || '正史'}</span>
					{d.dynasty ? <><span className="xuanshi-crumb-sep">/</span><span className="xuanshi-crumb" onClick={() => this.backToList({ tradition: d.tradition || '', dynasty: d.dynasty })}>{d.dynasty}</span></> : null}
					{d.history ? <><span className="xuanshi-crumb-sep">/</span><span style={{ color: 'var(--ink-soft)' }}>《{d.history}》</span></> : null}
				</div>

				{/* 头部 chips */}
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
					<span className={`xuanshi-chip ${isYezai ? 'is-vermilion' : 'is-gold'}`}>{d.tradition || '正史'}</span>
					{d.dynasty ? <span className="xuanshi-chip is-ink">{d.dynasty}</span> : null}
					{d.history ? <span className="xuanshi-chip is-ink">《{d.history}》{d.volume_no ? `卷${d.volume_no}` : ''}</span> : null}
					{d.period ? <span className="xuanshi-chip">{d.period}</span> : null}
					{techs.slice(0, 3).map((t) => <span className="xuanshi-chip is-jade" key={t}>{t}</span>)}
					{d.evidence === '高' ? <span className="xuanshi-chip is-gold">高证据</span> : (d.evidence ? <span className="xuanshi-chip">证据 {d.evidence}</span> : null)}
				</div>
				<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
					<h2 className="xuanshi-display is-h2" style={{ marginTop: 2 }}>{d.title}</h2>
					<XuanShiStar item={{ kind: 'event', ref: d.event_id, title: d.title, subtitle: d.dynasty || '' }} />
				</div>
				{d.citation ? <div className="xuanshi-stat-sub" style={{ marginTop: 6, fontFamily: 'var(--xs-serif)', fontSize: 13 }}>{d.citation}</div> : null}
				{isYezai && d.reliability_note ? (
					<div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.7, color: 'var(--ink-muted)' }}>
						<span style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--vermilion)', marginRight: 6 }}>史源</span>{d.reliability_note}
					</div>
				) : null}

				<div className="xuanshi-detail-grid" style={{ marginTop: 18 }}>
					{/* 正文 */}
					<div style={{ minWidth: 0 }}>
						{fieldBox('原文', d.original_text, 'original', false)}
						{nearSame(d.modern_text, d.original_text) ? null : fieldBox('白话译文', d.modern_text, 'modern', true)}
						{/* 点睛 / 秘法 钩子卡 */}
						{(d.dianjing || d.mifa) ? (
							<div className="xuanshi-hook-card">
								{d.dianjing ? <div className="xuanshi-hook-row"><span className="xuanshi-hook-tag is-dianjing">点睛</span><span className="xuanshi-hook-text" dangerouslySetInnerHTML={{ __html: md(d.dianjing) }} /></div> : null}
								{d.mifa ? <div className="xuanshi-hook-row"><span className="xuanshi-hook-tag is-mifa">秘法</span><span className="xuanshi-hook-text" dangerouslySetInnerHTML={{ __html: md(d.mifa) }} /></div> : null}
							</div>
						) : null}
						{fieldBox('解读', d.reading, 'reading', true)}
						{/* 事件脉络:起因 ▸ 过程 ▸ 应验 */}
						{(d.trigger || d.procedure || d.outcome) ? (
							<div style={{ marginBottom: 18 }}>
								<div className="xuanshi-field-label" style={{ color: 'var(--ink-muted)', marginBottom: 8 }}>事件脉络</div>
								<div className="xuanshi-flow">
									{d.trigger ? <div className="xuanshi-flow-step is-trigger"><div className="xuanshi-flow-label">起因</div><div className="xuanshi-flow-text">{d.trigger}</div></div> : null}
									{d.procedure ? <div className="xuanshi-flow-step is-procedure"><div className="xuanshi-flow-label">过程</div><div className="xuanshi-flow-text">{d.procedure}</div></div> : null}
									{d.outcome ? <div className="xuanshi-flow-step is-outcome"><div className="xuanshi-flow-label">应验</div><div className="xuanshi-flow-text">{d.outcome}</div></div> : null}
								</div>
							</div>
						) : null}
						{/* 版本风险(折叠) */}
						{d.version_risk ? (
							<details style={{ marginBottom: 16 }}>
								<summary style={{ fontSize: 13, color: 'var(--ink-muted)', cursor: 'pointer' }}>⚠ 版本风险与异文</summary>
								<div style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.75, color: 'var(--ink-soft)', fontFamily: 'var(--xs-serif)' }}>{d.version_risk}</div>
							</details>
						) : null}
						{/* 排盘联动(Horosa 独有) */}
						{(() => {
							const rd = this.props.onChartLink ? resolveChartDate(d) : null;
							if (!rd) { return null; }
							return (
								<div style={{ marginTop: 6, marginBottom: 16 }}>
									<div className="xuanshi-hint" style={{ marginTop: 0, marginBottom: 8 }}>{rd.exact ? `公历 ${rd.md}` : `此事${d.period ? `「${d.period}」` : ''}——按 ${rd.disp} 正午起盘`} · 地点按朝代都城近似</div>
									<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
										<span className="xuanshi-btn is-primary" onClick={() => this.props.onChartLink(d, 'astrochart')}>排此时 · 占星盘</span>
										<span className="xuanshi-btn" onClick={() => this.props.onChartLink(d, 'guolao')}>排此时 · 七政四余</span>
										<span className="xuanshi-btn" onClick={() => this.props.onChartLink(d, 'planetarium')}>此时此地 · 天文馆</span>
									</div>
								</div>
							);
						})()}
						{/* 同朝代 / 同史书 */}
						{(sameDyn.length || sameHist.length) ? (
							<div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', gap: 24 }}>
								{relList(`同朝代 · ${d.dynasty || ''}`, sameDyn)}
								{relList(`《${d.history || ''}》同史`, sameHist)}
							</div>
						) : null}
					</div>

					{/* 右栏 meta */}
					<aside style={{ minWidth: 0 }}>
						<span className="xuanshi-link" onClick={() => this.setState({ selected: null })}>← 返回列表</span>
						{(d.operators || d.targets) ? (
							<div className="xuanshi-meta-card" style={{ marginTop: 12 }}>
								{d.operators ? <div style={{ marginBottom: d.targets ? 10 : 0 }}><div className="xuanshi-meta-label">施术者</div><div style={{ fontSize: 13.5, color: 'var(--ink)', fontFamily: 'var(--xs-serif)' }}>{d.operators}</div></div> : null}
								{d.targets ? <div><div className="xuanshi-meta-label">求问者 / 受影响者</div><div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{d.targets}</div></div> : null}
							</div>
						) : null}
						{techs.length ? (
							<div className="xuanshi-meta-card">
								<div className="xuanshi-meta-label">术类</div>
								<div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{techs.map((t) => <span className="xuanshi-chip is-jade" key={t}>{t}</span>)}</div>
							</div>
						) : null}
						<div className="xuanshi-meta-card">
							<div className="xuanshi-meta-label">元信息</div>
							{d.event_id ? <div className="xuanshi-meta-row"><span className="k">事件 ID</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{d.event_id}</span></div> : null}
							{d.history ? <div className="xuanshi-meta-row"><span className="k">史书</span>《{d.history}》</div> : null}
							{d.volume_no ? <div className="xuanshi-meta-row"><span className="k">卷次</span>{d.volume_no}</div> : null}
							{d.region ? <div className="xuanshi-meta-row"><span className="k">地域</span>{d.region}</div> : null}
							{d.evidence ? <div className="xuanshi-meta-row"><span className="k">证据强度</span>{d.evidence}</div> : null}
							{d.cross_ref ? <div className="xuanshi-meta-row"><span className="k">互见</span>{d.cross_ref}</div> : null}
						</div>
					</aside>
				</div>
			</div>
		);
	}

	// 富翻页:首页 / 上一页 / 窗口页码 / 下一页 / 末页
	renderPager() {
		const { page, pages } = this.state;
		if (pages <= 1) { return null; }
		const go = (p) => this.setState({ page: p }, () => { this.load(); });
		const from = Math.max(1, page - 2);
		const to = Math.min(pages, page + 2);
		const nums = [];
		for (let p = from; p <= to; p++) { nums.push(p); }
		return (
			<div className="xuanshi-evpager">
				{page > 1 ? <span className="xuanshi-chip is-ink" onClick={() => go(1)}>« 首页</span> : null}
				{page > 1 ? <span className="xuanshi-chip is-ink" onClick={() => go(page - 1)}>‹ 上一页</span> : null}
				{nums.map((p) => (
					<span key={p} className={`xuanshi-chip ${p === page ? 'is-vermilion' : 'is-ink'}`} onClick={() => go(p)}>{p}</span>
				))}
				{page < pages ? <span className="xuanshi-chip is-ink" onClick={() => go(page + 1)}>下一页 ›</span> : null}
				{page < pages ? <span className="xuanshi-chip is-ink" onClick={() => go(pages)}>末页 »</span> : null}
			</div>
		);
	}

	render() {
		if (this.state.selected) { return this.renderDetail(); }
		const { items, total, page, pages, loading, err, meta, density, tradition, dynasty, history } = this.state;
		const isYezai = tradition === '野载';
		const stats = (meta && meta.stats) || {};
		const tabs = (meta && meta.tradition_tabs) || [{ key: '正史', label: '正史玄学', count: 0 }, { key: '野载', label: '野载玄学', count: 0 }];
		const allDyn = (meta && meta.all_dynasties) || [];
		const selDynObj = allDyn.find((d) => d.name === dynasty);
		const subCap = isYezai ? 40 : 999;
		return (
			<div>
				{/* 面包屑 */}
				<div className="xuanshi-crumbs">
					<span className="xuanshi-crumb" onClick={() => this.props.onHome && this.props.onHome()}>首页</span>
					<span className="xuanshi-crumb-sep">/</span>
					<span>玄学万象</span>
				</div>

				{/* Hero + 统计 + 引导 */}
				<h1 className="xuanshi-display is-hero" style={{ fontSize: 'clamp(26px,3.4vw,38px)' }}>玄学万象</h1>
				<div className="xuanshi-stat-sub" style={{ marginTop: 8, fontSize: 13 }}>
					<b style={{ color: 'var(--vermilion)' }}>{(stats.total || total || 0).toLocaleString()}</b> 条事件
					· <b style={{ color: 'var(--jade)' }}>{(stats.translated || 0).toLocaleString()}</b> 条已译白话
					{isYezai
						? <> · 跨 <b>{stats.dynasties || 0}</b> 类语料 · <b>{stats.histories || 0}</b> 部典籍</>
						: <> · 跨 <b>{stats.dynasties || 0}</b> 朝代 · <b>{stats.histories || 0}</b> 部正史</>}
				</div>
				<div className="xuanshi-section-sub" style={{ margin: '10px 0 18px' }}>
					占卜 · 占梦 · 相术 · 星占 · 道术 · 僧术 · 堪舆 · 六壬 · 遁甲 · 神霄。<span style={{ color: 'var(--vermilion)' }}>点条目查看详细。</span>
				</div>

				{/* 传统切换 + 旁注 */}
				<div className="xuanshi-trad-tabs">
					{tabs.map((t) => (
						<span key={t.key} className={`xuanshi-trad-tab${tradition === t.key ? ' is-active' : ''}`} onClick={() => this.setFilter({ tradition: t.key })}>
							{t.label} <span className="xuanshi-trad-n">{(t.count || 0).toLocaleString()}</span>
						</span>
					))}
					<span className="xuanshi-trad-note">{isYezai ? '志怪 · 笔记 · 野史 · 道经 · 释藏 · 占书' : '二十四史天象与方术'}</span>
				</div>

				{/* 朝代游历 / 语料分类 */}
				<div className="xuanshi-facet-row" style={{ gridTemplateColumns: 'auto 1fr', marginBottom: 12 }}>
					<span className="xuanshi-facet-key" style={{ textAlign: 'left', paddingTop: 5 }}>{isYezai ? '语料分类' : '朝代游历'}</span>
					<div className="xuanshi-facet-chips">
						<span className={`chip${!dynasty ? ' chip-vermilion' : ''}`} style={{ cursor: 'pointer' }} onClick={() => this.setFilter({ dynasty: '', history: '' })}>全部 · {(stats.total || 0).toLocaleString()}</span>
						{allDyn.map((d) => (
							<span key={d.name} className={dynasty === d.name ? 'chip chip-vermilion' : `chip chip-dyn chip-dyn-${dynClass(d.name)}`} style={{ cursor: 'pointer' }} onClick={() => this.setFilter({ dynasty: d.name, history: '' })}>
								{d.icon ? d.icon + ' ' : ''}{d.name} · {d.count}
							</span>
						))}
					</div>
				</div>

				{/* 当前朝代的史书 / 典籍细分 */}
				{selDynObj && selDynObj.histories && selDynObj.histories.length > 1 ? (
					<div className="xuanshi-facet-row" style={{ gridTemplateColumns: 'auto 1fr', marginBottom: 14, paddingLeft: 10, borderLeft: '2px solid var(--line-soft)' }}>
						<span className="xuanshi-facet-key" style={{ textAlign: 'left', paddingTop: 5 }}>{isYezai ? '典籍' : '史书'}</span>
						<div className="xuanshi-facet-chips">
							<span className={`chip${!history ? ' chip-jade' : ''}`} style={{ cursor: 'pointer' }} onClick={() => this.setFilter({ history: '' })}>全部 · {selDynObj.count}</span>
							{selDynObj.histories.slice(0, subCap).map((h) => (
								<span key={h.name} className={`chip${history === h.name ? ' chip-jade' : ''}`} style={{ cursor: 'pointer' }} onClick={() => this.setFilter({ history: h.name })}>《{h.name}》· {h.count}</span>
							))}
							{selDynObj.histories.length > subCap ? <span className="xuanshi-stat-sub">…等 {selDynObj.histories.length} 部(用搜索框检索其余)</span> : null}
						</div>
					</div>
				) : null}

				{/* 搜索框 */}
				<div style={{ margin: '14px 0' }}>
					<Input.Search placeholder="搜索标题、原文、白话译文、人物、术类…" allowClear enterButton="搜索" size="middle" style={{ maxWidth: 520 }}
						defaultValue={this.state.q} key={`q-${tradition}-${dynasty}-${history}`}
						onSearch={(v) => this.setFilter({ q: v })} />
				</div>

				{/* 计数 + 密度切换 + 页码 */}
				<div className="xuanshi-evbar">
					<span className="xuanshi-stat-sub" style={{ fontSize: 12.5 }}>
						共 <b style={{ color: 'var(--ink)' }}>{(total || 0).toLocaleString()}</b> 条 · <b style={{ color: 'var(--ink)' }}>{tradition}玄学</b>
						{dynasty ? <> · {isYezai ? '语料「' : '朝代「'}<b style={{ color: 'var(--ink)' }}>{dynasty}</b>」</> : null}
						{history ? <> · {isYezai ? '典籍《' : '史书《'}<b style={{ color: 'var(--ink)' }}>{history}</b>》</> : null}
						{this.state.q ? <> · 搜索「<b style={{ color: 'var(--ink)' }}>{this.state.q}</b>」</> : null}
					</span>
					<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
						<div className="xuanshi-density">
							<span className={`xuanshi-density-btn${density === 'compact' ? ' is-active' : ''}`} title="密:仅标题与朝代" onClick={() => this.setDensity('compact')}>密</span>
							<span className={`xuanshi-density-btn${density === 'medium' ? ' is-active' : ''}`} title="中:含两行白话摘要" onClick={() => this.setDensity('medium')}>中</span>
							<span className={`xuanshi-density-btn${density === 'spacious' ? ' is-active' : ''}`} title="摘:白话译文完整展开" onClick={() => this.setDensity('spacious')}>摘</span>
						</div>
						{pages > 1 ? <span className="xuanshi-stat-sub" style={{ fontSize: 12 }}>第 <b style={{ color: 'var(--ink)' }}>{page}</b> / {pages} 页</span> : null}
					</div>
				</div>

				{/* 事件列表(密度感知) */}
				{loading ? <div className="xuanshi-center"><Spin tip="检索…" /></div> : err ? (
					<div className="xuanshi-center"><Empty description={`载入失败:${err}`} /><span className="xuanshi-link" onClick={() => this.load()}>重试</span></div>
				) : !items.length ? <div className="xuanshi-center"><Empty description="未找到符合条件的事件" /></div> : (
					<div className={`xuanshi-evlist is-${density}`}>
						{items.map((e) => (
							<div className="xuanshi-evrow" key={e.event_id} onClick={() => this.openDetail(e.event_id)}>
								<div className="xuanshi-evrow-chips">
									{e.dynasty ? <span className={`chip chip-dyn chip-dyn-${dynClass(e.dynasty)}`}>{e.dynasty}</span> : null}
									{e.history ? <span className="xuanshi-chip is-ink">《{e.history}》{e.volume_no ? `卷${e.volume_no}` : ''}</span> : null}
									{e.period ? <span className="xuanshi-chip">{e.period}</span> : null}
									{splitList(e.techniques)[0] ? <span className="xuanshi-chip is-jade">{splitList(e.techniques)[0]}</span> : null}
									{e.evidence === '高' ? <span className="xuanshi-chip is-gold">高证据</span> : null}
									<span className="xuanshi-evrow-id">{e.event_id}</span>
								</div>
								<div className="xuanshi-evrow-title">
									<span className="xuanshi-evrow-dot" aria-hidden="true" />
									{e.title || '—'}
									{e.history ? <span className="xuanshi-evrow-src">《{e.history}》{e.volume_no ? `卷${e.volume_no}` : ''}</span> : null}
								</div>
								{(e.modern_text || e.original_text) ? (
									<p className="xuanshi-evrow-sum">{e.modern_text ? collapseSoftBreaks(e.modern_text) : `${(e.original_text || '').slice(0, 200)}…`}</p>
								) : null}
							</div>
						))}
					</div>
				)}

				{this.renderPager()}
			</div>
		);
	}
}
