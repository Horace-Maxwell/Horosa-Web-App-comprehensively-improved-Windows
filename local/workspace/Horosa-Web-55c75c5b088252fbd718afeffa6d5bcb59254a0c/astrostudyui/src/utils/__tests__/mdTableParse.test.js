// GFM 表格识别单源:紧挨着的第二张表要另起(各条 md→docx 链共用同一判据)。
import fs from 'fs';
import path from 'path';
import { isNextTableStart, isDocxTableSep, isTableBodyLine } from '../mdTableParse';

describe('紧挨着的下一张表', ()=>{
	test('表头 + 规整分隔行 + 列数相同 → 是下一张表', ()=>{
		expect(isNextTableStart('| 星 | 座 |', '|---|---|')).toBe(true);
		expect(isNextTableStart('| 星 | 座 | 度 |', '| :--- | :---: | ---: |')).toBe(true);
	});
	test('表体里的「- 占位」行、列数不同、没有下一行 → 不是', ()=>{
		expect(isNextTableStart('| 甲 | 乙 |', '| - | - |')).toBe(false);
		expect(isNextTableStart('| 甲 | 乙 |', '|---|---|---|')).toBe(false);
		expect(isNextTableStart('| 甲 | 乙 |', undefined)).toBe(false);
		expect(isNextTableStart('| 甲 | 乙 |', '| 丙 | 丁 |')).toBe(false);
	});
	test('宽松分隔行判据照旧(只是「另起一表」要求更严)', ()=>{
		expect(isDocxTableSep('| - | - |')).toBe(true);
		expect(isTableBodyLine('| a |')).toBe(true);
		expect(isTableBodyLine('   ')).toBe(false);
	});
	test('导出文档模型用的是这个单源判据', ()=>{
		const model = fs.readFileSync(path.join(__dirname, '../aiExportDocModel.js'), 'utf8');
		expect(model).toContain('!isNextTableStart(lines[j], lines[j + 1])');
		expect(model).not.toMatch(/function startsNextTable|const STRICT_TABLE_SEP/);
	});
});
