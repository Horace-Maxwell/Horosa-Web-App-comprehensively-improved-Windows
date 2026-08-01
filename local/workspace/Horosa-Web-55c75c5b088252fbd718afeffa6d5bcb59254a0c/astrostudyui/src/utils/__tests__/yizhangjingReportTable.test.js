// 一掌经 report 表化 · 数值不变证明(fact-multiset)。
// baseline fixture = 表化前 buildYizhangjingSnapshotText 逐字输出(capture-if-missing,首跑于改造前抓取)。
// 断言:剥掉「表头行/GFM 分隔行」后,新旧「事实 token 多重集」完全相等 →
// 证明 [命宫与人事十二宫]/[大限]/[神煞合参] 只动排版(prose→GFM 表),盘面值一个不多一个不少。
// ⚠️ 若本测试红:说明改动碰了值而非排版,必须回查,禁止直接删基线重录将就。
import fs from 'fs';
import path from 'path';
import { buildYizhangjingModel, buildYizhangjingSnapshotText } from '../yizhangjingReport';

// 案例3:丁巳年(蛇) 农历五月十七 己酉时 男(与 yizhangjingReport.test 同夹具),开神煞合参层覆盖三段。
const baziCase3 = {
	gender: 'Male',
	nongli: { yearGZByLunar: '丁巳', shengXiaoLunar: '蛇', monthNum: 5, dayNum: 17, leap: false },
	fourColumns: { time: { ganzi: '己酉' }, month: { ganzi: '丙午' }, day: { ganzi: '戊申' }, year: { ganzi: '丁巳' } },
};
const OPTS = { shunniRule: 'yangNanYinNv', mingGongMethod: 'shuZhiMao', shenshaLayer: true };

// 仅取本测试所守的三段([命宫与人事十二宫]/[大限]/[神煞合参])切片 —— 其余段(WP-C 新增断语段)
// 属合法增量,不在「表化不变值」证明范围内;若全篇比对会把新增段误报为「值变」。
const GUARDED = ['命宫与人事十二宫', '大限', '神煞合参'];
function sliceGuardedSections(text) {
	const lines = `${text || ''}`.split('\n');
	const out = [];
	let on = false;
	for (let i = 0; i < lines.length; i++) {
		const m = /^【(.+)】$/.exec(lines[i]);
		if (m) { on = GUARDED.indexOf(m[1]) >= 0; if (on) out.push(lines[i]); continue; }
		if (on) out.push(lines[i]);
	}
	return out.join('\n');
}

// 通用:剥表头行(GFM 分隔行的上一行)+分隔行,再按 fact token 计多重集。数据行内若含表头词照常计数(无盲区)。
function extractFacts(rawText) {
	const text = sliceGuardedSections(rawText);
	const lines = `${text || ''}`.split('\n');
	const isSep = (s) => { const t = `${s || ''}`.trim(); return t.startsWith('|') && /^[|\s:-]+$/.test(t) && t.indexOf('-') >= 0; };
	const kept = [];
	for (let i = 0; i < lines.length; i++) {
		if (isSep(lines[i])) { kept.pop(); continue; }
		kept.push(lines[i]);
	}
	const tokens = kept.join('\n').match(/[一-龥A-Za-z0-9~+.]+/g) || [];
	const m = new Map();
	tokens.forEach((t) => m.set(t, (m.get(t) || 0) + 1));
	return m;
}
function diffFacts(a, b) {
	const out = [];
	const keys = new Set([...a.keys(), ...b.keys()]);
	keys.forEach((k) => { const av = a.get(k) || 0; const bv = b.get(k) || 0; if (av !== bv) { out.push(`${k}: 旧${av} vs 新${bv}`); } });
	return out;
}

const FIX = path.join(__dirname, 'fixtures', 'yizhangjingTableBaseline.txt');

describe('一掌经 report 表化 · 数值不变证明', () => {
	it('[命宫与人事十二宫]/[大限]/[神煞合参] 表化后事实多重集零变化', () => {
		const now = buildYizhangjingSnapshotText(buildYizhangjingModel(baziCase3, OPTS));
		if (!fs.existsSync(FIX)) {
			fs.mkdirSync(path.dirname(FIX), { recursive: true });
			fs.writeFileSync(FIX, now, 'utf8');
		}
		const baseline = fs.readFileSync(FIX, 'utf8');
		expect(diffFacts(extractFacts(baseline), extractFacts(now))).toEqual([]);
	});
	it('baseline fixture 为表化前基线(不含 GFM 表分隔行)', () => {
		const baseline = fs.readFileSync(FIX, 'utf8');
		expect(baseline).not.toMatch(/\| --- \|/);
	});
	it('表化后三段确含 GFM 表(分隔行)', () => {
		const now = buildYizhangjingSnapshotText(buildYizhangjingModel(baziCase3, OPTS));
		expect(now).toMatch(/\| --- \|/);
	});
});
