// 八字 BaZi [四柱与三元]4主柱/[五行力量]分布/[格局·用神]多派 表化 · 数值不变证明(fact-multiset)。
// baseline fixture = 表化前 buildBaziSnapshotForParams(本地引擎)逐字输出(capture-if-missing,改造前抓)。
// 归一:①剥表头/分隔行 ②「CJK↔数字」补空格(木25%→木 25%,拆五行与占比) ③剔内联标签(表化后成表头/被吸收:
//   藏干/纳音/星运/自坐/空亡/干十神/支十神/分布/喜用/忌)。皆经基线核实为纯标签,不误伤星名/干支/十神/元素/数值。
// 大运/流年已表化不碰;golden 值绝不改。
import fs from 'fs';
import path from 'path';
import { buildBaziSnapshotForParams } from '../BaZi';

const STRIP = ['藏干', '纳音', '星运', '自坐', '空亡', '干十神', '支十神', '分布', '喜用', '忌'];
function extractFacts(text) {
	const lines = `${text || ''}`.split('\n');
	const isSep = (s) => { const t = `${s || ''}`.trim(); return t.startsWith('|') && /^[|\s:-]+$/.test(t) && t.indexOf('-') >= 0; };
	const kept = [];
	for (let i = 0; i < lines.length; i++) { if (isSep(lines[i])) { kept.pop(); continue; } kept.push(lines[i]); }
	let s = kept.join('\n');
	s = s.replace(/([一-龥])([0-9])/g, '$1 $2').replace(/([0-9])([一-龥])/g, '$1 $2');
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
const BASE = { date: '1990-05-18', time: '10:00:00', zone: '+08:00', lon: 118.45, gpsLon: 118.45, lat: 31.63, gpsLat: 31.63, gender: 1, timeAlg: 1, after23NewDay: 1 };
function build() { return buildBaziSnapshotForParams({ ...BASE, school: 'zonghe' }); }

const FIX = path.join(__dirname, 'fixtures', 'baziSectionTableBaseline.txt');

describe('八字 [四柱与三元]/[五行力量]/[格局·用神] 表化 · 数值不变证明', () => {
	it('表化后事实多重集零变化(归一后)', async () => {
		const now = await build();
		if (!fs.existsSync(FIX)) { fs.mkdirSync(path.dirname(FIX), { recursive: true }); fs.writeFileSync(FIX, now, 'utf8'); }
		expect(diffFacts(extractFacts(fs.readFileSync(FIX, 'utf8')), extractFacts(now))).toEqual([]);
	});
	it('baseline 为表化前基线(不含本批新增 GFM 表)', () => {
		// 大运/流年本就已表化;这里核实基线在[四柱与三元]/[五行力量]/[格局]段不含表(旧格式)。
		const b = fs.readFileSync(FIX, 'utf8');
		const seg = b.slice(b.indexOf('[四柱与三元]'), b.indexOf('[神煞（四柱与三元）]'));
		expect(seg).not.toMatch(/\| --- \|/);
	});
	it('[四柱与三元]/[五行力量]/[格局·用神] 已 GFM 表化(段内)', async () => {
		const now = await build();
		const seg = (name, end) => now.slice(now.indexOf(`[${name}]`), now.indexOf(`[${end}]`));
		expect(seg('四柱与三元', '神煞（四柱与三元）')).toMatch(/\| --- \|/);
		expect(now).toMatch(/\[五行力量\][\s\S]*?\| --- \|/);
		expect(now).toMatch(/\[格局·用神\][\s\S]*?\| --- \|/);
	});
});
