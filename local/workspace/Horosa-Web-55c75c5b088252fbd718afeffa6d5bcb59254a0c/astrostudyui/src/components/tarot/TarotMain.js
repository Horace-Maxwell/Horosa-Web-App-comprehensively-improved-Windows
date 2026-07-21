import React, { Component } from 'react';
import { Input, InputNumber, message, Checkbox } from 'antd';
import { XQButton as Button, XQSelect as Select, XQTabs as Tabs, XQSwitch, XQSegmented, XQSectionTitle , XQSideSection } from '../xq-ui';
import { sideSectionIcon } from '../../constants/sideSectionIcons'; // [观象P2]
import SpaceTimePanel, { buildDateTimeFromFields } from '../comp/SpaceTimePanel';
import { subscribeRemoteNongli, timePatchFromDateTime, geoPatchFromRec } from '../../utils/divinationTimeDraft';
import { saveModuleAISnapshotLazy, saveModuleAISnapshot } from '../../utils/moduleAiSnapshot';
import { openKentangCaseDrawer, getKentangSavedCasePayload } from '../../utils/kentangCaseSave';
import TechniqueErrorBoundary from '../common/TechniqueErrorBoundary';
import { buildReading } from './engine/reading';
import { getDeck, listDeckGroups, getDeckCards, DEFAULT_DECK } from './engine/deckRegistry';
import { displayNameCn, displayNameEn, astroLine } from './engine/cardSchema';
import { SPREADS, DEFAULT_SPREAD, orientationLabel } from './engine/spreads';
import { yesNo, quintessence, countingChain, birthCards, yearCard, majorByNumber, synthesizeText } from './engine/verdict';
import { buildReadingText } from './engine/reportText';
import { kingScaleColor } from './engine/colorScales';
import { cardImageUrl, deckHasRealArt, deckArtIsMajorsOnly } from './engine/cardArt';
import { SIGN_CN, SUIT_CN, COURT_CN, COURT_ORDER, SUITS } from './decks/correspondences';
import { PUBLIC_DOMAIN_ATTRIBUTION } from './decks/meanings78';

const { TabPane } = Tabs;
const { Option, OptGroup } = Select;

const SUIT_COLOR = {
	major: 'var(--horosa-astro-gold, #d7ad69)',
	wands: '#e08a4b', cups: '#5aa6d6', swords: '#9a8fd6', pentacles: '#6fae74',
};
const SIGN_KEYS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const RIGHT_TABS = ['overview', 'positions', 'meanings', 'synthesis', 'verdict', 'birthcards', 'lenormand'];

// 几何牌阵「不重叠」布局:据牌真实尺寸(真实牌面更高)+ 各位置间距,
// 算统一缩放 s(保证任一非蓄意牌对至少一轴分开)+ 紧凑容器高 H。仅蓄意同点对(凯尔特交叉)允许叠放。
function computeGeoLayout(positions, spreadType, isImg){
	const W = 680, MAX_H = 1240, GAP = 1.07;
	const baseCw = isImg ? 98 : 110;                        // 卡外宽(px,基准)
	// 卡外高用纯比例(随 cw 线性缩放→保证容器高不超 MAX_H 时绝不重叠):真实牌面实测≈2.47×,符号牌≈1.45×
	const cardH = (cw) => cw * (isImg ? 2.5 : 1.5);
	const rotIdx = spreadType === 'celtic' ? 1 : -1;        // 凯尔特交叉牌旋转90°
	const wOf = (idx, cw) => (idx === rotIdx ? cardH(cw) : cw);  // 旋转牌横向占其高
	const hOf = (idx, cw) => (idx === rotIdx ? cw : cardH(cw));  // 旋转牌纵向占其宽
	const deliberate = (p, q) => Math.abs(p.x - q.x) < 0.02 && Math.abs(p.y - q.y) < 0.02;
	const pairs = [];
	for(let a = 0; a < positions.length; a++){
		for(let b = a + 1; b < positions.length; b++){
			if(!deliberate(positions[a], positions[b])){ pairs.push([a, b]); }
		}
	}
	// 1) 统一缩放 s:s=1 时估 eff 尺寸,解每对在 MAX_H 高度内至少一轴分开所需 s 上限
	let s = 1;
	pairs.forEach(([a, b]) => {
		const p = positions[a], q = positions[b];
		const dx = Math.abs(p.x - q.x), dy = Math.abs(p.y - q.y);
		const avgW = (wOf(a, baseCw) + wOf(b, baseCw)) / 2;
		const avgH = (hOf(a, baseCw) + hOf(b, baseCw)) / 2;
		const sHoriz = (dx * W) / (avgW * GAP);             // 横向分开允许的 s
		const sVert = (dy * MAX_H) / (avgH * GAP);          // 纵向分开允许的 s
		const pairS = Math.max(sHoriz, sVert);
		if(pairS < s){ s = pairS; }
	});
	s = Math.max(0.42, Math.min(1, s));
	const cw = baseCw * s;
	// 2) 紧凑容器高 H:对横向重叠(|dx|*W<卡宽)的对,纵向须容下卡高
	let H = 340;
	pairs.forEach(([a, b]) => {
		const p = positions[a], q = positions[b];
		const dx = Math.abs(p.x - q.x), dy = Math.abs(p.y - q.y);
		if(dy < 1e-4){ return; }
		const avgW = (wOf(a, cw) + wOf(b, cw)) / 2;
		const avgH = (hOf(a, cw) + hOf(b, cw)) / 2;
		if(dx * W < avgW){ H = Math.max(H, (avgH * GAP) / dy); }
	});
	const innerH = Math.min(MAX_H, Math.ceil(H));
	// 上下各留半张牌的内边距,使 y≈0/1 的牌(translate -50% 居中)不向上/下越界压到标题与署名;牌心映射进内区。
	const padY = Math.ceil(cardH(cw) / 2 + 6);
	const containerH = innerH + padY * 2;
	return { W, H: containerH, innerH, padY, slotW: Math.round(cw) };
}

