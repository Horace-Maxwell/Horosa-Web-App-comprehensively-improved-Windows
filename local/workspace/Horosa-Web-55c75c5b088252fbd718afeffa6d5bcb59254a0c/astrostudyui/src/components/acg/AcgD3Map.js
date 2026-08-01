import { Component } from 'react';
import * as d3 from 'd3';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import world from './world.geo.json';

// Two appearance themes (follow the app's data-horosa-appearance). Planet colours stay
// recognisable but are deepened in light mode; the casing/label-chip flip so lines and
// labels read on either basemap.
const THEMES = {
	dark: {
		ocean: '#0e1521', land: '#1d2735', border: '#33445a', grid: '#2a384d', gridOpacity: 0.55,
		casing: 'rgba(7,11,18,0.62)',
		chipBg: '#0f141c', chipBorder: 'rgba(222,228,238,0.9)',
		geo: { equator: '#7f8a99', ecliptic: '#c9a227', tropic: '#6f7a8a', paran: '#9aa6cc' },
		markerFill: '#ffffff', markerStroke: 'rgba(7,11,18,0.7)',
		tipBg: 'rgba(16,20,28,0.95)', tipFg: '#f0f3f8', tipBorder: 'rgba(255,255,255,0.12)',
		colors: {
			Sun: '#F2A93B', Moon: '#9FB2C9', Mercury: '#39B5A6', Venus: '#E07AB0', Mars: '#E2493B',
			Jupiter: '#8C82F0', Saturn: '#C79A5E', Uranus: '#34C5D6', Neptune: '#6E90F2', Pluto: '#AEB4BD',
			'North Node': '#D98C4A', 'South Node': '#C9B07A', Chiron: '#5DAE54',
			'Dark Moon': '#B188DA', 'Purple Clouds': '#CB8BD9',
			Ceres: '#7FB069', Pallas: '#C99BD6', Juno: '#E0A458', Vesta: '#D4726A', Eris: '#8A94A6',
		},
	},
	light: {
		ocean: '#e9eff6', land: '#f4f2ea', border: '#c6ccd5', grid: '#d4dbe3', gridOpacity: 0.85,
		casing: 'rgba(255,255,255,0.92)',
		chipBg: '#ffffff', chipBorder: 'rgba(40,46,58,0.88)',
		geo: { equator: '#7d8896', ecliptic: '#b07d14', tropic: '#9aa3af', paran: '#5b6b86' },
		markerFill: '#222831', markerStroke: 'rgba(255,255,255,0.92)',
		tipBg: 'rgba(28,33,42,0.96)', tipFg: '#f4f6fa', tipBorder: 'rgba(0,0,0,0.18)',
		colors: {
			Sun: '#DD8E12', Moon: '#4F6F9C', Mercury: '#1C9A8C', Venus: '#CF4F92', Mars: '#CC382B',
			Jupiter: '#5A4BC0', Saturn: '#866428', Uranus: '#108EA0', Neptune: '#3357C4', Pluto: '#565C66',
			'North Node': '#BC6A28', 'South Node': '#937B3F', Chiron: '#358230',
			'Dark Moon': '#7E52B6', 'Purple Clouds': '#9A55AE',
			Ceres: '#5E9147', Pallas: '#A768B8', Juno: '#C48328', Vesta: '#B4534B', Eris: '#6A7486',
		},
	},
};
const AstroColor = THEMES.dark.colors;

// 供罗盘盘面等外部组件取同款行星色(按外观主题)。
export function acgColors(dark) { return (dark ? THEMES.dark : THEMES.light).colors; }

// Basemap style presets (original designs; orthogonal to light/dark). Each only
// overrides terrain tones — geo/planet colours come from the theme.
const STYLES = {
	classic: { name: '标准', light: {}, dark: {} },
	minimal: {
		name: '简约',
		light: { land: '#eef0ed', border: '#dde0e1', grid: '#e7eaed', gridOpacity: 0.3 },
		dark: { land: '#161c26', border: '#212a38', grid: '#1b2430', gridOpacity: 0.28 },
	},
	atlas: {
		name: '政区',
		light: { ocean: '#cfe1ef', land: '#ece4d2', border: '#b6a888', grid: '#bcc8d4', gridOpacity: 0.55 },
		dark: { ocean: '#0a121f', land: '#27313f', border: '#48586f', grid: '#30404f', gridOpacity: 0.6 },
	},
	noir: {
		name: '单色',
		light: { ocean: '#ebebec', land: '#d8d8da', border: '#bcbcbf', grid: '#dedee0', gridOpacity: 0.45 },
		dark: { ocean: '#0c0c0e', land: '#1c1c20', border: '#35353b', grid: '#212125', gridOpacity: 0.45 },
	},
};

const PLANET_CN = {
	[AstroConst.SUN]: '太阳', [AstroConst.MOON]: '月亮', [AstroConst.MERCURY]: '水星',
	[AstroConst.VENUS]: '金星', [AstroConst.MARS]: '火星', [AstroConst.JUPITER]: '木星',
	[AstroConst.SATURN]: '土星', [AstroConst.URANUS]: '天王星', [AstroConst.NEPTUNE]: '海王星',
	[AstroConst.PLUTO]: '冥王星', [AstroConst.NORTH_NODE]: '北交点', [AstroConst.SOUTH_NODE]: '南交点',
	[AstroConst.CHIRON]: '凯龙星', [AstroConst.DARKMOON]: '莉莉丝', [AstroConst.PURPLE_CLOUDS]: '紫炁',
	[AstroConst.CERES]: '谷神星', [AstroConst.PALLAS]: '智神星', [AstroConst.JUNO]: '婚神星',
	[AstroConst.VESTA]: '灶神星', [AstroConst.ERIS]: '阋神星',
};
const ANGLE_CN = { asc: '上升', desc: '下降', mc: '中天', ic: '天底' };
const ASPECT_SYM = { 60: '⚹', 90: '□', 120: '△', 45: '∠', 135: '⚼' };
const ANGLE_CONST = { asc: AstroConst.ASC, desc: AstroConst.DESC, mc: AstroConst.MC, ic: AstroConst.IC };
const ANGLE_WIDTH = { mc: 1.7, ic: 1.4, asc: 1.6, desc: 1.4 };
const GEO_META = {
	equator: { gkey: 'equator', dash: null, width: 1, label: '赤道' },
	ecliptic: { gkey: 'ecliptic', dash: '5,5', width: 1, label: '黄道' },
	tropicN: { gkey: 'tropic', dash: '2,5', width: 0.8, label: '北回归线' },
	tropicS: { gkey: 'tropic', dash: '2,5', width: 0.8, label: '南回归线' },
};

