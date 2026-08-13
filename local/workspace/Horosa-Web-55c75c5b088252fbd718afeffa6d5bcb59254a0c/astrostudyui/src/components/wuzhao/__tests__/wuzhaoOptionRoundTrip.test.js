/**
 * 五兆存案 round-trip 锁 —— 键集驱动的机械哨兵。
 *
 * 病灶原型(奇门三式事盘已踩):save 用键集全量写，restore 却是手写白名单，
 * 于是「新加的档位存得进、载不回」——jest 全绿、真机静默丢档。
 * 本测试(一)对着组件源码校验三处消费点(payload / save / restore)同源于 OPTION_KEYS；
 * (二)直接实例化组件类跑一遍真实 save→restore 往返，断言每键逐值保真。
 * 不用 DOM 渲染器:本仓无 enzyme / testing-library，且往返逻辑纯在实例方法里。
 */
import fs from 'fs';
import path from 'path';

let SAVED = null;

jest.mock('../../../utils/kentangCaseSave', () => ({
	openKentangCaseDrawer: jest.fn(),
	getKentangSavedCasePayload: jest.fn(),
}));

jest.mock('../../../utils/moduleAiSnapshot', () => ({
	saveModuleAISnapshotLazy: jest.fn(),
	saveModuleAISnapshot: jest.fn(),
}));

const caseSave = require('../../../utils/kentangCaseSave');
caseSave.openKentangCaseDrawer.mockImplementation((args) => {
	SAVED = { caseVersion: 'v1', payload: args.payload };
});
caseSave.getKentangSavedCasePayload.mockImplementation(() => SAVED);

const WuZhaoMain = require('../WuZhaoMain').default;

const SRC = fs.readFileSync(path.resolve(__dirname, '../WuZhaoMain.js'), 'utf8');

// 参与后端计算的档位(与后端 _extras / buildPanPayload 契约同源)
const EXPECT_CALC_KEYS = [
	'mode', 'number', 'manual', 'manualSplits', 'shifaVariant',
	'qianThrows', 'qianAuto', 'zhaoNums', 'xingshenMonth', 'mingZhi', 'gender',
];
// 纯显示态:只入存案不发请求
const EXPECT_VIEW_KEYS = ['beastView', 'centerView', 'leizhanTab', 'rightPanelTab'];

// 直接实例化组件类并接管 setState(不挂 DOM):往返逻辑全在实例方法内。
function makeInstance() {
	const inst = new WuZhaoMain({});
	inst.setState = function setState(patch, cb) {
		const next = typeof patch === 'function' ? patch(this.state) : patch;
		this.state = { ...this.state, ...next };
		if (cb) { cb(); }
	};
	return inst;
}

