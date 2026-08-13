import { isTrumpArcana } from './engine/arcana';
import React, { Component } from 'react';
import { wrapperPropsEqual } from '../../utils/chartUpdateGuard';
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
import { displayNameCn, displayNameEn, astroLine, cardMeaning, correspondenceSuffix } from './engine/cardSchema';
import { SPREADS, DEFAULT_SPREAD, orientationLabel, SPREAD_GROUPS } from './engine/spreads';
import { yesNo, quintessence, theosophicalGroups, countingChain, birthCards, yearCard, majorByNumber, synthesizeText, pairings, clarifier } from './engine/verdict';
import { buildReadingText } from './engine/reportText';
import { kingScaleColor, minorScaleColor } from './engine/colorScales';
import { cardImageUrl, deckHasRealArt, deckArtIsMajorsOnly } from './engine/cardArt';
import { SIGN_CN, SUIT_CN, COURT_CN, COURT_ORDER, SUITS, MAJORS_CORR, pathJoin, isFriend, isEnemy } from './decks/correspondences';
import { cardElement } from './engine/cardSchema';
import { SCALE_META, SCALE_ORDER, scaleColor } from './engine/colorScales';
import { DUMMETT_ORDERS } from './decks/visconti';
import { PUBLIC_DOMAIN_ATTRIBUTION } from './decks/meanings78';
import { markPanelReady } from '../../utils/perfMark';
import { FreezeSubTab } from '../comp/FreezeInactive';
// settings↔state 键映射单源(保存/载入同表,防「存而不载」)——正文与 roundtrip 哨兵见 engine/settingsMap.js。
import { settingsFromState, statePatchFromSavedSettings } from './engine/settingsMap';
import { REVERSAL_MODE_GROUPS, REVERSAL_TEMPLATES } from './engine/reversalModes';
import { computeTimingLines, TIMING_METHODS, TIMING_METHOD_LABEL } from './engine/timingMethods';
import { comboHints, COMBO_GUARD_NOTES } from './decks/comboThemes';
import { YESNO_MODES, YESNO_MODE_LABEL } from './engine/verdict';
import { courtSignDetect, COURT_READING_RULES, COURT_CHARACTER_NOTE } from './decks/courtSystems';
import { buildDailySeed, appendDailyLog, dailyStats, loadDailyLog, saveDailyLog } from './engine/dailyCourse';
import { decanTimingOf } from './engine/timingMethods';
import CardDetailDrawer from './CardDetailDrawer';

const { TabPane } = Tabs;
const { Option, OptGroup } = Select;

