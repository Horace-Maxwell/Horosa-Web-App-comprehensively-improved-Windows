import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LiuYaoZhuangTable, LiuYaoYongShenView, LiuYaoDongBianView, LiuYaoXunKong, LiuYaoRelatedCards, LiuYaoReference } from '../LiuYaoBoard';
import { analyzeLiuyao } from '../../gua/liuyaoFacade';
import { applyPreset, DEFAULT_LIUYAO_SETTINGS } from '../../gua/liuyaoSchools';
import { Gua64, getGua64 } from '../../gua/GuaConst';

function ana(name, moving, settings){
	const g = Gua64.find((x) => x.name === name);
	return analyzeLiuyao(g, moving, { dayGan: '甲', dayZhi: '子', monthZhi: '午', yearGan: '丙', yearZhi: '午' }, settings || DEFAULT_LIUYAO_SETTINGS);
}

describe('六爻装卦表/用神/动变 渲染冒烟(SSR,捕获运行时JSX错误)', () => {
	test('装卦表渲染不抛、含六亲/世应/卦身', () => {
		const a = ana('火水未济', [3]);
		let html = '';
		expect(() => { html = renderToStaticMarkup(<LiuYaoZhuangTable analysis={a} movingSet={new Set([3])} />); }).not.toThrow();
		expect(html).toContain('官鬼');
		expect(html).toContain('世');
		expect(html).toContain('离宫·三世');
	});

	test('用神视图渲染不抛、含原忌仇(占财→妻财用神带原忌仇)', () => {
		const a = ana('火水未济', [3], { ...applyPreset('bushi'), askType: 'wealth' });
		let html = '';
		expect(() => { html = renderToStaticMarkup(<LiuYaoYongShenView analysis={a} />); }).not.toThrow();
		expect(html).toContain('用神');
		expect(html).toContain('原神');
		expect(html).toContain('忌神');
	});

	test('动变视图渲染不抛、含变卦', () => {
		const a = ana('乾为天', [1]);
		let html = '';
		expect(() => { html = renderToStaticMarkup(<LiuYaoDongBianView analysis={a} />); }).not.toThrow();
		expect(html).toContain('变卦');
		expect(html).toContain('天风姤');
	});

	test('静卦(无动爻)动变视图渲染不抛', () => {
		const a = ana('乾为天', []);
		let html = '';
		expect(() => { html = renderToStaticMarkup(<LiuYaoDongBianView analysis={a} />); }).not.toThrow();
		expect(html).toContain('无动爻');
	});

	test('全 5 流派预设 装卦表均渲染不抛(中右栏随流派变)', () => {
		['zengshan', 'bushi', 'yiyin', 'xinpai', 'mangpai'].forEach((sc) => {
			const a = ana('火水未济', [3], applyPreset(sc));
			expect(() => { renderToStaticMarkup(<LiuYaoZhuangTable analysis={a} movingSet={new Set([3])} />); }).not.toThrow();
		});
	});

	test('增删卜易 vs 易隐:卦身/神煞列差异在渲染中体现', () => {
		const zs = renderToStaticMarkup(<LiuYaoZhuangTable analysis={ana('火水未济', [3], applyPreset('zengshan'))} movingSet={new Set([3])} />);
		const yy = renderToStaticMarkup(<LiuYaoZhuangTable analysis={ana('火水未济', [3], applyPreset('yiyin'))} movingSet={new Set([3])} />);
		expect(zs).not.toContain('神煞'); // 增删卜易弃神煞 → 无神煞列
		expect(yy).toContain('神煞');     // 易隐用神煞 → 有神煞列
	});

	test('旬空卡渲染:含日空(+月空)', () => {
		const a = ana('火水未济', [3]);
		const html = renderToStaticMarkup(<LiuYaoXunKong analysis={a} />);
		expect(html).toContain('旬空');
		expect(html).toContain('日空');
	});

	test('装卦表含真空/假空状态(WP-D)', () => {
		// 甲子日午月:旬空戌亥;构造让某爻入旬空 → 表里出现 真空 或 假空
		const html = renderToStaticMarkup(<LiuYaoZhuangTable analysis={ana('火水未济', [3])} movingSet={new Set([3])} />);
		expect(/真空|假空|旬空/.test(html)).toBe(true);
	});

	test('关联卡:facade 提供之/互/伏神/综/错全装卦(六亲按本卦宫),卡片渲染含五卦', () => {
		const a = ana('火水未济', [3]); // 离宫·三世
		expect(a.related.fu.name).toBe('离为火');   // 伏神卦=本宫首卦
		expect(a.related.hu).toBeTruthy();
		expect(a.related.cuo).toBeTruthy();
		expect(a.related.zong).toBeTruthy();
		expect(a.related.bian).toBeTruthy();         // 有动爻→之卦
		expect(a.related.fu.yaos).toHaveLength(6);
		a.related.fu.yaos.forEach((y) => { expect(y.zhi && y.wuxing && y.liuqin).toBeTruthy(); });
		const html = renderToStaticMarkup(<LiuYaoRelatedCards analysis={a} />);
		['之卦', '互卦', '伏神　', '综卦', '错卦'].forEach((lbl) => { expect(html).toContain(lbl); });   // 伏神卡=「伏神」+全角空格接卦名(与表头「伏神」列区分)
	});

	test('关联卡:静卦无之卦(bian=null),仍渲染互/伏神/综/错', () => {
		const a = ana('乾为天', []);
		expect(a.related.bian).toBeNull();
		const html = renderToStaticMarkup(<LiuYaoRelatedCards analysis={a} />);
		expect(html).toContain('互卦');
		expect(html).not.toContain('之卦');
	});

	test('参考卡渲染:持世诀/六亲发动/六神发动/爻位象/常见占类 + 高亮持世六亲', () => {
		const a = ana('火水未济', [3]); // 三世·世爻=午火兄弟
		const html = renderToStaticMarkup(<LiuYaoReference analysis={a} />);
		['诸爻持世诀', '六亲发动诀', '六神发动歌', '爻位象', '常见占类'].forEach((t) => { expect(html).toContain(t); });
		expect(html).toContain('青龙'); // 六神发动
		expect(html).toContain('求财'); // 占类
		expect(html).toContain('◀持世'); // 高亮当前持世六亲
	});

	test('全 64 卦 × 默认设置 装卦表 渲染不抛(新暗黑令牌+伏神+真假空压测)', () => {
		getGua64(0);
		let n = 0;
		Gua64.forEach((g) => {
			const a = analyzeLiuyao(g, [1], { dayGan: '甲', dayZhi: '子', monthZhi: '午', yearGan: '丙', yearZhi: '午', monthGan: '丙' }, DEFAULT_LIUYAO_SETTINGS);
			expect(() => { renderToStaticMarkup(<LiuYaoZhuangTable analysis={a} movingSet={new Set([1])} />); }).not.toThrow();
			n++;
		});
		expect(n).toBe(64);
	});
});

