// 皇极轨策 · 爻画金标 —— 卦是画给人看的，画错即断错。
// 🔴 失败 = 画法错，不得改测试将就。
//
// 何以自画而不用卦符字(䷀ 一类)：本技法动爻是命门(演数/变卦/断法皆由之出)，
// 卦符字画不出「哪一爻动」，也分不出体用两半。邻页用符字是因其无此需。
//
// 🔴 本组守的头一条是【爻序】：lines 自下而上(初爻在 [0])，而 DOM 自上而下 →
//    渲染须倒排。倒错即上下卦颠倒 —— 是此类图最常犯的错，且肉眼极难察觉
//    (画面照样是六条杠，只是卦全反了)。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GuiceGuaGlyph from '../GuiceGuaGlyph';

// 自渲染结果反读回「自下而上」的爻串 —— 与引擎同序，可直接与其对拍
const readBackBottomUp = (html) => {
	const yaos = html.split('<span class="horosa-guice-yao').slice(1);
	return yaos.map((y) => (y.indexOf('horosa-guice-bar yang') >= 0 ? '1' : '0')).reverse().join('');
};

describe('轨策·爻画 · 爻序（倒错即上下卦全反）', () => {
	test('🔴 渲染自上而下，读回即引擎之序（自下而上）', () => {
		// 山地剥 = 下坤(000) 上艮(001) → 自下而上 000001
		const html = renderToStaticMarkup(<GuiceGuaGlyph lines={[0, 0, 0, 0, 0, 1]} />);
		expect(readBackBottomUp(html)).toBe('000001');
	});
	test('🔴 非对称卦不得画反：地雷复 100000（初爻独阳，须在最下)', () => {
		const html = renderToStaticMarkup(<GuiceGuaGlyph lines={[1, 0, 0, 0, 0, 0]} />);
		expect(readBackBottomUp(html)).toBe('100000');
		// 最上一爻(DOM 第一个)须是阴 —— 若画反则此处为阳
		const first = html.split('<span class="horosa-guice-yao')[1];
		expect(first.indexOf('horosa-guice-bar yin')).toBeGreaterThan(0);
	});
	test('阳爻一整条、阴爻两段留中', () => {
		const yang = renderToStaticMarkup(<GuiceGuaGlyph lines={[1, 1, 1, 1, 1, 1]} />);
		expect(yang.match(/horosa-guice-bar yang/g)).toHaveLength(6);
		expect(yang).not.toContain('<i>');
		const yin = renderToStaticMarkup(<GuiceGuaGlyph lines={[0, 0, 0, 0, 0, 0]} />);
		expect(yin.match(/horosa-guice-bar yin/g)).toHaveLength(6);
		expect(yin.match(/<i><\/i><i><\/i>/g)).toHaveLength(6);   // 每阴爻两段
	});
});

describe('轨策·爻画 · 动爻与体半（卦符字做不到者，正是此二）', () => {
	test('🔴 动爻只标一爻，且恰是所指之位', () => {
		const html = renderToStaticMarkup(<GuiceGuaGlyph lines={[0, 0, 0, 0, 0, 1]} dongYao={6} />);
		expect(html.match(/is-dong/g)).toHaveLength(1);
		// 六爻动 → 标在最上(DOM 第一个)
		expect(html.split('<span class="horosa-guice-yao')[1]).toContain('is-dong');
	});
	test('🔴 初爻动 → 标在最下(DOM 最后一个)', () => {
		const html = renderToStaticMarkup(<GuiceGuaGlyph lines={[1, 0, 0, 0, 0, 0]} dongYao={1} />);
		const parts = html.split('<span class="horosa-guice-yao');
		expect(parts[parts.length - 1]).toContain('is-dong');
	});
	test('体半描三爻，且上下不混', () => {
		const up = renderToStaticMarkup(<GuiceGuaGlyph lines={[0, 0, 0, 0, 0, 1]} tiHalf="up" />);
		expect(up.match(/is-ti/g)).toHaveLength(3);
		const lo = renderToStaticMarkup(<GuiceGuaGlyph lines={[0, 0, 0, 0, 0, 1]} tiHalf="lo" />);
		expect(lo.match(/is-ti/g)).toHaveLength(3);
		// 上半之体 → DOM 前三个带 is-ti；下半之体 → 后三个
		expect(up.split('<span class="horosa-guice-yao')[1]).toContain('is-ti');
		expect(lo.split('<span class="horosa-guice-yao')[1]).not.toContain('is-ti');
	});
	test('不传动爻/体半 → 一概不标（无卦之处不臆标）', () => {
		const html = renderToStaticMarkup(<GuiceGuaGlyph lines={[1, 0, 1, 0, 1, 0]} />);
		expect(html).not.toContain('is-dong');
		expect(html).not.toContain('is-ti');
	});
});

describe('轨策·爻画 · 三爻单卦（互卦只出八卦，不产六十四卦名）', () => {
	test('三爻亦可画，且序同', () => {
		const html = renderToStaticMarkup(<GuiceGuaGlyph lines={[1, 1, 0]} size="sm" />);   // 巽
		expect(readBackBottomUp(html)).toBe('110');
		expect(html).toContain('is-sm');
	});
	test('🔴 三爻之卦无动爻无体半可言 —— 纵然传了也不标（其非六爻之卦）', () => {
		const html = renderToStaticMarkup(<GuiceGuaGlyph lines={[1, 1, 0]} dongYao={2} tiHalf="lo" />);
		expect(html).not.toContain('is-dong');
		expect(html).not.toContain('is-ti');
	});
	test('坏输入 → 不画，不抛', () => {
		expect(renderToStaticMarkup(<div>{GuiceGuaGlyph({ lines: null })}</div>)).toBe('<div></div>');
		expect(renderToStaticMarkup(<div>{GuiceGuaGlyph({ lines: [1, 0] })}</div>)).toBe('<div></div>');
	});
});

// 🔴 与引擎对拍：画的必须就是引擎算的那个卦(两处各写一份必漂)
describe('轨策·爻画 · 与引擎所出之卦对拍', () => {
	const { guaBianAll } = require('../core/guiceGuaBian');
	test('山地剥六爻动：本/变/错/综 四卦之爻画皆与引擎逐位相符', () => {
		const r = guaBianAll('艮', '坤', 6);
		[['ben', r.ben], ['bian', r.bian], ['cuo', r.cuo], ['zong', r.zong]].forEach(([k, g]) => {
			const html = renderToStaticMarkup(<GuiceGuaGlyph lines={g.lines} />);
			expect(`${k}:${readBackBottomUp(html)}`).toBe(`${k}:${g.lines.join('')}`);
		});
	});
});
