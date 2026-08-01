// AI 导出 · 技法判定表无一漏登（漏一个 = 在那一页点导出，静默导成【别的技法】）
//
// 🔴 病理（本轮真机点了一次导出才现形）：
//    导出侧靠 cnyibuMap[当前子tab] 判定「导的是谁」，而其兜底是 `|| cnyibuMap.suzhan`——
//    漏登记者遂【静默】落宿盘：人在皇极轨策页上点导出，得到的是「技术: 宿占」+ 宿盘的段，
//    而导出头里还写着「当前激活技术面板专属导出」。不报错、不告警，只是导错了人。
//    geomancy / tarot / guice 三个都这么漏了许久 —— builder 单测照不到此处（那测的是
//    「给定 key 出什么」，而这里错的是「key 本身取错了」）。
//
// 判据机械求差，不手抄名单：宿主的 CNYIBU_VALID_TABS ⊆ 导出侧的 cnyibuMap。
import fs from 'fs';
import path from 'path';
import { AI_EXPORT_PRESET_SECTIONS } from '../aiExport';
import { CNYIBU_SUBTABS } from '../../constants/SubTabRegistry';

const EXPORT_SRC = fs.readFileSync(path.join(__dirname, '..', 'aiExport.js'), 'utf8');
const HOST_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'components', 'cnyibu', 'CnYiBuMain.js'), 'utf8');

/** 宿主认的子tab —— 真值源。
 *  这份名单已从 CnYiBuMain 的手写字面量归一到 constants/SubTabRegistry(导航层同源,
 *  见「切走再切回被打回首档」那类缺陷),故直接 import,比正则扒字面量更可靠。 */
const VALID_TABS = CNYIBU_SUBTABS;

/** 导出侧的判定表 */
const MAP = (() => {
	const blk = (EXPORT_SRC.match(/const cnyibuMap = \{([\s\S]*?)\n\t\t\};/) || ['', ''])[1];
	const out = {};
	(blk.match(/^\t\t\t(\w+): \{ key: '(\w+)'/gm) || []).forEach((line) => {
		const m = line.match(/(\w+): \{ key: '(\w+)'/);
		out[m[1]] = m[2];
	});
	return out;
})();

describe('导出判定 · 解析器自检（判据本身须可信）', () => {
	test('两份名单皆解析得出且量级合理', () => {
		expect(VALID_TABS.length).toBeGreaterThan(8);
		expect(VALID_TABS).toContain('guice');
		expect(Object.keys(MAP).length).toBeGreaterThan(8);
		// 宿主必须仍在用那个真值源 —— 若有人改回手写字面量,两侧会再次各自漂移。
		expect(HOST_SRC).toContain('const CNYIBU_VALID_TABS = CNYIBU_SUBTABS;');
	});
});

describe('🔴 导出判定 · 无一漏登（漏一个 = 那一页导出静默变成宿盘）', () => {
	test('宿主认的每个子tab，导出侧都认得', () => {
		const missing = VALID_TABS.filter((t) => !MAP[t]);
		expect(missing).toEqual([]);
	});

	test('🔴 每个登记的 key 都有其段表（有 key 无段 = 导出一片空）', () => {
		const noSections = Object.values(MAP)
			.filter((k) => !AI_EXPORT_PRESET_SECTIONS[k] || !AI_EXPORT_PRESET_SECTIONS[k].length);
		expect(noSections).toEqual([]);
	});

	test('轨策登记正确（真机实测：此前导出头写的是「技术: 宿占」）', () => {
		expect(MAP.guice).toBe('guice');
		expect(AI_EXPORT_PRESET_SECTIONS.guice.length).toBe(10);
	});

	test('顺带修的两个既有技法也登记了（其漏得比轨策还久）', () => {
		expect(MAP.geomancy).toBe('geomancy');
		expect(MAP.tarot).toBe('tarot');
	});
});

describe('🔴 导出判定 · 兜底须先喊一声（静默落宿盘正是此病潜伏至今之由）', () => {
	test('cnyibu 那一支在落兜底前告警', () => {
		const seg = (EXPORT_SRC.match(/case 'cnyibu': \{[\s\S]*?\n\t\t\}/) || [''])[0];
		expect(seg).toContain('console.warn');
		expect(seg).toContain('cnyibuMap');
		// 且告警须点出是哪个 tab 漏了，否则等于没说
		expect(seg).toMatch(/\$\{cnyibuTab\}/);
	});
});