function readAppearance() {
	if (typeof document !== 'undefined') {
		const a = document.documentElement.getAttribute('data-horosa-appearance');
		if (a === 'dark' || a === 'light') return a;
	}
	if (typeof window !== 'undefined' && window.matchMedia) {
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}
	return 'light';
}

// Split a lat/lon polyline at the antimeridian, INTERPOLATING the crossing so each
// segment reaches the ±180 edge — lines flow off one edge and back on the other with
// no visible gap. Returns arrays of [lon,lat].
function splitAtDateline(points) {
	const segs = [];
	let cur = [];
	let prev = null;
	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		if (prev !== null && Math.abs(p.lon - prev.lon) > 180) {
			let pU = p.lon;
			if (p.lon - prev.lon > 180) pU = p.lon - 360;
			else if (p.lon - prev.lon < -180) pU = p.lon + 360;
			const edge = pU > prev.lon ? 180 : -180;
			const t = (edge - prev.lon) / (pU - prev.lon);
			const latCross = prev.lat + t * (p.lat - prev.lat);
			cur.push([edge, latCross]);
			if (cur.length > 1) segs.push(cur);
			cur = [[-edge, latCross]];
		}
		cur.push([p.lon, p.lat]);
		prev = p;
	}
	if (cur.length > 1) segs.push(cur);
	return segs;
}

function glyph(key) { return (AstroText.AstroMsg && AstroText.AstroMsg[key]) || ''; }
function planetCN(key) { return PLANET_CN[key] || key; }

class AcgD3Map extends Component {
	constructor(props) {
		super(props);
		this.state = { tip: null, themeName: readAppearance() };
		this.svgRef = { current: null };
		this.hostRef = { current: null };
		this.projection = null;
		this.path = null;
		this.size = { w: 0, h: 0 };
		this.theme = this.computeTheme();
		this.onResize = this.onResize.bind(this);
		this.onAppearance = this.onAppearance.bind(this);
	}

	computeTheme() {
		const base = THEMES[this.state.themeName] || THEMES.light;
		const style = STYLES[this.props.mapStyle] || STYLES.classic;
		const ov = (style[this.state.themeName]) || {};
		return Object.assign({}, base, ov);
	}

	componentDidMount() {
		this.ro = new ResizeObserver(this.onResize);
		if (this.hostRef.current) this.ro.observe(this.hostRef.current);
		if (typeof MutationObserver !== 'undefined') {
			this.mo = new MutationObserver(this.onAppearance);
			this.mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-horosa-appearance'] });
		}
		this.rebuild();
	}

	componentDidUpdate(prevProps, prevState) {
		if (prevState.themeName !== this.state.themeName || prevProps.projection !== this.props.projection || prevProps.mapStyle !== this.props.mapStyle) {
			this.rebuild();
		} else if (
			prevProps.value !== this.props.value || prevProps.lines !== this.props.lines ||
			prevProps.showGeo !== this.props.showGeo || prevProps.showLS !== this.props.showLS ||
			prevProps.showParans !== this.props.showParans || prevProps.showLabels !== this.props.showLabels ||
			prevProps.paranAll !== this.props.paranAll ||
			prevProps.showAspects !== this.props.showAspects || prevProps.showPoints !== this.props.showPoints ||
			prevProps.showMidpoints !== this.props.showMidpoints || prevProps.showLots !== this.props.showLots ||
			prevProps.showVibration !== this.props.showVibration || prevProps.showRelCross !== this.props.showRelCross ||
			prevProps.showZones !== this.props.showZones || prevProps.zoneWidth !== this.props.zoneWidth ||
			prevProps.showCrossings !== this.props.showCrossings || prevProps.showGeodetic !== this.props.showGeodetic ||
			prevProps.showCuspLines !== this.props.showCuspLines ||
			prevProps.showStars !== this.props.showStars || prevProps.showStarParans !== this.props.showStarParans ||
			prevProps.showTreasure !== this.props.showTreasure ||
			prevProps.clickMarker !== this.props.clickMarker
		) {
			this.drawAll();
		}
	}

	componentWillUnmount() {
		if (this.ro) this.ro.disconnect();
		if (this.mo) this.mo.disconnect();
	}

	onAppearance() {
		const n = readAppearance();
		if (n !== this.state.themeName) this.setState({ themeName: n });
	}

	onResize() {
		const host = this.hostRef.current;
		if (!host) return;
		if (host.clientWidth === this.size.w && host.clientHeight === this.size.h) return;
		this.rebuild();
	}

	makeProjection(w, h) {
		const sphere = { type: 'Sphere' };
		let proj;
		if (this.props.projection === 'orthographic') {
			// 球面正射(地球仪);rotate 由 props.globeRotate 控制(拖拽旋转),仅外观不改数据。
			const r = this.props.globeRotate || [0, -15];
			proj = d3.geoOrthographic().rotate([r[0], r[1]]).clipAngle(90);
		} else if (this.props.projection === 'mercator') {
			proj = d3.geoMercator().clipExtent([[0, 0], [w, h]]);
		} else {
			proj = d3.geoEquirectangular();
		}
		proj.fitSize([w, h], sphere);
		return proj;
	}

	rebuild() {
		const host = this.hostRef.current;
		const svg = this.svgRef.current;
		if (!host || !svg) return;
		this.theme = this.computeTheme();
		const th = this.theme;
		const w = host.clientWidth || 960;
		const h = host.clientHeight || 480;
		this.size = { w, h };
		this.projection = this.makeProjection(w, h);
		this.path = d3.geoPath(this.projection);

		const sel = d3.select(svg);
		sel.selectAll('*').remove();
		sel.attr('width', w).attr('height', h).attr('viewBox', `0 0 ${w} ${h}`);

		const root = sel.append('g').attr('class', 'acg-zoom');
		this.root = root;

		root.append('path').datum({ type: 'Sphere' }).attr('d', this.path).attr('fill', th.ocean).attr('stroke', 'none');
		root.append('path').datum(d3.geoGraticule10()).attr('d', this.path).attr('fill', 'none')
			.attr('stroke', th.grid).attr('stroke-width', 0.4).attr('opacity', th.gridOpacity);
		root.append('g').selectAll('path').data(world.features).enter().append('path')
			.attr('d', this.path).attr('fill', th.land).attr('stroke', th.border).attr('stroke-width', 0.4);

		this.heatG = root.append('g').attr('class', 'acg-heat').style('pointer-events', 'none');
		this.zoneG = root.append('g').attr('class', 'acg-zones').style('pointer-events', 'none');
		this.geoG = root.append('g').attr('class', 'acg-geo');
		this.paranG = root.append('g').attr('class', 'acg-paran');
		this.lsG = root.append('g').attr('class', 'acg-ls');
		this.lineG = root.append('g').attr('class', 'acg-lines');
		this.labelG = root.append('g').attr('class', 'acg-labels').style('pointer-events', 'none');
		this.markerG = root.append('g').attr('class', 'acg-markers').style('pointer-events', 'none');

		this.zoomBehavior = d3.zoom().scaleExtent([1, 14]).on('zoom', (ev) => root.attr('transform', ev.transform));
		sel.call(this.zoomBehavior);
		// d3-zoom 状态存在 svg 节点(__zoom),selectAll('*').remove() 清不掉:
		// 缩放后切主题/投影/resize 重建,新 root 在原点而 zoomTransform 仍是旧值 →
		// 点击反演坐标错位 + 首个滚轮手势跳回旧缩放。重建时把旧 transform 重放到新 root。
		sel.call(this.zoomBehavior.transform, d3.zoomTransform(svg));

		sel.on('click', (ev) => {
			if (!this.props.onMapClick || !this.projection) return;
			const [mx, my] = d3.pointer(ev, svg);
			const t = d3.zoomTransform(svg);
			const inv = this.projection.invert([(mx - t.x) / t.k, (my - t.y) / t.k]);
			if (inv && isFinite(inv[0]) && isFinite(inv[1])) this.props.onMapClick(inv[1], inv[0]);
		});

		this.drawAll();
	}

