// components/astro/AstroEgypt.js
// 埃及占星页(本命「埃及」tab):36 旬名录/旬星塔罗/对角星钟/护符/数字占/吉凶日/星名。
// 纯前端派生,读 chartObj 取上升与行星落旬;零后端、零回归(仅新增 tab)。
// 内部 XQTabs 承 E1/E4-E9;E2/E3 轻量扩展(民用历 Sothic / 占星地理)。
import { Component } from 'react';
import { Input, Select } from 'antd';
import request from '../../utils/request';
import * as Constants from '../../utils/constants';
import { astroSymbol, cardStyle, SmallTable, chartParams, chartRequestKey, unwrapResult } from './AstroExtraCommon';
import { XQTabs, XQSectionTitle, XQSelect } from '../xq-ui';
import { SIGNS, SIGN_ORDER } from '../../divination/data/signs';
import {
	TAROT_SUIT_CN, TAROT_SUIT_ELEMENT,
	EGYPT_PLANET_NAMES, EGYPT_STAR_NAMES,
	EGYPT_EPAGOMENAL, SOTHIC_CYCLE_YEARS, egyptCivilMonths,
	starClockStar,
	decanBodyPart, talismanByDecan,
	GREEK_ISOPSEPHY, isopsephy, pythmen, petosirisRemainder, petosirisVerdict,
	HEMEROLOGY_PARTS, HEMEROLOGY_MARKS, HEMEROLOGY_NOTE,
	CHOROGRAPHY_QUARTERS, CHOROGRAPHY_REGIONS,
} from '../../divination/data/egyptianData';
import {
	EGYPT_SCHOOL_AXES,
	deriveEgyptView, normalizeEgyptSchool, currentEgyptSchool, persistEgyptSchool,
} from '../../divination/data/egyptianSchools';
import { EGYPT_GODS, egyptianGodSegmentText, egyptianGodSign, EGYPT_GODS_DISCLAIMER } from '../../divination/data/egyptianGods';
import { paransForDegree, circumpolarSplit, PARAN_KINDS, PARAN_ORB_DEFAULT, PARAN_NOTE } from '../../divination/data/egyptianParans';
import { decanImageAt, DECAN_IMAGE_NOTE, EXTRA_ZODIAC_FIGURES, EXTRA_ZODIAC_NOTE } from '../../divination/data/egyptianDecanImages';

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
// 度质代码(后端 classical_tables.degree_quality 产出 B/D/E/S)
const DEGREE_QUALITY_CN = { B: '明度', D: '暗度', E: '空度', S: '烟度' };

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
export function buildEgyptSectionLines(chartObj, school){
	const lines = [];
	const v = deriveEgyptView(chartObj, school);
	if(!v.points.length){
		return lines;
	}
	// ◆ 所用口径:仅非默认档才写(默认档下本段与流派功能上线前逐字节一致)
	if(!v.isDefault){
		lines.push(`◆ 所用口径：${v.diff.map((d) => `${d.label}=${d.valueLabel}`).join('；')}`);
	}
	// ◆ 各行星落旬:逐点 旬序/旬位/埃及名/面主 + 旬星塔罗(与 renderDecanRing/renderTarot 本盘列同源同算)
	lines.push('◆ 各行星落旬');
	v.points.forEach((p) => {
		const d = p.decan;
		if(!d) return;
		lines.push(`${POINT_CN[p.id] || p.id}：第${d.number}旬 ${sn(d.signId)}${d.decanInSign}(${d.range})·埃及名 ${d.primaryName}·面主${POINT_CN[d.ruler] || d.ruler}·塔罗${TAROT_SUIT_CN[d.tarotSuit]}${d.tarotPip}「${d.tarotTitle}」`);
	});
	// ◆ 上升旬详情:上升所落旬完整派生(跨流派旬名/原位序/星认定/塔罗含义/护符 melothesia),
	// 与页首「当前上升旬」卡 + 名录/护符高亮行同源(deriveEgyptView 单一真值源)。
	const ad = v.ascDecan;
	if(ad){
		lines.push('◆ 上升旬详情');
		lines.push(`第${ad.number}旬 ${sn(ad.signId)}${ad.decanInSign}(${ad.range})·原位(古代恒星序)第${ad.ancient}旬·星认定 ${ad.star}`);
		lines.push(`旬名：埃及名 ${ad.egyptName} / 科普特-希腊名 ${ad.copticGreek} / 赫尔墨斯名 ${ad.hermesName};面主${POINT_CN[ad.ruler] || ad.ruler}`);
		lines.push(`塔罗：${TAROT_SUIT_CN[ad.tarotSuit]}${ad.tarotPip}(${TAROT_SUIT_ELEMENT[ad.tarotSuit]})「${ad.tarotTitle}」——${ad.tarotMeaning}`);
		const tal = v.ascTalisman;
		if(tal){
			lines.push(`护符：秘名 ${tal.secretName};身体部位 ${tal.bodyPart};主管疾病 ${tal.disease}`);
		}
	}
	// ◆ 民用历/Sothic:本盘出生日的埃及游移历日期 + 周期定位(锚点必随同输出,否则不可复现)
	if(v.civil){
		lines.push('◆ 埃及民用历');
		lines.push(`${v.civil.text}(锚点：${v.anchor.label})${v.civil.decade === null ? '' : `·第${v.civil.decade + 1}旬列`}`);
		if(v.sothic){
			lines.push(`Sothic 周期：距锚点 ${v.sothic.julianYears.toFixed(1)} 年,周期内位置 ${v.sothic.position.toFixed(1)}/${SOTHIC_CYCLE_YEARS} 年(${v.sothic.percent.toFixed(1)}%);民用历较锚点已漂 ${v.sothic.driftDays.toFixed(1)} 日`);
		}
		if(v.sirius.date){
			lines.push(`天狼偕日升：${v.sirius.date}${v.sirius.deltaDays === null ? '' : `(本盘生日距其 ${v.sirius.deltaDays} 日)`}`);
		}
	}
	return lines;
}

