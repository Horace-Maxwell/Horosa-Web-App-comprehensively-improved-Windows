// 天文地占 GeomancyMain buildGeomancySnapshotText [十二宫·图形入宫]/[十六图形] 表化 · 数值不变证明。
// baseline fixture = 表化前逐字输出(capture-if-missing,首跑于改造前)。宫号保留「第N宫」原子 token,
// 故无需归一;剥表头/分隔行后事实多重集相等。◆ 图形释义 doctrine 段不碰。
import fs from 'fs';
import path from 'path';
import { buildGeomancySnapshotText } from '../GeomancyMain';

function extractFacts(text) {
	const lines = `${text || ''}`.split('\n');
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
	const result = {
		reading: {
			question: '事业', questionType: 'career',
			houses: [
				{ house: 1, nameZh: '命宫', roles: ['querent'], figure: { nameZh: '吉庆' }, reading: '主吉利之事' },
				{ house: 7, nameZh: '夫妻宫', roles: ['quesited'], figure: { nameZh: '赤红' }, reading: '主动荡不安' },
				{ house: 4, nameZh: '田宅宫', roles: [], figure: { nameZh: '道路' } },
			],
			figures16: [
				{ nameZh: '吉庆', planetZh: '木', elementZh: '火' },
				{ nameZh: '赤红', planetZh: '火' },
				{ nameZh: '道路', planetZh: '土', elementZh: '土' },
			],
		},
	};
	return buildGeomancySnapshotText(result);
}

const FIX = path.join(__dirname, 'fixtures', 'geomancyHousesTableBaseline.txt');

describe('地占 [十二宫·图形入宫]/[十六图形] 表化 · 数值不变证明', () => {
	it('表化后事实多重集零变化', () => {
		const now = build();
		if (!fs.existsSync(FIX)) { fs.mkdirSync(path.dirname(FIX), { recursive: true }); fs.writeFileSync(FIX, now, 'utf8'); }
		expect(diffFacts(extractFacts(fs.readFileSync(FIX, 'utf8')), extractFacts(now))).toEqual([]);
	});
	it('baseline 为表化前基线(不含 GFM 表)', () => { expect(fs.readFileSync(FIX, 'utf8')).not.toMatch(/\| --- \|/); });
	it('[十二宫·图形入宫]/[十六图形] 已 GFM 表化', () => {
		const now = build();
		expect(now).toMatch(/\[十二宫·图形入宫\][\s\S]*?\| --- \|/);
		expect(now).toMatch(/\[十六图形\][\s\S]*?\| --- \|/);
	});
});
