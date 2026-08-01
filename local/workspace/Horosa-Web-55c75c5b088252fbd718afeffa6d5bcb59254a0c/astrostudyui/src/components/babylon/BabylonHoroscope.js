// components/babylon/BabylonHoroscope.js —— P1 个人星盘。
// 中栏:恒星黄道盘(12 宫楔文名环 + 七曜 + 距星外环 + 旺位/三分高亮)。
// 铁律:不画宫位线、不画相位线、不画上升点——巴比伦星盘是数据清单,盘面仅呈现黄道坐标系本身。
// 右栏:位置清单(固定序 月日木金水土火/已没 ŠÚ)+ Lunar Three + 分至/天狼星 + 「位」三法 + 行星-神-吉凶。
import { Component } from 'react';
import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import {
	BABYLON_SIGNS, BABYLON_NORMAL_STARS, BABYLON_PLANETS, NOTES,
	exaltationOf, babylonSign,
} from '../../divination/data/babylonianData';
import { PLANET_ORDER, kiVerdict } from '../../divination/babylon/horoscope';

const GLYPH_KEY = {
	moon: AstroConst.MOON, sun: AstroConst.SUN, jupiter: AstroConst.JUPITER, venus: AstroConst.VENUS,
	mercury: AstroConst.MERCURY, saturn: AstroConst.SATURN, mars: AstroConst.MARS,
};
function glyph(k){ return (AstroText.AstroMsg && AstroText.AstroMsg[GLYPH_KEY[k]]) || ''; }
// 度分显示(P1 阅读友好);六十进制分号记号保留在数理星历专业表
function degMin(deg){
	const d = Math.floor(deg);
	const m = Math.round((deg - d) * 60);
	return m >= 60 ? `${d + 1}°0′` : `${d}°${m}′`;
}
const PLANET_COLOR = {
	moon: '#4f6f9c', sun: '#c07a17', jupiter: '#7d5bA6', venus: '#c25c8a',
	mercury: '#3d8f74', saturn: '#5b5347', mars: '#bf3c36',
};
function natureBadge(nature){
	if(!nature){ return null; }
	const cls = nature.indexOf('吉') >= 0 ? 'ji' : (nature.indexOf('凶') >= 0 ? 'xiong' : 'muted');
	return <span className={`horosa-babylon-badge ${cls}`}>{nature}</span>;
}

