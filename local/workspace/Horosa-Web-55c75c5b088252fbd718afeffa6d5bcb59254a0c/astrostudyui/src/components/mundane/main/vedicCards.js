// 世运盘 · 右栏吠陀世俗卡、世俗卜卦、征兆与沙罗周期卡
// 从 MundaneMain.js 按职责拆出的 MundaneMain 方法:this 仍是 MundaneMain 实例,门面里 mixinMethods(MundaneMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { Fragment } from 'react';
import { Input } from 'antd';
import { XQSelect, XQButton } from '../../xq-ui';
import PlusMinusTime from '../../astro/PlusMinusTime';
import TimeFieldTrigger from '../../comp/QuickTimeField';
import DateTime from '../../comp/DateTime';
import { SIGNS } from '../../../divination/data/signs';
import { buildFacts } from '../../../divination/engine/chartFacts';
import { describeSarosFamily } from '../../../divination/mundane/saros';
import { PLANET_CN_V, vimshottariFromMoon, kpSubLordAt, KP_NOTES, NAKSHATRA_27, NAK_KEYPOINTS, GARBHA_CONST, GARBHA_OMENS, garbhaDeliveryDate, buildSaptaNadi, SAPTA_NADI_COLS, SAPTA_NADI_READING, ARGHA_RULES, TRANSIT_RULES, ECLIPSE_VEDIC_RULES, KURMA_MODERN, KURMA_DISCLAIMER, munthaSign } from '../../../divination/mundane/vedicMundane';
import { MUNDANE_HORARY_KINDS, describeWarQuestion, describeWeatherQuestion, describePriceQuestion } from '../../../divination/mundane/mundaneHorary';
import { ECLIPSE_COLOR_OMEN, ECLIPSE_COLOR_NOTE, COMET_OMEN, WEATHER_OMENS, OMEN_STRUCTURE_NOTE, describeQuadrantNations } from '../../../divination/mundane/omenology';
import { datePartOf } from '../../../utils/dateStrSafe';
import { segmentIndex } from '../../../utils/segmentIndex';
import { pressable } from '../../../utils/pressable';
import { norm360m, pGlyph, sGlyph, currentYear, safeFacts } from './tables';
import { CARD, CARD_TITLE, userSetExtra } from './cards';
const Option = XQSelect.Option;

