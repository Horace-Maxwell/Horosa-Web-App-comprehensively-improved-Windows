// v2 呈现层 IR 解析器 + PDF 块装箱 纯函数测试。
import { parseAiExportDocument, parseExportSectionTitle, packBlocksIntoChunks, mdInlineSegments } from '../aiExportDocModel';

describe('mdInlineSegments 行内分段(渲染端消化记号的单源)', ()=>{
	test('粗/斜/码分段与纯文本回退', ()=>{
		expect(mdInlineSegments('**甲**：乙*丙*`丁`戊')).toEqual([
			{ text: '甲', bold: true }, { text: '：乙' }, { text: '丙', em: true }, { text: '丁', code: true }, { text: '戊' },
		]);
		expect(mdInlineSegments('纯文本')).toEqual([{ text: '纯文本' }]);
		expect(mdInlineSegments('')).toEqual([]);
		expect(mdInlineSegments(null)).toEqual([]);
	});
	test('落单未闭合记号原样保留(不误吞)', ()=>{
		expect(mdInlineSegments('落单**不闭合')).toEqual([{ text: '落单**不闭合' }]);
	});
	test('与 docxCommon.mdInlineToRuns 同正则语义:段拼接=原文剥记号', ()=>{
		const src = '- **事业方向**：宜金融,应期在**2027(丁未)年**。';
		expect(mdInlineSegments(src).map((s)=>s.text).join('')).toBe('- 事业方向：宜金融,应期在2027(丁未)年。');
	});
});

describe('parseExportSectionTitle 段头识别(与 aiExport.parseSectionTitleLine 同识别面)', ()=>{
	test('[X] 与 【X】 整行识别;非整行/非段头返空', ()=>{
		expect(parseExportSectionTitle('[起盘信息]')).toBe('起盘信息');
		expect(parseExportSectionTitle('  【命中格局】 ')).toBe('命中格局');
		expect(parseExportSectionTitle('前缀 [起盘信息]')).toBe('');
		expect(parseExportSectionTitle('干支：甲子')).toBe('');
		expect(parseExportSectionTitle('')).toBe('');
	});
});

describe('parseAiExportDocument 全文解析', ()=>{
	const sample = [
		'技术: 紫微斗数',
		'导出时间: 2026-07-11 10:00',
		'========== 内容开始 ==========',
		'[起盘信息]',
		'姓名：张三',
		'性别：男',
		'',
		'[宫位总览]',
		'| 宫位 | 干支 | 主星 |',
		'| --- | :--: | --- |',
		'| 命宫 | 甲子 | 紫微 |',
		'| 兄弟 | 乙丑 | 天机 |',
		'◆ 大限方向',
		'注：顺行。',
		'一段普通说明文字。',
		'========== 内容结束 ==========',
	].join('\n');

	test('preamble/段/postamble 三分,块类型齐(kv/table/subhead/note/p)', ()=>{
		const doc = parseAiExportDocument(sample);
		expect(doc.preamble).toContain('技术: 紫微斗数');
		expect(doc.preamble).toContain('内容开始');
		expect(doc.sections.map((s)=>s.title)).toEqual(['起盘信息', '宫位总览']);
		const s0 = doc.sections[0];
		expect(s0.blocks.map((b)=>b.type)).toEqual(['kv', 'kv']);
		expect(s0.blocks[0]).toMatchObject({ type: 'kv', key: '姓名', value: '张三' });
		const s1 = doc.sections[1];
		expect(s1.blocks[0].type).toBe('table');
		expect(s1.blocks[0].headers).toEqual(['宫位', '干支', '主星']);
		expect(s1.blocks[0].aligns).toEqual(['left', 'center', 'left']);
		expect(s1.blocks[0].rows).toEqual([['命宫', '甲子', '紫微'], ['兄弟', '乙丑', '天机']]);
		expect(s1.blocks[1]).toMatchObject({ type: 'subhead', text: '大限方向' });
		expect(s1.blocks[2]).toMatchObject({ type: 'note' });
		expect(s1.blocks[3]).toMatchObject({ type: 'p', text: '一段普通说明文字。' });
		expect(doc.postamble).toContain('内容结束');
	});

	test('v1 无段头文本退化为零段落+全 preamble(不 throw)', ()=>{
		const doc = parseAiExportDocument('技术: X\n随便一行\n又一行');
		expect(doc.sections).toEqual([]);
		expect(doc.preamble).toContain('随便一行');
	});

	test('空/null 输入安全', ()=>{
		expect(parseAiExportDocument('').sections).toEqual([]);
		expect(parseAiExportDocument(null).sections).toEqual([]);
	});

	test('长键含标点不误判 kv(整句归 p)', ()=>{
		const doc = parseAiExportDocument('[段]\n这是一句,包含：冒号但键含标点不该拆。');
		expect(doc.sections[0].blocks[0].type).toBe('p');
	});
});

