import { Component } from 'react';
import { markPanelReady } from '../../utils/perfMark';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import moment from 'moment';
import { DatePicker, Radio, Spin, Empty, Checkbox, Select } from 'antd';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import { SA_RATE } from '../../utils/uranianDial';

const { RangePicker } = DatePicker;

// 汉堡/宇宙生物学「图形星历」(graphic ephemeris):X=时间、Y=黄经折叠到盘基(90°/45°)。
// 行运行星折叠后随时间画成斜线(快星呈锯齿),本命点为水平参考线;两者相交≈该折叠相位(0/90/180/270)应期。
// 数据复用现成 /astroextra/ephemeris 的 dailyPositions(逐日黄经,后端封 Swiss Ephemeris),折叠纯前端算,改盘基即时重折叠不重取。

// 默认行运行星:日 + 火 + 木土天海冥(月太快,90°盘约每 7.5 天绕一圈,默认不画;可勾选)。
const DEFAULT_PLANETS = [
	AstroConst.SUN, AstroConst.MARS, AstroConst.JUPITER, AstroConst.SATURN,
	AstroConst.URANUS, AstroConst.NEPTUNE, AstroConst.PLUTO,
];
// 本命参考线:行星 + 南北交 + Asc/MC + 白羊点(TNP 移动极慢,作参考线意义小,v1 不画)。
const NATAL_LINE_IDS = new Set([
	AstroConst.SUN, AstroConst.MOON, AstroConst.MERCURY, AstroConst.VENUS, AstroConst.MARS,
	AstroConst.JUPITER, AstroConst.SATURN, AstroConst.URANUS, AstroConst.NEPTUNE, AstroConst.PLUTO,
	AstroConst.NORTH_NODE, AstroConst.SOUTH_NODE, AstroConst.ASC, AstroConst.MC,
]);

// 图形星历专用「行星配色」:全站主题色板(AstroColor)在多数主题下行星为单色(#3b3b3b/#333),
// 折线全挤成一团难分辨。这里给每颗参与星一组中等饱和度、明暗两主题都清晰可辨的固定色——
// 折线 stroke 与右侧字形 fill 共用同一映射,确保「线↔字形」永远同色(任务 E)。纯视觉,不动计算。
const GEPHEM_PLANET_TONE = {
	[AstroConst.SUN]: '#e0a52e',        // 日 金黄
	[AstroConst.MOON]: '#6f8fd0',       // 月 蓝银
	[AstroConst.MERCURY]: '#e07b39',    // 水 橙
	[AstroConst.VENUS]: '#3f9e6a',      // 金 绿
	[AstroConst.MARS]: '#d24b46',       // 火 红
	[AstroConst.JUPITER]: '#7b5cbc',    // 木 紫
	[AstroConst.SATURN]: '#8a6d3b',     // 土 褐
	[AstroConst.URANUS]: '#2f9e9e',     // 天 青
	[AstroConst.NEPTUNE]: '#4a78c2',    // 海 靛
	[AstroConst.PLUTO]: '#a85aa8',      // 冥 品红
	[AstroConst.NORTH_NODE]: '#9a8f5a', // 北交 黄褐
	[AstroConst.SOUTH_NODE]: '#9a8f5a', // 南交 黄褐
	[AstroConst.ASC]: '#5f9e8a',        // 升 灰青
	[AstroConst.MC]: '#5f9e8a',         // 中天 灰青
};
// 星名(行运线 hover tooltip 用):TNP 缩写;白羊点取 Aries;其余取中文名 fallback 英文 id。
function planetName(id){
	if (AstroText.isUranian(id) && id !== AstroConst.ARIES_POINT) return AstroText.uranianGlyph(id);
	return AstroText.AstroMsgCN[id] || id;
}
// 折线/字形取色:优先专用色板,缺则回落全站主题色,再回落柔和文字色。
function toneOf(id, fallback){ return GEPHEM_PLANET_TONE[id] || AstroConst.AstroColor[id] || fallback || '#888'; }

const fold = (lon, base) => (((Number(lon) % base) + base) % base);
const fv = (fields, key) => { const f = fields && fields[key]; return f ? f.value : undefined; };
const fmt = (val, pattern) => ((val && typeof val.format === 'function') ? val.format(pattern) : undefined);

