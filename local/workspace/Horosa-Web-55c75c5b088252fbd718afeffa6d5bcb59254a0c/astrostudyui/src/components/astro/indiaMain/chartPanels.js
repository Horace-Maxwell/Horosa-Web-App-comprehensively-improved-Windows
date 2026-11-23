// 印占页 · 盘面部分:判定注记、叠加点、Nadi 面板、分盘网格与分盘分析卡、显示宫位、底部快捷栏
// 从 IndiaChartMain.js 按职责拆出的 IndiaChartMain 方法:this 仍是 IndiaChartMain 实例,门面里 mixinMethods(IndiaChartMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { civilInstantMsOfStr } from '../../../utils/dateStrSafe';
import IndiaChart from '../IndiaChart';
import { resolveLagnaRefSignNumber } from '../IndiaSouthChart';
import INDIA_JUDGMENT_NOTES from '../indiaJudgmentNotes';
import QuickDockBar from '../../common/QuickDockBar';
import * as AstroConst from '../../../constants/AstroConst';
import { pickKeyedDerived } from '../../../utils/derivedChartSource';
import { VARGA_GRID_LABEL, VARGA_GRID_MAX, VARGA_GRID_DEFAULT, indiaSnapshotScope } from './optionState';
import { getJyotish, resolveJyotishChartObj } from './jyotishData';