class BabylonHoroscope extends Component{
	renderWheel(){
		const bab = this.props.bab;
		const rows = bab ? bab.rows.filter((r) => !r.missing) : [];
		const VB = 600, C = VB / 2;
		const R_OUTER = 288;       // 最外饰环
		const R_NS = 276;          // 距星环
		const R_SIGN_OUT = 262;    // 宫名环外缘
		const R_SIGN_IN = 210;     // 宫名环内缘
		const R_TICK_IN = 200;     // 刻度内缘
		const R_PLANET = 158;      // 七曜环
		const R_CORE = 96;         // 中心徽记圈
		const dark = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-horosa-appearance') === 'dark');
		const ink = dark ? '#d3c49b' : '#4a381c';
		const soft = dark ? 'rgba(211,196,155,0.45)' : 'rgba(112,86,44,0.45)';
		const faint = dark ? 'rgba(211,196,155,0.22)' : 'rgba(112,86,44,0.2)';
		const gold = dark ? '#c2a35c' : '#9a6a25';
		const bandFill = dark ? 'rgba(194,163,92,0.07)' : 'rgba(154,106,37,0.055)';
		const bandFillAlt = dark ? 'rgba(194,163,92,0.028)' : 'rgba(154,106,37,0.022)';
		const bandExalt = dark ? 'rgba(194,163,92,0.17)' : 'rgba(154,106,37,0.13)';
		// 黄经→坐标:白羊 0° 在左(9 点),逆时针增(天文惯例);t = 数学极角(度)
		const angT = (lon) => 180 - lon;
		const ang = (lon, r) => {
			const t = angT(lon) * Math.PI / 180;
			return [C + r * Math.cos(t), C - r * Math.sin(t)];
		};
		// 文字旋转:沿切向、恒保持头朝外可读
		const rotOf = (lon) => {
			let rot = ((90 - angT(lon)) % 360 + 360) % 360;
			if(rot > 90 && rot < 270){ rot -= 180; }
			return rot;
		};
		// 屏幕上黄经增 = 顺时针(y 轴翻转)→ 外弧 sweep=1、内弧回程 sweep=0
		const arcPath = (rInner, rOuter, from, to) => {
			const [x1, y1] = ang(from, rOuter), [x2, y2] = ang(to, rOuter);
			const [x3, y3] = ang(to, rInner), [x4, y4] = ang(from, rInner);
			return `M${x1},${y1} A${rOuter},${rOuter} 0 0 1 ${x2},${y2} L${x3},${y3} A${rInner},${rInner} 0 0 0 ${x4},${y4} Z`;
		};
		const opts = this.props.opts || {};
		const solsticeDeg = opts.solstice === 'B8' ? 8 : 10;
		const exaltSigns = {};
		BABYLON_PLANETS.forEach((p) => { const e = exaltationOf(p.key); if(e){ exaltSigns[e.sign] = p; } });

		// 七曜角向防重叠:同/邻宫多曜按黄经排序后保证 ≥8° 显示间隔(单向推挤,保持相对序)
		const placed = rows.slice().sort((a, b) => a.lon - b.lon).map((r) => ({ ...r, dispLon: r.lon }));
		for(let pass = 0; pass < 3; pass++){
			for(let i = 1; i < placed.length; i++){
				const gap = placed[i].dispLon - placed[i - 1].dispLon;
				if(gap < 8){ placed[i].dispLon = placed[i - 1].dispLon + 8; }
			}
			// 首尾环缝
			if(placed.length > 1){
				const wrapGap = placed[0].dispLon + 360 - placed[placed.length - 1].dispLon;
				if(wrapGap < 8){ placed[0].dispLon += (8 - wrapGap); }
			}
		}

		return (
			<svg viewBox={`0 0 ${VB} ${VB}`} style={{ width: '100%', height: '100%' }}>
				<defs>
					<radialGradient id="bab-core-glow" cx="50%" cy="50%" r="50%">
						<stop offset="0%" stopColor={dark ? 'rgba(194,163,92,0.10)' : 'rgba(154,106,37,0.07)'} />
						<stop offset="78%" stopColor="transparent" />
					</radialGradient>
				</defs>
				<circle cx={C} cy={C} r={R_OUTER} fill="url(#bab-core-glow)" stroke={soft} strokeWidth="1.2" />
				<circle cx={C} cy={C} r={R_NS} fill="none" stroke={faint} strokeWidth="0.7" />
				<circle cx={C} cy={C} r={R_SIGN_OUT} fill="none" stroke={soft} strokeWidth="1" />
				<circle cx={C} cy={C} r={R_SIGN_IN} fill="none" stroke={soft} strokeWidth="1" />
				<circle cx={C} cy={C} r={R_TICK_IN} fill="none" stroke={faint} strokeWidth="0.6" />

				{/* 宫带(统一弧带;旺位宫加深)+ 宫界贯穿线(黄道坐标界,非宫位线) */}
				{BABYLON_SIGNS.map((s, i) => {
					const from = i * 30, to = from + 30;
					const isExalt = !!exaltSigns[s.n];
					const mid = from + 15;
					const [nx, ny] = ang(mid, (R_SIGN_OUT + R_SIGN_IN) / 2 + 8);
					const [cx2, cy2] = ang(mid, (R_SIGN_OUT + R_SIGN_IN) / 2 - 10);
					const rot = rotOf(mid);
					const cuneShort = String(s.cune || '').split('/')[0].trim();
					return (
						<g key={s.n}>
							<path d={arcPath(R_SIGN_IN, R_SIGN_OUT, from, to)}
								fill={isExalt ? bandExalt : (i % 2 ? bandFill : bandFillAlt)}
								stroke={soft} strokeWidth="0.5" />
							<line x1={ang(from, R_TICK_IN)[0]} y1={ang(from, R_TICK_IN)[1]}
								x2={ang(from, R_NS)[0]} y2={ang(from, R_NS)[1]}
								stroke={soft} strokeWidth="0.9" />
							<g transform={`translate(${nx},${ny}) rotate(${rot})`}>
								<text fontSize="15" fill={ink} textAnchor="middle" fontWeight="600" letterSpacing="2">{s.cn}</text>
							</g>
							<g transform={`translate(${cx2},${cy2}) rotate(${rot})`}>
								<text fontSize="7.2" fill={soft} textAnchor="middle" letterSpacing="0.5" fontStyle="italic">{cuneShort}</text>
							</g>
							{isExalt ? (
								<g transform={`translate(${ang(mid, R_SIGN_IN - 9)[0]},${ang(mid, R_SIGN_IN - 9)[1]}) rotate(${rot})`}>
									<text fontSize="8.4" fill={gold} textAnchor="middle" fontWeight="600">◆ {exaltSigns[s.n].cn}之屋</text>
								</g>
							) : null}
						</g>
					);
				})}

				{/* 5°/10° 刻度(宫名环内缘) */}
				{Array.from({ length: 72 }, (_, i) => i * 5).map((d) => {
					const major = d % 10 === 0;
					const [x1, y1] = ang(d, R_SIGN_IN);
					const [x2, y2] = ang(d, R_SIGN_IN - (major ? 7 : 4));
					return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke={major ? soft : faint} strokeWidth={major ? 0.9 : 0.55} />;
				})}

				{/* 距星(锚点星带光芒) */}
				{BABYLON_NORMAL_STARS.map((ns) => {
					const [x, y] = ang(ns.manualLon, R_NS + 6);
					return (
						<g key={ns.i}>
							{ns.anchor ? (
								<g>
									<line x1={x - 4.5} y1={y} x2={x + 4.5} y2={y} stroke={gold} strokeWidth="0.8" opacity="0.85" />
									<line x1={x} y1={y - 4.5} x2={x} y2={y + 4.5} stroke={gold} strokeWidth="0.8" opacity="0.85" />
									<circle cx={x} cy={y} r={2.1} fill={gold} />
								</g>
							) : (
								<circle cx={x} cy={y} r={1.5} fill={soft} />
							)}
							<title>{`${ns.cn} · ${ns.star} · ${ns.manual}${ns.div ? '(记录与实算有系统差)' : ''}`}</title>
						</g>
					);
				})}

				{/* 分至标记(菱形+径向文字,置于刻度内侧) */}
				{[{ L: 0 + solsticeDeg, t: '春分' }, { L: 90 + solsticeDeg, t: '夏至' }, { L: 180 + solsticeDeg, t: '秋分' }, { L: 270 + solsticeDeg, t: '冬至' }].map((m) => {
					const [x1, y1] = ang(m.L, R_TICK_IN);
					const [x2, y2] = ang(m.L, R_TICK_IN - 12);
					const [mx, my] = ang(m.L, R_TICK_IN - 17);
					const [tx, ty] = ang(m.L, R_TICK_IN - 30);
					const rot = rotOf(m.L);
					return (
						<g key={m.t}>
							<line x1={x1} y1={y1} x2={x2} y2={y2} stroke={gold} strokeWidth="1" strokeDasharray="3,2" opacity="0.85" />
							<rect x={mx - 3} y={my - 3} width="6" height="6" fill="none" stroke={gold} strokeWidth="0.9"
								transform={`rotate(45 ${mx} ${my})`} />
							<g transform={`translate(${tx},${ty}) rotate(${rot})`}>
								<text fontSize="8.6" fill={gold} textAnchor="middle" fontWeight="600" letterSpacing="1.5">{m.t}</text>
							</g>
						</g>
					);
				})}

				{/* 七曜:真位小刺 + 防重叠 glyph + 径向度数;无相位线 */}
				{placed.map((r) => {
					const [tickX1, tickY1] = ang(r.lon, R_TICK_IN);
					const [tickX2, tickY2] = ang(r.lon, R_TICK_IN - 5);
					const [x, y] = ang(r.dispLon, R_PLANET);
					const [lx1, ly1] = ang(r.lon, R_TICK_IN - 6);
					const [lx2, ly2] = ang(r.dispLon, R_PLANET + 16);
					const [dx, dy] = ang(r.dispLon, R_PLANET - 24);
					const color = PLANET_COLOR[r.key] || '#777';
					const rot = rotOf(r.dispLon);
					return (
						<g key={r.key} opacity={r.combust ? 0.55 : 1}>
							<line x1={tickX1} y1={tickY1} x2={tickX2} y2={tickY2} stroke={color} strokeWidth="1.6" />
							<line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={color} strokeWidth="0.55" opacity="0.4" />
							<text x={x} y={y + 7.5} fontSize="22" fill={color} textAnchor="middle"
								style={{ fontFamily: AstroConst.AstroFont }}>{glyph(r.key)}</text>
							<g transform={`translate(${dx},${dy}) rotate(${rot})`}>
								<text fontSize="8.6" fill={ink} textAnchor="middle" opacity="0.9" style={{ fontVariantNumeric: 'tabular-nums' }}>
									{`${Math.floor(r.deg)}°`}{r.combust ? ' ŠÚ' : ''}
								</text>
							</g>
							<title>{`${r.cn} · ${r.signInfo ? r.signInfo.cn : ''} ${r.deg.toFixed(2)}°${r.combust ? ' · 已没(与日同)' : ''}`}</title>
						</g>
					);
				})}

				{/* 中心徽记:双圈 + 四向短线 + 标题 */}
				<circle cx={C} cy={C} r={R_CORE} fill="none" stroke={soft} strokeWidth="0.8" />
				<circle cx={C} cy={C} r={R_CORE - 5} fill="none" stroke={faint} strokeWidth="0.6" />
				{[45, 135, 225, 315].map((a) => {
					const [x1, y1] = ang(a, R_CORE - 5), [x2, y2] = ang(a, R_CORE - 12);
					return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke={faint} strokeWidth="0.7" />;
				})}
				<text x={C} y={C - 14} fontSize="11.5" fill={ink} textAnchor="middle" fontWeight="600" letterSpacing="3">恒星黄道</text>
				<text x={C} y={C + 4} fontSize="8.5" fill={soft} textAnchor="middle" letterSpacing="1.5">毕宿锚 · 塞琉古框架</text>
				<line x1={C - 34} y1={C + 13} x2={C + 34} y2={C + 13} stroke={faint} strokeWidth="0.6" />
				<text x={C} y={C + 27} fontSize="8" fill={soft} textAnchor="middle" letterSpacing="1">无宫位 · 无相位 · 无上升</text>
			</svg>
		);
	}