class AstroEgypt extends Component {
	constructor(props){
		super(props);
		// 流派持久化读回;petosirisMod 由流派轴统管(旧 state 键退役,数字占面板改读流派)
		this.state = { nameInput: '', lunarDay: 1, school: currentEgyptSchool(), extra: null, extraKey: '', paranOrb: PARAN_ORB_DEFAULT };
		this._viewCache = null;
		this._mounted = false;
	}

	componentDidMount(){ this._mounted = true; }

	componentWillUnmount(){ this._mounted = false; }

	/* 天狼偕日升由 Python 在 /astroextra/analysis 内算(不在 chartObj 里),此处按需惰性取一次。
	 * 与 AstroAnalysisLab / MundaneMain / aiAnalysisContext 同一既有端点与请求形状,零后端改动;
	 * 只在民用历页真正展开时触发(避免为一行日期拖慢整个信息 tab),失败静默降级为不显示该行。 */
	ensureExtra(){
		const chartObj = this.props.value;
		if(!chartObj || !chartObj.chart){ return; }
		const key = chartRequestKey(chartObj, 'egypt-calendar');
		if(!key || key === this.state.extraKey || this._loadingExtra){ return; }
		const p = chartParams(chartObj);
		// 无 date 则后端必报 miss.date → 静默放弃,不发注定失败的请求(同 aiExport 既有守卫)
		if(!p.date){ return; }
		this._loadingExtra = true;
		request(`${Constants.ServerRoot}/astroextra/analysis`, {
			// [SURF] 前端缓存代次盐(analysis 语义升级,旧 body 键缓存整体失效)
			body: JSON.stringify({ _v: 'cls1', ...p }),
			silent: true,
			timeoutMs: 30000,
		}).then((data) => {
			this._loadingExtra = false;
			if(!this._mounted){ return; }
			this.setState({ extra: unwrapResult(data) || {}, extraKey: key });
		}).catch(() => {
			this._loadingExtra = false;
			if(!this._mounted){ return; }
			this.setState({ extraKey: key });   // 记下已试过,不反复重试
		});
	}

	// —— 单一真值源:全页(含 AI 段)只从这里取派生值,各 tab 不再各自算
	// 轻量记忆化:同一 (chartObj, school) 不重复派生(36 旬表 + 9 点 + 历法换算)
	view(){
		const chartObj = this.props.value;
		const { school, extra } = this.state;
		if(this._viewCache && this._viewCache.chartObj === chartObj
			&& this._viewCache.school === school && this._viewCache.extra === extra){
			return this._viewCache.v;
		}
		// 天狼偕日升等「后端已算但不在 chartObj」的量,以浅层合并喂给单源(deriveEgyptView 只读 egyptianCalendar)
		const src = extra && extra.egyptianCalendar && chartObj
			? { ...chartObj, egyptianCalendar: extra.egyptianCalendar }
			: chartObj;
		const v = deriveEgyptView(src, school);
		this._viewCache = { chartObj, school, extra, v };
		return v;
	}

	setAxis(key, value){
		const next = normalizeEgyptSchool({ ...this.state.school, [key]: value });
		persistEgyptSchool(next);
		this.setState({ school: next });
	}

