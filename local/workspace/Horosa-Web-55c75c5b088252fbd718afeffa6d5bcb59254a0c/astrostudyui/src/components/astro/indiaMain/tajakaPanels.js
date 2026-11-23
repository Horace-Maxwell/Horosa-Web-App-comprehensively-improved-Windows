// 印占页 · 年运(Tajaka)、友敌、化解、行运(Gochara)、Jaimini、副星(Upagraha)与敏感点
// 从 IndiaChartMain.js 按职责拆出的 IndiaChartMain 方法:this 仍是 IndiaChartMain 实例,门面里 mixinMethods(IndiaChartMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { trimDecimals } from '../../../utils/displayPrecision';
import moment from 'moment';
import { fieldsToParams, indiaTransitEventParams } from '../IndiaChart';
import IndiaTransitEvents from './IndiaTransitEvents';
import * as AstroConst from '../../../constants/AstroConst';
import { XQSegmented as Segmented, XQDatePicker as DatePicker, XQInputNumber as InputNumber } from '../../xq-ui';
import { indiaSnapshotScope } from './optionState';
import { getJyotish, formatDegree, resolveJyotishChartObj, tajikaYearLordViaLabel, gocharaVedhaBlocker } from './jyotishData';

export const tajakaPanelMethods = {
	renderTajakaPanel(fields){
		const SIGN_CN = { Aries: '白羊', Taurus: '金牛', Gemini: '双子', Cancer: '巨蟹', Leo: '狮子', Virgo: '处女', Libra: '天秤', Scorpio: '天蝎', Sagittarius: '射手', Capricorn: '摩羯', Aquarius: '水瓶', Pisces: '双鱼' };
		const PLANET_CN = { Sun: '太阳', Moon: '月亮', Mars: '火星', Mercury: '水星', Jupiter: '木星', Venus: '金星', Saturn: '土星', Rahu: '罗睺', Ketu: '计都' };
		const sc = (s)=>SIGN_CN[s] || s || '—';
		const pc = (p)=>PLANET_CN[p] || p || '—';
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const tj = jyotish ? jyotish.tajaka : null;
		const curY = new Date().getFullYear();
		// 当前已算年(loading 时退回用户选定年/当年)。输入卡始终渲染——若随 loading 消失,换年时输入框瞬间不在 → 连点/再输丢失。
		const activeYear = tj ? tj.tajakaYear : (this.state.indiaTajakaYearValue || curY);
		const yearInputVal = (this.state.tajakaYearInput === '' || this.state.tajakaYearInput == null) ? String(activeYear) : this.state.tajakaYearInput;
		const annualTypeCard = (
			<div className="horosa-info-card horosa-india-annual-card">
				<div className="horosa-info-card-title">年盘口径</div>
				<Segmented
					value={this.state.indiaAnnualChartType}
					onChange={this.changeAnnualChartType}
					options={AstroConst.INDIA_ANNUAL_CHART_TYPE_OPTIONS}
				/>
				{this.state.indiaAnnualChartType === 'tithi' && tj && tj.praveshMoment ? (
					<div className="horosa-india-card-note">年首 {tj.praveshMoment}{tj.annualTypeNote ? ` · ${tj.annualTypeNote}` : ''}</div>
				) : null}

			</div>
		);
		const yearCard = (
			<div className="horosa-info-card">
				<div className="horosa-info-card-title">年度盘年份（太阳回归 · 输入年份后点「计算」）</div>
				<div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
					<InputNumber
						ref={(el)=>{ this._tajakaYearInputEl = el; }}
						value={yearInputVal === '' || yearInputVal === null || yearInputVal === undefined ? null : Number(yearInputVal)}
						min={1}
						max={4999}
						precision={0}
						placeholder={String(curY)}
						onChange={(v)=>this.setState({ tajakaYearInput: v === null || v === undefined ? '' : String(v) })}
						onPressEnter={()=>this.applyTajakaYear()}
						style={{ width: 112 }}
					/>
					<button type="button" className="horosa-india-dasha-syssel-tab is-active" onClick={()=>this.applyTajakaYear()}>计算</button>
					<button type="button" className="horosa-india-dasha-syssel-tab" onClick={()=>{ this.setState({ tajakaYearInput: '' }); this.changeIndiaTajakaYear(curY); }}>当年</button>
				</div>
			</div>
		);
		if(!tj || !tj.available){
			return (
				<div className="horosa-india-jyotish-panel">
					{annualTypeCard}
				{yearCard}
					<div className="horosa-india-dasha-empty">年度盘计算中…</div>
				</div>
			);
		}
		const muntha = tj.muntha || {};
		const yearLord = tj.yearLord || {};
		const sahams = tj.sahams && typeof tj.sahams === 'object' ? Object.keys(tj.sahams).map((k)=>({ key: k, ...tj.sahams[k] })) : [];
		const yg = tj.yogas || {};
		const yogaPos = yg.position || {};
		const yogaPairs = Array.isArray(yg.pairwise) ? yg.pairwise.filter((p)=>p.aspect && (p.withinOrb || p.applying)) : [];
		const yogaHigher = yg.higher || {};                       // P1 高阶:Nakta/Yamaya/Kamboola
		const yogaCatalog = Array.isArray(yg.catalog) ? yg.catalog : [];
		const ITH_TYPE_CN = { poorna: '满趋(Poorna)', vartamana: '当前趋(Vartamana)', bhavishya: '将来趋(Bhavishya)', eesarpha: '背离(Eesarpha)' };
		return (
			<div className="horosa-india-jyotish-panel">
				{annualTypeCard}
				{yearCard}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">年度盘 {tj.annualType === 'tithi' ? 'Tithi Praveśa(阴历返照)' : 'Varshaphal'} · {tj.tajakaYear}</div>
					<div className="horosa-info-row"><span>年度上升</span><strong>{sc(tj.annualLagnaSign)}</strong></div>
					<div className="horosa-info-row"><span>满岁</span><strong>{tj.ageCompleted}</strong></div>
					<div className="horosa-info-row"><span>昼/夜生</span><strong>{tj.dayBirth ? '昼生' : '夜生'}</strong></div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Muntha</div>
					<div className="horosa-info-row"><span>所在</span><strong>{sc(muntha.sign)}（主 {pc(muntha.lord)}）</strong></div>
					<div className="horosa-info-row"><span>距本命命宫</span><strong>第 {muntha.houseFromNatalLagna || '—'} 宫</strong></div>
					<div className="horosa-info-row"><span>年盘宫位</span><strong>第 {muntha.houseInAnnual || '—'} 宫</strong></div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">年主 Year Lord</div>
					<div className="horosa-info-row"><span>年主</span><strong>{pc(yearLord.planet)}</strong></div>
					<div className="horosa-info-row"><span>取用</span><strong>{tajikaYearLordViaLabel(yearLord.via) || '—'}</strong></div>
					<div className="horosa-info-row"><span>五分力</span><strong>{yearLord.panchaBala != null ? Number(yearLord.panchaBala).toFixed(2) : '—'}</strong></div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">年度合相 Tajaka Yogas</div>
					<div className="horosa-india-data-list">
						<div className="horosa-india-data-row"><strong>Ishkavala</strong><span>财福格</span><em>{yogaPos.ishkavala ? '成立' : '未成立'}</em></div>
						<div className="horosa-india-data-row"><strong>Induvara</strong><span>失意格</span><em>{yogaPos.induvara ? '成立' : '未成立'}</em></div>
						{yogaPairs.map((p, i)=>(
							<div className="horosa-india-data-row" key={`pw${i}`}>
								<strong>{pc(p.a)}–{pc(p.b)}</strong>
								<span>{p.aspect}{p.withinOrb ? ' · 入相位' : ''}</span>
								<em className={p.applying ? 'is-good' : 'is-warn'}>{p.nature || ''}{p.type ? ' · ' + (ITH_TYPE_CN[p.type] || p.type) : (p.applying ? ' · Ithasala' : ' · Eesarpha')}</em>
							</div>
						))}
						{!yogaPairs.length ? (<div className="horosa-india-data-row"><strong>逐对相位</strong><span>本年无入相/出相年度合相</span><em>—</em></div>) : null}
						{(yogaHigher.nakta || []).map((y, i)=>(<div className="horosa-india-data-row" key={`nk${i}`}><strong>Nakta 传光</strong><span>{pc(y.a)}–{pc(y.b)}</span><em className="is-good">经 {pc(y.via)} 速曜居间助成</em></div>))}
						{(yogaHigher.yamaya || []).map((y, i)=>(<div className="horosa-india-data-row" key={`ym${i}`}><strong>Yamaya 集光</strong><span>{pc(y.a)}–{pc(y.b)}</span><em className="is-good">经 {pc(y.via)} 慢曜居间助成</em></div>))}
						{(yogaHigher.kamboola || []).map((y, i)=>(<div className="horosa-india-data-row" key={`kb${i}`}><strong>Kamboola 月助</strong><span>{Array.isArray(y.pair) ? y.pair.map(pc).join('–') : ''}</span><em className="is-good">月与 {pc(y.moonWith)} 成 Ithasala 增力</em></div>))}
					</div>
				</div>
				{yogaCatalog.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Tajika 16 瑜伽名录（参考 · 判定细则见各格）</div>
						<div className="horosa-india-data-list">
							{yogaCatalog.map((y)=>(
								<div className="horosa-india-data-row" key={`cat${y.key}`}>
									<strong>{y.key}</strong>
									<span>{y.label}</span>
									<em>{y.note}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Sahams 敏感点（36）</div>
					<div className="horosa-india-data-list">
						{sahams.map((s)=>(
							<div className="horosa-india-data-row" key={s.key}>
								<strong>{s.label || s.key}</strong>
								<span>{sc(s.sign)}</span>
								<em>{s.signLon != null ? formatDegree(s.signLon) : ''}</em>
							</div>
						))}
					</div>
				</div>
				{tj && tj.harshaBala && Object.keys(tj.harshaBala).length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Harsha Bala（年盘喜悦力 · 满 20）</div>
						<div className="horosa-india-data-list">
							{Object.keys(tj.harshaBala).map((p)=>(
								<div className="horosa-india-data-row" key={`hb_${p}`}>
									<strong>{pc(p)}</strong>
									<span>{Number(tj.harshaBala[p].total).toFixed(1)} 分</span>
									<em>{(tj.harshaBala[p].sources || []).map((s)=>Number(s).toFixed(0)).join(' / ')}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				{tj && tj.panchaVargeeyaBala && Object.keys(tj.panchaVargeeyaBala).length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Pancha-Vargeeya Bala（五分量力）</div>
						<div className="horosa-india-data-list">
							{Object.keys(tj.panchaVargeeyaBala).map((p)=>{
								const b = tj.panchaVargeeyaBala[p] || {};
								const n = (x)=>(x != null ? Number(x).toFixed(1) : '—');
								return (
									<div className="horosa-india-data-row" key={`pv_${p}`}>
										<strong>{pc(p)}</strong>
										<span>{b.total != null ? Number(b.total).toFixed(2) : '—'}</span>
										<em>界{n(b.hadda)} 旺{n(b.uchcha)} 宫{n(b.kshetra)} 旬{n(b.drekkana)} 九{n(b.navamsa)}</em>
									</div>
								);
							})}
						</div>
					</div>
				) : null}
				{tj && tj.dasas && tj.dasas.mudda && tj.dasas.mudda.available && Array.isArray(tj.dasas.mudda.sequence) ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Mudda 年内大运（首主 {pc(tj.dasas.mudda.firstLord)}）</div>
						<div className="horosa-india-data-list">
							{tj.dasas.mudda.sequence.map((m, i)=>(
								<div className="horosa-india-data-row" key={`md_${i}`}>
									<strong>{pc(m.key)}</strong>
									<span>{Number(m.days).toFixed(1)} 天</span>
									<em>{m.balance != null ? `余 ${Number(m.balance).toFixed(1)}` : ''}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				{tj && tj.dasas && tj.dasas.annualYogini && tj.dasas.annualYogini.available && Array.isArray(tj.dasas.annualYogini.sequence) ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">年 Yoginī 大运（起 {tj.dasas.annualYogini.startYogini} · 年基 {Number(tj.dasas.annualYogini.yearBasisDays) % 1 === 0 ? Number(tj.dasas.annualYogini.yearBasisDays).toFixed(0) : tj.dasas.annualYogini.yearBasisDays} 日）</div>
						<div className="horosa-india-data-list">
							{tj.dasas.annualYogini.sequence.map((m, i)=>(
								<div className="horosa-india-data-row" key={`ay_${i}`}>
									<strong>{m.yogini}（{m.lordCN}）</strong>
									<span>{Number(m.days).toFixed(1)} 天</span>
									<em>{m.balance != null ? `余 ${Number(m.balance).toFixed(1)}` : ''}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				{tj && tj.dasas && tj.dasas.patyayini && Array.isArray(tj.dasas.patyayini.order) ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Patyāyinī 年内大运（共 {tj.dasas.patyayini.totalDays != null ? trimDecimals(tj.dasas.patyayini.totalDays) : '—'} 天）</div>
						<div className="horosa-india-data-list">
							{tj.dasas.patyayini.order.map((m, i)=>(
								<div className="horosa-india-data-row" key={`pt_${i}`}>
									<strong>{m.ref === 'lagna' ? '年命' : pc(m.ref)}</strong>
									<span>{Number(m.days).toFixed(1)} 天</span>
									<em>Paty {m.patyamsa != null ? Number(m.patyamsa).toFixed(1) : '—'}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				{this.renderJudgmentNotes('11')}
				{(()=>{
					const jyx = (resolveJyotishChartObj(this.state, fields) || {}).jyotish || {};
					const tri2 = ((jyx.tajaka || {}).tripatakiNak) || null;
					if(!tri2 || !tri2.available){ return null; }
					const PCN2 = { Sun: '日', Moon: '月', Mars: '火', Mercury: '水', Jupiter: '木', Venus: '金', Saturn: '土', 'North Node': '罗', 'South Node': '计' };
					const FL = { 1: '内旗(1-9)', 2: '中旗(10-18)', 3: '外旗(19-27)' };
					return (
						<div className="horosa-info-card">
							<div className="horosa-info-card-title">Tripataki 宿距三旗（年盘月宿 {tri2.baseNakIndex}. {tri2.baseNak} 为基准）</div>
							<div className="horosa-india-maitri-wrap">
								<table className="horosa-india-maitri-table horosa-india-shad-table">
									<thead><tr><th>曜</th><th>所在宿</th><th>宿距</th><th>旗</th><th>Tārā</th><th>断</th></tr></thead>
									<tbody>
										{tri2.rows.map((r)=>(
											<tr key={r.planet}>
												<td>{PCN2[r.planet] || r.planet}</td>
												<td>{r.transitNakIndex}. {r.transitNak}</td>
												<td>{r.distance}</td>
												<td>{FL[r.flag]}</td>
												<td>{r.taraLabel}</td>
												<td>{r.good ? <span className="horosa-india-flag-badge is-good">{r.verdict}</span> : (r.verdict === '凶' ? <span className="horosa-india-flag-badge is-warn">{r.verdict}</span> : r.verdict)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<div className="horosa-india-card-note"><span className="horosa-india-source-tag">规则随书·可计算版</span>{tri2.note}</div>
						</div>
					);
				})()}
			</div>
		);
	},

	renderMaitriPanel(fields){
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const gm = jyotish ? jyotish.grahaMaitri : null;
		if(!gm){ return <div className="horosa-india-dasha-empty">敌友计算中...</div>; }
		if(gm.available === false){ return <div className="horosa-india-dasha-empty">暂无敌友数据</div>; }
		const COMP_CLASS = { '大友': 'is-adhimitra', '友': 'is-mitra', '中立': 'is-sama', '敌': 'is-satru', '大敌': 'is-adhisatru' };
		const labels = gm.planetLabels || [];
		const matrix = gm.matrix || [];
		const rasi = gm.rasiDrishti || [];
		return (
			<div className="horosa-india-jyotish-panel">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">敌友 复合五分（Pañcadhā Maitrī · 行=本星 / 列=对方 · 非对称{gm.basis === 'd1' ? ' · 临时友敌恒按 D1' : ''}）</div>
					<div className="horosa-india-maitri-wrap">
						<table className="horosa-india-maitri-table">
							<thead>
								<tr><th aria-label="本星\\对方"></th>{labels.map((l, i)=>(<th key={i}>{l}</th>))}</tr>
							</thead>
							<tbody>
								{matrix.map((row, ri)=>(
									<tr key={ri}>
										<th>{row.planetLabel}</th>
										{row.cells.map((c, ci)=>(
											c.self
												? <td key={ci} className="horosa-india-maitri-cell is-self">—</td>
												: <td key={ci} className={`horosa-india-maitri-cell ${COMP_CLASS[c.compoundCn] || ''}`} title={`自然 ${c.naturalCn} · 临时 ${c.temporalCn} · 复合 ${c.compoundCn}`}>{c.compoundCn}</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div className="horosa-india-maitri-legend">
						{(gm.legend || []).map((lg)=>(<span key={lg.key} className={`horosa-india-maitri-chip ${COMP_CLASS[lg.label] || ''}`}>{lg.label}</span>))}
					</div>
					<div className="horosa-india-maitri-note">悬停格子见 自然·临时·复合 三层；本星看对方 ≠ 对方看本星（古法五重友敌 Pañcadhā-maitri）。</div>
				</div>
				{rasi.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Jaimini 座相 Rāśi Dṛṣṭi（座 → 所照见座）</div>
						<div className="horosa-india-data-list">
							{rasi.map((r)=>(
								<div className="horosa-india-data-row" key={r.sign}>
									<strong>{r.signLabel || r.sign}</strong>
									<span>{(r.aspects || []).length} 座</span>
									<em>{(r.aspectLabels || r.aspects || []).join('、') || '—'}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">星座相位矩阵（Jaimini Rāśi Dṛṣṭi · 行=看方 列=被看 · 每行恰 3 座）</div>
					{(()=>{
						const SS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
						const MOV = [0, 3, 6, 9], FIX = [1, 4, 7, 10];
						const aspectsOf = (i)=>{
							if(MOV.indexOf(i) >= 0){ return FIX.filter((f)=>f !== (i + 1) % 12); }
							if(FIX.indexOf(i) >= 0){ return MOV.filter((mv)=>mv !== (i + 11) % 12); }
							return [2, 5, 8, 11].filter((d)=>d !== i);
						};
						return (
							<div className="horosa-india-bav-matrix is-sign-rows">
								<div className="horosa-india-bav-row horosa-india-bav-head">
									<span className="horosa-india-bav-rowlabel" />
									{SS.map((x, i)=>(<span className="horosa-india-bav-cell is-head" key={`rh${i}`}>{x[0]}</span>))}
								</div>
								{SS.map((rowName, i)=>{
									const hits = aspectsOf(i);
									return (
										<div className="horosa-india-bav-row" key={`rr${i}`}>
											<span className="horosa-india-bav-rowlabel">{rowName}</span>
											{SS.map((_, j)=>(
												<span className="horosa-india-bav-cell" style={{ '--bav': hits.indexOf(j) >= 0 ? 1 : 0 }} key={`rc${i}_${j}`}>
													{hits.indexOf(j) >= 0 ? '●' : ''}
												</span>
											))}
										</div>
									);
								})}
							</div>
						);
					})()}
					<div className="horosa-india-card-note">动象看所有固象（除紧邻下一座）；固象看所有动象（除紧邻前一座）；双象互看其余双象。星座几何固定,与本盘无关。</div>
				</div>
			</div>
		);
	},

	renderRemediesPanel(fields){
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const rem = jyotish ? jyotish.remedies : null;
		if(!rem || !Array.isArray(rem.table)){
			return <div className="horosa-india-dasha-empty">暂无化解数据</div>;
		}
		const recs = Array.isArray(rem.recommendations) ? rem.recommendations : [];
		return (
			<div className="horosa-india-jyotish-panel">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">宝石建议（按需增力弱曜）<span className="horosa-india-source-tag">仅信息·非处方</span></div>
					{recs.length ? (
						<div className="horosa-india-data-list">
							{recs.map((r, i)=>(
								<div className="horosa-india-data-row" key={r.planet || i}>
									<strong>{r.planetCn || r.planet}</strong>
									<span>{r.gem}{r.metal ? ` · ${r.metal}` : ''}{r.finger ? ` · ${r.finger}` : ''}</span>
									<em>{r.caution ? '⚠ 功能凶星·慎用' : (r.recommend ? '可增力' : '—')}</em>
								</div>
							))}
						</div>
					) : (<div className="horosa-india-dasha-empty">本盘无明显需增力弱曜（落陷/燃烧）</div>)}
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">九曜化解全表（宝石/金属/指/真言/守护神/善行/谷物）<span className="horosa-india-source-tag">仅信息·非处方</span></div>
					<div className="horosa-india-data-list">
						{rem.table.map((g)=>(
							<div className="horosa-india-data-row horosa-india-remedy-row" key={g.planet}>
								<strong>{g.planetCn || g.planet}</strong>
								<span>{g.gem}（{g.gemEn}）{g.finger ? ` · ${g.finger}` : ''}</span>
								<em>
									{g.metal || ''}{g.day ? ` · ${g.day}` : ''}{g.mantraCount ? ` · 诵${g.mantraCount}` : ''}
									{Array.isArray(g.deity) && g.deity.length ? ` · 守护 ${g.deity.join('/')}` : ''}
									{g.grain ? ` · 谷 ${g.grain}` : ''}
									{g.goodDeed ? ` · 善行：${g.goodDeed}` : ''}
								</em>
							</div>
						))}
					</div>
				</div>
			</div>
		);
	},

	// 穿界表只用时区和岁差;时刻由起始日决定,不随本命盘的生时变
	transitEventParams(fields){
		return indiaTransitEventParams(fieldsToParams(fields));
	},

	renderGocharaPanel(fields){
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const g = jyotish ? jyotish.gochara : null;
		if(!g || !g.available){
			return <div className="horosa-india-dasha-empty">暂无行运数据</div>;
		}
		const sa = g.saturnAfflictions || {};
		const ss = sa.sadeSati || {};
		const fromMoon = Array.isArray(g.fromMoon) ? g.fromMoon : [];
		const transitMoment = this.state.indiaTransitDateValue
			? moment(this.state.indiaTransitDateValue, 'YYYY/MM/DD')
			: (g.transitDate ? moment(g.transitDate, 'YYYY/MM/DD') : moment());
		return (
			<div className="horosa-india-jyotish-panel">
				<div className="horosa-info-card horosa-india-transit-card">
					<div className="horosa-india-transit-row">
						<span className="horosa-india-transit-label">过运日期</span>
						<DatePicker
							value={transitMoment}
							onChange={(d)=>this.changeTransitDate(d)}
							format="YYYY-MM-DD"
							allowClear={false}
							inputReadOnly
							size="small"
							className="horosa-india-transit-datepicker"
						/>
						{this.state.indiaTransitDateValue
							? <button type="button" className="horosa-india-transit-reset" onClick={()=>this.changeTransitDate(null)}>回今日</button>
							: <em className="horosa-india-transit-hint">默认今日</em>}
					</div>
					<div className="horosa-india-card-note">选日期即按该日重排过运盘（Sade Sati / 逐曜过运随之更新）。</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Sade Sati / Kantaka / Ashtama</div>
					<div className="horosa-info-row"><span>土星过运</span><strong>{sa.saturnSignLabel || '—'}（从月第 {sa.saturnHouseFromMoon || '—'} 宫）</strong></div>
					<div className="horosa-info-row"><span>Sade Sati</span><strong>{ss.active ? `进行中 · ${ss.phaseLabel || ss.phase || ''}` : '无'}</strong></div>
					<div className="horosa-info-row"><span>Kantaka</span><strong>{(sa.kantaka || {}).active ? '是' : '否'}（Ardhashtama）</strong></div>
					<div className="horosa-info-row"><span>Ashtama</span><strong>{(sa.ashtamaSani || {}).active ? '是' : '否'}（土星过月 8 宫）</strong></div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">逐曜过运（从月）{g.transitDate ? ` · ${g.transitDate}` : ''}</div>
					<div className="horosa-india-data-list">
						{fromMoon.map((it, i)=>(
							<div className="horosa-india-data-row" key={`${it.planet || i}`}>
								<strong>{it.planetLabel || it.label || it.planet}</strong>
								<span>从月第 {it.house} 宫{it.signLabel ? ` · ${it.signLabel}` : ''}</span>
								<em>{(it.good || it.auspicious) ? '吉位' : '凶位'}{gocharaVedhaBlocker(it) ? ` · 被${gocharaVedhaBlocker(it)}遮 Vedha` : ''}
									{/* WP-E4 行运×八分点(§12.4):过运座 SAV≥30 顺/≤25 受阻,BAV 该曜自身贡献 */}
									{it.av && it.av.savBindu !== undefined && it.av.savBindu !== null ? <span className={`horosa-india-flag-badge ${it.av.sav === 'good' ? 'is-good' : (it.av.sav === 'bad' ? 'is-warn' : '')}`}>SAV {it.av.savBindu}</span> : null}
									{it.av && it.av.bavBindu !== undefined && it.av.bavBindu !== null ? <span className="horosa-india-flag-badge">BAV {it.av.bavBindu}</span> : null}
								</em>
							</div>
						))}
					</div>
				</div>
				{Array.isArray(g.fromLagna) && g.fromLagna.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">逐曜过运（从命）</div>
						<div className="horosa-india-data-list">
							{g.fromLagna.map((it, i)=>(
								<div className="horosa-india-data-row" key={`fl_${it.planet || i}`}>
									<strong>{it.planetLabel || it.label || it.planet}</strong>
									<span>从命第 {it.house} 宫{it.signLabel ? ` · ${it.signLabel}` : ''}</span>
									<em>{(it.good || it.auspicious) ? '吉位' : '凶位'}{gocharaVedhaBlocker(it) ? ` · 被${gocharaVedhaBlocker(it)}遮 Vedha` : ''}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				{Array.isArray(g.fromSun) && g.fromSun.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">逐曜过运（从日 · 第三基准）</div>
						<div className="horosa-india-data-list">
							{g.fromSun.map((it, i)=>(
								<div className="horosa-india-data-row" key={`fs_${it.planet || i}`}>
									<strong>{it.planetLabel || it.label || it.planet}</strong>
									<span>从日第 {it.house} 宫{it.signLabel ? ` · ${it.signLabel}` : ''}</span>
									<em>{(it.good || it.auspicious) ? '吉位' : '凶位'}{gocharaVedhaBlocker(it) ? ` · 被${gocharaVedhaBlocker(it)}遮 Vedha` : ''}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				{g.dashaLink && g.dashaLink.mahaLord ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">过运 × 大运联动 · {g.dashaLink.systemLabel || 'Vimshottari'}（过运日所在运主激活性）</div>
						<div className="horosa-info-row"><span>过运日{g.dashaLink.atDate ? `（${g.dashaLink.atDate}）` : ''}大运主</span><strong>{(g.dashaLink.mahaLord || {}).label || (g.dashaLink.mahaLord || {}).key || '—'}
							{g.dashaLink.transitFromMoon ? `（从月第 ${g.dashaLink.transitFromMoon.house} 宫 · ${(g.dashaLink.transitFromMoon.good || g.dashaLink.transitFromMoon.auspicious) ? '吉位' : '凶位'}${gocharaVedhaBlocker(g.dashaLink.transitFromMoon) ? ` · 被${gocharaVedhaBlocker(g.dashaLink.transitFromMoon)}遮 Vedha` : ''}）` : ''}</strong></div>
						{g.dashaLink.antarLord ? (
							<div className="horosa-info-row"><span>过运日中运主</span><strong>{(g.dashaLink.antarLord || {}).label || '—'}
								{g.dashaLink.antarTransitFromMoon ? `（从月第 ${g.dashaLink.antarTransitFromMoon.house} 宫 · ${(g.dashaLink.antarTransitFromMoon.good || g.dashaLink.antarTransitFromMoon.auspicious) ? '吉位' : '凶位'}）` : ''}</strong></div>
						) : null}
						<div className="horosa-india-card-note">联动恒按 {g.dashaLink.systemLabel || 'Vimshottari'} 体系取运主(与大运标签所选体系无关)。大运主被过运激活(吉位无遮)时其象义更易兑现;合参标记,仅信息。</div>
					</div>
				) : null}
				<IndiaTransitEvents params={this.transitEventParams(fields)} start={transitMoment.format('YYYY/MM/DD')} memo={this.transitEventsMemo} snapshotScope={indiaSnapshotScope(this.props.techniqueScope)} />
			</div>
		);
	},

	renderJaiminiPanel(fields){
		const SIGN_CN = { Aries: '白羊', Taurus: '金牛', Gemini: '双子', Cancer: '巨蟹', Leo: '狮子', Virgo: '处女', Libra: '天秤', Scorpio: '天蝎', Sagittarius: '射手', Capricorn: '摩羯', Aquarius: '水瓶', Pisces: '双鱼' };
		const sc = (s)=>SIGN_CN[s] || s || '—';
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const ar = jyotish ? jyotish.arudha : null;
		// 座位大运(rasi dasha)已移至「大运」tab(renderRasiDashaCards);映象 tab 只留 Arudha/Argala 等 Jaimini 盘点。
		if(!ar || !ar.available){
			return <div className="horosa-india-dasha-empty">暂无 Jaimini 数据</div>;
		}
		return (
			<div className="horosa-india-jyotish-panel">
				{ar && ar.available ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Arudha 映象（AL / UL）</div>
						<div className="horosa-info-row"><span>AL</span><strong>{sc(ar.arudhaLagna)}</strong></div>
						<div className="horosa-info-row"><span>UL</span><strong>{sc(ar.upapadaLagna)}</strong></div>
					</div>
				) : null}
				{ar && ar.available && Array.isArray(ar.houseArudhas) ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">12 宫 Arudha Pada</div>
						<div className="horosa-india-data-list">
							{ar.houseArudhas.map((it)=>(
								<div className="horosa-india-data-row" key={it.label}>
									<strong>{it.label}</strong>
									<span>{sc(it.sign)}</span>
									<em>第 {it.signIndex} 宫</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				{ar && ar.available && ar.argala && Object.keys(ar.argala).length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">12 宫 Argala（干涉 / 反制）</div>
						<div className="horosa-india-data-list">
							{Object.keys(ar.argala).sort((a, b)=>(Number(a) - Number(b))).map((h)=>{
								const g = ar.argala[h] || {};
								const netCn = g.netStronger === 'argala' ? '干涉占优' : (g.netStronger === 'virodha' ? '反制占优' : '势均');
								const argSigns = Array.isArray(g.argala) ? g.argala.filter((r)=>r.count > 0).map((r)=>`${sc(r.sign)}${r.papa && r.papa.length ? '凶' : (r.subha && r.subha.length ? '吉' : '')}`).join('·') : '';
								return (
									<div className="horosa-india-data-row" key={`arg_${h}`}>
										<strong>第 {h} 宫</strong>
										<span className={g.netStronger === 'argala' ? 'is-strong' : (g.netStronger === 'virodha' ? 'is-weak' : '')}>{netCn}</span>
										<em>干涉 {g.argalaCount || 0} / 反制 {g.virodhaCount || 0}{argSigns ? ` · ${argSigns}` : ''}</em>
									</div>
								);
							})}
						</div>
					</div>
				) : null}
				{this.renderJudgmentNotes('9')}
				{(()=>{
					const jyx = (resolveJyotishChartObj(this.state, fields) || {}).jyotish || {};
					const ay = (jyx.jaimini || {}).ayurTriPair;
					if(!ay || !ay.available){ return null; }
					const QCN = { movable: '动', fixed: '固', dual: '双' };
					return (
						<div className="horosa-info-card">
							<div className="horosa-info-card-title">Jaimini 寿命三对法（Āyur · 档位参考）</div>
							<div className="horosa-india-data-list">
								{ay.pairs.map((pr)=>(
									<div className="horosa-india-data-row" key={pr.name}>
										<strong>{pr.name}</strong>
										<span>{pr.aSignLabel}({QCN[pr.aQuality]}) × {pr.bSignLabel}({QCN[pr.bQuality]})</span>
										<em>{pr.verdictLabel}</em>
									</div>
								))}
							</div>
							<div className="horosa-info-row"><span>三票多数</span><strong>{ay.bandLabel}</strong></div>
							<div className="horosa-india-card-note"><span className="horosa-india-source-tag">三对法·古籍通行版本</span>{ay.note}</div>
						</div>
					);
				})()}
			</div>
		);
	},

	renderUpagrahaPanel(fields){
		const SIGN_SHORT = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
		const fmtLon = (lon)=>{
			const v = (((lon || 0) % 360) + 360) % 360;
			return `${SIGN_SHORT[Math.floor(v / 30)]} ${formatDegree(v % 30)}`;
		};
		const jyotish = getJyotish(resolveJyotishChartObj(this.state, fields));
		const up = jyotish ? jyotish.upagraha : null;
		if(!up || !up.available){
			return <div className="horosa-india-dasha-empty">暂无副星数据</div>;
		}
		const sl = up.specialLagnas;
		const supLagnas = jyotish && jyotish.supplementaryLagnas && jyotish.supplementaryLagnas.available ? jyotish.supplementaryLagnas : null;
		const nadi = jyotish && jyotish.nadi && jyotish.nadi.available ? jyotish.nadi : null;   // P2 Nāḍī Bhrigu Bindu
		const outer = jyotish && jyotish.outerPlanets && jyotish.outerPlanets.available ? jyotish.outerPlanets.planets : [];
		return (
			<div className="horosa-india-jyotish-panel">
				{outer.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">外行星 Ur/Ne/Pl（虚星 · 信息性,不入九曜强弱）</div>
						<div className="horosa-india-data-list">
							{outer.map((o)=>(
								<div className="horosa-india-data-row" key={o.id}>
									<strong>{o.label}</strong>
									<span>{o.signLabel} {formatDegree(o.signlon)}{o.retrograde ? ' R' : ''} · 宫{o.house || '—'}</span>
									<em>{o.nakshatra ? `${o.nakshatra} P${o.pada}` : '—'}</em>
								</div>
							))}
						</div>
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">特殊上升 Special Lagnas</div>
					{sl ? (
						<>
						<div className="horosa-india-data-list">
							{['bhavaLagna', 'horaLagna', 'ghatikaLagna', 'sreeLagna'].map((k)=>{
								const item = sl[k];
								return item ? (
									<div className="horosa-india-data-row" key={k}>
										<strong>{item.key}</strong>
										<span>{item.label}</span>
										<em>{fmtLon(item.lon)}</em>
									</div>
								) : null;
							})}
						</div>
						{sl.pranapada ? (
							<div className="horosa-india-data-list" style={{ marginTop: 4 }}>
								<div className="horosa-india-data-subhead"><strong>Praṇapada PP（流派变体）</strong></div>
								<div className="horosa-india-data-row"><strong>PP</strong><span>日出太阳（BPHS）</span><em>{fmtLon(sl.pranapada.variantSunrise)}</em></div>
								{sl.pranapada.variantBirth !== undefined ? (
									<div className="horosa-india-data-row"><strong>PP</strong><span>出生太阳（现代变体）</span><em>{fmtLon(sl.pranapada.variantBirth)}</em></div>
								) : null}
								<div className="horosa-india-card-note">{sl.pranapada.note}</div>
							</div>
						) : null}
						</>
					) : (
						<div className="horosa-india-dasha-empty">{up.note || '日出不定，特殊上升降级'}</div>
					)}
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">日基副星 Sun-based Upagrahas</div>
					<div className="horosa-india-data-list">
						{(up.sunBased || []).map((item)=>(
							<div className="horosa-india-data-row" key={item.key}>
								<strong>{item.key}</strong>
								<span>{item.note}</span>
								<em>{fmtLon(item.lon)}</em>
							</div>
						))}
					</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">时基副星 Time-based Upagrahas（Gulika/Maandi 等）</div>
					{Array.isArray(up.timeBased) && up.timeBased.length > 0 ? (
						<div className="horosa-india-data-list">
							{up.timeBased.map((item)=>(
								<div className="horosa-india-data-row" key={item.key}>
									<strong>{item.key}</strong>
									<span>{item.note}</span>
									<em>{fmtLon(item.lon)}</em>
								</div>
							))}
						</div>
					) : (
						<div className="horosa-india-dasha-empty">日出不定（极地等），时基副星降级</div>
					)}
				</div>
				{supLagnas ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">补充上升 Supplementary Lagnas（Chandra/Paaka/Karakamsa/Indu/Varṇada）</div>
						<div className="horosa-india-data-list">
							{[supLagnas.chandraLagna, supLagnas.paakaLagna, supLagnas.karakamsa, supLagnas.swamsa, supLagnas.induLagna, supLagnas.varnadaLagna].filter((it)=>it && it.sign).map((it)=>(
								<div className="horosa-india-data-row" key={it.key}>
									<strong>{it.label}</strong>
									<span>{it.signLabel || it.sign}</span>
									<em>{it.key === 'induLagna' && it.sumKala ? `Kala和 ${it.sumKala} · 第${it.stepS}座` : (it.key === 'varnadaLagna' && it.step ? `A${it.countLagna}/B${it.countHora} · N${it.step}${it.altDiffers ? ` · V法:${it.altSignLabel || it.altSign}` : ''}` : it.sign)}</em>
								</div>
							))}
						</div>
						{Array.isArray(supLagnas.grahaLagnas) && supLagnas.grahaLagnas.length ? (
							<div className="horosa-india-data-list">
								{supLagnas.grahaLagnas.map((g)=>(
									<div className="horosa-india-data-row" key={`gl${g.planet}`}>
										<strong>{g.label || g.planet}</strong>
										<span>{g.signLabel || g.sign}</span>
										<em>Graha Lagna</em>
									</div>
								))}
							</div>
						) : null}
					</div>
				) : null}
				{nadi && nadi.bhriguBindu ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">Nāḍī · Bhrigu Bindu 福点（Rahu/Moon 短弧中点 · 业力焦点/应期）</div>
						<div className="horosa-info-row"><span>落座</span><strong>{nadi.bhriguBindu.signLabel} {formatDegree(nadi.bhriguBindu.signlon)}</strong></div>
						<div className="horosa-info-row"><span>月宿</span><strong>{nadi.bhriguBindu.nakshatra ? `${nadi.bhriguBindu.nakshatra.name}${nadi.bhriguBindu.nakshatra.pada ? ' P' + nadi.bhriguBindu.nakshatra.pada : ''}` : '—'}</strong></div>
						<div className="horosa-info-row"><span>黄经</span><strong>{formatDegree(nadi.bhriguBindu.lon)}</strong></div>
					</div>
				) : null}
				{this.renderSensitivePointsCard(jyotish, fields)}
			</div>
		);
	},

	// 敏感点 Sphuta 卡(生育点 + Gandanta/Sandhi 界位)。恒并列显示两点不隐藏;
	// 按盘 gender 高亮对应点(男→Beeja / 女→Kshetra)。无落界星体时界位块不渲染(零噪音)。
	renderSensitivePointsCard(jyotish, fields){
		const spx = (jyotish || {}).sensitivePoints;
		if(!spx || !spx.available){ return null; }
		const bk = spx.beejaKshetra || {};
		const gnd = (spx.gandanta || {}).hits || [];
		const gender = fields && fields.gender ? Number(fields.gender.value) : 1;
		const pointRow = (item, label, hot)=>{
			if(!item){ return null; }
			if(item.available === false){
				return (
					<div className="horosa-india-data-row" key={label}>
						<strong>{label}</strong><span className="horosa-india-card-note">缺源经度,不出值</span>
					</div>
				);
			}
			return (
				<div className={`horosa-india-data-row${hot ? ' horosa-india-sensitive-hot' : ''}`} key={label}>
					<strong>{label}</strong>
					<span>{(item.rasi || {}).signLabel} {formatDegree((item.lon || 0) % 30)}</span>
					<span>D9 {(item.navamsa || {}).signLabel}</span>
					<span className={item.verdict === 'favorable' ? 'horosa-india-emph' : ''}>{item.verdictLabel}</span>
				</div>
			);
		};
		return (
			<div className="horosa-info-card">
				<div className="horosa-info-card-title">敏感点 Sphuta（生育点 · 界位）</div>
				<div className="horosa-india-data-list">
					{/* 性别归一:0=女,其余(含 -1 未知·按男排)=男,与八字本地引擎同口径;此前 `=== 1` 把未知档当女命高亮 */}
					{pointRow(bk.beeja, 'Beeja(日+金+木)', gender !== 0)}
					{pointRow(bk.kshetra, 'Kshetra(月+火+木)', gender === 0)}
				</div>
				<div className="horosa-india-card-note">{bk.note}</div>
				{gnd.length ? (
					<>
						<div className="horosa-india-data-subhead"><strong>Gandanta / Sandhi 界位</strong></div>
						<div className="horosa-india-data-list">
							{gnd.map((h, i)=>(
								<div className="horosa-india-data-row" key={i}>
									<strong>{h.bodyLabel || h.body}</strong>
									{h.gandanta ? <span className="horosa-india-flag-badge is-warn">Gandanta {h.gandanta.junctionLabel}({h.gandanta.nakshatraPair})距界 {h.gandanta.arcminToBoundary}′</span> : null}
									{h.rasiSandhi ? <span className="horosa-india-flag-badge">Sandhi {h.rasiSandhi.position === 'sign_end' ? '座末' : '座初'} {h.rasiSandhi.arcminToBoundary}′</span> : null}
								</div>
							))}
						</div>
					</>
				) : null}
			</div>
		);
	},
};
