// components/astro/AstroLifespan.js
// 古典寿命格局面板（生命主/寿主星寿数/盘主体系/行星状态/医疗危机）。
// 纯前端：buildFacts(本命chartObj) → runLifespan；嵌于本命「古典」tab 底部，不新开 tab。
import { Component } from 'react';
import { safeLocalStorageSet } from '../../utils/safeStorage';
import buildFacts from '../../divination/engine/chartFacts';
import { runLifespan } from '../../divination/lifespan/lifespanEngine';
import { PLANETARY_YEARS } from '../../divination/lifespan/lifespanData';
import { SIGNS } from '../../divination/data/signs';
import { chartIdOfKey } from '../../divination/engine/utils';
import { astroSymbol, fmtNum, cardStyle, SmallTable } from './AstroExtraCommon';

const METHODS = [
	{ value: 'ptolemy', label: '托勒密', en: 'Ptolemy', desc: '释放位限 10/1/11/7/9（权重降序）；地平下及 8/12 宫排除' },
	{ value: 'alcabitius', label: '阿尔卡比修斯', en: 'Alcabitius', desc: '增 8 宫；7/8/9 宫须星座性别合宗派；上升前 5° 入命' },
	{ value: 'dorotheus', label: '多罗修斯', en: 'Dorotheus', desc: '托勒密诸位 + 阴阳星座×象限双合；无寿主则降级顺移' },
];
const DIGNITY_CN = { domicile: '本垣', exaltation: '擢升', triplicity: '三分', term: '界', face: '十度' };
const BAND_CN = { greatest: '大限', mean: '中限', least: '小限' };
const HAYYIZ_CN = { Hayyiz: '得时得地', DemiHayyiz: '得时不得地', InWrongPos: '失位', None: '—' };
const SUNSTATE_CN = { cazimi: '日心', combust: '焦伤', under_beams: '日光束下' };
const ORIENT_CN = { oriental: '东出', occidental: '西入' };
// 向运凶光类型 → 中文（杀星本体合 / 四分凶光 / 对分凶光）。
const RAY_CN = { 0: '合（本体）', 90: '刑（四分凶光）', 180: '冲（对分凶光）' };
const RAYKIND_CN = { 'body': '本体', 'dexter-square': '右四分', 'sinister-square': '左四分', 'opposition': '对分' };
// 行星年三档键 → 中文短标。
const YEARBAND_CN = { least: '小限', mean: '中限', greatest: '大限' };

const sym = (key) => astroSymbol(chartIdOfKey(key) || key);
const sn = (sign) => (SIGNS[sign] && SIGNS[sign].cn) || sign || '-';
const degText = (signlon) => (signlon == null ? '-' : `${fmtNum(signlon, 1)}°`);
const houseText = (h) => (h ? `${h}宫` : '-');
const posText = (sign, signlon) => `${sn(sign)} ${degText(signlon)}`;

// 把本命 chartObj 补出 objectMap/houseMap（buildFacts 需要；与 AstroHelper 惰性缓存同款，不依赖它）
function ensureMaps(chartObj){
	if(!chartObj || !chartObj.chart) return chartObj;
	if(!chartObj.objectMap && Array.isArray(chartObj.chart.objects)){
		const m = {};
		chartObj.chart.objects.forEach((o) => { if(o && o.id) m[o.id] = o; });
		chartObj.objectMap = m;
	}
	if(!chartObj.houseMap && Array.isArray(chartObj.chart.houses)){
		const hm = {};
		chartObj.chart.houses.forEach((h) => { if(h && h.id) hm[h.id] = h; });
		chartObj.houseMap = hm;
	}
	return chartObj;
}

const sectionTitle = { fontWeight: 600, marginBottom: 8, fontSize: 13 };
const kv = { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12, lineHeight: 1.9 };

class AstroLifespan extends Component {
	constructor(props){
		super(props);
		// [D4] method 持久化:快照(astroAiSnapshot 无头构建)读同键——否则组件换法后 AI 快照恒 Ptolemy(名实不符)。
		let _m = 'ptolemy';
		try{ const v = localStorage.getItem('horosa.lifespan.method'); if(v){ _m = v; } }catch(_){ }
		this.state = { method: _m, timelineOpen: false };
	}