describe('五兆存案 round-trip 与键集单源', () => {
	beforeEach(() => { SAVED = null; });

	test('①OPTION_KEYS 键集完备(计算类/显示类各不遗漏)', () => {
		const m = SRC.match(/const OPTION_KEYS = \{([\s\S]*?)\n\};/);
		expect(m).toBeTruthy();
		const block = m[1];
		EXPECT_CALC_KEYS.forEach((key) => { expect(block).toContain(`'${key}'`); });
		EXPECT_VIEW_KEYS.forEach((key) => { expect(block).toContain(`'${key}'`); });
	});

	test('②三处消费点同源:payload / save / restore 皆走 pickOptions,无手写白名单', () => {
		// 判据绑「走键集」这件事本身,不绑具体写法(内联展开 vs 先取变量都算过)
		expect(SRC).toMatch(/buildPanPayload\(fields\)\{[\s\S]*?pickOptions\(this\.state, OPTION_KEYS\.calc\)/);
		expect(SRC).toMatch(/options: pickOptions\(this\.state, ALL_OPTION_KEYS\)/);
		const restoreBody = SRC.split('restoreFromCurrentCase(force){')[1].split('\n\tonFieldsChange(')[0];
		expect(restoreBody).toMatch(/pickOptions\(options, ALL_OPTION_KEYS\)/);
		// 🔴 不得再出现「逐键手抄」的还原写法(mode: options.mode || … 之属)
		expect(SRC).not.toMatch(/mode:\s*options\.mode/);
		expect(SRC).not.toMatch(/manualSplits:\s*options\.manualSplits/);
	});

	test('②b 还原时计算类键须过归一(脏存案的空串/非法值不得落进 state)', () => {
		const restoreBody = SRC.split('restoreFromCurrentCase(force){')[1].split('\n\tonFieldsChange(')[0];
		expect(restoreBody).toMatch(/normalizeCalcOptions/);
		const inst = makeInstance();
		SAVED = { caseVersion: 'dirty', payload: { pan: null, options: {
			mode: '', shifaVariant: 'bogus', xingshenMonth: '', mingZhi: '甲', gender: 'other',
			zhaoNums: 'x', qianThrows: [9, -3, 2, 2, 2, 2], number: 99,
			beastView: 'xingshen', leizhanTab: '卜财',
		} } };
		expect(inst.restoreFromCurrentCase(true)).toBe(true);
		expect(inst.state.mode).toBe('ganzhi');            // 空串归默认
		expect(inst.state.shifaVariant).toBe('guayi');     // 非法归默认
		expect(inst.state.xingshenMonth).toBe('lunar');
		expect(inst.state.mingZhi).toBe('');               // 非地支归空
		expect(inst.state.gender).toBe('');
		expect(inst.state.zhaoNums).toHaveLength(6);       // 非数组回落六数
		expect(inst.state.qianThrows).toEqual([4, 0, 2, 2, 2, 2]);  // 越界钳位
		expect(inst.state.number).toBe(9);                 // 上界钳位
		expect(inst.state.beastView).toBe('xingshen');     // 显示类原样回灌
		expect(inst.state.leizhanTab).toBe('卜财');
	});

	test('③真实往返:每个档位存进去→载回来逐值相等', () => {
		const inst = makeInstance();
		// 每个档位都改成「非默认值」,确保还原不是靠默认值蒙对
		const mutated = {
			mode: 'qian',
			number: 7,
			manual: true,
			manualSplits: [11, 12, 13, 14, 15, 16],
			shifaVariant: 'jiaolu',
			qianThrows: [1, 2, 3, 3, 3, 4],
			qianAuto: false,
			zhaoNums: [5, 4, 3, 2, 1, 5],
			xingshenMonth: 'jieqi',
			mingZhi: '亥',
			gender: 'female',
			beastView: 'xingshen',
			centerView: 'card',
			leizhanTab: '卜财',
			rightPanelTab: 'najia',
		};
		inst.setState({ ...mutated, pan: { sections: [], snapshot: 'x' } });
		inst.clickSaveCase();

		expect(SAVED).toBeTruthy();
		[...EXPECT_CALC_KEYS, ...EXPECT_VIEW_KEYS].forEach((key) => {
			expect(SAVED.payload.options).toHaveProperty(key);
			expect(SAVED.payload.options[key]).toEqual(mutated[key]);
		});

		// 清成另一套值后从存案还原,逐键须回到 mutated
		const inst2 = makeInstance();
		expect(inst2.restoreFromCurrentCase(true)).toBe(true);
		[...EXPECT_CALC_KEYS, ...EXPECT_VIEW_KEYS].forEach((key) => {
			expect(inst2.state[key]).toEqual(mutated[key]);
		});
	});

	test('④payload 只含计算类:显示类不得漏进请求体(免平白多一个缓存键维度)', () => {
		const inst = makeInstance();
		inst.setState({ beastView: 'xingshen', centerView: 'card', leizhanTab: '卜财' });
		const payload = inst.buildPanPayload({
			date: { value: { format: () => '2026-08-11' } },
			time: { value: { format: () => '10:30:00' } },
			zone: { value: '+08:00' },
		});
		expect(payload).toBeTruthy();
		EXPECT_CALC_KEYS.forEach((key) => { expect(payload).toHaveProperty(key); });
		EXPECT_VIEW_KEYS.forEach((key) => { expect(payload[key]).toBeUndefined(); });
	});

	test('⑤重取触发矩阵:计算类改动才重取,显示类改动一律不重取', () => {
		const inst = makeInstance();
		let fetched = 0;
		inst.fetchPan = () => { fetched += 1; };
		const bump = (patch) => {
			const prev = { ...inst.state };
			inst.state = { ...inst.state, ...patch };
			inst.componentDidUpdate({ fields: undefined }, prev);
		};
		// 显示类:零重取
		['beastView', 'centerView', 'leizhanTab', 'rightPanelTab'].forEach((key) => {
			const before = fetched;
			bump({ [key]: `${inst.state[key]}_x` });
			expect(fetched).toBe(before);
		});
		// 计算类:各触发一次
		[
			{ mode: 'dunhuang' },
			{ shifaVariant: 'jiaolu' },
			{ xingshenMonth: 'jieqi' },
			{ mingZhi: '亥' },
			{ gender: 'female' },
		].forEach((patch) => {
			const before = fetched;
			bump(patch);
			expect(fetched).toBe(before + 1);
		});
		// 条件类:掷钱定数仅在 qian 且非自动掷时参算
		inst.state = { ...inst.state, mode: 'zhushu' };
		let before = fetched;
		bump({ qianThrows: [1, 1, 1, 1, 1, 1] });
		expect(fetched).toBe(before);
		inst.state = { ...inst.state, mode: 'qian', qianAuto: true };
		before = fetched;
		bump({ qianThrows: [2, 2, 2, 2, 2, 2] });
		expect(fetched).toBe(before);
		inst.state = { ...inst.state, qianAuto: false };
		before = fetched;
		bump({ qianThrows: [3, 3, 3, 3, 3, 3] });
		expect(fetched).toBe(before + 1);
	});
});
