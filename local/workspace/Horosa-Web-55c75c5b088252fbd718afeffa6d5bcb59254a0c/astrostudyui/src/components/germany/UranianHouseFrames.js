// 量化盘 六大宫框(定局法 WP-2)主面板。
import { markPanelReady } from '../../utils/perfMark';
import { sameDisplayList } from '../../utils/chartUpdateGuard';
import { chartSCUEnabled } from '../../utils/perfFlags';
// 顶部 XQSelect 六框下拉(子午/上升/太阳/月亮/交点/地球)看一框盘 + XQTable 落宫表 + 「缩略全览」看六小轮。
// 主框盘复用标准星盘设置 AstroChart(同主占星盘):用所选框的 12 宫 cusps 重写本命盘 houses,各点用本命盘原始
//   objects(全保真:字形/逆行/落座度),画成与主盘一致的 12 宫盘。缩略全览仍用轻量 UranianFrameWheel(六小轮)。
// 数据:/germany/midpoint(含 houseFrames)+ /chart(取各点黄经/字形)。后端缺 houseFrames 时前端等宫降级合成。
// showHouseFrames(WP-1 持久化开关)关时本 Tab 在 AstroGermany 里隐藏;此处再兜一层提示。
import React, { Component } from 'react';
import { Row, Col, Switch, Spin, Empty } from 'antd';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { XQSelect, XQTable } from '../xq-ui';
import AstroChart from '../astro/AstroChart';
import UranianFrameWheel from './UranianFrameWheel';

// horosa_frames_scu_v1(PERF-R9 Ship 6):六宫框 sCU(与 UranianDialMain 同款全键浅比)。
// 父容器 AstroGermany 的子页签无冻结层 → 隐藏时也会随父重渲(内含标准盘 AstroChart + 落宫表)。
// 全键浅比:漏键=该更新时不更新,故不用固定白名单;显示开关数组按内容比;state 变化一律照渲。
const FRAMES_SCU_COMPARATORS = {
	chartDisplay: sameDisplayList,
	planetDisplay: sameDisplayList,
	lotsDisplay: sameDisplayList,
};
function framesPropsEqual(a, b){
	if (a === b) return true;
	if (!a || !b) return false;
	const ka = Object.keys(a);
	const kb = Object.keys(b);
	if (ka.length !== kb.length) return false;
	for (let i = 0; i < ka.length; i++){
		const k = ka[i];
		const fn = FRAMES_SCU_COMPARATORS[k];
		if (fn){ if (!fn(a[k], b[k])) return false; }
		else if (!Object.is(a[k], b[k])) return false;
	}
	return true;
}

import { equalHouseFramework, planetHouse } from '../../utils/uranianDial';
import { getStoredUranianDisplay, saveUranianDisplay } from './UranianDialStyle';
import { schoolToBackendParams } from './UranianSchools';
import { tnpGlyph } from './UranianGlyphs';

// 标准盘所需的「宫头对象」结构:{id:'House1'..'House12', lon, size, sign, signlon}。
// AstroChartCircle.desposeHouses/getHouse 消费 lon/size/sign/signlon/id;此处从框的 cusps[12] 派生。
// 导出供单测(纯函数,框→标准盘适配的核心逻辑)。
export function buildFrameHouseObjects(cusps){
	if (!Array.isArray(cusps) || cusps.length !== 12) return null;
	const norm = (x) => ((Number(x) % 360) + 360) % 360;
	return cusps.map((c, i) => {
		const lon = norm(c);
		const next = norm(cusps[(i + 1) % 12]);
		const size = norm(next - lon) || 30; // 子午局不等距同样照算;退化 0 时给 30 防除零
		const si = Math.floor(lon / 30) % 12;
		return {
			id: AstroConst.LIST_HOUSES[i],
			lon,
			size,
			sign: AstroConst.LIST_SIGNS[si],
			signlon: lon - si * 30,
		};
	});
}

