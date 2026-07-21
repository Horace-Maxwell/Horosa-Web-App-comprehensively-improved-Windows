// 塔罗 reportText [逐牌详解] 表化 · 数值不变证明(fact-multiset)。
// baseline fixture = 表化前 buildReadingText 逐字输出(capture-if-missing,首跑于改造前)。
// 旧格式逐牌重复内联标签(占象/含义/尊位)→ 表化后升为表头一次:这些标签属「表头词」,按 paradigm 剔除后比多重集。
// 断言:剥表头行/GFM 分隔行 + 剔内联标签词后,新旧事实多重集相等 → 逐牌盘面值零变化。
import fs from 'fs';
import path from 'path';
import { buildReading } from '../engine/reading.js';
import { listDeckIds, getDeck } from '../engine/deckRegistry.js';
import { buildReadingText } from '../engine/reportText.js';

// 内联标签:旧格式每牌重复(占象:/含义:/尊位: 各恰 = 牌数,纯标签),表化后升为表头一次。按「剔表头词」从两侧剔除。
// 仅这三个是「内联→表头」的坍缩标签;其余表头词(位置/牌/正逆/关键词)只在新表头出现,已由表头行剥离处理,
// 不全局剔(避免误伤如统计行「正逆:正位3」这类真实数据 token)。
const INLINE_LABELS = new Set(['占象', '含义', '尊位']);
function extractFacts(text) {
	const lines = `${text || ''}`.split('\n');
	const isSep = (s) => { const t = `${s || ''}`.trim(); return t.startsWith('|') && /^[|\s:-]+$/.test(t) && t.indexOf('-') >= 0; };
	const kept = [];
	for (let i = 0; i < lines.length; i++) { if (isSep(lines[i])) { kept.pop(); continue; } kept.push(lines[i]); }
	// [X1·P2-34] 计数链是表化之后新增的独立事实行(定局段),不属「逐牌详解表化不改事实」的比较域:
	// 基线为表化前冻结快照(不许含 GFM 表)无从含它,两侧一并剔除,守卫仍盯逐牌盘面值零变化。
	const keptScoped = kept.filter((l) => !`${l}`.trim().startsWith('计数链:'));
	const tokens = keptScoped.join('\n').match(/[一-龥A-Za-z0-9~+.]+/g) || [];
	const m = new Map();
	tokens.forEach((t) => { if (INLINE_LABELS.has(t)) { return; } m.set(t, (m.get(t) || 0) + 1); });
	return m;
}
function diffFacts(a, b) {
	const out = []; const keys = new Set([...a.keys(), ...b.keys()]);
	keys.forEach((k) => { const av = a.get(k) || 0; const bv = b.get(k) || 0; if (av !== bv) { out.push(`${k}: 旧${av} vs 新${bv}`); } });
	return out;
}
// 选一支带尊位(dignities)的牌组 + 其 ≥3 位牌阵,覆盖 占象/含义/尊位 三行。
function pickDeckSpread() {
	const ids = listDeckIds();
	for (const id of ids) {
		const d = getDeck(id);
		if (!d || !d.dignities || !d.caps || !Array.isArray(d.caps.spreads)) { continue; }
		const sp = d.caps.spreads.find((s) => s === 'three' || s === 'celtic' || s === 'horseshoe') || d.caps.spreads[0];
		return { id, sp };
	}
	const id = ids[0]; return { id, sp: getDeck(id).caps.spreads[0] };
}
function build() {
	const { id, sp } = pickDeckSpread();
	const r = buildReading(id, sp, 'table-proof-seed', { reversals: true, dignities: true, birth: { year: 1990, month: 5, day: 18 } });
	return buildReadingText(r, '事业走向如何');
}

const FIX = path.join(__dirname, 'fixtures', 'reportTextTableBaseline.txt');

describe('塔罗 reportText [逐牌详解] 表化 · 数值不变证明', () => {
	it('表化后事实多重集零变化(剔内联标签)', () => {
		const now = build();
		if (!fs.existsSync(FIX)) { fs.mkdirSync(path.dirname(FIX), { recursive: true }); fs.writeFileSync(FIX, now, 'utf8'); }
		expect(diffFacts(extractFacts(fs.readFileSync(FIX, 'utf8')), extractFacts(now))).toEqual([]);
	});
	it('baseline 为表化前基线(不含 GFM 表)', () => { expect(fs.readFileSync(FIX, 'utf8')).not.toMatch(/\| --- \|/); });
	it('[逐牌详解] 已 GFM 表化', () => { expect(build()).toMatch(/\[逐牌详解\][\s\S]*\| --- \|/); });
});
