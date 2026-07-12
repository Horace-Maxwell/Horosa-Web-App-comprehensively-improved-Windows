// 卜卦 horary 快照 [相位全览] 表化 · 数值不变证明(fact-multiset)。
// baseline fixture = 表化前 buildHorarySnapshot 逐字输出(capture-if-missing,首跑于改造前)。
// 断言:剥表头/分隔行后新旧事实多重集相等 → [相位全览] 只动排版;election 共享 opts 零碰。
import fs from 'fs';
import path from 'path';
import { buildMockResult } from '../../election/__tests__/electionFixture';
import { runHorary } from '../horaryEngine';
import { horaryJudgeOpts } from '../horarySchools';
import { buildHorarySnapshot } from '../horarySnapshot';

function extractFacts(text) {
	const lines = `${text || ''}`.split('\n');
	const isSep = (s) => { const t = `${s || ''}`.trim(); return t.startsWith('|') && /^[|\s:-]+$/.test(t) && t.indexOf('-') >= 0; };
	const kept = [];
	for (let i = 0; i < lines.length; i++) { if (isSep(lines[i])) { kept.pop(); continue; } kept.push(lines[i]); }
	const tokens = kept.join('\n').match(/[一-龥A-Za-z0-9~+.]+/g) || [];
	const m = new Map(); tokens.forEach((t) => m.set(t, (m.get(t) || 0) + 1)); return m;
}
function diffFacts(a, b) {
	const out = []; const keys = new Set([...a.keys(), ...b.keys()]);
	keys.forEach((k) => { const av = a.get(k) || 0; const bv = b.get(k) || 0; if (av !== bv) { out.push(`${k}: 旧${av} vs 新${bv}`); } });
	return out;
}
function build() { const r = buildMockResult(); const j = runHorary(r, 'general', horaryJudgeOpts('general')); return buildHorarySnapshot(j, r.chart); }

const FIX = path.join(__dirname, 'fixtures', 'horarySnapshotTableBaseline.txt');

describe('horary 快照 [相位全览] 表化 · 数值不变证明', () => {
	it('表化后事实多重集零变化', () => {
		const now = build();
		if (!fs.existsSync(FIX)) { fs.mkdirSync(path.dirname(FIX), { recursive: true }); fs.writeFileSync(FIX, now, 'utf8'); }
		expect(diffFacts(extractFacts(fs.readFileSync(FIX, 'utf8')), extractFacts(now))).toEqual([]);
	});
	it('baseline 为表化前基线(不含 GFM 表)', () => { expect(fs.readFileSync(FIX, 'utf8')).not.toMatch(/\| --- \|/); });
	it('[相位全览] 已 GFM 表化', () => { const now = build(); expect(now).toMatch(/\[相位全览\][\s\S]*\| --- \|/); });
});
