import {
	exportConversationByFormat,
	exportWorkspaceBackupBlob,
	parseWorkspaceBackupBlob,
	withUtf8Bom,
} from '../aiAnalysisExport';

describe('aiAnalysisExport', ()=>{
	test('exportConversationByFormat supports markdown and json', async ()=>{
		const conversation = { title: '测试对话' };
		const messages = [{ role: 'user', content: '你好' }];
		const mdExport = await exportConversationByFormat(conversation, messages, 'md');
		expect(mdExport.fileName).toBe('测试对话.md');
		const mdText = await new Response(mdExport.blob).text();
		expect(mdText).toContain('# 测试对话');

		const jsonExport = await exportConversationByFormat(conversation, messages, 'json');
		expect(jsonExport.fileName).toBe('测试对话.json');
		const jsonText = await new Response(jsonExport.blob).text();
		expect(jsonText).toContain('"role": "user"');
	});

	// [E4] BOM 政策:人读格式(md/txt)带 BOM(TextEdit/记事本按本地编码猜 → 中文乱);
	// json 机读绝不带(BOM 炸 JSON.parse)。
	// 断言走原始字节:Response.text() 按规范剥 BOM,用它验首字符永远看不到 0xFEFF。
	test('会话导出 md/txt 带 UTF-8 BOM;json 不带且可 JSON.parse', async ()=>{
		const conversation = { title: '编码对话' };
		const messages = [{ role: 'user', content: '技术:三式合一' }];
		// jsdom Blob 无 arrayBuffer(),经 Response 取原始字节(arrayBuffer 不做文本解码,BOM 保留)
		const head3 = async (blob)=>Array.from(new Uint8Array(await new Response(blob).arrayBuffer())).slice(0, 3);
		const md = await exportConversationByFormat(conversation, messages, 'md');
		expect(await head3(md.blob)).toEqual([0xEF, 0xBB, 0xBF]);
		const txt = await exportConversationByFormat(conversation, messages, 'txt');
		expect(await head3(txt.blob)).toEqual([0xEF, 0xBB, 0xBF]);
		const json = await exportConversationByFormat(conversation, messages, 'json');
		expect(await head3(json.blob)).not.toEqual([0xEF, 0xBB, 0xBF]);
		const jsonText = await new Response(json.blob).text();
		expect(()=>JSON.parse(jsonText)).not.toThrow();
	});

	test('withUtf8Bom:命中面精确 + 幂等 + 非字符串透传', ()=>{
		expect(withUtf8Bom('中文', 'text/plain;charset=utf-8').charCodeAt(0)).toBe(0xFEFF);
		expect(withUtf8Bom('中文', 'application/msword;charset=utf-8').charCodeAt(0)).toBe(0xFEFF);
		expect(withUtf8Bom('中文', 'text/markdown').charCodeAt(0)).toBe(0xFEFF);
		// 幂等:双跑不双 BOM
		const once = withUtf8Bom('中文', 'text/plain');
		expect(withUtf8Bom(once, 'text/plain')).toBe(once);
		// 机读/声明式格式不加
		expect(withUtf8Bom('{"a":1}', 'application/json;charset=utf-8').charCodeAt(0)).not.toBe(0xFEFF);
		expect(withUtf8Bom('<html/>', 'text/html;charset=utf-8').charCodeAt(0)).not.toBe(0xFEFF);
		expect(withUtf8Bom('a,b', 'text/csv').charCodeAt(0)).not.toBe(0xFEFF);
		// 非字符串(Blob 等)原样透传
		const blob = new Blob(['x']);
		expect(withUtf8Bom(blob, 'application/pdf')).toBe(blob);
	});

	test('workspace backup can roundtrip manifest payload', async ()=>{
		const workspace = {
			snapshotVersion: 2,
			stores: {
				provider_profiles: [{ id: 'provider-1' }],
				materials: [{ id: 'material-1' }],
			},
		};
		const blob = await exportWorkspaceBackupBlob(workspace);
		const parsed = await parseWorkspaceBackupBlob(blob);
		expect(parsed.snapshotVersion).toBe(2);
		expect(parsed.stores.provider_profiles[0].id).toBe('provider-1');
	});
});
