import React from 'react';
import { Spin, Empty, InputNumber } from 'antd';
import * as d3 from 'd3';
import { fetchPersonsGraph } from '../../services/xuanshi';
import { getDeclaredZoom } from '../../utils/zoomDomain';

// 人物关系图 —— 照搬标准版 参考人物关系图页 的 d3 力导图:
// 实时 forceSimulation(link/charge/center/collide)+ 节点可拖拽 + 滚轮缩放/平移
// + 圆大小 ∝ √出现频次、按频次分三档色(朱/玉/金)+ 始终显示姓名(描边可读)+ 点节点高亮其共现。
const W = 1400, H = 800;
const FIT_PAD = 40;

// 纯函数:名字字号随视野缩放补偿(viewBox 坐标)。视野缩小(k < 1)时按 1 / k 放回,保持缩放前的视觉大小;
// 放大档(z > 1)另保视觉 ≥ 9 px(vbScale = svg 布局宽 / viewBox 宽,与 meet 同口径)。k ≥ 1 且 1 档时恒为原字号(逐像素不变)。
export const PERSON_LABEL_FLOOR_PX = 9;
export function personLabelSize(baseFs, k, vbScale, z){
	const kk = Number(k) > 0 ? Number(k) : 1;
	let fs = baseFs / Math.min(1, kk);
	const zz = Number(z) > 0 ? Number(z) : 1;
	const vs = Number(vbScale) > 0 ? Number(vbScale) : 1;
	if(zz > 1.001){ fs = Math.max(fs, PERSON_LABEL_FLOOR_PX / (vs * zz * kk)); }
	return Math.round(fs * 100) / 100;
}

// 纯函数:节点包围盒(含圆半径与名字)→ 让整张图落进 W × H 视野的平移 + 缩放(不放大到 1 以上,不小于缩放下限)
export function fitTransformFor(bbox, w = W, h = H, pad = FIT_PAD, minK = 0.2){
	if(!bbox || !(bbox.x1 > bbox.x0) || !(bbox.y1 > bbox.y0)){ return null; }
	const bw = bbox.x1 - bbox.x0;
	const bh = bbox.y1 - bbox.y0;
	const k = Math.max(minK, Math.min(1, (w - 2 * pad) / bw, (h - 2 * pad) / bh));
	const cx = (bbox.x0 + bbox.x1) / 2;
	const cy = (bbox.y0 + bbox.y1) / 2;
	return { k, x: w / 2 - k * cx, y: h / 2 - k * cy };
}

export default class XuanShiPersons extends React.Component {
	constructor(props) {
		super(props);
		this.state = { count: 0, edgeCount: 0, loading: false, err: '', topN: 100, minWeight: 3 };
		this._svgRef = React.createRef();
	}

	componentDidMount() { this.load(); }
	componentWillUnmount() { if (this._sim) { this._sim.stop(); } }

	async load() {
		const __seq = (this._loadSeq = (this._loadSeq || 0) + 1);   // 序号守卫:旧响应不覆盖新条件
		// 记下「本次取数实际用的门槛」:页顶说明行此前读输入框当前值,
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
		// 用户自己动过视野(滚轮 / 拖动画布)后不再自动收拢
		let userMoved = false;
		let labels = null;
		const baseFs = (d) => 10 + Math.min(4, (d.weight || 1) / maxW * 6);
		// 名字字号随视野缩放补偿(收拢视野后名字不跟着缩成看不清的小字)
		const relabel = (k) => {
			if (!labels) { return; }
			const vb = Math.min((el.clientWidth || W) / W, (el.clientHeight || H) / H) || 1;
			const z = getDeclaredZoom();
			labels.attr('font-size', (d) => personLabelSize(baseFs(d), k, vb, z))
				.style('stroke-width', (d) => `${Math.round(3 * personLabelSize(baseFs(d), k, vb, z) / baseFs(d) * 100) / 100}px`);
		};
		const zoom = d3.zoom().scaleExtent([0.2, 4]).on('zoom', (e) => { if (e.sourceEvent) { userMoved = true; } root.attr('transform', e.transform); relabel(e.transform.k); });
		svg.call(zoom);

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
			// 弱向心力:各连通块之间没有连边,只靠 forceCenter(只平移质心)会被斥力推散到视野之外(100 个节点 79 个落在 svg 外)
			.force('x', d3.forceX(W / 2).strength(0.06))
			.force('y', d3.forceY(H / 2).strength(0.06))
			.force('collide', d3.forceCollide().radius((d) => r(d) + 8));
		this._sim = sim;
		// 收拢视野:按节点包围盒(含圆与名字)把整张图缩放平移进 W × H;前若干拍收一次、停稳后再收一次(用户动过视野就不收)
		const fit = () => {
			if (userMoved || !nodes.length) { return; }
			let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
			nodes.forEach((n) => { const rr = r(n) + 40; x0 = Math.min(x0, n.x - rr); x1 = Math.max(x1, n.x + rr); y0 = Math.min(y0, n.y - rr); y1 = Math.max(y1, n.y + r(n) + 22); });
			const t = fitTransformFor({ x0, y0, x1, y1 });
			if (t) { svg.call(zoom.transform, d3.zoomIdentity.translate(t.x, t.y).scale(t.k)); }
		};
		let ticks = 0;

		const link = root.append('g').selectAll('line').data(links).enter().append('line')
			.attr('stroke', 'var(--line)')
			.attr('stroke-opacity', 0.6)
			.attr('stroke-width', (d) => 0.6 + Math.sqrt((d.weight || 1) / maxE) * 4);

		const node = root.append('g').selectAll('g').data(nodes).enter().append('g')
			.call(d3.drag()
				.on('start', (e, d) => { userMoved = true; if (!e.active) { sim.alphaTarget(0.3).restart(); } d.fx = d.x; d.fy = d.y; })
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

		labels = node.append('text')
			.attr('dy', (d) => r(d) + 14)
			.attr('text-anchor', 'middle')
			.attr('font-size', (d) => baseFs(d))
			.attr('fill', 'var(--ink)')
			.attr('font-family', "'Noto Serif SC', serif")
			.style('paint-order', 'stroke')
			.style('stroke', 'var(--paper)')
			.style('stroke-width', '3px')
			.text((d) => d.id);

		// weight 是「该人所有达门槛的共现边权之和」(加权共现度),不是全库出现次数 ——
		// 门槛一改这个数就变,标成「全库出现 N 次」会被当成人物的出场频次。
		relabel(1);
		node.append('title').text((d) => `${d.id} · 加权共现度 ${d.weight || 0}(其达门槛的共现边权之和,随「最小共现」变化)`);

		sim.on('tick', () => {
			link.attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y)
				.attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
			node.attr('transform', (d) => `translate(${d.x},${d.y})`);
			ticks += 1;
			if (ticks === 90) { fit(); }
		});
		sim.on('end', fit);
	}

	render() {
		const { count, edgeCount, loading, err, topN, minWeight, appliedMinWeight } = this.state;
		const shownMinWeight = appliedMinWeight === undefined || appliedMinWeight === null ? minWeight : appliedMinWeight;   // 说明行跟图走
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
