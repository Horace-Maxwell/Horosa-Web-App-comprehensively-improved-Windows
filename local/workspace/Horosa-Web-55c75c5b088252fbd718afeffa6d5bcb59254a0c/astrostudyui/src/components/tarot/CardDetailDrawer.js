// 单卡详情面板(TP6):一张牌的全对应聚合视图 + 四轨牌义 + 主题占断 + 逆位多视角 + 自问 + 牌面笔记 + 个人牌义。
// 全部数据经 accessor 取用,缺层即隐(内容波次逐层点亮);任何牌组的牌都可打开(异构牌组仅显有的层)。
import React, { Component } from 'react';
import { Drawer, Input, message } from 'antd';
import { XQButton as Button } from '../xq-ui';
import { displayName, displayNameCn, astroLine, correspondenceSuffix, cardMeaning, isTrumpArcana } from './engine/cardSchema';
import { scaleColor, minorScaleColor, SCALE_META, SCALE_ORDER } from './engine/colorScales';
import {
	ESOTERIC_TITLE_MAJOR, COURT_TITLE, LETTER_META, MAJOR_ALIAS, decanMajors, pipDignity,
	signDateRange, MAJORS_CORR, SIGN_CN, PLANET_CN,
} from './decks/correspondences';
import { traditionalMeaningOf } from './decks/traditionalMeanings';
import { domainsOf, DOMAIN_KEYS, DOMAIN_CN, easternFigureOf } from './decks/domainMeanings';
import { noteOf } from './decks/cardNotes';
import { dualTrackOf } from './decks/dualTrackMeanings';
import { questionsOf } from './decks/questions22';
import { heroineOf } from './decks/heroineNarrative';
import { reversalHintOf } from './decks/reversalHints';
import { degreesMeaningOf } from './decks/marseilleMeanings';
import { courtEieOf, courtZodiacOf, COURT_AGE, COURT_APPEARANCE, KNIGHT_VEHICLE } from './decks/courtSystems';
import { decanTimingOf } from './engine/timingMethods';
import { personalMeaningOf, savePersonalMeaning } from './decks/personalMeanings';

const MAJOR_BY_SID = {};
MAJORS_CORR.forEach((m) => { MAJOR_BY_SID[m.id] = m; });

const card_ = { border: '1px solid rgba(215,173,105,0.22)', borderRadius: 8, padding: '8px 10px', marginBottom: 10, background: 'rgba(215,173,105,0.04)' };
const ct_ = { fontSize: 12.5, fontWeight: 600, color: 'var(--horosa-astro-gold, #d7ad69)', marginBottom: 6 };
const line_ = { fontSize: 12.5, lineHeight: 1.75, color: 'var(--horosa-astro-text, #e8ecf3)' };
const kv = (k, v) => (v ? <div style={line_} key={k}><span style={{ opacity: 0.65 }}>{k}：</span>{v}</div> : null);

class CardDetailDrawer extends Component{
	constructor(props){
		super(props);
		this.state = { personalDraft: null };
	}

	componentDidUpdate(prev){
		// 换牌时重置个人牌义草稿
		const sid = this.props.card && this.props.card.sid;
		const prevSid = prev.card && prev.card.sid;
		if(sid !== prevSid && this.state.personalDraft !== null){
			this.setState({ personalDraft: null }); // eslint-disable-line react/no-did-update-set-state
		}
	}

