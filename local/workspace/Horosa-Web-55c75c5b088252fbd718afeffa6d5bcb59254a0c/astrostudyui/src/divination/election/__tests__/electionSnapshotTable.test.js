// 择日 election 快照 [分项]/[应期] 表化 · 数值不变证明(fact-multiset)。
// baseline fixture = 表化前 buildElectionSnapshot 逐字输出(capture-if-missing,首跑于改造前)。
// ⚠️ election 字节敏感:只动 electionSnapshot(渲染层),引擎(runElection)零碰;剥表头/分隔行后事实多重集相等。
import fs from 'fs';
import path from 'path';
import { buildMockResult } from './electionFixture';
import { runElection } from '../electionEngine';
import { buildElectionSnapshot } from '../electionSnapshot';

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
function build() { return buildElectionSnapshot(runElection(buildMockResult(), 'marriage')); }

const FIX = path.join(__dirname, 'fixtures', 'electionSnapshotTableBaseline.txt');

// [2026-08 评分重标定] 原「表化前 vs 表化后」一次性证明已完成历史使命(表化前基线在分数
// 重标定后不可再生)。语义升级为**事实多重集回归锚**:baseline=当前输出(capture-if-missing,
// 分数重标定时点重录),守护「未来渲染层改动不吞/不糊数值」——引擎分数有意变更时删 baseline 重录留痕。
describe('election 快照 [分项]/[应期] 表化 · 事实多重集回归锚', () => {
	it('渲染层事实多重集与 baseline 零漂移', () => {
		const now = build();
		if (!fs.existsSync(FIX)) { fs.mkdirSync(path.dirname(FIX), { recursive: true }); fs.writeFileSync(FIX, now, 'utf8'); }
		expect(diffFacts(extractFacts(fs.readFileSync(FIX, 'utf8')), extractFacts(now))).toEqual([]);
	});
	it('[分项] 已 GFM 表化', () => { expect(build()).toMatch(/\[分项\][\s\S]*\| --- \|/); });
});
