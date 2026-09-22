import React from 'react';
import { Spin, Empty } from 'antd';
import { fetchTimeline } from '../../services/xuanshi';
import { gregYearShort } from './xuanshiDate';   // [Q-491] 公元前年份写法单源

// 朝代时间轴 —— 照搬 参考朝代时间轴页:顶部编年横向条带(柱按公历 span 定位、柱高∝事件数、时间刻度)
// + 朝代×术类 堆叠条 + 图例 + 右侧钻取面板。
const PALETTE = ['var(--vermilion)', 'var(--jade)', 'var(--gold)', '#8a7e6b', '#d99a6c', '#6c8a99', '#9a6c8a', '#6c9a73', '#a89060', '#7a8a6c', '#a07a8a', '#6c6c8a'];
const TICKS = [-1000, -500, 0, 500, 1000, 1500];

export default class XuanShiTimeline extends React.Component {
	constructor(props) {
		super(props);
		this.state = { data: null, loading: false, err: '', macro: null, drill: null, drillLoading: false };
	}

	componentDidMount() { this.load(); }

	async load() {
		const __seq = (this._loadSeq = (this._loadSeq || 0) + 1);   // [Q-496/T-458] 序号守卫:旧响应不覆盖新条件
		this.setState({ loading: true, err: '' });
		try { const r = await fetchTimeline({}); if(__seq !== this._loadSeq){ return; } this.setState({ data: r, loading: false }); }
		catch (e) { this.setState({ loading: false, err: `${e && e.message ? e.message : e}` }); }
	}

	async selectMacro(macro) {
		if (this.state.macro === macro) { this.setState({ macro: null, drill: null }); return; }
		this.setState({ macro, drill: null, drillLoading: true });
		try { const r = await fetchTimeline({ macro }); this.setState({ drill: r.drilldown || [], drillLoading: false }); }
		catch (e) { this.setState({ drillLoading: false }); }
	}

