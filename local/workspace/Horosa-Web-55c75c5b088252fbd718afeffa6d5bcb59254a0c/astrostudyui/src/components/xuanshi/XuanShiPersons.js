import React from 'react';
import { Spin, Empty, InputNumber } from 'antd';
import * as d3 from 'd3';
import { fetchPersonsGraph } from '../../services/xuanshi';

// 人物关系图 —— 照搬标准版 参考人物关系图页 的 d3 力导图:
// 实时 forceSimulation(link/charge/center/collide)+ 节点可拖拽 + 滚轮缩放/平移
// + 圆大小 ∝ √出现频次、按频次分三档色(朱/玉/金)+ 始终显示姓名(描边可读)+ 点节点高亮其共现。
const W = 1400, H = 800;

export default class XuanShiPersons extends React.Component {
	constructor(props) {
		super(props);
		this.state = { count: 0, edgeCount: 0, loading: false, err: '', topN: 100, minWeight: 3 };
		this._svgRef = React.createRef();
	}

	componentDidMount() { this.load(); }
	componentWillUnmount() { if (this._sim) { this._sim.stop(); } }

	async load() {
		const __seq = (this._loadSeq = (this._loadSeq || 0) + 1);   // [Q-496/T-458] 序号守卫:旧响应不覆盖新条件
		// [Q-489/T-451] 记下「本次取数实际用的门槛」:页顶说明行此前读输入框当前值,
		// 改了数字还没点「应用」就先变了文案(图还是旧的)。
		const appliedMinWeight = this.state.minWeight;
		this.setState({ loading: true, err: '' });
		try {
			const r = await fetchPersonsGraph({ top_n: this.state.topN, min_weight: appliedMinWeight }); if(__seq !== this._loadSeq){ return; }
			const nodes = (r.nodes || []).map((n) => ({ ...n }));
			const edges = (r.edges || r.links || []).map((e) => ({ ...e }));
			this.setState({ count: nodes.length, edgeCount: edges.length, appliedMinWeight, loading: false }, () => {
				// 等 DOM 落地再让 d3 接管(svg ref 此时确保存在)
				requestAnimationFrame(() => {
					try { this.renderGraph(nodes, edges); } catch (ge) { this.setState({ err: `图谱渲染:${ge && ge.message ? ge.message : ge}` }); }
				});
			});
		} catch (e) { this.setState({ loading: false, err: `${e && e.message ? e.message : e}` }); }
	}

	apply() { if (this._sim) { this._sim.stop(); } this.load(); }

