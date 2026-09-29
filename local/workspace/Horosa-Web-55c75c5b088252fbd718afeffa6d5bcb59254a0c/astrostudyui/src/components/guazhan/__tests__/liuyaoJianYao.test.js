// 六爻间爻:世应中间的两爻(古籍「间爻者,世应中之二爻也」),随世位而定,不是固定的三、四爻。
// 全 64 卦逐一核:间爻恰在世应之间、从不含世应本身;各卦序类型的爻位;逐爻信息;概览卡片与 AI 快照同源。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { analyzeLiuyao } from '../../gua/liuyaoFacade';
import { Gua64 } from '../../gua/GuaConst';
import { DEFAULT_LIUYAO_SETTINGS } from '../../gua/liuyaoSchools';
import { jianYaoPositions, jianYaoSpanText, JIANYAO_ROLE, JIANYAO_DONG_NOTE } from '../../gua/LiuYaoConst';
import { LiuYaoManualCards } from '../LiuYaoBoard';
import { duanJueLines } from '../liuyaoSnapshotEx';

const CTX = { dayGan: '甲', dayZhi: '子', monthZhi: '午', yearGan: '丙', yearZhi: '子' };
const ana = (name, moving) => analyzeLiuyao(Gua64.find((g) => g.name === name), moving || [], CTX, DEFAULT_LIUYAO_SETTINGS);
// 卦序类型 → 间爻爻位(世应:本宫 6/3、一世 1/4、二世 2/5、三世 3/6、四世 4/1、五世 5/2、游魂 4/1、归魂 3/6)
const EXPECT = { 本宫: [4, 5], 一世: [2, 3], 二世: [3, 4], 三世: [4, 5], 四世: [2, 3], 五世: [3, 4], 游魂: [2, 3], 归魂: [4, 5] };
const jianLine = (a) => duanJueLines(a).find((l) => l.indexOf('间爻：') === 0);

describe('间爻爻位', () => {
	test('jianYaoPositions:取世应之间的爻,与世应先后无关;世应缺失或同位时返回空', () => {
		expect(jianYaoPositions(1, 4)).toEqual([2, 3]);
		expect(jianYaoPositions(4, 1)).toEqual([2, 3]);
		expect(jianYaoPositions(2, 5)).toEqual([3, 4]);
		expect(jianYaoPositions(5, 2)).toEqual([3, 4]);
		expect(jianYaoPositions(3, 6)).toEqual([4, 5]);
		expect(jianYaoPositions(6, 3)).toEqual([4, 5]);
		expect(jianYaoPositions(0, 3)).toEqual([]);
		expect(jianYaoPositions(3, 3)).toEqual([]);
		expect(jianYaoPositions(undefined, undefined)).toEqual([]);
	});

	test('全 64 卦:间爻恰为世应之间两爻,从不含世爻或应爻本身;八种卦序类型各 8 卦、爻位对表', () => {
		const seen = {};
		Gua64.forEach((g) => {
			const a = analyzeLiuyao(g, [], CTX, DEFAULT_LIUYAO_SETTINGS);
			const { shi, ying, type } = a.palaceType;
			const pos = a.jianYao.map((j) => j.pos);
			expect([g.name, pos]).toEqual([g.name, EXPECT[type]]);
			pos.forEach((p) => {
				expect(p > Math.min(shi, ying) && p < Math.max(shi, ying)).toBe(true);
				expect(p === shi || p === ying).toBe(false);
			});
			seen[type] = (seen[type] || 0) + 1;
		});
		expect(Object.keys(seen).sort()).toEqual(Object.keys(EXPECT).sort());
		Object.keys(seen).forEach((t) => expect([t, seen[t]]).toEqual([t, 8]));
	});

	test('典型卦:乾为天(世上应三)取四、五爻;天风姤(世初应四)取二、三爻;天山遁(世二应五)取三、四爻', () => {
		expect(ana('乾为天').jianYao.map((j) => j.pos)).toEqual([4, 5]);
		expect(ana('天风姤').jianYao.map((j) => j.pos)).toEqual([2, 3]);
		expect(ana('天山遁').jianYao.map((j) => j.pos)).toEqual([3, 4]);
		expect(jianYaoSpanText(6, 3)).toBe('世上应三之间');
		expect(jianYaoSpanText(1, 4)).toBe('世初应四之间');
		expect(jianYaoSpanText(0, 0)).toBe('');
	});
});