	showTip(ev, g, t) {
		const host = this.hostRef.current;
		if (!host) return;
		const r = host.getBoundingClientRect();
		this.setState({ tip: { x: ev.clientX - r.left + 14, y: ev.clientY - r.top + 14, g, t } });
	}
	hideTip() { this.setState({ tip: null }); }

	stroke(group, d, { color, width, dash, g, t, casing = true }) {
		if (casing) {
			group.append('path').attr('d', d).attr('fill', 'none')
				.attr('stroke', this.theme.casing).attr('stroke-width', width + 1.8)
				.attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
		}
		const line = group.append('path').attr('d', d).attr('fill', 'none')
			.attr('stroke', color).attr('stroke-width', width).attr('stroke-dasharray', dash || null)
			.attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
		if (t || g) {
			line.style('cursor', 'pointer')
				.on('mouseover', (ev) => { line.attr('stroke-width', width + 1.4); this.showTip(ev, g, t); })
				.on('mousemove', (ev) => this.showTip(ev, g, t))
				.on('mouseout', () => { line.attr('stroke-width', width); this.hideTip(); });
		}
		return line;
	}

	// label as a small chip: rounded rect (theme bg + frame) with the glyph inside.
	label(lonlat, glyphText, color) {
		const xy = this.projection(lonlat);
		if (!xy || !isFinite(xy[0]) || !isFinite(xy[1])) return;
		const th = this.theme;
		const g = this.labelG.append('g').attr('transform', `translate(${xy[0].toFixed(1)},${xy[1].toFixed(1)})`);
		const text = g.append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
			.attr('font-family', AstroConst.AstroFont).attr('font-size', 12).attr('fill', color)
			// inline style beats the global `text { stroke }` rule that otherwise outlines the glyph
			.style('stroke', 'none').style('paint-order', 'fill').text(glyphText);
		let bb;
		try { bb = text.node().getBBox(); } catch (e) { bb = { x: -9, y: -7, width: 18, height: 14 }; }
		const px = 3.5, py = 2;
		g.insert('rect', 'text')
			.attr('x', (bb.x - px).toFixed(1)).attr('y', (bb.y - py).toFixed(1))
			.attr('width', (bb.width + 2 * px).toFixed(1)).attr('height', (bb.height + 2 * py).toFixed(1))
			.attr('rx', 3).attr('ry', 3)
			.attr('fill', th.chipBg).attr('stroke', th.chipBorder).attr('stroke-width', 0.9).attr('opacity', 0.97);
	}

	lineVisible(planetKey, field) {
		const lines = this.props.lines;
		if (!lines) return true;
		return lines.has(`${planetKey}:${ANGLE_CONST[field]}`);
	}

