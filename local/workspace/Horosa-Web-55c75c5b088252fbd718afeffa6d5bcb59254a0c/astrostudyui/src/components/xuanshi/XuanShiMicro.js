import React from 'react';
import { Spin, Empty, Select, Input } from 'antd';
import { fetchMicrochronology, fetchMicrochronologyDetail } from '../../services/xuanshi';
import { collapseSoftBreaks } from './xuanshiDate';

// horosa_xuanshi_longtext_ondemand_v1:本页只渲染前 RENDER_CAP 条,故只向后端要这么多条
// (后端 limit;summary 仍按全部命中行统计,页头计数与「仅显示前 N 条」提示口径分毫不变)。
// 长文本(原文/白话)只随下发行走;超出部分若将来需要,经 fetchMicrochronologyDetail 按 event_id 取回。
const RENDER_CAP = 300;

// 天象微年表 —— 对齐标准版 参考天象微年表页:十年期事件密度柱状图(点柱筛选)+ 左栏按史书/按征兆类型
// + 右栏事件列表(干支/公历/征兆/《史书》卷 chips + 原文 + 政治军事解读)。数据来自星象大典公开事件库。
export default class XuanShiMicro extends React.Component {
	constructor(props) {
		super(props);
		const f = (props.ui && props.ui.micro) || {};
		this.state = { history: f.history || '', omen: f.omen || '', decade: f.decade != null ? f.decade : null, events: [], summary: null, loading: false, err: '', hover: null, hoverPos: null };
	}

	// 悬停详情卡(对齐标准版:日期 / 原文 / 白话译文 / 来源 / 事件ID)
	showHover(e, ev) {
		const rect = e.currentTarget.getBoundingClientRect();
		const W = 360;
		let left = rect.right + 12;
		if (left + W > window.innerWidth - 12) { left = rect.left - W - 12; }
		if (left < 12) { left = 12; }
		const top = Math.min(Math.max(12, rect.top), window.innerHeight - 240);
		this.setState({ hover: ev, hoverPos: { left, top } });
		this.ensureEventText(ev);
	}

	// horosa_xuanshi_longtext_ondemand_v1:被 limit 截断的行不带长文本(original 字段缺席,
	// 非 null)——悬停时按 event_id 补取一次并就地回填。当前 limit == RENDER_CAP,渲染行恒自带
	// 正文,本路径不触发;它保证的是「正文只会迟到,不会丢」在渲染上限抬高时依然成立。
	ensureEventText(ev) {
		if (!ev || !ev.event_id || ev.original !== undefined) { return; }
		fetchMicrochronologyDetail(ev.event_id).then((d) => {
			if (!d || !d.event_id) { return; }
			ev.original = d.original;
			ev.interpretation = ev.interpretation || d.interpretation || '';
			if (this.state.hover === ev) { this.forceUpdate(); }
		}).catch(() => {});
	}
	hideHover() { this.setState({ hover: null }); }

	componentDidMount() { this.load(); }

	persist() { if (this.props.onPersist) { this.props.onPersist('micro', { history: this.state.history, omen: this.state.omen, decade: this.state.decade }); } }

	async load() {
		this.setState({ loading: true, err: '' });
		try {
			const r = await fetchMicrochronology({
				history: this.state.history || undefined,
				omen_type: this.state.omen || undefined,
				decade: this.state.decade != null ? this.state.decade : undefined,
				limit: RENDER_CAP, // horosa_xuanshi_longtext_ondemand_v1
			});
			this.setState({ events: r.events || [], summary: r.summary || null, loading: false });
		} catch (e) { this.setState({ loading: false, err: `${e && e.message ? e.message : e}` }); }
		this.persist();
	}

	setFilter(patch) { this.setState(patch, () => this.load()); }