	render(){
		const { card, deck, view, visible, onClose } = this.props;
		if(!card){ return <Drawer visible={visible} onClose={onClose} width={430} title="牌详情" />; }
		const v = view || {};
		// [QA-9] 认 *_trump:此前写死 'major',维斯康蒂/米兰凯特的大牌在详情面板走小牌分支(秘传称号/别名/字母/星座区间/女主叙事六处全错)
		const isMajor = isTrumpArcana(card.arcana);
		const isCourt = !!card.court;
		const scaleRow = SCALE_ORDER.map((sk) => ({ sk, meta: SCALE_META[sk], c: isMajor ? scaleColor(card, sk) : minorScaleColor(card, sk) })).filter((x) => x.c);
		const lm = isMajor ? LETTER_META[card.sid] : null;
		const trad = traditionalMeaningOf(card);
		const domains = domainsOf(card);
		const note = noteOf(card);
		const dual = dualTrackOf(card);
		const questions = questionsOf(card);
		const heroine = isMajor ? heroineOf(card) : null;
		const rxHint = reversalHintOf(card);
		const dm = decanMajors(card);
		const dig = pipDignity(card);
		const personalSaved = personalMeaningOf(card.sid);
		const personal = this.state.personalDraft === null ? personalSaved : this.state.personalDraft;
		const title = (
			<span>
				{displayName(card, deck)} <span style={{ opacity: 0.7 }}>{card.symbol}</span>
				{scaleRow.length ? <span style={{ marginLeft: 8 }}>{scaleRow.map((x) => <span key={x.sk} title={`${x.meta.label} ${x.c.name}`} style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: x.c.hex, marginRight: 3, verticalAlign: 'middle' }} />)}</span> : null}
			</span>
		);
		const dmNames = dm && dm.majors && dm.majors.length ? dm.majors.map((sid) => {
			const m = MAJOR_BY_SID[sid];
			return m ? m.cn : sid;
		}).join(' + ') : null;
		return (
			<Drawer visible={visible} onClose={onClose} width={430} title={title} className="horosa-tarot-detail-drawer">
				<div style={card_}>
					<div style={ct_}>对应聚合</div>
					{kv('占象', card.arcana !== 'blank' ? `${astroLine(card, deck, v.variant, v.astroModern, { elementSystem: v.courtElementSystem, zodiacSystem: v.courtZodiacSystem })}${correspondenceSuffix(card, v.variant)}` : null)}
					{kv('秘传称号', isMajor ? ESOTERIC_TITLE_MAJOR[card.sid] : (isCourt ? (COURT_TITLE[card.suit] && COURT_TITLE[card.suit][card.court]) : (card.decanTitle && card.number >= 2 ? `Lord of ${card.decanTitle}` : null)))}
					{lm ? kv('字母', `${card.hebrew}(${lm.kind}字母)·义「${lm.sense}」·数值 ${lm.value}·天赋「${lm.gift}」·门户 ${lm.gateway}·音 ${lm.note}`) : null}
					{kv('历史别名', isMajor ? MAJOR_ALIAS[card.sid] : null)}
					{kv('东方对应人物', easternFigureOf(card))}
					{kv('大牌读小牌', dmNames ? `${dmNames}${dm.kind === 'decan' ? '(旬星二连)' : dm.kind === 'span' ? '(跨段二连)' : '(象限三连)'}` : null)}
					{kv('行星尊贵', dig ? dig.label : null)}
					{kv('计时对应', decanTimingOf(card))}
					{isMajor && card.astro && SIGN_CN[card.astro] ? kv('星座区间', `${SIGN_CN[card.astro]}座 ${signDateRange(card.astro) || ''}`) : null}
					{isMajor && card.astro && PLANET_CN[card.astro] ? kv('行星', PLANET_CN[card.astro]) : null}
					{isCourt ? kv('宫廷', `${courtEieOf(card, v.courtElementSystem)} · ${courtZodiacOf(card, v.courtZodiacSystem)} · ${COURT_AGE[card.court]} · ${COURT_APPEARANCE[card.suit]}${card.court === 'knight' ? ` · ${KNIGHT_VEHICLE[card.suit]}` : ''}`) : null}
				</div>
				<div style={card_}>
					<div style={ct_}>牌义四轨</div>
					{kv('逐牌义', cardMeaning(card, false, 'manual', 'stored'))}
					{kv('逐牌义·逆', card.meaningsManual ? card.meaningsManual.rev : null)}
					{kv('Waite 1911', cardMeaning(card, false, 'waite', 'stored'))}
					{kv('数字度(马赛)', degreesMeaningOf(card))}
					{trad ? kv('传统义(十八九世纪法系)', trad.up) : null}
					{trad ? kv('传统义·逆', trad.rev) : null}
				</div>
				{dual ? (
					<div style={card_}>
						<div style={ct_}>双轨读法(大体 / 两性)</div>
						{kv('大体上', dual.general)}
						{kv('两性关系上', dual.relation)}
						{kv('倒立时', dual.reversed)}
						{kv('回退所指', dual.retreatTo)}
					</div>
				) : null}
				{domains ? (
					<div style={card_}>
						<div style={ct_}>主题占断</div>
						{DOMAIN_KEYS.map((k) => kv(DOMAIN_CN[k], domains[k]))}
						{domains.health ? <div style={{ ...line_, fontSize: 11, opacity: 0.6 }}>健康域为传统占验视角,非医疗建议。</div> : null}
					</div>
				) : null}
				{(rxHint || heroine || (note && note.reverseImage)) ? (
					<div style={card_}>
						<div style={ct_}>逆位多视角</div>
						{kv('通则速查', rxHint)}
						{kv('图像演绎', note && note.reverseImage)}
						{kv('旅程叙事', heroine)}
					</div>
				) : null}
				{questions && questions.length ? (
					<div style={card_}>
						<div style={ct_}>可就此牌自问</div>
						{questions.map((q, i) => <div style={line_} key={i}>· {q}</div>)}
					</div>
				) : null}
				{note && (note.image || (note.symbols && note.symbols.length) || note.special) ? (
					<div style={card_}>
						<div style={ct_}>牌面笔记</div>
						{kv('图景', note.image)}
						{note.symbols && note.symbols.length ? kv('符号', note.symbols.join('、')) : null}
						{note.special ? <div style={{ ...line_, color: 'var(--horosa-astro-gold, #d7ad69)' }}>{note.special}</div> : null}
					</div>
				) : null}
				<div style={card_}>
					<div style={ct_}>个人牌义(仅存本机)</div>
					<Input.TextArea
						value={personal}
						onChange={(e) => this.setState({ personalDraft: e.target.value })}
						placeholder="写下只属于你的这张牌——三层牌义模型的最外圈(共通→主流→个人)。"
						autoSize={{ minRows: 2, maxRows: 5 }}
						maxLength={500}
					/>
					<div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
						<Button size="small" onClick={() => {
							if(savePersonalMeaning(card.sid, personal)){ message.success('个人牌义已存本机'); this.setState({ personalDraft: null }); }
							else{ message.warning('本地存储不可用'); }
						}}>保存</Button>
						{personalSaved ? <Button size="small" onClick={() => {
							if(savePersonalMeaning(card.sid, '')){ message.success('已清除'); this.setState({ personalDraft: null }); }
						}}>清除</Button> : null}
					</div>
					<div style={{ ...line_, fontSize: 11, opacity: 0.6, marginTop: 4 }}>个人义只适用于本人;代解他人时以解牌者义库为准。不入快照、不随案例同步。</div>
				</div>
			</Drawer>
		);
	}
}

export default CardDetailDrawer;
