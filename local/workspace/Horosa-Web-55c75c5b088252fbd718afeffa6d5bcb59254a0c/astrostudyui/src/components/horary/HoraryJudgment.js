import { Component } from 'react';
import { XQTabs } from '../xq-ui';
import { runHorary, ASPECT_CN } from '../../divination/horary/horaryEngine';
import { horaryJudgeOpts, schoolOf } from '../../divination/horary/horarySchools';
import { buildHorarySnapshot } from '../../divination/horary/horarySnapshot';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { PLANETS } from '../../divination/data/planets';
import { SIGNS } from '../../divination/data/signs';
import * as AstroText from '../../constants/AstroText';
import * as AstroConst from '../../constants/AstroConst';
import { getQuestionGuide } from '../../divination/horary/questionGuide';

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
	componentDidMount(){ this.saveSnap(); }
	componentDidUpdate(){ this.saveSnap(); }
	saveSnap(){
		if(!this._j) return;
		// [YA v42] 第二参传 chart:快照补 [古典接纳](chart.receptions/mutuals,古典 tab 同源数据)。
		try{ const t = buildHorarySnapshot(this._j, this.props.chart); if(t && t !== _lastHorarySnap){ _lastHorarySnap = t; saveModuleAISnapshot('horary', t, {}); } }catch(e){ /* noop */ }
	}
	render(){
		const { chart, category, schoolId } = this.props;
		const opts = horaryJudgeOpts(schoolId);
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
				<TabPane tab="裁决" key="verdict">
					<div className="horosa-divi-judge">
						<div className={'horosa-divi-verdict-big ' + lean.cls}>
							{lean.word}
							<div className="sub">{lean.sub}</div>
						</div>
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
							{sig.natural ? <div className="horosa-divi-kv">自然征象星（该事项的天然代表）＝ <span className="tag">{cn(sig.natural)}</span></div> : null}
							<div className="horosa-divi-kv">此刻「时主星」（活跃征象）＝ <span className="tag">{cn(j.hourRuler)}</span></div>
							{j.hourAgreement ? <div className={'horosa-divi-testi ' + (j.hourAgreement.agree ? 'is-pos' : '')}><span className="dot">{j.hourAgreement.agree ? '✓' : '·'}</span><span>{j.hourAgreement.text}</span></div> : null}
						</div>
						{(j.fixedStars && j.fixedStars.length) ? (
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">恒星会合（≤1°）</div>
								<div className="horosa-divi-legend">征象星 / 命度 / 天顶 紧密会合精选恒星 → 叠加该星吉凶之力（卜卦取少而精的一组恒星）。</div>
								{j.fixedStars.map((s, i) => (
									<div key={i} className={'horosa-divi-testi ' + (s.nature === 'boost' ? 'is-pos' : 'is-neg')}>
										<span className="dot">{s.nature === 'boost' ? '★' : '⚠'}</span>
										<span><b>{s.point}</b> 会合 <b>{s.star}</b>（{s.meaning}）</span>
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
							<div className="horosa-divi-muted">接纳/互容由排盘引擎按庙旺三分界面尊贵自动判定（与「占星·古典」同源）；正接纳＝居对方庙旺等强位，邪接纳＝借次尊贵或弱位，供方落陷则标「拒绝」。</div>
							<div className="horosa-divi-muted" style={{ marginTop: 4 }}>本档三分制口径：<b>{j.tripSystem === 'dorothean' ? '三主制（含参与主，水象日主取金星）' : '简约制（水象三分主取火星）'}</b>。三分尊贵按此判力量强弱。</div>
						</div>
					</TabPane>

					<TabPane tab="时空" key="timing">
					<div className="horosa-divi-judge">
						<div className="horosa-divi-card">
							<div className="horosa-divi-card-head">何时（应期）</div>
							<div className="horosa-divi-line">{j.timing ? j.timing.text : '无准确相位，应期不定（多半不成或需另择时）。'}</div>
						</div>
						<div className="horosa-divi-card">
							<div className="horosa-divi-card-head">何处（方位）</div>
							<div className="horosa-divi-line">{j.queries.where ? `${j.queries.where.dir}（${j.queries.where.terrain}），距离${j.queries.where.distance}` : '本问题无方位指示。'}</div>
						</div>
						{j.lots ? (
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">阿拉伯点（福点 / 精神点）</div>
								<div className="horosa-divi-legend">福点＝财物 / 失物 / 身体安顿之所；其<b>定位星</b>为该类问题的关键征象。福点昼夜公式按流派取（{j.lots.convention}）。</div>
								<div className="horosa-divi-kv">福点：{j.lots.fortune.signCn}座 {j.lots.fortune.signlon.toFixed(1)}°{j.lots.fortune.dispCn ? <span>，定位星 <span className="tag">{j.lots.fortune.dispCn}</span></span> : null}</div>
								<div className="horosa-divi-kv">精神点：{j.lots.spirit.signCn}座 {j.lots.spirit.signlon.toFixed(1)}°{j.lots.spirit.dispCn ? <span>，定位星 <span className="tag">{j.lots.spirit.dispCn}</span></span> : null}</div>
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
						<div className="horosa-divi-muted">描述取「征象星 落 星座」（Sibly 84 条）＋ 行星性情；小偷/疾病/死亡按类别叠加。</div>
					</div>
				</TabPane>
			</XQTabs>
		);
	}
}

export default HoraryJudgment;