	render() {
		const { events, summary, loading, err, history, omen, decade } = this.state;
		const sm = summary || {};
		const byDecade = sm.by_decade || [];
		const byHistory = sm.by_history || [];
		const byOmen = sm.by_omen || [];
		const maxDec = byDecade.reduce((m, d) => Math.max(m, d[1] || 0), 1);
		const histOpts = byHistory.map((d) => ({ value: Array.isArray(d) ? d[0] : d, label: `《${Array.isArray(d) ? d[0] : d}》` }));
		const isFiltered = !!(history || omen || decade != null);
		return (
			<div>
				<div className="xuanshi-crumbs">
					<span className="xuanshi-crumb" onClick={() => this.props.onHome && this.props.onHome()}>首页</span>
					<span className="xuanshi-crumb-sep">/</span><span>图谱</span>
					<span className="xuanshi-crumb-sep">/</span><span>天象微年表</span>
				</div>
				<div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
					<div>
						<h1 className="xuanshi-display is-hero" style={{ fontSize: 'clamp(26px,3.4vw,38px)' }}>天象微年表</h1>
						<div className="xuanshi-section-sub" style={{ margin: '8px 0 0' }}>
							来自星象大典公开事件库；当前筛选 <b style={{ color: 'var(--ink)' }}>{(sm.total || 0).toLocaleString()}</b> 条事件，其中 <b style={{ color: 'var(--ink)' }}>{(sm.with_year || 0).toLocaleString()}</b> 条已有公历年份。
						</div>
					</div>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
						<Select allowClear showSearch size="small" placeholder="全部史书" style={{ minWidth: 150 }} value={history || undefined}
							options={histOpts} onChange={(v) => this.setFilter({ history: v || '' })} filterOption={(i, o) => (o.label || '').indexOf(i) >= 0} />
						<Input.Search placeholder="征兆筛选(如:日食 / 彗 / 流星)" allowClear size="small" style={{ width: 200 }} defaultValue={omen} key={`mo-${isFiltered}`} onSearch={(v) => this.setFilter({ omen: v || '' })} />
						{isFiltered ? <span className="xuanshi-link" style={{ fontSize: 12 }} onClick={() => this.setState({ history: '', omen: '', decade: null }, () => this.load())}>清空</span> : null}
					</div>
				</div>

				{/* 十年期事件密度 */}
				<div className="xuanshi-card" style={{ margin: '18px 0', padding: '16px 18px' }}>
					<div className="xuanshi-stat-label" style={{ textAlign: 'left', marginBottom: 12 }}>十年期事件密度{decade != null ? `(选中 ${decade}s)` : ''}</div>
					<div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 180, overflowX: 'auto' }}>
						{byDecade.map((d) => {
							const sel = decade === d[0];
							return (
								<div key={d[0]} title={`${d[0]}s · ${d[1]} 条`} onClick={() => this.setFilter({ decade: sel ? null : d[0] })}
									style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', flex: '0 0 22px', cursor: 'pointer' }}>
									<div style={{ width: '100%', height: `${Math.round((d[1] / maxDec) * 160)}px`, borderRadius: '2px 2px 0 0', background: sel ? 'var(--vermilion)' : 'linear-gradient(180deg, var(--vermilion-soft), var(--vermilion))', opacity: sel ? 1 : 0.85 }} />
									<div style={{ fontSize: 9, color: 'var(--ink-muted)', marginTop: 3, transform: 'rotate(45deg)', transformOrigin: 'left', whiteSpace: 'nowrap' }}>{d[0]}</div>
								</div>
							);
						})}
					</div>
				</div>

				<div className="xuanshi-micro-grid">
					{/* 左栏 */}
					<aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
						<div className="xuanshi-card">
							<div className="xuanshi-stat-label" style={{ textAlign: 'left', marginBottom: 8 }}>按史书</div>
							<div className="xuanshi-celcol-list" style={{ maxHeight: 260 }}>
								{byHistory.map((d) => {
									const name = Array.isArray(d) ? d[0] : d; const n = Array.isArray(d) ? d[1] : '';
									return <div key={name} className={`xuanshi-celcol-row${history === name ? ' is-active' : ''}`} onClick={() => this.setFilter({ history: history === name ? '' : name })}><span className="xuanshi-celcol-name">《{name}》</span><span className="xuanshi-celcol-n">{(n || 0).toLocaleString()}</span></div>;
								})}
							</div>
						</div>
						<div className="xuanshi-card">
							<div className="xuanshi-stat-label" style={{ textAlign: 'left', marginBottom: 8 }}>按征兆类型</div>
							<div className="xuanshi-celcol-list" style={{ maxHeight: 260 }}>
								{byOmen.map((d) => {
									const name = Array.isArray(d) ? d[0] : d; const n = Array.isArray(d) ? d[1] : '';
									return <div key={name} className={`xuanshi-celcol-row${omen === name ? ' is-active' : ''}`} onClick={() => this.setFilter({ omen: omen === name ? '' : name })}><span className="xuanshi-celcol-name">{name}</span><span className="xuanshi-celcol-n">{(n || 0).toLocaleString()}</span></div>;
								})}
							</div>
						</div>
					</aside>

