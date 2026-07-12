// 合盘 AstroRelative 六相位段(A对B/B对A/中点/映点/顺畅/张力)表化 · 数值不变证明(fact-multiset)。
// baseline fixture = 表化前 buildRelativeSnapshotText 逐字输出(capture-if-missing,首跑于改造前;Comp+Score 两盘型并起)。
// 旧格式为「主体：X」分组 + 内联连接词(与/与中点/成/相位/误差/权重),表化后升为表头一次 → 按「剔表头词」两侧剔除。
// 经基线核实:剔词恰=各标签/连接词行数,且绝不现于星名/度数/映点等真实值(无盲区)。中点内联「|」改「·」(非 token,不影响多重集)。
import fs from 'fs';
import path from 'path';
import { buildRelativeSnapshotText } from '../../components/astro/AstroRelative';

// 标签/连接词(原格式与值无空格拼接=原子 token:误差0.5 / 权重4 / 成映点),Set 剔词切不开 →
// 改「短语替换为空格」归一:两侧同法剥去这些脚手架词,值(星名/度数/映点/数字)自然独立成 token 后比多重集。
// 经基线核实:主体=6(组数)/相位=7/与=8… 皆纯标签行数,绝不现于真实值 → 归一后仅剩盘面值。
const STRIP = ['主体', '与中点', '与', '成', '相位', '误差', '权重', '中点', '星A', '星B'];
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
const compTab = {
	currentTab: 'Comp',
	chartA: { record: { name: '甲', birth: '1990-01-01 12:00', lon: 116, lat: 40 } },
	chartB: { record: { name: '乙', birth: '1992-02-02 08:30', lon: 121, lat: 31 } },
	params: { hsys: 0, zodiacal: 0 },
	result: {
		inToOutAsp: [
			{ id: 'Sun', objects: [{ id: 'Moon', aspect: 120, delta: 0.5 }, { id: 'Mars', aspect: 90, delta: 1.234 }] },
			{ id: 'Venus', objects: [] },
		],
		outToInAsp: [{ id: 'Jupiter', objects: [{ id: 'Saturn', aspect: 0, delta: 2.1 }] }],
		inToOutMidpoint: { Sun: [{ midpoint: { idA: 'Moon', idB: 'Venus' }, aspect: 60, delta: 0.8 }], Mars: [] },
		outToInMidpoint: { Jupiter: [{ midpoint: { idA: 'Sun', idB: 'Mars' }, aspect: 180, delta: 1.5 }] },
		inToOutAnti: [{ idA: 'Sun', idB: 'Moon', delta: 0.4 }],
		inToOutCAnti: [{ idA: 'Venus', idB: 'Mars', delta: 0.9 }],
		outToInAnti: [{ idA: 'Jupiter', idB: 'Saturn', delta: 1.1 }],
		outToInCAnti: [],
	},
};
const scoreTab = {
	currentTab: 'Score',
	chartA: { record: { name: '甲', birth: '1990-01-01 12:00', lon: 116, lat: 40 } },
	chartB: { record: { name: '乙', birth: '1992-02-02 08:30', lon: 121, lat: 31 } },
	params: { hsys: 0, zodiacal: 0 },
	result: {
		score: 72,
		highlights: [{ a: 'Sun', b: 'Venus', aspect: 120, orb: 0.3, impact: 4 }],
		challenges: [{ a: 'Mars', b: 'Saturn', aspect: 90, orb: 0.5, impact: -4 }],
		aspects: [],
	},
};
function build() { return buildRelativeSnapshotText(compTab) + '\n' + buildRelativeSnapshotText(scoreTab); }

const FIX = path.join(__dirname, 'fixtures', 'relativeAspectTableBaseline.txt');

describe('合盘六相位段表化 · 数值不变证明', () => {
	it('表化后事实多重集零变化(剔连接词/表头词)', () => {
		const now = build();
		if (!fs.existsSync(FIX)) { fs.mkdirSync(path.dirname(FIX), { recursive: true }); fs.writeFileSync(FIX, now, 'utf8'); }
		expect(diffFacts(extractFacts(fs.readFileSync(FIX, 'utf8')), extractFacts(now))).toEqual([]);
	});
	it('baseline 为表化前基线(不含 GFM 表)', () => { expect(fs.readFileSync(FIX, 'utf8')).not.toMatch(/\| --- \|/); });
	it('六相位段均已 GFM 表化', () => {
		const now = build();
		['A对B相位', 'B对A相位', 'A对B中点相位', 'A对B映点', '顺畅连接', '张力连接'].forEach((seg) => {
			expect(now).toMatch(new RegExp(`\\[${seg}\\][\\s\\S]*?\\| --- \\|`));
		});
	});
});
