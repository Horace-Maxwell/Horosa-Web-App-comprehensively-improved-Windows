import React from 'react';
import { Spin, Empty } from 'antd';
import echarts from './echartsCore';
import chinaGeo from '../../assets/china.geo.json';
import { fetchMap } from '../../services/xuanshi';

// 玄学地图 —— 对齐参考地理地图页:echarts 中国底图(宣纸×墨,始终渲染)+ 古都钉点(朱砂 effectScatter,
// 半径 ∝ 活动量)+ 朝代游历 chips + 右栏「城市榜」。底图常驻:某朝代 0 钉点时也显示地图、仅无散点(非空白)。
const MAP_MACROS = ['西周', '春秋', '战国', '秦', '西汉', '新莽', '东汉', '三国', '西晋', '东晋', '十六国', '南朝', '北朝', '隋', '唐', '五代', '北宋', '南宋', '辽', '金', '西夏', '元', '明'];

let _mapRegistered = false;
function ensureChinaRegistered() {
	if (_mapRegistered) { return true; }
	try {
		const CHINA = (chinaGeo && chinaGeo.features) ? chinaGeo : ((chinaGeo && chinaGeo.default) || chinaGeo);
		if (!CHINA || !CHINA.features) { return false; }
		echarts.registerMap('china', CHINA);
		_mapRegistered = true;
		return true;
	} catch (e) { return false; }
}

function isDarkAppearance() {
	try { return document.documentElement.getAttribute('data-horosa-appearance') === 'dark'; } catch (e) { return false; }
}

export default class XuanShiMap extends React.Component {
	constructor(props) {
		super(props);
		const f = (props.ui && props.ui.map) || {};
		this.state = { period: f.period || '', points: [], total: 0, loading: false, err: '', selected: null };
		this._mapEl = React.createRef();
		this._chart = null;
		this._geoOk = ensureChinaRegistered();
		this._onResize = () => { if (this._chart) { this._chart.resize(); } };
	}

