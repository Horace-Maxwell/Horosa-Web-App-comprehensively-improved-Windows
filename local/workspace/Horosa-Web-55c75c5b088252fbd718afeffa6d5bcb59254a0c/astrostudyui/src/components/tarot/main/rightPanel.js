// 塔罗页 · 右栏:各页签(每日一牌、雷诺曼、牌对、综合、是否判断、开钥、生日牌)
// 从 TarotMain.js 按职责拆出的 TarotMain 方法:this 仍是 TarotMain 实例,门面里 mixinMethods(TarotMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import React from 'react';
import { message } from 'antd';
import { XQButton as Button, XQSelect as Select, XQTabs as Tabs, XQSegmented, XQInputNumber } from '../../xq-ui';
import { buildReading } from '../engine/reading';
import { getDeckCards } from '../engine/deckRegistry';
import { displayNameCn, displayNameEn, cardMeaning, correspondenceCell } from '../engine/cardSchema';
import { orientationLabel } from '../engine/spreads';
import { yesNo, quintessence, theosophicalGroups, countingChain, birthCards, yearCard, majorByNumber, synthesizeText, pairings, clarifier } from '../engine/verdict';
import { computeTimingLines, TIMING_METHODS, TIMING_METHOD_LABEL } from '../engine/timingMethods';
import { comboHints, COMBO_GUARD_NOTES } from '../decks/comboThemes';
import { YESNO_MODE_LABEL } from '../engine/verdict';
import { courtSignDetect, COURT_READING_RULES, COURT_CHARACTER_NOTE } from '../decks/courtSystems';
import { buildDailySeed, appendDailyLog, dailyStats, loadDailyLog, saveDailyLog } from '../engine/dailyCourse';
import { decanTimingOf } from '../engine/timingMethods';
import { labelCellStyle } from '../../../utils/labelCell';
import { RIGHT_TABS } from './layout';
import { seedFromFields } from './settings';
import { FreezeSubTab } from '../../comp/FreezeInactive';
const { TabPane } = Tabs;
const { Option, OptGroup } = Select;