// 把所选框的 cusps 嫁接到本命盘:浅克隆 chartObj + chart,只换 houses;objects/angles/lots 全用本命盘原值(保真)。
// 清掉 houseMap 记忆(getHouse 会按新 houses 重建);params 透传(界限环等沿用本命设置)。
// 导出供单测(纯函数,框→标准盘适配的核心逻辑)。
export function frameChartObjFromNatal(natalRoot, cusps){
	const root = (natalRoot && natalRoot.chart) ? natalRoot : null;
	if (!root) return null;
	const houses = buildFrameHouseObjects(cusps);
	if (!houses) return null;
	return {
		...root,
		houseMap: undefined,           // 强制 getHouse 用新 houses 重建(否则命中旧记忆)
		chart: { ...root.chart, houses },
	};
}

// 六框 id ↔ 中文标签 ↔ 锚点说明(纯中性命名:定局法,无创始人/软件/书名)。
const FRAME_OPTIONS = [
	{ value: 'meridian', label: '子午局' },
	{ value: 'ascendant', label: '上升局' },
	{ value: 'sun', label: '太阳局' },
	{ value: 'moon', label: '月亮局' },
	{ value: 'node', label: '交点局' },
	{ value: 'earth', label: '地球局' },
];
const FRAME_LABEL = FRAME_OPTIONS.reduce((m, o) => { m[o.value] = o.label; return m; }, {});
const FRAME_DESC = {
	meridian: '东点为 1 宫头、天顶为 10 宫头(赤道分宫,各宫不等距)',
	ascendant: '上升为 1 宫头(等宫)',
	sun: '太阳落 4 宫(1 宫头 = ☉−90°,等宫)',
	moon: '太阴落 10 宫(1 宫头 = ☽+90°,等宫)',
	node: '北交为 1 宫头(等宫)',
	earth: '0°巨蟹(天顶)固定,1 宫头恒 180°、与生时无关(等宫)',
};

// 落宫表/轮盘的参与点:行星+三王+南北交+Asc/MC+8 TNP+白羊点(与后端 pts 口径一致)。
const BODY_IDS = new Set([
	AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, AstroConst.MARS,
	AstroConst.JUPITER, AstroConst.SATURN, AstroConst.URANUS, AstroConst.NEPTUNE, AstroConst.PLUTO,
	AstroConst.NORTH_NODE, AstroConst.SOUTH_NODE, AstroConst.ASC, AstroConst.MC,
]);

const fv = (fields, key) => { const f = fields && fields[key]; return f ? f.value : undefined; };
const fmt = (val, pattern) => ((val && typeof val.format === 'function') ? val.format(pattern) : undefined);

function fieldsToParams(fields){
	if (!fields) return null;
	return {
		date: fmt(fv(fields, 'date'), 'YYYY/MM/DD'), time: fmt(fv(fields, 'time'), 'HH:mm:ss'),
		zone: fv(fields, 'zone') || '+08:00', lat: fv(fields, 'lat'), lon: fv(fields, 'lon'),
		gpsLat: fv(fields, 'gpsLat'), gpsLon: fv(fields, 'gpsLon'),
		hsys: fv(fields, 'hsys'), zodiacal: fv(fields, 'zodiacal'), siderealAyanamsa: fv(fields, 'siderealAyanamsa') || '',
		tradition: false, predictive: 0, name: fv(fields, 'name') || '', pos: fv(fields, 'pos') || '',
	};
}
function paramsReady(p){
	if (!p) return false;
	return ['date', 'time', 'zone', 'lat', 'lon'].every((k) => p[k] !== undefined && p[k] !== null && `${p[k]}`.trim() !== '');
}

