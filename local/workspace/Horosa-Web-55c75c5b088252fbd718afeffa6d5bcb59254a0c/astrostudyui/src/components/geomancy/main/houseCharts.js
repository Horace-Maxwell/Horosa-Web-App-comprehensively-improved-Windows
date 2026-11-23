// 地占页 · 中栏宫盘:方盘 / 北印 / 中世纪盘、宫内行星与希腊点、行星轮、盘面缩放
// 从 GeomancyMain.js 按职责拆出的 GeomancyMain 方法:this 仍是 GeomancyMain 实例,门面里 mixinMethods(GeomancyMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React from 'react';
import { XQDesignScaleBox } from '../../xq-ui';
import { AstroFont } from '../../../constants/AstroConst';
import { PCHART_ZODIAC_OPTIONS } from '../geomancyOptions';
import { createDeferredResizeObserver } from '../../../utils/deferredResizeObserver';
import { signGlyph, PLANET_GLYPH_BY_ZH, PLANET_GLYPH_BY_EN, NORTH_POLYGONS, MEDIEVAL_POLYGONS, GEOMANCY_SQUARE_DESIGN_W, GEOMANCY_SQUARE_DESIGN_H, GEOMANCY_POLY_DESIGN_W, GEOMANCY_POLY_DESIGN_H } from './tables';

