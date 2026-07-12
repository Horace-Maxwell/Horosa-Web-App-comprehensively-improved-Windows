// components/astro/AstroEgypt.js
// 埃及占星页(本命「埃及」tab):36 旬名录/旬星塔罗/对角星钟/护符/数字占/吉凶日/星名。
// 纯前端派生,读 chartObj 取上升与行星落旬;零后端、零回归(仅新增 tab)。
// 内部 XQTabs 承 E1/E4-E9;E2/E3 轻量扩展(民用历 Sothic / 占星地理)。
import { Component } from 'react';
import { Input } from 'antd';
import { astroSymbol, cardStyle, SmallTable } from './AstroExtraCommon';
import { XQTabs, XQSectionTitle } from '../xq-ui';
import { SIGNS, SIGN_ORDER } from '../../divination/data/signs';
import {
	EGYPT_DECANS, TAROT_SUIT_CN, TAROT_SUIT_ELEMENT, greekDecan,
	EGYPT_PLANET_NAMES, EGYPT_STAR_NAMES,
	EGYPT_EPAGOMENAL, SOTHIC_CYCLE_YEARS, egyptCivilMonths,
	diagonalStar, DIAGONAL_NOTE,
	decanBodyPart, talismanByDecan,
	GREEK_ISOPSEPHY, isopsephy, pythmen, petosirisRemainder, petosirisVerdict,
	HEMEROLOGY_PARTS, HEMEROLOGY_MARKS, HEMEROLOGY_NOTE,
	CHOROGRAPHY_QUARTERS, CHOROGRAPHY_REGIONS,
} from '../../divination/data/egyptianData';

// jest partial-mock 防御:本文件因 buildEgyptSectionLines 被 astroAiSnapshot 引入更多测试模块链,
// 个别套件对 xq-ui 做部分 mock(XQTabs=undefined)→ 顶层取值炸整链。可选链兜底:mock 环境只调
// 纯函数不渲染组件;生产 XQTabs 恒真,行为零差。
const TabPane = (XQTabs || {}).TabPane;
const norm360 = (x) => ((x % 360) + 360) % 360;
const sn = (s) => (SIGNS[s] && SIGNS[s].cn) || s || '-';
// 座 glyph 走项目 ywastro 字体(同行星 glyph),而非 Unicode 星座符号(系统会渲成彩色 emoji)。
// astroSymbol 以 AstroConst 大写 id(如 'Aries')为键取 AstroMsg;signs.js 的 .en 即该键。
const sgKey = (s) => (SIGNS[s] && SIGNS[s].en) || s;
const sg = (s) => astroSymbol(sgKey(s));

