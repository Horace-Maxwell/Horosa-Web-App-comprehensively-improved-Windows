// 骰子占 DiceMain buildChartObjectLines(骰子盘/天象盘两段星体行)表化 · 数值不变证明。
// baseline fixture = 表化前 buildChartObjectLines 逐字输出(capture-if-missing,首跑于改造前)。
// 旧行 `星体：X d˚座m分` 将「座m」相邻拼成一 token(座名与分无分隔);表化拆列 星体|度|座|分 后二者分离,
// 归一时对「CJK↔数字」边界补空格(两侧同法),值(星名/度/座/分)自然独立成 token 后比多重集,不掩盖任何数值改动。
import fs from 'fs';
import path from 'path';
import { buildChartObjectLines } from '../DiceMain';

function extractFacts(text) {
	const lines = `${text || ''}`.split('\n');
	const isSep = (s) => { const t = `${s || ''}`.trim(); return t.startsWith('|') && /^[|\s:-]+$/.test(t) && t.indexOf('-') >= 0; };
	const kept = [];
	for (let i = 0; i < lines.length; i++) { if (isSep(lines[i])) { kept.pop(); continue; } kept.push(lines[i]); }
	let s = kept.join('\n');
	['星体', '星曜', '度', '座', '分', '宿'].forEach((w) => { s = s.split(w).join(' '); });
	s = s.replace(/([一-龥])([0-9])/g, '$1 $2').replace(/([0-9])([一-龥])/g, '$1 $2');
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
	const chartObj = { chart: {
		houses: [{ id: 'House1' }, { id: 'House2' }, { id: 'House3' }],
		objects: [
			{ id: 'Sun', house: 'House1', signlon: 15.3, sign: 'Taurus' },
			{ id: 'Moon', house: 'House1', signlon: 2.7, sign: 'Gemini' },
			{ id: 'Mars', house: 'House3', signlon: 28.9, sign: 'Leo' },
		],
	} };
	return buildChartObjectLines(chartObj).join('\n');
}

const FIX = path.join(__dirname, 'fixtures', 'diceChartObjectsTableBaseline.txt');

describe('骰子占 星体行表化 · 数值不变证明', () => {
	it('表化后事实多重集零变化(坐标拆列归一)', () => {
		const now = build();
		if (!fs.existsSync(FIX)) { fs.mkdirSync(path.dirname(FIX), { recursive: true }); fs.writeFileSync(FIX, now, 'utf8'); }
		expect(diffFacts(extractFacts(fs.readFileSync(FIX, 'utf8')), extractFacts(now))).toEqual([]);
	});
	it('baseline 为表化前基线(不含 GFM 表)', () => { expect(fs.readFileSync(FIX, 'utf8')).not.toMatch(/\| --- \|/); });
	it('星体行已 GFM 表化', () => { expect(build()).toMatch(/\| --- \|/); });
});

// [Q-455/T-418] 逆行列 + 两盘相位段。
import { buildChartAspectLines } from '../DiceMain';
describe('骰子占 · 逆行标记与相位(Q-455)', () => {
	it('lonspeed<0 的星在「逆行」列标「逆」,其余 —;无速度字段(基线夹具)输出事实集不变', () => {
		const chartObj = { chart: {
			houses: [{ id: 'House1' }],
			objects: [
				{ id: 'Mars', house: 'House1', signlon: 28.9, sign: 'Leo', lonspeed: -0.2 },
				{ id: 'Sun', house: 'House1', signlon: 15.3, sign: 'Taurus', lonspeed: 0.98 },
				{ id: 'Asc', house: 'House1', signlon: 1.0, sign: 'Aries' },
			],
		} };
		const t = buildChartObjectLines(chartObj).join('\n');
		expect(t).toMatch(/\| 火 \| 28 \| 狮子 \| 53 \| 逆 \|/);
		expect(t).toMatch(/\| 日 \| 15 \| 金牛 \| 18 \| — \|/);
		expect(t.split('\n')[0]).toBe('| 宫位 | 星体 | 度 | 座 | 分 | 逆行 |');
	});
	it('相位段:normalAsp 四态各成行;无 aspects → 空数组(不产段)', () => {
		const chartObj = { chart: { objects: [{ id: 'Sun' }, { id: 'Moon' }], aspects: { normalAsp: {
			Sun: { Applicative: [{ id: 'Moon', asp: 120, orb: 2.5347 }], Exact: [], Separative: [{ id: 'Mars', asp: 90, orb: 0 }], None: [{ id: 'Venus', asp: 60 }] },
		} } } };
		const lines = buildChartAspectLines(chartObj);
		expect(lines[0]).toBe('| 主体 | 相位 | 对象 | 相态 | 误差 |');
		expect(lines).toContain('| 日 | 120˚ | 月 | 入相 | 2.535 |');
		expect(lines).toContain('| 日 | 90˚ | 火 | 离相 | 0 |');
		expect(lines).toContain('| 日 | 60˚ | 金 | — |  |');
		expect(buildChartAspectLines({ chart: { objects: [] } })).toEqual([]);
	});
});