	render() {
		const { data, loading, err, macro, drill, drillLoading } = this.state;
		if (loading) { return <div className="xuanshi-center" style={{ minHeight: 400 }}><Spin tip="载入时间轴…" /></div>; }
		if (err) { return <div className="xuanshi-center"><Empty description={`载入失败:${err}`} /><span className="xuanshi-link" onClick={() => this.load()}>重试</span></div>; }
		if (!data) { return <div className="xuanshi-center"><Empty /></div>; }
		const series = data.series || [];
		const matrix = data.matrix || [];
		const techs = data.top_techs || [];
		const maxN = series.reduce((m, s) => Math.max(m, s.total || 0), 1);
		const firstYear = series.length ? series[0].span_start : 0;
		const lastYear = series.length ? series[series.length - 1].span_end : 1;
		const totalSpan = (lastYear - firstYear) || 1;

		return (
			<div>
				<div className="xuanshi-crumbs">
					<span className="xuanshi-crumb" onClick={() => this.props.onHome && this.props.onHome()}>首页</span>
					<span className="xuanshi-crumb-sep">/</span><span>图谱</span>
					<span className="xuanshi-crumb-sep">/</span><span>朝代时间轴</span>
				</div>
				<h1 className="xuanshi-display is-hero" style={{ fontSize: 'clamp(24px,calc(3 * var(--horosa-lvw, 1vw)),32px)' }}>朝代时间轴</h1>
				<div className="xuanshi-section-sub" style={{ margin: '6px 0 0' }}>
					<b style={{ color: 'var(--ink)' }}>{(data.total || 0).toLocaleString()}</b> 条玄学事件中,<b style={{ color: 'var(--ink)' }}>{(data.classified || 0).toLocaleString()}</b> 条已归入 <b style={{ color: 'var(--ink)' }}>{series.length}</b> 个大朝代;{(data.unclassified || 0).toLocaleString()} 条时间线索不足。点击某段直接钻取该朝代下的事件样本。
				</div>

				{/* 顶部编年横向条带 */}
				<div className="xuanshi-card" style={{ padding: 18, marginTop: 18 }}>
					<div style={{ position: 'relative', height: 280, overflowX: 'auto' }}>
						<div style={{ position: 'relative', height: '100%', minWidth: 1200 }}>
							{/* 时间刻度 */}
							{TICKS.map((tick) => {
								const left = ((tick - firstYear) / totalSpan) * 100;
								if (left < 0 || left > 100) { return null; }
								return (
									<div key={tick} style={{ position: 'absolute', top: 0, bottom: 0, left: `${left}%`, borderLeft: '1px solid var(--line-soft)' }}>
										<div style={{ position: 'absolute', top: -2, left: 4, fontSize: 10, color: 'var(--ink-muted)' }}>{gregYearShort(tick)}   /* [Q-491] 与柱标、卡片同一函数 */</div>
									</div>
								);
							})}
							{/* 朝代条 */}
							{series.map((s) => {
								const left = ((s.span_start - firstYear) / totalSpan) * 100;
								const width = ((s.span_end - s.span_start) / totalSpan) * 100;
								const height = Math.round(((s.total || 0) / maxN) * 200);
								const isActive = macro === s.macro;
								return (
									<div key={s.macro} className="group" title={`${s.macro}(${gregYearShort(s.span_start)}—${gregYearShort(s.span_end)}) ${s.total} 条`}   /* [Q-491] */
										onClick={() => this.selectMacro(s.macro)}
										style={{ position: 'absolute', bottom: 48, left: `${left}%`, width: `calc(${width}% - 2px)`, height, cursor: 'pointer' }}>
										<div style={{ height: '100%', borderRadius: '6px 6px 0 0', background: isActive ? 'var(--vermilion)' : 'linear-gradient(180deg, var(--vermilion-soft), var(--vermilion))', border: `1px solid ${isActive ? 'var(--vermilion)' : 'var(--vermilion-soft)'}` }}>
											<div style={{ fontSize: 10, color: 'var(--paper-card)', textAlign: 'center', paddingTop: 2, overflow: 'hidden', whiteSpace: 'nowrap' }}>{s.total}</div>
										</div>
										<div style={{ fontFamily: 'var(--xs-serif)', fontSize: 12, color: isActive ? 'var(--vermilion)' : 'var(--ink-soft)', marginTop: 4, textAlign: 'center', whiteSpace: 'nowrap' }}>{s.macro}</div>
										<div style={{ fontSize: 9, color: 'var(--ink-muted)', textAlign: 'center' }}>{gregYearShort(s.span_start)}–{gregYearShort(s.span_end)}</div>{/* [Q-491] 公元前写「前N」,与刻度一致 */}
									</div>
								);
							})}
						</div>
					</div>
					<div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-muted)', textAlign: 'center' }}>横坐标按公历,纵向高度=事件数;点击柱进入该朝代的事件样本。</div>
				</div>

				<div className="xuanshi-tl-grid">
					{/* 左:朝代×术类 堆叠条 */}
					<div className="xuanshi-card" style={{ padding: 18 }}>
						<h2 className="xuanshi-display is-h2" style={{ fontSize: 17, margin: '0 0 14px' }}>朝代 × 术类</h2>
						{matrix.map((row) => {
							const rowTotal = techs.reduce((acc, t) => acc + (row[t] || 0), 0) + (row['其他'] || 0);
							return (
								<div key={row.macro} style={{ marginBottom: 12 }}>
									<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
										<span className="xuanshi-link" style={{ fontFamily: 'var(--xs-serif)', fontSize: 13, color: 'var(--ink)' }} onClick={() => this.selectMacro(row.macro)}>{row.macro}</span>
										<span className="xuanshi-stat-sub" style={{ fontVariantNumeric: 'tabular-nums' }}>{rowTotal} 行</span>
									</div>
									<div style={{ display: 'flex', height: 12, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--line-soft)' }}>
										{techs.map((t, ti) => {
											const v = row[t] || 0;
											if (!v) { return null; }
											return <div key={t} title={`${t} · ${v}`} style={{ width: `${(v / rowTotal * 100).toFixed(2)}%`, background: PALETTE[ti % 12] }} />;
										})}
										{row['其他'] ? <div title={`其他 · ${row['其他']}`} style={{ width: `${(row['其他'] / rowTotal * 100).toFixed(2)}%`, background: 'var(--line)' }} /> : null}
									</div>
								</div>
							);
						})}
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16, fontSize: 11 }}>
							{techs.map((t, ti) => (
								<span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ink-soft)' }}>
									<span style={{ width: 10, height: 10, borderRadius: 2, background: PALETTE[ti % 12] }} />{t}
								</span>
							))}
						</div>
					</div>

					{/* 右:钻取面板 */}
					<div>
						{macro ? (
							<>
								<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
									<h2 className="xuanshi-display is-h2" style={{ fontSize: 17, margin: 0 }}>钻取:{macro}</h2>
									<div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
										{series.map((s) => <span key={s.macro} className={`xuanshi-chip ${s.macro === macro ? 'is-vermilion' : 'is-ink'}`} style={{ cursor: 'pointer' }} onClick={() => this.selectMacro(s.macro)}>{s.macro}</span>)}
									</div>
								</div>
								{drillLoading ? <div className="xuanshi-center" style={{ minHeight: 120 }}><Spin tip="载入…" /></div> : (drill && drill.length) ? (
									<>
										<div className="xuanshi-evlist">
											{drill.map((r) => (
												<div className="xuanshi-evrow" key={r.event_id} onClick={() => this.props.onOpenEvent && this.props.onOpenEvent(r.event_id)}>
													<div className="xuanshi-evrow-chips">
														{r.tradition ? <span className="xuanshi-chip is-jade">{r.tradition}</span> : null}
														{r.history ? <span className="xuanshi-chip is-ink">《{r.history}》{r.volume_no ? `卷${r.volume_no}` : ''}</span> : null}
														{r.period ? <span className="xuanshi-chip">{r.period}</span> : null}
														{r.evidence ? <span className={`xuanshi-chip ${r.evidence === '高' ? 'is-gold' : 'is-ink'}`}>证 {r.evidence}</span> : null}
														{r.techniques ? <span className="xuanshi-evrow-id">{`${r.techniques}`.split(/[;,、，]/)[0]}</span> : null}
													</div>
													<div className="xuanshi-evrow-title" style={{ whiteSpace: 'normal' }}>{r.title || r.title_field || '—'}</div>
												</div>
											))}
										</div>
										<div className="xuanshi-stat-sub" style={{ marginTop: 8, fontSize: 12 }}>前 {drill.length} 条;可从事件页继续查看原文、译文与相关条目。</div>
									</>
								) : <div className="xuanshi-card" style={{ color: 'var(--ink-muted)' }}>该朝代下暂无可抽样的行。</div>}
							</>
						) : <div className="xuanshi-card" style={{ color: 'var(--ink-muted)', padding: 24 }}>点击左侧任一朝代柱,或在朝代标签上点击,进入该朝代的事件样本。</div>}
					</div>
				</div>
			</div>
		);
	}
}
