// 六爻右栏「占类」页:模块载入即经共享 loadDoctrine 预热断语库(载入失败回 null、永不 reject),
// 首次渲染若已载好就直接出断语;载入前显示「载入中」。不再对外暴露手动注入口。
jest.mock('../../gua/data/liuyaoDoctrineCache', ()=>{
	const DOC = { '总断门第一': [{ source: '古籍', text: '纲领一句' }], '求财门': [{ source: '古籍', text: '求财一句' }] };
	return {
		__DOC: DOC,
		loadDoctrine: jest.fn(()=>Promise.resolve(DOC)),
		ASK_TO_DOCTRINE: { wealth: ['求财'] },
	};
});

import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const SRC = fs.readFileSync(path.join(__dirname, '..', 'LiuYaoZhanLeiView.js'), 'utf8');

describe('占类页断语库预热', ()=>{
	test('模块载入即预热一次;微任务后首次渲染直接出断语', async ()=>{
		const cache = require('../../gua/data/liuyaoDoctrineCache');
		const mod = require('../LiuYaoZhanLeiView');
		expect(cache.loadDoctrine).toHaveBeenCalledTimes(1);
		await Promise.resolve();
		await Promise.resolve();
		const html = renderToStaticMarkup(React.createElement(mod.default, { analysis: { settings: { askType: 'wealth' } }, currentGuaName: '', castLines: null }));
		expect(html).toContain('总断门第一');
		expect(html).toContain('求财一句');
		expect(html).toContain('全库 2 门 2 条');
		expect(html).not.toContain('断语库载入中');
		expect(mod.setZhanleiDoctrine).toBeUndefined();
	});

	test('源码:预热直调,不再外包 try / 空 catch', ()=>{
		expect(SRC).toContain('\nloadDoctrine().then((d) => { doctrineData = d; });\n');
		expect(SRC).not.toMatch(/try\{\s*\/\/[^\n]*\n\s*loadDoctrine\(\)/);
		expect(SRC).not.toContain('.catch(() => {})');
		expect(SRC).not.toContain('setZhanleiDoctrine');
	});
});