const SUIT_COLOR = {
	major: 'var(--horosa-astro-gold, #d7ad69)',
	wands: '#e08a4b', cups: '#5aa6d6', swords: '#9a8fd6', pentacles: '#6fae74',
};
const SIGN_KEYS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const RIGHT_TABS = ['overview', 'positions', 'meanings', 'synthesis', 'verdict', 'birthcards', 'lenormand', 'ook', 'pairs', 'daily'];

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
		meaningSystem: d.meaningDefault || 'manual', // TP2 马赛系(tdm/wirth/egyptian/visconti)默认吸附「数字度」
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
	// [R3-A6] 渲染守卫:宿主无关 dispatch 不再全树重渲(nextState 引用变照常放行;
	// 开关 horosa.perf.chartSCU,语义详 chartUpdateGuard.wrapperPropsEqual)。
	shouldComponentUpdate(nextProps, nextState){
		if(nextState !== this.state){
			return true;
		}
		return !wrapperPropsEqual(this.props, nextProps);
	}

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
			quintMode: 'standard', // TP2 精华牌口径:'standard' 通行 | 'fool22' 马赛数值加法(愚人计22,3张阵另显分组加法)
			showBottomCard: false, // TP2 牌底牌(基调):默认关
			edVersion: 'modern', // TP3 尊位版本:'modern' 现行三档 | 'mathers' 原典四档(火土/风水=稍微支持)
			astroModern: false, // TP3 三元素大牌附现代行星注(天/海/冥):默认关
			timingMethod: 'suit_unit', // TP4 计时法:花色单位(默认)/大牌数字/大牌星座/旬星全谱/翻至王牌
			timingUnit: '周', // TP4 大牌数字法单位:天/周/月
			majorsOverlay: false, // TP4 大牌加盖(≥4大牌或过半→每大牌自余牌盖一张小牌):默认关
			showCutCard: false, // TP4 切牌(问卜者心态):默认关
			includeBlank: false, // TP4 空白牌入池(78+1):默认关
			courtElementSystem: 'gd', // TP7 宫廷元素:'gd' 元素中元素(默认) | 'alt' 位阶制(王土/后水/骑火/侍风)
			courtZodiacSystem: 'gd_span', // TP7 宫廷星座:'gd_span' 跨段(默认) | 'simple' 单座制(侍无星座)
			meaningSystem: dd.meaningSystem, // 牌义体系:'manual' 逐牌唯一义 | 'waite' 派生义 | 'degrees' 马赛数字度(随牌组吸附)
			reversalMode: 'stored', // 逆位读法:'stored' 预存逆位义(默认) | blocked/internal/opposite/reduced/excess
			suitElementSwap: false, // 火/风互换(少数派):默认 off
			reversalGen: 'shuffle', // 逆位产生:'shuffle' 洗牌逐张(默认) | 'fingers3' 三指定牌 | 'all' 全逆位阵
			crossingUpright: true, // 凯尔特交叉牌恒正读(横置第三态,古法默认开;关=按洗牌朝向读)
			dummettOrder: 'C', // 大牌顺序 Dummett A/B/C 区域序(仅 visconti;A/B 切区域特征注记,不重排逐牌)
			ookTable: 'standard', // 开钥计数表:'standard' 通行(数字=面值/Ace5/宫廷4/侍7/大牌3·9·12) | 'sephira' 质点(王2/后3/骑6/侍9)
			artStyle: 'symbol', // 'symbol' 简约符号(默认,零网络) | 'image' 真实牌面(仅 PD 牌组,onError 回退符号)
			// [自由起盘] 本地时间地理草稿(null=跟主命盘;非空=用户左栏自选:「出生信息」种子按此时地算,亦入事盘)。
			localFields: null,
			detailCard: null, // TP6 单卡详情面板当前牌(null=关)
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
	// 🔴 载档触发通路:本组件此前**只有** componentDidMount 这一条。
	// 而子技法面板常驻挂载(Tabs 无 destroyInactiveTabPane),用户若已停在塔罗页再从事盘列表
	// 载一条塔罗档,组件不重挂 → mount 不响 → 载档静默不生效(盘不变,像没点一样)。
	// 补上 fields 变化即还原(照 lingqi:90 / guice:94 同款范式)。
	// 🔴 这里只调 restore、**绝不在返 false 时 drawCards** —— 那会让「改个时间」变成重新抽牌,
	// 把冻结值毁掉;mount 那处的 drawCards 是首屏兜底,语义不同。
	componentDidUpdate(prev){
		if(prev.fields !== this.props.fields && this.props.fields){ this.restoreFromCurrentCase(); }
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
			// horosa_panel_ready_v1:reading 落定 = 牌阵(中栏)与释义(右栏)画完的那一次 setState。
			markPanelReady('cnyibu');
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
		// 载入回灌走 SETTINGS_STATE_MAP 单源(与保存同键集,防「存而不载」);缺省回落 deck 默认/当前值。
		const settingsPatch = statePatchFromSavedSettings(st, {
			useReversals: dd.reversals, useDignities: dd.dignities, variant: dd.variant, showCorrespondences: dd.showCorrespondences,
			sig: this.state.sig, birth: this.state.birth,
			verdictMode: 'majority', artStyle: 'symbol',
			meaningSystem: dd.meaningSystem, reversalMode: 'stored', suitElementSwap: false,
			dummettOrder: 'C', ookTable: 'standard',
			reversalGen: 'shuffle', crossingUpright: true,
			quintMode: 'standard', showBottomCard: false,
			edVersion: 'modern', astroModern: false,
			timingMethod: 'suit_unit', timingUnit: '周', majorsOverlay: false, showCutCard: false, includeBlank: false,
			courtElementSystem: 'gd', courtZodiacSystem: 'gd_span',
		});
		this.setState({
			deckId, spreadType,
			seedMode: options.seedMode || 'manual',
			manualSeed: options.seedMode === 'manual' ? options.seed : this.state.manualSeed,
			question: options.question !== undefined ? options.question : this.state.question,
			...settingsPatch,
			lastSeed: seed,
			// 载档必清本地时地草稿:存档记的 divTime 取自 activeFields()(草稿优先),
			// 不清则载回来左栏仍显示用户先前改的草稿时地,与存档所记不符
			// (guice / lingqi / feigong / xiaoliuren / xiaochengtu 皆已如此)。
			localFields: null,
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
		this.setState({ deckId, spreadType, useReversals: dd.reversals, useDignities: dd.dignities, variant: dd.variant, showCorrespondences: dd.showCorrespondences, meaningSystem: dd.meaningSystem }, () => this.applyRecompute());
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
	// 朝向标签三态:横置(凯尔特交叉牌恒正读)/正位/逆位。
	orientLabel(d){ return d && d.crossed ? '横置' : orientationLabel(d && d.isReversed); }
	// TP5 四元素诊断位注:落牌元素 vs 位元素(同气充沛/相生有助/相制费力/中平;逆位加待疏)。
	elements4Note(d){
		if(!d || !d.card || !d.position || !d.position.slotElement){ return ''; }
		const slot = d.position.slotElement;
		const el = cardElement(d.card, this.state.suitElementSwap);
		let core;
		if(!el){ core = '此牌无定元素,以牌义直断'; }
		else if(el === slot){ core = '与位同气——此层充沛顺行'; }
		else if(isFriend(slot, el)){ core = '与位相生——此层有助'; }
		else if(isEnemy(slot, el)){ core = '与位相制——此层费力受阻'; }
		else{ core = '与位中平——不助不碍'; }
		return `${core}${d.isReversed ? '(逆:另有一层待疏通)' : ''}`;
	}
	// 统一牌名:塔罗体系按 deck 出各派名;异构牌组(雷诺曼/扑克/Kipper)用其自有 name_cn(否则 displayNameCn 会出 undefined)。
	cardLabel(card){ if(!card){ return '-'; } return this.caps().readingMethod === 'tarot' ? displayNameCn(card, this.currentDeck()) : card.name_cn; }

	// G6:牌阵连线 SVG（生命树 22 路径 / 凯尔特十字臂 / 关系人物连线 / 金字塔层级引导），置于牌下淡色。
	renderSpreadLines(reading, geo, spread){
		const type = reading.spreadType;
		if(!['tree_of_life', 'celtic', 'celtic6', 'celtic11', 'relation', 'relation7', 'pyramid10'].includes(type)){ return null; }
		const W = geo.W;
		const H = geo.H;
		const px = (p) => ({ x: p.x * W, y: geo.padY + p.y * geo.innerH });
		const posByI = {};
		spread.positions.forEach((p) => { posByI[p.i] = p; });
		const gold = 'var(--horosa-astro-gold, #d7ad69)';
		const lines = [];
		const line = (key, a, b, opacity, dash, w) => {
			if(!a || !b){ return; }
			const pa = px(a); const pb = px(b);
			lines.push(<line key={key} x1={pa.x.toFixed(1)} y1={pa.y.toFixed(1)} x2={pb.x.toFixed(1)} y2={pb.y.toFixed(1)} stroke={gold} strokeWidth={w || 1} strokeOpacity={opacity} strokeDasharray={dash || ''} />);
		};
		if(type === 'tree_of_life'){
			MAJORS_CORR.forEach((m, mi) => {
				const j = pathJoin(m.id, reading.settings && reading.settings.variant);
				if(!j){ return; }
				line(`path${mi}`, posByI[j[0]], posByI[j[1]], 0.34, '', 1);
			});
		}else if(type === 'celtic' || type === 'celtic6' || type === 'celtic11'){
			[3, 4, 5, 6].forEach((k) => line(`arm${k}`, posByI[1], posByI[k], 0.24, '3 3', 1));
		}else if(type === 'relation' || type === 'relation7'){
			line('r1', posByI[1], posByI[3], 0.3, '3 3', 1);
			line('r2', posByI[2], posByI[3], 0.3, '3 3', 1);
		}else if(type === 'pyramid10'){
			const layers = [[1, 2, 3, 4], [5, 6, 7], [8, 9], [10]];
			for(let L = 0; L < layers.length - 1; L++){
				layers[L].forEach((bi) => layers[L + 1].forEach((ti) => line(`py${bi}_${ti}`, posByI[bi], posByI[ti], 0.14, '', 0.6)));
			}
		}
		if(!lines.length){ return null; }
		return <svg className="horosa-tarot-lines" width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 0 }}>{lines}</svg>;
	}

	renderCard(draw, compact){
		const card = draw.card;
		if(!card){ return null; }
		const deck = this.currentDeck();
		const caps = this.caps();
		const isTarot = caps.readingMethod === 'tarot';
		const color = card.suitColor || SUIT_COLOR[card.suit] || SUIT_COLOR.major;
		const kwArr = String(cardMeaning(card, draw.isReversed, this.state.meaningSystem, this.state.reversalMode) || '').split('、');
		const kw = kwArr.slice(0, compact ? 2 : 3).join('、');
		const showCorr = isTarot && this.state.showCorrespondences && !compact;
		const dignity = draw.dignity;
		// TP3:色阶点扩展到小牌(数字=辉耀行×四界/宫廷=质点行;大牌仍为路径四阶色)。
		const scaleSwatches = caps.colorScale ? SCALE_ORDER.map((sk) => ({ sk, meta: SCALE_META[sk], c: isTrumpArcana(card.arcana) ? scaleColor(card, sk) : minorScaleColor(card, sk) })).filter((x) => x.c) : null;
		const cnName = isTarot ? displayNameCn(card, deck) : card.name_cn;
		const enName = isTarot ? displayNameEn(card, deck) : (card.playingCard || card.name_en);
		const imgUrl = this.state.artStyle === 'image' ? cardImageUrl(this.state.deckId, card) : null;
		return (
			<div key={`${draw.position.i}-${draw.cardId}`} className="horosa-tarot-card" style={{ borderColor: color, cursor: 'pointer' }} title="点击看牌详情" onClick={() => this.setState({ detailCard: card })}>
				<div className="horosa-tarot-card-pos">{draw.position.label}</div>
				<div className="horosa-tarot-card-face" style={{ color, transform: draw.isReversed ? 'rotate(180deg)' : 'none' }}>
					<div className="horosa-tarot-card-visual">
						{imgUrl ? <img className="horosa-tarot-card-img" src={imgUrl} alt={cnName} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; const s = e.currentTarget.parentElement.querySelector('.horosa-tarot-card-symbol'); if(s){ s.style.display = ''; } }} /> : null}
						<span className="horosa-tarot-card-symbol" style={imgUrl ? { display: 'none' } : null}>{card.symbol}</span>
					</div>
					<span className="horosa-tarot-card-name">{cnName}</span>
					<span className="horosa-tarot-card-en">{enName}</span>
				</div>
				{caps.reversals !== false ? <div className={`horosa-tarot-card-orient${draw.isReversed ? ' is-reversed' : ''}`}>{this.orientLabel(draw)}</div> : null}
				{scaleSwatches && scaleSwatches.length ? <div className="horosa-tarot-corr horosa-tarot-scales">{scaleSwatches.map((x) => <span key={x.sk} className="horosa-tarot-scale-dot" title={`${x.meta.label}（${x.meta.world}）${x.c.name}`}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: x.c.hex, verticalAlign: 'middle' }} /></span>)}<span className="horosa-tarot-scale-lbl">四色阶</span></div> : null}
				{showCorr ? <div className="horosa-tarot-corr">{astroLine(card, deck, this.state.variant, this.state.astroModern, { elementSystem: this.state.courtElementSystem, zodiacSystem: this.state.courtZodiacSystem })}{correspondenceSuffix(card, this.state.variant)}</div> : null}
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
			if(reading && reading.firstReversal && reading.firstReversal.error){
				return <div className="horosa-tarot-empty">{reading.firstReversal.error}</div>;
			}
			return <div className="horosa-tarot-empty">请选择流派与牌阵并点「抽牌」</div>;
		}
		// G7 开钥:中栏走专属分堆视图(四界/十二宫/旬/质点 分区 + 指示牌落点 + 计数链),而非几何散牌。
		if(reading.spreadType === 'opening_of_key'){ return this.renderOokCenter(reading); }
		// TP5 matrix 大阵(行标签网格):22 张英雄/抉择、15 张四中心、26 张潜流、31 张月历、九步解题。
		if(spread.layout === 'matrix' && spread.matrix){ return this.renderMatrixCenter(reading, spread); }
		const n = reading.draws.length;
		const compact = n > 5;
		// 真实几何:位置带 x/y 且张数 ≤13(凯尔特十字/生命树/十二宫/马蹄铁/关系/croix)→ 绝对定位;否则网格(单/三/年度/GT)。
		const useGeometry = n <= 13 && spread.positions.every((p) => typeof p.x === 'number' && typeof p.y === 'number') && !['single', 'three', 'three_sit'].includes(reading.spreadType);
		if(useGeometry){
			const isImg = this.state.artStyle === 'image' && deckHasRealArt(this.state.deckId);
			const geo = computeGeoLayout(spread.positions, reading.spreadType, isImg);
			// TP5 图钥(因果七杯):中央静置一张不入抽的构图之钥(以其牌面结构定七位之义)。
			const fixedCenterCard = spread.fixedCenter ? getDeckCards(this.state.deckId).find((c) => c.sid === spread.fixedCenter) : null;
			return (
				<div className="horosa-tarot-stage">
					<div className="horosa-tarot-stage-title">{reading.deckTitle} · {spread.label}</div>
					{this.renderSignificatorSlot()}
					<div className="horosa-tarot-geo" style={{ width: geo.W, maxWidth: '100%', height: geo.H, margin: '0 auto', flex: '0 0 auto', position: 'relative' }}>{this.renderSpreadLines(reading, geo, spread)}
						{fixedCenterCard ? (
							<div className="horosa-tarot-geo-slot" style={{ left: '50%', top: `${((geo.padY + 0.5 * geo.innerH) / geo.H * 100).toFixed(3)}%`, width: geo.slotW, transform: 'translate(-50%,-50%)', opacity: 0.55 }}>
								<div className="horosa-tarot-card" style={{ borderStyle: 'dashed' }}>
									<div className="horosa-tarot-card-pos">图钥(不入抽)</div>
									<div className="horosa-tarot-card-face" style={{ color: SUIT_COLOR[fixedCenterCard.suit] || SUIT_COLOR.major }}>
										<span className="horosa-tarot-card-symbol">{fixedCenterCard.symbol}</span>
										<span className="horosa-tarot-card-name">{this.cardLabel(fixedCenterCard)}</span>
									</div>
								</div>
							</div>
						) : null}
						{reading.draws.map((d, idx) => {
							const pos = d.position;
							// 凯尔特十字第2位(交叉牌)与第1位同点→旋转90°叠放(唯一蓄意重叠)
							const crossing = reading.spreadType === 'celtic' && idx === 1;
							return (
								<div key={`geo-${pos.i}-${d.cardId}`} className="horosa-tarot-geo-slot" style={{ left: `${pos.x * 100}%`, top: `${((geo.padY + pos.y * geo.innerH) / geo.H * 100).toFixed(3)}%`, width: geo.slotW, transform: `translate(-50%,-50%)${crossing ? ' rotate(90deg)' : ''}`, '--deal-i': idx }}>
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

	// TP5 matrix 大阵渲染:行标签列 + n 列网格;有 colLabels 则加表头行;空槽留白。复用 renderCard(compact)。
	renderMatrixCenter(reading, spread){
		const m = spread.matrix;
		const rows = m.rowLabels.length;
		const byCell = {};
		reading.draws.forEach((d) => {
			if(d.position && d.position.row !== undefined){ byCell[`${d.position.row}_${d.position.col}`] = d; }
		});
		const gridStyle = { display: 'grid', gridTemplateColumns: `72px repeat(${m.cols}, minmax(0, 1fr))`, gap: 6, alignItems: 'stretch', width: '100%' };
		const cellStyle = { minHeight: 96, display: 'flex', alignItems: 'stretch', justifyContent: 'center' };
		const labelStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, color: 'var(--horosa-astro-gold, #d7ad69)', textAlign: 'center', lineHeight: 1.4, padding: '0 2px' };
		const out = [];
		if(m.colLabels && m.colLabels.length){
			out.push(<div key="corner" />);
			m.colLabels.forEach((cl, ci) => out.push(<div key={`cl${ci}`} style={{ ...labelStyle, minHeight: 20 }}>{cl}</div>));
		}
		for(let r = 0; r < rows; r++){
			out.push(<div key={`rl${r}`} style={labelStyle}>{m.rowLabels[r]}</div>);
			for(let c = 0; c < m.cols; c++){
				const d = byCell[`${r}_${c}`];
				out.push(<div key={`c${r}_${c}`} style={cellStyle}>{d ? this.renderCard(d, true) : <div style={{ opacity: 0.12, alignSelf: 'center', fontSize: 18 }}>·</div>}</div>);
			}
		}
		return (
			<div className="horosa-tarot-stage">
				<div className="horosa-tarot-stage-title">{reading.deckTitle} · {spread.label}</div>
				{this.renderSignificatorSlot()}
				<div className="horosa-tarot-matrix" style={gridStyle}>{out}</div>
				<div className="horosa-tarot-attr">{PUBLIC_DOMAIN_ATTRIBUTION}</div>
			</div>
		);
	}

	// G7 开钥专属分堆视图:5 操作各成分区,显指示牌落堆(四界/十二宫/旬/质点)+ 环形计数链(mini 牌面,逆位翻转)。
	renderOokCenter(reading){
		const ook = reading && reading.ook;
		const deck = this.currentDeck();
		if(!ook){ return <div className="horosa-tarot-empty">开钥仅 Golden Dawn / Thoth 牌组 + 已选指示牌可用；请在左栏选定指示牌。</div>; }
		if(ook.error){ return <div className="horosa-tarot-empty">{ook.error}</div>; }
		const sig = reading.significator && reading.significator.card;
		const miniCard = (item, key, isSig) => {
			const c = item && item.card;
			if(!c){ return null; }
			const color = c.suitColor || SUIT_COLOR[c.suit] || SUIT_COLOR.major;
			return (
				<div key={key} className={`horosa-tarot-ook-mini${isSig ? ' is-sig' : ''}`} style={{ borderColor: color }} title={displayNameCn(c, deck)}>
					<span className="horosa-tarot-ook-mini-sym" style={{ color, transform: item.isReversed ? 'rotate(180deg)' : 'none' }}>{c.symbol}</span>
					<span className="horosa-tarot-ook-mini-name">{displayNameCn(c, deck)}</span>
				</div>
			);
		};
		return (
			<div className="horosa-tarot-stage horosa-tarot-ook-stage">
				<div className="horosa-tarot-stage-title">{reading.deckTitle} · 开钥五操作（分堆视图）</div>
				{sig ? <div className="horosa-tarot-ook-sig">指示牌锚点：<b>{displayNameCn(sig, deck)}</b> <span style={{ color: SUIT_COLOR[sig.suit] || SUIT_COLOR.major }}>{sig.symbol}</span></div> : null}
				<div className="horosa-tarot-ook-zones">
					{ook.operations.map((op) => (
						<div key={op.op} className="horosa-tarot-ook-zone">
							<div className="horosa-tarot-ook-zone-head">
								<span className="horosa-tarot-ook-badge">操作{op.op}</span>
								<span className="horosa-tarot-ook-opname">{op.name}</span>
								<span className="horosa-tarot-ook-pile">→ 落「{op.pileLabel}」· {op.pileSize} 张</span>
							</div>
							<div className="horosa-tarot-ook-chain">
								{(op.chain || []).length ? op.chain.map((it, i) => (
									<React.Fragment key={i}>
										{i > 0 ? <span className="horosa-tarot-ook-arrow">›</span> : null}
										{miniCard(it, i, i === 0)}
									</React.Fragment>
								)) : <span className="horosa-tarot-empty" style={{ padding: 0, opacity: 0.6 }}>指示牌未落此堆</span>}
							</div>
						</div>
					))}
					{ook.op5 ? (
						<div className="horosa-tarot-ook-zone is-op5">
							<div className="horosa-tarot-ook-zone-head"><span className="horosa-tarot-ook-badge">操作5</span><span className="horosa-tarot-ook-opname">{ook.op5.name}</span></div>
							<div className="horosa-tarot-ook-line">{ook.op5.summary}</div>
						</div>
					) : null}
				</div>
				<div className="horosa-tarot-attr">{PUBLIC_DOMAIN_ATTRIBUTION}</div>
			</div>
		);
	}

	// 左栏口径项的统一渲染:一个带标签的下拉,放进 .horosa-tarot-field-grid 即自动一行两个。
	// options[].note 挂到该选项的 title(悬停即见),不再在控件下方另起一行说明
	//(那种说明只在选中某档时才出现,位置飘忽且吃高度;正文详解在帮助文档「塔罗」章)。
	renderPickField({ label, value, onChange, options }){
		return (
			<div className="horosa-tarot-field" key={label}>
				<label>{label}</label>
				<Select value={value} onChange={onChange} size="small" style={{ width: '100%' }} dropdownMatchSelectWidth={false}>
					{(options || []).map((opt)=>(
						<Option value={opt.value} key={opt.value} title={opt.note || opt.label}>{opt.label}</Option>
					))}
				</Select>
			</div>
		);
	}

	renderInputPanel(){
		const s = this.state;
		const caps = this.caps();
		const deck = this.currentDeck();
		const groups = listDeckGroups();
		const allowedSpreads = (caps.spreads || Object.keys(SPREADS)).filter((k) => SPREADS[k]);
		// 「牌阵细则」三项的门控:整节是否出现由这三项决定(全不适用即整节不渲染,不留空态卡)。
		// 单一来源 —— 节的显示条件与各项的显示条件必须同源,否则加第四项时会漏改其一。
		const spreadDetailShow = {
			crossing: ['celtic', 'celtic6', 'celtic11'].includes(s.spreadType) && caps.reversals !== false,
			ook: !!(caps.ook && s.spreadType === 'opening_of_key'),
			dummett: !!caps.dummett,
		};
		return (
			<div className="horosa-huangji-input-stack horosa-tarot-input-stack">
				{/* 原「⤢ 展开为全宽」按钮已按用户定案移除(连同 sideExpanded 视图态与 is-side-expanded 样式)。
				    它当初是为了缓解窄栏下控件被挤压;判读口径六项改成一行两个的下拉后,左栏本身已不挤,
				    这颗按钮只剩占位。窄窗的兜底改由 .horosa-tarot-field-grid 的媒体查询单独负责。 */}
				<div className="horosa-tarot-side-toolbar">
					<span className="horosa-tarot-side-toolbar-title">起卦设置</span>
				</div>
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
					<Select value={allowedSpreads.indexOf(s.spreadType) >= 0 ? s.spreadType : allowedSpreads[0]} onChange={this.changeSpread} size="small" style={{ width: '100%' }} dropdownMatchSelectWidth={false} listHeight={440} showSearch optionFilterProp="children">
						{(() => {
							// TP5 分组下拉:按 SPREAD_GROUPS 分组显示(仅列本牌组允许的);遗漏项兜底入「其他」。
							const allowedSet = new Set(allowedSpreads);
							const grouped = new Set();
							const nodes = SPREAD_GROUPS.map((g) => {
								const items = g.items.filter((k) => allowedSet.has(k) && SPREADS[k]);
								items.forEach((k) => grouped.add(k));
								if(!items.length){ return null; }
								return (
									<OptGroup label={g.group} key={g.group}>
										{items.map((k) => (<Option value={k} key={k}>{SPREADS[k].label}</Option>))}
									</OptGroup>
								);
							}).filter(Boolean);
							const rest = allowedSpreads.filter((k) => !grouped.has(k));
							if(rest.length){
								nodes.push(
									<OptGroup label="其他" key="__rest">
										{rest.map((k) => (<Option value={k} key={k}>{SPREADS[k].label}</Option>))}
									</OptGroup>
								);
							}
							return nodes;
						})()}
					</Select>
				</div>

				</XQSideSection>
				{/* 「流派简介」整节已移出左栏 —— 左栏不放大段解释(铁律),十四个牌组的
				    身份/历史/图义/小牌读法/与他派差异,以及四花色对照,改在右上角「帮助」
				    手册的塔罗页里看(那边直接读同一份数据源,不另抄一份)。 */}
				<XQSideSection iconName={sideSectionIcon('advanced')} title="盘面与开关" storageKey="tarot.advanced" className="horosa-side-input-section">
				{deckHasRealArt(s.deckId) ? (
					<div className="horosa-tarot-field">
						<label>牌面样式</label>
						<XQSegmented value={s.artStyle} onChange={(e) => this.setState({ artStyle: e.target.value })} options={[{ label: '简约符号', value: 'symbol' }, { label: '真实牌面', value: 'image' }]} />
						{s.artStyle === 'image' && deckArtIsMajorsOnly(s.deckId) && deck && deck.size > 22 ? (
							<div style={{ fontSize: 11, lineHeight: 1.45, marginTop: 4, color: 'var(--horosa-astro-muted, #8fa0b9)' }}>真实牌面仅 22 大牌;花色小牌无公有领域单卡图,以符号呈现。需全 78 张真实牌面请用 RWS。</div>
						) : null}
					</div>
				) : null}
				{/* [塔罗开关=六爻同款芯片] 逆位/元素尊位/进阶对应/牌底牌改 Checkbox 芯片网格(与六爻/紫微显示项统一);caps 决定各芯片是否出现。 */}
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
					{caps.readingMethod === 'tarot' ? (
						<Checkbox checked={!!s.showBottomCard} onChange={(e) => this.changeSetting({ showBottomCard: e.target.checked })}>牌底牌(基调)</Checkbox>
					) : null}
					{caps.readingMethod === 'tarot' ? (
						<Checkbox checked={!!s.showCutCard} onChange={(e) => this.changeSetting({ showCutCard: e.target.checked })}>切牌(心态)</Checkbox>
					) : null}
					{caps.readingMethod === 'tarot' ? (
						<Checkbox checked={!!s.majorsOverlay} onChange={(e) => this.changeSetting({ majorsOverlay: e.target.checked })}>大牌加盖</Checkbox>
					) : null}
					{caps.blank ? (
						<Checkbox checked={!!s.includeBlank} onChange={(e) => this.changeSetting({ includeBlank: e.target.checked })}>空白牌(79张)</Checkbox>
					) : null}
				</div>
				</XQSideSection>
				{/* [TP9 设置面重组] 判读口径类(牌义/逆位读法/对应与宫廷体系/尊位版本)集中一节,与上方「盘面与开关」
				    (决定牌面与流程的项)分开——两类语义不同:前者只改判读文本,后者改盘面本身。 */}
				<XQSideSection iconName={sideSectionIcon('school')} title="读法体系" storageKey="tarot.reading" className="horosa-side-input-section">
				{/* 🔴 判读口径六项原为横排分段控件(XQSegmented),每项自成一行、选项一多就换行,
				    整节吃掉左栏近半高度。改为**一行两个的下拉**:同样的信息密度只占三行。
				    各档原挂在控件下方的说明改走选项 title(悬停即见),正文详解在帮助文档「塔罗」章
				    ——「左边栏不放大段解释」铁律,且那些说明本就只在选中某一档时才出现、位置飘忽。 */}
				<div className="horosa-tarot-field-grid">
				{caps.variant && s.showCorrespondences ? this.renderPickField({
					label: '字母/路径变体',
					value: s.variant,
					onChange: (v) => this.changeSetting({ variant: v }),
					options: [{ label: 'A 金色黎明', value: 'A' }, { label: 'B 托特', value: 'B' }, { label: 'C 大陆', value: 'C' }],
				}) : null}
				{caps.readingMethod === 'tarot' && s.showCorrespondences ? this.renderPickField({
					label: '宫廷元素体系',
					value: s.courtElementSystem || 'gd',
					onChange: (v) => this.changeSetting({ courtElementSystem: v }),
					options: [
						{ label: '元素中元素', value: 'gd' },
						{ label: '位阶制', value: 'alt', note: '位阶制:王=土·后=水·骑=火·侍=风(另一派通行口径)。' },
					],
				}) : null}
				{caps.readingMethod === 'tarot' && s.showCorrespondences ? this.renderPickField({
					label: '宫廷星座体系',
					value: s.courtZodiacSystem || 'gd_span',
					onChange: (v) => this.changeSetting({ courtZodiacSystem: v }),
					options: [
						{ label: '跨段', value: 'gd_span' },
						{ label: '单座制', value: 'simple', note: '单座制:每宫廷守一座(后本位/王固定/骑变动),侍从不配星座。' },
					],
				}) : null}
				{caps.dignities && s.useDignities ? this.renderPickField({
					label: '尊位版本',
					value: s.edVersion || 'modern',
					onChange: (v) => this.changeSetting({ edVersion: v }),
					options: [
						{ label: '现行三档', value: 'modern' },
						{ label: '原典四档', value: 'mathers', note: '原典口径:火+土/风+水亦算「稍微支持」,不再有中立对。' },
					],
				}) : null}
				{caps.readingMethod === 'tarot' ? this.renderPickField({
					label: '牌义体系',
					value: s.meaningSystem || 'manual',
					onChange: (v) => this.changeSetting({ meaningSystem: v }),
					options: [
						{ label: '逐牌义', value: 'manual' },
						{ label: 'Waite 1911', value: 'waite' },
						{ label: '数字度', value: 'degrees', note: '马赛口径:小牌按十度周期×四中心推演(剑=智力·杯=情感·杖=创造·币=物质),宫廷四阶(侍→后→王→骑)。' },
					],
				}) : null}
				{caps.readingMethod === 'tarot' && caps.reversals !== false && s.useReversals ? (
					<div className="horosa-tarot-field">
						<label>逆位读法</label>
						<Select value={s.reversalMode || 'stored'} onChange={(v) => this.changeSetting({ reversalMode: v })} size="small" style={{ width: '100%' }} dropdownMatchSelectWidth={false} listHeight={360}>
							{REVERSAL_MODE_GROUPS.map((g) => (
								<OptGroup label={g.group} key={g.group}>
									{g.items.map((m) => (
										<Option value={m} key={m} title={(REVERSAL_TEMPLATES[m] && REVERSAL_TEMPLATES[m].note) || ''}>{m === 'stored' ? '预存逆位义' : (REVERSAL_TEMPLATES[m] && REVERSAL_TEMPLATES[m].label) || m}</Option>
									))}
								</OptGroup>
							))}
						</Select>
					</div>
				) : null}
				{caps.readingMethod === 'tarot' && caps.reversals !== false && s.useReversals ? this.renderPickField({
					label: '逆位产生',
					value: s.reversalGen || 'shuffle',
					onChange: (v) => this.changeSetting({ reversalGen: v }),
					options: [
						{ label: '洗牌', value: 'shuffle' },
						{ label: '三指定牌', value: 'fingers3', note: '古法:全副转正,占前定意逆转三张;它们若现身阵中,权重大增。' },
						{ label: '全逆', value: 'all', note: '全逆位阵:整局以「受阻/内在/待突破」视角解读。' },
					],
				}) : null}
				</div>
				{caps.variant && s.showCorrespondences && caps.readingMethod === 'tarot' ? (
					<div className="horosa-guazhan-toggle-grid horosa-tarot-toggle-grid" style={{ marginTop: 6, gridTemplateColumns: 'minmax(0, 1fr)' }}>
						<Checkbox checked={!!s.astroModern} onChange={(e) => this.changeSetting({ astroModern: e.target.checked })}>三元素大牌附现代行星注</Checkbox>
					</div>
				) : null}
				{caps.readingMethod === 'tarot' ? (
					// 孤芯片整行铺满(用户定案:半宽会把「火/风互换(少数派)」挤成两行,全宽反省空间)。
					<div className="horosa-guazhan-toggle-grid horosa-tarot-toggle-grid" style={{ marginTop: 6, gridTemplateColumns: 'minmax(0, 1fr)' }}>
						<Checkbox checked={!!s.suitElementSwap} onChange={(e) => this.changeSetting({ suitElementSwap: e.target.checked })}>火/风互换(少数派)</Checkbox>
					</div>
				) : null}
				{/* [QA-4] 判读口径里另有四项(定局法/精华牌口径/计时法与单位)贴着结果放在右栏,左栏给一行指路,
				    免得在此翻找不到而以为缺失。一行导航提示,非解释文字。 */}
				{caps.readingMethod !== 'lenormand' ? (
					<div className="horosa-tarot-deckinfo-row" style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>定局法 · 精华牌口径 · 计时法在右栏「定局」页内调。</div>
				) : null}
				</XQSideSection>
				{/* [TP9] 第三节「牌阵细则」:只在特定牌阵/牌组出现的项(交叉牌横置、开钥计数表、历史牌序),
				    与通用读法口径分开,避免长表淹没常用项。三项皆 caps 门控。
				    🔴 三项皆不适用时**整节不出现** —— 原先出一张「当前牌阵与牌组无专属细则可调」的空态卡,
				    那是纯噪音:占着左栏一格高度,却没有任何可操作项。判据与三项的显示条件同源,
				    不另写一份(否则新增第四项时必忘同步,空态卡会在有项可调时错误出现)。 */}
				{(spreadDetailShow.crossing || spreadDetailShow.ook || spreadDetailShow.dummett) ? (
				<XQSideSection iconName={sideSectionIcon('advanced')} title="牌阵细则" storageKey="tarot.spreadopt" className="horosa-side-input-section">
				{spreadDetailShow.crossing ? (
					<div className="horosa-guazhan-toggle-grid horosa-tarot-toggle-grid" style={{ marginTop: 6, gridTemplateColumns: 'minmax(0, 1fr)' }}>
						<Checkbox checked={s.crossingUpright !== false} onChange={(e) => this.changeSetting({ crossingUpright: e.target.checked })}>交叉牌横置(恒正读)</Checkbox>
					</div>
				) : null}
				{spreadDetailShow.ook ? (
					<div className="horosa-tarot-field">
						<label>开钥计数表</label>
						<XQSegmented value={s.ookTable || 'standard'} onChange={(e) => this.changeSetting({ ookTable: e.target.value })} options={[{ label: '通行', value: 'standard' }, { label: '质点', value: 'sephira' }]} />
						<div className="horosa-tarot-deckinfo-row" style={{ marginTop: 4, fontSize: 11 }}>{s.ookTable === 'sephira' ? '宫廷按生命树质点计数:王2·后3·骑6·侍9' : '数字=面值·Ace 5·宫廷 4(侍 7)·大牌 3/9/12(三母/行星/星座)'}</div>
					</div>
				) : null}
				{spreadDetailShow.dummett ? (
					<div className="horosa-tarot-field">
						<label>大牌顺序(Dummett 区域序)</label>
						<XQSegmented value={s.dummettOrder || 'C'} onChange={(e) => this.changeSetting({ dummettOrder: e.target.value })} options={[{ label: 'A 南', value: 'A' }, { label: 'B 东', value: 'B' }, { label: 'C 西', value: 'C' }]} />
						<div className="horosa-tarot-deckinfo-row" style={{ marginTop: 4, fontSize: 11 }}>{(DUMMETT_ORDERS[s.dummettOrder || 'C'] || {}).note || ''}</div>
					</div>
				) : null}

				</XQSideSection>
				) : null}
				{caps.significator ? (
					<XQSideSection iconName={sideSectionIcon('target')} title="指示牌" storageKey="tarot.sig" className="horosa-side-input-section">
					<>
						<div className="horosa-tarot-field">
							<label>选取方式</label>
							<Select value={s.sig.mode} onChange={(v) => this.changeSetting({ sig: { ...s.sig, mode: v } })} size="small" style={{ width: '100%' }}>
								<Option value="none">不使用</Option>
								<Option value="auto">自动(性别·年龄·星座)</Option>
								<Option value="manual">手动指定</Option>
								{caps.etteillaDual ? <Option value="etteilla">双指示牌(此制:男=牌一/女=牌八)</Option> : null}
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
						{s.sig.mode === 'etteilla' ? (
							<div className="horosa-tarot-field"><label>问者</label>
								<XQSegmented value={s.sig.gender} onChange={(e) => this.changeSetting({ sig: { ...s.sig, gender: e.target.value } })} options={[{ label: '男(牌一)', value: 'male' }, { label: '女(牌八)', value: 'female' }]} />
							</div>
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
						<thead><tr><th>位置</th><th>牌</th><th>正逆</th><th>含义</th></tr></thead>
						<tbody>{draws.map((d) => (
							<tr key={d.position.i}>
								<td>{d.position.i}. {d.position.label}</td>
								<td>{d.card ? `${this.cardLabel(d.card)}${d.card.symbol}` : '-'}</td>
								<td className={d.isReversed ? 'is-reversed' : ''}>{this.orientLabel(d)}</td>
								<td>{d.position.meaning}{d.position.slotElement && d.card ? `；${this.elements4Note(d)}` : ''}</td>
							</tr>
						))}</tbody>
					</table>
					)}</FreezeSubTab>
				</TabPane>
				<TabPane tab="牌义" key="meanings">
					<FreezeSubTab active={activeKey === 'meanings'}>{() => (
					<table className="horosa-tarot-table">
						<thead><tr><th>牌</th>{caps.reversals !== false ? <th>正逆</th> : null}{isTarot ? <th>对应</th> : null}{caps.dignities ? <th>尊位</th> : null}<th>关键义</th></tr></thead>
						<tbody>{draws.map((d) => {
							const showCorrM = isTarot && this.state.showCorrespondences;
							return (
								<tr key={d.position.i}>
									<td>{d.card ? <a onClick={() => this.setState({ detailCard: d.card })} title="牌详情">{`${isTarot ? displayNameCn(d.card, deck) : d.card.name_cn}${d.card.symbol}`}</a> : '-'}</td>
									{caps.reversals !== false ? <td className={d.isReversed ? 'is-reversed' : ''}>{this.orientLabel(d)}</td> : null}
									{isTarot ? <td className="horosa-tarot-td-corr">{d.card ? `${astroLine(d.card, deck, this.state.variant, this.state.astroModern, { elementSystem: this.state.courtElementSystem, zodiacSystem: this.state.courtZodiacSystem })}${showCorrM ? correspondenceSuffix(d.card, this.state.variant) : ''}` : '-'}</td> : null}
									{caps.dignities ? <td>{d.dignity ? d.dignity.strength : '—'}</td> : null}
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
	}

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
					<div className="horosa-tarot-line" style={{ fontSize: 11, opacity: 0.65 }}>同日同人同牌组恒此一张(确定性种子);跨日自然轮转。</div>
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
					) : <div className="horosa-tarot-line" style={{ opacity: 0.6, marginTop: 6 }}>尚无日志——每日记入一张,月余即可看出你的牌面气候。</div>}
					<div className="horosa-tarot-line" style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>日课仅存本机,不入案例、不入 AI 快照。</div>
				</div>
			</div>
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
				<div className="horosa-tarot-line" style={{ fontSize: 11, opacity: 0.6 }}>方位法则:左=承受/来处,右=行动/去向;升序相邻=实现之路。</div>
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
	}

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
					{this.state.quintMode === 'fool22' && !groups ? <div className="horosa-tarot-line" style={{ fontSize: 11, opacity: 0.6 }}>分组加法仅三张牌阵显示(总和/外显/左承受/右主动)。</div> : null}
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
					<div className="horosa-tarot-line" style={{ fontSize: 11, opacity: 0.6 }}>占验有效期以一年内为度;逾期之问不以时相许。</div>
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
								// [QA-6] 年龄/外貌/行旅取 courtSignDetect 备好的结果(与快照同源),不在此另行查表
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
					<Button size="small" onClick={() => this.setState({ clarifierShown: !this.state.clarifierShown })}>{this.state.clarifierShown ? '收起澄清牌' : '抽一张澄清牌'}</Button>
					{cl ? <div className="horosa-tarot-line" style={{ marginTop: 6 }}>{displayNameCn(cl, deck)}（{displayNameEn(cl, deck)}）— {cardMeaning(cl, false, this.state.meaningSystem, this.state.reversalMode)}</div> : null}
				</div>
			</div>
		);
	}

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
					{/* TP6 单卡详情面板:中栏点牌/牌义页点名打开;体系视角随左栏当前设置 */}
					<CardDetailDrawer
						card={this.state.detailCard}
						deck={this.currentDeck()}
						visible={!!this.state.detailCard}
						onClose={() => this.setState({ detailCard: null })}
						view={{ variant: this.state.variant, astroModern: this.state.astroModern, courtElementSystem: this.state.courtElementSystem, courtZodiacSystem: this.state.courtZodiacSystem }}
					/>
				</div>
			</TechniqueErrorBoundary>
		);
	}
}

export default TarotMain;