export const rightPanelMethods = {
	renderRightPanel(){
		const reading = this.state.reading;
		const draws = (reading && reading.draws) || [];
		const deck = this.currentDeck();
		const caps = this.caps();
		const isTarot = caps.readingMethod === 'tarot';
		const activeKey = RIGHT_TABS.indexOf(this.state.rightPanelTab) >= 0 ? this.state.rightPanelTab : 'overview';
		const summary = reading && reading.summary;
		return (
			<Tabs activeKey={activeKey} onChange={this.setRightPanelTab} defaultActiveKey="overview" tabPosition="top" className="horosa-content-tabs horosa-tarot-tabs">
				{/* horosa_freeze_subtabs_v1:右栏非激活子页冻结重渲(冻结≠卸载,切回即拿最新 children) */}
				<TabPane tab="总览" key="overview">
					<FreezeSubTab active={activeKey === 'overview'}>{() => (
					<div className="horosa-tarot-reading">
						{this.state.question ? <div className="horosa-info-card"><div className="horosa-info-card-title">所问</div><div>{this.state.question}</div></div> : null}
						{reading && reading.firstReversal && !reading.firstReversal.error ? (
							<div className="horosa-info-card">
								<div className="horosa-info-card-title">单张逆位占卜 · 计数诊断</div>
								<div className="horosa-tarot-line">翻至第 <b>{reading.firstReversal.count}</b> 张现逆位 → <b>{reading.firstReversal.level}</b></div>
								<div className="horosa-tarot-line" style={{ opacity: 0.85 }}>{reading.firstReversal.note}</div>
								{(reading.firstReversal.questions || []).length ? (
									<div className="horosa-tarot-line" style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>可就此牌自问:{reading.firstReversal.questions.join('　')}</div>
								) : null}
							</div>
						) : null}
						{reading && reading.firstReversal && reading.firstReversal.error ? (
							<div className="horosa-info-card"><div className="horosa-info-card-title">单张逆位占卜</div><div className="horosa-tarot-line">{reading.firstReversal.error}</div></div>
						) : null}
						{draws.length ? (
							<div className="horosa-info-card">
								<div className="horosa-info-card-title">牌阵直断</div>
								{draws.map((d) => {
									if(!d.card){ return null; }
									const kw = String(cardMeaning(d.card, d.isReversed, this.state.meaningSystem, this.state.reversalMode) || '').split('、').slice(0, 4).join('、');
									return (<div key={d.position.i} className="horosa-tarot-line"><b>{d.position.label}</b>：{this.cardLabel(d.card)}（{this.orientLabel(d)}）— {kw}</div>);
								})}
								{reading && reading.cutCard && reading.cutCard.card ? (
									<div className="horosa-tarot-line" style={{ marginTop: 6 }}>切牌(心态)：<b>{this.cardLabel(reading.cutCard.card)}</b>（{orientationLabel(reading.cutCard.isReversed)}）—— 问卜者对此问的底层心态</div>
								) : null}
								{reading && reading.bottomCard && reading.bottomCard.card ? (
									<div className="horosa-tarot-line" style={{ marginTop: 6 }}>牌底牌(基调)：<b>{this.cardLabel(reading.bottomCard.card)}</b>（{orientationLabel(reading.bottomCard.isReversed)}）—— 牌堆最深处亦最显明的一张,为整局定调</div>
								) : null}
								{reading && reading.draws && reading.draws.some((d) => d.overlay) ? (
									<div className="horosa-tarot-line" style={{ marginTop: 6, opacity: 0.85 }}>大牌加盖已生效：大牌为「何以如此」,所盖小牌为「具体何事」(详见牌义页)。</div>
								) : null}
								{summary ? <div className="horosa-tarot-line" style={{ marginTop: 6, opacity: 0.85 }}>综合：{synthesizeText(summary)}</div> : null}
							</div>
						) : <div className="horosa-tarot-empty">尚未抽牌</div>}
					</div>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="牌位" key="positions">
					<FreezeSubTab active={activeKey === 'positions'}>{() => (
					<table className="horosa-tarot-table">
						<thead><tr><th style={labelCellStyle('位置')}>位置</th><th style={labelCellStyle('牌')}>牌</th><th style={labelCellStyle('正逆')}>正逆</th><th style={labelCellStyle('含义')}>含义</th></tr></thead>
						<tbody>{draws.map((d) => (
							<tr key={d.position.i}>
								<td>{d.position.i}. {d.position.label}</td>
								<td>{d.card ? `${this.cardLabel(d.card)}${d.card.symbol}` : '-'}</td>
								<td className={d.isReversed ? 'is-reversed' : ''} style={labelCellStyle(this.orientLabel(d))}>{this.orientLabel(d)}</td>
								<td>{d.position.meaning}{d.position.slotElement && d.card ? `；${this.elements4Note(d)}` : ''}</td>
							</tr>
						))}</tbody>
					</table>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="牌义" key="meanings">
					<FreezeSubTab active={activeKey === 'meanings'}>{() => (
					<table className="horosa-tarot-table">
						<thead><tr><th style={labelCellStyle('牌')}>牌</th>{caps.reversals !== false ? <th style={labelCellStyle('正逆')}>正逆</th> : null}{isTarot ? <th style={labelCellStyle('对应')}>对应</th> : null}{caps.dignities ? <th style={labelCellStyle('尊位')}>尊位</th> : null}<th style={labelCellStyle('关键义')}>关键义</th></tr></thead>
						<tbody>{draws.map((d) => {
							return (
								<tr key={d.position.i}>
									<td style={{ whiteSpace: 'nowrap' }}>{d.card ? <a onClick={() => this.setState({ detailCard: d.card })} title="牌详情">{`${isTarot ? displayNameCn(d.card, deck) : d.card.name_cn}${d.card.symbol}`}</a> : '-'}</td>
									{caps.reversals !== false ? <td className={d.isReversed ? 'is-reversed' : ''} style={labelCellStyle(this.orientLabel(d))}>{this.orientLabel(d)}</td> : null}
									{isTarot ? <td className="horosa-tarot-td-corr">{d.card ? correspondenceCell(d.card, deck, this.state, caps) : '-'}</td> : null}
									{caps.dignities ? <td style={labelCellStyle(d.dignity ? d.dignity.strength : '—')}>{d.dignity ? d.dignity.strength : '—'}</td> : null}
									<td>
										{d.card ? cardMeaning(d.card, d.isReversed, this.state.meaningSystem, this.state.reversalMode) : '-'}
										{d.overlay && d.overlay.card ? <div style={{ marginTop: 2, fontSize: 11, opacity: 0.8 }}>盖:{this.cardLabel(d.overlay.card)}（{orientationLabel(d.overlay.isReversed)}）—{cardMeaning(d.overlay.card, d.overlay.isReversed, this.state.meaningSystem, this.state.reversalMode)}</div> : null}
									</td>
								</tr>
							);
						})}</tbody>
					</table>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="综合" key="synthesis"><FreezeSubTab active={activeKey === 'synthesis'}>{() => this.renderSynthesis(summary)}</FreezeSubTab></TabPane>
				{isTarot ? <TabPane tab="对读" key="pairs"><FreezeSubTab active={activeKey === 'pairs'}>{() => this.renderPairs(reading)}</FreezeSubTab></TabPane> : null}
				{caps.readingMethod === 'lenormand' ? <TabPane tab="组合读法" key="lenormand"><FreezeSubTab active={activeKey === 'lenormand'}>{() => this.renderLenormand(reading)}</FreezeSubTab></TabPane> : null}
				{caps.readingMethod !== 'lenormand' ? <TabPane tab="定局" key="verdict"><FreezeSubTab active={activeKey === 'verdict'}>{() => this.renderVerdict(reading)}</FreezeSubTab></TabPane> : null}
				{reading && reading.spreadType === 'opening_of_key' ? <TabPane tab="开钥" key="ook"><FreezeSubTab active={activeKey === 'ook'}>{() => this.renderOok(reading)}</FreezeSubTab></TabPane> : null}
				{isTarot ? <TabPane tab="生命牌" key="birthcards"><FreezeSubTab active={activeKey === 'birthcards'}>{() => this.renderBirthCards()}</FreezeSubTab></TabPane> : null}
				{isTarot ? <TabPane tab="日课" key="daily"><FreezeSubTab active={activeKey === 'daily'}>{() => this.renderDaily()}</FreezeSubTab></TabPane> : null}
			</Tabs>
		);
	},

	// TP8 日课 tab(轻量拍板版):确定性今日牌(日期+生辰+牌组)+三镜解读+对应计时+本地日志与统计。
	renderDaily(){
		const deck = this.currentDeck();
		const today = (() => { const t = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; })();
		const seed = buildDailySeed(today, seedFromFields(this.activeFields()), this.state.deckId);
		const r = buildReading(this.state.deckId, 'single', seed, { reversals: this.state.useReversals });
		const d = r.draws && r.draws[0];
		if(!d || !d.card){ return <div className="horosa-tarot-empty">日课暂不可用</div>; }
		const log = loadDailyLog();
		const stats = dailyStats(log);
		const loggedToday = log.some((x) => x.d === today && x.deck === this.state.deckId);
		const saveToday = () => {
			const next = appendDailyLog(log, { d: today, deck: this.state.deckId, sid: d.card.sid, rev: !!d.isReversed });
			if(saveDailyLog(next)){ message.success('已记入日课'); this.forceUpdate(); }
			else{ message.warning('本地存储不可用,未能记入'); }
		};
		return (
			<div className="horosa-tarot-reading">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">今日牌 · {today}</div>
					<div className="horosa-tarot-line" style={{ fontSize: 16 }}><b>{this.cardLabel(d.card)}</b>（{this.orientLabel(d)}）{d.card.symbol}</div>
					<div className="horosa-tarot-line" style={{ fontSize: 11, color: 'var(--horosa-text-secondary)' }}>同日同人同牌组恒此一张(确定性种子);跨日自然轮转。</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">三镜解读</div>
					<div className="horosa-tarot-line">具体一日：{cardMeaning(d.card, d.isReversed, 'manual', this.state.reversalMode)}</div>
					<div className="horosa-tarot-line">原型一课：{cardMeaning(d.card, d.isReversed, 'waite', this.state.reversalMode)}</div>
					<div className="horosa-tarot-line">向上一层：{cardMeaning(d.card, d.isReversed, 'degrees', this.state.reversalMode)}</div>
					{decanTimingOf(d.card) ? <div className="horosa-tarot-line" style={{ opacity: 0.75 }}>对应：{decanTimingOf(d.card)}</div> : null}
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">日志与统计</div>
					<Button size="small" onClick={saveToday} disabled={loggedToday}>{loggedToday ? '今日已记入' : '记入日课'}</Button>
					{stats.total ? (
						<>
							<div className="horosa-tarot-line" style={{ marginTop: 6 }}>累计 {stats.total} 天 · 逆位 {stats.reversed} 次</div>
							<div className="horosa-tarot-line">分布：大牌 {stats.suitCount.major} · 权杖 {stats.suitCount.wands} · 圣杯 {stats.suitCount.cups} · 宝剑 {stats.suitCount.swords} · 钱币 {stats.suitCount.pentacles}</div>
							<div className="horosa-tarot-line">大牌占比 {stats.majorPct}%（理论基线约 {stats.baselinePct}%）{stats.majorPct > stats.baselinePct + 10 ? '——近期主题偏「大事/命题」' : ''}</div>
							{stats.top.length ? <div className="horosa-tarot-line">高频牌：{stats.top.map((t) => `${t.name}×${t.count}`).join('、')}</div> : null}
						</>
					) : <div className="horosa-tarot-line" style={{ color: 'var(--horosa-text-secondary)', marginTop: 6 }}>尚无日志——每日记入一张,月余即可看出你的牌面气候。</div>}
					<div className="horosa-tarot-line" style={{ fontSize: 11, color: 'var(--horosa-text-secondary)', marginTop: 4 }}>日课仅存本机,不入案例、不入 AI 快照。</div>
				</div>
			</div>
		);
	},

	renderLenormand(reading){
		const len = reading && reading.lenormand;
		if(!len){ return <div className="horosa-tarot-empty">尚未抽牌</div>; }
		if(len.kind === 'pair'){
			return <div className="horosa-tarot-reading"><div className="horosa-info-card"><div className="horosa-info-card-title">成句(名词×修饰)</div><div className="horosa-tarot-line">{len.pair}</div></div></div>;
		}
		if(len.kind === 'box9'){
			const b = len.box9;
			return (
				<div className="horosa-tarot-reading">
					<div className="horosa-info-card"><div className="horosa-info-card-title">9 宫盒</div>
						<div className="horosa-tarot-line">焦点：<b>{b.center ? b.center.name_cn : '—'}</b></div>
						<div className="horosa-tarot-line">环绕：{(b.around || []).map((c) => c && c.name_cn).filter(Boolean).join('、')}</div>
					</div>
				</div>
			);
		}
		const gt = len.gt;
		const fmt = (arr) => (arr || []).filter(Boolean).join('·') || '—';
		return (
			<div className="horosa-tarot-reading">
				<div className="horosa-info-card"><div className="horosa-info-card-title">指示牌定位</div>
					<div className="horosa-tarot-line">男（{gt.manName || '本人'}）：{gt.man ? `行${gt.man.row + 1} 列${gt.man.col + 1}` : '未在阵中'}　女（{gt.womanName || '本人'}）：{gt.woman ? `行${gt.woman.row + 1} 列${gt.woman.col + 1}` : '未在阵中'}</div>
				</div>
				{gt.manLines ? (
					<div className="horosa-info-card"><div className="horosa-info-card-title">男·贯穿线</div>
						<div className="horosa-tarot-line">过去：{fmt(gt.manLines.past)}</div>
						<div className="horosa-tarot-line">未来：{fmt(gt.manLines.future)}</div>
						<div className="horosa-tarot-line">显意(上)：{fmt(gt.manLines.above)}　潜意(下)：{fmt(gt.manLines.below)}</div>
					</div>
				) : null}
				<div className="horosa-info-card"><div className="horosa-info-card-title">跳马 / 四角</div>
					<div className="horosa-tarot-line">男·跳马：{fmt(gt.manKnight)}</div>
					<div className="horosa-tarot-line">四角(结论)：{fmt(gt.corners)}</div>
				</div>
				<div className="horosa-info-card"><div className="horosa-info-card-title">宫位叠读(前12)</div>
					{(gt.houses || []).slice(0, 12).map((h) => <div key={h.pos} className="horosa-tarot-line" style={{ fontSize: 12 }}>{h.pos}. {h.read}</div>)}
				</div>
			</div>
		);
	},

	// TP2 对读 tab:大牌对流(十进对/和21补牌/同阵相会)+相邻度关系(进化/退行/共振)+配偶命中+视线提示。
	renderPairs(reading){
		const pr = reading && reading.pairs;
		if(!reading || !reading.draws || !reading.draws.length){ return <div className="horosa-tarot-empty">尚未抽牌</div>; }
		if(!pr){ return <div className="horosa-tarot-empty">此阵未构成对读关系(无大牌且相邻牌无度值衔接)。</div>; }
		return (
			<div className="horosa-tarot-reading">
				{pr.majors && pr.majors.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">大牌对流(十进对 · 和21补牌)</div>
						{pr.majors.map((m) => (
							<div key={m.sid} className="horosa-tarot-line"><b>{m.name}</b>:{m.text}{m.decNote ? <span style={{ opacity: 0.7 }}>——{m.decNote}</span> : null}</div>
						))}
					</div>
				) : null}
				{pr.adjacent && pr.adjacent.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">相邻对读(度序 · 视线)</div>
						{pr.adjacent.map((x, i) => (
							<div key={i} className="horosa-tarot-line">
								<b>{x.a}</b>×<b>{x.b}</b>:{[x.relation, x.couple, x.gaze].filter(Boolean).join('；')}
							</div>
						))}
					</div>
				) : null}
				{pr.couples && pr.couples.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">配偶对(同阵相会)</div>
						{pr.couples.map((x, i) => (<div key={i} className="horosa-tarot-line"><b>{x.a}</b>与<b>{x.b}</b>:{x.text}</div>))}
					</div>
				) : null}
				<div className="horosa-tarot-line" style={{ fontSize: 11, color: 'var(--horosa-text-secondary)' }}>方位法则:左=承受/来处,右=行动/去向;升序相邻=实现之路。</div>
			</div>
		);
	},

	renderSynthesis(summary){
		if(!summary || !summary.total){ return <div className="horosa-tarot-empty">尚未抽牌</div>; }
		const sc = summary.suitCount;
		const ec = summary.elemCount;
		const pct = Math.round(100 * summary.majors / summary.total);
		const repKeys = Object.keys(summary.repeats || {});
		return (
			<div className="horosa-tarot-reading">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">花色 / 元素分布</div>
					<div className="horosa-tarot-line">权杖 {sc.wands} · 圣杯 {sc.cups} · 宝剑 {sc.swords} · 钱币 {sc.pentacles}</div>
					<div className="horosa-tarot-line">大牌 {summary.majors} · 宫廷 {summary.courts}</div>
					<div className="horosa-tarot-line">火 {ec.fire} · 水 {ec.water} · 风 {ec.air} · 土 {ec.earth}</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">主导与重点</div>
					{summary.domElement ? <div className="horosa-tarot-line">主导元素：{summary.domElementCn}（{{ fire: '行动/意志', water: '情感/关系', air: '思维/沟通', earth: '物质/现实' }[summary.domElement]}）</div> : null}
					<div className="horosa-tarot-line">大牌占比：{pct}%{pct >= 50 ? '（命运/重大主题）' : ''}</div>
					{summary.majorRatioNote ? <div className="horosa-tarot-line" style={{ opacity: 0.85 }}>{summary.majorRatioNote}</div> : null}
					<div className="horosa-tarot-line">正位 {summary.total - summary.reversed} · 逆位 {summary.reversed}</div>
					{summary.reversalDiagnosis ? <div className="horosa-tarot-line" style={{ opacity: 0.85 }}>逆位诊断：{summary.reversalDiagnosis.note}</div> : null}
					{summary.activePassive ? <div className="horosa-tarot-line">极性：阳(火风) {summary.activePassive.yang} · 阴(水土) {summary.activePassive.yin} → <b>{summary.activePassive.verdict}</b></div> : null}
					{repKeys.length ? <div className="horosa-tarot-line">重复数字：{repKeys.map((k) => `${k}×${summary.repeats[k]}`).join('、')}（该数字原型被强调）</div> : null}
				</div>
				{(summary.modeCount && (summary.modeCount.本位 + summary.modeCount.固定 + summary.modeCount.变动) >= 3) || (summary.planetGroups && summary.planetGroups.length) || (summary.signGroups && summary.signGroups.length) || summary.elementInteraction ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">占星与四要素判定(TP3)</div>
						{summary.modeCount && (summary.modeCount.本位 + summary.modeCount.固定 + summary.modeCount.变动) >= 3 ? (
							<div className="horosa-tarot-line">三态：本位(发起) {summary.modeCount.本位} · 固定(坚持) {summary.modeCount.固定} · 变动(变通) {summary.modeCount.变动}</div>
						) : null}
						{summary.planetGroups && summary.planetGroups.length ? (
							<div className="horosa-tarot-line">行星主题线：{summary.planetGroups.map((g) => `${g.cn}×${g.count}（${g.theme}）`).join('、')}</div>
						) : null}
						{summary.signGroups && summary.signGroups.length ? (
							<div className="horosa-tarot-line">星座聚集：{summary.signGroups.map((g) => `${g.cn}×${g.count}（${g.brief}）`).join('、')}</div>
						) : null}
						{summary.oddEven && (summary.oddEven.odd + summary.oddEven.even) >= 2 ? (
							<div className="horosa-tarot-line">奇偶：奇(行动) {summary.oddEven.odd} · 偶(承受) {summary.oddEven.even}；旬相：初发 {summary.phaseTally['上升(初发)']} · 全盛 {summary.phaseTally['续座(全盛)']} · 收变 {summary.phaseTally['下降(收变)']}</div>
						) : null}
						{summary.elementInteraction ? (
							<div className="horosa-tarot-line">
								四要素互动(简法)：
								{summary.elementInteraction.improve.length ? `同类同现 ${summary.elementInteraction.improve.join('/')}=气机相生；` : ''}
								{summary.elementInteraction.worsen.length ? `异类同现 ${summary.elementInteraction.worsen.join('/')}=相制费力；` : ''}
								{summary.elementInteraction.missing.length && summary.elementInteraction.missing.length < 4 ? `缺${summary.elementInteraction.missing.map((e) => ({ fire: '火', water: '水', air: '风', earth: '土' }[e])).join('、')}=缺该性质` : ''}
							</div>
						) : null}
					</div>
				) : null}
			</div>
		);
	},

	renderVerdict(reading){
		if(!reading || !reading.draws || !reading.draws.length){ return <div className="horosa-tarot-empty">尚未抽牌</div>; }
		const deck = this.currentDeck();
		const cards = getDeckCards(this.state.deckId);
		const v = yesNo(reading.draws, this.state.verdictMode);
		const quint = quintessence(reading.draws, cards, undefined, this.state.quintMode);
		const groups = this.state.quintMode === 'fool22' ? theosophicalGroups(reading.draws, cards) : null;
		const chain = countingChain(reading.draws, 0, Math.min(reading.draws.length, 8));
		const pr = pairings(reading.draws);
		const cl = this.state.clarifierShown ? clarifier(reading.draws, cards) : null;
		const pairName = (p) => `${this.cardLabel(p.a)}／${this.cardLabel(p.b)}`;
		const hints = comboHints(reading.draws);
		const timingLines = computeTimingLines(reading, cards, this.state.timingMethod, { unit: this.state.timingUnit });
		return (
			<div className="horosa-tarot-reading">
				<div className="horosa-tarot-field"><label>Yes/No 定局法</label>
					<Select value={this.state.verdictMode} onChange={(v2) => this.changeVerdictMode(v2)} size="small" style={{ width: '100%' }} dropdownMatchSelectWidth={false}>
						<OptGroup label="通行五法">
							{['majority', 'orientation', 'single', 'numeric', 'polarity'].map((m) => (<Option value={m} key={m}>{YESNO_MODE_LABEL[m]}</Option>))}
						</OptGroup>
						<OptGroup label="进阶三法">
							{['weighted_center', 'anchor', 'single3'].map((m) => (<Option value={m} key={m}>{YESNO_MODE_LABEL[m]}</Option>))}
						</OptGroup>
					</Select>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Yes / No</div>
					<div className="horosa-tarot-line" style={{ fontSize: 16 }}><b>{v.verdict}</b>（{YESNO_MODE_LABEL[this.state.verdictMode] || this.state.verdictMode}，score {v.score}）</div>
					{v.note ? <div className="horosa-tarot-line" style={{ opacity: 0.8 }}>{v.note}</div> : null}
				</div>
				{hints.length ? (
					<div className="horosa-info-card">
						<div className="horosa-info-card-title">组合征象</div>
						{hints.map((h) => (
							<div key={h.key} className="horosa-tarot-line"><b>{h.theme}</b>（{h.matched.join('、')}）——{h.hint}</div>
						))}
						{hints.some((h) => h.guard) ? (
							<div className="horosa-tarot-line" style={{ fontSize: 11, opacity: 0.7 }}>
								{[...new Set(hints.filter((h) => h.guard).map((h) => COMBO_GUARD_NOTES[h.guard]))].join(' ')}
							</div>
						) : null}
					</div>
				) : null}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">精华牌 Quintessence</div>
					<div className="horosa-tarot-field" style={{ marginBottom: 6 }}>
						<XQSegmented value={this.state.quintMode || 'standard'} onChange={(e) => this.changeSetting({ quintMode: e.target.value })} options={[{ label: '通行', value: 'standard' }, { label: '愚人廿二', value: 'fool22' }]} />
					</div>
					<div className="horosa-tarot-line">{quint ? `${displayNameCn(quint, deck)}（${displayNameEn(quint, deck)}）` : '—'}</div>
					{groups ? (
						<div className="horosa-tarot-line" style={{ marginTop: 4 }}>
							数值加法(三张):底层 <b>{groups.total ? displayNameCn(groups.total, deck) : '—'}</b> · 外显 {groups.outer ? displayNameCn(groups.outer, deck) : '—'} · 左/承受 {groups.left ? displayNameCn(groups.left, deck) : '—'} · 右/主动 {groups.right ? displayNameCn(groups.right, deck) : '—'}
						</div>
					) : null}
					{this.state.quintMode === 'fool22' && !groups ? <div className="horosa-tarot-line" style={{ fontSize: 11, color: 'var(--horosa-text-secondary)' }}>分组加法仅三张牌阵显示(总和/外显/左承受/右主动)。</div> : null}
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">牌间关系（相邻／镜像／桥接）</div>
					{pr.adjacent.length ? <div className="horosa-tarot-line">相邻串：{pr.adjacent.map(pairName).join('　')}</div> : null}
					{pr.mirror.length ? <div className="horosa-tarot-line">镜像对：{pr.mirror.map(pairName).join('　')}</div> : null}
					{pr.bridge ? <div className="horosa-tarot-line">桥接（首尾）：{pairName(pr.bridge)}</div> : null}
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">计时 Timing</div>
					<div className="horosa-tarot-field" style={{ marginBottom: 6 }}>
						<Select value={this.state.timingMethod || 'suit_unit'} onChange={(v2) => this.changeSetting({ timingMethod: v2 })} size="small" style={{ width: '100%' }} dropdownMatchSelectWidth={false}>
							{TIMING_METHODS.map((m) => (<Option value={m} key={m}>{TIMING_METHOD_LABEL[m]}</Option>))}
						</Select>
						{this.state.timingMethod === 'major_number' ? (
							<XQSegmented value={this.state.timingUnit || '周'} onChange={(e) => this.changeSetting({ timingUnit: e.target.value })} options={[{ label: '天', value: '天' }, { label: '周', value: '周' }, { label: '月', value: '月' }]} />
						) : null}
					</div>
					{timingLines.map((l, i) => <div key={i} className="horosa-tarot-line">{l}</div>)}
					<div className="horosa-tarot-line" style={{ fontSize: 11, color: 'var(--horosa-text-secondary)' }}>占验有效期以一年内为度;逾期之问不以时相许。</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">计数链(线性演示)</div>
					<div className="horosa-tarot-line">{chain.map((c) => this.cardLabel(c)).join(' → ')}</div>
				</div>
				{(() => {
					// TP7 宫廷指认卡:阵含宫廷牌时,人物/事件双解+年龄外貌+星座检测(伴牌触发)。
					const courts = courtSignDetect(reading.draws);
					if(!courts.length){ return null; }
					return (
						<div className="horosa-info-card">
							<div className="horosa-info-card-title">宫廷指认</div>
							{courts.map((c) => {
								// 年龄/外貌/行旅取 courtSignDetect 备好的结果(与快照同源),不在此另行查表
								const det = c.hits.length ? `;伴牌检测:更似${c.hits.map((h) => `${h.signCn}座`).join('/')}之人` : (c.baseSignCn ? `;单座制约${c.baseSignCn}座` : '');
								return (
									<div key={c.sid} className="horosa-tarot-line">
										<b>{c.name}</b>:{c.age};{c.appearance}{c.vehicle ? `;${c.vehicle}` : ''}{det}
									</div>
								);
							})}
							{COURT_READING_RULES.map((r, i) => <div key={i} className="horosa-tarot-line" style={{ fontSize: 11, opacity: 0.7 }}>{r}</div>)}
							<div className="horosa-tarot-line" style={{ fontSize: 11, opacity: 0.7 }}>{COURT_CHARACTER_NOTE}</div>
						</div>
					);
				})()}
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">澄清牌 Clarifier</div>
					<Button size="small" onClick={() => this.setState({ clarifierShown: !this.state.clarifierShown }, () => this.applyRecompute())}>{this.state.clarifierShown ? '收起澄清牌' : '抽一张澄清牌'}</Button>
					{cl ? <div className="horosa-tarot-line" style={{ marginTop: 6 }}>{displayNameCn(cl, deck)}（{displayNameEn(cl, deck)}）— {cardMeaning(cl, false, this.state.meaningSystem, this.state.reversalMode)}</div> : null}
				</div>
			</div>
		);
	},

	renderOok(reading){
		const ook = reading && reading.ook;
		if(!ook){ return <div className="horosa-tarot-empty">开钥仅 Golden Dawn / Thoth 牌组 + 已选指示牌可用；请在左栏选定指示牌。</div>; }
		if(ook.error){ return <div className="horosa-tarot-empty">{ook.error}</div>; }
		return (
			<div className="horosa-tarot-reading">
				{ook.operations.map((op) => (
					<div key={op.op} className="horosa-info-card">
						<div className="horosa-info-card-title">操作{op.op} · {op.name} → 落「{op.pileLabel}」（堆 {op.pileSize} 张）</div>
						<div className="horosa-tarot-line">计数链：{(op.chain || []).map((it) => this.cardLabel(it.card)).join(' → ') || '—'}</div>
						<div className="horosa-tarot-line">首尾配对：{(op.pairs || []).slice(0, 5).map((p) => `${this.cardLabel(p.a)}${p.b ? '／' + this.cardLabel(p.b) : '(中心)'}${p.strength ? '·' + p.strength : ''}`).join('　') || '—'}</div>
					</div>
				))}
				{ook.op5 ? <div className="horosa-info-card"><div className="horosa-info-card-title">收束 Op5</div><div className="horosa-tarot-line">{ook.op5.summary}</div></div> : null}
			</div>
		);
	},

	renderBirthCards(){
		const b = this.state.birth;
		const deck = this.currentDeck();
		const cards = getDeckCards(this.state.deckId);
		const set = (patch) => this.changeSetting({ birth: { ...b, ...patch } });
		let result = null;
		if(b.year && b.month && b.day){
			const bc = birthCards(Number(b.year), Number(b.month), Number(b.day));
			const pc = majorByNumber(cards, bc.personality <= 21 ? bc.personality : 0);
			const sc = majorByNumber(cards, bc.soul);
			let yc = null;
			if(b.refYear){ const yn = yearCard(Number(b.month), Number(b.day), Number(b.refYear)); yc = majorByNumber(cards, yn <= 21 ? yn : 0); }
			result = { pc, sc, yc, bc };
		}
		return (
			<div className="horosa-tarot-reading">
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">生日(算人格/灵魂/流年牌)</div>
					<div className="horosa-tarot-birth-row">
						<XQInputNumber placeholder="年" value={b.year} onChange={(v) => set({ year: v })} size="small" style={{ width: 80 }} />
						<XQInputNumber placeholder="月" min={1} max={12} value={b.month} onChange={(v) => set({ month: v })} size="small" style={{ width: 60 }} />
						<XQInputNumber placeholder="日" min={1} max={31} value={b.day} onChange={(v) => set({ day: v })} size="small" style={{ width: 60 }} />
						<XQInputNumber placeholder="流年" value={b.refYear} onChange={(v) => set({ refYear: v })} size="small" style={{ width: 80 }} />
					</div>
				</div>
				{result ? (
					<div className="horosa-info-card">
						<div className="horosa-tarot-line">人格牌 (#{result.bc.personality})：{result.pc ? displayNameCn(result.pc, deck) : '—'}</div>
						<div className="horosa-tarot-line">灵魂牌 (#{result.bc.soul})：{result.sc ? displayNameCn(result.sc, deck) : '—'}</div>
						{result.yc ? <div className="horosa-tarot-line">{b.refYear} 流年牌：{displayNameCn(result.yc, deck)}</div> : null}
						{result.bc.personality === 19 ? <div className="horosa-tarot-line" style={{ opacity: 0.7 }}>19 型:另含中间牌 命运之轮(10)</div> : null}
					</div>
				) : <div className="horosa-tarot-empty">输入完整生日后显示</div>}
			</div>
		);
	},
};
