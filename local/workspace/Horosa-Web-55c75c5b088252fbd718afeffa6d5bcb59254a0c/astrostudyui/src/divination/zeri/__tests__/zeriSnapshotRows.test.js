// [Q-452 裁决 A / Q-453 裁决 2026-09-18] 择日快照命中清单:上限全局可配 + 前 N 行判读树 + 奇门行时长。
import { appendZeriHitRows, buildZeriRowExplainLines, zeriRowDurationMin, collectZeriUiLeaves } from '../zeriExplainText';
import { normalizeZeriSnapshotMaxRows, normalizeZeriSnapshotExplainRows, readGlobalZeriSnapshotMaxRows, readGlobalZeriSnapshotExplainRows } from '../../../utils/zeriSnapshotPrefs';
import { buildBaziZeriSnapshotExtra } from '../baziZeriSnapshot';
import { buildQimenZeriSnapshotExtra } from '../qimenZeriSnapshot';

const rowsOf = (n)=>Array.from({ length: n }, (_, i)=>({ start: `2026-10-0${(i % 9) + 1} 0${i % 10}:00`, end: `2026-10-0${(i % 9) + 1} 0${i % 10}:30`, durationMin: 30, juText: `局${i + 1}` }));
const UI_TREE = { kind: 'group', joiner: 'all', children: [
	{ kind: 'leaf', type: 'x', params: {} },
	{ kind: 'group', joiner: 'any', children: [{ kind: 'leaf', type: 'y', params: {}, negate: true }] },
] };
const EXPLAIN = { tree: { kind: 'group', op: 'all', pass: true, children: [
	{ kind: 'leaf', type: 'x', actual: '甲子', pass: true },
	{ kind: 'group', op: 'any', pass: true, children: [{ kind: 'leaf', type: 'y', actual: '无', pass: true }] },
] } };
const leafSummary = (ui)=>`设定-${ui.type}`;

describe('zeriSnapshotPrefs 归一化 / 全局直读', ()=>{
	it('缺省 60 / 3;越界夹到 [10,500] / [0,20];非法回缺省', ()=>{
		expect(normalizeZeriSnapshotMaxRows(undefined)).toBe(60);
		expect(normalizeZeriSnapshotMaxRows('')).toBe(60);
		expect(normalizeZeriSnapshotMaxRows(5)).toBe(10);
		expect(normalizeZeriSnapshotMaxRows(9999)).toBe(500);
		expect(normalizeZeriSnapshotMaxRows('120.7')).toBe(120);
		expect(normalizeZeriSnapshotExplainRows(undefined)).toBe(3);
		expect(normalizeZeriSnapshotExplainRows(0)).toBe(0);
		expect(normalizeZeriSnapshotExplainRows(99)).toBe(20);
		expect(normalizeZeriSnapshotExplainRows('abc')).toBe(3);
	});
	it('globalSetup 缺键 → 缺省;有键 → 归一化后取用', ()=>{
		localStorage.removeItem('globalSetup');
		expect(readGlobalZeriSnapshotMaxRows()).toBe(60);
		expect(readGlobalZeriSnapshotExplainRows()).toBe(3);
		localStorage.setItem('globalSetup', JSON.stringify({ zeriSnapshotMaxRows: 15, zeriSnapshotExplainRows: 0 }));
		expect(readGlobalZeriSnapshotMaxRows()).toBe(15);
		expect(readGlobalZeriSnapshotExplainRows()).toBe(0);
		localStorage.removeItem('globalSetup');
	});
});