// 出生信息 → 确定性种子串
function seedFromFields(fields){
	const f = fields || {};
	const val = (k) => {
		const fld = f[k];
		if(!fld || fld.value === undefined || fld.value === null){ return ''; }
		const v = fld.value;
		if(v && typeof v.format === 'function'){ return v.format(k === 'time' ? 'HH:mm:ss' : 'YYYY-MM-DD'); }
		return `${v}`;
	};
	const parts = [val('name'), val('date'), val('time'), val('lat'), val('lon')].filter(Boolean);
	return parts.length ? parts.join('|') : 'horosa-tarot-default';
}
function resolveSeed(seedMode, manualSeed, fields){
	if(seedMode === 'manual'){ return `${manualSeed === undefined || manualSeed === null ? 0 : manualSeed}`; }
	if(seedMode === 'random'){
		const r = (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues)
			? window.crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 4294967296);
		return `rnd-${r}`;
	}
	return seedFromFields(fields);
}

// deck 默认设置(切流派吸附)
function deckDefaults(deckId){
	const d = getDeck(deckId);
	return {
		reversals: !!d.usesReversals, dignities: !!d.dignities, variant: d.variant || 'A',
		showCorrespondences: (d.variant === 'B' || d.dignities),
	};
}

// 由 state 组装 settings(传给 engine buildReading)
function settingsFromState(s){
	return {
		reversals: s.useReversals, dignities: s.useDignities, variant: s.variant,
		showCorrespondences: s.showCorrespondences, sig: s.sig, verdictMode: s.verdictMode,
		birth: s.birth, question: s.question, artStyle: s.artStyle,
	};
}

// AI 快照(snapshotRef:'case'):优先 opts,其次已存案例 payload.options,重算 reading → 富文本。
export async function buildTarotSnapshotForFields(fields, opts){
	try{
		const o = opts || {};
		let { deckId, spreadType, seed, question, settings } = o;
		if(seed === undefined || seed === null){
			const saved = getKentangSavedCasePayload('tarot');
			const so = saved && saved.payload && saved.payload.options ? saved.payload.options : null;
			if(so){ deckId = so.deckId; spreadType = so.spreadType; seed = so.seed; question = so.question; settings = so.settings; }
		}
		if(seed === undefined || seed === null || seed === ''){ return ''; }
		const type = SPREADS[spreadType] ? spreadType : DEFAULT_SPREAD;
		const reading = buildReading(deckId || DEFAULT_DECK, type, `${seed}`, { ...(settings || {}), question });
		return buildReadingText(reading, question);
	}catch(e){ return ''; }
}

class TarotMain extends Component{
	constructor(props){
		super(props);
		const dd = deckDefaults(DEFAULT_DECK);
		this.state = {
			deckId: DEFAULT_DECK,
			spreadType: DEFAULT_SPREAD,
			seedMode: 'birth', manualSeed: 0, question: '',
			reading: null, lastSeed: '', rightPanelTab: 'overview',
			useReversals: dd.reversals, useDignities: dd.dignities, variant: dd.variant, showCorrespondences: dd.showCorrespondences,
			sig: { mode: 'none', gender: 'male', age: 30, sign: '', manualId: 'wands_king' },
			birth: { year: '', month: '', day: '', refYear: '' },
			verdictMode: 'majority',
			artStyle: 'symbol', // 'symbol' 简约符号(默认,零网络) | 'image' 真实牌面(仅 PD 牌组,onError 回退符号)
			// [自由起盘] 本地时间地理草稿(null=跟主命盘;非空=用户左栏自选:「出生信息」种子按此时地算,亦入事盘)。
			localFields: null,
		};
		this.unmounted = false;
		['drawCards', 'clickReproduce', 'clickSaveCase', 'restoreFromCurrentCase', 'setRightPanelTab', 'changeSpread', 'changeDeck', 'handleSnapshotRefreshRequest', 'applyRecompute', 'changeVerdictMode', 'onTimeChanged', 'changeGeo'].forEach((m) => { this[m] = this[m].bind(this); });
		if(this.props.hook){ this.props.hook.fun = () => { if(!this.unmounted){ this.restoreFromCurrentCase(); } }; }
	}

