// 风水纳气盘快照 [标记判定]/[破局危害] 表化 · 数值不变证明(fact-multiset)。
// baseline fixture = 表化前 buildNaqiSnapshotText 逐字输出(capture-if-missing,首跑于改造前)。
// 轻量桩:Object.create(原型) + 桩 this.*(evaluateMarker/buildNaqiAnalysis/getDiskRotation),无需 canvas。
// 「生成时间」行含实时时间戳(非本次改动),两侧对比前一律剔除。断言:剥表头/分隔行 + 剔生成时间后事实多重集相等。
import fs from 'fs';
import path from 'path';
import FengShuiEngine from '../fengshuiEngine';

function extractFacts(text) {
	const lines = `${text || ''}`.split('\n').filter((l) => l.indexOf('生成时间') < 0);
	const isSep = (s) => { const t = `${s || ''}`.trim(); return t.startsWith('|') && /^[|\s:-]+$/.test(t) && t.indexOf('-') >= 0; };
	const kept = [];
	for (let i = 0; i < lines.length; i++) { if (isSep(lines[i])) { kept.pop(); continue; } kept.push(lines[i]); }
	const tokens = kept.join('\n').match(/[一-龥A-Za-z0-9~+.]+/g) || [];
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
	const eng = Object.create(FengShuiEngine.prototype);
	eng.periodMode = 'current';
	eng.unitAzimuth = 30; eng.doorImageAngle = 45;
	eng.getDiskRotation = () => 15;
	eng.markers = [
		{ label: '大门', category: 'wind' },
		{ label: '水池', category: 'water' },
		{ label: '沙发', category: 'neutral' },
		{ label: '孤灯', category: 'wind' },
	];
	eng.evaluateMarker = (m) => {
		if (m.label === '大门') return { sector: { num: 3, name: '震' }, actual: 'wind', ok: true, expected: 'wind' };
		if (m.label === '水池') return { sector: { num: 1, name: '坎' }, actual: 'wind', ok: false, expected: 'water' };
		if (m.label === '沙发') return { sector: { num: 9, name: '离' }, actual: 'wind', ok: true, expected: 'wind' };
		return { sector: null }; // 孤灯:未定位
	};
	eng.buildNaqiAnalysis = () => ({
		markers: [
			{ label: '水池', sector: { name: '坎' }, harm: { label: '水破位', affect: '漏财耗损健康' } },
			{ label: '灶台', sector: null, harm: { label: '火烧天门', affect: '口舌是非' } },
		],
		houseHarms: [{ label: '穿堂煞', affect: '气散不聚财' }],
		dragonTiger: null, dragonTigerHint: '缺水槽或朝向,无法判龙虎', probe: null,
		score: 88, grade: '吉', remedies: [],
	});
	return eng.buildNaqiSnapshotText();
}

const FIX = path.join(__dirname, 'fixtures', 'naqiSnapshotTableBaseline.txt');

describe('风水纳气盘 [标记判定]/[破局危害] 表化 · 数值不变证明', () => {
	it('表化后事实多重集零变化(剔生成时间)', () => {
		const now = build();
		if (!fs.existsSync(FIX)) { fs.mkdirSync(path.dirname(FIX), { recursive: true }); fs.writeFileSync(FIX, now, 'utf8'); }
		expect(diffFacts(extractFacts(fs.readFileSync(FIX, 'utf8')), extractFacts(now))).toEqual([]);
	});
	it('baseline 为表化前基线(不含 GFM 表)', () => { expect(fs.readFileSync(FIX, 'utf8')).not.toMatch(/\| --- \|/); });
	it('[标记判定]/[破局危害] 已 GFM 表化', () => {
		const now = build();
		expect(now).toMatch(/\[标记判定\][\s\S]*\| --- \|/);
		expect(now).toMatch(/\[破局危害\][\s\S]*\| --- \|/);
	});
});