function fieldsToBase(fields){
	if (!fields) return null;
	return {
		date: fmt(fv(fields, 'date'), 'YYYY/MM/DD'), time: fmt(fv(fields, 'time'), 'HH:mm:ss'),
		zone: fv(fields, 'zone') || '+08:00', lat: fv(fields, 'lat'), lon: fv(fields, 'lon'),
		gpsLat: fv(fields, 'gpsLat'), gpsLon: fv(fields, 'gpsLon'),
		hsys: fv(fields, 'hsys'), zodiacal: fv(fields, 'zodiacal'), siderealAyanamsa: fv(fields, 'siderealAyanamsa'),
		// [SURF-5] 古典设置单源接入;条件发送=默认态字节不变。
		// [SURF-R3g] 有意不带古典键:唯一去处 /astroextra/ephemeris 的图形星历腿(includeTransits:false)
		// 端点纯 swe 按 jd 取位、无 push 临界区=零消费——带键只白翻缓存键(「接了后端不消费=造新死链」豁免)。
	};
}
function paramsReady(p){
	if (!p) return false;
	return ['date', 'time', 'zone', 'lat', 'lon'].every((k) => p[k] !== undefined && p[k] !== null && `${p[k]}`.trim() !== '');
}

// 本命参考点(行星/角点/白羊点)——从已排的本命盘对象取,无需额外请求。
function natalLines(chartRoot){
	const inner = (chartRoot && chartRoot.chart) ? chartRoot.chart : (chartRoot || {});
	const out = []; const seen = new Set();
	const push = (id, lon) => { if (id && Number.isFinite(Number(lon)) && !seen.has(id)) { out.push({ id, lon: Number(lon) }); seen.add(id); } };
	(inner.objects || []).forEach((o) => { if (NATAL_LINE_IDS.has(o.id)) push(o.id, o.lon); });
	(inner.angles || []).forEach((o) => { if (NATAL_LINE_IDS.has(o.id)) push(o.id, o.lon); });
	push(AstroConst.ARIES_POINT, 0);
	return out;
}

function planetGlyph(id, color, size){
	const tnp = AstroText.isUranian(id) && id !== AstroConst.ARIES_POINT;
	if (tnp) return <tspan style={{ fontWeight: 600 }}>{AstroText.uranianGlyph(id)}</tspan>;
	const ch = id === AstroConst.ARIES_POINT ? AstroText.AstroMsg[AstroConst.ARIES] : AstroText.AstroMsg[id];
	if (ch) return <tspan style={{ fontFamily: AstroConst.AstroChartFont }} fill={color}>{ch}</tspan>;
	return <tspan>{AstroText.AstroMsgCN[id] || id}</tspan>;
}

export default class UranianGraphicEphemeris extends Component {
	constructor(props){
		super(props);
		const disp = (() => { try { return JSON.parse(localStorage.getItem('horosa.uranian.gephem.v1') || '{}') || {}; } catch (e) { return {}; } })();
		this.state = {
			base: [90, 45, 22.5].indexOf(disp.base) >= 0 ? disp.base : 90,
			// 太阳弧生命图模式:X 轴改年龄、本命=水平线、推进因子=斜线(同速率→平行线族)、
			// 交叉=该行星图在何岁完成。纯前端(推进位=本命+年龄×速率,折叠),零星历请求。
			mode: disp.mode === 'life' ? 'life' : 'transit',
			lifeFocus: disp.lifeFocus || AstroConst.SUN,
			lifeRate: ['naibod', 'cardan', 'oneDeg'].indexOf(disp.lifeRate) >= 0 ? disp.lifeRate : 'naibod',
			includeMoon: !!disp.includeMoon,
			start: moment().startOf('day'),
			end: moment().add(364, 'days').startOf('day'),
			rows: null,
			loading: false,
			note: null,
			vw: typeof window !== 'undefined' ? window.innerWidth : 1200,
			vh: typeof window !== 'undefined' ? window.innerHeight : 900,
			cw: 0, // 实测容器内宽(像素空间渲染用)
			tip: null, // 线 hover 弹窗(任务 B:像 ACG 地图,state 驱动 absolute div)
		};
		this.unmounted = false;
		this.requestData = this.requestData.bind(this);
		this._onResize = this._onResize.bind(this);
		this._measure = this._measure.bind(this);
		this.showTip = this.showTip.bind(this);
		this.hideTip = this.hideTip.bind(this);
		// ephemBase 接线:90°盘切流派广播该派图形星历盘基 → 已挂载实例实时换盘(折叠纯前端,零重取)。
		this._onEphemBase = (e) => {
			const b = e && e.detail ? e.detail.base : null;
			if (!this.unmounted && [90, 45, 22.5].indexOf(b) >= 0 && b !== this.state.base) this.setState({ base: b });
		};
		if (this.props.hook) this.props.hook.fun = () => { if (!this.unmounted) this.requestData(); };
	}
	componentDidMount(){ this.unmounted = false; this.requestData(); this._measure(); if (typeof window !== 'undefined') { window.addEventListener('resize', this._onResize); window.addEventListener('horosa-uranian-ephembase', this._onEphemBase); } }
	componentWillUnmount(){ this.unmounted = true; if (typeof window !== 'undefined') { window.removeEventListener('resize', this._onResize); window.removeEventListener('horosa-uranian-ephembase', this._onEphemBase); } }
	componentDidUpdate(prev){ if (prev.fields !== this.props.fields) this.requestData(); this._measure(); }
	_onResize(){ if (!this.unmounted) { this.setState({ vw: window.innerWidth, vh: window.innerHeight }); this._measure(); } }
	// 线 hover 弹窗(任务 B):鼠标移到行运折线/本命参考线 → 显「色点 + 星名(本命/行运)」,像 ACG 地图;state 驱动 absolute div,host 须 position:relative。
	showTip(e, id, kind){ if (this.unmounted || !this._tipHost) return; const r = this._tipHost.getBoundingClientRect(); this.setState({ tip: { x: e.clientX - r.left + 14, y: e.clientY - r.top + 14, id, kind, color: toneOf(id, '#888') } }); }
	hideTip(){ if (!this.unmounted && this.state.tip) this.setState({ tip: null }); }
	_measure(){ if (this.unmounted || !this._wrap) return; const w = this._wrap.clientWidth - 16; if (w > 0 && Math.abs(w - this.state.cw) > 2) this.setState({ cw: w }); }

