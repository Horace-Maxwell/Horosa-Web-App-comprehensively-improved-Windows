// 世运盘 · 右栏西方世俗卡:校正、天气、日月盘、恒星、地理、推运、分配、胜星、特殊轴、赤纬平行、断语、入宫 / 季节 / 年盘、朔望、日月食、地区、时代
// 从 MundaneMain.js 按职责拆出的 MundaneMain 方法:this 仍是 MundaneMain 实例,门面里 mixinMethods(MundaneMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { XQSelect, XQButton, XQInputNumber } from '../../xq-ui';
import { SIGNS } from '../../../divination/data/signs';
import { buildFacts } from '../../../divination/engine/chartFacts';
import { ingressGovernance } from '../../../divination/mundane/momentPipeline';
import { describeMundaneChart, describeEclipse, describeEclipseAfflictions, describeIngressSkeleton, describeMundaneVictor, describeMundaneWeather, describeMundaneSyzygy, buildMundaneStarPoints, mundaneFixedStarHits, mundaneConjunctionIndicator, describeSpecialAxes, MUNDANE_HOUSE_MEANINGS, PLANET_CN as MUN_PLANET_CN } from '../../../divination/mundane/describe';
import { OMEN_COMBOS, computeAngularity, isDormantChart, rulerDeathSignature, describeSolunar } from '../../../divination/mundane/solunar';
import { rulesetConfig } from '../../../divination/mundane/ruleset';
import { describeChorography, CHOROGRAPHY_DISCLAIMER } from '../../../divination/mundane/chorography';
import { mundaneProfection, mundaneFirdaria } from '../../../divination/mundane/progressions';
import { mundaneDistribution, mundanePatternMeaning } from '../../../divination/mundane/patterns';
import { MUNDANE_CAPITALS } from '../../../divination/data/regionCharts';
import { fmtDegree, chartRequestKey } from '../../astro/AstroExtraCommon';
import { pressable } from '../../../utils/pressable';
import { INGRESSES, SIGN_KEYS, norm360m, PLANET_CN, ELEMENT_COLOR, ELEMENT_BG, ELEMENT_CN, MODALITY_CN, SEASON_INGRESS_CN, pGlyph, sGlyph, triadPhase, currentYear, safeFacts, clampYear, yearLabel, dignityText, ascRuler } from './tables';
import { CARD, CARD_TITLE } from './cards';
const Option = XQSelect.Option;

