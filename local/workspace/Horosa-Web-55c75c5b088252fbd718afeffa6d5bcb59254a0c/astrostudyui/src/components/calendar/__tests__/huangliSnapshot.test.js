// 老黄历 AI 快照 builder + 日课卡 SSR 冒烟。
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildHuangliDay } from '../huangliDay';
import { buildHuangliSnapshotText } from '../huangliSnapshot';
import HuangLiDayCard from '../HuangLiDayCard';

describe('老黄历 AI 快照文本', () => {
	const text = buildHuangliSnapshotText(buildHuangliDay(2024, 6, 10, 10));

	test('含全部分区段头', () => {
		['[起盘信息]', '[今日宜忌]', '[值神值宿]', '[彭祖百忌]', '[吉神凶煞]', '[冲煞·胎神·方位]', '[时辰吉凶]', '[流年年神方位]', '[方法说明]']
			.forEach((seg)=> expect(text).toContain(seg));
	});

	test('关键真值落文', () => {
		expect(text).toContain('乙巳日');
		expect(text).toContain('嫁娶');
		expect(text).toContain('乙不栽植千株不长');
		expect(text).toContain('闭日');
		expect(text).toContain('冲猪');
	});

	test('空 day 返回空串', () => {
		expect(buildHuangliSnapshotText(null)).toBe('');
	});
});

describe('老黄历日课卡 SSR 冒烟', () => {
	test('渲染不抛且含宜/忌/建除', () => {
		let html = '';
		expect(()=>{ html = renderToStaticMarkup(<HuangLiDayCard day={buildHuangliDay(2024, 6, 10, 10)} />); }).not.toThrow();
		expect(html).toContain('宜');
		expect(html).toContain('忌');
		expect(html).toContain('闭');
	});

	test('空 day 显示占位', () => {
		let html = '';
		expect(()=>{ html = renderToStaticMarkup(<HuangLiDayCard day={null} />); }).not.toThrow();
		expect(html).toContain('选择日期');
	});
});
