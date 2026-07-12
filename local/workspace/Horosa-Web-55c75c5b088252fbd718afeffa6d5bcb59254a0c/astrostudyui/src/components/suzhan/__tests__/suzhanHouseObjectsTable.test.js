// 演禽 SuZhanMain buildHouseObjectLines([九宫与宫内星体]星体行)表化 · 数值不变证明。
// baseline fixture = 表化前 buildHouseObjectLines 逐字输出(capture-if-missing,首跑于改造前)。
// 旧行 `星体：X d˚座m分[，宿:S]` 将「座m」相邻拼成一 token;表化拆列 宫位|星体|度|座|分|宿 后分离,
// 归一对「CJK↔数字」边界补空格(两侧同法),值自然独立成 token 比多重集,不掩盖任何数值改动。
// (buildSu28ObjectLines=死代码无引用、buildHouseSuLines 喂已表化的 foldHouseSuLinesToTable → 均不碰。)
import fs from 'fs';
import path from 'path';
import { buildHouseObjectLines } from '../SuZhanMain';

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
	const chart = {
		houses: [{ id: 'House1' }, { id: 'House2' }, { id: 'House3' }],
		objects: [
			{ id: 'Sun', house: 'House1', signlon: 15.3, sign: 'Taurus', su28: '井' },
			{ id: 'Moon', house: 'House1', signlon: 2.7, sign: 'Gemini' },
			{ id: 'Mars', house: 'House3', signlon: 28.9, sign: 'Leo', su28: '角' },
		],
	};
	return buildHouseObjectLines(chart).join('\n');
}

const FIX = path.join(__dirname, 'fixtures', 'suzhanHouseObjectsTableBaseline.txt');

describe('演禽 [九宫与宫内星体] 星体行表化 · 数值不变证明', () => {
	it('表化后事实多重集零变化(坐标拆列归一)', () => {
		const now = build();
		if (!fs.existsSync(FIX)) { fs.mkdirSync(path.dirname(FIX), { recursive: true }); fs.writeFileSync(FIX, now, 'utf8'); }
		expect(diffFacts(extractFacts(fs.readFileSync(FIX, 'utf8')), extractFacts(now))).toEqual([]);
	});
	it('baseline 为表化前基线(不含 GFM 表)', () => { expect(fs.readFileSync(FIX, 'utf8')).not.toMatch(/\| --- \|/); });
	it('星体行已 GFM 表化', () => { expect(build()).toMatch(/\| --- \|/); });
});
