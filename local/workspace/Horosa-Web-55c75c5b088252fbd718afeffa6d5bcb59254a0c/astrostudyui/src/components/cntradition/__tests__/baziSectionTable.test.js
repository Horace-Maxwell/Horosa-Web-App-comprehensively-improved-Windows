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

// 表化【之后】新增的解读行（三维分列/成败救应/新补神煞四味/各派忌列），不属「表化等价」比较域：
// 基线冻结于新增前且须保持旧格式（第 2 个用例守此），故仅在本断言按行剔除，表化守卫职责不变。
// 各自正确性由 baziWuxingDimensions / baziChengBai / baziShenShaAug2 / baziZaGeXuYao 覆盖。
const ADDED_LINE_RE = /^(三维分列|· 得令|· 得地|· 得势|成败：)/;
const ADDED_TOKENS = ['福星贵人', '德秀贵人', '国印贵人', '天喜', '调候以寒暖燥湿论急缓', '本派不单列忌神'];
// 通关派 note 本轮追加的忌神句（五行随盘而变，按句型整段剔除）。
const ADDED_PHRASE_RE = /[；;]忌.夺通关。?/g;
function stripAddedFacts(text) {
	const kept = `${text || ''}`.split('\n')
		.filter((l) => !ADDED_LINE_RE.test(l.trim()))
		// 多派对照表「忌」列本轮由空补为真数据（格局派/通关派），该列整列不入表化比较域。
		.map((l) => {
			const t = l.trim();
			if (!t.startsWith('|')) { return l; }
			const cells = t.split('|');
			// | 流派 | 喜用 | 忌 | 备注 | → cells = ['', 流派, 喜用, 忌, 备注, '']
			// 仅格局派/通关派两行：其忌列本轮由空补为真数据；余派忌列原有内容，须留在比较域。
			if (cells.length === 6 && /^(格局派|通关派)/.test(cells[1].trim())) { cells[3] = ' — '; return cells.join('|'); }
			return l;
		});
	let s = kept.join('\n').replace(ADDED_PHRASE_RE, '');
	// 表内新增词（神煞四味名、各派 note 新增句）逐词剔除，不误伤既有同名事实之计数基准。
	ADDED_TOKENS.forEach((w) => { s = s.split(w).join(''); });
	return s;
}

describe('八字 [四柱与三元]/[五行力量]/[格局·用神] 表化 · 数值不变证明', () => {
	it('表化后事实多重集零变化(归一后)', async () => {
		const now = await build();
		if (!fs.existsSync(FIX)) { fs.mkdirSync(path.dirname(FIX), { recursive: true }); fs.writeFileSync(FIX, now, 'utf8'); }
		expect(diffFacts(extractFacts(fs.readFileSync(FIX, 'utf8')), extractFacts(stripAddedFacts(now)))).toEqual([]);
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
