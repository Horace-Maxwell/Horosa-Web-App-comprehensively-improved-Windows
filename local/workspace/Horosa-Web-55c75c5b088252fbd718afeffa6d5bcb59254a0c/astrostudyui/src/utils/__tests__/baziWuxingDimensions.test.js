/**
 * 三维分列（得令/得地/得势）golden（八字大全 §9.1）。
 * 纯新增 dimensions 字段：既有 scores/percent/dayMaster 取值路径零变（本文件含键面锁）。
 */
import computeWuxingStrength from '../baziWuxing';
import { buildLocalBaziResult } from '../baziLunarLocal';

function stem(cell, element, relative){ return { cell, element, relative }; }

function baziAt(date, time){
	return buildLocalBaziResult({
		date, time, zone: '+08:00', lon: 113.0, gpsLon: 113.0, lat: 23.0, gpsLat: 23.0,
		gender: 1, timeAlg: 1,
	}).bazi;
}

describe('三维分列 · 集成（2026-06-22 18:00 丙午 甲午 丁卯 己酉）', () => {
	const stat = computeWuxingStrength(baziAt('2026-06-22', '18:00:00').fourColumns);
	const dim = stat.dimensions;

	test('得令：丁火生午月（夏）→ 旺 +40', () => {
		expect(dim.deLing.state).toBe('旺');
		expect(dim.deLing.score).toBe(40);
		expect(dim.deLing.got).toBe(true);
	});
	test('得地：年月两午皆丁之禄刃支（月支加倍）', () => {
		const byPillar = {};
		dim.deDi.roots.forEach((r) => { byPillar[r.pillar] = r; });
		expect(byPillar['年支']).toEqual({ pillar: '年支', branch: '午', type: '禄刃', score: 30 });
		expect(byPillar['月支']).toEqual({ pillar: '月支', branch: '午', type: '禄刃', score: 60 });
		expect(dim.deDi.roots.length).toBe(2); // 卯(木)酉(金)不载火根
		expect(dim.deDi.score).toBe(90);
	});
	test('得势：年丙(劫)+月甲(印)两透 → count 2 / +40', () => {
		expect(dim.deShi.count).toBe(2);
		expect(dim.deShi.score).toBe(40);
		const rels = dim.deShi.stems.map((s) => s.rel).sort();
		expect(rels).toEqual(['劫', '印']);
	});
	test('summary 三段拼接', () => {
		expect(dim.summary).toBe('得令(旺)·得地(2根)·得势(2透)');
	});
});

describe('三维分列 · 单元', () => {
	function mk(dayStem, monthBranch, extras){
		const base = {
			day: { stem: dayStem, branch: { cell: '子' }, stemInBranch: [] },
			month: { stem: stem('庚', 'Metal', '杀'), branch: { cell: monthBranch }, stemInBranch: [] },
			year: { stem: stem('庚', 'Metal', '杀'), branch: { cell: '申' }, stemInBranch: [] },
			time: { stem: stem('辛', 'Metal', '官'), branch: { cell: '酉' }, stemInBranch: [] },
		};
		return Object.assign(base, extras || {});
	}

	test('四季土：戊日辰月 → 土旺（非土日主辰月仍按春表）', () => {
		const earth = computeWuxingStrength(mk(stem('戊', 'Earth', '日元'), '辰'));
		expect(earth.dimensions.deLing.state).toBe('旺');
		const wood = computeWuxingStrength(mk(stem('甲', 'Wood', '日元'), '辰'));
		expect(wood.dimensions.deLing.state).toBe('旺'); // 春木旺
		const metal = computeWuxingStrength(mk(stem('庚', 'Metal', '日元'), '辰'));
		expect(metal.dimensions.deLing.state).toBe('囚'); // 春金囚
	});

	test('通根分级：本气库/长生/中气/余气 各归其档', () => {
		const four = {
			day: { stem: stem('甲', 'Wood', '日元'), branch: { cell: '辰' }, stemInBranch: [stem('戊', 'Earth', '财'), stem('乙', 'Wood', '劫'), stem('癸', 'Water', '印')] },
			month: { stem: stem('丙', 'Fire', '食'), branch: { cell: '亥' }, stemInBranch: [stem('壬', 'Water', '枭'), stem('甲', 'Wood', '比')] },
			year: { stem: stem('庚', 'Metal', '杀'), branch: { cell: '未' }, stemInBranch: [stem('己', 'Earth', '才'), stem('丁', 'Fire', '伤'), stem('乙', 'Wood', '劫')] },
			time: { stem: stem('辛', 'Metal', '官'), branch: { cell: '申' }, stemInBranch: [stem('庚', 'Metal', '杀'), stem('壬', 'Water', '枭'), stem('戊', 'Earth', '财')] },
		};
		const dim = computeWuxingStrength(four).dimensions;
		const byPillar = {};
		dim.deDi.roots.forEach((r) => { byPillar[r.pillar] = r; });
		expect(byPillar['日支'].type).toBe('中气');     // 辰中乙（位1，甲长生在亥非辰）
		expect(byPillar['月支'].type).toBe('长生');     // 亥=甲长生支（中气乙位…此处甲居位1→长生判定优先）
		expect(byPillar['月支'].score).toBe(30);        // 长生15 × 月支加倍
		expect(byPillar['年支'].type).toBe('余气');     // 未中乙（位2）
		expect(byPillar['时支']).toBeUndefined();       // 申不藏木
	});

	test('无根=虚浮：roots 空、summary 标不得地', () => {
		const dim = computeWuxingStrength(mk(stem('甲', 'Wood', '日元'), '酉')).dimensions;
		expect(dim.deDi.roots).toEqual([]);
		expect(dim.summary).toContain('不得地');
		expect(dim.summary).toContain('失令');
	});
});

describe('零回归：既有输出面不变', () => {
	test('返回键集 = 旧八键 + dimensions（不多不少）', () => {
		const stat = computeWuxingStrength(baziAt('2000-01-01', '12:00:00').fourColumns);
		expect(Object.keys(stat).sort()).toEqual(
			['cangVersion', 'dayMaster', 'dimensions', 'dominant', 'method', 'scores', 'total', 'weakest', 'weights'],
		);
	});
	test('scores/percent/dayMaster 数值与 dimensions 解耦（同盘重复调用逐字一致）', () => {
		const cols = baziAt('2026-06-22', '18:00:00').fourColumns;
		const a = computeWuxingStrength(cols);
		const b = computeWuxingStrength(cols);
		expect(JSON.stringify(a.scores)).toBe(JSON.stringify(b.scores));
		expect(a.dayMaster).toEqual(b.dayMaster);
	});
});
