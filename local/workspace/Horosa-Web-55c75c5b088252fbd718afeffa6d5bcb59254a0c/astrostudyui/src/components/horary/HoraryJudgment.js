import { Component } from 'react';
import { XQTabs, XQSelect } from '../xq-ui';
import { runHorary, ASPECT_CN } from '../../divination/horary/horaryEngine';
import { horaryJudgeOpts, schoolOf } from '../../divination/horary/horarySchools';
import { DIVINATION_JUDGE_EVENT } from '../../utils/divinationJudgeGlobals';
import { CLASSICAL_GLOBALS_EVENT } from '../../utils/classicalChartGlobals';
import { judgeLayerOverrides } from '../../utils/judgeLayerOverrides';
import { buildHorarySnapshot } from '../../divination/horary/horarySnapshot';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { PLANETS } from '../../divination/data/planets';
import { SIGNS, signOfLon } from '../../divination/data/signs';
import { NATURAL_SIGNIFICATORS } from '../../divination/data/naturalSignificators';
import { PLANETARY_HOURS } from '../../divination/data/planetaryHours';
import { turnedHouseOf } from '../../divination/horary/significators';
import * as AstroText from '../../constants/AstroText';
import * as AstroConst from '../../constants/AstroConst';
import { getQuestionGuide } from '../../divination/horary/questionGuide';
import { buildAntisciaTable } from '../../divination/horary/antisciaTable';

const XQOption = XQSelect.Option;
// 迦勒底时序（行星时全表用）：由慢到快循环。
const CHALDEAN_SEQ = ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon'];
// [H8] 映点表实现收编至 divination/horary/antisciaTable.js(快照/UI 单源,orb 同吃 opts.antisciaOrb)。

const TabPane = XQTabs.TabPane;
// 古典·接纳/互容（卜卦右栏「古典」tab）：直接读排盘引擎已算的后端 chart.receptions / chart.mutuals，
// 与「占星·古典」同一套成熟数据（正/邪接纳、正/邪互容、庙旺三分界面尊贵 + 拒绝），不再用前端近似引擎。
const RECEPTION_REFUSE_TOKENS = ['exile', 'fall'];
function dignCn(ary){ return (ary || []).map((t) => AstroText.AstroMsg[t] || t).join('+'); }
function pGlyph(id){ return AstroText.AstroMsg[id] || id; }
function gly(id){ return <span style={{ fontFamily: AstroConst.AstroFont }}>{pGlyph(id)}</span>; }
function hasRefuse(tokens){ return (tokens || []).some((t) => RECEPTION_REFUSE_TOKENS.includes(t)); }
function classicalReception(chart){
	const recp = (chart && chart.receptions) || {};
	const mut = (chart && chart.mutuals) || {};
	return {
		recNormal: recp.normal || [], recAbnormal: recp.abnormal || [],
		mutNormal: mut.normal || [], mutAbnormal: mut.abnormal || [],
	};
}
let _lastHorarySnap = '';
function cn(k){ return (PLANETS[k] || {}).cn || k || '—'; }
// [H4a] 后端盘面 id(Sun/Moon/Mars…)→中文:与 horarySnapshot.clsPlanetCn 同源口径(AstroMsgCN 全名优先)。
function clsPlanetCnUI(id){ return AstroText.AstroMsgCN[id] || AstroText.AstroTxtMsg[id] || id || '—'; }
const ANG_CN = { angular: '角宫·有力', succedent: '续宫·中等', cadent: '果宫·偏弱' };
const LEAN = {
	yes: { word: '倾向：成', sub: '完成法命中、吉证占优 → 多向「成」倾斜。仍须结合实际，不替您下命定结论。', cls: 'lean-yes' },
	no: { word: '倾向：不成 / 受阻', sub: '完成受阻或凶证占优 → 多向「不成」倾斜。建议另择时再问。', cls: 'lean-no' },
	even: { word: '倾向：势均力敌', sub: '吉凶证词相当、未见明确完成法 → 建议换更合适的时机重新起卦。', cls: 'lean-even' },
};

function plainState(facts, k){
	const p = facts.planets[k];
	if(!p) return '';
	const sgn = (SIGNS[p.sign] || {}).cn || p.sign;
	const ang = ANG_CN[p.angularity] || '';
	const dig = p.dignityScore >= 4 ? '入庙旺·有力' : (p.dignityScore <= -4 ? '落陷失势·无力' : (p.peregrine ? '游走·无尊贵' : '尊贵平平'));
	const extra = [];
	if(p.retro) extra.push('逆行');
	if(p.combustion === 'combust') extra.push('燃烧受灼');
	else if(p.combustion === 'cazimi') extra.push('居日心·极强');
	else if(p.combustion === 'under_beams') extra.push('日光束下');
	return `落 ${sgn}座 · 第${p.house || '?'}宫 · ${ang} · ${dig}${extra.length ? ' · ' + extra.join('/') : ''}`;
}

class HoraryJudgment extends Component{
	constructor(props){
		super(props);
		// 转宫控件本地态（P=人物本宫,T=其自身盘主题宫;限两跳内,见 05§5）。
		this.state = { turnP: 3, turnT: 2 };
	}
	componentDidMount(){
		this.saveSnap();
		// 「设置→星盘设置→卜卦·择日判读」改全局判读参数 → 本面板即时重跑判读
		// (opts 组装每次 render 现取 divinationJudgeOverrides(),监听只负责触发重渲)。
		this._onJudgeGlobals = () => this.forceUpdate();
		if(typeof window !== 'undefined'){
			window.addEventListener(DIVINATION_JUDGE_EVENT, this._onJudgeGlobals);
			// 迁仓后判读相关七键住 classical 仓 → 该仓变更同样要重跑判读。
			window.addEventListener(CLASSICAL_GLOBALS_EVENT, this._onJudgeGlobals);
		}
	}
	componentWillUnmount(){
		if(typeof window !== 'undefined' && this._onJudgeGlobals){
			window.removeEventListener(DIVINATION_JUDGE_EVENT, this._onJudgeGlobals);
			window.removeEventListener(CLASSICAL_GLOBALS_EVENT, this._onJudgeGlobals);
		}
	}
	componentDidUpdate(){ this.saveSnap(); }

