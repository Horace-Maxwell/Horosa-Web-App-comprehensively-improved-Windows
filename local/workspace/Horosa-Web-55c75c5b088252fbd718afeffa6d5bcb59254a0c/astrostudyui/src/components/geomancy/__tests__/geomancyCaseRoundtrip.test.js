// 地占 · 四本账之「命盘/事盘储存管理」往返:存进去什么,载回来必须还是什么。
// 🔴 本模块栽过一次:granular/turnTo 只活在内存,存盘不带、载回即丢 → 复算出的是流派默认盘。
//    故此处逐键往返,新增可判读选项都要进这张清单。
jest.mock('../../../utils/kentangCaseSave', () => ({
	openKentangCaseDrawer: jest.fn((arg) => { global.__savedCase = arg; }),
	getKentangSavedCasePayload: jest.fn(() => global.__mockCase || null),
}));
jest.mock('../../../utils/moduleAiSnapshot', () => ({
	saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn(),
}));

import GeomancyMain from '../GeomancyMain';
import { openKentangCaseDrawer } from '../../../utils/kentangCaseSave';
import LIVE from './fixtures/geomancyLiveResults.json';

const PROPS = { hideQuickDock: true, height: 760, dispatch: () => {}, fields: {} };

// 一组**全非默认**的可判读选项:任何一项漏存漏载,往返即失败
const RICH = {
	question: '此事可成否',
	questionType: 'career',
	quesitedHouse: 10,
	tradition: 'arabic_raml',
	readingScope: 'L4',
	zodiacSystem: 'planetary',
	turnTo: 4,
	granular: {
		direction: 'RTL', markStyle: 'bindu', parityScope: 'mothers',
		houseProjection: 'astro_bytwelves', wrapHouses: true, reconciler: false,
		reconcilerMode: 'judge_querent_significator', haltEnabled: false,
		compoundMode: 'reverse', numberSystem: 'abjad', ascSource: 'fresh_points',
		houseSystem: 'quadrant', namesSystem: 'greek',
	},
};

const mk = (extra) => {
	const i = new GeomancyMain(PROPS);
	i.props = PROPS;
	i.state = { ...i.state, result: LIVE.european_classical, loading: false, ...(extra || {}) };
	i.setState = (patch, cb) => { i.state = { ...i.state, ...(typeof patch === 'function' ? patch(i.state) : patch) }; if (cb) cb(); };
	return i;
};

describe('地占 · 事盘存档往返', () => {
	beforeEach(() => { global.__savedCase = null; global.__mockCase = null; openKentangCaseDrawer.mockClear(); });

	test('存档 payload 带齐全部可判读选项', () => {
		mk(RICH).clickSaveCase();
		const opt = (global.__savedCase || {}).payload.options;
		expect(opt.question).toBe(RICH.question);
		expect(opt.questionType).toBe('career');
		expect(opt.quesitedHouse).toBe(10);
		expect(opt.tradition).toBe('arabic_raml');
		expect(opt.readingScope).toBe('L4');
		expect(opt.zodiacSystem).toBe('planetary');
		expect(opt.turnTo).toBe(4);
		expect(opt.granular).toEqual(RICH.granular);
	});

	test('载回后逐键还原(漏一键即复算出另一副盘)', () => {
		mk(RICH).clickSaveCase();
		global.__mockCase = { caseVersion: 'v-test-1', payload: (global.__savedCase || {}).payload };
		const fresh = mk({});
		expect(fresh.restoreFromCurrentCase(true)).toBe(true);
		const s = fresh.state;
		expect(s.question).toBe(RICH.question);
		expect(s.questionType).toBe('career');
		expect(Number(s.quesitedHouse)).toBe(10);
		expect(s.tradition).toBe('arabic_raml');
		expect(s.readingScope).toBe('L4');
		expect(s.zodiacSystem).toBe('planetary');
		expect(s.turnTo).toBe(4);
		expect(s.granular).toEqual(RICH.granular);
	});

	test('旧存档(无新键)载回不炸,缺键各自回落而非写入 undefined', () => {
		global.__mockCase = { caseVersion: 'v-old', payload: { options: {
			question: '旧盘', questionType: 'marriage', seedMode: 'manual', seed: 42,
			tradition: 'european_classical', readingScope: 'L3', zodiacSystem: 'classical',
		}, result: LIVE.european_classical } };
		const fresh = mk({});
		expect(() => fresh.restoreFromCurrentCase(true)).not.toThrow();
		expect(fresh.state.questionType).toBe('marriage');
		expect(fresh.state.quesitedHouse).not.toBeUndefined();
		expect(fresh.state.granular).toBeDefined();
	});

	test('历史条目同样带齐并可回放', () => {
		// pushHistory 走 safeLocalStorageSet 封装,故直接读回 key,不去拦截 setItem(拦截会因封装而落空)
		window.localStorage.removeItem('horosaGeomancyHistory');
		const inst = mk(RICH);
		inst.pushHistory(LIVE.european_classical);
		const stored = JSON.parse(window.localStorage.getItem('horosaGeomancyHistory') || 'null');
		expect(Array.isArray(stored) && stored.length > 0).toBe(true);
		const e = stored[0];
		expect(e.granular).toEqual(RICH.granular);
		expect(e.turnTo).toBe(4);
		expect(e.quesitedHouse).toBeGreaterThan(0);
		// 回放:历史条目 → state 逐键还原
		const fresh = mk({});
		fresh.clickCast = () => {};                 // 回放末尾会重算,单测不联网
		fresh.applyHistory(e);
		expect(fresh.state.granular).toEqual(RICH.granular);
		expect(fresh.state.turnTo).toBe(4);
		expect(Number(fresh.state.quesitedHouse)).toBeGreaterThan(0);
	});
});
