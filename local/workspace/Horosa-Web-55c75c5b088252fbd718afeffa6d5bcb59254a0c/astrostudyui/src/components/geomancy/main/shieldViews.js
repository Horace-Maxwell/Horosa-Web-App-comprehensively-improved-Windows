// 地占页 · 中栏图形:点阵、盾牌盘、金字塔、轮盘、Ifá、Sikidy 与 Hakata 视图
// 从 GeomancyMain.js 按职责拆出的 GeomancyMain 方法:this 仍是 GeomancyMain 实例,门面里 mixinMethods(GeomancyMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React from 'react';
import { AstroFont } from '../../../constants/AstroConst';
import { signGlyph, PLANET_GLYPH_BY_EN, MALAGASY_NAMES, FIGURE_SLOTS, FIGURE_GROUPS, TENANCY_GRADE_ZH, TENANCY_GRADE_MARK, ELEMENT_ZH_BY_EN, VIA_LINE_ZH, VIA_SIDE_ZH } from './tables';

export const shieldViewMethods = {
	// 当前记号样式:传本设置优先,回落点阵。dots 点阵 / lines 单双线 / bindu_rekha 点线 / tablets 开合片。
	markStyle(){
		const st = ((this.state.result || {}).reading || {}).settings || {};
		return st.mark_style || 'dots';
	},

	renderDots(dots, styleOverride){
		// 一个地占图形 = 4 行,每行单点(true)或双点(false)。记号呈现随传本切换,结构恒同。
		const rows = Array.isArray(dots) && dots.length === 4 ? dots : [true, true, true, true];
		const style = styleOverride || this.markStyle();
		const cls = `horosa-geomancy-fig-dots is-${String(style).replace(/_/g, '-')}`;
		return (
			<div className={cls}>
				{rows.map((single, i)=>{
					let body;
					if(style === 'lines'){
						// 单线 I / 双线 II —— 西非同族体系与部分传本用线不用点。
						body = single
							? <span className="horosa-geomancy-fig-line" />
							: (<><span className="horosa-geomancy-fig-line is-half" /><span className="horosa-geomancy-fig-line is-half" /></>);
					}else if(style === 'bindu' || style === 'bindu_rekha'){
						// 点(单)/ 线(双)—— 骰占传本记法。
						body = single
							? <span className="horosa-geomancy-fig-dot" />
							: <span className="horosa-geomancy-fig-rekha" />;
					}else if(style === 'tablets'){
						// 片之开合:刻纹面(开)= 单、素面(合)= 双。
						body = <span className={`horosa-geomancy-fig-tablet${single ? ' is-open' : ''}`} />;
					}else{
						body = single
							? <span className="horosa-geomancy-fig-dot" />
							: (<><span className="horosa-geomancy-fig-dot" /><span className="horosa-geomancy-fig-dot" /></>);
					}
					return <div className="horosa-geomancy-fig-dotrow" key={i}>{body}</div>;
				})}
			</div>
		);
	},

	renderShield(reading){
		const figs = (reading && reading.figures16) || [];
		// [RTL] 自右向左的传本:四格一行逐行镜像(母一在最右)。格位标签随图同镜,不错位。
		const rtl = (((reading && reading.settings) || {}).direction || 'LTR') === 'RTL';
		const idxOf = (i)=>(rtl ? (Math.floor(i / 4) * 4 + (3 - (i % 4))) : i);
		// [得地] 十六位各配一元素(位序循环火风水土),与所盛图之主元素论四档强弱 —— 角标就地标示。
		const tenancy = ((reading && reading.technique) || {}).tenancy || [];
		// [时间流] 右证过去、法官现在、左证未来(传本口径)
		const TIME_BY_SLOT = { 12: '过去', 13: '未来', 14: '现在' };
		return (
			<div className="horosa-geomancy-shield">
				<div className="horosa-geomancy-shield-title">护盾方盘 · 十六图形{rtl ? ' · 自右向左' : ''}</div>
				<div className="horosa-geomancy-shield-grid">
					{/* 每行恰为一族(母/女/甥/证判):FIGURE_GROUPS 作行组标签,slot 序与 RTL 镜像逻辑不变 */}
					{FIGURE_GROUPS.map((g, gi)=>(
						<div className="horosa-geomancy-shield-rowgroup" key={g.label}>
							<span className="horosa-geomancy-shield-grouplab">{g.label}</span>
							<div className="horosa-geomancy-shield-rowcells">
								{Array.from({ length: 4 }).map((_, c)=>{
									const slot = gi * 4 + c;
									const i = idxOf(slot);
									const f = figs[i] || {};
									const tone = (f.tone || '').toLowerCase();
									const qcls = tone === 'good' ? ' is-good' : (tone === 'bad' ? ' is-bad' : '');
									const ten = tenancy[i] || null;
									const when = TIME_BY_SLOT[i];
									return (
										<div className={`horosa-geomancy-shield-cell${qcls}`} key={slot}>
											{/* 格头:位名居中、得地角标靠右;格子窄到一行放不下时角标换到下一行,不互压 */}
											<div className={`horosa-geomancy-shield-head${ten && ten.grade ? ' has-tenancy' : ''}`}>
											<span className="horosa-geomancy-shield-slot">
												{FIGURE_SLOTS[i]}
												{when ? <em className="horosa-geomancy-shield-time">{when}</em> : null}
											</span>
											{ten && ten.grade ? (
												<span
													className={`horosa-geomancy-shield-tenancy is-${ten.grade}`}
													title={`${ELEMENT_ZH_BY_EN[ten.figure_element]}入${ELEMENT_ZH_BY_EN[ten.position_element]}位 · ${(TENANCY_GRADE_ZH[ten.grade] || {}).t}:${(TENANCY_GRADE_ZH[ten.grade] || {}).d}`}
												>{TENANCY_GRADE_MARK[ten.grade]}</span>
											) : null}
											</div>
											{this.renderDots(f.dots)}
											<div className="horosa-geomancy-shield-name">
												<strong>{f.nameZh || f.nameEn || '—'}</strong>
												<em>{f.displayName || f.nameEn || ''}</em>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</div>
		);
	},

	// 金字塔盘:正统二叉归约树。顶层八图(四母+四女)两两异或成四甥,四甥成二证,二证成判官;
	// 调和者立于盘外(判官与另一图之和)。父子以连线示生成关系 —— 平铺方格看不出这层结构。
	renderPyramid(reading){
		const M = (reading && reading.motherFigures) || [];
		const D = (reading && reading.daughterFigures) || [];
		const N = (reading && reading.nieceFigures) || [];
		const rw = (reading && reading.rightWitness) || null;
		const lw = (reading && reading.leftWitness) || null;
		const judge = (reading && reading.judge) || null;
		const recon = (reading && reading.reconciler) || null;
		const rtl = (((reading && reading.settings) || {}).direction || 'LTR') === 'RTL';
		const tech = (reading && reading.technique) || {};
		// [寻源四线] 传本四线俱可寻(火主目的意志/风主思想交流/水主感情灵性/土主结果物质),
		// 由法官该行之阳爻上溯。所选之线无数据时(或旧盘无此键)回落旧「点之路」(只沿火行)。
		const line = this.state.pyrLine || 'fire';
		const veAll = tech.via_elements || null;
		const ve = veAll ? (veAll[line] || null) : null;
		const vp = ve || tech.via_puncti || {};
		const onPath = new Set(Array.isArray(vp.path) ? vp.path : []);

		const W = 1010, H = 700;
		const COLW = W / 8;
		// 各层节点中心:顶层八列,逐层折半居中
		const rowY = [86, 256, 426, 588];
		const top = [...M.slice(0, 4), ...D.slice(0, 4)];
		const xOf = (col, span)=>{
			const raw = (col + 0.5) * (W / span);
			return rtl ? (W - raw) : raw;
		};
		// [亲缘三元 · 溯源] 盘之生成即「父·父→子」七组亲缘三元,内核 shield_triads 已逐组出参。
		// 此处以**版面接线**(引擎不掌握的几何信息)对齐内核那七组之次序:
		//   甥一←母一二、甥二←母三四、甥三←女一二、甥四←女三四;右证←甥一二、左证←甥三四;判官←二证。
		// TRIAD_WIRING 与内核 shield_triads 逐位同序 —— 故内核标签可直接贴到版面节点上,不必在前端另写一份关系。
		const TRIAD_WIRING = [
			{ child: 'n0', parents: ['t0', 't1'], links: ['l00a', 'l00b'] },
			{ child: 'n1', parents: ['t2', 't3'], links: ['l01a', 'l01b'] },
			{ child: 'n2', parents: ['t4', 't5'], links: ['l02a', 'l02b'] },
			{ child: 'n3', parents: ['t6', 't7'], links: ['l03a', 'l03b'] },
			{ child: 'rw', parents: ['n0', 'n1'], links: ['l10a', 'l10b'] },
			{ child: 'lw', parents: ['n2', 'n3'], links: ['l11a', 'l11b'] },
			{ child: 'jd', parents: ['rw', 'lw'], links: ['l2a', 'l2b'] },
		];
		const SOURCES = TRIAD_WIRING.reduce((m, w)=>{ m[w.child] = w.parents; return m; }, {});
		const triads = Array.isArray(tech.shield_triads) ? tech.shield_triads : [];
		const sel = this.state.pyrSel || null;
		const selIdx = TRIAD_WIRING.findIndex((w)=>w.child === sel);
		const selTriad = selIdx >= 0 ? (triads[selIdx] || null) : null;
		const litSet = new Set(sel ? (SOURCES[sel] || []) : []);
		// 选中时连线同描金 —— 父与子若只亮方块而线不亮,三元的「亲缘」正是看不出来的那一环。
		const litLinks = new Set(selIdx >= 0 ? TRIAD_WIRING[selIdx].links : []);
		const nodes = [];
		const lines = [];
		const push = (f, x, y, tag, key)=>{
			if(!f){ return; }
			const nm = f.nameEn || '';
			const hot = onPath.has(nm);
			const lit = litSet.has(key);
			const isSel = sel === key;
			const tone = (f.tone || '').toLowerCase();
			nodes.push(
				<g key={key}
					className={`horosa-geomancy-pyr-node${hot ? ' is-onpath' : ''}${lit ? ' is-source' : ''}${isSel ? ' is-selected' : ''}${tone === 'good' ? ' is-good' : (tone === 'bad' ? ' is-bad' : '')}${SOURCES[key] ? ' is-clickable' : ''}`}
					onClick={()=>{ if(SOURCES[key]){ this.setState({ pyrSel: sel === key ? null : key }); } }}
					transform={`translate(${x},${y})`}>
					<rect x={-50} y={-58} width={100} height={116} rx={9} className="horosa-geomancy-pyr-box" />
					<text x={0} y={-44} className="horosa-geomancy-pyr-tag" textAnchor="middle">{tag}</text>
					<foreignObject x={-32} y={-34} width={64} height={76}>
						<div className="horosa-geomancy-pyr-dots">{this.renderDots(f.dots)}</div>
					</foreignObject>
					<text x={0} y={50} className="horosa-geomancy-pyr-name" textAnchor="middle">{f.nameZh || nm}</text>
				</g>,
			);
		};
		const link = (x1, y1, x2, y2, hot, key)=>{
			lines.push(<path key={key} d={`M ${x1} ${y1 + 58} L ${x1} ${(y1 + y2) / 2} L ${x2} ${(y1 + y2) / 2} L ${x2} ${y2 - 58}`}
				className={`horosa-geomancy-pyr-link${hot ? ' is-onpath' : ''}${litLinks.has(key) ? ' is-triad' : ''}`} />);
		};
		const TAGS = ['母一', '母二', '母三', '母四', '女一', '女二', '女三', '女四'];
		top.forEach((f, i)=>push(f, xOf(i, 8), rowY[0], TAGS[i], `t${i}`));
		N.slice(0, 4).forEach((f, i)=>push(f, xOf(i, 4), rowY[1], `甥${'一二三四'[i]}`, `n${i}`));
		push(rw, xOf(0, 2), rowY[2], '右证', 'rw');
		push(lw, xOf(1, 2), rowY[2], '左证', 'lw');
		push(judge, xOf(0, 1), rowY[3], '判官', 'jd');
		// 父子连线:甥←两图、证←两甥、判官←二证
		for(let i = 0; i < 4; i++){
			const cx = xOf(i, 4);
			const hot = N[i] && onPath.has(N[i].nameEn);
			link(xOf(i * 2, 8), rowY[0], cx, rowY[1], hot, `l0${i}a`);
			link(xOf(i * 2 + 1, 8), rowY[0], cx, rowY[1], hot, `l0${i}b`);
		}
		[[0, 1, rw], [2, 3, lw]].forEach((grp, gi)=>{
			const cx = xOf(gi, 2);
			const hot = grp[2] && onPath.has(grp[2].nameEn);
			link(xOf(grp[0], 4), rowY[1], cx, rowY[2], hot, `l1${gi}a`);
			link(xOf(grp[1], 4), rowY[1], cx, rowY[2], hot, `l1${gi}b`);
		});
		const jhot = judge && onPath.has(judge.nameEn);
		link(xOf(0, 2), rowY[2], xOf(0, 1), rowY[3], jhot, 'l2a');
		link(xOf(1, 2), rowY[2], xOf(0, 1), rowY[3], jhot, 'l2b');

		return (
			<div className="horosa-geomancy-pyramid">
				<div className="horosa-geomancy-shield-title">
					金字塔盘 · 生成树{rtl ? ' · 自右向左' : ''}
					<span className="horosa-geomancy-pyr-tip">
						{selTriad
							? `亲缘三元 ${selTriad.label}:${(selTriad.parents || []).join(' ⊕ ')} = ${selTriad.child}(再点取消)`
							: (sel ? '已高亮其两源(再点取消)' : '点判官/证/甥可溯其亲缘三元(父·父→子)')}
					</span>
					{/* [寻源四线] 传本:由法官之阳爻上溯,四线各主一层面;线切换即改高亮路径 */}
					{veAll ? (
						<span className="horosa-geomancy-pyr-lines">
							{['fire', 'air', 'water', 'earth'].map((k)=>(
								<button
									type="button"
									key={k}
									title={(VIA_LINE_ZH[k] || {}).d}
									className={`${line === k ? 'is-active' : ''}${(veAll[k] || {}).traceable ? '' : ' is-miss'}`}
									onClick={()=>this.setState({ pyrLine: k })}
								>{(VIA_LINE_ZH[k] || {}).n}</button>
							))}
						</span>
					) : null}
					{ve && !ve.traceable
						? <span className="horosa-geomancy-pyr-vp">{`${(VIA_LINE_ZH[line] || {}).n}线:法官此行阴爻,不可由此寻源`}</span>
						: (vp.through
							? (
								<span className="horosa-geomancy-pyr-vp is-through">
									{veAll
										? `${(VIA_LINE_ZH[line] || {}).n}线贯通${(ve && ve.terminus) ? ` → 盾位${ve.terminus.position}·${VIA_SIDE_ZH[ve.terminus.side]}` : ''}`
										: '点之路贯通'}
								</span>
							)
							: (vp.broken_at ? <span className="horosa-geomancy-pyr-vp">{`${veAll ? `${(VIA_LINE_ZH[line] || {}).n}线` : '点之路'}断于${vp.broken_at}`}</span> : null))}
				</div>
				<svg viewBox={`0 0 ${W} ${H}`} className="horosa-geomancy-pyr-svg horosa-plain-text-board" xmlns="http://www.w3.org/2000/svg">
					{lines}
					{nodes}
				</svg>
				{recon ? (
					<div className="horosa-geomancy-pyr-recon">
						<span className="horosa-geomancy-pyr-tag">调和者(盘外)</span>
						{this.renderDots(recon.dots)}
						<strong>{recon.nameZh || recon.nameEn}</strong>
					</div>
				) : null}
			</div>
		);
	},

	renderWheel(reading){
		const houses = (reading && reading.houses) || [];
		const SIZE = 600, C = SIZE / 2;
		// 三环:外环=黄道带(星座符),中环=宫位(宫号+行星),内圆=中心标签。
		const rOuter = 288, rZodiac = 234, rSign = 261, rNum = 214, rPlanetBand = 156, rFigName = 120, rInner = 96;
		const D2R = Math.PI / 180;
		// 宫1 在左(9 点钟,180°),逆时针递增——标准占星盘向。
		// [RTL] 自右向左的传本:宫序顺时针递增(整盘镜像),宫一仍在 9 点钟位。
		const wheelRtl = (((reading && reading.settings) || {}).direction || 'LTR') === 'RTL';
		const houseCenterDeg = (houseIdx)=>(wheelRtl
			? 180 - (houseIdx - 0.5) * 30
			: 180 + (houseIdx - 0.5) * 30);
		const polar = (r, deg)=>[C + r * Math.cos(deg * D2R), C - r * Math.sin(deg * D2R)];
		// 外环+宫环分隔线
		const outerSpokes = [];
		const houseSpokes = [];
		for(let i = 0; i < 12; i++){
			const deg = 180 + i * 30;
			const [ox1, oy1] = polar(rZodiac, deg);
			const [ox2, oy2] = polar(rOuter, deg);
			outerSpokes.push(<line key={`os${i}`} x1={ox1} y1={oy1} x2={ox2} y2={oy2} className="horosa-geomancy-wheel-spoke" />);
			const [hx1, hy1] = polar(rInner, deg);
			const [hx2, hy2] = polar(rZodiac, deg);
			houseSpokes.push(<line key={`hs${i}`} x1={hx1} y1={hy1} x2={hx2} y2={hy2} className="horosa-geomancy-wheel-spoke" />);
		}
		return (
			<div className="horosa-geomancy-wheel">
				<svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="horosa-geomancy-wheel-svg horosa-plain-text-board" xmlns="http://www.w3.org/2000/svg">
					<circle cx={C} cy={C} r={rOuter} className="horosa-geomancy-wheel-ring is-gold" />
					<circle cx={C} cy={C} r={rZodiac} className="horosa-geomancy-wheel-ring is-gold" />
					<circle cx={C} cy={C} r={rInner} className="horosa-geomancy-wheel-ring is-gold" />
					{outerSpokes}
					{houseSpokes}
					{houses.map((h, i)=>{
						const deg = houseCenterDeg(i + 1);
						const [sx, sy] = polar(rSign, deg);
						const [nx, ny] = polar(rNum, deg);
						// [希腊点] 福/灵徽记贴宫号侧;四式宫位盘同接一件(greekPointsByHouse)
						const gk = (this.greekPointsByHouse(reading) || {})[h.house] || [];
						return (
							<g key={`h${i}`}>
								<text x={sx} y={sy} className="horosa-geomancy-wheel-sign" style={{ fontFamily: AstroFont }} textAnchor="middle" dominantBaseline="central">{signGlyph(h.sign)}</text>
								<text x={nx} y={ny} className="horosa-geomancy-wheel-num" textAnchor="middle" dominantBaseline="central">{h.house}</text>
								{gk.length ? (
									<text x={nx} y={ny + 17} className="horosa-geomancy-wheel-greek" textAnchor="middle" dominantBaseline="central">
										{gk.map((k)=>(k === 'fortune' ? '福' : '灵')).join('')}
									</text>
								) : null}
							</g>
						);
					})}
					{houses.map((h, i)=>{
						// 图形入宫:图名内移一环,把中环带让给落星;指示星宫(问者/所问)描金。
						const fig = h.figure || {};
						const nm = (fig.nameZh || fig.nameEn || '').slice(0, 2);
						if(!nm){ return null; }
						const [px, py] = polar(rFigName, houseCenterDeg(i + 1));
						const sig = (h.roles || []).length > 0;
						return (
							<text key={`f${i}`} x={px} y={py} className={`horosa-geomancy-wheel-figure${sig ? ' is-significator' : ''}`} textAnchor="middle" dominantBaseline="central">{nm}</text>
						);
					})}
					{/* 占星定局落星:甲=星落其所主图之宫(可缺可多现,是本法固有特征,照实呈现);
					    乙=另起点数定宫(每星必有且仅有一宫)。同宫多星沿宫楔均分,不越界。 */}
					{(()=>{
						const byHouse = this.planetsByHouse(reading) || {};   // 单一真值源;不落星时为空,盘上自然无星
						const out = [];
						Object.keys(byHouse).forEach((hs)=>{
							const hh = parseInt(hs, 10);
							const list = byHouse[hh] || [];
							const base = houseCenterDeg(hh);
							const step = list.length > 1 ? Math.min(22, 26 / list.length) : 0;
							const start = base - (step * (list.length - 1)) / 2;
							list.forEach((p, k)=>{
								const [gx, gy] = polar(rPlanetBand, start + k * step);
								out.push(
									<text key={`pl${hh}-${p}`} x={gx} y={gy} className="horosa-geomancy-wheel-planet"
										style={{ fontFamily: AstroFont }} textAnchor="middle" dominantBaseline="central">
										{PLANET_GLYPH_BY_EN[p] || ''}
									</text>,
								);
							});
						});
						return out;
					})()}
					<text x={C} y={C - 9} className="horosa-geomancy-wheel-center-title" textAnchor="middle">地占占星</text>
					<text x={C} y={C + 14} className="horosa-geomancy-wheel-center-sub" textAnchor="middle">{(reading && reading.ascendantSignZh) || ''}</text>
				</svg>
			</div>
		);
	},

	// 西非同族体系结构对照盘:两列各四记号(线形)+ 主形名 + 对应地占图 + 十六主形参考条。
	// ⚠️ 顶部文化边界声明为**强制呈现**,不可折叠隐藏。
	renderIfa(reading){
		const blk = (reading && reading.ifa) || {};
		const notice = (reading && reading.culturalNotice) || blk.cultural_notice || '';
		const col = (c, tag)=>{
			if(!c){ return null; }
			return (
				<div className="horosa-geomancy-ifa-col">
					<div className="horosa-geomancy-ifa-coltag">{tag}</div>
					<div className="horosa-geomancy-ifa-marks">
						{(c.marks || []).map((m, i)=>(
							<div className="horosa-geomancy-ifa-markrow" key={i}>
								{m === 'I'
									? <span className="horosa-geomancy-fig-line" />
									: (<><span className="horosa-geomancy-fig-line is-half" /><span className="horosa-geomancy-fig-line is-half" /></>)}
							</div>
						))}
					</div>
					<div className="horosa-geomancy-ifa-oduname">{c.odu_name || '—'}</div>
					<div className="horosa-geomancy-ifa-figname">对应图形 · {c.figure || '—'}</div>
				</div>
			);
		};
		return (
			<div className="horosa-geomancy-ifa">
				{notice ? <div className="horosa-geomancy-ifa-notice">{notice}</div> : null}
				<div className="horosa-geomancy-shield-title">
					结构对照盘 · {blk.label || ''}{blk.is_meji ? ' (主形)' : ''} · 自右向左读
				</div>
				<div className="horosa-geomancy-ifa-cols">
					{col(blk.right, '右列(资深)')}
					{col(blk.left, '左列')}
				</div>
				<div className="horosa-geomancy-ifa-reftitle">十六主形 · 比特对照</div>
				<div className="horosa-geomancy-ifa-ref">
					{(blk.meji_reference || []).map((e)=>(
						<div className="horosa-geomancy-ifa-refcell" key={e.seniority}>
							<span className="horosa-geomancy-ifa-refnum">{e.seniority}</span>
							<strong>{e.name}</strong>
							<em>{e.figure}</em>
						</div>
					))}
				</div>
			</div>
		);
	},

	// Sikidy 异或表盘:16 列 × 4 行点阵 + 列名/指代义 + 三道校验状态 + 诸侯/奴隶配色。
	renderSikidy(reading){
		const sk = reading.sikidy || {};
		const cols = sk.columns || {};
		const princes = new Set(sk.princes || []);
		return (
			<div className="horosa-geomancy-sikidy">
				<div className="horosa-geomancy-sikidy-status">
					三道校验：<strong className={sk.valid ? 'is-ok' : 'is-bad'}>{sk.valid ? '通过' : '未过'}</strong>
					{sk.red_sikidy ? <span className="horosa-geomancy-sikidy-red">红 Sikidy(大凶)</span> : null}
				</div>
				<div className="horosa-geomancy-sikidy-grid">
					{Array.from({ length: 16 }, (_, k)=>String(k + 1)).map((ci)=>{
						const c = cols[ci] || {};
						const rows = c.rows || [];
						return (
							<div className={`horosa-geomancy-sikidy-col${princes.has(Number(ci)) ? ' is-prince' : ' is-slave'}`} key={ci}>
								<div className="horosa-geomancy-sikidy-dots">
									{rows.map((v, ri)=>(
										<div className="horosa-geomancy-sikidy-dotrow" key={ri}>
											{v ? <span className="horosa-geomancy-dot" /> : (<><span className="horosa-geomancy-dot" /><span className="horosa-geomancy-dot" /></>)}
										</div>
									))}
								</div>
								<div className="horosa-geomancy-sikidy-meta"><span>{ci}</span><em>{c.name}</em><small>{c.meaning}</small></div>
							</div>
						);
					})}
				</div>
				{/* [列比对] 本体系判事靠「列与列是否相同」,而非盾牌的完美/相位。
				    问者列与某主题列同形 = 事之所系即在该主题(如与造物主列同主愈、与诸灵列同主灵扰)。 */}
				{sk.compare ? (()=>{
					const hits = Object.keys(sk.compare)
						.filter((k)=>sk.compare[k] && sk.compare[k].equal)
						.map((k)=>({ col: k, name: (cols[k] || {}).name, meaning: (cols[k] || {}).meaning }));
					return (
						<div className="horosa-geomancy-sikidy-compare">
							<div className="horosa-geomancy-sikidy-compare-title">
								列比对 · 问者列对各主题列（{Object.keys(sk.compare).length} 组）
							</div>
							{hits.length ? (
								<div className="horosa-geomancy-sikidy-hits">
									{hits.map((h)=>(
										<div className="horosa-geomancy-sikidy-hit" key={h.col}>
											<strong>第 {h.col} 列 · {h.name}</strong>
											<em>{h.meaning}</em>
										</div>
									))}
									<div className="horosa-geomancy-sikidy-hint">问者列与以上各列同形 —— 事之所系即在此。</div>
								</div>
							) : (
								<div className="horosa-geomancy-sikidy-hint">问者列与各主题列皆不同形:无直指之应,当以诸侯／奴隶分野与全局形势断。</div>
							)}
						</div>
					);
				})() : null}
				{/* [马语名录] 所据基准只载十六名与其词义、**未载「名↔图」之配对**,故只作名录呈现,不臆造配对。 */}
				<details className="horosa-geomancy-sikidy-mal">
					<summary>十六图形马达加斯加名（参考名录）</summary>
					<div className="horosa-geomancy-sikidy-malgrid">
						{MALAGASY_NAMES.map((m)=>(
							<div className="horosa-geomancy-sikidy-malcell" key={m.n}>
								<strong>{m.n}{m.lunar ? <span className="horosa-geomancy-sikidy-mallunar">月</span> : null}</strong>
								<em>{m.g}</em>
							</div>
						))}
					</div>
					<div className="horosa-geomancy-sikidy-hint">
						区域差异大;所据基准仅载名与词义、未载其与十六图形之配对,故不作配对显示。
					</div>
				</details>
			</div>
		);
	},

	// Hakata 四片盘:4 片正反(开/合)→ 4bit → 局图。
	renderHakata(reading){
		const hk = reading.hakata || {};
		const tablets = hk.tablets || [];
		return (
			<div className="horosa-geomancy-hakata">
				<div className="horosa-geomancy-hakata-tablets">
					{tablets.map((t, i)=>(
						<div className={`horosa-geomancy-hakata-tablet${t.open ? ' is-open' : ' is-closed'}`} key={i}>
							<strong>{t.label}</strong>
							<span className="horosa-geomancy-hakata-state">{t.open ? '开（单）' : '合（双）'}</span>
						</div>
					))}
				</div>
				<div className="horosa-geomancy-hakata-result">
					<div className="horosa-geomancy-hakata-figure" data-tone={hk.tone || ''}>{hk.figure_zh || hk.figure}</div>
					<small>{hk.reading}</small>
					{hk.orientation ? <small className="horosa-geomancy-hakata-orient">{hk.orientation}</small> : null}
				</div>
			</div>
		);
	},
};
