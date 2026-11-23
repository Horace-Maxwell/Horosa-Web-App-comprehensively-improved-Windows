// 金口诀:从文本里取首个地支 normalizeZiFromText 单一来源在 JinKouState(地分解析同用),主页改为 import。
import fs from 'fs';
import path from 'path';
import { normalizeZiFromText, resolveJinKouDiFen } from '../JinKouState';

describe('金口诀取支单一来源', ()=>{
	test('取文本里第一个地支;没有回空串', ()=>{
		expect(normalizeZiFromText('甲子')).toBe('子');
		expect(normalizeZiFromText('丙午时')).toBe('午');
		expect(normalizeZiFromText('auto')).toBe('');
		expect(normalizeZiFromText(null)).toBe('');
		expect(typeof resolveJinKouDiFen).toBe('function');
	});
	test('源码:主页不再自带一份', ()=>{
		const { readSource, importedFrom } = require('../../../utils/__tests__/helpers/sourceSet');
		const facade = path.join(__dirname, '..', 'JinKouMain.js');
		const src = readSource(facade);
		// 按组件全集判(类方法拆在 main/ 下时,引入跟着用它的方法走)
		const got = importedFrom(facade, path.join(__dirname, '..', 'JinKouState'));
		expect(got.has('resolveJinKouDiFen') && got.has('normalizeZiFromText')).toBe(true);
		expect(src).not.toContain('function normalizeZiFromText(');
	});
});
