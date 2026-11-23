// 量化盘图形星历段:与页面「图形星历」同一取数与同一组本命参考线;交点 = 行运折叠线与本命水平线相交(日内插值);
// 区间起止都给才出,超过 366 天截到起点后 366 天;无交点也出段说明。
import { graphicEphemerisCrossings } from '../UranianGraphicEphemeris';
import { graphicEphemerisText, gephemRangeOf } from '../AstroMidpoint';
import { getTechniqueSettingsSchema } from '../../../utils/techniqueMountSettings';

const rowsOf = (lons, startDay = 1)=>lons.map((lon, i)=>({ date: `2026-01-${String(startDay + i).padStart(2, '0')}`, positions: { Saturn: { lon } } }));

test('过零即一次接触,日内插值;跨折叠界的跳变不算;角距按盘基取整;逆行标注', ()=>{
	// 本命太阳 100°;行运土星从 8 → 12(90° 盘折叠后 8→12,本命 100 折叠 = 10):第 2→3 日之间过 10
	const hits = graphicEphemerisCrossings(rowsOf([8, 9, 11, 12]), ['Saturn'], [{ id: 'Sun', lon: 100 }], 90);
	expect(hits.length).toBe(1);
	expect(hits[0]).toMatchObject({ planet: 'Saturn', natal: 'Sun', fromDate: '2026-01-02', aspect: 270, retro: false });
	expect(hits[0].frac).toBeCloseTo(0.5, 5);
	// 逆行:12 → 8 过 10
	const back = graphicEphemerisCrossings(rowsOf([12, 11, 9, 8]), ['Saturn'], [{ id: 'Sun', lon: 100 }], 90);
	expect([back.length, back[0].retro]).toEqual([1, true]);
	// 跨 0/90 折叠界(89 → 1)本身不是接触
	expect(graphicEphemerisCrossings(rowsOf([88, 89.5, 1, 2]), ['Saturn'], [{ id: 'Sun', lon: 145 }], 90).length).toBe(0);
});

test('段文本:日期按内插取整日、带角距与逆行;无交点也出段;区间合法性与 366 天截断', ()=>{
	const t = graphicEphemerisText(rowsOf([8, 9, 11, 12]), ['Saturn'], [{ id: 'Sun', lon: 100 }], 90, { start: '2026-01-01', end: '2026-01-04', truncated: false }).split('\n');
	expect(t[0]).toBe('[图形星历]');
	expect(t[2]).toMatch(/2026-01-0[23] 行运 .+ 270° 本命 /);
	expect(graphicEphemerisText(rowsOf([1, 2]), ['Saturn'], [{ id: 'Sun', lon: 50 }], 90, { start: 'a', end: 'b' })).toContain('无交点');
	expect(gephemRangeOf({ ephemStart: '2026-01-01' })).toBe(null);
	expect(gephemRangeOf({ ephemStart: '2026-03-01', ephemEnd: '2026-01-01' })).toBe(null);
	expect(gephemRangeOf({ ephemStart: '2026-01-01', ephemEnd: '2026-06-30' })).toEqual({ start: '2026-01-01', end: '2026-06-30', truncated: false });
	expect(gephemRangeOf({ ephemStart: '2026-01-01', ephemEnd: '2028-01-01' })).toEqual({ start: '2026-01-01', end: '2027-01-02', truncated: true });
});

test('挂载 schema:图形星历起止缺省空(不出段),止点只在给了起点后显示', ()=>{
	const f = (getTechniqueSettingsSchema('germany') || {}).fields || [];
	const s = f.find((x)=>x.name === 'ephemStart');
	const e = f.find((x)=>x.name === 'ephemEnd');
	expect([s && s.default, e && e.default]).toEqual(['', '']);
	expect(e.showWhen({})).toBe(false);
	expect(e.showWhen({ ephemStart: '2026-01-01' })).toBe(true);
});