	drawAll() {
		if (!this.root || !this.path) return;
		[this.heatG, this.zoneG, this.geoG, this.paranG, this.lsG, this.lineG, this.labelG, this.markerG].forEach((g) => g && g.selectAll('*').remove());
		const data = this.props.value;
		const th = this.theme;
		const showLabels = this.props.showLabels !== false;

		if (this.props.showGeo && data && data.geo) {
			Object.keys(GEO_META).forEach((key) => {
				const pts = data.geo[key];
				if (!pts || !pts.length) return;
				const m = GEO_META[key];
				splitAtDateline(pts).forEach((seg) => {
					this.stroke(this.geoG, this.path({ type: 'LineString', coordinates: seg }),
						{ color: th.geo[m.gkey], width: m.width, dash: m.dash, t: m.label });
				});
			});
		}

		// parans: thin, BRIGHT, dashed latitude lines — no casing so they actually show.
		if (this.props.showParans && data && data.parans && data.parans.length) {
			const isLum = (p) => p.a === AstroConst.SUN || p.b === AstroConst.SUN || p.a === AstroConst.MOON || p.b === AstroConst.MOON;
			const list = this.props.paranAll ? data.parans : data.parans.filter(isLum);
			const seen = new Set();
			list.forEach((p) => {
				const k = Math.round(p.lat);   // dedupe overlapping latitudes (1°) — keep it readable
				if (seen.has(k)) return;
				seen.add(k);
				const coords = [];
				for (let lon = -179; lon <= 179; lon += 20) coords.push([lon, p.lat]);
				coords.push([179, p.lat]);
				const line = this.stroke(this.paranG, this.path({ type: 'LineString', coordinates: coords }), {
					color: th.geo.paran, width: 0.8, dash: '4,8', casing: false,
					g: glyph(p.a) + glyph(p.b), t: `${planetCN(p.a)}/${planetCN(p.b)} 交映`,
				});
				line.attr('opacity', 0.55);
			});
		}

		if (!data || !data.planets) { this.drawMarkers(); return; }

		// 寻宝图热力层(自研透明评分,纯前端;组序在陆地上/线下)
		if (this.props.showTreasure) this.drawTreasure(data);

		if (this.props.showLS) {
			Object.keys(data.planets).forEach((pk) => {
				const ls = data.planets[pk].lines && data.planets[pk].lines.ls;
				if (!ls || !ls.length) return;
				const color = th.colors[pk] || '#888';
				splitAtDateline(ls).forEach((seg) => {
					this.stroke(this.lsG, this.path({ type: 'LineString', coordinates: seg }),
						{ color, width: 1.1, dash: '2,4', g: glyph(pk), t: `${planetCN(pk)} 本地空间` });
				});
			});
		}

		// 影响带(§2.5):行星线两侧半透明带。1°纬=69mi;子午线经度宽 = halfDeg/cosφ(向极加宽)→ 多边形;
		// 升落曲线 = 粗半透明描边(px 由投影度→px 换算)。仅对已选中主线的行星绘制,组序在线下。
		if (this.props.showZones && data.planets) {
			const halfDeg = (this.props.zoneWidth || 600) / 69.0;
			const p0 = this.projection([0, 0]);
			const p10 = this.projection([10, 0]);
			const pxDeg = (p0 && p10) ? Math.abs(p10[0] - p0[0]) / 10 : 5;
			Object.keys(data.planets).forEach((pk) => {
				const L = data.planets[pk].lines || {};
				const color = th.colors[pk] || '#888';
				['mc', 'ic', 'asc', 'desc'].forEach((field) => {
					if (!this.lineVisible(pk, field)) return;
					if (field === 'mc' || field === 'ic') {
						const lon = L[field] && L[field].lon;
						if (lon === undefined || lon === null) return;
						const left = [], right = [];
						for (let la = -80; la <= 80; la += 4) {
							const w = halfDeg / Math.max(0.18, Math.cos(la * Math.PI / 180));
							left.push([lon - w, la]); right.push([lon + w, la]);
						}
						const poly = left.concat(right.reverse()); poly.push(left[0]);
						this.zoneG.append('path').attr('d', this.path({ type: 'Polygon', coordinates: [poly] }))
							.attr('fill', color).attr('opacity', 0.07).attr('stroke', 'none');
					} else {
						const pts = L[field];
						if (!pts || !pts.length) return;
						splitAtDateline(pts).forEach((seg) => {
							this.zoneG.append('path').attr('d', this.path({ type: 'LineString', coordinates: seg }))
								.attr('fill', 'none').attr('stroke', color).attr('opacity', 0.055)
								.attr('stroke-width', Math.min(120, halfDeg * 2 * pxDeg)).attr('stroke-linecap', 'round');
						});
					}
				});
			});
		}

		Object.keys(data.planets).forEach((pk) => {
			const lines = data.planets[pk].lines || {};
			const color = th.colors[pk] || '#888';
			// 恒星黄道读数(选了 ayanamsa 才有);进各线 tooltip 尾巴,物理线本身不变
			const sidLon = data.planets[pk].sidLon;
			const sidTag = (typeof sidLon === 'number') ? ` · 恒${sidLon.toFixed(1)}°` : '';
			['mc', 'ic', 'asc', 'desc'].forEach((field) => {
				if (!this.lineVisible(pk, field)) return;
				const g = glyph(pk) + glyph(ANGLE_CONST[field]);
				const t = `${planetCN(pk)} ${ANGLE_CN[field]}${sidTag}`;
				if (field === 'mc' || field === 'ic') {
					const lon = lines[field] && lines[field].lon;
					if (lon === undefined || lon === null) return;
					const d = this.path({ type: 'LineString', coordinates: [[lon, -85], [lon, 85]] });
					this.stroke(this.lineG, d, { color, width: ANGLE_WIDTH[field], g, t });
					if (showLabels) this.label([lon, field === 'mc' ? 83 : -83], g, color);
				} else {
					const pts = lines[field];
					if (!pts || !pts.length) return;
					splitAtDateline(pts).forEach((seg) => {
						this.stroke(this.lineG, this.path({ type: 'LineString', coordinates: seg }),
							{ color, width: ANGLE_WIDTH[field], g, t });
					});
					if (showLabels) {
						let anchor = pts[0];
						for (let i = 0; i < pts.length; i++) if (Math.abs(pts[i].lat) < Math.abs(anchor.lat)) anchor = pts[i];
						this.label([anchor.lon, anchor.lat], g, color);
					}
				}
			});
			// 相位线(§3.1):仅对已选中主线的行星画,细虚竖线,避免喧宾夺主
			if (this.props.showAspects && Array.isArray(lines.aspects)
				&& ['mc', 'ic', 'asc', 'desc'].some((f) => this.lineVisible(pk, f))) {
				lines.aspects.forEach((a) => {
					if (a.lon === undefined || a.lon === null) return;
					const d = this.path({ type: 'LineString', coordinates: [[a.lon, -80], [a.lon, 80]] });
					this.stroke(this.lineG, d, {
						color, width: 0.7, dash: '3,4', casing: false,
						g: glyph(pk) + (ASPECT_SYM[a.aspect] || ''),
						t: `${planetCN(pk)} ${a.aspect}°相位`,
					}).attr('opacity', 0.6);
				});
			}
			// 东/西点线(§16)+ 天顶点/OOB(§17.1/§17.4):仅对已选中主线的行星画
			if (this.props.showPoints && ['mc', 'ic', 'asc', 'desc'].some((f) => this.lineVisible(pk, f))) {
				[['ep', '东点'], ['wp', '西点']].forEach(([f, cn]) => {
					const lon = lines[f] && lines[f].lon;
					if (lon === undefined || lon === null) return;
					const d = this.path({ type: 'LineString', coordinates: [[lon, -80], [lon, 80]] });
					this.stroke(this.lineG, d, { color, width: 0.8, dash: '1,4', casing: false, g: glyph(pk), t: `${planetCN(pk)} ${cn}` }).attr('opacity', 0.5);
				});
				const z = data.planets[pk].zenith;
				const oob = data.planets[pk].oob;
				if (z) {
					const xy = this.projection([z.lon, z.lat]);
					if (xy && isFinite(xy[0]) && isFinite(xy[1])) {
						const c = this.lineG.append('circle').attr('cx', xy[0].toFixed(1)).attr('cy', xy[1].toFixed(1))
							.attr('r', oob ? 3.6 : 2.4).attr('fill', color)
							.attr('stroke', oob ? '#e0603a' : th.casing).attr('stroke-width', oob ? 1.6 : 0.8);
						c.append('title').text(`${planetCN(pk)} 天顶${oob ? '(超界 OOB)' : ''}`);
					}
				}
				// antiscia 映点/反映点线(§17.5)
				const anti = lines.antiscia;
				if (anti) {
					[['antiscion', '映点', '6,3'], ['contra', '反映点', '2,2,6,2']].forEach(([k, cn, dash]) => {
						const lon = anti[k] && anti[k].lon;
						if (lon === undefined || lon === null) return;
						const d = this.path({ type: 'LineString', coordinates: [[lon, -78], [lon, 78]] });
						this.stroke(this.lineG, d, { color, width: 0.7, dash, casing: false, g: glyph(pk), t: `${planetCN(pk)} ${cn}` }).attr('opacity', 0.45);
					});
				}
				// Vertex/Antivertex 电轴曲线(§16 · 宿命轴)
				[['vertex', '电轴Vertex', '5,3'], ['antivertex', '反电轴', '2,3']].forEach(([k, cn, dash]) => {
					const pts = lines[k];
					if (!pts || !pts.length) return;
					splitAtDateline(pts).forEach((seg) => {
						this.stroke(this.lineG, this.path({ type: 'LineString', coordinates: seg }),
							{ color, width: 0.9, dash, casing: false, g: glyph(pk), t: `${planetCN(pk)} ${cn}` }).attr('opacity', 0.5);
					});
				});
			}
			// Geodetic 地理等价线(§7):地理MC/IC 竖子午线(时间无关映射)
			if (this.props.showGeodetic && lines.geodetic && ['mc', 'ic', 'asc', 'desc'].some((f) => this.lineVisible(pk, f))) {
				[['mc', '地理MC'], ['ic', '地理IC']].forEach(([f, cn]) => {
					const lon = lines.geodetic[f] && lines.geodetic[f].lon;
					if (lon === undefined || lon === null) return;
					const d = this.path({ type: 'LineString', coordinates: [[lon, -82], [lon, 82]] });
					this.stroke(this.lineG, d, { color, width: 1.0, dash: '8,3,2,3', casing: false, g: glyph(pk), t: `${planetCN(pk)} ${cn}` }).attr('opacity', 0.55);
				});
			}
			// 十二宫尖线:中间宫始点(2/3/5/6/8/9/11/12)落于该行星黄经处的曲线,仅当主线选中才画
			if (this.props.showCuspLines && lines.cusps && ['mc', 'ic', 'asc', 'desc'].some((f) => this.lineVisible(pk, f))) {
				Object.keys(lines.cusps).forEach((h) => {
					const pts = lines.cusps[h];
					if (!pts || pts.length < 2) return;
					splitAtDateline(pts).forEach((seg) => {
						this.stroke(this.lineG, this.path({ type: 'LineString', coordinates: seg }),
							{ color, width: 0.6, dash: '2,3', casing: false, g: glyph(pk), t: `${planetCN(pk)} ${h}宫始` }).attr('opacity', 0.4);
					});
				});
			}
		});

		// CCG 时间地图(Lewis):行运/推运行星的角化线(natal 框架投影);数据驱动(设了
		// ccgDate 后端才返回),同色加亮虚线区分本命线;label 前缀 t=行运 / p=二推
		if (data.ccg && data.ccg.planets) {
			const kindCN = { transit: '行运', progressed: '二推' };
			Object.keys(data.ccg.planets).forEach((pk) => {
				if (!['mc', 'ic', 'asc', 'desc'].some((f) => this.lineVisible(pk, f))) return;
				const cp = data.ccg.planets[pk];
				const L = cp.lines || {};
				const color = th.colors[pk] || '#888';
				const tag = `${kindCN[cp.kind] || cp.kind}${planetCN(pk)}`;
				const pfx = cp.kind === 'transit' ? 't' : 'p';
				['mc', 'ic'].forEach((f) => {
					const lon = L[f] && L[f].lon;
					if (lon === undefined || lon === null) return;
					const d = this.path({ type: 'LineString', coordinates: [[lon, -84], [lon, 84]] });
					this.stroke(this.lineG, d, { color, width: 1.1, dash: '7,4', casing: false, g: pfx + glyph(pk), t: `${tag} ${ANGLE_CN[f]}(CCG)` }).attr('opacity', 0.75);
					if (showLabels && f === 'mc') this.label([lon, -83], pfx + glyph(pk), color);
				});
				['asc', 'desc'].forEach((f) => {
					const pts = L[f];
					if (!pts || !pts.length) return;
					splitAtDateline(pts).forEach((seg) => {
						this.stroke(this.lineG, this.path({ type: 'LineString', coordinates: seg }),
							{ color, width: 1.0, dash: '7,4', casing: false, g: pfx + glyph(pk), t: `${tag} ${ANGLE_CN[f]}(CCG)` }).attr('opacity', 0.65);
					});
				});
			});
		}

		// 双人叠加 synastry(§18.3):B 盘四轴线(B 自己的出生框架),点虚线区分;label 前缀 B
		if (data.second && data.second.planets) {
			Object.keys(data.second.planets).forEach((pk) => {
				if (!['mc', 'ic', 'asc', 'desc'].some((f) => this.lineVisible(pk, f))) return;
				const sp = data.second.planets[pk];
				const L = sp.lines || {};
				const color = th.colors[pk] || '#888';
				['mc', 'ic'].forEach((f) => {
					const lon = L[f] && L[f].lon;
					if (lon === undefined || lon === null) return;
					const d = this.path({ type: 'LineString', coordinates: [[lon, -84], [lon, 84]] });
					this.stroke(this.lineG, d, { color, width: 1.0, dash: '2,5', casing: false, g: 'B' + glyph(pk), t: `B盘${planetCN(pk)} ${ANGLE_CN[f]}` }).attr('opacity', 0.7);
					if (showLabels && f === 'mc') this.label([lon, 78], 'B' + glyph(pk), color);
				});
				['asc', 'desc'].forEach((f) => {
					const pts = L[f];
					if (!pts || !pts.length) return;
					splitAtDateline(pts).forEach((seg) => {
						this.stroke(this.lineG, this.path({ type: 'LineString', coordinates: seg }),
							{ color, width: 0.9, dash: '2,5', casing: false, g: 'B' + glyph(pk), t: `B盘${planetCN(pk)} ${ANGLE_CN[f]}` }).attr('opacity', 0.6);
					});
				});
			});
		}

		// 中点线(§3.2):主星两两短弧中点子午线;仅当两星主线都选中才画(避免 45 条全出)
		if (this.props.showMidpoints && data.midpoints && data.midpoints.length) {
			const sel = (id) => ['mc', 'ic', 'asc', 'desc'].some((f) => this.lineVisible(id, f));
			data.midpoints.forEach((m) => {
				if (m.lon === undefined || m.lon === null || !sel(m.a) || !sel(m.b)) return;
				const g = glyph(m.a) + '/' + glyph(m.b);
				const t = `${planetCN(m.a)}/${planetCN(m.b)} 中点`;
				const ic = m.ic && m.ic.lon;
				[[m.lon, '', '1,3'], [ic, '(IC)', '1,4']].forEach(([lon, sfx, dash]) => {
					if (lon === undefined || lon === null) return;
					const d = this.path({ type: 'LineString', coordinates: [[lon, -76], [lon, 76]] });
					this.stroke(this.lineG, d, { color: th.geo.paran, width: 0.7, dash, casing: false, g, t: t + sfx }).attr('opacity', 0.5);
				});
				['asc', 'desc'].forEach((f) => {
					const pts = m[f];
					if (!pts || !pts.length) return;
					splitAtDateline(pts).forEach((seg) => {
						this.stroke(this.lineG, this.path({ type: 'LineString', coordinates: seg }),
							{ color: th.geo.paran, width: 0.6, dash: '1,3', casing: false, g, t: `${t} ${ANGLE_CN[f]}` }).attr('opacity', 0.4);
					});
				});
			});
		}

		// 阿拉伯点线(§3.5):福点/精神点(四线)+ 古典 lots(MC/IC)+ 自定义 A+B−C(金色·特殊点)
		if (this.props.showLots && data.lots) {
			const drawLot = (lot, cn, curves) => {
				if (!lot) return;
				['mc', 'ic'].forEach((f) => {
					const lon = lot[f] && lot[f].lon;
					if (lon === undefined || lon === null) return;
					const d = this.path({ type: 'LineString', coordinates: [[lon, -80], [lon, 80]] });
					this.stroke(this.lineG, d, {
						color: '#d4a017', width: 1.0, dash: f === 'ic' ? '3,3' : '7,3', casing: false,
						t: `${cn}${f === 'ic' ? '(IC)' : ''}`,
					}).attr('opacity', 0.6);
				});
				if (curves) {
					['asc', 'desc'].forEach((f) => {
						const pts = lot[f];
						if (!pts || !pts.length) return;
						splitAtDateline(pts).forEach((seg) => {
							this.stroke(this.lineG, this.path({ type: 'LineString', coordinates: seg }),
								{ color: '#d4a017', width: 0.8, dash: '5,4', casing: false, t: `${cn} ${ANGLE_CN[f]}` }).attr('opacity', 0.5);
						});
					});
				}
			};
			drawLot(data.lots.fortune, '福点', true);
			drawLot(data.lots.spirit, '精神点', true);
			const CLA_CN = { eros: '爱欲点', necessity: '必然点', courage: '勇气点', victory: '胜利点', nemesis: '报应点' };
			if (data.lots.classical) {
				Object.keys(data.lots.classical).forEach((k) => drawLot(data.lots.classical[k], CLA_CN[k] || k, false));
			}
			if (data.lots.custom) drawLot(data.lots.custom, '自定义(' + (data.lots.custom.formula || '') + ')', true);
		}

		// 振动线(§20.5·Cochrane 5/7/9):选中主线的行星,H 族分点向 MC/ASC 的相位线(细·彩虹分色)
		if (this.props.showVibration && data.planets) {
			const VIB_COL = { 5: '#c77dbb', 7: '#7d9dc7', 9: '#7dc79d' };
			Object.keys(data.planets).forEach((pk) => {
				const vib = data.planets[pk].lines && data.planets[pk].lines.vibration;
				if (!vib || !this.lineVisible(pk, 'mc')) return;
				['5', '7', '9'].forEach((H) => {
					(vib[H] || []).forEach((T) => {
						if (T.mc && T.mc.lon != null) {
							const d = this.path({ type: 'LineString', coordinates: [[T.mc.lon, -74], [T.mc.lon, 74]] });
							this.stroke(this.lineG, d, { color: VIB_COL[H], width: 0.55, dash: '1,4', casing: false, t: `${planetCN(pk)} H${H}振动线` }).attr('opacity', 0.42);
						}
						if (T.asc && T.asc.length) {
							splitAtDateline(T.asc).forEach((seg) => this.stroke(this.lineG, this.path({ type: 'LineString', coordinates: seg }),
								{ color: VIB_COL[H], width: 0.5, dash: '1,5', casing: false, t: `${planetCN(pk)} H${H}振动·升` }).attr('opacity', 0.32));
						}
					});
				});
			});
		}

		// 关系盘 A×B 交叉/派状(§18.3):synastry 时 A 线×B 线交点(青菱)+ 派状纬线(青虚横线)
		if (this.props.showRelCross && data.second) {
			(data.second.relCrossings || []).forEach((x) => {
				const xy = this.projection([x.lon, x.lat]);
				if (!xy || !isFinite(xy[0]) || !isFinite(xy[1])) return;
				const s = 2.8;
				const dm = this.lineG.append('path')
					.attr('d', `M${xy[0].toFixed(1)},${(xy[1] - s).toFixed(1)} L${(xy[0] + s).toFixed(1)},${xy[1].toFixed(1)} L${xy[0].toFixed(1)},${(xy[1] + s).toFixed(1)} L${(xy[0] - s).toFixed(1)},${xy[1].toFixed(1)} Z`)
					.attr('fill', '#2fb6c0').attr('stroke', th.casing).attr('stroke-width', 0.5).attr('opacity', 0.8);
				dm.append('title').text(`${x.aWho}·${planetCN(x.a)}${ANGLE_CN[x.aAngle] || x.aAngle} × ${x.bWho}·${planetCN(x.b)}${ANGLE_CN[x.bAngle] || x.bAngle} 关系交叉`);
			});
			(data.second.relParans || []).forEach((p) => {
				const d = this.path({ type: 'LineString', coordinates: [[-179, p.lat], [0, p.lat], [179, p.lat]] });
				this.stroke(this.lineG, d, { color: '#2fb6c0', width: 0.5, dash: '2,6', casing: false, t: `关系派状 ${planetCN(p.a)}/${planetCN(p.b)} @${p.lat}°` }).attr('opacity', 0.3);
			});
		}

		// 线交叉点(§3.3):两星同时角化的"命运点";红菱标记,仅两星主线都选中才画
		if (this.props.showCrossings && data.crossings && data.crossings.length) {
			const sel = (id) => ['mc', 'ic', 'asc', 'desc'].some((f) => this.lineVisible(id, f));
			data.crossings.forEach((x) => {
				if (!sel(x.a) || !sel(x.b)) return;
				const xy = this.projection([x.lon, x.lat]);
				if (!xy || !isFinite(xy[0]) || !isFinite(xy[1])) return;
				const s = 3.2;
				const dm = this.lineG.append('path')
					.attr('d', `M${xy[0].toFixed(1)},${(xy[1] - s).toFixed(1)} L${(xy[0] + s).toFixed(1)},${xy[1].toFixed(1)} L${xy[0].toFixed(1)},${(xy[1] + s).toFixed(1)} L${(xy[0] - s).toFixed(1)},${xy[1].toFixed(1)} Z`)
					.attr('fill', '#e8523a').attr('stroke', th.casing).attr('stroke-width', 0.6).attr('opacity', 0.85);
				dm.append('title').text(`${planetCN(x.a)}${ANGLE_CN[x.aAngle] || x.aAngle} × ${planetCN(x.b)}${ANGLE_CN[x.bAngle] || x.bAngle} 交叉`);
			});
		}

		// 固定星线(Brady):18 主要恒星 MC/IC/ASC/DSC,细金线 + 星名;opt-in(后端 stars=1)
		if (this.props.showStars && Array.isArray(data.stars) && data.stars.length) {
			const scol = this.state.themeName === 'dark' ? '#d9c07a' : '#9a7b25';
			data.stars.forEach((st) => {
				const L = st.lines || {};
				['mc', 'ic'].forEach((f) => {
					const lon = L[f] && L[f].lon;
					if (lon === undefined || lon === null) return;
					const d = this.path({ type: 'LineString', coordinates: [[lon, -82], [lon, 82]] });
					this.stroke(this.lineG, d, { color: scol, width: 0.6, dash: '1,3', casing: false, t: `${st.name} ${f === 'mc' ? '中天' : '天底'}` }).attr('opacity', 0.5);
				});
				['asc', 'desc'].forEach((f) => {
					const pts = L[f];
					if (!pts || !pts.length) return;
					splitAtDateline(pts).forEach((seg) => {
						this.stroke(this.lineG, this.path({ type: 'LineString', coordinates: seg }), { color: scol, width: 0.6, dash: '1,3', casing: false, t: `${st.name} ${f === 'asc' ? '上升' : '下降'}` }).attr('opacity', 0.45);
					});
				});
				if (showLabels && L.mc && typeof L.mc.lon === 'number') {
					const xy = this.projection([L.mc.lon, 80]);
					if (xy && isFinite(xy[0]) && isFinite(xy[1])) {
						this.labelG.append('text').attr('x', xy[0].toFixed(1)).attr('y', xy[1].toFixed(1)).attr('text-anchor', 'middle')
							.attr('font-size', 9).attr('fill', scol).style('stroke', 'none').text(st.name);
					}
				}
			});
		}
		// 固定星交映 parans(Brady Starlight):恒星×行星同时角化的纬度线;1°去重+细虚,双 opt-in
		if (this.props.showStars && this.props.showStarParans && Array.isArray(data.starParans) && data.starParans.length) {
			const pcol = this.state.themeName === 'dark' ? '#c9a9d6' : '#6b4e86';
			const starCN = {};
			(data.stars || []).forEach((s) => { starCN[s.key] = s.name; });
			const seen = new Set();
			data.starParans.forEach((p) => {
				const k = Math.round(p.lat);
				if (seen.has(k)) return;
				seen.add(k);
				const coords = [];
				for (let lon = -179; lon <= 179; lon += 20) coords.push([lon, p.lat]);
				coords.push([179, p.lat]);
				this.stroke(this.paranG, this.path({ type: 'LineString', coordinates: coords }), {
					color: pcol, width: 0.6, dash: '2,6', casing: false,
					t: `${starCN[p.star] || p.star}/${planetCN(p.planet)} 交映 ${p.lat.toFixed(1)}°`,
				}).attr('opacity', 0.4);
			});
		}

		this.drawMarkers();
	}

