// 【第4步】四本账同步哨兵:AI 导出段 / AI 导出设置(挂载齿轮) / AI 分析挂载(liftKeys) / 命盘事盘储存(存案 round-trip)。
// 这四处各存一份「塔罗有哪些键、有哪些段」的账;任何一处漂移都会让用户「设置改了但导出/挂载/载入没跟上」。
// 本文件把四本账机械对拍到同一批单一真值源上,漂一处即咬。
import fs from 'fs';
import path from 'path';
import { SETTINGS_STATE_MAP, settingsFromState, statePatchFromSavedSettings } from '../engine/settingsMap';
import { buildReading } from '../engine/reading';
import { buildReadingText } from '../engine/reportText';
import { AI_EXPORT_PRESET_SECTIONS } from '../../../utils/aiExport';
import { TECHNIQUE_SETTINGS_SCHEMA } from '../../../utils/techniqueMountSettings';
import { OPTION_SPEC } from './tarotOptionSpec';

const SRC = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

// 牌面决定类的键(改牌面本身)不入判读齿轮:齿轮只动判读层,牌由 deckId/spreadType/seed 冻结。
// 齿轮定义:{kind, optionsPath, group, fields:[{name,label,type,default,group,options}]}
const gearFields = () => ((TECHNIQUE_SETTINGS_SCHEMA.tarot || {}).fields || []);

const BOARD_KEYS = ['reversals', 'reversalGen', 'includeBlank', 'majorsOverlay', 'showCutCard', 'showBottomCard',
	'sig', 'birth', 'question', 'artStyle', 'showCorrespondences', 'dummettOrder'];

