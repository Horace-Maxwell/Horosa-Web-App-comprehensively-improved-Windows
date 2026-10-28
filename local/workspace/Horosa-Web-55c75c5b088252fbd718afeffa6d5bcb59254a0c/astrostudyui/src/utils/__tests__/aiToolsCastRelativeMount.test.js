// cast_relative 与对话页双盘挂载同一取数:两人各按自己的生效挂载设置(同类默认,按各自那张盘现状剪)。
// 判据:设了紫微四化流派的同类默认 → 工具正文与对话页口径(getPairChineseTexts 带两人设置)逐字相同、标明按挂载设置的流派;
// 没设 = 与不带设置时逐字相同;西洋一门把星盘那一门的设置交给合盘取数。
jest.mock('../request', ()=>({ __esModule: true, default: jest.fn(async ()=>{ throw new Error('offline'); }) }));
jest.mock('../../services/astro', ()=>({ fetchChart: jest.fn(async ()=>{ throw new Error('offline'); }) }));
jest.mock('../aiAnalysisContext', ()=>{
	const actual = jest.requireActual('../aiAnalysisContext');
	return { __esModule: true, ...actual, getPairSynastryText: jest.fn(async ()=>'【比较盘】测试正文') };
});
import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { __resetLedgerForTests } from '../aiTools/ledger';
import { registerWorkspaceBridge, __resetWorkspaceBridgeForTests } from '../aiTools/workspaceBridge';
import { setAgentEnabled } from '../aiAgent/prefs';
import { upsertLocalChart } from '../localcharts';
import { findAnalysisSourceById } from '../aiAnalysisSources';
import { getPairChineseTexts, getPairSynastryText, __resetPairChineseCacheForTests } from '../aiAnalysisContext';
import { saveMountTechniqueDefaults, resolveEffectiveTechniqueOptions } from '../techniqueMountSettings';

const ctx = ()=>({ origin: 'mcp', requestId: 'rel-mount', dispatch: jest.fn() });
const chart = (name, birth)=>upsertLocalChart({ name, birth, zone: '+08:00', lat: '39n54', lon: '116e24', gpsLat: 39.9, gpsLon: 116.4, gender: 1 });
const recOf = (cid)=>{ const src = findAnalysisSourceById(cid); return src && src.record; };
const sectionOf = (content, title)=>{
	const i = content.indexOf(`【${title}】\n`);
	if(i < 0){ return ''; }
	const rest = content.slice(i + title.length + 3);
	const j = rest.indexOf('\n\n【');
	return (j >= 0 ? rest.slice(0, j) : rest).trim();
};
const KEYS = ['astrochart', 'bazi', 'ziwei'];

beforeEach(()=>{
	window.localStorage.clear();
	__resetToolsForTests(); __resetLedgerForTests(); __resetWorkspaceBridgeForTests(); __resetPairChineseCacheForTests();
	registerWorkspaceBridge({ dispatch: jest.fn(), changeCond: jest.fn() });
	setAgentEnabled(true);
	registerBuiltinTools();
	getPairSynastryText.mockClear();
});

describe('cast_relative 按两人各自的生效挂载设置', ()=>{
	it('🔴 设了紫微四化流派的同类默认:正文与对话页口径逐字相同,并标明按挂载设置的流派', async ()=>{
		const A = chart('张三', '1990-05-18 10:00:00');
		const B = chart('李四', '1992-03-07 08:30:00');
		saveMountTechniqueDefaults('ziwei', { sihuaSchool: 'zhongzhou' });
		const r = await runTool('cast_relative', { a: { kind: 'record', cid: A.cid }, b: { kind: 'record', cid: B.cid }, modes: ['ziwei'], maxChars: 60000 }, ctx());
		expect(r.ok).toBe(true);
		const ra = recOf(A.cid);
		const rb = recOf(B.cid);
		const names = { selfName: '张三', otherName: '李四' };
		const chatSide = getPairChineseTexts(ra, rb, ['ziwei'], names, { optionsA: resolveEffectiveTechniqueOptions(KEYS, { record: ra }), optionsB: resolveEffectiveTechniqueOptions(KEYS, { record: rb }) }).ziwei;
		const bare = getPairChineseTexts(ra, rb, ['ziwei'], names).ziwei;
		const got = sectionOf(r.data.content, '紫微合盘对照');
		expect(got).toBe(chatSide.trim());
		expect(got).not.toBe(bare.trim());
		expect(got).toContain('中州派');
	});
	it('没设同类默认:与不带设置时逐字相同(零回归)', async ()=>{
		const A = chart('张三', '1990-05-18 10:00:00');
		const B = chart('李四', '1992-03-07 08:30:00');
		const r = await runTool('cast_relative', { a: { kind: 'record', cid: A.cid }, b: { kind: 'record', cid: B.cid }, modes: ['bazi', 'ziwei'], maxChars: 60000 }, ctx());
		expect(r.ok).toBe(true);
		const bare = getPairChineseTexts(recOf(A.cid), recOf(B.cid), ['bazi', 'ziwei'], { selfName: '张三', otherName: '李四' });
		expect(sectionOf(r.data.content, '紫微合盘对照')).toBe(bare.ziwei.trim());
		expect(sectionOf(r.data.content, '八字合婚对照')).toBe(bare.bazi.trim());
	});
	it('🔴 西洋一门:星盘那一门的同类默认交给合盘取数(两人各一份)', async ()=>{
		const A = chart('张三', '1990-05-18 10:00:00');
		const B = chart('李四', '1992-03-07 08:30:00');
		saveMountTechniqueDefaults('astrochart', { hsys: 0 });
		const r = await runTool('cast_relative', { a: { kind: 'record', cid: A.cid }, b: { kind: 'record', cid: B.cid }, modes: ['western'] }, ctx());
		expect(r.ok).toBe(true);
		expect(getPairSynastryText).toHaveBeenCalledTimes(1);
		const opts = getPairSynastryText.mock.calls[0][2] || {};
		expect([opts.optionsA && opts.optionsA.astrochart, opts.optionsB && opts.optionsB.astrochart]).toEqual([{ hsys: 0 }, { hsys: 0 }]);
	});
});