	// ── 寻宝图(Treasure Map)自研透明评分热力 ────────────────────────────────
	// 评分 = Σ 行星权重 × 角点系数 × exp(−½(d/σ)²);d=该点到线的角距(经差×cosφ 近似),
	// σ=2.5°、8°截断(1°≈70mi/111km 衰减锚);只计当前选中的行星线(可自行"定主题")。
	// 权重(古典吉凶,完全公开):木/金+2 日/月+1 水+0.5 | 土−2 火−1.5 冥−1 天/海−0.5;
	// MC/ASC×1、IC/DSC×0.75。金色=有利集中带,蓝色=压力集中带。纯渲染层:不改任何后端数据。
	buildCurveLUT(pts, w) {
		const lut = new Array(181).fill(NaN);
		for (let i = 0; i < pts.length - 1; i++) {
			const a = pts[i], b = pts[i + 1];
			let lonA = a.lon, lonB = b.lon;
			if (lonB - lonA > 180) lonB -= 360;
			else if (lonB - lonA < -180) lonB += 360;
			let la = Math.round(a.lat) + 90, lb = Math.round(b.lat) + 90;
			if (la > lb) { const t = la; la = lb; lb = t; const u = lonA; lonA = lonB; lonB = u; }
			for (let s = Math.max(0, la); s <= Math.min(180, lb); s++) {
				const t = (lb === la) ? 0 : (s - la) / (lb - la);
				let v = lonA + t * (lonB - lonA);
				v = ((v + 180) % 360 + 360) % 360 - 180;
				lut[s] = v;
			}
		}
		return { w, lut };
	}