describe('间爻逐爻信息', () => {
	test('六亲 / 地支 / 五行 / 旺衰取自本卦该爻;对世、对应的关系只在七种之内', () => {
		Gua64.forEach((g) => {
			const a = analyzeLiuyao(g, [], CTX, DEFAULT_LIUYAO_SETTINGS);
			a.jianYao.forEach((j) => {
				const y = a.yaos[j.pos - 1];
				expect([j.liuqin, j.zhi, j.wuxing, j.wangShuai]).toEqual([y.liuqin, y.zhi, y.wuxing, y.wangShuai || '']);
				expect(j.toShi).toMatch(/^(冲世|合世|生世|克世|得世生|受世克|与世比和)$/);
				expect(j.toYing).toMatch(/^(冲应|合应|生应|克应|得应生|受应克|与应比和)$/);
			});
		});
	});

	test('乾为天(世上爻戌土、应三爻辰土):四爻午火生世生应,五爻申金得世生得应生', () => {
		const [j4, j5] = ana('乾为天').jianYao;
		expect([j4.zhi, j4.wuxing, j4.toShi, j4.toYing]).toEqual(['午', '火', '生世', '生应']);
		expect([j5.zhi, j5.wuxing, j5.toShi, j5.toYing]).toEqual(['申', '金', '得世生', '得应生']);
	});

	test('动静:间爻发动才标「动」;世应或他爻发动不算间爻发动', () => {
		const a = ana('乾为天', [4]);
		expect(a.jianYao.map((j) => j.moving)).toEqual([true, false]);
		expect(a.jianYao[0].tags).toContain('动');
		expect(ana('乾为天', [3]).jianYao.some((j) => j.moving)).toBe(false);   // 三爻是应爻
		expect(ana('乾为天', [6]).jianYao.some((j) => j.moving)).toBe(false);   // 上爻是世爻
	});
});

describe('概览卡片与 AI 快照同源', () => {
	test('概览卡片间爻一行:乾为天显示四爻、五爻,不再把三爻(应爻)当间爻;带位置说明与发动断语', () => {
		const html = renderToStaticMarkup(<LiuYaoManualCards analysis={ana('乾为天', [4])} />);
		const row = html.slice(html.indexOf('间爻</div>'));
		expect(row).toContain('四爻');
		expect(row).toContain('五爻');
		expect(row).not.toContain('三爻');
		expect(row).toContain(`世上应三之间·${JIANYAO_ROLE}`);
		expect(row).toContain(JIANYAO_DONG_NOTE);
		// 静卦不出发动断语
		expect(renderToStaticMarkup(<LiuYaoManualCards analysis={ana('乾为天', [])} />)).not.toContain(JIANYAO_DONG_NOTE);
	});

	test('AI 快照「间爻」行:爻位 / 标签 / 位置说明 / 发动断语与分析对象逐字一致', () => {
		const a = ana('乾为天', [4]);
		const body = a.jianYao.map((j) => `第${j.pos}爻${j.liuqin}${j.zhi}${j.wuxing}[${j.tags.join('·')}]`).join('、');
		expect(jianLine(a)).toBe(`间爻：${body}(世上应三之间·${JIANYAO_ROLE})；${JIANYAO_DONG_NOTE}`);
		expect(jianLine(a)).toMatch(/^间爻：第4爻.*、第5爻/);
		expect(jianLine(ana('天风姤'))).toMatch(/^间爻：第2爻.*、第3爻.*\(世初应四之间·/);
		expect(jianLine(ana('天风姤'))).not.toContain(JIANYAO_DONG_NOTE);
	});
});
