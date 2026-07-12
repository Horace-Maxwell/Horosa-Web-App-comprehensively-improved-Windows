// aiExport.exportPdf 守卫路径测试:空白/异常绝不假成功(0×0 → false;全白 → 重试一次仍白 → false,
// 零落盘)。成功路径依赖真实 canvas 栅格化,由 preview/手测矩阵覆盖,不在 jsdom 里伪造。
// canvasHasInk 为纯函数,直接注入 fake canvas 断言阈值行为。
jest.mock('html-to-image', ()=>({ toCanvas: jest.fn() }));
jest.mock('jspdf', ()=>({
	// 最小 jsPDF 形状:布局参数可读;故意不给 output —— 若守卫失效走到落盘会显式炸(而非静默假成功)。
	jsPDF: jest.fn().mockImplementation(()=>({
		internal: { pageSize: { getWidth: ()=>210, getHeight: ()=>297 } },
		addPage: jest.fn(),
		addImage: jest.fn(),
	})),
}));

import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { __aiExportTesting__ } from '../aiExport';

// 本套守的是「经典纯文本栅格路径」契约(v2 默认开后它仍是 v1 回退阀 + 样式化失败的防线④,永不许死代码化)。
// 直接测 exportPdfPlain;包装层 exportPdf 的 v2 分流由 aiExportGentleBeautify/preview 实抓覆盖。
const { exportPdfPlain: exportPdf, canvasHasInk, planPdfChunks } = __aiExportTesting__;

// 每块 CSS 高 = (块物理行数 / 总物理行数) × fullH,必须 ≤ MAX(=16000)才不触发 canvas 上限静默空白。
function maxChunkCssHeight(chunks, totalLines, fullH){
	// 用「无 title 的块」的物理行数估算(title 只加在第 0 块,几行,忽略不影响量级)
	let maxLines = 0;
	chunks.forEach((c)=>{ maxLines = Math.max(maxLines, c.split('\n').length); });
	return (maxLines / totalLines) * fullH;
}

describe('planPdfChunks 分块(高度比例摊,防长折行超上限)', ()=>{
	test('大量短行:每块高度 ≤ 上限,拼回原文', ()=>{
		const lines = Array.from({ length: 10000 }, (_, i)=>`第${i}行`);
		const text = lines.join('\n');
		const fullH = 10000 * 22.1;   // ≈221000,每物理行≈1视觉行
		const chunks = planPdfChunks(text, '标题', fullH, 8000);
		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks[0].startsWith('标题\n\n')).toBe(true);
		expect(chunks.join('\n').replace('标题\n\n', '')).toBe(text);
		expect(maxChunkCssHeight(chunks, 10000, fullH)).toBeLessThanOrEqual(16000);
	});

	test('少数超长物理行(长折行):每块仍 ≤ 上限(旧固定行数会塞成超高块)', ()=>{
		// 5 个物理行,但每行折成 ~360 视觉行 → 总高 40000。旧法 linesPerChunk=362 会把 5 行全塞 1 块(40000px 超限)。
		const lines = Array.from({ length: 5 }, (_, i)=>`超长段落${i}`.repeat(2000));
		const text = lines.join('\n');
		const fullH = 40000;
		const chunks = planPdfChunks(text, '', fullH, 8000);
		expect(maxChunkCssHeight(chunks, 5, fullH)).toBeLessThanOrEqual(16000);
		expect(chunks.join('\n')).toBe(text);   // 无丢行
	});

	test('fullH<=0 或 chunkHeight<=0 → 单块(退化不分),title 进块', ()=>{
		expect(planPdfChunks('a\nb', 'T', 0, 8000)).toEqual(['T\n\na\nb']);
		expect(planPdfChunks('a\nb', '', 40000, 0)).toEqual(['a\nb']);
	});
});

// fake canvas:全白(alpha=255, rgb=255);inkRow 指定一粒墨(rgb=0)所在设备行。
function fakeCanvas(w, h, inkRow){
	return {
		width: w,
		height: h,
		getContext: ()=>({
			getImageData: (x, y, ww, hh)=>{
				const data = new Uint8ClampedArray(ww * hh * 4);
				data.fill(255);
				if(inkRow != null && inkRow >= y && inkRow < y + hh){
					const off = (inkRow - y) * ww * 4;
					data[off] = 0; data[off + 1] = 0; data[off + 2] = 0; data[off + 3] = 255;
				}
				return { data };
			},
		}),
	};
}

describe('canvasHasInk 纯函数', ()=>{
	test('全白 → false(alpha 满但 rgb 不低于阈值)', ()=>{
		expect(canvasHasInk(fakeCanvas(100, 200))).toBe(false);
	});
	test('顶部一粒墨 → true', ()=>{
		expect(canvasHasInk(fakeCanvas(100, 200, 3))).toBe(true);
	});
	test('墨在较深行(跨 64 行块边界)→ true', ()=>{
		expect(canvasHasInk(fakeCanvas(100, 500, 130))).toBe(true);
	});
	test('0 尺寸/null → false(异常按无墨迹保守处理)', ()=>{
		expect(canvasHasInk(fakeCanvas(0, 0))).toBe(false);
		expect(canvasHasInk(null)).toBe(false);
	});
	test('getImageData 抛错 → false 不 throw', ()=>{
		const bad = { width: 10, height: 10, getContext: ()=>({ getImageData: ()=>{ throw new Error('tainted'); } }) };
		expect(canvasHasInk(bad)).toBe(false);
	});
});