// 从 /chart + /germany/midpoint(tnp)取参与点 [{id,lon}](行星/角点/TNP + 白羊点 0°)。
function collectPoints(chartRoot, tnpArr){
	const inner = (chartRoot && chartRoot.chart) ? chartRoot.chart : (chartRoot || {});
	const out = []; const seen = new Set();
	const push = (id, lon) => { if (id && Number.isFinite(Number(lon)) && !seen.has(id)) { out.push({ id, lon: Number(lon) }); seen.add(id); } };
	(inner.objects || []).forEach((o) => { if (BODY_IDS.has(o.id)) push(o.id, o.lon); });
	(inner.angles || []).forEach((o) => { if (BODY_IDS.has(o.id)) push(o.id, o.lon); });
	(tnpArr || []).forEach((o) => push(o.id, o.lon));
	push(AstroConst.ARIES_POINT, 0); // 白羊点固定 0°
	return out;
}

// 后端缺 houseFrames 时:用各点黄经在前端等宫合成五框;子午局无法纯前端赤道分宫,回退「上升局」近似并标注。
function degradeFrames(points){
	const lonOf = (id) => { const p = (points || []).find((x) => x.id === id); return p ? p.lon : null; };
	const asc = lonOf(AstroConst.ASC), sun = lonOf(AstroConst.SUN), moon = lonOf(AstroConst.MOON), node = lonOf(AstroConst.NORTH_NODE);
	const mk = (first) => (first === null || first === undefined ? null : equalHouseFramework(first));
	const place = (cusps) => { const m = {}; (points || []).forEach((p) => { m[p.id] = planetHouse(p.lon, cusps); }); return m; };
	const build = (first, equal) => { const cusps = mk(first); return cusps ? { cusps, equal, firstCusp: ((first % 360) + 360) % 360, tenthCusp: cusps[9], placements: place(cusps) } : null; };
	const frames = {};
	// 子午局降级:无 houses_ex → 退化为「上升局」等宫近似(equal=true),UI 提示「近似」。
	if (asc !== null) frames.meridian = { ...build(asc, true), degraded: true };
	if (asc !== null) frames.ascendant = build(asc, true);
	if (sun !== null) frames.sun = build(sun - 90, true);
	if (moon !== null) frames.moon = build(moon + 90, true);
	if (node !== null) frames.node = build(node, true);
	frames.earth = build(180, true);
	return { frames, eastPoint: asc, mc: null, asc, _degraded: true };
}

export default class UranianHouseFrames extends Component {
	constructor(props){
		super(props);
		const disp = getStoredUranianDisplay();
		this.state = {
			frame: 'meridian',
			overview: false,            // 缩略全览(六小轮)
			points: [],                 // [{id,lon}]
			houseFrames: null,          // { frames:{...}, eastPoint, mc, asc }
			degraded: false,            // 后端缺字段 → 前端等宫合成
			loading: false,
			note: null,
			school: disp.school || 'classic',
			vh: typeof window !== 'undefined' ? window.innerHeight : 900,
			colW: 0, colH: 0,
		};
		this.unmounted = false;
		this.load = this.load.bind(this);
		this._onResize = this._onResize.bind(this);
		this._measure = this._measure.bind(this);
		if (this.props.hook) this.props.hook.fun = () => { if (!this.unmounted) { this.load(); this._measure(); } };
	}
	shouldComponentUpdate(nextProps, nextState){
		if (!chartSCUEnabled()) return true;  // kill-switch
		if (nextState !== this.state) return true;
		return !framesPropsEqual(this.props, nextProps);
	}

	componentDidMount(){
		this.unmounted = false;
		this.load();
		if (typeof window !== 'undefined') window.addEventListener('resize', this._onResize);
		if (typeof ResizeObserver !== 'undefined' && this._host){ this._ro = new ResizeObserver(() => this._measure()); this._ro.observe(this._host); }
		this._measure();
	}
	componentWillUnmount(){
		this.unmounted = true;
		if (typeof window !== 'undefined') window.removeEventListener('resize', this._onResize);
		if (this._ro){ try { this._ro.disconnect(); } catch (e) { /* noop */ } this._ro = null; }
	}
	componentDidUpdate(prev){ if (prev.fields !== this.props.fields) this.load(); }
	_onResize(){ if (!this.unmounted){ this.setState({ vh: window.innerHeight }); this._measure(); } }
	_measure(){
		if (this.unmounted || !this._host) return;
		const col = this._host.querySelector('.horosa-frames-chart-col');
		if (!col) return;
		const w = col.clientWidth, h = col.clientHeight;
		if (w > 0 && h > 0 && (Math.abs(w - this.state.colW) > 2 || Math.abs(h - this.state.colH) > 2)) this.setState({ colW: w, colH: h });
	}

