// 东亚诸术快照:段头与导出段表逐字一致;有本命盘才出易卦星盘;页面字段与无头挂载同一入参。
import moment from 'moment';
import { buildEastAsiaModel, buildEastAsiaSnapshotText, eastAsiaParamsFromFields, EAST_ASIA_SNAPSHOT_SECTIONS, EAST_ASIA_TABS, tibetanDateText, geoChangeFieldsPatch } from '../eastAsiaSnapshot';
import { AI_EXPORT_PRESET_SECTIONS } from '../aiExport/presets';

const PARAMS = { date: '1975/02/10', time: '21:15:00', zone: '-08:00', lat: '47n36', lon: '122w20', gender: 0 };
const NOW = Date.UTC(2026, 10, 7, 12);
const CHART = { chart: { objects: [
	{ id: 'Sun', lon: 321.6, house: 'House5' }, { id: 'Moon', lon: 120.2, house: 'House11' }, { id: 'Mercury', lon: 300.1, house: 'House4' },
	{ id: 'Venus', lon: 352.3, house: 'House6' }, { id: 'Mars', lon: 291.9, house: 'House4' }, { id: 'Jupiter', lon: 6.4, house: 'House7' },
	{ id: 'Saturn', lon: 90.2, house: 'House10' }, { id: 'Uranus', lon: 211.0, house: 'House1' },
] } };

