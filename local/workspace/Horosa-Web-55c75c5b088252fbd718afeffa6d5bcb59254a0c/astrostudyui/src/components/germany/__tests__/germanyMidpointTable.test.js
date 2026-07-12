// 量化盘 germany 快照 [中点相位]/[TNP星体] 表化 · 数值不变证明(fact-multiset)。
// baseline fixture = 表化前 buildGermanySnapshotText 逐字输出(capture-if-missing,首跑于改造前)。
// [中点相位] 与合盘同构(主体分组+与中点/成/相位/误差 连接词),表化为拍平表 → 同「短语替换归一」剔脚手架词后比多重集。
// [TNP星体] 「X = 位置」→ 表(星体|位置),值零变化。中点因子对内联「|」→「·」(非 token,不影响)。
import fs from 'fs';
import path from 'path';
import { buildGermanySnapshotText } from '../AstroMidpoint';
import { SUN, MOON, MERCURY, MARS, VENUS, JUPITER } from '../../../constants/AstroConst';

const STRIP = ['主体', '与中点', '与', '成', '相位', '误差', '中点', '星体', '位置', '星A'];
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
	const params = { date: '1990-05-18', time: '10:00:00', zone: '+08:00', lon: '118e27', lat: '31n38', zodiacal: 0, hsys: 0 };
	const result = {
		midpoints: [{ idA: SUN, idB: MOON, sign: 1, signlon: 15.5 }],
		aspects: {
			[SUN]: [{ midpoint: { idA: MOON, idB: MARS }, aspect: 90, delta: 0.5 }, { midpoint: { idA: VENUS, idB: JUPITER }, aspect: 0, delta: 1.234 }],
			[MERCURY]: [],
		},
		tnp: [{ id: 'Cupido', sign: 2, signlon: 20.3, lon: 80.3 }, { id: 'Hades', sign: 5, signlon: 3.1, lon: 153.1 }],
	};
	return buildGermanySnapshotText(params, null, result, {});
}

const FIX = path.join(__dirname, 'fixtures', 'germanyMidpointTableBaseline.txt');

describe('germany [中点相位]/[TNP星体] 表化 · 数值不变证明', () => {
	it('表化后事实多重集零变化(剔连接词/表头词)', () => {
		const now = build();
		if (!fs.existsSync(FIX)) { fs.mkdirSync(path.dirname(FIX), { recursive: true }); fs.writeFileSync(FIX, now, 'utf8'); }
		expect(diffFacts(extractFacts(fs.readFileSync(FIX, 'utf8')), extractFacts(now))).toEqual([]);
	});
	it('baseline 为表化前基线([中点相位]/[TNP星体] 不含表)', () => {
		const b = fs.readFileSync(FIX, 'utf8');
		const seg = b.slice(b.indexOf('[TNP星体]'), b.indexOf('[90°中点盘]') >= 0 ? b.indexOf('[90°中点盘]') : b.length);
		expect(seg).not.toMatch(/\| --- \|/);
	});
	it('[中点相位]/[TNP星体] 已 GFM 表化(段内)', () => {
		const now = build();
		const seg = (name) => { const i = now.indexOf(`[${name}]`); const j = now.indexOf('\n[', i + 1); return now.slice(i, j < 0 ? now.length : j); };
		expect(seg('TNP星体')).toMatch(/\| --- \|/);
		expect(seg('中点相位')).toMatch(/\| --- \|/);
	});
});
