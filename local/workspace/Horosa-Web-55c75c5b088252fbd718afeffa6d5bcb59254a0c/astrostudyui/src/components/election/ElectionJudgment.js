import { Component } from 'react';
import { XQTabs, XQSegmented } from '../xq-ui';
import { runElection } from '../../divination/election/electionEngine';
import { judgeLayerOverrides } from '../../utils/judgeLayerOverrides';
import { buildElectionSnapshot } from '../../divination/election/electionSnapshot';
import { saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { aspectsOf } from '../../divination/engine/aspectsEngine';
import { lotDerivedHouses } from '../../divination/election/lotsEngine';
import { essentialMatrix, accidentalTable, receptionReport, facePositions } from '../../divination/election/dignityReport';
import { agrippaFaceImage } from '../../divination/data/decanImages';
import { PLANETS } from '../../divination/data/planets';

const TabPane = XQTabs.TabPane;
let _lastElectionSnap = '';
function cn(k){ return (PLANETS[k] || {}).cn || k; }
const ASPECT_CN = { 0: '合相', 60: '六合', 90: '四分(刑)', 120: '三合', 180: '对分(冲)' };
const PTOLEMAIC = [0, 60, 90, 120, 180];

const SEV = {
	critical: { cn: '严重·红线', cls: 'sev-critical' },
	high: { cn: '较重', cls: 'sev-high' },
	medium: { cn: '中等', cls: 'sev-medium' },
	low: { cn: '轻微', cls: 'sev-low' },
	info: { cn: '注记', cls: 'sev-info' },
};
const VERD = { good: { cn: '吉', color: '#2f9e6f' }, neutral: { cn: '平', color: '#3b82f6' }, caution: { cn: '留意', color: '#d2a01f' }, bad: { cn: '凶', color: '#cf5b45' } };
const GRADE = {
	excellent: { cn: '极佳', color: '#2f9e6f', desc: '窗口内难得的好时刻。' },
	good: { cn: '不错', color: '#1aa3b8', desc: '吉多于凶，可用。' },
	fair: { cn: '中等', color: '#3b82f6', desc: '吉凶参半，可再优化。' },
	poor: { cn: '欠佳', color: '#e07a3b', desc: '凶多于吉，建议换时刻。' },
	disqualified: { cn: '不宜（含红线）', color: '#cf3b3b', desc: '命中硬伤，强烈建议另择时刻。' },
};
function lineCls(pol){ return 'horosa-divi-testi' + (pol === 'positive' ? ' is-pos' : (pol === 'negative' ? ' is-neg' : '')); }
function barColor(verdict){ return (VERD[verdict] || VERD.neutral).color; }

class ElectionJudgment extends Component{
	constructor(props){
		super(props);
		// 阿拉伯点页的纯视图态(分组/派生宫开关),不入存档。
		this.state = { lotGroup: 'hermetic', lotDerive: 'none' };
	}
	componentDidMount(){ this.saveSnap(); }
	componentDidUpdate(){ this.saveSnap(); }

	// 尊贵强弱页:五重本质矩阵 + 偶然满分表 + Almuten 五点矩阵 + 接纳五级 + 面神像(折叠)。
	renderDignityTab(j){
		const facts = j.facts;
		const eff = j.calibre && j.calibre.eff;
		const ess = essentialMatrix(facts, eff);
		const acc = accidentalTable(facts, eff);
		const recs = receptionReport(facts);
		const af = facts.almuten || null;
		const faces = facePositions(facts);
		const dot = (v) => (v ? '●' : '');
		const AF_SEVEN = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
		return (
			<div className="horosa-divi-judge">
				<div className="horosa-divi-card">
					<div className="horosa-divi-card-head">五重本质尊贵矩阵 <span style={{ opacity: 0.55, fontWeight: 400 }}>界/三分随流派口径；庙5 旺4 三分3 界2 面1／陷−5 弱−4 外来−5</span></div>
					<div style={{ overflowX: 'auto' }}>
						<table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'center' }}>
							<thead><tr style={{ opacity: 0.65 }}>
								<th style={{ padding: '3px 4px', textAlign: 'left' }}>星</th><th>落座</th><th>庙</th><th>旺</th><th>三分</th><th>界</th><th>面</th><th>陷</th><th>弱</th><th>外来</th><th>小计</th>
							</tr></thead>
							<tbody>
								{ess.map((r) => (
									<tr key={r.key} style={{ borderTop: '1px dashed rgba(148,163,184,.18)' }}>
										<td style={{ padding: '3px 4px', textAlign: 'left', fontWeight: 600 }}>{r.cn}</td>
										<td>{r.signCn} {r.signlon !== undefined ? Math.floor(r.signlon) + '°' : ''}</td>
										<td style={{ color: '#2f9e6f' }}>{dot(r.domicile)}</td>
										<td style={{ color: '#2f9e6f' }}>{dot(r.exaltation)}</td>
										<td style={{ color: '#2f9e6f' }}>{r.triplicity ? '●' : (r.triplicityPart ? '共' : '')}</td>
										<td style={{ color: '#2f9e6f' }}>{dot(r.term)}</td>
										<td style={{ color: '#2f9e6f' }}>{dot(r.face)}</td>
										<td style={{ color: '#cf5b45' }}>{dot(r.detriment)}</td>
										<td style={{ color: '#cf5b45' }}>{dot(r.fall)}</td>
										<td style={{ color: '#cf5b45' }}>{dot(r.peregrine)}</td>
										<td style={{ fontWeight: 600, color: r.score > 0 ? '#2f9e6f' : (r.score < 0 ? '#cf5b45' : 'inherit') }}>{r.score > 0 ? '+' : ''}{r.score}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
				<div className="horosa-divi-card">
					<div className="horosa-divi-card-head">偶然尊贵满分表 <span style={{ opacity: 0.55, fontWeight: 400 }}>±38 域·1647 印本全表（宫位/顺逆/迟疾/东出西入/三态/紧密相位/王凶星/围攻）</span></div>
					{acc.map((r) => (
						<details key={r.key} style={{ margin: '2px 0' }}>
							<summary style={{ cursor: 'pointer', fontSize: 12.5, listStyle: 'none' }}>
								<span style={{ fontWeight: 600 }}>{r.cn}</span>
								<span style={{ float: 'right', fontWeight: 700, color: r.total > 0 ? '#2f9e6f' : (r.total < 0 ? '#cf5b45' : 'inherit') }}>{r.total > 0 ? '+' : ''}{r.total}</span>
							</summary>
							<div style={{ padding: '2px 0 4px 12px' }}>
								{r.items.map((it, i) => (
									<div key={i} className="horosa-divi-line" style={{ fontSize: 11.5, color: it.score > 0 ? '#2f9e6f' : '#cf5b45' }}>{it.text_zh}</div>
								))}
							</div>
						</details>
					))}
				</div>
				{af ? (
					<div className="horosa-divi-card">
						<div className="horosa-divi-card-head">Almuten Figuris（{af.points.length === 5 ? '五' : '四'}命点逐点计分）</div>
						<div style={{ overflowX: 'auto' }}>
							<table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'center' }}>
								<thead><tr style={{ opacity: 0.65 }}>
									<th style={{ padding: '3px 4px', textAlign: 'left' }}>命点</th>
									{AF_SEVEN.map((k) => <th key={k}>{cn(k)}</th>)}
								</tr></thead>
								<tbody>
									{af.points.map((pt) => (
										<tr key={pt.label} style={{ borderTop: '1px dashed rgba(148,163,184,.18)' }}>
											<td style={{ padding: '3px 4px', textAlign: 'left' }}>{pt.label}</td>
											{AF_SEVEN.map((k) => <td key={k} style={{ opacity: pt.scores[k] ? 1 : 0.3 }}>{pt.scores[k] || ''}</td>)}
										</tr>
									))}
									<tr style={{ borderTop: '1px solid rgba(148,163,184,.35)', fontWeight: 700 }}>
										<td style={{ padding: '3px 4px', textAlign: 'left' }}>合计</td>
										{AF_SEVEN.map((k) => <td key={k} style={{ color: af.winners.indexOf(k) >= 0 ? '#b8860b' : 'inherit' }}>{af.totals[k] || ''}</td>)}
									</tr>
								</tbody>
							</table>
						</div>
						<div className="horosa-divi-kv" style={{ marginTop: 4 }}>胜利星：<b style={{ color: '#b8860b' }}>{af.winners.map(cn).join('、')}</b>（{af.best} 分）{af.winners.length > 1 ? '——并列时以得派/近角/近区分光决胜' : ''}</div>
						{(af.caveats || []).map((c, i) => <div key={i} className="horosa-divi-note">{c}</div>)}
					</div>
				) : null}
				<div className="horosa-divi-card">
					<div className="horosa-divi-card-head">接纳与互容（五级：庙＞旺＞三分＞界＞面）</div>
					{recs.length ? recs.map((r, i) => (
						<div key={i} className={'horosa-divi-testi ' + (r.harmful ? 'is-neg' : (r.strong ? 'is-pos' : ''))}>
							<span className="dot">{r.harmful ? '✗' : (r.strong ? '✓' : '·')}</span><span>{r.text}</span>
						</div>
					)) : <div className="horosa-divi-line">本盘无接纳关系回传。</div>}
				</div>
				<details className="horosa-divi-card" style={{ display: 'block' }}>
					<summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 12.5 }}>面神像（上升度／月亮度所在十分度形像·默认收起）</summary>
					{faces.map((f, i) => {
						const img = agrippaFaceImage(f.sign, f.faceIndex);
						return (
							<div key={i} style={{ marginTop: 6 }}>
								<div className="horosa-divi-kv"><b>{f.label}</b>：{f.signCn} 第 {f.faceIndex + 1} 面（面主 {f.rulerCn}）</div>
								{img ? (
									<div style={{ fontSize: 11.5, opacity: 0.8, paddingLeft: 10 }}>
										<div>形像：{img.agrippa}{img.picatrix ? `／又作:${img.picatrix}` : ''}</div>
										<div>征义：{img.meaning}</div>
									</div>
								) : null}
							</div>
						);
					})}
				</details>
			</div>
		);
	}

	// 择前考量页:三组清单 ✓/✗ + 原意 + 本盘实测;第7宫=占星师单独高亮;不计分。
	renderConsiderationsTab(j){
		const c = j.considerations;
		if(!c) return <div className="horosa-divi-judge"><div className="horosa-divi-note">无考量数据。</div></div>;
		const vColor = c.verdict === 'good' ? '#2f9e6f' : (c.verdict === 'caution' ? '#d2a01f' : '#cf5b45');
		const row = (it, i) => {
			const info = it.severity === 'info';
			const miss = !it.hit;
			const cls = info ? '' : (it.hit ? ' is-neg' : ' is-pos');
			return (
				<details key={it.key + i} style={{ margin: '1px 0' }}>
					<summary style={{ cursor: 'pointer', listStyle: 'none' }} className={'horosa-divi-testi' + cls}>
						<span className="dot">{info ? '·' : (it.hit ? '✗' : '✓')}</span>
						<span>{it.title}{it.detail ? <span style={{ opacity: 0.6 }}>　{it.detail}</span> : null}</span>
					</summary>
					<div className="horosa-divi-note" style={{ paddingLeft: 22 }}>{it.meaning}{miss && !info ? '（本盘未命中）' : ''}</div>
				</details>
			);
		};
		return (
			<div className="horosa-divi-judge">
				<div className="horosa-divi-card">
					<div className="horosa-divi-banner">
						<span style={{ fontWeight: 700 }}>本盘可判性</span>
						<span className="horosa-divi-sev" style={{ background: vColor, minWidth: 64, fontSize: 12, padding: '2px 10px' }}>{c.verdictCn}</span>
						<span style={{ opacity: 0.6, fontSize: 12 }}>命中 {c.hitCount} 条</span>
					</div>
					{c.astrologer7th.length ? (
						<div className="horosa-divi-kv" style={{ marginTop: 4, color: '#cf5b45' }}>
							⚠ 第 7 宫＝占星师：{c.astrologer7th.map((x) => x.title).join('；')}——判读可靠性受扰（提示,不计入择吉分）。
						</div>
					) : null}
					<div className="horosa-divi-note">择前考量为「暂停反思」的格言式警示,不自动否决;逐条点开看原意。默认不计入总分。</div>
				</div>
				<div className="horosa-divi-card">
					<div className="horosa-divi-card-head">判断前的考量（1647 印本十条＋并列旗标）</div>
					{c.lilly.map(row)}
				</div>
				<div className="horosa-divi-card">
					<div className="horosa-divi-card-head">月之十损（1653 复原本·凡月损必避）</div>
					{c.ramesey.map(row)}
				</div>
				<div className="horosa-divi-card">
					<div className="horosa-divi-card-head">考量书要点（13 世纪一百四十六条精粹）</div>
					{c.bonatti.map(row)}
				</div>
			</div>
		);
	}

	// 「Lot 作上升」派生宫位:none/fortune/spirit。
	renderLotsTab(j){
		const lots = (j.facts && j.facts.lots) || { hermetic: [], topical: [], byId: {} };
		const group = this.state.lotGroup;
		const rows = group === 'hermetic' ? lots.hermetic : (group === 'topical' ? lots.topical : lots.hermetic.concat(lots.topical));
		const deriveKey = this.state.lotDerive;
		const deriveRow = deriveKey !== 'none' ? lots.byId[deriveKey] : null;
		const derived = deriveRow ? lotDerivedHouses(j.facts, deriveRow.lon) : null;
		const topicIds = j.facts.topicLotIds || [];
		return (
			<div className="horosa-divi-judge">
				<div className="horosa-divi-legend">
					公式一律 上升＋X−Y（对 360° 取模），夜生按各点传统决定是否对调；福点与盘面同源，精神点为福点关于上升之镜像。婚姻/爱欲构造可在左栏「流派口径」切换。
				</div>
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
					<XQSegmented size="small" value={group}
						options={[{ label: '七赫尔墨斯', value: 'hermetic' }, { label: '分科点', value: 'topical' }, { label: '全部', value: 'all' }]}
						onChange={(e) => this.setState({ lotGroup: (e && e.target) ? e.target.value : e })} />
					<XQSegmented size="small" value={deriveKey}
						options={[{ label: '不派生', value: 'none' }, { label: '福点作升', value: 'fortune' }, { label: '精神作升', value: 'spirit' }]}
						onChange={(e) => this.setState({ lotDerive: (e && e.target) ? e.target.value : e })} />
				</div>
				<div className="horosa-divi-card">
					<div className="horosa-divi-card-head">阿拉伯点位置表{topicIds.length ? <span style={{ opacity: 0.55, fontWeight: 400 }}>　本用事关联：{topicIds.map((id) => (lots.byId[id] ? lots.byId[id].cn : id)).join('、')}</span> : null}</div>
					<div style={{ overflowX: 'auto' }}>
						<table className="horosa-divi-table" style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
							<thead>
								<tr style={{ opacity: 0.65, textAlign: 'left' }}>
									<th style={{ padding: '4px 6px' }}>点</th>
									<th style={{ padding: '4px 6px' }}>位置</th>
									<th style={{ padding: '4px 6px' }}>落宫</th>
									<th style={{ padding: '4px 6px' }}>定位星</th>
									<th style={{ padding: '4px 6px' }}>司掌</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((r) => (
									<tr key={r.id} style={{ borderTop: '1px dashed rgba(148,163,184,.18)', background: topicIds.indexOf(r.id) >= 0 ? 'var(--horosa-accent-soft, rgba(184,134,11,0.08))' : 'transparent' }}>
										<td style={{ padding: '4px 6px', fontWeight: topicIds.indexOf(r.id) >= 0 ? 600 : 400 }}>{r.cn}{r.note ? <span style={{ opacity: 0.6 }}>（{r.note}）</span> : ''}</td>
										<td style={{ padding: '4px 6px' }}>{r.signCn} {r.signlon}°</td>
										<td style={{ padding: '4px 6px' }}>{r.house ? `${r.house} 宫` : '—'}</td>
										<td style={{ padding: '4px 6px' }}>{r.dispositorCn}</td>
										<td style={{ padding: '4px 6px', opacity: 0.75 }}>{r.use}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
				{derived ? (
					<div className="horosa-divi-card">
						<div className="horosa-divi-card-head">派生整宫（以{deriveRow.cn}所在 {deriveRow.signCn} 为第 1 位）</div>
						{['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].map((k) => (
							derived[k] ? <div key={k} className="horosa-divi-testi"><span className="dot">·</span><span>{cn(k)} 在自{deriveRow.cn}起第 {derived[k]} 位{derived[k] === 1 || derived[k] === 10 ? '（要位）' : (derived[k] === 11 ? '（获取之所）' : '')}</span></div> : null
						))}
						<div className="horosa-divi-note">自福点数第 10/1 位重物质显达、第 11 位为获取之所；自精神点同法论心智与事业行动。</div>
					</div>
				) : null}
			</div>
		);
	}
	saveSnap(){
		if(!this._j) return;
		try{ const t = buildElectionSnapshot(this._j); if(t && t !== _lastElectionSnap){ _lastElectionSnap = t; saveModuleAISnapshot('election', t, {}); } }catch(e){ /* noop */ }
	}
	render(){
		const { chart, topicId, natalFacts, mundaneSet, westSchool, surgeryPart, crisisBase, electionParams, tradeSide, talismanStar, surgeryPartOpposite } = this.props;
		let j = null; let err = null;
		// 判读全局层(judgeLayerOverrides 只含用户改过的键;默认 {} = 行为字节不变)
		// + 左栏「流派口径」逐项覆盖(electionParams;''=随流派)+分科专属输入(买卖方向/护符主星/部位对宫)。
		try{ j = chart ? runElection(chart, topicId, natalFacts, mundaneSet, { westSchool, surgeryPart, crisisBase, ...judgeLayerOverrides(), electionParams: electionParams || null, tradeSide: tradeSide || '', talismanStar: talismanStar || null, surgeryPartOpposite: !!surgeryPartOpposite }) : null; }catch(e){ err = e; console.error('runElection failed', e); }
		this._j = j;
		if(!chart) return <div className="horosa-divi-judge"><div className="horosa-divi-note">排盘中…</div></div>;
		if(err || !j) return <div className="horosa-divi-judge"><div className="horosa-divi-note">判断生成失败：{String((err && err.message) || err || '无结果')}</div></div>;

		const o = j.overall;
		const g = GRADE[o.grade] || GRADE.fair;
		const moonApply = (j.facts && aspectsOf(j.facts, 'moon').filter((a) => a.applying && PTOLEMAIC.indexOf(a.angle) >= 0)) || [];
		const critCount = j.hard_flags.filter((f) => f.severity === 'critical').length;
		const highCount = j.hard_flags.filter((f) => f.severity === 'high').length;
		const tp = j.topicPack;

		return (
			<XQTabs defaultActiveKey="overall" className="horosa-inspector-tabs horosa-content-tabs">
				<TabPane tab="总评" key="overall">
					<div className="horosa-divi-judge">
						<div className="horosa-divi-card">
							<div className="horosa-divi-banner">
								<span className="horosa-divi-score" style={{ color: g.color }}>{o.score}<small> /100</small></span>
								<span className="horosa-divi-sev" style={{ background: g.color, minWidth: 64, fontSize: 12, padding: '2px 10px' }}>{g.cn}</span>
							</div>
							<div className="horosa-divi-kv" style={{ opacity: 0.8 }}>{g.desc}</div>
							<div className="horosa-divi-kv" style={{ marginTop: 4 }}>{o.headline}</div>
							{(critCount || highCount) ? <div className="horosa-divi-kv" style={{ marginTop: 2 }}>红线命中：{critCount ? `严重 ${critCount} 项` : ''}{critCount && highCount ? '、' : ''}{highCount ? `较重 ${highCount} 项` : ''}（详见「红线」页）</div> : null}
						</div>
						<div className="horosa-divi-card">
							<div className="horosa-divi-card-head">起盘时刻（哪一刻 ＝ 这张盘）</div>
							<div className="horosa-divi-line">{j.castMoment}</div>
						</div>
						<div className="horosa-divi-card">
							<div className="horosa-divi-card-head">各分项评分（满分 100）</div>
							{j.sections.map((s) => (
								<div key={s.key} className="horosa-divi-barrow">
									<span className="lbl">{s.title}</span>
									<span className="horosa-divi-bar"><i style={{ width: s.score + '%', background: barColor(s.verdict) }} /></span>
									<span className="num">{s.score}</span>
								</div>
							))}
						</div>
						<div className="horosa-divi-note">{o.no_perfect_chart_note}</div>
					</div>
				</TabPane>

				<TabPane tab="红线" key="flags">
					<div className="horosa-divi-judge">
						<div className="horosa-divi-legend">
							「红线」＝ 对本用事的硬伤。<b style={{ color: '#cf3b3b' }}>严重</b>＝几乎应避开或换时辰；<b style={{ color: '#e07a3b' }}>较重</b>＝明显代价；<b style={{ color: '#d2a01f' }}>中等</b>/<b style={{ color: '#93a1b0' }}>轻微</b>＝小瑕疵。命中越多越重，分数越低。
						</div>
						<div className="horosa-divi-card">
							{j.hard_flags.length === 0
								? <div className="horosa-divi-testi is-pos"><span className="dot">✓</span><span>未命中任何红线，无明显硬伤。</span></div>
								: j.hard_flags.map((f, i) => {
									const sev = SEV[f.severity] || SEV.low;
									return (
										<div key={i} className="horosa-divi-flag">
											<span className={'horosa-divi-sev ' + sev.cls}>{sev.cn}</span>
											<span className="msg">{f.message}</span>
										</div>
									);
								})}
						</div>
					</div>
				</TabPane>

				<TabPane tab="分项" key="sections">
					<div className="horosa-divi-judge">
						<div className="horosa-divi-legend">按择日优先级排序：月亮 ＞ 命主星 ＞ 命度 ＞ 徵象星 ＞ 角宫… 每项满分 100。</div>
						{j.sections.map((s) => {
							const verd = VERD[s.verdict] || VERD.neutral;
							return (
								<div key={s.key} className="horosa-divi-card">
									<div className="horosa-divi-card-head">{s.title} <span className="horosa-divi-sev" style={{ background: verd.color, minWidth: 34 }}>{verd.cn}</span> <span style={{ opacity: 0.55, fontWeight: 400 }}>{s.score}/100</span></div>
									{s.findings.length ? s.findings.map((f, i) => <div key={i} className={lineCls(f.polarity)}><span className="dot">{f.polarity === 'positive' ? '▲' : (f.polarity === 'negative' ? '▼' : '·')}</span><span>{f.text_zh || f.message}</span></div>) : <div className="horosa-divi-line">无特别证词，状态平平。</div>}
									{s.detail_md ? <div className="horosa-divi-muted">{s.detail_md}</div> : null}
								</div>
							);
						})}
						{tp ? (
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">用事专属条件（{j.topic.cn}） <span style={{ opacity: 0.55, fontWeight: 400 }}>满足 {tp.passed}/{tp.total}</span></div>
								{tp.items.length ? tp.items.map((it, i) => (
									<div key={'tp' + i} className={'horosa-divi-testi ' + (it.pass ? 'is-pos' : 'is-neg')}>
										<span className="dot">{it.pass ? '✓' : '✗'}</span>
										<span><b>{it.kind === 'avoid' ? '忌' : '宜'}</b>：{it.label}</span>
									</div>
								)) : <div className="horosa-divi-line">本用事暂无可量化的专属条件。</div>}
								{tp.notes ? <div className="horosa-divi-note">{tp.notes}</div> : null}
							</div>
						) : null}
					</div>
				</TabPane>

				<TabPane tab="尊贵强弱" key="dignity">
					{this.renderDignityTab(j)}
				</TabPane>

				<TabPane tab="阿拉伯点" key="lots">
					{this.renderLotsTab(j)}
				</TabPane>

				<TabPane tab="择前考量" key="considerations">
					{this.renderConsiderationsTab(j)}
				</TabPane>

				<TabPane tab="应期" key="timing">
					<div className="horosa-divi-judge">
						<div className="horosa-divi-card">
							<div className="horosa-divi-card-head">月亮入相位（应期：约 1°≈1 时间单位）</div>
							{moonApply.length ? moonApply.map((a, i) => <div key={i} className="horosa-divi-testi"><span className="dot">·</span><span>月 → {cn(a.other)} {ASPECT_CN[a.angle] || a.angle + '°'}（尚差 {a.orb.toFixed(1)}°）</span></div>) : <div className="horosa-divi-line">月亮无入相位（或已空亡）。</div>}
						</div>
						{j.crisis ? (
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">危象日参照（手术·~7 日律）</div>
								<div className="horosa-divi-line">{j.crisis.text}</div>
								<div className="horosa-divi-note" style={{ marginTop: 4 }}>月自病始每行 45°（约 3.5 日）为一危象节点：45/90/180/270°。手术宜避危象节点前后，纯参照不计分。</div>
							</div>
						) : null}
						<div className="horosa-divi-note">把择日盘当事件本命盘：宫内星＝初期，宫主星＝后期；多个相位在同一时段成正相位 → 该期影响显著。</div>
					</div>
				</TabPane>

				<TabPane tab="合参" key="heshen">
						<div className="horosa-divi-judge">
							<div className="horosa-divi-legend">合参三段 ＝ 本命过运（永久过运）／时主吉运期（年月日限·法达大运子运·ZR L1/L2）／回归盘与主限。事在人为 ＋ 本命盘 ＞ 择日盘。左栏可选本命盘并按需拉时势/日月返/主限。</div>
							{(() => {
								const notes = (j.natal && j.natal.available && j.natal.notes) || [];
								const transitNotes = notes.filter((n) => n.kind !== 'timelord');
								const tlNotes = notes.filter((n) => n.kind === 'timelord');
								const row = (n, i, pre) => (
									<div key={pre + i} className={'horosa-divi-testi ' + (n.pol === 'positive' ? 'is-pos' : (n.pol === 'negative' ? 'is-neg' : ''))}>
										<span className="dot">{n.pol === 'positive' ? '▲' : (n.pol === 'negative' ? '▼' : '·')}</span><span>{n.text}</span>
									</div>
								);
								return (
									<>
										<div className="horosa-divi-card">
											<div className="horosa-divi-card-head">一 · 本命过运</div>
											{j.natal && j.natal.available
												? (transitNotes.length ? transitNotes.map((n, i) => row(n, i, 'n')) : <div className="horosa-divi-line">未见明显过运合参要点。</div>)
												: <div className="horosa-divi-line">左栏「选本命盘合参」后，显示择日 × 本命过运。</div>}
										</div>
										<div className="horosa-divi-card">
											<div className="horosa-divi-card-head">二 · 时主吉运期（择吉须落在当事人吉运期内）</div>
											{j.natal && j.natal.available
												? (tlNotes.length ? tlNotes.map((n, i) => row(n, i, 't')) : <div className="horosa-divi-line">本命出生数据不足，时主段未解。</div>)
												: <div className="horosa-divi-line">选本命盘后，显示年/月/日限、法达大运子运、ZR L1/L2 与其主星在事盘的状态。</div>}
											<div className="horosa-divi-note">法达夜序交点位与 ZR 释放点可在左栏「流派口径 → 合参」切换。</div>
										</div>
									</>
								);
							})()}
							{(() => {
								const { judgeReturnFacts } = require('../../divination/election/returnCharts');
								const rs = this.props.returnSet;
								const pd = this.props.pdHits;
								const rows = [];
								if(rs && rs.solar){ rows.push(...judgeReturnFacts('日返', rs.solar)); }
								if(rs && rs.lunar){ rows.push(...judgeReturnFacts('月返', rs.lunar)); }
								return (
									<div className="horosa-divi-card">
										<div className="horosa-divi-card-head">三 · 回归盘与主限（按需拉取）</div>
										{rows.length ? rows.map((n, i) => (
											<div key={'r' + i} className={'horosa-divi-testi ' + (n.pol === 'positive' ? 'is-pos' : (n.pol === 'negative' ? 'is-neg' : ''))}>
												<span className="dot">{n.pol === 'positive' ? '▲' : (n.pol === 'negative' ? '▼' : '·')}</span><span>{n.text}</span>
											</div>
										)) : <div className="horosa-divi-line">左栏「拉日/月返盘」后，显示择日时刻所处日返/月返之利钝（日返 365.25 日、月返 27.3 恒星月还度）。</div>}
										{pd ? (
											pd.length ? (
												<div style={{ marginTop: 6 }}>
													<div className="horosa-divi-kv" style={{ fontWeight: 600 }}>择日日期前后主限命中（±240 日内最近 {pd.length} 条）：</div>
													{pd.map((h, i) => (
														<div key={'pd' + i} className="horosa-divi-testi"><span className="dot">·</span>
															<span>{h.date}（{h.deltaDays >= 0 ? '+' : ''}{h.deltaDays} 日）：{h.significator} ← {h.promissor}{h.method ? `（${h.method}）` : ''}</span>
														</div>
													))}
												</div>
											) : <div className="horosa-divi-line" style={{ marginTop: 6 }}>±240 日内无主限命中回传。</div>
										) : <div className="horosa-divi-line" style={{ marginTop: 6 }}>左栏「拉主限命中」后，列出择日日期前后的主限方向（只读复用主限引擎；时间钥匙在流派口径→合参切换）。</div>}
									</div>
								);
							})()}
							<div className="horosa-divi-card">
								<div className="horosa-divi-card-head">四 · 时势合参</div>
								{j.mundane && j.mundane.available ? (
									j.mundane.notes.length ? j.mundane.notes.map((n, i) => (
										<div key={'m' + i} className={'horosa-divi-testi ' + (n.pol === 'positive' ? 'is-pos' : (n.pol === 'negative' ? 'is-neg' : ''))}>
											<span className="dot">{n.pol === 'positive' ? '▲' : (n.pol === 'negative' ? '▼' : '·')}</span><span>{n.text}</span>
										</div>
									)) : <div className="horosa-divi-line">未见明显时势合参要点。</div>
								) : <div className="horosa-divi-line">左栏「拉时势盘合参」后，显示择日命度 × 时势盘。</div>}
							</div>
						</div>
					</TabPane>

				<TabPane tab="建议" key="advice">
					<div className="horosa-divi-judge">
						<div className="horosa-divi-card">
							<div className="horosa-divi-card-head">建议与取舍</div>
							{j.recommendations.map((r, i) => <div key={i} className="horosa-divi-testi"><span className="dot">·</span><span>{r}</span></div>)}
						</div>
						<div className="horosa-divi-muted">消去法多候选并排比较见左栏「本日逐时择优 / 未来14日」。</div>
					</div>
				</TabPane>
			</XQTabs>
		);
	}
}

export default ElectionJudgment;
