// 塔罗页 · 种子与排盘设置:出生信息种子、种子来源解析、牌组吸附缺省、跨会话保留的排盘设置与读回
// 从 TarotMain.js 按职责拆出(门面保留原导入路径与对外导出;读源码的检查读「子模块 + 门面」全集,见 scripts/source-sets.json)。
import { getDeck, DEFAULT_DECK, listDeckIds, hasDeck } from '../engine/deckRegistry';
import { definePageSettings } from '../../../utils/pageSettingsStore';
import { DEFAULT_SPREAD, SPREADS } from '../engine/spreads';
import { REVERSAL_MODE_GROUPS } from '../engine/reversalModes';
import { YESNO_MODES } from '../engine/verdict';
import { TIMING_METHODS } from '../engine/timingMethods';
import { newTarotRandomSeed } from '../engine/shuffle';

// 出生信息 → 确定性种子串
export function seedFromFields(fields){
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
// spreadType 只在随机档用:决定这次要取多长的真随机记录(开钥牌阵五次整副重洗,取长的)。
export function resolveSeed(seedMode, manualSeed, fields, spreadType){
	// 手动种子原样用(不去首尾空格:出生信息串里名字可能以空格开头,去了就复现不出同一副牌);空 / 纯空白回落 0。
	if(seedMode === 'manual'){ return `${manualSeed === undefined || manualSeed === null || `${manualSeed}`.trim() === '' ? 0 : `${manualSeed}`}`; }
	// 随机 = 真随机:当场向系统随机源取一段原始字节作「真随机记录」,牌序与正逆直接读它(见 engine/shuffle.js)
	if(seedMode === 'random'){ return newTarotRandomSeed(spreadType); }
	return seedFromFields(fields);
}

// deck 默认设置(切流派吸附)
export function deckDefaults(deckId){
	const d = getDeck(deckId);
	return {
		reversals: !!d.usesReversals, dignities: !!d.dignities, variant: d.variant || 'A',
		showCorrespondences: (d.variant === 'B' || d.dignities),
		meaningSystem: d.meaningDefault || 'manual', // TP2 马赛系(tdm/wirth/egyptian/visconti)默认吸附「数字度」
	};
}

// 排盘设置跨会话保留(用户实报:排盘设置改了之后每次重开软件都要重设)。只收口径与显示偏好:
// 牌组 / 牌阵 / 牌面样式 / 种子来源 / 盘面开关 / 读法体系各项 / 定局法 / 精华牌口径 / 计时法。
// 所问、手动种子、指示牌(随问卜人的性别年龄星座)、生日牌的生日是每一局的输入,不进。
// 逆位 / 元素尊位 / 字母路径变体 / 显示进阶对应 / 牌义体系五项**随牌组吸附**:换牌组时连同吸附后的值一起落盘,
// 读回时以「该牌组缺省」垫底、保存值盖上 —— 所以库里的五项永远与库里的牌组自洽。
// 事盘回灌(restoreFromCurrentCase)按存档所记读回种子来源、「复现」按钮把种子来源改成手动,都走 setState,不经这里。
export const TAROT_PAGE_SETTINGS = definePageSettings('horosa.tarot.settings.v1', {
	deckId: { def: DEFAULT_DECK, oneOf: listDeckIds() },
	spreadType: { def: DEFAULT_SPREAD, oneOf: Object.keys(SPREADS) },
	artStyle: { label: '牌面样式', def: 'image', oneOf: ['image', 'symbol'] },
	// 「手动种子」离不开逐局输入(种子数,不保留):只留法不留数,重开后种子是 0,而本页一打开就自动抽一次 ——
	// 每次重开都是同一副「种子 0」的牌。所以手动不进候选(选了照常用,只是不记;库里仍是上一次选的「生辰 / 随机」)。
	seedMode: { def: 'random', oneOf: ['birth', 'random'] },   // 默认随机(真随机抽牌);「出生信息」是可复现的确定性起法,要用自己选
	useReversals: { label: '逆位', def: true },
	useDignities: { label: '元素尊位', def: false },
	variant: { def: 'A', oneOf: ['A', 'B', 'C'] },
	showCorrespondences: { label: '显示进阶对应', def: false },
	meaningSystem: { def: 'manual', oneOf: ['manual', 'waite', 'degrees'] },
	showBottomCard: { label: '牌底牌(基调)', def: false },
	showCutCard: { label: '切牌(心态)', def: false },
	majorsOverlay: { label: '大牌加盖', def: false },
	includeBlank: { label: '空白牌(79张)', def: false },
	courtElementSystem: { def: 'gd', oneOf: ['gd', 'alt'] },
	courtZodiacSystem: { def: 'gd_span', oneOf: ['gd_span', 'simple'] },
	edVersion: { def: 'modern', oneOf: ['modern', 'mathers'] },
	reversalMode: { def: 'stored', oneOf: REVERSAL_MODE_GROUPS.reduce((acc, g)=>acc.concat(g.items), []) },
	reversalGen: { label: '逆位产生', def: 'shuffle', oneOf: ['shuffle', 'fingers3', 'all'] },
	astroModern: { def: false },
	suitElementSwap: { def: false },
	crossingUpright: { def: true },
	ookTable: { def: 'standard', oneOf: ['standard', 'sephira'] },
	dummettOrder: { label: '大牌顺序(Dummett 区域序)', def: 'C', oneOf: ['A', 'B', 'C'] },
	verdictMode: { def: 'majority', oneOf: YESNO_MODES },
	quintMode: { def: 'standard', oneOf: ['standard', 'fool22'] },
	timingMethod: { def: 'suit_unit', oneOf: TIMING_METHODS },
	timingUnit: { def: '周', oneOf: ['天', '周', '月'] },
}, {
	// 随牌组吸附的五项没单独存过时,实际按「库里那副牌组」的缺省取(与 savedTarotState 读回同一条):描述设置时报这个现值缺省
	effectiveDefaults: (sv)=>{
		const dd = deckDefaults(sv && sv.deckId && hasDeck(sv.deckId) ? sv.deckId : DEFAULT_DECK);
		return { useReversals: dd.reversals, useDignities: dd.dignities, variant: dd.variant, showCorrespondences: dd.showCorrespondences, meaningSystem: dd.meaningSystem };
	},
});
// 读回:牌组不认识 → 缺省牌组;牌阵不在该牌组允许表里 → 与换牌组同一条回落;随牌组吸附的五项以该牌组缺省垫底。
// 什么都没存过时返回的就是原来的出厂值(缺省牌组 + 缺省牌阵 + 牌组缺省),零回归。
export function savedTarotState(){
	const sv = TAROT_PAGE_SETTINGS.loadSaved();
	const deckId = sv.deckId && hasDeck(sv.deckId) ? sv.deckId : DEFAULT_DECK;
	const dd = deckDefaults(deckId);
	const deck = getDeck(deckId);
	const allowed = (deck && deck.caps && deck.caps.spreads) || Object.keys(SPREADS);
	let spreadType = sv.spreadType || DEFAULT_SPREAD;
	if(sv.spreadType && allowed.indexOf(spreadType) < 0){ spreadType = allowed[0] || DEFAULT_SPREAD; }   // 没单独存过牌组时也要查(缺省牌组同样有允许表):否则下拉显示允许表第一项、实际却按存下的那个牌阵抽
	const out = { ...sv, deckId, spreadType };
	const snap = { useReversals: dd.reversals, useDignities: dd.dignities, variant: dd.variant, showCorrespondences: dd.showCorrespondences, meaningSystem: dd.meaningSystem };
	Object.keys(snap).forEach((k)=>{ if(out[k] === undefined){ out[k] = snap[k]; } });
	return out;
}
