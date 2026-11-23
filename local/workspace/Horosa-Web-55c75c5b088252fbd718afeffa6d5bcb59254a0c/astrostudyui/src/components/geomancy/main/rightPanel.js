// 地占页 · 右栏:图卡、断语、宫位、对照表、流程核对、图目录与历史
// 从 GeomancyMain.js 按职责拆出的 GeomancyMain 方法:this 仍是 GeomancyMain 实例,门面里 mixinMethods(GeomancyMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React from 'react';
import { XQTabs as Tabs } from '../../xq-ui';
import { AstroFont } from '../../../constants/AstroConst';
import { signGlyph, GRANULAR_FIELDS, CATALOG_DOMAINS, questionTypeText, ZODIAC_SYSTEM_OPTIONS, COURT_VERDICT_ZH, TONE_CLASS_ZH, VALIDITY_RULES_ZH, STABILITY_ZH, PARITY_VIEW_ZH, QUADRANT_SYSTEM_ZH, fmtDegMin } from './tables';
const { TabPane } = Tabs;

export const rightPanelMethods = {
	renderFigureCard(fig, role){
		if(!fig){ return null; }
		const dots = Array.isArray(fig.dots) ? fig.dots : [];
		return (
			<div className="horosa-geomancy-figure-card" key={role}>
				<div className="horosa-geomancy-figure-dots">
					{dots.map((single, i)=>(
						<div className="horosa-geomancy-dot-row" key={i}>
							{single ? <span className="horosa-geomancy-dot" /> : (<><span className="horosa-geomancy-dot" /><span className="horosa-geomancy-dot" /></>)}
						</div>
					))}
				</div>
				<div className="horosa-geomancy-figure-meta">
					<span className="horosa-geomancy-figure-role">{role}</span>
					<strong>{fig.nameZh || fig.nameEn}
						{fig.displayName ? <span className="horosa-geomancy-figure-alt">{fig.displayName}</span> : null}
					</strong>
					<em>{[fig.planetZh, fig.elementZh, fig.signZh].filter(Boolean).join(' · ')}</em>
					{fig.keywordsZh ? <small>{fig.keywordsZh}</small> : null}
				</div>
			</div>
		);
	},

	// [边界] 结构对照模式:只作形的识别与比特对照,**不产出该体系之占断,亦不套用地占含义**。
	// 🔴 引擎守了(reading 只回 structural_only)、AI 快照守了(只出边界声明即 return),
	//    而右栏此前照旧全出地占判读(概要/判定图形/二十一行技法卡/十二宫断语)—— 边界在显示层被越。
	//    今三页签统一改出此卡。
	renderStructuralNotice(r){
		const ifa = r.ifa || {};
		return (
			<div className="horosa-geomancy-reading">
				<div className="horosa-geomancy-card">
					<div className="horosa-geomancy-card-title">边界声明</div>
					<div className="horosa-geomancy-odu-notice">
						{r.culturalNotice || '独立圣传体系,与地占仅十六个四行二元图形外形同构。此处仅作结构与比特对照,不套用地占含义、不构成该体系之占断。'}
					</div>
					{ifa.label ? (
						<div className="horosa-geomancy-summary">
							<div className="horosa-geomancy-summary-row"><span>结构对照</span><strong>{`${ifa.label}${ifa.is_meji ? '(主形)' : ''}`}</strong></div>
							<div className="horosa-geomancy-summary-row"><span>右列</span><strong>{`${(ifa.right || {}).odu_name || '—'} → ${(ifa.right || {}).figure || '—'}`}</strong></div>
							<div className="horosa-geomancy-summary-row"><span>左列</span><strong>{`${(ifa.left || {}).odu_name || '—'} → ${(ifa.left || {}).figure || '—'}`}</strong></div>
						</div>
					) : null}
					{/* 区块内之注一律用 note-hint:tech-hint 是技法行释义专用类,
					    混用会破坏「技法每行恰一句释义」的计数不变量 */}
					<div className="horosa-geomancy-note-hint">
						本模式不出地占之判定、解读技法与十二宫断语;欲作地占判读请在左栏另择流派。
						中栏「结构对照盘」可见两列记号与十六主形之比特对照。
					</div>
				</div>
			</div>
		);
	},

	renderReading(){
		const result = this.state.result;
		if(!result){ return <div className="horosa-huangji-empty">暂无地占数据</div>; }
		const r = result.reading || {};
		if(r.structuralOnly){ return this.renderStructuralNotice(r); }
		const houses = r.houses || [];
		// 读取范围真门控:L0 仅判官 / L1 +解读技法 / L2 盾牌全局(中栏恒在,解读同 L1) /
		// L3 +十二宫(默认,字节不变) / L4 = L3 并标注占星定局体系(黄道体系选择器所出,不臆造新层)。
		const depth = ({ L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 })[this.state.readingScope];
		const lvl = depth === undefined ? 3 : depth;
		return (
			<div className="horosa-geomancy-reading">
				{/* 首母中止警示:后端算出而此前前端零渲染(约 1/8 盘触发) */}
				{r.haltedOnFirstMother ? (
					<div className="horosa-geomancy-card" style={{ borderColor: 'var(--horosa-danger, #cf1322)' }}>
						<div className="horosa-geomancy-card-title" style={{ color: 'var(--horosa-danger, #cf1322)' }}>⚠ 首母中止</div>
						<div style={{ fontSize: 12.5, lineHeight: 1.6 }}>首母落 Rubeus/Cauda 之属——依所选传本传统,此占应中止、另择时再占;以下判读仅作参考。</div>
					</div>
				) : null}
				<div className="horosa-geomancy-card">
					<div className="horosa-geomancy-card-title">本占概要</div>
					<div className="horosa-geomancy-summary">
						<div className="horosa-geomancy-summary-row"><span>问题</span><strong>{r.question || '—'}</strong></div>
						<div className="horosa-geomancy-summary-row"><span>问类</span><strong>{questionTypeText(r.questionTypeZh, r.questionType)}</strong></div>
						<div className="horosa-geomancy-summary-row"><span>上升</span><strong>{(r.ascendantFigure || {}).nameZh || '—'} · {r.ascendantSignZh || ''}</strong></div>
						<div className="horosa-geomancy-summary-row"><span>主宫</span><strong>第 {r.primaryHouse || '—'} 宫</strong></div>
					</div>
				</div>
				<div className="horosa-geomancy-card">
					<div className="horosa-geomancy-card-title">判定图形</div>
					<div className="horosa-geomancy-figure-grid horosa-geomancy-key-figures">
						{this.renderFigureCard(r.judge, '判官')}
						{this.renderFigureCard(r.reconciler, '调和者')}
						{this.renderFigureCard(r.ascendantFigure, '命主')}
					</div>
					{/* 两法恒等是**数学事实**而非开关失灵:顺铺下宫一所盛正是首母,故 J⊕M1 与 J⊕问者指示星同值。
					    引擎早已回传该事实,但界面从不说 —— 用户只会以为「调和者取法」这开关坏了。今如实说明。 */}
					{((r.settings || {}).reconciler_modes_coincide) ? (
						<div className="horosa-geomancy-coincide-note">
							调和者取法二式此盘同值:顺铺下宫一所盛正是首母,故「判官⊕首母」与「判官⊕问者指示星」恒等。
							转宫后问者指示星随之易主,二式即分野。
						</div>
					) : null}
				</div>
				{lvl >= 1 ? this.renderFlowChecklist(r) : null}
				{lvl >= 4 ? (() => {
					// 如实描述定局链路:上升怎么来 → 十二宫怎么铺。此前文案称「按星座体系定十二宫星座」,
					// 而盘上画的却是写死的自然星座,与盘心上升矛盾;今与实际取值同源如实陈述。
					const er = r.astroErection || {};
					// 🔴 上升取法与黄道体系皆已增至三档,此处若仍写「非乙即甲」的二分,第三档就会被显示成第一档
					//    (选了「取法官之图」却写「取第一宫之图」= 显示层撒谎)。故一律**由选项表按实际值取名**,
					//    且以引擎回传值为准(而非组件 state,后者在载入/回放途中可能尚未同步)。
					const ASC_OPTS = (GRANULAR_FIELDS.find((f)=>f.key === 'ascSource') || {}).options || [];
					const ascWay = ((ASC_OPTS.find((o)=>o.key === er.asc_source) || {}).label)
						|| '取第一宫之图';
					const zsysKey = r.zodiacSystem || this.state.zodiacSystem;
					const zsysZh = ((ZODIAC_SYSTEM_OPTIONS.find((o)=>o.key === zsysKey) || {}).label)
						|| '古典定局体系';
					// 真实星历盘为唯一带度数之取法:有度数则如实报度、报所用象限宫制,并说明十二宫按真宫头分
					//(而非自上升整宫顺铺)。用户选了此档而时地不全者,如实报回落原因 —— 绝不假作已按时地起。
					const rc = r.realChart || null;
					const st = r.settings || {};
					const isReal = er.asc_source === 'real_chart' && er.asc_lon !== undefined;
					const PROJ_OPTS = (GRANULAR_FIELDS.find((f)=>f.key === 'houseProjection') || {}).options || [];
					const projWay = ((PROJ_OPTS.find((o)=>o.key === st.house_projection) || {}).label) || '';
					const projReal = st.house_projection === 'real_ephemeris';
					return (
						<div className="horosa-geomancy-card">
							<div className="horosa-geomancy-card-title">占星定局(L4)</div>
							<div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
								上升 <strong>{isReal ? (er.sign_zh || '—') : (r.ascendantSignZh || '—')}</strong>
								{isReal ? <strong>{` ${fmtDegMin(er.asc_deg_in_sign)}`}</strong> : null}
								(取法:{ascWay}
								{isReal ? '' : (er.figure ? ` · ${er.figure}` : '')}
								{isReal ? '' : `,按「${zsysZh}」得其星座`});
								{isReal
									? '十二宫按真实宫头度数分,见下各行星座与宫头度数。'
									: '十二宫自上升起按黄道顺铺,见下各行星座列。'}
							</div>
							{isReal ? (
								<div className="horosa-geomancy-note-hint">
									已按左栏所选时地起真实星历盘
									{er.quadrant_system
										? `(象限分宫用${QUADRANT_SYSTEM_ZH[er.quadrant_system] || er.quadrant_system})`
										: '(整宫制:各宫头为其星座之零度)'}
									{rc && typeof rc.mc_lon === 'number' ? `;中天黄经 ${rc.mc_lon.toFixed(2)}°` : ''}。
									⚠️ 此式非传本之法 —— 传本盘式之上升取自图形、不起真实星盘,故此为可选之第四式。
								</div>
							) : null}
							{(st.real_chart_requested && st.real_chart_available === false) ? (
								<div className="horosa-geomancy-note-hint">
									⚠️ 已选「据所选时地起真实上升」{projReal ? `与「${projWay}」` : ''},
									然左栏时地不全(须日期与经纬俱备)或星历不可用,
									故已如实回落图形取法{projReal ? '与占星定局甲' : ''}。
								</div>
							) : null}
							{er.degenerate_to_whole_sign ? (
								<div style={{ fontSize: 12, lineHeight: 1.6, marginTop: 6, opacity: 0.75 }}>
									{er.note || '地占定局只出上升星座而无度数,象限分宫须有宫头度数,故此处退化为整宫制'}。
								</div>
							) : null}
						</div>
					);
				})() : null}
				{lvl < 3 ? (
					<div className="horosa-geomancy-card">
						<div style={{ fontSize: 12, opacity: 0.7 }}>读取范围 {this.state.readingScope}:更深层(解读技法/十二宫)已按档隐藏,切至 L3/L4 展开全部。</div>
					</div>
				) : null}
			</div>
		);
	},

	// 图名 → 所选名表之名。引擎在 technique/亲缘三元 等处一律用**拉丁标识**指代图形,
	// 故此前无论名表怎么切,右栏都纹丝不动(实测拉丁 vs 阿拉伯 三 tab 逐字相同)。
	// 今据 figures16 建映射就地译名。🔴 拉丁档下 displayName === nameEn ⇒ 默认路径逐字不变。
	figNameMap(r){
		const m = {};
		((r && r.figures16) || []).forEach((f)=>{
			if(f && f.nameEn){ m[f.nameEn] = f.displayName || f.nameEn; }
		});
		return m;
	},

	// [判断 tab] 解读技法 + 转宫。独立成 tab —— 此前与概要/判定/九步/十二宫同挤一栏,
	// 一屏塞十几张卡,长到要滚很久才看得完,判读时来回找。
	renderJudgementTab(){
		const result = this.state.result;
		if(!result){ return <div className="horosa-huangji-empty">暂无地占数据,请先起盘</div>; }
		const r = result.reading || {};
		if(r.structuralOnly){ return this.renderStructuralNotice(r); }
		const depth = ({ L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 })[this.state.readingScope];
		const lvl = depth === undefined ? 3 : depth;
		if(lvl < 1){
			return (
				<div className="horosa-geomancy-reading">
					<div className="horosa-geomancy-card">
						<div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
							读取范围 {this.state.readingScope} 只出判官一图,解读技法按档隐藏 —— 切至 L1 以上即展开。
						</div>
					</div>
				</div>
			);
		}
		return <div className="horosa-geomancy-reading">{this.renderTechniqueCard(r)}</div>;
	},

	// [十二宫 tab] 图形入宫 · 断语。独立成 tab(十二行断语很长,与判断混排会互相埋没)。
	renderHousesTab(){
		const result = this.state.result;
		if(!result){ return <div className="horosa-huangji-empty">暂无地占数据,请先起盘</div>; }
		const r = result.reading || {};
		if(r.structuralOnly){ return this.renderStructuralNotice(r); }
		const houses = r.houses || [];
		const depth = ({ L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 })[this.state.readingScope];
		const lvl = depth === undefined ? 3 : depth;
		if(lvl < 3){
			return (
				<div className="horosa-geomancy-reading">
					<div className="horosa-geomancy-card">
						<div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
							读取范围 {this.state.readingScope} 不铺十二宫 —— 切至 L3/L4 即展开图形入宫与逐宫断语。
						</div>
					</div>
				</div>
			);
		}
		return (
			<div className="horosa-geomancy-reading">
				<div className="horosa-geomancy-card">
					<div className="horosa-geomancy-card-title">十二宫（图形入宫 · 断语）</div>
					{/* 入宫式非顺铺时如实交代:四正入宫者四果宫为对位两图之和,近世式为固定置换 */}
					{((r.settings || {}).house_placement === 'angular') ? (
						<div className="horosa-geomancy-coincide-note">
							四正入宫式:四母入一/十/七/四宫、四女入十一/二/八/五宫,
							三·六·九·十二四果宫所盛为对位两图相加之<strong>合成卦</strong>(非盾面原图)。
						</div>
					) : null}
					{((r.settings || {}).house_placement === 'golden_dawn') ? (
						<div className="horosa-geomancy-coincide-note">
							近世学派置换入宫:十二图按固定置换入宫(盾位一→十宫、盾位二→一宫……),非顺铺。
						</div>
					) : null}
					<div className="horosa-geomancy-house-list">
						{houses.map((h)=>{
							const fig = h.figure || {};
							const roles = h.roles || [];
							return (
								<div className={`horosa-geomancy-house-row${roles.length ? ' is-significator' : ''}`} key={h.house}>
									<span className="horosa-geomancy-house-num">{h.house}</span>
									<span
										className="horosa-geomancy-house-sign"
										title={h.naturalSignZh && h.naturalSignZh !== h.signZh
											? `定局星座 ${h.signZh}(自上升顺铺)· 自然星座 ${h.naturalSignZh}(次要判断)`
											: undefined}
									><span className="horosa-geomancy-sign-glyph" style={{ fontFamily: AstroFont }}>{signGlyph(h.sign)}</span> {h.signZh}
										{/* 宫头度数只在真实星历盘下有(图形取法无度数);无则此处一字不多,默认路径逐字不变 */}
										{typeof h.cuspDegInSign === 'number'
											? <em className="horosa-geomancy-cusp-deg">{fmtDegMin(h.cuspDegInSign)}</em>
											: null}
									</span>
									<span className="horosa-geomancy-house-topic">
										<span className="horosa-geomancy-house-name">{h.nameZh || h.topicsZh}</span>
										{/* 🔴 图名 / 副名 / 角色**各自独立成项**,由 topic 的 flex-wrap 自然换行。
										    此前三者挤在同一个 `white-space: nowrap` 的 span 里:
										    宫一既带长拉丁副名又同时挂「·问者 ·所问」,整段挤出行外 17.5px(实测)。
										    分开之后,窄栏下先折角色、再折副名,任何宽度都不会戳出去。 */}
										<span className="horosa-geomancy-house-figure" data-tone={fig.tone || ''}>
											{fig.nameZh || fig.nameEn}
										</span>
										{fig.displayName ? (
											<em className="horosa-geomancy-house-figure-alt">{fig.displayName}</em>
										) : null}
										{roles.length ? (
											<span className="horosa-geomancy-house-roles">
												{roles.indexOf('querent') >= 0 ? '·问者' : ''}
												{roles.indexOf('quesited') >= 0 ? '·所问' : ''}
											</span>
										) : null}
									</span>
									{((this.state.result || {}).reading || {}).profileId === 'india_ramal' && (h.figure || {}).vedic ? (
										<small className="horosa-geomancy-house-vedic">
											{[h.bhava ? `${h.bhava}(${h.bhavaZh || ''})` : '',
												h.figure.vedic.graha_zh || '',
												h.figure.vedic.rashi || ''].filter(Boolean).join(' · ')}
										</small>
									) : null}
									{h.reading ? <small className="horosa-geomancy-house-reading">{h.reading}</small> : null}
									{/* 盘式十二宫主宰事项(传本关键词树):展开即见该宫所主之全谱 */}
									{h.topicsDetailZh ? (
										<details className="horosa-geomancy-house-detail">
											<summary>{`本宫主宰事项`}</summary>
											<div>{h.topicsDetailZh}</div>
										</details>
									) : null}
								</div>
							);
						})}
					</div>
				</div>
			</div>
		);
	},

	// 十六图 ↔ 十六主形 线形对照(静态)。中栏结构对照盘只在该流派下可见,此处让用户不切流派也能查。
	// ⚠️ 必带边界声明:独立圣传体系,仅结构同构对照,不套地占含义、不构成占断。
	renderOduTable(figures){
		const rows = (figures || []).filter((f)=>f && f.odu)
			.slice().sort((a, b)=>((a.odu.seniority || 99) - (b.odu.seniority || 99)));
		if(!rows.length){ return null; }
		return (
			<details className="horosa-geomancy-odu-table">
				<summary>十六图 ↔ 十六主形 · 线形对照</summary>
				<div className="horosa-geomancy-odu-notice">
					独立圣传体系,与地占仅十六个四行二元图形外形同构。此处仅作结构与比特对照,
					不套用地占含义、不构成该体系之占断。
				</div>
				<div className="horosa-geomancy-odu-grid">
					{rows.map((f)=>(
						<div className="horosa-geomancy-odu-cell" key={f.nameEn}>
							<span className="horosa-geomancy-odu-seniority">{f.odu.seniority}</span>
							<span className="horosa-geomancy-odu-marks">
								{(f.odu.marks || []).map((m, i)=>(
									<span className="horosa-geomancy-odu-markrow" key={i}>
										{m === 'I'
											? <span className="horosa-geomancy-fig-line" />
											: (<><span className="horosa-geomancy-fig-line is-half" /><span className="horosa-geomancy-fig-line is-half" /></>)}
									</span>
								))}
							</span>
							<span className="horosa-geomancy-odu-names">
								<strong>{f.odu.name}</strong>
								<em>{f.nameZh || f.nameEn}</em>
							</span>
						</div>
					))}
				</div>
			</details>
		);
	},

	// [判读流程] 九步 checklist:基准明言此流程可编码为状态机。每步显实际判定与是否成立,
	// 使判读有据可循、不致东看一眼西看一眼。
	renderFlowChecklist(r){
		const t = (r && r.technique) || {};
		if(!t || r.structuralOnly){ return null; }
		const PERF = { occupation: '入主成局', conjunction: '会合成局', mutation: '互变成局', translation: '传递成局', none: '未成局' };
		const ASP = { conjunction: '合', sextile: '六分(吉)', square: '刑(凶)', trine: '拱(吉)', opposition: '冲', none: '无相位' };
		const perfHit = t.perfection && t.perfection !== 'none';
		const d = t.perfection_detail || {};
		const comp = (t.company || []).filter((c)=>c.type && c.type !== 'none');
		const va = t.validity;
		const vaHits = ((va && va.rules) || []).filter((x)=>x.hit);
		const cv = t.court_verdict;
		const rp = t.reconciler_parity;
		const steps = [
			// 传本解卦六步之首:先看一宫定卦盘是否有效
			['验卦盘有效', vaHits.length
				? vaHits.map((x)=>VALIDITY_RULES_ZH[x.code] || x.code).join('；')
				: (va ? '五则皆过,卦盘可判' : '—'), !!va && !vaHits.length],
			['定主题之宫', `问类主宫 第 ${r.primaryHouse || '—'} 宫`, !!r.primaryHouse],
			['取两指示星', `问者 第 ${r.querentHouse || 1} 宫 · 所问 第 ${r.primaryHouse || '—'} 宫`, true],
			// 传本第二步:法庭三角总断吉凶方向
			['看法庭三角', cv
				? `${TONE_CLASS_ZH[cv.left.tone_class]}${TONE_CLASS_ZH[cv.judge.tone_class]}${TONE_CLASS_ZH[cv.right.tone_class]} → ${COURT_VERDICT_ZH[cv.verdict_code] || cv.verdict_code}`
				: '—', !!cv && cv.judge.tone_class !== 'bad'],
			['查完美', perfHit ? PERF[t.perfection] : (t.perfection_by_aspect ? `借相位(${ASP[t.perfection_by_aspect]})成局` : '未成局'), !!(perfHit || t.perfection_by_aspect)],
			['查阻碍', t.prohibition ? `第 ${t.prohibition} 宫强凶图阻断` : '无阻碍', !t.prohibition],
			['相位与同伴', `${ASP[t.aspect] || t.aspect}${comp.length ? `；同伴 ${comp.length} 对` : '；无同伴'}`, true],
			['吉凶动静(位置)', t.locus_quesited ? `所问落${t.locus_quesited.label}` : '—', t.locus_quesited ? t.locus_quesited.band !== 'unfortunate' : true],
			['自然共主', t.natural_cosignificator ? '月亮(判官属月亮系)' : '不涉', true],
			['点之路·点数', `${t.via_puncti ? (t.via_puncti.through ? '点之路贯通' : `断于${t.via_puncti.broken_at}`) : '—'}；${t.points_parity ? (t.points_parity.parity === 'even' ? '总点偶→是/稳' : '总点奇→否/动') : '—'}`, !!(t.via_puncti && t.via_puncti.through)],
			// 传本第六步:看第十六卦宣判 —— 按提示改变后之结果,并参其奇偶断真假虚实
			['看宣判(补卦)', rp
				? `${rp.figure}·${rp.parity === 'even' ? '偶→偏实' : '奇→偏虚'}`
				: '不取调和者', !!rp],
			['综合断', d.via_figure ? `经中介成局(${Array.isArray(d.via_figure) ? d.via_figure.join('、') : d.via_figure})` : (perfHit ? '直接成局' : '未见成局之路'), !!perfHit],
		];
		return (
			<div className="horosa-geomancy-card horosa-geomancy-flow">
				<div className="horosa-geomancy-card-title">{`判读流程 · ${steps.length}步`}</div>
				<ol className="horosa-geomancy-flow-list">
					{steps.map(([label, val, ok], i)=>(
						<li className={`horosa-geomancy-flow-step${ok ? ' is-ok' : ' is-no'}`} key={i}>
							<span className="horosa-geomancy-flow-idx">{i + 1}</span>
							<span className="horosa-geomancy-flow-label">{label}</span>
							<span className="horosa-geomancy-flow-val">{val}</span>
							<span className="horosa-geomancy-flow-mark">{ok ? '✔' : '✘'}</span>
						</li>
					))}
				</ol>
			</div>
		);
	},

	renderFigureCatalog(){
		const figures = (this.state.result && this.state.result.figures) || [];
		if(!figures.length){ return <div className="horosa-huangji-empty">起盘后显示 16 图形目录</div>; }
		return (
			<div className="horosa-geomancy-catalog-wrap">
			{this.renderOduTable(figures)}
			<div className="horosa-geomancy-catalog-grid">
				{figures.map((f, i)=>{
					const tone = { good: '吉', bad: '凶', neutral: '中' }[f.tone] || '';
					// 传本吉凶口径(tone_book)与本仓固有口径(tone)六图相异 —— 两口径并显,不相覆盖
					const toneBook = { good: '吉', bad: '凶', neutral: '中', weak_good: '弱吉' }[f.toneBook] || '';
					const line2 = [f.planetZh, f.elementZh, f.signZh].filter(Boolean).join(' · ');
					const line3 = [f.elementOuterZh ? `外元素${f.elementOuterZh}` : '', f.bodyPart ? `身体${f.bodyPart}` : '', f.color || ''].filter(Boolean).join(' · ');
					// 传本对应系统:稳定性三联(稳慢长/变快短)+ 奇偶主客观 + 卡巴拉源质 + 身体详表
					const zt = f.zodiacTriple || {};
					const line4 = [
						f.qualityBook ? `稳定性${STABILITY_ZH[f.qualityBook]}` : '',
						f.points ? PARITY_VIEW_ZH[f.points % 2 === 0 ? 'even' : 'odd'] : '',
						(f.kabbalah && f.kabbalah.length) ? `源质${f.kabbalah.join('·')}` : '',
					].filter(Boolean).join(' · ');
					return (
						<div className={`horosa-geomancy-catalog-card${f.tone ? ` is-tone-${f.tone}` : ''}`} key={f.nameEn || i}>
							<strong>{f.nameZh || f.latin || f.nameEn}{tone ? <span className="horosa-geomancy-catalog-tone">{tone}</span> : null}
								{toneBook && toneBook !== tone ? (
									<span className="horosa-geomancy-catalog-tone is-book" title="传本普遍吉凶性(与本仓固有口径相异者并显)">{`传${toneBook}`}</span>
								) : null}
							</strong>
							<em>{f.displayName || f.nameEn}{f.points ? ` · ${f.points}点` : ''}</em>
							{line2 ? <small>{line2}</small> : null}
							{line3 ? <small className="horosa-geomancy-catalog-astro">{line3}</small> : null}
							{line4 ? <small className="horosa-geomancy-catalog-corr">{line4}</small> : null}
							{f.bodyDetailZh ? <small className="horosa-geomancy-catalog-body">{`身体详:${f.bodyDetailZh}`}</small> : null}
							{f.keywordsZh ? <small>{f.keywordsZh}</small> : null}
							{/* 传本逐卦意象(整段):卦名之外另有物象与情境之喻,为解卦取象所本 */}
							{f.imageryZh ? (
								<details className="horosa-geomancy-catalog-more">
									<summary>传本意象</summary>
									<div className="horosa-geomancy-catalog-imagery">{f.imageryZh}</div>
								</details>
							) : null}
							{/* 三套黄道并显:古典定局 / 行星归属 / 行星归属·乙(另一传本表) */}
							{(zt.classical || zt.planetary || zt.planetaryAlt) ? (
								<small className="horosa-geomancy-catalog-zodiac">
									{[zt.classical ? `古典${zt.classical.zh}` : '',
										zt.planetary ? `行星${zt.planetary.zh}` : '',
										zt.planetaryAlt ? `行星乙${zt.planetaryAlt.zh}` : ''].filter(Boolean).join('　')}
								</small>
							) : null}
							{f.meanings ? <small className="horosa-geomancy-catalog-mean">爱情{f.meanings['爱情']} · 财{f.meanings['财富']} · 业{f.meanings['事业']}</small> : null}
							{/* 十域全表:此前只内联三域,另七域数据在册却不显 —— 展开即见,不必另开页 */}
							{f.meanings ? (
								<details className="horosa-geomancy-catalog-more">
									<summary>十域全表</summary>
									<div className="horosa-geomancy-catalog-domains">
										{CATALOG_DOMAINS.map((k)=>(f.meanings[k] ? (
											<div className="horosa-geomancy-catalog-domain" key={k}><span>{k}</span><strong>{f.meanings[k]}</strong></div>
										) : null))}
										{f.meanings.tone_detail ? <div className="horosa-geomancy-catalog-domain"><span>吉凶</span><strong>{f.meanings.tone_detail}</strong></div> : null}
									</div>
								</details>
							) : null}
							{this.state.showUnicodeGlyph && f.unicode ? (
								<small className="horosa-geomancy-catalog-uni" title="Unicode 码位字形(需系统装有对应字体)">{f.unicode}</small>
							) : null}
							{/* 东传一路:该图所主之曜与星座宫位之该支名(引擎叠加层,纯显示不改判读) */}
							{f.vedic && f.vedic.graha_zh ? (
								<small className="horosa-geomancy-catalog-vedic">
									{`${f.vedic.graha_zh}(${f.vedic.graha_sanskrit})${f.vedic.rashi ? ` · ${f.vedic.rashi}` : ''}`}
								</small>
							) : null}
							{(f.isPalindrome || (f.activeElements && f.activeElements.count >= 0)) ? (
								<small className="horosa-geomancy-catalog-struct">
									{[f.isPalindrome ? '自逆转' : '',
										f.activeElements ? `在场:${(f.activeElements.zh || []).join('') || '无'}` : ''].filter(Boolean).join('　')}
								</small>
							) : null}
							{(f.number || f.directionCompass) ? (
								<small className="horosa-geomancy-catalog-num">
									{[f.number ? `图数${f.number.value}(${{ points: '点数', planetary: '行星序', abjad: '字母值' }[f.number.system] || f.number.system})` : '',
										f.directionCompass ? `方位${f.directionCompass}` : ''].filter(Boolean).join('　')}
								</small>
							) : null}
							{/* 图形关系六式(传本明言「与解卦无关,只为理解十六卦之内在关系」)*/}
							{(f.oppositeOf || f.reverseOf || f.inverseOf || f.converseOf || f.rotateOf) ? (
								<small className="horosa-geomancy-catalog-rel" title="与解卦无关,只为理解十六卦之内在关系">
									{[f.oppositeOf ? `对:${f.oppositeOf}` : '',
										f.reverseOf ? `倒:${f.reverseOf}` : '',
										f.inverseOf ? `逆:${f.inverseOf}` : '',
										f.converseOf ? `倒逆:${f.converseOf}` : '',
										f.rotateOf ? `减:${f.rotateOf}` : ''].filter(Boolean).join('　')}
								</small>
							) : null}
							{(f.nameArabic || f.nameGreek || f.nameHebrew || f.nameYoruba || f.odu) ? (
								<small className="horosa-geomancy-catalog-alt">
									{[f.nameArabic ? `阿:${f.nameArabic}` : '', f.nameArabicScript ? `(${f.nameArabicScript})` : '',
										f.nameGreek ? `希:${f.nameGreek}` : '', f.nameHebrew ? `伯:${f.nameHebrew}` : '',
										f.nameYoruba ? `约:${f.nameYoruba}` : '',
										f.odu ? `主形:${f.odu.name}` : ''].filter(Boolean).join('　')}
								</small>
							) : null}
						</div>
					);
				})}
			</div>
			</div>
		);
	},

	renderHistory(){
		const history = this.state.history || [];
		if(!history.length){ return <div className="horosa-huangji-empty">暂无历史记录</div>; }
		return (
			<div className="horosa-geomancy-history-list">
				{history.map((h, i)=>(
					<button type="button" className="horosa-geomancy-history-row" key={`${h.ts}_${i}`} onClick={()=>this.applyHistory(h)}>
						<span className="horosa-geomancy-history-q">{h.question || '（无问题）'}</span>
						<span className="horosa-geomancy-history-meta">{questionTypeText(h.questionTypeZh, h.questionType)} · 判官{h.judge || '—'}</span>
					</button>
				))}
			</div>
		);
	},

	renderRightPanel(){
		return (
			<Tabs size="small" activeKey={this.state.rightPanelTab} onChange={this.setRightPanelTab} className="horosa-geomancy-aux horosa-cnx-aux">
				<TabPane tab="解读" key="reading">{this.renderReading()}</TabPane>
				<TabPane tab="判断" key="judgement">{this.renderJudgementTab()}</TabPane>
				<TabPane tab="十二宫" key="houses">{this.renderHousesTab()}</TabPane>
				<TabPane tab="十六图形" key="figures">{this.renderFigureCatalog()}</TabPane>
				<TabPane tab="历史" key="history">{this.renderHistory()}</TabPane>
			</Tabs>
		);
	},
};
