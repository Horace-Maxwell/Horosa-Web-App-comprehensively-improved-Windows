// 外部智能体 / AI 挂载可指定的范围与参数(此前只是页面上的查询输入,无头恒取页面缺省那一份):
// 星历区间 · 回归轴起年与年数 · 多重回归星体与回数 · 七政流年时刻 · 变换盘 / 黄道制单次覆盖 · 挂载面隐藏项。
import { ephemerisWindowFromOptions } from '../../components/astro/AstroEphemeris';
import { paramsWithMoiraTransit } from '../../components/guolao/main/params';
import { resolveGuolaoFields } from '../aiAnalysisContext/regenChart';
import { transformSettingsFor, zodiacSettingsFor, TRANSFORM_PAGE_SETTINGS, ZODIAC_PAGE_SETTINGS } from '../transformCharts';
import { derivedOverrideFor } from '../aiAnalysisContext/derivedLabsHeadless';
import { describeFacet } from '../aiTools/settingsFacets';
import { getTechniqueSettingsSchema, pruneOptionsToNonDefault, effectiveMountBaseline } from '../techniqueMountSettings';

const fs = require('fs');
const path = require('path');
const RECORD = { birth: '1989-05-06 07:08:00', zone: '+08:00', lat: '31n14', lon: '121e28', gender: 0, name: '甲' };

beforeEach(()=>{ window.localStorage.clear(); });

describe('星历区间', ()=>{
	test('只给起始日 = 起始日起 90 天;两个都给照给;只给结束日只定结束日;都不给 = 空(交给页面缺省)', ()=>{
		expect(ephemerisWindowFromOptions('2000-01-01', '')).toEqual({ startDate: '2000-01-01', endDate: '2000-03-31' });
		expect(ephemerisWindowFromOptions('2000/1/1', '2000-02-15')).toEqual({ startDate: '2000-01-01', endDate: '2000-02-15' });
		expect(ephemerisWindowFromOptions('', '2030-12-31')).toEqual({ endDate: '2030-12-31' });
		expect(ephemerisWindowFromOptions(undefined, undefined)).toEqual({});
	});
	test('结束日早于起始日 / 认不出的日期:当没给那一个', ()=>{
		expect(ephemerisWindowFromOptions('2000-01-01', '1999-01-01')).toEqual({ startDate: '2000-01-01', endDate: '2000-03-31' });
		expect(ephemerisWindowFromOptions('abc', '2000-13-45')).toEqual({});
		expect(ephemerisWindowFromOptions('2000-02-30', '')).toEqual({});
	});
});

describe('三项范围设置进了挂载设置,缺省 = 此前那一份', ()=>{
	test('字段在位;缺省值经剪枝为空(不产生覆盖)', ()=>{
		const want = { ephemeris: ['ephStartDate', 'ephEndDate'], returntimeline: ['rtStartYear', 'rtCount'], extrareturns: ['erBodies', 'erCount'] };
		Object.keys(want).forEach((k)=>{
			const sch = getTechniqueSettingsSchema(k);
			expect(sch.kind).toBe('record');
			expect(sch.fields.map((f)=>f.name)).toEqual(want[k]);
			const defaults = {}; sch.fields.forEach((f)=>{ defaults[f.name] = f.default; });
			expect(pruneOptionsToNonDefault(k, defaults, effectiveMountBaseline(k, RECORD))).toEqual({});
		});
		expect(getTechniqueSettingsSchema('extrareturns').fields[0].default).toEqual(['Saturn', 'Jupiter', 'Node']);
		expect(getTechniqueSettingsSchema('extrareturns').fields[1].default).toBe(5);
		expect(getTechniqueSettingsSchema('returntimeline').fields[1].default).toBe(12);
	});
	test('复算入口把记录上的键交给各自的构建函数(星历区间 / 回归轴起年年数 / 多重回归星体回数)', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '../aiAnalysisContext/regenChart.js'), 'utf8');
		expect(src).toContain('ephemerisWindowFromOptions(record.ephStartDate, record.ephEndDate)');
		expect(src).toContain('record.rtStartYear');
		expect(src).toContain('{ bodies: record.erBodies, count: record.erCount }');
	});
});