	// Lunar Three 与邻近食(实算;星盘模板 (c)(e) 项)。历象服务不可得时整卡隐去(图式行照常)。
	renderEphemCard(){
		const dg = this.props.ephemDigest;
		if(!dg || (!dg.fullBefore && !dg.newNear && !(dg.eclipses && dg.eclipses.length))){ return null; }
		const EN_CN = { Aries: '白羊', Taurus: '金牛', Gemini: '双子', Cancer: '巨蟹', Leo: '狮子', Virgo: '处女', Libra: '天秤', Scorpio: '天蝎', Sagittarius: '射手', Capricorn: '摩羯', Aquarius: '水瓶', Pisces: '双鱼' };
		return (
			<div className="horosa-babylon-card">
				<div className="horosa-babylon-card-title">Lunar Three 与邻近食(实算)</div>
				<div>前月长:{this.props.bab ? (this.props.bab.monthLen === 30 ? '满(30 日)' : '缺(29 日)') : '—'}(Lunar Three 之一)</div>
				{dg.fullBefore ? (
					<div>出生前最近满月:{dg.fullBefore.date}(月在{EN_CN[dg.fullBefore.sign] || dg.fullBefore.sign})
						{dg.na ? <span style={{ marginLeft: 6 }}>· NA(日出→月落)≈ <b>{dg.na} UŠ</b></span> : null}
					</div>
				) : null}
				{dg.newNear ? (
					<div>最近新月(朔):{dg.newNear.date}
						{dg.kur ? <span style={{ marginLeft: 6 }}>· 残月晨 KUR(月出→日出)≈ <b>{dg.kur} UŠ</b></span> : null}
					</div>
				) : null}
				{dg.eclipses && dg.eclipses.length ? (
					<div>
						出生邻近之食:
						{dg.eclipses.map((e, i) => (
							<div key={i} style={{ paddingLeft: 10 }}>
								· {e.date} {e.kind}{e.sub ? `·${e.sub}` : ''}
								{e.digit ? <span style={{ opacity: 0.8 }}>(食分 {e.digit} 指)</span> : null}
								<span className={`horosa-babylon-badge ${e.before ? 'muted' : ''}`}>{e.before ? '生前' : '生后'}</span>
							</div>
						))}
					</div>
				) : null}
				<div className="horosa-babylon-caveat">
					朔望/食/NA/KUR 皆为现代星历按本盘地点实算;食分以指(月/日径 1/12)计,时距以 UŠ(=4 分钟)计——皆与楔文口径同构。NA/KUR 仅当该日事件次序成立时给值(1 UŠ 精度按分钟折算)。
				</div>
			</div>
		);
	}

