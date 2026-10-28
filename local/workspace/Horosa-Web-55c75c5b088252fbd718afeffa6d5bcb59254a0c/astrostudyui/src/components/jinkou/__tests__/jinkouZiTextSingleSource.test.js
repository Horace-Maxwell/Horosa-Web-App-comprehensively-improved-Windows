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
		const src = fs.readFileSync(path.join(__dirname, '..', 'JinKouMain.js'), 'utf8');
		expect(src).toContain("import { resolveJinKouDiFen, normalizeZiFromText } from './JinKouState';");
		expect(src).not.toContain('function normalizeZiFromText(');
	});
});