describe('exportPdf 守卫(禁假成功)', ()=>{
	const payload = { tech: '测试技法', text: '========== 内容开始 ==========\n第一行', filenameBase: 'test' };
	beforeEach(()=>{
		toCanvas.mockReset();
		jsPDF.mockClear();
	});

	function pdfInstances(){
		return jsPDF.mock.results.map((r)=>r.value).filter(Boolean);
	}

	test('toCanvas 返 0×0 → 重试一次后 false,addImage 零调用(零落盘)', async ()=>{
		toCanvas.mockResolvedValue(fakeCanvas(0, 0));
		await expect(exportPdf(payload)).resolves.toBe(false);
		expect(toCanvas).toHaveBeenCalledTimes(2);
		pdfInstances().forEach((p)=>expect(p.addImage).not.toHaveBeenCalled());
	});

	test('全白 canvas → 原地重试恰一次,仍白 → false 零落盘', async ()=>{
		toCanvas.mockResolvedValue(fakeCanvas(1588, 2000));
		await expect(exportPdf(payload)).resolves.toBe(false);
		expect(toCanvas).toHaveBeenCalledTimes(2);
		pdfInstances().forEach((p)=>expect(p.addImage).not.toHaveBeenCalled());
	});

	test('克隆样式覆盖契约:toCanvas 收到 style 定位归零 + skipFonts(防线①回归锚)', async ()=>{
		toCanvas.mockResolvedValue(fakeCanvas(0, 0));
		await exportPdf(payload);
		const opts = toCanvas.mock.calls[0][1] || {};
		expect(opts.skipFonts).toBe(true);
		expect(opts.style).toEqual(expect.objectContaining({ position: 'static', left: '0', top: '0' }));
	});

	test('toCanvas 抛错 → false 不 throw,离屏宿主已清理', async ()=>{
		toCanvas.mockRejectedValue(new Error('render fail'));
		await expect(exportPdf(payload)).resolves.toBe(false);
		expect(document.body.querySelectorAll('div').length).toBe(0);
	});
});

// happy-path:有墨迹 canvas 走通切片→output→blob 守卫→downloadBlob→true(此前唯一自动化盲区)。
// 需 mock slice canvas(jsdom 无 2d 上下文)、URL.createObjectURL、jsPDF.output。
describe('exportPdf 成功路径(happy-path 落盘)', ()=>{
	const payload = { tech: '测试技法', text: '========== 内容开始 ==========\n第一行\n第二行', filenameBase: 'test' };
	let createSpy;
	let origCreateURL;
	let origRevokeURL;
	beforeEach(()=>{
		toCanvas.mockReset();
		jsPDF.mockReset();
		const realCreate = document.createElement.bind(document);
		createSpy = jest.spyOn(document, 'createElement').mockImplementation((tag)=>{
			if(tag === 'canvas'){
				return { width: 0, height: 0, getContext: ()=>({ drawImage(){} }), toDataURL: ()=>'data:image/jpeg;base64,AAAA' };
			}
			return realCreate(tag);   // div(宿主)/ a(下载)走真实
		});
		origCreateURL = global.URL.createObjectURL;
		origRevokeURL = global.URL.revokeObjectURL;
		global.URL.createObjectURL = jest.fn(()=>'blob:fake');
		global.URL.revokeObjectURL = jest.fn();
	});
	afterEach(()=>{
		createSpy.mockRestore();
		global.URL.createObjectURL = origCreateURL;
		global.URL.revokeObjectURL = origRevokeURL;
	});

	test('有墨迹 canvas → addImage 落页 + downloadBlob(object URL) 触发 → true', async ()=>{
		toCanvas.mockResolvedValue(fakeCanvas(1588, 2000, 3));   // 尺寸正常 + 顶部有墨迹
		const addImage = jest.fn();
		jsPDF.mockImplementation(()=>({
			internal: { pageSize: { getWidth: ()=>210, getHeight: ()=>297 } },
			addPage: jest.fn(),
			addImage,
			output: ()=>({ size: 12000 }),   // >5000 阈值
		}));
		await expect(exportPdf(payload)).resolves.toBe(true);
		expect(addImage).toHaveBeenCalled();                       // 至少一页切片进 pdf
		expect(global.URL.createObjectURL).toHaveBeenCalled();     // downloadBlob 落盘链走到
	});

	test('blob 尺寸 <5000 → false 不落盘(误伤极短 PDF 时诚实降级,由 runAIExport 兜 TXT)', async ()=>{
		toCanvas.mockResolvedValue(fakeCanvas(1588, 2000, 3));
		jsPDF.mockImplementation(()=>({
			internal: { pageSize: { getWidth: ()=>210, getHeight: ()=>297 } },
			addPage: jest.fn(),
			addImage: jest.fn(),
			output: ()=>({ size: 800 }),     // 异常小
		}));
		await expect(exportPdf(payload)).resolves.toBe(false);
		expect(global.URL.createObjectURL).not.toHaveBeenCalled();
	});
});
