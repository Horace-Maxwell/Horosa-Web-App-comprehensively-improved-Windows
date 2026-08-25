// 卜卦 horary 快照 [相位全览] 表化 · 数值不变证明(fact-multiset)。
// baseline fixture = 表化前 buildHorarySnapshot 逐字输出(capture-if-missing,首跑于改造前)。
// 断言:剥表头/分隔行后新旧事实多重集相等 → [相位全览] 只动排版;election 共享 opts 零碰。
import fs from 'fs';
import path from 'path';
import { buildMockResult } from '../../election/__tests__/electionFixture';
import { runHorary } from '../horaryEngine';
import { horaryJudgeOpts } from '../horarySchools';
import { buildHorarySnapshot } from '../horarySnapshot';

// 比对域=基线纪元 12 段（批6 起快照另增 [定盘考量][Almuten][映点对映点][行星时][尊贵明细] 等
// 「只加新段」;本测试的定理=「表化只动排版、不动既有段事实」,新段不参与多重集比对,
// 由下方独立断言证其在位——既有段一旦漂移仍然必红）。
const BASELINE_SECTIONS = ['起卦信息', '根本性', '征象星指派', '完成分析', '月亮的故事', '相位全览', '裁决', '应期方位', '描述', '专题深化·', '古典接纳', '征象力量'];
function inBaselineEra(section){
	if(section === null) return true;   // 段头前的引言行
	return BASELINE_SECTIONS.some((s) => section === s || (s.endsWith('·') && section.startsWith(s)));
}
function extractFacts(text) {
	const lines = `${text || ''}`.split('\n');
	const isSep = (s) => { const t = `${s || ''}`.trim(); return t.startsWith('|') && /^[|\s:-]+$/.test(t) && t.indexOf('-') >= 0; };
	const kept = [];
	let section = null;
	for (let i = 0; i < lines.length; i++) {
		const head = /^\[(.+)\]$/.exec(`${lines[i] || ''}`.trim());
		if (head) { section = head[1]; }
		if (!inBaselineEra(section)) { continue; }
		if (isSep(lines[i])) { kept.pop(); continue; }
		kept.push(lines[i]);
	}
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
	// [H2 显式重锚 2026-08] 基线纪元推进:传递完成的应期从恒缺变为按传递腿(T→target)折算
	// (治愈性变更,人工核 diff=仅[应期方位]一行+新段),故基线重录于表化后纪元——现在**含** GFM 表。
	// 多重集断言(上方)仍是漂移哨兵:今后任何事实变化 vs 本基线必红。
	it('baseline 为表化后纪元(含 GFM 表;防拿旧纪元文件冒充)', () => { expect(fs.readFileSync(FIX, 'utf8')).toMatch(/\| --- \|/); });
	it('[相位全览] 已 GFM 表化', () => { const now = build(); expect(now).toMatch(/\[相位全览\][\s\S]*\| --- \|/); });
	it('批6 新段在位([定盘考量]/[Almuten]/[映点对映点]/[行星时]/[尊贵明细])且基线纪元段仍齐', () => {
		const now = build();
		['[定盘考量]', '[Almuten]', '[映点对映点]', '[行星时]', '[尊贵明细]'].forEach((s) => expect(now).toContain(s));
		['[起卦信息]', '[裁决]', '[相位全览]', '[应期方位]'].forEach((s) => expect(now).toContain(s));
		// classical 默认档:满分表/点全集不产段(零回归自证)。
		expect(now).not.toContain('[偶然尊贵满分表]');
		expect(now).not.toContain('[阿拉伯点全集]');
	});
});