	render(){
		const chartObj = this.props.value;
		if(!chartObj || !chartObj.chart){
			return <div style={{ padding: 12, fontSize: 12, opacity: 0.7 }}>暂无本命盘数据</div>;
		}
		let res = null;
		try{
			const facts = buildFacts(ensureMaps(chartObj));
			res = facts ? runLifespan(facts, { method: this.state.method }) : null;
		}catch(e){
			return <div style={{ padding: 12, fontSize: 12, color: '#c0392b' }}>寿命格局计算出错：{String(e && e.message || e)}</div>;
		}
		if(!res){ return <div style={{ padding: 12, fontSize: 12, opacity: 0.7 }}>无法解析本命盘</div>; }

		const hy = res.hyleg;
		const alc = res.alcocoden;
		// 分区渲染:reorg 后古典tab把 行星状态盘 放「状态」节、其余寿命卡放「寿命」节(各自一个实例)。
		// 默认(无 parts)= 全渲染,向后兼容。
		const parts = this.props.parts || ['method', 'life', 'status', 'medical', 'timeline'];
		const show = (k) => parts.indexOf(k) >= 0;
		const activeMethod = METHODS.find((m) => m.value === this.state.method) || METHODS[0];

		return (
			<div style={{ paddingRight: 6 }}>
				{/* 作者选择 */}
				{show('method') ? (
				<div style={cardStyle}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
						<span style={{ fontWeight: 600, fontSize: 13 }}>寿命格局 <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.6 }}>Length of Life</span></span>
						<span style={{ fontSize: 12, opacity: 0.7 }}>取主法：</span>
						{METHODS.map((m) => (
							<span
								key={m.value}
								onClick={() => { this.setState({ method: m.value }); safeLocalStorageSet('horosa.lifespan.method', m.value); }}
								style={{
									cursor: 'pointer', fontSize: 12, padding: '2px 10px', borderRadius: 6,
									border: '1px solid rgba(148,163,184,.4)',
									background: this.state.method === m.value ? 'var(--horosa-accent, #6c5ce7)' : 'transparent',
									// accent 实底必须配 on-accent(暗色下 accent 是浅金,白字会隐形)
									color: this.state.method === m.value ? 'var(--horosa-on-accent, #fff)' : 'inherit',
								}}
							>{m.label}<span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>{m.en}</span></span>
						))}
						<span style={{ fontSize: 12, opacity: 0.7, marginLeft: 'auto' }}>
							{res.isDiurnal ? '日生盘' : '夜生盘'} · {res.birthType === 'conjunctional' ? '朔月型' : '望月型'}
						</span>
					</div>
					{/* 取主法说明随选择切换(让"点了有反应") */}
					<div style={{ fontSize: 11, opacity: 0.65, marginTop: 7 }}>{activeMethod.label} {activeMethod.en}：{activeMethod.desc}</div>
				</div>
				) : null}

				{/* 生命主候选 */}
				{show('life') ? (
				<div style={cardStyle}>
					<div style={sectionTitle}>生命主（Hyleg<span style={{ fontWeight: 400, opacity: 0.65, fontSize: 12 }}> · {activeMethod.label}法</span>）{hy ? <span>　→　{sym(hy.key)} {posText(hy.sign, hy.signlon)}（{houseText(hy.house)}）</span> : '　→　未定'}</div>
					<SmallTable
						rowKey={(r) => r.key}
						rows={res.candidates}
						columns={[
							{ key: 'key', title: '候选点', render: (v) => sym(v) },
							{ key: 'house', title: '宫位', render: (v) => houseText(v) },
							{ key: 'aphetic', title: '释放位', render: (v) => (v ? '✓' : '—') },
							{ key: 'rank', title: '权重', render: (v) => (v == null ? '-' : v) },
							{ key: 'reason', title: '判定', render: (v) => <span style={{ opacity: 0.85 }}>{v}</span> },
						]}
					/>
				</div>

				) : null}

