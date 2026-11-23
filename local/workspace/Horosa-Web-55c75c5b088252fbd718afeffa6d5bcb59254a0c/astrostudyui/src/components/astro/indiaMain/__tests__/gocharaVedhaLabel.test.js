// 行运 Gochara:只有「吉位被别的曜遮」才写被遮(凶位 effective 本来为假,不能拿它判);罗睺 / 计都无 BAV 只给 SAV
import fs from 'fs';
import path from 'path';
import { readSource } from '../../../../utils/__tests__/helpers/sourceSet';   // 拆成子模块的大文件按「门面 + 子模块」全集读
import { gocharaVedhaBlocker, gocharaAvText } from '../jyotishData';

it('被遮只看 vedhaBy:凶位(effective 假、无遮蔽者)不标;吉位被遮写出遮蔽曜', ()=>{
	expect(gocharaVedhaBlocker({ good: false, effective: false, vedhaBy: null })).toBe('');
	expect(gocharaVedhaBlocker({ good: true, effective: false, vedhaBy: 'Mars' })).toBe('火星');
	expect(gocharaVedhaBlocker({ good: true, effective: true })).toBe('');
});

it('八分点:有 BAV 给 SAV/BAV;罗睺 / 计都 BAV 为空只给 SAV;都没有给空', ()=>{
	expect(gocharaAvText({ savBindu: 39, bavBindu: 6 })).toBe('SAV39/BAV6');
	expect(gocharaAvText({ savBindu: 28, bavBindu: null })).toBe('SAV28');
	expect(gocharaAvText(null)).toBe('');
});

it('页面与 AI 快照不再拿 effective === false 判被遮', ()=>{
	const dir = path.join(__dirname, '..', '..');
	['IndiaChart.js', 'IndiaChartMain.js'].forEach((f)=>{
		const src = readSource(path.join(dir, f));   // 页面门面按「门面 + 子模块」全集读
		expect(src).not.toMatch(/effective === false \? ['`][^'`]*Vedha/);
		expect(src).toMatch(/gocharaVedhaBlocker\(/);
	});
	expect(readSource(path.join(dir, 'IndiaChart.js'))).not.toMatch(/\/BAV\$\{it\.av\.bavBindu\}/);
});
