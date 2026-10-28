// 起卦输入键守卫:cast_technique 的 options 覆盖与 set_settings 的 mount 面都不能改「决定卦象本身」的键
// (太玄 / 荆诀种子、五兆起例模式与兆数、神易数手动时辰、皇极心易报数、六壬选时支 / 演数、奇门阴盘报数;以及只在存档里的牌面 / 棋数 / 卦)。
// 判据:真实调用 → 拒(E_ARGS_INVALID / E_SETTING_KEY_NOT_ALLOWED)且起盘构造器一次都没被调(不排队不起盘);判读口径键照常透传。
jest.mock('../request', ()=>({ __esModule: true, default: jest.fn(async ()=>{ throw new Error('offline'); }) }));
jest.mock('../aiAnalysisContext', ()=>{
	const actual = jest.requireActual('../aiAnalysisContext');
	return { __esModule: true, ...actual, getAnalysisTechniqueContexts: jest.fn(async (src, keys)=>[{ key: keys[0], title: keys[0], module: keys[0], status: 'ok', content: '【卦】测试快照' }]) };
});
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { __resetLedgerForTests } from '../aiTools/ledger';
import { getAnalysisTechniqueContexts } from '../aiAnalysisContext';
import { CAST_INPUT_KEYS, castInputKeysIn, isCastInputKey } from '../aiTools/castInputKeys';
import { getTechniqueSettingsSchema, getMountTechniqueDefault, saveMountTechniqueDefaults } from '../techniqueMountSettings';
import { upsertLocalCase } from '../localcases';

const ctx = ()=>({ origin: 'mcp', requestId: 'cast-guard', dispatch: jest.fn() });
const timepoint = { kind: 'timepoint', divTime: '2026-03-01 10:00', place: '北京' };
const optsPassed = ()=>{ const calls = getAnalysisTechniqueContexts.mock.calls; const last = calls[calls.length - 1]; return last && last[2] ? last[2].techniqueOptions : undefined; };

beforeEach(()=>{
	window.localStorage.clear(); __resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests();
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	registerBuiltinTools();
	getAnalysisTechniqueContexts.mockClear();
});

describe('清单本身', ()=>{
	it('挂载表里登记了的起卦键都真在该技法的挂载字段里(改名即红);只在存档里的牌面 / 卦键不在挂载表(覆盖层本就剪掉)', ()=>{
		const registered = ['taixuan', 'jingjue', 'wuzhao', 'shenyishu', 'huangji', 'liureng', 'qimen', 'sanshiunited', 'jinkou', 'indiachart'];
		registered.forEach((t)=>{
			const names = (getTechniqueSettingsSchema(t).fields || []).map((f)=>f.name);
			const frozenOnly = { wuzhao: ['pan'] }[t] || [];
			CAST_INPUT_KEYS[t].filter((k)=>frozenOnly.indexOf(k) < 0).forEach((k)=>{ expect(`${t}.${k}:${names.indexOf(k) >= 0}`).toBe(`${t}.${k}:true`); });
		});
		['tarot', 'geomancy', 'lingqi', 'sixyao', 'xiaoliuren', 'xiaochengtu', 'feigong', 'guice'].forEach((t)=>{
			const names = ((getTechniqueSettingsSchema(t) || {}).fields || []).map((f)=>f.name);
			CAST_INPUT_KEYS[t].forEach((k)=>{ expect(`${t}.${k}:${names.indexOf(k) >= 0}`).toBe(`${t}.${k}:false`); });
		});
		expect(isCastInputKey('taixuan', 'seed')).toBe(true);
		expect(isCastInputKey('bazi', 'seed')).toBe(false);
		expect(castInputKeysIn('wuzhao', { xingshenMonth: 'jieqi', mode: 'qian', number: 3 })).toEqual(['mode', 'number']);
	});
});

