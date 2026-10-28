// 紫微运限统一真值源(luckSel)纯逻辑自检：运限角色字、四化滑窗(末3层+自化开关)、长生标签层、
// 流年小限合并状态机(选大限不自动补流年；选流年同时定小限按虚岁对齐；选更深层重置)。
jest.mock('d3', () => ({}));

import * as ZiWeiHelper from '../ZiWeiHelper';
import {
	buildDaxianItems,
	buildLiunianItems,
	buildXiaoxianItems,
	buildLiuyueItems,
	emptyLuckSel,
	luckSelectDaxian,
	luckSelectLiunian,
	luckSelectLiuyue,
	luckSelectLiuri,
} from '../ZWLuckPanel';

const DIZI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GANS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
function makeChart() {
	const houses = [];
	for (let i = 0; i < 12; i++) {
		houses.push({
			id: `h${i}`,
			name: `宫${i}`,
			ganzi: GANS[i % 10] + DIZI[i],
			direction: [6 + i * 6, 6 + i * 6 + 5],
			starsMain: [], starsAssist: [], starsEvil: [],
			starsOthersGood: [], starsOthersBad: [], starsSmall: [], stars: [],
		});
	}
	return { birth: '1990-05-18 10:00:00', gender: 'Male', zidou: '子', yearZi: '午', yearGan: '庚', lifeHouseIndex: 2, houses };
}

describe('luckRoleChar：与大限「运X」同口径', () => {
	it('delta=0→命、相邻→兄/父，环绕正确', () => {
		expect(ZiWeiHelper.luckRoleChar(5, 5)).toBe('命');
		expect(ZiWeiHelper.luckRoleChar(5, 4)).toBe('兄'); // delta=1 → 兄弟宫
		expect(ZiWeiHelper.luckRoleChar(5, 6)).toBe('父'); // delta=-1 → 父母宫
		expect(ZiWeiHelper.luckRoleChar(0, 6)).toBe('迁'); // delta=-6 → 迁移宫
		expect(ZiWeiHelper.luckRoleChar(7, 0)).toBe('友'); // delta=7 → 交友宫简写「友」(非「交」)
	});
	it('空入参 → 空串（防 NaN 落字）', () => {
		expect(ZiWeiHelper.luckRoleChar(null, 3)).toBe('');
		expect(ZiWeiHelper.luckRoleChar(3, null)).toBe('');
	});
});

describe('luckSihuaWindow：滑窗末3层 + 自化仅无运限', () => {
	const L = (sel) => ZiWeiHelper.luckSihuaWindow(sel, '庚');
	const keys = (r) => r.layers.map((x) => x.key);
	it('无运限 → [本命] + 自化', () => {
		const r = L(emptyLuckSel());
		expect(keys(r)).toEqual(['benming']);
		expect(r.showZihua).toBe(true);
	});
	it('大限 → [本命,大限]，自化关', () => {
		const r = L({ ...emptyLuckSel(), daxian: { mingIndex: 2, gan: '丙' } });
		expect(keys(r)).toEqual(['benming', 'daxian']);
		expect(r.showZihua).toBe(false);
	});
	it('流年 → [本命,大限,流年]', () => {
		const r = L({ ...emptyLuckSel(), daxian: { mingIndex: 2, gan: '丙' }, liunian: { mingIndex: 4, gan: '戊' } });
		expect(keys(r)).toEqual(['benming', 'daxian', 'liunian']);
	});
	it('流月 → 末3=[大限,流年,流月]（本命滑出）', () => {
		const r = L({ ...emptyLuckSel(), daxian: { mingIndex: 2, gan: '丙' }, liunian: { mingIndex: 4, gan: '戊' }, liuyue: { mingIndex: 6, gan: '庚' } });
		expect(keys(r)).toEqual(['daxian', 'liunian', 'liuyue']);
	});
	it('流时 → 末3=[流月,流日,流时]', () => {
		const sel = { daxian: { mingIndex: 1, gan: '甲' }, liunian: { mingIndex: 2, gan: '乙' }, xiaoxian: null,
			liuyue: { mingIndex: 3, gan: '丙' }, liuri: { mingIndex: 4, gan: '丁' }, liushi: { mingIndex: 5, gan: '戊' } };
		expect(keys(L(sel))).toEqual(['liuyue', 'liuri', 'liushi']);
	});
});

