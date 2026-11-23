// 塔罗页 · 牌局设置改值、抽牌与复现、事盘回灌、存案、AI 快照刷新
// 从 TarotMain.js 按职责拆出的 TarotMain 方法:this 仍是 TarotMain 实例,门面里 mixinMethods(TarotMain, …) 原样挂回原型(与写在类里等价)。
// 读源码的检查读「子模块 + 门面」全集(scripts/source-sets.json)。
import { message } from 'antd';
import { timePatchFromDateTime, geoPatchFromRec } from '../../../utils/divinationTimeDraft';
import { saveModuleAISnapshotLazy, saveModuleAISnapshot } from '../../../utils/moduleAiSnapshot';
import { openKentangCaseDrawer, getKentangSavedCasePayload } from '../../../utils/kentangCaseSave';
import { buildReading } from '../engine/reading';
import { getDeck, DEFAULT_DECK } from '../engine/deckRegistry';
import { displayNameCn } from '../engine/cardSchema';
import { SPREADS, DEFAULT_SPREAD, orientationLabel } from '../engine/spreads';
import { buildReadingText } from '../engine/reportText';
import { isFriend, isEnemy } from '../decks/correspondences';
import { cardElement } from '../engine/cardSchema';
import { settingsFromState, statePatchFromSavedSettings } from '../engine/settingsMap';
import { resolveSeed, deckDefaults, TAROT_PAGE_SETTINGS } from './settings';
import { seedDisplayText } from '../../../utils/trueRandom';
import { markPanelReady } from '../../../utils/perfMark';