	async load(){
		const params = fieldsToParams(this.props.fields);
		if (!paramsReady(params)){ this.setState({ note: '请先设置出生日期/时间与经纬度', points: [], houseFrames: null }); return; }
		this.setState({ loading: true, note: null });
		const sp = schoolToBackendParams(this.state.school); // {school, includeTnp, ..., frames}
		try {
			const [chartData, mid] = await Promise.all([
				request(`${Constants.ServerRoot}/chart`, { body: JSON.stringify({ ...params, cid: null }), silent: true }),
				request(`${Constants.ServerRoot}/germany/midpoint`, { body: JSON.stringify({ ...params, ...sp, frames: true }), silent: true }),
			]);
			if (this.unmounted) return;
			// 后端响应走 {ResultCode, Result} 信封,真值在 .Result(与 UranianDialMain 同口径);兜底取原对象。
			const chartObj = (chartData && chartData[Constants.ResultKey]) ? chartData[Constants.ResultKey] : chartData;
			const m = (mid && mid[Constants.ResultKey]) ? mid[Constants.ResultKey] : mid;
			const tnp = (m && m.tnp) || [];
			const points = collectPoints(chartObj, tnp);
			// horosa_panel_ready_v1:六宫框子盘的中栏(框盘)+右栏(落宫表)全部由 points/houseFrames 派生,
			// 两个分支各自都是「面板数据落定」的那一次 setState。
			if (m && m.houseFrames && m.houseFrames.frames){
				this.setState({ points, houseFrames: m.houseFrames, degraded: false, loading: false }, ()=>{ markPanelReady('auxchart'); });
			} else {
				// 后端缺 houseFrames(老服务)→ 前端等宫降级合成(子午局近似)。
				this.setState({ points, houseFrames: degradeFrames(points), degraded: true, loading: false }, ()=>{ markPanelReady('auxchart'); });
			}
		} catch (e){
			if (!this.unmounted) this.setState({ loading: false, note: '排盘失败,请稍后重试' });
		}
	}

	// 当前框 cusps + 落宫表行。
	frameData(key){
		const hf = this.state.houseFrames;
		const f = hf && hf.frames ? hf.frames[key] : null;
		if (!f) return null;
		return f;
	}

	tableRows(key){
		const f = this.frameData(key);
		const place = f ? f.placements : null;
		return (this.state.points || []).map((p) => ({
			key: p.id,
			id: p.id,
			lon: p.lon,
			house: place ? (place[p.id] || (f ? planetHouse(p.lon, f.cusps) : '-')) : '-',
		})).sort((a, b) => (a.house - b.house) || (a.lon - b.lon));
	}

	glyphCell(id){
		const cn = AstroText.AstroMsgCN[id] || id;
		// B1 手绘 SVG 字形优先(8 虚星+可选点);缺字形的虚星回退粗体缩写;真实体走全站字形字体。
		const svg = tnpGlyph(id, 14);
		if (svg) return <span title={cn} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{svg}<span>{cn}</span></span>;
		const tnp = AstroText.isUranian(id) && id !== AstroConst.ARIES_POINT;
		if (tnp) return <span style={{ fontWeight: 600, letterSpacing: '0.3px' }} title={cn}>{AstroText.uranianGlyph(id)}</span>;
		const ch = id === AstroConst.ARIES_POINT ? AstroText.AstroMsg[AstroConst.ARIES] : AstroText.AstroMsg[id];
		return <span><span style={{ fontFamily: AstroConst.AstroChartFont, marginRight: 4 }}>{ch || ''}</span>{cn}</span>;
	}

