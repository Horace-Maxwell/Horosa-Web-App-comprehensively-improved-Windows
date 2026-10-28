// 灵棋「手动」种子来源不记(与塔罗同口径):种子本身是逐卦输入、不保留,记了「手动」= 重开后每次都起种子 0 那一卦。
// 选了照常用,只是库里仍是上一次的「随机 / 时间」;旧版存过 'manual' 的读回时回落缺省。
var mockSaved = null;
jest.mock('../../../utils/kentangCaseSave', () => {
	const actual = jest.requireActual('../../../utils/kentangCaseSave');
	return { __esModule: true, ...actual, getKentangSavedCasePayload: () => mockSaved };
});
import LingQiMain, { STORE_KEY } from '../LingQiMain';

const read = ()=>JSON.parse(window.localStorage.getItem(STORE_KEY) || '{}');
const self = (seedMode)=>({ state: { seedMode, display: 'simp', category: 'general', zhuVisible: {} } });

describe('灵棋种子来源持久化', ()=>{
	beforeEach(()=>{ window.localStorage.clear(); });
	test('选「手动」(含锁定复现)不进库;库里保持上一次的「时间」', ()=>{
		LingQiMain.prototype.persist.call(self('time_seed'), {});
		expect(read().seedMode).toBe('time_seed');
		LingQiMain.prototype.persist.call(self('manual'), { seedMode: 'manual' });
		expect(read().seedMode).toBe('time_seed');
		LingQiMain.prototype.persist.call(self('manual'), { display: 'trad' });
		expect(read()).toEqual(expect.objectContaining({ seedMode: 'time_seed', display: 'trad' }));
	});
	test('库里从没存过 → 「手动」不记,回落缺省「随机」', ()=>{
		LingQiMain.prototype.persist.call(self('manual'), { seedMode: 'manual' });
		expect(read().seedMode).toBe('random');
	});
	test('旧版存过 manual → 打开时回落缺省', ()=>{
		window.localStorage.setItem(STORE_KEY, JSON.stringify({ seedMode: 'manual', display: 'trad' }));
		const inst = new LingQiMain({ fields: null });
		expect(inst.state.seedMode).toBe('random');
		expect(inst.state.display).toBe('trad');
	});
	test('🔴 载入存档说「手动」却没带种子 → 不切到手动(空种子再掷恒得同一卦);带了种子才切', ()=>{
		const inst = new LingQiMain({ fields: null });
		inst.setState = (st, cb)=>{ inst.state = { ...inst.state, ...st }; if(cb){ cb(); } };
		inst.saveSnap = ()=>{};
		mockSaved = { caseVersion: 1, payload: { counts: [1, 2, 3], options: { seedMode: 'manual', seed: '', handPlaced: true } } };
		expect(inst.restoreFromCurrentCase(true)).toBe(true);
		expect(inst.state.seedMode).toBe('random');
		mockSaved = { caseVersion: 2, payload: { counts: [1, 2, 3], options: { seedMode: 'manual', seed: '42' } } };
		inst.restoreFromCurrentCase(true);
		expect(inst.state.seedMode).toBe('manual');
		expect(inst.state.manualSeed).toBe('42');
	});
	test('🔴 AI 按棋数建事盘:本机旧存的「手动」来源归成随机', async ()=>{
		window.localStorage.setItem(STORE_KEY, JSON.stringify({ seedMode: 'manual' }));
		const { CAST_SPECS } = require('../../../utils/aiTools/divinationCast');
		const r = await CAST_SPECS.lingqi.build({ counts: [2, 1, 3] }, { divTime: '2026-10-17 10:00:00', zone: '+08:00', gpsLat: 31.2, gpsLon: 121.5, lat: '31n12', lon: '121e30' }, { question: '' });
		expect(r.ok).toBe(true);
		expect(r.body.options.seedMode).toBe('random');
		window.localStorage.setItem(STORE_KEY, JSON.stringify({ seedMode: 'time_seed' }));
		const r2 = await CAST_SPECS.lingqi.build({ counts: [2, 1, 3] }, { divTime: '2026-10-17 10:00:00', zone: '+08:00', gpsLat: 31.2, gpsLon: 121.5, lat: '31n12', lon: '121e30' }, { question: '' });
		expect(r2.body.options.seedMode).toBe('time_seed');
	});
	test('手动种子是文本框:数字或文字原样作种子(同一串恒同卦,不同串可不同);清空 / 纯空白同旧数字框清空(0)', ()=>{
		const { resolveLingqiSeed } = require('../core/lingqiCast');
		expect(resolveLingqiSeed('manual', '甲子年问事', null)).toBe('甲子年问事');
		expect(resolveLingqiSeed('manual', 42, null)).toBe('42');
		expect(resolveLingqiSeed('manual', '', null)).toBe('0');
		expect(resolveLingqiSeed('manual', '   ', null)).toBe('0');
		const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'LingQiMain.js'), 'utf8');
		expect(src).toMatch(/s\.seedMode === 'manual' && !s\.manualMode \? this\.field\('手动种子',\s*<Input /);
	});
});
