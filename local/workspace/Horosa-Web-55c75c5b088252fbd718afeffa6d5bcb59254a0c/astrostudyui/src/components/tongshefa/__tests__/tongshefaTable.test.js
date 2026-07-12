// 通蓍法 TongSheFaMain 【世应】+【五行关系】五行展开(爻|左|右)表化 · 数值不变证明。
// baseline fixture = 表化前 buildShiYingSection+buildWuXingRelationSection 逐字输出(capture-if-missing,改造前抓)。
// 五行展开逐爻行含内联「左 …；右 …」标签,表化后升为表头 → 按「短语替换」剔 左/右(两侧同法,对 左卦/右卦 亦对称无害)。
// 世应逐项 `世：1爻（角色）· 子水生` 保「1爻」「子水生」原子 token,拆列不碰其内部 → 无需额外归一。
// ⚠️ 段头全角【X】零变更;◆ 子块保留。
import fs from 'fs';
import path from 'path';
import { buildShiYingSection, buildWuXingRelationSection } from '../TongSheFaMain';

const STRIP = ['左', '右']; // 五行展开内联「左/右」标签(表化后成表头);对 左卦/右卦 legend 亦对称剔,不引入差异。
function extractFacts(text) {
	const lines = `${text || ''}`.split('\n');
	const isSep = (s) => { const t = `${s || ''}`.trim(); return t.startsWith('|') && /^[|\s:-]+$/.test(t) && t.indexOf('-') >= 0; };
	const kept = [];
	for (let i = 0; i < lines.length; i++) { if (isSep(lines[i])) { kept.pop(); continue; } kept.push(lines[i]); }
	let s = kept.join('\n');
	STRIP.forEach((w) => { s = s.split(w).join(' '); });
	const tokens = s.match(/[一-龥A-Za-z0-9~+.]+/g) || [];
	const m = new Map();
	tokens.forEach((t) => m.set(t, (m.get(t) || 0) + 1));
	return m;
}
function diffFacts(a, b) {
	const out = []; const keys = new Set([...a.keys(), ...b.keys()]);
	keys.forEach((k) => { const av = a.get(k) || 0; const bv = b.get(k) || 0; if (av !== bv) { out.push(`${k}: 旧${av} vs 新${bv}`); } });
	return out;
}
function build() {
	const L = [
		{ value: 1, branch: '戌', elem: '土', pattern: '▅▅', shiYing: '世', ownRel: '同' },
		{ value: 0, branch: '申', elem: '金', pattern: '▅ ▅' },
		{ value: 1, branch: '午', elem: '火', pattern: '▅▅' },
		{ value: 0, branch: '辰', elem: '土', pattern: '▅ ▅', shiYing: '应', ownRel: '同' },
		{ value: 1, branch: '寅', elem: '木', pattern: '▅▅' },
		{ value: 0, branch: '子', elem: '水', pattern: '▅ ▅' },
	];
	const R = [
		{ value: 1, branch: '卯', elem: '木', pattern: '▅▅' },
		{ value: 1, branch: '巳', elem: '火', pattern: '▅▅', shiYing: '世', ownRel: '爱' },
		{ value: 0, branch: '未', elem: '土', pattern: '▅ ▅' },
		{ value: 1, branch: '酉', elem: '金', pattern: '▅▅' },
		{ value: 0, branch: '亥', elem: '水', pattern: '▅ ▅', shiYing: '应', ownRel: '制' },
		{ value: 1, branch: '丑', elem: '土', pattern: '▅▅' },
	];
	const model = {
		leftLines: L, rightLines: R, leftElem: '土', rightElem: '木',
		mainRelation: '鬼', mainRelationLabel: '压力', leftHouseLabel: '坤宫', rightHouseLabel: '震宫',
	};
	return buildShiYingSection(model).join('\n') + '\n' + buildWuXingRelationSection(model).join('\n');
}

const FIX = path.join(__dirname, 'fixtures', 'tongshefaTableBaseline.txt');

describe('通蓍法 【世应】/五行展开 表化 · 数值不变证明', () => {
	it('表化后事实多重集零变化(剔左/右标签)', () => {
		const now = build();
		if (!fs.existsSync(FIX)) { fs.mkdirSync(path.dirname(FIX), { recursive: true }); fs.writeFileSync(FIX, now, 'utf8'); }
		expect(diffFacts(extractFacts(fs.readFileSync(FIX, 'utf8')), extractFacts(now))).toEqual([]);
	});
	it('baseline 为表化前基线(不含 GFM 表)', () => { expect(fs.readFileSync(FIX, 'utf8')).not.toMatch(/\| --- \|/); });
	it('段头【X】零变更 且 已 GFM 表化 且 ◆ 保留', () => {
		const now = build();
		expect(now).toMatch(/【世应】/);
		expect(now).toMatch(/【五行关系】/);
		expect(now).toMatch(/◆ 左卦 · 思想/);
		expect(now).toMatch(/◆ 左右卦五行展开/);
		expect(now).toMatch(/\| --- \|/);
	});
});
