// [A2] docx 正文行内样式契约:**粗**/*斜*/`码` 必须转真样式 run(w:b / w:i / Courier New),
// 星号/反引号字面绝不出现在 document.xml——此前正文段落裸 TextRun 原样输出记号,
// 与同文件表格单元格(走 mdInlineToRuns)自相矛盾。解包真 docx(zip)断言,不测中间层。
import JSZip from 'jszip';
import { buildExportDocxBlob, renderExportDocToPdfNodes } from '../aiExportDocRender';

// 捆绑 jsdom 的 Blob 无 arrayBuffer(),走 FileReader 兼容读。
function blobToArrayBuffer(blob){
	return new Promise((resolve, reject)=>{
		const reader = new FileReader();
		reader.onload = ()=>resolve(reader.result);
		reader.onerror = ()=>reject(reader.error);
		reader.readAsArrayBuffer(blob);
	});
}

async function docxXmlOf(text){
	const blob = await buildExportDocxBlob({ tech: '测试', text });
	const buf = await blobToArrayBuffer(blob);
	const zip = await JSZip.loadAsync(buf);
	return zip.file('word/document.xml').async('string');
}

describe('[A2] aiExportDocRender 正文行内样式', ()=>{
	test('正文段落:粗/斜/码 转真样式,记号字面不落 xml', async ()=>{
		const xml = await docxXmlOf([
			'==== 内容开始 ====',
			'【总论】',
			'这是**要紧结论**与*旁注语气*以及`丙午`干支。',
			'==== 内容结束 ====',
		].join('\n'));
		expect(xml).toContain('要紧结论');
		expect(xml).toContain('旁注语气');
		expect(xml).toContain('丙午');
		expect(xml).toContain('<w:b/>');
		expect(xml).toContain('<w:i/>');
		expect(xml).toContain('Courier New');
		expect(xml).not.toContain('**');
		expect(xml).not.toContain('`');
	});

	test('项目符号行同样走行内样式', async ()=>{
		const xml = await docxXmlOf([
			'==== 内容开始 ====',
			'【要点】',
			'- 第一条含**加粗要点**',
			'- 第二条纯文本',
			'==== 内容结束 ====',
		].join('\n'));
		expect(xml).toContain('加粗要点');
		expect(xml).toContain('<w:b/>');
		expect(xml).not.toContain('**');
	});

	// [E5] 此前 subhead/note/kv 三块型裸 TextRun:`◆ **重点**` 的星号字面落 xml;
	// kv 的 `**引导词**：` 星号被 KV_RE 吃进 key 后原样输出(又星号又加粗,双重丑)。
	test('[E5] subhead/note/kv 三块型:行内记号消化、真样式在位', async ()=>{
		const xml = await docxXmlOf([
			'==== 内容开始 ====',
			'【要点】',
			'◆ 含**重点**的子题',
			'注：说明里也有**强调**语',
			'**事业方向**：宜金融',
			'==== 内容结束 ====',
		].join('\n'));
		expect(xml).toContain('重点');
		expect(xml).toContain('强调');
		expect(xml).toContain('事业方向');
		expect(xml).toContain('<w:b/>');
		expect(xml).not.toContain('**');
	});
});

describe('[E5] 样式化/打印 PDF DOM 行内样式', ()=>{
	test('各块型 <b> 真样式,textContent 无字面记号', ()=>{
		const nodes = renderExportDocToPdfNodes({ tech: '测试', text: [
			'==== 内容开始 ====',
			'【总论】',
			'段落含**要紧**结论。',
			'',
			'- 列表含**加粗要点**',
			'',
			'> 引语含**强调**',
			'',
			'◆ 子题带**重点**',
			'**事业方向**：宜金融',
			'',
			'| 头**粗** | 值 |',
			'|---|---|',
			'| **甲** | 乙 |',
			'==== 内容结束 ====',
		].join('\n') });
		const host = document.createElement('div');
		nodes.forEach((n)=>host.appendChild(n));
		expect(host.querySelectorAll('b').length).toBeGreaterThanOrEqual(5);
		expect(host.textContent).not.toContain('**');
		expect(host.textContent).toContain('要紧');
		expect(host.textContent).toContain('加粗要点');
		expect(host.textContent).toContain('事业方向：宜金融');
	});
});