export const westernCardMethods = {
	// WP-8 校正辅助卡:显当前四轴 + ±分钟微调建置时刻(重排即时看四轴移动)+ 事件检验指引。
	renderRectificationCard(chart){
		if(!chart){ return null; }
		const facts = safeFacts(chart);
		if(!facts || !facts.meta){ return null; }
		const ACC = '#0e7490';
		const m = facts.meta;
		const signOf = (lon) => (typeof lon === 'number') ? SIGN_KEYS[Math.floor((((lon % 360) + 360) % 360) / 30)] : null;
		const ascKey = m.ascSign || signOf(m.ascLon);
		const mcKey = signOf(m.mcLon);
		const ascDeg = (m.ascDegree != null) ? m.ascDegree : (m.ascLon != null ? (((m.ascLon % 30) + 30) % 30) : null);
		const mcDeg = (m.mcLon != null) ? (((m.mcLon % 30) + 30) % 30) : null;
		const NB = (dm, label) => (<XQButton size="small" onClick={() => this.nudgeFoundingTime(dm)}>{label}</XQButton>);
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />时刻校正</div>
				<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginBottom: 8, lineHeight: '17px' }}>建置时刻不确定时,按已知事件微调时刻使四轴/推运吻合。四轴对时刻极敏感(上升约 4 分钟移 1°)。</div>
				<div style={{ fontSize: 13, lineHeight: '21px', marginBottom: 8 }}>
					<div>当前上升 {ascKey ? <b style={{ color: ACC }}>{sGlyph(ascKey)} {(SIGNS[ascKey] || {}).cn || ''}</b> : null} {ascDeg != null ? ascDeg.toFixed(2) + '°' : ''}</div>
					<div>当前天顶 {mcKey ? <b style={{ color: ACC }}>{sGlyph(mcKey)} {(SIGNS[mcKey] || {}).cn || ''}</b> : null} {mcDeg != null ? mcDeg.toFixed(2) + '°' : ''}</div>
				</div>
				<div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
					{NB(-30, '−30分')}{NB(-5, '−5分')}{NB(-1, '−1分')}{NB(1, '+1分')}{NB(5, '+5分')}{NB(30, '+30分')}
				</div>
				<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', lineHeight: '17px' }}>点按钮平移建置时刻并重排,上方四轴随之变化。<b>检验法</b>:取已知历史事件年(政权更替/战乱/重大转折),看该年 太阳弧/次限/小限/返照 是否精确击中四轴或相关宫主——吻合者即较可信的校正时刻。</div>
				<div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(128,128,128,0.08)' }}>
					<div style={{ fontSize: 12.5, fontWeight: 600, color: ACC, marginBottom: 4 }}>事件年反推 · 返照收敛检验</div>
					{/* 点选式年份收集(步进选年→加入;芯片可删;≤8),不逼手输逗号串 */}
					<div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
						<XQInputNumber size="small" style={{ width: 92 }} min={-3000} max={3000}
							value={this.state.rectYearPick != null ? this.state.rectYearPick : currentYear()}
							onChange={(v) => this.setState({ rectYearPick: v })} />
						<XQButton size="small" onClick={() => {
							const y = parseInt(this.state.rectYearPick != null ? this.state.rectYearPick : currentYear(), 10);
							if(!Number.isFinite(y)){ return; }
							const cur = String(this.state.rectEvents || '').split(/[,，、\s]+/).map((s) => parseInt(s, 10)).filter((x) => Number.isFinite(x));
							if(cur.indexOf(y) < 0 && cur.length < 8){ this.setState({ rectEvents: [...cur, y].join(',') }); }
						}}>＋加入</XQButton>
						<XQButton size="small" disabled={this.state.rectLoading} onClick={() => this.computeEventRectification(chart)}>{this.state.rectLoading ? '检验中…' : '检验'}</XQButton>
					</div>
					{(() => {
						const yrs = String(this.state.rectEvents || '').split(/[,，、\s]+/).map((s) => parseInt(s, 10)).filter((x) => Number.isFinite(x));
						return yrs.length ? (
							<div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
								{yrs.map((y) => (
									<span key={y} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, padding: '2px 8px', borderRadius: 999, background: 'rgba(14,116,144,0.1)', border: '1px solid rgba(14,116,144,0.3)', color: ACC }}>
										{yearLabel(y)}
										<span style={{ cursor: 'pointer', color: 'var(--horosa-text-secondary)', fontWeight: 700 }} {...pressable(() => this.setState({ rectEvents: yrs.filter((x) => x !== y).join(',') }))}>×</span>
									</span>
								))}
							</div>
						) : <div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginBottom: 6 }}>选历史事件年(政权更替/战乱/重大转折)加入,最多 8 个。</div>;
					})()}
					{this.state.rectErr ? <div style={{ fontSize: 11, color: 'var(--horosa-jx-xiong, #c0392b)', marginBottom: 4 }}>{this.state.rectErr}</div> : null}
					{this.state.rectRows ? (() => {
						const rows = this.state.rectRows;
						const hitN = rows.filter((r) => r.hits.length).length;
						return (
							<div style={{ fontSize: 11.5, lineHeight: '18px' }}>
								{rows.map((r) => (
									<div key={r.year} style={{ display: 'flex', gap: 6 }}>
										<span style={{ width: 44, color: 'var(--horosa-text-secondary)' }}>{r.year}</span>
										<span style={{ flex: 1 }}>返照上升 {r.srAsc != null ? `${(r.srAsc % 30).toFixed(1)}°` : '—'}{r.hits.length ? <b style={{ color: ACC }}> 命中{r.hits.join('/')}</b> : <span style={{ color: 'var(--horosa-text-secondary)' }}> 未中轴</span>}</span>
									</div>
								))}
								<div style={{ marginTop: 4, fontWeight: 600, color: hitN * 2 >= rows.length ? ACC : undefined }}>收敛度 {hitN}/{rows.length}（该年返照上升合本盘四轴 ±3°）——微调时刻后重跑,取收敛度最高的时刻。</div>
							</div>
						);
					})() : null}
				</div>
				<div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(128,128,128,0.08)' }}>
					<div style={{ fontSize: 12.5, fontWeight: 600, color: ACC, marginBottom: 4 }}>重定位四轴（换地点·同时刻）</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
						<XQSelect size="small" style={{ width: 144 }} placeholder="选首都重定位" value={this.state.relocCity || undefined} disabled={this.state.relocLoading}
							onChange={(v) => { const c = MUNDANE_CAPITALS.find((x) => x.cn === v); if(c){ this.computeMundaneRelocation(chart, c); } }}>
							{MUNDANE_CAPITALS.map((c) => (<Option key={c.cn} value={c.cn}>{c.cn}</Option>))}
						</XQSelect>
						{this.state.relocLoading ? <span style={{ fontSize: 11, color: 'var(--horosa-text-secondary)' }}>计算中…</span> : null}
					</div>
					{this.state.relocErr ? <div style={{ fontSize: 11, color: 'var(--horosa-jx-xiong, #c0392b)' }}>{this.state.relocErr}</div> : null}
					{(this.state.relocData && !this.state.relocLoading) ? (() => {
						const rm = this.state.relocData;
						const rA = rm.ascSign || signOf(rm.ascLon);
						const rM = signOf(rm.mcLon);
						const rAd = (rm.ascDegree != null) ? rm.ascDegree : (rm.ascLon != null ? (((rm.ascLon % 30) + 30) % 30) : null);
						const rMd = (rm.mcLon != null) ? (((rm.mcLon % 30) + 30) % 30) : null;
						return (
							<div style={{ fontSize: 12.5, lineHeight: '20px' }}>
								<div>{this.state.relocCity} 上升 {rA ? <b style={{ color: ACC }}>{sGlyph(rA)} {(SIGNS[rA] || {}).cn || ''}</b> : null} {rAd != null ? rAd.toFixed(2) + '°' : ''}</div>
								<div>{this.state.relocCity} 天顶 {rM ? <b style={{ color: ACC }}>{sGlyph(rM)} {(SIGNS[rM] || {}).cn || ''}</b> : null} {rMd != null ? rMd.toFixed(2) + '°' : ''}</div>
								<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 2 }}>保黄经星位不变,仅四轴/宫随地点重算;用于「同一时刻对某地的角度强调」。</div>
							</div>
						);
					})() : null}
				</div>
			</div>
		);
	},

	// §14.2 天气占星卡(best-effort)+ §14 其他子流派清单。入境(季)/朔望(旬)概览显示。
	renderWeatherCard(chart, extra){
		if(!chart){ return null; }
		const facts = safeFacts(chart);
		if(!facts){ return null; }
		let w = null;
		try{ w = describeMundaneWeather(facts); }catch(e){ w = null; }
		const type = (extra || {}).mundaneType || 'ingress';
		const scope = (type === 'newmoon' || type === 'fullmoon') ? '本旬' : '本季';
		const ACC = '#2980b9';
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />专门子流派 · 天气占星</div>
				{(w && w.factors.length) ? (
					<div>
						<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginBottom: 6, lineHeight: '17px' }}>临角或合月行星定{scope}天气倾向(托勒密 astrometeorology):</div>
						{w.factors.map((f) => (
							<div key={f.key} style={{ fontSize: 12.5, padding: '2.5px 0', color: f.malefic ? 'var(--horosa-jx-xiong, #c0392b)' : 'inherit' }}>
								{pGlyph(f.key)} {f.cn} <span style={{ color: 'var(--horosa-muted, #8a8472)', fontSize: 11 }}>{[f.angular ? '临角' : '', f.nearMoon ? '合月' : ''].filter(Boolean).join('·')}</span> → {f.weather}
							</div>
						))}
					</div>
				) : <div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)', padding: '4px 0' }}>本盘无临角/合月行星主导,{scope}天气倾向不显著(合于时令)。</div>}
				<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 8, lineHeight: '15px' }}>
					{'其他专门子流派:'}
					{'地震占星属研究性·统计未证实,仅备探索、不作预测断言。'}
				</div>
			</div>
		);
	},

	// 概览卡:盘种/有效期/权重/休眠判定。
	renderSolunarOverview(chart, extra){
		const st = describeSolunar(extra.solunarType || 'capsolar', extra.solunarWeights || 'scheme_a');
		if(!st){ return null; }
		let dormant = null;
		try{ dormant = chart ? isDormantChart(buildFacts(chart), extra.solunarOrb || 3) : null; }catch(e){ dormant = null; }
		const ACC = 'var(--horosa-hue-teal)';
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />恒星派入境 · 概览</div>
				<div style={{ fontSize: 14, fontWeight: 700, color: ACC }}>{st.cn}</div>
				<div style={{ fontSize: 12, lineHeight: '19px', marginTop: 4 }}>
					<div>有效期：{st.span}</div>
					<div>相对强度：{st.weight}（口径 {st.weightsCn}）</div>
					<div>体系：恒星黄道 Fagan/Bradley 差值 · Campanus 卯酉圈量角化 · 角化压倒宫义</div>
				</div>
				{dormant != null ? (
					dormant ? (
						<div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 7, background: 'rgba(128,128,128,0.1)', fontSize: 12.5, fontWeight: 600 }}>休眠盘：无行星入角（容许 {extra.solunarOrb || 3}°）——本盘无信息，实务可略过，看下一级时间盘。</div>
					) : (
						<div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 7, background: 'rgba(0,105,92,0.1)', color: ACC, fontSize: 12.5, fontWeight: 600 }}>活跃盘：有行星入角，见「角化」页详情。</div>
					)
				) : null}
				<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 8, lineHeight: '15px' }}>时间降阶：年=Capsolar → 季=最近非休眠季太阳入境 → 月=Caplunar → 周=最近非休眠月入境。</div>
			</div>
		);
	},

	// 角化卡:按角距排序的行星表 + 角距条(≤1° 红/≤orb 橙/≤10° 灰)+ 临角断语。
	renderSolunarAngularity(chart, extra){
		if(!chart){ return null; }
		let ang = null;
		try{ ang = computeAngularity(buildFacts(chart), extra.solunarOrb || 3); }catch(e){ ang = null; }
		if(!ang){ return null; }
		let death = false;
		try{ death = rulerDeathSignature(buildFacts(chart), extra.solunarOrb || 3); }catch(e){ death = false; }
		const barColor = (r) => (r.strong ? 'var(--horosa-jx-xiong, #c0392b)' : (r.foreground ? '#e67e22' : 'rgba(128,128,128,0.45)'));
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#00695c', borderRadius: 2, display: 'inline-block' }} />角化 Mundoscope（容许 {ang.orb}°）</div>
				<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginBottom: 8, lineHeight: '16px' }}>卯酉圈等分量各星到四轴角距——恒星派实务几乎只看「谁紧合四轴」；≤1° 尤强。</div>
				{ang.rows.map((r) => (
					<div key={r.planet} style={{ padding: '3px 0' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
							<span style={{ width: 46, flex: '0 0 46px' }}>{pGlyph(r.planet)} {MUN_PLANET_CN[r.planet] || r.planet}</span>
							<span style={{ width: 58, opacity: 0.7 }}>距{r.axisCn}</span>
							<span style={{ flex: 1, height: 6, background: 'rgba(128,128,128,0.1)', borderRadius: 3, overflow: 'hidden' }}>
								<span style={{ display: 'block', height: '100%', width: `${Math.max(4, Math.round((1 - Math.min(r.dist, 45) / 45) * 100))}%`, background: barColor(r) }} />
							</span>
							<span style={{ width: 44, textAlign: 'right', fontWeight: r.foreground ? 700 : 400, color: barColor(r) }}>{r.dist.toFixed(1)}°</span>
						</div>
						{r.foreground && r.omen ? (
							<div style={{ fontSize: 10.5, paddingLeft: 52, opacity: 0.75, color: r.omen.tone === 'malefic' ? 'var(--horosa-jx-xiong, #c0392b)' : (r.omen.tone === 'benefic' ? 'var(--horosa-jx-ji, #16a085)' : undefined) }}>{r.omen.text}</div>
						) : null}
					</div>
				))}
				{death ? (<div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 7, background: 'rgba(192,57,43,0.12)', color: 'var(--horosa-jx-xiong, #c0392b)', fontSize: 12.5, fontWeight: 700 }}>⚠ 复合判据命中：土星与太阳皆在角且彼此无相位。</div>) : null}
				<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 8, lineHeight: '15px' }}>{OMEN_COMBOS.join('；')}。</div>
			</div>
		);
	},

	// ---------- 右栏 ----------
	renderFixedStarCard(chart, extra){
		if(!chart){ return null; }
		const facts = safeFacts(chart);
		if(!facts){ return null; }
		const year = (extra && extra.ingressYear) || currentYear();
		const hits = mundaneFixedStarHits(buildMundaneStarPoints(facts), year, 1.5);
		if(!hits.length){ return null; }
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#1976d2', borderRadius: 2, display: 'inline-block' }} />世运恒星命中（{year} 年岁差校正 · orb 1.5°）</div>
				{hits.map((h, i) => (
					<div key={i} style={{ padding: '5px 0', borderTop: i ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
						<div style={{ fontSize: 12.5, fontWeight: 600 }}>{h.pointCn} 合 {h.starCn}{h.royal ? <span style={{ color: 'var(--horosa-accent-strong)' }}>（王星·{h.royal}）</span> : null} <span style={{ color: 'var(--horosa-text-secondary)', fontWeight: 400 }}>{h.nature} · {h.orb}°</span></div>
						<div style={{ fontSize: 11.5, opacity: 0.7, lineHeight: '17px', marginTop: 1 }}>{h.meaning}</div>
					</div>
				))}
				<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 8 }}>恒星合四轴或日月时极具分量;王星(东毕宿五/北轩辕十四/西心宿二/南北落师门)尤重。</div>
			</div>
		);
	},

	// WP-7 地理分野(§12):本盘四轴落分野 + 托勒密四象限;中性数据·多源·免责。ACG 星图线=已有页,不做。
	renderChorographyCard(chart, extra){
		if(!chart){ return null; }
		const facts = safeFacts(chart);
		if(!facts){ return null; }
		const dsKey = rulesetConfig((extra || {}).mundaneRuleset).chorographyDataset;
		let r = null;
		try{ r = describeChorography(facts, dsKey); }catch(e){ r = null; }
		if(!r){ return null; }
		const sCn = (k) => (SIGNS[k] || {}).cn || k;
		const ACC = 'var(--horosa-hue-teal)';
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />地理分野 Chorography（{r.datasetMeta.label}）</div>
				<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginBottom: 8, lineHeight: '17px' }}>{r.datasetMeta.note}</div>
				<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, margin: '2px 0 2px' }}>本盘四轴落分野 · 本年地理强调</div>
				{r.axes.map((a, i) => (
					<div key={a.axis} style={{ padding: '5px 0', borderTop: i ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
						<div style={{ fontSize: 12.5, fontWeight: 600 }}>
							<span style={{ color: 'var(--horosa-text-secondary)', fontWeight: 400, marginRight: 6 }}>{a.cn}</span>
							<span style={{ color: ACC }}>{sGlyph(a.sign)}</span> {sCn(a.sign)}
						</div>
						<div style={{ fontSize: 11.5, opacity: 0.72, lineHeight: '17px', marginTop: 1 }}>地域：{a.regions.countries.join('、')}</div>
						{a.regions.cities.length ? (<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 1 }}>城市：{a.regions.cities.join('、')}</div>) : null}
					</div>
				))}
				{r.citiesOmitted ? (<div style={{ fontSize: 10, color: 'var(--horosa-text-secondary)', marginTop: 2 }}>古典/中世纪档不列城市与现代国家条目（系后世增补，切「现代综合」查看）。</div>) : null}
				<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, margin: '10px 0 4px' }}>托勒密四象限 · 三方主管</div>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
					{r.quadrants.map((q) => (
						<div key={q.key} style={{ flex: '1 1 46%', minWidth: 132, border: `1px solid ${ELEMENT_COLOR[q.element]}33`, borderLeft: `3px solid ${ELEMENT_COLOR[q.element]}`, borderRadius: 6, padding: '4px 8px' }}>
							<div style={{ fontSize: 12, fontWeight: 600, color: ELEMENT_COLOR[q.element], display: 'flex', alignItems: 'center', gap: 1 }}><span style={{ marginRight: 3 }}>{q.cn}</span>{q.signs.map((s, si) => (<span key={si} style={{ display: 'inline-flex', justifyContent: 'center', minWidth: '1.3em' }}>{sGlyph(s)}</span>))}</div>
							<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', lineHeight: '15px', marginTop: 1 }}>主星 {PLANET_CN[q.rulers.day]}/{PLANET_CN[q.rulers.night]} · {q.region}</div>
						</div>
					))}
				</div>
				<div style={{ fontSize: 10, color: 'var(--horosa-text-secondary)', marginTop: 8, lineHeight: '15px' }}>⚠️ {CHOROGRAPHY_DISCLAIMER}</div>
			</div>
		);
	},

	// WP-6 地区盘推运(§11.2):小限 Profections + 法达 Firdaria(纯前端,以建置盘为基准)。
	renderProgressionCard(chart, extra){
		if(!chart){ return null; }
		const facts = safeFacts(chart);
		if(!facts || !facts.meta || !facts.meta.ascSign){ return null; }
		const ACC = 'var(--horosa-hue-orange)';
		const founding = (this.state.progFoundingYear != null) ? this.state.progFoundingYear : ((extra && extra.regionFoundingYear) || null);
		const target = (this.state.progTargetYear != null) ? this.state.progTargetYear : currentYear();
		const age = (founding != null) ? Math.max(0, target - founding) : null;
		const prof = (age != null) ? mundaneProfection(facts.meta.ascSign, age) : null;
		const fird = (age != null) ? mundaneFirdaria(facts.meta.sect, age) : null;
		const sCn = (k) => (SIGNS[k] || {}).cn || k;
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />地区盘推运</div>
				<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginBottom: 8, lineHeight: '17px' }}>以地区建置/政权宣告盘为命基,小限·法达推目标年运势重心(盘龄 = 目标年 − 建置年)。</div>
				<div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
					<span style={{ fontSize: 11.5, color: 'var(--horosa-text-secondary)' }}>建置年</span>
					<XQInputNumber size="small" style={{ width: 80 }} value={founding} min={-3000} max={3000} onChange={(v) => this.setState({ progFoundingYear: v })} />
					<span style={{ fontSize: 11.5, color: 'var(--horosa-text-secondary)' }}>目标年</span>
					<XQInputNumber size="small" style={{ width: 80 }} value={target} min={-3000} max={3000} onChange={(v) => this.setState({ progTargetYear: clampYear(v, currentYear()) })} />
					{age != null ? <span style={{ fontSize: 11.5, opacity: 0.75, color: ACC }}>盘龄 {age} 年</span> : null}
				</div>
				{age == null ? <div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)', padding: '4px 0' }}>填「建置年」(或左栏选预置地区盘自动带入)后,显示小限与法达。</div> : null}
				{prof ? (
					<div style={{ marginBottom: fird ? 12 : 0, paddingBottom: fird ? 10 : 0, borderBottom: fird ? '1px solid rgba(128,128,128,0.08)' : 'none' }}>
						<div style={{ fontSize: 12.5, fontWeight: 600, color: ACC, marginBottom: 4 }}>小限 · 流年</div>
						<div style={{ fontSize: 13, lineHeight: '20px' }}>年小限 <b style={{ color: ACC }}>{sGlyph(prof.profectedSign)} {prof.profectedSignCn}</b> · 激活第 {prof.activatedHouse} 宫 <span style={{ color: 'var(--horosa-text-secondary)' }}>（{prof.houseTheme}）</span></div>
						<div style={{ fontSize: 12.5, marginTop: 2 }}>年主 {pGlyph(prof.lord)} {prof.lordCn} <span style={{ color: 'var(--horosa-text-secondary)', fontSize: 11 }}>· 其命盘状态定全年基调</span></div>
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 9px', marginTop: 6, fontSize: 10.5, opacity: 0.7 }}>
							{prof.months.map((m) => (<span key={m.month}>{m.month}月 {sGlyph(m.sign)}{sCn(m.sign)}</span>))}
						</div>
					</div>
				) : null}
				{fird ? (
					<div>
						<div style={{ fontSize: 12.5, fontWeight: 600, color: ACC, marginBottom: 4 }}>法达 · {fird.sectCn}时主</div>
						<div style={{ fontSize: 13, lineHeight: '20px' }}>大期 <b style={{ color: ACC }}>{pGlyph(fird.major.planet)} {fird.major.planetCn}</b> <span style={{ color: 'var(--horosa-text-secondary)', fontSize: 11 }}>（盘龄 {fird.major.start}–{fird.major.end}）</span>{fird.sub ? <span> · 子期 {pGlyph(fird.sub.planet)} {fird.sub.planetCn}</span> : <span style={{ color: 'var(--horosa-text-secondary)', fontSize: 11 }}> · 交点期不分子期</span>}</div>
						<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 6, lineHeight: '16px' }}>序：{fird.sequence.map((x) => `${x.planetCn}${x.years}`).join(' · ')}（七政 70+南北交 5 = 75 年一轮）</div>
					</div>
				) : null}
				{age != null ? (
					<div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(128,128,128,0.08)' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
							<span style={{ fontSize: 12.5, fontWeight: 600, color: ACC }}>太阳返照 · {target} 年度地区图</span>
							<XQButton size="small" disabled={this.state.srLoading} onClick={() => this.computeMundaneReturn(chart, target)}>{this.state.srLoading ? '计算中…' : '排返照盘'}</XQButton>
						</div>
						{this.state.srErr ? <div style={{ fontSize: 11, color: 'var(--horosa-jx-xiong, #c0392b)', marginBottom: 4 }}>{this.state.srErr}</div> : null}
						{(this.state.srData && this.state.srYear === target && this.state.srKey === chartRequestKey(chart)) ? (
							<div style={{ fontSize: 12.5, lineHeight: '19px' }}>
								<div>返照时刻 <b>{this.state.srData.solarReturn ? this.state.srData.solarReturn.datetime : '-'}</b></div>
								<div>返照上升 {(this.state.srData.solarAsc && this.state.srData.solarAsc.sign) ? <span style={{ color: ACC }}>{sGlyph(String(this.state.srData.solarAsc.sign).toLowerCase())}</span> : null} {fmtDegree(this.state.srData.solarAsc)}</div>
								<div style={{ color: 'var(--horosa-text-secondary)', fontSize: 11, marginTop: 2 }}>返照盘四轴与地区盘叠加判读{this.state.srData.lunarReturn ? '；首个月返照 ' + this.state.srData.lunarReturn.datetime : ''}。</div>
							</div>
						) : <div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)' }}>点「排返照盘」按目标年太阳回归本位起年度地区图(返照盘四轴叠加命盘判读)。</div>}
					</div>
				) : null}
				{age != null ? (
					<div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(128,128,128,0.08)' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
							<span style={{ fontSize: 12.5, fontWeight: 600, color: ACC }}>次限 · 太阳弧 · {target} 年</span>
							<XQButton size="small" disabled={this.state.secLoading} onClick={() => this.computeMundaneSecondary(chart, target)}>{this.state.secLoading ? '计算中…' : '排次限'}</XQButton>
						</div>
						{this.state.secErr ? <div style={{ fontSize: 11, color: 'var(--horosa-jx-xiong, #c0392b)', marginBottom: 4 }}>{this.state.secErr}</div> : null}
						{(this.state.secData && this.state.secYear === target && this.state.secKey === chartRequestKey(chart)) ? (() => {
							const sec = this.state.secData;
							const pos = sec.positions || [];
							const pSun = pos.find((p) => p.id === 'Sun');
							const pMoon = pos.find((p) => p.id === 'Moon');
							const natalSun = (facts.planets && facts.planets.sun) ? facts.planets.sun.lon : null;
							const arc = (pSun && natalSun != null) ? (((pSun.lon - natalSun) % 360 + 360) % 360) : null;
							const sCn = (s) => (SIGNS[String(s || '').toLowerCase()] || {}).cn || s;
							const ASP_CN = { 0: '合', 60: '六合', 90: '刑', 120: '三合', 180: '冲' };
							const pCn = (id) => MUN_PLANET_CN[String(id).toLowerCase()] || id;
							return (
								<div style={{ fontSize: 12.5, lineHeight: '19px' }}>
									{pSun ? <div>次限太阳 {pGlyph('sun')} {sCn(pSun.sign)} {pSun.signlon != null ? pSun.signlon.toFixed(1) + '°' : ''}</div> : null}
									{pMoon ? <div>次限月亮 {pGlyph('moon')} {sCn(pMoon.sign)} {pMoon.signlon != null ? pMoon.signlon.toFixed(1) + '°' : ''}</div> : null}
									{arc != null ? <div>太阳弧 <b style={{ color: ACC }}>{arc.toFixed(1)}°</b> <span style={{ color: 'var(--horosa-text-secondary)', fontSize: 11 }}>(全盘整体推进此弧)</span></div> : null}
									{(sec.aspectsToNatal && sec.aspectsToNatal.length) ? <div style={{ marginTop: 4, opacity: 0.85 }}>应期(次限击本命):{sec.aspectsToNatal.slice(0, 6).map((a, i) => (<span key={i} style={{ marginRight: 8 }}>次限{pCn(a.a)}{ASP_CN[a.aspect] || a.aspect + '°'}本命{pCn(a.b)}({a.orb != null ? a.orb.toFixed(1) : '?'}°)</span>))}</div> : null}
								</div>
							);
						})() : <div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)' }}>点「排次限」按"一日一年"推目标年次限盘 + 太阳弧引动(进太阳击本命四轴/星)。</div>}
					</div>
				) : null}
			</div>
		);
	},

	// WP-6 主限四轴向运(§11.2):走专用主限推运引擎(精度已固定),独立成页,此处给精确指引,不另起脆弱耦合表。
	renderPrimaryDirectionNote(){
		return (
			<div style={{ ...CARD, marginTop: 10 }}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#6a4c93', borderRadius: 2, display: 'inline-block' }} />主限四轴向运</div>
				<div style={{ fontSize: 11.5, opacity: 0.78, lineHeight: '18px' }}>
					把本盘上升 / 天顶按主限弧推向各行星,标记国运重大转折年。此法走专用主限推运引擎(精度对齐独立校验),独立成页以保精度。
				</div>
				<div style={{ fontSize: 11.5, opacity: 0.7, lineHeight: '18px', marginTop: 5 }}><b>排法:</b>记下本盘建置日期 · 时刻 · 坐标,于「占星 → 主限」载入该盘,即得逐年向运表(迫星 · 应星 · 应期年)。</div>
			</div>
		);
	},

	// WP-2 §17 盘型·格局:分布型(前端 Jones+元素/模式/半球)+ 相位格局(后端 analysis surfacing)。
	renderDistributionCard(chart, extra){
		if(!chart){ return null; }
		const facts = safeFacts(chart);
		if(!facts){ return null; }
		const cfg = rulesetConfig((extra || {}).mundaneRuleset);
		const dist = mundaneDistribution(facts, cfg.showOuterPlanets);   // 排盘判读真随流派:古典/中世纪只七曜
		const ACC = 'var(--horosa-hue-purple)';
		const OUTER = ['uranus', 'neptune', 'pluto'];
		const isOuter = (id) => OUTER.indexOf(String(id).toLowerCase()) >= 0;
		const allPats = (this.state.patKey === chartRequestKey(chart) && this.state.patData) ? this.state.patData : null;
		const pats = allPats ? (cfg.showOuterPlanets ? allPats : allPats.filter((p) => !(p.points || []).some(isOuter))) : null;
		const hemi = dist ? dist.hemispheres : null;
		const apexCn = (id) => MUN_PLANET_CN[String(id).toLowerCase()] || id;
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />盘型 · 格局</div>
				{dist ? (
					<div style={{ marginBottom: 10 }}>
						{dist.jonesInfo ? <div style={{ fontSize: 13, lineHeight: '20px' }}>分布型 <b style={{ color: ACC }}>{dist.jonesInfo.cn}</b> <span style={{ opacity: 0.7, fontSize: 11.5 }}>{dist.jonesInfo.text}</span></div> : null}
						<div style={{ fontSize: 12.5, marginTop: 4 }}>元素偏盛 <b style={{ color: ACC }}>{dist.domElementCn}象</b>（火{dist.elements.fire}·土{dist.elements.earth}·风{dist.elements.air}·水{dist.elements.water}）<span style={{ color: 'var(--horosa-text-secondary)', fontSize: 11 }}>{dist.domElementText}</span></div>
						<div style={{ fontSize: 12.5, marginTop: 2 }}>模式偏盛 <b style={{ color: ACC }}>{dist.domModeCn}</b>（基本{dist.modes.cardinal}·固定{dist.modes.fixed}·变动{dist.modes.mutable}）<span style={{ color: 'var(--horosa-text-secondary)', fontSize: 11 }}>{dist.domModeText}</span></div>
						{hemi ? <div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginTop: 2 }}>半球 上{hemi.above}/下{hemi.below}（外显↔内政）· 东{hemi.east}/西{hemi.west}（自主↔关系）</div> : null}
						<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 3 }}>分布基准：{dist.count} 体（{dist.classical ? '七曜·古典/中世纪规则集' : '含 ♅♆♇·现代/Barbault 规则集'}）</div>
					</div>
				) : null}
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, borderTop: '1px solid rgba(128,128,128,0.08)', paddingTop: 8 }}>
					<span style={{ fontSize: 12.5, fontWeight: 600, color: ACC }}>相位格局</span>
					<XQButton size="small" disabled={this.state.patLoading} onClick={() => this.computeMundanePatterns(chart)}>{this.state.patLoading ? '计算中…' : '查格局'}</XQButton>
				</div>
				{this.state.patErr ? <div style={{ fontSize: 11, color: 'var(--horosa-jx-xiong, #c0392b)' }}>{this.state.patErr}</div> : null}
				{pats ? (pats.length ? pats.map((p, i) => {
					const m = mundanePatternMeaning(p.type);
					return m ? (
						<div key={i} style={{ padding: '4px 0', borderTop: i ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
							<div style={{ fontSize: 12.5, fontWeight: 600 }}>{m.cn}{p.apex ? <span style={{ color: 'var(--horosa-text-secondary)', fontWeight: 400 }}>（顶点 {apexCn(p.apex)}）</span> : null}{p.sign ? <span style={{ color: 'var(--horosa-text-secondary)', fontWeight: 400 }}>（{(SIGNS[String(p.sign).toLowerCase()] || {}).cn || p.sign}）</span> : null}</div>
							<div style={{ fontSize: 11.5, opacity: 0.72, lineHeight: '17px' }}>{m.text}</div>
						</div>
					) : null;
				}) : <div style={{ fontSize: 11.5, color: 'var(--horosa-text-secondary)' }}>本盘无显著相位格局。</div>) : <div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)' }}>点「查格局」检测 大三角/大十字/T三角/Yod/风筝/星群 等。</div>}
			</div>
		);
	},

	// §16.3 会合盘指示星(仅木土会合盘显示):木/土得力定吉凶,会合座元素定气候。
	renderConjunctionIndicator(chart){
		if(!chart){ return null; }
		const facts = safeFacts(chart);
		const ind = facts ? mundaneConjunctionIndicator(facts) : null;
		if(!ind){ return null; }
		const toneColor = ind.tone === '吉' ? '#2e7d32' : (ind.tone === '凶' ? 'var(--horosa-jx-xiong, #c0392b)' : '#8a6d3b');
		return (
			<div style={{ ...CARD, marginTop: 10 }}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: toneColor, borderRadius: 2, display: 'inline-block' }} />会合指示星</div>
				<div style={{ fontSize: 12.5, lineHeight: '20px' }}>木土会合于 <b style={{ color: toneColor }}>{ind.signCn}</b>（{ELEMENT_CN[ind.element] || ind.element} · 角距 {ind.sep}°）</div>
				<div style={{ fontSize: 12.5, marginTop: 3 }}>指示星 <b style={{ color: toneColor }}>{ind.strongerCn}</b> <span style={{ color: toneColor, fontWeight: 700 }}>（{ind.tone}）</span></div>
				<div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 3, lineHeight: '17px' }}>{ind.toneText}</div>
				<div style={{ fontSize: 11.5, color: 'var(--horosa-text-secondary)', marginTop: 4, lineHeight: '17px' }}>气候 / 领域：{ind.climate}</div>
			</div>
		);
	},

	renderVictorCard(chart, extra){
		if(!chart){ return null; }
		let v = null;
		try{ v = describeMundaneVictor(buildFacts(chart), (extra || {}).mundaneRuleset); }catch(e){ v = null; }
		if(!v){ return null; }
		const top = v.scores.filter((x) => x.score > 0);
		const maxS = v.maxScore || 1;
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#9c27b0', borderRadius: 2, display: 'inline-block' }} />定局 · 年主/盘主</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
					<span style={{ fontSize: 22, color: '#9c27b0' }}>{pGlyph(v.victor)}</span>
					<div>
						<div style={{ fontSize: 15, fontWeight: 700, color: '#9c27b0' }}>{v.victorCn} · 年主星</div>
						<div style={{ fontSize: 11, opacity: 0.7 }}>{v.victorMundane ? v.victorMundane.powerRole : ''}</div>
					</div>
					<span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--horosa-text-secondary)' }}>累分 {v.maxScore}</span>
				</div>
				<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginBottom: 6 }}>取点：{v.points.join(' / ')}（各 5 重尊贵 + 宫位 + 偶然状态增减）</div>
				{top.map((x) => (
					<div key={x.planet} style={{ padding: '2px 0' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
							<span style={{ width: 42, flex: '0 0 42px' }}>{pGlyph(x.planet)} {x.cn}</span>
							<span style={{ flex: 1, height: 6, background: 'rgba(128,128,128,0.12)', borderRadius: 3, overflow: 'hidden' }}>
								<span style={{ display: 'block', height: '100%', width: `${Math.round(Math.max(x.score, 0) / maxS * 100)}%`, background: x.planet === v.victor ? '#9c27b0' : 'rgba(156,39,176,0.4)' }} />
							</span>
							<span style={{ width: 22, textAlign: 'right', opacity: 0.7 }}>{x.score}</span>
						</div>
						{x.accidentalItems && x.accidentalItems.length ? (
							<div style={{ fontSize: 10, color: 'var(--horosa-text-secondary)', paddingLeft: 48, lineHeight: '14px' }}>
								{x.accidentalItems.map((it, i) => (
									<span key={i} style={{ marginRight: 7, color: it.v < 0 ? 'var(--horosa-jx-xiong, #c0392b)' : 'var(--horosa-jx-ji, #16a085)' }}>{it.cn} {it.v > 0 ? `+${it.v}` : it.v}</span>
								))}
							</div>
						) : null}
					</div>
				))}
				<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 8 }}>年主星主导该年/季世俗主题(政权人物/行业领域);偶然层(当令/焦伤/逆行/被围攻)古籍系定性口径,数值为引擎统一刻度、逐项回显备稽。</div>
			</div>
		);
	},

	// 四轴特殊点卡:赤道上升点/天顶点/反天顶(纯前端由 MC/纬度派生,坐标篇公式)。
	renderSpecialAxesCard(chart){
		if(!chart){ return null; }
		let sp = null;
		try{ sp = describeSpecialAxes(buildFacts(chart)); }catch(e){ sp = null; }
		if(!sp){ return null; }
		const row = (cn, lon) => {
			if(lon == null){ return null; }
			const sk = SIGN_KEYS[Math.floor(norm360m(lon) / 30)];
			return (
				<div key={cn} style={{ display: 'flex', gap: 8, fontSize: 12.5, padding: '2.5px 0' }}>
					<span style={{ width: 86, color: 'var(--horosa-text-secondary)' }}>{cn}</span>
					<span><span style={{ color: '#0e7490' }}>{sGlyph(sk)}</span> {(SIGNS[sk] || {}).cn || ''} {(norm360m(lon) % 30).toFixed(2)}°</span>
				</div>
			);
		};
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#0e7490', borderRadius: 2, display: 'inline-block' }} />四轴特殊点</div>
				{row('赤道上升点', sp.eastPoint)}
				{row('天顶点 Vertex', sp.vertex)}
				{row('反天顶', sp.antivertex)}
				<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 6, lineHeight: '15px' }}>{sp.note}</div>
			</div>
		);
	},

	// 赤纬平行卡:主盘响应现成 declParallel(平行组/反平行),世运侧首次曝光。
	renderDeclParallelCard(chart){
		if(!chart || !chart.declParallel){ return null; }
		const dp = chart.declParallel;
		const groups = Array.isArray(dp.parallel) ? dp.parallel : [];
		const contra = dp.contraParallel && typeof dp.contraParallel === 'object' ? dp.contraParallel : {};
		const cnOf = (id) => MUN_PLANET_CN[String(id).toLowerCase()] || id;
		const contraKeys = Object.keys(contra).filter((k) => Array.isArray(contra[k]) && contra[k].length);
		if(!groups.length && !contraKeys.length){ return null; }
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#5c6bc0', borderRadius: 2, display: 'inline-block' }} />赤纬平行 / 反平行</div>
				<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginBottom: 6, lineHeight: '16px' }}>同赤纬(≤1°)成平行=如合相之力;异号反平行=如对冲。世运用于捕捉黄经相位之外的隐性联结。</div>
				{groups.length ? (
					<div style={{ fontSize: 12, lineHeight: '19px' }}>
						<b style={{ opacity: 0.7 }}>平行组</b>
						{groups.map((g, i) => (<div key={i}>· {(Array.isArray(g) ? g : []).map(cnOf).join(' × ')}</div>))}
					</div>
				) : null}
				{contraKeys.length ? (
					<div style={{ fontSize: 12, lineHeight: '19px', marginTop: 6 }}>
						<b style={{ opacity: 0.7 }}>反平行</b>
						{contraKeys.slice(0, 10).map((k) => (<div key={k}>· {cnOf(k)} ↔ {contra[k].map(cnOf).join('、')}</div>))}
					</div>
				) : null}
			</div>
		);
	},

	renderJudgmentCards(chart){
		if(!chart){ return null; }
		let rows = [];
		try{ rows = describeMundaneChart(buildFacts(chart)); }catch(e){ rows = []; }
		if(!rows.length){ return null; }
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#8a6d3b', borderRadius: 2, display: 'inline-block' }} />行星落世俗宫</div>
				{rows.map((r, i) => (
					<div key={i} style={{ padding: '6px 0', borderTop: i ? '1px solid rgba(128,128,128,0.07)' : 'none' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600 }}>
							<span style={{ fontSize: 14 }}>{pGlyph(r.planet)}</span>{r.planetCn}
							<span style={{ color: 'var(--horosa-text-secondary)', fontWeight: 400 }}>第{r.house}宫 · {r.houseMeaning}</span>
							{r.retro ? <span style={{ fontSize: 10, color: 'var(--horosa-jx-xiong, #c0392b)', opacity: 0.8 }}>逆</span> : null}
						</div>
						<div style={{ fontSize: 11.5, opacity: 0.7, lineHeight: '17px', marginTop: 2 }}>{r.text}</div>
						{r.signTemper ? <div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 1 }}>座气质 · {r.signTemper.modeElement}：{r.signTemper.temper}</div> : null}
					</div>
				))}
				<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 8 }}>判词为概括之象，须结合相位、宫主星状态与时势综合论断。</div>
			</div>
		);
	},

	renderIngressSkeleton(chart){
		if(!chart){ return null; }
		let sk = null, syz = null;
		try{ const f = buildFacts(chart); sk = describeIngressSkeleton(f); syz = describeMundaneSyzygy(f); }catch(e){ sk = null; }
		if(!sk){ return null; }
		const hL = (h, m) => h ? `第${h}宫${m ? ' · ' + m : ''}` : '未定';
		const row = (label, content) => (
			<div style={{ display: 'flex', gap: 8, padding: '5px 0', borderTop: '1px solid rgba(128,128,128,0.06)', fontSize: 12, lineHeight: '18px' }}>
				<span style={{ width: 50, flex: '0 0 50px', color: 'var(--horosa-text-secondary)' }}>{label}</span>
				<span style={{ flex: 1 }}>{content}</span>
			</div>
		);
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#8a6d3b', borderRadius: 2, display: 'inline-block' }} />入境判读骨架</div>
				{row('上升', <span>{sGlyph(sk.ascSign)} {sk.ascSignCn}{sk.ascTemper ? <span style={{ color: 'var(--horosa-text-secondary)' }}>（{sk.ascTemper.temper}）</span> : null}</span>)}
				{row('年主星', <span>{pGlyph(sk.ascRuler)} {sk.ascRulerCn} 落 {hL(sk.ascRulerHouse)}{sk.ascRulerAngular ? <b style={{ color: 'var(--horosa-accent-strong)' }}> · 临轴</b> : null}{sk.ascRulerRetro ? ' · 逆' : ''}</span>)}
				{row('政权', <span>10宫主 {pGlyph(sk.tenthRuler)}{sk.tenthRulerCn} · 太阳 {hL(sk.sun && sk.sun.house, sk.sun && sk.sun.houseMeaning)}{sk.tenthPlanets.length ? <span style={{ color: 'var(--horosa-text-secondary)' }}>（10宫内：{sk.tenthPlanets.map((x) => x.cn).join('、')}）</span> : null}</span>)}
				{row('民生', <span>月亮 {hL(sk.moon && sk.moon.house, sk.moon && sk.moon.houseMeaning)}</span>)}
				{syz ? row('产前朔望', <span>{sGlyph(syz.sign)} {syz.signCn} {syz.signlon != null ? syz.signlon.toFixed(1) + '°' : ''}{syz.kind ? <span style={{ color: 'var(--horosa-text-secondary)' }}>（{syz.kind}）</span> : null}</span>) : null}
				{row('临四轴', sk.angular.length ? <span>{sk.angular.map((a) => (<span key={a.key} style={{ color: a.malefic ? 'var(--horosa-jx-xiong, #c0392b)' : 'inherit', marginRight: 7 }}>{a.cn}(第{a.house}宫){a.malefic ? '⚠' : ''}</span>))}<span style={{ color: 'var(--horosa-text-secondary)' }}>凶星临轴主动荡</span></span> : <span style={{ color: 'var(--horosa-text-secondary)' }}>无</span>)}
				{row('外行星', sk.outers.length ? <span>{sk.outers.map((o) => `${o.cn} ${o.houseMeaning}`).join('；')}</span> : <span style={{ color: 'var(--horosa-text-secondary)' }}>—</span>)}
				<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 8 }}>当年外行星落宫叠加时代背景。</div>
			</div>
		);
	},

	// WP-1 四季入境盘:四枢轴(春分白羊·夏至巨蟹·秋分天秤·冬至摩羯)一览,点击起该季盘。
	renderSeasonalCard(extra){
		const year = clampYear(extra.ingressYear, currentYear());
		const seed = (this.state.seasonSeedYear === year) ? this.state.seasonSeed : null;
		const ACC = '#2e7d32';
		return (
			<div style={{ ...CARD, marginTop: 10 }}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />四季入境盘 · {year}</div>
				<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginBottom: 8, lineHeight: '17px' }}>春分(白羊·年盘)、夏至(巨蟹)、秋分(天秤)、冬至(摩羯)四枢轴入境。年盘上升落基本座时主管缩至首季,须并参四季盘。</div>
				<XQButton size="small" disabled={this.state.seasonLoading} onClick={() => this.scanSeasonalIngresses(extra)}>{this.state.seasonLoading ? '计算中…' : (seed ? '重算四季' : '起四季盘')}</XQButton>
				{this.state.seasonErr ? <div style={{ fontSize: 11, color: 'var(--horosa-jx-xiong, #c0392b)', marginTop: 6 }}>{this.state.seasonErr}</div> : null}
				{seed ? (
					<div style={{ marginTop: 8 }}>
						{INGRESSES.map((ing) => {
							const hit = seed[ing.term];
							const cur = (extra.ingressTerm === ing.term);
							return (
								<div key={ing.term} {...pressable(() => { if(hit && hit.time){ this.castSeasonalIngress(ing.term, hit.time, year); } })} title="点击起该季入境盘"
									style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderTop: '1px solid rgba(128,128,128,0.06)', cursor: (hit && hit.time) ? 'pointer' : 'default', fontSize: 12.5, fontWeight: cur ? 700 : 400 }}>
									<span><span style={{ color: ELEMENT_COLOR[(SIGNS[ing.signKey] || {}).element], marginRight: 5 }}>{sGlyph(ing.signKey)}</span>{SEASON_INGRESS_CN[ing.signKey]}{cur ? <span style={{ color: ACC, marginLeft: 6, fontSize: 10 }}>· 当前</span> : null}</span>
									<span style={{ opacity: 0.7 }}>{(hit && hit.time) ? hit.time.slice(0, 16) : '—'}<span style={{ marginLeft: 6, color: 'var(--horosa-text-secondary)' }}>›</span></span>
								</div>
							);
						})}
						<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 6 }}>swisseph 精算入境时刻(当地时区)。点任一季起该季入宫盘。</div>
					</div>
				) : null}
			</div>
		);
	},

	renderYearChart(chart, extra){
		const yl = chart ? ascRuler(chart) : null;
		const ing = INGRESSES.find((i) => i.term === (extra.ingressTerm || '春分'));
		// 入境主管制页面级覆盖:auto=随流派;quarterly/aries_annual/capricorn_year 显式选
		// (capricorn_year=摩羯优先派:冬至为政治/财政年首——死分支就此激活)。
		const effIngressRule = (extra.mundaneIngressRule && extra.mundaneIngressRule !== 'auto') ? extra.mundaneIngressRule : rulesetConfig(extra.mundaneRuleset).ingressRule;
		const gov = yl ? ingressGovernance(yl.signKey, effIngressRule, extra.ingressTerm || '春分') : null;   // 说明带上当前节气
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#b8860b', borderRadius: 2, display: 'inline-block' }} />年盘概要</div>
				{extra.ingressMoment ? (
					<div>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
							<span style={{ fontSize: 16, fontWeight: 700 }}>{extra.ingressYear != null ? extra.ingressYear : currentYear()} 年</span>
							<span style={{ fontSize: 12, opacity: 0.7 }}>{ing ? ing.label.split('（')[0] : '春分入宫'}</span>
						</div>
						<div style={{ fontSize: 11.5, color: 'var(--horosa-text-secondary)', marginBottom: 12 }}>入宫时刻 {extra.ingressMoment}</div>
						{yl ? (
							<div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(184,134,11,0.10)', border: '1px solid rgba(184,134,11,0.18)' }}>
								<div style={{ textAlign: 'center' }}>
									<div style={{ fontSize: 10, color: 'var(--horosa-text-secondary)' }}>上升</div>
									<div style={{ fontSize: 20, lineHeight: '24px' }}>{sGlyph(yl.signKey)}</div>
									<div style={{ fontSize: 12 }}>{yl.signCn}</div>
								</div>
								<span style={{ color: 'var(--horosa-text-secondary)', fontSize: 18 }}>→</span>
								<div style={{ textAlign: 'center' }}>
									<div style={{ fontSize: 10, color: 'var(--horosa-accent-strong)' }}>年主星 · 命主</div>
									<div style={{ fontSize: 22, lineHeight: '26px', color: 'var(--horosa-accent-strong)' }}>{pGlyph(yl.rulerKey)}</div>
									<div style={{ fontSize: 13, fontWeight: 700, color: 'var(--horosa-accent-strong)' }}>{yl.rulerCn}</div>
								</div>
							</div>
						) : null}
						{yl && gov ? (
							<div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 8 }}>
								本盘上升 {MODALITY_CN[yl.modality] || ''}星座 · {rulesetConfig(extra.mundaneRuleset).label} → 主管约 <b>{gov.spanMonths}</b> 个月。
								{gov.needSeasonal && gov.needSeasonal.length ? (<div style={{ marginTop: 3 }}>季度递归 → 须再起 <b>{gov.needSeasonal.map((sk) => SEASON_INGRESS_CN[sk] || sk).join(' / ')}</b> 入境盘各管一季。</div>) : null}
								<div style={{ marginTop: 3, fontSize: 11, color: 'var(--horosa-text-secondary)' }}>{gov.note}</div>
							</div>
						) : null}
						<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginTop: 10, lineHeight: '16px' }}>年主星即入宫盘上升座之域主星，主导该年/季世俗主题；再综合四轴、十宫（政权）、各宫主星状态论断。</div>
					</div>
				) : (
					<div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)' }}>左栏选年份与入宫节气，点「排入宫盘」按精确入宫时刻起盘。春分白羊入宫盘 = 该年年盘。</div>
				)}
			</div>
		);
	},

	renderLunationCard(chart, extra, type){
		const facts = chart ? safeFacts(chart) : null;
		const moon = facts && facts.planets ? facts.planets.moon : null;
		const sg = moon && moon.sign ? SIGNS[moon.sign] : null;
		const title = type === 'newmoon' ? '新月图' : '满月图';
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: type === 'newmoon' ? '#555' : '#b8860b', borderRadius: 2, display: 'inline-block' }} />{title}</div>
				{extra.selectedMoment ? (
					<div>
						<div style={{ fontSize: 12.5, marginBottom: 6 }}>时刻 <b>{extra.selectedMoment}</b></div>
						{sg ? <div style={{ fontSize: 12.5 }}>月亮 <span style={{ color: ELEMENT_COLOR[sg.element] }}>{sGlyph(moon.sign)} {sg.cn}</span>{moon.house ? ` · 第${moon.house}宫（${MUNDANE_HOUSE_MEANINGS[moon.house]}）` : ''}</div> : null}
						<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginTop: 8, lineHeight: '16px' }}>{type === 'newmoon' ? '新月（日月合相）影响约一个月，主新启与变动；' : '满月（日月对分）影响约一个月，主成熟与张力；'}与当季入宫盘对照（入宫为时针、朔望为分针）。</div>
					</div>
				) : (<div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)' }}>左栏扫描并选取一个{type === 'newmoon' ? '新月' : '满月'}时刻起盘。</div>)}
			</div>
		);
	},

	renderEclipseCard(chart, extra, type){
		const facts = chart ? safeFacts(chart) : null;
		const kind = type === 'lunecl' ? 'lunar' : 'solar';
		const rcfg = rulesetConfig((extra || {}).mundaneRuleset);   // 规则集:orbScheme 定受冲容许度、eclipseTiming 定是否示食时长定则
		// 判读容许度页面级覆盖(显示设置):auto=随流派(零回归);moiety/by_aspect 显式压过流派值。
		const effOrbScheme = (extra && extra.mundaneOrbScheme && extra.mundaneOrbScheme !== 'auto') ? extra.mundaneOrbScheme : rcfg.orbScheme;
		const ec = facts ? describeEclipse(facts, kind) : null;
		const aff = facts ? describeEclipseAfflictions(facts, kind, effOrbScheme) : null;
		const sg = ec && ec.sign ? SIGNS[ec.sign] : null;
		const title = type === 'lunecl' ? '月食图' : '日食图';
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#7a3b8a', borderRadius: 2, display: 'inline-block' }} />{title}</div>
				{extra.selectedMoment && ec ? (
					<div>
						<div style={{ fontSize: 12.5, marginBottom: 6 }}>时刻 <b>{extra.selectedMoment}</b>{extra.eclipseTypeText ? ` · ${extra.eclipseTypeText}` : ''}</div>
						<div style={{ fontSize: 12.5 }}>{ec.luminaryCn} <span style={{ color: sg ? ELEMENT_COLOR[sg.element] : undefined }}>{sg ? <>{sGlyph(ec.sign)} {sg.cn}</> : ec.sign}</span> · {ec.decanLabel}{ec.house ? ` · 第${ec.house}宫` : ''}</div>
						{ec.elementText ? <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 8, lineHeight: '17px' }}>元素：{ec.elementText}</div> : null}
						{ec.decanText ? <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 4, lineHeight: '17px' }}>分度：{ec.decanText}</div> : null}
						{aff && aff.afflictors.length ? (<div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 6, lineHeight: '17px' }}>受冲行星：{aff.afflictors.map((a) => (<span key={a.planet} style={{ color: a.malefic ? 'var(--horosa-jx-xiong, #c0392b)' : 'inherit', marginRight: 7 }}>{pGlyph(a.planet)}{a.cn}{a.aspect}({a.orb}°){a.malefic ? '⚠' : ''}</span>))}<span style={{ color: 'var(--horosa-text-secondary)' }}>定受影响主题</span></div>) : null}
						{(() => {
							const lp = facts && facts.planets ? facts.planets[kind === 'lunar' ? 'moon' : 'sun'] : null;
							if(!lp || lp.lon == null){ return null; }
							const year = (extra && extra.scanYear) || currentYear();
							const hits = mundaneFixedStarHits([{ key: 'eclipse', cn: '食点', lon: lp.lon }], year, 1.5);
							return hits.length ? (<div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 6, lineHeight: '17px' }}>食点近恒星：{hits.map((h, i) => (<span key={i} style={{ color: /凶|失|暴|灾/.test(h.meaning || '') ? 'var(--horosa-jx-xiong, #c0392b)' : 'inherit', marginRight: 7 }}>{h.starCn}{h.royal ? `(王星·${h.royal})` : ''}（{h.nature} {h.orb}°）</span>))}<span style={{ color: 'var(--horosa-text-secondary)' }}>恒星临食点增其象</span></div>) : null;
						})()}
						{rcfg.eclipseTiming !== 'none' && this.state.eclipseDetail && this.state.eclipseDetail.durationHours ? (
							<div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 8, lineHeight: '17px' }}>时长：约 <b>{this.state.eclipseDetail.durationHours}</b> 小时 → 影响约 <b>{this.state.eclipseDetail.influence}</b> {this.state.eclipseDetail.influenceUnit}（食时长定则）。</div>
						) : null}
						<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 8 }}>食以可见地区最应；{rcfg.eclipseTiming !== 'none' ? '日食时长→影响年数、月食时长→影响月数。' : '本规则集（周期派）不采食时长定则,以周期相位为主。'}</div>
					</div>
				) : (<div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)' }}>左栏扫描并选取一个{title}时刻起盘。</div>)}
			</div>
		);
	},

	renderRegionCard(chart, extra){
		const facts = chart ? safeFacts(chart) : null;
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: '#2c7fb8', borderRadius: 2, display: 'inline-block' }} />地区盘 · 12 世俗宫{extra.regionCn ? ` · ${extra.regionCn}` : ''}</div>
				{facts && facts.houses ? (
					<div>
						{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => {
							const hi = facts.houses[h];
							const occKeys = (hi && hi.planets || []).filter((k) => MUN_PLANET_CN[k]);
							const sg = hi && hi.sign ? SIGNS[hi.sign] : null;
							return (
								<div key={h} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', borderTop: h > 1 ? '1px solid rgba(128,128,128,0.06)' : 'none', fontSize: 11.5 }}>
									<span style={{ width: 22, color: 'var(--horosa-text-secondary)', fontWeight: 700 }}>{h}</span>
									<span style={{ flex: 1 }}>{MUNDANE_HOUSE_MEANINGS[h]}</span>
									<span style={{ width: 74, textAlign: 'right', opacity: 0.85, display: 'inline-flex', gap: 3, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>{sg ? sGlyph(hi.sign) : null}{occKeys.map((k, ix) => <span key={ix}>{pGlyph(k)}</span>)}</span>
								</div>
							);
						})}
						<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 8 }}>各宫义结合宫内行星与宫主星状态论该地区相关事务。</div>
					</div>
				) : (<div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)' }}>左栏选择或添加地区盘起盘。</div>)}
			</div>
		);
	},

	renderAge(age, i){
		const col = ELEMENT_COLOR[age.element] || '#888';
		const triads = [];
		for(let k = 0; k < age.conjs.length; k += 3){ triads.push(age.conjs.slice(k, k + 3)); }
		return (
			<div key={i} style={{ border: '1px solid rgba(128,128,128,0.14)', borderLeft: `3px solid ${col}`, borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: ELEMENT_BG[age.element] }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<span style={{ fontSize: 17 }}>{sGlyph(age.leadingSignKey)}</span>
						<span style={{ fontSize: 14, fontWeight: 700 }}>{age.leadingCn}时代</span>
						<span style={{ fontSize: 11, color: col, border: `1px solid ${col}`, borderRadius: 4, padding: '0 5px', opacity: 0.9 }}>{ELEMENT_CN[age.element]}</span>
					</div>
					<span style={{ fontSize: 12, fontWeight: 600, color: col }}>{dignityText(age.dignities)}</span>
				</div>
				<div style={{ padding: '4px 12px 8px' }}>
					{triads.map((triad, ti) => {
						const ph = triadPhase(triad, age.element);
						const pcol = ELEMENT_COLOR[ph.el] || col;
						return (
							<div key={ti}>
								<div style={{ fontSize: 11, color: pcol, fontWeight: 600, margin: ti ? '8px 0 2px' : '4px 0 2px', letterSpacing: '0.05em' }}>{ph.label}</div>
								{triad.map((g, j) => {
									const sg = SIGNS[SIGN_KEYS[g.sign]] || {};
									const el = sg.element || 'earth';
									const transit = el !== age.element;
									const deg = g.lon != null ? `${(g.lon % 30).toFixed(1)}°` : '';
									return (
										<div key={j} {...pressable(() => this.castConjunction(g))} title="点击按此会合精确时刻起事件盘" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2.5px 0', fontSize: 12.5, borderTop: j ? '1px solid rgba(128,128,128,0.06)' : 'none', cursor: 'pointer' }}>
											<span style={{ width: 76, color: 'var(--horosa-text-secondary)', whiteSpace: 'nowrap' }}>{yearLabel(g.year)}-{String(g.month).padStart(2, '0')}</span>
											<span style={{ flex: 1, whiteSpace: 'nowrap' }}>
												<span style={{ color: ELEMENT_COLOR[el], marginRight: 4 }}>{sGlyph(SIGN_KEYS[g.sign])}</span>{sg.cn}
												{transit ? <span style={{ fontSize: 10, color: 'var(--horosa-text-secondary)', marginLeft: 6 }}>过渡</span> : null}
											</span>
											<span style={{ width: 46, textAlign: 'right', color: 'var(--horosa-text-secondary)' }}>{deg}<span style={{ marginLeft: 5, color: 'var(--horosa-text-secondary)' }}>›</span></span>
										</div>
									);
								})}
							</div>
						);
					})}
				</div>
			</div>
		);
	},
};