describe('七政流年时刻', ()=>{
	test('🔴 无头复算把流年时刻与流年盘交给规则层(此前给的是 null,流年流曜段写成了出生年)', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '../../components/guolao/main/snapshot.js'), 'utf8');
		expect(src).toContain('params, chartObj: display, transitParams, transitChartObj: transitObj,');
		expect(src).not.toContain('transitParams: null, transitChartObj: null');
	});
	test('记录上的 guolaoTransitDate / guolaoTransitTime → 构参的流年日期与时刻;没给日期 = 不带(走此刻)', ()=>{
		const f1 = resolveGuolaoFields({ ...RECORD, guolaoTransitDate: '2030-06-01', guolaoTransitTime: '09:30' });
		expect(f1.moiraTransitAt.value).toEqual({ date: '2030/06/01', time: '09:30:00' });
		const p1 = paramsWithMoiraTransit(f1, null);
		expect(p1.date).toBe('2030/06/01');
		expect(p1.time).toBe('09:30:00');
		expect(p1.predictive).toBe(1);
		expect(resolveGuolaoFields({ ...RECORD, guolaoTransitDate: '2030/6/1' }).moiraTransitAt.value).toEqual({ date: '2030/06/01', time: '12:00:00' });
		const f0 = resolveGuolaoFields(RECORD);
		expect(f0.moiraTransitAt).toBeUndefined();
		// 没带的:流年 = 此刻(年份 = 今年,而不是出生年)
		expect(Number(`${paramsWithMoiraTransit(f0, null).date}`.slice(0, 4))).toBe(new Date().getFullYear());
		// 只给时刻不给日期、坏日期:都当没给
		expect(resolveGuolaoFields({ ...RECORD, guolaoTransitTime: '09:30' }).moiraTransitAt).toBeUndefined();
		expect(resolveGuolaoFields({ ...RECORD, guolaoTransitDate: 'xx' }).moiraTransitAt).toBeUndefined();
	});
	test('页面显式给的流年时刻优先于记录上的那一个(页面行为不变)', ()=>{
		const f = resolveGuolaoFields({ ...RECORD, guolaoTransitDate: '2030-06-01' });
		const tm = { format: (x)=>(x === 'YYYY/MM/DD' ? '2040/01/02' : '03:04:05'), ad: 1, zone: '+08:00' };
		expect(paramsWithMoiraTransit(f, tm).date).toBe('2040/01/02');
	});
});

describe('变换盘 / 黄道制单次覆盖', ()=>{
	test('记录上的键叠在辅盘页保存值之上;不认的值丢掉;与保存值相同不算覆盖;不写回页面设置', ()=>{
		const page = TRANSFORM_PAGE_SETTINGS.load();
		expect(transformSettingsFor({}, page)).toEqual({ settings: page, overridden: false });
		expect(transformSettingsFor({ transformKind: page.kind }, page).overridden).toBe(false);
		const r = transformSettingsFor({ transformKind: 'superimposed', transformPlanet: 'Venus', transformShift: 1, transformHouse: '4', transformVariant: 'classic' }, page);
		expect(r.overridden).toBe(true);
		expect(r.settings).toMatchObject({ kind: 'superimposed', planet: 'Venus', shift: true, house: 4, variant: 'classic' });
		expect(transformSettingsFor({ transformKind: 'bogus', transformPlanet: 'Chiron', transformHouse: 13 }, page)).toEqual({ settings: page, overridden: false });
		expect(TRANSFORM_PAGE_SETTINGS.load()).toEqual(page);
		const z = ZODIAC_PAGE_SETTINGS.load();
		expect(zodiacSettingsFor({ zodiacVersion: 'z13iau' }, z)).toEqual({ settings: { ...z, version: 'z13iau' }, overridden: true });
		expect(zodiacSettingsFor({ zodiacVersion: 'nope' }, z).overridden).toBe(false);
	});
	test('有生效覆盖 → 要现算(不用辅盘页已存的那张);没有 → null', ()=>{
		expect(derivedOverrideFor('transformchart', {})).toBeNull();
		expect(derivedOverrideFor('transformchart', { transformKind: 'antiscia' })).toBeTruthy();
		expect(derivedOverrideFor('zodiacsystems', { zodiacVersion: 'z13iau' })).toBeTruthy();
		expect(derivedOverrideFor('zodiacsystems', { zodiacVersion: ZODIAC_PAGE_SETTINGS.load().version })).toBeNull();
		expect(derivedOverrideFor('harmonic', { transformKind: 'antiscia' })).toBeNull();
	});
	test('挂载设置:只在用得到的变换下才显示基准星 / 宫位同转 / 对应宫头 / 口径', ()=>{
		const d = describeFacet('mount', 'transformchart');
		expect(d.ok).toBe(true);
		const shown = d.items.map((i)=>i.key);
		const hidden = (d.hiddenItems || []).map((i)=>i.key);
		expect(shown).toContain('transformKind');
		expect([...shown, ...hidden].sort()).toEqual(['transformHouse', 'transformKind', 'transformPlanet', 'transformShift', 'transformVariant']);
		// 缺省变换(倒置盘)只用得到「口径」
		expect(shown).toContain('transformVariant');
		expect(hidden).toEqual(expect.arrayContaining(['transformPlanet', 'transformShift', 'transformHouse']));
	});
});

describe('挂载面:此刻不显示的项也列出来,并写明由谁决定', ()=>{
	test('黄道星释逐层序号由输出层级决定;没有隐藏项的技法不带这个键', ()=>{
		const zr = describeFacet('mount', 'zodialrelease');
		const byKey = {}; (zr.hiddenItems || []).forEach((h)=>{ byKey[h.key] = h; });
		expect(Object.keys(byKey)).toEqual(expect.arrayContaining(['aiL1Idx', 'aiL2Idx', 'aiL3Idx']));
		expect(byKey.aiL1Idx.controlledBy).toEqual(['aiMode']);
		expect(byKey.aiL1Idx.label).toBeTruthy();
		// 列出来的隐藏项不与可见项重复
		zr.items.forEach((it)=>expect(byKey[it.key]).toBeUndefined());
		const h = describeFacet('mount', 'harmonic');
		expect(h.items.map((i)=>i.key)).toEqual(['harmonic']);
		expect(h.hiddenItems).toBeUndefined();
	});
});
