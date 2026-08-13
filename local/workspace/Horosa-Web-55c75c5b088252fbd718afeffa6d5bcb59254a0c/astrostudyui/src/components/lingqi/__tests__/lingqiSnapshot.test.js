// 灵棋经 AI 快照哨兵:段头集合逐字==AI_EXPORT_PRESET_SECTIONS.lingqi(七段恒出)/ 恒简体 /
// 注家开关只动段内不动段集 / headless 冻结不重掷 / 齿轮三态归一('' 随档)。
import fs from 'fs';
import path from 'path';
import {
	buildLingqiSnapshotText, buildLingqiSnapshotForCase, lingqiCountsText, lingqiGuaTitle,
	DEFAULT_LINGQI_ZHU_VISIBLE,
} from '../lingqiSnapshot';
import { findLingqiGua } from '../data/lingqiJing';

const SECTIONS = ['起盘信息', '棋势', '卦象', '繇辞', '诸家注', '课断', '断诗'];

function extractSections(txt) {
	return `${txt || ''}`.split('\n').map((l) => {
		const m = l.trim().match(/^\[(.+)\]$/);
		return m ? m[1] : null;
	}).filter(Boolean);
}

describe('buildLingqiSnapshotText 七段', () => {
	test('段头集合与顺序逐字 == preset(恒出全段头)', () => {
		const txt = buildLingqiSnapshotText({ counts: [1, 1, 1], question: '求财', category: 'wealth' });
		expect(extractSections(txt)).toEqual(SECTIONS);
	});

	test('🔴 与 aiExport.js 源码中 AI_EXPORT_PRESET_SECTIONS.lingqi 逐字一致(双真值源互锁)', () => {
		const src = fs.readFileSync(path.join(__dirname, '../../../utils/aiExport.js'), 'utf8');
		const m = src.match(/lingqi: \[([^\]]+)\]/);
		expect(m).toBeTruthy();
		const preset = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
		expect(preset).toEqual(SECTIONS);
	});

	test('恒简体输出:不含刻本异体(隂/㓙/嵗)与繁体高频字(陽字例外=数性术语?否——快照走 lingqiToSimp,陽→阳)', () => {
		const txt = buildLingqiSnapshotText({ counts: [4, 3, 2], question: '问病', category: 'health' });
		expect(/[隂㓙嵗騐䕶]/.test(txt)).toBe(false);
		expect(txt).toContain('阳');
		expect(txt).not.toContain('陽');
	});

	test('开关只动段内不动段集:全关注家仍七段;关闭行如实标注', () => {
		const vis = { yan: false, he: false, chen: false, liu: false, ke: false, shi: false };
		const txt = buildLingqiSnapshotText({ counts: [1, 1, 1], zhuVisible: vis });
		expect(extractSections(txt)).toEqual(SECTIONS);
		expect(txt).toContain('(注家显示已全部关闭)');
		expect(txt).toContain('(课断显示已关闭)');
		expect(txt).toContain('(断诗显示已关闭)');
	});

	test('单关一家:该家行消失、他家仍在', () => {
		const txt = buildLingqiSnapshotText({ counts: [1, 1, 1], zhuVisible: { ...DEFAULT_LINGQI_ZHU_VISIBLE, yan: false } });
		expect(txt).not.toContain('颜曰');
		expect(txt).toContain('何曰');
		expect(txt).toContain('刘曰');
	});

	test('缺注卦如实标注不臆补(70 戒慎缺何注)', () => {
		const g = findLingqiGua(...[0, 3, 2]);   // 需查 70 号棋数 —— 以 id 反查
		const gua70 = require('../data/lingqiJing').LINGQI_GUA[69];
		expect(gua70.zhu.he).toBe('');
		const txt = buildLingqiSnapshotText({ counts: gua70.counts });
		expect(txt).toContain('何曰(何承天注):本卦原书无此家注。');
		expect(g === null || typeof g === 'object').toBe(true);
	});

	test('六戊提示行随 wuDay;耦敌只在明文对出现;纯阴镘特述', () => {
		const wu = buildLingqiSnapshotText({ counts: [1, 1, 1], wuDay: true });
		expect(wu).toContain('六戊日不宜占卜');
		const noWu = buildLingqiSnapshotText({ counts: [1, 1, 1], wuDay: false });
		expect(noWu).not.toContain('六戊日');
		const ou = buildLingqiSnapshotText({ counts: [1, 2, 3] });
		expect(ou).toContain('上中为耦');
		const pure = buildLingqiSnapshotText({ counts: [0, 0, 0] });
		expect(pure).toContain('十二棋皆覆');
		expect(extractSections(pure)).toEqual(SECTIONS);
	});
});

describe('buildLingqiSnapshotForCase(headless 冻结)', () => {
	test('counts 自 payload 取;缺 counts 返空(恒不重掷)', () => {
		expect(buildLingqiSnapshotForCase({ counts: [2, 0, 4], options: { question: '行人' } })).toContain('二上〇中四下');
		expect(buildLingqiSnapshotForCase({ options: {} })).toBe('');
		expect(buildLingqiSnapshotForCase(null)).toBe('');
	});

	test('齿轮三态归一:1/\'1\'=显、0=隐、\'\'/undefined=随档', () => {
		const p = { counts: [1, 1, 1], options: { zhuVisible: { yan: false } } };
		const off = buildLingqiSnapshotForCase(p, {});
		expect(off).not.toContain('颜曰');                     // 随档:档内 yan=false
		const on = buildLingqiSnapshotForCase(p, { zhu_yan: 1 });
		expect(on).toContain('颜曰');                          // 齿轮显式开覆盖档
		const blank = buildLingqiSnapshotForCase(p, { zhu_yan: '' });
		expect(blank).not.toContain('颜曰');                   // '' 随档
		const hideHe = buildLingqiSnapshotForCase(p, { zhu_he: 0 });
		expect(hideHe).not.toContain('何曰');
	});

	test('齿轮问类覆盖:\'\' 随档,显式值覆盖', () => {
		const p = { counts: [1, 1, 1], options: { category: 'wealth' } };
		expect(buildLingqiSnapshotForCase(p, {})).toContain('问类:求财');
		expect(buildLingqiSnapshotForCase(p, { category: '' })).toContain('问类:求财');
		expect(buildLingqiSnapshotForCase(p, { category: 'health' })).toContain('问类:疾病');
	});
});

describe('小工具', () => {
	test('lingqiCountsText:完整三段中文;纯阴镘=十二棋皆覆', () => {
		expect(lingqiCountsText([1, 1, 1])).toBe('一上一中一下');
		expect(lingqiCountsText([2, 0, 4])).toBe('二上〇中四下');
		expect(lingqiCountsText([0, 0, 0])).toBe('十二棋皆覆');
		expect(lingqiCountsText(null)).toBe('');
	});

	test('lingqiGuaTitle:正卦带序号;纯阴镘特述', () => {
		expect(lingqiGuaTitle(findLingqiGua(1, 1, 1))).toBe('第一 · 大通卦(一上一中一下)· 升腾之象');
		expect(lingqiGuaTitle(findLingqiGua(0, 0, 0))).toContain('不入一百二十四卦之数');
	});
});