	// 定盘 Tab：正面确认层 + 19 条三态 + 总判(总判档随 considerationsMode 三档变化)。
	renderGrounding(j, opts){
		opts = opts || {};
		const rad = j.radicality || {};
		const ha = rad.hourAgreement;
		const cons = (rad.considerations && rad.considerations.items) || [];
		const hitsUnmitigated = cons.filter((c) => c.hit && !c.mitigated && c.severity === 'warn');
		// 考量硬度三档真差异:宽松=命中一律降注记(总判恒可判);警示=现行阶梯;严格=零容忍
		// (任一未救济命中即「慎判」,≥2 即建议另择)。
		const mode = opts.considerationsMode || 'warn';
		let overall;
		if(mode === 'lenient'){
			overall = hitsUnmitigated.length === 0
				? { cls: 'is-pos', icon: '✓', word: '可判', sub: '未见未救济的判前考量命中,盘面可径行判读。' }
				: { cls: 'is-pos', icon: '✓', word: '可判（宽松档）', sub: `宽松档:${hitsUnmitigated.length} 条考量命中一律降为注记,不阻断判读——下断语自行斟酌。` };
		}else if(mode === 'strict'){
			overall = hitsUnmitigated.length === 0 ? { cls: 'is-pos', icon: '✓', word: '可判', sub: '未见未救济的判前考量命中,盘面可径行判读。' }
				: (hitsUnmitigated.length === 1 ? { cls: '', icon: '◑', word: '慎判（严格档）', sub: '严格档零容忍:已有考量命中且未救济——断语须显著收敛。' }
					: { cls: 'is-neg', icon: '⚠', word: '建议改述问题或另择时', sub: '严格档:两条以上考量命中——此盘不宜径判,宜改述问题或改日再问。' });
		}else{
			overall = hitsUnmitigated.length === 0 ? { cls: 'is-pos', icon: '✓', word: '可判', sub: '未见未救济的判前考量命中,盘面可径行判读。' }
				: (hitsUnmitigated.length <= 2 ? { cls: '', icon: '◑', word: '慎判', sub: '有少量考量命中且未救济——可判,但下断语须收敛、注明保留。' }
					: { cls: 'is-neg', icon: '⚠', word: '建议改述问题或另择时', sub: '多条考量命中——按传统此盘根基不稳,宜重新表述问题或改日再问。' });
		}
		const stateOf = (c) => {
			if(c.severity === 'unavailable') return { icon: '·', cls: '', note: '（数据不可用,不计入）' };
			if(c.severity === 'info' && !c.hit) return { icon: '·', cls: '', note: '' };
			if(c.hit && c.mitigated) return { icon: '◐', cls: '', note: '（已救济）' };
			if(c.hit) return { icon: '⚠', cls: 'is-neg', note: '' };
			return { icon: '✓', cls: 'is-pos', note: '' };
		};
		return (
			<div className="horosa-divi-judge">
				{this.props.questionText ? (
					<div className="horosa-divi-card">
						<div className="horosa-divi-card-head">所问之事</div>
						<div className="horosa-divi-line" style={{ fontStyle: 'italic' }}>“{this.props.questionText}”</div>
						<div className="horosa-divi-muted">起盘阵营：{({ astrologer: '占星师中心（Ⅰ）', querent: '问卜者中心（Ⅱ）', midpoint: '时空中点（关系盘）' })[this.props.castingCamp || 'astrologer']}</div>
					</div>
				) : null}
				<div className="horosa-divi-card">
					<div className={'horosa-divi-verdict-big ' + (overall.cls === 'is-pos' ? 'lean-yes' : (overall.cls === 'is-neg' ? 'lean-no' : 'lean-even'))}>
						定盘总判：{overall.word}
						<div className="sub">{overall.sub}</div>
					</div>
				</div>
				<div className="horosa-divi-card">
					<div className="horosa-divi-card-head">正面确认 · 时主与命主一致</div>
					{ha && ha.available ? (
						ha.agree ? ha.hits.map((h, i) => (
							<div key={i} className="horosa-divi-testi is-pos"><span className="dot">✓</span><span>{h.text}</span></div>
						)) : <div className="horosa-divi-testi"><span className="dot">·</span><span>时主与命主不合（同星/同三分/同性质皆不中）——按传统仅失一佐证,<b>不因此弃盘</b>。</span></div>
					) : <div className="horosa-divi-line">时主/命主数据不全。</div>}
					{ha && ha.available ? <div className="horosa-divi-muted">口径：{({ either: '两口径任一（行星统辖版 / 落座元素版）', lilly: '行星统辖版', bonatti: '落座元素版' })[ha.variant] || ha.variant}</div> : null}
				</div>
				<div className="horosa-divi-card">
					<div className="horosa-divi-card-head">判前考量 19 条（三态：⚠命中 / ◐已救济 / ✓未命中）</div>
					<div className="horosa-divi-legend">硬度档：<b>{({ warn: '警示', strict: '严格', lenient: '宽松', ignore: '几乎弃用' })[(rad.considerations || {}).mode] || '警示'}</b>——考量是「判前停下想想」,除极端情形外不禁判。救济条件在左栏自评开关与盘面条件中。</div>
					<div style={{ maxHeight: 300, overflowY: 'auto' }}>
						{cons.map((c) => {
							const st = stateOf(c);
							return (
								<div key={c.key} className={'horosa-divi-testi ' + st.cls}>
									<span className="dot">{st.icon}</span>
									<span>{c.idx}. {c.text_zh}{st.note}
										{c.hit && c.mitigable && !c.mitigated && c.mitigatedBy && c.mitigatedBy.length ? (
											<span style={{ opacity: 0.7 }}>（可救济：{c.mitigatedBy.join('；')}）</span>
										) : null}
									</span>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		);
	}
	saveSnap(){
		if(!this._j) return;
		// [YA v42] 第二参传 chart:快照补 [古典接纳];[批6] 第三参传问句/阵营 → [定盘考量] 段。
		try{
			const t = buildHorarySnapshot(this._j, this.props.chart, { questionText: this.props.questionText, castingCamp: this.props.castingCamp });
			if(t && t !== _lastHorarySnap){ _lastHorarySnap = t; saveModuleAISnapshot('horary', t, {}); }
		}catch(e){ /* noop */ }
	}
	render(){
		const { chart, category, schoolId, overrides, assessments } = this.props;
		// 有效判读参数 = 内建默认 ∪ 全局仓(星盘设置·只含用户改过的键) ∪ 流派差异集 ∪ 高级面板覆盖
		//               ∪ 定盘自评（问句真诚/年轻体貌）。四层语义见 horarySchools.horaryJudgeOpts。
		const opts = {
			...horaryJudgeOpts(schoolId, overrides, judgeLayerOverrides()),
			...(assessments ? {
				sincerityConfirmed: assessments.sincerityConfirmed,
				confirmYouthMatch: assessments.confirmYouthMatch,
				isEventChart: assessments.isEventChart,
			} : {}),
		};
		const school = schoolOf(schoolId);
		let j = null; let err = null;
		try{ j = chart ? runHorary(chart, category, opts) : null; }catch(e){ err = e; console.error('runHorary failed', e); }
		this._j = j;
		if(!chart) return <div className="horosa-divi-judge"><div className="horosa-divi-note">排盘中…</div></div>;
		if(err || !j) return <div className="horosa-divi-judge"><div className="horosa-divi-note">判断生成失败：{String((err && err.message) || err || '无结果')}</div></div>;

		const sig = j.significators;
		const rad = j.radicality;
		const perf = j.perfection;
		const v = j.verdict;
		const lean = LEAN[v.leaning] || LEAN.even;
		const facts = j.facts;
		const moonStory = j.moonStory || { separating: [], applying: [] };
		const allAspects = j.allAspects || [];
		const cls = classicalReception(chart);
		const guide = getQuestionGuide(category);

		return (
			<XQTabs defaultActiveKey="verdict" className="horosa-inspector-tabs horosa-content-tabs">
				<TabPane tab="定盘" key="grounding">
					{this.renderGrounding(j, opts)}
				</TabPane>
				<TabPane tab="裁决" key="verdict">
					<div className="horosa-divi-judge">
						<div className={'horosa-divi-verdict-big ' + lean.cls}>
							{v.profile === 'v2' ? `${v.bandCn}（置信度 ${v.confidence}/100）` : lean.word}
							<div className="sub">{v.profile === 'v2' ? `全证词池五档判语（三值投影：${lean.word.replace('倾向：', '')}）${(v.guards || []).length ? ' · 结构护栏生效' : ''}` : lean.sub}</div>
						</div>
						{v.profile === 'v2' ? (() => {
							const tot = (v.posScore || 0) + (v.negScore || 0) || 1;
							const pw = Math.round((v.posScore / tot) * 100);
							return (
								<div className="horosa-divi-card" style={{ marginBottom: 6 }}>
									<div className="horosa-divi-card-head">证词天平（去重·软封顶）</div>
									<div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
										<span style={{ fontSize: 12, minWidth: 70 }}>有利 {v.posScore}（{(v.positive || []).length} 条）</span>
										<div style={{ flex: 1, height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', background: 'rgba(147,161,176,0.25)' }}>
											<div style={{ width: pw + '%', background: '#2f9e6f' }} />
											<div style={{ width: (100 - pw) + '%', background: '#cf5b45' }} />
										</div>
										<span style={{ fontSize: 12, minWidth: 70, textAlign: 'right' }}>不利 {v.negScore}（{(v.negative || []).length} 条）</span>
									</div>
									{(v.conditions || []).length ? v.conditions.map((c, i) => (
										<div key={i} className="horosa-divi-testi"><span className="dot">◈</span><span>条件式结论：{c.text}</span></div>
									)) : null}
									{(v.guards || []).length ? <div className="horosa-divi-kv" style={{ opacity: 0.75 }}>结构护栏生效：完成法/破坏为结构性证词，数值分不越其界。</div> : null}
								</div>
							);
						})() : null}
						<div className="horosa-divi-muted" style={{ marginBottom: 6 }}>判读流派：<b>{school.cn}</b> · {school.desc}</div>
						{guide ? (
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">断法要点 · {guide.title}</div>
								<div className="horosa-divi-kv" style={{ opacity: 0.85 }}>{guide.focus}</div>
								<div className="horosa-divi-testi is-pos"><span className="dot">▲</span><span>偏成之征：{guide.yes}</span></div>
								<div className="horosa-divi-testi is-neg"><span className="dot">▼</span><span>偏阻之征：{guide.no}</span></div>
							</div>
						) : null}
						{j.topic ? (
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">专题深化 · {j.topic.title}</div>
								{j.topic.lines.map((t, i) => (
									<div key={i} className={'horosa-divi-testi ' + (t.polarity === 'positive' ? 'is-pos' : (t.polarity === 'negative' ? 'is-neg' : ''))}>
										<span className="dot">{t.polarity === 'positive' ? '▲' : (t.polarity === 'negative' ? '▼' : '·')}</span><span>{t.text}</span>
									</div>
								))}
							</div>
						) : null}
						<div className="horosa-divi-card">
							<div className="horosa-divi-subhead pos">有利证词（{v.positive.length}）</div>
							{v.positive.length ? v.positive.map((p, i) => <div key={i} className="horosa-divi-testi is-pos"><span className="dot">▲</span><span>{p.text}</span></div>) : <div className="horosa-divi-line">暂无明显有利证词。</div>}
						</div>
						<div className="horosa-divi-card">
							<div className="horosa-divi-subhead neg">不利证词（{v.negative.length}）</div>
							{v.negative.length ? v.negative.map((n, i) => <div key={i} className="horosa-divi-testi is-neg"><span className="dot">▼</span><span>{n.text}</span></div>) : <div className="horosa-divi-line">暂无明显不利证词。</div>}
						</div>
						<div className="horosa-divi-card">
							<div className="horosa-divi-card-head">六类问法（Sibly Query）</div>
							<div className="horosa-divi-kv">① 能否成事：{j.queries.canHappen.text}</div>
							<div className="horosa-divi-kv">② 事情好坏：{j.queries.goodEvil.text}</div>
							<div className="horosa-divi-kv">③ 消息真假：{j.queries.reportTrue.text}</div>
							<div className="horosa-divi-kv">④ 何处方位：{j.queries.where ? `${j.queries.where.dir}（${j.queries.where.terrain}），距离${j.queries.where.distance}` : '本问无方位指示。'}</div>
							<div className="horosa-divi-kv">⑤ 何时应期：{j.queries.when ? j.queries.when.text : '—'}</div>
							<div className="horosa-divi-kv">⑥ 结局如何：{j.queries.outcome ? j.queries.outcome.text : '—'}</div>
						</div>
						<div className="horosa-divi-note">卜卦只呈现证据与倾向，不替您下命定结论；势均力敌时建议另择时再问。</div>
					</div>
				</TabPane>

				<TabPane tab="征象" key="sig">
					<div className="horosa-divi-judge">
						<div className="horosa-divi-card">
							<div className="horosa-divi-card-head">这一盘适合判断吗？（根本性）</div>
							<div className="horosa-divi-legend">检查此盘是否真诚自然、可信地判断。有警告不代表不能判，只是提醒慎重。</div>
							{rad.suitable ? <div className="horosa-divi-testi is-pos"><span className="dot">✓</span><span>盘面端正，适合判断。</span></div> : null}
							{rad.ok.map((t, i) => <div key={'ok' + i} className="horosa-divi-testi is-pos"><span className="dot">✓</span><span>{t}</span></div>)}
							{rad.warnings.map((w, i) => <div key={'w' + i} className="horosa-divi-testi is-neg"><span className="dot">⚠</span><span>{w.text}</span></div>)}
						</div>
						<div className="horosa-divi-card">
							<div className="horosa-divi-card-head">谁代表谁（征象星指派）</div>
							<div className="horosa-divi-kv">问卜者本人 ＝ 命宫主星 <span className="tag">{cn(sig.querentKey)}</span> ＋ 月亮</div>
							<div className="horosa-divi-kv">{sig.quesitedLabel || '所问之事'} ＝ {sig.quesitedHouse ? sig.quesitedHouse + '宫主 ' : ''}<span className="tag">{cn(sig.quesitedKey)}</span></div>
							{sig.turned ? (
							<div className="horosa-divi-testi is-pos"><span className="dot">⟳</span><span>转宫：第 {sig.turned.personHouse} 宫人的第 {sig.turned.radicalHouse} 宫事 → 本盘第 <b>{sig.turned.turnedHouse}</b> 宫（引擎已自动转宫，下方速查器供手动核对）。</span></div>
						) : null}
						{sig.natural ? <div className="horosa-divi-kv">自然征象星（该事项的天然代表）＝ <span className="tag">{cn(sig.natural)}</span>{sig.naturalPromoted ? <span style={{ opacity: 0.85 }}>（已升 co-quesited：用事宫主三重受克）</span> : null}</div> : null}
						{(sig.coSignificators && sig.coSignificators.length) ? (
							<div className="horosa-divi-kv">用事宫内驻星（co-significator，低权参证）＝ {sig.coSignificators.map((k) => <span key={k} className="tag">{cn(k)}</span>)}</div>
						) : null}
							<div className="horosa-divi-kv">此刻「时主星」（活跃征象）＝ <span className="tag">{cn(j.hourRuler)}</span></div>
							{j.hourAgreement ? <div className={'horosa-divi-testi ' + (j.hourAgreement.agree ? 'is-pos' : '')}><span className="dot">{j.hourAgreement.agree ? '✓' : '·'}</span><span>{j.hourAgreement.text}</span></div> : null}
							{j.significators && j.facts && j.almuten ? (
								<div className="horosa-divi-kv">
									Almuten（逐度总管）：命度 ＝ <span className="tag">{(j.almuten.asc && j.almuten.asc.winners.map(cn).join('/')) || '—'}</span>
									{j.almuten.quesitedCusp ? <span>；事项宫头 ＝ <span className="tag">{j.almuten.quesitedCusp.winners.map(cn).join('/')}</span></span> : null}
								</div>
							) : null}
							{j.moonPromotion && j.moonPromotion.promote ? (
								<div className="horosa-divi-testi"><span className="dot">☽</span><span>月亮升格条件命中：{j.moonPromotion.reasons.join('、')} → 判读时月亮可升为主象征。</span></div>
							) : null}
						</div>
						{sig.sharedRuler ? (
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">同主一星</div>
								<div className="horosa-divi-kv">命主与事项主同为 <span className="tag">{cn(sig.sharedRuler.planet)}</span>。</div>
								<div className="horosa-divi-line">{sig.sharedRuler.note || '二者紧密相连,事多半成;质量看该星尊贵（法A 通说;高级面板可切 B/C/D/E 裁决法）。'}</div>
							</div>
						) : null}
						{sig.natural && NATURAL_SIGNIFICATORS[sig.natural] ? (
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">自然象征 · {NATURAL_SIGNIFICATORS[sig.natural].cn} {NATURAL_SIGNIFICATORS[sig.natural].glyph}</div>
								<div className="horosa-divi-kv">人物：{NATURAL_SIGNIFICATORS[sig.natural].persons.join('、')}</div>
								<div className="horosa-divi-kv">事物：{NATURAL_SIGNIFICATORS[sig.natural].things.join('、')}</div>
								{NATURAL_SIGNIFICATORS[sig.natural].note ? <div className="horosa-divi-muted">{NATURAL_SIGNIFICATORS[sig.natural].note}</div> : null}
							</div>
						) : null}
						<div className="horosa-divi-card">
							<div className="horosa-divi-card-head">转宫（衍生宫速查）</div>
							<div className="horosa-divi-legend">「P 宫人物的第 T 宫事务」→ 本盘第 ((P+T−2) mod 12)+1 宫。限一跳、至多两跳；读转宫务必注明。</div>
							<div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
								<XQSelect size="small" style={{ width: 108 }} value={this.state.turnP} onChange={(v)=>this.setState({ turnP: v })}>
									{[1,2,3,4,5,6,7,8,9,10,11,12].map((h)=>(<XQOption key={h} value={h}>{h} 宫人物</XQOption>))}
								</XQSelect>
								<span>的</span>
								<XQSelect size="small" style={{ width: 108 }} value={this.state.turnT} onChange={(v)=>this.setState({ turnT: v })}>
									{[1,2,3,4,5,6,7,8,9,10,11,12].map((h)=>(<XQOption key={h} value={h}>第 {h} 宫事</XQOption>))}
								</XQSelect>
								<span>＝ 本盘第 <b style={{ fontSize: 15 }}>{turnedHouseOf(this.state.turnP, this.state.turnT)}</b> 宫
									（宫主 <span className="tag">{cn((facts.houses[turnedHouseOf(this.state.turnP, this.state.turnT)] || {}).ruler)}</span>）</span>
							</div>
						</div>
						{(j.fixedStars && j.fixedStars.length) ? (
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">恒星会合（{opts.fixedStarOrbMode === 'byMagnitude' ? '按星等轨·王者≤5°' : `≤${opts.fixedStarOrb || 2}°`}）</div>
								<div className="horosa-divi-legend">征象星 / 命度 / 天顶 紧密会合精选恒星 → 叠加该星吉凶之力（卜卦取少而精的一组恒星）。</div>
								{j.fixedStars.map((s, i) => (
									<div key={i} className={'horosa-divi-testi ' + (s.nature === 'boost' ? 'is-pos' : 'is-neg')}>
										<span className="dot">{s.nature === 'boost' ? '★' : '⚠'}</span>
										<span><b>{s.point}</b> 会合 <b>{s.star}</b>（{s.meaning}）</span>
									</div>
								))}
								{(() => {
									// [H4a] 后端实测恒星附加行:仅征象星三键(全表 31 行太长);与上方前端精选表两口径对照。
									const bs = j.backendStars || {};
									const rows = [];
									[[sig.querentKey, '命主'], [sig.quesitedKey, '事项'], ['moon', '月亮']].forEach(([k, label]) => {
										const p = k && facts.planets[k];
										const hit = p && bs[p.chartId];
										if(hit && hit.length){ rows.push(`${label}·${cn(k)}：${hit.map((s) => `${s.cn || s.star}（差${s.orb.toFixed(1)}°)`).join('、')}`); }
									});
									return rows.length ? (
										<div className="horosa-divi-kv" style={{ opacity: 0.8, marginTop: 6 }}>后端实测（星历全表口径）：{rows.join('；')}</div>
									) : null;
								})()}
							</div>
						) : null}
						{(j.besiegement && j.besiegement.length) ? (
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">围攻详断（后端十六式）</div>
								<div className="horosa-divi-legend">凶围＝火土两侧夹攻（<b>重</b>＝紧密）；围荣/围耀＝金木/日月环护（吉）；协防星以相位解一侧之围。</div>
								{j.besiegement.map((b, i) => (
									<div key={i} className={'horosa-divi-testi ' + (b.nature === '凶' ? 'is-neg' : 'is-pos')}>
										<span className="dot">{b.nature === '凶' ? '⚔' : '☗'}</span>
										<span>
											<b>{clsPlanetCnUI(b.target)}</b> {b.kind || '围攻'}（{b.nature || ''}{b.severe ? '·重' : ''}{b.targetRetro ? '·被围者逆行' : ''}）：
											{(b.besiegers || []).map((x) => `${clsPlanetCnUI(x.id)}（${ASPECT_CN[Math.abs(x.aspect)] || (Math.abs(x.aspect) + '°')} 差${typeof x.delta === 'number' ? x.delta.toFixed(1) : '—'}°${x.retro ? '·逆' : ''}）`).join('＋')}
											{(b.defense || []).length ? '；协防：' + b.defense.map((d) => `${clsPlanetCnUI(d.id)}（${ASPECT_CN[Math.abs(d.aspect)] || (Math.abs(d.aspect) + '°')}解${clsPlanetCnUI(d.against)}侧${d.strong ? '·有力' : ''}）`).join('、') : ''}
										</span>
									</div>
								))}
							</div>
						) : null}
						<div className="horosa-divi-legend">各征象星力量：入庙旺=有力；落陷/游走/燃烧/逆行=无力或受损；角宫快而有力，果宫弱而拖延。</div>
						{Object.keys(j.conditions).map((k) => {
							const c = j.conditions[k];
							const role = k === sig.querentKey ? '（问卜者）' : (k === sig.quesitedKey ? '（' + (sig.quesitedLabel || '事项') + '）' : (k === 'moon' ? '（共同征象）' : ''));
							return (
								<div key={k} className="horosa-divi-card">
									<div className="horosa-divi-card-head">{cn(k)}<span style={{ fontWeight: 400, opacity: 0.7 }}>{role}</span> <span className="horosa-divi-sev" style={{ background: c.score > 0 ? '#2f9e6f' : (c.score < 0 ? '#cf5b45' : '#93a1b0'), minWidth: 52 }}>力量 {c.score > 0 ? '+' : ''}{c.score}</span></div>
									<div className="horosa-divi-kv" style={{ opacity: 0.85 }}>{plainState(facts, k)}</div>
									{c.findings.map((f, i) => <div key={i} className={'horosa-divi-testi ' + (f.polarity === 'positive' ? 'is-pos' : (f.polarity === 'negative' ? 'is-neg' : ''))}><span className="dot">{f.polarity === 'positive' ? '▲' : (f.polarity === 'negative' ? '▼' : '·')}</span><span>{f.text_zh}</span></div>)}
								</div>
							);
						})}
					</div>
				</TabPane>

				<TabPane tab="完成" key="perfection">
					<div className="horosa-divi-judge">
						<div className="horosa-divi-legend">「完成法」＝两颗征象星怎样接通：① <b>入相位</b>（直接成相）；② <b>光线传递</b>（第三颗星先离开 A、再去接 B，当中间人）；③ <b>光线汇集</b>（两星都去接同一颗较重星）；④ <b>落位</b>。接不上 / 被抢先 / 燃烧 / 刚出相＝难成。下面把所有线索摆出，供你自行判断。</div>
						<div className="horosa-divi-card">
							<div className="horosa-divi-card-head">本盘命中的完成 / 破坏</div>
							{perf ? perf.detail.map((d, i) => <div key={i} className="horosa-divi-testi"><span className="dot">·</span><span>{d}</span></div>) : <div className="horosa-divi-line">征象星不全，无法判断完成法。</div>}
						</div>
						<div className="horosa-divi-card">
							<div className="horosa-divi-card-head">月亮的故事（过去 → 未来）</div>
							<div className="horosa-divi-legend">月亮刚离开的星＝事情来由/已过；接下来要会的星＝事情走向/将发生（卜卦最重要的线索之一）。</div>
							{moonStory.separating.slice(0, 2).map((a, i) => <div key={'sep' + i} className="horosa-divi-testi"><span className="dot">↤</span><span>月 刚离开 {cn(a.other)}（{ASPECT_CN[a.angle]}，已过 {a.orb.toFixed(1)}°）</span></div>)}
							{moonStory.applying.length ? moonStory.applying.slice(0, 3).map((a, i) => <div key={'app' + i} className={'horosa-divi-testi ' + (a.nature === 'positive' ? 'is-pos' : (a.nature === 'negative' ? 'is-neg' : ''))}><span className="dot">↦</span><span>月 接下来会 {cn(a.other)}（{ASPECT_CN[a.angle]}，还差 {a.orb.toFixed(1)}°）</span></div>) : <div className="horosa-divi-line">月亮接下来无主相位（空亡）。</div>}
							{(moonStory.immediate && moonStory.immediate.length) ? (
								<div className="horosa-divi-kv" style={{ opacity: 0.8, marginTop: 6 }}>后端实测（按紧密度序·权威）：{moonStory.immediate.slice(0, 4).map((a) => `${cn(a.other)} ${ASPECT_CN[a.angle]} 差${a.orb.toFixed(1)}°`).join('；')}</div>
							) : null}
							{j.moonFinal ? (
								<div className={'horosa-divi-testi ' + (j.moonFinal.angle === 90 || j.moonFinal.angle === 180 ? 'is-neg' : 'is-pos')}><span className="dot">◑</span><span>本座终局相位：与 {cn(j.moonFinal.other)} 成{ASPECT_CN[j.moonFinal.angle]}（约 {j.moonFinal.tDays} 天后精确）→ 事之收尾{j.moonFinal.angle === 90 || j.moonFinal.angle === 180 ? '偏凶' : '偏吉'}。</span></div>
							) : null}
						</div>
						<div className="horosa-divi-card">
							<div className="horosa-divi-card-head">相位全览（七政之间）</div>
							<div className="horosa-divi-legend">所有成相的星对，供你核对征象。<b>入相</b>＝正在靠近、主未来/将成；<b>出相</b>＝正在远离、主过去/已过。</div>
							{allAspects.length ? allAspects.map((a, i) => (
								<div key={i} className={'horosa-divi-testi ' + (a.nature === 'positive' ? 'is-pos' : (a.nature === 'negative' ? 'is-neg' : ''))}>
									<span className="dot">{a.applying ? '↦' : '↤'}</span>
									<span>{cn(a.a)} {ASPECT_CN[a.angle]} {cn(a.b)} · {a.applying ? '入相' : '出相'} · 差 {a.orb.toFixed(1)}°{a.exact ? ' · 正相位！' : ''}</span>
								</div>
							)) : <div className="horosa-divi-line">七政之间暂无成相。</div>}
						</div>
						<div className="horosa-divi-card">
							<div className="horosa-divi-card-head">完成度（三分法则）</div>
							<div className="horosa-divi-legend">把命主、月亮、事项星三颗当「三大征象」，数有几颗「安全」（不逆行 / 不燃烧 / 不落陷）。安全越多，越能办成。</div>
							<div className="horosa-divi-kv">安全 <b>{j.thirds.count}/{j.thirds.total}</b> → {({ all: '三颗全安全 → 大致可圆满达成', '2/3': '两颗安全 → 约完成三分之二', '1/3': '一颗安全 → 约完成三分之一', none: '皆不安全 → 难成 / 易败坏' })[j.thirds.fraction] || j.thirds.fraction}</div>
						</div>
						{opts.antiscia !== false ? (
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">映点 / 对映点全表</div>
								<div className="horosa-divi-legend">映点＝关于至点轴（巨蟹–摩羯 0°）的镜像 (180°−λ)，力量≈<b>合相</b>（隐藏联结）；对映点 (360°−λ)＝映点之冲，主分离对立。命中其它行星/四轴/宫头 ≤1° 者高亮并计入判读。</div>
								<div style={{ overflowX: 'auto' }}>
									<table className="horosa-divi-table" style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
										<thead><tr style={{ opacity: 0.7, textAlign: 'left' }}><th style={{ padding: '2px 6px' }}>星</th><th style={{ padding: '2px 6px' }}>映点</th><th style={{ padding: '2px 6px' }}>命中</th><th style={{ padding: '2px 6px' }}>对映点</th><th style={{ padding: '2px 6px' }}>命中</th></tr></thead>
										<tbody>
											{buildAntisciaTable(facts, opts.antisciaOrb).map((r) => (
												<tr key={r.key} style={{ borderTop: '1px dashed rgba(148,163,184,.2)' }}>
													<td style={{ padding: '2px 6px' }}>{r.cn}</td>
													<td style={{ padding: '2px 6px' }}>{r.antiText}</td>
													<td style={{ padding: '2px 6px', color: r.antiHits.length ? 'var(--horosa-accent, #b8860b)' : undefined, fontWeight: r.antiHits.length ? 600 : 400 }}>{r.antiHits.join('、') || '—'}</td>
													<td style={{ padding: '2px 6px' }}>{r.contraText}</td>
													<td style={{ padding: '2px 6px', color: r.contraHits.length ? 'var(--horosa-cinnabar, #b71c1c)' : undefined, fontWeight: r.contraHits.length ? 600 : 400 }}>{r.contraHits.join('、') || '—'}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						) : null}
						<div className="horosa-divi-muted">抢先/截断时序判据：{opts.interferenceTiming === 'speed' ? '按速度折算到达时间' : '按度差近似（古典通行）'}{opts.orbMode === 'sequence' ? ' · 序列模式（无-orb,看最终精确）' : ''} · 严格度：{opts.perfectionStrict === 'lenient' ? '宽松（不作机械截断）' : (opts.perfectionStrict === 'strict' ? '严格（硬相位接纳仅减损不免破）' : '标准')} · 考量硬度：{opts.considerationsMode === 'lenient' ? '宽松' : (opts.considerationsMode === 'strict' ? '严格' : '警示')}。</div>
					</div>
				</TabPane>

				<TabPane tab="古典" key="reception">
						<div className="horosa-divi-judge">
							<div className="horosa-divi-legend">接纳＝一星「作客」于另一星的尊贵处（庙/旺/三分/界/面）→ 后者以礼相待、愿助其事。<b>正接纳</b>（居对方庙旺等强位）能化解凶相、助成；<b>互容</b>（彼此接纳）尤吉；供方落陷弱位时标「拒绝」。卜卦判断中，征象星间有无接纳，往往决定成败与意愿。</div>
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">接纳关系</div>
								{(cls.recNormal.length || cls.recAbnormal.length) ? [
									(cls.recNormal.length ? <div key="rnh" className="horosa-divi-line" style={{ fontWeight: 600 }}>正接纳</div> : null),
									...cls.recNormal.map((it, i) => (
										<div key={'rn' + i} className="horosa-divi-testi is-pos">
											<span className="dot">✦</span>
											<span>{gly(it.beneficiary)} 被 {gly(it.supplier)} 接纳（{dignCn(it.supplierRulerShip)}）{hasRefuse(it.supplierRulerShip) ? <span style={{ color: 'var(--horosa-cinnabar, #b71c1c)' }}> · 拒绝</span> : null}</span>
										</div>
									)),
									(cls.recAbnormal.length ? <div key="rah" className="horosa-divi-line" style={{ fontWeight: 600, marginTop: 4 }}>邪接纳（借次尊贵 / 弱位）</div> : null),
									...cls.recAbnormal.map((it, i) => (
										<div key={'ra' + i} className="horosa-divi-testi">
											<span className="dot">◦</span>
											<span>{gly(it.beneficiary)} 被 {gly(it.supplier)} 接纳（{dignCn(it.supplierRulerShip)}）{hasRefuse(it.supplierRulerShip) ? <span style={{ color: 'var(--horosa-cinnabar, #b71c1c)' }}> · 拒绝</span> : null}</span>
										</div>
									)),
								] : <div className="horosa-divi-line">七政之间暂无接纳关系。</div>}
							</div>
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">互容（Mutual Reception）</div>
								{(cls.mutNormal.length || cls.mutAbnormal.length) ? [
									(cls.mutNormal.length ? <div key="mnh" className="horosa-divi-line" style={{ fontWeight: 600 }}>正互容</div> : null),
									...cls.mutNormal.map((m, i) => (
										<div key={'mn' + i} className="horosa-divi-testi is-pos">
											<span className="dot">⇄</span>
											<span>{gly((m.planetA||{}).id)}（{dignCn((m.planetA||{}).rulerShip)}） 与 {gly((m.planetB||{}).id)}（{dignCn((m.planetB||{}).rulerShip)}） 互容</span>
										</div>
									)),
									(cls.mutAbnormal.length ? <div key="mah" className="horosa-divi-line" style={{ fontWeight: 600, marginTop: 4 }}>邪互容</div> : null),
									...cls.mutAbnormal.map((m, i) => (
										<div key={'ma' + i} className="horosa-divi-testi">
											<span className="dot">⇄</span>
											<span>{gly((m.planetA||{}).id)}（{dignCn((m.planetA||{}).rulerShip)}） 与 {gly((m.planetB||{}).id)}（{dignCn((m.planetB||{}).rulerShip)}） 互容</span>
										</div>
									)),
								] : <div className="horosa-divi-line">无互容。</div>}
							</div>
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">逐星必然尊贵明细</div>
								<div style={{ overflowX: 'auto' }}>
									<table className="horosa-divi-table" style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
										<thead><tr style={{ opacity: 0.7, textAlign: 'left' }}><th style={{ padding: '2px 6px' }}>星</th><th style={{ padding: '2px 6px' }}>落座</th><th style={{ padding: '2px 6px' }}>尊贵 token</th><th style={{ padding: '2px 6px' }}>计分</th></tr></thead>
										<tbody>
											{['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].filter((k) => facts.planets[k]).map((k) => {
												const p = facts.planets[k];
												return (
													<tr key={k} style={{ borderTop: '1px dashed rgba(148,163,184,.2)' }}>
														<td style={{ padding: '2px 6px' }}>{cn(k)}</td>
														<td style={{ padding: '2px 6px' }}>{(SIGNS[p.sign] || {}).cn || p.sign} {p.signlon !== undefined ? p.signlon.toFixed(1) + '°' : ''}</td>
														<td style={{ padding: '2px 6px' }}>{(p.selfDignity && p.selfDignity.length) ? dignCn(p.selfDignity) : (p.peregrine ? '游走（无尊贵）' : '—')}</td>
														<td style={{ padding: '2px 6px', fontWeight: 600, color: p.dignityScore > 0 ? '#2f9e6f' : (p.dignityScore < 0 ? '#cf5b45' : undefined) }}>{p.dignityScore > 0 ? '+' : ''}{p.dignityScore}</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							</div>
							{opts.accidentalMode === 'lilly' ? (
								<div className="horosa-divi-card">
									<div className="horosa-divi-card-head">偶然尊贵满分表（±38）</div>
									<div className="horosa-divi-legend">1647 印本「Fortitudes and Debilities」全表逐项计分（逐宫定分/顺逆/迟疾/东西出入/月盈亏/太阳三态/紧密相/王者与凶恒星/围攻）。</div>
									{Object.keys(j.conditions).filter((k) => j.conditions[k].accidental).map((k) => {
										const a = j.conditions[k].accidental;
										return (
											<div key={k} style={{ marginBottom: 6 }}>
												<div className="horosa-divi-kv"><b>{cn(k)}</b> 合计 <b style={{ color: a.total > 0 ? '#2f9e6f' : (a.total < 0 ? '#cf5b45' : undefined) }}>{a.total > 0 ? '+' : ''}{a.total}</b></div>
												<div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
													{a.items.map((it, i) => (
														<span key={i} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 8, background: it.score > 0 ? 'rgba(47,158,111,.12)' : 'rgba(207,91,69,.12)', border: '1px solid ' + (it.score > 0 ? 'rgba(47,158,111,.3)' : 'rgba(207,91,69,.3)') }}>{it.text_zh}</span>
													))}
												</div>
											</div>
										);
									})}
								</div>
							) : null}
							<div className="horosa-divi-muted">接纳/互容由排盘引擎按庙旺三分界面尊贵自动判定（与「占星·古典」同源）；正接纳＝居对方庙旺等强位，邪接纳＝借次尊贵或弱位，供方落陷则标「拒绝」。</div>
							<div className="horosa-divi-muted" style={{ marginTop: 4 }}>本档三分制口径：<b>{j.tripSystem === 'dorothean' ? '三主制（含参与主，水象日主取金星）' : '简约制（水象三分主取火星）'}</b>。三分尊贵按此判力量强弱。</div>
						</div>
					</TabPane>

					<TabPane tab="时空" key="timing">
					<div className="horosa-divi-judge">
						<div className="horosa-divi-card">
							<div className="horosa-divi-card-head">何时（应期）</div>
							<div className="horosa-divi-line">{j.timing ? j.timing.text : '无准确相位，应期不定（多半不成或需另择时）。'}</div>
							{j.timing && j.timing.variant ? <div className="horosa-divi-muted">变体：{({ applied: '看被入相星', byHouse: '按宫（皆果→天/皆续→周/皆角→月）' })[j.timing.variant] || j.timing.variant}（基准星 {cn(j.timing.baseKey)}）</div> : null}
							{j.timing && j.timing.modifiers && j.timing.modifiers.length ? (
								<div style={{ marginTop: 4 }}>
									{j.timing.modifiers.map((m, i) => <div key={i} className="horosa-divi-testi"><span className="dot">↺</span><span>{m}</span></div>)}
									{j.timing.adjustedQuantity !== undefined ? <div className="horosa-divi-kv">修正后数目：约 <b>{j.timing.adjustedQuantity}</b> {j.timing.unit}（单位种类不变）</div> : null}
								</div>
							) : null}
							{j.timing && j.timing.secondLaw ? <div className="horosa-divi-muted" style={{ marginTop: 4 }}>{j.timing.secondLaw.text}</div> : null}
						</div>
						<div className="horosa-divi-card">
							<div className="horosa-divi-card-head">何处（方位）</div>
							<div className="horosa-divi-line">{j.queries.where ? `${j.queries.where.dir}（${j.queries.where.terrain}），距离${j.queries.where.distance}` : '本问题无方位指示。'}</div>
						</div>
						<div className="horosa-divi-card">
							<div className="horosa-divi-card-head">行星时（不等长时全表）</div>
							<div className="horosa-divi-legend">昼夜各 12 时,自日出起按迦勒底序（♄→♃→♂→☉→♀→☿→☽）循环;首时主星＝当日日主星。真实时长须按当地日出日落分段,此处给<b>序次表</b>与当前时主。</div>
							<div className="horosa-divi-kv">日主星 ＝ <span className="tag">{cn(facts.meta.dayRuler)}</span>；当前时主星 ＝ <span className="tag">{cn(j.hourRuler)}</span></div>
							{j.hourRuler && PLANETARY_HOURS[j.hourRuler] ? (
								<div className="horosa-divi-kv">本时象征（三段）：{PLANETARY_HOURS[j.hourRuler].join(' / ')}</div>
							) : null}
							{facts.meta.dayRuler ? (
								<div style={{ overflowX: 'auto', marginTop: 4 }}>
									<table className="horosa-divi-table" style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
										<thead><tr style={{ opacity: 0.7, textAlign: 'left' }}><th style={{ padding: '2px 6px' }}>时序</th>{Array.from({ length: 12 }, (_, i) => <th key={i} style={{ padding: '2px 4px' }}>{i + 1}</th>)}</tr></thead>
										<tbody>
											{[0, 12].map((base) => {
												const d0 = CHALDEAN_SEQ.indexOf(facts.meta.dayRuler);
												return (
													<tr key={base} style={{ borderTop: '1px dashed rgba(148,163,184,.2)' }}>
														<td style={{ padding: '2px 6px', opacity: 0.7 }}>{base === 0 ? '昼(日出起)' : '夜(日落起)'}</td>
														{Array.from({ length: 12 }, (_, i) => {
															const ruler = CHALDEAN_SEQ[(d0 + base + i) % 7];
															const isNow = ruler === j.hourRuler;
															return <td key={i} style={{ padding: '2px 4px', fontWeight: isNow ? 700 : 400, color: isNow ? 'var(--horosa-accent, #b8860b)' : undefined }}>{cn(ruler).replace('星', '')}</td>;
														})}
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							) : null}
						</div>
						{j.lots ? (
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">阿拉伯点（{j.lots.extended ? '核心可靠集' : '福点 / 精神点'}）</div>
								<div className="horosa-divi-legend">福点＝财物 / 失物 / 身体安顿之所；其<b>定位星</b>为该类问题的关键征象。福点昼夜公式按流派取（{j.lots.convention}）。</div>
								<div className="horosa-divi-kv">福点：{j.lots.fortune.signCn}座 {j.lots.fortune.signlon.toFixed(1)}°{j.lots.fortune.dispCn ? <span>，定位星 <span className="tag">{j.lots.fortune.dispCn}</span></span> : null}</div>
								<div className="horosa-divi-kv">精神点：{j.lots.spirit.signCn}座 {j.lots.spirit.signlon.toFixed(1)}°{j.lots.spirit.dispCn ? <span>，定位星 <span className="tag">{j.lots.spirit.dispCn}</span></span> : null}</div>
								{j.lots.extended ? (
									<div style={{ overflowX: 'auto', marginTop: 4 }}>
										<table className="horosa-divi-table" style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
											<thead><tr style={{ opacity: 0.7, textAlign: 'left' }}><th style={{ padding: '2px 6px' }}>点</th><th style={{ padding: '2px 6px' }}>位置</th><th style={{ padding: '2px 6px' }}>定位星</th><th style={{ padding: '2px 6px' }}>用途</th></tr></thead>
											<tbody>
												{j.lots.extended.filter((l) => l.id !== 'fortune' && l.id !== 'spirit').map((l) => (
													<tr key={l.id} style={{ borderTop: '1px dashed rgba(148,163,184,.2)' }}>
														<td style={{ padding: '2px 6px' }}>{l.cn}</td>
														<td style={{ padding: '2px 6px' }}>{l.signCn}座 {l.signlon.toFixed(1)}°</td>
														<td style={{ padding: '2px 6px' }}>{l.dispCn || '—'}</td>
														<td style={{ padding: '2px 6px', opacity: 0.75 }}>{l.use}</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								) : null}
							</div>
						) : null}
					</div>
				</TabPane>

				<TabPane tab="描述" key="describe">
					<div className="horosa-divi-judge">
						{(j.describe && j.describe.length) ? j.describe.map((d, i) => (
							<div key={i} className="horosa-divi-card">
								<div className="horosa-divi-card-head">{d.role}：{d.title}{d.temper ? <span style={{ fontWeight: 400, opacity: 0.7 }}>（性情{d.temper}）</span> : null}</div>
								<div className="horosa-divi-line">{d.body}</div>
							</div>
						)) : <div className="horosa-divi-note">本问题类别暂无人物/事物描述。</div>}
						{j.theft ? (
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">盗窃 / 失物（11 步）</div>
								<div className="horosa-divi-legend">失主＝命主＋月亮；盗贼＝7宫主 <b>{cn(j.theft.thief)}</b>；赃物＝2宫主 <b>{cn(j.theft.obj)}</b>；藏匿地＝4宫。</div>
								{j.theft.steps.map((s, i) => (
									<div key={i} className={'horosa-divi-testi ' + (s.polarity === 'positive' ? 'is-pos' : (s.polarity === 'negative' ? 'is-neg' : ''))}>
										<span className="dot" style={{ fontWeight: 600 }}>{s.label}</span><span>{s.text}</span>
									</div>
								))}
							</div>
						) : null}
						{(rad.moleHints && rad.moleHints.length) ? (
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">痣记验证（身体印记比对）</div>
								<div className="horosa-divi-legend">传统验盘法：命度/命主/六宫/月亮所落座对应身体部位——问卜者身上该处若真有痣/疤/记，则盘更可信（Consideration 的正面确认之一）。</div>
								{rad.moleHints.map((m, i) => (
									<div key={i} className="horosa-divi-testi">
										<span className="dot">◦</span>
										<span><b>{m.source}</b>（{(SIGNS[m.sign] || {}).cn || m.sign}）→ {Array.isArray(m.parts) ? m.parts.join('、') : m.parts}{m.side ? ` · ${m.side}` : ''}{m.frontBack ? ` · ${m.frontBack}` : ''}{m.updown ? ` · ${m.updown}` : ''}</span>
									</div>
								))}
							</div>
						) : null}
						<div className="horosa-divi-muted">描述取「征象星 落 星座」（Sibly 84 条）＋ 行星性情；小偷/疾病/死亡按类别叠加。</div>
					</div>
				</TabPane>
			</XQTabs>
		);
	}
}

export default HoraryJudgment;
