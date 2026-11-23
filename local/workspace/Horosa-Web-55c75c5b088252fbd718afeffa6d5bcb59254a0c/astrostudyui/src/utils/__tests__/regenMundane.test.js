// 世俗盘无头复算:事件挑选与接线(取数与正文构建由页面同一套函数完成,真引擎实跑见无头验证)。
import { pickLatestEvent, MUNDANE_HEADLESS_TYPES } from '../aiAnalysisContext/regenMundane';
import { TIMEPOINT_CASTABLE_SET } from '../aiAnalysisContext/catalog';
import { getTechniqueSettingsSchema } from '../techniqueMountSettings';

const fs = require('fs');
const path = require('path');
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的门面按「子模块 + 门面」全集读(scripts/source-sets.json)

test('当令事件 = 截止时刻之前(含)最近的一次;一次都没有回 null', ()=>{
	const ev = [{ localTime: '2026-10-10 01:00:00' }, { localTime: '2026-11-09 15:02:07' }, { localTime: '2026-11-24 22:00:00' }];
	expect(pickLatestEvent(ev, '2026-11-13 10:24')).toBe(ev[1]);
	expect(pickLatestEvent(ev, '2026-11-09 15:02:07')).toBe(ev[1]);
	expect(pickLatestEvent(ev, '2026-01-01 00:00')).toBeNull();
	expect(pickLatestEvent([], '2026-11-13')).toBeNull();
});

test('起课时间可起世俗盘;挂载设置十种盘(与页面盘种清单一一对应)与各盘种自己的参数', ()=>{
	expect(TIMEPOINT_CASTABLE_SET.has('mundane')).toBe(true);
	expect(MUNDANE_HEADLESS_TYPES).toEqual(['ingress', 'newmoon', 'fullmoon', 'solecl', 'lunecl', 'region', 'cycles', 'solunar', 'vedicmundane', 'mundanehorary']);
	const page = require('./helpers/sourceSet').readSource(path.resolve(__dirname, '../../components/mundane/MundaneMain.js'));   // 门面 + 子模块全集
	const pageTypes = (page.match(/const MUNDANE_TYPES = \[([\s\S]*?)\];/) || [])[1] || '';
	expect([...pageTypes.matchAll(/key: '([a-z]+)'/g)].map((m)=>m[1])).toEqual(MUNDANE_HEADLESS_TYPES);
	const sch = getTechniqueSettingsSchema('mundane');
	expect(sch.kind).toBe('payload');
	expect(sch.fields.map((f)=>f.name)).toEqual(['mundaneType', 'ingressTerm', 'ingressYear', 'regionKey', 'regionCandidate', 'regionTargetYear', 'solunarType', 'vedicEvent', 'mhKind', 'mundaneRuleset']);
	expect(sch.fields[0].options.map((o)=>o.value)).toEqual(MUNDANE_HEADLESS_TYPES);
	const by = (n)=>sch.fields.find((f)=>f.name === n);
	// 各盘种参数只在本盘种显示;年份三种盘共用
	expect(['ingress', 'solunar', 'vedicmundane', 'region'].map((t)=>by('ingressYear').showWhen({ mundaneType: t }))).toEqual([true, true, true, false]);
	expect(by('regionCandidate').showWhen({ mundaneType: 'region' })).toBe(false);
	expect(by('regionCandidate').showWhen({ mundaneType: 'region', regionKey: 'paris_1792' })).toBe(true);
	expect(by('solunarType').options).toHaveLength(8);
	expect(by('mhKind').options.map((o)=>o.value)).toEqual(['war', 'weather', 'price']);
	expect(by('regionKey').options[0]).toEqual({ value: '', label: '本盘时间地点即建置' });
});

test('页面按需拉取的段(木土纪元 / 周期表 / 年之九主)用页面同一组方法现取;恒星入境用页面同一个求根', ()=>{
	const rm = fs.readFileSync(path.resolve(__dirname, '../aiAnalysisContext/regenMundane.js'), 'utf8');
	['MundaneMain.prototype.computeGreatConj.call(host)', 'MundaneMain.prototype.ensureCycleTableText.call(host, chart, extra)', 'MundaneMain.prototype.computeVedicNavanayaka.call(host, extra, asFields(geo))', 'mod.solveSiderealIngress(typeKey, year, geo)', 'mod.solveVedicSolarIngress(ev, year, geo)'].forEach((s)=>expect(rm).toContain(s));
});