export const caseStateMethods = {
	handleSnapshotRefreshRequest(evt){
		const moduleName = evt && evt.detail ? evt.detail.module : '';
		if(moduleName !== 'tarot'){ return; }
		const reading = this.state ? this.state.reading : null;
		if(!reading){ return; }
		let text = '';
		try{ text = `${buildReadingText(reading, this.state.question, { clarifier: !!this.state.clarifierShown }) || ''}`.trim(); }catch(e){ text = ''; }
		if(text){
			saveModuleAISnapshot('tarot', text);
			if(evt && evt.detail && typeof evt.detail === 'object'){ evt.detail.snapshotText = text; }
		}
	},

	// 单一重算路径:据当前 state(+ 给定 seed)算 reading,setState + 快照。所有变更入口都走它,杜绝漂移。
	applyRecompute(seedOverride){
		const seed = seedOverride !== undefined ? seedOverride : this.state.lastSeed;
		if(seed === undefined || seed === null || seed === ''){ return; }
		const reading = buildReading(this.state.deckId, this.state.spreadType, `${seed}`, settingsFromState(this.state));
		this.setState({ reading, lastSeed: `${seed}` }, () => {
			// horosa_panel_ready_v1:reading 落定 = 牌阵(中栏)与释义(右栏)画完的那一次 setState。
			// v3.9.3 塔罗升「卜」一级导航 ⇒ 归属键随迁 'cnyibu' → 'tarot'(#75 归属键契约:
			// 键错配会把塔罗的交互记到聚合页名下,P5 观测门按 navigationPages 键索引也会漏)。
			markPanelReady('tarot');
			saveModuleAISnapshotLazy('tarot', () => buildReadingText(this.state.reading, this.state.question, { clarifier: !!this.state.clarifierShown }));
		});
	},

	// 定局法切换:牌(seed 所出)冻结不重抽,仅按新 mode 重建 reading.settings 并重存快照
	// (旧版只 setState → UI 活算新 mode、快照仍旧 mode,两处 Yes/No 可相互矛盾)。
	changeVerdictMode(mode){
		TAROT_PAGE_SETTINGS.save({ verdictMode: mode });
		this.setState({ verdictMode: mode }, () => {
			const seed = this.state.lastSeed;
			if(seed !== undefined && seed !== null && seed !== ''){ this.applyRecompute(); return; }
			const r = this.state.reading;
			if(r && r.settings){
				const reading = { ...r, settings: { ...r.settings, verdictMode: mode } };
				this.setState({ reading }, () => {
					saveModuleAISnapshotLazy('tarot', () => buildReadingText(this.state.reading, this.state.question, { clarifier: !!this.state.clarifierShown }));
				});
			}
		});
	},

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
			verdictMode: 'majority', artStyle: 'image',
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
			// 盘面按存档种子原样复现(下面 applyRecompute);种子来源按存档里记下的你当时的来源档 ——
			// 与灵棋同:只有当时确是手动种子才切到手动并填入,否则「再抽」照你的来源抽新的一副。
			// 旧档存的一律是 manual + 种子,照旧(无从知道当时的来源)
			seedMode: options.seedMode || this.state.seedMode,
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
	},

	changeDeck(deckId){
		const dd = deckDefaults(deckId);
		const deck = getDeck(deckId);
		// 牌阵:若当前牌阵不在新牌组允许列表 → 回落该牌组首个允许牌阵
		const allowed = (deck.caps && deck.caps.spreads) || Object.keys(SPREADS);
		const spreadType = allowed.indexOf(this.state.spreadType) >= 0 ? this.state.spreadType : (allowed[0] || DEFAULT_SPREAD);
		const patch = { deckId, spreadType, useReversals: dd.reversals, useDignities: dd.dignities, variant: dd.variant, showCorrespondences: dd.showCorrespondences, meaningSystem: dd.meaningSystem };
		// 换牌组连同吸附后的五项一起落盘。牌阵不跟着落:这里的 spreadType 取自当前 state,可能是刚载入的事盘带来的,
		// 不是你亲手选的;库里那份牌阵若不在新牌组的允许表里,读回时自有同一条回落(savedTarotState)。
		const { spreadType: _omitSpread, ...persistPatch } = patch;
		TAROT_PAGE_SETTINGS.save(persistPatch);
		this.setState(patch, () => this.applyRecompute());
	},

	changeSpread(spreadType){ TAROT_PAGE_SETTINGS.save({ spreadType }); this.setState({ spreadType }, () => this.applyRecompute()); },

	// 通用设置入口:落盘只收 schema 里的键 —— 指示牌 / 生日这类输入也走这里,但不在 schema 里,自动被忽略。
	changeSetting(patch){ TAROT_PAGE_SETTINGS.save(patch); this.setState(patch, () => this.applyRecompute()); },

	drawCards(){
		const seed = resolveSeed(this.state.seedMode, this.state.manualSeed, this.activeFields(), this.state.spreadType);
		this.applyRecompute(seed);
	},

	clickReproduce(){
		if(!this.state.lastSeed){ return; }
		this.setState({ seedMode: 'manual', manualSeed: this.state.lastSeed });
		message.success(`已锁定种子「${seedDisplayText(this.state.lastSeed)}」,再次抽牌可复现此牌阵`);
	},

	// 快捷栏契约:抽牌=主键豁免;锁定复现等左栏已有控件不进栏;cnyibu 容器透传渲染。
	getQuickDockConfig(){
		return {
			hasResult: !!this.state.reading,
			primary: { key: 'draw', label: '抽牌', onClick: ()=>this.drawCards() },
			save: ()=>this.clickSaveCase(),
		};
	},

	// 当前生效 fields:本地草稿优先,否则主命盘 fields。
	activeFields(){
		return this.state.localFields || this.props.fields || {};
	},

	// [自由起盘] 左栏时间选择 → 写本地草稿。「出生信息」种子模式按此时刻算种子(可复现)。
	onTimeChanged(value){
		const dt = value && value.time;
		if(!dt){ return; }
		const base = this.state.localFields || this.props.fields || {};
		this.setState({ localFields: { ...base, ...timePatchFromDateTime(dt) } }, ()=>{ if(this.state.seedMode === 'birth'){ this.drawCards(); } });
	},

	// [自由起盘] 左栏经纬度选择 → 写本地草稿(经纬 + 时区 + 地名)。生辰种子含经纬熵;亦入事盘。
	changeGeo(rec){
		const base = this.state.localFields || this.props.fields || {};
		this.setState({ localFields: { ...base, ...geoPatchFromRec(rec, base) } }, ()=>{ if(this.state.seedMode === 'birth'){ this.drawCards(); } });
	},

	clickSaveCase(){
		if(!this.state.reading){ message.info('请先抽牌'); return; }
		openKentangCaseDrawer({
			dispatch: this.props.dispatch, fields: this.activeFields(), module: 'tarot', label: '塔罗',
			payload: {
				options: {
					deckId: this.state.deckId, spreadType: this.state.spreadType,
					// 记你当时的种子来源;复现靠 seed(载入按它原样重排这一副)
					seedMode: this.state.seedMode, seed: this.state.lastSeed, question: this.state.question,
					settings: settingsFromState(this.state),
				},
				reading: this.state.reading,
				snapshot: buildReadingText(this.state.reading, this.state.question, { clarifier: !!this.state.clarifierShown }),
			},
		});
	},

	setRightPanelTab(key){ this.setState({ rightPanelTab: key }); },

	currentDeck(){ return getDeck(this.state.deckId); },

	caps(){ const d = this.currentDeck(); return (d && d.caps) || {}; },

	// 朝向标签三态:横置(凯尔特交叉牌恒正读)/正位/逆位。
	orientLabel(d){ return d && d.crossed ? '横置' : orientationLabel(d && d.isReversed); },

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
	},

	// 统一牌名:塔罗体系按 deck 出各派名;异构牌组(雷诺曼/扑克/Kipper)用其自有 name_cn(否则 displayNameCn 会出 undefined)。
	cardLabel(card){ if(!card){ return '-'; } return this.caps().readingMethod === 'tarot' ? displayNameCn(card, this.currentDeck()) : card.name_cn; },
};