	/* ---------- 流派切换条(七轴;一行两个下拉以省空间) ---------- */
	renderSchoolBar(){
		const v = this.view();
		return (
			<div style={{ ...cardStyle, marginBottom: 10 }}>
				<XQSectionTitle>流派口径</XQSectionTitle>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '6px 10px', marginTop: 8 }}>
					{EGYPT_SCHOOL_AXES.map((ax) => {
						const cur = v.school[ax.key];
						const opt = ax.options.find((o) => o.value === cur);
						return (
							<div key={ax.key} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
								<span style={{ fontSize: 12, opacity: 0.75, whiteSpace: 'nowrap', flex: '0 0 auto' }}>{ax.label}</span>
								<XQSelect
									size="small"
									style={{ flex: '1 1 auto', minWidth: 0 }}
									value={cur}
									// 展开后按内容全宽(窄右栏下选项文字不被截断)
									dropdownMatchSelectWidth={false}
									getPopupContainer={(n) => n.parentNode}
									onChange={(val) => this.setAxis(ax.key, val)}
									title={opt ? opt.note : ax.note}
								>
									{ax.options.map((o) => (
										<Select.Option key={`${o.value}`} value={o.value} title={o.note}>{o.label}</Select.Option>
									))}
								</XQSelect>
							</div>
						);
					})}
				</div>
				<div style={{ fontSize: 11, opacity: 0.62, marginTop: 7, lineHeight: 1.7 }}>
					{v.isDefault
						? '当前为默认档(各轴取最通行口径),与未启用流派切换时的结果完全一致。'
						: `已改口径：${v.diff.map((d) => `${d.label}=${d.valueLabel}`).join('、')}。`}
					<br />
					{(v.diff.length ? v.diff : []).map((d) => {
						const ax = EGYPT_SCHOOL_AXES.find((a) => a.key === d.key);
						const o = ax && ax.options.find((x) => x.value === d.value);
						return o ? <span key={d.key} style={{ display: 'block' }}>· {d.label}「{d.valueLabel}」：{o.note}</span> : null;
					})}
				</div>
			</div>
		);
	}

	// 各点落旬映射 {greekIdx: [pointId...]}(取自单一真值源)
	pointDecans(){
		const map = {};
		this.view().points.forEach((p) => {
			if(!p.decan){ return; }
			(map[p.decan.greek] = map[p.decan.greek] || []).push(p.id);
		});
		return map;
	}

	/* ---------- 36 旬环(仿 termBand,HTML/CSS 网格,不动 SVG) ---------- */
	renderDecanRing(){
		const v = this.view();
		const ascIdx = v.ascDecan ? v.ascDecan.greek : null;
		const pmap = this.pointDecans();
		return (
			<div style={cardStyle}>
				<XQSectionTitle>三十六旬环</XQSectionTitle>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 2, marginTop: 8 }}>
					{v.decans.map((d) => {
						const isAsc = d.greek === ascIdx;
						const has = pmap[d.greek];
						return (
							<div key={d.greek}
								title={`${sn(d.signId)}${d.decanInSign} ${d.range} · ${d.primaryName} · 主星${POINT_CN[d.ruler] || d.ruler}`}
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
								<div style={{ opacity: 0.6, lineHeight: 1.3 }}>{d.number}</div>
								<div style={{ fontSize: 13, lineHeight: 1.2, overflow: 'hidden' }}>{sg(d.signId)}</div>
								<div style={{ lineHeight: 1.2, overflow: 'hidden' }}>{astroSymbol(d.ruler)}</div>
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
		const v = this.view();
		const ascIdx = v.ascDecan ? v.ascDecan.greek : null;
		const naming = v.school.decanNaming;
		return (
			<div style={cardStyle}>
				<XQSectionTitle>旬名录</XQSectionTitle>
				<SmallTable scrollX
					rowKey={(r) => r.greek}
					rows={v.decans}
					rowStyle={(r) => (r.greek === ascIdx ? { background: 'var(--horosa-accent-soft, rgba(245,158,11,.18))' } : undefined)}
					columns={[
						{ key: 'number', title: '#', render: (val) => val },
						{ key: 'signId', title: '旬位', render: (_v, r) => `${sn(r.signId)}${r.decanInSign} ${r.range}` },
						{ key: 'ancient', title: '原位', render: (val) => val },
						{ key: 'egyptName', title: '埃及名', render: (val, r) => (naming === 'egypt' ? <b>{val}</b> : val) },
						{ key: 'copticGreek', title: '科普特-希腊名', render: (val) => (naming === 'coptic' ? <b>{val}</b> : val) },
						{ key: 'hermesName', title: '赫尔墨斯名', render: (val) => (naming === 'hermes' ? <b>{val}</b> : val) },
						{ key: 'ruler', title: '旬主', render: (val) => astroSymbol(val) },
					]}
				/>
				<div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
					「#」按当前旬序锚定编号(黄道序自白羊起 / 恒星序自天狼所主之旬起);「原位」恒为古代恒星旬序(天狼 Sothis=1,对齐 0°巨蟹)。
					加粗列=当前名录传统的主显名。高亮=当前上升旬。
				</div>
			</div>
		);
	}

	/* ---------- E5 旬星塔罗 ---------- */
	renderTarot(){
		const v = this.view();
		const pmap = this.pointDecans();
		return (
			<div style={cardStyle}>
				<XQSectionTitle>旬星塔罗(E5)</XQSectionTitle>
				<SmallTable scrollX
					rowKey={(r) => r.greek}
					rows={v.decans}
					rowStyle={(r) => (pmap[r.greek] ? { background: 'var(--horosa-accent-soft, rgba(245,158,11,.14))' } : undefined)}
					columns={[
						{ key: 'number', title: '#', render: (val) => val },
						{ key: 'signId', title: '旬', render: (_v, r) => `${sn(r.signId)}${r.decanInSign}` },
						{ key: 'ruler', title: '旬主', render: (val) => astroSymbol(val) },
						{ key: 'tarotSuit', title: '塔罗', render: (_v, r) => `${TAROT_SUIT_CN[r.tarotSuit]}${r.tarotPip}(${TAROT_SUIT_ELEMENT[r.tarotSuit]})` },
						{ key: 'tarotTitle', title: '牌题', render: (v) => v },
						{ key: 'tarotMeaning', title: '含义', render: (v) => v },
						{ key: 'pts', title: '本盘', render: (_v, r) => (pmap[r.greek] ? pmap[r.greek].map((id) => POINT_CN[id]).join('') : '') },
					]}
				/>
				<div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
					小阿卡那每花色 2–10(9 张)× 4 花色 = 36,与 36 旬双射;牌之「行星入座」按迦勒底制即该旬面主
					{v.school.decanRuler === 'chaldean' ? '(当前正是此制)' : '(当前旬主星制为三分性制,故「旬主」列与塔罗牌面的行星标注不再一致)'}。
				</div>
			</div>
		);
	}

	/* ---------- E6 护符 melothesia ---------- */
	renderTalisman(){
		const v = this.view();
		const ascIdx = v.ascDecan ? v.ascDecan.greek : null;
		const rows = v.decans.map((d) => {
			const img = decanImageAt(d.greek);
			return {
				greek: d.greek, number: d.number, signId: d.signId, decanInSign: d.decanInSign,
				...talismanByDecan(d.greek),
				image: img ? img.image : '', effect: img ? img.effect : '',
			};
		});
		// 择时:古法以「该旬正当上升」或「月行至该旬」为成时之候,两者皆本盘可判(纯派生,不外补)
		const moon = v.points.find((p) => p.id === 'Moon');
		const moonDecan = moon ? moon.decan : null;
		const ascTal = v.ascDecan ? talismanByDecan(v.ascDecan.greek) : null;
		const moonTal = moonDecan ? talismanByDecan(moonDecan.greek) : null;
		return (
			<div style={cardStyle}>
				<XQSectionTitle>赫尔墨斯护符(E6)</XQSectionTitle>
				<div style={{
					fontSize: 12, lineHeight: 1.95, marginBottom: 9, padding: '7px 9px', borderRadius: 6,
					border: '1px solid var(--horosa-border-soft, rgba(148,163,184,.3))',
					background: 'var(--horosa-surface, rgba(255,255,255,.45))',
				}}>
					<div style={{ fontWeight: 600, marginBottom: 2 }}>本盘择时</div>
					{v.ascDecan ? (
						<div>
							上升正当<b>第 {v.ascDecan.number} 旬</b>（{sn(v.ascDecan.signId)}{v.ascDecan.decanInSign}）
							{ascTal ? <span> → 此刻宜作「{ascTal.secretName}」护符，主 {ascTal.bodyPart}、御 {ascTal.disease}。</span> : null}
						</div>
					) : <div style={{ opacity: 0.65 }}>无上升数据，无法判「旬当上升」之候。</div>}
					{moonDecan ? (
						<div>
							月行<b>第 {moonDecan.number} 旬</b>（{sn(moonDecan.signId)}{moonDecan.decanInSign}）
							{moonTal ? <span> → 兼合「{moonTal.secretName}」之候，主 {moonTal.bodyPart}。</span> : null}
						</div>
					) : null}
					{v.ascDecan && decanImageAt(v.ascDecan.greek) ? (
						<div style={{ marginTop: 2 }}>
							所升之象：{decanImageAt(v.ascDecan.greek).image}
							{decanImageAt(v.ascDecan.greek).effect ? <span> —— {decanImageAt(v.ascDecan.greek).effect}</span> : <span style={{ opacity: 0.55 }}> —— （原文未给所主）</span>}
						</div>
					) : null}
					{v.ascDecan && moonDecan && v.ascDecan.greek === moonDecan.greek ? (
						<div style={{ color: 'var(--horosa-accent, #f59e0b)' }}>上升与月同落一旬 —— 两候并至，古法以为最得时。</div>
					) : null}
					<div style={{ fontSize: 11, opacity: 0.62, marginTop: 3, lineHeight: 1.7 }}>
						成时之候取「该旬正当上升」与「月行至该旬」两条本盘可判者；其余候（旬主星尊贵、避月受损等）
						另见格局与行星页，此处不重复陈列，也不代为裁断。
					</div>
				</div>
				<div style={{ marginTop: 2 }}>
					<div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>三十六旬 · 象与用</div>
					<div style={{ display: 'grid', gap: 6 }}>
						{rows.map((r) => (
							<div key={`img-${r.greek}`} style={{
								padding: '6px 8px', borderRadius: 6, fontSize: 12, lineHeight: 1.75, minWidth: 0,
								border: '1px solid var(--horosa-border-soft, rgba(148,163,184,.28))',
								background: r.greek === ascIdx ? 'var(--horosa-accent-soft, rgba(245,158,11,.16))' : 'transparent',
							}}>
								<div style={{ fontWeight: 600 }}>
									第 {r.number} 旬 · {sn(r.signId)}{r.decanInSign}
									<span style={{ opacity: 0.7, fontWeight: 400 }}> · 秘名 {r.secretName}</span>
								</div>
								<div style={{ wordBreak: 'break-word' }}>象：{r.image || '—'}</div>
								<div style={{ wordBreak: 'break-word', opacity: r.effect ? 1 : 0.55 }}>
									所主：{r.effect || '（原文未给）'}
								</div>
								<div style={{ wordBreak: 'break-word', opacity: 0.82 }}>
									护：{r.bodyPart} · 御 {r.disease}
								</div>
							</div>
						))}
					</div>
					<div style={{ fontSize: 11, opacity: 0.62, marginTop: 6, lineHeight: 1.7 }}>
						秘名刻于护符,佩戴以护对应身体部位、御对应疾病;逐旬载体抄本差异大,多标「待核」。
						<br />{DECAN_IMAGE_NOTE}
					</div>
				</div>
				<div style={{ marginTop: 12 }}>
					<div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>黄道外星座之效验</div>
					<SmallTable
						rowKey={(r) => r.en}
						rows={EXTRA_ZODIAC_FIGURES}
						columns={[
							{ key: 'cn', title: '星座', render: (val, r) => <span>{val} <span style={{ opacity: 0.6 }}>{r.en}</span></span> },
							{ key: 'effect', title: '效验', render: (val) => val },
						]}
					/>
					<div style={{ fontSize: 11, opacity: 0.62, marginTop: 6 }}>{EXTRA_ZODIAC_NOTE}</div>
				</div>
			</div>
		);
	}

	/* ---------- E4 对角星钟 ---------- */
	renderStarClock(){
		const v = this.view();
		const clock = v.starClock;
		// 列=全年 36 旬列(横向滚动看全表);行=夜 12 时。本盘所在旬列高亮(民用历派生,无日期则无高亮)
		const cols = [];
		for(let c = 1; c <= 36; c += 1) cols.push(c);
		const hours = [];
		for(let h = 1; h <= 12; h += 1) hours.push(h);
		const hereCol = v.civil && v.civil.decade !== null ? v.civil.decade + 1 : null;
		const ascAncient = v.ascDecan ? v.ascDecan.ancient : null;
		const th = { padding: '3px 5px', borderBottom: '1px solid rgba(148,163,184,.35)', whiteSpace: 'nowrap' };
		const td = { padding: '3px 5px', textAlign: 'center', borderBottom: '1px solid rgba(148,163,184,.16)' };
		return (
			<div style={cardStyle}>
				<XQSectionTitle>星钟(E4)·{clock.label}</XQSectionTitle>
				<div style={{ overflowX: 'auto' }}>
					<table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
						<thead>
							<tr>
								<th style={{ ...th, position: 'sticky', left: 0, background: 'var(--horosa-surface, rgba(255,255,255,.92))', zIndex: 1 }}>夜时\旬列</th>
								{cols.map((c) => (
									<th key={c} style={{ ...th, background: c === hereCol ? 'var(--horosa-accent-soft, rgba(245,158,11,.22))' : 'transparent' }}>{c}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{hours.map((h) => (
								<tr key={h}>
									<td style={{ ...td, textAlign: 'left', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--horosa-surface, rgba(255,255,255,.92))', zIndex: 1, whiteSpace: 'nowrap' }}>{h} 时</td>
									{cols.map((c) => {
										const star = starClockStar(clock.key, c, h);
										const hot = star === ascAncient;
										return (
											<td key={c} style={{
												...td,
												background: c === hereCol
													? 'var(--horosa-accent-soft, rgba(245,158,11,.14))'
													: (hot ? 'rgba(56,189,248,.16)' : 'transparent'),
												fontWeight: hot ? 700 : 400,
											}}>{star}</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<div style={{ fontSize: 11, opacity: 0.62, marginTop: 6, lineHeight: 1.7 }}>
					格内数=该旬列该夜时「{clock.column}」的旬星古代恒星序号。
					{hereCol ? `橙列=本盘出生日所在旬列(第 ${hereCol} 列,按${v.anchor.label}锚点)。` : ''}
					{ascAncient ? `蓝格=本盘上升旬(古代序第 ${ascAncient})出现之处。` : ''}
					<br />{clock.note}
				</div>
			</div>
		);
	}

	/* ---------- E7 数字占 ---------- */
	renderNumerology(){
		const { nameInput, lunarDay } = this.state;
		const petosirisMod = this.view().petosirisMod;   // 模数已升为流派轴,面板只读不再另设控件
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
					<span style={{ fontSize: 12, opacity: 0.7 }}>模:mod {petosirisMod}(改档见本页最末「设置」页 · Petosiris 模数)</span>
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
					<SmallTable scrollX
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
				<SmallTable scrollX
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
				<SmallTable scrollX
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
	// 本盘埃及历卡:出生日 → 埃及民用日 / 旬列 / Sothic 定位 / 距天狼偕日升
	renderCivilOfChart(){
		this.ensureExtra();          // 页真正展开才拉(antd 惰性挂载 → 未看此页则零请求)
		const v = this.view();
		const cell = { fontSize: 12, lineHeight: 1.95 };
		return (
			<div style={{ ...cardStyle, marginBottom: 10 }}>
				<XQSectionTitle>本盘埃及历</XQSectionTitle>
				{v.civil ? (
					<div style={cell}>
						<div>
							埃及民用日：<b>{v.civil.text}</b>
							{v.civil.decade === null ? '（闰余日不属任何旬列）' : ` · 第 ${v.civil.decade + 1} 旬列 · 年内第 ${v.civil.dayOfYear} 日`}
						</div>
						<div>
							纪元锚点：<b>{v.anchor.label}</b>（{v.anchor.civilYearLabel} {v.civil.year} 年）
						</div>
						{v.sothic ? (
							<div>
								{`Sothic 定位：周期内 `}<b>{v.sothic.position.toFixed(1)}</b>
								{` / ${SOTHIC_CYCLE_YEARS} 年（${v.sothic.percent.toFixed(1)}%，第 ${v.sothic.cycleIndex + 1} 轮）· 民用历较锚点已漂 `}
								<b>{v.sothic.driftDays.toFixed(1)}</b>{` 日`}
							</div>
						) : null}
						{v.sirius.date ? (
							<div>
								天狼偕日升：<b>{v.sirius.date}</b>
								{v.sirius.deltaDays === null ? '' : `（本盘生日${v.sirius.deltaDays === 0 ? '恰为该日' : (v.sirius.deltaDays > 0 ? `在其后 ${v.sirius.deltaDays} 日` : `在其前 ${-v.sirius.deltaDays} 日`)}）`}
							</div>
						) : null}
						<div style={{ fontSize: 11, opacity: 0.62, marginTop: 4, lineHeight: 1.7 }}>
							{v.anchor.note}<br />
							游移年无闰日，绝对日期完全取决于所选锚点；换锚点只改年号不改月日（三纪元本属同一部连续历）。
							引用本页日期时务必连锚点一并注明，否则不可复现。
						</div>
					</div>
				) : (
					<div style={{ fontSize: 12, opacity: 0.65 }}>本盘无可用出生日期，无法换算埃及民用日。</div>
				)}
			</div>
		);
	}

	renderCalendar(){
		const months = egyptCivilMonths();
		return (
			<div style={cardStyle}>
				<XQSectionTitle>民用历 / Sothic(E2)</XQSectionTitle>
				<div style={{ fontSize: 12, lineHeight: 1.9, marginBottom: 6 }}>
					一年 = 3 季 × 4 月 × 30 天 + 5 闰余日 = 365(无闰日);逐年漂移 ≈ 1 天 / 4 年(游移年)。
					Sothic 周期 ≈ <b>{SOTHIC_CYCLE_YEARS}</b> 年(民用新年与天狼偕日升重合周期)。
				</div>
				<SmallTable scrollX
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

	/* ---------- E10 度数细分(只读回显:后端已算,埃及源流的度级技法) ---------- */
	renderDegreeDetail(){
		const chartObj = this.props.value;
		const byId = {};
		if(chartObj && chartObj.chart){
			(chartObj.chart.objects || []).forEach((o) => { if(o && o.id){ byId[o.id] = o; } });
			(chartObj.chart.angles || []).forEach((a) => { if(a && a.id){ byId[a.id] = a; } });
		}
		const v = this.view();
		const rows = v.points.map((p) => {
			const o = byId[p.id] || {};
			return {
				id: p.id,
				decan: p.decan,
				degreeQuality: o.degreeQuality || '',
				monomoiria: o.monomoiria || '',
				darijan: o.darijan || '',
				pitted: o.pitted, azemene: o.azemene, fortune: o.increasingFortune,
			};
		});
		const any = rows.some((r) => r.degreeQuality || r.monomoiria || r.darijan);
		return (
			<div style={cardStyle}>
				<XQSectionTitle>度数细分(E10)</XQSectionTitle>
				{any ? (
					<SmallTable scrollX
						rowKey={(r) => r.id}
						rows={rows}
						columns={[
							{ key: 'id', title: '点', render: (val) => <span>{astroSymbol(val)} {POINT_CN[val] || val}</span> },
							{ key: 'decan', title: '所落旬', render: (val) => (val ? `第${val.number}旬 ${sn(val.signId)}${val.decanInSign}` : '—') },
							{ key: 'decan2', title: '旬主', render: (_val, r) => (r.decan ? astroSymbol(r.decan.ruler) : '—') },
							{ key: 'darijan', title: '十度分(Darijan)', render: (val) => (val ? <span>{astroSymbol(val)} {POINT_CN[val] || val}</span> : '—') },
							{ key: 'monomoiria', title: '单度主星', render: (val) => (val ? <span>{astroSymbol(val)} {POINT_CN[val] || val}</span> : '—') },
							{ key: 'degreeQuality', title: '度质', render: (val) => DEGREE_QUALITY_CN[val] || (val ? `${val}度` : '—') },
							{
								key: 'pitted',
								title: '特殊度',
								render: (_val, r) => [r.pitted ? '陷度' : '', r.azemene ? '慢病度' : '', r.fortune ? '增福度' : ''].filter(Boolean).join('·') || '—',
							},
						]}
					/>
				) : (
					<div style={{ fontSize: 12, opacity: 0.65 }}>本盘无度级细分数据（需已起本命盘且后端返回古典字段）。</div>
				)}
				<div style={{ fontSize: 11, opacity: 0.62, marginTop: 6, lineHeight: 1.7 }}>
					本页为<b>只读回显</b>：以上各量均由排盘时一并算出（度质表、单度主星表、十度分表皆源出埃及度级传统），
					此处不另设控件、不重复计算，只把已算而未曾露面的量按埃及源流归拢一处。
					<br />「所落旬 / 旬主」随「设置」页的流派口径变动；其余各列由排盘参数决定，与埃及流派轴无关。
				</div>
			</div>
		);
	}

	/* ---------- E12 共升星(paranatellonta;按斜升法实算,随纬度与年代变) ---------- */
	renderParans(){
		const v = this.view();
		const chartObj = this.props.value;
		const geo = (chartObj && chartObj.chart && chartObj.chart.geo) || null;
		const lat = geo && geo.lat != null ? Number(geo.lat) : NaN;
		const year = v.birth ? v.birth.year : NaN;
		const pts = v.points;
		if(!Number.isFinite(lat) || !Number.isFinite(year) || !pts.length){
			return (
				<div style={cardStyle}>
					<XQSectionTitle>共升星(E12)</XQSectionTitle>
					<div style={{ fontSize: 12, opacity: 0.65 }}>
						需已起本命盘(取地理纬度与年份)方可实算共升星。
					</div>
				</div>
			);
		}
		const orb = this.state.paranOrb;
		const kindCn = PARAN_KINDS.reduce((a, k) => { a[k.key] = k.label; return a; }, {});
		const rows = [];
		pts.forEach((p) => {
			paransForDegree(p.lon, lat, year, orb).forEach((h) => {
				rows.push({
					key: `${p.id}-${h.star.name_en}-${h.kind}`,
					point: p.id, decan: p.decan,
					star: h.star, kind: h.kind, delta: h.delta,
				});
			});
		});
		const split = circumpolarSplit(lat, year);
		return (
			<div style={cardStyle}>
				<XQSectionTitle>共升星(E12)</XQSectionTitle>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8, fontSize: 12 }}>
					<span style={{ opacity: 0.75 }}>纬度 {lat.toFixed(2)}° · 年份 {year} · 容许度</span>
					<XQSelect size="small" style={{ width: 96 }} value={orb}
						dropdownMatchSelectWidth={false}
						getPopupContainer={(n) => n.parentNode}
						onChange={(val) => this.setState({ paranOrb: Number(val) })}>
						{[0.5, 1, 1.5, 2, 3].map((o) => (<Select.Option key={`${o}`} value={o}>{o}°</Select.Option>))}
					</XQSelect>
					<span style={{ opacity: 0.6 }}>命中 {rows.length} 条</span>
				</div>
				{rows.length ? (
					<SmallTable scrollX
						rowKey={(r) => r.key}
						rows={rows}
						columns={[
							{ key: 'point', title: '点', render: (val) => <span>{astroSymbol(val)} {POINT_CN[val] || val}</span> },
							{ key: 'decan', title: '所落旬', render: (val) => (val ? `第${val.number}旬` : '—') },
							{ key: 'kind', title: '关系', render: (val) => kindCn[val] || val },
							{ key: 'star', title: '恒星', render: (s) => <span>{s.name_cn}{s.isRoyal ? ' ★' : ''} <span style={{ opacity: 0.6 }}>{s.name_en}</span></span> },
							{ key: 'star2', title: '星等', render: (_val, r) => (r.star.magnitude != null ? r.star.magnitude.toFixed(1) : '—') },
							{ key: 'delta', title: '差', render: (val) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}°` },
						]}
					/>
				) : (
					<div style={{ fontSize: 12, opacity: 0.65 }}>此容许度下本盘各点无共升星命中；可放宽容许度再看。</div>
				)}
				{(split.always.length || split.never.length) ? (
					<div style={{ fontSize: 11, opacity: 0.7, marginTop: 8, lineHeight: 1.75 }}>
						此纬度下无升落之星（不进上表）：
						{split.always.length ? <span>常显不落 —— {split.always.map((s) => s.name_cn).join('、')}；</span> : null}
						{split.never.length ? <span>永不升起 —— {split.never.map((s) => s.name_cn).join('、')}。</span> : null}
					</div>
				) : null}
				<div style={{ fontSize: 11, opacity: 0.62, marginTop: 6, lineHeight: 1.7 }}>{PARAN_NOTE}</div>
			</div>
		);
	}

	/* ---------- E11 众神星座(现代通俗体系;必随性质声明) ---------- */
	renderGods(){
		const v = this.view();
		const edition = v.school.godEdition;
		// 两版只在少数日期段上分歧。若本盘生日不在分歧段,切版本会「看起来没反应」——
		// 那是数据实情而非开关失灵,须明说,否则用户会以为选项是死的。
		const otherEdition = edition === 'seamless' ? 'variant' : 'seamless';
		const otherKey = v.birth ? egyptianGodSign(v.birth.month, v.birth.day, otherEdition) : null;
		const sameAcrossEditions = v.birth && otherKey === v.godKey;
		return (
			<div style={cardStyle}>
				<XQSectionTitle>众神星座(E11)</XQSectionTitle>
				<div style={{
					fontSize: 11.5, lineHeight: 1.75, padding: '7px 9px', marginBottom: 9, borderRadius: 6,
					border: '1px solid rgba(248,113,113,.35)', background: 'rgba(248,113,113,.08)',
				}}>
					⚠️ {EGYPT_GODS_DISCLAIMER}
				</div>
				{v.birth ? (
					<div style={{ fontSize: 13, lineHeight: 1.9, marginBottom: 8 }}>
						本盘出生日 {v.birth.year}-{v.birth.month}-{v.birth.day} →
						{v.god
							? <span> 守护神 <b>{v.god.cn}（{v.god.name}）</b> · {v.god.keywords.join('·')}</span>
							: <span style={{ opacity: 0.7 }}> 当前版本在此日<b>无归属</b>（该版本本身留有缺口，未代为补洞）</span>}
					</div>
				) : (
					<div style={{ fontSize: 12, opacity: 0.65, marginBottom: 8 }}>本盘无可用出生日期。</div>
				)}
				{v.birth ? (
					<div style={{ fontSize: 11, opacity: 0.62, marginBottom: 8, lineHeight: 1.7 }}>
						{sameAcrossEditions
							? '两版在本盘生日上判归相同 —— 换版本此处不会变（分歧只在少数日期段，见下表「日期段」列）。'
							: '本盘生日正落在两版的分歧段上：换版本会改判归。'}
					</div>
				) : null}
				<SmallTable
					rowKey={(r) => r.key}
					rows={EGYPT_GODS}
					rowStyle={(r) => (v.godKey === r.key ? { background: 'var(--horosa-accent-soft, rgba(245,158,11,.18))' } : undefined)}
					columns={[
						{ key: 'cn', title: '神', render: (val, r) => <span><b>{val}</b> {r.name}</span> },
						{ key: 'seg', title: '日期段', render: (_val, r) => egyptianGodSegmentText(r.key, edition) || '—' },
						{ key: 'keywords', title: '关键词', render: (val) => (val || []).join('·') },
						{ key: 'note', title: '备注', render: (val) => val || '' },
					]}
				/>
				<div style={{ fontSize: 11, opacity: 0.62, marginTop: 6, lineHeight: 1.7 }}>
					与西方十二星座「每座一段连续日期」不同，本体系每位神对应 2–4 段<b>不连续</b>日期，全年共 28 段。
					段界各读物略有出入，故按版本组织（改版见本页最末「设置」页 · 众神版本）。
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
				<SmallTable scrollX
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
		const v = this.view();
		const ascDecan = v.ascDecan;
		return (
			<div style={{ height, overflowY: 'auto', overflowX: 'auto' }}>
				{chartObj && chartObj.chart ? (
					<div style={{ ...cardStyle, marginBottom: 10 }}>
						<XQSectionTitle>当前上升旬</XQSectionTitle>
						{ascDecan ? (
							<div style={{ fontSize: 13, lineHeight: 1.9 }}>
								第 <b>{ascDecan.number}</b> 旬 · {sn(ascDecan.signId)}{ascDecan.decanInSign}({ascDecan.range})
								· 旬主 {astroSymbol(ascDecan.ruler)} · 旬名 <b>{ascDecan.primaryName}</b>
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
					<TabPane tab="度数细分" key="degree">{this.renderDegreeDetail()}</TabPane>
					<TabPane tab="星钟" key="starclock">{this.renderStarClock()}</TabPane>
					<TabPane tab="共升星" key="parans">{this.renderParans()}</TabPane>
					<TabPane tab="数字占" key="numerology">{this.renderNumerology()}</TabPane>
					<TabPane tab="吉凶日" key="hemerology">{this.renderHemerology()}</TabPane>
					<TabPane tab="星名" key="starnames">{this.renderStarNames()}</TabPane>
					<TabPane tab="民用历" key="calendar">
						{this.renderCivilOfChart()}
						{this.renderCalendar()}
					</TabPane>
					<TabPane tab="众神" key="gods">{this.renderGods()}</TabPane>
					<TabPane tab="占星地理" key="chorography">{this.renderChorography()}</TabPane>
					<TabPane tab="设置" key="settings">{this.renderSchoolBar()}</TabPane>
				</XQTabs>
			</div>
		);
	}
}

export default AstroEgypt;
