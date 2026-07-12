// 皇极经世 HuangJiMain buildSnapshotText [历史年表] 表化 · 数值不变证明。
// baseline fixture = 表化前 buildSnapshotText 逐字输出(capture-if-missing,首跑于改造前)。
// 旧行 `${start}年起（${dur}年）：朝代 称号 名 年号` 将「960年起」「319年」数字与后缀拼成一 token;
// 表化拆列 起始年|历时|朝代|称号|名|年号 写净数字,归一时把后缀词(年起/年)替换为空格(两侧同法)后比多重集。
// pan.sections 通用段不碰(此 fixture 空 sections → 触发兜底 [历史年表])。
import fs from 'fs';
import path from 'path';
import { buildSnapshotText } from '../HuangJiMain';

function extractFacts(text) {
	const lines = `${text || ''}`.split('\n');
	const isSep = (s) => { const t = `${s || ''}`.trim(); return t.startsWith('|') && /^[|\s:-]+$/.test(t) && t.indexOf('-') >= 0; };
	const kept = [];
	for (let i = 0; i < lines.length; i++) { if (isSep(lines[i])) { kept.pop(); continue; } kept.push(lines[i]); }
	let s = kept.join('\n');
	['年起', '年'].forEach((w) => { s = s.split(w).join(' '); }); // 数字后缀,拆开数值(960年起→960 / 319年→319)
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
	const pan = {
		sections: [],
		history: [
			{ start_year: 960, duration: 319, dynasty: '宋', title: '太祖', name: '赵匡胤', era: '建隆' },
			{ start_year: 1279, duration: 90, dynasty: '元', title: '世祖', name: '忽必烈', era: '至元' },
			{ start_year: 1368, duration: 276, dynasty: '明', title: '太祖', name: '朱元璋', era: '洪武' },
		],
		classics: null,
	};
	return buildSnapshotText(pan, null);
}

const FIX = path.join(__dirname, 'fixtures', 'huangjiHistoryTableBaseline.txt');

describe('皇极经世 [历史年表] 表化 · 数值不变证明', () => {
	it('表化后事实多重集零变化(数字后缀归一)', () => {
		const now = build();
		if (!fs.existsSync(FIX)) { fs.mkdirSync(path.dirname(FIX), { recursive: true }); fs.writeFileSync(FIX, now, 'utf8'); }
		expect(diffFacts(extractFacts(fs.readFileSync(FIX, 'utf8')), extractFacts(now))).toEqual([]);
	});
	it('baseline 为表化前基线(不含 GFM 表)', () => { expect(fs.readFileSync(FIX, 'utf8')).not.toMatch(/\| --- \|/); });
	it('[历史年表] 已 GFM 表化', () => { expect(build()).toMatch(/\[历史年表\][\s\S]*\| --- \|/); });
});