const POINT_IDS = ['Asc', 'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'MC'];
const POINT_CN = { Asc: '上升', Sun: '日', Moon: '月', Mercury: '水', Venus: '金', Mars: '火', Jupiter: '木', Saturn: '土', MC: '中天' };

// 从 chartObj 取各点黄经
function pointsFrom(chartObj){
	const byId = {};
	if(chartObj && chartObj.chart){
		(chartObj.chart.objects || []).forEach((o) => { if(o && o.id) byId[o.id] = o; });
		(chartObj.chart.angles || []).forEach((a) => { if(a && a.id) byId[a.id] = a; });
	}
	const out = [];
	POINT_IDS.forEach((id) => {
		const o = byId[id];
		if(o && o.lon != null) out.push({ id, lon: norm360(o.lon) });
	});
	return out;
}

/* ============================================================
 * AI 导出:埃及历派生段(纯函数,零 React/零渲染依赖;组件行为不变)
 * ------------------------------------------------------------
 * 只导「本盘命中/派生值」:各点落旬(旬环+旬塔罗的本盘命中口径)+ 上升旬详情(名录/塔罗/护符)。
 * 36 旬全库名录、对角星钟全表(纯授时表,不吃 chartObj)、数字占(需手动输入希腊字母名)、
 * 吉凶日结构、星名对照、民用历结构均属静态参考陈列 → 不入导出。
 * 供 utils/astroAiSnapshot buildAstroSnapshotContent 拼[埃及历]段;数据缺 → 返回 [] 不产段。
 * ============================================================ */
export function buildEgyptSectionLines(chartObj){
	const lines = [];
	const pts = pointsFrom(chartObj);
	if(!pts.length){
		return lines;
	}
	// ◆ 各行星落旬:逐点 旬序/旬位/埃及名/面主 + 旬星塔罗(与 renderDecanRing/renderTarot 本盘列同源同算)
	lines.push('◆ 各行星落旬');
	pts.forEach((p) => {
		const d = EGYPT_DECANS[greekDecan(p.lon) - 1];
		if(!d) return;
		lines.push(`${POINT_CN[p.id] || p.id}：第${d.greek}旬 ${sn(d.signId)}${d.decanInSign}(${d.range})·埃及名 ${d.egyptName}·面主${POINT_CN[d.face] || d.face}·塔罗${TAROT_SUIT_CN[d.tarotSuit]}${d.tarotPip}「${d.tarotTitle}」`);
	});
	// ◆ 上升旬详情:上升所落旬完整派生(跨流派旬名/原位序/星认定/塔罗含义/护符 melothesia),
	// 与页首「当前上升旬」卡 + 名录/护符高亮行同源(ascDecanIdx 同一 greekDecan 算法)。
	const asc = pts.find((p) => p.id === 'Asc');
	const ad = asc ? EGYPT_DECANS[greekDecan(asc.lon) - 1] : null;
	if(ad){
		lines.push('◆ 上升旬详情');
		lines.push(`第${ad.greek}旬 ${sn(ad.signId)}${ad.decanInSign}(${ad.range})·原位(古代恒星序)第${ad.ancient}旬·星认定 ${ad.star}`);
		lines.push(`旬名：埃及名 ${ad.egyptName} / 科普特-希腊名 ${ad.copticGreek} / 赫尔墨斯名 ${ad.hermesName};面主${POINT_CN[ad.face] || ad.face}`);
		lines.push(`塔罗：${TAROT_SUIT_CN[ad.tarotSuit]}${ad.tarotPip}(${TAROT_SUIT_ELEMENT[ad.tarotSuit]})「${ad.tarotTitle}」——${ad.tarotMeaning}`);
		const tal = talismanByDecan(ad.greek);
		if(tal){
			lines.push(`护符：秘名 ${tal.secretName};身体部位 ${tal.bodyPart};主管疾病 ${tal.disease}`);
		}
	}
	return lines;
}

class AstroEgypt extends Component {
	constructor(props){
		super(props);
		this.state = { nameInput: '', lunarDay: 1, petosirisMod: 29 };
	}

	// 当前上升所落旬序(回归)
	ascDecanIdx(){
		const pts = pointsFrom(this.props.value);
		const asc = pts.find((p) => p.id === 'Asc');
		return asc ? greekDecan(asc.lon) : null;
	}

	// 各点落旬映射 {greekIdx: [pointId...]}
	pointDecans(){
		const map = {};
		pointsFrom(this.props.value).forEach((p) => {
			const g = greekDecan(p.lon);
			(map[g] = map[g] || []).push(p.id);
		});
		return map;
	}

	/* ---------- 36 旬环(仿 termBand,HTML/CSS 网格,不动 SVG) ---------- */
	renderDecanRing(){
		const ascIdx = this.ascDecanIdx();
		const pmap = this.pointDecans();
		return (
			<div style={cardStyle}>
				<XQSectionTitle>三十六旬环</XQSectionTitle>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 2, marginTop: 8 }}>
					{EGYPT_DECANS.map((d) => {
						const isAsc = d.greek === ascIdx;
						const has = pmap[d.greek];
						return (
							<div key={d.greek}
								title={`${sn(d.signId)}${d.decanInSign} ${d.range} · ${d.egyptName}`}
								style={{
									border: '1px solid var(--horosa-border-soft, rgba(148,163,184,.3))',
									borderRadius: 4,
									padding: '4px 1px',
									textAlign: 'center',
									fontSize: 10,
									// 12 列在窄右栏极挤;min-width:0 + overflow 防 glyph/文字出血(不出卡)。
									minWidth: 0,
									overflow: 'hidden',
									background: isAsc ? 'var(--horosa-accent-soft, rgba(245,158,11,.22))' : 'var(--horosa-surface, rgba(255,255,255,.5))',
									boxShadow: isAsc ? '0 0 0 1px var(--horosa-accent, #f59e0b) inset' : 'none',
								}}>
								<div style={{ opacity: 0.6, lineHeight: 1.3 }}>{d.greek}</div>
								<div style={{ fontSize: 13, lineHeight: 1.2, overflow: 'hidden' }}>{sg(d.signId)}</div>
								<div style={{ lineHeight: 1.2, overflow: 'hidden' }}>{astroSymbol(d.face)}</div>
								<div style={{ minHeight: 14, lineHeight: 1.2, color: 'var(--horosa-accent, #f59e0b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
									{has ? has.map((id) => POINT_CN[id]).join('') : ''}
								</div>
							</div>
						);
					})}
				</div>
				<div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
					每格=一旬(10°):上=旬序、座 glyph、迦勒底面主、本盘落此旬之点。高亮=当前上升所在旬。
				</div>
			</div>
		);
	}

	/* ---------- E1 旬名录表(当前上升旬高亮) ---------- */
	renderRoster(){
		const ascIdx = this.ascDecanIdx();
		return (
			<div style={cardStyle}>
				<XQSectionTitle>旬名录</XQSectionTitle>
				<SmallTable
					rowKey={(r) => r.greek}
					rows={EGYPT_DECANS}
					rowStyle={(r) => (r.greek === ascIdx ? { background: 'var(--horosa-accent-soft, rgba(245,158,11,.18))' } : undefined)}
					columns={[
						{ key: 'greek', title: '#', render: (v) => v },
						{ key: 'signId', title: '旬位', render: (_v, r) => `${sn(r.signId)}${r.decanInSign} ${r.range}` },
						{ key: 'ancient', title: '原位', render: (v) => v },
						{ key: 'egyptName', title: '埃及名', render: (v) => v },
						{ key: 'copticGreek', title: '科普特-希腊名', render: (v) => v },
						{ key: 'hermesName', title: '赫尔墨斯名', render: (v) => v },
						{ key: 'face', title: '面主', render: (v) => astroSymbol(v) },
					]}
				/>
				<div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
					「原位」=古代恒星旬序(天狼 Sothis=1,对齐 0°巨蟹)。高亮=当前上升旬。
				</div>
			</div>
		);
	}

	/* ---------- E5 旬星塔罗 ---------- */
	renderTarot(){
		const pmap = this.pointDecans();
		return (
			<div style={cardStyle}>
				<XQSectionTitle>旬星塔罗(E5)</XQSectionTitle>
				<SmallTable
					rowKey={(r) => r.greek}
					rows={EGYPT_DECANS}
					rowStyle={(r) => (pmap[r.greek] ? { background: 'var(--horosa-accent-soft, rgba(245,158,11,.14))' } : undefined)}
					columns={[
						{ key: 'greek', title: '#', render: (v) => v },
						{ key: 'signId', title: '旬', render: (_v, r) => `${sn(r.signId)}${r.decanInSign}` },
						{ key: 'face', title: '面主', render: (v) => astroSymbol(v) },
						{ key: 'tarotSuit', title: '塔罗', render: (_v, r) => `${TAROT_SUIT_CN[r.tarotSuit]}${r.tarotPip}(${TAROT_SUIT_ELEMENT[r.tarotSuit]})` },
						{ key: 'tarotTitle', title: '牌题', render: (v) => v },
						{ key: 'tarotMeaning', title: '含义', render: (v) => v },
						{ key: 'pts', title: '本盘', render: (_v, r) => (pmap[r.greek] ? pmap[r.greek].map((id) => POINT_CN[id]).join('') : '') },
					]}
				/>
				<div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
					小阿卡那每花色 2–10(9 张)× 4 花色 = 36,与 36 旬双射;牌之「行星入座」即该旬迦勒底面主。
				</div>
			</div>
		);
	}

	/* ---------- E6 护符 melothesia ---------- */
	renderTalisman(){
		const ascIdx = this.ascDecanIdx();
		const rows = EGYPT_DECANS.map((d) => ({ greek: d.greek, signId: d.signId, decanInSign: d.decanInSign, ...talismanByDecan(d.greek) }));
		return (
			<div style={cardStyle}>
				<XQSectionTitle>赫尔墨斯护符(E6)</XQSectionTitle>
				<SmallTable
					rowKey={(r) => r.greek}
					rows={rows}
					rowStyle={(r) => (r.greek === ascIdx ? { background: 'var(--horosa-accent-soft, rgba(245,158,11,.18))' } : undefined)}
					columns={[
						{ key: 'greek', title: '#', render: (v) => v },
						{ key: 'signId', title: '旬', render: (_v, r) => `${sn(r.signId)}${r.decanInSign}` },
						{ key: 'secretName', title: '秘名', render: (v) => v },
						{ key: 'bodyPart', title: '身体部位', render: (v) => v },
						{ key: 'disease', title: '主管疾病', render: (v) => v },
					]}
				/>
				<div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
					秘名刻于护符,佩戴以护对应身体部位、御对应疾病。逐旬载体抄本差异大,多标「待核」。
				</div>
			</div>
		);
	}

	/* ---------- E4 对角星钟 ---------- */
	renderStarClock(){
		// 列=旬(取代表性 12 列,每 3 旬抽 1 列以控宽,完整规律可见);行=夜 12 时
		const cols = [];
		for(let c = 1; c <= 36; c += 3) cols.push(c);
		const hours = [];
		for(let h = 1; h <= 12; h += 1) hours.push(h);
		return (
			<div style={cardStyle}>
				<XQSectionTitle>对角星钟(E4)</XQSectionTitle>
				<div style={{ overflowX: 'auto' }}>
					<table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
						<thead>
							<tr>
								<th style={{ padding: '4px 6px', borderBottom: '1px solid rgba(148,163,184,.35)' }}>夜时\旬列</th>
								{cols.map((c) => (
									<th key={c} style={{ padding: '4px 6px', borderBottom: '1px solid rgba(148,163,184,.35)' }}>{c}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{hours.map((h) => (
								<tr key={h}>
									<td style={{ padding: '4px 6px', fontWeight: 600, borderBottom: '1px solid rgba(148,163,184,.16)' }}>{h} 时</td>
									{cols.map((c) => (
										<td key={c} style={{ padding: '4px 6px', textAlign: 'center', borderBottom: '1px solid rgba(148,163,184,.16)' }}>
											{diagonalStar(c, h)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
					格内数=该旬列该夜时升起旬星的古代恒星序号(对角推移)。{DIAGONAL_NOTE}
				</div>
			</div>
		);
	}

	/* ---------- E7 数字占 ---------- */
	renderNumerology(){
		const { nameInput, lunarDay, petosirisMod } = this.state;
		const N = isopsephy(nameInput);
		const D = Number(lunarDay) || 0;
		const R = petosirisRemainder(N, D, petosirisMod);
		const verdict = petosirisVerdict(R, petosirisMod);
		const root = pythmen(N + D);
		return (
			<div style={cardStyle}>
				<XQSectionTitle>数字占(E7)</XQSectionTitle>
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
					<span style={{ fontSize: 12 }}>希腊字母名:</span>
					<Input size="small" style={{ width: 180 }} value={nameInput}
						placeholder="输入希腊字母(如 αλεξανδρος)"
						onChange={(e) => this.setState({ nameInput: e.target.value })} />
					<span style={{ fontSize: 12 }}>太阴月日:</span>
					<Input size="small" type="number" style={{ width: 70 }} value={lunarDay}
						onChange={(e) => this.setState({ lunarDay: e.target.value })} />
					<span style={{ fontSize: 12 }}>模:</span>
					<select value={petosirisMod} onChange={(e) => this.setState({ petosirisMod: Number(e.target.value) })}
						style={{ fontSize: 12, padding: '2px 4px' }}>
						<option value={29}>mod 29</option>
						<option value={30}>mod 30</option>
					</select>
				</div>
				<div style={{ fontSize: 13, lineHeight: 1.9 }}>
					<div>名字数值 N(isopsephy)= <b>{N}</b></div>
					<div>Petosiris:R =(N+D)mod {petosirisMod} = <b>{R}</b> → <b>{verdict.label}</b></div>
					<div>Democritus 位根 pythmen(N+D)= <b>{root}</b></div>
					<div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{verdict.note}</div>
				</div>
				<div style={{ marginTop: 10 }}>
					<div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>希腊字母数值表(isopsephy)</div>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 2 }}>
						{GREEK_ISOPSEPHY.map((g) => (
							<div key={g.letter} style={{ border: '1px solid rgba(148,163,184,.25)', borderRadius: 4, padding: '2px 4px', textAlign: 'center', fontSize: 11 }}>
								<span style={{ fontSize: 14 }}>{g.letter}</span> {g.value}
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	/* ---------- E8 吉凶日 ---------- */
	renderHemerology(){
		return (
			<div style={cardStyle}>
				<XQSectionTitle>吉凶日历(E8)</XQSectionTitle>
				<div style={{ fontSize: 13, lineHeight: 1.9 }}>
					<div>每民用日分 <b>{HEMEROLOGY_PARTS.join(' / ')}</b> 三段,各标:
						<span style={{ marginLeft: 6 }}>{HEMEROLOGY_MARKS.good}</span> ·
						<span style={{ marginLeft: 6 }}>{HEMEROLOGY_MARKS.neutral}</span> ·
						<span style={{ marginLeft: 6 }}>{HEMEROLOGY_MARKS.bad}</span>
					</div>
				</div>
				<div style={{ marginTop: 8 }}>
					<div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>五闰余日神诞</div>
					<SmallTable
						rowKey={(r) => r.day}
						rows={EGYPT_EPAGOMENAL}
						columns={[
							{ key: 'day', title: '闰余日', render: (v) => `第 ${v} 日` },
							{ key: 'deity', title: '神诞', render: (v) => v },
						]}
					/>
				</div>
				<div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>{HEMEROLOGY_NOTE}</div>
			</div>
		);
	}

	/* ---------- E9 星名 ---------- */
	renderStarNames(){
		return (
			<div style={cardStyle}>
				<XQSectionTitle>五星与恒星埃及名(E9)</XQSectionTitle>
				<SmallTable
					rowKey={(r) => r.id || r.cn}
					rows={EGYPT_PLANET_NAMES}
					columns={[
						{ key: 'id', title: '星', render: (v, r) => <span>{astroSymbol(v)} {r.cn}</span> },
						{ key: 'egyptName', title: '埃及名', render: (v) => v },
						{ key: 'literal', title: '字面义', render: (v) => v },
						{ key: 'note', title: '备注', render: (v) => v },
					]}
				/>
				<div style={{ height: 10 }} />
				<SmallTable
					rowKey={(r) => r.cn}
					rows={EGYPT_STAR_NAMES}
					columns={[
						{ key: 'cn', title: '恒星', render: (v) => v },
						{ key: 'egyptName', title: '埃及名', render: (v) => v },
						{ key: 'literal', title: '字面义', render: (v) => v },
						{ key: 'note', title: '备注', render: (v) => v },
					]}
				/>
				<div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>火/木/土均以「荷鲁斯+修饰」命名,是埃及行星命名的显著特征。</div>
			</div>
		);
	}

	/* ---------- E2 民用历 Sothic ---------- */
	renderCalendar(){
		const months = egyptCivilMonths();
		return (
			<div style={cardStyle}>
				<XQSectionTitle>民用历 / Sothic(E2)</XQSectionTitle>
				<div style={{ fontSize: 12, lineHeight: 1.9, marginBottom: 6 }}>
					一年 = 3 季 × 4 月 × 30 天 + 5 闰余日 = 365(无闰日);逐年漂移 ≈ 1 天 / 4 年(游移年)。
					Sothic 周期 ≈ <b>{SOTHIC_CYCLE_YEARS}</b> 年(民用新年与天狼偕日升重合周期)。
				</div>
				<SmallTable
					rowKey={(r) => r.index}
					rows={months}
					columns={[
						{ key: 'index', title: '#', render: (v) => v },
						{ key: 'season', title: '季', render: (v, r) => `${v}(${r.seasonTranslit})` },
						{ key: 'name', title: '月名', render: (v) => v },
					]}
				/>
				<div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
					序号日 dayOfYear = 季×120 + 月×30 + 日(1..360);+5 闰余日(各系一神诞,见吉凶日页)。
					绝对公历换算须选历史锚点(锚点不同绝对日期不同),本页只列结构与月名。
				</div>
			</div>
		);
	}

	/* ---------- E3 占星地理 ---------- */
	renderChorography(){
		const pts = pointsFrom(this.props.value);
		const rows = SIGN_ORDER.map((s) => {
			const q = CHOROGRAPHY_QUARTERS.find((qq) => qq.signs.indexOf(s) >= 0) || {};
			const here = pts.filter((p) => SIGN_ORDER[Math.floor(p.lon / 30)] === s).map((p) => POINT_CN[p.id]);
			return { signId: s, element: q.element, quarter: q.quarter, region: CHOROGRAPHY_REGIONS[s], here: here.join('') };
		});
		return (
			<div style={cardStyle}>
				<XQSectionTitle>占星地理(E3)</XQSectionTitle>
				<SmallTable
					rowKey={(r) => r.signId}
					rows={rows}
					rowStyle={(r) => (r.here ? { background: 'var(--horosa-accent-soft, rgba(245,158,11,.14))' } : undefined)}
					columns={[
						{ key: 'signId', title: '座', render: (v) => <span>{sg(v)} {sn(v)}</span> },
						{ key: 'element', title: '三分性', render: (v) => v },
						{ key: 'quarter', title: '象限', render: (v) => v },
						{ key: 'region', title: '代表地域(举要)', render: (v) => v },
						{ key: 'here', title: '本盘', render: (v) => v },
					]}
				/>
				<div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
					四分法:世界按四三分性分四象限(西北火/东北土/东南风/西南水)。地域为浓缩举要,世运盘可据此叠加地理。高亮=本盘有星落此座。
				</div>
			</div>
		);
	}

	render(){
		const chartObj = this.props.value;
		const height = this.props.height;
		const ascIdx = this.ascDecanIdx();
		const ascDecan = ascIdx ? EGYPT_DECANS[ascIdx - 1] : null;
		return (
			<div style={{ height, overflowY: 'auto', overflowX: 'hidden' }}>
				{chartObj && chartObj.chart ? (
					<div style={{ ...cardStyle, marginBottom: 10 }}>
						<XQSectionTitle>当前上升旬</XQSectionTitle>
						{ascDecan ? (
							<div style={{ fontSize: 13, lineHeight: 1.9 }}>
								第 <b>{ascDecan.greek}</b> 旬 · {sn(ascDecan.signId)}{ascDecan.decanInSign}({ascDecan.range})
								· 面主 {astroSymbol(ascDecan.face)} · 埃及名 <b>{ascDecan.egyptName}</b>
								· 塔罗 {TAROT_SUIT_CN[ascDecan.tarotSuit]}{ascDecan.tarotPip}「{ascDecan.tarotTitle}」
								· 身体部位 {decanBodyPart(ascDecan.signId, ascDecan.decanInSign)}
							</div>
						) : <div style={{ fontSize: 12, opacity: 0.6 }}>无上升数据。</div>}
					</div>
				) : (
					<div style={{ ...cardStyle, fontSize: 12, opacity: 0.7 }}>请先起本命盘,以读取上升与行星落旬。</div>
				)}
				<XQTabs defaultActiveKey="roster" tabPosition="top" className="horosa-inspector-tabs">
					<TabPane tab="旬名录" key="roster">
						{this.renderDecanRing()}
						{this.renderRoster()}
					</TabPane>
					<TabPane tab="旬塔罗" key="tarot">{this.renderTarot()}</TabPane>
					<TabPane tab="护符" key="talisman">{this.renderTalisman()}</TabPane>
					<TabPane tab="星钟" key="starclock">{this.renderStarClock()}</TabPane>
					<TabPane tab="数字占" key="numerology">{this.renderNumerology()}</TabPane>
					<TabPane tab="吉凶日" key="hemerology">{this.renderHemerology()}</TabPane>
					<TabPane tab="星名" key="starnames">{this.renderStarNames()}</TabPane>
					<TabPane tab="民用历" key="calendar">{this.renderCalendar()}</TabPane>
					<TabPane tab="占星地理" key="chorography">{this.renderChorography()}</TabPane>
				</XQTabs>
			</div>
		);
	}
}

export default AstroEgypt;