export const chartPanelMethods = {
	renderJudgmentNotes(tabKey){
		// W2 判读要点:纯静态常量卡(文本逐字取权威文档),零算法零请求;复用既有卡样式。
		const notes = INDIA_JUDGMENT_NOTES[tabKey];
		if(!notes || !notes.length){ return null; }
		return notes.map((n, i)=>(
			<div className="horosa-info-card" key={`jn_${tabKey}_${i}`}>
				<div className="horosa-info-card-title">判读要点 · {n.title}</div>
				<div className="horosa-india-data-list">
					{n.lines.map((ln, j)=>(
						<div className="horosa-india-card-note" key={j} style={{ textAlign: 'left' }}>{ln}</div>
					))}
				</div>
			</div>
		));
	},

	// 上次成功盘(切换 / 重取期间的回退源)只在出自当前命主时用
	shownLastChartObj(){
		return pickKeyedDerived(this.state.lastChartObj, this.state.lastChartObjSig, this.state.activeNatalSig);
	},

	buildOverlayPoints(){
		// B4:盘面叠加(默认 undefined = 三盘式零视觉回归)。KP cusp 信息在非整宫制下由各宫 cusp 度标呈现,不重复叠加。
		if(!this.state.indiaOverlayBB){ return undefined; }
		const co = this.state.mainChartObj || this.shownLastChartObj();
		const bb = co && co.jyotish && co.jyotish.nadi && co.jyotish.nadi.bhriguBindu;
		if(!bb || bb.signIndex === undefined){ return undefined; }
		return [{ key: 'bb', signNumber: (bb.signIndex % 12) + 1, label: 'BB',
			title: `Bhrigu Bindu ${bb.signLabel} ${(bb.signlon || 0).toFixed(1)}°` }];
	},

	renderNadiPanel(fields){
		// B1 纳迪面板(五支手册 Nadi 显示清单):七卡全复用既有设计语言,零新 CSS。
		const chartObj = resolveJyotishChartObj(this.state, fields);
		const jy = (chartObj && chartObj.jyotish) || {};
		const nd = jy.nadi || {};
		const PCN = { Sun: '太阳', Moon: '月亮', Mars: '火星', Mercury: '水星', Jupiter: '木星', Venus: '金星', Saturn: '土星', 'North Node': '罗睺', 'South Node': '计都' };
		if(!nd.available){
			return <div className="horosa-india-dasha-panel"><div className="horosa-india-dasha-empty">纳迪数据计算中…</div></div>;
		}
		const bb = nd.bhriguBindu || {};
		const fmtD = (v)=>`${Math.floor(v)}°${String(Math.round((v % 1) * 60)).padStart(2, '0')}′`;
		// 木星推进:当前年龄段高亮
		const jp = nd.jupiterProgression;
		let curAge = null;
		try{
			const bt = fields && fields.date && fields.date.value;
			if(bt && bt.format){ curAge = Math.max(0, (Date.now() - civilInstantMsOfStr(bt.format('YYYY-MM-DD'))) / 31557600000); }
		}catch(e){ curAge = null; }
		return (
			<div className="horosa-india-dasha-panel">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Bhrigu Bindu 福德点（Rahu·Moon 短弧中点）</div>
					{/* 口径注明:本组(BB / D150 / 同座合 / 木星推进)恒按 D1 本命盘的绝对黄经算,不随左栏所选分盘漂移 */}
					<div className="horosa-india-card-note">口径:本组恒按 D1 本命盘的绝对黄经计算,不随左栏所选分盘(D9 等)漂移。</div>
					<div className="horosa-info-row"><span>落座</span><strong>{bb.signLabel}（{fmtD(bb.signlon || 0)}）</strong></div>
					<div className="horosa-info-row"><span>月宿</span><strong>{bb.nakshatra ? `${bb.nakshatra.index}. ${bb.nakshatra.name}` : '—'}</strong></div>
					<div className="horosa-info-row"><span>黄经</span><strong>{fmtD(bb.lon || 0)}（{bb.sign}）</strong></div>
					<div className="horosa-india-card-note">{nd.note}</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">D150 纳地盘（每格 0°12′ · 精确边界）</div>
					<div className="horosa-india-maitri-wrap">
						<table className="horosa-india-maitri-table horosa-india-shad-table">
							<thead><tr><th>曜</th><th>第 N/150</th><th>座</th><th>座内度区</th><th>专名</th></tr></thead>
							<tbody>
								{(nd.d150 || []).map((r)=>(
									<tr key={r.planet}>
										<td>{PCN[r.planet] || r.planet}</td>
										<td>{r.nadiamsa}</td>
										<td>{r.signLabel}</td>
										<td>{r.startLon !== undefined ? `${fmtD(r.startLon % 30)}–${fmtD(r.endLon % 30)}` : '—'}</td>
										<td><span className="horosa-india-source-tag">专名表待补</span></td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div className="horosa-india-card-note">{nd.d150Note}</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">行星组合（同座 = 合）</div>
					{(nd.combinations || []).length ? (
						<div className="horosa-india-data-list">
							{nd.combinations.map((c)=>(
								<div className="horosa-india-data-row" key={c.sign}>
									<strong>{c.signLabel}</strong>
									<span>{c.planets.map((pid)=>PCN[pid] || pid).join(' + ')}</span>
									<em>{c.count} 曜</em>
								</div>
							))}
						</div>
					) : <div className="horosa-india-card-note">本盘无同座组合。</div>}
					<div className="horosa-india-card-note">{nd.combinationNote}</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">星座交换 Parivartana（庙座互驻 · 强联动）</div>
					{(nd.exchanges || []).length ? (
						<div className="horosa-india-data-list">
							{nd.exchanges.map((ex, i)=>(
								<div className="horosa-india-data-row" key={i}>
									<strong>{PCN[ex.a] || ex.a}（{ex.aSignLabel}）⇄ {PCN[ex.b] || ex.b}（{ex.bSignLabel}）</strong>
									<em>{ex.dualLord ? '含双主宫' : ''}</em>
								</div>
							))}
						</div>
					) : <div className="horosa-india-card-note">本盘无星座交换对。</div>}
				</div>
				{jp ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">木星推进时间轴（Bhrigu 应期）</div>
						<div className="horosa-india-data-list">
							{jp.segments.map((seg)=>{
								const active = curAge !== null && curAge >= seg.startAge && curAge < seg.endAge;
								return (
									<div className="horosa-india-data-row" key={seg.index}>
										<strong>{active ? <span className="horosa-india-flag-badge is-good">{seg.signLabel}</span> : seg.signLabel}</strong>
										<span>{seg.startAge}–{seg.endAge} 岁{seg.startDate ? ` · ${seg.startDate}~${seg.endDate}` : ''}</span>
										<em>{(seg.natalPlanets || []).map((pid)=>PCN[pid] || pid).join('、') || '—'}</em>
									</div>
								);
							})}
						</div>
						<div className="horosa-india-card-note">{jp.ruleLabel}</div>
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Nadi Karaka 体系（木星为首要 karaka）</div>
					<div className="horosa-india-data-list">
						{(nd.karakas || []).map((k)=>(
							<div className="horosa-india-data-row" key={k.planet}>
								<strong>{k.primary ? <span className="horosa-india-flag-badge is-good">{k.label}</span> : k.label}</strong>
								<span>{(k.significations || []).join(' · ')}</span>
							</div>
						))}
					</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">关于 Nadi</div>
					<div className="horosa-india-card-note">Nadi 有两类:叶片 Nadi(仙人预写的个人命书,以拇指纹索引匹配)无起盘算法、不可程序化;计算型 Nadi(Bhrigu Nadi 体系)用标准恒星盘+独特规则,可复现。本模块只做计算型。</div>
					<div className="horosa-india-card-note">主要文本:Chandra Kala Nadi / Deva Keralam(最系统的计算型 Nadi,含 D150 与大量组合断语)· Saptarishi Nadi(七仙对话体)· Bhrigu Nadi / Bhrigu Samhita(木星 karaka 法)· Dhruva/Shukra/Surya Nadi 等分支。</div>
					<div className="horosa-india-card-note">判读逻辑:只看行星落座与行星间关系,弱化宫位与相位;同座=合;庙座互驻=强联动;以木星推进定应期。</div>
				</div>
			</div>
		);
	},

	renderVargaGrid(fields, opts){
		const fractals = (this.state.vargaSetFractals && this.state.vargaSetFractals.length)
			? this.state.vargaSetFractals.slice(0, VARGA_GRID_MAX)
			: VARGA_GRID_DEFAULT.slice();
		const hookList = Object.keys(this.state.hook).map((k)=>this.state.hook[k]);
		const cols = fractals.length <= 1 ? 1 : 2;
		const rows = Math.max(1, Math.ceil(fractals.length / cols));
		// 多列(2+盘)时每格仅约半宽 → 缩小盘内字体并紧凑布局,保证完整不裁切;单盘全宽用原尺寸。
		const gridCls = `horosa-india-varga-grid${cols > 1 ? ' horosa-india-varga-grid-multi' : ''}`;
		return (
			<div
				className={gridCls}
				style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
			>
				{fractals.map((f, idx)=>{
					const hookEntry = hookList.find((h)=>h.fractal === f) || { fractal: f };
					const label = VARGA_GRID_LABEL[f] || `D${f}`;
					const sub = label.indexOf('·') >= 0 ? label.split('·')[1].trim() : (hookEntry.txt || '');
					return (
						<div className="horosa-india-varga-cell" key={`varga_${f}_${idx}`}>
							<div className="horosa-india-varga-cell-title">
								<strong>D{f}</strong>
								<span>{sub}</span>
							</div>
							<div className="horosa-india-varga-cell-chart">
								<IndiaChart
									key={`vgrid_${f}_${opts.indiaChartStyle}_${opts.indiaAyanamsa}_${opts.indiaHsys}_${opts.indiaNodeType}`}
									chartOnly
									snapshotScope={indiaSnapshotScope(this.props.techniqueScope)}   /* 择日内嵌:快照只写宿主槽 */
									composeAiSnapshot={this.props.composeAiSnapshot}
									aspectSourceId={this.state.indiaAspectSource}
									aspectParadigm={this.state.indiaAspectParadigm}
									onPlanetClick={this.toggleIndiaAspect}
									chartnum={f}
									fields={fields}
									height="100%"
									chartDisplay={this.props.chartDisplay}
									indiaChartStyle={opts.indiaChartStyle}
									indiaAyanamsa={opts.indiaAyanamsa}
									indiaHsys={opts.indiaHsys}
									indiaNodeType={opts.indiaNodeType}
									degreeDisplayMode={opts.degreeDisplayMode}
									planetGlyphMode={opts.indiaPlanetDisplayMode}
									counterClockwise={opts.indiaCounterClockwise}
									lagnaRef={opts.indiaLagnaRef}
									planetDisplay={this.props.planetDisplay || AstroConst.DEFAULT_OBJECTS}	/* 缺 props 兜默认集:曾回退「不过滤=全画」,择日内嵌宿主盘面被 33 个西占 Pars 淹没(用户实报) */
									lotsDisplay={this.props.lotsDisplay || []}
									showPlanetHouseInfo={false}
									showAstroMeaning={false}
									hook={hookEntry}
									dispatch={this.props.dispatch}
								/>
							</div>
						</div>
					);
				})}
			</div>
		);
	},

	renderVargaAnalysisCards(fields){
		// 分盘判读卡(归「分盘」tab):D60 六十分盘吉凶 + 分盘变体对照(D2/D3/D24/D30 各流派落座)。
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const shashti = jyotish && jyotish.shashtiamsa && jyotish.shashtiamsa.available ? jyotish.shashtiamsa : null;
		const vargaVar = jyotish && jyotish.vargaVariants && jyotish.vargaVariants.available ? jyotish.vargaVariants : null;
		const nadi = jyotish && jyotish.nadi && jyotish.nadi.available ? jyotish.nadi : null;   // D150 纳地盘(分盘)
		if(!shashti && !vargaVar && !(nadi && nadi.d150 && nadi.d150.length)){ return null; }
		const PCN = { Sun: '太阳', Moon: '月亮', Mars: '火星', Mercury: '水星', Jupiter: '木星', Venus: '金星', Saturn: '土星', Rahu: '罗睺', Ketu: '计都', 'North Node': '罗睺', 'South Node': '计都' };
		return (
			<div className="horosa-india-jyotish-panel horosa-india-varga-analysis">
				{shashti && shashti.planets && shashti.planets.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">D60 Ṣaṣṭyāṃśa 六十分盘吉凶（各曜本命落第几段 · Krūra 恶段为凶）</div>
						<div className="horosa-info-row"><span>统计</span><strong>吉 {shashti.beneficCount} · 凶 {shashti.maleficCount}</strong></div>
						<div className="horosa-india-data-list">
							{shashti.planets.map((x)=>(
								<div className="horosa-india-data-row" key={x.planet}>
									<strong>{PCN[x.planet] || x.planet}</strong>
									<span>第 {x.segment} / 60 · {x.deity ? `${x.deity} · ` : ''}{x.signLabel}</span>
									<em style={{ color: x.nature === 'malefic' ? 'var(--horosa-jx-xiong)' : 'var(--horosa-jx-ji)' }}>{x.nature === 'malefic' ? '凶' : '吉'}</em>
								</div>
							))}
						</div>
						<div className="horosa-india-card-note">{shashti.note || 'Krūra 恶段→凶，余吉；偶象神名逆序。'}</div>
					</div>
				) : null}
				{vargaVar && vargaVar.charts && vargaVar.charts.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">分盘变体对照（D2/D3/D24/D30 各流派落座 · 标准 Parāśara 为默认）</div>
						{vargaVar.charts.map((ch)=>(
							<div className="horosa-india-varga-variant-block" key={ch.key} style={{ marginBottom: 10 }}>
								<div className="horosa-india-data-subhead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
									<strong>{ch.label}{ch.selected && ch.selected !== 'standard' ? ` · 当前:${(ch.variants.find((v)=>v.key === ch.selected) || {}).label || ch.selected}` : ''}</strong>
									<em style={{ opacity: 0.7, fontSize: '0.85em' }}>{ch.variants.map((v)=>v.label).join(' · ')}</em>
								</div>
								<div className="horosa-india-data-list">
									{ch.planets.filter((r)=>r.differs).length ? ch.planets.filter((r)=>r.differs).map((r)=>(
										<div className="horosa-india-data-row" key={r.planet}>
											<strong>{PCN[r.planet] || r.planet}</strong>
											<span>{r.cells.map((c)=>(
												<span key={c.variant} style={c.variant === (ch.selected || 'standard') ? { color: 'var(--horosa-astro-gold, #b8860b)', fontWeight: 600 } : undefined}>
													{c.signLabel}{c === r.cells[r.cells.length - 1] ? '' : ' → '}
												</span>
											))}</span>
										</div>
									)) : (
										<div className="horosa-india-card-note">本盘各曜在此分盘各流派落座一致（无差异）。</div>
									)}
								</div>
							</div>
						))}
						<div className="horosa-india-card-note">{vargaVar.note || '仅列差异曜；标准 Parāśara 为默认，未列变体为文档未全列者（不臆造）。'}</div>
					</div>
				) : null}
				{nadi && nadi.d150 && nadi.d150.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Nāḍī · D150 纳地盘（各曜 nāḍiāṃśa · 150/座 · 每格 0°12′）</div>
						<div className="horosa-india-data-list">
							{nadi.d150.map((x)=>(
								<div className="horosa-india-data-row" key={x.planet}>
									<strong>{PCN[x.planet] || x.planet}</strong>
									<span>第 {x.nadiamsa} / 150 · {x.signLabel}</span>
								</div>
							))}
						</div>
						<div className="horosa-india-card-note">{nadi.d150Note || '150 专名待录入原典表，暂显号位。'}</div>
					</div>
				) : null}
			</div>
		);
	},

	// WP-B 全量重参照:返回把「某星座的宫号」按第1宫参照重数的函数(默认上升→后端原房号,零回归)。
	// 三盘 + 星曜面板 + 宫子表 + Bhava Bala 等所有「宫位」显示统一走它,确保中间盘与右栏一致。
	makeIndiaDispHouse(chartObj){
		const lagnaRef = AstroConst.normalizeIndiaLagnaRef(this.state.indiaLagnaRef);
		const refSignNum = resolveLagnaRefSignNumber(chartObj, lagnaRef);
		return (signName, fallbackHouse)=>{
			if(lagnaRef === 'asc'){ return fallbackHouse; }
			const idx = AstroConst.LIST_SIGNS.indexOf(signName);
			if(idx < 0){ return fallbackHouse; }
			return ((idx + 1 - refSignNum + 12) % 12) + 1;
		};
	},

	// 快捷栏契约:原 9 键全部与页面既有控件重复(分盘 tab=分盘目录、北/南/东印=盘面头部
	// XQSegmented、大运/Yoga=右栏 tab、并列 2×2=盘面头部开关),按「页面已有的不进栏」
	// 公理整条撤除;命例保存页头已有,故只留 AI。
	renderQuickDock(){
		return (
			<QuickDockBar
				page="india"
				className="horosa-india-quick-dock"
				hasResult={!!this.props.value}
				dispatch={this.props.dispatch}
			/>
		);
	},
};