describe('appendZeriHitRows', ()=>{
	afterEach(()=>{ localStorage.removeItem('globalSetup'); });
	it('缺省上限 60:61 行只列 60 + 尾句(cap 入句);截断句照加', ()=>{
		const lines = [];
		appendZeriHitRows(lines, rowsOf(61), { formatRow: (r, i)=>`${i + 1}. ${r.start}`, tail: (t, c)=>`…共 ${t} 段(仅列前 ${c})`, truncated: true, truncatedText: '(截断)', explainRows: 0 });
		expect(lines.length).toBe(62);
		expect(lines[59]).toMatch(/^60\. /);
		expect(lines[60]).toBe('…共 61 段(仅列前 60)');
		expect(lines[61]).toBe('(截断)');
	});
	it('全局设置 zeriSnapshotMaxRows=15 生效;显式 maxRows 覆盖全局', ()=>{
		localStorage.setItem('globalSetup', JSON.stringify({ zeriSnapshotMaxRows: 15, zeriSnapshotExplainRows: 0 }));
		const a = []; appendZeriHitRows(a, rowsOf(20), { formatRow: (r, i)=>`${i + 1}`, tail: (t, c)=>`tail ${c}` });
		expect(a.length).toBe(16); expect(a[15]).toBe('tail 15');
		const b = []; appendZeriHitRows(b, rowsOf(20), { formatRow: (r, i)=>`${i + 1}`, tail: (t, c)=>`tail ${c}`, maxRows: 12 });
		expect(b.length).toBe(13); expect(b[12]).toBe('tail 12');
	});
	it('前 N 行附判读树:组门 + 设定(按 UI 叶 DFS 配对,取反标注)→ 实际 ✓/✗;第 N+1 行不附;explainAt 抛错 / 返 Promise 不附', ()=>{
		const lines = [];
		let calls = 0;
		appendZeriHitRows(lines, rowsOf(5), { formatRow: (r, i)=>`${i + 1}`, explainRows: 2, uiTree: UI_TREE, leafSummary,
			explainAt: (r, i)=>{ calls += 1; return i === 1 ? Promise.resolve(EXPLAIN) : EXPLAIN; } });
		expect(calls).toBe(2);
		expect(lines[0]).toBe('1');
		expect(lines[1]).toBe('   判读:');
		expect(lines[2]).toBe('     且(全部满足) ✓');
		expect(lines[3]).toBe('       · 设定 设定-x → 实际 甲子 ✓');   // 叶比所属组门深一级
		expect(lines[4]).toBe('       或(任一满足) ✓');
		expect(lines[5]).toBe('         · 设定 设定-y(取反) → 实际 无 ✓');
		expect(lines[6]).toBe('2');   // Promise 结果不等 → 不附
		expect(lines[7]).toBe('3');
		expect(lines.length).toBe(10);
		const bad = []; appendZeriHitRows(bad, rowsOf(1), { formatRow: ()=>'r', explainRows: 1, explainAt: ()=>{ throw new Error('x'); } });
		expect(bad).toEqual(['r']);
		expect(buildZeriRowExplainLines({ tree: null, err: 'no_pan' }, UI_TREE, leafSummary)).toEqual(['   判读:(不可得 no_pan)']);
		expect(buildZeriRowExplainLines(null, UI_TREE, leafSummary)).toEqual([]);
		expect(collectZeriUiLeaves(UI_TREE, []).map((l)=>l.type)).toEqual(['x', 'y']);
	});
});

describe('builders 接线', ()=>{
	afterEach(()=>{ localStorage.removeItem('globalSetup'); });
	it('奇门命中行补时长(start/end 相减;有 durationMin 优先)', ()=>{
		expect(zeriRowDurationMin({ start: '2026-05-15 00:00', end: '2026-05-15 01:00' })).toBe(60);
		expect(zeriRowDurationMin({ start: '2026-05-15 23:00', end: '2026-05-16 01:00' })).toBe(120);
		expect(zeriRowDurationMin({ start: '2026-05-15 00:00', end: '2026-05-15 01:00', durationMin: 45.4 })).toBe(45);
		expect(zeriRowDurationMin({ start: 'x', end: 'y' })).toBe(null);
		const text = buildQimenZeriSnapshotExtra({ cfg: null, geo: null, options: null, tree: null, results: [{ start: '2026-05-15 00:00', end: '2026-05-15 02:00', juText: '阳遁一局' }], truncated: false, explainRows: 0 });
		expect(text).toContain('1. 2026-05-15 00:00 ~ 2026-05-15 02:00(120分)　阳遁一局');
	});
	it('八字 builder:explainAt 给前 N 行附判读树;缺 explainAt 只列清单(字节同旧)', ()=>{
		const base = { cfg: null, geo: null, natal: null, tree: UI_TREE, results: rowsOf(2).map((r)=>({ ...r, pillarText: '甲子' })), truncated: false };
		const plain = buildBaziZeriSnapshotExtra({ ...base });
		expect(plain).toContain('1. 2026-10-01 00:00 ~ 2026-10-01 00:30(30分) 甲子');
		expect(plain).not.toContain('判读:');
		const withExplain = buildBaziZeriSnapshotExtra({ ...base, explainRows: 1, explainAt: ()=>EXPLAIN });
		expect(withExplain).toContain('   判读:');
		expect(withExplain.split('判读:').length).toBe(2);
	});
});