// ══ [G-C] 盘面显示组(之卦简显/关联卦显隐/旺衰列/提示总开关/对齐档/快捷键/恢复默认) ═══
describe('[G-C] 六新键默认+接线守卫', ()=>{
	const fs = require('fs'); const path = require('path');
	const { DEFAULT_LIUYAO_SETTINGS, getLiuyaoOptionsKey } = require('../../gua/liuyaoSchools');
	test('🔴 默认值=现状零回归;九新键全入 optionsKey(防 analysis 不重建死开关)', ()=>{
		expect(DEFAULT_LIUYAO_SETTINGS.bianguaSimplify).toBe(false);
		expect(DEFAULT_LIUYAO_SETTINGS.relatedCards).toBe(null);
		expect(DEFAULT_LIUYAO_SETTINGS.wangShuaiCol).toBe(true);
		expect(DEFAULT_LIUYAO_SETTINGS.showTips).toBe(true);
		expect(DEFAULT_LIUYAO_SETTINGS.yaoHotkeys).toBe(false);
		expect(DEFAULT_LIUYAO_SETTINGS.titleAlign).toBe('center');
		const base = getLiuyaoOptionsKey({ ...DEFAULT_LIUYAO_SETTINGS });
		[['randomAlgo', 'yarrow'], ['randomConfirm', true], ['defaultYaoState', 'shaoyin'],
		 ['bianguaSimplify', true], ['relatedCards', ['hu']], ['wangShuaiCol', false],
		 ['showTips', false], ['yaoHotkeys', true], ['titleAlign', 'right']].forEach(([k, v])=>{
			expect(`${k}:${getLiuyaoOptionsKey({ ...DEFAULT_LIUYAO_SETTINGS, [k]: v }) !== base}`).toBe(`${k}:true`);
		});
	});
	test('🔴 Board 接线:旺衰列/提示族/简显位集三守卫;RelatedCards 显隐过滤+之卦简显位集来自本卦动变', ()=>{
		const src = fs.readFileSync(path.resolve(__dirname, '..', 'LiuYaoBoard.js'), 'utf8');
		expect(src.includes("settings.wangShuaiCol === false")).toBe(true);
		expect((src.match(/showWs \?/g) || []).length).toBe(2);   // Th+Cell 成对
		expect(src.includes("settings.showTips === false")).toBe(true);
		expect(/title=\{tipsOn && ZHI_CANGGAN/.test(src)).toBe(true);
		expect(src.includes('simplifyPositions')).toBe(true);
		expect(/simp && !simp\.has\(y\.pos\)/.test(src)).toBe(true);
		expect(/relatedCards\) \? analysis\.settings\.relatedCards : null/.test(src)).toBe(true);
		expect(/dongBian\.moves\.map\(\(m\) => m\.pos\)/.test(src)).toBe(true);
		expect(/sel\.indexOf\(c\.key\) >= 0/.test(src)).toBe(true);
	});
	test('G10/G11/G9:快捷键守卫(输入框豁免+1-6域)/对齐档/恢复默认按钮(源码守卫)', ()=>{
		const main = fs.readFileSync(path.resolve(__dirname, '..', 'GuaZhanMain.js'), 'utf8');
		expect(/handleYaoHotkey[\s\S]{0,400}tag === 'input' \|\| tag === 'textarea' \|\| tag === 'select'/.test(main)).toBe(true);
		expect(/n >= 1 && n <= 6/.test(main)).toBe(true);
		expect(main.includes("window.addEventListener('keydown', this.handleYaoHotkey)")).toBe(true);
		expect(main.includes("window.removeEventListener('keydown', this.handleYaoHotkey)")).toBe(true);
		const chart = fs.readFileSync(path.resolve(__dirname, '..', 'GZChart.js'), 'utf8');
		expect(chart.includes("settings.titleAlign === 'right'")).toBe(true);
		expect(/alignRight \? \(cord\.x \+ cord\.w - len\)/.test(chart)).toBe(true);
		expect(/恢复默认设置/.test(main)).toBe(true);
		expect(/Modal\.confirm\(\{[\s\S]{0,200}恢复默认断卦设置/.test(main)).toBe(true);
	});
});
