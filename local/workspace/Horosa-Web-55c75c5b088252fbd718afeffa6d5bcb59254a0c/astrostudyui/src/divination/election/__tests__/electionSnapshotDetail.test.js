// [Q-445/T-408] 西洋择日快照:尊贵五重矩阵逐项 / Almuten 逐点计分 / 择前考量未命中项(✓) / [回归与主限] 段(页面按需拉取物)。
import { buildMockResult } from './electionFixture';
import { runElection } from '../electionEngine';
import { buildElectionSnapshot } from '../electionSnapshot';
import { essentialMatrix } from '../dignityReport';
import { AI_EXPORT_PRESET_SECTIONS } from '../../../utils/aiExport';

describe('择日快照 · 明细还原(Q-445)', () => {
	const j = runElection(buildMockResult(), 'marriage');
	const text = buildElectionSnapshot(j);
	it('[尊贵强弱] 表列 = 星/落座/庙/旺/三分/界/面/陷/弱/外来/本质小计/偶然合计,行数 = essentialMatrix 行数,● 与矩阵字段一致', () => {
		const sec = text.slice(text.indexOf('[尊贵强弱]'), text.indexOf('[阿拉伯点]'));
		expect(sec).toContain('| 星 | 落座 | 庙 | 旺 | 三分 | 界 | 面 | 陷 | 弱 | 外来 | 本质小计 | 偶然合计 |');
		const ess = essentialMatrix(j.facts, j.calibre && j.calibre.eff);
		const rows = sec.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| 星 ') && !l.startsWith('| ---') && !l.startsWith('| 命点') && !l.startsWith('| 合计'));
		const essRows = rows.slice(0, ess.length);
		expect(essRows.length).toBe(ess.length);
		ess.forEach((r, i) => {
			const cells = essRows[i].split('|').map((c) => c.trim());
			expect(cells[1]).toBe(r.cn);
			expect(cells[3]).toBe(r.domicile ? '●' : '');
			expect(cells[8]).toBe(r.detriment ? '●' : '');
			expect(cells[11]).toBe(`${r.score > 0 ? '+' : ''}${r.score}`);
		});
	});
	it('Almuten Figuris 逐点矩阵:命点行数 = af.points.length,合计行与 af.totals 一致', () => {
		const af = j.facts.almuten;
		if (!af || !af.points || !af.points.length) { return; }
		expect(text).toContain(`Almuten Figuris（${af.points.length === 5 ? '五' : '四'}命点逐点计分）：`);
		af.points.forEach((pt) => { expect(text).toMatch(new RegExp(`\\n\\| ${pt.label} \\|`)); });
		const totalLine = text.split('\n').find((l) => l.startsWith('| 合计 |'));
		expect(totalLine).toBeTruthy();
		const cells = totalLine.split('|').map((c) => c.trim()).slice(2, 9);
		['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].forEach((k, i) => { expect(cells[i]).toBe(`${af.totals[k] || ''}`); });
	});
	it('[择前考量] 三组全部列出:命中 ✗ / 未命中 ✓ / 提示 ·,行数 = 三组条目数', () => {
		const c = j.considerations;
		const all = c.lilly.concat(c.ramesey).concat(c.bonatti);
		const sec = text.slice(text.indexOf('[择前考量]'), text.indexOf('[危象日参照]') >= 0 ? text.indexOf('[危象日参照]') : text.indexOf('[应期]'));
		const items = sec.split('\n').filter((l) => /^- [✗✓·] /.test(l));
		expect(items.length).toBe(all.length);
		expect(items.filter((l) => l.startsWith('- ✗ ')).length).toBe(all.filter((it) => it.hit && it.severity !== 'info').length);
		expect(items.filter((l) => l.startsWith('- ✓ ')).length).toBe(all.filter((it) => !it.hit && it.severity !== 'info').length);
	});
	it('[回归与主限] 仅在 extra 带回归/主限数据时产段;段名已登记 preset', () => {
		expect(text).not.toContain('[回归与主限]');
		const withPd = buildElectionSnapshot(j, { pdHits: [{ date: '2026-09-20', deltaDays: 4, significator: '上升', promissor: '木星', method: 'Alcabitius' }] });
		expect(withPd).toContain('[回归与主限]');
		expect(withPd).toContain('- 2026-09-20（+4 日）：上升 ← 木星（Alcabitius）');
		const heads = withPd.match(/^\[[^\]]+\]$/gm).map((h) => h.slice(1, -1));
		heads.forEach((h) => expect(AI_EXPORT_PRESET_SECTIONS.election).toContain(h));
		expect(AI_EXPORT_PRESET_SECTIONS.election.indexOf('回归与主限')).toBe(AI_EXPORT_PRESET_SECTIONS.election.indexOf('本命合参') + 1);
	});
});