export const houseChartMethods = {
	// [方形宫盘] 中世纪通行之方盘:四方十二宫环列、中心留作提要。
	// 宫一居左中,循逆时针下行(一二三在左、四五六在下、七八九在右、十十一十二在上)。
	// 与「护盾方盘」不同 —— 后者是十六图平铺格,此为十二宫之方形排布。
	renderSquareHouses(reading){
		const houses = (reading && reading.houses) || [];
		const rtl = (((reading && reading.settings) || {}).direction || 'LTR') === 'RTL';
		// 四行四列之周边十二格 → 宫位。(行,列) 自左中起逆时针下行。
		const SLOTS = [
			[1, 0, 1], [2, 0, 2], [3, 0, 3],          // 左侧下行:一二三
			[3, 1, 4], [3, 2, 5], [3, 3, 6],          // 下侧右行:四五六
			[2, 3, 7], [1, 3, 8], [0, 3, 9],          // 右侧上行:七八九
			[0, 2, 10], [0, 1, 11], [0, 0, 12],       // 上侧左行:十十一十二
		];
		const byHouse = {};
		houses.forEach((h)=>{ byHouse[h.house] = h; });
		const planetsAt = this.planetsByHouse(reading) || {};
		const greekAt = this.greekPointsByHouse(reading) || {};
		const isIndia = (reading || {}).profileId === 'india_ramal';   // 印度派:宫名改标该支支名
		const cells = SLOTS.map(([r, c, hn])=>{
			const h = byHouse[hn] || {};
			const fig = h.figure || {};
			const sig = (h.roles || []).length > 0;
			const col = rtl ? (3 - c) : c;
			const tone = (fig.tone || '').toLowerCase();
			return (
				<div
					key={hn}
					className={`horosa-geomancy-sq-cell${sig ? ' is-significator' : ''}${tone === 'good' ? ' is-good' : (tone === 'bad' ? ' is-bad' : '')}`}
					style={{ gridRow: r + 1, gridColumn: col + 1 }}
				>
					<div className="horosa-geomancy-sq-head">
						<span className="horosa-geomancy-sq-num">{hn}</span>
						<span className="horosa-geomancy-sq-sign" style={{ fontFamily: AstroFont }}>{signGlyph(h.sign)}</span>
						<span className="horosa-geomancy-sq-topic">{isIndia && h.bhava ? h.bhava : (h.nameZh || h.topicsZh || '')}</span>
						{this.renderGreekMarks(greekAt[hn])}
					</div>
					{this.renderDots(fig.dots)}
					<div className="horosa-geomancy-sq-fig">
						<strong>{fig.displayName || fig.nameZh || fig.nameEn || '—'}</strong>
						{sig ? <em>{(h.roles || []).indexOf('querent') >= 0 ? '问者' : '所问'}</em> : null}
					</div>
					{this.renderHousePlanets(planetsAt[hn])}
				</div>
			);
		});
		// 栏宽不足设计宽时按设计宽排版再整体等比缩(放得下时逐像素不变):格里的拉丁图名 / 宫号不再被裁,盘心字不再越放大越小
		return (
			<XQDesignScaleBox designWidth={GEOMANCY_SQUARE_DESIGN_W} designHeight={GEOMANCY_SQUARE_DESIGN_H} fitHeight>
				<div className="horosa-geomancy-square">
					<div className="horosa-geomancy-shield-title">方形宫盘 · 十二宫{rtl ? ' · 自右向左' : ''}</div>
					<div className="horosa-geomancy-sq-grid">
						{cells}
						{this.renderBoardCenter(reading, 'horosa-geomancy-sq-center')}
					</div>
				</div>
			</XQDesignScaleBox>
		);
	},

	// 中心提要之缩放系数:块与点阵都是定值像素,而中心块随窗口在 190~430px 间浮动 ——
	// 定值在最小窗口(壳层硬性 1180×760)下必然越界。CSS 无法读取父元素像素,故此处量一次写成变量,
	// 由 LESS 用 calc(定值 × 系数) 统一缩放。**点阵的槽位按同一系数预留精确高度**,
	// 故缩放后视觉盒恰等于布局盒 —— 截断在结构上不可能发生(此前正是视觉盒>布局盒才被切)。
	attachCenterScale(el){
		if(this._centerRO){ this._centerRO.disconnect(); this._centerRO = null; }
		this._centerEl = el || null;
		if(!el || typeof ResizeObserver === 'undefined'){ return; }
		const apply = ()=>{
			const w = el.clientWidth, h = el.clientHeight;
			if(!w || !h){ return; }
			// 设计基准把**列距/行距/内距一并算进去**(三者同系数缩放,故可整体按比例):
			//   宽 = 3×122 + 2×6(列距) + 2×4(内距) = 386;高 = 3×106 + 2×2(行距) + 2×4 = 330。
			const k = Math.min(1, w / 386, h / 330);
			// 下限只防除零与极端塌缩,不做「不许再小」的约束 —— 硬性下限正是块越界的成因。
			el.style.setProperty('--geo-center-k', String(Math.max(0.3, Math.round(k * 1000) / 1000)));
		};
		apply();
		this._centerRO = createDeferredResizeObserver(apply);
		this._centerRO.observe(el);
	},

	// ── 两式方盘共用:中心提要 ──
	// 判官居中,余下三图按**倒三角**列其周:上二角左证/右证、下一角调和者(RTL 时二证左右互易,与盘面同向)。
	// 🔴 抽成共用件只此一份 —— 两式此前各写一份,已因此掉过队(中世纪盘漏了点阵)。
	renderBoardCenter(reading, cls){
		const r = reading || {};
		const rtl = ((r.settings || {}).direction || 'LTR') === 'RTL';
		const nameOf = (f)=>((f || {}).displayName || (f || {}).nameZh || (f || {}).nameEn || '—');
		const mini = (fig, tag, slot)=>(fig ? (
			<div className={`horosa-geomancy-center-mini is-${slot}`} key={slot}>
				<span className="horosa-geomancy-center-tag">{tag}</span>
				<strong>{nameOf(fig)}</strong>
				<span className="horosa-geomancy-center-dots-slot">{this.renderDots(fig.dots)}</span>
			</div>
		) : null);
		const [leftSlot, rightSlot] = rtl
			? [mini(r.rightWitness, '右证', 'tl'), mini(r.leftWitness, '左证', 'tr')]
			: [mini(r.leftWitness, '左证', 'tl'), mini(r.rightWitness, '右证', 'tr')];
		return (
			<div className={`horosa-geomancy-board-center ${cls}`} ref={(el)=>this.attachCenterScale(el)}>
				{leftSlot}
				{r.ascendantSignZh ? (
					<span className="horosa-geomancy-center-asc">{`上升 ${r.ascendantSignZh}`}</span>
				) : null}
				{rightSlot}
				<div className="horosa-geomancy-center-judge">
					<span className="horosa-geomancy-center-tag">判官</span>
					<strong>{nameOf(r.judge)}</strong>
					<span className="horosa-geomancy-center-dots-slot">{this.renderDots((r.judge || {}).dots)}</span>
				</div>
				{mini(r.reconciler, '调和者', 'bc')}
			</div>
		);
	},

	// ── 落星层(单一真值源)──
	// 🔴 此前落星只画在十二宫盘一处(PLANET_GLYPH_BY_EN 全文件仅现于 renderWheel),
	//    用户停在其余八式时切落星法**零反馈**,看上去就是「这开关坏了」。
	//    今抽成共用件,凡十二宫盘(圆轮/方形宫盘/北印度/中世纪)一律落星;非宫位盘则明说不呈现。
	planetsByHouse(reading){
		const st = (reading && reading.settings) || {};
		const mode = st.house_projection || 'sequential';
		const byHouse = {};
		if(mode === 'astro_bytwelves'){
			const b = (reading && reading.planetPlacementByTwelves) || null;
			if(!b){ return null; }
			Object.keys(b).forEach((p)=>{ const hh = b[p]; if(hh >= 1 && hh <= 12){ (byHouse[hh] = byHouse[hh] || []).push(p); } });
			return byHouse;
		}
		if(mode === 'astro_from_chart'){
			const pp = (reading && reading.planetPlacement) || null;
			if(!pp || !Object.keys(pp).length){ return null; }
			Object.keys(pp).forEach((p)=>{ (pp[p] || []).forEach((hh)=>{ (byHouse[hh] = byHouse[hh] || []).push(p); }); });
			return byHouse;
		}
		return null;                       // 不落星:如实返回空,盘上不画行星
	},

	// [希腊点] 福点/灵点各落一宫 → {宫号: ['fortune'|'spirit', …]}。
	// 🔴 单一真值源 + 共用件:落星层曾只画在圆轮盘一处,其余八式切了零反馈(B0 之病),
	//    故此件由**四式宫位盘全接**(圆轮/方形宫盘/北印度/中世纪),不得只接一处。
	greekPointsByHouse(reading){
		const gp = ((reading && reading.technique) || {}).greek_points || null;
		if(!gp){ return null; }
		const by = {};
		if(gp.fortune_house >= 1 && gp.fortune_house <= 12){ (by[gp.fortune_house] = by[gp.fortune_house] || []).push('fortune'); }
		if(gp.spirit_house >= 1 && gp.spirit_house <= 12){ (by[gp.spirit_house] = by[gp.spirit_house] || []).push('spirit'); }
		return Object.keys(by).length ? by : null;
	},

	// 希腊点徽记(HTML 盘用):福=好运所在·身体财业;灵=意志梦想欲求。
	renderGreekMarks(list){
		if(!list || !list.length){ return null; }
		return (
			<span className="horosa-geomancy-greek-marks">
				{list.map((k)=>(
					<em
						className={`horosa-geomancy-greek-mark is-${k}`}
						key={k}
						title={k === 'fortune' ? '地占式福点:好运所在、身体健康、财富、事业成败、心理素质'
							: '地占式灵点:意志、梦想、希望、追求、欲望、幻想'}
					>{k === 'fortune' ? '福' : '灵'}</em>
				))}
			</span>
		);
	},

	// 宫格内的落星行(HTML 盘用)。圆轮盘另有沿宫楔均分之画法,不共用此件。
	renderHousePlanets(list){
		if(!list || !list.length){ return null; }
		return (
			<span className="horosa-geomancy-house-planets" style={{ fontFamily: AstroFont }}>
				{list.map((p)=>PLANET_GLYPH_BY_EN[p] || '').join('')}
			</span>
		);
	},

	// 非宫位盘上落星法无处可画 —— 静默无反馈会被当成开关坏了,故明说一句。
	renderPlanetHint(reading){
		const st = (reading && reading.settings) || {};
		const mode = st.house_projection || 'sequential';
		if(mode === 'sequential'){ return null; }
		return (
			<div className="horosa-geomancy-planet-hint">
				{`已选${mode === 'astro_bytwelves' ? '占星定局乙' : '占星定局甲'} —— 本式非十二宫盘,不呈现落星;切至十二宫盘/方形宫盘/北印度式/中世纪盘可见。`}
			</div>
		);
	},

	// ── 两式方盘共用:按多边形重心摆图 ──
	// 重心 = 顶点均值(三角与凸多边形皆适用),故图形恒落格内不越界。
	sqCentroid(pts){
		const p = pts.split(' ').map((s)=>s.split(',').map(Number));
		const n = p.length;
		return [p.reduce((a, q)=>a + q[0], 0) / n, p.reduce((a, q)=>a + q[1], 0) / n];
	},

	renderPolyChart(reading, polys, opts){
		const houses = (reading && reading.houses) || [];
		const byHouse = {};
		houses.forEach((h)=>{ byHouse[h.house] = h; });
		const planetsAt = this.planetsByHouse(reading) || {};
		const greekAt = this.greekPointsByHouse(reading) || {};
		const rtl = (((reading && reading.settings) || {}).direction || 'LTR') === 'RTL';
		const mirror = (pts)=>(rtl
			? pts.split(' ').map((s)=>{ const [x, y] = s.split(',').map(Number); return `${100 - x},${y}`; }).join(' ')
			: pts);
		// 栏宽不足设计宽时按设计宽 × 设计高排版再整体等比缩(放得下时逐像素不变):图名不再越出方盘、压到宫号 / 点阵上
		return (
			<XQDesignScaleBox designWidth={GEOMANCY_POLY_DESIGN_W} designHeight={GEOMANCY_POLY_DESIGN_H} designGutter={16} fitHeight>
			<div className={`horosa-geomancy-polychart ${opts.cls}`}>
				<div className="horosa-geomancy-shield-title">{opts.title}{rtl ? ' · 自右向左' : ''}</div>
				<div className="horosa-geomancy-poly-board">
					<svg viewBox="0 0 100 100" preserveAspectRatio="none" className="horosa-geomancy-poly-lines" aria-hidden="true">
						<rect x="0" y="0" width="100" height="100" />
						{opts.frame}
						{Object.keys(polys).map((hn)=>{
							const h = byHouse[hn] || {};
							if(!(h.roles || []).length){ return null; }
							return <polygon key={`sig${hn}`} className="horosa-geomancy-poly-sig" points={mirror(polys[hn])} />;
						})}
					</svg>
					{Object.keys(polys).map((hn)=>{
						const h = byHouse[hn] || {};
						const fig = h.figure || {};
						const [cx, cy] = this.sqCentroid(mirror(polys[hn]));
						const sig = (h.roles || []).length > 0;
						const tone = (fig.tone || '').toLowerCase();
						return (
							<div
								key={hn}
								className={`horosa-geomancy-poly-cell${sig ? ' is-significator' : ''}${tone === 'good' ? ' is-good' : (tone === 'bad' ? ' is-bad' : '')}`}
								style={{ left: `${cx}%`, top: `${cy}%` }}
							>
								<span className="horosa-geomancy-poly-head">
									<span className="horosa-geomancy-poly-num">{hn}</span>
									<span className="horosa-geomancy-poly-sign" style={{ fontFamily: AstroFont }}>{signGlyph(h.sign)}</span>
									{this.renderGreekMarks(greekAt[hn])}
								</span>
								{this.renderDots(fig.dots)}
								<span className="horosa-geomancy-poly-name">{fig.displayName || fig.nameZh || fig.nameEn || ''}</span>
								{this.renderHousePlanets(planetsAt[hn])}
							</div>
						);
					})}
					{opts.center ? this.renderBoardCenter(reading, 'horosa-geomancy-poly-center') : null}
				</div>
			</div>
			</XQDesignScaleBox>
		);
	},

	// [北印度式] 复用印度占星北盘几何:外方 + 菱形(接四边中点) + 四角向心半对角线,成十二格无中心。
	renderNorthChart(reading){
		return this.renderPolyChart(reading, NORTH_POLYGONS, {
			cls: 'is-north', title: '北印度式方盘 · 十二宫', center: false,
			frame: (<>
				<polygon points="50,0 100,50 50,100 0,50" />
				<line x1="0" y1="0" x2="50" y2="50" />
				<line x1="100" y1="0" x2="50" y2="50" />
				<line x1="0" y1="100" x2="50" y2="50" />
				<line x1="100" y1="100" x2="50" y2="50" />
			</>),
		});
	},

	// [中世纪式] 外方 + 内方 + 菱形(顶点接外方边中点、边恰过内方四角)+ 内外四角连线。
	// 几何必然:内方四角落在菱形边上 ⇒ 内方恰为外方正中之半(跨 25 至 75)。成十二格 + 中心提要。
	renderMedievalChart(reading){
		return this.renderPolyChart(reading, MEDIEVAL_POLYGONS, {
			cls: 'is-medieval', title: '中世纪方盘 · 十二宫', center: true,
			frame: (<>
				<rect x="25" y="25" width="50" height="50" />
				<polygon points="50,0 100,50 50,100 0,50" />
				<line x1="0" y1="0" x2="25" y2="25" />
				<line x1="100" y1="0" x2="75" y2="25" />
				<line x1="100" y1="100" x2="75" y2="75" />
				<line x1="0" y1="100" x2="25" y2="75" />
			</>),
		});
	},

	renderCenter(){
		const result = this.state.result;
		if(!result){
			return <div className="horosa-geomancy-empty">输入所问之事后点「起盘」,生成地占护盾方盘与十二宫盘</div>;
		}
		const reading = result.reading || {};
		const hasSikidy = !!reading.sikidy;
		const hasHakata = !!reading.hakata;
		const hasIfa = !!reading.ifa;
		const hasPChart = !!reading.planetaryChart;
		// 当前视图若不可用(如切回非 sikidy 流派)→ 回落护盾方盘;结构对照模式默认落其专属盘。
		let view = this.state.centerView;
		if(view === 'sikidy' && !hasSikidy){ view = 'square'; }
		if(view === 'hakata' && !hasHakata){ view = 'square'; }
		if(view === 'ifa' && !hasIfa){ view = 'square'; }
		if(view === 'planetwheel' && !hasPChart){ view = 'square'; }
		if(hasIfa && !this.state.centerViewTouched){ view = 'ifa'; }
		const stage = view === 'planetwheel' ? this.renderPlanetaryWheel(reading)
			: view === 'wheel' ? this.renderWheel(reading)
			: view === 'north' ? this.renderNorthChart(reading)
				: view === 'medieval' ? this.renderMedievalChart(reading)
					: view === 'squarehouse' ? this.renderSquareHouses(reading)
				: view === 'pyramid' ? this.renderPyramid(reading)
				: view === 'sikidy' ? this.renderSikidy(reading)
					: view === 'hakata' ? this.renderHakata(reading)
						: view === 'ifa' ? this.renderIfa(reading)
							: this.renderShield(reading);
		return (
			<div className="horosa-geomancy-board">
				<div className="horosa-geomancy-board-switch">
					<button type="button" className={`horosa-geomancy-switch-btn${view === 'square' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('square')}>护盾方盘</button>
					<button type="button" className={`horosa-geomancy-switch-btn${view === 'pyramid' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('pyramid')}>金字塔盘</button>
					<button type="button" className={`horosa-geomancy-switch-btn${view === 'wheel' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('wheel')}>十二宫盘</button>
					<button type="button" className={`horosa-geomancy-switch-btn${view === 'squarehouse' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('squarehouse')}>方形宫盘</button>
					<button type="button" className={`horosa-geomancy-switch-btn${view === 'north' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('north')}>北印度式</button>
					<button type="button" className={`horosa-geomancy-switch-btn${view === 'medieval' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('medieval')}>中世纪盘</button>
					{hasSikidy ? <button type="button" className={`horosa-geomancy-switch-btn${view === 'sikidy' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('sikidy')}>异或表盘</button> : null}
					{hasHakata ? <button type="button" className={`horosa-geomancy-switch-btn${view === 'hakata' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('hakata')}>四片盘</button> : null}
					{hasIfa ? <button type="button" className={`horosa-geomancy-switch-btn${view === 'ifa' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('ifa')}>结构对照盘</button> : null}
					{/* [行星地占盘] 左栏开启后方出此钮 —— 无数据不摆死按钮 */}
					{hasPChart ? <button type="button" className={`horosa-geomancy-switch-btn${view === 'planetwheel' ? ' is-active' : ''}`} onClick={()=>this.setCenterView('planetwheel')}>行星地占盘</button> : null}
				</div>
				{['wheel', 'squarehouse', 'north', 'medieval'].indexOf(view) < 0 ? this.renderPlanetHint(reading) : null}
				{/* 方形宫盘 / 两式方盘按舞台可用高定边长:舞台挂 is-fit-height(弹性基准 0,高 = 可用高,确定值)——
				    此前舞台按内容定基准、盘又按舞台高的百分比定边,循环依赖让结果随切换历史漂(同一窗口时而 757、时而 812,后者撑出滚动条) */}
				<div className={`horosa-geomancy-board-stage${['squarehouse', 'north', 'medieval'].indexOf(view) >= 0 ? ' is-fit-height' : ''}`}>{stage}</div>
			</div>
		);
	},

	// [行星地占盘] 自成一盘:上升取首图之星座、七政各以报数落宫。
	// 与十二宫盘同用三环几何(外环黄道、中环带落星、内圆盘心),故设计语言一致;
	// 但此盘宫中并无盾面图形 —— 与「占星定局落星」正交,不可混为一谈。
	renderPlanetaryWheel(reading){
		const pc = (reading && reading.planetaryChart) || null;
		if(!pc){ return null; }
		const SIZE = 600, C = SIZE / 2;
		const rOuter = 288, rZodiac = 234, rSign = 261, rNum = 214, rPlanetBand = 156, rInner = 96;
		const D2R = Math.PI / 180;
		const polar = (r, deg)=>[C + r * Math.cos(deg * D2R), C - r * Math.sin(deg * D2R)];
		const houseCenterDeg = (h)=>180 + (h - 1) * 30 + 15;      // 宫一在左(9 点钟),逆时针递增
		const houseEdgeDeg = (h)=>180 + (h - 1) * 30;
		const spokes = [];
		for(let h = 1; h <= 12; h++){
			const [x1, y1] = polar(rInner, houseEdgeDeg(h));
			const [x2, y2] = polar(rOuter, houseEdgeDeg(h));
			spokes.push(<line key={`sp${h}`} x1={x1} y1={y1} x2={x2} y2={y2} className="horosa-geomancy-wheel-spoke" />);
		}
		// 落宫:同宫多星沿宫楔均分,恒不越界(与十二宫盘同法)
		const byHouse = {};
		const all = [].concat(pc.planets || [],
			pc.nodes ? [pc.nodes.north, pc.nodes.south] : [],
			pc.extras || []);
		all.forEach((p)=>{ if(p && p.house >= 1 && p.house <= 12){ (byHouse[p.house] = byHouse[p.house] || []).push(p); } });
		const glyphs = [];
		Object.keys(byHouse).forEach((hs)=>{
			const hh = parseInt(hs, 10);
			const list = byHouse[hh];
			const base = houseCenterDeg(hh);
			const step = list.length > 1 ? Math.min(22, 26 / list.length) : 0;
			const start = base - (step * (list.length - 1)) / 2;
			list.forEach((p, k)=>{
				const [gx, gy] = polar(rPlanetBand, start + k * step);
				const gl = PLANET_GLYPH_BY_EN[p.planet] || PLANET_GLYPH_BY_ZH[p.planet_zh] || '';
				glyphs.push(gl
					? (
						<text key={`pw${hh}-${p.planet}`} x={gx} y={gy} className="horosa-geomancy-wheel-planet"
							style={{ fontFamily: AstroFont }} textAnchor="middle" dominantBaseline="central">{gl}</text>
					)
					: (
						<text key={`pw${hh}-${p.planet}`} x={gx} y={gy} className="horosa-geomancy-wheel-planet is-text"
							textAnchor="middle" dominantBaseline="central">{(p.planet_zh || '').slice(0, 1)}</text>
					));
			});
		});
		return (
			<div className="horosa-geomancy-wheel is-planetary">
				{/* 标题在上、说明在下、盘居中占满横宽(壳层 flex 横排会把二者挤到盘两侧,故 is-planetary 改纵向) */}
				<div className="horosa-geomancy-shield-title">
					{`行星地占盘 · 七政报数落宫`}
					<span className="horosa-geomancy-pyr-tip">
						{`星座表:${(PCHART_ZODIAC_OPTIONS.find((o)=>o.key === pc.zodiac_table) || {}).label || pc.zodiac_table}`}
					</span>
				</div>
				<svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="horosa-geomancy-wheel-svg horosa-plain-text-board" xmlns="http://www.w3.org/2000/svg">
					<circle cx={C} cy={C} r={rOuter} className="horosa-geomancy-wheel-ring is-gold" />
					<circle cx={C} cy={C} r={rZodiac} className="horosa-geomancy-wheel-ring is-gold" />
					<circle cx={C} cy={C} r={rInner} className="horosa-geomancy-wheel-ring is-gold" />
					{spokes}
					{(pc.houses || []).map((h)=>{
						const [sx, sy] = polar(rSign, houseCenterDeg(h.house));
						const [nx, ny] = polar(rNum, houseCenterDeg(h.house));
						return (
							<g key={`ph${h.house}`}>
								<text x={sx} y={sy} className="horosa-geomancy-wheel-sign" style={{ fontFamily: AstroFont }} textAnchor="middle" dominantBaseline="central">{signGlyph(h.sign)}</text>
								<text x={nx} y={ny} className="horosa-geomancy-wheel-num" textAnchor="middle" dominantBaseline="central">{h.house}</text>
							</g>
						);
					})}
					{glyphs}
					<text x={C} y={C - 10} className="horosa-geomancy-wheel-center-title" textAnchor="middle">行星地占</text>
					<text x={C} y={C + 16} className="horosa-geomancy-wheel-center-sub" textAnchor="middle">
						{`上升 ${pc.asc_sign_zh}`}
					</text>
				</svg>
				<div className="horosa-geomancy-planet-hint">
					{`首图 ${pc.first_figure} 定上升,顺序排列黄道十二宫;七政各起报数(四数求和除十二取余,余零入十二宫)。`}
					{pc.nodes ? '北交同法、南交取其对宫。' : ''}
					{pc.extras ? '月孛与三王星为传本可选加项。' : ''}
				</div>
			</div>
		);
	},
};