describe('packBlocksIntoChunks 装箱(整块最小单位)', ()=>{
	test('顺序装箱,不超 chunkHeight;拼回全覆盖零丢块', ()=>{
		const chunks = packBlocksIntoChunks([3000, 3000, 3000, 3000, 3000], 8000, 15000);
		expect(chunks).toEqual([{ start: 0, end: 2 }, { start: 2, end: 4 }, { start: 4, end: 5 }]);
	});
	test('单块超 hardMax → 独占一段带 split 标记(不再 null 整份降级)', ()=>{
		const chunks = packBlocksIntoChunks([3000, 20000, 100], 8000, 15000);
		expect(chunks).toEqual([
			{ start: 0, end: 1 },
			{ start: 1, end: 2, split: 2 },
			{ start: 2, end: 3 },
		]);
	});
	test('单块 > chunkHeight 但 ≤ hardMax → 独占一箱(不 null)', ()=>{
		const chunks = packBlocksIntoChunks([1000, 12000, 1000], 8000, 15000);
		expect(chunks).toEqual([{ start: 0, end: 1 }, { start: 1, end: 2 }, { start: 2, end: 3 }]);
	});
	test('空/退化参数安全', ()=>{
		expect(packBlocksIntoChunks([], 8000, 15000)).toEqual([{ start: 0, end: 0 }]);
		expect(packBlocksIntoChunks([100, 100], 0, 0)).toEqual([{ start: 0, end: 2 }]);
	});
});

// 两张表之间没有空行(印占「星盘信息」宫头表紧接星点表):第二张表的表头 + 分隔行必须另起一表,
// 不能被吞成第一张表的数据行(此前 Word / PDF 里多出「点位 | 位置 | 逆行」「--- | --- | ---」两行)。
describe('紧挨着的两张表分开解析', ()=>{
	it('表头 + 分隔行处另起一表', ()=>{
		const { parseAiExportDocument } = require('../aiExportDocModel');
		const doc = parseAiExportDocument(['[星盘信息]', '| 宫位 | 宫头 |', '| --- | --- |', '| 第一宫 | 0˚巨蟹 |', '| 第二宫 | 0˚狮子 |', '| 点位 | 位置 | 逆行 |', '| --- | --- | --- |', '| 日 | 3˚金牛 | — |'].join('\n'));
		const tables = doc.sections[0].blocks.filter((b)=>b.type === 'table');
		expect(tables).toHaveLength(2);
		expect(tables[0].headers).toEqual(['宫位', '宫头']);
		expect(tables[0].rows).toHaveLength(2);
		expect(tables[1].headers).toEqual(['点位', '位置', '逆行']);
		expect(tables[1].rows).toEqual([['日', '3˚金牛', '—']]);
	});
	it('数据行里全是「-」占位的一行照样是数据行,不被当成新表的分隔行吞掉', ()=>{
		const { parseAiExportDocument } = require('../aiExportDocModel');
		const doc = parseAiExportDocument(['[表]', '| 星 | 宫 | 度 |', '| --- | --- | --- |', '| 日 | 1 | 10 |', '| 月 | 2 | 20 |', '| - | - | - |', '| 金 | 4 | 40 |'].join('\n'));
		const tables = doc.sections[0].blocks.filter((b)=>b.type === 'table');
		expect(tables).toHaveLength(1);
		expect(tables[0].rows).toEqual([['日', '1', '10'], ['月', '2', '20'], ['-', '-', '-'], ['金', '4', '40']]);
	});
	it('下一张表的表头格数与分隔行不同 → 不另起(防误切)', ()=>{
		const { parseAiExportDocument } = require('../aiExportDocModel');
		const doc = parseAiExportDocument(['[表]', '| a | b |', '| --- | --- |', '| 1 | 2 |', '| x | y |', '| --- | --- | --- |'].join('\n'));
		const tables = doc.sections[0].blocks.filter((b)=>b.type === 'table');
		expect(tables[0].rows.slice(0, 2)).toEqual([['1', '2'], ['x', 'y']]);
	});
	it('印占段落拼装保留表与表之间的空行(TXT / 喂 AI 的正文也分得开)', ()=>{
		const src = require('fs').readFileSync(require('path').join(__dirname, '../../components/astro/IndiaChart.js'), 'utf8');
		expect(src).toContain("const starInfo = [houseCusps, starsAndPoints, info].filter((part)=>part.length)");
		expect(src).toContain('.filter((line, i, arr)=>line.trim() || (i > 0 && arr[i - 1].trim()));');
	});
});