				{/* 寿主星与寿数 */}
				{show('life') ? (
				<div style={cardStyle}>
					<div style={sectionTitle}>寿主星（Alcocoden）与寿数</div>
					{alc && alc.alcocoden ? (
						<div style={kv}>
							<span>寿主星：{sym(alc.alcocoden)}</span>
							<span>经由：{DIGNITY_CN[alc.viaDignity] || alc.viaDignity || '-'}</span>
							<span>与生命主：{alc.aspectToHyleg || '-'}</span>
							<span>宫位：{houseText(alc.house)}（{alc.angularity === 'angular' ? '角宫' : alc.angularity === 'succedent' ? '续宫' : '果宫'}）</span>
							<span>寿数档：{BAND_CN[alc.band] || alc.band}（基础 {alc.baseYears} 年）</span>
							{(alc.modifiers || []).map((m, i) => (
								<span key={i} style={{ color: m.kind === 'malefic' ? '#c0392b' : (m.kind === 'benefic' ? '#27ae60' : 'inherit') }}>
									{sym(m.planet)}{m.aspect}{m.delta > 0 ? '+' : ''}{m.delta}
								</span>
							))}
							<span style={{ fontWeight: 700 }}>预测寿数 ≈ {alc.predictedYears} 年</span>
						</div>
					) : (
						<div style={{ fontSize: 12, opacity: 0.7 }}>未能确定寿主星（生命主无具尊贵且相照之星）。</div>
					)}
				</div>

				) : null}