describe('cast_technique options', ()=>{
	it('🔴 太玄 / 荆诀种子:临时时间点带 seed → E_ARGS_INVALID,说明原因,起盘构造器一次都没调', async ()=>{
		for(const t of ['taixuan', 'jingjue']){
			const r = await runTool('cast_technique', { technique: t, source: timepoint, options: { seed: 123456 } }, ctx());   // eslint-disable-line no-await-in-loop
			expect(`${t}:${r.code}`).toBe(`${t}:E_ARGS_INVALID`);
			expect(r.message).toContain('起卦输入');
			expect(r.data.castInputKeys).toEqual(['seed']);
		}
		expect(getAnalysisTechniqueContexts).not.toHaveBeenCalled();
	});
	it('🔴 五兆起例模式 / 兆数 / 六掷、六爻卦、塔罗种子与牌阵、灵棋棋数、心易报数、神易数手动时辰、六壬演数、奇门报数 → 一律拒,不排队不起盘', async ()=>{
		const cases = [
			['wuzhao', { mode: 'zhushu', zhaoNums: '1,2,3,4,5,1' }], ['wuzhao', { qianAuto: 0, qianThrows: '1,2,3,3,3,4' }], ['wuzhao', { manual: 1, manualSplits: '18,8,5,2,1,1' }],
			['sixyao', { gua: { yao: [7, 7, 7, 8, 8, 8] } }], ['tarot', { seed: 'abc', spreadType: 'celtic' }], ['lingqi', { counts: [1, 2, 3] }],
			['huangji', { xinyiMethod: 'number', upperNum: 5, lowerNum: 10 }], ['shenyishu', { hourSource: 'manual', manualHour: 3 }],
			['liureng', { castMethod: 'baoshu', yanShuNum: '27' }], ['qimen', { shuziReportNumber: '128' }],
		];
		for(const [t, options] of cases){
			const r = await runTool('cast_technique', { technique: t, source: timepoint, options }, ctx());   // eslint-disable-line no-await-in-loop
			expect(`${t}:${r.code}`).toBe(`${t}:E_ARGS_INVALID`);
		}
		expect(getAnalysisTechniqueContexts).not.toHaveBeenCalled();
	});
	it('判读口径键照常透传(判别向量:不是整技法一刀切)', async ()=>{
		const r = await runTool('cast_technique', { technique: 'wuzhao', source: timepoint, options: { xingshenMonth: 'jieqi' } }, ctx());
		expect(r.ok).toBe(true);
		expect(optsPassed()).toEqual({ wuzhao: { xingshenMonth: 'jieqi' } });
	});
	it('🔴 已存塔罗事盘:判读口径照常透传;带牌面种子 / 牌阵的覆盖 → 拒,存档的牌面不被重起', async ()=>{
		const rec = upsertLocalCase({ event: '塔罗存档', caseType: 'tarot', divTime: '2026-03-01 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e24', gpsLat: 39.9, gpsLon: 116.4, sourceModule: 'tarot', payload: JSON.stringify({ module: 'tarot', options: { seed: 'stored-seed', spreadType: 'three', deckId: 'rws' } }) });
		const source = { kind: 'record', cid: rec.cid };
		const t = await runTool('cast_technique', { technique: 'tarot', source, options: { reversalMode: 'blocked' } }, ctx());
		expect(`${t.ok}:${t.code || ''}`).toBe('true:');
		expect(optsPassed()).toEqual({ tarot: { reversalMode: 'blocked' } });
		getAnalysisTechniqueContexts.mockClear();
		const bad = await runTool('cast_technique', { technique: 'tarot', source, options: { seed: 'ai-picked', reversalMode: 'blocked' } }, ctx());
		expect(bad.code).toBe('E_ARGS_INVALID');
		expect(bad.data.castInputKeys).toEqual(['seed']);
		expect(getAnalysisTechniqueContexts).not.toHaveBeenCalled();
	});
});