describe('luckLabelLayers：仅 流年/月/日/时（大限运X另出、本命不画）', () => {
	it('前缀正确、不含本命/大限', () => {
		const sel = { ...emptyLuckSel(), daxian: { mingIndex: 1, gan: '甲' }, liunian: { mingIndex: 2, gan: '乙' }, liuyue: { mingIndex: 3, gan: '丙' } };
		const labels = ZiWeiHelper.luckLabelLayers(sel);
		expect(labels.map((l) => l.prefix)).toEqual(['年', '月']);
		expect(labels.map((l) => l.key)).toEqual(['liunian', 'liuyue']);
	});
});

describe('luckDeepestMingIndex：最深选中层驱动金框', () => {
	it('取最深层 mingIndex；无选中→null', () => {
		expect(ZiWeiHelper.luckDeepestMingIndex(emptyLuckSel())).toBeNull();
		expect(ZiWeiHelper.luckDeepestMingIndex({ ...emptyLuckSel(), daxian: { mingIndex: 7 } })).toBe(7);
		expect(ZiWeiHelper.luckDeepestMingIndex({ ...emptyLuckSel(), daxian: { mingIndex: 7 }, liunian: { mingIndex: 3 }, liushi: { mingIndex: 9 } })).toBe(9);
	});
});

describe('运限状态机：流年小限合并 + 重置语义', () => {
	const chart = makeChart();
	it('选大限：仅定大限，不自动补流年（需求5 大限→[本命,大限]）', () => {
		const dx = buildDaxianItems(chart)[0];
		const sel = luckSelectDaxian(chart, dx, emptyLuckSel());
		expect(sel.daxian).toBe(dx);
		expect(sel.liunian).toBeNull();
		expect(sel.xiaoxian).toBeNull();
		expect(sel.liuyue).toBeNull();
	});
	it('选流年小限：同年同时定流年+小限（按虚岁对齐），清空更深层', () => {
		const dx = buildDaxianItems(chart)[0];
		let sel = luckSelectDaxian(chart, dx, emptyLuckSel());
		const ln = buildLiunianItems(chart, dx)[0];
		sel = luckSelectLiunian(chart, ln, sel);
		expect(sel.liunian).toBe(ln);
		expect(sel.xiaoxian).not.toBeNull();
		expect(sel.xiaoxian.age).toBe(ln.age); // 虚岁对齐
		expect(sel.liuyue).toBeNull();
	});
	it('选更深层后再选大限 → 下层全部重置', () => {
		const dx = buildDaxianItems(chart)[0];
		let sel = luckSelectDaxian(chart, dx, emptyLuckSel());
		sel = luckSelectLiunian(chart, buildLiunianItems(chart, dx)[0], sel);
		sel = luckSelectLiuyue(chart, buildLiuyueItems(chart, sel.liunian.year)[0], sel);
		expect(sel.liuyue).not.toBeNull();
		sel = luckSelectDaxian(chart, dx, sel);
		expect(sel.liunian).toBeNull();
		expect(sel.xiaoxian).toBeNull();
		expect(sel.liuyue).toBeNull();
	});
	it('流年与小限逐虚岁一一对应（合并行可用同一 age 索引）', () => {
		const dx = buildDaxianItems(chart)[1];
		const ln = buildLiunianItems(chart, dx);
		const xx = buildXiaoxianItems(chart, dx);
		expect(ln.length).toBe(xx.length);
		const lnAges = ln.map((x) => x.age);
		const xxAges = xx.map((x) => x.age);
		expect(lnAges).toEqual(xxAges);
	});
});

describe('运限芯片条:横向滚动条从首次排版就占位', () => {
	// 用 auto 时滚动条在首次排版之后才出现(从展开版式切回紧凑即如此),WebKit 不把它补进条带高度,
	// 滚动条从拉伸的芯片里扣掉 → 整行连层名一起被压扁,直到下一次重排
	const path = require('path');
	const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');
	const css = readSource(path.join(__dirname, '../../../layouts/app.less'));
	const ruleOf = (sel) => {
		const i = css.indexOf(`${sel} {`);
		expect(i).toBeGreaterThanOrEqual(0);
		return css.slice(i, css.indexOf('}', i));
	};
	it('紧凑版式:芯片条横向 scroll(不是 auto)', () => {
		const body = ruleOf('.horosa-workspace-shell .horosa-ziwei-luck-axis');
		expect(body).toMatch(/overflow-x:\s*scroll;/);
		expect(body).not.toMatch(/overflow-x:\s*auto;/);
	});
	it('展开版式:芯片折行铺开、不滚动', () => {
		const body = ruleOf('.horosa-workspace-shell .horosa-ziwei-luck.is-wrap .horosa-ziwei-luck-axis');
		expect(body).toMatch(/flex-wrap:\s*wrap;/);
		expect(body).toMatch(/overflow-x:\s*visible;/);
	});
});
