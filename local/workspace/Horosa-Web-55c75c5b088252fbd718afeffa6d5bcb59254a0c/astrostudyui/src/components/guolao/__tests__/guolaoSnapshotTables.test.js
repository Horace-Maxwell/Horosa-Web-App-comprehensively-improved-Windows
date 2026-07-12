// 七政四余 AI 快照段·表化「值不变」证明：改后(工作树)builder 实跑 vs 改前(HEAD)基线，逐段等价。
//
// 基线纯度=证明命根：fixtures/guolaoSnapshotBaseline.json 由 HEAD(改前)版函数抓出(临时抓取器已删)，
// 绝非工作树已改版本。本测试只导入改后 builder，与该冻结基线比对。
//
// 等价判据(任选其一按段形态)：
//  · fact-multiset —— token 正则 /[一-龥A-Za-z0-9~+.]+/g 词袋，剔「表头词」后多重集相等([大限]/[相位]/[星曜庙旺…])。
//  · 关系行元组集合 —— [七政四余宫位与二十八宿星曜] 表化把宫名按宿行「反规格化」重复(旧格式宫名每宫仅一次)，
//    词袋重数天然不等 ⇒ 必须用 (宫,宿,星串) 元组集合比对。
//
// ⚠️ [星曜庙旺与星点动态] 的 31 golden(guolaoDignityMotion.test.js)锚的是底层算法值(庙旺/速度态)、与排版无关；
//    本证明另证「排版换了、值没换」，两者正交、都要绿。
import {
	buildGuolaoLimitSection,
	buildGuolaoAspectSection,
	buildHouseSuAndGodsSection,
	buildStarDignityMotionSection,
} from '../GuoLaoChartMain';
import {
	GL_LIMIT_CHART, GL_LIMIT_PARAMS, GL_ASPECT_RESULT, GL_HOUSESU_RESULT, GL_DIGNITY_RESULT,
} from './fixtures/guolaoSnapshotInputs';
import baseline from './fixtures/guolaoSnapshotBaseline.json';

// 表头词并集：所有段的 GFM 表头单元格 + 旧行内联标签(所属/速度)。与任一段真实数据值不相交，剔之吸收排版差、不误伤数据。
const HEADER_WORDS = new Set([
	'主体', '相位', '对象', '状态', '误差',
	'曜', '地支', '所属', '速度', '速度态',
	'限', '宫', '起讫岁', '起讫年', '年数', '吊度',
]);

function factMultiset(input){
	const text = Array.isArray(input) ? input.join('\n') : String(input);
	const toks = text.match(/[一-龥A-Za-z0-9~+.]+/g) || [];
	const m = new Map();
	toks.forEach((t)=>{
		if(HEADER_WORDS.has(t)){ return; }
		m.set(t, (m.get(t) || 0) + 1);
	});
	return Array.from(m.entries()).sort((a, b)=>(a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([t, c])=>`${t}×${c}`);
}

// [相位] 用元组集合：旧格式把 orb 粘成「误差2.535」整词(误差与数值间无分隔符 ⇒ 该 token 正则视作一 token)，
// 剔表头词无法拆开 ⇒ 词袋不适用。新表逐行 | 主体 | 相位 | 对象 | 状态 | 误差 |，旧行 = 主体 相位 对象（状态[，误差orb]）。
function newAspectTuples(text){
	return text.split('\n').slice(2).map((l)=>{
		const c = l.split('|').slice(1, -1).map((s)=>s.trim());
		return [c[0], c[1], c[2], c[3], c[4] === '—' ? '' : c[4]].join('┃');
	}).sort();
}
function oldAspectTuples(text){
	return text.split('\n').map((l)=>{
		const m = l.match(/^(\S+)\s+(.+)\s+(\S+)（([^，）]+)(?:，误差(.+))?）$/);
		return [m[1], m[2], m[3], m[4], m[5] || ''].join('┃');
	}).sort();
}

// (宫,宿,星串) 元组集合：新表逐行 = | 宫 | 宿 | 星串 |；旧格式 = 宫位:一行 + 其下多组「二十八宿:X」+「星曜:Y」，
// 同宿多星按新表同款「；」相接，空宫 = (宫,'无','无')。
function newHouseSuTuples(text){
	return text.split('\n').slice(2).map((l)=>{
		const c = l.split('|').slice(1, -1).map((s)=>s.trim());
		return [c[0], c[1], c[2]].join('┃');
	}).sort();
}
function oldHouseSuTuples(text){
	const tuples = [];
	let house = null;
	let su = null;
	let stars = [];
	const flush = ()=>{
		if(su !== null){
			tuples.push([house, su, stars.join('；')].join('┃'));
			su = null;
			stars = [];
		}
	};
	text.split('\n').forEach((line)=>{
		if(line.startsWith('宫位：')){ flush(); house = line.slice(3); }
		else if(line.startsWith('二十八宿：')){ flush(); su = line.slice(5); }
		else if(line.startsWith('星曜：')){ stars.push(line.slice(3)); }
		else if(line.trim() === ''){ flush(); }
	});
	flush();
	return tuples.sort();
}

describe('七政四余 AI 快照段·表化「值不变」证明（改后 builder vs HEAD 基线）', ()=>{
	test('[大限] 主表 fact-multiset 守恒 + GFM 5 列表', ()=>{
		const out = buildGuolaoLimitSection(GL_LIMIT_CHART, {}, GL_LIMIT_PARAMS, '', 'tong10');
		expect(out).toContain('| 限 | 宫 | 起讫岁 | 起讫年 | 年数 |');
		expect(factMultiset(out)).toEqual(factMultiset(baseline.gl_limit_main));
	});

	test('[大限] 洞微分支 fact-multiset 守恒 + 洞微 GFM 5 列表', ()=>{
		const out = buildGuolaoLimitSection(GL_LIMIT_CHART, {}, GL_LIMIT_PARAMS, 'dongwei', 'tong10');
		expect(out).toContain('| 限 | 宫 | 起讫岁 | 年数 | 吊度 |');
		expect(factMultiset(out)).toEqual(factMultiset(baseline.gl_limit_dongwei));
	});

	test('[相位] 元组集合守恒 + GFM 5 列表', ()=>{
		const out = buildGuolaoAspectSection(GL_ASPECT_RESULT);
		expect(out).toContain('| 主体 | 相位 | 对象 | 状态 | 误差 |');
		expect(newAspectTuples(out)).toEqual(oldAspectTuples(baseline.gl_aspect));
	});

	test('[七政四余宫位与二十八宿星曜] 元组集合守恒 + GFM 3 列表', ()=>{
		const out = buildHouseSuAndGodsSection(GL_HOUSESU_RESULT, null, {});
		expect(out.startsWith('| 宫位 | 二十八宿 | 星曜 |')).toBe(true);
		expect(newHouseSuTuples(out)).toEqual(oldHouseSuTuples(baseline.gl_housesu));
	});

	test('[星曜庙旺与星点动态] fact-multiset 守恒 + GFM 4 列表（31 golden 值不受排版影响）', ()=>{
		const out = buildStarDignityMotionSection(GL_DIGNITY_RESULT, {});
		expect(out).toContain('| 曜 | 地支 | 所属 | 速度态 |');
		expect(factMultiset(out)).toEqual(factMultiset(baseline.gl_dignity));
	});
});