test('复算入口接线;正文用世俗盘页同一个构建函数;已存事盘仍直读存档快照', ()=>{
	const rc = fs.readFileSync(path.resolve(__dirname, '../aiAnalysisContext/regenCase.js'), 'utf8');
	expect(rc).toContain('return buildMundaneSnapshotForRecord(record, p);');
	expect(rc).toContain("return (payload && payload.aiSnapshot && `${payload.aiSnapshot}`.trim()) ? `${payload.aiSnapshot}` : '';");
	const rm = fs.readFileSync(path.resolve(__dirname, '../aiAnalysisContext/regenMundane.js'), 'utf8');
	expect(rm).toContain('MundaneMain.prototype.buildAiSnapshot.call(host, chart, evFields, extra)');
	expect(rm).toContain('bridge.fetchPreciseJieqiSeed(');
});

// 皇极轨策:起课时间源按「年月日时起例」起卦;已存的卦绝不重起
describe('皇极轨策起课时间源', ()=>{
	const { guiceTimeCastPayload, guiceCtxFromNongli } = require('../../components/guice/GuiceMain');
	const NL = { monthInt: 10, dayInt: 5, date: '2026-11-13', bazi: { year: { ganzi: '丙午', branch: { cell: '午' }, stem: { cell: '丙' } }, month: { ganzi: '己亥', branch: { cell: '亥' } }, day: { ganzi: '甲申', stem: { cell: '甲' } }, time: { ganzi: '己巳', branch: { cell: '巳' } } } };
	test('历法坐标与页面同一份;年7 + 月10 + 日5 → 上坎,加时6 → 下震,4 爻动', ()=>{
		expect(guiceCtxFromNongli(NL)).toMatchObject({ yearZhi: '午', lunarMonth: 10, lunarDay: 5, hourZhi: '巳', dayGan: '甲', pillars: ['丙午', '己亥', '甲申', '己巳'] });
		const p = guiceTimeCastPayload(NL, { options: { x: 1 } });
		expect(p.options).toEqual({ x: 1 });
		expect(p.gua).toMatchObject({ up: expect.anything(), lo: expect.anything(), dongYao: 4 });
		expect(p.ctx.hourZhi).toBe('巳');
	});
	test('复算入口只在起课时间源(sourceModule 为空)且没有已存的卦时起', ()=>{
		const rc = fs.readFileSync(path.resolve(__dirname, '../aiAnalysisContext/regenCase.js'), 'utf8');
		expect(rc).toContain("if(!(p.gua && p.gua.up) && record && record.sourceModule === ''){");
		expect(TIMEPOINT_CASTABLE_SET.has('guice')).toBe(true);
	});
});

describe('分至起课时间源', ()=>{
	test('可起;复算入口用分至页同一份取数与正文;没有可调设置', ()=>{
		expect(TIMEPOINT_CASTABLE_SET.has('jieqi')).toBe(true);
		const rc = fs.readFileSync(path.resolve(__dirname, '../aiAnalysisContext/regenCase.js'), 'utf8');
		expect(rc).toContain('return buildJieQiSnapshotForRecordFields(buildFieldObject(record));');
		const page = readSource(path.resolve(__dirname, '../../components/jieqi/JieQiChartsMain.js'));
		expect(page).toContain('const full = await fetchPreciseJieqiYear(params);');
		expect(page).toContain('const one = await loadJieqiChart(params, title, row.time);');
		expect(getTechniqueSettingsSchema('jieqi')).toMatchObject({ kind: 'payload', fields: [] });
	});
});