	saveDisp(patch, cb){ this.setState(patch, cb); try { const cur = JSON.parse(localStorage.getItem('horosa.uranian.gephem.v1') || '{}') || {}; safeLocalStorageSet('horosa.uranian.gephem.v1', JSON.stringify({ ...cur, ...patch })); } catch (e) { /* noop */ } }

	planetSet(){ return this.state.includeMoon ? [AstroConst.MOON, ...DEFAULT_PLANETS] : DEFAULT_PLANETS; }

	async requestData(){
		const base = fieldsToBase(this.props.fields);
		if (!paramsReady(base)) { if (!this.unmounted) this.setState({ note: '请先完善出生信息后查看图形星历', rows: null }); return; }
		// 后端 dailyPositions 上限 ~370 天;范围超限则截断并提示。
		let s = this.state.start, e = this.state.end;
		if (e.diff(s, 'days') > 366) { e = s.clone().add(366, 'days'); }
		const params = {
			...base,
			startDate: s.format('YYYY/MM/DD'), endDate: e.format('YYYY/MM/DD'),
			startTime: '00:00:00', endTime: '00:00:00',
			planets: this.planetSet(), includeTransits: false,
		};
		this.setState({ loading: true, note: null });
		try {
			const data = await request(`${Constants.ServerRoot}/astroextra/ephemeris`, { body: JSON.stringify(params), silent: true });
			const res = data && data[Constants.ResultKey] ? data[Constants.ResultKey] : null;
			const rows = res && Array.isArray(res.dailyPositions) ? res.dailyPositions : [];
			// horosa_panel_ready_v1:图形星历(量化盘第三子页)的折线图与右侧图例全部由 rows 派生,
			// 这一次 setState 即「面板数据落定」(折叠计算是纯前端同步,随本次 render 一并完成)。
			if (!this.unmounted) this.setState({ rows, loading: false, note: rows.length ? null : '该区间无星历数据' }, ()=>{
				markPanelReady('auxchart');
			});
		} catch (err) { if (!this.unmounted) this.setState({ loading: false, note: '星历获取失败' }); }
	}