describe('金口诀地分 / 印度盘问事:求测者给的起课输入同样锁住', ()=>{
	it('🔴 cast_technique:金口诀带地分、印度盘带问事时刻或问数 → 拒,不排队不起盘;判读口径键照常透传', async ()=>{
		const jk = await runTool('cast_technique', { technique: 'jinkou', source: timepoint, options: { diFen: '午' } }, ctx());
		expect([jk.code, jk.data && jk.data.castInputKeys]).toEqual(['E_ARGS_INVALID', ['diFen']]);
		const chartSrc = { kind: 'natal', birth: '1990-05-18 10:00', place: '北京' };
		const ip = await runTool('cast_technique', { technique: 'indiachart', source: chartSrc, options: { indiaPrashnaTime: '2026/03/01 10:00:00', indiaPrashnaNumber: 77 } }, ctx());
		expect([ip.code, ip.data && ip.data.castInputKeys]).toEqual(['E_ARGS_INVALID', ['indiaPrashnaTime', 'indiaPrashnaNumber']]);
		const ipn = await runTool('cast_technique', { technique: 'indiachart', source: chartSrc, options: { indiaPrashnaNumber: 77 } }, ctx());
		expect(ipn.code).toBe('E_ARGS_INVALID');
		expect(getAnalysisTechniqueContexts).not.toHaveBeenCalled();
		const ok = await runTool('cast_technique', { technique: 'indiachart', source: chartSrc, options: { hsys: 0 } }, ctx());
		expect(ok.ok).toBe(true);
	});
	it('🔴 已存金口诀事盘:改地分的覆盖 → 拒,存档地分不被重起', async ()=>{
		const rec = upsertLocalCase({ event: '金口诀存档', caseType: 'jinkou', divTime: '2026-03-01 10:00:00', zone: '+08:00', lat: '39n54', lon: '116e24', gpsLat: 39.9, gpsLon: 116.4, sourceModule: 'jinkou', payload: JSON.stringify({ module: 'jinkou', diFen: '子' }) });
		const bad = await runTool('cast_technique', { technique: 'jinkou', source: { kind: 'record', cid: rec.cid }, options: { diFen: '午' } }, ctx());
		expect(bad.code).toBe('E_ARGS_INVALID');
		expect(getAnalysisTechniqueContexts).not.toHaveBeenCalled();
	});
	it('🔴 set_settings mount:地分 / 问数写进同类默认 → 拒;describe 标只读并说明是起卦输入', async ()=>{
		const w = await runTool('set_settings', { facet: 'mount', technique: 'jinkou', values: { diFen: '午' } }, ctx());
		expect([w.code, /起卦输入/.test(w.message)]).toEqual(['E_SETTING_KEY_NOT_ALLOWED', true]);
		expect(getMountTechniqueDefault('jinkou')).toEqual({});
		const d = await runTool('describe_settings', { facet: 'mount', technique: 'jinkou' }, ctx());
		const df = d.data.items.find((it)=>it.key === 'diFen');
		expect([df.settable, /起卦输入/.test(df.hint || '')]).toEqual([false, true]);
		const n = await runTool('set_settings', { facet: 'mount', technique: 'indiachart', values: { indiaPrashnaTime: '2026/03/01 10:00:00', indiaPrashnaNumber: 77 } }, ctx());
		expect(n.code).toBe('E_SETTING_KEY_NOT_ALLOWED');
		expect(getMountTechniqueDefault('indiachart')).toEqual({});
	});
	it('用户亲手在挂载卡里设的地分照常生效(只拦助手给的参数)', async ()=>{
		saveMountTechniqueDefaults('jinkou', { diFen: '午' });
		const r = await runTool('cast_technique', { technique: 'jinkou', source: timepoint }, ctx());
		expect(r.ok).toBe(true);
		expect(optsPassed()).toEqual({ jinkou: { diFen: '午' } });
	});
});

describe('set_settings mount 面', ()=>{
	it('🔴 不能把种子 / 起例模式种进同类默认(否则下次挂载就按 AI 给的种子重起)', async ()=>{
		const r = await runTool('set_settings', { facet: 'mount', technique: 'taixuan', values: { seed: 99 } }, ctx());
		expect(r.code).toBe('E_SETTING_KEY_NOT_ALLOWED');
		expect(r.message).toContain('起卦输入');
		expect(getMountTechniqueDefault('taixuan')).toEqual({});
		const h = await runTool('set_settings', { facet: 'mount', technique: 'huangji', values: { xinyiMethod: 'number' } }, ctx());
		expect(h.code).toBe('E_SETTING_KEY_NOT_ALLOWED');
		expect(getMountTechniqueDefault('huangji')).toEqual({});
	});
});
