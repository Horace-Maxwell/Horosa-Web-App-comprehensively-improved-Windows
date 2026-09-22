// 占星地图 ACG 快照 Parans(行星交映/固定星交映)表化 · 数值不变证明(fact-multiset)。
// baseline fixture = 表化前 buildAcgSectionText 逐字输出(capture-if-missing,首跑于改造前)。
// 旧行 `- A(事件)/B(事件):纬度 x°N` 中「纬度」为逐行内联标签(数=纬线行数),表化后升为表头 → 按「剔表头词」剔。
// 断言:剥表头/分隔行 + 剔「纬度」标签后事实多重集相等;◆ 子块头保留。
import fs from 'fs';
import path from 'path';
import { setAcgSnapshot, clearAcgSnapshot, buildAcgSectionText } from '../acgSnapshot';

const LABELS = new Set(['纬度']); // 逐行内联标签,表化后成表头;经基线核实仅现于 paran 行(count=行数),剔之无盲区。
function extractFacts(text) {
	const lines = `${text || ''}`.split('\n');
	const isSep = (s) => { const t = `${s || ''}`.trim(); return t.startsWith('|') && /^[|\s:-]+$/.test(t) && t.indexOf('-') >= 0; };
	const kept = [];
	for (let i = 0; i < lines.length; i++) { if (isSep(lines[i])) { kept.pop(); continue; } kept.push(lines[i]); }
	const tokens = kept.join('\n').match(/[一-龥A-Za-z0-9~+.]+/g) || [];
	const m = new Map();
	tokens.forEach((t) => { if (LABELS.has(t)) { return; } m.set(t, (m.get(t) || 0) + 1); });
	return m;
}
function diffFacts(a, b) {
	const out = []; const keys = new Set([...a.keys(), ...b.keys()]);
	keys.forEach((k) => { const av = a.get(k) || 0; const bv = b.get(k) || 0; if (av !== bv) { out.push(`${k}: 旧${av} vs 新${bv}`); } });
	return out;
}
function build() {
	clearAcgSnapshot();
	const data = {
		meta: { mode: 'mundo', coord: 'geo' },
		planets: { Sun: { lines: { mc: { lon: 10 }, ic: { lon: -170 } } }, Moon: { lines: {} } },
		parans: [
			{ a: 'Jupiter', b: 'Venus', aEvent: 'rise', bEvent: 'set', lat: 12.3 },
			{ a: 'Sun', b: 'Mars', aEvent: 'mc', bEvent: 'ic', lat: -5.7 },
			{ a: 'Mercury', b: 'Saturn', aEvent: 'rise', bEvent: 'mc', lat: 12.4 },
		],
		starParans: [
			{ star: 'spica', sEvent: 'rise', planet: 'Venus', pEvent: 'set', lat: 8.1 },
			{ star: 'regulus', sEvent: 'mc', planet: 'Jupiter', pEvent: 'ic', lat: -3.2 },
		],
		stars: [{ key: 'spica', name: '角宿一', lines: { mc: { lon: 5 } } }, { key: 'regulus', name: '轩辕十四', lines: { mc: { lon: 6 } } }],
	};
	setAcgSnapshot(data, { paranMode: 'all', showStarParans: true });
	return buildAcgSectionText();
}

const FIX = path.join(__dirname, 'fixtures', 'acgSnapshotTableBaseline.txt');

describe('ACG 快照 Parans 表化 · 数值不变证明', () => {
	it('表化后事实多重集零变化(剔纬度标签)', () => {
		const now = build();
		if (!fs.existsSync(FIX)) { fs.mkdirSync(path.dirname(FIX), { recursive: true }); fs.writeFileSync(FIX, now, 'utf8'); }
		expect(diffFacts(extractFacts(fs.readFileSync(FIX, 'utf8')), extractFacts(now))).toEqual([]);
	});
	it('baseline 为表化前基线(不含 GFM 表)', () => { expect(fs.readFileSync(FIX, 'utf8')).not.toMatch(/\| --- \|/); });
	it('两 paran 子块已 GFM 表化且 ◆ 头保留', () => {
		const now = build();
		expect(now).toMatch(/◆ 行星交映[\s\S]*\| --- \|/);
		expect(now).toMatch(/◆ 固定星交映[\s\S]*\| --- \|/);
	});
});

// [Q-440/T-403] 本地空间线 / 地理等价线:两图层开启时才进快照(数据+口径行),关着逐字同旧。
describe('占星地图快照 · 本地空间线 / 地理等价线(Q-440)', () => {
	const data = {
		meta: { mode: 'mundo', coord: 'geo', lsMode: 'rhumb', geodetic: 'johndro', geodeticVar: 'ra' },
		planets: {
			Sun: { lines: { mc: { lon: 10 }, ic: { lon: -170 }, lsAz: { az: 123.456, alt: -12.34 }, geodetic: { mc: { lon: 45.5 }, ic: { lon: -134.5 } } } },
			Moon: { lines: { mc: { lon: 20 }, ic: { lon: -160 }, lsAz: { az: 300.1, alt: 40 }, geodetic: { mc: { lon: -10 }, ic: { lon: 170 } } } },
		},
	};
	it('两开关关 → 无两段;开 → 出方位/高度表与地理MC/IC 表,口径行写画法/流派/取数/子午线', () => {
		clearAcgSnapshot();
		setAcgSnapshot(data, { showLS: false, showGeodetic: false });
		const off = buildAcgSectionText();
		expect(off).not.toContain('本地空间线');
		expect(off).not.toContain('地理等价线');
		clearAcgSnapshot();
		setAcgSnapshot(data, { showLS: true, showGeodetic: true, geodeticZero: '' });
		const on = buildAcgSectionText();
		expect(on).toContain('◆ 本地空间线(画法 等角航线;');
		expect(on).toContain('| 太阳 | 123.5° | -12.3° |');
		expect(on).toContain('| 月亮 | 300.1° | 40.0° |');
		expect(on).toContain('◆ 地理等价线(流派 约翰德罗 · 取数 赤经法 · 0°♈ 子午线 30.00°W(流派缺省);');
		expect(on).toContain('| 太阳 | 45.50°E | 134.50°W |');
		expect(on.replace(/◆ 本地空间线[\s\S]*?(?=◆ 地理等价线)/, '').replace(/◆ 地理等价线[\s\S]*$/, '').trim()).toBe(off.trim());
	});
	it('自定义 0°♈ 子午线走 uiState.geodeticZero 并标「自定义」', () => {
		clearAcgSnapshot();
		setAcgSnapshot(data, { showGeodetic: true, geodeticZero: '12.5' });
		expect(buildAcgSectionText()).toContain('0°♈ 子午线 12.50°E(自定义)');
	});
});
