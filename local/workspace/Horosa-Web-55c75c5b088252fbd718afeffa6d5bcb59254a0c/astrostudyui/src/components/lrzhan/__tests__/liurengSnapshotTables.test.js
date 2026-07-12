// 大六壬 AI 快照段·表化「值不变」证明：改后(工作树)builder 实跑 vs 改前(HEAD)基线，逐段等价。
//
// 基线纯度=证明命根：fixtures/liurengSnapshotBaseline.json 由 HEAD(改前)版函数抓出(见提交说明/临时抓取器，
// 已删)，绝非工作树已改版本。本测试只导入改后 builder，与该冻结基线比对。
//
// 等价判据(任选其一按段形态)：
//  · fact-multiset —— 用 token 正则 /[一-龥A-Za-z0-9~+.]+/g 取词袋，剔「表头词」后多重集相等。
//    表化仅把「键：值」行改成「| 键 | 值 |」并把标签移进表头，数据 token 及重数逐一守恒 ⇒ 词袋相等。
//  · 关系行元组集合 —— 段有「表头去内联标签后仍非 1:1」或「序号标点差异」时改用元组集(如 [十二地盘…])。
import {
	buildLiuRengPanRows,
	buildLiuRengSanChuanRows,
	buildLiuRengSuiShaRows,
	buildLiuRengZhangShengRows,
	appendMapSection,
} from '../LiuRengMain';
import {
	LR_LAYOUT, LR_SANCHUAN, LR_MAP_OBJ, LR_YEARGODS, LR_ZS_ELEM, LR_MAP_TITLE,
} from './fixtures/liurengSnapshotInputs';
import baseline from './fixtures/liurengSnapshotBaseline.json';

// 「表头词」并集：所有段的 GFM 表头单元格 + 旧行内联标签。均与任一段的真实数据值不相交（子表头 X.Y 逐一核过），
// 故剔除它们不误伤数据、又能吸收「行式→表格」的排版差（旧行内联标签与新表头都是这些词）。
const HEADER_WORDS = new Set([
	'序', '地盘', '天盘', '贵神', '传', '干支', '六亲', '神煞', '值', '长生位', '地支',
]);

function factMultiset(input){
	const text = Array.isArray(input) ? input.join('\n') : String(input);
	const toks = text.match(/[一-龥A-Za-z0-9~+.]+/g) || [];
	const m = new Map();
	toks.forEach((t)=>{
		if(HEADER_WORDS.has(t)){ return; }
		m.set(t, (m.get(t) || 0) + 1);
	});
	// 稳定可比形态：按 token 排序的 "token×count" 数组。
	return Array.from(m.entries()).sort((a, b)=>(a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([t, c])=>`${t}×${c}`);
}

// [十二地盘/十二天盘/十二贵神对应]：旧「N. 地盘X -> 天盘Y -> 贵神Z」序号带「.」与新「| N | …」序号裸数字在
// 该 token 正则下不同形 ⇒ 改用 (序,地盘,天盘,贵神) 元组集合，序号按整数归一。
function newPanTuples(rows){
	return rows.slice(2).map((l)=>{
		const c = l.split('|').map((s)=>s.trim());
		return [String(Number(c[1])), c[2], c[3], c[4]].join('┃');
	}).sort();
}
function oldPanTuples(lines){
	return lines.map((l)=>{
		const m = l.match(/^(\d+)\.\s*地盘(.+?)\s*->\s*天盘(.+?)\s*->\s*贵神(.+)$/);
		return [String(Number(m[1])), m[2], m[3], m[4]].join('┃');
	}).sort();
}

describe('大六壬 AI 快照段·表化「值不变」证明（改后 builder vs HEAD 基线）', ()=>{
	test('[十二地盘/十二天盘/十二贵神对应] 元组集合守恒 + 输出为 GFM 4 列表', ()=>{
		const rows = buildLiuRengPanRows(LR_LAYOUT);
		expect(rows[0]).toBe('| 序 | 地盘 | 天盘 | 贵神 |');
		expect(rows[1]).toBe('| --- | --- | --- | --- |');
		expect(newPanTuples(rows)).toEqual(oldPanTuples(baseline.lr_pan));
	});

	test('[三传] 三行 fact-multiset 守恒 + GFM 4 列表', ()=>{
		const rows = buildLiuRengSanChuanRows(LR_SANCHUAN);
		expect(rows[0]).toBe('| 传 | 干支 | 六亲 | 贵神 |');
		expect(factMultiset(rows)).toEqual(factMultiset(baseline.lr_sanchuan));
	});

	test('神煞段 appendMapSection([旬日]) fact-multiset 守恒 + GFM 2 列表（段头保留独占行）', ()=>{
		const lines = [];
		appendMapSection(lines, LR_MAP_TITLE, LR_MAP_OBJ);
		expect(lines[0]).toBe(`[${LR_MAP_TITLE}]`);
		expect(lines).toContain('| 神煞 | 值 |');
		expect(factMultiset(lines)).toEqual(factMultiset(baseline.lr_map));
	});

	test('[岁煞] fact-multiset 守恒 + GFM 2 列表', ()=>{
		const rows = buildLiuRengSuiShaRows(LR_YEARGODS);
		expect(rows[0]).toBe('| 神煞 | 值 |');
		expect(factMultiset(rows)).toEqual(factMultiset(baseline.lr_suisha));
	});

	test('[十二长生] fact-multiset 守恒 + GFM 2 列表', ()=>{
		const rows = buildLiuRengZhangShengRows(LR_ZS_ELEM);
		expect(rows[0]).toBe('| 长生位 | 地支 |');
		expect(factMultiset(rows)).toEqual(factMultiset(baseline.lr_zhangsheng));
	});
});
