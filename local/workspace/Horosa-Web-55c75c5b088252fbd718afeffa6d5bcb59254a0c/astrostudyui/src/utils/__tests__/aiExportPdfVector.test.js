// 可选中文字 PDF 矢量引擎压测(穷举内容结构 + 多语言字体覆盖 + 边界 + ★字体乱码回归守卫)。
// mock fetch 让引擎取到真实打包字体(public/fonts/HorosaCJK-subset.ttf);跑真引擎产 PDF 字节,
// 断言:不抛、有效 %PDF、Type0 CID(中文可选)、页数合理、混排简繁韩符号不崩。
// ★2026-07-14 乱码根治守卫:字体必须 TrueType(glyf,/CIDFontType2+/FontFile2)且整嵌,绝不能是
//   CFF(/CIDFontType0 或 /FontFile3)——CFF 经 pdf-lib 产出非法内嵌文件,Preview/poppler 拒渲=整份乱码;
//   且整嵌(非子集)才保全字形(fontkit subset:true 静默丢字形)。旧测只查 Type0 存在→漏了「字体文件是否有效」。
import fs from 'fs';
import path from 'path';
import { buildExportPdfVectorBlob } from '../aiExportPdfVector';

const FONT_PATH = path.join(__dirname, '../../../public/fonts/HorosaCJK-subset.ttf');

beforeAll(() => {
	const buf = fs.readFileSync(FONT_PATH);
	const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
	global.fetch = jest.fn(async ()=> ({ ok: true, status: 200, arrayBuffer: async ()=> ab }));
});
afterAll(() => { delete global.fetch; });

// Blob.arrayBuffer polyfill for jsdom(取字节做断言)。
async function blobBytes(blob){
	if(blob.arrayBuffer){ return new Uint8Array(await blob.arrayBuffer()); }
	return new Uint8Array(await new Response(blob).arrayBuffer());
}
function pdfInfo(bytes){
	let s = '';
	for(let i = 0; i < bytes.length; i++){ s += String.fromCharCode(bytes[i]); }
	// pdf-lib 默认把字体/CID 字典压进 ObjStm(FlateDecode)→ 原始字节看不到 /Type0、/ToUnicode。
	// 解压所有 Flate 流再判(否则「可选中」判据随压缩策略漂移,正是旧测漏字体乱码的次因)。
	const zlib = require('zlib');
	let deep = s;
	const re = /stream\r?\n/g; let m;
	while((m = re.exec(s)) !== null){
		const start = m.index + m[0].length;
		const end = s.indexOf('endstream', start);
		if(end < 0){ continue; }
		try{ deep += zlib.inflateSync(Buffer.from(bytes.slice(start, end))).toString('latin1'); }catch(e){ /* 非 Flate 流跳过 */ }
	}
	return {
		valid: s.startsWith('%PDF'),
		hasEOF: /%%EOF\s*$/.test(s.trim()),
		hasType0: /\/Type0\b/.test(deep),          // CID Type0 复合字体 = 中文可选
		hasToUnicode: /\/ToUnicode\b/.test(deep),  // 有 ToUnicode CMap = 可选可搜(复制得回原字)
		sizeKB: Math.round(bytes.length / 1024),
	};
}

// 打包字体的 sfnt 头 4 字节:'OTTO'=CFF/OTF(乱码坑),0x00010000 或 'true'=TrueType(glyf,正确)。
function fontSfntKind(){
	const b = fs.readFileSync(FONT_PATH);
	const tag = String.fromCharCode(b[0], b[1], b[2], b[3]);
	if(tag === 'OTTO'){ return 'CFF/OTF'; }
	if(tag === 'true' || (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0) || tag === 'ttcf'){ return 'TrueType'; }
	return 'unknown:' + tag;
}

function bigTable(rows, cols){
	const headers = Array.from({ length: cols }, (_, i)=> `列${i + 1}`);
	const sep = Array.from({ length: cols }, ()=> '---');
	const body = Array.from({ length: rows }, (_, r)=> `| ${Array.from({ length: cols }, (_, c)=> `r${r}c${c}·财官印`).join(' | ')} |`);
	return [`| ${headers.join(' | ')} |`, `| ${sep.join(' | ')} |`, ...body].join('\n');
}

