// TP0.2 哨兵:塔罗设置「保存↔载入」键集双向完备。
// 病灶原型:restoreFromCurrentCase 手写字段清单漏 meaningSystem/reversalMode/suitElementSwap →
// 存而不载,载入案例后静默回默认(奇门 round-trip bug 同类)。根治=SETTINGS_STATE_MAP 单源;本哨兵锁:
// ①settingsFromState 输出键集 === 映射表键集(双向) ②满档 roundtrip 逐键还原 ③旧档缺键回默认 ④null 不炸对象消费点。
import { SETTINGS_STATE_MAP, settingsFromState, statePatchFromSavedSettings } from '../engine/settingsMap';
import { resolveSettings } from '../engine/reading';
import { getDeck } from '../engine/deckRegistry';

// 一份「全部取非默认值」的 state(新增设置键必须同步补一行非默认样本,否则①会先咬)
const FULL_STATE = {
	useReversals: true, useDignities: true, variant: 'B', showCorrespondences: true,
	sig: { mode: 'manual', gender: 'female', age: 41, sign: 'Leo', manualId: 'cups_queen' },
	verdictMode: 'numeric', birth: { year: 1990, month: 6, day: 15, refYear: 2026 },
	question: '测试所问', artStyle: 'image',
	meaningSystem: 'waite', reversalMode: 'excess', suitElementSwap: true,
	dummettOrder: 'A', ookTable: 'sephira',
	reversalGen: 'fingers3', crossingUpright: false,
	quintMode: 'fool22', showBottomCard: true,
	edVersion: 'mathers', astroModern: true,
	timingMethod: 'ace_hunt', timingUnit: '月', majorsOverlay: true, showCutCard: true, includeBlank: true,
	courtElementSystem: 'alt', courtZodiacSystem: 'simple',
};

const DEFAULTS = {
	useReversals: false, useDignities: false, variant: 'A', showCorrespondences: false,
	sig: { mode: 'none' }, birth: { year: '', month: '', day: '', refYear: '' },
	verdictMode: 'majority', artStyle: 'symbol',
	meaningSystem: 'manual', reversalMode: 'stored', suitElementSwap: false,
	dummettOrder: 'C', ookTable: 'standard',
	reversalGen: 'shuffle', crossingUpright: true,
	quintMode: 'standard', showBottomCard: false,
	edVersion: 'modern', astroModern: false,
	timingMethod: 'suit_unit', timingUnit: '周', majorsOverlay: false, showCutCard: false, includeBlank: false,
	courtElementSystem: 'gd', courtZodiacSystem: 'gd_span',
};

describe('塔罗设置 roundtrip 键集哨兵', () => {
	test('映射表键集 == settingsFromState 输出键集(双向,无漏无冗)', () => {
		const mapSettingKeys = SETTINGS_STATE_MAP.map(([sk]) => sk).sort();
		const outKeys = Object.keys(settingsFromState(FULL_STATE)).sort();
		expect(outKeys).toEqual(mapSettingKeys);
		// state 键侧:FULL_STATE 必须覆盖映射表全部 state 键(样本齐,防哨兵空转)
		SETTINGS_STATE_MAP.forEach(([, stk]) => {
			expect(FULL_STATE[stk]).not.toBeUndefined();
		});
	});

	test('引擎消费面交叉锚:resolveSettings 产出的每个键都必须登记在映射表(引擎加键忘登映射=此处咬)', () => {
		const effKeys = Object.keys(resolveSettings(getDeck('rws'), {}));
		const mapSettingKeys = new Set(SETTINGS_STATE_MAP.map(([sk]) => sk));
		effKeys.forEach((k) => {
			expect(mapSettingKeys.has(k)).toBe(true);
		});
	});

	test('满档 roundtrip:存→载 逐键还原(question 除外,载入以 options.question 为准)', () => {
		const saved = settingsFromState(FULL_STATE);
		const patch = statePatchFromSavedSettings(saved, DEFAULTS);
		SETTINGS_STATE_MAP.forEach(([sk, stk]) => {
			if(sk === 'question'){ return; }
			expect(patch[stk]).toEqual(FULL_STATE[stk]);
		});
		// 非默认值确实穿透(抽查曾经丢失的三键 + 新增两键)
		expect(patch.meaningSystem).toBe('waite');
		expect(patch.reversalMode).toBe('excess');
		expect(patch.suitElementSwap).toBe(true);
		expect(patch.dummettOrder).toBe('A');
		expect(patch.ookTable).toBe('sephira');
	});

	test('旧档兼容:缺新键的 settings 回落默认,无 undefined 泄漏', () => {
		const legacy = { reversals: true, variant: 'C', sig: { mode: 'auto', gender: 'male', age: 30, sign: 'Aries' } };
		const patch = statePatchFromSavedSettings(legacy, DEFAULTS);
		expect(patch.useReversals).toBe(true);
		expect(patch.variant).toBe('C');
		expect(patch.meaningSystem).toBe('manual');
		expect(patch.reversalMode).toBe('stored');
		expect(patch.ookTable).toBe('standard');
		SETTINGS_STATE_MAP.forEach(([sk, stk]) => {
			if(sk === 'question'){ return; }
			expect(patch[stk]).not.toBeUndefined();
		});
	});

	test('null 档硬化:sig/birth 为 null 时回默认对象(下游 .mode/.year 不炸)', () => {
		const patch = statePatchFromSavedSettings({ sig: null, birth: null }, DEFAULTS);
		expect(patch.sig && patch.sig.mode).toBe('none');
		expect(patch.birth && patch.birth.year).toBe('');
	});
});