	renderReadout(){
		const bab = this.props.bab;
		if(!bab){ return <div style={{ opacity: 0.6, padding: 12 }}>等待星历数据…</div>; }
		const opts = this.props.opts || {};
		const eraText = opts.era === 'arsacid'
			? `安息纪元 ${bab.babylonianDate.seYear - 64} 年`
			: `S.E.${bab.babylonianDate.seYear} 年`;
		return (
			<div>
				<div className="horosa-babylon-card">
					<div className="horosa-babylon-card-title">出生历日(算术历)</div>
					<div>{bab.babylonianDateText}</div>
					<div style={{ opacity: 0.75 }}>{eraText} · 19 年周期第 {bab.babylonianDate.cycleYear} 年 · 该月{bab.monthLen === 30 ? '满(30 日)' : '缺(29 日)'}</div>
					<div className="horosa-babylon-caveat">算术历以纪元锚+平均朔望月递推,与逐月观测实历可差 ±1–2 日。</div>
				</div>
				<div className="horosa-babylon-card">
					<div className="horosa-babylon-card-title">七曜按宫(固定序 月-日-木-金-水-土-火)</div>
					{bab.rows.map((r) => r.missing ? (
						<div key={r.key} style={{ opacity: 0.5 }}>{r.key} · 待星历数据</div>
					) : (
						<div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0' }}>
							<span style={{ fontFamily: AstroConst.AstroFont, fontSize: 15, color: PLANET_COLOR[r.key], width: 18, textAlign: 'center' }}>{glyph(r.key)}</span>
							<span style={{ width: 44 }}>{r.cn}</span>
							<span style={{ flex: 1 }}>
								{r.signInfo ? r.signInfo.cn : ''} {degMin(r.deg)}
								<span style={{ opacity: 0.55, marginLeft: 5, fontSize: 11 }}>{r.signInfo ? r.signInfo.cune : ''}</span>
							</span>
							{r.combust ? <span className="horosa-babylon-badge muted">已没 ŠÚ</span> : null}
							{r.inExalt ? <span className="horosa-babylon-badge ji">秘密之屋</span> : null}
							{natureBadge(r.nature)}
						</div>
					))}
					<div className="horosa-babylon-caveat">「已没」按与日距 ≤15° 图式判据;行星序为吉→中→凶的编排序,非空间序。</div>
				</div>
				{this.renderEphemCard()}
				<div className="horosa-babylon-card">
					<div className="horosa-babylon-card-title">该年分至与天狼星(19 年图式方案)</div>
					<div>春分 {bab.uruk.text.ve} · 夏至 {bab.uruk.text.ss}</div>
					<div>秋分 {bab.uruk.text.ae} · 冬至 {bab.uruk.text.ws}</div>
					<div>天狼星:偕日升 {bab.uruk.text.siriusRise} · 偕日没 {bab.uruk.text.siriusSet}</div>
					<div className="horosa-babylon-caveat">星盘所记分至/天狼星取图式方案(非实测):夏至逐年步进 12 月 + 11;3,10 tithi,三季各 +3 月 3 tithi,天狼没 = 春分 + 1 月 18 tithi。</div>
				</div>
				<div className="horosa-babylon-card">
					<div className="horosa-babylon-card-title">「位」(bīt niṣirti / KI)三法</div>
					<div>① 近生分至月三分主:{bab.bitNisirti.bySolsticeMonth ? bab.bitNisirti.bySolsticeMonth.lordCn : '—'}(组 {bab.bitNisirti.bySolsticeMonth ? bab.bitNisirti.bySolsticeMonth.cn : ''})</div>
					<div>② 行星实宫三分:{bab.rows.filter((r) => !r.missing && r.inOwnTrip).map((r) => `${r.cn}(${kiVerdict(r)})`).join('；') || '本盘无行星落其本三分'}</div>
					<div>③ 生日日段主:第 {bab.babylonianDate.day} 日 → {bab.bitNisirti.byDaySegment ? bab.bitNisirti.byDaySegment.cn : '—'}星段</div>
					<div className="horosa-babylon-caveat">「位」于星盘中为三分+日段方案,非希腊宫位、亦非「旺=力量增强」;楔文旺位只给宫,度数属希腊叠加。</div>
				</div>
				<div className="horosa-babylon-card">
					<div className="horosa-babylon-card-title">行星-神-圣数-吉凶</div>
					{bab.rows.filter((r) => !r.missing).map((r) => (
						<div key={r.key} style={{ padding: '2px 0' }}>
							<b>{r.cn}</b> · {r.god}{r.number ? ` · 圣数 ${r.number}` : ''}{natureBadge(r.nature)}
							<span style={{ opacity: 0.7, marginLeft: 6, fontSize: 11.5 }}>{(BABYLON_PLANETS.find((p) => p.key === r.key) || {}).note}</span>
						</div>
					))}
				</div>
				<div className="horosa-babylon-card">
					<div className="horosa-babylon-card-title">神祇祈请</div>
					<div style={{ fontStyle: 'italic' }}>ina amat Bēl u Bēltīja lišlim —— 愿凭 Bēl 与 Bēltīja 之命而安。</div>
					<div className="horosa-babylon-caveat">星盘多以此式收尾;另一城邦作 Anu 与 Antu。多数星盘仅记数据不作预言;少数附「其寿将长/他将有子嗣/他将见获利」类后件。</div>
				</div>
				<div className="horosa-babylon-card">
					<div className="horosa-babylon-card-title">距星说明</div>
					<div className="horosa-babylon-caveat">{NOTES.normalStars}</div>
				</div>
			</div>
		);
	}

	render(){
		return (
			<div className="horosa-babylon-body" style={{ height: this.props.height }}>
				<div className="horosa-babylon-stage">
					<div className="horosa-babylon-svgwrap">{this.renderWheel()}</div>
				</div>
				<div className="horosa-babylon-readout">{this.props.schemePanel}{this.renderReadout()}</div>
			</div>
		);
	}
}

export default BabylonHoroscope;