	drawTreasure(data) {
		if (!this.heatG || !this.projection || !data || !data.planets) return;
		const { w, h } = this.size;
		if (!w || !h || typeof document === 'undefined') return;
		const dark = this.state.themeName === 'dark';
		const key = `${this.props.projection}|${w}x${h}|${dark}`;
		if (!(this._heatUrl && this._heatData === data && this._heatLines === this.props.lines && this._heatKey === key)) {
			const W_PLANET = {
				[AstroConst.SUN]: 1, [AstroConst.MOON]: 1, [AstroConst.MERCURY]: 0.5,
				[AstroConst.VENUS]: 2, [AstroConst.MARS]: -1.5, [AstroConst.JUPITER]: 2,
				[AstroConst.SATURN]: -2, [AstroConst.URANUS]: -0.5, [AstroConst.NEPTUNE]: -0.5,
				[AstroConst.PLUTO]: -1,
			};
			const W_ANGLE = { mc: 1, asc: 1, ic: 0.75, desc: 0.75 };
			const SIG = 2.5, CUT = 8;
			const meridians = [], curves = [];
			Object.keys(W_PLANET).forEach((pk) => {
				const pd = data.planets[pk];
				if (!pd || !pd.lines) return;
				['mc', 'ic', 'asc', 'desc'].forEach((f) => {
					if (!this.lineVisible(pk, f)) return;
					const wgt = W_PLANET[pk] * W_ANGLE[f];
					if (f === 'mc' || f === 'ic') {
						const L = pd.lines[f];
						if (L && typeof L.lon === 'number') meridians.push({ w: wgt, lon: L.lon });
					} else {
						const pts = pd.lines[f];
						if (pts && pts.length > 2) curves.push(this.buildCurveLUT(pts, wgt));
					}
				});
			});
			if (!meridians.length && !curves.length) return;
			const scale = 3;
			const gw = Math.ceil(w / scale), gh = Math.ceil(h / scale);
			const canvas = document.createElement('canvas');
			canvas.width = gw; canvas.height = gh;
			const ctx = canvas.getContext && canvas.getContext('2d');
			if (!ctx) return;   // SSR/jsdom 无 canvas → 静默跳过
			const img = ctx.createImageData(gw, gh);
			const pos = dark ? [246, 196, 84] : [212, 148, 18];
			const neg = dark ? [96, 132, 208] : [58, 92, 168];
			const D2R = Math.PI / 180;
			for (let y = 0; y < gh; y++) {
				for (let x = 0; x < gw; x++) {
					const inv = this.projection.invert([x * scale + scale / 2, y * scale + scale / 2]);
					if (!inv || !isFinite(inv[0]) || !isFinite(inv[1])) continue;
					const lon = inv[0], lat = inv[1];
					if (lat > 85 || lat < -85) continue;
					const cosl = Math.cos(lat * D2R);
					let s = 0;
					for (let i = 0; i < meridians.length; i++) {
						let dl = Math.abs(lon - meridians[i].lon) % 360;
						if (dl > 180) dl = 360 - dl;
						const d = dl * cosl;
						if (d < CUT) s += meridians[i].w * Math.exp(-0.5 * (d / SIG) * (d / SIG));
					}
					const li = Math.round(lat) + 90;
					for (let i = 0; i < curves.length; i++) {
						const clon = curves[i].lut[li];
						if (clon !== clon || clon === undefined) continue;
						let dl = Math.abs(lon - clon) % 360;
						if (dl > 180) dl = 360 - dl;
						const d = dl * cosl;
						if (d < CUT) s += curves[i].w * Math.exp(-0.5 * (d / SIG) * (d / SIG));
					}
					if (s === 0) continue;
					const k = (y * gw + x) * 4;
					const c = s > 0 ? pos : neg;
					img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2];
					img.data[k + 3] = Math.round(Math.min(0.6, Math.abs(s) / 4 * 0.6) * 255);
				}
			}
			ctx.putImageData(img, 0, 0);
			let url;
			try { url = canvas.toDataURL(); } catch (e) { return; }
			this._heatData = data; this._heatLines = this.props.lines; this._heatKey = key; this._heatUrl = url;
		}
		this.heatG.append('image')
			.attr('href', this._heatUrl).attr('xlink:href', this._heatUrl)
			.attr('x', 0).attr('y', 0).attr('width', w).attr('height', h)
			.attr('preserveAspectRatio', 'none').attr('opacity', 0.9);
	}

	drawMarkers() {
		if (!this.markerG) return;
		const data = this.props.value;
		const th = this.theme;
		if (data && data.meta && data.meta.birth) {
			const b = data.meta.birth;
			const xy = this.projection([b.lon, b.lat]);
			if (xy && isFinite(xy[0])) {
				this.markerG.append('circle').attr('cx', xy[0]).attr('cy', xy[1]).attr('r', 4)
					.attr('fill', th.markerFill).attr('stroke', th.markerStroke).attr('stroke-width', 2);
			}
		}
		const m = this.props.clickMarker;
		if (m && typeof m.lat === 'number') {
			const xy = this.projection([m.lon, m.lat]);
			if (xy && isFinite(xy[0])) {
				const g = this.markerG.append('g');
				g.append('circle').attr('cx', xy[0]).attr('cy', xy[1]).attr('r', 6)
					.attr('fill', 'none').attr('stroke', '#ff5d5d').attr('stroke-width', 2.4);
				g.append('line').attr('x1', xy[0] - 9).attr('y1', xy[1]).attr('x2', xy[0] + 9).attr('y2', xy[1])
					.attr('stroke', '#ff5d5d').attr('stroke-width', 1.4);
				g.append('line').attr('x1', xy[0]).attr('y1', xy[1] - 9).attr('x2', xy[0]).attr('y2', xy[1] + 9)
					.attr('stroke', '#ff5d5d').attr('stroke-width', 1.4);
			}
		}
	}

	render() {
		const height = this.props.height || 600;
		const tip = this.state.tip;
		const th = THEMES[this.state.themeName] || THEMES.light;
		return (
			<div className="horosa-acg-d3-map"
				ref={(el) => { this.hostRef.current = el; }}
				style={{ position: 'relative', width: '100%', height, overflow: 'hidden', background: th.ocean }}
			>
				<svg ref={(el) => { this.svgRef.current = el; }} style={{ display: 'block', width: '100%', height: '100%' }} />
					{(() => {
					const v = this.props.value;
					const rm = v && v.meta && v.meta.relMode;
					if (!rm) return null;
					const name = { davison: '戴维森时空中点盘', composite: '中点合盘', synastry: '双人叠加' }[rm] || rm;
					const dv = v.meta.davison;
					return (
						<div style={{
							position: 'absolute', right: 8, top: 6, pointerEvents: 'none',
							background: th.tipBg, color: th.tipFg, border: `1px solid ${th.tipBorder}`,
							padding: '2px 8px', borderRadius: 5, fontSize: 11, opacity: 0.92,
						}}>
							关系盘 · {name}{dv ? ` · ${dv.date} ${dv.time} UT @ ${dv.lat}°,${dv.lon}°` : ''}
						</div>
					);
				})()}
				{this.props.showTreasure ? (
					<div style={{
						position: 'absolute', left: 8, bottom: 6, pointerEvents: 'none', maxWidth: '72%',
						background: th.tipBg, color: th.tipFg, border: `1px solid ${th.tipBorder}`,
						padding: '3px 8px', borderRadius: 5, fontSize: 11, lineHeight: 1.5, opacity: 0.92,
					}}>
						寻宝图 · <span style={{ color: '#f0c060' }}>金=有利带</span> / <span style={{ color: '#8fb0e8' }}>蓝=压力带</span> · 权重:木金+2 日月+1 水+0.5|土−2 火−1.5 冥−1 天海−0.5 · MC/ASC×1 IC/DSC×0.75 · 高斯衰减σ2.5°截8°(1°≈70mi) · 只计已选行星线
					</div>
				) : null}
				{tip ? (
					<div style={{
						position: 'absolute', left: tip.x, top: tip.y, pointerEvents: 'none',
						background: th.tipBg, color: th.tipFg, padding: '3px 9px', borderRadius: 5,
						whiteSpace: 'nowrap', zIndex: 5, border: `1px solid ${th.tipBorder}`,
						display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
					}}>
						{tip.g ? <span style={{ fontFamily: AstroConst.AstroFont, fontSize: 15 }}>{tip.g}</span> : null}
						{tip.t ? <span>{tip.t}</span> : null}
					</div>
				) : null}
			</div>
		);
	}
}

export default AcgD3Map;
export { AstroColor, STYLES };