export const vedicCardMethods = {
	// 吠陀世运六卡。年度盘概览:入境时刻+Muntha+月宿。
	renderVedicOverview(chart, extra){
		const VACC = '#8d6e63';
		let moonNak = null;
		try{
			const facts = chart ? buildFacts(chart) : null;
			const m = facts && facts.planets ? facts.planets.moon : null;
			if(m && m.lon != null){ const i = segmentIndex(norm360m(m.lon), 13 + 20 / 60, 27); moonNak = { idx: i, cn: NAKSHATRA_27[i], key: NAK_KEYPOINTS[i] || null }; }
		}catch(e){ moonNak = null; }
		const age = (extra.vedicFoundingYear != null) ? Math.max(0, (extra.vedicYear || currentYear()) - extra.vedicFoundingYear) : null;
		const muntha = (age != null && extra.vedicNatalAsc) ? munthaSign(extra.vedicNatalAsc, age) : null;
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: VACC, borderRadius: 2, display: 'inline-block' }} />吠陀世运 · 年度盘</div>
				<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginBottom: 8, lineHeight: '17px' }}>梅沙入境（恒星太阳过 0° 恒星白羊,约 4 月 13–14）为首都起盘=年度主盘;季盘入恒星巨蟹/天秤/摩羯。全程恒星黄道 Lahiri。国家以建国盘当本命,其返照辅助年度盘。</div>
				{this.state.vedicMoment ? <div style={{ fontSize: 12.5 }}>当前入境时刻：<b style={{ color: VACC }}>{this.state.vedicMoment}</b></div> : <div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)' }}>左栏点「排梅沙入境」求根起年度主盘。</div>}
				{moonNak ? (
					<div style={{ fontSize: 12.5, marginTop: 6 }}>盘中月宿：<b style={{ color: VACC }}>{moonNak.cn}</b>（第 {moonNak.idx + 1} 宿）{moonNak.key ? <span style={{ color: 'var(--horosa-jx-xiong, #c0392b)', marginLeft: 6 }}>{moonNak.key}</span> : null}</div>
				) : null}
				{muntha ? (
					<div style={{ fontSize: 12.5, marginTop: 6 }}>Muntha 敏感点：<b style={{ color: VACC }}>{sGlyph(muntha)} {(SIGNS[muntha] || {}).cn}</b><span style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginLeft: 6 }}>（建国上升每年顺进一座,盘龄 {age}）</span></div>
				) : <div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginTop: 6 }}>左栏填建国年+建国上升座 → 得 Muntha 敏感点(每年进一座)。</div>}
				<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 8, lineHeight: '15px' }}>返照体系(太阳回本命恒星经度/回本命座+月回本命日月相)以建国盘为本命另排,与本年度盘互参;年主评分体系见传统五重力法。</div>
			</div>
		);
	},

	// 九主 3×3 卡片网格:每职行星 glyph+吉凶色+领域;兼职冲突高亮。
	renderVedicNavanayaka(extra){
		const nv = (this.state.navanayaka && this.state.navanayakaYear === (extra.vedicYear || currentYear())) ? this.state.navanayaka : null;
		const VACC = '#8d6e63';
		const BEN = ['jupiter', 'venus', 'mercury'];
		if(!nv){
			return (<div style={CARD}><div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: VACC, borderRadius: 2, display: 'inline-block' }} />年之九主</div><div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)' }}>左栏点「计算年之九主」——按九事件（阴历年首+八次恒星入境）所在星期之主定各职。</div></div>);
		}
		const multi = Object.keys(nv.byLord).filter((k) => nv.byLord[k].length > 1);
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: VACC, borderRadius: 2, display: 'inline-block' }} />年之九主 · {this.state.navanayakaYear}</div>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
					{nv.offices.map((o) => {
						const good = o.lord && BEN.indexOf(o.lord) >= 0;
						const isMulti = o.lord && nv.byLord[o.lord] && nv.byLord[o.lord].length > 1;
						return (
							<div key={o.key} style={{ border: `1px solid ${isMulti ? '#c0392b55' : 'rgba(128,128,128,0.15)'}`, borderTop: `3px solid ${o.lord ? (good ? 'var(--horosa-jx-ji, #16a085)' : 'var(--horosa-jx-xiong, #c0392b)') : 'rgba(128,128,128,0.3)'}`, borderRadius: 7, padding: '6px 8px', textAlign: 'center' }}>
								<div style={{ fontSize: 12, fontWeight: 700 }}>{o.cn}{o.cnVariant ? <span style={{ fontSize: 9.5, color: 'var(--horosa-text-secondary)' }}>/{o.cnVariant}</span> : null}</div>
								<div style={{ fontSize: 18, margin: '2px 0', color: o.lord ? (good ? 'var(--horosa-jx-ji, #16a085)' : 'var(--horosa-jx-xiong, #c0392b)') : undefined }}>{o.lord ? pGlyph(o.lord) : '—'}</div>
								<div style={{ fontSize: 10.5, opacity: 0.7 }}>{o.lord ? (PLANET_CN_V[o.lord] || o.lord) : '待定'}{isMulti ? ' ·兼' : ''}</div>
								<div style={{ fontSize: 9.5, color: 'var(--horosa-text-secondary)', lineHeight: '13px', marginTop: 2 }}>{o.domain}</div>
							</div>
						);
					})}
				</div>
				{multi.length ? (
					<div style={{ fontSize: 11.5, marginBottom: 4 }}>兼职：{multi.map((k) => `${PLANET_CN_V[k] || k} 兼 ${nv.byLord[k].join('/')}`).join('；')}</div>
				) : null}
				{nv.readings.map((t, i) => (<div key={i} style={{ fontSize: 11.5, lineHeight: '18px', color: t.indexOf('⚠') === 0 ? 'var(--horosa-jx-xiong, #c0392b)' : undefined }}>{t}</div>))}
				<div style={{ fontSize: 10, color: 'var(--horosa-text-secondary)', marginTop: 8, lineHeight: '14px' }}>吉星(木金水)任职→该领域佳;凶星(土火日)→歉/灾。九主属后世历书传统(非出自某一原典);完整历书另有约 21 子职,此处列九主。王取阴历年首朔日(以入境前最近新月近似)。</div>
			</div>
		);
	},

	// 世运 Vimshottari:以盘月起运,大期时间轴+子期。
	renderVedicDasha(chart, extra){
		const VACC = '#8d6e63';
		let r = null;
		try{
			const facts = chart ? buildFacts(chart) : null;
			const m = facts && facts.planets ? facts.planets.moon : null;
			const startStr = this.state.vedicMoment ? datePartOf(this.state.vedicMoment) : `${extra.vedicYear || currentYear()}-04-14`;
			if(m && m.lon != null){ r = vimshottariFromMoon(m.lon, startStr, extra.vedicDashaYearLen === 360 ? 360 : 365.2425); }
		}catch(e){ r = null; }
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: VACC, borderRadius: 2, display: 'inline-block' }} />世运大运（Vimshottari）</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
					<span style={{ fontSize: 11.5, color: 'var(--horosa-text-secondary)' }}>年长口径</span>
					{/* 显示值只读 extra(唯一真值源):此前优先读组件内缓存 `_vdy`,而载入事盘时壳在
					    didUpdate 里覆盖 extra、世俗组件并不重挂载 → 旧的 `_vdy` 残留,下拉显示的口径与实际计算用的分叉。 */}
					<XQSelect size="small" style={{ width: 140 }} value={extra.vedicDashaYearLen === 360 ? 360 : 365.2425}
						onChange={(v) => { if(this._setExtra){ userSetExtra(this._setExtra, { vedicDashaYearLen: v }); } }}>
						<Option value={365.2425}>365.2425（现代）</Option>
						<Option value={360}>360（传统）</Option>
					</XQSelect>
				</div>
				{!r ? <div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)' }}>先排年度盘（或任一吠陀盘）——以盘中恒星月亮所在宿起运。</div> : (
					<Fragment>
						<div style={{ fontSize: 11.5, opacity: 0.7, marginBottom: 6 }}>起运主 {PLANET_CN_V[r.lordKey]}（月在第 {r.nakIdx + 1} 宿,余额 {(r.balanceRatio * 100).toFixed(1)}%）· 九主合 120 年循环</div>
						{r.periods.map((p) => (
							<div key={p.key + p.fromYear} style={{ padding: '3px 0', borderTop: '1px solid rgba(128,128,128,0.06)' }}>
								<div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
									<span style={{ width: 30 }}>{pGlyph(p.key)}</span>
									<span style={{ width: 96, fontWeight: 600 }}>{p.cn} 大运</span>
									<span style={{ width: 96, color: 'var(--horosa-text-secondary)' }}>{p.fromYear}–{p.toYear}</span>
									<span style={{ flex: 1, opacity: 0.72, fontSize: 11 }}>{p.meaning}</span>
								</div>
							</div>
						))}
						<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 6 }}>子期=（子主年/120）×大期年;建国时刻常有争议,须与入境/食/会合/流运合参。</div>
					</Fragment>
				)}
			</div>
		);
	},

	// KP:各行星宿主/副主表。
	renderVedicKp(chart){
		const VACC = '#8d6e63';
		let rows = [];
		try{
			const facts = chart ? buildFacts(chart) : null;
			if(facts && facts.planets){
				['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].forEach((k) => {
					const p = facts.planets[k];
					if(p && p.lon != null){ const kp = kpSubLordAt(p.lon); rows.push({ k, ...kp }); }
				});
			}
		}catch(e){ rows = []; }
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: VACC, borderRadius: 2, display: 'inline-block' }} />KP 副主链（243 副）</div>
				{rows.length ? (
					<Fragment>
						<div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--horosa-text-secondary)', padding: '2px 0' }}>
							<span style={{ width: 52 }}>行星</span><span style={{ width: 72 }}>所在宿</span><span style={{ width: 88 }}>宿主(场域)</span><span style={{ width: 88 }}>副主(成败)</span>
						</div>
						{rows.map((r) => (
							<div key={r.k} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '2.5px 0', borderTop: '1px solid rgba(128,128,128,0.06)' }}>
								<span style={{ width: 52 }}>{pGlyph(r.k)} {PLANET_CN_V[r.k]}</span>
								<span style={{ width: 72, opacity: 0.7 }}>{NAKSHATRA_27[r.nakIdx]}</span>
								<span style={{ width: 88 }}>{PLANET_CN_V[r.starLord] || r.starLord}</span>
								<span style={{ width: 88, fontWeight: 600, color: VACC }}>{PLANET_CN_V[r.subLord] || r.subLord}</span>
							</div>
						))}
					</Fragment>
				) : <div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)' }}>先排盘。</div>}
				{KP_NOTES.map((t, i) => (<div key={i} style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', lineHeight: '15px', marginTop: i === 0 ? 8 : 2 }}>{t}</div>))}
			</div>
		);
	},

	// 天气农业:云之孕计算器+七潮盘表+物价规则。
	renderVedicWeather(extra){
		const VACC = '#8d6e63';
		const cols = buildSaptaNadi();
		const delivery = this.state.garbhaDate ? garbhaDeliveryDate(this.state.garbhaDate) : null;
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: VACC, borderRadius: 2, display: 'inline-block' }} />天气与农业</div>
				<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, marginBottom: 4 }}>云之孕（孕期固定 {GARBHA_CONST.gestationDays} 日）</div>
				<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', lineHeight: '16px', marginBottom: 6 }}>{GARBHA_CONST.note}</div>
				<div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
					<Input size="small" style={{ flex: '1 1 130px' }} placeholder="受孕日 YYYY-MM-DD" value={this.state.garbhaDate || ''}
						onChange={(e) => this.setState({ garbhaDate: e.target.value })} />
					{delivery ? <span style={{ fontSize: 12.5, alignSelf: 'center' }}>→ 预测降雨日 <b style={{ color: VACC }}>{delivery}</b></span> : null}
				</div>
				<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', lineHeight: '15px', marginBottom: 8 }}>{GARBHA_OMENS.good} {GARBHA_OMENS.bad}</div>
				<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, margin: '6px 0 4px' }}>七潮盘（自昴宿区蛇行 28 宿入 7 列）</div>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
					{SAPTA_NADI_COLS.map((c, ci) => (
						<div key={c.key} style={{ border: `1px solid ${c.tone === 'wet' ? '#2c7fb855' : '#c0392b40'}`, borderTop: `3px solid ${c.tone === 'wet' ? '#2c7fb8' : 'var(--horosa-jx-xiong, #c0392b)'}`, borderRadius: 6, padding: '4px 3px', textAlign: 'center' }}>
							<div style={{ fontSize: 10, fontWeight: 700 }}>{c.cn}</div>
							{cols[ci].map((n, i) => (<div key={i} style={{ fontSize: 9.5, color: 'var(--horosa-text-secondary)', lineHeight: '13px' }}>{n}</div>))}
						</div>
					))}
				</div>
				<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginBottom: 8 }}>{SAPTA_NADI_READING}</div>
				<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, margin: '6px 0 2px' }}>物价通则</div>
				<div style={{ fontSize: 11, opacity: 0.7, lineHeight: '17px' }}>商品配座（古籍例：金=白羊与摩羯）。{ARGHA_RULES.rule}</div>
			</div>
		);
	},

	// 过境/分野。
	renderVedicTransit(){
		const VACC = '#8d6e63';
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: VACC, borderRadius: 2, display: 'inline-block' }} />过境与分野</div>
				<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, marginBottom: 2 }}>土木过境通则</div>
				{TRANSIT_RULES.map((r, i) => (
					<div key={i} style={{ display: 'flex', gap: 8, fontSize: 11.5, padding: '2.5px 0', borderTop: '1px solid rgba(128,128,128,0.05)' }}>
						<span style={{ width: 170, fontWeight: 600 }}>{r.cn}</span>
						<span style={{ width: 80, color: 'var(--horosa-text-secondary)' }}>{r.span}</span>
						<span style={{ flex: 1, opacity: 0.75 }}>{r.effect}</span>
					</div>
				))}
				<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, margin: '8px 0 2px' }}>食与彗星</div>
				{ECLIPSE_VEDIC_RULES.map((t, i) => (<div key={i} style={{ fontSize: 11.5, lineHeight: '18px', opacity: 0.8 }}>· {t}</div>))}
				<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, margin: '8px 0 2px' }}>龟形分野（座级 · 古籍已给数例）</div>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
					{KURMA_MODERN.map((k) => (
						<span key={k.sign} style={{ fontSize: 11.5, border: '1px solid rgba(128,128,128,0.18)', borderRadius: 999, padding: '2px 9px' }}>{sGlyph(k.sign)} {(SIGNS[k.sign] || {}).cn} = {k.region}</span>
					))}
				</div>
				<div style={{ fontSize: 10, color: 'var(--horosa-text-secondary)', marginTop: 8, lineHeight: '14px' }}>⚠️ {KURMA_DISCLAIMER}</div>
			</div>
		);
	},

	// 问判卡:三类问对应判读。
	renderMundaneHoraryQuestion(chart, extra){
		if(!chart){ return null; }
		const facts = safeFacts(chart);
		if(!facts){ return null; }
		const kind = extra.mhKind || 'war';
		const ACC = '#9c5708';
		const scoreRow = (s, role) => s ? (
			<div style={{ padding: '4px 0', borderTop: '1px solid rgba(128,128,128,0.06)' }}>
				<div style={{ display: 'flex', gap: 8, fontSize: 12.5 }}>
					<span style={{ width: 132, fontWeight: 600 }}>{role}</span>
					<span style={{ width: 56 }}>{pGlyph(s.planet)} {s.cn}</span>
					<span style={{ width: 60, color: 'var(--horosa-text-secondary)' }}>{s.house ? `第${s.house}宫` : ''}</span>
					<span style={{ flex: 1, textAlign: 'right', fontWeight: 700, color: ACC }}>{s.total != null ? s.total : s.score}</span>
				</div>
				{s.items && s.items.length ? (
					<div style={{ fontSize: 10, color: 'var(--horosa-text-secondary)', paddingLeft: 140 }}>
						{s.items.map((it, i) => (<span key={i} style={{ marginRight: 7, color: it.v < 0 ? 'var(--horosa-jx-xiong, #c0392b)' : 'var(--horosa-jx-ji, #16a085)' }}>{it.cn} {it.v > 0 ? `+${it.v}` : it.v}</span>))}
					</div>
				) : null}
			</div>
		) : null;
		let body = null;
		if(kind === 'war'){
			const w = describeWarQuestion(facts);
			body = w ? (
				<Fragment>
					{scoreRow(w.us, w.us.role)}
					{scoreRow(w.them, w.them.role)}
					{w.moon ? scoreRow(w.moon, w.moon.role) : null}
					{w.reception ? <div style={{ fontSize: 12, color: 'var(--horosa-jx-ji, #16a085)', marginTop: 4 }}>双方主星互容 → 和解/盟约倾向。</div> : null}
					<div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 7, background: 'rgba(156,87,8,0.1)', fontSize: 12.5, fontWeight: 600, color: ACC }}>{w.verdict.text}</div>
					<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 6 }}>{w.note}</div>
				</Fragment>
			) : <div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)' }}>盘数据不足。</div>;
		}else if(kind === 'weather'){
			const wq = describeWeatherQuestion(facts);
			body = wq ? (
				<Fragment>
					<div style={{ fontSize: 12.5 }}>月所在宿：<b style={{ color: ACC }}>{wq.moonMansion || '—'}</b></div>
					<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, margin: '6px 0 2px' }}>临角行星</div>
					{wq.angular.length ? wq.angular.map((a) => (
						<div key={a.planet} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '2.5px 0' }}>
							<span style={{ width: 52 }}>{pGlyph(a.planet)} {a.cn}</span>
							<span style={{ width: 56, color: 'var(--horosa-text-secondary)' }}>第{a.house}宫</span>
							<span style={{ flex: 1, opacity: 0.75 }}>{a.text}</span>
						</div>
					)) : <div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)' }}>无行星临角。</div>}
					<div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 7, background: 'rgba(156,87,8,0.1)', fontSize: 12.5, fontWeight: 600, color: ACC }}>{wq.tone}</div>
					<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 6 }}>{wq.note}</div>
				</Fragment>
			) : <div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)' }}>盘数据不足。</div>;
		}else{
			const pq = describePriceQuestion(facts);
			body = pq ? (
				<Fragment>
					{pq.wealth.map((x) => scoreRow(x.strength, `第 ${x.house} 宫主（财货）`))}
					<div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 7, background: 'rgba(156,87,8,0.1)', fontSize: 12.5, fontWeight: 600, color: ACC }}>{pq.trend.text}</div>
					<div style={{ fontSize: 12, marginTop: 4, color: pq.cropRisk ? 'var(--horosa-jx-xiong, #c0392b)' : undefined }}>{pq.cropNote}</div>
					<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 6 }}>{pq.note}</div>
				</Fragment>
			) : <div style={{ fontSize: 12, color: 'var(--horosa-text-secondary)' }}>盘数据不足。</div>;
		}
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />世运问判 · {(MUNDANE_HORARY_KINDS.find((k) => k.key === kind) || {}).cn}</div>
				{body}
			</div>
		);
	},

	// 天象占参考卡(折叠):四象限四方(可算)+色占/彗星/大气天象查表。
	renderOmenologyCard(chart){
		const open = !!this.state.omenOpen;
		let quad = null;
		try{
			const facts = chart ? buildFacts(chart) : null;
			quad = facts ? describeQuadrantNations(facts) : null;
		}catch(e){ quad = null; }
		const ACC = 'var(--horosa-hue-brown)';
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />天象占参考</div>
				{quad ? (
					<div style={{ fontSize: 12.5, marginBottom: 6 }}>食落象限 → <b style={{ color: ACC }}>{quad.cn}</b><span style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginLeft: 6 }}>（{quad.span}）</span>
						<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 2 }}>{quad.note}</div>
					</div>
				) : null}
				<div style={{ fontSize: 11.5, cursor: 'pointer', color: ACC, userSelect: 'none' }}
					{...pressable(() => this.setState({ omenOpen: !open }))}>{open ? '▾' : '▸'} 色占 · 彗星 · 大气天象（查表参考）</div>
				{open ? (
					<div style={{ marginTop: 6 }}>
						<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, marginBottom: 2 }}>食/光体之色 → 行星效应</div>
						{ECLIPSE_COLOR_OMEN.map((c) => (
							<div key={c.color} style={{ display: 'flex', gap: 8, fontSize: 11.5, padding: '2px 0', borderTop: '1px solid rgba(128,128,128,0.05)' }}>
								<span style={{ width: 72, fontWeight: 600 }}>{c.color}</span>
								<span style={{ width: 40 }}>{pGlyph(c.planet)} {c.cn}</span>
								<span style={{ flex: 1, opacity: 0.75 }}>{c.effect}</span>
							</div>
						))}
						<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', margin: '2px 0 6px' }}>{ECLIPSE_COLOR_NOTE}</div>
						<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, marginBottom: 2 }}>彗星</div>
						<div style={{ fontSize: 11.5, opacity: 0.75, lineHeight: '17px' }}>{COMET_OMEN.nature}</div>
						{COMET_OMEN.rules.map((r, i) => (<div key={i} style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', lineHeight: '16px' }}>· {r}</div>))}
						<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, margin: '6px 0 2px' }}>大气天象</div>
						{WEATHER_OMENS.map((w) => (
							<div key={w.key} style={{ fontSize: 11, lineHeight: '16px', padding: '1.5px 0' }}><b style={{ opacity: 0.8 }}>{w.cn}</b>：<span style={{ opacity: 0.7 }}>{w.text}</span></div>
						))}
						<div style={{ fontSize: 10, color: 'var(--horosa-text-secondary)', marginTop: 6, lineHeight: '14px' }}>{OMEN_STRUCTURE_NOTE}</div>
					</div>
				) : null}
			</div>
		);
	},

	// 食族卡:交点性质(可算)+三周期数据+族生命周期+判读四步+首食盘手动入口;
	// 族号对照表系文档缺口——TODO 注明,不臆造。
	renderSarosCard(chart){
		if(!chart){ return null; }
		let r = null;
		try{ r = describeSarosFamily(buildFacts(chart)); }catch(e){ r = null; }
		if(!r){ return null; }
		const ACC = 'var(--horosa-hue-purple)';
		const goFirstEclipse = () => {
			const txt = String(this.state.sarosFirstDate || '').trim();
			// 日期选择器本来就能选公元前(DateTime 格式化出 `-500-03-01`),DateTime.parse 也早就认
			// 首字符 `-` 与 1–4 位年;卡在这道正则上 —— 它既不收负号也不收三位以下的年,于是公元前与公元 1–99 年
			// 点「按该日起盘」恒报「日期格式 YYYY-MM-DD」、盘纹丝不动(必失败路径)。
			if(!/^-?\d{1,4}-\d{1,2}-\d{1,2}$/.test(txt)){ this.setState({ sarosErr: '日期格式 YYYY-MM-DD(公元前写成 -500-03-01)' }); return; }
			try{
				const dt = new DateTime();
				const fields = this._fields;
				if(fields && fields.zone && fields.zone.value){ dt.setZone(fields.zone.value); }
				const parsed = dt.parse ? dt.parse(txt + ' 12:00:00', 'YYYY-MM-DD HH:mm:ss') : null;
				if(parsed && this._setTime){ this.setState({ sarosErr: '' }); this._setTime(parsed); }
				else{ this.setState({ sarosErr: '日期解析失败' }); }
			}catch(e){ this.setState({ sarosErr: '日期解析失败' }); }
		};
		return (
			<div style={CARD}>
				<div style={CARD_TITLE}><span style={{ width: 3, height: 14, background: ACC, borderRadius: 2, display: 'inline-block' }} />食族 Saros</div>
				<div style={{ fontSize: 13.5, fontWeight: 600, color: ACC, marginBottom: 2 }}>{r.node.cn}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--horosa-text-secondary)', marginLeft: 8 }}>月距交点 {r.node.distToNode.toFixed(1)}°</span></div>
				<div style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginBottom: 8, lineHeight: '16px' }}>{r.numberingNote}</div>
				<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, margin: '4px 0 2px' }}>三周期数据</div>
				<div style={{ fontSize: 11.5, lineHeight: '19px' }}>
					<div>Saros：{r.constTable.sarosSynodicMonths} 朔望月 = {r.constTable.sarosDays} 日 = {r.constTable.sarosLabel}</div>
					<div>Metonic：{r.constTable.metonicYears} 年 = {r.constTable.metonicSynodicMonths} 朔望月（{r.constTable.metonicNote}）</div>
					<div>Inex：{r.constTable.inexSynodicMonths} 朔望月 ≈ {r.constTable.inexDays} 日（{r.constTable.inexNote}）</div>
				</div>
				<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, margin: '8px 0 2px' }}>族生命周期</div>
				<div style={{ fontSize: 11.5, lineHeight: '18px', opacity: 0.8 }}>
					每族 {r.lifecycle.membersRange.join('–')} 次食 · {r.lifecycle.stepYears} · {r.lifecycle.eclipticShiftDeg || r.lifecycle.westShiftDeg}
					{r.lifecycle.phases.map((p) => (<div key={p.key}><b>{p.cn}</b>：{p.note}</div>))}
				</div>
				<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, margin: '8px 0 2px' }}>判读四步</div>
				{r.steps.map((s, i) => (<div key={i} style={{ fontSize: 11.5, lineHeight: '18px', opacity: 0.8 }}>{s}</div>))}
				<div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed rgba(128,128,128,0.15)' }}>
					<div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.7, marginBottom: 4 }}>首食盘入口</div>
					<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
						{/* 点选式日期(与主时间同款调时器,不逼手输;仍可后续微调) */}
						<TimeFieldTrigger showIcon={false} placement="left" style={{ flex: '1 1 130px' }}
							value={(() => { const dt = new DateTime(); if(this._fields && this._fields.zone && this._fields.zone.value){ dt.setZone(this._fields.zone.value); } return dt; })()}
							timeText={this.state.sarosFirstDate || '点选首食日期'}
							popoverContent={(
								<div className="horosa-time-popover">
									<PlusMinusTime
										value={(() => { const dt = new DateTime(); if(this._fields && this._fields.zone && this._fields.zone.value){ dt.setZone(this._fields.zone.value); } if(this.state.sarosFirstDate && dt.parse){ const p = dt.parse(this.state.sarosFirstDate + ' 12:00:00', 'YYYY-MM-DD HH:mm:ss'); if(p){ return p; } } return dt; })()}
										onChange={(res) => { const dt = res && res.time; if(dt && dt.format){ this.setState({ sarosFirstDate: dt.format('YYYY-MM-DD'), sarosErr: '' }); } }} />
								</div>
							)}
							onQuickCommit={(dt) => { this.setState({ sarosFirstDate: dt.format('YYYY-MM-DD'), sarosErr: '' }); }} />
						<XQButton size="small" onClick={goFirstEclipse}>按该日起盘</XQButton>
					</div>
					{this.state.sarosErr ? <div style={{ fontSize: 11, color: 'var(--horosa-jx-xiong, #c0392b)', marginTop: 3 }}>{this.state.sarosErr}</div> : null}
				</div>
				<div style={{ fontSize: 10.5, color: 'var(--horosa-text-secondary)', marginTop: 8, lineHeight: '15px' }}>⚠️ {r.tableTodo}</div>
			</div>
		);
	},
};