	// 太阳弧生命图(Lebensdiagramm):X=年龄 0..90、Y=折叠黄经。本命因子=水平虚线;
	// 推进因子=斜线(推进位=本命+年龄×速率,同速率→平行线族,跨折叠界断段);
	// 聚焦因子的推进线与各本命线交叉点=该行星图在此岁完成(圆点+悬停读岁)。纯前端零请求。
	renderLife(controls, W, H, mL, mR, mT, mB, stroke, soft){
		const base = this.state.base;
		const nat = natalLines(this.props.chart);
		const rate = SA_RATE[this.state.lifeRate] || SA_RATE.naibod;
		const MAX_AGE = 90;
		const plotW = W - mL - mR, plotH = H - mT - mB;
		const xAt = (age) => mL + (age / MAX_AGE) * plotW;
		const yAt = (f) => mT + (f / base) * plotH;

		// 推进斜线:采样 0..90 步长 0.5,跨折叠界(相邻差>base/2)断段——与行运模式 series 同构。
		const series = nat.map((p) => {
			const color = toneOf(p.id, soft);
			const segs = []; let cur = [];
			for (let age = 0; age <= MAX_AGE; age += 0.5){
				const f = fold(p.lon + age * rate, base);
				if (cur.length){ const prevF = cur[cur.length - 1].f; if (Math.abs(f - prevF) > base / 2) { segs.push(cur); cur = []; } }
				cur.push({ x: xAt(age), y: yAt(f), f });
			}
			if (cur.length) segs.push(cur);
			const d = segs.map((seg) => seg.map((pt, k) => `${k === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')).join(' ');
			return { pid: p.id, color, d, endY: yAt(fold(p.lon + MAX_AGE * rate, base)) };
		});

		// 聚焦因子交点:F 推进线与每条本命水平线的相交岁数 = (fold(B−F) + k·base)/rate ≤ 90。
		const focus = nat.find((p) => p.id === this.state.lifeFocus) || nat[0];
		const hits = [];
		if (focus){
			nat.forEach((b) => {
				const delta = fold(b.lon - focus.lon, base);
				for (let k = 0; ; k++){
					const age = (delta + k * base) / rate;
					if (age > MAX_AGE) break;
					if (age >= 0.25){ hits.push({ age, from: focus.id, to: b.id, x: xAt(age), y: yAt(fold(b.lon, base)) }); }
				}
			});
		}

		const fmtDeg = (v) => (Number.isInteger(v) ? `${v}°` : `${v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}°`);
		const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ v: (base * t), y: yAt(base * t) }));
		const ageTicks = []; for (let a = 0; a <= MAX_AGE; a += 10) ageTicks.push(a);
		const vspread = (items, minGap, lo, hi) => {
			const s = items.slice().sort((a, b) => a.y - b.y);
			let prev = -Infinity;
			s.forEach((it) => { const g = Math.max(it.y, prev + minGap); it.labelY = g; prev = g; });
			const over = s.length ? (s[s.length - 1].labelY - hi) : 0;
			if (over > 0) s.forEach((it) => { it.labelY = Math.max(lo, it.labelY - over); });
			return s;
		};
		const natLabels = vspread(nat.map((p) => ({ id: p.id, y: yAt(fold(p.lon, base)), color: toneOf(p.id, soft) })), 18, mT + 2, mT + plotH - 2);
		const traLabels = vspread(series.map((s) => ({ id: s.pid, y: s.endY, color: s.color })), 18, mT + 2, mT + plotH - 2);
		const natX = mL + plotW + 8;
		const traX = mL + plotW + 32;

		return (
			<div ref={(el) => { this._wrap = el; }} className="horosa-uranian-gephem" style={{ padding: '4px 8px' }}>
				{controls}
				<div style={{ width: '100%', position: 'relative' }} ref={(el) => { this._tipHost = el; }}>
					<svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block', maxWidth: '100%', color: stroke }}
						className="xq-chart-renderer xq-chart-renderer-astro">
						<rect x={mL} y={mT} width={plotW} height={plotH} fill="none" stroke={stroke} strokeWidth="1" opacity="0.5" />
						{yTicks.map((t, i) => (
							<g key={`y${i}`}>
								<line x1={mL} y1={t.y} x2={mL + plotW} y2={t.y} stroke={stroke} strokeWidth="0.6" opacity="0.18" />
								<text x={mL - 6} y={t.y} dy="0.32em" textAnchor="end" fontSize="10" fill={soft}>{fmtDeg(t.v)}</text>
							</g>
						))}
						{ageTicks.map((a) => (
							<g key={`a${a}`}>
								<line x1={xAt(a)} y1={mT} x2={xAt(a)} y2={mT + plotH} stroke={stroke} strokeWidth="0.5" opacity="0.12" />
								<text x={xAt(a)} y={mT + plotH + 16} textAnchor="middle" fontSize="9" fill={soft}>{a}岁</text>
							</g>
						))}
						{nat.map((p, i) => {
							const y = yAt(fold(p.lon, base));
							const color = toneOf(p.id, soft);
							return (
								<g key={`n${i}`}>
									<line x1={mL} y1={y} x2={mL + plotW} y2={y} stroke="transparent" strokeWidth="7" style={{ cursor: 'pointer' }} onMouseMove={(e) => this.showTip(e, p.id, '本命')} onMouseLeave={this.hideTip} />
									<line x1={mL} y1={y} x2={mL + plotW} y2={y} stroke={color} strokeWidth="0.9" strokeDasharray="3,3" opacity="0.45" style={{ pointerEvents: 'none' }} />
								</g>
							);
						})}
						{series.map((s, i) => (
							<g key={`s${i}`} className="horosa-gephem-line">
								{s.d ? <path d={s.d} fill="none" stroke="transparent" strokeWidth="9" strokeLinejoin="round" style={{ cursor: 'pointer' }} onMouseMove={(e) => this.showTip(e, s.pid, '太阳弧推进')} onMouseLeave={this.hideTip} /> : null}
								<path className="horosa-gephem-line-vis" d={s.d} fill="none" stroke={s.color}
									strokeWidth={s.pid === (focus && focus.id) ? 2.4 : 1.1}
									opacity={s.pid === (focus && focus.id) ? 0.95 : 0.5} style={{ pointerEvents: 'none' }} />
							</g>
						))}
						{/* 聚焦因子交点:圆点=该行星图完成之岁;悬停显「推进→本命 · xx.x岁」。 */}
						{hits.map((h, i) => (
							<circle key={`h${i}`} cx={h.x.toFixed(1)} cy={h.y.toFixed(1)} r="3.4"
								fill="var(--horosa-accent, #b8860b)" stroke="var(--horosa-surface-solid, #fff)" strokeWidth="1"
								style={{ cursor: 'pointer' }}
								onMouseMove={(e) => this.showTip(e, h.to, `${planetName(h.from)}推进→ · ${h.age.toFixed(1)}岁`)}
								onMouseLeave={this.hideTip} />
						))}
						{natLabels.map((l, i) => (
							<g key={`nl${i}`}>
								{Math.abs(l.labelY - l.y) > 1 ? <line x1={mL + plotW} y1={l.y} x2={natX - 1} y2={l.labelY} stroke={l.color} strokeWidth="0.5" opacity="0.4" /> : null}
								<text x={natX} y={l.labelY} dy="0.32em" textAnchor="start" fontSize="17" fill={l.color} stroke="none" opacity="0.9" style={{ cursor: 'default', paintOrder: 'fill' }}>
									<title>{`${planetName(l.id)}（本命）`}</title>
									{planetGlyph(l.id, l.color)}
								</text>
							</g>
						))}
						{traLabels.map((l, i) => (
							<g key={`tl${i}`}>
								{Math.abs(l.labelY - l.y) > 1 ? <line x1={mL + plotW} y1={l.y} x2={traX - 1} y2={l.labelY} stroke={l.color} strokeWidth="0.5" opacity="0.5" /> : null}
								<text x={traX} y={l.labelY} dy="0.32em" textAnchor="start" fontSize="19" fontWeight="600" fill={l.color} stroke="none" style={{ cursor: 'default', paintOrder: 'fill' }}>
									<title>{`${planetName(l.id)}（推进 90 岁位）`}</title>
									{planetGlyph(l.id, l.color)}
								</text>
							</g>
						))}
					</svg>
					{this.state.tip ? (
						<div style={{ position: 'absolute', left: this.state.tip.x, top: this.state.tip.y, pointerEvents: 'none', zIndex: 6, background: 'var(--horosa-surface-solid, #ffffff)', color: 'var(--horosa-text)', border: '1px solid var(--horosa-border)', borderRadius: 6, padding: '3px 9px', fontSize: 13, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 10px rgba(0,0,0,0.18)' }}>
							<span style={{ width: 9, height: 9, borderRadius: '50%', background: this.state.tip.color, display: 'inline-block', flex: '0 0 auto' }} />
							<span>{planetName(this.state.tip.id)}（{this.state.tip.kind}）</span>
						</div>
					) : null}
				</div>
				<div style={{ color: soft, fontSize: 11, marginTop: 6 }}>
					斜线=太阳弧推进因子（同速率平行线族，加粗=聚焦因子）；虚线=本命参考；金点=聚焦因子推进线与本命线交叉，即该行星图完成之岁（悬停读数）。速率与折叠盘基可调，纯几何推算不取星历。
				</div>
			</div>
		);
	}

	render(){
		const height = this.props.height ? this.props.height : 720;
		const base = this.state.base;
		const rows = this.state.rows || [];
		const planets = this.planetSet();
		const nat = natalLines(this.props.chart);

		// 像素空间渲染(viewBox=像素,width/height=同值像素 → 1:1 不拉伸字形)。
		// 宽=实测容器内宽;高=按 viewport 钳位(vh-240)+ 父高(height-78),防被底部 Dock 遮/超出页面。
		const vh = this.state.vh || 900;
		const W = Math.max(680, Math.round(this.state.cw || ((this.state.vw || 1280) - 220)));
		// 高度:占满分配高度(减去顶部控件行 + 底部说明行),并以 vh 兜底防底部 Dock 遮挡(对齐中点盘口径)。
		const H = Math.max(340, Math.round(Math.min(height - 66, vh - 286)));
		const mL = 46, mR = 84, mT = 14, mB = 30; // 右留双列【放大】字形(本命内列 / 行运外列);字形变大→右边距加宽
		const plotW = W - mL - mR, plotH = H - mT - mB;
		const n = rows.length;
		const xAt = (i) => mL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
		const yAt = (f) => mT + (f / base) * plotH;

		// 行运折线:每星折叠后按日连线,跨 0/base 边界(相邻样本差 > base/2)断开重接。
		const series = planets.map((pid) => {
			const color = toneOf(pid);
			const segs = []; let cur = [];
			for (let i = 0; i < n; i++){
				const pos = rows[i].positions && rows[i].positions[pid];
				if (!pos || !Number.isFinite(Number(pos.lon))) { if (cur.length) { segs.push(cur); cur = []; } continue; }
				const f = fold(pos.lon, base);
				if (cur.length){ const prevF = cur[cur.length - 1].f; if (Math.abs(f - prevF) > base / 2) { segs.push(cur); cur = []; } }
				cur.push({ x: xAt(i), y: yAt(f), f });
			}
			if (cur.length) segs.push(cur);
			const d = segs.map((seg) => seg.map((p, k) => `${k === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')).join(' ');
			const last = rows[n - 1] && rows[n - 1].positions && rows[n - 1].positions[pid];
			return { pid, color, d, endY: last ? yAt(fold(last.lon, base)) : null };
		});

		// 月份竖网格 + 标签。
		const monthMarks = [];
		let lastMonth = null;
		for (let i = 0; i < n; i++){
			const ym = (rows[i].date || '').slice(0, 7); // 'YYYY-MM'
			if (ym && ym !== lastMonth){ lastMonth = ym; monthMarks.push({ x: xAt(i), label: ym.replace('-', '/') }); }
		}

		// Y 轴刻度(0..base 五等分);非整度显示一位小数(45°盘的 11.25°/33.75° 等)。
		const fmtDeg = (v) => (Number.isInteger(v) ? `${v}°` : `${v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}°`);
		const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ v: (base * t), y: yAt(base * t) }));

		// 字形标签垂直避让(本命点常折叠到相近高度 → 原全堆一起;此处按 minGap 顶开 + 连线回真位)。
		const vspread = (items, minGap, lo, hi) => {
			const s = items.slice().sort((a, b) => a.y - b.y);
			let prev = -Infinity;
			s.forEach((it) => { const g = Math.max(it.y, prev + minGap); it.labelY = g; prev = g; });
			const over = s.length ? (s[s.length - 1].labelY - hi) : 0;
			if (over > 0) s.forEach((it) => { it.labelY = Math.max(lo, it.labelY - over); });
			return s;
		};
		const softTone = 'var(--horosa-text-soft)';
		// 本命字形=内列(x=plot 右缘+8);行运字形=外列。各自避让,互不挤。字形放大→避让间距同步加大(minGap 13→18)。
		const natLabels = vspread(nat.map((p) => ({ id: p.id, y: yAt(fold(p.lon, base)), color: toneOf(p.id, softTone) })), 18, mT + 2, mT + plotH - 2);
		const traLabels = vspread(series.filter((s) => s.endY != null).map((s) => ({ id: s.pid, y: s.endY, color: s.color })), 18, mT + 2, mT + plotH - 2);

		const stroke = 'var(--horosa-chart-stroke, currentColor)';
		const soft = 'var(--horosa-text-soft)';

		const isLife = this.state.mode === 'life';
		const natForFocus = nat;
		const controls = (
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 8 }}>
				<Radio.Group size="small" value={this.state.mode} onChange={(e) => this.saveDisp({ mode: e.target.value })}>
					<Radio.Button value="transit">行运星历</Radio.Button>
					<Radio.Button value="life">太阳弧生命图</Radio.Button>
				</Radio.Group>
				{!isLife ? (
					<RangePicker size="small" value={[this.state.start, this.state.end]} allowClear={false}
						onChange={(v) => { if (v && v[0] && v[1]) this.setState({ start: v[0].clone().startOf('day'), end: v[1].clone().startOf('day') }, () => this.requestData()); }} />
				) : null}
				<Radio.Group size="small" value={base} onChange={(e) => this.saveDisp({ base: e.target.value })}>
					<Radio.Button value={90}>90° (H4)</Radio.Button>
					<Radio.Button value={45}>45° (H8)</Radio.Button>
					<Radio.Button value={22.5}>22.5° (H16)</Radio.Button>
				</Radio.Group>
				{!isLife ? (
					<Checkbox checked={this.state.includeMoon} onChange={(e) => this.saveDisp({ includeMoon: e.target.checked }, this.requestData)}>含月亮</Checkbox>
				) : null}
				{isLife ? (
					<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
						<span style={{ color: soft, fontSize: 12 }}>聚焦因子</span>
						<Select size="small" value={this.state.lifeFocus} style={{ minWidth: 92 }} dropdownMatchSelectWidth={false}
							onChange={(v) => this.saveDisp({ lifeFocus: v })}
							options={natForFocus.map((p) => ({ value: p.id, label: planetName(p.id) }))} />
						<Radio.Group size="small" value={this.state.lifeRate} onChange={(e) => this.saveDisp({ lifeRate: e.target.value })}>
							<Radio.Button value="naibod">均日弧</Radio.Button>
							<Radio.Button value="cardan">59′12″</Radio.Button>
							<Radio.Button value="oneDeg">1°/年</Radio.Button>
						</Radio.Group>
					</span>
				) : (
					<span style={{ color: soft, fontSize: 12 }}>行运行星折叠到盘基,与本命水平线相交≈应期(最长约 366 天/次)</span>
				)}
			</div>
		);

		if (isLife){
			if (!nat.length){
				return <div ref={(el) => { this._wrap = el; }} className="horosa-uranian-gephem" style={{ padding: '4px 8px' }}>{controls}<Empty description="请先完善出生信息（本命盘就绪后即可查看生命图）" /></div>;
			}
			return this.renderLife(controls, W, H, mL, mR, mT, mB, stroke, soft);
		}

		const natX = mL + plotW + 8;   // 本命字形内列(字形放大→略外移)
		const traX = mL + plotW + 32;  // 行运字形外列(与内列拉开间距,放大后不互叠)

		if (this.state.note){
			return <div ref={(el) => { this._wrap = el; }} className="horosa-uranian-gephem" style={{ padding: '4px 8px' }}>{controls}<Empty description={this.state.note} /></div>;
		}

		return (
			<div ref={(el) => { this._wrap = el; }} className="horosa-uranian-gephem" style={{ padding: '4px 8px' }}>
				{controls}
				<Spin spinning={this.state.loading}>
					<div style={{ width: '100%', position: 'relative' }} ref={(el) => { this._tipHost = el; }}>
						<svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block', maxWidth: '100%', color: stroke }}
							className="xq-chart-renderer xq-chart-renderer-astro">
							{/* 外框 */}
							<rect x={mL} y={mT} width={plotW} height={plotH} fill="none" stroke={stroke} strokeWidth="1" opacity="0.5" />
							{/* Y 网格 + 刻度 */}
							{yTicks.map((t, i) => (
								<g key={`y${i}`}>
									<line x1={mL} y1={t.y} x2={mL + plotW} y2={t.y} stroke={stroke} strokeWidth="0.6" opacity="0.18" />
									<text x={mL - 6} y={t.y} dy="0.32em" textAnchor="end" fontSize="10" fill={soft}>{fmtDeg(t.v)}</text>
								</g>
							))}
							{/* 月份竖网格 */}
							{monthMarks.map((mm, i) => (
								<g key={`m${i}`}>
									<line x1={mm.x} y1={mT} x2={mm.x} y2={mT + plotH} stroke={stroke} strokeWidth="0.5" opacity="0.12" />
									{i % 2 === 0 ? <text x={mm.x} y={mT + plotH + 16} textAnchor="middle" fontSize="9" fill={soft}>{mm.label}</text> : null}
								</g>
							))}
							{/* 本命参考线(水平虚线) */}
							{nat.map((p, i) => {
								const y = yAt(fold(p.lon, base));
								const color = toneOf(p.id, soft);
								return (
									<g key={`n${i}`}>
										{/* 加宽透明命中条 + title:hover 本命参考线显星名(任务 F)。 */}
										<line x1={mL} y1={y} x2={mL + plotW} y2={y} stroke="transparent" strokeWidth="7" style={{ cursor: 'pointer' }} onMouseMove={(e) => this.showTip(e, p.id, '本命')} onMouseLeave={this.hideTip} />
										<line x1={mL} y1={y} x2={mL + plotW} y2={y} stroke={color} strokeWidth="0.9" strokeDasharray="3,3" opacity="0.45" style={{ pointerEvents: 'none' }} />
									</g>
								);
							})}
							{/* 行运折线:加宽透明命中路径承载 hover title(任务 F),可见线在其上;CSS hover 加粗高亮。 */}
							{series.map((s, i) => (
								<g key={`s${i}`} className="horosa-gephem-line">
									{s.d ? <path d={s.d} fill="none" stroke="transparent" strokeWidth="9" strokeLinejoin="round" style={{ cursor: 'pointer' }} onMouseMove={(e) => this.showTip(e, s.pid, '行运')} onMouseLeave={this.hideTip} /> : null}
									<path className="horosa-gephem-line-vis" d={s.d} fill="none" stroke={s.color} strokeWidth="1.6" opacity="0.92" style={{ pointerEvents: 'none' }} />
								</g>
							))}
							{/* 本命字形(内列,避让 + 连线回真位);字形放大 12→17,hover 显星名。 */}
							{natLabels.map((l, i) => (
								<g key={`nl${i}`}>
									{Math.abs(l.labelY - l.y) > 1 ? <line x1={mL + plotW} y1={l.y} x2={natX - 1} y2={l.labelY} stroke={l.color} strokeWidth="0.5" opacity="0.4" /> : null}
									<text x={natX} y={l.labelY} dy="0.32em" textAnchor="start" fontSize="17" fill={l.color} stroke="none" opacity="0.9" style={{ cursor: 'default', paintOrder: 'fill' }}>
										<title>{`${planetName(l.id)}（本命）`}</title>
										{planetGlyph(l.id, l.color)}
									</text>
								</g>
							))}
							{/* 行运字形(外列,粗,避让 + 连线回末端) */}
							{traLabels.map((l, i) => (
								<g key={`tl${i}`}>
									{Math.abs(l.labelY - l.y) > 1 ? <line x1={mL + plotW} y1={l.y} x2={traX - 1} y2={l.labelY} stroke={l.color} strokeWidth="0.5" opacity="0.5" /> : null}
									<text x={traX} y={l.labelY} dy="0.32em" textAnchor="start" fontSize="19" fontWeight="600" fill={l.color} stroke="none" style={{ cursor: 'default', paintOrder: 'fill' }}>
										<title>{`${planetName(l.id)}（行运）`}</title>
										{planetGlyph(l.id, l.color)}
									</text>
								</g>
							))}
						</svg>
						{this.state.tip ? (
							<div style={{ position: 'absolute', left: this.state.tip.x, top: this.state.tip.y, pointerEvents: 'none', zIndex: 6, background: 'var(--horosa-surface-solid, #ffffff)', color: 'var(--horosa-text)', border: '1px solid var(--horosa-border)', borderRadius: 6, padding: '3px 9px', fontSize: 13, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 10px rgba(0,0,0,0.18)' }}>
								<span style={{ width: 9, height: 9, borderRadius: '50%', background: this.state.tip.color, display: 'inline-block', flex: '0 0 auto' }} />
								<span>{planetName(this.state.tip.id)}（{this.state.tip.kind}）</span>
							</div>
						) : null}
					</div>
				</Spin>
				<div style={{ color: soft, fontSize: 11, marginTop: 6 }}>
					实线=行运行星(折叠盘基);虚线=本命参考。右侧内列=本命字形、外列=行运字形(均自动避让,按行星配色)。悬停线或字形显星名。折叠位相交即该硬相位(0/90/180/270)触发期。月亮默认不画(过快)。
				</div>
			</div>
		);
	}
}