				{/* 盘主体系 */}
				{show('life') ? (
				<div style={cardStyle}>
					<div style={sectionTitle}>盘主体系 <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.6 }}>Rulership System</span>（占控 / 家主 / 盘主）</div>
					{res.rulers ? (
						<div style={kv}>
							<span>占控星 Epikratetor：{sym(res.rulers.epikratetor)}</span>
							<span>家主星 Oikodespotes（船主）：{res.rulers.oikodespotes ? sym(res.rulers.oikodespotes) : '-'}</span>
							<span>盘主星 Kurios（舵手）：{res.rulers.kurios ? sym(res.rulers.kurios) : '-'}</span>
							{res.rulers.concordant ? <span style={{ color: '#27ae60' }}>家主=盘主，格局相合</span> : null}
						</div>
					) : <span style={{ fontSize: 12, opacity: 0.7 }}>-</span>}
				</div>

				) : null}

				{/* 行星状态盘 */}
				{show('status') ? (
				<div style={cardStyle}>
					<div style={sectionTitle}>行星状态盘 <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.6 }}>Planetary Conditions</span></div>
					<SmallTable
						rowKey={(r) => r.planet}
						rows={res.states.rows}
						columns={[
							{ key: 'planet', title: '行星', render: (v) => sym(v) },
							{ key: 'hayyiz', title: '得时', render: (v) => (HAYYIZ_CN[v] || '—') },
							{ key: 'sunState', title: '日下', render: (v) => (SUNSTATE_CN[v] || '—') },
							{ key: 'orient', title: '出没', render: (v) => (ORIENT_CN[v] || '—') },
							{ key: 'motion', title: '行度', render: (v) => (v === 'retro' ? '逆' : '顺') },
							{ key: 'inSect', title: '同区分', render: (v) => (v ? '✓' : '—') },
							{ key: 'house', title: '宫', render: (v) => houseText(v) },
						]}
					/>
				</div>

				) : null}

				{/* 医疗危机 */}
				{show('medical') ? (
				<div style={cardStyle}>
					<div style={sectionTitle}>医疗危机 <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.6 }}>Medical Crisis</span>（Zoller 法 v1）</div>
					<div style={kv}>
						<span>第六宫：{res.medical.sixthSign ? sn(res.medical.sixthSign) : '-'}</span>
						<span>六宫主：{res.medical.sixthRuler ? sym(res.medical.sixthRuler) : '-'}</span>
						<span>生命主受克：{(res.medical.hylegAfflictions && res.medical.hylegAfflictions.length)
							? res.medical.hylegAfflictions.map((a, i) => <span key={i} style={{ color: '#c0392b', marginRight: 6 }}>{sym(a.planet)}{a.aspect}</span>)
							: '无'}</span>
						{res.medical.bodyHyleg ? <span>生命主部位：{res.medical.bodyHyleg.join('、')}</span> : null}
					</div>
					<div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>{res.medical.note}</div>
				</div>
				) : null}

					{/* 向运至杀星时间轴（G1：折叠卡，默认折叠） */}
					{show('timeline') ? this.renderTimeline(res, hy, alc, activeMethod) : null}
			</div>
		);
	}

	// 向运至杀星时间轴（折叠卡）：①释放星+取法注明 ②寿命主+行星年三档 ③向运时间轴表。
	renderTimeline(res, hy, alc, activeMethod){
		const open = this.state.timelineOpen;
		const head = (
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
				onClick={() => this.setState({ timelineOpen: !open })}>
				<span style={{ fontWeight: 700 }}>向运至杀星 · 寿命时间轴 <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.6 }}>Direction to Anareta</span></span>
				<span style={{ fontSize: 12, opacity: 0.6 }}>{open ? '收起 ▲' : '展开 ▼'}</span>
			</div>
		);
		if(!open){ return <div style={{ ...cardStyle, marginTop: 8 }}>{head}</div>; }

		// 优雅降级：缺生命主 → 不报错，提示数据不足。
		if(!hy){
			return (
				<div style={{ ...cardStyle, marginTop: 8 }}>
					{head}
					<div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>数据不足，无法定释放星（缺当宗派发光体或上升），向运时间轴不可推算。</div>
				</div>
			);
		}

		const tl = res.timeline || { rows: [], note: '' };
		const predicted = (alc && alc.predictedYears != null) ? alc.predictedYears : null;
		// 寿命主行星年三档（least/mean/greatest）。
		const py = alc && alc.alcocoden ? PLANETARY_YEARS[alc.alcocoden] : null;
		const timelineRows = (tl.rows || []).map((r, i) => ({ ...r, _key: `${r.planet}-${r.aspectKind}-${i}` }));

		return (
			<div style={{ ...cardStyle, marginTop: 8 }}>
				{head}
				<div style={{ marginTop: 8 }}>
					{/* ① 释放星 + 取法注明 */}
					<div style={{ ...kv, marginBottom: 8 }}>
						<span style={{ fontWeight: 600 }}>释放星（Hyleg）：{sym(hy.key)} {posText(hy.sign, hy.signlon)}（{houseText(hy.house)}）</span>
						<span style={{ opacity: 0.7 }}>取法：{activeMethod.label}（{activeMethod.en}）法</span>
					</div>

					{/* ② 寿命主 + 行星年三档 */}
					<div style={{ ...kv, marginBottom: 4 }}>
						<span style={{ fontWeight: 600 }}>寿命主（Alcocoden）：{alc && alc.alcocoden ? sym(alc.alcocoden) : '未定'}</span>
						{py ? (
							<>
								<span>小限 {py.least} 年</span>
								<span>中限 {py.mean} 年</span>
								<span>大限 {py.greatest} 年</span>
								{alc && alc.band ? <span style={{ opacity: 0.7 }}>（本盘取 {YEARBAND_CN[alc.band] || alc.band}）</span> : null}
							</>
						) : <span style={{ opacity: 0.7 }}>—（生命主无具尊贵且相照之星，行星年不可取）</span>}
						{predicted != null ? <span style={{ fontWeight: 700 }}>预测寿数 ≈ {predicted} 年</span> : null}
					</div>

					{/* ③ 向运时间轴表 */}
					<div style={{ fontSize: 12, fontWeight: 600, margin: '10px 0 2px' }}>向运至杀星时间轴（升序）</div>
					{timelineRows.length ? (
						<SmallTable
							rowKey={(r) => r._key}
							rows={timelineRows}
							rowStyle={(r) => (predicted != null && r.age <= predicted ? { background: 'rgba(207,19,32,.08)' } : undefined)}
							columns={[
								{ key: 'planet', title: '杀星', render: (v) => sym(v) },
								{ key: 'aspect', title: '相位', render: (v, r) => <span style={{ opacity: 0.9 }}>{RAY_CN[v] || `${v}°`}{r.aspectKind && RAYKIND_CN[r.aspectKind] && v !== 0 ? <span style={{ fontSize: 10, opacity: 0.55, marginLeft: 3 }}>{RAYKIND_CN[r.aspectKind]}</span> : null}</span> },
								{ key: 'dangerSign', title: '危险度', render: (v, r) => `${sn(v)} ${fmtNum(r.dangerLon % 30, 1)}°` },
								{ key: 'arc', title: '向运弧', render: (v) => `${fmtNum(v, 1)}°` },
								{ key: 'age', title: '对应岁数', render: (v, r) => (
									<span style={{ fontWeight: 700, color: (predicted != null && v <= predicted) ? '#cf1322' : 'inherit' }}>
										{fmtNum(v, 1)} 岁{r.aspect === 0 ? <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 3 }}>合</span> : null}
									</span>
								) },
							]}
						/>
					) : (
						<div style={{ fontSize: 12, opacity: 0.7 }}>数据不足，无法定杀星位置（缺土星/火星黄经）。</div>
					)}
					<div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
						{tl.note}
						{predicted != null && timelineRows.length ? <span>　淡红行 = 落在预测寿数（约 {predicted} 岁）之内的危险窗口。</span> : null}
					</div>
				</div>
			</div>
		);
	}
}

export default AstroLifespan;
