// 世俗盘 MundaneMain [世俗宫义]/[地理分野] 表化 · 数值不变证明(fact-multiset)。
// 基线=改造前逐行格式(内联于本测试,与旧 buildAiSnapshot 逐字同源);新=抽出的 format* 纯函数。
// 断言:剥表头/分隔行后新旧事实多重集相等 → 只改排版,值零变化。宫号「第N宫」为原子 token,拆列不碰其内部。
// 星体段继承主盘(buildAstroSnapshotContent)不碰,不在本测试范围。
import { formatMundaneHouseTable, formatMundaneChorographyTable } from '../MundaneMain';
// buildAiSnapshot 里段头/数据集/免责行仍内联(护 roundtrip 源扫哨兵);helper 只出表体。此处补回同样前后缀再比。
const newHouse = (rows) => '[世俗宫义]\n' + formatMundaneHouseTable(rows);
const newChoro = (label, axes) => '[地理分野]\n数据集：' + label + '\n' + formatMundaneChorographyTable(axes) + '\n（多源综合·传统占星学术参考,非现实地缘断言）';

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

// 改前逐行格式(内联基线,逐字复刻旧 buildAiSnapshot 的 .map 表达式)
function oldHouse(rows) {
	return '[世俗宫义]\n' + rows.map((r) => `${r.planetCn} 第${r.house}宫(${r.houseMeaning})${r.signTemper ? ' [' + (r.sign || '') + '·' + r.signTemper.modeElement + ']' : ''}：${r.text}`).join('\n');
}
function oldChoro(label, axes) {
	return '[地理分野]\n数据集：' + label + '\n' + axes.map((a) => `${a.cn}：${a.regions.countries.slice(0, 4).join('、')}`).join('\n') + '\n（多源综合·传统占星学术参考,非现实地缘断言）';
}

const ROWS = [
	{ planetCn: '太阳', house: 10, houseMeaning: '政权/君主', sign: '白羊', signTemper: { modeElement: '基本火' }, text: '主国家领导权威显赫' },
	{ planetCn: '月亮', house: 4, houseMeaning: '民生/土地', text: '主民众土地安稳' },
	{ planetCn: '火星', house: 7, houseMeaning: '外交/战争', sign: '天蝎', signTemper: { modeElement: '固定水' }, text: '主对外冲突张力' },
];
const LABEL = '中西综合分野集';
const AXES = [
	{ cn: '白羊座', regions: { countries: ['英国', '德国', '波兰', '叙利亚', '法国'] } },
	{ cn: '金牛座', regions: { countries: ['爱尔兰', '瑞士', '伊朗'] } },
];

describe('世俗盘 [世俗宫义]/[地理分野] 表化 · 数值不变证明', () => {
	it('[世俗宫义] 事实多重集零变化', () => {
		expect(diffFacts(extractFacts(oldHouse(ROWS)), extractFacts(newHouse(ROWS)))).toEqual([]);
	});
	it('[地理分野] 事实多重集零变化', () => {
		expect(diffFacts(extractFacts(oldChoro(LABEL, AXES)), extractFacts(newChoro(LABEL, AXES)))).toEqual([]);
	});
	it('两段均已 GFM 表化且段头保留', () => {
		expect(newHouse(ROWS)).toMatch(/\[世俗宫义\][\s\S]*\| --- \|/);
		expect(newChoro(LABEL, AXES)).toMatch(/\[地理分野\][\s\S]*\| --- \|/);
	});
});