	dms(lon){
		const L = ((lon % 360) + 360) % 360;
		const si = Math.floor(L / 30);
		const within = L - si * 30;
		const d = Math.floor(within);
		const m = Math.round((within - d) * 60);
		const sigName = AstroConst.LIST_SIGNS[si];
		const sigCh = AstroText.AstroMsg[sigName] || '';
		const sigColor = (AstroConst.AstroColor && AstroConst.AstroColor[sigName]) || 'inherit';
		return (
			<span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
				{/* 星座字形固定等宽槽:与中点列表同口径,窄字形不贴数字、整列对齐。 */}
				<span style={{ fontFamily: AstroConst.AstroChartFont, display: 'inline-block', minWidth: '1.35em', textAlign: 'center', marginRight: 2, color: sigColor }} title={AstroText.AstroMsgCN[sigName] || ''}>{sigCh}</span>
				{d}°{m < 10 ? '0' + m : m}′
			</span>
		);
	}

	render(){
		const { loading, note, frame, overview, houseFrames, degraded } = this.state;
		const height = this.props.height || 700;
		// 中间盘 size:取列宽/高较小者最大化(留边)。缩略全览的小轮上限 560;主框标准盘填满列(下方单算)。
		const colMin = Math.max(220, Math.min(this.state.colW || 0, this.state.colH || 0) - 16);
		const wheelSize = Math.min(560, colMin || 360);
		// 主框标准盘尺寸:取列宽/高较小者撑满(不设 560 上限,标准盘越大越清晰);未测得时按列高兜底。
		const chartSize = Math.max(360, (Math.min(this.state.colW || 0, this.state.colH || 0) - 12) || (height - 24));

		const columns = [
			{ title: '点', dataIndex: 'id', key: 'id', render: (id) => this.glyphCell(id) },
			{ title: '黄经', dataIndex: 'lon', key: 'lon', render: (lon) => this.dms(lon) },
			{ title: '落宫', dataIndex: 'house', key: 'house', width: 64, align: 'center', render: (h) => {
				const n = Number(h);
				const angular = n === 1 || n === 4 || n === 7 || n === 10;
				return (
					<span title={angular ? '角宫(1/4/7/10):最有力位置' : ''}
						style={{ display: 'inline-block', minWidth: 24, padding: '0 6px', lineHeight: '20px', borderRadius: 10,
							fontSize: 12, fontWeight: 600, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
							background: angular ? 'var(--horosa-accent, #b8860b)' : 'var(--horosa-row-alt, rgba(120,120,120,0.12))',
							color: angular ? '#fff' : 'inherit' }}>{h}</span>
				);
			} },
		];

		const curFrame = this.frameData(frame);
		const curDeg = curFrame && curFrame.degraded;

		const left = (
			<div className="horosa-frames-side" style={{ padding: '8px 6px 8px 12px' }}>
				<div className="horosa-frames-seg">
					{/* 框选择器:下拉栏(XQSelect=antd Select)更紧凑;onChange 直接给 value(非 e.target.value)。 */}
					<XQSelect value={frame} options={FRAME_OPTIONS} onChange={(v) => this.setState({ frame: v })} className="horosa-frames-frame-seg" size="small" style={{ width: '100%' }} />
				</div>
				<div className="horosa-frames-desc" style={{ marginTop: 8, opacity: 0.75, fontSize: 12, lineHeight: 1.5 }}>{FRAME_DESC[frame]}</div>
				<div className="horosa-frames-overview-row" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
					<Switch size="small" checked={overview} onChange={(v) => this.setState({ overview: v })} />
					<span style={{ fontSize: 13 }}>缩略全览(六框小轮)</span>
				</div>
				{degraded ? <div style={{ marginTop: 10, fontSize: 12, color: 'var(--horosa-text-secondary, #999)' }}>当前服务未返回宫框数据,已用等宫在前端合成;子午局为近似。</div> : null}
				{curDeg ? <div style={{ marginTop: 6, fontSize: 12, color: 'var(--horosa-text-secondary, #999)' }}>子午局降级为上升等宫近似(需后端赤道分宫)。</div> : null}
			</div>
		);

		// 主框标准盘:把所选框 cusps 嫁接到本命盘,复用 AstroChart(同主占星盘)。本命盘缺失则回退轻量小轮。
		const frameChart = (!overview && curFrame && curFrame.cusps) ? frameChartObjFromNatal(this.props.chart, curFrame.cusps) : null;
		const chart = overview ? (
			<div className="horosa-frames-overview-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, width: '100%' }}>
				{FRAME_OPTIONS.map((o) => {
					const f = this.frameData(o.value);
					// 一行两轮(2×3 竖排):单轮显著放大;宽按半列、高按三行摊,420 封顶防超列。
					const small = Math.max(200, Math.min((this.state.colW || 480) / 2 - 16, ((this.state.colH || 900) - 84) / 3, 420));
					return (
						<div key={o.value} style={{ textAlign: 'center' }}>
							<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 2 }}>{o.label}{f && f.degraded ? '(近似)' : ''}</div>
							{f ? <UranianFrameWheel cusps={f.cusps} points={this.state.points} size={small} frameKey={o.value} label="" /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={false} />}
						</div>
					);
				})}
			</div>
		) : (
			frameChart ? (
				// key=frame:换框时强制重建标准盘(确保按新 houses 重绘,不吃旧 d3 签名)。
				<div style={{ width: chartSize, height: chartSize, maxWidth: '100%' }}>
					<AstroChart key={`frame-${frame}`} value={frameChart} wheelArt={this.props.wheelArt} chartDisplay={this.props.chartDisplay || AstroConst.CHART_DEFAULTOPTS} planetDisplay={this.props.planetDisplay} lotsDisplay={this.props.lotsDisplay} showAstroMeaning={this.props.showAstroMeaning} width="100%" height="100%" />
				</div>
			) : (
				curFrame ? <UranianFrameWheel cusps={curFrame.cusps} points={this.state.points} size={wheelSize} frameKey={frame} label={FRAME_LABEL[frame]} />
					: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={note || '无数据'} />
			)
		);

		const right = (
			<div className="horosa-frames-table-wrap" style={{ padding: '8px 12px 8px 6px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
					<span style={{ fontSize: 13, fontWeight: 600 }}>{FRAME_LABEL[frame]} · 落宫表</span>
					<span className="horosa-panel-count">{this.tableRows(frame).length}</span>
					<span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--horosa-text-soft, rgba(120,120,120,0.85))' }}>
						<span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: 'var(--horosa-accent, #b8860b)', marginRight: 3, verticalAlign: '-1px' }} />角宫
					</span>
				</div>
				<XQTable
					columns={columns}
					dataSource={this.tableRows(frame)}
					size="small"
					pagination={false}
					locale={{ emptyText: note || '无数据' }}
				/>
			</div>
		);

		const sideScroll = { maxHeight: Math.max(320, height - 24), overflowY: 'auto' };
		return (
			<div className="horosa-frames-host" ref={(el) => { this._host = el; }} style={{ height }}>
				<Spin spinning={loading}>
					<Row className="horosa-frames-layout" gutter={10}>
						<Col span={5} className="horosa-frames-side-col"><div style={sideScroll}>{left}</div></Col>
						<Col span={13} className="horosa-frames-chart-col" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: Math.max(320, height - 24) }}>{chart}</Col>
						<Col span={6} className="horosa-frames-side-col"><div style={sideScroll}>{right}</div></Col>
					</Row>
				</Spin>
			</div>
		);
	}
}
