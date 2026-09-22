// AI 助手·无头起盘 cast_technique:源合成同形、准入闸、纯本地技法真出快照、后端不在线诚实报错、不落库。
jest.mock('../request', ()=>({ __esModule: true, default: jest.fn(async ()=>{ throw new Error('offline'); }) }));
jest.mock('../../services/astro', ()=>({ fetchChart: jest.fn(async ()=>{ throw new Error('offline'); }) }));
// [D8/T1] 起盘串行化(castChain)的解锁判据需要「快照构造器永不 settle」这一外部条件:
// 只把 getAnalysisTechniqueContexts 换成可控替身(缺省仍转发真实现),其余导出原样透传,
// 既有用例的行为逐字不变。
jest.mock('../aiAnalysisContext', ()=>{
	const actual = jest.requireActual('../aiAnalysisContext');
	return { __esModule: true, ...actual, getAnalysisTechniqueContexts: jest.fn((...a)=>actual.getAnalysisTechniqueContexts(...a)) };
});
jest.mock('../aiAnalysisStore', ()=>({
	AI_ANALYSIS_STORES: { contextCache: 'contextCache' },
	getStoreRecord: jest.fn(async ()=>null),
	putStoreRecord: jest.fn(async (storeName, record)=>record),
	schedulePruneContextCache: jest.fn(),
}));

import { registerBuiltinTools } from '../aiTools';
import { runTool, __resetToolsForTests } from '../aiTools/registry';
import { buildSourceFromArgs } from '../aiTools/tools/castTechnique';
import { listLocalCharts, upsertLocalChart } from '../localcharts';
import { listLocalCases } from '../localcases';

const ctx = ()=>({ origin: 'in-app', requestId: 'r1', dispatch: jest.fn() });

beforeEach(()=>{
	window.localStorage.clear();
	__resetToolsForTests();
	registerBuiltinTools();
});