describe('日子馆个性化择日工具', ()=>{
	const { searchRiziTool, RIZI_EVENTS } = require('../aiTools/tools/searchRizi');
	const { buildPersonalizedDates, personBazi } = require('../../components/calendar/riziEngine');
	test('与页面同一引擎:同输入同一张吉日榜;本人 + 配偶出合婚一行', async ()=>{
		const r = await searchRiziTool.run({ event: 'marriage', year: 2027, persons: [{ birth: '1992-03-04 08:30', gender: 'male' }, { role: 'spouse', birth: '1994-07-21 15:00', gender: 'female' }], topN: 5 });
		expect(r.ok).toBe(true);
		const base = (p)=>({ date: p[0], time: p[1], zone: '+08:00', gender: p[2], after23NewDay: 1, lateZiHourUseNextDay: 1 });
		const ref = buildPersonalizedDates({ event: 'marriage', year: 2027, topN: 5, persons: [
			{ role: 'self', gender: 1, bazi: personBazi(base(['1992-03-04', '08:30:00', 1])) },
			{ role: 'spouse', gender: 0, bazi: personBazi(base(['1994-07-21', '15:00:00', 0])) }] });
		expect(r.data.dates.map((d)=>d.ymd)).toEqual(ref.list.map((d)=>d.ymd));
		expect(r.data.content).toContain('合婚：本人×配偶');
		expect(RIZI_EVENTS).toContain('move');
	});
	test('当事人缺出生资料 / 解析不了 / 命盘不存在:如实报错', async ()=>{
		expect((await searchRiziTool.run({ event: 'move', year: 2027, persons: [{}] })).code).toBe('E_ARGS_INVALID');
		expect((await searchRiziTool.run({ event: 'move', year: 2027, persons: [{ birth: '某天' }] })).ok).toBe(false);
		expect((await searchRiziTool.run({ event: 'move', year: 2027, persons: [{ recordId: 'local-nope' }] })).code).toBe('E_RECORD_NOT_FOUND');
	});
});

describe('金口诀按用户报的地分建事盘', ()=>{
	const { INPUT_CASTABLE, CAST_SPECS } = require('../aiTools/divinationCast');
	test('登记在按结果建事盘的类型里;地分换算与金口诀页同一函数', async ()=>{
		expect(INPUT_CASTABLE).toContain('jinkou');
		const bad = await CAST_SPECS.jinkou.build({}, {});
		expect(bad).toMatchObject({ ok: false, code: 'E_ARGS_INVALID' });
		const bad2 = await CAST_SPECS.jinkou.build({ diFen: '甲' }, {});
		expect(bad2.ok).toBe(false);
		const src = fs.readFileSync(path.resolve(__dirname, '../aiTools/divinationCast.js'), 'utf8');
		expect(src).toContain("calc.resolveDiFenBySource(inputs.method, inputs.value)");
	});
});

describe('问测人出生 → 行年 / 本命', ()=>{
	const { querentRunYearOf } = require('../aiAnalysisContext/regenCase');
	test('年差法行年与页面兜底同一函数;本命支按出生公历年;已有存档行年不覆盖;没给不产生', ()=>{
		const rec = { divTime: '2026-11-13 10:24:00', zone: '+08:00' };
		const m = querentRunYearOf(rec, { querentBirth: '1990-05-06' });
		expect(m.runyear).toMatchObject({ age: 36, year: expect.any(String) });
		expect(m.runyear.birthGanZi).toBe('庚午');
		expect(m.benmingZhi).toBe('午');
		expect(m.xingnianZhi).toBe(m.runyear.year.charAt(1));
		const f = querentRunYearOf(rec, { querentBirth: '1990-05-06', querentGender: 'female' });
		expect(f.runyear.year).not.toBe(m.runyear.year);   // 男顺女逆
		expect(querentRunYearOf(rec, {})).toBeNull();
		expect(querentRunYearOf(rec, { querentBirth: '1990-05-06', runyear: { year: '甲子' } })).toBeNull();
	});
	test('六壬 / 金口诀挂载设置有问测人两项;金口诀重算把行年交给正文', ()=>{
		['liureng', 'jinkou'].forEach((k)=>{ const names = getTechniqueSettingsSchema(k).fields.map((x)=>x.name); expect(names).toEqual(expect.arrayContaining(['querentBirth', 'querentGender'])); });
		const rd = fs.readFileSync(path.resolve(__dirname, '../aiAnalysisContext/regenDivination.js'), 'utf8');
		expect(rd).toContain('(payload && payload.runyear) || null,');
	});
});
