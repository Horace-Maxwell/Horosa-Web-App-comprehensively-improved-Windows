// 塔罗载入存档:这一副按存档种子原样复现;种子来源按存档里记下的你当时的来源档(与灵棋同)——
// 此前保存恒写「手动」、载入恒切到手动并填入存档种子 →「再抽」永远是同一副。旧档(只记了手动)照旧。
var mockSaved = null;
jest.mock('../../../utils/kentangCaseSave', () => ({
	openKentangCaseDrawer: jest.fn((arg) => { global.__tarotSaved = arg; }),
	getKentangSavedCasePayload: jest.fn(() => mockSaved),
}));
jest.mock('../../../utils/moduleAiSnapshot', () => ({ saveModuleAISnapshot: jest.fn(), saveModuleAISnapshotLazy: jest.fn() }));
import TarotMain from '../TarotMain';

const mk = (extra) => {
	const i = new TarotMain({ fields: null, dispatch: () => {} });
	i.state = { ...i.state, ...(extra || {}) };
	i.setState = (patch, cb) => { i.state = { ...i.state, ...(typeof patch === 'function' ? patch(i.state) : patch) }; if (cb) cb(); };
	return i;
};

describe('塔罗载入存档后的种子来源', () => {
	test('🔴 保存记你当时的来源;载入后这一副原样复现,来源仍是你的(再抽抽新的)', () => {
		const a = mk({ seedMode: 'random' });
		a.drawCards();
		expect(a.state.reading).toBeTruthy();
		a.clickSaveCase();
		const payload = global.__tarotSaved.payload;
		expect(payload.options.seedMode).toBe('random');
		expect(payload.options.seed).toBe(a.state.lastSeed);
		mockSaved = { caseVersion: 'v1', payload };
		const b = mk({ seedMode: 'birth' });
		expect(b.restoreFromCurrentCase(true)).toBe(true);
		expect(b.state.seedMode).toBe('random');
		expect(b.state.lastSeed).toBe(a.state.lastSeed);
		expect(JSON.stringify(b.state.reading.cards || b.state.reading)).toBe(JSON.stringify(a.state.reading.cards || a.state.reading));
	});
	test('旧档(只记了手动 + 种子)照旧切到手动并填入', () => {
		mockSaved = { caseVersion: 'v2', payload: { options: { seedMode: 'manual', seed: 'rnd-1' } } };
		const c = mk({ seedMode: 'random' });
		c.restoreFromCurrentCase(true);
		expect(c.state.seedMode).toBe('manual');
		expect(c.state.manualSeed).toBe('rnd-1');
	});
});