describe('四本账 · 存案 round-trip(命盘/事盘储存)', () => {
	test('存案写入的键集 ≡ SETTINGS_STATE_MAP;载入回灌逐键还原(存而不载的镜像判据)', () => {
		const state = {
			useReversals: false, useDignities: true, variant: 'B', showCorrespondences: true,
			sig: { mode: 'manual', manualId: 'cups_queen' }, verdictMode: 'anchor',
			birth: { year: 1990, month: 6, day: 15, refYear: 2026 }, question: '这段关系',
			artStyle: 'image', meaningSystem: 'degrees', reversalMode: 'retreat', suitElementSwap: true,
			dummettOrder: 'B', ookTable: 'sephira', reversalGen: 'fingers3', crossingUpright: false,
			quintMode: 'fool22', showBottomCard: true, edVersion: 'mathers', astroModern: true,
			timingMethod: 'ace_hunt', timingUnit: '天', majorsOverlay: true, showCutCard: true, includeBlank: true,
			courtElementSystem: 'alt', courtZodiacSystem: 'simple',
			// 视图态:不该被存案带走
			rightPanelTab: 'verdict', detailCard: { sid: 'the_fool' }, reading: { x: 1 }, lastSeed: 'abc',
		};
		const saved = settingsFromState(state);
		expect(Object.keys(saved).sort().join(',')).toBe(SETTINGS_STATE_MAP.map(([sk]) => sk).sort().join(','));
		// 视图态绝不入存案(否则展开态会随存案跨会话传染,且污染挂载/导出)
		['rightPanelTab', 'detailCard', 'reading', 'lastSeed'].forEach((k) => {
			expect(`${k} 入存案:${Object.prototype.hasOwnProperty.call(saved, k)}`).toBe(`${k} 入存案:false`);
		});
		// 回灌:逐键还原为原 state 值
		const patch = statePatchFromSavedSettings(saved, {});
		SETTINGS_STATE_MAP.forEach(([sk, stk]) => {
			if(sk === 'question'){ return; } // 所问单独走 payload.options.question
			expect(`${sk}:${JSON.stringify(patch[stk])}`).toBe(`${sk}:${JSON.stringify(state[stk])}`);
		});
	});
	test('组件的存案入口确实走 settingsFromState 单源(不得再手写键清单)', () => {
		const src = read('components/tarot/TarotMain.js');
		expect(src).toContain('settings: settingsFromState(this.state)');
		expect(src).toContain('statePatchFromSavedSettings(');
		// 存案 options 里不得夹带视图态
		const m = src.match(/payload:\s*\{[\s\S]{0,600}?snapshot:/);
		expect(`存案段落存在:${!!m}`).toBe('存案段落存在:true');
		expect(/rightPanelTab|detailCard|sideExpanded/.test(m[0])).toBe(false);
	});
});

describe('四本账 · AI 分析挂载(liftKeys)', () => {
	const ctxSrc = read('utils/aiAnalysisContext.js');
	const liftBlock = ctxSrc.slice(ctxSrc.indexOf("case 'tarot': {"), ctxSrc.indexOf("case 'lingqi': {"));
	const liftKeys = (liftBlock.match(/const liftKeys = \[([\s\S]*?)\];/) || [])[1] || '';
	const keys = liftKeys.split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
	test('挂载提升键 ⊆ SETTINGS_STATE_MAP(不得凭空提一个引擎不认的键)', () => {
		const known = new Set(SETTINGS_STATE_MAP.map(([sk]) => sk));
		keys.forEach((k) => expect(`${k} 在设置单源内:${known.has(k)}`).toBe(`${k} 在设置单源内:true`));
	});
	test('挂载提升键 ≡ 挂载齿轮字段(齿轮能调的,挂载必须提得动)', () => {
		const gears = gearFields().map((f) => f.name).sort();
		expect(keys.slice().sort().join(',')).toBe(gears.join(','));
	});
	test('牌面决定类的键一律不入齿轮与挂载(牌由 deckId/spreadType/seed 冻结)', () => {
		const gears = new Set(gearFields().map((f) => f.name));
		BOARD_KEYS.forEach((k) => {
			expect(`${k} 入齿轮:${gears.has(k)}`).toBe(`${k} 入齿轮:false`);
			expect(`${k} 入挂载:${keys.indexOf(k) >= 0}`).toBe(`${k} 入挂载:false`);
		});
	});
	test('布尔归一名单覆盖所有布尔型齿轮(三态 1/0 值不归一会当真值穿透)', () => {
		const boolLine = (liftBlock.match(/const boolKeys = \[([\s\S]*?)\];/) || [])[1] || '';
		const boolKeys = boolLine.split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
		// 布尔型齿轮 = 选项恰为「随档/开(1)/关(0)」的 select(项目里布尔项一律做成三态 select,免默认覆档)
		const gearBool = gearFields().filter((f) => (f.options || []).some((o) => o.value === 1) && (f.options || []).some((o) => o.value === 0)).map((f) => f.name).sort();
		expect(boolKeys.slice().sort().join(',')).toBe(gearBool.join(','));
	});
});

// 覆盖各类段的配置集(导出段清单双向哨兵共用)
const CONFIGS = [
	['rws', 'celtic', { reversals: true, dignities: true, showCorrespondences: true, showCutCard: true, showBottomCard: true, majorsOverlay: true, birth: { year: 1990, month: 6, day: 15, refYear: 2026 } }],
	['golden_dawn', 'opening_of_key', { sig: { mode: 'manual', manualId: 'wands_king' } }],
	['lenormand', 'grand_tableau', {}],
	['tdm', 'three', { meaningSystem: 'degrees' }],
	['visconti', 'three', {}],
	['cartomancy', 'three', {}],
];

describe('四本账 · AI 导出段清单', () => {
	test('preset 登记的每一段都真能在快照里出现(全开配置下逐段命中)', () => {
		const preset = AI_EXPORT_PRESET_SECTIONS.tarot || [];
		expect(preset.length).toBeGreaterThan(0);
		// 各段分属不同牌组/牌阵(开钥只在开钥阵、组合读法只在雷诺曼系),故取多配置并集
		const seen = new Set();
		CONFIGS.forEach(([d, s2, st]) => {
			const t = buildReadingText(buildReading(d, s2, `ledger-${d}-${s2}`, st), '这段关系的走向');
			(t.match(/^\[[^\]]+\]$/gm) || []).forEach((h) => seen.add(h.slice(1, -1)));
		});
		const missing = preset.filter((sec) => !seen.has(sec));
		expect(`preset 中快照未出现的段: ${missing.join(',')}`).toBe('preset 中快照未出现的段: ');
	});
	test('快照里出现的每个段头都已登记进 preset(新增段忘登记即咬)', () => {
		const preset = new Set(AI_EXPORT_PRESET_SECTIONS.tarot || []);
		const seen = new Set();
		// 多配置合并取并集:不同牌组/牌阵会开出不同的段(开钥/雷诺曼组合读法/对读/日课)
		CONFIGS.forEach(([d, s2, st]) => {
			const t = buildReadingText(buildReading(d, s2, `ledger-${d}-${s2}`, st), '问');
			(t.match(/^\[[^\]]+\]$/gm) || []).forEach((h) => seen.add(h.slice(1, -1)));
		});
		const unregistered = [...seen].filter((h) => !preset.has(h));
		expect(`快照有而 preset 未登记的段: ${unregistered.join(',')}`).toBe('快照有而 preset 未登记的段: ');
	});
});

describe('四本账 · 全链一致性(改一个判读键,四处同步变)', () => {
	test('任一判读齿轮键改档 → 快照文本必变(齿轮空转即咬)', () => {
		// 对照档与前置上下文一律取自第0步的规格对照表(OPTION_SPEC),不在此另写一份 ——
		// 有些键本就依赖前置(计时单位只在大牌数字法下生效、开钥计数表只在开钥阵),
		// 缺前置就会把「上下文没给够」误报成「齿轮空转」。
		const dead = [];
		const missing = [];
		gearFields().forEach((g) => {
			const spec = OPTION_SPEC.find((x) => x.key === g.name);
			if(!spec){ missing.push(g.name); return; }
			const { deckId, spreadType, ...pre } = spec.ctx;
			let changed = false;
			for(let i = 0; i < 60 && !changed; i++){
				const seed = `ledger-${g.name}-${i}`;
				const a = buildReadingText(buildReading(deckId, spreadType, seed, { ...pre, [g.name]: spec.values[0] }));
				const b = buildReadingText(buildReading(deckId, spreadType, seed, { ...pre, [g.name]: spec.values[spec.values.length - 1] }));
				changed = a !== b;
			}
			if(!changed){ dead.push(g.name); }
		});
		expect(`齿轮未登记进规格表: ${missing.join(',')}`).toBe('齿轮未登记进规格表: ');
		expect(`空转齿轮: ${dead.join(',')}`).toBe('空转齿轮: ');
	});
});