describe('东亚诸术快照', ()=>{
	it('段头与导出段表逐字一致', ()=>{
		expect(AI_EXPORT_PRESET_SECTIONS.dongya).toEqual(EAST_ASIA_SNAPSHOT_SECTIONS);
		const text = buildEastAsiaSnapshotText(PARAMS, CHART, {}, NOW);
		const heads = (text.match(/^\[([^\]]+)\]$/gm) || []).map((x)=>x.slice(1, -1));
		expect(heads).toEqual(EAST_ASIA_SNAPSHOT_SECTIONS);
	});
	it('有本命盘出七政的卦,没有时说明未出', ()=>{
		const withChart = buildEastAsiaSnapshotText(PARAMS, CHART, {}, NOW);
		expect(withChart).toContain('太阳(乾)');
		expect(withChart).not.toContain('天王星');
		expect(buildEastAsiaSnapshotText(PARAMS, null, {}, NOW)).toContain('易卦星盘未出');
	});
	it('出生 1975-02-10 在藏历新年(2 月 11 日)前一天:仍是木阳虎年;年支按立春已是卯', ()=>{
		const model = buildEastAsiaModel(PARAMS, CHART, {}, NOW);
		expect(model.tibetan.year).toMatchObject({ element: '木', animal: '虎', male: true });
		expect(model.tibetan.date).toMatchObject({ year: 1974, month: 12 });
		expect(model.male).toBe(false);
		expect(model.parkha.age).toBe(model.flowYear - model.tibetan.date.year + 1);
		expect(model.zurkhai.yearZhi).toBe('卯');
	});
	it('合卦规则随设置变', ()=>{
		const a = buildEastAsiaModel(PARAMS, CHART, { ichingMerge: 'upper' }, NOW).iching.rows;
		const b = buildEastAsiaModel(PARAMS, CHART, { ichingMerge: 'lower' }, NOW).iching.rows;
		expect(a.every((r)=>r.toUpper)).toBe(true);
		expect(b.every((r)=>!r.toUpper)).toBe(true);
	});
	it('藏干表随设置变(通行版 / 法诀版)', ()=>{
		const a = buildEastAsiaModel(PARAMS, null, { fenyeVersion: 'common' }, NOW).sanmei.hidden;
		const b = buildEastAsiaModel(PARAMS, null, { fenyeVersion: 'fajue' }, NOW).sanmei.hidden;
		expect(a[1].ruler).toBe('戊');          // 寅月节后第 6 日:通行版余气戊,法诀版余气己
		expect(b[1].ruler).toBe('己');
		expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
	});
	it('流年可指定', ()=>{
		const m = buildEastAsiaModel(PARAMS, null, { flowYear: 2030 }, NOW);
		expect(m.flowYear).toBe(2030);
		expect(m.loshu[0].year).toBe(2030);
	});
	it('页面字段换成入参', ()=>{
		const dt = moment('1975-02-10 21:15:00');
		dt.zone = '-08:00';
		dt.ad = 1;
		const p = eastAsiaParamsFromFields({ date: { value: dt }, time: { value: dt }, lat: { value: '47n36' }, lon: { value: '122w20' }, gender: { value: 0 } });
		expect(p).toMatchObject({ date: '1975/02/10', time: '21:15:00', zone: '-08:00', gender: '0' });
	});
	it('藏历日期「年」后有空格:2026 年 9 月 29 日', ()=>{
		expect(tibetanDateText({ year: 2026, month: 9, day: 29 })).toBe('2026 年 9 月 29 日');
		expect(tibetanDateText({ year: 2026, month: 9, day: 29, leap: true })).toBe('2026 年 闰9 月 29 日');
		expect(buildEastAsiaSnapshotText(PARAMS, null, {}, NOW)).toMatch(/出生藏历:1974 年 12 月/);
	});
	it('「今年」按盘时区取:东八区元旦凌晨 1 点(UTC 仍是前一年)洛书 / 天中杀已是新年', ()=>{
		const nowUtcNewYearEve = Date.UTC(2025, 11, 31, 17, 0);   // = 2026-01-01 01:00 +08:00
		const cn = buildEastAsiaModel({ ...PARAMS, zone: '+08:00', lon: '116e23', lat: '39n54' }, null, {}, nowUtcNewYearEve);
		expect(cn.loshu[0].year).toBe(2026);
		const us = buildEastAsiaModel(PARAMS, null, {}, nowUtcNewYearEve);   // 西八区此刻是 12-31 09:00
		expect(us.loshu[0].year).toBe(2025);
	});
	it('流年早于出生:不悄悄按一岁算八卦,不出负岁洛书', ()=>{
		const m = buildEastAsiaModel(PARAMS, null, { flowYear: 1900 }, NOW);
		expect(m.parkha.age).toBeLessThan(1);
		expect(m.parkha.year).toBeNull();
		expect(m.loshu[0].beforeBirth).toBe(true);
		const text = buildEastAsiaSnapshotText(PARAMS, null, { flowYear: 1900 }, NOW);
		expect(text).toContain('1900 年早于出生');
		expect(text).not.toMatch(/-\d+ 岁/);
	});
	it('公元 500 年出生:胜生周写「早于胜生周纪年」,不出负数周', ()=>{
		const text = buildEastAsiaSnapshotText({ ...PARAMS, date: '0500/03/01' }, null, {}, NOW);
		expect(text).toContain('早于胜生周纪年');
		expect(text).not.toMatch(/第 -\d+ 胜生周/);
	});
	it('算命学「元」列用初元 / 中元 / 本元', ()=>{
		const h = buildEastAsiaModel(PARAMS, null, {}, NOW).sanmei.hidden;
		h.forEach((x)=>expect(['初元', '中元', '本元']).toContain(x.rulerPos));
	});
	it('日命星与风水日紫白同源:2026-02-19 甲子 = 七赤(阳遁中元)', ()=>{
		const m = buildEastAsiaModel({ ...PARAMS, date: '2026/02/19', time: '12:00:00', zone: '+08:00', lon: '116e23', lat: '39n54' }, null, {}, NOW);
		expect(m.ninestar.nichimei).toBe(7);
		expect(m.ninestar.nichimeiDun).toBe('阳遁中元');
	});
	// 右栏页签 13px 字、间距 10:1440×900 窗口页签条宽 301,原六个全名合计 19 字约 344 放不下(「易卦星盘」收进「…」);
	// 15 字约 260,放得下(探针实量见修复报告)
	it('右栏页签短名一排放得下(每个 ≤ 4 字,合计 ≤ 15 字),全名留作悬停提示', ()=>{
		expect(EAST_ASIA_TABS.every((t)=>t.label.length <= 4 && t.full)).toBe(true);
		expect(EAST_ASIA_TABS.reduce((n, t)=>n + t.label.length, 0)).toBeLessThanOrEqual(15);
	});
	it('选地点 → 坐标 + 地名字段补丁', ()=>{
		const patch = geoChangeFieldsPatch({}, { lat: 39.9, lng: 116.4, gpsLat: 39.9, gpsLng: 116.4, name: '北京' });
		expect(patch.lon.value).toMatch(/116e/);
		expect(patch.lat.value).toMatch(/39n/);
		expect(patch.gpsLon.value).toBe(116.4);
		expect(geoChangeFieldsPatch({}, null)).toBeNull();
	});
});