	// 照搬标准版 d3 力导图实现
	renderGraph(rawNodes, rawEdges) {
		const el = this._svgRef.current;
		if (!el) { return; }
		if (this._sim) { this._sim.stop(); }
		const svg = d3.select(el);
		svg.selectAll('*').remove();
		svg.on('.zoom', null);
		const root = svg.append('g');
		svg.call(d3.zoom().scaleExtent([0.2, 4]).on('zoom', (e) => root.attr('transform', e.transform)));

		const nodes = rawNodes.map((n) => ({ ...n }));
		// 仅保留两端都在节点集内的边(top_n 截断后,边可能指向被裁掉的节点 → d3.forceLink 会抛 missing)
		const nodeIds = new Set(nodes.map((n) => n.id));
		const links = rawEdges.map((e) => ({ ...e })).filter((e) => {
			const s = (e.source && e.source.id) || e.source;
			const tg = (e.target && e.target.id) || e.target;
			return nodeIds.has(s) && nodeIds.has(tg);
		});
		if (!nodes.length) { return; }
		const maxW = Math.max(...nodes.map((n) => n.weight || 1), 1);
		const maxE = Math.max(...links.map((l) => l.weight || 1), 1);
		const r = (n) => 4 + Math.sqrt((n.weight || 1) / maxW) * 22;

		const sim = d3.forceSimulation(nodes)
			.force('link', d3.forceLink(links).id((d) => d.id).distance((d) => 60 + 220 / ((d.weight || 1) + 1)).strength((d) => Math.min(1, (d.weight || 1) / maxE * 1.2)))
			.force('charge', d3.forceManyBody().strength(-220))
			.force('center', d3.forceCenter(W / 2, H / 2))
			.force('collide', d3.forceCollide().radius((d) => r(d) + 8));
		this._sim = sim;

		const link = root.append('g').selectAll('line').data(links).enter().append('line')
			.attr('stroke', 'var(--line)')
			.attr('stroke-opacity', 0.6)
			.attr('stroke-width', (d) => 0.6 + Math.sqrt((d.weight || 1) / maxE) * 4);

		const node = root.append('g').selectAll('g').data(nodes).enter().append('g')
			.call(d3.drag()
				.on('start', (e, d) => { if (!e.active) { sim.alphaTarget(0.3).restart(); } d.fx = d.x; d.fy = d.y; })
				.on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
				.on('end', (e, d) => { if (!e.active) { sim.alphaTarget(0); } d.fx = null; d.fy = null; }));

		node.append('circle')
			.attr('r', r)
			.attr('fill', (d) => ((d.weight || 1) > maxW * 0.5 ? 'var(--vermilion)' : ((d.weight || 1) > maxW * 0.2 ? 'var(--jade)' : 'var(--gold)')))
			.attr('stroke', 'var(--paper-card)')
			.attr('stroke-width', 2)
			.style('cursor', 'pointer')
			.on('click', (e, d) => { if (this.props.onOpenPerson) { this.props.onOpenPerson(d.id); } })
			.on('mouseover', function () { d3.select(this).attr('stroke', 'var(--vermilion)').attr('stroke-width', 3); })
			.on('mouseout', function () { d3.select(this).attr('stroke', 'var(--paper-card)').attr('stroke-width', 2); });

		node.append('text')
			.attr('dy', (d) => r(d) + 14)
			.attr('text-anchor', 'middle')
			.attr('font-size', (d) => 10 + Math.min(4, (d.weight || 1) / maxW * 6))
			.attr('fill', 'var(--ink)')
			.attr('font-family', "'Noto Serif SC', serif")
			.style('paint-order', 'stroke')
			.style('stroke', 'var(--paper)')
			.style('stroke-width', '3px')
			.text((d) => d.id);

		// [Q-489/T-451] weight 是「该人所有达门槛的共现边权之和」(加权共现度),不是全库出现次数 ——
		// 门槛一改这个数就变,标成「全库出现 N 次」会被当成人物的出场频次。
		node.append('title').text((d) => `${d.id} · 加权共现度 ${d.weight || 0}(其达门槛的共现边权之和,随「最小共现」变化)`);

		sim.on('tick', () => {
			link.attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y)
				.attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
			node.attr('transform', (d) => `translate(${d.x},${d.y})`);
		});
	}

	render() {
		const { count, edgeCount, loading, err, topN, minWeight, appliedMinWeight } = this.state;
		const shownMinWeight = appliedMinWeight === undefined || appliedMinWeight === null ? minWeight : appliedMinWeight;   // [Q-489/T-451] 说明行跟图走
		return (
			<div>
				<div className="xuanshi-crumbs">
					<span className="xuanshi-crumb" onClick={() => this.props.onHome && this.props.onHome()}>首页</span>
					<span className="xuanshi-crumb-sep">/</span><span>人物关系图</span>
				</div>
				<div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
					<div>
						<h1 className="xuanshi-display is-hero" style={{ fontSize: 'clamp(24px,calc(3 * var(--horosa-lvw, 1vw)),32px)' }}>人物关系图</h1>
						<div className="xuanshi-section-sub" style={{ margin: '6px 0 0' }}>
							<b style={{ color: 'var(--ink)' }}>{count}</b> 位人物 · <b style={{ color: 'var(--ink)' }}>{edgeCount}</b> 条共现边；当两人在同一事件记录中共同出现 ≥ {shownMinWeight} 次时连一条边;节点大小按加权共现度(其达门槛的边权之和)。
						</div>
					</div>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						<span className="xuanshi-stat-sub">人物数</span>
						<InputNumber size="small" min={20} max={200} value={topN} style={{ width: 72 }} onChange={(v) => this.setState({ topN: v || 100 })} />
						<span className="xuanshi-stat-sub">最小共现</span>
						<InputNumber size="small" min={1} max={20} value={minWeight} style={{ width: 60 }} onChange={(v) => this.setState({ minWeight: v || 1 })} />
						<span className="xuanshi-btn is-primary" onClick={() => this.apply()}>应用</span>
					</div>
				</div>

				<div className="xuanshi-card" style={{ padding: 8, marginTop: 16, overflow: 'hidden', position: 'relative' }}>
					{loading ? <div className="xuanshi-center" style={{ minHeight: 460 }}><Spin tip="布局图谱…" /></div> : err ? (
						<div className="xuanshi-center" style={{ minHeight: 460 }}><Empty description={`载入失败:${err}`} /><span className="xuanshi-link" onClick={() => this.load()}>重试</span></div>
					) : null}
					<svg ref={this._svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'calc(75 * var(--horosa-lvh, 1vh))', display: loading || err ? 'none' : 'block', cursor: 'grab', touchAction: 'none' }} />
				</div>
				<div className="xuanshi-stat-sub" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12 }}>
					<span>圆圈大小 = 此人在全库出现频次；线粗 = 两人共现次数。</span>
					<span>拖动节点 · 滚轮缩放 · 点击节点查看人物</span>
				</div>
			</div>
		);
	}
}