					{/* 右栏事件列表 */}
					<div className="xuanshi-evlist is-spacious">
						{loading ? <div className="xuanshi-center"><Spin tip="载入…" /></div> : err ? (
							<div className="xuanshi-center"><Empty description={`载入失败:${err}`} /><span className="xuanshi-link" onClick={() => this.load()}>重试</span></div>
						) : !events.length ? <div className="xuanshi-center"><Empty description="无匹配天象" /></div> : (
							<>
								{events.slice(0, RENDER_CAP).map((e, i) => (
									<div className="xuanshi-evrow" key={`mev-${i}`} style={{ cursor: 'help' }}
										onMouseEnter={(ev) => this.showHover(ev, e)} onMouseLeave={() => this.hideHover()}>
										<div className="xuanshi-evrow-chips">
											{e.year != null ? <span className="xuanshi-chip is-vermilion" style={{ fontVariantNumeric: 'tabular-nums' }}>公元 {e.year}</span> : null}
											{e.modern_date_disp ? <span className="xuanshi-chip is-gold">{e.modern_date_disp}</span> : (e.era ? <span className="xuanshi-chip is-gold">{e.era}</span> : null)}
											{e.omen ? <span className="xuanshi-chip is-jade">{e.omen}</span> : null}
											{e.history ? <span className="xuanshi-chip is-ink">《{e.history}》{e.volume_no ? `卷${e.volume_no}` : ''}</span> : null}
										</div>
										<div className="xuanshi-evrow-title" style={{ whiteSpace: 'normal' }}>{e.date_phrase || e.title || '—'}</div>
										{e.original ? <p className="xuanshi-evrow-sum" style={{ fontFamily: 'var(--xs-serif)' }}>{collapseSoftBreaks(e.original)}</p> : null}
										{e.interpretation ? <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--jade)' }}>→ {e.interpretation}</p> : null}
									</div>
								))}
								{/* horosa_xuanshi_longtext_ondemand_v1:events 已按 limit 截断,命中总数改读 summary.total(与旧的 events.length 同值) */}
								{(sm.total || 0) > RENDER_CAP ? <div style={{ padding: '12px 18px', fontSize: 12, color: 'var(--ink-muted)', textAlign: 'center' }}>仅显示前 300 条;如需更细可结合左侧筛选。</div> : null}
							</>
						)}
					</div>
				</div>

				{/* 悬停详情卡(对齐标准版:日期 / 原文 / 白话译文 / 来源 / 事件ID) */}
				{this.state.hover ? (
					<div className="xuanshi-micro-hover" style={this.state.hoverPos ? { left: this.state.hoverPos.left, top: this.state.hoverPos.top } : undefined}>
						{this.state.hover.omen ? <span className="xuanshi-chip is-jade" style={{ marginBottom: 8, display: 'inline-block' }}>{this.state.hover.omen}</span> : null}
						<div className="xuanshi-mh-field"><div className="k">日期</div><div className="v">{this.state.hover.date_phrase || '—'}{this.state.hover.modern_date_disp ? ` · 公历 ${this.state.hover.modern_date_disp}` : ''}</div></div>
						{this.state.hover.original ? <div className="xuanshi-mh-field"><div className="k">原文</div><div className="v" style={{ fontFamily: 'var(--xs-serif)' }}>{collapseSoftBreaks(this.state.hover.original)}</div></div> : null}
						{this.state.hover.interpretation ? <div className="xuanshi-mh-field"><div className="k">白话译文</div><div className="v" style={{ borderLeft: '3px solid var(--jade)', paddingLeft: 8 }}>{collapseSoftBreaks(this.state.hover.interpretation)}</div></div> : null}
						<div className="xuanshi-mh-meta">{this.state.hover.history ? `来源 《${this.state.hover.history}》` : ''}{this.state.hover.event_id ? `${this.state.hover.history ? ' · ' : ''}事件ID ${this.state.hover.event_id}` : ''}</div>
					</div>
				) : null}
			</div>
		);
	}
}