describe('矢量 PDF 引擎 · 穷举内容结构', () => {
	test('多分区 + 表格 + kv + note + 长段：有效可选中多页 PDF', async () => {
		const sections = [];
		for(let i = 0; i < 12; i++){
			sections.push(`【第${i + 1}节·命宫主星与四化】`);
			sections.push(`日主：丙火　用神：金水　忌神：木火（第${i + 1}节）`);
			sections.push('· 子段头');
			sections.push(bigTable(8, 5));
			sections.push('正文'.repeat(400));
		}
		const payload = { tech: '紫微斗数', filenameBase: 'x', text: sections.join('\n\n') };
		const blob = await buildExportPdfVectorBlob(payload);
		expect(blob).toBeTruthy();
		const info = pdfInfo(await blobBytes(blob));
		expect(info.valid).toBe(true);
		expect(info.hasType0).toBe(true);
		expect(info.sizeKB).toBeGreaterThan(3);
	});

	test('简繁韩符号混排：字体覆盖不崩、Type0 存在', async () => {
		const text = [
			'【多语言覆盖】',
			'简体：无为财运时贵岁风禄业进见处当动谋云须从权顺离与宫',
			'繁體：無為財運時貴歲風祿業進見處當動謀雲須從權順離與宮',
			'한국어：과 성 주 궁 상 신 사 와 론 명 기 총 점 조 용 년 수 고 행 반',
			'卦符：☰ ☱ ☲ ☳ ☴ ☵ ☶ ☷　度符：° ′ ″ · — … ※ ☀ ☾',
		].join('\n');
		const blob = await buildExportPdfVectorBlob({ tech: '导出', filenameBase: 'x', text });
		const info = pdfInfo(await blobBytes(blob));
		expect(info.valid).toBe(true);
		expect(info.hasType0).toBe(true);
		// ★简繁韩符号走整嵌(非丢字形子集)——PDF 含整份字库故远大于子集。
		expect(info.sizeKB).toBeGreaterThan(400);
	});

	// ★乱码根治守卫(2026-07-14):双锚,任一回归立刻红。
	//   锚① 打包字体必须 TrueType(glyf),绝不能 CFF/OTF('OTTO')——CFF 经 pdf-lib 产出非法内嵌文件,
	//        Preview/poppler 拒渲=整份乱码(pdffonts 报 "Embedded font file may be invalid")。改回 .otf 即红。
	//   锚② 输出 PDF 必须「整嵌」(sizeKB 大)——fontkit subset:true 会静默丢字形产极小 PDF;整嵌全字库故 PDF>1MB。
	//        改回 subset:true 即红。旧测只查 Type0 存在,漏了此两锚——正是本次乱码从测试溜过去的根因。
	test('★字体乱码守卫:打包字体是 TrueType(glyf) 且输出整嵌(非 CFF、非丢字形子集)', async () => {
		expect(fontSfntKind()).toBe('TrueType');     // 锚①:.otf('OTTO') 会红
		const text = '【守卫】\n命盘·行星年龄 今日宜忌 值神值宿 通书择日 日子馆·个性化择日 冲煞·胎神·方位';
		const blob = await buildExportPdfVectorBlob({ tech: '守卫', filenameBase: 'x', text });
		const info = pdfInfo(await blobBytes(blob));
		expect(info.valid).toBe(true);
		expect(info.hasType0).toBe(true);
		expect(info.sizeKB).toBeGreaterThan(400);    // 锚②:subset:true(几十KB)会红
	});

	test('超长单表(60 行) + 跨页表头：不崩、有效', async () => {
		const blob = await buildExportPdfVectorBlob({ tech: '大表', filenameBase: 'x', text: `【全年吉日】\n\n${bigTable(60, 6)}` });
		const info = pdfInfo(await blobBytes(blob));
		expect(info.valid).toBe(true);
		expect(info.sizeKB).toBeGreaterThan(3);
	});

	// [A3] 跨页表头重绘契约:长表跨到的每一页,该页首个表行必须是表头(与打印路径
	// `<thead>` 每页重复对齐)。旧缺陷=表头只画首页,第二页起裸行。
	test('[A3] 长表跨页:每页首个表行=表头', async () => {
		const rows = [];
		const blob = await buildExportPdfVectorBlob(
			{ tech: '跨页表', filenameBase: 'x', text: `【全年吉日】\n\n${bigTable(80, 5)}` },
			{ onTableRow: (r)=> rows.push(r) },
		);
		expect(pdfInfo(await blobBytes(blob)).valid).toBe(true);
		const pagesSeen = [...new Set(rows.map((r)=> r.pageIndex))];
		expect(pagesSeen.length).toBeGreaterThan(1);   // 真跨页了
		pagesSeen.forEach((p)=>{
			const firstOnPage = rows.find((r)=> r.pageIndex === p);
			expect(`p${p}:${firstOnPage.isHeader}`).toBe(`p${p}:true`);
		});
		// 表头出现次数 = 跨到的页数(每页恰一枚,不多画)
		expect(rows.filter((r)=> r.isHeader).length).toBe(pagesSeen.length);
	});

	test('含截图 dataUrl(1x1 JPEG)：截图页 + 正文', async () => {
		// 最小合法 JPEG(1x1) base64
		const jpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8AB//Z';
		const blob = await buildExportPdfVectorBlob({ tech: '带图', filenameBase: 'x', text: '【正文】\n内容', screenshot: { dataUrl: jpg, width: 1, height: 1 } });
		const info = pdfInfo(await blobBytes(blob));
		expect(info.valid).toBe(true);
	});
});

describe('矢量 PDF 引擎 · 边界/健壮', () => {
	test('空文本：仍产有效 PDF(只标题)不抛', async () => {
		const blob = await buildExportPdfVectorBlob({ tech: '空', filenameBase: 'x', text: '' });
		expect(pdfInfo(await blobBytes(blob)).valid).toBe(true);
	});
	test('纯符号/无分区：不抛、有效', async () => {
		const blob = await buildExportPdfVectorBlob({ tech: '符', filenameBase: 'x', text: '☰☱☲☳ ° ′ ″ · — …' });
		expect(pdfInfo(await blobBytes(blob)).valid).toBe(true);
	});
	test('缺 tech/filenameBase 兜底不抛', async () => {
		const blob = await buildExportPdfVectorBlob({ text: '【节】\n内容' });
		expect(blob).toBeTruthy();
	});
});