describe('源合成(与 AI 分析页临时源同形)', ()=>{
	it('natal → sourceType chart + record 十字段;timepoint → sourceType timepoint + divTime', async ()=>{
		const n = await buildSourceFromArgs({ kind: 'natal', birth: '1990-01-01 08:00', place: '北京', gender: 'female', name: '甲' });
		expect(n.error).toBeUndefined();
		expect(n.source.sourceType).toBe('chart');
		expect(n.source.record).toEqual(expect.objectContaining({ birth: '1990-01-01 08:00:00', zone: '+08:00', lat: '39n54', lon: '116e24', gender: 0, name: '甲', pos: '北京' }));
		expect(typeof n.source.record.gpsLat).toBe('number');
		const t = await buildSourceFromArgs({ kind: 'timepoint', divTime: '2026-05-01 10:00', gpsLat: 26.0764, gpsLon: 119.3152 });
		expect(t.source.sourceType).toBe('timepoint');
		expect(t.source.record.divTime).toBe('2026-05-01 10:00:00');
		expect(t.source.record.lat).toBe('26n04');
		expect(t.source.record.gender).toBe(1);   // 与页面临时源默认同形
		expect(t.assumptions.some((a)=>/性别未给/.test(a))).toBe(true);
		const tNow = await buildSourceFromArgs({ kind: 'timepoint' });
		expect(tNow.source.record.divTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
		expect(tNow.assumptions.some((a)=>/起课时间取当前/.test(a))).toBe(true);
		expect(tNow.assumptions.some((a)=>/默认坐标/.test(a))).toBe(true);
	});
	it('record 源:未找到 → E_RECORD_NOT_FOUND;已存命盘 → 走 listAnalysisSources', async ()=>{
		const miss = await buildSourceFromArgs({ kind: 'record', cid: 'local-none' });
		expect(miss.error.code).toBe('E_RECORD_NOT_FOUND');
		upsertLocalChart({ name: '乙', birth: '1990-01-01 08:00:00', zone: '+08:00', lat: '39n54', lon: '116e24', gpsLat: 39.9, gpsLon: 116.4 });
		const cid = listLocalCharts({})[0].cid;
		const hit = await buildSourceFromArgs({ kind: 'record', cid });
		expect(hit.source.id).toBe(cid);
		expect(hit.source.sourceType).toBe('chart');
	});
});

describe('cast_technique', ()=>{
	it('🔴 八字(纯本地)对临时出生数据真出快照,且两库零新增', async ()=>{
		const r = await runTool('cast_technique', { technique: 'bazi', source: { kind: 'natal', birth: '1990-01-01 08:00', place: '北京', gender: 'male' } }, ctx());
		expect(r.ok).toBe(true);
		expect(r.data.key).toBe('bazi');
		expect(r.data.content.length).toBeGreaterThan(50);
		expect(r.data.truncated).toBe(false);
		expect(r.undo).toBeUndefined();
		expect(listLocalCharts({}).length).toBe(0);
		expect(listLocalCases({}).length).toBe(0);
	});
	it('maxChars 截断诚实打标', async ()=>{
		const r = await runTool('cast_technique', { technique: 'bazi', source: { kind: 'natal', birth: '1990-01-01 08:00', place: '北京' }, maxChars: 500 }, ctx());
		expect(r.ok).toBe(true);
		expect(r.data.truncated).toBe(true);
		expect(r.data.content).toMatch(/\[truncated: 剩余 \d+ 字符\]$/);
		expect(r.data.totalChars).toBeGreaterThan(500);
	});
	// [P1-1] 段对齐截断 + 按段取:让模型能只要「行星」那一段,而不是把整份快照拦腰砍在半张表中间。
	it('🔴 截断按段对齐:回报略去的段名,且正文不在段中间被砍', async ()=>{
		const r = await runTool('cast_technique', { technique: 'bazi', source: { kind: 'natal', birth: '1990-01-01 08:00', place: '北京' }, maxChars: 500 }, ctx());
		expect(r.ok).toBe(true);
		expect(r.data.sectionAligned).toBe(true);
		expect(Array.isArray(r.data.omittedSections)).toBe(true);
		expect(r.data.omittedSections.length).toBeGreaterThan(0);
		// 保留部分逐段完整:最后一个段头之后必然还有内容(不是刚开头就被切断)
		const kept = r.data.content.split('\n[truncated:')[0];
		const heads = kept.split('\n').filter((line)=>/^\[.+\]$/.test(line.trim()));
		expect(heads.length).toBeGreaterThan(0);
		expect(kept.trim().endsWith(heads[heads.length - 1])).toBe(false);
	});

	it('🔴 sections 只取指定段:正文只含命中段,体积显著小于全文', async ()=>{
		const full = await runTool('cast_technique', { technique: 'bazi', source: { kind: 'natal', birth: '1990-01-01 08:00', place: '北京' }, maxChars: 60000 }, ctx());
		const part = await runTool('cast_technique', { technique: 'bazi', source: { kind: 'natal', birth: '1990-01-01 08:00', place: '北京' }, maxChars: 60000, sections: ['起盘信息'] }, ctx());
		expect(part.ok).toBe(true);
		expect(part.data.sections).toEqual(['起盘信息']);
		expect(part.data.content).toContain('[起盘信息]');
		expect(part.data.pickedChars).toBeLessThan(full.data.content.length);
		expect(part.data.truncated).toBe(false);
	});

	it('🔴 sections 一段都没匹上 → E_SECTION_NOT_FOUND 并附可用段名(不返回空文本)', async ()=>{
		const r = await runTool('cast_technique', { technique: 'bazi', source: { kind: 'natal', birth: '1990-01-01 08:00', place: '北京' }, sections: ['根本不存在的段'] }, ctx());
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_SECTION_NOT_FOUND');
		expect(r.data.availableSections.length).toBeGreaterThan(0);
		expect(r.data.availableSections).toContain('起盘信息');
	});

	it('sections 传空数组/空串 = 不筛选(与不传逐字节相同)', async ()=>{
		const a = await runTool('cast_technique', { technique: 'bazi', source: { kind: 'natal', birth: '1990-01-01 08:00', place: '北京' }, maxChars: 3000 }, ctx());
		const b = await runTool('cast_technique', { technique: 'bazi', source: { kind: 'natal', birth: '1990-01-01 08:00', place: '北京' }, maxChars: 3000, sections: ['', '  '] }, ctx());
		expect(b.data.content).toBe(a.data.content);
		expect(b.data.sections).toBeUndefined();
	});

	it('准入闸:命盘源起六壬 → E_TECHNIQUE_NOT_ALLOWED 并列出可用集', async ()=>{
		const r = await runTool('cast_technique', { technique: 'liureng', source: { kind: 'natal', birth: '1990-01-01 08:00', place: '北京' } }, ctx());
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_TECHNIQUE_NOT_ALLOWED');
		expect(r.data.allowed).toContain('bazi');
	});
	it('后端不在线的技法(西占)→ 诚实报 E_CAST_BACKEND_FAILED/E_CAST_FAILED/E_SNAPSHOT_MISSING,不伪造', async ()=>{
		const r = await runTool('cast_technique', { technique: 'astrochart', source: { kind: 'natal', birth: '1990-01-01 08:00', place: '北京' } }, ctx());
		expect(r.ok).toBe(false);
		// 后端不可达在本环境走「构造器自报 chartFetchFailed」路 → 后端层码(可重试);另两枚是异常态/空快照路。
		expect(['E_CAST_BACKEND_FAILED', 'E_CAST_FAILED', 'E_SNAPSHOT_MISSING']).toContain(r.code);
	});
	it('schema:未知技法/坏 source 形状 → E_ARGS_INVALID', async ()=>{
		const r = await runTool('cast_technique', { technique: 'nope', source: { kind: 'natal', birth: 'x' } }, ctx());
		expect(r.code).toBe('E_ARGS_INVALID');
		const r2 = await runTool('cast_technique', { technique: 'bazi', source: { kind: 'record' } }, ctx());
		expect(r2.code).toBe('E_ARGS_INVALID');
	});
	it('出生时间缺时辰 → E_BIRTH_TIME_MISSING', async ()=>{
		const r = await runTool('cast_technique', { technique: 'bazi', source: { kind: 'natal', birth: '1990-01-01', place: '北京' } }, ctx());
		expect(r.ok).toBe(false);
		expect(r.code).toBe('E_BIRTH_TIME_MISSING');
	});
});

// [Q-330] 工具面必须先取「同类默认」(与对话页挂载卡同一解析),显式 options 覆盖其上。
// 此前 cast_technique 只认显式 options:用户在挂载卡设过同类默认,AI 起出来的快照与页面口径不同。
describe('Q-330 · 同类默认并入工具面', ()=>{
	it('🔴 同类默认进 techniqueOptions;显式 options 覆盖同名键;都没有时不传 techniqueOptions', async ()=>{
		const { MOUNT_TECHNIQUE_DEFAULTS_KEY } = require('../techniqueMountSettings');
		const ctxMod = require('../aiAnalysisContext');
		const build = ctxMod.getAnalysisTechniqueContexts;
		const source = { kind: 'natal', birth: '1990-01-01 08:00', place: '北京' };
		const optsOf = (call)=>((call && call[2] && call[2].techniqueOptions) || null);
		// 判别向量①:没设默认、没给 options → 不传 techniqueOptions(缺省路径零变化)
		build.mockImplementationOnce(async ()=>[{ key: 'bazi', status: 'ok', content: '【四柱与三元】甲子' }]);
		await runTool('cast_technique', { technique: 'bazi', source }, ctx());
		expect(optsOf(build.mock.calls[build.mock.calls.length - 1])).toBe(null);
		// 设一条同类默认 → 工具面要读到
		window.localStorage.setItem(MOUNT_TECHNIQUE_DEFAULTS_KEY, JSON.stringify({ version: 1, techniques: { bazi: { timeAlg: 1 } } }));
		build.mockImplementationOnce(async ()=>[{ key: 'bazi', status: 'ok', content: '【四柱与三元】甲子' }]);
		await runTool('cast_technique', { technique: 'bazi', source }, ctx());
		expect(optsOf(build.mock.calls[build.mock.calls.length - 1])).toEqual({ bazi: { timeAlg: 1 } });
		// 判别向量②:显式 options 覆盖同名键
		build.mockImplementationOnce(async ()=>[{ key: 'bazi', status: 'ok', content: '【四柱与三元】甲子' }]);
		await runTool('cast_technique', { technique: 'bazi', source, options: { timeAlg: 0 } }, ctx());
		expect(optsOf(build.mock.calls[build.mock.calls.length - 1])).toEqual({ bazi: { timeAlg: 0 } });
	});
});

// [D8/T1] 起盘串行化的解锁(先红)。合同/判别向量:
//   castTechnique.js:96-103 把每次起盘挂在模块级 castChain 上串行(七政那类「改全局→重算→还原」不能并发)。
//   但链条只 .then 不 withTimeout、也不看 ctx.signal:只要有一次起盘卡在构造器里不返回,
//   整个应用之后**再也起不了盘**(第二次调用永远在排队)。判据:首次挂死 + 用户中止后,
//   第二次起盘必须在 200ms 内真的开跑(以构造器被调用为准,不等它算完)(计划批一 #10)。
//   ⚠️ 本用例会把模块级 castChain 永久留在「未 settle」态,必须放在本文件最后。
describe('T1 · 起盘串行化的解锁', ()=>{
	it('🔴 T1 首次起盘挂死 + ctx.signal 中止 → 第二次起盘 200ms 内开跑', async ()=>{
		const ctxMod = require('../aiAnalysisContext');
		const build = ctxMod.getAnalysisTechniqueContexts;
		const source = { kind: 'natal', birth: '1990-01-01 08:00', place: '北京' };
		const base = build.mock.calls.length;
		build.mockImplementationOnce(()=>new Promise(()=>{}));   // 永不 settle 的快照构造器
		const ac = new AbortController();
		const first = runTool('cast_technique', { technique: 'bazi', source }, { ...ctx(), signal: ac.signal });
		first.catch(()=>{});
		await new Promise((r)=>setTimeout(r, 30));
		expect(build.mock.calls.length).toBe(base + 1);   // 自证:首次确实卡在构造器里
		ac.abort();
		const before = build.mock.calls.length;
		const second = runTool('cast_technique', { technique: 'bazi', source }, ctx());
		second.catch(()=>{});
		await new Promise((r)=>setTimeout(r, 200));
		expect(build.mock.calls.length).toBeGreaterThan(before);
	});
});