	componentDidMount() {
		this.load();
		window.addEventListener('resize', this._onResize);
		// [Tahoe 订阅补齐] 容器 RO:窗口事件断链引擎/容器变窗口不变的场景都能驱动 echarts 重排。
		try {
			if (typeof ResizeObserver !== 'undefined' && this._mapEl.current) {
				this._hostRO = new ResizeObserver(this._onResize);
				this._hostRO.observe(this._mapEl.current);
			}
		} catch (e) { this._hostRO = null; }
		// 主题切换 → 重渲底图配色(参考用 reload,这里就地重渲更顺滑)
		try {
			this._themeObs = new MutationObserver(() => this.renderChart());
			this._themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-horosa-appearance'] });
		} catch (e) { /* noop */ }
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this._onResize);
		if (this._hostRO) { try { this._hostRO.disconnect(); } catch (e) { /* noop */ } this._hostRO = null; }
		if (this._themeObs) { this._themeObs.disconnect(); }
		if (this._chart) { this._chart.dispose(); this._chart = null; }
	}

	persist() { if (this.props.onPersist) { this.props.onPersist('map', { period: this.state.period }); } }

	async load() {
		this.setState({ loading: true, err: '' });
		try {
			// 与参考 app 完全一致:直接按所选 period 过滤(后端 by_period.get(period));
			// 细朝代(西周/北宋…)不在底库桶键中即返回空,与 app 逐点一致 —— 但底图仍常驻显示。
			const r = await fetchMap(this.state.period || undefined);
			this.setState({ points: r.points || [], total: r.total || 0, loading: false }, () => this.renderChart());
		} catch (e) { this.setState({ loading: false, err: `${e && e.message ? e.message : e}` }); }
		this.persist();
	}

	setPeriod(period) { this.setState({ period, selected: null }, () => this.load()); }

	// 始终渲染中国底图(geo) + 钉点散点(effectScatter);0 钉点时 series.data 为空、底图照常。
	renderChart() {
		if (!this._geoOk || !this._mapEl.current) { return; }
		const el = this._mapEl.current;
		requestAnimationFrame(() => {
			if (!this._mapEl.current) { return; }
			if (!this._chart) {
				this._chart = echarts.init(el, null, { renderer: 'canvas' });
				this._chart.on('click', (params) => {
					const d = params && params.data;
					if (d && d.modern) { this.setState({ selected: (this.state.points || []).find((p) => p.modern === d.modern) || null }); }
				});
			}
			const isDark = isDarkAppearance();
			const POINTS = this.state.points || [];
			const max = Math.max.apply(null, POINTS.map((p) => p.count || 0).concat([1]));
			const data = POINTS.map((p) => ({ name: p.modern, modern: p.modern, value: [p.lng, p.lat, p.count], ancient: p.ancient_names }));
			this._chart.setOption({
				backgroundColor: 'transparent',
				tooltip: {
					trigger: 'item',
					formatter: (params) => {
						const d = params.data;
						if (!d) { return params.name; }
						return `<div style="font-weight:600">${d.name}</div>`
							+ `<div style="opacity:.7">古名：${(d.ancient || []).join('、')}</div>`
							+ `<div>${d.value[2]} 个事件</div>`;
					},
				},
				geo: {
					map: 'china', roam: true, zoom: 1.15, center: [110, 35],
					itemStyle: {
						areaColor: isDark ? '#1f1a13' : '#f3ecdc',
						borderColor: isDark ? '#3a3225' : '#cfc4a8',
						borderWidth: 0.5,
					},
					emphasis: {
						itemStyle: { areaColor: isDark ? '#2a221a' : '#ebe2c8' },
						label: { color: isDark ? '#efe6d2' : '#1c1611' },
					},
				},
				series: [{
					type: 'effectScatter', coordinateSystem: 'geo', data,
					symbolSize: (val) => 6 + Math.sqrt((val[2] || 0) / max) * 32,
					rippleEffect: { brushType: 'stroke', scale: 2.5 },
					itemStyle: { color: 'rgba(166, 61, 42, 0.85)', shadowBlur: 8, shadowColor: 'rgba(166, 61, 42, 0.4)' },
					emphasis: { scale: 1.4 },
					label: {
						show: true, position: 'right', formatter: '{b}',
						color: isDark ? '#efe6d2' : '#1c1611', fontFamily: '"Noto Serif SC", serif', fontSize: 11,
					},
				}],
			}, true);
			setTimeout(() => { if (this._chart) { this._chart.resize(); } }, 100);
		});
	}

	render() {
		const { points, loading, err, selected, period } = this.state;
		const pinCount = points.reduce((s, p) => s + (p.count || 0), 0);
		const ranked = points.slice().sort((a, b) => (b.count || 0) - (a.count || 0));
		return (
			<div>
				{/* 面包屑 + 标题 + 描述 */}
				<div className="xuanshi-crumbs">
					<span className="xuanshi-crumb" onClick={() => this.props.onHome && this.props.onHome()}>首页</span>
					<span className="xuanshi-crumb-sep">/</span><span>地理地图</span>
				</div>
				<h1 className="xuanshi-display is-hero" style={{ fontSize: 'clamp(26px,3.4vw,38px)' }}>地理地图</h1>
				<div className="xuanshi-section-sub" style={{ margin: '8px 0 14px' }}>
					把研究行的 region/place 钉到中国地图。<b style={{ color: 'var(--ink)' }}>{points.length}</b> 个城市 · <b style={{ color: 'var(--ink)' }}>{pinCount.toLocaleString()}</b> 个事件钉点。
				</div>

				{/* 朝代游历 chips */}
				<div className="xuanshi-facet-chips" style={{ marginBottom: 16 }}>
					<span className={`xuanshi-fchip${!period ? ' is-active' : ''}`} onClick={() => this.setPeriod('')}><span className="xuanshi-fchip-label">全部朝代</span></span>
					{MAP_MACROS.map((m) => (
						<span key={m} className={`xuanshi-fchip${period === m ? ' is-active' : ''}`} onClick={() => this.setPeriod(m)}><span className="xuanshi-fchip-label">{m}</span></span>
					))}
				</div>

				{err ? (
					<div className="xuanshi-center"><Empty description={`载入失败:${err}`} /><span className="xuanshi-link" onClick={() => this.load()}>重试</span></div>
				) : (
					<div className="xuanshi-map-grid">
						<div className="xuanshi-card" style={{ padding: 10, minWidth: 0, position: 'relative' }}>
							{/* echarts 中国底图常驻容器(始终挂载,ref 稳定) */}
							<div ref={this._mapEl} style={{ width: '100%', height: '68vh', minHeight: 380 }} />
							{/* 叠加层:载入中 / 底图失败 / 0 钉点提示(均不替换底图) */}
							{loading ? (
								<div className="xuanshi-center" style={{ position: 'absolute', inset: 0, background: 'var(--paper-card)', opacity: 0.85 }}><Spin tip="载入舆图…" /></div>
							) : null}
							{!loading && !this._geoOk ? (
								<div className="xuanshi-center" style={{ position: 'absolute', inset: 0 }}><Empty description="中国底图载入失败" /></div>
							) : null}
							{!loading && this._geoOk && period && !points.length ? (
								<div className="xuanshi-chip is-ink" style={{ position: 'absolute', top: 16, left: 16 }}>「{period}」该朝代暂无定位钉点</div>
							) : null}
						</div>
						{/* 城市榜 */}
						<aside className="xuanshi-card xuanshi-citylist">
							<div className="xuanshi-stat-label" style={{ textAlign: 'left', marginBottom: 12 }}>城市榜（{points.length}）</div>
							{!points.length ? (
								<div className="xuanshi-stat-sub" style={{ fontSize: 12 }}>{period ? `「${period}」无定位城市` : '无数据'}</div>
							) : ranked.slice(0, 50).map((p, i) => {
								const sel = selected && selected.modern === p.modern;
								const byHist = p.by_history || {};
								return (
									<div key={i} className={`xuanshi-cityrow${sel ? ' is-active' : ''}`} onClick={() => this.setState({ selected: p })}>
										<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
											<span className="xuanshi-display" style={{ fontSize: 15, color: 'var(--ink)' }}>{p.modern}</span>
											<span className="xuanshi-stat-sub" style={{ fontVariantNumeric: 'tabular-nums' }}>{p.count}</span>
										</div>
										{(p.ancient_names || []).length ? <div className="xuanshi-stat-sub" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.5 }}>{(p.ancient_names || []).join('、')}</div> : null}
										{Object.keys(byHist).length ? (
											<div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
												{Object.entries(byHist).map(([h, n]) => <span key={h} className="xuanshi-chip" style={{ fontSize: 10 }}>{h} {n}</span>)}
											</div>
										) : null}
									</div>
								);
							})}
						</aside>
					</div>
				)}
			</div>
		);
	}
}
