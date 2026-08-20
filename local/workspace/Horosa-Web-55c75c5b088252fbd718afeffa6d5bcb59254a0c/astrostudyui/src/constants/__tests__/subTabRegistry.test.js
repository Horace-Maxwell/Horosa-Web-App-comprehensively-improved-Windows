// 子页签 runtime 记忆哨兵:redux currentSubTab 共享单槽被别的主 tab 子键覆写后,
// 导航层回落必须优先取各组 runtime 记忆(合法才用),皆非法才回首档 ——
// 否则停在任意子技法切走再切回被静默打回首档(灵棋经/塔罗 × 风水/AI分析 实测三组复现的病)。
import {
	CNYIBU_SUBTABS, AUX_SUBTABS, ZERI_SUBTABS, CNTRADITION_SUBTABS,
	firstSubTab, resolveSubTab, rememberSubTab, recallSubTab,
} from '../SubTabRegistry';

const GROUPS = [
	['cnyibu', CNYIBU_SUBTABS, 'suzhan'],
	['auxchart', AUX_SUBTABS, 'germanytech'],
	['cntradition', CNTRADITION_SUBTABS, 'guasym'],
	['zeri', ZERI_SUBTABS, 'tianxing'],
];
const RUNTIME_KEY = {
	cnyibu: '__horosaCnyibuCurrentTab', auxchart: '__horosaAuxchartCurrentTab',
	cntradition: '__horosaCnTraditionCurrentTab', zeri: '__horosaZeriCurrentTab',
};

afterEach(() => { Object.values(RUNTIME_KEY).forEach((k) => { delete window[k]; }); });

describe('recallSubTab 回落三级', () => {
	test('current 合法 → 恒用 current(记忆不干扰)', () => {
		GROUPS.forEach(([g, list]) => {
			window[RUNTIME_KEY[g]] = list[list.length - 1];
			expect(recallSubTab(g, list, list[0], 'X')).toBe(list[0]);
		});
	});

	test('🔴 病灶场景:current 被别组子键污染 → 取 runtime 记忆(核心修复)', () => {
		// 停在灵棋经 → 切风水(currentSubTab 被写成风水子键)→ 切回 cnyibu
		rememberSubTab('cnyibu', 'lingqi', CNYIBU_SUBTABS);
		expect(recallSubTab('cnyibu', CNYIBU_SUBTABS, 'liqi-bazhai', 'suzhan')).toBe('lingqi');
		// 塔罗同验
		// 样例子键用 geomancy(tarot 已升一级不在 cnyibu 集,2026-08-15)。
		rememberSubTab('cnyibu', 'geomancy', CNYIBU_SUBTABS);
		expect(recallSubTab('cnyibu', CNYIBU_SUBTABS, undefined, 'suzhan')).toBe('geomancy');
		// 辅盘组
		rememberSubTab('auxchart', 'draconic', AUX_SUBTABS);
		expect(recallSubTab('auxchart', AUX_SUBTABS, 'whatever-alien', 'germanytech')).toBe('draconic');
	});

	test('current 与记忆皆非法 → fallback;缺省 fallback=首档', () => {
		GROUPS.forEach(([g, list, first]) => {
			window[RUNTIME_KEY[g]] = 'not-a-tab';
			expect(recallSubTab(g, list, 'also-bad', first)).toBe(first);
			expect(recallSubTab(g, list, 'also-bad')).toBe(firstSubTab(list));
		});
	});

	test('未知组无记忆槽:current 合法用之,否则 fallback(不炸)', () => {
		expect(recallSubTab('nope', ['a', 'b'], 'b', 'a')).toBe('b');
		expect(recallSubTab('nope', ['a', 'b'], 'zzz', 'a')).toBe('a');
	});
});

describe('rememberSubTab 入槽纪律', () => {
	test('合法值入槽;带 list 时非法值拒入(不污染记忆)', () => {
		rememberSubTab('cnyibu', 'lingqi', CNYIBU_SUBTABS);
		expect(window.__horosaCnyibuCurrentTab).toBe('lingqi');
		rememberSubTab('cnyibu', 'evil-tab', CNYIBU_SUBTABS);
		expect(window.__horosaCnyibuCurrentTab).toBe('lingqi');
	});

	test('空值/未知组静默跳过', () => {
		expect(() => rememberSubTab('cnyibu', '', CNYIBU_SUBTABS)).not.toThrow();
		expect(() => rememberSubTab('unknown-group', 'x', ['x'])).not.toThrow();
		expect(window.__horosaCnyibuCurrentTab).toBeUndefined();
	});

	test('cnyibu 键名恒为既有槽名(aiExport/CnYiBuMain 消费同键,改名即断链)', () => {
		rememberSubTab('cnyibu', 'lingqi', CNYIBU_SUBTABS);
		expect(window.__horosaCnyibuCurrentTab).toBe('lingqi');
	});
});

describe('宿主接线哨兵(remember 调用点在位)', () => {
	const fs = require('fs');
	const path = require('path');
	const read = (rel) => fs.readFileSync(path.join(__dirname, rel), 'utf8');
	test('导航各组回落分支全部走 recallSubTab(手写 indexOf 回落=复辟)', () => {
		const src = read('../../pages/index.js');
		const groups = ['cntradition', 'cnyibu', 'auxchart', 'zeri'];
		groups.forEach((g) => {
			expect(src).toContain(`recallSubTab('${g}'`);
		});
	});
	test('各宿主 changeTab 带 rememberSubTab(CnYiBuMain 走既有 setRuntimeCnYiBuTab 同键豁免)', () => {
		expect(read('../../components/auxchart/AuxChartMain.js')).toContain("rememberSubTab('auxchart'");
		expect(read('../../components/cntradition/CnTraditionMain.js')).toContain("rememberSubTab('cntradition'");
		expect(read('../../components/zeri/ZeriMain.js')).toContain("rememberSubTab('zeri'");
		expect(read('../../components/cnyibu/CnYiBuMain.js')).toContain('__horosaCnyibuCurrentTab');
	});
});