	componentDidMount(){
		this._unsubNongli = subscribeRemoteNongli(() => this.forceUpdate());
		this.unmounted = false;
		window.addEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
		if(!this.restoreFromCurrentCase()){ this.drawCards(); }
	}
	componentWillUnmount(){
		if(this._unsubNongli){ this._unsubNongli(); }
		this.unmounted = true;
		window.removeEventListener('horosa:refresh-module-snapshot', this.handleSnapshotRefreshRequest);
	}

	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'tarot'){ return; }
		const reading = this.state ? this.state.reading : null;
		if(!reading){ return; }
		let text = '';
		try{ text = `${buildReadingText(reading, this.state.question) || ''}`.trim(); }catch(e){ text = ''; }
		if(text){
			saveModuleAISnapshot('tarot', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){ evt.detail.snapshotText = text; }
		}
	}

	// 单一重算路径:据当前 state(+ 给定 seed)算 reading,setState + 快照。所有变更入口都走它,杜绝漂移。
	applyRecompute(seedOverride){
		const seed = seedOverride !== undefined ? seedOverride : this.state.lastSeed;
		if(seed === undefined || seed === null || seed === ''){ return; }
		const reading = buildReading(this.state.deckId, this.state.spreadType, `${seed}`, settingsFromState(this.state));
		this.setState({ reading, lastSeed: `${seed}` }, () => {
			saveModuleAISnapshotLazy('tarot', () => buildReadingText(this.state.reading, this.state.question));
		});
	}

	// [X1] 定局法切换:牌(seed 所出)冻结不重抽,仅按新 mode 重建 reading.settings 并重存快照
	// (旧版只 setState → UI 活算新 mode、快照仍旧 mode,两处 Yes/No 可相互矛盾)。
	changeVerdictMode(mode){
		this.setState({ verdictMode: mode }, () => {
			const seed = this.state.lastSeed;
			if(seed !== undefined && seed !== null && seed !== ''){ this.applyRecompute(); return; }
			const r = this.state.reading;
			if(r && r.settings){
				const reading = { ...r, settings: { ...r.settings, verdictMode: mode } };
				this.setState({ reading }, () => {
					saveModuleAISnapshotLazy('tarot', () => buildReadingText(this.state.reading, this.state.question));
				});
			}
		});
	}

	restoreFromCurrentCase(force){
		const saved = getKentangSavedCasePayload('tarot');
		if(!saved || !saved.payload){ return false; }
		if(!force && this.lastRestoredCaseId === saved.caseVersion){ return false; }
		const payload = saved.payload;
		const options = payload.options && typeof payload.options === 'object' ? payload.options : {};
		this.lastRestoredCaseId = saved.caseVersion;
		const deckId = getDeck(options.deckId) ? (options.deckId || DEFAULT_DECK) : DEFAULT_DECK;
		const spreadType = SPREADS[options.spreadType] ? options.spreadType : DEFAULT_SPREAD;
		const seed = options.seed !== undefined && options.seed !== null ? `${options.seed}` : '';
		const dd = deckDefaults(deckId);
		const st = options.settings || {};
		this.setState({
			deckId, spreadType,
			seedMode: options.seedMode || 'manual',
			manualSeed: options.seedMode === 'manual' ? options.seed : this.state.manualSeed,
			question: options.question !== undefined ? options.question : this.state.question,
			useReversals: st.reversals === undefined ? dd.reversals : st.reversals,
			useDignities: st.dignities === undefined ? dd.dignities : st.dignities,
			variant: st.variant || dd.variant,
			showCorrespondences: st.showCorrespondences === undefined ? dd.showCorrespondences : st.showCorrespondences,
			sig: st.sig || this.state.sig,
			birth: st.birth || this.state.birth,
			verdictMode: st.verdictMode || 'majority',
			artStyle: st.artStyle || 'symbol',
			lastSeed: seed,
		}, () => {
			if(seed){ this.applyRecompute(seed); }
			else if(payload.reading){ this.setState({ reading: payload.reading }); }
		});
		return true;
	}

	changeDeck(deckId){
		const dd = deckDefaults(deckId);
		const deck = getDeck(deckId);
		// 牌阵:若当前牌阵不在新牌组允许列表 → 回落该牌组首个允许牌阵
		const allowed = (deck.caps && deck.caps.spreads) || Object.keys(SPREADS);
		const spreadType = allowed.indexOf(this.state.spreadType) >= 0 ? this.state.spreadType : (allowed[0] || DEFAULT_SPREAD);
		this.setState({ deckId, spreadType, useReversals: dd.reversals, useDignities: dd.dignities, variant: dd.variant, showCorrespondences: dd.showCorrespondences }, () => this.applyRecompute());
	}
	changeSpread(spreadType){ this.setState({ spreadType }, () => this.applyRecompute()); }
	changeSetting(patch){ this.setState(patch, () => this.applyRecompute()); }

	drawCards(){
		const seed = resolveSeed(this.state.seedMode, this.state.manualSeed, this.activeFields());
		this.applyRecompute(seed);
	}
	clickReproduce(){
		if(!this.state.lastSeed){ return; }
		this.setState({ seedMode: 'manual', manualSeed: this.state.lastSeed });
		message.success(`已锁定种子「${this.state.lastSeed}」,再次抽牌可复现此牌阵`);
	}
	// 快捷栏契约:抽牌=主键豁免;锁定复现等左栏已有控件不进栏;cnyibu 容器透传渲染。
	getQuickDockConfig(){
		return {
			hasResult: !!this.state.reading,
			primary: { key: 'draw', label: '抽牌', onClick: ()=>this.drawCards() },
			save: ()=>this.clickSaveCase(),
		};
	}

	// 当前生效 fields:本地草稿优先,否则主命盘 fields。
	activeFields(){
		return this.state.localFields || this.props.fields || {};
	}
	// [自由起盘] 左栏时间选择 → 写本地草稿。「出生信息」种子模式按此时刻算种子(可复现)。
	onTimeChanged(value){
		const dt = value && value.time;
		if(!dt){ return; }
		const base = this.state.localFields || this.props.fields || {};
		this.setState({ localFields: { ...base, ...timePatchFromDateTime(dt) } }, ()=>{ if(this.state.seedMode === 'birth'){ this.drawCards(); } });
	}
	// [自由起盘] 左栏经纬度选择 → 写本地草稿(经纬 + 时区 + 地名)。生辰种子含经纬熵;亦入事盘。
	changeGeo(rec){
		const base = this.state.localFields || this.props.fields || {};
		this.setState({ localFields: { ...base, ...geoPatchFromRec(rec, base) } }, ()=>{ if(this.state.seedMode === 'birth'){ this.drawCards(); } });
	}

	clickSaveCase(){
		if(!this.state.reading){ message.info('请先抽牌'); return; }
		openKentangCaseDrawer({
			dispatch: this.props.dispatch, fields: this.activeFields(), module: 'tarot', label: '塔罗',
			payload: {
				options: {
					deckId: this.state.deckId, spreadType: this.state.spreadType,
					seedMode: 'manual', seed: this.state.lastSeed, question: this.state.question,
					settings: settingsFromState(this.state),
				},
				reading: this.state.reading,
				snapshot: buildReadingText(this.state.reading, this.state.question),
			},
		});
	}
	setRightPanelTab(key){ this.setState({ rightPanelTab: key }); }

	currentDeck(){ return getDeck(this.state.deckId); }
	caps(){ const d = this.currentDeck(); return (d && d.caps) || {}; }
	// 统一牌名:塔罗体系按 deck 出各派名;异构牌组(雷诺曼/扑克/Kipper)用其自有 name_cn(否则 displayNameCn 会出 undefined)。
	cardLabel(card){ if(!card){ return '-'; } return this.caps().readingMethod === 'tarot' ? displayNameCn(card, this.currentDeck()) : card.name_cn; }

	renderCard(draw, compact){
		const card = draw.card;
		if(!card){ return null; }
		const deck = this.currentDeck();
		const caps = this.caps();
		const isTarot = caps.readingMethod === 'tarot';
		const color = card.suitColor || SUIT_COLOR[card.suit] || SUIT_COLOR.major;
		const meanings = card.meanings || {};
		const kwArr = (draw.isReversed ? (meanings.rev || card.keywords_reversed) : (meanings.up || card.keywords_upright)) || [];
		const kw = kwArr.slice(0, compact ? 2 : 3).join('、');
		const showCorr = isTarot && this.state.showCorrespondences && !compact;
		const dignity = draw.dignity;
		const king = caps.colorScale ? kingScaleColor(card) : null;
		const cnName = isTarot ? displayNameCn(card, deck) : card.name_cn;
		const enName = isTarot ? displayNameEn(card, deck) : (card.playingCard || card.name_en);
		const imgUrl = this.state.artStyle === 'image' ? cardImageUrl(this.state.deckId, card) : null;
		return (
			<div key={`${draw.position.i}-${draw.cardId}`} className="horosa-tarot-card" style={{ borderColor: color }}>
				<div className="horosa-tarot-card-pos">{draw.position.label}</div>
				<div className="horosa-tarot-card-face" style={{ color, transform: draw.isReversed ? 'rotate(180deg)' : 'none' }}>
					<div className="horosa-tarot-card-visual">
						{imgUrl ? <img className="horosa-tarot-card-img" src={imgUrl} alt={cnName} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; const s = e.currentTarget.parentElement.querySelector('.horosa-tarot-card-symbol'); if(s){ s.style.display = ''; } }} /> : null}
						<span className="horosa-tarot-card-symbol" style={imgUrl ? { display: 'none' } : null}>{card.symbol}</span>
					</div>
					<span className="horosa-tarot-card-name">{cnName}</span>
					<span className="horosa-tarot-card-en">{enName}</span>
				</div>
				{caps.reversals !== false ? <div className={`horosa-tarot-card-orient${draw.isReversed ? ' is-reversed' : ''}`}>{orientationLabel(draw.isReversed)}</div> : null}
				{king ? <div className="horosa-tarot-corr" title={`King 色阶 ${king.name}`}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: king.hex, marginRight: 4, verticalAlign: 'middle' }} />{king.name}</div> : null}
				{showCorr ? <div className="horosa-tarot-corr">{astroLine(card, deck, this.state.variant)}</div> : null}
				{dignity ? <div className={`horosa-tarot-dignity is-${dignity.strength === '强' ? 'strong' : dignity.strength === '弱' ? 'weak' : 'neutral'}`} title={dignity.notes}>尊位·{dignity.strength}</div> : null}
				<div className="horosa-tarot-card-kw">{kw}</div>
			</div>
		);
	}

	renderSignificatorSlot(){
		const reading = this.state.reading;
		if(!reading || !reading.significator || !reading.significator.card){ return null; }
		const deck = this.currentDeck();
		const card = reading.significator.card;
		const color = SUIT_COLOR[card.suit] || SUIT_COLOR.major;
		return (
			<div className="horosa-tarot-sig-card" style={{ borderColor: color }}>
				<div className="horosa-tarot-sig-ribbon">指示牌</div>
				<div className="horosa-tarot-card-face" style={{ color }}>
					<span className="horosa-tarot-card-symbol">{card.symbol}</span>
					<span className="horosa-tarot-card-name">{displayNameCn(card, deck)}</span>
				</div>
			</div>
		);
	}

	renderCenter(){
		const reading = this.state.reading;
		const spread = reading ? SPREADS[reading.spreadType] : SPREADS[this.state.spreadType];
		if(!reading || !reading.draws || !reading.draws.length){
			return <div className="horosa-tarot-empty">请选择流派与牌阵并点「抽牌」</div>;
		}
		const n = reading.draws.length;
		const compact = n > 5;
		// 真实几何:位置带 x/y 且张数 ≤13(凯尔特十字/生命树/十二宫/马蹄铁/关系/croix)→ 绝对定位;否则网格(单/三/年度/GT)。
		const useGeometry = n <= 13 && spread.positions.every((p) => typeof p.x === 'number' && typeof p.y === 'number') && !['single', 'three', 'three_sit'].includes(reading.spreadType);
		if(useGeometry){
			const isImg = this.state.artStyle === 'image' && deckHasRealArt(this.state.deckId);
			const geo = computeGeoLayout(spread.positions, reading.spreadType, isImg);
			return (
				<div className="horosa-tarot-stage">
					<div className="horosa-tarot-stage-title">{reading.deckTitle} · {spread.label}</div>
					{this.renderSignificatorSlot()}
					<div className="horosa-tarot-geo" style={{ width: geo.W, maxWidth: '100%', height: geo.H, margin: '0 auto', flex: '0 0 auto' }}>
						{reading.draws.map((d, idx) => {
							const pos = d.position;
							// 凯尔特十字第2位(交叉牌)与第1位同点→旋转90°叠放(唯一蓄意重叠)
							const crossing = reading.spreadType === 'celtic' && idx === 1;
							return (
								<div key={`geo-${pos.i}-${d.cardId}`} className="horosa-tarot-geo-slot" style={{ left: `${pos.x * 100}%`, top: `${((geo.padY + pos.y * geo.innerH) / geo.H * 100).toFixed(3)}%`, width: geo.slotW, transform: `translate(-50%,-50%)${crossing ? ' rotate(90deg)' : ''}` }}>
									{this.renderCard(d, true)}
								</div>
							);
						})}
					</div>
					<div className="horosa-tarot-attr">{PUBLIC_DOMAIN_ATTRIBUTION}</div>
				</div>
			);
		}
		const cols = n <= 3 ? n : (n <= 5 ? 5 : (n <= 10 ? 5 : (n <= 36 ? 8 : 8)));
		return (
			<div className="horosa-tarot-stage">
				<div className="horosa-tarot-stage-title">{reading.deckTitle} · {spread.label}</div>
				{this.renderSignificatorSlot()}
				<div className="horosa-tarot-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
					{reading.draws.map((d) => this.renderCard(d, compact || n > 13))}
				</div>
				<div className="horosa-tarot-attr">{PUBLIC_DOMAIN_ATTRIBUTION}</div>
			</div>
		);
	}

	renderInputPanel(){
		const s = this.state;
		const caps = this.caps();
		const deck = this.currentDeck();
		const groups = listDeckGroups();
		const allowedSpreads = (caps.spreads || Object.keys(SPREADS)).filter((k) => SPREADS[k]);
		return (
			<div className="horosa-huangji-input-stack horosa-tarot-input-stack">
				{/* [自由起盘] 时间与地点:「出生信息」种子按此时地算(可复现);亦作占问时刻·地点入事盘(不写主命盘) */}
				<XQSideSection iconName={sideSectionIcon('time')} title="时间与地点" collapsible={false}>
					<SpaceTimePanel
						fields={this.activeFields()}
						value={buildDateTimeFromFields(this.activeFields())}
						onTimeChange={this.onTimeChanged}
						onGeoChange={this.changeGeo}
					/>
				</XQSideSection>
				{/* [观象P2] tarot 左栏四段式:牌组牌阵(不折叠)/高级/指示牌/种子所问(折叠记忆) */}
				<XQSideSection iconName={sideSectionIcon('school')} title="流派与牌阵" collapsible={false}>
				<div className="horosa-tarot-field">
					<label>流派 / 牌组</label>
					<Select value={s.deckId} onChange={this.changeDeck} size="small" style={{ width: '100%' }} dropdownMatchSelectWidth={false} dropdownClassName="horosa-tarot-deck-dropdown" listHeight={420}>
						{groups.map((g) => (
							<OptGroup label={g.group} key={g.group}>
								{g.items.map((it) => (<Option value={it.value} key={it.value}>{it.label}</Option>))}
							</OptGroup>
						))}
					</Select>
				</div>
				<div className="horosa-tarot-field">
					<label>牌阵</label>
					<Select value={allowedSpreads.indexOf(s.spreadType) >= 0 ? s.spreadType : allowedSpreads[0]} onChange={this.changeSpread} size="small" style={{ width: '100%' }} dropdownMatchSelectWidth={false}>
						{allowedSpreads.map((k) => (<Option value={k} key={k}>{SPREADS[k].label}</Option>))}
					</Select>
				</div>

				</XQSideSection>
				<XQSideSection iconName={sideSectionIcon('advanced')} title="高级设置" storageKey="tarot.advanced" className="horosa-side-input-section">
				{deckHasRealArt(s.deckId) ? (
					<div className="horosa-tarot-field">
						<label>牌面样式</label>
						<XQSegmented value={s.artStyle} onChange={(e) => this.setState({ artStyle: e.target.value })} options={[{ label: '简约符号', value: 'symbol' }, { label: '真实牌面', value: 'image' }]} />
						{s.artStyle === 'image' && deckArtIsMajorsOnly(s.deckId) && deck && deck.size > 22 ? (
							<div style={{ fontSize: 11, lineHeight: 1.45, marginTop: 4, color: 'var(--horosa-astro-muted, #8fa0b9)' }}>真实牌面仅 22 大牌;花色小牌无公有领域单卡图,以符号呈现。需全 78 张真实牌面请用 RWS。</div>
						) : null}
					</div>
				) : null}
				{/* [塔罗开关=六爻同款芯片] 逆位/元素尊位/进阶对应改 Checkbox 芯片网格(与六爻/紫微显示项统一);caps 决定各芯片是否出现。 */}
				<div className="horosa-guazhan-toggle-grid horosa-tarot-toggle-grid">
					{caps.reversals !== false ? (
						<Checkbox checked={!!s.useReversals} onChange={(e) => this.changeSetting({ useReversals: e.target.checked })}>逆位</Checkbox>
					) : null}
					{caps.dignities ? (
						<Checkbox checked={!!s.useDignities} onChange={(e) => this.changeSetting({ useDignities: e.target.checked })}>元素尊位</Checkbox>
					) : null}
					{caps.variant ? (
						<Checkbox checked={!!s.showCorrespondences} onChange={(e) => this.changeSetting({ showCorrespondences: e.target.checked })}>显示进阶对应</Checkbox>
					) : null}
				</div>
				{caps.variant && s.showCorrespondences ? (
					<div className="horosa-tarot-field">
						<label>字母/路径变体</label>
						<XQSegmented value={s.variant} onChange={(e) => this.changeSetting({ variant: e.target.value })} options={[{ label: 'A 金色黎明', value: 'A' }, { label: 'B 托特', value: 'B' }, { label: 'C 大陆', value: 'C' }]} />
					</div>
				) : null}

				</XQSideSection>
				{caps.significator ? (
					<XQSideSection iconName={sideSectionIcon('target')} title="指示牌" storageKey="tarot.sig" className="horosa-side-input-section">
					<>
						<div className="horosa-tarot-field">
							<label>选取方式</label>
							<Select value={s.sig.mode} onChange={(v) => this.changeSetting({ sig: { ...s.sig, mode: v } })} size="small" style={{ width: '100%' }}>
								<Option value="none">不使用</Option>
								<Option value="auto">自动(性别·年龄·星座)</Option>
								<Option value="manual">手动指定</Option>
							</Select>
						</div>
						{s.sig.mode === 'auto' ? (
							<>
								<div className="horosa-tarot-field"><label>性别</label>
									<XQSegmented value={s.sig.gender} onChange={(e) => this.changeSetting({ sig: { ...s.sig, gender: e.target.value } })} options={[{ label: '男', value: 'male' }, { label: '女', value: 'female' }]} />
								</div>
								<div className="horosa-tarot-field"><label>年龄</label>
									<InputNumber value={s.sig.age} min={0} max={120} onChange={(v) => this.changeSetting({ sig: { ...s.sig, age: v } })} size="small" style={{ width: '100%' }} />
								</div>
								<div className="horosa-tarot-field"><label>星座</label>
									<Select value={s.sig.sign} onChange={(v) => this.changeSetting({ sig: { ...s.sig, sign: v } })} size="small" style={{ width: '100%' }} placeholder="选择星座">
										{SIGN_KEYS.map((k) => (<Option value={k} key={k}>{SIGN_CN[k]}</Option>))}
									</Select>
								</div>
							</>
						) : null}
						{s.sig.mode === 'manual' ? (
							<div className="horosa-tarot-field"><label>宫廷牌</label>
								<Select value={s.sig.manualId} onChange={(v) => this.changeSetting({ sig: { ...s.sig, manualId: v } })} size="small" style={{ width: '100%' }}>
									{SUITS.map((suit) => COURT_ORDER.map((court) => (
										<Option value={`${suit}_${court}`} key={`${suit}_${court}`}>{SUIT_CN[suit]}{COURT_CN.rws[court]}</Option>
									)))}
								</Select>
							</div>
						) : null}
					</>
					</XQSideSection>
				) : null}
				<XQSideSection iconName={sideSectionIcon('input')} title="种子与所问" storageKey="tarot.seed" className="horosa-side-input-section">
				<div className="horosa-tarot-field">
					<label>种子来源</label>
					<Select value={s.seedMode} onChange={(v) => this.setState({ seedMode: v })} size="small" style={{ width: '100%' }}>
						<Option value="birth">出生信息(可复现)</Option>
						<Option value="manual">手动数字</Option>
						<Option value="random">随机</Option>
					</Select>
				</div>
				{s.seedMode === 'manual' ? (
					<div className="horosa-tarot-field"><label>手动种子</label>
						<InputNumber value={s.manualSeed} onChange={(v) => this.setState({ manualSeed: v })} size="small" style={{ width: '100%' }} />
					</div>
				) : null}
				<div className="horosa-tarot-field">
					<label>所问之事(可选)</label>
					<Input value={s.question} onChange={(e) => this.setState({ question: e.target.value })} onBlur={() => this.applyRecompute()} size="small" placeholder="如:这段关系的走向" />
				</div>
				</XQSideSection>
				<div className="horosa-tarot-actions">
					<Button type="primary" size="small" iconName="quickPrimary" onClick={this.drawCards}>抽牌</Button>
					<Button size="small" iconName="quickFirdaria" onClick={this.clickReproduce}>锁定复现</Button>
					<Button size="small" iconName="quickNote" onClick={this.clickSaveCase}>保存</Button>
				</div>
				{s.lastSeed ? <div className="horosa-tarot-seed-hint">当前种子：{s.lastSeed}</div> : null}
			</div>
		);
	}

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
				<TabPane tab="总览" key="overview">
					<div className="horosa-tarot-reading">
						{this.state.question ? <div className="horosa-info-card"><div className="horosa-info-card-title">所问</div><div>{this.state.question}</div></div> : null}
						{draws.length ? (
							<div className="horosa-info-card">
								<div className="horosa-info-card-title">牌阵直断</div>
								{draws.map((d) => {
									if(!d.card){ return null; }
									const m = d.card.meanings || {};
									const kw = ((d.isReversed ? m.rev : m.up) || []).slice(0, 4).join('、');
									return (<div key={d.position.i} className="horosa-tarot-line"><b>{d.position.label}</b>：{this.cardLabel(d.card)}（{orientationLabel(d.isReversed)}）— {kw}</div>);
								})}
								{summary ? <div className="horosa-tarot-line" style={{ marginTop: 6, opacity: 0.85 }}>综合：{synthesizeText(summary)}</div> : null}
							</div>
						) : <div className="horosa-tarot-empty">尚未抽牌</div>}
					</div>
				</TabPane>
				<TabPane tab="牌位" key="positions">
					<table className="horosa-tarot-table">
						<thead><tr><th>位置</th><th>牌</th><th>正逆</th><th>含义</th></tr></thead>
						<tbody>{draws.map((d) => (
							<tr key={d.position.i}>
								<td>{d.position.i}. {d.position.label}</td>
								<td>{d.card ? `${this.cardLabel(d.card)}${d.card.symbol}` : '-'}</td>
								<td className={d.isReversed ? 'is-reversed' : ''}>{orientationLabel(d.isReversed)}</td>
								<td>{d.position.meaning}</td>
							</tr>
						))}</tbody>
					</table>
				</TabPane>
				<TabPane tab="牌义" key="meanings">
					<table className="horosa-tarot-table">
						<thead><tr><th>牌</th>{caps.reversals !== false ? <th>正逆</th> : null}{isTarot ? <th>对应</th> : null}{caps.dignities ? <th>尊位</th> : null}<th>关键义</th></tr></thead>
						<tbody>{draws.map((d) => {
							const m = d.card ? (d.card.meanings || {}) : {};
							return (
								<tr key={d.position.i}>
									<td>{d.card ? `${isTarot ? displayNameCn(d.card, deck) : d.card.name_cn}${d.card.symbol}` : '-'}</td>
									{caps.reversals !== false ? <td className={d.isReversed ? 'is-reversed' : ''}>{orientationLabel(d.isReversed)}</td> : null}
									{isTarot ? <td className="horosa-tarot-td-corr">{d.card ? astroLine(d.card, deck, this.state.variant) : '-'}</td> : null}
									{caps.dignities ? <td>{d.dignity ? d.dignity.strength : '—'}</td> : null}
									<td>{d.card ? ((d.isReversed ? m.rev : m.up) || []).join('、') : '-'}</td>
								</tr>
							);
						})}</tbody>
					</table>
				</TabPane>
				<TabPane tab="综合" key="synthesis">{this.renderSynthesis(summary)}</TabPane>
				{caps.readingMethod === 'lenormand' ? <TabPane tab="组合读法" key="lenormand">{this.renderLenormand(reading)}</TabPane> : null}
				{caps.readingMethod !== 'lenormand' ? <TabPane tab="定局" key="verdict">{this.renderVerdict(reading)}</TabPane> : null}
				{isTarot ? <TabPane tab="生命牌" key="birthcards">{this.renderBirthCards()}</TabPane> : null}
			</Tabs>
		);
	}

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
	}

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
					<div className="horosa-tarot-line">正位 {summary.total - summary.reversed} · 逆位 {summary.reversed}</div>
					{repKeys.length ? <div className="horosa-tarot-line">重复数字：{repKeys.map((k) => `${k}×${summary.repeats[k]}`).join('、')}（该数字原型被强调）</div> : null}
				</div>
			</div>
		);
	}

	renderVerdict(reading){
		if(!reading || !reading.draws || !reading.draws.length){ return <div className="horosa-tarot-empty">尚未抽牌</div>; }
		const deck = this.currentDeck();
		const cards = getDeckCards(this.state.deckId);
		const v = yesNo(reading.draws, this.state.verdictMode);
		const quint = quintessence(reading.draws, cards);
		const chain = countingChain(reading.draws, 0, Math.min(reading.draws.length, 8));
		return (
			<div className="horosa-tarot-reading">
				<div className="horosa-tarot-field"><label>Yes/No 定局法</label>
					<XQSegmented value={this.state.verdictMode} onChange={(e) => this.changeVerdictMode(e.target.value)} options={[{ label: '多数', value: 'majority' }, { label: '朝向', value: 'orientation' }, { label: '首牌', value: 'single' }, { label: '极性', value: 'polarity' }]} />
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">Yes / No</div>
					<div className="horosa-tarot-line" style={{ fontSize: 16 }}><b>{v.verdict}</b>（{this.state.verdictMode}，score {v.score}）</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">精华牌 Quintessence</div>
					<div className="horosa-tarot-line">{quint ? `${displayNameCn(quint, deck)}（${displayNameEn(quint, deck)}）` : '—'}</div>
				</div>
				<div className="horosa-info-card">
					<div className="horosa-info-card-title">计数链(线性演示)</div>
					<div className="horosa-tarot-line">{chain.map((c) => this.cardLabel(c)).join(' → ')}</div>
				</div>
			</div>
		);
	}

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
						<InputNumber placeholder="年" value={b.year} onChange={(v) => set({ year: v })} size="small" style={{ width: 80 }} />
						<InputNumber placeholder="月" min={1} max={12} value={b.month} onChange={(v) => set({ month: v })} size="small" style={{ width: 60 }} />
						<InputNumber placeholder="日" min={1} max={31} value={b.day} onChange={(v) => set({ day: v })} size="small" style={{ width: 60 }} />
						<InputNumber placeholder="流年" value={b.refYear} onChange={(v) => set({ refYear: v })} size="small" style={{ width: 80 }} />
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
	}

	render(){
		const height = this.props.height ? this.props.height : 760;
		const contentHeight = typeof height === 'number' ? Math.max(height - 8, 320) : height;
		return (
			<TechniqueErrorBoundary label="塔罗">
				<div className="horosa-cnyibu-technique horosa-tarot-page" style={{ height: contentHeight }}>
					<div className="horosa-tarot-layout">
						<div className="horosa-tarot-col-left">{this.renderInputPanel()}</div>
						<div className="horosa-tarot-col-center">{this.renderCenter()}</div>
						<div className="horosa-tarot-col-right">{this.renderRightPanel()}</div>
					</div>
				</div>
			</TechniqueErrorBoundary>
		);
	}
}

export default TarotMain;
